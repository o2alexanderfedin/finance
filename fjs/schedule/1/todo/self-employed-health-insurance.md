# Schedule 1 line 17 — the self-employed health insurance deduction (IRC §162(l))

**Status:** specified and implemented (this file is the record of the decisions)
**Kind:** `selfEmployedHealthInsuranceDeduction` — MODELED as of TAX-39
**Printed line:** Form 7206 line 14 -> Schedule 1 line 17 -> 1040 line 10
**Also reaches:** Form 8995 line 1c, through §199A(c)(1)

---

## 0. The headline correction: **Publication 535 does not exist**

Every prior statement in this repository about this line names a source that was
withdrawn three years ago. `fjs/return/scope`'s refusal row read:

> *"requires the **Pub. 535** self-employed health insurance deduction worksheet.
> Both figures it once lacked now exist — Schedule C as of Phase 27 and
> §162(l)(2)(A)'s net-earnings cap as of Phase 28 — and what remains missing is
> the premiums…"*

and `fjs/form8995`'s docstring quoted the same claim.

**IRS, *About Publication 535, Business Expenses*:** *"We have discontinued
Publication 535, Business Expenses; the last revision was for 2022."*

This row had already been repaired **twice** — Phase 27 deleted a clause naming
a Schedule C it then built, Phase 28 deleted one naming a Schedule SE it then
built — and both repairs left the *first* clause untouched, because nobody
re-read it. The lesson worth keeping is not about this line:

> **A remedy that names an external source has an expiry the repository cannot
> see, and the clause least likely to be re-read is the one that has been true
> longest.**

### Where the computation actually lives for 2025

There are three places, and they are not equivalent:

| Source | What it is | Used here? |
|---|---|---|
| **Form 7206**, *Self-Employed Health Insurance Deduction* (2025 rev., Cat. No. 56399C, "Created 10/2/25") | a printed IRS form, 14 lines | **yes** — `fjs/form7206` |
| 2025 Instructions for Forms 1040 and 1040-SR, **p. 94**, *"Self-Employed Health Insurance Deduction Worksheet—Schedule 1, Line 17"* | a 3-line worksheet for the simple case | no |
| **Pub. 974** (2025), pp. 46-58, *"Self-Employed Health Insurance Deduction and PTC"* | Worksheets P, W, X and two calculation methods | no — see §3 |

2025 Instructions for Form 7206, p. 1, Reminder: *"This form and its separate
instructions have replaced the Self-Employed Health Insurance Deduction
Worksheet that was previously published as a worksheet in Pub. 535, Business
Expenses."*

**The form rather than the worksheet, and that is a decision.** The 1040
instructions (p. 95) send a filer to Form 7206 instead of the worksheet if any
of three things is true, and one of them is *using qualified long-term-care
premiums* — which this engine models. The two pages also **disagree** in the
multi-business case: the worksheet subtracts the whole of Schedule 1 lines 15
and 16, and Form 7206 prorates the first and traces the second. See §2.

---

## 1. **The finding: this line never had an ordering problem**

The brief that commissioned this work asked whether Schedule 1 line 17 and
`fjs/form2441`'s self-employment refusal share a root cause, on the grounds that
both remedies named Schedule SE. **They do not**, and the difference is worth
stating precisely because the surface similarity is strong.

### Form 2441's blocker IS an ordering one

`fjs/form2441`'s refusal, in its own words: earned income for lines 4/5 and
18/19 is *"1040 line 1z PLUS Schedule SE line 3 less the Schedule 1 line 15
deduction"*, and this engine computes Schedule SE **inside Schedule 1 stage
one**, which runs *after* 1040 line 1z — of which Form 2441's own line 26 (1040
line 1e) is a term. So the figure Form 2441 needs is produced downstream of a
line Form 2441 itself produces.

