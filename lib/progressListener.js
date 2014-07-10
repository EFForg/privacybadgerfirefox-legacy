/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const { Class } = require("sdk/core/heritage");
const { Cc, Ci } = require("chrome");
const { Unknown } = require("sdk/platform/xpcom");
const socialWidgetHandler = require("./socialWidgetHandler");
const pbUI = require("./ui");
const utils = require("./utils");

/**
 * Fires when window location changes.
 * @param {nsIDOMWindow} win
 */
let onLocationChange = function(win) {
  socialWidgetHandler.clearTemporaryUnblocksByWin(win);
  pbUI.clearSettingsMap(win);
};

/**
 * nsIWebProgressListener implementation in order to track which cookies
 * were blocked for each DOM window. Resets settingsMap in ui and tempUnblockMap
 * in socialWidgetHandler on location change.
 */
let PBListener = Class({

  extends: Unknown,

  interfaces: [ 'nsIWebProgressListener', 'nsISupportsWeakReference' ],

  onLocationChange: function(aBrowser, aProgress, aRequest, aURI, aFlags) {
    // Reset the applicable list for every window location change that is
    // a document change (rather than an anchor, etc.)
    if (!aFlags ||
        !(aFlags & Ci.nsIWebProgressListener.LOCATION_CHANGE_SAME_DOCUMENT)) {
      console.log('GOT LOCATION CHANGE: '+aURI.spec);
      let win = aProgress.DOMWindow;
      onLocationChange(win);
    }
  },

  initialize: function(aBrowser) { aBrowser.addTabsProgressListener(this); },

  uninitialize: function(aBrowser) { aBrowser.removeTabsProgressListener(this); }

});

// Initialize per-XUL-window listeners whenever a XUL window is opened
exports.onWindowOpen = function(event) {
  console.log("Got new window");
  let browser = utils.getMostRecentWindow().gBrowser;
  PBListener(browser);
};
