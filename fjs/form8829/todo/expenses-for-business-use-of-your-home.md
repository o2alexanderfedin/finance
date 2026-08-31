# Form 8829 — Expenses for Business Use of Your Home

Schedule C line 30, which `fjs/schedule/c` has carried as a documented zero with a refusal
beside it since that schedule was written. Its remedy line named this form and the simplified
method; this file settles which of the two is built, what computes, and what refuses.

Sources, fetched and read rather than recalled (2026-08-19):
`https://www.irs.gov/pub/irs-pdf/f8829.pdf` (Form 8829 (2025), Cat. No. 13232M, "Created
10/2/25") and `https://www.irs.gov/pub/irs-pdf/i8829.pdf` (its instructions, Catalog Number
15683B, "Mar 4, 2026").

## 1. The two methods, and which one this is

**The actual-expense method, which IS Form 8829. The simplified method is refused by name.**

The printed instruction settles that they are alternatives rather than layers. i8829, *Who
cannot use Form 8829*:

> *"Do not use Form 8829 in the following situations. ... **You have elected to use the
> simplified method for your home for 2025.** If you had more than one home during the year
> that you used for business, you can use the simplified method for only one home."*

So an engine that computed both would be computing a form the electing taxpayer may not file.
The election is therefore a stored fact and not an inference, and it is a **two-value frozen
vocabulary** rather than an `or(option, true)` — `businessUseOfHomeMethod`, either
`'actualExpenses'` or `'simplified'` — following
`vnd.fjs.business_expenses`' own `specifiedServiceTradeOrBusinessValues`. Under `or(option, true)`
absence and a denial would be the same stored state, and here the two states lead to two
different deductions of different sizes, so absence must be *unstated* and must refuse.

The simplified method is refused rather than built, and the reason is that it is not this
form's arithmetic at all: Rev. Proc. 2013-13's $5 per square foot on at most 300 square feet is
computed on the **Simplified Method Worksheet in the Instructions for Schedule C**, its
deduction is capped at gross income with **no carryover of the disallowed part in either
direction**, and it takes no depreciation. Every one of those is a different rule from the ones
below. Shipping it would be a second phase against a different printed page, not a branch of
this one. The refusal names the worksheet so the reader knows where the figure they want lives.

## 2. The gross income limitation, and the asymmetry that is the whole design

**A deduction fully allowed this year computes. A deduction the limitation LIMITS refuses.**

Line 8 is the ceiling:

> *"Enter the amount from Schedule C, line 29, plus any gain derived from the business use of
> your home, minus any loss from the trade or business not derived from the business use of
> your home."*

and lines 27 and 33 apply it:

> line 27: *"Allowable operating expenses. Enter the smaller of line 15 or line 26"*
> line 33: *"Allowable excess casualty losses and depreciation. Enter the smaller of line 28 or
> line 32"*

The excess is not lost, it **carries forward**, and Part IV is where it goes:

> line 43: *"Operating expenses. Subtract line 27 from line 26. If less than zero, enter -0-"*
> line 44: *"Excess casualty losses and depreciation. Subtract line 33 from line 32. If less
> than zero, enter -0-"*

A prior-year figure is this engine's documented architectural blocker, and the question is
exactly which direction it blocks:

- **A carryover OUT (lines 43 and 44) is created by THIS year's return and is the blocker.**
  A non-zero line 43 or 44 is an amount the 2025 return computes and the 2026 return must
  read, and nothing here can hand it over. Worse, it is not merely unrecorded: the deduction
  it represents is real and deferred, so a return that silently produced it would be
  understating the 2026 deduction with no trace. So **when line 26 exceeds line 15, or line 32
  exceeds line 28, this form refuses at the printed line**.
- **A carryover IN (lines 25 and 31) is NOT a blocker.** The printed instruction for both is a
  transcription, not a computation — *"Enter any amount from your 2024 Form 8829, line 43"* and
  *"Enter any amount from your 2024 Form 8829, line 44"*. It is one number off a piece of paper
  the taxpayer already has, in the shape Form 2441 line 13's `dependentCareGraceCarryoverUsed`
  already is. It is stored and used. What separates it from Form 2441 line 9b — which this repo
  DOES refuse — is that line 9b sends the reader to Worksheet A and **five** prior-year figures
  that have to be recomputed; line 25 sends them to one printed box.

  Absence of the assertion is *unstated* and refuses, for `fjs/form2441` R6's reason: a
  serializer that drops a key must not be able to produce a deduction.

