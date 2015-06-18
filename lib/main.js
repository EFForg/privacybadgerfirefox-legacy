/*
 * This file is part of Privacy Badger <https://www.eff.org/privacybadger>
 * Copyright (C) 2015 Electronic Frontier Foundation
 *
 * Privacy Badger is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * Privacy Badger is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Privacy Badger.  If not, see <http://www.gnu.org/licenses/>.
 */

"use strict";

const { Cc, Ci } = require("chrome");
const ContentPolicy = require("./contentPolicy");
const cookieUtils = require("./cookieUtils");
const { data } = require("sdk/self");
const events = require("sdk/system/events");
const heuristicBlocker = require("./heuristicBlocker");
const { off } = require('sdk/event/core');
const pageMod = require("sdk/page-mod");
const pbUI = require("./ui");
const policyCheck = require("./policyCheck");
const prefsListener = require("./prefsListener");
const prefs = require('sdk/simple-prefs').prefs;
const privateBrowsing = require('./privateBrowsing');
const progressListener = require("./progressListener");
const socialWidgetHandler = require("./socialWidgetHandler");
const { storage } = require("sdk/simple-storage");
const tabs = require("sdk/tabs");
const userStorage = require("./userStorage");
const utils = require("./utils");
const windows = require('sdk/windows').browserWindows;
const { settingsMap } = require("./ui");


/**
 *  http-on-modify-request:
 *    updates heuristics, checks if cookieblock is needed, strips referers,
 *    checks if current page is disabled
 */
function onModifyRequest(event) {
  let channel = event.subject.QueryInterface(Ci.nsIHttpChannel);
  let isResponse = false;  // we're looking at a request

  // Update page action badge with current count
  if(prefs.displayCounter){
    pbUI.updateCountForChannel(channel);
  }


  if (ignoreRequest(channel)) { return; }

  // TODO: investigate moving blocking from ContentPolicy to here because we
  // have a nice way to get the top window from a channel.
  let aWin = utils.getTopWindowForChannel(channel);

  // If pb is disabled on the current page or if the third-party request is
  // explicitly allowed for this first-party, inject cookies into the channel
  // that would otherwise be blocked.
  if (ContentPolicy.Policy.isDisabledRequest(channel, aWin) ||
      ContentPolicy.Policy.isDomainException(channel.URI, aWin)) {
    let isSecure = channel.URI.schemeIs("https");
    if (!ContentPolicy.Policy.shouldCookieblockRequest(channel.URI, aWin)) {
      return;
    }
    let host = channel.URI.host;
    let cookieHeaderString =
      cookieUtils.toString(cookieUtils.getCookiesFromHost(host),
                           isResponse,
                           isSecure);
    if (cookieHeaderString) {
      console.log("Injecting blocked cookie for host", host, cookieHeaderString);
      channel.setRequestHeader("Cookie", cookieHeaderString, true);
    }
    return;
  }

  // Update the heuristic blocker
  isResponse = false;  // we're looking at a request
  if (isHeuristicEnabled()) {
    heuristicBlocker.updateHeuristicsForChannel(channel, aWin, isResponse);
  }

  // shouldCookieblockRequest emits cookieblock / usercookieblock / noaction.
  // TODO: Separate out event emitters so that this is more transparent.
  if (ContentPolicy.Policy.shouldCookieblockRequest(channel.URI, aWin)) {
    // Clear referer for all requests where we would clobber cookies.
    channel.setRequestHeader("Referer", "", false);
  }
}

/**
 * http-on-examine-response:
 *  If the user's default setting is to reject third party cookies, we
 *  should show them the third party cookies that have been rejected in the UI
 *  and do heuristic accounting so that we can fully block requests to tracking
 *  domains. The only sane way to do this seems to be by watching set-cookie
 *  headers, although that misses cookies set by js.
 */
function onExamineResponse(event) {
  let channel = event.subject.QueryInterface(Ci.nsIHttpChannel);

  // Block cookies from all DNT policy checks
  if (channel.originalURI.path === "/.well-known/dnt-policy.txt") {
    channel.setResponseHeader("Set-Cookie", "", false);
    console.log("REJECTED cookie from DNT policy check", channel.URI.host);
  }

  // TODO: Really do accounting on requests from disabled windows?
  if (ignoreRequest(channel)) { return; }

  let aWin = utils.getTopWindowForChannel(channel);

  let isResponse = true;
  if (isHeuristicEnabled()) {
    heuristicBlocker.updateHeuristicsForChannel(channel, aWin, isResponse);
  }
}

/**
 * Only here for logging right now. In theory, this could be used later
 * to record domains that are tracking users by setting cookies with js instead
 * of in set-cookie headers.
 */
function onCookieRejected(event) {
  if (event.subject.host) {
    console.log("REJECTED cookie from", event.subject.host);
  }
}

