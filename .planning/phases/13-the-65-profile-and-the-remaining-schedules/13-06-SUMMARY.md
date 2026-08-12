---
phase: 13-the-65-profile-and-the-remaining-schedules
plan: 06
subsystem: tax-documents
tags: [fjs, schedule-a, salt-cap, medical-floor, worksheet, boundary-proof, obbba]

# Dependency graph
requires:
  - phase: 13-the-65-profile-and-the-remaining-schedules
    provides: "13-05's vnd.fjs.itemized_deductions dialect, saltCap/medicalExpenseFloor TY2025 parameters, and the Schedule A line 18 election"
provides:
  - "fjs/schedule/a: Schedule A computing all 18 printed lines across six sections"
  - "The State and Local Tax Deduction Worksheet (w1-w10), with the MFS-halves-only-the-final-line mechanic proven separately from the non-MFS path"
  - "saltCapPhasedownIncome -- TAX-15's fourth independently-named income function"
  - "Decision 2.2's withholding-drift proof, watching stored W-2/1099-R state withholding against the taxpayer-asserted Schedule A line 5a without treating it as an input"
  - "fjs/tax/boundary's generic threshold inventory extended 58 -> 68 with the SALT cap's ten phase-down start/floor thresholds"
affects: [13-07]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Worksheet-line-tag filter as a box-read analog: sumEntriesByLineTag plays the role fjs/schedule/b's sumBoxOverDocuments plays for a fixed printed box, filtering vnd.fjs.itemized_deductions entries by lineTag instead of reading one fixed field name"
    - "Trusted taxpayer-asserted lines vs. documented zeros are two DIFFERENT boundary shapes on the same schedule: lines 8a-8c/11-14 pass an already-Pub-936/526-limited amount through unlimited (no zero, no refusal, just face value); lines 9/15 are true documented zeros citing declaredKinds -- conflating the two would misrepresent what the printed form's own face does"
    - "A PROOF that watches a second source for drift without ever making it an input (12.1 Decision 2.4's shape, reused for Decision 2.2): assertAssertedSaltIncomeTaxIsAtLeastStoredWithholding reads W-2/1099-R state withholding only to assert a floor on the independently-asserted line 5a, gated on the income-tax election being in force"

key-files:
  created:
    - fjs/schedule/a/module.f.js
  modified:
    - fjs/tax/boundary/module.f.js
    - fjs/document/w2/module.f.js
    - fjs/document/1099r/module.f.js

key-decisions:
  - "w1 and w9 of the SALT worksheet are computed identically regardless of filing status (the flat $40,000 cap / $10,000 floor); the ONE halving step for MFS is applied to w9 only when constructing w10, immediately before the final smaller-of comparison against line 5d -- getting this backwards (halving w1/w9 directly) produces a wrong number that looks entirely reasonable (13-RESEARCH.md Pitfall 2)"
  - "Lines 9 (Form 4952) and 15 (Form 4684) are unconditional documented zeros, never gated on whether investmentInterestForm4952 is declared -- that kind's scope refusal is fjs/return/scope's job (not built here); this module's own zero is correct for every return the engine can otherwise compute, where the kind is undeclared"
  - "Mortgage-interest and charitable entries (lines 8a-8c, 11-14) are read at face value with NO limitation arithmetic -- 13-RESEARCH.md §3 confirms Schedule A's own printed face performs no Pub. 936/526 computation at all, deferring entirely to those publications; this is a face-value read, not a zero and not a refusal"
  - "centsAtRatePercent (a new local helper) converts a plain-number rate percent, including a one-decimal-digit rate like medicalExpenseFloor's 7.5, into an exact Rational via (ratePercent x 10)/1000 -- fjs/schedule/1a's own percentOfCents only accepts a whole-number bigint rate and cannot be reused for 7.5%"
  - "saltCapPhasedownIncome is written independently of fjs/schedule/1a's seniorDeductionPhaseoutIncome, never imported or shared, even though both currently equal bare AGI -- Decision 5.6's qssParametersEqualMfjAndAreStoredIndependently precedent: identical values stored independently because the coincidence is contingent on what remains unmodeled"
  - "The withholding-drift proof is gated on the presence of a saltIncomeTax-tagged entry, not on a separate election flag -- absence of that tag (the general-sales-tax election, or nothing asserted) makes the check a silent no-op, proven by a dedicated fixture with vastly understating W-2 withholding that still passes"

