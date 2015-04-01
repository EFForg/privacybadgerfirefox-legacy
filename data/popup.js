/**
 * Initializes the popup panel UI depending on whether PB is active
 * for the current page.
 */
function init(isActive)
{
  console.log("Initializing popup.js");

  $(".hidePanel").click(function() { self.port.emit("hidePanel"); });

  // If not active, just show an activation button
  if (!isActive) {
    resetHTML();
    return;
  }

  // Initialize more HTML if PB is active
  vex.defaultOptions.className = 'vex-theme-os';
  $("#badgerImg2").hide();
  $("#badgerImg").show();
  $("#badgerImg").hover(function () {
    $("#detected").text("Click to deactivate Privacy Badger on this site.");
  }, function () {
    $("#detected").text(trackerStatus);
  });
  $('#prefs').hover(function() {
    $('#gearImg').attr('src', 'icons/gear-25.png');
  }, function() {
    $('#gearImg').attr('src', 'icons/gear-light-25.png');
  });
  $(function() {
    $("#gearImg").show();
    $("#blockedResourcesContainer").on("change", "input:radio", updateOrigin);
    $('#blockedResourcesContainer').on('click', '.userset .honeybadgerPowered', resetControl);
    $('#blockedResourcesContainer').on('mouseenter', '.tooltip', displayTooltip);
    $('#blockedResourcesContainer').on('mouseleave', '.tooltip', hideTooltip);
  });
}

/**
 * Sets HTML for inactive state.
 */
function resetHTML() {
  $("#badgerImg").hide();
  $("#badgerImg2").show();
  $("#badgerImg2").hover(function () {
    $("#detected").text("Click to activate Privacy Badger on this site.");
  }, function () {
    $("#detected").text("Click the badger icon to activate Privacy Badger on this site.");
  });
  $("#detected").text("Click the badger icon to activate Privacy Badger on this site.");
  $("#blockedResources").text("");
  $("#gearImg").hide();
  return;
}

/**
 * Called from lib/ui.js to clean up UI after the panel is hidden.
 */
function cleanup() {
  vex.close();
}

/**
 * Listeners for click events in the panel header.
 */
$("#badgerImg2").click(function() { self.port.emit("activateSite"); });
$("#badgerImg").click(function () { self.port.emit("deactivateSite"); });
$('#gearImg').click(function() {
  // Create the settings menu
  let restoreHTML = '<div id="restoreButtonDiv" class="modalButton">Unblock all trackers . . .</div>';
  let disableHTML = '<div id="disableButtonDiv" class="modalButton">Disable on current page</div>';
  let reportHTML = '<div id="reportButtonDiv" class="modalButton">Report a bug . . .</div>';
  let messageHTML = '<div id="messageDiv" class="vexMessage"></div>';
  let contentHTML = disableHTML + reportHTML + restoreHTML + messageHTML;
  vex.open({
    content: contentHTML,
    appendLocation: 'body',
    css: {'width':'100%',
          'margin-left':'auto',
          'margin-right':'auto'
    },
    contentCSS: {'background': '#DD4444',
                 'border-top': '20px solid #333333',
                 'padding-left': '1em',
                 'padding-right': '1em',
                 'padding-top': '0.5em',
                 'padding-bottom': '0.5em'
    },
    showCloseButton: false
  }).bind('vexOpen', function(options) {
    $('.modalButton').wrapAll('<div id="buttonsDiv" />');
    $('#messageDiv').hide();
    $('.modalButton').hover(function() {
      $(this).toggleClass('buttonActive');
    });
    // Button to disable PB on the current page.
    $('#disableButtonDiv').click(function() {
      self.port.emit("deactivateSite");
      vex.close();
    });
    // Button to clear blockers
    $('#restoreButtonDiv').click(function() {
      vex.dialog.confirm({
        message: "This will set <b>all</b> trackers back to their default state (green if you allow 3rd party cookies by default in Firefox, yellow otherwise). Are you sure you want to continue?",
        callback: function(value) {
          if (value) {
            self.port.emit("unblockAll");
          }
        }
      });
    });
    // Button to report bugs
    $('#reportButtonDiv').click(function() {
      window.open("https://github.com/EFForg/privacybadgerfirefox/issues?state=open",
                  "_blank");
      vex.close();
    });
  }).bind('vexClose', function() {});
});


/**
 * Methods to add HTML for showing and controlling blockers. Called after init.
 * Possible states for action:
 *  noaction, block, cookieblock, usernoaction, userblock, usercookieblock
 */
