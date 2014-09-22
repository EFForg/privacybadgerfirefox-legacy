// Asks user to add a domain exception for a tracker in order to login to a site

"use strict";

const { storage } = require("sdk/simple-storage");
const userStorage = require("./userStorage");
const pageMod = require("sdk/page-mod");
const data = require("sdk/self").data;
const Request = require("sdk/request").Request;

/**
 * Provides a UI hint for unblocking domain when user clicks on login link in
 * storage.domainExceptionSites.
 */
pageMod.PageMod({
  include: Object.keys(storage.domainExceptionSites),
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
