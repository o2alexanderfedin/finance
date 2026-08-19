# Schedule 1 line 20 — the traditional IRA deduction (IRC §219)

**Status:** specified and implemented (this file is the record of the decisions)
**Kind:** `iraDeduction`
**Printed line:** Schedule 1 line 20 -> 1040 line 10

---

## 0. The headline correction: **this is not a fixed point**

Every prior statement in this repository about Schedule 1 line 20 says it is a
circularity this engine cannot model:

- `fjs/return/scope/module.f.js`' own `unmodeledKindRefusals` row —
  *"requires Pub. 590-A Worksheet 1-1, whose own modified adjusted gross income
  depends on 1040 line 6b while line 6b depends on this deduction — a fixed
  point this engine does not model"*
- `fjs/form1040/core/module.f.js`' `iraDeductionDeclared` guard — *"this engine
  does not model the fixed point"*
- `fjs/tax/ssb/module.f.js`' header, and `fjs/return/scope`' Phase 13 and Phase
  24 sections, both quoting the same claim.

**The claim is false, and the IRS says so in print.** It is a genuine ordering
problem, and Publication 590-A resolves it with a **strict three-pass ordering
rule that produces two different taxable-Social-Security figures** — not with an
iteration and not with a single add-back.

The two statutes that create the knot:

> **§219(g)(3)(A)** — "Adjusted gross income of any taxpayer shall be
> determined— (i) **after application of sections 86 and 469**, and (ii) without
> regard to sections 85(c), 135, 137, 221, and 911 **or the deduction allowable
> under this section**."

> **§86(b)(2)** — "the term 'modified adjusted gross income' means adjusted
> gross income— (A) determined without regard to this section and sections
> 85(c), 135, 137, 221, 911, 931, and 933, and (B) increased by the amount of
> [tax-exempt] interest…"

§219 is **absent** from §86(b)(2)(A)'s list, so the IRA deduction *is* subtracted
in arriving at the §86 modified AGI. And §219(g)(3)(A)(i) needs the §86 result.
Naively that closes the loop. §219(g)(3)(A)(ii)'s *"without regard to … the
deduction allowable under this section"* is what cuts it — and it reaches
**through** the §86 sub-computation, which is why Pub. 590-A Appendix B exists:

| Pass | Pub. 590-A | What it computes | The IRA deduction is… |
|---|---|---|---|
| 1 | Appendix B **Worksheet 1** | taxable Social Security **for §219 MAGI purposes only** | ignored |
| 2 | Appendix B **Worksheet 2** | the IRA deduction, Schedule 1 line 20 | the output |
| 3 | Appendix B **Worksheet 3** | taxable Social Security **as reported on 1040 line 6b** | subtracted |

Worksheet 3 is Worksheet 1 with two extra lines inserted (line 2, *"Deduction(s)
from line 7 of Worksheet(s) 2"*, and line 3, *"Subtract line 2 from line 1"*).
Everything else is identical. **The two §86 figures legitimately differ**, and an
implementation that computes taxable Social Security once and reuses it for both
purposes is wrong.

Appendix B Worksheet 1 line 1, verbatim:

> "Adjusted gross income (AGI) from Form 1040 or 1040-SR. (For purposes of this
> worksheet, figure your AGI **without taking into account any social security
> benefits** from Form SSA-1099 or RRB-1099, **any deduction for contributions to
> a traditional IRA**, any student loan interest deduction, or any exclusion of
> interest from savings bonds to be reported on Form 8815.)"

Appendix B Worksheet 1 line 19: *"Modified AGI for determining your reduced
traditional IRA deduction—add lines 1, 17, and 18."*

### How that maps onto THIS engine, exactly

Appendix B Worksheet 1's lines 2–17 are a complete re-execution of §86 with the
same base amounts (`$25,000`/`$32,000`, `$9,000`/`$12,000`, the 50%/85% tiers and
the 85%-of-gross cap) that `fjs/tax/ssb` already implements. The only difference
from the return's own worksheet is which Schedule 1 adjustments are subtracted.
`fjs/tax/ssb`'s line 6 is *"Schedule 1, lines 11 through 20, and 23 and 25"*, so:

- **Pass 1 = `socialSecurityBenefitsWorksheet` with line 20 taken as `$0`.** That
  is Appendix B Worksheet 1 exactly — its line 1 excludes the IRA deduction and
  the student loan interest deduction (line 21 is already outside the printed
  range), and its line 5 is the same tax-exempt-interest add-back.
- **Pass 2 = `iraDeductionWorksheet`,** below.
- **Pass 3 = the SAME `socialSecurityBenefitsWorksheet` call `fjs/form1040/core`
  already makes,** now with a line 20 that is filled in. **No change to
  `fjs/tax/ssb` and no change to that call site.**

So:

    MAGI(§219) = (total income except taxable Social Security)
         - (Schedule 1 lines 11-19a, 23, 25)          <- Worksheet 1 line 1
         + passOne.line18                              <- Worksheet 1 line 17
         + §911/§137/§135/§85(c) exclusions (all zero) <- Worksheet 1 line 18

Nothing iterates. `iraDeductionPhaseoutIncome` is the named function that states
the first two terms, in the shape `studentLoanInterestPhaseoutIncome` already
established one line down (TAX-15: never write a variable named for the acronym alone; each
modified AGI is named for its purpose and states its own add-back list).

**A return with no Social Security benefits does not need pass 1 at all** — pass
1's output is then `$0` by the worksheet's own 85%-of-gross cap — but the code
runs it unconditionally, because a branch that is only correct when a number
happens to be zero is a branch nobody can check.

### The §219(g)(3)(A)(ii) add-back list, corrected

The brief for this work, and the recollection it was written from, said the list
was *"§§135, 137, 199A, 221, 222 and 911"*. It is not.

- **§199A is not in it and never was.** What was there was §199 (the repealed
  domestic production activities deduction), struck by TCJA §13305(b)(1). §199A
  is taken from taxable income, not from gross income, so it cannot affect AGI.
- **§85(c) *is* in it**, inserted by ARPA (Pub. L. 117-2). It is the $10,200
  unemployment-compensation exclusion, which by its own terms applied to TY2020
  only, so it is **inert for 2025**: unemployment compensation reaches §219 MAGI
  in full.
- §222 was struck in 2020 by Pub. L. 116-260.

The 2025 list is therefore **§85(c), §135, §137, §221, §911, and §219 itself**,
applied **after** §86 and §469. Every one of the five statutory exclusions is
either unmodeled or a refused kind in this engine and so permanently zero; they
are named in `iraDeductionPhaseoutIncome` rather than omitted, mirroring
`studentLoanInterestPhaseoutIncome`'s own three zero terms.

---

## 1. The TY2025 figures

Established from **IRS Notice 2024-80** (the §415(d)/§219(b)(5)(C) cost-of-living
release) and **Publication 590-A Tables 1-2 and 1-3**, not from recall. Both of
the `irs.gov/retirement-plans/2025-ira-deduction-limits-…` pages the brief named
now return **HTTP 404**; the surviving landing page is
`https://www.irs.gov/retirement-plans/ira-deduction-limits`, and every figure
those pages carried is reproduced in Pub. 590-A's own tables.

| Figure | Cite | TY2025 |
|---|---|---|
| Deductible amount (base) | §219(b)(5)(A) | **$7,000** |
| Age-50 catch-up | §219(b)(5)(B)(ii) | **$1,000** (total $8,000) |
| Phase-out threshold, single / head of household, covered | §219(g)(3)(B)(ii) | **$79,000** |
| …range | §219(g)(2)(A)(ii) | **$10,000** (ends $89,000) |
| Phase-out threshold, MFJ **or qualifying surviving spouse**, covered | §219(g)(3)(B)(i) | **$126,000** |
| …range | §219(g)(2)(A)(ii) | **$20,000** (ends $146,000) |
| Phase-out threshold, married filing separately, covered | §219(g)(3)(B)(iii) | **$0** (never indexed) |
| …range | §219(g)(2)(A)(ii) | **$10,000** |
| Threshold, MFJ, **not** covered but spouse is | §219(g)(7)(A) | **$236,000** |
| …range | §219(g)(7)(B) | **$10,000**, not $20,000 (ends $246,000) |
| Floor on a partial limit | §219(g)(2)(B) | **$200** |
| Rounding increment | §219(g)(2)(C) | **$10** |