var trackerStatus;
function changeOriginHTML(setting) {
  let printable = _addOriginHTML(setting.origin, '', setting.action);
  $("div[data-origin='"+setting.origin+"']").replaceWith(printable);
}
function refreshPopup(settings) {
  if (settings.cleared) {
    trackerStatus = "Reload the page to see active trackers.";
    $("#detected").text(trackerStatus);
    $("#blockedResources").text("");
    return;
  }
  var origins = Object.keys(settings);
  if (!origins || origins.length === 0) {
    trackerStatus = "Could not detect any tracking cookies.";
    $("#detected").text(trackerStatus);
    $("#blockedResources").text("");
    return;
  }
  let sortedOrigins = _reverseSort(origins);
  trackerStatus = "Detected " + sortedOrigins.length + " <a id='trackerLink' target=_blank tabindex=-1 title='What is a tracker?' href='https://www.eff.org/privacybadger#trackers'>trackers</a> from these sites:";
  $("#detected").html(trackerStatus);
  var printable = '<div id="associatedTab" data-tab-id="' + 0 + '"></div>';
  for (var i=0; i < sortedOrigins.length; i++) {
    var origin = sortedOrigins[i];
    var action = settings[origin];
    // todo: gross hack, use templating framework
    printable = _addOriginHTML(origin, printable, action);
  }
  $("#blockedResources").html(printable);
  $('.switch-toggle').each(function(){
    let radios = $(this).children('input');
    let value = $(this).children('input:checked').val();
    let slider = $("<div></div>").slider({
      min: 0,
      max: 2,
      value: parseInt(value, 10),
      create: function(event, ui){
        $(this).children('.ui-slider-handle').css('margin-left', -16 * value + 'px');
      },
      slide: function(event, ui) {
        radios.filter("[value=" + ui.value + "]").click();
      },
      stop: function(event, ui){
        $(ui.handle).css('margin-left', -16 * ui.value + "px")
      },
    }).appendTo(this);
    radios.change(function(){
      slider.slider("value", parseInt(radios.filter(':checked').val(), 10));
    });
  });
  $("#trackerLink").click(function() { self.port.emit("hidePanel"); });

  console.log("Done refreshing popup");
}

var feedTheBadgerTitle = "Click to undo manual settings.";

/**
 * Build the HTML string for an origin, to be placed in the popup.
 * @param String rawOrigin the name of the origin.
 * @param String printable a string to append the output too.
 * @param String action the action that is taken on this origin, one of ['noaction', 'block', 'cookieblock', 'usernoaction', 'userblock', 'usercookieblock']
 * @return String the html string to be printed
 */
function _addOriginHTML(rawOrigin, printable, action) {
  // Sanitize origin string, strip out any HTML tags.
  var origin = rawOrigin.replace(/</g, '').replace(/>/g, '');
  var classes = ["clicker", "tooltip"];
  var title = feedTheBadgerTitle;
  if (action.indexOf("user") === 0) {
    classes.push("userset");
    action = action.substr(4);
  } else {
    title = '';
  }
  if (action == "block" || action == "cookieblock") {
    classes.push(action);
  }
  var classText = 'class="' + classes.join(" ") + '"';

  return printable + '<div ' + classText + '" data-origin="' + origin + '" tooltip="' + _badgerStatusTitle(action, origin) + '"><div class="honeybadgerPowered tooltip" tooltip="'+ title + '"></div><div class="origin">' + _trimDomains(origin,25) + '</div>' + _addToggleHtml(origin, action) + '<div class="tooltipContainer"></div></div>';
}
function _trim(str, max) {
  if (str.length >= max) {
    return str.slice(0, max-3) + '...';
  } else {
    return str;
  }
}
function _trimDomains(str, max) {
  // Depends on tld.js browserify package
  if (!tldjs.isValid(str)) {
    _trim(str, max);
  }
  let domain = tldjs.getDomain(str);
  let subdomain = tldjs.getSubdomain(str);
  if (!subdomain) {
    return _trim(str, max);
  }
  let subdomainMax = max - domain.length;
  if (subdomainMax > 3) {
    return [_trim(subdomain, subdomainMax), domain].join('.');
  } else {
    return "..." + _trim(domain,max-3);
  }
}
// Partial-reverses each domain name in a list and sorts alphabetically
function _reverseSort(list) {
  function reverseString(str) {
    return str.split('.').reverse().join('.');
  }
  return list.map(reverseString).sort().map(reverseString);
}
function _badgerStatusTitle(action, origin){
  let postfix;
  if (!origin) {
    postfix = " this tracker.";
  } else {
    postfix = " "+origin+".";
  }

  var statusMap = {
    block: "Blocked",
    cookieblock: "Blocked cookies from",
    noaction: "Allowed"
  };

  return _trim(statusMap[action] + postfix, 45);
}
function _addToggleHtml(origin, action){
  
  var output = "";
  output += '<div class="switch-container tooltip ' + action + '" tooltip="' + _badgerStatusTitle(action, origin)  + '">';
  output += '<div class="switch-toggle switch-3 switch-candy">';
  output += '<input id="block-' + origin + '" name="' + origin + '" value="0" type="radio" '+ _checked('block',action)+ '><label class="actionToggle" for="block-' + origin + '" data-origin="' + origin + '" data-action="block"></label>';
  output += '<input id="cookieblock-' + origin + '" name="' + origin + '" value="1" type="radio" '+ _checked('cookieblock',action)+ '><label class="actionToggle" value="1" for="cookieblock-' + origin + '" data-origin="' + origin + '" data-action="cookieblock"></label>';
  output += '<input id="noaction-' + origin + '" name="' + origin + '" value="2" type="radio" '+ _checked('noaction',action)+ '><label class="actionToggle" value="2" for="noaction-' + origin + '" data-origin="' + origin + '" data-action="noaction"></label>';
  output += '<a><img src="icons/badger-slider-handle.png"></a></div></div>';
  return output;
}
function _checked(name, action){
  if(name == action){
    return 'checked';
  } else {
    return '';
  }
}

