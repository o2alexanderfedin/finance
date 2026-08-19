/**
 * `vnd.fjs.medical_expenses` — the substantiation record behind Schedule A's
 * medical and dental deduction.
 *
 * **This dialect is not a transcribed IRS form, and that is the whole point
 * of it.** There is no information return reporting what a taxpayer spent
 * out of pocket on medical care: no payer files one, and nothing arrives in
 * the mail. The deduction is supported by receipts. So unlike every other
 * dialect here, this document is *taxpayer-asserted* — which makes what it
 * stores, and what it refuses to conclude, more delicate rather than less.
 *
 * Consequences that are deliberate, not oversights:
 *
 * - **No `formRevision`.** DOC-10 exists because box semantics drift between
 *   revisions of a printed form; there is no printed form and no boxes, so
 *   the field would carry no information and inventing a value would be
 *   worse than omitting one. DOC-10's scope is dialects that transcribe a
 *   printed IRS form.
 * - **No total.** Nothing here sums the entries, and nothing applies the
 *   7.5%-of-AGI floor: the floor needs an AGI this document cannot see, and
 *   a stored total would be a second source of truth able to disagree with
 *   the entries it came from. Both belong to the phase that computes
 *   Schedule A.
 * - **`reimbursed` is absent-able and is NOT checked against `amount`.**
 *   Only unreimbursed expense is deductible, so reimbursement has to be
 *   recorded — and absent must stay distinguishable from `'0.00'`, because
 *   "no reimbursement was recorded" and "the insurer paid nothing" are
 *   different claims when a return is questioned. A reimbursement exceeding
 *   the expense is left storable: it happens, and refusing to store a fact
 *   because it looks odd is judging, not recording.
 * - **`category` is a free string.** Enumerating what Publication 502 does
 *   and does not allow is deduction logic; this phase stores and reads.
 *
 * The subject convention: `formSubject` keys on `(payerTin, recipientTin,
 * accountNumber, taxYear, formType)` for every dialect (DOC-01), and this
 * record has no payer and no account. Both are `''`, which makes exactly one
 * such subject per taxpayer per tax year — the right cardinality, since this
 * is one running record rather than one document per expense. Revising it
 * means a new revision under that subject, which is what Evo is for.
 *
 * @module
 */
import { array, number, option, string } from 'functionalscript/fjs/types/rtti/module.f.mjs'
import { validate as rttiValidate } from 'functionalscript/fjs/types/rtti/validate/module.f.mjs'
import { error, ok } from 'functionalscript/fjs/types/result/module.f.mjs'
import { assert, assertEq } from 'functionalscript/fjs/asserts/module.f.mjs'
import { base, mediaTypeOf } from '../base/module.f.js'
import { moneyFieldError } from '../money_field/module.f.js'

/** @import { Result } from 'functionalscript/fjs/types/result/types.js' */
/** @import { Ts, Unknown } from 'functionalscript/fjs/types/rtti/ts/types.js' */
/** @import { ValidationError } from 'functionalscript/fjs/types/rtti/common/types.js' */

/**
 * Format tag: names the dialect of this BLOB. The media type it is served
 * with is derived mechanically: `application/` + `dialect` + `+json`.
 */
export const dialect = 'vnd.fjs.medical_expenses'
/** The media type derived from {@link dialect}: `application/vnd.fjs.medical_expenses+json`. */
export const mediaType = mediaTypeOf(dialect)

/**
 * One expense. `datePaid` is the deductible-year determinant — medical
 * expenses are deducted in the year PAID, not the year billed or the year
 * the care was received — so it is required, and checked against the
 * document's `taxYear` below.
 */
const expenseEntry = /** @type {const} */ ({
    datePaid: string,
    provider: string,
    category: string,
    amount: string,
    reimbursed: option(string),
})

/**
 * rtti schema for a `medical_expenses` BLOB. `dialect` is spread first (via
 * `base`) so structural validation reports it as the first failing field on
 * a mismatched blob (DOC-00's discriminant).
 */
export const medicalExpensesSchema = /** @type {const} */ ({
    ...base(dialect),
    recipientTin: string,
    taxYear: number,
    corrected: option(true),
    entries: array(expenseEntry),
})

/** @typedef {Ts<typeof medicalExpensesSchema>} MedicalExpenses */

/** Structural-only validator: checks the shape, not the semantic refinements below. */
const validateShape = rttiValidate(medicalExpensesSchema)

/**
 * Either a structural validation error or a semantic (string) error message.
 * @typedef {ValidationError | string} MedicalExpensesError
 */

/**
 * An ISO calendar date, `YYYY-MM-DD`. Fixed-width digit groups with no
 * alternation, so matching is linear in input length. Range validity
 * (a 31st of February) is not checked: this is a storage boundary, and a
 * calendar is more than it needs to own.
 * @type {RegExp}
 */
const isoDate = /^(\d{4})-(\d{2})-(\d{2})$/

/**
 * Checks the semantic refinements the structural schema cannot express:
 * every `datePaid` is an ISO date whose YEAR matches the document's
 * `taxYear`, and every present amount is an exact decimal within safe
 * magnitude.
 *
 * The year check is the one that earns its place. Medical expenses are
 * deductible in the year they are paid, so a January bill paid in December
 * belongs to a different return than the same bill paid in January — and an
 * entry filed under the wrong year is a wrong deduction that no later stage
 * can detect, because by then the year is simply what the document says it
 * is. Comparing the digits costs nothing and refuses it at the boundary.
 * @type {(r: MedicalExpenses) => Result<MedicalExpenses, MedicalExpensesError>}
 */
