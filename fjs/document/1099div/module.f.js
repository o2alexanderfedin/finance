/**
 * `vnd.fjs.1099div` — DOC-06: Form 1099-DIV, Dividends and Distributions.
 *
 * Source, fetched and read directly (12-RESEARCH.md Q1), not from recall:
 * `https://www.irs.gov/pub/irs-pdf/f1099div.pdf` — **Rev. January 2024**,
 * printed "Form 1099-DIV (Rev. 1-2024)". Cross-checked via the IRS
 * instructions page (i1099div): "Form 1099-DIV and these instructions have
 * been converted from an annual revision to continuous use" — unlike
 * 1099-R and 1099-B, this form is **not** revised every year, and January
 * 2024 is confirmed current for TY2025 use. No revision-drift risk for
 * this dialect.
 *
 * Follows the `fjs/media/revision` four-stage template exactly as
 * `fjs/document/1099r/module.f.js` (the closest, most recent analog) does:
 * dialect -> mediaType -> schema -> structural validate -> semantic
 * `checkReferences` -> composed `validate`.
 *
 * **`sourceArtifactHash` is a NEW field this phase introduces (DOC-13).**
 * It is declared as plain `string` — REQUIRED, never `option` — because
 * every real document is extracted from some artifact and there is no
 * legacy stored `vnd.fjs.1099div` instance to stay backward-compatible
 * with (this is a brand-new dialect, 12-RESEARCH.md Assumption A3).
 * Validated via `isHash` in `checkReferences`. The shared `base()` helper
 * is deliberately NOT widened for this: `base()`'s own docstring
 * anticipates exactly this question ("if a later dialect needs to widen
 * this base, that is the signal worth revisiting"), and widening it now
 * would force this field onto every already-shipped dialect (1099-INT,
 * W-2, 1099-R, SSA-1099, medical expenses, return profile) — a much
 * larger blast radius than DOC-13 needs (12-RESEARCH.md's "Alternatives
 * Considered").
 *
 * Field-shape notes:
 * - **No locality boxes exist on 1099-DIV** — unlike `1099r`'s fuller
 *   `stateLocalEntry` (which carries `localTaxWithheld`/`localityName`/
 *   `localDistribution`), this form's repeating group (boxes 14-16) is
 *   state-only: `state`, `stateIdNumber`, `stateTaxWithheld`. This is a
 *   real difference between the two printed forms, not an omission.
 * - **Box 8 (Foreign country or U.S. possession) is free text (a country
 *   name), not money** — it is deliberately EXCLUDED from `moneyFieldError`
 *   and from `moneyBoxFields`. Its own instruction: "This box should be
 *   left blank if a RIC reported the foreign tax shown in box 7" — boxes
 *   7 and 8 are mutually informative but neither derives the other; store
 *   both as printed, compute nothing.
 * - Boxes 2b/2c/2d (Unrecap. Sec. 1250 gain / Section 1202 gain /
 *   Collectibles (28%) gain) and box 2a (Total capital gain distr.) are
 *   stored verbatim like every other money box. This phase does not
 *   compute anything from them — they force the Schedule D Tax Worksheet
 *   or QDCGT's level-2d path, both Phase 12.1's job.
 * - Every checkbox is `option(true)` — DOC-12 — for `corrected` and
 *   `box11FatcaFilingRequirement`. The printed "2nd TIN not." checkbox
 *   and VOID are filer-only and NOT modeled — same precedent as `1099r`
 *   and every existing dialect.
 *
 * ## DOC-06's shape proof, and the scope line this module does not cross
 *
 * `proof.qdcgtInputShape` proves box 1b's converted cents value has
 * EXACTLY the type `QdcgtInput['line2Cents']` (from the already-shipped
 * `fjs/tax/line16/qdcgt/module.f.js`, Phase 10) expects — a `tsc`-enforced
 * compile-time assertion via a JSDoc `@import` type-only reference, which
 * compiles to nothing at runtime, plus a runtime `assertEq` on the
 * converted numeric value. This file imports NOTHING at runtime from
 * `fjs/tax/`, `fjs/return/`, or `fjs/form1040/` — no worksheet-selection
 * function, no scope-classification function, no income-line aggregator.
 * Wiring
 * `qualifiedDividends`/`ordinaryDividends` into the return-scope guard and
 * Form 1040 lines 3a/3b is Phase 12.1's job, done atomically with the
 * reclassification it requires (12-CONTEXT.md's AMENDED 2026-08-07
 * section) — reclassifying without wiring would make a return report a
 * confident zero for real dividend income instead of refusing, which is
 * strictly worse than today's refusal and the exact failure TAX-16's
 * scope guard exists to prevent. (The four-way line-16 dispatcher and the
 * scope-classification function are named in 12-CONTEXT.md/12-RESEARCH.md,
 * deliberately not repeated here by name, so this file's own text cannot
 * be mistaken for evidence of a runtime import.)
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
/** @import { QdcgtInput } from '../../tax/line16/qdcgt/module.f.js' */

