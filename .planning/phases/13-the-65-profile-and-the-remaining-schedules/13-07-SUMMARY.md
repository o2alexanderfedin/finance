---
phase: 13-the-65-profile-and-the-remaining-schedules
plan: 07
subsystem: tax-engine
tags: [form1040, schedule-a, standard-deduction, itemized-deductions, scope-reclassification, functionalscript]

# Dependency graph
requires:
  - phase: 13-the-65-profile-and-the-remaining-schedules
    provides: "13-06's fjs/schedule/a (all 18 printed lines, the SALT worksheet, the medical floor) and the vnd.fjs.itemized_deductions/vnd.fjs.medical_expenses dialects from 13-05"
provides:
  - "fjs/tax/deduction: deductionChoice(taxParamSet)(input), a discriminated union { chosen, standard, itemized } comparing the standard deduction against Schedule A's total"
  - "fjs/form1040/core: line 12e computes the real standard-vs-itemized comparison through the full form1040Report entry point, citing BOTH figures' sources; Form1040Inputs widened 7->9 curried parameters (itemizedDeductionForms, medicalExpenseForms)"
  - "fjs/return/scope: modeledKinds 17->18, unmodeledKindRefusals 33->32 -- itemizedDeductions now modeled; netQualifiedDisasterLoss stays refused (Decision 1.4)"
  - "TAX-13 CLOSED -- vertical slice 3 of Phase 13"
affects: [13-08, 13-09, 13-10, 13-11, 13-12, 13-13]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "The comparison lives beside the figure it compares against: deductionChoice is added to fjs/tax/deduction (which already owns standardDeductionCents), not fjs/schedule/a (which would make Schedule A responsible for deciding whether it is used) and not fjs/form1040/core (which would bury a tax rule in a wiring module) -- 13-CONTEXT.md Decision 2.4"
    - "Cite what was COMPARED, not only what won: line 12e's sources always include the filing-status/12d-box sources (the standard side) PLUS the itemized-deductions document's per-entry sources when present (the itemized side), regardless of which arm deductionChoice actually chose"
    - "Wire unconditionally, gate the whole-return refusal on declaredKinds elsewhere -- line 12e computes deductionChoice for every return regardless of whether itemizedDeductions is declared, exactly like every other Wave 1/2 wiring; declaredKinds governs only whether the WHOLE return refuses for a kind this engine cannot yet compute, never an individual already-computable line"
    - "Form1040Inputs widened 7->9 curried parameters via a bracket-matching script across all 50 inputsOf(...) call sites plus two demo pages constructing the shape directly -- the same mechanical widening discipline Plan 13-02 established"

key-files:
  created: []
  modified: [fjs/tax/deduction/module.f.js, fjs/form1040/core/module.f.js, fjs/return/scope/module.f.js, demo/lib/fixtures.js, demo/steps/04-refusal.js, demo/steps/05-exactness.js]

key-decisions:
  - "deductionChoice never calls scheduleA itself -- it takes itemizedCents directly as an already-computed bigint, since it has no document inputs of its own; Schedule A has already computed the total by the time anything calls this (13-CONTEXT.md Decision 2.4's own framing)"
  - "The comparison is a STRICT >, never >=: an exact tie between itemized and standard takes the standard deduction, since itemizing at a tie gains nothing and adds substantiation risk the standard deduction does not carry -- pinned by singleNoBoxesTieGoesToStandard"
  - "itemizeEvenThoughLessThanStandardDeduction (Decision 2.5, Schedule A line 18) overrides the comparison outright, checked BEFORE the strict-> comparison, so a taxpayer can legitimately itemize at a loss (it can still reduce state tax)"
  - "itemizedDeductions is inserted into modeledKinds in kindVocabulary order -- immediately BEFORE seniorAndOtherScheduleOneADeductions, matching its true 1040 line-12e position (kindVocabulary lists itemizedDeductions/12e ahead of seniorAndOtherScheduleOneADeductions/13b), not appended at the list's tail"
  - "netQualifiedDisasterLoss (line 12e's own exception 5, via Form 4684) stays REFUSED -- shipping Schedule A's medical/SALT/mortgage/charity sections does not make the disaster-loss election computable; its stale remedy string is corrected later, in Wave 5 (13-13)"
  - "No pre-existing hand-typed proof leaf in fjs/return/scope used itemizedDeductions as a still-refused fixture -- verified by full-file review before editing, per the plan's own instruction never to assume this"
  - "demo/steps/04-refusal.js's toggle list swapped itemizedDeductions (no longer unmodeled) for netQualifiedDisasterLoss, its former neighbor in the refusal table, which stays refused through the rest of the phase"

