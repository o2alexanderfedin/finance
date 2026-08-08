/**
 * `vnd.fjs.1099b` — DOC-07: Form 1099-B, Proceeds From Broker and Barter
 * Exchange Transactions.
 *
 * Sources, fetched and read directly (12-RESEARCH.md Q2), not from recall:
 * - `https://www.irs.gov/pub/irs-pdf/f1099b--2025.pdf` — the year-specific
 *   TY2025 revision (the form itself prints the literal year "2025"
 *   prominently, not a "Rev. Month Year" string). This is the ONLY valid
 *   source for TY2025: fetched and read directly, 2026-08-07.
 * - `https://www.irs.gov/pub/irs-pdf/f1099b.pdf` — **the canonical
 *   un-suffixed URL. It returns HTTP 404 as of this session.** Unlike
 *   1099-DIV and 1099-INT, 1099-B has NO stable un-suffixed alias: the IRS's
 *   current distribution scheme for this form requires the year-suffixed
 *   `f1099b--<year>.pdf` URL, with nothing served at the bare name. Recorded
 *   here plainly rather than silently worked around, per the phase's
 *   drift-risk mandate.
 * - `https://www.irs.gov/pub/irs-prior/i1099b--2026.pdf` — the 2026
 *   Instructions for Form 1099-B, cross-referenced to check for box-number or
 *   box-meaning drift into the following year. Found: address-field-format
 *   changes only, no box-number or box-meaning changes identified between the
 *   TY2025 form and the 2026 instructions' description.
 *
 * Follows the `fjs/media/revision` four-stage template exactly as
 * `fjs/document/1099r/module.f.js` (the closest, most recent analog) and
 * `fjs/document/1099div/module.f.js` (this same phase's sibling dialect) do:
 * dialect -> mediaType -> schema -> structural validate -> semantic
 * `checkReferences` -> composed `validate`.
 *
 * **`sourceArtifactHash` is a NEW field this phase introduces (DOC-13).** It
 * is declared as plain `string` — REQUIRED, never `option` — for the same
 * reason as `vnd.fjs.1099div` (12-RESEARCH.md Assumption A3): every real
 * document is extracted from some artifact and there is no legacy stored
 * `vnd.fjs.1099b` instance to stay backward-compatible with (this is a
 * brand-new dialect). Validated via `isHash` in `checkReferences`. The
 * shared `base()` helper is deliberately NOT widened for this — see
 * `vnd.fjs.1099div`'s docstring for the full rationale, which applies here
 * unchanged.
 *
 * ## Box 1e / box 12 — the DOC-07 distinction this dialect exists to carry
 *
 * A blank box 1e means "basis not reported" — which is NOT the same fact as
 * "basis reported as zero," and treating the two as interchangeable changes
 * the gain a return would compute from this document. Per the fetched
 * instructions: **"If box 5 is checked, box 1e may be blank"** — most
 * commonly because the security is noncovered (purchased before the IRS's
 * basis-reporting regime began covering that security type) and the broker
 * genuinely has no basis figure to report. Box 1e (`option(string)`, money)
 * and box 12 "Check if basis reported to IRS" (`option(true)`, checkbox) are
 * modeled as two INDEPENDENT fields — never one derived from the other's
 * absence — because a present, non-blank box 1e can still be UNREPORTED to
 * the IRS (box 12 unchecked), which is a distinct fact from box 1e being
 * genuinely blank. `proof.criterion2GainConsequence` below is the
 * DIALECT-LEVEL proof this phase's own boundary requires: it does not
 * compute Form 8949/Schedule D (Phase 12.1's job), but it does exhibit, with
 * a small proof-local helper, that naively treating a genuinely-absent box
 * 1e as `'0.00'` produces a DIFFERENT dollar figure than the same formula
 * applied when box 1e is genuinely present — the actual consequence DOC-07
 * names, not merely that the field can be omitted.
 *
 * Field-shape notes:
 * - **Boxes 8, 9, 10, and 11 (profit-or-loss on contracts) CAN be
 *   negative** — unlike every other money box modeled in this codebase
 *   before now, these are profit-OR-loss boxes. `moneyFieldError` already
 *   accepts negatives (proven by its own `negativeAccepted` leaf); no
 *   separate positive-only check is added for these four boxes.
 * - **Box 2 prints THREE separate checkboxes** (Short-term gain or loss /
 *   Long-term gain or loss / Ordinary), modeled independently as
 *   `box2ShortTermGainOrLoss`, `box2LongTermGainOrLoss`, `box2Ordinary` —
 *   never collapsed into one three-way enum, because the printed form itself
 *   allows any subset to be blank (e.g. all three blank if box 5 is
 *   checked).
 * - **Box 3 prints TWO separate checkboxes** (Collectibles / QOF), modeled
 *   independently as `box3CollectiblesProceeds`, `box3QofProceeds`.
 * - **Box 6 prints TWO separate checkboxes** (Reported to IRS: Gross
 *   proceeds / Net proceeds), modeled independently as
 *   `box6ReportedToIrsGrossProceeds`, `box6ReportedToIrsNetProceeds`.
 * - **`applicableCheckboxOnForm8949` stores the payer-printed letter (A-F)
 *   VERBATIM** — this phase never derives it from boxes 2/5/12. That
 *   derivation is Phase 12.1's Form 8949 categorization job, explicitly
 *   named as an anti-pattern in 12-RESEARCH.md.
 * - `box1aDescriptionOfProperty`, `box1bDateAcquired` (free text — no date
 *   primitive in this project; may be blank if box 5 is checked, or if
 *   securities were acquired on a variety of dates), `box1cDateSoldOrDisposed`
 *   (free text), `cusipNumber`, and `applicableCheckboxOnForm8949` stay plain
 *   `option(string)` with NO numeric-exactness check — none of them is
 *   money.
 * - **No locality boxes exist on 1099-B** — boxes 14-16 are state-only
 *   (`state`, `stateIdNumber`, `stateTaxWithheld`), the identical shape to
 *   `vnd.fjs.1099div`'s repeating group, not `1099r`'s fuller state+local
 *   group.
 * - Every checkbox is `option(true)` — DOC-12 — for `corrected`,
 *   `fatcaFilingRequirement`, `box2ShortTermGainOrLoss`,
 *   `box2LongTermGainOrLoss`, `box2Ordinary`, `box3CollectiblesProceeds`,
 *   `box3QofProceeds`, `box5NoncoveredSecurity`,
 *   `box6ReportedToIrsGrossProceeds`, `box6ReportedToIrsNetProceeds`,
 *   `box7LossNotAllowedBasedOnAmountIn1d`, `box12BasisReportedToIrs`. The
 *   printed "2nd TIN not." checkbox is filer-only and NOT modeled — same
 *   precedent as every existing dialect.
 *
 * This module STORES AND READS only. It does not compute Form 8949
 * categories, Schedule D, or any gain/loss figure that feeds a return — that
 * chain is explicitly Phase 12.1's (12-CONTEXT.md, 12-RESEARCH.md's
 * Anti-Patterns). This file imports NOTHING at runtime from `fjs/tax/`,
 * `fjs/return/`, or `fjs/form1040/`.
 *
 * @module
 */
