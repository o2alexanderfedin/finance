# Spec: the stakeholder showcase demo

**Status:** BUILT — **ten** steps plus the All view; steps 8 (Personas) and 9
(the Form 1040 face) added 2026-08-18
**Re-pinned:** `v1.0.0` @ `66c0873`, **2220** project-local proofs, 2026-08-18
**Written:** 2026-08-06
**Concerns:** `demo/` (this directory's parent)

> **EVERY FIGURE BELOW THIS LINE PREDATES THE v1.0.0 RE-PIN, and is left
> standing rather than rewritten.** The document is a dated record of two
> re-pinning exercises and of what each one caught; editing the numbers in
> place would destroy the record while leaving the reasoning — which is the
> part still worth reading — indistinguishable from a fresh measurement.
>
> What moved on 2026-08-18: the release is `v1.0.0` at `66c0873`, the proof
> count is 2220 project-local (2253 total, which is not the same figure and
> never goes on the badge), the served tool count is **13**, and **every link
> now points at `github.com/o2alexanderfedin/finance`** — the public copy the
> Pages workflow publishes from — rather than the private `fjs-dev/finance`.
> That last one is the change the workflow's own warning demanded: a published
> page whose `source ↗` links 404 has broken its central claim.
>
> Two boundaries this document tells the presenter to state out loud, under
> "Three things to say out loud", are **no longer true** and must not be said:
> `form1040Report` gained a production caller in Phase 21
> (`tax-return-integration.test.js` drives a real 1040 through a real
> `fjs_run` process), and the Schedule D Tax Worksheet branch computes as of
> Plan 12.1-04. The sandbox boundary — the third — still stands exactly as
> written.
>
> **The re-pinning procedure itself is unchanged and still the thing to run**,
> including step 3's anchor check, which caught six silently-slid anchors last
> time. On 2026-08-18 every `line`/`proofLine` anchor in every step footer was
> re-resolved by hand against the pinned tree — **most had slid, several by
> more than a thousand lines** — with one caution worth carrying forward:
> `fjs/tax/{table,params}` and `fjs/tax/line16/qdcgt` have moved since `v1.0.0`
> was cut, so their anchors were resolved with `git show 66c0873:<path>` and
> **not** from the working tree. Resolving an anchor against the checkout you
> happen to be sitting in is the way to write a wrong number while doing the
> check.
>
> What was NOT re-run is the network half of step 3: no href was fetched from
> this machine. Every cited path was confirmed to exist at `66c0873` with
> `git cat-file -e`, and the tag was confirmed to exist on the public remote
> with `git ls-remote --tags`, but a wrong `#L` anchor returns HTTP 200 and
> only a human eye catches it.

> **Re-pin, 2026-08-08 — and the anchor check earned its place.** Moving from
> `v0.10.0` (492 proofs) to `v0.12.0` (629), after Phases 11 and 12 shipped.
>
> **Six of the 55 anchors had silently slid**, all into
> `fjs/return/profile/module.f.js`, because Phase 12 added the four
> foreign-account fields above them. Every one still returned HTTP 200 and
> landed somewhere wrong — `proofLine: 447` had come to rest on a bare `},`.
> This is precisely the failure mode step 3 of the re-pinning procedure below
> exists to catch, and a path-exists check would have passed all six.
>
> Fixed: `93 → 104` (kindVocabulary, two sites), `156 → 167`
> (returnProfileSchema), `447 → 469` (proof, three sites).
>
> **Nothing else needed rewording.** Steps 0 and 4 read their counts from the
> engine (`modeledKinds.length`, `unmodeledKindRefusals.length`) rather than
> from a literal, so they tracked the new dialects on their own. Only five
> hardcoded sites carried the old snapshot. That is the second-source rule from
> the roadmap working as intended: a number is safe to state twice when
> something can watch it drift, and these were watched by the re-pin check.
>
> **A second defect, and it predates this re-pin.** Step 0's stack table said
> "MCP server over stdio, **six** tools". The registry holds **twelve** — 3 from
> `casToolRegistry`, 4 from `evoToolRegistry`, `cas_refresh`, and the four
> `finance_*`/`fjs_run` entries. It was wrong at `v0.10.0` too (eleven then), and
> `CHANGELOG.md`'s own `0.10.0` entry repeats the same "six tools". Corrected to
> twelve here, cross-checked against `fjs-run-integration.test.js`, which reads
> `tools/list` at runtime and asserts the set it calls equals the set advertised.
> The `0.10.0` changelog entry is left as it was written — it is a released
> record, and amending history to hide an error is worse than the error.
>
> **`v0.11.0` was never cut.** Phases 11 and 12 both landed before anyone tagged,
> so this release is `v0.12.0` and the minor position still names the highest
> completed phase. Cutting it meant bumping `package.json` *and*
> `fjs/server`'s `serverInfo.version` literal together — the only place those two
> can be compared is `fjs-run-integration.test.js:217`, and that assertion was
> mutation-verified (`9.9.9` reddens it) rather than trusted.
>
> **Step 4 still works, and it was not luck.** Phase 12 shipped the 1099-DIV
> and 1099-B *dialects* but deliberately did not reclassify `fjs/return/scope`
> — that is Phase 12.1's atomic change. So "tick the box, the whole return
> refuses" is intact. When 12.1 lands, this step's meaning changes and the
> narration must be re-read, not just re-pinned.

> **What shipped, and where it left the spec.** Recorded here rather than in a
> commit message, because the next person to open this file needs it.
>
> - **All eight steps were built**, not only the six "must" ones. Exactness,
>   Parameters and Sandbox turned out to be cheap once the engine was loading.
> - **Source links pin the `v0.10.0` release**, not `1309e8f` as originally
>   written. They were `ca9b0bf` between the build and the release; re-pointing
>   is described under "Re-pinning to a later release" below, including the
>   `#L`-anchor check that a plain path-exists check misses.
> - **`functionalscript` is staged from `node_modules`, not the submodule.**
>   The submodule is not checked out in this working tree; `npm ci` installs
>   the same package `package.json` pins, which is what the 629 proofs run
>   against. `.github/workflows/pages.yml` copies it beside `demo/` and
>   `fjs/`. This is the spec's own stated fallback, reached for a reason the
>   spec did not anticipate.
>
>   **Superseded on 2026-08-18:** the submodule was removed from the repository
>   outright, so the body text below — "`functionalscript` is already a git
>   submodule at the repo root" — describes a layout that no longer exists.
>   node_modules is not the fallback any more; it is the only source.
> - **`tsc` type-checks `demo/` too**, which the spec did not account for.
>   `npm test` is `tsc && node --test`, so the first working version turned the
>   suite RED with 103 type errors — real ones: a filing status left as a bare
>   `string`, a money field that could have been a number, `sources` typed as a
>   plain array rather than a non-empty tuple. All fixed by typing the demo
>   properly rather than by excluding the directory. Every fixture now carries
>   its dialect's own type as a variable annotation, so a typo'd box name fails
>   the build.
> - **One `any` appears in the whole demo**, in `steps/07-sandbox.js`'s
>   `deniedDo`, mirroring `fjs/exec/module.f.js`'s own `unsafeDo` for the same
>   documented reason: a program typed against the guest vocabulary *cannot*
>   construct a denied command, and the panel exists to show the runtime
>   backstop for one that reached the interpreter anyway.
> - **The Pages workflow is `workflow_dispatch` only.** Publishing puts the
>   demo on a public URL; that is a person's decision, not a push's side
>   effect. Pages must also be enabled with "Source: GitHub Actions".
>
> Two layout defects were found by looking at the rendered page, not the code:
> step 3's headline silently dropped lines 1z, 2b, 11a and 16 because their
> rules were matched by equality and line 16's rule carries its method
> (`1040 line 16 (Tax Computation Worksheet)`); and step 7's two verdict
> columns — the entire point of that panel — sat off the right edge of the
> viewport behind a scrollbar.

A wizard-style static site that demonstrates the finance engine to stakeholders. Its
organising claim, and the reason for every decision below:

> **Nothing here is asserted. Every number on screen is one click from the code that
> produced it and the proof that tests it.**

---

## Why this shape

Three constraints decided the architecture before any preference did.

**No new dependency, ever** (AGENTS.md). Not React, not Vite, not a bundler, not
"temporarily", not vendored. So: vanilla HTML, CSS and ES modules.

**Browser-only, static hosting** (GitHub Pages or Cloudflare Pages). So: no server, no
build step, no Node at runtime.

**The engine must be the real one.** A mock would make the demo a slideshow, and a
stakeholder cannot check a slideshow.

The third looked like the hard one and turned out to be free. The engine is pure
FunctionalScript: every module under `fjs/` imports nothing from `node:` — the only
`node:` strings in the tree are inside proof *fixtures* asserting that a guest program
importing `node:fs` is refused. `functionalscript`'s `virtual` (the in-memory filesystem
all 629 proofs already run against) has no `node:` imports either. The Node-specific
modules are `effects/node/*.js` and `.d.ts` files, and the demo imports neither.

