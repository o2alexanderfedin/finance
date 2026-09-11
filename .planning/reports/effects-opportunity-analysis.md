# Where effects would improve this codebase — an analysis

**Ran:** 2026-09-10 on `ca68b95`, against `functionalscript@0.49.0`.
**Question asked:** can the FunctionalScript effect system be used anywhere in this repository
to improve it?

**Method.** Every claim below was reached by opening the cited file and reading it, and every
upstream capability was checked against the installed package rather than assumed. Non-findings
are reported alongside findings, because on a question shaped like this one — "could we use X
more?" — the answer is only trustworthy if it also says where the answer is no.

---

## Bottom line

**`demo/lib/store.js` is where it matters** — the browser's IndexedDB store hand-rolls what
effects exist to express, and doing so cost **three real defects**, one of which wrote wrong data
into a content-addressed store. All three are fixed below.

**`fjs/` has three smaller candidates, and this paragraph originally said it had none.** The
first draft's bottom line read *"`fjs/` itself is already effect-correct and needs no change"* —
written on the strength of a purity sweep, which answers *is `fjs/` pure?* and not *does it
hand-roll what a combinator provides?* A delegated sweep answered the second question and found
three. **The claim was record-ahead-of-verification, caught before this branch merged and
corrected rather than quietly reworded.** The strongest of the three is verified by
patch-and-measure, including a mutation watched to redden.

The three are not independent. They are the same root cause seen three times: **the browser
reimplements store operations instead of running the shipped ones.**

---

## Finding 1 — `generation` is computed by a rule that diverges from upstream's on the second amendment

**`demo/lib/store.js:114`**

```js
generation: previous.length,
```

**Upstream's authoritative rule**, `node_modules/functionalscript/fjs/cas/evo/module.f.mjs:420`:

```js
const computeGeneration = parents =>
    parents.length === 0 ? 0 : 1 + parents.reduce((max, p) => Math.max(max, p.generation), 0)
```

whose docstring (`:407`) reads: *"The authoritative `generation` of a new revision: `0` for a
root (`parents: []`), else `1 + max(parents' generations)`. Computed here from the
already-decoded parents, **never taken from input**."*

**The two agree only by coincidence, and only for the first two writes.** `demo/entry.js:338`
builds `parents` from the subject's current heads, which in the demo's flow is exactly one
revision after the first store. So for a document entered and then amended twice:

| write | parents | upstream's rule, over a correctly-written chain | demo | |
|---|---|---|---|---|
| 1st (root) | `[]` | `0` | `0` | ✅ agree |
| 2nd (1st amendment) | `[A]`, gen 0 | `1 + 0 = 1` | `1` | ✅ agree **by coincidence** |
| 3rd (2nd amendment) | `[B]`, gen 1 | `1 + 1 = `**`2`** | **`1`** | ❌ |
| 4th | `[C]`, gen 2 | `1 + 2 = `**`3`** | **`1`** | ❌ |

**`generation` is stuck at 1 from the second amendment onward.**

*(The middle column is what the rule yields over a chain that was written correctly throughout —
0, 1, 2, 3. Run over the demo's own stored data, where every parent already reads `1`, upstream's
rule would yield 0, 1, 2, 2, … instead. Both comparisons show the same divergence; the first is
stated because it is the one that says what the field is supposed to mean. The error does not
merely appear once — it poisons the input to every later computation of the same field.)*

**Measured, not argued.** `effects-opportunity-harness/generation-divergence.mjs` runs both
rules over the same chain:

```
write │ upstream │ demo │
──────┼──────────┼──────┼
  1   │    0     │  0   │ agree
  2   │    1     │  1   │ agree
  3   │    2     │  1   │ DIVERGE
  4   │    3     │  1   │ DIVERGE
  5   │    4     │  1   │ DIVERGE
  6   │    5     │  1   │ DIVERGE

upstream rule applied to the demo's OWN stored parents: 0, 1, 2, 2, 2, 2
a correctly-written chain would read:                   0, 1, 2, 3, 4, 5
the demo writes:                                       0, 1, 1, 1, 1, 1
```

