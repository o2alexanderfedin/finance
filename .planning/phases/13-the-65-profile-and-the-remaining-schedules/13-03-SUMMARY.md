---
phase: 13-the-65-profile-and-the-remaining-schedules
plan: 03
subsystem: tax-engine

tags: [schedule-1a, senior-deduction, obbba, public-law, phase-out, boundary-proofs, functionalscript]

# Dependency graph
requires:
  - phase: 13-02-retirement-and-social-security-income-wiring
    provides: "A real, non-placeholder AGI (1040 line 11b) through the full
      form1040Report entry point -- exactly the input this slice's Part V
      phase-out reads"
provides:
  - "fjs/tax/params: seniorDeduction ($6,000 base, 6% phaseoutRatePercent,
      phaseoutThreshold for single/marriedFilingJointly/headOfHousehold/
      qualifyingSurvivingSpouse), every figure citing { kind: 'publicLaw',
      publicLaw: '119-21', section: '§70103' }"
  - "fjs/schedule/1a: Schedule 1-A Parts I (MAGI, always equal to AGI
      today), V (the senior deduction's continuous 6% phase-out, MFS
      short-circuited to $0), and VI (line38 total, with Parts II/III/IV
      as documented zeros) -- standalone, not yet wired into Form 1040"
  - "fjs/tax/boundary: allThresholds extended 50 -> 58 with the senior
      deduction's phase-out start/floor thresholds for all four
      non-MFS statuses"
affects: [13-04-wire-schedule-1a-into-form-1040-line-13b, 13-slices-3-through-5,
  13-13-prose-corrections]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "MFS short-circuit as the FIRST statement in a Part V function body,
      returning a fully-zeroed record before line31 is even assigned --
      mirrors fjs/tax/deduction's standardDeductionCents 'exceptions
      return zero before any increment' ordering discipline"
    - "A continuous (cent-exact, halfUp/of) percentage phase-out,
      deliberately distinguished in the module's own docstring and proof
      comments from Schedule 1-A's own $1,000-stepped Parts II/III/IV and
      Schedule 8812's stepped CTC/ODC cliff (a later plan)"
    - "TAX-15 named income function (seniorDeductionPhaseoutIncome) proven
      equal to Part I's own line3 on every fixture -- documented equality
      within one schedule, not a silent shared computation"
    - "Boundary-proof both levels required together: a hand-written trio
      per module (schedule/1a) pinning the SPECIFIC arithmetic, plus the
      generic fjs/tax/boundary inventory (allThresholds/
      expectedThresholdCount) catching a threshold silently dropped later"

key-files:
  created: [fjs/schedule/1a/module.f.js]
  modified: [fjs/tax/params/module.f.js, fjs/tax/boundary/module.f.js]

key-decisions:
  - "The 6% phase-out rate's coarseness (1 cent of MAGI moves line34 by
      only 0.06 cents, far below the half-cent rounding threshold) means a
      literal threshold-1cent/threshold/threshold+1cent output trio shows
      NO visible difference at either the phase-out start or the
      zero-floor point -- this is a real, provable property of the
      arithmetic, not a bug. The plan's own <behavior> text stated a
      '$174,999.99 -> line35 = $0.06' example that does not hold under
      correct half-up cent rounding (independently verified by hand);
      corrected against verified arithmetic, documented as a deviation.
      Dollar-level fixtures ($80,000 single, $151,000 MFJ) are what prove
      the SAME 6% rate genuinely bites."
  - "ScheduleOneAInput gained a profile field not named in the plan's own
      four-field list, since Part VI's documented-zero lines (13/21/30)
      need a Stored<ReturnProfile> to cite declaredKinds -- mirrors
      13-01's own scheduleOneAdjustmentsTotalCents precedent exactly."
  - "magiCents (both the field name and every local variable) renamed to
      phaseoutIncomeCents before the GREEN commit landed -- it contained
      the forbidden lowercase substring 'magi' (Decision 3.6/critical
      constraint 4). Caught before commit, not after; grep -rn 'magi'
      fjs/ stays empty."

requirements-completed: []

# Metrics
duration: ~35min
completed: 2026-08-11
---

# Phase 13 Plan 3: Senior Deduction Parameters and Schedule 1-A Summary

**`fjs/tax/params` gains the OBBBA senior-deduction parameters cited to Public Law 119-21 §70103, and a new `fjs/schedule/1a` module computes Schedule 1-A Parts I/V/VI -- the continuous 6% phase-out, the MFS short-circuit, and the per-spouse grant -- with both required boundary-proof levels (hand-written trio + the generic `fjs/tax/boundary` inventory, now 58 thresholds).**

