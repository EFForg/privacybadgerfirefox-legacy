/*
 * This file is part of Privacy Badger <https://www.eff.org/privacybadger>
 * Copyright (C) 2015 Electronic Frontier Foundation
 *
 * Derived from Chameleon <https://github.com/ghostwords/chameleon>
 * Copyright (C) 2015 ghostwords
 *
 * Privacy Badger is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * Privacy Badger is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Privacy Badger.  If not, see <http://www.gnu.org/licenses/>.
 */

function insertScript(text, data) {
  var parent = document.documentElement,
    script = document.createElement('script');

  script.text = text;
  script.async = false;

  for (var key in data) {
    script.setAttribute('data-' + key.replace(/_/g, "-"), data[key]);
  }

  parent.insertBefore(script, parent.firstChild);
  parent.removeChild(script);
}


function getScScript() {

  // code below is not a content script: no addon sdk APIs /////////////////////

  // return a string
  return "(" + function () {

    var event_id = document.currentScript.getAttribute('data-event-id-super-cookie');

    // send message to the content script
    var send = function (message) {
      document.dispatchEvent(new CustomEvent(event_id, {
        detail: message
      }));
    };

    var estimateMaxEntropy = function(str){
      /*
       * Estimate the max possible entropy of str using min and max
       * char codes observed in the string.
       * Tends to overestimate in many cases, e.g. hexadecimals.
       * Also, sensitive to case, e.g. bad1dea is different than BAD1DEA
       */

      /*
       * Don't process item + key's longer than LOCALSTORAGE_MAX_LEN_FOR_ENTROPY_EST.
       * Note that default quota for local storage is 5MB and
       * storing fonts, scripts or images in for local storage for
       * performance is not uncommon. We wouldn't want to estimate entropy
       * for 5M chars.
       */
       // TODO: Refactor this, move it into utils.js
      var MAX_LS_LEN_FOR_ENTROPY_EST = 256;

      if (str.length > MAX_LS_LEN_FOR_ENTROPY_EST){
        /*
         * Just return a higher-than-threshold entropy estimate.
         * We assume 1 bit per char, which will be well over the
         * threshold (33 bits).
         */
        return str.length;
      }

      var charCodes = Array.prototype.map.call(str, function (ch) {
        return String.prototype.charCodeAt.apply(ch);
      });
      var minCharCode = Math.min.apply(Math, charCodes);
      var maxCharCode = Math.max.apply(Math, charCodes);
      // Guess the # of possible symbols, e.g. for 0101 it'd be 2.
      var maxSymbolsGuess =  maxCharCode - minCharCode + 1;
      var maxCombinations = Math.pow(maxSymbolsGuess, str.length);
      var maxBits = Math.log(maxCombinations)/Math.LN2;
      /* console.log("Local storage item length:", str.length, "# symbols guess:", maxSymbolsGuess,
        "Max # Combinations:", maxCombinations, "Max bits:", maxBits) */
      return maxBits;  // May return Infinity when the content is too long.
    };

    var hasLocalStorage = function(){
      var LOCALSTORAGE_ENTROPY_THRESHOLD = 33, // in bits
        estimatedEntropy = 0,
        lsKey = "",
        lsItem = "";

      for (var i = 0; i < localStorage.length; i++) {
        // send both key and value to entropy estimation
        lsKey = localStorage.key(i);
        lsItem = localStorage.getItem(lsKey);
        estimatedEntropy += estimateMaxEntropy(lsKey + lsItem);
        if (estimatedEntropy > LOCALSTORAGE_ENTROPY_THRESHOLD){
          console.log("Found hi-entropy localStorage: ", estimatedEntropy,
            " bits", document.location.href, lsKey);
          return true;
        }
      }
      return false;
    };

    var hasIndexedDB = function(){
      return false;
    };

    var hasFileSystemAPI = function(){
      // TODO: See "Reading a directory's contents" on http://www.html5rocks.com/en/tutorials/file/filesystem/
      return false;
    };

    if (event_id){  // inserted script may run before the event_id is available
      if (hasLocalStorage() ||  hasIndexedDB() || hasFileSystemAPI()){
        // send to content script. TODO: Any other detail we need to send?
        send({ scriptUrl: document.location.href});
      }
    }

  // save locally to keep from getting overwritten by site code
  } + "());";

  // code above is not a content script: no chrome.* APIs /////////////////////

}


var event_id_super_cookie = Math.random();

// listen for messages from the script we are about to insert
document.addEventListener(event_id_super_cookie, function (e) {
  // pass these on to the background page
  self.port.emit('superCookieReport', e.detail);
});

insertScript(getScScript(), {
  event_id_super_cookie: event_id_super_cookie
});

