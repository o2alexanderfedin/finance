/**
 * Form 8880, *Credit for Qualified Retirement Savings Contributions* — the
 * Saver's Credit, all twelve printed lines, whose line 12 is Schedule 3 line
 * 4 (TAX-25, Phase 25).
 *
 * Source: the printed `f8880.pdf` (2025), line by line, plus the Credit Limit
 * Worksheet in its instructions. This is a STANDALONE, independently callable
 * pure function over already-extracted facts — the same relationship
 * `fjs/form8889`, `fjs/form8959` and `fjs/form8960` have to their own inputs.
 * It reads no stored documents, and it is not wired into `fjs/form1040/core`
 * or `fjs/return/scope` here.
 *
 * ## The rate schedule is a CLIFF, and everything else here is secondary
 *
 * Line 9 is a LOOKUP, not a taper. Adjusted gross income selects one of four
 * rates — 50%, 20%, 10% or nothing — from `fjs/tax/params`'
 * {@link retirementSavingsContributionsCredit} table, and the WHOLE of line 7
 * is multiplied by it. A single filer with $2,000 of contributions and
 * $23,750.00 of adjusted gross income receives **$1,000**; at $23,750.01 the
 * same taxpayer receives **$400**. One cent of income costs $600, and nothing
 * anywhere on the printed page softens the step.
 *
 * This engine now models three different phase-out SHAPES and they are easy
 * to confuse: `fjs/schedule/1a`'s continuous 6% curve, `fjs/form8812`'s
 * $1,000-stepped 5%, and this four-way cliff. {@link proof}'s own
 * `cliffBoundaries` block exercises every one of the nine boundaries at one
 * cent either side, because a boundary comparison written `<` where the
 * printed table says "not over" is a $600 error that no other leaf could see.
 *
 * ## What this module COMPUTES and what it REFUSES — read this first
 *
 * | Printed line | Status |
 * |---|---|
 * | 1 IRA contributions | computed — `vnd.fjs.credits`, taxpayer-asserted |
 * | 2 elective deferrals etc. | computed — Form W-2 box 12, **refused on a joint return**; see below |
 * | 3 line 1 + line 2 | computed |
 * | 4 testing-period distributions | **refused** — always; see below |
 * | 5 line 3 − line 4 | computed |
 * | 6 the smaller of line 5 or $2,000, per column | computed |
 * | 7 the two columns added | computed |
 * | 8 adjusted gross income | computed |
 * | 9 the rate from the printed table | computed |
 * | 10 line 7 × line 9 | computed |
 * | 11 the Credit Limit Worksheet | computed |
 * | 12 the smaller of line 10 or line 11 | computed → Schedule 3 line 4 |
 *
 * ## Line 4, the testing period — the refusal this module exists to make
 *
 * §25B(d)(2) reduces the credit by distributions received during a **testing
 * period** that spans FOUR tax years: the two years before this one, this one,
 * and the part of the next one up to the return's due date. This engine holds
 * documents for ONE year. Three quarters of that window is not merely
 * unmodeled — it is unobservable.
 *
 * Treating line 4 as zero would OVERSTATE the credit for exactly the taxpayer
 * most likely to be affected: someone who rolled money out of a retirement
 * account last year and put money back this year, which is a completely
 * ordinary sequence. So this module refuses, and it refuses in **two
 * different ways**, because the two say different things to a reader:
 *
 * - **The assertion is missing.** No `vnd.fjs.credits` eligibility record
 *   asserts `noTestingPeriodDistributions` for a person with contributions.
 *   The refusal names the four-year window and asks for the answer.
 * - **The DOCUMENTS contradict it.** A stored Form 1099-R proves a
 *   distribution inside the one year this engine CAN see. The refusal names
 *   the document type, and it fires *even when the assertion was made* —
 *   evidence in hand beats an assertion, and an engine that let an assertion
 *   override a document it is holding would be worse than one that never
 *   looked.
 *
 * The second is deliberately not a `fjs/return/tripwire` entry: a tripwire
 * asks whether a KIND should have been declared, and this asks whether a
 * figure this form needs is computable. Both are
 * document-data-sufficiency refusals in 12.1-CONTEXT.md Decision 2.6's sense.
 *
 * ## Line 2 on a joint return — the SAME attribution gap `fjs/schedule/1`
 * already refuses
 *
 * Line 2's elective deferrals come from Form W-2 box 12, and Form 8880 has
 * TWO columns whose $2,000 caps apply separately. Attributing a deferral to
 * the wrong column moves the credit — $2,500 in one column and nothing in the
 * other yields $2,000 of creditable contributions, while $1,250 in each
 * yields $2,500.
 *
 * **Nothing this engine models says WHICH spouse a W-2 belongs to.**
 * `vnd.fjs.return_profile` carries no taxpayer or spouse TIN, so a W-2's
 * `recipientTin` cannot be matched to a person on the return. This is exactly
 * the gap `fjs/schedule/1` line 13 already refuses for Form W-2 box 12 code
 * W, and it is refused here the same way and for the same reason.
 *
 * **Matching on `vnd.fjs.credits`' own `recipientTin` was considered and
 * rejected.** It would work whenever that field holds the primary filer's TIN
 * — and it would silently INVERT both columns whenever it holds the spouse's,
 * with nothing anywhere able to notice. A rule that is right most of the time
 * and undetectably wrong the rest of the time is worse than a refusal.
 *
 * Every other filing status has ONE column, so a deferral has only one place
 * to go and this refusal cannot fire.
 *
 * ## §25B(c)'s three eligibility conditions produce a ZERO, not a refusal —
 * except when they are unanswered
 *
 * Being under 18, being a full-time student, or being claimable as another
 * taxpayer's dependent each makes an individual ineligible, and an
 * ineligible individual's column contributes `0n`. That is a determinate
 * answer, not a gap, and it is modeled as one.
 *
 * What IS a gap is not being told. `vnd.fjs.credits`' eligibility record is
 * absent for a person with contributions, and the answer could go either way:
 * absent "attained age 18" would deny a credit that may be owed, and absent
 * "was a full-time student" would grant one that may not be. So this module
 * refuses — but only when the answer could change the outcome, which is when
 * there are contributions AND the rate is non-zero AND the return has
 * ENGAGED with this credit at all.
 *
 * ## That last condition is a REAL GAP, deliberately taken, and it is the
 * most important paragraph in this file
 *
 * `saversCreditDeclared` (the profile declared
 * `retirementSavingsContributionsCredit`) or a supplied eligibility record is
 * what counts as engaging. Without either, a return with a Form W-2 box 12
 * code D deferral computes `$0` on Schedule 3 line 4 and says nothing.
 *
 * **The first draft of this module did not have that condition, and its
 * control leaf caught what that cost.** Every eligible-income filer with a
 * 401(k) — which is to say the commonest return in the country — was refused
 * for not having answered three questions about a credit they had not
 * claimed. Refusing the modal American return is not honesty, it is an engine
 * that does not work.
 *
 * So the gap is this: **a taxpayer who is entitled to the saver's credit and
 * has never heard of it gets `$0` and no warning.** That is exactly the
 * failure mode `.planning/PERSONA-COVERAGE.md` identified and
 * `fjs/return/tripwire` exists to close — and a tripwire cannot close this
 * one. §25B(b)'s bands are on ADJUSTED GROSS INCOME, and a tripwire runs
 * before any line computes, which is precisely the reason that module's own
 * docstring gives for `netInvestmentIncomeTax` having no entry: an
 * over-approximation from Form W-2 box 1 alone would fire on returns that
 * owe nothing, and would be worse than no entry.
 *
 * Closing it needs a guard that runs AFTER adjusted gross income and asks the
 * tripwire's question. No such layer exists, and inventing one is not this
 * phase's work. What this paragraph buys is that the gap is written down
 * where the next reader of this form will find it, rather than discovered by
 * a taxpayer.
 *
 * A return whose income is above the top band, or which made no qualifying
 * contribution at all, computes `$0` silently and correctly, exactly as it
 * did before this phase — and so, now, does one that never mentions this
 * credit.
 *
 * The dependent test reads the RETURN PROFILE's own `claimedAsDependent`
 * (1040 line 12a), never a second field of its own — one rule, one place; see
 * `fjs/document/credits`' own docstring.
 *
 * ## Rounding: exactly one point, and it is line 10
 *
 * Line 9 is a whole percentage from stored data, so line 10 is the only
 * division on the printed page and `halfUp` is applied there and nowhere
 * else. Unlike `fjs/schedule/1`'s student loan worksheet there is no
 * three-decimal intermediate ratio to round FIRST, which is what makes this
 * form's arithmetic exact at every other line.
 *
 * @module
 */
