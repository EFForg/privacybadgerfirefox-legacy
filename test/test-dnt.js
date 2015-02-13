const { Request } = require("sdk/request");
const testUtils = require("./testUtils");
const { startServerAsync } = require('./httpd');
const { Ci, Cc, Cr } = require("chrome");
const main = require("./main");

// Test that PB sets the DNT header to "1"
exports.testDNT = function(assert, done) {

  let srv = startServerAsync(testUtils.port, testUtils.basePath);
  let basename = "test-dnt.sjs";
  let url = "http://localhost:" + testUtils.port + "/" + basename;

  function handleRequest(request, response) {
    var dnt = request.getHeader("DNT");
    response.setHeader("DNT", dnt);
  }

  testUtils.prepareFile(basename, handleRequest.toString());

  main.main();
  testUtils.runMultipleURLs(srv, assert, done, {
    url: url,
    onComplete: function(response) {
      assert.equal(response.headers['DNT'], '1');
    }
  });
};

require('sdk/test').run(exports);
