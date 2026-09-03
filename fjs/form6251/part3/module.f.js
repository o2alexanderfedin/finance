/**
 * Form 6251 **Part III** — TAX-33: *"Tax Computation Using Maximum Capital
 * Gains Rates"*, lines 12-40, the alternative minimum tax's own
 * qualified-dividends-and-capital-gain worksheet.
 *
 * Sources, fetched and read directly (2026-08-17), not from recall:
 * - `https://www.irs.gov/pub/irs-pdf/f6251.pdf` — the 2025 form, "Created
 *   9/17/25", **page 2**. Every printed line below is transcribed from it, in
 *   printed order, with the printed instruction quoted above it (TAX-15).
 * - `https://www.irs.gov/pub/irs-drop/rp-24-40.pdf` §2.03 and §2.11 for the
 *   dollar figures, which live in `fjs/tax/params` with their own citations and
 *   appear here only as lookups.
 *
 * ## What this worksheet is, and why it is the QDCGT's sibling
 *
 * The AMT is a parallel tax system with its own rate schedule — 26% then 28%
 * (`fjs/form6251/rate`) — but §55(b)(3) preserves the **preferential rates on
 * capital gain and qualified dividends inside it**. Part III is how the printed
 * form reconciles the two: it charges the ordinary slice at 26/28% (line 18)
 * and the preferential slice at 0% (line 23), 15% (line 31), 20% (line 34) and
 * 25% (line 37), then takes the smaller of that total and the flat 26/28%
 * figure (line 40).
 *
 * Its shape is `fjs/tax/line16/qdcgt`'s, restated on AMTI-derived amounts, and
 * it is written to be diffed against that sibling as well as against the page:
 * - line 19 is the QDCGT's line 6 (`zeroRateMax`) — the SAME stored breakpoint
 *   row, because §55(b)(3) applies §1(h)'s rates and brackets unchanged;
 * - line 25 is the QDCGT's line 13 (`fifteenRateMax`), likewise;
 * - lines 23/31/34 are the QDCGT's lines 9/18/21;
 * - line 37's 25% band is the Schedule D Tax Worksheet's lines 35-40, and
 *   `fjs/tax/line16/sdtw` writes 25% at its own printed line exactly as this
 *   module does at line 37.
 *
 * **The base is AMTI-derived, not taxable income, and that is the silent
 * error to avoid.** Line 12 is Form 6251 line 6 (AMTI less the AMT exemption),
 * never 1040 line 15. Lines 13/14/20/27 are the regular-tax worksheet's own
 * figures — the printed form says so explicitly, *"as figured for the regular
 * tax"* on lines 20 and 27 — so this worksheet mixes an AMT total with regular
 * capital-gain composition, which is exactly what the page prints and is not a
 * transcription slip.
 *
 * ## "As refigured for the AMT, if necessary" — today it is not necessary
 *
 * Lines 13 and 14 carry that parenthesis. A Schedule D refigured for the AMT
 * differs from the regular one only through an AMT basis difference, which is
 * Form 6251 **line 2k** (*"Disposition of property"*) — a refused
 * `fjs/return/scope` kind (`amtDispositionOfProperty`). So for every return
 * this engine can compute, the AMT Schedule D **is** the regular Schedule D,
 * and "if necessary" resolves to "not necessary". That is an EQUIVALENCE
 * today, not a simplification: {@link proof}.honesty's own
 * `theAmtRefiguredScheduleDIsTheRegularOneOnlyBecauseLineTwoKRefuses` records
 * it plainly, in the shape `fjs/form6251`'s
 * `theScheduleOneALineThisFormReadsIsNotYetDistinguishable` set, so the day
 * line 2k computes someone must re-choose rather than inherit this.
 *
 * ## What is structurally unreachable, and therefore not written
 *
 * - **Every Form 2555 clause** (lines 12, 13, 14, 15, 20, 27 and 40 each carry
 *   one). `fjs/tax/line16`'s dispatch level 0a refuses
 *   `foreignEarnedIncomeForm2555` before any preferential worksheet runs, so no
 *   return reaching Part III can be a Form 2555 filer. Documented, not coded.
 * - **The "did not complete either worksheet for the regular tax" fallback on
 *   lines 20 and 27** (and line 15's no-Schedule-D-Tax-Worksheet reading of
 *   line 13's *own* fallback). That case is Part III required while the regular
 *   tax used neither preferential worksheet, which happens exactly when
 *   1040 line 15 is zero or less — `fjs/tax/line16`'s level-1 gate fires before
 *   level 2 — and it is REFUSED BY NAME one module up, in `fjs/form6251`,
 *   rather than modeled here. This module's input therefore carries a
 *   two-armed fork and cannot express "neither".
 * - **A 28%-rate band.** There is none on this page, and its absence is the
 *   printed form's own decision rather than an omission: collectibles gain
 *   (Schedule D line 18) is excluded from line 13 by the Schedule D Tax
 *   Worksheet's own line 13, never added back the way line 14 adds back
 *   unrecaptured §1250 gain, and so falls into line 17 and is charged the AMT's
 *   26/28%. §1(h)(4)'s 28% and §55(b)(1)(A)'s 28% coincide, which is why the
 *   page can do this without changing anyone's tax. {@link proof}.honesty
 *   states it.
 *
 * ## The min on line 40 and the min on line 15
 *
 * Line 40 is *"the smaller of line 38 or line 39"*, and line 39 is the flat
 * 26/28% figure on line 12 — which is Form 6251 line 6, so **line 39 is
 * identically the figure `fjs/form6251` computes for its own line 7 when Part
 * III is not required.** That identity is the whole of Phase 29's upper-bound
 * mechanism, and it survives: see {@link proof}.theBound.
 *
 * `theFlatFigureIsAnUpperBoundAtEveryInput` proves the stronger statement the
 * mechanism actually rests on — line 38 ≤ line 39 always — and the reason is
 * worth writing down because it makes the printed `min` a clause that never
 * binds: every preferential rate this page charges (0%, 15%, 20%, 25%) is
 * strictly BELOW the AMT's own lower rate of 26%, and line 18 prices line 17 on
 * the same schedule line 39 prices line 12, so replacing any part of line 12
 * with a preferentially-taxed slice can only reduce the total. The `min` is
 * kept because it is what the page prints and a transcribed worksheet is diffed
 * against the page rather than minimised (`fjs/tax/line16/qdcgt` line 3's own
 * precedent).
 *
 * Line 15's `min` is different — it DOES bind, and on which limb depends on
 * `fjs/tax/line16/sdtw`'s internals rather than on anything visible here. Both
 * limbs are exercised: {@link proof}.scheduleDTaxWorksheetArm.
 *
 * ## Rounding, and where the parameters come from
 *
 * Lines 18, 31, 34, 37 and 39 are the only lines that can create a fractional
 * cent, and each rounds to the CENT via `halfUp`, because a worksheet line is a
 * line boundary (EXACT-04). The three preferential RATES are written at the
 * printed lines that print them, following both siblings —
 * `fjs/tax/line16/qdcgt` lines 18/21 and `fjs/tax/line16/sdtw` lines 31/34/40/43
 * each carry their percentage at the line, with the printed instruction quoted,
 * on the stated ground that the worksheet line itself is the verified primary
 * source. Every DOLLAR figure is a `fjs/tax/params` lookup: lines 19 and 25 read
 * the same `capitalGainsBreakpoints` rows the QDCGT reads, and lines 18 and 39
 * read `alternativeMinimumTax.upperRateThreshold`, whose married-filing-
 * separately row is the halved breakpoint. No dollar literal appears in the
 * computation below.
 *
 * @module
 */