import { assert, assertEq } from 'functionalscript/fjs/asserts/module.f.mjs'
import { of, halfUp } from '../types/rational/module.f.js'
import { centsFromString } from '../exact/module.f.js'
import { taxParamsByYear } from '../tax/params/module.f.js'

/** @import { TaxParamSet, IndividualFilingStatus } from '../tax/params/module.f.js' */

// ── Inputs ───────────────────────────────────────────────────────────────────

/**
 * The two people Form 8880's two columns describe. The string values are
 * `fjs/document/credits`' own `individuals`, which that dialect validates at
 * the storage boundary — this module takes the narrowed union and never
 * re-checks it (AGENTS.md: one rule, one place).
 * @typedef {'taxpayer' | 'spouse'} Form8880Individual
 */

/**
 * One person's §25B(c) answers, as `fjs/document/credits`' eligibility record
 * supplies them, already normalized from `or(option, true)` to definite booleans
 * by the caller — the same `=== true` normalization `fjs/form8812` expects of
 * its own `dependents` array.
 *
 * The record's PRESENCE is what says the questions were answered at all;
 * `undefined` in {@link Form8880Person} means no record was supplied, which is
 * the case this module refuses rather than guessing at.
 * @typedef {{
 *   readonly attainedAgeEighteen: boolean,
 *   readonly wasAFullTimeStudent: boolean,
 *   readonly noTestingPeriodDistributions: boolean,
 * }} SaversCreditEligibility
 */

/**
 * One column of the printed form. `iraContributionCents` is line 1 and
 * `electiveDeferralCents` is line 2; the caller has already separated them,
 * because they arrive from two different places (a taxpayer assertion and
 * Form W-2 box 12) and the refusals differ.
 * @typedef {{
 *   readonly individual: Form8880Individual,
 *   readonly iraContributionCents: bigint,
 *   readonly electiveDeferralCents: bigint,
 *   readonly eligibility: SaversCreditEligibility | undefined,
 * }} Form8880Person
 */

/**
 * Everything Form 8880 reads.
 *
 * `earlierScheduleThreeCreditsCents` is the Credit Limit Worksheet's own line
 * 2 — see {@link Form8880CreditLimitWorksheet}. `aStored1099RProvesADistribution`
 * is the documents-contradict-the-assertion case; see this module's own
 * docstring, "Line 4, the testing period".
 * @typedef {{
 *   readonly status: IndividualFilingStatus,
 *   readonly agiCents: bigint,
 *   readonly claimedAsDependent: boolean,
 *   readonly people: readonly Form8880Person[],
 *   readonly saversCreditDeclared: boolean,
 *   readonly line18Cents: bigint,
 *   readonly earlierScheduleThreeCreditsCents: bigint,
 *   readonly aStored1099RProvesADistribution: boolean,
 * }} Form8880Input
 */

// ── Outputs ──────────────────────────────────────────────────────────────────

