const utils = require("../lib/utils.js");
const { Policy } = require("../lib/contentPolicy.js");
const userStorage = require("../lib/userStorage.js");
userStorage.init();


exports["test Policy hasWhitelistedScheme"] = function(assert) {
  let urls = {
    "about:blank": true,
    "chrome://mozapps/skin/places/defaultFavicon.png": true,
    "http://www.eff.org": false,
    "https://www.eff.org": false
  };

  for (let url in urls) {
    let expected = urls[url];
    assert.equal(Policy._hasWhitelistedScheme(utils.makeURI(url)),
                 expected,
                 url + " " + (expected ? "should be" : "should not be") + " whitelisted");
  }
};

let preloads = "\
@@||google.com^$third-party\n\
@@||eff.org^$third-party\n\
@@||notrack.malicious.org^$third-party\n\
"
userStorage.syncPreloads(preloads);

exports["test isPreloadedWhitelistRequest"] = function(assert){
  let urls = {
    "http://eff.org": true,
    "http://www.eff.org": true,
    "http://maps.google.com": true,
    "http://malicious.org": false,
    "http://notrack.org": false,
    "http://super.long.sub.domain.at.eff.org": true
  }

  for (let url in urls) {
    let expected = urls[url];
    assert.equal(Policy._isPreloadedWhitelistRequest(utils.makeURI(url)),
                 expected,
                 url + " " + (expected ? "should be" : "should not be") + " whitelisted");
  }
}

require("sdk/test").run(exports);