import { array, number, option, string } from 'functionalscript/fjs/types/rtti/module.f.js'
import { validate as rttiValidate } from 'functionalscript/fjs/types/rtti/validate/module.f.js'
import { error, ok } from 'functionalscript/fjs/types/result/module.f.js'
import { assert, assertEq } from 'functionalscript/fjs/asserts/module.f.js'
import { isHash } from 'functionalscript/fjs/media/revision/module.f.js'
import { base, mediaTypeOf } from '../base/module.f.js'
import { moneyFieldError } from '../money_field/module.f.js'
import { centsFromString } from '../../exact/module.f.js'

/** @import { Result } from 'functionalscript/fjs/types/result/module.f.js' */
/** @import { Ts, Unknown } from 'functionalscript/fjs/types/rtti/ts/module.f.js' */
/** @import { ValidationError } from 'functionalscript/fjs/types/rtti/validate/module.f.js' */

/**
 * Format tag: names the dialect of this BLOB. The media type it is served
 * with is derived mechanically: `application/` + `dialect` + `+json`.
 */
export const dialect = 'vnd.fjs.1099b'
/** The media type derived from {@link dialect}: `application/vnd.fjs.1099b+json`. */
export const mediaType = mediaTypeOf(dialect)

/**
 * One boxes-14-through-16 row: state, state ID number, state tax withheld.
 * 1099-B has NO locality boxes — identical shape to `vnd.fjs.1099div`'s
 * `stateEntry`, not `1099r`'s fuller `stateLocalEntry`. Every field but
 * `state` is absent-able, because the printed form routinely leaves the rest
 * blank (DOC-11).
 */
