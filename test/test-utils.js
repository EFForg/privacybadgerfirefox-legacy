const cookieUtils = require("./cookieUtils");
const { Request } = require("sdk/request");
const testUtils = require("./testUtils");
const { startServerAsync } = require('sdk/test/httpd');
const { Ci, Cc, Cu, Cr } = require("chrome");
const main = require("./main");
const utils = require("./utils");

function teardown() {
  main.clearData(true, true);
}

let optimizelyCookie = 'optimizelyEndUserId=oeu1394241144653r0.538161732205'+
  '5392; optimizelySegments=%7B%22237061344%22%3A%22none%22%2C%22237321400%'+
  '22%3A%22ff%22%2C%22237335298%22%3A%22search%22%2C%22237485170%22%3A%22fa'+
  'lse%22%7D; optimizelyBuckets=%7B%7D';
let googleCookie = 'PREF=ID=d93d4e842d10e12a:U=3838eaea5cd40d37:FF=0:TM=139'+
  '4232126:LM=1394235924:S=rKP367ac3aAdDzAS; NID=67=VwhHOGQunRmNsm9WwJyK571'+
  'OGqb3RtvUmH987K5DXFgKFAxFwafA_5VPF5_bsjhrCoM0BjyQdxyL2b-qs9b-fmYCQ_1Uqjt'+
  'qTeidAJBnc2ecjewJia6saHrcJ6yOVVgv';
let hackpadCookie = 'acctIds=%5B%22mIqZhIPMu7j%22%2C%221394477194%22%2C%22u'+
  'T/ayZECO0g/+hHtQnjrdEZivWA%3D%22%5D; expires=Wed, 01-Jan-3000 08:00:00 G'+
  'MT; domain=.hackpad.com; path=/; secure; httponly\nacctIds=%5B%22mIqZhIP'+
  'Mu7j%22%2C%221394477194%22%2C%22uT/ayZECO0g/+hHtQnjrdEZivWA%3D%22%5D; ex'+
  'pires=Wed, 01-Jan-3000 08:00:00 GMT; domain=.hackpad.com; path=/; secure'+
  '; httponly\n1ASIE=T; expires=Wed, 01-Jan-3000 08:00:00 GMT; domain=hackp'+
  'ad.com; path=/\nPUAS3=3186efa7f8bca99c; expires=Wed, 01-Jan-3000 08:00:0'+
  '0 GMT; path=/; secure; httponly';
let emptyCookie = '';
let testCookie = ' notacookiestring; abc=123 ';

let COOKIES = {};
COOKIES[optimizelyCookie] = {
  'optimizelyEndUserId': 'oeu1394241144653r0.5381617322055392',
  'optimizelySegments': '%7B%22237061344%22%3A%22none%22%2C%22237321400%2'+
    '2%3A%22ff%22%2C%22237335298%22%3A%22search%22%2C%22237485170%22%3A%2'+
    '2false%22%7D',
  'optimizelyBuckets': '%7B%7D'
};
COOKIES[emptyCookie] = {};
COOKIES[testCookie] = {'abc': '123'};
COOKIES[googleCookie] = {
  'PREF': 'ID=d93d4e842d10e12a:U=3838eaea5cd40d37:FF=0:TM=1394232126:LM=1'+
    '394235924:S=rKP367ac3aAdDzAS',
  'NID': '67=VwhHOGQunRmNsm9WwJyK571OGqb3RtvUmH987K5DXFgKFAxFwafA_5VPF5_b'+
    'sjhrCoM0BjyQdxyL2b-qs9b-fmYCQ_1UqjtqTeidAJBnc2ecjewJia6saHrcJ6yOVVgv'
};
COOKIES[hackpadCookie] = {
  'acctIds': '%5B%22mIqZhIPMu7j%22%2C%221394477194%22%2C%22uT/ayZECO0g/+h'+
    'HtQnjrdEZivWA%3D%22%5D',
  'PUAS3': '3186efa7f8bca99c',
  "1ASIE": "T"
};

exports["test parseCookieString"] = function(assert) {
  for (let cookieString in COOKIES) {
    if (COOKIES.hasOwnProperty(cookieString)) {
      let expected = COOKIES[cookieString];
      var actual = cookieUtils.parseCookieString(cookieString);
      assert.deepEqual(actual,
                       expected,
                       JSON.stringify(expected) + " should be " +
                         JSON.stringify(actual));
    }
  }
};

exports["test toString"] = function(assert, done) {
  let srv = startServerAsync(testUtils.port, testUtils.basePath);
  let basename = "test-request-set-cookie-to-string.sjs";
  let url = "http://localhost:" + testUtils.port + "/" + basename;
  let origin = utils.getBaseDomain(utils.makeURI(url));
  let responseCookie = 'acctIds=%5B%22mIqZhIPMu7j%22%2C%221394477194%22%2C%22u'+
    'T/ayZECO0g/+hHtQnjrdEZivWA%3D%22%5D; domain=localhost; path=/; expires=We'+
    'd, 01 Jan 3000 08:00:00 GMT; httponly; secure';

  function handleRequest(request, response) {
    var cookiePresent = request.hasHeader("Cookie");
    var responseCookie = 'acctIds=%5B%22mIqZhIPMu7j%22%2C%221394477194%22%2C%22u'+
    'T/ayZECO0g/+hHtQnjrdEZivWA%3D%22%5D; expires=Wed, 01-Jan-3000 08:00:00 G'+
    'MT; domain=localhost; path=/; secure; httponly';
    // If no cookie, set it
    if (!cookiePresent) {
      response.setHeader("Set-Cookie", responseCookie);
    }
    response.write("<html><body>This tests cookie setting.</body></html>");
  }
  testUtils.prepareFile(basename, handleRequest.toString());

  Request({
    url: url,
    onComplete: function (response) {
      let storedCookies = cookieUtils.getCookiesFromHost(origin);
      assert.ok(storedCookies.hasMoreElements(), "test that cookies were set for localhost");
      if (storedCookies.hasMoreElements()) {
        let expectedCookie = storedCookies.getNext().QueryInterface(Ci.nsICookie2);
        assert.equal(expectedCookie.name, "acctIds",
                     "test that acctIds cookie was set for localhost");
      }
      let cookieString = cookieUtils.toString(cookieUtils.getCookiesFromHost(origin),
                                              true, true);
      assert.equal(cookieString, responseCookie,
                   "test converting cookie back to response header string");
      teardown();
      srv.stop(done);
    }
  }).get();
};

require("sdk/test").run(exports);
