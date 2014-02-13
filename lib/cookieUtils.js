"use strict";

const { Cc, Ci } = require("chrome");
const { newURI } = require('sdk/url/utils');
const { storage } = require("sdk/simple-storage");
const utils = require("./utils");
const userStorage = require("./userStorage");

var cookiePermission = Cc["@mozilla.org/cookie/permission;1"]
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

let getCookiesFromChannel = exports.getCookiesFromChannel = function(channel) {
  let cookieService = Cc["@mozilla.org/cookieService;1"]
                        .getService(Ci.nsICookieService);
  try {
    let cookieString = cookieService.getCookieString(channel.URI, channel);
    return parseCookieString(cookieString);
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

let parseCookieString = function(string) {

  let cookies = {};

  // Someties Set-Cookie headers use newlines instead of semicolons, although
  // they're not supposed to - replace them before parsing.
  string = string.replace(/\n/g, "; ");

  string.split("; ").forEach(function (cookie) {
    cookie = cookie.trim();
    let cut = cookie.indexOf("=");
    // If there's no '=', this is not a valid cookie-pair.
    if (cut == -1) {
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
 * Deny a host from getting/setting third party cookies.
 * @param location {nsIURI}
 * @return {void}
 */

let clobberCookie = exports.clobberCookie = function(location) {
  cookiePermission.setAccess(location, _DENY_THIRD_PARTY);
};

/**
 * Un-deny a host from getting/setting third party cookies.
 * @param location {nsIURI}
 * @return {void}
 */

let unclobberCookie = exports.unclobberCookie = function(location) {
  cookiePermission.setAccess(location, _DEFAULT);
};