That is a real evaluation-order problem, and it is **not** a real cycle: nothing
Schedule SE reads depends on 1040 line 1z. It reads Schedule C's line 31,
Schedule E's box 14 code A, and Form W-2 boxes 3 and 7 — all stored documents.
The refusal names the unlock itself: *"compute Schedule SE above the 1040 line 1
block, which nothing in Schedule SE prevents."* Verified while writing this
file, by reading `scheduleSelfEmploymentPartI`'s inputs; the claim holds.

### §162(l)'s blocker was DATA

Line 17's three inputs are Schedule C line 31 (`businessNetProfit`), Schedule 1
line 15 (`line15`) and Schedule 1 line 16 (`line16`). **All three are already
bound, in that order, at the exact statement where line 17 was a hard zero** —
`line15` is built three statements earlier from the same `selfEmploymentLines`.
Implementing this line moved no code and changed no evaluation order.

What it needed was six `vnd.fjs.adjustments` line tags and one profile
certification. **The remedy said the blocker was net self-employment earnings;
that stopped being true at Phase 28, and the row's own correction history shows
it being repaired for exactly that reason twice without anyone noticing the
remaining claim was also unfalsifiable by inspection.**

### So: no shared root cause, and no single fix retires both

The two refusals were adjacent in `fjs/return/scope`'s prose (Phase 28's note
paired them explicitly) because both remedies mentioned Schedule SE. **A shared
input is not a shared root cause.** Form 2441's fix is a hoist of
`scheduleSelfEmploymentPartI` — and of the Schedule C and Schedule E executions
that feed it — above the 1040 line 1 block in `fjs/form1040/core`, with the
result threaded *into* stage one so nothing runs twice (`fjs/schedule/1`'s own
header: *"a second execution would be pricing a return the first one had already
changed"*). That is feasible and is **not done here**: it is not §162(l)'s
blocker, it touches the ordering of a 13,000-line module, and it deserves its
own phase with its own mutation budget rather than being smuggled into one that
needed none of it.

`fjs/return/scope`'s Phase 28 note is corrected in the same commit as this file,
so the pairing does not outlive the claim that made it.

---

## 2. Form 7206, line by line, and the two allocation rules on adjacent lines

Transcribed from the printed PDF, not from a summary. The header note matters as
much as the lines: *"Use a separate Form 7206 for each trade or business under
which an insurance plan is established."*

| Line | Printed rule | This engine |
|---|---|---|
| 1 | total paid for health insurance for you, your spouse and dependents | `selfEmployedHealthInsuranceMedicalDentalVision` entries, summed |
| 2 | per covered person, min(paid, §213(d)(10) age cap) | the five band tags, grouped by `individual` |
| 3 | 1 + 2 | |
| 4 | net profit from **the** trade or business the plan is under | Schedule C line 31 **or** K-1 box 14 code A — never both (R3) |
| 5 | total of **all** net profits | the same figure, by construction of R3 |
| 6 | line 4 ÷ line 5 | an exact rational, never a rounded percentage |
| 7 | Schedule 1 line 15 × line 6 | **prorated** |
| 8 | 4 − 7 | |
| 9 | Schedule 1 line 16 **attributable to the same trade or business** | **traced**; zero while `selfEmployedRetirementPlans` refuses |
| 10 | 8 − 9 | |
| 11 | S-corporation >2% shareholder's Medicare wages (W-2 box 5) | implemented in the form; zero from this caller (R4) |
| 12 | Form 2555 line 45 | structural zero — `foreignEarnedIncomeForm2555` is a refused kind |
| 13 | 10 **or 11, whichever applies** − 12 | line 4's *"If the business is an S corporation, skip to line 11"* |
| 14 | min(line 3, line 13) | floored at zero |

**Lines 7 and 9 use different allocation rules**, and neither is the other:
§164(f) is apportioned by profit share, §404 is traced to the business. The
three-line 1040 worksheet has neither — it subtracts both in full. That is why
the multi-business case is a refusal here rather than an approximation.

**The statutory root of the ceiling**, for the record. §162(l)(2)(A) caps the
deduction at *"the taxpayer's earned income (within the meaning of section
401(c)) derived by the taxpayer from the trade or business with respect to which
the plan … is established"*, and §401(c)(2)(A) defines that as net earnings from
self-employment determined *"(v) with regard to the deductions allowed by
section 404 …, and (vi) with regard to the deduction allowed … by section
164(f)"*. Clause (vi) is Schedule 1 line 15; clause (v) is Schedule 1 line 16.

