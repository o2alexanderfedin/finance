/**
 * The Schedule D Tax Worksheet — Line 16
 * (i1040sd.pdf, printed pp.15-16, 2025 revision, `Dec 11, 2025`), all 47
 * printed lines, transcribed line for line and computed over integer
 * cents.
 *
 * This is one of Form 1040 line 16's four methods (TAX-03), paired with
 * `fjs/tax/line16/qdcgt`. Structurally it is QDCGT plus two spliced-in
 * Schedule D terms (lines 11/35/41) and a 25%-capped unrecaptured §1250
 * add-on (lines 35-40) plus a 28%-capped collectibles add-on (lines
 * 41-43) — see 12.1-RESEARCH.md's own line-correspondence table. It is a
 * standalone, self-contained pure function: it takes plain `bigint`
 * inputs, exactly like `qdcgt`, and has no dependency on Form 8949 or
 * Schedule D's own modules.
 *
 * ## The defect this file exists to pin
 *
 * **Omitting either of lines 44/46's INDEPENDENT `baseTaxForAmount`
 * dispatch.** Line 44 prices line 21 (the ordinary-rate baseline); line
 * 46 prices line 1 (the whole taxable income) — a SEPARATE call, on a
 * DIFFERENT amount. One execution of one worksheet can legitimately use
 * the Tax Table for one and the Tax Computation Worksheet for the other
 * (RESEARCH.md's own Worked Example 2 is the fixture that proves it: line
 * 21 = $650,000.00 and line 1 = $700,000.00 both cross $100,000.00, but
 * from different starting amounts, so an implementation that decides
 * "table or worksheet" once and reuses it is wrong the moment those two
 * amounts diverge). This is QDCGT's own Pitfall 1 (lines 22/24 there),
 * restated for this worksheet's lines 44/46.
 *
 * ## Skip instructions — which are safe to always compute, and which are not
 *
 * The printed page carries four bracketed "skip to line N" instructions.
 * Two of them (line 22's "[if lines 1 and 16 are the same, skip 23-43,
 * go to 44]" and line 32's "[if lines 1 and 32 are the same, skip 33-43,
 * go to 44]") are left UNIMPLEMENTED as special cases — the ordinary
 * mins/floors already in lines 23-43 make the shortcut and the
 * straight-through arithmetic agree, exactly the way `qdcgt` never needs
 * a special case for any of its own lines. Lines 35-40 (gated on Schedule
 * D line 19 being zero) and 41-43 (gated on Schedule D line 18 being
 * zero) are DIFFERENT: line 42 ("subtract line 41 from line 1") carries
 * NO printed floor, so if lines 41-43 were computed straight through when
 * Schedule D line 18 is zero, line 43 would silently add a spurious 28%
 * charge on ordinary income that was never collectibles gain at all. So
 * these two add-ons are EXPLICITLY gated to their floor/zero value when
 * their controlling Schedule D line is zero, mirroring the printed page's
 * own "blank" convention, rather than trusted to fall out of the
 * arithmetic.
 *
 * ## Why a record and not an array
 *
 * `tsconfig.json` sets `noUncheckedIndexedAccess`, so an array of 47
 * would yield `bigint | undefined` at every index, and the only ways out
 * of that are a cast or a non-null assertion, both banned outright by
 * AGENTS.md. A record indexes cleanly — and TAX-15 wants the printed line
 * numbers carried in the names anyway.
 *
 * ## Rounding
 *
 * Lines 31, 34, 40 and 43 are the only four lines that can create a
 * fractional cent (the 15%/20%/25%/28% multiplies), and they round to the
 * CENT via `halfUp`, because a worksheet line is a line boundary
 * (EXACT-04). `i1040sd.pdf` p.9 states whole-dollar rounding is the
 * taxpayer's OPTIONAL election, identical to Form 1040 p.23 — not a
 * worksheet-specific mandate — so this worksheet is cent-exact throughout
 * and applies no worksheet-local rounding rule (12.1-CONTEXT.md Decision
 * 3.2).
 *
 * @module
 */
import { assert, assertEq } from 'functionalscript/fjs/asserts/module.f.mjs'
import { of, multiply, halfUp } from '../../../types/rational/module.f.js'
import { centsFromString } from '../../../exact/module.f.js'
import { taxParamsByYear } from '../../params/module.f.js'
import { baseTaxForAmount } from '../../table/module.f.js'
import { qdcgt } from '../qdcgt/module.f.js'

/** @import { TaxParamSet, IndividualFilingStatus } from '../../params/module.f.js' */
/** @import { Line16BaseMethod } from '../../table/module.f.js' */
/** @import { QdcgtInput } from '../qdcgt/module.f.js' */

