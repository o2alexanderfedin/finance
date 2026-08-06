---
phase: 10-form-1040-core-line-16-dispatch-and-the-scope-guard
plan: 10
subsystem: form-1040-core-lines
tags: [form-1040, whole-report-refusal, scope-guard, line-16-dispatch, criterion-1, criterion-4, phase-10]

requires:
  - phase: 10-09
    provides: "form1040IncomeLines (lines 1a-15), unionSources, documentLine, profileDeclaredZeroLine, totalLine, BoxSum, Form1040Inputs, Stored<T>"
  - phase: 10-08
    provides: "dispatchLine16 and Line16Outcome — the four-way tagged method dispatch, method carried on BOTH arms"
  - phase: 10-07
    provides: "classifyScope and scopeRefusal — the ONE place a scope refusal is built, and the frozen modeled/unmodeled partition"
  - phase: 10-04
    provides: "vnd.fjs.return_profile — declaredKinds, wholeDollarElection, line26EstimatedTaxPayments, line35aRefundRequested, line36AppliedToNextYear"
  - phase: 10-02
    provides: "applyWholeDollarElection — the i1040gi p23 all-or-nothing election over a whole report"
provides:
  - "form1040Report — the whole-return entry point: lines 1a-37 for an in-scope return, or a refusal naming what is unmodeled"
  - "Form1040Outcome — the discriminated whole-report outcome whose error arm CANNOT carry a line list (enforced by tsc, see the finding below)"
  - "Form1040TaxAndPaymentLines — lines 16 through 37 as a record keyed by the printed line label"
  - "The TAX-16 artefact: the 65+ declared profile refuses naming line 13b/Schedule 1-A and line 19/Schedule 8812, with a control that computes"
affects: [11, 12, 13]

tech-stack:
  added: []
  patterns:
    - "An exclusive union arm needs `field?: undefined`, not merely the field's omission: TypeScript's excess-property check against a UNION admits any property declared in ANY constituent, so omission states the property without enforcing it"
    - "A rule whose floor is unreachable through the public entry point is given its own named function, so a proof can reach the one place it lives — the alternative is an equivalent mutant nobody can watch fail"
    - "declaredKinds narrowed by FINDING each name in the frozen vocabulary and asserting nothing was dropped, never by widening the guard's parameter: a widened guard classifies a typo as 'not unmodeled'"
    - "A line-16 method name table typed `Record<Line16Method, string>` with no default, so a new branch cannot ship reported as something it is not"

key-files:
  created: []
  modified:
    - fjs/form1040/core/module.f.js

key-decisions:
  - "Line 22's floor lives in a named function `line22TaxLessNonrefundableCredits` because it is UNREACHABLE through a whole report in this phase — lines 19 and 20 are profile-declared zeros (their kinds refuse the whole report), so line 21 is always 0n and `18 - 21` can never go negative. Written through the report only, the plan's mutation 1 would have been an equivalent mutant with no leaf able to see it"
  - "Lines 26, 35a and 36 fall back to profileDeclaredZeroLine when their profile box is ABSENT, rather than citing that box with a synthesized '0.00'. DOC-11: an absent box is absent, and a citation quoting a value no document contains is not a citation. The line still cites the profile either way, which is what the plan asked for"
  - "The error arm of Form1040Outcome declares `readonly lines?: undefined`. The plan's stated mechanism — omitting the field — does NOT compile-error, verified twice (see the finding below). This is the smallest change that makes T-10-10-02 a real type error"
  - "expectedWholeReportLineCount = 56 is hand-typed and paired with a DISTINCT-rule count, because a hand-typed length alone cannot see a line duplicated into the ordered list in place of another"
  - "Task 1's proofs call the private `form1040TaxAndPaymentLines`/`computeForm1040` directly; Task 2's go through the exported `form1040Report`. Both layers are exercised, and the guard's ordering is observable separately from the arithmetic it guards"

patterns-established:
  - "Pattern: when a mutation the plan predicted would fail `tsc` COMPILES, that is a finding about the type system, not a mis-run — record the mechanism at the type and close the hole rather than downgrading the claim"
  - "Pattern: the Tax Computation Worksheet IS bracket arithmetic, so a 'line 16 is bracket arithmetic' mutation is an equivalent mutant at or above $100,000 and can only be watched failing below it, where the Tax Table's midpoint rows disagree"

