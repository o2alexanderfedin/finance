---
phase: 13-the-65-profile-and-the-remaining-schedules
plan: 12
subsystem: tax-engine
tags: [form1040, schedule-1, schedule-2, schedule-3, citation-granularity, end-to-end, functionalscript]

# Dependency graph
requires:
  - phase: 13 (Plan 13-11)
    provides: "fjs/schedule/1, fjs/schedule/2, fjs/schedule/3 -- standalone documented-zero
      modules, each exporting one pure function (profile) => Schedule{One,Two,Three}"
  - phase: 13 (Plan 13-10)
    provides: "sixtyFivePlusProfile computing 1040 lines 1a-37 end to end via all four prior
      vertical slices (retirement/SS income, senior deduction, itemizing, dependents)"
provides:
  - "fjs/form1040/core: 1040 lines 8/10 read scheduleOne(profile).line10/line26; lines
    17/23 read scheduleTwo(profile).line3/line21; lines 20/31 read
    scheduleThree(profile).line8/line15 -- ONE call per schedule, shared between its own
    two 1040 lines"
  - "wave5FullProfile -- the first proof combining every one of Phase 13's five slices
    (retirement/SS income, senior deduction, itemizing, dependents, Schedule 1/2/3
    citations) in ONE form1040Report(...) call, lines 1a-37, no refusal"
affects: [13-13 (magi gate fix, stale remedy strings, TAX-14 closure)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "One schedule call feeds BOTH its own 1040 lines: scheduleOneResult computed once,
      read by line8 (Part I total) and line10 (Part II total); scheduleTwoResult once,
      read by line17 (Part I) and line23 (Part II); scheduleThreeResult once, read by
      line20 (Part I) and line31 (Part II) -- never a second, independently stale call to
      the same schedule module"
    - "Citation-granularity-only wiring: replacing declaredZero(...) with a schedule
      module's own ReportLine preserves the VALUE (0n for every profile this engine
      computes) and changes only the sources array's provenance"

key-files:
  created: []
  modified: [fjs/form1040/core/module.f.js]

key-decisions:
  - "No typedef/orderedLines/count-constant change: 13-11-SUMMARY.md's own Next Phase
    Readiness note and this plan's own <interfaces> section both confirm all six lines
    (8/10/17/20/23/31) already existed as declaredZero placeholders since Phase 10, so
    Form1040IncomeLines/Form1040TaxAndPaymentLines typedefs, orderedLines,
    incomeLineFieldNames and expectedIncomeLineCount/expectedWholeReportLineCount are
    byte-identical before and after this plan"
  - "No scope reclassification: scheduleOneAdditionalIncome, scheduleOneAdjustments,
    scheduleTwoTaxes, scheduleThreeNonrefundableCredits, scheduleThreeRefundableCredits
    all stay in unmodeledKindRefusals -- expectedModeledKindCount stays 20,
    expectedUnmodeledKindCount stays 30, expectedThresholdCount stays 70, confirmed by
    direct read after this plan's own edits"
  - "wave5FullProfile's fixture: a single 65+ filer (one age box), $40,000.00 wages,
    $8,000.00 taxable IRA distribution, $30,000.00 SSA-1099 benefits, $20,000.00 itemized
    total (SALT $8,000 + mortgage $9,000 + charity $3,000, exceeding the $17,750.00
    standard deduction), one qualifying child dependent -- chosen so AGI ($73,500.00)
    stays under the $75,000.00 senior-deduction phase-out threshold and under the
    $200,000.00 CTC phase-out threshold, keeping the fixture's arithmetic checkable by
    hand while still producing four DIFFERENT non-zero figures"
  - "Each of the four asserted lines (6b/13b/12e/19) is cross-checked a SECOND way,
    independent of form1040Report's own wiring: the same facts fed directly to
    socialSecurityBenefitsWorksheet/scheduleOneA/scheduleA/form8812 respectively --
    mirroring Waves 1-4's own established cross-check idiom"

requirements-completed: []

# Metrics
duration: ~35min
completed: 2026-08-11
---

