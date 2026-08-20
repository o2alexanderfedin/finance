# Form 8959 Part V runs for filers who are not required to file Form 8959

**Found:** Phase 33, running TaxCalcBench's 51 public TY2024 cases against this engine.
Five of the fifty-one diverged on this, each by exactly **$1**. Full context:
[`.planning/reports/taxcalcbench-33.md`](../../.planning/reports/taxcalcbench-33.md) §5.1.

**Status:** root-caused, specced, **not implemented**. The fix needs a stored tax
parameter this engine does not have, and adding one touches `TaxParamSet`,
`taxParamsByYear`, `paramSetHash`'s source order and `fjs/server/finance_tax_params`'s
hand-typed per-field literals and counts. AGENTS.md asks for the spec first.

## The defect

`fjs/form1040/core`'s 1040 line 25c is `scheduleTwoResult.form8959.line24`,
unconditionally, and `fjs/form8959`'s `form8959` computes Part V for **every** return
carrying a Form W-2 box 6:

```js
const partV = form8959PartV(taxParamSet)({ medicareTaxWithheldCents, partILine1: partI.line1 })
```

Part V itself is faithful to the printed page. Line 21 is 1.45% of box 5; line 22 is box 6
minus line 21, floored at zero. The problem is that it runs at all.

A Form W-2's box 6 is the employer's accumulation of per-pay-period Medicare tax, each
period rounded to the cent. It is therefore routinely a few cents away from exactly 1.45%
of box 5 — in **either** direction. This module's own docstring anticipates the negative
direction (*"the floor is load-bearing against per-pay-period rounding"*). It does not
anticipate the positive one, where the drift becomes a phantom "Additional Medicare Tax
withholding" credit on 1040 line 25c.

Worked, from `single-w2-balance-due-no-state-income-tax`:

```
box 5  = 145,000.00
box 6  =   2,103.00
line 21 = 1.45% x 145,000.00 = 2,102.50
line 22 =     2,103.00 - 2,102.50 =   0.50     <- not Additional Medicare Tax
line 24 =                             0.50
1040 line 25c, whole-dollar election ->  $1
```

## Why that is wrong

Form 8959 (2024), **Who Must File**, lists four conditions:

- box 5 on **any single** Form W-2 greater than $200,000;
- RRTA compensation on any single Form W-2 (box 14) greater than $200,000;
- total Medicare wages and tips **plus** self-employment income greater than the
  **threshold amount for the filing status** (200,000 / 250,000 MFJ / 125,000 MFS);
- RRTA compensation greater than that threshold.

A filer at $145,000 of box 5 with no self-employment income meets none of them. They do
not file Form 8959, so there is no line 24, and the 2024 Form 1040 instruction for line
25c — which directs an amount there only *from* Form 8959 line 24 — has nothing to carry.

The direction matters: the engine hands the taxpayer money on a form they are not filing.

## Why the existing proof did not catch it

`fjs/schedule/2` has `controlTheSameReturnBelowTheThresholdComputesSilently`, which
asserts that a return below the threshold *"mentions Form 8959 nowhere in any line's
rule"*. It asserts the **rule string**, not the value, and every fixture it runs sets box
6 to exactly 1.45% of box 5 — where line 22 is zero regardless. AGENTS.md's own recorded
shape: *"several assertions checked the wrong thing."*

## The fix

Gate Part V's contribution on Form 8959's own Who-Must-File test.

### The parameter it needs

**§3102(f)(1)'s employer withholding trigger: a flat $200,000, every filing status.**

This is **not** `additionalMedicareTaxThreshold`. That member is §1401(b)(2)'s per-status
threshold (200,000 / 250,000 / 125,000). The two coincide at $200,000 for a single filer
only because one Act drafted both, and reading `.single` to stand in for §3102(f)(1) is
exactly the error `fjs/return/profile` names in its own comment about `earnedIncome`:

> Two questions with the same name and different definitions is the error, not the
> duplication.

So: a new `TaxParamSet` member, hand-typed with its own `{ kind: 'code', section:
'§3102(f)(1)' }` citation, per this repository's rule that a value is stored once with the
authority it comes from.

Adding it means updating, in one commit: the `TaxParamSet` typedef, the `taxParamsByYear`
construction (whose key order `paramSetHash` is sensitive to — append or the hash moves),
`fjs/server/finance_tax_params`'s per-field literals, and the hand-typed counts that pair
with them (`expectedMoneyBoxFieldCount` / `expectedThresholdCount` idiom).

### The gate

An employer only withholds Additional Medicare Tax on wages it pays over $200,000, so a
gate on *total* Medicare wages exceeding $200,000 can never discard a real withholding —
one W-2 over $200,000 implies the total is too. Combined with "tax is owed anyway", the
condition is:

```
Part V contributes to 1040 line 25c  iff
    medicareWagesCents > §3102(f)(1) threshold        // an employer could have withheld
 || line18 > 0n                                        // Form 8959 is required anyway
```

Both terms are needed. Dropping the first loses a legitimate credit for the MFJ filer
with one $210,000 W-2 and $30,000 of spouse wages: total $240,000 is under the $250,000
status threshold so `line18` is zero, but the employer **did** withhold on the $10,000
over $200,000 and Who-Must-File's first bullet requires the form.

### Where to put it

Two candidate sites, and the choice is a real decision rather than a detail:

1. **Inside `fjs/form8959`'s `form8959`.** *"Computes Form 8959 for one return"* — and a
   form that need not be filed produces nothing, so `line24` would be zero. Most honest
   to what the function claims to be. Changes the meaning of `Form8959.line24` for every
   caller, and `fjs/schedule/2`'s existing leaves assert on it.
2. **At the consumption site in `fjs/form1040/core`**, leaving `form8959` a pure
   transcription of the printed arithmetic and putting the filing test where the 1040
   line is built. Keeps Part V's arithmetic independently testable; risks a future caller
   reading `line24` without the gate.

Prefer (1): the gate belongs to the form, and a `line24` that a caller can read
ungated is the same hazard in a different place.

## The proof, and how it must be watched

A leaf that pins the **value**, not the rule string, and it must be watched to fail:

- **Control:** a return below every Who-Must-File condition, box 6 at exactly 1.45% of
  box 5 — line 25c is $0.00. (Passes today; keeps the existing behaviour pinned.)
- **The leaf this defect needs:** the same return with box 6 **fifty cents above** 1.45%
  of box 5 — line 25c must still be $0.00. **Fails today at $1.00.** Watch it go red
  before the gate lands, and green after.
- **The gate's other side (a gate needs a control):** box 5 above $200,000 with real
  Additional Medicare Tax withheld — line 25c must carry it, unchanged from today.
- **The bullet-1 case:** MFJ, one W-2 at $210,000 and a spouse's at $30,000. Total
  $240,000 is under the $250,000 status threshold, so this is the leaf that fails if the
  gate is written against the status threshold instead of §3102(f)(1)'s flat $200,000.
  Without it, that mistake ships green.

Mutation to run afterwards, per AGENTS.md: flip the gate's `>` to `>=` and confirm at
least one leaf reddens. If none does, the boundary is untested — a neighbouring operation
is absorbing it, and the leaf that was meant to pin the boundary is decoration.

## Not to fix alongside it

The same run turned up a **$1 difference on line 24** in
`mfj-multiple-w2s-excess-social-security-tax`. That one is `round(sum)` versus
`sum(round)` — this project's deliberate, documented whole-dollar convention (AGENTS.md;
i1040gi p23 reads in its favour). It is not this defect, it is not a bug, and it must not
be "fixed" while fixing this one.
