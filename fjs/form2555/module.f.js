/**
 * Form 2555 — Foreign Earned Income (IRC §911), TAX-42. Parts V, VII and
 * VIII: printed lines 27, 36 through 45.
 *
 * Source, transcribed from the printed PDFs rather than from recall:
 * `f2555.pdf` (2025), Cat. No. 11900P, "Created 5/14/25", Attachment Sequence
 * No. 34; `i2555.pdf` (2025), Cat. No. 11901A, Sep 17 2025. The decision
 * record — which qualifying test is certifiable, which is not, why the
 * housing table is refused, and why the Form 8962 edge is one-way — is
 * `fjs/form2555/todo/foreign-earned-income.md`, and this docstring does not
 * restate it.
 *
 * ## Parts II and III are not here, and only ONE of them could be
 *
 * §911(d)(1) offers two qualifying tests and a filer completes Part II or
 * Part III, never both (i2555 p3). Neither is arithmetic, so neither is in
 * this module; what matters is that they are settled DIFFERENTLY one layer
 * up.
 *
 * - **Physical presence (Part III, §911(d)(1)(B)) is a certification.** *"At
 *   least 330 full days during any period of 12 months in a row. A full day
 *   means the 24-hour period that starts at midnight."* That is a count, and
 *   on any given midnight-to-midnight day a person either was or was not
 *   inside a foreign country. `vnd.fjs.return_profile` carries it as
 *   `physicallyPresentInAForeignCountryThreeHundredThirtyFullDaysAndNoUnitedStatesAbode`,
 *   which is deliberately NARROWER than the statute in its second half: the
 *   §911(d)(3) tax home test turns on where an *abode* is, and i2555 p2 makes
 *   that a weighing of *"family, economic, and personal ties"* — a judgement
 *   an ordinary taxpayer is not competent to make. So the field asks for the
 *   bright line underneath it instead, and a filer who kept a home in the
 *   United States cannot certify and is refused.
 * - **Bona fide residence (Part II, §911(d)(1)(A)) is a REFUSAL.** i2555 p3:
 *   *"Whether you are a bona fide resident of a foreign country depends on
 *   your intention about the length and nature of your stay. Evidence of your
 *   intention may be your words and acts. If these conflict, your acts carry
 *   more weight than your words."* An instruction whose own text says a
 *   taxpayer's words lose to their acts is an instruction that cannot be
 *   turned into a checkbox: a certification IS words. The form asks eight
 *   questions of fact in Part II and never asks *"are you a bona fide
 *   resident?"*, because that is the conclusion the IRS draws from the eight.
 *   `foreignEarnedIncomeBonaFideResidenceTest` refuses by name.
 *
 * ## Line 39 is a RATIO and is never materialised as a rounded decimal
 *
 * Printed line 39: *"divide line 38 by the number of days in your 2025 tax
 * year and enter the result as a decimal (**rounded to at least three
 * places**)."* **"At least" is what licenses exactness** — three places is a
 * floor on precision, not a ceiling — so {@link form2555} carries the exact
 * numerator and denominator and performs ONE half-up rounding at line 40,
 * which is `fjs/form7206` line 6/7's treatment for the reason that module's
 * docstring gives: rounding a ratio and then multiplying is how a cent goes
 * missing.
 *
 * The gap is not hypothetical. At 140 qualifying days the exact product is
 * $130,000 × 140/365 = $49,863.0136…, so line 40 is **$49,863.01**; rounding
 * line 39 to 0.384 first gives **$49,920.00**, which is $56.99 too much.
 *
 * ## Line 36 is a structural zero, and it is NAMED rather than omitted
 *
 * The housing exclusion is Part VI and `foreignHousingExclusionOrDeduction`
 * is a refused `fjs/return/scope` kind, so a return claiming it never reaches
 * this function. It is still an INPUT here, and lines 41 and 43 still read
 * it, which is the discipline `fjs/form7206`'s own line 12 follows for this
 * very form: the arithmetic around a refused figure is written and proven
 * now, so the phase that lifts the refusal finds the lines already present.
 * It is also what makes line 42's floor reachable by a proof at all — see
 * {@link proof.theExclusionCannotGoNegativeWhenHousingExceedsTheIncome}.
 *
 * ## Line 45 is NOT floored, and line 42 is
 *
 * Two subtractions two lines apart, and they are floored differently on
 * purpose.
 *
 * - **Line 42** is *"the smaller of line 40 or line 41"*, and i2555's Purpose
 *   of Form states the governing cap in words: *"You cannot exclude or deduct
 *   more than the amount of your foreign earned income for the year."* An
 *   exclusion below zero would not be an exclusion, so line 42 floors at $0.
 * - **Line 45** is *"Subtract line 44 from line 43"* with no floor printed,
 *   and the printed page means it. Line 44's deductions ARE claimed in full
 *   elsewhere — i2555 p7: *"Report in full on Schedule 1 (Form 1040) and
 *   related forms and schedules all deductions allowed in figuring your
 *   adjusted gross income"* — and line 45 is what nets §911(d)(6) back out of
 *   them. A filer whose allocable deductions exceed their exclusion has a
 *   negative line 45 and a POSITIVE Schedule 1 line 8d, which is the right
 *   answer and not an error. Flooring it would hand that filer a deduction
 *   §911(d)(6) denies.
 *
 * @module
 */