# Phase 13 Plan 12: Wire Schedules 1, 2 and 3 into Form 1040 Lines 8/10/17/20/23/31 Summary

**Form 1040 lines 8, 10, 17, 20, 23 and 31 now cite real `scheduleOne`/`scheduleTwo`/`scheduleThree` module output instead of an opaque inline `declaredZero(...)` call, and a single return combining every one of Phase 13's five vertical slices (retirement/Social Security income, the senior deduction, itemizing, dependents, and Schedule 1/2/3's own citations) now computes lines 1a-37 end to end with no refusal for the first time in this phase — values unchanged (still `$0.00` for the declared profile), citation granularity upgraded.**

## Performance

- **Duration:** ~35 min
- **Completed:** 2026-08-11
- **Tasks:** 2 completed
- **Files modified:** 1 (`fjs/form1040/core/module.f.js`)

## Accomplishments

- Imported `scheduleOne`/`scheduleTwo`/`scheduleThree` into `fjs/form1040/core/module.f.js`
  and wired all six lines: `line8` ← `scheduleOne(profile).line10` (Part I total), `line10`
  ← `scheduleOne(profile).line26` (Part II total), `line17` ← `scheduleTwo(profile).line3`
  (Part I total), `line23` ← `scheduleTwo(profile).line21` (Part II total), `line20` ←
  `scheduleThree(profile).line8` (Part I total), `line31` ← `scheduleThree(profile).line15`
  (Part II total). Each schedule is called EXACTLY ONCE (`scheduleOneResult`,
  `scheduleTwoResult`, `scheduleThreeResult`), shared between its own two 1040 lines, so
  neither of a schedule's two 1040 lines can ever read a second, independently stale
  computation of the same schedule.
- Verified by direct inspection and by `npm test` that no typedef, `orderedLines` entry,
  `incomeLineFieldNames` entry, or count constant needed to change — all six lines already
  existed as `declaredZero` placeholders since Phase 10, per 13-11-SUMMARY.md's own "Next
  Phase Readiness" prediction. `expectedIncomeLineCount === 31` and
  `expectedWholeReportLineCount === 56` are both byte-identical before and after this plan.
- Added `wave5FullProfile` — a single 65+ filer declaring all four prior waves' kinds plus
  all five Schedule 1/2/3 coarse kinds, with a W-2, a 1099-R (IRA), an SSA-1099, an itemized-
  deductions document exceeding the standard deduction, and one qualifying-child dependent.
  `form1040Report(...)` computes `outcome.kind === 'ok'` with `line6b` ($25,500.00),
  `line13b` ($6,000.00), `line12e` ($20,000.00) and `line19` ($2,200.00) ALL non-zero
  simultaneously — each hand-computed independently of the other three and cross-checked
  against a direct call to the sub-module that produced it
  (`socialSecurityBenefitsWorksheet`, `scheduleOneA`, `scheduleA`, `form8812`).
- The same leaf also asserts `line8`/`line10`/`line17`/`line20`/`line23`/`line31` all stay
  `$0.00` at the whole-report level — the property this plan's own objective states: value
  unchanged, citation granularity upgraded.
- Project-local proof count rose from **829 (13-11's ending count) to 830** — one new leaf,
  in `fjs/form1040/core`.
- `npm test` (`tsc && node --test`): 3068 passing, 0 failing (up from 3067).
- `grep -rn "magi" fjs/`: empty. `expectedModeledKindCount === 20`,
  `expectedUnmodeledKindCount === 30`, `expectedThresholdCount === 70`: all unchanged
  (this plan performs no scope reclassification, per its own objective).

## Task Commits

1. **Task 1: Wire lines 8, 10, 17, 20, 23 and 31 through the three schedule modules** -
   `07983a2` (feat)
2. **Task 2: The full-profile end-to-end proof — every prior wave's feature, one return** -
   `b94009f` (test)

**Plan metadata:** (this commit, following this SUMMARY)

## Files Created/Modified

- `fjs/form1040/core/module.f.js` — `scheduleOne`/`scheduleTwo`/`scheduleThree` imports;
  `scheduleOneResult`/`scheduleTwoResult`/`scheduleThreeResult` computed once each inside
  `form1040IncomeLines`/`form1040TaxAndPaymentLines`; `line8`/`line10`/`line17`/`line20`/
  `line23`/`line31` re-expressed as real `ReportLine`s citing their schedule's own
  `.value`/`.sources`; new `wave5FullProfile` proof section.

## Decisions Made

See `key-decisions` in frontmatter above.

## Deviations from Plan

None — plan executed exactly as written. The `<interfaces>` note's prediction (no
typedef/orderedLines/count-constant change needed) held exactly; the fixture design for
Task 2 (a single 65+ filer whose AGI stays under both the senior-deduction and CTC
phase-out thresholds) was chosen within Task 2's own latitude to produce a checkable-by-hand
fixture with four independently-verifiable non-zero figures, matching the plan's own
acceptance criteria verbatim.