/**
 * Format tag: names the dialect of this BLOB. The media type it is served
 * with is derived mechanically: `application/` + `dialect` + `+json`.
 */
export const dialect = 'vnd.fjs.1099div'
/** The media type derived from {@link dialect}: `application/vnd.fjs.1099div+json`. */
export const mediaType = mediaTypeOf(dialect)

/**
 * One boxes-14-through-16 row: state, state ID number, state tax withheld.
 * 1099-DIV has NO locality boxes (unlike `1099r`'s fuller `stateLocalEntry`)
 * — this is a real difference between the two printed forms, not an
 * omission. Every field but `state` is absent-able, because the printed
 * form routinely leaves the rest blank (DOC-11).
 */
const stateEntry = /** @type {const} */ ({
    state: string,
    stateIdNumber: option(string),
    stateTaxWithheld: option(string),
})

/**
 * rtti schema for a `1099div` BLOB. `dialect` is spread first (via `base`)
 * so structural validation reports it as the first failing field on a
 * mismatched blob (DOC-00's discriminant).
 */
export const oneZeroNineNineDivSchema = /** @type {const} */ ({
    ...base(dialect),
    payerTin: string,
    recipientTin: string,
    accountNumber: string,
    taxYear: number,
    formRevision: string,
    corrected: option(true),
    sourceArtifactHash: string,
    box1aTotalOrdinaryDividends: option(string),
    box1bQualifiedDividends: option(string),
    box2aTotalCapitalGainDistr: option(string),
    box2bUnrecapSec1250Gain: option(string),
    box2cSection1202Gain: option(string),
    box2dCollectibles28PercentGain: option(string),
    box2eSection897OrdinaryDividends: option(string),
    box2fSection897CapitalGain: option(string),
    box3NondividendDistributions: option(string),
    box4FederalIncomeTaxWithheld: option(string),
    box5Section199ADividends: option(string),
    box6InvestmentExpenses: option(string),
    box7ForeignTaxPaid: option(string),
    box8ForeignCountryOrUsPossession: option(string),
    box9CashLiquidationDistributions: option(string),
    box10NoncashLiquidationDistributions: option(string),
    box11FatcaFilingRequirement: option(true),
    box12ExemptInterestDividends: option(string),
    box13SpecifiedPrivateActivityBondInterestDividends: option(string),
    stateLocal: option(array(stateEntry)),
    payerName: option(string),
    recipientName: option(string),
})

/** @typedef {Ts<typeof oneZeroNineNineDivSchema>} OneZeroNineNineDiv */

/** Structural-only validator: checks the shape, not the semantic refinements below. */
const validateShape = rttiValidate(oneZeroNineNineDivSchema)

/**
 * The scalar money boxes, walked in a loop so the exactness check is
 * written once. Typed via `@type {const}` (not a wider `keyof
 * OneZeroNineNineDiv`) so `r[field]` resolves to exactly `string |
 * undefined` — the same reason `vnd.fjs.1099int`/`vnd.fjs.1099r` do it
 * this way. `box8ForeignCountryOrUsPossession` is deliberately NOT here —
 * it is a country name, not money (see module docstring).
 */
