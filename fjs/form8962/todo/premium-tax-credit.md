# Form 8962 — the Premium Tax Credit, and the two lines it reaches

Sources, fetched and read directly rather than recalled:

- `https://www.irs.gov/pub/irs-pdf/f8962.pdf` — Form 8962 (2025), "Created 3/25/25".
- `https://www.irs.gov/pub/irs-pdf/i8962.pdf` — Instructions for Form 8962 (2025).
- `https://www.irs.gov/pub/irs-pdf/f1095a.pdf` — Form 1095-A (2025), "Created 6/5/25".
- `https://www.irs.gov/pub/irs-pdf/f1040s2.pdf` — Schedule 2 (Form 1040) 2025, "Created 5/8/25".
- `https://www.irs.gov/pub/irs-drop/rp-24-40.pdf` — Rev. Proc. 2024-40 §2.07.
- `https://www.federalregister.gov/api/v1/documents.json` — 89 FR 2961 confirmed live, HHS,
  "Annual Update of the HHS Poverty Guidelines", published 2024-01-17.

## The brief said three lines. There are TWO, and the third is a different form's

The task this slice was handed named three refused kinds and three destinations:

| kind | claimed destination |
|---|---|
| `netPremiumTaxCredit` | Schedule 3 line 9 -> 1040 line 31 |
| `advancePremiumTaxCreditAndOtherRepayments` | Schedule 2 line 1a-1z -> 1040 line 17 |
| `premiumTaxCreditReconciliation` | Schedule 2 line 19 -> 1040 line 23 |

**The third destination does not exist.** Schedule 2 (Form 1040) 2025 line 19 reads, in
full: *"Recapture of net EPE from Form 4255, line 1d, column (l)"*. It is an elective
payment election recapture and has nothing to do with Form 8962. The refusal row in
`fjs/return/scope` describing it as "reconciliation of the premium tax credit and excess
advance payment recapture" with the remedy "requires Form 8962" is a Phase 23 mis-mapping,
and `fjs/schedule/2`'s own `line19` rule string carried the same error.

Form 8962 reaches Form 1040 at exactly two places, and the printed form says so on its own
face:

- line 26 (net PTC) -> **Schedule 3 line 9** -> 1040 line 31.
- line 29 (excess advance PTC repayment) -> **Schedule 2 line 1a** -> 1z -> line 3 -> 1040
  line 17.

So `premiumTaxCreditReconciliation` is **left refused**, with its `line`, `label` and
`remedy` corrected to name Form 4255 — the kind's own NAME is now the only wrong thing
about it, and renaming a frozen `kindVocabulary` entry is a separate decision from wiring
Form 8962. Recorded here rather than silently repaired, because the next reader will
otherwise re-derive the same wrong mapping from the kind's name.

## The two arms are one comparison, so neither can ship alone

Form 8962 line 24 is the PTC allowed; line 25 is the advance paid.

- line 24 > line 25 -> line 26 = 24 - 25, and lines 27-29 are BLANK.
- line 24 < line 25 -> line 26 is BLANK, line 27 = 25 - 24, and line 29 = min(27, 28).
- equal -> line 26 = 0 and lines 27-29 blank.

**They are mutually exclusive by construction.** Wiring Schedule 3 line 9 alone would
compute a correct zero for an over-advanced taxpayer and silently drop the repayment —
understating tax. Wiring Schedule 2 line 1a alone would do the same to an under-advanced
one's refund. One `form8962(...)` execution, two destinations, threaded from
`fjs/form1040/core` the way `foreignTaxCreditLine` and `form8812`'s line14/line27 already
are. That is the answer to "can any of the three be computed without the other two": **no**,
and the two that exist must land in the same commit.

## Part I — the contribution amount

- **line 1, tax family size.** You, your spouse if filing jointly, and your dependents;
  you or your spouse drop out if the 1040's "someone can claim you as a dependent" box is
  checked (i8962 p7 "Line 1").
- **line 2a, modified AGI.** i8962 Worksheet 1-1: 1040 line 11 (AGI) **plus** line 2a
  tax-exempt interest, **plus** Form 2555 lines 45 and 50, **plus** the nontaxable part of
  Social Security benefits (1040 line 6a less line 6b, when 6a exceeds 6b).
  **This is not §219's modified AGI and not §1411's.** The root-level gate that forbids a
  lowercase or mixed-case spelling of that acronym as an identifier anywhere in `fjs/` is what
  keeps the three from collapsing into one shared name.
- **line 2b, dependents' combined modified AGI** — only those dependents *required to file*
  because their income meets the filing threshold. **No document this engine holds reports
  it**, so a return with any dependent REFUSES unless the profile carries the new
  `noDependentIsRequiredToFileAnIncomeTaxReturn` certification.
