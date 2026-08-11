---
phase: 13-the-65-profile-and-the-remaining-schedules
plan: 04
subsystem: tax-engine

tags: [schedule-1a, senior-deduction, form1040, scope-reclassification, functionalscript]

# Dependency graph
requires:
  - phase: 13-03-the-senior-deduction-parameters-and-schedule-1a
    provides: "fjs/schedule/1a's scheduleOneA (Parts I/V/VI), standalone,
      not yet wired into Form 1040 -- the module this plan wires in"
provides:
  - "fjs/form1040/core: 1040 line 13b reads Schedule 1-A's real Part VI
      total (scheduleOneA(taxParamSet)({ status, agiCents: line11b.value,
      taxpayerHasValidSsnAndBornBefore1961Jan2, spouseHasValidSsnAnd... }))
      unconditionally, off AGI and the existing age boxes -- no new
      typedef/orderedLines/count-constant change needed, since line13b
      already existed in all six fjs/form1040/core structures as a
      declaredZero placeholder"
  - "fjs/return/scope: seniorAndOtherScheduleOneADeductions moved from
      unmodeledKindRefusals to modeledKinds -- modeledKinds 16 -> 17,
      unmodeledKindRefusals 34 -> 33, sum still 50"
  - "An end-to-end proof that a real 65+ single filer's line13b is a real,
      non-zero Schedule 1-A figure through form1040Report, and an MFS
      filer's line13b is $0 -- TAX-09 and vertical slice 2 are CLOSED"
affects: [13-05-through-13-12-remaining-slices, 13-13-prose-corrections]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Wire unconditionally, gate the WHOLE-RETURN refusal on declaredKinds
        elsewhere -- line13b reads AGI and the age boxes regardless of
        whether seniorAndOtherScheduleOneADeductions is declared, exactly
        like lines 3a/3b and the retirement lines Plan 13-02 wired; the
        declared-kind partition governs only whether the WHOLE return
        computes or refuses, never an individual already-computable line"
    - "Adapt-in-place across a two-commit atomic transition, applied a
        third time: a proof leaf written in Task 1 to assert 'still
        refuses today' is REWRITTEN, not deleted, in Task 2's own commit
        once the kind it names is reclassified -- the same mechanical
        move Plan 13-02 already narrates for an earlier reclassification"
    - "A two-kind, form-order fixture RE-POINTED at a pair proven to
        survive the rest of the phase (householdEmployeeWages +
        unreportedTips, both named in Decision 1.4 as staying refused
        through Wave 5), rather than merely at any two still-refused
        kinds, so the fixture does not need re-pointing again next wave"

key-files:
  created: []
  modified: [fjs/form1040/core/module.f.js, fjs/return/scope/module.f.js]

key-decisions:
  - "scheduleOneA's actual return shape is { partI, partV, partVI }, not
      the flat { line1, line2a...line38 } record this plan's own
      <interfaces> text sketched -- line13b reads
      scheduleOneAResult.partVI.line38, and the call also passes
      `profile: Stored<ReturnProfile>` (a required ScheduleOneAInput
      field the plan's own four-field list omitted, per 13-03-SUMMARY.md's
      own Deviation 2), since Part VI's documented-zero lines need it to
      cite declaredKinds."
  - "A pre-existing fixture (marriedFilingJointly, both spouses' age boxes
      checked, $60,000 AGI) legitimately gained a real $12,000.00 combined
      senior deduction it did not have before wiring landed -- its
      hand-typed expected figures (line12e/13b/14/15/16/37) were
      RE-DERIVED against the new, correct arithmetic and cross-checked
      independently via a direct baseTaxForAmount(...) call, never
      assumed. Taxable income moved from $25,300.00 (the old placeholder-
      zero figure) to $13,300.00; tax from $2,562.00 to $1,333.00."
  - "A second pre-existing leaf outside this plan's own named
      <interfaces> list (fjs/form1040/core's
      theSixtyFivePlusProfileRefusesTheWholeReportNamingBothUnmodeledKinds)
      also hard-coded seniorAndOtherScheduleOneADeductions as half of a
      two-kind refusal fixture -- adapted in place (renamed, narrowed to
      the ONE remaining unmodeled kind, childTaxCreditOrOtherDependents),
      mirroring 13-02-SUMMARY.md's own Deviation 1 precedent of finding a
      fifth affected leaf beyond the plan's own enumerated set."

