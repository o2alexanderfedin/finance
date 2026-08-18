/**
 * The Qualified Dividends and Capital Gain Tax Worksheet — Line 16
 * (i1040gi.pdf, printed page 38), all 25 printed lines, transcribed
 * line for line and computed over integer cents.
 *
 * This is one of Form 1040 line 16's four methods (TAX-03). It is pulled
 * forward from TAX-08 deliberately (10-CONTEXT.md Decision 1) because
 * ROADMAP criterion 2 asks for a regression proof of the signature
 * line-16 error, and that proof cannot exist without this worksheet
 * actually computing.
 *
 * ## Why line 16 is not bracket arithmetic
 *
 * Lines 22 and 24 call BACK DOWN into the level-3 base lookup
 * (`baseTaxForAmount`), whose Tax Table prices the MIDPOINT of a $25/$50
 * band rather than the income itself. Line 25 then takes the SMALLER of
 * line 23 (the preferential-rate build-up, which contains line 22's
 * quantised ordinary tax) and line 24 (the whole taxable income run
 * through the same quantised table). Those two paths genuinely disagree,
 * by single-digit dollars, and the printed `min` is what resolves the
 * disagreement in the taxpayer's favour.
 *
 * ## The defect this file exists to pin
 *
 * **Omitting line 25's `min`.** Not naive Tax Table use — an engine that
 * simply looks line 1 up in the Tax Table gets both regression cases
 * right, because looking line 1 up in the Tax Table is EXACTLY what line
 * 24 computes and exactly what `min` then selects. A regression proof
 * aimed at "naive Tax Table use" would sit green while the real defect
 * shipped. So the proof below pins the PAIR (two returns one dollar
 * apart, where a min-less engine returns the same number for both and
 * the correct engine returns numbers eleven dollars apart), and pins the
 * opposite case too — the control, where `min` selects line 23 and an
 * engine that always took line 24 would over-tax by $1,200.
 *
 * ## Three easily-missed properties of the printed page
 *
 * 1. **Lines 22 and 24 dispatch INDEPENDENTLY.** Line 5 is never more
 *    than line 1, so line 5 can sit below $100,000 while line 1 is at or
 *    above it. One execution of one worksheet can therefore legitimately
 *    use the Tax Table for line 22 and the Tax Computation Worksheet for
 *    line 24. `baseTaxForAmount` is called twice, with different
 *    amounts, and BOTH method tags are kept. An implementation that
 *    decides "table or worksheet" once, from line 15, is wrong for every
 *    return above $100,000 whose preferential slice is big enough to
 *    pull line 5 under it.
 * 2. **Only lines 5 and 16 carry a printed "-0-" floor.** Lines 9, 12
 *    and 20 have no floor on the page and cannot go negative given the
 *    `min`s above them. They are written here WITHOUT a floor, with an
 *    `assert` instead: a defensive floor would absorb a transcription
 *    error and leave the value merely wrong, where the assert turns the
 *    same error into a loud refusal (a bare thrown value, never an
 *    `Error` — AGENTS.md).
 * 3. **Line 11 is a pure copy of line 9.** It exists on paper so a human
 *    need not look back up the page. It is kept anyway, because a
 *    line-for-line diff against the printed worksheet is only possible
 *    if every printed line exists (TAX-15).
 *
 * ## Why a record and not an array
 *
 * `tsconfig.json` sets `noUncheckedIndexedAccess`, so an array of 25
 * would yield `bigint | undefined` at every index, and the only ways out
 * of that are a cast or a non-null assertion, both banned outright by
 * AGENTS.md. A record indexes cleanly — and TAX-15 wants the printed
 * line numbers carried in the names anyway.
 *
 * ## Rounding
 *
 * Lines 18 and 21 are the only two lines that can create a fractional
 * cent, and they round to the CENT via `halfUp`, because a worksheet
 * line is a line boundary (EXACT-04). Whole dollars are the taxpayer's
 * separate Form 1040 p23 election, applied once over the whole report,
 * never here.
 *
 * @module
 */
import { assert, assertEq } from 'functionalscript/fjs/asserts/module.f.js'
import { of, multiply, halfUp } from '../../../types/rational/module.f.js'
import { centsFromString } from '../../../exact/module.f.js'
import { taxParamsByYear } from '../../params/module.f.js'
import { baseTaxForAmount } from '../../table/module.f.js'

/** @import { TaxParamSet, IndividualFilingStatus } from '../../params/module.f.js' */
/** @import { Line16BaseMethod } from '../../table/module.f.js' */

