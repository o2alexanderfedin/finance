# Form 2555 — Foreign Earned Income (§911)

Read off `f2555.pdf` (2025, "Created 5/14/25"), `i2555.pdf` (2025, Sep 17 2025),
`i1040gi.pdf` (2025) p37's *Foreign Earned Income Tax Worksheet*, `i6251.pdf`
(2025) p10's *Foreign Earned Income Tax Worksheet—Line 7*, Rev. Proc. 2024-40
§2.39 and Notice 2025-16.

This file is the decision record. `fjs/form2555/module.f.js` implements what it
decides; every refusal below is a row in `fjs/return/scope` or a message-only
refusal at the site that cannot compute.

---

## 0. The verified 2025 figures

| Figure | Value | Where it comes from |
|---|---|---|
| Maximum foreign earned income exclusion (line 37) | **$130,000** | Rev. Proc. 2024-40 **§2.39**: *"For taxable years beginning in 2025, the foreign earned income exclusion amount under § 911(b)(2)(D)(i) is $130,000."* Printed on Form 2555 line 37. |
| Base housing amount, full year (line 32) | **$20,800** | §911(c)(1)(B)(ii) — 16% of the maximum exclusion. Notice 2025-16 §2 states the arithmetic in words: *"the base housing amount for 2025 is $20,800 ($130,000 x .16)"*. Printed on Form 2555 line 32. |
| Base housing amount, daily (line 32) | **$56.99** | $20,800 ÷ 365, half-up to cents (2,080,000 ¢ ÷ 365 = 5,698.63… → 5,699 ¢). Printed on Form 2555 line 32. |
| General limitation on housing expenses, full year (line 29b) | **$39,000** | §911(c)(2)(A)(i) — 30% of the maximum exclusion. Notice 2025-16 §2: *"limited to maximum housing expenses of $39,000 ($130,000 x .30) for 2025"*. i2555 p5. |
| General limitation on housing expenses, daily (line 29b) | **$106.85** | $39,000 ÷ 365, half-up to cents (3,900,000 ¢ ÷ 365 = 10,684.93… → 10,685 ¢). i2555 p5 and its *Limit on Housing Expenses Worksheet—Line 29b* line 3. |
| Days in the 2025 tax year (line 39's denominator) | **365** | The calendar. Form 2555 line 39: *"the number of days in your 2025 tax year (usually 365)"*. |

**Exactly two of those six are STORED**, and the other four are not stored at
all. `fjs/tax/params`' `foreignEarnedIncome` group carries the $130,000 with its
Rev. Proc. citation and the 365, and nothing else — because **nothing reads the
four housing figures**: `foreignHousingExclusionOrDeduction` is a refused kind
(§3) and Form 2555 Parts VI and IX never run. Storing them would be four dead
parameters, and a dead parameter is a figure nobody can notice going stale.

They are still WRITTEN DOWN, in `fjs/tax/params`'
`theNoticeTwentyTwentyFiveSixteenProductsFollowFromTheStoredMaximum`, as the
notice's own arithmetic checked against the stored maximum: 16% and 30% of
$130,000 are $20,800 and $39,000 to the cent, and those over 365 are $56.99 and
$106.85 half-up. That is the independent-expected-value discipline — the
arithmetic and the printed page are two sources and the leaf compares them —
and it is what makes the maximum's own value load-bearing in a second place,
so a drift in it fails loudly rather than silently making four derived figures
wrong at once.

**The printed page contradicts its own daily rate, and the same leaf writes
that down rather than smoothing it.** $56.99 × 365 = $20,801.35, not $20,800;
$106.85 × 365 = $39,000.25, not $39,000. Form 2555 line 32 resolves it by
naming the full-year figure as an override — *"If 365 is entered on line 31,
enter $20,800 here"* — and the *Limit on Housing Expenses Worksheet* resolves
line 29b the same way (*"If you enter 365 on line 1 … DO NOT complete this
worksheet. Instead, enter $39,000"*). Neither override is IMPLEMENTED, because
neither line runs; both are recorded here and asserted there so the phase that
lifts §3's refusal finds the discontinuity already named rather than
rediscovering it as a rounding bug.

---

## 1. The two qualifying tests

§911(d)(1) offers two, and a filer completes Part II **or** Part III, never
both (i2555 p3, *"Caution: You must complete either Part II or Part III of Form
2555, but not both parts."*). Both ride on top of the **tax home test**
(§911(d)(3)), which is not an alternative but a precondition.

### 1a. Bona fide residence, §911(d)(1)(A) — **REFUSED**, and it is not
certifiable at all

The scope kind is `foreignEarnedIncomeBonaFideResidenceTest`.

i2555 p3, on what the test turns on, in the instructions' own words:

> *"Whether you are a bona fide resident of a foreign country depends on your
> **intention** about the length and nature of your stay. Evidence of your
> intention may be your words and acts. **If these conflict, your acts carry
> more weight than your words.** Generally, if you go to a foreign country for a
> definite, temporary purpose and return to the United States after you
> accomplish it, you aren't a bona fide resident of the foreign country. If
> accomplishing the purpose requires an extended, indefinite stay, and you make
> your home in the foreign country, you may be a bona fide resident."*

Three things follow, and together they settle it.

1. **The standard is a conclusion about intent, not a fact about the world.**
   Every other certification this engine accepts is a thing the taxpayer
   observed: Form 8962's *no dependent is required to file* is a filing-duty
   test applied to figures the household already has; Form 7206's
   `notEligibleForAnySubsidizedEmployerHealthPlanInAnyMonth` is a question about
   an offer that was or was not made; §217(g)'s is about a military order that
   exists on paper; Form 2441's age assertion is a birth date. Bona fide
   residence is none of those shapes. It is the characterization a court would
   place on a pattern of conduct — Reg. §1.871-2(b)'s *"floating intention,
   indefinite as to time, to return"* language, applied by the eleven-factor
   weighing courts perform.
2. **The instruction sentence itself denies the taxpayer authority over the
   answer.** *"If these conflict, your acts carry more weight than your words."*
   A certification IS words. An instruction that says the taxpayer's words lose
   to their acts is an instruction that says a taxpayer's declaration is not the
   evidence that decides. There is no honest way to build a checkbox out of a
   rule whose own text discounts checkboxes.
3. **The form asks the taxpayer for the raw material, not the conclusion.**
   Part II collects the kind of living quarters (line 11), whether family lived
   abroad (12a/12b), whether a statement of non-residence was filed with the
   foreign authorities and whether foreign income tax is owed (13a/13b),
   contractual terms and visa limits (15a-15c), and whether a home was kept in
   the United States (15d/15e). Lines 13a/13b even carry a printed
   DISQUALIFICATION — *"If you answered 'Yes' to 13a and 'No' to 13b, you don't
   qualify as a bona fide resident"* — which is exactly one of the eleven
   factors, mechanized. The form asks eight questions and does not ask *"are you
   a bona fide resident?"*, because that is what the IRS decides from the eight.

There is also a threshold the engine could not check even if intent were
certifiable: the test is open to a U.S. citizen, and to a resident alien **only**
if they are a citizen or national of a country with a U.S. income tax treaty in
force (Form 2555 Part II's own Note; §911(d)(1)(A) as extended by §7701(b) and
the treaty non-discrimination articles). That is a lookup against Table 3 at
IRS.gov/TreatyTables, which no stored document names and which is a second
hundreds-of-rows table with no derivation.

**A filer who qualifies only under the bona fide residence test is refused by
name**, and the remedy says the engine cannot decide intent. A filer who
qualifies under **both** tests certifies the physical presence one and computes.

### 1b. Physical presence, §911(d)(1)(B) — **CERTIFIED**, and deliberately
narrower than the statute

The profile field is
`physicallyPresentInAForeignCountryThreeHundredThirtyFullDaysAndNoUnitedStatesAbode`,
`or(option, true)`, DOC-12's shape.

§911(d)(1)(B) is *"present in a foreign country or countries during at least 330
full days during such period of 12 consecutive months"*. i2555 p3 defines the
unit: *"A full day means the 24-hour period that starts at midnight"*, and *"the
330 full days can be interrupted by periods when you are traveling over
international waters or are otherwise not in a foreign country."*

**That half is a count, and a count is exactly what a taxpayer can truthfully
declare.** It needs no legal judgement: on any given midnight-to-midnight day a
person either was or was not inside a foreign country. It is the same kind of
fact as the §217(g) military order or the age-50 catch-up assertion — the
taxpayer holds the evidence and nobody else does, because no information return
reports travel.

**The tax home half is where an honest certification has to narrow.**
§911(d)(3): *"An individual shall not be treated as having a tax home in a
foreign country for any period for which his abode is within the United
States."* i2555 p2 says abode *"is based on where you maintain your family,
economic, and personal ties"*, and gives the trap outright:

> *"Example. You are employed on an offshore oil rig in the territorial waters
> of a foreign country and work a 28-day-on/28-day-off schedule. You return to
> your family residence in the United States during your off periods. You are
> considered to have an abode in the United States and don't meet the tax home
> test."*

That taxpayer counts well over 330 days abroad and still fails. Weighing
*"family, economic, and personal ties"* is a judgement an ordinary taxpayer is
not competent to make, so the certification does not ask for it. It asks for the
**bright-line fact underneath it**: no abode in the United States at any time in
the qualifying period. The field name says both halves because the taxpayer is
declaring both at once:

> *"I was physically present in a foreign country or countries for at least 330
> full days during a period of 12 consecutive months, my tax home was in a
> foreign country throughout my qualifying period, and I maintained no abode in
> the United States during that period."*

**Narrower than the statute, in the refusing direction.** §911(d)(3) tolerates
some U.S. ties — i2555 p2 says an abode *"is not necessarily in the United
States merely because you maintain a dwelling"* there. A filer who kept a U.S.
dwelling may still qualify; under this field they cannot certify, and they are
refused. That is the same trade `notEligibleForAnySubsidizedEmployerHealthPlanInAnyMonth`
made: a certification that is easier to state truthfully than the statute is to
satisfy, so that every filer who CAN state it truthfully certainly qualifies.

**Two §911(d) escapes are not modelled and are refused with the bona fide
residence row**: the §911(d)(4) waiver of the time requirement for war or civil
unrest (which needs the annual Internal Revenue Bulletin list of qualifying
countries and dates), and Cuba (i2555 p2 — time in Cuba cannot be counted at
all). Both are certifications about a published list this engine does not hold.

---

## 2. The partial-year proration

### 2a. Which days count

Form 2555 line 31 / line 38, and i2555's line 31 instruction:

> *"Enter the number of days in your qualifying period that fall within your
> 2025 tax year. **Your qualifying period is the period during which you meet
> the tax home test and either the bona fide residence or physical presence
> test.**"*
>
> *"Example. You establish a tax home and bona fide residence in a foreign
> country on August 14, 2025. You maintain the tax home and residence until
> January 31, 2027. You are a calendar year taxpayer. The number of days in your
> qualifying period that fall within your 2025 tax year is 140 (August 14
> through December 31, 2025)."*

So the count is **not** the 330 full days and **not** the 12-month window of
line 16. It is the intersection of (the qualifying period) with (the tax year),
and the qualifying period can be longer than either — it runs as long as both
tests hold. A taxpayer abroad continuously from 2023 to 2027 has a 365-day count
for 2025 while their line 16 window is a 12-month slice.

The engine takes the count as a stated `number`, `foreignEarnedIncomeQualifyingDays`
on `vnd.fjs.return_profile`. It is the taxpayer's own arithmetic over the same
calendar the certification above is about, and there is no document that could
supply it.

### 2b. The engine holds it without a new dialect

Days already exist here as plain integer counts:
`vnd.fjs.rental_property`'s `fairRentalDays` / `personalUseDays` are
`or(option, number)` with a table-driven range check, and `daysInTheLongestYear = 366`
is a named constant there because that dialect does not know leap years. This
field follows that shape exactly — `or(option, number)`, range-checked `0 …
daysInTheLongestYear` in `checkReferences`, absent meaning *unstated* rather
than zero.

**No new dialect, and no date arithmetic anywhere.** Nothing in this engine
parses a date into a day count, and nothing here starts. The one place a
calendar length is needed — line 39's denominator — is a stored parameter
(`foreignEarnedIncome.daysInTaxYear`), not a computation over the year number,
which is also what keeps `year-genericity-gate` satisfied.

### 2c. The ratio is exact and rounds ONCE

Form 2555 line 39 prints *"divide line 38 by the number of days in your 2025 tax
year and enter the result as a decimal (rounded to **at least** three places)"*,
and line 40 multiplies line 37 by it. **"At least" is what licenses exactness**:
the printed three places are a floor on precision, not a ceiling, and the exact
rational is the limit of "at least".

So line 39 is carried as `line39Numerator` / `line39Denominator` — the
`fjs/form7206` line 6 treatment, for the reason that module's docstring gives:
*"Rounding a ratio to a printed number of decimals and then multiplying is how a
cent goes missing."* Line 40 is the single `halfUp(multiply(of(line37)(1n))(of(num)(den)))`.

A worked check, hand-typed: 140 qualifying days, $130,000 maximum.
$130,000 × 140/365 = $49,863.0136…, so line 40 is **$49,863.01**. Rounding line
39 to three places first gives 0.384 and $49,920.00 — **$56.99 too much**, which
is the whole reason the exact ratio is carried.

---

## 3. The housing exclusion and deduction — **REFUSED**

The scope kind is `foreignHousingExclusionOrDeduction`, naming Form 2555 line 36
and line 50 → Schedule 1 line 24j.

### 3a. The general limitation alone is not honest, and the reason is the table

Notice 2025-16 §3's table gives, for each of roughly two hundred named
locations, a *Limitation on Housing Expenses (full year)* and a *(daily/365
days)*. It is published *"in lieu of the otherwise applicable limitation of
$39,000"*.

**Half of that table has a compact exact derivation and half does not.** The
daily column is the full-year column ÷ 365, half-up to cents — verified against
eight rows spanning the range, hand-typed:

| Location | Full year | ÷ 365, half-up | Printed daily |
|---|---|---|---|
| Luanda, Angola | 84,000 | 230.1369… → 230.14 | 230.14 |
| Buenos Aires | 56,500 | 154.7945… → 154.79 | 154.79 |
| Oranjestad, Aruba | 46,200 | 126.5753… → 126.58 | 126.58 |
| Sydney | 62,300 | 170.6849… → 170.68 | 170.68 |
| Hong Kong | 114,300 | 313.1506… → 313.15 | 313.15 |
| Shanghai | 57,001 | 156.1671… → 156.17 | 156.17 |
| Copenhagen | 43,704 | 119.7369… → 119.74 | 119.74 |
| Victoria, Canada | 39,200 | 107.3972… → 107.40 | 107.40 |

The **full-year column has none**. It is not a percentage of anything, not a
function of the $39,000, and not a function of any other stored figure: Notice
2025-16 §2 says the adjustments *"are based on geographic differences in housing
costs relative to housing costs in the United States"* under §911(c)(2)(B)'s
grant of authority, and the numbers are the output of a survey. Shanghai's
$57,001 and Copenhagen's $43,704 are not round to the hundred where their
neighbours are, which is what an arbitrary published series looks like.

This is where it differs from the case the brief points at.
`fjs/form8962`'s 252-row federal poverty line table reproduces exactly from six
stored tiers because HHS publishes it AS a base plus a per-person increment for
each of three geographies — the table is generated, and the generator is stated.
Notice 2025-16 has no generator. **So there is nothing to store but two hundred
rows, and AGENTS.md's rule is to refuse rather than store a partial table.**

A partial table would fail in the merely-wrong direction rather than the
dangerous one — a Hong Kong filer capped at $39,000 instead of $114,300 loses
$75,300 of limit — but "wrong against the taxpayer" is still a confident wrong
answer, which is the thing `fjs/form6251`'s own
`noRegularPreferentialWorksheetRefusal` already refuses over.

### 3b. Two more blockers, either of which would refuse on its own

- **Line 49, the 2024 housing deduction carryover.** The *Housing Deduction
  Carryover Worksheet—Line 49* reads the PRIOR year's Form 2555 lines 46 and 48.
  This engine models one tax year and holds no prior-year return; it is the same
  wall `section1341CreditForRepayment` and `deferredNet965TaxLiability` are
  already refused behind.
- **Line 34/35, the employer-provided share.** The housing EXCLUSION is capped
  at the employer-provided portion of foreign earned income (line 36 *"don't
  enter more than the amount on line 34"*), and i2555 p6's line 34 list —
  wages, in-kind compensation, rent paid directly to a landlord, tax
  equalization payments — is a split of gross income that no document this
  engine holds records. A self-employed filer's line 36 is zero by instruction
  and their whole housing amount is a DEDUCTION instead, which is Part IX,
  which is blocked by the carryover above.

### 3c. What the refusal costs, and what it does not

Line 36 is an input to `fjs/form2555` and is a **structural zero** there — named
rather than omitted, the discipline `fjs/form7206` line 12 already follows.
Lines 41, 43, 46, 47 and 48 are all written out and read it, so the day the
table and the carryover arrive, the arithmetic around them is already in place
and proven. A filer claiming no housing exclusion or deduction — every filer
whose foreign housing is paid out of their own after-tax money and who does not
elect the deduction — computes today with line 36 correctly zero.

---

## 4. The stacking rule, §911(f) — **IMPLEMENTED**

§911(f)(1), verbatim, and it is worth quoting in full because both worksheets
are in it:

> *"If, for any taxable year, any amount is excluded from gross income of a
> taxpayer under subsection (a), then, **notwithstanding sections 1 and 55** —
> (A) if such taxpayer has taxable income for such taxable year, the tax
> imposed by section 1 … shall be equal to the excess (if any) of — (i) the tax
> which would be imposed by section 1 … if the taxpayer's taxable income were
> increased by the amount excluded under subsection (a) …, over (ii) the tax
> which would be imposed by section 1 … if the taxpayer's taxable income were
> equal to the amount excluded under subsection (a) …, and (B) if such taxpayer
> has a taxable excess (as defined in section 55(b)(1)(B)) …"*

**Clause (A) is 1040 line 16 and clause (B) is Form 6251 line 7** — one statute,
two worksheets, which is why §4c below is part of this answer rather than a
footnote to it. i1040gi p37 mechanizes (A) and i6251 p10 mechanizes (B), and
i2555 p3 makes both mandatory: *"you must figure the tax on your nonexcluded
income using the tax rates that would have applied had you not claimed the
exclusions … When figuring your alternative minimum tax on Form 6251, you must
use the Foreign Earned Income Tax Worksheet in the Instructions for Form 6251."*

### 4a. `fjs/tax/table` supports the worksheet, and the shape is already there

The worksheet's lines, transcribed:

| Line | Text | This engine |
|---|---|---|
| 1 | Form 1040 line 15 (printed line 15 is itself *"if zero or less, enter -0-"*) | `max(taxableIncomeCents, 0n)` |
| 2a | Form 2555 lines 45 and 50 | the exclusion plus the housing deduction (line 50 refused, hence zero) |
| 2b | *"any itemized deductions or exclusions you couldn't claim because they are related to excluded income"* | `foreignEarnedIncomeItemizedDeductionsAndExclusionsNotClaimed` on the profile |
| 2c | Subtract 2b from 2a; if zero or less, enter -0- | |
| 3 | Add lines 1 and 2c | |
| 4 | *"Figure the tax on the amount on line 3. Use the Tax Table, Tax Computation Worksheet, Qualified Dividends and Capital Gain Tax Worksheet, Schedule D Tax Worksheet, or Form 8615, whichever applies."* | **re-enters `dispatchLine16` levels 1-3** with line 3 as taxable income |
| 5 | *"Figure the tax on the amount on line 2c. If the amount on line 2c is less than $100,000, use the Tax Table … $100,000 or more, use the Tax Computation Worksheet."* | `baseTaxForAmount` — and ONLY that, because line 5 does not name the preferential worksheets |
| 6 | Subtract line 5 from line 4; if zero or less, enter -0- | |

**Line 2b is a fifth stored fact, and it is not Form 2555 line 44.** Line 44 is
above the line and reduces the exclusion itself; line 2b is below the line and
reduces the amount the worksheet stacks the remaining income on top of. Folding
them into one field would subtract the same dollars twice on two forms. Its
printed wording is identical in i1040gi p37 and i6251 p10, so one profile field
serves both.

Line 4 and line 5 name **different method sets**, and that asymmetry is the
worksheet's whole content. `fjs/tax/line16`'s own docstring already said so
before this phase — *"The Foreign Earned Income Tax Worksheet (i1040gi p37) does
not replace the dispatch; it RE-ENTERS it"* — and level 0a now does exactly
that, calling a private `levelsOneThroughThree` the ordinary path also calls, so
one body serves both and neither can drift.

`fjs/tax/table`'s `baseTaxForAmount` is line 5 unchanged: it already decides Tax
Table below $100,000 and Tax Computation Worksheet at or above it, in one place,
and returns which. Its docstring's *"lines 22 and 24 call this function
SEPARATELY, with DIFFERENT amounts"* note is the same structural fact this
worksheet needs.

### 4b. Why fudging it is the dangerous direction, and the leaf that catches it

The lazy implementation is `tax(line 1)` — tax the remainder and ignore the
exclusion. Under a progressive schedule that is always **less** than
`tax(line 1 + line 2) − tax(line 2)`, so it under-taxes, silently, in the
taxpayer's favour. `theStackingRuleChangesTheBracket` is built on a fixture
where the difference is a whole bracket: $30,000 of remaining taxable income
against $130,000 excluded moves the marginal slice from 12% to 24%, and the two
answers differ by thousands of dollars rather than by rounding. `fjs/form1040/core`
carries the same fixture end to end.

### 4c. The alternative minimum tax, and the ONE thing that refuses

i6251 p10 has its own *Foreign Earned Income Tax Worksheet—Line 7*, with a
`Before you begin` that decides the whole question: **"If Form 6251, line 6, is
zero, don't complete this worksheet."**

So:

- **Line 6 zero → nothing changes.** `fjs/form6251` already returns line 7 = $0
  on that arm, and a Form 2555 filer whose alternative minimum taxable income
  does not exceed the exemption reaches it untouched.
- **Line 6 positive, no preferential income → COMPUTED.** Lines 4 and 5 are the
  page's own *"All others"* bullet applied to two different amounts: 26%/28% of
  (line 6 plus line 2c), less 26%/28% of line 2c. `fjs/form6251/rate` already
  prints that schedule and `fjs/form6251` already calls it three times, so this
  is a fourth call rather than new arithmetic. Line 2b arrives from the same
  profile field the 1040 worksheet reads — the printed wording is identical on
  both pages, so one field serves both.
- **Line 6 positive, WITH preferential income → REFUSED**, message-only, at
  `fjs/form6251` itself, beside the two refusals already there. Line 4's first
  bullet routes through Part III *"with certain modifications"*, and i6251 p13's
  own `Form 2555` notes under Line 20 and Line 27 redirect both to the regular
  tax's worksheets or, failing those, to the 1040 worksheet's line 3. Those are
  untranscribed — and the flat 26%/28% BOUND this module leans on to
  short-circuit Part III at $0.00 does not survive them, because line 39 would
  be figured on the worksheet's line 3 rather than on line 6. Refusing BEFORE
  the bound rather than after it is the whole of the decision: a bound that no
  longer holds would short-circuit to $0.00 and understate the tax.

**How narrow that refusal is, and why it is affordable.** Line 6 is alternative
minimum taxable income LESS the exemption — $88,100 single, $137,000 joint for
2025 (Rev. Proc. 2024-40 §2.11). An expatriate whose AMTI stays under the
exemption is untouched whatever their preferential income, which is nearly all
of them; only a filer above it, holding qualified dividends or capital gain,
lands here.

The controls are the pair, in both directions: preferential income WITHOUT the
exclusion computes, and the exclusion WITHOUT preferential income computes.
Only the combination refuses.

---

## 5. The Form 8962 interaction, and §911(d)(6)

### 5a. Form 8962 — a plain ONE-WAY dependency, wired, not refused

i8962 Worksheet 1-1 builds Form 8962 line 2a as adjusted gross income **plus**
tax-exempt interest **plus Form 2555 lines 45 and 50** plus the nontaxable part
of Social Security benefits. `fjs/form8962`'s docstring called those two lines
*"a structural zero here and only while `foreignEarnedIncomeForm2555` is a
refused `fjs/return/scope` kind"*. This phase makes them live.

**It is not the §162(l) circularity.** `fjs/schedule/1/todo/self-employed-health-insurance.md`
§3 refused the Form 7206 / Form 8962 combination after establishing that
Rev. Proc. 2014-41 §2.05 creates a genuine cycle — *"the amount of the § 162(l)
deduction is based on the amount of the § 36B premium tax credit, and the amount
of the credit is based on the amount of the deduction"* — with no convergent
method in the guidance and an antitone iteration map. **Nothing on Form 2555
reads the premium tax credit.** Lines 27 through 50 read foreign earned income,
qualifying days, housing expenses, employer-provided amounts and deductions
allocable to excluded income; §36B appears nowhere on the form or in its
instructions. The edge runs one way only:

    Form 2555 lines 45, 50  →  Schedule 1 line 8d  →  1040 line 11 (AGI)
                            ↘  Form 8962 line 2a add-back

and the add-back exists precisely so that excluding income does not buy a larger
premium tax credit. There is no return edge, so there is no cycle to converge.

**It is proven at the wiring, not in Form 2555's leaves.** A `fjs/form2555`
proof cannot see Form 8962 at all, and AGENTS.md's rule is explicit that a
form-level proof cannot prove a wiring. `fjs/form1040/core`'s
`theForeignEarnedIncomeExclusionAddsBackIntoFormEightNineSixTwoHouseholdIncome`
is the leaf: it runs a full return with a Form 1095-A and a Form 2555 exclusion
and asserts the credit computed from the ADDED-BACK household income, against a
control with the same AGI and no exclusion.

### 5b. §911(d)(6) and Schedule 3's §904(j) credit — the combination REFUSES

§911(d)(6): *"No deduction or exclusion from gross income under this subtitle or
credit against the tax imposed by this chapter … shall be allowed to the extent
such deduction, exclusion, or credit is properly allocable to or chargeable
against amounts excluded from gross income under subsection (a)."* i2555 p3
restates it: *"You can't take a credit or deduction for foreign income taxes
paid or accrued on income that is excluded under either of the exclusions."*

`fjs/schedule/3` computes a §904(j) credit without Form 1116 when the profile
carries `section904jElectionAllForeignIncomeIsQualifiedPassiveIncome`. Two
independent reasons make that election and a Form 2555 exclusion incompatible,
and either one alone is enough:

1. **§911(d)(6) requires an allocation this engine cannot perform.** Pub. 514
   splits the foreign tax between excluded and non-excluded income; no stored
   document states the split, and there is no §904(j)-shaped shortcut for it.
2. **The election's own assertion contradicts the claim.** The field's name is
   the declaration: *every dollar of my foreign-source gross income is qualified
   passive income under §904(d)(2)(B)*. Foreign EARNED income is compensation
   for personal services — general category, never passive. A return asserting
   both is internally inconsistent before any allocation question arises.

So `fjs/schedule/3` refuses a return that carries both, message-only, with both
controls: the election alone still credits, and the exclusion alone still
computes.

### 5c. Two credits §911 switches off outright

Both are printed in i2555 p3 as flat bars, both are statutory, and both are
implemented as gates rather than as arithmetic:

- **The earned income credit** — §32(c)(1)(C), *Exception for individual
  claiming benefits under section 911*: *"The term 'eligible individual' does
  not include any individual who claims the benefits of section 911 (relating
  to citizens or residents living abroad) for the taxable year."* The statute
  disqualifies the PERSON, which is why the check reads the exclusion rather
  than a declared kind. `fjs/schedule/eic`'s docstring said no check was needed
  *"because `foreignEarnedIncomeForm2555` is already an `fjs/return/scope`
  refusal"*; that sentence is now false and the check is real.
- **The additional child tax credit** — §24(d)(3), *Exception for taxpayers
  excluding foreign earned income*: *"Paragraph (1) shall not apply to any
  taxpayer for any taxable year if such taxpayer elects to exclude any amount
  from gross income under section 911 for such taxable year."* Paragraph (1) is
  §24(d)'s REFUNDABLE portion and nothing else, so the non-refundable child tax
  credit is unaffected — which is exactly what `fjs/form8812` gates, and the
  half a blanket check would have broken.

Both credits' phase-outs also gain the add-back, and for the CTC the statute
states it directly: §24(b)(1) defines its modified adjusted gross income as
*"adjusted gross income increased by any amount excluded from gross income
under section 911, 931, or 933"*.

---

## 6. The kind split

`foreignEarnedIncomeForm2555` named three printed destinations under one row,
justified as *"ONE kind names all three printed lines because one form produces
them"*. That was right while nothing was modelled and is wrong now: the three
destinations have three different blockers, and a filer with no housing claim
must not be refused by a row about Notice 2025-16's table.

`fjs/return/scope`'s own rule is **one kind per fact a taxpayer can truthfully
declare having**. Four rows replace one:

| Kind | Printed lines | State |
|---|---|---|
| `foreignEarnedIncomeExclusion` | Form 2555 line 45 → Schedule 1 line 8d → 1040 line 8; and 1040 line 16's Foreign Earned Income Tax Worksheet | **MODELED** |
| `foreignEarnedIncomeBonaFideResidenceTest` | Form 2555 Part II | REFUSED — §1a |
| `foreignHousingExclusionOrDeduction` | Form 2555 lines 36 and 50 → Schedule 1 line 24j → 1040 line 10 | REFUSED — §3 |
| `foreignEarnedIncomeReceivedInAnotherTaxYear` | Form 2555 line 45's write-in | REFUSED — see below |

The fourth is i2555 p4's two-way timing rule: income received in 2025 for
services performed in 2024 is excludable *"if, and to the extent, the income
would have been excludable if you had received it in 2024"*, entered as a
write-in beside line 45 and computed against the PRIOR year's exclusion limit
and qualifying days; and income received in 2024 for 2025 services requires an
amended 2024 return. Both need a year this engine does not hold.

A **fifth** kind joins them, and it is the one that is a CONDITION rather than
a declaration: `foreignEarnedIncomeCapitalGainExcess`, raised by
`fjs/tax/line16` off the return's own figures when the worksheet's footnote
sends the filer to a second, modified preferential worksheet. That shape is not
new — `childsUnearnedIncomeForm8615` and `investmentInterestForm4952` have been
raised from computed conditions since Phase 10.

Counts move `55 → 56` modeled, `142 → 145` unmodeled, `197 → 201` vocabulary.

---

## 7. What a filer must supply, and where it lives

Five fields on `vnd.fjs.return_profile`, all `or(option, ...)`, none of them on any
information return — the `movingExpensesArmedForcesPermanentChangeOfStation` /
`line26EstimatedTaxPayments` precedent:

| Field | Form 2555 line | Type |
|---|---|---|
| `physicallyPresentInAForeignCountryThreeHundredThirtyFullDaysAndNoUnitedStatesAbode` | Part III, §1b | `or(option, true)` |
| `foreignEarnedIncomeQualifyingDays` | line 31 / 38 | `or(option, number)` |
| `foreignEarnedIncome` | line 26 → 27 | `or(option, string)`, money |
| `foreignEarnedIncomeDeductionsAllocableToExcludedIncome` | line 44 | `or(option, string)`, money |
| `foreignEarnedIncomeItemizedDeductionsAndExclusionsNotClaimed` | both worksheets' line 2b | `or(option, string)`, money |

**Why a profile field and not a dialect.** There is no information return for
foreign earned income at all: a foreign employer issues no Form W-2, and Part IV
lines 19 through 23 are a taxpayer's own tally of wages, non-cash lodging, meals,
a car, allowances and reimbursements. That is the same shape as the moving
expenses on `vnd.fjs.adjustments` — a figure the taxpayer states because nobody
else states it. It rides on the profile rather than on `vnd.fjs.adjustments`
because Form 2555 line 45 lands in Schedule 1 **Part I** (line 8d, additional
income), and that dialect is Part II's.

**Three cross-field checks in `checkReferences`**, all refusing rather than
guessing:

11. Any of the five present without `foreignEarnedIncomeExclusion` in
    `declaredKinds` is rejected — the amount would be silently ignored otherwise.
12. A present day count is a whole number from 0 to `vnd.fjs.rental_property`'s
    own `daysInTheLongestYear` (366, because this dialect does not know whether
    its year is a leap year). The TIGHTER bound — the actual length of the tax
    year, from `fjs/tax/params` — is checked in `fjs/form1040/core`, and a
    longer qualifying period refuses rather than being clamped.
13. `foreignEarnedIncome` present without the certification, or without a
    qualifying-day count, is rejected — an exclusion computed from an unstated
    qualifying period would prorate by a day count nobody supplied, and an
    absent count is not 365.

---

## 7b. The mutation log, and what it found

**Seventy-seven mutations were written; seventy-six ran** (one pattern did not
match and was rewritten), every one applied to the real tracked file, checked
with `git diff --numstat` for exactly one insertion and one deletion, and
reverted after a full `npm test`. **Two did not compile** and **twelve came
back green**, of which one was a mutation that was semantically a no-op
(`A || <impossible>`, re-run as a real inversion and killed) and one was an
equivalent mutant. **The other ten were real gaps**, and none was a mis-run:

| Survivor | What it was |
|---|---|
| The worksheet's line 6 floor | An **equivalent mutant**. Line 3 is line 1 plus line 2c, the capital-gain-excess guard bounds the preferential slice by line 1, and the tax function is monotone — so line 4 >= line 5 identically and the printed *"-0-"* clause is unreachable. Replaced by an assertion naming the invariant, on `fjs/tax/line16/qdcgt`'s own no-floor precedent; re-run as `worksheetLine5 - lineFourOutcome.cents` it kills fourteen leaves. |
| Schedule A's SALT add-back | **No leaf at all.** §164(b)(6)'s phase-down only bites above $500,000, and no fixture reached it. Closed with a $540,000 filer whose exclusion costs $12,000 of deduction. |
| §911(d)(6) gated on `elected` | **Worse than untested.** An unelected §911 filer holding a stored foreign tax was told to *"declare section904jElectionAllForeignIncomeIsQualifiedPassiveIncome"* — a remedy that lands them in this very refusal on the next run. The gate now reads the exclusion and the stored tax alone. |
| Eight wirings out of `fjs/form1040/core` | Six add-backs — Schedule A's, Schedule 1-A's, Schedule 8812's, Schedule 3's (Form 8863's), Schedule 2's (Form 6251's) and `fjs/schedule/eic`'s — plus the two profile readers for Form 2555 line 44 and the worksheets' line 2b. Each replaceable by `* 0n` with the whole suite green, because each module's own leaves take the figure as an argument. Closed by eight differential leaves, every one against a filer whose adjusted gross income already equals the post-exclusion figure. |

**The differential shape is the finding worth carrying forward.** An add-back's
whole job is to restore the pre-exclusion income, so a §911 filer must match a
plain filer at the HIGHER income and differ from one at the LOWER. Comparing
"with the exclusion" against "without it at the same wage" can never fail when
the add-back is dropped, because both sides move together.

Two mutations did not compile, and both are informative rather than wasted:
`&& false` inside an `if` trips `allowUnreachableCode` (AGENTS.md's own
warning), and deleting `foreignEarnedIncomeExclusion` from `modeledKinds` stops
the build at `_EveryKindIsEitherModeledOrRefused` — the partition guard doing
its job at `tsc` level rather than at run time.

---

## 8. What would retire each refusal

| Refusal | What it takes |
|---|---|
| `foreignEarnedIncomeBonaFideResidenceTest` | Nothing short of the IRS deciding intent. The realistic path is not a certification but a determination already made — a prior year's accepted Form 2555 Part II, which is a prior-year fact this engine does not hold. |
| `foreignHousingExclusionOrDeduction` | Notice 2025-16 §3's two hundred rows stored in full, plus a prior-year return for line 49's carryover, plus a line 34 employer-provided split no document reports. |
| `foreignEarnedIncomeReceivedInAnotherTaxYear` | A prior-year return. |
| Form 6251 Part III with an exclusion | i6251 p13's `Form 2555` notes under Line 20 and Line 27 transcribed. Line 2b already has a field; what is missing is Part III's own modifications, and the flat 26%/28% bound this module leans on does not survive them. |
| A capital gain excess at 1040 line 16 | i1040gi p37's footnote — four modifications reaching into the Unrecaptured Section 1250 Gain Worksheet — transcribed. |
| Form 7206 line 12 beside §162(l) premiums | a stored fact saying how the exclusion divides between the trade or business the plan is established under and everything else. |
| §904(j) election with an exclusion | Pub. 514's allocation of foreign tax between excluded and non-excluded income, and a document that states the split. |