requirements-completed: [TAX-09]

# Metrics
duration: ~25min
completed: 2026-08-11
---

# Phase 13 Plan 4: Wire Schedule 1-A into Form 1040 Line 13b Summary

**A 65+ single filer's 1040 line 13b now computes a real, non-placeholder Schedule 1-A senior-deduction figure through the full `form1040Report` entry point -- closing TAX-09 and vertical slice 2.**

## Performance

- **Duration:** ~25 min (approximate, git-timestamp-based)
- **Completed:** 2026-08-11
- **Tasks:** 3 (all `type="auto"`)
- **Files modified:** 2 (0 new, 2 modified)

## Accomplishments

- `fjs/form1040/core/module.f.js`'s line13b now calls `scheduleOneA(taxParamSet)(...)`
  with `agiCents: line11b.value` and the two existing age boxes
  (`taxpayerBornBeforeJan2_1961`/`spouseBornBeforeJan2_1961`, already read
  by line 12e), reading `scheduleOneAResult.partVI.line38` unconditionally
  — the same "read the facts, gate the whole-return refusal on
  `declaredKinds` elsewhere" discipline lines 3a/3b and Plan 13-02's
  retirement lines already established. Line13b was already an existing
  field across all six `fjs/form1040/core` parallel structures (typedef,
  returned object, `orderedLines`, `incomeLineFieldNames`, both count
  constants), so none of those five needed touching — only its
  computation changed, from `declaredZero` to a real `ReportLine`.
- `fjs/return/scope/module.f.js`'s atomic transition:
  `seniorAndOtherScheduleOneADeductions` moved from `unmodeledKindRefusals`
  to `modeledKinds` in one commit. `modeledKinds` 16 → 17;
  `unmodeledKindRefusals` 34 → 33; both hand-typed count constants bumped
  in the same change, still summing to the frozen 50.
- The pre-existing two-kind "65+ profile" proof fixture
  (`theSixtyFivePlusProfileRefusesNamingBothUnmodeledKinds`,
  `controlTheSixtyFivePlusProfileWithoutThoseTwoKindsIsInScope`,
  `unmodeledFollowsFormOrderNotDeclarationOrder`) re-pointed, never
  deleted, at `householdEmployeeWages` (1040 line 1b) + `unreportedTips`
  (1040 line 1c) — a pair proven to stay refused for the rest of this
  phase (Decision 1.4), preserving the exact two-kind, 1040-form-order
  property the original fixture proved. Renamed
  `theSixtyFivePlusProfileRefusesNamingBothUnmodeledKinds` to
  `twoUnmodeledKindsRefuseNamingBothInFormOrder` since it no longer
  narrates the 65+ profile's own specific gaps.
- End-to-end proof (Task 3): a single 65+ filer at $100,000.00 AGI
  computes `line13b.value === 450000n` ($4,500.00, well into the 6%
  phase-out) through the full `form1040Report` entry point, cross-checked
  independently against a direct `scheduleOneA(...)` call, with `line15`
  exactly $4,500.00 lower than it would be at `line13b = $0`. An MFS 65+
  filer at the identical $100,000.00 AGI computes `line13b.value === 0n`
  unconditionally — Decision 5.4's short-circuit proven surviving the
  wiring step at the whole-report level, not merely inside
  `fjs/schedule/1a`'s own standalone proof.

## Task Commits

