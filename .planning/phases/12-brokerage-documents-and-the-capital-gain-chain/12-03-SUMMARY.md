---
phase: 12-brokerage-documents-and-the-capital-gain-chain
plan: 03
subsystem: return-profile
tags: [return-profile, rtti, schedule-b, foreign-account, tax-07, taxpayer-declared, additive]

# Dependency graph
requires:
  - phase: 12-CONTEXT.md AMENDED 2026-08-07
    provides: "the single deliberately-granted exception to 'do not touch fjs/return/' for taxpayer-declared additive fields"
provides:
  - "vnd.fjs.return_profile: four new additive option(...) fields (hadForeignFinancialAccount, requiredToFileFinCen114, foreignAccountCountries, receivedForeignTrustDistributionOrWasGrantorOrTransferor) for Schedule B Part III"
affects: [12-04-schedule-b]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Two printed sub-questions under one form line, stored as two independent option(true) fields with deliberately no cross-field validation between them (requiredToFileFinCen114 may be declared without hadForeignFinancialAccount)"

key-files:
  created: []
  modified: [fjs/return/profile/module.f.js]

key-decisions:
  - "No checkReferences cross-field rule links the four new fields to each other or to declaredKinds — 12-RESEARCH.md recommends none, and Schedule B (Plan 12-04), not this dialect, decides what to do with the combination"
  - "New fullyPopulated leaf added as a SIBLING of the existing fullyPopulatedValidates leaf, not an edit to it, so the pre-existing leaf's own assertions stay completely undisturbed"
  - "foreignAccountFields added as a new top-level proof group (sibling of validate/checkReferences/crossDialect), not nested under checkReferences, since these four fields carry no checkReferences-level cross-field rule to test"

requirements-completed: [TAX-07]

# Metrics
duration: 20min
completed: 2026-08-07
---

# Phase 12 Plan 03: Additive Foreign-Account Fields on `vnd.fjs.return_profile` Summary

**Four additive, taxpayer-declared `option(...)` fields added to `vnd.fjs.return_profile` for Schedule B Part III (TAX-07) — the one deliberately-granted exception to Phase 12's "do not touch `fjs/return/`" rule, with the modeled/unmodeled scope partition in `fjs/return/scope/module.f.js` left byte-identical.**

## Performance

- **Duration:** ~20 min
- **Completed:** 2026-08-07
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- `fjs/return/profile/module.f.js`'s `returnProfileSchema` extended with four fields, appended after `line36AppliedToNextYear` (no existing field reordered):
  - `hadForeignFinancialAccount: option(true)` — Schedule B Part III line 7a, first sub-question.
  - `requiredToFileFinCen114: option(true)` — line 7a, second (independent) sub-question.
  - `foreignAccountCountries: option(array(string))` — line 7b, free-text plural country list.
  - `receivedForeignTrustDistributionOrWasGrantorOrTransferor: option(true)` — line 8.
- Five new proof leaves added: a new top-level `foreignAccountFields` group (`allFourPresentValidate`, `eachCheckboxRejectsFalse`, `requiredToFileWithoutHadAccountValidates`, `multipleCountriesRoundTripInOrder`) plus one sibling leaf `fullyPopulatedWithForeignAccountFieldsValidates` under the existing `validate` group.
- Module docstring's "Three schema decisions worth stating" section grew a fourth bullet naming the additive, taxpayer-declared, no-cross-field-validation design, citing 12-CONTEXT.md's "taxpayer-DECLARED, never inferred" decision by name.
- `expectedMoneyBoxFieldCount` unchanged at `4` — no money field added.
- `fjs/return/scope/module.f.js` untouched: `git diff -- fjs/return/scope/module.f.js` is empty both before and after this plan's commit.

## Task Commits

1. **Task 1: Additive foreign-account fields on `vnd.fjs.return_profile` (TAX-07, Schedule B Part III)** - `48390d1` (feat)

**Plan metadata:** (this commit, made after this SUMMARY)

## Files Created/Modified

- `fjs/return/profile/module.f.js` - Four new additive schema fields, a docstring bullet, and five new proof leaves. 93 insertions, 0 deletions — purely additive, no line removed or changed.

