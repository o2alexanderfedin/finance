/**
 * `vnd.fjs.1095a` — Form 1095-A, Health Insurance Marketplace Statement.
 *
 * Source, fetched and read directly rather than recalled:
 * `https://www.irs.gov/pub/irs-pdf/f1095a.pdf` — Form 1095-A (2025), printed
 * "Form 1095-A (2025) Created 6/5/25", with its own two-page "Instructions
 * for Recipient" read alongside. Unlike `vnd.fjs.1099div` this form IS
 * revised annually, so `formRevision` is a real field with a real value here
 * rather than a formality.
 *
 * **This is a REAL ISSUED INFORMATION RETURN, so this dialect is
 * TRANSCRIPTION, not attestation.** The Marketplace computes column B and
 * reports the same figures to the IRS; nothing here is a taxpayer's
 * assertion. That is why the two facts Form 8962 needs which the Marketplace
 * does NOT report — which federal-poverty-line table applies, and whether any
 * dependent is required to file — live on `vnd.fjs.return_profile` instead
 * (see `fjs/form8962/todo/premium-tax-credit.md`).
 *
 * Follows the `fjs/media/revision` four-stage template exactly as
 * `fjs/document/1099div/module.f.js` does: dialect -> mediaType -> schema ->
 * structural validate -> semantic `checkReferences` -> composed `validate`.
 *
 * Field-shape notes:
 *
 * - **Part III is TWELVE rows of THREE columns, stored as an array rather
 *   than as thirty-six named fields.** `monthlyCoverage` mirrors
 *   `vnd.fjs.1099div`'s `stateLocal` repeating group. The array carries its
 *   own `month` number rather than relying on position, because a 1095-A for
 *   a policy that started in July genuinely has six blank rows and a
 *   transcription that dropped them would silently renumber the rest —
 *   `checkReferences` enforces 1..12, integral, and no duplicates.
 * - **Line 33 (annual totals) is stored AND checked against the sum of lines
 *   21-32.** It is printed, so it is transcribed; and it is derivable, so the
 *   transcription is verifiable. A mismatch is refused by name, with both
 *   figures in the message — that is the one thing a second copy of a
 *   derivable number is good for. Form 8962 line 11's own columns (a)/(b)/(f)
 *   are exactly this line.
 * - **`voidBox`, not `void`.** `void` is a JavaScript operator; a property
 *   named for it reads as one at every use site. The printed box is "VOID"
 *   and its meaning is total: f1095a p2 says a VOID form "was sent in error"
 *   and *"Don't use the information on this or the previously received Form
 *   1095-A to figure your premium tax credit"*. `fjs/form8962` refuses on it
 *   rather than this module rejecting the blob, because a VOID 1095-A is a
 *   real document a taxpayer really received and storing it is correct.
 * - **`coveredIndividuals` (Part II) is REQUIRED and non-empty.** It is the
 *   only stored fact from which `fjs/form8962` can see that a policy covers
 *   somebody outside the tax family, which is the printed trigger for Part
 *   IV's allocation of policy amounts — the thing that form refuses.
 * - Dates (`policyStartDate`, `coverageTerminationDate`, ...) are free text,
 *   deliberately NOT parsed or format-checked, on `vnd.fjs.1099div`'s box 8
 *   precedent: they are transcribed as printed and no computation here reads
 *   them. Nothing in Form 8962 does either — Part III's twelve rows already
 *   say which months were covered.
 * - Every checkbox is `option(true)` (DOC-12): `corrected` and `voidBox`.
 *
 * ## The scope line this module does not cross
 *
 * This file imports NOTHING from `fjs/tax/`, `fjs/return/`, `fjs/form8962/`
 * or `fjs/form1040/`. It stores boxes and checks that they are exact; which
 * of the twelve rows can be summed, whether the annual or the monthly path of
 * Form 8962 applies, and when a missing column B must REFUSE are all
 * `fjs/form8962`'s decisions, made against the printed instructions and
 * proven there.
 *
 * @module
 */
