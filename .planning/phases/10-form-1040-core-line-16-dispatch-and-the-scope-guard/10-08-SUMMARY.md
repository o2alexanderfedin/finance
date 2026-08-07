---
phase: 10-form-1040-core-line-16-dispatch-and-the-scope-guard
plan: 08
subsystem: line-16-dispatch
tags: [line-16-dispatch, method-tag, dispatch-order, schedule-d-refusal, tax-03, phase-10]

requires:
  - phase: 10-03
    provides: "baseTaxForAmount — the tagged level-3 base lookup and the $100,000 seam, and Line16BaseMethod"
  - phase: 10-06
    provides: "qdcgt — the 25-line Qualified Dividends and Capital Gain Tax Worksheet, and its regression pair's hand-typed line 25 values"
  - phase: 10-07
    provides: "scopeRefusal — the ONE place a scope refusal is built — and ScopeError, reachable without a cast or a non-null assertion"
provides:
  - "dispatchLine16 — the four-level line-16 method dispatch: three wrappers, the preferential-rate gate, the five level-2 conditions in printed order, and the level-3 base lookup"
  - "Line16Method — the seven tags: four TAX-03 branches plus three wrappers"
  - "Line16Outcome — carrying `method` on BOTH the ok and the error shape, so the refusing branch is observable"
  - "Line16Error = ScopeError & { method } — the refusal shape derived from fjs/return/scope's, so the two cannot drift"
affects: [10-10, 12]

tech-stack:
  added: []
  patterns:
    - "A dispatcher whose outcome carries the SELECTED METHOD on its refusing arm as well as its computing one, because a deferred branch has no cents to assert"
    - "Two independent proofs over the SAME discriminating input, in two different proof groups, so a swapped order reddens twice and no single 'simplification' can silence it"
    - "The error arm typed as an intersection with the upstream refusal type rather than a re-spelled object literal, so a second declaration of 'what a refusal is' cannot appear"

key-files:
  created:
    - fjs/tax/line16/module.f.js
  modified: []

key-decisions:
  - "Line16Error is `ScopeError & { readonly method: Line16Method }`, not the plan's re-spelled object literal: the intersection makes the refusal shape structurally inherited from fjs/return/scope, and it is also the only spelling under which the plan's own grep gate (kind:'error' line count == scopeRefusal call sites) is satisfiable (plan defect 1)"
  - "Level 2's three QDCGT bullets (2c, 2d, 2e) are three separate `if` blocks sharing one `qdcgtOutcome` closure, not one fused disjunction: fusing them makes the plan's ordering mutation unrunnable, because 2e cannot be moved past 2a without changing the predicted green set"
  - "The 2a arm names only the Schedule D lines that are actually non-zero, so the refusal says what THIS return has rather than what the branch is about in general"
  - "The Form 4952 condition ships the instructions' stricter form (4952 filed AND line 4g > 0); Schedule D line 20's looser form-face wording is recorded at the site for Phase 12"

patterns-established:
  - "Pattern: when a written-down mutation's predicted red set is a subset of the actual one, the surplus leaf is evidence, not noise — mutation 1 reddened a third leaf because moving 2c above 2a also moves it above 2b"
  - "Pattern: a proof-side 'mutation' that turns a discriminating input into its own control is a direct measurement of where a leaf's discriminating power lives"

requirements-completed: [TAX-03]

duration: ~55min
completed: 2026-08-06
---

# Phase 10 Plan 08: `dispatchLine16`, the Four-Way Tagged Method Dispatch Summary

**Form 1040 line 16 now selects among four printed methods and three wrappers explicitly, in the
printed order, and every outcome says which branch produced it — including the Schedule D Tax
Worksheet branch, which is selected and then refuses by name, and which therefore has no cents to
be proven by.**

## Performance

- **Duration:** ~55 min
- **Tasks:** 2 of 2
- **Files modified:** 1 (created)
- **Commits:** 2 task commits + this metadata commit

## What Was Built

`fjs/tax/line16/module.f.js`, in two commits:

| Commit | Task | What |
|---|---|---|
| `7a7279d` | 1 | `Line16Method`, `Line16Ok`/`Line16Error`/`Line16Outcome`, `Line16Inputs`, `dispatchLine16` (four labelled levels), 12 branch leaves |
| `a6153dc` | 2 | The ordering leaf and its control, the no-preferential-income leaf, the 4-row branch table, the 5-row refusing-arm table, 5 leaves |

**Leaf count for this module: 0 before → 17 after** (12 `branches` + 3 `ordering` + 2
`exhaustiveness`). The plan's verification asked for at least 14.