/**
 * Everything the printed worksheet asks the filer to carry onto it.
 *
 * `scheduleD15Cents` and `scheduleD16Cents` are read only when
 * `filingScheduleD` is `true`, and `line7aCents` only when it is
 * `false` — that is the printed line-3 fork, kept as a fork rather than
 * collapsed into one optional field, so the two sides cannot be
 * confused at a call site.
 * @typedef {{
 *   readonly status: IndividualFilingStatus,
 *   readonly line1Cents: bigint,
 *   readonly line2Cents: bigint,
 *   readonly filingScheduleD: boolean,
 *   readonly scheduleD15Cents: bigint,
 *   readonly scheduleD16Cents: bigint,
 *   readonly line7aCents: bigint,
 * }} QdcgtInput
 */

/**
 * The filled-in worksheet: every printed line under its own printed
 * number, plus the two method tags recording which base method priced
 * line 22 and which priced line 24. The tags are separate fields
 * precisely because they can differ within one execution.
 * @typedef {{
 *   readonly line1: bigint, readonly line2: bigint, readonly line3: bigint,
 *   readonly line4: bigint, readonly line5: bigint, readonly line6: bigint,
 *   readonly line7: bigint, readonly line8: bigint, readonly line9: bigint,
 *   readonly line10: bigint, readonly line11: bigint, readonly line12: bigint,
 *   readonly line13: bigint, readonly line14: bigint, readonly line15: bigint,
 *   readonly line16: bigint, readonly line17: bigint, readonly line18: bigint,
 *   readonly line19: bigint, readonly line20: bigint, readonly line21: bigint,
 *   readonly line22: bigint, readonly line23: bigint, readonly line24: bigint,
 *   readonly line25: bigint,
 *   readonly method22: Line16BaseMethod,
 *   readonly method24: Line16BaseMethod,
 * }} Qdcgt
 */

/**
 * Fills in the Qualified Dividends and Capital Gain Tax Worksheet
 * (i1040gi p38) for one return. Every `const` below is one printed line,
 * in printed order, with the printed instruction quoted above it.
 * @type {(taxParamSet: TaxParamSet) => (input: QdcgtInput) => Qdcgt}
 */
