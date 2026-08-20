# Phase 33 — External Validation Without a Filed Return

**TaxCalcBench, 51 public cases, run against this engine. 2026-08-19.**

> Phase 14's acceptance criterion was *"feed it a year already filed; every 1040 line
> matches."* That criterion is circular for this project's owner, who has no filed
> TY2025 return, because this system exists so that one can be produced. Phase 33
> replaces it with ground truth that needs nothing from the taxpayer.

---

## 0. Headline

| | |
|---|---|
| **Matched** — every graded line equals the benchmark's expected output | **27** |
| **Refused** — the engine returned a named refusal instead of a number | **20** |
| **Diverged** — the engine computed a different number | **2** |
| **Unrunnable** — the case carries a fact no dialect here can receive | **2** |
| | **51** |

The run found **one** genuine defect in this engine, in `fjs/form8959` — it computed
Form 8959 Part V for filers not required to file Form 8959 at all, so ordinary
per-pay-period rounding in Form W-2 box 6 became a phantom $1 credit on 1040 line 25c,
on five of the fifty-one cases. **It is fixed in this branch**, with the proof watched
to fail before it passed and three mutations run against the gate. All five cases flip
to matched, which is the fix's own external check (§5.1).

**Zero unresolved engine defects remain against this ground truth.** The two divergences
left have verdicts *against the benchmark*: one is the benchmark applying §152(c)(1)(D)'s
support test to an EIC qualifying child, which §32(c)(3)(A) removes by name (§5.2), and
one is a $1 whole-dollar rounding-convention difference that i1040gi p23 reads in this
engine's favour (§5.3).

Nothing in the "matched" column is a coincidence of two wrong answers: 27 cases agree
on all twenty graded lines simultaneously, including the tax table's midpoint rule, the
QDCGT worksheet, EIC, CTC/ACTC, the saver's credit, the premium tax credit and Form 8959.

---

## 1. The benchmark, and which half of it this is

`TaxCalcBench` — <https://github.com/column-tax/tax-calc-bench>, paper
<https://arxiv.org/abs/2507.16126>. It ships **two** datasets:

| | cases | inputs | expected output | covers |
|---|---|---|---|---|
| `ty24` | **51** | one `input.json` per case | `output.xml`, IRS MeF `Return` | federal only |
| `ty25` | 50 | PDFs (W-2s, 1099s, a prior-year 1040) | `output.xml` | federal **and** state |

Phase 33's roadmap entry says "51 public cases", which is `ty24`. That is also the
only one runnable here: `ty25`'s inputs are PDFs and its expected outputs include
California, Illinois, New York and Virginia state returns, neither of which this engine
is for. `ty25` is out of scope and is not counted anywhere in this report.

The expected output is an MeF XML `Return`. The benchmark grades **20 Form 1040 lines**,
listed in `tax_calc_bench/tax_return_evaluator.py`'s `LINES_TO_XPATH_VALUES`. This run
adopts that exact set — no more, no fewer — so the score is comparable with the
leaderboard's "correct by line" column:

> 1a, 9, 10, 11, 12, 15, 16, 19, 24, 25d, 26, 27, 28, 29, 32, 33, 34, 35a, 37

A benchmark case counts as **matched** here only if **all twenty** agree. That is the
benchmark's own *strict* criterion, not its lenient one.

### 1.1 The first result was a refusal, and it was the right one

`ty24` is **Tax Year 2024**. This engine's stored parameters are TY2025 and TY2025 only.
Before any 1040 line was computed, `vnd.fjs.return_profile`'s own validator refused all
fifty-one cases at the door:

```
no stored tax parameters for taxYear 2024
```

That is the correct behaviour and it is worth stating first, because it is the whole
thesis of the engine in one line: handed a year it has no parameters for, it says so
rather than computing a TY2025 return and calling it 2024. Had it *not* refused, every
number in this report would have been silently wrong by one year's inflation adjustment
— and would have looked like arithmetic bugs.

To get past it the harness supplies a **hand-transcribed TY2024 parameter set**.

---

## 2. The TY2024 parameter set is part of the harness, not part of the engine

`taxParams2024` is a scratch module. It is not committed to `fjs/`, it carries no proof,
nothing in the repo reads it, and **it is a standing suspect in every divergence below.**
It is built by spreading `taxParamsByYear[2025]` and overriding member by member.

Sources: **Rev. Proc. 2023-34** (the TY2024 inflation-adjustment procedure — note its
adjusted items sit under *"SECTION 3. 2024 ADJUSTED ITEMS"*, so the citations are §3.xx,
not the §2.xx the TY2025 procedure uses), Notice 2023-75, Rev. Proc. 2023-23, 88 FR 3424
(the **2023** HHS poverty guidelines, which are what §36B uses for TY2024), and the 2024
instructions for Schedule SE, Form 8962 and Form 8863.

**22 members overridden, 17 left at their TY2025 values.** Every one of the seventeen is
either statutory and non-indexed (§86(c) base amounts, §213(a)'s 7.5% floor, §3101(b)
thresholds and rates, §904(j)'s 300/600, §1411's threshold and 3.8%, §1256(a)(3)'s
60/40, the four dependent-care members) or was **verified identical** for TY2024
(educator expenses $300; the education-credit MAGI phaseouts, which are §25A(d)(2)
statutory; the premium-tax-credit applicable percentage table, in force 2021–2025 under
ARPA as extended by the IRA). Nothing is unverified.

