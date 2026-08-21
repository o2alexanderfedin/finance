/**
 * `vnd.fjs.ssa1099` — DOC-08: Form SSA-1099, Social Security Benefit
 * Statement.
 *
 * **This is NOT an IRS form** — it is issued by the Social Security
 * Administration. There is no blank form at `irs.gov/pub/irs-pdf/` the way
 * there is for 1099-R. Source: IRS Publication 915 (2025), *"Social
 * Security and Equivalent Railroad Retirement Benefits,"* Appendix, pages
 * 20-22, `https://www.irs.gov/pub/irs-pdf/p915.pdf`, fetched and read
 * directly 2026-08-07 (11-RESEARCH.md Q2). The publication itself labels
 * its illustration a SAMPLE, not a guaranteed-current blank form: *"Caution:
 * The illustrated versions of Form SSA-1099... in this appendix are proof
 * copies of the forms as they appeared when this publication went to
 * print... You should, however, compare the form you received with the one
 * shown here to note any differences."* The box labels below are as
 * reliable as an IRS-published illustration gets, but a future reader
 * should check the source rather than trust this docstring — that is the
 * whole point of recording the URL.
 *
 * Deliberate deviations from the family's usual field conventions, each
 * with its own rationale:
 * - **`payerTin` is ALWAYS stored as `''`.** SSA-1099 prints no payer TIN
 *   anywhere — the "payer" is universally the Social Security
 *   Administration, and Pub 915's sample shows no TIN box for it at all.
 *   This is a deliberate deviation, not an oversight: do not invent a fake
 *   SSA EIN to fill this field, which would misrepresent what is actually
 *   printed on the form. Mirrors this project's already-established
 *   `accountNumber: string` (always-present, may-be-empty) convention.
 * - **`accountNumber` maps to Box 8, the Claim Number.** Pub 915 directs
 *   using this number for any SSA correspondence ("be sure to use the claim
 *   number shown in box 8"), making it functionally this form's per-account
 *   identifier — the natural fit for the subject-key convention's
 *   `accountNumber` slot.
 * - **Box 7 (Address) is NOT modeled**, mirroring the W-2 box 9/14 omission
 *   precedent: it is PII with no computational use.
 * - **`corrected: option(true)` is kept for structural consistency with
 *   every other dialect, but with LOW confidence it is ever populated.**
 *   The Pub 915 Appendix sample shows no CORRECTED box (unlike RRB-1099,
 *   which Pub 915 explicitly says the RRB marks "CORRECTED" and replaces) —
 *   verified by reading the sample directly, not assumed.
 *
 * Follows the `fjs/media/revision` four-stage template exactly as
 * `fjs/document/1099int/module.f.js` does: dialect -> mediaType -> schema ->
 * structural validate -> semantic `checkReferences` -> composed `validate`.
 *
 * @module
 */
import { number, option, string } from 'functionalscript/fjs/types/rtti/module.f.mjs'
import { validate as rttiValidate } from 'functionalscript/fjs/types/rtti/validate/module.f.mjs'
import { error, ok } from 'functionalscript/fjs/types/result/module.f.mjs'
import { assert, assertEq } from 'functionalscript/fjs/asserts/module.f.mjs'
import { base, mediaTypeOf } from '../base/module.f.js'
import { formRevisionError } from '../form_revision/module.f.js'
import { moneyFieldError } from '../money_field/module.f.js'

/** @import { Result } from 'functionalscript/fjs/types/result/types.js' */
/** @import { Ts, Unknown } from 'functionalscript/fjs/types/rtti/ts/types.js' */
/** @import { ValidationError } from 'functionalscript/fjs/types/rtti/common/types.js' */
/** @import { SubjectKey } from '../subject/module.f.js' */

/**
 * Format tag: names the dialect of this BLOB. The media type it is served
 * with is derived mechanically: `application/` + `dialect` + `+json`.
 */
export const dialect = 'vnd.fjs.ssa1099'
/** The media type derived from {@link dialect}: `application/vnd.fjs.ssa1099+json`. */
export const mediaType = mediaTypeOf(dialect)

/**
 * rtti schema for an `ssa1099` BLOB. `dialect` is spread first (via `base`)
 * so structural validation reports it as the first failing field on a
 * mismatched blob (DOC-00's discriminant).
 */
