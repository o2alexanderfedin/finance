/**
 * `vnd.fjs.1099int` — the 1099-INT form schema (DOC-04's schema half; the
 * OCR-string -> canonical-decimal-string conversion itself is Plan 05-03's
 * job, not this file's).
 *
 * Follows the `fjs/media/revision` four-stage template: dialect -> mediaType
 * -> schema -> structural validate -> semantic `checkReferences` -> composed
 * `validate`.
 *
 * Field groups:
 * - Identity/subject-key fields (`payerTin`, `recipientTin`, `accountNumber`,
 *   `taxYear`) are REQUIRED — DOC-01 roots a form subject on these four plus
 *   `formType`, so a typed instance without them is not meaningfully
 *   addressable. `accountNumber` may be an empty string (a form with no
 *   printed account number) but the key itself is always present.
 * - `formRevision` is REQUIRED — DOC-10: box semantics drift between
 *   revisions of the same printed form, so the revision (never derived from
 *   `taxYear`) travels with every stored instance. Non-empty is a semantic
 *   check (`checkReferences`), not expressible structurally.
 * - `corrected` is `option(true)` — DOC-12, mirrors `fjs/media/revision`'s
 *   `archived: option(true)` exactly: present-and-`true` means the printed
 *   CORRECTED box was checked; the key absent means it was not. `false` is
 *   never a valid member of this schema — a `corrected: false` blob is
 *   rejected structurally, before `checkReferences` ever runs.
 * - Money boxes are each `option(string)` — DOC-11: blank is not zero, so a
 *   box the form left empty is modeled by the key's absence, never by a `"0"`
 *   or `0` value standing in for "not printed". Present values are the
 *   post-conversion canonical decimal strings this schema itself owns (never
 *   comma-grouped OCR strings — that conversion happens once, upstream, on
 *   Plan 05-03's revision boundary); `checkReferences` re-parses every
 *   present box through `fjs/exact`'s exact decimal parser to enforce this.
 * - `payerName`/`recipientName` are optional identity labels — DOC-01: human
 *   labels live inside snapshots, never inside subjects, so they live on this
 *   schema, never in `fjs/document/subject`.
 *
 * Not modeling all seventeen 1099-INT boxes is a deliberate MVP scope
 * choice (YAGNI): DOC-00's base/spread design means adding more boxes later
 * is a non-breaking, localized change to this one file, not a reopening of
 * the shared base.
 *
 * @module
 */
import { number, option, string } from 'functionalscript/fjs/types/rtti/module.f.js'
import { validate as rttiValidate } from 'functionalscript/fjs/types/rtti/validate/module.f.js'
import { error, ok } from 'functionalscript/fjs/types/result/module.f.js'
import { assert, assertEq } from 'functionalscript/fjs/asserts/module.f.js'
import { base } from '../base/module.f.js'
import { moneyFieldError } from '../money_field/module.f.js'
import { dialect as ocrDialect, ocrSchema, validate as ocrValidate } from '../ocr/module.f.js'

/**
 * Format tag: names the dialect of this BLOB. The media type it is served
 * with is derived mechanically: `application/` + `dialect` + `+json`.
 */
export const dialect = 'vnd.fjs.1099int'
/** The media type derived from {@link dialect}: `application/vnd.fjs.1099int+json`. */
export const mediaType = `application/${dialect}+json`

/**
 * rtti schema for a `1099int` BLOB. `dialect` is spread first (via `base`)
 * so structural validation reports it as the first failing field on a
 * mismatched blob (DOC-00's criterion-1 discriminant) — see Task 3's
 * cross-dialect proof.
 */
export const oneZeroNineNineIntSchema = /** @type {const} */ ({
    ...base(dialect),
    payerTin: string,
    recipientTin: string,
    accountNumber: string,
    taxYear: number,
    formRevision: string,
    corrected: option(true),
    box1InterestIncome: option(string),
    box2EarlyWithdrawalPenalty: option(string),
    box3UsSavingsBondsAndTreasuryInterest: option(string),
    box4FederalIncomeTaxWithheld: option(string),
    box6ForeignTaxPaid: option(string),
    box8TaxExemptInterest: option(string),
    payerName: option(string),
    recipientName: option(string),
})

/** @typedef {import('functionalscript/fjs/types/rtti/ts/module.f.js').Ts<typeof oneZeroNineNineIntSchema>} OneZeroNineNineInt */

/** Structural-only validator: checks the shape, not the semantic refinements below. */
const validateShape = rttiValidate(oneZeroNineNineIntSchema)

/**
 * The six money-box field names this MVP models, walked in a loop so the
 * `centsFromString` re-parse (DRY) is written once, not six times. Typed via
 * `@type {const}` (not a wider `keyof OneZeroNineNineInt` annotation) so
 * `r[field]` below resolves to exactly `string | undefined` — every listed
 * field is `option(string)` — rather than the union of every field's type.
 */