1. **Task 1: Wire line 13b (kind still refused — inert)** - `cca1c1d` (feat)
2. **Task 2: The atomic transition — reclassify seniorAndOtherScheduleOneADeductions, adapt the two-kind proof fixture** - `9ec4a4e` (feat)
3. **Task 3: End-to-end proof — a 65+ return's line 13b moves, and MFS stays at $0** - `a1fd1ed` (test)

## Files Created/Modified

- `fjs/form1040/core/module.f.js` — line13b's real computation; new
  `scheduleOneA` import; `seniorDeductionBeforeTheScopeReclassificationLands`
  proof section (Task 1, later adapted for Task 2); `wave2SeniorDeduction`
  proof section (Task 3, the end-to-end proof); re-derived
  `controlTheSixtyFivePlusProfileWithoutThoseTwoKindsComputesLinesOneAToThirtySeven`
  against the new correct arithmetic; renamed and narrowed
  `theSixtyFivePlusProfileRefusesTheWholeReportNamingBothUnmodeledKinds`
  to `theSixtyFivePlusProfileNowRefusesNamingOnlyTheRemainingUnmodeledKind`;
  new `baseTaxForAmount` import for an independent cross-check.
- `fjs/return/scope/module.f.js` — the atomic reclassification;
  `modeledKindsIsExactlySeventeen`/`unmodeledRefusalsIsExactlyThirtyThree`
  (renamed from Sixteen/ThirtyFour); `allSeventeenModeledKindsDeclaredTogetherAreInScope`
  (renamed, extended); new `seniorAndOtherScheduleOneADeductionsIsInScopeAlone`
  leaf; three leaves re-pointed from the `seniorAndOtherScheduleOneADeductions`/
  `childTaxCreditOrOtherDependents` pair to `householdEmployeeWages`/`unreportedTips`;
  new "Slice 2's senior-deduction boundary" docstring section.

## Decisions Made

- **`scheduleOneA`'s actual return shape** (`{ partI, partV, partVI }`)
  differs from this plan's own `<interfaces>` sketch (a flat
  `{ line1, ..., line38 }` record) — read from `fjs/schedule/1a/module.f.js`
  directly rather than assumed; line13b reads
  `scheduleOneAResult.partVI.line38`, and the call also passes the
  required `profile: Stored<ReturnProfile>` field the plan's own
  four-field list omitted (13-03-SUMMARY.md's own Deviation 2 already
  flagged this gap).
- **Line13b's wiring is unconditional**, not gated on
  `declaredKinds.includes('seniorAndOtherScheduleOneADeductions')` — the
  same design Plan 13-02 already established for lines 3a/3b/4a-6b: a
  MODELED line reports what the facts say (AGI plus the age boxes), and
  `declaredKinds` governs only whether the WHOLE return computes or
  refuses for a kind this engine cannot yet compute, never an individual
  already-computable line's own value.
- **TAX-09 is now marked COMPLETE** — vertical slice 2 closes here,
  mirroring slice 1's (TAX-10, Plan 13-02) precedent exactly.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `scheduleOneA`'s actual return shape is `{ partI, partV, partVI }`, not the flat record this plan's `<interfaces>` sketched**
- **Found during:** Task 1 (reading `fjs/schedule/1a/module.f.js` before wiring)
- **Issue:** This plan's own `<interfaces>` section described
  `scheduleOneA(...)` as returning `{ line1, line2a..line2e, line3, line13,
  line21, line30, line31..line37, line38 }`. The actual 13-03-shipped
  export returns `{ partI, partV, partVI }`, each a nested result record.
  `result.line38` does not exist on that shape.
- **Fix:** Read `scheduleOneAResult.partVI.line38` instead, and included
  the required `profile: Stored<ReturnProfile>` input field
  (`ScheduleOneAInput`'s actual shape, per 13-03-SUMMARY.md's own
  Deviation 2) that the plan's four-field call sketch omitted.
- **Files modified:** `fjs/form1040/core/module.f.js`
- **Verification:** `npx tsc --noEmit` clean; Task 1's own acceptance
  fixture (`line13b.value === 570000n` at $80,000 AGI) passes.