## Verification

```
$ npx tsc --noEmit
(exit 0)

$ node --test 2>&1 | grep -c '^✔ import("./fjs/'
607   <- risen from the entering baseline of 602

$ git diff -- fjs/return/scope/module.f.js
(empty)

$ npm test 2>&1 | tail -8
ℹ tests 2845
ℹ suites 0
ℹ pass 2845
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0

$ git status --porcelain
(empty, after commit)
```

**Acceptance-criteria greps** (each ran individually, all passed):
- `grep -n "hadForeignFinancialAccount: option(true)"` -> matches exactly once (schema).
- `grep -n "requiredToFileFinCen114: option(true)"` -> matches exactly once (schema).
- `grep -n "foreignAccountCountries: option(array(string))"` -> matches exactly once (schema).
- `grep -n "receivedForeignTrustDistributionOrWasGrantorOrTransferor: option(true)"` -> matches exactly once (schema).
- `grep -n "expectedMoneyBoxFieldCount = 4"` -> unchanged, still matches.
- `grep -c "assertEq(t, 'ok')\|assertEq(t, 'error')"` -> 22, up from a pre-edit baseline of 20 (confirmed via `git stash`).
- `grep -n "fjs/return/scope"` -> returns nothing (this file does not import or reference the scope guard).

**Commit verification:** `git ls-tree HEAD -- fjs/return/profile/module.f.js` confirms the blob is committed at `48390d1`.

## Decisions Made

- No `checkReferences` cross-field rule was added linking the four new fields to each other or to `declaredKinds`, per the plan's explicit instruction — 12-RESEARCH.md's recommendation names no such rule, and Schedule B (Plan 12-04) is the correct place to decide what a `requiredToFileFinCen114: true` without `hadForeignFinancialAccount` means downstream, not this storage dialect.
- The existing `fullyPopulatedValidates` leaf was left completely untouched; a new sibling leaf (`fullyPopulatedWithForeignAccountFieldsValidates`) proves the four new fields validate alongside every pre-existing field instead, per the plan's own risk-avoidance guidance ("if editing the existing one risks disturbing its current assertions").
- `foreignAccountFields` was added as a new top-level `proof` group (sibling to `validate`, `checkReferences`, `crossDialect`) rather than nested inside `checkReferences`, since these four fields introduce no `checkReferences`-level semantic rule for that nested group to exercise — they are purely structural, `option(...)`-only fields.

## Deviations from Plan

None - plan executed exactly as written. All four fields, all five proof leaves (the `foreignAccountFields` group's four leaves plus the `fullyPopulatedValidates` sibling), and the docstring update match the plan's `<action>` block verbatim.

## Threat Flags

None. This plan's edit stays entirely within the `<threat_model>` disposition already recorded in the plan (`T-12-03-01`, `T-12-03-02`, `T-12-03-03`, all `accept`) — no new trust boundary, network endpoint, auth path, or schema change at a trust boundary beyond the four additive fields the threat model already names.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `vnd.fjs.return_profile` now carries a real, validated place for Schedule B (Plan 12-04) to read Part III's foreign-account answers from — `hadForeignFinancialAccount`, `requiredToFileFinCen114`, `foreignAccountCountries`, and `receivedForeignTrustDistributionOrWasGrantorOrTransferor`, none of them inferred from any stored document.
- `fjs/return/scope/module.f.js`'s modeled/unmodeled partition is untouched and remains Phase 12.1's to change, atomically, with its own paired deletion from `unmodeledKindRefusals`.
- Dividends (`qualifiedDividends`/`ordinaryDividends`) remain refused this phase, unaffected by this plan — correct per 12-CONTEXT.md's AMENDED resolution, not an oversight.
- No blockers.

---
*Phase: 12-brokerage-documents-and-the-capital-gain-chain*
*Completed: 2026-08-07*

## Self-Check: PASSED

- FOUND: `fjs/return/profile/module.f.js`
- FOUND: `.planning/phases/12-brokerage-documents-and-the-capital-gain-chain/12-03-SUMMARY.md`
- FOUND: commit `48390d1` in `git log --oneline --all`