export const qdcgt = taxParamSet => input => {
    const { status, line1Cents, line2Cents, filingScheduleD, scheduleD15Cents, scheduleD16Cents, line7aCents } = input
    // Lines 6 and 13 are read from the stored TY2025 breakpoints, never
    // re-typed here: the printed figures ARE `zeroRateMax` and
    // `fifteenRateMax`, character for character (10-RESEARCH.md, "Where
    // TY2025 parameters already supply the breakpoints"), so a literal
    // here would be a second source of truth for a number Rev. Proc.
    // 2024-40 §2.03 already fixes once.
    const breakpoints = taxParamSet.capitalGainsBreakpoints[status]
    // 1. "Enter the amount from Form 1040 or 1040-SR, line 15."
    // (A filer of Form 2555 enters line 3 of the Foreign Earned Income
    // Tax Worksheet instead. That is out of profile and is a scope-guard
    // refusal one level up, never a silent substitution here.)
    const line1 = line1Cents
    // 2. "Enter the amount from Form 1040 or 1040-SR, line 3a."
    const line2 = line2Cents
    // 3. "Are you filing Schedule D? Yes. Enter the smaller of line 15
    //    or line 16 of Schedule D. If either line 15 or line 16 is blank
    //    or a loss, enter -0-. No. Enter the amount from Form 1040 or
    //    1040-SR, line 7a."
    //
    //    A property of the printed page, found by mutating this line and
    //    written down because nobody had: the "blank" half of "blank or
    //    a loss" is ABSORBED by the `min` below it. Weakening both
    //    comparisons from `<= 0n` to `< 0n` changes no answer at any
    //    input at all — if neither amount is negative and one is zero,
    //    the `min` of the two is that zero anyway. So this whole guard
    //    is exactly `max(min(s15, s16), 0n)`, and `<=` versus `<` is an
    //    EQUIVALENT MUTANT here, not a coverage gap. The `<=` form is
    //    kept because it is the shape the page prints, and a transcribed
    //    worksheet is diffed against the page rather than minimised.
    //    (The mutation that does bite is removing the guard, which lets
    //    a Schedule D loss through as a negative line 3 — see
    //    `scheduleDLossOnEitherLineEntersZeroOnLineThree`.)
    const line3 = filingScheduleD
        ? (scheduleD15Cents <= 0n || scheduleD16Cents <= 0n
            ? 0n
            : (scheduleD15Cents < scheduleD16Cents ? scheduleD15Cents : scheduleD16Cents))
        : line7aCents
    // 4. "Add lines 2 and 3."
    const line4 = line2 + line3
    // 5. "Subtract line 4 from line 1. If zero or less, enter -0-." One
    //    of the page's only two floors.
    const line5 = line1 - line4 > 0n ? line1 - line4 : 0n
    // 6. "Enter: $48,350 if single or married filing separately,
    //    $96,700 if married filing jointly or qualifying surviving
    //    spouse, $64,750 if head of household."
    const line6 = centsFromString(breakpoints.zeroRateMax)
    // 7. "Enter the smaller of line 1 or line 6."
    const line7 = line1 < line6 ? line1 : line6
    // 8. "Enter the smaller of line 5 or line 7."
    const line8 = line5 < line7 ? line5 : line7
    // 9. "Subtract line 8 from line 7. This amount is taxed at 0%."
    //    No printed floor; cannot go negative because line 8 is a `min`
    //    that includes line 7. Asserted rather than floored — see this
    //    module's docstring, property 2.
    const line9 = line7 - line8
    assert(line9 >= 0n, ['QDCGT line 9 must never be negative', line9])
    // 10. "Enter the smaller of line 1 or line 4."
    const line10 = line1 < line4 ? line1 : line4
    // 11. "Enter the amount from line 9." A pure copy, kept as its own
    //     printed line so the diff against the page stays line for line.
    const line11 = line9
    // 12. "Subtract line 11 from line 10." No printed floor; asserted.
    const line12 = line10 - line11
    assert(line12 >= 0n, ['QDCGT line 12 must never be negative', line12])
    // 13. "Enter: $533,400 if single, $300,000 if married filing
    //     separately, $600,050 if married filing jointly or qualifying
    //     surviving spouse, $566,700 if head of household."
    const line13 = centsFromString(breakpoints.fifteenRateMax)
    // 14. "Enter the smaller of line 1 or line 13."
    const line14 = line1 < line13 ? line1 : line13
    // 15. "Add lines 5 and 9."
    const line15 = line5 + line9
    // 16. "Subtract line 15 from line 14. If zero or less, enter -0-."
    //     The page's other floor.
    const line16 = line14 - line15 > 0n ? line14 - line15 : 0n
    // 17. "Enter the smaller of line 12 or line 16."
    const line17 = line12 < line16 ? line12 : line16
    // 18. "Multiply line 17 by 15% (0.15)."
    //     The rate is written HERE, at the line that prints it, and is
    //     deliberately NOT added to `fjs/tax/params`: 10-RESEARCH.md
    //     proposed that with an IRC §1(h) citation it did not verify
    //     (assumption A1), while the worksheet line itself is a verified
    //     primary source. One of only two lines that can create a
    //     fractional cent, so `halfUp` to the cent.
    const line18 = halfUp(multiply(of(line17)(1n))(of(15n)(100n)))
    // 19. "Add lines 9 and 17."
    const line19 = line9 + line17
    // 20. "Subtract line 19 from line 10." No printed floor; asserted.
    const line20 = line10 - line19
    assert(line20 >= 0n, ['QDCGT line 20 must never be negative', line20])
    // 21. "Multiply line 20 by 20% (0.20)." The other fractional-cent line.
    const line21 = halfUp(multiply(of(line20)(1n))(of(20n)(100n)))
    // 22. "Figure the tax on the amount on line 5. If the amount on line
    //     5 is less than $100,000, use the Tax Table to figure the tax.
    //     If the amount on line 5 is $100,000 or more, use the Tax
    //     Computation Worksheet."
    //     Its own call, on its own amount — see property 1 above.
    const base22 = baseTaxForAmount(taxParamSet)(status)(line5)
    const line22 = base22.cents
    // 23. "Add lines 18, 21, and 22."
    const line23 = line18 + line21 + line22
    // 24. "Figure the tax on the amount on line 1." Same fork, decided
    //     again, on a different amount.
    const base24 = baseTaxForAmount(taxParamSet)(status)(line1)
    const line24 = base24.cents
    // 25. "Tax on all taxable income. Enter the smaller of line 23 or
    //     line 24. Also include this amount on the entry space on Form
    //     1040 or 1040-SR, line 16."
    //     THE CLAMP. Deleting it is the defect this file exists to pin.
    const line25 = line23 < line24 ? line23 : line24
    return {
        line1, line2, line3, line4, line5,
        line6, line7, line8, line9, line10,
        line11, line12, line13, line14, line15,
        line16, line17, line18, line19, line20,
        line21, line22, line23, line24, line25,
        method22: base22.method,
        method24: base24.method,
    }
}

