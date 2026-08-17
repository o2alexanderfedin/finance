---
phase: 13-the-65-profile-and-the-remaining-schedules
plan: 01
subsystem: tax-engine

tags: [tax-params, social-security, worksheet, citation, ssb, functionalscript]

# Dependency graph
requires:
  - phase: 12.1-the-capital-gain-chain
    provides: Form 1040 line 7a wiring, Schedule D, the worksheet-as-named-functions
      idiom this plan's `fjs/tax/ssb` follows
provides:
  - "fjs/tax/params: Citation widened to a { kind: 'revProc' | 'publicLaw' | 'code' }
    discriminated union, additive, no existing value changed"
  - "fjs/tax/params: socialSecurityBenefitsWorksheetBaseAmounts (IRC §86(c), four
    amounts, kind: 'code')"
  - "fjs/tax/ssb: the 18-line Social Security Benefits Worksheet as pure, named,
    printed-order functions, plus socialSecurityCombinedIncome (one of TAX-15's
    four income-measure functions)"
affects: [13-02-retirement-and-social-security-income-wiring, 13-slices-2-through-5,
  13-13-prose-corrections]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Citation as a three-arm discriminated union ({kind:'revProc'|'publicLaw'|'code'}),
      pulled forward one plan early because this plan's own new parameter needed the
      'code' arm immediately"
    - "18-line worksheet as one named const per printed line, IRS order, record return
      shape (fjs/tax/line16/qdcgt's idiom, second instance)"
    - "A whole-function three-way branch (not a parameterized flag) for a worksheet's
      structurally different filing-status case"

key-files:
  created: [fjs/tax/ssb/module.f.js]
  modified: [fjs/tax/params/module.f.js, demo/steps/06-parameters.js]

key-decisions:
  - "Citation's discriminated-union widening (13-CONTEXT.md Decision 5.2, originally
    Slice 2) landed in this plan instead, because socialSecurityBenefitsWorksheetBaseAmounts
    needed the 'code' arm immediately and widening the type twice would have been more
    disruptive than widening it once"
  - "SsbWorksheetInput gained a scheduleOneAdjustmentsTotalCents field not named in the
    plan's own action text, since line 6 needs a real caller-supplied value (always 0n
    this phase, but genuinely read, not hardcoded)"
  - "The MFS-lived-with-spouse branch computes line16 as 85% of line7, not line1 as the
    plan's own task text said — corrected against 13-RESEARCH.md's verified transcription
    of i1040gi.pdf p32, confirmed by the worksheet's own general formula converging to
    that result when both base-amount thresholds are mechanically zeroed"

requirements-completed: []

# Metrics
duration: ~35min
completed: 2026-08-11
---

# Phase 13 Plan 1: Citation Widening and the 18-Line Social Security Benefits Worksheet Summary

**`fjs/tax/params` gains a three-kind `Citation` union plus IRC §86(c) base amounts, and `fjs/tax/ssb` computes the Social Security Benefits Worksheet's all 18 printed lines — including the tax-exempt-interest add-back and the three-way filing-status branch — as pure named functions with 11 passing proofs.**

## Performance

- **Duration:** ~35 min (approximate; not captured at session start)
- **Completed:** 2026-08-11T01:37:00Z
- **Tasks:** 2 (Task 2 executed as TDD: RED then GREEN)
- **Files modified:** 3 (1 new, 2 modified)

## Accomplishments

- `fjs/tax/params/module.f.js`'s `Citation` type is now a discriminated union
  (`kind: 'revProc' | 'publicLaw' | 'code'`); every one of the 21 pre-existing citation
  literals gained `kind: 'revProc'` with no value changed, and the module gained
  `socialSecurityBenefitsWorksheetBaseAmounts` (four IRC §86(c) amounts).
- `fjs/tax/ssb/module.f.js` is a new module computing the Social Security Benefits
  Worksheet's all 18 printed lines (i1040gi.pdf p32) in IRS order, over integer cents,
  as one named `const` per line — mirroring `fjs/tax/line16/qdcgt`'s established idiom.
- The tax-exempt-interest add-back at line 4 is proven load-bearing: an otherwise-identical
  85%-tier fixture's taxable amount changes by exactly $3,200.00 when line 4 is zeroed.
- Line 8's genuine three-way branch (MFJ / single-etc / MFS-lived-with-spouse) is modeled
  as an explicit fork of the whole function, not a parameterized base amount.
- Both STOP conditions (line 7's and line 9's) are proven, each with a control fixture one
  dollar past the boundary showing the STOP does NOT fire there.

## Task Commits

Task 2 ran as TDD (`tdd="true"`): RED then GREEN, two commits.

1. **Task 1: Widen Citation to a discriminated union; add the SSB worksheet's base-amount
   parameters** - `f2e28a0` (feat)