---

## 3. The Form 8962 interaction: **refused, and why no method exists to
implement**

Rev. Proc. 2014-41 §2.05, verbatim:

> *"the amount of the § 162(l) deduction is based on the amount of the § 36B
> premium tax credit, and the amount of the credit is based on the amount of the
> deduction – a circular relationship."*

### The one-way half is already right, and is not enough

`fjs/form1040/core` computes Form 8962 from `income.line11b` — an adjusted gross
income that already contains Schedule 1 line 17. So **§162(l) → AGI → household
income → credit runs in the correct order with no change**, which is worth
saying because it is the half a reader will worry about first.

The edge that closes the circle is §5.03(2): the deduction *"may not exceed the
lesser of … (B) the sum of (1) the specified premiums **not paid through advance
credit payments**, and (2) the limitation on additional tax…"*. The credit moves
the deduction back.

### There is no convergent method to implement

The brief asked for *"a convergent method with a proof of convergence"*. **No
such method exists in the guidance**, and the guidance says so. §5.01(6):

> *"If the change in either the § 162(l) deduction or the premium tax credit …
> is not less than $1, repeat Steps 4 and 5 … until changes in both … between
> iterations are less than $1."*

No iteration bound, and an explicit escape hatch in the closing paragraph:
*"If a taxpayer is unable to complete Step 6 because changes between iterations
always exceed $1, the taxpayer should not use the iterative calculation
method…"*. Pub. 974 (2025) p. 54 repeats it.

That is not an oversight. The iteration map is **antitone**: as the deduction
rises, household income falls, the applicable percentage falls, the credit
rises, and the next deduction (premiums − credit) *falls*. An order-reversing
map on a lattice has no fixed-point theorem behind it and can two-cycle;
Rev. Proc. 2014-41's $1 stopping rule and its "simplified"/"alternative"
truncation at Step 4 are what stand in for the convergence nobody can prove.

### The decision: refuse the combination, explicitly

**A return that stores both a §162(l) premium entry and a Form 1095-A refuses.**
The refusal names Rev. Proc. 2014-41, the circularity, the one-way order that is
already right, and the destination.

A second reason makes this stronger than a scoping choice: §3's scope is
*specified premiums* — premiums for a Marketplace qualified health plan for
which a credit is allowed. **Nothing stored distinguishes those from unrelated
coverage.** A taxpayer with Marketplace coverage and a separate dental policy is
in no circle at all; one whose §162(l) premiums *are* the Marketplace premiums
is. The two answers differ by the whole credit, and no field says which case
this is. Adding one would be inventing a fact rather than transcribing one.

Both controls exist: a Form 1095-A with no premium entry still computes its
credit, and premiums with no Form 1095-A still compute their deduction.

**What would retire this refusal**, in order of what it would take:

1. a `vnd.fjs.adjustments` field saying whether an entry is a *specified
   premium* — which splits the return into a circular arm and a non-circular
   one, and retires the refusal for the second arm outright;
2. for the circular arm, Pub. 974's **Simplified Calculation Method**, which
   truncates at Step 4 and therefore always terminates. It is bounded and
   implementable; it is also sometimes less favourable than the iterative one,
   and choosing a method *for* a taxpayer is a different kind of decision from
   computing one.

---

## 4. §162(l)(2)(B), and why the certification is deliberately narrower than the statute

> §162(l)(2)(B): *"Paragraph (1) shall not apply to any taxpayer **for any
> calendar month** for which the taxpayer is **eligible to participate** in any
> **subsidized** health plan maintained by any employer of the taxpayer or of
> the spouse of, or any dependent, or individual described in subparagraph (D)
> of paragraph (1) with respect to, the taxpayer."*

