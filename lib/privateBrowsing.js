// Handles private browsing sessions

"use strict";

const { storage } = require("sdk/simple-storage");
const { isPrivate } = require("sdk/private-browsing");

let init = exports.init = function() {
  console.log("started up Private Browsing");
};

let cleanup = exports.cleanup = function() {
  ["disabledSitesPrivate", "originFrequencyPrivate"].
    forEach(function(store) {
      storage[store] = {};
  });
};


// Helper for modifying different storage items depending on Private Browsing
let doDependingOnIsPrivate = exports.doDependingOnIsPrivate =
  function(storageName, action, context) {
  let isPrivateContext = isPrivate(context);
  if (isPrivateContext) {
    storageName = storageName + "Private";
  }
  return action(storage[storageName]);
};
