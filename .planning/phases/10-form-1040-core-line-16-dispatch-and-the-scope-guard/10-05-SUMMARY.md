---
phase: 10-form-1040-core-line-16-dispatch-and-the-scope-guard
plan: 05
subsystem: tax
tags: [standard-deduction, age-blindness, dependents-worksheet, line-12e, tax-06, phase-10]

requires:
  - phase: 10
    plan: 01
    provides: "fjs/tax/params/module.f.js — qualifyingSurvivingSpouse as a real IndividualFilingStatus, standardDeduction/agedOrBlindAdditional/dependentStandardDeductionCap with per-parameter citations"
  - phase: 08
    provides: "fjs/exact/module.f.js — centsFromString, the decimal-string money boundary"
provides:
  - "fjs/tax/deduction/module.f.js — standardDeductionCents, Form 1040 line 12e in exact bigint cents"
  - "agedOrBlindIncrementFor — the ONE place Rev. Proc. 2024-40 §2.15(3)'s 'unmarried and not a surviving spouse' rule is expressed as a status→amount mapping"
  - "maxAgedOrBlindBoxes — the per-status age/blindness box-count maximum, refused by name rather than clamped"
  - "dependentStandardDeduction — the Standard Deduction Worksheet for Dependents (i1040gi p35) transcribed line for line with the printed line numbers as names"
  - "expectedChartCombinationCount = 19 — the independently-stated chart row count that keeps a dropped row from taking its own proof leaf with it"
  - "35 proof leaves: 19 generated chart combinations, 1 coverage guard, 4 refusals, 7 Dependents-worksheet cases, 3 hard-zero exceptions, 1 precedence leaf"
affects: [10-06, 10-07, 10-08, 10-09]

tech-stack:
  added: []
  patterns:
    - "A rule the stored data's FIELD NAMES cannot express (a QSS filer is not married yet takes the `married` amount) is written once as a `Record` over the status union in the consuming module, with the params field names explicitly labelled a lossy compression that must never be read as the rule."
    - "Two gates for one chart footnote at two layers on purpose: this module owns the box-count MAXIMUM; the MFS fourth box's qualifying condition is 10-04's ingest check. Duplicating the condition here would be the second copy that rots."
    - "A refusal message carries only the status, the offending count and the maximum — never a money value — and the proof asserts those substrings (`boxes=3`, `maximum=2`), not merely that something threw."
    - "A boundary that is arithmetically invisible is probed on THREE points and the negative result is recorded as evidence, not hidden: `>` vs `>=` cannot be observed at $900, and the SUMMARY says so rather than claiming the comparison is proven."

key-files:
  created: [fjs/tax/deduction/module.f.js]
  modified: []

key-decisions:
  - "MFS is `agedOrBlindIncrementFor: 'married'` while sharing single's $15,750 base. Mutation 1 shows the four non-zero MFS rows are the only thing that moves when that single word is wrong — $400 per box, up to $1,600."
  - "maxAgedOrBlindBoxes.qualifyingSurvivingSpouse = 2 while marriedFilingSeparately = 4, per the 1040-SR chart read end to end in 10-CONTEXT.md. Mutation 2 confirms Decision 6 is enforced by exactly one leaf, so it is enforced rather than merely documented."
  - "Box-count validation runs BEFORE the hard-zero exceptions. A five-box MFS return whose spouse itemizes is REFUSED, not answered `0n` — proven by its own precedence leaf, which survives mutation 5 (the exception-dominance mutation) unchanged."
  - "The worksheet's $900 threshold is derived as `addOnCents * 2n` from the stored $450 add-on (research assumption A5) rather than hand-typed, so there is no second uncited constant able to drift from the parameter it restates."
  - "Exception 5 (net qualified disaster loss) is explicitly NOT handled here and is named in the module docstring as a scope-guard refusal (Plan 10-07), so it can never become a quiet fall-through to the chart."
  - "expectedChartCombinationCount stays 19. 10-RESEARCH.md's prose says '(17 leaves)' above a table whose own rows sum to 19; the module docstring records that the prose miscounts its own table so a later reader does not 'correct' it downward."

