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

/*
 *  http-on-examine-response:
 *    update the heuristic blocker
 */

function onExamineResponse(event) {
  let channel = event.subject.QueryInterface(Ci.nsIHttpChannel);

  // Do nothing if this is a first-party channel
  if (!utils.isThirdPartyChannel(channel)) {
    console.log("got first party: "+channel.URI.spec);
    return null;
  }

  heuristicBlocker.updateHeuristics(channel);
}

/*
 *  http-on-modify-request:
 *    userYellow - erase cookies, clear referer, add DNT, send the request
 *    userBlue - add DNT, send the request
 *
 *  Note that userRed and other blocked requests are handled by ContentPolicy.
 */

function onModifyRequest(event) {
  let channel = event.subject.QueryInterface(Ci.nsIHttpChannel);

  // Do nothing if this is a first-party channel
  if (!utils.isThirdPartyChannel(channel)) {
    console.log("got first party: "+channel.URI.spec);
    return null;
  }

  let host = channel.URI.hostname;
  if (host in storage["userYellow"]) {
    channel.referrer = "";
    channel.setRequestHeader("Cookie", "", false);
    channel.setRequestHeader("DNT", "1", false);
  } else if (host in storage["userBlue"]) {
    channel.setRequestHeader("DNT", "1", false);
  } else if (host in storage["userRed"]) {
    // Should never happen if ContentPolicy is working correctly
    console.log("Got unexpected onModifyRequest for blocked domain: "+host);
  }
}

function main(options) {
  heuristicBlocker.init();
  userStorage.init();

  let categoryManager = Cc["@mozilla.org/categorymanager;1"]
                          .getService(Ci.nsICategoryManager);
  categoryManager.addCategoryEntry(
    "content-policy", "PrivacyBadgerContentPolicy",
    pbContentPolicy.pbContentPolicyFactory.contract, false, true);

  events.on("http-on-examine-response", onExamineResponse, false);
  events.on("http-on-modify-request", onModifyRequest, false);
  console.log("started up!");
}

function unload(reason) {
  let categoryManager = Cc["@mozilla.org/categorymanager;1"]
                       .getService(Ci.nsICategoryManager);
  categoryManager.deleteCategoryEntry("content-policy",
                                      "PrivacyBadgerContentPolicy", false);
  events.off("http-on-examine-response", onExamineResponse);
  events.off("http-on-modify-request", onModifyRequest);
  console.log("successful unload");
}

exports.main = main;
exports.onUnload = unload;
