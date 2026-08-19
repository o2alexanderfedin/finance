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
 * ## Lines 4 and 11 — Form 6781, and why they arrive as numbers (TAX-38)
 *
 * Printed line 4 takes Form 6781 line 8 (the 40 percent SHORT-term half of a
 * section 1256 gain or loss) and printed line 11 takes Form 6781 line 9 (the
 * 60 percent LONG-term half). Both were documented zeros until TAX-38.
 *
 * They arrive through `ScheduleDInputs.sectionTwelveFiftySix` as two bigints
 * and their citations, **not** as a 1099-B this module reads. That is the
 * printed form's own shape — line 8 says "Enter here and include on line 4 of
 * Schedule D", so Schedule D copies a figure another form computed — and it
 * is also what keeps the promise this docstring makes above: the only runtime
 * `fjs/*` import here is still `fjs/form8949`, because `fjs/form6781` needs
 * the parameter set for §1256(a)(3)'s rates and this module imports nothing
 * from `fjs/tax/` at run time. `fjs/form1040/core` is where Form 6781 runs.
 *
 * The 40/60 assignment is inverted relative to the printed line numbers —
 * the SMALLER 6781 line carries the SMALLER fraction and the SHORTER holding
 * period — which is exactly the transposition `proof.sectionTwelveFiftySix
 * Contracts` exists to make visible: it supplies no stock sale at all, so
 * lines 7 and 15 are the two halves alone and a swap cannot hide inside other
 * content.
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
import { assert, assertEq, assertNotNullish } from 'functionalscript/fjs/asserts/module.f.mjs'
import { centsFromString, centsToString } from '../../exact/module.f.js'
import { form8949 } from '../../form8949/module.f.js'
import { capitalLossCarryoverWorksheet } from '../../tax/carryover/module.f.js'

/** @import { OneZeroNineNineB } from '../../document/1099b/module.f.js' */
/** @import { BasisCorrection } from '../../document/basis_correction/module.f.js' */
/** @import { FormThirtyNineTwentyTwo } from '../../document/form3922/module.f.js' */
/** @import { Form8949Row } from '../../form8949/module.f.js' */
/** @import { OneZeroNineNineDiv } from '../../document/1099div/module.f.js' */
/** @import { K1Partnership } from '../../document/k1_1065/module.f.js' */
/** @import { K1SCorporation } from '../../document/k1_1120s/module.f.js' */
/** @import { K1EstateTrust } from '../../document/k1_1041/module.f.js' */
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
 * `basisCorrections` and `employeeStockPurchaseForms` are Phase 29's own
 * widening (TAX-34/DOC-23), passed straight through to `fjs/form8949` — this
 * module reads neither itself. **Both are OPTIONAL**, unlike Form 8949's own
 * required lists, and the asymmetry is deliberate: `fjs/form8949` is called by
 * exactly one place and a forgotten list there would be a silent wiring bug,
 * while `scheduleD` is called from a dozen proof fixtures whose subject is the
 * loss cap or the 28% worksheet and which have no business restating that they
 * hold no equity compensation. An absent list is an empty one, which is a
 * legitimate "the broker got every basis right" — the same reasoning
 * `priorYearCapitalLossCarryover` above already carries.
 * The three Schedule K-1 collections are TAX-35's own widening, and they feed
 * printed lines 5 and 12 — the two lines the form reserves for a
 * partnership's, S corporation's or estate's/trust's separately stated capital
 * gain. **All three are OPTIONAL**, for the reason `basisCorrections` above
 * is: `scheduleD` is called from a dozen proof fixtures whose subject is the
 * loss cap or the 28% worksheet and which have no business restating that the
 * filer holds no Schedule K-1. An absent list is an empty one, which is a
 * legitimate "this filer has no pass-through capital gain".
 * @typedef {{
 *   readonly status: IndividualFilingStatus,
 *   readonly brokerageForms: readonly Stored<OneZeroNineNineB>[],
 *   readonly dividendForms: readonly Stored<OneZeroNineNineDiv>[],
 *   readonly priorYearCapitalLossCarryover?: Stored<PriorYearCapitalLoss>,
 *   readonly basisCorrections?: readonly Stored<BasisCorrection>[],
 *   readonly employeeStockPurchaseForms?: readonly Stored<FormThirtyNineTwentyTwo>[],
 *   readonly partnershipK1Forms?: readonly Stored<K1Partnership>[],
 *   readonly sCorporationK1Forms?: readonly Stored<K1SCorporation>[],
 *   readonly estateTrustK1Forms?: readonly Stored<K1EstateTrust>[],
 *   readonly sectionTwelveFiftySix?: SectionTwelveFiftySixEntries,
 *   readonly formFortySevenNinetySeven?: FormFortySevenNinetySevenEntries,
 * }} ScheduleDInputs
 */

/**
 * Form 6781 Part I's two answers, as this schedule receives them — TAX-38.
 *
 * **This module takes NUMBERS here, not documents, and that is the printed
 * form's own shape rather than a convenience.** Form 6781 line 8 says "Enter
 * here and include on line 4 of Schedule D"; line 9 says "include on line 11
 * of Schedule D". Schedule D does not read a 1099-B's section 1256 boxes any
 * more than it reads a Form 4684 — it copies two figures another form
 * computed. `fjs/form1040/core` is where `fjs/form6781` actually runs, which
 * is also where the module docstring's standing promise is kept: this file
 * imports nothing at run time from `fjs/tax/`, and `fjs/form6781` needs the
 * parameter set for §1256(a)(3)'s 40/60 rates.
 *
 * OPTIONAL, for the reason the three Schedule K-1 collections above are: an
 * absent entry is a filer with no Form 6781, which is a legitimate zero on
 * both lines and is what a dozen proof fixtures about the loss cap mean.
 * @typedef {{
 *   readonly shortTermCents: bigint,
 *   readonly longTermCents: bigint,
 *   readonly sources: readonly Source[],
 * }} SectionTwelveFiftySixEntries
 */

