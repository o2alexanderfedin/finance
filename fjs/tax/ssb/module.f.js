/**
 * The Social Security Benefits Worksheet — Lines 6a and 6b
 * (i1040gi.pdf (2025) p32), all 18 printed lines, transcribed line for
 * line and computed over integer cents. This is Phase 13 Wave 1's
 * foundation for TAX-10: it computes 1040 line 6b (taxable Social Security
 * benefits) from already-computed 1040 income lines, the filing status,
 * and the two IRC §86(c) base-amount pairs stored in `fjs/tax/params`.
 *
 * ## It has EIGHTEEN lines, not nineteen
 *
 * `[VERIFIED: i1040gi.pdf (2025) p32]` — lines 1 through 18, no lettered
 * sub-lines. Some planning prose elsewhere in this project still says
 * "19-line" (13-CONTEXT.md Decision 5.3/13-RESEARCH.md Contradiction A);
 * that prose is corrected in Plan 13-13, not here. This module's own
 * `expectedWorksheetLineCount` and its count-guard proof are the mechanical
 * enforcement that the number actually shipped is 18.
 *
 * ## Line 4's add-back is the point of this worksheet
 *
 * Line 4 adds BACK tax-exempt interest (1040 line 2a) into the combined-
 * income measure at line 5 — the reason taxable Social Security is not
 * simply "85% of benefits": a filer with substantial tax-exempt municipal
 * bond interest and no other income can still owe tax on Social Security
 * benefits, because line 4 pulls that interest into the computation even
 * though it never appears in taxable income itself. Omitting this add-back
 * is the naive, wrong implementation this worksheet exists to make
 * impossible; `criterion2NearCircularCaseWithTaxExemptInterestAddBack`
 * below proves it is load-bearing by showing line 18 CHANGE when line 4 is
 * zeroed on an otherwise-identical fixture.
 *
 * ## Line 8's THREE-way branch — corrected against 13-RESEARCH.md, not the
 * plan's own paraphrase
 *
 * The printed page's line 8 is not "a base amount, or a third base amount
 * for MFS living with spouse." A taxpayer who is married filing separately
 * and lived with their spouse at any time in the year skips lines 8
 * through 15 ENTIRELY and computes line 16 directly as 85% of LINE 7 (not
 * line 1) before rejoining the worksheet at line 17. This is
 * `[VERIFIED: i1040gi.pdf (2025) p32]`'s own transcription
 * (13-RESEARCH.md §2), and it is also the value the worksheet's own general
 * formula converges to if line 8 and line 10 (the two base-amount
 * thresholds) are mechanically set to zero: with `line8 = 0`, `line9 =
 * line7` (since line7 > 0 defeats the STOP), `line10 = 0`, `line11 =
 * line9 = line7`, `line12 = min(line9, line10) = 0`, `line13 = line14 =
 * 0`, and `line15 = line11 * 85% = line7 * 85%`, so `line16 = line14 +
 * line15 = line7 * 85%` — exactly the shortcut the printed page states.
 * 13-01-PLAN.md's own task text says "line1 x 85%" for this branch; that
 * is a transcription slip against its own upstream research (which this
 * module's docstring and its own instructions require trusting over a
 * recalled or paraphrased figure — see the executor's governing prompt).
 * `mfsLivedWithSpouseSkipsToLineSixteenAsEightyFivePercentOfLineSeven`
 * below pins the corrected relationship with a fixture where line 7 and
 * line 1 are deliberately DIFFERENT, so the two candidate formulas cannot
 * coincidentally agree.
 *
 * ## Line 6 is caller-supplied, never computed here
 *
 * Line 6 (Schedule 1 lines 11-20, 23, and 25, total) is threaded in as
 * `scheduleOneAdjustmentsTotalCents` rather than computed inside this
 * module.
 *
 * **That prediction came true in Phase 24, and this paragraph is its
 * correction.** It read, until 2026-08-16: *"In this phase's Wave 1 slice,
 * Schedule 1 adjustments stay unmodeled-refused (13-CONTEXT.md Decisions
 * 3.2/6.1), so every real caller passes `0n` here today — but the field
 * exists and is genuinely read, rather than hardcoded, so a later wave that
 * wires Schedule 1 needs no change to this module at all."* TAX-23/TAX-24
 * wired Schedule 1 Part II lines 11, 13 and 21, and this module needed no
 * change: `fjs/form1040/core` now passes
 * `socialSecurityWorksheetAdjustmentsTotal(...)`, a real figure. A docstring
 * that quotes a finding inherits its expiry (`fjs/schedule/1`'s own header
 * makes the same point about the same phase), so the claim is corrected here
 * rather than left to be believed.
 *
 * **Line 21 is deliberately OUTSIDE the range this line sums**, and that is
 * what makes the whole computation orderable rather than circular: the
 * student loan interest deduction's own worksheet takes 1040 line 9 as its
 * input, line 9 includes this worksheet's own output, and the cycle would
 * close if the printed range were "11 through 21" instead of "11 through 20,
 * and 23 and 25". See `fjs/schedule/1`'s own header for the argument in
 * full.
 *
 * ## `socialSecurityCombinedIncome` — one of TAX-15's four named income
 * functions
 *
 * Line 5's own shape (half of benefits, plus other income, plus tax-exempt
 * interest) is exported as its own named function,
 * {@link socialSecurityCombinedIncome}, per 13-CONTEXT.md Decision 3.5 —
 * this is the genuinely different, non-AGI-shaped income measure among this
 * phase's four (13-RESEARCH.md §6); the other three (senior-deduction,
 * SALT-cap, and CTC/ODC phase-out income) all read bare AGI plus foreign
 * add-backs and are Plan 13-02 onward's job, not this one's.
 *
 * ## Why a record and not an array
 *
 * Same reason as `fjs/tax/line16/qdcgt`: `noUncheckedIndexedAccess` makes
 * an array index `bigint | undefined`, and a record indexes cleanly with
 * the printed line numbers carried in the field names (TAX-15).
 *
 * ## Rounding
 *
 * Lines 2, 13, 15, and 17 are the lines that can create a fractional cent
 * (halving, or multiplying by 85%); each rounds to the CENT via `halfUp`,
 * mirroring `qdcgt`'s own rounding discipline for its 15%/20% lines.
 *
 * ## What this module deliberately does NOT do
 *
 * It does not read stored documents (SSA-1099/RRB-1099 box 5 summation,
 * and the seven-line other-income sum, are both caller-supplied bigints —
 * `fjs/form1040/core`'s job in Plan 13-02) and it does not implement the
 * `iraDeductionDeclared` circularity refusal (13-CONTEXT.md Decision 3.3):
 * that refusal is threaded one level up, before this function is ever
 * called, exactly as `fjs/form1040/core`'s existing error-arm pattern
 * threads the Schedule D absent-basis refusal.
 *
 * @module
 */
