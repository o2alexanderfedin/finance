/**
 * `vnd.fjs.asset_register` — the per-asset basis, method and
 * placed-in-service history that six separate refusals in this engine name as
 * their blocker, and that nothing here has held until now.
 *
 * Sources, fetched and read directly (2026-08-18), not from recall:
 * - `https://www.irs.gov/pub/irs-pdf/f4562.pdf` — Form 4562 (2025),
 *   *Depreciation and Amortization*, Cat. No. 12906N.
 * - `https://www.irs.gov/pub/irs-pdf/i4562.pdf` — its 2025 instructions.
 * - `https://www.irs.gov/pub/irs-pdf/p946.pdf` — Publication 946 (2025).
 *
 * The full argument, field by field, is in
 * `fjs/form4562/todo/depreciation-and-the-asset-register.md`. The claims that
 * decide this dialect's SHAPE are repeated here.
 *
 * ## It is taxpayer-asserted, like `vnd.fjs.business_expenses`
 *
 * **No information return reports depreciation.** No payer files one, and
 * nothing arrives in the mail shaped like Form 4562 — the same opening
 * `vnd.fjs.business_expenses`, `vnd.fjs.medical_expenses` and
 * `vnd.fjs.adjustments` all make, for the same reason. So there is no
 * `formRevision` (DOC-10 exists because box semantics drift between revisions
 * of a printed form; nothing here is transcribed from a payer's copy), no
 * `payerTin`, and no total: every Form 4562 line total belongs to
 * `fjs/form4562`.
 *
 * ## One document is one BUSINESS OR ACTIVITY
 *
 * i4562 p1: *"File a separate Form 4562 for each business or activity on your
 * return for which Form 4562 is required."* So the cardinality is
 * `vnd.fjs.business_expenses`', not `vnd.fjs.adjustments`': `accountNumber`
 * carries the business's own identifier under DOC-01's subject key, and it is
 * the value `fjs/schedule/c` MATCHES against the business expense record's.
 * `businessOrActivity` is the printed header field *"Business or activity to
 * which this form relates"*, in prose.
 *
 * A register whose `accountNumber` names no business this engine computes is
 * REFUSED rather than ignored — a rental property's register is the case that
 * matters, and silently dropping it would compute a Schedule C that is right
 * and a Schedule E that is missing.
 *
 * ## Prior-year accumulated depreciation is NOT a field, and that is the
 * design decision worth reading
 *
 * The obvious register carries each asset's accumulated depreciation. It is
 * not needed. Publication 946's Table A-1 says why in its own header:
 * *"Multiply your property's unadjusted basis each year by the percentage."*
 * The percentage for recovery year *n* is fully determined by the
 * classification, the method, the convention and the month placed in service,
 * so this year's deduction is a function of the UNADJUSTED basis and the
 * elapsed years — never of what was actually deducted. `fjs/form4562/macrs`
 * derives that schedule and checks it against 444 hand-typed printed cells.
 *
 * What genuinely is not derivable is how much of the basis §179 and §168(k)
 * removed in the placed-in-service year, because both are ELECTIONS. Those two
 * are printed figures on the taxpayer's own earlier Form 4562, which is
 * exactly the transcription `vnd.fjs.prior_year_ira_basis` already does for
 * Form 8606 line 14.
 *
 * ## `section168kStatus` — a legal status, in the `specifiedServiceTrade\
 * OrBusiness` shape
 *
 * The special depreciation allowance is not a computation this engine can
 * perform: i4562 pp5-7 make the applicable percentage turn on the ACQUISITION
 * date (100% after 19 January 2025; 40%, or 60% for a long production period
 * or certain aircraft, for property acquired after 27 September 2017 and
 * before 20 January 2025; 50% for reuse-and-recycling property), on six
 * exclusions, and on a class-wide election-out statement attached to the
 * return. None of that is derivable from a basis and a date.
 *
 * It is also what switches the AMT depreciation adjustment off, and i4562 p7
 * says so twice — once for each arm:
 *
 * > *"Caution: If you take the special depreciation allowance … you will not
 * > have any AMT adjustment for depreciation for the qualified property."*
 *
 * > *"Note: If you elect to not have any special depreciation allowance apply,
 * > the property placed in service during the tax year will not be subject to
 * > an AMT adjustment for depreciation."*
 *
 * So the status is stored as one of THREE exact strings, in the frozen-
 * vocabulary shape `vnd.fjs.business_expenses`' `specifiedServiceTradeOr\
 * Business` already uses — a string rather than a boolean precisely so a
 * serializer's `''` or a hand-edited `'true'` cannot become an assertion.
 *
 * ## The three certifications, and why each is `or(option, true)`
 *
 * DOC-12's checkbox convention: a stored `false` is structurally rejected and
 * absence is the only way to say "no", so a serializer that materializes every
 * key cannot smuggle a false assertion in as a true one.
 *
 * - `everyDepreciableAssetIsListed`. The mid-quarter convention is decided by
 *   an AGGREGATE over the whole year's additions (i4562 p11: *"If the total
 *   depreciable bases … placed in service during the last 3 months … exceed
 *   40% of the total … during the entire tax year"*). A register missing one
 *   November machine flips the answer for every other asset in it, in either
 *   direction, and nothing in the data says so.
 * - `noDepreciablePropertyDisposedOfDuringTheYear`. A disposal needs Step 3's
 *   disposal decimal AND §1245/§1250 recapture on Form 4797.
 *
 *   **NARROWED.** Both exist now: `fjs/form4562/macrs`'s
 *   `disposalTwentyFourths` is Step 3's second printed column, and
 *   `fjs/form4797` is the recapture. So a register may now RECORD a disposal,
 *   in the per-asset {@link registeredAsset} `disposal` block, and Form 4562
 *   requires this certification only when NO asset carries one — the shape
 *   `everyDepreciableAssetIsListed` already has, required exactly when the
 *   facts make it load-bearing. The two cannot both be true, and
 *   {@link checkReferences} refuses the contradiction by name. See
 *   [../../form4797/todo/sales-of-business-property.md](../../form4797/todo/sales-of-business-property.md).
 * - `priorYearSection179CarryoverIsZero`. Form 4562 line 10 is *"Carryover of
 *   disallowed deduction from line 13 of your 2024 Form 4562"* — a prior-year
 *   figure. It is a CHECKBOX rather than an amount because a non-zero
 *   carryover refuses anyway: releasing it needs line 11's business income
 *   limitation, which is the line Part I cannot compute.
 *
 * All three are read by `fjs/form4562`, which refuses by name without them.
 *
 * @module
 */
import { array, number, open, option, or, string } from 'functionalscript/fjs/rtti/module.f.mjs'
import { validate as rttiValidate } from 'functionalscript/fjs/rtti/validate/module.f.mjs'
import { error, ok } from 'functionalscript/fjs/types/result/module.f.mjs'
import { assert, assertEq } from 'functionalscript/fjs/asserts/module.f.mjs'
import { centsFromString } from '../../exact/module.f.js'
import { tryParse, parse } from '../../types/decimal/module.f.js'
import { base, mediaTypeOf } from '../base/module.f.js'
import { moneyFieldError } from '../money_field/module.f.js'
import {
    macrsClassifications, macrsClassificationNames, macrsMethods, macrsConventions,
} from '../../form4562/macrs/module.f.js'

/** @import { Result } from 'functionalscript/fjs/types/result/types.js' */
/** @import { Ts, Unknown } from 'functionalscript/fjs/rtti/ts/types.js' */
/** @import { ValidationError } from 'functionalscript/fjs/rtti/common/types.js' */
/** @import { DepreciableAsset } from '../../form4562/module.f.js' */
/** @import { SubjectKey } from '../subject/module.f.js' */

/**
 * Format tag: names the dialect of this BLOB. The media type it is served
 * with is derived mechanically: `application/` + `dialect` + `+json`.
 */
export const dialect = 'vnd.fjs.asset_register'
/** The media type derived from {@link dialect}. */
export const mediaType = mediaTypeOf(dialect)

