/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const { Ci } = require("chrome");
const { Class } = require("sdk/core/heritage");
const xpcom = require("sdk/platform/xpcom");
let {Utils} = require("./abp/utils");
const tabs = require("sdk/tabs");
let {defaultMatcher} = require("./abp/matcher");
let {getHostname} = require("./abp/contentPolicy");
let {WhitelistFilter, BlockingFilter} = require("./abp/filterClasses");

/**
 * ContentPolicy does the work of blocking trackers.
 */

exports.pbContentPolicy = Class({
  extends: xpcom.Unknown,
  interfaces: ["nsIContentPolicy"],

  shouldLoad: function(contentType, contentLocation, requestOrigin, node, mimeTypeGuess, extra)
  {
    // Ignore whitelisted schemes and whitelisted URLs
    let location = contentLocation;
    if (Policy.shouldIgnoreRequest(location))
    {
      return Ci.nsIContentPolicy.ACCEPT;
    }

    let result = null;
    if (result)
    {
      // We didn't block this request so we will probably see it again in
      // http-on-opening-request. Keep it so that we can associate it with the
      // channel there - will be needed in case of redirect.
      this.previousRequest = [location, contentType];
    }
    return (result ? Ci.nsIContentPolicy.ACCEPT : Ci.nsIContentPolicy.REJECT_REQUEST);
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
  whitelistSchemes: [],

  /**
   * Called on module startup, initializes various exported properties.
   */
  init: function()
  {
    // whitelisted URL schemes
    this.whitelistSchemes = ["about",
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
                           "moz-icon"];
  },

  /**
   * Checks whether the location's scheme is blockable.
   * @param location  {nsIURI}
   * @return {Boolean}
   */
  isBlockableScheme: function(location)
  {
    return !(location.scheme in Policy.whitelistSchemes);
  },

  /**
   * Checks whether a page is whitelisted.
   * @param {String} url
   * @param {String} [parentUrl] location of the parent page
   * @return {Filter} filter that matched the URL or null if not whitelisted
   */
  isWhitelisted: function(url, parentUrl)
  {
    if (!url)
      return null;

    // Do not apply exception rules to schemes on our whitelistschemes list.
    let match = /^([\w\-]+):/.exec(url);
    if (match && match[1] in Policy.whitelistSchemes)
      return null;

    if (!parentUrl)
      parentUrl = url;

    // Ignore fragment identifier
    let index = url.indexOf("#");
    if (index >= 0)
      url = url.substring(0, index);

    let result = defaultMatcher.matchesAny(url, "DOCUMENT", getHostname(parentUrl), false);
    return (result instanceof WhitelistFilter ? result : null);
  },

  /**
   * Checks whether we should ignore the nsIURI when blocking or updating
   * heuristics.
   * @param location  {nsIURI}
   * @return {Boolean}
   */
  shouldIgnoreRequest: function(location)
  {
    return (!Policy.isBlockableScheme(location)
            || Policy.isWhitelisted(location.spec))
  }

};

Policy.init();
