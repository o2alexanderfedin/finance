# Schedule 3 line 1 — the foreign tax credit, under §904(j) only

`foreignTaxCredit`. The money has been stored and read by NOTHING since the two dialects
shipped: `box7ForeignTaxPaid` on `vnd.fjs.1099div` and `box6ForeignTaxPaid` on
`vnd.fjs.1099int`, both inside their dialects' money-exactness loops. Anyone holding an
international index fund has one of those boxes filled in, and the engine has been
dropping it silently.

## §904(j) is the whole of what this slice models

§901 allows a credit for foreign income taxes. §904(a) limits it to the US tax
attributable to foreign-source income, and computing that limitation is what Form 1116
is. This engine does not model Form 1116 and this slice does not change that.

**§904(j) is the exemption from that limitation**, and it is what makes a line this
engine can compute:

> §904(j)(2) — Subsection (a) shall not apply to any individual for any taxable year if:
> **(A)** the entire amount of such individual's gross income from sources without the
> United States for such taxable year (and of the deductions properly apportioned or
> allocable thereto) consists of **qualified passive income**,
> **(B)** the amount of the **creditable foreign taxes** paid or accrued by the individual
> during the taxable year **does not exceed $300 ($600 in the case of a joint return)**,
> and
> **(C)** such individual **elects** to have this subsection apply for the taxable year.

§904(j)(3)(A) defines *qualified passive income* as passive income (§904(d)(2)(B)) **that
is shown on a payee statement furnished to the individual**; §904(j)(3)(B) restricts
*creditable foreign taxes* the same way. §904(j)(1)(C) is the price: no tax of an electing
year may be carried back or forward under §904(c).

Three conditions, **conjunctive**, plus a price. Below the line, the credit is the full
creditable foreign taxes and Schedule 3 line 1 takes it directly. Above the line — or
without the election — Form 1116 is required and this engine **refuses**.

## What this engine can and cannot verify — the finding

| §904(j) condition | Verifiable here? |
|---|---|
| (B) taxes ≤ $300/$600 | **Yes, and it is verified.** Every creditable foreign tax this engine can hold is a stored box; the sum is compared against a stored threshold. |
| (A) all foreign gross income is PASSIVE | **No.** Neither dialect reports the source or the §904(d) category of the income beside the tax. A 1099-DIV states box 1a and box 7; nothing says how much of box 1a was foreign-source, and nothing at all says whether the taxpayer also had foreign wages, foreign rents or general-category income on a return this engine never sees a document for. |
| (A) all of it SHOWN ON A PAYEE STATEMENT | **Only halfway.** A 1099-DIV and a 1099-INT *are* payee statements, so the taxes this engine reads satisfy the clause about themselves. The clause is about the taxpayer's **entire** foreign-source gross income, and an engine cannot observe income no document reports. |
| (C) the election | **No — it is a choice, not a fact.** It trades away §904(c) carryback and carryforward of excess credits, and only the taxpayer can make that trade. |

So the honest position: **one of four conditions is checkable and three are not.** The
consequence is a design rule rather than a caveat — the election flag must carry the
assertion, because a flag that meant only "I elect" would let the engine claim a credit
whose eligibility nothing established.

### One flag, and it states both halves

`section904jElectionAllForeignIncomeIsQualifiedPassiveIncome`, `or(option, true)` on
`vnd.fjs.return_profile`. It is the §904(j)(2)(C) election **and** the §904(j)(2)(A)
assertion in one field, and the name says so.

Not two fields, and the reason is that only one combination is actionable. Facts asserted
without the election means Form 1116, which this engine refuses. Election without the
facts is not a state a taxpayer can truthfully be in. Two fields would create two ways to
express "refuse" and one way to express "compute", where one field expresses each once.
The precedent is `spouseHadNoIncomeIsNotFilingAndIsNotADependent` — one `or(option, true)`
carrying a three-part conjunctive assertion the engine cannot observe — rather than
`hadForeignFinancialAccount`/`requiredToFileFinCen114`, which are two fields because the
printed Schedule B asks two sub-questions.

**Do not read a small amount as evidence the conditions hold.** $12.00 of foreign tax is
perfectly consistent with a taxpayer who also earned foreign wages, and for that taxpayer
condition (A) fails at any dollar figure. The threshold is condition (B) and only
condition (B).

### The one hole that is already closed

The threshold is on the taxpayer's TOTAL creditable foreign taxes, so a foreign tax this
engine holds but does not read would break the comparison as well as the credit. There is
exactly one such box in the document set — `box21ForeignTaxesPaidOrAccrued` on
`vnd.fjs.k1_1065` — and `fjs/document/k1_1065`'s own `unmodeledMoneyBoxes` already refuses
any K-1 carrying a NON-ZERO one, at validation, before a return can reach this schedule.
No other stored dialect carries a foreign tax box. That row's destination string names
this exact line, and it stays refused: a partner's box 21 is not a payee-statement
passive item this engine can vouch for.

## Refuse, never zero

Three arms, and the asymmetry is the same one Form 3903 line 14 argues:

| Stored | Outcome |
|---|---|
| no foreign tax box anywhere | line 1 is a `profileDeclaredZeroLine`, citing `declaredKinds` |
| a box present but summing to `$0.00` | line 1 is `$0.00` **citing those boxes** — DOC-11: a present box cites its document |
| foreign tax > `$0.00`, no election | **REFUSE the return**, naming the documents, the total, Form 1116 and the profile field that would make it computable |
| foreign tax > the §904(j)(2)(B) threshold, elected | **REFUSE the return**, naming the total, the threshold and Form 1116 |
| foreign tax > `$0.00` and ≤ threshold, elected | line 1 = the total, citing every contributing box |

