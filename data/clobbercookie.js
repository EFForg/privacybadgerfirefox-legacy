/*
 * This file is part of Privacy Badger <https://www.eff.org/privacybadger>
 * Copyright (C) 2014 Electronic Frontier Foundation
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

/**
 * Runs in page content context. Injects a script that deletes cookies.
 * Communicates to webrequest.js to get orders if to delete cookies.
 */
self.port.emit("isCookieBlocked", document.location);
self.port.on("cookieBlockStatus", function(blocked) {
  console.log("NOT JS clobber cookies for", document.location.host);
  if (blocked) {
    console.log("JS clobbering cookies for", document.location.host);

    var code =
      'console.log("JS clobbering cookies for", document.location.host);' + 
      'var dummyCookie = "x=y";' +
      'document.__defineSetter__("cookie", function(value) { console.log("clobbering cookie:", value); return dummyCookie; });' +
      'document.__defineGetter__("cookie", function() { console.log("clobbering cookie getter"); return dummyCookie; });';

    var script = document.createElement('script');

    script.appendChild(document.createTextNode(code));
    (document.head || document.documentElement).appendChild(script);
    script.parentNode.removeChild(script);

    for (var prop in script) { delete script[prop]; }
  }

  return true;
});
// Clobber local storage, using a function closure to keep the dummy private
/*(function() {
  var dummyLocalStorage = { };
  Object.defineProperty(window, "localStorage", {
    __proto__: null,
    configurable: false,
    get: function () {
      return dummyLocalStorage;
    },
    set: function (newValue) {
      // Do nothing
    }
  });
})(); */
