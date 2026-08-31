# The stored-but-unread field sweep

Status: **inventory complete; three wirings implemented, the rest reported.**

Four instances of one defect — a money box a dialect STORES, validates for exactness, and no
computation ever reads — were each found by accident while doing something else:
`box2EarlyWithdrawalPenalty` and `box6ForeignTaxPaid` on `vnd.fjs.1099int`,
`box10DependentCareBenefits` and `box11NonqualifiedPlans` on `vnd.fjs.w2`. Four accidental finds
means nobody had swept for the shape deliberately. This file is that sweep.

## Baseline

`feature/tier-b-forms` @ `045fb6b`.

```
npm test 2>&1 | grep -E '^ℹ (tests|pass|fail)'   # 2861 / 2861 / 0
npm test 2>&1 | grep -c '^✔ import("./fjs/'      # 2823  project-local leaves
```

## Method, and why grep alone is not the answer

Every field of every schema under `fjs/document/`, `fjs/run/` and `fjs/return/profile/` was
enumerated mechanically (top-level schemas AND nested entry schemas), then each name was searched
across every `.f.js` outside its own declaring module, with comment lines separated from code
lines. That yields **candidates**, never an answer, and three separate blind spots had to be
closed by hand:

1. **A read through a rename.** `vnd.fjs.asset_register`'s `section179ElectedCost` has zero
   external mentions of that name — because `depreciableAssets` renames it to
   `section179ElectedCostCents` before `fjs/form4562` reads it. Not a defect.
2. **A name declared on two dialects, read on one.** `stateTaxWithheld` is declared on
   `vnd.fjs.1099b`, `vnd.fjs.1099div` AND `vnd.fjs.1099r`. `fjs/schedule/a` reads it — off the
   1099-R forms only. The other two are unread and the name-level search cannot see it.
3. **A field whose only reader is its own dialect's exactness loop.** Membership in a
   `moneyBoxFields` tuple is what made all four known cases invisible: the box IS mentioned, in
   the module that stores it, by the loop that checks its decimal is canonical. That is not a
   read.

## Category (a) — wiring available now, wired here

Each was confirmed against the printed instruction, fetched and read, not recalled.

| Box | Printed destination | Source |
|---|---|---|
| `vnd.fjs.1099div` `box12ExemptInterestDividends` | 1040 line 2a | i1040 (2025) p.25 |
| `vnd.fjs.1099div` `box13SpecifiedPrivateActivityBondInterestDividends` | Form 6251 line 2g | i6251, Line 2g |
| `vnd.fjs.ssa1099` `box6VoluntaryFederalIncomeTaxWithheld` | 1040 line 25b | i1040 (2025) p.39 |

The three quotations, verbatim:

- **i1040 (2025) p.25, "Line 2a — Tax-Exempt Interest":** *"Also include on line 2a any
  exempt-interest dividends from a mutual fund or other regulated investment company. This amount
  should be shown in box 12 of Form 1099-DIV."*
- **i6251, "Line 2g":** *"Exempt-interest dividends paid by a mutual fund or other regulated
  investment company are treated as interest income on specified private activity bonds to the
  extent the dividends are attributable to interest on the bonds received by the company, minus an
  allocable share of the expenses paid or incurred by the company in earning the interest. This
  specified private activity bond interest dividends amount should be reported to you in box 13 of
  Form 1099-DIV."*
- **i1040 (2025) p.39, "Line 25b — Form(s) 1099":** *"If you received a 2025 Form 1099 showing
  federal income tax withheld on dividends, taxable or tax-exempt interest income, unemployment
  compensation, social security benefits, railroad retirement benefits, or other income you
  received, include the amount withheld in the total on line 25b. This should be shown in box 4 of
  Form 1099, box 6 of Form SSA-1099, or box 10 of Form RRB-1099."*

**Boxes 12 and 13 are the 1099-DIV's box 8 and box 9.** The printed recipient instruction for box
13 is *"Shows exempt-interest dividends subject to the alternative minimum tax. **This amount is
included in box 12.**"* — word for word the subset relationship `vnd.fjs.1099int` already states
between its own boxes 9 and 8. So box 13 joins Form 6251 line 2g and joins NOTHING in the regular
tax; adding it to line 2a a second time would count the same interest twice. `fjs/form1040/core`
is where that is asserted rather than intended, because it is the one module where line 2a and the
line 2g feed are both visible — the identical arrangement box 9 already has.

