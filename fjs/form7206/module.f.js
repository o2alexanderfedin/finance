/**
 * Form 7206 — Self-Employed Health Insurance Deduction (IRC §162(l)),
 * TAX-39. Every printed line 1 through 14 named and computed.
 *
 * Source, transcribed directly from the printed PDF rather than from recall
 * or from a summary: `f7206.pdf` (2025), Cat. No. 56399C, "Created 10/2/25",
 * Attachment Sequence No. 206.
 *
 * ## Publication 535 is gone, and the remedy that named it was stale twice
 *
 * Every prior statement in this repository about Schedule 1 line 17 says the
 * line *"requires the Pub. 535 self-employed health insurance deduction
 * worksheet"* — `fjs/return/scope`'s `unmodeledKindRefusals` row, and
 * `fjs/form8995`'s own docstring table quoting it. **That publication no
 * longer exists.** IRS, *About Publication 535, Business Expenses*: *"We have
 * discontinued Publication 535, Business Expenses; the last revision was for
 * 2022."*
 *
 * What replaced it is not another worksheet in another publication. It is a
 * printed FORM, which is why this module exists at all rather than a helper
 * inside `fjs/schedule/1`. 2025 Instructions for Form 7206, p. 1, Reminder:
 *
 * > *"This form and its separate instructions have replaced the Self-Employed
 * > Health Insurance Deduction Worksheet that was previously published as a
 * > worksheet in Pub. 535, Business Expenses."*
 *
 * So the remedy was wrong in a way that no amount of re-reading it would have
 * caught: it named a document that had ceased to exist, and a reader sent to
 * find it would have found the 2022 revision and computed a prior year's
 * rule. **A remedy that names a source is only as good as the source's
 * continued existence**, and nothing in this repository checks that.
 *
 * There IS still a worksheet, and it is deliberately not what this module
 * implements. The 2025 Instructions for Forms 1040 and 1040-SR, p. 94, print
 * a three-line *"Self-Employed Health Insurance Deduction Worksheet—Schedule
 * 1, Line 17"* for the simple case, and p. 95 lists the three exceptions that
 * send a filer to Form 7206 instead: more than one source of income subject
 * to self-employment tax, a Form 2555, or **qualified long-term-care
 * premiums**. This engine models long-term care (line 2), so the worksheet
 * would be the wrong page for a return this module can already compute — and
 * the two disagree in the multi-business case, which is the whole subject of
 * lines 5 through 7 below.
 *
 * ## The three-argument shape of the deduction
 *
 * Printed line 14 is `min(line 3, line 13)`, and the two arguments are
 * genuinely different quantities:
 *
 * | | What it is | Statute |
 * |---|---|---|
 * | line 3 | what was PAID, after §213(d)(10)'s per-person long-term-care caps | §162(l)(1) |
 * | line 13 | what the business EARNED, after §164(f) and §404 | §162(l)(2)(A) via §401(c)(2) |
 *
 * §162(l)(2)(A): *"No deduction shall be allowed under paragraph (1) to the
 * extent that the amount of such deduction exceeds the taxpayer's earned
 * income (within the meaning of section 401(c)) derived by the taxpayer from
 * the trade or business with respect to which the plan providing the medical
 * care coverage is established."* §401(c)(2)(A) is where the two subtractions
 * come from: net earnings from self-employment determined *"(v) with regard
 * to the deductions allowed by section 404 to the taxpayer, and (vi) with
 * regard to the deduction allowed to the taxpayer by section 164(f)"* —
 * clause (vi) being Schedule 1 line 15 and clause (v) Schedule 1 line 16.
 *
 * ## Lines 5, 6 and 7: the §164(f) half is PRORATED, not subtracted whole
 *
 * This is the part a reader who knows the old three-line worksheet will get
 * wrong, and it is the reason the two pages disagree. The worksheet says
 * *"minus any deductions on Schedule 1, lines 15 and 16"* — the whole of
 * each. Form 7206 does not:
 *
 * - line 5 is *"the total of all net profits"* across every business,
 * - line 6 is *"Divide line 4 by line 5"*,
 * - line 7 is *"Multiply Schedule 1 (Form 1040), line 15 … by the percentage
 *   on line 6"*.
 *
 * So §164(f) is apportioned by profit share, while line 9 takes only the part
 * of line 16 *"attributable to the same trade or business in which the
 * insurance plan is established"* — traced rather than apportioned. Two
 * different allocation rules on two adjacent lines, and neither is the other.
 *
 * **This module implements the proration even though its only caller feeds it
 * `line4 === line5` today.** `fjs/schedule/1` refuses the return whose line 4
 * and line 5 differ, because nothing stored says WHICH trade or business the
 * plan is established under — see that module's own refusal. The arithmetic
 * is here, proven against hand-typed multi-business figures, because a form
 * module in this project is a standalone pure function over `bigint` facts
 * (`fjs/form3903`'s and `fjs/form8889`'s relationship to their callers), and
 * because the printed page's rule is the thing worth recording.
 *
 * `line6` is never materialised as a rounded percentage. Rounding a ratio to
 * a printed number of decimals and then multiplying is how a cent goes
 * missing; {@link form7206} multiplies line 15 by the exact rational
 * `line4 / line5` and rounds ONCE, half-up, which is `fjs/schedule/se`'s own
 * treatment of §1402(a)(12)'s 92.35%.
 *
 * ## Line 11 and line 12 are structural zeros HERE and refusals upstream
 *
 * - **Line 11**, an S-corporation more-than-2% shareholder's Medicare wages,
 *   bypasses lines 4-10 entirely (line 4: *"If the business is an S
 *   corporation, skip to line 11"*). This module accepts the figure and line
 *   13 branches on it, so the printed rule is implemented; `fjs/schedule/1`
 *   passes zero and refuses a return holding both premiums and an
 *   S-corporation Schedule K-1, because §162(l)(5) and Rev. Rul. 91-26
 *   require the corporation to have paid or reimbursed the premiums and
 *   reported them as wages, which no document here records.
 * - **Line 12**, Form 2555 line 45, is permanently zero: `foreignEarnedIncomeForm2555`
 *   is a refused `fjs/return/scope` kind, so a return claiming the exclusion
 *   never reaches this function. NAMED rather than omitted, the discipline
 *   `fjs/form8962`'s own line 2a follows for the same Form 2555 and
 *   `fjs/form8995`'s `qualifiedBusinessIncome` follows for its zero terms.
 *
 * ## What this form does NOT decide, and its caller must
 *
 * Three of line 1's own printed exclusions are facts about months and about
 * distributions, not amounts, and none of them is derivable from a `bigint`:
 *
 * > *"But don't include the following. • Amounts for any month you were
 * > eligible to participate in a health plan subsidized by your employer or
 * > your spouse's employer or the employer of either your dependent or your
 * > child who was under the age of 27 at the end of 2025. • Any amounts paid,
 * > not to exceed $3,000, from retirement plan distributions that were
 * > nontaxable because you are a retired public safety officer. • Any
 * > payments for qualified long-term care insurance (see line 2)."*
 *
 * The first is §162(l)(2)(B) and is `fjs/schedule/1`'s to gate, on a
 * `vnd.fjs.return_profile` certification. The second is a Form 1099-R fact
 * this engine does not model, and is also `fjs/schedule/1`'s refusal. The
 * third is this module's own input split — {@link Form7206Input} takes line
 * 1's and line 2's amounts separately and never sums a single "premiums"
 * figure, precisely so a caller cannot put long-term care in the uncapped
 * one.
 *
 * @module
 */
