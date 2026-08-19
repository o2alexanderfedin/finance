/**
 * The Capital Loss Carryover Worksheet — Lines 6 and 14 (TAX-17). Pure
 * bigint arithmetic over exactly the four prior-year result figures the
 * printed worksheet consumes: 2024 Form 1040/1040-SR/1040-NR line 15, and
 * 2024 Schedule D lines 7, 15, and 21 (carried, in this project, by
 * `vnd.fjs.prior_year_capital_loss`, `fjs/document/prior_year_capital_loss/
 * module.f.js`). No tax-year parameter of any kind feeds this computation —
 * 15-RESEARCH.md fetched `i1040sd.pdf` (2025 revision, p.10) directly and
 * confirmed the worksheet's 13 printed lines need nothing else.
 *
 * ## RED/GREEN discipline (AGENTS.md: "a proof is not known to work until
 * you have watched it fail")
 *
 * This module's three worked-example proof leaves were written FIRST against
 * a stub that always returned `{ shortTermCarryoverCents: 0n,
 * longTermCarryoverCents: 0n }`. Worked Examples B and C (below) both expect
 * a non-zero figure, so both turned RED against that stub before a single
 * line of real arithmetic existed — confirming the leaves are not decoration.
 * All three expected values are LITERAL `bigint`s, independently hand-computed
 * against the worksheet's own printed instructions (never produced by calling
 * this module's own function and pasting the output — AGENTS.md's
 * expected-side-independence rule).
 *
 * The 13 printed lines, transcribed verbatim (i1040sd.pdf, 2025 revision,
 * p.10, "Capital Loss Carryover Worksheet — Lines 6 and 14"):
 *
 *  1. Amount from prior-year Form 1040/1040-SR/1040-NR line 15 (enclose in
 *     parens if it would have been a loss).
 *  2. The loss from prior-year Schedule D line 21, as a positive amount.
 *  3. Combine lines 1 and 2; if zero or less, enter -0-.
 *  4. The smaller of line 2 or line 3.
 *     (If prior-year Schedule D line 7 is a loss, go to line 5; otherwise
 *     enter -0- on line 5 and go to line 9.)
 *  5. The loss from prior-year Schedule D line 7, as a positive amount.
 *  6. Any gain from prior-year Schedule D line 15; if a loss, enter -0-.
 *  7. Add lines 4 and 6.
 *  8. Short-term capital loss carryover: subtract line 7 from line 5; if
 *     zero or less, enter -0-.
 *     (If prior-year Schedule D line 15 is a loss, go to line 9; otherwise
 *     skip lines 9-13.)
 *  9. The loss from prior-year Schedule D line 15, as a positive amount.
 * 10. Any gain from prior-year Schedule D line 7; if a loss, enter -0-.
 * 11. Subtract line 5 from line 4; if zero or less, enter -0-.
 * 12. Add lines 10 and 11.
 * 13. Long-term capital loss carryover: subtract line 12 from line 9; if
 *     zero or less, enter -0-.
 *
 * Every printed line above is exactly one named `const` below, in printed
 * order — mirroring `fjs/schedule/d`'s own "every const is one printed line"
 * convention. Lines 4/8 skip's and lines 9-13's skip are both structurally
 * absorbed by the arithmetic (a zero-or-a-gain line 7/line 15 naturally
 * drives its dependent lines to zero without a separate branch) — this is
 * the SAME "equivalent absorption" property AGENTS.md's QDCGT line-3 example
 * documents, not something this module works around.
 *
 * `min`/`max` are written as plain ternaries below rather than imported —
 * this project has no shared bigint min/max helper, and two three-character
 * ternaries do not earn one.
 *
 * @module
 */
import { assertEq } from 'functionalscript/fjs/asserts/module.f.mjs'
import { centsFromString } from '../../exact/module.f.js'

/** @import { PriorYearCapitalLoss } from '../../document/prior_year_capital_loss/module.f.js' */

/**
 * Everything the worksheet reads: the four prior-year figures, each a
 * SIGNED bigint (cents) — every one of the four can legitimately be
 * negative (a loss year, or a prior-year AGI reduced below zero).
 * @typedef {{
 *   readonly priorYearFormLine15Cents: bigint,
 *   readonly priorYearScheduleDLine7Cents: bigint,
 *   readonly priorYearScheduleDLine15Cents: bigint,
 *   readonly priorYearScheduleDLine21Cents: bigint,
 * }} CarryoverWorksheetInputs
 */

