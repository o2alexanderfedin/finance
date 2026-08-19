# Schedule 3 line 11 — excess Social Security tax withheld

**Status:** specified and implemented; the kind is **still refused** by
`fjs/return/scope` — see "The reclassification this does NOT do" at the end
**Kind:** `excessSocialSecurityWithheld`
**Printed line:** Schedule 3 line 11 -> 1040 line 31

## What is missing, and why it is only wiring

`vnd.fjs.w2` has carried `box4SocialSecurityTaxWithheld` since the dialect
shipped (`fjs/document/w2/module.f.js:122`), and the field is inside that
dialect's money-exactness loop, so every stored value is already validated to
the cent.

**No computation reads it.** It is the `box13StatutoryEmployee` shape this
repository has already paid for once and names in four places: the engine
validates the box at storage and then drops it.

`fjs/return/scope`'s refusal row for this kind is the only row in that whole
table whose remedy says **"no form is missing"** — it names the two things that
were absent as "the annual Social Security wage-base maximum" and "the
comparison". Phase 28 supplied the first
(`selfEmploymentTax.socialSecurityWageBase = '176100.00'`,
`fjs/tax/params/module.f.js:1879`). This spec supplies the second.

Schedule 3 line 11 is a `profileDeclaredZeroLine` today
(`fjs/schedule/3/module.f.js:646`), whose rule string calls itself
"theoretically W-2-derivable, out of this phase's scope".

## The parameter that is genuinely new: §3101(a)'s 6.2%

The rate is **not** stored anywhere. What `fjs/tax/params` holds today is
§1401(a)'s **12.4%** and §1401(b)'s 2.9% (`selfEmploymentTax.rates`, in basis
points) and §3101(b)'s 0.9%/1.45% (`additionalMedicareTaxRates`). None of them
is §3101(a).