import { assert } from 'functionalscript/fjs/asserts/module.f.mjs'
import { of, multiply, halfUp } from '../types/rational/module.f.js'
import { centsFromString } from '../exact/module.f.js'

/** @import { TaxParamSet, LongTermCareAgeBand } from '../tax/params/module.f.js' */

/**
 * One person covered by a qualified long-term care insurance contract, as
 * printed line 2 asks for them: *"enter for each person covered the smaller
 * of (a) or (b)"*.
 *
 * A LIST rather than a map keyed by band, because two different people may
 * fall in the SAME band and each gets their own cap. Collapsing them into one
 * entry per band would apply a single $1,800 against a couple's combined
 * payments and halve a real deduction.
 * @typedef {{
 *   readonly ageBand: LongTermCareAgeBand,
 *   readonly premiumsCents: bigint,
 * }} LongTermCareCoveredPerson
 */

/**
 * Everything Form 7206 reads, as `bigint` cents and nothing else — no
 * documents, no profile, no filing status. A form module in this project
 * takes extracted facts and returns per-line records.
 *
 * `medicalDentalVisionPremiumsCents` is printed line 1 and is ALREADY net of
 * that line's three printed exclusions; see this module's docstring for which
 * layer enforces each.
 *
 * `deductiblePartOfSelfEmploymentTaxCents` is Schedule 1 line 15 IN FULL —
 * line 7 is where the proration happens, and handing this function a
 * pre-prorated figure would prorate it twice.
 * @typedef {{
 *   readonly medicalDentalVisionPremiumsCents: bigint,
 *   readonly longTermCarePersons: readonly LongTermCareCoveredPerson[],
 *   readonly planBusinessNetProfitCents: bigint,
 *   readonly allBusinessNetProfitsCents: bigint,
 *   readonly deductiblePartOfSelfEmploymentTaxCents: bigint,
 *   readonly retirementPlanDeductionForPlanBusinessCents: bigint,
 *   readonly sCorporationMedicareWagesCents: bigint,
 * }} Form7206Input
 */