requirements-completed: [TAX-05, TAX-16, TAX-03]
requirements-note: "TAX-05 (Form 1040 core lines 1a-37) is complete: 10-09 shipped 1a-15, this plan 16-37. TAX-16 (loud refusal of unmodeled input) is complete at the report layer: the whole report refuses, naming every unmodeled declared kind. TAX-03 (explicit line-16 method dispatch) was shipped by 10-08 and is closed here by its only production consumer — `grep -c cumulativeBracketTaxCents` in this module is 0."

duration: ~95min
completed: 2026-08-06
---

# Phase 10 Plan 10: Form 1040 Lines 16–37, and the Whole-Report Scope Refusal Summary

**`form1040Report` returns all 56 printed money lines of Form 1040 — 1a through 37, each citing the
documents it derived from and line 16 tagged with the method that produced it — or refuses the
WHOLE return by name, with no line list to render.** Three of the phase's five ROADMAP criteria
close here, and one of the plan's own predicted mutations turned out to be false and was fixed
rather than recorded.

## What shipped

| Piece | Where | What it does |
|---|---|---|
| `form1040Report` | `fjs/form1040/core/module.f.js` | The whole-return entry point: scope guard, then lines 1a-37, then the whole-dollar election, once |
| `Form1040Outcome` | same | `{kind:'ok', lines, line16Method}` \| `{kind:'error', message, unmodeled, lines?: undefined}` |
| `Form1040TaxAndPaymentLines` | same | Lines 16-37 keyed by the printed label |
| `line22TaxLessNonrefundableCredits` | same (private) | The one rule in this file a whole report cannot reach |
| `declaredKindsOf` | same (private) | `readonly string[]` → `readonly Kind[]`, by finding each name in the frozen vocabulary |

Lines 16-37, exactly as the printed form states them: `16` from `dispatchLine16`; `17`, `19`, `20`,
`23`, `25c`, `27a`, `28`, `29`, `30`, `31` profile-declared zeros; `18 = 16+17`; `21 = 19+20`;
`22 = max(18-21, 0)`; `24 = 22+23`; `25a` = W-2 box 2 summed, `25b` = 1099-INT box 4 summed,
`25d = 25a+25b+25c`; `26`, `35a`, `36` off the profile's own money boxes; `32` = the five refundable
credits; `33 = 25d+26+32`; `34 = 33-24 if positive else 0`; `37 = 24-33 if positive else 0`.

## The three criteria this closes

**Criterion 1 — lines 1a-37 compute, each citing the documents it derived from.** 56 lines, every
one with a non-empty `sources` tuple that `tsc` will not let it omit.
`wholeReport.everyOneOfTheFiftySixLinesCitesADocumentAndNamesItsRule` asserts the hand-typed count,
the DISTINCT rule count, and per-line citation and rule.

**Criterion 4 — an unmodeled input produces a loud refusal naming what is unmodeled.** The whole
report is the error outcome (Decision 2). `scopeRefusal` is the sole refusal builder; this module
imports the message and the `unmodeled` list and constructs neither.

**Criterion 2's Schedule D arm** — reached through `dispatchLine16`, whose refusal names
unrecaptured §1250 gain and 28%-rate gain. Pinned by 10-08's leaves and re-confirmed under sweep
site 4 below.

## Line-count enumeration

The plan's 56 was reproduced independently and **agrees**: 1a-1i (9), 1z, 2a, 2b, 3a, 3b, 4a, 4b,
5a, 5b, 6a, 6b, 7a, 8, 9, 10, 11a, 11b, 12e, 13a, 13b, 14, 15 = **31**; 16-24 (9), 25a-25d (4), 26,
27a, 28, 29, 30, 31 (5+1), 32, 33, 34 (3), 35a, 36, 37 = **25**. `31 + 25 = 56`. 12a-12d and 7b are
checkboxes on the profile, and line 38 is outside "1a-37".

## Task 1 mutations — all four run, one at a time, each reverted

Baseline before Task 1: **471** project-local leaves. After: **482**.

### 1. Line 22's `max(18 - 21, 0n)` → `18 - 21` — RED, 1 leaf

