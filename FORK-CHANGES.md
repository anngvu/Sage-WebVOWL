# What this fork changes

How this build differs from upstream [WebVOWL](https://github.com/VisualDataWeb/WebVOWL),
and why. See [README.md](README.md) for how to build and run it.

Not a changelog — this describes the current state of the fork's own features,
plus the upstream defects fixed along the way. The traps worth knowing *before*
you edit any of it are in the README under "Gotchas for contributors".

## One preloaded ontology, no picker

Removed: the ontology-selection dropdown, the IRI converter, file upload,
"create new ontology", direct input, and drag-and-drop loading. Kept: the
loading module's progress and error reporting, which `graph.js` calls in ~15
places and which is not worth untangling.

## An "Ontologies" menu

In the toolbar slot the picker used to occupy. One row per source vocabulary:

- the **checkbox** hides every node from that vocabulary; properties left
  dangling by a hidden node are tidied away automatically
- the **swatch** assigns one of 4 highlight colours
- **Show all / Hide all / Show default / Reset** act on every row at once

**The app starts on a default set:** the project's own ontologies plus the
imports they are modelled against — `sagegov`, `sagebrain`, Biolink, PROV-O and
DUO — with everything else hidden. The OBO upper-level scaffolding (IAO alone is 123
classes), XSD, RDF/RDFS and OWL are structural and bury the project's terms if
shown by default. On a build with governance included that is 124 nodes instead
of 340. "Show default" returns to that set from any state; "Reset" also restores
the default colours.

The set is defined once, as `DEFAULT_VISIBLE` in
`src/webvowl/js/util/ontologyGroups.js`. Keys naming an ontology the loaded build
does not contain are simply absent, so the same list works for the default
`sagebrain`-only build (where it resolves to `sagebrain` and Biolink) and for
`WITH_GOVERNANCE=1` (where it resolves to all five).

It has five members against four highlight colours, so on the governance build
the last group starts neutral grey until the user gives it a swatch. Biolink is
what pushed it past four, and it earns the seat: `sagebrain` reuses
`biolink:Gene` and `biolink:Pathway` by IRI, so a hidden Biolink group takes two
of the model's own element types off the canvas.

## Grouping is finer than VOWL's `baseIri`

VOWL puts every OBO term in a single `purl.obolibrary.org/obo` bucket, and
anonymous constructs carry no `baseIri` at all. `util/ontologyGroups.js` keys off
the term IRI instead and splits OBO by term prefix. On the full graph
(`WITH_GOVERNANCE=1`, where this matters) that is **19 distinct groups** — IAO
123, sagegov 54, BFO 35, DUO 35, PROV 30, xsd 25, sagebrain 18, … — rather than 8
useless ones. Groups are ordered project-terms-first, then imports by descending
size, then plumbing.

Keys are self-describing (`obo:IAO`, `prov`, `iri:<namespace>`, `anonymous`) and
labels/ordering derive from the key alone, so nothing depends on which elements
have been seen so far.

**Groups are named after the prefix the ontology itself declares** — `sagegov`
for `<https://synapse.org/synbiont/governance/>`, `sagebrain` for
`<https://w3id.org/synapse/sagebrain#>` — so what the UI shows matches what you
would write in a TTL file. Both are `RANK_OWN`, so this project's ontologies
always sort ahead of imports.

Adding another one is a single entry in `NAMESPACES`:

```js
{ match: "w3id.org/synapse/sagebrain", key: "sagebrain", label: "sagebrain", rank: RANK_OWN },
```

Matching is first-wins, so a narrower namespace has to be listed before a broader
one. A key listed in `DEFAULT_VISIBLE` that the loaded data does not contain is
simply absent, so a vocabulary can be registered before it is merged — which is
how `sagebrain` was wired up ahead of shipping, and why nothing in the viewer
needed changing when it did.

The `sagebrain` entry deliberately also matches its shapes namespace
(`…/sagebrain/shapes#`) rather than giving it a group of its own. The shapes are
not merged into the visualized graph at all, so a separate group would only ever
be empty.

## Colour by ontology — four slots, and why only four

This replaces upstream's "Color externals" gradient; the Modes menu entry now
reads "Color by ontology". Upstream's `colorExternalsSwitch.js` is deleted, along
with the `options.colorExternalsModule` accessor nothing set. The DOM id
`#colorExternalsOption` and the `colorexternals` setting key are kept on purpose,
so URLs and exported settings from before the change still parse.

A node-link graph puts arbitrary pairs of ontologies next to each other, so
**every** pair of highlight colours has to be distinguishable on its own — not
just adjacent pairs. Only four hues clear that bar. Five or more cannot meet the
normal-vision separation floor at any lightness, chroma or hue rotation (this was
searched, not guessed). So colour is treated as a scarce resource: 4 groups carry
a hue, everything else renders neutral grey, and you assign the hues to whatever
you are comparing. Assigning a 5th evicts the longest-standing highlight.

Palette: `#2a78d6` blue, `#eb6834` orange, `#1baf7a` aqua, `#4a3aa7` violet.
Validated all-pairs against the themed canvas (`#f1f3f5`): worst CVD ΔE 9.2
(≥ 8 target), worst normal-vision ΔE 16.3 (≥ 15 floor). Node labels are the
required secondary encoding, and label ink is chosen per fill by actual WCAG
contrast.

**The graph's node colours are deliberately not brand colours.** Both Synapse
hues fall below the categorical chroma floor (0.065 and 0.078 against 0.1) — as
node fills they read as grey — and the Synapse blue also collides with the violet
slot (ΔE 12.1). Chrome is branded; node fills stay on the validated palette.

## A class hierarchy browser

Left panel, collapsed behind a labelled tab. One group per source vocabulary,
with the subClassOf hierarchy nested inside each; row dots carry the ontology's
graph colour. Clicking a row highlights and centres that class in the graph —
including classes the degree-of-collapsing slider has hidden, since
`graph.highLightNodes` resolves ids against the unfiltered data.

Rows dim when their ontology is switched off or when the graph is not rendering
them. The tree never reshuffles to follow the graph: most nodes are collapsed
away most of the time, and a tree that followed would be useless for orientation.

Grouping *every class* by its vocabulary was a deliberate second attempt.
Grouping only the *roots* — the obvious reading — is useless here: BFO is the
upper ontology, so one "BFO" group swallowed 285 of 345 rows and the project's
own terms ended up scattered levels inside it. Cross-ontology parentage is not
lost: a class whose superclass lives elsewhere is marked `↗` and names that
parent in its tooltip.

Named classes only — datatypes have no subclass structure and anonymous
constructs are not browsable. That, plus the ~10 classes with two superclasses
appearing under each, is why the tree's counts differ slightly from the
Ontologies menu's.

## Left-edge tab rail

Both left panels (the hierarchy browser and, in editing mode, the editor's
default-element sidebar) have tabs in `#leftTabRail`, a 22px gutter, and **both
panels open at `left: 22px`** so a tab is never drawn over panel content. The
tabs stack in the rail's normal flow, which makes their separation structural —
there is no offset to keep in sync, so they cannot land on top of each other.
Each carries a short vertical label and an arrow following its own panel's state.
Opening either panel closes the other.

## Sage/Synapse branding

The WebVOWL logo and version block are gone, and the page title names the graph
("Sage ontologies") rather than the tool.
Chrome is themed from the default Synapse palette — primary blue `#395979`,
secondary green `#469285`, tertiary gold — declared as CSS custom properties at
the top of `src/app/css/toolstyle.css` and copied from `synapse-web-monorepo`
(`packages/synapse-react-client/src/theme/palette/Palettes.ts`). Sidebar and bar
surfaces use the primary blues, active states the green, affordances the gold.
Re-theming means editing the `:root` tokens.

`favicon.ico` is no longer WebVOWL's. It is a parent node forking to two children
— the shape of the class hierarchy this app exists to show — in the same primary
blue and secondary green, and it is **generated**, by
`util/favicon/make-favicon.py`, so its colours stay tied to those tokens rather
than being baked into a binary nobody can edit. Re-run that script and commit the
`.ico`.

Two things that script encodes, because they are easy to get wrong: 16×16 is the
only size most people ever see, so the artwork is drawn at 16× and downsampled
(drawing straight at 16px is ragged), and `--preview` magnifies the *reduced*
16×16 raster rather than re-rendering large — a glyph can look fine at 128px and
turn to mush at 16. Three geometries were compared that way. A hub with three
spokes loses its edges once the nodes are big enough to see; a triangle of three
connected nodes collapses toward a blob; the fork survives.

## Upstream bugs fixed along the way

These were pre-existing WebVOWL defects, found while building the features
above. Worth knowing if you ever diff against upstream.

- **`options.js` — the degree-of-collapsing setting was silently discarded.**
  `defaultOptionsConfig.doc = -1` is the "unset" sentinel, but `if ( opts.doc )`
  treats `-1` as truthy, so every load called `setGlobalDOF(-1)`. Any
  application-level `setGlobalDOF()` was dead code. Fixing it took the
  governance ontology from 2 of 54 classes visible to 52 of 54.
- **`nodeDegreeFilter` — reset the collapse slider whenever the graph came out
  empty,** even when a *different* filter emptied it, so "Hide all" silently
  destroyed the user's collapsing level. Now only fires when the degree filter
  itself is responsible.
- **`AbstractTextElement` — label ink was picked by a crude luminance
  threshold,** putting white text on mid-tone greens at 2.82:1. Now uses real
  WCAG contrast.
- **`graph.editorMode()` — guarded with `if ( create_entry )`,** which never
  fails because a d3 selection is truthy even when it matched nothing. It would
  throw once the element it referenced was removed.