const moneyBoxFields = /** @type {const} */ ([
    'box1InterestIncome',
    'box2EarlyWithdrawalPenalty',
    'box3UsSavingsBondsAndTreasuryInterest',
    'box4FederalIncomeTaxWithheld',
    'box6ForeignTaxPaid',
    'box8TaxExemptInterest',
])

/** Either a structural validation error or a semantic (string) error message. */
/** @typedef {import('functionalscript/fjs/types/rtti/validate/module.f.js').ValidationError | string} OneZeroNineNineIntError */

/**
 * Checks the semantic refinements the structural schema can't express on an
 * already shape-valid `1099int` value:
 * - `formRevision` (DOC-10) must not be empty or whitespace-only.
 * - Every PRESENT money box (DOC-11 — absent boxes are skipped, never
 *   defaulted) must parse via `fjs/exact`'s `centsFromString` — a
 *   comma-grouped or otherwise non-canonical string is rejected here, not
 *   silently coerced (`centsFromString` throws via `assert`, so each call is
 *   wrapped in try/catch and the throw is converted to an `error(...)`,
 *   never left to escape `validate`). The resulting bigint magnitude must be
 *   within `Number.MAX_SAFE_INTEGER`, compared bigint-to-bigint — never
 *   converted through `Number()`, which would reintroduce the precision
 *   hazard `fjs/types/decimal`'s docstring warns about.
 * @type {(r: OneZeroNineNineInt) => import('functionalscript/fjs/types/result/module.f.js').Result<OneZeroNineNineInt, OneZeroNineNineIntError>}
 */