const moneyBoxFields = /** @type {const} */ ([
    'box1aTotalOrdinaryDividends',
    'box1bQualifiedDividends',
    'box2aTotalCapitalGainDistr',
    'box2bUnrecapSec1250Gain',
    'box2cSection1202Gain',
    'box2dCollectibles28PercentGain',
    'box2eSection897OrdinaryDividends',
    'box2fSection897CapitalGain',
    'box3NondividendDistributions',
    'box4FederalIncomeTaxWithheld',
    'box5Section199ADividends',
    'box6InvestmentExpenses',
    'box7ForeignTaxPaid',
    'box9CashLiquidationDistributions',
    'box10NoncashLiquidationDistributions',
    'box12ExemptInterestDividends',
    'box13SpecifiedPrivateActivityBondInterestDividends',
])

/**
 * Independently hand-typed: the number of scalar money boxes
 * {@link moneyBoxFields} is expected to name today. Deliberately NOT
 * derived from `moneyBoxFields.length` — see
 * {@link generatedScalarMoneyBoxExactnessProof}. Mutation Gate M1 (12-01
 * plan Task 2) proves this constant is load-bearing: removing an entry
 * from `moneyBoxFields` while leaving this constant unchanged turns
 * `everyMoneyBoxIsCovered` RED.
 * @type {number}
 */
const expectedMoneyBoxFieldCount = 17

/**
 * The one money-carrying field of one boxes-14-through-16 row (`state` and
 * `stateIdNumber` are identity/label fields, not amounts, so they are
 * excluded). Named once, at module scope, so `checkReferences`' own loop
 * below and this module's generated exactness proof (further down) walk
 * the identical list rather than the check and its test being free to
 * drift apart (AGENTS.md, "one rule, one place"). A one-element
 * generated+hand-typed pair is still the correct shape — the list being
 * short is not a reason to skip the hand-typed count.
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
 * @typedef {ValidationError | string} OneZeroNineNineDivError
 */

/**
 * Checks the semantic refinements the structural schema cannot express:
 * `formRevision` is non-empty (DOC-10), `sourceArtifactHash` decodes as a
 * real cBase32 hash (DOC-13), every PRESENT scalar money box is an exact
 * decimal within safe magnitude, and every PRESENT `stateLocal` row's
 * money field is too. Absent boxes are skipped, never defaulted (DOC-11).
 * @type {(r: OneZeroNineNineDiv) => Result<OneZeroNineNineDiv, OneZeroNineNineDivError>}
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
 * Validates an already-parsed JSON value as a `1099div` BLOB: structural
 * (rtti) validation followed by the semantic checks in
 * {@link checkReferences}. Dialect discrimination happens exclusively
 * through the schema's exact-literal `dialect` constant — the serialized
 * JSON text is never inspected.
 * @type {(value: Unknown) => Result<OneZeroNineNineDiv, OneZeroNineNineDivError>}
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
 * The literal `sourceArtifactHash` reused throughout this file's fixtures
 * — the SAME literal 12-02 and 12-05's DOC-13 proof reuse, so a
 * shared-provenance comparison across dialects is a plain `===` on
 * identical literals, not a coincidence to explain.
 * @type {string}
 */
const sharedSourceArtifactHash = 'deadbeef00112233445566778899aabbccddeeff0011223344556677889900'

/** @type {OneZeroNineNineDiv} */
const minimal = {
    dialect,
    payerTin: '11-1111111',
    recipientTin: '222-22-2222',
    accountNumber: 'ACC-0001',
    taxYear: 2025,
    formRevision: '2024',
    sourceArtifactHash: sharedSourceArtifactHash,
}

