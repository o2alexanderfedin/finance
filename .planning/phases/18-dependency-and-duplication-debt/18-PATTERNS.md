# Phase 18: Dependency and Duplication Debt - Pattern Map

**Mapped:** 2026-08-14
**Files analyzed:** 13 (6 dialect sites treated as one duplication group, `fjs_run`, its test,
`payer-report-integration.test.js` checked but out of scope, `subject`, `package.json` +
`package-lock.json`, 4 `upstream-*.md` notes)
**Analogs found:** 4 exact / 4 groups (`formRevision`, shared-tail extraction, test split,
dependency-note re-check have concrete in-repo precedent; `artifactSubject` deletion needs no
analog, only a negative-reference proof)

No RESEARCH.md exists for this phase (`Research: No`). All analogs below come directly from the
codebase measured at commit `6d6d8b8`, matching 18-CONTEXT.md's own baseline.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `fjs/document/1099int/module.f.js:130` | model / semantic-validation | CRUD (validate) | `fjs/document/money_field/module.f.js:42` (`moneyFieldError`) | exact — stated precedent |
| `fjs/document/1099r/module.f.js:232` | model / semantic-validation | CRUD (validate) | same | exact |
| `fjs/document/w2/module.f.js:196` | model / semantic-validation | CRUD (validate) | same | exact |
| `fjs/document/ssa1099/module.f.js:130` | model / semantic-validation | CRUD (validate) | same | exact |
| `fjs/document/1099div/module.f.js:234` | model / semantic-validation | CRUD (validate) | same | exact |
| `fjs/document/1099b/module.f.js:264` | model / semantic-validation | CRUD (validate) | same | exact |
| `fjs/server/fjs_run/module.f.js` (`executeRun` tail, `runExecuteRunViaFixture` tail) | service / orchestration | event-driven (effect pipeline) | `fjs/report/guard/module.f.js` (`classifyRunOutcome` extraction, Phase 09-06) | exact — same repo, same kind of extraction, one phase later |
| `fjs-run-integration.test.js` (766 lines, one `test()`) | test | request-response (real-process integration) | `magi-gate.test.js` / `year-genericity-gate.test.js` (multiple `test()` calls, one file) | role-match — mechanical shape matches; **no analog** for sharing expensive setup across blocks (see below) |
| `package.json` / `package-lock.json` (`functionalscript` version) | config | batch (dependency pin) | `AGENTS.md`'s own two-references-drift-apart warning + prior phases' bump commits (no single file; procedural) | role-match |
| `fjs/todo/upstream-json-parse-split.md` | doc / todo note | batch (fact re-check) | itself — already in the terminal "delete on adoption" state | exact |
| `fjs/todo/upstream-mcp-protocol-version-negotiation.md` | doc / todo note | batch (fact re-check) | itself + `node_modules/functionalscript/fjs/protocol/mcp/module.f.js` | exact |
| `fjs/todo/upstream-node-spawn-effect.md` | doc / todo note | batch (fact re-check) | itself + `node_modules/functionalscript/fjs/effects/node/module.f.js` | exact |
| `fjs/todo/upstream-total-match-dispatch.md` | doc / todo note | batch (fact re-check) | itself + `node_modules/functionalscript/fjs/effects/module.f.js` | exact |
| `fjs/document/subject/module.f.js:48` (`artifactSubject`, to delete) | model | CRUD | `formSubject` in the same file (the thing that stays; shows the difference between a live and a dead export) | exact — negative-reference proof, not a positive pattern copy |

## Pattern Assignments

### The six `formRevision` duplication sites (MAINT-08)

**Analog — the precedent to follow exactly:** `fjs/document/money_field/module.f.js`

**Population, re-derived 2026-08-14** (per CONTEXT.md's instruction to re-run this before
fixing):

```
$ grep -rn "formRevision must not be empty" fjs
fjs/document/1099int/module.f.js:130
fjs/document/1099r/module.f.js:232
fjs/document/w2/module.f.js:196
fjs/document/ssa1099/module.f.js:130
fjs/document/1099div/module.f.js:234
fjs/document/1099b/module.f.js:264
```