import { assert, assertEq } from 'functionalscript/fjs/asserts/module.f.js'
import { of, multiply, halfUp } from '../../types/rational/module.f.js'
import { centsFromString } from '../../exact/module.f.js'
import { taxParamsByYear } from '../params/module.f.js'

/** @import { TaxParamSet, IndividualFilingStatus } from '../params/module.f.js' */

/**
 * Rounds `cents * (percent / 100)` to the nearest cent, ties away from zero
 * (IRS half-up) — the shared shape behind lines 2 ("one-half of line 1"),
 * 13 ("one-half of line 12"), 15 ("line 11 x 85%"), and 17 ("line 1 x
 * 85%"), and the MFS-lived-with-spouse branch's own line 16.
 * @type {(cents: bigint) => (percent: bigint) => bigint}
 */
const percentOfCents = cents => percent => halfUp(multiply(of(cents)(1n))(of(percent)(100n)))

/**
 * Line 5's own shape: "half of benefits" (worksheet line 2) plus "income
 * excluding benefits" (line 3) plus "tax-exempt interest" (line 4) — one of
 * TAX-15's four separately-named income-measure functions
 * (13-CONTEXT.md Decision 3.5), and the one genuinely different shape among
 * them (13-RESEARCH.md §6): every OTHER income measure this phase
 * introduces reads bare AGI plus foreign add-backs; this one does not
 * involve AGI at all.
 *
 * Add-back list, stated here because TAX-15/criterion 5 requires each named
 * income function to state its own: 50% of total Social Security/Railroad
 * Retirement benefits, PLUS the seven other 1040 income lines the
 * worksheet's own line 3 sums (1z, 2b, 3b, 4b, 5b, 7a, 8), PLUS tax-exempt
 * interest (1040 line 2a). Schedule 1 adjustments are NOT part of this
 * add-back list — they are subtracted separately, one worksheet line later,
 * at line 6/line 7.
 * @type {(halfOfBenefitsCents: bigint) => (otherIncomeCents: bigint) => (taxExemptInterestCents: bigint) => bigint}
 */