So the page imports the shipped modules directly and executes the same code the suite
runs against.

### The `import()` question, and why WASM is not the answer

`fjs_run` executes a stored guest program, and its Node path materializes source to a
file then `import()`s it by path. There is no path in a browser. A WASM-hosted JS engine
with `MEMFS`/`IDBFS` would supply a POSIX filesystem and make path-based `import()` work
— the technique is real.

It is still the wrong choice here, for three reasons in ascending order of importance:
it is a forbidden dependency; it is megabytes; and **it would undermine the pitch.** If
the engine runs inside a WASM jail, a stakeholder reasonably concludes the jail is what
makes it safe. The product's claim is the opposite — the runner is the sandbox, because
the effect vocabulary is frozen.

None of it is needed, because **the guest never calls `import()`. It emits an import
effect.** `import_` in `functionalscript/fjs/effects/node/module.f.js` is a pure data
constructor (`do_('import')`, zero `node:` imports); the *host map* decides what the
effect means. Node's interpreter satisfies it with the real loader. The browser supplies:

```js
import(URL.createObjectURL(new Blob([source], { type: 'text/javascript' })))
```

Same guest, same effect stream, a different interpreter. `fjs/guest/materialize` needs no
change, because it only ever referenced the pure `.f.js` side.

---

## Architecture

