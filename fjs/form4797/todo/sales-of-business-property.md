# Form 4797 — Sales of Business Property

Spec written before the code, per AGENTS.md. Sources fetched and read directly
(2026-08-19), never from recall:

- `https://www.irs.gov/pub/irs-pdf/f4797.pdf` — the 2025 form, Cat. No. 13086I,
  "Created 4/16/25".
- `https://www.irs.gov/pub/irs-pdf/i4797.pdf` — the 2025 instructions,
  Cat. No. 13087T, dated Jul 28, 2025. Cited as `i4797 p<n>` by the page number
  printed in the footer.
- `https://www.irs.gov/pub/irs-pdf/i4562.pdf` — the 2025 Form 4562
  instructions, for Step 3's **disposal** decimal column.
- `https://www.irs.gov/pub/irs-pdf/i1040sd.pdf` — the 2025 Schedule D
  instructions, p.12, for the *Unrecaptured Section 1250 Gain Worksheet*.

This form is what retires `vnd.fjs.asset_register`'s
`noDepreciablePropertyDisposedOfDuringTheYear`. That certification's own
citation says so: *"a disposal needs the disposal decimal AND §1245/§1250
recapture on Form 4797, which this engine does not model"*
([../../form4562/todo/depreciation-and-the-asset-register.md](../../form4562/todo/depreciation-and-the-asset-register.md) §2).

---

## 1. Where a disposal lives: on the EXISTING register, and no new dialect

**Decision: a per-asset `disposal` block on `vnd.fjs.asset_register`. No new
dialect, no new document.** The reasons, in the shape the Schedule E and
Schedule F work used when each wrote down why `vnd.fjs.business_expenses` was
or was not the right container:

1. **Four of the six figures Part III needs are already on the register asset,
   and the join key for anything else is free text.** Printed line 21 is *"Cost
   or other basis plus expense of sale"* and line 22 is *"Depreciation (or
   depletion) allowed or allowable"*; the cost, the business-use percentage,
   the classification, the method, the convention and the month placed in
   service that produce both are register fields today. A separate disposal
   document would have to name which asset it disposed of, and the only
   candidate key on `registeredAsset` is `description` — a free-text string
   with no uniqueness rule. A join on free text is a silent-mismatch machine:
   the wrong asset's basis would produce a plausible, wrong gain.
2. **Form 4562 itself has to know about the disposal**, so the disposal cannot
   live where Form 4562 cannot see it. Two printed rules need it:
   - i4562 p11, column (g): *"If you disposed of the property during the
     current tax year, multiply the result by the applicable decimal amount
     from the tables in Step 3"* — the year-of-sale deduction is a PART year.
   - i4562 p11, the mid-quarter test's own exclusion list: *"In determining
     whether the mid-quarter convention applies, do not take into account …
     Property that is placed in service and disposed of within the same tax
     year."*

   `fjs/form4562` reads exactly one document, the register. A disposal stored
   anywhere else would leave Form 4562 line 22 overstated in the year of sale
   for every filer who sold something — a wrong Schedule C line 13 and a wrong
   Schedule E line 18, computed from a document that looked complete.
3. **The certification being retired is a register field.** The thing that
   retires a guard belongs where the guard stood; otherwise the register keeps
   a field whose subject has moved out of it.
4. **One rule, one place.** The register's own docstring records that
   `depreciableAssets` was MOVED into the dialect from `fjs/schedule/c` because
   a second copy would "decide independently whether a hand-edited `'200 DB'`
   reaches the MACRS schedule". A disposal document restating basis, dates,
   method and convention would be that second copy, one layer up.

The disposal block is `option`al **and nested**, rather than four sibling
`or(option, string)` fields, so that "all four facts or none" is a STRUCTURAL
property of the schema instead of a cross-field check that can be forgotten.
Contrast `section168kStatus`/`specialDepreciationAllowanceClaimed`, which
genuinely are two independent fields whose agreement has to be asserted.

```js
disposal: or(option, {
    dateAcquired: string,     // f4797 line 19 col (b) / line 2 col (b), mo. day yr.
    dateSold: string,         // f4797 line 19 col (c) / line 2 col (c), mo. day yr.
    grossSalesPrice: string,  // f4797 line 20 / line 2 col (d)
    expenseOfSale: string,    // f4797 line 21's "plus expense of sale"
}),
```

### `dateAcquired` is a fifth fact the register did not carry, and it is not `datePlacedInService`

`datePlacedInService` is `YYYY-MM` with **no day**, and the register's own
refusal explains why: *"the half-year convention ignores the date, the
mid-quarter convention reads the quarter and the mid-month convention reads the
month, so a day here would suggest a precision the computation does not have"*.

Form 4797 has that precision and needs it. Columns (b) and (c) of both line 2
and line 19 are *"(mo., day, yr.)"*, because the **holding period** decides
which Part the disposal is reported in, and i4797 p6 measures it to the day:
*"To figure the holding period, begin counting on the day after you received
the property and include the day you disposed of it."*

Acquisition is also not placing in service. The two printed columns are
different columns on different forms — f4562 column (b) is *"Month and year
placed in service"*, f4797 line 19 column (b) is *"Date acquired"* — and
property bought in December and placed in service in January has a holding
period that starts in December.

