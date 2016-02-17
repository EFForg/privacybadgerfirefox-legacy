const { Cc, Ci } = require("chrome");

/**
 *
 *  Secure Hash Algorithm (SHA1)
 *  See https://developer.mozilla.org/en-US/docs/Mozilla/Tech/XPCOM/Reference/Interface/nsICryptoHash
 *
 **/

function SHA1(msg) {
  let converter = Cc["@mozilla.org/intl/scriptableunicodeconverter"].createInstance(Ci.nsIScriptableUnicodeConverter);
  converter.charset = "UTF-8";
  let bytes = converter.convertToByteArray(msg, {});

  let ch = Cc["@mozilla.org/security/hash;1"].createInstance(Ci.nsICryptoHash);
  ch.init(ch.SHA1);
  ch.update(bytes, bytes.length);
  let hash = ch.finish(false);

  function toHexString(charCode) {
    return ("0" + charCode.toString(16)).slice(-2);
  }

  return [toHexString(hash.charCodeAt(i)) for (i in hash)].join("");
}

exports.SHA1 = SHA1;
