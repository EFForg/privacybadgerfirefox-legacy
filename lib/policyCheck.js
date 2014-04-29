"use strict";

const Request = require('sdk/request').Request;
const { storage } = require("sdk/simple-storage");
const { setInterval } = require("sdk/timers");

const { SHA1 } = require("./sha1");
const { WorkerQueue } = require("./WorkerQueue");

function init() {
  // Initialize persistent storage
  if (!storage.policyHashes) {
    storage.policyHashes = {};
  }

  // refresh hashes on startup and every 24 hours
  updatePrivacyPolicyHashes();
  setInterval(updatePrivacyPolicyHashes, 1000*60*60*24);

  // recheck heuristic-blocked sites on startup and every 24 hours
  recheckBlockedSites();
  setInterval(recheckBlockedSites, 1000*60*60*24);
}

function updatePrivacyPolicyHashes() {
  let url = "https://eff.org/files/dnt-policies.json";
  let request = Request({
    url: url,
    contentType: "application/json",
    onComplete: function(response) {
      let status = Number(response.status);
      if (status >= 200 && status < 300) {
	console.debug("Updated set of privacy policy hashes");
	storage.policyHashes = response.json;
      } else {
	console.error("Request for list of policy hashes returned with status code: " + status);
      }
    }
  }).get();
};

function whitelistOriginFromPrivacyPolicy(origin) {
  let loggingVerb = "adding";
  if (storage.blockedOrigins.hasOwnProperty(origin)) {
    loggingVerb = "moving";
    unblockOrigin(origin);
  }
  console.debug(loggingVerb, origin, "to user whitelist due to privacy policy");
  storage.addGreen(origin);
}

function recheckBlockedSite(origin) {
  checkPrivacyPolicy(origin, function(success) {
    if (success) {
      whitelistOriginFromPrivacyPolicy(origin);
    }
  });
}

function recheckBlockedSites() {
  let q = WorkerQueue(1000);
  for (let i = 0; i < storage.blockedOrigins.length; i++) {
    q.push(function () {
      // Avoid common loop+closures gotcha!
      let origin = storage.blockedOrigins[i];
      recheckBlockedSite(origin);
    });
  }
};

function policyHashesExist() {
  return storage.policyHashes !== undefined &&
    Object.keys(storage.policyHashes).length > 0;
};

function isValidPolicy(policy) {
  let policyHash = SHA1(policy);
  for (let key in storage.policyHashes) {
    if (policyHash === storage.policyHashes[key]) {
      return true;
    }
  }
  return false;
}

function checkPrivacyPolicy(origin, callback) {
  let success = false;
  let policyUrl = "https://" + origin + "/.well-known/dnt-policy.txt";

  if (!policyHashesExist()) {
    console.debug("Not checking privacy policy because there are no acceptable hashes!");
    callback(success);
    return;
  }

  let request = Request({
    url: policyUrl,
    contentType: "application/json",
    onComplete: function(response) {
      let status = Number(response.status);
      if (status >= 200 && status < 300) {
	success = isValidPolicy(response.text);
	callback(success);
	return;
      } else {
	console.error("Policy document request to " + policyUrl +
		      " returned with status " + status);
	callback(success);
      }
    }
  }).get();
};

exports.init = init;
exports.checkPrivacyPolicy = checkPrivacyPolicy;
exports.whitelistOriginFromPrivacyPolicy = whitelistOriginFromPrivacyPolicy;
