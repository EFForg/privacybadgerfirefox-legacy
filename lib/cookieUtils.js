// Utils for working with cookies

"use strict";

const { Cc, Ci, Cu } = require("chrome");
const { storage } = require("sdk/simple-storage");
const ABPUtils = require("./abp/utils").Utils;

const cookiePermission = Cc["@mozilla.org/cookie/permission;1"]
                         .getService(Ci.nsICookiePermission);

const _DENY_THIRD_PARTY = Ci.nsICookiePermission.ACCESS_ALLOW_FIRST_PARTY_ONLY;
const _DENY = Ci.nsICookiePermission.ACCESS_DENY;
const _DEFAULT = Ci.nsICookiePermission.ACCESS_DEFAULT;

/**
 * Retrieve cookies from a channel and parse them into an object.
 * In theory this will find both HTTP and javascript cookies.
 *
 * @param {nsIHttpChannel} channel
 * @returns object containing cookies values indexed by name, or null if cookies
 *          could not be retrieved
 */

let cookieService = Cc["@mozilla.org/cookieService;1"]
                      .getService(Ci.nsICookieService);

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
 * Deny a host from getting/setting third party cookies. setAccess takes a URI
 * as input, but the permission applies to any URI with the same hostname
 * (independent of path/scheme/port). See nsCookieService.cpp.
 *
 * @param host {string}
 * @return {void}
 */

let clobberCookie = exports.clobberCookie = function(host) {
  // HTTP prefix doesn't matter but makeURI expects a valid string URI
  let location = ABPUtils.makeURI("http://"+host);
  console.log("Clobbering cookie", location.spec);
  // hack for tests until we figure out how to run a test http server in
  // a third party context
  if (host !== "localhost") {
    cookiePermission.setAccess(location, _DENY_THIRD_PARTY);
  } else {
    cookiePermission.setAccess(location, _DENY);
  }
};

/**
 * Un-deny a host from getting/setting third party cookies.
 * @param host {string}
 * @return {void}
 */

let unclobberCookie = exports.unclobberCookie = function(host) {
  let location = ABPUtils.makeURI("http://"+host);
  console.log("Unclobbering cookie", location.spec);
  cookiePermission.setAccess(location, _DEFAULT);
};

/**
 * Clear all cookies.
 */

let clearCookies = exports.clearCookies = function(location) {
  var cookieManager = Cc["@mozilla.org/cookiemanager;1"]
                        .getService(Ci.nsICookieManager);
  return cookieManager.removeAll();
};

/**
 * Get all cookies for a host.
 */
Cu.import("resource://gre/modules/Services.jsm");
let getCookiesFromHost = exports.getCookiesFromHost = function(host) {
  return Services.cookies.getCookiesFromHost(host);
}
