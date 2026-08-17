var elementTools = require("./elementTools")();
var ontologyGroups = require("./ontologyGroups")();

/**
 * Derives a browsable class hierarchy from the parsed ontology.
 *
 * VOWL models rdfs:subClassOf as an ordinary property, so the hierarchy has to
 * be rebuilt from those edges: domain is the subclass, range the superclass.
 * The result is a forest grouped by source ontology, because the governance
 * ontology has ~60 classes with no superclass at all and a flat list of those
 * is not something anyone can navigate.
 *
 * Strictly speaking subClassOf forms a DAG, not a tree. A class with several
 * superclasses is emitted once under each of them; every row therefore carries
 * a `path` that is unique even when the same class appears twice, and cycles
 * are broken by refusing to descend into one of a row's own ancestors.
 */
module.exports = (function (){

  var tools = {};


  /**
   * A display label for a node, falling back to the local part of its IRI --
   * labelForCurrentLanguage() is undefined for classes that carry no rdfs:label.
   */
  tools.labelOf = function ( node ){
    var label = node.labelForCurrentLanguage && node.labelForCurrentLanguage();
    if ( label ) {
      return label;
    }

    var iri = node.iri && node.iri();
    if ( iri ) {
      var local = iri.split(/[#/]/).filter(function ( part ){
        return part.length > 0;
      }).pop();
      if ( local ) {
        return local;
      }
    }

    return node.type ? node.type() : "unnamed";
  };

  /**
   * Named classes only. Datatypes and literals have no subclass structure, and
   * anonymous constructs (set operators, restrictions) are not browsable, so
   * neither belongs in a class tree.
   */
  function isBrowsableClass( node ){
    if ( elementTools.isDatatype(node) ) {
      return false;
    }
    return !!(node.iri && node.iri());
  }

  /**
   * @returns {{parents: Object, children: Object}} id -> array of node
   */
  function collectEdges( nodes, properties ){
    var byId = {};
    nodes.forEach(function ( node ){
      byId[node.id()] = node;
    });

    var parents = {};
    var children = {};

    (properties || []).forEach(function ( property ){
      if ( !elementTools.isRdfsSubClassOf(property) ) {
        return;
      }

      var child = property.domain();
      var parent = property.range();
      if ( !child || !parent ) {
        return;
      }
      // Only edges between two browsable classes we actually hold.
      if ( !byId[child.id()] || !byId[parent.id()] ) {
        return;
      }
      if ( !isBrowsableClass(child) || !isBrowsableClass(parent) ) {
        return;
      }
      if ( child.id() === parent.id() ) {
        return;
      }

      (parents[child.id()] = parents[child.id()] || []).push(parent);
      (children[parent.id()] = children[parent.id()] || []).push(child);
    });

    return { parents: parents, children: children };
  }

  function sortByLabel( nodes ){
    return nodes.slice().sort(function ( a, b ){
      return tools.labelOf(a).localeCompare(tools.labelOf(b));
    });
  }

  /**
   * Builds the forest: one group per source ontology, and inside each group the
   * subClassOf hierarchy restricted to that ontology's own classes.
   *
   * Grouping the *roots* by ontology was the obvious reading, but on an
   * OBO-derived ontology it is useless: BFO is the upper ontology, so a single
   * "BFO" group swallows almost every class and the project's own terms end up
   * scattered several levels down inside it. Grouping every class by its
   * ontology instead means each vocabulary is browsable on its own, and the
   * group counts line up with the Ontologies menu.
   *
   * Cross-ontology parentage is not lost: a class whose superclass lives in
   * another ontology becomes a root of its own group and records that parent in
   * `externalParents`.
   *
   * @param nodes all class nodes of the ontology (unfiltered)
   * @param properties all properties of the ontology (unfiltered)
   * @returns {Array} group rows: {type:"group", key, label, count, children}
   *   whose descendants are
   *   {type:"class", id, node, label, groupKey, path, externalParents, children}
   */
  tools.build = function ( nodes, properties ){
    var classes = (nodes || []).filter(isBrowsableClass);
    var edges = collectEdges(classes, properties);
    var parents = edges.parents;
    var children = edges.children;

    var groupOf = {};
    var byGroup = {};
    classes.forEach(function ( node ){
      var key = ontologyGroups.keyOf(node);
      groupOf[node.id()] = key;
      (byGroup[key] = byGroup[key] || []).push(node);
    });

    function sameGroup( a, b ){
      return groupOf[a.id()] === groupOf[b.id()];
    }

    return Object.keys(byGroup).map(function ( key ){
      var seenPaths = {};

      function toRow( node, parentPath, ancestorIds ){
        var path = parentPath + "/" + node.id();

        // Two superclasses within the group can share a superclass, which
        // would otherwise emit the same path twice.
        if ( seenPaths[path] ) {
          return null;
        }
        seenPaths[path] = true;

        var ownAncestors = {};
        Object.keys(ancestorIds).forEach(function ( id ){
          ownAncestors[id] = true;
        });
        ownAncestors[node.id()] = true;

        var childRows = sortByLabel((children[node.id()] || []).filter(function ( child ){
          return sameGroup(child, node);
        }))
          .filter(function ( child ){
            return !ancestorIds[child.id()];   // cycle guard
          })
          .map(function ( child ){
            return toRow(child, path, ownAncestors);
          })
          .filter(Boolean);

        return {
          type: "class",
          id: node.id(),
          node: node,
          label: tools.labelOf(node),
          groupKey: groupOf[node.id()],
          path: path,
          externalParents: (parents[node.id()] || []).filter(function ( parent ){
            return !sameGroup(parent, node);
          }).map(tools.labelOf),
          children: childRows
        };
      }

      // Roots of a group: no superclass inside the same group.
      var roots = byGroup[key].filter(function ( node ){
        return (parents[node.id()] || []).every(function ( parent ){
          return !sameGroup(parent, node);
        });
      });

      var rows = sortByLabel(roots).map(function ( node ){
        return toRow(node, key, {});
      }).filter(Boolean);

      return {
        type: "group",
        key: key,
        label: ontologyGroups.labelOf(key),
        count: countRows(rows),
        children: rows
      };
    }).sort(function ( a, b ){
      var rankDiff = ontologyGroups.rankOf(a.key) - ontologyGroups.rankOf(b.key);
      if ( rankDiff !== 0 ) {
        return rankDiff;
      }
      if ( b.count !== a.count ) {
        return b.count - a.count;
      }
      return a.label.localeCompare(b.label);
    });
  };

  function countRows( rows ){
    return rows.reduce(function ( total, row ){
      return total + 1 + countRows(row.children);
    }, 0);
  }

  tools.countRows = countRows;


  return function (){
    return tools;
  };
})();
