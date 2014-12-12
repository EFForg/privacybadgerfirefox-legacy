// Utils for working with cookies

"use strict";

const { Cc, Ci, Cu } = require("chrome");
const { storage } = require("sdk/simple-storage");
const ABPUtils = require("./abp/utils").Utils;
const utils = require("./utils");
const prefsService = require("sdk/preferences/service");
const cookiePermission = Cc["@mozilla.org/cookie/permission;1"]
                         .getService(Ci.nsICookiePermission);
const _DENY_THIRD_PARTY = Ci.nsICookiePermission.ACCESS_ALLOW_FIRST_PARTY_ONLY;
const _DENY = Ci.nsICookiePermission.ACCESS_DENY;
const _DEFAULT = Ci.nsICookiePermission.ACCESS_DEFAULT;
const _ALLOW = Ci.nsICookiePermission.ACCESS_ALLOW;

Cu.import("resource://gre/modules/Services.jsm");
let cookieService = Cc["@mozilla.org/cookieService;1"]
                      .getService(Ci.nsICookieService);
let cookieManager = Cc["@mozilla.org/cookiemanager;1"]
                      .getService(Ci.nsICookieManager);

/**
 * Retrieve cookies from a channel and parse them into an object.
 * In theory this will find both HTTP and javascript cookies.
 * @param {nsIHttpChannel} channel
 * @return {Object} cookie name-value pairs, null if cookies could not be retrieved
 */
let getCookiesFromChannel = exports.getCookiesFromChannel = function(channel) {
  try {
    let cookieString = cookieService.getCookieString(channel.URI, channel);
    return parseCookieString(cookieString);
  } catch (e) {
    return null;
  }
};
let getCookiesFromResponseChannel = exports.getCookiesFromResponseChannel = function(channel) {
  try {
    let cookieString = channel.getResponseHeader("Set-Cookie");
    return cookieString ? parseCookieString(cookieString) : null;
  } catch (e) {
    return null;
  }
};

/**
 * Take a cookie string and turn it into name/value pairs.
 * It seems weird that we have to roll our own cookie parser; is there a way
 * to access FF's internal cookie parser?
 *
 * nsICookieManager gets us access to the nsICookie objects, but then we'd have
 * to iterate over all the stored cookies. :(
 * @param {String} string from set-cookie or cookie headers
 * @return {Object} cookie name-value pairs (ignoring attributes)
 */