export const checkReferences = r => {
    if (r.formRevision.trim() === '') {
        return error(`formRevision must not be empty or whitespace-only`)
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
 * Validates an already-parsed JSON value as a `1099int` BLOB: structural
 * (rtti) validation followed by the semantic checks in {@link checkReferences}.
 *
 * Success Criterion 1 (structural-only rejection): dialect discrimination
 * here happens exclusively through `validateShape`'s exact-literal match on
 * `oneZeroNineNineIntSchema.dialect` — an ALREADY-PARSED value's `dialect`
 * field is compared as a schema constant, the same machinery that checks
 * every other field. Neither this function, `checkReferences`, nor any
 * other code in this file or `fjs/document/ocr/module.f.js` ever inspects
 * the serialized JSON text itself (no prefix/substring probe of any kind on
 * the raw `'{"dialect":...'` bytes) to decide a dialect — see
 * `proof.crossDialect` below for the runtime proof (Task 3), and this
 * module's `<verify>` grep gate for the static guarantee that no such
 * shortcut has been (re-)introduced.
 * @type {(value: import('functionalscript/fjs/types/rtti/ts/module.f.js').Unknown) => import('functionalscript/fjs/types/result/module.f.js').Result<OneZeroNineNineInt, OneZeroNineNineIntError>}
 */
export const validate = value => {
    const [t, v] = validateShape(value)
    if (t === 'error') {
        return error(v)
    }
    return checkReferences(v)
}

// ── Tests ────────────────────────────────────────────────────────────────────

/** @type {OneZeroNineNineInt} */
const minimal = {
    dialect,
    payerTin: '11-1111111',
    recipientTin: '222-22-2222',
    accountNumber: 'ACC-0001',
    taxYear: 2024,
    formRevision: '2024',
}

/**
 * T-09-08-02: a money box's name could be quietly dropped from
 * {@link moneyBoxFields} without anyone noticing — the field stays
 * `option(string)` structurally, so a comma-grouped or otherwise inexact
 * amount in a dropped box would then validate as ok. One generated leaf per
 * NAMED box supplies a comma-grouped value to that box alone and asserts
 * `validate` refuses, built by mapping {@link moneyBoxFields} itself into
 * `[field, assertion]` pairs (never as six hand-written near-identical
 * leaves) — the same idiom `fjs/tax/boundary`'s generated threshold leaves
 * use — so a box added to the list later is covered automatically.
 *
 * A box's own generated leaf disappears WITH it if the box is dropped from
 * the list, so this alone cannot catch a removal — {@link
 * expectedMoneyBoxFieldCount} below pairs it with an independently
 * hand-typed count, exactly as `fjs/tax/boundary`'s `expectedThresholdCount`
 * guards `allThresholds`. The duplication is the mechanism (AGENTS.md: "a
 * proof's expected value must not be produced by the code under test").
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
 * `moneyBoxFields.length` — if it were, dropping a box from the list would
 * shrink both sides together and this check could never fail.
 * @type {number}
 */
const expectedMoneyBoxFieldCount = 6

export const proof = {
    dialectAndMediaType: () => {
        assertEq(dialect, 'vnd.fjs.1099int')
        assertEq(mediaType, 'application/vnd.fjs.1099int+json')
    },
    validate: {
        fullyPopulatedValidates: () => {
            const [t] = validate({
                ...minimal,
                corrected: true,
                box1InterestIncome: '1234.56',
                box2EarlyWithdrawalPenalty: '0.00',
                box3UsSavingsBondsAndTreasuryInterest: '10.00',
                box4FederalIncomeTaxWithheld: '5.00',
                box6ForeignTaxPaid: '1.00',
                box8TaxExemptInterest: '2.00',
                payerName: 'Some Bank',
                recipientName: 'Some Person',
            })
            assertEq(t, 'ok')
        },
        // DOC-11: omitting every money box and `corrected` is structurally
        // valid — a blank box is absent, not zero.
        blankBoxesOmittedValidates: () => {
            const [t, v] = validate(minimal)
            assert(t === 'ok', ['expected ok', t, v])
            assertEq(v.box1InterestIncome, undefined)
            assertEq(v.corrected, undefined)
        },
        // DOC-12: `corrected: false` is not a valid member of `option(true)`
        // — rejected structurally, never accepted as "not corrected".
        correctedFalseRejected: () => {
            const [t] = validate({ ...minimal, corrected: false })
            assertEq(t, 'error')
        },
        // Wrong dialect: structural rejection, `dialect` first.
        wrongDialectRejected: () => {
            const [t, v] = validate({ ...minimal, dialect: 'vnd.fjs.wrong' })
            assertEq(t, 'error')
            if (t !== 'error') {
                throw ['expected error', t, v]
            }
            if (typeof v === 'string') {
                throw ['expected a structural ValidationError, got a checkReferences string', v]
            }
            assertEq(v.path[0], 'dialect')
        },
    },
    checkReferences: {
        emptyFormRevisionRejected: () => {
            const [t] = validate({ ...minimal, formRevision: '' })
            assertEq(t, 'error')
        },
        whitespaceFormRevisionRejected: () => {
            const [t] = validate({ ...minimal, formRevision: '   ' })
            assertEq(t, 'error')
        },
        // A money box string containing a comma is not this schema's
        // canonical form — Plan 05-03's job normalizes OCR strings before
        // they ever reach this schema.
        commaGroupedRejected: () => {
            const [t] = validate({ ...minimal, box1InterestIncome: '1,234.56' })
            assertEq(t, 'error')
        },
        canonicalMoneyBoxAccepted: () => {
            const [t] = validate({ ...minimal, box1InterestIncome: '1234.56' })
            assertEq(t, 'ok')
        },
        // T-09-08-02: every money box named in `moneyBoxFields` is proven to
        // actually be walked by the exactness loop, not merely assumed
        // because `box1InterestIncome` happens to be covered above.
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
    },
    // Task 3 — Success Criteria 1 and 2's runtime evidence.
    crossDialect: {
        // Success Criterion 1: a fully-valid `vnd.fjs.ocr` value, constructed
        // as a PARSED JS OBJECT (never a JSON string — proves rejection is
        // structural, not text/prefix-based), fails `1099int`'s `validate`,
        // and the failure's `path` is exactly `['dialect']` — the
        // discriminant catches it first, not some unrelated missing field.
        ocrShapeRejectedByOneZeroNineNineInt: () => {
            /** @type {import('functionalscript/fjs/types/rtti/ts/module.f.js').Ts<typeof ocrSchema>} */
            const ocrValue = {
                dialect: ocrDialect,
                pages: ['Form 1099-INT, Box 1 Interest income: 1,234.56'],
                fields: { 'Box 1 Interest income': '1,234.56' },
            }
            const [t, v] = validate(ocrValue)
            assertEq(t, 'error')
            if (t !== 'error') {
                throw ['expected error', t, v]
            }
            if (typeof v === 'string') {
                throw ['expected a structural ValidationError, got a checkReferences string', v]
            }
            assertEq(v.path.length, 1)
            assertEq(v.path[0], 'dialect')
        },
        // Reverse direction (bonus, not required by the roadmap): a valid
        // `1099int` value fails `ocr`'s `validate` the same way — free given
        // the same fixtures, strengthens the evidence that the discriminant
        // works symmetrically.
        oneZeroNineNineIntShapeRejectedByOcr: () => {
            const [t, v] = ocrValidate({ ...minimal, corrected: true })
            assertEq(t, 'error')
            if (t !== 'error') {
                throw ['expected error', t, v]
            }
            assertEq(v.path[0], 'dialect')
        },
    },
}
