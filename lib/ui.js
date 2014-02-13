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

// Panel communicates with the content script (popup.js) using the port APIs

let pbPanel = panel.Panel({
  contentURL: data.url("popup.html"),
  contentScriptFile: [data.url("jquery-ui/js/jquery-1.7.1.min.js"),
                      data.url("popup.js")],
  onShow: function() {
    var settings = getCurrentSettings();
    pbPanel.port.emit("show-trackers", settings);
  }
});

pbPanel.port.on("done", function(settings) { handleNewSettings(settings); });

// TODO: add functions here
pbPanel.port.on("activate", function() {});
pbPanel.port.on("deactivate", function() {});


let pbButton = widget.Widget({
  id: "pb-button",
  label: "Privacy Badger Button",
  contentURL: data.url("pbbutton.html"),
  width: 100,
  panel: pbPanel
});

exports.pbButton = pbButton;


/*
 * Retrieve and update block settings based on UI interactions.
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
  var settings = {};
  var topWindow = utils.getMostRecentWindow();
  var aList = exports.settingsMap.get(topWindow);
  if (!aList) { return settings; }

  // Third-party cookies observed from these origins; doesn't include
  // anything from the preloaded whitelist. Feature?

  for (let origin of aList.noaction) {
    settings.origin = "noaction";
  }

  // These cookies have been heuristically blocked
  for (let origin of aList.block) {
    settings.origin = "block";
  }

  // These have been whitelisted by the user.
  for (let origin of alist.usernoaction) {
    settings.origin = "usernoaction";
  }

  // These have been cookie-blocked by the user
  for (let origin of alist.usercookieblock) {
    settings.origin = "usercookieblock";
  }

  // These have been completely blocked by the user
  for (let origin of alist.userblock) {
    settings.origin = "userblock";
  }

  return settings;
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

  onLocationChange: function(aProgress, aRequest, aURI) {
    // Reset the applicable list for every window on location change
    console.log('GOT LOCATION CHANGE: '+aURI.spec);
    var win = aProgress.DOMWindow;
    if (!exports.settingsMap.get(win)) {
      exports.settingsMap.set(win, new ApplicableList());
    } else {
      exports.settingsMap.get(win).clear();
    }
  },

  initialize: function(aBrowser) { aBrowser.addTabsProgressListener(this); },

  uninitialize: function(aBrowser) { aBrowser.removeTabsProgressListener(this); }

});

if (!exports.settingsMap) {
  exports.settingsMap = new WeakMap();
}

function ApplicableList() {
  this.noaction = [];
  this.block = [];
  this.usernoaction = [];
  this.usercookieblock = [];
  this.userblock = [];
}

ApplicableList.prototype = {
 clear: function() {
  this.noaction = [];
  this.block = [];
  this.usernoaction = [];
  this.usercookieblock = [];
  this.userblock = [];
 }
};

/* Note that onStartup must run after the browser has initialized. */

var pbListener;

exports.onStartup = function(event) {
  let win = utils.getMostRecentWindow();
  pbListener = PBListener(win.gBrowser);
  console.log("listener map: "+exports.settingsMap);
};

exports.onShutdown = function() {
  try {
    pbListener.uninitialize();
  } catch (e) {
    console.log("ERROR removing pbListener");
  }
}