export const ssa1099Schema = /** @type {const} */ ({
    ...base(dialect),
    payerTin: string,
    recipientTin: string,
    accountNumber: string,
    taxYear: number,
    formRevision: string,
    corrected: option(true),
    box3BenefitsPaid: option(string),
    box3Description: option(string),
    box4BenefitsRepaid: option(string),
    box4Description: option(string),
    box5NetBenefits: option(string),
    box6VoluntaryFederalIncomeTaxWithheld: option(string),
    recipientName: option(string),
})

/**
 * FORM-KEY-01 -- which of THIS dialect's OWN fields play the five roles a
 * form subject is keyed on. See `fjs/document/subject`'s {@link SubjectKey}
 * for why the dialect declares this instead of every caller assuming one
 * shared set of field names.
 * @type {SubjectKey}
 */
export const subjectKey = { formType: 'dialect', taxYear: 'taxYear', payer: 'payerTin', recipient: 'recipientTin', account: 'accountNumber' }

/** @typedef {Ts<typeof ssa1099Schema>} Ssa1099 */

/** Structural-only validator: checks the shape, not the semantic refinements below. */
const validateShape = rttiValidate(ssa1099Schema)

/**
 * The money boxes, walked in a loop so the exactness check is written once.
 * Typed via `@type {const}` (not a wider `keyof Ssa1099`) so `r[field]`
 * resolves to exactly `string | undefined` — the same reason
 * `vnd.fjs.1099int`/`vnd.fjs.w2` do it this way. `box3Description` and
 * `box4Description` are deliberately NOT here — they are free text, never
 * parsed or computed on.
 */
export const moneyBoxFields = /** @type {const} */ ([
    'box3BenefitsPaid',
    'box4BenefitsRepaid',
    'box5NetBenefits',
    'box6VoluntaryFederalIncomeTaxWithheld',
])

/**
 * Either a structural validation error or a semantic (string) error message.
 * @typedef {ValidationError | string} Ssa1099Error
 */

/**
 * Checks the semantic refinements the structural schema cannot express:
 * `payerTin` must be the empty string (the module docstring's "ALWAYS
 * stored as `''`" deviation — SSA-1099 prints no payer TIN), `formRevision`
 * is non-empty (DOC-10), and every PRESENT money box is an exact decimal
 * within safe magnitude. Absent boxes are skipped, never defaulted
 * (DOC-11). `box3Description`/`box4Description`/`recipientName` are plain
 * optional strings, never validated beyond structural `option(string)` —
 * they are never computed on.
 * @type {(r: Ssa1099) => Result<Ssa1099, Ssa1099Error>}
 */
