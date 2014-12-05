// Keeps track of heuristics for blocking domains

"use strict";

const { Cc, Ci } = require("chrome");
const { newURI } = require('sdk/url/utils');
const { storage } = require("sdk/simple-storage");
const utils = require("./utils");
const cookieUtils  = require("./cookieUtils");
const { on, once, off, emit } = require('sdk/event/core');
const { settingsMap } = require("./ui");
const {
  checkPrivacyPolicy,
  whitelistHostFromPrivacyPolicy
} = require("./policyCheck");
const { doDependingOnIsPrivate } = require("./privateBrowsing");

/**
 * originFrequency: A map of third party domains to the set of first party
 * domains where they have been observed making requests.
 *
 * blockedOrigins: The set of domains that are blocked from making third party
 * requests due to the heuristic.
 */
const stored = [ "originFrequency",
                 "originFrequencyPrivate",
                 "blockedOrigins" ];

// Initialize/cleanup persistent storage
exports.init = function () {
  stored.forEach(function(store) {
    if (!storage[store]) { storage[store] = {}; }
  });
};
exports.clear = function () {
  // reset cookies for all in blockedOrigins because they may have been
  // clobbered
  for (let host in storage.blockedOrigins) {
    if (storage.blockedOrigins.hasOwnProperty(host)) {
      cookieUtils.resetCookie(host);
    }
  }
  stored.forEach(function(store) {
    delete storage[store];
  });
};
exports.empty = function () {
  for (let host in storage.blockedOrigins) {
    if (storage.blockedOrigins.hasOwnProperty(host)) {
      cookieUtils.resetCookie(host);
    }
  }
  stored.forEach(function(store) {
    storage[store] = {};
  });
};

// Threshold of 1st party origins tracked by a 3rd party to trigger blocking
const gPrevalenceThreshold = 3;

 // The maximum amount of information for all cookies for a given domain, in bits
const gMaxCookieEntropy = 8;

// This maps cookies to a rough estimate of how many bits of 
// identifying info we might be letting past by allowing them.
// We need something better than this eventually!
// map to lower case before using
const gLowEntropyCookieValues = {
  "":3,
  "nodata":3,
  "no_data":3,
  "yes":3,
  "no":3,
  "true":3,
  "false":3,
  "opt-out":3,
  "optout":3,
  "opt_out":3,
  "0":4,
  "1":4,
  "2":4,
  "3":4,
  "4":4,
  "5":4,
  "6":4,
  "7":4,
  "8":4,
  "9":4,
  // ISO 639-1 language codes
  "aa":8,
  "ab":8,
  "ae":8,
  "af":8,
  "ak":8,
  "am":8,
  "an":8,
  "ar":8,
  "as":8,
  "av":8,
  "ay":8,
  "az":8,
  "ba":8,
  "be":8,
  "bg":8,
  "bh":8,
  "bi":8,
  "bm":8,
  "bn":8,
  "bo":8,
  "br":8,
  "bs":8,
  "by":8,
  "ca":8,
  "ce":8,
  "ch":8,
  "co":8,
  "cr":8,
  "cs":8,
  "cu":8,
  "cv":8,
  "cy":8,
  "da":8,
  "de":8,
  "dv":8,
  "dz":8,
  "ee":8,
  "el":8,
  "en":8,
  "eo":8,
  "es":8,
  "et":8,
  "eu":8,
  "fa":8,
  "ff":8,
  "fi":8,
  "fj":8,
  "fo":8,
  "fr":8,
  "fy":8,
  "ga":8,
  "gd":8,
  "gl":8,
  "gn":8,
  "gu":8,
  "gv":8,
  "ha":8,
  "he":8,
  "hi":8,
  "ho":8,
  "hr":8,
  "ht":8,
  "hu":8,
  "hy":8,
  "hz":8,
  "ia":8,
  "id":8,
  "ie":8,
  "ig":8,
  "ii":8,
  "ik":8,
  "in":8,
  "io":8,
  "is":8,
  "it":8,
  "iu":8,
  "ja":8,
  "jv":8,
  "ka":8,
  "kg":8,
  "ki":8,
  "kj":8,
  "kk":8,
  "kl":8,
  "km":8,
  "kn":8,
  "ko":8,
  "kr":8,
  "ks":8,
  "ku":8,
  "kv":8,
  "kw":8,
  "ky":8,
  "la":8,
  "lb":8,
  "lg":8,
  "li":8,
  "ln":8,
  "lo":8,
  "lt":8,
  "lu":8,
  "lv":8,
  "mg":8,
  "mh":8,
  "mi":8,
  "mk":8,
  "ml":8,
  "mn":8,
  "mr":8,
  "ms":8,
  "mt":8,
  "my":8,
  "na":8,
  "nb":8,
  "nd":8,
  "ne":8,
  "ng":8,
  "nl":8,
  "nn":8,
  "nr":8,
  "nv":8,
  "ny":8,
  "oc":8,
  "of":8,
  "oj":8,
  "om":8,
  "or":8,
  "os":8,
  "pa":8,
  "pi":8,
  "pl":8,
  "ps":8,
  "pt":8,
  "qu":8,
  "rm":8,
  "rn":8,
  "ro":8,
  "ru":8,
  "rw":8,
  "sa":8,
  "sc":8,
  "sd":8,
  "se":8,
  "sg":8,
  "si":8,
  "sk":8,
  "sl":8,
  "sm":8,
  "sn":8,
  "so":8,
  "sq":8,
  "sr":8,
  "ss":8,
  "st":8,
  "su":8,
  "sv":8,
  "sw":8,
  "ta":8,
  "te":8,
  "tg":8,
  "th":8,
  "ti":8,
  "tk":8,
  "tl":8,
  "tn":8,
  "to":8,
  "tr":8,
  "ts":8,
  "tt":8,
  "tw":8,
  "ty":8,
  "ug":8,
  "uk":8,
  "ur":8,
  "uz":8,
  "ve":8,
  "vi":8,
  "vo":8,
  "wa":8,
  "wo":8,
  "xh":8,
  "yi":8,
  "yo":8,
  "za":8,
  "zh":8,
  "zu":8
};


