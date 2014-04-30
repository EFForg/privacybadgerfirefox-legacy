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

const cookiePrefsBranch = "network.cookie.";
const cookiePrefsTarget = PrefsTarget({ branchName: cookiePrefsBranch });
const cookieBehaviorPref = "cookieBehavior";

let checkCookiePrefs = function(prefName) {
  // Get new pref value
  let pref = prefsService.get(cookiePrefsBranch + prefName);
  //console.log("in checkCookiePrefs, prefName=" + prefName + ", pref=" + pref); // DEBUG
  switch(prefName) {
    case cookieBehaviorPref:
      let prefBlocksCookies = pref !== 0;
      pbPanel.port.emit("cookiePrefsChange", prefBlocksCookies);
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
}

function cleanupCookiePrefListener() {
  off(cookiePrefsTarget, "", checkCookiePrefs);
}

/*
 * Listeners for Privacy Badger's own pref changes.
 * Controls settings accessible via the PB panel.
 */

const prefs = require("sdk/simple-prefs");

// Activate/deactivate PB from the panel
function pbToggle() {
  if (prefs.prefs.pbEnabled) {
    main.enable();
    // Show a notification
    let nb = utils.getMostRecentWindow().gBrowser.getNotificationBox();
    nb.appendNotification("Privacy Badger activated!", "notify-id",
                          require("sdk/self").data.url("icons/badger-32.png"),
                          nb.PRIORITY_INFO_HIGH, [], function(event) {
                            if (event === "removed") {
                              utils.reloadCurrentTab();
                            }
                          });
  } else {
    main.disable();
  }
}
exports.initEnabled = function() {
  prefs.on("pbEnabled", pbToggle);
};
exports.cleanupEnabled = function() {
  prefs.removeListener("pbEnabled", pbToggle);
};


// To be used if we ever add an option to disable heuristic blocker
function heuristicToggle(clearStorage) {
  if (prefs.prefs.heuristicEnabled) {
    heuristicBlocker.init();
    userStorage.sync();
  } else if (clearStorage) {
    // user wants to disable the heuristic and pretend it never existed
    heuristicBlocker.clear();
    delete storage.preloads;
  }
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
