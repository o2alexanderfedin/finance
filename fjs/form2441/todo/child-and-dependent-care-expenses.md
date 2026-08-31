# Form 2441 — the Credit for Child and Dependent Care Expenses, and the two lines it reaches

Sources, fetched and read directly rather than recalled (2026-08-18):

- `https://www.irs.gov/pub/irs-pdf/f2441.pdf` — Form 2441 (2025), Cat. No. 11862M,
  "Created 3/18/25".
- `https://www.irs.gov/pub/irs-pdf/i2441.pdf` — Instructions for Form 2441 (2025),
  Catalog Number 10842K, "Jul 22, 2025".
- `https://www.irs.gov/pub/irs-pdf/f1040.pdf` — Form 1040 (2025), for line 1e and line 11a.
- `https://www.irs.gov/pub/irs-pdf/f1040s3.pdf` — Schedule 3 (Form 1040) 2025, for line 2.

Every printed sentence quoted below was read off those files. Nothing here is from memory.

## The five questions the brief asked, answered from the paper

### 1. Is the credit refundable for 2025? **No.**

f2441 (2025) **line 11**: *"Credit for child and dependent care expenses. Enter the smaller
of line 9c or line 10 here and on **Schedule 3 (Form 1040), line 2**."*

f1040s3 (2025) puts line 2 under **Part I — Nonrefundable Credits**: *"2 Credit for child
and dependent care expenses from Form 2441, line 11. Attach Form 2441"*, and Part I totals
at line 8 → 1040 line 20. Part II ("Other Payments and Refundable Credits") begins at line
9 and contains no Form 2441 line at all.

The 2021-only ARPA refundability is gone twice over on this page. The 2021 form carried a
Part II line 10 ("refundable portion") that routes to Schedule 3 line 13g; the 2025 form's
line 10 is instead **"Tax liability limit. Enter the amount from the Credit Limit Worksheet
in the instructions"**, and i2441 p5's Credit Limit Worksheet ends *"But if zero or less,
stop; you can't take the credit."* A tax-liability ceiling is a thing only a nonrefundable
credit has.

So: **Schedule 3 line 2 → Schedule 3 line 8 → 1040 line 20.** One destination for the
credit.

### 2. The earned income limitation, §21(d), and the deemed-income rule

