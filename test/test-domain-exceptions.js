const { storage } = require("sdk/simple-storage");
const userStorage = require("../lib/userStorage");
userStorage.init();

exports["test domain exceptions"] = function(assert) {

  userStorage.init();
  let origin1 = "disqus.com";
  let suborigin1 = "www.disqus.com";
  let origin2 = "maps.google.co.uk";
  let superorigin2 = "google.co.uk";
  let url1 = "http://example.com/";
  let url2 = "http://www.example.com/";

  userStorage.addToDomainExceptions(url1, origin1);
  // Test that domain and subdomain of origin1 are exceptions on url1
  assert.ok(userStorage.isDomainException(url1, origin1), 'add url 1 to origin1');
  assert.ok(userStorage.isDomainException(url1, suborigin1));
  // Test that no exception is added for url2
  assert.ok(!userStorage.isDomainException(url2, origin1));
  // Test that the other domain is not an exception on url1
  assert.ok(!userStorage.isDomainException(url1, origin2));

  userStorage.addToDomainExceptions(url1, origin2);
  // Test that origin2 is now an exception on url1
  assert.ok(userStorage.isDomainException(url1, origin2));
  // Test that parent of origin2 is not an exception on url1
  assert.ok(!userStorage.isDomainException(url1, superorigin2));

  userStorage.removeFromDomainExceptions(url1, origin1);
  // Test that domain and subdomain are no longer exceptions on url1
  assert.ok(!userStorage.isDomainException(url1, origin1));
  assert.ok(!userStorage.isDomainException(url1, suborigin1));
  // Test that the other domain is still an exception on url1
  assert.ok(userStorage.isDomainException(url1, origin2));

  userStorage.removeFromDomainExceptions(url1, origin2);
  // Test that the other domain is no longer an exception on url1
  assert.ok(!userStorage.isDomainException(url1, origin2));
  // Test that the entry for url1 is deleted completely
  assert.equal(storage.domainExceptions[url1],
               undefined,
               "test that url is removed from domainExceptions when all keys" +
               " have been deleted");
};

require("sdk/test").run(exports);
