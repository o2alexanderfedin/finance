/**
 * §55(b)(1)(A)'s two-bracket alternative-minimum-tax rate schedule — the
 * 26%/28% computation Form 6251 prints **three times**, on lines 7, 18 and 39.
 *
 * Source, fetched and read directly (2026-08-17), not from recall:
 * `https://www.irs.gov/pub/irs-pdf/f6251.pdf`, the 2025 form, both pages. The
 * three printed occurrences are word for word identical apart from which line
 * they read:
 *
 * > *"If line {6,17,12} is $239,100 or less ($119,550 or less if married filing
 * > separately), multiply line {6,17,12} by 26% (0.26). Otherwise, multiply
 * > line {6,17,12} by 28% (0.28) and subtract $4,782 ($2,391 if married filing
 * > separately) from the result."*
 *
 * ## Why this is a module and not three inline copies
 *
 * AGENTS.md, "One rule, one place": *"If a check appears in both a production
 * path and a test helper, the proofs will bind to whichever the tests call, and
 * the other can rot silently."* Three copies of a two-bracket schedule is the
 * same hazard with three ways to rot. Phase 29 had exactly one occurrence and
 * wrote it inline inside `fjs/form6251`'s `form6251`; TAX-33's Part III adds
 * the other two, and the moment there is more than one the rule moves here.
 *
 * It lives in its own directory rather than in `fjs/form6251/part3` because
 * line 7 is a **Part II** line: a Part II line reaching into the Part III
 * module for its own rate schedule would invert the dependency, and
 * `fjs/form6251` importing `fjs/form6251/part3` (which it does, for lines
 * 12-40) would then be a cycle.
 *
 * ## Written as the schedule it is, not as the printed shortcut
 *
 * The page states the upper bracket as *"28% of the whole, less $4,782"*; this
 * module states it as *"26% of the first $239,100 plus 28% of the excess"*. The
 * two are algebraically identical because the subtracted constant is exactly
 * the threshold times the two-point rate difference ($239,100 x 0.02 = $4,782;
 * $119,550 x 0.02 = $2,391), and `fjs/form6251`'s own
 * `theTwentySixTwentyEightScheduleMatchesThePrintedShortcut` hand-types both
 * constants and proves the agreement at the breakpoint, one cent above it and
 * far above it, on every filing status.
 *
 * The schedule form is preferred because it rounds **once**, on the combined
 * exact rational, so the two statements agree to the cent rather than nearly —
 * and because it cannot produce the negative figure the shortcut produces for a
 * line 12 between zero and the point where 28% overtakes the constant.
 *
 * Every dollar figure is a `fjs/tax/params` lookup with its own citation there
 * (Rev. Proc. 2024-40 §2.11); the two RATES are the ones the printed line
 * prints, and they are parameters too, because §55(b)(1)(A)'s rates are
 * statutory rather than annually adjusted and the parameter set already carries
 * them.
 *
 * @module
 */
import { of, halfUp } from '../../types/rational/module.f.js'
import { centsFromString } from '../../exact/module.f.js'

/** @import { IndividualFilingStatus, TaxParamSet } from '../../tax/params/module.f.js' */

/** The larger of two cents figures. @type {(a: bigint) => (b: bigint) => bigint} */
const max = a => b => a > b ? a : b

/** The smaller of two cents figures. @type {(a: bigint) => (b: bigint) => bigint} */
const min = a => b => a < b ? a : b

/**
 * The 26%/28% tax on one amount of cents, for one filing status.
 *
 * The breakpoint is **halved for married filing separately** and for that
 * status alone — `upperRateThreshold`'s own row, never a division here, so the
 * halving is a stored fact with a citation rather than arithmetic this module
 * performs on another status's figure.
 * @type {(taxParamSet: TaxParamSet) => (status: IndividualFilingStatus) => (amountCents: bigint) => bigint}
 */
export const twentySixTwentyEightPercentTax = taxParamSet => status => amountCents => {
    const { alternativeMinimumTax } = taxParamSet
    const upperRateThresholdCents = centsFromString(
        alternativeMinimumTax.upperRateThreshold[status].amount)
    const atLowerRate = min(amountCents)(upperRateThresholdCents)
    const atUpperRate = max(amountCents - upperRateThresholdCents)(0n)
    return halfUp(of(
        BigInt(alternativeMinimumTax.lowerRatePercent) * atLowerRate
        + BigInt(alternativeMinimumTax.upperRatePercent) * atUpperRate)(100n))
}
