/**
 * Form 8995-A (TY2025) — TAX-32: *Qualified Business Income Deduction*, the
 * form that applies ABOVE §199A(e)(2)'s threshold, where `fjs/form8995`'s
 * simplified computation does not. Phase 31 finishes what Phase 28 refused.
 *
 * Source, transcribed from two pages fetched from `irs.gov` on 2026-08-17 and
 * read line by line — never from recall, and one previous pass had two things
 * wrong from memory that the pages corrected:
 *
 * - `f8995a.pdf`, all forty printed lines: Part I (trade/business information),
 *   Part II (adjusted qualified business income, lines 2-16), Part III (the
 *   phased-in reduction, lines 17-26) and Part IV (the deduction, lines 27-40).
 * - `f8995aa.pdf`, Schedule A (Form 8995-A), *Specified Service Trades or
 *   Businesses*, Part I lines 1a-13.
 *
 * ## The two reductions live in DIFFERENT places, which is the trap
 *
 * Read from memory, §199A sounds like one phase-in. The printed pages put the
 * two halves in two different forms, and neither is where a summary suggests:
 *
 * | Reduction | Where it lives | Gate |
 * |---|---|---|
 * | the **SSTB** applicable percentage | **Schedule A**, lines 5-13 | trade or business is an SSTB, and taxable income is above the threshold |
 * | the **W-2-wage/UBIA** limitation, phased in | **Part III**, lines 17-26 | taxable income above the threshold but not above threshold+range, **AND printed line 10 < printed line 3** |
 *
 * **Part II has no applicable-percentage line at all** — lines 2 through 16 run
 * QBI, 20%, wages, UBIA, the two limbs, the cap and the patron reduction, and
 * nowhere among them is a percentage of anything. Schedule A does that work
 * FIRST and feeds its results back in: its line 11 becomes Part II line 2, its
 * line 12 becomes line 4, its line 13 becomes line 7. The printed Note on page
 * 1 says so — *"Complete Schedules A, B, and/or C (Form 8995-A), as applicable,
 * BEFORE starting Part I."*
 *
 * And **Part III phases in the wage/UBIA limitation, not the SSTB reduction.**
 * Its own line 19 is `line 3 − line 10` — the amount by which the cap cuts into
 * the 20% — and line 25 applies the phase-in percentage to THAT. An SSTB inside
 * the range is therefore reduced TWICE, once on Schedule A and once here, and
 * {@link proof} prices that case rather than describing it.
 *
 * ## Printed line 3 short-circuits, so this form and Form 8995 must AGREE
 *
 * Line 3 reads: *"Multiply line 2 by 20% (0.20). If your taxable income is
 * $197,300 or less ($394,600 if married filing jointly), skip lines 4 through 12
 * and enter the amount from line 3 on line 13."* Every limitation on this page
 * is inside the lines that sentence skips.
 *
 * So below the threshold Form 8995-A degenerates into Form 8995, and that is not
 * a remark — it is an ASSERTION this module makes at four separate taxable
 * incomes, to the cent, including one cent below the threshold and at the
 * threshold exactly ({@link proof}'s `belowTheThresholdBothFormsAgree`). Two
 * transcriptions of one statute that disagree anywhere in their overlap mean one
 * of them is wrong, and the overlap is where a reader can actually check.
 *
 * ## The two limbs of §199A(b)(2)(B), kept SEPARATELY OBSERVABLE
 *
 * Printed lines 5 and 9 are the two limbs of the cap, and printed line 10 is
 * *"the greater of line 5 or line 9"*:
 *
 * - **line 5** — 50% of W-2 wages. §199A(b)(2)(B)(i).
 * - **line 9** — 25% of W-2 wages plus 2.5% of UBIA. §199A(b)(2)(B)(ii), the
 *   sum of printed lines 6 and 8.
 *
 * Phase 28's subtlest surviving mutation was a value nothing could observe
 * because one limb of a `min` won in every fixture, and it survived even after
 * two fixtures were added for it. So both limbs are **named printed fields of
 * the returned record**, never inlined into the comparison, and each has a
 * fixture where it BINDS and a perturbation that proves it:
 *
 * | Fixture | line 5 | line 9 | line 10 is | perturbation |
 * |---|---|---|---|---|
 * | `theUbiaLimbBindsForAProprietorWithNoEmployees` | $0.00 | $25,000.00 | line 9 | zeroing UBIA drops the deduction to $0.00 |
 * | `theWageLimbBindsWhenWagesAreLargeRelativeToUbia` | $40,000.00 | $32,500.00 | line 5 | moving UBIA does NOT move the answer; moving wages does |
 *
 * **A sole proprietor with no employees has no W-2 wages**, so the first row is
 * the common case, not the exotic one: the wage limb is zero and UBIA is the
 * whole cap. The perturbation is what keeps that fixture from being right for
 * the wrong reason — an implementation that ignored UBIA entirely would also
 * produce a wage limb of zero.
 *
 * ## The applicable percentage is applied as an EXACT ratio, not as a rounded
 * percentage
 *
 * Schedule A line 9 divides line 7 by line 8, and line 10 subtracts that from
 * 100%. The printed form has a `%` box, so a paper filer writes a rounded
 * figure and multiplies by it. **This module does not.** `line9` and `line10`
 * are reported in basis points for the record, but lines 11-13 multiply by the
 * exact rational `(range − excess) / range` — because a percentage rounded to
 * even four decimal places, multiplied by a million-dollar UBIA, drifts by
 * dollars, and this project's money is exact integer cents. The same choice
 * Part III's line 24 gets, for the same reason.
 *
 * `theApplicablePercentageIsNotRoundTrippedThroughItsOwnPrintedBox` is the leaf
 * that states it, with the arithmetic of a case where the two differ.
 *
 * ## What refuses, and what deliberately does not
 *
 * - **The three asserted facts.** `specifiedServiceTradeOrBusiness`, `w2Wages`
 *   and `unadjustedBasisOfQualifiedProperty` on `vnd.fjs.business_expenses`.
 *   {@link formEightNineNineFiveAInputsAreUnstated} refuses BY NAME when one is
 *   missing — and **only where the answer depends on it**: above the threshold,
 *   with qualified business income to deduct. Below the threshold printed line 3
 *   skips every line that reads them, so a Phase 28 return computes exactly what
 *   it computed before, and a return with no business is untouched entirely.
 * - **Lines 28-31 (REIT dividends and PTP income)** carry the REIT half and
 *   only the REIT half, exactly as Form 8995's lines 6-9 do and for the
 *   identical reasons — see that module's docstring. Line 28 is Form 1099-DIV
 *   box 5 (§199A dividends); the PTP half is refused by `fjs/schedule/e`'s
 *   `section199AInformationRefusal` on Schedule K-1 box 20 code Z / box 17
 *   code V, and line 29 is a structural zero because a PTP LOSS is the only
 *   thing that could carry into it.
 *
 *   **This component bypasses everything above it on this page**, which is the
 *   whole reason it must be wired on BOTH forms rather than only on the
 *   simplified one: §199A(b)(2)(B)'s wage/UBIA cap and §199A(d)(3)'s
 *   specified-service phase-out reduce lines 2-16 and never touch line 28. A
 *   consultant above the phase-in range is allowed NOTHING for their business
 *   and still gets 20% of their REIT dividends. A deduction that appeared on
 *   Form 8995 and vanished on Form 8995-A would be a defect the taxpayer could
 *   only discover by crossing the threshold.
 * - **Line 14 (patron reduction, from Schedule D) and line 38 (the §199A(g)
 *   DPAD)** are structural zeros. Both belong to patrons of agricultural or
 *   horticultural cooperatives, and this engine reads no Form 1099-PATR.
 * - **Lines 12/26 for a SECOND business, and Schedule B's aggregation.** This
 *   engine computes ONE Schedule C — `fjs/schedule/c` refuses a second business
 *   by name — so exactly one printed column (A) can ever be filled, and
 *   Schedule B (aggregation of two or more) cannot arise.
 *
 * @module
 */
import { assert, assertEq } from 'functionalscript/fjs/asserts/module.f.js'
import { of, multiply, halfUp } from '../types/rational/module.f.js'
import { centsFromString } from '../exact/module.f.js'
import { taxParamsByYear } from '../tax/params/module.f.js'
import {
    qualifiedBusinessIncome, priorYearCarryforwardIsUnstated,
    qualifiedBusinessIncomeDeduction as simplifiedComputation,
} from '../form8995/module.f.js'

/** @import { TaxParamSet, IndividualFilingStatus } from '../tax/params/module.f.js' */
/** @import { Form8995 } from '../form8995/module.f.js' */

/**
 * A case this module will not compute — the same shape `fjs/form8995`,
 * `fjs/schedule/c` and `fjs/schedule/se` already return, so
 * `fjs/form1040/core` threads it through the error arm it already has.
 * @typedef {{ readonly kind: 'error', readonly message: string }} Form8995ARefusal
 */

// ── The statutory percentages, which are NOT in `fjs/tax/params` ─────────────

/**
 * §199A(b)(2)(B)(i)'s **50 percent of W-2 wages**, printed line 5, in basis
 * points.
 *
 * These three factors are named here rather than stored in `fjs/tax/params`,
 * following that module's own precedent for Schedule SE's 92.35%: a proof there
 * asserts outright that the factor *"is derived in `fjs/schedule/se`, never
 * stored here"*. The rule the two cases share is that `fjs/tax/params` holds
 * figures an annual Revenue Procedure MOVES — the threshold does, the
 * {@link ../tax/params/module.f.js phaseInRange} is stored beside it because it
 * is a dollar amount §199A states — while a percentage written into the operative
 * subparagraph and never indexed belongs at the transcription of the line that
 * multiplies by it. {@link proof}'s `theStatutoryPercentagesAreThePrintedOnes`
 * pins all three against the printed page.
 *
 * Basis points rather than percent because 2.5% is not a whole number of them,
 * and one denominator for all three keeps the three lines diffable against the
 * page.
 */
const wagesOnlyLimbBasisPoints = 5000n
/** §199A(b)(2)(B)(ii)'s **25 percent of W-2 wages**, printed line 6. */
const wagesShareOfUbiaLimbBasisPoints = 2500n
/**
 * §199A(b)(2)(B)(ii)'s **2.5 percent of the unadjusted basis immediately after
 * acquisition of qualified property**, printed line 8 (*"Multiply line 7 by
 * 2.5% (0.025)"*).
 */
const ubiaShareOfUbiaLimbBasisPoints = 250n

/**
 * Rounds `cents * (basisPoints / 10000)` to the nearest cent, ties away from
 * zero — printed lines 5, 6 and 8.
 * @type {(cents: bigint) => (basisPoints: bigint) => bigint}
 */
const basisPointsOfCents = cents => basisPoints =>
    halfUp(multiply(of(cents)(1n))(of(basisPoints)(10000n)))

/**
 * Rounds `cents * (percent / 100)` to the nearest cent, ties away from zero —
 * printed lines 3, 31 and 36, all three of which multiply by §199A's ONE 20%.
 * The identical expression `fjs/form8995` uses for its lines 5, 9 and 14, and
 * reimplemented here for the same reason it is reimplemented there.
 * @type {(cents: bigint) => (percent: bigint) => bigint}
 */
const percentOfCents = cents => percent =>
    halfUp(multiply(of(cents)(1n))(of(percent)(100n)))

/**
 * Rounds `cents * (numerator / denominator)` to the nearest cent, ties away from
 * zero — Schedule A lines 11-13 and Part III line 25, the four lines that
 * multiply by a phase-in ratio.
 *
 * **The ratio is passed exact**, never as a rounded percentage. See this
 * module's docstring.
 * @type {(cents: bigint) => (numerator: bigint) => (denominator: bigint) => bigint}
 */
const ratioOfCents = cents => numerator => denominator =>
    halfUp(multiply(of(cents)(1n))(of(numerator)(denominator)))

/** Ten thousand basis points is one whole — 100%, Schedule A line 10's box. */
const wholeInBasisPoints = 10000n

// ── The phase-in position, which BOTH reductions read ────────────────────────

/**
 * Where a return sits in §199A's phase-in range, computed once and read by
 * Schedule A and by Part III alike — the two reductions share this arithmetic
 * and nothing else, and computing it twice is how the two would drift.
 *
 * `excessCents` is Schedule A line 7 and Part III line 22 (both *"subtract the
 * threshold from taxable income"*). `rangeCents` is Schedule A line 8 and Part
 * III line 23, the stored §199A(b)(3)(B)(ii) figure.
 *
 * `applicableNumerator` is `range − excess` FLOORED AT ZERO, and the floor is
 * where Schedule A's own header sentence lives: *"If your taxable income is more
 * than $247,300 ($494,600 if married filing jointly), your specified service
 * trade or business doesn't qualify for the deduction."* Above the range the
 * numerator would go negative, and zero is what "doesn't qualify" means in
 * arithmetic. One floor, one sentence, no separate branch.
 * @typedef {{
 *   readonly thresholdCents: bigint,
 *   readonly rangeCents: bigint,
 *   readonly excessCents: bigint,
 *   readonly applicableNumerator: bigint,
 *   readonly aboveThreshold: boolean,
 *   readonly withinPhaseInRange: boolean,
 * }} PhaseInPosition
 */

