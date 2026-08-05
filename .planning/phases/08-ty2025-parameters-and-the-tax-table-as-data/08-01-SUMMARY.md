---
phase: 08-ty2025-parameters-and-the-tax-table-as-data
plan: 01
subsystem: data
tags: [tax-params, data, citations, irs, rev-proc, fjs]

# Dependency graph
requires: []
provides:
  - "fjs/tax/params/module.f.js: TY2025 standard deduction, aged/blind additional amounts, dependent standard-deduction cap, ordinary rate brackets (5 filing statuses), and capital-gains rate breakpoints, each parameter carrying its own citation object"
  - "taxParamsByYear: an open numeric-keyed lookup map (year -> TaxParamSet), ready for finance_tax_params to consume"
  - "individualFilingStatuses / allFilingStatuses: shared filing-status literal arrays for later plans to iterate instead of hand-typing"
affects: [08-02, 08-03, 08-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Per-parameter citation objects (revProc/section/effectiveDate) instead of one document-level citation string"
    - "Open numeric-keyed lookup map for tax-year data, mirroring finance_schema's dialectSchemas open-string-keyed-map lesson"
    - "Absent-ceiling-means-no-ceiling (ceiling: undefined on the last bracket), mirroring DOC-11's absent-is-not-zero discipline"

key-files:
  created: [fjs/tax/params/module.f.js]
  modified: []

key-decisions:
  - "Citations are per-parameter, not per-document: standard deduction cites Rev. Proc. 2025-32 §3.01 (the OBBBA revision); aged/blind additional, dependent cap, ordinary brackets, and capital-gains breakpoints cite Rev. Proc. 2024-40 alone, unmodified"
  - "ratePercent is stored as a plain number, not a decimal string — it is a rate, not a dollar amount, so AGENTS.md's money-string rule does not apply to it"
  - "Task 1 (data) and Task 2 (proof) were split into two atomic commits even though both touch the same file, per the plan's task structure — Task 1's commit intentionally omits the assert/centsFromString imports it doesn't yet use, to keep tsc clean at that commit"

patterns-established:
  - "A filing-status-keyed Record<FilingStatus, T> for any per-status TY2025 figure (ordinaryBrackets, capitalGainsBreakpoints) — later plans (08-02 Tax Table generator) can reuse allFilingStatuses/individualFilingStatuses directly"

requirements-completed: [TAX-01]

# Metrics
duration: 25min
completed: 2026-08-05
---

# Phase 8 Plan 1: TY2025 Parameters and the Tax Table as Data Summary

**TY2025 standard deduction, aged/blind additional, dependent cap, 5-status ordinary brackets, and capital-gains breakpoints stored as compiled-in data, each parameter citing its own exact Rev. Proc. number and section**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-08-05 (session start)
- **Completed:** 2026-08-05T12:27:40-07:00
- **Tasks:** 2 completed
- **Files modified:** 1 (created)

## Accomplishments
- Created `fjs/tax/params/module.f.js` storing every TY2025 tax parameter this phase requires, with a per-parameter `Citation` object (`revProc`, `section`, `effectiveDate`) rather than one shared citation string
- Standard deduction figures ($15,750/$31,500/$23,625) correctly cite Rev. Proc. 2025-32 §3.01 (the OBBBA revision) — never the original pre-OBBBA 2024-40 release
- Aged/blind additional, dependent cap, ordinary brackets (all 5 filing statuses including Estates & Trusts), and capital-gains breakpoints correctly cite Rev. Proc. 2024-40 alone, unmodified
- Five `proof` leaves verify: the OBBBA citation on the standard deduction, the 2024-40-only citation on everything else, that every dollar amount is a string that round-trips exactly through `centsFromString`/`centsToString`, that Estates & Trusts has exactly 4 brackets (10/24/35/37%), and that every status's bracket array is ascending with `ceiling: undefined` on (and only on) the last entry

## Task Commits

Each task was committed atomically:

1. **Task 1: TY2025 parameter data with per-parameter citations** - `81d3a58` (feat)
2. **Task 2: Proof — per-parameter citation correctness and the money-string invariant** - `b6ee981` (test)

_Note: Task 1's commit was written without the `assert`/`centsFromString` imports it doesn't yet use, so `tsc` stayed clean at that commit point; Task 2 re-adds them along with the `proof` export — this is a pure, no-deletion addition on top of Task 1 (`git diff --stat` between the two commits shows 119 insertions, 0 deletions)._

## Files Created/Modified
- `fjs/tax/params/module.f.js` - TY2025 parameter data module: `Citation`/`FilingStatus` typedefs, `individualFilingStatuses`/`allFilingStatuses`, `standardDeduction`, `agedOrBlindAdditional`, `dependentStandardDeductionCap`, `ordinaryBrackets`, `capitalGainsBreakpoints`, `taxParamsByYear`, and a 5-leaf `proof` export

## Decisions Made
- Split the plan's two tasks into two atomic commits on the same file: Task 1 commits the data only (no `proof`, no unused imports, `tsc` clean); Task 2 adds the imports and `proof` export. This matches the plan's task boundary while keeping every intermediate commit independently `tsc`-clean.
- Wrote each citation as its own object literal per entry (rather than one shared reference reused across entries) so the source text itself demonstrates per-parameter citation discipline and the plan's grep-based acceptance criteria (counting occurrences of `2025-32`/`2024-40`/`estatesAndTrusts`) are satisfied by the code, not just by comments.
- Typed `individualFilingStatuses` as `readonly IndividualFilingStatus[]` (a narrower 4-member union) distinct from `FilingStatus` (the 5-member union including `estatesAndTrusts`), so `standardDeduction[status]` indexing inside a `for (const status of individualFilingStatuses)` loop type-checks without a cast — `standardDeduction` has no `estatesAndTrusts` key and must never be indexable by one.

## Deviations from Plan

None - plan executed exactly as written. Field names, citation shapes, and all dollar figures match 08-01-PLAN.md's `<action>` literally.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Verification Output

```
$ npx tsc
(no output, exit 0)

$ npm test
...
✔ import("./fjs/tax/params/module.f.js").proof.standardDeductionCitesObbbaRevision() ...
✔ import("./fjs/tax/params/module.f.js").proof.unmodifiedParametersCite2024_40Only() ...
✔ import("./fjs/tax/params/module.f.js").proof.everyDollarAmountIsAStringAndRoundTrips() ...
✔ import("./fjs/tax/params/module.f.js").proof.estatesAndTrustsHasExactlyFourBrackets() ...
✔ import("./fjs/tax/params/module.f.js").proof.bracketsAreSortedAscendingWithOnlyTheLastCeilingUndefined() ...
...
ℹ tests 192
ℹ pass 192
ℹ fail 0

$ node --test 2>&1 | grep -c '^✔ import("./fjs/'
190   # 185 baseline + 5 new proof leaves

$ git status --porcelain
(empty)

$ git log --oneline -2
b6ee981 test(08-01): proof — per-parameter citation correctness and money-string invariant
81d3a58 feat(08-01): TY2025 tax parameter data with per-parameter citations
```

Acceptance-criteria greps on the final module:
- `grep -c "export const" fjs/tax/params/module.f.js` → 9 (>= 8)
- `grep -c "2025-32" fjs/tax/params/module.f.js` → 15 (>= 4)
- `grep -c "2024-40" fjs/tax/params/module.f.js` → 35 (>= 15)
- `grep -c "estatesAndTrusts" fjs/tax/params/module.f.js` → 11 (>= 3)

## Next Phase Readiness

`fjs/tax/params/module.f.js` exports everything 08-02 (the Tax Table module), 08-03, and 08-04 (`finance_tax_params` MCP tool) need to consume: `taxParamsByYear[2025]`, `ordinaryBrackets`, `capitalGainsBreakpoints`, and the shared `individualFilingStatuses`/`allFilingStatuses` arrays. No blockers.

---
*Phase: 08-ty2025-parameters-and-the-tax-table-as-data*
*Completed: 2026-08-05*

## Self-Check: PASSED

- FOUND: fjs/tax/params/module.f.js
- FOUND: .planning/phases/08-ty2025-parameters-and-the-tax-table-as-data/08-01-SUMMARY.md
- FOUND: commit 81d3a58 (feat(08-01): TY2025 tax parameter data with per-parameter citations)
- FOUND: commit b6ee981 (test(08-01): proof — per-parameter citation correctness and money-string invariant)