**6.2% is stored as its own parameter and NOT derived as half of §1401(a)'s
12.4%.** The two figures are written into two different statutes in two
different chapters — chapter 21 (FICA, on an employee's wages) and chapter 2
(SECA, on a self-employed person's net earnings) — and each says its own
number outright. That they are 1:2 today is arithmetic, not law. This is the
`§3101(b)(2)`-versus-`§1411(b)` position `fjs/tax/params` already records three
times: two statutes that agree numerically are stored separately, because the
one that moves must be able to move alone. Compare §1402(a)(12), which the same
module cites as the reason 92.35% *is* derived — there the statute itself
performs the derivation, and here no statute does.

Stored in **basis points** (620), for the exactness reason
`additionalMedicareTaxRates`' own docstring states in full: 6.2 is not a whole
number of percent and `0.062` is not exact as an IEEE 754 double.

## The wage base is REUSED, not copied

`selfEmploymentTax.socialSecurityWageBase` carries `'176100.00'` with a
`§1402(b)(1)` citation. Line 11 needs the same base under `§3121(a)(1)`.

**One figure, read twice — not two figures that happen to agree.** §1402(b)(1)
and §3121(a)(1) do not each write a dollar amount; both say *"the contribution
and benefit base (as determined under section 230 of the Social Security
Act)"*. They point at one external object, so they cannot drift, and a second
stored copy could only ever introduce a disagreement that the statutes forbid.
This is exactly the case §3101(b)(2)-versus-§1411(b) is **not**: those two
sections each state their own literal dollar figures, which is why that pair is
stored twice and this one is not.

Consequence for `fjs/tax/params`' T-08-02 money round-trip list: nothing is
added to it, because no new money string is added.

## The computation

    maximumPerEmployee = socialSecurityWageBase x 620 basis points
                       = $176,100.00 x 6.2% = $10,918.20

    for each PERSON p (grouped by the W-2's own `recipientTin`):
        forms(p)    = every stored W-2 for p carrying box 4
        employers(p)= the DISTINCT `payerTin`s among forms(p)
        withheld(p) = SUM box4SocialSecurityTaxWithheld over forms(p)
        excess(p)   = employers(p) >= 2 ? max(0, withheld(p) - maximum) : 0

    line11 = SUM excess(p)

Three parts of that are not in "sum the boxes and subtract the cap", and each
one is a statute:

**§31(b) is a credit for the §6413(c) special refund, and §6413(c)(1) opens
with a condition.** *"…if by reason of an employee receiving wages from more
than one employer during a calendar year, the wages received by him during such
year exceed the contribution and benefit base…"*. More than one employer is
part of the entitlement, not background colour. The Schedule 3 instructions say
the same thing the other way round: *"If any one employer withheld too much
social security or tier 1 RRTA tax, you can't claim the excess as a credit
against your income tax. Your employer should adjust the excess for you."* A
single employer's over-withholding is the employer's to refund under
Reg. §31.6413(a)-1, and claiming it here would be claiming a refund twice.

**The base is per EMPLOYEE, so a joint return computes it twice.** §6413(c)(1)
is written about "an employee". A married couple filing jointly get one wage
base each; one shared cap would understate the refund by up to $10,918.20. The
grouping key is the W-2's own `recipientTin` (box a, the employee's SSN) and
**not** the return profile, which carries no TIN at all — which is also why
this needs no "which spouse does this W-2 belong to" answer, the question
`fjs/form8880` refuses a joint return for being unable to answer.

**Two W-2s from one employer are one employer.** A corrected form, a mid-year
successor filing, or a second form from the same EIN do not create a second
wage base. The count is over distinct `payerTin`, never over documents.

## Citations

Each Form W-2 **carrying** box 4 emits one `Source`:

    { documentHash, boxPath: 'box4SocialSecurityTaxWithheld', value }

**Presence, never value** — the rule `earlyWithdrawalPenaltyLine`
(`fjs/schedule/1`) states and this line copies. A W-2 that reported `'0.00'`
withholding said something; a return with no W-2 said nothing. The two are the
same number and different facts, and collapsing them would make the citation
claim a document the taxpayer does not hold.

Every W-2 carrying box 4 is cited, including the ones whose person did not
clear the two-employer gate. The cited set is the set the computation READ, and
a reader who is told line 11 is zero is owed the boxes that produced the zero.

A return with no Form W-2, or one where every box 4 is absent, keeps a computed
zero citing the profile — `documentLine`'s own fallback.

## What this line does NOT compute: tier-1 RRTA

The printed line is *"Excess social security and tier 1 RRTA tax withheld"*.
This engine models the social security half only. `vnd.fjs.w2` has **no box
14**, which is where a railroad employer reports tier-1 RRTA tax, and railroad
employment is outside FICA, so an RRTA figure cannot be entered here at all.
No stored figure is therefore dropped — but the kind's own label in
`fjs/return/scope` names tier-1 RRTA, and whoever reclassifies it must decide
whether that label is now half-true. Recorded here rather than in the code,
because it is a scope decision and not a computation.

## Proofs

Hand-typed expected values in integer cents, per AGENTS.md — never derived from
the code under test, and each with its dollar figure in the assertion message.
Value and citation are asserted by **separate leaves**.

Every fixture carries a realistic box 3 alongside box 4 (box 4 = 6.2% of box 3,
to the cent), so a transposition of the box read is observable rather than
absorbed.

- one employer, $6,200.00 withheld, under the cap -> `0n`, the document cited
- two employers, $6,200.00 + $5,952.00 -> `123380n` ($1,233.80)
- the same case, citations only: two sources, both `box4SocialSecurityTaxWithheld`,
  in document order
- boundary, exactly at the cap: $6,200.00 + $4,718.20 = $10,918.20 -> `0n`
- boundary, one cent over: $6,200.00 + $4,718.21 = $10,918.21 -> `1n`
- a W-2 with **no** box 4 is ignored: three forms, one without the box ->
  `123380n` still, and only two sources
- a W-2 with box 4 present and `'0.00'` cites the DOCUMENT; no W-2 at all cites
  the profile — two leaves, because they are the same number
- §6413(c)(1)'s gate: ONE employer withholding $12,000.00 (over the cap on its
  own) -> `0n`, and the document still cited
- two W-2s from the SAME `payerTin` totalling $12,152.00 -> `0n`
- a joint return, two `recipientTin`s -> `147560n` ($1,475.60), which is NOT
  what one shared cap would produce
- **added while writing the leaves**: two spouses with ONE employer each,
  $6,200.00 + $6,200.00 -> `0n`. The real couple's case, and the one where
  pooling the two would hand back $1,481.80 that is not owed. Without it, the
  per-employee grouping was pinned only by the four-W-2 joint fixture.
- line 11 reaches line 15, Part II's own total
- the hard zero is REPLACED: on a return carrying box 4, line 11 carries no
  `declaredKinds` source at all, and its rule names the printed line

## Mutations, and what each one actually did

AGENTS.md: "a proof is not known to work until you have watched it fail". Each
was applied by line number to a `tar` snapshot (a sibling agent was mid-edit in
`fjs/schedule/2` and `tsc` is repo-wide), each `diff` confirmed as exactly one
insertion and one deletion, and each reverted. Baseline **2277 pass, 0 fail**.

| # | Mutation | pass / fail | Leaves reddened |
|---|---|---|---|
| 1 | the summed cents multiplied by `0n` | 2271 / 6 | every non-zero value leaf |
| 2 | cap comparison `>` -> `>=` | **2277 / 0** | none — see below |
| 2b | cap comparison `>` -> `<` | 2270 / 7 | the under-cap leaf plus every over-cap leaf |
| 2c | `maximum + 1n` | 2271 / 6 | one-cent-over and every over-cap leaf |
| 2d | `maximum - 1n` | 2270 / 7 | exactly-at-the-maximum plus every over-cap leaf |
| 3 | floor at zero removed (`withheld - maximum`) | 2276 / 1 | `twoEmployersUnderTheMaximumIsZero` |
| 4 | box transposed, `box3SocialSecurityWages` read | 2268 / 9 | every value leaf and the source-value citation leaf |
| 5 | two-employer gate `< 2` -> `< 1` | 2275 / 2 | the §6413(c)(1) leaf and the one-EIN leaf |
| 6 | employers counted per DOCUMENT (`distinct` dropped) | 2276 / 1 | `twoW2sFromOneEmployerAreOneEmployer` |
| 6b | employer identity taken from `documentHash` | 2276 / 1 | the same leaf |
| 7 | employee identity taken from `formRevision` (one cap for the whole return) | 2275 / 2 | both spouse leaves |
| 8 | presence filter -> value filter (`'0.00'` dropped) | 2276 / 1 | `aZeroBoxFourStillCitesItsDocument` |
| 9 | `boxPath` string erased with `.slice(0, 0)` | 2274 / 3 | all three boxPath leaves |
| 10 | line 11 dropped from the Part II total | 2276 / 1 | `lineElevenReachesLineFifteen` |
| 11 | §3101(a)'s rate set to §1401(a)'s 1240 | 2269 / 8 | six line-11 leaves and both `fjs/tax/params` leaves |

**Mutation 2 is an equivalent mutant, and it was predicted as one.** `>` and
`>=` differ at exactly one input, `withheld === maximum`, and at that input the
other arm's subtraction yields `0n` — the same value the `0n` arm yields. The
neighbouring arithmetic absorbs the comparison entirely, so no input can
observe it. Recorded at the site in `fjs/schedule/3/module.f.js`, and confirmed
load-bearing anyway by 2b, 2c and 2d.

**No mutation survived that required a new leaf** — but one leaf was added
while the mutation list was being written, which is the same discipline arriving
one step earlier. Mutation 7 would have reddened only
`aJointReturnGetsOneWageBasePerSpouse`, a four-W-2 fixture in which every
person clears the two-employer gate anyway, so the grouping rule would have
been pinned only where it changes one refund into another.
`twoSpousesWithOneEmployerEachRefundNothing` pins it where it changes a **zero**
into a refund, which is the direction that costs money, and 7 now reddens both.

**Two mutations were added to the list after writing it**, because the code
grew a seam the list had not anticipated: extracting `employeeOf`/`employerOf`
(so the grouping key is named once and read twice, rather than spelled out at
both sites) made 6b and 7 single-line mutations that were previously
two-line ones.

## The reclassification this does NOT do

`fjs/return/scope` is deliberately untouched, so `excessSocialSecurityWithheld`
is **still in `unmodeledKindRefusals`** and a return declaring it still refuses
by name. This breaks "wire before reclassify" in the safe direction — the
computation exists and the gate has not opened — but it does leave the engine
computing a real line 11 for a return that never declared the kind. The
reclassification is a separate, deliberate step:

1. `modeledKinds` — add `'excessSocialSecurityWithheld'` after
   `'retirementSavingsContributionsCredit'` (Schedule 3 order), with a comment
   in the established `// W-2 box 4 -> Schedule 3 line 11 -> 1040 line 31`
   shape.
2. `unmodeledKindRefusals` — delete the `excessSocialSecurityWithheld` row, and
   correct the block comment above it: the paragraph explaining that this row's
   remedy is the only one saying "no form is missing" is describing a row that
   no longer exists.
3. `expectedModeledKindCount` +1, `expectedUnmodeledKindCount` -1.
4. `everyModeledKindHandTyped` — add the kind in `kindVocabulary` order (this
   list is hand-typed a SECOND time on purpose; both copies move).
5. `theNineScheduleThreeKindsThisPhaseDidNotWireStillRefuse` — drop the kind
   from `stillRefused`, drop the count by one, and drop the three assertions on
   its "no form is missing" refusal text, which will no longer be produced.
6. `theTwelveScheduleThreeKindsNameTheirOwnPrintedLine` does NOT change: it
   enumerates the twelve kinds and their printed lines regardless of which are
   modeled.

Whoever performs it must also answer the tier-1 RRTA question above: the kind's
`label` reads *"excess Social Security and tier-1 RRTA tax withheld"*, and only
the first half is computed.

## Not in scope

`box7SocialSecurityTips` is also stored and unread. It feeds box 4's own
withholding at source (§3121(q)) and does not enter this arithmetic — box 4 is
already the tax on wages **and** tips. Unreported tips are
`unreportedTips`/Form 4137, a different refused kind on Schedule 2.
