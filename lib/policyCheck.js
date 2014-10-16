"use strict";

const Request = require('sdk/request').Request;
const { storage } = require("sdk/simple-storage");
const { setInterval } = require("sdk/timers");

const { SHA1 } = require("./sha1");
const { WorkerQueue } = require("./WorkerQueue");
const utils = require("./utils");
const cookieUtils = require("./cookieUtils");
const prefs = require('sdk/simple-prefs').prefs;

function init() {
  console.log('init policy check');
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

  // Recheck heuristic-blocked sites on startup and every 24 hours.
  recheckBlockedSites();
  setInterval(recheckBlockedSites, 1000*60*60*24);
}

/**
 * Updates the list of acceptable DNT policy hashes.
 */
function updatePrivacyPolicyHashes() {
  let url = "https://www.eff.org/files/dnt-policies.json";
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
    },
    anonymous: true
  }).get();
}

/**
 * If a host (*not* necessarily an eTLD+1) posts an acceptable DNT Policy,
 * whitelist them even if the eTLD+1 is blocked.
 */
function whitelistHostFromPrivacyPolicy(host) {
  let loggingVerb = "adding";
  if (storage.blockedOrigins.hasOwnProperty(host)) {
    loggingVerb = "moving";
    // XXX can't use unblockOrigin due to circular dependency with heuristicBlocker.js
    // Copying logic for now
    // unblockOrigin(host);
    // TODO is this even necessary? Can I just add it to the policyWhitelist, leaving
    // it on any other lists it may be on, and handle the decision logic elsewhere?
    delete storage.blockedOrigins[host];
  }
  // Reset the cookie *only* if it hasn't been clobbered by the user, since
  // user choices have higher precedence.
  if (!(origin in storage.userYellow)) {
    cookieUtils.resetCookie(host);
  }
  console.debug(loggingVerb, host, "to user whitelist due to privacy policy");
  storage.policyWhitelist[host] = true;
}

/**
 * Periodically checks whether sites have put up (TODO: also check removed)
 * acceptable DNT policies.
 */
function recheckBlockedSite(host) {
  console.log("Rechecking blocked site:", host);
  checkPrivacyPolicy(host, function(success) {
    if (success) {
      whitelistHostFromPrivacyPolicy(host);
    }
  });
}
function recheckBlockedSites() {
  var oneDay =  1000 * 60 * 60 * 24;
  var minInterval = oneDay * 7;
  var maxInterval = oneDay * 14;

  if( ! prefs.blockedDomainRecheckDNT ){
    return;
  }

  // Initialize nextBlockSitesCheck
  if(!storage.nextBlockedSitesCheck){
    storage.nextBlockedSitesCheck = Date.now() + utils.getRandomNumber(minInterval, maxInterval);
  }

  // If we have not met the threshold of when to check again then return. 
  if(Date.now() < storage.nextBlockedSitesCheck){
    return;
  }

  storage.nextBlockedSitesCheck = Date.now() + utils.getRandomNumber(minInterval, maxInterval);
  let q = new WorkerQueue(1000);
  let blockedOrigins = Object.keys(storage.blockedOrigins);
  for (let i = 0; i < blockedOrigins.length; i++) {
    console.log("Pushing", blockedOrigins[i], "to recheck queue");
    // Avoid common loop+closures gotcha!
    let origin = blockedOrigins[i];
    q.push(function () {
      recheckBlockedSite(origin);
      // WorkerQueue will repeatedly attempt to retry a job until it returns true.
      // We just want to do one check every interval.
      return true;
    });
  }

}

function policyHashesExist() {
  return storage.policyHashes !== undefined &&
    Object.keys(storage.policyHashes).length > 0;
}

function isValidPolicy(policy) {
  let policyHash = SHA1(policy);
  for (let key in storage.policyHashes) {
    if (policyHash === storage.policyHashes[key]) {
      return true;
    }
  }
  return false;
}

function checkPrivacyPolicy(host, callback) {
  let success = false;
  let policyUrl = "https://" + host + "/.well-known/dnt-policy.txt";
  if (!policyHashesExist()) {
    console.debug("Not checking privacy policy because there are no acceptable hashes!");
    callback(success);
    return;
  }

  // Cookies are stripped from all DNT policy responses in onExamineResponse.
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
    },
    anonymous: true
  }).get();
}

exports.init = init;
exports.checkPrivacyPolicy = checkPrivacyPolicy;
exports.whitelistHostFromPrivacyPolicy = whitelistHostFromPrivacyPolicy;
