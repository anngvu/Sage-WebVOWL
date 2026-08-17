/**
 * The "Ontologies" toolbar menu: one row per source ontology in the loaded
 * data, with a checkbox to show/hide it and a swatch to give it one of the
 * highlight colours.
 *
 * @param graph required for refreshing after a change
 * @returns {{}}
 */
module.exports = function ( graph ){

  var ontologyGroupMenu = {},
    menuElement = d3.select("#m_ontologies"),
    menuControl = d3.select("#c_ontologies a"),
    ontologyFilter,
    colorModule,
    listContainer,
    rowsByKey = {};


  ontologyGroupMenu.setup = function ( _ontologyFilter, _colorModule ){
    ontologyFilter = _ontologyFilter;
    colorModule = _colorModule;

    menuElement.selectAll("*").remove();

    listContainer = menuElement.append("li")
      .classed("option ontologyGroupList", true);

    listContainer.append("div")
      .classed("ontologyGroupHint", true)
      .text("Checkbox hides an ontology. Swatch assigns one of " +
        colorModule.slotCount() + " highlight colours.");

    listContainer.append("div")
      .classed("ontologyGroupRows", true);

    var actions = menuElement.append("li")
      .classed("option ontologyGroupActions", true);

    addAction(actions, "Show all", function (){
      ontologyFilter.setAllGroupsVisible(true);
      graph.update();
      ontologyGroupMenu.updateSelection();
    });

    addAction(actions, "Hide all", function (){
      ontologyFilter.setAllGroupsVisible(false);
      graph.update();
      ontologyGroupMenu.updateSelection();
    });

    addAction(actions, "Show default", function (){
      ontologyFilter.showDefaultGroups();
      graph.update();
      ontologyGroupMenu.updateSelection();
    });

    addAction(actions, "Reset", function (){
      ontologyFilter.reset();
      colorModule.reset();
      graph.update();
      ontologyGroupMenu.updateGroups();
    });

    menuControl.on("mouseover", function (){
      graph.options().searchMenu().hideSearchEntries();
    });
  };

  function addAction( container, label, handler ){
    container.append("button")
      .classed("ontologyGroupAction", true)
      .text(label)
      .on("click", function (){
        d3.event.preventDefault();
        handler();
      });
  }

  /**
   * Rebuilds the rows from the loaded ontology. Called after every load,
   * because the set of source ontologies is data dependent.
   */
  ontologyGroupMenu.updateGroups = function (){
    if ( !listContainer ) {
      return;
    }

    var groups = ontologyFilter.availableGroups();
    var rowContainer = listContainer.select(".ontologyGroupRows");

    // Seed the highlight colours from the same ordering the rows use, so the
    // swatches match the list the user is looking at. The graph has already been
    // painted neutral by the time we get here, so repaint once after seeding.
    if ( colorModule.applyDefaultHighlights(groups) ) {
      graph.executeOntologyColorModule();
      graph.lazyRefresh();
    }

    rowContainer.selectAll("*").remove();
    rowsByKey = {};

    if ( groups.length === 0 ) {
      rowContainer.append("div")
        .classed("ontologyGroupEmpty", true)
        .text("No ontology loaded.");
      return;
    }

    groups.forEach(function ( group ){
      var row = rowContainer.append("div")
        .classed("ontologyGroupRow", true);

      var swatch = row.append("button")
        .classed("ontologyGroupSwatch", true)
        .attr("title", "Toggle highlight colour")
        .on("click", function (){
          d3.event.preventDefault();
          colorModule.toggleHighlight(group.key);
          // Colour does not affect visibility, so skip the filter pipeline.
          graph.executeOntologyColorModule();
          graph.lazyRefresh();
          ontologyGroupMenu.updateSelection();
        });

      var checkboxId = "ontologyGroup_" + group.key.replace(/[^\w]/g, "_");

      var checkbox = row.append("input")
        .classed("ontologyGroupCheckbox", true)
        .attr("id", checkboxId)
        .attr("type", "checkbox")
        .property("checked", ontologyFilter.isGroupVisible(group.key))
        .on("click", function (){
          ontologyFilter.setGroupVisible(group.key, checkbox.property("checked"));
          graph.update();
          ontologyGroupMenu.updateSelection();
        });

      row.append("label")
        .classed("ontologyGroupLabel", true)
        .attr("for", checkboxId)
        .attr("title", group.label)
        .text(group.label);

      row.append("span")
        .classed("ontologyGroupCount", true)
        .text(group.count);

      rowsByKey[group.key] = { row: row, swatch: swatch, checkbox: checkbox };
    });

    ontologyGroupMenu.updateSelection();
  };

  /** Syncs swatch colours and checkbox states with the modules. */
  ontologyGroupMenu.updateSelection = function (){
    Object.keys(rowsByKey).forEach(function ( key ){
      var row = rowsByKey[key];
      var visible = ontologyFilter.isGroupVisible(key);
      var highlighted = colorModule.isHighlighted(key);

      row.checkbox.property("checked", visible);
      row.row.classed("hiddenOntologyGroup", !visible);

      row.swatch
        .style("background-color", colorModule.colorOf(key))
        .classed("highlighted", highlighted);
    });
  };

  ontologyGroupMenu.reset = function (){
    if ( !ontologyFilter || !colorModule ) {
      return;
    }
    ontologyFilter.reset();
    colorModule.reset();
    ontologyGroupMenu.updateGroups();
  };


  return ontologyGroupMenu;
};