requirements-completed: [TAX-13]

# Metrics
duration: ~70min
completed: 2026-08-11
---

# Phase 13 Plan 07: deductionChoice and the Standard-vs-Itemized Wiring Summary

**Form 1040 line 12e now computes the real standard-vs-itemized comparison through `deductionChoice` (`fjs/tax/deduction`) and `fjs/schedule/a`, proven in BOTH directions including the load-bearing case where a filer's own age/blindness-raised standard deduction still beats itemized deductions above the base $15,750/$31,500 figure -- closing TAX-13, vertical slice 3.**

## Performance

- **Duration:** ~70 min (approximate, git-timestamp-based)
- **Completed:** 2026-08-11
- **Tasks:** 3 (all `type="auto"`, Task 1 `tdd="true"`)
- **Files modified:** 6 (0 new, 6 modified)

## Accomplishments

- `fjs/tax/deduction/module.f.js` gained `deductionChoice(taxParamSet)(input)`,
  returning `{ chosen: 'standard' | 'itemized', standard, itemized }`.
  Computes both figures unconditionally, then decides: the line 18 election
  overrides outright; otherwise itemized wins only on a strict `>`. Proven
  with a six-combination generated matrix (standard-wins/itemized-wins/
  election-overrides × two filing statuses) plus four named leaves matching
  the plan's own Test 1-4 language, including the load-bearing case (a
  single filer with two age/blindness boxes has a real $19,750.00 standard
  deduction; $18,000.00 of itemized deductions exceeds the BASE $15,750.00
  and still loses).
- `fjs/form1040/core/module.f.js`: `Form1040Inputs` widened from 7 to 9
  curried parameters (`itemizedDeductionForms`, `medicalExpenseForms`), all
  50 pre-existing `inputsOf(...)` call sites updated mechanically via a
  bracket-matching script, plus two demo pages that construct
  `Form1040Inputs` directly. Before line 12e is built, `scheduleA(...)`
  computes the itemized total off the flattened stored entries, then
  `deductionChoice(...)` picks the winning figure. Line 12e's sources now
  cite BOTH the standard side (filing-status/12d-box sources) and the
  itemized side (the itemized-deductions document's per-entry sources, when
  present) — regardless of which arm won.
- `fjs/return/scope/module.f.js`: `itemizedDeductions` moved from
  `unmodeledKindRefusals` to `modeledKinds`, in `kindVocabulary` order
  (immediately before `seniorAndOtherScheduleOneADeductions`, its true 1040
  position). `modeledKinds` 17 → 18; `unmodeledKindRefusals` 33 → 32; both
  sum to the frozen 50. `netQualifiedDisasterLoss` stays refused (Decision
  1.4). A new "Slice 3's itemizing boundary" docstring section documents the
  reclassification, mirroring the Wave 1/Wave 2 precedent sections exactly.
- End-to-end proof (Task 3, `wave3Itemizing`): a single filer with
  $20,000.00 of real itemized deductions computes `line12e.value ===
  2000000n` through the full `form1040Report` entry point, cross-checked
  independently against a direct `scheduleA(...)` call, with `line15`
  correspondingly lower. A SECOND leaf — the load-bearing one — proves a
  single filer with both age/blindness boxes checked (real standard
  deduction $19,750.00) computes `line12e.value === 1975000n` even though
  its $18,000.00 of itemized deductions exceeds the BASE $15,750.00;
  `line12e.sources` still cites the itemized-deductions document even
  though it lost.
- Project-local proof count rose from **765 (13-06 baseline) to 779** — 14
  new proof leaves (11 in `fjs/tax/deduction`, 1 in `fjs/return/scope`, 2 in
  `fjs/form1040/core`).

## Task Commits

Each task was committed atomically:

1. **Task 1: Add deductionChoice to fjs/tax/deduction** - `3f56613` (feat)
2. **Task 2: Wire line 12e through deductionChoice, reclassify itemizedDeductions** - `56980c3` (feat)
3. **Task 3: End-to-end proof -- both directions, at the load-bearing scale** - `74ff672` (test)

**Plan metadata:** (this commit, following this SUMMARY)

