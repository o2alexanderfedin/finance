# Schedule F (Form 1040) — Profit or Loss From Farming

Written before `fjs/schedule/f/module.f.js` and `fjs/document/farm/module.f.js`.
Every citation is to the printed 2025 `f1040sf.pdf` face or the 2025 `i1040sf.pdf`
instructions by page, fetched 2026-08-19.

`farmIncomeOrLoss` is an `fjs/return/scope` refusal today, reading
`{ line: 'Schedule 1 line 6 -> 1040 line 8', label: 'farm income or loss',
remedy: 'requires Schedule F (no phase yet)' }`. This is the phase that supplies it.

---

## 0. The five questions this phase had to answer, and where the paper answered them

| # | Question | Answer | Citation |
|---|---|---|---|
| 1 | Cash or accrual, or both? | **Cash ships. Accrual REFUSES at printed line 45.** | i1040sf p1 "Line C"; f1040sf Part III lines 45-49 and its footnote |
| 2 | Can `vnd.fjs.business_expenses` serve? | **No — new dialect `vnd.fjs.farm`.** | the three printed reasons in §2 below |
| 3 | Does line 34's loss compute? | **No. A profit and a break-even zero compute; a loss refuses at printed line 34.** And the binding statute is **§461(l), not §461(j)** | i1040sf p9 "Line 34", p10 "Line 36"; §461(l)(1) flush text |
| 4 | Does `vnd.fjs.asset_register` serve farm property? | **Yes, and the 150%-DB premise is stale.** | i4562 p11 |
| 5 | Which kinds reclassify? | `farmIncomeOrLoss` alone. `netFarmRentalIncomeForm4835` and `farmIncomeAveragingScheduleJ` stay refused. | i1040sf p2 "Other Schedules and Forms You May Have To File" |

---

## 1. Cash versus accrual — Part III refuses at a printed line

i1040sf p1, **Line C**:

> If you use the cash method, check the box for "Cash." Complete Schedule F (Form 1040),
> Parts I and II. […] If you use the accrual method, check the box for "Accrual." Complete
> Schedule F (Form 1040), Part I, line 9; Part II; and Part III.

So the two methods are a partition, not a superset: Part II serves both, Part I lines 1a-8
belong to the cash method alone, and Part III replaces them for the accrual method. Shipping
only one is therefore possible without leaving a half-form.

**Part III refuses, and the blocker is on the printed page rather than in this engine's
architecture.** Printed line 45 is *"Inventory of livestock, produce, grains, and other
products at beginning of the year"* and printed line 48 is the same at end of year. Two
independent facts make them unreachable:

- **Line 45 is a PRIOR-YEAR figure.** The beginning-of-year inventory is last year's ending
  inventory. This repository holds one tax year; every prior-year figure it does hold has a
  printed line to transcribe it from *on this year's return* and a dialect that says so
  (`vnd.fjs.prior_year_capital_loss`, `vnd.fjs.prior_year_ira_basis`). Line 45 has one too —
  but see the next point, which is the reason a transcription is not enough.
- **Lines 45 and 48 are not amounts, they are the output of a VALUATION METHOD**, and the
  printed footnote to line 49 says so out loud: *"If you use the unit-livestock-price method
  or the farm-price method of valuing inventory and the amount on line 48 is larger than the
  amount on line 47, subtract line 47 from line 48. Enter the result on line 49. Add lines 44
  and 49."* The sign of the whole of lines 47-50 flips on which method the taxpayer uses, and
  no document in this engine carries a valuation method. i1040sf p10, Part III: *"In most
  cases, you must include animals and crops in your inventory if you use this method. See Pub.
  225 for exceptions, inventory methods, how to change methods of accounting, and rules that
  require certain costs to be capitalized or included in inventory."*

So `accrualMethodIsUnmodeled` refuses at printed line 45, naming line 48, the two valuation
methods and the footnote's sign reversal. **It is reached exactly when the printed form says
to reach it** — when line C says "Accrual" — which is `fjs/schedule/c`'s
`atRiskDeterminationLine32` shape: a real named function that always refuses, at the printed
line where a filer can act on it.

**The control that keeps it a gate rather than an outage:** a `cash` document computes every
printed line, and that is the whole of the rest of this spec.

---

## 2. `vnd.fjs.business_expenses` is the right MODEL and the wrong CONTAINER

This is the Schedule E Part I question, asked again and answered the same way, so the reasons
below are the ones that are DIFFERENT for farming rather than a restatement.

The **model** is copied wholesale, and not one line of it is re-argued: a taxpayer-asserted
record with an `accountNumber` subject key, a free-string `category` per entry constrained one
layer out against a frozen vocabulary, an ISO `datePaid` in the document's own tax year, a
non-negative decimal `amount`, and no `formRevision` and no `payerTin` because there is no
printed form behind it. Schedule F Part II is the same kind of thing as Schedule C Part II.

The **container** cannot be shared, and the first reason is sharper here than it was for
Schedule E:

1. **`fjs/schedule/c` would file a Schedule C for the farm.** `scheduleC` consumes *every*
   stored `vnd.fjs.business_expenses`. A farm stored in that dialect would not merely land in
   a record with the wrong cardinality — it would be computed onto the wrong printed form,
   under Schedule C's own twenty-five-category vocabulary, and reach Schedule 1 line **3**
   instead of line **6**. f1040sf Part IV prints the opposite instruction on its own face:
   *"Do not file Schedule F (Form 1040) to report the following. • Income from providing
   agricultural services such as soil preparation, veterinary, farm labor, horticultural
   services […] Instead, see the Instructions for Schedule C (Form 1040)."* The two forms are
   a partition of one taxpayer's activities and the printed pages police the boundary in both
   directions. A shared container would need a discriminator field, and a discriminator field
   is a new dialect with extra steps.
