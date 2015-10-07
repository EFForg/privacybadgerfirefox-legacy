const { newURI } = require('sdk/url/utils');
const { storage } = require("sdk/simple-storage");
const hb = require("../lib/heuristicBlocker");
const userStorage = require("../lib/userStorage");
const prefsService = require("sdk/preferences/service");
userStorage.init();

// Set default cookie permissions
prefsService.set("network.cookie.lifetimePolicy", 0);

exports.testBlockOrigin = function(assert) {
  let origin = "localhost";
  hb.init();
  hb.blockOrigin(origin);
  assert.ok(storage.blockedOrigins.hasOwnProperty(origin));
};

exports.testUnblockOrigin = function(assert) {
  let origin = "localhost";
  hb.blockOrigin(origin);
  hb.unblockOrigin(origin);
  assert.ok(!storage.blockedOrigins.hasOwnProperty(origin));
};

exports.testHasTracking = function(assert){
  let channelInfo = {
    origin: 'localhost',
    parentOrigin: 'example.com'
  };
  let channel = {
    URI: newURI("http://localhost/")
  };

  let cookies = { test:"foo", privacy:"badger" };
  assert.ok(hb.hasTracking(channel,channelInfo,cookies),
            "blocks high entropy cookies");

  cookies = { test:"1", test2:"2", test3:"3" };
  assert.ok(hb.hasTracking(channel,channelInfo,cookies),
           "blocks multiple low entropy cookies");

  cookies = { dnt:"1" };
  assert.ok(!hb.hasTracking(channel,channelInfo,cookies),
           "does not block < gMaxCookieEntropy bits of low entropy cookies");
};

exports.testGetAction = function(assert){
  let channelInfo, channelCookies, channel;

  channelInfo = {
    origin: 'localhost.com',
    parentOrigin: 'example.com'
  };
  channel = {
    URI: newURI("http://localhost.com/")
  };

  channelCookies = { dnt:"1" };
  assert.ok(
    hb.getAction(channel, channelInfo, channelCookies) === "notracking"
  );

  channelCookies = { test:"1", test2:"2", test3:"3" };
  assert.ok(
    hb.getAction(channel, channelInfo, channelCookies) === "noaction"
  );

  let preloadText = "@@||localhost.com^$third-party\n";
  userStorage.syncPreloads(preloadText);
  assert.equal(
    hb.getAction(channel, channelInfo, channelCookies), "cookieblock"
  );

  channelCookies = { dnt:"1" };
  // Regression test for #551
  // Set cookie preferences to "block all cookies"
  prefsService.set("network.cookie.cookieBehavior", 2);
  assert.ok(
    hb.getAction(channel, channelInfo, channelCookies) === "notracking"
  );
  
  // Set cookie preferences to "block third party cookies"
  prefsService.set("network.cookie.cookieBehavior", 1);
  assert.ok(
    hb.getAction(channel, channelInfo, channelCookies) === "notracking"
  );

};

require("sdk/test").run(exports);
prefsService.set("network.cookie.lifetimePolicy", 0);