## Files Created/Modified

- `fjs/tax/deduction/module.f.js` — new `deductionChoice`, `DeductionChoiceInput`/
  `DeductionChoiceResult` typedefs, a six-combination generated proof matrix
  (`deductionChoiceCombinations`), and four named Test 1-4 leaves.
- `fjs/form1040/core/module.f.js` — `Form1040Inputs` widened 7→9 params;
  `inputsOf` widened to match (50 call sites); line 12e's computation
  replaced with `scheduleA(...)` + `deductionChoice(...)`; new
  `itemizedDeductionsDocument` fixture builder; `wave3Itemizing` end-to-end
  proof group (2 leaves).
- `fjs/return/scope/module.f.js` — `itemizedDeductions` reclassified;
  `expectedModeledKindCount`/`expectedUnmodeledKindCount` 17/33 → 18/32;
  `modeledKindsIsExactlyEighteen`/`unmodeledRefusalsIsExactlyThirtyTwo`
  (renamed); `allEighteenModeledKindsDeclaredTogetherAreInScope` (renamed,
  extended); new `itemizedDeductionsIsInScopeAlone` leaf; a new "Slice 3's
  itemizing boundary" docstring section; two stale "thirty-four" prose
  references corrected to "thirty-two" while in the neighborhood.
- `demo/lib/fixtures.js`, `demo/steps/05-exactness.js` — the two demo pages
  constructing `Form1040Inputs` directly gained the two new empty-array
  fields (Rule 3, blocking `tsc` fix).
- `demo/steps/04-refusal.js` — the refusal-toggle list swapped
  `itemizedDeductions` (no longer unmodeled) for `netQualifiedDisasterLoss`,
  its former table neighbor, which stays refused (Rule 3, blocking `tsc`
  fix).

## Decisions Made