2. **Printed lines 1a through 8 have no field to live in.** Eight printed income lines, four of
   them carrying a gross amount and a taxable amount separately (3a/3b, 4a/4b, 5b/5c, 6a/6b),
   and one more (1a/1b) carrying a gross and its cost. `vnd.fjs.business_expenses` has exactly
   one income-side field, `grossReceiptsFullyReportedOnForms1099Nec`, and it is a checkbox
   about Forms 1099-NEC — a document class that reports no farm income at all.
3. **The expense vocabularies are disjoint.** Schedule F prints twenty-five expense lines
   (10-32, with 21a/21b and 24a/24b split); `chemicals`, `feed`, `fertilizersAndLime`,
   `seedsAndPlants`, `storageAndWarehousing` and `veterinaryBreedingAndMedicine` have no
   Schedule C line, and `costOfGoodsSold`, `deductibleMeals`, `businessUseOfHome`,
   `contractLabor`, `commissionsAndFees`, `officeExpense`, `advertising` and `travel` have no
   Schedule F line. `fjs/schedule/c`'s `expenseCategoryLine` is typed
   `Record<ExpenseCategory, PrintedExpenseLine>` and is TOTAL by `tsc`; merging the two
   vocabularies would make it total over categories neither form can place.

**Adding no dialect was the outcome to prefer, and it is not available here.** Form 7206
reached it because §162(l) is one adjustment on a schedule whose dialect already carries a
free-string `lineTag`. Schedule F is a whole printed form with its own income block.

So: **`vnd.fjs.farm`, one document per printed Schedule F**, following
`vnd.fjs.rental_property`'s file structure and `vnd.fjs.business_expenses`' entry shape.

### What the dialect does NOT carry

Printed lines **B** (the six-digit principal agricultural activity code), **D** (EIN), **F**
and **G** (whether the filer made payments requiring a Form 1099 and whether they filed them).
None feeds any arithmetic on the page. `vnd.fjs.rental_property` states the rule and this
dialect follows it: *"A stored field no line can read is the `box13StatutoryEmployee` defect
this repository has already shipped once."*

Printed line **A** (`principalCropOrActivity`) IS carried, because the second-Schedule-F
refusal quotes it — exactly as `principalBusiness` is quoted by `fjs/schedule/c`'s.

---

## 3. Printed line 34 — a profit computes, a loss refuses, and §461(j) is the wrong statute

### The printed page

i1040sf p9, **Line 34**:

> **Figuring your net profit or loss.** If line 33 is more than line 9, don't enter your loss
> on line 34 until you have applied the at-risk rules and the passive activity loss rules. To
> apply these rules, follow the instructions for line 36 and the Instructions for Form 8582.
> After applying these rules, the amount on line 34 will be your loss, and it may be smaller
> than the amount figured by subtracting line 33 from line 9. You may also be required to file
> Form 461, which limits the allowable loss.
>
> If line 9 is more than line 33, and you don't have prior-year unallowed passive activity
> losses, subtract line 33 from line 9. The result is your net profit.

The asymmetry is the page's own, and it is the same asymmetry Schedule C line 31 and Schedule
E Part I line 21 already have. A **profit** passes through none of §465, §469 or Form 8582; a
**loss** passes through all of them.

### §461(j) does NOT bind. §461(l) does

The brief for this phase named *"§461(j)'s excess farm loss"*. That is stale law, and the
correction matters because the two provisions have different thresholds and different
carryover consequences:

- **§461(l)(1) flush text** disapplies §461(j) for any taxpayer other than a corporation in
  any year §461(l) applies.
- i1040sf p1, **Reminders**: *"Excess business loss limitation rules. The limitation on excess
  business losses for noncorporate taxpayers is applicable for 2025. See Form 461."*
- i1040sf p9, **Excess business loss limitation**: *"An excess business loss is the amount by
  which the total deductions attributable to all of your trades or businesses exceed your
  total gross income and gains attributable to those trades or businesses plus $313,000 (or
  $626,000 in the case of a joint return). […] Business gains and losses reported on Form 4797
  and Form 8949 are included in the excess business loss calculation."*

So the loss refusal cites **§461(l)** and Form 461, and quotes the printed 2025 thresholds.

### Which of the three limitations binds, and why the message can say

i1040sf p10, **Line 36**:

> **All investment is at risk.** If all your investment amounts are at risk in this activity,
> check box 36a. If you also checked the "Yes" box on line E, your remaining loss is your
> loss. **The at-risk rules and the passive activity loss rules don't apply.** […]
> **Some investment isn't at risk.** If some investment isn't at risk, check box 36b; the
> at-risk rules apply to your loss. Be sure to attach Form 6198 to your return.

Two stored answers — printed line E (material participation) and printed line 36 (at risk) —
decide which of §465 and §469 touch the loss. The dialect carries both, and the loss refusal
reads them, so a filer at 36b is told about **Form 6198 and §465** and a filer at 36a is not.

**Printed line E answering "No" refuses BEFORE any line computes, profit or loss.** The
ground is not §469, which only limits a loss; it is **§1411**. A farming activity in which the
taxpayer does not materially participate is a passive activity, and §1411(c)(1)(A)(ii) puts
income from a passive trade or business into net investment income. `fjs/form8960` computes
printed line 4a from Schedule E line 26 alone and carries line 4b as a structural zero, so a
passive farm PROFIT would escape the 3.8% net investment income tax entirely — an
understatement, which is the direction TAX-16 exists to prevent. This is
`fjs/schedule/e/part_i`'s `selfRentalRefusal` reached by the same route: a refusal that exists
so that a neighbouring form's zero stays structural.

