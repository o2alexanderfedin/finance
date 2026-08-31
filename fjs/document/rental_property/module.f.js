/**
 * `vnd.fjs.rental_property` — ONE printed Schedule E Part I column: one rental
 * real estate property, or one royalty property.
 *
 * Spec: [../../schedule/e/todo/schedule-e-part-i-rental-and-royalties.md](../../schedule/e/todo/schedule-e-part-i-rental-and-royalties.md),
 * written before this file, with every field's citation to the printed 2025
 * `f1040se.pdf` face and `i1040se.pdf` instructions.
 *
 * ## A taxpayer-asserted dialect, like `vnd.fjs.business_expenses`
 *
 * No payer files an information return for a landlord's rents. `i1040se` p6
 * notes that $10 or more of royalties *should* bring a Form 1099-MISC, and
 * there is no `vnd.fjs.1099misc` dialect in this repository, so a royalty is
 * taxpayer-asserted here too. That puts this dialect in the same category as
 * `vnd.fjs.business_expenses`, `vnd.fjs.medical_expenses`, `vnd.fjs.adjustments`
 * and `vnd.fjs.asset_register`: **no `formRevision`, no `payerTin`.**
 *
 * ## Why this is not `vnd.fjs.business_expenses` with more categories
 *
 * The entry SHAPE is copied from that dialect unchanged —
 * `{ category, datePaid, description, amount }`, with `category` a free
 * `string` here and constrained one layer out, because rtti has no enum and an
 * unrecognized value must be REFUSED by name rather than coerced. The container
 * cannot be shared, and the three reasons are all printed:
 *
 * 1. Lines 1a, 1b and 2 are per PROPERTY, and a Schedule C record has no
 *    property to hang an address, a type code or a day count on.
 * 2. The cardinality is opposite. `fjs/schedule/c` refuses a SECOND
 *    `vnd.fjs.business_expenses` because Schedule C is filed per business;
 *    i1040se p2 tells a filer with more than three properties to attach more
 *    Schedules E and combine lines 23a-26 on one of them. Many documents, one
 *    total, is what this form asks for.
 * 3. Printed lines 23c and 23d are cross-property totals of two INDIVIDUAL
 *    expense lines — 12 and 18 — so the category vocabulary has to name printed
 *    lines whether or not it lives here.
 *
 * ## `accountNumber` is the property key, and it is also the register's
 *
 * DOC-01's subject key is what binds a `vnd.fjs.asset_register` to the activity
 * it depreciates. `fjs/schedule/c` already matches a register's
 * `accountNumber` against a business's; `fjs/schedule/e/part_i` matches it
 * against a property's, and that match is how printed line 18 gets its Form
 * 4562 line 22. Two documents sharing an `accountNumber` are refused one layer
 * out, where the message can name the printed table.
 *
 * ## What the `royalties` type switches off, and why it is not a second dialect
 *
 * i1040se p4: *"For royalty property, enter code '6' on line 1b and leave lines
 * 1a and 2 blank for that property."* So a royalty column has no address, no
 * fair rental days, no personal use days and no line 3 — and it has a line 4,
 * which nothing else has. {@link checkReferences} enforces exactly that
 * partition in both directions: a royalty carrying a personal-use day count is
 * refused as surely as a residence missing one.
 *
 * Splitting it into a second dialect was considered and rejected: printed Part
 * I is ONE table with ONE type-code column, and lines 20 through 26 treat the
 * two identically apart from line 22. Two dialects would duplicate the whole
 * expense block to express one printed code.
 *
 * ## Printed lines A and B are deliberately absent
 *
 * They ask whether the filer made payments requiring a Form 1099 and whether
 * they filed them. Neither feeds any arithmetic on the page. A stored field no
 * line can read is the `box13StatutoryEmployee` defect this repository has
 * already shipped once, so they are not stored.
 *
 * @module
 */