- **line 3** = 2a + 2b, floored at zero.
- **line 4, the federal poverty line**, by family size and by state group.
  **The 2025 form uses the 2024 guidelines** — i8962 p8, line 4: *"(For 2025, the 2024
  federal poverty lines are used for this purpose and are shown below.)"* Verified against
  the printed Table 1-1/1-2/1-3 figures, which are 89 FR 2961's. Using the 2025 guidelines
  would be the classic error and would move every percentage.
- **line 5** = household income as a percent of the poverty line, via i8962 Worksheet 2:
  if line 3 > 4 x line 4, enter **401**; otherwise divide, multiply by 100 and **drop**
  everything after the decimal point (truncate, never round).
- **line 7, the applicable figure**, from Table 2. The table is §36B(b)(3)(A)(iii)'s
  ARPA/IRA tiers rounded to four decimals, and the tier formula reproduces **all 252
  printed rows exactly** (verified mechanically against the extracted table, zero
  mismatches): 0 below 150%, then linear 0->2.0% over 150-200, 2.0->4.0% over 200-250,
  4.0->6.0% over 250-300, 6.0->8.5% over 300-400, and 8.5% at 400 and above, each row
  rounded half-up to four decimals.
- **line 8a** = round(line 3 x line 7) to the nearest whole DOLLAR. **line 8b** = round(8a
  / 12) to the nearest whole dollar. 12 x line 8b is therefore not line 8a in general,
  which is why the annual and monthly paths give different answers.

## Part II — which path, and the answer to "is monthly required"

**Required, not optional.** i8962 p14 "Line 10": check "Yes" and use line 11 only if, for
each qualified health plan, ALL of

1. enrolled for all 12 months of 2025,
2. the column A enrollment premium is the same every month,
3. the column B SLCSP premium is the same every month.

*"If you were enrolled in a qualified health plan for fewer than 12 months during 2025,
check 'No'."* Otherwise the monthly rows 12-23 are what the form requires. This engine
therefore implements **both** paths and dispatches on the printed test computed from the
transcribed rows — it does not pick one and approximate the other, because column (c) is
line 8a annually and line 8b monthly and the per-month `min(a, d)` cap does not commute
with the annual one.

Columns, both paths: (c) is the contribution amount, (d) = max(b - c, 0), (e) = min(a, d),
line 24 = sum of (e), line 25 = sum of (f).

## Part III — the repayment limitation, and where it does NOT apply

Table 5, i8962 p17, and Rev. Proc. 2024-40 §2.07 (§36B(f)(2)(B)):

| line 5 | Single | any other filing status |
|---|---|---|
| less than 200 | $375 | $750 |
| at least 200, less than 300 | $975 | $1,950 |
| at least 300, less than 400 | $1,625 | $3,250 |
| **400 or more** | **none — line 28 is blank and the whole of line 27 is repaid** |

Two traps, both checked against paper rather than memory:

- **At and above 400% there is NO limitation.** i8962 line 28: *"If your entry on Form
  8962, line 5, is 400 or more, there is no repayment limitation. You must repay the amount
  shown on line 27."* A table that carried a fourth capped row would understate tax for the
  highest-income repayers, who are exactly the ones with the largest excess.
- **Only `single` gets the smaller column.** Rev. Proc. 2024-40 §2.07 spells the column as
  *"unmarried individuals (other than surviving spouses and heads of household)"*, so
  qualifying surviving spouse and head of household take the LARGER figure. This is the
  opposite direction from `additionalMedicareTaxThreshold`, where QSS takes the smaller.

Note that the subsidy cliff is repealed for 2025: line 5 above 400 still yields an
applicable figure (8.5%) and therefore still yields a credit. The limitation table and the
applicable-figure table disagree about what 400% means, and both are transcribed as printed.

## Column B is not always transcribable, and then this engine REFUSES

i8962 p14, "Missing or incorrect SLCSP premium on Form 1095-A": if no APTC was paid, or the
coverage family changed without being reported, column B *"may be wrong, left blank, or
reported as -0-"*, and the correct figure must be looked up in Pub. 974 or at
HealthCare.gov/Tax-Tool/. **This engine cannot perform that lookup, and a zero in column
(b) sets column (d) to zero and the whole month's credit to zero.** So: a month whose
column A is present and positive while column B is absent or zero **refuses by name**,
saying which month and that the amount would have gone to Schedule 3 line 9 / Schedule 2
line 1a. A month with no coverage at all — A, B and C all absent or zero — is not a refusal
and contributes nothing.

The mirror case refuses too: **column C positive while column A is absent or zero** means
the policy was terminated for non-payment (f1095a p2, column C), and whether any credit is
allowed for that month turns on whether the premiums were paid by the return's due date —
a fact no stored document reports.

## Every refusal this slice adds