import { array, number, open, option, string } from 'functionalscript/fjs/types/rtti/module.f.mjs'
import { validate as rttiValidate } from 'functionalscript/fjs/types/rtti/validate/module.f.mjs'
import { error, ok } from 'functionalscript/fjs/types/result/module.f.mjs'
import { assert, assertEq } from 'functionalscript/fjs/asserts/module.f.mjs'
import { isHash } from 'functionalscript/fjs/media/revision/module.f.mjs'
import { base, mediaTypeOf } from '../base/module.f.js'
import { formRevisionError } from '../form_revision/module.f.js'
import { moneyFieldError } from '../money_field/module.f.js'
import { centsFromString, centsToString } from '../../exact/module.f.js'

/** @import { Result } from 'functionalscript/fjs/types/result/types.js' */
/** @import { Ts, Unknown } from 'functionalscript/fjs/types/rtti/ts/types.js' */
/** @import { ValidationError } from 'functionalscript/fjs/types/rtti/common/types.js' */
/** @import { SubjectKey } from '../subject/module.f.js' */

/**
 * Format tag: names the dialect of this BLOB. The media type it is served
 * with is derived mechanically: `application/` + `dialect` + `+json`.
 */
export const dialect = 'vnd.fjs.1095a'
/** The media type derived from {@link dialect}: `application/vnd.fjs.1095a+json`. */
export const mediaType = mediaTypeOf(dialect)

/**
 * One Part II row (lines 16-20): a covered individual. `name` is required —
 * a row with no name is not a row — and everything else is absent-able,
 * because the printed form itself says a date of birth appears in column C
 * *"only if an SSN isn't entered in column B"*.
 */
const coveredIndividualEntry = open({
    name: string,
    ssn: option(string),
    dateOfBirth: option(string),
    coverageStartDate: option(string),
    coverageTerminationDate: option(string),
})

/**
 * One Part III row (lines 21-32): a month and its three columns. All three
 * columns are absent-able, because a month before the policy started has all
 * three blank, and a month whose coverage was terminated for non-payment has
 * a blank column A beside a filled column C (f1095a p2, column C).
 *
 * `month` is a `number` and NOT a name like `'january'`: the printed rows are
 * ordered and Form 8962's lines 12-23 are the same twelve rows in the same
 * order, so a comparison of "is every month present" is arithmetic on 1..12
 * rather than a lookup against a hand-typed list of English month names.
 */
const monthlyCoverageEntry = open({
    month: number,
    columnAEnrollmentPremiums: option(string),
    columnBSlcspPremium: option(string),
    columnCAdvancePaymentOfPtc: option(string),
})

/**
 * rtti schema for a `1095a` BLOB. `dialect` is spread first (via `base`) so
 * structural validation reports it as the first failing field on a mismatched
 * blob (DOC-00's discriminant).
 *
 * `recipientSsn` is the printed Part II line 5, which reads **"Recipient's
 * SSN"** and not "TIN" — the neighbouring lines (4 "Recipient's name", 6
 * "Recipient's date of birth", 7-9 the spouse's three) fix the party beyond
 * doubt. The field carried this repo's cross-dialect `recipientTin` until
 * FORM-KEY-01 gave every dialect its own {@link subjectKey} declaration; a
 * caller reads the ROLE now rather than guessing the name, so the name is
 * free to say what the paper says. There is no payer field at all: a
 * Marketplace is not a payer and the form prints no TIN for it.
 */
export const oneZeroNineFiveASchema = open({
    ...base(dialect),
    marketplaceIdentifier: string,
    marketplaceAssignedPolicyNumber: string,
    policyIssuerName: string,
    recipientSsn: string,
    taxYear: number,
    formRevision: string,
    sourceArtifactHash: string,
    corrected: option(true),
    voidBox: option(true),
    recipientName: option(string),
    recipientDateOfBirth: option(string),
    recipientSpouseName: option(string),
    recipientSpouseTin: option(string),
    recipientSpouseDateOfBirth: option(string),
    policyStartDate: option(string),
    policyTerminationDate: option(string),
    coveredIndividuals: array(coveredIndividualEntry),
    monthlyCoverage: array(monthlyCoverageEntry),
    line33AnnualEnrollmentPremiums: option(string),
    line33AnnualSlcspPremium: option(string),
    line33AnnualAdvancePaymentOfPtc: option(string),
})