/**
 * The three things a taxpayer can SAY about §168(k) for one asset, and there
 * is no fourth. See this module's docstring for why it is a string vocabulary
 * rather than a boolean, and for the two printed cautions that make it the
 * field the AMT adjustment turns on.
 *
 * - `allowanceClaimed` — the special depreciation allowance was taken. The
 *   amount goes in `specialDepreciationAllowanceClaimed`, and it reduces the
 *   basis for depreciation (i4562 p10, column (c)).
 * - `electedOut` — §168(k)(7)'s class-wide election out was made.
 * - `notQualifiedProperty` — §168(k)(2) never applied to this asset.
 */
export const sectionOneSixtyEightKStatusValues = /** @type {const} */ ([
    'allowanceClaimed', 'electedOut', 'notQualifiedProperty',
])

/**
 * The end of one asset's history: the four facts Form 4797 needs that Form
 * 4562 never asked for.
 *
 * A NESTED optional block rather than four sibling `or(option, string)` fields, so
 * that "all four or none" is a STRUCTURAL property of the schema instead of a
 * cross-field check that can be forgotten. Contrast `section168kStatus` and
 * `specialDepreciationAllowanceClaimed`, which genuinely are two independent
 * fields whose agreement {@link checkReferences} has to assert.
 *
 * - `dateAcquired` — f4797 line 19 column (b) / line 2 column (b), *"Date
 *   acquired (mo., day, yr.)"*. **It is not `datePlacedInService`**, in two
 *   ways that both matter. It carries a DAY, because i4797 p6 measures the
 *   holding period to the day (*"begin counting on the day after you received
 *   the property and include the day you disposed of it"*) and the holding
 *   period decides which printed Part the disposal is reported in. And
 *   acquisition is not placing in service: property bought in December and
 *   put to work in January has a holding period that starts in December.
 *   It lives HERE rather than on the asset because an asset still held needs
 *   no acquisition day, and requiring one would invalidate every register in
 *   existence.
 * - `dateSold` — f4797 line 19 column (c), *"Date sold (mo., day, yr.)"*. Its
 *   MONTH is also Step 3's disposal decimal (i4562 p11), and its YEAR must be
 *   this register's own tax year.
 * - `grossSalesPrice` — f4797 line 20. i4797 p9: *"The gross sales price
 *   includes money, the FMV of other property received, and any existing
 *   mortgage or other debt the buyer assumes or takes the property subject
 *   to."*
 * - `expenseOfSale` — the second half of f4797 line 21, *"Cost or other basis
 *   plus expense of sale"*. Stored separately from the cost, which the asset
 *   already carries, because they are two facts about two different events
 *   and only their sum appears on the printed line.
 */
const assetDisposal = open({
    dateAcquired: string,
    dateSold: string,
    grossSalesPrice: string,
    expenseOfSale: string,
})

/**
 * One depreciable asset. Every field is a printed Form 4562 column; see this
 * module's docstring and the spec for the citation behind each.
 *
 * `classification`, `method` and `section168kStatus` are free `string`s here
 * and constrained by {@link checkReferences} against frozen vocabularies —
 * `vnd.fjs.business_expenses`' `category` idiom, and for the same reason: rtti
 * has no enum, and an unrecognized value must be REFUSED by name and quoted
 * rather than coerced.
 */
const registeredAsset = open({
    description: string,
    datePlacedInService: string,
    costOrOtherBasis: string,
    businessUsePercentage: string,
    classification: string,
    method: string,
    convention: string,
    section168kStatus: string,
    specialDepreciationAllowanceClaimed: or(option, string),
    section179ElectedCost: or(option, string),
    listedProperty: or(option, true),
    disposal: or(option, assetDisposal),
})

/**
 * rtti schema for an `asset_register` BLOB. `dialect` is spread first (via
 * `base`) so structural validation reports it as the first failing field on a
 * mismatched blob (DOC-00's discriminant). NO `formRevision` and NO `payerTin`
 * — see this module's docstring.
 */
