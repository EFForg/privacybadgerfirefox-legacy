"use strict";

const Request = require('sdk/request').Request;
const { storage } = require("sdk/simple-storage");
const { setInterval } = require("sdk/timers");

const { SHA1 } = require("./sha1");
const { WorkerQueue } = require("./WorkerQueue");
const cookieUtils = require("./cookieUtils");

function init() {
  // Initialize persistent storage
  if (!storage.policyHashes) {
    storage.policyHashes = {};
  }
  if (!storage.policyWhitelist) {
    storage.policyWhitelist = {};
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
    // XXX can't use unblockOrigin due to circular dependency with heuristicBlocker.js
    // Copying logic for now
    // unblockOrigin(origin);
    // TODO is this even necessary? Can I just add it to the policyWhitelist, leaving
    // it on any other lists it may be on, and handle the decision logic elsewhere?
    cookieUtils.unclobberCookie(origin);
    delete storage.blockedOrigins[origin];
  }
  console.debug(loggingVerb, origin, "to user whitelist due to privacy policy");
  storage.policyWhitelist[origin] = true;
}

function recheckBlockedSite(origin) {
  console.log("Rechecking blocked site:", origin);
  checkPrivacyPolicy(origin, function(success) {
    if (success) {
      whitelistOriginFromPrivacyPolicy(origin);
    }
  });
}

function recheckBlockedSites() {
  console.log("Rechecking", Object.keys(storage.blockedOrigins).length, "blocked sites...");
  let q = new WorkerQueue(1000);
  let blockedOrigins = Object.keys(storage.blockedOrigins);
  for (let i = 0; i < blockedOrigins.length; i++) {
    console.log("Pushing", blockedOrigins[i], "to recheck queue");
    q.push(function () {
      // Avoid common loop+closures gotcha!
      let origin = blockedOrigins[i];
      recheckBlockedSite(origin);
      // WorkerQueue will repeatedly attempt to retry a job until it returns true.
      // We just want to do one check every interval.
      return true;
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