/**
 * Returns useful information about this channel.
 *
 * {
 *   origin: "",       // The origin (base domain) of this request
 *   parentOrigin: "", // If this origin is third-party, the parent's
 *                        (first-party) base domain
 * }
 *
 * Returns null if the channel could not be introspected. This can happen for
 * requests that are not associated with a window (e.g. OCSP, Safe Browsing).
 */
let getChannelInfo = function(channel, win) {

  let info = {
    origin: null,
    parentOrigin: null
  };

  // Get the base domain of the host because of cookie scoping rules
  info.origin = utils.getBaseDomain(channel.URI);

  // Use the referrer for windowless requests that have one
  if (win === null) {
    try {
      info.parentOrigin = utils.getBaseDomain(channel.referrer);
    } catch(e) {
      return null;
    }
    return info;
  }

  try {
    // use win.document.URL, instead of win.location, because win.location
    // can be modified by scripts.
    info.parentOrigin = utils.getBaseDomain(newURI(win.document.URL));
  } catch (e) {
    console.log("error getting base domain from third party request " + channel.URI.spec);
    return null;
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
let hasTracking = function(channel, channelInfo, cookies) {

  if (!cookies || Object.getOwnPropertyNames(cookies).length < 1) {
    return false;
  }

  let { origin, parentOrigin } = channelInfo;
  let entropyForOrigin = 0;

  for (let name in cookies) {
    if (cookies.hasOwnProperty(name)) {
      let value = cookies[name];
      if (!(value.toLowerCase() in gLowEntropyCookieValues)) {
        return true;
      } else {
        entropyForOrigin += gLowEntropyCookieValues[value.toLowerCase()];
        if (entropyForOrigin > gMaxCookieEntropy) {
          return true;
        }
      }
    }
  }

  console.log("All cookies for " + origin + " deemed low entropy...");
  console.log(cookies);

  //return hasSneakyTracking(channel);
  return false;
};

/**
 * Determine if a third-party may be tracking a user by setting and reading
 * its cookies either using javascript or through an unblocked subdomain.
 * Mostly just here as a test harness, may be used in future releases.
 * @param {nsIHttpChannel} channel the request to examine for tracking behavior
 * @return Boolean Whether this request appears to be sneaky-tracking the user
 */
let cookieAccessTimes = {};
let hasSneakyTracking = function(channel) {
  let host = channel.URI.host;
  // getCookiesFromHost returns enumerator of nsICookie2's. ex: for
  // live.bbc.co.uk, return cookies for live.bbc.co.uk and bbc.co.uk but not
  // www.bbc.co.uk
  let cookies = cookieUtils.getCookiesFromHost(host);
  let cookieTimes = [];
  while (cookies.hasMoreElements()) {
    let cookie = cookies.getNext().QueryInterface(Ci.nsICookie2);
    cookieTimes.push(cookie.lastAccessed);
  }
  if (cookieTimes.length === 0) { return false; }
  // Get most recent cookie access by the host
  let maxCookieTime = Math.max.apply(Math, cookieTimes);
  console.log("MAXCOOKIETIME", cookieTimes, host);
  // Consider the host to be tracking if any of its cookies has been accessed
  // since the last time we checked
  let hasTracking = cookieAccessTimes[host] ?
                    (maxCookieTime > cookieAccessTimes[host]) :
                    false;
  if (hasTracking) {
    console.log("FOUND sneaky tracker", channel.URI.spec);
  }
  cookieAccessTimes[host] = maxCookieTime;
  return hasTracking;
};

let blockOrigin = function(origin, host) {
  // Block the eTLD+1. If the host is the same as eTLD+1, then this
  // gets unblocked when checkPrivacyPolicy returns.
  storage.blockedOrigins[origin] = true;
  // Check if the host associated with the third-party request has posted an
  // approved DNT policy. If so, whitelist the host and remove it from
  // blockedOrigins if it's an eTLD+1.
  if (!host) {
    // Host may be undefined for weird URLs like localhost
    console.log("Missing host");
    return;
  }
  checkPrivacyPolicy(host, function(success) {
    if (success) {
      whitelistHostFromPrivacyPolicy(host);
    }
  });
};

let unblockOrigin = function(origin) {
  cookieUtils.resetCookie(origin);
  delete storage.blockedOrigins[origin];
};

/**
 * Update internal accounting data structures with this request.
 * Returns true if we updated the blocker's data structures.
 * @param {nsIHTTPChannel} channel the response to take into account
 * @param {nsIDOMWindow} win window associated with the channel
 * @param {Boolean} isResponse whether the channel was obtained from http-on-examine-response
 * @return {Boolean} whether the heuristics were updated
 */
let updateHeuristicsForChannel = function(channel, win, isResponse) {
  let channelInfo = getChannelInfo(channel, win);
  if (channelInfo === null) {
    // for whatever reason, we couldn't introspect this channel. Check the console.
    return false;
  }

  // These are the host names of the request and the document (parent) that
  // triggered it.
  let { origin, parentOrigin } = channelInfo;

  // Ignore things that have already been heuristic-blocked
  if (origin in storage.blockedOrigins) { return false; }

  // o.w. this is a third party request
  // If there are no tracking cookies or similar things, ignore
  let channelCookies;
  if (!isResponse) {
    channelCookies = cookieUtils.getCookiesFromChannel(channel);
  } else {
    channelCookies = cookieUtils.getCookiesFromResponseChannel(channel);
  }
  if (!hasTracking(channel, channelInfo, channelCookies)) { return false; }

  // Found a third party tracker; show it in the UI
  if (!channel.URI || !channel.URI.host) {
    return false;
  }

  let action;
  if (!isResponse) {
    // If we see cookies sent in http-on-modify-request, conclude that
    // the host is allowed to access cookies. Therefore it should be green.
    action = "noaction";
  } else {
    // If we're examining a response, we can't directly see whether the request
    // contained cookies. So we use the cookie db permissions for the domain to
    // infer whether the domain should show up as green or yellow in the UI.
    if (cookieUtils.canAccessCookies(channel.URI, channel)) {
      action = "noaction";
    } else {
      action = "cookieblock";
    }
  }

  // Update the UI
  emit(settingsMap, "update-settings", action, win, channel.URI.host);

  // Record 3rd party request prevalence separately for private and non-private
  // sessions because first party origins are sensitive.
  doDependingOnIsPrivate("originFrequency", function (store) {
    if (!(origin in store)) {
      store[origin] = {};
    }
    store[origin][parentOrigin] = true;
  }, win);

  // How many 1st party origins has this 3rd party made requests from?
  let requestPrevalence = storage.originFrequency[origin] ?
                          Object.keys(storage.originFrequency[origin]).length :
                          0;
  let requestPrevalencePrivate = storage.originFrequencyPrivate[origin] ?
                                 Object.keys(storage.originFrequencyPrivate[origin]).length :
                                 0;

  if ((requestPrevalence + requestPrevalencePrivate) >= gPrevalenceThreshold) {
    console.log("adding " + origin + " to heuristic blocklist.");
    blockOrigin(origin, channel.URI.host);
  }

  return true;
};

/**
 * Logs when a cookie object is added or modified.
 * May be called in an onCookieChanged listener for debugging.
 * @param {nsICookie2} cookie
 * @param {String} keyword the event keyword (subject.data)
 * @return {Boolean} whether heuristics werer updated
 */
let logCookieChanges = function(cookie, keyword) {
  if (!(cookie instanceof Ci.nsICookie2)) {
    console.log("Not an nsICookie2 object");
    return false;
  }

  // Update the heuristic blocker if third-party
  if (keyword === "added") {
    //console.log("Added cookie", cookie.rawHost, cookie.name);
    return true;
  }

  // TODO: Do we need to update accounting if a cookie changes?
  if (keyword === "changed") {
    //console.log("Changed cookie", cookie.rawHost, cookie.name);
    return false;
  }

  // On gmail login, PB detects gmail.com setting and deleting a cookie named
  // jscookietest. Means that we're successfully detecting js cookies events?
  // TODO: Do we need to update accounting if a cookie is deleted?
  if (keyword === "deleted") {
    console.log("Deleted cookie", cookie.rawHost, cookie.name);
    return false;
  }

  return false;
};

exports.updateHeuristicsForChannel = updateHeuristicsForChannel;
exports.logCookieChanges = logCookieChanges;
exports.hasTracking = hasTracking;
exports.blockOrigin = blockOrigin;
exports.unblockOrigin = unblockOrigin;
