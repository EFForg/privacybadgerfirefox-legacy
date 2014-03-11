const { Request } = require("sdk/request");
const testUtils = require("./testUtils");
const { startServerAsync } = require('sdk/test/httpd');
const { Ci, Cc, Cr } = require("chrome");

exports.testDNT = function(assert, done) {
  let srv = startServerAsync(testUtils.port, testUtils.basePath);
  let basename = "test-dnt.sjs";
  let url = "http://localhost:"+testUtils.port+"/";

  let chan = testUtils.makeChan(url);

  let listener = {
    onStartRequest: function(request, ctx) {
      let chan = request.QueryInterface(Ci.nsIHttpChannel);
      chan.setRequestHeader('DNT', '1', false);
      assert.equal(chan.getRequestHeader('DNT'), '1');
    },
    onStopRequest: function(request, ctx, status) {
      let chan = request.QueryInterface(Ci.nsIHttpChannel);
      chanValue = chan.getRequestHeader('DNT');
      assert.equal(chanValue, "1");
      srv.stop(done);
    },
    onDataAvailable: function() {
      //throw Cr.NS_ERROR_UNEXPECTED;
    }
  };

  chan.asyncOpen(listener, null);
  /*
  function handleRequest(request, response) {
    let chan = request.QueryInterface(Ci.nsIHttpChannel);
    let dnt = chan.getRequestHeader('DNT');
    chan.setResponseHeader("DNT", dnt);
  }

  testUtils.prepareFile(basename, handleRequest.toString());

  let req = Request({
    url: "http://localhost:" + testUtils.port + "/" + testUtils.basename,
    onComplete: function(response) {
      assert.equal(response.headers['DNT'], '1');
      srv.stop(done);
    }
  }).get();
 */
};

require('sdk/test').run(exports);
