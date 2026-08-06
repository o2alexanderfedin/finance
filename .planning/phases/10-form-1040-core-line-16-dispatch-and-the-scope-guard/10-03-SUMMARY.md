---
phase: 10-form-1040-core-line-16-dispatch-and-the-scope-guard
plan: 03
subsystem: tax
tags: [tax-computation-worksheet, level-3-dispatch, seam, tax-table, qualifying-surviving-spouse, phase-10]

# Dependency graph
requires:
  - phase: 08-tax-parameters-and-the-tax-table
    provides: "cumulativeBracketTaxCents, lookupTaxTable, tableUpperBoundCents, the $100,000 refusal and its content-asserting proof"
  - phase: 10-01
    provides: "qualifyingSurvivingSpouse as a real IndividualFilingStatus, individualFilingStatuses, ordinaryBrackets.qualifyingSurvivingSpouse"
provides:
  - "taxComputationWorksheet — TAX-03's worksheet, gated BELOW $100,000, cent-exact, reusing the existing bracket walk"
  - "handTranscribedTaxComputationWorksheetRows — all 20 printed rows from i1040gi p80, the independent side of the diff"
  - "taxTableColumnFor — the single place QSS is mapped to the printed marriedFilingJointly column"
  - "baseTaxForAmount — the level-3 lookup returning { method, cents }, not only cents"
  - "Line16BaseMethod and BaseTaxResult typedefs"
affects: [10-06-qdcgt-worksheet, 10-08-line-16-dispatcher, 14-acceptance-against-a-filed-return]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A level-3 lookup returns WHICH method produced a number, not only the number"
    - "Two mirrored refusals sharing one boundary constant: no income at which both answer, none at which neither does"
    - "A twenty-row diff whose expected side is arithmetic over hand-transcribed printed constants, sharing no code path with the code under test"

key-files:
  created: []
  modified:
    - fjs/tax/table/module.f.js

key-decisions:
  - "The Tax Computation Worksheet rounds to the nearest CENT, never whole dollars — a worksheet line is a line boundary (EXACT-04); whole dollars are the p23 election applied once over the whole report"
  - "taxComputationWorksheet reuses cumulativeBracketTaxCents rather than implementing the printed rate-minus-subtraction form, because the twenty printed rows were PROVEN (not assumed) to be that same bracket walk"
  - "taxTableColumnFor is a Record over the whole IndividualFilingStatus union, so a sixth status fails tsc at the one place that must decide its column"
  - "STATE.md / ROADMAP.md / REQUIREMENTS.md deliberately NOT touched — three executors share this checkout with disjoint files_modified sets, and those three files are outside mine"

patterns-established:
  - "Pattern 1: a boundary is pinned by a matched pair of refusals plus a control leg on each side, with the thrown value's CONTENT asserted, never merely that it threw"
  - "Pattern 2: the method tag makes an 'explicit dispatch' requirement testable — a cents-only proof cannot distinguish the right answer by the right route from the right answer by the wrong one"

requirements-completed: [TAX-03]

# Metrics
duration: 55min
completed: 2026-08-06
---

# Phase 10 Plan 03: Tax Computation Worksheet + tagged level-3 lookup Summary

**All twenty printed Tax Computation Worksheet rows PROVEN — not assumed — to be the bracket walk `fjs/tax/table` already shipped, plus a `baseTaxForAmount` that returns which of the two methods produced its cents and pins the $5.00 discontinuity at $100,000.**

## Performance

- **Duration:** ~55 min
- **Tasks:** 2 of 2
- **Files modified:** 1 (`fjs/tax/table/module.f.js`)
- **My module's proof leaves:** **5 → 12** (+7; the plan's verification gate asked for at least +6)
- **Repo-wide at start:** 334 project-local leaves, `npm test` 336/336, 0 fail

## Task Commits

1. **Task 1: taxComputationWorksheet, gated, and diffed against all twenty printed rows** — `b8eb367` (feat)
2. **Task 2: baseTaxForAmount — the level-3 lookup that says which method it used** — `1a06f23` (feat)

## The plan's central claim: VERIFIED

The plan's load-bearing claim was that all twenty TCW rows are `rate × income − subtraction` and every
subtraction constant reproduces `cumulativeBracketTaxCents` exactly.