```
1	1	fjs/form1040/core/module.f.js
✖ import("./fjs/form1040/core/module.f.js").proof.line22.creditsExceedingTaxFloorAtZeroNeverNegative()
ℹ tests 484  pass 483  fail 1
```

**This mutation only bites because line 22 was given its own named function.** Written inline, the
floor is an EQUIVALENT MUTANT: line 21 is `19 + 20`, both profile-declared zeros in this phase, so
line 21 is always `0n` and `18 - 21` can never be negative. No whole-report leaf could ever have
watched the floor work, and deleting it would have left the suite green. Recorded at the site.
Phase 13's Schedule 8812 and Schedule 3 make it reachable end to end.

### 2. Line 25d drops the `25b` term — RED, 1 leaf

```
1	1	fjs/form1040/core/module.f.js
✖ ...proof.withholding.twentyFiveDSumsTwentyFiveAAndTwentyFiveBCitingEveryBox()
  [ 750000n, 751000n, '$7,510.00 of total withholding' ]
ℹ tests 484  pass 483  fail 1
```

The VALUE assertion fires first ($7,500.00 instead of $7,510.00). The provenance assertion behind
it — 4 citations instead of 3 — is in the same leaf and would fire on any input where the value
happened to agree.

### 3. Lines 34 and 37 swapped — RED, **3** leaves (predicted 2)

```
2	2	fjs/form1040/core/module.f.js
✖ ...refundOrAmountOwed.paymentsExceedingTaxAreAnOverpaymentOnLineThirtyFour()  [ 0n, 43800n, 'an overpayment of $438.00' ]
✖ ...refundOrAmountOwed.taxExceedingPaymentsIsTheAmountOwedOnLineThirtySeven()  [ 256200n, 0n, 'a return that underpaid has no overpayment' ]
✖ ...profileDeclaredAmounts.linesTwentySixThirtyFiveAAndThirtySixComeOffTheProfilesOwnBoxes()  [ 0n, 123456n, 'the whole payment is an overpayment' ]
ℹ tests 484  pass 481  fail 3
```

Both predicted leaves fired, so neither case is untested. The third was a surprise in the useful
direction: the profile-money-box leaf drives $1,234.56 of estimated payments against a zero-tax
return, so it observes line 34's direction too.

**GREEN, with the arithmetic that made it green:** `paymentsExactlyEqualToTaxLeaveBothLinesZero`.
When line 33 equals line 24, both `33 > 24` and `24 > 33` are false and both lines are `0n` under
either direction. The tie case cannot see a swap, which is exactly why it is a control and not
evidence.

### 4. Line 16 as bracket arithmetic — RED, **4** leaves

```
3	1	fjs/form1040/core/module.f.js     (the value line, plus the two imports it needs)
✖ ...line16.marriedFilingJointlyTwentyFiveThreeHundredIsThePrintedTaxTableExample()
  [ 255900n, 256200n, "the printed Tax Table Example's own answer, $2,562.00" ]
✖ ...refundOrAmountOwed.paymentsExceedingTaxAreAnOverpaymentOnLineThirtyFour()  [ 255900n, 256200n ]
✖ ...refundOrAmountOwed.taxExceedingPaymentsIsTheAmountOwedOnLineThirtySeven()  [ 255900n, 256200n ]
✖ ...refundOrAmountOwed.paymentsExactlyEqualToTaxLeaveBothLinesZero()           [ 255900n, 256200n ]
ℹ tests 484  pass 480  fail 4
```

**Both values, as the plan asked.** Tax Table, MFJ, $25,300.00 of taxable income: **$2,562.00**
(the band $25,300–$25,350's midpoint $25,325 taxed at 10% to $23,850 then 12%, rounded to the
dollar). Bracket arithmetic on the same $25,300.00: **$2,559.00**. The gap is **$3.00**, understated,
silently, in the taxpayer's favour — and it is why TAX-02 and TAX-03 are separate requirements.

**GREEN, and worth writing down:** `singleAtOneHundredThousandSelectsTheTaxComputationWorksheet`.
At or above $100,000 the Tax Computation Worksheet **is** `halfUp(cumulative bracket tax)` —
`fjs/tax/table` implements it as exactly that expression — so above the table's ceiling this
mutation is an equivalent mutant by construction. The defect can only be watched failing BELOW
$100,000, where the printed table's midpoint rows disagree with the brackets. The `halfUp(...)`
wrapper the plan added was required: without it the mutation does not typecheck
(`Rational` vs `bigint`).

