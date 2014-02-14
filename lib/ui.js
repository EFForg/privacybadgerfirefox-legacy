/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const panel = require("sdk/panel");
const data = require("sdk/self").data;
const widget = require("sdk/widget");
const BROWSERURL = "chrome://browser/content/browser.xul";
const tabs = require("sdk/tabs");
const userStorage = require("./userStorage");
const storage = require("sdk/simple-storage");
const utils = require("./utils");
const { Class } = require("sdk/core/heritage");
const { Unknown } = require("sdk/platform/xpcom");
const { Cc, Ci, Cu } = require("chrome");
const { settingsMap } = require("./settingsMap");
const { on, once, off, emit } = require('sdk/event/core');

// Panel communicates with the content script (popup.js) using the port APIs.
// This is where the user toggles settings.
let pbPanel = panel.Panel({
  contentURL: data.url("popup.html"),
  contentScriptFile: [data.url("jquery-ui/js/jquery-1.7.1.min.js"),
                      data.url("popup.js")],
  onShow: function() {
    var settings = getCurrentSettings();
    console.log("Showing panel with settings: "+JSON.stringify(settings));
    pbPanel.port.emit("show-trackers", settings);
  }
});

// Update local storage once the user closes the panel.
pbPanel.port.on("done", function(settings) { handleNewSettings(settings); });

// TODO: add functions here for disabling/re-enabling privacy badger.
pbPanel.port.on("activate", function() {});
pbPanel.port.on("deactivate", function() {});

// This is the little button in the addons bar that opens the panel on click.
let pbButton = widget.Widget({
  id: "pb-button",
  label: "Privacy Badger Button",
  contentURL: data.url("pbbutton.html"),
  width: 100,
  panel: pbPanel
});

exports.pbButton = pbButton;


/*
 * Retrieve and update block settings based on user interactions.
 *
 *  getCurrentSettings - returns a "dictionary" with the third-party tracking
 *  origins as keys and one of the following as values:
 *    * block: origin has been blocked by heuristic
 *    * userblock: origin has been blocked by user
 *    * usernoaction: origin has been whitelisted by user
 *    * usercookieblock: origin is cookie-blocked by user
 *    * noaction: none of the above
 *
 *  handleNewSettings - takes as input ONLY the settings that were changed
 *  after the user interacted with the popup, based on the "userset"
 *  attribute. updates Storage accordingly.
 *
 */

function getCurrentSettings() {
  var topWindow = utils.getMostRecentWindow();
  return settingsMap.get(topWindow, {});
}

function handleNewSettings(settings) {
  origins = Object.keys(settings);
  for (var i=0; i<origins.length; i++) {
    var origin = origins[i];
    switch (settings[i]) {
      case "block":
        userStorage.addRed(origin);
        break;
      case "cookieblock":
        userStorage.addYellow(origin);
        break;
      case "noaction":
        userStorage.addGreen(origin);
    }
  }
}


/*
 * nsIWebProgressListener implementation in order to track which cookies
 * were blocked for each DOM window. settingsMap is a WeakMap of (nsIDOMWindow,
 * ApplicableList) key-value pairs. This should eventually be a separate
 * module.
 */

var PBListener = Class({

  extends: Unknown,

  interfaces: [ 'nsIWebProgressListener', 'nsISupportsWeakReference' ],

  onLocationChange: function(aBrowser, aProgress, aRequest, aURI) {
    // Reset the applicable list for every window on location change
    console.log('GOT LOCATION CHANGE: '+aURI.spec);
    var win = aProgress.DOMWindow;
    emit(settingsMap, "clear-settings", win);
  },

  initialize: function(aBrowser) { aBrowser.addTabsProgressListener(this); },

  uninitialize: function(aBrowser) { aBrowser.removeTabsProgressListener(this); }

});

var pbListener;

exports.onStartup = function(event) {
  let win = utils.getMostRecentWindow();
  pbListener = PBListener(win.gBrowser);
};

exports.onShutdown = function() {
  try {
    pbListener.uninitialize();
  } catch (e) {
    console.log("ERROR removing pbListener");
  }
};