import { assert, assertEq } from 'functionalscript/fjs/asserts/module.f.mjs'
import { of, multiply, halfUp } from '../../types/rational/module.f.js'
import { centsFromString } from '../../exact/module.f.js'
import { taxParamsByYear } from '../../tax/params/module.f.js'
import { twentySixTwentyEightPercentTax } from '../rate/module.f.js'

/** @import { IndividualFilingStatus, TaxParamSet } from '../../tax/params/module.f.js' */

/** The larger of two cents figures. @type {(a: bigint) => (b: bigint) => bigint} */
const max = a => b => a > b ? a : b

/** The smaller of two cents figures. @type {(a: bigint) => (b: bigint) => bigint} */
const min = a => b => a < b ? a : b

// ── Inputs ───────────────────────────────────────────────────────────────────

/**
 * The four lines Part III reads off the regular tax's Qualified Dividends and
 * Capital Gain Tax Worksheet, or off its Schedule D Tax Worksheet — a
 * DISCRIMINATED FORK rather than one flat record with optional fields, because
 * lines 13, 15, 20 and 27 each read a DIFFERENT line depending on which
 * worksheet the regular tax completed, and the printed page states the fork
 * four times.
 *
 * The fields are named for the **source** line, never for the Part III line
 * that reads them. That is deliberate: the caller that fills this in
 * (`fjs/form1040/core`) knows which regular-tax worksheet ran and nothing about
 * Part III's numbering, and this module knows Part III's numbering and needs no
 * second opinion about the regular tax. Naming them `partThreeLine13Cents`
 * would have put Part III's line map in two files.
 *
 * Narrow named fields rather than the whole `Qdcgt`/`Sdtw` record, following
 * `fjs/form6251`'s own stated posture toward `aStoredNineteenNineBReportsASale`:
 * handing over the whole worksheet *"would let a later edit start reading
 * amounts off"* it, and which lines Part III may read is a fact about the
 * printed page that belongs in a type.
 * @typedef {{
 *   readonly kind: 'qdcgt',
 *   readonly qdcgtLine4Cents: bigint,
 *   readonly qdcgtLine5Cents: bigint,
 * }} RegularQdcgtLines
 */

/**
 * @typedef {{
 *   readonly kind: 'scheduleDTaxWorksheet',
 *   readonly sdtwLine10Cents: bigint,
 *   readonly sdtwLine13Cents: bigint,
 *   readonly sdtwLine14Cents: bigint,
 *   readonly sdtwLine21Cents: bigint,
 * }} RegularScheduleDTaxWorksheetLines
 */

/** @typedef {RegularQdcgtLines | RegularScheduleDTaxWorksheetLines} RegularPreferentialWorksheet */

/**
 * Everything Part III reads, and nothing more.
 *
 * `line12Cents` is Form 6251 **line 6**, never 1040 line 15 — the printed line
 * 12 says *"Enter the amount from Form 6251, line 6"* and the base being
 * AMTI-derived is the whole point of this worksheet existing separately from
 * the QDCGT.
 *
 * `scheduleD19Cents` is Schedule D line 19, unrecaptured §1250 gain, which is
 * line 14 and the only input that reaches lines 35-37's 25% band.
 * @typedef {{
 *   readonly status: IndividualFilingStatus,
 *   readonly line12Cents: bigint,
 *   readonly scheduleD19Cents: bigint,
 *   readonly regularWorksheet: RegularPreferentialWorksheet,
 * }} PartThreeInput
 */

// ── Output ───────────────────────────────────────────────────────────────────

/**
 * Every printed line of Part III under its own printed number (TAX-15: one
 * printed line, one field), and nothing else. A record rather than an array for
 * `fjs/tax/line16/qdcgt`'s reason: `noUncheckedIndexedAccess` would make every
 * index `bigint | undefined`, and the only ways out are a cast or a non-null
 * assertion, both banned by AGENTS.md.
 * @typedef {{
 *   readonly line12: bigint, readonly line13: bigint, readonly line14: bigint,
 *   readonly line15: bigint, readonly line16: bigint, readonly line17: bigint,
 *   readonly line18: bigint, readonly line19: bigint, readonly line20: bigint,
 *   readonly line21: bigint, readonly line22: bigint, readonly line23: bigint,
 *   readonly line24: bigint, readonly line25: bigint, readonly line26: bigint,
 *   readonly line27: bigint, readonly line28: bigint, readonly line29: bigint,
 *   readonly line30: bigint, readonly line31: bigint, readonly line32: bigint,
 *   readonly line33: bigint, readonly line34: bigint, readonly line35: bigint,
 *   readonly line36: bigint, readonly line37: bigint, readonly line38: bigint,
 *   readonly line39: bigint, readonly line40: bigint,
 * }} PartThree
 */

/**
 * Fills in Form 6251 Part III for one return. Every `const` below is one
 * printed line, in printed order, with the printed instruction quoted above it.
 * @type {(taxParamSet: TaxParamSet) => (input: PartThreeInput) => PartThree}
 */
