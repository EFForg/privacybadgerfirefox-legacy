// Privacy Badger user interface controller.

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const panel = require("sdk/panel");
const BROWSERURL = "chrome://browser/content/browser.xul";
const userStorage = require("./userStorage");
const utils = require("./utils");
const { Cc, Ci, Cu } = require("chrome");
const { on, once, off, emit } = require('sdk/event/core');
const main = require('./main');
const tabs = require("sdk/tabs");
const { getMostRecentBrowserWindow } = require("sdk/window/utils");
const { id: addonID, data } = require("sdk/self");
const contentPolicy = require('./contentPolicy');

const xulapp = require("sdk/system/xul-app");
const usingAustralis = xulapp.satisfiesVersion(">=29");
if (usingAustralis) {
  var { ToggleButton } = require("sdk/ui/button/toggle");
} else {
  const {
    Widget
  } = require("sdk/widget");
}
exports.usingAustralis = usingAustralis;

// Panel communicates with the content script (popup.js) using the port APIs.
// This is where the user toggles settings.
var pbPanel = panel.Panel({
  contentURL: data.url("popup.html"),
  contentScriptFile: [data.url("jquery-ui/js/jquery-1.10.2.js"),
                      data.url("jquery-ui/js/jquery-ui.js"),
                      data.url("vex/vex.js"),
                      data.url("tld.js"),
                      data.url("popup.js")],
  width: 385,
  height: 520,
  onShow: emitRefresh,
  onHide: function() {
    handleNewSettings(changedSettings);
    changedSettings = {};
    pbPanel.port.emit("afterClose");
    if (usingAustralis) {
      // Need to manually "un-toggle" the ToggleButton :/
      button.state('window', {checked: false});
    }
  }
});

// Refresh the panel
function emitRefresh() {
  if (userStorage.isDisabledSite(tabs.activeTab.url, tabs.activeTab)) {
    pbPanel.port.emit("show-inactive");
    return;
  }
  let settings = getCurrentSettings();
  console.log("Showing panel with settings: "+JSON.stringify(settings));
  pbPanel.port.emit("show-trackers", settings);
}

// Called whenever user toggles a setting
pbPanel.port.on("update", function(data) {
  handleUpdate(data);
});
// Called when user setting is undone
pbPanel.port.on("reset", function(origin) {
  changedSettings[origin] = "reset";
  let originalState = contentPolicy.Policy.getOriginalState(origin);
  pbPanel.port.emit("change-setting", { origin: origin, action: originalState });
});
// Activate PB on the current page
pbPanel.port.on("activateSite", function() {
  let currentTab = tabs.activeTab;
  userStorage.removeFromDisabledSites(currentTab.url, currentTab);
  let topContentWindow = utils.getMostRecentContentWindow();
  if (!topContentWindow) { return; }
  settingsMap.set(topContentWindow, {cleared: true});
  emitRefresh();
});
// Deactivate PB on the current page
pbPanel.port.on("deactivateSite", function() {
  let currentTab = tabs.activeTab;
  userStorage.addToDisabledSites(currentTab.url, currentTab);
  let topContentWindow = utils.getMostRecentContentWindow();
  if (!topContentWindow) { return; }
  settingsMap.set(topContentWindow, {cleared: true});
  emitRefresh();
});
// Unblock everything
pbPanel.port.on("unblockAll", function() {
  main.emptyData();
  clearSettings();
  utils.reloadCurrentTab();
  emitRefresh();
});
// Close the panel
pbPanel.port.on("hidePanel", function() {
  pbPanel.hide();
});

// Begin hack to attach the panel to the ToggleButton in 29
const buttonPrefix =
  'button--' + addonID.toLowerCase().replace(/[^a-z0-9-_]/g, '');

const toWidgetID = id => buttonPrefix + '-' + id;

const nodeFor = ({id}) =>
  getMostRecentBrowserWindow().document.getElementById(toWidgetID(id));
// end hack

// This is the little button in the addons bar that opens the panel on click.
let button;
if (usingAustralis) {
  button = ToggleButton({
    id: "pb-button",
    label: "Privacy Badger",
    icon: {
      "16": data.url("icons/badger-16.png"),
      "32": data.url("icons/badger-32.png"),
      "64": data.url("icons/badger-64.png")
    },
    onChange: function(state) {
      if (state.checked) {
        // in FF29 will show a warning about using the 2nd argument,
        // but only in dev mode
        pbPanel.show({ position: button }, nodeFor(button));
      }
    }
  });
} else {
  button = Widget({
    id: "pb-button",
    label: "Privacy Badger",
    contentURL: data.url("icons/badger-64.png"),
    panel: pbPanel
  });
}

exports.pbPanel = pbPanel;
exports.pbButton = button;

/**
 * Update tab's action badge with current count based on channel
 */
function updateCountForChannel(channel, aWin) {
  if(!channel) { return {}; }

  if(arguments.length < 2) {
    aWin = utils.getTopWindowForChannel(channel);
  }

  if(!aWin) { return {}; }

  if(contentPolicy.Policy.isDisabledRequest(channel, aWin)) {
    return;
  }

  var numBlocked = Object.keys(getSettingsForWindow(aWin)).length;
  var badgeText = numBlocked + "";
  var badgeColor = "#FF0000";
  if(numBlocked == 0){
    badgeColor = "#00FF00";
  }
  if(xulapp.satisfiesVersion(">=36")) {
    let tab = utils.getTabForChannel(channel, aWin);
    // Note that you must set both properties simultaneously, otherwise
    // the one you don't set will get overwritten with the default value
    button.state(tab, {badge: badgeText, badgeColor: badgeColor});
  } else {
    // Do nothing for now--need TODO quite a bit of engineering to
    // get this to work for Firefox < 36
  }
}
exports.updateCountForChannel = updateCountForChannel;

