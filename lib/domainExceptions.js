// Asks user to add a domain exception for a tracker in order to login to a site

"use strict";

const { storage } = require("sdk/simple-storage");
const userStorage = require("./userStorage");
const utils = require("./utils");
const pageMod = require("sdk/page-mod");
const data = require("sdk/self").data;
const Request = require("sdk/request").Request;
const tabs = require("sdk/tabs");

/**
 * Provides a UI hint for unblocking domain when user clicks on login link in
 * storage.domainExceptionSites.
 */

exports.pathInDomainExceptions = function(path){
  for (var name in storage.domainExceptionSites) {
    if (path.contains(name)) { return true; }
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
            //allow blag on this site only
            userStorage.addToDomainExceptions(currentDomain, whitelistDomains[i]);
            activeTab.reload();
          }   
          if(action === "never"){
            //block third party domain always
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

/*pageMod.PageMod({
  include: "*",
  contentScriptWhen: "start",
  contentScriptFile: [data.url("jquery-ui/js/jquery-1.10.2.js"),
                      data.url("jquery-ui/js/jquery-ui-1.10.4.custom.js"),
                      data.url("vex/vex.combined.min.js"),
                      data.url("domainExceptionPopup.js")],
  contentStyleFile: [data.url("vex/vex.css"),
                     data.url("vex/vex-theme-os.css"),
                     data.url("skin/badger.css")],
  onAttach: function(worker) {
    console.log("Got domain exception match");
    let topWindow = require("./utils").getMostRecentContentWindow();
    let matchedDomainExceptions =
      storage.domainExceptionSites[topWindow.location.href];
    let msg = {
      whitelistDomain: matchedDomainExceptions.english_name,
      currentDomain: topWindow.location.host
    }
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
      }
    }).get();
  }
});
*/