```
demo/
  index.html          wizard shell: step nav, Prev/Next, "All" view, import map
  demo.css            one stylesheet, light and dark
  demo.js             router, step registry, keyboard nav
  form1040.html       the form alone, printable, no wizard chrome
  form1040.js         browser glue over the step module's `renderForm`
  lib/github.js       SHA-pinned source and proof links
  lib/fixtures.js     the sample return: documents + return profile
  steps/*.js          one ES module per step, each exporting { title, render }
  todo/showcase-demo.md   this file
```

`index.html` carries a native import map so bare specifiers resolve with no tooling:

```html
<script type="importmap">
{ "imports": { "functionalscript/": "../functionalscript/" } }
</script>
```

`functionalscript` is already a git submodule at the repo root, so Pages serves it when
the build checks out submodules. **If submodule checkout proves unavailable on Pages,
the fallback is a `demo/vendor/functionalscript/` copy** — that is publishing an existing
approved dependency, not adding one.

Each step module is self-contained and exports the same shape, so the shell knows nothing
about any step's internals:

```js
export const title = 'Line 16'
export const render = (root) => { /* ... */ }
```

### The printable form, on its own page

`demo/form1040.html` is the one page here that is not part of the wizard. It renders the
Form 1040 face and nothing else — no step header, no lede, no callouts, no Prev/Next —
because a sheet handed to a preparer, or transcribed from onto the real form, cannot
carry commentary. It is reachable from step 9 and from nowhere else.

**It is not a second implementation.** `steps/09-form1040.js` exports `renderForm`, which
draws the face; `render` is that plus the demo's prose. `form1040.js` calls `renderForm`
and does nothing else. Two consequences worth stating, because both are load-bearing:

- **The coverage guards live in `renderForm`.** Both directions of the printed-row /
  engine-line comparison, and the filing-status comparison, run before anything is drawn —
  on the printable page as much as in the wizard. The page a filer trusts must be the page
  that refuses to draw a form with a silent hole in it, not the one that skips the check.
- **`form1040.html` carries its own import map.** `lib/engine.js` imports
  `functionalscript/` as a bare specifier. Without the map the module graph never loads and
  the page renders white, which is the failure a printable page can least afford.

`demo.css`'s `@media print` block does the rest: Letter portrait, a forced black-on-white
palette (a dark-mode reader would otherwise print dark tokens), the toolbar and the wizard
chrome removed, the citation panel removed, and a page break between the two `.f1040-page`
elements rather than after each — `break-after` on the last one ends the job with a blank
sheet in the tray.

**E-file is out of scope and will stay out of scope.** IRS Modernized e-File requires
authorization as an e-file provider, which is not something this project obtains. The
artifact is a page to print, transcribe from, or hand over.

### Engine modules the demo imports

`fjs/form1040/core`, `fjs/tax/line16`, `fjs/tax/line16/qdcgt`, `fjs/tax/table`,
`fjs/tax/deduction`, `fjs/tax/params`, `fjs/return/profile`, `fjs/return/scope`,
`fjs/report/line`, `fjs/document/w2`, `fjs/document/1099int`, `fjs/exact`.
CAS and Evo run on `functionalscript/fjs/effects/node/virtual`.

---

## The steps

Built in this order. Every stopping point is a complete demo.

| # | Page | The beat | Tier |
|---|---|---|---|
| 0 | **What this is** | Thesis, stack, how it works, and the three honest boundaries below | must |
| 1 | **Documents** | W-2, 1099-INT, medical expenses as stored JSON. Money is a `string`, never a float. Each blob's CAS hash on screen. | must |
| 2 | **Line 16** | Four dispatch methods. Drag qualified dividends, watch the **method tag** change. Then the regression pair. | must |
| 3 | **The Return** | Lines 1a–37. Click a line → document hash, box path, value, IRS rule. | must |
| 4 | **Refusal** | Declare brokerage income → the **whole return refuses**, naming what is unmodeled. Untick → it computes. | must |
| — | **All** | Every step on one scrolling page, for Q&A | must |
| 5 | Exactness | IEEE doubles vs exact integer cents, side by side | if time |
| 6 | Parameters | TY2025 values, each citing Rev. Proc. 2024-40 §2.01 / 2025-32 §3.01 | if time |
| 7 | Sandbox | Effect-whitelist refusal, stated honestly (see below) | if time |

Steps 2 and 4 are what people will remember. Step 4 is the product thesis in one gesture.

### Step 2's numbers — hand-typed, independently reproduced four times

MFJ, no Schedule D. Reproduced by research, by the planner, by the executor, and by hand
here before being written down.

| Case | line 15 | line 3a | line 23 | line 24 | **line 16** | naive engine |
|---|---|---|---|---|---|---|
| A | $97,000.00 | $300.00 | 11,175.00 | 11,174 | **$11,174** | 11,175.00 (+$1.00) |
| B | $96,999.00 | $299.00 | 11,174.85 | 11,163 | **$11,163** | 11,174.85 (+$11.85) |

**The defect these pin is the omission of line 25's `min`** — not naive Tax Table use. An
engine that merely looks line 1 up in the Tax Table gets both cases right, because that is
exactly what line 24 computes and `min` selects it. Do not describe it as "$1–$12": that
is not a bound, and MFJ $96,949/$249 produces $13.35.

Worth saying out loud on this page: **three of five worked cases cannot see this defect at
all**, because line 23 is already the smaller in the control, split and all-rates cases. A
suite of realistic-looking test returns would have shipped the bug green.

---

## The three honest boundaries

These go on step 0 and are repeated wherever they apply. A stakeholder will find them; it
is much better that they hear them from us.

