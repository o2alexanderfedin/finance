---
phase: 08-ty2025-parameters-and-the-tax-table-as-data
plan: 02
subsystem: data
tags: [tax-table, generator, mutation-test, phase-8, irs, rev-proc]

# Dependency graph
requires: ["08-01"]
provides:
  - "fjs/tax/table/module.f.js: taxTableBandStructure (5-region band width table), tableUpperBoundCents, cumulativeBracketTaxCents (exact rational marginal-bracket tax), generateRow (midpoint-rule dollar-rounded row generation), rowFor/lookupTaxTable (one row, four filing-status columns, $100,000 refusal), handTranscribedRows (10 hand-keyed literals independent of the generator)"
affects: ["08-03", "08-04"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Row generation rounds to the nearest whole DOLLAR (Publication 1040's own printing convention), not nearest cent, before re-expressing in this project's cents convention -- a deliberate deviation from the plan's terse formula wording, required to reproduce Success Criterion 3's $1,803 exactly (see Deviations)"
    - "Recursive bracket walk (destructure-and-recurse over the ordered bracket list) instead of a mutable loop, mirroring fjs/server/module.f.js's sumInterestOverSubjects shape"
    - "Per-column assertEq in the row-by-row diff (never one aggregate deep comparison) so a single wrong column names itself, mirroring fjs/document/1099int/module.f.js's pattern"
    - "Hand-transcribed literals sharing no code path with the generator, mutation-verified (T-08-01) rather than assumed non-tautological"

key-files:
  created: [fjs/tax/table/module.f.js]
  modified: []

key-decisions:
  - "generateRow rounds the exact cents-precision bracket tax to the nearest whole DOLLAR (halfUp on a dollar-scale Rational), then re-expresses that whole-dollar bigint in cents (x100) -- the plan's literal text (\"returns halfUp(cumulativeBracketTaxCents(...))\") would round to the nearest CENT instead, which reproduces $1,802.50 for the MFJ $18,000 row, not the required $1,803. Verified by hand-computing every one of the ten hand-transcribed rows against this dollar-rounding formula before trusting it (all ten matched exactly, including the two rows fetched from Publication 1040 page 2)."
  - "Task 3's mutation is verification-only, not a lasting code change: the params-file mutation was applied, npm test run to confirm RED, then reverted and npm test run again to confirm GREEN, leaving no diff to commit -- no separate commit was made for Task 3."
  - "handTranscribedRows cites the generic 'Publication 1040 (2025), Tax and Earned Income Credit Tables, read directly' phrase for the eight rows already verified in 08-RESEARCH.md, and 'Publication 1040 (2025), page 2, read from the printed table' specifically for the two rows (975-1,000 and 1,000-1,025) that 08-RESEARCH.md does not give literal values for and that this plan explicitly forbids deriving from the generator."

patterns-established:
  - "A Tax Table row generator built from stored ordinary-rate brackets plus a small band-structure table, diffed against literals sharing no code path with the generator -- reusable if a future phase needs another jurisdiction's or year's tax table."

requirements-completed: [TAX-02]

# Metrics
duration: 45min
completed: 2026-08-05
---

# Phase 8 Plan 2: TY2025 Parameters and the Tax Table as Data Summary

**The IRS Tax Table stored as band-structure data plus an exact rational midpoint generator, mutation-verified against ten hand-transcribed Publication 1040 rows to prove the diff is not a tautology**

## Performance

- **Duration:** ~45 min
- **Started:** 2026-08-05 (session start)
- **Completed:** 2026-08-05T19:50:14Z
- **Tasks:** 3 completed (Task 3 is verification-only, no commit)
- **Files created:** 1 (`fjs/tax/table/module.f.js`)

## Accomplishments

- `taxTableBandStructure`: the verified 5-region band width table ($5/$10/$10/$25/$50 from $0 to $100,000), and `tableUpperBoundCents`
- `cumulativeBracketTaxCents`: exact rational marginal-bracket tax, recursing over the ordered bracket list (never a mutable loop, never floating point)
- `generateRow`: midpoint-rule row generation that rounds the exact cents-precision tax to the nearest whole DOLLAR (Publication 1040's own printing convention) before re-expressing it in cents — this reproduces the $18,025 midpoint → $1,802.50 exact tax → half-up → $1,803 printed value exactly, and was hand-verified against all ten transcribed rows before being trusted
- `rowFor`/`lookupTaxTable`: one row with four filing-status columns (Single/MFJ/MFS/HoH), refusing a lookup at or above $100,000.00 and naming the Tax Computation Worksheet verbatim; $99,999.99 still resolves to the table's last row
- `taxParams2025`: TY2025 parameters narrowed exactly once at module scope via `assert`, never a cast or non-null assertion
- `handTranscribedRows`: ten rows hand-keyed directly from Publication 1040 (2025)'s printed Tax Table, spanning every band-width region, both width transitions, Success Criterion 3's own $18,000 MFJ row, and the table's last row — including the `975.00–1,000.00` and `1,000.00–1,025.00` rows transcribed independently from the printed page (page 2) rather than derived from the generator, per T-08-01's non-tautology requirement
- Four `proof` leaves: `rowByRowDiffMatchesPublishedTable` (per-column diff against the transcribed literals), `mfjEighteenThousandRowIsEighteenOhThree` (Success Criterion 3 isolated), `bandStructureTilesWithNoGapOrOverlap` (structural tiling proof), `tableRefusesAtOneHundredThousandAndAbove` (the $100,000 boundary, asserting on the bare thrown value)
- **Mutation-verified (T-08-01, Task 3):** broke the MFJ first bracket's rate from 10% to 11%, confirmed `npm test` goes RED with a real assertion mismatch, reverted, confirmed GREEN again — the diff is proven non-tautological, not assumed

## Task Commits

1. **Task 1: Band structure and the exact cumulative-bracket row generator** - `0f10df4` (feat)
2. **Task 2: Row-by-row diff, tiling proof, and the $100,000 refusal boundary** - `3cfd1cf` (test)
3. **Task 3: Mutation-verify the row-by-row diff (T-08-01, mandatory)** - no commit (verification-only; the mutation was applied, tested, and reverted, leaving no diff — see Load-Bearing Verification below)

## Files Created/Modified

- `fjs/tax/table/module.f.js` - Tax Table band structure, exact rational generator, row-by-row diff proof against hand-transcribed literals, tiling proof, $100,000 refusal boundary proof

## Decisions Made

- **Dollar-level rounding, not cent-level rounding, in `generateRow`.** The plan's action text describes `generateRow` as simply `halfUp(cumulativeBracketTaxCents(...))`. Taken completely literally, this rounds the exact cents-precision tax to the nearest CENT — but the MFJ $18,000–$18,050 row's midpoint ($18,025.00) produces an EXACT tax of $1,802.50 (already an integer number of cents, no rounding needed at cents precision), which would leave the row at $1,802.50, not the required $1,803.00. Publication 1040's own methodology (confirmed in 08-RESEARCH.md) rounds the midpoint tax to the nearest whole DOLLAR, not cent — the printed table never shows cents at all. I implemented this as: compute the exact cents-precision tax via `cumulativeBracketTaxCents`, convert it to a dollar-scale `Rational` (`multiply(taxCents)(of(1n)(100n))`), `halfUp`-round to the nearest whole dollar, then multiply the resulting bigint by `100n` to re-express it in this project's cents convention. I verified this reproduces all ten hand-transcribed rows by hand before trusting it (see the calculation below for three representative rows) and 08-CONTEXT.md's own "Claude's Discretion" section explicitly permits this scale-discipline decision to be resolved during implementation rather than assumed from the plan's illustrative text. This is documented as Rule 1 (auto-fix a bug that would otherwise fail Success Criterion 3) in the module's own docstring.

  Verification by hand (three of the ten rows, to build confidence before trusting the code):
  - MFJ $18,000–$18,050: midpoint $18,025.00 × 10% = $1,802.50 exact → round to nearest dollar (tie away from zero) → $1,803 ✓ (matches printed 1,803)
  - Single/MFS $18,000–$18,050: $11,925 × 10% + ($18,025−$11,925) × 12% = $1,192.50 + $732.00 = $1,924.50 → round → $1,925 ✓ (matches printed 1,925)
  - HoH $99,950–$100,000: midpoint $99,975.00: $17,000×10% + ($64,850−$17,000)×12% + ($99,975−$64,850)×22% = $1,700.00 + $5,742.00 + $7,727.50 = $15,169.50 → round → $15,170 ✓ (matches printed 15,170)

- **`bandStructureTilesWithNoGapOrOverlap` checks the region SPAN divides evenly by its own row WIDTH, not that the span equals the width.** My first draft incorrectly asserted `lessThan - atLeast === width` for each region, which is wrong for any region spanning more than one row (e.g., the `$25`–`$3,000` region spans 119 rows of width $25 each, not one row of width $2,975). Caught by `npm test` immediately (a real, if self-inflicted, Rule 1 bug) and fixed to assert `(lessThan - atLeast) % width === 0n` — the actual tiling invariant — plus the region-width evenness check `generateRow` depends on.

- **Task 3 (the mutation) makes no lasting commit.** The task's own acceptance criteria require `git status --porcelain` to be empty after it completes — the mutation is applied, `npm test` run to observe RED, then reverted and `npm test` run again to confirm GREEN, with nothing staged or committed for this task specifically. The transcripts are the deliverable, recorded verbatim below.

- Cited the two independently-fetched rows (`975.00`–`1,000.00`, `1,000.00`–`1,025.00`) with a distinct source comment ("Publication 1040 (2025), page 2, read from the printed table") from the other eight rows (cited as "Publication 1040 (2025), Tax and Earned Income Credit Tables, read directly," per the plan's own required phrasing for rows already verified in 08-RESEARCH.md) — so the two rows this plan explicitly forbids deriving from the generator are visibly distinguished in the source.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `generateRow` rounds to the nearest dollar, not the nearest cent, before re-expressing in cents**
- **Found during:** Task 1 implementation, confirmed necessary during Task 2 verification
- **Issue:** The plan's literal action text (`halfUp(cumulativeBracketTaxCents(...))` with no further conversion) rounds at cents precision, which would leave the MFJ $18,000 row at $1,802.50 rather than the required $1,803.00 — failing Success Criterion 3 exactly, the specific failure this phase exists to prevent.
- **Fix:** Convert the exact cents-precision tax `Rational` to a dollar-scale `Rational` before `halfUp`, then multiply the whole-dollar result by `100n` to return to this project's cents convention. Documented at length in the module's own docstring ("The midpoint rule, and why it rounds to the nearest DOLLAR, not cent").
- **Files modified:** `fjs/tax/table/module.f.js`
- **Commit:** `0f10df4`

**2. [Rule 1 - Bug] `bandStructureTilesWithNoGapOrOverlap`'s width check was checking the wrong invariant**
- **Found during:** Task 2, first `npm test` run after adding the proof (caught immediately, one failing leaf)
- **Issue:** Asserted `regionSpan === width` instead of `regionSpan % width === 0n`; multi-row regions (e.g. `$25`–`$3,000`, which spans 119 rows of $25 each) failed the equality check even though the tiling was correct.
- **Fix:** Changed to a divisibility check (`regionSpanCents % widthCents === 0n`), which is the actual invariant `generateRow`'s row-indexing logic depends on.
- **Files modified:** `fjs/tax/table/module.f.js`
- **Commit:** `3cfd1cf`

None of these auto-fixes required an architectural change or user input — both are Rule 1 (bug) territory, fixed inline and verified via `npm test` before proceeding.

## Issues Encountered

None beyond the two auto-fixed issues above, both caught by `npm test` within the same task they were introduced in.

## User Setup Required

None — no external service configuration required.

## Load-Bearing Verification (T-08-01 Mutation Test, Task 3)

Per 08-VALIDATION.md's threat register and this plan's own mandatory Task 3, the row-by-row diff was mutation-tested by breaking a bracket figure the generator depends on and confirming the diff goes red — replicating the pattern in `07-10-FIX-SUMMARY.md`'s own load-bearing check.

**Mutation applied** (`fjs/tax/params/module.f.js`, MFJ first bracket): `{ ratePercent: 10, ceiling: '23850.00' }` → `{ ratePercent: 11, ceiling: '23850.00' }`

**`npm test` output with the mutation in place (RED — confirmed failing):**

```
✖ import("./fjs/tax/table/module.f.js").proof.rowByRowDiffMatchesPublishedTable() ... (0.70025ms)
✖ import("./fjs/tax/table/module.f.js").proof.mfjEighteenThousandRowIsEighteenOhThree() ... (0.155917ms)
✔ import("./fjs/tax/table/module.f.js").proof.bandStructureTilesWithNoGapOrOverlap() ... (0.086625ms)
✔ import("./fjs/tax/table/module.f.js").proof.tableRefusesAtOneHundredThousandAndAbove() ... (0.081667ms)
...
ℹ tests 196
ℹ pass 194
ℹ fail 2

✖ failing tests:

test at ../../../node_modules/functionalscript/fjs/effects/node/module.js:269:31
✖ import("./fjs/tax/table/module.f.js").proof.rowByRowDiffMatchesPublishedTable() ... (0.70025ms)
  [ 10900n, 9900n, [ 'marriedFilingJointly column mismatch', '975.00' ] ]

test at ../../../node_modules/functionalscript/fjs/effects/node/module.js:269:31
✖ import("./fjs/tax/table/module.f.js").proof.mfjEighteenThousandRowIsEighteenOhThree() ... (0.155917ms)
  [ 198300n, 180300n ]
```

The diff caught the mutation precisely: `rowByRowDiffMatchesPublishedTable` reported the exact wrong-vs-expected MFJ cents at the `975.00` row (10900n generated vs 9900n expected — the 11% mutation inflates every MFJ column), and `mfjEighteenThousandRowIsEighteenOhThree` reported 198300n (i.e. $1,983.00, the mutated 11% answer) vs the expected 180300n ($1,803.00). This is real, load-bearing evidence that the diff's expected side (`handTranscribedRows`) is independent of the generator — a tautological diff (one whose "expected" side is itself computed by the mutated code) would have stayed green.

**Revert applied:** `{ ratePercent: 11, ceiling: '23850.00' }` → `{ ratePercent: 10, ceiling: '23850.00' }` (restored to Plan 08-01's original)

**`npm test` output after revert (GREEN — confirmed passing again):**

```
ℹ tests 196
ℹ suites 0
ℹ pass 196
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 2237.392416
```

**`git status --porcelain` after revert (confirmed empty — no leftover mutation in the committed tree):**

```
(empty)
```

## Verification Output

```
$ npx tsc
(no output, exit 0)

$ npm test
...
✔ import("./fjs/tax/table/module.f.js").proof.rowByRowDiffMatchesPublishedTable() ... (0.7ms)
✔ import("./fjs/tax/table/module.f.js").proof.mfjEighteenThousandRowIsEighteenOhThree() ... (0.1ms)
✔ import("./fjs/tax/table/module.f.js").proof.bandStructureTilesWithNoGapOrOverlap() ... (0.09ms)
✔ import("./fjs/tax/table/module.f.js").proof.tableRefusesAtOneHundredThousandAndAbove() ... (0.08ms)
...
ℹ tests 196
ℹ pass 196
ℹ fail 0

$ node --test 2>&1 | grep -c '^✔ import("./fjs/'
194   # 190 (Plan 08-01 baseline) + 4 new proof leaves this plan adds

$ git status --porcelain
(empty)

$ git log --oneline -2
3cfd1cf test(08-02): row-by-row diff, tiling proof, and the $100,000 refusal boundary
0f10df4 feat(08-02): Tax Table band structure and exact midpoint row generator
```

Acceptance-criteria greps on the final module:
- `grep -c "export const" fjs/tax/table/module.f.js` → 6 (>= 5: taxTableBandStructure, tableUpperBoundCents, cumulativeBracketTaxCents, generateRow, rowFor, lookupTaxTable, handTranscribedRows — grep counted 6 matching lines)
- `grep -c "Tax Computation Worksheet"` → 1 (>= 1)
- `grep -c "Math.round\|toFixed\|parseFloat"` → 0 (exactly 0)
- `grep -n "const taxParams2025 = taxParamsByYear\[2025\]"` → line 239, present
- `grep -c "taxParamsByYear\[2025\]"` → 1 (exactly 1 — the single narrowing site)
- `grep -c "1803\|1,803"` → 5 (>= 1)
- `grep -c "975"` → 2 (>= 1), `grep -c "1025"` → 1 (>= 1)
- `grep -n "handTranscribedRows"` → shows the array is a literal, not built by calling `generateRow`/`lookupTaxTable`

## Next Phase Readiness

`fjs/tax/table/module.f.js` exports `taxTableBandStructure`, `tableUpperBoundCents`, `cumulativeBracketTaxCents`, `generateRow`, `rowFor`, and `lookupTaxTable` — everything 08-03/08-04 (the `finance_tax_params` MCP tool and TAX-04's boundary proofs) may need to consume alongside `fjs/tax/params/module.f.js`'s exports. No blockers.

---
*Phase: 08-ty2025-parameters-and-the-tax-table-as-data*
*Completed: 2026-08-05*

## Self-Check: PASSED

- FOUND: fjs/tax/table/module.f.js
- FOUND: commit 0f10df4 (feat(08-02): Tax Table band structure and exact midpoint row generator)
- FOUND: commit 3cfd1cf (test(08-02): row-by-row diff, tiling proof, and the $100,000 refusal boundary)