/**
 * Derives {@link CarryoverWorksheetInputs} from an already-validated
 * `vnd.fjs.prior_year_capital_loss` document — the one place this project
 * connects the dialect's four stored decimal-string facts to the
 * worksheet's four signed-bigint-cents inputs, via `centsFromString`
 * (mirroring how every other module in this codebase crosses the
 * string-at-rest / bigint-in-computation boundary; `fjs/exact`'s own
 * docstring names this the storage/wire-to-computation layer). The
 * document is ALREADY validated by the time it reaches here — `validate`'s
 * `checkReferences` has already confirmed every one of the four fields is
 * an exact decimal string within safe magnitude — so `centsFromString`
 * (the throwing form) is used directly rather than the `Result`-returning
 * `tryCentsFromString`, exactly as `fjs/schedule/d`'s own
 * `sumBoxOverDocuments` reads an already-validated box.
 * @type {(document: PriorYearCapitalLoss) => CarryoverWorksheetInputs}
 */
export const carryoverWorksheetInputsFromDocument = document => ({
    priorYearFormLine15Cents: centsFromString(document.priorYearFormLine15),
    priorYearScheduleDLine7Cents: centsFromString(document.priorYearScheduleDLine7),
    priorYearScheduleDLine15Cents: centsFromString(document.priorYearScheduleDLine15),
    priorYearScheduleDLine21Cents: centsFromString(document.priorYearScheduleDLine21),
})

/**
 * What the worksheet produces: this year's Schedule D lines 6 and 14 —
 * always non-negative (every printed "if zero or less, enter -0-"
 * instruction floors its own line at zero, and the worksheet's final two
 * lines are both such floors).
 * @typedef {{
 *   readonly shortTermCarryoverCents: bigint,
 *   readonly longTermCarryoverCents: bigint,
 * }} CarryoverWorksheetOutputs
 */

/**
 * Computes the Capital Loss Carryover Worksheet's 13 printed lines from the
 * four prior-year figures alone. See module docstring for the source text
 * and the RED/GREEN history of this implementation's own proof leaves.
 * @type {(inputs: CarryoverWorksheetInputs) => CarryoverWorksheetOutputs}
 */
export const capitalLossCarryoverWorksheet = inputs => {
    const {
        priorYearFormLine15Cents,
        priorYearScheduleDLine7Cents,
        priorYearScheduleDLine15Cents,
        priorYearScheduleDLine21Cents,
    } = inputs

    // 1. Amount from prior-year Form 1040 line 15.
    const line1 = priorYearFormLine15Cents
    // 2. The loss from prior-year Schedule D line 21, as a positive amount.
    const line2 = priorYearScheduleDLine21Cents < 0n ? -priorYearScheduleDLine21Cents : 0n
    // 3. Combine lines 1 and 2; if zero or less, enter -0-.
    const line3Raw = line1 + line2
    const line3 = line3Raw > 0n ? line3Raw : 0n
    // 4. The smaller of line 2 or line 3.
    const line4 = line2 < line3 ? line2 : line3
    // 5. The loss from prior-year Schedule D line 7, as a positive amount.
    //    (Structurally 0 when line 7 is a gain — the printed "otherwise
    //    enter -0- on line 5" skip, absorbed by the ternary itself.)
    const line5 = priorYearScheduleDLine7Cents < 0n ? -priorYearScheduleDLine7Cents : 0n
    // 6. Any gain from prior-year Schedule D line 15; if a loss, enter -0-.
    const line6 = priorYearScheduleDLine15Cents > 0n ? priorYearScheduleDLine15Cents : 0n
    // 7. Add lines 4 and 6.
    const line7 = line4 + line6
    // 8. Short-term capital loss carryover: subtract line 7 from line 5; if
    //    zero or less, enter -0-.
    const line8Raw = line5 - line7
    const shortTermCarryoverCents = line8Raw > 0n ? line8Raw : 0n
    // 9. The loss from prior-year Schedule D line 15, as a positive amount.
    //    (Structurally 0 when line 15 is a gain — the printed "skip lines
    //    9-13" instruction, absorbed the same way line 5's skip is.)
    const line9 = priorYearScheduleDLine15Cents < 0n ? -priorYearScheduleDLine15Cents : 0n
    // 10. Any gain from prior-year Schedule D line 7; if a loss, enter -0-.
    const line10 = priorYearScheduleDLine7Cents > 0n ? priorYearScheduleDLine7Cents : 0n
    // 11. Subtract line 5 from line 4; if zero or less, enter -0-.
    const line11Raw = line4 - line5
    const line11 = line11Raw > 0n ? line11Raw : 0n
    // 12. Add lines 10 and 11.
    const line12 = line10 + line11
    // 13. Long-term capital loss carryover: subtract line 12 from line 9;
    //     if zero or less, enter -0-.
    const line13Raw = line9 - line12
    const longTermCarryoverCents = line13Raw > 0n ? line13Raw : 0n

    return { shortTermCarryoverCents, longTermCarryoverCents }
}

// ── Tests ────────────────────────────────────────────────────────────────────

