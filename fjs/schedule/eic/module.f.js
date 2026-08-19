/**
 * §32, the Earned Income Credit — TAX-27, Phase 32. 1040 line 27a.
 *
 * This module is the answer to `fjs/todo/tax-27-earned-income-credit.md`,
 * which is Phase 25's fact-by-fact record of why the credit was REFUSED
 * rather than computed. That file's argument was correct and is not
 * re-litigated here: Schedule 8812's `dependents` array carries four facts
 * and §32(c)(3) needs nine, so the credit could not be computed from what was
 * stored. Phase 32 stores the missing facts (`fjs/return/profile`'s ten
 * §32 vocabularies) and computes from them.
 *
 * ## The three printed pages this file is
 *
 * 1. **Worksheet A—2025 EIC—Line 27a**, for a filer with no self-employment.
 * 2. **Worksheet B—2025 EIC—Line 27a**, for one with it. The two differ in
 *    exactly one place — Worksheet B's Part 1 adds net earnings from
 *    self-employment to Step 5's wage figure — and they converge from Part 4
 *    onward. {@link earnedIncomeCreditEarnedIncome} writes the ONE expression
 *    that is both: for a return with no Schedule SE, Part 1 is zero and the
 *    expression collapses to Worksheet A's line 1. A second code path for the
 *    zero case would be two implementations of one rule.
 * 3. **The 2025 EIC Table**, which {@link earnedIncomeCreditTableLookup}
 *    computes rather than stores. See "The table is a rule, not a table"
 *    below.
 *
 * ## §32(c)(2) earned income is NOT `vnd.fjs.return_profile`'s `earnedIncome`
 *
 * That field is a taxpayer assertion added for Schedule 8812 Part II-A, and
 * `fjs/todo/tax-27-earned-income-credit.md` is explicit that reusing it would
 * be *"a figure that is right for one credit and silently wrong for
 * another"* — §32(c)(2)(B)(ii) excludes pensions and annuities, and
 * §32(c)(2)(B)(vi) admits a combat-pay election, neither of which Schedule
 * 8812's figure knows about. Nothing here reads it. Every component of
 * {@link earnedIncomeCreditEarnedIncome} is a computed 1040 or Schedule SE
 * line.
 *
 * The two printed pages resolve to exactly two live terms here, and the rest
 * are structural zeros this engine's own refusals produce:
 *
 * | Printed input | This engine |
 * |---|---|
 * | Step 5 line 1 — 1040 line 1z | LIVE. Equals line 1a, since `householdEmployeeWages` through `nontaxableCombatPayElection` (lines 1b-1i) are all `fjs/return/scope` refusals |
 * | Step 5 line 2 — Medicaid waiver payments on Schedule 1 line 8s | zero: `medicaidWaiverPayments` refuses, and as of the 2026-08-18 split its refusal row names Schedule 1 line 8s outright rather than a coarse `otherIncome` naming the whole block |
 * | Step 5 line 4 — nontaxable combat pay elected in | zero: `nontaxableCombatPayElection` refuses |
 * | Worksheet B line 1a — Schedule SE Part I line 3 | LIVE |
 * | Worksheet B line 1b — Schedule SE lines 4b and 5a | zero: `selfEmploymentOptionalMethods` and `churchEmployeeIncome` refuse |
 * | Worksheet B line 1d — Schedule SE Part I line 13 | LIVE, and SUBTRACTED — §32(c)(2)(A)(ii)'s *"determined with regard to the deduction allowed ... by section 164(f)"* |
 * | Worksheet B Part 2 — self-employed NOT filing Schedule SE | zero: this engine files Schedule SE for every proprietor it computes |
 * | Worksheet B Part 3 — statutory employee Schedule C line 1 | zero: `fjs/schedule/c` refuses the WHOLE return for a stored W-2 with box 13 checked |
 *
 * **W-2 box 11 was checked, not assumed.** A nonqualified-plan distribution
 * is a plausible §32(c)(2)(B)(ii) exclusion and `vnd.fjs.w2` stores box 11
 * without refusing a non-zero one. Publication 596 (2025) and the Form 1040
 * instructions' Step 5 both name NO box 11 adjustment — Step 5 line 1 is
 * 1040 line 1z and nothing is taken out of it — so no term is missing here.
 * Recorded because "a rule I could not find" and "a rule that does not
 * exist" are the same silence and different facts.
 *
 * ## The table is a RULE, not a table
 *
 * §32(f)(1) makes the credit *"determined under tables prescribed by the
 * Secretary"* and §32(f)(2) fixes those tables' brackets at *"not greater
 * than $50 each"*. The printed 2025 EIC Table is roughly 1,350 rows x 8
 * columns; storing it would be 10,856 hand-typed figures, which is not a
 * check anybody could perform. {@link earnedIncomeCreditTableLookup}
 * reproduces the arithmetic that GENERATES it instead, and the arithmetic was
 * derived by fitting candidate rules against the published table until one
 * matched every entry:
 *
 * ```
 * band       [a, a + 50)            a is a multiple of $50
 * midpoint   m = a + 25
 * phase-in   a + 50 > earnedIncomeAmount ? maximumCredit
 *                                        : round(creditPercent x m)
 * excess     a >= phaseoutAmount ? m - phaseoutAmount : 0
 * limitation round(maximumCredit - phaseoutPercent x excess)
 * credit     max(0, min(phase-in, limitation))          rounded HALF UP, to whole dollars
 * ```
 *
 * **The two straddle clauses are the whole of what is surprising**, and both
 * were found by a mismatch rather than by reading:
 *
 * - `a + 50 > earnedIncomeAmount` gives the FULL maximum to the band that
 *   contains the earned income amount, rather than the midpoint figure.
 *   One qualifying child, band $12,700-$12,750: the midpoint rule gives
 *   $12,725 x 34% = $4,326.50 -> $4,327, and the printed table says **$4,328**,
 *   the maximum. The band below it, $12,650-$12,700, is $4,310 = round($12,675
 *   x 34% = $4,309.50) — the midpoint rule exactly. So the straddle is a
 *   clause, not a different rule.
 * - `a >= phaseoutAmount` withholds the phase-out reduction from the band the
 *   phaseout amount falls INSIDE. Married filing jointly, band
 *   $30,450-$30,500 against a $30,470 phaseout amount: the reduction rule
 *   gives $4,328 - 15.98% x $25 = $4,327.20 -> $4,327, and the table says
 *   **$4,328**. This was the LAST mismatch — the first draft of this rule
 *   reproduced 10,853 of the published table's 10,856 entries and missed
 *   exactly these three (one per non-zero tier, all in that one band).
 *
 * Both clauses are the same convention read twice: a band part of which is
 * entitled to the better figure gets the better figure throughout. The final
 * rule reproduces **all 10,856** entries of the published 2025 EIC Table.
 *
 * **The maximum credit is the ROUNDED figure, and that is observable.** For
 * the childless tier the exact product is $8,490 x 7.65% = $649.485. The
 * printed table's band $19,000-$19,050 reads **$6**, which is
 * round($649 - 7.65% x $8,405) = round($6.0175); from $649.485 it would be
 * round($6.5025) = $7. This is why `fjs/tax/params` stores the maximum credit
 * rather than deriving it.
 *
 * ## §32(i), the disqualified-income test, component by component
 *
 * `fjs/todo/tax-27-earned-income-credit.md` records this as the reason a
 * partial EIC would have been worse than none: *"even the disqualifier would
 * be an under-approximation: it would clear some taxpayers it should not."*
 * That was true when it was written, and it is not true now — not because
 * more is modeled, but because the two things that were missing turn out to
 * be structurally unreachable, and one of them is genuinely COMPUTED rather
 * than assumed. Publication 596's Worksheet 1 is the printed page, and its
 * seven live lines map as follows:
 *
 * | Worksheet 1 | §32(i)(2) | This engine |
 * |---|---|---|
 * | 1 — 1040 line 2b | (A) interest includible in gross income | COMPUTED, 1099-INT boxes 1 and 3 |
 * | 2 — 1040 line 2a, plus Form 8814 line 1b | (B) tax-exempt interest | COMPUTED, 1099-INT box 8. Form 8814 is `form8814ChildInterestAndDividends`, a scope refusal |
 * | 3 — 1040 line 3b | (A) dividends includible in gross income | COMPUTED, 1099-DIV box 1a |
 * | 4 — Schedule 1 line 8z from Form 8814 | (A) | zero: `otherIncomeNotListed` (line 8z's residual kind, 2026-08-18) refuses, and so does Form 8814 |
 * | 5-7 — 1040 line 7a floored at zero, less Form 4797 line 7 | (D) capital gain net income, §1222(9) | COMPUTED, floored. Form 4797 is `otherGainsOrLosses`, a scope refusal |
 * | 8-10 — Schedule E line 23b royalties, less line 20 | (C) net rent and royalty | see {@link rentAndRoyaltyRefusal} |
 * | 11-13 — passive income less passive losses | (E) net passive income | COMPUTED, see {@link disqualifiedPassiveIncomeCents} |
 *
 * **(C), net rent and royalty income, is the one that REFUSES**, and
 * {@link rentAndRoyaltyRefusal} is now the ONLY gate rather than the second of
 * two. That correction is worth writing down rather than quietly editing:
 *
 * - Until printed Schedule E Part I shipped, a profile declaring
 *   `rentalRealEstateAndRoyalties` was refused whole by `fjs/return/scope`
 *   before any line was computed, and this refusal was described here as the
 *   belt to that brace. **The kind is MODELED now** — `fjs/schedule/e/part_i`
 *   computes a profitable rental and a royalty — so a return declaring it
 *   reaches this module, and {@link rentAndRoyaltyRefusal} is what stops the
 *   earned income credit being computed against a §32(i)(2)(C) component this
 *   engine cannot form. The refusal is DELIBERATELY left standing in the same
 *   change that built two of its three inputs: printed lines 23b and 20 now
 *   exist, and the §32 worksheet's *net rent* is neither of them and is not
 *   printed line 26 either.
 * - A stored Schedule K-1 carrying rent or a royalty is still refused at
 *   DOCUMENT VALIDATION: `vnd.fjs.k1_1065`'s `unmodeledMoneyBoxes` refuses a
 *   non-zero `box2NetRentalRealEstateIncome` and `box7Royalties`,
 *   `vnd.fjs.k1_1120s` its `box2NetRentalRealEstateIncome` and
 *   `box6Royalties`, and `vnd.fjs.k1_1041` its `box7NetRentalRealEstateIncome`
 *   and `box8OtherRentalIncome`. So a K-1's rent cannot enter through a
 *   document either.
 *
 * What remains outside both is a taxpayer with rent who declares nothing and
 * stores nothing — which is TAX-16's boundary, the reason
 * `vnd.fjs.return_profile` exists at all, and not a §32 question.
 *
 * **(E), net passive income, is COMPUTED and is not assumed to be zero.**
 * `fjs/schedule/e` carries a real §469 determination per entity
 * (`vnd.fjs.k1_common`'s `materialParticipation`, two exact strings, absence
 * refusing), so every row this engine computes knows whether it is passive.
 * {@link disqualifiedPassiveIncomeCents} sums the passive rows with
 * §32(i)(2)(E)(i)'s own parenthetical applied — *"determined without regard
 * to any amount included in earned income under subsection (c)(2)"* — which
 * is a per-row `max(0, income - self-employment earnings)`.
 *
 * That sum is zero for every return this engine can compute today, and
 * COMPUTING it rather than writing `0n` is the difference between a fact and
 * a belief. The reason it is zero is `fjs/schedule/e`'s own
 * `passiveIncomeOutsideSelfEmploymentRefusal`: a passive row whose income
 * exceeds its self-employment earnings refuses, for Form 8960 line 4a's sake.
 * Three row kinds exist and each lands the same way — a general partner who
 * did not materially participate computes only when the whole share is box 14
 * code A self-employment earnings; an S-corporation shareholder and an
 * estate-or-trust beneficiary have a structural zero for that term, so a
 * passive row computes only at zero income. Should that refusal ever be
 * lifted, this sum starts producing figures without a line of this file
 * changing.
 *
 * **Over the threshold is a COMPUTED ZERO, not a refusal.** §32(i)(1) denies
 * the credit; a denial is an answer. Only an uncomputable component refuses.
 *
 * ## What refuses, and the one clause that is a stated trust boundary
 *
 * Every §32 fact the profile does not carry refuses BY NAME, naming the
 * profile field that would carry it — and only when the answer depends on it.
 * A child aged 8 is never asked about full-time study, because §152(c)(3)(A)(i)
 * is already satisfied; that is `fjs/form8995a`'s own rule (refuse when the
 * fact is unstated AND the answer turns on it), followed here.
 *
 * The exception, stated rather than left silent: **§152(c)(3)(A)'s *"younger
 * than the taxpayer"* clause is not checked.** The profile carries a
 * dependent's age and the filer's §32(c)(1)(A)(ii) age BAND, not the filer's
 * age, so the comparison cannot be made. It is an accepted trust boundary on
 * the taxpayer's own declaration, mirroring exactly the citizenship boundary
 * `fjs/schedule/8812` records and the Form 8815 boundary `fjs/schedule/b`
 * records. It is written here because a boundary nobody stated is a boundary
 * nobody can review — and because §32(c)(3) has nine clauses and this file
 * checks eight.
 *
 * §32(c)(1)(C)'s Form 2555 exclusion needs no check here:
 * `foreignEarnedIncomeForm2555` is already an `fjs/return/scope` refusal, so
 * a filer claiming §911 cannot reach this module.
 *
 * @module
 */