requirements-completed: []

# Metrics
duration: 35min
completed: 2026-08-10
---

# Phase 13 Plan 06: Schedule A -- All 18 Lines, SALT Worksheet, Medical Floor Summary

**Schedule A (`fjs/schedule/a`) computing all 18 printed lines across six sections, with the State and Local Tax Deduction Worksheet's MFS-halves-only-the-final-line mechanic and the 7.5% medical floor proven cent-exact, plus Decision 2.2's withholding-drift proof over stored W-2/1099-R state withholding.**

## Performance

- **Duration:** ~35 min
- **Completed:** 2026-08-10
- **Tasks:** 2
- **Files modified:** 4 (1 created, 3 modified)

## Accomplishments

- `fjs/schedule/a/module.f.js` created: all 18 printed lines across Medical and
  Dental Expenses, Taxes You Paid, Interest You Paid, Gifts to Charity,
  Casualty and Theft Losses, and Total Itemized Deductions.
- The State and Local Tax Deduction Worksheet (`saltCapWorksheet`, w1-w10)
  transcribed line-for-line from 13-RESEARCH.md §3, with the MFS mechanic
  proven on its own dedicated fixture (`saltWorksheet.mfsHalvesOnlyTheFinalLine`)
  showing w1=$40,000 flat, w6=$350,000, w7=$105,000, w8=-$65,000, w9=$10,000
  flat, and line5e=$5,000 (half of w9) -- distinct from the non-MFS control
  at the same excess income, which stays unhalved at $10,000.
- 7.5% medical floor (line 3) computed cent-exact via a new
  `centsAtRatePercent` helper that accepts a fractional rate `number`
  (`medicalExpenseFloor.ratePercent` is 7.5, not a whole `bigint`).
- Lines 9 (Form 4952) and 15 (Form 4684) are documented zeros citing
  `profile.value.declaredKinds`, mirroring `fjs/schedule/b`'s Form 8815
  boundary. Lines 8a-8c/11-14 pass taxpayer-asserted amounts through
  unlimited, since Schedule A's own printed face performs no Pub. 936/526
  limitation arithmetic (proven with a fixture at a trivially small AGI
  where a real Pub. 526 percentage test would fail every real-world case).
- `saltCapPhasedownIncome` exported as TAX-15's fourth independently-named
  income function (Decision 5.6), deliberately not importing
  `seniorDeductionPhaseoutIncome`.
- Decision 2.2's withholding-drift proof
  (`assertAssertedSaltIncomeTaxIsAtLeastStoredWithholding`) added, gated on
  the `saltIncomeTax` election being in force, with a positive case, a
  refusing control (via a locally reimplemented `refuses` helper), an
  election-gating no-op case, and a multi-document/multi-row aggregation
  case.
- `fjs/document/w2` and `fjs/document/1099r` docstrings amended: both now
  state a PROOF reads `stateIncomeTax`/`stateTaxWithheld` to watch for
  drift, while computation still never does -- two different, both-true
  claims.