**No kind is reclassified by any of the three**, and that is a property of the wiring rather than
an omission: `taxExemptInterest`, `amtPrivateActivityBondInterest` and
`federalTaxWithheldOnOther1099` are all already MODELED in `fjs/return/scope`. Each of the three
boxes is a SECOND SOURCE for a line the engine already computes, which is exactly what made it
invisible — the line was never zero, so nothing looked wrong.

### Error direction of each, before the wiring

- **Box 12 → line 2a: understatement of tax.** Line 2a is not itself taxed, but §86(b)(2)(B) adds
  it to the provisional income that decides how much of a Social Security benefit is taxable, and
  it is part of Form 8962's household income. A retiree holding a municipal bond FUND — far
  commoner than holding the bonds directly, which is the only case the engine handled — had both
  understated.
- **Box 13 → Form 6251 line 2g: understatement of the alternative minimum tax.**
- **Box 6 → line 25b: overstatement of tax.** Withholding the taxpayer has already paid was not
  credited. This is the safe direction, and it is still money.

## Category (a) found and NOT wired

- **`fjs/schedule/a`'s SALT floor reads two of the six state/local withholding fields the engine
  stores.** `assertAssertedSaltIncomeTaxIsAtLeastStoredWithholding` compares the taxpayer's
  asserted Schedule A line 5a against `vnd.fjs.w2`'s `stateIncomeTax` and `vnd.fjs.1099r`'s
  `stateTaxWithheld`. It does not read `vnd.fjs.w2`'s `localIncomeTax`, `vnd.fjs.1099r`'s
  `localTaxWithheld`, `vnd.fjs.1099g`'s `stateIncomeTaxWithheld`, `vnd.fjs.1099nec`'s
  `box5StateTaxWithheld`, or `vnd.fjs.1099b`/`vnd.fjs.1099div`'s `stateTaxWithheld` — all six of
  which are line 5a items the taxpayer demonstrably paid. This is a REFUSAL that is weaker than it
  looks, not a printed line that is wrong, so the error direction is overstatement of tax (an
  understated line 5a is let through). Left unwired because widening it changes a refusal's
  trigger, and a refusal's blast radius is the whole return.

## Category (b) — blocked, with the blocker named

- ~~`vnd.fjs.1099b` `box8ProfitOrLossRealized`, `box9UnrealizedProfitOrLossPriorYearEnd`,
  `box10UnrealizedProfitOrLossCurrentYearEnd`, `box11AggregateProfitOrLoss` — the §1256
  regulated-futures block. Destination is **Form 6781**, which does not exist here, and thence
  Schedule D lines 4 and 11 under the 60/40 split. Direction: either, by sign.~~
  **CLOSED (TAX-38).** `fjs/form6781` exists; see
  [`fjs/form6781/todo/section-1256-contracts-marked-to-market.md`](../form6781/todo/section-1256-contracts-marked-to-market.md).
  Box 11 is `read` — Form 6781 line 1 -> line 7 -> lines 8 and 9 -> Schedule D lines 4 and 11.
  Boxes 8, 9 and 10 are `refused`: their only reader is the cross-check `box 8 − box 9 + box 10
  === box 11`, which refuses the document by name on a disagreement.

  **Two of this entry's own claims were wrong, and both were wrong in the direction of making
  the work look harder than it was.** Box 9 was filed under the same "prior year" heading this
  repo uses for a genuine architectural blocker, but it is printed on THIS year's 1099-B and is
  transcribed, never remembered. And the block was described as needing a form "which does not
  exist here" as though the form were the obstacle — the obstacle was one number, and the
  printed instruction hands it over: *"include on line 1 the amount from box 11 of each form."*
  Worth keeping visible: a blocker written down once is read as settled, and this one priced
  four boxes as unreachable for as long as nobody re-read the paper.
- `vnd.fjs.1099b` `box13Bartering` — Schedule C or Schedule 1 line 8z, and nothing stored says
  which. Direction: understatement.
- `vnd.fjs.1099div` `box3NondividendDistributions`, `box9CashLiquidationDistributions`,
  `box10NoncashLiquidationDistributions` — each needs the taxpayer's BASIS in the stock, which no
  dialect stores. Printed instruction for box 3: *"To the extent of your cost (or other basis) in
  the stock, the distribution reduces your basis and is not taxable. Any amount received in excess
  of your basis is taxable to you as capital gain."* Direction: understatement, in the excess case
  only.