import { array, number, open, option, or, string } from 'functionalscript/fjs/rtti/module.f.mjs'
import { validate as rttiValidate } from 'functionalscript/fjs/rtti/validate/module.f.mjs'
import { error, ok } from 'functionalscript/fjs/types/result/module.f.mjs'
import { assert, assertEq } from 'functionalscript/fjs/asserts/module.f.mjs'
import { centsFromString } from '../../exact/module.f.js'
import { base, mediaTypeOf } from '../base/module.f.js'
import { moneyFieldError } from '../money_field/module.f.js'

/** @import { Result } from 'functionalscript/fjs/types/result/types.js' */
/** @import { Ts, Unknown } from 'functionalscript/fjs/rtti/ts/types.js' */
/** @import { ValidationError } from 'functionalscript/fjs/rtti/common/types.js' */
/** @import { SubjectKey } from '../subject/module.f.js' */

/**
 * Format tag: names the dialect of this BLOB. The media type it is served
 * with is derived mechanically: `application/` + `dialect` + `+json`.
 */
export const dialect = 'vnd.fjs.rental_property'
/** The media type derived from {@link dialect}: `application/vnd.fjs.rental_property+json`. */
export const mediaType = mediaTypeOf(dialect)

/**
 * The eight printed *"Type of Property"* codes, in the printed order, as names
 * rather than as the digits 1-8.
 *
 * The digit is what a filer writes in printed column 1b; the NAME is what a
 * refusal can quote back readably, and what `tsc` can narrow. A stored `'3'`
 * would be indistinguishable from a transcription slip, and a stored `3`
 * (a number) would collide with `fairRentalDays` in every message.
 *
 * `royalties` is code 6, and it is the one value that changes which other
 * fields are permitted — see this module's docstring.
 */
export const propertyTypeValues = /** @type {const} */ ([
    'singleFamilyResidence',
    'multiFamilyResidence',
    'vacationOrShortTermRental',
    'commercial',
    'land',
    'royalties',
    'selfRental',
    'other',
])

/**
 * One expense the taxpayer asserts they paid or incurred for this property.
 * `vnd.fjs.business_expenses`' entry shape, field for field.
 */
const expenseEntry = open({
    category: string,
    datePaid: string,
    description: string,
    amount: string,
})

/**
 * rtti schema for a `rental_property` BLOB. `dialect` is spread first (via
 * `base`) so structural validation reports it as the first failing field on a
 * mismatched blob (DOC-00's discriminant).
 *
 * `fairRentalDays` and `personalUseDays` are `or(option, number)` rather than
 * required numbers because printed line 2 is genuinely BLANK for a royalty,
 * and a materialized `0` there would assert "rented at fair rental value for
 * no days", which is a different claim about a different kind of property.
 */
export const rentalPropertySchema = open({
    ...base(dialect),
    recipientTin: string,
    accountNumber: string,
    taxYear: number,
    corrected: or(option, true),
    propertyType: string,
    otherTypeDescription: or(option, string),
    physicalAddress: or(option, string),
    fairRentalDays: or(option, number),
    personalUseDays: or(option, number),
    qualifiedJointVenture: or(option, true),
    rentsReceived: or(option, string),
    royaltiesReceived: or(option, string),
    entries: array(expenseEntry),
})

/**
 * FORM-KEY-01 -- which of THIS dialect's OWN fields play the five roles a
 * form subject is keyed on. See `fjs/document/subject`'s {@link SubjectKey}
 * for why the dialect declares this instead of every caller assuming one
 * shared set of field names.
 *
 * No payer role: this dialect has no such field, and an omitted role
 * derives the empty string -- exactly the `payerTin: ''` /
 * `accountNumber: ''` this dialect's subject has carried since DOC-01.
 * @type {SubjectKey}
 */
export const subjectKey = { formType: 'dialect', taxYear: 'taxYear', recipient: 'recipientTin', account: 'accountNumber' }

/** @typedef {Ts<typeof rentalPropertySchema>} RentalProperty */
/** @typedef {RentalProperty['entries'][number]} RentalExpenseEntry */

/** Structural-only validator: checks the shape, not the semantic refinements below. */
const validateShape = rttiValidate(rentalPropertySchema)

/**
 * Either a structural validation error or a semantic (string) error message.
 * @typedef {ValidationError | string} RentalPropertyError
 */