**The asymmetry is real and it is not a technicality.** `fjs/schedule/c` already refuses a net
loss on line 31, so every return this engine computes has a non-negative line 29 — which is
line 8. The population that reaches Form 8829 at all is therefore the population with a
tentative profit, and for most of them the home-office expenses are well under it. Those
returns compute in full. The ones where the limitation bites are exactly the ones that create
the carryover, so refusing there costs the engine nothing it could otherwise have had.

## 3. Depreciation of the home — Part III, and why the asset register is not the route

**Form 8829 Part III does not use MACRS tables at all. i8829 prints its own percentage table,
and Part III is a five-line multiplication.**

> Line 41: *"IF you first used your home for business in the following month in 2025 ... THEN
> enter the following percentage on line 41: January 2.461%, February 2.247%, March 2.033%,
> April 1.819%, May 1.605%, June 1.391%, July 1.177%, August 0.963%, September 0.749%,
> October 0.535%, November 0.321%, December 0.107%"*
>
> and, for a home first used for business *"after May 12, 1993, and before 2025"*, **2.564%**.

That is 39-year nonresidential real property under the mid-month convention, and it is the one
printed table the asset-register work found `fjs/form4562/macrs` does NOT reproduce. **That
finding is already written down in this repository and is not re-derived here** — see that
module's own docstring and `proof.thirtyNineYearMidMonthDivergesFromTableA7a`, which hand-types
both rows:

> *"Table A-7a (39-year mid-month) differs systematically and is not checked cell by cell ...
> Printed year 1 month 1 is `2.461%`; `(11.5/12)/39` is `2.45726%` -> `2.457`. Every printed
> month is `0.107 + (12 - m) x 0.214`, i.e. A-7a accumulates the ROUNDED monthly increment
> (`1/12/39 = 0.21368%` -> `0.214`) rather than rounding the exact value. Years 2-39 agree at
> `2.564`. The derived column still sums to exactly 100%."*

That leaf measures the divergence exactly: **two of the twelve year-one cells agree** (months
11 and 12, by coincidence) and ten do not. i8829's line 41 rows ARE Table A-7a's year-one row,
verbatim — `2.461 2.247 2.033 1.819 1.605 1.391 1.177 0.963 0.749 0.535 0.321 0.107` — so a
Form 8829 that reached into `fjs/form4562/macrs` for its percentage would print `2.457%` where
the paper prints `2.461%`. On a $300,000 business basis that is $12.00 of depreciation with no
line of the form to explain it.

**This form therefore hand-types i8829's own twelve rows.** That is not a workaround for the
divergence — i4562 p11 permits either construction, which is why `fjs/form4562/macrs` ships the
derived one — it is that Form 8829 has a different printed instruction from Form 4562, and this
module follows the page it is transcribing. The two coexisting, each correct against its own
page, is the point; the hand-typed rows are checked against the derived column in a proof that
asserts the divergence rather than hiding it.

**The asset register is not used here, and cannot be.** It has no land-value field at all
(`registeredAsset` is eleven fields and none of them splits land out of `costOrOtherBasis`),
which is Form 8829 line 38 with nowhere to go; and its `businessUsePercentage` is a flat scalar
where line 7 is a floor-area ratio the form derives from lines 1 and 2. But those are the
smaller obstacles. The decisive one is routing, and it is the printed page's own instruction
rather than an implementation detail. i8829, Line 42:

> *"Complete and attach Form 4562, Depreciation and Amortization, only if: You first used your
> home for business in 2025, or You are depreciating additions and improvements placed in
> service in 2025. ... **Do not include the amount from Form 8829, line 42, on Schedule C, line
> 13.**"*

Schedule C line 13 is precisely where `vnd.fjs.asset_register` -> `fjs/form4562` line 22 lands
in this engine, and `fjs/schedule/c` routes a register there on `accountNumber` alone — the
same `accountNumber` this business's record already carries. So a home entered in the register
would reach Schedule C line 13 automatically and be deducted TWICE, once there and once through
line 30. The register is the wrong home for this asset **by instruction**, independently of
whether it could express a residence used partly for business.

For the record, it cannot: `fjs/schedule/e/part_i` refuses any personal use of a dwelling unit
outright (`personalUseDays > 0`), all three §280A regimes with it, so nothing in this engine
has ever depreciated a partly-personal residence. Reporting that rather than building a second
depreciation path is what the register's own spec asked for.

What Part III needs and gets its own stored fields for: line 37 (the smaller of the home's
adjusted basis or its fair market value *"on the date you first used the home for business"*),
line 38 (the land included in line 37), and the month and year first used for business. Lines
39, 40 and 42 are arithmetic.