Zeroing the un-elected case would silently delete a credit the taxpayer is owed;
computing it would claim a credit whose §904(a) limitation nobody computed. Refusing asks.

## The threshold is per status, and `qualifyingSurvivingSpouse` is $300

§904(j)(2)(B) writes *"$600 in the case of a joint return"*. A qualifying surviving spouse
files a return that is **not a joint return** — it borrows the joint rate schedule and the
joint standard deduction, and that is all. So QSS takes the $300 figure, exactly as it
takes §3101(b)(2)(C)'s $200,000 rather than (A)'s $250,000 for the Additional Medicare
Tax, and for the same reading. Head of household and married-filing-separately are $300
for the same reason: neither is a joint return.

Hand-typed per status in `fjs/tax/params`, never spread from another status's entry —
`standardDeduction`'s own rule, so two statuses cannot drift apart unobserved.

**Not indexed.** §904(j)(2)(B) has read $300/$600 since the Taxpayer Relief Act of 1997
added it; no Revenue Procedure adjusts it, so the citation is `kind: 'code'`, as
`additionalMedicareTaxThreshold`'s is and for the identical reason.

## Breaking the Form 6251 cycle, which the code had already written down

`fjs/schedule/2`'s own `ScheduleTwoInput` docstring stated the problem before this slice
existed:

> `scheduleThreeLine1Cents` is deliberately NOT among them, and there is a cycle behind
> that. Form 6251 line 10 subtracts Schedule 3 line 1; `fjs/schedule/3` runs AFTER this
> module in `fjs/form1040/core`, because its own Credit Limit Worksheet reads 1040 line
> 18, which is line 16 plus THIS schedule's line 3. … It is resolvable today only because
> `foreignTaxCredit` is a refused kind … and
> `theForeignTaxCreditCycleIsResolvedByARefusal` is the leaf that says so as a checked
> claim rather than a comment, so the day that kind is modeled this module fails and
> somebody has to break the cycle properly.

That day is this one, and the cycle is not real. **Schedule 3 line 1 does not depend on
1040 line 18.** Under §904(j) the credit is the creditable foreign taxes, full stop: no
limitation, no worksheet, no tax figure on its input side. Only lines 3 and 4 need line
18. So line 1 is lifted OUT of `scheduleThree` into an exported
`foreignTaxCreditLine(...)`, which `fjs/form1040/core` runs ONCE, before Schedule 2, and
hands to both schedules — the "one execution, two destinations" shape `form8863` and
`form8959` already have in these two files. `scheduleThree` takes the finished line as an
input rather than recomputing it, so there is no second, independently stale copy.

## Form 6251 line 8 must move WITH line 10, or this slice makes the AMT worse

Form 6251 subtracts a foreign tax credit twice, once on each side of the comparison:

```
line 7  tentative minimum tax before the AMT foreign tax credit
line 8  AMT foreign tax credit                        <- was a documented 0n
line 9  = line 7 - line 8
line 10 = regular tax + Schedule 2 line 1z - Schedule 3 line 1
line 11 = line 9 - line 10, floored at zero           <- the AMT
```

Wiring line 10 alone would raise the AMT by exactly the credit. §59(a)(1) defines the AMT
foreign tax credit as the §27(a) credit redetermined with the pre-credit tentative minimum
tax and AMTI substituted into §904 — and under §904(j) there is no §904(a) limitation to
redetermine, so the substitutions change nothing and the two figures are equal. Form
6251's own line 8 instruction says the same thing in one sentence for a filer who did not
file Form 1116. The correct net effect of a §904(j) credit on the AMT is therefore
**zero**, and `fjs/form6251` is where that has to be true.

**This equality holds only while §904(j) is the ONLY route to line 1 in this engine.** The
day Form 1116 is modeled, line 8 becomes its own AMT-basis Form 1116 and this assignment
is wrong. Stated at the site, not only here.

## Every downstream total line 1 must reach

A line computed correctly and then dropped from a sum is the defect that survived three
mutations in the Form 3903 slice. Line 1 feeds **five** places:

1. **Schedule 3 line 8** (*"Add lines 1 through 4, 5a, 5b, and 7"*) -> 1040 line 20.
2. **Form 8863's Credit Limit Worksheet line 2** — §26's ordering puts the foreign tax
   credit ahead of the education credits, so it reduces what line 3 may claim.
3. **Form 8880's Credit Limit Worksheet line 2**, one credit further down the same order.
4. **Schedule 8812's Credit Limit Worksheet A line 2**, which subtracts Schedule 3 lines
   1 through 4 before the child tax credit sees the tax.
5. **Form 6251 lines 8 and 10**, above.

## Reclassification

`foreignTaxCredit` moves from `unmodeledKindRefusals` to `modeledKinds` in the SAME commit
as the wiring. Its remedy read *"requires Form 1116 (no phase yet)"*, which was true of
the general case and false of the §904(j) case — and the §904(j) case is most of the
population. The refusal that replaces it is not a scope refusal at all but a computation
refusal raised at the line, carrying the taxpayer's own numbers: **a refusal that names
your $847.00 and the $300.00 you would have had to be under is worth more than one that
names a form.**

`fjs/schedule/2`'s `theForeignTaxCreditCycleIsResolvedByARefusal` leaf — whose whole
purpose was to fail on this day — is repointed rather than deleted, to the property that
replaces it: line 10 moves by exactly the credit it is handed, and line 8 moves with it.
