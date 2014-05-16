// Handles private browsing sessions

"use strict";

const { Cc, Ci, components } = require("chrome");
const { storage } = require("sdk/simple-storage");
const { Request } = require("sdk/request");

const disconnectServicesURL = require("sdk/self").data.url("services.json");

/* Formats the services list. */
function processServices(data) {

  // Categories to count as trackers
  console.log('got keys', Object.keys(data));
  var categories = {
    Advertising: true,
    Analytics: true,
    Social: true,
  };

  for (var categoryName in categories) {
    if (categories.hasOwnProperty(categoryName)) {
      var category = data.categories[categoryName];
      var serviceCount = category.length;

      for (var i = 0; i < serviceCount; i++) {
        var service = category[i];

        for (var serviceName in service) {
          var urls = service[serviceName];

          for (var homepage in urls) {
            var domains = urls[homepage];
            var domainCount = domains.length;
            for (var j = 0; j < domainCount; j++)
                storage.disconnectServices[domains[j]] = {
                  category: categoryName, name: serviceName, url: homepage
                };
          }
        }
      }
    }
  }
  console.log("got services", JSON.stringify(storage.disconnectServices));
}

/* Updates the third-party metadata. */
function fetchServices() {
  Request({
    url: 'https://services.disconnect.me/disconnect-plaintext.json',
    onComplete: function(response) {
      if (response.status == 200) {
        processServices(response.json);
      } else {
        Request({
          url: disconnectServicesURL,
          overrideMimeType: 'application/json',
          onComplete: function(response) {
            if (response.status == 0 || response.status == 200) {
              processServices(response.json);
            }
          }
        }).get();
      }
    }
  }).get();
}

/*
  The categories and third parties, titlecased, and URL of their homepage and
  domain names they phone home with, lowercased.
*/
storage.disconnectServices = {};


let init = exports.init = function() {
  fetchServices();
};

let cleanup = exports.cleanup = function() {
  ["userRedPrivate", "userYellowPrivate", "userGreenPrivate", "disabledSitesPrivate"].
    forEach(function(store) {
      storage[store] = {};
  });
};