Consequently the loss refusal never has to name §469: every farm that reaches printed line 34
has answered "Yes" on line E.

### The independent second blocker, which holds even at 36a

A farm loss is a **negative qualified business income amount**. §199A(c)(2): *"if the net
amount of qualified business income […] for any taxable year is less than zero, such amount
shall be treated as a loss from a qualified trade or business in the succeeding taxable
year."* That carryforward is next year's Form 8995 line 3, and this engine holds one tax year.
`vnd.fjs.business_expenses`' own `priorYearQualifiedBusinessLossCarryforward` exists because
of the inbound direction of exactly this rule; the outbound direction has no home at all.

So the loss refusal names three things a filer can act on: Form 461 and §461(l) with the
printed thresholds, Form 6198 and §465 when box 36b is checked, and the §199A(c)(2)
carryforward. And it quotes the SIZE of the loss, because that is the only part of the message
a filer can check against their own arithmetic.

### Printed line 36 is therefore never reached, and printed line 35 is reserved

f1040sf line 34: *"If a profit, stop here and see instructions for where to report. If a loss,
complete line 36."* Line 36 is reached only from a loss, and a loss refuses. This is
`fjs/schedule/c` line 32 exactly — the at-risk determination that *"exists only for a loss,
which refuses"*. Printed line 35 reads *"Reserved for future use"* on the 2025 face.

---

## 4. Printed line 14 — the register serves farm property, and the 150%-DB premise is stale

The brief asked whether `fjs/form4562/macrs` handles *"a 150% declining-balance requirement
under §168(b)(2)(B) for certain farm property"*. **It does not need to, because that
requirement was repealed for the property this engine can hold.** i4562 p11, verbatim:

> For 3-, 5-, 7-, or 10-year property used in a farming business and placed in service after
> 2017, in tax years ending after 2017, the 150% declining balance method is no longer
> required. However, the 150% declining balance method will continue to apply to any 15- or
> 20-year property used in a farming business to which the straight line method does not apply
> or to property for which you elect the use of the 150% declining balance method.

TCJA §13203 struck §168(b)(2)(B). The surviving half — 15- and 20-year property — is already
enforced by `macrsClassifications`, which types `fifteenYear` and `twentyYear` with
`methods: ['150DB', 'SL']` and no `200DB` at all, on i4562 p11's *other* sentence. So the
register is **correct for farm property today with no change**, and a change to force 150% DB
on 3-, 5-, 7- and 10-year farm property would be a change that made it wrong.

Every farm recovery period the printed instructions name is representable under an existing
classification name:

| Printed farm property | i4562 page | Classification |
|---|---|---|
| New machinery or equipment used in a farming business, placed in service after 2017 | p10, 5-year | `fiveYear` |
| Used agricultural machinery and equipment placed in service after 2017, grain bins, cotton ginning assets, fences | p10, 7-year | `sevenYear` |
| Single purpose agricultural or horticultural structure (§168(i)(13)); any tree or vine bearing fruits or nuts | p10, 10-year | `tenYear` |
| Farm buildings other than single purpose agricultural or horticultural structures | p10, 20-year | `twentyYear` |

So printed line 14 is **Form 4562 line 22, on the register whose `accountNumber` matches the
farm's** — the identical binding `fjs/schedule/c` and `fjs/schedule/e/part_i` both make, and a
third verbatim call rather than a second depreciation path. A stored
`depreciationAndSection179` ENTRY refuses, for `fjs/schedule/c` line 13's reason: the figure
would be counted twice.

**Two farm-specific gaps are REPORTED rather than built**, because building either would mean
a second depreciation path:

- **ADS is not representable at all.** `fjs/form4562` carries `const line20 = 0n` with the
  comment "ADS is not representable", and two farm situations mandate it: i1040sf p6, Line 14,
  *"Electing farming business. If you made an election not to have the business interest
  expense limitation apply, any property with a recovery period of 10 years or more held by
  you must be depreciated under the alternative depreciation system"* (§163(j)(7)(C), through
  §168(g)(1)(G)); and i4562 p12, *"Property used predominantly in a farming business and
  placed in service during any tax year in which you made an election under section 263A(d)(3)
  to not have the uniform capitalization rules of section 263A apply."* Neither election is
  representable in any dialect, so neither can be detected. Both are elections a large farm
  makes, and both would make this engine's line 14 too LARGE.
- **§179 always refuses**, and the §179 election is the single most common farm depreciation
  election. That refusal is `fjs/form4562`'s own and travels out of Schedule F verbatim.

---

## 5. Printed Part I, line by line, and where Form 1099-G box 9 lands

i1040sf p3 prints the routing table for information returns, verbatim:

| Form | Where to report |
|---|---|
| 1099-PATR | Line 3a |
| 1099-A | Line 5b |
| 1099-MISC for crop insurance | Line 6a |
| 1099-G or CCC-1099-G • For disaster payments | Line 6a |
| 1099-G or CCC-1099-G • For other agricultural program payments | Line 4a |

`vnd.fjs.1099g` is the only one of those this engine holds. Its box 7 and box 9 are refused
by name today, and the box 9 remedy already points at Schedule F rather than at Schedule 1
line 8 — a correction made 2026-08-18 by the coarse-kind split, and **verified here against
the paper rather than accepted**. i1040sf p4, Lines 4a and 4b:

