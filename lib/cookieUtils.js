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
 */

let getCookiesFromChannel = function(channel) {};

let parseCookieHeader = function(header) {};


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