/**
 * TY2025's parameter set, narrowed exactly ONCE at module scope, exactly
 * how `fjs/tax/table/module.f.js` does it: `noUncheckedIndexedAccess`
 * makes the year lookup `TaxParamSet | undefined` even at a literal key,
 * and a cast or a non-null assertion is banned, so `assert` — which
 * throws a bare string, never an `Error` — is the only compliant
 * narrowing.
 */
const taxParams2025 = taxParamsByYear[2025]
assert(taxParams2025 !== undefined, 'expected TY2025 parameters to be present in taxParamsByYear')

// ── Tests ────────────────────────────────────────────────────────────────────

/**
 * The split-dispatch return, in one place: MFJ, Form 1040 line 15 =
 * $120,000.00, line 3a = $30,000.00, not filing Schedule D. Line 5 lands
 * at $90,000.00 (Tax Table) while line 1 is $120,000.00 (Tax Computation
 * Worksheet), which is what makes it the independent-dispatch case.
 * @type {QdcgtInput}
 */
const splitDispatchInput = {
    status: 'marriedFilingJointly',
    line1Cents: 12000000n,
    line2Cents: 3000000n,
    filingScheduleD: false,
    scheduleD15Cents: 0n,
    scheduleD16Cents: 0n,
    line7aCents: 0n,
}