/**
 * Retrieve and update block settings based on user interactions.
 *
 *  getCurrentSettings - returns a "dictionary" with the third-party tracking
 *  origins as keys and one of the following as values:
 *    * block: origin has been blocked by heuristic
 *    * userblock: origin has been blocked by user
 *    * cookieblock: origin is cookie-blocked by heuristics
 *    * usernoaction: origin has been whitelisted by user
 *    * usercookieblock: origin is cookie-blocked by user
 *    * noaction: none of the above
 *
 *  handleNewSettings - takes as input ONLY the settings that were changed
 *  after the user interacted with the popup, based on the "userset"
 *  attribute. updates Storage accordingly.
 *
 *  handleUpdate - stores the changed setting in a temporary object.
 *
 */

// origin-action keypairs
let changedSettings = {};

// Special key "cleared" in settings marks that a page needs to be reloaded
// before its settings are shown correctly
function clearSettings() {
  tempUnblockMap.clear();
  settingsMap.clear();
  var allWindows = utils.getAllWindows();
  console.log("ALL WINDOWS", allWindows);
  allWindows.forEach(function(element, index, array) {
    settingsMap.set(element, {cleared: true});
  });
}

function getCurrentSettings() {
  let topContentWindow = utils.getMostRecentContentWindow();
  console.log("LOCATION topContentWindow", topContentWindow.location.href);
  if (!topContentWindow) { return {}; }
  return settingsMap.get(topContentWindow) || {};
}

function getSettingsForWindow(aWin) {
  if(!aWin) { return {}; }
  return settingsMap.get(aWin) || {};
}
exports.getSettingsForWindow = getSettingsForWindow;

function handleUpdate(data) {
  changedSettings[data.origin] = data.action;
}

function handleNewSettings(settings) {
  if (Object.keys(settings).length === 0) { return false; }
  console.log("handling new settings", JSON.stringify(settings));
  for (let origin in settings) {
    switch (settings[origin]) {
      case "reset":
        let topContentWindow = utils.getMostRecentContentWindow();
        userStorage.resetOrigin(origin, topContentWindow);
        break;
      case "block":
        userStorage.add("red", origin);
        break;
      case "cookieblock":
        userStorage.add("yellow", origin);
        break;
      case "noaction":
        userStorage.add("green", origin);
    }
  }
  utils.reloadCurrentTab();
  return true;
}

/**
 * settingsMap implementation. This object keeps track of which allow/block
 * settings were applied to each window.
 */
let settingsMap = new WeakMap();

/**
 * tempUnlockMap keeps track of temporary unblocks due to social media widget clicks
 * (should eventually refactor into a property of settingsMap)
 */
let tempUnblockMap = new WeakMap();

/**
 * tabWorkers keeps track of the workers for open tabs, so we can send messages
 * to their content scripts when blocking happens.
 */
let tabWorkers = new WeakMap();

/**
 * Register our event listener to update Settings. Events are emitted
 * in the form emit(target, type, msg, nsIDOMWindow, origin),
 * where origin is the cookie origin and nsIDOMWindow is the parent origin.
 */
on(settingsMap, "update-settings", updateSettingsListener);

/**
 * Ways for settingsMap value to get updated for a domwin:
 *   third party cookie is set = noaction
 *   third party cookie on preloads list is heuristic-blacklisted: cookieblock
 *   third party cookie is heuristics-blacklisted = block
 *   user sets green on third party cookie = usernoaction
 *   user sets yellow on third party cookie = usercookieblock
 *   user sets red on third party cookie = userblock
 *
 *   @param {string} msg
 *   @param {nsIDOMWindow} aWin
 *   @param {string} aOrigin
 *   @return {null}
 */
function updateSettingsListener(msg, aWin, aOrigin) {
  if (!aWin) {
    console.log("Can't update request without a window");
    return;
  } else if (!aOrigin) {
    console.log("Missing origin for cookie");
    return;
  }

  aWin = aWin.top;
  var setting = settingsMap.get(aWin) || {};
  setting[aOrigin] = msg;

  settingsMap.set(aWin, setting);
  //console.log("settingsMap: ", aWin.location.href, JSON.stringify(settingsMap.get(aWin)));

  notifyContentScript(msg, aWin, aOrigin);
}

/**
 * Notify the tab's content script so that it can replace social widgets,
 * if applicable.
 */
function notifyContentScript(msg, aWin, aOrigin) {
  if (msg == "block" || msg == "userblock") {
    let tabWorker = tabWorkers.get(aWin);
    if (tabWorker && tabWorker.tab) {
      tabWorker.port.emit("replaceSocialWidget", aOrigin);
    }
  }
}

/**
 * Used on location change.
 *
 * @param {nsIDOMWindow} aWin
 */
exports.clearSettingsMap = function(aWin) {
  if (!aWin) { return; }
  settingsMap.delete(aWin);
};

//on(settingsMap, "clear-settings", clearSettingsListener);

exports.settingsMap = settingsMap;
exports.tempUnblockMap = tempUnblockMap;
exports.tabWorkers = tabWorkers;
