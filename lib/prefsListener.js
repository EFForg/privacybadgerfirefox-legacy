/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const { on, off } = require('sdk/event/core');
const prefsService = require("sdk/preferences/service");
const { PrefsTarget } = require("sdk/preferences/event-target");
const { pbPanel } = require("./ui");
const main = require("./main");
const utils = require("./utils");
const heuristicBlocker = require("./heuristicBlocker");
const userStorage = require("./userStorage");
const events = require("sdk/system/events");

/*
 * Listen for pref changes that would affect the operation of Privacy Badger.
 * At the moment, relevant prefs are:
 *
 *   * network.cookie.cookieBehavior
 *     * 0 = enable all cookies (default)
 *     * 1 = reject all third party cookies
 *     * 2 = disable all cookies
 *     * 3 = reject third party cookies unless at least one is already set for the eTLD
 *   * network.cookie.lifetimePolicy
 *     * 0 = keep until they expire (default)
 *     * 1 = ask every time
 *     * 2 = until I close Firefox
 *     * 3 = cookie lasts for number of days specified by network.cookie.lifetime.days
 *
 */

const cookiePrefsBranch = "network.cookie.";
const cookiePrefsTarget = PrefsTarget({ branchName: cookiePrefsBranch });
const cookieBehaviorPref = "cookieBehavior";
const cookieLifetimePref = "lifetimePolicy";

let prefBlocksCookies;
let prefDeletesCookies;

let checkCookiePrefs = function(prefName) {
  // Get new pref value
  let pref = prefsService.get(cookiePrefsBranch + prefName);
  //console.log("in checkCookiePrefs, prefName=" + prefName + ", pref=" + pref); // DEBUG
  switch(prefName) {
    case cookieBehaviorPref:
      prefBlocksCookies = pref !== 0;
      if (prefBlocksCookies) {
        events.on("http-on-examine-response", main.onExamineResponse, false);
      } else {
        events.off("http-on-examine-response", main.onExamineResponse, false);
      }
      break;
    case cookieLifetimePref:
      prefDeletesCookies = pref === 2;
      if (pref === 1 || pref === 3) {
        pbPanel.port.emit("cookiePrefsChange", true);
      } else {
        pbPanel.port.emit("cookiePrefsChange", false);
      }
      if (prefDeletesCookies) {
        // For some reason, when PB clobbers/allows a cookie, it creates an
        // exception for the default lifetimePolicy. Assume user wants us
        // to delete these cookies when browser is closed.
        // TODO: Do something similarly appropriate if pref is 1 or 3
        events.on("quit-application-granted", main.deletePbCookies, false);
      } else {
        events.off("quit-application-granted", main.deletePbCookies, false);
      }
      break;
  }
};

function initCookiePrefListener() {
  // Register listener for pref changes while running
  //
  // "" tells the EventTarget to respond to all changes on the cookie prefs
  // branch. This could be useful if we want to monitor other cookie-related
  // prefs in the future.
  on(cookiePrefsTarget, "", checkCookiePrefs);
  // Do initial check for pref value at startup
  checkCookiePrefs(cookieBehaviorPref);
  checkCookiePrefs(cookieLifetimePref);
}

function cleanupCookiePrefListener() {
  off(cookiePrefsTarget, "", checkCookiePrefs);
  events.off("http-on-examine-response", main.onExamineResponse, false);
  events.off("quit-application-granted", main.deletePbCookies, false);
}

/*
 * Listeners for Privacy Badger's own pref changes.
 * Controls settings accessible via the PB panel.
 */

const prefs = require("sdk/simple-prefs");

// To be used if we ever add an option to disable heuristic blocker
function heuristicToggle() {
  if (prefs.prefs.heuristicEnabled) {
    heuristicBlocker.init();
    userStorage.init();
    userStorage.sync();
    return;
  }
  let nb = utils.getMostRecentWindow().gBrowser.getNotificationBox();
  nb.appendNotification("WARNING: This feature is not fully supported yet and will probably cause unexpected behavior!",
                        "notify-id", require("sdk/self").data.url("icons/badger-32.png"),
                         nb.PRIORITY_CRITICAL_HIGH);

}
let initHeuristicEnabledPrefListener = function() {
  prefs.on("heuristicEnabled", heuristicToggle);
};
let cleanupHeuristicEnabledPrefListener = function() {
  prefs.removeListener("heuristicEnabled", heuristicToggle);
};

// Events to be fired on global enable/disable from within main
exports.init = function() {
  initCookiePrefListener();
  initHeuristicEnabledPrefListener();
};
exports.cleanup = function() {
  cleanupCookiePrefListener();
  cleanupHeuristicEnabledPrefListener();
};