/**
 * Methods to react to user interaction with blocker controls.
 */
function toggleBlockedStatus(elt,status) {
  if(status){
    console.log('toggle blocked status', elt, status);
    $(elt).removeClass("reset block cookieblock noaction").addClass(status);
    $(elt).addClass("userset");
    updateSettings(elt, status);
    return true;
  } else {
    console.log("ERROR: no status for", elt);
    return false;
  }
}
function updateOrigin(event){
  var $elm = $('label[for="' + event.currentTarget.id + '"]');
  var $switchContainer = $elm.parents('.switch-container').first();
  var $clicker = $elm.parents('.clicker').first();
  var origin = $clicker.data('origin');
  var action = $elm.data('action');
  $switchContainer.removeClass('reset block cookieblock noaction').addClass(action);
  toggleBlockedStatus($clicker, action);
  $clicker.find('.honeybadgerPowered').first().attr('tooltip', feedTheBadgerTitle);
  $clicker.attr('tooltip', _badgerStatusTitle(action, origin));
  $switchContainer.attr('tooltip', _badgerStatusTitle(action, origin));
  $clicker.children('.tooltipContainer').text(_badgerStatusTitle(action, origin));
}
function resetControl(event) {
  // Removes a userset setting
  var $elm = $(event.currentTarget);
  var $clicker = $elm.parents('.clicker').first();
  var origin = $clicker.attr("data-origin");
  self.port.emit("reset", origin);
}
function displayTooltip(event){
  var $elm = $(event.currentTarget);
  var $container = $elm.closest('.clicker').children('.tooltipContainer');
  $container.text($elm.attr('tooltip'));
  if ($elm.hasClass("honeybadgerPowered")) {
    $container.css('text-align', 'right');
  } else {
    $container.css('text-align', 'left');
  }
}
function hideTooltip(event){
  var $elm = $(event.currentTarget);
  var $container = $elm.closest('.clicker').children('.tooltipContainer');
  $container.text('');
}
function getCurrentClass(elt) {
  if ($(elt).hasClass("block"))
    return "block";
  else if ($(elt).hasClass("cookieblock"))
    return "cookieblock";
  else
    return "noaction";
}
function updateSettings(elt, status) {
  var $elt = $(elt);
  var origin = $elt.attr("data-origin");
  if ($elt.hasClass("userset"))
    self.port.emit("update", {origin: origin, action: status});
  else
    console.log("Got update that wasn't user-set:", origin, status);
}


/**
 * Listeners for messages from the main process.
 */

// Called when PB is active
self.port.on("show-trackers", function(settings) {
  init(true);
  refreshPopup(settings);
});

// Called when a tracker is reset
self.port.on("change-setting", changeOriginHTML);

// Called when PB is inactive
self.port.on("show-inactive", function() { init(false); });

// Shows a special header message if user has untested 3rd party cookie settings in FF
self.port.on("cookiePrefsChange", function(weirdCookiePrefs) {
  var cookiePrefsWarning = $('#cookiePrefsWarning');
  if (weirdCookiePrefs) {
    if (cookiePrefsWarning.length === 0) {
      cookiePrefsWarning = $('<p id="cookiePrefsWarning">Warning: Privacy Badger Alpha may not work as expected with <a href="https://support.mozilla.org/en-US/kb/enable-and-disable-cookies-website-preferences" target="_blank">your third-party cookie settings</a>. You may find some bugs, which you can report <a href="https://github.com/EFForg/privacybadgerfirefox/issues/" target="_blank">here</a>. Thanks for your help!</p>');
      $('#privacyBadgerHeader').prepend(cookiePrefsWarning);
    }
  } else {
    cookiePrefsWarning.remove();
  }
});

// Clean up panel state after the user closes it. This is less janky than
// cleaning up panel state as soon as the user opens the panel.
self.port.on("afterClose", cleanup);
