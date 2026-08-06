/**
 * `vnd.fjs.w2` — DOC-05: the Wage and Tax Statement.
 *
 * Mirrors `vnd.fjs.1099int`'s four-stage shape (dialect -> mediaType ->
 * schema -> structural validate -> semantic `checkReferences` -> composed
 * `validate`), which is itself `fjs/media/revision`'s. Two places where a
 * W-2 needs something the 1099-INT did not, and both are the point of this
 * dialect rather than incidental detail:
 *
 * - **Box 12 is a list of `(code, amount)` pairs, not four fields.** The
 *   printed form has slots 12a–12d, but the slot number carries no meaning
 *   — the CODE does. `D` is a 401(k) deferral, `DD` is employer-sponsored
 *   health coverage (reportable, not taxable, not deductible), `W` is an
 *   HSA contribution. Modelling the slots would invite reading "box 12a" as
 *   though it meant something, and box-12 confusion is a documented model
 *   failure. A code can also legitimately repeat, which four fixed fields
 *   cannot represent at all.
 * - **Boxes 15–20 are a repeating array, stored faithfully and never
 *   computed on.** One W-2 can carry several states and several localities.
 *   They are recorded because they are on the form, not because anything
 *   here reads them: this project computes a FEDERAL return, and a state
 *   figure that silently reached a federal line would be a wrong return.
 *   That constraint is a design commitment for later phases, not something
 *   this file can enforce — nothing computes yet. The proofs below pin
 *   faithful round-tripping, including two entries for the same state,
 *   which is what "faithfully" has to mean.
 *
 * Boxes 9 and 14 are deliberately not modelled (YAGNI): box 9 is defunct,
 * and box 14 is a free-form employer field with no defined semantics —
 * modelling it would mean inventing meaning the form does not have. DOC-00's
 * spread base means adding either later is a localized change to this file.
 *
 * @module
 */
import { array, number, option, string } from 'functionalscript/fjs/types/rtti/module.f.js'
import { validate as rttiValidate } from 'functionalscript/fjs/types/rtti/validate/module.f.js'
import { error, ok } from 'functionalscript/fjs/types/result/module.f.js'
import { assert, assertEq } from 'functionalscript/fjs/asserts/module.f.js'
import { base, mediaTypeOf } from '../base/module.f.js'
import { moneyFieldError } from '../money_field/module.f.js'

/** @import { Result } from 'functionalscript/fjs/types/result/module.f.js' */
/** @import { Ts, Unknown } from 'functionalscript/fjs/types/rtti/ts/module.f.js' */
/** @import { ValidationError } from 'functionalscript/fjs/types/rtti/validate/module.f.js' */

/**
 * Format tag: names the dialect of this BLOB. The media type it is served
 * with is derived mechanically: `application/` + `dialect` + `+json`.
 */
export const dialect = 'vnd.fjs.w2'
/** The media type derived from {@link dialect}: `application/vnd.fjs.w2+json`. */
export const mediaType = mediaTypeOf(dialect)

/**
 * One box-12 entry: the printed code and its amount. `code` is the IRS
 * code letter(s) as printed (`D`, `DD`, `W`, …) and is never interpreted
 * here — this phase stores and reads.
 */
const box12Entry = /** @type {const} */ ({
    code: string,
    amount: string,
})

/**
 * One boxes-15-through-20 row: a state line and the locality line printed
 * beside it. Every field but `state` is absent-able, because the printed
 * form routinely leaves the locality half blank (DOC-11).
 */
const stateLocalEntry = /** @type {const} */ ({
    state: string,
    employerStateIdNumber: option(string),
    stateWagesTipsEtc: option(string),
    stateIncomeTax: option(string),
    localityName: option(string),
    localWagesTipsEtc: option(string),
    localIncomeTax: option(string),
})

/**
 * rtti schema for a `w2` BLOB. `dialect` is spread first (via `base`) so
 * structural validation reports it as the first failing field on a
 * mismatched blob (DOC-00's discriminant).
 *
 * The identity fields keep the family's names rather than the W-2's own —
 * `payerTin` is the employer's EIN (box b) and `recipientTin` the
 * employee's SSN (box a) — because `fjs/document/subject`'s `formSubject`
 * keys on those names for every dialect. A W-2-specific spelling here would
 * mean a W-2-specific subject derivation, and DOC-01's whole point is that
 * one convention covers the family. `accountNumber` is the control number
 * (box d), which is frequently blank; the key is always present, the value
 * may be `''`.
 */
