# The asset register and Form 4562 — Depreciation and Amortization

Spec written before the code, per AGENTS.md. Sources fetched and read directly
(2026-08-18), never from recall:

- `https://www.irs.gov/pub/irs-pdf/f4562.pdf` — the 2025 form, Cat. No. 12906N,
  "Created 10/9/25".
- `https://www.irs.gov/pub/irs-pdf/i4562.pdf` — the 2025 instructions.
- `https://www.irs.gov/pub/irs-pdf/p946.pdf` — Publication 946 (2025), *How To
  Depreciate Property*, whose Appendix A carries the optional percentage
  tables.

## 1. Why a new dialect at all

Four refusals in this engine name the same missing thing — a per-asset basis,
method and placed-in-service history:

| Site | Kind / line | What it says today |
|---|---|---|
| `fjs/return/scope` :865 | `amtDepreciation` (Form 6251 line 2l) | "a per-asset basis, method and placed-in-service date this engine holds for nothing" |
| `fjs/return/scope` :742 | `rentalRealEstateAndRoyalties` (Schedule E Part I) | "a depreciation figure from Form 4562 — the same asset basis history Schedule C line 13 already refuses for" |
| `fjs/schedule/c` :322 | expense category `depreciationAndSection179` (Schedule C line 13) | "requires Form 4562 and an asset basis history across years" |
| `fjs/schedule/c` :309 | expense category `carAndTruck` (Schedule C line 9) | "the actual-expense method needs Part IV … and, for a vehicle placed in service this year, Form 4562" |

Two more name it outside `fjs/return/scope`: `fjs/schedule/e` line 28(i) (the
K-1 §179 deduction) and the `box11Section179Deduction` /
`box12Section179Deduction` refusals on the two Schedule K-1 dialects.

`vnd.fjs.business_expenses` records Schedule C **line totals**. There is no
information return for depreciation: no payer files one, nothing arrives in the
mail shaped like Form 4562. So the register is a **taxpayer-asserted** dialect,
the same category as `vnd.fjs.business_expenses`, `vnd.fjs.medical_expenses`
and `vnd.fjs.adjustments`.

## 2. What the dialect carries, field by field, with the paper citation

Register level:

| Field | Paper | Why |
|---|---|---|
| `recipientTin`, `taxYear`, `corrected` | DOC-01/DOC-12 | the shared subject key |
| `accountNumber` | — | one register is one **business or activity**, the same cardinality decision `vnd.fjs.business_expenses` makes; the value is the business identifier it must MATCH |
| `businessOrActivity` | f4562 page 1 header, *"Business or activity to which this form relates"* | a separate Form 4562 is filed per business or activity (i4562 p1: *"File a separate Form 4562 for each business or activity on your return for which Form 4562 is required"*) |
| `everyDepreciableAssetIsListed` | i4562 p11, mid-quarter convention | the convention turns on an **aggregate** of the whole year's additions; see §5 |
| `noDepreciablePropertyDisposedOfDuringTheYear` | i4562 p11 Step 3 (disposal column), f4562 line 19 col (g) | a disposal needs the disposal decimal AND §1245/§1250 recapture on Form 4797, which this engine does not model — **SUPERSEDED**, see below |
| `priorYearSection179CarryoverIsZero` | f4562 line 10, *"Carryover of disallowed deduction from line 13 of your 2024 Form 4562"* | a prior-year figure; see §4 |
| `assets` | f4562 lines 6, 19, 20, 26, 27 | the register itself |

Per asset:

| Field | Paper | Notes |
|---|---|---|
| `description` | f4562 line 6 col (a) *"Description of property"*; Part V col (a) | free text |
| `datePlacedInService` | f4562 line 19 col (b) *"Month and year placed in service"* | `YYYY-MM`. The printed column asks for **month and year**, not a day — no convention reads a day |
| `costOrOtherBasis` | f4562 Part V col (d) *"Cost or other basis"*; Part I line 6 col (b) *"Cost (business use only)"* | decimal string cents |
| `businessUsePercentage` | f4562 Part V col (c) *"Business/investment use percentage"*; i4562 p10 col (c) *"multiply the cost or other basis … by the percentage of business/investment use"* | decimal string, `0 < p ≤ 100` |
| `classification` | f4562 lines 19a-19j col (a) *"Classification of property"* | frozen vocabulary; see §6 |
| `method` | f4562 line 19 col (f); i4562 p11 *"Enter '200 DB' … '150 DB' … or 'S/L'"* | `200DB` / `150DB` / `SL`. It is an **election** (i4562 p11: *"you can make an irrevocable election to use the straight line method"*), so it is stored, and validated against what the classification permits |
| `convention` | f4562 line 19 col (e) | `HY` / `MQ` / `MM`. **Not** an election — see §5 for why it is stored anyway and cross-checked rather than trusted |
| `section168kStatus` | i4562 pp5-7, "Part II. Special Depreciation Allowance" | `allowanceClaimed` / `electedOut` / `notQualifiedProperty`; see §4 |
| `specialDepreciationAllowanceClaimed` | f4562 line 14 | required exactly when `section168kStatus` is `allowanceClaimed`; permitted only for a **prior-year** asset |
| `section179ElectedCost` | f4562 line 6 col (c) *"Elected cost"* | present and non-zero REFUSES; see §4 |
| `listedProperty` | f4562 Part V | present REFUSES; see §4 |

### Prior-year accumulated depreciation is NOT carried, and that is a finding

The obvious design carries each asset's accumulated depreciation. It is not
needed, and Pub. 946 says why in Table A-1's own header: *"Multiply your
property's unadjusted basis each year by the percentage."* The percentage for
year *n* is fully determined by the classification, the method, the convention
and the month placed in service — so the current year's deduction is a function
of the **unadjusted** basis and the elapsed years, never of what was actually
deducted. i4562 p11 Step 2's alternative phrasing ("basis for depreciation
reduced by all prior years' depreciation") is the same schedule expressed
recursively, and the engine reconstructs those prior years from the same rule.

What *is* required from the past is the part that is **not** derivable: how much
of the basis §179 and §168(k) removed in the placed-in-service year. Those are
printed figures on the taxpayer's own earlier Form 4562, which is exactly the
transcription `vnd.fjs.prior_year_ira_basis` already does for Form 8606 line 14.

## 3. MACRS: derived, not transcribed — and the four cells where the printed
   table disagrees with itself

i4562 p11, column (g): *"you may use optional Tables A through E … **Or, you may
compute the deduction yourself by completing the following steps.**"* The steps
are the whole rule:

- **Step 1.** *"If you are using the 200% or 150% declining balance method …
  divide the declining balance rate (use 2.00 for 200 DB or 1.50 for 150 DB) by
  the number of years in the recovery period … You must switch to the straight
  line rate in the first year that the straight line rate exceeds the declining
  balance rate. If you are using the straight line method, divide 1.00 by the
  remaining number of years in the recovery period as of the beginning of the
  tax year (but not less than 1)."*
- **Step 2.** *"Multiply the percentage rate determined in Step 1 by the
  property's unrecovered basis."*
- **Step 3.** *"For property placed in service … during the current tax year,
  multiply the result from Step 2 by the applicable decimal amount"* — HY 0.5;
  MQ 0.875 / 0.625 / 0.375 / 0.125; MM 0.9583 … 0.0417 (i4562 p12).

Run that with the intermediate **carried forward at the table's own printed
precision** and it reproduces Publication 946's Appendix A almost exactly.
Measured, cell by cell, against the printed rows hand-typed into
`fjs/form4562/macrs`'s proof:

| Printed table | Cells checked | Reproduced | Not reproduced |
|---|---|---|---|
| A-1 (half-year, 3/5/7/10/15/20-year) | 66 | 66 | 0 |
| A-2 (mid-quarter, 1st quarter) | 66 | 64 | 20-year years 2 and 21 |
| A-3 (mid-quarter, 2nd quarter) | 66 | 64 | 7-year years 1 and 8 |
| A-4 (mid-quarter, 3rd quarter) | 66 | 66 | 0 |
| A-5 (mid-quarter, 4th quarter) | 66 | 66 | 0 |
| A-6 (residential rental, 27.5-year mid-month) — months 1, 6, 7, 12 | 114 | 114 | 0 |
| **A-1 … A-6 total** | **444** | **440** | **4** |