- `fjs/tax/boundary/module.f.js` extended: ten new SALT-cap phase-down
  start/floor thresholds (5 filing statuses x 2, including
  `marriedFilingSeparately`, which the senior-deduction thresholds omit but
  the SALT worksheet's own w5 line genuinely needs); `expectedThresholdCount`
  58 -> 68.
- Neither TY2026 OBBBA itemized-deduction change (0.5% charitable AGI floor,
  "2/37ths" high-income haircut) is implemented -- pinned with a negative
  proof (`obbbaTy2026ChangesNotImplemented`) showing a large charitable
  gift at a high AGI still deducts in full.
- Project-local proof count rose from **731 (13-05 baseline) to 765** -- 34
  new proof leaves.

## Task Commits

Each task was committed atomically:

1. **Task 1+2 combined (Schedule A module, including the drift proof authored in the same pass): "Build Schedule A -- all 18 lines, SALT worksheet, medical floor"** - `0660b2f` (feat)
2. **Task 2 (docstring amendments): "amend w2/1099r docstrings for Decision 2.2's drift proof"** - `d96f6e1` (docs)

**Plan metadata:** (this commit, following this SUMMARY)

_Note on commit granularity: `fjs/schedule/a/module.f.js` was authored in a
single Write pass covering both Task 1's schedule arithmetic and Task 2's
withholding-drift proof, since the drift proof lives in the same file as the
schedule it watches. Commit `0660b2f` therefore carries the file's complete
content (Task 1 + the drift-proof code from Task 2); commit `d96f6e1` carries
Task 2's remaining piece, the w2/1099r docstring amendments. Both tasks'
`<done>` criteria are independently verified in the Self-Check below._

## Files Created/Modified

- `fjs/schedule/a/module.f.js` - New module: `scheduleA`, `saltCapWorksheet`
  (private), `saltCapPhasedownIncome` (exported), `centsAtRatePercent`
  (private rational-based rate helper), the local `sumEntriesByLineTag`/
  `sumMedicalEntriesNetOfReimbursement`/`addBoxSums`/`documentLine`/
  `profileDeclaredZeroLine` helper family (reimplemented, not imported from
  `fjs/form1040/core`), and `assertAssertedSaltIncomeTaxIsAtLeastStoredWithholding`
  (the withholding-drift proof) plus a locally reimplemented `refuses`
  helper. 34 proof leaves across medical floor, SALT worksheet (including a
  TAX-04 boundary trio at the $500,000 threshold), documented zeros, trusted
  taxpayer-asserted lines, line 18, the OBBBA negative pin, an end-to-end
  18-line fixture, and the withholding-drift proof.
- `fjs/tax/boundary/module.f.js` - Added `saltCapThresholds` (10 entries,
  derived from `taxParams2025.saltCap.threshold`/`flatCap`/`floor`/
  `phasedownRatePercent`, never a second hand-typed literal); spread into
  `allThresholds`; `expectedThresholdCount` 58 -> 68.
- `fjs/document/w2/module.f.js` - Docstring paragraph amended: a proof in
  `fjs/schedule/a` now reads `stateIncomeTax`, computation still does not.
- `fjs/document/1099r/module.f.js` - Same amendment, naming `stateTaxWithheld`
  precisely (never "box 14").

## Decisions Made

See `key-decisions` in frontmatter above.

## Deviations from Plan

None -- plan executed exactly as written. Both critical constraints (the
SALT MFS mechanic, the TY2026 OBBBA exclusion) were implemented and pinned
with dedicated fixtures/negative proofs as specified; no `magi`/`Magi`
identifier was added (verified against `fjs/schedule/a/module.f.js`,
`fjs/tax/boundary/module.f.js`, `fjs/document/w2/module.f.js`, and
`fjs/document/1099r/module.f.js` individually -- pre-existing `Magi`
identifiers in `fjs/schedule/1a/module.f.js` and `fjs/form1040/core/module.f.js`,
files this plan did not touch, are carried finding C-1, owned by plan 13-13).

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `fjs/schedule/a` computes correctly against real numbers, ready for 13-07
  to build `deductionChoice` (the standard-vs-itemized comparison,
  `fjs/tax/deduction`) and wire Schedule A's line 17 into Form 1040 line 12e.
- `saltCapPhasedownIncome` is available for 13-07 or any later plan needing
  the SALT cap's own income measure.
- TAX-13 is deliberately NOT marked complete in REQUIREMENTS.md -- slice 3
  closes at 13-07, per this plan's own scope boundary.
- `fjs/tax/boundary`'s `expectedThresholdCount` is now 68; 13-09 is expected
  to take it to 70 per this plan's own critical constraints.

---
*Phase: 13-the-65-profile-and-the-remaining-schedules*
*Completed: 2026-08-10*

## Self-Check: PASSED

- FOUND: `fjs/schedule/a/module.f.js`
- FOUND: `.planning/phases/13-the-65-profile-and-the-remaining-schedules/13-06-SUMMARY.md`
- FOUND commit `0660b2f` (Schedule A module + fjs/tax/boundary extension)
- FOUND commit `d96f6e1` (w2/1099r docstring amendments)
- `npm test`: 3003 passing, 0 failing
- Project-local proof count: 765 (baseline 731, risen)
- `fjs/tax/boundary` `allThresholds.length` / `expectedThresholdCount`: 68 / 68
- `grep -rn "magi" fjs/`: empty
- `grep -in "magi" fjs/schedule/a/module.f.js fjs/tax/boundary/module.f.js fjs/document/w2/module.f.js fjs/document/1099r/module.f.js`: empty
