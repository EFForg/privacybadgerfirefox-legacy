const events = require("sdk/system/events");
const { storage } = require("sdk/simple-storage");
const windows = require("sdk/windows").browserWindows;
const { before, after } = require("sdk/test/utils");
const main = require("./main");

// Site that sets a third party cookie
const TEST_URL = "http://en.support.wordpress.com/third-party-cookies/";
const TEST_COOKIE_HOST = "wptpc.com";

function setup() { main.main(); }
function teardown() {
  main.clearData(true, true);
  main.onUnload("disabled");
}

// Test non-private window
exports.testNonPrivate = function(assert, done) {
  setup();
  let aWin = windows.open({
    url: TEST_URL,
    isPrivate: false,
    onOpen: function() {
      aWin.tabs.on("ready", function(tab) {
        if (tab.url === TEST_URL) {
          assert.ok(storage.originFrequency[TEST_COOKIE_HOST]["wordpress.com"],
                    "test originFrequency has wptpc.com tracking wordpress.com");
          assert.equal(Object.keys(storage.originFrequencyPrivate).length, 0,
                       "test originFrequencyPrivate is empty");
          aWin.close();
        }
      });
    },
    onClose: function() {
      assert.ok(storage.originFrequency[TEST_COOKIE_HOST]["wordpress.com"],
                "test originFrequency persists after closing window");
      teardown();
      done();
    }
  });
};

// Test private window
exports.testPrivate = function(assert, done) {
  setup();
  let aWin = windows.open({
    url: TEST_URL,
    isPrivate: true,
    onOpen: function() {
      aWin.tabs.on("ready", function(tab) {
        if (tab.url === TEST_URL) {
          assert.ok(storage.originFrequencyPrivate[TEST_COOKIE_HOST]["wordpress.com"],
                    "test originFrequencyPrivate has wptpc.com tracking wordpress.com");
          assert.equal(Object.keys(storage.originFrequency).length, 0,
                       "test originFrequency is empty");
          storage.userYellow[TEST_COOKIE_HOST] = true;
          storage.blockedOrigins["example.com"] = true;
          aWin.close();
        }
      });
    }
  });
  events.once("last-pb-context-exited-done", function() {
    // Check that user settings and blocked origins are persistent
    assert.ok(storage.userYellow[TEST_COOKIE_HOST],
              "test that user-blocked cookie gets added to userYellow in private mode");
    assert.ok(storage.blockedOrigins["example.com"],
              "test that heuristic-blocked domain gets added to blockedOrigins in private mode");
    // Check that originFrequencyPrivate gets cleared after session
    assert.equal(Object.keys(storage.originFrequencyPrivate).length, 0,
                 "test originFrequencyPrivate is empty after session");
    teardown();
    done();
  });
};

require("sdk/test").run(exports);