patterns-established:
  - "Under concurrent executors in one checkout, every gated `npm test` runs against a `git archive HEAD` snapshot plus the mutated working file, so a sibling's in-flight `tsc` error can never be mistaken for a mutation's RED."
  - "A mutation that fails to compile is reported as a plan defect AND re-run in a semantically identical form that keeps the binding live (`x` → `(x && false)`), so the observation is not lost."

requirements-completed: [TAX-06]

metrics:
  duration: ~70min
  tasks: 2
  files: 1
  proof-leaves-added: 35
---

# Phase 10 Plan 05: The Standard Deduction with Age and Blindness Increments Summary

`fjs/tax/deduction` ships Form 1040 line 12e in exact cents: all 19 printed Standard Deduction Chart
combinations from hand-typed expectations, the Standard Deduction Worksheet for Dependents
transcribed line for line, and the two hard-zero exceptions proven to survive the maximum number of
checked boxes — with the MFS increment, the QSS box maximum, the per-status base, the line-4a cap
and the exception's dominance over the chart each shown to fail under a typechecking mutation.

## Proof-leaf counts

The branch is shared with two concurrent executors (10-03, 10-04), so the project-wide total moves
underneath this plan. The number attributable to it is the delta on its own module.

| Measurement | Before | After Task 1 | After Task 2 |
|---|---|---|---|
| `node --test 2>&1 \| grep -c '^✔ import("./fjs/tax/deduction'` | **0** | **24** | **35** |
| `node --test 2>&1 \| grep -c '^✔ import("./fjs/'` (project-wide, moves with siblings) | 334 | 349 | 376 (snapshot at my HEAD) / 406 (real tree after 10-03 and 10-04 landed) |

Final real-tree run, after all three executors' work was on the branch:

```
ℹ tests 408
ℹ pass 408
ℹ fail 0
exit=0
```

## How the suite was measured under concurrency

AGENTS.md's new "Concurrent work invalidates a mutation observation" section bit immediately, in
exactly the shape it predicts. Mid-plan, the real tree's `npm test` was red for a reason that had
nothing to do with this module:

```
fjs/tax/table/module.f.js(76,27): error TS6133: 'individualFilingStatuses' is declared but its value is never read.
```

`tsc` is repo-wide, so `node --test` never ran. Had that been read as a mutation's RED it would have
been recorded as evidence for a mutation that never executed.

Every gated run below was therefore executed against a snapshot built as **`git archive HEAD` plus
this module's mutated working file**, never a `cp -a` of the live tree:

```bash
rm -rf /tmp/snap-1005 && mkdir -p /tmp/snap-1005
git -C <root> archive HEAD | tar -xf - -C /tmp/snap-1005
cp -a <root>/node_modules /tmp/snap-1005/node_modules
cp <root>/fjs/tax/deduction/module.f.js /tmp/snap-1005/fjs/tax/deduction/module.f.js
( cd /tmp/snap-1005 && npm test )
```

This is stricter than the `tar --exclude=.git` recipe AGENTS.md gives: a plain tar snapshot copies
the siblings' *in-flight* files too, so it inherits their `tsc` error. `git archive HEAD` yields a
tree containing only committed work plus this plan's file — the unmutated baseline of that snapshot
was verified green (`exit=0`, `pass 364, fail 0`, later `pass 378, fail 0`) before each mutation
round, so a RED is attributable to the mutation alone. Every mutation edit and every
`git diff --numstat` was performed on the **real tracked file**, as required.

## Task 1 — the chart

`fjs/tax/deduction/module.f.js`, commit `8982fef`.