const stateEntry = /** @type {const} */ ({
    state: string,
    stateIdNumber: option(string),
    stateTaxWithheld: option(string),
})

/**
 * rtti schema for a `1099b` BLOB. `dialect` is spread first (via `base`) so
 * structural validation reports it as the first failing field on a
 * mismatched blob (DOC-00's discriminant).
 */
export const oneZeroNineNineBSchema = /** @type {const} */ ({
    ...base(dialect),
    payerTin: string,
    recipientTin: string,
    accountNumber: string,
    taxYear: number,
    formRevision: string,
    corrected: option(true),
    sourceArtifactHash: string,
    cusipNumber: option(string),
    fatcaFilingRequirement: option(true),
    applicableCheckboxOnForm8949: option(string),
    box1aDescriptionOfProperty: option(string),
    box1bDateAcquired: option(string),
    box1cDateSoldOrDisposed: option(string),
    box1dProceeds: option(string),
    box1eCostOrOtherBasis: option(string),
    box1fAccruedMarketDiscount: option(string),
    box1gWashSaleLossDisallowed: option(string),
    box2ShortTermGainOrLoss: option(true),
    box2LongTermGainOrLoss: option(true),
    box2Ordinary: option(true),
    box3CollectiblesProceeds: option(true),
    box3QofProceeds: option(true),
    box4FederalIncomeTaxWithheld: option(string),
    box5NoncoveredSecurity: option(true),
    box6ReportedToIrsGrossProceeds: option(true),
    box6ReportedToIrsNetProceeds: option(true),
    box7LossNotAllowedBasedOnAmountIn1d: option(true),
    box8ProfitOrLossRealized: option(string),
    box9UnrealizedProfitOrLossPriorYearEnd: option(string),
    box10UnrealizedProfitOrLossCurrentYearEnd: option(string),
    box11AggregateProfitOrLoss: option(string),
    box12BasisReportedToIrs: option(true),
    box13Bartering: option(string),
    stateLocal: option(array(stateEntry)),
    payerName: option(string),
    recipientName: option(string),
})

/** @typedef {Ts<typeof oneZeroNineNineBSchema>} OneZeroNineNineB */

/** Structural-only validator: checks the shape, not the semantic refinements below. */
const validateShape = rttiValidate(oneZeroNineNineBSchema)

/**
 * The scalar money boxes, walked in a loop so the exactness check is
 * written once. Typed via `@type {const}` (not a wider `keyof
 * OneZeroNineNineB`) so `r[field]` resolves to exactly `string | undefined`
 * — the same reason `vnd.fjs.1099div`/`vnd.fjs.1099r` do it this way.
 * Boxes 8-11 are included here like every other scalar money box:
 * `moneyFieldError` already accepts negatives (its own `negativeAccepted`
 * leaf proves it), so no separate positive-only check is needed for them.
 * `box1aDescriptionOfProperty`, `box1bDateAcquired`,
 * `box1cDateSoldOrDisposed`, `cusipNumber`, and
 * `applicableCheckboxOnForm8949` are deliberately NOT here — none is money.
 */
