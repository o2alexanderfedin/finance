---
phase: 13-the-65-profile-and-the-remaining-schedules
plan: 13
subsystem: testing
tags: [functionalscript, node-test, tax-params, citation, requirements-doc]

# Dependency graph
requires:
  - phase: 13-12
    provides: Schedule 1/2/3 wired to 1040 lines 8/10/17/19/20/23/28/31, all five vertical slices composing
provides:
  - a mechanical, real-process MAGI gate (magi-gate.test.js) stronger than criterion 5's literal grep
  - ten corrected remedy strings in fjs/return/scope's unmodeledKindRefusals (no more false "(Phase 13)" promises)
  - childTaxCredit citation-precision docstring (carried finding C-3)
  - REQUIREMENTS.md/ROADMAP.md corrected from "19-line" to "18-line" Social Security Benefits Worksheet
  - TAX-14 marked complete, closing Phase 13
affects: [phase-14, any-future-magi-consuming-phase]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "root-level @ts-nocheck real-process node:test file for mechanical repo-hygiene gates (magi-gate.test.js, following cas-refresh-cross-process.test.js's precedent)"
    - "case-insensitive-on-M/case-sensitive-on-agi regex ([a-zA-Z]*[Mm]agi[a-zA-Z]*) to gate identifiers while permitting all-caps acronym prose"

key-files:
  created: [magi-gate.test.js, .planning/phases/13-the-65-profile-and-the-remaining-schedules/deferred-items.md]
  modified: [fjs/return/scope/module.f.js, fjs/tax/params/module.f.js, fjs/schedule/1a/module.f.js, fjs/form1040/core/module.f.js, .planning/REQUIREMENTS.md, .planning/ROADMAP.md]

key-decisions:
  - "Gate regex is [a-zA-Z]*[Mm]agi[a-zA-Z]* (case-insensitive on M/m, fixed lowercase agi) -- exactly the shell verify command 13-VALIDATION.md's C-1 names, so the mechanical test and the manual grep agree by construction"
  - "Renamed camelCase Magi proof fixtures to name what they exercise (phaseout income / a dollar amount / Part I line3), never deleting an assertion"
  - "Decision 1.4's five stale remedies read '(no phase yet)'; the five Schedule-1/2/3-adjacent coarse kinds get their own honest 'no per-line/per-credit dialect' remedy, since those modules DO exist and are wired but the frozen kindVocabulary still cannot attribute one coarse declaration to a specific printed line"
  - "C-3 resolved via docstring precision (cheaper option (b) from 13-VALIDATION.md), not a guessed Rev. Proc. number -- research never confirmed one for odcAmount/actcCap/phaseoutThreshold, only for ctcAmount"
  - "Both REQUIREMENTS.md and ROADMAP.md had TWO stale '19-line' mentions each, not one as the plan's acceptance criteria assumed -- fixed all four, not just two"

patterns-established:
  - "A criterion stated as a shell grep command should be matched by an equivalent, deliberately-stronger, hand-written regex inside the mechanical test that enforces it -- not merely re-implemented at the letter of the literal text"

requirements-completed: [TAX-14]

# Metrics
duration: 20min
completed: 2026-08-11
---

# Phase 13 Plan 13: The Mechanical MAGI Gate and the Phase's Carried Findings Summary

