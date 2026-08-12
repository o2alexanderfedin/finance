---
phase: 15-realism-polish-and-upstream
plan: 05
subsystem: tax-computation
tags: [functionalscript, capital-loss-carryover, schedule-d, form1040, year-genericity, mutation-testing]

# Dependency graph
requires:
  - phase: 15
    plan: 02
    provides: "fjs/tax/carryover/module.f.js's capitalLossCarryoverWorksheet and fjs/document/prior_year_capital_loss/module.f.js's vnd.fjs.prior_year_capital_loss dialect — the worksheet and document dialect this plan wires in"
provides:
  - "fjs/schedule/d/module.f.js — ScheduleDInputs widened with an optional priorYearCapitalLossCarryover; lines 6/14 driven by the worksheet when present, a legitimate 0n when absent, with provenance Sources attached only when nonzero"
  - "fjs/form1040/core/module.f.js — Form1040Inputs widened with capitalLossCarryoverForms; form1040IncomeLines threads it into scheduleD; a synthetic second TaxParamSet proving year-genericity structurally"
affects: [phase-16]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Optional Stored<T> field expressed at the type level for 'absence is a legitimate zero' (ScheduleDInputs.priorYearCapitalLossCarryover?), distinct from the option()-wrapped-at-rest convention used inside a document dialect's own schema"
    - "exactOptionalPropertyTypes-safe conditional spread for passing an optional field derived from a possibly-undefined value: `...(x === undefined ? {} : { k: x })`, never a bare `k: x` when x may be undefined"
    - "Bracket-aware scripted call-site widening: a small Node script that counts N balanced top-level parenthesized groups after a curried function's identifier and appends the (N+1)th, rather than a line-oriented sed/perl pass, for a widening whose call sites vary in argument content (arrays with real fixture data vs. empty arrays)"

key-files:
  created: []
  modified:
    - fjs/schedule/d/module.f.js
    - fjs/form1040/core/module.f.js
    - demo/lib/fixtures.js
    - demo/steps/05-exactness.js
    - .planning/REQUIREMENTS.md

key-decisions:
  - "priorYearCapitalLossCarryover is OPTIONAL on ScheduleDInputs (Stored<PriorYearCapitalLoss>?), not option()-wrapped inside a document — the absence-is-zero rule lives at the caller's cardinality (never construct the field), exactly mirroring 15-02's own 'absence is handled by the caller never constructing the document' decision one layer up"
  - "capitalLossCarryoverForms is a LIST on Form1040Inputs, matching the file's own established convention (itemizedDeductionForms/medicalExpenseForms), even though the underlying document is a single running record per taxpayer per prior year — flattened to Schedule D's optional field by taking the first entry"
  - "The full-return reachability proof compares against an INDEPENDENT scheduleD(...) call fed the SAME carryover document, asserting both independentScheduleD.line6 === -600000n (the arithmetic, already proven in Task 1/Plan 15-02) AND outcome.scheduleD16Cents === independentScheduleD.line16 (the wiring) — Form1040IncomeLines exposes no scheduleD6Cents field, so the wiring check runs through line16, which line6 feeds transitively; a dropped capitalLossCarryoverForms argument makes the two sides differ by exactly $6,000.00, which is what the mutation test below confirmed"
  - "The year-genericity proof's synthetic TaxParamSet is built by spreading taxParams2025 and overriding ONLY standardDeduction (doubled, re-cited kind:'code' with a self-identifying 'SYNTHETIC' section string) — not a second hand-authored complete parameter set — since the proof's purpose is to show form1040IncomeLines dispatches on its argument, not to author a second real tax year"
  - "TAX-17 marked complete in REQUIREMENTS.md (checkbox and traceability-table status) — the end-to-end carryover path genuinely works: absence is a legitimate zero, presence drives the worksheet through the full form1040IncomeLines entry point, and year-genericity is proven structurally, closing all three criteria this requirement names"

requirements-completed: [TAX-17]

# Metrics
duration: 55min
completed: 2026-08-11
---

# Phase 15 Plan 05: Wiring the Capital Loss Carryover into Schedule D and Form 1040 (TAX-17) Summary

**The Capital Loss Carryover Worksheet built in Plan 15-02 is now load-bearing: Schedule D lines 6/14 compute through it when a prior-year carryover document is stored, are a legitimate zero when it is absent, and the whole path is reachable through `form1040IncomeLines`'s real entry point — plus a synthetic second `TaxParamSet` proves year-genericity without transcribing a second real IRS year.**

## Performance

- **Duration:** ~55 min
- **Tasks:** 2 completed, both exactly as planned
- **Files modified:** 5 (2 production modules, 2 demo fixtures, 1 requirements doc)

