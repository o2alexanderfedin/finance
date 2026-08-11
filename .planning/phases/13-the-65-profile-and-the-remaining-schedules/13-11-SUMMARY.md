---
phase: 13-the-65-profile-and-the-remaining-schedules
plan: 11
subsystem: tax
tags: [schedule-1, schedule-2, schedule-3, documented-zero, scope-guard, functionalscript]

# Dependency graph
requires:
  - phase: 13 (Wave 4, Plan 13-10)
    provides: sixtyFivePlusProfile computing 1040 lines 1a-37 end to end; the 20/30
      modeled/unmodeled kindVocabulary split
provides:
  - fjs/schedule/1/module.f.js — Schedule 1 Parts I/II, all 26 printed lines,
    every line a documented zero citing declaredKinds
  - fjs/schedule/2/module.f.js — Schedule 2 Parts I/II, all 22 printed lines,
    every line a documented zero citing declaredKinds
  - fjs/schedule/3/module.f.js — Schedule 3 Parts I/II, all 16 printed lines,
    every line a documented zero citing declaredKinds, including line 11's
    documented (not silent) W2-derivable-but-out-of-scope boundary
affects: [13-12 (Form 1040 wiring of lines 8/10/17/20/23/31), 13-13 (magi gate + stale
  remedy strings), Phase 14 (acceptance)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "profileDeclaredZeroLine/totalLine/unionSources reimplemented locally per
      module, never imported, following fjs/schedule/b's precedent"
    - "sub-lettered line-group collapse (8a-8z, 24a-24z, 1a-1z, 17a-17z, 6a-6z,
      13a-13z) modeled as ONE documented-zero line, restated at the form's own
      printed total line via { ...collapsed, rule: '...' } copy-line idiom"

key-files:
  created:
    - fjs/schedule/1/module.f.js
    - fjs/schedule/2/module.f.js
    - fjs/schedule/3/module.f.js
  modified: []

key-decisions:
  - "The five coarse kinds (scheduleOneAdditionalIncome, scheduleOneAdjustments,
    scheduleTwoTaxes, scheduleThreeNonrefundableCredits,
    scheduleThreeRefundableCredits) stay in unmodeledKindRefusals -- NOT
    reclassified by this plan or any later plan in this phase, per
    13-RESEARCH.md Open Questions 1-2. modeledKinds/unmodeledKindRefusals stay
    at 20/30, unchanged."
  - "Schedule 3 line 11 (excess Social Security/tier-1 RRTA withheld) is a
    documented zero, not a W-2-derived computation, even though the data to
    compute it already exists in stored W-2 dialects -- explicitly out of this
    phase's scope per research's own finding."
  - "Line 10/line26 (Schedule 1), line3/line21 (Schedule 2), and line8/line15
    (Schedule 3) are all ReportLine (not bare bigint), so every printed total
    also carries .value/.sources uniformly with every other line on the
    schedule -- a small departure from Schedule A's mixed bigint/ReportLine
    convention, made because every constituent line here is a
    profileDeclaredZeroLine and the plan's own acceptance criteria read
    line10.value/line26.value expecting a ReportLine shape."

patterns-established:
  - "A whole-schedule documented-zero module: every printed line named and
    computed even when every one is provably zero for the target profile,
    with the boundary (which coarse kind would drive it non-zero, and why
    that kind stays refused rather than reclassified) stated once in the
    module's own docstring."

requirements-completed: []

# Metrics
duration: ~30min
completed: 2026-08-11
---

# Phase 13 Plan 11: Schedules 1, 2, and 3 as Standalone Documented-Zero Modules Summary

**Three new standalone schedule modules (`fjs/schedule/1`, `/2`, `/3`) modeling all 64 printed
lines across Schedules 1, 2, and 3, every line a `profileDeclaredZeroLine` for the declared
65+/dependents/itemizing profile — honest because research confirms the profile reaches none of
them, not because the modules are incomplete.**

## Performance

- **Duration:** ~30 min
- **Completed:** 2026-08-11T06:09:54Z
- **Tasks:** 2 completed
- **Files modified:** 3 (all new)

## Accomplishments

- `fjs/schedule/1/module.f.js` — Schedule 1 Parts I (lines 1-10) and II (lines 11-26), all 26
  printed fields, including the 8a-8z (26 sub-lines) and 24a-24z (11 sub-lines) collapses.
- `fjs/schedule/2/module.f.js` — Schedule 2 Parts I (lines 1a-3) and II (lines 4-21), all 22
  printed fields, including the 1a-1z and 17a-17z collapses and the reserved line 10.
- `fjs/schedule/3/module.f.js` — Schedule 3 Parts I (lines 1-8) and II (lines 9-15), all 16
  printed fields, including the 6a-6z/13a-13z collapses and line 6d's Schedule R disambiguation
  from Schedule 1-A's own senior deduction.
