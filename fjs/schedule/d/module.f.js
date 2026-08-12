/**
 * Schedule D (Form 1040) — TAX-11: lines 1a through 21, over Form 8949's
 * category totals and 1099-DIV boxes 2a/2b/2d, plus the two sub-worksheets
 * the Schedule D Tax Worksheet needs (the 28% Rate Gain Worksheet, line 18;
 * the Unrecaptured Section 1250 Gain Worksheet, line 19).
 *
 * Source, fetched and read directly (12.1-RESEARCH.md), not from recall:
 * `https://www.irs.gov/pub/irs-pdf/f1040sd.pdf` (2025 revision, "Created
 * 10/6/25") for the schedule's own printed lines; `i1040sd.pdf` (2025
 * revision, `Dec 11, 2025`) p.11 for the 28% Rate Gain Worksheet and pp.13-14
 * for the Unrecaptured Section 1250 Gain Worksheet.
 *
 * This is a STANDALONE, independently callable pure function over stored
 * `vnd.fjs.1099b`/`vnd.fjs.1099div` documents plus one filing status — the
 * same relationship `fjs/form8949` has to `vnd.fjs.1099b` alone. It is NOT
 * wired into Form 1040's own income-line or tax-and-payment-line
 * aggregation, and it does not consult the return-scope guard's own
 * classification function. It imports NOTHING at runtime from `fjs/tax/`,
 * `fjs/return/`, or `fjs/form1040/` — the only runtime `fjs/*` import is
 * `fjs/form8949`, whose category totals this module composes into Schedule
 * D's own lines. `IndividualFilingStatus` is pulled in via a type-only
 * JSDoc `@import` from `fjs/tax/params`, never a runtime import.
 *
 * ## Lines 17, 20 and 22 are deliberately NOT this module's job
 *
 * Line 17 ("are lines 15 and 16 both gains?") is already computed by
 * `fjs/tax/line16/module.f.js` as `scheduleDLinesFifteenAndSixteenAreBothGains`
 * — reimplementing it here would violate AGENTS.md's "one rule, one place."
 * Line 20 (the QDCGT/SDTW routing) is `dispatchLine16`'s own job. Line 22
 * (qualified dividends) is Form 1040 line 3a's own concern. None of the
 * three appears in this module's exported contract.
 *
 * ## Prior-year carryover (Schedule D lines 6 and 14) — CLOSED, Plan 15-05
 *
 * The short-term and long-term capital loss carryovers (lines 6 and 14) were
 * a documented multi-year seam through Plan 15-02; Plan 15-05 closes it.
 * `ScheduleDInputs.priorYearCapitalLossCarryover` is OPTIONAL, and that
 * optionality is deliberate, not provisional: an ABSENT carryover document
 * is a legitimate `0n` on both lines — a first-year filer, or anyone who
 * genuinely had no prior-year capital loss, has nothing to carry, and
 * refusing there would make an ordinary return unable to file at all
 * (15-CONTEXT.md's REVISED Area 3). When the document IS present, both
 * lines are driven by `capitalLossCarryoverWorksheet`
 * (`fjs/tax/carryover/module.f.js`), never hardcoded. A document that
 * exists but has a missing or malformed required field is refused one layer
 * up, by `vnd.fjs.prior_year_capital_loss`'s own `validate`/
 * `checkReferences` — this module trusts an already-validated `Stored<
 * PriorYearCapitalLoss>` exactly as it trusts every other stored document it
 * reads.
 *
 * ## The 28% Rate Gain Worksheet and the Unrecaptured §1250 Gain Worksheet
 * are bounded to exactly the lines this project's dialects can populate
 * (12.1-CONTEXT.md Decision 2.5, LOCKED)
 *
 * Both sub-worksheets model ONLY the one line each project dialect can
 * actually drive — the 28% Rate Gain Worksheet's line 4 (1099-DIV box 2d)
 * and the Unrecaptured Section 1250 Gain Worksheet's line 11 (1099-DIV
 * box 2b) — with every other printed line hardcoded to its zero-equivalent
 * and named individually, mirroring `fjs/schedule/b`'s own Form 8815
 * boundary (`fjs/schedule/b/module.f.js`, "Line 3 ... is NOT modeled this
 * phase"). This is a BLANKET boundary, not a per-line judgment call: even
 * where a value looks mechanically derivable from data this module already
 * has on hand — the Unrecaptured §1250 Gain Worksheet's line 14 could look
 * like it wants the 28% Rate Gain Worksheet's own line 4, and both
 * worksheets' "current-year loss" lines could look like they want this
 * module's own line 7 — Decision 2.5 forbids that cross-reference. Chasing
 * it would be doing more than the phase's own dialects can honestly
 * support; the correct answer is a documented zero, not a derived one. A
 * later phase widening either dialect (Form 4797, Schedule K-1, Form 6252,
 * the §1202 exclusion) knows exactly which named constant to revisit.
 *
 * ## Schedule D line 21 — the three-way loss-cap branch, not a pass-through
 *
 * Form 1040 line 7a is a THREE-WAY branch on Schedule D line 16's sign, not
 * a straight read of line 16: a net GAIN routes line 16 itself; a net ZERO
 * routes `0n`; a net LOSS routes line 21 — the LESSER of the loss and
 * $3,000.00 ($1,500.00 if married filing separately), "treating both
 * amounts as positive" per the printed instruction, with the loss's sign
 * restored on the result. `line7aCapitalGainOrLoss` is this module's own
 * computation of that branch, so a caller (Plan 12.1-04's Form 1040 wiring)
 * reads one field rather than re-deriving the three-way branch a second
 * time. `status` is read ONLY to select the $3,000.00/$1,500.00 threshold —
 * nowhere else in this module.
 *
 * ## Reused idiom: `sumBoxOverDocuments`, reimplemented locally
 *
 * The exact-cents-sum-over-documents idiom is reimplemented here, privately,
 * following `fjs/schedule/b/module.f.js:98-158`'s shape (itself following
 * `fjs/form1040/core`'s originals) — this module does not import it from
 * either, per this project's established "reimplement an idiom you cannot
 * import" precedent (also used by `fjs/form8949` for its own, differently
 * shaped, per-document aggregation).
 *
 * @module
 */
