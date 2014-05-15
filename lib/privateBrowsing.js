// Handles private browsing sessions

"use strict";

const { Cc, Ci } = require("chrome");
const { storage } = require("sdk/simple-storage");
const { Request } = require("sdk/request");

const disconnectServicesURL = require("sdk/self").data.url("services.json");

/*
 * The following section is mostly copied from Disconnect:
 * https://github.com/disconnectme/disconnect/tree/master/firefox
 *
 */

/* Destringifies an object. */
function deserialize(object) {
  return typeof object == 'string' ? JSON.parse(object) : object;
}

/* Formats the services list. */
function processServices(data) {
  data = deserialize(data || '{}');
  var categories = {
    Advertising: true,
    Analytics: true,
    Social: true,
  };

  for (var categoryName in categories) {
    if (categories.hasOwnProperty(categoryName)) {
      var category = categories[categoryName];
      var serviceCount = category.length;

      for (var i = 0; i < serviceCount; i++) {
        var service = category[i];

        for (var serviceName in service) {
          var urls = service[serviceName];

          for (var homepage in urls) {
            var domains = urls[homepage];
            var domainCount = domains.length;
            for (var j = 0; j < domainCount; j++)
                moreServices[domains[j]] = {
                  category: categoryName, name: serviceName, url: homepage
                };
          }
        }
      }
    }
  }
}

/* Updates the third-party metadata. */
function fetchServices() {
  xhr.open('GET',
           'https://services.disconnect.me/disconnect-plaintext.json');
  xhr.onload = function() {
    if (xhr.status = 200) {
      processServices(xhr.responseText);
    }
  }
  try { xhr.send(); } catch (e) {}
}

/* Retrieves the third-party metadata, if any, associated with a domain name. */
function getService(domain) { return moreServices[domain]; }

/* Retests a URL. */
function recategorize(domain, url) {
  var category;
  var rule = filteringRules[domain];
  if (rule && RegExp(rule[0]).test(url)) category = rule[1];
  return category;
}

/* The "XMLHttpRequest" object. */
var xhr =
    new Components.Constructor('@mozilla.org/xmlextras/xmlhttprequest;1')();

/*
  The categories and third parties, titlecased, and URL of their homepage and
  domain names they phone home with, lowercased.
*/
var moreServices = {};


let init = exports.init = function {
  xhr.open('GET', disconnectServicesURL);
  xhr.overrideMimeType('application/json');

  xhr.onreadystatechange = function() {
    xhr.readyState == 4 && (xhr.status == 0 || xhr.status == 200) &&
        processServices(xhr.responseText);
  };

  xhr.send();
};

exports.fetchServices = fetchServices;