**Checked twice, independently, before a line was written.** Every one of the twenty printed
subtraction constants was hand-recomputed as `rate × bracketLowerBound − taxAt(bracketLowerBound)`
from the stored Rev. Proc. 2024-40 brackets. All twenty agree. Then
`taxComputationWorksheetReproducesAllTwentyPrintedRows` re-proves it in code at **40 probe points**
(two per row: the row's own lower bound, and either `lessThan − $1` or, for a section's open-ended
last row, `atLeast + $100,000`), with the expected side computed **only** from the hand-transcribed
printed constants.

Nothing disagreed, so 10-CONTEXT.md Decision 3's stop-and-report was not triggered.

Spot values, all confirmed green: single at $100,000.00 → `1691400n`; MFJ at $700,000.00 →
`18409450n` (the half-dollar intact); HoH at $626,350.00 → `18703150n`.

## Proof leaves added (7)

| Leaf | What it pins |
|---|---|
| `taxComputationWorksheetReproducesAllTwentyPrintedRows` | 20 rows × 2 probes against hand-transcribed p80 constants |
| `taxComputationWorksheetKeepsCentsAndNeverRoundsToWholeDollars` | MFJ $184,094.50 and HoH $187,031.50 — the two leaves that move if assumption A2 is wrong |
| `taxComputationWorksheetRefusesBelowOneHundredThousand` | the refusal's CONTENT names `100,000` and `Tax Table` |
| `taxComputationWorksheetResolvesAtExactlyOneHundredThousand` | the control leg: $16,914.00 at exactly the bound |
| `seamAtOneHundredThousandChangesBothTheNumberAndTheMethod` | $16,909/taxTable vs $16,914/taxComputationWorksheet, and the $5.00 gap |
| `qualifyingSurvivingSpouseReadsTheMarriedFilingJointlyColumn` | the IRS's own printed Example ($25,300 MFJ → $2,562) read through QSS |
| `everyIndividualFilingStatusMapsToAPrintedColumn` | every status maps to a column the printed table actually has and a `Row` really carries |

## Mutation transcripts

Every mutation was applied ONE AT A TIME to the real tracked file, typechecked (`tsc` exit 0 in all
seven cases — **no mutation failed to compile**), run, and reverted. `git diff --numstat` is quoted
verbatim for each.

### Task 1, Mutation 1 — round to whole dollars instead of cents — **RED, as predicted**

```
-    return halfUp(cumulativeBracketTaxCents(brackets)(incomeCents))
+    return halfUp(multiply(cumulativeBracketTaxCents(brackets)(incomeCents))(of(1n)(100n))) * 100n
numstat: 1	1	fjs/tax/table/module.f.js      TSC EXIT=0
```
```
ℹ tests 340   ℹ pass 338   ℹ fail 2
✖ import("./fjs/tax/table/module.f.js").proof.taxComputationWorksheetReproducesAllTwentyPrintedRows()
  [ 1765100n, 1765078n, [ 'printed worksheet row mismatch', 'single', '100000.00', '103349.00' ] ]
✖ import("./fjs/tax/table/module.f.js").proof.taxComputationWorksheetKeepsCentsAndNeverRoundsToWholeDollars()
  [ 18409500n, 18409450n ]
```
The cents-carrying leaf fired on exactly the value the plan named: $184,095.00 where $184,094.50 is
correct. Assumption A2's consequence **is** asserted somewhere.

*(Note on the wave-1 hazard: this mutation reuses `multiply` and `of`, both already imported AND
already used by `roundToNearestDollarThenBackToCents`/`cumulativeBracketTaxCents`, so no
`noUnusedLocals` TS6192/TS6133 fired. The wave-1 defect did not recur here.)*

### Task 1, Mutation 2 — `>=` → `>` on the gate — **RED, and it is the refusal firing**

```
-        incomeCents >= tableUpperBoundCents,
+        incomeCents > tableUpperBoundCents,
numstat: 1	1	fjs/tax/table/module.f.js      TSC EXIT=0
```
```
ℹ tests 340   ℹ pass 338   ℹ fail 2
✖ ...proof.taxComputationWorksheetReproducesAllTwentyPrintedRows()
  [ 'income of 100000.00 is below $100,000', 'use the Tax Table' ]
✖ ...proof.taxComputationWorksheetResolvesAtExactlyOneHundredThousand()
  [ 'income of 100000.00 is below $100,000', 'use the Tax Table' ]
```
The control leg turned red **because the refusal fired** — the thrown bare array is the payload, not
a wrong number. Exactly the prediction.

### Task 1, Mutation 3 — stored HoH 32% ceiling `250500.00` → `250525.00` in `fjs/tax/params` — **RED on the HoH rows**

