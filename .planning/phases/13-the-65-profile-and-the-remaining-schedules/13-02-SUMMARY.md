---
phase: 13-the-65-profile-and-the-remaining-schedules
plan: 02
subsystem: tax-engine

tags: [1099-r, ssa1099, social-security, ira, pension, scope-reclassification, form1040, functionalscript]

# Dependency graph
requires:
  - phase: 13-01-citation-widening-and-the-ssb-worksheet
    provides: "fjs/tax/ssb's socialSecurityBenefitsWorksheet and
      socialSecurityCombinedIncome, the 18-line worksheet this plan wires
      into Form 1040"
provides:
  - "fjs/form1040/core: Form1040Inputs widened 5->7 curried params
    (retirementForms, socialSecurityForms); real lines 4a/4b/5a/5b (1099-R,
    routed by box7bIraSepSimple), 6a/6b (SSA-1099 + SSB worksheet), and 25b
    (now sums 1099-INT + 1099-R + 1099-DIV + 1099-B withholding)"
  - "fjs/return/profile: iraDeductionDeclared and
    mfsLivedWithSpouseAtAnyTimeInYear, two new option(true) fields"
  - "fjs/return/scope: modeledKinds 12->16, unmodeledKindRefusals 38->34 --
    iraDistributions, pensionsAndAnnuities, socialSecurityBenefits,
    federalTaxWithheldOnOther1099 now modeled"
affects: [13-03-the-senior-deduction-parameters-and-schedule-1a,
  13-05-schedule-a-and-deductionchoice, 13-08-schedule-8812,
  13-11-schedules-1-2-3, 13-13-prose-corrections]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "The IRA-deduction circularity refused via a document-data-sufficiency
      error-arm (unmodeled: []), not a fjs/return/scope kind -- the frozen
      50-kind vocabulary has no way to distinguish an IRA deduction from any
      other Schedule 1 adjustment, so the refusal lives one level up, in
      fjs/form1040/core, gated on a new profile field"
    - "A profile-declared boolean gated by filing STATUS at the call site
      (mfsLivedWithSpouseAtAnyTimeInYear), so an inconsistently-declared
      profile is read as false rather than tripping the worksheet's own
      internal assert -- input validation at the boundary, not an unhandled
      throw one module in"
    - "1099-R routing by box7bIraSepSimple: filter the SAME document array
      twice (=== true / !== true) rather than branching per-document inline,
      so the two resulting sums stay simple sumBoxOverDocuments calls"
    - "Adapt-in-place across a two-commit atomic transition: a proof leaf
      written in Task 1 to assert 'still refuses today' is REWRITTEN, not
      deleted, in Task 2's own commit once the kind it names is reclassified
      -- the same mechanical move 12.1-04's absent-basis leaf already
      narrates for an earlier reclassification"

key-files:
  created: []
  modified: [fjs/form1040/core/module.f.js, fjs/return/profile/module.f.js,
    fjs/return/scope/module.f.js, demo/lib/fixtures.js,
    demo/steps/04-refusal.js, demo/steps/05-exactness.js]

key-decisions:
  - "line25b sums all FOUR withholding-carrying document types (1099-INT,
    1099-R, 1099-DIV, 1099-B) in this single task, per the plan's own
    instruction not to defer 1099-DIV/1099-B's contribution -- matches
    federalTaxWithheldOnOther1099's own remedy string, which already named
    all three of the latter."
  - "A fifth pre-existing proof leaf, outside the plan's own named four,
    hard-coded socialSecurityBenefits as a whole-report 'still refused'
    fixture inside fjs/form1040/core itself (not fjs/return/scope). Adapted
    the same way: re-pointed at unreportedTips, renamed, assertions
    preserved verbatim. See Deviations."
  - "iraDeductionDeclared's Decision 5.1 rationale note (HSA-only example not
    reachable this phase, since scheduleOneAdjustments stays refused
    throughout) is recorded per the plan's own instruction, not silently
    dropped."

requirements-completed: [TAX-10]

# Metrics
duration: ~100min
completed: 2026-08-11
---

# Phase 13 Plan 2: Retirement and Social Security Income Wiring Summary

**A 65+ single filer with a real SSA-1099 and two 1099-Rs now computes real, non-placeholder Form 1040 lines 4a/4b, 5a/5b, 6a/6b and 25b through the full `form1040Report` entry point, producing a correct AGI — vertical slice 1 (TAX-10) closed.**

## Performance

- **Duration:** ~100 min (approximate)
- **Completed:** 2026-08-11
- **Tasks:** 3 (all `type="auto"`)
- **Files modified:** 6 (0 new, 6 modified)

## Accomplishments