export const partThree = taxParamSet => input => {
    const { status, line12Cents, scheduleD19Cents, regularWorksheet } = input
    // Lines 19 and 25 are the stored §1(h) breakpoints, read from the SAME rows
    // `fjs/tax/line16/qdcgt` lines 6 and 13 read. §55(b)(3) applies §1(h)
    // unchanged inside the AMT, so a literal here — or a second AMT-specific
    // parameter — would be a second source of truth for figures Rev. Proc.
    // 2024-40 §2.03 already fixes once.
    const breakpoints = taxParamSet.capitalGainsBreakpoints[status]
    /** The 26/28% schedule, shared with Part II line 7. @type {(amountCents: bigint) => bigint} */
    const flat = twentySixTwentyEightPercentTax(taxParamSet)(status)
    // 12. "Enter the amount from Form 6251, line 6." (A Form 2555 filer enters
    //     line 3 of the line-7 worksheet instead; unreachable — see this
    //     module's docstring.)
    const line12 = line12Cents
    // 13. "Enter the amount from line 4 of the Qualified Dividends and Capital
    //     Gain Tax Worksheet in the Instructions for Form 1040 or the amount
    //     from line 13 of the Schedule D Tax Worksheet in the Instructions for
    //     Schedule D (Form 1040), whichever applies (as refigured for the AMT,
    //     if necessary)."
    //
    //     THE PREFERENTIAL SLICE: qualified dividends plus net capital gain,
    //     with unrecaptured §1250 gain and collectibles gain already removed by
    //     the Schedule D Tax Worksheet's own line 13 on that arm. "As
    //     refigured for the AMT" is not necessary today — line 2k refuses.
    const line13 = regularWorksheet.kind === 'qdcgt'
        ? regularWorksheet.qdcgtLine4Cents
        : regularWorksheet.sdtwLine13Cents
    // 14. "Enter the amount from Schedule D (Form 1040), line 19 (as refigured
    //     for the AMT, if necessary)." Unrecaptured §1250 gain, the one slice
    //     line 13 removed that this page adds back — to charge it 25% at line
    //     37 rather than the 26/28% it would otherwise attract at line 17.
    const line14 = scheduleD19Cents
    // 15. "If you did not complete a Schedule D Tax Worksheet for the regular
    //     tax or the AMT, enter the amount from line 13. Otherwise, add lines
    //     13 and 14, and enter the smaller of that result or the amount from
    //     line 10 of the Schedule D Tax Worksheet."
    //
    //     The fork is on WHICH WORKSHEET RAN, not on whether line 14 is zero:
    //     a QDCGT filer has no Schedule D Tax Worksheet line 10 to compare
    //     against and so reads line 13 flat, even though line 14 is
    //     necessarily zero for them (Schedule D line 19 non-zero routes the
    //     regular tax to the Schedule D Tax Worksheet at `fjs/tax/line16`'s
    //     dispatch bullet 2a, which PRECEDES the QDCGT bullets).
    const line15 = regularWorksheet.kind === 'qdcgt'
        ? line13
        : min(line13 + line14)(regularWorksheet.sdtwLine10Cents)
    // 16. "Enter the smaller of line 12 or line 15."
    const line16 = min(line12)(line15)
    // 17. "Subtract line 16 from line 12." No printed floor, and it cannot go
    //     negative because line 16 is a `min` that includes line 12. Asserted
    //     rather than floored, exactly as `fjs/tax/line16/qdcgt` argues for its
    //     lines 9/12/20: a defensive floor would absorb a transcription error
    //     and leave the value merely wrong, where the assert makes it loud.
    const line17 = line12 - line16
    assert(line17 >= 0n, ['Form 6251 Part III line 17 must never be negative', line17])
    // 18. "If line 17 is $239,100 or less ($119,550 or less if married filing
    //     separately), multiply line 17 by 26% (0.26). Otherwise, multiply line
    //     17 by 28% (0.28) and subtract $4,782 ($2,391 if married filing
    //     separately) from the result." THE ORDINARY SLICE, at the AMT's own
    //     rates — the same schedule line 39 and Part II line 7 apply, written
    //     once in `fjs/form6251/rate`.
    const line18 = flat(line17)
    // 19. "Enter: $96,700 if married filing jointly or qualifying surviving
    //     spouse, $48,350 if single or married filing separately, or $64,750 if
    //     head of household." The 0%-rate ceiling — QDCGT line 6's own row.
    const line19 = centsFromString(breakpoints.zeroRateMax)
    // 20. "Enter the amount from line 5 of the Qualified Dividends and Capital
    //     Gain Tax Worksheet or the amount from line 14 of the Schedule D Tax
    //     Worksheet, whichever applies (AS FIGURED FOR THE REGULAR TAX)."
    //
    //     The REGULAR tax's ordinary-income slice, and the emphasis is the
    //     printed page's own: this line is not refigured for the AMT at all.
    const line20 = regularWorksheet.kind === 'qdcgt'
        ? regularWorksheet.qdcgtLine5Cents
        : regularWorksheet.sdtwLine14Cents
    // 21. "Subtract line 20 from line 19. If zero or less, enter -0-." One of
    //     this page's printed floors. The room left under the 0% ceiling once
    //     the regular return's ordinary income has filled it.
    const line21 = max(line19 - line20)(0n)
    // 22. "Enter the smaller of line 12 or line 13."
    const line22 = min(line12)(line13)
    // 23. "Enter the smaller of line 21 or line 22. This amount is taxed at 0%."
    const line23 = min(line21)(line22)
    // 24. "Subtract line 23 from line 22." No printed floor; cannot go negative
    //     because line 23 is a `min` that includes line 22. Asserted.
    const line24 = line22 - line23
    assert(line24 >= 0n, ['Form 6251 Part III line 24 must never be negative', line24])
    // 25. "Enter: $533,400 if single, $300,000 if married filing separately,
    //     $600,050 if married filing jointly or qualifying surviving spouse, or
    //     $566,700 if head of household." The 15%-rate ceiling — QDCGT line
    //     13's own row.
    const line25 = centsFromString(breakpoints.fifteenRateMax)
    // 26. "Enter the amount from line 21." A pure copy, kept as its own printed
    //     line so a line-for-line diff against the page stays possible —
    //     QDCGT line 11's precedent.
    const line26 = line21
    // 27. "Enter the amount from line 5 of the Qualified Dividends and Capital
    //     Gain Tax Worksheet or the amount from line 21 of the Schedule D Tax
    //     Worksheet, whichever applies (as figured for the regular tax)."
    //
    //     NOTE THE ASYMMETRY, which is the easiest line on this page to get
    //     wrong: on the QDCGT arm this is the SAME figure as line 20 (both read
    //     QDCGT line 5), but on the Schedule D Tax Worksheet arm it is line 21
    //     where line 20 was line 14, and those two genuinely differ. A fixture
    //     on the QDCGT arm alone can never tell the two sources apart —
    //     {@link proof}.scheduleDTaxWorksheetArm exists for that reason.
    const line27 = regularWorksheet.kind === 'qdcgt'
        ? regularWorksheet.qdcgtLine5Cents
        : regularWorksheet.sdtwLine21Cents
    // 28. "Add line 26 and line 27."
    const line28 = line26 + line27
    // 29. "Subtract line 28 from line 25. If zero or less, enter -0-." This
    //     page's other printed floor.
    const line29 = max(line25 - line28)(0n)
    // 30. "Enter the smaller of line 24 or line 29." The 15%-taxed slice.
    const line30 = min(line24)(line29)
    // 31. "Multiply line 30 by 15% (0.15)."
    const line31 = halfUp(multiply(of(line30)(1n))(of(15n)(100n)))
    // 32. "Add lines 23 and 30."
    const line32 = line23 + line30
    // "If lines 32 and 12 are the same, skip lines 33 through 37 and go to line
    //  38. Otherwise, go to line 33." A printed SKIP, kept as a skip: a skipped
    //  printed line is blank on paper and zero here, and collapsing it into the
    //  arithmetic would lose the distinction between "computed zero" and "not
    //  reached" that TAX-15 wants every printed line to carry.
    const skipThirtyThreeToThirtySeven = line32 === line12
    // 33. "Subtract line 32 from line 22." No printed floor; cannot go negative
    //     because line 30 is bounded by line 24 = line 22 - line 23. Asserted.
    const line33 = skipThirtyThreeToThirtySeven ? 0n : line22 - line32
    assert(line33 >= 0n, ['Form 6251 Part III line 33 must never be negative', line33])
    // 34. "Multiply line 33 by 20% (0.20)." The 20%-taxed slice.
    const line34 = skipThirtyThreeToThirtySeven
        ? 0n
        : halfUp(multiply(of(line33)(1n))(of(20n)(100n)))
    // "If line 14 is zero or blank, skip lines 35 through 37 and go to line 38.
    //  Otherwise, go to line 35." The second printed skip, and it is nested
    //  inside the first: the page reaches this test only by having gone to line
    //  33, so lines 32-and-12-equal skips 35-37 as well.
    const skipThirtyFiveToThirtySeven = skipThirtyThreeToThirtySeven || line14 === 0n
    // 35. "Add lines 17, 32, and 33."
    const line35 = skipThirtyFiveToThirtySeven ? 0n : line17 + line32 + line33
    // 36. "Subtract line 35 from line 12." No printed floor. This is
    //     algebraically line 16 - line 22, i.e. exactly the slice line 15 added
    //     back at line 14 and line 22 then declined to take, which is why it is
    //     the unrecaptured §1250 gain and why line 37 charges it 25%.
    //     `theTwentyFivePercentBandIsExactlyTheUnrecapturedGain` asserts that
    //     identity rather than leaving it to be inferred. Asserted, not floored.
    const line36 = skipThirtyFiveToThirtySeven ? 0n : line12 - line35
    assert(line36 >= 0n, ['Form 6251 Part III line 36 must never be negative', line36])
    // 37. "Multiply line 36 by 25% (0.25)." The unrecaptured-§1250 band —
    //     §1(h)(1)(E)'s rate, and the Schedule D Tax Worksheet's own line 40.
    const line37 = skipThirtyFiveToThirtySeven
        ? 0n
        : halfUp(multiply(of(line36)(1n))(of(25n)(100n)))
    // 38. "Add lines 18, 31, 34, and 37." The preferential-rate build-up.
    const line38 = line18 + line31 + line34 + line37
    // 39. "If line 12 is $239,100 or less ($119,550 or less if married filing
    //     separately), multiply line 12 by 26% (0.26). Otherwise, multiply line
    //     12 by 28% (0.28) and subtract $4,782 ($2,391 if married filing
    //     separately) from the result."
    //
    //     THE FLAT FIGURE, and line 12 is Form 6251 line 6 — so this is
    //     identically what Part II line 7 would have carried had Part III not
    //     been required. That identity is Phase 29's upper bound, and it is
    //     asserted at `fjs/form6251`'s own call site as well as here.
    const line39 = flat(line12)
    // 40. "Enter the smaller of line 38 or line 39 here and on line 7."
    //     THE CLAMP — and a clause that never binds in this engine, because
    //     every preferential rate above is strictly below 26%. See this
    //     module's docstring and `theFlatFigureIsAnUpperBoundAtEveryInput`.
    const line40 = min(line38)(line39)
    return {
        line12, line13, line14, line15, line16,
        line17, line18, line19, line20, line21,
        line22, line23, line24, line25, line26,
        line27, line28, line29, line30, line31,
        line32, line33, line34, line35, line36,
        line37, line38, line39, line40,
    }
}

