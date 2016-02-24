const userStorage = require("../lib/userStorage.js");
userStorage.init();


exports.testIsDisabledSite = function(assert) {
  let url = "https://www.eff.org";
  let disabledSite = "www.eff.org";

  // Make sure site is not disabled by default.
  assert.equal(
    userStorage.isDisabledSite(url, null), false, url + " should not be disabled"
  );

  // Make sure site is disabled after adding to list of disabled sites.
  userStorage.addToDisabledSites(disabledSite, null);
  assert.equal(
    userStorage.isDisabledSite(url, null), true, url + " should be disabled"
  );
  userStorage.removeFromDisabledSites(disabledSite, null);
};

exports.testIsDisabledSiteWildcard = function(assert) {
  let url1 = "https://www.eff.org";
  let url2 = "https://test.eff.org";
  let disabledSite = "*.eff.org";

  // Make sure both URLs are disabled after adding wildcard disabled site.
  userStorage.addToDisabledSites(disabledSite, null);
  assert.equal(
    userStorage.isDisabledSite(url1, null), true, url1 + " should be disabled"
  );
  assert.equal(
    userStorage.isDisabledSite(url2, null), true, url2 + " should be disabled"
  );
  userStorage.removeFromDisabledSites(disabledSite, null);
};


require("sdk/test").run(exports);