const moneyBoxFields = /** @type {const} */ ([
    'box1dProceeds',
    'box1eCostOrOtherBasis',
    'box1fAccruedMarketDiscount',
    'box1gWashSaleLossDisallowed',
    'box4FederalIncomeTaxWithheld',
    'box8ProfitOrLossRealized',
    'box9UnrealizedProfitOrLossPriorYearEnd',
    'box10UnrealizedProfitOrLossCurrentYearEnd',
    'box11AggregateProfitOrLoss',
    'box13Bartering',
])

/**
 * Independently hand-typed: the number of scalar money boxes
 * {@link moneyBoxFields} is expected to name today. Deliberately NOT derived
 * from `moneyBoxFields.length` — see
 * {@link generatedScalarMoneyBoxExactnessProof}.
 * @type {number}
 */
const expectedMoneyBoxFieldCount = 10

/**
 * The one money-carrying field of one boxes-14-through-16 row (`state` and
 * `stateIdNumber` are identity/label fields, not amounts, so they are
 * excluded). Named once, at module scope, so `checkReferences`' own loop
 * below and this module's generated exactness proof (further down) walk the
 * identical list rather than the check and its test being free to drift
 * apart (AGENTS.md, "one rule, one place").
 */
const stateLocalMoneyFields = /** @type {const} */ ([
    'stateTaxWithheld',
])

/**
 * Independently hand-typed: the number of boxes-14-through-16 money fields
 * {@link stateLocalMoneyFields} is expected to name today. Deliberately NOT
 * derived from `stateLocalMoneyFields.length` — see
 * {@link expectedMoneyBoxFieldCount}.
 * @type {number}
 */
const expectedStateLocalMoneyFieldCount = 1

/**
 * Either a structural validation error or a semantic (string) error message.
 * @typedef {ValidationError | string} OneZeroNineNineBError
 */

/**
 * Checks the semantic refinements the structural schema cannot express:
 * `formRevision` is non-empty (DOC-10), `sourceArtifactHash` decodes as a
 * real cBase32 hash (DOC-13), every PRESENT scalar money box (including the
 * negative-accepting boxes 8-11) is an exact decimal within safe magnitude,
 * and every PRESENT `stateLocal` row's money field is too. Absent boxes are
 * skipped, never defaulted (DOC-11) — most importantly box 1e, which this
 * dialect's own `proof.criterion2GainConsequence` exists to prove matters.
 * @type {(r: OneZeroNineNineB) => Result<OneZeroNineNineB, OneZeroNineNineBError>}
 */
export const checkReferences = r => {
    if (r.formRevision.trim() === '') {
        return error(`formRevision must not be empty or whitespace-only`)
    }
    if (!isHash(r.sourceArtifactHash)) {
        return error(`sourceArtifactHash is not a valid hash: ${r.sourceArtifactHash}`)
    }
    for (const field of moneyBoxFields) {
        const printed = r[field]
        if (printed === undefined) {
            continue
        }
        const message = moneyFieldError(field)(printed)
        if (message !== undefined) {
            return error(message)
        }
    }
    for (const entry of r.stateLocal ?? []) {
        for (const field of stateLocalMoneyFields) {
            const printed = entry[field]
            if (printed === undefined) {
                continue
            }
            const message = moneyFieldError(`${entry.state} ${field}`)(printed)
            if (message !== undefined) {
                return error(message)
            }
        }
    }
    return ok(r)
}