**Project-local leaves: 432 before → 449 after.** Repo-wide at the end: `npm test` **451 / 451,
0 fail, `tsc` clean**, working tree clean.

## The one thing this plan exists to prevent

When Schedule D lines 18 and 19 are both zero and Form 4952 is not filed, the Schedule D Tax
Worksheet is **algebraically identical** to the QDCGT. So a swapped 2a/2c dispatch order produces
identical cents on every ordinary return, and every value assertion in the phase stays green while
a taxpayer with unrecaptured §1250 gain is silently under-taxed — the whole preferential slice at
0/15/20% instead of up to 25% and 28%.

Mutation 4 turned out to be the cleanest single demonstration, and it is worth quoting because it
is the plan's thesis reduced to one line of output. Weakening level 1a's `<= 0n` to `< 0n`:

```
✖ …proof.branches.zeroTaxableIncomeSelectsTheTaxTableAtZeroWithoutRunningAWorksheet()
  [ 'qdcgt', 'taxTable', [ 'zero taxable income must not reach a preferential worksheet',
    { kind: 'ok', method: 'qdcgt', cents: 0n } ] ]
```

**The cents are identical — `0n` either way.** The dispatcher ran an entire 25-line worksheet it
had no business running, and only the method tag noticed.

## Mutations — every one run, one at a time, reverted, transcripts real

All five Task 1 mutations and all three Task 2 mutations were run against a **committed** baseline,
each verified with `git diff --numstat` before measuring. (The first attempt at mutation 1 was run
while the file was still untracked, so `git diff --numstat` printed nothing and verified nothing;
it was reverted and the whole set re-run after committing Task 1. Recorded because an unverified
mutation is exactly the kind of evidence AGENTS.md warns is worse than a missed failure.)

### Task 1

**Mutation 1 — level 2c moved above level 2a** (`numstat`: `3 3`, a pure block move; diff confirmed
as an insertion above `scheduleDLinesFifteenAndSixteenAreBothGains` and a deletion at 2c).

```
✖ …proof.branches.formFourNineFiveTwoWithLineFourGRefusesNamingTheElection()
✖ …proof.branches.scheduleDLineEighteenRefusesNamingTwentyEightPercentRateGain()
✖ …proof.branches.scheduleDLineNineteenRefusesNamingUnrecapturedSection1250Gain()
ℹ tests 446  ℹ pass 443  ℹ fail 3
```

**The prediction was wrong, in the informative direction.** The plan predicted RED on "the two
discriminating Schedule D leaves". A **third** leaf reddened:
`formFourNineFiveTwoWithLineFourGRefusesNamingTheElection`. The reason is structural and the plan
had not considered it — moving 2c above 2a also moves it above **2b**, and that leaf carries
line 3a = $300.00 for its own reasons, so it too is captured by the promoted qualified-dividends
test. So the mutation is really "promote 2c above the whole Schedule-D-Tax-Worksheet group", and
it bites every leaf in that group that has qualified dividends.

**The GREEN half, exactly as predicted and this is the point of the whole plan:**

| Stayed GREEN under a swapped order | Why |
|---|---|
| `scheduleDBranchIsReachableWithoutQualifiedDividends` | Line 3a = $0, so the promoted level 2c never fires and the reordering is **invisible**. This is the shape of every ordinary test case anyone would write. |
| `qualifiedDividendsSelectQdcgtOnRegressionCaseA` / `…CaseB` | No Schedule D, so 2a was never in play; both orderings agree. |
| `ordinaryReturnSelectsTheTaxTable`, `theOneHundredThousandSeamSelects…` | Never reach level 2. |
| `controlFormFourNineFiveTwo…`, the three wrapper leaves, `zeroTaxableIncome…` | Decided at level 0, level 1, or by 2b's own strict condition. |

**A correction to the plan's stated green set.** The plan predicted "every leaf that asserts only
cents" would stay green. **This module has no such leaf** — the plan's own action block requires
every leaf to assert `kind` AND `method` AND (on the ok arm) `cents`, so the category is empty by
construction. The green evidence is carried instead by
`scheduleDBranchIsReachableWithoutQualifiedDividends`, which is kept in the suite for exactly this
purpose and whose docstring says so.

**Mutation 2 — level 2b's `filingForm4952 && form4952Line4gCents > 0n` → `filingForm4952`.**
AGENTS.md failure mode 1, on the first attempt (`numstat`: `1 1`):

```
fjs/tax/line16/module.f.js(163,25): error TS6133: 'form4952Line4gCents' is declared but its value is never read.
```

Re-run as the semantically identical edit that keeps the binding live —
`filingForm4952 && (form4952Line4gCents > 0n || true)` (`numstat`: `1 1`):