Form 7206 line 1 restates it as an exclusion from the premiums; the instructions
(p. 2) add *"even if you didn't actually participate"*, and *"these rules are
applied separately to plans that provide long-term care insurance and plans that
don't"*. The 1040 instructions (p. 94) add that a QSEHRA counts as subsidized.

**None of this appears on any information return.** No Form W-2 box says whether
an employer *offered* a plan. So it is a certification —
`notEligibleForAnySubsidizedEmployerHealthPlanInAnyMonth` on
`vnd.fjs.return_profile`, `option(true)` per DOC-12 — with the precedent of
`movingExpensesArmedForcesPermanentChangeOfStation` (§217(g)) and Form 8962's
`noDependentIsRequiredToFileAnIncomeTaxReturn`.

**It is truthfully declarable by an ordinary taxpayer**, which was the
requirement: a self-employed person knows whether they or their spouse could
have joined an employer plan. It is narrower than the statute in two ways, both
deliberate and both erring toward refusal rather than toward deduction:

| Statute | This field | A filer who cannot certify |
|---|---|---|
| month-by-month | whole-year | refuses (has a real partial deduction this engine will not compute) |
| separate tests for LTC and non-LTC plans | one test covering both | refuses |

Refusing a return this engine cannot compute is the honest direction. Reading an
absent flag as "eligible in no month" would overstate the deduction, which is the
direction that costs the taxpayer a notice.

---

## 5. Medicare, and where the premiums are transcribed from

**Medicare premiums count**, under **CCA 201228037** (POSTU-109706-12, UILC
162.07-31): *"All Medicare Parts are insurance that constitutes medical care
under section 162(l)"*, and so *"all Medicare premiums are similar to other
health insurance premiums and can be used to compute the deduction"*. Conclusion
3 extends it to a spouse's, dependent's or under-27 child's coverage. The CCA
states on its face that it *"may not be used or cited as precedent"*, and it is
the only IRS authority on point; what this engine actually follows is the
current published text — 2025 Instructions for Form 7206, p. 1: *"Medicare
premiums you voluntarily pay to obtain insurance in your name that is similar to
qualifying private health insurance can be used to figure the deduction."*

Recorded in the `selfEmployedHealthInsuranceMedicalDentalVision` tag's own
comment, because a self-employed retiree who omits Medicare is the commonest way
this deduction is understated.

### **No dialect was added, and none was needed**

`vnd.fjs.adjustments` describes itself as *"the substantiation record behind
Schedule 1 **Part II's adjustments to income**"*. Line 17 is a Schedule 1 Part II
adjustment. The dialect's own inclusion argument — *"both are payments
substantiated by the taxpayer's own records, both arrive with no payer and no
account, and both therefore have the same cardinality"* — holds exactly: no
payer files an information return for what a self-employed person paid for their
own coverage.

`vnd.fjs.credits` was considered and rejected on that dialect's own written
boundary: it is *"the taxpayer-asserted record behind **Schedule 3's
credits**"*. This is a deduction, not a credit. `vnd.fjs.business_expenses` was
rejected too — §162(l) is expressly an **above-the-line** deduction and *not* a
Schedule C expense (Form 7206 line 14: *"Don't include this amount when figuring
any medical expense deduction on Schedule A"*, and it never touches Schedule C
line 31 either, which is why it reduces §199A qualified business income
separately).

**Not one field was added to the dialect**, because `lineTag` is a free string
whose vocabulary lives in `fjs/schedule/1`. Six new tags, zero schema change,
zero dialect-count movement, no `fjs/media/dialects` or `fjs/server/finance_schema`
registration, and no `fjs/report/tax_return` routing work — `vnd.fjs.adjustments`
was already routed in both the source and the guest-source twin.

### The five age-band tags