Notice 2024-80, verbatim: *"The applicable amount under section 219(g)(3)(B)(i)
… for taxpayers who are active participants filing a joint return **or as a
qualifying widow(er)** is increased from $123,000 to $126,000."* So a qualifying
surviving spouse takes the joint figures **and the joint $20,000 range** — Pub.
590-A Worksheet 1-2 line 3 and line 4 both say so by name. This is the *opposite*
of what `additionalMedicareTaxThreshold` does with QSS, and the difference is
recorded at both sites so neither can be copied onto the other.

**§219(g)(7)'s $10,000 range on a joint return is the classic implementation bug
in this section** and is why Worksheet 1-2 puts the non-covered spouse in the
"All others … 70%/80%" bucket rather than the joint "35%/40%" bucket. It is not
reachable here (joint returns refuse — §5 below) and is recorded so the phase
that models them starts from the right number.

### The phase-out arithmetic, and the direction of the rounding

> **§219(g)(2)(A)** — "The amount determined under this paragraph with respect to
> any dollar limitation shall be the amount which bears the same ratio to such
> limitation as— (i) the excess of— (I) the taxpayer's adjusted gross income …
> over (II) the applicable dollar amount, bears to (ii) $10,000 ($20,000 in the
> case of a joint return)."
>
> **(B) No reduction below $200 until complete phase-out** — "No dollar
> limitation shall be reduced below $200 under paragraph (1) unless (without
> regard to this subparagraph) such limitation is reduced to zero."
>
> **(C) Rounding** — "Any amount determined under this paragraph which is not a
> multiple of $10 shall be rounded to the next lowest $10."

§219(g)(2)(A) computes the **reduction**; the surviving limit is
`limit − reduction`, which is algebraically `limit × (top − MAGI) ÷ range` —
exactly Pub. 590-A Worksheet 1-2 line 4. **(C)'s "next lowest $10" is stated of
the reduction, so on the surviving limit it is "next HIGHEST $10"**, which is the
direction the printed worksheet gives:

> Worksheet 1-2 line 4 — "Multiply line 3 by the percentage below that applies to
> you. **If the result isn't a multiple of $10, round it to the next highest
> multiple of $10.** (For example, $611.40 is rounded to $620.) **However, if the
> result is less than $200, enter $200.**"

Picking the wrong end of that rule gives a deduction $10 too low. The percentages
Worksheet 1-2 prints (35/40 for joint-and-QSS, 70/80 for everyone else) are
`dollarLimit ÷ range`, so this module derives them from the two stored figures
rather than storing a third that could disagree — the "two figures, not three"
position `studentLoanInterestDeduction` records.

So, per §219(g) and Worksheet 1-2 lines 2–4:

    limitAfterPhaseout(dollarLimit) =
        MAGI <= threshold          -> dollarLimit                    (line 3 note: full)
        MAGI >= threshold + range  -> 0                              (line 2 note: none)
        otherwise                  -> max($200, ceil10(dollarLimit x (top - MAGI) / range))

and, Worksheet 1-2 line 7, *"Compare lines 4, 5, and 6. Enter the smallest
amount"*:

    line20 = min(limitAfterPhaseout, compensation, min(contributions, dollarLimit))

---

## 2. Where the contribution comes from