```
✖ …proof.branches.controlFormFourNineFiveTwoWithZeroLineFourGStillSelectsQdcgt()
ℹ tests 446  ℹ pass 445  ℹ fail 1
```

Exactly the predicted single leaf, and it is the leaf that pins the [FINDING]: the form face's
looser wording would refuse a return that must compute.

**Mutation 3 — level 0a (Form 2555) moved below level 2** (`numstat`: `4 4`):

```
✖ …proof.branches.formTwentyFiveFiftyFiveOutranksQdcgt()
ℹ tests 446  ℹ pass 445  ℹ fail 1
```

Exactly as predicted. The wrapper's outermost position is load-bearing.

**Mutation 4 — level 1a's `taxableIncomeCents <= 0n` → `< 0n`** (`numstat`: `1 1`):

```
✖ …proof.branches.zeroTaxableIncomeSelectsTheTaxTableAtZeroWithoutRunningAWorksheet()
  [ 'qdcgt', 'taxTable', [ …, { kind: 'ok', method: 'qdcgt', cents: 0n } ] ]
ℹ tests 446  ℹ pass 445  ℹ fail 1
```

Exactly as predicted, and see above — the cents are unchanged at `0n`. A cents-only suite would
have shipped this.

**Mutation 5 — the 2a arm's `scopeRefusal(kinds)` replaced by a locally constructed refusal.**
AGENTS.md failure mode 1 again, on the plan's literal form (`numstat`: `1 2`):

```
fjs/tax/line16/module.f.js(269,15): error TS6133: 'kinds' is declared but its value is never read.
```

Re-run keeping the binding live —
`{ kind: 'error', method: 'scheduleDTaxWorksheet', message: 'unsupported', unmodeled: kinds.filter(() => false) }`
(`numstat`: `1 2`):

```
✖ …proof.branches.scheduleDBranchIsReachableWithoutQualifiedDividends()
✖ …proof.branches.scheduleDLineEighteenRefusesNamingTwentyEightPercentRateGain()
✖ …proof.branches.scheduleDLineNineteenRefusesNamingUnrecapturedSection1250Gain()
ℹ tests 446  ℹ pass 443  ℹ fail 3   →  [ 0, 1, [ 'expected exactly one unmodeled kind', [] ] ]
```

All three 2a leaves, and — the part that makes this a good mutation —
`formFourNineFiveTwoWithLineFourGRefusesNamingTheElection` stayed **green**, because the 2b arm's
own `scopeRefusal` call was untouched. The refusal really is built per call site from the one
shared builder, and a parallel mechanism appearing at any one of them is caught locally.

### Task 2

**Mutation 1 — level 2c above level 2a, re-run for this task's leaves** (`numstat`: `3 3`):

```
✖ …proof.ordering.scheduleDConditionsOutrankQualifiedDividends()
✖ …proof.exhaustiveness.dispatchIsExhaustiveOverTheFourTaxThreeBranches()
✖ …proof.exhaustiveness.everyRefusingArmNamesWhatIsUnmodeled()
   (plus Task 1's three)
ℹ tests 451  ℹ pass 445  ℹ fail 6
```

**The ordering leaf went red and its control stayed green**, which is the pair the plan asked for.
And the redundancy the plan insisted on paid off literally: **three** independent leaves in **two**
proof groups fired, so no single "simplification" of the ordering leaf can silence the evidence.

**Mutation 2 — the ordering fixture's Schedule D line 19 changed from `1000000n` to `0n`.** A
**proof-side** edit, not a mutation of shipped code (`numstat`: `1 1`; the diff confirms the single
changed line is in `scheduleDWithUnrecapturedGainAndQualifiedDividends`, not in `dispatchLine16`):

```
✖ …proof.ordering.scheduleDConditionsOutrankQualifiedDividends()
  [ 'qdcgt', 'scheduleDTaxWorksheet', [ …, { kind: 'ok', method: 'qdcgt', cents: 637500n } ] ]
ℹ tests 451  ℹ pass 448  ℹ fail 3
```

The leaf's input now produces **the control's exact outcome, cents included** —
`{ kind: 'ok', method: 'qdcgt', cents: 637500n }` is byte-for-byte what
`controlSameInputsWithZeroEighteenAndNineteenSelectQdcgt` asserts. That is the demonstration the
plan wanted: the leaf's entire discriminating power comes from the non-zero line 19, and with it
zeroed the "discriminating" input and the control become the same return. Reverted.

