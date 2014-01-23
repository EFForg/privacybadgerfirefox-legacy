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

let pbPanel = panel.Panel({
  contentURL: data.url("blocked.html"),
  onMessage: function(aMessage) {
    this.hide();
  },
  onShow: function() {
    let win = utils.getMostRecentBrowserWindow();
    win.dispatchEvent(new win.CustomEvent("compute-blocked", { detail: this }));
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

exports.pbButton = pbButton;
