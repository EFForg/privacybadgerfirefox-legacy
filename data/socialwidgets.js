// Content script for replacing and temporary unblocking social media widgets,
// based on ShareMeNot

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/*
 * ShareMeNot is licensed under the MIT license:
 * http://www.opensource.org/licenses/mit-license.php
 *
 * Copyright (c) 2011-2014 University of Washington
 *
 * Permission is hereby granted, free of charge, to any person obtaining a
 * copy of this software and associated documentation files (the
 * "Software"), to deal in the Software without restriction, including
 * without limitation the rights to use, copy, modify, merge, publish,
 * distribute, sublicense, and/or sell copies of the Software, and to
 * permit persons to whom the Software is furnished to do so, subject to
 * the following conditions:
 *
 * The above copyright notice and this permission notice shall be included
 * in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
 * OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
 * IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
 * CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
 * TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
 * SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/

/**
 * The absolute path to the replacement buttons folder.
 */
let REPLACEMENT_BUTTONS_FOLDER_PATH = "skin/socialwidgets/";

/**
 * The absolute path to the stylesheet that is injected into every page.
 */
let CONTENT_SCRIPT_STYLESHEET_PATH = "skin/socialwidgets.css";

/**
 * The absolute URL to the content script folder within the extension.
 */
let contentScriptFolderUrl;

/**
 * Social widget tracker data, read from file.
 */
let trackerInfo = [];

/**
 * Initializes the content script.
 */
function initialize() {
  // set up listener for blocks that happen after initial check
  self.port.on("replaceSocialWidget", function(trackerDomain) {
    replaceSubsequentTrackerButtonsHelper(trackerDomain);
  });

  // get tracker info and check for initial blocks (that happened
  // before content script was attached)
  getTrackerData(function(contentScriptFolderUrl2,
                          trackers,
                          trackerButtonsToReplace,
                          socialWidgetReplacementEnabled) {

    if (!socialWidgetReplacementEnabled) { return; }

    contentScriptFolderUrl = contentScriptFolderUrl2;
    trackerInfo = trackers;

    // add the Content.css stylesheet to the page
    let head = document.querySelector("head");
    let stylesheetLinkElement = getStylesheetLinkElement(contentScriptFolderUrl +
                                                         CONTENT_SCRIPT_STYLESHEET_PATH);
    if (head) {
      head.appendChild(stylesheetLinkElement);
    }

    replaceInitialTrackerButtonsHelper(trackerButtonsToReplace);
  });
}

/**
 * Creates a replacement button element for the given tracker.
 *
 * @param {Tracker} tracker the Tracker object for the button
 *
 * @return {Element} a replacement button element for the tracker
 */
function createReplacementButtonImage(tracker) {
  let buttonData = tracker.replacementButton;

  let button = document.createElement("img");

  let buttonUrl = getReplacementButtonUrl(buttonData.imagePath);
  let buttonType = buttonData.type;
  let details = buttonData.details;

  button.setAttribute("src", buttonUrl);
  button.setAttribute("class", "privacyBadgerReplacementButton");
  button.setAttribute("title", "PrivacyBadger has replaced this " +
                      tracker.name + " button.");

  switch (buttonType) {
    case 0: // normal button type; just open a new window when clicked
      let popupUrl = details + encodeURIComponent(window.location.href);
      button.addEventListener("click", function() {
        window.open(popupUrl);
      });
      break;

    case 1: // in place button type; replace the existing button with an
            // iframe when clicked
      let iframeUrl = details + encodeURIComponent(window.location.href);
      button.addEventListener("click", function() {
        replaceButtonWithIframeAndUnblockTracker(button, buttonData.unblockDomains,
                                                 iframeUrl);
      }, true);
      break;

    case 2: // in place button type; replace the existing button with code
            // specified in the Trackers file
      button.savedClickListener = function() {
        replaceButtonWithHtmlCodeAndUnblockTracker(button,
                                                   buttonData.unblockDomains,
                                                   details);
      };
      button.addEventListener("click", button.savedClickListener, true);
      break;

    default:
      throw "Invalid button type specified: " + buttonType;
  }

  return button;
}

/**
 * Returns the absolute URL of a replacement button given its relative path
 * in the replacement buttons folder.
 *
 * @param {String} replacementButtonLocation the relative path of the
 * replacement button in the replacement buttons folder
 *
 * @return {String} the absolute URL of a replacement button given its relative
 * path in the replacement buttons folder
 */
function getReplacementButtonUrl(replacementButtonLocation) {
  return contentScriptFolderUrl + REPLACEMENT_BUTTONS_FOLDER_PATH +
    replacementButtonLocation;
}

/**
 * Returns a HTML link element for a stylesheet at the given URL.
 *
 * @param {String} URL the URL of the stylesheet to link
 *
 * @return {Element} the HTML link element for a stylesheet at the given URL
 */
function getStylesheetLinkElement(url) {
  let linkElement = document.createElement("link");

  linkElement.setAttribute("rel", "stylesheet");
  linkElement.setAttribute("type", "text/css");
  linkElement.setAttribute("href", url);

  return linkElement;
}