- `agedOrBlindIncrementFor`, a `Record` over the full `IndividualFilingStatus` union. Its docstring
  states Rev. Proc. 2024-40 §2.15(3)'s actual rule — the $2,000 amount belongs to someone
  "unmarried **and not a surviving spouse**" — and records that `fjs/tax/params`' field names
  `married`/`unmarried` are a lossy compression of it. Per the plan's instruction, `fjs/tax/params`
  was left untouched (Plan 10-01's ownership); the rule lives here and the params file is pointed
  at, not edited.
- `maxAgedOrBlindBoxes`, each value carrying its own citation comment: single 2, MFJ 4, **MFS 4**
  (settled in 10-CONTEXT.md from the 1040-SR chart read end to end; the fourth box's *condition* is
  10-04's check 5b, not this module's), HoH 2 (i1040gi p33), QSS 2 (Decision 6).
- `standardDeductionCents(taxParamSet)(input)` with the load-bearing order: validate → exceptions
  2/3 → exception 1 → chart.
- 19 hand-typed chart rows, one generated leaf each (`${status}_${boxes}Boxes`), guarded by
  `expectedChartCombinationCount = 19` and a leaf-count check, neither derived from
  `chartCombinations.length`.
- Four refusal leaves asserting the thrown CONTENT (`boxes=3`, `maximum=2`, the status name), with
  the chart's own maximum-box rows named in a comment as their control rather than duplicated.

### RED gate

The implementation was stubbed to `todo()` in a snapshot and the suite watched to fail before the
real body was written:

```
✖ ...proof.single_0Boxes()            ✖ ...proof.marriedFilingSeparately_4Boxes()
✖ ...proof.marriedFilingJointly_0Boxes()   ... (23 of the module's 24 leaves)
✔ ...proof.everyPrintedChartCombinationIsCovered()
ℹ tests 364  ℹ pass 338  ℹ fail 26
```

23 of 24 failed. `everyPrintedChartCombinationIsCovered` legitimately passed — it counts rows and
leaves and calls no production code. (Of the 26 total failures, 3 were a sibling's in-flight file,
which is what prompted the snapshot discipline above.)

### Mutations — all three run one at a time, each reverted, each `1 insertion / 1 deletion`

**Mutation 1 — `agedOrBlindIncrementFor.marriedFilingSeparately` `'married'` → `'unmarried'`.**
Predicted: RED on the four non-zero MFS rows and nothing else. **Observed: exactly that.**

```
-    marriedFilingSeparately: 'married',
+    marriedFilingSeparately: 'unmarried',
✖ import("./fjs/tax/deduction/module.f.js").proof.marriedFilingSeparately_1Boxes()
✖ import("./fjs/tax/deduction/module.f.js").proof.marriedFilingSeparately_2Boxes()
✖ import("./fjs/tax/deduction/module.f.js").proof.marriedFilingSeparately_3Boxes()
✖ import("./fjs/tax/deduction/module.f.js").proof.marriedFilingSeparately_4Boxes()
ℹ tests 364  ℹ pass 360  ℹ fail 4
```

Failing leaves: **4**. T-10-05-01 mitigated.

**Mutation 2 — `maxAgedOrBlindBoxes.qualifyingSurvivingSpouse` `2` → `4`.**
Predicted: RED on `refusesThreeBoxesForQualifyingSurvivingSpouse`. **Observed: exactly that leaf,
alone.**

```
-    qualifyingSurvivingSpouse: 2,
+    qualifyingSurvivingSpouse: 4,
✖ import("./fjs/tax/deduction/module.f.js").proof.refusesThreeBoxesForQualifyingSurvivingSpouse()
ℹ tests 364  ℹ pass 363  ℹ fail 1
```

Failing leaves: **1**. 10-CONTEXT.md Decision 6 is enforced, not merely documented.

**Mutation 3 — `taxParamSet.standardDeduction[status]` → `.single`.**
Predicted by the plan: "RED on every non-single row" (14 rows). **Observed: 11 rows — MFJ 0–4, HoH
0–2, QSS 0–2. The five MFS rows stayed GREEN.**

```
-    const basicCents = centsFromString(taxParamSet.standardDeduction[status].amount)
+    const basicCents = centsFromString(taxParamSet.standardDeduction.single.amount)
✖ ...headOfHousehold_0Boxes()  ✖ ...headOfHousehold_1Boxes()  ✖ ...headOfHousehold_2Boxes()
✖ ...marriedFilingJointly_0Boxes() ... _1Boxes() ... _2Boxes() ... _3Boxes() ... _4Boxes()
✖ ...qualifyingSurvivingSpouse_0Boxes() ... _1Boxes() ... _2Boxes()
ℹ tests 364  ℹ pass 353  ℹ fail 11
```

Failing leaves: **11**. This is a plan-prediction defect, not a coverage gap — see *Plan defects*
below. MFS is invisible to this mutation *because* MFS shares single's $15,750 base; the thing that
distinguishes the two statuses is the increment, and that is precisely what mutation 1 pins.

## Task 2 — the Dependents worksheet and the hard zeros

Commit `e47b271`, plus a correction in `0c3bdc4`.

- `dependentStandardDeduction(taxParamSet)(status, agedOrBlindBoxes, earnedIncomeCents)` with
  `line1` / `line2` / `line3` / `line4a` / `line4b` / `line4c` as the local names (TAX-15).
- The `$900` threshold derived as `addOnCents * 2n` with assumption A5 recorded at the site.
  `grep -v '^ *[*/]' … | grep -c '\b900\b'` is **0** — the number exists only in prose.
- Assumption A3 (QSS reads $31,500 on the worksheet's line 3, which prints only S/MFS, MFJ and HoH)
  recorded in the function's docstring.
- Exception 1's `assert(false, [...])` not-yet-implemented refusal replaced by the delegation — the
  one-line wiring the plan specified.
- 11 new leaves: 7 worksheet cases (both arms of line 2, the line-4a cap, the two-box stack, and the
  three boundary probes), 3 hard zeros checked **with the maximum boxes set**, and the precedence
  leaf.

### RED gate

The 11 leaves were added while exception 1 still refused as not-yet-implemented:

```
✖ ...proof.dependentWithFiveHundredEarnedIncomeTakesTheMinimumArm()
✖ ...proof.dependentWithTwoThousandEarnedIncomeTakesTheEarnedIncomeArm()
✖ ...proof.dependentEarnedIncomeIsCappedByLine4aAtTheBasicDeduction()
✖ ...proof.dependentEarnedIncomeArmStacksTwoAgedOrBlindBoxes()
✖ ...proof.dependentEarnedIncomeOneCentBelowTheThresholdIsTheMinimum()
✖ ...proof.dependentEarnedIncomeExactlyAtTheThresholdIsTheMinimum()
✖ ...proof.dependentEarnedIncomeOneCentAboveTheThresholdMovesOffTheMinimum()
ℹ tests 375  ℹ pass 368  ℹ fail 7
```

The 3 hard-zero leaves and the precedence leaf passed on arrival, which is what the plan describes:
their CODE landed in Task 1 ("the code lands here; its proof leaves land in Task 2"), so this is an
expected pass, not a silent one. Their independence is established by mutations 4 and 5 below, not
by this gate.

### Mutations — all five run one at a time, each reverted

**Mutation 1 — `line4a = min(line2, line3)` → `line4a = line2`.**
**As literally written it does not typecheck**, so it was re-run in a semantically identical form
that keeps `line3` live (defect reported below):

```
# as written
-    const line4a = line2 < line3 ? line2 : line3
+    const line4a = line2
fjs/tax/deduction/module.f.js(183,11): error TS6133: 'line3' is declared but its value is never read.

# semantically identical, keeps line3 read — the cap can never bind
-    const line4a = line2 < line3 ? line2 : line3
+    const line4a = line2 < line3 ? line2 : line2
✖ import("./fjs/tax/deduction/module.f.js").proof.dependentEarnedIncomeIsCappedByLine4aAtTheBasicDeduction()
ℹ tests 378  ℹ pass 377  ℹ fail 1
```

Failing leaves: **1** — the $20,000 cap leaf, and nothing else. As predicted.

**Mutation 2 — the `$900` derivation `* 2n` → `* 3n`.**
Predicted: RED on the `$900.01` leaf. **Observed: exactly that leaf.**

```
-    const earnedIncomeThresholdCents = addOnCents * 2n
+    const earnedIncomeThresholdCents = addOnCents * 3n
✖ import("./fjs/tax/deduction/module.f.js").proof.dependentEarnedIncomeOneCentAboveTheThresholdMovesOffTheMinimum()
ℹ tests 378  ℹ pass 377  ℹ fail 1
```

Failing leaves: **1**. The boundary probes are on the right side of the threshold.

**Mutation 3 — `line2`'s comparison `>` → `>=`. Predicted GREEN. Observed GREEN.**

```
-    const line2 = earnedIncomeCents > earnedIncomeThresholdCents
+    const line2 = earnedIncomeCents >= earnedIncomeThresholdCents
ℹ tests 378  ℹ pass 378  ℹ fail 0   exit=0
```

This is the deliberate negative result, and it is evidence that the boundary is genuinely invisible
rather than merely untested. At exactly the threshold the earned-income arm returns
`threshold + add-on = $900 + $450 = $1,350`, which is the minimum arm's answer as well. The leaf
that would start moving if that stopped holding is
**`dependentEarnedIncomeExactlyAtTheThresholdIsTheMinimum`**.

The invariant behind the coincidence is `2 × addOn + addOn === minimum` — the TY2025 minimum is
exactly **three** times the add-on ($450 × 3 = $1,350). Recording this result is what exposed a wrong
statement of that invariant in the code comments; see *Deviations*.

**Mutation 4 — delete the `dualStatusAlien` term from the exception-3 condition.**
**As literally written it does not typecheck** (same defect class as mutation 1), so it was re-run
keeping the binding live:

```
# as written
-    if (spouseItemizes || dualStatusAlien) {
+    if (spouseItemizes) {
fjs/tax/deduction/module.f.js(212,75): error TS6133: 'dualStatusAlien' is declared but its value is never read.

# semantically identical — the dual-status term can never fire
-    if (spouseItemizes || dualStatusAlien) {
+    if (spouseItemizes || (dualStatusAlien && false)) {
✖ import("./fjs/tax/deduction/module.f.js").proof.dualStatusAlienIsZeroEvenWithTwoBoxesChecked()
ℹ tests 378  ℹ pass 377  ℹ fail 1
```

Failing leaves: **1**.

**Mutation 5 — delete the `spouseItemizes` term from the same condition.** Same compile defect, same
treatment:

```
# as written
-    if (spouseItemizes || dualStatusAlien) {
+    if (dualStatusAlien) {
fjs/tax/deduction/module.f.js(212,59): error TS6133: 'spouseItemizes' is declared but its value is never read.

# semantically identical
-    if (spouseItemizes || dualStatusAlien) {
+    if ((spouseItemizes && false) || dualStatusAlien) {
✖ import("./fjs/tax/deduction/module.f.js").proof.spouseItemizesIsZeroEvenForADependentWithFourBoxesChecked()
✖ import("./fjs/tax/deduction/module.f.js").proof.spouseItemizesIsZeroEvenWithFourBoxesChecked()
ℹ tests 378  ℹ pass 376  ℹ fail 2
```

Failing leaves: **2** — the plan predicted one; the second is the dependent-plus-spouse-itemizes
leaf, which falls into the Dependents worksheet once exception 2 stops firing.

**What this mutation proves, stated exactly.** It is the exception-**DOMINANCE** mutation: the red
shows the exception exists and beats the fall-through (`$0` where the chart would pay `$22,150`).
**It does NOT prove exception ORDERING.** It cannot distinguish `return 0n` before the increments
from `(base + boxes × increment) × 0n` after them — both yield `0n`, so that ordering is
unobservable by any black-box test and nothing is at stake in money terms. The genuinely
order-sensitive property — validation runs *before* the exceptions, so five boxes plus
`spouseItemizes` REFUSES rather than returning `0n` — is covered by the separate precedence leaf
`fiveBoxesIsRefusedEvenWhenAnExceptionWouldHaveZeroedTheResult`, which stayed green under this
mutation (the refusal happens before the condition it edits).

## Acceptance criteria

| Criterion | Result |
|---|---|
| `npm test` exits 0, `tsc` clean, 0 fail | **exit 0**, `pass 408, fail 0` in the real tree; `pass 378, fail 0` in the clean snapshot |
| chart table has exactly 19 rows, checked against a hand-typed count that is not `.length` | `expectedChartCombinationCount = 19`, asserted by `everyPrintedChartCombinationIsCovered` |
| `grep -c "1735000n\|1895000n\|2055000n\|2215000n"` ≥ 4 | **5** |
| `grep -cE '\* *BigInt\(boxes\)\|base *\+ *'` shows no arithmetic in the expectation table | **0** |
| `grep -c "instanceof Error"` is exactly 0 | **0** |
| `grep -v '^ *[*/]' \| grep -c "\b900\b"` is exactly 0 | **0** |
| `grep -c "line4a\|line4b\|line4c"` ≥ 6 | **9** |
| module leaf count after Task 2 > after Task 1 | 35 > 24 |
| verification: project-local leaf count risen by ≥ 30 from this plan's start | **+35** on this module (0 → 35) |
| all eight mutations run, recorded | yes, with two compile defects reported and re-run |

## Deviations from Plan

### Auto-fixed issues

**1. [Rule 1 — Bug] The stated invariant behind the invisible `$900` boundary was arithmetically
wrong**
- **Found during:** Task 2, mutation 3 (the deliberate GREEN)
- **Issue:** Two comments — one in `dependentStandardDeduction`, one above the boundary probes —
  said the two arms of line 2 agree at exactly `$900` "because the add-on is exactly half the
  minimum". `$450` is a **third** of `$1,350`, not a half. The relation that actually makes the
  boundary invisible is `threshold + add-on = minimum`, i.e. `2 × addOn + addOn === minimum`. A
  future reader checking the claim would have found it false and could reasonably have concluded the
  probes were pointless.
- **Fix:** Both comments restated with the correct invariant, and the leaf that would begin to move
  if it stopped holding (`dependentEarnedIncomeExactlyAtTheThresholdIsTheMinimum`) named at the site.
- **Files modified:** `fjs/tax/deduction/module.f.js`
- **Commit:** `0c3bdc4`

### Process deviations

**1. The TDD RED gate was observed in a snapshot and not committed as a separate red commit.**
Three executors share this one checkout, and their plans' acceptance criteria include "`npm test`
exits 0, 0 fail". Committing a knowingly-red state would have broken both siblings' gate for the
duration, which is the same class of cross-contamination AGENTS.md's new section warns about. The
RED was therefore produced and recorded against a snapshot for both tasks (transcripts above, 23/24
leaves and 7/7 leaves respectively) and only the green state was committed. The evidence that the
code is proven is unchanged; what is missing is a `test(...)`-then-`feat(...)` commit pair.

**2. `STATE.md` / `ROADMAP.md` / `REQUIREMENTS.md` were not updated by this executor.** They are
shared files and two sibling executors are writing in the same checkout; this phase's completed
plans (`10-01`, `10-03`) each committed their SUMMARY alone, so that precedent was followed rather
than racing three agents on one progress table. `requirements-completed: [TAX-06]` is recorded in
this SUMMARY's frontmatter for the orchestrator to roll up.

**3. `read_first` pointed at `fjs/tax/table/module.f.js`'s `taxTableColumnFor` for the
`Record`-over-the-status-union idiom. That symbol does not exist** — `fjs/tax/params` only *refers*
to it in a docstring, and it is Plan 10-03's to write. The idiom was taken from
`fjs/tax/boundary/module.f.js` (the `Object.fromEntries` generated-leaf pattern and the
`expectedThresholdCount` independent-count guard) and from `fjs/tax/params`' own `Record<FilingStatus, …>`
tables instead.

## Plan defects found

1. **Task 2's mutations 1, 4 and 5 do not typecheck as written.** Each removes the last reference to
   a `const` or a destructured binding, so `noUnusedLocals`/`noUnusedParameters` fires TS6133 and
   `npm test` measures the compiler instead of the suite — the same failure wave 1 reported. All
   three were re-run in a semantically identical form that keeps the binding live
   (`line2 < line3 ? line2 : line2`, `(x && false)`), and both the compile error and the resulting
   RED are recorded above. A future plan writing a "delete this term" mutation for a destructured
   boolean should specify the `(x && false)` form directly.
2. **Task 1's mutation 3 prediction is wrong.** "Must turn RED on every non-single row" would be 14
   rows; the actual answer is 11, because `marriedFilingSeparately` shares single's `$15,750` base
   and is therefore invisible to a mutation of the base lookup. The prediction, not the coverage, was
   wrong — and the reason it was wrong is this plan's own headline trap.
3. **`10-RESEARCH.md`'s "(17 leaves)"** is a miscount of the table printed directly beneath it, whose
   rows sum to 19. Confirmed by counting: 3 + 5 + 5 + 3 + 3. `expectedChartCombinationCount = 19` is
   correct and the module docstring says so, so the prose cannot cause a later "correction" downward.

## Threat register outcomes

| Threat ID | Disposition | Evidence |
|---|---|---|
| T-10-05-01 (increment selected from the base rather than the status rule) | mitigated | `agedOrBlindIncrementFor` is a `Record` over the status union; mutation 1 fires exactly the 4 non-zero MFS leaves |
| T-10-05-02 (a profile claiming more boxes than its status permits) | mitigated | validation runs first and refuses by name; the precedence leaf shows an exception cannot mask it, and stays green under mutation 5 |
| T-10-05-03 (exceptions 2/3 silently losing to age and blindness) | mitigated | both hard-zero leaves set the MAXIMUM boxes; mutations 4 and 5 turn them red |
| T-10-05-04 (a refusal leaking the taxpayer's earned income) | mitigated | refusals carry `status`, `boxes=N`, `maximum=M` only; no money value is passed to `assert` anywhere in this module |

## Known Stubs

None. Every exported function computes; the only "not implemented" path in this module — Task 1's
exception-1 refusal — was replaced by the real delegation in Task 2, and no placeholder value, empty
collection or TODO remains. Exception 5 is not a stub: it is deliberately out of this module's scope
and named as a scope-guard refusal owned by Plan 10-07.

## Self-Check: PASSED

- `fjs/tax/deduction/module.f.js` — FOUND
- `.planning/phases/10-form-1040-core-line-16-dispatch-and-the-scope-guard/10-05-SUMMARY.md` — FOUND
- commit `8982fef` — FOUND
- commit `e47b271` — FOUND
- commit `0c3bdc4` — FOUND
- `npm test` in the real tree: exit 0, `pass 408, fail 0`; this module contributes 35 passing leaves
- working tree clean of any leftover mutation: `git diff --numstat -- fjs/tax/deduction/module.f.js`
  is empty
