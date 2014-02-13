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

const { Cc, Ci, Cu } = require("chrome");

// Panel communicates with the content script (popup.js) using the port APIs

let pbPanel = panel.Panel({
  contentURL: data.url("popup.html"),
  contentScriptFile: data.url("popup.js"),
  onShow: function() {
    var trackerStates = getTrackerStates();
    pbPanel.port.emit("show-trackers", trackerStates);
  },
  onHide: function() { console.log("panel hidden"); }
});

// When the user has changed the settings and closes the panel, update
// the settings accordingly.
pbPanel.port.on("done", function(settings) {});


// TODO: add functions here
pbPanel.port.on("activate", function() {});
pbPanel.port.on("deactivate", function() {});

let pbButton = widget.Widget({
  id: "pb-button",
  label: "Privacy Badger Button",
  contentURL: data.url("pbbutton.html"),
  width: 100,
  panel: pbPanel,
});

exports.pbButton = pbButton;
