---
phase: 09-traceable-report-lines-and-the-anti-hardcoding-gate
plan: 08
subsystem: testing
tags: [gap-closure, mutation-sweep, coverage, dialects, 1099-int, w2, exec]

# Dependency graph
requires:
  - phase: 09-07
    provides: the prior gap-closure plan in the same mutation sweep (server/report batch)
provides:
  - Per-box transposition coverage for 1099-INT's OCR-to-typed conversion (T-09-08-01)
  - Per-field exactness-check coverage for 1099-INT and W-2 money boxes (T-09-08-02)
  - A golden-value pin on formSubject's encoding (T-09-08-03)
  - An exact-dispatch-count pin on interpret's step budget (T-09-08-04)
affects: [1099int, w2, subject, exec]

tech-stack:
  added: []
  patterns:
    - "Generated per-item proof leaves (Object.fromEntries over a field list) paired with an
       independently hand-typed expected count, so an item ADDED to the list is covered
       automatically and an item REMOVED is still caught (mirrors fjs/tax/boundary's
       allThresholds/expectedThresholdCount idiom)."
    - "Golden-value literal proofs for encodings whose stability is a stored-data contract
       (formSubject), commented as a data-migration boundary, not a refactor boundary."
    - "Exact-boundary proofs for off-by-one-prone loop conditions, built by constructing a
       fixed-length effect chain (chainOfLength) rather than reading a derived message string."

key-files:
  created: []
  modified:
    - fjs/document/1099int/from_ocr/module.f.js
    - fjs/document/1099int/module.f.js
    - fjs/document/w2/module.f.js
    - fjs/document/subject/module.f.js
    - fjs/exec/module.f.js

key-decisions:
  - "Task 2's per-box exactness proofs are driven from the SAME moneyBoxFields/stateLocalMoneyFields
     lists the production checkReferences loop walks, so a box added later is auto-covered — but
     that alone cannot catch a box REMOVED from the list (its own generated leaf vanishes with it),
     so each generated proof is paired with an independently hand-typed expected count, exactly the
     fjs/tax/boundary idiom already established in this repo."
  - "w2/module.f.js's box15Through20 exactness loop was refactored to walk a named
     stateLocalMoneyFields constant instead of an inline array literal, so checkReferences and its
     generated proof share one list. Verified byte-identical refusal messages before and after
     (label and field name are the same string in every case) — no production behaviour changed."
  - "interpret's true step-budget boundary was measured empirically (a scratch script against the
     real module, not assumed): a chain of stepBudget-1 dispatches completes, a chain of exactly
     stepBudget dispatches is refused, because completing it needs one more loop iteration than the
     budget allows to notice the chain went Pure. The proof pins that exact boundary."
  - "T-09-08-04's 'not in scope' item (moving reads' append before dispatch) is recorded below as
     accepted-with-rationale, per the plan's explicit instruction — no proof written, since fjs/exec's
     own docstring already documents it as unobservable through the current API."

requirements-completed: [DOC-01, DOC-11, EXEC-06]

# Metrics
duration: 45min
completed: 2026-08-05
---

# Phase 9 Plan 8: Mutation-Sweep Gap Closure (exec/document batch) Summary

**Closed the eight remaining coverage gaps from a 39-mutation systematic sweep — six in
1099-INT/W-2 dialect money-box handling, one pinning `formSubject`'s stored-data encoding, one
pinning `interpret`'s step-budget boundary at an exact dispatch count — with every mutation
re-verified RED and reverted, no production code behaviour changed.**

## Performance

- **Duration:** ~45 min
- **Tasks:** 3 (5 commits: one per file touched, split at natural file boundaries)
- **Files modified:** 5

## Accomplishments

- 1099-INT's OCR-to-typed conversion (`from_ocr/module.f.js`) now has a proof supplying a
  distinct, non-round value to all six money boxes and asserting each field individually — a
  transposition of any two `boxLabels` targets (verified with both Box 2/Box 3 and Box 1/Box 6)
  now fails at the specific fields involved.
- 1099-INT's `moneyBoxFields` and W-2's `moneyBoxFields`/`stateLocalMoneyFields` each gained a
  generated per-field exactness proof (built by mapping the field list itself, so a box added
  later is auto-covered) paired with an independently hand-typed expected count (so a box
  *removed* from the list is still caught, since its own generated leaf disappears with it).
- W-2's box15Through20 exactness loop was refactored from an inline array literal into a named
  `stateLocalMoneyFields` constant shared by the production check and its generated proof — a
  pure extraction, verified to emit byte-identical refusal messages.
- `formSubject`'s encoding is now pinned by a hand-typed golden-value literal for a fixed
  `FormKey`, independent of the function's own `JSON.stringify` call — a field reordering or an
  un-stringified `taxYear` both fail it, where every prior `changingOneField` leaf would still
  pass (they only assert "changes when one field changes," never what the encoding IS).
- `interpret`'s step budget is now pinned at an *exact* dispatch count, measured empirically
  against the real module: a chain of `stepBudget - 1` dispatches completes, a chain of exactly
  `stepBudget` dispatches is refused. `count < stepBudget` → `count <= stepBudget` now fails this
  proof, where the existing message-only proof does not move (the message is derived from the
  same constant either way).

## Task Commits

1. **Task 1: 1099-INT conversion mapping (FO1)** - `1954fda` (test)
2. **Task 2a: 1099-INT money box exactness** - `fa7ce18` (test)
2. **Task 2b: W-2 money box + box15-20 exactness** - `824355a` (test)
3. **Task 3a: formSubject golden value** - `763ffec` (test)
3. **Task 3b: interpret step-budget exact boundary** - `7394e6b` (test)

