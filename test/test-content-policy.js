let { Policy } = require("./contentPolicy.js");
let ABPUtils = require("./abp/utils.js").Utils;

exports["test Policy hasWhitelistedScheme"] = function(assert) {
  let urls = {
    "about:blank": true,
    "chrome://mozapps/skin/places/defaultFavicon.png": true,
    "http://eff.org": false,
    "https://eff.org": false
  };

  for (let url in urls) {
    let expected = urls[url];
    assert.equal(Policy.hasWhitelistedScheme(ABPUtils.makeURI(url)),
                 expected,
                 url + " " + (expected ? "should be" : "should not be") + " whitelisted");
  }
}

require("sdk/test").run(exports);