The divergence begins at the **third** write and never closes.

**Nothing catches it.** `fjs/media/revision`'s structural validator is documented at `:138` as
*"Structural-only validator: checks the shape, not the hash / generation semantics"*, and
`checkReferences` (`:225`) only requires `generation` to be a non-negative safe integer
(`:232`). A stuck `1` passes both.

**And a deviation is not read as corruption — it is read as a signal.** Upstream's evo
docstring (`:410-412`) says a deviation from the formula is *"a readable epoch-reset signal
rather than an invalid blob"*. So the browser is not writing something that will be rejected;
it is unintentionally writing epoch-reset markers on every amendment after the first.

**Why it was never caught: the coverage stops one write short of the divergence.** This is
the sharpest part of the finding, and it was checked against both suites.

- `ui-tests/entry.spec.js:172` — *"re-entering the same payer and year amends rather than
  duplicates"* — stores a W-2 and then **one** amendment. That is write 2, the write where the
  two rules agree by coincidence.
- `ui-tests/coverage.spec.js:99-101` stores a W-2 three times, but the third is a deliberate
  **refusal** (`'60,000'`, comma-grouped money the engine rejects), so it never becomes a
  revision. Two successful writes again.

**No test in the repository reaches a third successful revision of one subject.** The defect
begins at exactly that write. This is a cousin of the failure mode this project keeps
correcting — a proof that cannot fail — with the difference that this proof *could* fail; it
simply stops one step before the first input that would make it. **The fix's test is therefore
already specified: store, amend, amend again, and assert the third revision's `generation` is
2.**

**Severity, stated honestly.** No number this demo displays is currently wrong: nothing in this
repository reads `generation` for behaviour — `demo/lib/store.js:114` is the only site in the
tree that computes a non-zero one, and every other occurrence is a `generation: 0` root fixture.
The cost is that **wrong data is written into a content-addressed store**, which this project
treats as the most expensive kind of wrong: `.gitignore`'s own note records that CAS has no
delete operation. If that store is ever handed to upstream's `evo.add`, the next generation is
computed from the wrong parent value and the error propagates.

---

## Finding 2 — `readAll` silently drops entries, two lines below a docstring forbidding exactly that

**`demo/lib/store.js:129-153`.** The docstring:

> Read in one pass because `snapshotOps` must answer synchronously, and read in **FULL** because
> a partial read is the failure mode that looks like a correct return with a document missing —
> **the one outcome this whole project refuses to produce quietly.**

The code, immediately below it:

```js
if (typeof key === 'string' && typeof value === 'string') { blobs.set(key, value) }
...
if (typeof key !== 'string' || typeof value !== 'string') { return }
```

Both branches **skip silently**. An entry whose key or value is not a string is dropped, no
error is raised, and the caller receives a store that looks complete. That is the failure the
paragraph above it names and rejects.

Under normal operation neither branch can fire — `casAdd` and `evoAdd` both `put` strings. That
is an argument for making the impossible case *loud* (`assert`), not for making it quiet: a
silent skip is indistinguishable from an empty store, and the docstring already states which of
those two the project refuses to confuse.

---

## Finding 3 — a revision is trusted into a typed map with no validation, while the validator is one name away

**`demo/lib/store.js:150-151`**

```js
const parsed = JSON.parse(value)
revisions.set(key, parsed)
```

`revisions` is declared `Map<string, Revision>`. `JSON.parse` returns `any`, so `parsed` enters
a typed map having been checked by nothing — neither shape, nor dialect, nor the hash
semantics. `tsc` reports 0 errors because `any` is assignable to everything, which is the hole
rather than a defence.

**Upstream ships the exact function for this**, `fjs/media/revision/module.f.mjs:258`:

```js
export const decodeText = text => okThen(validate)(parseJson(text))
```

— parse, then shape, then `checkReferences`. And **`store.js` already imports from that module**
(`demo/lib/store.js:46`, for `encodeText` and `dialect`). The fix is one more name in an import
that is already there, plus deciding what to do with the failure — which Finding 2 also has to
decide, and they should decide it the same way.