## 4. Where the facts are transcribed from — NO new dialect

**`vnd.fjs.business_expenses` gains an optional `businessUseOfHome` record. No new dialect is
added.** The inclusion rule is that dialect's own, stated in its header and in its
`accountNumber` field's docstring: **one document is one BUSINESS**. Form 8829's own subtitle
is *"File only with Schedule C (Form 1040)"* and i8829's Line 36 is *"If your home was used in
more than one business, allocate the amount shown on line 36 to each business"* — so the form
is per business, which is exactly this dialect's cardinality, and its output lands on the
Schedule C line this dialect's entries already feed.

No information return reports a square footage, a mortgage interest split or a home's basis,
so the record is taxpayer-asserted throughout — the same provenance as every other field on
this dialect and the reason it has no `formRevision`.

The other split the printed form makes — *"Use a separate Form 8829 for each home you used for
the business during the year"* — is one this record cannot express, because there is one
`businessUseOfHome` per business document. A taxpayer with two homes is refused by name.

## 5. Schedule A, and the split this engine will not make

**An ITEMIZING filer is refused. A standard-deduction filer never faces the split at all**, and
that is printed:

> i8829, *Lines 9, 10, and 11 — Taxpayers claiming the standard deduction*: *"If you claim the
> standard deduction, you will not include any mortgage interest or real estate taxes on lines
> 10 and 11; instead, you will claim the entire business use of the home portion of those
> expenses using lines 16 and 17."*

For that filer lines 9, 10, 11, 12, 13 and 14 are structural zeros, line 15 is line 8 entire,
and the mortgage interest and real estate taxes arrive as ordinary indirect operating expenses
on lines 16 and 17 where line 7's percentage does the allocation. **There is no Schedule A
interaction, because there is no Schedule A.**

For an itemizer there is, and it is two worksheets deep:

> *"Step 1. Treat all the mortgage interest you paid as a personal expense and figure the
> amount that would be deductible as an itemized deduction on Schedule A. See Pub. 936 ..."*
>
> *"Step 1. If the total of your state and local income (or if elected on your Schedule A,
> general sales) taxes, real estate taxes, and personal property taxes is not more than $10,000
> ($5,000 if married filing separately), enter all the real estate taxes attributable to the
> home in which you conducted business in column (b) of line 11."* — otherwise the Line 11
> Worksheet.

and the return trip is worse: *"if your business percentage on line 7 is 30%, 70% of the amount
you included in column (b) of line 10 is deductible as an itemized deduction on Schedule A."*
So the same dollars have to be split, one part reaching line 10 here and the other reaching
Schedule A, and Schedule A's own SALT cap then re-limits the second part. `fjs/schedule/a` has
no mechanism to accept a figure Form 8829 removed from it, and building one would put the same
rule in two places.

Schedule E Part I refused its §280A allocation partly on this ground, and this is the same
refusal at a different printed line.

## What computes, and what refuses — the table

| Printed | Computes? | From / why not |
|---|---|---|
| 1, 2, 3 | ✔ | stored square footage; line 3 = line 1 / line 2 |
| 4, 5, 6 | REFUSES if asserted | the daycare exception: a licence fact and an hours proration no record here carries |
| 7 | ✔ | line 3 (non-daycare) |
| 8 | ✔ | Schedule C line 29, gated on the taxpayer's own "all gross income is from the business use of the home" assertion |
| 9, 29, 35 | REFUSES if asserted | Form 4684 is not modeled |
| 10, 11 | structural zero for a standard-deduction filer; the ITEMIZER refuses | i8829's own standard-deduction paragraph |
| 12, 13, 14, 15 | ✔ | arithmetic |
| 16-22 | ✔ | stored direct (a) and indirect (b) amounts, one per printed line |
| 23, 24, 26 | ✔ | arithmetic |
| 25 | ✔ | stored, a transcription off the 2024 Form 8829 line 43 |
| 27 | ✔, and REFUSES when the limitation BINDS | see §2 |
| 28 | ✔ | arithmetic |
| 30 | ✔ | line 42 |
| 31 | ✔ | stored, a transcription off the 2024 Form 8829 line 44 |
| 32 | ✔ | arithmetic |
| 33 | ✔, and REFUSES when the limitation BINDS | see §2 |
| 34, 36 | ✔ | arithmetic; line 36 -> Schedule C line 30 |
| 37, 38, 39, 40 | ✔ | stored basis and land value; arithmetic |
| 41 | ✔ | i8829's own twelve printed rows plus 2.564%, hand-typed |
| 42 | ✔ | line 40 x line 41; REFUSES an addition or improvement placed in service after the home was first used for business |
| 43, 44 | ✔, and always ZERO | the two refusals above are what makes them zero, and they are computed and asserted rather than assumed |

