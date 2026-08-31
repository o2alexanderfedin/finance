/**
 * `vnd.fjs.farm` — ONE printed Schedule F (Form 1040): one farming business.
 *
 * Spec:
 * [../../schedule/f/todo/schedule-f-profit-or-loss-from-farming.md](../../schedule/f/todo/schedule-f-profit-or-loss-from-farming.md),
 * written before this file, with every field's citation to the printed 2025
 * `f1040sf.pdf` face and `i1040sf.pdf` instructions by page.
 *
 * ## A taxpayer-asserted dialect
 *
 * No information return reports what a farmer sold. i1040sf p3 prints the whole
 * list of forms that report ANY of printed Part I, and it is five rows long —
 * Forms 1099-PATR, 1099-A, 1099-MISC, 1099-G and CCC-1099-G — of which this
 * repository holds exactly one, `vnd.fjs.1099g`. Printed line 2, *"Sales of
 * livestock, produce, grains, and other products you raised"*, which is the bulk
 * of most farms' income, has no payer and no form at all.
 *
 * So this dialect sits beside `vnd.fjs.business_expenses`,
 * `vnd.fjs.rental_property`, `vnd.fjs.medical_expenses`, `vnd.fjs.adjustments`
 * and `vnd.fjs.asset_register`: **no `formRevision`, no `payerTin`.**
 *
 * ## Why this is not `vnd.fjs.business_expenses` with more categories
 *
 * The entry SHAPE is copied from that dialect unchanged —
 * `{ category, datePaid, description, amount }`, with `category` a free `string`
 * here and constrained one layer out in `fjs/schedule/f`. The CONTAINER cannot
 * be shared, and the first reason is sharper than the one
 * `vnd.fjs.rental_property` gives:
 *
 * 1. **`fjs/schedule/c` would file a Schedule C for the farm.** `scheduleC`
 *    consumes EVERY stored `vnd.fjs.business_expenses`, so a farm stored in that
 *    dialect would be computed onto the wrong printed form, under Schedule C's
 *    own twenty-five-category vocabulary, and would reach Schedule 1 line **3**
 *    rather than line **6**. f1040sf Part IV prints the boundary on its own
 *    face: *"Do not file Schedule F (Form 1040) to report the following. •
 *    Income from providing agricultural services such as soil preparation,
 *    veterinary, farm labor, horticultural services […] Instead, see the
 *    Instructions for Schedule C (Form 1040)."*
 * 2. **Printed lines 1a through 8 have no field to live in.** Ten printed income
 *    lines, four of them a/b pairs where the taxpayer states a gross amount and
 *    a taxable amount separately. `vnd.fjs.business_expenses` has one
 *    income-side field and it is a checkbox about Forms 1099-NEC — a document
 *    class that reports no farm income at all.
 * 3. **The two expense vocabularies are disjoint.** `chemicals`, `feed`,
 *    `fertilizersAndLime`, `seedsAndPlants`, `storageAndWarehousing` and
 *    `veterinaryBreedingAndMedicine` have no Schedule C line; `costOfGoodsSold`,
 *    `deductibleMeals`, `businessUseOfHome`, `contractLabor`, `officeExpense`,
 *    `advertising` and `travel` have no Schedule F line.
 *
 * ## `proprietorSsn` is the printed header, and printed line D is NOT it
 *
 * The face's unlettered header prints two boxes side by side: **"Name of
 * proprietor"** and **"Social security number (SSN)"**. The second is what
 * this dialect's `proprietorSsn` carries, and it plays {@link subjectKey}'s
 * `recipient` role. It was `recipientTin` until FORM-KEY-02 -- a name this
 * face does not use anywhere: a case-insensitive search over the whole page
 * finds zero occurrences of "payer" or "recipient", which is what made the old
 * name a convention rather than a transcription.
 *
 * **Printed line D is the other identity box, and it is deliberately absent.**
 * D is *"Employer ID number (EIN) (see instr.)"* -- the farm's number, not the
 * farmer's -- and it is dropped for the reason the next section gives. So the
 * rename cannot be read as "line D finally got a field": nothing here
 * transcribes line D, before or after.
 *
 * **`accountNumber` is UNCHANGED, and this is the one place in this branch
 * where that costs something to explain.** There is no account-number box on a
 * Schedule F; the only "account" on the whole face is line C's *Accounting
 * method*, which is not one. The field is DOC-01's account ROLE, and it is
 * load-bearing rather than decorative: {@link checkReferences} refuses an
 * empty one, because it is what a `vnd.fjs.asset_register` must MATCH for its
 * Form 4562 line 22 to reach printed line 14. Renaming it to something like
 * `farmIdentifier` would have been an invention -- a name for a thing the
 * paper does not print -- and would have broken the one word that is shared
 * with the register on the other side of the join. So it keeps the role name,
 * exactly as `vnd.fjs.k1_1065` and `vnd.fjs.k1_1120s` keep theirs.
 *
 * ## Printed lines B, D, F and G are deliberately absent
 *
 * The six-digit principal agricultural activity code, the employer
 * identification number, and the two questions about Forms 1099 the filer may
 * have had to file. **None feeds any arithmetic on the page.**
 * `vnd.fjs.rental_property` states the rule this follows: a stored field no line
 * can read is the `box13StatutoryEmployee` defect this repository has already
 * shipped once. Printed line A is carried, because `fjs/schedule/f`'s
 * second-Schedule-F refusal quotes it.
 *
 * ## The three fields whose ABSENCE is a substantive answer
 *
 * `accountingMethod` (printed line C), `materiallyParticipated` (printed line E)
 * and `investmentAtRisk` (printed line 36) are REQUIRED strings from frozen
 * two-value vocabularies, not `option(true)` checkboxes, for
 * `vnd.fjs.business_expenses`' `specifiedServiceTradeOrBusiness` reason: each
 * printed line prints TWO boxes and a filer ticks one of them, so absence is
 * not an answer and a serializer's materialized `false` must not become one.
 *
 * `cropInsuranceProceedsDeferredFromPriorYear` (printed line 6d) is the one
 * money field whose ABSENCE `fjs/schedule/f` refuses on, and the direction is
 * why. An amount deferred from 2024 into 2025 is income THIS year; reading its
 * absence as zero would UNDERSTATE income, which is the direction TAX-16 exists
 * to prevent. `'0.00'` is the assertion "I deferred nothing from 2024", and it
 * is a different statement from silence — `vnd.fjs.business_expenses`'
 * `priorYearQualifiedBusinessLossCarryforward` exactly.
 *
 * `commodityCreditCorporationLoanProceedsReportedAsIncomeUnderElection` is the
 * opposite case, and it is a DOC-12 checkbox because absence is the SAFE
 * reading: without the §77 election the market gain on printed line 4b IS
 * taxable, which is the higher-tax direction.
 *
 * @module
 */
