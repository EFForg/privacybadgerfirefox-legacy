const { Cc, Ci } = require("chrome");
const { newURI } = require('sdk/url/utils');
const { storage } = require("sdk/simple-storage");
const testUtils = require("./testUtils");
const heuristicBlocker = require("./heuristicBlocker");

exports.testBlockOrigin = function(assert) {
  let origin = "localhost";
  heuristicBlocker.init();
  heuristicBlocker.blockOrigin(origin);
  assert.ok(storage.blockedOrigins.hasOwnProperty(origin));
};

exports.testUnblockOrigin = function(assert) {
  let origin = "localhost";
  heuristicBlocker.blockOrigin(origin);
  heuristicBlocker.unblockOrigin(origin);
  assert.ok(!storage.blockedOrigins.hasOwnProperty(origin));
};

exports.testHasTracking = function(assert){
  let channelInfo = {
    origin: 'localhost',
    parentOrigin: 'example.com'
  }
  let channel = {
    URI: newURI("http://localhost/")
  };

  let cookies = {test:"foo", privacy:"badger"};
  assert.ok(heuristicBlocker.hasTracking(channel,channelInfo,cookies), 
            "blocks high entropy cookies");

  let cookies = {test:"1", test2:"2", test3:"3"};
  assert.ok(heuristicBlocker.hasTracking(channel,channelInfo,cookies),
           "blocks multiple low entropy cookies");

  let cookies = {dnt:"1"};
  assert.ok(!heuristicBlocker.hasTracking(channel,channelInfo,cookies),
           "does not block < gMaxCookieEntropy bits of low entropy cookies");
};

require("sdk/test").run(exports);
