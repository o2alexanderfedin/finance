---
phase: 13-the-65-profile-and-the-remaining-schedules
plan: 05
subsystem: tax-documents
tags: [rtti, fjs, schedule-a, salt-cap, medical-floor, taxpayer-asserted-dialect, obbba]

# Dependency graph
requires:
  - phase: 13-the-65-profile-and-the-remaining-schedules
    provides: "13-04's Schedule 1-A/senior-deduction slice (Citation discriminated union, AGI feeding line 13b)"
provides:
  - "vnd.fjs.itemized_deductions dialect: line-tagged, taxpayer-asserted Schedule A entries with no stored total and no formRevision"
  - "saltCap TY2025 parameters (flat $40,000 cap, $10,000 floor, 30% continuous phasedown rate, $500k/$250k(MFS) threshold), cited to OBBBA Public Law 119-21 §70120"
  - "medicalExpenseFloor TY2025 parameter (7.5% rate), cited to IRC §213(a)"
  - "Schedule A line 18 itemize-anyway election (itemizeEvenThoughLessThanStandardDeduction) on vnd.fjs.return_profile"
affects: [13-06, 13-07]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Taxpayer-asserted dialect verbatim reuse: vnd.fjs.itemized_deductions copies vnd.fjs.medical_expenses's no-formRevision/no-total/free-string-category design and docstring argument exactly, substituting Schedule A for medical"
    - "SALT cap worksheet mechanic: flat, non-MFS dollar figures on every worksheet line except the FINAL one, which alone halves the result for MFS (13-RESEARCH.md Pitfall 2) -- stored as ONE set of flat parameters, no MFS-specific flatCap/floor"
    - "Rate-not-money parameter shape: medicalExpenseFloor.ratePercent and saltCap.phasedownRatePercent are plain numbers, excluded from the dollar-string round-trip proof, mirroring seniorDeduction.phaseoutRatePercent/Bracket.ratePercent"

key-files:
  created:
    - fjs/document/itemized_deductions/module.f.js
  modified:
    - fjs/tax/params/module.f.js
    - fjs/return/profile/module.f.js

key-decisions:
  - "saltCap stores the worksheet's FLAT dollar figures only (flatCap, floor, threshold per status) -- no MFS-halved flatCap/floor -- because 13-RESEARCH.md's transcription shows only the worksheet's final line (w10) halves the result for MFS; storing a pre-halved parameter would misrepresent what the printed worksheet lines actually say"
  - "medicalExpenseFloor and saltCap.phasedownRatePercent are plain numbers (ratePercent), not AmountWithCitation -- rates crossing no money boundary, per AGENTS.md's decimal-string rule governing DOLLAR amounts only"
  - "itemized_deductions checkReferences has no isoDate check (unlike medical_expenses's datePaid check) -- this dialect has no date field; entries are lineTag/provider/amount only"

requirements-completed: [TAX-13]

# Metrics
duration: 25min
completed: 2026-08-11
---

# Phase 13 Plan 05: SALT/Medical Parameters, Itemized Deductions Dialect, and Line 18 Election Summary

**New `vnd.fjs.itemized_deductions` taxpayer-asserted dialect (line-tagged, no total), OBBBA-cited SALT cap/phasedown and IRC-cited 7.5% medical floor parameters, and the Schedule A line 18 itemize-anyway election on the return profile — the foundation Wave 3 (itemizing, TAX-13) builds Schedule A itself on.**

## Performance

- **Duration:** ~25 min
- **Completed:** 2026-08-11
- **Tasks:** 2 (Task 2 executed as TDD RED/GREEN, 2 commits)
- **Files modified:** 3 (1 created, 2 modified)

## Accomplishments

- `saltCap` and `medicalExpenseFloor` added to `fjs/tax/params`, both citing the correct
  `Citation` union arm: `saltCap`'s seven dollar figures all `kind: 'publicLaw'` (OBBBA Public
  Law 119-21 §70120), `medicalExpenseFloor` `kind: 'code'` (IRC §213(a)) — neither claims
  Rev. Proc. 2025-32, which backs only the CTC among this phase's new numbers
  (13-RESEARCH.md Pitfall 5).
- `vnd.fjs.itemized_deductions` created as a verbatim structural/reasoning copy of
  `vnd.fjs.medical_expenses`: no `formRevision`, no stored total, free-string `lineTag`,
  `moneyFieldError`-backed exactness check, `''`/`''` payer/account subject cardinality.
- `itemizeEvenThoughLessThanStandardDeduction: option(true)` added to
  `vnd.fjs.return_profile`, mirroring `hadForeignFinancialAccount`'s additive,
  taxpayer-declared, no-cross-field-validation pattern.
- Project-local proof count rose from **718 (baseline) to 731** — 13 new proof leaves.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add SALT cap and medical floor parameters** - `206e505` (feat)
2. **Task 2 (TDD RED): failing test for itemized_deductions exactness check** - `5c5321a` (test)
   **Task 2 (TDD GREEN): implement checkReferences** - `24331ce` (feat)
   **Task 2 (additive): Schedule A line 18 election on return profile** - `b14a99b` (feat)

**Plan metadata:** (this commit, following this SUMMARY)

_Note: Task 2 carried the mandatory TDD RED/GREEN cycle for the dialect's exactness check,
plus one additional additive commit for the structurally independent profile field._