/**
 * Reads §199A(e)(2)'s threshold and §199A(b)(3)(B)(ii)'s range for one filing
 * status and locates one return between them.
 *
 * `aboveThreshold` is a STRICT comparison, matching printed line 3's *"$197,300
 * or less … skip lines 4 through 12"*: at the threshold exactly the simplified
 * computation still applies, which is the same *"at or below"* boundary
 * `fjs/form8995` already draws. `withinPhaseInRange` is Part III's own
 * condition, *"more than $197,300 but not $247,300"* — strict below, inclusive
 * above.
 * @type {(taxParamSet: TaxParamSet) => (status: IndividualFilingStatus) => (taxableIncomeBeforeQbiCents: bigint) => PhaseInPosition}
 */
export const phaseInPosition = taxParamSet => status => taxableIncomeBeforeQbiCents => {
    const { thresholdAmount, phaseInRange } = taxParamSet.qualifiedBusinessIncomeDeduction
    const thresholdCents = centsFromString(thresholdAmount[status].amount)
    const rangeCents = centsFromString(phaseInRange[status].amount)
    const excessBeforeFloor = taxableIncomeBeforeQbiCents - thresholdCents
    const excessCents = excessBeforeFloor > 0n ? excessBeforeFloor : 0n
    const remaining = rangeCents - excessCents
    return {
        thresholdCents,
        rangeCents,
        excessCents,
        applicableNumerator: remaining > 0n ? remaining : 0n,
        aboveThreshold: taxableIncomeBeforeQbiCents > thresholdCents,
        withinPhaseInRange: taxableIncomeBeforeQbiCents > thresholdCents
            && taxableIncomeBeforeQbiCents <= thresholdCents + rangeCents,
    }
}

// ── Schedule A (Form 8995-A): Specified Service Trades or Businesses ─────────

/**
 * Schedule A (Form 8995-A) Part I, printed lines 2-13. Lines 1a and 1b are the
 * trade or business's name and taxpayer identification number — prose, not
 * money, and Part I of Form 8995-A carries the same two.
 *
 * `line9`/`line10` are BASIS POINTS (the printed `%` boxes); every other field
 * is cents. Part II of the printed schedule — lines 14-24, a publicly traded
 * partnership's own SSTB income — has no field here: PTP income needs a
 * Schedule K-1 this engine does not read, and `qualifiedReitDividendsAndPtpIncome`
 * refuses for it by name.
 * @typedef {{
 *   readonly line2: bigint, readonly line3: bigint, readonly line4: bigint,
 *   readonly line5: bigint, readonly line6: bigint, readonly line7: bigint,
 *   readonly line8: bigint, readonly line9: bigint, readonly line10: bigint,
 *   readonly line11: bigint, readonly line12: bigint, readonly line13: bigint,
 * }} ScheduleA
 */

/**
 * Fills in Schedule A for one specified service trade or business. Every `const`
 * is one printed line, in printed order, with the printed instruction quoted.
 *
 * **All THREE inputs are scaled**, which is the half of this schedule a summary
 * omits: not only qualified business income (line 11) but the W-2 wages
 * (line 12) and the UBIA (line 13) are multiplied by the applicable percentage,
 * and it is those reduced figures that Form 8995-A's lines 2, 4 and 7 receive.
 * Scaling only the income would leave an SSTB with the FULL wage/UBIA cap
 * against a reduced 20%, and the cap would stop biting exactly where §199A(d)(3)
 * intends it to bite hardest.
 * @type {(position: PhaseInPosition) => (input: { readonly qualifiedBusinessIncomeCents: bigint, readonly w2WagesCents: bigint, readonly unadjustedBasisCents: bigint, readonly taxableIncomeBeforeQbiCents: bigint }) => ScheduleA}
 */
export const scheduleA = position => input => {
    const {
        qualifiedBusinessIncomeCents, w2WagesCents, unadjustedBasisCents,
        taxableIncomeBeforeQbiCents,
    } = input
    const { thresholdCents, rangeCents, excessCents, applicableNumerator } = position
    // 2. "Qualified business income or (loss) from the trade or business."
    const line2 = qualifiedBusinessIncomeCents
    // 3. "Allocable share of W-2 wages from the trade or business."
    const line3 = w2WagesCents
    // 4. "Allocable share of the unadjusted basis immediately after acquisition
    //    (UBIA) of all qualified property."
    const line4 = unadjustedBasisCents
    // 5. "Taxable income before qualified business income deduction."
    const line5 = taxableIncomeBeforeQbiCents
    // 6. "Threshold. Enter $197,300 ($394,600 if married filing jointly)."
    const line6 = thresholdCents
    // 7. "Subtract line 6 from line 5." Floored in `phaseInPosition`, which is
    //    also where the floor is argued: this schedule is only filed above the
    //    threshold, so a negative line 7 cannot arise on paper.
    const line7 = excessCents
    // 8. "Phase-in range. Enter $50,000 ($100,000 if married filing jointly)."
    //    §199A(b)(3)(B)(ii)'s figure, STORED in `fjs/tax/params` and never
    //    derived from line 6 -- 25% of $197,300 is $49,325, and that $675
    //    difference is the whole argument.
    const line8 = rangeCents
    // 9. "Divide line 7 by line 8." Reported in basis points; the arithmetic
    //    below does NOT read it back. See this module's docstring.
    const line9 = wholeInBasisPoints - ratioOfCents(wholeInBasisPoints)(applicableNumerator)(rangeCents)
    // 10. "Applicable percentage. Subtract line 9 from 100%."
    const line10 = ratioOfCents(wholeInBasisPoints)(applicableNumerator)(rangeCents)
    // 11. "Applicable percentage of qualified business income or (loss).
    //     Multiply line 2 by line 10." -> Form 8995-A line 2.
    const line11 = ratioOfCents(line2)(applicableNumerator)(rangeCents)
    // 12. "Applicable percentage of W-2 wages. Multiply line 3 by line 10."
    //     -> Form 8995-A line 4.
    const line12 = ratioOfCents(line3)(applicableNumerator)(rangeCents)
    // 13. "Applicable percentage of the UBIA of qualified property. Multiply
    //     line 4 by line 10." -> Form 8995-A line 7.
    const line13 = ratioOfCents(line4)(applicableNumerator)(rangeCents)
    return { line2, line3, line4, line5, line6, line7, line8, line9, line10, line11, line12, line13 }
}

// ── The refusal ──────────────────────────────────────────────────────────────

/**
 * **The three facts Form 8995-A reads and nothing else can supply.** Refuses by
 * name, listing exactly the ones that are missing.
 *
 * `vnd.fjs.business_expenses` carries all three as assertions (Phase 31), and
 * absence is *unstated* rather than a default in either direction — that
 * dialect's own header argues why an SSTB flag cannot be a checkbox and why
 * `'0.00'` wages is a real assertion rather than a synonym for absence.
 *
 * **The gate is narrow on purpose**, and it is what keeps criterion "a return
 * with no business income computes exactly what it computes today" true:
 *
 * 1. there must be qualified business income — a $500,000 wage earner with no
 *    business has no §199A deduction either way, exactly as
 *    `fjs/form8995`'s own two guards already require, and
 * 2. taxable income must be ABOVE the threshold — printed line 3 skips lines 4
 *    through 12 at or below it, so every line that reads these three facts is
 *    skipped too, and a Phase 28 return is unaffected.
 *
 * A gate needs a control: `proof.refusal`'s
 * `belowTheThresholdNothingIsRequired` and
 * `aHighIncomeReturnWithNoBusinessIsUntouched` are the two that show it is not a
 * blanket refusal.
 * @type {(input: { readonly qualifiedBusinessIncomeCents: bigint, readonly aboveThreshold: boolean, readonly assertedSpecifiedService: string | undefined, readonly assertedW2Wages: string | undefined, readonly assertedUnadjustedBasis: string | undefined }) => Form8995ARefusal | { readonly kind: 'ok' }}
 */
export const formEightNineNineFiveAInputsAreUnstated = input => {
    const {
        qualifiedBusinessIncomeCents, aboveThreshold,
        assertedSpecifiedService, assertedW2Wages, assertedUnadjustedBasis,
    } = input
    if (qualifiedBusinessIncomeCents === 0n || !aboveThreshold) {
        return { kind: 'ok' }
    }
    const missing = [
        ...assertedSpecifiedService === undefined
            ? ['specifiedServiceTradeOrBusiness (Schedule A: is this a §199A(d)(2) specified '
                + 'service trade or business — health, law, accounting, actuarial science, '
                + 'performing arts, consulting, athletics, financial services, brokerage, or one '
                + 'whose principal asset is the reputation or skill of its owners? Store '
                + '"specifiedService" or "notSpecifiedService"; there is no default, because one '
                + 'default would grant a consultant a deduction §199A(d)(1) denies them and the '
                + 'other would deny a plumber the deduction they are owed)']
            : [],
        ...assertedW2Wages === undefined
            ? ['w2Wages (Form 8995-A line 4: the W-2 wages this business PAID, which is not '
                + 'something the Forms W-2 a taxpayer RECEIVED can show. A sole proprietor with '
                + 'no employees paid none, and "0.00" is how that is asserted — it is the '
                + 'ordinary answer, and it is still an answer)']
            : [],
        ...assertedUnadjustedBasis === undefined
            ? ['unadjustedBasisOfQualifiedProperty (Form 8995-A line 7: the unadjusted basis '
                + 'immediately after acquisition of qualified property, an asset basis history '
                + 'Schedule C line 13 already refuses for. "0.00" asserts there is no qualified '
                + 'property)']
            : [],
    ]
    if (missing.length === 0) {
        return { kind: 'ok' }
    }
    return {
        kind: 'error',
        message: `Form 8995-A: taxable income before the qualified business income deduction is `
            + `above §199A(e)(2)'s threshold, so the SIMPLIFIED computation on Form 8995 does not `
            + `apply and Form 8995-A does — and it reads ${missing.length} fact(s) about the `
            + `business that the business expenses record does not state. §199A(b)(2)(B) caps the `
            + `deduction at the greater of 50% of the business's W-2 wages or 25% of those wages `
            + `plus 2.5% of the unadjusted basis immediately after acquisition of qualified `
            + `property, and §199A(d)(3) phases it out for a specified service trade or business. `
            + `Guessing any of these would be silent in BOTH directions — too high understates `
            + `the tax, too low overstates it. Set the following on the business expenses record: `
            + `${missing.join('; ')}`,
    }
}

// ── The printed form ─────────────────────────────────────────────────────────

/**
 * Form 8995-A's forty printed lines, plus the Schedule A that fed Part II when
 * the business is a specified service trade or business (`undefined` when it is
 * not, which is the printed *"don't file this form"* rather than a schedule of
 * zeros).
 *
 * `line24` is BASIS POINTS, the printed `%` box; every other numbered field is
 * cents. Lines 1(a)-(e) are Part I's identity columns — a name, a TIN and three
 * checkboxes — and carry no money.
 * @typedef {{
 *   readonly scheduleA: ScheduleA | undefined,
 *   readonly line2: bigint, readonly line3: bigint, readonly line4: bigint,
 *   readonly line5: bigint, readonly line6: bigint, readonly line7: bigint,
 *   readonly line8: bigint, readonly line9: bigint, readonly line10: bigint,
 *   readonly line11: bigint, readonly line12: bigint, readonly line13: bigint,
 *   readonly line14: bigint, readonly line15: bigint, readonly line16: bigint,
 *   readonly line17: bigint, readonly line18: bigint, readonly line19: bigint,
 *   readonly line20: bigint, readonly line21: bigint, readonly line22: bigint,
 *   readonly line23: bigint, readonly line24: bigint, readonly line25: bigint,
 *   readonly line26: bigint, readonly line27: bigint, readonly line28: bigint,
 *   readonly line29: bigint, readonly line30: bigint, readonly line31: bigint,
 *   readonly line32: bigint, readonly line33: bigint, readonly line34: bigint,
 *   readonly line35: bigint, readonly line36: bigint, readonly line37: bigint,
 *   readonly line38: bigint, readonly line39: bigint, readonly line40: bigint,
 * }} Form8995A
 */

/**
 * @typedef {{
 *   readonly qualifiedBusinessIncomeCents: bigint,
 *   readonly priorYearLossCarryforwardCents: bigint,
 *   readonly taxableIncomeBeforeQbiCents: bigint,
 *   readonly netCapitalGainCents: bigint,
 *   readonly isSpecifiedServiceTradeOrBusiness: boolean,
 *   readonly w2WagesCents: bigint,
 *   readonly unadjustedBasisCents: bigint,
 *   readonly qualifiedReitDividendsCents: bigint,
 * }} Form8995AInput
 */