import { of, multiply, halfUp } from '../types/rational/module.f.js'
import { centsFromString } from '../exact/module.f.js'

/** @import { TaxParamSet } from '../tax/params/module.f.js' */

/**
 * Everything Form 2555 Parts V, VII and VIII read, as `bigint` cents and day
 * counts and nothing else — no documents, no profile, no filing status. A
 * form module in this project takes extracted facts and returns per-line
 * records.
 *
 * `qualifyingDaysInTaxYear` is printed line 31/38, and i2555's line 31
 * instruction defines it exactly: *"the number of days in your qualifying
 * period that fall within your 2025 tax year. Your qualifying period is the
 * period during which you meet the tax home test and either the bona fide
 * residence or physical presence test."* It is NOT the 330 full days and NOT
 * the 12-month window of line 16 — a filer abroad continuously from 2023 to
 * 2027 has a full 365 here while their line 16 window is a 12-month slice.
 * The caller is what guarantees `0 <= days <= daysInTaxYear`; a count outside
 * that range is a refusal at the wiring (`fjs/schedule/1`), never a clamp
 * here, because clamping would silently compute a different return than the
 * one the taxpayer described.
 *
 * `housingExclusionCents` is printed line 36 and is structurally zero; see
 * this module's docstring.
 * @typedef {{
 *   readonly foreignEarnedIncomeCents: bigint,
 *   readonly qualifyingDaysInTaxYear: bigint,
 *   readonly housingExclusionCents: bigint,
 *   readonly deductionsAllocableToExcludedIncomeCents: bigint,
 * }} Form2555Input
 */

/**
 * Form 2555's printed lines 27 and 36 through 45. Line 39 is a RATIO and is
 * carried as its exact numerator and denominator rather than a rounded
 * decimal, for the reason this module's docstring gives; a reader checking
 * this against a paper return needs to see the two figures it was divided
 * from, and nothing here multiplies a rounded one.
 * @typedef {{
 *   readonly line27: bigint,
 *   readonly line36: bigint, readonly line37: bigint, readonly line38: bigint,
 *   readonly line39Numerator: bigint, readonly line39Denominator: bigint,
 *   readonly line40: bigint, readonly line41: bigint, readonly line42: bigint,
 *   readonly line43: bigint, readonly line44: bigint, readonly line45: bigint,
 * }} Form2555Lines
 */

/**
 * Form 2555 Parts V, VII and VIII (2025). Pure arithmetic over the facts
 * {@link Form2555Input} carries; it cannot refuse, because every fact whose
 * absence would make the exclusion uncomputable is settled before the call —
 * the qualifying test by a profile certification or a scope refusal, the
 * housing amount by a scope refusal, and the day count by a range check at
 * the wiring.
 * @type {(taxParamSet: TaxParamSet) => (input: Form2555Input) => Form2555Lines}
 */