1. **The engine is proven; the app is not yet wired end-to-end.** `form1040Report` has no
   production caller — no server path produces a 1040 today. Phase 14 owns that. The demo
   calls the engine directly, which is real computation, not an end-to-end product flow.
2. **The Schedule D Tax Worksheet branch refuses by design.** It is *selected* correctly
   and then refuses, naming unrecaptured §1250 gain and 28%-rate gain as unmodeled.
   Phase 12.1 owns the computation. (Phase 12 shipped the 1099-DIV and 1099-B
   dialects but deliberately left `fjs/return/scope` alone — the reclassification and
   the Form 1040 lines-3a/3b wiring must land as one atomic change, or the engine
   reports a confident zero where it currently refuses honestly.)
3. **The sandbox claim is narrower than "it cannot reach the network."** What is real and
   provable: a guest requesting `fetch` **through the effect system is refused by name**,
   and a disallowed import specifier is refused **before the module body executes**. What
   is *not* defended: a guest body calling `globalThis.fetch(...)` directly runs with host
   privileges. This is a recorded accepted risk in REQUIREMENTS.md, stated in
   `fjs/guest/materialize`'s own header, and it goes on the slide. Telling a finance
   audience precisely what is not yet defended buys more credibility than a sandbox claim
   they can poke a hole in.

---

## Source and proof links

Every page footers to `source ↗` and `proof ↗`.

Pinned to the **`v0.12.0`** release — commit
`cfc4a121c52182e43f1dd9633baac1a42212a15e` in `fjs-dev/finance`.

```js
// lib/github.js
export const sourceUrl = (path, line) =>
    `https://github.com/fjs-dev/finance/blob/${SHA}/${path}${line ? `#L${line}` : ''}`
```

**The href carries the commit; the page displays the tag.** A tag is more meaningful to a
reader, but a tag can be force-moved and a commit cannot, so the immutable half is what
actually gets resolved. Never a branch name — `blob/main/...` rots on the next push.

The build badge reads **`v0.12.0 · 629 proofs`** and opens the GitHub release, which
states what is in it *and what is not* — the right thing to hand someone who clicks a
badge on a page making claims.

**The count is the project-local one, never `npm test`'s total.** That total includes the
vendored `functionalscript` proofs and therefore depends on whether the submodule happens
to be checked out: the same commit reports **494** in a worktree without it and **2730**
in one with it, both correct and neither comparable. The project-local figure means the
same thing in every checkout, which is the only reason it is safe to print.

### Re-pinning to a later release

Four things must be checked together, and the third is the one that gets forgotten:

1. `sha`, `release` and `proofCount` in `demo/lib/github.js` — the single place all three
   are stated.
2. Every linked path exists **at the new commit**: `git cat-file -e <sha>:<path>`. Not in
   the working tree, which is a different question.
3. **Every `#L` anchor still points at what it claims.** A linked file that gained a line
   above the anchor silently moves it, and the link still resolves — it just lands
   somewhere wrong, which is worse than a 404 because nothing looks broken. Resolve each
   `(path, line)` at the new SHA and read the line back. Moving from `ca9b0bf` to
   `v0.10.0`, only `AGENTS.md` and `CHANGELOG.md` differed and neither carries an anchor,
   so all 20 source anchors and all 15 proof anchors were unaffected — verified, not
   assumed.
4. The release URL resolves.

---

## Testing

The demo is presentation code and ships no `proof` export; the engine it imports carries
its own 629. What must be verified before the demo — **all five were re-run on
2026-08-08 at `v0.12.0`, and all five pass**:

1. **It loads from a static file server with no build step.** ✓ Served with
   `./demo/serve.sh`; all eight steps plus the All view render, each with distinct
   content and zero `.callout-stop` render failures. **Not re-run on 2026-08-08:** the
   byte-for-byte simulation of what the Pages workflow stages. Pages has never been
   run and hosting is still an open decision, so that path is unexercised either way.
