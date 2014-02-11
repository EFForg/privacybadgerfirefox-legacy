/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const { Cc, Ci } = require("chrome");
const pbContentPolicy = require("./pbContentPolicy");
const pbUI = require("./ui");
const events = require("sdk/system/events");
const heuristicBlocker = require("./heuristicBlocker");

/*
 *  http-on-examine-response:
 *    update the heuristic blocker
 */

function onExamineResponse(event) {
  let channel = event.subject.QueryInterface(Ci.nsIHttpChannel);
  heuristicBlocker.updateHeuristics(channel);
}

/*
 *  http-on-modify-request:
 *    userYellow - erase cookies, add DNT, send the request
 *    userBlue - add DNT, send the request
 *
 *  Note that userRed and other blocked requests are handled by ContentPolicy.
 */

function onModifyRequest(event) {
  let channel = event.subject.QueryInterface(Ci.nsIHttpChannel);
  channel.setRequestHeader("DNT", "1", false);
}

function main(options) {
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
