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
const { storage } = require("simple-storage");

const { Cc, Ci, Cu } = require("chrome");

if (!storage.blocked) {
  storage.blocked = {};
}

let blockingObserver = function(e) {
  let data = e.data;
  storage.blocked[data] = true;
};

let pbPanel = panel.Panel({
  contentURL: data.url("blocked.html"),
  onMessage: function(aMessage) {
    if (aMessage == "hide") {
      this.hide();
    }
  },
  onShow: function() {
    let message = {};
    message.type = "privacy-badger-blocklist";
    message.value = JSON.stringify(storage.blocked);
    this.postMessage(message);
  },
  onHide: function() {
    let win = utils.getMostRecentBrowserWindow();
    win.dispatchEvent(new win.CustomEvent("hide",
                                          { detail: this }));
  }
});

let pbButton = widget.Widget({
  id: "pb-button",
  label: "Privacy Badger Button",
  contentURL: data.url("pbbutton.html"),
  width: 100,
  panel: pbPanel,
});

exports.blockingObserver = blockingObserver;