- `fjs/form1040/core/module.f.js`'s `Form1040Inputs` widened from 5 to 7
  curried parameters (`retirementForms`, `socialSecurityForms`); every one
  of the 37 pre-existing `inputsOf(...)` call sites updated mechanically
  (via a bracket-matching script, then hand-verified against `tsc`), plus 2
  plain-JS demo pages that construct `Form1040Inputs` object literals
  directly.
- Lines 4a/4b (IRA distributions) and 5a/5b (pensions and annuities) now
  read `vnd.fjs.1099r`, routed by each document's own `box7bIraSepSimple`
  checkbox rather than summed uniformly (13-RESEARCH.md Pitfall 4). Line 6a
  reads `vnd.fjs.ssa1099` box 5. Line 6b calls `fjs/tax/ssb`'s
  `socialSecurityBenefitsWorksheet`, fed every other income line its own
  line 3 sums (1z, 2b, 3b, 4b, 5b, 7a, 8) plus the line 2a tax-exempt-
  interest add-back.
- Line 25b now sums `box4FederalIncomeTaxWithheld` across FOUR document
  types — 1099-INT, 1099-R, 1099-DIV, 1099-B — matching
  `federalTaxWithheldOnOther1099`'s own remedy string, which already named
  all three of the latter three.
- `iraDeductionDeclared` (new `option(true)` profile field, Decision 5.1)
  refuses the whole return with a named remedy citing Pub. 590-A Worksheet
  1-1, threaded before line 4a is built, via the error-arm pattern
  (`unmodeled: []`) rather than a `fjs/return/scope` kind.
  `mfsLivedWithSpouseAtAnyTimeInYear` (also new) is gated by `filingStatus`
  at the `fjs/form1040/core` call site so a profile that declares it
  without also being `marriedFilingSeparately` cannot trip `fjs/tax/ssb`'s
  own internal `assert`.
- Task 2's atomic transition: `iraDistributions`, `pensionsAndAnnuities`,
  `socialSecurityBenefits`, `federalTaxWithheldOnOther1099` moved from
  `unmodeledKindRefusals` to `modeledKinds` in one commit. `modeledKinds`
  12 → 16; `unmodeledKindRefusals` 38 → 34; both hand-typed count constants
  bumped in the same change, still summing to the frozen 50.
- All four pre-existing `fjs/return/scope` proof leaves that hard-coded
  `socialSecurityBenefits` as their "still refused" example fixture
  (the message-format pin, the structured-`unmodeled` pin, the
  bare-value-shape pin) re-pointed at `unreportedTips` — never deleted,
  every assertion preserved.
- Task 3's end-to-end proof: a 65+ single filer computes taxable Social
  Security ($25,325.00) and AGI ($65,825.00) through the full
  `form1040Report`, both hand-computed independently of the code under
  test and cross-checked against a direct `socialSecurityBenefitsWorksheet`
  call. A second leaf confirms `iraDeductionDeclared: true` on the same
  kind of profile refuses before the worksheet ever runs.

## Task Commits

1. **Task 1: Wire 1099-R, SSA-1099 and the SSB worksheet into Form 1040 (kinds still refused — inert)** - `65ef9f1` (feat)
2. **Task 2: The atomic transition — reclassify the four kinds, adapt the socialSecurityBenefits proof fixtures** - `89d0fbd` (feat)
3. **Task 3: End-to-end proof — a 65+ return computes a real AGI from retirement and SS income** - `0fdaccf` (test)

## Files Created/Modified

- `fjs/form1040/core/module.f.js` — `Form1040Inputs`/`inputsOf` widened
  5→7; real lines 4a/4b/5a/5b/6a/6b/25b; the `iraDeductionDeclared`
  error-arm guard; retirement/SSA-1099 fixture helpers
  (`retirementDocument`, `socialSecurityDocument`); ~18 new/adapted proof
  leaves across three new sections
  (`retirementAndSocialSecurityBeforeTheScopeReclassificationLands`,
  `wave1RetirementAndSocialSecurity`) plus two in-place adaptations.
- `fjs/return/profile/module.f.js` — `iraDeductionDeclared`,
  `mfsLivedWithSpouseAtAnyTimeInYear` added to `returnProfileSchema`; a new
  `scheduleOneCircularityFields` proof group.
- `fjs/return/scope/module.f.js` — the atomic reclassification;
  `modeledKindsIsExactlySixteen`/`unmodeledRefusalsIsExactlyThirtyFour`
  (renamed from Twelve/ThirtyEight); a new
  `theFourKindsThisPlanReclassifiedAreInScopeTogether` leaf; four leaves
  re-pointed from `socialSecurityBenefits` to `unreportedTips`.
- `demo/lib/fixtures.js` — `inputs`'s `Form1040Inputs` widened with empty
  `retirementForms`/`socialSecurityForms` (Rule 3, blocking `tsc` fix).