/**
 * An ISO calendar date, `YYYY-MM-DD` — the identical expression
 * `vnd.fjs.business_expenses`, `vnd.fjs.medical_expenses` and
 * `vnd.fjs.adjustments` all use.
 * @type {RegExp}
 */
const isoDate = /^(\d{4})-(\d{2})-(\d{2})$/

/**
 * The most days either count can carry. A leap year has 366, and printed line 2
 * counts DAYS IN THE YEAR — `i1040se` p5: *"report the number of days in the
 * year each property was rented at fair rental value and the number of days of
 * personal use"*.
 *
 * A named constant rather than a literal in the comparison, and 366 rather than
 * 365 in every year: this dialect does not know whether its `taxYear` is a leap
 * year, and refusing a legitimate 366 in one would be worse than admitting an
 * impossible 366 in another. The sum of the two is bounded by the same number
 * for the reason the printed page implies and never states — a day is either
 * rented at fair value or used personally or neither, never two of those.
 * @type {number}
 */
export const daysInTheLongestYear = 366

/**
 * Checks the semantic refinements the structural schema cannot express. In
 * order, and each refusal names the offending VALUE:
 *
 * 1. `propertyType` is in {@link propertyTypeValues}.
 * 2. `otherTypeDescription` is present exactly when the type is `other` —
 *    printed code 8 is *"Other (describe)"*, and a description on any other
 *    code describes nothing.
 * 3. The **royalty partition**. A `royalties` property has no
 *    `physicalAddress`, no `fairRentalDays`, no `personalUseDays` and no
 *    `rentsReceived`, and it MUST have `royaltiesReceived`. Every other type is
 *    the exact mirror. See this module's docstring for the citation.
 * 4. Both day counts are integers in `0 .. 366` and their sum is at most 366.
 * 5. `accountNumber` is not empty or whitespace-only — it is the string that
 *    binds an asset register to this property and that a duplicate-property
 *    refusal quotes.
 * 6. Every money field is an exact decimal within safe magnitude and is NOT
 *    negative. Rents received and royalties received are gross receipts, not
 *    signed figures, and an expense that was refunded is netted in the
 *    taxpayer's own records before it reaches this document — the identical
 *    argument `vnd.fjs.business_expenses` makes at its own `amount`.
 * 7. Every `datePaid` is an ISO `YYYY-MM-DD` date whose YEAR is the document's
 *    own `taxYear`.
 *
 * `category` is NOT checked here. The vocabulary is printed Schedule E Part I's
 * own expense lines, and deciding which printed line a category reaches is
 * deduction logic — `fjs/schedule/e/part_i` owns it, exactly as
 * `fjs/schedule/c` owns `vnd.fjs.business_expenses`' categories.
 * @type {(r: RentalProperty) => Result<RentalProperty, RentalPropertyError>}
 */