## Task 2 mutations — all four run, one at a time, each reverted

Leaves after Task 2: **490**.

### 1. Guard moved AFTER the computation, result ignored — RED, **3** leaves

```
2	4	fjs/form1040/core/module.f.js
✖ ...form1040Report.theSixtyFivePlusProfileRefusesTheWholeReportNamingBothUnmodeledKinds()
✖ ...form1040Report.socialSecurityBenefitsRefuseTheWholeReportNamingTheLineAndTheDialect()
✖ ...form1040Report.theErrorArmCarriesNoLinesFieldAtAll()
ℹ tests 492  pass 489  fail 3
```

**Three proofs stand between this engine and a silently partial 1040** at the report layer, and
`fjs/return/scope`'s own ten stand behind them. Every control leg stayed green, which is what says
the three are testing the refusal and not the guard's existence.

### 2. `classifyScope(declaredKinds)` → `classifyScope([])`

**First attempt did not compile** — AGENTS.md's failure mode 1, exactly as written:

```
fjs/form1040/core/module.f.js(895,7): error TS6133: 'declaredKindsOf' is declared but its value is never read.
```

Re-run as the semantically identical edit that keeps the binding live —
`classifyScope(declaredKindsOf(profile).slice(0, 0))`:

```
1	1	fjs/form1040/core/module.f.js
✖ ...form1040Report.theSixtyFivePlusProfileRefusesTheWholeReportNamingBothUnmodeledKinds()
✖ ...form1040Report.socialSecurityBenefitsRefuseTheWholeReportNamingTheLineAndTheDialect()
✖ ...form1040Report.theErrorArmCarriesNoLinesFieldAtAll()
ℹ tests 492  pass 489  fail 3
```

Same three refusal leaves red; every control leaf green. Both results recorded, as required.

### 3. A `lines` field on the error arm — **THE PLAN'S PREDICTION WAS WRONG, AND IT WAS A REAL HOLE**

The plan predicted this would not typecheck. **It compiled clean.** Twice:

```
# variant a — a genuinely partial line list
        const partial = computeForm1040(taxParamSet)(inputs)
        return { kind: 'error', message: scope.message, unmodeled: scope.unmodeled,
                 lines: partial.kind === 'ok' ? partial.lines : [] }
tsc: (no output, exit 0)   →  node --test then ran the whole suite GREEN

# variant b — the empty-array form the docstring specifically argues against
        return { kind: 'error', message: scope.message, unmodeled: scope.unmodeled, lines: [] }
tsc: (no output, exit 0)
```

**Mechanism.** TypeScript's excess-property check against a UNION admits any property declared in
ANY constituent. `lines` is declared in the `ok` constituent, so the `kind: 'error'` discriminant
never narrows the check. Omitting the field states the property; it does not enforce it. T-10-10-02
was therefore **unmitigated** as designed, and the docstring's claim that "adding one back does not
compile" was false as written.

**Fix (deviation Rule 2), committed separately as `466d209`:** declare `readonly lines?: undefined`
on the error member. That turns it into an assignability question, and both variants now fail:

```
fjs/form1040/core/module.f.js(976,46): error TS2322: ...is not assignable to type 'Form1040Outcome'.
        Types of property 'lines' are incompatible.
          Type 'readonly ReportLine[]' is not assignable to type 'undefined'.

# and for the empty-array variant:
          Type 'never[]' is not assignable to type 'undefined'.
```

The runtime shape is unchanged — nothing sets the key, and `theErrorArmCarriesNoLinesFieldAtAll`
asserts its absence with `Object.hasOwn`, not `in` and not `!== undefined`. The one guarantee this
trades away is recorded at the type: reading `outcome.lines` without narrowing is now legal and
yields `readonly ReportLine[] | undefined`, where it used to be a compile error. A caller still
cannot obtain a partial list, because none can be constructed. Mutations 1, 2 and 4 were re-run
against the committed fix and produced identical red sets.

### 4. `applyWholeDollarElection(profile.wholeDollarElection === true)` → `(false)` — RED, 1 leaf