/**
 * Form 4797's three answers, as this schedule receives them.
 *
 * **NUMBERS, not documents**, for the reason
 * {@link SectionTwelveFiftySixEntries} gives: printed Form 4797 line 7 says to
 * enter the gain *"as a long-term capital gain on the Schedule D filed with
 * your return"*, and this schedule copies a figure another form computed
 * rather than reading an asset register a second time. `fjs/form1040/core` is
 * where `fjs/form4797` actually runs.
 *
 * - `partOneGainCents` is printed line 7 when it is a GAIN, and `0n` otherwise.
 *   It reaches printed Schedule D line 11 and is also the cap on the
 *   Unrecaptured Section 1250 Gain Worksheet's line 7. Never negative: a §1231
 *   LOSS is ordinary and leaves through Form 4797 line 11 -> line 18b ->
 *   Schedule 1 line 4, never through this schedule.
 * - `unrecapturedSectionTwelveFiftyGainCents` is that worksheet's line 3
 *   summed over Form 4797's Part III properties, UNCAPPED — *"the smaller of
 *   line 22 or line 24"* less *"the amount from Form 4797, line 26g"*. The cap
 *   is applied HERE, on worksheet line 7, because worksheet line 6 first adds
 *   two summands (Forms 6252 and Schedule K-1) that Form 4797 knows nothing
 *   about.
 * - `lineEightCents` is Form 4797 line 8, which worksheet line 8 reads by name.
 *
 * OPTIONAL, for the reason the K-1 collections are: an absent entry is a filer
 * with no Form 4797, which is a legitimate zero on all three.
 * @typedef {{
 *   readonly partOneGainCents: bigint,
 *   readonly unrecapturedSectionTwelveFiftyGainCents: bigint,
 *   readonly lineEightCents: bigint,
 *   readonly sources: readonly Source[],
 * }} FormFortySevenNinetySevenEntries
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
 *   readonly line16Unadjusted: bigint,
 *   readonly basisCorrectionOverstatement: bigint,
 *   readonly form8949Rows: readonly Form8949Row[],
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

/**
 * Adds two {@link BoxSum}s — lines 5 and 12 each read the SAME printed line off
 * three different K-1 faces, so each is three box sums added, not one box read
 * three times. Mirrors `fjs/form1040/core`'s and `fjs/schedule/b`'s own.
 *
 * **It concatenates `sources`.** A transposition between two of the three
 * faces therefore leaves `value` untouched and is visible ONLY in the citations
 * — which is why the proofs below assert `boxPath` per box rather than a total.
 * @type {(a: BoxSum) => (b: BoxSum) => BoxSum}
 */