export const socialSecurityCombinedIncome = halfOfBenefitsCents => otherIncomeCents => taxExemptInterestCents =>
    halfOfBenefitsCents + otherIncomeCents + taxExemptInterestCents

/**
 * Everything the printed worksheet asks the filer to carry onto it, plus
 * the one fact (`mfsLivedWithSpouseAtAnyTimeInYear`) the worksheet's own
 * line 8 branches on that no other 1040 line already carries.
 * @typedef {{
 *   readonly status: IndividualFilingStatus,
 *   readonly mfsLivedWithSpouseAtAnyTimeInYear: boolean,
 *   readonly totalSsaAndRrbBox5Cents: bigint,
 *   readonly otherIncomeLine3Cents: bigint,
 *   readonly taxExemptInterestCents: bigint,
 *   readonly scheduleOneAdjustmentsTotalCents: bigint,
 * }} SsbWorksheetInput
 */

/**
 * The filled-in worksheet: every printed line under its own printed
 * number. In the MFS-lived-with-spouse branch, lines 8 through 15 are
 * skipped by the printed page itself — never filled in — and are returned
 * as `0n` here (the worksheet's own "blank" convention), not because they
 * were computed and happened to be zero.
 * @typedef {{
 *   readonly line1: bigint, readonly line2: bigint, readonly line3: bigint,
 *   readonly line4: bigint, readonly line5: bigint, readonly line6: bigint,
 *   readonly line7: bigint, readonly line8: bigint, readonly line9: bigint,
 *   readonly line10: bigint, readonly line11: bigint, readonly line12: bigint,
 *   readonly line13: bigint, readonly line14: bigint, readonly line15: bigint,
 *   readonly line16: bigint, readonly line17: bigint, readonly line18: bigint,
 * }} SsbWorksheetResult
 */

/**
 * The worksheet's own hand-typed line count — independent of
 * `Object.keys(result).length`, per AGENTS.md's "hand-typed count"
 * discipline: a proof that counted the RETURNED object's own keys could
 * never notice a line silently dropped from both the code and the count in
 * the same edit.
 * @type {18}
 */
export const expectedWorksheetLineCount = 18

/**
 * Fills in the Social Security Benefits Worksheet (i1040gi p32) for one
 * return. Every `const` below is one printed line, in printed order, with
 * the printed instruction quoted above it.
 * @type {(taxParamSet: TaxParamSet) => (input: SsbWorksheetInput) => SsbWorksheetResult}
 */
