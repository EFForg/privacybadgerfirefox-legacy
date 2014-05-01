/**
 * Initializes the popup panel UI depending on whether PB is active
 * for the current page.
 */
function init(isActive)
{
  console.log("Initializing popup.js");

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
    $("#detected").html("Click to deactivate Privacy Badger on this site.");
  }, function () {
    $("#detected").html(trackerStatus);
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
    $("#detected").html("Click to activate Privacy Badger on this site.");
  }, function () {
    $("#detected").html("Click the badger icon to activate Privacy Badger on this site.");
  });
  $("#detected").html("Click the badger icon to activate Privacy Badger on this site.");
  $("#blockedResources").html("");
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
  let restoreHTML = '<div id="restoreButtonDiv" class="modalButton">Unblock sites . . .</div>';
  let reportHTML = '<div id="reportButtonDiv" class="modalButton">Report a bug . . .</div>';
  let deleteMySettingsHTML = '<div id="deleteMySettingsButtonDiv" class="modalButton">Unblock <b>my</b> blocked sites</div>';
  let deleteAllSettingsHTML = '<div id="deleteAllSettingsButtonDiv" class="modalButton">Unblock <b>all</b> blocked sites</div>';
  let comingSoonHTML = '<div id="messageDiv" class="vexMessage"></div>';
  let contentHTML = restoreHTML + reportHTML + deleteMySettingsHTML + deleteAllSettingsHTML + comingSoonHTML;
  vex.open({
    content: contentHTML,
    appendLocation: 'body',
    css: {'width':'80%',
          'margin-left':'auto',
          'margin-right':'auto',
          'margin-top': '28px'
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
    $('#deleteMySettingsButtonDiv').hide();
    $('#deleteAllSettingsButtonDiv').hide();
    $('#messageDiv').hide();
    $('.modalButton').hover(function() {
      $(this).toggleClass('buttonActive');
    });
    // Button to globally disable PB. Currently unreachable (intentionally).
    $('#disableButtonDiv').click(function() {
      self.port.emit("deactivate");
      vex.close();
    });
    // Button to clear blockers
    $('#restoreButtonDiv').click(function() {
      $('#disableButtonDiv').slideUp();
      $('#restoreButtonDiv').slideUp();
      $('#reportButtonDiv').slideUp();
      $('#deleteMySettingsButtonDiv').slideDown();
      $('#deleteAllSettingsButtonDiv').slideDown();
    });
    // Button to report bugs
    $('#reportButtonDiv').click(function() {
      window.open("https://github.com/EFForg/privacybadgerfirefox/issues?state=open",
                  "_blank");
      vex.close();
    });
    // Button to clear all userset blockers.
    $('#deleteMySettingsButtonDiv').click(function() {
      self.port.emit("deleteUserSettings");
      $('#deleteMySettingsButtonDiv').slideUp();
      $('#deleteAllSettingsButtonDiv').slideUp();
      vex.close();
    });
    // Button to clear all blockers.
    $('#deleteAllSettingsButtonDiv').click(function() {
      self.port.emit("deleteAllSettings");
      $('#deleteMySettingsButtonDiv').slideUp();
      $('#deleteAllSettingsButtonDiv').slideUp();
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
function refreshPopup(settings) {
  if (settings.cleared) {
    trackerStatus = "Reload the page to see active trackers.";
    $("#detected").html(trackerStatus);
    $("#blockedResources").html("");
    return;
  }
  var origins = Object.keys(settings);
  if (!origins || origins.length === 0) {
    trackerStatus = "Could not detect any tracking cookies.";
    $("#detected").html(trackerStatus);
    $("#blockedResources").html("");
    return;
  }
  trackerStatus = "Detected <a id='trackerLink' target=_blank tabindex=-1 title='What is a tracker?' href='https://www.eff.org/privacybadger#trackers'>trackers</a> from these sites:";
  $("#detected").html(trackerStatus);
  var printable = '<div id="associatedTab" data-tab-id="' + 0 + '"></div>';
  for (var i=0; i < origins.length; i++) {
    var origin = origins[i];
    var action = settings[origin];
    // todo: gross hack, use templating framework
    printable = _addOriginHTML(origin, printable, action);
    console.log('adding html for', origin, action);
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

  console.log("Done refreshing popup");
}
var feedTheBadgerTitle = "Click to undo manual settings.";
function _addOriginHTML(origin, printable, action) {
  console.log("Popup: adding origin HTML for " + origin);
  var classes = ["clicker", "tooltip"];
  var title = feedTheBadgerTitle;
  if (action.indexOf("user") === 0) {
    classes.push("userset");
    action = action.substr(4);
  } else {
    title = '';
  }
  if (action == "block" || action == "cookieblock")
    classes.push(action);
  var classText = 'class="' + classes.join(" ") + '"';

  return printable + '<div ' + classText + '" data-origin="' + origin + '" data-original-action="' + action + '" tooltip="' + _badgerStatusTitle(action, origin) + '"><div class="honeybadgerPowered tooltip" tooltip="'+ title + '"></div><div class="origin">' + _trim(origin,25) + '</div>' + _addToggleHtml(origin, action) + '<div class="tooltipContainer"></div></div>';
}
function _trim(str,max){
  if(str.length >= max){
    return str.slice(0,max-3)+'...';
  } else {
    return str;
  }
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

  /* This was copied from PB chrome. Unclear what it does; delete?
  var originalAction = elt.getAttribute('data-original-action');
  if ($(elt).hasClass("block"))
    $(elt).toggleClass("block");
  else if ($(elt).hasClass("cookieblock")) {
    $(elt).toggleClass("block"); // Why is this here?
    $(elt).toggleClass("cookieblock");
  }
  else
    $(elt).toggleClass("cookieblock");
  if ($(elt).hasClass(originalAction) ||
      (originalAction == 'noaction' && !($(elt).hasClass("block") ||
                                         $(elt).hasClass("cookieblock"))))
    $(elt).removeClass("userset");
  else
    $(elt).addClass("userset");
   */
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
  $clicker.children('.tooltipContainer').html(_badgerStatusTitle(action, origin));
}
function resetControl(event) {
  // Removes a userset setting
  var $elm = $(event.currentTarget);
  var $clicker = $elm.parents('.clicker').first();
  var origin = $clicker.attr("data-origin");
  self.port.emit("reset", origin);
  // Don't let the user toggle settings until refresh
  $clicker.removeClass("reset block cookieblock noaction").addClass("reset");
  $clicker.find("input").prop("disabled", true);
  $clicker.click(function (event) {
    event.stopPropagation();
  });
  $elm.css('background', 'None');
  $elm.css('cursor', 'default');
  $clicker.find('.honeybadgerPowered').first().attr('tooltip', '');
  $elm.removeClass("userset");
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

// Called when PB is inactive
self.port.on("show-inactive", function() { init(false); });

// Shows a special header message if user has disabled 3rd party cookies in FF
self.port.on("cookiePrefsChange", function(prefBlocksCookies) {
  var cookiePrefsWarning = $('#cookiePrefsWarning');
  if (prefBlocksCookies) {
    if (cookiePrefsWarning.length === 0) {
      cookiePrefsWarning = $('<p id="cookiePrefsWarning">Your cookie preferences are changed from the defaults. This may reduce the effectiveness of Privacy Badger. <a href="https://support.mozilla.org/en-US/kb/enable-and-disable-cookies-website-preferences" target="_blank">Learn more</a>.</p>');
      $('#privacyBadgerHeader').prepend(cookiePrefsWarning);
    }
  } else {
    cookiePrefsWarning.remove();
  }
});

// Clean up panel state after the user closes it. This is less janky than
// cleaning up panel state as soon as the user opens the panel.
self.port.on("afterClose", cleanup);
