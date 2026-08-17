---
phase: 13-the-65-profile-and-the-remaining-schedules
plan: 10
subsystem: tax-engine
tags: [form1040, schedule-8812, child-tax-credit, actc, scope-reclassification, functionalscript]

# Dependency graph
requires:
  - phase: 13-the-65-profile-and-the-remaining-schedules
    provides: "13-09's fjs/form8812 (Schedule 8812 Part I's CTC/ODC and Part II-A's ACTC, one function execution), standalone, not yet wired into Form 1040 -- the module this plan wires in"
provides:
  - "fjs/form1040/core: 1040 lines 19 and 28 read fjs/form8812's real output (form8812(taxParamSet)({ status, agiCents: income.line11b.value, dependents: profile.value.dependents normalized, line18Cents: line18.value, earnedIncomeCents, nontaxableCombatPayCents: 0n })) unconditionally, off AGI/line18/the profile's dependents array/earnedIncome -- Part II-B's 3+-qualifying-children refusal threaded as the THIRD document-data-sufficiency error-arm guard in this file"
  - "fjs/return/scope: childTaxCreditOrOtherDependents and additionalChildTaxCredit moved from unmodeledKindRefusals to modeledKinds -- modeledKinds 18 -> 20, unmodeledKindRefusals 32 -> 30, sum still 50"
  - "An end-to-end proof that a return with declared dependents (one qualifying child, one other dependent) computes a real, non-zero line 19 AND line 28 through form1040Report, proving the CTC/ODC split and the ACTC arithmetic together, plus the stepped phase-out cliff visible at the whole-report level -- TAX-12 and vertical slice 4 are CLOSED"
affects: [13-11, 13-12, 13-13]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Wire unconditionally, gate the WHOLE-RETURN refusal on declaredKinds elsewhere -- lines 19/28 read AGI, line18, the profile's dependents array and earnedIncome regardless of whether childTaxCreditOrOtherDependents/additionalChildTaxCredit are declared, exactly like every prior wave's wiring; the declared-kind partition governs only whether the WHOLE return computes or refuses, never an individual already-computable line"
    - "Part II-B's refusal threaded as the THIRD document-data-sufficiency early-return guard in fjs/form1040/core (after Schedule D's absent-basis guard and iraDeductionDeclared), unmodeled: [] since it names no fjs/return/scope kind"
    - "Adapt-in-place across a two-commit atomic transition, applied a fourth time: proof leaves written to assert 'still refuses today' are REWRITTEN, not deleted, once the kind is reclassified -- including a leaf whose own fixture (sixtyFivePlusProfile) is the profile the WHOLE PHASE was written for, now rewritten to prove it computes end to end"
    - "A single kind's two lines (19 and 28) are BOTH credit/payment lines, not income lines -- childTaxCreditOrOtherDependents sits between seniorAndOtherScheduleOneADeductions and federalTaxWithheldOnW2 in kindVocabulary order (1040 line 19 prints before line 25a), and additionalChildTaxCredit sits after estimatedTaxPayments (1040 line 28 prints after line 26) -- modeledKinds ordering follows the form face exactly, not a single contiguous insertion point"

key-files:
  created: []
  modified: [fjs/form1040/core/module.f.js, fjs/return/scope/module.f.js, demo/steps/04-refusal.js]

key-decisions:
  - "dependents is read off profile.value.dependents (?? []), normalized from option(true) booleans to definite ones the same way fjs/schedule/b normalizes hadForeignFinancialAccount -- fjs/form8812's own docstring names this as the expected caller-side normalization"
  - "line19/line28 are computed from ONE form8812(...) call, sharing form8812Outcome across both lines' const declarations rather than calling form8812 twice -- Decision 4.3's own point (line 28 must never be independently stale on Part I's state)"
  - "sixtyFivePlusProfile -- the fixture this whole phase's ROADMAP.md was written for -- is rewritten in place (not deleted) to assert it now computes lines 1a-37 end to end, byte-identical to declaring none of its own kinds, since ALL FOUR of its declared kinds are modeled as of this plan"
  - "sixtyFivePlusProfile carries dependentCount: 2 but no per-dependent dependents array (it pre-dates 13-08's per-dependent detail), so its own line 19/28 are legitimately $0.00 through form8812's STOP arm -- Task 3's wave4Dependents fixtures are where a profile WITH real per-dependent facts gets a real, non-zero credit"
  - "theErrorArmCarriesNoLinesFieldAtAll re-pointed its refusing half from sixtyFivePlusProfile (no longer refuses) to unreportedTips (Decision 1.4, stays refused for the rest of the phase) -- the PROPERTY proven (the error arm carries no lines key at all) is unchanged, only the fixture is"
  - "demo/steps/04-refusal.js's toggle list swapped the two newly-modeled kinds for two of Decision 1.4's permanently-refused five (medicaidWaiverPayments, otherEarnedIncome) rather than any two currently-refused kinds, so the toggle list never needs re-pointing again this phase"