// ── Tests ────────────────────────────────────────────────────────────────────

/**
 * TY2025's parameter set, narrowed exactly once at module scope — the same
 * `assert` path every other consumer uses.
 */
const taxParams2025 = taxParamsByYear[2025]
assert(taxParams2025 !== undefined, 'expected TY2025 parameters to be present in taxParamsByYear')

/** Runs Part III against TY2025's real parameter set.
 * @type {(input: PartThreeInput) => PartThree}
 */
const run = input => partThree(taxParams2025)(input)

/**
 * THE FAANG RETURN'S OWN Part III, at this module — a single filer with
 * $250,000.00 of salary, $20,000.00 of qualified dividends and a $1,000,000.00
 * incentive stock option spread. Every figure below is hand-derived; the same
 * return is priced end to end through `form1040Report` in `fjs/form1040/core`.
 *
 *   1040 line 15   250,000.00 + 20,000.00 - 15,750.00      $254,250.00
 *   QDCGT line 4   the $20,000.00 of qualified dividends     $20,000.00
 *   QDCGT line 5   254,250.00 - 20,000.00                   $234,250.00
 *   6251 line 6    AMTI 1,270,000.00 less a fully phased-out
 *                  exemption                              $1,270,000.00
 * @type {PartThreeInput}
 */
const faangInput = {
    status: 'single',
    line12Cents: 127000000n,
    scheduleD19Cents: 0n,
    regularWorksheet: {
        kind: 'qdcgt',
        qdcgtLine4Cents: 2000000n,
        qdcgtLine5Cents: 23425000n,
    },
}

/**
 * A return whose preferential slice is SMALLER than line 12 but whose ordinary
 * income is nil, so line 13 wins line 22 and the 0% band on line 23 is a real
 * figure rather than a zero. Hand-constructed at the module's own boundary
 * rather than derived from a 1040, because what it exercises is a `min`, and a
 * fixture chosen to make a `min` pick its other limb is a claim about the
 * worksheet and not about any taxpayer.
 * @type {PartThreeInput}
 */
const zeroRateBandInput = {
    status: 'single',
    line12Cents: 30000000n,
    scheduleD19Cents: 0n,
    regularWorksheet: { kind: 'qdcgt', qdcgtLine4Cents: 10000000n, qdcgtLine5Cents: 0n },
}

/**
 * The Schedule D Tax Worksheet arm, with unrecaptured §1250 gain AND
 * collectibles gain, so that every one of this arm's four inputs is a DIFFERENT
 * number and none can be swapped for another without changing an answer.
 *
 * The regular return behind it, so the four figures are not arbitrary: a single
 * filer with $600,000.00 of taxable income including $200,000.00 of net capital
 * gain, of which $50,000.00 is unrecaptured §1250 gain (Schedule D line 19) and
 * $30,000.00 is 28%-rate collectibles gain (Schedule D line 18).
 *
 *   SDTW line 10   the whole preferential slice             $200,000.00
 *   SDTW line 11   Schedule D lines 18 + 19                  $80,000.00
 *   SDTW line 12   the smaller of lines 9 and 11             $80,000.00
 *   SDTW line 13   200,000.00 - 80,000.00                   $120,000.00
 *   SDTW line 14   600,000.00 - 120,000.00                  $480,000.00
 *   SDTW line 18   600,000.00 - 200,000.00                  $400,000.00
 *   SDTW line 20   min(480,000.00, the $197,300.00 breakpoint) $197,300.00
 *   SDTW line 21   the LARGER of lines 18 and 20            $400,000.00
 *
 * Lines 14 and 21 differ ($480,000.00 against $400,000.00), which is the whole
 * point: on the QDCGT arm Part III lines 20 and 27 read the same figure, so
 * only a fixture on THIS arm can tell them apart.
 * @type {PartThreeInput}
 */
const scheduleDArmInput = {
    status: 'single',
    line12Cents: 150000000n,
    scheduleD19Cents: 5000000n,
    regularWorksheet: {
        kind: 'scheduleDTaxWorksheet',
        sdtwLine10Cents: 20000000n,
        sdtwLine13Cents: 12000000n,
        sdtwLine14Cents: 48000000n,
        sdtwLine21Cents: 40000000n,
    },
}