```
-            { ratePercent: 32, ceiling: '250500.00' },
+            { ratePercent: 32, ceiling: '250525.00' },
numstat: 1	1	fjs/tax/params/module.f.js      TSC EXIT=0
```
(edited by line number: this literal exists twice in the file — line 253 is the stored datum, line
512 is the proof's own hand-typed expectation. Only the datum was touched, hence 1/1.)
```
ℹ fail 3
✖ import("./fjs/tax/params/module.f.js").proof.everyOrdinaryBracketMatchesRevProc202440Tables1Through5()
  [ '250525.00', '250500.00', [ 'bracket ceiling mismatch', 'headOfHousehold', 4 ] ]
✖ import("./fjs/tax/table/module.f.js").proof.taxComputationWorksheetReproducesAllTwentyPrintedRows()
  [ 18703040n, 18703115n, [ 'printed worksheet row mismatch', 'headOfHousehold', '250500.00', '626349.00' ] ]
✖ import("./fjs/tax/table/module.f.js").proof.taxComputationWorksheetKeepsCentsAndNeverRoundsToWholeDollars()
  [ 18703150n → 18703075n ]
```
This is the one that matters: the twenty-row diff is checking the **stored brackets**, not itself.
The plausible copy-paste from single/MFS is caught, and it names `headOfHousehold` in the payload.

### Task 2, Mutation 1 — `taxTableColumnFor.qualifyingSurvivingSpouse` → `'single'` — **RED on exactly one leaf**

```
-    qualifyingSurvivingSpouse: 'marriedFilingJointly',
+    qualifyingSurvivingSpouse: 'single',
numstat: 1	1	fjs/tax/table/module.f.js      TSC EXIT=0
```
```
✖ import("./fjs/tax/table/module.f.js").proof.qualifyingSurvivingSpouseReadsTheMarriedFilingJointlyColumn()
  [ 'single', 'marriedFilingJointly' ]
```
**The plan asked whether any other leaf turned red. Answer: none of mine — the mapping has exactly
one consumer today, as predicted.** The same run also showed four red leaves in
`fjs/tax/deduction/module.f.js`; those are **not mine**. Proven, not assumed:
`fjs/tax/deduction/module.f.js` imports only `functionalscript/fjs/asserts`, `../../exact` and
`../params` — nothing from `fjs/tax/table` — and a control run with my mutation fully reverted still
showed that module red (with a *different* leaf, because the sibling had moved on). See
"Concurrency" below.

### Task 2, Mutation 2 — `<` → `<=` in `baseTaxForAmount` — **RED, but NOT the way the plan predicted (plan defect, see below)**

```
-    if (incomeCents < tableUpperBoundCents) {
+    if (incomeCents <= tableUpperBoundCents) {
numstat: 1	1	fjs/tax/table/module.f.js      TSC EXIT=0
```
```
✖ import("./fjs/tax/table/module.f.js").proof.seamAtOneHundredThousandChangesBothTheNumberAndTheMethod()
  [ 'income of 100000.00 is $100,000 or more', 'use the Tax Computation Worksheet' ]
```
Red on the `$100,000.00` side as required — but **neither** the `cents` nor the `method` assertion
fired. `lookupTaxTable`'s own refusal throws first. See plan defect 1.

### Task 2, Mutation 3 — swap the two arms' method tags — **RED, and it is the METHOD assertion firing**

```
-        return { method: 'taxTable', cents: lookupTaxTable(taxParamSet)(incomeCents)[column] }
+        return { method: 'taxComputationWorksheet', cents: lookupTaxTable(taxParamSet)(incomeCents)[column] }
-        method: 'taxComputationWorksheet',
+        method: 'taxTable',
numstat: 2	2	fjs/tax/table/module.f.js      TSC EXIT=0
```
```
✖ ...proof.seamAtOneHundredThousandChangesBothTheNumberAndTheMethod()
  [ 'taxComputationWorksheet', 'taxTable', 'expected the Tax Table one cent below the bound' ]
✖ ...proof.qualifyingSurvivingSpouseReadsTheMarriedFilingJointlyColumn()
  [ 'taxComputationWorksheet', 'taxTable' ]
```
The `cents` are untouched and correct in both arms; only the tags moved, and the suite still went
red. **This is the evidence that the method tag is genuinely asserted** — the thing mutation 2 was
supposed to establish and could not.

### Task 2, Mutation 3b (added by me) — swap ONLY the at-or-above arm's tag — **RED on the at-bound method assertion**

Mutation 3 short-circuits on the *below*-side assertion, so within one leaf it cannot show the
*at-bound* side is also asserted. One extra one-line variant closes that:

```
-        method: 'taxComputationWorksheet',
+        method: 'taxTable',
numstat: 1	1	fjs/tax/table/module.f.js      TSC EXIT=0
```
```
✖ ...proof.seamAtOneHundredThousandChangesBothTheNumberAndTheMethod()
  [ 'taxTable', 'taxComputationWorksheet', 'expected the Tax Computation Worksheet at exactly the bound' ]
```
Both sides of the seam's **method** tag are now independently demonstrated, and both sides' **cents**
by mutations 1–2 of Task 1. The seam is pinned in both dimensions on both sides.

## Plan defects found

**1. Task 2 mutation 2 cannot answer the question the plan asks of it.** The plan says: "Record which
assertion fired: if only the `cents` assertion fires and not the `method` one, the method tag is not
actually being asserted and the leaf must be strengthened." In fact **neither** fires. Flipping `<`
to `<=` routes $100,000.00 into `lookupTaxTable`, which has refused at or above $100,000 since Phase
8 — so the leaf dies on that refusal before reaching any assertion of its own. This is benign (the
seam still turns red, and it is arguably *stronger* evidence: the two-sided gate design means the
seam cannot be shifted by one cent in either direction without something throwing), but the
mutation's stated diagnostic purpose is unreachable. **Mutation 3, plus the 3b variant I added, are
what actually establish the method tag is asserted.** A future plan wanting mutation 2's diagnostic
should mutate the tag, not the comparison.

**2. Task 2 mutation 3 is a 2-insertion/2-deletion edit,** not the 1/1 the plan mandates elsewhere.
Swapping two tags is inherently two lines. Recorded verbatim above; no ambiguity results because the
`cents` expressions are untouched.

**3. `10-CONTEXT.md`'s "Primary sources" list still reads "p124 Tax Computation Worksheet."** This
plan carries the correction (p80; p124 is the alphabetical index) and it is now stated in the code's
own docstring and on `handTranscribedTaxComputationWorksheetRows`, but the CONTEXT line was not
updated and will mislead the next reader. Not fixed by me — it is outside my `files_modified` set
and three executors share this checkout.

No mutation failed to typecheck, so the wave-1 class of defect (a mutation the plan claims compiles
but does not) did not recur.

## Concurrency: what my numbers do and do not mean

Two siblings (10-04, 10-05) were executing in this same checkout throughout. Repo-wide totals moved
under me constantly — 336 → 340 → 364 → 395 tests across the session — and at various moments
`fjs/tax/deduction` and `fjs/return/profile` were red from siblings' in-flight work (10-05 appears to
be running deliberate RED-stub commits).