Two of the overrides were **found by the benchmark itself**, and are the reason a
"transcribe only what looks reachable" shortcut would have produced phantom bugs:

- `federalPovertyLine` — TY2024 Form 8962 uses the **2023** guidelines (14,580 + 5,140),
  not TY2025's 2024 ones. Two cases carry a Form 1095-A.
- `premiumTaxCreditRepaymentLimitation` — genuinely moved (950/1,900 and 1,575/3,150 in
  TY2024 against 975/1,950 and 1,625/3,250 in TY2025). Same two cases.

Before these two landed, `single-w2-healthcare-marketplace-1095a` diverged by $68 on line
24. With them it matches exactly. **That divergence was the harness, not the engine** —
which is the whole reason the triage order in §5 puts the parameter set second.

### 2.1 OBBBA is a third verdict category, and it bit immediately

The TY2025 engine contains provisions that did not exist in TY2024. Two are parameters
and were neutralised:

- **`seniorDeduction`** (OBBBA, P.L. 119-21 §70103) → `0.00`. Left at TY2025 it subtracts
  **$6,000 per eligible filer**; `mfj-dual-w2-over-65`'s taxable income was $12,000 low
  until it was zeroed.
- **`saltCap`** → flat $10,000 with the phasedown rate set to 0 (§164(b)(6) pre-OBBBA).
  The $5,000 MFS cap needs no parameter: `fjs/schedule/a`'s `saltCapWorksheet` halves w9
  for MFS at line w10, so `flatCap = floor = 10,000` yields 5,000 for MFS at every income.
- **`childTaxCredit`** → $2,000 / $500 ODC / $1,700 ACTC cap (OBBBA raised the CTC to
  $2,200).

A divergence caused by *logic* that exists only for TY2025 would be **"year-logic
mismatch — correct for TY2025"**, not an engine bug. In the event, none of the divergences
is of that kind: OBBBA's footprint here turned out to be entirely
parametric.

### 2.2 What the benchmark independently confirms about the transcription

These are recomputed by hand from the transcribed numbers and checked against the
benchmark's own expected outputs. None uses this engine:

| check | value |
|---|---|
| standard deduction, single / MFJ / HOH | 14,600 / 29,200 / 21,900 |
| single, 65 **and** blind | 18,500 = 14,600 + 2 × 1,950 |
| single, 65 | 16,550 = 14,600 + 1,950 |
| MFJ, both 65 **and** both blind | 35,400 = 29,200 + 4 × 1,550 |
| HOH, 65 | 23,850 = 21,900 + 1,950 |
| single, taxable 130,400 → line 16 | 24,339 (worksheet; 1,160 + 4,266 + 11,742.50 + 7,170 = 24,338.50) |
| MFJ, taxable 105,800 → line 16 | 13,382 (2,320 + 8,532 + 2,530) |
| HOH, taxable 26,000 → line 16 | 2,792 (**Tax Table**, band midpoint 26,025: 1,655 + 1,137) |
| EIC maximum, no children | 632 |
| EIC maximum, one child | 4,213 |

The HOH row is the sharp one. A straight bracket computation on 26,000 gives **2,789**;
the benchmark says 2,792, which is only obtainable by looking the income up in the
printed Tax Table and taxing the **midpoint of its $50 band**. `fjs/tax/table` generates
exactly that, from the stored brackets, and got it right on the first run with a set of
brackets it had never seen. That is a non-trivial independent confirmation of TAX-02.

---

## 3. Field-by-field mapping: the benchmark's schema onto our dialects

The benchmark's input is a nested `return_data` object of `{ label, value }` leaves,
organised by IRS form. Ours is a set of `Stored<T>` dialect documents plus a
`vnd.fjs.return_profile`. The mapping actually used:

| benchmark path | our dialect / field | notes |
|---|---|---|
| `w2[]` | `vnd.fjs.w2` → `w2s` | direct, box for box |
| `w2[].employers_use_grp[]` | `w2.box12[]{code,amount}` | **box 12.** The benchmark's key names neither the box nor its IRS caption; see §5.4 |
| `irs1040_scheduleb.irs1099_int[]` | `vnd.fjs.1099int` → `interestForms` | boxes 1, 2, 3, 4, 6, 8, 9 |
| `irs1040_scheduleb.irs1099_div[]` | `vnd.fjs.1099div` → `dividendForms` | boxes 1a–13 |
| `irs1040_schedule1.irs1099_g[]` | `vnd.fjs.1099g` → `unemploymentForms` | boxes 1, 4 |
| `irs1099_r[]` | `vnd.fjs.1099r` → `retirementForms` | boxes 1–7 |
| `ssa_1099.ssa_1099_grp[]` | `vnd.fjs.ssa1099` → `socialSecurityForms` | boxes 4, 5, 6 |
| `irs8949.irs1099_b_grp[].irs1099_b[]` | `vnd.fjs.1099b` → `brokerageForms` | one document per transaction; `input_sale_term` + `input_irs8949_code` → the payer-printed A–F letter and box 12 |
| `irs1040_schedulec[]` | `vnd.fjs.business_expenses` → `businessExpenseForms` | expenses only |
| `irs1040_schedulec[].gross_receipts_cash` | `vnd.fjs.1099nec` box 1 → `nonemployeeCompensationForms` | **there is no gross-receipts field**; Schedule C line 1 arrives only as 1099-NECs |
| `irs1040_schedule1.{tp,sp}_educator_exp_amount` | `vnd.fjs.adjustments` `entries[lineTag='educatorExpenses', individual]` | vocabulary is `taxpayer`/`spouse` |
| `irs1040_schedule1.student_interest` | `vnd.fjs.1098e` box 1 → `studentLoanInterestForms` | |
| `irs8863.…educational_institution_group[].qualified_expenses` | `vnd.fjs.1098t` box 1 → `tuitionForms` | |
| `irs8863.…{academic_period_eligible_student, post_secondary_education, drug_felony_conviction, prior_year_credit_claimed}` | `vnd.fjs.credits` `educationStudents[]` | read the **labels**, not the key names; see §5.4 |
| `w2[].employers_use_grp[]` codes D/E/G/H/S/AA/BB/EE | `vnd.fjs.credits` `saversCreditEligibility[]` | Form 8880 line 2 reads box 12 itself; the dialect supplies only the §25B eligibility facts |
| `irs8962.{annual_premium, annual_premium_slcsp, annual_advanced_ptc}` | `vnd.fjs.1095a` `monthlyCoverage[12]` | **lossy**: the benchmark holds annual totals (boxes 33A/B/C); the engine reads the twelve printed rows, so the harness spreads each annual figure evenly |
| `irs1040.dependent_detail[]` | profile `dependents[]` + `dependentCount` | |
| `irs1040.{tp,sp}_date_of_birth` | profile `taxpayerBornBeforeJan2_1961` etc. | the field is spelled with TY2025's cutoff; the **fact** is "65 or older at year end", so the harness applies TY2024's Jan 2 1960 |
| `irs1040.estimated_tax_payment_1..4` + `applied_from_prior_year` | profile `line26EstimatedTaxPayments` | |
| `irs1040_schedule3.extension_payment` | profile `scheduleThreeLine10AmountPaidWithExtensionRequest` | |
| `irs1040.refund_method` | profile `line35aRefundRequested` | an **election**, not a computation; see §3.2 |
| `w2[].wages` (sum) | profile `earnedIncome` | Schedule 8812 line 18a; kept deliberately separate from §32's EIC earned income |
| `irs1040_scheduleb.foreign_{accounts,trust}_input` | profile `hadForeignFinancialAccount` etc. | |

`declaredKinds` is derived from the documents present. That is the honest mapping: this
engine's model is that the taxpayer declares their own scope, and a benchmark case's
input *is* the taxpayer's statement of what they have.

### 3.1 Dialects the unrunnable cases needed

| benchmark fact | status here | cases |
|---|---|---|
| **Form 1099-K** | **no dialect.** `vnd.fjs.1099k` does not exist; grep finds no reference anywhere in `fjs/`, not even a todo | `single-1099k-personal-payments` |
| **1099-G unemployment repayment** | no field. Form 1099-G prints no repayment box; the benchmark carries it as its own scalar | `mfj-w2-unemployment-1099g-repayments` |

These two are bucketed **unrunnable**, not diverged and not refused, and the distinction
is load-bearing. The harness could not put the income into the engine at all, so any
number the engine produced would be answering a different question. Forcing them through
as partial input would have manufactured "divergences" that say nothing about the engine.

**The Alaska Permanent Fund dividend is a third case and it is NOT one of these.**
`alaskaPermanentFundDividends` is in the 201-name kind vocabulary but not in
`modeledKinds` — so the taxpayer can declare it and be told by name. Declaring it is the
honest mapping, since the benchmark's filer really does have one, and it makes the engine
refuse **before any line computes**:

```
scope refusal: this return declares 1 kind(s) this engine does not model, so no
Form 1040 is produced; alaskaPermanentFundDividends at Schedule 1 line 8g ...
```

That is a named-refusal success, not a coverage hole, and `single-retirement-1099r-alaska-dividend`
is counted under **refused**.

Two further dialect gaps were found but did not make a case unrunnable:

- **Form 1099-MISC** — no dialect. `fjs/return/scope` already refuses prizes and awards
  by name, saying so: *"requires a Form 1099-MISC dialect (box 3), which does not exist
  here (no phase yet)."* The two `1099misc` cases refuse earlier, on Schedule C.
- **1099-INT boxes 5, 10, 11, 12, 13** (bond premium, market discount, investment
  expenses) — no fields on `vnd.fjs.1099int`. Present in the data but zero in every case.

### 3.2 Two harness conventions, stated so they can be argued with

- **Line 34 / 35a / 36 are a taxpayer election, not a computation.** The filer says how
  much of an overpayment to have refunded. The benchmark encodes it as `refund_method`;
  the engine wants the amount. The harness therefore runs a case, reads line 34, and
  re-runs stating that as `line35aRefundRequested`. This feeds no computed line — line
  34 is already fixed before 35a is stated — so a line-35a agreement still means the two
  implementations agree on line 34.
