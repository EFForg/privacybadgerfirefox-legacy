"use strict";

const { data } = require("sdk/self");
const socialWidgetLoader = require("./socialWidgetLoader");
const { settingsMap } = require("./ui");
const tabUtils = require("sdk/tabs/utils");
const utils = require("./utils");
const { emit } = require('sdk/event/core');

let socialWidgetList;
let tempUnblockMap;


exports.init = function() {
  // load social widgets from file
  socialWidgetList = socialWidgetLoader.loadSocialWidgetsFromFile("socialwidgets.json");

  // keep track of temporary unblocks due to button clicks
  tempUnblockMap = new WeakMap();
}


// Provides the social widget blocking content script with list of social widgets to block
exports.getSocialWidgetBlockList = function(tab) {

  // a mapping of individual SocialWidget objects to boolean values
  // saying if the content script should replace that tracker's buttons
  let socialWidgetsToReplace = {};

  socialWidgetList.forEach(function(socialWidget) {
    let socialWidgetName = socialWidget.name;

    // replace them if PrivacyBadger has blocked them
    let aWin = getWindow(tab);
    let blockedData = settingsMap.get(aWin);

    if (blockedData && blockedData[socialWidget.domain]) {
      socialWidgetsToReplace[socialWidgetName] = (blockedData[socialWidget.domain] == "block"
                                                  || blockedData[socialWidget.domain] == "userblock");
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
}

// Unblocks a tracker just temporarily on this tab, because the user has clicked the
// corresponding replacement social widget.
exports.unblockSocialWidgetOnTab = function(tab, socialWidgetUrls) {
  for (let socialWidgetUrl of socialWidgetUrls) {
    let socialWidgetHost = utils.getHostname(socialWidgetUrl);
    let aWin = getWindow(tab);
    //console.log("UNBLOCKING FOR THIS WINDOW ONLY: " + socialWidgetHost + " " + aWin.location);
    let tempUnblock = tempUnblockMap.get(aWin, {});
    tempUnblock[socialWidgetHost] = true;
    tempUnblockMap.set(aWin, tempUnblock);
  }
}

// Checks whether the site has been temporarily unblocked because of social media widget click.
exports.isSocialWidgetTemporaryUnblock = function(aLoc, aWin) {
  let host = aLoc.host;
  let tempUnblockInfo = tempUnblockMap.get(aWin);
  if (tempUnblockInfo && tempUnblockInfo[host]) {
    return true;
  }
}

// Given a high-level tab, turn into low-level xul tab object to get window
function getWindow(sdkTab) { 
 for (let tab of tabUtils.getTabs()) 
   if (sdkTab.id === tabUtils.getTabId(tab)) 
      return tabUtils.getTabContentWindow(tab); 

 return null; 
}

exports.clearTemporaryUnblocks = function(aWin) {
  tempUnblockMap.delete(aWin);
}