export const form2555 = taxParamSet => input => {
    const {
        foreignEarnedIncomeCents, qualifyingDaysInTaxYear, housingExclusionCents,
        deductionsAllocableToExcludedIncomeCents,
    } = input
    // 27. "Enter the amount from line 26." Part IV's own total: wages,
    //     allowable shares of business and partnership income, non-cash
    //     income, allowances and reimbursements, less the §119 meals and
    //     lodging line 25 already excludes.
    const line27 = foreignEarnedIncomeCents
    // 36. "Housing exclusion." Structurally zero; see this module's docstring.
    const line36 = housingExclusionCents
    // 37. "Maximum foreign earned income exclusion. Enter $130,000."
    //     §911(b)(2)(D)(i) as adjusted by Rev. Proc. 2024-40 §2.39 — read out
    //     of the stored parameter set, never typed here.
    const line37 = centsFromString(taxParamSet.foreignEarnedIncome.maximumExclusion.amount)
    // 38. "If you completed Part VI, enter the number from line 31. All
    //     others, enter the number of days in your qualifying period that fall
    //     within your 2025 tax year."
    const line38 = qualifyingDaysInTaxYear
    // 39. "If line 38 and the number of days in your 2025 tax year (usually
    //     365) are the same, enter '1.000.' Otherwise, divide line 38 by the
    //     number of days in your 2025 tax year." Carried as the exact ratio;
    //     see this module's docstring. The two printed branches are ONE
    //     expression here because they agree: at equality the ratio IS 1, and
    //     `line39Numerator === line39Denominator` is what a reader checking
    //     the printed "1.000" case looks at.
    const line39Numerator = line38
    const line39Denominator = BigInt(taxParamSet.foreignEarnedIncome.daysInTaxYear)
    // 40. "Multiply line 37 by line 39." ONE half-up rounding over the exact
    //     product, never a rounded ratio multiplied afterwards.
    const line40 = halfUp(multiply(of(line37)(1n))(of(line39Numerator)(line39Denominator)))
    // 41. "Subtract line 36 from line 27."
    const line41 = line27 - line36
    // 42. "Foreign earned income exclusion. Enter the smaller of line 40 or
    //     line 41." Floored at zero; see this module's docstring on why this
    //     line floors and line 45 does not.
    const smaller = line40 < line41 ? line40 : line41
    const line42 = smaller > 0n ? smaller : 0n
    // 43. "Add lines 36 and 42."
    const line43 = line36 + line42
    // 44. "Deductions allowed in figuring your adjusted gross income (Form
    //     1040 or 1040-SR, line 11) that are allocable to the excluded
    //     income." §911(d)(6).
    const line44 = deductionsAllocableToExcludedIncomeCents
    // 45. "Subtract line 44 from line 43. Enter the result here and on
    //     Schedule 1 (Form 1040), line 8d." NOT floored; see this module's
    //     docstring.
    const line45 = line43 - line44
    return {
        line27, line36, line37, line38,
        line39Numerator, line39Denominator,
        line40, line41, line42, line43, line44, line45,
    }
}

// ── Tests ────────────────────────────────────────────────────────────────────

import { assert, assertEq } from 'functionalscript/fjs/asserts/module.f.mjs'
import { taxParamsByYear } from '../tax/params/module.f.js'

/** TY2025's parameter set, narrowed exactly ONCE at module scope. */
const taxParams2025 = taxParamsByYear[2025]
assert(taxParams2025 !== undefined, 'expected TY2025 parameters to be present in taxParamsByYear')

/**
 * A filer with no foreign income at all and no housing claim — the base every
 * fixture below spreads over, so each leaf differs in exactly the field it is
 * about.
 * @type {Form2555Input}
 */
const noForeignIncome = {
    foreignEarnedIncomeCents: 0n,
    qualifyingDaysInTaxYear: 0n,
    housingExclusionCents: 0n,
    deductionsAllocableToExcludedIncomeCents: 0n,
}