Exactly six. The ROADMAP's "two dialect files" is stale; CONTEXT.md's correction is confirmed.

**No second byte-identical duplication was found.** Every dialect's `checkReferences` already
calls the shared `moneyFieldError` for its money-box loop; the *other* per-dialect checks
(`ssa1099`'s `payerTin` emptiness, `1099div`/`1099b`'s `sourceArtifactHash` hash check, `w2`'s
`box12` code check, `1099r`/`1099div`'s `stateLocal` loops) are genuinely dialect-specific, not
copies of each other. `formRevision` is the only universal, byte-identical duplication across all
six — scope stays exactly as CONTEXT.md states.

**`moneyFieldError`'s shape, in full** (`fjs/document/money_field/module.f.js:1-47`):

```js
/**
 * ... (module docstring: extracted when the third dialect needed it, not
 * written speculatively for the first — that same trigger condition already
 * applies here: six dialects share the identical formRevision check.)
 */
import { assert, assertEq } from 'functionalscript/fjs/asserts/module.f.js'
import { centsToString, tryCentsFromString } from '../../exact/module.f.js'

/** @type {(label: string) => (printed: string) => string | undefined} */
export const moneyFieldError = label => printed => {
    const [t, v] = tryCentsFromString(printed)
    if (t === 'error') { return `${label} is not an exact decimal: ${v}` }
    const magnitude = v < 0n ? -v : v
    return magnitude > maxSafeCents ? `${label} exceeds safe integer magnitude: ${printed}` : undefined
}
```

Key shape decisions this precedent fixes, which the `formRevision` helper must copy:

- **Returns `string | undefined`, not a `Result`.** Callers are already inside a `checkReferences`
  that owns the `Result` shape; a nullable message composes into the existing
  `if (message !== undefined) { return error(message) }` loop without unwrapping.
- **Curried, with the field name as the first argument** (`label => printed => ...` for
  `moneyFieldError`), so the message can name the specific field. `formRevision`'s check needs no
  label parameter (the field name is always `formRevision`, unlike money boxes which vary), so
  the shared helper is simpler: `(printed: string) => string | undefined` is enough — no currying
  needed unless the planner wants symmetry with `moneyFieldError`'s shape for consistency.
- **Own colocated `proof` export`, one leaf per input class** (canonical accepted, boundary case,
  garbage refused, message content). `formRevisionError`'s own proof should mirror this:
  empty-string refused, whitespace-only refused, a real value accepted, message names what failed.
- **Imports only what it needs** (`assert`/`assertEq` from `functionalscript/fjs/asserts`, plus
  its own domain helpers) — no dialect-specific imports, so it can sit under `fjs/document/` as a
  sibling to `money_field`, imported by all six dialects the same way each already imports
  `moneyFieldError` (`import { moneyFieldError } from '../money_field/module.f.js'`).

**How a dialect imports and calls it today (the pattern to replicate for `formRevision`)** —
`fjs/document/1099int/module.f.js:48,128-131`:

```js
import { moneyFieldError } from '../money_field/module.f.js'
...
export const checkReferences = r => {
    if (r.formRevision.trim() === '') {
        return error(`formRevision must not be empty or whitespace-only`)
    }
    for (const field of moneyBoxFields) {
        const printed = r[field]
        if (printed === undefined) { continue }
        const message = moneyFieldError(field)(printed)
        if (message !== undefined) { return error(message) }
    }
    return ok(r)
}
```

The shared `formRevision` check should replace the `if (r.formRevision.trim() === '') { return
error(...) }` block the same way `moneyFieldError` already replaced a per-dialect money check —
called and its result routed into the same `error(...)` return, not restructured further. Example
target shape (illustrative, not prescriptive — naming is Claude's Discretion per CONTEXT.md):

```js
import { formRevisionError } from '../form_revision/module.f.js'
...
export const checkReferences = r => {
    const revisionMessage = formRevisionError(r.formRevision)
    if (revisionMessage !== undefined) { return error(revisionMessage) }
    for (const field of moneyBoxFields) { /* unchanged */ }
    return ok(r)
}
```

**`checkReferences`'s common shape across all six dialects**, confirmed by direct inspection
(so the planner can specify one edit pattern rather than six bespoke ones):

| Dialect | First check in `checkReferences` | Where `formRevision` sits |
|---|---|---|
| `1099int` (line 128) | `formRevision` check | first statement |
| `1099r` (line 230) | `formRevision` check | first statement |
| `w2` (line 194) | `formRevision` check | first statement |
| `ssa1099` (line 125) | `payerTin` emptiness check | **second** statement — `formRevision` follows a dialect-specific check |
| `1099div` (line 232) | `formRevision` check | first statement |
| `1099b` (line 262) | `formRevision` check | first statement |

**`ssa1099` is the one dialect where `formRevision` is not the first line of `checkReferences`** —
`fjs/document/ssa1099/module.f.js:125-131`:

```js
export const checkReferences = r => {
    if (r.payerTin !== '') {
        return error(`payerTin must be the empty string for vnd.fjs.ssa1099 (SSA-1099 prints no payer TIN)`)
    }
    if (r.formRevision.trim() === '') {
        return error(`formRevision must not be empty or whitespace-only`)
    }
    ...
```

The extraction must preserve this ordering — `payerTin` still checked before `formRevision` in
this one file — not just replace the literal line in place everywhere identically.

**Existing proof shape to preserve per dialect** (`fjs/document/1099int/module.f.js:268-276`,
identical leaf names confirmed present in all six: `1099r:462`, `w2:440`, `ssa1099:269`,
`1099div:416`, `1099b:477`):

```js
checkReferences: {
    emptyFormRevisionRejected: () => {
        const [t] = validate({ ...minimal, formRevision: '' })
        assertEq(t, 'error')
    },
    whitespaceFormRevisionRejected: () => {
        const [t] = validate({ ...minimal, formRevision: '   ' })
        assertEq(t, 'error')
    },
    ...
```

These six leaves stay — they prove the dialect's own `validate`/`checkReferences` still refuses
correctly through the new shared helper. They must NOT be deleted or replaced by a single
proof inside the new helper module; AGENTS.md's "one rule, one place" is about the *check*, not
about removing per-dialect coverage that a real caller could still break independently (e.g. a
dialect forgetting to call the new helper at all).

---

### `executeRun` / `runExecuteRunViaFixture` shared tail (MAINT-07)

**Analog — the precedent for exactly this kind of extraction, one phase prior:**
`fjs/report/guard/module.f.js`'s `classifyRunOutcome` (moved out of `fjs/server/fjs_run/module.f.js`
by Plan 09-06).

**What that extraction looked like**, and why it is the template:

- **Before (09-05 state, per this module's own header):** the zero-read kill condition existed
  twice inside `fjs/server/fjs_run/module.f.js` — the shipped path in `executeRun`, and a
  near-identical copy inside `runExecuteRunViaFixture`. Every proof exercised the copy; the
  shipped rule had zero coverage. Confirmed only by mutating the shipped code and watching the
  suite stay green — reading did not find it.
- **After (09-06, current state):** the rule lives once, in its own module
  (`fjs/report/guard/module.f.js`), with its own unit proofs. `fjs_run` imports it
  (`fjs/server/fjs_run/module.f.js:134`: `import { classifyRunOutcome } from '../../report/guard/module.f.js'`)
  and calls the SAME function from both `executeRun` (line 216) and `runExecuteRunViaFixture`
  (line 599) — no second definition anywhere.
- **How it is proven load-bearing from both call paths**, per that module's own header
  (`fjs/report/guard/module.f.js:100-115`): "mutating this one body is the only way to change the
  rule either path enforces" — and MAINT-07's own criterion (CONTEXT.md) restates this exactly:
  "reorder or insert a step in the shared tail, and both the virtual proofs and the real-process
  integration test must go red. A change that reddens only one has not shared the thing that
  matters."

**What is actually duplicated today** — verified by direct comparison of the two call sites,
confirming CONTEXT.md's corrected premise (divergent head, shared tail):

`executeRun`, `fjs/server/fjs_run/module.f.js:179-221` — the tail, from `loadProgram` onward
(lines 197-217):

```js
return step(loadProgram([])(programPath(materializeHome(materializeHomeRoot))(input.hash))(sourceText), loadResult => {
    if (loadResult[0] === 'error') {
        return pure(/** @type {RunOutcome<unknown>} */ ({ kind: 'error', message: loadResult[1], reads: [] }))
    }
    const pin = input.subject !== undefined && input.parents !== undefined
        ? { subject: input.subject, parents: input.parents }
        : undefined
    return step(buildRunSnapshot(cas)(evoApi)(pin), snapshot => {
        const hostMap = buildHostMap(snapshot)
        const loaded = /** @type {{ readonly report: Report<unknown> }} */ (loadResult[1])
        const [t, v] = interpret(hostMap)(loaded.report(guestCtx)(input.args))
        if (t === 'error') {
            return pure(/** @type {RunOutcome<unknown>} */ ({ kind: 'error', message: v, reads: [] }))
        }
        const [value, reads] = v
        return pure(classifyRunOutcome(literalCount)(value, reads))
    })
})
```

`runExecuteRunViaFixture`, `fjs/server/fjs_run/module.f.js:574-603` — the tail, from
`loadProgram` onward (lines 584-601), inside its own second `virtual` session:

```js
return virtual(state2)(
    step(loadProgram([])(path)(source), loadResult => {
        if (loadResult[0] === 'error') {
            return pure(/** @type {RunOutcome<unknown>} */ ({ kind: 'error', message: loadResult[1], reads: [] }))
        }
        return step(buildRunSnapshot(cas)(evoApi)(pin), snapshot => {
            const hostMap = buildHostMap(snapshot)
            const loaded = /** @type {{ readonly report: Report<unknown> }} */ (loadResult[1])
            const [t, v] = interpret(hostMap)(loaded.report(guestCtx)(args))
            if (t === 'error') {
                return pure(/** @type {RunOutcome<unknown>} */ ({ kind: 'error', message: v, reads: [] }))
            }
            const [value, reads] = v
            return pure(classifyRunOutcome(literalCount)(value, reads))
        })
    }),
)
```

These two blocks are structurally identical modulo the bound variable names (`programPath(...)`
vs pre-computed `path`; `input.args` vs `args`) — this is the "shared shape" CONTEXT.md names:
`loadProgram` → `buildRunSnapshot` → `buildHostMap` → `interpret` → `classifyRunOutcome`,
including both intermediate error-branch shapes.

**What stays put, per CONTEXT.md** — the divergent head. `executeRun` performs a real
`materializeProgram` write then computes `programPath(...)` itself (lines 179-196);
`runExecuteRunViaFixture` performs its own separate `materializeProgram` call in a first `virtual`
session, then swaps in a `JsModule` fixture via `placeJsModuleFixture` before entering the second
session (lines 574-583), because (per that helper's own header, lines 542-571)
`fjs/effects/node/virtual` cannot compose a real write with a real import in one session. Do not
touch this divergence — it is load-bearing and already documented at length in
`runExecuteRunViaFixture`'s own docstring.

**Extraction target signature (illustrative — naming and exact module home are Claude's
Discretion):** something callable from both bodies, closing over `cas`/`evoApi` and taking the
already-resolved `path`, `source` (for `literalCount` — note `executeRun` computes `literalCount`
from `sourceText` *before* the head diverges, at line 192, so this can either stay outside the
shared tail or be threaded in, since both callers already have it in scope by the time the tail
starts), `report`/`args`, and `pin`:

```js
// e.g. fjs/server/fjs_run/module.f.js, extracted:
const runLoadedProgram = cas => evoApi => path => source => report => args => pin => literalCount =>
    step(loadProgram([])(path)(source), loadResult => {
        if (loadResult[0] === 'error') {
            return pure(/** @type {RunOutcome<unknown>} */ ({ kind: 'error', message: loadResult[1], reads: [] }))
        }
        return step(buildRunSnapshot(cas)(evoApi)(pin), snapshot => {
            const hostMap = buildHostMap(snapshot)
            const loaded = /** @type {{ readonly report: Report<unknown> }} */ (loadResult[1])
            const [t, v] = interpret(hostMap)(loaded.report(guestCtx)(args))
            if (t === 'error') {
                return pure(/** @type {RunOutcome<unknown>} */ ({ kind: 'error', message: v, reads: [] }))
            }
            const [value, reads] = v
            return pure(classifyRunOutcome(literalCount)(value, reads))
        })
    })
```

`executeRun` would call it as its innermost step (after its own materialize+path-resolution
head); `runExecuteRunViaFixture` would call it as its second `virtual(state2)(...)` argument,
unchanged in every other respect. Whether this lives inside `fjs/server/fjs_run/module.f.js`
itself (a local `const`, not exported — matching how `placeJsModuleFixture` and
`runExecuteRunViaFixture` itself are module-local today) or in its own file (matching
`classifyRunOutcome`'s move to `fjs/report/guard/`) is Claude's Discretion; `classifyRunOutcome`'s
precedent only settles the SHAPE of "shared, unit-provable, single definition," not necessarily
"own file" — that module was extracted to its own file because it also needed to be
dialect-independent and reusable by name (`RunOutcome`'s type export) outside `fjs_run`, a
condition the tail-orchestration helper does not obviously share.

---

### `fjs-run-integration.test.js` split (WR-03)

**Current state, confirmed:** 766 lines, exactly one `test(...)` call, at line 122
(`fjs-run-integration.test.js:122-...`), covering (in one async callback, in order): server spawn
and readiness wait, `initialize`/`notifications/initialized` handshake, `tools/list` coverage,
seeding three `vnd.fjs.1099int` documents via real `cas_add`, a real `fjs_run` call and its
provenance/read-count assertions, `fjs_check` reachability (proving it never executes the
program), and the pin-path assertion through the shipped `fjsRunTool`.

**Root-level `*.test.js` files that already use MULTIPLE `test()` calls — the mechanical model**,
found by direct search (`grep -n "test(" *.test.js`):

| File | `test()` count | Shape |
|---|---|---|
| `magi-gate.test.js` | 2 | Shared top-level helper (`listFilesRecursively`) and regex constant; two independent, cheap, stateless `test()` calls — a scan and its positive control. |
| `payer-report-gate.test.js` | 2 | Same shape: a gate `test()` and a positive-control `test()`, sharing a top-level pattern constant. |
| `year-genericity-gate.test.js` | 3 | Same shape, three calls: the gate, a negative-control, and a positive-control. |

**Structural model, from `magi-gate.test.js:44-135` in full:**

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
// ... more imports ...

const repoRoot = fileURLToPath(new URL('.', import.meta.url))
const scanRoot = join(repoRoot, 'fjs')
const magiIdentifierPattern = /[a-zA-Z]*[Mm]agi[a-zA-Z]*/

const listFilesRecursively = dir => { /* shared helper, module scope */ }

test('MAGI gate: no fjs/ file contains a lowercase-or-mixed-case "magi" identifier', () => {
    // uses listFilesRecursively, magiIdentifierPattern
    assert.equal(offenses.length, 0, /* ... */)
})

test('MAGI gate positive control: the uppercase "MAGI" acronym is still permitted in prose', () => {
    // independent assertion, same shared helpers
})
```

**This model covers the MECHANICAL shape of "one file, several named `test()` calls sharing
top-level helpers" — but it does NOT cover the harder problem this specific split has and those
three files do not: every existing multi-`test()` file's blocks are cheap and fully independent**
(a filesystem scan repeated per block). `fjs-run-integration.test.js`'s single `test()` spawns one
real `node index.js` server process and performs a sequential handshake → seed → run → check → pin
flow where **later blocks depend on state established by earlier ones** (the seeded documents, the
same live process, the same `waitForId`/`responses` bookkeeping). No root-level `*.test.js` file
in this repo uses `describe`, `before`, `beforeEach`, or `after` from `node:test` — confirmed by
direct grep across every `*.test.js` file at the repo root. **There is no in-repo precedent for
splitting a single stateful setup across multiple `test()` blocks; the planner must define this
shape.**

Two directions consistent with CONTEXT.md's constraints (preserve every assertion verbatim; prove
the split unmasks a late failure) that the planner should choose between:

1. **Hoist the spawn/handshake into shared module-scope state, reused across several `test()`
   calls** (would need `node:test`'s `before`/`after` — new to this repo but a standard `node:test`
   API, not a new dependency) — closest to "split by concern into multiple `test()` calls" read
   literally, and the one CONTEXT.md's assertion-preservation wording most naturally implies.
2. **Each `test()` call independently spawns its own server and replays only the steps it needs**
   (closer to what `payer-report-integration.test.js` already does as a wholly separate file) —
   avoids any new node:test API but duplicates setup and increases wall-clock cost.

Either way, CONTEXT.md's own bar for "done" is empirical, not structural: **break an assertion in
a late block and confirm it is now reported by name** where today it would be masked by Node
reporting only the first failure in the shared block (CONTEXT.md cites this exact masking, caught
twice independently during Phase 19's Mutation Gate M1).

**`payer-report-integration.test.js` — checked per CONTEXT.md's explicit question:** same
single-`test()` shape, confirmed (`payer-report-integration.test.js:76`, one `test(...)` call,
566 total lines otherwise similar in structure — real spawn, handshake, real `cas_add` seeding,
one `fjs_run` call). CONTEXT.md's Deferred Ideas section already anticipated this and explicitly
scoped it out: **out of scope for this phase**, WR-03 names only `fjs-run-integration.test.js`.
Do not touch this file.

---

### `functionalscript` dependency bump (MAINT-06)

**No single "analog file"** — this is a two-line version-string edit plus a re-check of four
`.md` notes, not a code pattern to copy. `AGENTS.md`'s own "Two references to one dependency drift
apart" section is the closest thing to a pattern: **move `package.json` and `package-lock.json` in
the same commit**, and (per that same section) the submodule pin is a third, deeper reference
that this phase is not required to move (CONTEXT.md: "the submodule pin is the deeper guarantee,"
kept separate from the npm range).

**Exact edit sites confirmed:**

```
package.json:22:        "functionalscript": "^0.43.1"
package-lock.json:11:        "functionalscript": "^0.43.1"
package-lock.json:359:      "resolved": "https://registry.npmjs.org/functionalscript/-/functionalscript-0.43.1.tgz",
```

plus every other `0.43.1`-versioned occurrence `npm install functionalscript@0.44.0` will rewrite
in `package-lock.json` automatically (the lockfile also carries a `"version": "0.43.1"` field on
the `functionalscript` package entry itself, immediately following the `resolved` line) — this is
a generated file; the planner should specify running the installer, not hand-editing beyond
`package.json`'s declared range.

**Installed version, verified 2026-08-14** (both `package.json`'s declared range and the actually
installed package agree today, per AGENTS.md's own "before believing a red result" check):

```
$ node -p "require('./node_modules/functionalscript/package.json').version"
0.43.1
$ node -p "require('./package-lock.json').packages['node_modules/functionalscript'].version"
0.43.1
```

No drift exists yet to correct — the bump to `0.44.0` is a clean forward move, not a repair of an
already-diverged pair.

**Each of the four `fjs/todo/upstream-*.md` notes, what each claims, and what is falsifiable by
inspecting the installed `functionalscript` right now (i.e., checks the planner can specify to
re-run once 0.44.0 lands):**

| Note | Claim | Falsifiable by | Checked at 0.43.1 (2026-08-14) |
|---|---|---|---|
| `upstream-json-parse-split.md` | Already retired: "`parse` is total as of 0.42.0," delete once adopted | `fjs/media/json/module.f.ts`'s `parse` implementation | The note's own text already says this is done — CONTEXT.md's instruction is to delete unless re-checking finds the adoption incomplete. |
| `upstream-mcp-protocol-version-negotiation.md` | `mcpStep`'s `initialize` handler validates but discards `params.protocolVersion`, echoing the server's configured version unconditionally — no negotiation | `node_modules/functionalscript/fjs/protocol/mcp/module.f.js`'s `mcpStep`, the `initialize` branch | **Confirmed still true at 0.43.1** — `initialize` branch (`module.f.js:229-244`) builds `result` from the closed-over `protocolVersion` only; `pr.protocolVersion` (the validated client request) is bound and never read again. Gap remains open; re-check the same lines at 0.44.0. |
| `upstream-node-spawn-effect.md` | `fjs/effects/node` has `Exec` (one-shot, blocking) but no long-lived streaming `Spawn` effect | `node_modules/functionalscript/fjs/effects/node/module.f.js`, search for `'exec'`/`'spawn'` command tags | **Confirmed still true at 0.43.1** — only `export const exec = do_('exec')` exists; no `spawn`/`spawnWrite`/`spawnRead` sibling. Gap remains open; re-check at 0.44.0. |
| `upstream-total-match-dispatch.md` | `match` throws (via `assert`) on an unhandled command rather than offering a total sibling (`tryMatch`), forcing `fjs/exec/module.f.js`'s lone `try`/`catch` | `node_modules/functionalscript/fjs/effects/module.f.js`, search for `tryMatch` | **Confirmed still true at 0.43.1** — `export const match = (map) => (e) => { ...; assert(handler !== null, command); ... }` (`module.f.js:304-312`); no `tryMatch` export exists anywhere in that file. Gap remains open; re-check at 0.44.0. |

All three open notes' target files and line ranges are stable identifiers (`match` in
`fjs/effects/module.f.js`, `mcpStep`'s `initialize` branch in `fjs/protocol/mcp/module.f.js`, the
`exec`-only effect list in `fjs/effects/node/module.f.js`) — the planner can specify "re-run this
exact grep/read against the 0.44.0-installed copies" as the verification step for each, without
needing to guess at what changed.

---

### `artifactSubject` deletion (MAINT-07's fourth criterion)

**No positive pattern to copy — this is a deletion, proven safe by absence of reference, not by
similarity to another file.** The relevant analog is negative: `formSubject`, in the *same* file,
which is what a live, still-needed export in this file looks like (imported by
`fjs/document/consolidated_provenance/module.f.js:41`, called at lines 117-118).

**Confirmed 2026-08-14** — every occurrence of `artifactSubject` in the `fjs/` tree:

```
$ grep -rn "artifactSubject" fjs --include="*.f.js"
fjs/document/subject/module.f.js:12:   (docstring reference)
fjs/document/subject/module.f.js:48:export const artifactSubject = hash => hash
fjs/document/subject/module.f.js:104:  (test comment)
fjs/document/subject/module.f.js:106:  artifactSubjectIsIdentity: () => {
fjs/document/subject/module.f.js:107:      assertEq(artifactSubject('abc'), 'abc')
fjs/document/subject/module.f.js:109:      assertEq(artifactSubject(hash), artifactSubject(hash))
```

Every reference is inside `fjs/document/subject/module.f.js` itself — the export, its own
docstring, and its own `proof.artifactSubjectIsIdentity` leaf. Nothing outside this file imports
it. This matches CONTEXT.md's claim exactly ("confirmed twice, 2026-08-12 and 2026-08-14 ...
nothing outside that file references it").

**What must be deleted together, so nothing is orphaned** (AGENTS.md's `noUnusedLocals` /
`noUnusedParameters` — an unused export does not trip `tsc` the same way an unused local does, but
the accompanying `proof.artifactSubjectIsIdentity` leaf and the docstring's `{@link artifactSubject}`
prose reference should go with it, or the doc goes stale immediately):

- `export const artifactSubject = hash => hash` (line 48) and its own JSDoc block (lines 35-47).
- `proof.artifactSubjectIsIdentity` (lines 106-110).
- The `{@link artifactSubject}` reference in the module header (line 12) — update the prose, since
  it currently describes a function that will no longer exist.

**What must NOT change** — `formSubject` (lines 89-90), its own `FormKey` typedef (lines 61-68),
its full proof group (`formSubjectIsDeterministic`, `goldenEncodedSubjectValue`,
`changingOneField`, `delimiterCollisionResistance`, lines 111-179), and the file itself. Do not
delete `fjs/document/subject/module.f.js`.

## Shared Patterns

### "Extracted when the Nth dialect needed it" — the trigger condition this repo already uses to
justify a shared helper (`fjs/document/money_field/module.f.js:6-9`'s own docstring: "Extracted
when the third dialect needed it ... not written speculatively for the first"). Applies directly:
`formRevision`'s six-way duplication clears that bar with room to spare.
**Apply to:** the new `formRevision` shared-check module.

### "One rule, one place," proven by mutation — AGENTS.md's own stated rule, and the exact lesson
`classifyRunOutcome`'s extraction encodes: a shared rule is not proven shared until mutating its
one definition reddens every call site that is supposed to depend on it. CONTEXT.md's own bar for
MAINT-07 restates this precisely ("reorder or insert a step in the shared tail, and both the
virtual proofs and the real-process integration test must go red").
**Apply to:** the `formRevision` extraction (mutate it, confirm all six dialects' existing
`emptyFormRevisionRejected`/`whitespaceFormRevisionRejected` leaves still catch it) and the
`executeRun`/`runExecuteRunViaFixture` tail extraction (mutate it, confirm both the virtual proofs
in `fjs/server/fjs_run/module.f.js` and the real-process `fjs-run-integration.test.js` go red).

### `@ts-nocheck` root-level impure-JS carve-out — every root `*.test.js` file that talks to a real
OS process (`cas-refresh-cross-process.test.js`, `fjs-run-integration.test.js`,
`payer-report-integration.test.js`) opens with the same two-reason `@ts-nocheck` header (no
`@types/node` without owner approval; no fjs effect exists for a long-lived subprocess).
**Apply to:** no new file needed here since the split stays inside the existing
`fjs-run-integration.test.js`, but any edit to that file's header comment must not weaken or
remove this justification — it is still true after the split.

### Hand-typed literals stay hand-typed through a refactor — AGENTS.md's core testing discipline
("a proof's expected value must not be produced by the code under test"). Every proof this phase
touches (`checkReferences`'s `emptyFormRevisionRejected` etc., `classifyRunOutcome`'s existing
proofs, `fjs-run-integration.test.js`'s expected-sum computation via `centsFromString`/
`centsToString`, never a bare literal) already follows this. **No refactor in this phase may
change an expected value** — CONTEXT.md's own words: "if a refactor requires changing an expected
value, that is a defect in the refactor, not a test to update."

## No Analog Found

| File / Concern | Role | Data Flow | Reason |
|---|---|---|---|
| Splitting a single stateful, sequential, real-process `test()` across multiple `test()` blocks while preserving shared setup | test | request-response, stateful | No root-level `*.test.js` file in this repo uses `describe`/`before`/`beforeEach`/`after`. The three existing multi-`test()` files (`magi-gate`, `payer-report-gate`, `year-genericity-gate`) are all cheap, stateless, and independent per block — a different problem shape. The planner must define this shape from scratch, choosing between hoisting shared setup via `node:test` hooks (new API surface for this repo, not a new dependency) or duplicating setup per block. |

## Metadata

**Analog search scope:** `fjs/document/` (all six dialects + `money_field` + `subject` +
`consolidated_provenance`), `fjs/report/guard/`, `fjs/server/fjs_run/` (incl. `snapshot/`),
repo-root `*.test.js` (all seven), `fjs/todo/upstream-*.md` (all four), `package.json`,
`package-lock.json`, `node_modules/functionalscript/fjs/{effects,protocol/mcp,effects/node}` (for
falsifiability checks against the currently-installed 0.43.1).

**Files scanned:** ~25 read/grepped directly; six-dialect population and `artifactSubject`
reference population each re-derived by fresh `grep -rn` per CONTEXT.md's instruction, not taken
from the context document's own numbers.

**Pattern extraction date:** 2026-08-14