2. **Task 2 (RED): failing tests for the 18-line worksheet** - `4c12407` (test)
3. **Task 2 (GREEN): implement the worksheet** - `e98d64f` (feat)

No plan-metadata commit yet — this commit follows below, alongside STATE.md/ROADMAP.md.

## Files Created/Modified

- `fjs/tax/params/module.f.js` — `Citation` widened to a discriminated union;
  `socialSecurityBenefitsWorksheetBaseAmounts` added; `assertRevProcCitation` narrowing
  helper added for the pre-existing proof leaves that read `.citation.revProc`; new proof
  leaf `socialSecurityBaseAmountsCiteIrc86cOnly`.
- `fjs/tax/ssb/module.f.js` (new) — `socialSecurityBenefitsWorksheet`,
  `socialSecurityCombinedIncome`, `expectedWorksheetLineCount`, `SsbWorksheetInput`/
  `SsbWorksheetResult` typedefs, 11 proof leaves.
- `demo/steps/06-parameters.js` — `cite()` helper updated to render all three `Citation`
  kinds (Rev. Proc. / Public Law / bare IRC section); a Rule 3 fix for the `tsc` error the
  widening otherwise caused on this plain-JS demo page.

## Decisions Made

- **TAX-10 is NOT marked complete after this plan**, despite being named in its
  frontmatter — this plan builds only Slice 1's foundation (the widened `Citation`, the
  base amounts, and the standalone worksheet module); nothing wires it into Form 1040 yet.
  Mirrors 12.1's precedent (TAX-11/TAX-15 deferred to 12.1-04): a requirement spanning
  multiple plans is marked complete only once the last plan that finishes it lands.
  Deferred to Plan 13-02, which wires `fjs/tax/ssb` into `fjs/form1040/core` and performs
  Slice 1's scope reclassification.
- **Citation widening pulled forward from Slice 2 into this plan.** 13-CONTEXT.md
  Decision 5.2 placed the three-arm union in Slice 2 (the senior deduction, needing
  `'publicLaw'`). This plan's own `socialSecurityBenefitsWorksheetBaseAmounts` needed the
  `'code'` arm immediately, and widening the type twice (once now for `'code'`, again later
  for `'publicLaw'`) would have been more disruptive than widening it once to the union
  Slice 2 already commits to. Documented in the module's own docstring, one paragraph, per
  the plan's own instruction.
- **`SsbWorksheetInput` gained `scheduleOneAdjustmentsTotalCents`.** The plan's task
  4-field input list (`status`, `mfsLivedWithSpouseAtAnyTimeInYear`,
  `totalSsaAndRrbBox5Cents`, `otherIncomeLine3Cents`, `taxExemptInterestCents`) omitted a
  field for line 6 (Schedule 1 lines 11–20, 23, 25 total), even though the plan's own
  `<behavior>` section says line 6 is "take[n] as a caller-supplied ReportLine, do not
  compute Schedule 1 here." Hardcoding line 6 to `0n` inside the module would have been an
  undocumented stub; adding the field (always `0n` from every real caller this phase, but
  genuinely read rather than baked in) keeps the module honest and needs no change when a
  later wave wires Schedule 1. See Deviations below (Rule 2).