So `dateAcquired` is `YYYY-MM-DD`, it lives INSIDE the disposal block (an asset
still held needs no acquisition day, and requiring one would invalidate every
register in existence), and the dialect cross-checks it against
`datePlacedInService`: acquiring an asset AFTER placing it in service is not a
thing that can happen.

### Holding period, computed without a calendar

*More than 1 year* is decided by comparing `dateSold` against `dateAcquired`
with the year advanced by one, as a `(year, month, day)` tuple. Because both
strings are zero-padded `YYYY-MM-DD`, lexicographic order IS chronological
order, so the whole test is one string comparison and no `Date`, no leap-year
rule and no day arithmetic appears anywhere.

The tuple form is exact at the boundary the naive "add 365 days" is wrong at.
Acquired `2024-02-29`: the holding period begins `2024-03-01` and one full year
of it completes at the end of `2025-02-28`, so `2025-03-01` is more than a year
and `2025-02-28` is not. `'2025-03-01' > '2025-02-29'` is `true` and
`'2025-02-28' > '2025-02-29'` is `false` — the right answers, from a date that
does not exist, because only the ORDER is ever used.

---

## 2. Depreciation allowed **or allowable** — derived, in full, from the register

§1245(a)(2) recaptures *"adjustments reflected in the adjusted basis"*, and
i4797 p9's line 22 Step 1 says *"Deductions allowed **or allowable** for
depreciation (including any special depreciation allowance …)"*. A taxpayer who
under-claimed still recaptures. So line 22 must never be a transcribed "what I
actually deducted" figure.

**This engine can derive it, cumulatively, and the derivation is already
written.** `fjs/form4562/macrs`'s `macrsColumn` returns the WHOLE column of
percentages for a (classification, method, month, convention) — element `i` is
recovery year `i + 1` — and `fjs/form4562`'s own docstring records why that is
sound: Publication 946 Table A-1's header is *"Multiply your property's
unadjusted basis each year by the percentage"*, so year `n`'s deduction is a
function of the UNADJUSTED basis and the elapsed years and never of what was
actually deducted. That is precisely the definition of *allowable*. The same
property that let the register omit accumulated depreciation is what lets Form
4797 reconstruct it.

So:

```
line 22 = specialDepreciationAllowanceClaimedCents
        + section179ElectedCostCents            // always 0n here; see §5
        + Σ (y = 1 … saleRecoveryYear) macrsDeductionCents(basisForDepreciation)(…)(y)
```

with the **last** term — the year of sale — multiplied by Step 3's disposal
decimal (§3 below). Each year is rounded once, at that year's line, exactly as
`fjs/form4562` rounds it, because the sum of what was allowable year by year IS
the cumulative allowable amount; applying a cumulative percentage and rounding
once would produce a figure no year's Form 4562 ever showed.

`specialDepreciationAllowanceClaimed` is added because i4797 p9 Step 1 names it
in so many words, and because `basisForDepreciationCents` already subtracted it
— so omitting it here would let a bonus election erase its own recapture.

### There is no "asset predates the register's coverage" case