export const assetRegisterSchema = open({
    ...base(dialect),
    recipientTin: string,
    accountNumber: string,
    taxYear: number,
    corrected: or(option, true),
    businessOrActivity: string,
    everyDepreciableAssetIsListed: or(option, true),
    noDepreciablePropertyDisposedOfDuringTheYear: or(option, true),
    priorYearSection179CarryoverIsZero: or(option, true),
    assets: array(registeredAsset),
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

/** @typedef {Ts<typeof assetRegisterSchema>} AssetRegister */
/** @typedef {AssetRegister['assets'][number]} RegisteredAsset */

/** Structural-only validator: checks the shape, not the semantic refinements below. */
const validateShape = rttiValidate(assetRegisterSchema)

/**
 * Either a structural validation error or a semantic (string) error message.
 * @typedef {ValidationError | string} AssetRegisterError
 */

/**
 * `YYYY-MM` — month and year, with NO day.
 *
 * Form 4562 column (b) is *"Month and year placed in service"*, and no
 * convention reads a day: half-year ignores the date entirely, mid-quarter
 * reads the quarter, mid-month reads the month. A `YYYY-MM-DD` here would
 * invite a reader to believe the day mattered.
 * @type {RegExp}
 */
const monthAndYear = /^(\d{4})-(\d{2})$/

/**
 * `YYYY-MM-DD` — month, day and year, for the two Form 4797 columns that
 * genuinely read a day. See {@link assetDisposal}.
 * @type {RegExp}
 */
const monthDayAndYear = /^(\d{4})-(\d{2})-(\d{2})$/

/**
 * The number of days in one month, under the Gregorian leap rule. Written out
 * because a `2025-02-30` is a transcription error and a date this engine
 * ORDERS rather than subtracts would carry it silently to the right answer,
 * which is the worst outcome: right today, and unexplainable the first time it
 * is wrong.
 * @type {(year: number) => (month: number) => number}
 */
const daysInMonth = year => month => {
    if (month === 2) {
        return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28
    }
    return month === 4 || month === 6 || month === 9 || month === 11 ? 30 : 31
}

/**
 * Checks one `YYYY-MM-DD` field, returning the refusal message or `undefined`.
 * @type {(where: string) => (field: string) => (value: string) => string | undefined}
 */
const fullDateError = where => field => value => {
    const m = monthDayAndYear.exec(value)
    if (m === null) {
        return `${field} ${JSON.stringify(value)} for ${where} is not a YYYY-MM-DD date. Form 4797 `
            + `lines 2 and 19 print columns (b) and (c) as "(mo., day, yr.)", and the DAY is load `
            + `bearing: i4797 measures the holding period by "counting on the day after you `
            + `received the property and includ[ing] the day you disposed of it", and the holding `
            + `period decides whether the disposal is reported in Part I, Part II or Part III`
    }
    const [, yearText, monthText, dayText] = m
    assert(yearText !== undefined && monthText !== undefined && dayText !== undefined,
        ['a matched full date has three groups', value])
    const year = Number(yearText)
    const month = Number(monthText)
    const day = Number(dayText)
    if (month < 1 || month > 12) {
        return `${field} ${value} for ${where} names month ${monthText}, which is not a month`
    }
    const last = daysInMonth(year)(month)
    if (day < 1 || day > last) {
        return `${field} ${value} for ${where} names day ${dayText}, and ${monthText}/${yearText} `
            + `has ${last} days`
    }
    return undefined
}

/**
 * The first year MACRS applies to. i4562 p9: *"MACRS is used to depreciate any
 * tangible property placed in service after 1986."* An asset older than that
 * is ACRS or pre-ACRS property, which belongs on Form 4562 line 16 (*"Other
 * depreciation (including ACRS)"*) and which this engine does not compute.
 *
 * A named constant rather than a literal in the comparison, so
 * `year-genericity-gate.test.js`'s hardcoded-year-branch pattern is not
 * tripped by a comparison that is genuinely statutory rather than
 * year-specific.
 * @type {number}
 */
export const firstMacrsYear = 1987

/** Parses a percentage at two decimal places, yielding HUNDREDTHS of a percent. @type {(s: string) => Result<bigint, string>} */
const tryHundredthsOfPercent = tryParse(2)

/** 100.00% expressed in hundredths of a percent — the ceiling a business-use share cannot exceed. @type {bigint} */
export const fullBusinessUseHundredths = 10000n

/**
 * Checks the semantic refinements the structural schema cannot express. In
 * order, and each refusal names the offending VALUE and the asset it came
 * from — a message saying "a classification is unrecognized" tells a reader
 * what the rule is, and one that also quotes `'twentyFiveYear'` and
 * `'delivery van'` tells them where to look.
 *
 * 1. `businessOrActivity` is not empty or whitespace-only. The printed form's
 *    own header asks for it, and it is the string a multiple-register refusal
 *    quotes.
 * 2. Every `datePlacedInService` is `YYYY-MM`, with a month in 1-12 and a year
 *    at or after {@link firstMacrsYear}, and NOT after the register's own
 *    `taxYear` — an asset placed in service in a year this return has not
 *    reached yet cannot be depreciated on it.
 * 3. Every `classification`, `method` and `section168kStatus` is in its frozen
 *    vocabulary, and the method is one the classification permits: i4562 p11
 *    allows 200 DB only for 3-, 5-, 7- and 10-year property, and the straight
 *    line method ONLY for residential rental and nonresidential real property.
 * 4. Every `convention` is in its frozen vocabulary and agrees with what the
 *    classification forces where the law forces one: mid-month applies to
 *    residential rental and nonresidential real property and to nothing else.
 * 5. Every money field is an exact decimal within safe magnitude and is not
 *    negative, and `costOrOtherBasis` is not zero — a zero-basis asset
 *    contributes nothing to any line and is a transcription error, not a fact.
 * 6. `businessUsePercentage` is an exact two-decimal percentage, strictly
 *    above zero and at most 100. Zero business use is not depreciable property
 *    at all, and above 100% is not a percentage.
 * 7. `specialDepreciationAllowanceClaimed` is present exactly when
 *    `section168kStatus` is `allowanceClaimed`, and does not exceed the
 *    business-use share of the cost. A claimed allowance with no status, or a
 *    status with no amount, is a half-recorded election.
 * 8. A `disposal` block, if present, carries two real `YYYY-MM-DD` dates and
 *    two exact non-negative money fields; the sale falls in the register's own
 *    `taxYear`; the property was not acquired after it was placed in service,
 *    nor sold before it; and the register does not ALSO certify
 *    `noDepreciablePropertyDisposedOfDuringTheYear`, which the block
 *    contradicts.
 * @type {(r: AssetRegister) => Result<AssetRegister, AssetRegisterError>}
 */
export const checkReferences = r => {
    if (r.businessOrActivity.trim() === '') {
        return error(
            'businessOrActivity must not be empty or whitespace-only — Form 4562’s printed '
            + 'header asks for the "business or activity to which this form relates", and a '
            + 'separate Form 4562 is filed for each one, so it is what names this register when a '
            + 'return carries more than one')
    }
    for (const asset of r.assets) {
        const where = `${JSON.stringify(asset.description)}`
        const m = monthAndYear.exec(asset.datePlacedInService)
        if (m === null) {
            return error(
                `datePlacedInService ${JSON.stringify(asset.datePlacedInService)} for ${where} is `
                + `not a YYYY-MM month and year. Form 4562 column (b) is "Month and year placed in `
                + `service" and carries no day: the half-year convention ignores the date, the `
                + `mid-quarter convention reads the quarter and the mid-month convention reads the `
                + `month, so a day here would suggest a precision the computation does not have`)
        }
        const [, yearText, monthText] = m
        assert(yearText !== undefined && monthText !== undefined,
            ['a matched date has both groups', asset.datePlacedInService])
        const month = Number(monthText)
        if (month < 1 || month > 12) {
            return error(
                `datePlacedInService ${asset.datePlacedInService} for ${where} names month `
                + `${monthText}, which is not a month. The mid-quarter and mid-month conventions `
                + `both read it, so a month outside 1-12 would silently pick the wrong fraction of `
                + `the first year`)
        }
        const placedInServiceYear = Number(yearText)
        if (placedInServiceYear < firstMacrsYear) {
            return error(
                `datePlacedInService ${asset.datePlacedInService} for ${where} is before `
                + `${firstMacrsYear}. i4562 says MACRS "is used to depreciate any tangible `
                + `property placed in service after 1986"; older property is ACRS or pre-ACRS and `
                + `belongs on Form 4562 line 16, "Other depreciation (including ACRS)", which this `
                + `engine does not compute. Refusing rather than applying a MACRS schedule the `
                + `property is not on`)
        }
        if (placedInServiceYear > r.taxYear) {
            return error(
                `datePlacedInService ${asset.datePlacedInService} for ${where} is after the `
                + `register’s own tax year ${r.taxYear}. Depreciation "starts when you first `
                + `use the property in your business" (i4562 p1); an asset placed in service in a `
                + `later year has no deduction on this return, and treating the date as this `
                + `year’s would start its recovery period a year early`)
        }
        const spec = macrsClassifications[asset.classification]
        if (spec === undefined) {
            return error(
                `classification ${JSON.stringify(asset.classification)} for ${where} is not one of `
                + `${macrsClassificationNames.join(', ')}. Form 4562 line 19 prints ten classes; `
                + `this engine spells eight of them, because Publication 946 prints no percentage `
                + `table for 25-year water utility property (line 19g) or 50-year railroad `
                + `gradings and tunnel bores (line 19h), so a derived schedule for either could be `
                + `checked against nothing. An unrecognized class is refused rather than mapped to `
                + `a neighbouring recovery period`)
        }
        if (!macrsMethods.some(candidate => candidate === asset.method)) {
            return error(
                `method ${JSON.stringify(asset.method)} for ${where} is not one of `
                + `${macrsMethods.join(', ')} — Form 4562 column (f) admits exactly three, printed `
                + `as "200 DB", "150 DB" and "S/L"`)
        }
        if (!spec.methods.some(candidate => candidate === asset.method)) {
            return error(
                `method ${asset.method} is not permitted for ${asset.classification} property `
                + `(${where}). i4562 gives ${asset.classification} the methods `
                + `${spec.methods.join(', ')}: 200 DB is available only for 3-, 5-, 7- and 10-year `
                + `property, the 150% declining balance method is the applicable method for 15- `
                + `and 20-year property, and "the only applicable method" for residential rental `
                + `and nonresidential real property is straight line. A faster method than the law `
                + `allows OVERSTATES this year’s deduction`)
        }
        if (!macrsConventions.some(candidate => candidate === asset.convention)) {
            return error(
                `convention ${JSON.stringify(asset.convention)} for ${where} is not one of `
                + `${macrsConventions.join(', ')} — Form 4562 column (e) admits exactly three, `
                + `printed as "HY", "MQ" and "MM"`)
        }
        if (spec.midMonth !== (asset.convention === 'MM')) {
            return error(
                `convention ${asset.convention} is wrong for ${asset.classification} property `
                + `(${where}). i4562 p11: the mid-month convention "applies only to residential `
                + `rental property (line 19i), nonresidential real property (line 19j), and `
                + `railroad gradings and tunnel bores", and the half-year convention "does not `
                + `apply" to them. The convention decides the first year’s fraction, so the `
                + `wrong one is a wrong deduction in the year it matters most`)
        }
        if (!sectionOneSixtyEightKStatusValues.some(candidate => candidate === asset.section168kStatus)) {
            return error(
                `section168kStatus ${JSON.stringify(asset.section168kStatus)} for ${where} is not `
                + `one of ${sectionOneSixtyEightKStatusValues.join(', ')}. §168(k) admits exactly `
                + `three answers for one asset — the allowance was claimed, the class-wide `
                + `election out was made, or the property was never qualified property — and this `
                + `field is a string rather than a boolean precisely so that a serializer’s `
                + `empty string cannot become an assertion. It decides the basis for depreciation `
                + `AND whether §56(a)(1) adjusts this asset for the alternative minimum tax`)
        }
        for (const [name, value] of /** @type {readonly (readonly [string, string | undefined])[]} */ ([
            ['costOrOtherBasis', asset.costOrOtherBasis],
            ['specialDepreciationAllowanceClaimed', asset.specialDepreciationAllowanceClaimed],
            ['section179ElectedCost', asset.section179ElectedCost],
        ])) {
            if (value === undefined) {
                continue
            }
            const message = moneyFieldError(`${name} for ${where}`)(value)
            if (message !== undefined) {
                return error(message)
            }
            if (centsFromString(value) < 0n) {
                return error(
                    `${name} ${value} for ${where} is negative. Every money field on Form 4562 is `
                    + `a cost, a basis or an elected amount, and none can be less than nothing; a `
                    + `negative one would turn a deduction into income on a line nothing reads`)
            }
        }
        if (centsFromString(asset.costOrOtherBasis) === 0n) {
            return error(
                `costOrOtherBasis is 0.00 for ${where}. Form 4562 column (c) starts from "the cost `
                + `or other basis of the property", and an asset with no basis has no deduction in `
                + `any year — recording one is a transcription error, not a fact about the `
                + `business, and it would still be counted in the mid-quarter convention’s 40% `
                + `test`)
        }
        const [percentTag, percentValue] = tryHundredthsOfPercent(asset.businessUsePercentage)
        if (percentTag === 'error') {
            return error(
                `businessUsePercentage ${JSON.stringify(asset.businessUsePercentage)} for ${where} `
                + `is not an exact percentage at two decimal places: ${percentValue}`)
        }
        if (percentValue <= 0n || percentValue > fullBusinessUseHundredths) {
            return error(
                `businessUsePercentage ${asset.businessUsePercentage} for ${where} is not above 0 `
                + `and at most 100. i4562 p10, column (c): the basis for depreciation is the cost `
                + `"multiplied by the percentage of business/investment use". At zero there is no `
                + `depreciable property at all, and above 100 is not a percentage — either would `
                + `produce a basis the asset does not have`)
        }
        const claimed = asset.specialDepreciationAllowanceClaimed
        if ((asset.section168kStatus === 'allowanceClaimed') !== (claimed !== undefined)) {
            return error(
                `section168kStatus ${asset.section168kStatus} and `
                + `specialDepreciationAllowanceClaimed ${JSON.stringify(claimed)} disagree for `
                + `${where}. The amount is required exactly when the allowance was claimed and `
                + `forbidden otherwise: an amount with no status leaves §56(a)(1) unable to tell `
                + `whether the asset is adjusted for the alternative minimum tax, and a status `
                + `with no amount leaves the basis for depreciation unreduced, which OVERSTATES `
                + `every later year’s deduction`)
        }
        if (claimed !== undefined
            && centsFromString(claimed) * fullBusinessUseHundredths
                > centsFromString(asset.costOrOtherBasis) * percentValue) {
            return error(
                `specialDepreciationAllowanceClaimed ${claimed} for ${where} exceeds the `
                + `business-use share of costOrOtherBasis ${asset.costOrOtherBasis} at `
                + `${asset.businessUsePercentage}%. i4562 p9: "Prior years’ depreciation, plus `
                + `current year’s depreciation, can never exceed the depreciable basis of the `
                + `property" — an allowance larger than the basis would leave a NEGATIVE basis for `
                + `depreciation and a negative deduction in every later year`)
        }
        const disposal = asset.disposal
        if (disposal !== undefined) {
            if (r.noDepreciablePropertyDisposedOfDuringTheYear === true) {
                return error(
                    `${where} carries a disposal block and the register also certifies `
                    + `noDepreciablePropertyDisposedOfDuringTheYear. The two contradict each `
                    + `other, and nothing in the document says which is the mistake. The `
                    + `certification means what it says — that nothing was disposed of — so a `
                    + `register recording a sale must not carry it. Remove the certification, or `
                    + `remove the disposal`)
            }
            for (const [field, value] of /** @type {readonly (readonly [string, string])[]} */ ([
                ['disposal.dateAcquired', disposal.dateAcquired],
                ['disposal.dateSold', disposal.dateSold],
            ])) {
                const message = fullDateError(where)(field)(value)
                if (message !== undefined) {
                    return error(message)
                }
            }
            // Both dates are now `YYYY-MM-DD` and zero-padded, so LEXICOGRAPHIC
            // order IS chronological order and the three comparisons below need
            // no calendar arithmetic at all.
            if (disposal.dateSold.slice(0, 4) !== String(r.taxYear)) {
                return error(
                    `disposal.dateSold ${disposal.dateSold} for ${where} is not in the register’s `
                    + `own tax year ${r.taxYear}. One register is one business for one year, and `
                    + `Form 4797 reports the dispositions of THAT year: a sale in another year `
                    + `belongs on that year’s return, where its Part I netting and its §1231 `
                    + `character are decided against that year’s other dispositions`)
            }
            if (disposal.dateAcquired.slice(0, 7) > asset.datePlacedInService) {
                return error(
                    `disposal.dateAcquired ${disposal.dateAcquired} for ${where} is after `
                    + `datePlacedInService ${asset.datePlacedInService}. Depreciation "starts when `
                    + `you first use the property in your business" (i4562 p1), which cannot `
                    + `precede owning it. The two are different printed columns — f4562 column `
                    + `(b) is "Month and year placed in service" and f4797 line 19 column (b) is `
                    + `"Date acquired" — and property bought in December and put to work in `
                    + `January is the ordinary case, so they are not cross-checked for equality; `
                    + `only this order is impossible`)
            }
            if (disposal.dateSold.slice(0, 7) < asset.datePlacedInService) {
                return error(
                    `disposal.dateSold ${disposal.dateSold} for ${where} is before `
                    + `datePlacedInService ${asset.datePlacedInService}. An asset cannot be sold `
                    + `in a month before the one it was placed in service in; Step 3’s disposal `
                    + `decimal would take a fraction of a recovery year that had not begun`)
            }
            for (const [field, value] of /** @type {readonly (readonly [string, string])[]} */ ([
                ['disposal.grossSalesPrice', disposal.grossSalesPrice],
                ['disposal.expenseOfSale', disposal.expenseOfSale],
            ])) {
                const message = moneyFieldError(`${field} for ${where}`)(value)
                if (message !== undefined) {
                    return error(message)
                }
                if (centsFromString(value) < 0n) {
                    return error(
                        `${field} ${value} for ${where} is negative. Form 4797 line 20 is a gross `
                        + `sales PRICE and line 21’s second term is an EXPENSE of sale; a `
                        + `negative price is not a price, and a negative expense would INCREASE `
                        + `the gain line 25a recaptures as ordinary income. A sale that realized `
                        + `nothing is 0.00, which is accepted`)
                }
            }
        }
    }
    return ok(r)
}

/**
 * Validates an already-parsed JSON value as an `asset_register` BLOB:
 * structural (rtti) validation followed by {@link checkReferences}. Dialect
 * discrimination happens exclusively through the schema's exact-literal
 * `dialect` constant — the serialized JSON text is never inspected.
 * @type {(value: Unknown) => Result<AssetRegister, AssetRegisterError>}
 */
export const validate = value => {
    const [t, v] = validateShape(value)
    if (t === 'error') {
        return error(v)
    }
    return checkReferences(v)
}

/**
 * Parses a business-use percentage at two decimal places, yielding HUNDREDTHS
 * of a percent — the same fixed-scale parse `fjs/exact`'s `centsFromString`
 * is, at the same scale, named for what it actually holds here.
 * @type {(s: string) => bigint}
 */
const percentFromString = parse(2)

/**
 * This dialect's stored strings, as the `bigint` facts `fjs/form4562` takes —
 * the one place the conversion happens, so a form module still reads no
 * documents.
 *
 * **It lives here rather than in a schedule, and that is a correction.** It
 * was written inside `fjs/schedule/c` when Schedule C line 13 was the only
 * printed line an asset register could reach. Schedule E Part I line 18 is the
 * second, so a copy in the second schedule would be the "one rule, two places"
 * AGENTS.md names — and the two copies would decide independently whether a
 * hand-edited `'200 DB'` reaches the MACRS schedule. Moving it to the dialect
 * puts it where its subject is.
 *
 * Every vocabulary is re-narrowed here through the SAME frozen lists
 * {@link checkReferences} validated against, rather than cast: the schema types
 * `method` and `convention` as `string` (rtti has no enum), and a cast over
 * that would silence exactly the check that stops a bad value travelling.
 * @type {(register: AssetRegister) => readonly DepreciableAsset[]}
 */
export const depreciableAssets = register => register.assets.map(asset => {
    const [yearText, monthText] = asset.datePlacedInService.split('-')
    assert(yearText !== undefined && monthText !== undefined,
        ['a validated datePlacedInService is YYYY-MM', asset.datePlacedInService])
    const method = macrsMethods.find(candidate => candidate === asset.method)
    assert(method !== undefined, ['a validated method is one of the three', asset.method])
    const convention = macrsConventions.find(candidate => candidate === asset.convention)
    assert(convention !== undefined, ['a validated convention is one of the three', asset.convention])
    const claimed = asset.specialDepreciationAllowanceClaimed
    const elected = asset.section179ElectedCost
    const disposal = asset.disposal
    return {
        // The disposal's own month and year are split out here, beside
        // `placedInServiceMonth`, because Step 3's disposal decimal reads the
        // month SOLD and the recovery year reads the year sold — two numbers a
        // form module must not have to re-parse a string for. The two full
        // dates travel as strings because the only thing anything does with
        // them is COMPARE them, and `YYYY-MM-DD` compares correctly as text.
        disposal: disposal === undefined ? undefined : {
            acquiredDate: disposal.dateAcquired,
            soldDate: disposal.dateSold,
            soldYear: Number(disposal.dateSold.slice(0, 4)),
            soldMonth: Number(disposal.dateSold.slice(5, 7)),
            grossSalesPriceCents: centsFromString(disposal.grossSalesPrice),
            expenseOfSaleCents: centsFromString(disposal.expenseOfSale),
        },
        description: asset.description,
        placedInServiceYear: Number(yearText),
        placedInServiceMonth: Number(monthText),
        costOrOtherBasisCents: centsFromString(asset.costOrOtherBasis),
        businessUseHundredthsOfPercent: percentFromString(asset.businessUsePercentage),
        classification: asset.classification,
        method,
        convention,
        section168kStatus: asset.section168kStatus,
        specialDepreciationAllowanceClaimedCents: claimed === undefined ? 0n : centsFromString(claimed),
        section179ElectedCostCents: elected === undefined ? 0n : centsFromString(elected),
        listedProperty: asset.listedProperty === true,
    }
})

// ── Tests ────────────────────────────────────────────────────────────────────

/** A register with no assets — a real state, and not the same as no document. */
export const minimalAssetRegister = /** @type {AssetRegister} */ ({
    dialect,
    recipientTin: '222-22-2222',
    accountNumber: 'BUS-0001',
    taxYear: 2025,
    businessOrActivity: 'software consulting',
    assets: [],
})

/** An ordinary seven-year office asset, placed in service this year, no §168(k). */
export const officeFurniture = /** @type {RegisteredAsset} */ ({
    description: 'office furniture',
    datePlacedInService: '2025-06',
    costOrOtherBasis: '10000.00',
    businessUsePercentage: '100.00',
    classification: 'sevenYear',
    method: '200DB',
    convention: 'HY',
    section168kStatus: 'electedOut',
})

/** The same asset, but placed in service in an earlier year and having taken bonus. */
export const priorYearServer = /** @type {RegisteredAsset} */ ({
    description: 'rack server',
    datePlacedInService: '2023-03',
    costOrOtherBasis: '20000.00',
    businessUsePercentage: '100.00',
    classification: 'fiveYear',
    method: '200DB',
    convention: 'HY',
    section168kStatus: 'allowanceClaimed',
    specialDepreciationAllowanceClaimed: '16000.00',
})


/**
 * The disposal block every leaf below varies one field of: acquired 14
 * February 2023, sold 3 November 2025 for $4,250.75 with $125.00 of selling
 * expense. **Every field is distinctive** — a different month on each side of
 * the sale, a price whose cents are non-zero, and an expense that is not a
 * round hundred — so a helper reading one field for another produces a visibly
 * wrong number rather than a plausible one.
 */
const soldDisposal = /** @type {const} */ ({
    dateAcquired: '2023-02-14',
    dateSold: '2025-11-03',
    grossSalesPrice: '4250.75',
    expenseOfSale: '125.00',
})

/** {@link priorYearServer} without its §168(k) allowance, sold during the year. @type {RegisteredAsset} */
const soldServer = {
    description: 'rack server',
    datePlacedInService: '2023-03',
    costOrOtherBasis: '20000.00',
    businessUsePercentage: '100.00',
    classification: 'fiveYear',
    method: '200DB',
    convention: 'HY',
    section168kStatus: 'electedOut',
    disposal: soldDisposal,
}

/** Rebuilds `minimalAssetRegister` around one asset. @type {(asset: RegisteredAsset) => AssetRegister} */
const withAsset = asset => ({ ...minimalAssetRegister, assets: [asset] })

/** Unwraps a refusal message, throwing when the value validated instead. @type {(r: Result<AssetRegister, AssetRegisterError>) => string} */
const expectRefusal = ([t, v]) => {
    assert(t === 'error', ['expected a refusal', t, v])
    assert(typeof v === 'string', ['expected a SEMANTIC refusal, not a structural one', v])
    return v
}

export const proof = {
    dialectAndMediaType: () => {
        assertEq(dialect, 'vnd.fjs.asset_register')
        assertEq(mediaType, 'application/vnd.fjs.asset_register+json')
    },
    validate: {
        // A business that has bought nothing depreciable is a real state, and
        // it is not the same as having no register: the document still
        // certifies completeness, no disposals and no §179 carryover.
        emptyAssetsValidates: () => {
            const [t, v] = validate(minimalAssetRegister)
            assert(t === 'ok', ['expected ok', t, v])
            assertEq(v.assets.length, 0)
            assertEq(v.everyDepreciableAssetIsListed, undefined)
        },
        populatedRoundTrips: () => {
            const [t, v] = validate({
                ...minimalAssetRegister,
                everyDepreciableAssetIsListed: true,
                noDepreciablePropertyDisposedOfDuringTheYear: true,
                priorYearSection179CarryoverIsZero: true,
                assets: [officeFurniture, priorYearServer],
            })
            assert(t === 'ok', ['expected ok', t, v])
            assertEq(v.assets.length, 2)
            assertEq(v.assets[0]?.classification, 'sevenYear')
            assertEq(v.assets[1]?.specialDepreciationAllowanceClaimed, '16000.00')
            assertEq(v.everyDepreciableAssetIsListed, true)
        },
        wrongDialectRejected: () => {
            const [t, v] = validate({ ...minimalAssetRegister, dialect: 'vnd.fjs.business_expenses' })
            assertEq(t, 'error')
            assert(t === 'error', ['expected error', t, v])
            assert(typeof v !== 'string', ['expected a structural ValidationError', v])
            assertEq(v.path[0], 'dialect')
        },
        // DOC-12's checkbox convention: a materialized `false` is structurally
        // rejected, so absence is the only way to say "no" for all three
        // certifications and for `listedProperty`.
        materializedFalseCertificationsRejected: () => {
            assertEq(validate({ ...minimalAssetRegister, everyDepreciableAssetIsListed: false })[0], 'error')
            assertEq(validate({ ...minimalAssetRegister, noDepreciablePropertyDisposedOfDuringTheYear: false })[0], 'error')
            assertEq(validate({ ...minimalAssetRegister, priorYearSection179CarryoverIsZero: false })[0], 'error')
            assertEq(validate({ ...minimalAssetRegister, assets: [{ ...officeFurniture, listedProperty: false }] })[0], 'error')
        },
    },
    businessOrActivity: {
        emptyIsRefused: () => {
            const message = expectRefusal(validate({ ...minimalAssetRegister, businessOrActivity: '   ' }))
            assert(message.includes('businessOrActivity'), ['the refusal must name the field', message])
            assert(message.includes('business or activity to which this form relates'),
                ['the refusal must quote the printed header it comes from', message])
        },
    },
    datePlacedInService: {
        // The printed column is "Month and year", and a day would suggest a
        // precision no convention has.
        aDayIsRefused: () => {
            const message = expectRefusal(validate(withAsset({ ...officeFurniture, datePlacedInService: '2025-06-14' })))
            assert(message.includes('Month and year placed in service'),
                ['the refusal must quote the printed column caption', message])
        },
        monthOutsideOneToTwelveIsRefused: () => {
            const message = expectRefusal(validate(withAsset({ ...officeFurniture, datePlacedInService: '2025-13' })))
            assert(message.includes('13'), ['the refusal must quote the offending month', message])
        },
        // MACRS starts after 1986; older property is ACRS, which is Form 4562
        // line 16 and is not computed here.
        preMacrsPropertyIsRefused: () => {
            const message = expectRefusal(validate(withAsset({ ...officeFurniture, datePlacedInService: '1986-12' })))
            assert(message.includes('ACRS'), ['the refusal must name what the property is instead', message])
            assert(message.includes('line 16'), ['the refusal must name the printed line it belongs on', message])
        },
        // The CONTROL for the boundary: one month later is MACRS property and
        // validates. Without this leaf a check that refused everything would
        // pass the leaf above.
        theFirstMacrsMonthIsAccepted: () => {
            assertEq(validate(withAsset({ ...officeFurniture, datePlacedInService: '1987-01', classification: 'nonresidentialReal', method: 'SL', convention: 'MM' }))[0], 'ok')
        },
        aFutureYearIsRefused: () => {
            const message = expectRefusal(validate(withAsset({ ...officeFurniture, datePlacedInService: '2026-01' })))
            assert(message.includes('2026-01') && message.includes('2025'),
                ['the refusal must quote both the date and the register’s tax year', message])
        },
    },
    vocabularies: {
        unknownClassificationIsRefusedByName: () => {
            const message = expectRefusal(validate(withAsset({ ...officeFurniture, classification: 'twentyFiveYear' })))
            assert(message.includes('twentyFiveYear'), ['the refusal must quote the value', message])
            assert(message.includes('19g'), ['the refusal must name the printed line it would have been', message])
        },
        unknownMethodIsRefusedByName: () => {
            const message = expectRefusal(validate(withAsset({ ...officeFurniture, method: '200 DB' })))
            assert(message.includes('200 DB'), ['the refusal must quote the value', message])
        },
        // i4562: 200 DB is not on the menu for 15- and 20-year property, and
        // the straight line method is the ONLY method for real property.
        // Choosing a faster method than the law allows OVERSTATES the year.
        aMethodTheClassDoesNotPermitIsRefused: () => {
            const message = expectRefusal(validate(withAsset({
                ...officeFurniture, classification: 'twentyYear', method: '200DB', convention: 'HY',
            })))
            assert(message.includes('OVERSTATES'), ['the refusal must say which direction it is wrong in', message])
            const real = expectRefusal(validate(withAsset({
                ...officeFurniture, classification: 'residentialRental', method: '200DB', convention: 'MM',
            })))
            assert(real.includes('only applicable method'), ['the refusal must quote the printed rule', real])
        },
        // The CONTROL: 150 DB IS permitted for 20-year property, and straight
        // line IS permitted for 3-year property (the irrevocable election).
        aPermittedMethodIsAccepted: () => {
            assertEq(validate(withAsset({ ...officeFurniture, classification: 'twentyYear', method: '150DB' }))[0], 'ok')
            assertEq(validate(withAsset({ ...officeFurniture, method: 'SL' }))[0], 'ok')
        },
        unknownStatusIsRefusedByName: () => {
            const message = expectRefusal(validate(withAsset({ ...officeFurniture, section168kStatus: '' })))
            assert(message.includes('§56(a)(1)'), ['the refusal must name what the field decides', message])
        },
        // A convention that is not one of the three at all, which is a
        // different refusal from the one below: that one rejects a REAL
        // convention paired with the wrong class, this one rejects a string
        // that is not a convention. The schema types `convention` as `string`
        // (rtti has no enum), so nothing structural stops it, and
        // `depreciableAssets` re-narrows through this same frozen list and
        // PANICS on a miss — so an unrecognized value that got past here would
        // not produce a wrong deduction, it would take the run down.
        unknownConventionIsRefusedByName: () => {
            const message = expectRefusal(validate(withAsset({ ...officeFurniture, convention: 'half-year' })))
            assert(message.includes('"half-year"'), ['the refusal must quote the value', message])
            assert(message.includes('HY, MQ, MM'),
                ['the refusal must list the three the printed column admits', message])
            assert(message.includes('column (e)'), ['the refusal must name the printed column', message])
        },
        // Mid-month applies to real property and to nothing else, in BOTH
        // directions — the pair is what makes the rule a rule rather than a
        // one-sided check.
        theConventionMustMatchWhatTheClassForces: () => {
            const personalPropertyAsMidMonth = expectRefusal(
                validate(withAsset({ ...officeFurniture, convention: 'MM' })))
            assert(personalPropertyAsMidMonth.includes('applies only to residential'),
                ['the refusal must quote the printed rule', personalPropertyAsMidMonth])
            const realPropertyAsHalfYear = expectRefusal(validate(withAsset({
                ...officeFurniture, classification: 'residentialRental', method: 'SL', convention: 'HY',
            })))
            assert(realPropertyAsHalfYear.includes('does not'),
                ['the refusal must quote the printed rule', realPropertyAsHalfYear])
            assert(realPropertyAsHalfYear.includes('residentialRental'),
                ['the refusal must name the classification', realPropertyAsHalfYear])
        },
        // The CONTROL: the two legitimate pairings validate.
        theRightConventionIsAccepted: () => {
            assertEq(validate(withAsset(officeFurniture))[0], 'ok')
            assertEq(validate(withAsset({
                ...officeFurniture, classification: 'residentialRental', method: 'SL', convention: 'MM',
            }))[0], 'ok')
        },
    },
    money: {
        // The arm BEFORE the sign one, on all three fields the money loop
        // walks. `-1.00` (the leaf below) is an exact decimal and is caught by
        // the sign check, so it never reaches this one — the two refusals read
        // alike and fire on different inputs, and only this one covers what
        // the OCR boundary actually hands over. DOC-04: a comma-grouped
        // amount is REFUSED, never repaired.
        //
        // All three can be probed with a bare spread because the money loop
        // is the FIRST check on an asset's amounts and returns on the first
        // refusal: neither the zero-basis check, the business-use percentage
        // parse, nor §168(k)'s status/amount agreement is reached. That is why
        // `specialDepreciationAllowanceClaimed` can carry an amount here
        // without the `allowanceClaimed` status that would otherwise be a
        // half-recorded election.
        //
        // The three names are hand-typed rather than read off the loop, so a
        // field dropped from the loop fails here instead of quietly shortening
        // it.
        inexactMoneyIsRefusedOnEveryFieldTheLoopWalks: () => {
            const one = expectRefusal(validate(withAsset({ ...officeFurniture, costOrOtherBasis: '1,000.00' })))
            assert(one.includes('costOrOtherBasis'), ['the refusal must name the field', one])
            assert(one.includes('office furniture'), ['and the asset it came from', one])
            assert(one.includes('1,000.00'), ['and quote the value', one])
            assert(one.includes('not an exact decimal'),
                ['the exactness refusal, not the sign one', one])
            const two = expectRefusal(validate(withAsset({
                ...officeFurniture, specialDepreciationAllowanceClaimed: '1,000.00',
            })))
            assert(two.includes('specialDepreciationAllowanceClaimed'),
                ['the refusal must name the field', two])
            assert(two.includes('not an exact decimal'),
                ['and refuse for exactness rather than for the missing §168(k) status', two])
            const three = expectRefusal(validate(withAsset({
                ...officeFurniture, section179ElectedCost: '1,000.00',
            })))
            assert(three.includes('section179ElectedCost'), ['the refusal must name the field', three])
            assert(three.includes('not an exact decimal'), ['for exactness', three])
        },
        negativeCostIsRefused: () => {
            const message = expectRefusal(validate(withAsset({ ...officeFurniture, costOrOtherBasis: '-1.00' })))
            assert(message.includes('negative'), message)
        },
        zeroCostIsRefused: () => {
            const message = expectRefusal(validate(withAsset({ ...officeFurniture, costOrOtherBasis: '0.00' })))
            assert(message.includes('40%'), ['the refusal must name what a zero-basis asset would still distort', message])
        },
        // The CONTROL: one cent of basis is a real, if odd, asset.
        oneCentOfBasisIsAccepted: () => {
            assertEq(validate(withAsset({ ...officeFurniture, costOrOtherBasis: '0.01' }))[0], 'ok')
        },
        businessUseOutsideZeroToOneHundredIsRefused: () => {
            assert(expectRefusal(validate(withAsset({ ...officeFurniture, businessUsePercentage: '0.00' })))
                .includes('not above 0'), 'zero business use')
            assert(expectRefusal(validate(withAsset({ ...officeFurniture, businessUsePercentage: '100.01' })))
                .includes('not above 0'), 'above 100%')
        },
        // The CONTROLS for both ends of that range: one hundredth of a percent
        // and exactly 100.00% both validate.
        theBusinessUseBoundariesAreAccepted: () => {
            assertEq(validate(withAsset({ ...officeFurniture, businessUsePercentage: '0.01' }))[0], 'ok')
            assertEq(validate(withAsset({ ...officeFurniture, businessUsePercentage: '100.00' }))[0], 'ok')
        },
        overPreciseBusinessUseIsRefused: () => {
            assert(expectRefusal(validate(withAsset({ ...officeFurniture, businessUsePercentage: '33.333' })))
                .includes('two decimal places'), 'three decimals')
        },
    },
    disposal: {
        // THE CONTROL FIRST, because every refusal below is a departure from
        // it: an ordinary sale of an asset the register already holds
        // validates, and the four facts travel out of the dialect as the
        // `bigint`s and `number`s `fjs/form4797` takes.
        anOrdinaryDisposalValidatesAndTravels: () => {
            const [t, v] = validate(withAsset(soldServer))
            assert(t === 'ok', ['expected ok', t, v])
            const [asset] = depreciableAssets(v)
            assert(asset !== undefined, 'expected one extracted asset')
            const disposal = asset.disposal
            assert(disposal !== undefined, ['the disposal must travel out of the dialect', asset])
            assertEq(disposal.acquiredDate, '2023-02-14')
            assertEq(disposal.soldDate, '2025-11-03')
            // The month and the year are split out because Step 3's disposal
            // decimal reads the MONTH and the recovery year reads the YEAR;
            // both are asserted, because a helper that read one for the other
            // would still produce plausible numbers.
            assertEq(disposal.soldYear, 2025)
            assertEq(disposal.soldMonth, 11)
            assertEq(disposal.grossSalesPriceCents, 425075n, '$4,250.75')
            assertEq(disposal.expenseOfSaleCents, 12500n, '$125.00')
        },
        // An asset with no disposal carries `undefined` rather than a
        // zero-valued block — the distinction printed Form 4797 turns on.
        anAssetStillHeldCarriesNoDisposal: () => {
            const [t, v] = validate(withAsset(priorYearServer))
            assert(t === 'ok', ['expected ok', t, v])
            const [asset] = depreciableAssets(v)
            assert(asset !== undefined, 'expected one extracted asset')
            assertEq(asset.disposal, undefined)
        },
        // The register asserts nothing was disposed of AND records a disposal.
        // Nothing in the document says which is the mistake.
        aDisposalBesideTheCertificationIsRefused: () => {
            const message = expectRefusal(validate({
                ...withAsset(soldServer),
                noDepreciablePropertyDisposedOfDuringTheYear: true,
            }))
            assert(message.includes('contradict'),
                ['the refusal must say the two disagree', message])
            assert(message.includes('noDepreciablePropertyDisposedOfDuringTheYear'),
                ['and name the certification', message])
        },
        // Form 4797 lines 2 and 19 print columns (b) and (c) as "(mo., day,
        // yr.)" and the DAY decides which printed Part the disposal lands in,
        // so a `YYYY-MM` here is refused rather than read as the first of the
        // month.
        aMonthAndYearWithNoDayIsRefused: () => {
            const message = expectRefusal(validate(withAsset({
                ...soldServer, disposal: { ...soldDisposal, dateSold: '2025-11' },
            })))
            assert(message.includes('YYYY-MM-DD'), ['the refusal must name the shape', message])
            assert(message.includes('holding period'),
                ['and say what the day decides', message])
        },
        // A MONTH the year does not have, in both directions. The equivalent
        // check on `datePlacedInService` is proven separately; this is the
        // full-date one, and it is not the same code. Both ends matter because
        // neither survives being read as a month: `daysInMonth` answers 31 for
        // month 0 and for month 13 alike (its only special cases are February
        // and the four thirty-day months), so an out-of-range month would sail
        // through the day check and then sort correctly, since only the ORDER
        // of these dates is ever used.
        aMonthTheYearDoesNotHaveIsRefused: () => {
            const above = expectRefusal(validate(withAsset({
                ...soldServer, disposal: { ...soldDisposal, dateSold: '2025-13-03' },
            })))
            assert(above.includes('disposal.dateSold'), ['the refusal must name the field', above])
            assert(above.includes('names month 13'), ['and quote the offending month', above])
            assert(above.includes('not a month'), ['and say what is wrong with it', above])
            const below = expectRefusal(validate(withAsset({
                ...soldServer, disposal: { ...soldDisposal, dateAcquired: '2023-00-14' },
            })))
            assert(below.includes('disposal.dateAcquired'), ['the refusal must name the field', below])
            assert(below.includes('names month 00'), ['and quote the offending month', below])
        },
        // A day the month does not have. Only the ORDER of these dates is ever
        // used, so `2025-02-30` would sort correctly and produce a plausible
        // answer — which is exactly why it is checked.
        aDayTheMonthDoesNotHaveIsRefused: () => {
            const message = expectRefusal(validate(withAsset({
                ...soldServer, disposal: { ...soldDisposal, dateSold: '2025-02-30' },
            })))
            assert(message.includes('28 days'),
                ['the refusal must say how many days the month has', message])
        },
        // THE CONTROL FOR THE LEAP RULE, in both directions: 2024 has a 29th
        // of February and 2025 does not. A `daysInMonth` that returned 28 or
        // 29 unconditionally would pass one of these two and fail the other.
        theLeapDayIsAcceptedInALeapYearAndRefusedOtherwise: () => {
            assertEq(validate(withAsset({
                ...soldServer,
                datePlacedInService: '2023-02',
                disposal: { ...soldDisposal, dateAcquired: '2024-02-29' },
            }))[0], 'error', 'acquired after placed in service')
            assertEq(validate({
                ...minimalAssetRegister,
                taxYear: 2024,
                assets: [{
                    ...soldServer,
                    // Placed in service in March 2024 rather than March 2023,
                    // because the acquisition cannot precede the service date
                    // and the leaf above already checks that rule.
                    datePlacedInService: '2024-03',
                    disposal: { ...soldDisposal, dateAcquired: '2024-02-29', dateSold: '2024-12-01' },
                }],
            })[0], 'ok', '2024 HAS a 29th of February')
            assert(expectRefusal(validate(withAsset({
                ...soldServer,
                disposal: { ...soldDisposal, dateSold: '2025-02-29' },
            }))).includes('28 days'), '2025 does not')
        },
        // THE CENTURY RULE, which the leaf above cannot reach: 2024 and 2025
        // settle `year % 4` and never evaluate the rest of the Gregorian
        // condition, so a `daysInMonth` written as the naive `year % 4 === 0`
        // passes every leaf above this one. It takes a year divisible by 100
        // to tell the two rules apart, and both such years are reachable
        // through `validate` — the full-date checks run BEFORE the ordering
        // ones, and `dateAcquired` has no lower bound of its own.
        //
        // 2000 is divisible by 400 and DOES have a 29th of February; 1900 is
        // divisible by 100 and not by 400 and does NOT. A naive `% 4` rule
        // accepts both, and the 1900 half is what turns red — which is the
        // point of asserting the refusal's own arithmetic ("02/1900 has 28
        // days") rather than only that it refused.
        theCenturyLeapRuleDecidesFebruaryInBothDirections: () => {
            assertEq(validate({
                ...minimalAssetRegister,
                assets: [{
                    ...soldServer,
                    datePlacedInService: '2000-03',
                    disposal: { ...soldDisposal, dateAcquired: '2000-02-29' },
                }],
            })[0], 'ok', '2000 is divisible by 400 and HAS a 29th of February')
            const message = expectRefusal(validate({
                ...minimalAssetRegister,
                assets: [{
                    ...soldServer,
                    datePlacedInService: '2000-03',
                    disposal: { ...soldDisposal, dateAcquired: '1900-02-29' },
                }],
            }))
            assert(message.includes('02/1900 '),
                ['the refusal must name the month and year it counted', message])
            assert(message.includes('28 days'),
                ['and say how many days that century year’s February has', message])
        },
        // One register is one business for ONE year, and Form 4797 reports
        // that year's dispositions: a sale in another year belongs on that
        // year's return, where its §1231 character is decided against that
        // year's other dispositions.
        aSaleOutsideTheRegistersTaxYearIsRefused: () => {
            const message = expectRefusal(validate(withAsset({
                ...soldServer, disposal: { ...soldDisposal, dateSold: '2024-11-03' },
            })))
            assert(message.includes('2025'), ['the refusal must quote the register’s year', message])
            assert(message.includes('§1231'),
                ['and say why the year matters', message])
        },
        // Acquiring an asset AFTER placing it in service is not a thing that
        // can happen. The reverse — bought in December, put to work in
        // January — is the ORDINARY case and must not be refused, which is
        // the second half of this leaf.
        acquisitionAfterPlacingInServiceIsRefusedAndBeforeIsNot: () => {
            const message = expectRefusal(validate(withAsset({
                ...soldServer, disposal: { ...soldDisposal, dateAcquired: '2023-04-01' },
            })))
            assert(message.includes('Date acquired'),
                ['the refusal must name the printed column', message])
            // THE CONTROL: acquired in the month BEFORE, and in the same
            // month, both validate.
            assertEq(validate(withAsset({
                ...soldServer, disposal: { ...soldDisposal, dateAcquired: '2023-02-28' },
            }))[0], 'ok', 'the same month is fine')
            assertEq(validate(withAsset({
                ...soldServer, disposal: { ...soldDisposal, dateAcquired: '2022-12-30' },
            }))[0], 'ok', 'and an earlier one is the ordinary case')
        },
        // Selling in a month before the one it was placed in service in would
        // take a fraction of a recovery year that had not begun.
        aSaleBeforeThePlacedInServiceMonthIsRefused: () => {
            const message = expectRefusal(validate(withAsset({
                ...soldServer,
                datePlacedInService: '2025-06',
                disposal: {
                    ...soldDisposal, dateAcquired: '2025-05-01', dateSold: '2025-04-30',
                },
            })))
            assert(message.includes('Step 3'),
                ['the refusal must name the decimal it would take', message])
        },
        // The arm BEFORE the sign one, on both disposal amounts. `-1.00` (the
        // leaf below) is an exact decimal and is caught by the sign check, so
        // it never reaches this one. The two probes are deliberately different
        // failures — comma grouping is what the OCR boundary hands over, and a
        // third fractional digit is what a spreadsheet export produces — so a
        // check narrowed to either one alone still turns red here.
        inexactDisposalMoneyIsRefused: () => {
            const price = expectRefusal(validate(withAsset({
                ...soldServer, disposal: { ...soldDisposal, grossSalesPrice: '4,250.75' },
            })))
            assert(price.includes('disposal.grossSalesPrice'), ['the refusal must name the field', price])
            assert(price.includes('rack server'), ['and the asset it came from', price])
            assert(price.includes('4,250.75'), ['and quote the value', price])
            assert(price.includes('not an exact decimal'), ['for exactness, not for sign', price])
            const expense = expectRefusal(validate(withAsset({
                ...soldServer, disposal: { ...soldDisposal, expenseOfSale: '125.000' },
            })))
            assert(expense.includes('disposal.expenseOfSale'), ['the refusal must name the field', expense])
            assert(expense.includes('more than 2 fractional digits'),
                ['and say that the cents scale is what it exceeded', expense])
        },
        // A negative expense of sale would INCREASE the gain line 25a
        // recaptures as ordinary income; a negative price is not a price.
        negativeDisposalMoneyIsRefused: () => {
            assert(expectRefusal(validate(withAsset({
                ...soldServer, disposal: { ...soldDisposal, grossSalesPrice: '-1.00' },
            }))).includes('negative'), 'a negative price')
            assert(expectRefusal(validate(withAsset({
                ...soldServer, disposal: { ...soldDisposal, expenseOfSale: '-1.00' },
            }))).includes('INCREASE'),
                'a negative expense, and the refusal must name the direction')
        },
        // THE CONTROL: a sale that realized NOTHING is 0.00 and is accepted —
        // an abandoned machine is a real disposal, and refusing it would send
        // the taxpayer looking for a price that does not exist.
        aSaleForNothingIsAccepted: () => {
            assertEq(validate(withAsset({
                ...soldServer,
                disposal: { ...soldDisposal, grossSalesPrice: '0.00', expenseOfSale: '0.00' },
            }))[0], 'ok')
        },
    },
    sectionOneSixtyEightK: {
        // Both halves of the same rule: an amount with no status, and a status
        // with no amount. Each is a half-recorded election, and they fail in
        // OPPOSITE directions.
        theStatusAndTheAmountMustAgree: () => {
            const amountWithoutStatus = expectRefusal(validate(withAsset({
                ...officeFurniture, specialDepreciationAllowanceClaimed: '5000.00',
            })))
            assert(amountWithoutStatus.includes('disagree'), amountWithoutStatus)
            const statusWithoutAmount = expectRefusal(validate(withAsset({
                ...officeFurniture, section168kStatus: 'allowanceClaimed',
            })))
            assert(statusWithoutAmount.includes('OVERSTATES'),
                ['the refusal must name the direction of the error', statusWithoutAmount])
        },
        // The CONTROL: the matched pair validates.
        theMatchedPairIsAccepted: () => {
            assertEq(validate(withAsset(priorYearServer))[0], 'ok')
        },
        // An allowance larger than the basis leaves a NEGATIVE basis for
        // depreciation, and every later year's deduction with it.
        anAllowanceAboveTheBusinessUseShareIsRefused: () => {
            const message = expectRefusal(validate(withAsset({
                ...priorYearServer, businessUsePercentage: '50.00',
            })))
            assert(message.includes('NEGATIVE basis'), message)
        },
        // The CONTROL, at the exact boundary: an allowance equal to the whole
        // business-use share is legitimate, and it is the ordinary 100% bonus
        // case rather than an exotic one.
        anAllowanceEqualToTheWholeShareIsAccepted: () => {
            assertEq(validate(withAsset({
                ...priorYearServer, specialDepreciationAllowanceClaimed: '20000.00',
            }))[0], 'ok')
            assertEq(validate(withAsset({
                ...priorYearServer, businessUsePercentage: '50.00',
                specialDepreciationAllowanceClaimed: '10000.00',
            }))[0], 'ok')
        },
    },
}