## TDD Gate Compliance

- RED gate: `5c5321a` `test(13-05): add failing test for vnd.fjs.itemized_deductions exactness check`
  — `proof.amounts.commaGroupedRejected` failed as the only red leaf (structural validation
  alone accepts a comma-grouped amount; every round-trip/empty-entries/noTotalIsStored/
  cross-dialect leaf already passed without `checkReferences`).
- GREEN gate: `24331ce` `feat(13-05): implement vnd.fjs.itemized_deductions checkReferences`
  — wired `moneyFieldError`'s per-entry loop into `validate`; `commaGroupedRejected` now passes,
  and every other leaf stayed green.
- No REFACTOR commit was needed — the GREEN implementation mirrored `medical_expenses`'s
  established shape with no cleanup pass required.

## Files Created/Modified

- `fjs/document/itemized_deductions/module.f.js` - New taxpayer-asserted dialect:
  `dialect`/`mediaType`, `itemizedEntry` (`lineTag`/`provider`/`amount`, no `reimbursed`
  analog), `itemizedDeductionsSchema` (no `formRevision`), `checkReferences` (per-entry
  `moneyFieldError`), `validate`, and 9 proof leaves including a `crossDialect` structural
  rejection of a `vnd.fjs.medical_expenses` blob.
- `fjs/tax/params/module.f.js` - Added `saltCap` (flatCap $40,000.00, floor $10,000.00,
  phasedownRatePercent 30, threshold single/MFJ/HoH/QSS $500,000.00, MFS $250,000.00, all
  `kind: 'publicLaw'` §70120) and `medicalExpenseFloor` (ratePercent 7.5, `kind: 'code'`
  §213(a)); extended `TaxParamSet`, `taxParamsByYear[2025]`, `everyDollarStringField` (7 new
  dollar-string fields), and added two per-citation proof leaves
  (`saltCapCitesPublicLaw11921Section70120`, `medicalExpenseFloorCitesIrc213aOnly`).
- `fjs/return/profile/module.f.js` - Added
  `itemizeEvenThoughLessThanStandardDeduction: option(true)` to `returnProfileSchema`, a
  docstring bullet, and a `scheduleALine18Election` proof block (validates `true`, rejects
  `false` per DOC-12).

## Decisions Made

- `saltCap` stores only the worksheet's flat, non-MFS dollar figures (`flatCap`, `floor`,
  five `threshold` entries) — no separate MFS-halved amounts — because 13-RESEARCH.md §3's
  exact line-by-line transcription shows the SALT worksheet's body (w1 through w9) uses the
  flat figures throughout; only the worksheet's FINAL line (w10) halves the computed result
  for MFS. That halving is Schedule A's own arithmetic to perform in 13-06, not a
  pre-computed parameter to store here — storing an MFS-specific cap/floor would misrepresent
  what the printed worksheet lines say (the exact trap 13-RESEARCH.md Pitfall 2 names).
- `medicalExpenseFloor.ratePercent` and `saltCap.phasedownRatePercent` are plain `number`
  fields, not `AmountWithCitation` — AGENTS.md's decimal-string rule governs DOLLAR amounts
  crossing the money boundary; a rate is neither a dollar amount nor a computed/fractional
  value, matching `seniorDeduction.phaseoutRatePercent` and `Bracket.ratePercent` precedent.
  Both are excluded from `everyDollarStringField`'s round-trip proof.
- `vnd.fjs.itemized_deductions`'s `checkReferences` has no ISO-date check, unlike
  `medical_expenses`'s `datePaid` check — this dialect carries no date field at all
  (`lineTag`/`provider`/`amount` only), so there is no analogous semantic refinement to add.

## Deviations from Plan

None — plan executed exactly as written. Both `<critical_constraints>` traps (the SALT MFS
mechanic, the Rev. Proc. 2025-32 misattribution) were avoided as specified; neither TY2026
OBBBA itemized change was implemented; no `magi`/`Magi` identifier was added.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `vnd.fjs.itemized_deductions`, `saltCap`, `medicalExpenseFloor`, and the Schedule A line 18
  election are all in place for 13-06 to build Schedule A itself and `deductionChoice`'s
  standard-vs-itemized comparison against real numbers.
- `fjs/schedule/a` (13-06) and `fjs/form1040/core`'s line 12e wiring (13-07) are untouched, as
  scoped — this plan deliberately stops short of computing anything from these new pieces.
- TAX-13 is NOT marked complete in REQUIREMENTS.md — slice 3 closes at 13-07, not here (per
  this plan's own verification instructions).

---
*Phase: 13-the-65-profile-and-the-remaining-schedules*
*Completed: 2026-08-11*

## Self-Check: PASSED

- FOUND: `fjs/document/itemized_deductions/module.f.js`
- FOUND: `.planning/phases/13-the-65-profile-and-the-remaining-schedules/13-05-SUMMARY.md`
- FOUND commit `206e505` (Task 1: saltCap/medicalExpenseFloor)
- FOUND commit `5c5321a` (Task 2 RED: failing exactness test)
- FOUND commit `24331ce` (Task 2 GREEN: checkReferences implementation)
- FOUND commit `b14a99b` (Task 2: Schedule A line 18 election)
- `npm test`: 2969 passing, 0 failing
- Project-local proof count: 731 (baseline 718, risen)
- `grep -rn "magi" fjs/`: empty
