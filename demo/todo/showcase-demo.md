# Spec: the stakeholder showcase demo

**Status:** approved design, not yet implemented
**Written:** 2026-08-06
**Concerns:** `demo/` (this directory's parent)

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
all 492 proofs already run against) has no `node:` imports either. The Node-specific
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
   Phase 12 owns the computation.
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

Pinned to **`1309e8f0a219d583bc48dc77a7a2f03aab39ce20`** on
`feature/phase-10-form-1040-core-and-scope-guard`, in `fjs-dev/finance`. A commit SHA,
never `main` — GitHub serves commit-pinned blobs permanently whether or not the branch is
merged, and a branch-name link rots on the next push.

```js
// lib/github.js
export const sourceUrl = (path, line) =>
    `https://github.com/fjs-dev/finance/blob/${SHA}/${path}${line ? `#L${line}` : ''}`
```

The shell also shows a build badge reading **494/494 green, 492 project-local proofs**, at
that SHA, linking to `10-VERIFICATION.md`. Those figures are a historical fact about a
pinned commit, which is the only honest way to put a test count in a document — see
STATE.md's note on how every pasted count in this project went stale.

---

## Testing

The demo is presentation code and ships no `proof` export; the engine it imports carries
its own 492. What must be verified before the demo:

1. **It loads from a static file server with no build step** — `python3 -m http.server`
   from the repo root, open `demo/`, every step renders.
2. **Every `source ↗` and `proof ↗` link resolves** — a link checker over the generated
   hrefs, run once. A 404 in front of stakeholders is worse than a missing link.
3. **The numbers on screen match the engine** — step 2's table is hand-typed in this spec
   *and* computed live by the page; if they disagree, the page is wrong. Assert it in the
   page itself and show a visible mismatch rather than failing silently.
4. **No console errors on any step**, including the "All" view.
5. **`npm test` still 494/494** — the demo must not touch `fjs/`.

---

## Out of scope

Persistence across reloads (IndexedDB-backed CAS), authentication, file upload, mobile
layout beyond "does not break", and any change to `fjs/` production code. If a step cannot
be built without changing the engine, that step is cut, not the engine.
