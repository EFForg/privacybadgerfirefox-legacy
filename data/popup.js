var privacy_badger = $( "#privacy_badger" ).html();
var loading = $( "#loading" ).html();
var frequently_asked_questions = $( "#frequently_asked_questions" ).html();
var deactivate_on_site = $( "#deactivate_on_site" ).html();
var activate_on_site = $( "#activate_on_site" ).html();
var click_badger_activate_on_site = $( "#click_badger_activate_on_site" ).html();
var settings_unblock = $( "#settings_unblock" ).html();
var settings_disable = $( "#settings_disable" ).html();
var settings_report = $( "#settings_report" ).html();
var restore_button = $( "#restore_button" ).html();
var status_reload = $( "#status_reload" ).html();
var status_none_detected = $( "#status_none_detected" ).html();
var no_tracking = $( "#notracking" ).html();
var pb_detected = $( "#pb_detected" ).html();
var potential = $( "#potential" ).html();
var trackers = $( "#trackers" ).html();
var from_these_sites = $( "#from_these_sites" ).html();
var feed_the_badger_title = $( "#feed_the_badger_title" ).html();
var unblock_all = $( "#unblock_all" ).html();
var disable_on_page = $( "#disable_on_page" ).html();
var report_bug = $( "#report_bug" ).html();
var report_field = $( "#report_field" ).html();
var cur_settings;
// jshint moz:true
/**
 * Initializes the popup panel UI depending on whether PB is active
 * for the current page.
 */
function init(isActive, settings) {
  console.log("Initializing popup.js");
  
  cur_settings = settings;
  $(".hidePanel").click(function() { self.port.emit("hidePanel"); });

  // If not active, just show an activation button
  if (!isActive) {
    resetHTML();
    return;
  }

  // Initialize more HTML if PB is active
  $("#badgerImg2").hide();
  $("#badgerImg").show();
  $("#enableButton").hide();
  $("#disableButton").show();
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
    $("#error_input").attr("placeholder", report_field );
  });
  registerListeners();
}

/**
 * sends error report data
 */
function send_error(message) {
  var to_send = {};
  for (var key in cur_settings){
    var action = cur_settings[key];
    if (to_send[action]){
      to_send[action] += ","+key;
    }
    else {
      to_send[action] = key;
    }
  }
  to_send["browser"] =  window.navigator.userAgent;
  to_send["message"] = message;
  to_send["date"] = Date.now();
  self.port.emit("report", to_send);
}

/**
 * Sets HTML for inactive state.
 */
function resetHTML() {
  $("#badgerImg").hide();
  $("#badgerImg2").show();
  $("#disableButton").hide();
  $("#enableButton").show();
  $("#badgerImg2").hover(function () {
    $("#detected").text(activate_on_site);
  }, function () {
    $("#detected").text(click_badger_activate_on_site);
  });
  $("#detected").text(click_badger_activate_on_site);
  $("#blockedResources").text("");
  $("#gearImg").hide();
  registerListeners();
  return;
}

/**
 * Listeners for click events in the panel header.
 */