import { array, number, open, option, string } from 'functionalscript/fjs/types/rtti/module.f.mjs'
import { validate as rttiValidate } from 'functionalscript/fjs/types/rtti/validate/module.f.mjs'
import { error, ok } from 'functionalscript/fjs/types/result/module.f.mjs'
import { assert, assertEq } from 'functionalscript/fjs/asserts/module.f.mjs'
import { centsFromString } from '../../exact/module.f.js'
import { base, mediaTypeOf } from '../base/module.f.js'
import { moneyFieldError } from '../money_field/module.f.js'

/** @import { Result } from 'functionalscript/fjs/types/result/types.js' */
/** @import { Ts, Unknown } from 'functionalscript/fjs/types/rtti/ts/types.js' */
/** @import { ValidationError } from 'functionalscript/fjs/types/rtti/common/types.js' */
/** @import { SubjectKey } from '../subject/module.f.js' */

/**
 * Format tag: names the dialect of this BLOB. The media type it is served
 * with is derived mechanically: `application/` + `dialect` + `+json`.
 */
export const dialect = 'vnd.fjs.farm'
/** The media type derived from {@link dialect}: `application/vnd.fjs.farm+json`. */
export const mediaType = mediaTypeOf(dialect)

/**
 * Printed line C, *"Accounting method: Cash / Accrual"* — two printed boxes and
 * the filer ticks one.
 *
 * The value decides which printed parts are completed at all. i1040sf p1: cash
 * completes *"Parts I and II"*, accrual completes *"Part I, line 9; Part II; and
 * Part III"*. `fjs/schedule/f` refuses `accrual` at printed line 45.
 */
export const accountingMethodValues = /** @type {const} */ (['cash', 'accrual'])

/**
 * Printed line E, *"Did you 'materially participate' in the operation of this
 * business during 2025?"* — two printed boxes, Yes and No.
 *
 * `no` is what makes the farm a passive activity, and `fjs/schedule/f` refuses
 * it on §1411 grounds rather than §469's: a passive farm's income is net
 * investment income under §1411(c)(1)(A)(ii), and `fjs/form8960` computes
 * printed line 4a from Schedule E line 26 alone.
 */
export const materialParticipationValues = /** @type {const} */ (['yes', 'no'])

/**
 * Printed line 36, *"Check the box that describes your investment in this
 * activity"* — 36a *"All investment is at risk"* and 36b *"Some investment is
 * not at risk"*.
 *
 * Read only when printed line 34 is a LOSS, which is what the printed page says:
 * i1040sf p10, *"You don't need to complete line 36 if line 9 is more than line
 * 33."* It is what lets the loss refusal name §465 and Form 6198 for a filer at
 * 36b and not for one at 36a.
 */
export const investmentAtRiskValues = /** @type {const} */ (['allAtRisk', 'someNotAtRisk'])

/**
 * One expense the taxpayer asserts they paid or incurred for this farm.
 * `vnd.fjs.business_expenses`' entry shape, field for field.
 */