> Enter on line 4a the total of the government agricultural program payments that you
> received. This includes the following amounts. • Price loss coverage payments. • Agriculture
> risk coverage payments. • Market Facilitation Program payments. • **Market gain from the
> repayment of a secured Commodity Credit Corporation (CCC) loan for less than the original
> loan amount.** […] These amounts are usually reported to you on Form 1099-G.

So the correction is right: box 9 is printed line 4a, not Schedule 1 line 8. **Both boxes
become readable in this phase.**

Line 4b is NOT line 4a, and the difference is one stored election:

> On line 4b, report only the taxable amount. For example, don't report the market gain shown
> on Form CCC-1099-G on line 4b **if you elected to report CCC loan proceeds as income in the
> year received** […] However, if you didn't report the CCC loan proceeds under the election,
> you must report the market gain on line 4b.

The election is a standing status under §77, not a fact about this year's amounts — it may
have been made in a prior year. So the dialect carries
`commodityCreditCorporationLoanProceedsReportedAsIncomeUnderElection` as a DOC-12 checkbox
(`option(true)`), and **absence is the safe reading**: no election means the market gain IS
taxable on line 4b, which is the higher-tax direction. That is precisely the test DOC-12's
convention has to pass, and `grossReceiptsFullyReportedOnForms1099Nec` passes it the same way.

`line4b = line4a - (election ? marketGain : 0)`.

### The complete Part I mapping

| Printed | Source | Note |
|---|---|---|
| 1a | `salesOfPurchasedLivestockAndOtherResaleItems` | |
| 1b | `costOrOtherBasisOfPurchasedItems` | |
| 1c | 1a − 1b | may be NEGATIVE; the printed line has no floor |
| 2 | `salesOfRaisedProductsAndLivestock` | includes crop-share rents where the filer materially participated (i1040sf p3) |
| 3a / 3b | `cooperativeDistributions` / `cooperativeDistributionsTaxableAmount` | Form 1099-PATR, no dialect; both transcribed, 3b ≤ 3a enforced |
| 4a | Σ `vnd.fjs.1099g` box 7 + Σ box 9 + `agriculturalProgramPaymentsNotReportedOnForm1099G` | |
| 4b | 4a − market gain under election | see above |
| 5a | `commodityCreditCorporationLoansReportedUnderElection` | present ⇒ the election flag must be too |
| 5b / 5c | `commodityCreditCorporationLoansForfeited` / `…TaxableAmount` | 5c ≤ 5b enforced |
| 6a / 6b | `cropInsuranceProceedsReceived` / `…TaxableAmount` | 6b ≤ 6a enforced |
| 6c | `electionToDeferCropInsuranceProceeds` | **REFUSES when present** |
| 6d | `cropInsuranceProceedsDeferredFromPriorYear` | **absence REFUSES**; `'0.00'` is the assertion |
| 7 | `customHireIncome` | |
| 8 | `otherIncome` | |
| 9 | 1c + 2 + 3b + 4b + 5a + 5c + 6b + 6d + 7 + 8 | ten summands, hand-counted off the printed line |

**Line 6c refuses** because the deferral moves an amount into a tax year this engine does not
hold, and because i1040sf p4 makes it all-or-nothing per trade or business: *"If you elect to
defer any eligible crop insurance proceeds, you must defer all such crop insurance proceeds
(including federal crop disaster payments) from a single trade or business."* Line 6b would
then have to be the taxpayer's own partition of line 6a, and a partition this engine cannot
check is a partition it should not silently accept when the printed line says an election and
a statement are attached.

**Line 6d's absence refuses** because the direction is the dangerous one. An amount deferred
from 2024 into 2025 is income *this* year; reading its absence as zero would UNDERSTATE
income. This is `grossReceiptsFullyReportedOnForms1099Nec`'s shape, with a money string rather
than a checkbox for `priorYearQualifiedBusinessLossCarryforward`'s reason: `'0.00'` is the
assertion "I deferred nothing from 2024", and it is a different statement from silence.

### What Part I does NOT model, and the direction of each omission

- **§126 excludable cost-share payments.** Line 4a includes *"Cost-share payments (sight
  drafts)"* and *"Payments in the form of materials (such as fertilizer or lime) or services"*.
  §126 excludes the *excludable portion* of certain conservation cost-share payments, which
  Reg. §16A.126-1 figures as a present value no document here carries. Taxing the whole of
  line 4a can only OVERSTATE tax, which is `fjs/schedule/c` line 2's documented-zero
  direction, and it is recorded rather than approximated.
- **§6654(i)'s two-thirds farming test.** A farmer whose gross farming income is at least
  two-thirds of gross income has a different estimated-tax deadline. Nothing on this form is
  affected; `fjs/schedule/e` line 42 already carries the reconciliation as a documented zero.

---

## 6. Printed Part II, line by line

Twenty-five printed expense lines, hand-counted off the face: 10 through 32, with 21a/21b and
24a/24b each counting as two. The vocabulary lives in `fjs/schedule/f`, not on the dialect,
for the reason `vnd.fjs.business_expenses` gives about `category` being a free string.

