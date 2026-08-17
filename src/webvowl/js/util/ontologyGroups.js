/**
 * Maps ontology elements onto the source ontology they came from.
 *
 * VOWL's own `baseIri` is too coarse to drive per-ontology filtering: every OBO
 * term (IAO, BFO, DUO, RO, OBI, ...) collapses into a single
 * "http://purl.obolibrary.org/obo" bucket, and anonymous constructs carry no
 * baseIri at all. So grouping keys off the term IRI and splits OBO by its term
 * prefix, falling back to baseIri and finally to an "anonymous" bucket.
 *
 * Keys are self describing -- "obo:IAO", "prov", "iri:<namespace>",
 * "anonymous" -- so labels and ordering are derived from the key alone and
 * never depend on which elements have been seen so far.
 */
module.exports = (function (){

  var tools = {};

  var ANONYMOUS_KEY = "anonymous";
  var OBO_PREFIX = "obo:";
  var IRI_PREFIX = "iri:";

  // Rank orders the groups in the UI: the project's own terms first, then
  // imported vocabularies, then plumbing nobody usually cares about.
  var RANK_OWN = 0;
  var RANK_IMPORT = 1;
  var RANK_PLUMBING = 2;

  // OBO term prefix -> display label. Unlisted prefixes still get their own
  // group, labelled with the bare prefix.
  var OBO_LABELS = {
    IAO: "IAO · Information Artifact",
    BFO: "BFO · Basic Formal",
    DUO: "DUO · Data Use",
    RO: "RO · Relations",
    OBI: "OBI · Biomedical Investigation",
    COB: "COB · Core Biology",
    PATO: "PATO · Phenotypic Quality",
    UO: "UO · Units",
    APOLLO_SV: "APOLLO-SV · Infectious Disease",
    GAZ: "GAZ · Gazetteer",
    MONDO: "MONDO · Disease",
    NCBITaxon: "NCBI Taxon"
  };

  // Matched in order against the element IRI, then against its baseIri; the
  // first match wins, so a more specific namespace must come before a broader
  // one. Groups are named after the prefix the ontology itself declares.
  var NAMESPACES = [
    // sagegov: <https://synapse.org/synbiont/governance/>
    { match: "synapse.org/synbiont", key: "sagegov", label: "sagegov", rank: RANK_OWN },
    // sagebrain: <https://w3id.org/synapse/sagebrain#>. Deliberately matches the
    // shapes namespace <…/sagebrain/shapes#> too -- shapes are constraints over
    // the same vocabulary, and they are not merged into the visualized graph
    // anyway, so they do not need a group of their own.
    { match: "w3id.org/synapse/sagebrain", key: "sagebrain", label: "sagebrain", rank: RANK_OWN },
    // biolink: <https://w3id.org/biolink/vocab/>. Ranked as an import, but it is
    // not a peripheral one: sagebrain reuses biolink:Gene, biolink:Pathway and
    // biolink:participates_in by IRI, so hiding this group takes two of the
    // model's own element types off the canvas. Hence its place in
    // DEFAULT_VISIBLE below. The sagebrain rule above cannot swallow these terms
    // -- the import module's own IRI lives under …/synapse/sagebrain/imports/,
    // but the terms it declares are in the biolink namespace.
    { match: "w3id.org/biolink", key: "biolink", label: "Biolink · Biomedical Model", rank: RANK_IMPORT },
    { match: "w3.org/ns/prov", key: "prov", label: "PROV-O · Provenance", rank: RANK_IMPORT },
    { match: "w3.org/2001/XMLSchema", key: "xsd", label: "XSD datatypes", rank: RANK_PLUMBING },
    { match: "w3.org/2000/01/rdf-schema", key: "rdfs", label: "RDFS", rank: RANK_PLUMBING },
    { match: "w3.org/1999/02/22-rdf-syntax-ns", key: "rdf", label: "RDF", rank: RANK_PLUMBING },
    { match: "w3.org/2002/07/owl", key: "owl", label: "OWL", rank: RANK_PLUMBING },
    { match: "w3.org/2004/02/skos", key: "skos", label: "SKOS", rank: RANK_PLUMBING },
    { match: "purl.org/dc/terms", key: "dcterms", label: "DC Terms", rank: RANK_PLUMBING },
    { match: "purl.org/dc/elements", key: "dc", label: "DC Elements", rank: RANK_PLUMBING },
    { match: "geneontology.org/formats/oboInOwl", key: "oboinowl", label: "oboInOwl", rank: RANK_PLUMBING },
    { match: "owl2vowl.de", key: "owl2vowl", label: "OWL2VOWL internal", rank: RANK_PLUMBING }
  ];

  // "…/obo/IAO_0000102" -> IAO, "…/obo/APOLLO_SV_00000522" -> APOLLO_SV
  var OBO_TERM = /purl\.obolibrary\.org\/obo\/([A-Za-z][A-Za-z0-9]*(?:_[A-Za-z]{2,})*)_\d+/;

  /**
   * The vocabularies worth looking at first: this project's own ontologies plus
   * the imports they are actually modelled against. Everything else -- the OBO
   * upper-level scaffolding, XSD, RDF/RDFS, OWL -- is structural and starts
   * hidden. This is the app's startup state and what "Show default" and "Reset"
   * restore.
   *
   * Keys listed here that the loaded ontology does not contain are simply
   * absent, so a vocabulary can be listed before it is merged into the graph.
   *
   * Five entries against four highlight slots in ontologyColorSwitch, so on a
   * build that contains all five the last one starts neutral grey until the
   * user assigns it a swatch. That is the deliberate cost of biolink being here:
   * two of the model's element types (gene, pathway) ARE biolink terms, so
   * leaving it out would hide them at startup, which is worse than a group
   * starting uncoloured. The default sagebrain-only build resolves to two groups
   * and is unaffected; only WITH_GOVERNANCE=1 reaches five.
   */
  var DEFAULT_VISIBLE = ["sagegov", "sagebrain", "biolink", "prov", "obo:DUO"];


  function namespaceByKey( key ){
    for ( var i = 0; i < NAMESPACES.length; i++ ) {
      if ( NAMESPACES[i].key === key ) {
        return NAMESPACES[i];
      }
    }
    return undefined;
  }

  function keyForIri( iri ){
    if ( !iri ) {
      return undefined;
    }

    var oboMatch = OBO_TERM.exec(iri);
    if ( oboMatch ) {
      return OBO_PREFIX + oboMatch[1];
    }

    for ( var i = 0; i < NAMESPACES.length; i++ ) {
      if ( iri.indexOf(NAMESPACES[i].match) > -1 ) {
        return NAMESPACES[i].key;
      }
    }

    return undefined;
  }

  /** Drops the local name from a term IRI, leaving its namespace. */
  function namespaceOfIri( iri ){
    var hash = iri.lastIndexOf("#");
    if ( hash > -1 ) {
      return iri.substring(0, hash + 1);
    }

    var slash = iri.lastIndexOf("/");
    if ( slash > -1 ) {
      return iri.substring(0, slash + 1);
    }

    return iri;
  }

  /**
   * Derives a readable label for a namespace we have no explicit entry for,
   * e.g. "http://example.org/vocab/core#" -> "example.org/core".
   */
  function labelForUnknownNamespace( namespace ){
    var stripped = namespace.replace(/^\w+:\/\//, "").replace(/[#/]+$/, "");
    var parts = stripped.split(/[#/]/).filter(function ( part ){
      return part.length > 0;
    });

    if ( parts.length === 0 ) {
      return namespace;
    }
    if ( parts.length === 1 ) {
      return parts[0];
    }
    return parts[0] + "/" + parts[parts.length - 1];
  }

  /**
   * The group key of a single element. Elements with neither an IRI nor a
   * baseIri -- set operators, restrictions and other anonymous constructs --
   * share one bucket so they can still be hidden as a unit.
   */
  tools.keyOf = function ( element ){
    if ( !element ) {
      return ANONYMOUS_KEY;
    }

    var iri = typeof element.iri === "function" ? element.iri() : undefined;
    var baseIri = typeof element.baseIri === "function" ? element.baseIri() : undefined;

    var key = keyForIri(iri) || keyForIri(baseIri);
    if ( key ) {
      return key;
    }

    // An unrecognised vocabulary still gets its own group rather than being
    // lumped in with the anonymous constructs. A baseIri is already a
    // namespace; a term IRI has to have its local name removed first.
    if ( baseIri ) {
      return IRI_PREFIX + baseIri;
    }
    if ( iri ) {
      return IRI_PREFIX + namespaceOfIri(iri);
    }

    return ANONYMOUS_KEY;
  };

  tools.labelOf = function ( key ){
    if ( !key || key === ANONYMOUS_KEY ) {
      return "Anonymous constructs";
    }

    if ( key.indexOf(OBO_PREFIX) === 0 ) {
      var prefix = key.substring(OBO_PREFIX.length);
      return OBO_LABELS[prefix] || prefix;
    }

    if ( key.indexOf(IRI_PREFIX) === 0 ) {
      return labelForUnknownNamespace(key.substring(IRI_PREFIX.length));
    }

    var namespace = namespaceByKey(key);
    return namespace ? namespace.label : key;
  };

  tools.rankOf = function ( key ){
    if ( !key || key === ANONYMOUS_KEY ) {
      return RANK_PLUMBING;
    }

    if ( key.indexOf(OBO_PREFIX) === 0 || key.indexOf(IRI_PREFIX) === 0 ) {
      return RANK_IMPORT;
    }

    var namespace = namespaceByKey(key);
    return namespace ? namespace.rank : RANK_IMPORT;
  };

  tools.isAnonymous = function ( key ){
    return !key || key === ANONYMOUS_KEY;
  };

  /** Group keys visible on startup, in their intended display order. */
  tools.defaultVisibleKeys = function (){
    return DEFAULT_VISIBLE.slice();
  };

  tools.isDefaultVisible = function ( key ){
    return DEFAULT_VISIBLE.indexOf(key) > -1;
  };

  /**
   * Buckets the given elements and returns the groups ordered for display:
   * the project's own terms first, then imports by descending size, then
   * plumbing. Each entry is {key, label, count}.
   */
  tools.collect = function ( elements ){
    var counts = {};

    (elements || []).forEach(function ( element ){
      var key = tools.keyOf(element);
      counts[key] = (counts[key] || 0) + 1;
    });

    return Object.keys(counts).map(function ( key ){
      return { key: key, label: tools.labelOf(key), count: counts[key] };
    }).sort(function ( a, b ){
      var rankDiff = tools.rankOf(a.key) - tools.rankOf(b.key);
      if ( rankDiff !== 0 ) {
        return rankDiff;
      }
      if ( b.count !== a.count ) {
        return b.count - a.count;
      }
      return a.label.localeCompare(b.label);
    });
  };


  return function (){
    return tools;
  };
})();