/**
 * Form 7206's fourteen printed lines. Line 6 is a RATIO and is carried as its
 * exact numerator and denominator rather than a rounded percentage, for the
 * reason this module's docstring gives: nothing multiplies a rounded ratio
 * here, and a reader checking the page against a printed return needs to see
 * the two figures it was divided from.
 * @typedef {{
 *   readonly line1: bigint, readonly line2: bigint, readonly line3: bigint,
 *   readonly line4: bigint, readonly line5: bigint,
 *   readonly line6Numerator: bigint, readonly line6Denominator: bigint,
 *   readonly line7: bigint, readonly line8: bigint, readonly line9: bigint,
 *   readonly line10: bigint, readonly line11: bigint, readonly line12: bigint,
 *   readonly line13: bigint, readonly line14: bigint,
 * }} Form7206Lines
 */

/**
 * §213(d)(10)'s per-person cap for one age band, in cents, read out of the
 * stored parameter table by band name.
 *
 * `assert`s rather than defaulting when the band is absent: a band this
 * function could not find would otherwise silently become an UNCAPPED
 * long-term-care premium, which is the one direction that overstates the
 * deduction. `fjs/schedule/1` pins its own tag vocabulary against
 * `longTermCarePremiumLimits` so this can never fire from stored data —
 * exactly the relationship `fjs/form8962` has to `federalPovertyLineTables`.
 * @type {(taxParamSet: TaxParamSet) => (band: LongTermCareAgeBand) => bigint}
 */
export const longTermCareCapCents = taxParamSet => band => {
    const limit = taxParamSet.longTermCarePremiumLimits.find(entry => entry.band === band)
    assert(
        limit !== undefined,
        ['§213(d)(10) stores no long-term care premium limit for this age band', band])
    if (limit === undefined) {
        throw ['no long-term care limit for band', band]
    }
    return centsFromString(limit.amount)
}

/**
 * Printed line 2 in full: *"For coverage under a qualified long-term care
 * insurance contract, enter for each person covered the smaller of (a) or
 * (b). (a) Total payments made for that person during the year. (b) The
 * amount shown below."* and the note *"If more than one person is covered,
 * figure separately the amount to enter for each person. Then enter the total
 * of those amounts."*
 *
 * The `min` is INSIDE the fold, never outside it. Capping the sum instead of
 * each person would give a couple aged 55 and 65 paying $3,000 each a single
 * cap against $6,000 rather than $1,800 + $3,000.
 * @type {(taxParamSet: TaxParamSet) => (persons: readonly LongTermCareCoveredPerson[]) => bigint}
 */
export const longTermCarePremiumsAfterCaps = taxParamSet => persons =>
    persons.reduce((total, person) => {
        const cap = longTermCareCapCents(taxParamSet)(person.ageBand)
        const paid = person.premiumsCents
        return total + (paid < cap ? paid : cap)
    }, 0n)

/**
 * Form 7206, lines 1-14 (2025). Pure arithmetic over the `bigint` facts
 * {@link Form7206Input} carries; it cannot refuse, because every fact whose
 * absence would make the deduction uncomputable is settled before the call
 * (see this module's docstring).
 *
 * **Line 14 is floored at zero.** The printed page says *"Enter the smaller
 * of line 3 or line 13"* and line 13 may be negative — a business whose
 * apportioned §164(f) half exceeds its own net profit is arithmetically
 * possible on line 8. A negative Schedule 1 line 17 would be an ADDITION to
 * income, which §162(l) never authorises, so the floor is the statute's
 * *"deduction"* rather than a defensive habit.
 * @type {(taxParamSet: TaxParamSet) => (input: Form7206Input) => Form7206Lines}
 */
