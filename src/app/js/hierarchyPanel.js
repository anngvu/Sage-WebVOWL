/**
 * A collapsible class-hierarchy browser on the left edge.
 *
 * Deliberately a panel of its own rather than a section inside leftSidebar:
 * that one is wired to editor-mode default-element picking and editSidebar
 * reaches into its layout, so hosting an unrelated tree there would entangle
 * two features. This panel only borrows its visual language.
 *
 * The tree always shows the whole hierarchy. Rows whose ontology is switched
 * off, or which the graph is not currently rendering, are dimmed rather than
 * removed -- the degree-of-collapsing slider hides most nodes most of the time,
 * and a tree that reshuffled to match would be useless for orientation.
 *
 * @param graph required for highlighting and for reading the parsed ontology
 */
module.exports = function ( graph ){

  // Taken off the global rather than require()d: webvowl and webvowl.app are
  // separate webpack entry points, so requiring these here would bundle a
  // *second* copy of elementTools and of the property classes. The graph's
  // rdfs:subClassOf instances would then fail `instanceof` against the app
  // bundle's copy, the builder would find no edges at all, and every class
  // would look like a root.
  var classHierarchy = webvowl.util.classHierarchy();
  var ontologyGroups = webvowl.util.ontologyGroups();

  var hierarchyPanel = {},
    ontologyFilter,
    colorModule,
    container = d3.select("#containerForHierarchyPanel"),
    content = d3.select("#hierarchyPanelContent"),
    collapseButton = d3.select("#hierarchyCollapseButton"),
    countLabel = d3.select("#hierarchyPanelCount"),
    expanded = {},
    rowsByPath = {},
    visible = false,
    captured = null,
    tree = [];


  /**
   * A pass-through filter module registered first in the pipeline. It exists
   * only for its initialize() hook: that is the one point where the graph hands
   * out fully parsed, fully linked, unfiltered data. Building the tree any
   * earlier -- e.g. straight after graph.load() returns -- yields a tree with no
   * subClassOf edges at all, because every class still looks like a root.
   */
  hierarchyPanel.dataModule = function (){
    var module = {},
      passedNodes,
      passedProperties;

    module.initialize = function ( nodes, properties ){
      captured = { nodes: nodes, properties: properties };
      hierarchyPanel.updateTree();
    };

    module.filter = function ( nodes, properties ){
      passedNodes = nodes;
      passedProperties = properties;
    };

    module.filteredNodes = function (){
      return passedNodes;
    };

    module.filteredProperties = function (){
      return passedProperties;
    };

    return module;
  };

  hierarchyPanel.setup = function ( _ontologyFilter, _colorModule ){
    ontologyFilter = _ontologyFilter;
    colorModule = _colorModule;

    collapseButton.on("click", function (){
      d3.event.preventDefault();
      hierarchyPanel.setVisible(!visible);
    });

    // Cheap way to keep the dimming honest: whatever the user changed
    // elsewhere (degree slider, filters), refresh as the pointer arrives.
    container.on("mouseenter", function (){
      hierarchyPanel.updateRowState();
    });

    hierarchyPanel.setVisible(false);
  };

  hierarchyPanel.setVisible = function ( show ){
    // Only one panel may occupy the left edge at a time.
    if ( show ) {
      var leftSidebar = graph.options().leftSidebar();
      // isSidebarVisible() is the sidebar's own synchronous flag.
      // getSidebarVisibility() reads a class that it only sets once its expand
      // animation ends, so it would miss a sidebar that is still opening.
      if ( leftSidebar && leftSidebar.isSidebarVisible() ) {
        leftSidebar.showSidebar(0);
      }
    }

    visible = show;
    container.classed("hidden", !show);
    collapseButton.classed("active", show);
    collapseButton.attr("title", show ? "Hide class hierarchy" : "Show class hierarchy");
    collapseButton.select(".sidePanelTabArrow").text(show ? "\u25c2" : "\u25b8");

    if ( show ) {
      hierarchyPanel.updateRowState();
    }
  };

  hierarchyPanel.isVisible = function (){
    return visible;
  };

  /** Rebuilds the tree from the loaded ontology. Called after every load. */
  hierarchyPanel.updateTree = function (){
    if ( content.empty() ) {
      return;
    }

    var data = captured || graph.getUnfilteredData();
    tree = data && data.nodes ? classHierarchy.build(data.nodes, data.properties) : [];

    expanded = {};
    rowsByPath = {};
    content.selectAll("*").remove();

    if ( tree.length === 0 ) {
      content.append("div")
        .classed("hierarchyEmpty", true)
        .text("No class hierarchy in this ontology.");
      countLabel.text("");
      return;
    }

    // Open the project's own terms by default; imports stay folded away.
    if ( ontologyGroups.rankOf(tree[0].key) === 0 ) {
      expanded[tree[0].key] = true;
    }

    tree.forEach(function ( group ){
      renderGroup(group, content);
    });

    var total = tree.reduce(function ( sum, group ){
      return sum + group.count;
    }, 0);
    countLabel.text(total + " classes");

    hierarchyPanel.updateRowState();
  };

  function renderGroup( group, parentSelection ){
    var row = parentSelection.append("div")
      .classed("hierarchyGroupRow", true)
      .attr("title", group.label);

    row.append("span")
      .classed("hierarchyTwisty", true)
      .text(expanded[group.key] ? "▾" : "▸");

    row.append("span")
      .classed("hierarchyDot", true);

    row.append("span")
      .classed("hierarchyGroupLabel", true)
      .text(group.label);

    row.append("span")
      .classed("hierarchyCount", true)
      .text(group.count);

    var childContainer = parentSelection.append("div")
      .classed("hierarchyChildren", true)
      .classed("hidden", !expanded[group.key]);

    row.on("click", function (){
      d3.event.preventDefault();
      expanded[group.key] = !expanded[group.key];
      row.select(".hierarchyTwisty").text(expanded[group.key] ? "▾" : "▸");
      childContainer.classed("hidden", !expanded[group.key]);
    });

    group.children.forEach(function ( child ){
      renderRow(child, childContainer);
    });

    rowsByPath[group.key] = { row: row, groupKey: group.key, isGroup: true };
  }

  function renderRow( entry, parentSelection ){
    var external = entry.externalParents && entry.externalParents.length > 0;

    var row = parentSelection.append("div")
      .classed("hierarchyRow", true)
      .attr("data-node-id", entry.id)
      .attr("title", external ?
        entry.label + "  (subclass of " + entry.externalParents.join(", ") + ")" :
        entry.label);

    var hasChildren = entry.children.length > 0;

    var twisty = row.append("span")
      .classed("hierarchyTwisty", true)
      .classed("hierarchyTwistyLeaf", !hasChildren)
      .text(hasChildren ? "▸" : "");

    row.append("span")
      .classed("hierarchyDot", true);

    row.append("span")
      .classed("hierarchyLabel", true)
      .text(entry.label);

    // Marks a class whose superclass lives in another ontology, so the tree
    // does not silently imply it is a top-level term.
    if ( external ) {
      row.append("span")
        .classed("hierarchyExternalParent", true)
        .text("\u2197");
    }

    if ( hasChildren ) {
      row.append("span")
        .classed("hierarchyCount", true)
        .text(entry.children.length);
    }

    var childContainer = null;
    if ( hasChildren ) {
      childContainer = parentSelection.append("div")
        .classed("hierarchyChildren hidden", true);

      twisty.on("click", function (){
        d3.event.stopPropagation();
        d3.event.preventDefault();
        toggle(entry, twisty, childContainer);
      });
    }

    // Clicking the row focuses the class in the graph. highLightNodes copes
    // with ids that are not currently on screen, so this works for rows the
    // graph has filtered away too.
    row.on("click", function (){
      d3.event.preventDefault();
      selectRow(entry);
    });

    rowsByPath[entry.path] = {
      row: row,
      entry: entry,
      groupKey: entry.groupKey,
      isGroup: false
    };

    entry.children.forEach(function ( child ){
      renderRow(child, childContainer);
    });
  }

  function toggle( entry, twisty, childContainer ){
    expanded[entry.path] = !expanded[entry.path];
    twisty.text(expanded[entry.path] ? "▾" : "▸");
    childContainer.classed("hidden", !expanded[entry.path]);
  }

  function selectRow( entry ){
    Object.keys(rowsByPath).forEach(function ( path ){
      rowsByPath[path].row.classed("hierarchyRowSelected", path === entry.path);
    });

    graph.resetSearchHighlight();
    graph.highLightNodes([entry.id]);
    graph.locateSearchResult();
  }

  /**
   * Repaints the ontology dots and dims rows that are hidden by the ontology
   * filter or simply not being rendered right now.
   */
  hierarchyPanel.updateRowState = function (){
    if ( !colorModule ) {
      return;
    }

    // nodeMap only holds nodes currently in the force layout.
    var nodeMap = graph.getNodeMapForSearch ? graph.getNodeMapForSearch() : [];

    Object.keys(rowsByPath).forEach(function ( path ){
      var stored = rowsByPath[path];
      var groupVisible = !ontologyFilter || ontologyFilter.isGroupVisible(stored.groupKey);

      stored.row.select(".hierarchyDot")
        .style("background-color", colorModule.colorOf(stored.groupKey));

      if ( stored.isGroup ) {
        stored.row.classed("hierarchyRowHiddenOntology", !groupVisible);
        return;
      }

      var onScreen = nodeMap && nodeMap[stored.entry.id] !== undefined;
      stored.row.classed("hierarchyRowHiddenOntology", !groupVisible);
      stored.row.classed("hierarchyRowOffScreen", groupVisible && !onScreen);
    });
  };

  hierarchyPanel.reset = function (){
    hierarchyPanel.setVisible(false);
    hierarchyPanel.updateTree();
  };


  return hierarchyPanel;
};
