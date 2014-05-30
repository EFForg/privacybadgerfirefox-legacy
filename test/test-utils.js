const cookieUtils = require("./cookieUtils.js");

exports["test parseCookieString"] = function(assert) {
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

  let cookies = {};
  cookies[optimizelyCookie] = {
    'optimizelyEndUserId': 'oeu1394241144653r0.5381617322055392',
    'optimizelySegments': '%7B%22237061344%22%3A%22none%22%2C%22237321400%2'+
      '2%3A%22ff%22%2C%22237335298%22%3A%22search%22%2C%22237485170%22%3A%2'+
      '2false%22%7D',
    'optimizelyBuckets': '%7B%7D'
  };
  cookies[emptyCookie] = {};
  cookies[testCookie] = {'abc': '123'};
  cookies[googleCookie] = {
    'PREF': 'ID=d93d4e842d10e12a:U=3838eaea5cd40d37:FF=0:TM=1394232126:LM=1'+
      '394235924:S=rKP367ac3aAdDzAS',
    'NID': '67=VwhHOGQunRmNsm9WwJyK571OGqb3RtvUmH987K5DXFgKFAxFwafA_5VPF5_b'+
      'sjhrCoM0BjyQdxyL2b-qs9b-fmYCQ_1UqjtqTeidAJBnc2ecjewJia6saHrcJ6yOVVgv'
  };
  cookies[hackpadCookie] = {
    'acctIds': '%5B%22mIqZhIPMu7j%22%2C%221394477194%22%2C%22uT/ayZECO0g/+h'+
      'HtQnjrdEZivWA%3D%22%5D',
    'PUAS3': '3186efa7f8bca99c',
    "1ASIE": "T"
  };

  for (let cookieString in cookies) {
    if (cookies.hasOwnProperty(cookieString)) {
      let expected = cookies[cookieString];
      var actual = cookieUtils.parseCookieString(cookieString);
      assert.deepEqual(actual,
                       expected,
                       JSON.stringify(expected) + " should be " +
                         JSON.stringify(actual));
    }
  }
};

require("sdk/test").run(exports);