export const form7206 = taxParamSet => input => {
    const {
        medicalDentalVisionPremiumsCents, longTermCarePersons, planBusinessNetProfitCents,
        allBusinessNetProfitsCents, deductiblePartOfSelfEmploymentTaxCents,
        retirementPlanDeductionForPlanBusinessCents, sCorporationMedicareWagesCents,
    } = input
    // 1. "Enter the total amount paid in 2025 for health insurance coverage
    //    established under your business … for you, your spouse, and your
    //    dependents." Already net of the line's three printed exclusions.
    const line1 = medicalDentalVisionPremiumsCents
    // 2. The per-person §213(d)(10) caps.
    const line2 = longTermCarePremiumsAfterCaps(taxParamSet)(longTermCarePersons)
    // 3. "Add lines 1 and 2."
    const line3 = line1 + line2
    // 4. "Enter your net profit and any other earned income from the trade or
    //    business under which the insurance plan is established."
    const line4 = planBusinessNetProfitCents
    // 5. "Enter the total of all net profits from Schedule C (Form 1040), line
    //    31; Schedule F (Form 1040), line 34; or Schedule K-1 (Form 1065), box
    //    14, code A … Don't include any net losses shown on these schedules."
    const line5 = allBusinessNetProfitsCents
    // 6. "Divide line 4 by line 5." Carried as the exact ratio; see
    //    {@link Form7206Lines}. A zero denominator is the no-business case,
    //    where line 4 is zero too and the ratio is meaningless rather than
    //    infinite — the ratio is reported as 0/1 and line 7 is zero, which is
    //    the same answer the printed page reaches by having nothing to divide.
    const line6Numerator = line5 === 0n ? 0n : line4
    const line6Denominator = line5 === 0n ? 1n : line5
    // 7. "Multiply Schedule 1 (Form 1040), line 15, deductible part of
    //    self-employment tax, by the percentage on line 6." ONE half-up
    //    rounding over the exact product, never a rounded percentage
    //    multiplied afterwards.
    const line7 = halfUp(multiply(of(deductiblePartOfSelfEmploymentTaxCents)(1n))(
        of(line6Numerator)(line6Denominator)))
    // 8. "Subtract line 7 from line 4."
    const line8 = line4 - line7
    // 9. "Enter the amount, if any, from Schedule 1 (Form 1040), line 16 …
    //    attributable to the same trade or business in which the insurance
    //    plan is established." TRACED to the business, not apportioned across
    //    them — a different rule from line 7's, on the adjacent line.
    const line9 = retirementPlanDeductionForPlanBusinessCents
    // 10. "Subtract line 9 from line 8."
    const line10 = line8 - line9
    // 11. "Enter your Medicare wages (box 5 of Form W-2) from an S corporation
    //     in which you are a more-than-2% shareholder and in which the
    //     insurance plan is established."
    const line11 = sCorporationMedicareWagesCents
    // 12. "Enter any amount from Form 2555, line 45, attributable to the
    //     amount entered on line 4 or 11 above." Structurally zero; see this
    //     module's docstring.
    const line12 = 0n
    // 13. "Subtract line 12 from line 10 or 11, WHICHEVER APPLIES." Line 4's
    //     own instruction is what decides which: "If the business is an S
    //     corporation, skip to line 11", so a non-zero line 11 is the S
    //     corporation path and lines 4-10 did not apply to it.
    const line13 = (line11 !== 0n ? line11 : line10) - line12
    // 14. "Self-employed health insurance deduction. Enter the smaller of line
    //     3 or line 13 here and on Schedule 1 (Form 1040), line 17."
    const smaller = line3 < line13 ? line3 : line13
    const line14 = smaller > 0n ? smaller : 0n
    assert(line14 >= 0n, ['Form 7206 line 14 must never be negative', line14])
    return {
        line1, line2, line3, line4, line5, line6Numerator, line6Denominator,
        line7, line8, line9, line10, line11, line12, line13, line14,
    }
}

// ── Tests ────────────────────────────────────────────────────────────────────

import { assertEq } from 'functionalscript/fjs/asserts/module.f.mjs'
import { taxParamsByYear } from '../tax/params/module.f.js'

const taxParams2025 = taxParamsByYear[2025]
assert(taxParams2025 !== undefined, 'expected TY2025 parameters to be present in taxParamsByYear')

/**
 * The input with every field zero — the base each fixture below widens, so a
 * leaf states only the facts it is about and a field that stops being read is
 * visible as a leaf that stopped changing.
 * @type {Form7206Input}
 */
const noPremiumsNoBusiness = {
    medicalDentalVisionPremiumsCents: 0n,
    longTermCarePersons: [],
    planBusinessNetProfitCents: 0n,
    allBusinessNetProfitsCents: 0n,
    deductiblePartOfSelfEmploymentTaxCents: 0n,
    retirementPlanDeductionForPlanBusinessCents: 0n,
    sCorporationMedicareWagesCents: 0n,
}