function registerListeners(){
  var overlay = $('#overlay');
  $("#badgerImg2").click(function() { self.port.emit("activateSite"); });
  $("#badgerImg").click(function() { self.port.emit("deactivateSite"); });
  $("#enableButton").click(function() { self.port.emit("activateSite"); });
  $("#disableButton").click(function() { self.port.emit("deactivateSite"); });
  $('#helpImg').click(function() { self.port.emit("openHelp"); });
  $('#gearImg').click(function() { self.port.emit("openOptions"); });
  $("#error").click(function(){ overlay.toggleClass('active'); });
  $("#report_cancel").click(function(){ overlay.toggleClass('active'); });
  $("#report_button").click(function(){
    send_error($("#error_input").val());
    overlay.toggleClass('active');
  });
}

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
    trackerStatus = status_reload;
    $("#detected").text(trackerStatus);
    $("#blockedResources").text("");
    return;
  }
  $("#detected").removeClass('noTracker');
  var origins = Object.keys(settings);
  if (!origins || origins.length === 0) {
    trackerStatus = status_none_detected;
    $("#detected").text(trackerStatus);
    $("#detected").addClass('noTracker');
    $("#blockedResources").text("");
    return;
  }
  let sortedOrigins = _reverseSort(origins);
  trackerStatus = pb_detected + " <span id='count'>0</span> " + potential + " <a id='trackerLink' target=_blank tabindex=-1 title='What is a tracker?' href='https://www.eff.org/privacybadger#trackers'>" + trackers + "</a> " + from_these_sites;
  $("#detected").html(trackerStatus);
  var printable = '<div id="associatedTab" data-tab-id="' + 0 + '"></div>';
  printable += '<div class="key">' +
    '<div class="keyTipOuter"><div class="tooltipContainer" id="keyTooltip"></div></div>' + 
    '<img class="tooltip" src="icons/UI-icons-red.png" tooltip="Move the slider left to block a domain.">'+
    '<img class="tooltip" src="icons/UI-icons-yellow.png" tooltip="Center the slider to block cookies.">'+
    '<img class="tooltip" src="icons/UI-icons-green.png" tooltip="Move the slider right to allow a domain.">'+
    '</div><div id="blockedOriginsInner">';
  var notracking = [];
  var count = 0;
  for (let i=0; i < sortedOrigins.length; i++) {
    var origin = sortedOrigins[i];
    var action = settings[origin];
    if (action == "notracking"){
      notracking.push(origin);
      continue;
    }
    count++;
    // todo: gross hack, use templating framework
    printable = _addOriginHTML(origin, printable, action);
  }
  $('#count').text(count);
  if(notracking.length > 0){
    printable = printable +
        '<div class="clicker" id="notracking">' + no_tracking + '</div>';
    for (let i = 0; i < notracking.length; i++){
      printable = _addOriginHTML(notracking[i], printable, "noaction");
    }
  }
  printable += "</div>";
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
        $(ui.handle).css('margin-left', -16 * ui.value + "px");
      },
    }).appendTo(this);
    radios.change(function(){
      slider.slider("value", parseInt(radios.filter(':checked').val(), 10));
    });
  });
  $("#trackerLink").click(function() { self.port.emit("hidePanel"); });

  console.log("Done refreshing popup");
}

var feedTheBadgerTitle = feed_the_badger_title;

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

  return printable + '<div ' + classText + '" data-origin="' + origin + '" tooltip="' + _badgerStatusTitle(action, origin) + '"><div class="honeybadgerPowered tooltip" tooltip="'+ title + '"></div><div class="origin">' + _trimDomains(origin,25) + '</div>' + _addToggleHtml(origin, action) + '<img class="tooltipArrow" src="icons/badger-tb-arrow.png"><div class="tooltipContainer"></div></div>';
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
  if($container.length === 0){
    $container = $elm.siblings('.keyTipOuter').children('.tooltipContainer');
  }
  $container.text($elm.attr('tooltip')).show();
  $container.siblings('.tooltipArrow').show();
}
function hideTooltip(event){
  var $elm = $(event.currentTarget);
  var $container = $elm.closest('.clicker').children('.tooltipContainer');
  if($container.length === 0){
    $container = $elm.siblings('.keyTipOuter').children('.tooltipContainer');
  }
  $container.text('').hide();
  $container.siblings('.tooltipArrow').hide();
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
  init(true, settings);
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

self.port.on("hide", function(){
  $("#badgerImg2").off();
  $("#badgerImg").off();
  $("#enableButton").off();
  $("#disableButton").off();
  $('#gearImg').off();
  $('#helpImg').off();
  $("#error").off();
  $("#report_cancel").off();
  $("#report_button").off();
});

// Clean up panel state after the user closes it. This is less janky than
// cleaning up panel state as soon as the user opens the panel.
