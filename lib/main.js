/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const { Cc, Ci } = require("chrome");
const ContentPolicy = require("./contentPolicy");
const pbUI = require("./ui");
const events = require("sdk/system/events");
const heuristicBlocker = require("./heuristicBlocker");
const userStorage = require("./userStorage");
const utils = require("./utils");
const { storage } = require("sdk/simple-storage");
const { on, once, off, emit } = require('sdk/event/core');
const prefsListener = require("./prefsListener");

/**
 * PB prefs
 */
let prefs = require('sdk/simple-prefs').prefs;

/**
 *  http-on-modify-request:
 *    sets DNT on all requests, updates heuristics, emits events to the
 *    panel.
 *
 *  Note that userRed and other blocked requests are handled by ContentPolicy.
 *  userYellow cookie clobbering is also handled separately. There's no need
 *  to re-clobber cookies on every request.
 *
 */
function onModifyRequest(event) {
  let channel = event.subject.QueryInterface(Ci.nsIHttpChannel);

  // Always set DNT?
  channel.setRequestHeader("DNT", "1", false);

  if (ignoreRequest(channel)) { return; }

  // TODO: investigate moving blocking from ContentPolicy to here because we
  // have a nice way to get the top window from a channel.
  let aWin = utils.getTopWindowForChannel(channel);

  // Update the heuristic blocker
  if (isHeuristicEnabled()) {
    heuristicBlocker.updateHeuristicsForChannel(channel, aWin);
  }

  // shouldCookieblockRequest emits cookieblock / usercookieblock / noaction.
  // TODO: Separate out event emitters so that this is more transparent.
  if (ContentPolicy.Policy.shouldCookieblockRequest(channel.URI, aWin)) {
    // Clear referer for all requests where we would clobber cookies.
    channel.setRequestHeader("Referer", "", false);
  }
}

/**
 * Determine if a request should be ignored in onModifyRequest
 * @param {nsIHttpChannel} channel
 * @return {Boolean}
 */
let ignoreRequest = function(channel) {
  // Ignore first party requests, whitelisted schemes
  if (!(ContentPolicy.Policy.isBlockableRequest(channel.URI, null, channel))) {
    console.log("Skipping heuristic blocker for", channel.URI.host);
    return true;
  }

  // Ignore anything that the user has whitelisted
  if (ContentPolicy.Policy.isUserGreenRequest(channel.URI)) {
    return true;
  }

  // Ignore requests associated with a window where PB is disabled
  if (ContentPolicy.Policy.isDisabledRequest(channel, null)) {
    return true;
  }

  // Debug
  if (ContentPolicy.Policy.isUserRedRequest(channel.URI)) {
    console.log("WARNING: request should have been blocked", channel.URI.spec);
    return true;
  }

  return false;
};

/*
 * Enable Privacy Badger from the PB panel. Not currently used.
 */
function enable() {
  prefsListener.init();
  userStorage.init();
  if (isHeuristicEnabled()) {
    heuristicBlocker.init();
    userStorage.sync();
  }

  let categoryManager = Cc["@mozilla.org/categorymanager;1"]
                          .getService(Ci.nsICategoryManager);
  categoryManager.addCategoryEntry(
    "content-policy", "PrivacyBadgerContentPolicy",
    ContentPolicy.ContentPolicyFactory.contract, false, true);

  events.on("http-on-modify-request", onModifyRequest, false);
}

/*
 * Disable Privacy Badger from the PB panel. This differs from disabling
 * Privacy Badger from about:addons because the addon button remains in the
 * toolbar, so PB can be easily re-enabled from its own panel. Not currently
 * used.
 */
function disable() {
  prefsListener.cleanup();

  let categoryManager = Cc["@mozilla.org/categorymanager;1"]
                       .getService(Ci.nsICategoryManager);
  categoryManager.deleteCategoryEntry("content-policy",
                                      "PrivacyBadgerContentPolicy", false);

  events.off("http-on-modify-request", onModifyRequest);
}

/*
 * Called when addon is loaded
 */
function main(options) {
  prefsListener.initEnabled();
  enable();
  // This listener below is a weird hack because I couldn't get any of the
  // regular startup notifications to fire. From the docs, it seems that
  // pbUI.onStartup should be be listening for sessionstore-windows-restored.
  events.once("http-on-modify-request", pbUI.onStartup, false);
  console.log("Started up");
}

/*
 * Called when addon is unloaded. Not called on uninstall due to
 * https://bugzilla.mozilla.org/show_bug.cgi?id=627432.
 */
function unload(reason) {
  prefsListener.cleanupEnabled();
  disable();
  // Remove webprogress listener
  pbUI.onShutdown();
  // Remove settings listeners
  off(pbUI.settingsMap);
  console.log("Successful unload", reason);
}

/**
 * Clear as much data as we can. Intended to be used right before uninstall.
 * @param {bool} clearPrefs  reset default prefs?
 * @param {bool} clearStorage  clear local storage?
 */
function clearData(clearPrefs, clearStorage) {
  if (clearStorage) {
    // delete everything in localStorage - must init again to use later!
    heuristicBlocker.clear();
    userStorage.clear();
  }
  if (clearPrefs) {
    let prefService = require('sdk/preferences/service');
    let pbRoot = 'extensions.' + require('sdk/self').id;
    let prefs = prefService.keys(pbRoot);
    for (let pref in prefs) {
      if (prefs.hasOwnProperty(pref)) {
        prefService.reset(pref);
      }
    }
  }
}

/**
 * In case we add an option to disable the heuristic blocker
 */
function isHeuristicEnabled() {
  return prefs.heuristicEnabled;
}

/**
 * Empty all pb-related local storage but keep preloaded whitelist.
 */
function empty() {
  heuristicBlocker.empty();
  userStorage.empty();
}

exports.main = main;
exports.onUnload = unload;
exports.enable = enable;
exports.disable = disable;
exports.clearData = clearData;
exports.isHeuristicEnabled = isHeuristicEnabled;
exports.empty = empty;