(`everyRefusingArmNamesWhatIsUnmodeled` also fired, correctly: its level-2a row spreads the same
fixture and expects both kinds named, and with line 19 zeroed only `collectibles28RateGain`
remains. `dispatchIsExhaustiveOverTheFourTaxThreeBranches` fired for the same reason — both of
which re-confirm that the two proofs really do share the discriminating input.)

**Mutation 3 — the `method` field deleted from the 2a error arm's return** (`numstat`: `1 1`).
The result IS that it does not compile, which is what was to be shown:

```
fjs/tax/line16/module.f.js(159,46): error TS2322: Type '(inputs: Line16Inputs) =>
  Line16Ok | { kind: "error"; message: string; unmodeled: readonly (…44 kinds…)[]; } | Line16Error'
  is not assignable to type '(inputs: Line16Inputs) => Line16Outcome'.
```

**The method tag is structurally required, not conventional.** A future pass cannot quietly drop it
from a refusing arm and leave the suite green — the build stops first. This is the leaf-level
guarantee the phase's TAX-03 claim rests on for the branch that has no cents.

## Deviations from Plan

### Plan defect 1 — the `Line16Outcome` type spelling makes the plan's own grep gate unsatisfiable

The plan's action block specifies
`Line16Outcome = { kind: 'ok', … } | { kind: 'error', method, message, unmodeled }`, spelling the
error arm as a fresh object literal. Its acceptance criteria then require
`grep -c "kind: 'error'"` to **equal the number of `scopeRefusal` call sites** (5).

Those cannot both hold. With the typedef spelled literally, `kind: 'error'` appears on the typedef
line as well as on each arm, giving 6 against 5. Spelling the arms with a spread
(`{ ...scopeRefusal(k), method }`) gives 0 against 5.

**Resolved by typing the error arm as `ScopeError & { readonly method: Line16Method }`** — an
intersection with `fjs/return/scope`'s own refusal type. This satisfies the gate exactly (5 = 5)
and is the better engineering independently: the shape is *inherited* from the single place a
refusal is defined rather than re-declared beside it, which is the same "one rule, one place"
argument the gate exists to enforce (T-10-08-03). Each arm destructures
`const { message, unmodeled } = scopeRefusal(...)` and returns them by shorthand, so no field can
be invented locally. Mutation 5 confirms the arrangement is load-bearing.

### Plan defect 2 — mutation 1 is unrunnable if level 2's three bullets are fused

The plan's level-2 table lists 2c, 2d and 2e as three conditions all routing to `qdcgt`, which
invites a single fused disjunction. Task 1's mutation 1 then becomes unrunnable **as specified**:
"move level 2c above level 2a" would necessarily move 2e too, and 2e (`filing Sch D AND lines 15
and 16 both gains`) is true on the Schedule D leaves — so the plan's carefully-chosen GREEN leaf,
`scheduleDBranchIsReachableWithoutQualifiedDividends` (line 3a = $0), would have gone **red**, and
the plan's central piece of evidence would have evaporated.

Written instead as three separate `if` blocks sharing one `qdcgtOutcome` closure. This is also
closer to the printed page, which prints three bullets. Recorded at the site so a later
"simplification" into one disjunction does not silently disarm the mutation.

### Plan defect 3 — mutation 5's literal form does not compile

Recorded above; the plan's written form orphans `kinds` and stops at TS6133. This is AGENTS.md's
documented failure mode 1 and was handled per its instructions (record the compile error, re-run
the semantically identical edit in a binding-live form, record both).

### Added beyond the plan (Rule 2 — correctness)

- **A control inside `profileWithNoPreferentialIncomeNeverReachesLevelTwo`.** The plan specifies
  only "method is `'taxTable'` or `'taxComputationWorksheet'`", which a dispatcher that *never*
  selected a preferential worksheet would satisfy. The leaf now adds the same $50,000.00 income
  **with** qualified dividends and asserts it does reach `'qdcgt'` — AGENTS.md: a gate needs a
  control.
- **`expectedRefusingArmCount = 5`,** hand-typed, standing behind
  `everyRefusingArmNamesWhatIsUnmodeled`'s loop. The plan asked for the hand-typed count on the
  branch table only; the refusing-arm table is a second proof-owned loop and needed the same
  counterweight, or a row silently deleted would shrink the loop unnoticed.
- **`expectedUnmodeled` and `expectedLabels` hand-typed in `refusingArms`** rather than read from
  `fjs/return/scope`'s `unmodeledKindRefusals`. Reading them would have made the leaf agree with
  whatever that table happens to say — the exact self-referential shape AGENTS.md lists as this
  project's fourth shipped defect.