---

## Findings 1-3 are fixed, and the fix was watched to redden

All three were repaired in `demo/lib/store.js` on 2026-09-10, pointwise as recommended.

| | Fix |
|---|---|
| 1 | `generation: previous.length` → `await nextGeneration(db)(previous)`, which reads the parents from the store and returns `0` for a root else `1 + max(parents' generations)` — upstream's rule, with the `max` as a `reduce` for the reason upstream gives (a spread of a caller-sized array overflows the stack before any error path runs). |
| 2 | `readAll`'s two silent skips are now raises. A row that is not two strings is a corrupt store, and the function's own docstring already said what it owes a caller in that case. |
| 3 | `JSON.parse` → `decodeText`, upstream's `parseJson` → shape → `checkReferences` pipeline. The import it needed was already on line 46. |

**The regression test was watched to fail before it was trusted.**
`ui-tests/entry.spec.js:188` — *"a SECOND amendment carries generation 2, which is where the
count and the rule part"* — stores a W-2 and amends it **twice**, then reads the generations
straight out of IndexedDB rather than off the screen, because the field is rendered nowhere.

- With the fix: **passes**, `[0, 1, 2]`.
- With `generation: previous.length` restored: **fails**, `[0, 1, 1]`.

Restored byte-identical afterwards. A leaf that passes either way is what let this live; this
one does not.

**Battery after the fix:** `npm test` **3457/3457**, `tsc` **0**, `test:ui` **47/47** (46 before
— the new test is the difference), `npm run cov` **100.00 / 100.00 / 100.00**.

**The local `generation` rule is a transcription, and transcriptions are how this happened.**
Upstream's `computeGeneration` is module-private, so a second host has no way to *ask* for the
answer. That gap is recorded at `fjs/todo/upstream-export-compute-generation.md` — per
AGENTS.md, a workaround must never be silent — and the ask is one word: `export`.

---

## The structural answer, and what it costs

All three exist because the browser hand-writes store operations. The shipped path computes
`generation` by construction, validates on decode, and cannot silently drop a row.

**Upstream already provides everything needed to run it in a browser**, and this is the part
that was checked rather than assumed:

- **`asyncRun`** — `node_modules/functionalscript/fjs/effects/module.mjs:18` — a **host-agnostic
  asynchronous** interpreter, `map => async effect => ...` over a `ToAsyncOperationMap<O>`. It
  is how `fjs/effects/node/module.mjs:300` builds its own runner. It is present in 0.48.0 and
  0.49.0 alike; it is not new.
- **`evo` is generic over its host** — `fjs/cas/evo/module.f.mjs:626-630`, `@template {Operation}
  O` over `Cas<O>`. A browser `Cas` backed by IndexedDB satisfies it, and `evo(cas)(key).add(…)`
  then runs upstream's `buildRevision` → `computeGeneration`.

**`store.js`'s docstring gives the reason this was not done, and the reason names the wrong
function.** It says: *"`interpret` is synchronous — a guest operation returns a `Result`, never
a promise — and IndexedDB is asynchronous."* That is true of `interpret`, and it is the right
reason for the **guest**, whose ABI is four frozen synchronous operations and must stay that
way. It is not a reason for the **store**: `asyncRun` is `interpret`'s asynchronous sibling and
has been available the whole time.

**Recommendation, proportionate rather than maximal.** Fix the three defects pointwise now —
each is a few lines, each is independently provable, and two of them are one-liners. Record the
effect-host shape (`IndexedDbOp` + `Cas<IndexedDbOp>` + `asyncRun`) as the structural answer,
and note that it is also what would let the browser store be proven under the virtual
interpreter instead of being untestable wiring. Doing the architecture first would mean fixing
wrong stored data behind a larger change.

---

## Inside `fjs/` — three candidates, none urgent, one clearly worth doing

Found by a delegated sweep and re-checked here against the installed 0.49.0. **Each was applied
to an out-of-tree copy and re-measured**, not argued from a reading.