/**
 * Everything the printed worksheet asks the filer to carry onto it.
 * There is no `filingScheduleD`/`line7aCents` fork the way `QdcgtInput`
 * has one: dispatcher branch 2a's own guard already establishes Schedule
 * D is being filed, with both lines 15 and 16 as gains, before this
 * worksheet is ever called.
 * @typedef {{
 *   readonly status: IndividualFilingStatus,
 *   readonly line1Cents: bigint,
 *   readonly line2Cents: bigint,
 *   readonly form4952Line4gCents: bigint,
 *   readonly form4952Line4eCents: bigint,
 *   readonly scheduleD15Cents: bigint,
 *   readonly scheduleD16Cents: bigint,
 *   readonly scheduleD18Cents: bigint,
 *   readonly scheduleD19Cents: bigint,
 * }} SdtwInput
 */

/**
 * The filled-in worksheet: every printed line under its own printed
 * number, plus the two method tags recording which base method priced
 * line 44 and which priced line 46. The tags are separate fields
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
 *   readonly line25: bigint, readonly line26: bigint, readonly line27: bigint,
 *   readonly line28: bigint, readonly line29: bigint, readonly line30: bigint,
 *   readonly line31: bigint, readonly line32: bigint, readonly line33: bigint,
 *   readonly line34: bigint, readonly line35: bigint, readonly line36: bigint,
 *   readonly line37: bigint, readonly line38: bigint, readonly line39: bigint,
 *   readonly line40: bigint, readonly line41: bigint, readonly line42: bigint,
 *   readonly line43: bigint, readonly line44: bigint, readonly line45: bigint,
 *   readonly line46: bigint, readonly line47: bigint,
 *   readonly method44: Line16BaseMethod,
 *   readonly method46: Line16BaseMethod,
 * }} Sdtw
 */

/**
 * Line 19's breakpoint — $197,300.00 single/MFS/HoH, $394,600.00 MFJ/QSS
 * — read from `ordinaryBrackets[status]`'s 24%-rate bracket ceiling,
 * never a fresh hand-typed literal (12.1-RESEARCH.md, "Reusing
 * `ordinaryBrackets` for SDTW line 19's breakpoint": IRC §1(h)(1)(A)(ii)
 * defines this threshold by reference to "the dollar amount at which the
 * 32-percent bracket begins," which is the SAME figure `ordinaryBrackets`
 * already stores as the 24% bracket's ceiling).
 * @type {(taxParamSet: TaxParamSet) => (status: IndividualFilingStatus) => bigint}
 */
const line19BreakpointCents = taxParamSet => status => {
    const twentyFourPercentBracket = taxParamSet.ordinaryBrackets[status].brackets
        .find(b => b.ratePercent === 24)
    assert(
        twentyFourPercentBracket?.ceiling !== undefined,
        ['expected a 24% bracket with a ceiling for this filing status', status],
    )
    return centsFromString(twentyFourPercentBracket.ceiling)
}

/**
 * Fills in the Schedule D Tax Worksheet (i1040sd.pdf pp.15-16) for one
 * return. Every `const` below is one printed line, in printed order, with
 * the printed instruction quoted or closely paraphrased above it.
 * @type {(taxParamSet: TaxParamSet) => (input: SdtwInput) => Sdtw}
 */