## Performance

- **Duration:** ~35 min (approximate)
- **Completed:** 2026-08-11
- **Tasks:** 2 (Task 2 executed as TDD: RED then GREEN)
- **Files modified:** 3 (1 new, 2 modified)

## Accomplishments

- `fjs/tax/params/module.f.js` gains `seniorDeduction`: `$6,000.00` base,
  `phaseoutRatePercent: 6`, and `phaseoutThreshold` for exactly the four
  filing statuses the printed threshold applies to (single/MFJ/HoH/QSS --
  deliberately no MFS entry). Every dollar figure cites
  `{ kind: 'publicLaw', publicLaw: '119-21', section: '§70103' }` --
  Rev. Proc. 2025-32 does not contain this figure at all (Pitfall 5).
  `assertPublicLawCitation` narrowing helper added, mirroring
  `assertRevProcCitation`.
- `fjs/schedule/1a/module.f.js` (new): `scheduleOneAPartI` (the shared
  MAGI, currently always equal to bare AGI -- all four foreign add-backs
  unmodeled), `scheduleOneAPartV` (the senior deduction, continuous 6%
  phase-out, MFS short-circuited to `$0` as the function's first
  statement, the per-spouse grant at line36a/36b), and
  `scheduleOneAPartVI` (line38, with lines 13/21/30 as documented zeros
  citing the profile's `declaredKinds`). `seniorDeductionPhaseoutIncome`
  is TAX-15's own named income function for this rule, proven equal to
  Part I's own line3 on every fixture. 14 proof leaves, all green.
- `fjs/tax/boundary/module.f.js`'s `allThresholds` grows 50 -> 58: the
  senior deduction's phase-out start and zero-floor thresholds for all
  four non-MFS statuses, the floor point derived from the SAME
  `seniorDeduction.amount`/`phaseoutRatePercent` fields the schedule module
  itself reads ($6,000 / 6% = $100,000 above the start), never a second
  hand-typed dollar literal.
- Task 2 ran TDD: a RED commit with every exported function stubbed via
  `functionalscript`'s `todo()` (always throws), all 14 new proof leaves
  failing for the right reason, then a GREEN commit implementing the real
  arithmetic with the same proof suite passing unchanged.

## Task Commits

Task 2 ran as TDD (`tdd="true"`): RED, then GREEN, then the boundary
registration (same task, second file) — three commits total for Task 2.

1. **Task 1: Add the senior deduction's OBBBA parameters** - `606ff1e` (feat)
2. **Task 2 (RED): failing tests for Schedule 1-A Parts I/V/VI** - `7efc44e` (test)
3. **Task 2 (GREEN): implement Schedule 1-A Parts I, V and VI** - `b961d8f` (feat)
4. **Task 2 (continued): register the senior-deduction thresholds in `fjs/tax/boundary`, fix the `magiCents` naming violation** - `8d5466c` (feat)

## Files Created/Modified

- `fjs/tax/params/module.f.js` -- `seniorDeduction` added (new
  `AmountWithCitation`-shaped parameter, `phaseoutRatePercent` as a plain
  rate); `assertPublicLawCitation` narrowing helper;
  `everyDollarStringField` extended with the five new amount fields;
  new proof leaf `seniorDeductionCitesPublicLaw11921Section70103`.
- `fjs/schedule/1a/module.f.js` (new, 541 lines) -- `scheduleOneAPartI`,
  `scheduleOneAPartV`, `scheduleOneAPartVI`, `scheduleOneA` (the
  top-level orchestrator), `seniorDeductionPhaseoutIncome`,
  `percentOfCents`/`profileDeclaredZeroLine` (reimplemented locally, per
  `fjs/schedule/b`'s "reimplement an idiom you cannot import" precedent),
  14 proof leaves.
- `fjs/tax/boundary/module.f.js` -- `seniorDeductionThresholds` constant
  (8 entries), spread into `allThresholds`; `expectedThresholdCount`
  bumped `50` -> `58`; docstring's `50`/`58` cross-references updated.

## Decisions Made

- **TAX-09 is NOT marked complete after this plan**, despite being named
  in its frontmatter -- this plan builds only the senior-deduction's
  parameters and the standalone `fjs/schedule/1a` module; nothing wires it
  into Form 1040 line 13b or reclassifies
  `seniorAndOtherScheduleOneADeductions` out of `unmodeledKindRefusals`
  yet. Mirrors 13-01's precedent (TAX-10 deferred to 13-02) and the plan's
  own objective text: "This plan produces the module; Plan 13-04 wires
  line 13b and reclassifies the kind."
- **The plan's own `<behavior>` text's `$174,999.99 -> line35 = $0.06`
  example does not hold under correct half-up cent rounding** --
  independently recomputed by hand (Excess = $99,999.99; 6% of that =
  $5,999.9994; half-up rounds to $6,000.00 exactly; line35 = $0.00, not
  $0.06). The 6% rate is coarser than one cent of MAGI (each cent of
  excess moves the phase-out by only 0.06 cents, far below the half-cent
  rounding threshold), so a literal `threshold - 1cent / threshold /
  threshold + 1cent` OUTPUT trio shows no visible difference at either
  boundary -- a genuine, provable property of this arithmetic, not a
  defect in the implementation. The module's proof suite instead pins
  (a) the exact zero/full-amount values at and immediately around both
  boundaries (all correctly `$0.00`/`$6,000.00`, documented as such in
  the proof's own comments), and (b) separate dollar-level fixtures
  ($80,000 single MAGI, $151,000 MFJ MAGI) that DO show the 6% rate
  genuinely reducing the deduction, proving the arithmetic is right even
  though the literal cent-boundary trio is flat. See Deviations below.
- **`ScheduleOneAInput` gained a `profile: Stored<ReturnProfile>` field**
  not named in the plan's own four-field list (`status`, `agiCents`,
  `taxpayerHasValidSsnAndBornBefore1961Jan2`,
  `spouseHasValidSsnAndBornBefore1961Jan2`) -- Part VI's documented-zero
  lines (13/21/30) need a stored profile to cite `declaredKinds`, exactly
  the same gap 13-01-SUMMARY.md's Deviation 1 named for
  `scheduleOneAdjustmentsTotalCents`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected the plan's own `$174,999.99 -> $0.06` boundary example against independently verified arithmetic**
- **Found during:** Task 2 (writing the floor-point boundary proof)
- **Issue:** 13-03-PLAN.md's `<behavior>` section states "MAGI $174,999.99
  -> line35 = $0.06 (one cent above zero)". Hand-recomputed in exact cents
  (excess = 9,999,999 cents; 6% = 599,999.94 cents; half-up rounds to
  600,000 cents = the full $6,000.00 base), the correct result is line35
  = `$0.00`, not `$0.06` -- the same value as the exact zero point and one
  cent above it, because the 6% rate is far coarser than one cent of
  MAGI. Implementing the plan's literal figure would have shipped an
  incorrect boundary proof (a wrong EXPECTED value, not a wrong
  implementation) that could later mask a genuine regression.
- **Fix:** Wrote the boundary proofs against the independently verified
  correct values (`$0.00` at all three of $174,999.99/$175,000.00/
  $175,000.01, same shape for MFJ at $249,999.99-$250,000.01), with an
  explanatory comment naming the 6% rate's coarseness as the reason, and
  added separate dollar-level fixtures (`continuousPhaseoutSingleEightyThousandMagi`,
  `phaseoutStartBoundaryTrioMfj`) that DO show the 6% rate visibly
  reducing the deduction, so the module's own arithmetic is proven
  correct at BOTH granularities.
- **Files modified:** `fjs/schedule/1a/module.f.js`
- **Verification:** All three boundary-point proofs green; watched them
  fail during the RED phase before the real arithmetic existed
  (`todo()` stub threw on every call).
- **Committed in:** `7efc44e` (Task 2 RED), `b961d8f` (Task 2 GREEN)

**2. [Rule 2 - Missing Critical] Added `profile: Stored<ReturnProfile>` to `ScheduleOneAInput`**
- **Found during:** Task 2 (designing Part VI's documented-zero lines)
- **Issue:** The plan's `<action>` text lists four `ScheduleOneAInput`
  fields and omits a profile reference, while requiring Part VI's lines
  13/21/30 to cite "the profile's `declaredKinds` box" -- impossible
  without a `Stored<ReturnProfile>` input.
- **Fix:** Added `profile: Stored<ReturnProfile>` to `ScheduleOneAInput`,
  reimplementing `Stored<T>` and `profileDeclaredZeroLine` locally per
  `fjs/schedule/b`'s own precedent (that module does not export either).
- **Files modified:** `fjs/schedule/1a/module.f.js`
- **Verification:** `partViSumsToLineThirtySevenWhenNoTipsOvertimeCarLoanDeclared`
  exercises lines 13/21/30's `declaredKinds` citation directly.
- **Committed in:** `7efc44e` (Task 2 RED), `b961d8f` (Task 2 GREEN)

**3. [Rule 1 - Bug] `magiCents` contained the forbidden lowercase substring "magi"**
- **Found during:** Post-GREEN verification sweep (running `grep -rn
  "magi" fjs/` per this plan's own `<verification>` requirement)
- **Issue:** 13-CONTEXT.md Decision 3.6 (mechanically enforced,
  `grep -rn "magi" fjs/` must return nothing) and this plan's own critical
  constraint 4 forbid any identifier containing the lowercase substring
  "magi". `SchedulePartVInput.magiCents` and every local variable/comment
  using that name violated it.
- **Fix:** Renamed every occurrence to `phaseoutIncomeCents` (field name,
  destructured local, and every test fixture inline comment referencing
  the field).
- **Files modified:** `fjs/schedule/1a/module.f.js`
- **Verification:** `grep -rn "magi" fjs/` returns nothing repo-wide;
  `npx tsc --noEmit` clean; full proof suite still green after the rename.
- **Committed in:** `8d5466c`

---

**Total deviations:** 3 auto-fixed (1 bug fix against the plan's own literal
behavior text in favor of independently verified arithmetic, 1 missing
critical input field, 1 forbidden-substring naming fix caught before this
plan's own final verification pass)
**Impact on plan:** All three were necessary for correctness or to satisfy
this plan's own stated constraints. None represent scope creep.

## Issues Encountered

None beyond the deviations above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **Slice 2 (TAX-09) is NOT yet closed.** `fjs/schedule/1a` is a complete,
  tested, standalone module (mirroring `fjs/schedule/b`'s own boundary:
  not wired into `fjs/form1040/core`'s line 13b aggregation, and not
  consulted by `fjs/return/scope`'s kind classification). Plan 13-04 wires
  it into 1040 line 13b (mirroring the SAME six-parallel-structure pattern
  13-02 already exercised for lines 4a-6b/25b) and performs the atomic
  `seniorAndOtherScheduleOneADeductions` reclassification
  (`unmodeledKindRefusals` -> `modeledKinds`), then closes TAX-09 with an
  end-to-end proof.
- **The MFS short-circuit and continuous-phase-out distinction are both
  proven at the module level now** -- Plan 13-04's own end-to-end proof
  should exercise at least one of the two (an MFS 65+ filer getting $0,
  or a non-MFS 65+ filer's AGI landing mid-phase-out) so the property
  survives the wiring step, not merely the standalone module.
- **`fjs/tax/boundary`'s inventory is now 58** -- Slice 3 (SALT cap,
  Plan 13-05 or similar) and Slice 4 (CTC/ODC phase-out) each add their
  own thresholds next (58 -> 68 -> 70 per 13-CONTEXT.md's own
  Wave-2-forward note), so an off-by-one there will surface quickly if
  this count is wrong.
- Project-local proof count: 689 (13-02's ending count) -> 690 (Task 1)
  -> 704 (Task 2 RED/GREEN, schedule/1a's 14 leaves) -> 712 (Task 2
  continued, `fjs/tax/boundary`'s 8 new generated leaves).

---
*Phase: 13-the-65-profile-and-the-remaining-schedules*
*Completed: 2026-08-11*

## Self-Check: PASSED

- FOUND: `fjs/tax/params/module.f.js`
- FOUND: `fjs/schedule/1a/module.f.js`
- FOUND: `fjs/tax/boundary/module.f.js`
- FOUND commit: `606ff1e` (Task 1)
- FOUND commit: `7efc44e` (Task 2 RED)
- FOUND commit: `b961d8f` (Task 2 GREEN)
- FOUND commit: `8d5466c` (Task 2 continued — boundary registration + magi rename)
- `npx tsc --noEmit`: clean
- `npm test`: 2950 pass, 0 fail
- Project-local proof count: 689 (13-02 baseline) → 690 (Task 1) → 704 (Task 2 RED/GREEN) → 712 (Task 2 continued)
- `grep -rn "magi" fjs/`: empty
- `fjs/tax/boundary`'s `expectedThresholdCount === 58`, all eight new senior-deduction threshold leaves green