export const w2Schema = /** @type {const} */ ({
    ...base(dialect),
    payerTin: string,
    recipientTin: string,
    accountNumber: string,
    taxYear: number,
    formRevision: string,
    corrected: option(true),
    box1WagesTipsOtherCompensation: option(string),
    box2FederalIncomeTaxWithheld: option(string),
    box3SocialSecurityWages: option(string),
    box4SocialSecurityTaxWithheld: option(string),
    box5MedicareWagesAndTips: option(string),
    box6MedicareTaxWithheld: option(string),
    box7SocialSecurityTips: option(string),
    box8AllocatedTips: option(string),
    box10DependentCareBenefits: option(string),
    box11NonqualifiedPlans: option(string),
    box12: option(array(box12Entry)),
    box13StatutoryEmployee: option(true),
    box13RetirementPlan: option(true),
    box13ThirdPartySickPay: option(true),
    box15Through20: option(array(stateLocalEntry)),
    employerName: option(string),
    employeeName: option(string),
})

/** @typedef {Ts<typeof w2Schema>} W2 */

/** Structural-only validator: checks the shape, not the semantic refinements below. */
const validateShape = rttiValidate(w2Schema)

/**
 * The scalar money boxes, walked in a loop so the exactness check is
 * written once. Typed via `@type {const}` (not a wider `keyof W2`) so
 * `r[field]` resolves to exactly `string | undefined` rather than the union
 * of every field's type — the same reason `vnd.fjs.1099int` does it this
 * way. Box 12 and boxes 15–20 carry amounts too, but nested inside arrays,
 * so they are checked separately below.
 */
const moneyBoxFields = /** @type {const} */ ([
    'box1WagesTipsOtherCompensation',
    'box2FederalIncomeTaxWithheld',
    'box3SocialSecurityWages',
    'box4SocialSecurityTaxWithheld',
    'box5MedicareWagesAndTips',
    'box6MedicareTaxWithheld',
    'box7SocialSecurityTips',
    'box8AllocatedTips',
    'box10DependentCareBenefits',
    'box11NonqualifiedPlans',
])

/**
 * Either a structural validation error or a semantic (string) error message.
 * @typedef {ValidationError | string} W2Error
 */

/**
 * Checks the semantic refinements the structural schema cannot express:
 * `formRevision` is non-empty (DOC-10), and every PRESENT amount — scalar
 * box, box-12 entry, or state/local row — is an exact decimal within safe
 * magnitude. Absent boxes are skipped, never defaulted (DOC-11).
 *
 * A box-12 entry's `code` must also be non-empty: an amount attached to no
 * code is unattributable, and box 12's entire meaning is carried by the
 * code rather than by position.
 * @type {(r: W2) => Result<W2, W2Error>}
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
    for (const entry of r.box12 ?? []) {
        if (entry.code.trim() === '') {
            return error(`box12 entry has an empty code: ${entry.amount}`)
        }
        const message = moneyFieldError(`box12 code ${entry.code}`)(entry.amount)
        if (message !== undefined) {
            return error(message)
        }
    }
    for (const entry of r.box15Through20 ?? []) {
        for (const [label, printed] of /** @type {const} */ ([
            ['stateWagesTipsEtc', entry.stateWagesTipsEtc],
            ['stateIncomeTax', entry.stateIncomeTax],
            ['localWagesTipsEtc', entry.localWagesTipsEtc],
            ['localIncomeTax', entry.localIncomeTax],
        ])) {
            if (printed === undefined) {
                continue
            }
            const message = moneyFieldError(`${entry.state} ${label}`)(printed)
            if (message !== undefined) {
                return error(message)
            }
        }
    }
    return ok(r)
}

/**
 * Validates an already-parsed JSON value as a `w2` BLOB: structural (rtti)
 * validation followed by the semantic checks in {@link checkReferences}.
 * Dialect discrimination happens exclusively through the schema's
 * exact-literal `dialect` constant — the serialized JSON text is never
 * inspected.
 * @type {(value: Unknown) => Result<W2, W2Error>}
 */
export const validate = value => {
    const [t, v] = validateShape(value)
    if (t === 'error') {
        return error(v)
    }
    return checkReferences(v)
}

// ── Tests ────────────────────────────────────────────────────────────────────

/** @type {W2} */
const minimal = {
    dialect,
    payerTin: '11-1111111',
    recipientTin: '222-22-2222',
    accountNumber: '',
    taxYear: 2025,
    formRevision: '2025',
}