`vnd.fjs.adjustments`, whose `lineTag` is a deliberately free string this module
owns the vocabulary for — the `educatorExpenses` precedent. Two new tags:

    ['traditionalIraContribution', 'Schedule 1 line 20']
    ['traditionalIraContributionAgeFiftyOrOver', 'Schedule 1 line 20']

The second is an ASSERTION rather than a different line — see §3.

**Named `traditionalIraContribution`, not `iraContribution`.** A Roth
contribution is not deductible at all (§408A(c)(1)) and belongs on no Schedule 1
line; because this module's tag vocabulary is CLOSED, an entry tagged
`rothIraContribution` is refused **by name** rather than silently deducted. A tag
called `iraContribution` would invite exactly that mistake, and the mistake is
worth up to $8,000 of deduction that does not exist.

`individual` is already checked by this module's existing entry-level gate: a
`spouse`-attributed entry on a non-joint return is refused before any line is
built, and joint returns refuse for a different reason (§5).

**§219(f)(3) widens an existing rule, and that is a behavioural change to code
this line did not otherwise touch.** `fjs/schedule/1` refuses a following-year
`datePaid` on anything but an HSA contribution, because a classroom supply
bought in March 2026 is a 2026 deduction. §219(f)(3) makes an IRA contribution
the second exception — *"a taxpayer shall be deemed to have made a contribution
on the last day of the preceding taxable year if the contribution is made on
account of such taxable year and is made not later than the time prescribed by
law for filing the return"* — and that is how a large share of real IRA
contributions are made. The gate now consults a named
`followingYearContributionTags` list rather than a second `!==` term, because a
condition with two exceptions is where a third one gets forgotten.

**Coverage is Form W-2 box 13's "Retirement plan" checkbox**
(`box13RetirementPlan`), stored by `vnd.fjs.w2` since that dialect shipped and
read by **no computation until now** — the same `box13StatutoryEmployee` shape
this repository has already paid for twice.

---

## 3. The catch-up: an ASSERTED tag, and a refusal when it is missing and matters

`.planning/PERSONA-COVERAGE.md` records that **this repository stores no birth
date at all**, which is also why `form4972LumpSumDistribution` is refused.
§219(b)(5)(B)(ii) gives an extra $1,000 to an individual who attains age 50
before the close of the year, so the applicable dollar limit is $7,000 or $8,000
and nothing here can tell which.

Two of the three obvious policies are wrong in a way nobody downstream could
detect:

- **Silently allow the catch-up.** Overstates the deduction by up to $1,000 for
  every filer under 50 — and turns an *excess contribution* (§4973's 6% excise
  tax) into a deduction.
- **Silently cap at $7,000.** Understates it for every filer 50 or over. And it
  is worse than it looks, because **the catch-up scales the phase-out**:
  Worksheet 1-2 line 4's percentage is `dollarLimit ÷ range`, so at $82,000 of
  modified AGI the two candidates are $4,900 and $5,600 — the age matters at
  *any* contribution size once the phase-out bites, not only above $7,000.

What ships is both halves of the third option:

**(a) A second `lineTag`, `traditionalIraContributionAgeFiftyOrOver`, lets the
taxpayer assert the fact.** This is not an invention: `vnd.fjs.adjustments`
already carries `eligibleForCatchUpContribution` for §223(b)(3)'s age-55 health
savings account catch-up — the same kind of fact, one line up this same
schedule, on the same document. The brief for this work named "require a
declared assertion" as an option and said to add the tag(s) needed; a *tag*
rather than a dialect field is what makes it possible without editing
`fjs/document/adjustments` or `vnd.fjs.return_profile`, neither of which this
work may touch.

**(b) Where it is NOT asserted, the deduction is computed TWICE — once at
$7,000 and once at $8,000 — and the two are compared.**

- Agreeing means the unknown cannot change this return, and it computes. That
  is the ordinary case: a contribution at or below the phased limit is bounded
  by the contribution, not by the dollar limit.
- Disagreeing means it can, and the return **refuses**, naming both candidate
  figures and the tag that would answer the question.