import { assert, assertEq, assertNotNullish } from 'functionalscript/fjs/asserts/module.f.js'
import { centsFromString, centsToString } from '../../exact/module.f.js'
import { form8949 } from '../../form8949/module.f.js'
import { capitalLossCarryoverWorksheet } from '../../tax/carryover/module.f.js'

/** @import { OneZeroNineNineB } from '../../document/1099b/module.f.js' */
/** @import { OneZeroNineNineDiv } from '../../document/1099div/module.f.js' */
/** @import { PriorYearCapitalLoss } from '../../document/prior_year_capital_loss/module.f.js' */
/** @import { Source } from '../../report/line/module.f.js' */
/** @import { IndividualFilingStatus } from '../../tax/params/module.f.js' */

// ── Inputs ───────────────────────────────────────────────────────────────────

/**
 * A stored document as this module sees it: the CAS hash it is addressed by,
 * paired with its ALREADY-VALIDATED value. Nothing here re-validates
 * (mirrors `fjs/form8949`'s and `fjs/schedule/b`'s own `Stored<T>`).
 * @template T
 * @typedef {{ readonly documentHash: string, readonly value: T }} Stored
 */

/**
 * Everything Schedule D reads: the filing status (loss-cap threshold only),
 * stored 1099-B documents (fed to `fjs/form8949`), and stored 1099-DIV
 * documents (lines 13/18/19).
 * `priorYearCapitalLossCarryover` is OPTIONAL — its absence is a legitimate
 * `0n` on lines 6/14, never a refusal (module docstring, "Prior-year
 * carryover").
 * @typedef {{
 *   readonly status: IndividualFilingStatus,
 *   readonly brokerageForms: readonly Stored<OneZeroNineNineB>[],
 *   readonly dividendForms: readonly Stored<OneZeroNineNineDiv>[],
 *   readonly priorYearCapitalLossCarryover?: Stored<PriorYearCapitalLoss>,
 * }} ScheduleDInputs
 */

// ── Output contract (Plan 12.1-04, Form 1040 wiring, builds against this) ──

/**
 * @typedef {{
 *   readonly kind: 'ok',
 *   readonly line1a: bigint, readonly line1b: bigint, readonly line2: bigint,
 *   readonly line3: bigint, readonly line4: bigint, readonly line5: bigint,
 *   readonly line6: bigint, readonly line7: bigint,
 *   readonly line8a: bigint, readonly line8b: bigint, readonly line9: bigint,
 *   readonly line10: bigint, readonly line11: bigint, readonly line12: bigint,
 *   readonly line13: bigint, readonly line14: bigint, readonly line15: bigint,
 *   readonly line16: bigint, readonly line18: bigint, readonly line19: bigint,
 *   readonly line21: bigint,
 *   readonly line7aCapitalGainOrLoss: bigint,
 *   readonly sources: readonly Source[],
 * }} ScheduleDOk
 */

/**
 * The graceful, tagged refusal Form 8949 can produce, threaded through
 * VERBATIM — this module does not build its own refusal shape, and does not
 * compute any line once Form 8949 refuses.
 * @typedef {{ readonly kind: 'error', readonly message: string }} ScheduleDError
 */

/** @typedef {ScheduleDOk | ScheduleDError} ScheduleDOutcome */

// ── Aggregation (the `sumBoxOverDocuments` idiom, reimplemented locally) ───

/**
 * The exact cents sum of one box across a set of documents, with one
 * {@link Source} per PRESENT box — an absent box is ABSENT, never zero
 * (DOC-11), and contributes nothing.
 * @typedef {{ readonly value: bigint, readonly sources: readonly Source[] }} BoxSum
 */

/**
 * @type {<T>(documents: readonly Stored<T>[]) => (boxPath: string) => (read: (document: T) => string | undefined) => BoxSum}
 */