```
✖ ...form1040Report.theWholeDollarElectionRoundsEveryLineOfTheReportOnce()
  [ 1390n, 1400n, '$14, rounded once' ]
ℹ tests 492  pass 491  fail 1
```

The control — `controlWithoutTheElectionTheSameTenDocumentsKeepTheirCents`, the same ten $1.39
documents with no election — stayed green, so the leaf is testing the election and not the
rounding.

## Task 3 — the phase mutation sweep, five sites

Run in the real tree (sole executor, clean tree), one mutation at a time, each reverted before the
next, `git diff --numstat` on the real tracked file. **`cp -a` was deliberately NOT used**: `.git`
here is a *file* pointing at an absolute worktree gitdir whose `core.worktree` points back at the
real tree, so a `git checkout --` inside such a copy would have restored the REAL file, not the
copy's. AGENTS.md's caution about a copy sharing the real repo's git directory is stronger in a
worktree than in a plain clone.

### Site 1 — QDCGT line 25 `min` → `max`: 9 leaves RED ✔ as predicted

```
1	1	fjs/tax/line16/qdcgt/module.f.js
✖ line16.branches.qualifiedDividendsSelectQdcgtOnRegressionCaseA()
✖ line16.branches.qualifiedDividendsSelectQdcgtOnRegressionCaseB()
✖ line16.branches.controlFormFourNineFiveTwoWithZeroLineFourGStillSelectsQdcgt()
✖ line16.ordering.controlSameInputsWithZeroEighteenAndNineteenSelectQdcgt()
✖ qdcgt.regressionPairCaseAAllTwentyFiveLines()
✖ qdcgt.regressionPairCaseBAllTwentyFiveLines()
✖ qdcgt.controlMinSelectsLineTwentyThreeWhenLineTwentyThreeIsAlreadySmaller()
✖ qdcgt.splitDispatchProducesLineSixteenOfThirteenThousandEightHundredTwentyOne()
✖ qdcgt.allThreePreferentialRatesWithBothBaseLookupsInOneExecution()
ℹ tests 492  pass 483  fail 9
```

Both regression cases **and** the control, exactly as the plan required.

### Site 2 — QDCGT **line 7** `min(L1, L6)` → `L6`: 2 leaves RED, **the predicted differential** ✔

```
1	1	fjs/tax/line16/qdcgt/module.f.js
✖ qdcgt.controlMinSelectsLineTwentyThreeWhenLineTwentyThreeIsAlreadySmaller()
✖ line16.ordering.profileWithNoPreferentialIncomeNeverReachesLevelTwo()
ℹ tests 492  pass 490  fail 2
```

The plan's correction to the research is confirmed: **line 6 is the constant** (`$96,700` MFJ) and
**line 7 is the `min`**. The `$90,000 / $10,000` control the plan names is
`controlMinSelectsLineTwentyThreeWhenLineTwentyThreeIsAlreadySmaller`, and it went red.

**GREEN, with the arithmetic:** both regression cases stayed green because in case A line 1 is
`$97,000.00` and in case B `$96,999.00`, and **both exceed line 6's `$96,700.00`** — so
`min(L1, L6)` already IS `L6` on exactly those two inputs and the mutation is a no-op there. The
second red leaf is the one that runs `$50,000` of taxable income with qualified dividends, where
line 1 is below line 6 and the `min` selects line 1.

### Site 3 — `agedOrBlindIncrementFor.marriedFilingSeparately` `'married'` → `'unmarried'`: exactly 4 RED ✔

```
1	1	fjs/tax/deduction/module.f.js
✖ deduction.marriedFilingSeparately_1Boxes()
✖ deduction.marriedFilingSeparately_2Boxes()
✖ deduction.marriedFilingSeparately_3Boxes()
✖ deduction.marriedFilingSeparately_4Boxes()
ℹ tests 492  pass 488  fail 4
```

**Exactly the four non-zero MFS chart rows**, as predicted. `marriedFilingSeparately_0Boxes` stayed
green because the increment is multiplied by a box count of zero, so which of the two amounts is
selected is unobservable there. This is the trap 10-CONTEXT.md records — MFS takes single's base
with **married's** increment — and it is now watched failing.

### Site 4 — dispatch order, level 2c moved above level 2a: 6 RED, **all method-tag, no cents-only** ✔