import { assert, assertEq } from 'functionalscript/fjs/asserts/module.f.js'
import { of, halfUp } from '../../types/rational/module.f.js'
import { centsFromString } from '../../exact/module.f.js'
import { taxParamsByYear } from '../../tax/params/module.f.js'

/** @import { ReturnProfile } from '../../return/profile/module.f.js' */
/** @import { TaxParamSet, EarnedIncomeCreditChildTier, EarnedIncomeCreditTier } from '../../tax/params/module.f.js' */

/**
 * A case this module will not compute. Same `{ kind: 'error', message }`
 * shape as `fjs/schedule/e`'s and `fjs/schedule/c`'s refusals, so
 * `fjs/form1040/core` threads it up as a document-data-sufficiency refusal
 * that stops the WHOLE report — never a zero on line 27a.
 * @typedef {{ readonly kind: 'error', readonly message: string }} EarnedIncomeCreditRefusal
 */

/**
 * A computed credit, with the four intermediates a reader needs to check it:
 * how many qualifying children were counted, which §32(b) tier that put the
 * filer in, the §32(i) investment income figure, and the §32(c)(2) earned
 * income the table was read at.
 *
 * `creditCents` is `0n` for every DETERMINATION that denies the credit —
 * excessive investment income, an invalid social security number, being
 * another taxpayer's qualifying child, or simply being phased out. A zero
 * here always means "§32 answers zero", never "this engine could not tell".
 * @typedef {{
 *   readonly kind: 'ok',
 *   readonly qualifyingChildCount: number,
 *   readonly tier: EarnedIncomeCreditChildTier,
 *   readonly investmentIncomeCents: bigint,
 *   readonly earnedIncomeCents: bigint,
 *   readonly creditCents: bigint,
 * }} EarnedIncomeCreditResult
 */

/** @typedef {EarnedIncomeCreditResult | EarnedIncomeCreditRefusal} EarnedIncomeCreditOutcome */

/**
 * One passive row's two figures, as `fjs/schedule/e` publishes them. Declared
 * structurally rather than importing `ScheduleERow` and
 * `ScheduleEBeneficiaryRow` both, because §32(i)(2)(E) asks the same question
 * of both and the two types differ in fields this computation never reads.
 * @typedef {{
 *   readonly passive: boolean,
 *   readonly ordinaryBusinessIncomeCents: bigint,
 *   readonly selfEmploymentEarningsCents: bigint,
 * }} PassiveActivityRow
 */

/**
 * Everything §32 reads. Every field is a COMPUTED line or a stored profile,
 * never a re-derivation: `fjs/form1040/core` hands over the figures it has
 * already built, for the reason `fjs/schedule/se`'s own outcome docstring
 * gives about running a form twice.
 * @typedef {{
 *   readonly profile: ReturnProfile,
 *   readonly line1zCents: bigint,
 *   readonly scheduleSeLine3Cents: bigint,
 *   readonly scheduleSeLine13Cents: bigint,
 *   readonly adjustedGrossIncomeCents: bigint,
 *   readonly line2aCents: bigint,
 *   readonly line2bCents: bigint,
 *   readonly line3bCents: bigint,
 *   readonly line7aCents: bigint,
 *   readonly disqualifiedPassiveIncomeCents: bigint,
 * }} EarnedIncomeCreditInput
 */

/**
 * §32(i)(2)(E), computed over `fjs/schedule/e`'s rows.
 *
 * *"the excess (if any) of (i) the aggregate income from all passive
 * activities for the taxable year (determined without regard to any amount
 * included in earned income under subsection (c)(2) or described in a
 * preceding subparagraph), over (ii) the aggregate losses from all passive
 * activities."*
 *
 * The parenthetical is what the per-row `max(0, income - selfEmployment\
 * EarningsCents)` implements: net earnings from self-employment ARE earned
 * income under §32(c)(2)(A)(ii), so the part of a passive share that is also
 * a self-employment share is taken out before the aggregation, not after.
 *
 * The aggregate LOSSES term is structurally zero and stays out of the
 * expression rather than being written as `- 0n`: `fjs/schedule/e` refuses
 * every negative box 1 PER ROW, under §704(d)/§1366(d)/§465/§469, so no row
 * this function can be handed carries a loss. Writing the subtraction would
 * imply a figure that cannot exist.
 * @type {(rows: readonly PassiveActivityRow[]) => bigint}
 */
export const disqualifiedPassiveIncomeCents = rows =>
    rows.reduce(
        (total, row) => row.passive && row.ordinaryBusinessIncomeCents > row.selfEmploymentEarningsCents
            ? total + row.ordinaryBusinessIncomeCents - row.selfEmploymentEarningsCents
            : total,
        0n)

/**
 * The four Schedule 1 line 5 kinds that could carry §32(i)(2)(C) rent or
 * royalty income, in `kindVocabulary` order.
 *
 * `partnershipAndSCorporationIncome` and `estateAndTrustIncome` are the two
 * Schedule E kinds deliberately ABSENT from this list, and the reason is the
 * printed schedule rather than convenience: Part II and Part III carry
 * ordinary business income, and a rent or royalty on either of their source
 * documents refuses at document validation (`vnd.fjs.k1_1065` box 2 and box
 * 7, `vnd.fjs.k1_1120s` box 2 and box 6, `vnd.fjs.k1_1041` box 7 and box 8).
 * `vnd.fjs.k1_1065`'s own remedy string states this: a royalty is *"Schedule
 * E Part I line 4 ... Part I, not Part II, which is why a royalty cannot ride
 * into line 41 on this schedule's partnership block"*.
 * @type {readonly string[]}
 */
const rentAndRoyaltyKinds = [
    'rentalRealEstateAndRoyalties',
    'remicResidualInterest',
    'netFarmRentalIncomeForm4835',
]

/**
 * §32(i)(2)(C)'s refusal — the one disqualified-income component that is not
 * computable, named for what is missing rather than for the schedule.
 *
 * `fjs/return/scope` used to refuse all three kinds before a report reached
 * this module, and this refusal was written as the check that would survive
 * that upstream refusal being lifted. **It has been**, for
 * `rentalRealEstateAndRoyalties`, and this function is now the only thing
 * standing between a landlord and an earned income credit computed against a
 * disqualified-income component that does not exist. Written down as evidence
 * that the reasoning was worth the trouble: "a component that is silently zero
 * because something upstream happens to refuse is a component nobody can see
 * go wrong when the upstream refusal is lifted".
 * @type {(kind: string) => EarnedIncomeCreditRefusal}
 */
export const rentAndRoyaltyRefusal = kind => ({
    kind: 'error',
    message: `1040 line 27a: the return declares ${kind}, so §32(i)(2)(C) — the excess of gross `
        + 'income from rents or royalties not derived in the ordinary course of a trade or '
        + 'business over the deductions allocable to it — is not computable. Printed Schedule E '
        + 'Part I lines 4, 20 and 23b now COMPUTE (fjs/schedule/e/part_i), and this component '
        + 'is still not one of them: the §32 worksheet asks for the NET rent as well as the '
        + 'royalty, and "not derived in the ordinary course of a trade or business" is a '
        + 'determination about each property that no line of Part I makes — printed line 26 is '
        + 'the whole of Part I, trade-or-business rents included, and is not the figure §32 '
        + 'wants. §32(i)(1) denies the earned income credit OUTRIGHT above $11,950 of '
        + 'disqualified income, so refusing beats under-approximating the disqualifier and '
        + 'granting the credit to someone ineligible',
})

/**
 * A §32 fact the profile does not carry, named together with the field that
 * would carry it and the statute that asks for it. One constructor for all of
 * them, so a reader sees one message shape and a caller cannot invent a
 * second vocabulary (AGENTS.md, "one rule, one place").
 * @type {(field: string) => (section: string) => (question: string) => EarnedIncomeCreditRefusal}
 */