export const checkReferences = r => {
    if (r.payerTin !== '') {
        return error(`payerTin must be the empty string for vnd.fjs.ssa1099 (SSA-1099 prints no payer TIN)`)
    }
    const formRevisionMessage = formRevisionError(r.formRevision)
    if (formRevisionMessage !== undefined) {
        return error(formRevisionMessage)
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
    return ok(r)
}

/**
 * Validates an already-parsed JSON value as an `ssa1099` BLOB: structural
 * (rtti) validation followed by the semantic checks in
 * {@link checkReferences}. Dialect discrimination happens exclusively
 * through the schema's exact-literal `dialect` constant — the serialized
 * JSON text is never inspected.
 * @type {(value: Unknown) => Result<Ssa1099, Ssa1099Error>}
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
 * `payerTin: ''` is the deliberate deviation this dialect always stores —
 * SSA-1099 prints no payer TIN. Pinned in the fixture itself, not merely
 * asserted, so `proof.validate.payerTinEmptyStringRoundTrips` proves the
 * convention rather than merely restating it.
 * @type {Ssa1099}
 */
const minimal = {
    dialect,
    payerTin: '',
    recipientTin: '222-22-2222',
    accountNumber: 'CLAIM-0001',
    taxYear: 2025,
    formRevision: '2025',
}

/**
 * T-11-01-01: a money box's name could be quietly dropped from
 * {@link moneyBoxFields} without anyone noticing — the field stays
 * `option(string)` structurally, so a comma-grouped amount in a dropped box
 * would then validate as ok. One generated leaf per NAMED box supplies a
 * comma-grouped value to that box alone and asserts `validate` refuses,
 * built by mapping {@link moneyBoxFields} itself into `[field, assertion]`
 * pairs (never as four hand-written near-identical leaves) — the same idiom
 * `fjs/document/w2/module.f.js`'s generated leaves use — so a box added to
 * the list later is covered automatically.
 *
 * A box's own generated leaf disappears WITH it if the box is dropped from
 * the list, so this alone cannot catch a removal — {@link
 * expectedMoneyBoxFieldCount} below pairs it with an independently
 * hand-typed count. The duplication is the mechanism (AGENTS.md: "a proof's
 * expected value must not be produced by the code under test").
 * @type {{ readonly [field: string]: () => void }}
 */
const generatedMoneyBoxExactnessProof = Object.fromEntries(
    moneyBoxFields.map(field => [
        field,
        () => {
            const [t, v] = validate({ ...minimal, [field]: '1,234.56' })
            assertEq(t, 'error', ['expected a comma-grouped amount in this box to be refused', field, t, v])
        },
    ]),
)

/**
 * Independently hand-typed: the number of money boxes {@link moneyBoxFields}
 * is expected to name today. Deliberately NOT derived from
 * `moneyBoxFields.length` — see {@link generatedMoneyBoxExactnessProof}.
 * @type {number}
 */
const expectedMoneyBoxFieldCount = 4

export const proof = {
    dialectAndMediaType: () => {
        assertEq(dialect, 'vnd.fjs.ssa1099')
        assertEq(mediaType, 'application/vnd.fjs.ssa1099+json')
    },
    validate: {
        fullyPopulatedValidates: () => {
            const [t, v] = validate({
                ...minimal,
                corrected: true,
                box3BenefitsPaid: '12000.00',
                box3Description: 'Paid by check',
                box4BenefitsRepaid: '500.00',
                box4Description: 'Overpayment adjustment',
                box5NetBenefits: '11500.00',
                box6VoluntaryFederalIncomeTaxWithheld: '1150.00',
                recipientName: 'Some Person',
            })
            assert(t === 'ok', ['expected ok', t, v])
        },
        // DOC-11: every box omitted is valid, and reads back absent rather
        // than as a zero amount or a false flag.
        blankBoxesOmittedValidates: () => {
            const [t, v] = validate(minimal)
            assert(t === 'ok', ['expected ok', t, v])
            assertEq(v.box3BenefitsPaid, undefined)
            assertEq(v.corrected, undefined)
        },
        // DOC-12: `false` is not a member of `option(true)` — rejected
        // structurally, never accepted as "not corrected".
        correctedFalseRejected: () => {
            const [t] = validate({ ...minimal, corrected: false })
            assertEq(t, 'error')
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
        // Pins the deliberate deviation as a proof, not merely a docstring
        // claim: `payerTin: ''` validates ok and reads back `''` verbatim.
        payerTinEmptyStringRoundTrips: () => {
            const [t, v] = validate(minimal)
            assert(t === 'ok', ['expected ok', t, v])
            assertEq(v.payerTin, '')
        },
    },
    checkReferences: {
        emptyFormRevisionRejected: () => {
            assertEq(validate({ ...minimal, formRevision: '' })[0], 'error')
        },
        // The control to payerTinEmptyStringRoundTrips above (AGENTS.md "a
        // gate needs a control"): the module docstring's "payerTin is
        // ALWAYS ''" invariant is refused, not merely accepted, when
        // violated -- e.g. by a future from_ocr converter writing a
        // real-looking TIN into this field.
        nonEmptyPayerTinRejected: () => {
            const [t, v] = validate({ ...minimal, payerTin: '99-9999999' })
            assertEq(t, 'error', ['expected a non-empty payerTin to be refused', t, v])
        },
        // T-11-01-01: every money box named in `moneyBoxFields` is proven to
        // actually be walked by the exactness loop, not merely assumed
        // because `box3BenefitsPaid` happens to be covered above.
        moneyBoxExactness: {
            ...generatedMoneyBoxExactnessProof,
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
        // Proves "never parsed" (the description fields carry arbitrary
        // punctuation verbatim), not merely "accepted".
        descriptionFieldsStoreVerbatim: () => {
            const text3 = 'Medicare Part B premiums: $174.70/mo; adj. (see note) — 2025'
            const text4 = 'Workers\' comp offset, 12/2024-01/2025 (retro)'
            const [t, v] = validate({ ...minimal, box3Description: text3, box4Description: text4 })
            assert(t === 'ok', ['expected ok', t, v])
            assertEq(v.box3Description, text3)
            assertEq(v.box4Description, text4)
        },
    },
}