/**
 * Unblocks the given tracker and replaces the given button with an iframe
 * pointing to the given URL.
 *
 * @param {Element} button the DOM element of the button to replace
 * @param {Tracker} tracker the Tracker object for the tracker that should be
 *                          unblocked
 * @param {String} iframeUrl the URL of the iframe to replace the button
 */
function replaceButtonWithIframeAndUnblockTracker(button, tracker, iframeUrl) {
  unblockTracker(tracker, function() {
    // check is needed as for an unknown reason this callback function is
    // executed for buttons that have already been removed; we are trying
    // to prevent replacing an already removed button
    if (button.parentNode !== null) {
      let iframe = document.createElement("iframe");

      iframe.setAttribute("src", iframeUrl);
      iframe.setAttribute("class", "privacyBadgerOriginalButton");

      button.parentNode.replaceChild(iframe, button);
    }
  });
}

/**
 * Unblocks the given tracker and replaces the given button with the
 * HTML code defined in the provided Tracker object.
 *
 * @param {Element} button the DOM element of the button to replace
 * @param {Tracker} tracker the Tracker object for the tracker that should be
 *                          unblocked
 * @param {String} html the HTML code that should replace the button
 */
function replaceButtonWithHtmlCodeAndUnblockTracker(button, tracker, html) {
  unblockTracker(tracker, function() {
    // check is needed as for an unknown reason this callback function is
    // executed for buttons that have already been removed; we are trying
    // to prevent replacing an already removed button
    if (button.parentNode !== null) {
      let codeContainer = document.createElement("div");
      codeContainer.innerHTML = html;

      button.parentNode.replaceChild(codeContainer, button);

      replaceScriptsRecurse(codeContainer);

      button.removeEventListener("click", button.savedClickListener);
    }
  });
}

/**
 * Dumping scripts into innerHTML won't execute them, so replace them
 * with executable scripts.
 */
function replaceScriptsRecurse(node) {
  if (node.getAttribute && node.getAttribute("type") == "text/javascript") {
    let script  = document.createElement("script");
    script.text = node.innerHTML;
    script.src = node.src;
    node.parentNode.replaceChild(script, node);
  } else {
    let i = 0;
    let children = node.childNodes;
    while ( i < children.length) {
      replaceScriptsRecurse(children[i]);
      i++;
    }
  }
  return node;
}

/**
 * Replaces all tracker buttons on the current web page with the internal
 * replacement buttons, respecting the user's blocking settings.
 *
 * @param {Object} a map of Tracker names to Boolean values saying whether
 *                 those trackers' buttons should be replaced
 */
function replaceInitialTrackerButtonsHelper(trackerButtonsToReplace) {
  trackerInfo.forEach(function(tracker) {
    let replaceTrackerButtons = trackerButtonsToReplace[tracker.name];
    if (replaceTrackerButtons) {
      replaceIndividualButton(tracker);
    }
  });
}

/**
 * Individually replaces tracker buttons blocked after initial check.
 */
function replaceSubsequentTrackerButtonsHelper(trackerDomain) {
  trackerInfo.forEach(function(tracker) {
    let replaceTrackerButtons = (tracker.domain == trackerDomain);
    if (replaceTrackerButtons) {
      replaceIndividualButton(tracker);
    }
  });
}

/**
 * Actually do the work of replacing the button.
 */
function replaceIndividualButton(tracker) {
  console.log("replacing tracker button for " + tracker.name);

  // makes a comma separated list of CSS selectors that specify
  // buttons for the current tracker; used for document.querySelectorAll
  let buttonSelectorsString = tracker.buttonSelectors.toString();
  let buttonsToReplace =
    document.querySelectorAll(buttonSelectorsString);

  for (let i = 0; i < buttonsToReplace.length; i++) {
    let buttonToReplace = buttonsToReplace[i];

    let button =
      createReplacementButtonImage(tracker);

    buttonToReplace.parentNode.replaceChild(button, buttonToReplace);
  }
}

/**
* Gets data about which tracker buttons need to be replaced from the main
* extension and passes it to the provided callback function.
*
* @param {Function} callback the function to call when the tracker data is
*                            received; the arguments passed are the folder
*                            containing the content script, the tracker
*                            data, and a mapping of tracker names to
*                            whether those tracker buttons need to be
*                            replaced
*/
function getTrackerData(callback) {
  self.port.emit("socialWidgetContentScriptReady");
  self.port.once("socialWidgetContentScriptReady_Response", function(response) {
    let contentScriptFolderUrl = response.contentScriptFolderUrl;
    let trackers = response.trackers;
    let trackerButtonsToReplace = response.trackerButtonsToReplace;
    let socialWidgetReplacementEnabled = response.socialWidgetReplacementEnabled;

    callback(contentScriptFolderUrl, trackers, trackerButtonsToReplace, socialWidgetReplacementEnabled);
  });
}

/**
* Unblocks the tracker with the given name from the page. Calls the
* provided callback function after the tracker has been unblocked.
*
* @param {String} trackerName the name of the tracker to unblock
* @param {Function} callback the function to call after the tracker has
*                            been unblocked
*/
function unblockTracker(buttonUrls, callback) {
  self.port.emit("unblockSocialWidget", buttonUrls);
  self.port.on("unblockSocialWidget_Response", callback);
}

initialize();