export const proof = {
    // ── The worked single-business return, arithmetic hand-typed ────────────
    //
    // A sole proprietor with $60,000.00 of Schedule C net profit who paid
    // $9,600.00 for a family marketplace-free private medical plan. Every
    // expected figure below is computed on paper from the printed captions,
    // NOT read back out of `form7206`:
    //
    //   line 1  = 9,600.00
    //   line 2  = 0.00        (no long-term care)
    //   line 3  = 9,600.00
    //   line 4  = 60,000.00
    //   line 5  = 60,000.00   (one business)
    //   line 6  = 60,000/60,000 = 1
    //   line 7  = 4,239.00 x 1 = 4,239.00
    //   line 8  = 60,000.00 - 4,239.00 = 55,761.00
    //   line 9  = 0.00
    //   line 10 = 55,761.00
    //   line 13 = 55,761.00 - 0 = 55,761.00
    //   line 14 = min(9,600.00, 55,761.00) = 9,600.00
    //
    // $4,239.00 is a plausible Schedule 1 line 15 for this profit and is
    // supplied as a fact rather than derived here: this module never computes
    // self-employment tax, and a proof that recomputed it would be testing
    // `fjs/schedule/se` through the wrong door.
    aSoleProprietorDeductsTheWholePremiumWhenEarnedIncomeExceedsIt: () => {
        const lines = form7206(taxParams2025)({
            ...noPremiumsNoBusiness,
            medicalDentalVisionPremiumsCents: 960000n,
            planBusinessNetProfitCents: 6000000n,
            allBusinessNetProfitsCents: 6000000n,
            deductiblePartOfSelfEmploymentTaxCents: 423900n,
        })
        assertEq(lines.line1, 960000n, 'line 1 = $9,600.00')
        assertEq(lines.line2, 0n, 'line 2 = $0.00, no long-term care')
        assertEq(lines.line3, 960000n, 'line 3 = $9,600.00')
        assertEq(lines.line7, 423900n, 'line 7 = the whole $4,239.00 at 100%')
        assertEq(lines.line8, 5576100n, 'line 8 = $55,761.00')
        assertEq(lines.line10, 5576100n, 'line 10 = $55,761.00')
        assertEq(lines.line13, 5576100n, 'line 13 = $55,761.00')
        assertEq(lines.line14, 960000n, 'line 14 = the smaller, $9,600.00')
    },
    // **The case §162(l)(2)(A) exists for**, and the one a proof that only
    // ever ran a profitable return would never see: the earned-income ceiling
    // BINDS. Same premium, a much smaller business.
    //
    //   line 3  = 9,600.00
    //   line 4  = 8,000.00
    //   line 7  = 565.20 x (8,000/8,000) = 565.20
    //   line 8  = 8,000.00 - 565.20 = 7,434.80
    //   line 13 = 7,434.80
    //   line 14 = min(9,600.00, 7,434.80) = 7,434.80   <- line 13 wins
    theEarnedIncomeCeilingBindsAndItIsLineThirteenThatWins: () => {
        const lines = form7206(taxParams2025)({
            ...noPremiumsNoBusiness,
            medicalDentalVisionPremiumsCents: 960000n,
            planBusinessNetProfitCents: 800000n,
            allBusinessNetProfitsCents: 800000n,
            deductiblePartOfSelfEmploymentTaxCents: 56520n,
        })
        assertEq(lines.line3, 960000n, 'line 3 = $9,600.00 paid')
        assertEq(lines.line7, 56520n, 'line 7 = $565.20')
        assertEq(lines.line13, 743480n, 'line 13 = $7,434.80')
        assertEq(lines.line14, 743480n, 'line 14 takes line 13, not line 3')
        assert(
            lines.line14 < lines.line3,
            ['the ceiling must actually bind, or this leaf proves nothing', lines])
    },
    // **§164(f) is subtracted, and dropping it is worth real money.** Stated
    // as its own leaf rather than left implicit in the two above, because the
    // arithmetic that makes it visible is a SEPARATE fixture: line 13 must be
    // the binding side, or line 14 is `line 3` and line 7 could be anything.
    theSectionOneSixFourFHalfReducesTheCeiling: () => {
        const withHalf = form7206(taxParams2025)({
            ...noPremiumsNoBusiness,
            medicalDentalVisionPremiumsCents: 1000000n,
            planBusinessNetProfitCents: 800000n,
            allBusinessNetProfitsCents: 800000n,
            deductiblePartOfSelfEmploymentTaxCents: 56520n,
        })
        const withoutHalf = form7206(taxParams2025)({
            ...noPremiumsNoBusiness,
            medicalDentalVisionPremiumsCents: 1000000n,
            planBusinessNetProfitCents: 800000n,
            allBusinessNetProfitsCents: 800000n,
            deductiblePartOfSelfEmploymentTaxCents: 0n,
        })
        assertEq(withHalf.line14, 743480n, '$8,000.00 - $565.20')
        assertEq(withoutHalf.line14, 800000n, 'the whole $8,000.00 without it')
        assertEq(
            withoutHalf.line14 - withHalf.line14, 56520n,
            'the difference is exactly Schedule 1 line 15')
    },
    // Line 9 — §404, TRACED rather than apportioned. Its own leaf for the
    // same reason line 7 has one: only a return where line 13 binds can see it.
    theRetirementPlanDeductionReducesTheCeilingToo: () => {
        const lines = form7206(taxParams2025)({
            ...noPremiumsNoBusiness,
            medicalDentalVisionPremiumsCents: 1000000n,
            planBusinessNetProfitCents: 800000n,
            allBusinessNetProfitsCents: 800000n,
            deductiblePartOfSelfEmploymentTaxCents: 56520n,
            retirementPlanDeductionForPlanBusinessCents: 150000n,
        })
        assertEq(lines.line9, 150000n, 'line 9 = $1,500.00')
        assertEq(lines.line10, 593480n, 'line 10 = $7,434.80 - $1,500.00')
        assertEq(lines.line14, 593480n, 'and line 14 follows it down')
    },
    // ── Lines 5/6/7: the proration the old worksheet does not have ──────────
    //
    // Two businesses, the plan under the smaller one. Hand-typed from the
    // printed captions:
    //
    //   line 4 = 30,000.00, line 5 = 100,000.00  ->  line 6 = 3/10
    //   line 7 = 7,065.00 x 3/10 = 2,119.50
    //   line 8 = 30,000.00 - 2,119.50 = 27,880.50
    //   line 14 = min(4,000.00, 27,880.50) = 4,000.00
    //
    // The figure that matters is line 7: subtracting the WHOLE $7,065.00 (what
    // the three-line Form 1040 worksheet says) would give line 8 = 22,935.00.
    // Both leave line 3 the smaller here, which is exactly why the assertion
    // is on line 7 and line 8 rather than only on line 14.
    theDeductibleHalfIsProratedByProfitShareAcrossBusinesses: () => {
        const lines = form7206(taxParams2025)({
            ...noPremiumsNoBusiness,
            medicalDentalVisionPremiumsCents: 400000n,
            planBusinessNetProfitCents: 3000000n,
            allBusinessNetProfitsCents: 10000000n,
            deductiblePartOfSelfEmploymentTaxCents: 706500n,
        })
        assertEq(lines.line6Numerator, 3000000n, 'line 6 numerator is line 4')
        assertEq(lines.line6Denominator, 10000000n, 'and its denominator is line 5')
        assertEq(lines.line7, 211950n, 'line 7 = $2,119.50, three tenths of $7,065.00')
        assert(
            lines.line7 !== 706500n,
            ['the whole deductible half is what the SIMPLE worksheet subtracts', lines.line7])
        assertEq(lines.line8, 2788050n, 'line 8 = $27,880.50')
        assertEq(lines.line14, 400000n, 'line 14 = the $4,000.00 paid')
    },
    // The proration rounds ONCE, half-up, over the exact rational — never a
    // rounded percentage multiplied afterwards. A third of $1,000.01 is
    // 333.336666… cents, which rounds to 333; a line 6 rounded to four
    // decimals (0.3333) and then multiplied gives 333.33 -> 333 here too, so
    // the figure chosen is one where the two DISAGREE: 7/9 of $1,000.00 is
    // 77,777.77… -> 77,778 cents, while 0.7778 x 100,000 = 77,780.
    theProrationRoundsOnceOverTheExactRatioAndNotOverAPrintedPercentage: () => {
        const lines = form7206(taxParams2025)({
            ...noPremiumsNoBusiness,
            planBusinessNetProfitCents: 700000n,
            allBusinessNetProfitsCents: 900000n,
            deductiblePartOfSelfEmploymentTaxCents: 100000n,
        })
        assertEq(lines.line7, 77778n, '$777.78 — half-up from 77,777.77…')
        assert(
            lines.line7 !== 77780n,
            ['a four-decimal printed percentage would have given $777.80', lines.line7])
    },
    // ── Line 2: §213(d)(10)'s per-person caps ───────────────────────────────
    //
    // Every band, one person each, each paying MORE than their cap, so every
    // one of the five figures is the cap itself. Hand-typed from Form 7206
    // line 2(b) rather than read from `taxParamSet`, so a transposed pair in
    // the stored table reddens here as well as in `fjs/tax/params`.
    everyLongTermCareAgeBandCapsAtItsPrintedAmount: () => {
        /** @type {readonly (readonly [LongTermCareAgeBand, bigint])[]} */
        const printed = [
            ['ageFortyOrYounger', 48000n],
            ['ageFortyOneToFifty', 90000n],
            ['ageFiftyOneToSixty', 180000n],
            ['ageSixtyOneToSeventy', 481000n],
            ['ageSeventyOneOrOlder', 602000n],
        ]
        assertEq(printed.length, 5, 'five printed bands, hand-typed')
        for (const [ageBand, cap] of printed) {
            const lines = form7206(taxParams2025)({
                ...noPremiumsNoBusiness,
                longTermCarePersons: [{ ageBand, premiumsCents: 1000000n }],
            })
            assertEq(lines.line2, cap, `band ${ageBand} caps at its printed amount`)
        }
    },
    // THE CONTROL for the leaf above: a person paying LESS than their cap
    // deducts what they paid. Without it, a line 2 that returned the cap
    // unconditionally would pass every assertion above.
    aPersonPayingLessThanTheCapDeductsWhatTheyPaid: () => {
        const lines = form7206(taxParams2025)({
            ...noPremiumsNoBusiness,
            longTermCarePersons: [{ ageBand: 'ageSixtyOneToSeventy', premiumsCents: 120000n }],
        })
        assertEq(lines.line2, 120000n, '$1,200.00 paid against a $4,810.00 cap')
    },
    // **The cap is PER PERSON, and this is the fixture that shows it.** A
    // couple aged 55 and 65, each paying $3,000.00. Per person: $1,800.00 +
    // $3,000.00 = $4,800.00. Capping the SUM at the higher band would give
    // $4,810.00; capping it at the lower would give $1,800.00; and a single
    // uncapped total would give $6,000.00. All three wrong answers are
    // distinct from the right one, which is why this fixture uses two
    // DIFFERENT bands and an amount that binds for exactly one of them.
    twoPeopleInDifferentBandsAreCappedSeparately: () => {
        const lines = form7206(taxParams2025)({
            ...noPremiumsNoBusiness,
            longTermCarePersons: [
                { ageBand: 'ageFiftyOneToSixty', premiumsCents: 300000n },
                { ageBand: 'ageSixtyOneToSeventy', premiumsCents: 300000n },
            ],
        })
        assertEq(lines.line2, 480000n, '$1,800.00 capped + $3,000.00 paid = $4,800.00')
        assert(lines.line2 !== 481000n, ['not one $4,810.00 cap on the sum', lines.line2])
        assert(lines.line2 !== 180000n, ['not one $1,800.00 cap on the sum', lines.line2])
        assert(lines.line2 !== 600000n, ['and not uncapped', lines.line2])
    },
    // TWO people in the SAME band each get their own cap. The other half of
    // the per-person rule, and the half a `Record`-keyed-by-band shape would
    // have made unrepresentable.
    twoPeopleInTheSameBandEachGetTheirOwnCap: () => {
        const lines = form7206(taxParams2025)({
            ...noPremiumsNoBusiness,
            longTermCarePersons: [
                { ageBand: 'ageFiftyOneToSixty', premiumsCents: 300000n },
                { ageBand: 'ageFiftyOneToSixty', premiumsCents: 300000n },
            ],
        })
        assertEq(lines.line2, 360000n, 'two $1,800.00 caps, not one')
    },
    // Line 3 adds lines 1 and 2, and the long-term care half arrives ALREADY
    // capped. A caller that summed premiums before the call would lose the cap
    // entirely, which is why {@link Form7206Input} splits them.
    lineThreeAddsTheUncappedMedicalHalfToTheCappedLongTermCareHalf: () => {
        const lines = form7206(taxParams2025)({
            ...noPremiumsNoBusiness,
            medicalDentalVisionPremiumsCents: 500000n,
            longTermCarePersons: [{ ageBand: 'ageFortyOrYounger', premiumsCents: 200000n }],
            planBusinessNetProfitCents: 9000000n,
            allBusinessNetProfitsCents: 9000000n,
        })
        assertEq(lines.line1, 500000n, 'line 1 is uncapped: $5,000.00 of medical')
        assertEq(lines.line2, 48000n, 'line 2 is capped at $480.00 of the $2,000.00 paid')
        assertEq(lines.line3, 548000n, 'line 3 = $5,480.00')
        assertEq(lines.line14, 548000n, 'and the whole of it is deductible here')
    },
    // ── Line 11 and line 13's "whichever applies" ───────────────────────────
    //
    // Line 4's own instruction — "If the business is an S corporation, skip to
    // line 11" — is what makes line 13 read line 11 instead of line 10. The
    // fixture gives lines 4-10 real figures AND a line 11, so a line 13 that
    // read line 10 would give a different, checkable answer.
    theSCorporationPathTakesLineElevenAndNotLineTen: () => {
        const lines = form7206(taxParams2025)({
            ...noPremiumsNoBusiness,
            medicalDentalVisionPremiumsCents: 1200000n,
            planBusinessNetProfitCents: 800000n,
            allBusinessNetProfitsCents: 800000n,
            deductiblePartOfSelfEmploymentTaxCents: 56520n,
            sCorporationMedicareWagesCents: 4500000n,
        })
        assertEq(lines.line10, 743480n, 'line 10 is still computed: $7,434.80')
        assertEq(lines.line11, 4500000n, 'line 11 = $45,000.00 of Medicare wages')
        assertEq(lines.line13, 4500000n, 'line 13 takes line 11, NOT line 10')
        assertEq(lines.line14, 1200000n, 'so the whole $12,000.00 premium deducts')
        assert(
            lines.line14 !== 743480n,
            ['reading line 10 would have capped it at $7,434.80', lines.line14])
    },
    // Line 12 is a structural zero and stays one — NAMED rather than omitted,
    // so a later phase that models Form 2555 finds the line already present.
    lineTwelveIsTheStructuralFormTwoFiveFiveFiveZero: () => {
        const lines = form7206(taxParams2025)({
            ...noPremiumsNoBusiness,
            medicalDentalVisionPremiumsCents: 100000n,
            planBusinessNetProfitCents: 5000000n,
            allBusinessNetProfitsCents: 5000000n,
        })
        assertEq(lines.line12, 0n, 'foreignEarnedIncomeForm2555 is a refused scope kind')
    },
    // ── The boundaries ──────────────────────────────────────────────────────
    //
    // No business at all: line 5 is zero, the ratio is 0/1 rather than a
    // division by zero, and the deduction is zero. This is the arm
    // `fjs/schedule/1` refuses rather than reports, but the form's own
    // arithmetic must still be total.
    aReturnWithNoBusinessDivergesNowhereAndDeductsNothing: () => {
        const lines = form7206(taxParams2025)({
            ...noPremiumsNoBusiness,
            medicalDentalVisionPremiumsCents: 900000n,
        })
        assertEq(lines.line5, 0n, 'no net profits at all')
        assertEq(lines.line6Denominator, 1n, 'and the ratio is 0/1, not 0/0')
        assertEq(lines.line7, 0n)
        assertEq(lines.line14, 0n, 'no earned income, no deduction')
    },
    // Line 14's floor. A business whose apportioned §164(f) half exceeds its
    // own line 4 makes line 13 negative, and a negative Schedule 1 line 17
    // would ADD to income. Reachable only through the proration, which is a
    // second reason lines 5-7 are implemented rather than assumed to be 1.
    aNegativeCeilingFloorsAtZeroRatherThanAddingToIncome: () => {
        const lines = form7206(taxParams2025)({
            ...noPremiumsNoBusiness,
            medicalDentalVisionPremiumsCents: 500000n,
            planBusinessNetProfitCents: 10000n,
            allBusinessNetProfitsCents: 10000n,
            deductiblePartOfSelfEmploymentTaxCents: 90000n,
        })
        assert(lines.line13 < 0n, ['line 13 must be negative for this leaf to mean anything',
            lines.line13])
        assertEq(lines.line14, 0n, 'line 14 floors at zero')
    },
    // A return that paid nothing deducts nothing even with a large business —
    // the control for every "the ceiling binds" leaf above.
    aProfitableBusinessThatPaidNoPremiumsDeductsNothing: () => {
        const lines = form7206(taxParams2025)({
            ...noPremiumsNoBusiness,
            planBusinessNetProfitCents: 20000000n,
            allBusinessNetProfitsCents: 20000000n,
            deductiblePartOfSelfEmploymentTaxCents: 1400000n,
        })
        assertEq(lines.line3, 0n, 'nothing was paid')
        assert(lines.line13 > 0n, ['and the ceiling is generous', lines.line13])
        assertEq(lines.line14, 0n, 'so line 14 takes line 3')
    },
    throw: {
        // The band vocabulary is CLOSED, and a band with no stored limit is a
        // panic rather than an uncapped premium — the one direction that would
        // overstate the deduction. Unreachable from stored data, because
        // `fjs/schedule/1` pins its tags against the same table; this leaf is
        // what makes the guard itself checkable.
        anUnknownAgeBandPanicsRatherThanDeductingAnUncappedPremium: () => {
            const bands = taxParams2025.longTermCarePremiumLimits.map(limit => limit.band)
            assert(!bands.includes('ageFortyOrYounger') === false, 'sanity: the table is populated')
            form7206(taxParams2025)({
                ...noPremiumsNoBusiness,
                longTermCarePersons: [{
                    // Not a member of the union; the cast is over a string
                    // LITERAL rather than over an indexed access, which is the
                    // carve-out AGENTS.md's "no cast over an indexed access"
                    // rule already names for `/** @type {const} */`.
                    ageBand: /** @type {LongTermCareAgeBand} */ (
                        /** @type {unknown} */ ('ageOneHundredAndTwelve')),
                    premiumsCents: 500000n,
                }],
            })
        },
    },
}