/**
 * Validates an already-parsed JSON value as a `1099b` BLOB: structural
 * (rtti) validation followed by the semantic checks in
 * {@link checkReferences}. Dialect discrimination happens exclusively
 * through the schema's exact-literal `dialect` constant — the serialized
 * JSON text is never inspected.
 * @type {(value: Unknown) => Result<OneZeroNineNineB, OneZeroNineNineBError>}
 */
export const validate = value => {
    const [t, v] = validateShape(value)
    if (t === 'error') {
        return error(v)
    }
    return checkReferences(v)
}

// ── Tests ────────────────────────────────────────────────────────────────────

/**
 * The literal `sourceArtifactHash` reused throughout this file's fixtures —
 * the SAME literal 12-01 and 12-05's DOC-13 proof reuse, so a
 * shared-provenance comparison across dialects is a plain `===` on identical
 * literals, not a coincidence to explain.
 * @type {string}
 */
const sharedSourceArtifactHash = 'deadbeef00112233445566778899aabbccddeeff0011223344556677889900'

/** @type {OneZeroNineNineB} */
const minimal = {
    dialect,
    payerTin: '11-1111111',
    recipientTin: '222-22-2222',
    accountNumber: 'ACC-0001',
    taxYear: 2025,
    formRevision: '2025',
    sourceArtifactHash: sharedSourceArtifactHash,
}

/**
 * A money box's name could be quietly dropped from {@link moneyBoxFields}
 * without anyone noticing — the field stays `option(string)` structurally,
 * so a comma-grouped amount in a dropped box would then validate as ok. One
 * generated leaf per NAMED scalar box supplies a comma-grouped value to that
 * box alone and asserts `validate` refuses, built by mapping
 * {@link moneyBoxFields} itself into `[field, assertion]` pairs (never as ten
 * hand-written near-identical leaves) — the same idiom
 * `fjs/document/1099div/module.f.js`'s generated leaves use — so a box added
 * to the list later is covered automatically.
 *
 * A box's own generated leaf disappears WITH it if the box is dropped from
 * the list, so this alone cannot catch a removal — {@link
 * expectedMoneyBoxFieldCount} above pairs it with an independently
 * hand-typed count.
 * @type {{ readonly [field: string]: () => void }}
 */
const generatedScalarMoneyBoxExactnessProof = Object.fromEntries(
    moneyBoxFields.map(field => [
        field,
        () => {
            const [t, v] = validate({ ...minimal, [field]: '1,234.56' })
            assertEq(t, 'error', ['expected a comma-grouped amount in this box to be refused', field, t, v])
        },
    ]),
)

/**
 * Same idiom as {@link generatedScalarMoneyBoxExactnessProof}, for the one
 * boxes-14-through-16 money field named in {@link stateLocalMoneyFields}.
 * @type {{ readonly [field: string]: () => void }}
 */
const generatedStateLocalMoneyExactnessProof = Object.fromEntries(
    stateLocalMoneyFields.map(field => [
        field,
        () => {
            const [t, v] = validate({ ...minimal, stateLocal: [{ state: 'CA', [field]: '1,234.56' }] })
            assertEq(
                t,
                'error',
                ['expected a comma-grouped amount in this stateLocal field to be refused', field, t, v])
        },
    ]),
)

/**
 * Proof-local (NOT exported — this phase does not compute Form 8949/
 * Schedule D) helper naively computing a gain from a printed proceeds figure
 * and a printed-or-absent basis figure, treating absence as `'0.00'`. Used
 * ONLY by {@link proof}.criterion2GainConsequence below to demonstrate the
 * DOC-07 consequence: applying this identical formula to a present-vs-absent
 * box 1e yields two different dollar figures, so silently conflating
 * "absent" with "reported as zero" would silently change what a return
 * reports.
 * @type {(proceedsPrinted: string) => (basisPrinted: string | undefined) => bigint}
 */
const naiveGain = proceedsPrinted => basisPrinted =>
    centsFromString(proceedsPrinted) - centsFromString(basisPrinted ?? '0.00')