## Mutation Verification

Per AGENTS.md's "a proof is not known to work until you have watched it fail" discipline,
two targeted mutations were run and reverted (verified clean via `git diff --stat` showing
zero changes after each revert):

1. **`line8`'s wired value, offset by `+1n`** — changing `scheduleOneResult.line10.value` to
   `scheduleOneResult.line10.value + 1n` reddened `wave5FullProfile`'s own AGI assertion
   AND `endToEndSectionOneTwoFiftyGainReachesLineSixteenThroughTheFullChain`'s pre-existing
   taxable-income assertion — both leaves depend on line8 feeding line9's total income, so
   the mutation was caught by two independent leaves, neither of which is an equivalent
   mutant.
2. **`wave5FullProfile`'s dependent, removed** — changing `dependents: [{ ...daughter... }]`
   to `dependents: []` reddened exactly `wave5FullProfile`'s own line19 assertion (dropping
   from `$2,200.00` to `$0.00`) and no other leaf, confirming the leaf's CTC assertion is
   load-bearing on the fixture's own dependent, not an artifact of some other input.

Both mutations typechecked cleanly, applied cleanly, and reddened the predicted leaf set
with no surprise in either direction.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Lines 8/10/17/20/23/31 now cite real Schedule 1/2/3 module output; all five coarse
  Schedule 1/2/3 kinds (`scheduleOneAdditionalIncome`, `scheduleOneAdjustments`,
  `scheduleTwoTaxes`, `scheduleThreeNonrefundableCredits`, `scheduleThreeRefundableCredits`)
  remain in `unmodeledKindRefusals` — unchanged by this plan, per its own objective.
- A single return exercising every one of Phase 13's five vertical slices together
  (`wave5FullProfile`) now computes lines 1a-37 with no refusal, proven at the whole-report
  level for the first time in this phase.
- **TAX-14 is NOT marked complete by this plan** — per this plan's own scope, Slice 5 closes
  at Plan 13-13, which still owns: the case-sensitive `magi`/`Magi` gate fix (carried
  finding C-1, confirmed empty again by this plan's own `grep -rn "magi" fjs/` check, but the
  gate itself is not yet mechanically case-insensitive), and correcting the five coarse
  kinds' stale remedy strings in `fjs/return/scope`'s `unmodeledKindRefusals` table (they
  currently say "Phase 13" as the remedy; this plan and 13-11 are the Phase-13 work that does
  NOT close them).
- Project-local proof count: 829 (13-11's ending count) → **830** (this plan).

---
*Phase: 13-the-65-profile-and-the-remaining-schedules*
*Completed: 2026-08-11*

## Self-Check: PASSED

- FOUND: `fjs/form1040/core/module.f.js`
- FOUND commit `07983a2` (Task 1)
- FOUND commit `b94009f` (Task 2)
- `npx tsc --noEmit`: clean
- `npm test`: 3068 passing, 0 failing
- Project-local proof count: 830 (baseline 829, risen)
- `grep -rn "magi" fjs/`: empty
- `expectedModeledKindCount === 20`, `expectedUnmodeledKindCount === 30`,
  `expectedThresholdCount === 70`: all confirmed unchanged by direct read
- `expectedIncomeLineCount === 31`, `expectedWholeReportLineCount === 56`: both confirmed
  unchanged by direct read