/**
 * Needed because Firefox treats domain-specific cookie behavior as exceptions
 * to the default cookie behavior. If the user's default cookie behavior is
 * set to "delete all cookies when browser closes", this won't apply to
 * cookies for domains where Privacy Badger has explicitly clobbered/allowed
 * cookies. So we need to clean up after ourselves by manually deleting the
 * cookies that we've changed.
 */
function onQuitApplicationGranted(/*event*/) {
  // Don't clear cookies in changedCookies that users want to persist
  let userPersistentCookies = cookieUtils.getUserPersistentCookies();
  console.log("Got application shutdown: deleting cookies!");
  for (let host in storage.changedCookies) {
    if (storage.changedCookies.hasOwnProperty(host) &&
        !userPersistentCookies.hasOwnProperty(host)) {
      console.log("clearing cookies for host:", host);
      cookieUtils.clearCookiesForHost(host);
    }
  }
}

/**
 * Determine if a request should be ignored in onModifyRequest
 * @param {nsIHttpChannel} channel
 * @return {Boolean}
 */
var ignoreRequest = function(channel) {
  // Ignore first party requests, whitelisted schemes
  if (!(ContentPolicy.Policy.isBlockableRequest(channel.URI, null, channel))) {
    return true;
  }

  // Ignore anything that the user has whitelisted
  if (ContentPolicy.Policy.isUserGreenRequest(channel.URI)) {
    return true;
  }

  // Debug
  if (ContentPolicy.Policy.isUserRedRequest(channel.URI)) {
    console.log("WARNING: request should have been blocked " +
		" (could be due to temporary social widget click unblock)", 
		channel.URI.spec);
    return true;
  }

  return false;
};

/*
 * Enable Privacy Badger from the PB panel. Not currently used by itself.
 */
function enable() {
  prefsListener.init();
  userStorage.init();
  privateBrowsing.init();

  if (isHeuristicEnabled()) {
    heuristicBlocker.init();
    userStorage.sync();
    policyCheck.init();
  }

  if (isSocialWidgetReplacementEnabled()) {
    socialWidgetHandler.init();
  }

  let categoryManager = Cc["@mozilla.org/categorymanager;1"]
                          .getService(Ci.nsICategoryManager);
  categoryManager.addCategoryEntry(
    "content-policy", "PrivacyBadgerContentPolicy",
    ContentPolicy.ContentPolicyFactory.contract, false, true);

  progressListener.onWindowOpen();
  windows.on("open", function(/*window*/) {
    progressListener.onWindowOpen();
  });

  events.on("http-on-modify-request", onModifyRequest, false);
  events.on("cookie-rejected", onCookieRejected, false);
  events.on("last-pb-context-exited", privateBrowsing.cleanup, false);

  if (isSocialWidgetReplacementEnabled()) {
    // Inject social widget replacer content script in each new tab
    tabs.on('ready', function(tab) {
      let worker = tab.attach({
        contentScriptFile: data.url("socialwidgets.js")
      });

      let aWin = utils.getWindowForSdkTab(tab);
      if (!aWin) { return; }

      // Store the worker so we can send messages to it from elsewhere
      pbUI.tabWorkers.set(aWin, worker);

      // Don't keep non-active workers
      worker.on('pageshow', function() {
        pbUI.tabWorkers.set(aWin, worker);
      });
      worker.on('pagehide', function() {
        pbUI.tabWorkers.delete(aWin);
      });

      // Respond to content script's query about which trackers have already been
      // blocked before the content script was attached
      worker.port.on("socialWidgetContentScriptReady", function(/*aWin*/) {
        let socialWidgetContentScriptData =
          socialWidgetHandler.getSocialWidgetContentScriptData(tab);
        if (!socialWidgetContentScriptData) { return null; }
        socialWidgetContentScriptData.socialWidgetReplacementEnabled =
          isSocialWidgetReplacementEnabled();
        worker.port.emit("socialWidgetContentScriptReady_Response",
                         socialWidgetContentScriptData);
      });

      worker.port.on("unblockSocialWidget", function(socialWidgetUrls) {
        socialWidgetHandler.unblockSocialWidgetOnTab(tab, socialWidgetUrls);
        worker.port.emit("unblockSocialWidget_Response");
      });

    });
  }

  // TODO call destroy() on global disable?
  pageMod.PageMod({
    //attachTo: ["existing", "frame"], // TODO
    include: "*",
    //exclude: "", // TODO exclude whitelisted pages
    contentScriptFile: data.url("fingerprinting.js"),
    contentScriptWhen: "start",
    onAttach: function (worker) {
      worker.port.on('fpReport', function (report) {
        if (Array.isArray(report)) {
          report.forEach(function (msg) {
            recordFingerprinting(worker.tab, msg);
          });
        } else {
          recordFingerprinting(worker.tab, report);
        }
      });
    }
  });


  // TODO call destroy() on global disable?
  pageMod.PageMod({
    //attachTo: ["existing", "frame"], // TODO
    include: "*",
    //exclude: "", // TODO exclude whitelisted pages
    contentScriptFile: data.url("supercookie.js"),
    contentScriptWhen: "start",
    onAttach: function (worker) {
      worker.port.on('superCookieReport', function (report) {
        console.log('***** SUPERCOOOKIE REPORT', report);
        if (Array.isArray(report)) {
          report.forEach(function (msg) {
            recordSupercookie(worker.tab, msg);
          });
        } else {
          recordSupercookie(worker.tab, report);
        }
      });
    }
  });

}