let parseCookieString = exports.parseCookieString = function(string) {

  let cookies = {};

  // Someties Set-Cookie headers use newlines instead of semicolons, although
  // they're not supposed to - replace them before parsing.
  string = string.replace(/\n/g, "; ");

  string.split("; ").forEach(function (cookie) {
    cookie = cookie.trim();
    let cut = cookie.indexOf("=");
    // If there's no '=', this is not a valid cookie-pair.
    if (cut === -1) {
      console.log("Got invalid cookie: "+cookie);
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
};

/**
 * Converts nsICookie2 or nsISimpleEnumerator of nsICookie2's to string form,
 * suitable for inserting as an HTTP header. isResponseChannel is true if creating
 * a set-cookie header.
 * @param {nsICookie2 or nsISimpleEnumerator} cookies
 * @param {Boolean} isResponseChannel
 * @param {Boolean} isSecureChannel
 * @return {String}
 */
let toString = exports.toString = function(cookies, isResponseChannel, isSecureChannel) {
  let cookieToString = function(cookie) {
    let attributes = {
      host: "domain",
      path: "path",
      expiry: "expires",
      isHttpOnly: "httponly",
      isSecure: "secure",
    };
    let c = [[cookie.name, cookie.value].join("=")];
    // If returning cookies for a "Cookie" header, only need the name and value
    if (!isResponseChannel) {
      // Only return secure cookies if the channel is SSL
      if (!cookie.isSecure || isSecureChannel) {
        return c;
      }
      return '';
    }
    // Parse cookie attributes into string if returning cookies for "Set-Cookie"
    for (let a in attributes) {
      let attributeName = attributes[a];
      let attributeValue = cookie[a];
      switch (typeof(attributeValue)) {
        case "string":
          if (attributeValue) {
            c.push([attributeName, attributeValue].join("="));
          }
          break;
        case "boolean":
          if (attributeValue) { c.push(attributeName); }
          break;
        case "number":
          if (!cookie.isSession) {
            let date = new Date(attributeValue * 1000).toUTCString();
            c.push([attributeName, date].join("="));
          }
      }
    }
    return c.join("; ");
  };
  if (cookies instanceof Ci.nsICookie2) {
    console.log("cookieUtils.toString got single cookie")
    return cookieToString(cookies);
  }
  if (!(cookies instanceof Ci.nsISimpleEnumerator)) {
    console.error("Invalid input to cookieUtils.toString");
    return '';
  }
  let cookieStringArray = [];
  while (cookies.hasMoreElements()) {
    let nextCookie = cookies.getNext().QueryInterface(Ci.nsICookie2);
    let cookieString = cookieToString(nextCookie);
    if (cookieString) { cookieStringArray.push(cookieString); }
  }
  return cookieStringArray.join("; ");
};

/**
 * Deny a host from getting/setting third party cookies. setAccess takes a URI
 * as input, but the permission applies to any URI with the same hostname
 * (independent of path/scheme/port). See nsCookieService.cpp.
 * @param {String} host
 * @return {void}
 */
let clobberCookie = exports.clobberCookie = function(host) {
  // HTTP prefix doesn't matter but makeURI expects a valid string URI
  let location = ABPUtils.makeURI("http://"+host);
  console.log("Clobbering cookie", location.spec);
  // XXX: Hack to trick our tests into thinking that the local HTTP test server
  // is third-party.
  if (host === "localhost") {
    cookiePermission.setAccess(location, _DENY);
  } else {
    cookiePermission.setAccess(location, _DENY_THIRD_PARTY);
  }
  storage.changedCookies[host] = true;
};

/**
 * Restore cookie setting for a host to default.
 * @param {String} host
 * @return {void}
 */
let resetCookie = exports.resetCookie = function(host) {
  let location = ABPUtils.makeURI("http://"+host);
  console.log("Resetting cookie", location.spec);
  cookiePermission.setAccess(location, _DEFAULT);
  if(storage.changedCookies && storage.changedCookies[host]){
    delete storage.changedCookies[host];
  }
};

/**
 * Restore all cookie settings to default.
 * @return {void}
 */
let resetAll = exports.resetAll = function() {
  for (let host in storage.changedCookies) {
    if (storage.changedCookies.hasOwnProperty(host)) {
      resetCookie(host);
    }
  }
};

/**
 * Explicitly allow a host to access cookies.
 * @param {String} host
 * @return {void}
 */
let allowCookie = exports.allowCookie = function(host) {
  let location = ABPUtils.makeURI("http://"+host);
  console.log("Allowing cookie", location.spec);
  cookiePermission.setAccess(location, _ALLOW);
  storage.changedCookies[host] = true;
};

/**
 * Clear all cookies.
 * @return {void}
 */
let clearCookies = exports.clearCookies = function() {
  return cookieManager.removeAll();
};

/**
 * Get all cookies for a host as a nsISimpleEnumerator of nsICookie2's.
 * @param {String} host
 * @return {nsISimpleEnumerator}
 */
let getCookiesFromHost = exports.getCookiesFromHost = function(host) {
  return Services.cookies.getCookiesFromHost(host);
};

/**
 * Clear all cookies for a host.
 * @param {String} host
 * @return {void}
 */
let clearCookiesForHost = exports.clearCookiesForHost = function(host) {
  let cookies = getCookiesFromHost(host);
  while (cookies.hasMoreElements()) {
    let cookie = cookies.getNext().QueryInterface(Ci.nsICookie2);
    console.log("Deleting cookie for host", cookie.host, cookie.name);
    cookieManager.remove(cookie.host, cookie.name, cookie.path, false);
  }
};

/**
 * Check whether a domain can access cookies in the current context.
 * Depends on user's Firefox cookie settings.
 * @param {nsIURI} location
 * @param {nsIChannel} channel (assumes third party if null)
 * @return {Boolean}
 */
let canAccessCookies = exports.canAccessCookies = function(location, channel) {
  if (channel === null) {
    let pref = _getCookieBehavior();
    if (pref === 0) {
      return true;
    }
    if (pref === 1 || pref === 2) {
      return false;
    }
    // Otherwise, behavior is to reject unless a cookie has already been set
    let cookies = getCookiesFromHost(location.host);
    while (cookies.hasMoreElements()) { return true; }
    return false;
  }
  let access = cookiePermission.canAccess(location, channel);
  switch (access) {
    case _ALLOW:
      return true;
    case _DENY:
      return false;
    case _DENY_THIRD_PARTY:
      return (!utils.isThirdPartyChannel(channel));
    case _DEFAULT:
      let pref = _getCookieBehavior();
      // 0 = allow all, 1 = reject 3p, 2 = reject all, 3 = reject 3p unless already set
      if (pref === 2) {
        return false;
      }
      if (pref === 0) {
        return true;
      }
      if (utils.isThirdPartyChannel(channel)) {
        if (pref === 1) {
          return false;
        }
        if (pref === 3) {
          // if user has cookies for this host from a previous channel, allow
          let cookies = getCookiesFromHost(location.host);
          while (cookies.hasMoreElements()) {
            return true;
          }
          return false;
        }
      }
      // Is a first-party channel and cookieBehavior is not 2
      return true;
  }
};
let _getCookieBehavior = function() {
  return prefsService.get("network.cookie.cookieBehavior");
};

/**
 * Retrieves hosts that user has allowed to set persistent cookies
 * @return {Object} dictionary keyed by host name
 */
let getUserPersistentCookies = exports.getUserPersistentCookies = function() {
  let persistentCookies = {};
  let pref = prefsService.get("network.cookie.lifetimePolicy");

  // If user hasn't set default to be session cookies, return empty object.
  if (pref === 0) { return persistentCookies; }

  // This is a hack for now: we assume that if a cookie is in changedCookies
  // because it's manually set to green, the user wants it to be persistent.
  return storage.userGreen;
}