export const proof = {
    dialectAndMediaType: () => {
        assertEq(dialect, 'vnd.fjs.w2')
        assertEq(mediaType, 'application/vnd.fjs.w2+json')
    },
    validate: {
        // A blank control number is a real W-2: the key is present, the
        // value is empty, and nothing else is supplied.
        minimalValidates: () => {
            const [t, v] = validate(minimal)
            assert(t === 'ok', ['expected ok', t, v])
            assertEq(v.accountNumber, '')
        },
        fullyPopulatedValidates: () => {
            const [t, v] = validate({
                ...minimal,
                corrected: true,
                box1WagesTipsOtherCompensation: '85000.00',
                box2FederalIncomeTaxWithheld: '12750.00',
                box3SocialSecurityWages: '85000.00',
                box4SocialSecurityTaxWithheld: '5270.00',
                box5MedicareWagesAndTips: '85000.00',
                box6MedicareTaxWithheld: '1232.50',
                box12: [{ code: 'D', amount: '7000.00' }, { code: 'DD', amount: '14500.00' }],
                box13RetirementPlan: true,
                employerName: 'Some Employer',
            })
            assert(t === 'ok', ['expected ok', t, v])
            assertEq(v.box12?.length, 2)
        },
        // DOC-11: every box omitted is valid, and reads back absent rather
        // than as a zero amount or a false flag.
        blankBoxesOmittedReadBackAbsent: () => {
            const [t, v] = validate(minimal)
            assert(t === 'ok', ['expected ok', t, v])
            assertEq(v.box1WagesTipsOtherCompensation, undefined)
            assertEq(v.box13RetirementPlan, undefined)
            assertEq(v.box12, undefined)
            assertEq(v.box15Through20, undefined)
        },
        // DOC-12, and the same rule for box 13's three flags: `false` is not
        // a member of `option(true)`. Absence is the only way to say "not
        // checked", so there is exactly one representation of it.
        falseFlagsRejected: () => {
            assertEq(validate({ ...minimal, corrected: false })[0], 'error')
            assertEq(validate({ ...minimal, box13RetirementPlan: false })[0], 'error')
            assertEq(validate({ ...minimal, box13StatutoryEmployee: false })[0], 'error')
            assertEq(validate({ ...minimal, box13ThirdPartySickPay: false })[0], 'error')
        },
        wrongDialectRejected: () => {
            const [t, v] = validate({ ...minimal, dialect: 'vnd.fjs.1099int' })
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
    box12: {
        // The code carries the meaning, so a repeated code must survive —
        // four fixed slot fields could not represent this at all.
        repeatedCodeIsPreserved: () => {
            const [t, v] = validate({
                ...minimal,
                box12: [{ code: 'W', amount: '1000.00' }, { code: 'W', amount: '250.00' }],
            })
            assert(t === 'ok', ['expected ok', t, v])
            assertEq(v.box12?.length, 2)
            assertEq(v.box12?.[0]?.amount, '1000.00')
            assertEq(v.box12?.[1]?.amount, '250.00')
        },
        // An amount attached to no code is unattributable.
        emptyCodeRejected: () => {
            const [t] = validate({ ...minimal, box12: [{ code: '', amount: '100.00' }] })
            assertEq(t, 'error')
        },
        inexactAmountRejected: () => {
            const [t] = validate({ ...minimal, box12: [{ code: 'D', amount: '1,000.00' }] })
            assertEq(t, 'error')
        },
    },
    box15Through20: {
        // "Faithfully" has to mean this: several rows, including two for the
        // SAME state, round-tripping in order with nothing merged or summed.
        multipleRowsIncludingRepeatedStateRoundTrip: () => {
            const rows = [
                { state: 'CA', stateWagesTipsEtc: '85000.00', stateIncomeTax: '4200.00' },
                { state: 'CA', stateWagesTipsEtc: '1000.00', stateIncomeTax: '50.00' },
                { state: 'NY', stateWagesTipsEtc: '2000.00', localityName: 'NYC', localIncomeTax: '75.00' },
            ]
            const [t, v] = validate({ ...minimal, box15Through20: rows })
            assert(t === 'ok', ['expected ok', t, v])
            assertEq(v.box15Through20?.length, 3)
            assertEq(v.box15Through20?.[0]?.stateWagesTipsEtc, '85000.00')
            assertEq(v.box15Through20?.[1]?.stateWagesTipsEtc, '1000.00')
            assertEq(v.box15Through20?.[2]?.localityName, 'NYC')
            // The two CA rows stay two rows. Nothing here adds them up.
            assertEq(v.box15Through20?.[0]?.state, v.box15Through20?.[1]?.state)
        },
        // The locality half of a row is routinely blank on the printed form.
        localityHalfAbsentIsValid: () => {
            const [t, v] = validate({ ...minimal, box15Through20: [{ state: 'TX' }] })
            assert(t === 'ok', ['expected ok', t, v])
            assertEq(v.box15Through20?.[0]?.localityName, undefined)
            assertEq(v.box15Through20?.[0]?.stateIncomeTax, undefined)
        },
        inexactAmountRejected: () => {
            const [t] = validate({ ...minimal, box15Through20: [{ state: 'CA', stateIncomeTax: '4,200.00' }] })
            assertEq(t, 'error')
        },
    },
    checkReferences: {
        emptyFormRevisionRejected: () => {
            assertEq(validate({ ...minimal, formRevision: '' })[0], 'error')
        },
        commaGroupedMoneyRejected: () => {
            assertEq(validate({ ...minimal, box1WagesTipsOtherCompensation: '85,000.00' })[0], 'error')
        },
    },
}