export const checkReferences = r => {
    if (!propertyTypeValues.some(candidate => candidate === r.propertyType)) {
        return error(
            `propertyType ${JSON.stringify(r.propertyType)} is not one of `
            + `${propertyTypeValues.join(', ')} — printed Schedule E line 1b takes one of eight `
            + `codes from the list under Part I, and this field names them rather than storing the `
            + `digit, so a transcription slip cannot pass as a type`)
    }
    const isRoyalty = r.propertyType === 'royalties'
    if ((r.otherTypeDescription === undefined) === (r.propertyType === 'other')) {
        return error(
            `otherTypeDescription must be present exactly when propertyType is "other" — printed `
            + `code 8 is "Other (describe)", and this record has propertyType `
            + `${JSON.stringify(r.propertyType)} with otherTypeDescription `
            + `${JSON.stringify(r.otherTypeDescription)}`)
    }
    // 3. The royalty partition, in both directions. Written as a table so the
    //    two arms cannot drift apart: each row names the field, its value, and
    //    whether a ROYALTY may carry it.
    for (const [name, value, royaltyMayCarryIt] of /** @type {readonly (readonly [string, unknown, boolean])[]} */ ([
        ['physicalAddress', r.physicalAddress, false],
        ['fairRentalDays', r.fairRentalDays, false],
        ['personalUseDays', r.personalUseDays, false],
        ['rentsReceived', r.rentsReceived, false],
        ['royaltiesReceived', r.royaltiesReceived, true],
    ])) {
        const permitted = isRoyalty === royaltyMayCarryIt
        if (permitted && value === undefined) {
            return error(
                `${name} is required on a ${r.propertyType} property. Printed Schedule E Part I `
                + `asks for the physical address on line 1a, the fair rental and personal use days `
                + `on line 2, the rents on line 3 and the royalties on line 4 — and i1040se p4 `
                + `says a royalty property fills in line 4 and leaves lines 1a and 2 blank, which `
                + `is the whole of the difference between the two kinds of column`)
        }
        if (!permitted && value !== undefined) {
            return error(
                `${name} must be absent on a ${r.propertyType} property, and this record carries `
                + `${JSON.stringify(value)}. i1040se p4: "For royalty property, enter code 6 on `
                + `line 1b and leave lines 1a and 2 blank for that property" — a royalty is not a `
                + `dwelling unit, so it has no address, no day counts and no rents, and a rental `
                + `column has no line 4`)
        }
    }
    for (const [name, days] of /** @type {readonly (readonly [string, number | undefined])[]} */ ([
        ['fairRentalDays', r.fairRentalDays],
        ['personalUseDays', r.personalUseDays],
    ])) {
        if (days === undefined) {
            continue
        }
        if (!Number.isInteger(days) || days < 0 || days > daysInTheLongestYear) {
            return error(
                `${name} ${days} is not a whole number of days in 0..${daysInTheLongestYear} — `
                + `printed line 2 counts days in the year, and §280A(d)(1) compares personal use `
                + `against 14 days and against 10% of the fair rental days, so a fractional or `
                + `out-of-range count would decide that comparison on a number that is not a day `
                + `count at all`)
        }
    }
    const fair = r.fairRentalDays
    const personal = r.personalUseDays
    if (fair !== undefined && personal !== undefined && fair + personal > daysInTheLongestYear) {
        return error(
            `fairRentalDays ${fair} plus personalUseDays ${personal} is `
            + `${fair + personal}, more than the ${daysInTheLongestYear} days a year holds — a `
            + `day is rented at fair rental value, or used personally, or neither, and never two `
            + `of those, so the two counts cannot overlap`)
    }
    if (r.accountNumber.trim() === '') {
        return error(
            `accountNumber must not be empty or whitespace-only — it is what identifies this `
            + `property, what a vnd.fjs.asset_register must match for its Form 4562 line 22 to `
            + `reach printed line 18, and what a duplicate-property refusal quotes`)
    }
    for (const [name, value] of /** @type {readonly (readonly [string, string | undefined])[]} */ ([
        ['rentsReceived', r.rentsReceived],
        ['royaltiesReceived', r.royaltiesReceived],
    ])) {
        if (value === undefined) {
            continue
        }
        const message = moneyFieldError(name)(value)
        if (message !== undefined) {
            return error(message)
        }
        if (centsFromString(value) < 0n) {
            return error(
                `${name} ${value} is negative — printed lines 3 and 4 are GROSS receipts, and a `
                + `negative one would net a return of rent against the rent itself somewhere no `
                + `printed line can show it. A refunded deposit reduces the receipt in the `
                + `taxpayer's own records before it reaches this document`)
        }
    }
    for (const entry of r.entries) {
        const m = isoDate.exec(entry.datePaid)
        if (m === null) {
            return error(`datePaid is not an ISO YYYY-MM-DD date: ${entry.datePaid}`)
        }
        const [, year] = m
        if (year !== String(r.taxYear)) {
            return error(
                `datePaid ${entry.datePaid} for ${entry.description} is not in tax year `
                + `${r.taxYear} — a rental expense is deducted in the year it was paid or `
                + `incurred, and printed lines 5 through 19 carry one year's`)
        }
        const amountMessage = moneyFieldError(
            `amount for ${entry.description} on ${entry.datePaid}`)(entry.amount)
        if (amountMessage !== undefined) {
            return error(amountMessage)
        }
        if (centsFromString(entry.amount) < 0n) {
            return error(
                `amount ${entry.amount} for ${entry.description} is negative — a refund or rebate `
                + `reduces the expense it relates to before it reaches this record, and a negative `
                + `expense entry would book income onto a printed line 5-19 where nothing reads it`)
        }
    }
    return ok(r)
}