/**
 * One printed COLUMN, lines 1 through 6. A record rather than an array, per
 * `fjs/form8889`'s own reasoning: `noUncheckedIndexedAccess` makes an array
 * index `bigint | undefined`, and a record indexes cleanly with the printed
 * line numbers carried in the field names.
 *
 * `line4` is present and is always `0n` — the testing-period case is refused
 * before any column is built, so the only value it can ever hold here is
 * zero. It is kept as its own line rather than folded away, exactly as
 * `fjs/tax/line16/qdcgt` keeps its line 11 (a pure copy of line 9), because
 * every printed line exists.
 * @typedef {{
 *   readonly individual: Form8880Individual,
 *   readonly line1: bigint, readonly line2: bigint, readonly line3: bigint,
 *   readonly line4: bigint, readonly line5: bigint, readonly line6: bigint,
 * }} Form8880Column
 */

/**
 * The Credit Limit Worksheet from Form 8880's instructions, all three printed
 * lines.
 *
 * Its line 2 is *"Add the following amounts (if applicable) from: Schedule 3,
 * line 1; Schedule 3, line 2; Schedule 3, line 3; Schedule 3, line 6d;
 * Schedule 3, line 6l; Schedule 3, line 6m; Form 5695, line 30; Form 8910,
 * line 15; Form 8936, line 23"* — the credits §26 orders BEFORE the saver's
 * credit. Every one of those but Schedule 3 line 3 is a documented zero in
 * this engine, because its own kind is an `fjs/return/scope` refusal; the
 * caller passes line 3's real figure as `earlierScheduleThreeCreditsCents`.
 *
 * **1040 line 19 (the child tax credit) is NOT on this list, and that is what
 * makes the whole ordering acyclic.** Schedule 8812's own Credit Limit
 * Worksheet A subtracts Schedule 3 line 4 — this credit — from ITS limit, so
 * if this worksheet subtracted the child tax credit the two would be mutually
 * defined. They are not: §26 puts the saver's credit before the child tax
 * credit, once, and both printed worksheets agree.
 * @typedef {{ readonly w1: bigint, readonly w2: bigint, readonly w3: bigint }} Form8880CreditLimitWorksheet
 */

/**
 * @typedef {{
 *   readonly kind: 'ok',
 *   readonly columns: readonly Form8880Column[],
 *   readonly line7: bigint,
 *   readonly line8: bigint,
 *   readonly line9RatePercent: number,
 *   readonly line10: bigint,
 *   readonly line11: bigint,
 *   readonly line12: bigint,
 *   readonly creditLimitWorksheet: Form8880CreditLimitWorksheet,
 * }} Form8880Result
 */

/**
 * A case this module will not compute. A VALUE, never a throw — the same
 * shape `fjs/form8889`, `fjs/schedule/a` and `fjs/schedule/d` already return,
 * so `fjs/schedule/3` can thread it into `fjs/form1040/core`'s existing error
 * arm without a new mechanism. No `unmodeled` field: this is
 * document-data sufficiency, not an `fjs/return/scope` kind.
 * @typedef {{ readonly kind: 'error', readonly message: string }} Form8880Refusal
 */

/** @typedef {Form8880Result | Form8880Refusal} Form8880Outcome */

// ── The rate lookup ──────────────────────────────────────────────────────────

/**
 * **Form 8880 line 9, the whole of the cliff.** Walks the stored bands in
 * order and returns the first whose ceiling `agiCents` does not EXCEED; the
 * last band's `ceiling` is `undefined`, which no income can exceed, so the
 * walk is total and no fallback rate is written anywhere.
 *
 * The comparison is `<=`, because the printed table reads *"over $47,500 but
 * not over $51,000"* — at EXACTLY a ceiling the higher rate still applies,
 * and one cent more drops to the next. Writing `<` here would move all nine
 * boundaries by a cent in the taxpayer's disfavour;
 * {@link proof.cliffBoundaries} is what stops that.
 *
 * Exported so a caller — or a proof — can ask what rate an income selects
 * without building a whole form, and so this one rule lives in one place.
 * @type {(taxParamSet: TaxParamSet) => (status: IndividualFilingStatus) => (agiCents: bigint) => number}
 */
export const saversCreditRatePercent = taxParamSet => status => agiCents => {
    const bands = taxParamSet.retirementSavingsContributionsCredit.rateBands[status]
    const band = bands.find(candidate =>
        candidate.ceiling === undefined || agiCents <= centsFromString(candidate.ceiling))
    assert(
        band !== undefined,
        ['every stored rate band list must end with an open-topped band', status, agiCents],
    )
    return band === undefined ? 0 : band.ratePercent
}

// ── Form 8880 itself ─────────────────────────────────────────────────────────

/**
 * Computes Form 8880, or refuses by name. See this module's own docstring for
 * the full table of what is computed and what is not.
 * @type {(taxParamSet: TaxParamSet) => (input: Form8880Input) => Form8880Outcome}
 */
