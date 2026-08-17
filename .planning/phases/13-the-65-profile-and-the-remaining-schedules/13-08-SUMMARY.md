---
phase: 13-the-65-profile-and-the-remaining-schedules
plan: 08
subsystem: tax-documents
tags: [rtti, fjs, dependents, schedule-8812, ctc, odc, actc, obbba, citation-union]

# Dependency graph
requires:
  - phase: 13-the-65-profile-and-the-remaining-schedules
    provides: "13-07's standard-vs-itemized deductionChoice wiring (Slice 3 close)"
provides:
  - "vnd.fjs.return_profile dependents array (relationship, ssnValidForEmployment, ageAtYearEnd, livedWithTaxpayer), length-checked against dependentCount"
  - "childTaxCredit TY2025 parameters (CTC $2,200 kind:'revProc', ODC $500/ACTC cap $1,700/phase-out $400k-$200k all kind:'code' §24(h)), 5% stepped phaseoutRatePercent"
affects: [13-09, 13-10]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Cross-field array-length proof: dependents.length === dependentCount, mirroring line26EstimatedTaxPayments's declaredKinds cross-field check shape (checkReferences step 8)"
    - "Mixed-citation parameter group: childTaxCredit is the first fjs/tax/params entry where sibling dollar figures cite DIFFERENT Citation union arms (one revProc, four code) rather than uniformly one kind"

key-files:
  created: []
  modified:
    - fjs/return/profile/module.f.js
    - fjs/tax/params/module.f.js

key-decisions:
  - "dependentEntrySchema's three boolean-shaped facts (ssnValidForEmployment, livedWithTaxpayer) are option(true), extending DOC-12's checkbox convention to taxpayer-asserted credit-eligibility facts rather than printed-form checkboxes -- absence is the conservative 'not asserted true' default"
  - "Citizenship/resident-alien status is NOT a fifth dependents field -- documented as an accepted trust boundary in the profile module's own docstring per 13-CONTEXT.md Decision 5.7, deferred to Schedule 8812's own module docstring (13-09) to restate"
  - "childTaxCredit.odcAmount/actcCap/phaseoutThreshold all cite kind:'code' section:'§24(h)' -- NOT kind:'revProc' -- since Rev. Proc. 2025-32 backs only the CTC figure among this phase's new numbers (13-RESEARCH.md Pitfall 5); the phase-out's stepped round-up-to-next-$1,000 arithmetic is left entirely to 13-09, this plan stores only the threshold and rate"

requirements-completed: []

# Metrics
duration: 30min
completed: 2026-08-11
---

# Phase 13 Plan 08: Dependents Array and CTC/ODC/ACTC Parameters Summary

**`vnd.fjs.return_profile` grows a `dependents` array (four facts Schedule 8812 keys its qualifying-child-vs-other-dependent classification on) alongside a kept `dependentCount`, and `fjs/tax/params` gains `childTaxCredit` — the first parameter group in this codebase where sibling dollar figures cite two different `Citation` union arms.**

## Performance

- **Duration:** ~30 min
- **Completed:** 2026-08-11
- **Tasks:** 2 (both `type="auto"`, one commit each)
- **Files modified:** 2

## Accomplishments

- `dependentEntrySchema` (`relationship`, `ssnValidForEmployment`, `ageAtYearEnd`,
  `livedWithTaxpayer`) added to `vnd.fjs.return_profile` as `dependents: option(array(...))`,
  with `checkReferences` step 8 refusing a present array whose length disagrees with
  `dependentCount`, naming both numbers. `dependentCount` itself is untouched — still the
  field every existing proof and the scope guard read.
- The module's own docstring records the citizenship/resident-alien trust boundary
  (13-CONTEXT.md Decision 5.7): the taxpayer's act of declaring a dependent already asserts it,
  and Schedule 8812 itself classifies CTC-vs-ODC on only age and SSN validity, both of which
  this array carries.
- `childTaxCredit` added to `fjs/tax/params`: `ctcAmount` ($2,200.00, `kind: 'revProc'`,
  Rev. Proc. 2025-32 §2.03 — the only figure in this entire phase that citation actually backs)
  and `odcAmount`/`actcCap`/`phaseoutThreshold.{marriedFilingJointly,other}` (all `kind: 'code'`,
  §24(h), the phase's LOW-confidence-on-section-number/HIGH-confidence-on-dollar-figure
  distinction). `phaseoutRatePercent: 5`, a plain rate — the stepped round-up-to-next-$1,000
  cliff arithmetic itself is left to 13-09, exactly as this module stores every other
  phase-out's threshold/rate inputs without performing the phase-out.
- Project-local proof count rose from **779 (baseline) to 787** — 8 new proof leaves (5 on
  `dependents`, 3 on `childTaxCredit`).