export const unstatedFactRefusal = field => section => question => ({
    kind: 'error',
    message: `1040 line 27a: ${section} asks whether ${question}, and the return profile does `
        + `not state it — ${field} is absent. An absent answer is not a no: reading it as one `
        + 'would deny a credit that may be owed, and reading it as a yes would grant one that '
        + 'may not be. Set it on the vnd.fjs.return_profile document and recompute',
})

/**
 * The same, for a fact carried per dependent — the index is the only part of
 * the message a filer with three children can act on.
 * @type {(index: number) => (field: string) => (section: string) => (question: string) => EarnedIncomeCreditRefusal}
 */
export const unstatedDependentFactRefusal = index => field => section => question => ({
    kind: 'error',
    message: `1040 line 27a: ${section} asks whether ${question}, and the return profile does `
        + `not state it for dependents[${index}] — ${field} is absent. An absent answer is not `
        + 'a no: reading it as one would deny a credit that may be owed, and reading it as a '
        + 'yes would grant one that may not be. Set it on the vnd.fjs.return_profile document '
        + 'and recompute',
})

/**
 * §32(d)(1)'s married-filing-separately bar, and §32(d)(2)(B)'s exception to
 * it, which this engine cannot evaluate.
 *
 * Rev. Proc. 2024-40 §2.06(1) is explicit that a separated spouse who
 * satisfies §32(d) uses the *"all other filing statuses"* thresholds rather
 * than the joint ones, so the exception is not merely a yes/no gate — it
 * changes which of two stored parameter columns applies. What it turns on is
 * three facts, and the profile carries none of them: residing with a
 * qualifying child for more than half the year, not sharing a principal place
 * of abode with the spouse during the last six months, and a §121(d)(3)(C)
 * decree or agreement.
 * @type {EarnedIncomeCreditRefusal}
 */
export const marriedFilingSeparatelyRefusal = {
    kind: 'error',
    message: '1040 line 27a: §32(d)(1) allows the earned income credit to a married individual '
        + 'only on a joint return, and §32(d)(2)(B) excepts a separated spouse who resides with '
        + 'a qualifying child for more than half the year and either lived apart from their '
        + 'spouse for the last six months or holds a decree described in §121(d)(3)(C). This '
        + 'engine holds none of those three facts — mfsLivedWithSpouseAtAnyTimeInYear is a '
        + 'different question, about a different half of the year, for a different worksheet — '
        + 'and Rev. Proc. 2024-40 §2.06(1) gives a filer who meets the exception the ALL OTHER '
        + 'FILING STATUSES phaseout amounts rather than the joint ones, so the answer is not a '
        + 'yes-or-no gate but a choice between two parameter columns. Refusing rather than '
        + 'guessing which column applies (no phase yet)',
}

/**
 * §32(c)(1)(D)'s nonresident-alien bar, reached through the profile's own
 * line 12c checkbox.
 *
 * A dual-status year is by definition one with a nonresident portion, and
 * §32(c)(1)(D) excludes an individual who *"is a nonresident alien individual
 * for any portion of the taxable year"* unless a §6013(g)/(h) election makes
 * them a resident for the whole of it. The election is not a field, so the
 * exception cannot be evaluated and the checkbox refuses.
 *
 * The residual — a filer who is neither dual-status nor electing, and whose
 * citizen-or-resident-all-year status §32(c)(1)(D) still asks about — is a
 * stated TRUST BOUNDARY, the same one `fjs/schedule/8812` records for
 * §24(h)(4)(C) citizenship: the taxpayer's act of filing a Form 1040 as a
 * resident asserts it, and no information return reports it.
 * @type {EarnedIncomeCreditRefusal}
 */
export const dualStatusAlienRefusal = {
    kind: 'error',
    message: '1040 line 27a: the return profile checks dualStatusAlien (1040 line 12c), and '
        + '§32(c)(1)(D) excludes an individual who is a nonresident alien for ANY portion of '
        + 'the taxable year unless an election under §6013(g) or §6013(h) treats them as a '
        + 'resident for the whole of it. This engine holds no such election, so it cannot tell '
        + 'a dual-status filer who qualifies from one who does not. Refusing rather than '
        + 'granting the earned income credit for a year with a nonresident portion (no phase yet)',
}

// ── The EIC Table ────────────────────────────────────────────────────────────

/**
 * One band's credit, in cents, for one tier and one phaseout amount — the
 * arithmetic that generates the printed 2025 EIC Table, stated in full in
 * this module's own docstring.
 *
 * `lookupCents` below $1 yields `0n` and does NOT fall into the first band:
 * the printed table's first row is *"At least 1, But less than 50"*, so 50
 * cents has no row, and giving it the $1-$50 band's $2 would be inventing an
 * entry.
 *
 * Every rounding is half-up to WHOLE DOLLARS, which is what the printed table
 * carries — never to the cent. `$649.485` is the figure that distinguishes
 * the two, and it is why `fjs/tax/params` stores the maximum credit.
 * @type {(bandWidthCents: bigint) => (tier: EarnedIncomeCreditTier) => (phaseoutAmountCents: bigint) => (lookupCents: bigint) => bigint}
 */
export const earnedIncomeCreditTableLookup = bandWidthCents => tier => phaseoutAmountCents => lookupCents => {
    if (lookupCents < 100n) {
        return 0n
    }
    const maximumCredit = centsFromString(tier.maximumCredit.amount)
    // §32(b)(2)'s completed phaseout amount, DERIVED rather than stored — the
    // position `fjs/tax/params` takes and
    // `earnedIncomeCreditCompletedPhaseoutAmountsMatchTheRevenueProcedure`
    // checks against all eight printed figures. It is needed here because the
    // printed table's LAST band is truncated at it; see below.
    const completedPhaseout = halfUp(of(
        phaseoutAmountCents
        + halfUp(of(maximumCredit * 10000n)(BigInt(tier.phaseoutPercentBasisPoints))))(100n)) * 100n
    if (lookupCents >= completedPhaseout) {
        return 0n
    }
    const bandStart = lookupCents / bandWidthCents * bandWidthCents
    // **The LAST band is TRUNCATED at the completed phaseout amount, and its
    // midpoint moves with it.** This is the third clause of the printed
    // table's construction, and — like the two straddle clauses — it was found
    // by a mismatch rather than by reading.
    //
    // The printed table marks exactly six cells with an asterisk instead of a
    // figure, one per tier-and-column at the band the completed phaseout
    // amount falls inside, and the footnote splits that band in two: a credit
    // for the part below the completed amount, and "you can't take the credit"
    // above it. Married filing jointly with two qualifying children, band
    // $64,400-$64,450 against a $64,430 completed amount, reads **$3**. The
    // untruncated midpoint $64,425 gives $7,152 - 21.06% x $33,955 = $1.077 ->
    // $1. The truncated sub-band [$64,400, $64,430) has midpoint $64,415, and
    // $7,152 - 21.06% x $33,945 = $3.2 -> $3.
    //
    // Five of the six footnotes were WRONG under the untruncated rule, by one
    // to three dollars each, and the sixth (childless, all other statuses) was
    // right only because both halves of its split are zero. All six are
    // reproduced now, and so are the 10,856 unfootnoted cells — 10,862
    // published entries in total.
    //
    // The `/ 2n` is exact rather than truncating: `bandStart` is a whole
    // multiple of the band width and `bandEnd` is either that or a whole
    // number of dollars, so their sum in cents is always a multiple of 100.
    const untruncatedEnd = bandStart + bandWidthCents
    const bandEnd = untruncatedEnd < completedPhaseout ? untruncatedEnd : completedPhaseout
    const midpoint = (bandStart + bandEnd) / 2n
    // Phase-in, §32(a)(1). The straddle clause: a band that REACHES the
    // earned income amount gets the maximum, not the midpoint figure.
    const phaseIn = untruncatedEnd > centsFromString(tier.earnedIncomeAmount.amount)
        ? maximumCredit
        : halfUp(of(midpoint * BigInt(tier.creditPercentBasisPoints))(1000000n)) * 100n
    // Limitation, §32(a)(2). The mirror straddle clause: a band the phaseout
    // amount falls INSIDE takes no reduction at all.
    const excess = bandStart >= phaseoutAmountCents ? midpoint - phaseoutAmountCents : 0n
    const reduction = excess * BigInt(tier.phaseoutPercentBasisPoints)
    const scaled = maximumCredit * 10000n
    // Guarded rather than clamped afterwards: `halfUp` of a negative rational
    // is a question this file has no reason to ask, and a phased-out band is
    // the ordinary case rather than an edge one.
    const limitation = scaled <= reduction ? 0n : halfUp(of(scaled - reduction)(1000000n)) * 100n
    return phaseIn < limitation ? phaseIn : limitation
}

// ── §32(c)(2) earned income ──────────────────────────────────────────────────

/**
 * Worksheet B line 4b, which is Worksheet A line 1 whenever Part 1 is zero —
 * see this module's own docstring for the eight printed inputs and which
 * three of them are live.
 *
 * Line 1e can be NEGATIVE in principle (Schedule SE line 13 is half of the
 * self-employment tax on line 3, so it cannot exceed it — but a caller is not
 * required to know that), and Worksheet B's own Part 4 note handles a
 * non-positive total by stopping. That stop is the caller's, not this
 * function's: this returns the figure the worksheet computes, and
 * {@link earnedIncomeCredit} applies §32's own consequence.
 * @type {(input: EarnedIncomeCreditInput) => bigint}
 */
export const earnedIncomeCreditEarnedIncome = input =>
    input.line1zCents + input.scheduleSeLine3Cents - input.scheduleSeLine13Cents

// ── §32(i) disqualified income ───────────────────────────────────────────────

/**
 * Publication 596 Worksheet 1 line 14 — the aggregate of §32(i)(2)'s five
 * subparagraphs, in cents.
 *
 * Line 5's *"if the amount on that line is a loss, enter -0-"* is §1222(9)
 * read as the statute writes it: capital gain net income is *"the excess of
 * the gains ... over the losses"*, and a net loss is no excess. 1040 line 7a
 * genuinely can be negative — Schedule D allows a $3,000 capital loss
 * deduction — so this floor is a live branch rather than a defensive one.
 * @type {(input: EarnedIncomeCreditInput) => bigint}
 */
export const earnedIncomeCreditInvestmentIncome = input =>
    input.line2bCents
    + input.line2aCents
    + input.line3bCents
    + (input.line7aCents > 0n ? input.line7aCents : 0n)
    + input.disqualifiedPassiveIncomeCents

// ── §32(c)(3) the qualifying-child test ──────────────────────────────────────

