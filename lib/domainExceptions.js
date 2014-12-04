// Asks user to add a domain exception for a tracker in order to login to a site

"use strict";

const { storage } = require("sdk/simple-storage");
const userStorage = require("./userStorage");
const utils = require("./utils");
const pageMod = require("sdk/page-mod");
const data = require("sdk/self").data;
const Request = require("sdk/request").Request;
const tabs = require("sdk/tabs");

console.error("called domain exceptions!!!!!!!");
/**
 * Provides a UI hint for unblocking domain when user clicks on login link in
 * storage.domainExceptionSites.
 */

exports.pathInDomainExceptions = function(url){
  var path = url.substr(url.indexOf('://')+3);
  for (var name in storage.domainExceptionSites) {
    if (path.startsWith(name)) { return true; }
  }   
  return false;
},  

exports.infoFromPath = function(path){
  for (var name in storage.domainExceptionSites) {
    if (path.contains(name)) { return storage.domainExceptionSites[name]; }
  }   
  return undefined;
}
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
            userStorage.add('green', whitelistDomains[i]);
            activeTab.reload();
          }   
          if(action === "allow_once"){
            // Allow tracker on this first party only.
            userStorage.addToDomainExceptions(currentDomain, whitelistDomains[i]);
            activeTab.reload();
          }   
          if(action === "never"){
            // Block tracker always.
            userStorage.add('red', whitelistDomains[i]);
            activeTab.reload();
          }   
          if(msg.action === "not_now"){
            //do nothing
          }   
        }   

      });

    }
  }).get();
}