/**
 * Validates an already-parsed JSON value as a `rental_property` BLOB:
 * structural (rtti) validation followed by {@link checkReferences}. Dialect
 * discrimination happens exclusively through the schema's exact-literal
 * `dialect` constant — the serialized JSON text is never inspected.
 * @type {(value: Unknown) => Result<RentalProperty, RentalPropertyError>}
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
 * A single-family residence with no personal use — the case Part I computes.
 * @type {RentalProperty}
 */
export const minimalRentalProperty = {
    dialect,
    recipientTin: '222-22-2222',
    accountNumber: 'RENT-0001',
    taxYear: 2025,
    propertyType: 'singleFamilyResidence',
    physicalAddress: '18 Alder Street, Wells, ME 04090',
    fairRentalDays: 365,
    personalUseDays: 0,
    rentsReceived: '24000.00',
    entries: [],
}

/**
 * A royalty column: printed code 6, line 4, and nothing else.
 * @type {RentalProperty}
 */
export const minimalRoyaltyProperty = {
    dialect,
    recipientTin: '222-22-2222',
    accountNumber: 'ROY-0001',
    taxYear: 2025,
    propertyType: 'royalties',
    royaltiesReceived: '3200.00',
    entries: [],
}

/** An ordinary printed line 16 expense. */
const propertyTax = {
    category: 'taxes',
    datePaid: '2025-09-30',
    description: 'town of Wells property tax',
    amount: '3180.00',
}

