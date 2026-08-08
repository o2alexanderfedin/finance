---
phase: 12-brokerage-documents-and-the-capital-gain-chain
plan: 04
subsystem: tax-schedule
tags: [schedule-b, threshold, foreign-account, provenance, tdd]

# Dependency graph
requires:
  - phase: 12-01
    provides: "vnd.fjs.1099div dialect (box1aTotalOrdinaryDividends)"
  - phase: 12-03
    provides: "vnd.fjs.return_profile's four foreign-account fields"
provides:
  - "fjs/schedule/b/module.f.js: scheduleB, a standalone pure function computing Schedule B Part I/II totals, the two independent $1,500 threshold tests, and the Part III foreign-account echo"
affects: [12.1-form8949-schedule-d-chain]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "New fjs/schedule/ root for computed IRS schedules that are standalone (not wired into fjs/form1040/core), mirroring fjs/tax/line16/qdcgt's shape without living inside fjs/tax/"
    - "Local reimplementation of fjs/form1040/core's box-sum idiom (sumBoxOverDocuments/addBoxSums/documentLine/profileDeclaredZeroLine) since that module does not export them (11-PATTERNS.md precedent)"

key-files:
  created:
    - fjs/schedule/b/module.f.js
  modified: []

key-decisions:
  - "The $1,500 threshold is two INDEPENDENT strict (>) comparisons, one per Part, never a combined line4+line6 sum -- the documented common error"
  - "Line 3 (Form 8815) is not modeled -- Form 8815 does not exist in this codebase -- so line 4 is constructed explicitly equal to line 2, documented as a deliberate scope boundary rather than silently dropped"
  - "Lines 1 and 5 (per-payer name+amount listings) are not separately materialized -- each ReportLine's sources tuple already cites every contributing document, a stronger provenance record than a bare payer list"
  - "Part III's four foreign-account answers are read verbatim from profile.value, proven with a leaf using ZERO stored 1099-INT/1099-DIV documents so the read cannot be mistaken for a document-derived inference"
  - "Module docstring reworded (Rule 1 fix) to avoid literally naming classifyScope/form1040IncomeLines/form1040TaxAndPaymentLines, since the plan's own acceptance-criteria grep asserts those names return NOTHING in this file -- mirrors vnd.fjs.1099div's own prior solution to the identical tension"

patterns-established:
  - "dialectIndependence proof: assert the computed output carries no 'dialect'/'mediaType' key, as the runtime-checkable half of 'this is a schedule, not a stored document' (the import-absence half is a static/grep fact, not a runtime assertion)"

requirements-completed: [TAX-07]

# Metrics
duration: 35min
completed: 2026-08-08
---

# Phase 12 Plan 04: Schedule B Summary

**Schedule B (TAX-07) as a standalone pure function: Part I/II box sums over stored 1099-INT/1099-DIV documents, two independently strict $1,500 threshold tests, and a verbatim Part III foreign-account echo from the declared return profile.**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-08-08T02:55:00Z (approx, per STATE.md session continuity)
- **Completed:** 2026-08-08T03:07:00Z
- **Tasks:** 1 of 1 completed (TDD: RED, GREEN)
- **Files modified:** 1 created (`fjs/schedule/b/module.f.js`)

## Accomplishments

- Built `fjs/schedule/b/module.f.js`: 18 proof leaves covering every `<behavior>` bullet in the plan, including the load-bearing negative case (a taxpayer with $1,000 interest and $1,000 dividends triggers neither threshold).
- Proved the $1,500 threshold is strict (`>`, not `>=`) at the cent boundary on both Part I and Part II independently (6 boundary leaves).
- Proved Part III's four foreign-account fields are read verbatim from the profile with ZERO stored 1099s in play — never inferred from document presence/absence.
- Ran the required mutation-and-watch-fail cycle on the finished GREEN code (not just the TDD RED phase): combined the two thresholds back into one sum, watched the three predicted leaves go RED with real output, restored exactly, confirmed `git status --porcelain` empty.
- Confirmed the module stays standalone: no import of and no textual mention (post-reword) of `classifyScope`/`dispatchLine16`/`form1040IncomeLines`/`form1040TaxAndPaymentLines`; `fjs/return/scope/module.f.js` and `fjs/form1040/core/module.f.js` are byte-identical to `HEAD` before this plan; `fjs/tax/**` untouched.
- Project-local proof count: 607 -> 625 (+18, matching the 18 new leaves), full `npm test` green (2863 pass, 0 fail).

## Task Commits

TDD task (Task 1), three commits:

1. **RED — failing threshold proofs** - `085fefd` (test): full module with box-sum plumbing, foreign-account echo, and the complete 18-leaf proof suite, but `scheduleB`'s threshold logic deliberately combines lines 4+6 into one comparison (the documented common error). Three leaves fail with real output (`[ true, false ]` where `[false, false]` was expected); the other 15 already pass against the correct plumbing.
2. **GREEN — independent thresholds** - `2044d21` (feat): replaced the combined comparison with two independent ones (`line4.value > scheduleBThresholdCents`, `line6.value > scheduleBThresholdCents`). All 18 leaves pass; full suite green at 625 project-local proofs.
3. **Docstring reword** - `09dec55` (docs): the module's own explanatory prose named `classifyScope`/`form1040IncomeLines`/`form1040TaxAndPaymentLines` literally, colliding with this plan's own acceptance-criteria grep asserting those names return NOTHING in this file. Reworded without naming them, meaning preserved (mirrors `vnd.fjs.1099div`'s prior solution to the identical tension).

**Plan metadata:** (this commit, following SUMMARY.md)

## Files Created/Modified

- `fjs/schedule/b/module.f.js` (537 lines) — `scheduleBThresholdCents` (150000n), `scheduleB` (the entry point), local `Stored<T>`/`BoxSum` typedefs, locally-reimplemented `sumBoxOverDocuments`/`addBoxSums`/`documentLine`/`profileDeclaredZeroLine`, and the 18-leaf proof suite.

## Decisions Made

- Line 4 = Line 2 exactly (Form 8815 unmodeled) — documented in the module docstring as a deliberate, non-silent scope boundary, not computed by a placeholder.
- Lines 1/5 (payer-name listings) not separately materialized — each `ReportLine.sources` tuple is a stronger provenance record than a bare name list, and TAX-07's success criterion is the threshold/foreign-account questions, not a payer-grouped listing.
- `dialectIndependence` proof implemented as a runtime check that the computed output carries no `dialect`/`mediaType` key (the "imports no dialect constant" half of the plan's ask is a static/grep fact about the file's own imports, verified manually below rather than as a runtime assertion, since referencing an unimported identifier via `typeof` would not typecheck under this project's strict `tsc` settings).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Module docstring collided with its own acceptance-criteria grep gate**
- **Found during:** Task 1, post-GREEN verification
- **Issue:** The docstring explaining "this module is standalone" named `classifyScope`, `form1040IncomeLines`, and `form1040TaxAndPaymentLines` literally — exactly the four names the plan's acceptance criteria grep for and require to return NOTHING in this file.
- **Fix:** Reworded the prose to describe the functions without naming them, preserving the explanation (per the "reword the prose to keep its meaning — never delete the explanation" rule). Mirrors the identical fix already present in `vnd.fjs.1099div`'s own module docstring.
- **Files modified:** `fjs/schedule/b/module.f.js`
- **Verification:** `grep -n "classifyScope\|dispatchLine16\|form1040IncomeLines\|form1040TaxAndPaymentLines" fjs/schedule/b/module.f.js` now returns NOTHING; full suite re-run green at 625.
- **Committed in:** `09dec55`

## Threshold Mutation — Load-Bearing Proof

Per this plan's explicit `<prove_the_threshold_is_load_bearing>` requirement, run separately from the TDD RED/GREEN cycle, against the final committed code:

- **Mutation:** replaced the two independent comparisons with one combined `line4.value + line6.value` sum compared once, reused for both `interestOverThreshold` and `dividendsOverThreshold`.
- **Result:** the SAME three leaves that were RED during the TDD cycle went RED again, with real output:
  ```
  ✖ proof.thresholds.twoThousandInterestOnlyTriggersInterestThresholdOnly() — [ true, false ]
  ✖ proof.thresholds.twoThousandDividendsOnlyTriggersDividendThresholdOnly() — [ true, false ]
  ✖ proof.thresholds.combinedButIndividuallyUnderThresholdTriggersNeither() — [ true, false, 'combined $2,000 split across two categories must not trip the interest test' ]
  ```
- **Restored** to the exact independent-comparison form; `git status --porcelain` empty; `npx tsc --noEmit` exit 0; project-local proof count back at 625.

## Verification Evidence

```
$ npx tsc --noEmit
(exit 0, no output)

$ node --test 2>&1 | grep -c '^✔ import("./fjs/'
625   # baseline 607, risen by 18 (the new proof leaves)

$ node --test 2>&1 | tail -8
tests 2863
pass 2863
fail 0

$ git diff -- fjs/return/scope/module.f.js fjs/form1040/core/module.f.js
(empty)

$ git status --short fjs/tax/
(empty)

$ grep -in "magi" fjs/schedule/b/module.f.js
(no match)

$ git status --porcelain
(empty)
```

## Self-Check: PASSED

- FOUND: `fjs/schedule/b/module.f.js` (537 lines, exceeds `min_lines: 200`)
- FOUND commit `085fefd` (test — RED)
- FOUND commit `2044d21` (feat — GREEN)
- FOUND commit `09dec55` (docs — reword)
- `git ls-tree HEAD fjs/schedule/b/module.f.js` confirms the file is tracked at `HEAD`.
