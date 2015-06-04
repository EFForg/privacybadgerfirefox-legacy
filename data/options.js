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
  });


  // Display jQuery UI elements
  $("#tabs").tabs();
  $("button").button();
  $(".refreshButton").button("option", "icons", {primary: "ui-icon-refresh"});
  $(".addButton").button("option", "icons", {primary: "ui-icon-plus"});
  $(".removeButton").button("option", "icons", {primary: "ui-icon-minus"});

  // Request settings from addon - defined in lib/ui.js
  self.port.emit('reqSettings');

  self.port.on('recvSettings', function(storage){
    console.log('got storage');
    loadDisabledSites(storage.disabledSites);
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