| Printed | Category | Verdict |
|---|---|---|
| 10 | `carAndTruck` | **REFUSES** — i1040sf p6: *"If you claim any car or truck expenses (actual or the standard mileage rate), you must provide the information requested on Form 4562, Part V."* `fjs/form4562` Part V refuses (§274(d), §280F). Schedule C line 9 and Schedule E Part I line 6 give the same answer |
| 11 | `chemicals` | computes |
| 12 | `conservationExpenses` | **REFUSES** — §175, i1040sf p6: *"Your deduction can't exceed 25% of your gross income from farming (excluding certain gains from selling assets such as farm machinery and land). […] the excess can be carried forward and deducted in later tax years."* The base excludes Form 4797 gains this engine does not hold, and the excess is a carryforward into a year it does not hold |
| 13 | `customHire` | computes |
| 14 | `depreciationAndSection179` | **REFUSES as a stored ENTRY**; the printed line is COMPUTED from `vnd.fjs.asset_register` |
| 15 | `employeeBenefitPrograms` | computes |
| 16 | `feed` | computes |
| 17 | `fertilizersAndLime` | computes |
| 18 | `freightAndTrucking` | computes |
| 19 | `gasolineFuelAndOil` | computes |
| 20 | `insuranceOtherThanHealth` | computes |
| 21a | `mortgageInterest` | computes |
| 21b | `otherInterest` | computes |
| 22 | `laborHired` | computes |
| 23 | `pensionAndProfitSharingPlans` | **REFUSES** — i1040sf p7: *"If the plan included you as a self-employed person, enter contributions made as an employer on your behalf on Schedule 1 (Form 1040), line 16, not on Schedule F."* Nothing here distinguishes an employee's contribution from the proprietor's. Schedule C line 19's answer, unchanged |
| 24a | `rentOrLeaseVehiclesMachineryEquipment` | computes |
| 24b | `rentOrLeaseOtherBusinessProperty` | computes |
| 25 | `repairsAndMaintenance` | computes |
| 26 | `seedsAndPlants` | computes |
| 27 | `storageAndWarehousing` | computes |
| 28 | `supplies` | computes |
| 29 | `taxes` | computes |
| 30 | `utilities` | computes |
| 31 | `veterinaryBreedingAndMedicine` | computes |
| 32 | `otherExpenses` | computes; the printed 32a-32f write-in block, totalled as one |

Twenty-one compute, four refuse.

**Printed line 32f cannot go negative here, and that is a refusal one layer down.** i1040sf p5:
*"enter the total amount capitalized in parentheses on line 32f (to indicate a negative
amount) and enter '263A' in the space to the left of the total."* `vnd.fjs.farm` refuses a
negative `amount`, quoting it — `vnd.fjs.business_expenses`' own rule, adopted unchanged — so
a filer capitalizing preproductive-period expenses under §263A is refused at the document with
the amount named. Printed line 33 is therefore a plain sum of lines 10 through 32f.

---

## 7. What this phase wires, and in what order

**"Wire before reclassify."** `farmIncomeOrLoss` moves from `unmodeledKindRefusals` to
`modeledKinds` only after every printed destination of line 34 is fed.

| Destination | Printed instruction | Wiring |
|---|---|---|
| Schedule 1 line 6 | i1040sf p9: *"Enter your net profit or loss on line 34 and on Schedule 1 (Form 1040), line 6"* | `fjs/schedule/1` `scheduleOnePartI`, replacing a `profileDeclaredZeroLine` |
| Schedule SE line 1a | i1040sf p9: *"and; Schedule SE (Form 1040), line 1a"* | `fjs/schedule/se` `scheduleSelfEmploymentPartI`, replacing `const line1a = 0n` |
| Form 8995 line 1(i) | §199A(c)(1); a farming business is a qualified trade or business | `fjs/form1040/core`'s `qualifiedBusinessIncomeDeduction` call |
| Schedule EIC / Worksheet B | §32(c)(2)(A)(ii) | automatic: `earnedIncomeCreditEarnedIncome` is `line1z + scheduleSeLine3 - scheduleSeLine13`, and line 3 now carries line 1a |

**Schedule SE line 1b stays a documented zero, and the direction is stated.** i1040sf p9:
*"Conservation Reserve Program (CRP) payments. If you received social security retirement or
disability benefits in addition to CRP payments, the CRP payments aren't subject to
self-employment tax."* Identifying CRP payments inside line 4b needs a fact no document
carries, and the omission can only OVERSTATE self-employment tax — `fjs/schedule/c` line 2's
documented-zero direction, named rather than hidden.

**Form 8960 needs no change, and the reason is the line E refusal.** A farm that reaches line
34 materially participated, so it is not a passive activity and §1411(c)(1)(A)(ii) does not
reach it; printed Form 8960 line 4a stays what Schedule E line 26 makes it.

### A `vnd.fjs.farm` beside a `vnd.fjs.business_expenses` REFUSES

Both are qualified trades or businesses, and two of them together cannot be carried through
§199A by this engine: Form 8995-A's W-2 wage and unadjusted-basis limitations are figured PER
BUSINESS (printed Schedule A of Form 8995-A has three columns), and `fjs/form1040/core` reads
one business record's `w2Wages` and `unadjustedBasisOfQualifiedProperty`. Applying one
business's wages to two businesses' profit is not an approximation, it is a different return —
`fjs/schedule/c`'s own argument about merging two businesses into one Schedule C, one level
up. §461(l) aggregates the same way.

So `fjs/schedule/f` refuses, quoting both `principalCropOrActivity` and `principalBusiness`.
The consequence is that at most one of the two schedules is ever filed, which is what makes
the §199A wiring a one-line sum.

### The eleventh tripwire

A stored `vnd.fjs.farm` with non-zero farm income proves farming, so `fjs/return/tripwire`
requires `farmIncomeOrLoss` to have been declared. This is the rule the tenth tripwire's own
docstring states: *"a dialect a filer can store before anything checks that the return declares
it is a dialect that can go unread."* `expectedTripwireCount` moves 10 → 11, and
`modeledKindDeclarationRemedies` gains a third entry.

