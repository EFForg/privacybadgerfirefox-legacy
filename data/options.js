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
  });

  // Display jQuery UI elements
  $("#tabs").tabs();
  $("button").button();
  $(".refreshButton").button("option", "icons", {primary: "ui-icon-refresh"});
  $(".addButton").button("option", "icons", {primary: "ui-icon-plus"});
  $(".removeButton").button("option", "icons", {primary: "ui-icon-minus"});
}
$(loadOptions);