Form 7206 line 2(b) caps by *"the person's age at the end of the tax year"*, and
**no document in this repository carries a birth date**. The band is therefore
asserted through the tag the taxpayer chooses — precisely the mechanism
`traditionalIraContributionAgeFiftyOrOver` already uses for §219(b)(5)(B)(ii),
one line up the same schedule and on the same document.

The 2025 limits are **Rev. Proc. 2024-40 §2.28** (not §2.27, which is the
qualified-business-income threshold), corroborated on Form 7206 line 2(b):
$480 / $900 / $1,800 / $4,810 / $6,020.

---

## 6. The five refusals, and what would retire each

| | Condition | Why | Retired by |
|---|---|---|---|
| R1 | premiums, no §162(l)(2)(B) certification | eligibility is on no information return | the taxpayer certifying |
| R2 | premiums **and** a Form 1095-A | Rev. Proc. 2014-41's circularity; no convergent method exists | §3's two-step plan |
| R3 | premiums, Schedule C profit **and** K-1 box 14 code A earnings | nothing says which trade or business the plan is under; lines 4/5/6/7 depend on it | a `vnd.fjs.adjustments` field naming the business |
| R4 | premiums, **no** self-employment net profit | the zero is right for a taxpayer with no business and wrong for an S-corporation >2% shareholder (line 11, §162(l)(5), Rev. Rul. 91-26) or a Schedule F farmer | modelling line 11, or Schedule F |
| R5 | two age bands for one `individual` | one person has one age; the caps differ by up to $5,540 | nothing — this is malformed input |

Each has a control leaf showing the legitimate neighbouring case computes.

## 7. What this deliberately does not model

- **A month-by-month partial deduction.** See §4.
- **A dependent's or under-27 child's long-term-care premium.** `individual`
  admits `taxpayer` and `spouse` only, and §213(d)(10)'s cap is per covered
  person, so a third person's premium has no home and no band. Attributing it to
  the taxpayer would apply the wrong cap. It is unstorable rather than
  wrongly computed.
- **The retired-public-safety-officer exclusion** (Form 7206 line 1, up to
  $3,000 under §402(l)). No dialect records that a Form 1099-R distribution was
  a PSO-excluded one, so — like `movingExpensesTravelAndLodgingExcludingMeals` —
  the exclusion is enforced where the figure is *named*, in the tag's own
  documentation. **The $3,000 is deliberately NOT stored in `fjs/tax/params`:**
  nothing would read it, and this repository has already paid for a rule
  illustrated by unreachable code (AGENTS.md, MAINT-01).
- **Conservation Reserve Program payments** excluded from line 4/5. No dialect
  carries them.
- **The optional methods** (Form 7206's first footnote sends an optional-method
  filer to Schedule SE line 4b). `selfEmploymentOptionalMethods` is a refused
  `fjs/return/scope` kind, so such a return never reaches this line.

---

## 8. Mutation log

*A proof is not known to work until you have watched it fail.* Nineteen
mutations, each applied alone against the committed tree, each verified as
exactly one insertion and one deletion with `git diff --numstat` unless noted.
Gate before: **2752 pass / 0 fail**. Gate after: **2805 / 0**.

