"use strict";

const { Cc, Ci, Cu, Cr } = require("chrome");
const ThirdPartyUtil = Cc["@mozilla.org/thirdpartyutil;1"]
                       .getService(Ci.mozIThirdPartyUtil);
const Utils = require("./abp/utils");

/*
 * Tries to get the window associated with a channel. If it cannot, returns
 * null and logs an explanation to the console. This is not necessarily an
 * error, as many internal requests are not associated with a window, e.g. OCSP
 * or Safe Browsing requests.
 */
let getWindowForChannel = function(channel) {
  // Obtain an nsIDOMWindow from a channel
  let nc;
  try {
    nc = channel.notificationCallbacks ? channel.notificationCallbacks : channel.loadGroup.notificationCallbacks;
  } catch(e) {
    console.log("no loadgroup notificationCallbacks for " + channel.URI.spec);
    return null;
  }

  if (!nc) {
    console.log("no window for " + channel.URI.spec);
    return null;
  }

  let domWin;
  try {
    domWin = nc.getInterface(Ci.nsIDOMWindow);
  } catch(e) {
    console.log("No window associated with request: " + channel.URI.spec);
    return null;
  }

  if (!domWin) {
    console.log("failed to get DOMWin for " + channel.URI.spec);
    return null;
  }

  return domWin;
};

/*
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
 * Extracts the hostname from a URL (might return null).
 */
function getHostname(/**String*/ url) /**String*/
{
  try
  {
    return Utils.unwrapURL(url).host;
  }
  catch(e)
  {
    return null;
  }
}

exports.getBaseDomain = ThirdPartyUtil.getBaseDomain;
exports.isThirdPartyChannel = ThirdPartyUtil.isThirdPartyChannel;
exports.getTopWindowForChannel = getTopWindowForChannel;
exports.getHostname = getHostname;