/**
 * Fills in Form 8995-A for one return, Schedule A included.
 *
 * The order is the printed order with one exception the page itself dictates:
 * **Part III is computed before Part II's line 12**, because line 12 is *"the
 * amount from line 26, if any"*. Part III in turn reads Part II's lines 3 and
 * 10, so the sequence is lines 2-11, then 17-26, then 12-16, then Part IV. The
 * printed page says as much in its own Part III heading (*"and line 10 is less
 * than line 3"*) — a condition unstatable before line 10 exists.
 * @type {(taxParamSet: TaxParamSet) => (status: IndividualFilingStatus) => (input: Form8995AInput) => Form8995A}
 */
export const form8995a = taxParamSet => status => input => {
    const {
        qualifiedBusinessIncomeCents, priorYearLossCarryforwardCents,
        taxableIncomeBeforeQbiCents, netCapitalGainCents,
        isSpecifiedServiceTradeOrBusiness, w2WagesCents, unadjustedBasisCents,
        qualifiedReitDividendsCents,
    } = input
    const rate = BigInt(taxParamSet.qualifiedBusinessIncomeDeduction.ratePercent)
    const position = phaseInPosition(taxParamSet)(status)(taxableIncomeBeforeQbiCents)
    const { aboveThreshold, withinPhaseInRange, applicableNumerator, rangeCents } = position
    // §199A(c)(2)'s carryforward, which is Form 8995 line 3 and has no printed
    // line of its own on THIS form: the instructions fold it into line 2's
    // "qualified business income from the trade, business, or aggregation".
    // Netted here, floored at zero, and `fjs/form8995`'s own line 4 does the
    // identical subtraction -- which is one reason the two forms can be
    // asserted equal below the threshold.
    const netQualifiedBusinessIncomeBeforeFloor =
        qualifiedBusinessIncomeCents - priorYearLossCarryforwardCents
    const netQualifiedBusinessIncome = netQualifiedBusinessIncomeBeforeFloor > 0n
        ? netQualifiedBusinessIncomeBeforeFloor
        : 0n
    // Schedule A FIRST -- the printed Note on page 1: "Complete Schedules A, B,
    // and/or C (Form 8995-A), as applicable, BEFORE starting Part I." Only an
    // SSTB above the threshold files one; below it, the schedule's own header
    // says "don't file this form; instead, file Form 8995".
    const filedScheduleA = isSpecifiedServiceTradeOrBusiness && aboveThreshold
    const scheduleAResult = filedScheduleA
        ? scheduleA(position)({
            qualifiedBusinessIncomeCents: netQualifiedBusinessIncome,
            w2WagesCents,
            unadjustedBasisCents,
            taxableIncomeBeforeQbiCents,
        })
        : undefined
    // 2. "Qualified business income from the trade, business, or aggregation."
    //    Schedule A line 11 when one was filed -- the applicable percentage of
    //    it -- and the whole amount when it was not.
    const line2 = scheduleAResult === undefined ? netQualifiedBusinessIncome : scheduleAResult.line11
    // 3. "Multiply line 2 by 20% (0.20). If your taxable income is $197,300 or
    //    less ($394,600 if married filing jointly), SKIP LINES 4 THROUGH 12 and
    //    enter the amount from line 3 on line 13."
    const line3 = percentOfCents(line2)(rate)
    // 4. "Allocable share of W-2 wages from the trade, business, or
    //    aggregation." Schedule A line 12 when one was filed.
    const line4 = aboveThreshold
        ? (scheduleAResult === undefined ? w2WagesCents : scheduleAResult.line12)
        : 0n
    // 5. "Multiply line 4 by 50% (0.50)." **§199A(b)(2)(B)(i)'s LIMB**, named
    //    and returned rather than inlined into line 10's comparison.
    const line5 = basisPointsOfCents(line4)(wagesOnlyLimbBasisPoints)
    // 6. "Multiply line 4 by 25% (0.25)."
    const line6 = basisPointsOfCents(line4)(wagesShareOfUbiaLimbBasisPoints)
    // 7. "Allocable share of the unadjusted basis immediately after acquisition
    //    (UBIA) of all qualified property." Schedule A line 13 when one was
    //    filed.
    const line7 = aboveThreshold
        ? (scheduleAResult === undefined ? unadjustedBasisCents : scheduleAResult.line13)
        : 0n
    // 8. "Multiply line 7 by 2.5% (0.025)."
    const line8 = basisPointsOfCents(line7)(ubiaShareOfUbiaLimbBasisPoints)
    // 9. "Add lines 6 and 8." **§199A(b)(2)(B)(ii)'s LIMB**, likewise named.
    const line9 = line6 + line8
    // 10. "Enter the GREATER of line 5 or line 9." The taxpayer keeps whichever
    //     limb is kinder, which is why both have to be computed and why a
    //     fixture is needed for each.
    const line10 = line5 > line9 ? line5 : line9
    // 11. "W-2 wage and UBIA of qualified property limitation. Enter the
    //     SMALLER of line 3 or line 10." Zero below the threshold, where lines
    //     4 through 12 are skipped.
    const line11 = aboveThreshold ? (line3 < line10 ? line3 : line10) : 0n
    // ── Part III, computed here because line 12 reads its line 26 ────────────
    // "Complete Part III only if your taxable income is more than $197,300 but
    //  not $247,300 ($394,600 and $494,600 if married filing jointly) AND LINE
    //  10 IS LESS THAN LINE 3. Otherwise, skip Part III."
    //
    // The second condition is the one a summary drops: inside the range but
    // with a cap that does not bite, there is nothing to phase IN, and lines
    // 17-26 would compute a reduction of zero the long way round.
    const completesPartIII = withinPhaseInRange && line10 < line3
    // 17. "Enter the amounts from line 3."
    const line17 = completesPartIII ? line3 : 0n
    // 18. "Enter the amounts from line 10."
    const line18 = completesPartIII ? line10 : 0n
    // 19. "Subtract line 18 from line 17." The amount the wage/UBIA cap takes
    //     away -- positive exactly when the gate above passed.
    const line19 = line17 - line18
    // 20. "Taxable income before qualified business income deduction."
    const line20 = completesPartIII ? taxableIncomeBeforeQbiCents : 0n
    // 21. "Threshold. Enter $197,300 ($394,600 if married filing jointly)."
    const line21 = completesPartIII ? position.thresholdCents : 0n
    // 22. "Subtract line 21 from line 20."
    const line22 = completesPartIII ? position.excessCents : 0n
    // 23. "Phase-in range. Enter $50,000 ($100,000 if married filing jointly)."
    const line23 = completesPartIII ? rangeCents : 0n
    // 24. "Phase-in percentage. Divide line 22 by line 23." Basis points for
    //     the record; line 25 multiplies by the EXACT ratio instead.
    const line24 = completesPartIII
        ? wholeInBasisPoints - ratioOfCents(wholeInBasisPoints)(applicableNumerator)(rangeCents)
        : 0n
    // 25. "Total phase-in reduction. Multiply line 19 by line 24." Line 19
    //     times the EXACT `excess / range`, which is what line 24 is a rounded
    //     display of.
    //
    //     Written as the page writes it rather than as
    //     `line19 - line19 * applicableNumerator / range`. Those two are equal
    //     at most inputs and NOT at all of them -- `halfUp(x)` and
    //     `line19 - halfUp(line19 - x)` part company wherever the product lands
    //     on a tie -- and the page's own form is the one a reader can diff. The
    //     first draft here used the complement and disagreed by a cent one cent
    //     inside the top of the range.
    const line25 = completesPartIII
        ? ratioOfCents(line19)(position.excessCents)(rangeCents)
        : 0n
    // 26. "Qualified business income after phase-in reduction. Subtract line 25
    //     from line 17. Enter this amount here and on line 12, for the
    //     corresponding trade or business."
    const line26 = completesPartIII ? line17 - line25 : 0n
    // ── back to Part II ─────────────────────────────────────────────────────
    // 12. "Phased-in reduction. Enter the amount from line 26, if any."
    const line12 = line26
    // 13. "Qualified business income deduction before patron reduction. Enter
    //     the GREATER of line 11 or line 12." At or below the threshold, printed
    //     line 3's own sentence puts line 3 here instead.
    const line13 = aboveThreshold ? (line11 > line12 ? line11 : line12) : line3
    // 14. "Patron reduction. Enter the amount from Schedule D (Form 8995-A),
    //     line 6, if any." A structural zero: a patron of an agricultural or
    //     horticultural cooperative needs Form 1099-PATR, which this engine
    //     does not read.
    const line14 = 0n
    // 15. "Qualified business income component. Subtract line 14 from line 13."
    const line15 = line13 - line14
    // 16. "Total qualified business income component. Add all amounts reported
    //     on line 15." One column, because `fjs/schedule/c` refuses a second
    //     business by name.
    const line16 = line15
    // ── Part IV ─────────────────────────────────────────────────────────────
    // 27. "Total qualified business income component from all qualified trades,
    //     businesses, or aggregations. Enter the amount from line 16."
    const line27 = line16
    // 28. "Qualified REIT dividends and publicly traded partnership (PTP)
    //     income or (loss)." Form 1099-DIV box 5, exactly as Form 8995 line 6
    //     is -- and it arrives here UNREDUCED by anything Parts I through III
    //     computed, because §199A(b)(1)(B) is a component of its own.
    const line28 = qualifiedReitDividendsCents
    // 29. "Qualified REIT dividends and PTP (loss) carryforward from prior
    //     years." A structural zero, for `fjs/form8995` line 7's reason: only a
    //     qualified PTP loss could carry into it, and the K-1 that would report
    //     one is refused by name.
    const line29 = 0n
    // 30. "Total qualified REIT dividends and PTP income. Combine lines 28 and
    //     29. If less than zero, enter -0-."
    const line30Combined = line28 + line29
    const line30 = line30Combined > 0n ? line30Combined : 0n
    // 31. "REIT and PTP component. Multiply line 30 by 20% (0.20)."
    const line31 = percentOfCents(line30)(rate)
    // 32. "Qualified business income deduction before the income limitation.
    //     Add lines 27 and 31."
    const line32 = line27 + line31
    // 33. "Taxable income before qualified business income deduction." The same
    //     figure Form 8995 line 11 carries, and the same subtraction behind it
    //     (1040 line 11 - line 12 - line 13b).
    const line33 = taxableIncomeBeforeQbiCents
    // 34. "Enter your net capital gain, if any, increased by any qualified
    //     dividends." Form 8995 line 12's quantity, computed by that module's
    //     `netCapitalGainLine12` and passed in -- ONE transcription of the rule,
    //     read twice.
    const line34 = netCapitalGainCents
    // 35. "Subtract line 34 from line 33. If zero or less, enter -0-."
    const line35Difference = line33 - line34
    const line35 = line35Difference > 0n ? line35Difference : 0n
    // 36. "Income limitation. Multiply line 35 by 20% (0.20)."
    const line36 = percentOfCents(line35)(rate)
    // 37. "Qualified business income deduction before the domestic production
    //     activities deduction (DPAD) under section 199A(g). Enter the SMALLER
    //     of line 32 or line 36."
    const line37 = line32 < line36 ? line32 : line36
    // 38. "DPAD under section 199A(g) allocated from an agricultural or
    //     horticultural cooperative. Don't enter more than line 33 minus line
    //     37." A structural zero, for line 14's reason.
    const line38 = 0n
    // 39. "Total qualified business income deduction. Add lines 37 and 38."
    //     -> 1040 line 13a.
    const line39 = line37 + line38
    // 40. "Total qualified REIT dividends and PTP (loss) carryforward. Combine
    //     lines 28 and 29. If zero or greater, enter -0-." The opposite floor
    //     from line 30's, and the one a transcription is likeliest to invert.
    const line40 = line30Combined < 0n ? line30Combined : 0n
    assert(line39 >= 0n, ['Form 8995-A line 39 must never be negative', line39])
    assert(
        line39 <= line32,
        ['line 39 can never exceed the deduction before the income limitation', line39, line32])
    return {
        scheduleA: scheduleAResult,
        line2, line3, line4, line5, line6, line7, line8, line9, line10,
        line11, line12, line13, line14, line15, line16,
        line17, line18, line19, line20, line21, line22, line23, line24, line25, line26,
        line27, line28, line29, line30, line31, line32, line33, line34, line35, line36,
        line37, line38, line39, line40,
    }
}

// ── The whole computation: routing, guards, and one deduction ────────────────

/**
 * Which form a return uses, and the deduction it produces. `simplified` and
 * `comprehensive` are exclusive — exactly one is present — and
 * `deductionCents` is the figure 1040 line 13a receives either way, so the
 * caller never has to know which page was filled.
 * @typedef {{
 *   readonly kind: 'ok',
 *   readonly deductionCents: bigint,
 *   readonly simplified: Form8995 | undefined,
 *   readonly comprehensive: Form8995A | undefined,
 * } | Form8995ARefusal} QualifiedBusinessIncomeDeductionOutcome
 */