const sumBoxOverDocuments = documents => boxPath => read => {
    const sources = documents.flatMap(document => {
        const printed = read(document.value)
        return printed === undefined
            ? []
            : [{ documentHash: document.documentHash, boxPath, value: printed }]
    })
    return {
        value: sources.reduce((total, source) => total + centsFromString(source.value), 0n),
        sources,
    }
}

// ── Schedule D ───────────────────────────────────────────────────────────────

/**
 * Computes Schedule D for one return from Form 8949's category totals
 * (derived from stored 1099-B documents) and stored 1099-DIV documents.
 * Every `const` below is one printed Schedule D line (or one printed line
 * of one of the two sub-worksheets), in printed order, per TAX-15.
 * @type {(inputs: ScheduleDInputs) => ScheduleDOutcome}
 */
export const scheduleD = inputs => {
    const { status, brokerageForms, dividendForms, priorYearCapitalLossCarryover } = inputs

    const form8949Outcome = form8949(brokerageForms)
    if (form8949Outcome.kind === 'error') {
        // Threaded VERBATIM — the SAME shaped refusal, no new
        // `fjs/return/scope` kind, no line below this point computed.
        return { kind: 'error', message: form8949Outcome.message }
    }
    const { categoryA, categoryB, categoryD, categoryE } = form8949Outcome

    // The Capital Loss Carryover Worksheet, run ONCE and its two outputs
    // shared by lines 6 (Part I) and 14 (Part II) below — see module
    // docstring, "Prior-year carryover". `undefined` exactly when the
    // document is absent, which is the legitimate-zero case, not a
    // refusal.
    const carryoverOutputs = priorYearCapitalLossCarryover === undefined
        ? undefined
        : capitalLossCarryoverWorksheet({
            priorYearFormLine15Cents: centsFromString(priorYearCapitalLossCarryover.value.priorYearFormLine15),
            priorYearScheduleDLine7Cents: centsFromString(priorYearCapitalLossCarryover.value.priorYearScheduleDLine7),
            priorYearScheduleDLine15Cents: centsFromString(priorYearCapitalLossCarryover.value.priorYearScheduleDLine15),
            priorYearScheduleDLine21Cents: centsFromString(priorYearCapitalLossCarryover.value.priorYearScheduleDLine21),
        })

    // ── Part I — Short-Term ─────────────────────────────────────────────

    // 1a. "Totals for all short-term transactions reported on Form
    //     1099-B ... basis reported to IRS ... no adjustments" — the "skip
    //     Form 8949 entirely" shortcut. This dialect always routes every
    //     transaction through Form 8949 (see `fjs/form8949`'s own
    //     docstring), so line 1a is a documented, permanent 0.
    const line1a = 0n
    // 1b. Form 8949 Category A (or G, digital-asset, out of scope) totals.
    const line1b = categoryA.value
    // 2. Form 8949 Category B (or H, digital-asset, out of scope) totals.
    const line2 = categoryB.value
    // 3. Category C (short-term, no 1099-B received) — this dialect only
    //    models broker-reported sales (`fjs/form8949`'s own boundary),
    //    documented 0.
    const line3 = 0n
    // 4. ST gain from Form 6252 and Forms 4684/6781/8824 — no dialect for
    //    any of the four, documented 0.
    const line4 = 0n
    // 5. Net ST gain/loss from partnerships/S-corps/estates/trusts via
    //    Schedule K-1 — no K-1 dialect, documented 0.
    const line5 = 0n
    // 6. ST capital loss carryover — TAX-17/Phase 15 (see module docstring
    //    "Prior-year carryover"): the worksheet's short-term output,
    //    entered as a NEGATIVE (the printed line's entry box is
    //    parenthesized — a carryover loss reduces the total), or a
    //    legitimate 0 when there is no stored carryover document.
    const line6 = carryoverOutputs === undefined ? 0n : -carryoverOutputs.shortTermCarryoverCents
    /** @type {readonly Source[]} */
    const line6Sources = priorYearCapitalLossCarryover !== undefined
        && carryoverOutputs !== undefined && line6 !== 0n
        ? [{
            documentHash: priorYearCapitalLossCarryover.documentHash,
            boxPath: 'priorYearCapitalLossCarryoverWorksheet(shortTerm)',
            value: centsToString(carryoverOutputs.shortTermCarryoverCents),
        }]
        : []
    // 7. "Net short-term capital gain or (loss). Combine lines 1a through
    //    6."
    const line7 = line1a + line1b + line2 + line3 + line4 + line5 + line6

    // ── Part II — Long-Term ─────────────────────────────────────────────

    // 8a. Same shortcut as line 1a, long-term — documented 0.
    const line8a = 0n
    // 8b. Form 8949 Category D (or J) totals.
    const line8b = categoryD.value
    // 9. Form 8949 Category E (or K) totals.
    const line9 = categoryE.value
    // 10. Category F (long-term, no 1099-B received) — out of scope,
    //     documented 0.
    const line10 = 0n
    // 11. Gain from Form 4797 Part I; LT gain from Forms 2439/6252; LT
    //     gain/loss from Forms 4684/6781/8824 — no dialect for any,
    //     documented 0.
    const line11 = 0n
    // 12. Net LT gain/loss from partnerships/S-corps/estates/trusts via
    //     Schedule K-1 — no K-1 dialect, documented 0.
    const line12 = 0n
    // 13. "Capital gain distributions." 1099-DIV box 2a is already
    //     inclusive of boxes 2b/2c/2d's sub-components (12.1-RESEARCH.md
    //     Finding 1) — box 2c is deliberately never read by this module at
    //     all (see the 28%/§1250 worksheets below), and box 2b/2d are read
    //     ONLY inside their own sub-worksheets, never added again here.
    const line13Sum = sumBoxOverDocuments(dividendForms)('box2aTotalCapitalGainDistr')(
        div => div.box2aTotalCapitalGainDistr)
    const line13 = line13Sum.value
    // 14. LT capital loss carryover — TAX-17/Phase 15 (see module docstring
    //     "Prior-year carryover"): the worksheet's long-term output,
    //     entered as a NEGATIVE, or a legitimate 0 when there is no stored
    //     carryover document. Shares `carryoverOutputs` with line 6 above —
    //     computed once from the SAME stored document.
    const line14 = carryoverOutputs === undefined ? 0n : -carryoverOutputs.longTermCarryoverCents
    /** @type {readonly Source[]} */
    const line14Sources = priorYearCapitalLossCarryover !== undefined
        && carryoverOutputs !== undefined && line14 !== 0n
        ? [{
            documentHash: priorYearCapitalLossCarryover.documentHash,
            boxPath: 'priorYearCapitalLossCarryoverWorksheet(longTerm)',
            value: centsToString(carryoverOutputs.longTermCarryoverCents),
        }]
        : []
    // 15. "Net long-term capital gain or (loss). Combine lines 8a through
    //     14."
    const line15 = line8a + line8b + line9 + line10 + line11 + line12 + line13 + line14

    // ── Part III — Summary ──────────────────────────────────────────────

    // 16. "Combine lines 7 and 15."
    const line16 = line7 + line15

    // ── 28% Rate Gain Worksheet — Line 18 (i1040sd.pdf p.11) ────────────
    // Per Decision 2.5: only line 4 is populatable this phase. Implemented
    // as the FULL printed combine (TAX-15's "one printed line, one
    // const"), not shortcut directly to `max(box2d, 0n)`, so a later phase
    // widening the dialect sees exactly which lines to revisit.

    // 1. Collectibles gain/(loss) from Form 8949 Part II — no Form 8949
    //    Part II collectibles rows modeled, documented 0.
    const twentyEightPercentLine1 = 0n
    // 2. §1202 exclusion (Form 8949 code Q) — the exclusion percentage is
    //    not derivable from any 1099-DIV box (12.1-CONTEXT.md's AMENDED
    //    §1.1 finding), documented 0.
    const twentyEightPercentLine2 = 0n
    // 3. Collectibles gain/(loss) from Forms 4684/6252/6781/8824 — no
    //    dialect, documented 0.
    const twentyEightPercentLine3 = 0n
    // 4. "Total of any collectibles gain reported to you on Form 1099-DIV
    //    box 2d..." — the ONLY populated line.
    const twentyEightPercentLine4Sum = sumBoxOverDocuments(dividendForms)(
        'box2dCollectibles28PercentGain')(div => div.box2dCollectibles28PercentGain)
    const twentyEightPercentLine4 = twentyEightPercentLine4Sum.value
    // 5. LT capital loss carryovers from Schedule D line 14 — multi-year,
    //    documented 0.
    const twentyEightPercentLine5 = 0n
    // 6. Current-year loss from Schedule D line 7 — Decision 2.5 is a
    //    BLANKET boundary: hardcoded 0 even though this module's own
    //    line 7 is available and could look derivable.
    const twentyEightPercentLine6 = 0n
    // 7. "Combine lines 1-6. If zero or less, enter -0-. Also enter this
    //    amount on Schedule D line 18."
    const twentyEightPercentLine7Raw = twentyEightPercentLine1 + twentyEightPercentLine2
        + twentyEightPercentLine3 + twentyEightPercentLine4 + twentyEightPercentLine5
        + twentyEightPercentLine6
    const twentyEightPercentLine7 = twentyEightPercentLine7Raw > 0n ? twentyEightPercentLine7Raw : 0n
    const line18 = twentyEightPercentLine7

    // ── Unrecaptured Section 1250 Gain Worksheet — Line 19 (i1040sd.pdf
    //    pp.13-14) ─────────────────────────────────────────────────────
    // Per Decision 2.5: only line 11 is populatable this phase.

    // 1-9. Property-level and Form 4797/6252 installment-sale mechanics
    //      (Steps 1-3, p.13) — entirely about real property/depreciation
    //      recapture this project has no document type for, so this whole
    //      block, and its own printed running-total line 9, are documented
    //      0.
    const unrecap1250Line9 = 0n
    // 10. Partnership §1250 gain share via Schedule K-1 — no K-1 dialect,
    //     documented 0.
    const unrecap1250Line10 = 0n
    // 11. "Total of amounts reported to you as unrecaptured section 1250
    //     gain on a Schedule K-1, Form 1099-DIV, or Form 2439 ... or in
    //     connection with Form 1099-R" — this dialect reads only the
    //     1099-DIV term, box2bUnrecapSec1250Gain. The ONLY populated line.
    const unrecap1250Line11Sum = sumBoxOverDocuments(dividendForms)('box2bUnrecapSec1250Gain')(
        div => div.box2bUnrecapSec1250Gain)
    const unrecap1250Line11 = unrecap1250Line11Sum.value
    // 12. Other unrecaptured §1250 gain (further installment sales,
    //     converted rental property) — out of scope, documented 0.
    const unrecap1250Line12 = 0n
    // 13. "Add lines 9 through 12."
    const unrecap1250Line13 = unrecap1250Line9 + unrecap1250Line10 + unrecap1250Line11 + unrecap1250Line12
    // 14. §1202/collectibles total from the 28% Rate Gain Worksheet lines
    //     1-4 — Decision 2.5 is a BLANKET boundary: hardcoded 0 and
    //     documented, NOT cross-referenced to `twentyEightPercentLine4`
    //     even though that value is non-zero and available on this
    //     module.
    const unrecap1250Line14 = 0n
    // 15. The loss, if any, from Schedule D line 7 (as a positive number)
    //     — Decision 2.5 is a BLANKET boundary: hardcoded 0 and
    //     documented, NOT cross-referenced to this module's own `line7`
    //     even though it is available.
    const unrecap1250Line15 = 0n
    // 16. LT capital loss carryovers from Schedule D line 14 and Schedule
    //     K-1 (1041) box 11 code D — multi-year, out of scope, documented
    //     0.
    const unrecap1250Line16 = 0n
    // 17. "Combine lines 14-16. If zero or a gain, enter -0-."
    const unrecap1250Line17Raw = unrecap1250Line14 + unrecap1250Line15 + unrecap1250Line16
    const unrecap1250Line17 = unrecap1250Line17Raw >= 0n ? 0n : unrecap1250Line17Raw
    // 18. "Unrecaptured section 1250 gain: subtract line 17 from line 13.
    //     If zero or less, enter -0-. Enter here and on Schedule D line
    //     19."
    const unrecap1250Line18Raw = unrecap1250Line13 - unrecap1250Line17
    const unrecap1250Line18 = unrecap1250Line18Raw > 0n ? unrecap1250Line18Raw : 0n
    const line19 = unrecap1250Line18

    // 21. "If line 16 is a loss, enter here and on Form 1040, line 7a, the
    //     smaller of: the loss on line 16; or $3,000 ($1,500 if married
    //     filing separately)" — treating both amounts as positive when
    //     comparing, then the result carries the loss's sign. Populated
    //     ONLY when line 16 is a loss; 0 otherwise, matching the printed
    //     form's own "skip line 21" instruction for a gain or zero year.
    const lossCapCents = status === 'marriedFilingSeparately' ? 150000n : 300000n
    const line21 = line16 < 0n
        ? -((-line16) < lossCapCents ? (-line16) : lossCapCents)
        : 0n

    // This module's OWN three-way routing of lines 16/21 onto Form 1040
    // line 7a — see module docstring, "Schedule D line 21".
    const line7aCapitalGainOrLoss = line16 > 0n
        ? line16
        : (line16 === 0n ? 0n : line21)

    /** @type {readonly Source[]} */
    const sources = [
        ...categoryA.sources, ...categoryB.sources, ...categoryD.sources, ...categoryE.sources,
        ...line13Sum.sources, ...twentyEightPercentLine4Sum.sources, ...unrecap1250Line11Sum.sources,
        ...line6Sources, ...line14Sources,
    ]

    return {
        kind: 'ok',
        line1a, line1b, line2, line3, line4, line5, line6, line7,
        line8a, line8b, line9, line10, line11, line12, line13, line14, line15,
        line16, line18, line19, line21,
        line7aCapitalGainOrLoss,
        sources,
    }
}