export const socialSecurityBenefitsWorksheet = taxParamSet => input => {
    const {
        status, mfsLivedWithSpouseAtAnyTimeInYear,
        totalSsaAndRrbBox5Cents, otherIncomeLine3Cents,
        taxExemptInterestCents, scheduleOneAdjustmentsTotalCents,
    } = input
    assert(
        !mfsLivedWithSpouseAtAnyTimeInYear || status === 'marriedFilingSeparately',
        ['mfsLivedWithSpouseAtAnyTimeInYear only applies to marriedFilingSeparately', status],
    )
    const baseAmounts = taxParamSet.socialSecurityBenefitsWorksheetBaseAmounts
    // 1. "Enter the total amount from box 5 of ALL your Forms SSA-1099 and
    //    RRB-1099." Also feeds Form 1040 line 6a. Caller-summed over
    //    stored documents; this module does not read them.
    const line1 = totalSsaAndRrbBox5Cents
    // 2. "Enter one-half of line 1."
    const line2 = percentOfCents(line1)(50n)
    // 3. "Combine the amounts from Form 1040 or 1040-SR, lines 1z, 2b, 3b,
    //    4b, 5b, 7a, and 8." Caller-summed; this module reads only the
    //    total.
    const line3 = otherIncomeLine3Cents
    // 4. "Enter the amount from Form 1040 or 1040-SR, line 2a" — tax-exempt
    //    interest, the add-back a naive implementation omits.
    const line4 = taxExemptInterestCents
    // 5. "Add lines 2, 3, and 4." — socialSecurityCombinedIncome's own
    //    shape, exported separately per TAX-15/13-CONTEXT.md Decision 3.5.
    const line5 = socialSecurityCombinedIncome(line2)(line3)(line4)
    // 6. "Enter the total of the amounts from Schedule 1, lines 11 through
    //    20, and 23 and 25." Caller-supplied — see this module's own
    //    docstring for why it is not computed here.
    const line6 = scheduleOneAdjustmentsTotalCents
    // 7. "Is the amount on line 6 less than the amount on line 5? No.
    //    STOP. None of your benefits are taxable... Yes. Subtract line 6
    //    from line 5."
    const line7 = line6 < line5 ? line5 - line6 : 0n
    // 8. Filing-status base amount — MFJ $32,000, single/HoH/QSS/
    //    MFS-lived-apart-all-year $25,000. MFS-lived-with-spouse-at-any-
    //    time is a genuine THIRD branch that skips lines 8 through 15
    //    entirely; see this module's own docstring for why line 16 there
    //    is 85% of LINE 7, not line 1.
    if (mfsLivedWithSpouseAtAnyTimeInYear) {
        const line16 = percentOfCents(line7)(85n)
        // 17. "Multiply line 1 by 85% (0.85)." Computed the same way in
        //     every branch — it never depends on line 8 or the threshold
        //     comparison at all.
        const line17 = percentOfCents(line1)(85n)
        // 18. "Taxable benefits. Enter the smaller of line 16 or line 17."
        const line18 = line16 < line17 ? line16 : line17
        return {
            line1, line2, line3, line4, line5, line6, line7,
            line8: 0n, line9: 0n, line10: 0n, line11: 0n, line12: 0n,
            line13: 0n, line14: 0n, line15: 0n,
            line16, line17, line18,
        }
    }
    const mfj = status === 'marriedFilingJointly'
    const line8 = centsFromString(
        mfj ? baseAmounts.firstThreshold.marriedFilingJointly.amount : baseAmounts.firstThreshold.other.amount,
    )
    // 9. "Is the amount on line 7 more than the amount on line 8? No.
    //    STOP. None of your benefits are taxable... Yes. Subtract line 8
    //    from line 7."
    const line9 = line7 <= line8 ? 0n : line7 - line8
    // 10. Second threshold — $12,000 MFJ, $9,000 single/HoH/QSS/MFS.
    const line10 = centsFromString(
        mfj ? baseAmounts.secondThreshold.marriedFilingJointly.amount : baseAmounts.secondThreshold.other.amount,
    )
    // 11. "Subtract line 10 from line 9. If zero or less, enter -0-."
    const line11 = line9 - line10 > 0n ? line9 - line10 : 0n
    // 12. "Enter the smaller of line 9 or line 10."
    const line12 = line9 < line10 ? line9 : line10
    // 13. "Enter one-half of line 12."
    const line13 = percentOfCents(line12)(50n)
    // 14. "Enter the smaller of line 2 or line 13."
    const line14 = line2 < line13 ? line2 : line13
    // 15. "Multiply line 11 by 85% (0.85). If line 11 is zero, enter -0-."
    //     No special case needed in code: multiplying zero by 85% is
    //     already zero.
    const line15 = percentOfCents(line11)(85n)
    // 16. "Add lines 14 and 15."
    const line16 = line14 + line15
    // 17. "Multiply line 1 by 85% (0.85)."
    const line17 = percentOfCents(line1)(85n)
    // 18. "Taxable benefits. Enter the smaller of line 16 or line 17."
    const line18 = line16 < line17 ? line16 : line17
    return {
        line1, line2, line3, line4, line5, line6, line7, line8, line9,
        line10, line11, line12, line13, line14, line15, line16, line17, line18,
    }
}

/**
 * TY2025's parameter set, narrowed exactly ONCE at module scope, mirroring
 * `fjs/tax/line16/qdcgt`'s own precedent.
 */
const taxParams2025 = taxParamsByYear[2025]
assert(taxParams2025 !== undefined, 'expected TY2025 parameters to be present in taxParamsByYear')