export const sdtw = taxParamSet => input => {
    const {
        status, line1Cents, line2Cents, form4952Line4gCents, form4952Line4eCents,
        scheduleD15Cents, scheduleD16Cents, scheduleD18Cents, scheduleD19Cents,
    } = input
    const breakpoints = taxParamSet.capitalGainsBreakpoints[status]
    // 1. "Enter your taxable income from Form 1040/1040-SR/1040-NR, line 15."
    const line1 = line1Cents
    // 2. "Enter your qualified dividends from Form 1040/1040-SR/1040-NR, line 3a."
    const line2 = line2Cents
    // 3. "Enter the amount from Form 4952, line 4g."
    const line3 = form4952Line4gCents
    // 4. "Enter the amount from Form 4952, line 4e."
    const line4 = form4952Line4eCents
    // 5. "Subtract line 4 from line 3. If zero or less, enter -0-."
    const line5 = line3 - line4 > 0n ? line3 - line4 : 0n
    // 6. "Subtract line 5 from line 2. If zero or less, enter -0-."
    const line6 = line2 - line5 > 0n ? line2 - line5 : 0n
    // 7. "Enter the smaller of line 15 or line 16 of Schedule D." Branch
    //    2a's own guard already establishes both are gains before this
    //    worksheet is ever called, so no "blank or a loss" fork is needed
    //    here the way QDCGT's own line 3 needs one.
    const line7 = scheduleD15Cents < scheduleD16Cents ? scheduleD15Cents : scheduleD16Cents
    // 8. "Enter the smaller of line 3 or line 4."
    const line8 = line3 < line4 ? line3 : line4
    // 9. "Subtract line 8 from line 7. If zero or less, enter -0-."
    const line9 = line7 - line8 > 0n ? line7 - line8 : 0n
    // 10. "Add lines 6 and 9."
    const line10 = line6 + line9
    // 11. "Add lines 18 and 19 of Schedule D." The first of the two
    //     splices RESEARCH.md's correspondence table calls out.
    const line11 = scheduleD18Cents + scheduleD19Cents
    // 12. "Enter the smaller of line 9 or line 11."
    const line12 = line9 < line11 ? line9 : line11
    // 13. "Subtract line 12 from line 10." No printed floor. Cannot go
    //     negative: line12 is a min bounded above by line9, and
    //     line10 = line6 + line9 >= line9 >= line12. Asserted rather than
    //     floored, mirroring QDCGT's own no-floor idiom (its lines 9/12/20).
    const line13 = line10 - line12
    assert(line13 >= 0n, ['SDTW line 13 must never be negative', line13])
    // 14. "Subtract line 13 from line 1. If zero or less, enter -0-."
    const line14 = line1 - line13 > 0n ? line1 - line13 : 0n
    // 15. "Enter: $48,350 single/MFS; $96,700 MFJ/QSS; $64,750 HoH." Read
    //     from the stored TY2025 breakpoints, never re-typed — the
    //     identical figure QDCGT's own line 6 reads.
    const line15 = centsFromString(breakpoints.zeroRateMax)
    // 16. "Enter the smaller of line 1 or line 15."
    const line16 = line1 < line15 ? line1 : line15
    // 17. "Enter the smaller of line 14 or line 16."
    const line17 = line14 < line16 ? line14 : line16
    // 18. "Subtract line 10 from line 1. If zero or less, enter -0-."
    const line18 = line1 - line10 > 0n ? line1 - line10 : 0n
    // 19. "Enter the smaller of line 1 or: $197,300 single/MFS/HoH;
    //     $394,600 MFJ/QSS." The breakpoint is derived, never hand-typed —
    //     see `line19BreakpointCents` above.
    const line19 = line1 < line19BreakpointCents(taxParamSet)(status)
        ? line1
        : line19BreakpointCents(taxParamSet)(status)
    // 20. "Enter the smaller of line 14 or line 19."
    const line20 = line14 < line19 ? line14 : line19
    // 21. "Enter the larger of line 18 or line 20."
    const line21 = line18 > line20 ? line18 : line20
    // 22. "Subtract line 17 from line 16. This amount is taxed at 0%." No
    //     printed floor, and cannot legitimately go negative (line17 is a
    //     min bounded above by line16). Asserted, not floored — QDCGT's
    //     own line-9 precedent.
    //     [If lines 1 and 16 are the same, skip lines 23-43 and go to
    //     line 44 — safe to always compute straight through: the mins and
    //     floors already present in lines 23-43 make the shortcut and the
    //     unconditional arithmetic agree, exactly as QDCGT never needs a
    //     special case for any of its own lines.]
    const line22 = line16 - line17
    assert(line22 >= 0n, ['SDTW line 22 must never be negative', line22])
    // 23. "Enter the smaller of line 1 or line 13."
    const line23 = line1 < line13 ? line1 : line13
    // 24. "Enter the amount from line 22 (if blank, -0-)." Line 22 is
    //     always computed above, so this is a pure copy, kept as its own
    //     printed line so the diff against the page stays line for line.
    const line24 = line22
    // 25. "Subtract line 24 from line 23. If zero or less, enter -0-."
    const line25 = line23 - line24 > 0n ? line23 - line24 : 0n
    // 26. "Enter: $533,400 single; $300,000 MFS; $600,050 MFJ/QSS;
    //     $566,700 HoH." The SAME breakpoint QDCGT's own line 13 reads.
    const line26 = centsFromString(breakpoints.fifteenRateMax)
    // 27. "Enter the smaller of line 1 or line 26."
    const line27 = line1 < line26 ? line1 : line26
    // 28. "Add lines 21 and 22."
    const line28 = line21 + line22
    // 29. "Subtract line 28 from line 27. If zero or less, enter -0-."
    const line29 = line27 - line28 > 0n ? line27 - line28 : 0n
    // 30. "Enter the smaller of line 25 or line 29."
    const line30 = line25 < line29 ? line25 : line29
    // 31. "Multiply line 30 by 15% (0.15)." One of the four lines that can
    //     create a fractional cent.
    const line31 = halfUp(multiply(of(line30)(1n))(of(15n)(100n)))
    // 32. "Add lines 24 and 30."
    //     [If lines 1 and 32 are the same, skip lines 33-43 and go to
    //     line 44 — same "safe to always compute" reasoning as line 22's
    //     skip above.]
    const line32 = line24 + line30
    // 33. "Subtract line 32 from line 23." No printed floor. Cannot go
    //     negative by the worksheet's own construction (line23 bounds the
    //     preferential build-up that line32 accumulates a subset of).
    //     Asserted rather than floored.
    const line33 = line23 - line32
    assert(line33 >= 0n, ['SDTW line 33 must never be negative', line33])
    // 34. "Multiply line 33 by 20% (0.20)."
    const line34 = halfUp(multiply(of(line33)(1n))(of(20n)(100n)))
    // 35-40. "[If Schedule D line 19 is zero or blank, skip lines 35-40
    //     and go to line 41.]" UNLIKE lines 22/32's skips, this one is
    //     implemented as an explicit gate: nothing in lines 36-38's own
    //     arithmetic forces them to a meaningful value when there is no
    //     unrecaptured §1250 gain to price, so they are pinned to their
    //     printed "blank" value rather than left to whatever they would
    //     otherwise compute.
    const unrecapturedSection1250Lines = scheduleD19Cents === 0n
        ? { line35: 0n, line36: 0n, line37: 0n, line38: 0n, line39: 0n, line40: 0n }
        : (() => {
            // 35. "Enter the smaller of line 9 (above) or Schedule D, line 19."
            const line35 = line9 < scheduleD19Cents ? line9 : scheduleD19Cents
            // 36. "Add lines 10 and 21."
            const line36 = line10 + line21
            // 37. "Enter the amount from line 1 (above)."
            const line37 = line1
            // 38. "Subtract line 37 from line 36. If zero or less, enter -0-."
            const line38 = line36 - line37 > 0n ? line36 - line37 : 0n
            // 39. "Subtract line 38 from line 35. If zero or less, enter -0-."
            const line39 = line35 - line38 > 0n ? line35 - line38 : 0n
            // 40. "Multiply line 39 by 25% (0.25)."
            const line40 = halfUp(multiply(of(line39)(1n))(of(25n)(100n)))
            return { line35, line36, line37, line38, line39, line40 }
        })()
    const { line35, line36, line37, line38, line39, line40 } = unrecapturedSection1250Lines
    // 41-43. "[If Schedule D line 18 is zero or blank, skip lines 41-43
    //     and go to line 44.]" Explicitly gated for the same reason as
    //     35-40 above, and MORE load-bearing here: line 42 carries NO
    //     printed floor, so computing it straight through when Schedule D
    //     line 18 is zero would silently add a spurious 28% charge on
    //     ordinary income that was never collectibles gain (this module's
    //     docstring, "Skip instructions").
    const collectiblesLines = scheduleD18Cents === 0n
        ? { line41: 0n, line42: 0n, line43: 0n }
        : (() => {
            // 41. "Add lines 21, 22, 30, 33, and 39."
            const line41 = line21 + line22 + line30 + line33 + line39
            // 42. "Subtract line 41 from line 1." No printed floor. Cannot
            //     go negative: line 41 accumulates only slices that are
            //     subsets of line 1's income. Asserted rather than floored.
            const line42 = line1 - line41
            assert(line42 >= 0n, ['SDTW line 42 must never be negative', line42])
            // 43. "Multiply line 42 by 28% (0.28)."
            const line43 = halfUp(multiply(of(line42)(1n))(of(28n)(100n)))
            return { line41, line42, line43 }
        })()
    const { line41, line42, line43 } = collectiblesLines
    // 44. "Figure the tax on the amount on line 21." Its own independent
    //     call, on its own amount — see this module's docstring.
    const base44 = baseTaxForAmount(taxParamSet)(status)(line21)
    const line44 = base44.cents
    // 45. "Add lines 31, 34, 40, 43, and 44."
    const line45 = line31 + line34 + line40 + line43 + line44
    // 46. "Figure the tax on the amount on line 1." Same $100,000 fork,
    //     decided again, on a different amount.
    const base46 = baseTaxForAmount(taxParamSet)(status)(line1)
    const line46 = base46.cents
    // 47. "Tax on all taxable income. Enter the smaller of line 45 or
    //     line 46. Also include this amount on Form 1040, line 16." THE
    //     CLAMP — deleting it is the defect this file exists to pin,
    //     mirroring QDCGT's own line 25.
    const line47 = line45 < line46 ? line45 : line46
    return {
        line1, line2, line3, line4, line5,
        line6, line7, line8, line9, line10,
        line11, line12, line13, line14, line15,
        line16, line17, line18, line19, line20,
        line21, line22, line23, line24, line25,
        line26, line27, line28, line29, line30,
        line31, line32, line33, line34, line35,
        line36, line37, line38, line39, line40,
        line41, line42, line43, line44, line45,
        line46, line47,
        method44: base44.method,
        method46: base46.method,
    }
}