- **`assertEq(new Set(rows.map(r => r.expectedMethod)).size, 4)`** in the branch table, so four
  rows that accidentally named three distinct methods would fail.

## Self-referential-proof exposure, and what stands behind it

Two leaves iterate collections (`taxThreeBranches`, `refusingArms`). Both collections are
**proof-owned literals**, not derived from `dispatchLine16` — so they are not instances of the
`Object.keys(codeUnderTest)` shape. What could still go wrong is a row being deleted from the proof
itself, and each loop is therefore paired with a hand-typed count
(`expectedTaxThreeBranchCount = 4`, `expectedRefusingArmCount = 5`), plus a distinctness assertion
on the branch table. No loop in this module draws its iteration set from the module under test.

## What this phase deliberately does NOT prove

Research's **degenerate-equivalence differential** — that with Schedule D lines 18 and 19 both zero
the Schedule D Tax Worksheet and the QDCGT return the same cents — cannot be written here, because
Decision 1 ships the Schedule D branch as a refusal rather than a computation. There is no second
number to compare. It is Phase 12's, and it will validate both transcriptions against each other.
Recorded in a closing comment in the module so the gap is visible at the site rather than only
here.

Until then the ordering is carried by **two** independent leaves over the same discriminating
input, in two different proof groups, and by the `tsc` guarantee (Task 2 mutation 3) that the tag
they read cannot be removed.

## For the plans that consume this

- **10-10** calls `dispatchLine16(taxParamSet)(inputs)` for line 16 and must propagate the error
  arm into the whole-report refusal rather than treating a refused line 16 as a zero. `Line16Error`
  is `ScopeError & { method }`, so `message` and `unmodeled` are directly reachable and can be
  merged with `classifyScope`'s own refusal without a cast.
- **Phase 12**, when the Schedule D Tax Worksheet lands: the 2b comment records the form-face /
  instructions discrepancy about Form 4952 that will matter then, and the level-2a arm is the one
  that flips from refusal to computation. The refusing-arm table's level-2a row and the ordering
  leaf are the two places that will need re-aiming — both are named in each other's docstrings.

## Threat Register Outcomes

| Threat ID | Disposition | Evidence |
|---|---|---|
| T-10-08-01 (wrong dispatch order under-taxing §1250/collectibles) | mitigated | Level 2a precedes 2c; mutation 1 reddens the ordering leaf and both exhaustiveness leaves while the line-3a = $0 leaf stays green |
| T-10-08-02 (Schedule D branch silently returning a QDCGT number) | mitigated | That arm returns `scopeRefusal(...)`; mutation 5 confirms message and `unmodeled` are asserted, not merely the error kind |
| T-10-08-03 (a second refusal mechanism beside `scopeRefusal`) | mitigated | 5 `kind: 'error'` lines against 5 `scopeRefusal` call sites; `Line16Error` inherits the shape by intersection; mutation 5 constructs the alternative and is caught |
| T-10-08-04 (Form 2555 / 8615 / Schedule J computed as ordinary) | mitigated | Level 0 is outermost with a tag per wrapper; mutation 3 confirms demotion is caught |

## Verification

```
$ npm test
ℹ tests 451   ℹ pass 451   ℹ fail 0        (tsc clean)

$ node --test 2>&1 | grep -c '^✔ import("./fjs/'
449                                        (432 before this plan; +17, plan asked for >= 14)

$ node --test 2>&1 | grep -c '^✔ import("./fjs/tax/line16/module.f.js'
17

$ F=fjs/tax/line16/module.f.js
grep -c 'scopeRefusal' $F          -> 9    (>= 5 required); call sites: 5
grep -c "kind: 'error'" $F         -> 5    (== 5 call sites)
grep -c 'LEVEL 0\|LEVEL 1\|LEVEL 2\|LEVEL 3' $F -> 4   (>= 4 required)
grep -c 'method:' $F               -> 12   (a method on every returned outcome)
grep -c 'scheduleDConditionsOutrankQualifiedDividends' $F -> 6  (>= 2 required)
branch table rows: 4, against hand-typed expectedTaxThreeBranchCount = 4
```

## Concurrency notes

Sole executor for the whole run. Only `fjs/tax/line16/module.f.js` was ever staged, by explicit
path; every revert was `git checkout -- fjs/tax/line16/module.f.js`. No `git clean`, no blanket
reset, no snapshot run needed — every red observed was one this execution caused.

## Self-Check: PASSED

- `fjs/tax/line16/module.f.js` — FOUND
- commit `7a7279d` — FOUND
- commit `a6153dc` — FOUND
- `npm test` — 451 tests, 451 pass, 0 fail, `tsc` clean, working tree clean