| # | File | Intent | Compiled | Leaves reddened |
|---|---|---|---|---|
| M1 | `fjs/form7206` | line 2: cap the running SUM instead of each covered person | yes | **3** — and see the surprise below |
| M2 | `fjs/form7206` | line 14: take line 13 always, never `min(line 3, line 13)` | yes | **17**, across all four layers |
| M3 | `fjs/form7206` | line 7: subtract the WHOLE Schedule 1 line 15 (what the 3-line 1040 worksheet does) | yes | 2 |
| M4 | `fjs/form7206` | line 13: read line 10 always, never line 11's S-corporation path | yes | 1 |
| M5 | `fjs/schedule/1` | route every line 17 tag into Form 7206's UNCAPPED line 1 | yes | 7 |
| M6 | `fjs/schedule/1` | feed Form 7206 line 7 a zero §164(f) half | yes | 2 |
| M7 | `fjs/form8995` | drop §162(l) from §199A(c)(1)'s reduction to QBI | yes | 2 |
| M8 | `fjs/form1040/core` | hand §199A a zero while line 17 itself is untouched — **the wiring mutation** | yes | 2 |
| M9 | `fjs/schedule/1` | drop line 17 from the Social Security worksheet's "lines 11 through 20" | yes | 1 |
| M10 | `fjs/schedule/1` | drop line 17 from the printed line 26 total | yes | 5 → **6 after a leaf was added**; see below |
| M11 | `fjs/schedule/1` | erase `${line17Destination}` — AGENTS.md's own recipe | **no**, then yes | 0 (TS1005), then **3** |
| M12 | `fjs/schedule/1` | read an ABSENT §162(l)(2)(B) certification as "eligible in no month" | yes | **22** |
| M13 | `fjs/form1040/core` | disconnect the Form 1095-A detection (`length !== 0` → `> 1000`) | yes | 1 |
| M14 | `fjs/tax/params` | transpose the $4,810 and $6,020 caps | yes | 5 |
| M15 | `fjs/schedule/1` | point the age-51-to-60 tag at the 61-to-70 band | yes | 8 |
| M16 | `fjs/schedule/1` | disable the whole `premiumsCouldMatter` gate | yes | 6 |
| M17 | `fjs/schedule/1` | R3 fires on ANY Schedule C, not only on two sources | yes | 16 |
| M18 | `fjs/return/scope` | un-reclassify: remove the kind from `modeledKinds` | **no** — TS2344 | see below |
| M19 | `fjs/return/scope` | remove it from the INDEPENDENT hand-typed second list | yes | 1 |

**No survivors.** Three results are worth more than the counts.

### M1: a predicted red set that was wrong, and the property it revealed

`twoPeopleInDifferentBandsAreCappedSeparately` was predicted to redden and
**stayed green**. Capping the running sum gives, for that fixture,
`min(3,000, 1,800) = 1,800` then `min(1,800 + 3,000, 4,810) = 4,800` — which is
the *right* answer. The accumulated total happens to fall under the second,
larger cap, so the wrong rule and the right rule agree at that input. This is
AGENTS.md's *equivalent mutant* shape, absorbed by the ordering of the bands
rather than by a neighbouring operation.

Only **two people in the SAME band** separate the two rules, and
`twoPeopleInTheSameBandEachGetTheirOwnCap` is the leaf that did redden. Both
leaves exist for this reason, and it is now written at the site.

### M10: a leaf whose NAME claimed more than its assertions

`lineSeventeenReachesLineTwentySixAndBothWorksheetTotals` never touched line 26
— stage 1 has no line 26, and the two worksheet totals are computed by
different functions. Dropping line 17 from `scheduleOnePartII`'s summands
reddened only the `fjs/form1040/core` and `fjs/report/tax_return` leaves;
nothing at the schedule layer noticed.

**A leaf whose name overpromises is the same defect as a stale docstring**, and
it was caught the same way. The leaf now stages Part II and asserts printed line
26, and M10 re-run reddens **6**.

### M18: the mutation the compiler catches, which is stronger

Removing the kind from `modeledKinds` does not compile:
`fjs/return/scope/module.f.js(1323,21): error TS2344: Type 'false' does not
satisfy the constraint 'true'` — `_EveryKindIsEitherModeledOrRefused`. The
partition is enforced at `tsc`, so a kind cannot silently fall out of both
tables. Recorded as a **stronger** result than a red test, not as a failed
mutation; M19 exercises the same reclassification through the one path that does
compile, and reddens the hand-typed-list comparison.

### Where the destination assertion lives

`${line17Destination}` is one shared constant interpolated into all five
refusals, and two leaves assert it (R1's and R2's, at both the schedule and the
report layer). M11 confirms that is sufficient: erasing the constant reddens
three leaves. R3, R4 and R5 do not repeat the assertion — one rule, one place.