- `vnd.fjs.1099r` `box5EmployeeContribOrInsurancePremiums`, `box9bTotalEmployeeContrib`,
  `box8bPercentageOfAnnuityContract`, `box9aPercentageOfTotalDistribution` — the Simplified Method
  inputs. Only needed when box 2a is absent or box 2b *taxable amount not determined* is ticked,
  which is a case the engine does not compute. Direction: understatement.
- `vnd.fjs.1099r` `box6NuaInEmployerSecurities`, `box7dEarningsOnExcessContrib`, `box8aOther`,
  `box10AmountAllocableToIrrWithin5Years`, `box11FirstYearOfDesigRothContrib` — each needs a rule
  the engine does not have (NUA deferral, §402(g) corrective distributions, the five-year Roth
  clock).
- ~~`vnd.fjs.credits` `overAgeTwelveAndDisabled`~~ — **CLOSED. Wired, and the row above it was
  wrong twice.** Retained in full because a report that was half right is more useful to the next
  reader than a deleted one. What it said:

  > The blocker is not this field, it is the qualifying person's AGE, which `vnd.fjs.credits` does
  > not store. Absence of the checkbox is ambiguous: it means either "under 13" (qualifying) or
  > "over 12 and not disabled" (NOT qualifying), and only a date of birth separates them. Today
  > `dependentCareCommonFacts` counts every listed person as qualifying. Direction: understatement
  > of tax — an over-12, non-disabled person inflates both the §21 credit and the §129 exclusion.

  Both italicised claims are false against the printed page, and each was refuted by a sentence
  the sweep did not fetch:

  1. **Absence is NOT ambiguous on the form.** i2441 (2025), Part II, Line 2, Column (c), third
     sentence: *"A person over age 12 at the time the care was provided must be physically or
     mentally incapable of caring for themselves to be listed on line 2."* Under the CAUTION
     printed directly above it — *"Don't list a person on line 2 unless they are listed as an
     eligible person under Qualifying Person(s), earlier."* — the over-12, non-disabled person may
     not appear on line 2 at all, so an unchecked box on a correctly prepared **paper** Form 2441
     can only mean "under 13". A date of birth is not what settles it and would not have settled
     it: column (c)'s test is *"at the time the care was provided"*, and the printed form carries
     no care date to compare a birthday against — i2441's own *"If the child turned 13 during the
     year, the child is a qualifying person for the part of the year they were under age 13"* is
     exactly the case a stored date of birth still cannot answer.
  2. **The §129 exclusion is not affected at all, let alone independently.** f2441 prints
     *"To claim the child and dependent care credit, complete lines 27 through 31 below."*
     between line 26 and line 27. Line 26 — the taxable benefits reaching 1040 line 1e — is built
     from lines 20-25, whose only ceiling is line 21's flat $5,000/$2,500. The qualifying person
     count first appears at line 27, on the credit's side of that caption.

  **The understatement was real anyway, for the reason the report reached past.** The ambiguity is
  a property of the RECORD, not of the form: `vnd.fjs.credits` *"is not a transcribed IRS form"*
  (its own header's first sentence), so nothing between the taxpayer's care receipts and
  `fjs/form2441` had ever applied that caution, and an absent `overAgeTwelveAndDisabled` carried
  "under 13", "over 12 and not disabled" and "nobody asked" at once. `dependentCareCommonFacts`
  granted a qualifying person in all three. The fix is the shape this dialect already uses for
  `filerAttainedAgeTwentyFourBeforeTheEndOfTheYear` and `saversCreditEligibility`: a second
  `or(option, true)`, `underAgeThirteenWhenTheCareWasProvided`, so each of §21(b)(1)'s two populations
  is assertable, absence of both is *unstated*, and `fjs/form2441`'s R6 refuses by name. Both
  present is a contradiction and `fjs/document/credits`' `checkReferences` refuses it.
- `vnd.fjs.1099g` `box3RefundTaxYear` — the year of the refund in box 2, which is already refused
  by name (the §111 tax-benefit rule needs the prior-year return).
- `vnd.fjs.1098t` `box9GraduateStudent` — an AOTC eligibility signal; the engine reads the
  taxpayer's own `educationStudents` election instead.
- `vnd.fjs.rental_property` `qualifiedJointVenture` — §761(f) splits one property between two
  Schedule Es and two Schedule SEs; the engine computes one.
- `vnd.fjs.1099div` `box11FatcaFilingRequirement`, `vnd.fjs.1099r` `box12FatcaFilingRequirement`,
  `vnd.fjs.1099b` `fatcaFilingRequirement` — Form 8938, not modeled.

## Category (c) — deliberately unread, and correct

- **Every K-1 face's unrouted money box.** `vnd.fjs.k1_1065`, `vnd.fjs.k1_1120s` and
  `vnd.fjs.k1_1041` each carry an `unmodeledMoneyBoxes` table, and `checkReferences` REFUSES a
  present, non-zero amount in any of them by name, quoting the printed line it would have gone to.
  A present zero is accepted, because a transcript that prints `0.00` in an unused box is
  ordinary. This is the mechanism the four known defects lacked.
- **`vnd.fjs.1099g` `box5RtaaPayments`, `box6TaxableGrants`, `box7AgriculturePayments`,
  `box9MarketGain`** — the same table, the same refusal, in that dialect.
- **`vnd.fjs.1099nec` `box3ReservedForFutureUse`** — likewise; the printed box has no caption.
- **Every state and local box on every dialect** — `vnd.fjs.w2` boxes 15-20,
  `vnd.fjs.1099b`/`1099div`/`1099r` `stateLocal`, `vnd.fjs.1099g` boxes 10-11, `vnd.fjs.1099nec`
  boxes 5-7. REQUIREMENTS.md's Out of Scope entry is explicit: *"store W-2 boxes 15-20 faithfully,
  compute nothing"*, and state withholding never reaches a federal return. `vnd.fjs.1099g`'s own
  header already says this for its own boxes. (The Schedule A SALT-floor asymmetry above is a
  separate finding: it is about a refusal's completeness, not about a printed line.)
- **`vnd.fjs.form3922`, all eight boxes.** Its ONLY reader is `fjs/form8949`'s
  `employeeStockPurchaseRefusal` predicate, which reads the document's PRESENCE and no box at all.
  The refusal fires and is proven by content — three separate assertions, one per named gap — and
  it has a control (`aStoredFormThreeNineTwoTwoWithNoSaleComputesSilently`), which is the ordinary
  case: a Form 3922 arrives in the year of purchase, when there is nothing to report.
- **`vnd.fjs.1095a` `line33AnnualEnrollmentPremiums`, `line33AnnualSlcspPremium`,
  `line33AnnualAdvancePaymentOfPtc`.** Read only by a refusal predicate: each is compared against
  the exact cents sum of its own Part III column, and a disagreement refuses the document naming
  the field. Form 8962 computes monthly, so the annual totals carry no figure of their own.
- **`vnd.fjs.1099div` `box2eSection897OrdinaryDividends`, `box2fSection897CapitalGain`.** The
  printed Note: *"Boxes 2e and 2f apply only to foreign persons and entities whose income maintains
  its character when passed through or distributed to its direct or indirect foreign owners or
  beneficiaries."* A Form 1040 filer is not one.
- **`vnd.fjs.1099div` `box6InvestmentExpenses`.** Printed: *"Shows your share of expenses of a
  nonpublicly offered RIC ... **This amount is included in box 1a.**"* It is already inside a box
  line 3b sums, and §67(g) suspends the deduction it used to support.
- **`vnd.fjs.ssa1099` `box3BenefitsPaid` and `box4BenefitsRepaid`.** Box 5 is box 3 minus box 4 and
  box 5 is what line 6a reads. Their `box3Description`/`box4Description` are prose.
- **Identity and label fields on every dialect** — `payerName`, `recipientName`, `employerName`,
  `employeeName`, `fiduciaryName`, `stateIdNumber`, `payerStateNo`, `employerStateIdNumber`,
  `box6CorporationName`/`box6CorporationTin`, the 1095-A names/SSNs/dates, `finalK1`, `amendedK1`,
  `boxDForm1041TWasFiled`/`boxDForm1041TFiledDate`, `boxEFinalForm1041`. DOC-01: human labels live
  inside snapshots and reach no computed line.
- **`vnd.fjs.credits` `householdEmployee`.** Its own docstring already says so: it is Schedule H's
  trigger, and Schedule H is not computed.
- **`vnd.fjs.1099b` `box1bDateAcquired`/`box1cDateSoldOrDisposed`.** Form 8949's short/long
  category comes off `box2ShortTermGainOrLoss`/`box2LongTermGainOrLoss`, which is the payer's own
  determination; the dates would be a second, weaker source for the same fact.
- **`vnd.fjs.1099b` `box6ReportedToIrsGrossProceeds`/`box6ReportedToIrsNetProceeds`,
  `box2bTotalDistribution`, `box7cTrumpAccount`, `box13DateOfPayment`,
  `box7IncludesAmountsForAnAcademicPeriodBeginningInTheFollowingYear`, the K-1 `ScheduleK3Attached`
  and `MoreThanOneActivity` checkboxes.** Informational checkboxes with no printed federal line.

## The standing gate

`fjs/document/unread_registry` is the gate this sweep leaves behind, and it is worth more than any
single wiring here. It names **every money field of every dialect that has one — 142 of them
across sixteen dialects — exactly once**, with one of three dispositions:

| Disposition | Count | Meaning |
|---|---|---|
| `read` | 64 | a computation reads the amount and it can reach a printed line |
| `refused` | 42 | the ONLY reader is a refusal predicate, and that is correct |
| `dropped` | 36 | nothing reads it; the note prices the gap and names the error direction |

The partition is checked against the tuples the dialects themselves walk through
`centsFromString`, in both directions, so:

- a money box **added to a dialect and forgotten** is in that dialect's tuple and in no registry
  row — the gate fails and NAMES it. That is the defect;
- a money box **removed** leaves an orphaned row — the gate fails the other way;
- a **row deleted** shrinks the registry, which the hand-typed `expectedMoneyFieldCount` refuses;
- a row flipped from `read` to `dropped` moves `expectedDroppedCount`, which is stated separately
  from the total for exactly that reason;
- and the seven boxes this project has already paid for are pinned BY NAME, so the specific
  regression of silencing the gate by reclassifying a wired box fails
  `theKnownDefectsKeepTheirDisposition`.

The dialect list the gate iterates is **hand-typed in the registry**, not derived from the dialect
registry, because AGENTS.md's fourth defect is precisely a proof whose iteration set comes from
the code under test.

**What the gate cannot do:** verify that a `read` row is telling the truth. Only the wiring proofs
in `fjs/form1040/core` and `fjs/report/tax_return` do that. The gate's job is narrower and is the
one nobody was doing — making a money field's status a thing somebody had to write down.

It covers MONEY fields only. Dates, checkboxes, identity labels and free text are outside it: all
seven known defects were money, and a partition including `payerName` would be mostly noise.

## The Form 2441 fix's own mutation log

Gate before: **2,902 pass / 0 fail** (`feature/tier-b-forms` @ `73e9832`). After: **2,911**.

Before any leaf was written, the fix itself was the first observation: adding the refusal with
the shipped fixtures untouched turned **eight** `fjs/form1040/core` leaves red — every
end-to-end Form 2441 leaf in the repository — which is the direct measurement that the wrong
behaviour was live and that those fixtures were in it.

| # | Mutation | Red |
|---|---|---|
| M1 | R6 never fires (`length !== 0` -> `length > 1000`) | **5** — 3 form-level, 2 wiring |
| M2a | `under !== true` -> `under !== true \|\| name.length > 1000` | **0 — a no-op by construction**, recorded rather than re-run silently: `false \|\| false` is `false` and `true \|\| false` is `true`, so the term is unchanged at every input |
| M2b | the under-13 term is really dropped | **9** |
| M3 | the over-12-and-disabled term is dropped | **8** |
| M4 | only the FIRST unstated person is named | **2** |
| M5 | the both-asserted contradiction refusal never fires | **1** |
| M6 | `underAgeThirteenWhenTheCareWasProvided` is deleted from the schema | **does not compile** — 5 `tsc` errors across three modules, which is the strongest form of "it is wired" |
| M7 | the `$6,000` cap interpolation is erased from R6's message | **1** |

**M3 reddens one fewer than M2b, and the arithmetic is why.**
`theDependentCareCreditIsOrderedAheadOfTheChildTaxCredit` runs on
`dependentCareWithAChildInputs`, whose single qualifying person asserts §21(b)(1)(A) — so
dropping the *over-12* term cannot touch it, while dropping the *under-13* term refuses it. The
prediction was "the same set both ways" and it was wrong, which is the useful direction.

**M2a is the equivalent-mutant case AGENTS.md names**, and it is recorded rather than quietly
replaced: the written mutation compiled, applied, changed the source, and could not turn red at
any input. M2b is the semantically-intended edit in a form that keeps the binding live
(`String(x).length < 1000`), and it bites.
