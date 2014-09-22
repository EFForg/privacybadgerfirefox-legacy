self.port.on("gotDomainException", function(msg) {
  let contentHTML =  '<div id="pbDialog" class="privacyBadgerDialog">' +
      '<div id="pbLogo"><img src="' + msg.imageData + '"></div>'+
      '<h2>Privacy Badger Alert!</h2>' +
      '<div class="clear"></div>' +
      '<h3>Logging into ' + msg.whitelistDomain + ' can allow them to track you around the web.</h3>' +
      '<button class="pbButton default" id="allow_once">Only allow ' + msg.whitelistDomain + ' on ' + msg.currentDomain + '</button>' +
      '<button class="pbButton" id="allow_all">Always allow ' + msg.whitelistDomain + '</button>' +
      '<button class="pbButton" id="never">Continue blocking ' + msg.whitelistDomain + ' for now</button>' +
      '</div>';

  vex.open({
    content: contentHTML,
    appendLocation: 'body',
    showCloseButton: false
  }).bind('vexOpen', function(options) {
  }).bind('vexClose', function() {});
});

