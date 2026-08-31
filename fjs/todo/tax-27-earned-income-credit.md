# TAX-27: the Earned Income Credit — refused by Phase 25, COMPUTED by Phase 32

Status: **implemented.** `fjs/schedule/eic` computes §32 and 1040 line 27a
carries it. `earnedIncomeCredit` is in `fjs/return/scope`'s `modeledKinds`.

**This file is kept, not deleted, and the analysis below is kept in the present
tense it was written in.** Everything it says about what the profile could not
express was TRUE and was the reason to refuse; Phase 32 did not find a flaw in
it, it added the facts it asked for. A spec rewritten into the past tense once
it is satisfied stops being checkable against the thing that satisfied it.

## What Phase 32 shipped, against this file's own five-item list

The list is at the bottom, under "What a future phase must add". All five:

1. **The per-dependent widening** — `earnedIncomeCreditRelationship` (a checked
   §152(c)(2)/§152(f) vocabulary with an explicit negative arm),
   `earnedIncomeCreditFullTimeStudent`,
   `earnedIncomeCreditPermanentAndTotalDisability`,
   `earnedIncomeCreditUnitedStatesResidency` and
   `earnedIncomeCreditJointReturn`. **Not `or(option, true)`, against this file's
   own suggestion**, and that is the one place Phase 32 departed from it: each
   is two or more EXACT STRINGS, following `fjs/document/business_expenses`'
   SSTB-flag precedent, because under `or(option, true)` absence and a denial are
   the same stored state and here the wrong default GRANTS the credit. This
   file wrote *"Every one of these is `or(option, true)` under DOC-12 except the
   relationship"*; that was the wrong shape, for a reason the precedent that
   settles it had not yet established when this was written.
2. **The filer-level widening** — `filerSocialSecurityNumber`,
   `spouseSocialSecurityNumber`, `filerQualifyingChildOfAnotherTaxpayer`,
   `filerAttainedAgeTwentyFiveButNotSixtyFive` and
   `filerPrincipalPlaceOfAbode`. §32(c)(1)(A)(ii)(III) got no field of its own:
   `claimedAsDependent` (1040 line 12a) already carries exactly that fact.
3. **Schedule EIC and the §32 parameters** — `fjs/tax/params`'
   `earnedIncomeCredit`, four tiers each with citations, and
   `fjs/schedule/eic`, which is Worksheet A, Worksheet B and the 2025 EIC
   Table. The table is a RULE rather than stored data, and it reproduces all
   10,856 published entries.
4. **A §32(c)(2) earned income of its own** — 1040 line 1z plus Schedule SE
   line 3 less line 13. Nothing reads the profile's `earnedIncome`, exactly as
   this file demanded.
5. **Schedule E, or an explicit refusal, before §32(i) can be trusted** — and
   this is the item whose answer differs most from what this file expected. See
   the next section.

## §32(i): four components compute, one refuses

This file's argument was that even the disqualifier would be an
under-approximation. It named net rent and royalty income and net passive
income as the two missing pieces. Phase 32 checked both, and they turn out not
to be the same kind of problem at all:

- **Net passive income, §32(i)(2)(E), COMPUTES.** `fjs/schedule/e` carries a
  real §469 material-participation determination per entity
  (`vnd.fjs.k1_common`'s two exact strings, absence refusing), so every row
  this engine computes knows whether it is passive.
  `disqualifiedPassiveIncomeCents` sums the passive rows with
  §32(i)(2)(E)(i)'s own parenthetical applied — *"without regard to any amount
  included in earned income under subsection (c)(2)"* — as a per-row
  `max(0, income - self-employment earnings)`. It is zero for every return this
  engine can compute today, because `passiveIncomeOutsideSelfEmployment\
  Refusal` refuses the rows that would make it non-zero, but it is COMPUTED
  and will start producing figures if that refusal is ever lifted.
- **Net rent and royalty income, §32(i)(2)(C), REFUSES by name.** Schedule E
  Part I is still unmodeled, so the component is genuinely not computable.
  `rentAndRoyaltyRefusal` names it, for each of the three declarable kinds that
  could carry it. Two independent gates already make a non-zero (C) unreachable
  through a whole report — the scope refusal on those kinds, and document-level
  validation refusing a non-zero rent or royalty box on all three Schedule K-1
  dialects — and the module refuses anyway rather than relying on either,
  because a component that is silently zero on account of an upstream refusal
  is a component nobody can see go wrong when that refusal moves.

So this file's *"a partial EIC built on a partial disqualifier is worse than no
EIC"* still holds, and the answer to it was neither to refuse everything nor to
compute optimistically: a precise refusal for the one uncomputable component,
and a real computation for the other four.

## The one §32(c)(3) clause that is a stated trust boundary

**§152(c)(3)(A)'s *"younger than the taxpayer"* clause is not checked.** The
profile carries a dependent's age and the filer's §32(c)(1)(A)(ii) age BAND,
not the filer's age, so the comparison cannot be made. It is an accepted trust
boundary on the taxpayer's own declaration, mirroring the citizenship boundary
`fjs/schedule/8812` records. §152(c)(4)'s tie-breaker is the same, for the
reason this file already gives below: expressing it needs another person's
return. Both are recorded at the site, in `fjs/schedule/eic`'s docstring.

## The record of the refusal, as it stood

`earnedIncomeCredit` was in `fjs/return/scope`'s `unmodeledKindRefusals`, and
what Phase 25 changed was the remedy string: it used to say *"requires
Schedule EIC (no phase yet)"*, which tells a taxpayer to go and find a form
and tells the next engineer nothing at all. It then named the specific facts
this engine did not hold, so the refusal was something both of them could act
on. `theEarnedIncomeCreditRefusalNamesTheFactsThatAreMissing` pinned it; Phase
32 replaced that leaf with `theEarnedIncomeCreditIsModeledAndNoLongerRefuses`,
which asserts both halves of the partition rather than the wording of a message
that no longer exists.

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
   `filedAJointReturn`. Every one of these is `or(option, true)` under DOC-12
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