See `key-decisions` in frontmatter above.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The plan's own Test 2 dollar figures were arithmetically inconsistent**
- **Found during:** Task 1, designing the load-bearing fixture
- **Issue:** The plan's `<behavior>` text described Test 2 as "two boxes checked, 65+ and blind... raising their standard deduction to $17,750" for a single filer. Two $2,000.00 increments on a $15,750.00 base is $19,750.00, not $17,750.00 — $17,750.00 is the ONE-box figure (already pinned in `fjs/tax/deduction`'s own `chartCombinations`). The parenthetical box count and the stated dollar figure could not both be true.
- **Fix:** Used the arithmetically consistent numbers throughout (both in `fjs/tax/deduction`'s own leaf and in Task 3's end-to-end fixture): two boxes checked, standard deduction $19,750.00, itemized total $18,000.00 (still above the BASE $15,750.00, still below this filer's own $19,750.00) — preserving the exact property the plan's own critical constraint 2 describes as load-bearing, with self-consistent arithmetic.
- **Files modified:** `fjs/tax/deduction/module.f.js`, `fjs/form1040/core/module.f.js`
- **Verification:** `npm test` green; the standard-deduction figure ($19,750.00 = `1975000n`) matches `fjs/tax/deduction`'s own independently hand-typed `chartCombinations` row for `single, boxes: 2`.
- **Committed in:** `3f56613` (Task 1), `74ff672` (Task 3)

**2. [Rule 1 - Bug] The plan's own verification instruction ("grep count equals exactly 2") does not match established precedent for this class of change**
- **Found during:** Task 2, running the plan's own mechanical verification step
- **Issue:** The plan's acceptance criteria stated `grep -n "itemizedDeductions" fjs/return/scope/module.f.js | wc -l` must equal exactly 2 (the `modeledKinds` entry and one docstring history paragraph). Plan 13-04's own equivalent reclassification (`seniorAndOtherScheduleOneADeductions`) added a full docstring section ("Slice 2's senior-deduction boundary") plus a dedicated single-kind proof leaf — far more than 2 occurrences of its own kind name — and this plan's own `<code_context>` explicitly instructs following that precedent.
- **Fix:** Verified the underlying PROPERTY the count exists to check (no orphaned "still refused" proof fixture references `itemizedDeductions`) via a full-file grep and read, exactly as Task 2's own `<action>` describes doing mechanically — confirmed clean. Did not force the literal count down to 2, since doing so would mean omitting the Wave 3 docstring section and the isolated single-kind proof leaf that 13-04's own precedent (which this plan explicitly says to follow) established as the right shape for this reclassification.
- **Files modified:** `fjs/return/scope/module.f.js`
- **Verification:** `npm test` green; `grep -n "itemizedDeductions" fjs/return/scope/module.f.js` shows 7 occurrences, none of them a stale "still refused" fixture; `twoUnmodeledKindsRefuseNamingBothInFormOrder`/`unmodeledFollowsFormOrderNotDeclarationOrder` (Plan 13-04's own repoint) pass byte-for-byte unchanged.
- **Committed in:** `56980c3` (Task 2)

**3. [Rule 3 - Blocking] Two demo pages and one demo fixture module failed `tsc` after `Form1040Inputs` widened**
- **Found during:** Task 2, first `npx tsc --noEmit` after widening `Form1040Inputs`
- **Issue:** `demo/lib/fixtures.js`'s exported `inputs` object and
  `demo/steps/05-exactness.js`'s own inline `Form1040Inputs` literal both
  construct the shape directly (not through `inputsOf`), so both were
  missing the two new required fields (`TS2739`). Separately,
  `demo/steps/04-refusal.js`'s `offered` toggle list held `itemizedDeductions`,
  which stopped being assignable to `UnmodeledKind` after the reclassification
  (`TS2322`) — the exact mechanism Plan 13-02's own Deviation 3 and Plan
  13-04's own Deviation 4 already documented for their own reclassifications.
- **Fix:** Added `itemizedDeductionForms: []`/`medicalExpenseForms: []` to
  both fixture constructions. Swapped `itemizedDeductions` in
  `04-refusal.js`'s toggle list for `netQualifiedDisasterLoss`, its former
  neighbor in the refusal table, which stays refused through the rest of
  this phase.
- **Files modified:** `demo/lib/fixtures.js`, `demo/steps/05-exactness.js`, `demo/steps/04-refusal.js`
- **Verification:** `npx tsc --noEmit` clean.
- **Committed in:** `56980c3` (Task 2)

---

**Total deviations:** 3 auto-fixed (1 arithmetic correction to the plan's own illustrative figures, 1 verification-instruction reconciliation against established precedent, 1 blocking `tsc` fix affecting three files)
**Impact on plan:** All necessary to keep `npm test`/`tsc` green while preserving every property each deviation touched. None represent scope creep or dropped coverage.

## Issues Encountered

None beyond the deviations above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **TAX-13 is now COMPLETE.** Vertical slice 3 (13-CONTEXT.md Decision 6.1)
  is closed: a return that itemizes computes line 12e for real, and the
  standard-vs-itemized comparison actually decides the outcome, proven in
  both directions including the load-bearing above-threshold case.
- **Slices 4 (dependents/Schedule 8812) and 5 (the remaining schedules and
  the sweep) remain**, per Decision 6.2 — both are independent of this
  slice's own wiring.
- `fjs/tax/boundary`'s `expectedThresholdCount` is unchanged at 68 (13-09 is
  expected to take it to 70, not this plan).
- `netQualifiedDisasterLoss`'s stale remedy string ("requires Schedule A
  (TAX-13, Phase 13)") is now genuinely stale — Schedule A ships, but the
  Form 4684 election it names still does not compute. 13-13's own remit
  (Decision 1.4) is what corrects it.
- Project-local proof count: 765 (13-06's ending count) → 776 (Task 1) →
  777 (Task 2) → 779 (Task 3).

---
*Phase: 13-the-65-profile-and-the-remaining-schedules*
*Completed: 2026-08-11*

## Self-Check: PASSED

- FOUND: `fjs/tax/deduction/module.f.js`
- FOUND: `fjs/form1040/core/module.f.js`
- FOUND: `fjs/return/scope/module.f.js`
- FOUND: `demo/lib/fixtures.js`
- FOUND: `demo/steps/04-refusal.js`
- FOUND: `demo/steps/05-exactness.js`
- FOUND commit `3f56613` (Task 1)
- FOUND commit `56980c3` (Task 2)
- FOUND commit `74ff672` (Task 3)
- `npx tsc --noEmit`: clean
- `npm test`: 3017 passing, 0 failing
- Project-local proof count: 779 (baseline 765, risen)
- `grep -rn "magi" fjs/`: empty
- `fjs/tax/boundary`'s `expectedThresholdCount === 68` (unchanged)
- `modeledKinds.length === 18`, `unmodeledKindRefusals.length === 32`, sum `50`