export const checkReferences = r => {
    for (const entry of r.entries) {
        const m = isoDate.exec(entry.datePaid)
        if (m === null) {
            return error(`datePaid is not an ISO YYYY-MM-DD date: ${entry.datePaid}`)
        }
        const [, year] = m
        if (year !== String(r.taxYear)) {
            return error(
                `datePaid ${entry.datePaid} is not in tax year ${r.taxYear} — `
                + `a medical expense is deducted in the year it was paid`)
        }
        const amountMessage = moneyFieldError(`amount for ${entry.provider} on ${entry.datePaid}`)(entry.amount)
        if (amountMessage !== undefined) {
            return error(amountMessage)
        }
        if (entry.reimbursed === undefined) {
            continue
        }
        const reimbursedMessage =
            moneyFieldError(`reimbursed for ${entry.provider} on ${entry.datePaid}`)(entry.reimbursed)
        if (reimbursedMessage !== undefined) {
            return error(reimbursedMessage)
        }
    }
    return ok(r)
}

/**
 * Validates an already-parsed JSON value as a `medical_expenses` BLOB:
 * structural (rtti) validation followed by {@link checkReferences}. Dialect
 * discrimination happens exclusively through the schema's exact-literal
 * `dialect` constant — the serialized JSON text is never inspected.
 * @type {(value: Unknown) => Result<MedicalExpenses, MedicalExpensesError>}
 */
export const validate = value => {
    const [t, v] = validateShape(value)
    if (t === 'error') {
        return error(v)
    }
    return checkReferences(v)
}

// ── Tests ────────────────────────────────────────────────────────────────────

/** @type {MedicalExpenses} */
const minimal = {
    dialect,
    recipientTin: '222-22-2222',
    taxYear: 2025,
    entries: [],
}

/** A Medicare Part B premium — the commonest medical expense of the 65+ profile. */
const partB = {
    datePaid: '2025-03-01',
    provider: 'Medicare',
    category: 'insurance-premium',
    amount: '185.00',
}

export const proof = {
    dialectAndMediaType: () => {
        assertEq(dialect, 'vnd.fjs.medical_expenses')
        assertEq(mediaType, 'application/vnd.fjs.medical_expenses+json')
    },
    validate: {
        // A taxpayer with no medical expenses recorded yet is a real state,
        // and it is not the same as having no document.
        emptyEntriesValidates: () => {
            const [t, v] = validate(minimal)
            assert(t === 'ok', ['expected ok', t, v])
            assertEq(v.entries.length, 0)
        },
        populatedRoundTrips: () => {
            const [t, v] = validate({
                ...minimal,
                entries: [
                    partB,
                    { datePaid: '2025-07-14', provider: 'Some Dental', category: 'dental', amount: '1240.00', reimbursed: '400.00' },
                ],
            })
            assert(t === 'ok', ['expected ok', t, v])
            assertEq(v.entries.length, 2)
            assertEq(v.entries[1]?.reimbursed, '400.00')
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
    reimbursement: {
        // DOC-11 on the field that most invites a zero default: "nothing was
        // recorded" and "the insurer paid nothing" are different claims, and
        // only the deductible amount depends on which one is true.
        absentIsNotZero: () => {
            const [t, v] = validate({ ...minimal, entries: [partB] })
            assert(t === 'ok', ['expected ok', t, v])
            assertEq(v.entries[0]?.reimbursed, undefined)
            assert(v.entries[0]?.reimbursed !== '0.00', 'an unrecorded reimbursement must not read as zero')
        },
        // Over-reimbursement is storable. Refusing to record a fact because
        // it looks odd is judging, not recording — and this validator's job
        // ends at exactness.
        exceedingTheExpenseIsStorable: () => {
            const [t] = validate({
                ...minimal,
                entries: [{ ...partB, reimbursed: '500.00' }],
            })
            assertEq(t, 'ok')
        },
        inexactReimbursementRejected: () => {
            assertEq(validate({ ...minimal, entries: [{ ...partB, reimbursed: '1,000.00' }] })[0], 'error')
        },
    },
    datePaid: {
        // The deductible year is the year PAID. An entry from the wrong year
        // is a wrong deduction nothing downstream can catch, because by then
        // the year is whatever the document says.
        yearOutsideTaxYearRejected: () => {
            const [t] = validate({ ...minimal, entries: [{ ...partB, datePaid: '2024-12-31' }] })
            assertEq(t, 'error')
        },
        boundaryDatesWithinTheYearAccepted: () => {
            assertEq(validate({ ...minimal, entries: [{ ...partB, datePaid: '2025-01-01' }] })[0], 'ok')
            assertEq(validate({ ...minimal, entries: [{ ...partB, datePaid: '2025-12-31' }] })[0], 'ok')
        },
        nonIsoDateRejected: () => {
            assertEq(validate({ ...minimal, entries: [{ ...partB, datePaid: '03/01/2025' }] })[0], 'error')
            assertEq(validate({ ...minimal, entries: [{ ...partB, datePaid: 'March 2025' }] })[0], 'error')
        },
    },
    amounts: {
        commaGroupedRejected: () => {
            assertEq(validate({ ...minimal, entries: [{ ...partB, amount: '1,240.00' }] })[0], 'error')
        },
        canonicalAccepted: () => {
            assertEq(validate({ ...minimal, entries: [{ ...partB, amount: '1240.00' }] })[0], 'ok')
        },
    },
    // Nothing in this module totals anything: no export sums entries, and
    // the 7.5%-of-AGI floor needs an AGI this document cannot see. A stored
    // total would be a second source of truth able to disagree with the
    // entries it came from.
    noTotalIsStored: () => {
        const [t, v] = validate({ ...minimal, entries: [partB, { ...partB, datePaid: '2025-04-01' }] })
        assert(t === 'ok', ['expected ok', t, v])
        assertEq(Object.keys(v).includes('total'), false)
        assertEq(v.entries.length, 2)
    },
}