export const proof = {
    dialectAndMediaType: () => {
        assertEq(dialect, 'vnd.fjs.rental_property')
        assertEq(mediaType, 'application/vnd.fjs.rental_property+json')
    },
    // Eight printed codes, hand-counted off the printed list under Part I:
    // "1 Single Family Residence ... 8 Other (describe)". Deliberately NOT
    // `propertyTypeValues.length` compared against itself.
    eightPrintedTypeCodes: () => {
        assertEq(propertyTypeValues.length, 8)
        assertEq(new Set(propertyTypeValues).size, 8)
        assertEq(propertyTypeValues[5], 'royalties', 'printed code 6')
        assertEq(propertyTypeValues[0], 'singleFamilyResidence', 'printed code 1')
        assertEq(propertyTypeValues[7], 'other', 'printed code 8')
    },
    validate: {
        minimalRentalValidates: () => {
            const [t, v] = validate(minimalRentalProperty)
            assert(t === 'ok', ['expected ok', t, v])
            assertEq(v.entries.length, 0)
            assertEq(v.fairRentalDays, 365)
            assertEq(v.personalUseDays, 0)
            assertEq(v.royaltiesReceived, undefined)
            assertEq(v.qualifiedJointVenture, undefined)
        },
        minimalRoyaltyValidates: () => {
            const [t, v] = validate(minimalRoyaltyProperty)
            assert(t === 'ok', ['expected ok', t, v])
            assertEq(v.physicalAddress, undefined)
            assertEq(v.fairRentalDays, undefined)
            assertEq(v.personalUseDays, undefined)
            assertEq(v.rentsReceived, undefined)
            assertEq(v.royaltiesReceived, '3200.00')
        },
        populatedRoundTrips: () => {
            const [t, v] = validate({
                ...minimalRentalProperty,
                corrected: true,
                qualifiedJointVenture: true,
                entries: [propertyTax],
            })
            assert(t === 'ok', ['expected ok', t, v])
            assertEq(v.corrected, true)
            assertEq(v.qualifiedJointVenture, true)
            assertEq(v.entries.length, 1)
            const [only] = v.entries
            assert(only !== undefined, ['expected the entry', v.entries])
            assertEq(only.amount, '3180.00')
            assertEq(only.category, 'taxes')
        },
        // Code 8 needs its description, and nothing else may carry one.
        otherNeedsItsDescription: () => {
            const [t, v] = validate({ ...minimalRentalProperty, propertyType: 'other' })
            assert(t === 'error', ['expected a refusal', t, v])
            assert(typeof v === 'string' && v.includes('otherTypeDescription'), ['expected the field named', v])
            const [t2, v2] = validate({
                ...minimalRentalProperty, propertyType: 'other', otherTypeDescription: 'billboard site',
            })
            assert(t2 === 'ok', ['expected ok', t2, v2])
            // The control in the other direction.
            const [t3, v3] = validate({ ...minimalRentalProperty, otherTypeDescription: 'billboard site' })
            assert(t3 === 'error', ['a description on code 1 describes nothing', t3, v3])
        },
        unknownTypeRefusesByName: () => {
            const [t, v] = validate({ ...minimalRentalProperty, propertyType: 'condominium' })
            assert(t === 'error', ['expected a refusal', t, v])
            assert(typeof v === 'string' && v.includes('"condominium"'), ['expected the value quoted', v])
            assert(typeof v === 'string' && v.includes('line 1b'), ['expected the printed line named', v])
        },
        // The royalty partition, both directions, field by field. Ten cases,
        // hand-typed: five fields x two directions.
        theRoyaltyPartitionIsEnforcedBothWays: () => {
            /** @type {readonly (readonly [Unknown, string])[]} */
            const rejected = [
                [{ ...minimalRoyaltyProperty, physicalAddress: '1 Oil Road' }, 'physicalAddress'],
                [{ ...minimalRoyaltyProperty, fairRentalDays: 30 }, 'fairRentalDays'],
                [{ ...minimalRoyaltyProperty, personalUseDays: 0 }, 'personalUseDays'],
                [{ ...minimalRoyaltyProperty, rentsReceived: '100.00' }, 'rentsReceived'],
                [{ ...minimalRentalProperty, royaltiesReceived: '100.00' }, 'royaltiesReceived'],
            ]
            assertEq(rejected.length, 5)
            for (const [value, field] of rejected) {
                const [t, v] = validate(value)
                assert(t === 'error', ['expected a refusal', field, t, v])
                assert(typeof v === 'string' && v.includes(field), ['expected the field named', field, v])
                assert(typeof v === 'string' && v.includes('must be absent'), ['expected the direction stated', field, v])
            }
            // A required field going missing is the key ABSENT. Spreading
            // `field: undefined` leaves the key present, which since 0.48.0 rtti
            // refuses structurally — the leaf would then read a `no match` array
            // instead of the "is required" prose it exists to check.
            const { physicalAddress: _noAddress, ...withoutAddress } = minimalRentalProperty
            const { fairRentalDays: _noFairDays, ...withoutFairRentalDays } = minimalRentalProperty
            const { personalUseDays: _noUseDays, ...withoutPersonalUseDays } = minimalRentalProperty
            const { rentsReceived: _noRents, ...withoutRentsReceived } = minimalRentalProperty
            const { royaltiesReceived: _noRoyalties, ...withoutRoyalties } = minimalRoyaltyProperty
            /** @type {readonly (readonly [Unknown, string])[]} */
            const missing = [
                [withoutAddress, 'physicalAddress'],
                [withoutFairRentalDays, 'fairRentalDays'],
                [withoutPersonalUseDays, 'personalUseDays'],
                [withoutRentsReceived, 'rentsReceived'],
                [withoutRoyalties, 'royaltiesReceived'],
            ]
            assertEq(missing.length, 5)
            for (const [value, field] of missing) {
                const [t, v] = validate(value)
                assert(t === 'error', ['expected a refusal', field, t, v])
                assert(typeof v === 'string' && v.includes(field), ['expected the field named', field, v])
                assert(typeof v === 'string' && v.includes('is required'), ['expected the direction stated', field, v])
            }
        },
        dayCountsAreWholeAndInRange: () => {
            for (const days of [-1, 367, 12.5]) {
                const [t, v] = validate({ ...minimalRentalProperty, fairRentalDays: days, personalUseDays: 0 })
                assert(t === 'error', ['expected a refusal', days, t, v])
                assert(typeof v === 'string' && v.includes('fairRentalDays'), ['expected the field named', v])
            }
            // The control: 366 is legal, and so is 0.
            const [t, v] = validate({ ...minimalRentalProperty, fairRentalDays: 366, personalUseDays: 0 })
            assert(t === 'ok', ['366 days is a leap year, not an error', t, v])
            const [t2, v2] = validate({ ...minimalRentalProperty, fairRentalDays: 0, personalUseDays: 0 })
            assert(t2 === 'ok', ['a property held for rent all year and never let is not an error', t2, v2])
        },
        theTwoDayCountsCannotOverlap: () => {
            const [t, v] = validate({ ...minimalRentalProperty, fairRentalDays: 200, personalUseDays: 200 })
            assert(t === 'error', ['expected a refusal', t, v])
            assert(typeof v === 'string' && v.includes('400'), ['expected the sum quoted', v])
            // The control: 200 + 166 = 366 exactly, and it passes.
            const [t2, v2] = validate({ ...minimalRentalProperty, fairRentalDays: 200, personalUseDays: 166 })
            assert(t2 === 'ok', ['366 is the boundary and it is inclusive', t2, v2])
        },
        blankAccountNumberRefuses: () => {
            const [t, v] = validate({ ...minimalRentalProperty, accountNumber: '   ' })
            assert(t === 'error', ['expected a refusal', t, v])
            assert(typeof v === 'string' && v.includes('accountNumber'), ['expected the field named', v])
        },
        negativeMoneyRefusesByName: () => {
            const [t, v] = validate({ ...minimalRentalProperty, rentsReceived: '-100.00' })
            assert(t === 'error', ['expected a refusal', t, v])
            assert(typeof v === 'string' && v.includes('-100.00'), ['expected the amount quoted', v])
            const [t2, v2] = validate({ ...minimalRoyaltyProperty, royaltiesReceived: '-1.00' })
            assert(t2 === 'error', ['expected a refusal', t2, v2])
            assert(typeof v2 === 'string' && v2.includes('royaltiesReceived'), ['expected the field named', v2])
            const [t3, v3] = validate({
                ...minimalRentalProperty, entries: [{ ...propertyTax, amount: '-5.00' }],
            })
            assert(t3 === 'error', ['expected a refusal', t3, v3])
            assert(typeof v3 === 'string' && v3.includes('town of Wells property tax'),
                ['expected the entry named', v3])
        },
        datePaidMustBeInTheDocumentsTaxYear: () => {
            const [t, v] = validate({
                ...minimalRentalProperty, entries: [{ ...propertyTax, datePaid: '2024-09-30' }],
            })
            assert(t === 'error', ['expected a refusal', t, v])
            assert(typeof v === 'string' && v.includes('2024-09-30'), ['expected the date quoted', v])
            const [t2, v2] = validate({
                ...minimalRentalProperty, entries: [{ ...propertyTax, datePaid: '30/09/2025' }],
            })
            assert(t2 === 'error', ['expected a refusal', t2, v2])
            assert(typeof v2 === 'string' && v2.includes('ISO'), ['expected the format named', v2])
        },
        // DOC-00: another dialect's blob is rejected structurally, on the
        // discriminant, before any semantic check runs.
        anotherDialectsBlobIsRejectedOnTheDiscriminant: () => {
            const [t, v] = validate({ ...minimalRentalProperty, dialect: 'vnd.fjs.business_expenses' })
            assert(t === 'error', ['expected a refusal', t, v])
            assert(typeof v !== 'string', ['expected a STRUCTURAL error, not a semantic one', v])
        },
        // `category` is deliberately NOT constrained here. The control that
        // says so: a category no printed line names still validates, and
        // `fjs/schedule/e/part_i` is what refuses it.
        anUnknownCategoryIsNotThisModulesBusiness: () => {
            const [t, v] = validate({
                ...minimalRentalProperty, entries: [{ ...propertyTax, category: 'moonBeams' }],
            })
            assert(t === 'ok', ['the category vocabulary lives one layer out', t, v])
        },
    },
}
