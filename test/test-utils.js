const cookieUtils = require("../lib/cookieUtils");
const { Request } = require("sdk/request");
const testUtils = require("../lib/testUtils");
const { startServerAsync } = require('./httpd');
const { Ci, Cc, Cu, Cr } = require("chrome");
const main = require("../lib/main");
const utils = require("../lib/utils");
const { SHA1 } = require("../lib/sha1");
const userStorage = require("../lib/userStorage");
userStorage.init();

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
  'T/ayZECO0g/+hHtQnjrdEZivWA%3D%22%5D; expires=Wed, 01-Jan-3000 08:00:01 G'+
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

// Test util for random number generation
exports.testGetRandomNumber =  function(assert){
  let rands = []
  let min = 10;
  let max = 20;
  for(let i = 0; i < 1000; i++){
    rands.push(utils.getRandomNumber(min,max));
  }
  assert.equal(Math.min.apply(null, rands), min);
  assert.equal(Math.max.apply(null, rands), max);
}

exports.testSHA1 = function(assert){
  assert.equal(SHA1('test'), 'a94a8fe5ccb19ba61c4c0873d391e987982fbbd3', 'sha1 sum is incorrect');
}

exports.testRepeatAtRandom = function(assert, done){
  var calls = 0;
  var testy =  function(){
    calls++;
  }
  utils.repeatAtRandom(testy,10,100,2,function(){
    assert.equal(calls,2);
    done();
  });
}

// Test util for determining if a host is private.
exports.testIsPrivateHost = function(assert) {
  let test_results = {
    'localhost': true,
    '126.0.0.13': false,
    '127.0.0.1': true,
    '128.0.2.27': false,
    '9.4.201.150': false,
    '10.3.0.99': true,
    '11.240.84.107': false,
    '171.20.103.65': false,
    '172.15.2.0': false,
    '172.16.25.30': true,
    '172.31.16.2': true,
    '172.32.3.4': false,
    '173.28.86.211': false,
    '191.168.33.41': false,
    '192.167.101.111': false,
    '192.168.1.5': true,
    '192.169.204.154': false,
    '193.168.28.139': false,
    'privacybadger.org': false,
  };

  for (let host in test_results) {
    // Ignore object properties.
    if (! test_results.hasOwnProperty(host)) {
      continue;
    }

    let expected = test_results[host];
    let errorMessage = host +
      (expected ? ' should be' : ' should not be') + ' private';
    assert.equal(utils.isPrivateHost(host), expected, errorMessage);
  }
}

exports.testIsSubdomain = function(assert){
  let tld = 'privacybadger.org';
  assert.equal(utils.isSubdomain('foo.privacybadger.org', tld), true);
  assert.equal(utils.isSubdomain('foo.bar.baz.bat.privacybadger.org', tld), true);
  assert.equal(utils.isSubdomain('fakeprivacybadger.org', tld), false);
  assert.equal(utils.isSubdomain('tracker.org', tld), false);
  assert.equal(utils.isSubdomain('privacybadger.org.blah', tld), false);
  assert.equal(utils.isSubdomain('', tld), false);
}


// Test util for parsing a cookie string into name-value pairs
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

exports["test makeURI"] = function(assert){
  assert.equal(utils.makeURI("foo"), null);
  assert.equal(utils.makeURI("https://eff.org/").host, "eff.org");
}

// Test util for parsing stored nsICookie2 objects into HTTP response/request
// header strings
exports["test toString"] = function(assert, done) {
  let srv = startServerAsync(testUtils.port, testUtils.basePath);
  let basename = "test-request-set-cookie-to-string.sjs";
  let url = "http://localhost:" + testUtils.port + "/" + basename;
  let origin = utils.getBaseDomain(utils.makeURI(url));
  let responseCookie = 'acctIds=%5B%22mIqZhIPMu7j%22%2C%221394477194%22%2C%22u'+
    'T/ayZECO0g/+hHtQnjrdEZivWA%3D%22%5D; domain=localhost; path=/; expires=We'+
    'd, 01 Jan 3000 08:00:00 GMT; httponly; secure; zcookie=abc; domain=localhost;'+
    ' path=/';
  let requestCookie = 'acctIds=%5B%22mIqZhIPMu7j%22%2C%221394477194%22%2C%22u'+
    'T/ayZECO0g/+hHtQnjrdEZivWA%3D%22%5D; zcookie=abc';
  let requestCookieInsecure = 'zcookie=abc';

  function handleRequest(request, response) {
    var cookiePresent = request.hasHeader("Cookie");
    var responseCookie = 'acctIds=%5B%22mIqZhIPMu7j%22%2C%221394477194%22%2C%22u'+
    'T/ayZECO0g/+hHtQnjrdEZivWA%3D%22%5D; expires=Wed, 01-Jan-3000 08:00:00 G'+
    'MT; domain=localhost; path=/; secure; httponly';
    var responseCookie2 = 'zcookie=abc'
    // If no cookie, set it
    if (!cookiePresent) {
      response.setHeader("Set-Cookie", responseCookie, true);
      response.setHeader("Set-Cookie", responseCookie2, true);
    }
    response.setHeader("Got-Cookie", responseCookie2); // request.getHeader("Cookie"));
    response.write("<html><body>This tests cookie setting.</body></html>");
  }
  testUtils.prepareFile(basename, handleRequest.toString());

  Request({
    url: url,
    onComplete: function (response) {
      // Check that handleRequest actually set the cookies
      let storedCookies = cookieUtils.getCookiesFromHost(origin);
      assert.ok(storedCookies.hasMoreElements(), "test that cookies were set for localhost");
      while (storedCookies.hasMoreElements()) {
        let expectedCookie = storedCookies.getNext().QueryInterface(Ci.nsICookie2);
        assert.ok((expectedCookie.name == "acctIds" ||
                   expectedCookie.name == "zcookie"),
                   "test that expected cookies were set for localhost");
      }

      storedCookies = cookieUtils.getCookiesFromHost(origin);
      let cookieResponseString = cookieUtils.toString(storedCookies,
                                              true, true);
      storedCookies = cookieUtils.getCookiesFromHost(origin);
      let cookieRequestString = cookieUtils.toString(storedCookies,
                                              false, true);
      storedCookies = cookieUtils.getCookiesFromHost(origin);
      let cookieRequestStringInsecure = cookieUtils.toString(storedCookies,
                                              false, false);
      assert.equal(cookieResponseString, responseCookie,
                   "test converting cookie back to response header string");
      assert.equal(cookieRequestString, requestCookie,
                   "test converting cookie to request header string");
      assert.equal(cookieRequestStringInsecure, requestCookieInsecure,
                   "test converting cookie to insecure request header string");
      Request({
        url: url,
        onComplete: function (response) {
          assert.equal(response.headers["got-cookie"], requestCookieInsecure,
                       "test that insecure request only sends insecure cookie");
          teardown();
          srv.stop(done);
        }
      }).get();
    }
  }).get();
};

require("sdk/test").run(exports);
