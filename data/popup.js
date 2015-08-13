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
var local_storage;
var cur_settings;
// jshint moz:true
/**
 * Initializes the popup panel UI depending on whether PB is active
 * for the current page.
 */
function init(isActive, settings, seenComic) {
  console.log("Initializing popup.js");
  
  cur_settings = settings;
  $(".hidePanel").click(function() { self.port.emit("hidePanel"); });

  // If not active, just show an activation button
  if (!isActive) {
    resetHTML();
    return;
  }

  $("#blockedResources").css('max-height', 315);
  $("#firstRun").hide();
  if (!seenComic) {
    $("#blockedResources").css('max-height', 245);
    $("#firstRun").show();
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
  $("#firstRun").hide();
  registerListeners();
  return;
}

function reportClose(overlay){
  overlay.toggleClass("active", false);
  $("#error_input").val("");
  $("#report_fail").toggleClass("hidden", true);
  $("#report_success").toggleClass("hidden", true);
}

/**
 * Listeners for click events in the panel header.
 */
function registerListeners(){
  var overlay = $('#overlay');
  $("#firstRun").click(function() { 
    self.port.emit("openSlideshow"); });
  $("#badgerImg2").click(function() { self.port.emit("activateSite"); });
  $("#badgerImg").click(function() { self.port.emit("deactivateSite"); });
  $("#enableButton").click(function() { self.port.emit("activateSite"); });
  $("#disableButton").click(function() { self.port.emit("deactivateSite"); });
  $('#helpImg').click(function() { self.port.emit("openHelp"); });
  $('#gearImg').click(function() { self.port.emit("openOptions"); });
  $("#error").click(function(){ overlay.toggleClass('active'); });
  $("#report_cancel").click(function(){
    reportClose(overlay);
  });
  $("#report_button").click(function(){
    $(this).prop("disabled", true);
    $("#report_cancel").prop("disabled", true);
    send_error($("#error_input").val());
  });
  $("#report_close").click(function(){
    reportClose(overlay);
  });
}

/**
 * a function to find which domain is on the blocklist
 * when getting the action for the eTLD+1
 */
function getTopLevel(action, origin){
  if (action == "usercookieblock"){
    let baseDomain = tldjs.getDomain(origin);
    if(local_storage.userYellow && 
        !local_storage.userYellow.hasOwnProperty(origin) &&
        local_storage.userYellow.hasOwnProperty(baseDomain)) {
      return baseDomain;
    } else {
      return origin;
    }
  }
  if (action == "userblock"){
    let baseDomain = tldjs.getDomain(origin);
    if(local_storage.userRed && 
        !local_storage.userRed.hasOwnProperty(origin) &&
        local_storage.userRed.hasOwnProperty(baseDomain)) {
      return baseDomain;
    } else {
      return origin;
    }
  }
  if (action == "usernoaction"){
    let baseDomain = tldjs.getDomain(origin);
    if(local_storage.userGreen && 
        !local_storage.userGreen.hasOwnProperty(origin) &&
        local_storage.userGreen.hasOwnProperty(baseDomain)) {
      return baseDomain;
    } else {
      return origin;
    }
  }
}


/**
 * Methods to add HTML for showing and controlling blockers. Called after init.
 * Possible states for action:
 *  noaction, block, cookieblock, usernoaction, userblock, usercookieblock
 */
var trackerStatus;
function changeOriginHTML(setting) {
  let printable = _addOriginHTML(setting.origin, setting.action, setting.flag);
  $("div[data-origin='"+setting.origin+"']").replaceWith(printable);
}
function refreshPopup(settings) {
  $("#loader").fadeOut();
  $("#detected").fadeIn();
  $("#blockedResources").fadeIn();
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
  var compressedOrigins = {};
  for (let i=0; i < sortedOrigins.length; i++) {
    var origin = sortedOrigins[i];
    var action = settings[origin];
    if (action == "notracking"){
      notracking.push(origin);
      continue;
    } else {
      if (action.contains("user")){
        var prevOrigin = origin;
        origin = getTopLevel(action, origin);
        if (prevOrigin != origin){
          if (compressedOrigins.hasOwnProperty(origin)){
            compressedOrigins[origin]['subs'].push(prevOrigin.replace(origin, ''));
            continue;
          }
          compressedOrigins[origin] = {'action': action, 'subs':[prevOrigin.replace(origin, '')]};
          continue;
        }
      }
    }
    var flag = window.local_storage && local_storage.policyWhitelist[origin];
    count++;
    // todo: gross hack, use templating framework
    printable += _addOriginHTML(origin, action, flag);
  }
  for (key in compressedOrigins){
    var flag2 = window.local_storage && local_storage.policyWhitelist[origin];
    printable += _addOriginHTML( key, compressedOrigins[key]['action'], flag2, compressedOrigins[key]['subs'].length);
  }
  $('#count').text(count);
  if(notracking.length > 0){
    printable = printable +
        '<div class="clicker" id="notracking">' + no_tracking + '</div>';
    for (let i = 0; i < notracking.length; i++){
      printable += _addOriginHTML(notracking[i], "noaction", false);
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
 * @param String action the action that is taken on this origin, one of ['noaction', 'block', 'cookieblock', 'usernoaction', 'userblock', 'usercookieblock']
 * @param bool flag flag wether the domain respects DNT
 * @return String the html string to be printed
 */
function _addOriginHTML(rawOrigin, action, flag, multiTLD) {
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
  var multiText = "";
  if(multiTLD){
    multiText = " ("+multiTLD+" subdomains)";
  }
  var flagText = "";
  if(flag){
    flagText = "<div id='dnt-compliant'>" + 
      "<a target=_blank href='https://www.eff.org/privacybadger#faq--I-am-an-online-advertising-/-tracking-company.--How-do-I-stop-Privacy-Badger-from-blocking-me?'>" +
      "<img src='icons/dnt-16.png' title='This domain promises not to track you.'></a></div>";
  }
  var classText = 'class="' + classes.join(" ") + '"';
  //TODO do something with the flag here to show off opt-out sites
  return '<div ' + classText + '" data-origin="' + origin + '" tooltip="' + _badgerStatusTitle(action, origin) + '"><div class="honeybadgerPowered tooltip" tooltip="'+ title + '"></div> <div class="origin">'+ flagText + _trimDomains(origin + multiText,25) + '</div>' + _addToggleHtml(origin, action) + '<img class="tooltipArrow" src="icons/badger-tb-arrow.png"><div class="tooltipContainer"></div></div>';
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
self.port.on("show-trackers", function(settings, storage, seenComic) {
  init(true, settings, seenComic);
  local_storage = storage;
  refreshPopup(settings);
});

// Called when a tracker is reset
// which never seems to happen?
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
  $("#loader").show();
  $("#detected").hide();
  $("#blockedResources").hide();
  $("#firstRun").off();
});

self.port.on("report-success", function(){
  var overlay = $('#overlay');
  $("#report_success").toggleClass("hidden");
  setTimeout(function(){
    $("#report_button").prop("disabled", false);
    $("#report_cancel").prop("disabled", false);
    reportClose(overlay);
  }, 3000);
});

self.port.on("report-fail", function(){
  $("#report_fail").toggleClass("hidden");
  setTimeout(function(){
    $("#report_button").prop("disabled", false);
    $("#report_cancel").prop("disabled", false);
    $("#report_fail").toggleClass("hidden", true);
  }, 3000);
});
// Clean up panel state after the user closes it. This is less janky than
// cleaning up panel state as soon as the user opens the panel.