/**
 * @typedef {{
 *   readonly status: IndividualFilingStatus,
 *   readonly netProfitCents: bigint,
 *   readonly deductibleHalfOfSelfEmploymentTaxCents: bigint,
 *   readonly selfEmployedHealthInsuranceDeductionCents: bigint,
 *   readonly assertedPriorYearLossCarryforward: string | undefined,
 *   readonly assertedSpecifiedService: string | undefined,
 *   readonly assertedW2Wages: string | undefined,
 *   readonly assertedUnadjustedBasis: string | undefined,
 *   readonly taxableIncomeBeforeQbiCents: bigint,
 *   readonly netCapitalGainCents: bigint,
 *   readonly qualifiedReitDividendsCents: bigint,
 * }} QualifiedBusinessIncomeDeductionInput
 */

/**
 * **The §199A deduction end to end, both forms.** The single entry point
 * `fjs/form1040/core` calls for 1040 line 13a.
 *
 * The routing is printed line 3's own sentence, read as a fork rather than as a
 * skip instruction: at or below the threshold every limitation line is skipped,
 * which is precisely Form 8995, so that case is delegated to `fjs/form8995`
 * rather than re-derived. **Two transcriptions of one statute must not disagree
 * in their overlap, and the cheapest way to guarantee that is for the overlap to
 * be one transcription** — `belowTheThresholdBothFormsAgree` then checks the
 * OTHER path (this module's own short-circuit) against it to the cent, at four
 * taxable incomes.
 *
 * The guards run in a fixed order, and it is the order a taxpayer can act on:
 *
 * 1. the §199A(c)(2) carryforward, `fjs/form8995`'s own
 *    {@link priorYearCarryforwardIsUnstated}, because it changes the income
 *    every later line reads, and
 * 2. Form 8995-A's three facts, which are only read above the threshold.
 *
 * A return whose carryforward is unstated AND which is above the threshold is
 * told about the carryforward first — one refusal at a time, the nearest one
 * first, exactly as Phase 28 ordered its two.
 * @type {(taxParamSet: TaxParamSet) => (input: QualifiedBusinessIncomeDeductionInput) => QualifiedBusinessIncomeDeductionOutcome}
 */
export const qualifiedBusinessIncomeDeduction = taxParamSet => input => {
    const {
        status, netProfitCents, deductibleHalfOfSelfEmploymentTaxCents,
        selfEmployedHealthInsuranceDeductionCents,
        assertedPriorYearLossCarryforward, assertedSpecifiedService,
        assertedW2Wages, assertedUnadjustedBasis,
        taxableIncomeBeforeQbiCents, netCapitalGainCents, qualifiedReitDividendsCents,
    } = input
    const qualifiedBusinessIncomeCents = qualifiedBusinessIncome({
        netProfitCents, deductibleHalfOfSelfEmploymentTaxCents,
        selfEmployedHealthInsuranceDeductionCents,
    })
    const carryforward = priorYearCarryforwardIsUnstated({
        qualifiedBusinessIncomeCents,
        assertedCarryforward: assertedPriorYearLossCarryforward,
    })
    if (carryforward.kind === 'error') {
        return carryforward
    }
    const priorYearLossCarryforwardCents = assertedPriorYearLossCarryforward === undefined
        ? 0n
        : centsFromString(assertedPriorYearLossCarryforward)
    const { aboveThreshold } = phaseInPosition(taxParamSet)(status)(taxableIncomeBeforeQbiCents)
    if (!aboveThreshold) {
        // Form 8995, the simplified computation, delegated WHOLE -- through that
        // module's own end-to-end entry point rather than its bare form filler,
        // so its threshold guard runs from its own side as well. That guard is
        // unreachable from here by construction (this branch is the
        // at-or-below case), and it stays live rather than becoming an orphan:
        // one rule, one place, and Form 8995 refuses if it is ever asked for out
        // of range by anything else.
        const outcome = simplifiedComputation(taxParamSet)({
            status, netProfitCents, deductibleHalfOfSelfEmploymentTaxCents,
            selfEmployedHealthInsuranceDeductionCents,
            assertedPriorYearLossCarryforward, taxableIncomeBeforeQbiCents, netCapitalGainCents,
            qualifiedReitDividendsCents,
        })
        if (outcome.kind === 'error') {
            return outcome
        }
        return {
            kind: 'ok',
            deductionCents: outcome.form.line15,
            simplified: outcome.form,
            comprehensive: undefined,
        }
    }
    const unstated = formEightNineNineFiveAInputsAreUnstated({
        qualifiedBusinessIncomeCents, aboveThreshold,
        assertedSpecifiedService, assertedW2Wages, assertedUnadjustedBasis,
    })
    if (unstated.kind === 'error') {
        return unstated
    }
    // Above the threshold with no qualified business income at all: nothing is
    // asserted and nothing needs to be, so the form is filled with the zeros it
    // would print. This is the $500,000 wage earner, and the branch exists so
    // that reading the three assertions below cannot reach an `undefined`.
    const comprehensive = form8995a(taxParamSet)(status)({
        qualifiedBusinessIncomeCents,
        priorYearLossCarryforwardCents,
        taxableIncomeBeforeQbiCents,
        netCapitalGainCents,
        isSpecifiedServiceTradeOrBusiness: assertedSpecifiedService === 'specifiedService',
        w2WagesCents: assertedW2Wages === undefined ? 0n : centsFromString(assertedW2Wages),
        unadjustedBasisCents: assertedUnadjustedBasis === undefined
            ? 0n
            : centsFromString(assertedUnadjustedBasis),
        qualifiedReitDividendsCents,
    })
    return {
        kind: 'ok',
        deductionCents: comprehensive.line39,
        simplified: undefined,
        comprehensive,
    }
}

// ── Tests ────────────────────────────────────────────────────────────────────

/** TY2025's parameter set, narrowed exactly ONCE at module scope. */
const taxParams2025 = taxParamsByYear[2025]
assert(taxParams2025 !== undefined, 'expected TY2025 parameters to be present in taxParamsByYear')

/**
 * Hand-typed off the statute and the two printed pages, in CENTS — never read
 * from `fjs/tax/params`, so a boundary proof whose boundary came from the code
 * under test cannot exist. `fjs/tax/params` pins the same figures against
 * §199A(e)(2) and §199A(b)(3)(B)(ii) independently, and both must agree.
 */
const printedThresholdCents = 19730000n
/** §199A(b)(3)(B)(ii)'s range, printed line 23 and Schedule A line 8. */
const printedRangeCents = 5000000n
/**
 * The printed Part III upper bound, *"but not $247,300"* — hand-typed from the
 * page rather than added, so the addition itself is checkable:
 * 19,730,000 + 5,000,000 = 24,730,000.
 */
const printedUpperBoundCents = 24730000n

/** @type {(input: QualifiedBusinessIncomeDeductionInput) => QualifiedBusinessIncomeDeductionOutcome} */
const run = input => qualifiedBusinessIncomeDeduction(taxParams2025)(input)

/**
 * A single filer with one business who has asserted all four facts: no
 * carryforward, not a specified service trade or business, no W-2 wages and no
 * qualified property. **This is the ordinary sole proprietor** — the wage limb
 * is zero for them by definition — and every fixture below widens it.
 * @type {QualifiedBusinessIncomeDeductionInput}
 */
const soleProprietor = {
    status: 'single',
    netProfitCents: 0n,
    deductibleHalfOfSelfEmploymentTaxCents: 0n,
    selfEmployedHealthInsuranceDeductionCents: 0n,
    assertedPriorYearLossCarryforward: '0.00',
    assertedSpecifiedService: 'notSpecifiedService',
    assertedW2Wages: '0.00',
    assertedUnadjustedBasis: '0.00',
    taxableIncomeBeforeQbiCents: 0n,
    netCapitalGainCents: 0n,
    qualifiedReitDividendsCents: 0n,
}

/** Narrows an outcome to its OK arm, throwing (never casting).
 * @type {(outcome: QualifiedBusinessIncomeDeductionOutcome) => bigint}
 */
const deduction = outcome => {
    assert(outcome.kind === 'ok', ['expected a computed deduction', outcome])
    return outcome.deductionCents
}

/** Narrows an outcome to the Form 8995-A it computed, throwing (never casting).
 * @type {(outcome: QualifiedBusinessIncomeDeductionOutcome) => Form8995A}
 */
const comprehensive = outcome => {
    assert(outcome.kind === 'ok', ['expected a computed deduction', outcome])
    const { comprehensive: form } = outcome
    assert(form !== undefined, ['expected Form 8995-A to have been the form used', outcome])
    return form
}

/** Narrows an outcome to the Form 8995 it computed, throwing (never casting).
 * @type {(outcome: QualifiedBusinessIncomeDeductionOutcome) => Form8995}
 */
const simplified = outcome => {
    assert(outcome.kind === 'ok', ['expected a computed deduction', outcome])
    const { simplified: form } = outcome
    assert(form !== undefined, ['expected Form 8995 to have been the form used', outcome])
    return form
}

/** Narrows an outcome to its refusal arm, throwing (never casting).
 * @type {(outcome: QualifiedBusinessIncomeDeductionOutcome) => Form8995ARefusal}
 */
const refusal = outcome => {
    assert(outcome.kind === 'error', ['expected a refusal', outcome])
    return outcome
}

/**
 * Form 8995-A computed DIRECTLY, bypassing the router — the only way to reach
 * this module's own short-circuit path below the threshold, which is what
 * `belowTheThresholdBothFormsAgree` compares against Form 8995.
 * @type {(input: { readonly qualifiedBusinessIncomeCents: bigint, readonly taxableIncomeBeforeQbiCents: bigint, readonly netCapitalGainCents?: bigint, readonly qualifiedReitDividendsCents?: bigint }) => Form8995A}
 */
const directly = input => form8995a(taxParams2025)('single')({
    qualifiedBusinessIncomeCents: input.qualifiedBusinessIncomeCents,
    priorYearLossCarryforwardCents: 0n,
    taxableIncomeBeforeQbiCents: input.taxableIncomeBeforeQbiCents,
    netCapitalGainCents: input.netCapitalGainCents ?? 0n,
    isSpecifiedServiceTradeOrBusiness: false,
    w2WagesCents: 0n,
    unadjustedBasisCents: 0n,
    qualifiedReitDividendsCents: input.qualifiedReitDividendsCents ?? 0n,
})