export const proof = {
    dialectAndMediaType: () => {
        assertEq(dialect, 'vnd.fjs.1099b')
        assertEq(mediaType, 'application/vnd.fjs.1099b+json')
    },
    validate: {
        fullyPopulatedValidates: () => {
            const [t, v] = validate({
                ...minimal,
                corrected: true,
                cusipNumber: '037833100',
                fatcaFilingRequirement: true,
                applicableCheckboxOnForm8949: 'A',
                box1aDescriptionOfProperty: '100 sh XYZ Corp',
                box1bDateAcquired: '01/15/2024',
                box1cDateSoldOrDisposed: '06/20/2025',
                box1dProceeds: '10000.00',
                box1eCostOrOtherBasis: '6000.00',
                box1fAccruedMarketDiscount: '50.00',
                box1gWashSaleLossDisallowed: '25.00',
                box2ShortTermGainOrLoss: true,
                box2LongTermGainOrLoss: true,
                box2Ordinary: true,
                box3CollectiblesProceeds: true,
                box3QofProceeds: true,
                box4FederalIncomeTaxWithheld: '500.00',
                box5NoncoveredSecurity: true,
                box6ReportedToIrsGrossProceeds: true,
                box6ReportedToIrsNetProceeds: true,
                box7LossNotAllowedBasedOnAmountIn1d: true,
                box8ProfitOrLossRealized: '-500.00',
                box9UnrealizedProfitOrLossPriorYearEnd: '-1200.00',
                box10UnrealizedProfitOrLossCurrentYearEnd: '-1200.00',
                box11AggregateProfitOrLoss: '-500.00',
                box12BasisReportedToIrs: true,
                box13Bartering: '15.00',
                stateLocal: [
                    { state: 'CA', stateIdNumber: '123-4567', stateTaxWithheld: '100.00' },
                    { state: 'CA', stateIdNumber: '123-4567', stateTaxWithheld: '10.00' },
                ],
                payerName: 'Some Brokerage',
                recipientName: 'Some Person',
            })
            assert(t === 'ok', ['expected ok', t, v])
            assertEq(v.stateLocal?.length, 2)
        },
        // DOC-11: every box omitted is valid, and reads back absent rather
        // than as a zero amount or a false flag.
        blankBoxesOmittedValidates: () => {
            const [t, v] = validate(minimal)
            assert(t === 'ok', ['expected ok', t, v])
            assertEq(v.box1dProceeds, undefined)
            assertEq(v.box1eCostOrOtherBasis, undefined)
            assertEq(v.corrected, undefined)
            assertEq(v.stateLocal, undefined)
        },
        // DOC-12: `false` is not a member of `option(true)` for any of the
        // twelve checkbox fields — rejected structurally, never accepted as
        // "not checked".
        falseFlagsRejected: () => {
            assertEq(validate({ ...minimal, corrected: false })[0], 'error')
            assertEq(validate({ ...minimal, fatcaFilingRequirement: false })[0], 'error')
            assertEq(validate({ ...minimal, box2ShortTermGainOrLoss: false })[0], 'error')
            assertEq(validate({ ...minimal, box2LongTermGainOrLoss: false })[0], 'error')
            assertEq(validate({ ...minimal, box2Ordinary: false })[0], 'error')
            assertEq(validate({ ...minimal, box3CollectiblesProceeds: false })[0], 'error')
            assertEq(validate({ ...minimal, box3QofProceeds: false })[0], 'error')
            assertEq(validate({ ...minimal, box5NoncoveredSecurity: false })[0], 'error')
            assertEq(validate({ ...minimal, box6ReportedToIrsGrossProceeds: false })[0], 'error')
            assertEq(validate({ ...minimal, box6ReportedToIrsNetProceeds: false })[0], 'error')
            assertEq(validate({ ...minimal, box7LossNotAllowedBasedOnAmountIn1d: false })[0], 'error')
            assertEq(validate({ ...minimal, box12BasisReportedToIrs: false })[0], 'error')
        },
        wrongDialectRejected: () => {
            const [t, v] = validate({ ...minimal, dialect: 'vnd.fjs.1099div' })
            assertEq(t, 'error')
            if (t !== 'error') {
                throw ['expected error', t, v]
            }
            if (typeof v === 'string') {
                throw ['expected a structural ValidationError', v]
            }
            assertEq(v.path[0], 'dialect')
        },
    },
    checkReferences: {
        emptyFormRevisionRejected: () => {
            assertEq(validate({ ...minimal, formRevision: '' })[0], 'error')
        },
        // DOC-13: a hash-shaped string containing '-' is not valid cBase32
        // (verified live: 'not-a-hash' fails isHash).
        sourceArtifactHashRejectedWhenNotAHash: () => {
            const [t, v] = validate({ ...minimal, sourceArtifactHash: 'not-a-hash' })
            assertEq(t, 'error', ['expected a non-cBase32 sourceArtifactHash to be refused', t, v])
        },
        // Omitting sourceArtifactHash entirely fails STRUCTURAL validation
        // (it is a required `string`, never `option`) — assert the error is
        // a ValidationError naming the field, not a semantic string,
        // distinguishing "missing" from "present but malformed" above.
        sourceArtifactHashRequired: () => {
            const { sourceArtifactHash, ...withoutHash } = minimal
            const [t, v] = validate(withoutHash)
            assertEq(t, 'error')
            if (t !== 'error') {
                throw ['expected error', t, v]
            }
            if (typeof v === 'string') {
                throw ['expected a structural ValidationError, not a semantic string', v]
            }
            assert(
                v.path.includes('sourceArtifactHash'),
                ['expected the ValidationError to name sourceArtifactHash', v],
            )
        },
        // Every money box named in `moneyBoxFields` and
        // `stateLocalMoneyFields` is proven to actually be walked by the
        // exactness loops, not merely assumed because `box1dProceeds`
        // happens to be covered above.
        moneyBoxExactness: {
            ...generatedScalarMoneyBoxExactnessProof,
            everyMoneyBoxIsCovered: () => {
                assertEq(
                    moneyBoxFields.length,
                    expectedMoneyBoxFieldCount,
                    [
                        'expected exactly the independently-stated money box count',
                        moneyBoxFields.length,
                        expectedMoneyBoxFieldCount,
                    ],
                )
            },
        },
        stateLocalMoneyExactness: {
            ...generatedStateLocalMoneyExactnessProof,
            everyFieldIsCovered: () => {
                assertEq(
                    stateLocalMoneyFields.length,
                    expectedStateLocalMoneyFieldCount,
                    [
                        'expected exactly the independently-stated stateLocal money field count',
                        stateLocalMoneyFields.length,
                        expectedStateLocalMoneyFieldCount,
                    ],
                )
            },
        },
        // Boxes 8-11 are profit-OR-loss boxes, unlike every scalar money box
        // modeled in this codebase before now — a negative decimal string
        // must validate ok, not be refused as though it were an unsigned
        // amount.
        negativeProfitOrLossBoxesAccepted: () => {
            const [t, v] = validate({
                ...minimal,
                box8ProfitOrLossRealized: '-500.00',
                box9UnrealizedProfitOrLossPriorYearEnd: '-1200.00',
                box10UnrealizedProfitOrLossCurrentYearEnd: '-1200.00',
                box11AggregateProfitOrLoss: '-500.00',
            })
            assert(t === 'ok', ['expected ok — boxes 8-11 must accept a negative amount', t, v])
        },
        // Anti-pattern guard (12-RESEARCH.md): free-text fields that are not
        // money must never be routed through moneyFieldError. A wildly
        // non-numeric string in each still validates ok, proving each is
        // genuinely exempt, not merely untested — mirroring `1099r`'s and
        // `1099div`'s percentage/country-name exemption leaves.
        nonMoneyFreeTextFieldsAcceptAnyStringWithoutExactnessCheck: () => {
            const [t, v] = validate({
                ...minimal,
                box1aDescriptionOfProperty: 'not a number at all: 1,234.567 (would fail the money-exactness check)',
                box1bDateAcquired: 'various',
                applicableCheckboxOnForm8949: 'not a single letter either',
            })
            assert(t === 'ok', ['expected ok — these fields are free text, not exact-decimal checked', t, v])
        },
    },
    // DOC-07's actual test: a proof exhibiting the CONSEQUENCE of conflating
    // "basis absent" with "basis reported as zero," not merely that box 1e
    // can be omitted. See module docstring, "Box 1e / box 12 — the DOC-07
    // distinction this dialect exists to carry".
    criterion2GainConsequence: () => {
        const [tWithBasis, withBasis] = validate({
            ...minimal,
            box1dProceeds: '10000.00',
            box1eCostOrOtherBasis: '6000.00',
        })
        assert(tWithBasis === 'ok', ['expected ok', tWithBasis, withBasis])

        const [tWithoutBasis, withoutBasis] = validate({
            ...minimal,
            box1dProceeds: '10000.00',
            // box1eCostOrOtherBasis genuinely OMITTED — not '0.00'.
        })
        assert(tWithoutBasis === 'ok', ['expected ok', tWithoutBasis, withoutBasis])

        // The dialect genuinely models absence, not a sentinel string.
        assertEq(
            withoutBasis.box1eCostOrOtherBasis,
            undefined,
            ['expected a genuinely omitted box 1e to read back as undefined, not a zero string'],
        )

        const withBasisGain = naiveGain('10000.00')(withBasis.box1eCostOrOtherBasis)
        const withoutBasisGain = naiveGain('10000.00')(withoutBasis.box1eCostOrOtherBasis)

        assertEq(withBasisGain, 400000n, ['expected the with-basis naive gain to be $4,000.00 in cents'])
        assertEq(withoutBasisGain, 1000000n, ['expected the without-basis naive gain to be $10,000.00 in cents'])

        // THIS inequality is the "changes the gain" consequence DOC-07
        // requires: the identical naive formula applied to a
        // present-vs-absent box 1e yields two different dollar figures, so
        // silently conflating "absent" with "reported as zero" would
        // silently change what a return reports.
        assert(
            withBasisGain !== withoutBasisGain,
            [
                'expected treating a genuinely absent box 1e as zero to CHANGE the naive gain',
                withBasisGain,
                withoutBasisGain,
            ],
        )
    },
    stateLocal: {
        // "Faithfully" has to mean this: several rows, including two for
        // the SAME state, round-tripping in order with nothing merged or
        // summed.
        multipleRowsIncludingRepeatedStateRoundTrip: () => {
            const rows = [
                { state: 'CA', stateTaxWithheld: '100.00' },
                { state: 'CA', stateTaxWithheld: '10.00' },
                { state: 'NY', stateIdNumber: 'NY-99', stateTaxWithheld: '5.00' },
            ]
            const [t, v] = validate({ ...minimal, stateLocal: rows })
            assert(t === 'ok', ['expected ok', t, v])
            assertEq(v.stateLocal?.length, 3)
            assertEq(v.stateLocal?.[0]?.stateTaxWithheld, '100.00')
            assertEq(v.stateLocal?.[1]?.stateTaxWithheld, '10.00')
            assertEq(v.stateLocal?.[2]?.stateIdNumber, 'NY-99')
            // The two CA rows stay two rows. Nothing here adds them up.
            assertEq(v.stateLocal?.[0]?.state, v.stateLocal?.[1]?.state)
        },
        inexactAmountRejected: () => {
            const [t] = validate({ ...minimal, stateLocal: [{ state: 'CA', stateTaxWithheld: '1,000.00' }] })
            assertEq(t, 'error')
        },
    },
}