### Registry movements

| File | Constant | Before | After |
|---|---|---|---|
| `fjs/media/dialects` | `expectedDialectCount` | 31 | 32 |
| `fjs/server/finance_schema` | `expectedKnownDialectCount` | 29 | 30 |
| `fjs/report/tax_return` | `expectedDispatchedDialectCount` | 28 | 29 |
| `fjs/return/scope` | `expectedModeledKindCount` | 54 | 55 |
| `fjs/return/scope` | `expectedUnmodeledKindCount` | 143 | 142 |
| `fjs/return/tripwire` | `expectedTripwireCount` | 10 | 11 |

The vocabulary total (197) does not move: one kind crosses the partition.

**The refused row reads `143 -> 142`, not the `141 -> 140` this spec was written against**, and
the difference is the whole of what rebasing this work cost. Form 6781 (TAX-38) landed on the
same table from a branch cut at the same commit, ADDING two §1256 rows and reclassifying nobody
— so the two compose as `141 + 2 - 1` and the vocabulary keeps Form 6781's 197. Every other row
of this table is untouched by that, because Form 6781 moved no dialect and no tripwire. Four
leaves that spell a count in their names had to be renamed with the constants:
`modeledKindsIsExactlyFiftyFive`, `unmodeledRefusalsIsExactlyOneHundredAndFortyTwo`,
`theTableIsExactlyElevenDistinctTripwires` and
`sourceAndTwinDispatchOnTheSameTwentyNineDialects`. (The first two were renamed TWICE more —
by Form 4797 (TAX-41) to `…FiftySix`/`…OneHundredAndFortyOne`, and by Form 2555 (TAX-42), which
had independently reached `…FiftySix`/`…OneHundredAndFortyFive` from the same starting point, so
the integration of the two composed them to `modeledKindsIsExactlyFiftySeven` and
`unmodeledRefusalsIsExactlyOneHundredAndFortyFour`. The names above are what this phase left
behind, and grepping for them today finds nothing but this line. **A leaf whose name spells a
count is a name that goes stale every time the count moves** — which is now the fifth rename in
four phases, and the third caused by nothing but two branches meeting.)

---

## 8. Which kinds are reclassified, and which are not

- **`farmIncomeOrLoss` — RECLASSIFIED.** Schedule F line 34 reaches Schedule 1 line 6.
- **`netFarmRentalIncomeForm4835` — STAYS REFUSED, and the remedy is verified rather than
  rewritten.** It reads: *"requires Form 4835, which a landowner uses for crop-share rents
  received without materially participating — and materially participating instead moves the
  whole activity to Schedule F, which `farmIncomeOrLoss` already refuses. Neither form is
  modeled (no phase yet)."* i1040sf p2 confirms both halves: *"Form 4835 to report rental
  income based on crop or livestock shares produced by a tenant if you didn't materially
  participate in the management or operation of a farm. This income isn't subject to
  self-employment tax."* Form 4835 is a **different printed form** with its own face; it is
  not Schedule F under another name. The remedy's second clause is now false — Schedule F is
  modeled — so it is corrected, and the row stays refused. This is the
  `selfEmployedHealthInsuranceDeduction` correction's shape exactly.
- **`farmIncomeAveragingScheduleJ` — STAYS REFUSED.** Schedule J averages farm income over the
  three preceding years; i1040sf p2 names it as a separate form. Three prior years is three
  more than this engine holds.

---

## 9. The proof plan

Every expected value below is HAND-TYPED in integer cents off the printed page. Nothing is
read back from the module under test.

### The worked cash-method case

```
  1a  sales of purchased livestock                     18,400.00
  1b  cost or other basis                              14,250.00
  1c  18,400.00 - 14,250.00                             4,150.00
  2   sales of raised products                        142,600.00
  3b  cooperative distributions, taxable                2,310.00
  4b  agricultural program payments, taxable            9,750.00
  5a  CCC loans under election                              0.00
  5c  CCC loans forfeited, taxable                          0.00
  6b  crop insurance proceeds, taxable                  11,400.00
  6d  deferred from 2024                                     0.00
  7   custom hire income                                 6,800.00
  8   other income                                       1,225.00
  9   gross income                                     178,235.00
```

```
 11  chemicals                                          8,400.00
 16  feed                                              31,250.00
 17  fertilizers and lime                              22,900.00
 21a mortgage interest                                 14,600.00
 22  labor hired                                       26,500.00
 25  repairs and maintenance                            9,375.50
 26  seeds and plants                                  17,200.00
 29  taxes                                              4,180.00
 30  utilities                                          6,240.00
 31  veterinary, breeding, and medicine                 3,890.00
 33  total expenses                                   144,535.50
 34  178,235.00 - 144,535.50                           33,699.50
```

### The controls each refusal needs

| Refusal | Control |
|---|---|
| accrual | the identical document at `cash` computes |
| line E = "no" | the identical document at `"yes"` computes |
| line 34 loss | the identical farm one cent the other side of break-even computes, and break-even ZERO computes |
| line 6c deferral election | the identical document without the flag computes |
| line 6d unstated | `'0.00'` computes |
| second `vnd.fjs.farm` | two farms with different `accountNumber`s is the refusal; ONE computes |
| `vnd.fjs.business_expenses` beside a farm | either alone computes |
| unknown category | every one of the twenty-one computed categories is accepted |
| each of the four refused categories | the other twenty are accepted |
| the CCC election | with and without it, line 4b differs by exactly the market gain |

### The wirings, proven where the wiring lives

