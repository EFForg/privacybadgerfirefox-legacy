/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// Handles replacing and temporarily unblocking social media widgets,
// based on ShareMeNot

/*
 * ShareMeNot is licensed under the MIT license:
 * http://www.opensource.org/licenses/mit-license.php
 *
 * Copyright (c) 2011-2014 University of Washington
 *
 * Permission is hereby granted, free of charge, to any person obtaining a
 * copy of this software and associated documentation files (the
 * "Software"), to deal in the Software without restriction, including
 * without limitation the rights to use, copy, modify, merge, publish,
 * distribute, sublicense, and/or sell copies of the Software, and to
 * permit persons to whom the Software is furnished to do so, subject to
 * the following conditions:
 *
 * The above copyright notice and this permission notice shall be included
 * in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
 * OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
 * IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
 * CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
 * TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
 * SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/

"use strict";

const { data } = require("sdk/self");
const socialWidgetLoader = require("./socialWidgetLoader");
const { settingsMap, tempUnblockMap } = require("./ui");
const utils = require("./utils");

let socialWidgetList = [];

exports.init = function() {
  // load social widgets from file
  socialWidgetList = socialWidgetLoader.loadSocialWidgetsFromFile("socialwidgets.json");
};


// Provides the social widget blocking content script with list of
// social widgets to block and other metainfo
exports.getSocialWidgetContentScriptData = function(tab) {

  // a mapping of individual SocialWidget objects to boolean values
  // saying if the content script should replace that tracker's buttons
  let socialWidgetsToReplace = {};

  let aWin = utils.getWindowForSdkTab(tab);
  if (!aWin) { return null; }

  let blockedData = settingsMap.get(aWin);
  if (!blockedData) { return null; }

  socialWidgetList.forEach(function(socialWidget) {
    let socialWidgetName = socialWidget.name;

    if (blockedData[socialWidget.domain]) {
      socialWidgetsToReplace[socialWidgetName] =
        (blockedData[socialWidget.domain] == "block" ||
         blockedData[socialWidget.domain] == "userblock");
    }
    else {
      socialWidgetsToReplace[socialWidgetName] = false;
    }
  });

  return {
    "contentScriptFolderUrl" : data.url(""),
    "trackers" : socialWidgetList,
    "trackerButtonsToReplace" : socialWidgetsToReplace,
  };
};

// Unblocks a tracker just temporarily on this tab, because the user has
// clicked the corresponding replacement social widget.
exports.unblockSocialWidgetOnTab = function(tab, socialWidgetUrls) {
  for (let socialWidgetUrl of socialWidgetUrls) {
    let socialWidgetHost = utils.getHostname(socialWidgetUrl);
    let aWin = utils.getWindowForSdkTab(tab);
    if (!aWin) { return null; }

    //console.log("UNBLOCKING FOR THIS WINDOW ONLY: "
    //              + socialWidgetHost + " " + aWin.location);
    let tempUnblock = tempUnblockMap.get(aWin, {});
    tempUnblock[socialWidgetHost] = true;
    tempUnblockMap.set(aWin, tempUnblock);
  }
};

// Checks whether the site has been temporarily unblocked because of
// user's social media widget click.
exports.isSocialWidgetTemporaryUnblock = function(aLoc, aWin) {
  if (!aWin) { return false; }
  let host = aLoc.host;
  let tempUnblockInfo = tempUnblockMap.get(aWin);
  if (tempUnblockInfo && host && tempUnblockInfo[host]) {
    return true;
  }
};

exports.clearTemporaryUnblocksByWin = function(aWin) {
  if (!aWin) { return; }
  tempUnblockMap.delete(aWin);
};