**Built a real-process MAGI-token gate stronger than criterion 5's literal grep, corrected ten stale "(Phase 13)" remedy promises, and closed all three carried findings (C-1/C-2/C-3) — the phase's final plan.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-08-10T23:30Z (approx., first read after 13-12's completion commit)
- **Completed:** 2026-08-11T06:45:50Z
- **Tasks:** 3 (plus one pre-task deviation commit for carried finding C-1's renames)
- **Files modified:** 8 (2 new: `magi-gate.test.js`, `deferred-items.md`; 6 modified)

## Accomplishments

- `magi-gate.test.js` — a root-level, real-process `node:test` file that recursively walks
  `fjs/` and fails on any identifier matching `[a-zA-Z]*[Mm]agi[a-zA-Z]*` (case-insensitive on
  the leading M/m, fixed-lowercase `agi`), while a positive-control leaf proves the exact
  uppercase `MAGI` acronym still passes in prose. Mutation-verified: a scratch
  `scratchSeniorMagiProbe` identifier failed the gate naming the file and line, then was reverted.
- Renamed the four camelCase `Magi` proof-fixture identifiers carried finding C-1 found
  (`continuousPhaseoutSingleEightyThousandMagi` → `continuousPhaseoutSingleAtEightyThousandDollars`,
  `mfsAtZeroMagiGetsZeroNotDecisiveAlone` → `mfsAtZeroPhaseoutIncomeGetsZeroNotDecisiveAlone`,
  `mfsAtTenThousandMagiGetsZeroDecisiveShortCircuitProof` →
  `mfsAtTenThousandPhaseoutIncomeGetsZeroDecisiveShortCircuitProof`,
  `partIMagiEqualsSeniorDeductionPhaseoutIncomeForEveryFixture` →
  `partILine3EqualsSeniorDeductionPhaseoutIncomeForEveryFixture`), plus one cross-reference
  comment — every assertion preserved.
- Corrected all ten stale `(Phase 13)` remedy strings in `fjs/return/scope`'s
  `unmodeledKindRefusals`: Decision 1.4's five now read `(no phase yet)`; the five Schedule
  1/2/3-adjacent coarse kinds (which DO have modules now, TAX-14) get an honest
  "no per-line/per-credit dialect" remedy instead. `grep -rn "(Phase 13)" fjs/` is now empty
  repo-wide.
- Resolved carried finding C-3: recorded in `childTaxCredit`'s docstring that `odcAmount`,
  `actcCap` and `phaseoutThreshold` are verified against the printed 2025 Schedule 8812
  (`[VERIFIED: f1040s8.pdf p2 line16b]`), and that their `§24(h)` citation names the governing
  provision rather than the literal inflation-adjusted amount — no guessed Rev. Proc. number.
- Corrected all four stale "19-line" mentions (two each) to "18-line" in `REQUIREMENTS.md` and
  `ROADMAP.md` (carried finding C-2).
- Marked `TAX-14` complete via `gsd-sdk query requirements.mark-complete` — Phase 13's final
  requirement, closing the phase.

## Task Commits

1. **[Deviation, Rule 2 — carried finding C-1, part 1] Rename camelCase Magi identifiers** —
   `9a7d061` (refactor)
2. **Task 1: The mechanical MAGI gate** — `7799be0` (test)
3. **Task 2: Correct the ten stale remedy strings** — `008ff13` (fix)
4. **[Deviation, Rule 2 — carried finding C-3] Citation precision docstring** — `180c8e4` (docs)
5. **Task 3: Fix the 18-vs-19 line count; mark TAX-14 complete** — `7eea2f5` (fix)

**Plan metadata:** (this commit, made after this SUMMARY)

## Files Created/Modified

- `magi-gate.test.js` (new) — mechanical, real-process MAGI-token gate; discovered automatically
  by `node --test` / `npm test`, no wiring needed
- `fjs/schedule/1a/module.f.js` — four proof-fixture identifiers renamed (C-1)
- `fjs/form1040/core/module.f.js` — one cross-reference comment renamed to match (C-1)
- `fjs/return/scope/module.f.js` — ten `unmodeledKindRefusals` remedy strings corrected; header
  comment explaining the two different reasons; one prose comment rewritten to stop quoting the
  literal `(Phase 13)` string
- `fjs/tax/params/module.f.js` — `childTaxCredit` docstring gains a citation-precision paragraph
  (C-3)
- `.planning/REQUIREMENTS.md` — "19-line" → "18-line" (two occurrences); `TAX-14` marked `[x]`
- `.planning/ROADMAP.md` — "19-line" → "18-line" (two occurrences)
- `.planning/phases/13-the-65-profile-and-the-remaining-schedules/deferred-items.md` (new) — logs
  an out-of-scope, pre-existing staleness in `REQUIREMENTS.md`'s traceability table

## Decisions Made

- The mechanical gate's regex is exactly `[a-zA-Z]*[Mm]agi[a-zA-Z]*` — the same pattern
  13-VALIDATION.md's C-1 names as the manual verify command, so the test and the shell check
  agree by construction rather than by two independently-written implementations drifting apart.
- Renames say what each fixture actually exercises (`seniorDeductionPhaseoutIncome`, a dollar
  amount, or Part I's own `line3`) rather than reusing "MAGI" under a different case.
- C-3 resolved via the cheaper docstring-precision option 13-VALIDATION.md itself named, rather
  than guessing an unverified Rev. Proc. number.
- Both stale-count files had two "19-line" mentions each, not the one the plan's acceptance
  criteria assumed — fixed all four instances, verified via `grep -c` before and after.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 — Missing Critical Functionality] Renamed camelCase `Magi` proof-fixture identifiers (carried finding C-1)**
- **Found during:** Pre-task read of `13-VALIDATION.md`'s Carried Findings section, owned by
  this plan
- **Issue:** `fjs/schedule/1a/module.f.js` (four identifiers) and `fjs/form1040/core/module.f.js`
  (one cross-reference comment) carried camelCase `Magi`, invisible to the literal
  case-sensitive `grep -rn "magi" fjs/` criterion
- **Fix:** Renamed to name what each fixture exercises; no assertion changed
- **Files modified:** `fjs/schedule/1a/module.f.js`, `fjs/form1040/core/module.f.js`
- **Verification:** `grep -rno "[a-zA-Z]*[Mm]agi[a-zA-Z]*" fjs/` empty before the gate existed;
  `tsc --noEmit` clean; `npm test` clean; project-local proof count held at 830 (pure rename)
- **Committed in:** `9a7d061`

**2. [Rule 2 — Missing Critical Functionality] Prose comment quoting the literal stale `(Phase 13)` string**
- **Found during:** Task 2, after correcting `unmodeledKindRefusals`, when re-running
  `grep -rn "(Phase 13)" fjs/` per the objective's own verification requirement
- **Issue:** One comment in `fjs/return/scope/module.f.js` (near
  `twoUnmodeledKindsRefuseNamingBothInFormOrder`) quoted the OLD `'no dialect models it (Phase 13)'`
  remedy string verbatim as documentation, which kept the literal substring `(Phase 13)` present
  even after the remedy table itself was corrected
- **Fix:** Rewrote the comment to describe the change without quoting the literal old string
  (still accurately documents the provenance)
- **Files modified:** `fjs/return/scope/module.f.js`
- **Verification:** `grep -rn "(Phase 13)" fjs/` returns nothing repo-wide; `npm test` clean
- **Committed in:** `008ff13`

**3. [Rule 2 — Missing Critical Functionality] Citation-precision docstring for `childTaxCredit` (carried finding C-3)**
- **Found during:** Pre-task read of `13-VALIDATION.md`'s Carried Findings section, owned by
  this plan (`fjs/tax/params/module.f.js` was not in this plan's original `files_modified` list,
  but C-3 is explicitly assigned to "phase verification / 13-13")
- **Issue:** `odcAmount`/`actcCap`/`phaseoutThreshold` cite `{ kind: 'code', section: '§24(h)' }`,
  but §24(h) carries base amounts inflation-adjusted elsewhere, so a reader following the
  citation does not find the literal dollar figure there
- **Fix:** Added a docstring paragraph recording that these three figures are verified against
  the printed 2025 Schedule 8812 and that §24(h) names the governing provision, not the literal
  amount — no guessed Rev. Proc. number
- **Files modified:** `fjs/tax/params/module.f.js`
- **Verification:** `tsc --noEmit` clean; `npm test` clean; no computed value changed
- **Committed in:** `180c8e4`

**4. [Rule 1 — Bug in plan's stated fact] REQUIREMENTS.md/ROADMAP.md each had two stale "19-line" mentions, not one**
- **Found during:** Task 3, before editing, via `grep -n "19-line" .planning/REQUIREMENTS.md
  .planning/ROADMAP.md`
- **Issue:** The plan's acceptance criteria assumed one mention per file
  (`grep -c "18-line" ... returns 1 for each`); actual count was two per file (REQUIREMENTS.md
  lines 33 and 307; ROADMAP.md lines 46 and 516)
- **Fix:** Corrected all four instances, not just two
- **Files modified:** `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md`
- **Verification:** `grep -c "19-line" .planning/REQUIREMENTS.md .planning/ROADMAP.md` returns
  `0` for both (the primary, authoritative criterion); `grep -c "18-line"` returns `2` for
  REQUIREMENTS.md and `4` for ROADMAP.md (2 new fixes + 2 pre-existing correct mentions
  documenting this very plan and 13-01, not double-counting)
- **Committed in:** `7eea2f5`

---

**Total deviations:** 4 auto-fixed (all Rule 2/Rule 1 — carried findings this plan explicitly
owned, plus one plan-text inaccuracy corrected against ground truth)
**Impact on plan:** All four were required by the objective's own critical_constraints (carried
findings C-1/C-2/C-3 are explicitly "not optional"). No scope creep beyond what 13-VALIDATION.md
already assigned to this plan.

## Issues Encountered

None beyond the deviations above — every task typechecked and passed on first or second attempt.

## Verification (explicit, per the objective's `<verification>` block)

- `npm test` (`tsc && node --test`): **green**, 3070 tests, 0 failures (was 3068 before this
  plan; +2 from `magi-gate.test.js`'s two `node:test` leaves, which are NOT `fjs/` proof-import
  leaves and so do not move the project-local count below).
- Project-local proof count (`node --test 2>&1 | grep -c '^✔ import("./fjs/'`): **830**, held
  (not risen). This plan is corrective — it renames identifiers, corrects remedy strings and
  docstrings, and fixes documentation prose; it adds zero new `.f.js` proof leaves. The new
  `magi-gate.test.js` leaves are root-level real-process `node:test` tests (the
  `cas-refresh-cross-process.test.js` / `fjs-run-integration.test.js` precedent), outside the
  `fjs/` proof-import system by design, so they correctly do not add to this count. **830 is
  Phase 14's new baseline**, unchanged from the 830 baseline 13-12 left.
- `grep -rn "magi" fjs/` (the literal criterion 5 text): **empty**.
- `grep -rno "[a-zA-Z]*[Mm]agi[a-zA-Z]*" fjs/` (the stronger, case-insensitive-on-identifiers
  bar C-1 demands): **empty**.
- `grep -rn "(Phase 13)" fjs/`: **empty**.
- `grep -c "19-line" .planning/REQUIREMENTS.md .planning/ROADMAP.md`: **0 for both**.
- Kind/threshold counts unchanged: `expectedModeledKindCount === 20`,
  `expectedUnmodeledKindCount === 30` (both in `fjs/return/scope/module.f.js`),
  `expectedThresholdCount === 70` (`fjs/tax/boundary/module.f.js`, untouched this plan).
- `everyRefusalNamesALineALabelAndARemedy` and `everyUnmodeledKindRefusesNamingItsOwnLineAndLabel`
  (the existing structural proofs over `unmodeledKindRefusals`) pass unchanged in structure.
- 13-04's own `twoUnmodeledKindsRefuseNamingBothInFormOrder` /
  `unmodeledFollowsFormOrderNotDeclarationOrder` fixtures (which deliberately assert line
  locators and ordering, never remedy text, per their own in-code caution) are unaffected by the
  remedy-string rewrite.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Phase 13 is closed: `sixtyFivePlusProfile` computes 1040 lines 1a–37 end to end with no
  refusal for the declared 65+/brokerage/dependents/itemizing profile, and Plan 13-12's own proof
  shows all five vertical slices composing in one return.
- TAX-14 is the phase's final requirement, now `[x]`.
- The MAGI gate is now mechanical infrastructure any future phase inherits for free — TAX-15
  (Phase 14 or later, per-rule MAGI: IRA deduction, Roth eligibility, PTC, IRMAA,
  student-loan-interest) can build separately-named MAGI functions without re-litigating the
  no-shared-MAGI rule, because a regression fails `npm test` immediately.
- Logged one pre-existing, out-of-scope discovery (`deferred-items.md`): `REQUIREMENTS.md`'s
  traceability table's `Status` column lags several already-`[x]` requirements. Worth a small
  future fix, either in `requirements mark-complete` itself or by dropping the redundant column.
- No blockers for Phase 14.

---
*Phase: 13-the-65-profile-and-the-remaining-schedules*
*Completed: 2026-08-11*

## Self-Check: PASSED

All claimed files verified present on disk (`magi-gate.test.js`, `deferred-items.md`, this
SUMMARY) and all five claimed commit hashes verified present in `git log --oneline --all`
(`9a7d061`, `7799be0`, `008ff13`, `180c8e4`, `7eea2f5`).
