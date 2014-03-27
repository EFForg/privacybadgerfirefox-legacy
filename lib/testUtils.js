// Common methods for running tests

const { Cc, Ci } = require("chrome");
const { Request } = require("sdk/request");
const { pathFor } = require("sdk/system");
const file = require("sdk/io/file");
const { URL } = require("sdk/url");
const { extend } = require("sdk/util/object");

// Use tmp profile dir. so files get deleted at shutdown
exports.basePath = pathFor("ProfD");
exports.port = 8099;

function prepareFile(basename, content) {
  let filePath = file.join(exports.basePath, basename);
  let fileStream = file.open(filePath, 'w');
  fileStream.write(content);
  fileStream.close();
}

function runMultipleURLs(srv, assert, done, options) {
  let urls = [options.url, URL(options.url)];
  let cb = options.onComplete;
  let ran = 0;
  let onComplete = function (res) {
    cb(res);
    if (++ran === urls.length)
      srv ? srv.stop(done) : done();
  };
  urls.forEach(function (url) {
    Request(extend(options, { url: url, onComplete: onComplete })).get();
  });
}

function makeChan(URL) {
  var ios = Cc["@mozilla.org/network/io-service;1"]
              .getService(Ci.nsIIOService);
  return ios.newChannel(URL, null, null).QueryInterface(Ci.nsIHttpChannel);
}

exports.prepareFile = prepareFile;
exports.runMultipleURLs = runMultipleURLs;
exports.makeChan = makeChan;