/**
 * TY2025's parameter set, narrowed exactly ONCE at module scope, exactly
 * how `fjs/tax/table/module.f.js` and `fjs/tax/line16/qdcgt/module.f.js`
 * do it: `noUncheckedIndexedAccess` makes the year lookup
 * `TaxParamSet | undefined` even at a literal key, and a cast or a
 * non-null assertion is banned, so `assert` — which throws a bare string,
 * never an `Error` — is the only compliant narrowing.
 */
const taxParams2025 = taxParamsByYear[2025]
assert(taxParams2025 !== undefined, 'expected TY2025 parameters to be present in taxParamsByYear')

// ── Tests ────────────────────────────────────────────────────────────────────

/**
 * The split-dispatch fixture, in one place, analogous to QDCGT's own
 * `splitDispatchInput`: MFJ, Form 1040 line 15 = $150,000.00, Schedule D
 * lines 15/16 = $100,000.00 gain each, lines 18/19 = $0.00 (so the 25%/28%
 * add-ons are gated off and this fixture is ALSO the degenerate-equivalence
 * fixture below). Line 21 lands at $50,000.00 (Tax Table) while line 1 is
 * $150,000.00 (Tax Computation Worksheet), which is what makes it the
 * independent-dispatch case — neither worked example alone exercises this,
 * since Example 1's line 21 and line 1 both round to the Tax Table and
 * Example 2's both round to the Tax Computation Worksheet.
 * @type {SdtwInput}
 */
