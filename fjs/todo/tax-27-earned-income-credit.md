# TAX-27: the Earned Income Credit, and why Phase 25 refused it

Status: **refused by name, not implemented.** Phase 25 (TAX-25/TAX-26/TAX-27)
shipped Form 8880 and Form 8863 and did **not** ship the Earned Income Credit.
This file is the record of that decision and the specification for whichever
phase reaches it.

`earnedIncomeCredit` stays in `fjs/return/scope`'s `unmodeledKindRefusals`.
What changed in Phase 25 is the remedy string: it used to say *"requires
Schedule EIC (no phase yet)"*, which tells a taxpayer to go and find a form
and tells the next engineer nothing at all. It now names the specific facts
this engine does not hold, so the refusal is something both of them can act
on. `theEarnedIncomeCreditRefusalNamesTheFactsThatAreMissing` pins it.

## Why refusing is the right outcome rather than a shortfall

The Earned Income Credit is the single largest source of error on real
returns, and it is the most audited line on the 1040. A wrong EIC is worse
than a refused one. Every other credit this engine computes has the property
that the facts it needs are either on a document or are a single taxpayer
assertion; the EIC's eligibility rules are neither.

**The rules do not resemble Schedule 8812's, and assuming they do is the
trap.** `vnd.fjs.return_profile`'s `dependents` array was designed for
Schedule 8812, whose qualifying-child test is exactly two facts — age under
17, and an employment-valid SSN — and whose own docstring records that the
citizenship test is an accepted trust boundary. §32(c)(3)'s test is a
different test with more parts, and the array cannot express most of them.

## What the profile cannot express, fact by fact

### The qualifying-child test, §32(c)(3)

| Fact the statute needs | What `dependents` carries |
|---|---|
| Relationship: child, stepchild, foster child, sibling, step- or half-sibling, or a descendant of any (§32(c)(3)(B)) | `relationship`, a FREE STRING with no vocabulary — nothing decides whether `'niece'` passes |
| Age: under 19; **or** under 24 and a full-time student; **or** any age if permanently and totally disabled (§32(c)(3)(C)) | `ageAtYearEnd` only. Neither the student status nor the disability is a field, so the second and third branches are unreachable |
| Residency: the same principal place of abode as the taxpayer **in the United States** for **more than half** the taxable year (§32(c)(3)(A)(ii)) | `livedWithTaxpayer`, a boolean with no duration and no country |
| The child did not file a joint return (§32(c)(3)(D)) | no field |
| The tie-breaker, where a child is the qualifying child of more than one person (§152(c)(4) as applied by §32(c)(1)(C)) | no field, and no way to express another person's return |

### The taxpayer's own eligibility

| Fact the statute needs | What the profile carries |
|---|---|
| For the CHILDLESS credit, age at least 25 and under 65 (§32(c)(1)(A)(ii)(II)) | `taxpayerBornBeforeJan2_1961` — a 65-or-older checkbox, and nothing else. The lower bound is unrepresentable |
| A valid SSN for the taxpayer and, on a joint return, the spouse (§32(m)) | no field; `ssnValidForEmployment` exists per DEPENDENT only |
| The taxpayer is not themselves the qualifying child of another person (§32(c)(1)(B)) | no field |
| U.S. citizen or resident alien for the whole year (§32(c)(1)(D)) | no field |
| Married filing separately is barred except under §32(d)(2)'s separated-spouse exception | `mfsLivedWithSpouseAtAnyTimeInYear` exists, but the exception also turns on a decree or on living apart for the last six months, neither of which is a field |
| No foreign earned income (Form 2555) | `foreignEarnedIncomeForm2555` is already a refused kind, so this one is covered |

### Earned income itself

`vnd.fjs.return_profile`'s `earnedIncome` is a taxpayer assertion added for
Schedule 8812's Part II-A. §32(c)(2)'s definition is not the same one — among
other differences it excludes pension and annuity income and admits an
election to include nontaxable combat pay — so reusing that field would be a
figure that is right for one credit and silently wrong for another. This is
TAX-15's own rule — the one whose repo-wide gate refuses that
four-letter lowercase spelling of *modified adjusted gross income* anywhere
under `fjs/`, and which this paragraph therefore has to describe rather than
quote — applied to earned income instead: two quantities with the same name
and different definitions is the error, not the duplication.

## What IS computable today, and why it is not enough

**The disqualified-investment-income test (§32(i))** — the credit is denied
outright above the threshold — is nearly computable from documents this engine
already holds: taxable interest (1040 line 2b), tax-exempt interest (line 2a),
ordinary dividends (line 3b) and capital gain net income (line 7a) are all
real figures. What is missing is the rest of §32(i)(2)'s list — net rent and
royalty income and net passive income — which arrive on Schedule E, which this
engine does not model and whose kind (`rentalRealEstateRoyaltiesPartnershipsS\
Corps`, the coarse `scheduleOneAdditionalIncome` until Phase 27 split Schedule
1 Part I) refuses.

So even the *disqualifier* would be an under-approximation: it would clear
some taxpayers it should not. A partial EIC built on a partial disqualifier is
worse than no EIC, which is the whole argument of this file in miniature.

## What a future phase must add

1. **A per-dependent widening of `vnd.fjs.return_profile`**: a checked
   `relationship` vocabulary, `wasAFullTimeStudent`, `permanentlyAndTotallyDisabled`,
   `livedWithTaxpayerInTheUnitedStatesForMoreThanHalfTheYear`, and
   `filedAJointReturn`. Every one of these is `option(true)` under DOC-12
   except the relationship. Note that this edits a stored dialect and
   therefore moves every `programHash` that quotes it (PROV-03/PROV-05).
2. **A filer-level widening**: the filer's own age (or an
   attained-25-and-under-65 assertion), SSN validity for filer and spouse, and
   the not-a-qualifying-child-of-another assertion.
3. **Schedule EIC and the §32 parameters**: the per-child credit percentages
   and phase-out percentages, the earned income amounts and phase-out
   thresholds (all indexed, all five statuses, three child counts plus
   childless), and §32(i)'s investment income limit.
4. **A §32(c)(2) earned income of its own**, named for what it is and NOT
   sharing `earnedIncome` with Schedule 8812.
5. **Schedule E**, or an explicit refusal, before §32(i) can be trusted.

Until all five exist, the honest output is the refusal that is there now.