f2441 line 4 is the filer's earned income, line 5 the spouse's on a joint return (*"all
others, enter the amount from line 4"*), and **line 6 is the smallest of lines 3, 4 and
5**. Part III repeats the identical structure at lines 18, 19 and 20.

i2441 p4, *If You or Your Spouse Was a Student or Disabled*: *"For each month or part of a
month your spouse was a student or was disabled, they are considered to have worked and
earned income. Their earned income for each month is considered to be at least **$250**
($500 if you had two or more qualifying persons at any time during 2025)."* Line B is the
printed checkbox that certifies it.

**This engine does not hold the fact, and it is a REFUSAL rather than an assumption** — but
only where it can change the answer. The deemed amount is a floor (*"use the higher of $250
(or $500) or their actual earned income for that month"*), so it can only RAISE lines 4/5
and 18/19. Where the earned-income limitation does not bind — where line 4 is already at or
above line 3 — the deemed rule provably cannot move any printed line. So:

- limitation binds (earned income below line 3, or below line 17 in Part III) **and** no
  certification → **refuse**, naming line B and quoting the $250/$500 monthly amounts.
- limitation does not bind → **compute**, certification or not. This is the control.

The certification field is new: `filerWasNeitherAStudentNorDisabledInAnyMonth` on
`vnd.fjs.credits`' dependent-care block. It is a certification in the exact shape of Form
8962's `noDependentIsRequiredToFileAnIncomeTaxReturn` and Form 3903's §217(g) checkbox —
`or(option, true)`, DOC-12, absent means NOT certified.

### 2b. The harder half of §21(d): a joint return needs TWO earned incomes, and this engine has ONE

**Married filing jointly is REFUSED, and this is the largest thing this slice does not do.**

The reason is not the deemed-income rule. It is that line 5 and line 19 want the SPOUSE's
earned income *separately*, and nothing in this engine attributes an earned dollar to one
spouse rather than the other. i2441 p4 defines it as 1040 line 1z (less the §911 exclusion
and clergy amounts) plus Schedule SE line 3 less the Schedule 1 line 15 deduction — which
is, expression for expression, `fjs/schedule/eic`'s
`earnedIncomeCreditEarnedIncome = line1z + scheduleSeLine3 - scheduleSeLine13`. That figure
is COMBINED. Splitting it is not available:

- 1040 line 1z aggregates every stored Form W-2's box 1 with no per-person total.
- Schedule SE and Schedule C are computed for the return, not for a person; no dialect
  carries an `individual` on a business.

Handing the combined figure to line 5 would treat a stay-at-home spouse as having the
working spouse's whole income — which is precisely the population §21(d) exists for, and it
would grant the full credit to every couple entitled to none of it. So MFJ refuses, and the
refusal names the remedy: attribute earned income per spouse. The raw material for the W-2
half already exists (`vnd.fjs.w2`'s `employeeSSN` against `vnd.fjs.return_profile`'s
`filerSocialSecurityNumber` / `spouseSocialSecurityNumber`, both already stored for §32);
the Schedule SE half does not, and is the real work.

Single, head of household and qualifying surviving spouse all compute, because for them the
printed form says line 5 = line 4 and line 19 = line 18 and there is nothing to split. Head
of household is the paradigm single-parent filing status, so this is not a corner of the
population.

### 2c. Married filing separately is refused too, for a different reason

f2441 **line A**: *"You can't claim a credit for child and dependent care expenses if your
filing status is married filing separately unless you meet the requirements listed in the
instructions under Married Persons Filing Separately."* i2441 p3 lists three: lived apart
for the last 6 months of 2025, the home was the qualifying person's main home for more than
half of 2025, and paid more than half the cost of keeping up that home.

None of the three is on any document this engine holds, and the answer decides more than
the credit: line 19's own printed branch (*"Are you considered unmarried under that rule?
Yes → enter your earned income on line 19. No → enter your spouse's earned income"*) and
line 21's *"$2,500 if married filing separately and you were required to enter your
spouse's earned income on line 19"* both turn on it. So an MFS return refuses BOTH halves,
and the $2,500 line-21 figure is stored as a parameter and never reached — recorded here so
a reader does not conclude the parameter is dead by accident.

### 3. What must be transcribed that no information return carries

Form 2441 line 1 wants each care provider's name, address and identifying number, and line
2 wants each qualifying person's name, SSN and the over-12-and-disabled box. Line 2 column
(d) wants that person's qualified expenses, and line 16 wants the year's total incurred.
**No information return reports any of it.** A W-2 reports the employer's benefit (box 10);
nobody reports what the taxpayer paid a daycare.

**This is not a new dialect.** It goes on `vnd.fjs.credits`, whose own header states the
inclusion rule this satisfies exactly: *"both are payments substantiated by the taxpayer's
own records, both arrive with no payer and no account, and both therefore have the same
cardinality"*, and *"What would NOT belong here is anything a payer files."* Form 2441's
credit is a Schedule 3 Part I credit sitting between Form 8863's (line 3) and Form 8880's
(line 4), whose asserted halves are already there. A fourth dialect for a fourth Schedule 3
credit would be the arrangement that dialect explicitly rejected.

Three new optional members of `creditsSchema`:

| field | printed line |
|---|---|
| `dependentCareProviders` | line 1 columns (a)–(e) |
| `dependentCareQualifyingPersons` | line 2 columns (a)–(d) |
| `dependentCare` | lines 13, 14, 16, 21, 22 and line B's certification |

All three are `option`, so every existing stored record stays valid, and a record with
none of them is exactly today's record.

### 4. Box 10 of the W-2 — **stored, and read by nothing**

`fjs/document/w2/module.f.js` line 127 declares `box10DependentCareBenefits: or(option, string)`
and line 160 lists it in `moneyBoxFields`, so the dialect validates its exactness. A
repo-wide grep for the identifier returns **exactly those two lines**. No form, schedule,
report, demo or proof has ever read it.

So this is a WIRING job, and it is the highest-value part of this slice, because the
direction of the error is understatement of tax: a taxpayer whose employer put $5,000 in
box 10 and who incurred no qualified expenses owes tax on the whole $5,000 (f2441 line 26 →
1040 line 1e), and this engine was silently reporting zero. i2441 p2, line 1, contemplates
exactly that return: *"If you had neither a qualifying person nor any care providers for
2025, and you are filing Form 2441 only to report taxable income in Part III, enter 'none'
on line 1, column (a)."*

This is `box2EarlyWithdrawalPenalty` on `vnd.fjs.1099int` again — the third stored-but-
unread box this project has found — and it is worth writing down that both were found the
same way: by reading the dialect's field list against the printed form rather than by
reading the code that consumes it.

### 5. §129 and the order it interacts with §21 in

f2441 line 21: *"Enter $5,000 ($2,500 if married filing separately and you were required to
enter your spouse's earned income on line 19). However, don't enter more than the maximum
amount allowed under your dependent care plan."* i2441 p5 line 21 repeats the figures for
2025 explicitly.

The ordering is printed on the form's own face and it is **Part III first, then Part II**:

```
line 15 = line 12 + line 13 - line 14        benefits received, net of forfeitures
line 17 = min(line 15, line 16)              benefits, capped by expenses incurred
line 20 = min(line 17, line 18, line 19)     and by each spouse's earned income
line 21 = $5,000 / $2,500, or the plan's own lower maximum
line 24 = min(line 20, line 21, line 22)     deductible (self-employed) benefits
line 25 = min(line 20, line 21) - line 24    EXCLUDED benefits
line 26 = line 23 - line 25                  TAXABLE benefits -> 1040 line 1e
line 27 = $3,000 / $6,000                    the §21(c) expense cap
line 28 = line 24 + line 25                  everything excluded or deducted
line 29 = line 27 - line 28                  "If zero or less, stop. You can't take the credit."
line 30 = column (d) again, WITHOUT the line 28 benefits
line 31 = min(line 29, line 30)              -> line 3
```

**The exclusion reduces the expense cap dollar for dollar, at line 29.** A filer with one
qualifying person, $8,000 of expenses and $5,000 excluded has line 27 $3,000, line 28
$5,000, line 29 negative — **no credit at all**, not a credit on $3,000. With two
qualifying persons the same facts give line 27 $6,000, line 29 $1,000, line 30 $3,000 and
line 31 $1,000. Both are worked as fixtures.

Reading the two limits in the other order — capping expenses at $6,000 first and then
subtracting benefits — gives the same answer here but not in general, and reading them as
independent gives a credit on $3,000 of expenses the taxpayer already excluded from income.
That is the double benefit §21(c)'s flush language exists to prevent.

**Line 30's mechanical form.** The printed instruction for line 2 column (d) is *"If you
completed Part III, don't include in column (d) any benefits shown on line 28"*, so line 30
is the paid-expense total less line 28, floored at zero. Written that way rather than asking
the taxpayer for a second expense figure, because a second figure is a second source of
truth able to disagree with the first.

## The circularity that forces TWO functions

f2441 **line 7**: *"Enter the amount from Form 1040, 1040-SR, or 1040-NR, **line 11a**."*
f1040 (2025) line 11a is *"Subtract line 10 from line 9. This is your adjusted gross
income"*. And f2441 line 26 lands on **1040 line 1e**, which is inside line 1z, inside line
9, inside line 11a.

So Part III must run BEFORE the 1040's AGI, and Part II must run AFTER it. Worse, line 10's
Credit Limit Worksheet (i2441 p5) reads *1040 line 18* less *Schedule 3 line 1 and line 6l*
— the tax, which needs the AGI, which needs line 1e.

The chain is one-directional and never circular, but it cannot be one function call:

```
form2441DependentCareBenefits  ->  line 26  ->  1040 line 1e -> 1z -> 9 -> 11a (AGI)
                               ->  line 31                                      |
                                                       1040 line 16, 17, 18 <---+
                                                                     |
      Schedule 3 line 1 (foreign tax credit) ----------------------->|
                                                                     v
form2441Credit(line 3 = line 31, AGI, tax liability limit) -> line 11 -> Schedule 3 line 2
```

Two exported functions, each returning its own printed lines. The alternative — one function
run twice, once with a guessed AGI — is what `fjs/schedule/se`'s outcome docstring already
forbids: a second execution that can disagree with the first about the return it is pricing.

**Lines 27–31 belong to the FIRST function even though line 31 feeds Part II**, because they
read line 24 and line 25 and nothing else, and neither depends on the AGI.

## Lines 27-31 with no benefits at all reproduce line 3's own cap exactly

The printed page says *"If you completed Part III, enter the amount from line 31"* on line
3, implying a filer with no benefits skips Part III and applies line 3's own *"Don't enter
more than $3,000 ... or $6,000"* cap instead. **The two are the same arithmetic**: with line
12 and line 13 both zero, line 24 = line 25 = 0, so line 28 = 0, line 29 = the $3,000/$6,000
cap, line 30 = the expense total, and line 31 = min(cap, expenses) — which is line 3's cap,
applied. So lines 27-31 run unconditionally and there is no second cap expression anywhere
in the module. Proven by a leaf that asserts the equality rather than left to be
rediscovered.

## Zero qualifying persons

The printed line 27 says *"$3,000 ($6,000 if two or more qualifying persons)"* and never
contemplates none, because a filer with none cannot take the credit at all. The cap is
therefore **$0** at zero qualifying persons, which makes line 29 zero, triggers line 29's own
*"If zero or less, stop. You can't take the credit"*, and carries a $0 line 31 into line 3.
That is the Part-III-only return of i2441 p2 quoted above, and it must still produce a
taxable line 26.

## What this module refuses, with the printed sentence behind each

Five are shared between the two halves (`sharedRefusal`), one belongs to Part III alone,
and the §21(d)(2) one is asked TWICE — once against lines 3/4 and once against lines 17/18
— because each part has its own pair of printed lines.

| # | condition | printed authority |
|---|---|---|
| R1 | filing status is married filing jointly | line 5 / line 19 want the spouse's earned income separately; §2b above |
| R2 | filing status is married filing separately | line A, i2441 p3 *Married Persons Filing Separately* |
| R3 | the return carries self-employment earnings | i2441 p4 lines 4/5 item 2: earned income is 1040 line 1z **plus Schedule SE line 3 less the Schedule 1 line 15 deduction**, and this engine computes Schedule SE inside Schedule 1 stage one — *after* 1040 line 1z, of which Form 2441 line 26 is itself a term |
| R4 | any 2024 expense was paid in 2025 | line 9b, i2441 p4; Worksheet A needs five 2024 figures (2024 Form 2441 lines 3 and 6, 2024 AGI, and both 2024 earned incomes) that no stored document carries |
| R5 | qualified expenses were paid but no care provider is recorded | line 1 *"You must complete this part"*; i2441 p2 *Due Diligence* |
| R6 | any line 12 or line 13 benefit came from a sole proprietorship or partnership | line 22 / line 24, i2441 p5: the deductible half lands on Schedule C line 14, Schedule E line 19 or 28, or Schedule F line 15 — three lines this engine does not compute |
| R7 | the earned-income limitation BINDS and line B is not certified | i2441 p4 *If You or Your Spouse Was a Student or Disabled* |

R3 is the one that is an ENGINE ordering limitation rather than a missing fact, and it is
labelled as such in its own message: the figure is computable in principle, the remedy is
to compute Schedule SE above the 1040 line 1 block, and nothing in Schedule SE prevents it.
Reading the self-employment half as zero would be wrong in the taxpayer's *disfavour* —
lower earned income means more taxable benefits and a smaller credit — which is the safe
direction and still a wrong number.

R6 deserves its reason stated: line 24's deductible benefits are a DEDUCTION on a business
schedule, not anything on Form 2441's own face, so computing line 24 while leaving the
business schedule untouched would exclude the benefit from income twice.

Each refusal is paired with a control proving it does not fire on the legitimate case.

## The applicability gate, which is the wiring's most load-bearing line

`fjs/form1040/core` runs Form 2441 only for a return that has one: a Form W-2 with a
non-zero box 10, or a stored `vnd.fjs.credits` record that mentions dependent care. That is
`premiumTaxCreditLines`' own "called only when a Form 1095-A is stored" short-circuit, and
without it R1 would refuse **every married couple in the country** for want of a per-spouse
earned income split they never needed. The first version of this wiring omitted it and 33
leaves went red at once.

The gate is on DOCUMENT presence and never on `declaredKinds`, because box 10 was stored
and read by nothing: gating the read on a declaration would reproduce that silence for
anybody who did not think to declare the kind. What enforces the declaration instead is a
new **tripwire** — the ninth — which refuses a return whose box 10 is non-zero and whose
profile does not declare `dependentCareBenefits`, naming the box, the destination and the
declaration that fixes it. That is Form W-2 box 8's own shape, applied to the box beside it.

## Mutation log

Twenty-two mutations, every one of which compiled. **Four survived**, three of them
wiring-shaped, and each bought a leaf:

1. `income.line1z.value` → `income.line1z.value - income.line1e.value` in Part II's earned
   income. Green. Every fixture had line 4 far above line 3, so line 6's minimum never
   noticed; the asymmetry leaf beside it measured line 7's AGI, a different term of a
   different comparison. Fixed by `dependentCareBindingEarnedIncomeInputs`, where $1,000 of
   wages and $60,000 of interest make line 4 the binding term: $1,000.00 of credit against
   the $200.00 the mutation gives.
2. `scheduleThreeOutcome.line2.value` dropped from `form8812`'s `scheduleThreeCreditsCents`.
   Green. Nothing carried a dependent care credit AND a qualifying child AND a tax small
   enough for Credit Limit Worksheet A to bind — the identical defect
   `phaseTwentyFiveWithDependentInputs` exists to prevent one credit earlier. Fixed by
   `dependentCareWithAChildInputs`: $928.00 of tax, $900.00 of dependent care credit, and a
   child tax credit of $28.00 rather than the whole $928.00.
3. The self-employment detection weakened to `length > 1000`. Green. Nothing carried a side
   business AND a dependent care FSA. Fixed by a 1099-NEC beside the box 10 fixture, with
   the control proving the same 1099-NEC on a return with no dependent care still computes.
4. Weakening ANY SINGLE term of `mentionsDependentCare`. Green, and **genuinely absorbed**:
   a record that mentions dependent care mentions it in several fields at once. Recorded at
   the site; the disjunction as a whole is proven by turning its `&&` into an `||`, which
   reddens two leaves.

Two **equivalent mutants** are recorded at their sites in `fjs/form2441`, and they are one
property of line 22 rather than two of line 25: R6 makes line 22 a structural zero, so line
24's printed three-way minimum is always zero and line 25's two printed branches coincide.
Both are transcribed as printed anyway, and both start biting the day the business
schedules compute.

Mutations that bit as predicted include: line 26's subtraction reversed (9 leaves), line
29's `- line 28` removed (5, three of them end-to-end), line 8's `<=` weakened to `<` (5),
Schedule 3 line 2 zeroed (7), line 2 dropped from Form 8880's Credit Limit Worksheet (1)
and from Form 8863's (1), the box 10 read pointed at box 11 (5), the tripwire pointed at
box 11 (1), the applicability gate disabled (43), `${destination}` erased from every
refusal (5), and a money field dropped from the dialect's exactness list (1, caught by the
hand-typed count beside it).

## Parameters, and why each is a parameter

All four go in `fjs/tax/params` with a citation, because all four are dollar figures and
percentages the statute sets and a later year moves:

| parameter | 2025 value | authority |
|---|---|---|
| `dependentCareExpenseLimit` | $3,000 / $6,000 | §21(c); f2441 lines 3 and 27 |
| `dependentCareCreditPercentage` | sixteen printed bands, 35% down to 20% | §21(a)(2); f2441 line 8's own table |
| `dependentCareAssistanceExclusionLimit` | $5,000 / $2,500 | §129(a)(2)(A); f2441 line 21, i2441 p5 |
| `dependentCareDeemedEarnedIncomePerMonth` | $250 / $500 | §21(d)(2); f2441 line B, i2441 p4 |

The citation kind is the Internal Revenue Code, not a Revenue Procedure and not the Federal
Register: **none of these four is inflation-adjusted.** §21 and §129 state plain dollar
amounts, which is why they sat unchanged for decades and why P.L. 119-21 needed an act of
Congress to move them (to 50% and $7,500 respectively, **for tax years after 2025** — so the
2025 form is the pre-amendment law and a 2026 parameter set will differ in three of the four
rows). A reader looking for these in Rev. Proc. 2024-40 will not find them, which is the
mistake this paragraph exists to prevent.

`dependentCareDeemedEarnedIncomePerMonth` is READ — by R3's and R4's refusal messages, which
quote the monthly figures so the reader can decide whether they qualify. A parameter nobody
reads is a parameter nobody checks.

## The kinds, and which one moves

`fjs/return/scope` holds two:

- `dependentCareBenefits`, 1040 line 1e — **modeled** by this slice, from W-2 box 10.
- `dependentCareCredit`, Schedule 3 line 2 → 1040 line 20 — **modeled** by this slice.

Both move in the same commit as their wiring, per `fjs/return/scope`'s own "wire before
reclassify" rule, and both remain able to REFUSE by name for the seven conditions above.
Refusing is not the same as being unmodeled: an unmodeled kind cannot even be asked.
