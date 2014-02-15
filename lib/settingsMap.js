/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const { on, once, off, emit } = require('sdk/event/core');

var settingsMap = exports.settingsMap = new WeakMap();

/* Register our event listener to update Settings. Events are emitted
 * in the form emit(target, type, msg, [nsIDOMWindow, origin]),
 * where origin is the cookie origin and nsIDOMWindow is the parent origin.
 */
on(settingsMap, "update-settings", updateSettingsListener);

/* Ways for settingsMap value to get updated for a domwin:
 *   third party cookie is set = noaction
 *   third party cookie on preloads list is heuristic-blacklisted: cookieblock
 *   third party cookie is heuristics-blacklisted = block
 *   user sets green on third party cookie = usernoaction
 *   user sets yellow on third party cookie = usercookieblock
 *   user sets red on third party cookie = userblock
 */

function updateSettingsListener(msg, aWin, aOrigin) {
  if (!aWin) {
    console.log("Can't update request without a window");
    return;
  } else if (!aOrigin) {
    console.log("Missing origin for cookie");
    return;
  }

  settingsMap.set(aWin, {aOrigin: msg});
  console.log("settingsMap: "+JSON.stringify(settingsMap));
}

/*
 * Used on location change. aWin is nsIDOMWindow
 */

on(settingsMap, "clear-settings", clearSettingsListener);

function clearSettingsListener(aWin) {
  settingsMap.delete(aWin);
}