// ── Tests ────────────────────────────────────────────────────────────────────

/**
 * The literal `sourceArtifactHash` `fjs/form8949`/`fjs/document/1099b` use —
 * reused here so this module's fixtures are visibly drawn from the same
 * convention.
 * @type {string}
 */
const sharedSourceArtifactHash = 'deadbeef00112233445566778899aabbccddeeff0011223344556677889900'

/**
 * A minimal, always-valid `vnd.fjs.1099b` base, matching `fjs/form8949`'s
 * own `minimalOneZeroNineNineB` fixture shape.
 * @type {OneZeroNineNineB}
 */
const minimalOneZeroNineNineB = {
    dialect: 'vnd.fjs.1099b',
    payerTin: '11-1111111',
    recipientTin: '222-22-2222',
    accountNumber: 'ACC-0001',
    taxYear: 2025,
    formRevision: '2025',
    sourceArtifactHash: sharedSourceArtifactHash,
}

/**
 * @type {(hash: string) => (overrides: Partial<OneZeroNineNineB>) => Stored<OneZeroNineNineB>}
 */
const brokerageForm = hash => overrides => ({
    documentHash: hash,
    value: { ...minimalOneZeroNineNineB, ...overrides },
})

/**
 * A minimal, always-valid `vnd.fjs.1099div` base, matching
 * `fjs/schedule/b`'s own `dividendForm` fixture shape.
 * @type {OneZeroNineNineDiv}
 */