- **Money.** Benchmark amounts are JSON numbers of dollars; all are integers or 2dp and
  well under 2^53, so `toFixed(2)` is exact. They enter the engine as the decimal strings
  the dialects require and become `bigint` cents inside it.
- **Whole dollars.** `wholeDollarElection: true` on every profile, since the expected
  output is whole-dollar MeF XML.

### 3.3 Every mapped document was validated by its own dialect

The harness runs each constructed document through its dialect's own `validate` before
the run. This caught four harness bugs that would otherwise have been read as engine
divergences — an SSA-1099 given a payer TIN (*"payerTin must be the empty string … the
SSA-1099 prints no payer TIN"*), a missing `sourceArtifactHash` on 1099-B and 1099-DIV,
and `specifiedServiceTradeOrBusiness` given a boolean where the dialect stores a
**three-state** string (*"both answers store and absence is neither"*).

After those fixes, the only validation failure left across all 51 cases is the TY2024
one from §1.1.

---

## 4. Per-case results

| case | result | named refusal / dropped fact |
|---|---|---|
| `hoh-multiple-w2-box12-codes` | matched | |
| `hoh-schedule-b-ssa1099-unemployment` | matched | |
| `hoh-w2-1099g-unemployment-schedulec-loss` | refused | Schedule C line 31 is a loss → line 32 at-risk determination |
| `hoh-w2-dependent-care-credit-carryover-no-qualifying-person` | matched | |
| `hoh-w2-dependent-educator-expenses-unemployment` | matched | |
| `mfj-both-blind-nontaxable-social-security` | matched *(after §5.1's fix; diverged before it)* | |
| `mfj-capital-gains-losses-wash-sale-dependent` | refused | Form 8949 — box 1f accrued market discount requires column (f) code D |
| `mfj-dependent-claimed-2441-exclusion` | refused | Schedule C line 12 (Depletion) |
| `mfj-dual-w2-over-65` | matched *(after §5.1's fix; diverged before it)* | |
| `mfj-multiple-1099int-schedule-b-w2` | matched | |
| `mfj-multiple-schedule-c-loss-multi-home-office` | refused | Schedule C is filed per business; this engine models one |
| `mfj-multiple-w2-schedule-c-qbi-income` | refused | Schedule C is filed per business |
| `mfj-multiple-w2-schedule-c-qbi-max-threshold` | refused | Schedule C is filed per business |
| `mfj-multiple-w2s-excess-social-security-tax` | **diverged** (24, 37) | §5.3 |
| `mfj-schedule-2-multiple-w2-excess-social-security-tax` | matched | |
| `mfj-schedule-c-1099-misc-nec-k-ssa-1099-int-g` | refused | Schedule C line 1 — receipts come only from Form 1099-NEC box 1 |
| `mfj-spouse-dependent-schedule-c-w2-student-loan-interest` | refused | Form 8995 line 3 — QBI loss carryforward not stated |
| `mfj-w2-box12-codes` | matched | |
| `mfj-w2-box12-codes-a-b-1099int-schedulec` | refused | Schedule C line 12 (Depletion) |
| `mfj-w2-capital-gains-wash-sales-dividends-dependent` | refused | Form 8949 — box 1f accrued market discount |
| `mfj-w2-multiple-1099g-unemployment-income` | matched | |
| `mfj-w2-schedule-c-loss-multi-home-office` | refused | Schedule C is filed per business |
| `mfj-w2-six-dependents-student-over-17` | refused | Schedule 8812 Part II-B (3+ qualifying children) is not modeled this phase |
| `mfj-w2-unemployment-1099g-repayments` | unrunnable | 1099-G unemployment repayment — no box, no field |
| `mfj-w2s-dependent-estimated-tax-qbi-loss-carryforward` | matched | |
| `single-1099b-long-term-capital-gains-schedule-d` | matched | |
| `single-1099int-interest-income-schedule-b` | matched | |
| `single-1099k-personal-payments` | unrunnable | Form 1099-K — no dialect |
| `single-eic-non-dependent-child` | **diverged** (27, 28, 32, 33, 34, 35a) | §5.2 — **the benchmark is wrong** |
| `single-multiple-w2-excess-social-security-tax` | matched | |
| `single-multiple-w2-excess-social-security-tax-same-ein` | matched | |
| `single-multiple-w2-schedule-c-qbi-losses` | refused | Schedule C is filed per business |
| `single-multiple-w2-state-records` | matched | |
| `single-retirement-1099r-alaska-dividend` | refused | scope refusal — `alaskaPermanentFundDividends` is in the vocabulary, not modeled |
| `single-schedulec-1099misc-nec-k-loss` | refused | Schedule C line 1 |
| `single-senior-blind-over-65` | refused | Schedule C line 31 is a loss → line 32 |
| `single-w2-balance-due-no-state-income-tax` | matched *(after §5.1's fix; diverged before it)* | |
| `single-w2-box12-code-a-b-alaska` | matched | |
| `single-w2-direct-debit-payment` | matched *(after §5.1's fix; diverged before it)* | |
| `single-w2-healthcare-marketplace-1095a` | matched | |
| `single-w2-minimal-wages-alaska` | matched | |
| `single-w2-multiple-1099int-dividend` | matched | |
| `single-w2-multiple-1099int-federal-withholding` | matched | |
| `single-w2-multiple-1099int-withholding-schedule-b` | matched | |
| `single-w2-retirement-sick-pay-social-security-tip` | matched | |
| `single-w2-schedule-c-qbi-dependent-estimated-tax` | refused | Schedule C is filed per business |
| `single-w2-schedule-c-qbi-loss-carryforward` | refused | Schedule C is filed per business |
| `single-w2-schedulec-1099b-capital-loss-carryover` | refused | Schedule C line 31 is a loss → line 32 |
| `single-w2-student-american-opportunity-credit` | refused | Form 8863 line 8 — §25A(i) age-24 / parent-alive facts |
| `single-w2-tips-long-employer-name` | matched | |
| `single-w2-unemployment-1099g` | matched *(after §5.1's fix; diverged before it)* | |

### 4.1 The 20 refusals, grouped by named refusal

**A refusal is not a failure.** Each of these names a printed line and what is missing.

| n | refusal | what it is |
|---|---|---|
| **7** | *"Schedule C is filed PER BUSINESS — 'X' and 'Y' are two Schedule Cs"* | The benchmark case genuinely carries three or four sole proprietorships. `fjs/schedule/c` models one and refuses the second **by name**. The list shape of `businessExpenseForms` exists precisely so it can *see* the second one in order to refuse it. |
| **3** | *"Schedule C line 31 is a LOSS … the printed form's own instruction is 'if a loss, you must go to line 32' — the at-risk determination, which this engine cannot make"* | §465 basis is a multi-year history no document here holds, and `vnd.fjs.business_expenses` carries no field for line 32 or for material participation, so neither §465 nor §469 can be asked. The refusal says all of that and contrasts itself with `vnd.fjs.farm`, which *does* store both answers. |
| **2** | *"Schedule C line 12 (Depletion): … which this engine cannot compute"* | `depletion` is one of the seven `refusedExpenseCategories`. The benchmark case asserts $6,999 of it. |
| **2** | *"Schedule C line 1 (gross receipts or sales) … this engine reads gross receipts from Form 1099-NEC box 1 alone"* | Both cases are 1099-MISC/1099-K gig income with no 1099-NEC behind it. |
| **2** | *"Form 8949: document … carries box1fAccruedMarketDiscount, which requires column (f) code D"* | The benchmark's 1099-B carries accrued market discount without the adjustment code that must accompany it. |
| **1** | *"Form 8995 line 3 (qualified business net loss carryforward from prior years): the business expenses record does not state one"* | §199A(c)(2). The benchmark supplies the carryforward on a different form. |
| **1** | *"Schedule 8812 Part II-B (3+ qualifying children or Puerto Rico residents) is not modeled this phase"* | Six dependents. |
| **1** | *"Form 8863 line 8 … §25A(i) denies the refundable 40% to certain filers under age 24, and nothing on this return establishes that the filer had attained 24 … The rule also turns on … whether a parent was alive at year end, neither of which any document this engine models carries."* | See §6.2 — the benchmark **does** carry `either_parent_alive`, so this is a gap with a known remedy. |

| **1** | *"scope refusal: this return declares 1 kind(s) this engine does not model … `alaskaPermanentFundDividends` at Schedule 1 line 8g"* | The one refusal that fires from the DECLARATION rather than from the documents — before a single line is computed. |

Fifteen of the twenty are Schedule C. That is one finding, not seven: **the sole
proprietor is where this engine's coverage actually stops**, and it stops loudly.

---

## 5. The divergences, root-caused

Triage order, cheapest suspect first: harness mapping error → the TY2024 parameter
transcription → rounding convention → year-logic mismatch → engine bug → benchmark
error. Four divergences that existed at the first run resolved to the first two
categories and are recorded in §5.4 rather than counted as engine behaviour.

### 5.1 Form 8959 Part V ran for filers not required to file Form 8959 — **our bug, FIXED**

**Cases (5):** `single-w2-balance-due-no-state-income-tax`, `single-w2-direct-debit-payment`,
`single-w2-unemployment-1099g`, `mfj-dual-w2-over-65`, `mfj-both-blind-nontaxable-social-security`.
**Size:** exactly **$1** on line 25d in every one.

**Root cause.** `fjs/form1040/core`'s line 25c *was* `scheduleTwoResult.form8959.line24`,
unconditionally, and `fjs/form8959`'s `form8959` computes Part V for every return:

```js
const partV = form8959PartV(taxParamSet)({ medicareTaxWithheldCents, partILine1: partI.line1 })
```

Part V's arithmetic is faithful to the printed page — line 21 is 1.45% of box 5, line 22
is box 6 minus that, floored at zero. Take `single-w2-balance-due-no-state-income-tax`:
box 5 = $145,000, box 6 = $2,103. 1.45% of 145,000 is **$2,102.50**, so line 22 comes out
at **$0.50**, and the whole-dollar election rounds it to **$1** on line 25c.

That $0.50 is not Additional Medicare Tax. It is ordinary per-pay-period rounding in the
employer's box 6. The module's own docstring anticipates such drift producing a
*negative* — *"the floor is load-bearing against per-pay-period rounding"* — but not a
small *positive*.

**Verdict: ours is wrong, theirs is right.** Form 8959 (2024), *Who Must File*, lists four
conditions: box 5 on **any single** Form W-2 greater than $200,000; RRTA compensation on
any single W-2 greater than $200,000; total Medicare wages plus self-employment income
greater than the **threshold amount for the filing status**; or RRTA compensation greater
than that threshold. At $145,000 of box 5 with no self-employment income, **none applies**
— the filer does not file Form 8959 at all, so no line 24 exists to carry to 1040 line
25c. The 2024 Form 1040 instruction for line 25c only directs an amount there *from* Form
8959 line 24.

The direction matters: it hands the taxpayer money they are not entitled to on a form they
are not filing. Small, but this engine's contract is that a number it prints is one a
reader can trace to a printed line.

**Why the existing proofs did not catch it.** `fjs/schedule/2` has a leaf named
`controlTheSameReturnBelowTheThresholdComputesSilently`, which asserts that a
below-threshold return *"mentions Form 8959 nowhere in any line's rule"*. It checks the
**rule string**, not the value — and every fixture it runs has box 6 at exactly 1.45% of
box 5, where line 22 is zero anyway. This is AGENTS.md's own recorded shape: *"several
assertions checked the wrong thing."*

**The fix, as shipped.** Spec first, per AGENTS.md:
**`fjs/todo/tax-form8959-part-v-who-must-file.md`**.

A new stored parameter, `additionalMedicareTaxEmployerWithholdingThreshold` — §3102(f)(1)'s
flat **$200,000** employer withholding trigger, the same for every filing status. It is
deliberately **not** `additionalMedicareTaxThreshold`, which is §3101(b)(2)'s per-status
figure answering a different question; reading `.single` to stand in for §3102(f)(1) would
be exactly the error `fjs/return/profile` names in its own comment about `earnedIncome`:
*"Two questions with the same name and different definitions is the error, not the
duplication."* They coincide at $200,000 today only because one Act (ACA §9015) drafted
both, and nothing keeps them in step.

`fjs/form8959` then computes the filing test and returns it, leaving Part V's arithmetic a
faithful transcription of the printed page:

```js
const mustFile = medicareWagesCents > employerThresholdCents || line18 > 0n
const line24AsFiled = mustFile ? partV.line24 : 0n
```

`line18 > 0n` is Who-Must-File bullets three and four; the wage comparison is bullets one
and two, conservatively — §3102(f)(1) obliges an employer to withhold only on what *it*
pays above $200,000, so a single Form W-2 above $200,000 implies the total is too, and
gating on the total can close no gate bullet one would have opened. 1040 line 25c reads
`line24AsFiled`; `line24` keeps its meaning as the printed arithmetic, so the filing test
lives in exactly one place.

**Watched to fail.** `line24AsFiled` was first written as `partV.line24` — ungated — and
the four new leaves added against their final assertions. `npm test` reported **3245 tests,
3243 pass, 2 fail**: `roundingAboveTheOrdinaryRateIsNotACreditForANonFiler` reporting `50n`
against `0n`, and `everyPrintedLineIsNamed`'s hand-typed field count catching the two new
keys — the count idiom doing exactly its job. The gate was then applied and the suite went
green. The assertions did not move; only the implementation did.

**Three mutations, each biting exactly one predicted leaf.**

| mutation | result |
|---|---|
| `>` → `>=` on the wage comparison | **green at first** — no fixture sat on the boundary, so the comparison was load-bearing in production and unmeasured. `exactlyTheEmployerThresholdIsStillTheClosedSide` was written for it; the mutation now reddens exactly that leaf. |
| drop the wage term | reddens `bulletOneFilesEvenWhenNoTaxIsOwed` — the joint couple with one $210,000 W-2 and one $30,000 W-2, whose $240,000 total is under the $250,000 joint threshold so `line18` is zero, but whose first employer really did withhold on $10,000. This is the leaf that fails if the gate is written against the per-status threshold. (First attempt did not compile — `TS6133`, the orphaned-binding trap AGENTS.md names; re-run as `employerThresholdCents < 0n || line18 > 0n`, which keeps the binding live.) |
| disable the `line18` term | **green at first** — nothing reached `mustFile` through that term alone. `selfEmploymentIncomeAloneCanObligeTheFormAndOpenPartV` was written for it: $150,000 of wages under the employer trigger, $80,000 of self-employment income carrying the total over the status threshold. The mutation now reddens exactly that leaf. |
| remove the gate itself (the original defect) | reddens two: `roundingAboveTheOrdinaryRateIsNotACreditForANonFiler` and `exactlyTheEmployerThresholdIsStillTheClosedSide`. |

Two of the four mutations survived on the first attempt, and each survivor was a real
coverage hole rather than an equivalent mutant. Both are now covered.

**The fix's own external check.** Re-running all 51 benchmark cases afterwards: **exactly
the five cases in this section flip to matched**, and nothing else moves. 22 → 27 matched,
7 → 2 diverged. A gate that closed too far would have taken `mfj-multiple-w2s-excess-social-security-tax`'s
legitimate $725 of Part V withholding with it, and it did not.

### 5.2 The EIC qualifying-child support test — **the benchmark is wrong**

**Case:** `single-eic-non-dependent-child`. Ours line 27 = **$1,114**; theirs = **$251**.

The dependent is a daughter, born 2022-06-02 (age 2 at year end), who lived with the
taxpayer 12 months, is a U.S. citizen, and is not married. The one fact the benchmark
sets against her is `dependent_supported_by_tp: false` — *"Did you provide at least half
of this person's financial support in 2024?"*

$251 is the **no-children** EIC on this income (7.65% of the $3,250–$3,300 band's midpoint
$3,275 = $250.54). $1,114 is the **one-child** EIC (34% × $3,275 = $1,113.50). So the
benchmark treated the child as not a qualifying child for EIC, and it did so on the
support test.

**§32(c)(3)(A) removes the support test.** *"The term 'qualifying child' means a
qualifying child of the taxpayer (as defined in section 152(c), determined without regard
to paragraph (1)(D) thereof and section 152(e))."* §152(c)(1)(D) **is** the support test.
Publication 596's own qualifying-child tests are relationship, age, residency and joint
return — four tests, and support is not among them, which is precisely why a child can be
a qualifying child for EIC while failing the dependency support test. That is what this
case is named for.

**Verdict: ours is right.** All four §32 tests are met on the benchmark's own data. Both
implementations also agree on the $50-band midpoint methodology, which is why the two
figures differ by a clean ratio of the two tiers' credit percentages rather than by noise.

The knock-on lines (28, 32, 33, 34, 35a) all follow from line 27.

### 5.3 `round(sum)` versus `sum(round)` — **a convention, and ours is defensible**

**Case:** `mfj-multiple-w2s-excess-social-security-tax`. Line 24: ours **56,159**, theirs
**56,158**. Line 22 = 55,541 and line 23 = 617, and 55,541 + 617 = 56,158.

This is the whole-dollar election, applied once over the exact-cents line list rather than
line by line — AGENTS.md's own stated design: *"applying it here — to the exact cents
values, once — is what makes the report `round(sum)` rather than `sum(round)`. Rounding
twice is not rounding once."* Both lines here carry fractions below $0.50 that sum above
it, so the two orders differ by exactly $1.

i1040gi p23 supports this engine: *"If you have to add two or more amounts to figure the
amount to enter on a line, include cents when adding the amounts and round off only the
total."* The benchmark rounds each form line and adds the rounded results.

**Verdict: a genuine convention difference, not a bug**, and the printed instruction reads
in this engine's favour. Not fixed, and it should not be — the convention is deliberate,
documented, and load-bearing elsewhere.

This is also the one case among the five in §5.1 whose Medicare wages ($318,602) put it
**above** the MFJ threshold, so Form 8959 genuinely is required there and its $725 of Part
V withholding on line 25c is correct. Its $1 comes from rounding, not from §5.1.

### 5.4 Four divergences that were the harness, and are worth naming anyway

Each of these looked like an engine defect at first and was not. They are recorded because
"the harness was wrong" is the most likely explanation for a divergence and the discipline
of chasing it first is what makes the two that survived credible.

| symptom | root cause |
|---|---|
| every box-12 case off by exactly the box-12 total (350, 750, 950) | The benchmark stores Form W-2 box 12 under **`employers_use_grp`** — a key naming neither the box number nor the IRS caption, which a grep for `box12`/`box_12` does not find. |
| `single-w2-healthcare-marketplace-1095a` off by $68 on line 24 | TY2024 Form 8962 uses the **2023** poverty guidelines and TY2024's own repayment-limitation table. Both were still at TY2025 values. §2. |
| ACTC (line 28) silently zero | Schedule 8812 line 18a reads `profile.earnedIncome`, which the first mapping did not state. Fixing the mapping fixed the case — but the shape is worth noting: an **absent** `earnedIncome` yields a documented zero, not a refusal, so a return that declares `additionalChildTaxCredit` and omits the figure loses up to $1,700 per child without a word. It is a profile assertion the engine is entitled to take at face value, so this is not filed as a bug; it is the nearest thing to one that this run did not conclude against the engine. |
| saver's credit (line 20/21) missing $33 | Form 8880 line 2 reads elective deferrals off W-2 box 12 itself; what `vnd.fjs.credits` has to supply is the §25B eligibility facts, which the first mapping did not. |
| AOTC refusing on the wrong fact | `academic_period_eligible_student` is the benchmark's *"enrolled at least half-time towards a degree program"*; `post_secondary_education` is *"finished their first 4 years"*. Reading the **labels** rather than the key names separated them. |

---

## 6. Two gaps the run exposed that are not divergences

### 6.1 Fifteen of twenty refusals are Schedule C

Seven for a second business, three for a loss at line 31, two for depletion, two for
gross receipts with no 1099-NEC, one for a QBI loss carryforward. Every other schedule in
the benchmark — B, D, 1, 2, 3, 8812, 8863, 8880, 8949, 8959, 8962, 8995 — computed
end to end on at least one case. If a single phase would move this engine's real-world
coverage more than any other, the printed Schedule C is it, in this order: a second
business, line 32's at-risk and material-participation facts, and line 1 receipts that
did not arrive on a 1099-NEC.

### 6.2 One refusal names a fact the benchmark actually has

`single-w2-student-american-opportunity-credit` refuses because §25A(i)'s test *"turns on
the filer's earned income as a fraction of their own support and on whether a parent was
alive at year end, neither of which any document this engine models carries."* The
benchmark's input carries both: `either_parent_alive: false` and
`total_support_8863: 59000`. With no living parent §1(g) does not apply, the refundable
40% is allowed, and the benchmark's $1,000 on line 29 is right. Two fields on
`vnd.fjs.credits` would convert this refusal into a computed line.

---

## 7. What this says about the engine

**The arithmetic is sound.** Twenty-two cases agree on twenty lines each, under a
parameter set the engine had never seen, including the Tax Table's band-midpoint rule,
the Tax Computation Worksheet, QDCGT, EIC's own $50 bands, CTC and ACTC, Form 8880, Form
8949 and Schedule D, Form 8962's monthly premium tax credit, Form 8959's Additional
Medicare Tax, and the excess social security withholding credit. The one case where two
independent implementations disagreed on **tax law** rather than on a number, the engine
was right and the benchmark was wrong, and it was right about a subsection that exists
specifically to be counterintuitive.

**Exactly one genuine defect surfaced in 51 cases**, it was worth $1, it was a missing
gate rather than a wrong computation, and it is now fixed. Set against 3,196 proof leaves
and this project's four historical instances of a proof that mirrored its own bug, that is
a good result — and the reason it surfaced at all is that the ground truth came from
outside. **No proof in this repository could have found it**, because every fixture it
would have run against had box 6 at exactly 1.45% of box 5, where the defect is invisible.
The leaf that came closest, `controlTheSameReturnBelowTheThresholdComputesSilently`,
asserted the rule *string* rather than the value and passed throughout.

Two of the four mutations run against the fix survived on the first attempt, which is the
same lesson in miniature: writing the gate is not the same as measuring it, and the
boundary and the second term of a two-term condition were each unmeasured until a mutation
said so.

**The refusals are the finding, and they are load-bearing.** Nineteen cases refused, every
one naming a printed line, the missing fact, and the remedy. Not one produced a plausible
wrong number. Compare the benchmark's own leaderboard, where the best frontier model
returns a *complete-looking* return that is right 62.75% of the time on TY2024 and where
"correct by line" tops out near 90% — the other 10% being numbers on a form that looks
finished. This engine's failure mode is a sentence naming Schedule C line 32. That
difference is the design, and this run is the first external measurement of it.

**Two things it cannot receive at all**: Form 1099-K, which has no dialect, and a 1099-G
unemployment repayment, which the printed Form 1099-G carries no box for. A third gap —
the Alaska Permanent Fund dividend — is *nameable*: the kind exists in the vocabulary
without being modeled, so the engine refuses it by name rather than dropping it.

**And the honest caveat.** The TY2024 parameter set is a transcription by the author of
this run, not a proved artifact of the engine. Twelve of its figures are independently
confirmed by the benchmark's own expected outputs (§2.2) and two of its overrides were
*found* by divergences that then disappeared — but it remains the largest single source
of uncertainty in every number above, and no conclusion here should be read as stronger
than that transcription.

---

## 8. Reproducing this

The benchmark is **not** vendored into this repository — it is a 282 MB clone. The harness
**is**, beside this report, because §2 calls its TY2024 parameter set the standing suspect
in every number and a suspect that cannot be re-examined is not auditable. It is not part
of the **engine**: nothing in `fjs/` reads it, no proof covers it, it adds no dependency,
and it is `@ts-nocheck` for the same reason the root-level gate suites are.

```sh
git clone --depth 1 https://github.com/column-tax/tax-calc-bench.git /tmp/bench/tax-calc-bench
cd .planning/reports/taxcalcbench-33-harness
BENCH_ROOT=/tmp/bench node run.mjs
```

See that directory's [README](./taxcalcbench-33-harness/README.md) for what each file is.
The harness imports `form1040Report` from `fjs/form1040/core/module.f.js` directly. It
re-validates nothing the engine validates and asserts nothing the engine asserts; it maps
input, calls once, and compares against the XML. It opens the `try` that `fjs/**.f.js`
forbids, which is legal because it is not a `.f.js`.

**Measured in an rsync'd copy outside the parent checkout** (`/tmp/measure-33`, 6,804
module resolutions into that copy's own `node_modules` and zero into the parent's, so the
typecheck is not the falsely-green one AGENTS.md warns about):

| | before | after |
|---|---|---|
| `tsc` errors | 0 | **0** |
| `npm test` | 3241 / 3241 | **3247 / 3247** |
| project-local proof leaves | 3196 | **3202** |

The six new leaves are §5.1's five plus the extension of `everyPrintedLineIsNamed`.

One measurement caution learned here and worth repeating: the worktree this ran in had
**no `node_modules` at all**, so the first `tsc` bound to the parent checkout's and
reported **1,935 errors** on a tree whose true count is zero — the mirror image of the
falsely-green trap §6.1 of the 0.46.1 migration report describes. `npm ci` in the worktree
first, then measure in the copy.
