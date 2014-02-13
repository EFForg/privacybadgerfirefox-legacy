/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const windows = require("sdk/windows").browserWindows;
const utils = require("sdk/window/utils");
const panel = require("sdk/panel");
const data = require("sdk/self").data;
const widget = require("sdk/widget");
const BROWSERURL = "chrome://browser/content/browser.xul"
const tabs = require("sdk/tabs");
const userStorage = require("./userStorage");

const { Cc, Ci, Cu } = require("chrome");

let pbButton = widget.Widget({
  id: "pb-button",
  label: "Privacy Badger Button",
  contentURL: data.url("pbbutton.html"),
  width: 100,
  panel: pbPanel
});

exports.pbButton = pbButton;

// Panel communicates with the content script (popup.js) using the port APIs

let pbPanel = panel.Panel({
  contentURL: data.url("popup.html"),
  contentScriptFile: data.url("popup.js"),
  onShow: function() {
    var settings = getCurrentSettings();
    pbPanel.port.emit("show-trackers", settings);
  },
});

pbPanel.port.on("done", function(settings) { handleNewSettings(settings) });

// TODO: add functions here
pbPanel.port.on("activate", function() {});
pbPanel.port.on("deactivate", function() {});


/*
 * Retrieve and update block settings based on UI interactions.
 */

function getCurrentSettings() {
 
}

// possible userset actions: block, cookieblock, noaction
function handleNewSettings(settings) {
  origins = Object.keys(settings);
  for (var i=0; i<origins.length; i++) {
    var origin = origins[i]
    switch (settings[i]) {
      case "block":
        userStorage.addRed(origin);
        break;
      case "cookieblock":
        userStorage.addYellow(origin);
        break;
      case "noaction":
        userStorage.addBlue(origin);
    }
  }
}
