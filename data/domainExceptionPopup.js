self.port.on("gotDomainException", function(msg) {
  console.error('got domain exception', msg);
  var contentHTML = '<div id="pbDialogContainer"></div>' +
    '<div id="pbDialog" class="privacyBadgerDialog">' +
    '<div id="closeWindow">X</div>'+
    '<div id="pbLogo"><img src="' + msg.imageData + '"></div>'+
    '<h2>Privacy Badger Alert!</h2>' +
    '<div class="clear"></div>' +
    '<h3>Logging into ' + msg.whitelistDomain + ' can allow it to track you around the web.</h3>' +
    '<button class="pbButton default" id="allow_once">Only allow ' + msg.whitelistDomain + ' on ' + msg.currentDomain + '</button>' +
    '<button class="pbButton" id="allow_all">Always allow ' + msg.whitelistDomain + '</button>' +
    '<button class="pbButton" id="never">Always block third party requests from ' + msg.whitelistDomain + '</button>' +
    '<a id="useless"></a>' + 
    '</div>';



  var contentStyle = '.privacyBadgerDialog{ height: auto; width: 400px; background-color: #FcFcFc; border: 1px solid #111; z-index: 1000; box-shadow: 2px 2px 10px #222; position: fixed; top: 33%; left: 33%; color: #050505 !important; } '+
  '#pbDialogContainer{ background: rgba(0,0,0,0.8); height: 100%; width: 100%; position: fixed; top: 0; left: 0; z-index: 999; }'+
  '.privacyBadgerDialog button{ font-size: 16px !important; display: block !important; border: 1px solid #333 !important; background: #e9f3f3 !important; background-image: linear-gradient(#e9f3f3, #c9e3e3) !important; box-shadow: 0px 0px 4px #555 !important; padding: 2px !important; margin: 10px auto !important; width: 380px !important; height: 26px; border-radius: 4px !important; color: #111 !important; }'+
  '.privacyBadgerDialog h2{ font-size: 18px !important; margin: 22px 5px !important; display: inline-block !important; color: #050505 !important; }'+
  '.privacyBadgerDialog h3{ margin: -5px 10px 20px 10px !important; font-size: 14px !important; font-weight: normal !important; color: #050505 !important; }'+
  '.privacyBadgerDialog #pbLogo{ margin: 5px 0 0 5px; display: inline; float: left; }'+
  '.privacyBadgerDialog .clear{ clear: both !important; } '+
  '.privacyBadgerDialog .pbButton.default{ border: 1px solid #009999 !important; box-shadow: 0px 0px 4px #22eeee !important; }'+
  '.privacyBadgerDialog .pbButton:hover{ background-image: linear-gradient(#c3c3c3, #939393) !important; } '+
  '#closeWindow{ position: absolute !important; right: 5px !important; top: 5px !important; cursor: pointer !important; } ';

      //Create a dialog box element and show it
      var body = document.getElementsByTagName('body')[0];
      var diagBox = document.createElement('div');
      diagBox.innerHTML = contentHTML;
      body.appendChild(diagBox);

      var head = document.getElementsByTagName('head')[0];
      var style = document.createElement('style');
      style.innerHTML = contentStyle;
      head.appendChild(style);


      //add click handler to dialog buttons
      var buttons = document.getElementsByClassName("pbButton");
      for(var i =0; i < buttons.length; i++){
        var elem = buttons[i];   
        elem.addEventListener('click',function(e){
          var action = e.currentTarget.id;
          self.port.emit("domainWhitelistAction", action);

          diagBox.parentNode.removeChild(diagBox);
          for (var prop in diagBox) { delete diagBox[prop]; }
          document.removeEventListener('keydown', keypressListener);

          e.preventDefault();
        })
      }

      document.getElementById('useless').click();

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
      //click handler for close button
      var closeBtn = document.getElementById('closeWindow');
      closeBtn.onclick = closeWindow;

      var docCtr = document.getElementById('pbDialogContainer');
      docCtr.onclick = closeWindow;
      

      
      //keypress handlers
      var K_ENTER = 13;
      var K_TAB = 9;
      var K_ESC = 27;

      //number of times tab was pressed, used to determine idx of default option
      var tab_count = 0;

      var keypressListener = function(e){
        switch(e.keyCode){
          case K_ENTER:
            e.preventDefault();
            document.getElementsByClassName("pbButton default")[0].click();
            break;
          case K_TAB:
            e.preventDefault();
            var cur_idx = tab_count % 3;
            tab_count += 1;
            var new_idx = tab_count % 3;
            var buttons = document.getElementsByClassName("pbButton");
            var oldButton = buttons[cur_idx];
            var newButton = buttons[new_idx];
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

