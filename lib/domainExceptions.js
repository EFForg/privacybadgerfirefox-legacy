/**
 * Provides a UI hint for unblocking domain when user clicks on login link in
 * storage.domainExceptionSites.
 */

"use strict";

const { storage } = require("sdk/simple-storage");
const userStorage = require("./userStorage");
const utils = require("./utils");
const pageMod = require("sdk/page-mod");
const data = require("sdk/self").data;
const Request = require("sdk/request").Request;
const tabs = require("sdk/tabs");

// TODO: optimize pathInDomainExceptions and infoFromPath since they are in the request path

/**
 * Checks if a given path is in the list of domain exceptions
 * @param {string} url A schemeless url to check 
 * @return boolean true if the site is in the list of
 *  potential domain exceptions. False otherwise.
 */
exports.pathInDomainExceptions = function(path){
  for (var name in storage.domainExceptionSites) {
    if (path.startsWith(name)) { return true; }
  }   
  return false;
},  

/**
 * Gets the rest of the information from a given domain exception
 * e.g. what sites should be blocked, the English name
 * @param {string} path The path of the domain exception to check
 * @return {object} metadata about the domain exception.
 */
exports.infoFromPath = function(path){
  for (var name in storage.domainExceptionSites) {
    if (path.contains(name)) { return storage.domainExceptionSites[name]; }
  }   
  return undefined;
}

/**
 * Injects the content script which displays the user dialog
 * listens for a message from the page and acts accordingly.
 * @param {object} domainException A domain exceptions object returned from infoFromPath()
 */
exports.injectPopupScript = function(domainException){
  let worker = tabs.activeTab.attach({
    contentScriptFile: data.url("domainExceptionPopup.js"),
    contentStyleFile: [data.url("skin/badger.css")]
  });

  var whitelistDomains = domainException.whitelist_urls;
  var topWindow = require("./utils").getMostRecentContentWindow();
  var currentDomain = topWindow.location.host;
  var msg = {
    whitelistDomain: domainException.english_name,
    currentDomain: currentDomain
  }
  var activeTab = tabs.activeTab
  // Embed img as data URI as workaround for "mixed" content blocking on
  // the content page
  Request({
    url: data.url("icons/badger-48.txt"),
    onComplete: function(response) {
      if( !worker ){ return; } // If the tab closes before the reqeust completes the worker goes away.
      if (response.status === 200) {
        msg.imageData = 'data:image/png;base64,' + response.text;
      } else {
        console.log("could not get image data for domain exception popup!");
        msg.imageData = '';
      }
      worker.port.emit("gotDomainException", msg);
      worker.port.on("domainWhitelistAction", function(action){
        for(var i = 0; i < whitelistDomains.length; i++){
          if(action === "allow_all"){
            // Allow the tracker on all first party domains.
            userStorage.add('green', whitelistDomains[i]);
          } else if(action === "allow_once") {
            // Allow tracker on this first party only.
            let url = "http://" + currentDomain;
            userStorage.addToDomainExceptions(url, whitelistDomains[i]);
          } else if(action === "never") { 
            // Block tracker always.
            userStorage.add('red', whitelistDomains[i]);
          } else if(msg.action === "not_now") {
            // Do nothing.
          }
        }   

        if(msg.action !== "not_now") {
          activeTab.reload();
        }

      });

    }
  }).get();
}