export const form8880 = taxParamSet => input => {
    const {
        status, agiCents, claimedAsDependent, people, saversCreditDeclared,
        line18Cents, earlierScheduleThreeCreditsCents, aStored1099RProvesADistribution,
    } = input
    const { retirementSavingsContributionsCredit } = taxParamSet

    // 9. The rate, computed FIRST -- before any refusal -- because every
    //    refusal below is gated on the credit being able to matter at all.
    //    An income above the top band credits nothing at any contribution, so
    //    a return there must compute $0 silently rather than being refused
    //    for an eligibility answer that could not have changed anything.
    const line9RatePercent = saversCreditRatePercent(taxParamSet)(status)(agiCents)

    const totalIraContributionCents = people.reduce((t, p) => t + p.iraContributionCents, 0n)
    const totalElectiveDeferralCents = people.reduce((t, p) => t + p.electiveDeferralCents, 0n)
    const anyContribution = totalIraContributionCents + totalElectiveDeferralCents !== 0n
    // §25B(c)(3): an individual another taxpayer can claim as a dependent is
    // not an eligible individual, so the credit is a determinate $0 -- not a
    // refusal, and not a reason to demand eligibility answers.
    //
    // `engaged` is the condition this module's own docstring calls a REAL
    // GAP: a return that neither declares this credit nor supplies any
    // §25B(c) answer has not claimed it, and refusing such a return for
    // unanswered questions would refuse every 401(k) contributor in the
    // country. Read the docstring's "That last condition is a REAL GAP"
    // before removing it.
    const engaged = saversCreditDeclared || people.some(p => p.eligibility !== undefined)
    const creditCouldMatter =
        anyContribution && line9RatePercent !== 0 && !claimedAsDependent && engaged

    // ── Every refusal runs BEFORE any line is assigned ───────────────────
    // (`fjs/form8889`'s own ordering discipline: a gate is a gate, never a
    // consequence of arithmetic that happened to come out a certain way.)
    if (creditCouldMatter && aStored1099RProvesADistribution) {
        return {
            kind: 'error',
            message: 'Form 8880 line 4 (distributions received during the testing period) cannot be '
                + 'computed: a stored Form 1099-R proves a retirement plan distribution inside the '
                + '§25B(d)(2) testing period, which reduces this credit dollar for dollar. The '
                + 'testing period also spans the two prior tax years and the part of the next one '
                + 'up to this return’s due date, and this engine holds documents for one year '
                + 'only; refusing rather than entering -0- on line 4 and overstating the credit',
        }
    }
    if (status === 'marriedFilingJointly' && creditCouldMatter && totalElectiveDeferralCents !== 0n) {
        return {
            kind: 'error',
            message: 'Form 8880 line 2 (elective deferrals) cannot be attributed on a joint return: '
                + 'the deferrals arrive on Form W-2 box 12 and this form has one column per spouse '
                + 'with a separate $2,000 cap on each, but no document this engine models says '
                + "WHICH spouse's W-2 it is. Attributing them to the wrong column would move the "
                + 'credit; refusing rather than guessing (no phase yet)',
        }
    }
    for (const person of people) {
        if (!creditCouldMatter) {
            continue
        }
        const contributed = person.iraContributionCents + person.electiveDeferralCents !== 0n
        if (!contributed) {
            continue
        }
        if (person.eligibility === undefined) {
            return {
                kind: 'error',
                message: `Form 8880: this return records qualifying retirement savings `
                    + `contributions for the ${person.individual}, but no credits document answers `
                    + `§25B(c)'s eligibility questions for that person. Whether they had attained `
                    + `age 18 and whether they were a full-time student point in OPPOSITE `
                    + `directions when unanswered — one would deny a credit that may be owed and `
                    + `the other would grant one that may not be — so there is no safe default and `
                    + `this engine refuses rather than choosing one`,
            }
        }
        if (!person.eligibility.noTestingPeriodDistributions) {
            return {
                kind: `error`,
                message: `Form 8880 line 4 (distributions received during the testing period) cannot `
                    + `be computed for the ${person.individual}: §25B(d)(2)'s testing period spans `
                    + `the two tax years before this one, this one, and the part of the next one up `
                    + `to this return's due date, and this engine holds documents for one year only. `
                    + `Nothing on this return asserts that no such distribution was received; `
                    + `refusing rather than entering -0- on line 4 and overstating the credit`,
            }
        }
    }

    // ── The columns, lines 1 through 6 ───────────────────────────────────
    /** @type {readonly Form8880Column[]} */
    const columns = people.map(person => {
        // §25B(c)'s three conditions, applied here rather than at the
        // refusals above, because an ANSWERED "no" is a determinate zero:
        // an ineligible individual's whole column is nothing.
        const eligible = !claimedAsDependent
            && person.eligibility !== undefined
            && person.eligibility.attainedAgeEighteen
            && !person.eligibility.wasAFullTimeStudent
        // 1. "Traditional and Roth IRA contributions ... for 2025."
        const line1 = eligible ? person.iraContributionCents : 0n
        // 2. "Elective deferrals to a 401(k) or other qualified employer
        //    plan, voluntary employee contributions, 501(c)(18)(D) plan
        //    contributions, and contributions to an ABLE account..."
        const line2 = eligible ? person.electiveDeferralCents : 0n
        // 3. "Add lines 1 and 2."
        const line3 = line1 + line2
        // 4. "Certain distributions received after 2022 and before the due
        //    date of the 2025 return." Refused above whenever it could be
        //    non-zero, so the only value it reaches here is zero -- kept as
        //    its own printed line rather than folded away.
        const line4 = 0n
        // 5. "Subtract line 4 from line 3. If zero or less, enter -0-."
        const line5 = line3 > line4 ? line3 - line4 : 0n
        // 6. "In each column, enter the smaller of line 5 or $2,000." PER
        //    COLUMN -- applying this cap to the two columns' sum would halve
        //    a two-contributor couple's creditable contributions.
        const capCents = centsFromString(retirementSavingsContributionsCredit.contributionCap.amount)
        const line6 = line5 < capCents ? line5 : capCents
        return { individual: person.individual, line1, line2, line3, line4, line5, line6 }
    })

    // 7. "Add the amounts on line 6."
    const line7 = columns.reduce((total, column) => total + column.line6, 0n)
    // 8. "Enter the amount from Form 1040 ... line 11."
    const line8 = agiCents
    // 10. "Multiply line 7 by line 9." The ONE rounding point on this form.
    const line10 = halfUp(of(line7 * BigInt(line9RatePercent))(100n))
    // 11. "Limitation based on tax liability. Enter the amount from the
    //     Credit Limit Worksheet in the instructions."
    const w1 = line18Cents
    const w2 = earlierScheduleThreeCreditsCents
    const w3 = w1 > w2 ? w1 - w2 : 0n
    const line11 = w3
    // 12. "Enter the smaller of line 10 or line 11 here and on Schedule 3
    //     (Form 1040), line 4."
    const line12 = line10 < line11 ? line10 : line11
    assert(line12 >= 0n, ['Form 8880 line 12 must never be negative', line12])

    return {
        kind: 'ok',
        columns,
        line7, line8, line9RatePercent, line10, line11, line12,
        creditLimitWorksheet: { w1, w2, w3 },
    }
}