- `demo/steps/05-exactness.js` — same widening at its own inline
  `Form1040Inputs` literal (Rule 3).
- `demo/steps/04-refusal.js` — the `offered` toggle list swapped three
  kinds that are no longer `UnmodeledKind` (`pensionsAndAnnuities`,
  `socialSecurityBenefits`, `iraDistributions`) for three that still are
  (`unreportedTips`, `qualifiedBusinessIncomeDeduction`,
  `additionalChildTaxCredit`) — Rule 3, blocking `tsc` fix.

## Decisions Made

- **`retirementForms`/`socialSecurityForms` appended at the END of the
  curried parameter list**, mirroring 12.1-04's own precedent exactly
  (`dividendForms`/`brokerageForms`), so every existing call site needed
  only two trailing `([])` arguments rather than a reordering.
- **`line7a` and `line8`'s local `const` computation moved earlier** in
  `form1040IncomeLines` (ahead of `line6a`/`line6b`), because the SSB
  worksheet's own `otherIncomeLine3Cents` needs their values. The RETURNED
  object and every ordering array (`orderedLines`, `incomeLineFieldNames`)
  are unchanged — printed order is a property of what is returned, not of
  local `const` declaration order.
- **The scope module's docstring gained a new section** ("Slice 1's
  retirement and Social Security boundary, as of Phase 13 Wave 1"),
  mirroring the existing "dividend/capital-gain boundary" precedent,
  stating which four kinds moved and that `iraDeductionDeclared` — not a
  coarse kind — is what still refuses the IRA circularity case.
- **Decision 5.1's HSA-only rationale is not reachable this phase**, since
  `scheduleOneAdjustments` stays refused throughout Wave 1 (recorded per
  the plan's own instruction, in the profile field's own docstring and
  here).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] A fifth pre-existing proof leaf hard-coded `socialSecurityBenefits` as a whole-report refusal fixture, outside the plan's own named four**
- **Found during:** Task 2 (running `npm test` after the reclassification)
- **Issue:** `fjs/form1040/core/module.f.js`'s own
  `socialSecurityBenefitsRefuseTheWholeReportNamingTheLineAndTheDialect`
  leaf (and its control) asserted that declaring `socialSecurityBenefits`
  refuses the WHOLE report through `form1040Report`, and named the
  `vnd.fjs.ssa1099` dialect in the message. The plan's `<interfaces>`
  section named four leaves inside `fjs/return/scope/module.f.js` needing
  this same adaptation but missed this fifth one, one layer up, in the
  wiring module itself.
- **Fix:** Re-pointed at `unreportedTips` (renamed to
  `unreportedTipsRefuseTheWholeReportNamingTheLineAndTheRemedy`), preserving
  the property being proven (`form1040Report` threads a `fjs/return/scope`
  refusal end to end, naming the kind/line/remedy) against a kind that
  stays refused for the rest of this phase. Its control leaf renamed to
  `controlTheSameDeclarationWithoutUnreportedTipsComputes`.
- **Files modified:** `fjs/form1040/core/module.f.js`
- **Verification:** `npm test` green; the leaf's assertions (structured
  `unmodeled`, line/label/remedy substrings) are unchanged in shape, only
  the target kind and its expected strings changed.
- **Committed in:** `89d0fbd` (Task 2 commit)

**2. [Rule 1 - Bug] This plan's own Task-1 "still refuses today" scaffolding leaf needed rewriting once Task 2 landed**
- **Found during:** Task 2, immediately after the reclassification
- **Issue:** Task 1's own acceptance criteria required a leaf proving
  `iraDistributions`/`pensionsAndAnnuities` still refuse at `classifyScope`
  before the wiring is reachable — explicitly described in the plan as
  "inert until Task 2." Once Task 2 landed, that leaf's assertion
  (`kind: 'error'`) became false by design.
- **Fix:** Rewrote the leaf in place —
  `iraDistributionsAndPensionsAndAnnuitiesStillRefuseAtDeclarationUntilReclassified`
  became `iraDistributionsAndPensionsAndAnnuitiesNowComputeThroughTheFullReport`,
  asserting the SAME two kinds now compute real, non-placeholder lines
  4a/4b/5a/5b through `form1040Report`. This mirrors the exact mechanical
  move already narrated in this file's own pre-existing absent-basis leaf
  for an earlier (12.1-04) reclassification — an intentional, planned
  evolution rather than dropped coverage, since the leaf's own name always
  scoped its validity to "until Task 2."
- **Files modified:** `fjs/form1040/core/module.f.js`
- **Verification:** `npm test` green; net proof-leaf count unchanged by
  this specific edit (1-for-1 rewrite).
- **Committed in:** `89d0fbd` (Task 2 commit)

