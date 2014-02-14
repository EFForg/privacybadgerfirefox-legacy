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
const { settingsMap } = require("./settingsMap");
const { on, once, off, emit } = require('sdk/event/core');

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

exports.pbContentPolicy = Class({
  extends: xpcom.Unknown,
  interfaces: ["nsIContentPolicy"],

  shouldLoad: function(contentType, contentLocation, requestOrigin, node, mimeTypeGuess, extra)
  {
    // Ignore whitelisted schemes and whitelisted URLs
    let location = contentLocation;
    let aWindow = node ? utils.getWindowForContext(node) : null;

    if (Policy.shouldIgnoreRequest(location, aWindow))
    {
      return Ci.nsIContentPolicy.ACCEPT;
    }

    // TODO: Check for third-partiness here so that we don't prevent users
    // from visiting top-level blocked URLs. TYPE_DOCUMENT can be cheated
    // using bugzilla bug #4677514.

    if (contentType === Ci.nsIContentPolicy.TYPE_DOCUMENT)
    {
      return Ci.nsIContentPolicy.ACCEPT;
    }

    // This is where blocking happens for third party userRed/blockedOrigins

    if (location.hostname in storage.userRed) {
      emit(settingsMap, "update-settings", "userblock", aWindow, location.hostname);
      return Ci.nsIContentPolicy.REJECT_REQUEST;
    }

    if (location.hostname in storage.blockedOrigins) {
      emit(settingsMap, "update-settings", "block", aWindow, location.hostname);
      return Ci.nsIContentPolicy.REJECT_REQUEST;
    }

    return Ci.nsIContentPolicy.ACCEPT;

  },

  shouldProcess: function(contentType, contentLocation, requestOrigin, insecNode, mimeType, extra)
  {
    return Ci.nsIContentPolicy.ACCEPT;
  }
});

exports.pbContentPolicyFactory = xpcom.Factory({
  Component: exports.pbContentPolicy,
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
   * Checks whether a page is whitelisted. Right now this is just checking
   * whether the URL is allowed by sample_whitelist.txt and/or userGreen.
   * @param {nsIURI} location
   * @param {String} [parentUrl] location of the parent page
   * @return {String} name of "filter" that matched the URL or null if not whitelisted
   */
  isWhitelisted: function(location, aWin)
  {
    let url = location.spec;

    if (!url)
      return null;

    // Do not apply exception rules to schemes on our whitelistschemes list.
    let match = /^([\w\-]+):/.exec(url);
    if (match && match[1] in Policy.whitelistSchemes)
      return null;

    // Is the host in userGreen?
    if (location.hostname in storage.userGreen) {
      emit(settingsMap, "update-settings", "usernoaction", aWin, location.hostname);
      return "userGreen";
    }

    // Is it on the preloaded whitelist?
    if (location.hostname in storage.preloads) {
      emit(settingsMap, "update-settings", "noaction", aWin, location.hostname);
      return "preloads";
    }

    /*
    if (!parentUrl)
      parentUrl = url;

    // Ignore fragment identifier
    let index = url.indexOf("#");
    if (index >= 0)
      url = url.substring(0, index);

    let result = defaultMatcher.matchesAny(url, "DOCUMENT",
                                           utils.getHostname(parentUrl), false);

    return (result instanceof WhitelistFilter ? result : null);
   */
  },

  /**
   * Checks whether we should ignore the nsIURI when blocking or updating
   * heuristics.
   * @param location  {nsIURI}
   * @return {Boolean}
   */
  shouldIgnoreRequest: function(location, aWindow)
  {
    return (Policy.hasWhitelistedScheme(location)
            || Policy.isWhitelisted(location, aWindow));
  },

  /**
   * Checks whether the site has been blocked by the heuristic blocker.
   * @param location  {nsIURI}
   * @return {Boolean}
   */
  shouldBlockRequest: function(location)
  {
    return ((location.hostname in storage.userRed) ||
            (location.hostname in storage.blockedOrigins));
  }
};

Policy.init();