```
5	5	fjs/tax/line16/module.f.js   (a block move, not a token edit)
✖ line16.branches.scheduleDLineNineteenRefusesNamingUnrecapturedSection1250Gain()
✖ line16.branches.scheduleDLineEighteenRefusesNamingTwentyEightPercentRateGain()
✖ line16.branches.formFourNineFiveTwoWithLineFourGRefusesNamingTheElection()
✖ line16.ordering.scheduleDConditionsOutrankQualifiedDividends()
✖ line16.exhaustiveness.dispatchIsExhaustiveOverTheFourTaxThreeBranches()
✖ line16.exhaustiveness.everyRefusingArmNamesWhatIsUnmodeled()
ℹ tests 492  pass 486  fail 6
```

Every red leaf asserts a **selected method**. **Not one cents-only proof moved** — the whole QDCGT
worksheet, both regression cases and criterion 2 stayed green, which is the point: with Schedule D
lines 18 and 19 zero the two worksheets are algebraically identical, so the number cannot see the
order.

Two greens worth naming. `scheduleDBranchIsReachableWithoutQualifiedDividends` stayed green by
design — with line 3a at zero, level 2c never fires and the reordering is invisible; its own
docstring already says so, and this run confirms it. `controlSameInputsWithZeroEighteenAndNineteenSelectQdcgt`
stayed green because that return legitimately belongs to the QDCGT under either order.

One effect **beyond** the prediction: `formFourNineFiveTwoWithLineFourGRefusesNamingTheElection`
also reddened. Level 2b (Form 4952) sits physically between 2a and 2c, so moving 2c above 2a moves
it above 2b as well. The mutation as specified is "2c above 2a **and** 2b"; a strict 2a/2c
transposition leaving 2b in place would redden five, not six.

### Site 5 — `classifyScope`'s comparison inverted: 18 RED, refusals **and** controls ✔

```
1	1	fjs/return/scope/module.f.js
# fjs/return/scope (10):
✖ scope.allSixModeledKindsDeclaredTogetherAreInScope()
✖ scope.socialSecurityBenefitsRefusesNamingItsLineLabelAndRemedy()
✖ scope.controlTheSameDeclarationWithoutSocialSecurityBenefitsIsInScope()
✖ scope.theRefusalMessageIsExactlyTheHandTypedSentence()
✖ scope.theSixtyFivePlusProfileRefusesNamingBothUnmodeledKinds()
✖ scope.controlTheSixtyFivePlusProfileWithoutThoseTwoKindsIsInScope()
✖ scope.unmodeledFollowsFormOrderNotDeclarationOrder()
✖ scope.everyUnmodeledKindRefusesNamingItsOwnLineAndLabel()
✖ scope.deliberateOmissionIsNotARefusal()
✖ scope.refusalIsABareValueShapeNotAnError()
# fjs/form1040/core (8): every form1040Report leaf except the two that do not classify
✖ form1040Report.theSixtyFivePlusProfileRefusesTheWholeReportNamingBothUnmodeledKinds()
✖ form1040Report.controlTheSixtyFivePlusProfileWithoutThoseTwoKindsComputesLinesOneAToThirtySeven()
✖ form1040Report.socialSecurityBenefitsRefuseTheWholeReportNamingTheLineAndTheDialect()
✖ form1040Report.controlTheSameDeclarationWithoutSocialSecurityBenefitsComputes()
✖ form1040Report.theErrorArmCarriesNoLinesFieldAtAll()
✖ form1040Report.theWholeDollarElectionRoundsEveryLineOfTheReportOnce()
✖ form1040Report.controlWithoutTheElectionTheSameTenDocumentsKeepTheirCents()
✖ form1040Report.scopeGuardAndZeroReadGuardAreOrthogonal()
ℹ tests 492  pass 474  fail 18
```

**The controls moved too, and that is the designed behaviour**, recorded in `classifyScope`'s own
docstring: the first filter IS the rule (declared MINUS modeled), so inverting it breaks the `ok`
path as well as the refusal path. An inverted guard refuses every legitimate return and then throws
when asked to name nothing — which is what the control legs exist to catch.