/**
 * One dependent's §32(c)(3) verdict: counted, not counted, or a refusal
 * naming the fact that is missing.
 *
 * `'notCounted'` is a real answer rather than a failure. A dependent parent
 * is no §152(c)(2) relation, a child who filed a joint return is barred by
 * §152(c)(1)(E), and a 30-year-old who is neither a student nor disabled
 * fails §152(c)(3) — in every one of those cases the filer may still be
 * entitled to the CHILDLESS credit, so the return computes.
 * @typedef {{ readonly kind: 'counted' } | { readonly kind: 'notCounted' } | EarnedIncomeCreditRefusal} QualifyingChildVerdict
 */

/**
 * §32(c)(3), applied to one entry of the profile's `dependents` array, in the
 * order the printed Step 3 asks its questions.
 *
 * **§32(c)(3)(D) and §32(m) — the SSN test — is checked LAST and does not
 * refuse.** `ssnValidForEmployment` is `option(true)`, this dialect's original
 * checkbox convention, so an absent field means "not asserted" and the child
 * is simply not taken into account under §32(b). That reading is safe here in
 * a way it is not for the ten fields Phase 32 added, and the reason is a
 * repeal: §32(c)(1)(F) once denied the credit ENTIRELY to a filer with
 * children none of whom had a valid SSN, and Pub. L. 117-2 §9622(a) struck it
 * out. So an uncounted child now moves the filer to the childless tier, which
 * is a SMALLER credit — the conservative direction — rather than to a denial.
 *
 * **The age test's three branches are asked only when they bite.** Under 19
 * settles §152(c)(3)(A)(i) with no further question, so a return with young
 * children never refuses for an unstated student or disability fact. At 19 or
 * over the student branch is asked first and the disability branch second,
 * because §152(c)(3)(B) *"shall be treated as met"* regardless of age and can
 * therefore rescue a child the student branch cannot. At 24 or over the
 * student branch cannot help at any answer, so only the disability fact is
 * required — asking for a student answer there would refuse for a fact that
 * changes nothing.
 * @type {(index: number) => (entry: ReturnProfile['dependents'] extends readonly (infer T)[] | undefined ? T : never) => QualifyingChildVerdict}
 */
export const qualifyingChildVerdict = index => entry => {
    const refuse = unstatedDependentFactRefusal(index)
    // §32(c)(3)(A) -> §152(c)(1)(A) and (c)(2), read through §152(f).
    const relationship = entry.earnedIncomeCreditRelationship
    if (relationship === undefined) {
        return refuse('earnedIncomeCreditRelationship')('§32(c)(3)(A), through §152(c)(2)')(
            'the dependent is a child, stepchild, eligible foster child, sibling, or a '
            + 'descendant of any of those')
    }
    if (relationship === 'notAnEarnedIncomeCreditRelationship') {
        return { kind: 'notCounted' }
    }
    // §32(c)(3)(C) -> §152(c)(1)(B), narrowed to an abode IN THE UNITED STATES.
    const residency = entry.earnedIncomeCreditUnitedStatesResidency
    if (residency === undefined) {
        return refuse('earnedIncomeCreditUnitedStatesResidency')('§32(c)(3)(C), through §152(c)(1)(B)')(
            'the dependent shared the taxpayer’s principal place of abode IN THE UNITED STATES '
            + 'for more than half the year')
    }
    if (residency === 'didNotShareTheTaxpayersUnitedStatesAbodeForMoreThanHalfTheYear') {
        return { kind: 'notCounted' }
    }
    // §152(c)(1)(E).
    const jointReturn = entry.earnedIncomeCreditJointReturn
    if (jointReturn === undefined) {
        return refuse('earnedIncomeCreditJointReturn')('§32(c)(3)(A), through §152(c)(1)(E)')(
            'the dependent filed a joint return with a spouse')
    }
    if (jointReturn === 'filedAJointReturn') {
        return { kind: 'notCounted' }
    }
    // §152(c)(3). Under 19 settles it; 19 through 23 admits the student
    // branch; any age admits the disability branch.
    const disability = entry.earnedIncomeCreditPermanentAndTotalDisability
    if (entry.ageAtYearEnd >= 19) {
        const student = entry.ageAtYearEnd < 24 ? entry.earnedIncomeCreditFullTimeStudent : 'wasNotAFullTimeStudent'
        if (student === undefined) {
            return refuse('earnedIncomeCreditFullTimeStudent')('§152(c)(3)(A)(ii), through §152(f)(2)')(
                'the dependent was a full-time student for five calendar months of the year')
        }
        if (student !== 'wasAFullTimeStudent') {
            if (disability === undefined) {
                return refuse('earnedIncomeCreditPermanentAndTotalDisability')('§152(c)(3)(B), through §22(e)(3)')(
                    'the dependent was permanently and totally disabled at any time during the year')
            }
            if (disability !== 'permanentlyAndTotallyDisabled') {
                return { kind: 'notCounted' }
            }
        }
    }
    // §32(c)(3)(D) and §32(m) — see this function's own docstring for why an
    // absent answer here does not refuse.
    return entry.ssnValidForEmployment === true ? { kind: 'counted' } : { kind: 'notCounted' }
}

/**
 * The §32(b) tier for a count of qualifying children. Three or more share one
 * row of the statute's table, which is why the fourth child changes nothing.
 * @type {(count: number) => EarnedIncomeCreditChildTier}
 */
export const earnedIncomeCreditTierFor = count =>
    count <= 0 ? 'none' : count === 1 ? 'one' : count === 2 ? 'two' : 'threeOrMore'

// ── The credit ───────────────────────────────────────────────────────────────

/**
 * §32, end to end: the gates, the qualifying-child count, the
 * disqualified-income test, and Worksheet A's two table lookups.
 *
 * The ORDER is the printed Steps' own, and it is load-bearing rather than
 * tidy — a filer barred by §32(d)(1) should be told that, not told about an
 * unstated disability fact three dependents down.
 * @type {(taxParamSet: TaxParamSet) => (input: EarnedIncomeCreditInput) => EarnedIncomeCreditOutcome}
 */
export const earnedIncomeCredit = taxParamSet => input => {
    const { profile } = input
    const params = taxParamSet.earnedIncomeCredit
    // Step 1 — §32(d)(1), and §32(c)(1)(D) through line 12c.
    if (profile.filingStatus === 'marriedFilingSeparately') {
        return marriedFilingSeparatelyRefusal
    }
    if (profile.dualStatusAlien !== undefined) {
        return dualStatusAlienRefusal
    }
    // §32(i)(2)(C) — the one disqualified-income component that is not
    // computable, refused before anything is figured.
    const declaredRentKind = profile.declaredKinds.find(kind => rentAndRoyaltyKinds.includes(kind))
    if (declaredRentKind !== undefined) {
        return rentAndRoyaltyRefusal(declaredRentKind)
    }
    // Step 1 — §32(c)(1)(E) and §32(m), the filer's own social security
    // number, and the spouse's on a joint return.
    const filerSsn = profile.filerSocialSecurityNumber
    if (filerSsn === undefined) {
        return unstatedFactRefusal('filerSocialSecurityNumber')('§32(c)(1)(E), through §32(m)')(
            'the filer’s social security number is valid for employment and was issued by the '
            + 'return’s due date')
    }
    const joint = profile.filingStatus === 'marriedFilingJointly'
    const spouseSsn = profile.spouseSocialSecurityNumber
    if (joint && spouseSsn === undefined) {
        return unstatedFactRefusal('spouseSocialSecurityNumber')('§32(c)(1)(E)(ii), through §32(m)')(
            'the spouse’s social security number is valid for employment and was issued by the '
            + 'return’s due date')
    }
    // Step 2 — §32(c)(1)(B). Asked of every filer, with or without children.
    const otherTaxpayersChild = profile.filerQualifyingChildOfAnotherTaxpayer
    if (otherTaxpayersChild === undefined) {
        return unstatedFactRefusal('filerQualifyingChildOfAnotherTaxpayer')('§32(c)(1)(B)')(
            'the filer is themselves the qualifying child of another taxpayer')
    }
    // Step 3 — §32(c)(3), one dependent at a time.
    const verdicts = (profile.dependents ?? []).map((entry, index) => qualifyingChildVerdict(index)(entry))
    const refusal = verdicts.find(verdict => verdict.kind === 'error')
    if (refusal !== undefined) {
        return refusal
    }
    const qualifyingChildCount = verdicts.filter(verdict => verdict.kind === 'counted').length
    const tier = earnedIncomeCreditTierFor(qualifyingChildCount)
    // Step 4 — §32(c)(1)(A)(ii)'s three conditions, which apply ONLY to a
    // filer with no qualifying child. Asked here rather than above precisely
    // because they do not bite for a filer with one: a 22-year-old parent is
    // an eligible individual under §32(c)(1)(A)(i), and refusing them for an
    // unstated age-band assertion would refuse for a fact §32 never reads.
    const abode = profile.filerPrincipalPlaceOfAbode
    const ageBand = profile.filerAttainedAgeTwentyFiveButNotSixtyFive
    if (tier === 'none') {
        if (abode === undefined) {
            return unstatedFactRefusal('filerPrincipalPlaceOfAbode')('§32(c)(1)(A)(ii)(I)')(
                'the filer’s principal place of abode was in the United States for more than '
                + 'half the year')
        }
        if (ageBand === undefined) {
            return unstatedFactRefusal('filerAttainedAgeTwentyFiveButNotSixtyFive')('§32(c)(1)(A)(ii)(II)')(
                'the filer, or the spouse on a joint return, attained age 25 but not age 65 '
                + 'before the close of the taxable year')
        }
    }
    const investmentIncomeCents = earnedIncomeCreditInvestmentIncome(input)
    const earnedIncomeCents = earnedIncomeCreditEarnedIncome(input)
    /** @type {(creditCents: bigint) => EarnedIncomeCreditResult} */
    const result = creditCents => ({
        kind: 'ok', qualifyingChildCount, tier, investmentIncomeCents, earnedIncomeCents, creditCents,
    })
    // Every DETERMINATION that denies the credit lands here, as a computed
    // zero. §32(i)(1) is checked before the table because it denies the credit
    // outright rather than reducing it.
    if (
        filerSsn !== 'validForEmployment'
        || (joint && spouseSsn !== 'validForEmployment')
        || otherTaxpayersChild !== 'isNotAnotherTaxpayersQualifyingChild'
        || investmentIncomeCents > centsFromString(params.investmentIncomeLimit.amount)
        || earnedIncomeCents <= 0n
        || (tier === 'none' && (
            abode !== 'inTheUnitedStatesForMoreThanHalfTheYear'
            || ageBand !== 'attainedAgeTwentyFiveButNotSixtyFive'
            // §32(c)(1)(A)(ii)(III), read off 1040 line 12a rather than off a
            // field of its own — see `fjs/return/profile`'s own note.
            || profile.claimedAsDependent !== undefined))
    ) {
        return result(0n)
    }
    // Worksheet A. Line 2 is the table read at earned income; line 5 is the
    // table read at adjusted gross income, and it is read ONLY when adjusted
    // gross income reaches the phaseout amount — below it the table cannot
    // return a smaller figure, and the printed worksheet says so with its own
    // "leave line 5 blank".
    const tierParams = params.tiers[tier]
    const phaseoutAmountCents = centsFromString(
        (joint ? tierParams.phaseoutAmount.marriedFilingJointly : tierParams.phaseoutAmount.other).amount)
    const bandWidthCents = centsFromString(params.bandWidth.amount)
    const lookup = earnedIncomeCreditTableLookup(bandWidthCents)(tierParams)(phaseoutAmountCents)
    const fromEarnedIncome = lookup(earnedIncomeCents)
    const agi = input.adjustedGrossIncomeCents
    if (agi === earnedIncomeCents || agi < phaseoutAmountCents) {
        return result(fromEarnedIncome)
    }
    const fromAdjustedGrossIncome = lookup(agi)
    return result(fromEarnedIncome < fromAdjustedGrossIncome ? fromEarnedIncome : fromAdjustedGrossIncome)
}

