// Local storage for preloaded whitelist and user choices

"use strict";

const { Cc, Ci } = require("chrome");
const { storage } = require("sdk/simple-storage");
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
 * preloads: a preloaded whitelist of domains
 */

// TODO: Make preloadURL a pref.
const preloadURL = "https://www.eff.org/files/cookieblocklist.txt";
const backupPreloadURL = require("sdk/self").data.url("cookieblocklist.txt");

const userStored = [ "userRed",
                     "userYellow",
                     "userGreen",
                     "disabledSites",
                     "disabledSitesPrivate" ];

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

function syncPreloads(text) {
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

exports.syncPreloads = syncPreloads;

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
exports.clearOrigin = function(host) {
  exports.remove("red", host);
  exports.remove("yellow", host);
  exports.remove("green", host);
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
      if (store.indexOf("user") === 0) {
        storage[store] = {};
      }
    }
  );
};
exports.addToDisabledSites = function(url, context) {
  let host = ABPUtils.makeURI(url).host;
  doDependingOnIsPrivate("disabledSites",
                         function(store) { store[host] = true; },
                         context);
};
exports.removeFromDisabledSites = function(url, context) {
  let host = ABPUtils.makeURI(url).host;
  doDependingOnIsPrivate("disabledSites",
                         function(store) { delete store[host]; },
                         context);
};
exports.isDisabledSite = function(url, context) {
  let host;
  try {
    host = ABPUtils.makeURI(url).host;
  } catch(e) {
    // Sometimes URL is null or doesn't have a host
    return false;
  }
  function isDisabled(host) {
    return doDependingOnIsPrivate("disabledSites",
                                  function(store) { return (host in store); },
                                  context);
  }
  return (host ? isDisabled(host) : false);
};