const addBoxSums = a => b => ({
    value: a.value + b.value,
    sources: [...a.sources, ...b.sources],
})

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
    // An absent list is an empty one -- see `ScheduleDInputs`. Bound once
    // here so lines 5 and 12 below read the same three collections and a
    // future line cannot quietly acquire a fourth default.
    const { sectionTwelveFiftySix, formFortySevenNinetySeven } = inputs
    const partnershipK1Forms = inputs.partnershipK1Forms ?? []
    const sCorporationK1Forms = inputs.sCorporationK1Forms ?? []
    const estateTrustK1Forms = inputs.estateTrustK1Forms ?? []

    const form8949Outcome = form8949({
        brokerageForms,
        // An absent list is an empty one -- see `ScheduleDInputs`'s own
        // docstring for why these two are optional here and required one
        // module down.
        basisCorrections: inputs.basisCorrections ?? [],
        employeeStockPurchaseForms: inputs.employeeStockPurchaseForms ?? [],
    })
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
    // 4. "Short-term gain from Form 6252 and short-term gain or (loss) from
    //    Forms 4684, 6781, and 8824."
    //
    //    **No longer a documented zero: Form 6781 line 8 lands here** (TAX-38,
    //    the printed line 8 instruction, "Enter here and include on line 4 of
    //    Schedule D"). Forms 6252, 4684 and 8824 remain unmodeled — no dialect
    //    for any of the three — so this line is the section 1256 figure plus
    //    three documented zeros that are no longer written out, exactly as
    //    lines 5 and 12 stopped being documented zeros when TAX-35 gave them a
    //    Schedule K-1 to read.
    const line4 = sectionTwelveFiftySix === undefined ? 0n : sectionTwelveFiftySix.shortTermCents
    // 5. "Net short-term gain or (loss) from partnerships, S corporations,
    //    estates, and trusts from Schedule(s) K-1" — TAX-35. THREE box
    //    numbers for the one printed line: the partner's box 8, the
    //    shareholder's box 7, the beneficiary's box 3. Read from each
    //    dialect's own field name and never from a shared rule; the box
    //    paths are dialect-qualified so a citation says WHICH face it came
    //    off, which is the only thing that can see a transposition the sum
    //    below absorbs.
    const line5Sum = addBoxSums(addBoxSums(
        sumBoxOverDocuments(partnershipK1Forms)('k1_1065.box8NetShortTermCapitalGain')(
            k1 => k1.box8NetShortTermCapitalGain))(
        sumBoxOverDocuments(sCorporationK1Forms)('k1_1120s.box7NetShortTermCapitalGain')(
            k1 => k1.box7NetShortTermCapitalGain)))(
        sumBoxOverDocuments(estateTrustK1Forms)('k1_1041.box3NetShortTermCapitalGain')(
            k1 => k1.box3NetShortTermCapitalGain))
    const line5 = line5Sum.value
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
    // 11. "Gain from Form 4797, Part I; long-term gain from Forms 2439 and
    //     6252; and long-term gain or (loss) from Forms 4684, 6781, and 8824."
    //
    //     **Form 6781 line 9 lands here** (TAX-38, the printed line 9
    //     instruction, "include this amount on Schedule D (Form 1040), line
    //     11"). Forms 4797, 2439, 6252, 4684 and 8824 remain unmodeled.
    //
    //     Note the ASYMMETRY with line 4 above and read it against the printed
    //     face: line 4 takes Form 6781's 40% SHORT-term half from its line 8,
    //     and this line takes the 60% LONG-term half from its line 9. The
    //     smaller printed 6781 line carries the smaller fraction, which is
    //     precisely the transposition a shared helper reading "the 6781 lines"
    //     positionally would make invisible.
    //
    //     **Form 4797 Part I lands here too**, and it is the FIRST name the
    //     printed line prints. Form 4797 line 7's own instruction: "enter the
    //     gain from line 7 as a long-term capital gain on the Schedule D filed
    //     with your return". Only a GAIN arrives — a net §1231 LOSS is
    //     ordinary and leaves through Form 4797 line 11 -> line 18b ->
    //     Schedule 1 line 4, never through this schedule — so nothing here
    //     needs to floor it. Forms 2439, 6252, 4684 and 8824 remain unmodeled.
    const line11 = (sectionTwelveFiftySix === undefined ? 0n : sectionTwelveFiftySix.longTermCents)
        + (formFortySevenNinetySeven === undefined
            ? 0n
            : formFortySevenNinetySeven.partOneGainCents)
    // 12. "Net long-term gain or (loss) from partnerships, S corporations,
    //     estates, and trusts from Schedule(s) K-1" — TAX-35, and again
    //     three different box numbers: the partner's 9a, the shareholder's
    //     8a, the beneficiary's 4a.
    //
    //     **The 28%-rate and unrecaptured-§1250 slices of those same boxes
    //     stay REFUSED at storage** (1065 9b/9c, 1120-S 8b/8c, 1041 4b/4c).
    //     They are components of the long-term figure bound for Schedule D
    //     lines 18 and 19 through two worksheets this module computes only
    //     from 1099-DIV boxes 2d and 2b, so routing 9a while accepting 9b
    //     would put a collectibles gain into line 15 at the ordinary
    //     long-term rate. Refusing the slice is what keeps line 12 honest.
    const line12Sum = addBoxSums(addBoxSums(
        sumBoxOverDocuments(partnershipK1Forms)('k1_1065.box9aNetLongTermCapitalGain')(
            k1 => k1.box9aNetLongTermCapitalGain))(
        sumBoxOverDocuments(sCorporationK1Forms)('k1_1120s.box8aNetLongTermCapitalGain')(
            k1 => k1.box8aNetLongTermCapitalGain)))(
        sumBoxOverDocuments(estateTrustK1Forms)('k1_1041.box4aNetLongTermCapitalGain')(
            k1 => k1.box4aNetLongTermCapitalGain))
    const line12 = line12Sum.value
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

    // 1-3. "If you have a section 1250 property in Part III of Form 4797 for
    //      which you made an entry in Part I of Form 4797 … enter the smaller
    //      of line 22 or line 24 of Form 4797 for that property" (line 1),
    //      less "the amount from Form 4797, line 26g" (line 2).
    //
    //      **This block stopped being a documented zero in the Form 4797
    //      phase.** Its comment used to read "entirely about real
    //      property/depreciation recapture this project has no document type
    //      for", and `vnd.fjs.asset_register`'s per-asset `disposal` block is
    //      that document type. `fjs/form4797` computes lines 1-3 per property
    //      and hands over the sum, because only that module holds Form 4797's
    //      lines 22, 24 and 26g.
    const unrecap1250Line3 = formFortySevenNinetySeven === undefined
        ? 0n
        : formFortySevenNinetySeven.unrecapturedSectionTwelveFiftyGainCents
    // 4. Form 6252 installment sales — documented 0, no Form 6252.
    const unrecap1250Line4 = 0n
    // 5. "Enter the total of any amounts reported to you on a Schedule K-1
    //    from a partnership or an S corporation as 'unrecaptured section 1250
    //    gain'" — documented 0 for the reason line 10 below is: the §1250
    //    slice BOXES on both K-1 dialects refuse at storage.
    const unrecap1250Line5 = 0n
    // 6. "Add lines 3 through 5."
    const unrecap1250Line6 = unrecap1250Line3 + unrecap1250Line4 + unrecap1250Line5
    // 7. "Enter the smaller of line 6 or the gain from Form 4797, line 7."
    //    The cap is applied HERE rather than inside `fjs/form4797`, because
    //    line 6 first adds two summands that form knows nothing about. And it
    //    is what the worksheet's own opening sentence means — "If you aren't
    //    reporting a gain on Form 4797, line 7, skip lines 1 through 9" —
    //    since `partOneGainCents` is `0n` whenever line 7 is not a gain.
    const formFortySevenNinetySevenGain = formFortySevenNinetySeven === undefined
        ? 0n
        : formFortySevenNinetySeven.partOneGainCents
    const unrecap1250Line7 = unrecap1250Line6 < formFortySevenNinetySevenGain
        ? unrecap1250Line6
        : formFortySevenNinetySevenGain
    // 8. "Enter the amount, if any, from Form 4797, line 8" — the
    //    nonrecaptured net §1231 losses §1231(c) has already turned into
    //    ordinary income, which must not ALSO be taxed at 25%.
    const unrecap1250Line8 = formFortySevenNinetySeven === undefined
        ? 0n
        : formFortySevenNinetySeven.lineEightCents
    // 9. "Subtract line 8 from line 7. If zero or less, enter -0-."
    const unrecap1250Line9Raw = unrecap1250Line7 - unrecap1250Line8
    const unrecap1250Line9 = unrecap1250Line9Raw > 0n ? unrecap1250Line9Raw : 0n
    // 10. Partnership §1250 gain share via Schedule K-1 — documented 0,
    //     and **the reason changed with TAX-35 even though the value did
    //     not**. It used to be "no K-1 dialect"; there are three now, and
    //     lines 5 and 12 above read them. This line stays 0 because the
    //     §1250 slice BOXES still refuse at storage (1065 box 9c, 1120-S
    //     box 8c, 1041 box 4c), so no stored document can carry one. A
    //     reason that is merely still-true-by-accident is worse than a
    //     wrong one, because the next reader trusts it.
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

    // ── TAX-34: the UNCORRECTED figure, carried out beside the corrected one
    //
    // Not a printed Schedule D line. `line16Unadjusted` is what line 16 would
    // have been with no `vnd.fjs.basis_correction` at all, rebuilt from the
    // four categories' own `unadjustedValue`s and the SAME lines 3-6 and 10-14
    // the real line 16 used — never recomputed by a second traversal, which
    // could disagree with the first. `basisCorrectionOverstatement` is the
    // difference: the amount of already-taxed compensation this return would
    // otherwise have taxed a second time.
    //
    // **It is the GAIN's overstatement, not the AGI's.** Where line 16 is a
    // loss the $3,000/$1,500 cap on line 21 absorbs part or all of it, so the
    // figure that actually reaches 1040 line 7a moves by less. Naming the
    // field for what it measures is the honest option; a reader pricing the
    // tax effect has to go through the cap themselves.
    const unadjustedLine7 = line1a + categoryA.unadjustedValue + categoryB.unadjustedValue
        + line3 + line4 + line5 + line6
    const unadjustedLine15 = line8a + categoryD.unadjustedValue + categoryE.unadjustedValue
        + line10 + line11 + line12 + line13 + line14
    const line16Unadjusted = unadjustedLine7 + unadjustedLine15
    const basisCorrectionOverstatement = line16Unadjusted - line16

    /** @type {readonly Source[]} */
    const sources = [
        ...categoryA.sources, ...categoryB.sources, ...categoryD.sources, ...categoryE.sources,
        ...line13Sum.sources, ...twentyEightPercentLine4Sum.sources, ...unrecap1250Line11Sum.sources,
        ...line6Sources, ...line14Sources,
        ...line5Sum.sources, ...line12Sum.sources,
        ...(sectionTwelveFiftySix === undefined ? [] : sectionTwelveFiftySix.sources),
        ...(formFortySevenNinetySeven === undefined ? [] : formFortySevenNinetySeven.sources),
    ]

    return {
        kind: 'ok',
        line1a, line1b, line2, line3, line4, line5, line6, line7,
        line8a, line8b, line9, line10, line11, line12, line13, line14, line15,
        line16, line18, line19, line21,
        line7aCapitalGainOrLoss,
        line16Unadjusted,
        basisCorrectionOverstatement,
        form8949Rows: form8949Outcome.rows,
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

/**
 * The three K-1 faces' capital-gain boxes, one builder each — TAX-35. Three
 * separate builders rather than one parameterised by dialect, for the reason
 * `fjs/form1040/core`'s own portfolio fixtures give: the whole hazard is that
 * the same printed line is a different box NUMBER on each face, so a fixture
 * repointable by changing one field would let a mis-numbered read pass by
 * construction.
 * @type {(hash: string) => (boxes: { readonly box8NetShortTermCapitalGain?: string, readonly box9aNetLongTermCapitalGain?: string }) => Stored<K1Partnership>}
 */
const partnershipGainK1 = hash => boxes => ({
    documentHash: hash,
    value: {
        dialect: 'vnd.fjs.k1_1065',
        payerTin: '33-3333333',
        recipientTin: '222-22-2222',
        accountNumber: 'PTR-0003',
        taxYear: 2025,
        formRevision: '2025',
        boxGGeneralPartnerOrLlcMemberManager: /** @type {const} */ (true),
        materialParticipation: 'materiallyParticipated',
        ...boxes,
    },
})

/**
 * @type {(hash: string) => (boxes: { readonly box7NetShortTermCapitalGain?: string, readonly box8aNetLongTermCapitalGain?: string }) => Stored<K1SCorporation>}
 */
const sCorporationGainK1 = hash => boxes => ({
    documentHash: hash,
    value: {
        dialect: 'vnd.fjs.k1_1120s',
        payerTin: '44-4444444',
        recipientTin: '222-22-2222',
        accountNumber: 'SHR-0003',
        taxYear: 2025,
        formRevision: '2025',
        materialParticipation: 'materiallyParticipated',
        ...boxes,
    },
})

/**
 * @type {(hash: string) => (boxes: { readonly box3NetShortTermCapitalGain?: string, readonly box4aNetLongTermCapitalGain?: string }) => Stored<K1EstateTrust>}
 */
const estateTrustGainK1 = hash => boxes => ({
    documentHash: hash,
    value: {
        dialect: 'vnd.fjs.k1_1041',
        payerTin: '66-6666666',
        recipientTin: '222-22-2222',
        taxYear: 2025,
        formRevision: '2025',
        boxHDomesticBeneficiary: /** @type {const} */ (true),
        materialParticipation: 'materiallyParticipated',
        ...boxes,
    },
})

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
    // ── TAX-35: printed lines 5 and 12, the pass-through capital gain ───
    passThroughCapitalGains: {
        // **Six boxes, six DIFFERENT amounts, and both lines asserted
        // separately.** Equal amounts would make a short/long transposition
        // invisible even to the two line totals, and a single net figure
        // would hide it completely -- which is why this module already keeps
        // lines 7 and 15 independently observable.
        //
        // Short-term (line 5): $700.00 partner box 8 + $50.00 shareholder
        //   box 7 + $9.00 beneficiary box 3 = $759.00.
        //   Hand-typed: 70000 + 5000 + 900 = 75900 cents.
        // Long-term (line 12): $6,000.00 partner box 9a + $400.00
        //   shareholder box 8a + $30.00 beneficiary box 4a = $6,430.00.
        //   Hand-typed: 600000 + 40000 + 3000 = 643000 cents.
        allThreeFacesReachLinesFiveAndTwelveAtTheirOwnBoxNumbers: () => {
            const result = expectOk(scheduleD({
                status: 'single',
                brokerageForms: [],
                dividendForms: [],
                partnershipK1Forms: [partnershipGainK1('doc-k1-1065-gain')({
                    box8NetShortTermCapitalGain: '700.00',
                    box9aNetLongTermCapitalGain: '6000.00',
                })],
                sCorporationK1Forms: [sCorporationGainK1('doc-k1-1120s-gain')({
                    box7NetShortTermCapitalGain: '50.00',
                    box8aNetLongTermCapitalGain: '400.00',
                })],
                estateTrustK1Forms: [estateTrustGainK1('doc-k1-1041-gain')({
                    box3NetShortTermCapitalGain: '9.00',
                    box4aNetLongTermCapitalGain: '30.00',
                })],
            }))
            assertEq(result.line5, 75900n, 'ST: $700 + $50 + $9 = $759.00')
            assertEq(result.line12, 643000n, 'LT: $6,000 + $400 + $30 = $6,430.00')
            // Lines 7 and 15 must have TAKEN the two summands -- the whole
            // point of routing them, and the thing a line-5 assertion alone
            // cannot see if line 7 forgot to add it.
            assertEq(result.line7, 75900n, 'line 7 combines 1a-6, and 5 is the only non-zero')
            assertEq(result.line15, 643000n, 'line 15 combines 8a-14, and 12 is the only non-zero')
            assertEq(result.line16, 718900n, '$759.00 + $6,430.00 = $7,189.00')
            // **Per-box `boxPath` AND the amount cited against it.**
            // `addBoxSums` concatenates `sources`, so a swap of any two of
            // these six reads leaves BOTH totals untouched when the swap is
            // within a line, and is visible only here.
            const citedAt = /** @type {(path: string) => string | undefined} */ (
                path => result.sources.find(source => source.boxPath === path)?.value)
            assertEq(citedAt('k1_1065.box8NetShortTermCapitalGain'), '700.00')
            assertEq(citedAt('k1_1120s.box7NetShortTermCapitalGain'), '50.00')
            assertEq(citedAt('k1_1041.box3NetShortTermCapitalGain'), '9.00')
            assertEq(citedAt('k1_1065.box9aNetLongTermCapitalGain'), '6000.00')
            assertEq(citedAt('k1_1120s.box8aNetLongTermCapitalGain'), '400.00')
            assertEq(citedAt('k1_1041.box4aNetLongTermCapitalGain'), '30.00')
            // ...and the DOCUMENT each names, so a read that hits the right
            // box on the wrong collection is visible too.
            const hashAt = /** @type {(path: string) => string | undefined} */ (
                path => result.sources.find(source => source.boxPath === path)?.documentHash)
            assertEq(hashAt('k1_1065.box8NetShortTermCapitalGain'), 'doc-k1-1065-gain')
            assertEq(hashAt('k1_1120s.box7NetShortTermCapitalGain'), 'doc-k1-1120s-gain')
            assertEq(hashAt('k1_1041.box3NetShortTermCapitalGain'), 'doc-k1-1041-gain')
        },
        // **THE SHORT/LONG TRANSPOSITION GUARD.** One face, one box on each
        // side, and the two amounts chosen so that swapping them changes
        // NEITHER line 16 nor the sources' multiset -- only which line each
        // lands on. A proof that checked line 16, or even the set of cited
        // box paths, would pass a routing that put the partner's box 8 on
        // line 12 and box 9a on line 5.
        //
        // $2,000.00 short-term and $5,000.00 long-term: line 5 = 200000,
        // line 12 = 500000, line 16 = 700000 either way round.
        aShortForLongSwapIsVisibleInTheLinesEvenThoughTheTotalIsNot: () => {
            const result = expectOk(scheduleD({
                status: 'single',
                brokerageForms: [],
                dividendForms: [],
                partnershipK1Forms: [partnershipGainK1('doc-k1-swap')({
                    box8NetShortTermCapitalGain: '2000.00',
                    box9aNetLongTermCapitalGain: '5000.00',
                })],
            }))
            assertEq(result.line16, 700000n, 'the total a swap cannot move')
            assertEq(result.line5, 200000n, 'box 8 is SHORT-term and belongs on line 5')
            assertEq(result.line12, 500000n, 'box 9a is LONG-term and belongs on line 12')
            assertEq(result.line7, 200000n)
            assertEq(result.line15, 500000n)
        },
        // **THE CONTROL.** K-1s present with their capital-gain boxes
        // ABSENT leave both lines at zero and cite nothing -- DOC-11 at the
        // Schedule D layer, and the pair for the leaf above (a gate that
        // fires on every K-1 is not a gate).
        kOnesWithNoGainBoxesLeaveBothLinesZeroAndCiteNothing: () => {
            const result = expectOk(scheduleD({
                status: 'single',
                brokerageForms: [],
                dividendForms: [],
                partnershipK1Forms: [partnershipGainK1('doc-k1-1065-empty')({})],
                sCorporationK1Forms: [sCorporationGainK1('doc-k1-1120s-empty')({})],
                estateTrustK1Forms: [estateTrustGainK1('doc-k1-1041-empty')({})],
            }))
            assertEq(result.line5, 0n)
            assertEq(result.line12, 0n)
            assertEq(result.line16, 0n)
            const fromK1 = result.sources.filter(source => source.boxPath.startsWith('k1_'))
            assertEq(fromK1.length, 0, 'an absent box is ABSENT, never a zero citation')
        },
        // A pass-through LOSS reaches line 21's $3,000 cap exactly as a
        // brokerage loss does -- the computation a filer would lose entirely
        // by not declaring `capitalGainsOrLosses`, which is why
        // `fjs/return/tripwire` treats a negative box as proof of the
        // obligation rather than ignoring it.
        aPassThroughLossReachesTheThreeThousandDollarCap: () => {
            const result = expectOk(scheduleD({
                status: 'single',
                brokerageForms: [],
                dividendForms: [],
                estateTrustK1Forms: [estateTrustGainK1('doc-k1-1041-loss')({
                    box3NetShortTermCapitalGain: '-8000.00',
                })],
            }))
            assertEq(result.line5, -800000n)
            assertEq(result.line16, -800000n)
            assertEq(result.line21, -300000n, 'capped at $3,000.00 for a single filer')
            assertEq(result.line7aCapitalGainOrLoss, -300000n)
        },
    },
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
        assertEq(result.line6, 0n)
        assertEq(result.line8a, 0n)
        assertEq(result.line10, 0n)
        assertEq(result.line14, 0n)
        // **Lines 4 and 11 are NO LONGER documented zeros** (TAX-38): they
        // take Form 6781 line 8 (40%, short-term) and line 9 (60%,
        // long-term). They are still 0n HERE, and that is now a CONTROL
        // rather than a structural fact -- this fixture supplies no
        // `sectionTwelveFiftySix` entry, so a wiring that manufactured a
        // phantom summand out of an absent one would redden here. The
        // `sectionTwelveFiftySixContracts` group below is the paired
        // positive case, and it is where the SHORT/LONG assignment is
        // proven; the same shape lines 5 and 12 took under TAX-35.
        assertEq(result.line4, 0n, 'no Form 6781 supplied: a legitimate zero, not a constant')
        assertEq(result.line11, 0n, 'no Form 6781 supplied: a legitimate zero, not a constant')
        // **Lines 5 and 12 are NO LONGER documented zeros** (TAX-35): they
        // read the separately stated capital gain off three Schedule K-1
        // faces. They are still 0n HERE, and that is now a CONTROL rather
        // than a structural fact -- this fixture holds no K-1, so a routing
        // that manufactured a phantom summand out of an empty list would
        // redden here. `passThroughCapitalGains` below is the paired
        // positive case.
        assertEq(result.line5, 0n, 'no Schedule K-1 supplied: a legitimate zero, not a constant')
        assertEq(result.line12, 0n, 'no Schedule K-1 supplied: a legitimate zero, not a constant')
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
    // TAX-34/Phase 29: the corrected figure and the uncorrected one, side by
    // side on the schedule the 1040 actually reads.
    basisCorrection: {
        // THE DOUBLE-TAXATION FIGURE, PRICED, at the schedule.
        //
        // 1,000 RSUs vest at $150.00 and are sold the same day for
        // $150,000.00. The broker reports basis $0.00 and checks box 12.
        //
        //   Schedule D line 1b   Form 8949 category A, column (h)      $0.00
        //   Schedule D line 7    = line 1b                             $0.00
        //   Schedule D line 16   = line 7 + line 15                    $0.00
        //   1040 line 7a         a zero year routes exactly $0.00      $0.00
        //
        // and the uncorrected counterpart, hand-computed the same way:
        //
        //   line 1b uncorrected  $150,000.00 - $0.00            $150,000.00
        //   line 16 uncorrected                                 $150,000.00
        //
        // so `basisCorrectionOverstatement` is $150,000.00 of already-taxed
        // wages that would have been taxed a second time as a capital gain.
        theRsuOverstatementIsPricedOnScheduleD: () => {
            const sale = brokerageForm('doc-rsu-sched-d')({
                box1dProceeds: '150000.00',
                box1eCostOrOtherBasis: '0.00',
                box2ShortTermGainOrLoss: true,
                box12BasisReportedToIrs: true,
            })
            /** @type {Stored<BasisCorrection>} */
            const correction = {
                documentHash: 'doc-fix-sched-d',
                value: {
                    dialect: 'vnd.fjs.basis_correction',
                    recipientTin: '222-22-2222',
                    taxYear: 2025,
                    brokerageDocumentHash: 'doc-rsu-sched-d',
                    correctedCostOrOtherBasis: '150000.00',
                    reason: 'RSU vesting value already included in Form W-2 box 1',
                },
            }
            const result = expectOk(scheduleD({
                status: 'single',
                brokerageForms: [sale],
                dividendForms: [],
                basisCorrections: [correction],
            }))
            assertEq(result.line1b, 0n, 'line 1b = the CORRECTED category A total, $0.00')
            assertEq(result.line7, 0n)
            assertEq(result.line16, 0n)
            assertEq(result.line7aCapitalGainOrLoss, 0n, 'nothing reaches 1040 line 7a')
            assertEq(
                result.line16Unadjusted, 15000000n,
                'the UNCORRECTED line 16: $150,000.00 - $0.00')
            assertEq(
                result.basisCorrectionOverstatement, 15000000n,
                'the double taxation this one document removes: $150,000.00')
            // The Form 8949 row travels out with the schedule, so a report can
            // print the column (f) code and the column (g) amount the totals
            // were built from rather than reconstructing them.
            assertEq(result.form8949Rows.length, 1)
            const row = assertNotNullish(result.form8949Rows[0], 'one row')
            assertEq(row.columnFCode, 'B')
            assertEq(row.columnGAdjustment, -15000000n)
        },
        // THE CONTROL, and it is criterion 5 at this layer: a return with no
        // corrections has `line16Unadjusted === line16` and an overstatement of
        // exactly zero. Run against a fixture with REAL Part I and Part II
        // activity, so the equality is a computed agreement rather than two
        // untouched zeros.
        aReturnWithNoCorrectionsPricesNoOverstatement: () => {
            const stGainDoc = brokerageForm('doc-control-st')({
                box1dProceeds: '5000.00',
                box1eCostOrOtherBasis: '3000.00',
                box2ShortTermGainOrLoss: true,
                box12BasisReportedToIrs: true,
            })
            const ltGainDoc = brokerageForm('doc-control-lt')({
                box1dProceeds: '9000.00',
                box1eCostOrOtherBasis: '4000.00',
                box2LongTermGainOrLoss: true,
            })
            const result = expectOk(scheduleD({
                status: 'single',
                brokerageForms: [stGainDoc, ltGainDoc],
                dividendForms: [],
            }))
            assertEq(result.line16, 700000n, '$2,000.00 + $5,000.00 = $7,000.00')
            assertEq(result.line16Unadjusted, 700000n, 'the same figure, nothing corrected')
            assertEq(result.basisCorrectionOverstatement, 0n)
            for (const row of result.form8949Rows) {
                assertEq(row.columnFCode, '', 'no code on an uncorrected row')
                assertEq(row.columnGAdjustment, 0n)
            }
        },
        // The uncorrected figure is rebuilt from the SAME non-Form-8949 lines
        // the real line 16 uses, not from the category totals alone. A
        // prior-year carryover moves line 6 by -$6,000.00, and both figures
        // must move with it -- otherwise `basisCorrectionOverstatement` would
        // silently absorb every non-8949 line as though it were an
        // overstatement. Reuses `fjs/tax/carryover`'s own independently
        // verified Worked Example B.
        theUncorrectedFigureCarriesEveryOtherLineToo: () => {
            /** @type {Stored<PriorYearCapitalLoss>} */
            const carryoverDoc = {
                documentHash: 'doc-carryover-unadjusted',
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
            const sale = brokerageForm('doc-carryover-sale')({
                box1dProceeds: '20000.00',
                box1eCostOrOtherBasis: '0.00',
                box2ShortTermGainOrLoss: true,
                box12BasisReportedToIrs: true,
            })
            const result = expectOk(scheduleD({
                status: 'single',
                brokerageForms: [sale],
                dividendForms: [],
                priorYearCapitalLossCarryover: carryoverDoc,
                basisCorrections: [{
                    documentHash: 'doc-fix-carryover',
                    value: {
                        dialect: 'vnd.fjs.basis_correction',
                        recipientTin: '222-22-2222',
                        taxYear: 2025,
                        brokerageDocumentHash: 'doc-carryover-sale',
                        correctedCostOrOtherBasis: '20000.00',
                        reason: 'RSU vesting value already included in Form W-2 box 1',
                    },
                }],
            }))
            assertEq(result.line6, -600000n, 'the $6,000.00 short-term carryover, as a negative')
            // Corrected: $0.00 of gain, less the $6,000.00 carryover.
            assertEq(result.line16, -600000n, 'corrected line 16 = -$6,000.00')
            // Uncorrected: $20,000.00 of gain, less the SAME $6,000.00.
            assertEq(result.line16Unadjusted, 1400000n, 'uncorrected line 16 = $14,000.00')
            // …and the overstatement is the $20,000.00 correction alone, NOT
            // the carryover, which appears identically in both.
            assertEq(result.basisCorrectionOverstatement, 2000000n, '$20,000.00, the correction alone')
            // The cap caveat the field's own docstring names, exercised: the
            // corrected line 16 is a $6,000.00 loss, so 1040 line 7a is capped
            // at -$3,000.00 and moves by far less than the gain did.
            assertEq(result.line7aCapitalGainOrLoss, -300000n, 'capped at $3,000.00, single filer')
        },
        // Form 8949's refusals thread through unchanged: an unmatched
        // correction stops the whole schedule, naming the document.
        anUnmatchedCorrectionPropagatesVerbatim: () => {
            const outcome = scheduleD({
                status: 'single',
                brokerageForms: [],
                dividendForms: [],
                basisCorrections: [{
                    documentHash: 'doc-fix-orphan-sched-d',
                    value: {
                        dialect: 'vnd.fjs.basis_correction',
                        recipientTin: '222-22-2222',
                        taxYear: 2025,
                        brokerageDocumentHash: 'doc-nowhere',
                        correctedCostOrOtherBasis: '1.00',
                        reason: 'names a document this return does not hold',
                    },
                }],
            })
            assertEq(outcome.kind, 'error', ['expected the refusal to propagate', outcome])
            if (outcome.kind !== 'error') {
                throw ['expected error', outcome]
            }
            assert(outcome.message.includes('doc-nowhere'), [outcome.message])
        },
    },
    // ── TAX-38: Form 6781 lines 8 and 9 reach printed lines 4 and 11 ────
    sectionTwelveFiftySixContracts: {
        /*
         * ★ THE ASSIGNMENT, and it is the only thing this group exists to
         * prove: the SHORT-term half lands on line 4 and the LONG-term half
         * on line 11, never the other way round. Hand-typed in cents.
         *
         *   Form 6781 line 7   $43,000.00
         *   Form 6781 line 8   40%, short-term    $17,200.00  -> Sch D line 4
         *   Form 6781 line 9   60%, long-term     $25,800.00  -> Sch D line 11
         *
         * The fixture supplies NO brokerage sale, so lines 1b/2/8b/9 are all
         * zero and lines 7 and 15 are the two halves ALONE — which is what
         * makes a transposition visible. With a stock sale in the mix, a swap
         * would move two lines that already had other content and the totals
         * would still agree.
         *
         *   line 7  = 17,200.00      line 15 = 25,800.00
         *   line 16 = 43,000.00 (a gain, so line 21 is 0 and 7a is line 16)
         */
        theShortHalfLandsOnLineFourAndTheLongHalfOnLineEleven: () => {
            const result = expectOk(scheduleD({
                status: 'single',
                brokerageForms: [],
                dividendForms: [],
                sectionTwelveFiftySix: {
                    shortTermCents: 1720000n,
                    longTermCents: 2580000n,
                    sources: [{
                        documentHash: 'doc-6781',
                        boxPath: 'box11AggregateProfitOrLoss',
                        value: '43000.00',
                    }],
                },
            }))
            assertEq(result.line4, 1720000n, '$17,200.00 — the 40% SHORT-term half')
            assertEq(result.line11, 2580000n, '$25,800.00 — the 60% LONG-term half')
            assertEq(result.line7, 1720000n, 'Part I total is the short half alone')
            assertEq(result.line15, 2580000n, 'Part II total is the long half alone')
            assertEq(result.line16, 4300000n, '$43,000.00 combined')
            assertEq(result.line21, 0n, 'a gain, so no loss cap')
            assertEq(result.line7aCapitalGainOrLoss, 4300000n)
            // ★ The transposition guard, stated as an INEQUALITY between the
            // two printed lines rather than only as two equalities: swapping
            // the two halves leaves line 16 at $43,000.00 and reddens this.
            assert(
                result.line11 > result.line4,
                ['the 60% long half must be the larger of the two printed lines on a gain',
                    result.line4, result.line11])
            // The citation rides through to the caller, so a report can say
            // which document the figure came from.
            assertEq(result.sources.filter(s => s.documentHash === 'doc-6781').length, 1)
        },
        /*
         * ★ A section 1256 LOSS meets the $3,000 cap, which is the whole
         * reason an undeclared filer must be tripwired rather than quietly
         * given a zero.
         *
         *   Form 6781 line 7   $-37,000.00
         *   line 8   40%   $-14,800.00  -> line 4
         *   line 9   60%   $-22,200.00  -> line 11
         *   line 16  $-37,000.00
         *   line 21  -min(37,000.00, 3,000.00)  =  $-3,000.00
         *   line 7a  line 21, because line 16 is a loss
         */
        aSectionTwelveFiftySixLossMeetsTheThreeThousandDollarCap: () => {
            const result = expectOk(scheduleD({
                status: 'single',
                brokerageForms: [],
                dividendForms: [],
                sectionTwelveFiftySix: {
                    shortTermCents: -1480000n, longTermCents: -2220000n, sources: [],
                },
            }))
            assertEq(result.line4, -1480000n, '$-14,800.00')
            assertEq(result.line11, -2220000n, '$-22,200.00')
            assertEq(result.line16, -3700000n, '$-37,000.00')
            assertEq(result.line21, -300000n, '$-3,000.00 — the single filer\u2019s cap')
            assertEq(result.line7aCapitalGainOrLoss, -300000n)
            // And the same loss for a married-filing-separately filer stops
            // at $1,500.00, so this leaf is about the CAP and not about the
            // constant $3,000.00 happening to be right.
            const separately = expectOk(scheduleD({
                status: 'marriedFilingSeparately',
                brokerageForms: [],
                dividendForms: [],
                sectionTwelveFiftySix: {
                    shortTermCents: -1480000n, longTermCents: -2220000n, sources: [],
                },
            }))
            assertEq(separately.line21, -150000n, '$-1,500.00')
        },
        /*
         * The section 1256 halves NET against ordinary Part I and Part II
         * activity rather than replacing it — a $5,000.00 short-term stock
         * gain plus a $-14,800.00 short-term section 1256 loss is $-9,800.00
         * on line 7, and the long side is a $5,000.00 stock gain plus
         * $-22,200.00 on line 15 = $-17,200.00.
         *
         *   line 1b  10,000.00 - 5,000.00   =  $5,000.00
         *   line 4                             $-14,800.00
         *   line 7   5,000.00 - 14,800.00   =  $-9,800.00
         *   line 8b  12,000.00 - 7,000.00   =  $5,000.00
         *   line 11                            $-22,200.00
         *   line 15  5,000.00 - 22,200.00   =  $-17,200.00
         */
        theSectionTwelveFiftySixHalvesNetAgainstOrdinarySales: () => {
            const result = expectOk(scheduleD({
                status: 'single',
                brokerageForms: [
                    brokerageForm('doc-1256-st')({
                        box1dProceeds: '10000.00',
                        box1eCostOrOtherBasis: '5000.00',
                        box2ShortTermGainOrLoss: true,
                        box12BasisReportedToIrs: true,
                    }),
                    brokerageForm('doc-1256-lt')({
                        box1dProceeds: '12000.00',
                        box1eCostOrOtherBasis: '7000.00',
                        box2LongTermGainOrLoss: true,
                        box12BasisReportedToIrs: true,
                    }),
                ],
                dividendForms: [],
                sectionTwelveFiftySix: {
                    shortTermCents: -1480000n, longTermCents: -2220000n, sources: [],
                },
            }))
            assertEq(result.line1b, 500000n, '$5,000.00 of category-A stock gain')
            assertEq(result.line8b, 500000n, '$5,000.00 of category-D stock gain')
            assertEq(result.line7, -980000n, '$-9,800.00 short-term after the 1256 loss')
            assertEq(result.line15, -1720000n, '$-17,200.00 long-term after the 1256 loss')
            assertEq(result.line16, -2700000n, '$-27,000.00')
            // TAX-34's uncorrected parallel carries both lines too, so the
            // basis-correction overstatement is unaffected by section 1256.
            assertEq(result.line16Unadjusted, -2700000n)
            assertEq(result.basisCorrectionOverstatement, 0n)
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
