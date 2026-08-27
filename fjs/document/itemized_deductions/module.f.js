/**
 * `vnd.fjs.itemized_deductions` — the substantiation record behind
 * Schedule A's line-tagged deductions (SALT, mortgage interest, gifts to
 * charity, and the other-itemized lines).
 *
 * **This dialect is not a transcribed IRS form, and that is the whole
 * point of it.** There is no information return reporting what a
 * taxpayer paid in state and local tax, gave to charity, or paid in
 * mortgage interest outside what Form 1098 already covers: no single
 * payer files one document naming every line, and nothing arrives in the
 * mail shaped like Schedule A. The deduction is supported by the
 * taxpayer's own records. So, exactly like `vnd.fjs.medical_expenses`
 * (13-CONTEXT.md Decision 2.1 — followed verbatim on every design point
 * below), this document is *taxpayer-asserted*.
 *
 * Consequences that are deliberate, not oversights:
 *
 * - **No `formRevision`.** DOC-10 exists because box semantics drift
 *   between revisions of a printed form; there is no printed form and no
 *   boxes, so the field would carry no information and inventing a value
 *   would be worse than omitting one. DOC-10's scope is dialects that
 *   transcribe a printed IRS form.
 * - **No total.** Nothing here sums the entries, and nothing applies the
 *   SALT cap or the 7.5%-of-AGI medical floor: both need an AGI this
 *   document cannot see, and a stored total would be a second source of
 *   truth able to disagree with the entries it came from. Both belong to
 *   the phase that computes Schedule A (`fjs/schedule/a`, 13-06).
 * - **`lineTag` is a free string.** Enumerating what Publication 526 (or
 *   Schedule A's own instructions) do and do not allow is deduction
 *   logic; this dialect stores and reads.
 *
 * The subject convention: a subject is keyed on five ROLES —
 * `(formType, taxYear, payer, recipient, account)` (DOC-01) — which each
 * dialect maps onto its own fields via {@link subjectKey} (FORM-KEY-01).
 * This dialect keeps the spellings `recipientTin`/`taxYear` because it
 * transcribes a fact off the taxpayer's own return and has no printed form
 * to take names from; it has no payer and no account. Both are `''`, which makes exactly
 * one such subject per taxpayer per tax year — the right cardinality,
 * since this is one running record rather than one document per expense.
 * Revising it means a new revision under that subject, which is what Evo
 * is for.
 *
 * @module
 */
import { array, number, open, option, string } from 'functionalscript/fjs/types/rtti/module.f.mjs'
import { validate as rttiValidate } from 'functionalscript/fjs/types/rtti/validate/module.f.mjs'
import { error, ok } from 'functionalscript/fjs/types/result/module.f.mjs'
import { assert, assertEq } from 'functionalscript/fjs/asserts/module.f.mjs'
import { base, mediaTypeOf } from '../base/module.f.js'
import { moneyFieldError } from '../money_field/module.f.js'
import { dialect as medicalExpensesDialect, medicalExpensesSchema } from '../medical_expenses/module.f.js'

/** @import { Result } from 'functionalscript/fjs/types/result/types.js' */
/** @import { Ts, Unknown } from 'functionalscript/fjs/types/rtti/ts/types.js' */
/** @import { ValidationError } from 'functionalscript/fjs/types/rtti/common/types.js' */
/** @import { SubjectKey } from '../subject/module.f.js' */

/**
 * Format tag: names the dialect of this BLOB. The media type it is served
 * with is derived mechanically: `application/` + `dialect` + `+json`.
 */
export const dialect = 'vnd.fjs.itemized_deductions'
/** The media type derived from {@link dialect}: `application/vnd.fjs.itemized_deductions+json`. */
export const mediaType = mediaTypeOf(dialect)

/**
 * One itemized entry. `lineTag` names which Schedule A line the entry
 * belongs to (e.g. `'saltIncomeTax'`, `'mortgageInterest'`,
 * `'charitableCash'`) — a free string, not an enum: see this module's own
 * docstring for why. There is NO `reimbursed`-equivalent field; this
 * dialect has no analog to `medical_expenses`'s reimbursement concept.
 */
const itemizedEntry = open({
    lineTag: string,
    provider: string,
    amount: string,
})

/**
 * rtti schema for an `itemized_deductions` BLOB. `dialect` is spread first
 * (via `base`) so structural validation reports it as the first failing
 * field on a mismatched blob (DOC-00's discriminant). NO `formRevision`
 * — DOC-10 does not apply; there is no printed form.
 */