export const proof = {
    // Worked Example A (fully absorbed by the $3,000 cap, single filer):
    // prior-year Schedule D line 7 = -$5,000.00 (ST loss), line 15 =
    // +$2,000.00 (LT gain), line 21 = -$3,000.00, Form 1040 line 15 =
    // +$50,000.00. Hand-computed independently against the printed
    // worksheet's own 13 lines (see this plan's PLAN.md interfaces block
    // and this module's own docstring) — NOT produced by calling
    // capitalLossCarryoverWorksheet itself: the $3,000 loss cap exactly
    // absorbs the $3,000 net loss, so nothing carries.
    workedExampleAFullyAbsorbedByTheCap: () => {
        const result = capitalLossCarryoverWorksheet({
            priorYearFormLine15Cents: 5000000n,
            priorYearScheduleDLine7Cents: -500000n,
            priorYearScheduleDLine15Cents: 200000n,
            priorYearScheduleDLine21Cents: -300000n,
        })
        assertEq(result.shortTermCarryoverCents, 0n)
        assertEq(result.longTermCarryoverCents, 0n)
    },
    // Worked Example B (partial ST carryover, single filer): prior-year
    // Schedule D line 7 = -$10,000.00 (ST loss), line 15 = +$1,000.00 (LT
    // gain), line 21 = -$3,000.00, Form 1040 line 15 = +$20,000.00.
    // Independently hand-computed: shortTermCarryoverCents = $6,000.00.
    workedExampleBPartialShortTermCarryover: () => {
        const result = capitalLossCarryoverWorksheet({
            priorYearFormLine15Cents: 2000000n,
            priorYearScheduleDLine7Cents: -1000000n,
            priorYearScheduleDLine15Cents: 100000n,
            priorYearScheduleDLine21Cents: -300000n,
        })
        assertEq(result.shortTermCarryoverCents, 600000n, '$6,000.00 short-term carryover')
        assertEq(result.longTermCarryoverCents, 0n)
    },
    // Worked Example C (LT carryover, ST is a gain, single filer): prior-year
    // Schedule D line 7 = +$1,000.00 (ST gain), line 15 = -$8,000.00 (LT
    // loss), line 21 = -$3,000.00, Form 1040 line 15 = +$30,000.00.
    // Independently hand-computed: longTermCarryoverCents = $4,000.00.
    workedExampleCLongTermCarryoverWhileShortTermIsAGain: () => {
        const result = capitalLossCarryoverWorksheet({
            priorYearFormLine15Cents: 3000000n,
            priorYearScheduleDLine7Cents: 100000n,
            priorYearScheduleDLine15Cents: -800000n,
            priorYearScheduleDLine21Cents: -300000n,
        })
        assertEq(result.shortTermCarryoverCents, 0n)
        assertEq(result.longTermCarryoverCents, 400000n, '$4,000.00 long-term carryover')
    },
    // Edge case: no prior-year loss at all (line7 = +$500, line15 = +$500,
    // line21 = $0.00, Form1040 line15 = +$40,000). The worksheet's own
    // eligibility note collapses to zero structurally, with no separate
    // gate needed — line 2/line 5/line 9 are all zero because nothing here
    // is a loss.
    edgeCaseNoPriorYearLossAtAll: () => {
        const result = capitalLossCarryoverWorksheet({
            priorYearFormLine15Cents: 4000000n,
            priorYearScheduleDLine7Cents: 50000n,
            priorYearScheduleDLine15Cents: 50000n,
            priorYearScheduleDLine21Cents: 0n,
        })
        assertEq(result.shortTermCarryoverCents, 0n)
        assertEq(result.longTermCarryoverCents, 0n)
    },
    // The document -> worksheet-inputs link: derives CarryoverWorksheetInputs
    // from a vnd.fjs.prior_year_capital_loss-shaped document via
    // centsFromString, then feeds that straight into
    // capitalLossCarryoverWorksheet — reusing Worked Example B's own
    // literals (as decimal STRINGS this time, the dialect's own storage
    // shape) so the end-to-end path is proven against the SAME
    // independently-verified expected figure the bigint-only leaf above
    // already established.
    carryoverWorksheetInputsFromDocumentDerivesWorkedExampleB: () => {
        /** @type {PriorYearCapitalLoss} */
        const document = {
            dialect: 'vnd.fjs.prior_year_capital_loss',
            recipientTin: '222-22-2222',
            taxYear: 2024,
            priorYearFormLine15: '20000.00',
            priorYearScheduleDLine7: '-10000.00',
            priorYearScheduleDLine15: '1000.00',
            priorYearScheduleDLine21: '-3000.00',
        }
        const inputs = carryoverWorksheetInputsFromDocument(document)
        assertEq(inputs.priorYearFormLine15Cents, 2000000n)
        assertEq(inputs.priorYearScheduleDLine7Cents, -1000000n)
        assertEq(inputs.priorYearScheduleDLine15Cents, 100000n)
        assertEq(inputs.priorYearScheduleDLine21Cents, -300000n)
        const result = capitalLossCarryoverWorksheet(inputs)
        assertEq(result.shortTermCarryoverCents, 600000n, '$6,000.00 short-term carryover, via the document link')
        assertEq(result.longTermCarryoverCents, 0n)
    },
}