### F1 — four sites wrap a fallible producer in a `step` so `pureOk` can re-lift it, which is the exact glue upstream deleted

`foldStep(items, init, f)` takes `items` as an **`Effect`**. Upstream's own docstring
(`fjs/effects/module.f.mjs:613-619`) names the shape this replaced:

> *"`fjs/cas/cli` wrapped the whole fold in a `step` whose only job was to unwrap `list()` so
> `pure` could wrap it again. **A producer that can fail now feeds the fold directly.**"*

Four sites here still write the old shape, and their producers are already fallible effects
(`cas.list()`, `evo.list()`, `evo.head()`):

| Site | Current |
|---|---|
| `fjs/server/module.f.js:159-162` | `step(cas.list(), hashes => foldStep(pureOk(hashes), …))` |
| `fjs/server/finance_documents_list/module.f.js:227-228` | `step(evo.list(archived), subjects => foldStep(pureOk(subjects), …))` |
| …`:232-233` | `step(evo.head(subject), heads => foldStep(pureOk(heads), …))` |
| `fjs/server/fjs_run/snapshot/module.f.js:223-224` | `step(cas.list(), hashes => foldStep(pureOk(hashes), …))` |

**Measured:** −12 lines, one nesting level gone at each site, `tsc` clean, `npm test`
**3457/3457** unchanged — and the rewritten path was mutated (`acc` → `acc.slice(0, 0)`) to
confirm it is exercised rather than merely unnoticed; the suite went red, then was reverted.

**What it buys beyond lines:** the `step`/`pureOk` pair is a joint. Anything inserted between
them separates the producer's failure from the fold. Collapsed, `cas.list()`'s failure reaching
the handler is structural instead of maintained.

**A near-identical line that must NOT be changed:** `snapshot/module.f.js:291` reads
`state => foldStep(pureOk([...state.activeSubjects, ...state.archivedSubjects]), …)`. That
`pureOk` lifts a **computed array**, not an effect's payload — the case upstream's docstring
calls unaffected. Applying F1 mechanically would break it.

### F2 — the two stored guest programs hand-write the fold, in four copies, because the frozen ABI has none

`guestCtx` exposes eight members — four commands plus `step`, `pure`, `centsFromString`,
`centsToString` — and no fold. So `fjs/report/payer` and `fjs/report/tax_return` each hand-roll
a cursor (`subjects[0]`, `subjects.slice(1)`, recurse), **and each exists twice**: once as
source text and once as a typed twin that must stay line-for-line identical.

The sweep widened the ABI with `foldStep` and rewrote the payer program in both copies: −18
lines, `tsc` clean, `3457/3457` including the integration test that runs the literal source
bytes through a real separate `fjs_run` process.

**Not recommended now, and the reason is data rather than code.** The source text is
**content-addressed**. Editing it changes `programHash`, so any run record already stored in a
live CAS stops resolving and PROV-09's byte-for-byte rerun compares against a program that no
longer exists — the very hazard `fjs/guest/module.f.js:155-159` cites for keeping `pure`'s
pre-0.46 spelling. The suite stays green only because no test hard-codes a program hash. It also
widens an ABI whose own comment says *"Adding a member is cheap today and expensive once
programs exist"* — and programs now exist.

