// Utils for Privacy Badger

"use strict";

const { Cc, Ci, Cu, Cr } = require("chrome");
const ThirdPartyUtil = Cc["@mozilla.org/thirdpartyutil;1"]
                       .getService(Ci.mozIThirdPartyUtil);
const ABPUtils = require("./abp/utils").Utils;

Cu.import("resource://gre/modules/Services.jsm");
const eTLDService = Services.eTLD;

/**
 * Tries to get the window associated with a channel. If it cannot, returns
 * null and logs an explanation to the console. This is not necessarily an
 * error, as many internal requests are not associated with a window, e.g. OCSP
 * or Safe Browsing requests.
 */

let getWindowForChannel = function(channel) {
  let nc;
  try {
    nc = channel.notificationCallbacks ? channel.notificationCallbacks : channel.loadGroup.notificationCallbacks;
  } catch(e) {
    console.log("ERROR missing loadgroup notificationCallbacks for " + channel.URI.spec);
    return null;
  }
  if (!nc) {
    console.log("ERROR no loadgroup notificationCallbacks for " + channel.URI.spec);
    return null;
  }

  let loadContext;
  try {
    loadContext = nc.getInterface(Ci.nsILoadContext);
  } catch(ex) {
    try {
      loadContext = channel.loadGroup.notificationCallbacks
        .getInterface(Ci.nsILoadContext);
    } catch(ex) {
      console.log("ERROR missing loadcontext", channel.URI.spec, ex.name);
      return null;
    }
  }

  let contentWindow = loadContext.associatedWindow;
  if (!contentWindow) {
    console.log("WARN no associated window for", channel.URI.spec);
  }
  return contentWindow;
}

/**
 * Returns the top window in the given channel's associated window hierarchy.
 */
let getTopWindowForChannel = function(channel) {
  let win = getWindowForChannel(channel);
  if (win) {
    return win.top;
  }
  return null;
};

/**
 * Gets the most recent nsIDOMWindow
 */
function getMostRecentWindow() {
  var wm = Cc["@mozilla.org/appshell/window-mediator;1"]
             .getService(Ci.nsIWindowMediator);
  return wm.getMostRecentWindow("navigator:browser");
}

var tabUtils = require("sdk/tabs/utils");

function getMostRecentContentWindow() {
  var tab = tabUtils.getSelectedTab(getMostRecentWindow());
  return tabUtils.getTabContentWindow(tab);
}

/**
 * Reloads the current tab
 */
var tabs = require("sdk/tabs");

function reloadCurrentTab() {
  return tabs.activeTab.reload();
}

/**
 * Extracts the hostname from a URL (might return null).
 */
function getHostname(url)
{
  try
  {
    return ABPUtils.unwrapURL(url).host;
  }
  catch(e)
  {
    return null;
  }
}

/**
 * Get the nsIDOMWindow that corresponds to a shouldLoad context.
 * Feels like throwing spaghetti at a wall but whatevs.
 */
function getWindowForContext(aContext) {
  if (aContext instanceof Ci.nsIDOMWindow) {
    return aContext;
  } else if (aContext instanceof Ci.nsIDOMNode) {
    return aContext.ownerDocument ? aContext.ownerDocument.defaultView
                                  : aContext.defaultView;
  }

  try {
    return aContext.QueryInterface(Ci.nsIHttpChannel);
  } catch(e) {
    return null;
  }
}

/**
 * Compares a request's URI with the URI of its parent document and returns
 * true if it is a third party request.
 * Note that this and other third party checks use the base domain.
 * @param uri {String}
 * @param docUri {String}
 * @return {Boolean}
 */
exports.isThirdPartyURI = function(uri, docUri) {
  var uri = ABPUtils.makeURI(uri);
  var docUri = ABPUtils.makeURI(docUri);
  return ThirdPartyUtil.isThirdPartyURI(uri, docUri);
}

/**
 * getBaseDomain - for "www.bbc.co.uk", this would be "bbc.co.uk" (the eTLD+1)
 * Note that this fails for domains with a leading dot (some raw hosts)
 * @param {nsIURI}
 * @return {UTF8String}
 */
exports.getBaseDomain = ThirdPartyUtil.getBaseDomain;

/**
 * getParentDomain - for "www.radio.bbc.co.uk," this would be "radio.bbc.co.uk"
 * for "bbc.co.uk," this would be bbc.co.uk.
 * @param {nsIURI}
 * @return {UTF8String}
 */
exports.getParentDomain = function(uri) {
  let suffix = eTLDService.getPublicSuffix(uri);
  let suffixLength = suffix.split('.').length;
  let hostArray = uri.host.split('.');

  // is this already an eTLD+1 or an eTLD+2? return the eTLD+1
  if (hostArray.length - suffixLength < 3) {
    return eTLDService.getBaseDomain(uri);
  }

  // eat away at the left
  return hostArray.slice(1).join('.');
}

/**
 * isThirdPartyChannel
 * @param {nsIChannel}
 * @return {Boolean}
 */
exports.isThirdPartyChannel = function(channel) {
  try { return ThirdPartyUtil.isThirdPartyChannel(channel); }
  catch(e) {
    return false;
  }
};

exports.getWindowForChannel = getWindowForChannel;
exports.getMostRecentWindow = getMostRecentWindow;
exports.getMostRecentContentWindow = getMostRecentContentWindow;
exports.getTopWindowForChannel = getTopWindowForChannel;
exports.getHostname = getHostname;
exports.getWindowForContext = getWindowForContext;
exports.reloadCurrentTab = reloadCurrentTab;
