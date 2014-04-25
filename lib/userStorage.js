// Local storage for preloaded whitelist and user choices

"use strict";

const { Cc, Ci } = require("chrome");
const { storage } = require("sdk/simple-storage");
const { Request } = require("sdk/request");
const ABPUtils = require("./abp/utils").Utils;
const cookieUtils = require("./cookieUtils");
const utils = require("./utils");
const timers = require("sdk/timers");

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
                     "preloads" ];

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
      if (count > 2) {
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
    }, 5000);
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
      console.log("Adding to whitelist: " + match[1]);
    } else {
      console.warn("Skipping malformed preload: " + items[i]);
    }
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
};

exports.sync = function()
{
  let preloadRequest = Request({
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

exports.addRed = function(host)
{
  storage.userRed[host] = true;
  exports.removeYellow(host);
  exports.removeGreen(host);
};

exports.addYellow = function(host)
{
  storage.userYellow[host] = true;
  cookieUtils.clobberCookie(host);
  exports.removeRed(host);
  exports.removeGreen(host);
};

exports.addGreen = function(host)
{
  storage.userGreen[host] = true;
  exports.removeRed(host);
  exports.removeYellow(host);
};

exports.removeRed = function(host) {
  delete storage.userRed[host];
};

exports.removeYellow = function(host) {
  delete storage.userYellow[host];
  cookieUtils.unclobberCookie(host);
};

exports.removeGreen = function(host) {
  delete storage.userGreen[host];
};

exports.clearOrigin = function(host) {
  exports.removeRed(host);
  exports.removeYellow(host);
  exports.removeGreen(host);
};

exports.clear = function()
{
  for (let host in storage.userYellow) {
    if (storage.userYellow.hasOwnProperty(host)) {
      cookieUtils.unclobberCookie(host);
    }
  }
  userStored.forEach(
    function(store)
    {
      delete storage[store];
    }
  );
};
exports.empty = function()
{
  for (let host in storage.userYellow) {
    if (storage.userYellow.hasOwnProperty(host)) {
      cookieUtils.unclobberCookie(host);
    }
  }
  userStored.forEach(
    function(store)
    {
      if (store !== "preloads") {
        storage[store] = {};
      }
    }
  );
};
exports.addToDisabledSites = function(url) {
  let host = ABPUtils.makeURI(url).host;
  storage.disabledSites[host] = true;
};
exports.removeFromDisabledSites = function(url) {
  let host = ABPUtils.makeURI(url).host;
  delete storage.disabledSites[host];
};
exports.isDisabledSite = function(url) {
  let host = ABPUtils.makeURI(url).host;
  return (host in storage.disabledSites);
};