requirements-completed: [TAX-12]

# Metrics
duration: ~11min
completed: 2026-08-10
---

# Phase 13 Plan 10: Wire Schedule 8812 into Form 1040 Lines 19 and 28 Summary

**A return with declared dependents now computes a real, non-zero Child Tax Credit/Credit for Other Dependents (1040 line 19) and Additional Child Tax Credit (line 28) through the full `form1040Report` entry point -- proven for the CTC/ODC classification split, the ACTC's own earned-income arithmetic, and the stepped $50.00 phase-out cliff all at the whole-report level -- closing TAX-12 and Phase 13's fourth and final vertical slice.**

## Performance

- **Duration:** ~11 min (approximate, git-timestamp-based)
- **Completed:** 2026-08-10
- **Tasks:** 3 (all `type="auto"`)
- **Files modified:** 3 (0 new, 3 modified)

## Accomplishments

- `fjs/form1040/core/module.f.js`'s `form1040TaxAndPaymentLines` now calls
  `form8812(taxParamSet)(...)` once, right after line 18 is computed, feeding
  it `agiCents: income.line11b.value`, `dependents:
  (profile.value.dependents ?? []).map(...)` (normalized from `option(true)`
  booleans to definite ones), `line18Cents: line18.value`,
  `earnedIncomeCents` (off `profile.value.earnedIncome`), and
  `nontaxableCombatPayCents: 0n`. Line 19 reads `form8812Outcome.line14`;
  line 28 reads `form8812Outcome.line27` from the SAME call — Decision 4.3's
  own point, that line 28 must never be independently stale on Part I's
  state.