const splitDispatchInput = {
    status: 'marriedFilingJointly',
    line1Cents: 15000000n,
    line2Cents: 0n,
    form4952Line4gCents: 0n,
    form4952Line4eCents: 0n,
    scheduleD15Cents: 10000000n,
    scheduleD16Cents: 10000000n,
    scheduleD18Cents: 0n,
    scheduleD19Cents: 0n,
}

export const proof = {
    // A structural regression proof: every one of the 47 lines plus both
    // method tags must be present on the returned object, and line 1 must
    // be a pure passthrough of the input. Catches an accidentally dropped
    // field that a deep-value proof aimed at one scenario might not touch.
    sdtwReturnsAllFortySevenLinesPlusBothMethodTags: () => {
        const result = sdtw(taxParams2025)(splitDispatchInput)
        assertEq(Object.keys(result).length, 49, 'expected 47 lines plus method44 and method46')
        assertEq(result.line1, splitDispatchInput.line1Cents, 'line 1 is a pure passthrough of taxable income')
        assert(typeof result.line47 === 'bigint', ['line 47 must be a bigint', result.line47])
    },
    // ★ ROADMAP criterion 2. Worked Example 1 (12.1-RESEARCH.md, "Worked
    // Examples" — hand-transcribed from the printed Schedule D Tax
    // Worksheet, independently reproduced by research, planner and
    // executor before being written down, per 12.1-CONTEXT.md Decision
    // 3.4): MFJ, taxable income $97,000.00, qualified dividends $300.00,
    // not filing Form 4952, Schedule D lines 15/16 = $40,000.00 gain
    // each, line 18 = $0.00, line 19 (unrecaptured §1250 gain) =
    // $10,000.00. Every printed line is asserted individually, not just
    // line 47 alone — a 47-line worksheet with two compensating
    // transcription errors could total correctly, mirroring
    // `fjs/tax/table`'s `rowByRowDiffMatchesPublishedTable` and QDCGT's
    // own `regressionPairCaseAAllTwentyFiveLines` precedent.
    regressionExampleOneAllFortySevenLines: () => {
        /** @type {SdtwInput} */
        const example1 = {
            status: 'marriedFilingJointly',
            line1Cents: 9700000n,
            line2Cents: 30000n,
            form4952Line4gCents: 0n,
            form4952Line4eCents: 0n,
            scheduleD15Cents: 4000000n,
            scheduleD16Cents: 4000000n,
            scheduleD18Cents: 0n,
            scheduleD19Cents: 1000000n,
        }
        const r = sdtw(taxParams2025)(example1)
        assertEq(r.line1, 9700000n, 'line 1 = $97,000.00')
        assertEq(r.line2, 30000n, 'line 2 = $300.00')
        assertEq(r.line3, 0n, 'line 3 = $0.00')
        assertEq(r.line4, 0n, 'line 4 = $0.00')
        assertEq(r.line5, 0n, 'line 5 = $0.00')
        assertEq(r.line6, 30000n, 'line 6 = $300.00')
        assertEq(r.line7, 4000000n, 'line 7 = $40,000.00')
        assertEq(r.line8, 0n, 'line 8 = $0.00')
        assertEq(r.line9, 4000000n, 'line 9 = $40,000.00')
        assertEq(r.line10, 4030000n, 'line 10 = $40,300.00')
        assertEq(r.line11, 1000000n, 'line 11 = $10,000.00')
        assertEq(r.line12, 1000000n, 'line 12 = $10,000.00')
        assertEq(r.line13, 3030000n, 'line 13 = $30,300.00')
        assertEq(r.line14, 6670000n, 'line 14 = $66,700.00')
        assertEq(r.line15, 9670000n, 'line 15 = $96,700.00')
        assertEq(r.line16, 9670000n, 'line 16 = $96,700.00')
        assertEq(r.line17, 6670000n, 'line 17 = $66,700.00')
        assertEq(r.line18, 5670000n, 'line 18 = $56,700.00')
        assertEq(r.line19, 9700000n, 'line 19 = $97,000.00')
        assertEq(r.line20, 6670000n, 'line 20 = $66,700.00')
        assertEq(r.line21, 6670000n, 'line 21 = $66,700.00')
        assertEq(r.line22, 3000000n, 'line 22 = $30,000.00')
        assertEq(r.line23, 3030000n, 'line 23 = $30,300.00')
        assertEq(r.line24, 3000000n, 'line 24 = $30,000.00')
        assertEq(r.line25, 30000n, 'line 25 = $300.00')
        assertEq(r.line26, 60005000n, 'line 26 = $600,050.00')
        assertEq(r.line27, 9700000n, 'line 27 = $97,000.00')
        assertEq(r.line28, 9670000n, 'line 28 = $96,700.00')
        assertEq(r.line29, 30000n, 'line 29 = $300.00')
        assertEq(r.line30, 30000n, 'line 30 = $300.00')
        assertEq(r.line31, 4500n, 'line 31 = $45.00')
        assertEq(r.line32, 3030000n, 'line 32 = $30,300.00')
        assertEq(r.line33, 0n, 'line 33 = $0.00')
        assertEq(r.line34, 0n, 'line 34 = $0.00')
        assertEq(r.line35, 1000000n, 'line 35 = $10,000.00')
        assertEq(r.line36, 10700000n, 'line 36 = $107,000.00')
        assertEq(r.line37, 9700000n, 'line 37 = $97,000.00')
        assertEq(r.line38, 1000000n, 'line 38 = $10,000.00')
        assertEq(r.line39, 0n, 'line 39 = $0.00')
        assertEq(r.line40, 0n, 'line 40 = $0.00, Schedule D line 18 = $0.00 never reaches the 28% add-on')
        assertEq(r.line41, 0n, 'line 41 = $0.00, gated off by Schedule D line 18 = $0.00')
        assertEq(r.line42, 0n, 'line 42 = $0.00')
        assertEq(r.line43, 0n, 'line 43 = $0.00')
        assertEq(r.method44, 'taxTable', 'line 44 prices line 21 ($66,700.00) by the Tax Table')
        assertEq(r.line44, 753000n, 'line 44 = $7,530.00, printed MFJ Tax Table row $66,700-$66,750')
        assertEq(r.line45, 757500n, 'line 45 = $7,575.00')
        assertEq(r.method46, 'taxTable', 'line 46 prices line 1 ($97,000.00) by the Tax Table')
        assertEq(r.line46, 1117400n, 'line 46 = $11,174.00, printed MFJ Tax Table row $97,000-$97,050')
        assertEq(r.line47, 757500n, 'line 47 = $7,575.00 — Form 1040 line 16')
    },
    // ★ ROADMAP criterion 2, second half. Worked Example 2
    // (12.1-RESEARCH.md): single, taxable income $700,000.00, qualified
    // dividends $0.00, not filing Form 4952, Schedule D lines 15/16 =
    // $50,000.00 gain each, line 18 (28% rate gain) = $50,000.00 — the
    // ENTIRE net capital gain is collectibles gain — line 19 = $0.00.
    // The opposite shape from Example 1: there, the special-rate ceiling
    // was never reached; here, the 28% ceiling is exactly what is doing
    // the work (lines 41-43 compute a genuine non-zero figure), and both
    // base-tax lookups (44 and 46) cross into the Tax Computation
    // Worksheet.
    regressionExampleTwoAllFortySevenLines: () => {
        /** @type {SdtwInput} */
        const example2 = {
            status: 'single',
            line1Cents: 70000000n,
            line2Cents: 0n,
            form4952Line4gCents: 0n,
            form4952Line4eCents: 0n,
            scheduleD15Cents: 5000000n,
            scheduleD16Cents: 5000000n,
            scheduleD18Cents: 5000000n,
            scheduleD19Cents: 0n,
        }
        const r = sdtw(taxParams2025)(example2)
        assertEq(r.line1, 70000000n, 'line 1 = $700,000.00')
        assertEq(r.line2, 0n, 'line 2 = $0.00')
        assertEq(r.line3, 0n, 'line 3 = $0.00')
        assertEq(r.line4, 0n, 'line 4 = $0.00')
        assertEq(r.line5, 0n, 'line 5 = $0.00')
        assertEq(r.line6, 0n, 'line 6 = $0.00')
        assertEq(r.line7, 5000000n, 'line 7 = $50,000.00')
        assertEq(r.line8, 0n, 'line 8 = $0.00')
        assertEq(r.line9, 5000000n, 'line 9 = $50,000.00')
        assertEq(r.line10, 5000000n, 'line 10 = $50,000.00')
        assertEq(r.line11, 5000000n, 'line 11 = $50,000.00')
        assertEq(r.line12, 5000000n, 'line 12 = $50,000.00')
        assertEq(r.line13, 0n, 'line 13 = $0.00')
        assertEq(r.line14, 70000000n, 'line 14 = $700,000.00')
        assertEq(r.line15, 4835000n, 'line 15 = $48,350.00')
        assertEq(r.line16, 4835000n, 'line 16 = $48,350.00')
        assertEq(r.line17, 4835000n, 'line 17 = $48,350.00')
        assertEq(r.line18, 65000000n, 'line 18 = $650,000.00')
        assertEq(r.line19, 19730000n, 'line 19 = $197,300.00')
        assertEq(r.line20, 19730000n, 'line 20 = $197,300.00')
        assertEq(r.line21, 65000000n, 'line 21 = $650,000.00')
        assertEq(r.line22, 0n, 'line 22 = $0.00')
        assertEq(r.line23, 0n, 'line 23 = $0.00')
        assertEq(r.line24, 0n, 'line 24 = $0.00')
        assertEq(r.line25, 0n, 'line 25 = $0.00')
        assertEq(r.line26, 53340000n, 'line 26 = $533,400.00')
        assertEq(r.line27, 53340000n, 'line 27 = $533,400.00')
        assertEq(r.line28, 65000000n, 'line 28 = $650,000.00')
        assertEq(r.line29, 0n, 'line 29 = $0.00, always floored: line 27 < line 28 here')
        assertEq(r.line30, 0n, 'line 30 = $0.00')
        assertEq(r.line31, 0n, 'line 31 = $0.00')
        assertEq(r.line32, 0n, 'line 32 = $0.00')
        assertEq(r.line33, 0n, 'line 33 = $0.00')
        assertEq(r.line34, 0n, 'line 34 = $0.00')
        assertEq(r.line35, 0n, 'line 35 = $0.00, gated off by Schedule D line 19 = $0.00')
        assertEq(r.line36, 0n, 'line 36 = $0.00, gated')
        assertEq(r.line37, 0n, 'line 37 = $0.00, gated')
        assertEq(r.line38, 0n, 'line 38 = $0.00, gated')
        assertEq(r.line39, 0n, 'line 39 = $0.00, gated')
        assertEq(r.line40, 0n, 'line 40 = $0.00, gated')
        assertEq(r.line41, 65000000n, 'line 41 = $650,000.00, the 28% add-on genuinely fires here')
        assertEq(r.line42, 5000000n, 'line 42 = $50,000.00')
        assertEq(r.line43, 1400000n, 'line 43 = $14,000.00 — the entire collectibles slice at 28%')
        assertEq(r.method44, 'taxComputationWorksheet', 'line 44 prices line 21 ($650,000.00) by the TCW')
        assertEq(r.line44, 19752025n, 'line 44 = $197,520.25, 37% x 650,000.00 - 42,979.75')
        assertEq(r.line45, 21152025n, 'line 45 = $211,520.25')
        assertEq(r.method46, 'taxComputationWorksheet', 'line 46 prices line 1 ($700,000.00) by the TCW')
        assertEq(r.line46, 21602025n, 'line 46 = $216,020.25, 37% x 700,000.00 - 42,979.75')
        assertEq(r.line47, 21152025n, 'line 47 = $211,520.25 — Form 1040 line 16')
        // Sanity cross-check (12.1-RESEARCH.md): without the 28% ceiling
        // this $50,000.00 slice would be taxed at this filer's 37%
        // marginal rate; the worksheet instead charges 28%, saving
        // exactly line46 - line45.
        assertEq(r.line46 - r.line45, 450000n, 'the 28% ceiling saves exactly $4,500.00 on this return')
    },
    // Independent dispatch, end to end: line 44 by the Tax Table and line
    // 46 by the Tax Computation Worksheet, in ONE execution. Neither
    // worked example alone exercises this — see `splitDispatchInput`'s
    // own docstring for why.
    splitDispatchLinesFortyFourAndFortySixDisagree: () => {
        const r = sdtw(taxParams2025)(splitDispatchInput)
        assertEq(r.line21, 5000000n, 'line 21 = $50,000.00')
        assertEq(r.method44, 'taxTable', 'line 44 prices line 21 ($50,000.00) by the Tax Table')
        assertEq(r.line44, 552600n, 'line 44 = $5,526.00, printed MFJ Tax Table row $50,000-$50,050')
        assertEq(r.line45, 1352100n, 'line 45 = $13,521.00')
        assertEq(r.method46, 'taxComputationWorksheet', 'line 46 prices line 1 ($150,000.00) by the TCW')
        assertEq(r.line46, 2282800n, 'line 46 = $22,828.00, 22% x 150,000.00 - 10,172.00')
        assert(
            r.method44 !== r.method46,
            ['the two lines must be free to use different methods in one execution', r.method44],
        )
        assertEq(r.line47, 1352100n, 'line 47 = $13,521.00 — Form 1040 line 16, the min selects line 45')
    },
    // The degenerate-equivalence differential (12.1-RESEARCH.md's
    // "Primary recommendation", deferred since Phase 10): when Schedule D
    // lines 18 and 19 are both zero (and Form 4952 is not filed), the
    // Schedule D Tax Worksheet and the already-shipped QDCGT worksheet
    // are algebraically identical and MUST produce the same final cents
    // figure for the same underlying return. This is what lets the
    // dispatcher's 2a-before-2c ordering be tested later by a VALUE
    // difference rather than only a method tag (12.1-CONTEXT.md,
    // "Specifics"). Reuses `splitDispatchInput`, which already satisfies
    // the precondition (lines 18/19 both zero).
    degenerateEquivalenceWithQdcgtWhenScheduleD18And19AreZero: () => {
        assertEq(splitDispatchInput.scheduleD18Cents, 0n, 'precondition: Schedule D line 18 = $0.00')
        assertEq(splitDispatchInput.scheduleD19Cents, 0n, 'precondition: Schedule D line 19 = $0.00')
        assertEq(splitDispatchInput.form4952Line4gCents, 0n, 'precondition: not filing Form 4952')
        const sdtwResult = sdtw(taxParams2025)(splitDispatchInput)
        /** @type {QdcgtInput} */
        const equivalentQdcgtInput = {
            status: splitDispatchInput.status,
            line1Cents: splitDispatchInput.line1Cents,
            line2Cents: splitDispatchInput.line2Cents,
            filingScheduleD: true,
            scheduleD15Cents: splitDispatchInput.scheduleD15Cents,
            scheduleD16Cents: splitDispatchInput.scheduleD16Cents,
            line7aCents: 0n,
        }
        const qdcgtResult = qdcgt(taxParams2025)(equivalentQdcgtInput)
        assertEq(sdtwResult.line47, qdcgtResult.line25, 'SDTW line 47 must equal QDCGT line 25 on this degenerate input')
        assert(sdtwResult.line47 !== 0n, ['the shared cents value must be non-trivial, not a vacuous 0 === 0', sdtwResult.line47])
        assertEq(sdtwResult.line47, 1352100n, 'the shared figure is $13,521.00, independently confirmed above')
    },
    // Six of the printed forks on the top half of the page have only
    // ever been walked on one side. Every fixture above enters Form 4952
    // lines 4g and 4e as zero and Schedule D lines 15 and 16 as the same
    // gain, so line 5 never has a positive difference to carry, line 7
    // never picks line 15 over line 16, line 8 never picks line 3 over
    // line 4, line 9 never floors, and lines 12 and 35 never pick line 9
    // over the Schedule D amount they are capped against. Each row here
    // is the split-dispatch fixture with the smallest override that
    // swings ONE named fork to its other side; the expected figure is
    // that line's printed instruction applied by hand to the row's own
    // inputs, never read back off the implementation.
    everyTopHalfForkIsWalkedOnBothSides: () => {
        /** @type {readonly (readonly [string, Partial<SdtwInput>, (r: Sdtw) => bigint, bigint])[]} */
        const cases = [
            // "Subtract line 4 from line 3": $500.00 - $200.00.
            ['line 5 carries the difference when 4g is the larger',
                { form4952Line4gCents: 50000n, form4952Line4eCents: 20000n }, r => r.line5, 30000n],
            // "Enter the smaller of line 15 or line 16 of Schedule D."
            ['line 7 takes Schedule D line 15 when that is the smaller',
                { scheduleD15Cents: 8000000n }, r => r.line7, 8000000n],
            // "Enter the smaller of line 3 or line 4": $200.00 against $500.00.
            ['line 8 takes line 3 when 4g is the smaller',
                { form4952Line4gCents: 20000n, form4952Line4eCents: 50000n }, r => r.line8, 20000n],
            // "Subtract line 8 from line 7. If zero or less, enter -0-":
            // line 7 is $1,000.00 and line 8 is $5,000.00, so the floor bites.
            ['line 9 floors at zero when line 8 exceeds line 7',
                {
                    scheduleD15Cents: 100000n, scheduleD16Cents: 100000n,
                    form4952Line4gCents: 500000n, form4952Line4eCents: 500000n,
                }, r => r.line9, 0n],
            // "Enter the smaller of line 9 or line 11": $10,000.00 against
            // the $50,000.00 Schedule D lines 18/19 total.
            ['line 12 takes line 9 when the Schedule D 18/19 total is larger',
                { scheduleD15Cents: 1000000n, scheduleD19Cents: 5000000n }, r => r.line12, 1000000n],
            // "Enter the smaller of line 9 or Schedule D line 19" — the
            // same two amounts, on the far side of the §1250 gate, which a
            // non-zero Schedule D line 19 also opens for the first time.
            ['line 35 takes line 9 when it is under Schedule D line 19',
                { scheduleD15Cents: 1000000n, scheduleD19Cents: 5000000n }, r => r.line35, 1000000n],
        ]
        assertEq(cases.length, 6, 'one row per fork the fixtures above leave half-walked')
        for (const [label, overrides, pick, expected] of cases) {
            assertEq(pick(sdtw(taxParams2025)({ ...splitDispatchInput, ...overrides })), expected, label)
        }
    },
    // Line 47's clamp has only ever been seen choosing line 45, because
    // every fixture above has gain to price at a preferential rate. Strip
    // the gain and the worksheet degenerates: lines 22 through 43 all fall
    // to zero, line 45 collapses to line 44 alone, and lines 44 and 46
    // price the SAME amount — line 1 — so the clamp meets an exact tie and
    // takes line 46. That the two sides meet rather than merely come close
    // is the property worth pinning: it is what makes routing a return
    // with no preferential income through this worksheet harmless.
    withNoPreferentialIncomeTheClampMeetsItsTieAndTakesLineFortySix: () => {
        const r = sdtw(taxParams2025)({ ...splitDispatchInput, scheduleD15Cents: 0n, scheduleD16Cents: 0n })
        assertEq(r.line22, 0n, 'nothing is taxed at 0%')
        assertEq(r.line31 + r.line34 + r.line40 + r.line43, 0n, 'and nothing at 15%, 20%, 25% or 28%')
        assertEq(r.line21, r.line1, 'line 21 is the whole of taxable income')
        assertEq(r.line45, r.line46, 'so the two sides of the clamp meet exactly')
        assertEq(r.line47, r.line46, 'and line 47 takes line 46')
    },
}