*(One thing it does **not** buy, checked so nobody re-derives it wrong: `_walkLoop`'s
stack-depth guarantee is irrelevant here. Every iteration issues `ctx.evoHead`, a `Do` node, so
control returns to `interpret`'s loop each time and recursion depth stays ~2.)*

### F3 — three nested `step`s where the inner continuation closes over the outer's parameter

`fjs/server/fjs_run/snapshot/module.f.js:279-288`. `historyStep`'s docstring names exactly this:
*"the alternative — nesting so the inner continuation closes over the outer one's parameter — is
what `fjs/AGENTS.md` §3.4 rules out."* The repo already uses `historyStep` three times, so this
is house style. **Measured:** −5 lines, two nesting levels, suite unchanged. **Ranked last
honestly:** no failure becomes undroppable; the nested form already propagates correctly, and
`history`'s tuple is newest-first so the destructure reads in reverse execution order.

### Rejected inside `fjs/`, with reasons

The tax engine, all ~30 document validators, `fjs/exact`, `fjs/types` — **zero** effects imports
under those trees; they are `Result`-returning pure validators with no commands to sequence, and
AGENTS.md's rule is a disjunction where `Result` is the correct arm. `finance_schema`,
`finance_tax_params` and `response` return `pureOk(okResult(…))` correctly — `toolResultStep`
picks between the two arms of a *fallible effect's* Result, and these are pure lookups with no
effect to fail. `write_validation`'s five `return undefined` guards are a **third** value
(*"declines to judge"*), which a two-armed error channel cannot express. `fjs_run`'s
`RunOutcome`-on-the-success-channel is required by PROV-03: a failed run must still write a run
record, so the failure has to survive into a branch that performs writes. And `attempt` cannot
become `catchStep` — it catches a synchronous `throw` from untrusted guest code, and nothing in
`fjs/effects` intercepts a `throw`.

### Two stale claims the sweep turned up, worth a later pass

- **`AGENTS.md:218`** says *"`fjs/exec/module.f.js` catches in shipped production code."* It does
  not — `fjs/exec` has no `try`, and AGENTS.md:119-120 itself records that 0.46.0 retired it.
- **`fjs/exec/module.f.js:37-41`** says `fjs/tax/table`, `fjs/tax/deduction`, `fjs/schedule/a`
  and `fjs/server/fjs_run/snapshot` "each catch an `assert` throw". They all go through
  `refuses(...)`, in proof sections only.

Both are left for a separate change rather than folded in here, because this branch is already
carrying a fix and two corrections and they belong to the `try`-rule documentation, not to
effects.

---

## The root-level `*.test.js` carve-out — no file should move, but its written justification has decayed

AGENTS.md permits a small set of root-level impure files and justifies them in one sentence
(`AGENTS.md:11-16`): *"Each states in its own header why it cannot be a `.f.js` proof: it reads
the filesystem, or spawns a real process, neither of which a pure module may do."*

**The conclusion is right — all eleven must stay impure.** The justification is not, in three
checkable ways. Each was re-verified here before being written down.

### 1. The live count is wrong, in the bullet written to stop exactly that

The bullet says *"`ls *.js` is the live list; it is **ten** files today"*. It is **twelve** —
eleven `*.test.js` plus `index.js`. Two postdate the note: `form1040-pdf-gate.test.js` and
`conversational-path-integration.test.js`.

The same bullet explains why this matters: it *"named only the first two until 2026-08-17 — long
enough for an audit to read the set as stray impure JS."* It has now drifted a second time, in
the same direction.

### 2. The disjunction is missing its third clause

"Reads the filesystem, or spawns a real process" covers ten of eleven. It does not cover
`form1040-pdf-gate.test.js`, whose own header (`:18-23`) gives the real reason: *"It imports
`@cantoo/pdf-lib`, which nothing under `fjs/` may. That is not a limitation to work around, it
is the boundary."* Even with an unrestricted `readFile`, that import alone forbids the move.

**And there is a second, independent blocker on that file that nobody had written down**: the
`readFile` effect cannot read the artifact at all. `maxLengthBytes` is **131,072** (run it:
`node -e "import('functionalscript/fjs/types/bit_vec/module.f.mjs').then(m=>console.log(m.maxLengthBytes))"`)
and `forms/f1040-2025.pdf` is **220,237 bytes**. This is the **same `Vec` ceiling** as
`functionalscript#1819`, reached from a second direction — the issue is filed about `fjs web`
serving a large file, and here it blocks reading one.

### 3. Three gate headers cite a precedent claim that 0.49.0 has falsified

`magi-gate.test.js:11-14`, `payer-report-gate.test.js:14` and `year-genericity-gate.test.js:14`
each say:

> *"A recursive filesystem walk over `fjs/`'s own source text is not something a `.f.js`
> module's purity rule permits — **no existing FunctionalScript proof precedent exists for
> file-content scanning** (13-PATTERNS.md's own "No Analog Found" table)."*

**At the pinned 0.49.0 there is such a precedent, and it is upstream's own.**
`fjs/website/module.f.mjs:118` walks a directory tree as an effect —
`const walk = dir => step(readdir(dir, {}), entries => foldStep(…))` — reads file *contents*
with `readUtf8File`, and `fjs/website/proof.f.mjs:42` proves the whole generator under the
virtual interpreter against an in-memory tree:
`const [generated, result] = virtual({ ...emptyState, root })(main())`.

*(An earlier draft of this section said four headers. It is three —
`planning-truth-gate.test.js` does not carry the claim. Corrected before publishing, by
grepping rather than by trusting the count.)*

**The conclusion survives the rationale's death, and deserves a durable replacement.** These
gates must stay impure not because scanning files is unprecedented but because **the gate's
subject is the real tree**. A pure proof driving the same scan under `virtual` proves the
scanner, not the repository. That framing cannot go stale the way a precedent claim can.

### What the integration suites need, and why no effect covers it

The five process-driving suites are blocked on something already filed:
`fjs/todo/upstream-node-spawn-effect.md` → `functionalscript#1649`. Upstream has `Exec`
(one command, one stdin string up front, resolves only at exit) and **no long-lived `Spawn`**.
These tests need a process alive *across* round-trips, where each request's content depends on
the previous response's hashes. `Exec`'s contract structurally cannot express that, and the
virtual interpreter omits `exec` entirely — its own docstring says `exec`, `forever` and `test`
*"have no meaning against an in-memory filesystem."*

**No change is warranted there.** The note is accurate, re-checked, and filed.

---

## Non-findings, recorded because they were checked

| Checked | Verdict |
|---|---|
| `fjs/**/*.f.js` purity | **Clean.** All 15 `async`/`await` matches are inside fixture *strings* for the import-specifier gate (`fjs/guest/materialize/module.f.js`), not code. All `node:` matches are fixtures or docstrings. No production module touches a host API. |
| `index.js` | **Already minimal and effect-driven** — three lines: `import { run }`, `import { main }`, `await run(main)`. |
| `demo/steps/07-sandbox.js` | **Non-finding.** Its three `await`s are inside source-code samples displayed to the reader, not real async. |
| `demo/lib/github.js` | **Non-finding.** Pure link construction; no network. The only `fetch(` anywhere under `demo/` or `fjs/` is a fixture string in `07-sandbox.js`. |
| The guest running under `interpret` | **Correct as is.** The frozen four-operation synchronous ABI is the thesis, not an accident, and must not become async. |
| The tax engine (`fjs/form1040`, `fjs/schedule/*`, `fjs/tax/*`) | **Correctly pure.** It is a pure function of (documents, tax-year parameters) by design; adding effects would destroy the property that makes it reproducible. |
| `demo/demo.js`, `demo/form1040.js` | **Non-finding, and it localizes the one above.** Both have **zero** `async`/`await` and touch no host beyond the DOM. The browser shell's entire host surface is `demo/entry.js` (14 `await`s, all driving the store) and `demo/lib/store.js` (9). Finding 1-3 is therefore the whole of it, not a sample. |
| `ui-tests/` | **Non-finding.** A separate npm package driving a real browser through Playwright — inherently outside the effect system, and deliberately a separate package by owner decision (2026-08-20). It references `functionalscript` exactly once, in a config comment about symlinks. |

---

## An upstream observation, minor

`fjs/cas/evo/module.f.mjs:411` cites `fjs/media/revision/README.md` for the `generation`
semantics. **That README is not in the published package** — `npm pack` ships `fjs/`, `todo/`,
`README.md`, `LICENSE` and `package.json`, and `fjs/media/revision/` contains only `.mjs` and
`.d.ts` files. A consumer following the citation finds nothing. Same class as the
"no CHANGELOG in the tarball" observation in `fjs-0.49.0-migration.md` §8.2, and worth carrying
in the same place.
