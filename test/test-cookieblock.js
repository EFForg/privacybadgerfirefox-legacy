const { Request } = require("sdk/request");
const testUtils = require("./testUtils");
const { startServerAsync } = require('./httpd');
const { Cu /*,Cc, Ci, Cr*/}  = require("chrome");
const cookieUtils = require("./cookieUtils");
const main = require("./main");
const utils = require("./utils");
const { Services } = Cu.import("resource://gre/modules/Services.jsm");
const prefsService = require("sdk/preferences/service");
const userStorage = require("./userStorage");
userStorage.init();

function teardown() {
  main.clearData(true, true);
  prefsService.set("network.cookie.lifetimePolicy", 0);
}

// block a cookie by adding it to userYellow and then unblock it by
// adding it to userGreen
exports.test3rdPartyCookieblock = function (assert, done) {

  // Clean up from previous tests
  cookieUtils.clearCookies();
  Services.prefs.setIntPref("network.cookie.cookieBehavior", 0);

  let srv = startServerAsync(testUtils.port, testUtils.basePath);

  let basename = "test-request-3rd-party-cookieblock.sjs";
  let url = "http://localhost:" + testUtils.port + "/" + basename;
  let windowUrl = "resource://gre-resources/hiddenWindow.html";
  let origin = 'localhost';

  function handleRequest(request, response) {
    var cookiePresent = request.hasHeader("Cookie");
    // If no cookie, set it
    if (!cookiePresent) {
      response.setHeader("Set-Cookie", "cookie=monster;");
      response.setHeader("x-jetpack-3rd-party", "false");
    } else {
      // We got the cookie, say so
      response.setHeader("x-jetpack-3rd-party", request.getHeader('Cookie'));
    }
    response.write("<html><body>This tests cookieblocking.</body></html>");
  }

  testUtils.prepareFile(basename, handleRequest.toString());

  // Install the addon
  main.main();
  // Cookieblock localhost
  userStorage.add("yellow", origin);

  // XXX: This isn't actually a 3rd party request. There is a hack in
  // clobberCookie that treats "localhost" as if it were a third party
  // for the purpose of this test.
  Request({
    url: url + '?1',
    onComplete: function(response) {
      // Check it wasn't there before
      assert.equal(response.headers['x-jetpack-3rd-party'], 'false', 'test header wasnt there before');

      // Make a second request, and check that the server this time
      // doesn't get the cookie
      Request({
        url: url + '?2',
        onComplete: function(response) {
          assert.equal(response.headers['x-jetpack-3rd-party'], 'false',  'has no third party cookie');

          // Now unclobber the cookie and repeat the test
          userStorage.add("green", origin);
          Request({
            url: url + '?3',
            onComplete: function(response) {
              // Check that the server tries to set a cookie
              assert.equal(response.headers['Set-Cookie'], 'cookie=monster;', 'green test header exists');

              // Check it wasn't there before
              assert.equal(response.headers['x-jetpack-3rd-party'], 'false', 'green test not third party');

              // Now the next request should include the cookie we just set
              Request({
                url: url + '?4',
                onComplete: function(response) {
                  // Note that the semicolon should be gone
                  assert.equal(response.headers['x-jetpack-3rd-party'], 'cookie=monster', 'test cookie exists after request');
                  // Clobber the cookie again
                  userStorage.add("yellow", origin);
                  // Add the hidden window corresponding to XHRs to disabledSies
                  let host = require("sdk/url").URL(windowUrl).host;
                  userStorage.addToDisabledSites(host);

                  // Check that blocked cookie is injected when PB is disabled
                  Request({
                    url: url + '?5',
                    onComplete: function(response) {
                      assert.equal(response.headers['x-jetpack-3rd-party'],
                                   'cookie=monster',
                                   'test that blocked cookie is injected on disabled page');
                      finish();
                    }
                  }).get();
                }
              }).get();
            }
          }).get();
        }
      }).get();
    }
  }).get();

  // Test whether blocked cookie is cleared when user pref is to
  // clear all cookies when the browser closes
  function finish() {
    prefsService.set("network.cookie.lifetimePolicy", 2);
    main.onQuitApplicationGranted(null);
    let cookies = cookieUtils.getCookiesFromHost(origin);
    assert.ok(!cookies.hasMoreElements(),
              "test that cookies from localhost were cleared on exit");
    teardown();
    srv.stop(done);
  }
};

require('sdk/test').run(exports);