// ── Tests ────────────────────────────────────────────────────────────────────

/**
 * TY2025's parameter set, narrowed exactly ONCE at module scope, mirroring
 * `fjs/form8889`'s and `fjs/form8812`'s own precedent.
 */
const taxParams2025 = taxParamsByYear[2025]
assert(taxParams2025 !== undefined, 'expected TY2025 parameters to be present in taxParamsByYear')

/** @type {SaversCreditEligibility} */
const fullyEligible = {
    attainedAgeEighteen: true,
    wasAFullTimeStudent: false,
    noTestingPeriodDistributions: true,
}

/** @type {(overrides: Partial<Form8880Person>) => Form8880Person} */
const person = overrides => ({
    individual: 'taxpayer',
    iraContributionCents: 0n,
    electiveDeferralCents: 0n,
    eligibility: fullyEligible,
    ...overrides,
})

/**
 * The ordinary case: a single filer with $2,000 of IRA contributions, ample
 * tax liability, and an income well inside the 50% band.
 * @type {(overrides: Partial<Form8880Input>) => Form8880Input}
 */
const baseInput = overrides => ({
    status: 'single',
    agiCents: 2000000n,             // $20,000.00 -- inside the 50% band
    claimedAsDependent: false,
    saversCreditDeclared: true,
    people: [person({ iraContributionCents: 200000n })],
    line18Cents: 100000000n,        // ample, so line 11 never binds
    earlierScheduleThreeCreditsCents: 0n,
    aStored1099RProvesADistribution: false,
    ...overrides,
})

/** Narrows an outcome to its OK arm, throwing (never casting) if it is not.
 * @type {(outcome: Form8880Outcome) => Form8880Result}
 */
const okResult = outcome => {
    assert(outcome.kind === 'ok', ['expected a computed Form 8880', outcome])
    return outcome
}

/** Narrows an outcome to its refusal arm, throwing (never casting) if it is not.
 * @type {(outcome: Form8880Outcome) => Form8880Refusal}
 */
const refusal = outcome => {
    assert(outcome.kind === 'error', ['expected a refusal', outcome])
    return outcome
}

/** @type {(input: Form8880Input) => Form8880Outcome} */
const compute = form8880(taxParams2025)

/** @type {(status: IndividualFilingStatus) => (agiCents: bigint) => number} */
const rateAt = saversCreditRatePercent(taxParams2025)

