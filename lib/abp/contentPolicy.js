/*
 * This file is part of Adblock Plus <http://adblockplus.org/>,
 * Copyright (C) 2006-2013 Eyeo GmbH
 *
 * Adblock Plus is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * Adblock Plus is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Adblock Plus.  If not, see <http://www.gnu.org/licenses/>.
 */

/**
 * @fileOverview Content policy implementation, responsible for blocking things.
 */

const {Cu, Ci, Cr, Cc, Cm} = require("chrome");

Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://gre/modules/Services.jsm");


let {Utils} = require("./utils");

/**
 * List of explicitly supported content types
 * @type Array of String
 */
let contentTypes = ["OTHER", "SCRIPT", "IMAGE", "STYLESHEET", "OBJECT", "SUBDOCUMENT", "DOCUMENT", "XMLHTTPREQUEST", "OBJECT_SUBREQUEST", "FONT", "MEDIA"];

/**
 * List of content types that aren't associated with a visual document area
 * @type Array of String
 */
let nonVisualTypes = ["SCRIPT", "STYLESHEET", "XMLHTTPREQUEST", "OBJECT_SUBREQUEST", "FONT"];

/**
 * Randomly generated class name, to be applied to collapsed nodes.
 */
let collapsedClass = "";

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

exports.getHostname = getHostname;

/**
 * Retrieves the location of a window.
 * @param wnd {nsIDOMWindow}
 * @return {String} window location or null on failure
 */
function getWindowLocation(wnd)
{
  if ("name" in wnd && wnd.name == "messagepane")
  {
    // Thunderbird branch
    try
    {
      let mailWnd = wnd.QueryInterface(Ci.nsIInterfaceRequestor)
                       .getInterface(Ci.nsIWebNavigation)
                       .QueryInterface(Ci.nsIDocShellTreeItem)
                       .rootTreeItem
                       .QueryInterface(Ci.nsIInterfaceRequestor)
                       .getInterface(Ci.nsIDOMWindow);

      // Typically we get a wrapped mail window here, need to unwrap
      try
      {
        mailWnd = mailWnd.wrappedJSObject;
      } catch(e) {}

      if ("currentHeaderData" in mailWnd && "content-base" in mailWnd.currentHeaderData)
      {
        return mailWnd.currentHeaderData["content-base"].headerValue;
      }
      else if ("currentHeaderData" in mailWnd && "from" in mailWnd.currentHeaderData)
      {
        let emailAddress = Utils.headerParser.extractHeaderAddressMailboxes(mailWnd.currentHeaderData.from.headerValue);
        if (emailAddress)
          return 'mailto:' + emailAddress.replace(/^[\s"]+/, "").replace(/[\s"]+$/, "").replace(/\s/g, '%20');
      }
    } catch(e) {}
  }

  // Firefox branch
  return wnd.location.href;
}

/**
 * Checks whether the location's origin is different from document's origin.
 */
function isThirdParty(/**nsIURI*/location, /**String*/ docDomain) /**Boolean*/
{
  if (!location || !docDomain)
    return true;

  try
  {
    return Utils.effectiveTLD.getBaseDomain(location) != Utils.effectiveTLD.getBaseDomainFromHost(docDomain);
  }
  catch (e)
  {
    // EffectiveTLDService throws on IP addresses, just compare the host name
    let host = "";
    try
    {
      host = location.host;
    } catch (e) {}
    return host != docDomain;
  }
}

