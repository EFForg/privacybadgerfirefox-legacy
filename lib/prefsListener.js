/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

var { on, off } = require('sdk/event/core');
const prefsService = require("sdk/preferences/service");
const { PrefsTarget } = require("sdk/preferences/event-target");

/*
 * Listen for pref changes that would affect the operation of Privacy Badger.
 * At the moment, relevant prefs are:
 *
 *   * network.cookie.cookieBehavior
 *     * 0 = enable all cookies
 *     * 1 = reject all third party cookies
 *     * 2 = disable all cookies
 *     * 3 = reject third party cookies unless at least one is already set for the eTLD
 *
 */

let prefBlocksCookies = false;

const cookiePrefsBranch = "network.cookie."
const cookiePrefsTarget = PrefsTarget({ branchName: cookiePrefsBranch });
const cookieBehaviorPref = "cookieBehavior";

let checkCookiePrefs = function(prefName) {
  // Get new pref value
  let pref = prefsService.get(cookiePrefsBranch + prefName);
  //console.log("in checkCookiePrefs, prefName=" + prefName + ", pref=" + pref); // DEBUG
  switch(prefName) {
    case cookieBehaviorPref:
      prefBlocksCookies = pref != 0;
      break;
  }
}

function initCookiePrefListener() {
  // Register listener for pref changes while running
  //
  // "" tells the EventTarget to respond to all changes on the cookie prefs
  // branch. This could be useful if we want to monitor other cookie-related
  // prefs in the future.
  on(cookiePrefsTarget, "", checkCookiePrefs);
  // Do initial check for pref value at startup
  checkCookiePrefs(cookieBehaviorPref);
}

function cleanupCookiePrefListener() {
  off(cookiePrefsTarget, "", checkCookiePrefs);
}

exports.prefBlocksCookies = function() { return prefBlocksCookies };
exports.init = initCookiePrefListener;
exports.cleanup = cleanupCookiePrefListener;
