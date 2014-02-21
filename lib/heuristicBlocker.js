// Keeps track of heuristics for blocking domains

"use strict";

const { Cc, Ci } = require("chrome");
const { newURI } = require('sdk/url/utils');
const { storage } = require("sdk/simple-storage");
const utils = require("./utils");
const cookieUtils  = require("./cookieUtils");
const { on, once, off, emit } = require('sdk/event/core');
const { Policy } = require("./contentPolicy");

/**
 * originFrequency: A map of third party domains to the set of first party
 * domains where they have been observed making requests.
 *
 * setCookieFrequency: A map of third party domains to the set of first party
 * domains where they have been observed setting cookies.
 *
 * blockedOrigins: The set of domains that are blocked from making third party
 * requests due to the heuristic.
 */
const stored = [ "originFrequency",
                 "setCookieFrequency",
                 "blockedOrigins" ];

// Initialize persistent storage
exports.init = function () {
  stored.forEach(function(store) {
    if (!storage[store]) storage[store] = {};
});};

// Log the saved blocklist
console.log("blockedOrigins:", storage.blockedOrigins);

// Threshold of 1st party origins tracked by a 3rd party to trigger blocking
const gPrevalenceThreshold = 3;

// We need something better than this eventually!
// map to lower case before using
const gLowEntropyCookieValues = {
  "":true,
  "nodata":true,
  "no_data":true,
  "yes":true,
  "no":true,
  "true":true,
  "false":true,
  "opt-out":true,
  "optout":true,
  "opt_out":true,
  "0":true,
  "1":true,
  "2":true,
  "3":true,
  "4":true,
  "5":true,
  "6":true,
  "7":true,
  "8":true,
  "9":true
};

/**
 * Determine if a request should ignored in the blocker accounting
 * @param {nsIHttpChannel} channel
 * @return {Boolean}
 */
let ignoreRequest = function(channel) {

  // Ignore first party requests and whitelisted schemes
  if (!(Policy.isBlockableRequest(channel.URI, null, channel))) {
    console.log("Skipping heuristic blocker for", channel.URI.host);
    return true;
  }

  // Ignore anything that the user has made a decision on
  if ((channel.URI.host in storage.userYellow) ||
      (channel.URI.host in storage.userGreen)) {
    return true;
  }

  // Ignore things we've addded to blockedOrigins already
  let origin = utils.getBaseDomain(channel.URI);
  if (origin in storage.blockedOrigins) {
    return true;
  }

  // Debug
  if (channel.URI.host in storage.userRed) {
    console.log("WARNING: request should have been blocked", channel.URI.spec);
    return true;
  }

  return false;
};

/**
 * Returns useful information about this channel.
 *
 * {
 *   origin: "",       // The origin (eTLD+1) of this request
 *   parentOrigin: "", // If this origin is third-party, the parent's
 *                        (first-party) origin
 * }
 *
 * Returns null if the channel could not be introspected. This can happen for
 * requests that are not associated with a window (e.g. OCSP, Safe Browsing).
 */
let getChannelInfo = function(channel) {
  let win = utils.getTopWindowForChannel(channel);
  // Ignore requests that are outside a tabbed window
  if (win === null) return null;

  let info = {
    origin: null,
    parentOrigin: null
  };

  info.origin = utils.getBaseDomain(channel.URI);

  if (utils.isThirdPartyChannel(channel)) {
    try {
      // use win.document.URL, instead of win.location, because win.location
      // can be modified by scripts.
      info.parentOrigin = utils.getBaseDomain(newURI(win.document.URL));
    } catch (e) {
      console.log("error getting base domain from third party request " + channel.URI.spec);
      return null;
    }
  }

  return info;
};

/**
 * Determine if a third-party request appears to be tracking the user.
 * Also updates a data structure to keep track of which 3rd parties set
 * cookies on 1st parties (even if those cookies are deemed "low-entropy", and
 * don't appear to be tracking cookies).
 * @param {nsIHttpChannel} channel the request to examine for tracking behavior
 * @param {Object} channelInfo extracted metadata about the request
 * @return Boolean Whether this request appears to be tracking the user
 */
let hasTracking = function(channel, channelInfo) {
  let cookies = cookieUtils.getCookiesFromChannel(channel);
  if (!cookies) return false;

  let { origin, parentOrigin } = channelInfo;
  // Update "set-cookie" origin map.
  if (!(origin in storage.setCookieFrequency)) {
    // If we haven't seen this 3rd party before, create a new set for the 1st
    // party origins where it sets cookies.
    storage.setCookieFrequency[origin] = { };
  }
  //console.log("updating setCookieFrequency for "+origin+","+parentOrigin);
  storage.setCookieFrequency[origin][parentOrigin] = true;

  for (let name in cookies) {
    if (cookies.hasOwnProperty(name)) {
      let value = cookies[name];
      if (!(value.toLowerCase() in gLowEntropyCookieValues)) {
        return true;
      }
    }
  }

  if (Object.keys(cookies).length > 0) {
    console.log("All cookies for " + channel.URI.spec + " deemed low entropy...");
    console.log(cookies);
  }

  return false;
};

// TODO: EFF's Chrome extension appends an entry in an ABP blocklist. Doing
// something simple for now.
let blockOrigin = function(origin) {
  storage.blockedOrigins[origin] = true;
  // TODO: this is not enforced
};

let unblockOrigin = function(origin) {
  delete storage.blockedOrigins[origin];
};

/**
 * Update internal accounting data structures with this request.
 * Returns true if we updated the blocker's data structures.
 * @param {nsIChannel} channel the response to take into account
 * @return {Boolean} whether the heuristics were updated
 */
let updateHeuristics = function(channel) {
  if (ignoreRequest(channel)) return false;

  let channelInfo = getChannelInfo(channel);
  if (channelInfo === null) {
    // for whatever reason, we couldn't introspect this channel. Check the console.
    return false;
  }

  // These are the eTLD+1's of the request and the document (parent) that
  // triggered it.
  let { origin, parentOrigin } = channelInfo;

  // o.w. this is a third party request
  // If there are no tracking cookies or similar things, ignore
  if (!hasTracking(channel, channelInfo)) return false;

  // Record 3rd party request prevalence
  if (!(origin in storage.originFrequency)) {
    // If we haven't seen this 3rd party before, create a new set for the
    // 1st party origins where it's been seen.
    storage.originFrequency[origin] = {};
  }
  // This 3rd party tracked this 1st party
  storage.originFrequency[origin][parentOrigin] = true;
  //console.log(origin + " tracked " + parentOrigin);

  // How many 1st party origins has this 3rd party made requests from?
  let requestPrevalence = Object.keys(storage.originFrequency[origin]).length;
  if (requestPrevalence >= gPrevalenceThreshold) {
    console.log("adding " + origin + " to heuristic blocklist.");
    blockOrigin(origin);
  }

  return true;
};

exports.updateHeuristics = updateHeuristics;