| # | condition | why it cannot be computed |
|---|---|---|
| R1 | more than one Form 1095-A stored | i8962's column B rules for multiple forms are per-situation (same state: take ONE form's column B, do not add; different states: add) and nothing stored says which situation holds |
| R2 | filing status is married filing separately | §36B(c)(1)(C): not an applicable taxpayer unless Exception 1 (domestic abuse) or Exception 2 (spousal abandonment) applies, and both are Form 8962 line A certifications no document reports |
| R3 | `federalPovertyLineTable` absent from the profile | line 4's own printed checkbox; residence in Alaska or Hawaii moves the poverty line by up to 25% |
| R4 | `dependentCount > 0` without the new certification | line 2b, above |
| R5 | the 1095-A's VOID box is checked | f1095a p2: *"Don't use the information on this ... Form 1095-A to figure your premium tax credit"* |
| R6 | Part II covered individuals outnumber the tax family | Part IV allocation of policy amounts, which this engine does not model |
| R7 | a month with column A > 0 and column B absent or zero | the SLCSP lookup, above |
| R8 | a month with column C > 0 and column A absent or zero | termination for non-payment, above |
| R9 | line 5 below 100 | §36B(c)(1)(A); the two escapes (the Marketplace's own enrollment-time estimate, and lawful presence with Medicaid ineligibility) are facts no document reports |

Fewer covered individuals than the tax family is NOT a refusal: a family member on employer
coverage is simply not on the policy, and column B is already the coverage family's.

## Two new fields on `vnd.fjs.return_profile`

Both are taxpayer statements no information return carries, which is the same footing as
`itemizeEvenThoughLessThanStandardDeduction` and
`movingExpensesArmedForcesPermanentChangeOfStation`:

- `federalPovertyLineTable` — one of `contiguous48AndDistrictOfColumbia`, `alaska`,
  `hawaii`. A three-way choice, so a vocabulary-checked string rather than `option(true)`,
  following the §32 fact fields' own precedent. i8962 line 4 also says that a filer who
  moved, or a joint filer whose spouses lived in different states, uses the table with the
  HIGHER amounts — which is why this is a declaration of which TABLE applies rather than of
  a state.
- `noDependentIsRequiredToFileAnIncomeTaxReturn` — `option(true)`, DOC-12. Absent means not
  certified, and a return with dependents then refuses rather than assuming line 2b is zero.

## What is deliberately NOT modeled

Part IV (allocation of policy amounts), Part V (the alternative calculation for year of
marriage), the QSEHRA reduction, the self-employed health insurance deduction's iterative
interaction with the PTC (Pub. 974) — that last one is safe only while
`selfEmployedHealthInsuranceDeduction` is itself a refused kind, and this file is where
that dependency is written down. If that kind is ever modeled, §162(l)/§36B become
circular and this module must refuse or iterate.

## What was reclassified, and what was not

`kindVocabulary` moves 115 -> 117, `modeledKinds` 47 -> 49, `unmodeledKindRefusals` 68 -> 68.

**The coarse `advancePremiumTaxCreditAndOtherRepayments` is SPLIT into three**, the way
`scheduleTwoTaxes` was split in Phase 23 and `rentalRealEstateRoyaltiesPartnershipsSCorps` in
Phase 30. Schedule 2 line 1's lettered sub-lines are three unrelated things a taxpayer can
truthfully declare having, and Form 8962 reaches exactly one of them:

| new kind | printed line | status |
|---|---|---|
| `excessAdvancePremiumTaxCreditRepayment` | Schedule 2 line 1a | **modeled** — Form 8962 line 29 |
| `cleanVehicleCreditRepayment` | Schedule 2 lines 1b, 1c | refused — Form 8936 Schedule A |
| `electivePaymentElectionRecapture` | Schedule 2 lines 1d-1f **and line 19** | refused — Form 4255 |

Splitting rather than simply reclassifying the coarse kind is not tidiness. **Nothing stored
distinguishes line 1a from lines 1b-1f**, so a coarse kind that became modeled would have handed
a taxpayer who transferred a clean vehicle credit to a dealer a silent zero for a repayment they
owe, while telling them the kind was in scope. The engine has no observable fact to refuse on,
which is precisely the difference from `foreignTaxCredit`, whose un-modelable sub-case IS
observable (a stored foreign-tax box above the §904(j)(2)(B) ceiling) and refuses at the line.

`netPremiumTaxCredit` is reclassified unchanged.

**`premiumTaxCreditReconciliation` is LEFT REFUSED with a corrected remedy**, per the finding at
the top of this file. Form 8962 arriving does not make Form 4255's net EPE recapture computable,
and its `line`/`label`/`remedy` are corrected to say what Schedule 2 line 19 actually is. The
kind's NAME remains wrong; renaming a member of the frozen vocabulary invalidates every stored
profile declaring it, and that is a decision to take on purpose rather than as a side effect of
wiring a form. The old remedy also named "Forms 8936 and 3800" for the line 1 sub-lines — **Form
3800 is the general business credit; the recapture is Form 4255**, which the printed Schedule 2
names at all four of its own lines. Corrected.