_No plan-metadata commit template variable was substituted here; the final metadata commit
(STATE.md/ROADMAP.md/REQUIREMENTS.md/this SUMMARY.md) follows this file._

## Files Created/Modified

- `fjs/document/1099int/from_ocr/module.f.js` - added `everyBoxMapsToItsOwnDistinctField`
- `fjs/document/1099int/module.f.js` - added generated `moneyBoxExactness` proof group +
  independently hand-typed `expectedMoneyBoxFieldCount`
- `fjs/document/w2/module.f.js` - extracted `stateLocalMoneyFields`, refactored the box15-20
  exactness loop to walk it, added generated `scalarMoneyBoxExactness`/`stateLocalMoneyExactness`
  proof groups + independently hand-typed expected counts
- `fjs/document/subject/module.f.js` - added `goldenEncodedSubjectValue`
- `fjs/exec/module.f.js` - added `chainOfLength` fixture and `stepBudgetPinsExactDispatchBoundary`

## Decisions Made

See `key-decisions` in frontmatter above.

## Deviations from Plan

None — plan executed exactly as written. The one deliberate scope exclusion the plan itself
calls out (moving `reads`' append before dispatch) was left unproven per the plan's own
instruction; see "Accepted, Not Covered" below.

## Issues Encountered

None. Every mutation matched its predicted failure on the first attempt; no debugging of the
production code was needed (all eight were confirmed-correct code with a missing proof, per the
plan's premise).

## Mutation Verification Log

Every mutation below was applied, confirmed RED with the pasted output, then reverted with
`git diff --numstat` returning to the pre-mutation state (verified after every revert).

| # | Mutation | Result before revert |
|---|---|---|
| 1 | Swap Box 2 / Box 3 targets in 1099-INT `boxLabels` | `everyBoxMapsToItsOwnDistinctField` failed: `[ '333.33', '222.22' ]` (expected `'222.22'`) |
| 2 | Swap Box 1 / Box 6 targets in 1099-INT `boxLabels` | 3 leaves failed, including `everyBoxMapsToItsOwnDistinctField`: `[ '555.55', '111.11' ]` |
| 3 | Remove `'box6ForeignTaxPaid'` from 1099-INT `moneyBoxFields` | `checkReferences.moneyBoxExactness.everyMoneyBoxIsCovered` failed: `[ 5, 6, [...] ]` |
| 4 | Remove `'box8AllocatedTips'` from W-2 `moneyBoxFields` | `checkReferences.scalarMoneyBoxExactness.everyMoneyBoxIsCovered` failed: `[ 9, 10, [...] ]` |
| 5 | Remove `'localIncomeTax'` from W-2's box15-20 field list | `checkReferences.stateLocalMoneyExactness.everyFieldIsCovered` failed: `[ 3, 4, [...] ]` |
| 6 | Swap `payerTin`/`recipientTin` in `formSubject`'s encoded array | `goldenEncodedSubjectValue` failed: `[ '[...,"222-22-2222","11-1111111",...]', '[...,"11-1111111","222-22-2222",...]' ]` |
| 7 | `String(taxYear)` → `taxYear` in `formSubject` | `goldenEncodedSubjectValue` failed: `[ '["vnd.fjs.1099int",2024,...]', '["vnd.fjs.1099int","2024",...]' ]` |
| 8 | `interpret`'s `count < stepBudget` → `count <= stepBudget` | `stepBudgetPinsExactDispatchBoundary` failed: `[ 'ok', 'error', [...] ]` (the exactly-stepBudget chain wrongly completed) |

Also confirmed empirically (scratch script against the real, unmutated module — not assumed):
`interpret`'s current boundary is `chainOfLength(stepBudget - 1)` → `ok`, `chainOfLength(stepBudget)`
→ `error('step budget exceeded: 10000')`. This is the boundary the plan's Task 3B proof pins.

## Accepted, Not Covered

Per the plan's explicit instruction: the mutation sweep separately found that moving `reads`'
append to before the dispatch (in `fjs/exec/module.f.js`'s `interpret`) survives undetected. This
is accepted-with-rationale, not a gap: `fjs/exec/module.f.js`'s own docstring already documents
this ordering as unobservable through the current API — a refusal returns `error(message)` and
discards the entire read set either way, so both orderings pass every proof. It becomes testable
only if a future phase returns partial reads alongside a refusal, and should be pinned then; writing
a proof now would assert nothing.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

All eight coverage gaps the mutation sweep found in this `fjs/exec`/`fjs/document` batch are
closed. Combined with 09-07's server/report batch, the full 39-mutation sweep's 24-detected + 8
closed-here = 32 gaps are now covered (7 discarded for failing to typecheck). No production
behaviour changed anywhere in this plan — every file touched was already correct, per the plan's
premise, and `npm test` was watched go RED for all eight mutations before being reverted.

---
*Phase: 09-traceable-report-lines-and-the-anti-hardcoding-gate*
*Completed: 2026-08-05*

## Self-Check: PASSED

All 5 modified files found on disk; all 5 task commit hashes (`1954fda`, `fa7ce18`, `824355a`,
`763ffec`, `7394e6b`) found in `git log`. `npm test` 299/299 pass, 0 fail; `npm run test:integration`
1/1 pass; honest metric (`node --test 2>&1 | grep -c '^✔ import("./fjs/'`) = 297 (up from 271);
`git status --porcelain` empty before this file and the metadata commit.
