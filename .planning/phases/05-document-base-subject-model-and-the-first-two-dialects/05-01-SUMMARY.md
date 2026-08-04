---
phase: 05-document-base-subject-model-and-the-first-two-dialects
plan: 01
subsystem: document
tags: [rtti, typescript-generics, cas, subject-derivation, tdd]

# Dependency graph
requires:
  - phase: 04-exact-arithmetic-and-money
    provides: "fjs/exact and fjs/types/decimal (referenced only in doc comments to explain why taxYear is NOT routed through them; no runtime dependency)"
provides:
  - "fjs/document/base/module.f.js — base(dialect): a generic, literal-preserving spread helper for DOC-00, mirroring fjs/media/revision's dialect-tag shape"
  - "fjs/document/subject/module.f.js — artifactSubject(hash) and formSubject(key): DOC-01's two permanent subject-derivation functions"
affects: [05-02 (1099-int and ocr dialects, consumes base), 05-03 (from_ocr conversion, consumes formSubject/artifactSubject)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Generic literal-preserving JSDoc arrow type: `/** @type {<D extends string>(dialect: D) => { readonly dialect: D }} */` — required wherever a helper must return an object whose field carries the caller's literal type into a spread schema, not widened to `string`."
    - "JSON.stringify on a fixed-order array as a collision-safe multi-field key encoding (matches the existing `fjs/exact/module.f.js` `show` test-helper technique) — reusable anywhere this repo needs to derive one deterministic string key from several string/number fields."

key-files:
  created:
    - fjs/document/base/module.f.js
    - fjs/document/subject/module.f.js
  modified: []

key-decisions:
  - "base(dialect) is a one-line generic function with no speculative fields — the docstring itself states that a future dialect needing to widen the base is the signal to revisit, not something to pre-guess now."
  - "artifactSubject is the identity function on the artifact hash (not a prefixed/namespaced value) but kept as a named export, not inlined at call sites, so a future namespacing convention has one place to change."
  - "formSubject encodes its five-field business key via JSON.stringify on a fixed-order array, not manual delimiter-joining, specifically to avoid field-boundary collisions — proven by an explicit collision-shaped proof leaf, not just asserted."

patterns-established:
  - "Type-level negative-case TDD for JSDoc generics: probe the RED state by temporarily swapping the generic annotation for a non-generic (widened) one plus a live wrong-literal assignment, run tsc to observe the miss, restore the generic annotation to observe the catch, then comment the negative-case code back out so the permanently-green suite never carries a deliberately-failing compile check."

requirements-completed: [DOC-00, DOC-01]

# Metrics
duration: ~25min
completed: 2026-08-04
---

# Phase 05 Plan 01: Document Base and Subject Model Summary

**Generic literal-preserving `base(dialect)` spread helper (DOC-00) and deterministic `artifactSubject`/`formSubject` derivation functions (DOC-01), both pure, no I/O, with an explicit RED/GREEN `tsc` transcript proving the generic annotation is load-bearing.**

## Performance

- **Duration:** ~25 min
- **Completed:** 2026-08-04T08:35:35Z
- **Tasks:** 2/2 completed
- **Files created:** 2

## Accomplishments

- `fjs/document/base/module.f.js`: `base(dialect)` returns `{ dialect }` with the literal string type preserved (not widened to `string`), verified against `fjs/media/revision`'s dialect-tag shape and DOC-00's spread idiom (`{ ...base('vnd.fjs.x'), ...fields }`, `dialect` spread first).
- `fjs/document/subject/module.f.js`: `artifactSubject(hash)` (identity on the cBase32 hash) and `formSubject({payerTin, recipientTin, accountNumber, taxYear, formType})` (deterministic, collision-resistant business-key encoding via `JSON.stringify` on a fixed-order array) — DOC-01's permanent subject convention.
- Both modules are pure (no imports beyond `assertEq`), dialect-independent, and carry `proof` exports with a RED/GREEN experiment for the generic annotation and a concrete delimiter-collision proof for `formSubject`.

## Files Created/Modified

- `fjs/document/base/module.f.js` — `base` generic spread helper + `proof.distinctDialects`/`proof.spreadOrder`
- `fjs/document/subject/module.f.js` — `artifactSubject`, `formSubject`, `FormKey` typedef + `proof` (identity, determinism, five per-field change leaves, collision-resistance)

## Decisions Made

- Followed the plan's explicit generic JSDoc form (`<D extends string>(dialect: D) => { readonly dialect: D }`) exactly as specified — verified experimentally (see RED/GREEN transcript below) rather than assumed.
- `formSubject`'s collision-resistance proof leaf uses two concretely-constructed five-tuples (`recipientTin: 'R', accountNumber: '1:2'` vs. `recipientTin: 'R:1', accountNumber: '2'`) that provably collide under a naive `.join(':')` and provably do not collide under `formSubject`'s `JSON.stringify`-array encoding — chosen over a vaguer "plausible collision" assertion so the leaf demonstrates the actual mechanism, not just a passing assertion.
- `taxYear` kept as a plain JS `number`, per the plan's explicit instruction not to route it through `fjs/exact`/`fjs/types/decimal` (it is a calendar year, not money).

## RED/GREEN Transcript (Task 1, DOC-00's literal-preservation requirement)

Actual `tsc --noEmit` output captured during development (not simulated):

**RED** — generic annotation temporarily replaced with `@type {(dialect: string) => { dialect: string }}` (the widened, "before" form), with the wrong-literal negative case live:
```js
const _sample = base('vnd.fjs.ocr')
/** @type {typeof _sample.dialect} */
const _wrongDialectLiteral = 'vnd.fjs.wrong'
```
```
$ npx tsc --noEmit
EXIT: 0
```
No error — the negative case fails to catch the bug it exists to catch, because `typeof _sample.dialect` is plain `string` under the widened annotation. This is the RED: the un-annotated (or non-generic) helper genuinely fails to preserve the literal type.

**GREEN** — generic annotation restored to `@type {<D extends string>(dialect: D) => { readonly dialect: D }}`, same negative case still live:
```
$ npx tsc --noEmit
fjs/document/base/module.f.js(55,7): error TS2322: Type '"vnd.fjs.wrong"' is not assignable to type '"vnd.fjs.ocr"'.
```
Exactly the expected literal-type mismatch, on the expected line — confirms the generic annotation is what makes literal preservation real, not decorative.

The negative-case block is now left commented out in the final file (see the comment block above `export const proof` in `fjs/document/base/module.f.js`), so the permanently-green suite never carries a deliberately-failing compile check, per the plan's acceptance criterion. `grep -c "readonly dialect: D" fjs/document/base/module.f.js` = 1 (verified below).

## Acceptance Criteria — Actual Results

### Task 1 — `fjs/document/base/module.f.js`

| Criterion | Result |
|---|---|
| Exports exactly one function, `base` | PASS — `grep "^export"` shows `base` and `proof` (the standard Emergent Testing export every `.f.js` module in this repo carries; no other function exported) |
| `npx tsc --noEmit` clean | PASS on this file — see below |
| `proof` export: distinct dialects produce distinct `{dialect}` objects (runtime `assertEq`) | PASS — `proof.distinctDialects` |
| `proof` export: spread usage has both keys, `dialect` first | PASS — `proof.spreadOrder` asserts `Object.keys(spread)[0] === 'dialect'` |
| Type-level negative case present, demonstrated RED-before/GREEN-after in SUMMARY, left as comment in final file | PASS — see RED/GREEN Transcript above |
| `grep -c "readonly dialect: D" fjs/document/base/module.f.js` is 1 | PASS (verified: `1`) |

### Task 2 — `fjs/document/subject/module.f.js`

| Criterion | Result |
|---|---|
| Exports exactly `artifactSubject` and `formSubject`, no I/O imports | PASS — `grep "^export"` shows only `artifactSubject`, `formSubject`, `proof`; `grep "^import"` shows only `assertEq` from `functionalscript/fjs/asserts/module.f.js` |
| `artifactSubject('abc') === 'abc'`; two calls with identical hash are `===` | PASS — `proof.artifactSubjectIsIdentity` |
| `formSubject` called with two distinct object literals, identical field values, `===`-equal results | PASS — `proof.formSubjectIsDeterministic` |
| Five per-field change leaves, each proving the subject changes | PASS — `proof.changingOneField.{payerTin,recipientTin,accountNumber,taxYear,formType}`, all green |
| Leaf demonstrating `JSON.stringify`-array encoding avoids a naive-join collision, documenting WHY | PASS — `proof.delimiterCollisionResistance`: constructs two five-tuples that provably collide under `[...].join(':')` (asserted equal) and provably do not collide under `formSubject` (asserted unequal) |
| `npx tsc --noEmit` clean; `npm test` passes with new leaves counted | PASS — see Verification below |

## Verification — Actual Command Output

**`tsc --noEmit`** (whole project, per `npm test`'s first step): errors present, but every error is in `fjs/server/module.f.js`, a file explicitly out of this plan's scope, concurrently modified by another agent in the same wave (confirmed via `git status --short` / `git diff --stat`, not touched by this plan's work):
```
fjs/server/module.f.js(66,21): error TS6133: 'revisionDialect' is declared but its value is never read.
fjs/server/module.f.js(67,10): error TS6133: 'vecToCBase32' is declared but its value is never read.
fjs/server/module.f.js(68,10): error TS6133: 'vec8' is declared but its value is never read.
fjs/server/module.f.js(69,1): error TS6192: All imports in import declaration are unused.
fjs/server/module.f.js(70,10): error TS6133: 'ok' is declared but its value is never read.
fjs/server/module.f.js(71,10): error TS6133: 'tryUtf8' is declared but its value is never read.
```
Filtering these out (`npx tsc --noEmit 2>&1 | grep -v "fjs/server/module.f.js"`) produces **zero output** — both of this plan's files are `tsc`-clean. Because `npm test` chains `tsc && node --test`, the full `npm test` command cannot be run green until the concurrent agent's `fjs/server/module.f.js` edit lands; this is documented here as an out-of-scope, concurrent-wave condition, not a defect in this plan's files.

**`node --test all.test.js`** (legitimate whole-suite discovery per AGENTS.md, run directly since `npm test`'s `tsc` gate is blocked by the concurrent file above):
```
ℹ tests 50
ℹ suites 0
ℹ pass 50
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
```
50 pass / 0 fail — up from the stated baseline of 40, i.e. exactly the 10 new leaves this plan added (2 in `base`, 8 in `subject`), all green, no regressions:
```
✔ import("./fjs/document/base/module.f.js").proof.distinctDialects()
✔ import("./fjs/document/base/module.f.js").proof.spreadOrder()
✔ import("./fjs/document/subject/module.f.js").proof.artifactSubjectIsIdentity()
✔ import("./fjs/document/subject/module.f.js").proof.formSubjectIsDeterministic()
✔ import("./fjs/document/subject/module.f.js").proof.changingOneField.payerTin()
✔ import("./fjs/document/subject/module.f.js").proof.changingOneField.recipientTin()
✔ import("./fjs/document/subject/module.f.js").proof.changingOneField.accountNumber()
✔ import("./fjs/document/subject/module.f.js").proof.changingOneField.taxYear()
✔ import("./fjs/document/subject/module.f.js").proof.changingOneField.formType()
✔ import("./fjs/document/subject/module.f.js").proof.delimiterCollisionResistance()
```

**I/O check** (`grep -rn "process.cwd\|readFile\|fetch(" fjs/document/base/module.f.js fjs/document/subject/module.f.js`): no matches — both modules confirmed pure.

## Deviations from Plan

None — plan executed exactly as written. The only anomaly encountered (whole-project `tsc` failing due to unrelated, concurrently-in-progress edits to `fjs/server/module.f.js` by the other Wave 1 agent) is explicitly out of this plan's file scope per the execution context's boundary instructions ("Another agent is concurrently editing `fjs/server/module.f.js`... Do not touch those.") and is not a deviation of this plan's own work — it is reported above under Verification rather than fixed, per the scope-boundary rule.

## Issues Encountered

- Whole-project `npm test` cannot currently complete because `tsc` fails on `fjs/server/module.f.js` (the concurrent agent's in-progress file, not part of this plan's scope). Verified this plan's own two files are `tsc`-clean via targeted filtering, and confirmed the full 50-leaf suite (baseline 40 + 10 new) passes via direct `node --test all.test.js` invocation, which does not depend on `tsc` succeeding first. This should resolve automatically once the concurrent plan lands its own commit; no action needed from this plan.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Plan 05-02 can `import { base } from '../base/module.f.js'` with no further changes to this plan's files.
- Plan 05-03 can `import { formSubject, artifactSubject } from '../subject/module.f.js'` with no further changes to this plan's files.
- Both files are new (no conflict surface with the concurrent Wave 1 agent's `fjs/server/module.f.js`, root `*.test.js`, or `fjs/todo/` work).
- No commits were made by this executor per its explicit instruction ("Do NOT commit — leave changes in the working tree; the orchestrator commits."); `fjs/document/base/module.f.js` and `fjs/document/subject/module.f.js` are new, untracked files ready for the orchestrator to stage/commit alongside (or after) the concurrent plan's changes.

## Self-Check: PASSED

- FOUND: `fjs/document/base/module.f.js`
- FOUND: `fjs/document/subject/module.f.js`
- FOUND: `.planning/phases/05-document-base-subject-model-and-the-first-two-dialects/05-01-SUMMARY.md`
- `grep -c "readonly dialect: D" fjs/document/base/module.f.js` = 1

---
*Phase: 05-document-base-subject-model-and-the-first-two-dialects*
*Completed: 2026-08-04*
