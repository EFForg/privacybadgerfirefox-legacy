"use strict";

const { Cc, Ci } = require("chrome");
const { newURI } = require('sdk/url/utils');
const { storage } = require("sdk/simple-storage");

const utils = require("./utils");

let { Policy } = require("./pbContentPolicy");
/*
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
stored.forEach(function(store) {
  if (!storage[store]) storage[store] = {};
});

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

/*
 * Determine if a request should not be considered in the blocker accounting
 * (e.g. it is an internal protocol)
 */
let ignoreRequest = function(channel) {
  // TODO: decide what else needs to go in this check
  return Policy.shouldIgnoreRequest(channel.URI)
}

/*
 * Returns useful information about this channel.
 *
 * {
 *   origin: "",       // The origin (eTLD+1) of this request
 *   party: "",        // first|third (in the context of its parents in the
 *                        window hierarchy)
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
  if (win == null) return null;

  let info = {
    origin: null,
    party: null,
    parentOrigin: null
  };

  info.origin = utils.getBaseDomain(channel.URI);

  try {
    if (utils.isThirdPartyChannel(channel)) {
      info.party = "third";
    } else {
      info.party = "first";
    }
  } catch (e) {
    // If this logic failed, we can't determine the party of the request
    console.log("isThirdPartyChannel threw exception for " + channel.URI.spec);
    return null;
  }

  if (info.party === "third") {
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
}

/**
 * Parse a cookie header (Set-Cookie or Cookie) into (key, value) pairs and
 * returns the parsed cookies in an object.
 * @param {string} header The contents of the header
 * @return {Object} map of cookie keys to values
 */
let parseCookieHeader = function(header) {
  let cookies = {};

  // Someties Set-Cookie headers use newlines instead of semicolons, although
  // they're not supposed to - replace them before parsing.
  header = header.replace(/\n/g, "; ");
  console.log(header);

  header.split("; ").forEach(function (cookie) {
    cookie = cookie.trim();
    let cut = cookie.indexOf("=");
    // If there's no '=', this is not a valid cookie-pair.
    if (cut == -1) {
      return;
    }
    let name = cookie.slice(0, cut);
    // We're only interested in cookie-pairs, not attributes.
    // http://tools.ietf.org/html/rfc6265#section-4.1.1
    let cookieAttrNames = ["expires", "max-age", "domain", "path",
                           "secure", "httponly"];
    if (cookieAttrNames.indexOf(name.toLowerCase()) > -1) {
      return;
    }
    let value = cookie.slice(cut+1);
    cookies[name] = value;
  });

  return cookies;
}

/**
 * Retrieve the cookies from a channel and parse them into an object.
 * Assumes that the channel is for a response (from an http-on-examine-response
 * observer), so it looks for the "Set-Cookie" header.
 * @param {nsIHttpChannel} channel the channel to retrieve cookies from
 * @returns an object containing the cookies indexed by key, or null if cookies
 *          could not be retrieved.
 */
let getCookiesFromChannel = function(channel) {
  let header;

  try {
    // We're examining a response, so the relevant header is Set-Cookie
    header = channel.getResponseHeader("Set-Cookie");
  } catch (e) {
    return null;
  }

  return parseCookieHeader(header);
}

let hasTracking = function(channel, channelInfo) {
  let cookies = getCookiesFromChannel(channel);
  if (!cookies) return false;

  // Update "set-cookie" origin map.
  let { origin, parentOrigin } = channelInfo;
  if (!(origin in storage.setCookieFrequency)) {
    // If we haven't seen this 3rd party before, create a new set for the 1st
    // party origins where it sets cookies.
    storage.setCookieFrequency[origin] = { };
  }
  storage.setCookieFrequency[origin][parentOrigin] = true;

  for (let name in cookies) {
    let value = cookies[name];
    if (!(value.toLowerCase() in gLowEntropyCookieValues)) {
      return true;
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
}

/*
 * Update internal accounting data structures with this request.
 * Returns true if we updated the blocker's data structures.
 */
let updateHeuristics = function(channel) {
  if (ignoreRequest(channel)) return false;

  let channelInfo = getChannelInfo(channel);
  if (channelInfo == null) {
    // for whatever reason, we couldn't introspect this channel. Check the console.
    return false;
  }

  let { origin, party, parentOrigin } = channelInfo;

  // Ignore first-party requests
  if (party == "first") return false;

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
  console.log(origin + " tracked " + parentOrigin);

  // How many 1st party origins has this 3rd party made requests from?
  let requestPrevalence = Object.keys(storage.originFrequency[origin]).length;
  if (requestPrevalence >= gPrevalenceThreshold) {
    console.log("Adding " + origin + " to heuristic blocklist.");
    blockOrigin(origin);
  }

  return true;
}

exports.updateHeuristics = updateHeuristics;