export const proof = {
    // ── The stored parameters this module reads, pinned independently ────────
    theStatutoryPercentagesAreThePrintedOnes: () => {
        // "Multiply line 4 by 50% (0.50)", "by 25% (0.25)", "Multiply line 7 by
        // 2.5% (0.025)" -- three printed instructions, three basis-point
        // figures, hand-typed.
        assertEq(wagesOnlyLimbBasisPoints, 5000n, '50% = 5,000 basis points')
        assertEq(wagesShareOfUbiaLimbBasisPoints, 2500n, '25% = 2,500 basis points')
        assertEq(ubiaShareOfUbiaLimbBasisPoints, 250n, '2.5% = 250 basis points')
        assertEq(wholeInBasisPoints, 10000n, '100% = 10,000 basis points')
        // …and the RELATIONSHIP the statute states: the wages-only limb is
        // exactly twice the wage share of the other limb. §199A(b)(2)(B) writes
        // "50 percent" and "25 percent", so a transposition of the two reddens
        // here as well as in the fixtures.
        assertEq(wagesOnlyLimbBasisPoints, wagesShareOfUbiaLimbBasisPoints * 2n)
        // 2.5% is a TENTH of 25%, which is the ratio easiest to typo as an
        // equality: 250 vs 2,500.
        assertEq(wagesShareOfUbiaLimbBasisPoints, ubiaShareOfUbiaLimbBasisPoints * 10n)
    },
    theHandTypedFiguresAgreeWithTheStoredParameters: () => {
        assertEq(
            taxParams2025.qualifiedBusinessIncomeDeduction.thresholdAmount.single.amount,
            '197300.00')
        assertEq(
            taxParams2025.qualifiedBusinessIncomeDeduction.phaseInRange.single.amount,
            '50000.00')
        assertEq(centsFromString('197300.00'), printedThresholdCents)
        assertEq(centsFromString('50000.00'), printedRangeCents)
        // The printed upper bound, hand-typed from the page, must be the sum --
        // 19,730,000 + 5,000,000 = 24,730,000.
        assertEq(printedThresholdCents + printedRangeCents, printedUpperBoundCents)
    },

    // ── CRITERION: below the threshold the two forms agree TO THE CENT ───────
    //
    // Form 8995-A's printed line 3 skips lines 4 through 12 at or below the
    // threshold, which leaves exactly Form 8995's arithmetic. Two transcriptions
    // that disagree anywhere in their overlap mean one is wrong, so this is
    // ASSERTED rather than assumed, at four taxable incomes including the
    // boundary itself and one cent below it.
    //
    //   QBI $46,467.61 (=$50,000.00 net profit - $3,532.39 deductible half)
    //   line 3 / line 5:  20% of 4,646,761 = 929,352.2 -> 929,352  $9,293.52
    //
    // The comparison runs the ROUTER for Form 8995 (which is what a real return
    // gets) and `form8995a` DIRECTLY for the other side, because the router
    // deliberately never sends a below-threshold return down this form.
    belowTheThresholdBothFormsAgree: () => {
        /** @type {readonly bigint[]} */
        const taxableIncomes = [
            printedThresholdCents,          // exactly at it: "at or below"
            printedThresholdCents - 1n,     // one cent below
            3071761n,                       // the ordinary proprietor, $30,717.61
            12000000n,                      // $120,000.00, where the 20% does not bind
        ]
        // A hand-typed count, so a fixture silently dropped from the list above
        // fails rather than passing by omission.
        assertEq(taxableIncomes.length, 4, 'four taxable incomes, hand-counted')
        for (const taxableIncomeBeforeQbiCents of taxableIncomes) {
            const outcome = run({
                ...soleProprietor,
                netProfitCents: 5000000n,
                deductibleHalfOfSelfEmploymentTaxCents: 353239n,
                selfEmployedHealthInsuranceDeductionCents: 0n,
                taxableIncomeBeforeQbiCents,
            })
            const eightNineNineFive = simplified(outcome)
            const eightNineNineFiveA = directly({
                qualifiedBusinessIncomeCents: 4646761n,
                taxableIncomeBeforeQbiCents,
            })
            assertEq(
                eightNineNineFiveA.line39,
                eightNineNineFive.line15,
                ['the two forms must agree to the cent', taxableIncomeBeforeQbiCents])
            // …and line by line where the two pages carry the same quantity,
            // so an agreement that happened only at the total would still be
            // caught. 8995-A line 3 is 8995 line 5; line 32 is line 10; line 36
            // is line 14.
            assertEq(eightNineNineFiveA.line3, eightNineNineFive.line5, 'the 20% component')
            assertEq(eightNineNineFiveA.line32, eightNineNineFive.line10, 'before the limitation')
            assertEq(eightNineNineFiveA.line36, eightNineNineFive.line14, 'the income limitation')
            // …and the SKIP really happened: every line printed line 3 tells a
            // filer to skip is zero, and line 13 is line 3 itself.
            assertEq(eightNineNineFiveA.line4, 0n, 'line 4 skipped')
            assertEq(eightNineNineFiveA.line10, 0n, 'line 10 skipped')
            assertEq(eightNineNineFiveA.line11, 0n, 'line 11 skipped')
            assertEq(eightNineNineFiveA.line12, 0n, 'line 12 skipped')
            assertEq(eightNineNineFiveA.line13, eightNineNineFiveA.line3, 'line 3 goes to line 13')
            assertEq(eightNineNineFiveA.scheduleA, undefined, 'and no Schedule A is filed')
        }
        // THE CONTROL for the whole leaf: the figure being compared is a real
        // one, not zero on both sides.
        assertEq(
            deduction(run({
                ...soleProprietor,
                netProfitCents: 5000000n,
                deductibleHalfOfSelfEmploymentTaxCents: 353239n,
                selfEmployedHealthInsuranceDeductionCents: 0n,
                taxableIncomeBeforeQbiCents: 12000000n,
            })),
            929352n,
            '$9,293.52, the amount both forms produce')
    },

    // ── CRITERION: the two limbs, separately observable ──────────────────────
    limbs: {
        // **THE COMMON CASE.** A sole proprietor with no employees pays no W-2
        // wages, so §199A(b)(2)(B)(i)'s limb is ZERO and the whole cap is the
        // UBIA one. Hand-derived, above the phase-in range so the full
        // limitation applies with nothing phased:
        //
        //   QBI                                            $300,000.00
        //   line 3   20% of 30,000,000                      $60,000.00
        //   line 4   W-2 wages, no employees                     $0.00
        //   line 5   50% of 0                    THE WAGE LIMB   $0.00
        //   line 6   25% of 0                                    $0.00
        //   line 7   UBIA                                 $1,000,000.00
        //   line 8   2.5% of 100,000,000                    $25,000.00
        //   line 9   0 + 2,500,000               THE UBIA LIMB  $25,000.00
        //   line 10  greater of 0 and 25,000.00              $25,000.00
        //   line 11  smaller of 60,000.00 and 25,000.00      $25,000.00
        //   line 13  greater of 25,000.00 and 0 (no phase-in) $25,000.00
        //   line 36  20% of 30,000,000                       $60,000.00
        //   line 39  smaller of 25,000.00 and 60,000.00      $25,000.00
        //
        // The limitation removes $35,000.00 of the $60,000.00 the 20% alone
        // would have given.
        theUbiaLimbBindsForAProprietorWithNoEmployees: () => {
            const form = comprehensive(run({
                ...soleProprietor,
                netProfitCents: 30000000n,
                assertedW2Wages: '0.00',
                assertedUnadjustedBasis: '1000000.00',
                taxableIncomeBeforeQbiCents: 30000000n,
            }))
            assertEq(form.line3, 6000000n, 'line 3 = $60,000.00 = 20% of $300,000.00')
            assertEq(form.line4, 0n, 'line 4 = $0.00 of W-2 wages')
            assertEq(form.line5, 0n, 'line 5 = $0.00 -- THE WAGE LIMB, and it is zero')
            assertEq(form.line6, 0n, 'line 6 = $0.00')
            assertEq(form.line7, 100000000n, 'line 7 = $1,000,000.00 of UBIA')
            assertEq(form.line8, 2500000n, 'line 8 = $25,000.00 = 2.5% of $1,000,000.00')
            assertEq(form.line9, 2500000n, 'line 9 = $25,000.00 -- THE UBIA LIMB')
            // …and line 10 chose the UBIA limb, asserted as an INEQUALITY
            // between the two named limbs rather than only as a value: a
            // `min` written where the page says "greater of" would land on
            // $0.00 here.
            assertEq(form.line10, form.line9, 'line 10 is the UBIA limb')
            assert(form.line9 > form.line5, ['the UBIA limb must be the greater one', form])
            assertEq(form.line11, 2500000n, 'line 11 = $25,000.00, the smaller of line 3 and line 10')
            assertEq(form.line13, 2500000n, 'line 13 = $25,000.00')
            assertEq(form.line36, 6000000n, 'line 36 = $60,000.00 -- the income limitation does NOT bind')
            assertEq(form.line39, 2500000n, 'line 39 = $25,000.00 -> 1040 line 13a')
            assertEq(form.line3 - form.line39, 3500000n, '$35,000.00 the limitation removed')
            // Part III was NOT completed: $300,000.00 is above $247,300.00.
            assertEq(form.line24, 0n, 'no phase-in percentage above the range')
            assertEq(form.line12, 0n, 'and no phased-in reduction')
        },
        // **THE PERTURBATION**, which is what keeps the fixture above from
        // being right for the wrong reason. An implementation that ignored
        // UBIA entirely would ALSO produce a wage limb of zero and a cap of
        // zero -- and would give $0.00 here. Zeroing the UBIA is the only
        // change, and the answer must move all the way to zero.
        zeroingTheUbiaCollapsesTheDeductionToNothing: () => {
            const withUbia = comprehensive(run({
                ...soleProprietor,
                netProfitCents: 30000000n,
                assertedUnadjustedBasis: '1000000.00',
                taxableIncomeBeforeQbiCents: 30000000n,
            }))
            const withoutUbia = comprehensive(run({
                ...soleProprietor,
                netProfitCents: 30000000n,
                assertedUnadjustedBasis: '0.00',
                taxableIncomeBeforeQbiCents: 30000000n,
            }))
            assertEq(withUbia.line39, 2500000n, '$25,000.00 with $1,000,000.00 of qualified property')
            assertEq(withoutUbia.line39, 0n, '$0.00 without it -- no wages and no property, no cap')
            assertEq(withoutUbia.line9, 0n, 'both limbs are zero')
            assertEq(withoutUbia.line5, 0n)
            assertEq(withoutUbia.line10, 0n, 'so the cap is zero')
            // …and the 20% component was a real amount in both, so the
            // difference is the CAP moving rather than the income.
            assertEq(withUbia.line3, withoutUbia.line3, 'the same $60,000.00 of 20% component')
            assertEq(withUbia.line3, 6000000n)
        },
        // **THE OTHER LIMB BINDING.** Wages large relative to UBIA, so
        // §199A(b)(2)(B)(i) is the greater one -- and the cap still bites,
        // which is the part that makes line 10 observable at line 39 rather
        // than merely computed. Hand-derived:
        //
        //   QBI                                            $300,000.00
        //   line 3   20% of 30,000,000                      $60,000.00
        //   line 4   W-2 wages                              $80,000.00
        //   line 5   50% of 8,000,000            THE WAGE LIMB  $40,000.00
        //   line 6   25% of 8,000,000                       $20,000.00
        //   line 7   UBIA                                  $500,000.00
        //   line 8   2.5% of 50,000,000                     $12,500.00
        //   line 9   20,000.00 + 12,500.00       THE UBIA LIMB  $32,500.00
        //   line 10  greater of 40,000.00 and 32,500.00      $40,000.00
        //   line 11  smaller of 60,000.00 and 40,000.00      $40,000.00
        //   line 39                                         $40,000.00
        theWageLimbBindsWhenWagesAreLargeRelativeToUbia: () => {
            const form = comprehensive(run({
                ...soleProprietor,
                netProfitCents: 30000000n,
                assertedW2Wages: '80000.00',
                assertedUnadjustedBasis: '500000.00',
                taxableIncomeBeforeQbiCents: 30000000n,
            }))
            assertEq(form.line5, 4000000n, 'line 5 = $40,000.00 -- THE WAGE LIMB')
            assertEq(form.line6, 2000000n, 'line 6 = $20,000.00')
            assertEq(form.line8, 1250000n, 'line 8 = $12,500.00')
            assertEq(form.line9, 3250000n, 'line 9 = $32,500.00 -- THE UBIA LIMB')
            assertEq(form.line10, form.line5, 'line 10 is the WAGE limb this time')
            assert(form.line5 > form.line9, ['the wage limb must be the greater one', form])
            assertEq(form.line11, 4000000n, 'line 11 = $40,000.00')
            assertEq(form.line39, 4000000n, 'line 39 = $40,000.00, and the cap still bites')
            assert(form.line39 < form.line3, 'the $60,000.00 of 20% component was cut')
        },
        // **THE PERTURBATION FOR THAT LIMB**, and it runs in BOTH directions --
        // which is the property Phase 28's unobservable-limb defect lacked.
        // While the wage limb is the greater one, moving UBIA cannot move the
        // answer; moving wages must.
        //
        //   UBIA $500,000.00 -> $600,000.00: line 9 = 20,000.00 + 15,000.00 =
        //     $35,000.00, still under the $40,000.00 wage limb -> line 39
        //     UNCHANGED at $40,000.00.
        //   wages $80,000.00 -> $70,000.00: line 5 = $35,000.00, line 9 =
        //     17,500.00 + 12,500.00 = $30,000.00 -> line 39 = $35,000.00, MOVED.
        movingUbiaDoesNotMoveItWhileMovingWagesDoes: () => {
            /** @type {(wages: string) => (ubia: string) => Form8995A} */
            const at = wages => ubia => comprehensive(run({
                ...soleProprietor,
                netProfitCents: 30000000n,
                assertedW2Wages: wages,
                assertedUnadjustedBasis: ubia,
                taxableIncomeBeforeQbiCents: 30000000n,
            }))
            const base = at('80000.00')('500000.00')
            const moreUbia = at('80000.00')('600000.00')
            assertEq(moreUbia.line9, 3500000n, 'line 9 rose to $35,000.00')
            assert(moreUbia.line9 > base.line9, 'the UBIA limb really did move')
            assertEq(
                moreUbia.line39, base.line39,
                'but the deduction did NOT -- the wage limb still wins')
            assertEq(moreUbia.line39, 4000000n, '$40,000.00 either way')
            const fewerWages = at('70000.00')('500000.00')
            assertEq(fewerWages.line5, 3500000n, 'line 5 fell to $35,000.00')
            assertEq(fewerWages.line9, 3000000n, 'line 9 fell to $30,000.00 too')
            assertEq(fewerWages.line39, 3500000n, 'and the deduction fell to $35,000.00')
            assertEq(base.line39 - fewerWages.line39, 500000n, '$5,000.00 apart')
        },
    },

    // ── CRITERION: the phase-in, both ends and one cent past each ────────────
    //
    // A proprietor with $150,000.00 of qualified business income, NO wages and
    // NO qualified property: the cap is zero, so printed line 10 (0) is less
    // than printed line 3 ($30,000.00) and Part III's second condition is
    // satisfied for every taxable income in the range.
    //
    //   line 3  20% of 15,000,000                          $30,000.00
    //   line 19 line 3 - line 10 = 30,000.00 - 0           $30,000.00
    //
    // At taxable income T, line 22 = T - 19,730,000, line 24 = line 22 / 5,000,000,
    // line 25 = 30,000.00 x line 24, line 26 = 30,000.00 - line 25 -> line 12,
    // and line 13 is the GREATER of line 11 ($0.00) and line 12.
    phaseIn: {
        // AT THE THRESHOLD, and one cent above it. Printed line 3's "or less"
        // means the threshold itself still gets the whole $30,000.00; one cent
        // of income above it costs exactly one cent of deduction, because
        // 30,000.00 x (1 / 5,000,000) = 0.6 cents, half-up to 1.
        theBottomEndAndOneCentPastIt: () => {
            // At the threshold the ROUTER sends the return to Form 8995, so
            // reaching this form at all requires the direct call -- and
            // `belowTheThresholdBothFormsAgree` is what ties the two together,
            // at this very taxable income among its four.
            const at = directly({
                qualifiedBusinessIncomeCents: 15000000n,
                taxableIncomeBeforeQbiCents: printedThresholdCents,
            })
            assertEq(at.line13, 3000000n, 'line 13 = $30,000.00, the whole 20% component')
            assertEq(at.line39, 3000000n, 'line 39 = $30,000.00')
            assertEq(at.line24, 0n, 'Part III is not completed at the threshold itself')
            const above = comprehensive(run({
                ...soleProprietor,
                netProfitCents: 15000000n,
                taxableIncomeBeforeQbiCents: printedThresholdCents + 1n,
            }))
            assertEq(above.line22, 1n, 'line 22 = $0.01 of excess')
            assertEq(above.line23, printedRangeCents, 'line 23 = $50,000.00')
            assertEq(above.line19, 3000000n, 'line 19 = $30,000.00 the cap takes away')
            assertEq(above.line25, 1n, 'line 25 = $0.01 = 30,000.00 x 1/5,000,000, half-up from 0.6')
            assertEq(above.line26, 2999999n, 'line 26 = $29,999.99')
            assertEq(above.line12, 2999999n, 'line 12 receives line 26')
            assertEq(above.line11, 0n, 'line 11 = $0.00, the unphased cap')
            assertEq(above.line13, 2999999n, 'line 13 takes the GREATER, which is the phase-in')
            assertEq(above.line39, 2999999n, 'line 39 = $29,999.99')
            // ONE CENT of taxable income, ONE CENT of deduction. If line 13
            // took the smaller, this would be a $30,000.00 cliff.
            assertEq(at.line39 - above.line39, 1n, 'one cent apart, not $30,000.00 apart')
        },
        // HALFWAY, where the arithmetic is checkable by eye: $22,230,000 is
        // $19,730,000 + $25,000.00 of excess against a $50,000.00 range, so the
        // phase-in percentage is exactly 50% and the deduction is exactly half.
        theMidpointIsExactlyHalf: () => {
            const form = comprehensive(run({
                ...soleProprietor,
                netProfitCents: 15000000n,
                taxableIncomeBeforeQbiCents: 22230000n,
            }))
            assertEq(form.line22, 2500000n, 'line 22 = $25,000.00 of excess')
            assertEq(form.line24, 5000n, 'line 24 = 5,000 basis points = 50%')
            assertEq(form.line25, 1500000n, 'line 25 = $15,000.00 = half of $30,000.00')
            assertEq(form.line26, 1500000n, 'line 26 = $15,000.00')
            assertEq(form.line39, 1500000n, 'line 39 = $15,000.00, exactly half')
        },
        // **THE TOP END, AND THE PROPERTY WORTH MORE THAN THE VALUE.** At
        // threshold + range the phase-in percentage is 100%, so line 25 removes
        // the whole of line 19 and line 26 falls to the unphased cap. One cent
        // further, Part III is not completed at all and line 13 takes line 11
        // directly.
        //
        // **Those two must be EQUAL** -- the phase-in has to arrive exactly at
        // the full limitation, or §199A has a cliff at $247,300.00 that the
        // statute does not contain.
        theTopEndAndOneCentPastItAgree: () => {
            const at = comprehensive(run({
                ...soleProprietor,
                netProfitCents: 15000000n,
                taxableIncomeBeforeQbiCents: printedUpperBoundCents,
            }))
            assertEq(at.line22, printedRangeCents, 'line 22 = $50,000.00, the whole range')
            assertEq(at.line24, 10000n, 'line 24 = 10,000 basis points = 100%')
            assertEq(at.line25, 3000000n, 'line 25 removes the whole $30,000.00')
            assertEq(at.line26, 0n, 'line 26 = $0.00')
            assertEq(at.line39, 0n, 'line 39 = $0.00 -- the cap of zero, fully phased in')
            const past = comprehensive(run({
                ...soleProprietor,
                netProfitCents: 15000000n,
                taxableIncomeBeforeQbiCents: printedUpperBoundCents + 1n,
            }))
            assertEq(past.line24, 0n, 'Part III is not completed one cent past the range')
            assertEq(past.line12, 0n, 'so there is no phased-in reduction')
            assertEq(past.line11, 0n, 'and line 11 is the unphased cap, $0.00')
            assertEq(past.line39, 0n)
            assertEq(at.line39, past.line39, 'NO CLIFF at the top of the range')
            // …and one cent BELOW the top, which is still inside the range and
            // must still be inside the phase-in.
            const justInside = comprehensive(run({
                ...soleProprietor,
                netProfitCents: 15000000n,
                taxableIncomeBeforeQbiCents: printedUpperBoundCents - 1n,
            }))
            assertEq(justInside.line22, printedRangeCents - 1n, 'line 22 = $49,999.99')
            assert(justInside.line24 > 0n, 'Part III IS completed one cent inside the range')
            // ONE CENT of deduction survives, not zero, and the arithmetic is
            // the mirror of the bottom end's: 30,000.00 x 4,999,999/5,000,000 =
            // 2,999,999.4 cents of reduction, half-up to 2,999,999, leaving
            // 3,000,000 - 2,999,999 = 1. The phase-in is therefore continuous
            // to the cent at BOTH ends, which is the property this pair exists
            // to state.
            assertEq(justInside.line25, 2999999n, 'line 25 = $29,999.99 of reduction')
            assertEq(justInside.line39, 1n, 'line 39 = $0.01 -- one cent, then zero')
        },
        // **PART III'S SECOND CONDITION**, the one a summary drops: inside the
        // range but with a cap that does NOT bite, Part III is skipped. A
        // proprietor with $400,000.00 of W-2 wages has a $200,000.00 wage limb
        // against a $30,000.00 twenty percent, so line 10 is NOT less than line
        // 3 and there is nothing to phase in -- the full deduction is allowed.
        aCapThatDoesNotBiteSkipsPartIIIEntirely: () => {
            const form = comprehensive(run({
                ...soleProprietor,
                netProfitCents: 15000000n,
                assertedW2Wages: '400000.00',
                taxableIncomeBeforeQbiCents: 22230000n,
            }))
            assertEq(form.line3, 3000000n, 'line 3 = $30,000.00')
            assertEq(form.line5, 20000000n, 'line 5 = $200,000.00 of wage limb')
            assertEq(form.line10, 20000000n, 'line 10 = $200,000.00')
            assert(form.line10 > form.line3, 'the cap does NOT bite')
            assertEq(form.line24, 0n, 'so Part III is skipped even though the income is in range')
            assertEq(form.line19, 0n, 'and line 19 is not computed')
            assertEq(form.line11, 3000000n, 'line 11 = $30,000.00, the smaller of the two')
            assertEq(form.line39, 3000000n, 'line 39 = the whole $30,000.00')
            // THE CONTROL: the same taxable income WITH no wages phases in, so
            // the skip above is about the cap rather than about the income.
            assertEq(
                comprehensive(run({
                    ...soleProprietor,
                    netProfitCents: 15000000n,
                    taxableIncomeBeforeQbiCents: 22230000n,
                })).line39,
                1500000n,
                'and with no wages the same income gives half')
        },
    },

    // ── Schedule A: the SSTB reduction ───────────────────────────────────────
    specifiedServiceTradeOrBusiness: {
        // **THE DOUBLE REDUCTION**, which is what makes Schedule A worth its own
        // form. The same $150,000.00 proprietor with no wages and no property,
        // at the midpoint of the range -- but a consultant.
        //
        //   Schedule A line 7   22,230,000 - 19,730,000            $25,000.00
        //   Schedule A line 8   the range                          $50,000.00
        //   Schedule A line 10  100% - 50%                                50%
        //   Schedule A line 11  50% of 15,000,000                  $75,000.00
        //   Form line 2         Schedule A line 11                 $75,000.00
        //   Form line 3         20% of 7,500,000                   $15,000.00
        //   Form line 10        no wages, no property                   $0.00
        //   Part III line 19    15,000.00 - 0                      $15,000.00
        //   Part III line 25    50% of 15,000.00                    $7,500.00
        //   Part III line 26    15,000.00 - 7,500.00                $7,500.00
        //   line 39                                                 $7,500.00
        //
        // §199A(d)(3) reduces the income and §199A(b)(3)(B) then phases in the
        // wage/UBIA limitation against what is left, so at the midpoint the
        // consultant gets a QUARTER of the $30,000.00 an identical plumber
        // would get unreduced -- half of a half. Both reductions are real and
        // neither is a double count of the other.
        theSstbReductionAndThePhaseInBothApply: () => {
            const form = comprehensive(run({
                ...soleProprietor,
                netProfitCents: 15000000n,
                assertedSpecifiedService: 'specifiedService',
                taxableIncomeBeforeQbiCents: 22230000n,
            }))
            const schedule = form.scheduleA
            assert(schedule !== undefined, ['a consultant above the threshold files Schedule A', form])
            assertEq(schedule.line2, 15000000n, 'Schedule A line 2 = $150,000.00 of QBI')
            assertEq(schedule.line7, 2500000n, 'Schedule A line 7 = $25,000.00 of excess')
            assertEq(schedule.line8, printedRangeCents, 'Schedule A line 8 = $50,000.00')
            assertEq(schedule.line9, 5000n, 'Schedule A line 9 = 50%')
            assertEq(schedule.line10, 5000n, 'Schedule A line 10 = 100% - 50% = 50%')
            assertEq(schedule.line11, 7500000n, 'Schedule A line 11 = $75,000.00 -> form line 2')
            assertEq(form.line2, 7500000n, 'form line 2 receives the REDUCED income')
            assertEq(form.line3, 1500000n, 'form line 3 = $15,000.00, not $30,000.00')
            assertEq(form.line25, 750000n, 'line 25 = $7,500.00 of phase-in reduction')
            assertEq(form.line39, 750000n, 'line 39 = $7,500.00')
            // …against the identical NON-specified-service return, so the
            // reduction is observable rather than merely present.
            const plumber = comprehensive(run({
                ...soleProprietor,
                netProfitCents: 15000000n,
                taxableIncomeBeforeQbiCents: 22230000n,
            }))
            assertEq(plumber.scheduleA, undefined, 'a plumber files no Schedule A')
            assertEq(plumber.line2, 15000000n, 'and keeps the whole $150,000.00')
            assertEq(plumber.line39, 1500000n, '$15,000.00')
            assertEq(plumber.line39 - form.line39, 750000n, '$7,500.00 of deduction the SSTB status costs')
            // …and a quarter of the unreduced $30,000.00, which is the "half of
            // a half" the docstring claims, hand-divided.
            assertEq(3000000n / 4n, 750000n, 'a quarter of $30,000.00 is $7,500.00')
        },
        // ALL THREE Schedule A outputs are scaled, not just the income. A
        // consultant WITH wages: Schedule A line 12 halves the wages before
        // form line 4 ever sees them, so the wage limb halves too.
        //
        //   Schedule A line 3   wages                             $80,000.00
        //   Schedule A line 12  50% of 8,000,000                  $40,000.00
        //   form line 4                                           $40,000.00
        //   form line 5         50% of 4,000,000                  $20,000.00
        //   Schedule A line 4   UBIA                             $500,000.00
        //   Schedule A line 13  50% of 50,000,000                $250,000.00
        //   form line 7                                          $250,000.00
        //   form line 8         2.5% of 25,000,000                 $6,250.00
        //   form line 6         25% of 4,000,000                  $10,000.00
        //   form line 9         10,000.00 + 6,250.00              $16,250.00
        //   form line 10        greater of 20,000.00, 16,250.00   $20,000.00
        //   form line 3         20% of 7,500,000                  $15,000.00
        //   form line 11        smaller of 15,000.00, 20,000.00   $15,000.00
        //
        // The cap no longer bites (line 10 > line 3), so Part III is skipped and
        // the consultant keeps the whole reduced $15,000.00. **Scaling only the
        // income would have left the FULL $40,000.00 wage limb here**, which is
        // the same answer by luck -- so the leaf asserts the scaled wage and
        // UBIA figures directly rather than only the total.
        theWagesAndTheUbiaAreScaledToo: () => {
            const form = comprehensive(run({
                ...soleProprietor,
                netProfitCents: 15000000n,
                assertedSpecifiedService: 'specifiedService',
                assertedW2Wages: '80000.00',
                assertedUnadjustedBasis: '500000.00',
                taxableIncomeBeforeQbiCents: 22230000n,
            }))
            const schedule = form.scheduleA
            assert(schedule !== undefined, ['expected a Schedule A', form])
            assertEq(schedule.line3, 8000000n, 'Schedule A line 3 = $80,000.00 of wages')
            assertEq(schedule.line12, 4000000n, 'Schedule A line 12 = $40,000.00, HALVED')
            assertEq(form.line4, 4000000n, 'form line 4 receives the halved wages')
            assertEq(form.line5, 2000000n, 'so the wage limb is $20,000.00, not $40,000.00')
            assertEq(schedule.line4, 50000000n, 'Schedule A line 4 = $500,000.00 of UBIA')
            assertEq(schedule.line13, 25000000n, 'Schedule A line 13 = $250,000.00, HALVED')
            assertEq(form.line7, 25000000n, 'form line 7 receives the halved UBIA')
            assertEq(form.line8, 625000n, 'so line 8 is $6,250.00, not $12,500.00')
            assertEq(form.line6, 1000000n, 'line 6 = $10,000.00')
            assertEq(form.line9, 1625000n, 'line 9 = $16,250.00')
            assertEq(form.line10, 2000000n, 'line 10 = $20,000.00, the wage limb')
            assertEq(form.line11, 1500000n, 'line 11 = $15,000.00, the smaller')
            assertEq(form.line39, 1500000n, 'line 39 = $15,000.00')
        },
        // **ABOVE THE RANGE AN SSTB GETS NOTHING**, which is Schedule A's own
        // header sentence: "If your taxable income is more than $247,300
        // ($494,600 if married filing jointly), your specified service trade or
        // business doesn't qualify for the deduction."
        //
        // It falls out of the applicable percentage's floor rather than a
        // separate branch: range - excess goes negative and is floored at zero.
        aSpecifiedServiceBusinessAboveTheRangeGetsNothing: () => {
            const form = comprehensive(run({
                ...soleProprietor,
                netProfitCents: 15000000n,
                assertedSpecifiedService: 'specifiedService',
                assertedW2Wages: '400000.00',
                assertedUnadjustedBasis: '1000000.00',
                taxableIncomeBeforeQbiCents: printedUpperBoundCents + 1n,
            }))
            const schedule = form.scheduleA
            assert(schedule !== undefined, ['expected a Schedule A', form])
            assertEq(schedule.line10, 0n, 'the applicable percentage is 0%')
            assertEq(schedule.line11, 0n, 'so no qualified business income qualifies')
            assertEq(schedule.line12, 0n, 'nor any wages')
            assertEq(schedule.line13, 0n, 'nor any UBIA')
            assertEq(form.line39, 0n, 'line 39 = $0.00 -- "doesn\'t qualify for the deduction"')
            // …and the CONTROL, which is what says the zero above is about the
            // SSTB status and not about the income: an identical
            // non-specified-service business at the same income, with the same
            // $400,000.00 of wages, keeps the whole $30,000.00.
            assertEq(
                comprehensive(run({
                    ...soleProprietor,
                    netProfitCents: 15000000n,
                    assertedW2Wages: '400000.00',
                    assertedUnadjustedBasis: '1000000.00',
                    taxableIncomeBeforeQbiCents: printedUpperBoundCents + 1n,
                })).line39,
                3000000n,
                'a plumber with the same wages at the same income keeps $30,000.00')
        },
        // BELOW the threshold an SSTB is a qualified trade or business like any
        // other -- §199A(d)(3) reduces nothing there -- so no Schedule A is
        // filed and the deduction is identical to a plumber's. This is the
        // reading Phase 28 relied on when it declined to store the field, and
        // it is still true.
        belowTheThresholdBeingAnSstbChangesNothing: () => {
            const consultant = deduction(run({
                ...soleProprietor,
                netProfitCents: 5000000n,
                assertedSpecifiedService: 'specifiedService',
                taxableIncomeBeforeQbiCents: 12000000n,
            }))
            const plumber = deduction(run({
                ...soleProprietor,
                netProfitCents: 5000000n,
                taxableIncomeBeforeQbiCents: 12000000n,
            }))
            assertEq(consultant, plumber, 'identical below the threshold')
            assertEq(consultant, 1000000n, '$10,000.00 = 20% of $50,000.00')
            assertEq(
                simplified(run({
                    ...soleProprietor,
                    netProfitCents: 5000000n,
                    assertedSpecifiedService: 'specifiedService',
                    taxableIncomeBeforeQbiCents: 12000000n,
                })).line15,
                1000000n,
                'and it came from Form 8995, not Form 8995-A')
        },
        // The applicable percentage is applied as an EXACT ratio, never by
        // multiplying by the rounded percentage in its own printed box. At
        // $19,730,001 of taxable income the applicable percentage is
        // 4,999,999/5,000,000 -- which rounds to 10,000 basis points, a flat
        // 100% -- and a million dollars of qualified business income times the
        // ROUNDED figure would be the whole $1,000,000.00, while the exact ratio
        // is $999,999.80.
        //
        //   100,000,000 x 4,999,999 / 5,000,000 = 99,999,980 cents
        //
        // Twenty cents, on one business, from one rounding. The printed box is
        // reported and not read back.
        theApplicablePercentageIsNotRoundTrippedThroughItsOwnPrintedBox: () => {
            const form = comprehensive(run({
                ...soleProprietor,
                netProfitCents: 100000000n,
                assertedSpecifiedService: 'specifiedService',
                taxableIncomeBeforeQbiCents: printedThresholdCents + 1n,
            }))
            const schedule = form.scheduleA
            assert(schedule !== undefined, ['expected a Schedule A', form])
            assertEq(schedule.line2, 100000000n, '$1,000,000.00 of qualified business income')
            assertEq(schedule.line10, 10000n, 'the printed box rounds to a flat 100%')
            assertEq(
                schedule.line11, 99999980n,
                'but line 11 is $999,999.80 -- the EXACT 4,999,999/5,000,000')
            assert(
                schedule.line11 < schedule.line2,
                ['a rounded 100% would have left the income untouched', schedule])
            assertEq(schedule.line2 - schedule.line11, 20n, 'twenty cents of difference')
        },
    },

    // ── The refusal, and the controls that keep it narrow ────────────────────
    refusal: {
        // **EACH MISSING FACT IS NAMED**, and the message names the field a
        // taxpayer sets rather than only the form that needs it.
        eachUnstatedFactIsRefusedByName: () => {
            const all = refusal(run({
                ...soleProprietor,
                netProfitCents: 30000000n,
                assertedSpecifiedService: undefined,
                assertedW2Wages: undefined,
                assertedUnadjustedBasis: undefined,
                taxableIncomeBeforeQbiCents: 30000000n,
            }))
            for (const field of [
                'specifiedServiceTradeOrBusiness', 'w2Wages',
                'unadjustedBasisOfQualifiedProperty',
            ]) {
                assert(all.message.includes(field), ['must name the field', field, all.message])
            }
            assert(all.message.includes('§199A(b)(2)(B)'), ['the wage/UBIA cap', all.message])
            assert(all.message.includes('§199A(d)(3)'), ['the SSTB phase-out', all.message])
            assert(
                all.message.includes('understates the tax') && all.message.includes('overstates it'),
                ['must name BOTH directions the error could run', all.message])
            assert(all.message.includes('3 fact(s)'), ['must count them', all.message])
            // ONE missing fact names ONE field, so the message is not a fixed
            // list that happens to contain everything -- and the two that WERE
            // asserted are not named, which is the half a `includes` check on
            // the full list cannot see.
            const onlyWages = refusal(run({
                ...soleProprietor,
                netProfitCents: 30000000n,
                assertedW2Wages: undefined,
                taxableIncomeBeforeQbiCents: 30000000n,
            }))
            assert(onlyWages.message.includes('w2Wages'), ['names the missing one', onlyWages.message])
            assertEq(
                onlyWages.message.includes('unadjustedBasisOfQualifiedProperty'), false,
                'and NOT the one that was asserted')
            assert(onlyWages.message.includes('1 fact(s)'), ['counts one', onlyWages.message])
            // …and the SSTB half names what the two answers are, so a reader
            // knows what to write.
            const onlySstb = refusal(run({
                ...soleProprietor,
                netProfitCents: 30000000n,
                assertedSpecifiedService: undefined,
                taxableIncomeBeforeQbiCents: 30000000n,
            }))
            assert(
                onlySstb.message.includes('"specifiedService"')
                    && onlySstb.message.includes('"notSpecifiedService"'),
                ['must say what to store', onlySstb.message])
            assertEq(onlySstb.message.includes('w2Wages'), false)
        },
        // **THE CONTROL THAT KEEPS PHASE 28 WHOLE.** Below the threshold none of
        // the three facts is read, because printed line 3 skips every line that
        // would read them -- so a return stored before Phase 31 computes exactly
        // as it did, with no new refusal.
        belowTheThresholdNothingIsRequired: () => {
            const form = simplified(run({
                ...soleProprietor,
                netProfitCents: 5000000n,
                deductibleHalfOfSelfEmploymentTaxCents: 353239n,
                selfEmployedHealthInsuranceDeductionCents: 0n,
                assertedSpecifiedService: undefined,
                assertedW2Wages: undefined,
                assertedUnadjustedBasis: undefined,
                taxableIncomeBeforeQbiCents: 12000000n,
            }))
            assertEq(form.line15, 929352n, '$9,293.52, exactly Phase 28\'s answer')
        },
        // …and at the threshold EXACTLY, which is the boundary a strict-versus-
        // inclusive slip would move.
        atTheThresholdExactlyNothingIsRequired: () => {
            assertEq(
                deduction(run({
                    ...soleProprietor,
                    netProfitCents: 5000000n,
                    assertedSpecifiedService: undefined,
                    assertedW2Wages: undefined,
                    assertedUnadjustedBasis: undefined,
                    taxableIncomeBeforeQbiCents: printedThresholdCents,
                })),
                1000000n,
                '$10,000.00 at the threshold, no assertions needed')
            // ONE CENT above it, the same return refuses -- the boundary pair.
            assert(
                refusal(run({
                    ...soleProprietor,
                    netProfitCents: 5000000n,
                    assertedSpecifiedService: undefined,
                    assertedW2Wages: undefined,
                    assertedUnadjustedBasis: undefined,
                    taxableIncomeBeforeQbiCents: printedThresholdCents + 1n,
                })).message.includes('specifiedServiceTradeOrBusiness'),
                'one cent above, the SSTB question has to be answered')
        },
        // **THE CONTROL THAT MATTERS MOST**, unchanged from Phase 28: a filer
        // far above the threshold with NO qualified business income computes,
        // and their 1040 line 13a is $0.00. A $500,000.00 wage earner never
        // needed either form.
        aHighIncomeReturnWithNoBusinessIsUntouched: () => {
            assertEq(
                deduction(run({
                    ...soleProprietor,
                    netProfitCents: 0n,
                    assertedPriorYearLossCarryforward: undefined,
                    assertedSpecifiedService: undefined,
                    assertedW2Wages: undefined,
                    assertedUnadjustedBasis: undefined,
                    taxableIncomeBeforeQbiCents: 50000000n,
                })),
                0n,
                '$500,000.00 of taxable income, no business, no refusal and no deduction')
        },
        // The carryforward guard runs FIRST, so a return missing both is told
        // about the carryforward -- one refusal at a time, and the same order
        // Phase 28 chose for its own two.
        theCarryforwardIsAskedForBeforeFormEightNineNineFiveAsThreeFacts: () => {
            const result = refusal(run({
                ...soleProprietor,
                netProfitCents: 30000000n,
                assertedPriorYearLossCarryforward: undefined,
                assertedSpecifiedService: undefined,
                assertedW2Wages: undefined,
                assertedUnadjustedBasis: undefined,
                taxableIncomeBeforeQbiCents: 30000000n,
            }))
            assert(
                result.message.includes('§199A(c)(2)'),
                ['the carryforward comes first', result.message])
            assertEq(
                result.message.includes('specifiedServiceTradeOrBusiness'), false,
                'and the three facts wait their turn')
        },
        // A REAL carryforward still reduces the deduction above the threshold,
        // which is the one place Form 8995-A folds Form 8995 line 3 into its own
        // line 2 rather than printing it. $300,000.00 of income less an
        // $80,000.00 carryforward is $220,000.00, and 20% of that is $44,000.00
        // -- capped at the $25,000.00 UBIA limb, so this leaf checks line 2 and
        // line 3 rather than the total.
        aPriorYearLossReducesTheIncomeOnLineTwo: () => {
            const form = comprehensive(run({
                ...soleProprietor,
                netProfitCents: 30000000n,
                assertedPriorYearLossCarryforward: '80000.00',
                assertedUnadjustedBasis: '1000000.00',
                taxableIncomeBeforeQbiCents: 30000000n,
            }))
            assertEq(form.line2, 22000000n, 'line 2 = $220,000.00 after the carryforward')
            assertEq(form.line3, 4400000n, 'line 3 = $44,000.00')
            assertEq(form.line39, 2500000n, 'line 39 = $25,000.00, the UBIA limb still capping')
            // …and WITHOUT the carryforward line 2 is the whole amount, so the
            // subtraction is observable even though the total is unchanged.
            const none = comprehensive(run({
                ...soleProprietor,
                netProfitCents: 30000000n,
                assertedUnadjustedBasis: '1000000.00',
                taxableIncomeBeforeQbiCents: 30000000n,
            }))
            assertEq(none.line2, 30000000n, 'line 2 = $300,000.00 without it')
            assertEq(none.line2 - form.line2, 8000000n, '$80,000.00 apart')
            assertEq(none.line39, form.line39, 'and the same $25,000.00 out, because the cap binds')
        },
    },

    // ── §199A(b)(1)(B)'s second component, on the COMPREHENSIVE page ────────
    reitDividends: {
        // **THE COMPONENT THAT BYPASSES EVERYTHING ABOVE IT.** The consultant
        // of `aSpecifiedServiceBusinessAboveTheRangeGetsNothing` — a specified
        // service trade or business past the top of the phase-in range, whose
        // business is allowed $0.00 — still gets 20% of their REIT dividends,
        // because §199A(d)(3) reduces lines 2-16 and never touches line 28.
        //
        //   line 16/27  the SSTB, phased out entirely            $0.00
        //   line 28     box 5, §199A dividends              $1,000.00
        //   line 30     28 + 29, floored                    $1,000.00
        //   line 31     20% of 100,000                         $200.00
        //   line 32     27 + 31                                $200.00
        //   line 36     20% of 30,000,000                   $60,000.00
        //   line 39     the SMALLER of 32 and 36               $200.00
        aSpecifiedServiceBusinessAllowedNothingStillGetsTheReitComponent: () => {
            const form = comprehensive(run({
                ...soleProprietor,
                netProfitCents: 30000000n,
                assertedSpecifiedService: 'specifiedService',
                qualifiedReitDividendsCents: 100000n,
                taxableIncomeBeforeQbiCents: 30000000n,
            }))
            assertEq(form.line16, 0n, 'the SSTB is allowed nothing at all')
            assertEq(form.line27, 0n, 'so line 27 is $0.00')
            assertEq(form.line28, 100000n, 'line 28 = $1,000.00 of qualified REIT dividends')
            assertEq(form.line30, 100000n, 'line 30 = $1,000.00')
            assertEq(form.line31, 20000n, 'line 31 = $200.00 = 20% of $1,000.00')
            assertEq(form.line32, 20000n, 'line 32 = $200.00')
            assertEq(form.line39, 20000n, 'line 39 = $200.00 -> 1040 line 13a')
            // THE CONTROL: the identical return without the box gets nothing,
            // so the $200.00 above is the REIT component rather than something
            // Part II failed to phase out.
            assertEq(
                deduction(run({
                    ...soleProprietor,
                    netProfitCents: 30000000n,
                    assertedSpecifiedService: 'specifiedService',
                    taxableIncomeBeforeQbiCents: 30000000n,
                })),
                0n,
                'without box 5, nothing at all')
        },
        // **THE WAGE/UBIA CAP DOES NOT TOUCH IT EITHER.** A non-specified-service
        // business with no employees and no qualified property: §199A(b)(2)(B)
        // caps its component at $0.00, and the REIT component is unmoved.
        theWageAndUbiaCapDoesNotReachLineTwentyEight: () => {
            const form = comprehensive(run({
                ...soleProprietor,
                netProfitCents: 30000000n,
                assertedSpecifiedService: 'notSpecifiedService',
                qualifiedReitDividendsCents: 100000n,
                taxableIncomeBeforeQbiCents: 30000000n,
            }))
            assertEq(form.line10, 0n, 'both limbs of the cap are zero')
            assertEq(form.line11, 0n, 'so the business component is capped to nothing')
            assertEq(form.line31, 20000n, 'and the REIT component is still $200.00')
            assertEq(form.line39, 20000n, 'line 39 = $200.00')
        },
        // **THE TWO FORMS MUST NOT DISAGREE ABOUT THIS COMPONENT.** The same
        // $1,000.00 of box 5 with no business at all: below the threshold the
        // router fills Form 8995 and above it Form 8995-A, and both must
        // produce $200.00 to the cent. A page-specific transcription error is
        // invisible from either side alone — this is the only leaf that can see
        // it, and it is the reason line 28 had to be wired in the same commit
        // as line 6.
        bothFormsProduceTheSameReitComponent: () => {
            /** @type {(taxableIncomeBeforeQbiCents: bigint) => QualifiedBusinessIncomeDeductionOutcome} */
            const withDividend = taxableIncomeBeforeQbiCents => run({
                ...soleProprietor,
                qualifiedReitDividendsCents: 100000n,
                taxableIncomeBeforeQbiCents,
            })
            // Below the threshold: Form 8995 line 15.
            const below = withDividend(4925000n)
            assertEq(simplified(below).line9, 20000n, 'Form 8995 line 9 = $200.00')
            assertEq(deduction(below), 20000n, '$200.00 through the simplified page')
            // Above it: Form 8995-A line 39, at $250,000.00 of taxable income
            // before §199A -- past the printed $247,300.00 upper bound, so no
            // phase-in applies and the comparison is of the component alone.
            const above = withDividend(25000000n)
            assert(25000000n > printedUpperBoundCents, 'the fixture really is past the range')
            assertEq(comprehensive(above).line31, 20000n, 'Form 8995-A line 31 = $200.00')
            assertEq(deduction(above), 20000n, '$200.00 through the comprehensive page')
            assertEq(deduction(below), deduction(above), 'the two pages must agree to the cent')
            // …and the AT-THE-BOUNDARY pair, one cent apart, where the router
            // switches pages: the deduction must not jump.
            assertEq(deduction(withDividend(printedThresholdCents)), 20000n)
            assertEq(deduction(withDividend(printedThresholdCents + 1n)), 20000n)
            assertEq(
                simplified(withDividend(printedThresholdCents)).line15,
                comprehensive(withDividend(printedThresholdCents + 1n)).line39,
                'one cent of taxable income must not change the REIT deduction')
        },
    },

    // ── The structural zeros and the shape of the record ────────────────────
    theReitPtpAndPatronLinesAreStructuralZeros: () => {
        const form = comprehensive(run({
            ...soleProprietor,
            netProfitCents: 30000000n,
            assertedUnadjustedBasis: '1000000.00',
            taxableIncomeBeforeQbiCents: 30000000n,
        }))
        assertEq(form.line28, 0n, 'line 28 = $0.00 -- no 1099-DIV reported box 5')
        assertEq(form.line29, 0n, 'line 29 = $0.00, and it is structural: only a PTP LOSS could carry in')
        assertEq(form.line30, 0n, 'line 30 = $0.00')
        assertEq(form.line31, 0n, 'line 31 = $0.00')
        assertEq(form.line40, 0n, 'line 40 = $0.00, the opposite floor from line 30\'s')
        assertEq(form.line14, 0n, 'line 14 = $0.00 -- no Form 1099-PATR is read')
        assertEq(form.line38, 0n, 'line 38 = $0.00 -- no §199A(g) DPAD')
        // Line 32 still ADDS line 31 and line 39 still adds line 38, so the day
        // either acquires a reader it reaches the deduction with no edit here.
        assertEq(form.line32, form.line27 + form.line31, 'line 32 adds BOTH components')
        assertEq(form.line39, form.line37 + form.line38, 'line 39 adds the DPAD')
        assertEq(form.line15, form.line13 - form.line14, 'line 15 subtracts the patron reduction')
        assert(form.line27 > 0n, 'the control: line 27 is a real amount, so the sums are observable')
    },
    // Hand-typed field-count guard, this project's mutation-gate idiom: a line
    // dropped from the returned record fails here even though every leaf above
    // reads only the lines it names. Lines 2-40 is thirty-nine printed lines,
    // plus `scheduleA` = forty fields. Line 1's columns are a name, a TIN and
    // three checkboxes, and carry no money.
    everyPrintedLineIsNamed: () => {
        const form = comprehensive(run({
            ...soleProprietor,
            netProfitCents: 30000000n,
            taxableIncomeBeforeQbiCents: 30000000n,
        }))
        const expectedFieldCount = 40
        assertEq(
            Object.keys(form).length,
            expectedFieldCount,
            ['expected 39 printed lines plus the Schedule A', Object.keys(form)],
        )
        // …and Schedule A's own twelve, lines 2 through 13.
        const schedule = scheduleA(phaseInPosition(taxParams2025)('single')(22230000n))({
            qualifiedBusinessIncomeCents: 15000000n,
            w2WagesCents: 0n,
            unadjustedBasisCents: 0n,
            taxableIncomeBeforeQbiCents: 22230000n,
        })
        assertEq(
            Object.keys(schedule).length, 12,
            ['expected exactly 12 named Schedule A fields', Object.keys(schedule)])
    },
    // A return with no business at all: every line zero, no refusal, and no
    // Schedule A. The degenerate input, and the statement that this form cannot
    // invent a deduction out of nothing either.
    noBusinessIsZeroEverywhere: () => {
        const outcome = run(soleProprietor)
        assertEq(deduction(outcome), 0n, 'no deduction')
        // …and it went through Form 8995, because $0.00 of taxable income is
        // below the threshold.
        assertEq(simplified(outcome).line15, 0n)
    },
    // The joint threshold and the joint RANGE are both doubled, and a
    // qualifying surviving spouse gets NEITHER -- the same trap `fjs/form8995`
    // pins for the threshold, now with a second figure that could be copied from
    // the wrong row. At $400,000.00 of taxable income a joint filer is still
    // below their $394,600.00 threshold... and above it, so this uses
    // $394,600.01 through $494,600.00 to place the joint phase-in.
    theJointRangeIsDoubledAndASurvivingSpouseGetsNeither: () => {
        /** @type {(status: IndividualFilingStatus) => (taxableIncomeBeforeQbiCents: bigint) => QualifiedBusinessIncomeDeductionOutcome} */
        const at = status => taxableIncomeBeforeQbiCents => run({
            ...soleProprietor,
            status,
            netProfitCents: 15000000n,
            taxableIncomeBeforeQbiCents,
        })
        // The joint MIDPOINT: 39,460,000 + 5,000,000 = 44,460,000, half of the
        // $100,000.00 joint range -- so exactly half the deduction, the same
        // shape as the single midpoint at $22,230,000.
        const joint = comprehensive(at('marriedFilingJointly')(44460000n))
        assertEq(joint.line21, 39460000n, 'line 21 = $394,600.00')
        assertEq(joint.line23, 10000000n, 'line 23 = $100,000.00, DOUBLE')
        assertEq(joint.line24, 5000n, 'line 24 = 50%')
        assertEq(joint.line39, 1500000n, 'line 39 = $15,000.00, half of $30,000.00')
        // A surviving spouse at the SAME income is far past their own
        // $247,300.00 upper bound, so their cap of zero applies whole.
        assertEq(deduction(at('qualifyingSurvivingSpouse')(44460000n)), 0n)
        const survivor = comprehensive(at('qualifyingSurvivingSpouse')(44460000n))
        assertEq(survivor.line21, 0n, 'Part III is not completed at all -- past the range')
        assertEq(survivor.line39, 0n, '$0.00, against a joint filer\'s $15,000.00')
        // …and the joint UPPER BOUND is where the doubled range puts it:
        // 39,460,000 + 10,000,000 = 49,460,000.
        assertEq(deduction(at('marriedFilingJointly')(49460000n)), 0n, 'fully phased in at $494,600.00')
        assert(
            deduction(at('marriedFilingJointly')(49460000n - 1n)) === 0n,
            'and one cent inside it, already zero')
        // THE CONTROL: one cent above the joint threshold still computes the
        // whole deduction, so the zeros above are the range's doing.
        //
        // And the DOUBLED range shows up in the rounding, which is a detail
        // worth pinning: 30,000.00 x 1/10,000,000 = 0.3 cents of reduction,
        // half-up to ZERO, so a joint filer one cent over keeps all $30,000.00.
        // The single filer one cent over their own threshold loses a cent,
        // because 30,000.00 x 1/5,000,000 = 0.6 rounds the other way.
        assertEq(deduction(at('marriedFilingJointly')(39460001n)), 3000000n, 'the whole $30,000.00')
        assertEq(
            deduction(at('single')(printedThresholdCents + 1n)), 2999999n,
            'against $29,999.99 for a single filer one cent over theirs')
    },
}