A schedule-level proof cannot prove a wiring. So:

- `fjs/schedule/1` — printed line 6 carries line 34, and printed line 10 moves by it.
- `fjs/schedule/se` — printed line 1a carries line 34, and printed line 12 moves by it.
- `fjs/form1040/core` — a farm profit reaches 1040 line 8, Schedule 2 line 4 and 1040 line
  13a, and the §199A deduction MOVES rather than only the income line.
- `fjs/report/tax_return` — a stored `vnd.fjs.farm` blob routes, in both the source and the
  guest-source twin.
- `fjs/return/tripwire` — an undeclared farm refuses; a declared one does not.
- `fjs/document/1099g` — box 7 and box 9 no longer refuse at the document, and they reach
  printed line 4a with provenance.

---

## 10. The mutation log

**A proof is not known to work until you have watched it fail.** Thirty-nine mutations were
written down, applied one at a time against a committed tree, run through `npm test`, and
reverted. Each was checked with `git diff --numstat` for exactly one insertion and one deletion
(or `0/1` where the mutation is a deletion), so no mutation edited its own expectation.

Baseline: **2,944 pass / 0 fail** — the figure on the branch as written, before it was rebased
onto Form 6781, Form 8829 and the reverse-traceability gate. After the rebase the baseline is
**3,046 pass / 0 fail** (3,001 project-local), and the seventeen count mutations were re-run
against it; see "After the rebase" at the end of this section.

### `fjs/schedule/f`

| # | Mutation | Compiled? | Leaves reddened |
|---|---|---|---|
| M01 | drop `line4b` from printed line 9's ten summands | ✔ | 2 |
| M02 | drop `line6d` from printed line 9's summands | ✔ | 1 |
| M03 | printed line 1c: `line1a - line1b` → `line1a + line1b` | ✔ | 1 |
| M04 | printed line 4b: swap the §77 election's arms | ✔ | 1 |
| M05 | printed line 34's loss guard `< 0n` → `< -1n` | ✔ | 3 |
| M06 | printed line E: `=== 'no'` → a value nothing stores | ✔ | 1 |
| M07 | printed line C: `=== 'accrual'` → a value nothing stores | ✔ | 1 |
| M08 | **REORDER** printed line 33's summands | ✔ | **0 — EQUIVALENT MUTANT** |
| M08c | **DELETE** `line14` from printed line 33's sum | ✔ | 2 |
| M09 | the orphan-1099-G guard: `=== 0n` → `>= 0n` (never fires) | ✔ | 1 |
| M10 | drop box 9 from printed line 4a's summed boxes | ✔ | 1 |
| M11 | route the conservation refusal to the car-and-truck message | ✔ | 1 |
| M12 | erase `${centsToString(-lossCents)}` from the loss refusal | ✔ | 2 |
| M13 | `farmingIsNotASpecifiedServiceTradeOrBusiness` → `'specifiedService'` | ✔ | 1 |
| M14 | drop `storageAndWarehousing` from `farmExpenseLines` | ✔ | **20** |
| M15 | printed box 36: `=== 'someNotAtRisk'` → `=== 'allAtRisk'` | ✔ | 2 |
| M16 | printed line 6d: default the unstated value to `'0.00'` | ✔ | 1 |
| M17 | printed line 6c: invert the deferral-election guard | ✔ | **22** |
| M18 | the farm-beside-a-business guard, made unreachable | ✔ | 1 |
| M32 | printed line 34's `unionSources([line9, line33])` → `([line9])` | ✔ | 1 |
| M33 | erase `${farmLabel(farm)}` from the accrual refusal | ✔ | 1 |
| M34 | erase `${amount}` from the car-and-truck refusal | ✔ | 1 |
| M37 | drop `pensionAndProfitSharingPlans` from `refusedCategories` | ✔ | 3 |
| M38 | printed line 4b: read the §77 flag as its own negation | ✔ | 1 |
| M39 | printed line 14's register match: `===` → `!==` | ✔ | 5 |

**M08 is the one that came back green, and it is an equivalent mutant by construction.**
`totalLine` reduces its summands with `+`, and addition is commutative, so reordering them cannot
turn red at any input — AGENTS.md's "a mutation a neighbouring operation absorbs", where the
neighbour is the reducer itself. It is recorded at the site rather than worked around, and the
mutation that DOES bite was re-run as **M08c**. `unionSources` is genuinely order-dependent, but
no leaf asserts source ORDER on purpose: asserting it would be asserting an accident of union
order, which `fjs/schedule/c` already says at its own site.

**M14 and M17 are the two that redden twenty leaves apiece**, and the reason is worth stating: a
row dropped from the expense vocabulary and an inverted printed-line-6c guard both make the BASE
fixture refuse, so every leaf downstream of it goes with them. A mutation reddening everything
proves less than one reddening exactly the predicted set — these two are the least informative
reds in the table, and they are here because the alternative is not running them.

### `vnd.fjs.farm`

| # | Mutation | Compiled? | Leaves reddened |
|---|---|---|---|
| M19 | the taxable-amount ≤ gross check, slackened by $1.00 | ✔ | 1 |
| M20 | the §77 cross-check, inverted | ✔ | 3 |
| M21 | the negative-money check, slackened by $1.00 | ✔ | 1 |
| M36 | drop `w2Wages` from `moneyFieldsOf` | ✔ | 2 |

M36 is the hand-typed-count idiom doing exactly what it exists for: the loop that iterates
`moneyFieldsOf` would happily have run one iteration fewer, and
`theMoneyFieldTablesAreTheSizeTheyWereCountedAt` is what noticed.

### The wirings