- **`assertRevProcCitation` narrowing helper added to `fjs/tax/params`.** The `Citation`
  widening left `tsc` unable to see `.revProc` on a bare `Citation` in the pre-existing
  proof leaves that read it (they know, but the compiler cannot, that every pre-Phase-13
  citation is `'revProc'`-kind). A cast or non-null assertion is banned by AGENTS.md; a
  small `assert`-based narrowing function (mirroring `assertNotNullish`'s own idiom) is the
  compliant alternative.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added `scheduleOneAdjustmentsTotalCents` to `SsbWorksheetInput`**
- **Found during:** Task 2 (designing the worksheet's input shape)
- **Issue:** The plan's `<action>` section lists five input fields and omits one for line 6
  (Schedule 1 total), while the plan's own `<behavior>` section says line 6 is
  caller-supplied. Without a sixth field, line 6 could only be a hardcoded `0n`, which is an
  undocumented stub that would need silent surgery in a later wave.
- **Fix:** Added `scheduleOneAdjustmentsTotalCents: bigint` to `SsbWorksheetInput`,
  documented in the module's own docstring as "always `0n` from every real caller this
  phase, since Schedule 1 stays unmodeled-refused until Wave 5" but genuinely read.
- **Files modified:** `fjs/tax/ssb/module.f.js`
- **Verification:** `line7StopsWhenScheduleOneAdjustmentsAtLeastCoverCombinedIncome` proof
  leaf exercises line 6 directly, including its own STOP condition and a one-dollar-past
  control.
- **Committed in:** `e98d64f` (Task 2 GREEN commit)

**2. [Rule 1 - Bug] Corrected the MFS-lived-with-spouse branch's line 16 formula**
- **Found during:** Task 2 (transcribing the worksheet's line 8 three-way branch)
- **Issue:** 13-01-PLAN.md's own `<action>`/`<acceptance_criteria>` text says the
  MFS-lived-with-spouse branch computes `line16 = line1 × 85%` (identical to line 17,
  described as "a degenerate case where line16 === line17"). 13-RESEARCH.md §2 — the
  verified, PDF-sourced transcription this executor's governing instructions require
  trusting over a recalled or paraphrased figure — states instead: `"SKIP to line16 = line7
  x 85%, then go to line17"`. Implementing the plan's literal text would have shipped an
  incorrect tax computation for every MFS-lived-with-spouse filer whose line 7 differs from
  line 1 (i.e. essentially always, since line 7 already reflects the 50%-of-benefits/
  other-income/tax-exempt-interest combination, not raw benefits).
- **Fix:** Implemented `line16 = round(line7 × 85%)`, matching research. Verified
  independently: mechanically setting both base-amount thresholds (line 8, line 10) to zero
  in the worksheet's own GENERAL formula and running it through algebraically converges to
  exactly `line16 = line7 × 85%` — the shortcut the printed page states, not a
  reinterpretation.
- **Files modified:** `fjs/tax/ssb/module.f.js`
- **Verification:** `mfsLivedWithSpouseSkipsToLineSixteenAsEightyFivePercentOfLineSeven`
  uses a fixture where line 7 ($20,000.00) and line 1 ($30,000.00) deliberately differ, so
  the two candidate formulas (line7×85% vs. line1×85%) cannot coincidentally agree — the
  proof would fail under the plan's literal (line1-based) formula.
- **Committed in:** `e98d64f` (Task 2 GREEN commit), documented at length in the module's
  own docstring so a future reader does not "fix" this back to match the stale plan text.

**3. [Rule 3 - Blocking] Fixed `demo/steps/06-parameters.js`'s `tsc` error from the Citation widening**
- **Found during:** Task 1 (widening `Citation`)
- **Issue:** `cite()`'s parameter type assumed the old single-shape `Citation`
  (`{ revProc, section }`); widening `Citation` to a union broke `tsc` at five call sites in
  this plain-JS demo page (`TS2345`).
- **Fix:** `cite()` now branches on `citation.kind` and renders the correct authority string
  for all three kinds (Rev. Proc. / Public Law / bare IRC section).
- **Files modified:** `demo/steps/06-parameters.js`
- **Verification:** `npx tsc --noEmit` clean.
- **Committed in:** `f2e28a0` (Task 1 commit)

---

**Total deviations:** 3 auto-fixed (1 missing critical, 1 bug fix against the plan's own
literal text but in favor of its cited research, 1 blocking)
**Impact on plan:** All three were necessary for correctness or to keep the build green.
Deviation 2 is the most consequential — it changes a specific dollar formula from what the
plan's task text literally said — and is documented prominently (module docstring, this
Summary, and the proof leaf's own comments) so it is visible to Plan 13-02 and to
13-VALIDATION.md, and so nobody "fixes" it back to the stale figure.

## Issues Encountered

None beyond the deviations above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `fjs/tax/ssb/module.f.js` is a complete, tested, standalone worksheet module. Plan 13-02
  (Slice 1's remaining step) wires it into `fjs/form1040/core` — reading real stored
  SSA-1099/RRB-1099/1099-R documents to build `SsbWorksheetInput`, threading the
  `iraDeductionDeclared` circularity refusal one level up (NOT implemented in this module,
  per the plan's own scope boundary), and reclassifying `socialSecurityBenefits`,
  `iraDistributions`, and `pensionsAndAnnuities` from `unmodeledKindRefusals` to
  `modeledKinds`.
- `Citation`'s widening is now live project-wide; Slice 2's senior-deduction parameters
  (needing the `'publicLaw'` arm) can be added directly without touching the type again.
- Flag for Plan 13-02 / 13-13: this plan's Deviation 2 (line 16's corrected formula) should
  be cross-checked once more against the actual printed worksheet if a real filed return
  becomes available for Phase 14's acceptance test, since it is the one figure in this plan
  not independently reproduced by a second research pass.

---
*Phase: 13-the-65-profile-and-the-remaining-schedules*
*Completed: 2026-08-11*

## Self-Check: PASSED

- FOUND: `fjs/tax/ssb/module.f.js`
- FOUND: `fjs/tax/params/module.f.js`
- FOUND: `demo/steps/06-parameters.js`
- FOUND commit: `f2e28a0` (Task 1)
- FOUND commit: `4c12407` (Task 2 RED)
- FOUND commit: `e98d64f` (Task 2 GREEN)
- `npx tsc --noEmit`: clean
- `npm test`: 2915 pass, 0 fail
- Project-local proof count: 665 (phase baseline) → 666 (after Task 1) → 677 (after Task 2)
