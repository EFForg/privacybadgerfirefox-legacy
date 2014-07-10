const userStorage = require("./userStorage");
const { storage } = require("sdk/simple-storage");

exports["test domain exceptions"] = function(assert) {
  let origin1 = "disqus.com";
  let suborigin1 = "www.disqus.com";
  let origin2 = "maps.google.co.uk";
  let superorigin2 = "google.co.uk";
  let site1 = "http://example.com";
  let site2 = "https://www.example.com";

  userStorage.addToDomainExceptions(site1, origin1);
  // Test that domain and subdomain of origin1 are exceptions on site1
  assert.ok(userStorage.isDomainException(site1, origin1));
  assert.ok(userStorage.isDomainException(site1, suborigin1));
  // Test that no exception is added for site2
  assert.ok(!userStorage.isDomainException(site2, origin1));
  // Test that the other domain is not an exception on site1
  assert.ok(!userStorage.isDomainException(site1, origin2));

  userStorage.addToDomainExceptions(site1, origin2);
  // Test that origin2 is now an exception on site1
  assert.ok(userStorage.isDomainException(site1, origin2));
  // Test that parent of origin2 is not an exception on site1
  assert.ok(!userStorage.isDomainException(site1, superorigin2));

  userStorage.removeFromDomainExceptions(site1, origin1);
  // Test that domain and subdomain are no longer exceptions on site1
  assert.ok(!userStorage.isDomainException(site1, origin1));
  assert.ok(!userStorage.isDomainException(site1, suborigin1));
  // Test that the other domain is still an exception on site1
  assert.ok(userStorage.isDomainException(site1, origin2));

  userStorage.removeFromDomainExceptions(site1, origin2);
  // Test that the other domain is no longer an exception on site1
  assert.ok(!userStorage.isDomainException(site1, origin2));
  // Test that the entry for site1 is deleted completely
  assert.equal(storage.domainExceptions[site1],
               undefined,
               "test that site is removed from domainExceptions when all keys" +
               " have been deleted");
};

require("sdk/test").run(exports);