/**
 * T-12-01-01: a money box's name could be quietly dropped from
 * {@link moneyBoxFields} without anyone noticing — the field stays
 * `option(string)` structurally, so a comma-grouped amount in a dropped box
 * would then validate as ok. One generated leaf per NAMED scalar box
 * supplies a comma-grouped value to that box alone and asserts `validate`
 * refuses, built by mapping {@link moneyBoxFields} itself into `[field,
 * assertion]` pairs (never as seventeen hand-written near-identical
 * leaves) — the same idiom `fjs/document/1099r/module.f.js`'s generated
 * leaves use — so a box added to the list later is covered automatically.
 *
 * A box's own generated leaf disappears WITH it if the box is dropped from
 * the list, so this alone cannot catch a removal — {@link
 * expectedMoneyBoxFieldCount} above pairs it with an independently
 * hand-typed count (Mutation Gate M1 proves this pairing is load-bearing).
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

export const proof = {
    dialectAndMediaType: () => {
        assertEq(dialect, 'vnd.fjs.1099div')
        assertEq(mediaType, 'application/vnd.fjs.1099div+json')
    },
    validate: {
        fullyPopulatedValidates: () => {
            const [t, v] = validate({
                ...minimal,
                corrected: true,
                box1aTotalOrdinaryDividends: '1000.00',
                box1bQualifiedDividends: '500.00',
                box2aTotalCapitalGainDistr: '200.00',
                box2bUnrecapSec1250Gain: '10.00',
                box2cSection1202Gain: '20.00',
                box2dCollectibles28PercentGain: '30.00',
                box2eSection897OrdinaryDividends: '5.00',
                box2fSection897CapitalGain: '6.00',
                box3NondividendDistributions: '15.00',
                box4FederalIncomeTaxWithheld: '50.00',
                box5Section199ADividends: '25.00',
                box6InvestmentExpenses: '8.00',
                box7ForeignTaxPaid: '12.00',
                box8ForeignCountryOrUsPossession: 'Canada',
                box9CashLiquidationDistributions: '40.00',
                box10NoncashLiquidationDistributions: '45.00',
                box11FatcaFilingRequirement: true,
                box12ExemptInterestDividends: '18.00',
                box13SpecifiedPrivateActivityBondInterestDividends: '3.00',
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
            assertEq(v.box1aTotalOrdinaryDividends, undefined)
            assertEq(v.box1bQualifiedDividends, undefined)
            assertEq(v.corrected, undefined)
            assertEq(v.stateLocal, undefined)
        },
        // DOC-12: `false` is not a member of `option(true)` for either
        // checkbox field — rejected structurally, never accepted as "not
        // checked".
        falseFlagsRejected: () => {
            assertEq(validate({ ...minimal, corrected: false })[0], 'error')
            assertEq(validate({ ...minimal, box11FatcaFilingRequirement: false })[0], 'error')
        },
        wrongDialectRejected: () => {
            const [t, v] = validate({ ...minimal, dialect: 'vnd.fjs.1099r' })
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
        // (verified live: 'consolidated-artifact-hash-01' fails isHash).
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
        // T-12-01-01: every money box named in `moneyBoxFields` and
        // `stateLocalMoneyFields` is proven to actually be walked by the
        // exactness loops, not merely assumed because
        // `box1aTotalOrdinaryDividends` happens to be covered above.
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
        // Anti-pattern guard (12-RESEARCH.md): box 8 is a country name, not
        // money, and must never be routed through moneyFieldError. A wildly
        // non-numeric string in box 8 still validates ok, proving it is
        // genuinely exempt, not merely untested — mirroring `1099r`'s
        // percentage-box exemption leaf.
        box8AcceptsNonNumericTextWithoutExactnessCheck: () => {
            const [t, v] = validate({
                ...minimal,
                box8ForeignCountryOrUsPossession: 'not a number at all: 1,234.567 (would fail the money-exactness check)',
            })
            assert(t === 'ok', ['expected ok — box 8 is free text, not exact-decimal checked', t, v])
        },
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
    // DOC-06's shape proof: box 1b's converted value has exactly the type
    // and numeric shape QdcgtInput.line2Cents expects — zero runtime
    // coupling to fjs/tax/, fjs/return/, or fjs/form1040/. See module
    // docstring, "DOC-06's shape proof, and the scope line this module
    // does not cross".
    qdcgtInputShape: () => {
        const [t, v] = validate({ ...minimal, box1bQualifiedDividends: '500.00' })
        assert(t === 'ok', ['expected ok', t, v])
        /** @type {QdcgtInput['line2Cents']} */
        const line2Cents = centsFromString(v.box1bQualifiedDividends ?? '0.00')
        assertEq(line2Cents, 50000n)
    },
}
