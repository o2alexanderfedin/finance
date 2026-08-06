---
phase: 08-ty2025-parameters-and-the-tax-table-as-data
plan: 06
subsystem: testing
tags: [gap-closure, mutation-sweep, coverage, irs-primary-source, tax, rational]

# Dependency graph
requires:
  - phase: 08-ty2025-parameters-and-the-tax-table-as-data
    provides: finance_tax_params (TY2025 stored brackets/breakpoints/citations) and finance_tax_table (lookupTaxTable, the $100k refusal)
provides:
  - Per-status, per-bracket assertions of every ordinary bracket ceiling/rate (Rev. Proc. 2024-40 Tables 1-5) above the previously-unverified ~$100k line
  - Per-status assertions of every capital-gains breakpoint (Rev. Proc. 2024-40 §2.03)
  - Citation `section` and `effectiveDate` assertions on every parameter, not just `revProc`
  - A content assertion (not just "did it throw") on the Tax Table's $100,000 refusal message
  - A direct unit proof for `negate` in `fjs/types/rational`
affects: [phase-10-tax-computation-worksheet]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Independent-literal mutation proof: hand-typed expected values from a primary source (not derived from the module's own exports), asserted per-field so one wrong figure names itself"

key-files:
  created: []
  modified:
    - fjs/tax/params/module.f.js
    - fjs/tax/table/module.f.js
    - fjs/types/rational/module.f.js

key-decisions:
  - "All figures in the plan's tables were confirmed to already match the stored data exactly - no stored value was changed, only proofs were added"
  - "Split into 4 commits (one per plan task, with task 3 split into 3a/3b since it touches two unrelated files) rather than one combined commit per plan task boundary, so each commit's diff is independently reviewable"

requirements-completed: [TAX-01, TAX-02]

# Metrics
duration: ~65min
completed: 2026-08-06
---

# Phase 8 Plan 6: Close mutation-sweep gaps above $100k Summary

**Added independent, per-status/per-bracket proofs for every ordinary rate bracket and capital-gains breakpoint above ~$100,000 (32%/35%/37%, all five filing statuses), extended citation proofs to cover `section`/`effectiveDate` not just `revProc`, strengthened the $100k refusal to assert its message content, and covered the previously-untested `negate` export — closing all 9 real coverage gaps a systematic mutation sweep found.**

## Performance

- **Duration:** ~65 min
- **Started:** 2026-08-05T21:00:00-07:00 (approx.)
- **Completed:** 2026-08-05T21:06:22-07:00 (last commit)
- **Tasks:** 3 (task 3 split across two files → 4 commits total)
- **Files modified:** 3

## Accomplishments

- Every ordinary bracket ceiling AND rate, for all five filing statuses (MFJ, HoH, single, MFS, estates & trusts), now asserted against Rev. Proc. 2024-40 §2.01 Tables 1-5 figures read directly from the published PDF — closing the largest gap: the 32%/35%/37% brackets above ~$100k had essentially zero verification before this plan.
- Every capital-gains breakpoint (zero-rate and 15%-rate maximum), for all five statuses, asserted against §2.03.
- Citation `section` and `effectiveDate` fields asserted for every parameter (previously only `revProc` was ever read by a proof).
- `lookupTaxTable`'s $100,000 refusal now asserts the thrown message's CONTENT (names the $100,000 boundary and the Tax Computation Worksheet), not merely that something was thrown — closing the gap where weakening `<` to `<=` still threw, just via the wrong code path.
- `negate` (zero callers, zero prior proofs) now has a direct unit proof covering both a positive and negative numerator.

## Task Commits

Each task was committed atomically:

1. **Task 08-06-01: ordinary brackets + capital-gains breakpoints** - `557327f` (test)
2. **Task 08-06-02: citation `section`/`effectiveDate` coverage** - `c3c016f` (test)
3. **Task 08-06-03a: $100k refusal message-content assertion** - `da95817` (test)
4. **Task 08-06-03b: `negate` unit proof** - `ce64e23` (test)

_Task 3 in the plan covers two independent, unrelated fixes (`fjs/tax/table` and `fjs/types/rational`); split into 3a/3b so each commit's diff stays scoped to one file/one fix._

## Files Created/Modified

- `fjs/tax/params/module.f.js` - Added `everyOrdinaryBracketMatchesRevProc202440Tables1Through5` and `everyCapitalGainsBreakpointMatchesRevProc202440Section203` proofs; extended `standardDeductionCitesObbbaRevision` and `unmodifiedParametersCite2024_40Only` to assert `section`/`effectiveDate` on every citation. No stored value changed.
- `fjs/tax/table/module.f.js` - Extended `tableRefusesAtOneHundredThousandAndAbove` to assert the thrown message's content (`.includes('100,000')` and `.includes('Tax Computation Worksheet')`), not just that a throw occurred.
- `fjs/types/rational/module.f.js` - Added `proof.arithmetic.negate`, covering a positive and a negative numerator; confirmed the denominator is untouched.

## Decisions Made

- Confirmed every figure in the plan's primary-source table (read from Rev. Proc. 2024-40's rendered PDF pages) already matched the stored data in `fjs/tax/params/module.f.js` exactly — no stored value was changed or needed changing; only the missing proofs were added.
- Kept the message-content check for the $100k refusal narrowing-safe (no `instanceof`/cast on the caught `unknown` value): the message is built from a ternary (`typeof e === 'string' ? e : Array.isArray(e) ? e.join(' ') : ''`) so type narrowing happens within a single expression rather than relying on `asserts`-based control-flow narrowing across statements.
- Split Task 3 into two commits (3a for `fjs/tax/table`, 3b for `fjs/types/rational`) since it modifies two unrelated files for two unrelated reasons — keeps each commit's diff reviewable and revertable independently.

## Deviations from Plan

None - plan executed exactly as written. All figures matched; no stored value required changing; no architectural decisions needed.

## Issues Encountered

During development, an early attempt to mutate the stored `501050.00` figure to verify RED accidentally used a sed command that matched BOTH the stored value AND the newly-added proof's independent literal (both were identical text at that point), producing a false-negative "mutation was silently absorbed" result. Caught immediately by checking `git diff --stat` post-mutation (it showed the file completely unchanged after mutate+revert, when it should have shown a 1-line diff during the mutated state) — all subsequent mutations used line-numbered `sed` targeting only the stored-data line, never the proof's own literal, and each of the 9 mutations named in the plan's verification section was re-confirmed RED against the exact final committed state before reporting this summary as done.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `fjs/tax/params` and `fjs/tax/table` now have full coverage of every dollar figure a taxpayer's liability depends on, for all five filing statuses, independent of the code under test.
- Phase 10 (Tax Computation Worksheet, TAX-03) can build directly on `lookupTaxTable`'s $100,000 refusal boundary with confidence its message and its exact threshold are both proven, not merely present.
- No blockers.

## Self-Check: PASSED

All created/modified files confirmed present (`fjs/tax/params/module.f.js`, `fjs/tax/table/module.f.js`, `fjs/types/rational/module.f.js`, this SUMMARY). All 4 commit hashes (`557327f`, `c3c016f`, `da95817`, `ce64e23`) confirmed present in `git log`.

---
*Phase: 08-ty2025-parameters-and-the-tax-table-as-data*
*Completed: 2026-08-06*
