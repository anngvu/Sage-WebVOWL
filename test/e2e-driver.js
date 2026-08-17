/**
 * Headless driver for the Ontologies menu. Injected into a built deploy/
 * index.html by test/run-e2e.sh, which then dumps the DOM and reads the
 * results out of #e2eOut. Dispatches real clicks so d3.event is populated.
 */
(function (){
  var out = document.getElementById("e2eOut");
  var log = [];

  function say( msg ){
    log.push(msg);
    out.textContent = log.join("\n");
  }

  // WebVOWL keeps permanent editor dragger widgets in the graph, also tagged
  // g.node but marked hidden-in-export. Only real ontology nodes are counted.
  var NODE_SELECTOR = "#graph g.node:not(.hidden-in-export)";

  function nodeCount(){
    return document.querySelectorAll(NODE_SELECTOR).length;
  }

  function nodeTitles(){
    return Array.prototype.map.call(document.querySelectorAll(NODE_SELECTOR + " title"), function ( t ){
      return t.textContent;
    });
  }

  function ready(){
    return window.webvowl && webvowl.gr && nodeCount() > 0;
  }

  function checkbox( id ){
    return document.getElementById(id);
  }

  function fillHistogram(){
    var fills = {};
    Array.prototype.forEach.call(document.querySelectorAll(NODE_SELECTOR + " circle"), function ( c ){
      fills[c.style.fill] = (fills[c.style.fill] || 0) + 1;
    });
    return fills;
  }

  var steps = [];
  var before;

  // DEFAULT_VISIBLE may name ontologies this file does not contain (sagebrain is
  // listed ahead of shipping), so the expectation is the intersection.
  function expectedDefaultKeys(){
    var available = webvowl.opts.ontologyFilter().availableGroups().map(function ( g ){
      return g.key;
    });
    return webvowl.util.ontologyGroups().defaultVisibleKeys().filter(function ( k ){
      return available.indexOf(k) > -1;
    });
  }

  function sameSet( a, b ){
    return a.length === b.length && b.every(function ( k ){ return a.indexOf(k) > -1; });
  }

  // Which ontologies are in the build depends on WITH_GOVERNANCE in the parent
  // repo, so this suite picks the groups it exercises instead of naming them. A
  // hardcoded "obo:IAO" or "sagegov" turns a perfectly good graph into a failure
  // the moment the source set changes.
  function groupsBySize(){
    return webvowl.opts.ontologyFilter().availableGroups()
      .filter(function ( g ){ return g.count > 0 && g.key !== "anonymous"; })
      .sort(function ( a, b ){ return b.count - a.count; });
  }

  // The biggest group, so hiding it is guaranteed to change the node count.
  function biggestGroup(){
    return groupsBySize()[0];
  }

  // The biggest group belonging to an ontology this project authors -- the one
  // whose classes must stay together in the hierarchy tree.
  function biggestOwnGroup(){
    var groups = webvowl.util.ontologyGroups();
    return groupsBySize().filter(function ( g ){ return groups.rankOf(g.key) === 0; })[0];
  }

  function groupCheckbox( key ){
    return checkbox("ontologyGroup_" + key.replace(/[^\w]/g, "_"));
  }

  function actionButton( label ){
    var found = null;
    d3.selectAll(".ontologyGroupAction").each(function (){
      if ( this.textContent === label ) {
        found = this;
      }
    });
    return found;
  }

  // Must run before anything mutates the filter: this is the startup state.
  steps.push(function (){
    var filter = webvowl.opts.ontologyFilter();
    var groups = webvowl.opts.ontologyGroupMenu ? filter.availableGroups() : [];
    var visible = groups.filter(function ( g ){ return filter.isGroupVisible(g.key); })
      .map(function ( g ){ return g.key; });
    var expected = expectedDefaultKeys();

    say("groups listed: " + document.querySelectorAll(".ontologyGroupRow").length);
    say("visible on startup: " + JSON.stringify(visible));
    say("default set present in this ontology: " + JSON.stringify(expected));
    say(sameSet(visible, expected)
      ? "PASS app starts on the default ontology set"
      : "FAIL startup set is " + JSON.stringify(visible) + ", expected " + JSON.stringify(expected));

    var checked = Array.prototype.filter.call(document.querySelectorAll(".ontologyGroupCheckbox"),
      function ( b ){ return b.checked; }).length;
    say("checkboxes checked: " + checked + " of " + document.querySelectorAll(".ontologyGroupCheckbox").length);
    say(checked === expected.length ? "PASS checkboxes reflect the default set"
                                    : "FAIL " + checked + " checked, expected " + expected.length);

    var highlighted = webvowl.opts.ontologyColorModule().highlightedGroups();
    say("highlighted: " + JSON.stringify(highlighted));
    say(highlighted.every(function ( k ){ return visible.indexOf(k) > -1; })
      ? "PASS colours are assigned only to visible groups"
      : "FAIL a hidden group holds a colour slot");
  });

  steps.push({ wait: 1400, fn: function (){
    // Everything downstream wants the all-visible baseline.
    actionButton("Show all").click();
    say("clicked Show all to establish the baseline");
  } });

  steps.push(function (){
    before = nodeCount();
    say("nodes, all ontologies shown: " + before);
  });

  var toggled;

  steps.push(function (){
    toggled = biggestGroup();
    var cb = toggled && groupCheckbox(toggled.key);
    if ( !cb ) {
      say("FAIL no group checkbox to toggle (groups: " + groupsBySize().length + ")");
      return;
    }
    cb.click();
    say("unchecked " + toggled.key + " (" + toggled.count + " classes, the largest group)");
  });

  steps.push(function (){
    var n = nodeCount();
    say("nodes after hiding " + toggled.key + ": " + n);
    say(n < before ? "PASS hiding an ontology removes nodes"
                   : "FAIL hiding " + toggled.key + " changed nothing");
  });

  steps.push(function (){
    groupCheckbox(toggled.key).click();
    say("re-checked " + toggled.key);
  });

  steps.push(function (){
    var n = nodeCount();
    say("nodes after re-showing " + toggled.key + ": " + n);
    say(n === before ? "PASS re-showing restores the graph" : "FAIL expected " + before + " got " + n);
  });

  steps.push(function (){
    var b = actionButton("Hide all");
    if ( !b ) {
      say("FAIL missing Hide all");
      return;
    }
    b.click();
    say("clicked Hide all");
  });

  steps.push(function (){
    var n = nodeCount();
    say("nodes after Hide all: " + n);
    if ( n !== 0 ) {
      say("  survivors: " + JSON.stringify(nodeTitles().slice(0, 10)));
    }
    say(n === 0 ? "PASS Hide all empties the graph" : "FAIL Hide all left " + n);
  });

  steps.push(function (){
    actionButton("Show all").click();
    say("clicked Show all");
  });

  steps.push(function (){
    var n = nodeCount();
    say("nodes after Show all: " + n);
    say(n === before ? "PASS Show all restores the graph" : "FAIL Show all gave " + n + ", expected " + before);
  });

  steps.push({ wait: 1600, fn: function (){
    actionButton("Show default").click();
    say("clicked Show default");
  } });

  steps.push({ wait: 1400, fn: function (){
    var filter = webvowl.opts.ontologyFilter();
    var expected = expectedDefaultKeys();
    var visible = filter.availableGroups()
      .filter(function ( g ){ return filter.isGroupVisible(g.key); })
      .map(function ( g ){ return g.key; });
    var n = nodeCount();
    say("after Show default: " + JSON.stringify(visible) + ", " + n + " nodes");
    say(sameSet(visible, expected)
      ? "PASS Show default restores the curated set"
      : "FAIL Show default gave " + JSON.stringify(visible) + ", expected " + JSON.stringify(expected));
    say(n > 0 && n < before ? "PASS Show default shows a subset of the graph"
                            : "FAIL expected fewer than " + before + " nodes, got " + n);

    // back to all-visible for the remaining steps
    actionButton("Show all").click();
  } });

  steps.push(function (){
    // Toggling a swatch must recolour without changing what is visible.
    var swatches = document.querySelectorAll(".ontologyGroupSwatch");
    var fillsBefore = JSON.stringify(fillHistogram());
    var n0 = nodeCount();

    swatches[1].click();
    say("toggled second swatch");

    setTimeout(function (){
      var n1 = nodeCount();
      say("swatch toggle: nodes " + n0 + " -> " + n1);
      say(n1 === n0 ? "PASS swatch toggle keeps visibility" : "FAIL swatch toggle changed visibility");
      say(JSON.stringify(fillHistogram()) !== fillsBefore
        ? "PASS swatch toggle recolours nodes"
        : "FAIL swatch toggle did not recolour");

      var distinct = Object.keys(fillHistogram()).length;
      say("distinct node fills on screen: " + distinct);
    }, 900);
  });

  // ---- class hierarchy panel ----

  steps.push(function (){
    // The builder, exercised against the real parsed ontology.
    var hier = webvowl.util.classHierarchy();
    var groups = webvowl.util.ontologyGroups();
    var data = webvowl.gr.getUnfilteredData();
    var tree = hier.build(data.nodes, data.properties);

    say("hierarchy groups: " + tree.length);
    say(tree.length > 0 ? "PASS hierarchy builds from the ontology" : "FAIL hierarchy came back empty");
    say(groups.rankOf(tree[0].key) === 0
      ? "PASS project's own terms sort first (" + tree[0].label + ")"
      : "FAIL first group is " + tree[0].label);

    var rows = tree.reduce(function ( n, g ){ return n + g.count; }, 0);
    say("hierarchy rows: " + rows);

    // every path must be unique, and no row may be its own ancestor
    var paths = {}, dupes = 0, deepest = 0, cyclic = 0;
    (function walk( entries, ancestors, depth ){
      deepest = Math.max(deepest, depth);
      entries.forEach(function ( e ){
        if ( paths[e.path] ) { dupes++; }
        paths[e.path] = true;
        if ( ancestors[e.id] ) { cyclic++; }
        var next = Object.create(ancestors);
        next[e.id] = true;
        walk(e.children, next, depth + 1);
      });
    })(tree.reduce(function ( acc, g ){ return acc.concat(g.children); }, []), {}, 1);

    say("max depth: " + deepest);
    say(dupes === 0 ? "PASS every row path is unique" : "FAIL " + dupes + " duplicate paths");
    say(cyclic === 0 ? "PASS no row is its own ancestor" : "FAIL " + cyclic + " cyclic rows");

    // multi-parent classes should appear once per parent
    var byId = {};
    Object.keys(paths).forEach(function ( path ){
      var id = path.split("/").pop();
      byId[id] = (byId[id] || 0) + 1;
    });
    var repeated = Object.keys(byId).filter(function ( id ){ return byId[id] > 1; });
    say("classes emitted under more than one parent: " + repeated.length);
    say(rows >= Object.keys(byId).length ? "PASS row count covers every class" : "FAIL row count too low");

    // Grouping is per class, not per root: the project's own group must hold
    // every one of its classes, not just those that happen to be roots.
    var ownClasses = biggestOwnGroup();
    var ownGroup = ownClasses && tree.filter(function ( g ){ return g.key === ownClasses.key; })[0];
    if ( !ownClasses ) {
      say("FAIL no first-party ontology group in this build");
    } else {
      say(ownClasses.key + ": " + (ownGroup ? ownGroup.count : 0) + " tree rows vs "
        + ownClasses.count + " classes in the Ontologies menu");
      say(ownGroup && ownGroup.count >= ownClasses.count - 2
        ? "PASS each ontology's own classes stay in its own group"
        : "FAIL project classes are scattered outside their group");
    }

    // every row must sit in the group it belongs to
    var misfiled = 0;
    tree.forEach(function ( g ){
      (function walk( entries ){
        entries.forEach(function ( e ){
          if ( e.groupKey !== g.key ) { misfiled++; }
          walk(e.children);
        });
      })(g.children);
    });
    say(misfiled === 0 ? "PASS no row is filed under the wrong ontology"
                       : "FAIL " + misfiled + " misfiled rows");

    // cross-ontology parentage is recorded rather than dropped
    var withExternal = 0;
    tree.forEach(function ( g ){
      (function walk( entries ){
        entries.forEach(function ( e ){
          if ( e.externalParents && e.externalParents.length > 0 ) { withExternal++; }
          walk(e.children);
        });
      })(g.children);
    });
    say("rows recording a superclass in another ontology: " + withExternal);
    say(withExternal > 0 ? "PASS cross-ontology parents are retained"
                         : "FAIL external parentage was dropped");
  });

  steps.push(function (){
    var panel = document.getElementById("containerForHierarchyPanel");
    var button = document.getElementById("hierarchyCollapseButton");
    if ( !panel || !button ) { say("FAIL hierarchy panel markup missing"); return; }
    say(panel.classList.contains("hidden") ? "PASS panel starts collapsed" : "FAIL panel starts open");
    button.click();
    say("clicked the hierarchy toggle");
  });

  steps.push(function (){
    var panel = document.getElementById("containerForHierarchyPanel");
    say(!panel.classList.contains("hidden") ? "PASS toggle opens the panel" : "FAIL panel stayed closed");
    var groupRows = document.querySelectorAll(".hierarchyGroupRow").length;
    var classRows = document.querySelectorAll(".hierarchyRow").length;
    say("group rows: " + groupRows + " | class rows: " + classRows);
    say(groupRows > 0 && classRows > 0 ? "PASS panel renders rows" : "FAIL panel rendered nothing");

    // the first group is open by default, so some rows must be on screen
    var shown = Array.prototype.filter.call(document.querySelectorAll(".hierarchyRow"), function ( r ){
      return r.offsetParent !== null;
    }).length;
    say("rows visible with only the first group expanded: " + shown);
    say(shown > 0 && shown < classRows
      ? "PASS default expansion shows the first group only"
      : "FAIL expected a partial expansion, got " + shown + " of " + classRows);
  });

  steps.push(function (){
    // expanding a collapsed group reveals more rows
    var before = Array.prototype.filter.call(document.querySelectorAll(".hierarchyRow"), function ( r ){
      return r.offsetParent !== null;
    }).length;
    var groups = document.querySelectorAll(".hierarchyGroupRow");
    groups[1].click();
    setTimeout(function (){
      var after = Array.prototype.filter.call(document.querySelectorAll(".hierarchyRow"), function ( r ){
        return r.offsetParent !== null;
      }).length;
      say("expanding a second group: " + before + " -> " + after + " visible rows");
      say(after > before ? "PASS expanding a group reveals rows" : "FAIL expansion revealed nothing");
    }, 400);
  });

  steps.push(function (){
    // Clicking a row must select it AND make the graph highlight that class.
    // Pick a row the graph is actually rendering, so a halo can appear.
    var nodeMap = webvowl.gr.getNodeMapForSearch();
    var rows = Array.prototype.filter.call(document.querySelectorAll(".hierarchyRow"), function ( r ){
      return r.offsetParent !== null && nodeMap[r.getAttribute("data-node-id")] !== undefined;
    });
    if ( rows.length === 0 ) { say("FAIL no on-screen class row to click"); return; }

    var row = rows[0];
    var label = row.querySelector(".hierarchyLabel").textContent;
    var halosBefore = document.querySelectorAll("#graph .searchResultA, #graph .searchResultB").length;
    row.click();

    setTimeout(function (){
      var selected = document.querySelectorAll(".hierarchyRowSelected").length;
      say("clicked on-screen row " + JSON.stringify(label) + "; selected rows: " + selected);
      say(selected === 1 ? "PASS clicking a row selects exactly one" : "FAIL " + selected + " rows selected");

      var halosAfter = document.querySelectorAll("#graph .searchResultA, #graph .searchResultB").length;
      say("graph halo markers: " + halosBefore + " -> " + halosAfter);
      say(halosAfter > halosBefore
        ? "PASS clicking a row highlights the class in the graph"
        : "FAIL graph did not highlight the clicked class");
    }, 800);
  });

  steps.push(function (){
    // A row the graph has collapsed away must still be clickable without error.
    var nodeMap = webvowl.gr.getNodeMapForSearch();
    var offScreen = Array.prototype.filter.call(document.querySelectorAll(".hierarchyRow"), function ( r ){
      return r.offsetParent !== null && nodeMap[r.getAttribute("data-node-id")] === undefined;
    });
    if ( offScreen.length === 0 ) {
      say("no off-screen row on display; skipping");
      return;
    }
    var label = offScreen[0].querySelector(".hierarchyLabel").textContent;
    try {
      offScreen[0].click();
      var selected = document.querySelectorAll(".hierarchyRowSelected").length;
      say("clicked off-screen row " + JSON.stringify(label) + "; selected: " + selected);
      say(selected === 1 ? "PASS off-screen rows are selectable without error"
                         : "FAIL selection broke for an off-screen row");
    } catch ( e ) {
      say("FAIL clicking an off-screen row threw: " + e.message);
    }
  });

  steps.push(function (){
    // hiding an ontology should strike through its hierarchy rows
    var before = document.querySelectorAll(".hierarchyRowHiddenOntology").length;
    var hidden = biggestGroup();
    groupCheckbox(hidden.key).click();
    setTimeout(function (){
      // dimming refreshes as the pointer arrives over the panel
      var panel = document.getElementById("containerForHierarchyPanel");
      var evt = document.createEvent("MouseEvents");
      evt.initEvent("mouseenter", true, true);
      panel.dispatchEvent(evt);
      setTimeout(function (){
        var after = document.querySelectorAll(".hierarchyRowHiddenOntology").length;
        say("struck-through rows after hiding " + hidden.key + ": " + before + " -> " + after);
        say(after > before ? "PASS hidden ontologies are marked in the tree"
                           : "FAIL tree did not mark the hidden ontology");
        groupCheckbox(hidden.key).click();
      }, 400);
    }, 600);
  });

  // ---- left-edge panel tabs ----

  function tabRect( id ){
    var el = document.getElementById(id);
    if ( !el ) { return null; }
    var r = el.getBoundingClientRect();
    return { x: r.left, y: r.top, w: r.width, h: r.height,
             hidden: el.classList.contains("hidden") || r.width === 0 };
  }

  function bothTabsVisible(){
    var a = tabRect("hierarchyCollapseButton");
    var b = tabRect("leftSideBarCollapseButton");
    return !!(a && b && !a.hidden && !b.hidden);
  }

  function tabsOverlap(){
    var a = tabRect("hierarchyCollapseButton");
    var b = tabRect("leftSideBarCollapseButton");
    return !(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y);
  }

  function panelWidth( id ){
    return Math.round(document.getElementById(id).getBoundingClientRect().width);
  }

  function hierarchyOpen(){
    return !document.getElementById("containerForHierarchyPanel").classList.contains("hidden");
  }

  var hierWasOpen;
  var editorWasWide;

  steps.push({ wait: 3500, fn: function (){
    var labels = Array.prototype.map.call(document.querySelectorAll(".sidePanelTabLabel"), function ( l ){
      return l.textContent;
    });
    say("tab labels: " + JSON.stringify(labels));
    say(labels.indexOf("Hierarchy") > -1 && labels.indexOf("Editor") > -1
      ? "PASS both tabs carry a label"
      : "FAIL a tab label is missing");

    if ( hierarchyOpen() ) {
      document.getElementById("hierarchyCollapseButton").click();
    }
    var cb = document.getElementById("editorModeModuleCheckbox");
    if ( !cb.checked ) { cb.click(); }
    say("enabled editor mode");
  } });

  steps.push(function (){
    if ( !bothTabsVisible() ) {
      say("FAIL editor tab is not visible in editor mode; overlap check would be vacuous");
      return;
    }
    var h = tabRect("hierarchyCollapseButton");
    var e = tabRect("leftSideBarCollapseButton");
    say("hierarchy tab y " + Math.round(h.y) + "-" + Math.round(h.y + h.h)
      + " | editor tab y " + Math.round(e.y) + "-" + Math.round(e.y + e.h));
    say(!tabsOverlap() ? "PASS tabs do not overlap with the editor panel open"
                       : "FAIL tabs overlap with the editor panel open");
    say(Math.round(h.y) !== Math.round(e.y) ? "PASS tabs are staggered vertically"
                                            : "FAIL tabs share the same y");
  });

  steps.push(function (){
    // The collision the stagger fixes: when the editor panel is collapsed its
    // tab slides to left:0, where the hierarchy tab already is. So the invariant
    // that matters is that the two tabs never share vertical space -- then they
    // are safe at any shared x.
    //
    // Asserted on geometry rather than by collapsing the panel and re-measuring,
    // because leftSidebar restores its tab in an animationend handler and CSS
    // animations do not complete under the browser's virtual-time budget.
    var h = tabRect("hierarchyCollapseButton");
    var e = tabRect("leftSideBarCollapseButton");
    var disjoint = (h.y + h.h <= e.y) || (e.y + e.h <= h.y);
    say("vertical spans: hierarchy " + Math.round(h.y) + "-" + Math.round(h.y + h.h)
      + ", editor " + Math.round(e.y) + "-" + Math.round(e.y + e.h));
    say(disjoint ? "PASS tab vertical spans are disjoint, so a shared x is safe"
                 : "FAIL tab vertical spans intersect; they collide at left:0");
  });

  steps.push({ wait: 1500, fn: function (){
    // Mutual exclusion, asserted on module state rather than animated widths --
    // both flags are set synchronously by the same code paths the tabs invoke.
    var panel = webvowl.opts.hierarchyPanel();
    var sidebar = webvowl.opts.leftSidebar();

    sidebar.showSidebar(1);          // make sure there is something to close
    panel.setVisible(true);
    say("opened hierarchy: hierarchy=" + panel.isVisible()
      + " editorVisible=" + !!sidebar.isSidebarVisible());
    say(panel.isVisible() && !sidebar.isSidebarVisible()
      ? "PASS opening the hierarchy closes the editor panel"
      : "FAIL editor panel stayed open under the hierarchy");
  } });

  steps.push({ wait: 1500, fn: function (){
    var panel = webvowl.opts.hierarchyPanel();
    var sidebar = webvowl.opts.leftSidebar();

    sidebar.showSidebar(1);
    say("opened editor: hierarchy=" + panel.isVisible()
      + " editorVisible=" + !!sidebar.isSidebarVisible());
    say(!panel.isVisible() && sidebar.isSidebarVisible()
      ? "PASS opening the editor panel closes the hierarchy"
      : "FAIL hierarchy stayed open under the editor panel");
  } });

  steps.push({ wait: 1500, fn: function (){
    webvowl.opts.hierarchyPanel().setVisible(true);
    say("opened the hierarchy panel for the occlusion check");
  } });

  steps.push(function (){
    // The rail's whole point: a tab must not intersect panel content at all.
    var panel = document.getElementById("containerForHierarchyPanel").getBoundingClientRect();
    var offenders = [];
    Array.prototype.forEach.call(document.querySelectorAll(".sidePanelTab"), function ( tab ){
      if ( tab.classList.contains("hidden") ) { return; }
      var t = tab.getBoundingClientRect();
      if ( t.width === 0 ) { return; }
      var hits = !(t.right <= panel.left || panel.right <= t.left ||
                   t.bottom <= panel.top || panel.bottom <= t.top);
      if ( hits ) { offenders.push(tab.id); }
    });
    say("panel starts at x " + Math.round(panel.left) + "; tabs intersecting it: "
      + JSON.stringify(offenders));
    say(offenders.length === 0 ? "PASS no tab overlaps the open panel"
                               : "FAIL tabs overlap panel content: " + offenders.join(", "));

    // and no row is covered either
    var covered = 0;
    Array.prototype.forEach.call(document.querySelectorAll(".hierarchyRow, .hierarchyGroupRow"), function ( row ){
      if ( row.offsetParent === null ) { return; }
      var r = row.getBoundingClientRect();
      Array.prototype.forEach.call(document.querySelectorAll(".sidePanelTab"), function ( tab ){
        if ( tab.classList.contains("hidden") ) { return; }
        var t = tab.getBoundingClientRect();
        if ( t.width === 0 ) { return; }
        if ( !(t.right <= r.left || r.right <= t.left || t.bottom <= r.top || r.bottom <= t.top) ) {
          covered++;
        }
      });
    });
    say("tree rows covered by a tab: " + covered);
    say(covered === 0 ? "PASS no tree row is occluded" : "FAIL " + covered + " rows occluded");
  });

  steps.push(function (){
    // Structural check that survives the sidebar's width animation: both panels
    // must be positioned clear of the rail.
    var railWidth = Math.round(document.getElementById("leftTabRail").getBoundingClientRect().width);
    var lefts = ["containerForHierarchyPanel", "containerForLeftSideBar"].map(function ( id ){
      return { id: id, left: parseInt(getComputedStyle(document.getElementById(id)).left, 10) };
    });
    say("rail width " + railWidth + "; panel lefts " + JSON.stringify(lefts));
    say(lefts.every(function ( p ){ return p.left >= railWidth; })
      ? "PASS both panels are positioned clear of the rail"
      : "FAIL a panel starts underneath the rail");
  });

  steps.push(function (){
    // Each arrow must match its own panel's state, whatever that state is --
    // pointing right when the panel is closed, left when it is open.
    var hArrow = document.querySelector("#hierarchyCollapseButton .sidePanelTabArrow").textContent;
    var eArrow = document.querySelector("#leftSideBarCollapseButton .sidePanelTabArrow").textContent;
    var hOpen = webvowl.opts.hierarchyPanel().isVisible();
    var eOpen = !!webvowl.opts.leftSidebar().isSidebarVisible();
    var expected = function ( open ){ return open ? "\u25c2" : "\u25b8"; };

    say("hierarchy open " + hOpen + " arrow " + JSON.stringify(hArrow)
      + " | editor open " + eOpen + " arrow " + JSON.stringify(eArrow));
    say(hArrow === expected(hOpen) && eArrow === expected(eOpen)
      ? "PASS each tab arrow matches its own panel's state"
      : "FAIL an arrow disagrees with its panel");
  });

  steps.push(function (){
    // Earlier steps chain their own timeouts; wait past the longest of them so
    // the tally cannot run before their assertions have landed.
    setTimeout(function (){
      var failed = log.filter(function ( l ){
        return l.indexOf("FAIL") === 0;
      }).length;
      say("");
      say(failed === 0 ? "E2E OK" : "E2E " + failed + " FAILURE(S)");
    }, 3500);
  });

  var i = 0;

  // A step is either a function or {fn, wait} when it needs longer than the
  // default before the next one runs -- the editor sidebar animates for 0.5s
  // and hides its own tab until animationend, so those checks need room.
  function runNext(){
    if ( i >= steps.length ) {
      return;
    }
    var step = steps[i++];
    var fn = typeof step === "function" ? step : step.fn;
    var wait = (typeof step === "object" && step.wait) || 900;
    try {
      fn();
    } catch ( e ) {
      say("FAIL exception in step " + i + ": " + e.message);
    }
    setTimeout(runNext, wait);
  }

  var waited = 0;
  var wait = setInterval(function (){
    waited += 100;
    if ( ready() ) {
      clearInterval(wait);
      runNext();
      return;
    }
    if ( waited > 20000 ) {
      clearInterval(wait);
      say("TIMEOUT waiting for graph");
    }
  }, 100);
})();
