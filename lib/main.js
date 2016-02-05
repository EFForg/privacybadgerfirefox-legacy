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

var httpResponseObserver =
{
  observe: function(subject, topic /*, data*/)
  {
    if (topic == "http-on-examine-response" ||
       topic == "http-on-examine-cached-response" ||
       topic == "http-on-examine-merged-response") {
      var httpChannel = subject.QueryInterface(Ci.nsIHttpChannel);
      onExamineResponse(httpChannel);
    }
  },

  get observerService() {
    return Cc["@mozilla.org/observer-service;1"]
                     .getService(Ci.nsIObserverService);
  },

  register: function()
  {
    this.observerService.addObserver(this, "http-on-examine-response", false);
    this.observerService.addObserver(this, "http-on-examine-cached-response", false);
    this.observerService.addObserver(this, "http-on-examine-merged-response", false);
  },

  unregister: function()
  {
    this.observerService.removeObserver(this, "http-on-examine-response");
    this.observerService.removeObserver(this, "http-on-examine-cached-response");
    this.observerService.removeObserver(this, "http-on-examine-merged-response");
  }
};


/**
 *  http-on-modify-request:
 *    updates heuristics, checks if cookieblock is needed, strips referers,
 *    checks if current page is disabled
 */
function onModifyRequest(event) {
  let channel = event.subject.QueryInterface(Ci.nsIHttpChannel);

  // Update page action badge with current count
 if(prefs.displayCounter){
    pbUI.updateCountForChannel(channel);
  }


  // TODO: investigate moving blocking from ContentPolicy to here because we
  // have a nice way to get the top window from a channel.
  let aWin = utils.getTopWindowForChannel(channel);

  let cookieblock = ContentPolicy.Policy.shouldCookieblockRequest(channel.URI, aWin);
  if ( ignoreRequest(channel, false)) { return; }

  // If pb is disabled on the current page or if the third-party request is
  // explicitly allowed for this first-party, inject cookies into the channel
  // that would otherwise be blocked.
  if (ContentPolicy.Policy.isDisabledRequest(channel, aWin) ||
      ContentPolicy.Policy.isDomainException(channel.URI, aWin)) {
    return;
  }

  // Update the heuristic blocker
  if (utils.isHeuristicEnabled()) {
    heuristicBlocker.updateHeuristicsForChannel(channel, aWin);
  }

  // shouldCookieblockRequest emits cookieblock / usercookieblock / noaction.
  // TODO: Separate out event emitters so that this is more transparent.
  if (cookieblock){
    // Clear referer for all requests where we would clobber cookies.
    channel.setRequestHeader("Referer", "", false);
    channel.setRequestHeader("Cookie", "", false);
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
function onExamineResponse(channel) {
  // Block cookies from all DNT policy checks
  if(!channel.URI) { return; }
  if (channel.originalURI === "/.well-known/dnt-policy.txt") {
    channel.setResponseHeader("Set-Cookie", "", false);
  }


  let aWin = utils.getTopWindowForChannel(channel);

  let cookieblock = ContentPolicy.Policy.shouldCookieblockRequest(channel.URI, aWin);
  if ( ignoreRequest(channel, true)) { return; }

  let cookieString;
  try{
    cookieString = channel.getResponseHeader("set-cookie");
  } catch(e) {
    cookieString = null;
  }

  if (utils.isHeuristicEnabled()) {
    heuristicBlocker.updateHeuristicsForChannel(channel, aWin, cookieString);
  }
  if (cookieblock){
    // Clear cookie for all requests where we would clobber cookies.
    channel.setResponseHeader("Set-Cookie", "", false);
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
 * @param {Boolean} response Is this a response channel?
 * @return {Boolean}
 */
var ignoreRequest = function(channel, response) {
  // Ignore first party requests, whitelisted schemes
  if (!(ContentPolicy.Policy.isBlockableRequest(channel.URI, null, channel))) {
    return true;
  }

  // Ignore anything that the user has whitelisted
  if (ContentPolicy.Policy.isUserGreenRequest(channel.URI)) {
    return true;
  }

  if (ContentPolicy.Policy.isUserYellowRequest(channel.URI)) {
    if(response){
      channel.setResponseHeader("Set-Cookie", "", false);
    } else {
      channel.setRequestHeader("Referer", "", false);
      channel.setRequestHeader("Cookie", "", false);
    }
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

  if (utils.isHeuristicEnabled()) {
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
  events.on("last-pb-context-exited", privateBrowsing.cleanup, false);
  events.on("content-document-global-created", onContentDocumentGlobalCreated, false);
  /* For some reason the sdk/events api doesn't work with the examine-response event
   * so we have to do things the old fashioned way.
   */
  httpResponseObserver.register();

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

  pageMod.PageMod({
    // attachTo: ["existing", "frame"], // TODO
    include: "*",
    // exclude: userStorage.disabledSitesArray(), // TODO: this only gets called when the addon gets loaded and doesn't respond to changes
    contentScriptFile: [data.url("supercookie.js"), data.url("fingerprinting.js")],
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
      worker.port.on('superCookieReport', function (report) {
        if (Array.isArray(report)) {
          report.forEach(function (msg) {
            recordSupercookie(worker.tab, msg);
          });
        } else {
          recordSupercookie(worker.tab, report);
        }
      });
      worker.port.on('isCookieBlocked', function(location){
        let channel = utils.getWindowForSdkTab(worker.tab);
        let cookieblock = ContentPolicy.Policy.shouldCookieblockRequest(location, channel);
        worker.port.emit('cookieBlockStatus', cookieblock);
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
  if(!(report.scriptUrl && tab)){return false;}
  let scriptURI = utils.makeURI(report.scriptUrl);
  let origin = utils.getBaseDomain(scriptURI);
  let parentURI = utils.makeURI(tab.url);
  let parentOrigin = utils.getBaseDomain(parentURI);
  if (utils.isThirdPartyURI(report.scriptUrl, tab.url) &&
    !userStorage.isDisabledSite(tab.url, tab) &&
    !ContentPolicy.Policy.isDomainException(scriptURI, tab.window) ) {
      console.log('\n******', report.scriptUrl,'HAS SUPERCOOKIES ON', tab.url, '\n');
      pbUI.settingsMap.supercookies = pbUI.settingsMap.supercookies || {};
      pbUI.settingsMap.supercookies[origin] = true;
      heuristicBlocker.recordPrevalence(origin, parentOrigin, parentURI.host, tab);
      //TODO: this works but its hella dumb
      let channel = utils.getWindowForSdkTab(tab);
      let settings =  pbUI.settingsMap.get(channel);
      if(settings[origin] == 'notracking'){
        settings[origin] = "noaction";
      }
      // Update page action badge with current count
      if(prefs.displayCounter){
        pbUI.updateCountForChannel({URI: scriptURI}, channel);
      }
      heuristicBlocker.recordPrevalence(origin, parentOrigin, parentURI.host, tab);
  }
}

/**
 * Record  reported by a content script
 * @param {Tab} tab tab object containing the scirpt
 * @param Object report report object with details about tracking
 */
function recordFingerprinting(tab, report){
  if(!report.scriptUrl){return;}
  let scriptURI = utils.makeURI(report.scriptUrl);
  let origin = utils.getBaseDomain(scriptURI);
  let parentURI = utils.makeURI(tab.url);
  let parentOrigin = utils.getBaseDomain(parentURI);
  if (utils.isThirdPartyURI(report.scriptUrl, tab.url) &&
    !userStorage.isDisabledSite(tab.url, tab) &&
    !ContentPolicy.Policy.isDomainException(scriptURI, tab.window) &&
    report.extra && report.extra.canvas) {
      if(!testCanvasFingerprint(origin, report)){ return; }
      console.log('\n******', report.scriptUrl,'FINGERPRINTING CANVAS ON', tab.url, '\n');
      heuristicBlocker.recordPrevalence(origin, parentOrigin, parentURI.host, tab);
      //TODO: this works but its hella dumb
      let channel = utils.getWindowForSdkTab(tab);
      let settings =  pbUI.settingsMap.get(channel);
      if(settings[origin] == 'notracking'){
        settings[origin] = "noaction";
      }
      // Update page action badge with current count
      if(prefs.displayCounter){
        pbUI.updateCountForChannel({URI: scriptURI}, channel);
      }
  }
}

function testCanvasFingerprint(script_origin, msg){
  var CANVAS_WRITE = {
    fillText: true,
    strokeText: true
  };
  var CANVAS_READ = {
    getImageData: true,
    toDataURL: true
  };

  pbUI.settingsMap.canvasTracking = pbUI.settingsMap.canvasTracking || {};

  // initialize script TLD-level data
  if (!pbUI.settingsMap.canvasTracking.hasOwnProperty(script_origin)) {
    pbUI.settingsMap.canvasTracking[script_origin] = {
      canvas: {
        fingerprinting: false,
        write: false
      }
    };
  }
  var scriptData = pbUI.settingsMap.canvasTracking[script_origin];

  if (msg.extra.hasOwnProperty('canvas')) {
    if (scriptData.canvas.fingerprinting) {
      return true;
    }

    // if this script already had a canvas write
    if (scriptData.canvas.write) {
      // and if this is a canvas read
      if (CANVAS_READ.hasOwnProperty(msg.prop)) {
        // and it got enough data
        if (msg.extra.width > 16 && msg.extra.height > 16) {
          // let's call it fingerprinting
          scriptData.canvas.fingerprinting = true;
          return true;
        }
      }
      // this is a canvas write
    } else if (CANVAS_WRITE.hasOwnProperty(msg.prop)) {
      scriptData.canvas.write = true;
      return false;
    }
  } 
}

function onContentDocumentGlobalCreated(event){
  let aWin = event.subject; //nsIDOMWindow
  let host = aWin.document.location.host;
  if(!host || host === "") {return;}
  let topHost = aWin.top.document.location.host;
  let cookieblock = ContentPolicy.Policy.shouldCookieblockRequest(aWin.document.location, aWin);
  if(host != topHost && cookieblock ){
    var subScriptLoader = Cc["@mozilla.org/moz/jssubscript-loader;1"]
                          .getService(Ci.mozIJSSubScriptLoader);
    subScriptLoader.loadSubScript(data.url("clobbercookie.js"), aWin.document);
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
  events.off("last-pb-context-exited", privateBrowsing.cleanup, false);
  events.off("content-document-global-created", onContentDocumentGlobalCreated, false);
  httpResponseObserver.unregister();
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
        if(!require("sdk/preferences/service").isSet("extensions.privacybadger.disableFirstrunPage")){
            tabs.open(data.url("firstRun.html"));
        }
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
exports.emptyData = emptyData;
exports.onExamineResponse = onExamineResponse;
exports.onQuitApplicationGranted = onQuitApplicationGranted;