## Accomplishments

- `ScheduleDInputs` widened with an optional `priorYearCapitalLossCarryover: Stored<PriorYearCapitalLoss>`; lines 6 and 14 now call `capitalLossCarryoverWorksheet` when the document is present (entered as negatives, per the printed form's parenthesized entry boxes) and stay a legitimate `0n` when it is absent — the Trap-4 control (absent carryover + brokerage sales present → no refusal) is proven and mutation-verified.
- Provenance `Source`s attached to lines 6/14 only when the worksheet output is nonzero, citing the carryover document's own hash and a `priorYearCapitalLossCarryoverWorksheet(shortTerm|longTerm)` box path.
- `Form1040Inputs` widened with `capitalLossCarryoverForms` (a list, matching the file's own established convention); `inputsOf` widened by one trailing curried parameter; all 63 existing call sites fixed via a bracket-aware Node script that counts balanced parenthesized groups rather than a line-oriented sed pass, since call sites vary between real fixture data and empty arrays.
- `form1040IncomeLines` flattens the list to Schedule D's optional field (first entry, `undefined` otherwise) via an `exactOptionalPropertyTypes`-safe conditional spread.
- New proof: a full return (brokerage sales, `capitalGainsOrLosses` declared, one stored Worked-Example-B carryover document) reaches Schedule D's carryover-driven `line6 === -600000n` through `form1040IncomeLines` at the top-level entry point — never through a direct `scheduleD(...)` call — closing threats T-15-09/T-15-10.
- New proof: a second, clearly-labeled-synthetic `TaxParamSet` (never added to `taxParamsByYear`) doubling TY2025's standard-deduction figures drives line 12e with its own doubled figures, proving `form1040IncomeLines` genuinely dispatches on its `taxParamSet` argument.
- TAX-17 marked complete in REQUIREMENTS.md — the end-to-end path (absence-is-zero, presence-drives-the-worksheet, year-genericity) genuinely works.

## Task Commits

Each task was committed atomically:

1. **Task 1: Widen ScheduleDInputs — the worksheet drives lines 6 and 14** - `70b08e3` (feat)
2. **Task 2: Thread the carryover through Form1040Inputs; prove reachability and year-genericity** - `ab4de1c` (feat)

## Files Created/Modified

- `fjs/schedule/d/module.f.js` - `ScheduleDInputs` widened; lines 6/14 worksheet-driven with provenance; two new proofs (Trap-4 control, Worked Example B end-to-end)
- `fjs/form1040/core/module.f.js` - `Form1040Inputs`/`inputsOf` widened (63 call sites fixed); `form1040IncomeLines` threads the carryover into `scheduleD`; two new proofs (full-return reachability, year-genericity via a synthetic `TaxParamSet`)
- `demo/lib/fixtures.js` - `inputs` fixture gained `capitalLossCarryoverForms: []`, keeping the demo app's `tsc` clean under the widened `Form1040Inputs`
- `demo/steps/05-exactness.js` - the Exactness step's `withElection` literal gained the same empty field
- `.planning/REQUIREMENTS.md` - TAX-17 marked complete (checkbox and traceability table)

## Decisions Made

See frontmatter `key-decisions` above for the four load-bearing decisions (optional-field cardinality, list-widening convention, the wiring-check mechanism given no exposed `scheduleD6Cents` field, and the synthetic-TaxParamSet construction).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed two demo files' `tsc` errors caused by the `Form1040Inputs` widening**
- **Found during:** Task 2
- **Issue:** `demo/lib/fixtures.js`'s `inputs` fixture and `demo/steps/05-exactness.js`'s `withElection` literal both construct `Form1040Inputs`-shaped object literals directly (not through `inputsOf`), and the widened typedef made both fail `npx tsc --noEmit` with `TS2741: Property 'capitalLossCarryoverForms' is missing`.
- **Fix:** Added `capitalLossCarryoverForms: []` to both literals, mirroring the existing empty-array convention every other list field there already uses.
- **Files modified:** `demo/lib/fixtures.js`, `demo/steps/05-exactness.js`
- **Verification:** `npx tsc --noEmit` clean across the whole repository (the demo tree is inside `tsconfig.json`'s scope, so these were a genuine build-blocking gap, not a cosmetic one).
- **Committed in:** `ab4de1c` (Task 2's own commit — found and fixed during the same task, before any commit)

**2. [Rule 1 - Bug] The `requirements mark-complete` SDK verb updated the checkbox but not the traceability table's status column**
- **Found during:** state-update step
- **Issue:** `gsd-sdk query requirements.mark-complete TAX-17` flipped the `- [ ]` checkbox to `- [x]` but left the coverage table's `TAX-17 | T3 | Phase 15 ... | Week 5 | Pending` row unchanged, inconsistent with every other completed requirement's `Complete` status in the same table.
- **Fix:** Manually corrected the table row's status from `Pending` to `Complete`.
- **Files modified:** `.planning/REQUIREMENTS.md`
- **Verification:** `grep -n "TAX-17" .planning/REQUIREMENTS.md` shows the checkbox and the table row now agree.
- **Committed in:** the final metadata commit (not a task commit — this is a documentation-accuracy fix, not application code).

---

**Total deviations:** 2 auto-fixed (1 blocking tsc fix outside the plan's own `files_modified` list but required by the mechanical widening it specified; 1 bug fix in a state-update tool's own output).
**Impact on plan:** Neither touches the arithmetic or wiring this plan exists to deliver. No scope creep.

## Issues Encountered

None beyond the two deviations above. Both new proofs (the full-return reachability check and the year-genericity check) were mutation-verified before this summary was written, per AGENTS.md's "a proof is not known to work until you have watched it fail":

- **Task 1 (Schedule D):** forced `line6 = 0n` unconditionally (as if the carryover were never wired) — reddened exactly `presentValidCarryoverDrivesLinesSixAndFourteen`, no other leaf. Reverted byte-identical.
- **Task 2 (reachability):** changed `priorYearCapitalLossCarryover` to always evaluate to `undefined` (via a semantically-equivalent form that keeps the `capitalLossCarryoverForms` binding live, per AGENTS.md's "the mutation that deletes the last use of a binding does not compile") — reddened exactly `carryoverReachesScheduleDThroughTheFullIncomeLinesEntryPoint`, no other leaf. Reverted byte-identical.
- **Task 2 (year-genericity):** simulated a hypothetical "ignores its `taxParamSet` argument" defect by pointing `deductionChoice`'s call inside `form1040IncomeLines` at the test-only `taxParams2025` constant instead of the function's own `taxParamSet` parameter (wrapped in `assertNotNullish` so the mutation still compiles under `noUncheckedIndexedAccess` — the first attempt, a bare reference, failed to typecheck exactly as AGENTS.md's own "mutation does not compile" trap predicts) — reddened exactly `syntheticSecondTaxParamSetDrivesLineTwelveEWithItsOwnFigures`, no other leaf. Reverted byte-identical.

No defect of the kind AGENTS.md warns "every plan in wave 1" shipped was found in this plan's own new code — both mutations bit exactly the predicted single leaf, with no equivalent-mutant surprise and no wider blast radius.

**De-duplicated project-local proof count:** 885 (end of Plan 15-04) → **889** (4 new leaves: 2 in `fjs/schedule/d`, 2 in `fjs/form1040/core`), confirmed via `node --test 2>&1 | grep '^✔ import("./fjs/' | sed 's/ ([0-9.]*ms)$//' | sort -u | wc -l`.

`npm test` (the full `tsc && node --test` gate): **6260/6260 passing, 0 failures, 0 cancelled.**

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- TAX-17 is fully closed: all three criteria the requirement names (carries into the current year's Schedule D, absence is a legitimate zero, and multi-year support proven generically) are delivered and mutation-verified.
- The carryover boundary this plan closes was the last piece Plan 15-02 deliberately left open ("neither is wired into Schedule D — that remains Plan 15-05's job"); nothing further is deferred on this requirement.
- `fjs/schedule/d/module.f.js`'s own docstring's "Prior-year carryover" section now states the boundary is CLOSED, citing this plan, so a future reader does not need to chase two files to learn the seam is gone.
- Remaining Phase 15 plans (PROV-06, MCP-09, DOC-16) are independent of this plan's work and unaffected by it.

---
*Phase: 15-realism-polish-and-upstream*
*Completed: 2026-08-11*

## Self-Check: PASSED

All claimed files exist on disk and both task commits are present in `git log --oneline --all`:

- `fjs/schedule/d/module.f.js` — FOUND
- `fjs/form1040/core/module.f.js` — FOUND
- `demo/lib/fixtures.js` — FOUND
- `demo/steps/05-exactness.js` — FOUND
- `.planning/REQUIREMENTS.md` — FOUND
- `.planning/phases/15-realism-polish-and-upstream/15-05-SUMMARY.md` — FOUND
- `70b08e3` (Task 1) — FOUND
- `ab4de1c` (Task 2) — FOUND

`npm test`: 6260/6260 passing, 0 failures. De-duplicated project-local proof count: 889 (up from 885 at end of Plan 15-04, +4 matching this plan's own new leaves).
