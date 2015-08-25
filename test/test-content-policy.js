const { Policy } = require("./contentPolicy.js");
const utils = require("./utils.js");

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

require("sdk/test").run(exports);
