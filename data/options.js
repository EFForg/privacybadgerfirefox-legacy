// Loads options from localStorage and sets UI elements accordingly
function loadOptions() {
  // Add event listeners

  // load resources for filter sliders
  $(function () {
    $('#blockedResourcesContainer').on('change', 'input:radio', updateOrigin);   
    // TODO get tooltips to work 
    //$('#blockedResourcesContainer').on('mouseenter', '.tooltip', displayTooltip);
    //$('#blockedResourcesContainer').on('mouseleave', '.tooltip', hideTooltip);   
    $('#blockedResourcesContainer').on('click', '.userset .honeybadgerPowered', revertDomainControl);

    $('.addButton').click(addDomainException);
    $('.removeButton').click(removeDomainExceptions);
    $('.prefToggle').change(updateUserPref);
  });


  // Display jQuery UI elements
  $("#tabs").tabs();
  $("button").button();
  $(".refreshButton").button("option", "icons", {primary: "ui-icon-refresh"});
  $(".addButton").button("option", "icons", {primary: "ui-icon-plus"});
  $(".removeButton").button("option", "icons", {primary: "ui-icon-minus"});

  // Request settings from addon - defined in lib/ui.js
  self.port.emit('reqSettings');

  self.port.on('recvSettings', function(options){
    // Options contains the following objects
    // storage: localStorage for the addon, defined in lib/userStorage
    // prefs: from the simple-prefs sdk
    console.log('got storage');
    loadDisabledSites(options.storage.disabledSites);
    loadPrefs(options.prefs);
  });
}
$(loadOptions);

function updateOrigin(){
  return;
}

function revertDomainControl(){
  return;
}

function loadDisabledSites(disabledSites){
  $('#excludedDomainsBox').empty();
  $.each(disabledSites, function(key) {   
    $('#excludedDomainsBox')
      .append($('<option>', { value : key })
      .text(key)); 
  });
}

function removeDomainExceptions(event){
  event.preventDefault();
  var selected = $(document.getElementById("excludedDomainsBox")).find('option:selected');
  var domains = [];
  for(let i = 0; i < selected.length; i++){
    domains.push(selected[i].text);
  }
  self.port.emit('removeFromDisabledSites', domains);
}

function addDomainException(event){
  event.preventDefault();
  var domain = $('#newWhitelistDomain').val();
  $('#newWhitelistDomain').val('');
  self.port.emit('addToDisabledSites', domain);
}

function loadPrefs(prefs){
  console.log('prefs', prefs);
  var prefToggles = $('.prefToggle');
  $.each(prefToggles, function(idx, toggle){
    if(!!prefs[toggle.id]){
      $(toggle).prop('checked', true);
    }
  });
}

function updateUserPref(e){
  var target = e.target;
  self.port.emit('updateUserPref', {
    name: target.id,
    value: $(target).is(':checked')
  });
}