/**
 * Record supercookie reported by a content script
 * @param {Tab} tab tab object containing the scirpt
 * @param Object report report object with details about tracking
 */
function recordSupercookie(tab, report){
  let scriptURI = utils.makeURI(report.scriptUrl);
  let origin = utils.getBaseDomain(scriptURI);
  if (utils.isThirdPartyURI(report.scriptUrl, tab.url) &&
    !userStorage.isDisabledSite(tab.url, tab) &&
    !ContentPolicy.Policy.isDomainException(scriptURI, tab.window) ) {
      console.log('\n******', report.scriptUrl,'HAS SUPERCOOKIES ON', tab.url, '\n');
      settingsMap.supercookies = settingsMap.supercookies || {};
      settingsMap.supercookies[origin] = true;
      //TODO: this works but its hella dumb
      let channel = utils.getWindowForSdkTab(tab);
      let settings =  settingsMap.get(channel);
      if(settings[origin] == 'notracking'){
        settings[origin] = "noaction";
      }
      // Update page action badge with current count
      if(prefs.displayCounter){
        pbUI.updateCountForChannel({URI: scriptURI}, channel);
      }
  }
}

/**
 * Record  reported by a content script
 * @param {Tab} tab tab object containing the scirpt
 * @param Object report report object with details about tracking
 */
function recordFingerprinting(tab, report){
  let scriptURI = utils.makeURI(report.scriptUrl);
  let origin = utils.getBaseDomain(scriptURI);
  if (utils.isThirdPartyURI(report.scriptUrl, tab.url) &&
    !userStorage.isDisabledSite(tab.url, tab) &&
    !ContentPolicy.Policy.isDomainException(scriptURI, tab.window) &&
    report.extra && report.extra.canvas) {
      console.log('\n******', report.scriptUrl,'FINGERPRINTING CANVAS ON', tab.url, '\n');
      settingsMap.canvasTracking = settingsMap.canvasTracking || {};
      settingsMap.canvasTracking[origin] = true;
      //TODO: this works but its hella dumb
      let channel = utils.getWindowForSdkTab(tab);
      let settings =  settingsMap.get(channel);
      if(settings[origin] == 'notracking'){
        settings[origin] = "noaction";
      }
      // Update page action badge with current count
      if(prefs.displayCounter){
        pbUI.updateCountForChannel({URI: scriptURI}, channel);
      }
  }
}

/*
 * Disable Privacy Badger from the PB panel. This differs from disabling
 * Privacy Badger from about:addons because the addon button remains in the
 * toolbar, so PB can be easily re-enabled from its own panel. Not currently
 * used by itself.
 */
function disable() {
  prefsListener.cleanup();

  let categoryManager = Cc["@mozilla.org/categorymanager;1"]
                       .getService(Ci.nsICategoryManager);
  categoryManager.deleteCategoryEntry("content-policy",
                                      "PrivacyBadgerContentPolicy", false);


  events.off("http-on-modify-request", onModifyRequest, false);
  events.off("cookie-rejected", onCookieRejected, false);
  events.off("last-pb-context-exited", privateBrowsing.cleanup, false);
}

/*
 * Called when addon is loaded
 */
function main(options) {
  enable();
  console.log("Started up");

  // If this is the first run after install, display an informative page
  if (options) {
    // options is undefined when run with `cfx test`
    switch(options.loadReason) {
      case "install":
        tabs.open(data.url("firstRun.html"));
        break;
    }
  }
}

/*
 * Called when addon is unloaded. Not called on uninstall due to
 * https://bugzilla.mozilla.org/show_bug.cgi?id=627432.
 */
function unload(reason) {
  disable();
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
    cookieUtils.resetAll();
  }
  if (clearPrefs) {
    const prefService = require('sdk/preferences/service');
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
 * In case we add an option to disable social widget replacement
 */
function isSocialWidgetReplacementEnabled() {
  return prefs.socialWidgetReplacementEnabled;
}

/**
 * Empty all pb-related local storage but keep preloaded whitelist.
 */
function emptyData() {
  heuristicBlocker.empty();
  userStorage.empty();
  cookieUtils.resetAll();
}

exports.main = main;
exports.onUnload = unload;
exports.enable = enable;
exports.disable = disable;
exports.clearData = clearData;
exports.isHeuristicEnabled = isHeuristicEnabled;
exports.emptyData = emptyData;
exports.onExamineResponse = onExamineResponse;
exports.onQuitApplicationGranted = onQuitApplicationGranted;