const expenseEntry = open({
    category: string,
    datePaid: string,
    description: string,
    amount: string,
})

/**
 * rtti schema for a `farm` BLOB. `dialect` is spread first (via `base`) so
 * structural validation reports it as the first failing field on a mismatched
 * blob (DOC-00's discriminant).
 *
 * Every printed Part I amount is `option(string)` rather than a required
 * string: a farm with no cooperative distributions leaves printed line 3a
 * BLANK, and a materialized `'0.00'` there would be an assertion where the page
 * has none. The one exception is printed line 6d, whose absence is a refusal
 * rather than a zero — see this module's docstring.
 */
export const farmSchema = open({
    ...base(dialect),
    proprietorSsn: string,
    accountNumber: string,
    taxYear: number,
    corrected: option(true),
    // Printed lines A, C, E and 36.
    principalCropOrActivity: string,
    accountingMethod: string,
    materiallyParticipated: string,
    investmentAtRisk: string,
    // Printed Part I, lines 1a through 8, in printed order.
    salesOfPurchasedLivestockAndOtherResaleItems: option(string),
    costOrOtherBasisOfPurchasedItems: option(string),
    salesOfRaisedProductsAndLivestock: option(string),
    cooperativeDistributions: option(string),
    cooperativeDistributionsTaxableAmount: option(string),
    agriculturalProgramPaymentsNotReportedOnForm1099G: option(string),
    commodityCreditCorporationLoanProceedsReportedAsIncomeUnderElection: option(true),
    commodityCreditCorporationLoansReportedUnderElection: option(string),
    commodityCreditCorporationLoansForfeited: option(string),
    commodityCreditCorporationLoansForfeitedTaxableAmount: option(string),
    cropInsuranceProceedsReceived: option(string),
    cropInsuranceProceedsTaxableAmount: option(string),
    electionToDeferCropInsuranceProceeds: option(true),
    cropInsuranceProceedsDeferredFromPriorYear: option(string),
    customHireIncome: option(string),
    otherIncome: option(string),
    // §199A, the three facts `fjs/form8995a` reads. Copied from
    // `vnd.fjs.business_expenses` field for field, because a farming business is
    // a qualified trade or business like any other and Form 8995-A's
    // limitations are figured per business.
    //
    // There is NO `specifiedServiceTradeOrBusiness` here, and its absence is a
    // legal fact rather than an omission: §199A(d)(2)'s list is health, law,
    // accounting, actuarial science, performing arts, consulting, athletics,
    // financial services, brokerage services, and investing and trading.
    // Farming is on none of them, so `fjs/schedule/f` supplies the answer as a
    // constant and no taxpayer is asked a question with one possible answer.
    priorYearQualifiedBusinessLossCarryforward: option(string),
    w2Wages: option(string),
    unadjustedBasisOfQualifiedProperty: option(string),
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
export const subjectKey = { formType: 'dialect', taxYear: 'taxYear', recipient: 'proprietorSsn', account: 'accountNumber' }

/** @typedef {Ts<typeof farmSchema>} Farm */
/** @typedef {Farm['entries'][number]} FarmExpenseEntry */

/** Structural-only validator: checks the shape, not the semantic refinements below. */
const validateShape = rttiValidate(farmSchema)

/**
 * Either a structural validation error or a semantic (string) error message.
 * @typedef {ValidationError | string} FarmError
 */

/**
 * An ISO calendar date, `YYYY-MM-DD` — the identical expression
 * `vnd.fjs.business_expenses`, `vnd.fjs.rental_property`,
 * `vnd.fjs.medical_expenses` and `vnd.fjs.adjustments` all use.
 * @type {RegExp}
 */
const isoDate = /^(\d{4})-(\d{2})-(\d{2})$/

/**
 * Every money field on this dialect that is NOT inside `entries`, paired with
 * its own name. ONE table, so the exactness check and the non-negativity check
 * cannot drift apart and so a field added to the schema and forgotten here is
 * visible as a missing row rather than as an unchecked amount.
 *
 * `expectedMoneyFieldCount` is the hand-typed guard AGENTS.md's fourth shipped
 * defect asks for: every loop below iterates this table, so a row silently
 * dropped would vanish from the loop in the same instant.
 * @type {(r: Farm) => readonly (readonly [string, string | undefined])[]}
 */
const moneyFieldsOf = r => [
    ['salesOfPurchasedLivestockAndOtherResaleItems', r.salesOfPurchasedLivestockAndOtherResaleItems],
    ['costOrOtherBasisOfPurchasedItems', r.costOrOtherBasisOfPurchasedItems],
    ['salesOfRaisedProductsAndLivestock', r.salesOfRaisedProductsAndLivestock],
    ['cooperativeDistributions', r.cooperativeDistributions],
    ['cooperativeDistributionsTaxableAmount', r.cooperativeDistributionsTaxableAmount],
    ['agriculturalProgramPaymentsNotReportedOnForm1099G', r.agriculturalProgramPaymentsNotReportedOnForm1099G],
    ['commodityCreditCorporationLoansReportedUnderElection', r.commodityCreditCorporationLoansReportedUnderElection],
    ['commodityCreditCorporationLoansForfeited', r.commodityCreditCorporationLoansForfeited],
    ['commodityCreditCorporationLoansForfeitedTaxableAmount', r.commodityCreditCorporationLoansForfeitedTaxableAmount],
    ['cropInsuranceProceedsReceived', r.cropInsuranceProceedsReceived],
    ['cropInsuranceProceedsTaxableAmount', r.cropInsuranceProceedsTaxableAmount],
    ['cropInsuranceProceedsDeferredFromPriorYear', r.cropInsuranceProceedsDeferredFromPriorYear],
    ['customHireIncome', r.customHireIncome],
    ['otherIncome', r.otherIncome],
    ['priorYearQualifiedBusinessLossCarryforward', r.priorYearQualifiedBusinessLossCarryforward],
    ['w2Wages', r.w2Wages],
    ['unadjustedBasisOfQualifiedProperty', r.unadjustedBasisOfQualifiedProperty],
]

/**
 * Independently HAND-COUNTED off {@link farmSchema}: fourteen printed Part I
 * amounts plus the three §199A facts. Deliberately NOT `moneyFieldsOf(...).length`.
 * @type {number}
 */
export const expectedMoneyFieldCount = 17

/**
 * The three printed *"Taxable amount"* pairs, as
 * `[gross field, taxable field, printed lines]`. Each printed pair asks for a
 * total and the part of it that is income, so the second can never exceed the
 * first — and a transcription that reverses them would OVERSTATE income on one
 * farm and understate it on the next.
 *
 * Printed lines 4a/4b are NOT in this table, and that is the one asymmetry:
 * line 4a is not stored, it is COMPUTED in `fjs/schedule/f` from Forms 1099-G
 * box 7 and box 9 plus this dialect's
 * `agriculturalProgramPaymentsNotReportedOnForm1099G`, so there is no stored
 * pair here to compare.
 * @type {(r: Farm) => readonly (readonly [string, string | undefined, string | undefined, string])[]}
 */
const taxablePairsOf = r => [
    ['cooperativeDistributions', r.cooperativeDistributions, r.cooperativeDistributionsTaxableAmount, '3a and 3b'],
    ['commodityCreditCorporationLoansForfeited', r.commodityCreditCorporationLoansForfeited, r.commodityCreditCorporationLoansForfeitedTaxableAmount, '5b and 5c'],
    ['cropInsuranceProceeds', r.cropInsuranceProceedsReceived, r.cropInsuranceProceedsTaxableAmount, '6a and 6b'],
]

/**
 * Independently HAND-COUNTED off the printed face: printed Part I prints
 * *"Taxable amount"* beside 3b, 4b, 5c and 6b — four times — and three of those
 * have a STORED gross beside them. See {@link taxablePairsOf} for why 4a/4b is
 * the fourth and is not here.
 * @type {number}
 */
export const expectedTaxablePairCount = 3

/**
 * Checks the semantic refinements the structural schema cannot express. In
 * order, and each refusal names the offending VALUE:
 *
 * 1. `principalCropOrActivity` (printed line A) is not empty or whitespace-only.
 *    It is the string a second-Schedule-F refusal quotes.
 * 2. `accountNumber` is not empty or whitespace-only — it is what a
 *    `vnd.fjs.asset_register` must match for its Form 4562 line 22 to reach
 *    printed line 14.
 * 3. `accountingMethod`, `materiallyParticipated` and `investmentAtRisk` are in
 *    their frozen vocabularies.
 * 4. Every money field is an exact decimal within safe magnitude and is NOT
 *    negative. **Printed line 1c can be negative and printed line 1b cannot**:
 *    the SUBTRACTION belongs to `fjs/schedule/f`, and a negative basis on line
 *    1b is a transcription slip whatever the difference comes to.
 * 5. Each printed *"Taxable amount"* is at most its own gross.
 * 6. The §77 election is consistent: an amount on printed line 5a
 *    (*"CCC loans reported under election"*) requires the election flag, since
 *    the line exists only for a filer who made it.
 * 7. Every `datePaid` is an ISO `YYYY-MM-DD` date whose YEAR is the document's
 *    own `taxYear`, and every entry `amount` is exact and NOT negative.
 *
 * `category` is NOT checked here. The vocabulary is printed Schedule F Part II's
 * own twenty-five expense lines, and deciding which printed line a category
 * reaches is deduction logic — `fjs/schedule/f` owns it, exactly as
 * `fjs/schedule/c` owns `vnd.fjs.business_expenses`' categories.
 * @type {(r: Farm) => Result<Farm, FarmError>}
 */
export const checkReferences = r => {
    if (r.principalCropOrActivity.trim() === '') {
        return error(
            `principalCropOrActivity must not be empty or whitespace-only — printed Schedule F `
            + `line A asks for the principal crop or activity, and it is the string a second `
            + `Schedule F refusal quotes so a filer can tell their two records apart`)
    }
    if (r.accountNumber.trim() === '') {
        return error(
            `accountNumber must not be empty or whitespace-only — it is what identifies this farm, `
            + `and what a vnd.fjs.asset_register must match for its Form 4562 line 22 to reach `
            + `printed line 14`)
    }
    for (const [name, value, vocabulary, printed] of /** @type {readonly (readonly [string, string, readonly string[], string])[]} */ ([
        ['accountingMethod', r.accountingMethod, accountingMethodValues, 'line C'],
        ['materiallyParticipated', r.materiallyParticipated, materialParticipationValues, 'line E'],
        ['investmentAtRisk', r.investmentAtRisk, investmentAtRiskValues, 'line 36'],
    ])) {
        if (!vocabulary.some(candidate => candidate === value)) {
            return error(
                `${name} ${JSON.stringify(value)} is not one of ${vocabulary.join(' or ')} — printed `
                + `Schedule F ${printed} prints two boxes and a filer ticks one of them, so this `
                + `field is one of two exact strings rather than a boolean: a serializer's empty `
                + `string or a materialized "false" would otherwise become an answer nobody gave`)
        }
    }
    for (const [name, value] of moneyFieldsOf(r)) {
        if (value === undefined) {
            continue
        }
        const message = moneyFieldError(name)(value)
        if (message !== undefined) {
            return error(message)
        }
        if (centsFromString(value) < 0n) {
            return error(
                `${name} ${value} is negative — every printed Schedule F Part I amount is a GROSS `
                + `receipt or a cost, and the one printed line that can come out negative is 1c, `
                + `which is a SUBTRACTION fjs/schedule/f performs. A negative amount stored here `
                + `would net two printed lines together somewhere no printed line can show it`)
        }
    }
    for (const [name, gross, taxable, printed] of taxablePairsOf(r)) {
        if (gross === undefined || taxable === undefined) {
            continue
        }
        if (centsFromString(taxable) > centsFromString(gross)) {
            return error(
                `${name}: the taxable amount ${taxable} exceeds the gross ${gross} — printed `
                + `Schedule F lines ${printed} ask for a total and the part of it that is income, `
                + `and reversing them would report more income than the farm received`)
        }
    }
    const cccElected = r.commodityCreditCorporationLoansReportedUnderElection
    if (cccElected !== undefined && centsFromString(cccElected) !== 0n
        && r.commodityCreditCorporationLoanProceedsReportedAsIncomeUnderElection === undefined) {
        return error(
            `commodityCreditCorporationLoansReportedUnderElection is ${cccElected} but `
            + `commodityCreditCorporationLoanProceedsReportedAsIncomeUnderElection is absent — `
            + `printed line 5a is "CCC loans reported under election", so an amount on it asserts `
            + `the §77 election that printed line 4b then reads to decide whether the market gain `
            + `from repaying a CCC loan is taxable. i1040sf p4: "don't report the market gain shown `
            + `on Form CCC-1099-G on line 4b if you elected to report CCC loan proceeds as income `
            + `in the year received"`)
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
                + `${r.taxYear} — a farm expense is deducted in the year it was paid (cash method) `
                + `or incurred (accrual method), and printed lines 10 through 32f carry one year's`)
        }
        const amountMessage = moneyFieldError(
            `amount for ${entry.description} on ${entry.datePaid}`)(entry.amount)
        if (amountMessage !== undefined) {
            return error(amountMessage)
        }
        if (centsFromString(entry.amount) < 0n) {
            return error(
                `amount ${entry.amount} for ${entry.description} is negative — a refund or rebate `
                + `reduces the expense it relates to before it reaches this record. The one printed `
                + `Schedule F expense line that takes a negative is 32f, and it takes one only for `
                + `§263A preproductive-period costs a filer CAPITALIZES: i1040sf p5 says to "enter `
                + `the total amount capitalized in parentheses on line 32f […] and enter 263A in `
                + `the space to the left". This engine does not model the uniform capitalization `
                + `rules, so that filer is refused here rather than deducted wrongly`)
        }
    }
    return ok(r)
}

