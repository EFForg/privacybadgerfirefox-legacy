"use strict";

const { Cc, Ci } = require("chrome");
const { storage } = require("sdk/simple-storage");
const { Request } = require("sdk/request");
const { Utils } = require("./abp/utils");

const cookieUtils = require("./cookieUtils");

/*
 * userRed: user chose to block requests to this domain entirely
 * userYellow: user chose to not send cookies/referers to this domain
 * userGreen: user chose to allow all requests to this domain
 * preloads: a preloaded whitelist of domains
 */

const preloadURL = "https://www.eff.org/files/sample_whitelist.txt";

const userStored = [ "userRed",
                     "userYellow",
                     "userGreen",
                     "preloads" ];

function handleSyncFail() {
  //#TODO: Do something here, like retry the request.
  console.log("Sync failed!");
}

/*
 * Take the preloaded whitelist and save it in local storage.
 * Updates every time user restarts browser session.
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
  console.log("ADDED red", JSON.stringify(storage.userRed));
};

exports.addYellow = function(host)
{
  storage.userYellow[host] = true;
  let location = Utils.makeURI(host);
  if (location) {
    cookieUtils.clobberCookie(location);
  }
  console.log("ADDED yellow", JSON.stringify(storage.userYellow));
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
  let location = Utils.makeURI(host);
  if (location) {
    cookieUtils.clobberCookie(location);
  }
};

exports.removeGreen = function(host) {
  delete storage.userGreen[host];
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
      storage[store] = {};
    }
  );
};
