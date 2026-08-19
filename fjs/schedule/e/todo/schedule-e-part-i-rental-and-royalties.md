# Schedule E (Form 1040) Part I — Income or Loss From Rental Real Estate and Royalties

Spec written before the code, per AGENTS.md. Sources fetched and read directly
(2026-08-18), never from recall:

- `https://www.irs.gov/pub/irs-pdf/f1040se.pdf` — the 2025 form, Cat. No.
  11344L, "Created 5/6/25".
- `https://www.irs.gov/pub/irs-pdf/i1040se.pdf` — the 2025 instructions, Cat.
  No. 24332T, Nov 12, 2025.

Every page citation below is to the printed instructions' own page numbers (the
footer digit), not to a PDF page index.

## 0. The one-sentence answer

**A profitable rental property and a royalty compute. A LOSS does not, and it
refuses at the line rather than becoming a zero.** Everything else in this
document is the argument for those two sentences and for the boundary between
them.

## 1. What the printed page actually does with a profit and with a loss

Read printed lines 21 through 26 in order. They are not symmetric, and the
asymmetry is the whole design:

| Printed | Text |
|---|---|
| 21 | *"Subtract line 20 from line 3 (rents) and/or 4 (royalties). If result is a (loss), see instructions to find out if you must file **Form 6198**"* |
| 22 | *"Deductible rental real estate loss after limitation, if any, on **Form 8582**"* |
| 24 | *"**Income.** Add positive amounts shown on line 21. **Do not** include any losses"* |
| 25 | *"**Losses.** Add royalty losses from line 21 and rental real estate losses from line 22"* |
| 26 | *"Total rental real estate and royalty income or (loss). Combine lines 24 and 25"* |

Line 24 reads line **21**. Line 25 reads line **22** for a rental. So a property
whose line 21 is positive reaches line 26 **without line 22 existing at all** —
no Form 8582, no §469, no prior-year anything. i1040se p7, Line 22: *"Do not
complete line 22 if the amount on line 21 is from royalty properties."*

That is the structural fact this whole phase rests on: **§469 sits on printed
line 22, and a profit does not pass through printed line 22.** The engine can
therefore compute a profitable Part I exactly, and must refuse a loss.

## 2. §469, and why the $25,000 allowance is not reachable

i1040se p3, *Passive Activity Loss Rules*: *"A passive activity is any business
activity in which you did not materially participate and **any rental
activity**, except as explained later."* So a rental loss is passive by default,
and Form 8582 is the limitation.

i1040se p4 prints the one exception that removes Form 8582, *Exception for
Certain Rental Real Estate Activities*, and it is a conjunction of six
conditions. Three of them are unreachable here, and each for a different reason:

1. *"Rental real estate activities are **your only** passive activities."* This
   engine can carry a passive Schedule E Part II row at the same time
   (`fjs/schedule/e`'s passive column), so the condition is a statement about
   the whole return that no single property record can assert.
2. *"You do not have any **prior-year unallowed losses** from any passive
   activities"* — and 3d, *"no current or prior-year unallowed **credits** from
   passive activities."* Prior-year figures are this repo's standing
   architectural blocker; `vnd.fjs.prior_year_capital_loss` and
   `vnd.fjs.prior_year_ira_basis` exist precisely because a prior-year number
   has to be TRANSCRIBED, one printed line at a time, and there is no printed
   line for "unallowed passive credits" anywhere on a Form 1040.
3. *"Your **modified adjusted gross income** (MAGI) is $100,000 or less."*
   Pub. 925's MAGI for this purpose is adjusted gross income figured **without**
   the passive loss itself and with several deductions added back. It is
   therefore circular with the very line being computed, and its add-back list
   includes items this engine does not separately model. Approximating it with
   1040 line 11 would silently move the $25,000 allowance's phase-out.

Condition 3a is *active participation*, which i1040se p4 defines as
*"participated in making management decisions or arranging for others to provide
services … in a significant and bona fide sense"* — facts and circumstances, in
the identical shape as the `materialParticipation` assertion `vnd.fjs.k1_1065`
already stores. That one COULD be asserted. It is deliberately not stored,
because a stored field no line can read is the `box13StatutoryEmployee` defect
this repo has already shipped once: conditions 1, 2, 3d and 3e block the
allowance whatever the taxpayer asserts about participation.

**Conclusion.** §469(i)'s $25,000 special allowance is not reachable, so printed
line 22 is not computable, so a rental **loss** refuses. Printed line 25 is a
structural zero — not a silent one: no loss can reach it, because every loss
refuses before any total is formed. That is `fjs/schedule/e`'s own
`beneficiaryLossRefusal` shape and `fjs/schedule/c`'s line 31 shape, reached the
same way.

A **royalty** loss refuses too, for a different printed reason: line 25 takes a
royalty loss straight off line 21, so §469 never touches it — but line 21's own
printed text names **Form 6198**, and i1040se p3 *At-Risk Rules* says *"At-risk
rules apply to losses from rental real estate **or royalties**."* §465 is a
multi-year amount-at-risk history, the same shape §704(d) has in Part II. So the
two loss refusals are separate functions naming separate statutes, and the
message a filer gets tells them which form they actually need.

## 3. §280A — exactly when it bites, exactly what it caps

The whole of the §280A rule is in i1040se p5, under Line 2:

> *"You used the unit as a home if your personal use of the unit was more than
> the greater of: • 14 days, or • 10% of the total days it was rented to others
> at a fair rental price."*

> *"If you **did not** use the unit as a home, you can deduct all your expenses
> for the rental part, subject to the at-risk rules and the passive activity
> loss rules."*

> *"If you **did** use the unit as a home and rented the unit out for **fewer
> than 15 days** … do not report the rental income and do not deduct any rental
> expenses."* (§280A(g).)

> *"If you did use the unit as a home and rented the unit out for **15 or more
> days** … you may **not be able to deduct all your rental expenses**. See Pub.
> 527."* (§280A(c)(5).)

> CAUTION, and this one is unconditional: *"**Regardless** of whether you used
> the unit as a home, expenses related to days of personal use do not qualify as
> rental expenses. You must allocate your expenses based on the number of days
> of personal use to total use of the property. For example, you used your
> property for personal use for 7 days and rented it for 63 days. In most cases,
> **10% (7 ÷ 70)** of your expenses are not rental expenses."* (§280A(e).)

So there are three regimes and a clean predicate that selects them:

```
usedAsAHome  <=>  personalUseDays > 14  AND  personalUseDays * 10 > fairRentalDays
```

written that way so the comparison is exact integer arithmetic and no division
rounds. (*More than the greater of* 14 and 10% is a conjunction, because
exceeding a maximum means exceeding both of its arms.)

| Regime | Condition | Verdict |
|---|---|---|
| No personal use | `personalUseDays === 0` | **COMPUTES** |
| §280A(e) allocation only | `personalUseDays > 0`, not a home | **REFUSES** |
| §280A(c)(5) cap | a home, `fairRentalDays >= 15` | **REFUSES** |
| §280A(g) exclusion | a home, `fairRentalDays < 15` | **REFUSES** |

**Why the cap row refuses rather than computing.** §280A(c)(5) is Pub. 527's
Worksheet 5-1, which is not one multiplication: it orders the expenses into
three tiers, allows each only down to zero of remaining gross rental income, and
**carries the disallowed remainder forward to next year** — a prior-year figure
again, in the outbound direction this time. This engine cannot compute the cap,
so it refuses, per the standing rule.

The §280A(e) allocation alone looks computable — multiply by
`fairRental / (fairRental + personal)` — and it is refused anyway, on a ground
that has nothing to do with arithmetic: **the disallowed share of mortgage
interest and real estate taxes does not vanish.** It moves to Schedule A as
qualified residence interest and as a state and local tax, and this engine has
no wiring that carries it there. Computing the rental side alone would produce a
Schedule E that is right and a Schedule A that is short, which is the exact
"right number in the wrong place, silently" failure the project refuses
everywhere else. The instructions' own hedge — *"**In most cases**, 10%
(7 ÷ 70)"* — is the second reason: for interest and taxes, Bolton v.
Commissioner, 694 F.2d 556 (9th Cir. 1982), allocates over 365 days rather than
over total use days, so the IRS's day-count method is a position rather than the
only one.

**Every §280A refusal states which of the three regimes fired**, so a filer is
told whether they are in the allocation case, the cap case or the exclusion
case. And the predicate is proven at its own boundaries — 14 and 15 personal
days, and the 10% arm — rather than only through a whole-schedule leaf.

A **royalty** property has no line 1a and no line 2 at all — i1040se p4: *"For
royalty property, enter code '6' on line 1b and leave lines 1a and 2 blank for
that property."* §280A is about a *dwelling unit*; it cannot apply.

## 4. What the dialect carries, field by field, with the paper citation

### Why a new dialect and not `vnd.fjs.business_expenses`

`vnd.fjs.business_expenses` is the right MODEL and the wrong CONTAINER.

The model — a taxpayer-asserted record with an `accountNumber` subject key, a
free-string `category` per entry constrained one layer out against a frozen
vocabulary, an ISO `datePaid` in the document's own tax year, and a non-negative
decimal `amount` — is copied wholesale, because Schedule E Part I's expense
block is the same kind of thing as Schedule C Part II's: a taxpayer's own ledger
with no information return behind it.

The container cannot be shared, for three reasons that are all on the printed
page:

1. **Printed lines 1a, 1b and 2 have no field to live in.** A physical address,
   the 1-8 type code and the two day counts are per PROPERTY, and a Schedule C
   record has no property.
2. **Cardinality is opposite.** `fjs/schedule/c` refuses a SECOND
   `vnd.fjs.business_expenses` because Schedule C is filed per business.
   Schedule E Part I is a three-column table on one page and i1040se p2 says
   *"If you have more than three rental real estate or royalty properties,
   complete and attach as many Schedules E as you need … But fill in lines 23a
   through 26 on only one."* Many properties, one combined total, is what the
   form asks for.
3. **Lines 23c and 23d name two individual expense lines by number** — *"Total
   of all amounts reported on line 12 for all properties"* and *"… line 18 …"*.
   A printed total of one expense category cannot be produced from free text
   without a category-to-printed-line map, which is the same frozen vocabulary
   either way; putting it on a shared dialect would only make Schedule C carry
   fourteen categories it has no line for.

So: **`vnd.fjs.rental_property`, one document per printed COLUMN.**

### Document level

| Field | Paper | Why |
|---|---|---|
| `recipientTin`, `taxYear`, `corrected` | DOC-01/DOC-12 | the shared subject key |
| `accountNumber` | — | one document is one PROPERTY. It is also what a `vnd.fjs.asset_register` must MATCH for its Form 4562 line 22 to reach this property's line 18 — the identical binding `fjs/schedule/c` already makes between a register and a business |
| `propertyType` | line 1b, *"Type of Property (from list below)"* | the frozen eight-value vocabulary; see below |
| `otherTypeDescription` | line 1b list item *"8 Other (describe)"* | required exactly when `propertyType` is `other`; forbidden otherwise |
| `physicalAddress` | line 1a, *"Physical address of each property (street, city, state, ZIP code)"* | required for every type but `royalties`; FORBIDDEN for `royalties` (i1040se p4: *"leave lines 1a and 2 blank"*) |
| `fairRentalDays`, `personalUseDays` | line 2, *"Fair Rental Days" / "Personal Use Days"* | required for every type but `royalties`; forbidden for `royalties`. §280A turns on these two numbers and on nothing else |
| `qualifiedJointVenture` | line 2's *"QJV"* checkbox | `option(true)`, DOC-12's checkbox convention |
| `rentsReceived` | line 3, *"Rents received"* | required for every type but `royalties`; forbidden for `royalties` |
| `royaltiesReceived` | line 4, *"Royalties received"* | required for `royalties`; forbidden otherwise |
| `entries` | lines 5-17 and 19 | the expense ledger |

There is deliberately **no `formRevision`** and **no `payerTin`**: no payer
files a Form 1099 for a landlord's rents, exactly as none files one for a
Schedule C ledger. i1040se p6 notes that a $10 royalty *should* bring a Form
1099-MISC, and there is no `vnd.fjs.1099misc` dialect in this repo, so the
royalty amount is taxpayer-asserted here too. That is recorded at the field.

**Printed lines A and B are not represented.** They ask whether the filer made
payments requiring a Form 1099 and whether they filed them — a compliance
question that feeds no arithmetic anywhere on the page. Representing an unread
checkbox is the defect named in §2 above.

### The eight property types, from the printed list under line 1b

| `propertyType` | printed code |
|---|---|
| `singleFamilyResidence` | 1 |
| `multiFamilyResidence` | 2 |
| `vacationOrShortTermRental` | 3 |
| `commercial` | 4 |
| `land` | 5 |
| `royalties` | 6 |
| `selfRental` | 7 |
| `other` | 8 |

### Per entry

`{ category, datePaid, description, amount }` — `vnd.fjs.business_expenses`'
own entry shape, unchanged.

## 5. The expense categories, and the two that refuse

Fifteen recognized `category` values. Fourteen of them are printed expense
lines; the fifteenth is recognized in order to REFUSE, which is
`fjs/schedule/c`'s `depreciationAndSection179` idiom exactly.

| `category` | printed line |
|---|---|
| `advertising` | 5 |
| `autoAndTravel` | 6 — **REFUSES** |
| `cleaningAndMaintenance` | 7 |
| `commissions` | 8 |
| `insurance` | 9 |
| `legalAndOtherProfessionalFees` | 10 |
| `managementFees` | 11 |
| `mortgageInterestPaidToBanks` | 12 |
| `otherInterest` | 13 |
| `repairs` | 14 |
| `supplies` | 15 |
| `taxes` | 16 |
| `utilities` | 17 |
| `depreciationOrDepletion` | 18 — **REFUSES** |
| `other` | 19 |

- **Line 18 refuses a stored entry** because line 18 is COMPUTED, from a
  matching `vnd.fjs.asset_register` through `fjs/form4562` line 22. A stored
  entry would double the figure. This is `fjs/schedule/c` line 13's rule,
  written for the second time in the same words because it is the same rule
  about a different printed line. **Depletion** is refused with it: i1040se p7
  puts depletion on the same printed line, and this engine models no depletion
  at all.
- **Line 6 refuses**, on the instructions' own words (i1040se p6, Line 6): *"If
  you claim any auto expenses (actual or the standard mileage rate), you must
  complete Part V of Form 4562 and attach Form 4562 to your tax return."*
  `fjs/form4562` Part V REFUSES — §274(d) substantiation and §280F's caps — so a
  Schedule E carrying a line 6 amount is a return this engine cannot complete.
  Same answer, same reason, as Schedule C line 9's `carAndTruck`.

An unrecognized `category` refuses by name, quoting the value.

## 6. Line 18 and the asset register

`fjs/form4562`'s MACRS module already reproduces Publication 946 Table A-6 —
residential rental, 27.5-year, mid-month — at **114 of 114** hand-typed printed
cells, and `vnd.fjs.asset_register`'s `classification` vocabulary already
carries `residentialRental` (27.5, S/L, MM) and `nonresidentialReal` (39, S/L,
MM), with the mid-month convention forced by the classification and
cross-checked at the dialect. Table A-7a's systematic difference is
*nonresidential* real property, not residential rental, and `fjs/form4562/macrs`
records it at the site.

**So no new depreciation path is written.** A rental property's line 18 is
`formFortyFiveSixtyTwo(...)` line 22 on the register whose `accountNumber`
matches the property's, and every one of Form 4562's own refusals is threaded
out verbatim.

The register's mid-quarter aggregate is per Form 4562, and i4562 p1 files one
per *"business or activity"*, so a register bound to one property is one Form
4562 and its own `everyDepreciableAssetIsListed` certification is the
certification that aggregate needs. i4562 p11 excludes residential rental and
nonresidential real property from the mid-quarter test outright, which
`fjs/form4562` already implements.

Two register refusals are new and both name the ambiguity rather than guessing:
two registers matching one property, and — in `fjs/schedule/c`, corrected — a
register matching neither a business nor a property.

**`fjs/schedule/c`'s existing "register with no business record" refusal is
narrowed, not deleted.** It exists because dropping a rental register silently
would lose the depreciation; now that Part I exists, a register whose
`accountNumber` matches a stored `vnd.fjs.rental_property` is CLAIMED by
Schedule E and Schedule C must not see it. A register matching neither still
refuses, with a corrected message.

**Form 6251 line 2l.** `fjs/schedule/c`'s Form 4562 is today the only route by
which an asset register reaches the alternative minimum tax. A rental register's
§56(a)(1) adjustment must reach the same line, or a landlord's AMT is silently
short. Part I therefore exposes one summed
`alternativeMinimumTaxAdjustmentCents` and `fjs/form1040/core` adds it to the
Schedule C figure at the ONE site that already reads it.

## 7. The lines, in printed order

| Printed | This engine |
|---|---|
| A, B | not represented — compliance checkboxes no total reads |
| 1a, 1b, 2 | carried per column off the document; 1b's code and 2's two day counts drive §3 |
| 3 | `rentsReceived` |
| 4 | `royaltiesReceived` |
| 5-17, 19 | summed per category off `entries` |
| 6, 18 | see §5 — a stored entry in either category REFUSES; 18 is COMPUTED |
| 20 | *"Total expenses. Add lines 5 through 19"* |
| 21 | line 3 (or line 4) less line 20 |
| 22 | never completed — a rental loss REFUSES before it exists (§2) |
| 23a-23e | the five printed cross-property totals: lines 3, 4, 12, 18, 20 |
| 24 | *"Add positive amounts shown on line 21"* |
| 25 | structural zero — every loss refuses (§2) |
| 26 | lines 24 + 25, **-> Schedule E line 41 -> Schedule 1 line 5 -> 1040 line 8** |

## 8. Which kinds move, and which do not

- **`rentalRealEstateAndRoyalties` → MODELED**, wired to Schedule E Part I,
  Schedule E line 26, Schedule 1 line 5 and 1040 line 8 in the SAME commit —
  wire before reclassify. The precedent for reclassifying a kind whose LOSS
  still refuses is `businessIncomeOrLoss` (Schedule C line 31 refuses a net
  loss) and `partnershipAndSCorporationIncome` (every K-1 loss refuses), both
  already modeled on exactly that footing.
- A **tripwire** is added with it, the tenth: a stored `vnd.fjs.rental_property`
  with non-zero rents or royalties and no declaration would otherwise compute a
  return that silently omits Part I, since `fjs/schedule/e` runs off the
  documents. This is `businessIncomeOrLoss`'s row, for the same reason.
- **The two Schedule K-1 rental boxes stay refused.** 1065 box 2 and 1120-S box
  2 are *net rental real estate income*, and a partner's or shareholder's share
  of it is not a Part I property column at all — it belongs in printed Part II
  line 28's passive columns after Form 8582. Their remedy prose, which today
  says Part I is what "this engine does not model", is CORRECTED rather than the
  boxes routed.
- **The two Schedule K-1 royalty boxes stay refused, and the old remedy's claim
  is re-examined rather than repeated.** The claim was true and half of it still
  is: printed line 4 is Part I's, so a royalty genuinely cannot ride into line 41
  on the Part II block. What has changed is that line 4 now EXISTS. What has not
  changed is that nothing routes box 7 (1065) or box 6 (1120-S) to it, and
  routing the gross box alone would report a partner's royalty with none of the
  depletion or expense the same K-1's coded boxes carry — every one of which
  refuses by name today. So the boxes stay refused with a corrected remedy that
  names the missing WIRING rather than a missing line.
- **`netFarmRentalIncomeForm4835` and `remicResidualInterest` are untouched.**
- **`fjs/schedule/eic`'s §32(i)(2)(C) refusal is untouched**, and only its prose
  is corrected. It refuses the earned income credit when
  `rentalRealEstateAndRoyalties` is declared, on the grounds that disqualified
  income component (C) — printed *"Schedule E line 23b royalties, less line 20"*
  plus net rent — is not computable. Its inputs now partly exist; the refusal is
  left standing rather than widened in the same phase that built them, and the
  docstring claiming `fjs/return/scope` refuses the kind first is now false and
  is corrected.