**Each of the four is a printed table contradicting its own next row**, which is
why the derivation is what ships and the printed cell is what is recorded as
the exception:

- **A-2, 20-year, year 2.** Printed `7.000`. After year 1's `6.563`, `93.437 ×
  0.075 = 7.00778` → `7.008`. The printed year 3 is `6.482`, and `6.482` is what
  `100 − 6.563 − 7.008 = 86.429` yields (`× 0.075 = 6.4822`); a remaining
  `86.437` yields `6.4828` → `6.483`. So the printed column's own year 3 agrees
  with `7.008`, not with `7.000`. The 0.008 reappears at year 21 (`0.565`
  printed against `0.557` derived) because the last row is the residual.
- **A-3, 7-year, year 1.** Printed `17.85`. `2/7 × 5/8 = 17.857142…%`, which is
  not a tie and rounds half-up to `17.86`. The 0.01 reappears at year 8
  (`3.34` printed against `3.33` derived), again as the residual.

- **Table A-7a (39-year nonresidential real, mid-month) is a systematic
  difference, not a stray cell**, and it is recorded rather than reproduced.
  Printed year 1, month 1 is `2.461%`; the formula gives `(11.5/12)/39 =
  2.45726%` → `2.457`. Every month is `0.107 + (12 − m) × 0.214`, i.e. the
  table accumulates the **rounded** monthly increment `1/12/39 = 0.21368% →
  0.214` from the rounded twelfth-month value, rather than rounding the exact
  value. Years 2-39 (`2.564`) agree. The derived column still sums to exactly
  100% (`2.457 + 38 × 2.564 + 0.111`), so this engine takes the derived value
  and says so at the site. Both are permitted: the tables are *optional*, the
  Steps are the alternative the same page offers.

So: **no MACRS table is stored.** The stored parameters are the eight
classifications' recovery periods and the printed precision of each
(Publication 946 prints 3-, 5-, 7-, 10- and 15-year property to two decimals of
a percent and 20-year and real property to three), and the proof checks 444
hand-typed printed cells against them.

## 4. What computes, and what refuses, part by part

| Part | Verdict | Why |
|---|---|---|
| **I — §179 election (lines 1-13)** | lines 1-5 compute; a non-zero elected cost **REFUSES** | line 11's business income limitation is *"the smaller of line 5 or the total taxable income from any trade or business you actively conducted"* plus wages, and line 13 carries the disallowed part forward to a year this engine cannot store. With no election, lines 8 and 9 are zero and line 10 is zero by the register's own assertion, so line 12 is `0` **without** line 11 — line 11 is "not less than zero", so `min(0, line11) = 0`. That is a structural argument, not an approximation, and it is why lines 1-5 are still worth computing: the $2,500,000 ceiling and the $4,000,000 phase-down are what a filer needs to see |
| **II — line 14 special depreciation allowance** | **REFUSES** unless every current-year asset elected out or is not qualified property | the applicable percentage is 100% for qualified property acquired after 19 Jan 2025, 40% (60% for a long production period or certain aircraft) for property acquired after 27 Sep 2017 and before 20 Jan 2025, 50% for reuse-and-recycling property — and it turns on the **acquisition** date, not the placed-in-service date, on the long-production-period test, and on six exclusions (i4562 p7). This register carries none of that, and reading the allowance as zero UNDERSTATES the deduction |
| **II — line 15 (§168(f)(1))**, **line 16 (other, incl. ACRS)** | documented zeros | neither is representable: `classification` admits only the eight MACRS classes, and an asset placed in service before MACRS refuses at the dialect |
| **III-A — line 17** | **COMPUTES** | i4562 p9: *"For tangible property placed in service in tax years beginning before 2025 … enter the deductions for the current year. To figure the deductions, see the instructions for line 19, column (g)."* Same rule, later row of the same schedule |
| **III-A — line 18 (general asset accounts)** | not elected | an election with no representation here |
| **III-B — lines 19a-19j** | **COMPUTE** | §3 above |
| **III-C — lines 20a-20e (ADS)** | not representable | ADS recovery periods come from Pub. 946's Table of Class Lives and Recovery Periods, and every mandatory ADS trigger (tax-exempt use, predominantly foreign use, an electing real property trade or business) is a fact no dialect here carries. An ADS asset cannot be spelled |
| **IV — line 21, V — lines 24-29 (listed property)** | **REFUSES** | line 24a asks *"Do you have evidence to support the business/investment use claimed?"* and 24b *"is the evidence written?"* — §274(d) substantiation this engine cannot check — and §280F caps a passenger automobile's depreciation at a per-year dollar table and forces ADS S/L below 50% qualified business use |
| **IV — line 22** | **COMPUTES** | *"Add amounts from line 12, lines 14 through 17, lines 19 and 20 in column (g), and line 21"* |
| **IV — lines 23a/23b (§263A)** | documented zeros, not summands | informational; the register carries no capitalized-cost facts |

## 5. The mid-quarter convention, and what to do when completeness is not
   certifiable

i4562 p11: *"If the total depreciable bases (before any special depreciation
allowance) of MACRS property placed in service during the last 3 months of your
tax year exceed 40% of the total depreciable bases of MACRS property placed in
service during the entire tax year, the mid-quarter … convention generally
applies."* Excluded from the test: property depreciated under a non-MACRS
method, residential rental / nonresidential real / railroad gradings, and
property placed in service and disposed of in the same year.

That is an **aggregate over the whole year's additions**. A register that is
missing one $80,000 machine bought in November can flip the answer for every
other asset in the register, in either direction, and nothing in the data says
so. So:

1. The register must carry `everyDepreciableAssetIsListed`. Absent, Form 4562
   **refuses** as soon as any asset was placed in service in the computed year.
   (An `option(true)` under DOC-12's checkbox convention, so a materialized
   `false` cannot pass as an assertion.)
2. With it, the engine **computes** the test itself and compares the answer
   against each current-year asset's stored `convention`, refusing on
   disagreement and quoting both. The stored value is never the source of the
   answer — it is a cross-check, which is the only role a second copy of a
   derivable fact may have.
3. For an asset placed in service in an **earlier** year the convention is
   **transcribed**, because the aggregate that decided it was an aggregate over
   *that* year's additions, and a register of assets still held cannot
   reconstruct a year in which something was bought and later sold. Only the
   mid-month classes are cross-checked there (they are MM by law, whatever the
   aggregate said).

## 6. The classification vocabulary

Eight, matching printed lines 19a-19f, 19i and 19j. Recovery period and
permitted methods from i4562 pp10-11:

| `classification` | printed line | recovery | permitted `method` | `convention` |
|---|---|---|---|---|
| `threeYear` | 19a | 3 | 200DB, 150DB, SL | HY or MQ |
| `fiveYear` | 19b | 5 | 200DB, 150DB, SL | HY or MQ |
| `sevenYear` | 19c | 7 | 200DB, 150DB, SL | HY or MQ |
| `tenYear` | 19d | 10 | 200DB, 150DB, SL | HY or MQ |
| `fifteenYear` | 19e | 15 | 150DB, SL | HY or MQ |
| `twentyYear` | 19f | 20 | 150DB, SL | HY or MQ |
| `residentialRental` | 19i | 27.5 | SL | MM |
| `nonresidentialReal` | 19j | 39 | SL | MM |

25-year water utility property (19g) and 50-year railroad gradings (19h) are
deliberately **absent**: Publication 946 prints no percentage table for either,
so there would be nothing to check a derived column against. An asset naming
one is refused by name at the dialect, which is the honest outcome.

## 7. Form 6251 line 2l — the AMT depreciation adjustment

§56(a)(1)(A)(ii), as amended by TRA'97 §1120 for property placed in service
after 1998: property depreciated for the regular tax under the 200% declining
balance method is depreciated for the AMT under the **150% declining balance
method over the same recovery period**. Real property under the straight line
method has no adjustment at all. The adjustment is regular minus AMT, and it
can be negative in the later years of an asset's life — which is why
`fjs/form6251` line 2j is already documented as un-floored, and this line is
not floored either.

Two printed cautions switch the adjustment off entirely, and both are in i4562
p7:

- *"If you take the special depreciation allowance … you will not have any AMT
  adjustment for depreciation for the qualified property."*
- *"Note: If you elect to not have any special depreciation allowance apply, the
  property placed in service during the tax year will not be subject to an AMT
  adjustment for depreciation."*

Neither is derivable from a basis and a date, which is exactly why
`section168kStatus` is a stored, frozen three-value vocabulary rather than
something inferred: it is a legal status about the placed-in-service year, in
the shape `vnd.fjs.business_expenses`' `specifiedServiceTradeOrBusiness`
already uses.

Because §56(a)(1) used the ADS class life rather than the GDS recovery period
for property placed in service before 1999, a `200DB` asset that old is
**refused** rather than adjusted.

## 8. Which kinds move, and which do not

- **`amtDepreciation` → modeled.** Wired to Form 6251 line 2l in the same
  commit, through `fjs/schedule/2`. Everything it needs is now present and
  every part it cannot compute refuses before it can contribute a wrong number.
- **`businessIncomeOrLoss`** was already modeled; Schedule C line 13 stops
  being an unconditional refusal, and both the category refusal and the kind's
  remedy prose are corrected.
- **`rentalRealEstateAndRoyalties` stays REFUSED, with a corrected remedy.**
  The depreciation half of its blocker is gone; the rest is not. Schedule E
  Part I still needs the rents received (no dialect carries them), the fair
  rental and personal-use **days** §280A(e) allocates by, and its own printed
  line 4 for royalties. A register alone does not make a Schedule E.

  **SUPERSEDED.** `vnd.fjs.rental_property` carries all three, and
  `fjs/schedule/e/part_i` computes printed Part I; the kind moved to
  `modeledKinds`, and a rental register's Form 4562 line 22 now reaches printed
  Schedule E line 18 through the `accountNumber` match this document describes
  for Schedule C. See
  [../../schedule/e/todo/schedule-e-part-i-rental-and-royalties.md](../../schedule/e/todo/schedule-e-part-i-rental-and-royalties.md).
  Left in place rather than rewritten: this file records what the Form 4562
  phase decided with what it had, and the note is the correction.
- **`noDepreciablePropertyDisposedOfDuringTheYear` is NARROWED, not retired.**

  **SUPERSEDED.** Both halves of its reason now exist: `fjs/form4562/macrs`'s
  `disposalTwentyFourths` is i4562 p11 Step 3's second printed decimal column,
  and `fjs/form4797` is the §1245/§1250 recapture. A register may now carry a
  per-asset `disposal` block, and `fjs/form4562` requires the certification only
  when NO asset carries one — the shape `everyDepreciableAssetIsListed` already
  had. A register carrying both refuses at the dialect.

  It is a NARROWING rather than a retirement because five disposals still cannot
  be characterized and each refuses by name: 15- and 20-year property (the class
  straddles §1245 and §1250), business use below 100%, an asset placed in
  service and sold inside one tax year, a register bound to a farm, and a §1231
  gain with no return-profile certification of the five-year lookback. See
  [../../form4797/todo/sales-of-business-property.md](../../form4797/todo/sales-of-business-property.md).

  Left in place above rather than rewritten: this file records what the Form
  4562 phase decided with what it had, and this note is the correction.
- **`carAndTruck` (Schedule C line 9) stays REFUSED, with a corrected remedy.**
  A vehicle is listed property, and Part V refuses.
- The two Schedule K-1 §179 boxes and Schedule E line 28(i) stay refused: a
  partner's §179 deduction is subject to the partner's OWN business income
  limitation on this Form 4562's line 11, which is the line Part I refuses at.

## 9. The mutation log

AGENTS.md: *"A proof is not known to work until you have watched it fail."*
Thirty-two mutations were written and run against the committed tree, one at a
time, each reverted before the next and each checked with
`git diff --numstat` for exactly one insertion and one deletion.

**One did not compile.** `asset.convention !== expected` weakened to
`&& asset.convention === 'ZZ'` is `TS2367` — `convention` is narrowed to
`'HY' | 'MQ' | 'MM'` at that point and has no overlap with `'ZZ'`. Re-run in a
semantically identical compiling form (`&& asset.description === 'no such
asset'`), it reddens 1 leaf. The same `'ZZ'` trick DOES compile inside
`fjs/document/asset_register`, where the field is still a bare `string`.