- **Committed in:** `cca1c1d` (Task 1)

**2. [Rule 1 - Bug] A pre-existing fixture's hand-typed figures pre-dated Schedule 1-A's wiring and went stale the instant it landed**
- **Found during:** Task 1, first `node --test` after wiring line13b
- **Issue:** `fjs/form1040/core/module.f.js`'s own
  `controlTheSixtyFivePlusProfileWithoutThoseTwoKindsComputesLinesOneAToThirtySeven`
  used a married-filing-jointly profile with BOTH spouses' age boxes
  checked at $60,000.00 AGI. Because line13b now reads Schedule 1-A
  unconditionally off the age boxes, this profile legitimately gained a
  real $12,000.00 combined senior deduction (both spouses qualify, well
  under the $150,000.00 MFJ phase-out start) it never had while line13b
  was a placeholder zero — the fixture's hand-typed expected taxable
  income ($25,300.00, the pre-Schedule-1-A figure) and tax ($2,562.00)
  went stale, not wrong: this is the WIRING working correctly on a
  fixture built before it existed.
- **Fix:** Re-derived every affected figure by hand against the real
  Schedule 1-A arithmetic (line12e $34,700.00 + line13b $12,000.00 =
  line14 $46,700.00; line15 = $13,300.00; line16/37 = $1,333.00 via the
  Tax Table), independently cross-checked with a direct
  `baseTaxForAmount(taxParams2025)('marriedFilingJointly')(1330000n)`
  call (never re-derived from `form1040Report`'s own output).
- **Files modified:** `fjs/form1040/core/module.f.js`
- **Verification:** `node --test` green; the cross-check leaf's own
  independent `baseTaxForAmount` call reaches the identical `133300n`.
- **Committed in:** `cca1c1d` (Task 1)

**3. [Rule 1 - Bug] A second pre-existing leaf outside this plan's own named `<interfaces>` list hard-coded the same two-kind pairing**
- **Found during:** Task 2, running `node --test` after the reclassification
- **Issue:** `fjs/form1040/core/module.f.js`'s own
  `theSixtyFivePlusProfileRefusesTheWholeReportNamingBothUnmodeledKinds`
  leaf (and its `theErrorArmCarriesNoLinesFieldAtAll` neighbor's `error`
  half) declared the SAME `sixtyFivePlusProfile` fixture — `wages`,
  `taxableInterest`, `seniorAndOtherScheduleOneADeductions`,
  `childTaxCreditOrOtherDependents` — asserting a refusal naming BOTH
  kinds. This plan's own `<interfaces>` section named only the three
  `fjs/return/scope` leaves needing adaptation and missed this one, one
  layer up, in the wiring module itself — the same class of gap
  13-02-SUMMARY.md's own Deviation 1 found a plan wave earlier.
- **Fix:** Renamed to
  `theSixtyFivePlusProfileNowRefusesNamingOnlyTheRemainingUnmodeledKind`,
  preserving the property being proven (`form1040Report` still refuses
  this profile end to end, naming the line/label/remedy) but narrowed to
  the ONE kind that still refuses (`childTaxCreditOrOtherDependents`,
  Schedule 8812, a later wave), with an added negative assertion that
  `1040 line 13b` is no longer named. `theErrorArmCarriesNoLinesFieldAtAll`
  needed no change — it only asserts the SHAPE of the error arm
  (`!Object.hasOwn(refused, 'lines')`), not which kind caused it.
- **Files modified:** `fjs/form1040/core/module.f.js`
- **Verification:** `node --test` green; the leaf's assertions (structured
  `unmodeled`, line/label/remedy substrings, the new negative check) are
  unchanged in shape, only the target kind count and its expected strings
  changed.
- **Committed in:** `9ec4a4e` (Task 2)

