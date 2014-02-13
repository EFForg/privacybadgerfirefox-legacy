"use strict";

const { Cc, Ci } = require("chrome");
const { storage } = require("sdk/simple-storage");

const cookieUtils = require("./cookieUtils");

/*
 * userRed: user chose to block requests to this domain entirely
 * userYellow: user chose to not send cookies/referers to this domain
 * userBlue: user chose to allow all requests to this domain
 * preloads: a preloaded whitelist of domains
 */

const preloadURL = "https://www.eff.org/files/sample_whitelist.txt";

const userStored = [ "userRed",
                     "userYellow",
                     "userBlue",
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
    let re = /^@@\|\|([^\/:]+)\^\$(.+)$/;
    let match = re.exec(items[i]);
    if (match) {
      storage.preloads[match[1]] = match[2];
      console.log("Adding to whitelist: "+match[1]);
    } else {
      console.log("WARNING: Got malformed preload "+items[i]);
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
  let request = Cc["@mozilla.org/xmlextras/xmlhttprequest;1"]
                  .createInstance();
  request.open("GET", preloadURL, true);
  request.send();
  request.onreadystatechange = function() {
    if (request.readyState == 4) {
      if (request.status == 200) {
        syncPreloads(request.responseText);
      } else {
        handleSyncFail();
      }
    }
  };
};

exports.addRed = function(host)
{
  storage.userRed[host] = true;
  removeYellow[host];
  removeBlue[host];
};

exports.addYellow = function(host)
{
  storage.userYellow[host] = true;
  cookieUtils.clobberCookie(host);
  removeRed[host];
  removeBlue[host];
};

exports.addBlue = function(host)
{
  storage.userBlue[host] = true;
  removeRed[host];
  removeYellow[host];
};

exports.removeRed = function(host) {
  delete storage.userRed[host];
};

exports.removeYellow = function(host) {
  delete storage.userYellow[host];
  cookieUtils.unclobberCookie(host);
};

exports.removeBlue = function(host) {
  delete storage.userBlue[host];
};

exports.clear = function()
{
  for (let host of storage.userYellow) {
    cookieUtils.unclobberCookie(host);
  }
  userStored.forEach(
    function(store)
    {
      storage[store] = {};
    }
  )
};