Per AGENTS.md's "Concurrent work invalidates a mutation observation", **every mutation verdict above
is scoped to `^✖ import("./fjs/tax/table` (and, for Task 1 mutation 3, `fjs/tax/params`)** — a scope
no sibling can reach. Where a sibling's red appeared alongside mine I proved independence rather than
assuming it (import-graph check plus a control run with my mutation reverted).

Final state of MY module, confirmed both in the live tree and in a `tar --exclude=.git` snapshot with
the sibling's untracked in-flight module removed:

```
TSC EXIT=0
my leaves green: 12
my leaves red:   0
```

Repo-wide `npm test` is **not** green at this instant, and that is expected: the only failing module
in the snapshot is `fjs/tax/deduction`, mid-TDD-RED under 10-05. Nothing of mine imports it, and
nothing it imports is mine.

## Deviations from Plan

**1. [Rule 3 - Blocking] Task-level `tdd="true"` executed as feat-then-mutate, not as a separate RED commit**

- **Found during:** Task 1, before the first commit
- **Issue:** A RED commit here means committing a knowingly-broken `fjs/tax/table` to a branch two
  other executors are running `npm test` against. AGENTS.md's new "Concurrent work invalidates a
  mutation observation" section says a red you did not cause is *worse* than a missed failure because
  it gets recorded as evidence — so a deliberate RED commit would have poisoned both siblings' active
  mutation transcripts. (10-05 evidently made the other choice, which is exactly what put
  `fjs/tax/deduction` red in three of my runs.)
- **Fix:** One `feat` commit per task, with the falsification supplied by the plan's own mandated
  mutations — six of them, plus one I added — every one run against the real tracked file, confirmed
  RED, and reverted. That is AGENTS.md's own "watched it fail" standard, and it is what the plan's
  acceptance criteria measure.
