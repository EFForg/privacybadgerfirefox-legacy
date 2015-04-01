/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// Implementation of ContentPolicy

"use strict";

// Require main first to bootstrap. This prevents a race condition 
// in some cases. Notably in test/test-private-browsing.js
const main = require("./main");
const { Ci } = require("chrome");
const { Class } = require("sdk/core/heritage");
const xpcom = require("sdk/platform/xpcom");
const { storage } = require("sdk/simple-storage");
const utils = require("./utils");
const tabs = require("sdk/tabs");
const { settingsMap } = require("./ui");
const { on, once, off, emit } = require('sdk/event/core');
const cookieUtils = require("./cookieUtils");
const socialWidgetHandler = require("./socialWidgetHandler");
const userStorage = require("./userStorage");
const domainExceptions = require("./domainExceptions");

/**
 * ContentPolicy should implement the following policy for now:
 *
 *  * Accept requests that are first-party (corresponding to top-level document)
 *      or have a whitelisted scheme.
 *
 *  * For non-first-party requests, do the following in order:
 *    * Reject requests on the userRed list.
 *    * Accept requests on the userYellow/userGreen/preload lists.
 *    * Reject heuristic-blocked requests
 *    * Accept everything else
 */

const ACCEPT = Ci.nsIContentPolicy.ACCEPT;
const REJECT = Ci.nsIContentPolicy.REJECT_REQUEST;

exports.ContentPolicy = Class({
  extends: xpcom.Unknown,
  interfaces: ["nsIContentPolicy"],

  shouldLoad: function(contentType, contentLocation, requestOrigin, node,
                       mimeTypeGuess, extra)
  {
    // TODO: this is an unreliable way of getting the window. Often it fires
    // too early and returns about:blank.
    // See getBrowserForChannel in HTTPS Everywhere, it may be helpful for this.
    let window = node ? utils.getWindowForContext(node) : null;

    // Ignore whitelisted schemes and first-party documents
    if (!Policy.isBlockableRequest(contentLocation, window, null, contentType))
    {
      return ACCEPT;
    }

    // Ignore request from windows where Privacy Badger is disabled
    if (Policy.isDisabledRequest(null, window)) {
      return ACCEPT;
    }

    // Ignore request if it is a domain-specific exception on the current page
    if (Policy.isDomainException(contentLocation, window)) {
      return ACCEPT;
    }

    // Ignore requests after user has clicked social widget
    if (socialWidgetHandler.isSocialWidgetTemporaryUnblock(contentLocation,
                                                           window))
    {
      return ACCEPT;
    }

    // This needs to go first because userRed has precedence over the checks in
    // shouldIgnoreRequest. Emits userblock.
    if (Policy.isUserRedRequest(contentLocation, window)) {
      return REJECT;
    }

    // TODO: we might want to update the heuristics here, instead of in an
    // http-on-examine-response observer, since there's so much duplicated
    // work. Otherwise, we can combine this and the previous check with ||.

    // Finally, reject anything that the heuristic has blocked.
    // Emits usernoaction / usercookieblock / noaction / block.
    if (Policy.heuristicBlocksRequest(contentLocation, window)) {
      console.log("GOT BLOCK", contentLocation.spec);
      return REJECT;
    }
  
    if (Policy.isUserYellowRequest(contentLocation, window) ||
        Policy.isUserGreenRequest(contentLocation, window)) {
      // Allow domains that the user has set to green or yellow, this will
      // prevent the domain exception popup from firing twice. 
      return ACCEPT;
    }
    // Ignore anything else. Anything that makes it here goes on to be
    // considered for cookieblocking and heuristic accounting in the
    // http-on-modify-request listener.
    // If content would be blocked, check if we need to fire a popup.
    if (domainExceptions.pathInDomainExceptions(contentLocation.host + contentLocation.path)) {
      var domainInfo = domainExceptions.infoFromPath(contentLocation.spec);
      domainExceptions.injectPopupScript(domainInfo);
    }
    return ACCEPT;
  },

  shouldProcess: function(contentType, contentLocation, requestOrigin,
                          insecNode, mimeType, extra) {
    return ACCEPT;
  }
});


exports.ContentPolicyFactory = xpcom.Factory({
  Component: exports.ContentPolicy,
  contract: "@privacybadger/PrivacyBadgerContentPolicy",
  description: "Privacy Badger Content Policy"
});

/**
 * Public policy checking functions and auxiliary objects
 * @class
 */
