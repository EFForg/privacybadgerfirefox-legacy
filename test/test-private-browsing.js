const events = require("sdk/system/events");
const { storage } = require("sdk/simple-storage");
var windows = require("sdk/windows").browserWindows;
const main = require("./main");
const userStorage = require("./userStorage");
const { isPrivate } = require("sdk/private-browsing");

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
          userStorage.addToDisabledSites(tab.url, tab);
          aWin.close();
        }
      });
    },
    onClose: function() {
      assert.ok(storage.disabledSites["en.support.wordpress.com"],
                "test disabledSites has en.support.wordpress.com");
      assert.equal(Object.keys(storage.disabledSitesPrivate).length, 0,
                   "test disabledSitesPrivate is empty");
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
          userStorage.addToDisabledSites(tab.url, tab);
          assert.ok(storage.disabledSitesPrivate["en.support.wordpress.com"],
                    "test disabledSitesPrivate has en.support.wordpress.com");
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
    // Check that originFrequencyPrivate and disabledSitesPrivate get cleared
    // after session ends
    assert.equal(Object.keys(storage.originFrequencyPrivate).length, 0,
                 "test originFrequencyPrivate is empty after session");
    assert.equal(Object.keys(storage.disabledSitesPrivate).length, 0,
                 "test disabledSitesPrivate is empty after session");
    teardown();
    done();
  });
};
// TODO: This test is confusing and causes a cascading failure of
// other tests. It needs to be rewritten. Commenting out for now.
// Test private and non-private windows open at the same time
/*
exports.testBoth = function(assert, done) {
  setup();
  function onWindowOpen(win, url) {
    let bothTabsReady = false;
    // Open a new tab and disable the loaded site
    win.tabs.on("ready", function(tab) {
      if (bothTabsReady) {
        onBothWindowsReady();
        return true;
      }
      bothTabsReady = true;
      win.tabs.open({
        isPrivate: isPrivate(win),
        url: url,
        onOpen: function(nextTab) {
          userStorage.addToDisabledSites(url, win);
        }
      });
      return false;
    });
  }
  let testURLs = ["https://www.eff.org", "http://example.com"];
  // Initialize non-private window
  let aWin = windows.open({
    url: TEST_URL,
    isPrivate: false,
    onOpen: function() { onWindowOpen(aWin, testURLs[0]); },
  });
  // Initialize private window
  let aWinPrivate = windows.open({
    url: TEST_URL,
    isPrivate: true,
    onOpen: function() { onWindowOpen(aWinPrivate, testURLs[1]); },
  });
  // Tests once all tabs in both windows are loaded
  let bothWindowsReady = false;
  function onBothWindowsReady() {
    if (!bothWindowsReady) {
      bothWindowsReady = true;
      return false;
    }
    for each (var window in windows) {
      if (isPrivate(window)) {
        assert.ok(userStorage.isDisabledSite(testURLs[1], window),
                  "test example.com disabled in private window");
        assert.ok(!userStorage.isDisabledSite(testURLs[0], window),
                  "test eff.org not disabled in private window");
        assert.ok(storage.originFrequencyPrivate[TEST_COOKIE_HOST]["wordpress.com"],
                  "integrated test originFrequencyPrivate has wptpc tracking wordpress");
      } else {
        assert.ok(userStorage.isDisabledSite(testURLs[0], window),
                  "test eff.org disabled in regular window");
        assert.ok(!userStorage.isDisabledSite(testURLs[1], window),
                  "test example.com not disabled in regular window");
        assert.ok(storage.originFrequency[TEST_COOKIE_HOST]["wordpress.com"],
                  "integrated test originFrequency has wptpc tracking wordpress");
      }
    }
    window.close();
    return true;
  }
  // Tests once private browsing window is closed
  events.once("last-pb-context-exited-done", function() {
    // Check that originFrequencyPrivate and disabledSitesPrivate get cleared
    // after session ends
    assert.equal(Object.keys(storage.originFrequencyPrivate).length, 0,
                 "integrated test originFrequencyPrivate is empty after session");
    assert.equal(Object.keys(storage.disabledSitesPrivate).length, 0,
                 "integrated test disabledSitesPrivate is empty after session");
    // Check that originFrequency and disabledSites persist
    assert.ok(storage.originFrequency[TEST_COOKIE_HOST]["wordpress.com"],
              "integrated test originFrequency persists after session");
    assert.ok(storage.disabledSites["www.eff.org"],
              "integrated test disabledSites persists after session");
        
    teardown();
    done();
  });
};
*/

require("sdk/test").run(exports);