**One survived**, and it is the one worth recording:
`businessUseHundredthsOfPercent: percentFromString(...)` forced to a flat
`10000n` — 100% business use — left the entire suite green. Every fixture in
this repository used 100.00% business use, a June placed-in-service month and
the current tax year, so **three of the five facts `depreciableAssets`
extracts were unobservable**. `aPartialBusinessUseAndAPriorYearAssetBothTravel`
and its control were added for it: a 60%-business November asset (mid-quarter,
Table A-5) beside a March 2022 five-year asset (half-year, Table A-1, recovery
year 4). All three mutations now redden — the percentage, the month
(`Number(monthText)` → `6`) and the year (`Number(yearText)` → the register's
own `taxYear`).

| # | Mutation | Leaves red |
|---|---|---|
| 1 | MACRS never switches to straight line | 5 |
| 2 | the first-year convention fraction is ignored | 21 |
| 3 | the recovery year is off by one | 16 |
| 4 | the mid-quarter 40% boundary becomes inclusive | 2 |
| 5 | the last quarter is months 11-12 rather than 10-12 | 1 |
| 6 | real property is NOT excluded from the mid-quarter test | 1 |
| 7 | the basis ignores the claimed §168(k) allowance | 4 |
| 8 | the AMT adjustment ignores `section168kStatus` | 2 |
| 9 | Schedule C line 13 does not receive Form 4562 line 22 | 3 |
| 10 | Form 6251 line 2l back to a hard zero | 1 |
| 11 | **the `vnd.fjs.asset_register` routing branch is deleted** | **1** |
| 12 | the stored-convention cross-check never fires | did not compile; 1 in compiling form |
| 13 | the §179 election no longer refuses | 1 |
| 14 | the completeness certification is not required | 1 |
| 15 | the register's account number is not matched | 1 |
| 16 | **business-use percentage forced to 100%** | **0 — SURVIVED**; 1 after the new leaf |
| 17 | `listedProperty` never travels out of the dialect | 1 |
| 18 | the asset name is erased from the listed-property refusal | 1 |
| 19 | the convention/class agreement check never fires | 1 |
| 20 | a method the class forbids is accepted | 1 |
| 21 | the placed-in-service MONTH is forced to June | 1 |
| 22 | the placed-in-service YEAR is forced to the register's tax year | 1 |
| 23 | line 17 sums current-year assets instead of prior-year | 14 |
| 24 | line 22 drops line 17 | 3 |
| 25 | a current-year §168(k) allowance no longer refuses | 1 |
| 26 | the 200 DB factor becomes 150 DB | 19 |
| 27 | the printed precision is always two decimals | 6 |
| 28 | the register-with-no-business refusal never fires | 1 |
| 29 | the disposal certification is not required | 1 |
| 30 | pre-1999 200 DB property no longer refuses | 1 |

**Mutation 11 is the one this project has been burned by before.** Deleting a
dialect's routing branch in `fjs/report/tax_return` left the whole suite green
for `vnd.fjs.1095a`, because every end-to-end leaf hands `form1040Report` a
`Form1040Inputs` directly. It reddens here, and it reddens exactly one leaf —
`storedProgramRoutesTheAssetRegisterAndDepreciatesScheduleCLineThirteen`, which
is the only proof in the repository that travels through the stored program's
own collect step with a register in the store.

**Mutation 27's six red leaves are the finding behind §3.** Forcing every
column to two decimals of a percent reddens the 444-cell sweep, the Table A-7a
divergence leaf, the whole-basis sweep and three worked deductions — which is
what makes `printedDecimals` a stored parameter with a reader rather than a
comment.
