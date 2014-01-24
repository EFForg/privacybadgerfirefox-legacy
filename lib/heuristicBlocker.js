"use strict";

const { Cc, Ci } = require("chrome");
const { newURI } = require('sdk/url/utils');
const utils = require("utils.js");

/*
 * Determine if a request should not be considered in the blocker accounting
 * (e.g. it is an internal protocol)
 */
let ignoreRequest = function(request) {
  // TODO: decide what to ignore here (about://, chrome://, etc.)
  return false;
}

/*
 * Returns useful information about this channel.
 *
 * {
 *   origin: "",       // The domain (eTLD+1) of this request
 *   party: "",        // first|third (in the context of its parents in the
 *                        window hierarchy)
 *   parentOrigin: "", // If this domain is third-party, the parent's
 *                        (first-party) domain
 * }
 *
 * Returns null if the channel could not be introspected. This can happen for
 * requests that are not associated with a window (e.g. OCSP, Safe Browsing).
 */
let getChannelInfo = function(channel) {
  let win = utils.getTopWindowForChannel(channel);
  // Ignore requests that are outside a tabbed window
  if (win == null) return null;

  let info = {};
  info.origin = utils.getBaseDomain(channel.URI);

  try {
    if (utils.isThirdPartyChannel(channel)) {
      info.party = "third";
    } else {
      info.party = "first";
    }
  } catch (e) {
    // If this logic failed, we can't determine the party of the request
    console.log("isThirdPartyChannel threw exception for " + channel.URI.spec);
    return null;
  }

  if (info.party === "third") {
    try {
      // use win.document.URL, instead of win.location, because win.location
      // can be modified by scripts.
      info.parentOrigin = utils.getBaseDomain(newURI(win.document.URL));
    } catch (e) {
      console.log("error getting base domain from third party request " + channel.URI.spec);
      return null;
    }
  } else {
    info.parentOrigin = null;
  }

  return info;
}

/*
 * Update internal accounting data structures with this request.
 * Returns true if we updated the blocker's data structures.
 */
let updateHeuristics = function(channel) {
  if (ignoreRequest(channel)) return false;

  let channelInfo = getChannelInfo(channel);
  if (channelInfo == null) {
    // for whatever reason, we couldn't introspect this channel. Check the console.
    return false;
  }
  console.log(channelInfo);
  return true;
}

exports.updateHeuristics = updateHeuristics;
