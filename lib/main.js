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
  heuristicBlocker.updateHeuristicsForChannel(channel, aWin);

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
  // Ignore first party requests and whitelisted schemes
  if (!(ContentPolicy.Policy.isBlockableRequest(channel.URI, null, channel))) {
    console.log("Skipping heuristic blocker for", channel.URI.host);
    return true;
  }

  // Ignore anything that the user has whitelisted
  if (ContentPolicy.Policy.isUserGreenRequest(channel.URI))
    return true;

  // Debug
  if (ContentPolicy.Policy.isUserRedRequest(channel.URI)) {
    console.log("WARNING: request should have been blocked", channel.URI.spec);
    return true;
  }

  return false;
};

/**
 *  http-on-cookie-changed:
 *    logs cookie changes; this should get called for both
 *    js and HTTP cookies.
 */
function onCookieChanged(event) {
  heuristicBlocker.handleCookie(event.subject, event.data);
}

/**
 * http-on-cookie-rejected:
 *    called when user prefs cause cookie to be rejected from being set.
 *    used for checking whether cookieblock is working correctly.
 */
function onCookieRejected(event) {
  console.log("rejected cookie for", event.subject);
}

function main(options) {
  prefsListener.init();

  heuristicBlocker.init();
  userStorage.init();
  userStorage.sync();

  let categoryManager = Cc["@mozilla.org/categorymanager;1"]
                          .getService(Ci.nsICategoryManager);
  categoryManager.addCategoryEntry(
    "content-policy", "PrivacyBadgerContentPolicy",
    ContentPolicy.ContentPolicyFactory.contract, false, true);

  events.on("http-on-modify-request", onModifyRequest, false);
  events.on("cookie-changed", onCookieChanged, false);
  events.on("cookie-rejected", onCookieRejected, false);

  // This listener below is a weird hack because I couldn't get any of the
  // regular startup notifications to fire. From the docs, it seems that
  // pbUI.onStartup should be be listening for sessionstore-windows-restored.
  events.once("http-on-modify-request", pbUI.onStartup, false);
  console.log("started up!");
}

function unload(reason) {
  prefsListener.cleanup();

  let categoryManager = Cc["@mozilla.org/categorymanager;1"]
                       .getService(Ci.nsICategoryManager);
  categoryManager.deleteCategoryEntry("content-policy",
                                      "PrivacyBadgerContentPolicy", false);

  events.off("http-on-modify-request", onModifyRequest);
  events.off("cookie-changed", onCookieChanged, false);
  events.off("cookie-rejected", onCookieRejected, false);

  // Remove webprogress listener
  pbUI.onShutdown();

  // Remove settings listeners
  off(pbUI.settingsMap);

  console.log("successful unload");
}

exports.main = main;
exports.onUnload = unload;