**4. [Rule 1 - Bug] Task 1's own "still refuses today" scaffolding leaf needed rewriting once Task 2 landed**
- **Found during:** Task 2, immediately after the reclassification
- **Issue:** Task 1's own acceptance criteria required a leaf proving
  `seniorAndOtherScheduleOneADeductions` still refuses at `classifyScope`
  before the wiring is reachable — explicitly described as "inert until
  Task 2." Once Task 2 landed, that leaf's `kind === 'error'` assertion
  became false by design (the exact mechanism this plan's own critical
  constraint 2 predicted).
- **Fix:** Rewrote the leaf in place —
  `declaringSeniorAndOtherScheduleOneADeductionsStillRefusesBeforeTask2Lands`
  became `declaringSeniorAndOtherScheduleOneADeductionsNowComputesThroughTheFullReport`,
  asserting the SAME declared profile now computes a real line13b through
  `form1040Report`. Mirrors 13-02-SUMMARY.md's own identical rewrite of
  its `iraDistributionsAndPensionsAndAnnuitiesStillRefuseAtDeclarationUntilReclassified`
  leaf one plan earlier.
- **Files modified:** `fjs/form1040/core/module.f.js`
- **Verification:** `node --test` green; net proof-leaf count unchanged
  by this specific edit (1-for-1 rewrite).
- **Committed in:** `9ec4a4e` (Task 2)

---

**Total deviations:** 4 auto-fixed (1 bug fix against the plan's own
literal interface sketch, 3 adaptations of proof fixtures the wiring/
reclassification legitimately made stale — none represent a defect in
the shipped arithmetic, and none were silently dropped)
**Impact on plan:** All four were necessary to keep `npm test` green at
the end of each task's own commit and to keep every adapted leaf's
original property intact. None represent scope creep.

## Issues Encountered

None beyond the deviations above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **TAX-09 is now COMPLETE.** Vertical slice 2 (13-CONTEXT.md Decision 6.1)
  is closed: a 65+ TY2025 return's line 13b is a real Schedule 1-A figure,
  not a `declaredZero` placeholder, through the full `form1040Report`
  entry point.
- **Slices 3 and 4 (Schedule A/itemizing, Schedule 8812/dependents) are
  mutually independent of this slice and of each other**, per Decision
  6.2 — both may proceed in either order once Slice 1's AGI is in place,
  which it already is (Plan 13-02).
- **`sixtyFivePlusProfile`'s own remaining gap is now exactly ONE kind**
  (`childTaxCreditOrOtherDependents`, Schedule 8812's CTC/ODC, 1040 line
  19) — Slice 4 (Plan 13-08 or similar) is what finally lets this
  specific declared profile compute end to end without any refusal.
- **The two-kind, form-order proof fixture in `fjs/return/scope`** now
  rests on `householdEmployeeWages`/`unreportedTips`, both explicitly
  named in Decision 1.4 as staying refused through the REST of this
  phase (Wave 5) — it should not need re-pointing again before then.
- Project-local proof count: 712 (13-03's ending count) → 714 (Task 1) →
  716 (Task 2) → 718 (Task 3).

---
*Phase: 13-the-65-profile-and-the-remaining-schedules*
*Completed: 2026-08-11*

## Self-Check: PASSED

- FOUND: `fjs/form1040/core/module.f.js`
- FOUND: `fjs/return/scope/module.f.js`
- FOUND commit: `cca1c1d` (Task 1)
- FOUND commit: `9ec4a4e` (Task 2)
- FOUND commit: `a1fd1ed` (Task 3)
- `npx tsc --noEmit`: clean
- `npm test`: 2956 pass, 0 fail
- Project-local proof count: 712 (13-03 baseline) → 714 (Task 1) → 716 (Task 2) → 718 (Task 3)
- `grep -rn "magi" fjs/`: empty
- `fjs/tax/boundary`'s `expectedThresholdCount === 58` (unchanged, this plan does not touch it)
- `modeledKinds.length === 17`, `unmodeledKindRefusals.length === 33`, sum `50`