// ── Tests ────────────────────────────────────────────────────────────────────

/**
 * A neutral MFJ input with every income figure at zero — the base every
 * fixture below overrides from, so each test states only the fields that
 * matter to it.
 * @type {SsbWorksheetInput}
 */
const neutralMfjInput = {
    status: 'marriedFilingJointly',
    mfsLivedWithSpouseAtAnyTimeInYear: false,
    totalSsaAndRrbBox5Cents: 0n,
    otherIncomeLine3Cents: 0n,
    taxExemptInterestCents: 0n,
    scheduleOneAdjustmentsTotalCents: 0n,
}

export const proof = {
    // Test 1 (count guard): exactly 18 named line fields, plus the
    // independently hand-typed `expectedWorksheetLineCount`, asserted
    // separately from `Object.keys(...).length` per AGENTS.md's
    // recurring-defect rule (a proof that iterates a collection derived
    // from the code under test cannot see that collection shrinking).
    exactlyEighteenNamedLineFields: () => {
        const result = socialSecurityBenefitsWorksheet(taxParams2025)(neutralMfjInput)
        const lineFieldCount = Object.keys(result).filter(key => key.startsWith('line')).length
        assertEq(lineFieldCount, 18, 'expected exactly 18 named line fields')
        assertEq(expectedWorksheetLineCount, 18, 'hand-typed independently of Object.keys')
        assertEq(lineFieldCount, expectedWorksheetLineCount, 'the two counts must agree')
    },

    // Test 2 / criterion 2 (13-CONTEXT.md Decision 3.4): a single 65+
    // filer whose combined income lands taxable Social Security in the 85%
    // tier (line 11 > 0) AND who has nonzero tax-exempt interest. Line 18
    // must DIFFER when line 4 (tax-exempt interest) is zeroed on an
    // otherwise-identical fixture — proving the add-back is load-bearing,
    // not merely present. Every expected value below is hand-computed from
    // the worksheet's own printed arithmetic (13-RESEARCH.md §2), never
    // derived from calling this module.
    criterion2NearCircularCaseWithTaxExemptInterestAddBack: () => {
        /** @type {SsbWorksheetInput} */
        const withInterest = {
            status: 'marriedFilingJointly',
            mfsLivedWithSpouseAtAnyTimeInYear: false,
            totalSsaAndRrbBox5Cents: 4000000n, // $40,000.00
            otherIncomeLine3Cents: 2100000n, // $21,000.00
            taxExemptInterestCents: 500000n, // $5,000.00
            scheduleOneAdjustmentsTotalCents: 0n,
        }
        const withInterestResult = socialSecurityBenefitsWorksheet(taxParams2025)(withInterest)
        assertEq(withInterestResult.line1, 4000000n, 'line 1 = $40,000.00')
        assertEq(withInterestResult.line2, 2000000n, 'line 2 = $20,000.00, one-half of line 1')
        assertEq(withInterestResult.line3, 2100000n, 'line 3 = $21,000.00')
        assertEq(withInterestResult.line4, 500000n, 'line 4 = $5,000.00 — the add-back')
        assertEq(withInterestResult.line5, 4600000n, 'line 5 = $46,000.00')
        assertEq(withInterestResult.line6, 0n, 'line 6 = $0.00, no Schedule 1 adjustments this phase')
        assertEq(withInterestResult.line7, 4600000n, 'line 7 = $46,000.00')
        assertEq(withInterestResult.line8, 3200000n, 'line 8 = $32,000.00, MFJ base amount')
        assertEq(withInterestResult.line9, 1400000n, 'line 9 = $14,000.00')
        assertEq(withInterestResult.line10, 1200000n, 'line 10 = $12,000.00, MFJ second threshold')
        assertEq(withInterestResult.line11, 200000n, 'line 11 = $2,000.00 — lands in the 85% tier')
        assert(withInterestResult.line11 > 0n, 'line 11 must be strictly positive for the 85% tier')
        assertEq(withInterestResult.line12, 1200000n, 'line 12 = $12,000.00, smaller of line 9/line 10')
        assertEq(withInterestResult.line13, 600000n, 'line 13 = $6,000.00, one-half of line 12')
        assertEq(withInterestResult.line14, 600000n, 'line 14 = $6,000.00, smaller of line 2/line 13')
        assertEq(withInterestResult.line15, 170000n, 'line 15 = $1,700.00, 85% of line 11')
        assertEq(withInterestResult.line16, 770000n, 'line 16 = $7,700.00')
        assertEq(withInterestResult.line17, 3400000n, 'line 17 = $34,000.00, 85% of line 1')
        assertEq(withInterestResult.line18, 770000n, 'line 18 = $7,700.00 — Form 1040 line 6b')

        /** @type {SsbWorksheetInput} */
        const withoutInterest = { ...withInterest, taxExemptInterestCents: 0n }
        const withoutInterestResult = socialSecurityBenefitsWorksheet(taxParams2025)(withoutInterest)
        assertEq(withoutInterestResult.line4, 0n, 'line 4 = $0.00 with the add-back removed')
        assertEq(withoutInterestResult.line5, 4100000n, 'line 5 = $41,000.00 without the add-back')
        assertEq(withoutInterestResult.line11, 0n, 'line 11 drops to $0.00 without the add-back')
        assertEq(withoutInterestResult.line18, 450000n, 'line 18 = $4,500.00 — a DIFFERENT number without the add-back')

        // The decisive comparison: the add-back changes the taxable amount.
        assert(
            withInterestResult.line18 !== withoutInterestResult.line18,
            [
                'line 18 must differ when tax-exempt interest is zeroed — the add-back is load-bearing',
                withInterestResult.line18,
                withoutInterestResult.line18,
            ],
        )
        assertEq(withInterestResult.line18 - withoutInterestResult.line18, 320000n, 'the add-back is worth exactly $3,200.00 on this fixture')
    },

    // Test 3 (line 8's three branches): MFJ below/above $32,000; single
    // below/above $25,000; MFS-lived-with-spouse skips straight to line 16
    // regardless of the other inputs. Four separate fixtures, not one
    // parameterized loop, since the third branch is structurally different
    // (skips lines 8-15 entirely) — mirroring `qdcgt`'s own Schedule D
    // fork, which is written the same way for the same reason.
    mfjBelowThirtyTwoThousandIsNotTaxable: () => {
        /** @type {SsbWorksheetInput} */
        const input = { ...neutralMfjInput, totalSsaAndRrbBox5Cents: 3000000n } // $30,000.00
        const result = socialSecurityBenefitsWorksheet(taxParams2025)(input)
        assertEq(result.line7, 1500000n, 'line 7 = $15,000.00, below the $32,000.00 MFJ base amount')
        assert(result.line7 < result.line8, 'line 7 must be below line 8 for this fixture to test the "below" branch')
        assertEq(result.line9, 0n, 'line 9 = $0.00 — STOP, line 7 does not exceed line 8')
        assertEq(result.line18, 0n, 'line 18 = $0.00 — no Social Security benefits are taxable')
    },
    mfjAboveThirtyTwoThousandIsPartlyTaxable: () => {
        /** @type {SsbWorksheetInput} */
        const input = {
            ...neutralMfjInput,
            totalSsaAndRrbBox5Cents: 5000000n, // $50,000.00
            otherIncomeLine3Cents: 1000000n, // $10,000.00
        }
        const result = socialSecurityBenefitsWorksheet(taxParams2025)(input)
        assertEq(result.line7, 3500000n, 'line 7 = $35,000.00, above the $32,000.00 MFJ base amount')
        assert(result.line7 > result.line8, 'line 7 must be above line 8 for this fixture to test the "above" branch')
        assertEq(result.line9, 300000n, 'line 9 = $3,000.00 — the excess over line 8')
        assertEq(result.line18, 150000n, 'line 18 = $1,500.00 — some benefits are taxable')
        assert(result.line18 > 0n, 'line 18 must be strictly positive for the "above" branch')
    },
    singleBelowTwentyFiveThousandIsNotTaxable: () => {
        /** @type {SsbWorksheetInput} */
        const input = { ...neutralMfjInput, status: 'single', totalSsaAndRrbBox5Cents: 2000000n } // $20,000.00
        const result = socialSecurityBenefitsWorksheet(taxParams2025)(input)
        assertEq(result.line8, 2500000n, 'line 8 = $25,000.00, the single/HoH/QSS base amount')
        assertEq(result.line7, 1000000n, 'line 7 = $10,000.00, below line 8')
        assertEq(result.line18, 0n, 'line 18 = $0.00 — no Social Security benefits are taxable')
    },
    singleAboveTwentyFiveThousandIsPartlyTaxable: () => {
        /** @type {SsbWorksheetInput} */
        const input = {
            ...neutralMfjInput,
            status: 'single',
            totalSsaAndRrbBox5Cents: 4000000n, // $40,000.00
            otherIncomeLine3Cents: 1000000n, // $10,000.00
        }
        const result = socialSecurityBenefitsWorksheet(taxParams2025)(input)
        assertEq(result.line8, 2500000n, 'line 8 = $25,000.00')
        assertEq(result.line7, 3000000n, 'line 7 = $30,000.00, above line 8')
        assertEq(result.line9, 500000n, 'line 9 = $5,000.00')
        assertEq(result.line10, 900000n, 'line 10 = $9,000.00, the single second threshold')
        assertEq(result.line18, 250000n, 'line 18 = $2,500.00')
        assert(result.line18 > 0n, 'line 18 must be strictly positive for the "above" branch')
    },
    // The MFS-lived-with-spouse branch, corrected against 13-RESEARCH.md
    // (see this module's own docstring): line 16 is 85% of LINE 7, not
    // line 1. The fixture deliberately makes line 7 and line 1 DIFFERENT
    // values so the two candidate formulas cannot coincidentally agree —
    // an equal-looking result here would prove nothing.
    mfsLivedWithSpouseSkipsToLineSixteenAsEightyFivePercentOfLineSeven: () => {
        /** @type {SsbWorksheetInput} */
        const input = {
            status: 'marriedFilingSeparately',
            mfsLivedWithSpouseAtAnyTimeInYear: true,
            totalSsaAndRrbBox5Cents: 3000000n, // $30,000.00 — line 1
            otherIncomeLine3Cents: 500000n, // $5,000.00
            taxExemptInterestCents: 0n,
            scheduleOneAdjustmentsTotalCents: 0n,
        }
        const result = socialSecurityBenefitsWorksheet(taxParams2025)(input)
        assertEq(result.line1, 3000000n, 'line 1 = $30,000.00')
        assertEq(result.line2, 1500000n, 'line 2 = $15,000.00')
        assertEq(result.line5, 2000000n, 'line 5 = $20,000.00')
        assertEq(result.line7, 2000000n, 'line 7 = $20,000.00 — DIFFERENT from line 1')
        assert(result.line7 !== result.line1, 'line 7 and line 1 must differ on this fixture')
        // Lines 8-15 are skipped by the printed page itself — never
        // computed, returned as 0n (the worksheet's own "blank").
        assertEq(result.line8, 0n, 'line 8 is skipped')
        assertEq(result.line9, 0n, 'line 9 is skipped')
        assertEq(result.line10, 0n, 'line 10 is skipped')
        assertEq(result.line11, 0n, 'line 11 is skipped')
        assertEq(result.line12, 0n, 'line 12 is skipped')
        assertEq(result.line13, 0n, 'line 13 is skipped')
        assertEq(result.line14, 0n, 'line 14 is skipped')
        assertEq(result.line15, 0n, 'line 15 is skipped')
        assertEq(result.line16, 1700000n, 'line 16 = $17,000.00, 85% of LINE 7 ($20,000.00)')
        assertEq(result.line17, 2550000n, 'line 17 = $25,500.00, 85% of line 1 ($30,000.00)')
        assert(result.line16 !== result.line17, 'line 16 and line 17 must genuinely differ on this fixture')
        assertEq(result.line18, 1700000n, 'line 18 = $17,000.00, the smaller of line 16/line 17')
    },

    // Test 4 (STOP conditions), each paired with its own control one
    // dollar past the boundary (AGENTS.md: "a gate needs a control").
    line7StopsWhenScheduleOneAdjustmentsAtLeastCoverCombinedIncome: () => {
        /** @type {SsbWorksheetInput} */
        const atBoundary = {
            ...neutralMfjInput,
            totalSsaAndRrbBox5Cents: 1000000n, // $10,000.00 -> line 2 = $5,000.00 = line 5
            scheduleOneAdjustmentsTotalCents: 500000n, // $5,000.00, equal to line 5
        }
        const boundaryResult = socialSecurityBenefitsWorksheet(taxParams2025)(atBoundary)
        assertEq(boundaryResult.line5, 500000n, 'line 5 = $5,000.00')
        assertEq(boundaryResult.line6, 500000n, 'line 6 = $5,000.00, equal to line 5')
        assert(boundaryResult.line6 >= boundaryResult.line5, 'line 6 must be at least line 5 to trigger the STOP')
        assertEq(boundaryResult.line7, 0n, 'line 7 = $0.00 — STOP, benefits not taxable')
        assertEq(boundaryResult.line18, 0n, 'line 18 = $0.00 — the STOP propagates all the way down')

        /** @type {SsbWorksheetInput} */
        const oneDollarPastBoundary = { ...atBoundary, scheduleOneAdjustmentsTotalCents: 499900n } // $4,999.00, one dollar less
        const controlResult = socialSecurityBenefitsWorksheet(taxParams2025)(oneDollarPastBoundary)
        assert(controlResult.line6 < controlResult.line5, 'the control must NOT trigger the STOP')
        assertEq(controlResult.line7, 100n, 'line 7 = $1.00 — the STOP did not fire, real subtraction ran')
        assert(controlResult.line7 > 0n, 'the control must compute a non-zero line 7')
    },
    line9StopsWhenLineSevenDoesNotExceedLineEight: () => {
        /** @type {SsbWorksheetInput} */
        const atBoundary = { ...neutralMfjInput, totalSsaAndRrbBox5Cents: 6400000n } // $64,000.00 -> line 7 = $32,000.00 = line 8
        const boundaryResult = socialSecurityBenefitsWorksheet(taxParams2025)(atBoundary)
        assertEq(boundaryResult.line7, 3200000n, 'line 7 = $32,000.00')
        assertEq(boundaryResult.line8, 3200000n, 'line 8 = $32,000.00, equal to line 7')
        assert(boundaryResult.line7 <= boundaryResult.line8, 'line 7 must not exceed line 8 to trigger the STOP')
        assertEq(boundaryResult.line9, 0n, 'line 9 = $0.00 — STOP, benefits not taxable')
        assertEq(boundaryResult.line18, 0n, 'line 18 = $0.00 — the STOP propagates all the way down')

        /** @type {SsbWorksheetInput} */
        const oneDollarPastBoundary = { ...neutralMfjInput, totalSsaAndRrbBox5Cents: 6400200n } // $64,002.00 -> line 7 = $32,001.00
        const controlResult = socialSecurityBenefitsWorksheet(taxParams2025)(oneDollarPastBoundary)
        assert(controlResult.line7 > controlResult.line8, 'the control must NOT trigger the STOP')
        assertEq(controlResult.line9, 100n, 'line 9 = $1.00 — the STOP did not fire, real subtraction ran')
        assertEq(controlResult.line18, 50n, 'line 18 = $0.50 — a small but genuinely non-zero taxable amount')
        assert(controlResult.line18 > 0n, 'the control must compute a non-zero line 18')
    },

    // `socialSecurityCombinedIncome`'s own shape, tested directly and
    // independently of the whole worksheet.
    socialSecurityCombinedIncomeAddsExactlyThreeTerms: () => {
        assertEq(socialSecurityCombinedIncome(1000000n)(2000000n)(300000n), 3300000n)
        assertEq(socialSecurityCombinedIncome(0n)(0n)(0n), 0n)
    },

    // Input-validation guard: `mfsLivedWithSpouseAtAnyTimeInYear` only
    // makes sense paired with `status: 'marriedFilingSeparately'` — a
    // caller passing it `true` alongside any other status would silently
    // skip the ordinary threshold arithmetic for a filer the printed page
    // never intends that for (Rule 2, missing input validation).
    mfsLivedWithSpouseFlagRefusedForNonMfsStatus: {
        throw: () => {
            /** @type {SsbWorksheetInput} */
            const invalid = { ...neutralMfjInput, mfsLivedWithSpouseAtAnyTimeInYear: true }
            socialSecurityBenefitsWorksheet(taxParams2025)(invalid)
        },
    },
}
