/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const { Cc, Ci } = require("chrome");
const pbContentPolicy = require("./pbContentPolicy");
const pbUI = require("./ui");
const events = require("sdk/system/events");
const heuristicBlocker = require("./heuristicBlocker");

// http-on-examine-response
// https://addons.mozilla.org/en-US/developers/docs/sdk/1.13/modules/sdk/system/events.html
function onExamineResponse(event) {
  let channel = event.subject.QueryInterface(Ci.nsIHttpChannel);
  heuristicBlocker.updateHeuristics(channel);
}

function main(options) {
  let categoryManager = Cc["@mozilla.org/categorymanager;1"]
                          .getService(Ci.nsICategoryManager);
  categoryManager.addCategoryEntry(
    "content-policy", "PrivacyBadgerContentPolicy",
    pbContentPolicy.pbContentPolicyFactory.contract, false, true);

  events.on("http-on-examine-response", onExamineResponse, false);
  console.log("started up!");
}

function unload(reason) {
  let categoryManager = Cc["@mozilla.org/categorymanager;1"]
                          .getService(Ci.nsICategoryManager);
  categoryManager.deleteCategoryEntry("content-policy",
                                      "PrivacyBadgerContentPolicy", false);
  events.off("http-on-examine-response", onExamineResponse);
  console.log("successful unload");
}

exports.main = main;
exports.onUnload = unload;