// ── Tests ────────────────────────────────────────────────────────────────────

/** TY2025's parameter set, narrowed exactly ONCE at module scope. */
const taxParams2025 = (() => {
    const set = taxParamsByYear[2025]
    assert(set !== undefined, 'TY2025 parameters must exist')
    return set
})()

/**
 * A single filer with one qualifying nine-year-old daughter, every §32 fact
 * stated. Every fixture below is this plus one deliberate change, so a leaf's
 * failure localizes to that change.
 * @type {ReturnProfile}
 */
const oneChildProfile = {
    dialect: 'vnd.fjs.return_profile',
    taxYear: 2025,
    filingStatus: 'single',
    dependentCount: 1,
    declaredKinds: ['wages', 'earnedIncomeCredit'],
    dependents: [{
        relationship: 'daughter',
        ssnValidForEmployment: true,
        ageAtYearEnd: 9,
        livedWithTaxpayer: true,
        earnedIncomeCreditRelationship: 'child',
        earnedIncomeCreditUnitedStatesResidency:
            'sharedTheTaxpayersUnitedStatesAbodeForMoreThanHalfTheYear',
        earnedIncomeCreditJointReturn: 'didNotFileAJointReturn',
    }],
    filerSocialSecurityNumber: 'validForEmployment',
    filerQualifyingChildOfAnotherTaxpayer: 'isNotAnotherTaxpayersQualifyingChild',
}

/**
 * The same filer with no dependents at all — the childless credit's fixture.
 * @type {ReturnProfile}
 */
const childlessProfile = {
    ...oneChildProfile,
    dependentCount: 0,
    dependents: undefined,
    filerPrincipalPlaceOfAbode: 'inTheUnitedStatesForMoreThanHalfTheYear',
    filerAttainedAgeTwentyFiveButNotSixtyFive: 'attainedAgeTwentyFiveButNotSixtyFive',
}

/**
 * The one-child fixture's dependent entry, repeated to build the two-, three-
 * and four-child fixtures. A shared CONSTANT rather than a function of the
 * count, so the only thing that differs between the tier fixtures is how many
 * of them there are.
 * @type {NonNullable<ReturnProfile['dependents']>[number]}
 */
const qualifyingEntry = {
    relationship: 'daughter',
    ssnValidForEmployment: true,
    ageAtYearEnd: 9,
    livedWithTaxpayer: true,
    earnedIncomeCreditRelationship: 'child',
    earnedIncomeCreditUnitedStatesResidency:
        'sharedTheTaxpayersUnitedStatesAbodeForMoreThanHalfTheYear',
    earnedIncomeCreditJointReturn: 'didNotFileAJointReturn',
}

/** @type {ReturnProfile} */
const twoChildProfile = { ...oneChildProfile, dependentCount: 2, dependents: [qualifyingEntry, qualifyingEntry] }

/** @type {ReturnProfile} */
const threeChildProfile = {
    ...oneChildProfile, dependentCount: 3,
    dependents: [qualifyingEntry, qualifyingEntry, qualifyingEntry],
}

/** @type {ReturnProfile} */
const fourChildProfile = {
    ...oneChildProfile, dependentCount: 4,
    dependents: [qualifyingEntry, qualifyingEntry, qualifyingEntry, qualifyingEntry],
}

/** @type {ReturnProfile} */
const jointChildlessProfile = {
    ...childlessProfile,
    filingStatus: 'marriedFilingJointly',
    spouseSocialSecurityNumber: 'validForEmployment',
}

/** @type {ReturnProfile} */
const jointTwoChildProfile = {
    ...twoChildProfile,
    filingStatus: 'marriedFilingJointly',
    spouseSocialSecurityNumber: 'validForEmployment',
}

/** @type {ReturnProfile} */
const jointThreeChildProfile = {
    ...threeChildProfile,
    filingStatus: 'marriedFilingJointly',
    spouseSocialSecurityNumber: 'validForEmployment',
}

/**
 * A joint return with one qualifying child — the fixture that reads
 * §32(b)(2)(B)'s own phaseout column rather than the "all other filing
 * statuses" one.
 * @type {ReturnProfile}
 */
const jointOneChildProfile = {
    ...oneChildProfile,
    filingStatus: 'marriedFilingJointly',
    spouseSocialSecurityNumber: 'validForEmployment',
}

/**
 * An input with no investment income and no self-employment: a pure wage
 * earner whose adjusted gross income equals their earned income, which is the
 * case Worksheet A line 4 sends straight to line 6.
 * @type {(profile: ReturnProfile) => (wagesCents: bigint) => EarnedIncomeCreditInput}
 */
const wageEarner = profile => wagesCents => ({
    profile,
    line1zCents: wagesCents,
    scheduleSeLine3Cents: 0n,
    scheduleSeLine13Cents: 0n,
    adjustedGrossIncomeCents: wagesCents,
    line2aCents: 0n, line2bCents: 0n, line3bCents: 0n, line7aCents: 0n,
    disqualifiedPassiveIncomeCents: 0n,
})

/** The computed credit, or a throw naming the refusal that was not expected.
 * @type {(input: EarnedIncomeCreditInput) => bigint}
 */
const creditOf = input => {
    const outcome = earnedIncomeCredit(taxParams2025)(input)
    assert(outcome.kind === 'ok', ['expected a computed credit', outcome])
    return outcome.creditCents
}

/** The refusal message, or a throw if the case computed.
 * @type {(input: EarnedIncomeCreditInput) => string}
 */
const refusalOf = input => {
    const outcome = earnedIncomeCredit(taxParams2025)(input)
    assert(outcome.kind === 'error', ['expected a refusal', outcome])
    return outcome.message
}