- Part II-B's refusal (3+ qualifying children or Puerto Rico residents,
  `line16b >= $5,100`) is threaded as the THIRD document-data-sufficiency
  early-return guard in this file — after Schedule D's absent-basis guard
  and Wave 1's `iraDeductionDeclared` guard — returning `{ kind: 'error',
  message: form8812Outcome.message, unmodeled: [] }`, never a
  `fjs/return/scope` kind.
- `fjs/return/scope/module.f.js`'s atomic transition:
  `childTaxCreditOrOtherDependents` and `additionalChildTaxCredit` moved
  from `unmodeledKindRefusals` to `modeledKinds` in one commit, in
  `kindVocabulary` order — `childTaxCreditOrOtherDependents` (1040 line 19)
  sits BEFORE `federalTaxWithheldOnW2` (25a), and `additionalChildTaxCredit`
  (line 28) sits AFTER `estimatedTaxPayments` (26), matching the printed
  form's own line order rather than a single contiguous insertion point.
  `modeledKinds` 18 → 20; `unmodeledKindRefusals` 32 → 30; both hand-typed
  count constants bumped, still summing to the frozen 50.
- A full-file grep across `fjs/return/scope/module.f.js` confirmed no
  hand-typed proof leaf there used either kind as a "still refused" example
  fixture (matching this plan's own `<interfaces>` prediction — Plan 13-04
  deliberately avoided reusing these two kinds when it re-pointed).
  `fjs/form1040/core/module.f.js` DID carry three such leaves, all adapted
  in place — see Deviations.
- Task 3's end-to-end proof (`wave4Dependents`): a single filer with one
  qualifying child (age 10, valid SSN, $2,200.00 CTC) and one other
  dependent (age 20, $500.00 ODC) computes `line19.value === 42800n`
  ($428.00, capped by this return's own tax liability) and
  `line28.value === 170000n` ($1,700.00, ACTC capped by the one qualifying
  child's own $1,700.00 cap), with `earnedIncome` declared so line19/20's
  own 15%-of-excess-over-$2,500 arithmetic is exercised too — both figures
  hand-computed and cross-checked independently against a direct
  `form8812(...)` call and against `baseTaxForAmount(...)` for the tax
  liability itself. A second leaf proves the stepped phase-out cliff at the
  WHOLE-REPORT level: a married-filing-jointly filer with one qualifying
  child computes `line19` exactly $50.00 lower at AGI $400,000.01 than at
  $400,000.00.
- Project-local proof count rose from **806 (13-09's ending count) to 813**
  — 7 new leaves (3 in Task 1, 2 in Task 2, 2 in Task 3, all in
  `fjs/form1040/core`).
- `npm test` (`tsc && node --test`): 3051 passing, 0 failing.
- `grep -rn "magi" fjs/`: empty. `expectedThresholdCount === 70` (unchanged
  — 13-09 made the last inventory change).

## Task Commits

Each task was committed atomically:

1. **Task 1: Wire lines 19 and 28 (kinds still refused — inert)** - `6becc96` (feat)
2. **Task 2: The atomic transition — reclassify both kinds, verify no proof fixture still depends on either** - `f0b3b06` (feat)
3. **Task 3: End-to-end proof — a return with dependents gets its CTC and ACTC** - `93e31d9` (test)

**Plan metadata:** (this commit, following this SUMMARY)

## Files Created/Modified

- `fjs/form1040/core/module.f.js` — `form8812` import; the Schedule 8812
  wiring inside `form1040TaxAndPaymentLines` (lines 19/28, the Part II-B
  error-arm guard); `dependentsBeforeTheScopeReclassificationLands` proof
  section (Task 1, later adapted for Task 2); `wave4Dependents` proof
  section (Task 3, the end-to-end proof); `theSixtyFivePlusProfileNowRefusesNamingOnlyTheRemainingUnmodeledKind`
  renamed to `theSixtyFivePlusProfileNowComputesEndToEndClosingThePhase` and
  rewritten to assert the flagship 65+ profile now computes end to end;
  `theErrorArmCarriesNoLinesFieldAtAll` re-pointed from `sixtyFivePlusProfile`
  to `unreportedTips`/`singleProfile`.
- `fjs/return/scope/module.f.js` — the atomic reclassification;
  `modeledKindsIsExactlyTwenty`/`unmodeledRefusalsIsExactlyThirty` (renamed
  from Eighteen/ThirtyTwo); `allTwentyModeledKindsDeclaredTogetherAreInScope`
  (renamed, extended); new `theTwoKindsThisPlanReclassifiedAreInScopeTogether`
  leaf; new "Slice 4's dependents boundary" docstring section.
- `demo/steps/04-refusal.js` — the refusal-toggle list swapped
  `additionalChildTaxCredit`/`childTaxCreditOrOtherDependents` (no longer
  unmodeled) for `medicaidWaiverPayments`/`otherEarnedIncome`, two of
  Decision 1.4's permanently-refused five (Rule 3, blocking `tsc` fix).

## Decisions Made

See `key-decisions` in frontmatter above.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Three pre-existing proof leaves in `fjs/form1040/core`, outside this plan's own named `<interfaces>` list, depended on the old refusal**
- **Found during:** Task 2, running `npm test` after the reclassification
- **Issue:** This plan's `<interfaces>` text predicted only `fjs/return/scope` needed a full-file check, since Plan 13-04 had deliberately re-pointed its own two-kind fixture away from `childTaxCreditOrOtherDependents`. It did not name three leaves in `fjs/form1040/core` that still depended on the old refusal: `theSixtyFivePlusProfileNowRefusesNamingOnlyTheRemainingUnmodeledKind` (the fixture the WHOLE PHASE was written for — `sixtyFivePlusProfile`, declaring `seniorAndOtherScheduleOneADeductions` + `childTaxCreditOrOtherDependents`, both now modeled), `theErrorArmCarriesNoLinesFieldAtAll` (used `sixtyFivePlusProfile` as its refusing example), and this plan's own Task 1 scaffolding leaf (explicitly named "inert until Task 2" in its own text).
- **Fix:** All three rewritten in place, never deleted. `theSixtyFivePlusProfileNowRefusesNamingOnlyTheRemainingUnmodeledKind` → `theSixtyFivePlusProfileNowComputesEndToEndClosingThePhase`, asserting the flagship profile now computes byte-identically to its own control (declaring none of its kinds) — the closing moment 13-04-SUMMARY.md's own "Next Phase Readiness" section predicted. `theErrorArmCarriesNoLinesFieldAtAll` re-pointed its refusing half to `unreportedTips` (Decision 1.4, stays refused) and its computing half to `singleProfile`, preserving the exact structural property being proven (`Object.hasOwn(refused, 'lines')` is false; `Object.hasOwn(computed, 'lines')` is true). The Task 1 scaffolding leaf renamed from `...StillRefusesBeforeTask2Lands` to `...NowComputesThroughTheFullReport`, asserting the same fixture's `line19` is now `$4,400.00` — mirroring Plan 13-02's and 13-04's own identical mechanical adaptation one reclassification earlier.
- **Files modified:** `fjs/form1040/core/module.f.js`
- **Verification:** `npm test` green; the property each adapted leaf proves is unchanged, only the target fixture and expected outcome (refuse → compute) changed.
- **Committed in:** `f0b3b06` (Task 2)

**2. [Rule 1 - Bug] `assertEq` is reference (`===`) equality, not deep equality — a fresh array-to-array comparison in Task 2's new leaf never passes**
- **Found during:** Task 2, first `node --test` after writing `theSixtyFivePlusProfileNowComputesEndToEndClosingThePhase`'s own cross-check against its control
- **Issue:** The leaf compared `outcome.lines.map(line => line.value)` against `controlOutcome.lines.map(line => line.value)` via `assertEq` — two freshly-built arrays with identical `bigint` contents, but `assertEq` is `a === b`, so two distinct array instances never compare equal regardless of contents.
- **Fix:** Joined each array into a single string (`.join(',')`) before comparing, since `assertEq` on primitives (strings) does compare by value, and `bigint`s are not `JSON.stringify`-able either.
- **Files modified:** `fjs/form1040/core/module.f.js`
- **Verification:** `npm test` green; the leaf now correctly asserts the two reports are figure-for-figure identical.
- **Committed in:** `f0b3b06` (Task 2)

**3. [Rule 3 - Blocking] `demo/steps/04-refusal.js`'s toggle list failed `tsc` after the reclassification**
- **Found during:** Task 2, first `npx tsc --noEmit` after the reclassification
- **Issue:** `offered`'s array literal held `additionalChildTaxCredit`/`childTaxCreditOrOtherDependents`, both typed `readonly UnmodeledKind[]` — no longer assignable after the reclassification (`TS2322`), the same mechanism Plans 13-02/13-04/13-07's own Deviations already documented for their own reclassifications.
- **Fix:** Swapped both for `medicaidWaiverPayments`/`otherEarnedIncome`, two of Decision 1.4's five kinds that stay refused for the REST of the phase (not merely the rest of this plan), so this toggle list should not need re-pointing again.
- **Files modified:** `demo/steps/04-refusal.js`
- **Verification:** `npx tsc --noEmit` clean.
- **Committed in:** `f0b3b06` (Task 2)

---

**Total deviations:** 3 auto-fixed (1 bug fix covering three proof leaves the plan's own interfaces text did not enumerate, 1 bug fix in a newly-written cross-check assertion, 1 blocking `tsc` fix)
**Impact on plan:** All three were necessary to keep `npm test`/`tsc` green at the end of each task's own commit and to keep every adapted leaf's original property intact. None represent scope creep or dropped coverage.

## Mutation Verification

Per AGENTS.md's "a proof is not known to work until you have watched it fail" discipline, three targeted mutations were run and reverted (verified clean via `diff` against a backup before each commit):

1. **Line 19/28's own value source, swapped** — changing line 19's `value:
   form8812Outcome.line14` to `form8812Outcome.line27` reddened exactly the
   four leaves that assert a specific `line19`/`line28` figure
   (`twoQualifyingChildrenComputeARealNonZeroLineNineteen`,
   `declaringChildTaxCreditOrOtherDependentsNowComputesThroughTheFullReport`,
   both `wave4Dependents` leaves) and no other leaf.
2. **The Part II-B error-arm guard, disabled** — attempted `if (false &&
   form8812Outcome.kind === 'error')`. **This mutation did NOT compile**
   (`TS7027` unreachable code, `TS2339` on the narrowed union in both
   branches) — an informative failure in its own right, per AGENTS.md's "the
   mutation that deletes the last use of a binding does not compile"
   caution, one level over (here, a `false &&` guard prevents `tsc`'s
   control-flow narrowing rather than orphaning a binding). Not re-run in an
   equivalent compiling form, since the guard's own positive coverage (the
   3-qualifying-children fixture reaching `kind: 'error'` naming "Part
   II-B") already required this exact `if` to exist and fire during Task 1's
   own development.
3. **`earnedIncomeCents`, hard-coded to zero** — dropping the
   `profile.value.earnedIncome === undefined ? 0n :
   centsFromString(profile.value.earnedIncome)` ternary in favor of a bare
   `0n` reddened exactly `oneQualifyingChildAndOneOtherDependentComputeRealCtcOdcAndActc`
   (the only leaf that declares a non-zero `earnedIncome` and asserts a
   `line28` value dependent on it) and no other leaf.

Mutations 1 and 3 typechecked cleanly, applied cleanly, and reddened exactly
the predicted leaf set with no equivalent mutants encountered. Mutation 2 is
recorded as a non-compiling mutation, consistent with AGENTS.md's documented
failure mode.

## Issues Encountered

None beyond the deviations above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **TAX-12 is now COMPLETE.** Vertical slice 4 (13-CONTEXT.md Decision 6.1)
  is closed: a return with declared dependents computes a real CTC/ODC and
  ACTC through the full `form1040Report` entry point, proven for the
  CTC/ODC classification split, the ACTC's own arithmetic, and the stepped
  phase-out cliff, all at the whole-report level.
- **`sixtyFivePlusProfile` — the fixture this whole phase's ROADMAP.md was
  written for — now computes lines 1a-37 end to end with NO refusal at
  all.** All four vertical slices (TAX-09, TAX-10, TAX-12, TAX-13) are
  proven closed against this exact fixture, one plan at a time, across
  Phase 13.
- **Schedules 1, 2 and 3 remain unwired** (Plans 13-11/13-12) — this
  phase's own "in scope" list names them, and `scheduleOneAdjustments`/
  `scheduleTwoTaxes`/`scheduleThreeNonrefundableCredits`/
  `scheduleThreeRefundableCredits` all still refuse today.
- **Five kinds' stale remedy strings remain uncorrected** (Decision 1.4,
  owned by Plan 13-13): `householdEmployeeWages`, `medicaidWaiverPayments`,
  `otherEarnedIncome`, `federalTaxWithheldOnOtherForms`,
  `netQualifiedDisasterLoss`.
- Project-local proof count: 806 (13-09's ending count) → 809 (Task 1) →
  811 (Task 2) → 813 (Task 3).

---
*Phase: 13-the-65-profile-and-the-remaining-schedules*
*Completed: 2026-08-10*

## Self-Check: PASSED

- FOUND: `fjs/form1040/core/module.f.js`
- FOUND: `fjs/return/scope/module.f.js`
- FOUND: `demo/steps/04-refusal.js`
- FOUND commit `6becc96` (Task 1)
- FOUND commit `f0b3b06` (Task 2)
- FOUND commit `93e31d9` (Task 3)
- `npx tsc --noEmit`: clean
- `npm test`: 3051 passing, 0 failing
- Project-local proof count: 813 (baseline 806, risen)
- `grep -rn "magi" fjs/`: empty
- `expectedThresholdCount === 70` (unchanged)
- `modeledKinds.length === 20`, `unmodeledKindRefusals.length === 30`, sum `50`