- Every one of the 64 fields is `value: 0n`, `sources: [{ documentHash: profile.documentHash,
  boxPath: 'declaredKinds', ... }]` for a profile declaring no Schedule 1/2/3 kind — proven with
  zero stored documents, mirroring `fjs/schedule/b`'s own proof idiom.
- The five coarse kinds this plan's objective flags (`scheduleOneAdditionalIncome`,
  `scheduleOneAdjustments`, `scheduleTwoTaxes`, `scheduleThreeNonrefundableCredits`,
  `scheduleThreeRefundableCredits`) remain untouched in `fjs/return/scope` — `modeledKinds`
  stays 20, `unmodeledKindRefusals` stays 30.

## Task Commits

1. **Task 1: Build Schedule 1 — Parts I and II, all lines** - `66c114b` (feat)
2. **Task 2: Build Schedule 2 and Schedule 3 — all lines** - `ea19101` (feat)

**Plan metadata:** (this commit)

## Files Created/Modified

- `fjs/schedule/1/module.f.js` - Schedule 1, 26 printed lines, documented zero
- `fjs/schedule/2/module.f.js` - Schedule 2, 22 printed lines, documented zero
- `fjs/schedule/3/module.f.js` - Schedule 3, 16 printed lines, documented zero, including the
  Schedule 3 line 11 W-2-derivable-but-deliberately-unmodeled boundary

## Decisions Made

- Kept every printed total line (Schedule 1's line10/line26, Schedule 2's line3/line21, Schedule
  3's line8/line15) as a `ReportLine`, not a bare `bigint`, computed via a locally reimplemented
  `totalLine`/`unionSources` pair (the same idiom `fjs/form1040/core` uses privately) — every
  field on every one of these three modules therefore uniformly carries `.value`/`.sources`,
  which is what the plan's own Task 1/Task 2 acceptance criteria (`line10.value === 0n`, `each
  citing declaredKinds`) require.
- Modeled the sub-lettered groups (8a-8z, 24a-24z, 1a-1z, 17a-17z, 6a-6z, 13a-13z) as ONE
  collapsed documented-zero line each, restated at the printed form's own total-line number via
  the `{ ...collapsed, rule: '...' }` copy idiom `fjs/schedule/b`'s line4/line2 already
  established — never enumerating 26/11/13/17/5 individual sub-lines, since none is separately
  reachable by any kind this engine models (plan's own instruction).
- Schedule 3 line 11 (excess Social Security/tier-1 RRTA withheld) is documented as a boundary
  DIFFERENT in kind from every other line on these three modules: the data to compute it exists
  today in stored `vnd.fjs.w2` documents, but it is deliberately not computed this phase,
  mirroring `fjs/schedule/b`'s Form 8815 treatment exactly (money the documents could support,
  a documented decision not to compute it yet, not a silent gap).
- Left the five coarse kinds refused. Confirmed by inspection that this plan touched neither
  `fjs/return/scope/module.f.js` nor `fjs/tax/boundary/module.f.js` — `expectedModeledKindCount`
  (20), `expectedUnmodeledKindCount` (30), and `expectedThresholdCount` (70) are all unchanged.

## Deviations from Plan

None — plan executed exactly as written. The five coarse kinds' deliberate non-reclassification
was the plan's own stated objective, not a deviation from it.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `fjs/schedule/1`, `fjs/schedule/2`, `fjs/schedule/3` are ready for Plan 13-12 to wire into
  `fjs/form1040/core` at 1040 lines 8, 10, 17, 20, 23, and 31 — each module exports one pure
  function `(profile: Stored<ReturnProfile>) => Schedule{One,Two,Three}` taking only the profile,
  no other inputs, so wiring is a straightforward call-and-cite at each of those six 1040 lines.
- Plan 13-13 still owns: the case-sensitive `magi`/`Magi` gate fix (carried finding C-1,
  confirmed empty by this plan's own `grep -rn "magi" fjs/` check, but the gate itself is not
  yet mechanically case-insensitive), and correcting the five coarse kinds' stale remedy strings
  in `fjs/return/scope`'s `unmodeledKindRefusals` table (they currently say "Phase 13" as the
  remedy; this plan and 13-12 are the Phase-13 work that does NOT close them).
- TAX-14 is NOT marked complete by this plan — per this plan's own scope, Slice 5 closes at
  13-13, after 13-12 wires these three modules into Form 1040.

## Self-Check: PASSED

- FOUND: fjs/schedule/1/module.f.js
- FOUND: fjs/schedule/2/module.f.js
- FOUND: fjs/schedule/3/module.f.js
- FOUND: 66c114b (git log)
- FOUND: ea19101 (git log)
- `npm test`: 3067 pass, 0 fail (tsc clean)
- Project-local proof count: 813 (baseline, end of 13-10) → **829** (after this plan), +16
- `grep -rn "magi" fjs/`: empty
- `expectedModeledKindCount === 20`, `expectedUnmodeledKindCount === 30`,
  `expectedThresholdCount === 70`: all confirmed unchanged by direct read

---
*Phase: 13-the-65-profile-and-the-remaining-schedules*
*Completed: 2026-08-11*