**3. [Rule 3 - Blocking] Two demo pages and one demo fixture module failed `tsc` after `Form1040Inputs` widened**
- **Found during:** Task 1, first `npx tsc --noEmit` after widening
  `Form1040Inputs`
- **Issue:** `demo/lib/fixtures.js`'s exported `inputs` object and
  `demo/steps/05-exactness.js`'s own inline `Form1040Inputs` literal both
  construct the shape directly (not through `inputsOf`), so both were
  missing the two new required fields (`TS2739`). Separately,
  `demo/steps/04-refusal.js`'s `offered` toggle list held three kind
  literals (`pensionsAndAnnuities`, `socialSecurityBenefits`,
  `iraDistributions`) that stopped being assignable to `UnmodeledKind`
  after Task 2's reclassification (`TS2322`).
- **Fix:** Added `retirementForms: []`/`socialSecurityForms: []` to both
  fixture constructions. Swapped the three no-longer-unmodeled kinds in
  `04-refusal.js`'s toggle list for three that remain refused
  (`unreportedTips`, `qualifiedBusinessIncomeDeduction`,
  `additionalChildTaxCredit`), with no other narrative text in that file
  referencing the removed kinds.
- **Files modified:** `demo/lib/fixtures.js`, `demo/steps/05-exactness.js`,
  `demo/steps/04-refusal.js`
- **Verification:** `npx tsc --noEmit` clean.
- **Committed in:** `65ef9f1` (Task 1, the `Form1040Inputs` fixtures) and
  `89d0fbd` (Task 2, the `04-refusal.js` toggle list, discovered only after
  the reclassification landed)

---

**Total deviations:** 4 auto-fixed (2 bug fixes against proof leaves this
plan's own interfaces text did not enumerate, 2 blocking `tsc` fixes)
**Impact on plan:** All four were necessary to keep `npm test` green at the
end of each task's own commit. None represent scope creep or dropped
coverage — deviations 1 and 2 preserve or strengthen the exact property
each adapted leaf proved; deviations 3 keep two demo pages and one shared
demo fixture compiling against the widened production types.

## Issues Encountered

None beyond the deviations above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **TAX-10 is now COMPLETE.** Vertical slice 1 (13-CONTEXT.md Decision 6.1)
  is closed: a 65+ TY2025 return with an SSA-1099 and a 1099-R computes
  real lines 4a/4b, 5a/5b, 6a/6b, 9, 11b and 25b, and a correct AGI, through
  the full `form1040Report` entry point.
- **AGI (1040 line 11b) is now a real, non-placeholder figure whenever the
  underlying documents are present.** Slices 2 (senior deduction), 3
  (itemizing/SALT cap), and 4 (Schedule 8812's CTC/ODC phase-out) all read
  AGI as a pure input — per 13-CONTEXT.md Decision 6.2, this is why Slice 1
  was sequenced first, and it is now safe for those slices to build against
  a real figure rather than a `declaredZero` stand-in.
- **`fjs/tax/ssb`'s Deviation 2 flag from 13-01-SUMMARY.md** (the
  MFS-lived-with-spouse branch's `line16 = line7 × 85%` formula) remains
  unexercised by this plan's own end-to-end fixture (which used `single`
  status for simplicity) — still flagged for Phase 14's acceptance test if
  a real MFS-lived-with-spouse filer's filed return becomes available.
- **`iraDeductionDeclared`'s circularity refusal is proven at two levels**
  (isolated, via `form1040IncomeLines` directly; and end-to-end, via
  `form1040Report`) but not yet exercised by any later slice — Slices 2-5
  should confirm none of their own new wiring accidentally routes around
  this guard.
- Project-local proof count: 677 (Plan 13-01's ending count) → 686 (Task 1)
  → 687 (Task 2) → 689 (Task 3).

---
*Phase: 13-the-65-profile-and-the-remaining-schedules*
*Completed: 2026-08-11*

## Self-Check: PASSED

- FOUND: `fjs/form1040/core/module.f.js`
- FOUND: `fjs/return/profile/module.f.js`
- FOUND: `fjs/return/scope/module.f.js`
- FOUND: `demo/lib/fixtures.js`
- FOUND: `demo/steps/04-refusal.js`
- FOUND: `demo/steps/05-exactness.js`
- FOUND commit: `65ef9f1` (Task 1)
- FOUND commit: `89d0fbd` (Task 2)
- FOUND commit: `0fdaccf` (Task 3)
- `npx tsc --noEmit`: clean
- `npm test`: 2927 pass, 0 fail
- Project-local proof count: 677 (13-01 baseline) → 686 (Task 1) → 687 (Task 2) → 689 (Task 3)
- `grep -rn "magi" fjs/`: empty
- `modeledKinds.length === 16`, `unmodeledKindRefusals.length === 34`, sum `50`
