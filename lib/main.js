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


/**
 *  http-on-modify-request:
 *    all - update heuristics if the request contains a cookie
 *    userYellow - clear referer, add DNT, send the request
 *    userGreen and other requests - add DNT, send the request
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

  // Do nothing more if this is a first-party channel
  if (!utils.isThirdPartyChannel(channel)) {
    return null;
  }

  // Update the heuristic blocker
  heuristicBlocker.updateHeuristicsForChannel(channel);

  // TODO: investigate moving blocking from ContentPolicy to here because we
  // have a nice way to get the top window from a channel.
  let aWin = utils.getTopWindowForChannel(channel);

  // shouldCookieblockRequest emits cookieblock / usercookieblock / noaction.
  if (ContentPolicy.Policy.shouldCookieblockRequest(channel.URI, aWin)) {
    // Clear referer for all requests where we would clobber cookies.
    channel.setRequestHeader("Referer", "", false);
  }
}

/**
 *  http-on-cookie-changed:
 *    updates the heuristic blocker; this should get called for both
 *    js and HTTP cookies. only used for logging right now.
 *
 *  TODO: Is this useful for preventing tracking by js cookies?
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