/**
 * FORM-KEY-01 -- which of THIS dialect's OWN fields play the five roles a
 * form subject is keyed on. See `fjs/document/subject`'s {@link SubjectKey}
 * for why the dialect declares this instead of every caller assuming one
 * shared set of field names.
 *
 * No payer and no account role: this dialect has no such field, and an omitted role
 * derives the empty string -- exactly the `payerTin: ''` /
 * `accountNumber: ''` this dialect's subject has carried since DOC-01.
 * @type {SubjectKey}
 */
export const subjectKey = { formType: 'dialect', taxYear: 'taxYear', recipient: 'recipientSsn' }

/** @typedef {Ts<typeof oneZeroNineFiveASchema>} OneZeroNineFiveA */

/** One Part III row, as validated. @typedef {Ts<typeof monthlyCoverageEntry>} MonthlyCoverage */

/** Structural-only validator: checks the shape, not the semantic refinements below. */
const validateShape = rttiValidate(oneZeroNineFiveASchema)

/**
 * The scalar money boxes — the three line 33 annual totals — walked in a loop
 * so the exactness check is written once. Typed via `@type {const}` (not a
 * wider `keyof OneZeroNineFiveA`) so `r[field]` resolves to exactly `string |
 * undefined`, the device every other dialect here uses.
 */
export const moneyBoxFields = /** @type {const} */ ([
    'line33AnnualEnrollmentPremiums',
    'line33AnnualSlcspPremium',
    'line33AnnualAdvancePaymentOfPtc',
])

/**
 * Independently hand-typed: the number of scalar money boxes
 * {@link moneyBoxFields} is expected to name today. Deliberately NOT derived
 * from `moneyBoxFields.length` — a box dropped from the list would otherwise
 * take its own generated leaf with it and lose coverage silently (AGENTS.md's
 * fourth shipped defect).
 * @type {number}
 */
const expectedMoneyBoxFieldCount = 3

/**
 * The three money-carrying columns of one Part III row (`month` is an index,
 * not an amount). Named once, at module scope, so `checkReferences`' own loop
 * and this module's generated exactness proof walk the identical list rather
 * than being free to drift apart (AGENTS.md, "one rule, one place").
 */
export const monthlyMoneyFields = /** @type {const} */ ([
    'columnAEnrollmentPremiums',
    'columnBSlcspPremium',
    'columnCAdvancePaymentOfPtc',
])

/**
 * Independently hand-typed: the number of Part III money columns
 * {@link monthlyMoneyFields} is expected to name today. Deliberately NOT
 * derived from `monthlyMoneyFields.length` — see
 * {@link expectedMoneyBoxFieldCount}.
 * @type {number}
 */
const expectedMonthlyMoneyFieldCount = 3

/**
 * The line 33 total that each Part III column rolls up into, paired with the
 * column it totals. Written once here so the cross-check below cannot pair a
 * column with the wrong total, which is the whole failure this check exists
 * to catch.
 * @type {readonly (readonly [typeof monthlyMoneyFields[number], typeof moneyBoxFields[number]])[]}
 */
const annualTotalOfColumn = [
    ['columnAEnrollmentPremiums', 'line33AnnualEnrollmentPremiums'],
    ['columnBSlcspPremium', 'line33AnnualSlcspPremium'],
    ['columnCAdvancePaymentOfPtc', 'line33AnnualAdvancePaymentOfPtc'],
]

/**
 * The exact cents sum of one Part III column over every row, skipping absent
 * boxes (DOC-11: absent is absent, never a zero that was read).
 * @type {(rows: readonly MonthlyCoverage[]) => (column: typeof monthlyMoneyFields[number]) => bigint}
 */
export const monthlyColumnTotalCents = rows => column => rows.reduce(
    (total, row) => {
        const printed = row[column]
        return printed === undefined ? total : total + centsFromString(printed)
    },
    0n,
)

/**
 * Either a structural validation error or a semantic (string) error message.
 * @typedef {ValidationError | string} OneZeroNineFiveAError
 */

/**
 * Checks the semantic refinements the structural schema cannot express:
 * `formRevision` is non-empty (DOC-10), `sourceArtifactHash` decodes as a
 * real cBase32 hash (DOC-13), at least one covered individual is listed, every
 * Part III row names a whole month in 1..12 and no month appears twice, every
 * PRESENT money box is an exact decimal within safe magnitude, and each
 * PRESENT line 33 total equals the sum of its own column.
 * @type {(r: OneZeroNineFiveA) => Result<OneZeroNineFiveA, OneZeroNineFiveAError>}
 */