- Both new cross-field/citation-discipline checks were mutation-verified: disabling
  `checkReferences` step 8 reddened exactly `mismatchedLengthRefusedNamingBothNumbers` (and no
  other leaf); retagging `odcAmount`'s citation to `kind: 'revProc'` reddened both
  `childTaxCreditOdcActcCapAndPhaseoutCiteIrc24hOnly` and
  `onlyCtcAmountIsRevProcSourcedAmongChildTaxCreditFigures` as predicted. Both mutations
  reverted cleanly (`git diff --stat` empty before each commit).

## Task Commits

Each task was committed atomically:

1. **Task 1: Add the dependents array to vnd.fjs.return_profile** - `1284a07` (feat)
2. **Task 2: Add CTC/ODC/ACTC/phase-out parameters** - `7fe1142` (feat)

**Plan metadata:** (this commit, following this SUMMARY)

## Files Created/Modified

- `fjs/return/profile/module.f.js` - Added `dependentEntrySchema` (local const),
  `dependents: option(array(dependentEntrySchema))` on `returnProfileSchema`, `checkReferences`
  step 8 (length cross-check), a docstring bullet stating the citizenship trust-boundary scope,
  and a `dependentsArray` proof block with 5 leaves (matching length, mismatched length named
  both ways, omitted-with-zero-count, four-field round-trip, per-checkbox `false` rejection).
- `fjs/tax/params/module.f.js` - Added `childTaxCredit` (own docstring plus the constant),
  extended `TaxParamSet`/`taxParamsByYear[2025]`/`everyDollarStringField` with the four new
  dollar-string fields, and added 3 proof leaves: `childTaxCreditCtcAmountCitesRevProc202532Section203`,
  `childTaxCreditOdcActcCapAndPhaseoutCiteIrc24hOnly`, and
  `onlyCtcAmountIsRevProcSourcedAmongChildTaxCreditFigures` (a count-based assertion, not a
  re-read of the two leaves above).

## Decisions Made

- `dependentEntrySchema`'s boolean-shaped facts (`ssnValidForEmployment`, `livedWithTaxpayer`)
  use `option(true)`, extending DOC-12's checkbox convention from printed-form checkboxes to a
  taxpayer-asserted credit-eligibility fact — absence is the conservative "not asserted true"
  default, and a structural `false` is rejected exactly like every other checkbox on this
  dialect (proven by `eachCheckboxRejectsFalse`).
- Citizenship/national/resident-alien status is deliberately NOT a fifth `dependents` field
  (13-CONTEXT.md Decision 5.7) — documented as an accepted trust boundary in this module's own
  docstring, mirroring `fjs/schedule/b`'s Form 8815 boundary precedent; Schedule 8812's own
  module (13-09) will restate the same boundary from its own side.
- `childTaxCredit.odcAmount`/`.actcCap`/`.phaseoutThreshold` all cite `kind: 'code'` §24(h) —
  never `kind: 'revProc'` — since 13-RESEARCH.md Pitfall 5 confirmed Rev. Proc. 2025-32 backs
  only the $2,200 CTC figure among this phase's new numbers. This is the first parameter group
  in `fjs/tax/params` with MIXED citation kinds among sibling dollar figures rather than one
  kind uniformly, which is why `onlyCtcAmountIsRevProcSourcedAmongChildTaxCreditFigures` exists
  as its own count-based proof rather than relying on the per-field leaves alone.

## Deviations from Plan

None — plan executed exactly as written. Both traps named in `<critical_constraints>` (naming
`dependentCount` alongside a new `dependents` array rather than replacing it; citing only the
CTC figure to Rev. Proc. 2025-32) were avoided as specified. No `roundUpToNextThousandDollars`
or phase-out arithmetic was written — that remains 13-09's job. `expectedThresholdCount` was
left untouched at 68. No `magi`/`Magi` identifier was added (`grep -rn "magi" fjs/` confirmed
empty after both commits).

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `dependents` and `childTaxCredit` are both in place for 13-09 to build `fjs/schedule/8812`
  itself: Part I (nonrefundable CTC/ODC, feeding 1040 line 19) and Part II-A (ACTC, feeding
  1040 line 28), including the `roundUpToNextThousandDollars` primitive and the stepped
  phase-out boundary proofs 13-RESEARCH.md §7 specifies.
- `fjs/form1040/core` (13-10) is untouched, as scoped — this plan deliberately stops short of
  wiring anything into a computing Form 1040.
- TAX-12 is NOT marked complete in REQUIREMENTS.md — Slice 4 spans 13-08 through 13-10 and
  closes only at 13-10, per this plan's own scope constraint.

---
*Phase: 13-the-65-profile-and-the-remaining-schedules*
*Completed: 2026-08-11*

## Self-Check: PASSED

- FOUND: `fjs/return/profile/module.f.js` (dependents array, checkReferences step 8)
- FOUND: `fjs/tax/params/module.f.js` (childTaxCredit)
- FOUND commit `1284a07` (Task 1: dependents array)
- FOUND commit `7fe1142` (Task 2: childTaxCredit parameters)
- `npm test`: 3025 passing, 0 failing
- Project-local proof count: 787 (baseline 779, risen)
- `grep -rn "magi" fjs/`: empty