| # | Mutation | Compiled? | Leaves reddened |
|---|---|---|---|
| M22 | `fjs/schedule/1` printed line 6 forced to `0n` | ✔ | 3 |
| M23 | `fjs/schedule/se` printed line 1a forced to zero | ✔ | 2 |
| M24 | `fjs/form1040/core` drops the farm from §199A's net profit | ✔ | 1 |
| M25 | `fjs/form1040/core` drops the farm's Form 6251 line 2l adjustment | ✔ | 1 |
| M26 | `fjs/report/tax_return` deletes the typed `vnd.fjs.farm` route branch | ✔ | 1 |
| M27 | `fjs/report/tax_return` deletes the GUEST TWIN's route line | ✔ | 1 |
| M28 | `fjs/schedule/c` stops recognising a farm's asset register | ✔ | 1 |
| M29 | `fjs/return/tripwire` drops `customHireIncome` from the predicate | ✔ | 1 |
| M31 | `fjs/form1040/core` drops line 13a from 1040 line 14 | ✔ | 4 |

M27 is the one that had to be run rather than assumed. `fjs/report/tax_return` carries the route
table TWICE — once as typed code and once as the literal program text a guest executes — and the
module's own docstring records fifteen dialects whose twin route line could be deleted with 2,572
proofs green. `vnd.fjs.farm` is not one of them.

### The two mutations that DID NOT COMPILE, which is the stronger result

| # | Mutation | Compiler said |
|---|---|---|
| M30 | remove `farmIncomeOrLoss` from `modeledKinds` | `TS2344: Type 'false' does not satisfy the constraint 'true'` — **twice**, at `_EveryKindIsEitherModeledOrRefused` and `_EveryDeclarationRequiredKindIsModeled` |
| M30b | remove its `modeledKindDeclarationRemedies` entry | `fjs/return/tripwire: TS2322: Type '"farmIncomeOrLoss"' is not assignable to type 'RefusableKind'` |

The reclassification is enforced by the type system in **both** directions, and neither gate is a
proof that could be deleted. Undoing it halfway stops the build; undoing it wholly stops the build
twice. AGENTS.md asks for a compiling re-run of a mutation that fails this way, and here there is
none to run: the property is a `tsc` property, not a runtime one, and the runtime half is already
covered by `theSplitReclassifiedNothing` and
`theScheduleOnePartOneKindsNoPhaseHasWiredStillRefuse`.

### Survivors

**One, and it is an equivalent mutant** (M08, above), re-run in a form that bites as M08c. No
mutation survived that named a real gap.

### After the rebase: the seventeen counts, re-mutated

The campaign above ran on a tree cut at `73e9832`. Rebasing onto `fa590ff` moved four of the
counts it asserted, so every count constant in the merged partition was re-measured live (imported
and read off `.length`, never transcribed from either branch) and then mutated one at a time,
`git diff --numstat` checked for `1/1` each time. Baseline **3,046 pass / 0 fail**.

| # | Constant, mutated | Compiled? | Leaves reddened |
|---|---|---|---|
| R01 | `expectedModeledKindCount` 55 → 54 | ✔ | 3 |
| R02 | `expectedUnmodeledKindCount` 142 → 141 | ✔ | 2 |
| R03 | `theSplitReclassifiedNothing`'s literal 55 → 54 | ✔ | 1 |
| R04 | the `amt*` vocabulary filter 21 → 20 | ✔ | 1 |
| R05 | the Schedule 1 Part I `stillRefused` length 33 → 34 | ✔ | 1 |
| R06 | `expectedDeclarationRequiredCount` 9 → 8 | ✔ | 1 |
| R07 | `expectedKindCount` 197 → 196 | ✔ | 1 |
| R08 | `expectedTripwireCount` 11 → 10 | ✔ | 1 |
| R09 | `noTaxpayerAmountRidesOut…`'s fired count 10 → 9 | ✔ | 1 |
| R10 | `fjs/media/dialects` `expectedDialectCount` 32 → 31 | ✔ | 1 |
| R11 | `expectedKnownDialectCount` 30 → 29 | ✔ | 1 |
| R12 | `expectedDispatchedDialectCount` 29 → 28 | ✔ | 1 |
| R13 | `expectedMoneyFieldCount` 142 → 141 | ✔ | 1 |
| R14 | `expectedDroppedCount` 32 → 31 | ✔ | 1 |
| R15 | the unread registry's `expectedDialectCount` 16 → 15 | ✔ | 1 |
| R16 | remove `farmIncomeOrLoss` from `modeledKinds` | ✘ | `TS2344` **twice**, reproducing M30 exactly |
| R17 | remove it from `everyModeledKindHandTyped` | ✔ | 2 |

Nothing survived. **R09 is the one the rebase itself created**, and it is the finding worth
keeping: both branches independently moved that leaf from eight fired tripwires to nine — Form
6781's 1099-B box 11 disjunct and this branch's farm entry fire on different documents and name
different kinds — so git merged two identical `8 -> 9` edits into one and the true merged figure
is **ten**. A count that agrees with both parents and is wrong is exactly the shape AGENTS.md's
"a clean merge with a green suite can still have dropped coverage" describes, one level up.

### The gap the campaign found before it started

`fjs/schedule/c`'s orphan-asset-register refusal — *"NOTHING on this return claims it"* — fired on
a farmer's register and refused the whole return, because its message enumerated two printed lines
and there were now three. It was found by `theFarmRegisterReachesFormSixtyTwoFiftyOneLineTwoL`
failing on its first run, which is a check written a phase earlier doing precisely what it was
written for.