export const proof = {
    // ── The two printed figures, hand-typed off the page ────────────────────
    //
    // $130,000 is Form 2555 line 37's own printed text ("Maximum foreign
    // earned income exclusion. Enter $130,000") and Rev. Proc. 2024-40 §2.39
    // ("the foreign earned income exclusion amount under § 911(b)(2)(D)(i) is
    // $130,000"). 365 is Form 2555 line 39's own "(usually 365)".
    //
    // Hand-typed here rather than read back off the parameter set, which is
    // the whole of AGENTS.md's rule about an expected value produced by the
    // code under test: `line37 === centsFromString(params...)` would be the
    // parameter set compared against itself.
    lineThirtySevenIsThePrintedMaximumExclusion: () => {
        const lines = form2555(taxParams2025)(noForeignIncome)
        assertEq(lines.line37, 13000000n, 'Form 2555 line 37 prints $130,000')
    },
    lineThirtyNineDenominatorIsThePrintedDayCount: () => {
        const lines = form2555(taxParams2025)(noForeignIncome)
        assertEq(lines.line39Denominator, 365n, 'Form 2555 line 39 prints "(usually 365)" for 2025')
    },
    // ── The full-year qualifier ─────────────────────────────────────────────
    //
    // 365 qualifying days, $200,000 of foreign earned income. Line 39 is the
    // printed "1.000" case, so line 40 is the whole $130,000 and line 41's
    // $200,000 does not bind. Every figure hand-typed.
    aFullYearQualifierExcludesTheWholeMaximum: () => {
        const lines = form2555(taxParams2025)({
            ...noForeignIncome,
            foreignEarnedIncomeCents: 20000000n,
            qualifyingDaysInTaxYear: 365n,
        })
        assertEq(lines.line27, 20000000n, '$200,000.00 of foreign earned income')
        assertEq(lines.line39Numerator, 365n)
        assertEq(lines.line39Denominator, 365n)
        assert(
            lines.line39Numerator === lines.line39Denominator,
            ['this is the printed "enter 1.000" case', lines.line39Numerator])
        assertEq(lines.line40, 13000000n, '$130,000.00 × 1 = $130,000.00')
        assertEq(lines.line41, 20000000n, '$200,000.00 − $0.00 of housing exclusion')
        assertEq(lines.line42, 13000000n, 'the smaller of $130,000.00 and $200,000.00')
        assertEq(lines.line43, 13000000n)
        assertEq(lines.line45, 13000000n, 'and the whole of it reaches Schedule 1 line 8d')
    },
    // The OTHER binding on line 42: a full-year qualifier earning LESS than
    // the maximum excludes only what they earned. i2555's Purpose of Form:
    // "You cannot exclude or deduct more than the amount of your foreign
    // earned income for the year."
    aFullYearQualifierEarningLessThanTheMaximumExcludesOnlyWhatTheyEarned: () => {
        const lines = form2555(taxParams2025)({
            ...noForeignIncome,
            foreignEarnedIncomeCents: 8000000n,
            qualifyingDaysInTaxYear: 365n,
        })
        assertEq(lines.line40, 13000000n, 'line 40 is still the whole $130,000.00')
        assertEq(lines.line41, 8000000n, '$80,000.00 earned')
        assertEq(lines.line42, 8000000n, 'and line 42 takes the SMALLER of the two')
        assert(lines.line42 !== 13000000n, ['line 41 must bind here', lines.line42])
    },
    // ── The partial-year qualifier ──────────────────────────────────────────
    //
    // i2555's own line 31 example, priced: a tax home and residence
    // established August 14, 2025 and held past year end gives 140 qualifying
    // days. $130,000 × 140/365 = $49,863.013698…, so line 40 is $49,863.01.
    //
    // **The hand-typed expectation is the arithmetic, not the code's.**
    // 13,000,000 ¢ × 140 = 1,820,000,000 ¢; ÷ 365 = 4,986,301.3698… ¢; half-up
    // = 4,986,301 ¢ = $49,863.01.
    aPartialYearQualifierProratesByQualifyingDays: () => {
        const lines = form2555(taxParams2025)({
            ...noForeignIncome,
            foreignEarnedIncomeCents: 15000000n,
            qualifyingDaysInTaxYear: 140n,
        })
        assertEq(lines.line38, 140n, "i2555's own line 31 example: August 14 through December 31")
        assertEq(lines.line39Numerator, 140n)
        assertEq(lines.line39Denominator, 365n)
        assertEq(lines.line40, 4986301n, '$130,000.00 × 140/365 = $49,863.01')
        assertEq(lines.line42, 4986301n, 'line 41 is $150,000.00 and does not bind')
        assertEq(lines.line45, 4986301n)
    },
    // **The rounded-decimal answer is a DIFFERENT number, and this is the leaf
    // that says so.** Line 39 printed "to at least three places" is 0.384, and
    // $130,000 × 0.384 = $49,920.00 — $56.99 more than the exact product. A
    // fixture whose ratio divided evenly could not tell the two apart, which
    // is exactly the monoculture AGENTS.md records a rounding mutation
    // surviving behind.
    theExactRatioAndTheThreeDecimalRatioDisagree: () => {
        const lines = form2555(taxParams2025)({
            ...noForeignIncome,
            foreignEarnedIncomeCents: 15000000n,
            qualifyingDaysInTaxYear: 140n,
        })
        assert(lines.line40 !== 4992000n, ['not $130,000.00 × 0.384', lines.line40])
        assertEq(lines.line40 - 4992000n, -5699n, 'the two differ by exactly $56.99')
    },
    // A day count whose ratio does NOT divide evenly in the other direction —
    // half-up rounds UP here where the 140-day case rounds DOWN. 13,000,000 ¢
    // × 100 = 1,300,000,000 ¢; ÷ 365 = 3,561,643.8356… ¢; half-up = 3,561,644 ¢
    // = $35,616.44. Truncation would give $35,616.43.
    aProrationThatRoundsUpRatherThanDown: () => {
        const lines = form2555(taxParams2025)({
            ...noForeignIncome,
            foreignEarnedIncomeCents: 15000000n,
            qualifyingDaysInTaxYear: 100n,
        })
        assertEq(lines.line40, 3561644n, '$130,000.00 × 100/365 = $35,616.44, rounded UP')
        assert(lines.line40 !== 3561643n, ['truncation would give $35,616.43', lines.line40])
    },
    // One qualifying day. 13,000,000 ¢ ÷ 365 = 35,616.4383… ¢, half-up
    // 35,616 ¢ = $356.16. The smallest non-zero proration there is, and the
    // one a `days === 0` short-circuit would swallow.
    oneQualifyingDayProratesToOneDayOfExclusion: () => {
        const lines = form2555(taxParams2025)({
            ...noForeignIncome,
            foreignEarnedIncomeCents: 15000000n,
            qualifyingDaysInTaxYear: 1n,
        })
        assertEq(lines.line40, 35616n, '$130,000.00 × 1/365 = $356.16')
    },
    // THE CONTROL for every proration leaf above: zero qualifying days
    // excludes nothing, even from a large foreign income. Without it, a line
    // 40 that returned the whole $130,000 unconditionally would pass the
    // full-year leaf and the ratio would be decoration.
    zeroQualifyingDaysExcludesNothing: () => {
        const lines = form2555(taxParams2025)({
            ...noForeignIncome,
            foreignEarnedIncomeCents: 20000000n,
            qualifyingDaysInTaxYear: 0n,
        })
        assertEq(lines.line40, 0n, 'no qualifying period, no exclusion')
        assertEq(lines.line42, 0n)
        assertEq(lines.line45, 0n, 'and nothing reaches Schedule 1 line 8d')
    },
    // ── Line 44, §911(d)(6) ─────────────────────────────────────────────────
    //
    // "Deductions allowed in figuring your adjusted gross income that are
    // allocable to the excluded income." $130,000 excluded less $4,000
    // allocable = $126,000 on Schedule 1 line 8d.
    deductionsAllocableToTheExcludedIncomeReduceLineFortyFive: () => {
        const lines = form2555(taxParams2025)({
            ...noForeignIncome,
            foreignEarnedIncomeCents: 20000000n,
            qualifyingDaysInTaxYear: 365n,
            deductionsAllocableToExcludedIncomeCents: 400000n,
        })
        assertEq(lines.line43, 13000000n, 'line 43 is the exclusion before §911(d)(6)')
        assertEq(lines.line44, 400000n, '$4,000.00 allocable')
        assertEq(lines.line45, 12600000n, '$130,000.00 − $4,000.00 = $126,000.00')
        assert(lines.line45 !== 13000000n, ['line 44 must bite', lines.line45])
    },
    // **Line 45 is NOT floored**, and this is the leaf that pins it. Allocable
    // deductions larger than the exclusion give a NEGATIVE line 45 and a
    // POSITIVE Schedule 1 line 8d, which is §911(d)(6) working rather than an
    // error; see this module's docstring.
    lineFortyFiveGoesNegativeWhenAllocableDeductionsExceedTheExclusion: () => {
        const lines = form2555(taxParams2025)({
            ...noForeignIncome,
            foreignEarnedIncomeCents: 500000n,
            qualifyingDaysInTaxYear: 365n,
            deductionsAllocableToExcludedIncomeCents: 800000n,
        })
        assertEq(lines.line42, 500000n, '$5,000.00 earned caps the exclusion')
        assertEq(lines.line45, -300000n, '$5,000.00 − $8,000.00 = −$3,000.00')
    },
    // ── Line 36, the structural zero, and line 42's floor ───────────────────
    //
    // Line 36 is refused upstream and is zero on every return this engine
    // computes — NAMED rather than omitted, so the phase that models Part VI
    // finds lines 41 and 43 already reading it.
    lineThirtySixIsTheStructuralHousingExclusionZero: () => {
        const lines = form2555(taxParams2025)({
            ...noForeignIncome,
            foreignEarnedIncomeCents: 20000000n,
            qualifyingDaysInTaxYear: 365n,
        })
        assertEq(lines.line36, 0n, 'foreignHousingExclusionOrDeduction is a refused scope kind')
        assertEq(lines.line41, lines.line27, 'so line 41 is line 27 untouched')
        assertEq(lines.line43, lines.line42, 'and line 43 is line 42 untouched')
    },
    // Lines 41 and 43 genuinely READ line 36 rather than ignoring it. The only
    // way to show that while the housing exclusion is refused is to hand this
    // function a non-zero line 36 directly, which is the second reason it is
    // an input rather than a local `0n`.
    linesFortyOneAndFortyThreeReadLineThirtySix: () => {
        const lines = form2555(taxParams2025)({
            ...noForeignIncome,
            foreignEarnedIncomeCents: 20000000n,
            qualifyingDaysInTaxYear: 365n,
            housingExclusionCents: 3000000n,
        })
        assertEq(lines.line41, 17000000n, '$200,000.00 − $30,000.00 of housing exclusion')
        assertEq(lines.line42, 13000000n, 'line 40 still binds')
        assertEq(lines.line43, 16000000n, '$30,000.00 + $130,000.00')
        assert(lines.line43 !== 13000000n, ['line 43 must add line 36', lines.line43])
    },
    // **Line 42's floor**, reachable only through line 36 — a housing
    // exclusion larger than the foreign earned income makes line 41 negative,
    // and an exclusion below zero would not be an exclusion.
    theExclusionCannotGoNegativeWhenHousingExceedsTheIncome: () => {
        const lines = form2555(taxParams2025)({
            ...noForeignIncome,
            foreignEarnedIncomeCents: 1000000n,
            qualifyingDaysInTaxYear: 365n,
            housingExclusionCents: 2500000n,
        })
        assertEq(lines.line41, -1500000n, '$10,000.00 − $25,000.00 = −$15,000.00')
        assertEq(lines.line42, 0n, 'and the exclusion floors at $0.00, never at −$15,000.00')
    },
}