/**
 * Validates an already-parsed JSON value as a `farm` BLOB: structural (rtti)
 * validation followed by {@link checkReferences}. Dialect discrimination happens
 * exclusively through the schema's exact-literal `dialect` constant — the
 * serialized JSON text is never inspected.
 * @type {(value: Unknown) => Result<Farm, FarmError>}
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
 * A cash-method farm that materially participated with all investment at risk,
 * asserting no prior-year crop insurance deferral — the case Schedule F
 * computes.
 * @type {Farm}
 */
export const minimalFarm = {
    dialect,
    proprietorSsn: '222-22-2222',
    accountNumber: 'FARM-0001',
    taxYear: 2025,
    principalCropOrActivity: 'corn and soybeans',
    accountingMethod: 'cash',
    materiallyParticipated: 'yes',
    investmentAtRisk: 'allAtRisk',
    salesOfRaisedProductsAndLivestock: '142600.00',
    cropInsuranceProceedsDeferredFromPriorYear: '0.00',
    entries: [],
}

/** An ordinary printed line 16 expense. */
const feedExpense = {
    category: 'feed',
    datePaid: '2025-04-15',
    description: 'winter hay',
    amount: '31250.00',
}

export const proof = {
    dialectAndMediaType: () => {
        assertEq(dialect, 'vnd.fjs.farm')
        assertEq(mediaType, 'application/vnd.fjs.farm+json')
    },

    /**
     * **The two identity fields, asserted rather than described.**
     * `proprietorSsn` is the printed header's "Social security number (SSN)"
     * and plays {@link subjectKey}'s `recipient` role; `accountNumber` is the
     * `account` role and has no printed counterpart at all. Nothing else in
     * this module would notice the two being transposed: the schema types
     * both as `string`, and a transposed pair still derives a well-formed
     * subject — for the WRONG farm, under an `accountNumber` no
     * `vnd.fjs.asset_register` could match.
     *
     * The two are asserted by FORMAT rather than merely by value: an SSN
     * (`NNN-NN-NNNN`) for the person and a plain farm identifier for the
     * account, so a swap is visible in the assertion itself. The neighbouring
     * `checkReferences` leaf pins that an empty `accountNumber` REFUSES; this
     * one pins which field it is.
     */
    theProprietorAndTheFarmIdentifierAreNotTransposed: () => {
        const [t, v] = validate(minimalFarm)
        assert(t === 'ok', ['expected ok', t, v])
        if (t !== 'ok') {
            throw ['expected ok', t, v]
        }
        assertEq(
            v.proprietorSsn,
            '222-22-2222',
            'proprietorSsn holds the printed header SSN — the person, in an SSN format',
        )
        assertEq(
            v.accountNumber,
            'FARM-0001',
            'accountNumber identifies the FARM, and is what an asset register must match',
        )
        assert(
            v.proprietorSsn !== v.accountNumber,
            ['the person and the farm are two different identifiers', v.proprietorSsn, v.accountNumber],
        )
    },
    // Three printed two-box questions, hand-typed off the printed face: line C
    // "Cash / Accrual", line E "Yes / No", line 36 "a All investment is at
    // risk / b Some investment is not at risk".
    thePrintedTwoBoxQuestions: () => {
        assertEq(accountingMethodValues.length, 2)
        assertEq(accountingMethodValues[0], 'cash')
        assertEq(accountingMethodValues[1], 'accrual')
        assertEq(materialParticipationValues.length, 2)
        assertEq(materialParticipationValues[0], 'yes')
        assertEq(materialParticipationValues[1], 'no')
        assertEq(investmentAtRiskValues.length, 2)
        assertEq(investmentAtRiskValues[0], 'allAtRisk')
        assertEq(investmentAtRiskValues[1], 'someNotAtRisk')
    },
    // The money-field table's own hand-typed count, and the taxable-pair
    // table's. Both exist so a row dropped from either table fails HERE rather
    // than silently shortening every loop that iterates it.
    theMoneyFieldTablesAreTheSizeTheyWereCountedAt: () => {
        assertEq(moneyFieldsOf(minimalFarm).length, expectedMoneyFieldCount)
        assertEq(new Set(moneyFieldsOf(minimalFarm).map(([name]) => name)).size,
            expectedMoneyFieldCount)
        assertEq(taxablePairsOf(minimalFarm).length, expectedTaxablePairCount)
        assertEq(new Set(taxablePairsOf(minimalFarm).map(([name]) => name)).size,
            expectedTaxablePairCount)
    },
    validate: {
        minimalFarmValidates: () => {
            const [t, v] = validate(minimalFarm)
            assert(t === 'ok', ['expected ok', t, v])
            assertEq(v.entries.length, 0)
            assertEq(v.accountingMethod, 'cash')
            assertEq(v.materiallyParticipated, 'yes')
            assertEq(v.investmentAtRisk, 'allAtRisk')
            assertEq(v.cropInsuranceProceedsDeferredFromPriorYear, '0.00')
            assertEq(v.corrected, undefined)
            assertEq(v.electionToDeferCropInsuranceProceeds, undefined)
        },
        populatedRoundTrips: () => {
            const [t, v] = validate({
                ...minimalFarm,
                corrected: true,
                salesOfPurchasedLivestockAndOtherResaleItems: '18400.00',
                costOrOtherBasisOfPurchasedItems: '14250.00',
                cooperativeDistributions: '2310.00',
                cooperativeDistributionsTaxableAmount: '2310.00',
                commodityCreditCorporationLoanProceedsReportedAsIncomeUnderElection: true,
                commodityCreditCorporationLoansReportedUnderElection: '5000.00',
                cropInsuranceProceedsReceived: '11400.00',
                cropInsuranceProceedsTaxableAmount: '11400.00',
                customHireIncome: '6800.00',
                otherIncome: '1225.00',
                priorYearQualifiedBusinessLossCarryforward: '0.00',
                w2Wages: '26500.00',
                unadjustedBasisOfQualifiedProperty: '412000.00',
                entries: [feedExpense],
            })
            assert(t === 'ok', ['expected ok', t, v])
            assertEq(v.corrected, true)
            assertEq(v.costOrOtherBasisOfPurchasedItems, '14250.00')
            assertEq(v.commodityCreditCorporationLoanProceedsReportedAsIncomeUnderElection, true)
            assertEq(v.w2Wages, '26500.00')
            assertEq(v.entries.length, 1)
            const [only] = v.entries
            assert(only !== undefined, ['expected the entry', v.entries])
            assertEq(only.category, 'feed')
            assertEq(only.amount, '31250.00')
        },
        // Each of the three two-box questions refuses an off-vocabulary value
        // by name, and each accepts BOTH of its own printed answers. The second
        // half is the control: a check that refused everything would pass the
        // first half alone.
        theThreeTwoBoxQuestionsRefuseOffVocabularyValues: () => {
            /** @type {readonly (readonly [string, string, string])[]} */
            const rejected = [
                ['accountingMethod', 'hybrid', 'line C'],
                ['materiallyParticipated', 'true', 'line E'],
                ['investmentAtRisk', '', 'line 36'],
            ]
            assertEq(rejected.length, 3)
            for (const [field, bad, printed] of rejected) {
                const [t, v] = validate({ ...minimalFarm, [field]: bad })
                assert(t === 'error', ['expected a refusal', field, t, v])
                assert(typeof v === 'string' && v.includes(field), ['expected the field named', v])
                assert(typeof v === 'string' && v.includes(printed),
                    ['expected the printed line named', v])
                assert(typeof v === 'string' && v.includes(JSON.stringify(bad)),
                    ['expected the value quoted', v])
            }
            /** @type {readonly (readonly [string, readonly string[]])[]} */
            const accepted = [
                ['accountingMethod', accountingMethodValues],
                ['materiallyParticipated', materialParticipationValues],
                ['investmentAtRisk', investmentAtRiskValues],
            ]
            for (const [field, vocabulary] of accepted) {
                for (const value of vocabulary) {
                    const [t, v] = validate({ ...minimalFarm, [field]: value })
                    assert(t === 'ok', ['both printed answers are storable', field, value, t, v])
                }
            }
        },
        blankPrintedLineARefuses: () => {
            const [t, v] = validate({ ...minimalFarm, principalCropOrActivity: '   ' })
            assert(t === 'error', ['expected a refusal', t, v])
            assert(typeof v === 'string' && v.includes('principalCropOrActivity'),
                ['expected the field named', v])
            assert(typeof v === 'string' && v.includes('line A'), ['expected the printed line', v])
        },
        blankAccountNumberRefuses: () => {
            const [t, v] = validate({ ...minimalFarm, accountNumber: '  ' })
            assert(t === 'error', ['expected a refusal', t, v])
            assert(typeof v === 'string' && v.includes('accountNumber'), ['expected the field named', v])
            assert(typeof v === 'string' && v.includes('line 14'), ['expected the printed line', v])
        },
        // EVERY money field on the table refuses a negative, by its own name.
        // Seventeen of them, driven off the table so a field added to the
        // schema and forgotten cannot pass.
        everyMoneyFieldRefusesANegative: () => {
            let checked = 0
            for (const [name] of moneyFieldsOf(minimalFarm)) {
                const [t, v] = validate({ ...minimalFarm, [name]: '-1.00' })
                assert(t === 'error', ['expected a refusal', name, t, v])
                assert(typeof v === 'string' && v.includes(name), ['expected the field named', name, v])
                assert(typeof v === 'string' && v.includes('-1.00'), ['expected the amount quoted', name, v])
                checked = checked + 1
            }
            assertEq(checked, expectedMoneyFieldCount)
            // The control: the same field at a POSITIVE amount validates. The
            // §77 flag rides along because printed line 5a's own cross-check
            // would otherwise refuse ONE of the seventeen and make this control
            // read as a pass for a rule that had fired.
            for (const [name] of moneyFieldsOf(minimalFarm)) {
                const [t, v] = validate({
                    ...minimalFarm,
                    commodityCreditCorporationLoanProceedsReportedAsIncomeUnderElection: true,
                    [name]: '1.00',
                })
                assert(t === 'ok', ['a positive amount is storable', name, t, v])
            }
        },
        aNegativeEntryAmountRefusesNamingSection263A: () => {
            const [t, v] = validate({
                ...minimalFarm, entries: [{ ...feedExpense, amount: '-5.00' }],
            })
            assert(t === 'error', ['expected a refusal', t, v])
            assert(typeof v === 'string' && v.includes('winter hay'), ['expected the entry named', v])
            assert(typeof v === 'string' && v.includes('32f'), ['expected the printed line', v])
            assert(typeof v === 'string' && v.includes('263A'), ['expected the statute', v])
        },
        // The three printed "Taxable amount" pairs, each in both directions.
        aTaxableAmountMayNotExceedItsGross: () => {
            /** @type {readonly (readonly [string, string, string])[]} */
            const pairs = [
                ['cooperativeDistributions', 'cooperativeDistributionsTaxableAmount', '3a and 3b'],
                ['commodityCreditCorporationLoansForfeited',
                    'commodityCreditCorporationLoansForfeitedTaxableAmount', '5b and 5c'],
                ['cropInsuranceProceedsReceived', 'cropInsuranceProceedsTaxableAmount', '6a and 6b'],
            ]
            assertEq(pairs.length, expectedTaxablePairCount)
            for (const [gross, taxable, printed] of pairs) {
                const [t, v] = validate({
                    ...minimalFarm, [gross]: '100.00', [taxable]: '100.01',
                })
                assert(t === 'error', ['expected a refusal', gross, t, v])
                assert(typeof v === 'string' && v.includes(printed),
                    ['expected the printed lines named', printed, v])
                assert(typeof v === 'string' && v.includes('100.01'),
                    ['expected the taxable amount quoted', v])
                // THE CONTROL, one cent the other way: equal is legal, because
                // the whole of a forfeited loan is routinely taxable.
                const [t2, v2] = validate({
                    ...minimalFarm, [gross]: '100.00', [taxable]: '100.00',
                })
                assert(t2 === 'ok', ['equal is not "exceeds"', gross, t2, v2])
            }
        },
        // §77: printed line 5a exists only for a filer who made the election,
        // and printed line 4b reads the election.
        anAmountOnPrintedLineFiveANeedsTheElectionFlag: () => {
            const [t, v] = validate({
                ...minimalFarm, commodityCreditCorporationLoansReportedUnderElection: '5000.00',
            })
            assert(t === 'error', ['expected a refusal', t, v])
            assert(typeof v === 'string' && v.includes('§77'), ['expected the statute', v])
            assert(typeof v === 'string' && v.includes('line 4b'), ['expected the printed line', v])
            assert(typeof v === 'string' && v.includes('5000.00'), ['expected the amount quoted', v])
            // THE CONTROL: the flag makes it storable.
            const [t2, v2] = validate({
                ...minimalFarm,
                commodityCreditCorporationLoansReportedUnderElection: '5000.00',
                commodityCreditCorporationLoanProceedsReportedAsIncomeUnderElection: true,
            })
            assert(t2 === 'ok', ['expected ok', t2, v2])
            // And a stored ZERO on line 5a is not an assertion of anything, so
            // it needs no flag. `'0'` and `'-0.00'` are the same zero, which is
            // why the check re-parses rather than comparing the printed string.
            const [t3, v3] = validate({
                ...minimalFarm, commodityCreditCorporationLoansReportedUnderElection: '0.00',
            })
            assert(t3 === 'ok', ['a zero on line 5a asserts nothing', t3, v3])
        },
        datePaidMustBeInTheDocumentsTaxYear: () => {
            const [t, v] = validate({
                ...minimalFarm, entries: [{ ...feedExpense, datePaid: '2024-04-15' }],
            })
            assert(t === 'error', ['expected a refusal', t, v])
            assert(typeof v === 'string' && v.includes('2024-04-15'), ['expected the date quoted', v])
            const [t2, v2] = validate({
                ...minimalFarm, entries: [{ ...feedExpense, datePaid: '15/04/2025' }],
            })
            assert(t2 === 'error', ['expected a refusal', t2, v2])
            assert(typeof v2 === 'string' && v2.includes('ISO'), ['expected the format named', v2])
        },
        // DOC-00: another dialect's blob is rejected structurally, on the
        // discriminant, before any semantic check runs.
        anotherDialectsBlobIsRejectedOnTheDiscriminant: () => {
            const [t, v] = validate({ ...minimalFarm, dialect: 'vnd.fjs.business_expenses' })
            assert(t === 'error', ['expected a refusal', t, v])
            assert(typeof v !== 'string', ['expected a STRUCTURAL error, not a semantic one', v])
        },
        // `category` is deliberately NOT constrained here. The control that
        // says so: a category no printed line names still validates, and
        // `fjs/schedule/f` is what refuses it.
        anUnknownCategoryIsNotThisModulesBusiness: () => {
            const [t, v] = validate({
                ...minimalFarm, entries: [{ ...feedExpense, category: 'moonBeams' }],
            })
            assert(t === 'ok', ['the category vocabulary lives one layer out', t, v])
        },
    },
}