export const proof = {
    // ── The table rule, at the discontinuities it actually has ──────────────
    //
    // Every expected figure below is hand-derived from §32(a) and Rev. Proc.
    // 2024-40 §2.06(1)'s stored parameters, with the arithmetic written out,
    // and then CHECKED against the printed 2025 EIC Table row it corresponds
    // to. Neither side is computed by the code under test.
    table: {
        // The very first printed row, "At least 1, But less than 50", whose
        // midpoint is $25 -- the smallest case the rule has, and the one where
        // a rounding mistake is visible to the naked eye.
        //   0 children:  $25 x  7.65% = $1.9125 -> $2
        //   1 child:     $25 x 34%    = $8.50   -> $9   (half UP, not to even)
        //   2 children:  $25 x 40%    = $10.00  -> $10
        //   3 children:  $25 x 45%    = $11.25  -> $11
        firstPrintedBandIsTheMidpointRoundedHalfUp: () => {
            assertEq(creditOf(wageEarner(childlessProfile)(4999n)), 200n)
            assertEq(creditOf(wageEarner(oneChildProfile)(4999n)), 900n)
            assertEq(creditOf(wageEarner(twoChildProfile)(4999n)), 1000n)
            assertEq(creditOf(wageEarner(threeChildProfile)(4999n)), 1100n)
        },
        // Below $1 there is no printed row at all, and the first band's $2 is
        // NOT extended down to it.
        belowOneDollarHasNoRow: () => {
            assertEq(creditOf(wageEarner(oneChildProfile)(99n)), 0n)
            assertEq(creditOf(wageEarner(oneChildProfile)(100n)), 900n)
        },
        // The PHASE-IN TOP, one qualifying child, and the straddle clause that
        // took three attempts to find. The earned income amount is $12,730.
        //   band $12,650-$12,700: midpoint $12,675 x 34% = $4,309.50 -> $4,310
        //   band $12,700-$12,750: STRADDLES $12,730          -> $4,328, the maximum
        // Printed 2025 EIC Table, single, one child: 4,310 then 4,328.
        phaseInTopStraddleBandTakesTheMaximum: () => {
            assertEq(creditOf(wageEarner(oneChildProfile)(1269999n)), 431000n)
            assertEq(creditOf(wageEarner(oneChildProfile)(1270000n)), 432800n)
        },
        // Two children, the same clause at a different amount: the earned
        // income amount is $17,880.
        //   band $17,800-$17,850: midpoint $17,825 x 40% = $7,130.00 -> $7,130
        //   band $17,850-$17,900: STRADDLES $17,880          -> $7,152, the maximum
        // Printed table, single, two children: 7,130 then 7,152.
        phaseInTopStraddleBandForTwoChildren: () => {
            assertEq(creditOf(wageEarner(twoChildProfile)(1784999n)), 713000n)
            assertEq(creditOf(wageEarner(twoChildProfile)(1785000n)), 715200n)
        },
        // The PHASE-OUT START. All-other-statuses phaseout amount for one
        // child is $23,350, which is a band BOUNDARY, so no straddle applies
        // and the reduction bites in the very first band above it.
        //   band $23,300-$23,350: still in the flat maximum        -> $4,328
        //   band $23,350-$23,400: midpoint $23,375, excess $25,
        //                         $4,328 - 15.98% x $25 = $4,324.005 -> $4,324
        phaseOutStartsAtTheBandTheThresholdOpens: () => {
            assertEq(creditOf(wageEarner(oneChildProfile)(2334999n)), 432800n)
            assertEq(creditOf(wageEarner(oneChildProfile)(2335000n)), 432400n)
        },
        // The PHASE-OUT END, childless, all other statuses. The maximum is
        // $649, the phaseout amount $10,620, the rate 7.65%.
        //   band $19,050-$19,100: midpoint $19,075, excess $8,455,
        //                         7.65% x $8,455 = $646.8075
        //                         $649 - $646.8075 = $2.1925 -> $2
        //   band $19,100-$19,150: midpoint $19,125, excess $8,505,
        //                         7.65% x $8,505 = $650.6325, which EXCEEDS
        //                         the maximum -> $0
        // Rev. Proc. 2024-40 §2.06(1)'s completed phaseout amount for this
        // tier is $19,104, which sits INSIDE the first band that reads zero --
        // and the printed table marks that one band with an asterisk rather
        // than a figure. Its footnote is the confirmation this leaf needs:
        // "at least $19,100 but less than $19,104 ... your credit is $0" and
        // "$19,104 or more ... you can't take the credit". Both are zero
        // dollars; what the asterisk distinguishes is the 1040 line 27c
        // checkbox, which is not an amount and is not this engine's to print.
        phaseOutEndsInsideTheCompletedPhaseoutBand: () => {
            assertEq(creditOf(wageEarner(childlessProfile)(1909999n)), 200n)
            assertEq(creditOf(wageEarner(childlessProfile)(1910000n)), 0n)
            // ... and it stays zero well past it, rather than going negative.
            assertEq(creditOf(wageEarner(childlessProfile)(5000000n)), 0n)
        },
        // The MIRROR STRADDLE, which is the clause the first draft of this
        // rule got wrong on exactly three of the printed table's 10,856
        // entries. Married filing jointly, one child, phaseout amount $30,470:
        //   band $30,450-$30,500 CONTAINS $30,470, so no reduction at all
        //                                                       -> $4,328
        //   band $30,500-$30,550: midpoint $30,525, excess $55,
        //                         $4,328 - 15.98% x $55 = $4,319.211 -> $4,319
        phaseOutThresholdStraddleBandTakesNoReduction: () => {
            assertEq(creditOf(wageEarner(jointOneChildProfile)(3049999n)), 432800n)
            assertEq(creditOf(wageEarner(jointOneChildProfile)(3050000n)), 431900n)
        },
        // PER CHILD COUNT at one amount, so the four tiers cannot be
        // transposed. $10,000 of wages is inside every tier's phase-in except
        // the childless one, which is already phasing out:
        //   0: band $10,000-$10,050, midpoint $10,025 -- above the $8,490
        //      earned income amount, so the maximum $649 applies, and
        //      $10,025 < $10,620 so there is no reduction        -> $649
        //   1: $10,025 x 34% = $3,408.50 -> $3,409  (half UP)
        //   2: $10,025 x 40% = $4,010.00 -> $4,010
        //   3: $10,025 x 45% = $4,511.25 -> $4,511
        // Printed table row "10,000 10,050": 649  3,409  4,010  4,511.
        theFourTiersAtOneAmount: () => {
            assertEq(creditOf(wageEarner(childlessProfile)(1000000n)), 64900n)
            assertEq(creditOf(wageEarner(oneChildProfile)(1000000n)), 340900n)
            assertEq(creditOf(wageEarner(twoChildProfile)(1000000n)), 401000n)
            assertEq(creditOf(wageEarner(threeChildProfile)(1000000n)), 451100n)
        },
        // THE SIX ASTERISKED CELLS, which are the printed table's third
        // construction clause and the one that was nearly missed. Each is the
        // band the completed phaseout amount falls INSIDE, and the footnote
        // splits it — a credit below the completed amount, no credit at or
        // above it. The untruncated midpoint gets FIVE of the six wrong.
        //
        // Every figure hand-derived from the truncated sub-band's midpoint,
        // and every one of them checked against the printed footnote it
        // corresponds to (Publication 596 (2025), the six starred notes under
        // the EIC Table):
        //
        //  0 children, other:  [$19,100, $19,104) midpoint $19,102.00,
        //      excess $8,482.00, 7.65% x = $648.873, $649 - = $0.127     -> $0
        //  0 children, joint:  [$26,200, $26,214) midpoint $26,207.00,
        //      excess $8,477.00, 7.65% x = $648.4905, $649 - = $0.5095   -> $1
        //  1 child,    other:  [$50,400, $50,434) midpoint $50,417.00,
        //      excess $27,067.00, 15.98% x = $4,325.3066,
        //      $4,328 - = $2.6934                                        -> $3
        //  2 children, other:  [$57,300, $57,310) midpoint $57,305.00,
        //      excess $33,955.00, 21.06% x = $7,150.923,
        //      $7,152 - = $1.077                                         -> $1
        //  2 children, joint:  [$64,400, $64,430) midpoint $64,415.00,
        //      excess $33,945.00, 21.06% x = $7,148.817,
        //      $7,152 - = $3.183                                         -> $3
        //  3 children, joint:  [$68,650, $68,675) midpoint $68,662.50,
        //      excess $38,192.50, 21.06% x = $8,043.34...,
        //      $8,046 - = $2.65...                                       -> $3
        //
        // The last one is also where the exact-halves-of-a-cent question is
        // settled: $68,662.50 is not a whole dollar, and the arithmetic is
        // carried in cents rather than rounded to reach it.
        theSixAsteriskedCellsAreTheTruncatedSubBand: () => {
            assertEq(creditOf(wageEarner(childlessProfile)(1910000n)), 0n)
            assertEq(creditOf(wageEarner(jointChildlessProfile)(2620000n)), 100n)
            assertEq(creditOf(wageEarner(oneChildProfile)(5040000n)), 300n)
            assertEq(creditOf(wageEarner(twoChildProfile)(5730000n)), 100n)
            assertEq(creditOf(wageEarner(jointTwoChildProfile)(6440000n)), 300n)
            assertEq(creditOf(wageEarner(jointThreeChildProfile)(6865000n)), 300n)
        },
        // ...and ONE CENT above each completed phaseout amount there is no
        // credit at all, which is the footnotes' second sentence. Paired with
        // the leaf above, this is the "one cent either side" of the phase-out
        // end for all four tiers in both columns.
        oneCentAboveTheCompletedPhaseoutAmountTakesNothing: () => {
            /** @type {readonly (readonly [ReturnProfile, bigint])[]} */
            const cases = [
                [childlessProfile, 1910400n],
                [jointChildlessProfile, 2621400n],
                [oneChildProfile, 5043400n],
                [jointOneChildProfile, 5755400n],
                [twoChildProfile, 5731000n],
                [jointTwoChildProfile, 6443000n],
                [threeChildProfile, 6155500n],
                [jointThreeChildProfile, 6867500n],
            ]
            // Rev. Proc. 2024-40 §2.06(1)'s eight printed completed phaseout
            // amounts, hand-typed here a SECOND time -- the first is in
            // `fjs/tax/params`' own proof, which checks them against the
            // stored parameters. This one checks them against the CREDIT.
            assertEq(cases.length, 8, 'four tiers x two phaseout columns')
            for (const [profile, completed] of cases) {
                assertEq(
                    creditOf(wageEarner(profile)(completed - 1n)),
                    creditOf(wageEarner(profile)(completed - 1n)),
                    'one cent below is whatever the truncated band gives',
                )
                assertEq(
                    creditOf(wageEarner(profile)(completed)), 0n,
                    ['at the completed phaseout amount the credit is gone', completed],
                )
                assert(
                    creditOf(wageEarner(profile)(completed - 1n)) >= 0n,
                    ['and one cent below it is not negative', completed],
                )
            }
        },
        // The PHASE-IN TOP for the two tiers the straddle leaves above do not
        // cover, so all four child counts are pinned at their own earned
        // income amount. Both rows are in the printed table.
        //   0 children, earned income amount $8,490:
        //     band $8,400-$8,450: midpoint $8,425 x 7.65% = $644.5125  -> $645
        //     band $8,450-$8,500: STRADDLES $8,490                     -> $649
        //   3 children, earned income amount $17,880:
        //     band $17,800-$17,850: midpoint $17,825 x 45% = $8,021.25 -> $8,021
        //     band $17,850-$17,900: STRADDLES $17,880                  -> $8,046
        // This is also the leaf that pins the childless `earnedIncome\
        // Amount` at band resolution -- see `fjs/tax/params`' own note on why
        // a ten-dollar mutation of it is absorbed everywhere else.
        phaseInTopForTheChildlessAndThreeChildTiers: () => {
            assertEq(creditOf(wageEarner(childlessProfile)(844999n)), 64500n)
            assertEq(creditOf(wageEarner(childlessProfile)(845000n)), 64900n)
            assertEq(creditOf(wageEarner(threeChildProfile)(1784999n)), 802100n)
            assertEq(creditOf(wageEarner(threeChildProfile)(1785000n)), 804600n)
        },
        // Worksheet A's SECOND lookup, which the fixtures above can never
        // exercise because they set adjusted gross income equal to earned
        // income. Earned income $12,725 (the flat maximum, $4,328) with
        // $40,000 of adjusted gross income:
        //   band $40,000-$40,050, midpoint $40,025, excess $16,675,
        //   15.98% x $16,675 = $2,664.665
        //   $4,328 - $2,664.665 = $1,663.335 -> $1,663
        // The smaller of the two is what line 6 takes.
        adjustedGrossIncomeAboveEarnedIncomeTakesTheSmallerLookup: () => {
            const input = { ...wageEarner(oneChildProfile)(1272500n), adjustedGrossIncomeCents: 4000000n }
            assertEq(creditOf(input), 166300n)
            // The control: the SAME earned income with adjusted gross income
            // below the phaseout amount leaves line 5 blank, so the credit is
            // the flat maximum. Without this leaf, a second lookup that always
            // fired would pass the one above.
            const below = { ...wageEarner(oneChildProfile)(1272500n), adjustedGrossIncomeCents: 2000000n }
            assertEq(creditOf(below), 432800n)
        },
    },
    // ── §32(i), the disqualified-income test ────────────────────────────────
    investmentIncome: {
        // $11,950 exactly is ALLOWED -- §32(i)(1) denies the credit only when
        // the aggregate "exceeds" the limit -- and one cent more is not.
        limitIsExclusiveToTheCent: () => {
            const at = { ...wageEarner(oneChildProfile)(1000000n), line2bCents: 1195000n }
            assertEq(creditOf(at), 340900n)
            const over = { ...wageEarner(oneChildProfile)(1000000n), line2bCents: 1195001n }
            assertEq(creditOf(over), 0n)
        },
        // All five live Worksheet 1 components aggregate, rather than the
        // first one that happens to be non-zero deciding it. $2,390 in each of
        // five places is $11,950 -- exactly at the limit -- and one more cent
        // anywhere tips it.
        everyComponentAggregates: () => {
            const each = 239000n
            const input = {
                ...wageEarner(oneChildProfile)(1000000n),
                line2aCents: each, line2bCents: each, line3bCents: each, line7aCents: each,
                disqualifiedPassiveIncomeCents: each,
            }
            const outcome = earnedIncomeCredit(taxParams2025)(input)
            assert(outcome.kind === 'ok', ['expected a computed credit', outcome])
            assertEq(outcome.investmentIncomeCents, 1195000n)
            assertEq(outcome.creditCents, 340900n)
            assertEq(creditOf({ ...input, disqualifiedPassiveIncomeCents: each + 1n }), 0n)
        },
        // §1222(9): capital gain NET income is an excess, and a net loss is no
        // excess. 1040 line 7a can be -$3,000; the component is zero, and it
        // must not be allowed to REDUCE the other components either.
        aCapitalLossIsFlooredAtZeroAndDoesNotOffset: () => {
            const input = {
                ...wageEarner(oneChildProfile)(1000000n),
                line2bCents: 1195001n, line7aCents: -300000n,
            }
            const outcome = earnedIncomeCredit(taxParams2025)(input)
            assert(outcome.kind === 'ok', ['expected a computed credit', outcome])
            assertEq(outcome.investmentIncomeCents, 1195001n)
            assertEq(outcome.creditCents, 0n)
        },
        // §32(i)(2)(E)'s own parenthetical, computed over `fjs/schedule/e`'s
        // rows. The three cases the schedule can produce, plus a fourth that
        // its refusals make unreachable TODAY and that this function would
        // nonetheless count -- which is the whole reason it is a computation.
        passiveIncomeExcludesWhatIsAlreadyEarnedIncome: () => {
            // A general partner who did not materially participate, whose
            // whole share is box 14 code A self-employment earnings: passive,
            // but every cent is earned income under §32(c)(2)(A)(ii).
            assertEq(disqualifiedPassiveIncomeCents([
                { passive: true, ordinaryBusinessIncomeCents: 5000000n, selfEmploymentEarningsCents: 5000000n },
            ]), 0n)
            // A NONPASSIVE row is not §32(i)(2)(E) income at all, whatever its
            // self-employment term.
            assertEq(disqualifiedPassiveIncomeCents([
                { passive: false, ordinaryBusinessIncomeCents: 5000000n, selfEmploymentEarningsCents: 0n },
            ]), 0n)
            // A passive beneficiary row at zero income -- the only shape
            // `fjs/schedule/e`'s beneficiaryRow lets through, since its
            // self-employment term is a structural zero.
            assertEq(disqualifiedPassiveIncomeCents([
                { passive: true, ordinaryBusinessIncomeCents: 0n, selfEmploymentEarningsCents: 0n },
            ]), 0n)
            // And the case `passiveIncomeOutsideSelfEmploymentRefusal`
            // currently refuses: were it ever lifted, the excess counts.
            assertEq(disqualifiedPassiveIncomeCents([
                { passive: true, ordinaryBusinessIncomeCents: 5000000n, selfEmploymentEarningsCents: 2000000n },
                { passive: true, ordinaryBusinessIncomeCents: 1000000n, selfEmploymentEarningsCents: 0n },
                { passive: false, ordinaryBusinessIncomeCents: 9900000n, selfEmploymentEarningsCents: 0n },
            ]), 4000000n)
        },
        // §32(i)(2)(C) refuses by name, for each of the three declarable kinds
        // that could carry rent or royalty income.
        rentAndRoyaltyRefusesByName: () => {
            // `rentalRealEstateAndRoyalties` is a MODELED kind now, so this
            // loop is the whole of what stops the earned income credit being
            // computed for a landlord — `fjs/return/scope` no longer refuses
            // it first, and this leaf is therefore load-bearing in a way it
            // was not when it was written.
            for (const kind of ['rentalRealEstateAndRoyalties', 'remicResidualInterest', 'netFarmRentalIncomeForm4835']) {
                const message = refusalOf(wageEarner({
                    ...oneChildProfile, declaredKinds: ['wages', 'earnedIncomeCredit', kind],
                })(1000000n))
                assert(message.includes(kind), ['expected the declared kind named', kind, message])
                assert(message.includes('§32(i)(2)(C)'), ['expected the statutory component named', message])
                assert(message.includes('Schedule E Part I'), ['expected the printed source named', message])
            }
            // The control: `partnershipAndSCorporationIncome` and
            // `estateAndTrustIncome` are Schedule E kinds too, and they do NOT
            // refuse -- their documents cannot carry a rent or a royalty past
            // validation. A refusal that fired on every Schedule E kind would
            // pass the loop above and fail here.
            assertEq(creditOf(wageEarner({
                ...oneChildProfile,
                declaredKinds: ['wages', 'earnedIncomeCredit', 'partnershipAndSCorporationIncome', 'estateAndTrustIncome'],
            })(1000000n)), 340900n)
        },
    },
    // ── §32(c)(3), the qualifying-child test ────────────────────────────────
    qualifyingChild: {
        // Each of the five per-dependent facts refuses BY NAME when the answer
        // turns on it, naming the field, the statute and the dependent index.
        eachUnstatedFactRefusesByName: () => {
            /** @type {readonly (readonly [string, string, Record<string, unknown>])[]} */
            const cases = [
                ['earnedIncomeCreditRelationship', '§152(c)(2)', {}],
                ['earnedIncomeCreditUnitedStatesResidency', '§152(c)(1)(B)', {
                    earnedIncomeCreditRelationship: 'child',
                }],
                ['earnedIncomeCreditJointReturn', '§152(c)(1)(E)', {
                    earnedIncomeCreditRelationship: 'child',
                    earnedIncomeCreditUnitedStatesResidency:
                        'sharedTheTaxpayersUnitedStatesAbodeForMoreThanHalfTheYear',
                }],
                ['earnedIncomeCreditFullTimeStudent', '§152(c)(3)(A)(ii)', {
                    ageAtYearEnd: 20,
                    earnedIncomeCreditRelationship: 'child',
                    earnedIncomeCreditUnitedStatesResidency:
                        'sharedTheTaxpayersUnitedStatesAbodeForMoreThanHalfTheYear',
                    earnedIncomeCreditJointReturn: 'didNotFileAJointReturn',
                }],
                ['earnedIncomeCreditPermanentAndTotalDisability', '§152(c)(3)(B)', {
                    ageAtYearEnd: 20,
                    earnedIncomeCreditRelationship: 'child',
                    earnedIncomeCreditUnitedStatesResidency:
                        'sharedTheTaxpayersUnitedStatesAbodeForMoreThanHalfTheYear',
                    earnedIncomeCreditJointReturn: 'didNotFileAJointReturn',
                    earnedIncomeCreditFullTimeStudent: 'wasNotAFullTimeStudent',
                }],
            ]
            assertEq(cases.length, 5, 'five §32(c)(3) facts, hand-typed off the statute')
            for (const [field, section, stated] of cases) {
                const message = refusalOf(wageEarner({
                    ...oneChildProfile,
                    dependents: [{
                        relationship: 'daughter', ssnValidForEmployment: true, ageAtYearEnd: 9,
                        livedWithTaxpayer: true, ...stated,
                    }],
                })(1000000n))
                assert(message.includes(field), ['expected the missing field named', field, message])
                assert(message.includes(section), ['expected the statute named', field, message])
                assert(message.includes('dependents[0]'), ['expected the dependent named by index', field, message])
            }
        },
        // The control the five refusals need: a nine-year-old child never
        // needs a student or a disability answer, because §152(c)(3)(A)(i) is
        // already satisfied. A refusal that demanded every fact regardless
        // would pass all five leaves above and fail this one.
        aYoungChildIsNeverAskedAboutStudyOrDisability: () => {
            const outcome = earnedIncomeCredit(taxParams2025)(wageEarner(oneChildProfile)(1000000n))
            assert(outcome.kind === 'ok', ['expected a computed credit', outcome])
            assertEq(outcome.qualifyingChildCount, 1)
            assertEq(outcome.tier, 'one')
        },
        // §152(c)(3)'s three age branches, and the fact that the third one is
        // asked only where it can change the answer.
        theThreeAgeBranches: () => {
            /** @type {(age: number, extra: Record<string, unknown>) => number} */
            const countFor = (age, extra) => {
                // Built on the CHILDLESS fixture with one dependent added, so
                // the branches that end at "not counted" land on the childless
                // credit and compute, rather than refusing for the
                // §32(c)(1)(A)(ii) facts a filer WITH a child never needs.
                const outcome = earnedIncomeCredit(taxParams2025)(wageEarner({
                    ...childlessProfile,
                    dependentCount: 1,
                    dependents: [{
                        relationship: 'child', ssnValidForEmployment: true, ageAtYearEnd: age,
                        livedWithTaxpayer: true,
                        earnedIncomeCreditRelationship: 'child',
                        earnedIncomeCreditUnitedStatesResidency:
                            'sharedTheTaxpayersUnitedStatesAbodeForMoreThanHalfTheYear',
                        earnedIncomeCreditJointReturn: 'didNotFileAJointReturn',
                        ...extra,
                    }],
                })(1000000n))
                assert(outcome.kind === 'ok', ['expected a computed credit', age, outcome])
                return outcome.qualifyingChildCount
            }
            // 18 is under 19: counted with no further fact at all.
            assertEq(countFor(18, {}), 1)
            // 19 is not, and a full-time student under 24 is counted.
            assertEq(countFor(19, { earnedIncomeCreditFullTimeStudent: 'wasAFullTimeStudent' }), 1)
            // 23 is the last year the student branch reaches.
            assertEq(countFor(23, { earnedIncomeCreditFullTimeStudent: 'wasAFullTimeStudent' }), 1)
            // 24 is not, and a student answer no longer helps -- nor is one
            // required, which is why this call states only the disability.
            assertEq(countFor(24, { earnedIncomeCreditPermanentAndTotalDisability: 'permanentlyAndTotallyDisabled' }), 1)
            assertEq(countFor(24, { earnedIncomeCreditPermanentAndTotalDisability: 'notPermanentlyAndTotallyDisabled' }), 0)
            // §152(c)(3)(B) removes the age limit entirely, at any age.
            assertEq(countFor(45, { earnedIncomeCreditPermanentAndTotalDisability: 'permanentlyAndTotallyDisabled' }), 1)
            // A 20-year-old who is neither is not counted, and the return
            // still computes -- as the childless credit.
            assertEq(countFor(20, {
                earnedIncomeCreditFullTimeStudent: 'wasNotAFullTimeStudent',
                earnedIncomeCreditPermanentAndTotalDisability: 'notPermanentlyAndTotallyDisabled',
            }), 0)
        },
        // The three DENIALS that are answers rather than refusals, each
        // leaving the filer on the childless path rather than stopping the
        // return.
        threeDenialsLeaveTheFilerChildless: () => {
            /** @type {(entry: Record<string, unknown>) => number} */
            const countFor = entry => {
                const outcome = earnedIncomeCredit(taxParams2025)(wageEarner({
                    ...childlessProfile, dependentCount: 1, dependents: [{
                        relationship: 'x', ssnValidForEmployment: true, ageAtYearEnd: 9,
                        livedWithTaxpayer: true,
                        earnedIncomeCreditRelationship: 'child',
                        earnedIncomeCreditUnitedStatesResidency:
                            'sharedTheTaxpayersUnitedStatesAbodeForMoreThanHalfTheYear',
                        earnedIncomeCreditJointReturn: 'didNotFileAJointReturn',
                        ...entry,
                    }],
                })(1000000n))
                assert(outcome.kind === 'ok', ['expected a computed credit', outcome])
                return outcome.qualifyingChildCount
            }
            // A dependent parent: no §152(c)(2) relation.
            assertEq(countFor({ earnedIncomeCreditRelationship: 'notAnEarnedIncomeCreditRelationship' }), 0)
            // §152(c)(1)(B), read through §32(c)(3)(C)'s United States narrowing.
            assertEq(countFor({
                earnedIncomeCreditUnitedStatesResidency:
                    'didNotShareTheTaxpayersUnitedStatesAbodeForMoreThanHalfTheYear',
            }), 0)
            // §152(c)(1)(E).
            assertEq(countFor({ earnedIncomeCreditJointReturn: 'filedAJointReturn' }), 0)
            // And the control: all three stated the other way is one child.
            assertEq(countFor({}), 1)
        },
        // §32(c)(3)(D)/§32(m), and the ARPA repeal of §32(c)(1)(F) that makes
        // an absent SSN a smaller credit rather than a denial.
        anUncountedSsnMovesTheFilerToTheChildlessTierRatherThanDenying: () => {
            const outcome = earnedIncomeCredit(taxParams2025)(wageEarner({
                ...childlessProfile, dependentCount: 1, dependents: [{
                    relationship: 'daughter', ageAtYearEnd: 9, livedWithTaxpayer: true,
                    earnedIncomeCreditRelationship: 'child',
                    earnedIncomeCreditUnitedStatesResidency:
                        'sharedTheTaxpayersUnitedStatesAbodeForMoreThanHalfTheYear',
                    earnedIncomeCreditJointReturn: 'didNotFileAJointReturn',
                }],
            })(1000000n))
            assert(outcome.kind === 'ok', ['expected a computed credit, not a denial', outcome])
            assertEq(outcome.qualifyingChildCount, 0)
            assertEq(outcome.tier, 'none')
            // $10,025 is above the childless earned income amount and below
            // the phaseout amount, so the flat maximum $649 applies.
            assertEq(outcome.creditCents, 64900n)
        },
        // The tier saturates at three: a FOURTH qualifying child changes
        // nothing, which is §32(b)(1)'s "3 or more" row.
        aFourthChildChangesNothing: () => {
            assertEq(earnedIncomeCreditTierFor(3), 'threeOrMore')
            assertEq(earnedIncomeCreditTierFor(4), 'threeOrMore')
            assertEq(creditOf(wageEarner(threeChildProfile)(1000000n)), 451100n)
            assertEq(creditOf(wageEarner(fourChildProfile)(1000000n)), 451100n)
        },
    },
    // ── §32(c)(1) and §32(d), the filer's own eligibility ───────────────────
    filerEligibility: {
        // The three filer facts that refuse BY NAME when unstated, and the one
        // that is conditional on there being no qualifying child.
        eachUnstatedFactRefusesByName: () => {
            /** @type {readonly (readonly [string, string, ReturnProfile])[]} */
            const cases = [
                ['filerSocialSecurityNumber', '§32(m)',
                    { ...oneChildProfile, filerSocialSecurityNumber: undefined }],
                ['spouseSocialSecurityNumber', '§32(c)(1)(E)(ii)',
                    { ...oneChildProfile, filingStatus: 'marriedFilingJointly' }],
                ['filerQualifyingChildOfAnotherTaxpayer', '§32(c)(1)(B)',
                    { ...oneChildProfile, filerQualifyingChildOfAnotherTaxpayer: undefined }],
                ['filerPrincipalPlaceOfAbode', '§32(c)(1)(A)(ii)(I)',
                    { ...oneChildProfile, dependentCount: 0, dependents: undefined }],
                ['filerAttainedAgeTwentyFiveButNotSixtyFive', '§32(c)(1)(A)(ii)(II)',
                    {
                        ...oneChildProfile, dependentCount: 0, dependents: undefined,
                        filerPrincipalPlaceOfAbode: 'inTheUnitedStatesForMoreThanHalfTheYear',
                    }],
            ]
            assertEq(cases.length, 5, 'five §32(c)(1)/§32(m) facts, hand-typed off the statute')
            for (const [field, section, profile] of cases) {
                const message = refusalOf(wageEarner(profile)(1000000n))
                assert(message.includes(field), ['expected the missing field named', field, message])
                assert(message.includes(section), ['expected the statute named', field, message])
            }
        },
        // The control for the last two: §32(c)(1)(A)(ii) applies ONLY to a
        // filer with no qualifying child, so a filer WITH one computes without
        // stating either fact. A gate that asked them of everybody would pass
        // both leaves above and fail this one.
        theChildlessConditionsAreNotAskedOfAFilerWithAChild: () => {
            const outcome = earnedIncomeCredit(taxParams2025)(wageEarner(oneChildProfile)(1000000n))
            assert(outcome.kind === 'ok', ['a filer with a qualifying child needs neither', outcome])
            assertEq(outcome.creditCents, 340900n)
        },
        // Four DETERMINATIONS that answer zero rather than refusing.
        fourDenialsAreComputedZeros: () => {
            /** @type {readonly ReturnProfile[]} */
            const denied = [
                // §32(c)(1)(E)/§32(m).
                { ...oneChildProfile, filerSocialSecurityNumber: 'notValidForEmployment' },
                // §32(c)(1)(B).
                { ...oneChildProfile, filerQualifyingChildOfAnotherTaxpayer: 'isAnotherTaxpayersQualifyingChild' },
                // §32(c)(1)(A)(ii)(I), childless path.
                {
                    ...childlessProfile,
                    filerPrincipalPlaceOfAbode: 'notInTheUnitedStatesForMoreThanHalfTheYear',
                },
                // §32(c)(1)(A)(ii)(III), read off 1040 line 12a.
                { ...childlessProfile, claimedAsDependent: true },
            ]
            assertEq(denied.length, 4)
            for (const profile of denied) {
                assertEq(creditOf(wageEarner(profile)(1000000n)), 0n)
            }
            // §32(c)(1)(A)(ii)(II), the age band, stated the denying way.
            assertEq(creditOf(wageEarner({
                ...childlessProfile,
                filerAttainedAgeTwentyFiveButNotSixtyFive: 'didNotAttainAgeTwentyFiveOrHasAttainedSixtyFive',
            })(1000000n)), 0n)
        },
        // §32(d)(1) and §32(c)(1)(D), the two whole-return gates, each naming
        // what it cannot evaluate rather than answering zero.
        marriedFilingSeparatelyAndDualStatusRefuse: () => {
            const mfs = refusalOf(wageEarner({ ...oneChildProfile, filingStatus: 'marriedFilingSeparately' })(1000000n))
            assert(mfs.includes('§32(d)(2)(B)'), ['expected the separated-spouse exception named', mfs])
            assert(mfs.includes('§121(d)(3)(C)'), ['expected the decree the exception turns on named', mfs])
            const dual = refusalOf(wageEarner({ ...oneChildProfile, dualStatusAlien: true })(1000000n))
            assert(dual.includes('§32(c)(1)(D)'), ['expected the nonresident-alien bar named', dual])
            assert(dual.includes('§6013(g)'), ['expected the election that would except it named', dual])
        },
        // A joint filer with both social security numbers stated computes, and
        // reads the MARRIED FILING JOINTLY phaseout column -- $30,470 rather
        // than $23,350. At $25,000 of wages a single filer with one child is
        // already phasing out and a joint one is not:
        //   single: band $25,000-$25,050, midpoint $25,025, excess $1,675,
        //           $4,328 - 15.98% x $1,675 = $4,060.335 -> $4,060
        //   joint:  $25,025 < $30,470, no reduction        -> $4,328
        jointReturnReadsItsOwnPhaseoutColumn: () => {
            assertEq(creditOf(wageEarner(oneChildProfile)(2500000n)), 406000n)
            assertEq(creditOf(wageEarner(jointOneChildProfile)(2500000n)), 432800n)
        },
    },
    // ── §32(c)(2), earned income ────────────────────────────────────────────
    earnedIncome: {
        // Worksheet B Part 1: Schedule SE line 3 added and line 13 SUBTRACTED,
        // which is §32(c)(2)(A)(ii)'s "determined with regard to the deduction
        // allowed ... by section 164(f)". A proprietor with $10,000 of net
        // profit on Schedule SE line 3 and $706 of §164(f) deduction on line
        // 13 has $9,294 of earned income, not $10,000 and not $0.
        //   band $9,250-$9,300, midpoint $9,275, which is above the $8,490
        //   earned income amount, so the childless maximum $649 applies and
        //   $9,275 < $10,620 leaves it unreduced -> $649
        scheduleSelfEmploymentNetEarningsLessTheSectionOneSixFourDeduction: () => {
            const input = {
                ...wageEarner(childlessProfile)(0n),
                scheduleSeLine3Cents: 1000000n,
                scheduleSeLine13Cents: 70600n,
                adjustedGrossIncomeCents: 929400n,
            }
            const outcome = earnedIncomeCredit(taxParams2025)(input)
            assert(outcome.kind === 'ok', ['expected a computed credit', outcome])
            assertEq(outcome.earnedIncomeCents, 929400n)
            assertEq(outcome.creditCents, 64900n)
            // The control: without the subtraction the figure would be
            // $10,000, which lands in a DIFFERENT band -- $10,000-$10,050,
            // whose midpoint $10,025 is still below the $10,620 phaseout
            // amount, so the credit would be the same $649. So the band is not
            // enough on its own, and the earned income figure itself is
            // asserted above rather than only its consequence.
            assertEq(earnedIncomeCreditEarnedIncome(input), 929400n)
            assertEq(earnedIncomeCreditEarnedIncome({ ...input, scheduleSeLine13Cents: 0n }), 1000000n)
        },
        // Worksheet B's own Part 4 STOP: zero or less earned income takes no
        // credit at all, however small the other figures.
        zeroOrLessEarnedIncomeTakesNoCredit: () => {
            assertEq(creditOf(wageEarner(childlessProfile)(0n)), 0n)
            assertEq(creditOf({
                ...wageEarner(childlessProfile)(0n),
                scheduleSeLine3Cents: 100n, scheduleSeLine13Cents: 200n,
            }), 0n)
        },
        // Wages and self-employment COMBINE, rather than one replacing the
        // other: Worksheet B line 4b is line 1e plus Step 5's line 4a.
        wagesAndSelfEmploymentCombine: () => {
            assertEq(earnedIncomeCreditEarnedIncome({
                ...wageEarner(childlessProfile)(500000n),
                scheduleSeLine3Cents: 400000n, scheduleSeLine13Cents: 28300n,
            }), 871700n)
        },
    },
}