export const proof = {
    // ★ THE MOTIVATING RETURN, all twenty-nine printed lines, each asserted
    // individually rather than line 40 alone — a twenty-nine-line worksheet
    // with two compensating transcription errors totals correctly, which is
    // `fjs/tax/table`'s `rowByRowDiffMatchesPublishedTable` precedent and
    // `qdcgt`'s regression pair's.
    //
    // Every figure hand-derived from the printed page and the stored
    // breakpoints, arithmetic shown:
    //   12  Form 6251 line 6                             $1,270,000.00
    //   13  QDCGT line 4                                    $20,000.00
    //   14  Schedule D line 19, no Schedule D                     $0.00
    //   15  the QDCGT arm reads line 13 flat                 $20,000.00
    //   16  min(1,270,000.00, 20,000.00)                     $20,000.00
    //   17  1,270,000.00 - 20,000.00                      $1,250,000.00
    //   18  26% x 239,100.00 = 62,166.00
    //     + 28% x 1,010,900.00 = 283,052.00                 $345,218.00
    //   19  the single-filer 0% ceiling                       $48,350.00
    //   20  QDCGT line 5                                    $234,250.00
    //   21  48,350.00 - 234,250.00 is negative, so             -0-
    //   22  min(1,270,000.00, 20,000.00)                     $20,000.00
    //   23  min(0.00, 20,000.00) -- NOTHING at 0%                 $0.00
    //   24  20,000.00 - 0.00                                 $20,000.00
    //   25  the single-filer 15% ceiling                    $533,400.00
    //   26  a copy of line 21                                    $0.00
    //   27  QDCGT line 5 again, this arm's asymmetry        $234,250.00
    //   28  0.00 + 234,250.00                              $234,250.00
    //   29  533,400.00 - 234,250.00                        $299,150.00
    //   30  min(20,000.00, 299,150.00)                      $20,000.00
    //   31  15% x 20,000.00                                  $3,000.00
    //   32  0.00 + 20,000.00                                $20,000.00
    //   33  20,000.00 - 20,000.00                                $0.00
    //   34  20% x 0.00                                           $0.00
    //   35  line 14 is zero: skipped                             $0.00
    //   36  skipped                                              $0.00
    //   37  skipped                                              $0.00
    //   38  345,218.00 + 3,000.00                          $348,218.00
    //   39  26% x 239,100.00 + 28% x 1,030,900.00          $350,818.00
    //   40  min(348,218.00, 350,818.00)                     $348,218.00
    //
    // AND THE POINT OF THE WHOLE PHASE, as its own assertion: the flat figure
    // on line 39 is $350,818.00 and Part III's answer is $348,218.00, a
    // difference of exactly $2,600.00 -- which is the $20,000.00 of qualified
    // dividends charged 15% ($3,000.00) instead of the 28% ($5,600.00) the flat
    // computation would have charged. Derived independently of every line
    // above: 28% - 15% = 13%, and 13% of $20,000.00 is $2,600.00.
    theFaangReturnAllTwentyNineLines: () => {
        const r = run(faangInput)
        assertEq(r.line12, 127000000n, 'line 12 = $1,270,000.00')
        assertEq(r.line13, 2000000n, 'line 13 = $20,000.00')
        assertEq(r.line14, 0n, 'line 14 = $0.00')
        assertEq(r.line15, 2000000n, 'line 15 = $20,000.00')
        assertEq(r.line16, 2000000n, 'line 16 = $20,000.00')
        assertEq(r.line17, 125000000n, 'line 17 = $1,250,000.00')
        assertEq(r.line18, 34521800n, 'line 18 = $62,166.00 + $283,052.00 = $345,218.00')
        assertEq(r.line19, 4835000n, 'line 19 = $48,350.00')
        assertEq(r.line20, 23425000n, 'line 20 = $234,250.00')
        assertEq(r.line21, 0n, 'line 21 = -0-, the ordinary income fills the 0% ceiling')
        assertEq(r.line22, 2000000n, 'line 22 = $20,000.00')
        assertEq(r.line23, 0n, 'line 23 = $0.00 -- nothing is taxed at 0%')
        assertEq(r.line24, 2000000n, 'line 24 = $20,000.00')
        assertEq(r.line25, 53340000n, 'line 25 = $533,400.00')
        assertEq(r.line26, 0n, 'line 26 = $0.00')
        assertEq(r.line27, 23425000n, 'line 27 = $234,250.00')
        assertEq(r.line28, 23425000n, 'line 28 = $234,250.00')
        assertEq(r.line29, 29915000n, 'line 29 = $299,150.00')
        assertEq(r.line30, 2000000n, 'line 30 = $20,000.00')
        assertEq(r.line31, 300000n, 'line 31 = $3,000.00')
        assertEq(r.line32, 2000000n, 'line 32 = $20,000.00')
        assertEq(r.line33, 0n, 'line 33 = $0.00')
        assertEq(r.line34, 0n, 'line 34 = $0.00')
        assertEq(r.line35, 0n, 'line 35 = $0.00, skipped: line 14 is zero')
        assertEq(r.line36, 0n, 'line 36 = $0.00, skipped')
        assertEq(r.line37, 0n, 'line 37 = $0.00, skipped')
        assertEq(r.line38, 34821800n, 'line 38 = $348,218.00')
        assertEq(r.line39, 35081800n, 'line 39 = $350,818.00, the flat 26/28% figure')
        assertEq(r.line40, 34821800n, 'line 40 = $348,218.00 -- and thence Form 6251 line 7')
        // THE SAVING, stated as its own assertion so this leaf says WHAT Part
        // III buys rather than merely reporting a number. 13% of $20,000.00.
        assertEq(
            r.line39 - r.line40, 260000n,
            'the flat computation would charge 28% on the qualified dividends; Part III charges 15%')
        assertEq(r.line40, r.line38, 'here the min selects line 38, as it always does')
    },
    zeroRateBand: {
        // THE 0% BAND, and line 13 winning line 22 -- the two things the FAANG
        // fixture cannot show, because its ordinary income buries the 0%
        // ceiling and its line 12 dwarfs its line 13.
        //
        //   12  hand-constructed                              $300,000.00
        //   13  the whole preferential slice                  $100,000.00
        //   15  the QDCGT arm reads line 13                   $100,000.00
        //   16  min(300,000.00, 100,000.00)                   $100,000.00
        //   17  300,000.00 - 100,000.00                       $200,000.00
        //   18  200,000.00 is at or below 239,100.00, so 26%   $52,000.00
        //   20  no ordinary income at all                           $0.00
        //   21  48,350.00 - 0.00                               $48,350.00
        //   22  min(300,000.00, 100,000.00) -- LINE 13 WINS   $100,000.00
        //   23  min(48,350.00, 100,000.00) -- a REAL 0% band   $48,350.00
        //   24  100,000.00 - 48,350.00                         $51,650.00
        //   28  48,350.00 + 0.00                               $48,350.00
        //   29  533,400.00 - 48,350.00                        $485,050.00
        //   30  min(51,650.00, 485,050.00)                     $51,650.00
        //   31  15% x 51,650.00                                 $7,747.50
        //   32  48,350.00 + 51,650.00                         $100,000.00
        //   33  100,000.00 - 100,000.00                             $0.00
        //   38  52,000.00 + 7,747.50                           $59,747.50
        //   39  62,166.00 + 28% x 60,900.00 = 17,052.00        $79,218.00
        //   40  min(59,747.50, 79,218.00)                      $59,747.50
        theZeroRateBandAndLineThirteenWinningLineTwentyTwo: () => {
            const r = run(zeroRateBandInput)
            assertEq(r.line16, 10000000n, 'line 16 = $100,000.00 -- line 15 is the smaller')
            assertEq(r.line17, 20000000n, 'line 17 = $200,000.00')
            assertEq(r.line18, 5200000n, 'line 18 = 26% of $200,000.00 = $52,000.00, the LOWER band')
            assertEq(r.line21, 4835000n, 'line 21 = the whole $48,350.00 ceiling')
            assertEq(r.line22, 10000000n, 'line 22 = $100,000.00 -- line 13 is the smaller here')
            assertEq(r.line23, 4835000n, 'line 23 = $48,350.00 taxed at 0%')
            assertEq(r.line24, 5165000n, 'line 24 = $51,650.00')
            assertEq(r.line29, 48505000n, 'line 29 = $485,050.00')
            assertEq(r.line30, 5165000n, 'line 30 = $51,650.00')
            assertEq(r.line31, 774750n, 'line 31 = 15% of $51,650.00 = $7,747.50')
            assertEq(r.line32, 10000000n, 'line 32 = $100,000.00')
            assertEq(r.line33, 0n, 'line 33 = $0.00')
            assertEq(r.line38, 5974750n, 'line 38 = $59,747.50')
            assertEq(r.line39, 7921800n, 'line 39 = $79,218.00')
            assertEq(r.line40, 5974750n, 'line 40 = $59,747.50')
            // The 0% band is worth REAL money, stated against the fixture that
            // has none: without it these $48,350.00 would be charged 15%.
            const faang = run(faangInput)
            assertEq(faang.line23, 0n, 'the FAANG return taxes nothing at 0%')
            assert(
                r.line23 > 0n,
                ['and this one taxes $48,350.00 at 0%, so the pair distinguishes the band', r.line23])
        },
        // THE 20% BAND, which neither fixture above reaches: line 33 is zero in
        // both, because in both the whole of line 22 fits under the 15%
        // ceiling. Here $466,600.00 does not.
        //
        //   12  hand-constructed                            $1,000,000.00
        //   13  the preferential slice                        $800,000.00
        //   16  min(1,000,000.00, 800,000.00)                 $800,000.00
        //   17  1,000,000.00 - 800,000.00                     $200,000.00
        //   18  26% x 200,000.00                               $52,000.00
        //   20  the regular return's ordinary income           $200,000.00
        //   21  48,350.00 - 200,000.00 is negative                  -0-
        //   22  min(1,000,000.00, 800,000.00)                 $800,000.00
        //   23  min(0.00, 800,000.00)                               $0.00
        //   24  800,000.00                                    $800,000.00
        //   27  the regular return's ordinary income          $200,000.00
        //   28  0.00 + 200,000.00                             $200,000.00
        //   29  533,400.00 - 200,000.00                       $333,400.00
        //   30  min(800,000.00, 333,400.00)                   $333,400.00
        //   31  15% x 333,400.00                               $50,010.00
        //   32  0.00 + 333,400.00                             $333,400.00
        //   33  800,000.00 - 333,400.00                       $466,600.00
        //   34  20% x 466,600.00                               $93,320.00
        //   38  52,000.00 + 50,010.00 + 93,320.00             $195,330.00
        //   39  62,166.00 + 28% x 760,900.00 = 213,052.00     $275,218.00
        //   40  min(195,330.00, 275,218.00)                   $195,330.00
        theTwentyPercentBand: () => {
            const r = run({
                status: 'single',
                line12Cents: 100000000n,
                scheduleD19Cents: 0n,
                regularWorksheet: {
                    kind: 'qdcgt', qdcgtLine4Cents: 80000000n, qdcgtLine5Cents: 20000000n,
                },
            })
            assertEq(r.line29, 33340000n, 'line 29 = $333,400.00 of room under the 15% ceiling')
            assertEq(r.line30, 33340000n, 'line 30 = $333,400.00 at 15%')
            assertEq(r.line31, 5001000n, 'line 31 = $50,010.00')
            assertEq(r.line32, 33340000n, 'line 32 = $333,400.00')
            assertEq(r.line33, 46660000n, 'line 33 = $466,600.00 -- above the 15% ceiling')
            assertEq(r.line34, 9332000n, 'line 34 = 20% of $466,600.00 = $93,320.00')
            assertEq(r.line35, 0n, 'line 35 = $0.00: line 14 is zero, so 35-37 are still skipped')
            assertEq(r.line38, 19533000n, 'line 38 = $195,330.00')
            assertEq(r.line39, 27521800n, 'line 39 = $275,218.00')
            assertEq(r.line40, 19533000n, 'line 40 = $195,330.00')
        },
    },
    scheduleDTaxWorksheetArm: {
        // ★ THE OTHER ARM, and the 25% band with it. Unrecaptured §1250 gain
        // reaches lines 35-37, and Part III lines 20 and 27 read two DIFFERENT
        // Schedule D Tax Worksheet lines -- which no fixture on the QDCGT arm
        // can observe, because there both read QDCGT line 5.
        //
        //   12  hand-constructed (a large ISO spread)       $1,500,000.00
        //   13  SDTW line 13                                  $120,000.00
        //   14  Schedule D line 19, the §1250 gain             $50,000.00
        //   15  min(120,000 + 50,000 = 170,000, SDTW line 10
        //       = 200,000)                                    $170,000.00
        //   16  min(1,500,000.00, 170,000.00)                 $170,000.00
        //   17  1,500,000.00 - 170,000.00                   $1,330,000.00
        //   18  62,166.00 + 28% x 1,090,900.00 = 305,452.00   $367,618.00
        //   20  SDTW line 14                                  $480,000.00
        //   21  48,350.00 - 480,000.00 is negative                  -0-
        //   22  min(1,500,000.00, 120,000.00)                 $120,000.00
        //   23  min(0.00, 120,000.00)                               $0.00
        //   24  120,000.00                                    $120,000.00
        //   27  SDTW line 21 -- NOT line 14                   $400,000.00
        //   28  0.00 + 400,000.00                             $400,000.00
        //   29  533,400.00 - 400,000.00                       $133,400.00
        //   30  min(120,000.00, 133,400.00)                   $120,000.00
        //   31  15% x 120,000.00                               $18,000.00
        //   32  0.00 + 120,000.00                             $120,000.00
        //   33  120,000.00 - 120,000.00                             $0.00
        //   34  20% x 0.00                                          $0.00
        //   35  1,330,000.00 + 120,000.00 + 0.00            $1,450,000.00
        //   36  1,500,000.00 - 1,450,000.00                   $50,000.00
        //   37  25% x 50,000.00                                $12,500.00
        //   38  367,618.00 + 18,000.00 + 0.00 + 12,500.00     $398,118.00
        //   39  62,166.00 + 28% x 1,260,900.00 = 353,052.00   $415,218.00
        //   40  min(398,118.00, 415,218.00)                   $398,118.00
        theScheduleDArmWithUnrecapturedGainAllTwentyNineLines: () => {
            const r = run(scheduleDArmInput)
            assertEq(r.line12, 150000000n, 'line 12 = $1,500,000.00')
            assertEq(r.line13, 12000000n, 'line 13 = SDTW line 13 = $120,000.00')
            assertEq(r.line14, 5000000n, 'line 14 = Schedule D line 19 = $50,000.00')
            assertEq(r.line15, 17000000n, 'line 15 = $170,000.00 -- lines 13 + 14, the smaller limb')
            assertEq(r.line16, 17000000n, 'line 16 = $170,000.00')
            assertEq(r.line17, 133000000n, 'line 17 = $1,330,000.00')
            assertEq(r.line18, 36761800n, 'line 18 = $62,166.00 + $305,452.00 = $367,618.00')
            assertEq(r.line19, 4835000n, 'line 19 = $48,350.00')
            assertEq(r.line20, 48000000n, 'line 20 = SDTW line 14 = $480,000.00')
            assertEq(r.line21, 0n, 'line 21 = -0-')
            assertEq(r.line22, 12000000n, 'line 22 = $120,000.00')
            assertEq(r.line23, 0n, 'line 23 = $0.00')
            assertEq(r.line24, 12000000n, 'line 24 = $120,000.00')
            assertEq(r.line25, 53340000n, 'line 25 = $533,400.00')
            assertEq(r.line26, 0n, 'line 26 = $0.00')
            assertEq(r.line27, 40000000n, 'line 27 = SDTW line 21 = $400,000.00')
            assertEq(r.line28, 40000000n, 'line 28 = $400,000.00')
            assertEq(r.line29, 13340000n, 'line 29 = $133,400.00')
            assertEq(r.line30, 12000000n, 'line 30 = $120,000.00')
            assertEq(r.line31, 1800000n, 'line 31 = $18,000.00')
            assertEq(r.line32, 12000000n, 'line 32 = $120,000.00')
            assertEq(r.line33, 0n, 'line 33 = $0.00')
            assertEq(r.line34, 0n, 'line 34 = $0.00')
            assertEq(r.line35, 145000000n, 'line 35 = $1,450,000.00')
            assertEq(r.line36, 5000000n, 'line 36 = $50,000.00')
            assertEq(r.line37, 1250000n, 'line 37 = 25% of $50,000.00 = $12,500.00')
            assertEq(r.line38, 39811800n, 'line 38 = $398,118.00')
            assertEq(r.line39, 41521800n, 'line 39 = $415,218.00')
            assertEq(r.line40, 39811800n, 'line 40 = $398,118.00')
            // LINES 20 AND 27 READ DIFFERENT SOURCES, stated as an inequality
            // on this fixture -- the only shape that can say so. On the QDCGT
            // arm the two are identically QDCGT line 5, so a mutation swapping
            // the sources is an EQUIVALENT MUTANT there.
            assert(
                r.line20 !== r.line27,
                ['lines 20 and 27 read SDTW lines 14 and 21, which differ', r.line20, r.line27])
            const faang = run(faangInput)
            assertEq(
                faang.line20, faang.line27,
                'and on the QDCGT arm they are the same figure, which is why this fixture exists')
        },
        // Line 36 IS the unrecaptured §1250 gain, exactly, and that is an
        // algebraic identity rather than a coincidence of this fixture: line 35
        // is line 17 + line 32 + line 33 = (line 12 - line 16) + line 22, so
        // line 36 = line 16 - line 22 -- the slice line 15 added back at line
        // 14 and line 22 then declined to take.
        //
        // Written as a comparison against the INPUT rather than a second
        // literal, so a wiring that computed the right 25% band from the wrong
        // quantity names itself.
        theTwentyFivePercentBandIsExactlyTheUnrecapturedGain: () => {
            const r = run(scheduleDArmInput)
            assertEq(
                r.line36, scheduleDArmInput.scheduleD19Cents,
                'line 36 is Schedule D line 19, arrived at by four printed lines')
            assertEq(r.line36, r.line16 - r.line22, 'the identity: line 36 = line 16 - line 22')
            assertEq(r.line37, 1250000n, '25% of it')
        },
        // LINE 15's OTHER LIMB. Above, lines 13 + 14 was the smaller; here
        // Schedule D Tax Worksheet line 10 is, so the printed `min` genuinely
        // binds both ways. The shape is reachable: SDTW line 13 is line 10 less
        // the SMALLER of its lines 9 and 11, so when Schedule D line 19 alone
        // exceeds SDTW line 9 the sum overshoots line 10.
        //   13 + 14 = 190,000.00 + 50,000.00 = 240,000.00
        //   SDTW line 10                        200,000.00  <- the smaller
        lineFifteenTakesScheduleDTaxWorksheetLineTenWhenTheSumOvershoots: () => {
            const r = run({
                ...scheduleDArmInput,
                regularWorksheet: {
                    kind: 'scheduleDTaxWorksheet',
                    sdtwLine10Cents: 20000000n,
                    sdtwLine13Cents: 19000000n,
                    sdtwLine14Cents: 48000000n,
                    sdtwLine21Cents: 40000000n,
                },
            })
            assertEq(r.line13, 19000000n, 'line 13 = $190,000.00')
            assertEq(r.line15, 20000000n, 'line 15 = $200,000.00 -- SDTW line 10 is the smaller limb')
            assert(
                r.line15 < r.line13 + r.line14,
                ['the sum overshot and the min clamped it', r.line13 + r.line14, r.line15])
            // …and the control, on the fixture above, where the sum wins.
            const sumWins = run(scheduleDArmInput)
            assertEq(
                sumWins.line15, sumWins.line13 + sumWins.line14,
                'the min does not clamp when the sum is already smaller')
        },
        // A QDCGT-arm return reads line 13 FLAT -- it has no Schedule D Tax
        // Worksheet line 10 to compare against. Stated by giving the two arms
        // the same line 13 and line 14 and showing the answers differ, which is
        // the only way to see that the fork is on WHICH WORKSHEET RAN rather
        // than on whether line 14 is zero.
        theQdcgtArmReadsLineThirteenFlatEvenWithAnUnrecapturedGain: () => {
            const asQdcgt = run({
                status: 'single',
                line12Cents: 150000000n,
                scheduleD19Cents: 5000000n,
                regularWorksheet: {
                    kind: 'qdcgt', qdcgtLine4Cents: 12000000n, qdcgtLine5Cents: 48000000n,
                },
            })
            assertEq(asQdcgt.line13, 12000000n, 'the same line 13 as the Schedule D arm')
            assertEq(asQdcgt.line14, 5000000n, 'and the same line 14')
            assertEq(asQdcgt.line15, 12000000n, 'but line 15 is line 13 FLAT, not 13 + 14')
            const asScheduleD = run(scheduleDArmInput)
            assertEq(asScheduleD.line15, 17000000n, 'where the other arm adds line 14 in')
            assert(
                asQdcgt.line40 !== asScheduleD.line40,
                ['and the fork reaches the answer', asQdcgt.line40, asScheduleD.line40])
        },
    },
    theBound: {
        // ★ CRITERION 2, at the module that could break it. Line 39 is the flat
        // 26/28% figure on line 12, and line 40 is the smaller of it and line
        // 38 -- so Part III's answer is an upper bound on nothing less than
        // Phase 29's whole mechanism.
        //
        // The stronger statement, which is what the mechanism rests on: line 38
        // is ALSO never above line 39, because every preferential rate this
        // page charges (0%, 15%, 20%, 25%) is strictly below the AMT's own
        // lower rate of 26%, and line 18 prices line 17 on the same schedule
        // line 39 prices line 12. So the printed `min` never binds -- and that
        // is a property of the code nobody had written down, recorded here
        // rather than left to a mutation to discover.
        //
        // Swept over both arms, both rate bands, a zero line 12, a line 12 at
        // the 26/28% breakpoint, and one either side of it.
        theFlatFigureIsAnUpperBoundAtEveryInput: () => {
            /** @type {readonly PartThreeInput[]} */
            const sweep = [
                faangInput,
                zeroRateBandInput,
                scheduleDArmInput,
                { ...faangInput, line12Cents: 0n },
                { ...faangInput, line12Cents: 23910000n },
                { ...faangInput, line12Cents: 23910001n },
                { ...faangInput, line12Cents: 23909999n },
                { ...faangInput, status: 'marriedFilingSeparately' },
                { ...scheduleDArmInput, status: 'marriedFilingJointly' },
                { ...zeroRateBandInput, status: 'headOfHousehold' },
                { ...zeroRateBandInput, status: 'qualifyingSurvivingSpouse' },
            ]
            // A HAND-TYPED count beside the loop, per AGENTS.md: a proof that
            // iterates a list it also defines cannot notice the list shrinking.
            assertEq(sweep.length, 11, 'eleven swept inputs, hand-counted')
            for (const input of sweep) {
                const r = run(input)
                assert(
                    r.line38 <= r.line39,
                    ['line 38 must never exceed line 39', input.status, r.line38, r.line39])
                assertEq(
                    r.line40, r.line38,
                    ['so the printed min always selects line 38', input.status, r.line40])
                assert(
                    r.line40 <= r.line39,
                    ['THE BOUND: Part III can only be lower than the flat figure', r.line40, r.line39])
            }
        },
        // Line 39 is IDENTICALLY the flat computation on line 12, which is what
        // makes the bound exact rather than approximate. Asserted against an
        // INDEPENDENT call into `fjs/form6251/rate` rather than against Part
        // III's own arithmetic -- and against a hand-typed figure as well, so a
        // rate module that was wrong in both places would still be caught.
        lineThirtyNineIsTheFlatTwentySixTwentyEightFigureOnLineTwelve: () => {
            const r = run(faangInput)
            assertEq(
                r.line39,
                twentySixTwentyEightPercentTax(taxParams2025)('single')(faangInput.line12Cents),
                'line 39 is the shared §55(b)(1)(A) schedule applied to line 12')
            // Hand-typed: 26% of 239,100.00 = 62,166.00, plus 28% of
            // 1,030,900.00 = 288,652.00.
            assertEq(r.line39, 35081800n, '$62,166.00 + $288,652.00 = $350,818.00')
        },
        // The breakpoint is HALVED for married filing separately on lines 18 AND
        // 39, and on nothing else on this page. Asserted as a comparison
        // between two statuses at ONE line 12, so a status reading the wrong
        // row names itself -- `fjs/form6251`'s
        // `theBreakpointIsHalvedForMarriedFilingSeparately` precedent, applied
        // to Part III's two occurrences.
        //
        //   line 12 = 300,000.00, line 13 = 0.00, so line 17 = 300,000.00
        //   single: 26% x 239,100.00 = 62,166.00
        //         + 28% x  60,900.00 = 17,052.00        =  79,218.00
        //   MFS:    26% x 119,550.00 = 31,083.00
        //         + 28% x 180,450.00 = 50,526.00        =  81,609.00
        theBreakpointIsHalvedForMarriedFilingSeparatelyOnBothLines: () => {
            /** @type {PartThreeInput} */
            const base = {
                status: 'single',
                line12Cents: 30000000n,
                scheduleD19Cents: 0n,
                regularWorksheet: { kind: 'qdcgt', qdcgtLine4Cents: 0n, qdcgtLine5Cents: 0n },
            }
            const single = run(base)
            assertEq(single.line17, 30000000n, 'the whole of line 12 is ordinary here')
            assertEq(single.line18, 7921800n, 'line 18 = $62,166.00 + $17,052.00 = $79,218.00')
            assertEq(single.line39, 7921800n, 'and line 39 agrees, reading the same line 12')
            const separate = run({ ...base, status: 'marriedFilingSeparately' })
            assertEq(separate.line18, 8160900n, 'line 18 = $31,083.00 + $50,526.00 = $81,609.00')
            assertEq(separate.line39, 8160900n, 'and line 39 too')
            assert(
                separate.line18 > single.line18,
                'the halved breakpoint pushes more of the same base into the 28% band')
        },
        // The two 26/28% lines read DIFFERENT amounts -- line 18 reads line 17
        // and line 39 reads line 12 -- and on the fixture above they coincide
        // because line 13 is zero. The FAANG fixture is where they differ, and
        // this leaf says so, because a wiring that pointed line 18 at line 12
        // would pass every leaf that only checks line 39.
        lineEighteenReadsLineSeventeenAndLineThirtyNineReadsLineTwelve: () => {
            const r = run(faangInput)
            assertEq(r.line18, 34521800n, 'line 18 prices line 17 = $1,250,000.00')
            assertEq(r.line39, 35081800n, 'line 39 prices line 12 = $1,270,000.00')
            assert(
                r.line18 !== r.line39,
                ['the two must read different amounts', r.line18, r.line39])
            assertEq(
                r.line39 - r.line18, 560000n,
                '28% of the $20,000.00 that line 17 excludes = $5,600.00, hand-computed')
        },
    },
    honesty: {
        // Line 13's and line 14's "as refigured for the AMT, if necessary" is
        // NOT NECESSARY today, and this leaf records that rather than pretending
        // a fixture pins it. A Schedule D refigured for the AMT differs from the
        // regular one only through an AMT basis difference, which is Form 6251
        // line 2k -- a REFUSED `fjs/return/scope` kind. So for every return this
        // engine can compute the two Schedule Ds are the same document, and a
        // mutation substituting one for the other would be an equivalent mutant.
        //
        // What this leaf pins instead is the SHAPE of the input: the fields are
        // named for the regular-tax worksheet lines they carry, so the day line
        // 2k computes, `fjs/form1040/core`'s wiring has to choose, and this
        // comment is where the choice is written down.
        theAmtRefiguredScheduleDIsTheRegularOneOnlyBecauseLineTwoKRefuses: () => {
            assert(
                'sdtwLine13Cents' in scheduleDArmInput.regularWorksheet,
                'the input names the REGULAR worksheet line, not an AMT-refigured one')
            assert(
                'qdcgtLine5Cents' in faangInput.regularWorksheet,
                'on the other arm too')
        },
        // THERE IS NO 28% BAND ON THIS PAGE, and its absence is deliberate.
        // Collectibles gain (Schedule D line 18) is removed from line 13 by the
        // Schedule D Tax Worksheet's own line 13 and -- unlike unrecaptured
        // §1250 gain, which line 14 adds back -- never returns, so it lands in
        // line 17 and is charged the AMT's 26/28%. §1(h)(4)'s 28% and
        // §55(b)(1)(A)'s 28% coincide, which is why the page can do this
        // without changing anyone's tax.
        //
        // Exhibited on the Schedule D fixture, whose regular return holds
        // $30,000.00 of collectibles gain: 200,000.00 - 120,000.00 - 50,000.00
        // = 30,000.00 is present in NO preferential band and is inside line 17.
        collectiblesGainIsChargedTheAmtRateBecauseThereIsNoTwentyEightPercentBand: () => {
            const r = run(scheduleDArmInput)
            const preferentiallyTaxed = r.line23 + r.line30 + r.line33 + r.line36
            assertEq(
                preferentiallyTaxed, 17000000n,
                'the four preferential bands total $170,000.00 -- line 15, and no more')
            // The $30,000.00 of collectibles gain is NOT among them. The
            // fixture's worksheet arm is narrowed by ONE assert rather than by
            // a ternary: `scheduleDArmInput` is a `const` declared above with
            // `kind: 'scheduleDTaxWorksheet'` written out, so a `: 0n` arm was
            // reachable by nothing and could only ever sit uncovered, and an
            // expectation that quietly falls back to `0n` when the narrow
            // fails is an expectation that stops testing without saying so.
            const regularWorksheet = scheduleDArmInput.regularWorksheet
            assert(
                regularWorksheet.kind === 'scheduleDTaxWorksheet',
                ['this fixture is the Schedule D Tax Worksheet arm', regularWorksheet.kind])
            assertEq(
                regularWorksheet.sdtwLine10Cents - preferentiallyTaxed,
                3000000n,
                'the $30,000.00 of collectibles gain sits outside every preferential band')
            assert(
                r.line17 > 0n,
                ['and therefore inside line 17, at the AMT\'s own 26/28%', r.line17])
        },
        // Every printed line of Part III is a named field, and the count is
        // HAND-TYPED beside `Object.keys`, which is derived from the thing under
        // test and so can never notice a line quietly disappearing.
        everyPrintedLineIsNamed: () => {
            const r = run(faangInput)
            // Lines 12 through 40 inclusive: 40 - 12 + 1.
            const expectedFieldCount = 29
            assertEq(
                Object.keys(r).length, expectedFieldCount,
                ['expected exactly the twenty-nine printed lines', Object.keys(r)])
        },
    },
}