**GREEN:** `scope.emptyDeclarationIsInScope`. With no declared kinds both the rule and its inversion
produce the empty set, so a return declaring nothing is in scope under either. An equivalent mutant
at that one input.

## Plan defects found

1. **Task 2 mutation 3's prediction was false, and the property it claimed was unenforced.** Omitting
   `lines` from the error arm does not make adding it a compile error — TypeScript's union
   excess-property rule admits it. Fixed by `readonly lines?: undefined` (commit `466d209`); full
   transcript above. This is the plan's most valuable defect: the mitigation for T-10-10-02 did not
   exist as designed, and only running the mutation found it.
2. **Task 1's `<behavior>` for line 22 is not satisfiable through the report.** "A return with
   credits exceeding tax has `0n`" cannot occur while lines 19 and 20 are declared zeros, so the
   plan's mutation 1 would have been an equivalent mutant. Resolved by giving line 22 its own named
   function so the rule has one reachable place, rather than by weakening the behaviour.
3. **Task 2's acceptance criterion `grep -c "classifyScope" == 1` is unsatisfiable.** The named
   import and the call site are two lines. Actual: `grep -c "classifyScope"` = **2**;
   `grep -c "classifyScope("` = **1**, which is what "one call site" means. Not worked around — the
   import was not disguised as a namespace import to make a grep pass.
4. **Task 3's numstat rule does not apply to two of the five sites.** Site 4 is a block move (5/5)
   and Task 1's mutation 4 needs two imports (3/1). Both were verified by asserting the exact source
   line before editing instead.
5. Research's "sweep site 2 — QDCGT line 6 `min(L1,L6)`" was already corrected by the plan to line 7,
   and the correction is confirmed: line 6 is the constant, line 7 is the `min`.

## Interpretation recorded rather than assumed

The plan says line 26 is "sourced at the profile's own box either way". An ABSENT
`line26EstimatedTaxPayments` box has no value to quote, and quoting `'0.00'` would put a figure in
the report's provenance that no document contains (DOC-11). The line is therefore sourced at the
profile **document** either way: the money box when present, the `declaredKinds` box when absent —
the same fallback every other zero line uses, through the same `documentLine` helper. Both halves
are pinned (`linesTwentySixThirtyFiveAAndThirtySixComeOffTheProfilesOwnBoxes` and
`anAbsentProfileMoneyBoxIsAZeroCitingTheDeclaration`).

## TDD gate compliance

The plan marks both tasks `tdd="true"`. There is no separate `test(...)` RED commit, for the reason
every prior plan in this phase gives: `npm test` is `tsc && node --test`, so a proof committed
before the function it calls does not compile, the tests never run, and the commit measures the
compiler rather than the suite. The RED evidence is the mutation transcripts above — eight
mutations plus five sweep sites, each watched failing on named leaves and reverted. Commit sequence:
`6925ebe` (feat, Task 1), `2e6d684` (feat, Task 2), `466d209` (fix, the mutation-3 hole).

## Known stubs

None. Every line 16-37 is computed from a real input or is a profile-declared zero citing the
declaration that makes it zero; no line returns a placeholder.

## Threat flags

None. The surface this plan adds — one exported function over already-validated inputs — is covered
by the plan's own register. T-10-10-02's mitigation was found to be absent and is now real; the
other four dispositions were verified by the mutations that name them.

## Verification

- `npm test`: **492 tests, 492 pass, 0 fail**, `tsc` clean.
- Project-local proof leaves: **471 → 490** (+19; the plan asked for ≥14, and ≥100 above the phase's
  318 baseline).
- `grep -c "cumulativeBracketTaxCents" fjs/form1040/core/module.f.js` = **0**.
- `grep -c "dispatchLine16" fjs/form1040/core/module.f.js` = **2** (import and call).
- `grep -c "instanceof Error" fjs/form1040/core/module.f.js` = **0**.
- `grep -c "line37\|line35a\|line25d"` = **23**.
- `grep -c "control\|CONTROL"` = **24** (the plan asked for ≥3).
- Working tree clean after every mutation.

## Self-Check: PASSED

- `fjs/form1040/core/module.f.js` exists and exports `form1040Report` (line 976).
- `10-10-SUMMARY.md` exists at the path the plan specifies.
- Commits `6925ebe`, `2e6d684`, `466d209` all present in `git log`.
