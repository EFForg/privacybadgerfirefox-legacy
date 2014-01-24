"use strict";

const { Cc, Ci } = require("chrome");
const { newURI } = require('sdk/url/utils');
const { storage } = require("sdk/simple-storage");

const utils = require("utils.js");

// Initialize persistent storage
const stored = [ "httpRequestOriginFrequency",
                 "setCookieOriginFrequency",
                 "blockedOrigins" ];

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
let ignoreRequest = function(request) {
  // TODO: decide what to ignore here (about://, chrome://, etc.)
  return false;
}

/*
 * Returns useful information about this channel.
 *
 * {
 *   origin: "",       // The domain (eTLD+1) of this request
 *   party: "",        // first|third (in the context of its parents in the
 *                        window hierarchy)
 *   parentOrigin: "", // If this domain is third-party, the parent's
 *                        (first-party) domain
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

let getCookieHeader = function(channel) {
  try {
    // We're examining a response, so the relevant header is Set-Cookie
    return channel.getResponseHeader("Set-Cookie");
  } catch (e) {
    //console.log("No Set-Cookie on request for " + channel.URI.spec);
    return null;
  }
}

let parseCookieHeader = function(header) {
  let cookies = {};
  header.split(";").forEach(function (cookie) {
    cookie = cookie.trim();
    let cut = cookie.indexOf("=");
    let name = cookie.slice(0, cut);
    let value = cookie.slice(cut+1);
    cookies[name] = value;
  });
  return cookies;
}

let hasTracking = function(channel, channelInfo) {
  let cookieHeader = getCookieHeader(channel);
  if (!cookieHeader) return null;

  // Update "set-cookie" origin map
  let { origin, parentOrigin } = channelInfo.origin;
  if (!(origin in storage.setCookieOriginFrequency)) {
    storage.setCookieOriginFrequency[origin] = { };
  }
  storage.setCookieOriginFrequency[origin][parentOrigin] = true;

  let cookies = parseCookieHeader(cookieHeader);
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

  // Record HTTP request prevalence
  if (!(origin in storage.httpRequestOriginFrequency)) {
    storage.httpRequestOriginFrequency[origin] = {};
  }
  // This 3rd party tracked this 1st party
  storage.httpRequestOriginFrequency[origin][parentOrigin] = true;
  console.log(origin + " tracked " + parentOrigin);

  let httpRequestPrevalence =
    Object.keys(storage.httpRequestOriginFrequency[origin]).length;
  if (httpRequestPrevalence >= gPrevalenceThreshold) {
    console.log("Adding " + origin + " to heuristic blocklist.");
    blockOrigin(origin);
  }

  return true;
}

exports.updateHeuristics = updateHeuristics;