The register refuses any `datePlacedInService` before `firstMacrsYear` (1987) by
name, citing i4562 p9 (*"MACRS is used to depreciate any tangible property
placed in service after 1986"*) and pointing at Form 4562 line 16. So every
asset a register can hold is MACRS property whose column is derivable from
recovery year 1. The pre-MACRS case does not reach this form; it is refused one
layer down, at storage, which is the right place for it.

What the derivation cannot see is a basis adjustment the register cannot spell:
i4797 p9's Step 1 and Step 2 lists name investment-credit basis reductions,
§50(c), clean-fuel and childcare-facility credits, §179D, and eleven more. None
is representable in `vnd.fjs.asset_register`, and none can be present without
some other field being present too — every one of them is a credit or an
election, and this engine models no credit that adjusts a depreciable basis. So
they are documented zeros with a named reason, not silent ones.

---

## 3. The disposal-year deduction, and why `fjs/form4562` changes too

i4562 p11, Step 3: *"For property placed in service **or disposed of** during
the current tax year, multiply the result from Step 2 by the applicable decimal
amount from the tables below"*, and the printed tables have two columns:

| Convention | Placed in service | Disposed of |
|---|---|---|
| HY | 0.5 | 0.5 |
| MQ 1st quarter | 0.875 | 0.125 |
| MQ 2nd quarter | 0.625 | 0.375 |
| MQ 3rd quarter | 0.375 | 0.625 |
| MQ 4th quarter | 0.125 | 0.875 |
| MM 1st month | 0.9583 | 0.0417 |
| MM 12th month | 0.0417 | 0.9583 |

The two columns sum to 1 in every row, so the disposal decimal is
`24 − conventionTwentyFourths(convention)(month)` over 24, in the same
twenty-fourths `fjs/form4562/macrs` already computes the placed-in-service
column in. **One denominator, one table, one function** —
`disposalTwentyFourths` sits beside `conventionTwentyFourths` and is checked
against all sixteen printed decimals.

Note that the disposal decimal reads the month of **disposal**, not the month
placed in service. HY makes them look interchangeable (0.5 either way) and MM
makes them look symmetric; MQ is where a fixture that shared a month would hide
a transposition, which is why §7's fixtures do not share one.

**`fjs/form4562` must apply it.** Today `assetDeductionCents` computes the
year's full deduction. For an asset disposed of during the year, the printed
rule halves it (or takes the MQ/MM disposal decimal), and Form 4562 line 22 is
what reaches Schedule C line 13 and Schedule E line 18. Wiring Form 4797
without this change would compute a correct recapture beside a Schedule C that
deducts a full year of depreciation on a machine sold in March.

The mid-quarter test's exclusion moves with it: assets *"placed in service and
disposed of within the same tax year"* are struck from both sides of the 40%
comparison. That case then **refuses** anyway (§5), but the exclusion is
written because the refusal is about Form 4797 and the exclusion is a fact
about Form 4562's convention — two rules that must not be conflated, since a
later phase that lifts the refusal must not silently reintroduce the asset into
the aggregate.

---

## 4. §1231, the five-year lookback, and the asymmetry that IS the design

§1231(c) recharacterizes current-year net §1231 **gain** as ordinary income to
the extent of *"your net section 1231 losses deducted during the 5 preceding
tax years that have not yet been applied against any net section 1231 gain"*
(i4797 p6, line 8). Prior-year figures are this repository's standing
architectural blocker.

**Read the printed page and the blocker is one-sided.** Form 4797 line 7's own
instruction, verbatim:

> *"Individuals, partners, S corporation shareholders, and all others. If line
> 7 is zero or a loss, enter the amount from line 7 on line 11 below and **skip
> lines 8 and 9**. If line 7 is a gain and you didn't have any prior year
> section 1231 losses, or they were recaptured in an earlier year, enter the
> gain from line 7 as a long-term capital gain on the Schedule D filed with
> your return and skip lines 8, 9, 11, and 12."*

So:

| Line 7 | Line 8 | Verdict |
|---|---|---|
| **a loss** | printed instruction says SKIP | **COMPUTES.** The loss is fully ordinary, via line 11 → line 17 → line 18b → Schedule 1 line 4 |
| **exactly zero** | printed instruction says SKIP | **COMPUTES**, and this is the ordinary equipment case — see below |
| **a gain**, no prior §1231 losses | the printed page's own second sentence removes it | **COMPUTES**, on a certification (below) |
| **a gain**, otherwise | required | **REFUSES at printed line 8** |

The asymmetry is the exact mirror of `fjs/schedule/e/part_i`'s: there a PROFIT
computes and a LOSS refuses, because §469 sits on printed line 22 and a profit
never passes through it. Here a LOSS computes and a GAIN refuses, because
§1231(c) sits on printed line 8 and a loss never passes through it. Both are
the printed page's asymmetry, not this engine's, and neither was chosen.

**"Exactly zero" is not a curiosity — it is the common case.** For §1245
property the gain is capped at the depreciation taken (line 25b is *"the
smaller of line 24 or 25a"*), and equipment sold for less than its original
cost has taken more depreciation than the gain over adjusted basis. So line 24
= line 25b, line 31 = line 30, and line 32 = 0 → line 6 = 0. A register whose
only disposal is a fully-recaptured machine reaches line 7 = 0 and never looks
at the lookback at all. This is the reason Form 4797 is worth having under a
prior-year blocker.

### The certification, and why it belongs on `vnd.fjs.return_profile`

The line 7 instruction names a state a taxpayer can assert and this engine
cannot derive — *"you didn't have any prior year section 1231 losses, or they
were recaptured in an earlier year"*. That is the same species as
`vnd.fjs.asset_register`'s `priorYearSection179CarryoverIsZero` (a checkbox
rather than an amount, because a non-zero one refuses anyway) and
`vnd.fjs.return_profile`'s `movingExpensesArmedForcesPermanentChangeOfStation`
(a certification the printed form asks for in so many words, read by exactly
one module, which refuses without it).

It goes on **`vnd.fjs.return_profile`, not on the register**, and the
cardinality is the whole argument: §1231 nets across the ENTIRE return. A
taxpayer with two businesses files two Forms 4562 (i4562 p1: *"File a separate
Form 4562 for each business or activity"*) and therefore holds two registers,
but exactly ONE Form 4797 and one §1231 netting. A per-register certification
would be a return-level fact stored per business, with two copies free to
disagree — the drift the register's own docstring rejects. `return_profile` is
this engine's one document per return.

Field: `noNonrecapturedNetSectionOneTwoThreeOneLossesFromPriorYears`,
`or(option, true)` under DOC-12, so a materialized `false` is structurally rejected
and absence is the only way to say "no".

**No amount is stored, and that is deliberate.** Line 8 is not a printed line
of any prior-year return — i4797 p7 calls it a *"For recordkeeping purposes"*
figure, maintained across five years and reduced each time some of it is
applied. `vnd.fjs.prior_year_capital_loss` is the precedent for transcribing
prior-year facts, and it is a precedent AGAINST transcribing this one: that
dialect's docstring insists it stores *"ONLY the four raw prior-year figures,
never a pre-computed carryover total"*, because a stored total would be "a
second source of truth able to disagree with the four figures it should have
been derived from". Line 8 has no raw figures to derive it from that are
themselves printed lines — reconstructing it would need five prior years'
Forms 4797 AND the running recapture ledger between them. So the honest
options are a certification that it is zero, or a refusal. This spec takes
both, in the order the printed page puts them.

### Line 9, once the certification is present

With line 8 = 0: line 9 = line 7 − 0 = line 7, which is *"more than zero"*, so
the printed instruction sends line 8's amount (0) to line 12 and *"the gain
from line 9 as a long-term capital gain on the Schedule D"*. The zero on line
12 is a real printed entry, not an absence, and it is kept as one.

---

## 5. §1245 and §1250, and which assets can be spelled at all

i4797 p10, line 25: §1245 property is *"property that is depreciable … and is
one of the following: Personal property; Elevators and escalators placed in
service before 1987; Real property (other than …) adjusted for the
following …"*. Line 26: §1250 property is *"depreciable real property (other
than section 1245 property)"*.

The register's `classification` decides it for six of its eight values and
cannot decide it for two:

| `classification` | §1245 or §1250 | Why |
|---|---|---|
| `threeYear`, `fiveYear`, `sevenYear`, `tenYear` | **§1245** | personal property; and the arguable members — *"a single purpose agricultural or horticultural structure (as defined in section 168(i)(13))"* — are named explicitly in i4797 p10's OWN §1245 list |
| `residentialRental`, `nonresidentialReal` | **§1250** | depreciable real property, by definition |
| `fifteenYear`, `twentyYear` | **neither — REFUSES** | the class straddles. 15-year holds both §1245 personal property and §1250 land improvements and qualified improvement property; 20-year holds both municipal sewers and §1250 farm buildings. The register carries nothing that distinguishes them |

The 15/20-year refusal is not fastidiousness: for post-1986 property the two
characterizations differ by the WHOLE recapture. §1245 recaptures every dollar
of depreciation as ordinary income (line 25b); §1250 on straight-line MACRS
recaptures nothing at all (line 26g = 0, below). Guessing would be a coin flip
between "all ordinary" and "all capital". The field that would retire it is a
`section1245OrSection1250` status in `section168kStatus`'s exact shape — a
legal characterization the taxpayer asserts, as a frozen string vocabulary
rather than a boolean — and this spec deliberately does not add it, because
YAGNI and because the refusal names precisely what to add.

### Line 26g is a STRUCTURAL zero, and unrecaptured §1250 gain is not

The printed line 26 header: *"If section 1250 property: If straight line
depreciation was used, enter -0- on line 26g, except for a corporation subject
to section 291."* And i4797 p10: *"Section 1250 recapture does not apply to
dispositions of the following MACRS property placed in service after 1986 …
27.5-year … residential rental property … 22-, 31.5-, or 39-year … 
nonresidential real property. You are not required to calculate additional
depreciation for these properties on line 26."*

Both premises are enforced one layer down and cannot be otherwise:
`macrsClassifications` gives `residentialRental` and `nonresidentialReal` the
single permitted method `SL`, and the register refuses any
`datePlacedInService` before 1987. §291 is corporations only and this engine
computes Form 1040. So **line 26a-26g are zero for every §1250 property this
engine can hold**, as a structural consequence of two upstream refusals rather
than as an approximation — the same argument shape Form 4562 line 12 uses.

The 25%-rate gain is a different figure and it does NOT vanish. §1(h)(1)(E)
taxes *unrecaptured section 1250 gain* — the part of the gain attributable to
depreciation that §1250 did not recapture — at up to 25%, and the Schedule D
worksheet computes it FROM Form 4797's own lines. See §6.

### Everything else Form 4797 reports, and where it refuses

The register can spell a depreciable MACRS asset used in a trade or business.
It cannot spell any of the other seven rows of i4797 p1's *Where To Make First
Entry* chart, and each stays refused by name:

| Row | Why it cannot be spelled |
|---|---|
| farmland with §175 soil and water expenses (§1252, lines 27a-27c) | no dialect carries soil, water and land clearing expenses, and land is not depreciable property so it is not in a register at all |
| cost-sharing payment property (§1255, lines 29a-29b) | no dialect carries a §126 excluded payment |
| oil, gas, geothermal, mineral (§1254, lines 28a-28b) | no dialect carries intangible drilling costs or depletion |
| cattle and horses (24-month holding period), other livestock (12-month) | the register has no "this asset is livestock" fact, and applying the general more-than-1-year rule to a breeding cow is silently wrong in both directions |
| de minimis safe harbor property | expensed, never registered |
| §1244 stock, mark-to-market securities, applicable preferred stock | line 10 items, not depreciable property |
| land sold with a building | i4797 p2 requires allocating the amount realized between the two *"based on their respective FMVs"*, and no FMV is stored |

Two of these are **detectable and therefore refused rather than left to
chance**: a register whose `accountNumber` matches a stored `vnd.fjs.farm`
record refuses any disposal, naming §1252 and the livestock holding periods; a
disposal of `fifteenYear` or `twentyYear` property refuses as above. The
remainder are not detectable from any document, exactly as
`fjs/form6781`'s straddle risk is not, and they are named here rather than
hidden.

### Four more disposal refusals, each with its own printed reason

1. **Business use below 100%.** Line 21 is *"Cost or other basis plus expense of
   sale"* — the WHOLE cost — while the register's depreciable basis is the
   business-use share. Splitting a mixed-use disposal means allocating the
   amount realized between a business part on Form 4797 and a personal part on
   Schedule D, on which no loss is allowed. i4797 p3 gives the rule for the
   home case (*"Any gain on the personal part of the property is a capital
   gain. You cannot deduct a loss on the personal part"*) and this engine has
   no wiring that carries the personal part anywhere. Refusing costs a
   refusal; computing costs a Schedule D that is short.
2. **Placed in service and disposed of in the same tax year — refused in
   `fjs/form4562`, and the reason is narrower than it first looked.** i4562 p11
   says two things about such property: it is struck from the mid-quarter
   aggregate (*"In determining whether the mid-quarter convention applies, do
   not take into account … Property that is placed in service and disposed of
   within the same tax year"*), and under that convention *"no depreciation is
   allowed"* for it.

   **The second sentence is printed for the MID-QUARTER convention and for no
   other**, and Publication 946 chapter 4 — which does give the
   year-of-disposition fraction for all three conventions — never repeats it.
   So whether a half-year or mid-month asset bought and sold inside one year
   takes half a year of depreciation or none is not settled by anything read
   for this phase. Refusing rather than choosing: the wrong choice OVERSTATES
   the deduction and UNDERSTATES the §1245 recapture at the same time, in the
   one year both are decided.

   **The exclusion from the 40% test is deliberately NOT implemented**, and
   that is a consequence of the refusal rather than an oversight: a branch no
   computable return can reach is a branch no proof can redden, which is
   AGENTS.md's *"a rule illustrated by an unreachable module is a rule nobody
   can check"*. `midQuarterConventionApplies` says so where the filter would
   have gone.
3. **A §179 election on a disposed asset.** `section179ElectedCost` already
   refuses the whole Form 4562, so it cannot reach here; the term is written
   into line 22's formula anyway, with this note, so that lifting the Form 4562
   refusal does not silently drop §179 from the recapture base. i4797 p9 Step 1
   names *"The section 179 expense deduction"* in the line 22 list.
4. **Listed property.** Already refuses at Form 4562 Part V, which is why Part
   IV of this form (§179 and §280F(b)(2) recapture when business use drops to
   50% or less) is structurally unreachable: column (a) needs a §179 deduction
   and column (b) needs listed property, and both refuse upstream.

---

## 6. Where the numbers go: three printed destinations, and Schedule D CAN take the third

| Form 4797 | Destination | Status |
|---|---|---|
| line 18b | Schedule 1 line 4 → 1040 line 8 | `fjs/schedule/1`'s line 4 is a documented zero today, and `otherGainsOrLosses` is the `fjs/return/scope` refusal that names this form |
| line 7 gain (via line 9) | Schedule D line 11, *"Gain from Form 4797, Part I"* | `fjs/schedule/d` line 11's own comment already names Form 4797 as unmodeled |
| unrecaptured §1250 gain | Schedule D line 19, via the *Unrecaptured Section 1250 Gain Worksheet* lines 1-9 | **the slot exists** |

**Schedule D can accept unrecaptured §1250 gain.** `fjs/schedule/d` already
implements the whole worksheet; its lines 1 through 9 are collapsed into a
single `unrecap1250Line9 = 0n` whose comment reads *"Property-level and Form
4797/6252 installment-sale mechanics (Steps 1-3, p.13) — entirely about real
property/depreciation recapture this project has no document type for"*. That
sentence stops being true in this phase. The printed worksheet's lines 1-9
(i1040sd p.12) are:

```
    If you aren't reporting a gain on Form 4797, line 7, skip lines 1 through 9
    and go to line 10.
 1. … enter the smaller of line 22 or line 24 of Form 4797 for that property …
 2. Enter the amount from Form 4797, line 26g, for the property …
 3. Subtract line 2 from line 1
 4. … Form(s) 6252 …                                        (documented 0)
 5. … Schedule K-1 partnership or S corporation …           (documented 0)
 6. Add lines 3 through 5
 7. Enter the smaller of line 6 or the gain from Form 4797, line 7
 8. Enter the amount, if any, from Form 4797, line 8
 9. Subtract line 8 from line 7. If zero or less, enter -0-
```

Every input is a Form 4797 line this phase computes. Line 4 stays a documented
zero (`fjs/form6252` does not exist); line 5 stays one for the reason already
written at `unrecap1250Line10` — the §1250 slice BOXES on all three K-1
dialects refuse at storage.

The worksheet's own first sentence is what makes the design cohere: *"If you
aren't reporting a gain on Form 4797, line 7, skip lines 1 through 9."* The
case that needs the 25% rate is exactly the case that needs the §1231
certification, so a return that computes without prior-year data
(line 7 ≤ 0) never reaches these lines, and a return that reaches them has
already asserted line 8 = 0.

**A §1250 disposal at a gain therefore does NOT refuse.** The first draft of
this spec expected it to: with no worksheet slot, an unrecaptured §1250 gain
routed to Schedule D line 11 as an ordinary long-term capital gain would be
taxed at 15% instead of 25% and would UNDERSTATE the tax. The slot exists, so
the honest answer is to fill it. This is recorded rather than quietly
corrected, because "Schedule D has no worksheet" was the plausible finding and
it was wrong.

---

## 7. Fixtures: a recapture form is a sign-and-ordering form

AGENTS.md records four shipped defects and a sweep in which mutations survived
because every fixture shared a business-use percentage, a month, a year or an
evenly-dividing amount. Form 4797 is worse than most: it is almost entirely
`min`, subtraction and sign tests, so a fixture set that is uniform in sign or
in magnitude ordering proves nothing.

The fixture set must therefore contain, at minimum:

- a §1245 asset sold at a **gain that is fully recaptured** (line 25b = line
  24, line 32 = 0) — the ordinary equipment case, and the one that makes line 7
  exactly zero;
- a §1245 asset sold at a gain **larger than the depreciation taken**, so line
  25b < line 24 and line 32 is positive and reaches line 6 and line 7 — the only
  way `min(line 24, line 25a)` can be observed as a `min` at all;
- a §1245 asset sold at a **loss**, held more than a year, which lands in Part
  I rather than Part III;
- a §1250 asset (residential rental, mid-month, 27.5-year) sold at a gain,
  which produces line 26g = 0 AND a non-zero unrecaptured §1250 gain;
- an asset held **1 year or less**, which lands in Part II;
- amounts where **the order of subtraction matters**: line 23 = 21 − 22 and
  line 24 = 20 − 23 are not commutative, and a fixture whose sales price
  happens to equal its cost cannot tell them apart;
- **different placed-in-service and disposal months, in different quarters**,
  so a transposition of Step 3's two decimal columns reddens;
- at least one amount that does **not** divide evenly by the rate, so a
  rounding mutation cannot survive.

Every expected value is hand-typed in integer cents from the printed rules, and
every refusal has a control showing the neighbouring legitimate case computes.

---

## 8. What this retires, what it narrows, and what it leaves alone

`noDepreciablePropertyDisposedOfDuringTheYear` is **NARROWED, not removed.**

It is removed as a blanket precondition on Form 4562: a register may now carry
disposals and still produce a Form 4562. What replaces it is a set of named
refusals, each firing on a disposal this engine cannot characterize — the
15/20-year §1245/§1250 straddle, the farm register, business use below 100%,
and the same-year placed-in-service-and-disposed case. AGENTS.md's rule for
this is quoted rather than paraphrased: retiring a certification is only honest
if every path it guarded now computes or refuses by name.

The certification field itself stays on the dialect and keeps meaning exactly
what it says — the register asserts nothing was disposed of — but Form 4562 no
longer requires it. It becomes what `everyDepreciableAssetIsListed` already is:
a certification required only when the facts make it load-bearing. A register
that carries a `disposal` block and ALSO certifies
`noDepreciablePropertyDisposedOfDuringTheYear` is a contradiction, and the
dialect refuses it by name.

Kinds, in `fjs/return/scope`:

- **`otherGainsOrLosses` → modeled**, in the same commit as the
  `fjs/form4797`/`fjs/schedule/1`/`fjs/form1040/core` wiring that makes it
  computable — wire before reclassify.
- **`capitalGainsOrLosses`** was already modeled; Schedule D line 11 and line
  19 gain a second source, and no kind moves for it.
- Every other Form 4797 population stays refused with a corrected remedy, and
  the corrections are the point: today's `otherGainsOrLosses` remedy reads
  *"requires Form 4797, and for a casualty or theft Form 4684 (no phase yet)"*,
  which is now wrong in its first half for the population this phase serves.

---

## 9. The mutation log

AGENTS.md: *"A proof is not known to work until you have watched it fail."*
Forty-six mutations were written and run against the committed tree, one at a
time, each reverted before the next and each checked with `git diff --numstat`.

**Six survived**, and every one of them is a finding rather than a formality.

**One of the six was not found by mutating at all**, and that is worth naming
first. Grepping for what this phase INVALIDATED — rather than for what it
touched — turned up three prose claims that Form 4797 does not exist, and one of
them was load-bearing. See §10.

| # | Mutation | Leaves red |
|---|---|---|
| 1 | Step 3's disposal decimal becomes the placed-in-service decimal | 7 |
| 2 | Form 4562 never applies the disposal decimal in the year of sale | 3 |
| 3 | cumulative depreciation omits the year-of-sale term | 13 |
| 4 | **cumulative depreciation omits the claimed §168(k) allowance** | **0 — SURVIVED**; 1 after the new fixture |
| 5 | the cumulative loop is off by one | 14 |
| 6 | printed line 25b drops the `min` and takes line 25a | 4 |
| 7 | unrecaptured §1250 gain takes line 24 rather than `min(22, 24)` | 2 |
| 8 | every classification is treated as §1245 | 4 |
| 9 | the holding-period boundary becomes inclusive (`>=`) | 1 |
| 10 | the holding period forgets to advance the year | 5 |
| 11 | line 24 subtracts line 21 rather than line 23 | 13 |
| 12 | column (g) subtracts the depreciation rather than adding it | 20 |
| 13 | the §1231 lookback refusal never fires | 2 |
| 14 | the Schedule-D-not-filed refusal never fires | 1 |
| 15 | the §1245/§1250 straddle refusal never fires | did not compile; 2 in compiling form |
| 16 | the business-use refusal never fires | 2 |
| 17 | the farm refusal never fires | 1 |
| 18 | line 11 takes line 7 unconditionally | 4 |
| 19 | line 6 does not take line 32 | 8 |
| 20 | line 13 does not take line 31 | 8 |
| 21 | a §1231 LOSS reaches Schedule D as a gain | did not compile; 1 in compiling form |
| 22 | Schedule D line 11 drops the Form 4797 term | 3 |
| 23 | the §1250 worksheet drops the Form 4797 term | 3 |
| 24 | **the §1250 worksheet's line 7 CAP is removed** | **0 — SURVIVED**; 1 after the new leaves |
| 25 | Schedule 1 line 4 ignores Form 4797 | 2 |
| 26 | `fjs/form1040/core` never hands Form 4797 to Schedule 1 | 2 |
| 27 | **the §1250 worksheet ignores Form 4797 line 8** | **0 — SURVIVED**; 2 after the new leaves |
| 28 | the narrowed disposal certification never fires | 1 |
| 29 | **the same-year placed-and-disposed refusal never fires** | **0 — SURVIVED**; 1 after the new leaf |
| 30 | the dialect's certification-contradiction refusal never fires | did not compile; 2 in compiling form |
| 31 | the dialect's `dateSold` tax-year check never fires | 6 |
| 32 | the disposal block is dropped on the way out of the dialect | did not compile; 24 in compiling form |
| 33 | the disposal tripwire never fires | 9 |
| 34 | **Step 3's decimal is applied AFTER the rounding rather than before** | **0 — SURVIVED**; 1 after new amounts |
| 35 | line 23 adds the depreciation rather than subtracting it | 14 |
| 36 | the expense of sale is dropped from line 21 | 10 |
| 37 | line 31 drops line 26g | **0 — EQUIVALENT MUTANT**, recorded at the site |
| 38 | a refusal message loses its DESTINATION | 6 |
| 39 | a Part III property is filed under Part I | 14 |
| 40 | `filed` is ignored, so a return with no disposal cites a register | 1 |
| 41 | `fjs/form1040/core` drops Form 4797's error arm | 1 |
| 42 | **the citation loses the asset it came from** | **0 — SURVIVED**; 1 after the new leaf |
| 43 | `otherGainsOrLosses` is deleted from `modeledKinds` | did not compile — the `tsc` partition assertion is the gate |
| 44 | the earned income credit's Worksheet 1 line 6 no longer subtracts | did not compile; 2 in compiling form |
| 45 | Worksheet 1 line 7's floor is removed | 1 |
| 46 | **`fjs/form1040/core` hands the credit a zero §1231 gain** | **0 — SURVIVED**; 1 after the new leaves |

### The five survivors

**#4 — the §168(k) allowance.** i4797 p9's line 22 Step 1 includes *"any special
depreciation allowance"* in the recapture base, and the term was unobservable
because **every asset fixture in this repository declared `electedOut`**. That
is the monoculture AGENTS.md's own sweep found twice before, in a different
column. Dropping the term does not merely shrink a number: on the new fixture it
turns a $3,236.29 ordinary gain in Part III into an $8,843.20 §1231 loss in Part
I. `theSectionOneSixtyEightKAllowanceIsInsideTheRecaptureBase` was added, with
the counterfactual adjusted basis hand-typed beside the real one.

**#24 and #27 — the Schedule D worksheet's own arithmetic.** Both were
unobservable through `fjs/form1040/core`, and for two different reasons that are
worth separating. The line 7 cap (*"the smaller of line 6 or the gain from Form
4797, line 7"*) needs an unrecaptured §1250 gain LARGER than the net §1231
gain, which happens when a §1231 loss elsewhere nets the gain down without
touching the depreciation inside it — no fixture had one. Line 8 is worse: it is
Form 4797 line 8, which is a **structural zero in every return this engine
computes**, so no end-to-end fixture could ever make it non-zero. The fix is the
same for both and it is a general one: `fjs/schedule/d` takes NUMBERS, so its
contract can be proven directly at values no Form 4797 here produces yet.

**#29 — the same-year refusal.** A refusal with no proof at all. Nothing
anywhere held an asset placed in service and disposed of in the same tax year,
so the whole branch was decoration. The leaf added for it carries controls a
year either side, because a check that refused every disposal would have passed
a one-sided assertion.

**#34 — the ROUNDING ORDER, and it is the subtlest.** Applying the disposal
decimal after rounding the full year, rather than folding it into the exact
rational before the single `halfUp`, is a real and plausible implementation. The
first version of the macrs leaf claimed to catch it and did not: the amounts
chosen happened to agree under both orders, and the comment justifying them was
wrong about why (it reasoned about truncating bigint division, which is not what
the mutation does). Two amounts that genuinely diverge replaced them —
$1,002.00 of 7-year property under the half-year convention (8,762 against
8,763) and $1,001.00 of residential rental under mid-month, where the fraction
is 19/24 rather than 1/2 (2,881 against 2,882), so the property is not about
halving in particular.

**#46 — the earned income credit's wiring.** `fjs/schedule/eic` proves the
subtraction; nothing said whether `fjs/form1040/core` ever hands the figure
over. The leaf added for it is a differential at the same amount on the same
printed line: a $19,038.45 §1231 gain keeps the credit and a $19,038.45 STOCK
gain loses it outright. See §10 for why that line existed to be wired at all.

**#42 — the provenance path.** Erasing the asset's name from every citation's
`boxPath` was green across the entire suite. `sources.length` counts citations;
it says nothing about whether any of them points somewhere a reader can go. The
leaf added for it hand-types all five `(documentHash, boxPath, value)` triples,
and two of the fixtures deliberately share a sale price so that the path is the
only thing that can tell them apart.

### The equivalent mutant, and the three that did not compile

**#37 is a genuine equivalent mutant**: `line26gCents` is a structural zero for
every property this engine can hold, so deleting the term from line 31 cannot
turn red at any input. It is recorded at the site rather than removed, because
it is the printed sum and because the day an accelerated §1250 class becomes
representable the term must already be there.

Three mutations were rejected by `tsc` rather than by the suite, and each was
re-run in a semantically identical compiling form, per AGENTS.md:

- **#15** — `if (section === undefined) { return refusal }` weakened to a
  never-true condition is `TS2345`: the narrowing is load-bearing at the type
  level, because `partIIIProperty` takes `'section1245' | 'section1250'` and
  cannot be handed `undefined`. Re-run as `sectionOfClassification` returning
  `'section1245'` for a straddling class, it reddens 2.
- **#21** — dropping `isGain` from `longTermCapitalGainCents` orphans the
  binding (`TS6133`). Re-run as `isGain || line7Cents < 0n`, it reddens 1.
- **#32** — `disposal === undefined ? undefined : { ... }` forced to `undefined`
  narrows the block's type to `never` and `TS2339`s on every field read. Re-run
  as a description comparison that is false for every fixture, it reddens **24**
  — the largest red set of the whole sweep, which is the right shape for the one
  fact this whole phase adds to the dialect.

**#43 is the most interesting non-result.** Deleting `otherGainsOrLosses` from
`modeledKinds` does not reach the test runner at all: `_EveryKindIsEitherModeled\
OrRefused` is a `tsc`-level assertion and the build stops with `TS2344`. The
partition is enforced by the compiler, not by a proof, which is exactly what
that typedef exists to say.

---

## 10. What this phase INVALIDATED, and the one that mattered

A phase is not finished when its own gates go green. Three places in this
repository said, in prose, that Form 4797 does not exist. Two were remedies; one
was arithmetic.

```
grep -rn "Form 4797" fjs .planning
```

- **`fjs/document/k1_1065` box 10 and `fjs/document/k1_1120s` box 9** both read
  *"`otherGainsOrLosses` is an `fjs/return/scope` refusal"*. It is modeled now.
  Both remedies were rewritten to name what is ACTUALLY missing, which is
  narrower and more useful than what they said: the form exists, and what a
  partner's distributive share lacks is a route into its Part I, because this
  engine builds printed lines 2 and 10 exclusively from register disposals that
  carry a basis, a method and a placed-in-service date. i4797 p6's line 7
  instruction — *"enter any amounts from your Schedule K-1 (Form 1065), box 10,
  in Part I of Form 4797"* — says the share enters as a line 2 row of its own,
  and §469 stands behind it for a limited partner's loss.
- **`fjs/schedule/eic` was WRONG, not merely stale.** Publication 596
  Worksheet 1 line 6 is *"Enter any gain from Form 4797, line 7"* and line 7 is
  *"Subtract line 6 of this worksheet from line 5"*. That subtraction had been a
  documented zero because Form 4797 did not exist. It exists now, and its §1231
  gain arrives on 1040 line 7a through Schedule D line 11 exactly as a stock
  sale does — so leaving line 6 out **overstates §32(i) disqualified income**.
  §32(i)(1) is a cliff at $11,950.00, so the consequence is not an approximation:
  it is the earned income credit denied outright to a working parent who sold a
  machine. The one credit in this engine whose whole purpose is to reach
  low-income filers, failing in the direction that costs them money.

**The general lesson is the second one's.** A refusal's neighbours accumulate
sentences of the form "and this engine models no X". Every one of those becomes
false the day X ships, and the ones that are merely stale are harmless while the
ones that are ARITHMETIC are not. Neither `tsc` nor any proof can distinguish
them, because a documented zero that has become wrong is still a zero. Grepping
for the FORM NAME — not for the kind, not for the module — is what found it,
and it should be the last step of any phase that makes something exist.