Refused by name, each at its printed line: the simplified-method election; an unstated method;
an unstated "all gross income from the home" assertion; a daycare facility; any casualty loss;
an itemizing filer; a binding gross-income limitation (twice, lines 27 and 33); a home first
used for business before 13 May 1993 or one whose business use stopped before year end; an
addition or improvement; a second home.

## What is deliberately NOT here

- **No new `fjs/return/scope` kind.** Business use of the home is not a 1040 line, a Schedule 1
  line or a Schedule 3 line — it is inside Schedule C, whose kinds
  (`businessIncome`/`selfEmploymentTax`) already exist and already cover it. The refusal this
  work replaces was a `refusedExpenseCategories` row on `fjs/schedule/c`, not a scope kind, and
  it stays a category — reclassified from refused to computed.
- **No second depreciation path.** See §3: the register is not used, and Part III does not
  reach `fjs/form4562` at all.

## The mutation log

Gate before: **2,902 pass / 0 fail** (`feature/tier-b-forms` @ `73e9832`). After the Form 2441
fix: 2,911. After this form: **2,962 pass / 0 fail**, 2,923 project-local leaves. Every
mutation below compiles, was applied to the tracked file, and `git diff --numstat` was checked.

| # | Mutation | Red |
|---|---|---|
| M8 | line 24 does not multiply column (b) by line 7 | **8** — all four layers |
| M9 | the January row becomes `fjs/form4562/macrs`' derived `2.457` | **1** — the divergence leaf |
| M10 | the line 43 (operating) limitation refusal never fires | **4** |
| M11 | the line 44 (depreciation) limitation refusal never fires | **1** |
| M12 | the wiring hands Form 8829 Schedule C line **7** instead of line 29 | **2** |
| M13 | the itemizer refusal never fires | **1** |
| M14 | the direct and indirect columns are transposed | **10** |
| M15 | line 42 truncates instead of rounding half-up | **0 — SURVIVED** |
| M16 | `allocate` truncates instead of rounding half-up | 1, after M15's fix |
| M17 | line 27 takes the LARGER of lines 15 and 26 | **22** |
| M18 | line 25's carryover IN is dropped | **1** |
| M19 | line 31's carryover IN is dropped | **1** |
| M20 | line 38's land is not subtracted from line 37 | **11** |
| M21 | printed line 22 falls out of the tuple and the caption map | **3** |
| M22 | a `simplified` election is computed as `actualExpenses` | **1** |
| M23 | `landIncludedInThatBasis` falls out of the dialect's exactness loop | **1** |
| M24 | `${destination}` is erased from every refusal | **15** |
| M25 | line 34 stops adding line 33 | **6** |

**M15 is the finding.** Every fixture in this module divided evenly — $20,000.00 at 2.564% is
$512.80 to the cent, $4,000.00 is $102.56 — so replacing line 42's `halfUp` with truncation left
the entire suite green. Both rate lines now have a leaf whose expected value is the half-up
answer with the truncated one named beside it ($25.65 against $25.64; $66.67 against $66.66),
and M15 and M16 each redden exactly one.

**M11 is the second finding, and it was predicted at the site.** The depreciation tier binds
SECOND — i8829 allows operating expenses first — so a return can have line 27 fully allowed and
still be limited at line 33. No fixture built for the first tier can reach the second, and
without `aBindingDepreciationLimitationIsRefusedNamingLineFortyFour` the whole line 44 refusal
would have been deletable with the suite green.

**M9 measures a real, accepted narrowness.** Only one leaf reddens, because no fixture is a home
first used for business in January. That leaf pins all twelve rows against both the printed and
the derived table, which is the coverage that matters; a per-month fixture would add eleven
leaves that assert the same multiplication.

Counts recomputed and each mutated to watch it redden: `expectedModeledKindCount` 54,
`expectedUnmodeledKindCount` 141, `expectedTripwireCount` 10, `unread_registry`'s
`expectedDialectCount` 16. **None of them moves.** No new scope kind (business use of the home
is inside Schedule C, whose kinds already exist), no new tripwire, and no new dialect — so
`fjs/media/dialects`' own count and the dispatch table are untouched too, which is the
`vnd.fjs.business_expenses` decision paying for itself.