const minimalOneZeroNineNineDiv = {
    dialect: 'vnd.fjs.1099div',
    payerTin: '11-1111111',
    recipientTin: '222-22-2222',
    accountNumber: 'ACC-0001',
    taxYear: 2025,
    formRevision: '2024',
    sourceArtifactHash: sharedSourceArtifactHash,
}

/**
 * @type {(hash: string) => (overrides: Partial<OneZeroNineNineDiv>) => Stored<OneZeroNineNineDiv>}
 */
const dividendForm = hash => overrides => ({
    documentHash: hash,
    value: { ...minimalOneZeroNineNineDiv, ...overrides },
})

/**
 * Unwraps a `ScheduleDOk`, throwing (with the whole outcome, for
 * diagnosability) if the outcome was actually an error — used throughout
 * this proof so every leaf can read `.lineN` directly rather than
 * re-narrowing `outcome.kind === 'ok'` at every call site.
 * @type {(outcome: ScheduleDOutcome) => ScheduleDOk}
 */
const expectOk = outcome => {
    assert(outcome.kind === 'ok', ['expected ok', outcome])
    if (outcome.kind !== 'ok') {
        throw ['expected ok', outcome]
    }
    return outcome
}

export const proof = {
    lossCap: {
        // $6,000.00 short-term loss, no long-term activity, single filer:
        // line21 caps the loss at $3,000.00 and line7aCapitalGainOrLoss
        // equals the capped figure, not line16 itself.
        sixThousandDollarShortTermLossSingleFilerCapsAtThreeThousand: () => {
            const lossDoc = brokerageForm('doc-st-loss')({
                box1dProceeds: '4000.00',
                box1eCostOrOtherBasis: '10000.00',
                box2ShortTermGainOrLoss: true,
                box12BasisReportedToIrs: true,
            })
            const result = expectOk(scheduleD({
                status: 'single',
                brokerageForms: [lossDoc],
                dividendForms: [],
            }))
            assertEq(result.line7, -600000n, '$4,000.00 - $10,000.00 = -$6,000.00')
            assertEq(result.line15, 0n, 'no long-term activity')
            assertEq(result.line16, -600000n)
            assertEq(result.line21, -300000n, 'capped at $3,000.00, single filer')
            assertEq(
                result.line7aCapitalGainOrLoss,
                result.line21,
                'a loss year routes the CAPPED line21 figure, not line16 itself',
            )
        },
        // The SAME fixture, married filing separately: the cap is $1,500.00.
        sameFixtureMarriedFilingSeparatelyCapsAtFifteenHundred: () => {
            const lossDoc = brokerageForm('doc-st-loss-mfs')({
                box1dProceeds: '4000.00',
                box1eCostOrOtherBasis: '10000.00',
                box2ShortTermGainOrLoss: true,
                box12BasisReportedToIrs: true,
            })
            const result = expectOk(scheduleD({
                status: 'marriedFilingSeparately',
                brokerageForms: [lossDoc],
                dividendForms: [],
            }))
            assertEq(result.line16, -600000n)
            assertEq(result.line21, -150000n, 'capped at $1,500.00, MFS')
            assertEq(result.line7aCapitalGainOrLoss, result.line21)
        },
        // A zero-net year routes exactly $0 to Form 1040 line 7a, and line
        // 21 stays at its documented $0 (populated ONLY on a loss year).
        zeroNetYearRoutesExactlyZero: () => {
            const stGainDoc = brokerageForm('doc-zero-st')({
                box1dProceeds: '8000.00',
                box1eCostOrOtherBasis: '3000.00',
                box2ShortTermGainOrLoss: true,
                box12BasisReportedToIrs: true,
            })
            const ltLossDoc = brokerageForm('doc-zero-lt')({
                box1dProceeds: '3000.00',
                box1eCostOrOtherBasis: '8000.00',
                box2LongTermGainOrLoss: true,
                box12BasisReportedToIrs: true,
            })
            const result = expectOk(scheduleD({
                status: 'single',
                brokerageForms: [stGainDoc, ltLossDoc],
                dividendForms: [],
            }))
            assertEq(result.line7, 500000n, '$8,000.00 - $3,000.00 = $5,000.00')
            assertEq(result.line15, -500000n, '$3,000.00 - $8,000.00 = -$5,000.00')
            assertEq(result.line16, 0n)
            assertEq(result.line21, 0n, 'line21 is populated only when line16 is a loss')
            assertEq(result.line7aCapitalGainOrLoss, 0n)
        },
    },
    // Mutation Gate M2's control shape: a short-term GAIN and a long-term
    // LOSS of DIFFERENT sizes, netting to a gain that could hide a swapped
    // short/long-term categorization if only the total were checked. Lines
    // 7 and 15 are asserted SEPARATELY, never just line16.
    shortTermAndLongTermKeptIndependentlyObservable: {
        sixThousandShortTermGainAndTwoThousandLongTermLossNetFourThousand: () => {
            const stGainDoc = brokerageForm('doc-mixed-st')({
                box1dProceeds: '9000.00',
                box1eCostOrOtherBasis: '3000.00',
                box2ShortTermGainOrLoss: true,
                box12BasisReportedToIrs: true,
            })
            const ltLossDoc = brokerageForm('doc-mixed-lt')({
                box1dProceeds: '3000.00',
                box1eCostOrOtherBasis: '5000.00',
                box2LongTermGainOrLoss: true,
                box12BasisReportedToIrs: true,
            })
            const result = expectOk(scheduleD({
                status: 'single',
                brokerageForms: [stGainDoc, ltLossDoc],
                dividendForms: [],
            }))
            assertEq(result.line7, 600000n, 'ST: $9,000.00 - $3,000.00 = $6,000.00 gain')
            assertEq(result.line15, -200000n, 'LT: $3,000.00 - $5,000.00 = -$2,000.00 loss')
            assertEq(result.line16, 400000n, 'net: $6,000.00 - $2,000.00 = $4,000.00')
            assertEq(result.line21, 0n, 'a net gain year never populates line21')
            assertEq(result.line7aCapitalGainOrLoss, result.line16)
        },
        // A clean-gain fixture: both Part I and Part II gain, no losses.
        // line7aCapitalGainOrLoss equals line16 EXACTLY.
        cleanGainInBothPartsRoutesLine16Exactly: () => {
            const stGainDoc = brokerageForm('doc-clean-st')({
                box1dProceeds: '5000.00',
                box1eCostOrOtherBasis: '3000.00',
                box2ShortTermGainOrLoss: true,
                box12BasisReportedToIrs: true,
            })
            const ltGainDoc = brokerageForm('doc-clean-lt')({
                box1dProceeds: '9000.00',
                box1eCostOrOtherBasis: '4000.00',
                box2LongTermGainOrLoss: true,
                // box12BasisReportedToIrs NOT checked -> Category E.
            })
            const result = expectOk(scheduleD({
                status: 'single',
                brokerageForms: [stGainDoc, ltGainDoc],
                dividendForms: [],
            }))
            assertEq(result.line7, 200000n)
            assertEq(result.line15, 500000n)
            assertEq(result.line16, 700000n)
            assertEq(result.line21, 0n)
            assertEq(result.line7aCapitalGainOrLoss, result.line16)
        },
    },
    // Form 8949's absent-basis refusal threads through Schedule D verbatim
    // — the SAME shaped { kind: 'error' }, no line computed.
    form8949ErrorPropagation: {
        absentBasisRefusalPropagatesVerbatimNoLineComputed: () => {
            const absentBasisDoc = brokerageForm('doc-absent-basis')({
                box5NoncoveredSecurity: true,
                box1dProceeds: '10000.00',
                box2LongTermGainOrLoss: true,
                // box1eCostOrOtherBasis genuinely OMITTED.
            })
            const outcome = scheduleD({
                status: 'single',
                brokerageForms: [absentBasisDoc],
                dividendForms: [],
            })
            assertEq(outcome.kind, 'error', ['expected the refusal to propagate', outcome])
            if (outcome.kind !== 'error') {
                throw ['expected error', outcome]
            }
            assert(
                outcome.message.includes('doc-absent-basis'),
                ['expected the propagated refusal to still name the document', outcome.message],
            )
            assert(
                outcome.message.includes('box1eCostOrOtherBasis'),
                ['expected the propagated refusal to still name the absent box', outcome.message],
            )
        },
    },
    // 1099-DIV box 2a is already inclusive of 2b/2c/2d — none of those
    // three is separately added into line13. Box 2c (§1202 gain) is never
    // read at all, anywhere in this module.
    capitalGainDistributionsInclusiveOfSubComponents: {
        box2aAloneFeedsLineThirteenNeverSummedWithTwoBTwoCTwoD: () => {
            const div = dividendForm('doc-div-inclusive')({
                box2aTotalCapitalGainDistr: '1000.00',
                box2bUnrecapSec1250Gain: '200.00',
                box2cSection1202Gain: '150.00',
                box2dCollectibles28PercentGain: '300.00',
            })
            const result = expectOk(scheduleD({
                status: 'single',
                brokerageForms: [],
                dividendForms: [div],
            }))
            assertEq(result.line13, 100000n, 'line13 = box2a alone, $1,000.00 -- not $1,650.00')
            assertEq(result.line19, 20000n, 'line19 = box2b alone via its own sub-worksheet')
            assertEq(result.line18, 30000n, 'line18 = box2d alone via its own sub-worksheet')
            assertEq(
                result.line13,
                centsFromString('1000.00'),
                'box2c never contributes to line13 or to either sub-worksheet',
            )
        },
        zeroDividendFormsProduceZeroLineThirteenEighteenNineteen: () => {
            const result = expectOk(scheduleD({
                status: 'single',
                brokerageForms: [],
                dividendForms: [],
            }))
            assertEq(result.line13, 0n)
            assertEq(result.line18, 0n)
            assertEq(result.line19, 0n)
        },
    },
    // Every documented-zero Schedule D line is a named constant, never a
    // silently-passed-through value -- proven structurally by asserting
    // each is exactly 0n on a fixture with real Part I/II activity (so a
    // 0n line here is a documented boundary, not merely an untouched
    // default).
    documentedZeroLinesStayZeroEvenWithRealActivity: () => {
        const stGainDoc = brokerageForm('doc-zeros-st')({
            box1dProceeds: '5000.00',
            box1eCostOrOtherBasis: '3000.00',
            box2ShortTermGainOrLoss: true,
            box12BasisReportedToIrs: true,
        })
        const ltGainDoc = brokerageForm('doc-zeros-lt')({
            box1dProceeds: '9000.00',
            box1eCostOrOtherBasis: '4000.00',
            box2LongTermGainOrLoss: true,
            box12BasisReportedToIrs: true,
        })
        const result = expectOk(scheduleD({
            status: 'single',
            brokerageForms: [stGainDoc, ltGainDoc],
            dividendForms: [],
        }))
        assertEq(result.line1a, 0n)
        assertEq(result.line3, 0n)
        assertEq(result.line4, 0n)
        assertEq(result.line5, 0n)
        assertEq(result.line6, 0n)
        assertEq(result.line8a, 0n)
        assertEq(result.line10, 0n)
        assertEq(result.line11, 0n)
        assertEq(result.line12, 0n)
        assertEq(result.line14, 0n)
    },
    // TAX-17/Phase 15: the carryover boundary, both halves.
    priorYearCapitalLossCarryover: {
        // Trap 4's control (15-RESEARCH.md Pitfall 4): a return WITH
        // brokerage sales and NO stored carryover document computes lines
        // 6/14 as a legitimate 0 -- it must NOT refuse.
        absentCarryoverWithBrokerageSalesPresentComputesLegitimateZeroNotRefusal: () => {
            const saleDoc = brokerageForm('doc-carryover-control')({
                box1dProceeds: '9000.00',
                box1eCostOrOtherBasis: '4000.00',
                box2ShortTermGainOrLoss: true,
                box12BasisReportedToIrs: true,
            })
            const result = expectOk(scheduleD({
                status: 'single',
                brokerageForms: [saleDoc],
                dividendForms: [],
            }))
            assertEq(result.line6, 0n, 'absent carryover document -- a legitimate zero, not a refusal')
            assertEq(result.line14, 0n, 'absent carryover document -- a legitimate zero, not a refusal')
        },
        // Plan 15-02's Worked Example B (ST loss $10,000.00, LT gain
        // $1,000.00, line21 -$3,000.00, Form1040 line15 +$20,000.00),
        // independently hand-computed by `fjs/tax/carryover/module.f.js`'s
        // own worked example to a $6,000.00 short-term carryover -- reused
        // here so this module's expectation is the SAME independently
        // verified figure, not a value produced by calling `scheduleD`
        // itself and pasting the output.
        presentValidCarryoverDrivesLinesSixAndFourteen: () => {
            /** @type {Stored<PriorYearCapitalLoss>} */
            const carryoverDoc = {
                documentHash: 'doc-carryover-worked-example-b',
                value: {
                    dialect: 'vnd.fjs.prior_year_capital_loss',
                    recipientTin: '222-22-2222',
                    taxYear: 2024,
                    priorYearFormLine15: '20000.00',
                    priorYearScheduleDLine7: '-10000.00',
                    priorYearScheduleDLine15: '1000.00',
                    priorYearScheduleDLine21: '-3000.00',
                },
            }
            const result = expectOk(scheduleD({
                status: 'single',
                brokerageForms: [],
                dividendForms: [],
                priorYearCapitalLossCarryover: carryoverDoc,
            }))
            assertEq(result.line6, -600000n, '$6,000.00 short-term carryover, entered as a negative')
            assertEq(result.line14, 0n, 'Worked Example B carries no long-term amount')
            assertEq(result.sources.length, 1, 'exactly one source: the ST carryover citation')
            const source = assertNotNullish(result.sources[0])
            assertEq(source.documentHash, 'doc-carryover-worked-example-b')
            assertEq(source.boxPath, 'priorYearCapitalLossCarryoverWorksheet(shortTerm)')
            assertEq(source.value, '6000.00')
        },
    },
    // This module never carries a `dialect`/`mediaType` tag -- it computes
    // a schedule, it does not store a document (mirrors `fjs/schedule/b`'s
    // own `dialectIndependence` leaf).
    dialectIndependence: () => {
        const result = expectOk(scheduleD({ status: 'single', brokerageForms: [], dividendForms: [] }))
        assert(!('dialect' in result), 'scheduleD output must not carry a dialect tag')
        assert(!('mediaType' in result), 'scheduleD output must not carry a mediaType')
    },
}