var Policy = exports.Policy = {

  /**
   * Map containing all schemes that should be ignored by content policy.
   * @type Object
   */
  whitelistSchemes: [
    "about",
    "chrome",
    "file",
    "irc",
    "moz-safe-about",
    "news",
    "resource",
    "snews",
    "x-jsd",
    "addbook",
    "cid",
    "imap",
    "mailbox",
    "nntp",
    "pop",
    "data",
    "javascript",
    "moz-icon",
    "view-source"
  ],

  /**
   * Called on module startup, initializes various exported properties.
   * TODO: Add more stuff here?
   */
  init: function() {},

  /**
   * Checks whether the location's scheme is whitelisted.
   * @param location {nsIURI}
   * @return {Boolean}
   */
  _hasWhitelistedScheme: function(location) {
    return Policy.whitelistSchemes.indexOf(location.scheme) > -1;
  },

  /**
   * Should this request even be considered for blocking? It needs to be:
   *
   *   1. associated with a document (not an internal load)
   *   2. third-party
   *
   * @param location {nsIURI}
   * @param window {nsIDOMWindow}
   * @param channel {nsIHTTPChannel}
   * @param contentType {nsContentPolicyType}
   * @return {Boolean}
   */
  isBlockableRequest: function(location, window, channel, contentType) {
    // Check if the scheme is whitelisted
    if (Policy._hasWhitelistedScheme(location)) {
      return false;
    }

    // If a channel is provided, check if it's first party
    if (channel) {
      return utils.isThirdPartyChannel(channel);
    }

    // Document loads are always first-party
    if (contentType === Ci.nsIContentPolicy.TYPE_DOCUMENT) {
      return false;
    }

    // TODO: Check for third-partiness here so that we don't prevent users
    // from visiting top-level blocked URLs. TYPE_DOCUMENT can be cheated
    // using bugzilla bug #467514.
    let topWin = window.top;
    if (!topWin || !topWin.location || !topWin.location.href) {
      console.log("Couldn't get window.top for request:", location.spec);
      return false;
    }
    let topWinLocation = topWin.location.href;
    let isThirdParty = true;
    try {
      isThirdParty = utils.isThirdPartyURI(location.spec, topWinLocation);
    } catch (e) {
      console.log("Couldn't get party of: ", location.spec, e);
    }
    return isThirdParty;
  },

  /**
   * Is this request associated with a page where the user has disabled
   * privacy badger? This is called in on-modify-request in main.
   *
   * @param channel {nsIHTTPChannel}
   * @param window {nsIDOMWindow}
   * @return {Boolean}
   */
  isDisabledRequest: function(channel, window) {
    let topWin;
    if (window) {
      topWin = window.top;
    } else {
      topWin = utils.getTopWindowForChannel(channel);
    }
    if (!topWin || !topWin.location || !topWin.location.href) {
      if (channel) {
        console.log("Couldn't get top window for request:", channel.URI.spec);
      }
      return false;
    }
    return userStorage.isDisabledSite(topWin.location.href, topWin);
  },

  /**
   * Has the user chosen to unblock the domain associated with this request
   * only on the current page?
   * @param {nsIURI} location
   * @param {nsIDOMWindow} window
   * @return {Boolean}
   */
  isDomainException: function(location, window) {
    if (!window || !window.top || !window.top.location || !location.host) {
      return false;
    }
    let isException = userStorage.isDomainException(window.top.location.href,
                                                    location.host,
                                                    window);
    if (isException) {
      this._emitIfHostHasTracking(settingsMap, "update-settings",
                                  "usernoaction", window, location.host);
      return true;
    }
    return false;
  },

  /**
   * Is this request whitelisted by the preloaded whitelist? It or one of its
   * parent domains (ex: "maps.google.co.uk" or "google.co.uk" for
   * "api.maps.google.co.uk") must be on the list.
   *
   * @param {nsIURI} location
   * @param {nsIDOMWindow} window
   * @return {Boolean}
   */
  _isPreloadedWhitelistRequest: function(location, window) {
    let host = location.host;
    let status =
      utils.checkEachParentDomainString(location, function (parentHost) {
      return (parentHost in storage.preloads);
    });
    if (window && status && cookieUtils.canAccessCookies(location, null)) {
      this._emitIfHostHasTracking(settingsMap, "update-settings", "noaction",
                                  window, host);
    }
    return !!status;
  },

  /**
   * Is this request whitelisted because it has posted an acceptable DNT policy?
   *
   * @param {string} host
   * @param {nsIDOMWindow} window
   * @return {Boolean}
   */
  _isPolicyWhitelistRequest: function(location, window) {
    let host = location.host;
    if (window && (host in storage.policyWhitelist) &&
        cookieUtils.canAccessCookies(location, null)) {
      this._emitIfHostHasTracking(settingsMap, "update-settings", "noaction",
                                  window, host);
      return true;
    }
    return false;
  },

  /**
   * Only emit the event if the given location has cookies associated with it.
   * TODO: Put this somewhere else.
   *
   * @param {object} target
   * @param {string} type
   * @param {string} event
   * @param {nsIDOMWindow} window
   * @param {string} host
   * @return {Boolean}
   */
  _emitIfHostHasTracking: function(target, type, event, window, host) {
    let cookies = cookieUtils.getCookiesFromHost(host);
    if (cookies.hasMoreElements()) {
      emit(target, type, event, window, host);
      return true;
    }
    return false;
  },

  /**
   * Checks whether the site should be blocked according to heuristics
   * @param {nsIURI} location
   * @param {nsIDOMWindow} window
   * @return {Boolean}
   */
  heuristicBlocksRequest: function(location, window)
  {
    let self = this;
    let host = location.host;
    let origin = utils.getBaseDomain(location);

    // These conditions override heuristic blocking
    if (self.isUserGreenRequest(location, window) ||
        self.isUserYellowRequest(location, window) ||
        self._isPreloadedWhitelistRequest(location, window) ||
        self._isPolicyWhitelistRequest(location, window)) {
      return false;
    }

    // Is the request's base domain on the heuristic blocklist?
    if (origin in storage.blockedOrigins) {
      console.log("EMITTING BLOCK", location.spec);
      emit(settingsMap, "update-settings", "block", window, host);
      return true;
    }

    return false;
  },

  /**
   * Checks whether the site has been cookieblocked by the heuristic blocker.
   * @param {nsIURI} location
   * @param {nsIDOMWindow} window
   * @return {Boolean}
   */
  _heuristicCookieblocksRequest: function(location, window)
  {
    let host = location.host;
    let origin = utils.getBaseDomain(location);
    let self = this;

    // Is the request's base domain on the heuristic blocklist AND one of its
    // parent domains in the preloaded whitelist?
    // Example: if google.com is on the preloaded whitelist and also
    // is blocked by the heuristic, wallet.google.com gets cookieblocked
    if (self._isPreloadedWhitelistRequest(location, window)) {
      if ((origin in storage.blockedOrigins) && !self._isPolicyWhitelistRequest(location, window)) {
        emit(settingsMap, "update-settings", "cookieblock", window, host);
        // Block the cookie
        // TODO: this needs to be refactored so that this function doesn't have any side effects
        cookieUtils.clobberCookie(host);
        return true;
      }
    }
    return false;
  },

  /**
   * Checks whether the site should be cookie-blocked because a parent domain
   * has been blocked or cookie-blocked.
   */
  _subdomainCookieblocksRequest: function(location, window)
  {
    let host = location.host;
    let origin = utils.getBaseDomain(location);
    let self = this;
    //TODO: Cache these results
    function _isParentYellow() {
      return utils.checkEachParentDomainString(location, function(parentHost) {
        return (parentHost in storage.userYellow);
      }, true /*ignoreSelf*/);
    }
    function _isParentRed() {
      return utils.checkEachParentDomainString(location, function(parentHost) {
        return (parentHost in storage.userRed);
      }, true /*ignoreSelf*/);
    }
    if (_isParentYellow() || _isParentRed()) {
      if (window) {
        emit(settingsMap, "update-settings", "cookieblock", window, host);
      }
      cookieUtils.clobberCookie(host);
      return true;
    }
    return false;
  },

  /**
   * Checks whether the site has been blocked by the user.
   * @param {nsIURI} location
   * @param {nsIDOMWindow} window
   * @return {Boolean}
   */
  isUserRedRequest: function(location, window)
  {
    let host = location.host;
    if (host in storage.userRed) {
      if (window) {
        emit(settingsMap, "update-settings", "userblock", window, host);
      }
      return true;
    }
    return false;
  },

  /**
   * Checks whether the site has been cookieblocked by the user.
   * @param {nsIURI} location
   * @param {nsIDOMWindow} window
   * @return {Boolean}
   */
  isUserYellowRequest: function(location, window)
  {
    let host = location.host;
    if (host in storage.userYellow) {
      if (window) {
        emit(settingsMap, "update-settings", "usercookieblock", window, host);
      }
      return true;
    }
    return false;
  },

  /**
   * Checks whether the site is whitelisted by the user.
   * @param {nsIURI} location
   * @param {nsIDOMWindow} window
   * @return {Boolean}
   */
  isUserGreenRequest: function(location, window)
  {
    let host = location.host;
    if (host in storage.userGreen) {
      if (window) {
        this._emitIfHostHasTracking(settingsMap, "update-settings",
                                    "usernoaction", window, host);
      }
      return true;
    }
    return false;
  },

  /**
   * Checks whether the request should be cookieblocked. Used in the
   * onModifyRequest listener in main.
   * @param {nsIURI} location
   * @param {nsIDOMWindow} window
   * @return {Boolean}
   */
  shouldCookieblockRequest: function(location, window)
  {
    return (this.isUserYellowRequest(location, window) ||
            this._heuristicCookieblocksRequest(location, window) ||
            this._subdomainCookieblocksRequest(location, window));
  },

  /**
   * Returns what the state of a tracker would be if it weren't manually
   * set by the user.
   * @param {String} host
   * @return {String}
   */
  getOriginalState: function(host)
  {
    let self = this;
    let location = utils.makeURI("http://" + host);
    let origin = utils.getBaseDomain(location);
    let defaultAction = "noaction";
    if (!cookieUtils.canAccessCookies(location, null)) {
      defaultAction = "cookieblock";
    }
    if (self._isPolicyWhitelistRequest(location, null)) {
      return defaultAction;
    }
    if (origin in storage.blockedOrigins) {
      if (self._isPreloadedWhitelistRequest(location, null)) {
        return "cookieblock";
      } else {
        return "block";
      }
    }
    if (self._subdomainCookieblocksRequest(location, null)) {
      return "cookieblock";
    }
    return defaultAction;
  }
};

Policy.init();