export const proof = {
    // T-10-06-03. Lines 22 and 24 price DIFFERENT amounts and each picks
    // its own method: $90,000.00 is below the Tax Table's $100,000.00
    // bound and $120,000.00 is above it, in ONE execution of ONE
    // worksheet. Both method tags AND both amounts are asserted, because
    // a proof that checked only the cents could not tell "priced by the
    // right method" from "priced by the wrong method and coincidentally
    // equal".
    //
    // Both amounts are hand-typed from primary sources, never computed
    // here: $10,326 is the printed MFJ Tax Table row $90,000-$90,050
    // (i1040gi p77) and $16,228.00 is the printed Tax Computation
    // Worksheet's own MFJ row, 22% x 120,000.00 - 10,172.00 (p80).
    //
    // The defect it pins: deciding "table or worksheet" once, from line
    // 15, and reusing that decision for line 22. That silently misprices
    // every return above $100,000.00 whose preferential slice pulls line
    // 5 back under it.
    linesTwentyTwoAndTwentyFourDispatchIndependentlyInOneExecution: () => {
        const result = qdcgt(taxParams2025)(splitDispatchInput)
        assertEq(result.method22, 'taxTable', 'line 22 prices line 5 ($90,000.00) by the Tax Table')
        assertEq(result.line22, 1032600n, 'the printed MFJ Tax Table row $90,000-$90,050')
        assertEq(
            result.method24,
            'taxComputationWorksheet',
            'line 24 prices line 1 ($120,000.00) by the Tax Computation Worksheet',
        )
        assertEq(result.line24, 1622800n, 'the printed MFJ Tax Computation Worksheet row')
        assert(
            result.method22 !== result.method24,
            ['the two lines must be free to use different methods in one execution', result.method22],
        )
    },
    // The 0%-slice arithmetic, on the same return. Line 9 is the slice
    // of the preferential income that falls under the 0% ceiling, and
    // line 12 is the rest of it. On this return the $30,000.00 of
    // qualified dividends splits $6,700.00 at 0% (the room left between
    // line 5's $90,000.00 and the $96,700.00 MFJ zero-rate ceiling) and
    // $23,300.00 at 15%. Both hand-typed.
    //
    // This leaf exists because every other leaf in this block reads only
    // method tags or line 3, and all of them would stay green while
    // lines 9 and 12 were wrong. It is also the leaf that catches a
    // sign-flipped line 9 that a defensive floor would have absorbed.
    lineNineAndLineTwelveSplitThePreferentialSliceAtTheZeroRateCeiling: () => {
        const result = qdcgt(taxParams2025)(splitDispatchInput)
        assertEq(result.line9, 670000n, 'the 0%-taxed slice: $6,700.00')
        assertEq(result.line12, 2330000n, 'the remainder of the preferential income: $23,300.00')
        assert(result.line9 >= 0n, ['line 9 is never negative', result.line9])
        assert(result.line12 >= 0n, ['line 12 is never negative', result.line12])
        assert(result.line20 >= 0n, ['line 20 is never negative', result.line20])
    },
    // Line 3's printed exception: "If either line 15 or line 16 is blank
    // or a loss, enter -0-." A $1,000.00 loss on Schedule D line 15
    // beside a $5,000.00 gain on line 16 gives ZERO, never the negative
    // smaller of the two — a negative line 3 would inflate line 5 and
    // under-tax the return.
    //
    // Paired with its control (AGENTS.md: "a gate needs a control"): two
    // genuine gains take the smaller, so the exception is a boundary
    // rather than a blanket zero.
    scheduleDLossOnEitherLineEntersZeroOnLineThree: () => {
        /** @type {QdcgtInput} */
        const withALoss = {
            status: 'marriedFilingJointly',
            line1Cents: 9700000n,
            line2Cents: 30000n,
            filingScheduleD: true,
            scheduleD15Cents: -100000n,
            scheduleD16Cents: 500000n,
            line7aCents: 0n,
        }
        const lossResult = qdcgt(taxParams2025)(withALoss)
        assertEq(lossResult.line3, 0n, 'a loss on Schedule D line 15 enters -0-, not the negative minimum')
        assert(lossResult.line3 >= 0n, ['line 3 must never be negative', lossResult.line3])
        assertEq(lossResult.line4, 30000n, 'line 4 is then line 2 alone')
        /** @type {QdcgtInput} */
        const withTwoGains = {
            status: 'marriedFilingJointly',
            line1Cents: 9700000n,
            line2Cents: 30000n,
            filingScheduleD: true,
            scheduleD15Cents: 100000n,
            scheduleD16Cents: 500000n,
            line7aCents: 0n,
        }
        const gainResult = qdcgt(taxParams2025)(withTwoGains)
        assertEq(gainResult.line3, 100000n, 'two gains take the smaller of Schedule D lines 15 and 16')
    },
    // ★ ROADMAP criterion 2, first half. MFJ, Form 1040 line 15 =
    // $97,000.00, line 3a = $300.00, not filing Schedule D.
    //
    // Correct Form 1040 line 16 = $11,174.00. An engine that reports line
    // 23 — that is, one that computes the whole preferential build-up and
    // then forgets line 25's `min` — reports $11,175.00 instead.
    //
    // READ THIS BEFORE RE-AIMING THE LEAF. The defect pinned here is the
    // omission of line 25's `min`, and nothing else. It is NOT "naive Tax
    // Table use": an engine that simply looks line 1 up in the Tax Table
    // returns $11,174.00 and is RIGHT on this case and on its partner
    // below, because looking line 1 up in the Tax Table is exactly what
    // line 24 computes and exactly what `min` then selects. A regression
    // proof aimed at that misreading would pass while the real defect
    // shipped. Only the PAIR distinguishes them: this case and the next
    // differ by one dollar of taxable income and one dollar of qualified
    // dividends, every Form 1040 line from 1a through 15 differs by
    // exactly that dollar, the broken engine returns the same $11,175.00
    // for both, and the correct engine returns $11,174.00 here and
    // $11,163.00 there — an eleven-dollar swing out of a one-dollar
    // change of input.
    //
    // All 25 values below are hand-typed from 10-CONTEXT.md's
    // independently-reproduced table (research, planner and executor each
    // recomputed them from i1040gi p38 and the stored brackets, and all
    // three agree). None is computed by calling `qdcgt`, and case B's are
    // not derived from case A's. Every printed line is asserted
    // individually rather than line 25 alone, because a 25-line worksheet
    // with two compensating transcription errors totals correctly —
    // `fjs/tax/table`'s `rowByRowDiffMatchesPublishedTable` set the
    // per-field precedent for exactly this reason.
    regressionPairCaseAAllTwentyFiveLines: () => {
        /** @type {QdcgtInput} */
        const caseA = {
            status: 'marriedFilingJointly',
            line1Cents: 9700000n,
            line2Cents: 30000n,
            filingScheduleD: false,
            scheduleD15Cents: 0n,
            scheduleD16Cents: 0n,
            line7aCents: 0n,
        }
        const r = qdcgt(taxParams2025)(caseA)
        assertEq(r.line1, 9700000n, 'line 1 = $97,000.00')
        assertEq(r.line2, 30000n, 'line 2 = $300.00')
        assertEq(r.line3, 0n, 'line 3 = $0.00')
        assertEq(r.line4, 30000n, 'line 4 = $300.00')
        assertEq(r.line5, 9670000n, 'line 5 = $96,700.00')
        assertEq(r.line6, 9670000n, 'line 6 = $96,700.00')
        assertEq(r.line7, 9670000n, 'line 7 = $96,700.00')
        assertEq(r.line8, 9670000n, 'line 8 = $96,700.00')
        assertEq(r.line9, 0n, 'line 9 = $0.00')
        assertEq(r.line10, 30000n, 'line 10 = $300.00')
        assertEq(r.line11, 0n, 'line 11 = $0.00')
        assertEq(r.line12, 30000n, 'line 12 = $300.00')
        assertEq(r.line13, 60005000n, 'line 13 = $600,050.00')
        assertEq(r.line14, 9700000n, 'line 14 = $97,000.00')
        assertEq(r.line15, 9670000n, 'line 15 = $96,700.00')
        assertEq(r.line16, 30000n, 'line 16 = $300.00')
        assertEq(r.line17, 30000n, 'line 17 = $300.00')
        assertEq(r.line18, 4500n, 'line 18 = $45.00')
        assertEq(r.line19, 30000n, 'line 19 = $300.00')
        assertEq(r.line20, 0n, 'line 20 = $0.00')
        assertEq(r.line21, 0n, 'line 21 = $0.00')
        assertEq(r.line22, 1113000n, 'line 22 = $11,130.00, printed MFJ row $96,700-$96,750')
        assertEq(r.line23, 1117500n, 'line 23 = $11,175.00 — the value a min-less engine reports')
        assertEq(r.line24, 1117400n, 'line 24 = $11,174.00, printed MFJ row $97,000-$97,050')
        assertEq(r.line25, 1117400n, 'line 25 = $11,174.00 — Form 1040 line 16')
        // The counterfactual, stated as its own assertion so the leaf
        // fails in a way that NAMES the bug rather than merely reporting
        // a wrong number.
        assert(
            r.line23 !== r.line25,
            [
                'line 25 must be the SMALLER of lines 23 and 24 — an engine that omits this min reports line 23',
                r.line23,
                r.line25,
            ],
        )
        assertEq(r.line25, r.line24, 'here the min selects line 24')
        assertEq(r.line23 - r.line25, 100n, 'omitting the min overstates this return by exactly $1.00')
    },
    // ★ ROADMAP criterion 2, second half — the partner one dollar away.
    // MFJ, Form 1040 line 15 = $96,999.00, line 3a = $299.00, not filing
    // Schedule D.
    //
    // Correct Form 1040 line 16 = $11,163.00. The same min-less engine
    // still reports line 23 = $11,174.85, so it is over by $11.85 here
    // while it was over by only $1.00 on case A — and it returns
    // essentially the same number on both, which is the signature of the
    // defect. See case A's docstring for why the pair, and not either
    // case alone, is what pins the `min`.
    //
    // Where case B's $11.85 comes from, so a failure here can be
    // diagnosed instead of merely observed:
    //   line 22's row OVERSTATES the ordinary tax by $3.00 — the table
    //     charges tax on the band midpoint $96,725, not on $96,700, and
    //     that $25 sits in the 12% bracket;
    //   line 24's row UNDERSTATES the total tax by $4.78 — the table
    //     charges the midpoint $96,975, not $96,999; exact T(96,999) is
    //     $11,167.78 against a printed $11,163;
    //   bracket inversion costs $7.50 — $250 of the preferential slice
    //     sits between the 0% ceiling $96,700 and the 12% ceiling
    //     $96,950 and is charged 15% rather than 12%;
    //   bracket alignment returns $3.43 — the remaining $49 above the
    //     12% ceiling is charged 15% rather than 22%.
    //   3.00 + 4.78 + 7.50 - 3.43 = 11.85 exactly, with no residual
    //   rounding term, because 0.15 x 299 = 44.85 is already a whole
    //   number of cents.
    //
    // What must never be asserted: the roadmap describes this symptom as
    // an error of one to twelve dollars. That is a description, not a
    // bound — MFJ with line 15 = $96,949.00 and line 3a = $249.00
    // produces $13.35. Any range assertion would be false. These two
    // specific returns are what is pinned.
    regressionPairCaseBAllTwentyFiveLines: () => {
        /** @type {QdcgtInput} */
        const caseB = {
            status: 'marriedFilingJointly',
            line1Cents: 9699900n,
            line2Cents: 29900n,
            filingScheduleD: false,
            scheduleD15Cents: 0n,
            scheduleD16Cents: 0n,
            line7aCents: 0n,
        }
        const r = qdcgt(taxParams2025)(caseB)
        assertEq(r.line1, 9699900n, 'line 1 = $96,999.00')
        assertEq(r.line2, 29900n, 'line 2 = $299.00')
        assertEq(r.line3, 0n, 'line 3 = $0.00')
        assertEq(r.line4, 29900n, 'line 4 = $299.00')
        assertEq(r.line5, 9670000n, 'line 5 = $96,700.00')
        assertEq(r.line6, 9670000n, 'line 6 = $96,700.00')
        assertEq(r.line7, 9670000n, 'line 7 = $96,700.00')
        assertEq(r.line8, 9670000n, 'line 8 = $96,700.00')
        assertEq(r.line9, 0n, 'line 9 = $0.00')
        assertEq(r.line10, 29900n, 'line 10 = $299.00')
        assertEq(r.line11, 0n, 'line 11 = $0.00')
        assertEq(r.line12, 29900n, 'line 12 = $299.00')
        assertEq(r.line13, 60005000n, 'line 13 = $600,050.00')
        assertEq(r.line14, 9699900n, 'line 14 = $96,999.00')
        assertEq(r.line15, 9670000n, 'line 15 = $96,700.00')
        assertEq(r.line16, 29900n, 'line 16 = $299.00')
        assertEq(r.line17, 29900n, 'line 17 = $299.00')
        assertEq(r.line18, 4485n, 'line 18 = $44.85')
        assertEq(r.line19, 29900n, 'line 19 = $299.00')
        assertEq(r.line20, 0n, 'line 20 = $0.00')
        assertEq(r.line21, 0n, 'line 21 = $0.00')
        assertEq(r.line22, 1113000n, 'line 22 = $11,130.00, printed MFJ row $96,700-$96,750')
        assertEq(r.line23, 1117485n, 'line 23 = $11,174.85 — the value a min-less engine reports')
        assertEq(r.line24, 1116300n, 'line 24 = $11,163.00, printed MFJ row $96,950-$97,000')
        assertEq(r.line25, 1116300n, 'line 25 = $11,163.00 — Form 1040 line 16')
        assert(
            r.line23 !== r.line25,
            [
                'line 25 must be the SMALLER of lines 23 and 24 — an engine that omits this min reports line 23',
                r.line23,
                r.line25,
            ],
        )
        assertEq(r.line25, r.line24, 'here too the min selects line 24')
        assertEq(r.line23 - r.line25, 1185n, 'omitting the min overstates this return by exactly $11.85')
    },
    // The control leg the pair needs (AGENTS.md: "a gate needs a
    // control"). A proof that `min` clamps must be paired with one
    // showing it does NOT clamp when it should not, or an engine that
    // always took line 24 would pass the pair above and still be wrong.
    //
    // MFJ, line 15 = $90,000.00, line 3a = $10,000.00. The whole $10,000
    // of qualified dividends sits inside the 0% zone (line 9), so line 23
    // = $9,126.00 is genuinely below line 24 = $10,326.00 and `min`
    // selects line 23. An engine that always took line 24 would over-tax
    // this return by exactly $1,200.00 — 12% of the $10,000 that belongs
    // at 0% — which is the opposite failure and equally worth pinning.
    //
    // $9,126 and $10,326 are the printed MFJ Tax Table rows
    // $80,000-$80,050 and $90,000-$90,050 (i1040gi p77), hand-typed.
    controlMinSelectsLineTwentyThreeWhenLineTwentyThreeIsAlreadySmaller: () => {
        /** @type {QdcgtInput} */
        const control = {
            status: 'marriedFilingJointly',
            line1Cents: 9000000n,
            line2Cents: 1000000n,
            filingScheduleD: false,
            scheduleD15Cents: 0n,
            scheduleD16Cents: 0n,
            line7aCents: 0n,
        }
        const r = qdcgt(taxParams2025)(control)
        assertEq(r.line5, 8000000n, 'line 5 = $80,000.00')
        assertEq(r.line9, 1000000n, 'line 9 = $10,000.00, the whole preferential slice at 0%')
        assertEq(r.line17, 0n, 'line 17 = $0.00, nothing reaches the 15% rate')
        assertEq(r.line22, 912600n, 'line 22 = $9,126.00, printed MFJ row $80,000-$80,050')
        assertEq(r.line23, 912600n, 'line 23 = $9,126.00')
        assertEq(r.line24, 1032600n, 'line 24 = $10,326.00, printed MFJ row $90,000-$90,050')
        assertEq(r.line25, 912600n, 'line 25 = $9,126.00 — Form 1040 line 16')
        assertEq(r.line25, r.line23, 'here the min selects line 23, not line 24')
        assertEq(r.line24 - r.line25, 120000n, 'always taking line 24 would over-tax by $1,200.00')
    },
    // The split dispatch, asserted end to end: line 22 by the Tax Table
    // and line 24 by the Tax Computation Worksheet, in ONE execution,
    // with the resulting line 25. This is the case an implementation that
    // decides the method once from line 15 gets wrong.
    //
    // $10,326 is the printed MFJ Tax Table row $90,000-$90,050 (p77);
    // $16,228.00 is the printed Tax Computation Worksheet MFJ row,
    // 22% x 120,000.00 - 10,172.00 (p80). Both hand-typed.
    splitDispatchProducesLineSixteenOfThirteenThousandEightHundredTwentyOne: () => {
        const r = qdcgt(taxParams2025)(splitDispatchInput)
        assertEq(r.line5, 9000000n, 'line 5 = $90,000.00')
        assertEq(r.line9, 670000n, 'line 9 = $6,700.00 at 0%')
        assertEq(r.line17, 2330000n, 'line 17 = $23,300.00 at 15%')
        assertEq(r.line18, 349500n, 'line 18 = $3,495.00')
        assertEq(r.method22, 'taxTable', 'line 22 is priced by the Tax Table')
        assertEq(r.line22, 1032600n, 'line 22 = $10,326.00')
        assertEq(r.line23, 1382100n, 'line 23 = $13,821.00')
        assertEq(r.method24, 'taxComputationWorksheet', 'line 24 is priced by the Tax Computation Worksheet')
        assertEq(r.line24, 1622800n, 'line 24 = $16,228.00')
        assertEq(r.line25, 1382100n, 'line 25 = $13,821.00 — Form 1040 line 16')
    },
    // All three preferential rates and both base lookups in a single
    // execution: MFJ, line 15 = $700,000.00, line 3a = $0.00, not filing
    // Schedule D, line 7a = $650,000.00. Line 9 is taxed at 0%, line 17
    // at 15%, line 20 at 20%, line 22 comes from the Tax Table and line
    // 24 from the Tax Computation Worksheet.
    //
    // $5,526 is the printed MFJ Tax Table row $50,000-$50,050 (p74).
    // $184,094.50 is the printed Tax Computation Worksheet MFJ row for
    // "over $501,050 but not over $751,600", 35% x 700,000.00 -
    // 60,905.50 (p80).
    //
    // That $184,094.50 was the one value in this phase sensitive to
    // 10-RESEARCH.md's assumption A2 — whether the Tax Computation
    // Worksheet rounds to whole dollars. Plan 10-03 decided cent-exact.
    // **A2 was RESOLVED on 2026-08-17 and the decision was right**: the
    // worksheet's own printed subtraction amounts carry cents, so the form
    // has no whole-dollar reading to offer. It did not need a filed return,
    // only the page it was already citing. See `fjs/tax/table`'s
    // `taxComputationWorksheet` docstring for the full evidence.
    allThreePreferentialRatesWithBothBaseLookupsInOneExecution: () => {
        /** @type {QdcgtInput} */
        const allRates = {
            status: 'marriedFilingJointly',
            line1Cents: 70000000n,
            line2Cents: 0n,
            filingScheduleD: false,
            scheduleD15Cents: 0n,
            scheduleD16Cents: 0n,
            line7aCents: 65000000n,
        }
        const r = qdcgt(taxParams2025)(allRates)
        assertEq(r.line5, 5000000n, 'line 5 = $50,000.00')
        assertEq(r.line9, 4670000n, 'line 9 = $46,700.00 at 0%')
        assertEq(r.line17, 50335000n, 'line 17 = $503,350.00 at 15%')
        assertEq(r.line18, 7550250n, 'line 18 = $75,502.50')
        assertEq(r.line20, 9995000n, 'line 20 = $99,950.00 at 20%')
        assertEq(r.line21, 1999000n, 'line 21 = $19,990.00')
        assertEq(r.method22, 'taxTable', 'line 22 is priced by the Tax Table')
        assertEq(r.line22, 552600n, 'line 22 = $5,526.00')
        assertEq(r.line23, 10101850n, 'line 23 = $101,018.50')
        assertEq(r.method24, 'taxComputationWorksheet', 'line 24 is priced by the Tax Computation Worksheet')
        assertEq(r.line24, 18409450n, 'line 24 = $184,094.50, cent-exact')
        assertEq(r.line25, 10101850n, 'line 25 = $101,018.50 — Form 1040 line 16')
    },
}
