# Form 8995 line 6 — qualified REIT dividends (Form 1099-DIV box 5)

**Status:** specified, implemented on `feature/tier-a-refused-kinds`
**Kind:** `qualifiedReitDividendsAndPtpIncome` — **stays refused**, see
[Reclassification](#reclassification--not-done-here-and-not-recommended-whole)
**Printed lines:** Form 8995 lines 6-10 and 17, Form 8995-A lines 28-32 and 40
→ 1040 line 13a

## What is missing

§199A(b)(1)(B) gives a **second, independent component** of the qualified
business income deduction: 20% of the aggregate of the taxpayer's qualified
REIT dividends and qualified publicly traded partnership income. It is
independent in the strong sense — it needs **no trade or business at all**, it
is **not** reduced by §199A(b)(2)(B)'s W-2-wage/UBIA cap, and it is **not**
phased out for a specified service trade or business. A retiree whose only
holding is a REIT index fund is entitled to it.

Form 8995 line 6 collects it; lines 7-10 and 17 are already written and consume
line 6 (`fjs/form8995/module.f.js:405-455`). Form 8995-A's lines 28-32 and 40
are the identical arithmetic on the above-threshold page
(`fjs/form8995a/module.f.js:601-645`). **Both were `const line6 = 0n` /
`const line28 = 0n`.**

`vnd.fjs.1099div` has carried `box5Section199ADividends` since the dialect
shipped (`fjs/document/1099div/module.f.js:138`), inside the dialect's own
money-exactness loop (`:176`), so every stored value is already validated to
the cent — and **no computation read it.** The `box13StatutoryEmployee` shape
this repository has already paid for twice: a box modeled at storage, validated
at storage, and dropped at computation.

The holding is not exotic. Any brokerage statement covering a REIT or a REIT
index fund reports box 5, and a RIC may report §199A dividends of its own under
Reg. §1.199A-3(d). The engine silently dropped a real deduction for a very
common position.

## The computation

No floor, no threshold of its own, no worksheet, no attached form. The box IS
the computation:

    line 6  = Σ box 5  over every stored Form 1099-DIV
    line 7  = 0        (see below)
    line 8  = max(line 6 + line 7, 0)
    line 9  = 20% of line 8          §199A(b)(1)(B)
    line 10 = line 5 + line 9        the two components added

and on Form 8995-A, lines 28/29/30/31/32 are the same five in the same order.

**The 20% is `fjs/tax/params`' one `ratePercent`**, read through the same
`percentOfCents` line 5 and line 14 already use — §199A has ONE rate and it is
stored once.

**The income limitation still applies to the total.** §199A(a)(1)(B) caps the
whole deduction at 20% of taxable income less net capital gain, which is
printed line 14 (line 36 on Form 8995-A), and line 15 takes the lesser of it
and line 10. So a REIT dividend does not escape the limitation — it escapes the
*wage/UBIA* limitation, which is a different thing.

## Why line 7 stays a structural zero

Printed line 7 is the prior-year qualified REIT dividend / PTP **loss**
carryforward, and §199A(c)(2)'s one-tax-year argument that makes
{@link priorYearCarryforwardIsUnstated} refuse for line 3 would apply here too
— *if line 6 could ever be negative*.

It cannot, in this engine:

- A **qualified REIT dividend is a dividend**. `vnd.fjs.1099div`'s money-box
  check rejects a box that is not an exact decimal amount, and a REIT does not
  distribute a negative §199A dividend. Box 5 is non-negative by construction.
- A **qualified PTP loss** is the only way line 6 goes negative, and PTP income
  cannot reach this engine at all: it arrives on a Schedule K-1 as box 20
  code Z (partnership) or box 17 code V (S corporation), and
  `fjs/schedule/e`'s `section199AInformationRefusal` refuses the WHOLE return
  by name for either — a document-data refusal, so it fires regardless of what
  the profile declared.

So within what this engine can compute, nothing can ever have carried forward
into line 6, and reading line 7 as zero cannot overstate the deduction.

**This argument is load-bearing on the PTP half staying refused**, and it is
the first of two reasons the kind must not be reclassified whole. It is stated
here rather than only in a comment because the day someone wires PTP income is
the day line 7 has to become an assertion, exactly as line 3 already is.

## The holding-period caveat, stated rather than modeled

Reg. §1.199A-3(c)(2)(ii) excludes a REIT dividend received on stock **held for
45 days or less** during the 91-day window around the ex-dividend date, or to
the extent the taxpayer is under an obligation to make related payments; Reg.
§1.199A-3(d)(3)(ii) does the same for a RIC's §199A dividends. The payer cannot
know the shareholder's holding period, so box 5 is reported without regard to
it, and reading box 5 as line 6 assumes the test is met.

**This engine follows the box, and the precedent is already in the file.**
Form 1099-DIV box 1b carries the identical structure — §1(h)(11)(B)(iii)'s
61-day holding period, unknowable to the payer — and `fjs/form1040/core` reads
box 1b unconditionally into 1040 line 3a. One rule, applied the same way twice.
The direction of the residual error is named rather than hidden: for a filer
who bought a REIT inside the window, the box overstates line 6 and therefore
the deduction. No dialect field records a holding period, and inventing one
would be a stored field with no reader.

## Citation contract

**One `Source` per contributing Form 1099-DIV**, with the exact box path:

    { documentHash, boxPath: 'box5Section199ADividends', value: <the box, verbatim> }

through `sumBoxOverDocuments`, which is where `fjs/form1040/core` already reads
boxes 1a, 1b, 2a and 4 off the same documents. That gives the
present-not-value rule for free and it is the right one here:

- a box **present and `'0.00'`** cites its own 1099-DIV — the taxpayer holds a
  form that says the amount is zero;
- a box **absent** contributes no source at all (DOC-11), and if nothing else
  put a source on line 13a the line falls back to the profile's `declaredKinds`
  box, exactly as it does today.

Same rule as `earlyWithdrawalPenaltyLine` in `fjs/schedule/1`. The two are the
same number and different facts.

## Wiring — and the gate that had to change

`fjs/form1040/core` already had the 1099-DIVs in scope: `dividendForms` feeds
lines 3a, 3b, 7a and 25b. Threading `qualifiedReitDividendsCents` into the
§199A call site is one more `sumBoxOverDocuments`.

**The load-bearing edit is the OTHER one.** 1040 line 13a was gated on
`scheduleOnePartIResult.scheduleC.filed`:

    const line13a = scheduleOnePartIResult.scheduleC.filed ? { … } : declaredZero('1040 line 13a')

which is correct while the deduction has only a qualified-business-income
component and **wrong the instant it has a REIT component**: the retiree with a
REIT index fund and no business has `filed === false`, so the whole computed
deduction would have been thrown away one line after being computed. The gate
becomes "a Schedule C was filed **or** a 1099-DIV reported box 5", and the box 5
sources join line 13a's own citation union so the line cites the box it
deducted.

This is the same defect shape `15c30af` found by mutation one commit earlier: a
form-level proof cannot see its result being discarded by its caller.

## Proofs

Hand-typed expected values in integer cents, dollar figure in the assertion
message, never produced by the code under test. **Value and citation asserted
by separate leaves.**

Form-level, `fjs/form8995`:

- REIT dividends with **no business at all** → lines 6/8/9/10/15, and a
  deduction on a return with zero QBI
- REIT dividends **beside** a business → line 10 is the sum of both components,
  with each component asserted separately so a wiring that dropped one is
  visible
- the **income limitation** still caps the combined figure
- line 7 and line 17 stay zero; line 17's floor is the opposite of line 8's

Form-level, `fjs/form8995a`:

- REIT dividends reach line 28 → 30 → 31 → 32 → 39 above the threshold
- **the two forms agree on the REIT component to the cent**, at the same
  dividend, so a page-specific transcription error is caught
- the component is NOT reduced by the wage/UBIA cap: a business whose cap binds
  to zero still gets the whole REIT component

End to end, `fjs/form1040/core` — **required, not optional**:

- a return with **one 1099-DIV box 5 and no Schedule C** reaches 1040 line 13a,
  asserted absolutely AND as a differential against the identical return with
  box 5 removed
- line 13a **cites** `box5Section199ADividends` under the right document hash
- the same dividend on an **above-threshold** return reaches line 13a through
  Form 8995-A, at the same figure — the 8995/8995-A branch, observed from the
  report

## Mutations to run before claiming the proofs work

- line 6 forced to `0n`
- the 20% rate altered
- box 5 transposed to another 1099-DIV box
- line 9 dropped from line 10
- Form 8995-A line 28 forced to `0n` (the two forms made to disagree)
- `fjs/form1040/core` handing the deduction an empty dividend list
- the `scheduleC.filed || box 5 present` gate narrowed back to `scheduleC.filed`

## Reclassification — NOT done here, and not recommended WHOLE

`fjs/return/scope/module.f.js` is out of scope for this work by instruction, so
the kind stays in `unmodeledKindRefusals` and the edits are reported rather than
made. **That is the right outcome on the merits as well**, and the reason is not
procedural:

`qualifiedReitDividendsAndPtpIncome` names **two** things. This work makes one
of them computable. The other — qualified publicly traded partnership income —
is not merely unimplemented; it is refused twice over, by
`fjs/schedule/e`'s `section199AInformationRefusal` on box 20 code Z and box 17
code V. Moving the row to `modeledKinds` would tell a taxpayer holding an
Enterprise Products or Energy Transfer K-1 that this engine computes their
§199A deduction, and it does not. **That is precisely the overstatement of
capability TAX-16 exists to prevent** — and it would be worse than the original
gap, because the original gap at least refused loudly.

**The remedy string is now false, and that is a separate edit.**
`fjs/return/scope/module.f.js:743` says the deduction *"requires Form 1099-DIV
box 5 (§199A dividends), which `vnd.fjs.1099div` stores and no computation
reads"*. As of this work a computation reads it. Left alone it becomes the
stale-remedy defect `15c30af` found one commit earlier — a refusal that names
the wrong missing thing sends a taxpayer to fix something that is not broken.
The corrected row is the PTP one below.

The honest sequence is **split, then reclassify half**:

1. `fjs/return/profile`'s kind vocabulary replaces
   `qualifiedReitDividendsAndPtpIncome` with `qualifiedReitDividends` and
   `qualifiedPubliclyTradedPartnershipIncome` (vocabulary count +1).
2. `qualifiedReitDividends` goes to `modeledKinds` in the same commit as this
   wiring; `qualifiedPubliclyTradedPartnershipIncome` stays in
   `unmodeledKindRefusals`, its remedy naming Schedule K-1 box 20 code Z /
   box 17 code V and `fjs/schedule/e`'s refusal — **and naming the prior-year
   PTP loss carryforward on printed line 7**, because a taxpayer with a
   prior-year PTP loss and only REIT dividends this year is the one case where
   line 7's structural zero would be wrong, and the refusal is what keeps them
   out.
3. The counts: `expectedModeledKindCount` 41 → 42,
   `expectedUnmodeledKindCount` 73 → 73 (`73 − 1 + 1`), which is a count that
   does **not** move through a phase that changed two rows — exactly the case
   AGENTS.md says a hand-typed constant proves nothing on its own, so
   `theHandTypedListNamesEveryModeledKind` and the `fjs/return/profile`
   vocabulary count (which DOES move) are what catch it.

Until step 1 lands, a taxpayer who declares the coarse kind is still refused
whole, and a taxpayer who declares nothing but holds a 1099-DIV with box 5 gets
their real deduction — the same "a modeled line reports what the documents say"
rule 1040 lines 3a/3b already follow.

## Not in scope

- **Qualified PTP income**, above.
- **The §199A(g) DPAD** for patrons of agricultural or horticultural
  cooperatives (Form 8995 line 15's tail, Form 8995-A line 38). A patron must
  file Form 8995-A regardless of income and reads Form 1099-PATR, which no
  dialect models.
- **Box 5 on a Schedule K-1.** A partnership or S corporation can pass through
  qualified REIT dividends on the same box 20 code Z / box 17 code V statement,
  and that whole statement is refused today. Nothing here changes it.
