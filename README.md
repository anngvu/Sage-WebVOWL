# WebVOWL for Sage ontologies

A fork of [VisualDataWeb/WebVOWL](https://github.com/VisualDataWeb/WebVOWL) (MIT,
see `license.txt`; upstream credits are kept in the app's About menu), reworked
to visualize Sage's own ontologies — **sagebrain** and **sagegov**.

The ontologies, the build tooling and **the entire pipeline** live in
**`sagebrain-model`**, which is the parent repo this one is meant to be a submodule of. This
repo owns only the viewer.

The short version of what that means: this build ships one ontology and always
renders it, it can show/hide and colour nodes by which source vocabulary they
came from, and it has a class-hierarchy browser. The ontology-picker, IRI
converter and file-upload UI are gone. **[FORK-CHANGES.md](FORK-CHANGES.md)**
covers those differences in full; this file is about building and running it.

---

## Quick start

**The ontology repo owns the build.** From `sagebrain-model` (with this repo
checked out as its `webvowl/` submodule):

```
make dev        # live-reloading: edit a .ttl, the open page updates itself
make viz        # one-off build into webvowl/deploy
make serve      # …and serve it
```

**The default build is `sagebrain` alone.** The governance model is excluded until
it stabilises; add it per invocation:

```
make WITH_GOVERNANCE=1 viz
```

`make config` reports which set is in play and lists the files.

`make viz` converts the ontology, installs the JSON into this repo's
`src/app/data/`, and runs the viewer build so `deploy/` bundles it.

**This repo has no Makefile.** Everything ontology-shaped is a parent-repo
concern; everything viewer-shaped is an npm script here:

```
npm run package      # dev build into deploy/ (keeps the hot-reload hook)
npm run release      # production build into deploy/ (strips it)
npm run webserver    # grunt dev server, rebuilds bundles on change
npm run lint         # jshint
npm test             # lint + release + both headless suites
```

Those build the *viewer* against whatever ontology is already in
`src/app/data/`; they cannot produce it. If it is missing, `npm test` says so and
names the parent-repo command to run.

### Live reload while editing the ontology

`make dev` runs a static server plus a watcher. Saving a `.ttl` reconverts and
the already-open page refreshes its graph — measured end to end at **~4-5s**
(1s watcher poll + ~3s conversion + 1.5s browser poll). No manual reload, no
browser extension.

The browser half is **not** livereload. `grunt-contrib-watch`'s livereload
server does start, but `connect-livereload` (0.6, ~10 years old) never injects
its snippet into the served page on current Node, so the browser is never told
to refresh. Instead the app polls its own ontology JSON with a `HEAD` request
and, on a changed `ETag`/`Last-Modified`, reloads just the ontology through the
same path a manual reload uses — see `src/app/js/hotReload.js`. That also means
hot reload works behind *any* static server, not only grunt's.

It is dev-only: `index.html` enables it inside a `build:remove release` block,
so `grunt package` (dev) has it and `grunt release` strips it. Verified in both.

If you are editing the viewer's own JS/CSS, use `npm run webserver` in this repo
instead — that rebuilds bundles on change too.

### Prerequisites

- **A checkout of the `sagebrain-model` repo.** All Sage ontologies live there,
  along with the tooling the build needs. This repo
  is meant to live **inside** it as a submodule:

  ```
  sagebrain-model/         # the ontology repo
  ├── ontology/            #   split by stability:
  │   ├── main/            #     sagebrain -- built by default
  │   ├── governance/      #     sagegov, sagegov_axioms, data_ops -- opt-in
  │   ├── imports/         #     duo, prov (only governance needs them)
  │   └── shacl/           #     SHACL shapes (not visualized -- see below)
  ├── tools/               #   owl2vowl.jar, strip_external_flags.py
  │                        #   (robot.jar is fetched, not committed)
  ├── Makefile             #   owns the whole pipeline
  └── webvowl/             # ← this repo, as a submodule
  ```

  From a fresh clone of the parent:

  ```
  git clone --recurse-submodules <sagebrain-model repo>
  # or, in an existing clone:
  git submodule update --init --recursive
  ```

  **Use `webvowl/` as the submodule path.** The parent repo's Makefile refers to
  `WEBVOWL_DIR = webvowl` and builds this repo in place — it installs the
  converted ontology into `src/app/data/`, runs the viewer build, and serves
  `deploy/`.

  A **sibling checkout also works**, but the parent has to be told where the
  viewer is:

  ```
  make WEBVOWL_DIR=../synbiont-webvowl viz
  ```

  `make config` in the parent prints every resolved path, and it validates the
  jars and ontology modules at parse time so a missing input is named rather than
  surfacing later as make's "No rule to make target …". A missing or
  uninitialised submodule is reported by name too, with the command to fix it.

- **Java 11+** (16+ is fine — OWL2VOWL needs `--add-opens`, which the Makefile
  passes), **Python 3**, **Node**, and **chromium** on `PATH` if you want to run
  the tests.

- **ROBOT is fetched, not committed.** At 78 MB it would sit in git history
  forever, and it is a published release artifact, so the ontology repo's
  Makefile downloads a pinned release (`ROBOT_VERSION`, currently 1.9.8) on demand — `make tools`, or
  automatically on the first `make json`. `owl2vowl.jar` (11 MB) *is* committed:
  none of its GitHub releases carry a downloadable asset, so there is nothing to
  fetch.

---

## How the ontology pipeline works

The pipeline lives in the **ontology repo's** Makefile — it is the only copy.
Four steps over that repo's sources:

| Step | Tool | What it does |
|---|---|---|
| merge | `robot merge` + `annotate` | unions the source TTLs into `build/ontology_merged.ttl` and stamps the build's own IRI/title/description on it |
| prune | `robot remove` | drops obsolete OBO terms and their descendants (IAO_0000102 / _0000314 / _0000632, oboInOwl#ObsoleteClass) → `build/ontology_pruned.ttl` |
| convert | `owl2vowl` | OWL → VOWL JSON |
| post-process | `tools/strip_external_flags.py` | clears the `external` flag from our own vocabularies, which OWL2VOWL sets on everything outside the merged graph's base IRI |

That last step exists because a merged graph can only have one ontology IRI, so
OWL2VOWL marks *every other* namespace external — including the second
first-party ontology. WebVOWL then prints "(external)" under those nodes. The
script's `OWN_IRIS` list is the set of namespaces we author; it has to stay in
step with the `RANK_OWN` entries in `src/webvowl/js/util/ontologyGroups.js`,
which is where the viewer makes the same call for grouping and colour. It moves
37 elements out of "external" on a default build, 111 with governance.

The conversion writes through a PID-unique temp file and is only moved into
place after a sanity check (`MIN_CLASSES`). Both guards exist for observed
reasons:

- Stripping the target in place meant an interrupted build left a *raw*
  conversion behind, which make — seeing a target newer than its prerequisites —
  then considered up to date, so the strip was never redone.
- Two builds running at once (easy to do accidentally: `make viz` in one
  terminal while `make dev` watches in another) shared one temp path and one
  target, and produced a truncated ontology. The gate refused to install it.
  The unique temp name removes the collision; the gate is the backstop.

Concurrent builds of the same target are still not something make can make safe,
so prefer letting the watcher do the work while `make dev` is running.

That floor tracks the source set (`$(if $(WITH_GOVERNANCE),100,15)`): sagebrain
alone is ~18 classes, so a governance-sized floor would reject every default
build.

### Which sources get built

`ontology/` is split by stability, and the Makefile has one list per directory:

```
MAIN_SOURCES        ontology/main/sagebrain.ttl
GOVERNANCE_SOURCES  ontology/governance/sagegov.ttl
                    ontology/governance/sagegov_axioms.ttl
                    ontology/governance/data_ops.ttl
                    ontology/imports/duo.ttl
                    ontology/imports/prov.ttl
```

`ONTOLOGY_SOURCES` is `MAIN_SOURCES` plus, **only if `WITH_GOVERNANCE` is set**,
`GOVERNANCE_SOURCES`. Governance is unstable, so it is opt-in per invocation
rather than a list to edit — flipping it should be a conscious act, and
`make config` prints which set is in play with every file in it.

The imports live under `ontology/imports/` rather than inside `governance/`
because they are third-party vocabularies; they are listed with governance
because today nothing else references them (`sagebrain.ttl` names neither PROV-O
nor any OBO term).

Module filenames match the prefix each one declares, so a group in the UI maps to
a file without a lookup table. `ontology/governance/synapse.ttl` is in **neither**
list — at 2.9 MB it is a reference dump, not part of the graph being modelled.

The **SHACL shapes are in neither list either.** They are constraints over this
graph rather than part of it, and `sh:NodeShape` is not an OWL class, so VOWL has
nothing to draw for them. `tests/validate.py` in the parent is what checks them.

The merge target depends on the Makefile itself, because these lists live there:
adding a module whose mtime predates the last build would otherwise leave the
merge looking up to date and silently ship without it. That happened once while
wiring in sagebrain.

### The merged graph has its own identity

`robot merge` keeps only the **first** input's `owl:Ontology` header, and the
governance modules declare none — so the build used to come out with an
*anonymous* header and the sidebar read "No title available" / "No IRI set". The
merge command now chains `robot annotate` to stamp on:

```
MERGED_IRI          https://w3id.org/synapse/sagebrain-model
MERGED_VERSION_IRI  https://w3id.org/synapse/sagebrain-model/build
MERGED_TITLE        Sage Ontologies
MERGED_DESCRIPTION  A build product of ontology/… (says which sources are in it)
```

All four are Makefile variables, so changing them is a one-line edit.

**The build gets its own identity rather than borrowing a module's**, and this
matters more now that `sagebrain.ttl` is often the only input. It declares a
title, an ontology IRI *and* an `owl:versionIRI`; left alone, a pruned build
product would advertise itself as sagebrain 1.0.0, so resolving the IRI it
publishes would return something other than what is on screen.

Getting that right needed two flags that are easy to miss:

- **`--remove-annotations`.** `annotate --annotation` *adds* a triple, it does not
  replace one. Without the flag the output carried two `dcterms:title` values —
  ours and sagebrain's — and OWL2VOWL picked sagebrain's, dragging its publisher,
  source and `vann:` namespace hints along with it.
- **`--version-iri`.** `owl:versionIRI` is part of the ontology ID rather than an
  annotation, so `--remove-annotations` leaves it untouched. Overriding it keeps
  the build inside its own namespace instead of claiming a released sagebrain
  version.

Two more details worth knowing if you edit those annotations:

- **`dcterms:description`, not `rdfs:comment`.** VOWL files `rdfs:comment` under
  `header.comments`, which the sidebar never reads; `header.description` is the
  field it renders. Both were tried.
- The literals carry **no language tag** (the parent dropped them deliberately),
  so VOWL keys them under the language `"undefined"`. That still renders:
  `languageTools.textInLanguage` falls back from the requested language, to `en`,
  to `undefined`. Verified on the built page, not just in the JSON.

The sidebar's Version still reads `--`. A version for a build product would have
to mean something — a git describe, or the ontology repo's release tag — so it is
deliberately left unset rather than filled with something arbitrary.

### The output path matters

The converted JSON is written to **`src/app/data/sage.json`**, not to a
top-level `data/`. That is because webpack copies `src/app/data/` into
`deploy/data/` — an ontology generated anywhere else is silently not packaged,
and the app 404s on startup while looking perfectly healthy at build time.

The name is neutral because the file is the union of every Sage ontology. 
It appears in exactly two places, which have to
agree: `DEFAULT_JSON_NAME` in `src/app/js/loadingModule.js` and `WEBVOWL_DATA` in
the parent's Makefile. It is **gitignored here** — it is a build artifact of
`ontology/` in the parent, not a source file of this repo.

### Which ontology gets loaded

`DEFAULT_JSON_NAME` in `src/app/js/loadingModule.js`. The URL is still parsed for
graph options (`#opts=…`) but never to choose what to load.

---

## What this fork changes

Moved to **[FORK-CHANGES.md](FORK-CHANGES.md)** — the "Ontologies" menu, grouping
finer than VOWL's `baseIri`, the four-slot colour scheme and why there are only
four, the class hierarchy browser, the left-edge tab rail, and the Sage/Synapse
theming, each with the reasoning behind it. The four **upstream WebVOWL bugs**
fixed along the way are documented at the end of that file.

---

## Gotchas for contributors

Things that cost real debugging time here.

- **Never `require()` a `src/webvowl/` module from `src/app/` code.** `webvowl`
  and `webvowl.app` are separate webpack entry points, so requiring across the
  boundary bundles a *second copy* of the module. Any `instanceof` check then
  compares against a different constructor and silently returns false. This
  produced a plausible-looking but entirely wrong class hierarchy. Use the
  global instead: `webvowl.util.classHierarchy()`, as `app.js` already does for
  everything else.
- **A filter module's `initialize(nodes, properties)` is the only hook that
  hands you fully parsed, fully linked, *unfiltered* data.** Reading
  `graph.getUnfilteredData()` straight after `graph.load()` returns is too early
  — subClassOf edges are not resolved yet, and every class looks like a root.
  `hierarchyPanel.dataModule()` is a pass-through filter module that exists only
  for this timing.
- **`leftSidebar` state is animation-dependent.** It animates for 0.5s and only
  restores its tab and content classes in an `animationend` handler. Ask
  `isSidebarVisible()` (synchronous) rather than `getSidebarVisibility()` (reads
  a class set only once the animation finishes). CSS animations also do not
  complete under a headless virtual-time budget, so tests must not depend on
  them.
- **`npm run release` does not run jshint.** Run `npm run lint` before
  committing.
- **A `#` inside an IRI must be escaped in a Makefile *variable assignment***
  (`oboInOwl\#ObsoleteClass`) or make reads the rest of the line as a comment —
  silently, producing a larger, under-pruned ontology. Inside a *recipe* line make
  passes `#` through to the shell, so the same IRI needs no escaping there. The
  parent's `PRUNE_TERMS` keeps them in a variable, escaped.
- **Adding a source to the parent's `ONTOLOGY_SOURCES` is not enough on its own**
  if the new file's mtime predates the last build — make sees the merge target as
  newer than all its prerequisites and does nothing. The merge target now depends
  on the Makefile itself, which closes that hole.
- **`grunt package` and `grunt release` write the same `deploy/index.html`,** so
  make cannot tell a dev build from a release build by mtime: after a `make dev`,
  a plain `make viz` reported success and left the *dev* build — hot-reload
  polling included — in place. The parent now detects which build produced
  `deploy/` by looking for the hot-reload hook in it and forces a rebuild on a
  mismatch. **If you rename that hook, update `DEV_BUILD_MARKER` in the parent's
  Makefile.**
- **Editing `vowl.css` means regenerating the SVG-export style inliner.** See
  "SVG export" under upstream notes below.

---

## Tests

```
npm test
```

Runs jshint, builds `deploy/`, then two headless-browser suites (they need
`chromium` on `PATH`):

- **`test/ontologyGroups.selftest.html`** — 70 unit checks for grouping,
  filtering, colour slots, the default set and hierarchy-label fallbacks, run
  against the built bundle.
- **`test/run-e2e.sh`** + **`test/e2e-driver.js`** — drives the real UI with
  actual clicks: the Ontologies menu, the hierarchy panel, the tab rail. It
  asserts behaviour rather than presence — that clicking a tree row raises a
  graph halo, that no tab rect intersects an open panel, that the startup filter
  state matches the default set.

Either can be run alone: `npm run test:unit` / `npm run test:e2e` (or the scripts
directly). Both need a built `deploy/`; the e2e run additionally needs the
ontology in it, and fails with the parent-repo command to run rather than
asserting its way through an empty graph.

Three conventions worth keeping:

- assertions should **refuse to pass vacuously** — an overlap check that returns
  "no overlap" because the element was hidden found nothing at all
- anything about panel state should be asserted on **module state, not animated
  geometry**
- the e2e driver must **not name an ontology**. Which vocabularies are in the
  build depends on `WITH_GOVERNANCE`, so it picks the group it toggles (the
  largest) and the group it checks the tree with (the largest first-party one) at
  runtime. It used to hardcode `obo:IAO` and `sagegov`, which turned a perfectly
  good `sagebrain`-only graph into four failures. Verified green in both
  configurations.

Upstream's karma/jasmine specs (4 files under `test/unit/`) are still here as
`npm run test:karma`, but **they do not run**: they launch PhantomJS, which is
abandoned and fails to start against current OpenSSL. They are deliberately not
part of `npm test`. See follow-up 2 for reviving them.

---

## Planned follow-ups

### 1. Drop the Java jars from the contributor toolchain — *needs evaluation*

Today a contributor needs Java plus two jars from the ontology repo to rebuild
the visualization data. Worth investigating whether the pipeline can be
reimplemented in Node or Python so `make viz` needs no JVM. The two jars are
**not** equally hard to replace:

**`robot merge` + `robot remove` — likely straightforward.** The merge is close
to a union of six graphs, and the prune is "these 4 terms plus their subClassOf
descendants", expressible as a SPARQL property path or a short traversal in
`rdflib` / `n3.js` / `oxigraph`. One wrinkle: `duo.ttl` contains an
`owl:imports`, so ROBOT is doing a little OWL-level work beyond a plain union —
check whether that import is resolved or ignored before assuming equivalence.

**`owl2vowl` — the real dependency.** ROBOT is now fetched on demand rather than
vendored, so OWL2VOWL is the only jar actually living in the repo — and the only
one that *has* to, since it has no downloadable release. It implements the
OWL→VOWL mapping, and
reimplementing it in general is a project. The useful question is not "can VOWL
be reimplemented" but "how much of VOWL does *this* ontology exercise". Measured
against the current output, the surface is bounded:

- 6 class types (`owl:Class`, `owl:Thing`, `owl:intersectionOf`, `owl:unionOf`,
  `rdfs:Datatype`, `rdfs:Literal`)
- 7 property types (`rdfs:SubClassOf`, `owl:objectProperty`,
  `owl:datatypeProperty`, `owl:disjointWith`, `owl:someValuesFrom`,
  `owl:allValuesFrom`, `rdf:Property`)
- 13 attribute flags (`external`, `anonymous`, `object`, `datatype`, `union`,
  `intersection`, `someValues`, `allValues`, `functional`,
  `inverse functional`, `transitive`, `irreflexive`, `deprecated`)
- ~20 fields on the attribute objects (`iri`, `baseIri`, `label`, `domain`,
  `range`, `subClasses`, `superClasses`, `comment`, `annotations`, cardinalities…)

Suggested evaluation, in order:
1. Write a converter targeting only that surface and diff its JSON against
   `owl2vowl`'s for the current ontology — element counts per type first, then
   per-element field equality.
2. Decide explicitly whether to track the VOWL spec or only what this app reads.
   Diverging is defensible for a single-ontology viewer, but it should be a
   decision, not an accident.
3. Keep the jar path working behind a Makefile switch until the replacement
   matches, so the two can be compared on every ontology change.

Risks to weigh: restrictions and set operators are where a hand-rolled converter
will drift first; and a subtly wrong converter fails the way the webpack
double-bundle bug did — plausible output, quietly incorrect. The diff harness in
step 1 is what makes this safe, so build it first.

### 2. Revive upstream's karma specs

`test/unit/` has 4 jasmine specs (`datatypeFilter`, `objectPropertyFilter`,
`subclassFilter`, `textTools`) that cannot run: karma launches PhantomJS, which
is abandoned and dies on start against current OpenSSL. They are real tests of
code this fork still uses, and the fix is small — swap the launcher for
`karma-chrome-launcher` / `ChromeHeadless`, which the fork's own suites already
rely on. Then fold them into `npm test`.

## Upstream WebVOWL notes

Retained from the original README because they still apply.

### Docker

```
docker build . -t webvowl:v1
docker-compose up -d      # http://localhost:8080
```

### Development setup

`npm install` installs dependencies and builds; `npm run release` rebuilds
`deploy/`. With `grunt-cli` installed globally you also get:

- `grunt release` — build release files into `deploy/`
- `grunt package` — build the development version
- `grunt webserver` — local live-updating server
- `grunt test` — the upstream karma runner (does not start; see follow-up 2)
- `grunt zip` — build and zip

### SVG export

To export the visualization to SVG, all CSS styles have to be inlined into the
SVG code. **If you change `vowl.css` you must also update the inlining code**, or
exported SVGs will not match what is on screen. The generator lives in
`util/VowlCssToD3RuleConverter/` — see its
[README](util/VowlCssToD3RuleConverter/README.md).

### History

This repository was ported from an internal SVN repository to GitHub after the
release of WebVOWL 0.4.0; `git filter-branch` cleanups make parts of the commit
history look odd. Note that upstream's old `visualdataweb.org` domain is no
longer owned by VisualDataWeb and is unrelated to WebVOWL.
