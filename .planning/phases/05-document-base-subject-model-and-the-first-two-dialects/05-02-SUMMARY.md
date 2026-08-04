---
phase: 05-document-base-subject-model-and-the-first-two-dialects
plan: 02
subsystem: document
tags: [rtti, typescript-generics, tdd, cross-dialect-validation]

# Dependency graph
requires:
  - phase: 05-01
    provides: "fjs/document/base/module.f.js — base(dialect), a generic literal-preserving spread helper"
provides:
  - "fjs/document/ocr/module.f.js — vnd.fjs.ocr dialect: dialect, mediaType, ocrSchema, Ocr (via Ts<>), validate (structural-only, no checkReferences stage)"
  - "fjs/document/1099int/module.f.js — vnd.fjs.1099int dialect: dialect, mediaType, oneZeroNineNineIntSchema, OneZeroNineNineInt (via Ts<>), checkReferences, validate, plus the Success-Criterion-1/2 cross-dialect proofs"
affects: [05-03 (from_ocr conversion, consumes ocrSchema's fields and 1099int's money-box shape), 05-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Structural-only dialect (no checkReferences stage) is a deliberate, documented deviation from the four-stage revision template when a schema has no reference-shaped fields — stated explicitly in the module docstring, not left as an unexplained gap."
    - "DOC-11 absent-vs-zero enforced via option(string)/option(true) on every optional field, never a defaulted primitive — proven by a proof leaf that a blank-boxes value validates and the field reads back as undefined, not 0/false."
    - "Cross-dialect structural-rejection proof lives beside the dialect whose validator does the rejecting (1099int's proof imports ocr's schema/dialect as a same-plan, already-built dependency), not in a third file — testing 'does 1099int reject an OCR blob' from 1099int's own module."

key-files:
  created:
    - fjs/document/ocr/module.f.js
    - fjs/document/1099int/module.f.js
  modified: []

key-decisions:
  - "moneyBoxFields is typed via its own /** @type {const} */ cast, not `readonly (keyof OneZeroNineNineInt)[]` — the latter widens `r[field]` to the union of every field's type (string|number|true|undefined), defeating the DRY loop's type safety; the narrower cast gives exactly `string|undefined` per iteration, matching every money box's option(string) schema."
  - "The Success-Criterion-1 docstring comment above `validate` was reworded mid-execution to avoid literally containing the strings `startsWith`/`.indexOf('{\"dialect\"` — the plan's own <verify> grep for those literals was matching the explanatory prose itself, a false positive the grep gate cannot distinguish from real code. Reworded to describe the prohibition without naming the exact forbidden method calls."
  - "checkReferences compares money-box magnitudes against BigInt(Number.MAX_SAFE_INTEGER) as bigint-to-bigint, never through Number() — per the plan's explicit precision-hazard warning."

patterns-established:
  - "TDD RED capture in a co-located proof file: since fjs's Emergent Testing puts tests inside the same module as the implementation (no separate test file), RED is captured by temporarily stubbing the function-under-test (validate/checkReferences) to a no-op that unconditionally succeeds, running `node --test all.test.js` directly (bypassing tsc, which the stub may not satisfy), confirming the intended proof leaves fail, then restoring the real implementation for GREEN."

requirements-completed: [DOC-00, DOC-03, DOC-10, DOC-11, DOC-12]

# Metrics
duration: ~50min
completed: 2026-08-04
---

# Phase 05 Plan 02: OCR and 1099-INT Document Dialects Summary

**Two concrete `fjs/document` dialects — `vnd.fjs.ocr` (verbatim vision transcription) and `vnd.fjs.1099int` (DOC-04's schema half) — both spread from Plan 05-01's `base`, with Success Criteria 1 (structural-only cross-dialect rejection, no prefix shortcut) and 2 (Ts-derived types, declared once) proven by runtime leaves and grep gates.**

## Performance

- **Duration:** ~50 min
- **Completed:** 2026-08-04T08:54:24Z
- **Tasks:** 3/3 completed
- **Files created:** 2

## Accomplishments

- `fjs/document/ocr/module.f.js`: `ocrSchema = { ...base(dialect), pages: array(string), fields: record(string) }`, structural-only `validate` (no `checkReferences` stage — documented as a deliberate minimal deviation from the revision template, since OCR has no reference-shaped fields).
- `fjs/document/1099int/module.f.js`: full schema with required identity fields, `formRevision` (DOC-10), `corrected: option(true)` (DOC-12), six `option(string)` money boxes (DOC-11), and a `checkReferences` semantic layer that rejects empty/whitespace `formRevision` and re-parses every present money box through `fjs/exact`'s `centsFromString` (rejecting comma-grouped strings, never coercing them).
- Cross-dialect proofs (Task 3) in `1099int`'s `proof.crossDialect`: a parsed-object `vnd.fjs.ocr` value is rejected by `1099int`'s `validate` with `path === ['dialect']` (Success Criterion 1), plus a bonus reverse-direction leaf. A grep gate confirms neither dialect file contains any `startsWith`/`indexOf('{"dialect"` prefix-string shortcut.
- Both `Ocr` and `OneZeroNineNineInt` types are declared exactly once, via `@typedef {Ts<typeof schema>}` — confirmed by grep (Success Criterion 2).

## Task Commits

No commits made by this executor — per this plan's explicit execution-context instruction ("Do NOT commit"), changes are left in the working tree for the orchestrator to stage/commit. Both files are new, untracked:
- `fjs/document/ocr/module.f.js` (untracked)
- `fjs/document/1099int/module.f.js` (untracked)

## Files Created/Modified

- `fjs/document/ocr/module.f.js` — `dialect`, `mediaType`, `ocrSchema`, `Ocr` typedef, `validate` (structural-only), `proof` (4 leaves)
- `fjs/document/1099int/module.f.js` — `dialect`, `mediaType`, `oneZeroNineNineIntSchema`, `OneZeroNineNineInt` typedef, `checkReferences`, `validate`, `proof` (11 leaves, including the 2 cross-dialect leaves imported from `../ocr/module.f.js`)

## Decisions Made

- `moneyBoxFields`'s own narrow `@type {const}` cast (not `keyof OneZeroNineNineInt`) — see key-decisions above.
- Reworded the Success-Criterion-1 docstring to avoid literally matching the plan's own `<verify>` grep pattern (`startsWith`/`.indexOf('{"dialect"`) — see key-decisions above; this was a self-inflicted false positive from documentation prose, not a real shortcut, caught and fixed during Task 3's verify step.
- Added a bonus reverse-direction proof leaf (`oneZeroNineNineIntShapeRejectedByOcr`) as explicitly invited by the plan ("free given the same fixtures").

## Deviations from Plan

None affecting scope or requirements. One self-caught documentation issue (not a Rule 1-4 deviation, since no code behavior was wrong): the first draft of the Success-Criterion-1 explanatory comment above `1099int`'s `validate` literally contained the substrings `startsWith` and `.indexOf('{"dialect"` as *examples of what is prohibited*, which caused the plan's own verify grep (designed to catch real prefix-shortcut code) to false-positive on the comment. Reworded the comment to describe the prohibition without quoting the forbidden method names; re-ran the grep to confirm `NO_PREFIX_SHORTCUT_CONFIRMED`.

## Issues Encountered

- Baseline test count stated in the plan's execution context was 52; the actual pre-existing suite (with `fjs/document/ocr` and `fjs/document/1099int` absent) measured 51 via `node --test all.test.js` (verified by temporarily moving the new `ocr/` directory aside and re-running). This 1-test discrepancy is not attributable to this plan's work — reported here for the record, not treated as a defect. `npm test`'s full discovery (which also picks up a separate DOC-14 CAS-refresh test file outside `all.test.js`'s proof-tree) reports 67 at completion.

## RED/GREEN Transcript

**Task 1 (`fjs/document/ocr/module.f.js`) RED** — `validate` deliberately stubbed as `value => ok(value)` (unconditional success, not wired to `rttiValidate`):
```
$ node --test all.test.js
✖ import("./fjs/document/ocr/module.f.js").proof.wrongDialectRejected() ... (0.211583ms)
  [ 'ok', 'error' ]
```
Exactly the expected failure: the wrong-dialect proof asserted `'error'`, got `'ok'` from the stub.

**Task 1 GREEN** — `validate` restored to `rttiValidate(ocrSchema)`:
```
$ npx tsc --noEmit && node --test all.test.js
ℹ tests 55
ℹ pass 55
ℹ fail 0
```

**Task 2 (`fjs/document/1099int/module.f.js`) RED** — `checkReferences` deliberately stubbed as `r => ok(r)` (no formRevision check, no money-box re-parse):
```
$ node --test all.test.js
✖ import("./fjs/document/1099int/module.f.js").proof.checkReferences.emptyFormRevisionRejected() ... (0.219541ms)
  [ 'ok', 'error' ]
✖ import("./fjs/document/1099int/module.f.js").proof.checkReferences.whitespaceFormRevisionRejected() ... (0.153417ms)
  [ 'ok', 'error' ]
✖ import("./fjs/document/1099int/module.f.js").proof.checkReferences.commaGroupedRejected() ... (0.092541ms)
  [ 'ok', 'error' ]
```
Three failures, exactly the three semantic checks the stub skipped. All other leaves (structural: `correctedFalseRejected`, `wrongDialectRejected`, `blankBoxesOmittedValidates`) already passed at this point, because those are enforced by `validateShape` (the rtti schema itself), not `checkReferences` — confirming the RED correctly isolates the semantic-layer gap, not a structural one.

**Task 2 GREEN** — `checkReferences` implemented (formRevision non-empty/non-whitespace check; per-money-box `centsFromString` try/catch with bigint-magnitude safe-integer check):
```
$ npx tsc --noEmit && node --test all.test.js
ℹ tests 64
ℹ pass 64
ℹ fail 0
```

## Acceptance Criteria — Actual Results

### Task 1 — `fjs/document/ocr/module.f.js`

| Criterion | Result |
|---|---|
| `dialect` is the first property of `ocrSchema` | PASS — `grep -A2 "ocrSchema = "` shows `...base(dialect),` as the first spread |
| `Ocr` declared exactly once via `@typedef {Ts<typeof ocrSchema>}` | PASS — `grep -rn "type Ocr \|interface Ocr" fjs/document/ocr/module.f.js` returns nothing |
| Minimal-empty value validates ok | PASS — `proof.minimalValid` |
| Populated value validates ok, fields/pages round-trip verbatim (comma preserved) | PASS — `proof.populatedRoundTrips` |
| Wrong `dialect` literal fails with a `dialect`-path error | PASS — `proof.wrongDialectRejected` |
| `npx tsc --noEmit` clean; `npm test` passes | PASS |

### Task 2 — `fjs/document/1099int/module.f.js`

| Criterion | Result |
|---|---|
| `dialect` is the first key of `oneZeroNineNineIntSchema` | PASS — `grep -A2 "oneZeroNineNineIntSchema = "` shows `...base(dialect),` first |
| `OneZeroNineNineInt` declared exactly once via `@typedef {Ts<typeof ...>}` | PASS — grep returns nothing besides the one line |
| Fully-populated value validates ok | PASS — `proof.validate.fullyPopulatedValidates` |
| Value omitting every money box and `corrected` validates ok (DOC-11) | PASS — `proof.validate.blankBoxesOmittedValidates` (asserts `box1InterestIncome === undefined`, `corrected === undefined`) |
| `corrected: false` rejected by `validateShape` (DOC-12) | PASS — `proof.validate.correctedFalseRejected` |
| `formRevision: ''` rejected by `checkReferences`, not `validateShape` | PASS — `proof.checkReferences.emptyFormRevisionRejected` (plus a whitespace-only variant) |
| `box1InterestIncome: '1,234.56'` rejected by `checkReferences` | PASS — `proof.checkReferences.commaGroupedRejected` |
| `box1InterestIncome: '1234.56'` (canonical) validates ok | PASS — `proof.checkReferences.canonicalMoneyBoxAccepted` |
| `npx tsc --noEmit` clean; `npm test` passes | PASS |

### Task 3 — Cross-dialect proofs (Success Criteria 1 and 2)

| Criterion | Result |
|---|---|
| `npm test` output shows the new leaves passing, including `path === ['dialect']` | PASS — `proof.crossDialect.ocrShapeRejectedByOneZeroNineNineInt` asserts `v.path.length === 1` and `v.path[0] === 'dialect'` against a parsed-JS-object OCR value fed directly to `1099int`'s `validate` |
| Grep for prefix-style string inspection in either dialect file returns nothing, prints `NO_PREFIX_SHORTCUT_CONFIRMED` | PASS (after the docstring-wording fix noted in Deviations) — actual output: `NO_PREFIX_SHORTCUT_CONFIRMED` |
| `npx tsc --noEmit` clean | PASS |
| Combined `Ocr`/`OneZeroNineNineInt` re-declaration grep across both files returns nothing | PASS |

## Verification — Actual Command Output

**`set -o pipefail; npm test`** (final, full run):
```
ℹ tests 67
ℹ pass 67
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
```
67 = 51 pre-existing + 4 (ocr) + 11 (1099int, including 2 cross-dialect) + 1 (unrelated DOC-14 CAS-refresh test discovered separately by `npm test`'s bare `node --test`, not part of `all.test.js`'s proof tree). 52 → wave-1-stated baseline vs. 51 measured is the 1-test discrepancy noted above; either way, zero regressions and zero failures.

**`npx tsc --noEmit`**: clean, no output.

**Grep gates:**
```
$ grep -A2 "ocrSchema = " fjs/document/ocr/module.f.js
export const ocrSchema = /** @type {const} */ ({
    ...base(dialect),
    pages: array(string),

$ grep -A2 "oneZeroNineNineIntSchema = " fjs/document/1099int/module.f.js
export const oneZeroNineNineIntSchema = /** @type {const} */ ({
    ...base(dialect),
    payerTin: string,

$ grep -rn "type Ocr \|interface Ocr\|type OneZeroNineNineInt \|interface OneZeroNineNineInt" fjs/document/ocr/module.f.js fjs/document/1099int/module.f.js
(no output)

$ grep -rn "startsWith\|\.indexOf('{\"dialect" fjs/document/ocr/module.f.js fjs/document/1099int/module.f.js | grep -v '^#' ; test $? -eq 1 && echo "NO_PREFIX_SHORTCUT_CONFIRMED"
NO_PREFIX_SHORTCUT_CONFIRMED
```

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Plan 05-03 can `import { ocrSchema }` (and its `Ocr` type) from `../ocr/module.f.js`, and `oneZeroNineNineIntSchema`/`OneZeroNineNineInt`/`checkReferences` from `../1099int/module.f.js`, with no further changes to this plan's files.
- Both files are new (no conflict surface with any other Wave 2/3 work in this phase).
- No commits made — files left untracked in the working tree for the orchestrator, per this plan's explicit instruction.

## Self-Check: PASSED

- FOUND: `fjs/document/ocr/module.f.js`
- FOUND: `fjs/document/1099int/module.f.js`
- FOUND: `.planning/phases/05-document-base-subject-model-and-the-first-two-dialects/05-02-SUMMARY.md`
- `npx tsc --noEmit` exit 0 (verified above)
- `npm test`: 67 pass / 0 fail (verified above)

---
*Phase: 05-document-base-subject-model-and-the-first-two-dialects*
*Completed: 2026-08-04*
