/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const { Ci } = require("chrome");
const { Class } = require("sdk/core/heritage");
const xpcom = require("sdk/platform/xpcom");
const { storage } = require("sdk/simple-storage");
const utils = require("./utils");
const tabs = require("sdk/tabs");
const { settingsMap } = require("./ui");
const { on, once, off, emit } = require('sdk/event/core');
const cookieUtils = require("./cookieUtils");

/**
 * ContentPolicy should implement the following policy for now:
 *
 *  * Accept requests that are first-party (corresponding to a top-level document)
 *      or have a whitelisted scheme.
 *
 *  * For non-first-party requests:
 *    * Reject requests on the userRed list.
 *    * Accept requests on the userYellow list (don't send cookies or referrers).
 *      It might be worthwhile to block some types though; not really sure yet.
 *    * Accept everything else
 *
 */

exports.ContentPolicy = Class({
  extends: xpcom.Unknown,
  interfaces: ["nsIContentPolicy"],

  shouldLoad: function(contentType, contentLocation, requestOrigin, node, mimeTypeGuess, extra)
  {
    // Ignore whitelisted schemes and whitelisted URLs
    let window = node ? utils.getWindowForContext(node) : null;

    if (!Policy.isBlockableRequest(contentLocation, window, contentType)) {
      return Ci.nsIContentPolicy.ACCEPT;
    }

    // This needs to go first because userRed has precedence over the checks in
    // shouldIgnoreRequest.

    if (Policy.isUserRedRequest(contentLocation, window)) {
      return Ci.nsIContentPolicy.REJECT_REQUEST;
    }

    // TODO: we might want to update the heuristics here, instead of in an
    // http-on-examine-response observer, since there's so much duplicated
    // work. Otherwise, we can combine this and the previous check with ||.

    if (Policy.shouldIgnoreRequest(contentLocation, window)) {
      return Ci.nsIContentPolicy.ACCEPT;
    }

    if (Policy.heuristicBlocksRequest(contentLocation, window)) {
      return Ci.nsIContentPolicy.REJECT_REQUEST;
    }

    return Ci.nsIContentPolicy.ACCEPT;
  },

  shouldProcess: function(contentType, contentLocation, requestOrigin, insecNode, mimeType, extra) {
    return Ci.nsIContentPolicy.ACCEPT;
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
let Policy = exports.Policy =
{

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
    "moz-icon"
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
  hasWhitelistedScheme: function(location) {
    return Policy.whitelistSchemes.indexOf(location.scheme) > -1;
  },

  /**
   * Checks whether a third party request is whitelisted due to one of the
   * following:
   *
   *  1. host is in userGreen
   *  2. host is in userYellow
   *  3. host is in the preloaded whitelist
   *
   * @param {nsIURI} location
   * @param {nsIDOMWindow} window
   * @return {String} name of "filter" that matched the URL or null if not whitelisted
   */
  isWhitelisted: function(location, window) {
    // Is the host in userGreen?
    if (location.host in storage.userGreen) {
      emit(settingsMap, "update-settings", "usernoaction", window, location.host);
      return "userGreen";
    }

    // Is the host in userYellow?
    if (location.host in storage.userYellow) {
      console.log("Emitting yellow: ", location.host);
      emit(settingsMap, "update-settings", "usercookieblock", window, location.host);
      return "userYellow";
    }

    // Is it on the preloaded whitelist?
    if (location.host in storage.preloads) {
      // Is it blocked by heuristic blocker?
      let origin = utils.getBaseDomain(location);
      if (origin in storage.blockedOrigins) {
        // Sites that are on the preloaded whitelist but are also blocked
        // by the heuristic should be cookieblocked.
        emit(settingsMap, "update-settings", "cookieblock", window, location.host);
        cookieUtils.clobberCookie(location.host);
      } else {
        emit(settingsMap, "update-settings", "noaction", window, location.host);
      }
      return "preloads";
    }
  },

  /**
   * Should this request even be considered for blocking? It needs to be:
   *
   *   1. associated with a document (not an internal load)
   *   2. third-party
   *
   * @param location {nsIURI}
   * @param window {nsIDOMWindow} the window corresponding to this request
   * @param contentType {nsContentPolicyType}
   * @return {Boolean}
   */
  isBlockableRequest: function(location, window, contentType) {
    // Document loads are always first-party
    if (contentType === Ci.nsIContentPolicy.TYPE_DOCUMENT)
      return false;

    // TODO: Check for third-partiness here so that we don't prevent users
    // from visiting top-level blocked URLs. TYPE_DOCUMENT can be cheated
    // using bugzilla bug #4677514.

    // Check if the scheme is whitelisted
    if (Policy.hasWhitelistedScheme(location))
      return false;

    return true;
  },

  /**
   * Checks whether this request should be ignored
   * @param location {nsIURI}
   * @param window {nsIDOMWindow} the window corresponding to this request
   * @return {Boolean}
   */
  shouldIgnoreRequest: function(location, window)
  {
    // TODO: do we need isWhitelisted? Could just move that logic in here.
    return Policy.isWhitelisted(location, window);
  },

  /**
   * Checks whether the site has been blocked by the heuristic blocker.
   * @param {nsIURI} location
   * @param {nsIDOMWindow} window
   * @return {Boolean}
   */
  heuristicBlocksRequest: function(location, window)
  {
    // TODO: do we need a separate shouldIgnoreRequest call in shouldLoad?
    // What if we just called it here instead (and returned false)?

    // Is the request's eTLD+1 on the heuristic blocklist?
    let origin = utils.getBaseDomain(location);
    if (origin in storage.blockedOrigins) {
      emit(settingsMap, "update-settings", "block", window, location.host);
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
    // Is the host in userRed?
    if (location.host in storage.userRed) {
      emit(settingsMap, "update-settings", "userblock", window, location.host);
      return true;
    }
    return false;
  },

  shouldBlockRequest: function(location, window)
  {
    return (this.isUserRedRequest(location, window) ||
            this.heuristicBlocksRequest(location, window));
  }
};

Policy.init();
