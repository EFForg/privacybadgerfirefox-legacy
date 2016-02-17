var stripHTML = function(str){
  return str.replace(/[&"'<>]/g, '');
}

self.port.on("gotDomainException", function(msg) {
  console.log('got domain exception', msg);
  var contentHTML = '<div id="pbDialogContainer"></div>' +
    '<div id="pbDialog" class="privacyBadgerDialog">' +
    '<div id="closeWindow">&#215;</div>'+
    '<div id="pbLogo"><img src="' + stripHTML(msg.imageData) + '"></div>'+
    '<h2>Privacy Badger Alert!</h2>' +
    '<div class="clear"></div>' +
    '<h3>Logging into ' + stripHTML(msg.whitelistDomain) + ' can allow it to track you around the web.</h3>' +
    // TODO: Refactor privacy badger to not put things in firefox's cookie exceptions list
    // so that we can allow trackers only on a given domain.
    '<button class="pbButton default" id="allow_all">Always allow ' + stripHTML(msg.whitelistDomain) + '</button>' +
    '<button class="pbButton" id="never">Always block third party requests from ' + stripHTML(msg.whitelistDomain) + '</button>' +
    '</div>';


  var contentStyle = '.privacyBadgerDialog{ height: auto; width: 400px; background-color: #FcFcFc; border: 1px solid #111; z-index: 1000; box-shadow: 2px 2px 10px #222; position: fixed; top: 33%; left: 33%; color: #050505 ; } '+
  '#pbDialogContainer{ background: rgba(0,0,0,0.8); height: 100%; width: 100%; position: fixed; top: 0; left: 0; z-index: 999; }'+
  '.privacyBadgerDialog button{ font-size: 16px ; display: block ; border: 1px solid #333 ; background: #e9f3f3 ; background-image: linear-gradient(#e9f3f3, #c9e3e3) ; box-shadow: 0px 0px 4px #555 ; padding: 2px ; margin: 10px auto ; width: 380px ; height: 26px; border-radius: 4px ; color: #111 ; }'+
  '.privacyBadgerDialog h2{ font-size: 18px ; margin: 22px 5px ; display: inline-block ; color: #050505 ; }'+
  '.privacyBadgerDialog h3{ margin: -5px 10px 20px 10px ; font-size: 14px ; font-weight: normal ; color: #050505 ; }'+
  '.privacyBadgerDialog #pbLogo{ margin: 5px 0 0 5px; display: inline; float: left; }'+
  '.privacyBadgerDialog .clear{ clear: both ; } '+
  '.privacyBadgerDialog .pbButton.default{ border: 1px solid #009999 ; box-shadow: 0px 0px 4px #22eeee ; }'+
  '.privacyBadgerDialog .pbButton:hover{ background-image: linear-gradient(#c3c3c3, #939393) ; } '+
  '#closeWindow{ position: absolute ; right: 5px ; top: 5px ; cursor: pointer ; } ';

  // Create a dialog box element and show it
  var body = document.getElementsByTagName('body')[0];
  var diagBox = document.createElement('div');
  diagBox.innerHTML = contentHTML;
  body.appendChild(diagBox);

  var head = document.getElementsByTagName('head')[0];
  var style = document.createElement('style');
  style.innerHTML = contentStyle;
  head.appendChild(style);


  // Add click handler to dialog buttons
  var buttons = document.getElementsByClassName("pbButton");
  for(var i=0; i < buttons.length; i++){
    var elem = buttons[i];   
    elem.addEventListener('click',function(e){
      var action = e.currentTarget.id;
      self.port.emit("domainWhitelistAction", action);

      closeWindow(e);
    })
  }

  // Focus on the dialog box.
  document.getElementById('pbDialog').focus();


  var closeWindow = function(e){
    document.removeEventListener('keydown', keypressListener);
    document.removeEventListener('click', keypressListener);

    self.port.emit("domainWhitelistAction", "no_action");

    diagBox.parentNode.removeChild(diagBox);
    for (var prop in diagBox) { delete diagBox[prop]; }
    if(e){
      e.preventDefault();
    }
  } 
  // Click handler for close button
  var closeBtn = document.getElementById('closeWindow');
  closeBtn.onclick = closeWindow;

  var docCtr = document.getElementById('pbDialogContainer');
  docCtr.onclick = closeWindow;
  

  
  // Keypress handlers
  var K_ENTER = 13;
  var K_TAB = 9;
  var K_ESC = 27;

  var keypressListener = function(e){
    switch(e.keyCode){
      case K_ENTER:
        e.preventDefault();
        document.getElementsByClassName("pbButton default")[0].click();
        break;
      case K_TAB:
        e.preventDefault();
        var oldButton = document.getElementsByClassName("pbButton default")[0];
        if(oldButton.nextElementSibling.className.contains("pbButton")){
          var newButton = oldButton.nextElementSibling
        } else {
          // If there is no next button loop back around to the first button
          var newButton = document.getElementsByClassName("pbButton")[0];
        }
        oldButton.className = oldButton.className.replace(/\bdefault\b/, '');
        newButton.className += ' default';
        break;
      case K_ESC:
        e.preventDefault();
        closeWindow();
        break;
      default:
        break;
    }
  };

  document.addEventListener('keydown', keypressListener);


});

