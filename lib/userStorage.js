"use strict";

const { Cc, Ci } = require("chrome");
const { newURI } = require('sdk/url/utils');
const { storage } = require("sdk/simple-storage");

const utils = require("./utils");

let { Policy } = require("./pbContentPolicy");

/*
 * userRed: user chose to block requests to this domain entirely
 * userYellow: user chose to not send cookies/referers to this domain
 * userBlue: user chose to allow all requests to this domain
 */
const userStored = [ "userRed",
                     "userYellow",
                     "userBlue" ];


exports.init = function()
{
  userStored.forEach(
    function(store)
    {
      if (!storage[store]) storage[store] = {};
    }
  )
};

exports.addRed = function(host) { storage.userRed[host] = true; };

exports.addYellow = function(host) { storage.userYellow[host] = true; };

exports.addBlue = function(host) { storage.userBlue[host] = true; };

exports.removeRed = function(host) { delete storage.userRed[host] };

exports.removeYellow = function(host) { delete storage.userYellow[host] };

exports.removeBlue = function(host) { delete storage.userBlue[host] };