2. **Every `source ↗` and `proof ↗` link resolves, and lands where it claims.** ✓ At
   `v0.12.0`: all **18 distinct paths** checked with `git cat-file -e <sha>:<path>`
   **at the pinned commit** rather than in the working tree — not the same question,
   and only the first is what GitHub serves. Then all **55 anchors** resolved and read
   back. **Six had slid** (see the re-pin note at the top); the other 49 were
   byte-identical at both SHAs. A path-exists check would have passed all six.
   Confirmed live in the browser: 59 rendered GitHub hrefs, every one on the pinned
   SHA, none on a branch.
3. **The numbers on screen match the engine.** ✓ Step 2 recomputes both hand-typed
   regression cases live and prints `✓ matches` per case; a disagreement paints a loud
   red callout instead of silently preferring one. Step 1 does the same for CAS
   addresses: it re-hashes the JSON it just printed and shouts if the address on screen
   is not the address of the text on screen. Measured on the All view: 2 `✓ matches`,
   5 documents re-hashed and dialect-valid, 0 stop callouts, 0 mismatch text.
4. **No console errors on any step**, including the "All" view. ✓ Zero errors and zero
   warnings.
5. **The suite is still green.** ✓ 629 project-local proofs and `tsc` clean, at
   `v0.12.0`. Gate on the project-local count, never on `npm test`'s total — this same
   commit reports 629 project-local and 2867 total in a checkout with `functionalscript`
   installed, both correct and neither comparable.

### How to run it

```sh
./demo/serve.sh          # then open http://localhost:8000/demo/
```

`serve.sh` stages `demo/`, `fjs/` and `functionalscript/` side by side under the system
temp directory — with symlinks, so edits show up on reload — and serves them. It needs
`npm ci` to have run, and it writes nothing inside the repository.

The staging step is not incidental: `demo/index.html` resolves `../fjs/...` and, through
its import map, `../functionalscript/...`, and in this working tree neither sits beside
`demo/`. The repository root has `fjs/`, but its `functionalscript` submodule is not
checked out and `npm ci` installs that package under `node_modules/` instead.

## Hosting — deferred, and not for a plumbing reason

**2026-08-06: the first showcase is presented from a laptop. Whether any of this becomes
public is an open decision, to be taken with Sergey.**

The blocker is not deployment mechanics. It is that this repository is private and

> **a demo that runs the real engine in a public page publishes the real engine.**

The browser has to download `fjs/**` in order to execute it — 37 `.f.js` files, about
950 KB — so any world-readable deployment ships the engine source verbatim, including its
design-rationale comments: `SEC-*` identifiers, `REQUIREMENTS.md` references, phase
context, and the recorded accepted-risk note in `fjs/guest/materialize`. No configuration
of `.github/workflows/pages.yml` avoids that, and neither does moving the demo into a
separate public repository — the same bytes have to reach the browser either way.

A cross-repository read token stored in a public repo is worse than useless here: it is
exfiltratable by any workflow edit, and it does not prevent the disclosure it appears to
be protecting.

**A second consequence, which applies wherever this is hosted:** every `source ↗` and
`proof ↗` link, and the build badge, points at `github.com/fjs-dev/finance`. Those
resolve only for viewers inside the `fjs-dev` org. Presenting from a laptop while signed
in, they work. On a public page they would 404 — which would break the demo's central
claim on a page whose whole argument is that claim. Repo visibility and demo hosting are
therefore one decision, not two.

`.github/workflows/pages.yml` exists, is `workflow_dispatch` only, and carries this
warning at the top of the file. It has never been run.

### Presenting

Arrow keys move between steps. Two moments carry the whole demo, and both are one
gesture: on **Line 16**, drag qualified dividends off zero and the method tag flips from
`taxTable` to `qdcgt` while **the cents do not change at all** — which is precisely the
argument that page is making. On **Refusal**, tick one box and the entire return refuses.

---

## Out of scope

Persistence across reloads (IndexedDB-backed CAS), authentication, file upload, mobile
layout beyond "does not break", and any change to `fjs/` production code. If a step cannot
be built without changing the engine, that step is cut, not the engine.