export const proof = {
    // The ordinary case, every line hand-typed from the printed form's own
    // arithmetic rather than read back from the result: line 1 = $2,000.00,
    // line 2 = $0.00, line 3 = $2,000.00, line 4 = $0.00, line 5 = $2,000.00,
    // line 6 = min($2,000.00, $2,000.00) = $2,000.00, line 7 = $2,000.00,
    // line 8 = $20,000.00, line 9 = 50%, line 10 = $1,000.00, line 11 =
    // $1,000,000.00 - $0.00, line 12 = min($1,000.00, $1,000,000.00) =
    // $1,000.00.
    theOrdinaryFiftyPercentCase: () => {
        const result = okResult(compute(baseInput({})))
        const column = result.columns[0]
        assert(column !== undefined, ['expected one column', result.columns])
        assertEq(column?.line1, 200000n, '$2,000.00 of IRA contributions')
        assertEq(column?.line2, 0n)
        assertEq(column?.line3, 200000n)
        assertEq(column?.line4, 0n)
        assertEq(column?.line5, 200000n)
        assertEq(column?.line6, 200000n)
        assertEq(result.line7, 200000n)
        assertEq(result.line8, 2000000n, '$20,000.00 of adjusted gross income')
        assertEq(result.line9RatePercent, 50)
        assertEq(result.line10, 100000n, '50% of $2,000.00 = $1,000.00')
        assertEq(result.line12, 100000n, '-> Schedule 3 line 4')
    },
    // The $2,000 cap is PER COLUMN and it bites: $5,000 contributed yields
    // $2,000 of creditable contributions, not $5,000. Without this leaf
    // `line6 = line5` would pass every other fixture in this file.
    contributingMoreThanTheCapCreditsOnlyTheCap: () => {
        const result = okResult(compute(baseInput({
            people: [person({ iraContributionCents: 500000n })],
        })))
        assertEq(result.columns[0]?.line5, 500000n, '$5,000.00 contributed')
        assertEq(result.columns[0]?.line6, 200000n, 'capped at $2,000.00')
        assertEq(result.line10, 100000n, '50% of $2,000.00, never 50% of $5,000.00')
    },
    // The cap is applied INSIDE each column and the columns are added AFTER,
    // which is the opposite of capping the sum. Two spouses contributing
    // $2,000 each give $4,000 of creditable contributions, not $2,000 --
    // capping the total would silently halve a two-contributor couple.
    //
    // This fixture uses IRA contributions on both sides deliberately: line 2
    // is refused on a joint return (see `refusals` below), so a deferral
    // here would measure the refusal rather than the cap.
    theCapIsPerColumnAndTheColumnsAreAddedAfter: () => {
        const result = okResult(compute(baseInput({
            status: 'marriedFilingJointly',
            agiCents: 4000000n,      // $40,000.00 -- inside the joint 50% band
            people: [
                person({ individual: 'taxpayer', iraContributionCents: 200000n }),
                person({ individual: 'spouse', iraContributionCents: 200000n }),
            ],
        })))
        assertEq(result.columns.length, 2)
        assertEq(result.columns[0]?.line6, 200000n)
        assertEq(result.columns[1]?.line6, 200000n)
        assertEq(result.line7, 400000n, '$4,000.00 -- two separate $2,000 caps, added after')
        assertEq(result.line10, 200000n, '50% of $4,000.00 = $2,000.00')
    },

    // ── The cliff, at every one of the nine printed boundaries ─────────────
    //
    // Each status's three ceilings, one cent below / exactly at / one cent
    // above, against HAND-TYPED rates read off the printed 2025 Form 8880
    // line 9 table rather than from the stored data. This is the block that
    // catches a `<=` written as `<`, a band list read in the wrong order, and
    // a status column swapped for another.
    cliffBoundaries: {
        singleFilerAtAllThreeCeilings: () => {
            // 50% up to $23,750.00; 20% to $25,500.00; 10% to $39,500.00.
            assertEq(rateAt('single')(2374999n), 50, '$23,749.99 -> 50%')
            assertEq(rateAt('single')(2375000n), 50, '$23,750.00 exactly -> still 50% ("not over")')
            assertEq(rateAt('single')(2375001n), 20, '$23,750.01 -> 20%, the first cliff')
            assertEq(rateAt('single')(2549999n), 20, '$25,499.99 -> 20%')
            assertEq(rateAt('single')(2550000n), 20, '$25,500.00 exactly -> still 20%')
            assertEq(rateAt('single')(2550001n), 10, '$25,500.01 -> 10%')
            assertEq(rateAt('single')(3949999n), 10, '$39,499.99 -> 10%')
            assertEq(rateAt('single')(3950000n), 10, '$39,500.00 exactly -> still 10%')
            assertEq(rateAt('single')(3950001n), 0, '$39,500.01 -> no credit at all')
        },
        marriedFilingJointlyAtAllThreeCeilings: () => {
            // 50% up to $47,500.00; 20% to $51,000.00; 10% to $79,000.00.
            assertEq(rateAt('marriedFilingJointly')(4750000n), 50, '$47,500.00 exactly -> 50%')
            assertEq(rateAt('marriedFilingJointly')(4750001n), 20, '$47,500.01 -> 20%')
            assertEq(rateAt('marriedFilingJointly')(5100000n), 20, '$51,000.00 exactly -> 20%')
            assertEq(rateAt('marriedFilingJointly')(5100001n), 10, '$51,000.01 -> 10%')
            assertEq(rateAt('marriedFilingJointly')(7900000n), 10, '$79,000.00 exactly -> 10%')
            assertEq(rateAt('marriedFilingJointly')(7900001n), 0, '$79,000.01 -> no credit at all')
        },
        headOfHouseholdAtAllThreeCeilings: () => {
            // 50% up to $35,625.00; 20% to $38,250.00; 10% to $59,250.00.
            assertEq(rateAt('headOfHousehold')(3562500n), 50, '$35,625.00 exactly -> 50%')
            assertEq(rateAt('headOfHousehold')(3562501n), 20, '$35,625.01 -> 20%')
            assertEq(rateAt('headOfHousehold')(3825000n), 20, '$38,250.00 exactly -> 20%')
            assertEq(rateAt('headOfHousehold')(3825001n), 10, '$38,250.01 -> 10%')
            assertEq(rateAt('headOfHousehold')(5925000n), 10, '$59,250.00 exactly -> 10%')
            assertEq(rateAt('headOfHousehold')(5925001n), 0, '$59,250.01 -> no credit at all')
        },
        // The two statuses that SHARE single's printed column, asserted on
        // their own. AGENTS.md records a mutation in which
        // married-filing-separately stayed green precisely because it
        // genuinely shared single's figures — so a `rateBands[status]`
        // mutated to `rateBands.single` is invisible on these two by
        // construction, and it is head of household and joint above that
        // catch it. Both are here anyway, because the day a Revenue
        // Procedure separates them these are the leaves that notice.
        separateAndSurvivingSpouseShareSinglesColumnToday: () => {
            for (const status of /** @type {readonly IndividualFilingStatus[]} */ ([
                'marriedFilingSeparately', 'qualifyingSurvivingSpouse',
            ])) {
                assertEq(rateAt(status)(2375000n), 50, `${status}: $23,750.00 exactly -> 50%`)
                assertEq(rateAt(status)(2375001n), 20, `${status}: $23,750.01 -> 20%`)
                assertEq(rateAt(status)(3950001n), 0, `${status}: $39,500.01 -> no credit`)
            }
        },
        // What the cliff COSTS, end to end, in dollars: the same $2,000 of
        // contributions is worth $1,000 at $23,750.00 and $400 one cent
        // later. Stated as money rather than as a rate, because the rate is
        // the mechanism and this is the consequence.
        oneCentOfIncomeCostsSixHundredDollars: () => {
            const at = okResult(compute(baseInput({ agiCents: 2375000n })))
            const oneCentOver = okResult(compute(baseInput({ agiCents: 2375001n })))
            assertEq(at.line12, 100000n, '$23,750.00: 50% of $2,000.00 = $1,000.00')
            assertEq(oneCentOver.line12, 40000n, '$23,750.01: 20% of $2,000.00 = $400.00')
            assertEq(at.line12 - oneCentOver.line12, 60000n, 'one cent of income costs $600.00')
        },
        // Above the top band the credit is zero, and it is a COMPUTED zero
        // rather than a refusal — which is what lets a high-income return
        // with a 401(k) deferral go on computing exactly as it did before
        // this phase existed.
        aboveTheTopBandIsAComputedZeroAndNotARefusal: () => {
            const outcome = compute(baseInput({
                agiCents: 20000000n,     // $200,000.00
                people: [person({ iraContributionCents: 200000n, eligibility: undefined })],
            }))
            const result = okResult(outcome)
            assertEq(result.line9RatePercent, 0)
            assertEq(result.line10, 0n)
            assertEq(result.line12, 0n)
        },
    },

    // ── The Credit Limit Worksheet, and the ordering it encodes ────────────
    creditLimitWorksheet: {
        // The credit cannot exceed the tax it offsets. $150 of tax liability
        // caps a $1,000 credit at $150 -- the property that keeps a
        // nonrefundable credit from creating a refund.
        theCreditIsCappedByTaxLiability: () => {
            const result = okResult(compute(baseInput({ line18Cents: 15000n })))
            assertEq(result.line10, 100000n, 'the credit before the limit is $1,000.00')
            assertEq(result.line11, 15000n, 'the limit is $150.00 of tax')
            assertEq(result.line12, 15000n, 'and the credit is $150.00, never $1,000.00')
        },
        // The worksheet's line 2 subtracts the credits §26 orders BEFORE this
        // one. $600 of education credits leaves $400 of the $1,000 tax for
        // the saver's credit, so a $1,000 saver's credit lands at $400.
        earlierCreditsReduceTheLimit: () => {
            const result = okResult(compute(baseInput({
                line18Cents: 100000n,
                earlierScheduleThreeCreditsCents: 60000n,
            })))
            assertEq(result.creditLimitWorksheet.w1, 100000n, '$1,000.00 of tax')
            assertEq(result.creditLimitWorksheet.w2, 60000n, '$600.00 of education credits')
            assertEq(result.creditLimitWorksheet.w3, 40000n, '$400.00 left')
            assertEq(result.line12, 40000n)
        },
        // "But if zero or less, stop; you can't take the credit." Earlier
        // credits that consume the whole liability leave nothing, and the
        // floor is the printed instruction rather than a defensive clamp.
        earlierCreditsConsumingTheWholeLiabilityLeaveNothing: () => {
            const result = okResult(compute(baseInput({
                line18Cents: 50000n,
                earlierScheduleThreeCreditsCents: 80000n,
            })))
            assertEq(result.creditLimitWorksheet.w3, 0n, 'never negative')
            assertEq(result.line12, 0n)
        },
    },

    // ── §25B(c) eligibility: determinate zeros, not refusals ──────────────
    eligibility: {
        aFullTimeStudentsColumnIsZero: () => {
            const result = okResult(compute(baseInput({
                people: [person({
                    iraContributionCents: 200000n,
                    eligibility: { ...fullyEligible, wasAFullTimeStudent: true },
                })],
            })))
            assertEq(result.columns[0]?.line1, 0n, '§25B(c)(2): not an eligible individual')
            assertEq(result.line12, 0n)
        },
        anIndividualUnderEighteenHasAZeroColumn: () => {
            const result = okResult(compute(baseInput({
                people: [person({
                    iraContributionCents: 200000n,
                    eligibility: { ...fullyEligible, attainedAgeEighteen: false },
                })],
            })))
            assertEq(result.columns[0]?.line1, 0n, '§25B(c)(1): not an eligible individual')
            assertEq(result.line12, 0n)
        },
        // The dependent test comes off the RETURN PROFILE's 1040 line 12a,
        // not off a second field of this form's own -- one rule, one place.
        // It also short-circuits the eligibility refusal: a dependent is
        // determinately ineligible, so their unanswered questions cannot
        // change anything and demanding them would be noise.
        aDependentGetsAZeroAndIsNotAskedForEligibilityAnswers: () => {
            const outcome = compute(baseInput({
                claimedAsDependent: true,
                people: [person({ iraContributionCents: 200000n, eligibility: undefined })],
            }))
            const result = okResult(outcome)
            assertEq(result.columns[0]?.line1, 0n, '§25B(c)(3): not an eligible individual')
            assertEq(result.line12, 0n)
        },
        // The CONTROL for all three above: a gate that zeroed everything
        // would pass them. An eligible individual's column is NOT zero.
        anEligibleIndividualsColumnIsNotZero: () => {
            const result = okResult(compute(baseInput({})))
            assertEq(result.columns[0]?.line1, 200000n)
            assert(result.line12 > 0n, ['expected a real credit', result.line12])
        },
    },

    // ── The refusals ──────────────────────────────────────────────────────
    refusals: {
        // The testing period, half one: nobody answered. The message must
        // name the printed LINE and the four-year WINDOW, which is the part
        // a reader can act on -- not merely say "cannot compute".
        anUnansweredTestingPeriodIsRefusedNamingLineFour: () => {
            const result = refusal(compute(baseInput({
                people: [person({
                    iraContributionCents: 200000n,
                    eligibility: { ...fullyEligible, noTestingPeriodDistributions: false },
                })],
            })))
            assert(result.message.includes('line 4'), ['must name the printed line', result.message])
            assert(
                result.message.includes('two tax years before this one'),
                ['must name the window this engine cannot see', result.message],
            )
        },
        // The testing period, half two: the DOCUMENTS contradict the
        // assertion. This fires even though `noTestingPeriodDistributions`
        // was asserted true -- evidence in hand beats an assertion, and the
        // opposite ordering would let an assertion override a document the
        // engine is holding.
        aStoredRetirementDistributionOverridesTheAssertion: () => {
            const result = refusal(compute(baseInput({
                aStored1099RProvesADistribution: true,
                people: [person({ iraContributionCents: 200000n, eligibility: fullyEligible })],
            })))
            assert(result.message.includes('line 4'), ['must name the printed line', result.message])
            assert(
                result.message.includes('Form 1099-R'),
                ['must name the document that proves it', result.message],
            )
        },
        // No eligibility record at all, for a person with contributions.
        // The message must say WHY there is no default -- that the two
        // unanswered questions point in opposite directions -- because a
        // reader who is told only "answer this" cannot tell whether the
        // engine was being cautious or was simply incomplete.
        aMissingEligibilityRecordIsRefusedNamingBothDirections: () => {
            const result = refusal(compute(baseInput({
                people: [person({ iraContributionCents: 200000n, eligibility: undefined })],
            })))
            assert(result.message.includes('§25B(c)'), ['must name the provision', result.message])
            assert(
                result.message.includes('OPPOSITE'),
                ['must say why there is no safe default', result.message],
            )
            assert(
                result.message.includes('taxpayer'),
                ['must name WHICH person is unanswered', result.message],
            )
        },
        // The joint-return attribution gap for Form W-2 box 12 -- the same
        // gap `fjs/schedule/1` line 13 already refuses for code W, refused
        // here for the deferral codes and naming both the box and the reason.
        electiveDeferralsOnAJointReturnAreRefusedNamingTheBox: () => {
            const result = refusal(compute(baseInput({
                status: 'marriedFilingJointly',
                agiCents: 4000000n,
                people: [
                    person({ individual: 'taxpayer', electiveDeferralCents: 250000n }),
                    person({ individual: 'spouse', iraContributionCents: 100000n }),
                ],
            })))
            assert(result.message.includes('box 12'), ['must name the box', result.message])
            assert(
                result.message.includes('$2,000 cap'),
                ['must name what the misattribution would move', result.message],
            )
        },
        // The CONTROL for the leaf above: the SAME deferral on a single
        // return has only one column to go in, so it computes. A refusal
        // written against the presence of a deferral rather than against the
        // joint return would fail this.
        theSameDeferralOnASingleReturnComputes: () => {
            const result = okResult(compute(baseInput({
                people: [person({ electiveDeferralCents: 250000n })],
            })))
            assertEq(result.columns[0]?.line2, 250000n, '$2,500.00 deferred')
            assertEq(result.columns[0]?.line6, 200000n, 'capped at $2,000.00')
            assertEq(result.line12, 100000n, '50% of $2,000.00')
        },
        // Every refusal above is gated on the credit being able to matter.
        // A return with NO qualifying contribution is never refused, however
        // little it asserts -- which is what keeps criterion 4 true, that a
        // return claiming no credits computes exactly what it computed
        // before this phase.
        aReturnWithNoContributionsIsNeverRefused: () => {
            const outcome = compute(baseInput({
                people: [person({ eligibility: undefined })],
                aStored1099RProvesADistribution: true,
            }))
            const result = okResult(outcome)
            assertEq(result.line7, 0n)
            assertEq(result.line12, 0n)
        },
        // …and neither is one whose income is above the top band, for the
        // same reason: the eligibility answer could not have changed the
        // outcome. This is the leaf that stops the refusals above from
        // reaching every high-earning 401(k) contributor in the world.
        aReturnAboveTheTopBandIsNeverRefused: () => {
            const outcome = compute(baseInput({
                agiCents: 20000000n,
                people: [person({ electiveDeferralCents: 250000n, eligibility: undefined })],
                aStored1099RProvesADistribution: true,
            }))
            assertEq(outcome.kind, 'ok', 'an income above the top band cannot be refused')
        },
        // **The GAP, asserted rather than only described.** A return that
        // neither declares this credit nor answers any §25B(c) question is
        // NOT refused, however squarely it lands in a crediting band with a
        // real deferral. It computes $0 and says nothing — which is the
        // honest cost of not refusing the modal American return, and is
        // written down in this module's own docstring as a gap rather than
        // as a feature.
        //
        // This is also criterion 4 for this form: an ordinary W-2 return with
        // a 401(k) computes exactly what it computed before Phase 25.
        aReturnThatNeverMentionsThisCreditIsNotRefusedAndGetsNothing: () => {
            const outcome = compute(baseInput({
                saversCreditDeclared: false,
                people: [person({ electiveDeferralCents: 200000n, eligibility: undefined })],
            }))
            const result = okResult(outcome)
            assertEq(result.line7, 0n, 'no eligible column, so nothing creditable')
            assertEq(result.line12, 0n, '$0.00 — and no refusal, and no warning')
        },
        // The CONTROL for the gap: the SAME return, DECLARED, is refused —
        // so the declaration is what turns silence into a question, and a
        // gate written against something else would fail this pair.
        theSameReturnDeclaredIsRefused: () => {
            const result = refusal(compute(baseInput({
                saversCreditDeclared: true,
                people: [person({ electiveDeferralCents: 200000n, eligibility: undefined })],
            })))
            assert(result.message.includes('§25B(c)'), ['must name the provision', result.message])
        },
        // …and so is the same return that ANSWERED for one person while
        // another contributed: supplying any eligibility record is engaging
        // with the credit, so the incomplete answer is a question rather
        // than silence. Without this, a joint return could answer for the
        // taxpayer and quietly drop the spouse's column.
        answeringForOnePersonEngagesTheCreditForBoth: () => {
            const result = refusal(compute(baseInput({
                saversCreditDeclared: false,
                status: 'marriedFilingJointly',
                agiCents: 4000000n,
                people: [
                    person({ individual: 'taxpayer', iraContributionCents: 200000n }),
                    person({ individual: 'spouse', iraContributionCents: 200000n, eligibility: undefined }),
                ],
            })))
            assert(result.message.includes('spouse'), ['must name the unanswered person', result.message])
        },
    },

    // The rate lookup's own totality: the last stored band is open-topped, so
    // no income can fall through it and no fallback rate is written anywhere.
    // Asserted at an absurd income rather than a plausible one, because what
    // is being pinned is that the walk cannot run off the end.
    theRateLookupIsTotalAtAnyIncome: () => {
        for (const status of /** @type {readonly IndividualFilingStatus[]} */ ([
            'single', 'marriedFilingJointly', 'marriedFilingSeparately',
            'headOfHousehold', 'qualifyingSurvivingSpouse',
        ])) {
            assertEq(rateAt(status)(0n), 50, `${status}: zero income takes the first band`)
            assertEq(rateAt(status)(10n ** 15n), 0, `${status}: an absurd income still resolves`)
        }
    },

    // Every printed line is named. A hand-typed count, so a line silently
    // dropped from either returned record is caught (AGENTS.md's
    // hand-typed-count idiom).
    everyPrintedLineIsNamed: () => {
        const result = okResult(compute(baseInput({})))
        assertEq(
            Object.keys(result).length,
            9,
            'kind, columns, lines 7/8/9/10/11/12, and the credit limit worksheet',
        )
        const column = result.columns[0]
        assert(column !== undefined, ['expected one column', result.columns])
        assertEq(Object.keys(column ?? {}).length, 7, 'the individual plus printed lines 1 through 6')
        assertEq(Object.keys(result.creditLimitWorksheet).length, 3, 'the worksheet has three lines')
    },
}