This is exact rather than conservative. It never guesses, never silently
understates, and refuses on precisely the set of returns where the missing fact
is load-bearing.

**Untagged is not "under 50"** — it is unknown, and the code says so.

## 4. §219(b)(1)(B), compensation

> "The amount allowable as a deduction … shall not exceed the lesser of— (A) the
> deductible amount, or (B) an amount equal to the **compensation includible in
> the individual's gross income** for such taxable year."

Pub. 590-A Table 1-1 includes wages, salaries, commissions, self-employment
income, taxable alimony, nontaxable combat pay and taxable non-tuition
fellowship/stipend payments; it excludes interest, dividends, rents, pension and
annuity income, deferred compensation, and partnership income from a partnership
in which the taxpayer's services are not a material income-producing factor.

**Compensation here is the sum of Form W-2 box 1 over every stored W-2**, and
that is the whole of it, because every other includible item is a refused kind or
a documented zero on this engine's own face:

| Item | Where it would be | Status |
|---|---|---|
| taxable alimony received | Schedule 1 line 2a | `alimonyReceived`, refused |
| nontaxable combat pay | 1040 line 1i | documented zero |
| non-tuition fellowship/stipend | 1040 line 1h (other earned income) | documented zero |
| household employee wages | 1040 line 1b | `householdEmployeeWages`, refused |
| self-employment income | Schedule SE | **refused, see below** |

Worksheet 1-2 line 5 is *"your compensation minus any deductions on Schedule 1
line 15 (deductible part of self-employment tax), and Schedule 1 line 16
(self-employed SEP, SIMPLE, and qualified plans) … don't reduce your compensation
by any losses from self-employment."* With no self-employment both subtrahends
are zero and compensation is exactly the box 1 total.

**A return with self-employment earnings AND a traditional IRA contribution is
REFUSED.** §219(f)(1) pulls in §401(c)(2) earned income, which §401(c)(2) itself
limits to *"a trade or business in which personal services of the taxpayer are a
material income-producing factor"* — a fact no document this engine models
records — and which must then be reduced by Schedule 1 lines 15 and 16, the
second of which is `selfEmployedRetirementPlans`, still a refused kind. A
self-employed filer is also the one case where active-participant status
(§219(g)(5) reaches a SEP or a SIMPLE) has no Form W-2 box 13 to prove it. Three
missing facts at once is not an approximation worth making.

A return with **no compensation at all** is not a refusal: it is a determinate
`$0`, and it is proven as one.

---

## 5. Filing status

| Status | Treatment |
|---|---|
| `single`, `headOfHousehold` | computed; §219(g)(3)(B)(ii)'s $79,000 / $10,000 |
| `qualifyingSurvivingSpouse` | computed; §219(g)(3)(B)(i)'s $126,000 / **$20,000** (Notice 2024-80 names QSS explicitly) |
| `marriedFilingSeparately`, lived apart all year | computed as **single** — §219(g)(4) |
| `marriedFilingSeparately`, lived with spouse, taxpayer covered | computed; $0 / $10,000 |
| `marriedFilingSeparately`, lived with spouse, taxpayer NOT covered | **refused** |
| `marriedFilingJointly` | **refused** |

**Joint returns refuse, following `fjs/form8880` exactly.** §219(f)(2): *"The
maximum deduction under subsection (b) shall be computed **separately for each
individual**"*, and Pub. 590-A repeats it: *"Even though you file a joint return,
you must figure their IRA deductions separately."* Doing that needs three facts a
joint return here cannot supply:

1. **Which spouse is the active participant.** Coverage is Form W-2 box 13, and
   *nothing this engine models says which spouse a W-2 belongs to* —
   `vnd.fjs.return_profile` carries no taxpayer or spouse TIN. This is the same
   gap `fjs/schedule/1` line 13 already refuses for Form W-2 box 12 code W and
   `fjs/form8880` refuses for box 12 elective deferrals.
