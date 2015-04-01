// Local storage for preloaded whitelist and user choices

"use strict";

const { Cc, Ci } = require("chrome"); const { storage } = require("sdk/simple-storage");
const { Request } = require("sdk/request");
const ABPUtils = require("./abp/utils").Utils;
const cookieUtils = require("./cookieUtils");
const utils = require("./utils");
const timers = require("sdk/timers");
const { doDependingOnIsPrivate } = require("./privateBrowsing");

/**
 * userRed: user chose to block requests to this domain entirely
 * userYellow: user chose to not send cookies/referers to this domain
 * userGreen: user chose to allow all requests to this domain
 * disabledSites: first-party domains where user chose to disable PB by default
 * domainExceptions: first-party domains where user has set an exception to
 *   the default behavior for a tracker. ex:
 *   { "www.example.com": { "disqus.com" : "noaction",
 *                          "api.facebook.com": "noaction" } }
 *   For the forseeable future, the only exception setting should be "noaction"
 *   (for unblocking a tracker so that user can login to a site).
 */

// TODO: Make preloadURL a pref.
const preloadURL = "https://www.eff.org/files/cookieblocklist.txt";
const backupPreloadURL = require("sdk/self").data.url("cookieblocklist.txt");
const domainExceptionURL =
  "https://www.eff.org/files/domain_exception_list.json";
const backupDomainExceptionURL =
  require("sdk/self").data.url("domain_exception_list.json");

const userStored = [ "userRed",
                     "userYellow",
                     "userGreen",
                     "disabledSites",
                     "disabledSitesPrivate",
                     "domainExceptions",
                     "domainExceptionsPrivate" ];

storage.domainExceptionSites = {};

function handleSyncFail() {
  // We couldn't get a successful request to the cookie blocklist URL, so
  // try loading it from a file included in the profile directory.
  console.log("Cookie blocklist sync failed. Trying to read from local copy.");
  let preloadRequest = Request({
    url: backupPreloadURL,
    onComplete: function(response) {
      if (response.status == 200) {
        syncPreloads(response.text);
      } else {
        console.log("NOOOooo COULD NOT READ LOCAL COPY EITHER");
      }
    }
  }).get();
  // Keep trying 3 times to sync to the remote cookie blocklist.
  let count = 0;
  function resync() {
    timers.setTimeout(function () {
      count++;
      if (count > 19) {
        console.log("Gave up trying to sync cookie blocklist.");
        return;
      }
      console.log("Resync attempt:", count);
      let preloadRequest = Request({
        url: preloadURL,
        onComplete: function(response) {
          if (response.status == 200) {
            syncPreloads(response.text);
          } else {
            resync();
          }
        }
      }).get();
    }, 300000);
  }
  resync();
}

/**
 * Take the preloaded whitelist and save it in local storage.
 * Updates every time user restarts browser session or activates PB.
 *
 * @param {string} text
 * @return {object}
 */
var syncPreloads = exports.syncPreloads = function(text) {
  var items = text.split('\n');
  for (let i=0; i<items.length; i++) {
    let item = items[i];
    if (item === "") continue; // Skip blank lines

    // ABP third-party filters: https://adblockplus.org/en/filters
    let re = /^@@\|\|([^\/:]+)\^\$(.+)$/;
    let match = re.exec(items[i]);

    if (match) {
      storage.preloads[match[1]] = match[2];
    } else {
      console.warn("Skipping malformed preload: " + items[i]);
    }
  }
}
// Saves the list of URLs on which to prompt user to add a domain exception
function syncExceptions(json) {
  storage.domainExceptionSites = json ||
                                 storage.domainExceptionSites;
  if (Object.keys(storage.domainExceptionSites)) {
    // Load page-mod UI
    require("./domainExceptions");
  }
}

exports.init = function()
{
  userStored.forEach(
    function(store)
    {
      if (!storage[store]) storage[store] = {};
    }
  );
  // Keeps track of hosts for which we've overriden default cookie settings so
  // we can reset these if needed on uninstall and when user wants to clear
  // settings manually. Also allows us to delete the cookies that we've added
  // as exceptions if the user's default behavior is to clear cookies when
  // browser closes.
  if (!storage.changedCookies) {
    storage.changedCookies = {};
  }
  // Preloaded whitelist of domains to cookieblock rather than block entirely
  if (!storage.preloads) {
    storage.preloads = {};
  }
};

exports.sync = function()
{
  Request({
    url: preloadURL,
    onComplete: function(response) {
      if (response.status == 200) {
        syncPreloads(response.text);
      } else {
        handleSyncFail();
      }
    }
  }).get();
  Request({
    url: domainExceptionURL,
    onComplete: function(response) {
      if (response.status == 200) {
        syncExceptions(response.json);
      } else {
        console.error("Error: could not get", domainExceptionURL);
      }
    }
  }).get();
};

/**
 * Save to or remove from userRed/Yellow/Green
 * @param {string} color "red", "yellow", or "green"
 * @param {string} host
 */