- **Files modified:** none beyond the plan's own `fjs/tax/table/module.f.js`
- **Verification:** seven mutation transcripts above, all RED, all with `TSC EXIT=0`

**2. [Rule 3 - Blocking] STATE.md / ROADMAP.md / REQUIREMENTS.md not updated**

- **Found during:** post-task state update
- **Issue:** Three executors share this checkout with deliberately disjoint `files_modified` sets, and
  the orchestrator's instruction is to stage only my own files by explicit path. `state.advance-plan`
  run concurrently by three agents would corrupt the plan counter, and all three would collide on the
  same lines of the same three files.
- **Fix:** Left to the orchestrator to do once, after the wave. `10-03-SUMMARY.md` is uniquely named
  and safe to write, so it was.
- **Files modified:** none

---

**Total deviations:** 2 (both Rule 3, both forced by the shared-checkout concurrency constraint)
**Impact on plan:** No scope change. Both tasks shipped exactly as written; only the *ceremony*
around them moved.

## Issues Encountered

- **Sibling-caused red, twice, and it was nearly recorded as evidence.** Task 2 mutation 1's run
  showed five red leaves; four were 10-05's. The import-graph check plus a mutation-reverted control
  run separated them. This is precisely the failure AGENTS.md's new section warns about, and it
  happened on the first mutation after that section was written.
- **`npm test` totals are unusable as a gate here.** They moved 336 → 395 during a 55-minute session
  from work that is not mine. Module-scoped leaf counts (5 → 12) are the only stable measure.

## Next Phase Readiness

Ready for **10-06 (QDCGT)** and **10-08 (the dispatcher)**:

- `baseTaxForAmount(params)(status)(cents)` is the level-3 arm both need, and it returns the method
  tag both need. QDCGT lines 22 and 24 must call it **separately with different amounts** — that is
  stated in its docstring, and one execution legitimately using different methods for the two lines
  is a supported outcome, not a bug.
- The $100,000 seam is pinned in cents and method on both sides, which is what makes 10-06's $1–$12
  regression pair reproducible: the discrepancy exists *because* lines 22/24 route through this
  boundary.
- QSS is mapped to the printed MFJ column in exactly one place; no downstream plan should re-decide
  it, and adding a sixth filing status will fail `tsc` at `taxTableColumnFor` rather than silently.

**Concern for whoever merges this wave:** repo-wide `npm test` will not be green until 10-05's
`fjs/tax/deduction` RED cycle completes. Verify per-module leaf sets after the merge (AGENTS.md's
"A clean merge with a green suite can still have dropped coverage") — my twelve
`fjs/tax/table` leaf names must all survive.

## Self-Check: PASSED

| Claim | Verified |
|---|---|
| `fjs/tax/table/module.f.js` exists and carries all four exports | `taxComputationWorksheet`, `taxTableColumnFor`, `baseTaxForAmount`, `handTranscribedTaxComputationWorksheetRows` — all FOUND |
| `10-03-SUMMARY.md` exists | FOUND |
| Commit `b8eb367` (Task 1) exists | FOUND |
| Commit `1a06f23` (Task 2) exists | FOUND |
| Every mutation reverted | `git status --short` shows `fjs/tax/table/module.f.js` **not** modified |
| No file deletions in either commit | `git diff --diff-filter=D HEAD~1 HEAD` empty for both |
| Twenty transcribed rows | `grep -c "^    { status: '"` = 20 |
| No new cast over an indexed access | regex count is 2 at pre-plan `de4be88`, 2 at `b8eb367`, 2 now — and both matches are the pre-existing prose "as Publication 1040 itself does" |

**One caveat on the final `tsc`, recorded rather than hidden.** At the moment of this self-check
`npx tsc` exits 1 with:

```
fjs/server/finance_schema/module.f.js(48,1): error TS6192: All imports in import declaration are unused.
```

That is a sibling's live in-flight mutation in a file I never touched — and it is *literally* the
error AGENTS.md's new concurrency section cites as the wave-1 example. My own module is unaffected
(`fjs/tax/table/module.f.js` is not in `git status`), and it typechecked clean at `TSC EXIT=0` on
both of my task commits and on all seven mutation runs. Whoever verifies this wave should re-run
`npm test` once all three executors have committed.

---
*Phase: 10-form-1040-core-line-16-dispatch-and-the-scope-guard*
*Completed: 2026-08-06*
