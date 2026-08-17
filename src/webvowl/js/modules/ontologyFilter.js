var filterTools = require("../util/filterTools")();
var ontologyGroups = require("../util/ontologyGroups")();

/**
 * Hides all nodes belonging to a source ontology the user switched off.
 * Properties left dangling by a hidden node are tidied away by filterTools.
 */
module.exports = function (){

  var filter = {},
    nodes,
    properties,
    filteredNodes,
    filteredProperties,
    availableGroups = [],
    defaultsApplied = false,
    hiddenGroups = d3.set();


  /**
   * Collected once per loaded ontology, before any filtering has run, so the
   * menu always lists every group the ontology contains -- not just the ones
   * currently visible.
   */
  filter.initialize = function ( untouchedNodes ){
    availableGroups = ontologyGroups.collect(untouchedNodes);

    // The app opens on the default set rather than on everything: the imported
    // upper-level ontologies dwarf the governance terms and bury them.
    if ( !defaultsApplied ) {
      filter.showDefaultGroups();
      defaultsApplied = true;
      return;
    }

    // Drop stale selections from a previously loaded ontology.
    var stillPresent = d3.set(availableGroups.map(function ( group ){
      return group.key;
    }));
    hiddenGroups.values().forEach(function ( key ){
      if ( !stillPresent.has(key) ) {
        hiddenGroups.remove(key);
      }
    });
  };

  /**
   * Shows only the vocabularies in ontologyGroups' default set, hiding the
   * rest. Groups the loaded ontology does not contain are simply absent.
   */
  filter.showDefaultGroups = function (){
    hiddenGroups = d3.set(availableGroups.filter(function ( group ){
      return !ontologyGroups.isDefaultVisible(group.key);
    }).map(function ( group ){
      return group.key;
    }));
    return filter;
  };

  filter.filter = function ( untouchedNodes, untouchedProperties ){
    nodes = untouchedNodes;
    properties = untouchedProperties;

    if ( !hiddenGroups.empty() ) {
      var filteredData = filterTools.filterNodesAndTidy(nodes, properties, isVisible);
      nodes = filteredData.nodes;
      properties = filteredData.properties;
    }

    filteredNodes = nodes;
    filteredProperties = properties;
  };

  function isVisible( node ){
    return !hiddenGroups.has(ontologyGroups.keyOf(node));
  }

  /** The groups present in the loaded ontology, ordered for display. */
  filter.availableGroups = function (){
    return availableGroups;
  };

  filter.isGroupVisible = function ( key ){
    return !hiddenGroups.has(key);
  };

  filter.setGroupVisible = function ( key, visible ){
    if ( visible ) {
      hiddenGroups.remove(key);
    } else {
      hiddenGroups.add(key);
    }
    return filter;
  };

  filter.setAllGroupsVisible = function ( visible ){
    if ( visible ) {
      hiddenGroups = d3.set();
    } else {
      hiddenGroups = d3.set(availableGroups.map(function ( group ){
        return group.key;
      }));
    }
    return filter;
  };

  filter.hiddenGroupCount = function (){
    return hiddenGroups.size();
  };

  /** Restores the startup state, i.e. the default set -- not everything. */
  filter.reset = function (){
    filter.showDefaultGroups();
  };


  // Functions a filter must have
  filter.filteredNodes = function (){
    return filteredNodes;
  };

  filter.filteredProperties = function (){
    return filteredProperties;
  };


  return filter;
};