export const itemizedDeductionsSchema = open({
    ...base(dialect),
    recipientTin: string,
    taxYear: number,
    corrected: option(true),
    entries: array(itemizedEntry),
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
export const subjectKey = { formType: 'dialect', taxYear: 'taxYear', recipient: 'recipientTin' }

/** @typedef {Ts<typeof itemizedDeductionsSchema>} ItemizedDeductions */

/** Structural-only validator: checks the shape, not the semantic refinements below. */
const validateShape = rttiValidate(itemizedDeductionsSchema)

/**
 * Either a structural validation error or a semantic (string) error message.
 * @typedef {ValidationError | string} ItemizedDeductionsError
 */

/**
 * Checks the semantic refinement the structural schema cannot express:
 * every entry's `amount` is an exact decimal within safe magnitude —
 * mirroring `medical_expenses`'s own per-entry `moneyFieldError` loop
 * exactly. No date field on this dialect, so no `isoDate` check applies
 * here — this dialect has no `datePaid` analog.
 * @type {(r: ItemizedDeductions) => Result<ItemizedDeductions, ItemizedDeductionsError>}
 */
export const checkReferences = r => {
    for (const entry of r.entries) {
        const amountMessage = moneyFieldError(`amount for ${entry.provider} (${entry.lineTag})`)(entry.amount)
        if (amountMessage !== undefined) {
            return error(amountMessage)
        }
    }
    return ok(r)
}

/**
 * Validates an already-parsed JSON value as an `itemized_deductions` BLOB:
 * structural (rtti) validation followed by {@link checkReferences}.
 * Dialect discrimination happens exclusively through the schema's
 * exact-literal `dialect` constant — the serialized JSON text is never
 * inspected.
 * @type {(value: Unknown) => Result<ItemizedDeductions, ItemizedDeductionsError>}
 */
export const validate = value => {
    const [t, v] = validateShape(value)
    if (t === 'error') {
        return error(v)
    }
    return checkReferences(v)
}

// ── Tests ────────────────────────────────────────────────────────────────────

/** @type {ItemizedDeductions} */
const minimal = {
    dialect,
    recipientTin: '222-22-2222',
    taxYear: 2025,
    entries: [],
}

/** A SALT entry — the commonest itemized deduction line. */
const saltEntry = {
    lineTag: 'saltIncomeTax',
    provider: 'State of California',
    amount: '4200.00',
}

export const proof = {
    dialectAndMediaType: () => {
        assertEq(dialect, 'vnd.fjs.itemized_deductions')
        assertEq(mediaType, 'application/vnd.fjs.itemized_deductions+json')
    },
    validate: {
        // A taxpayer with no itemizable expenses recorded yet is a real,
        // distinct state, and it is not the same as having no document.
        emptyEntriesValidates: () => {
            const [t, v] = validate(minimal)
            assert(t === 'ok', ['expected ok', t, v])
            assertEq(v.entries.length, 0)
        },
        populatedRoundTrips: () => {
            const [t, v] = validate({ ...minimal, entries: [saltEntry] })
            assert(t === 'ok', ['expected ok', t, v])
            assertEq(v.entries.length, 1)
            assertEq(v.entries[0]?.lineTag, 'saltIncomeTax')
            assertEq(v.entries[0]?.provider, 'State of California')
            assertEq(v.entries[0]?.amount, '4200.00')
        },
        wrongDialectRejected: () => {
            const [t, v] = validate({ ...minimal, dialect: 'vnd.fjs.w2' })
            assertEq(t, 'error')
            if (t !== 'error') {
                throw ['expected error', t, v]
            }
            if (typeof v === 'string') {
                throw ['expected a structural ValidationError', v]
            }
            assertEq(v.path[0], 'dialect')
        },
        correctedFalseRejected: () => {
            assertEq(validate({ ...minimal, corrected: false })[0], 'error')
        },
    },
    amounts: {
        // The comma-grouped form is the OCR boundary's input, never a
        // stored value — refused by {@link checkReferences}, never
        // repaired into one.
        commaGroupedRejected: () => {
            assertEq(validate({ ...minimal, entries: [{ ...saltEntry, amount: '4,200.00' }] })[0], 'error')
        },
        canonicalAccepted: () => {
            assertEq(validate({ ...minimal, entries: [{ ...saltEntry, amount: '4200.00' }] })[0], 'ok')
        },
    },
    // Nothing in this module totals anything: no export sums entries, and
    // neither the SALT cap nor the 7.5%-of-AGI medical floor can be
    // applied without an AGI this document cannot see. A stored total
    // would be a second source of truth able to disagree with the entries
    // it came from.
    noTotalIsStored: () => {
        const [t, v] = validate({ ...minimal, entries: [saltEntry, { ...saltEntry, lineTag: 'charitableCash' }] })
        assert(t === 'ok', ['expected ok', t, v])
        assertEq(Object.keys(v).includes('total'), false)
        assertEq(v.entries.length, 2)
    },
    // DOC-00, `crossDialect`-style leaf: a fully-valid `vnd.fjs.medical_expenses`
    // value — constructed as a PARSED JS OBJECT, never a JSON string, so
    // the rejection is proven structural rather than a prefix probe on
    // serialized text — fails THIS dialect's `validate`, and the failure's
    // path is exactly `['dialect']`.
    crossDialect: {
        medicalExpensesShapeRejectedByItemizedDeductions: () => {
            /** @type {Ts<typeof medicalExpensesSchema>} */
            const medicalExpensesValue = {
                dialect: medicalExpensesDialect,
                recipientTin: '222-22-2222',
                taxYear: 2025,
                entries: [],
            }
            const [t, v] = validate(medicalExpensesValue)
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
    },
}