let add = exports.add = function(color, host)
{
  let storeName;
  switch(color) {
    case "red":
      storeName = "userRed";
      remove("yellow", host);
      remove("green", host);
      break;
    case "yellow":
      storeName = "userYellow";
      remove("red", host);
      remove("green", host);
      cookieUtils.clobberCookie(host);
      break;
    case "green":
      storeName = "userGreen";
      remove("red", host);
      remove("yellow", host);
      cookieUtils.allowCookie(host);
  }
  storage[storeName][host] = true;
};
let remove = exports.remove = function(color, host)
{
  let storeName;
  switch(color) {
    case "red":
      storeName = "userRed";
      break;
    case "yellow":
      storeName = "userYellow";
      cookieUtils.resetCookie(host);
      break;
    case "green":
      storeName = "userGreen";
      cookieUtils.resetCookie(host);
  }
  delete storage[storeName][host];
};

// Called when user clicks on "undo" button in panel
exports.resetOrigin = function(host, window) {
  exports.remove("red", host);
  exports.remove("yellow", host);
  exports.remove("green", host);
  if (!window) { return; }
  if (exports.isDomainException(window.location.href, host, window)) {
    exports.removeFromDomainExceptions(window.location.href, host, window);
  }
};


// Helper to try and reset all the cookies that the user has set.
// TODO: Would be cleaner to add a flag to changedCookies that marks
// whether a cookie was set by the user or by the heuristic blocker.
function _clearUserCookieSettings() {
  for (let host in storage.userGreen) {
    if (storage.userGreen.hasOwnProperty(host)) {
      cookieUtils.resetCookie(host);
    }
  }
  for (let host in storage.userYellow) {
    if (storage.userYellow.hasOwnProperty(host)) {
      cookieUtils.resetCookie(host);
    }
  }
}
exports.clear = function()
{
  _clearUserCookieSettings();
  userStored.forEach(
    function(store)
    {
      delete storage[store];
    }
  );
};
exports.empty = function()
{
  _clearUserCookieSettings();
  userStored.forEach(
    function(store)
    {
      // Don't clear disabledSites
      if (store.indexOf("disabled") !== 0) {
        storage[store] = {};
      }
    }
  );
};
exports.addToDisabledSites = function(url, context) {
  let host = ABPUtils.makeURI(url).host;
  doDependingOnIsPrivate("disabledSites", function(store) {
    store[host] = true; 
  }, context);
};

/**
 * Unblock a tracker on a specific domain
 * @param {String} url The tracker to unblock
 * @param {String} trackingHost The domain to unblock the tracker on
 * @param {Object} context The object that should be used for context - usually `this`
 */
exports.addToDomainExceptions = function(url, trackingHost, context) {
  let host = ABPUtils.makeURI(url).host; 
  doDependingOnIsPrivate("domainExceptions", function(store) {
    if (!store[host]) { store[host] = {}; }
    store[host][trackingHost] = "noaction";
  }, context);
};

/**
 * Re-enable privacy badger on a specific site
 * @param {String} url The site to enable
 * @param {Object} context The object that should be used for context - usualy `this`
 */
exports.removeFromDisabledSites = function(url, context) {
  let host = ABPUtils.makeURI(url).host;
  doDependingOnIsPrivate("disabledSites", function(store) { 
    delete store[host]; 
  }, context);
};

/**
 * Remove a domain exception that the user made.
 * @param {String} url The site to enable
 * @param {String} trackingHost The domain to unblock the tracker on
 * @param {Object} context The object that should be used for context - usualy `this`
 */
exports.removeFromDomainExceptions = function(url, trackingHost, context) {
  let host = ABPUtils.makeURI(url).host; 
  doDependingOnIsPrivate("domainExceptions", function(store) {
    if (!store[host]) { return; }
    delete store[host][trackingHost];
    // If store[host] is now empty, delete the entry
    if (Object.keys(store[host]).length === 0) {
      delete store[host];
    }
  });
};

/**
 * Check if a domain is disabled
 * @param {String} url The site to check
 * @param {Object} context The object that should be used for context - usualy `this`
 */
exports.isDisabledSite = function(url, context) {
  let host;
  try {
    host = ABPUtils.makeURI(url).host;
  } catch(e) {
    // Sometimes URL is null or doesn't have a host
    return false;
  }
  function isDisabled(host) {
    return doDependingOnIsPrivate("disabledSites", function(store) { 
      return (store.hasOwnProperty(host)); 
    }, context);
  }
  return (host ? isDisabled(host) : false);
};

/**
 * Check if the user has made an exception for a domain on a specific site
 * @param {String} url The url to check
 * @param {String} trackingHost The domain to unblock the tracker on
 * @param {Object} context The object that should be used for context - usualy `this`
 */
exports.isDomainException = function(url, trackingHost, context) {
  let host;
  try {
    host = ABPUtils.makeURI(url).host;
  } catch(e) {
    // Sometimes URL is null or doesn't have a host
    return false;
  }
  if (!host || !trackingHost) { 
    return false; 
  }
  // Exception applies if the tracker domain or one of its parents is in the
  // set of exceptions for URL
  return doDependingOnIsPrivate("domainExceptions", function(store) {
    if (!store[host]) { return false; }
    let trackingLocation = ABPUtils.makeURI(
      "http://" + trackingHost);
    return utils.checkEachParentDomainString(
      trackingLocation,
      function(tl) {
        return (store[host] && store[host].hasOwnProperty(tl));
      }
    );
  }, context);
};
