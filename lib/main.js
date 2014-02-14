/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const { Cc, Ci } = require("chrome");
const pbContentPolicy = require("./pbContentPolicy");
const pbUI = require("./ui");
const events = require("sdk/system/events");
const heuristicBlocker = require("./heuristicBlocker");
const userStorage = require("./userStorage");
const utils = require("./utils");
const { storage } = require("sdk/simple-storage");
const { on, once, off, emit } = require('sdk/event/core');
const { settingsMap } = require("./settingsMap");

/*
 *  http-on-examine-response:
 *    update the heuristic blocker
 */

function onExamineResponse(event) {
  let channel = event.subject.QueryInterface(Ci.nsIHttpChannel);

  // Do nothing if this is a first-party channel
  if (!utils.isThirdPartyChannel(channel)) {
    return null;
  }

  heuristicBlocker.updateHeuristics(channel);
}

/*
 *  http-on-modify-request:
 *    userYellow - clear referer, add DNT, send the request
 *    userGreen and other requests - add DNT, send the request
 *
 *  Note that userRed and other blocked requests are handled by ContentPolicy.
 *  userYellow cookie clobbering is also handled separately.
 */

function onModifyRequest(event) {
  let channel = event.subject.QueryInterface(Ci.nsIHttpChannel);

  // Always set DNT?
  channel.setRequestHeader("DNT", "1", false);

  // Do nothing more if this is a first-party channel
  if (!utils.isThirdPartyChannel(channel)) {
    return null;
  }

  let host = channel.URI.host;
  if (host in storage.userYellow) {
    channel.referrer = "";
  } else if (pbContentPolicy.Policy.shouldBlockRequest(channel.URI)) {
    // Should never happen if ContentPolicy is working correctly
    console.log("Got unexpected onModifyRequest for blocked domain: "+host);
  }
}

/*
 * cookie-changed:
 *  mainly exists for debugging purposes right now
 */

function onCookieChanged(event) {
  if (!(event.subject instanceof Ci.nsICookie2)) {
    // ignore batch deletes and cookie clear/reload events
    return null;
  }

  var host = event.subject.host;

  if (!(host in storage.userYellow) || !(host in storage.userRed)) {
    return null;
  } else {
    console.log("Got cookie change for "+host);
  }
}

function main(options) {
  heuristicBlocker.init();
  userStorage.init();
  userStorage.sync();

  let categoryManager = Cc["@mozilla.org/categorymanager;1"]
                          .getService(Ci.nsICategoryManager);
  categoryManager.addCategoryEntry(
    "content-policy", "PrivacyBadgerContentPolicy",
    pbContentPolicy.pbContentPolicyFactory.contract, false, true);

  events.on("http-on-examine-response", onExamineResponse, false);
  events.on("http-on-modify-request", onModifyRequest, false);
  events.on("cookie-changed", onCookieChanged, false);

  /* This listener below is a weird hack because I couldn't get any of the
   * regular startup notifications to fire. From the docs, it seems that
   * pbUI.onStartup should be be listening for sessionstore-windows-restored.
   */

  events.once("http-on-modify-request", pbUI.onStartup, false);
  console.log("started up!");
}

function unload(reason) {
  let categoryManager = Cc["@mozilla.org/categorymanager;1"]
                       .getService(Ci.nsICategoryManager);
  categoryManager.deleteCategoryEntry("content-policy",
                                      "PrivacyBadgerContentPolicy", false);
  events.off("http-on-examine-response", onExamineResponse);
  events.off("http-on-modify-request", onModifyRequest);
  events.off("cookie-changed", onCookieChanged);
  // Remove webprogress listener
  pbUI.onShutdown();
  // Remove settings listeners
  off(settingsMap);
  console.log("successful unload");
}

exports.main = main;
exports.onUnload = unload;
