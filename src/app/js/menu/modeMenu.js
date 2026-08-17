/**
 * Contains the logic for connecting the modes with the website.
 *
 * @param graph the graph that belongs to these controls
 * @returns {{}}
 */
module.exports = function ( graph ){
  
  var modeMenu = {},
    checkboxes = [];
  
  var dynamicLabelWidthCheckBox;
  // getter and setter for the state of color modes
  modeMenu.colorModeState = function (){
    // Retained for settings import/export: the ontology palette has no
    // alternate colour mode.
    return false;
  };
  
  
  modeMenu.setDynamicLabelWidth = function ( val ){
    dynamicLabelWidthCheckBox.property("checked", val);
  };
  // getter for checkboxes
  modeMenu.getCheckBoxContainer = function (){
    return checkboxes;
  };
  /**
   * Connects the website with the available graph modes.
   */
  modeMenu.setup = function ( pickAndPin, nodeScaling, compactNotation, ontologyColor ){
    var menuEntry = d3.select("#m_modes");
    menuEntry.on("mouseover", function (){
      var searchMenu = graph.options().searchMenu();
      searchMenu.hideSearchEntries();
    });
    addCheckBoxD("labelWidth", "Dynamic label width", "#dynamicLabelWidth", graph.options().dynamicLabelWidth, 1);
    addCheckBox("editorMode", "Editing ", "#editMode", graph.editorMode);
    addModeItem(pickAndPin, "pickandpin", "Pick & pin", "#pickAndPinOption", false);
    addModeItem(nodeScaling, "nodescaling", "Node scaling", "#nodeScalingOption", true);
    addModeItem(compactNotation, "compactnotation", "Compact notation", "#compactNotationOption", true);
    // Keeps the "colorexternals" identifier so exported settings stay readable.
    addModeItem(ontologyColor, "colorexternals", "Color by ontology", "#colorExternalsOption", true);
  };
  function addCheckBoxD( identifier, modeName, selector, onChangeFunc, updateLvl ){
    var moduleOptionContainer = d3.select(selector)
      .append("div")
      .classed("checkboxContainer", true);
    
    var moduleCheckbox = moduleOptionContainer.append("input")
      .classed("moduleCheckbox", true)
      .attr("id", identifier + "ModuleCheckbox")
      .attr("type", "checkbox")
      .property("checked", onChangeFunc());
    
    moduleCheckbox.on("click", function ( d ){
      var isEnabled = moduleCheckbox.property("checked");
      onChangeFunc(isEnabled);
      d3.select("#maxLabelWidthSlider").node().disabled = !isEnabled;
      d3.select("#maxLabelWidthvalueLabel").classed("disabledLabelForSlider", !isEnabled);
      d3.select("#maxLabelWidthDescriptionLabel").classed("disabledLabelForSlider", !isEnabled);
      
      if ( updateLvl > 0 ) {
        graph.animateDynamicLabelWidth();
        // graph.lazyRefresh();
      }
    });
    moduleOptionContainer.append("label")
      .attr("for", identifier + "ModuleCheckbox")
      .text(modeName);
    if ( identifier === "editorMode" ) {
      moduleOptionContainer.append("label")
        .attr("style", "font-size:10px;padding-top:3px")
        .text("(experimental)");
    }
    
    dynamicLabelWidthCheckBox = moduleCheckbox;
  }
  
  function addCheckBox( identifier, modeName, selector, onChangeFunc ){
    var moduleOptionContainer = d3.select(selector)
      .append("div")
      .classed("checkboxContainer", true);
    
    var moduleCheckbox = moduleOptionContainer.append("input")
      .classed("moduleCheckbox", true)
      .attr("id", identifier + "ModuleCheckbox")
      .attr("type", "checkbox")
      .property("checked", onChangeFunc());
    
    moduleCheckbox.on("click", function ( d ){
      var isEnabled = moduleCheckbox.property("checked");
      onChangeFunc(isEnabled);
      if ( isEnabled === true )
        graph.showEditorHintIfNeeded();
    });
    moduleOptionContainer.append("label")
      .attr("for", identifier + "ModuleCheckbox")
      .text(modeName);
    if ( identifier === "editorMode" ) {
      moduleOptionContainer.append("label")
        .attr("style", "font-size:10px;padding-top:3px")
        .text(" (experimental)");
    }
  }
  
  function addModeItem( module, identifier, modeName, selector, updateGraphOnClick ){
    var moduleOptionContainer,
      moduleCheckbox;
    
    moduleOptionContainer = d3.select(selector)
      .append("div")
      .classed("checkboxContainer", true)
      .datum({ module: module, defaultState: module.enabled() });
    
    moduleCheckbox = moduleOptionContainer.append("input")
      .classed("moduleCheckbox", true)
      .attr("id", identifier + "ModuleCheckbox")
      .attr("type", "checkbox")
      .property("checked", module.enabled());
    
    // Store for easier resetting all modes
    checkboxes.push(moduleCheckbox);
    
    moduleCheckbox.on("click", function ( d, silent ){
      var isEnabled = moduleCheckbox.property("checked");
      d.module.enabled(isEnabled);
      if ( updateGraphOnClick && silent !== true ) {
        graph.executeOntologyColorModule();
        graph.executeCompactNotationModule();
        graph.lazyRefresh();
      }
    });
    
    moduleOptionContainer.append("label")
      .attr("for", identifier + "ModuleCheckbox")
      .text(modeName);
    
    return moduleOptionContainer;
  }
  
  /**
   * Resets the modes to their default.
   */
  modeMenu.reset = function (){
    checkboxes.forEach(function ( checkbox ){
      var defaultState = checkbox.datum().defaultState,
        isChecked = checkbox.property("checked");
      
      if ( isChecked !== defaultState ) {
        checkbox.property("checked", defaultState);
        // Call onclick event handlers programmatically
        checkbox.on("click")(checkbox.datum());
      }
      
      // Reset the module that is connected with the checkbox
      checkbox.datum().module.reset();
    });
  };
  
  /** importer functions **/
  // setting manually the values of the filter
  // no update of the gui settings, these are updated in updateSettings
  modeMenu.setCheckBoxValue = function ( id, checked ){
    for ( var i = 0; i < checkboxes.length; i++ ) {
      var cbdId = checkboxes[i].attr("id");
      
      if ( cbdId === id ) {
        checkboxes[i].property("checked", checked);
        break;
      }
    }
  };
  modeMenu.getCheckBoxValue = function ( id ){
    for ( var i = 0; i < checkboxes.length; i++ ) {
      var cbdId = checkboxes[i].attr("id");
      if ( cbdId === id ) {
        return checkboxes[i].property("checked");
      }
    }
  };
  
  // No-ops kept for the settings importers, which still call these.
  modeMenu.setColorSwitchState = function (){
  };
  modeMenu.setColorSwitchStateUsingURL = function (){
  };
  
  
  modeMenu.updateSettingsUsingURL = function (){
    var silent = true;
    checkboxes.forEach(function ( checkbox ){
      checkbox.on("click")(checkbox.datum(), silent);
    });
  };
  
  modeMenu.updateSettings = function (){
    var silent = true;
    checkboxes.forEach(function ( checkbox ){
      checkbox.on("click")(checkbox.datum(), silent);
    });
  };
  return modeMenu;
};
