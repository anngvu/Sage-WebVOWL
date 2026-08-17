var ontologyGroups = require("../util/ontologyGroups")();

/**
 * Colors nodes and properties by the ontology they come from.
 *
 * Colour is a scarce resource here: a node-link graph puts arbitrary pairs of
 * ontologies next to each other, so every pair of highlight colours has to be
 * told apart on its own. Only four hues clear that bar -- 5+ cannot meet the
 * normal-vision separation floor at any lightness, chroma or hue rotation --
 * so the palette holds four slots and everything else renders neutral grey.
 * Highlights are therefore assigned to the groups the user is comparing right
 * now, rather than spread thinly over every group at once.
 *
 * Palette: slots 1-3 of the reference categorical palette plus its violet.
 * Validated all-pairs against a white surface: worst CVD dE 9.2 (>= 8 target),
 * worst normal-vision dE 16.3 (>= 15 floor). Node labels double as the
 * secondary encoding, and label ink is picked per fill for contrast.
 */
module.exports = function (){

  var PALETTE = [
    "#2a78d6", // blue
    "#eb6834", // orange
    "#1baf7a", // aqua
    "#4a3aa7"  // violet
  ];
  var NEUTRAL = "#9a9a94";
  var DEFAULT_HIGHLIGHT_COUNT = PALETTE.length;

  var filter = {},
    nodes,
    properties,
    filteredNodes,
    filteredProperties,
    enabled = true,
    highlighted = [],
    defaultsApplied = false;


  /**
   * Gives the first few groups a colour up front so the graph is differentiated
   * on first paint. Driven by the caller's already-ordered group list rather
   * than by this module's own view of the data: as the last module in the
   * filter pipeline it only ever sees post-filter elements, which would put the
   * default highlights out of step with the order shown in the menu.
   *
   * @returns {boolean} true if highlights were seeded, i.e. a repaint is due
   */
  filter.applyDefaultHighlights = function ( groups ){
    if ( defaultsApplied ) {
      return false;
    }

    var candidates = (groups || []).filter(function ( group ){
      return !ontologyGroups.isAnonymous(group.key);
    });

    // Prefer the vocabularies that start visible, so the colours on screen at
    // startup belong to the groups the user can actually see. Any remaining
    // slots are left free rather than spent on hidden groups.
    var preferred = candidates.filter(function ( group ){
      return ontologyGroups.isDefaultVisible(group.key);
    });

    highlighted = (preferred.length > 0 ? preferred : candidates)
      .slice(0, DEFAULT_HIGHLIGHT_COUNT)
      .map(function ( group ){
        return group.key;
      });

    defaultsApplied = highlighted.length > 0;
    return defaultsApplied;
  };

  filter.filter = function ( untouchedNodes, untouchedProperties ){
    nodes = untouchedNodes;
    properties = untouchedProperties;

    var elements = (nodes || []).concat(properties || []);

    elements.forEach(function ( element ){
      if ( !enabled ) {
        element.backgroundColor(null);
        return;
      }

      // "deprecated" owns its own styling and takes precedence.
      if ( element.visualAttributes && element.visualAttributes().indexOf("deprecated") >= 0 ) {
        element.backgroundColor(null);
        return;
      }

      element.backgroundColor(filter.colorOf(ontologyGroups.keyOf(element)));
    });

    filteredNodes = nodes;
    filteredProperties = properties;
  };

  /** The colour a group currently renders in, or the neutral grey. */
  filter.colorOf = function ( key ){
    var slot = highlighted.indexOf(key);
    return slot >= 0 ? PALETTE[slot] : NEUTRAL;
  };

  filter.isHighlighted = function ( key ){
    return highlighted.indexOf(key) >= 0;
  };

  /**
   * Toggles a group's highlight. When all slots are taken the
   * longest-standing highlight is evicted, so a click always does something
   * visible instead of silently failing.
   */
  filter.toggleHighlight = function ( key ){
    var slot = highlighted.indexOf(key);

    if ( slot >= 0 ) {
      highlighted.splice(slot, 1);
    } else {
      if ( highlighted.length >= PALETTE.length ) {
        highlighted.shift();
      }
      highlighted.push(key);
    }

    return filter;
  };

  filter.highlightedGroups = function (){
    return highlighted.slice();
  };

  filter.slotCount = function (){
    return PALETTE.length;
  };

  filter.neutralColor = function (){
    return NEUTRAL;
  };

  filter.enabled = function ( p ){
    if ( !arguments.length ) return enabled;
    enabled = p;
    return filter;
  };

  filter.reset = function (){
    enabled = true;
    defaultsApplied = false;
    highlighted = [];
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