export const checkReferences = r => {
    const formRevisionMessage = formRevisionError(r.formRevision)
    if (formRevisionMessage !== undefined) {
        return error(formRevisionMessage)
    }
    if (!isHash(r.sourceArtifactHash)) {
        return error(`sourceArtifactHash is not a valid hash: ${r.sourceArtifactHash}`)
    }
    if (r.coveredIndividuals.length === 0) {
        return error(
            'Form 1095-A Part II lists no covered individual, and a policy covering nobody is '
            + 'not a statement this engine can read: Form 8962 compares Part II against the tax '
            + 'family size to decide whether Part IV allocation applies')
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
    /** @type {number[]} */
    const seenMonths = []
    for (const row of r.monthlyCoverage) {
        if (!Number.isInteger(row.month) || row.month < 1 || row.month > 12) {
            return error(
                `Form 1095-A Part III names month ${row.month}, and lines 21 through 32 are `
                + 'exactly the twelve whole months 1 through 12')
        }
        if (seenMonths.includes(row.month)) {
            return error(
                `Form 1095-A Part III names month ${row.month} twice; one printed row per month, `
                + 'and two rows for one month would be summed into a doubled premium')
        }
        seenMonths.push(row.month)
        for (const field of monthlyMoneyFields) {
            const printed = row[field]
            if (printed === undefined) {
                continue
            }
            const message = moneyFieldError(`month ${row.month} ${field}`)(printed)
            if (message !== undefined) {
                return error(message)
            }
        }
    }
    for (const [column, total] of annualTotalOfColumn) {
        const printed = r[total]
        if (printed === undefined) {
            continue
        }
        const summed = monthlyColumnTotalCents(r.monthlyCoverage)(column)
        const stated = centsFromString(printed)
        if (stated !== summed) {
            return error(
                `Form 1095-A ${total} reads ${centsToString(stated)} but lines 21 through 32 of `
                + `${column} sum to ${centsToString(summed)}; line 33 is the printed total of `
                + 'those twelve rows, so the two disagreeing means the transcription lost a month')
        }
    }
    return ok(r)
}

/**
 * Validates an already-parsed JSON value as a `1095a` BLOB: structural (rtti)
 * validation followed by the semantic checks in {@link checkReferences}.
 * Dialect discrimination happens exclusively through the schema's
 * exact-literal `dialect` constant — the serialized JSON text is never
 * inspected.
 * @type {(value: Unknown) => Result<OneZeroNineFiveA, OneZeroNineFiveAError>}
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
 * the SAME literal every other dialect's DOC-13 proof reuses, so a
 * shared-provenance comparison across dialects is a plain `===` on identical
 * literals rather than a coincidence to explain.
 * @type {string}
 */
const sharedSourceArtifactHash = 'deadbeef00112233445566778899aabbccddeeff0011223344556677889900'

/** @type {OneZeroNineFiveA} */
const minimal = {
    dialect,
    marketplaceIdentifier: '99',
    marketplaceAssignedPolicyNumber: 'POLICY-0001',
    policyIssuerName: 'Some Health Plan, Inc.',
    recipientSsn: '222-22-2222',
    taxYear: 2025,
    formRevision: '2025',
    sourceArtifactHash: sharedSourceArtifactHash,
    coveredIndividuals: [{ name: 'Some Person' }],
    monthlyCoverage: [],
}

/**
 * Twelve identical rows — the shape Form 8962 line 10 calls "Yes" — built here
 * rather than typed out, since what is being proven in this file is the
 * exactness and consistency checks, not the arithmetic.
 * @type {(columnA: string) => (columnB: string) => (columnC: string) => readonly Ts<typeof monthlyCoverageEntry>[]}
 */
const twelveUniformMonths = columnA => columnB => columnC =>
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(month => ({
        month,
        columnAEnrollmentPremiums: columnA,
        columnBSlcspPremium: columnB,
        columnCAdvancePaymentOfPtc: columnC,
    }))

/**
 * T-1095A-01: a money box's name could be quietly dropped from
 * {@link moneyBoxFields} without anyone noticing — the field stays
 * `option(string)` structurally, so a comma-grouped amount in a dropped box
 * would then validate as ok. One generated leaf per NAMED scalar box supplies
 * a comma-grouped value to that box alone and asserts `validate` refuses,
 * built by mapping {@link moneyBoxFields} itself into `[field, assertion]`
 * pairs.
 *
 * The fixture carries ONE month whose own column holds the same comma-grouped
 * text, so the line 33 cross-check cannot be what refuses: an inexact total
 * beside an inexact column would otherwise be caught by the totals comparison
 * and this leaf would prove the wrong rule. The month's column is refused
 * FIRST (the row loop runs before the totals loop), which is why the assertion
 * below is only that it refuses at all — `moneyBoxExactnessIsWhatRefusesTheTotal`
 * is the leaf that pins the scalar loop specifically.
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
 * Same idiom as {@link generatedScalarMoneyBoxExactnessProof}, for the three
 * Part III money columns named in {@link monthlyMoneyFields}. The row is the
 * ONLY row, so no line 33 total exists to catch it instead.
 * @type {{ readonly [field: string]: () => void }}
 */
const generatedMonthlyMoneyExactnessProof = Object.fromEntries(
    monthlyMoneyFields.map(field => [
        field,
        () => {
            const [t, v] = validate({
                ...minimal,
                monthlyCoverage: [{ month: 1, [field]: '1,234.56' }],
            })
            assertEq(
                t,
                'error',
                ['expected a comma-grouped amount in this Part III column to be refused', field, t, v])
        },
    ]),
)

/**
 * One generated leaf per column/total pair in {@link annualTotalOfColumn}:
 * a line 33 total one cent away from its own column's sum is refused, and the
 * message names BOTH figures. Generated rather than written three times, and
 * paired with a hand-typed count so a pair dropped from the list cannot take
 * its own leaf with it.
 * @type {{ readonly [field: string]: () => void }}
 */
const generatedAnnualTotalProof = Object.fromEntries(
    annualTotalOfColumn.map(([column, total]) => [
        total,
        () => {
            const [t, v] = validate({
                ...minimal,
                monthlyCoverage: [{ month: 1, [column]: '100.00' }, { month: 2, [column]: '100.00' }],
                [total]: '200.01',
            })
            assertEq(t, 'error', ['expected a line 33 total that misses its column sum to be refused', total, t, v])
            assert(
                typeof v === 'string' && v.includes('200.01') && v.includes('200.00'),
                ['expected the refusal to name BOTH the stated total and the summed one', total, v])
        },
    ]),
)

export const proof = {
    dialectAndMediaType: () => {
        assertEq(dialect, 'vnd.fjs.1095a')
        assertEq(mediaType, 'application/vnd.fjs.1095a+json')
    },
    validate: {
        fullyPopulatedValidates: () => {
            const [t, v] = validate({
                ...minimal,
                corrected: true,
                recipientName: 'Some Person',
                recipientDateOfBirth: '1979-04-02',
                recipientSpouseName: 'Some Spouse',
                recipientSpouseTin: '333-33-3333',
                recipientSpouseDateOfBirth: '1981-11-30',
                policyStartDate: '2025-01-01',
                policyTerminationDate: '2025-12-31',
                coveredIndividuals: [
                    { name: 'Some Person', ssn: '222-22-2222', coverageStartDate: '2025-01-01' },
                    { name: 'Some Spouse', dateOfBirth: '1981-11-30', coverageStartDate: '2025-01-01' },
                ],
                monthlyCoverage: twelveUniformMonths('900.00')('850.00')('600.00'),
                line33AnnualEnrollmentPremiums: '10800.00',
                line33AnnualSlcspPremium: '10200.00',
                line33AnnualAdvancePaymentOfPtc: '7200.00',
            })
            assert(t === 'ok', ['expected ok', t, v])
            assertEq(v.monthlyCoverage.length, 12)
            assertEq(v.coveredIndividuals.length, 2)
        },
        // DOC-11: every optional box omitted is valid, and reads back absent
        // rather than as a zero amount or a false flag.
        blankBoxesOmittedValidates: () => {
            const [t, v] = validate(minimal)
            assert(t === 'ok', ['expected ok', t, v])
            assertEq(v.corrected, undefined)
            assertEq(v.voidBox, undefined)
            assertEq(v.line33AnnualEnrollmentPremiums, undefined)
            assertEq(v.monthlyCoverage.length, 0)
        },
        // DOC-12: `false` is not a member of `option(true)` for either
        // checkbox — rejected structurally, never accepted as "not checked".
        falseFlagsRejected: () => {
            assertEq(validate({ ...minimal, corrected: false })[0], 'error')
            assertEq(validate({ ...minimal, voidBox: false })[0], 'error')
        },
        // A VOID form is a real document a taxpayer really received, so it
        // STORES. Refusing to compute from it is `fjs/form8962`'s job, not
        // this module's — the control for that refusal lives there.
        voidFormStillValidates: () => {
            const [t, v] = validate({ ...minimal, voidBox: true })
            assert(t === 'ok', ['expected a VOID 1095-A to store, not to be rejected here', t, v])
            assertEq(v.voidBox, true)
        },
        wrongDialectRejected: () => {
            const [t, v] = validate({ ...minimal, dialect: 'vnd.fjs.1099div' })
            assert(t === 'error', ['expected error', t, v])
            assert(typeof v !== 'string', ['expected a structural ValidationError', v])
            assertEq(v.path[0], 'dialect')
        },
    },
    checkReferences: {
        emptyFormRevisionRejected: () => {
            assertEq(validate({ ...minimal, formRevision: '' })[0], 'error')
        },
        sourceArtifactHashRejectedWhenNotAHash: () => {
            const [t, v] = validate({ ...minimal, sourceArtifactHash: 'not-a-hash' })
            assertEq(t, 'error', ['expected a non-cBase32 sourceArtifactHash to be refused', t, v])
        },
        // Part II with no rows: refused, and the refusal says WHY the count
        // matters rather than merely that it is zero.
        emptyCoveredIndividualsRejected: () => {
            const [t, v] = validate({ ...minimal, coveredIndividuals: [] })
            assertEq(t, 'error', ['expected an empty Part II to be refused', t, v])
            assert(
                typeof v === 'string' && v.includes('Part IV'),
                ['expected the refusal to name what the count is read FOR', v])
        },
        monthOutOfRangeRejected: () => {
            for (const month of [0, 13, -1]) {
                const [t, v] = validate({ ...minimal, monthlyCoverage: [{ month }] })
                assertEq(t, 'error', ['expected a month outside 1..12 to be refused', month, t, v])
                assert(
                    typeof v === 'string' && v.includes(`${month}`),
                    ['expected the refusal to name the offending month', month, v])
            }
        },
        fractionalMonthRejected: () => {
            const [t, v] = validate({ ...minimal, monthlyCoverage: [{ month: 6.5 }] })
            assertEq(t, 'error', ['expected a fractional month to be refused', t, v])
        },
        // Two rows for one month would be SUMMED by every consumer of this
        // document, doubling that month's premium. Refused here, once.
        duplicateMonthRejected: () => {
            const [t, v] = validate({
                ...minimal,
                monthlyCoverage: [
                    { month: 3, columnAEnrollmentPremiums: '100.00' },
                    { month: 3, columnAEnrollmentPremiums: '100.00' },
                ],
            })
            assertEq(t, 'error', ['expected a repeated month to be refused', t, v])
            assert(
                typeof v === 'string' && v.includes('twice'),
                ['expected the refusal to say the month appears twice', v])
        },
        // The control for the two leaves above: eleven months, out of order,
        // with gaps, all validate. A gate that refused everything would pass
        // both of those without this.
        monthsOutOfOrderAndIncompleteValidate: () => {
            const [t, v] = validate({
                ...minimal,
                monthlyCoverage: [
                    { month: 7, columnAEnrollmentPremiums: '100.00' },
                    { month: 1, columnAEnrollmentPremiums: '100.00' },
                    { month: 12, columnAEnrollmentPremiums: '100.00' },
                ],
            })
            assert(t === 'ok', ['expected a partial-year, out-of-order Part III to store', t, v])
            assertEq(v.monthlyCoverage.length, 3)
            assertEq(v.monthlyCoverage[0]?.month, 7)
        },
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
            // The generated leaves above cannot tell the scalar loop from the
            // line 33 cross-check, because an inexact total is refused by
            // whichever runs first. This one can: the columns are EMPTY, so
            // every line 33 sum is zero and an exact `'0.00'` total would
            // pass — only the exactness loop can refuse `'1,234.56'` here.
            moneyBoxExactnessIsWhatRefusesTheTotal: () => {
                const [ok0] = validate({ ...minimal, line33AnnualEnrollmentPremiums: '0.00' })
                assertEq(ok0, 'ok', 'a zero total over zero rows agrees, so the cross-check passes')
                const [t, v] = validate({ ...minimal, line33AnnualEnrollmentPremiums: '1,234.56' })
                assertEq(t, 'error', ['expected the exactness loop to refuse a comma-grouped total', t, v])
            },
        },
        monthlyMoneyExactness: {
            ...generatedMonthlyMoneyExactnessProof,
            everyColumnIsCovered: () => {
                assertEq(
                    monthlyMoneyFields.length,
                    expectedMonthlyMoneyFieldCount,
                    [
                        'expected exactly the independently-stated Part III money column count',
                        monthlyMoneyFields.length,
                        expectedMonthlyMoneyFieldCount,
                    ],
                )
            },
        },
        annualTotals: {
            ...generatedAnnualTotalProof,
            everyColumnHasATotal: () => {
                assertEq(
                    annualTotalOfColumn.length,
                    expectedMonthlyMoneyFieldCount,
                    [
                        'expected one line 33 total per Part III money column',
                        annualTotalOfColumn.length,
                        expectedMonthlyMoneyFieldCount,
                    ],
                )
            },
            // The control: the SAME fixture with a total that agrees stores.
            // Without this, a cross-check that refused every present total
            // would pass every generated leaf above.
            agreeingTotalsValidate: () => {
                const [t, v] = validate({
                    ...minimal,
                    monthlyCoverage: twelveUniformMonths('900.00')('850.00')('600.00'),
                    line33AnnualEnrollmentPremiums: '10800.00',
                    line33AnnualSlcspPremium: '10200.00',
                    line33AnnualAdvancePaymentOfPtc: '7200.00',
                })
                assert(t === 'ok', ['expected agreeing line 33 totals to store', t, v])
                assertEq(v.line33AnnualEnrollmentPremiums, '10800.00')
            },
            // The pairing itself is what a transposition would break: column
            // B's sum against line 33 column A. Proven by a fixture whose
            // three columns have three DIFFERENT sums, so a mis-paired total
            // cannot accidentally agree.
            eachTotalIsComparedAgainstItsOwnColumn: () => {
                const [t, v] = validate({
                    ...minimal,
                    monthlyCoverage: [{
                        month: 1,
                        columnAEnrollmentPremiums: '900.00',
                        columnBSlcspPremium: '850.00',
                        columnCAdvancePaymentOfPtc: '600.00',
                    }],
                    line33AnnualEnrollmentPremiums: '850.00',
                    line33AnnualSlcspPremium: '900.00',
                    line33AnnualAdvancePaymentOfPtc: '600.00',
                })
                assertEq(t, 'error', ['expected transposed A/B totals to be refused', t, v])
                assert(
                    typeof v === 'string' && v.includes('line33AnnualEnrollmentPremiums'),
                    ['expected the refusal to name the column A total specifically', v])
            },
        },
    },
    monthlyColumnTotalCents: {
        // DOC-11 at the summing layer: an absent box is skipped, never read
        // as a zero that was there. Observable because the row COUNT differs
        // from the number of contributing boxes.
        absentBoxesAreSkippedNotZeroed: () => {
            /** @type {readonly MonthlyCoverage[]} */
            const rows = [
                { month: 1, columnAEnrollmentPremiums: '100.00' },
                { month: 2 },
                { month: 3, columnAEnrollmentPremiums: '250.50' },
            ]
            assertEq(
                monthlyColumnTotalCents(rows)('columnAEnrollmentPremiums'),
                35050n,
                '$350.50 — the two present boxes, with the absent month contributing nothing')
            assertEq(
                monthlyColumnTotalCents(rows)('columnBSlcspPremium'),
                0n,
                'a column nobody filled in totals zero without any box having been read')
        },
    },
}