2. **Which range applies to which spouse.** §219(g)(7) gives a *non-covered*
   spouse married to a covered one a $236,000 threshold with a **$10,000** range
   where the covered spouse gets $126,000 with a $20,000 range. Attributing the
   coverage to the wrong spouse swaps two ranges $110,000 apart.
3. **Whose compensation.** §219(c)'s Kay Bailey Hutchison spousal IRA computes
   the lower-earning spouse's limit from the higher earner's compensation
   *reduced by that spouse's own already-determined §219 deduction and Roth
   contributions* — a per-person ordering over per-person W-2s.

**The MFS refusal is narrower and has a different reason.** §219(g)(1) reduces
the deduction when *"an individual **or the individual's spouse**"* is an active
participant, and a separate return carries no Form W-2 for the spouse — the fact
is absent, not merely unattributable. It only bites when the taxpayer is not
themselves covered: if they *are* covered, §219(g)(3)(B)(iii)'s $0 applicable
dollar amount already applies and the spouse's status cannot make it worse. And
if the couple lived apart for the whole year, §219(g)(4) *"shall not be treated
as married individuals for purposes of this subsection"* removes the dependence
entirely.

---

## 6. The other refusal: a contribution and a distribution in the same year

Pub. 590-A, verbatim: *"If you made contributions to your IRA for 2025 and
received a distribution from your IRA in 2025 … **you must figure the taxable
part of the traditional IRA distribution before you can figure your modified
AGI.** To do this, you can use Worksheet 1-1 in Pub. 590-B."* That worksheet
recovers basis pro-rata against the year-END basis, which includes the
nondeductible part of *this year's* contribution — which is
`contribution − line20`. **That one is a real fixed point**, and it is refused.

---

## 7. What is deliberately NOT modeled

- **§408(o)(2)(B)(ii)'s election.** Worksheet 1-2 line 7 reads *"Enter the
  smallest amount **(or a smaller amount if you choose)**"*: a taxpayer may elect
  to deduct less and treat the remainder as nondeductible basis. This engine
  computes the statutory maximum. Nothing on this return changes; a future year's
  Form 8606 basis would.
- **Form 8606 line 1.** Where line 20 is less than the contribution, the
  difference is nondeductible basis (Worksheet 1-2 line 8). `fjs/form8606`'s Part
  I exists; wiring the contribution side of it is a separate piece of work and is
  not this line.
- **§219(d)(2)–(4), (b)(2), (b)(4)** — rollovers, endowment contracts, inherited
  accounts, employer SEP and SIMPLE contributions are all outside §219(a)
  entirely. A `traditionalIraContribution` entry asserts that the payment *was* a
  §219(a) contribution, on the same trust boundary that an `educatorExpenses`
  entry asserts §62(d)(1)'s 900 hours. `vnd.fjs.adjustments`' own header is where
  that boundary is stated.
- **§219(d)(1)'s age-70½ ceiling is REPEALED** — SECURE Act, Pub. L. 116-94 div.
  O §107(a), for tax years beginning after 2019. There is no upper age limit and
  no code is written as though there were. Only the age-50 *floor* matters, and
  §3 above is what does with it.

## 8. Reclassification

`iraDeduction` moves from `unmodeledKindRefusals` to `modeledKinds` — **but not
in this change**, because `fjs/return/scope/module.f.js` and
`fjs/return/profile/module.f.js` are being edited concurrently by another author.
The exact edits are listed in this work's report. The kind stays refused until
they land, which means the line computes for every return that does not *declare*
it — the `educatorExpenses`/line 18 shape, where a modeled line reports what the
documents say and `declaredKinds` gates only refusals.

`vnd.fjs.return_profile`'s own `iraDeductionDeclared` flag (Phase 13, Decision
5.1) still refuses the whole return in `fjs/form1040/core`. It is left alone
here: it is a second route to the same refusal, its message is now factually
wrong about the fixed point, and narrowing or deleting it touches a stored
dialect's meaning. That is a decision for the same commit that reclassifies.
