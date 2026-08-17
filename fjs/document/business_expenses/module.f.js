/**
 * `vnd.fjs.business_expenses` — DOC-21, the substantiation record behind
 * Schedule C Part II's expenses, and behind the one fact about Part I that no
 * information return can supply.
 *
 * **This dialect is not a transcribed IRS form, and that is the whole point of
 * it** — the identical opening `vnd.fjs.medical_expenses`,
 * `vnd.fjs.itemized_deductions` and `vnd.fjs.adjustments` all make, for the
 * identical reason. No information return reports what a sole proprietor spent
 * on advertising, office rent or professional fees: no payer files one, and
 * nothing arrives in the mail shaped like Schedule C Part II. So this document
 * is *taxpayer-asserted*, and every design decision below is
 * `vnd.fjs.medical_expenses`' and `vnd.fjs.adjustments`', followed rather than
 * re-argued:
 *
 * - **No `formRevision`.** DOC-10 exists because box semantics drift between
 *   revisions of a printed form; there is no printed form and no boxes here.
 * - **No total.** Nothing sums the entries. A stored total would be a second
 *   source of truth able to disagree with the entries it came from, and every
 *   Part II line total belongs to `fjs/schedule/c`.
 * - **`category` is a free string**, mirroring `vnd.fjs.medical_expenses`'
 *   `category` and `vnd.fjs.itemized_deductions`' `lineTag`: deciding which
 *   printed Part II line a payment belongs on is deduction logic, and
 *   `fjs/schedule/c` is where an unrecognized category is REFUSED by name
 *   rather than silently dropped. That module owns the category-to-line
 *   mapping, and owns it TOTALLY — a category with no line is a `tsc` error
 *   there, not a silently missing expense.
 *
 * ## One document is one BUSINESS, and that is the cardinality decision
 *
 * `vnd.fjs.adjustments` keys its subject on an empty payer and an empty
 * account number, which makes exactly one such record per taxpayer per tax
 * year — the right cardinality for one running record of adjustments.
 *
 * **Schedule C is different: it is filed PER BUSINESS.** A taxpayer who
 * drives for a rideshare company and also sells pottery files two Schedule Cs,
 * with two separate line 31s, two separate at-risk determinations and (from
 * Phase 28) two separate contributions to one Schedule SE. So one document
 * here is one business, `accountNumber` carries the business's own
 * identifier under DOC-01's subject key, and `principalBusiness` (the printed
 * Schedule C line A) names it in prose.
 *
 * `fjs/schedule/c` supports exactly ONE business and REFUSES a second by name,
 * quoting both `principalBusiness` strings. It does not merge them: merging
 * two businesses into one Schedule C is not an approximation, it is a
 * different return, and the two would share an at-risk determination and a
 * home-office allocation that belong to neither.
 *
 * ## `grossReceiptsFullyReportedOnForms1099Nec` — the field that exists only
 * so an uncomputable return can say so out loud
 *
 * `vnd.fjs.adjustments` carries two such fields already, and its own header
 * states the pattern: some facts are recorded *"only so a return this engine
 * cannot compute can still say so out loud, rather than being computed
 * wrongly."* This is the third, and it guards the sharpest hole in this whole
 * phase.
 *
 * Schedule C line 1 is GROSS RECEIPTS — everything the business took in.
 * `fjs/schedule/c` reads it from Form 1099-NEC box 1, which is the only
 * document this engine holds that reports business receipts at all. But
 * §6041A obliges a payer to file a 1099-NEC only for $600 or more, and only if
 * the payer is itself in a trade or business. So cash receipts, payments from
 * private individuals, and every client under $600 appear on NO form —
 * and a line 1 read from Forms 1099-NEC alone would UNDERSTATE gross receipts
 * and therefore the tax, silently, with every proof green.
 *
 * That is the failure TAX-16 exists to prevent, so it is converted into an
 * explicit assertion: absent means `fjs/schedule/c` REFUSES, naming the
 * §6041A threshold. Present means the taxpayer has affirmed that their own
 * records agree with the Forms 1099-NEC stored beside this one. This engine
 * cannot check that claim — but an unchecked claim a taxpayer made is a
 * different thing from an unstated assumption an engine made for them.
 *
 * It follows DOC-12's checkbox convention (`option(true)`), so a stored
 * `false` is structurally rejected and absence is the only way to say "no" —
 * exactly as `vnd.fjs.adjustments`' `hadHighDeductibleCoverageAllYear` does,
 * and for the same reason: a serializer that helpfully materializes every key
 * cannot smuggle a false assertion in as a true one.
 *
 * ## `priorYearQualifiedBusinessLossCarryforward` — the SECOND field of that
 * kind, added in Phase 28 (TAX-32), and it guards the sharpest hole in THAT
 * phase
 *
 * §199A(c)(2): *"if the net amount of qualified business income … for any
 * taxable year is less than zero, such amount shall be treated as a loss from
 * a qualified trade or business in the succeeding taxable year."* Form 8995
 * line 3 is where that carryforward lands, and it REDUCES the §199A deduction.
 *
 * **This engine holds one tax year, so it cannot know the figure — and the
 * direction of the error is the dangerous one.** Reading an absent
 * carryforward as zero would overstate the deduction and understate the tax,
 * which is exactly TAX-16's failure mode. And the case is not exotic: a
 * startup founder with a loss in year one and a profit in year two is the
 * canonical §199A(c)(2) taxpayer, and is precisely the persona Phase 28 exists
 * to unblock.
 *
 * The engine's own precedent for a prior-year figure is
 * `vnd.fjs.prior_year_capital_loss`, a separate dialect whose ABSENCE means
 * none — a reading that is safe there, because a capital-loss carryover is a
 * DEDUCTION and assuming none overstates the tax. Here absence would go the
 * other way, so absence cannot mean none. It means *unstated*, and
 * `fjs/form8995` refuses the return by name when a §199A deduction would
 * otherwise be computed.
 *
 * **A `string` rather than `option(true)`**, unlike the field above it,
 * because this one carries an AMOUNT and not a checkbox: `'0.00'` is the
 * assertion "I had no prior-year qualified business loss", and it is a
 * different statement from the field being absent. It holds the SIZE of the
 * loss as a non-negative amount; Form 8995 line 3 prints it in parentheses and
 * is where it becomes a subtraction.
 *
 * ## `specifiedServiceTradeOrBusiness`, `w2Wages` and
 * `unadjustedBasisOfQualifiedProperty` — the THREE fields Form 8995-A needs,
 * added in Phase 31 (TAX-32) at the same time as the reader that uses them
 *
 * Phase 28 deliberately did NOT add an SSTB field, and its reasoning was
 * correct at the time: below §199A(e)(2)'s threshold a specified service trade
 * or business is a qualified trade or business like any other, with no
 * reduction at all, so the field could only ever be read above the threshold —
 * which is exactly where that phase refused. **A stored field with no reader is
 * the `box13StatutoryEmployee` defect**, modeled since its dialect was written
 * and read by nothing while the engine quietly produced a wrong answer for the
 * filers it concerned. This repo has now paid for that twice.
 *
 * `fjs/form8995a` is that reader, and it arrives in the same phase as these
 * fields. Each is one printed input Form 8995-A cannot compute for itself:
 *
 * | Field | Printed line | Why nothing else can supply it |
 * |---|---|---|
 * | `specifiedServiceTradeOrBusiness` | Schedule A line 1a's own "check if specified service" | §199A(d)(2) is a question about what the business DOES |
 * | `w2Wages` | Form 8995-A line 4 | this engine reads no Forms W-2 the taxpayer ISSUED, only ones they received |
 * | `unadjustedBasisOfQualifiedProperty` | Form 8995-A line 7 | an asset basis history; Schedule C line 13 already refuses for the same absence |
 *
 * **Absence refuses; it never defaults** — and for the SSTB flag both defaults
 * are wrong for somebody. Defaulting to "not a specified service business"
 * would grant a consultant above the threshold a deduction §199A(d)(1) denies
 * them, understating the tax. Defaulting the other way would deny a plumber the
 * deduction they are owed, overstating it. Both are silent. So the field is
 * three-state, and `fjs/form8995a` refuses BY NAME when it is unstated and the
 * answer would depend on it.
 *
 * **A string, not `option(true)` and not `option(boolean)`**, which is a
 * departure from DOC-12's checkbox convention worth stating precisely:
 *
 * - `option(true)` cannot express this field. Absence is that convention's way
 *   of saying "no", and here "no" is a substantive assertion that RAISES the
 *   deduction. The convention is right where absence is the safe reading —
 *   `grossReceiptsFullyReportedOnForms1099Nec` above is exactly that — and
 *   wrong here for the same reason `priorYearQualifiedBusinessLossCarryforward`
 *   is not a checkbox either.
 * - `option(boolean)` expresses three states but makes the dangerous one cheap.
 *   The hazard this dialect already names — *"a serializer that helpfully
 *   materializes every key"* — would write `false`, indistinguishable from a
 *   taxpayer who answered no. As one of two exact strings, a materialized
 *   `false` or `''` fails the vocabulary check and is refused, quoted.
 *
 * `w2Wages` and `unadjustedBasisOfQualifiedProperty` follow
 * `priorYearQualifiedBusinessLossCarryforward` exactly instead: a money string,
 * non-negative, where `'0.00'` is the assertion "none" and absence is
 * *unstated*. **`'0.00'` is the ordinary case for wages**, not an edge case — a
 * sole proprietor with no employees issues no Forms W-2 — and it is still an
 * assertion the taxpayer has to make, because the engine cannot tell that
 * proprietor apart from one who simply has not looked yet.
 *
 * ## The date rule is `vnd.fjs.medical_expenses`', not `vnd.fjs.adjustments`'
 *
 * An HSA contribution may be made in the FOLLOWING calendar year and
 * designated for this tax year, which is why that dialect accepts
 * `taxYear + 1`. **A business expense has no such rule**: a cash-basis
 * proprietor deducts what they paid during the year, and an accrual-basis one
 * deducts what they incurred during the year. Either way the year is the
 * document's own `taxYear`, so any other year is refused here, exactly as
 * `vnd.fjs.medical_expenses` refuses one.
 *
 * The exact calendar is deliberately not checked, for the reason that dialect
 * gives about a 31st of February: a 30th of February is a calendar's problem,
 * not a storage boundary's.
 *
 * ## A negative amount is refused, and that is a departure worth stating
 *
 * `fjs/document/money_field` accepts a negative amount, deliberately —
 * `vnd.fjs.prior_year_capital_loss` needs one. An EXPENSE does not. A refund
 * or rebate reduces the expense it relates to in the taxpayer's own records
 * before it reaches this document, and a negative entry here is either that
 * netting done in the wrong place or an attempt to book income onto an expense
 * line, where nothing downstream would ever look at it again. So it is refused
 * by name, quoting the amount.
 *
 * @module
 */
import { array, number, option, string } from 'functionalscript/fjs/types/rtti/module.f.js'
import { validate as rttiValidate } from 'functionalscript/fjs/types/rtti/validate/module.f.js'
import { error, ok } from 'functionalscript/fjs/types/result/module.f.js'
import { assert, assertEq } from 'functionalscript/fjs/asserts/module.f.js'
import { centsFromString } from '../../exact/module.f.js'
import { base, mediaTypeOf } from '../base/module.f.js'
import { moneyFieldError } from '../money_field/module.f.js'

/** @import { Result } from 'functionalscript/fjs/types/result/module.f.js' */
/** @import { Ts, Unknown } from 'functionalscript/fjs/types/rtti/ts/module.f.js' */
/** @import { ValidationError } from 'functionalscript/fjs/types/rtti/validate/module.f.js' */

/**
 * Format tag: names the dialect of this BLOB. The media type it is served
 * with is derived mechanically: `application/` + `dialect` + `+json`.
 */
export const dialect = 'vnd.fjs.business_expenses'
/** The media type derived from {@link dialect}: `application/vnd.fjs.business_expenses+json`. */
export const mediaType = mediaTypeOf(dialect)

/**
 * One expense the taxpayer asserts they paid or incurred.
 *
 * `category` is free text here and constrained one layer out — see this
 * module's own docstring. `description` mirrors `vnd.fjs.medical_expenses`'
 * `provider` and `vnd.fjs.adjustments`' own `description`: free text naming
 * what the payment was, so a refusal can name something a reader recognizes on
 * their own records rather than only "some entry".
 */
const expenseEntry = /** @type {const} */ ({
    category: string,
    datePaid: string,
    description: string,
    amount: string,
})

/**
 * rtti schema for a `business_expenses` BLOB. `dialect` is spread first (via
 * `base`) so structural validation reports it as the first failing field on a
 * mismatched blob (DOC-00's discriminant). NO `formRevision` — DOC-10 does not
 * apply; there is no printed form.
 *
 * `accountNumber` is REQUIRED, unlike `vnd.fjs.adjustments`, which has none:
 * it is what makes DOC-01's subject key distinguish one business's running
 * record from another's — see this module's docstring, "One document is one
 * BUSINESS".
 */
export const businessExpensesSchema = /** @type {const} */ ({
    ...base(dialect),
    recipientTin: string,
    accountNumber: string,
    taxYear: number,
    corrected: option(true),
    principalBusiness: string,
    businessName: option(string),
    grossReceiptsFullyReportedOnForms1099Nec: option(true),
    priorYearQualifiedBusinessLossCarryforward: option(string),
    specifiedServiceTradeOrBusiness: option(string),
    w2Wages: option(string),
    unadjustedBasisOfQualifiedProperty: option(string),
    entries: array(expenseEntry),
})

/**
 * The two things a taxpayer can SAY about §199A(d)(2), and there is no third.
 * Stored as one of these exact strings rather than as a boolean — see this
 * module's docstring for why a materialized `false` would be a silent
 * assertion, and why absence must be neither.
 *
 * A frozen two-element vocabulary in the `fjs/exec` `refusals` shape: a value
 * outside it is refused by name and quoted, so a serializer's `''` or a
 * hand-edited `'true'` cannot become an assertion by accident.
 */
export const specifiedServiceTradeOrBusinessValues = /** @type {const} */ ([
    'specifiedService', 'notSpecifiedService',
])

/** @typedef {Ts<typeof businessExpensesSchema>} BusinessExpenses */

/** Structural-only validator: checks the shape, not the semantic refinements below. */
const validateShape = rttiValidate(businessExpensesSchema)

/**
 * Either a structural validation error or a semantic (string) error message.
 * @typedef {ValidationError | string} BusinessExpensesError
 */

/**
 * An ISO calendar date, `YYYY-MM-DD` — the identical expression
 * `vnd.fjs.medical_expenses` and `vnd.fjs.adjustments` both use, and identical
 * in what it deliberately does not check.
 * @type {RegExp}
 */
const isoDate = /^(\d{4})-(\d{2})-(\d{2})$/

/**
 * Checks the semantic refinements the structural schema cannot express:
 *
 * 1. `principalBusiness` (Schedule C line A) is not empty or whitespace-only.
 *    The printed form requires it, and it is the string a multiple-business
 *    refusal quotes — a blank one would make that refusal unreadable.
 * 2. Every `datePaid` is an ISO `YYYY-MM-DD` date whose YEAR is the document's
 *    own `taxYear`. See this module's docstring for why the rule is
 *    `vnd.fjs.medical_expenses`' and not `vnd.fjs.adjustments`' looser one.
 * 3. Every `amount` is an exact decimal within safe magnitude, and is NOT
 *    negative.
 * 4. `priorYearQualifiedBusinessLossCarryforward`, when present, is an exact
 *    decimal within safe magnitude and is NOT negative — it is the SIZE of a
 *    loss, not a signed figure. Form 8995 line 3 prints it in parentheses and
 *    `fjs/form8995` negates it there; storing it signed would put the minus
 *    sign in two places and let the two disagree.
 *
 * Every refusal names the offending VALUE and the entry it came from: a
 * message saying "an amount is negative" tells a reader what the rule is, and
 * one that also quotes `-450.00` and `client dinner` tells them where to look.
 * @type {(r: BusinessExpenses) => Result<BusinessExpenses, BusinessExpensesError>}
 */
export const checkReferences = r => {
    const carryforward = r.priorYearQualifiedBusinessLossCarryforward
    if (carryforward !== undefined) {
        const carryforwardMessage = moneyFieldError(
            'priorYearQualifiedBusinessLossCarryforward')(carryforward)
        if (carryforwardMessage !== undefined) {
            return error(carryforwardMessage)
        }
        if (centsFromString(carryforward) < 0n) {
            return error(
                `priorYearQualifiedBusinessLossCarryforward ${carryforward} is negative — this `
                + `field holds the SIZE of a prior-year qualified business loss, and Form 8995 `
                + `line 3 is where it becomes a subtraction. A negative value here would subtract `
                + `it twice, INCREASING the §199A deduction that the carryforward exists to `
                + `reduce`)
        }
    }
    // ── TAX-32 (Phase 31): Form 8995-A's three per-business facts ───────────
    // `specifiedServiceTradeOrBusiness` is checked against the frozen
    // vocabulary above, never against a truthiness test: the whole point of the
    // string form is that an unrecognised value is a REFUSAL rather than a
    // silent "no".
    const sstb = r.specifiedServiceTradeOrBusiness
    if (sstb !== undefined
        && !specifiedServiceTradeOrBusinessValues.some(candidate => candidate === sstb)) {
        return error(
            `specifiedServiceTradeOrBusiness ${JSON.stringify(sstb)} is not one of `
            + `${specifiedServiceTradeOrBusinessValues.join(' or ')} — §199A(d)(2) admits exactly `
            + `two answers, and this field is a string rather than a boolean precisely so that a `
            + `serializer's empty string or a hand-edited "true" cannot become an assertion that `
            + `this business is NOT a specified service trade or business. That assertion raises `
            + `the deduction, so it has to be said deliberately or not at all`)
    }
    // Form 8995-A printed line 4 (W-2 wages) and line 7 (UBIA). Both are money
    // magnitudes, both non-negative, and both are read ONLY above §199A(e)(2)'s
    // threshold — `fjs/form8995a` refuses by name when one is missing there.
    for (const [name, value] of /** @type {readonly (readonly [string, string | undefined])[]} */ ([
        ['w2Wages', r.w2Wages],
        ['unadjustedBasisOfQualifiedProperty', r.unadjustedBasisOfQualifiedProperty],
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
                `${name} ${value} is negative — Form 8995-A lines 4 and 7 hold a wage total and an `
                + `asset basis, and neither can be less than nothing. A negative one would make the `
                + `W-2/UBIA cap on line 10 negative and, through the "greater of" on line 13, `
                + `hand the deduction back the limitation exists to remove`)
        }
    }
    if (r.principalBusiness.trim() === '') {
        return error(
            `principalBusiness must not be empty or whitespace-only — Schedule C line A names the `
            + `principal business or profession, and it is what names this business when a return `
            + `carries more than one`)
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
                + `${r.taxYear} — a business expense is deducted in the year it was paid or `
                + `incurred, and unlike a health savings account contribution there is no rule `
                + `letting a later payment be designated for an earlier year`)
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
                + `expense entry would book income onto a Schedule C Part II line where nothing `
                + `reads it`)
        }
    }
    return ok(r)
}

/**
 * Validates an already-parsed JSON value as a `business_expenses` BLOB:
 * structural (rtti) validation followed by {@link checkReferences}. Dialect
 * discrimination happens exclusively through the schema's exact-literal
 * `dialect` constant — the serialized JSON text is never inspected.
 * @type {(value: Unknown) => Result<BusinessExpenses, BusinessExpensesError>}
 */
export const validate = value => {
    const [t, v] = validateShape(value)
    if (t === 'error') {
        return error(v)
    }
    return checkReferences(v)
}

// ── Tests ────────────────────────────────────────────────────────────────────

/** @type {BusinessExpenses} */
const minimal = {
    dialect,
    recipientTin: '222-22-2222',
    accountNumber: 'BUS-0001',
    taxYear: 2025,
    principalBusiness: 'software consulting',
    entries: [],
}

/** An ordinary Part II line 8 expense. */
const advertising = {
    category: 'advertising',
    datePaid: '2025-03-14',
    description: 'search advertising',
    amount: '1250.00',
}

/** An ordinary Part II line 18 expense. */
const officeExpense = {
    category: 'officeExpense',
    datePaid: '2025-07-01',
    description: 'printer toner',
    amount: '184.99',
}

export const proof = {
    dialectAndMediaType: () => {
        assertEq(dialect, 'vnd.fjs.business_expenses')
        assertEq(mediaType, 'application/vnd.fjs.business_expenses+json')
    },
    validate: {
        // A proprietor who has recorded no expenses yet is a real state, and
        // it is not the same as having no document: the document still
        // asserts the business exists and (perhaps) that its receipts are
        // fully reported.
        emptyEntriesValidates: () => {
            const [t, v] = validate(minimal)
            assert(t === 'ok', ['expected ok', t, v])
            assertEq(v.entries.length, 0)
            assertEq(v.grossReceiptsFullyReportedOnForms1099Nec, undefined)
            assertEq(v.businessName, undefined)
        },
        populatedRoundTrips: () => {
            const [t, v] = validate({
                ...minimal,
                businessName: 'Acme Consulting',
                grossReceiptsFullyReportedOnForms1099Nec: true,
                entries: [advertising, officeExpense],
            })
            assert(t === 'ok', ['expected ok', t, v])
            assertEq(v.entries.length, 2)
            assertEq(v.entries[0]?.category, 'advertising')
            assertEq(v.entries[0]?.amount, '1250.00')
            assertEq(v.entries[1]?.description, 'printer toner')
            assertEq(v.businessName, 'Acme Consulting')
            assertEq(v.grossReceiptsFullyReportedOnForms1099Nec, true)
        },
        wrongDialectRejected: () => {
            const [t, v] = validate({ ...minimal, dialect: 'vnd.fjs.adjustments' })
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
    principalBusiness: {
        // Schedule C line A is required on the printed form, and this record
        // needs it for a second reason: it is the string a two-business
        // refusal quotes.
        emptyIsRefused: () => {
            const [t, v] = validate({ ...minimal, principalBusiness: '' })
            assertEq(t, 'error')
            assert(
                typeof v === 'string' && v.includes('principalBusiness'),
                ['the refusal must name the field', v])
            assert(
                typeof v === 'string' && v.includes('line A'),
                ['the refusal must name the printed line it comes from', v])
        },
        whitespaceIsRefused: () => {
            assertEq(validate({ ...minimal, principalBusiness: '   ' })[0], 'error')
        },
        // The CONTROL: an ordinary description is accepted. A check that
        // refused every string would pass the two leaves above.
        anOrdinaryDescriptionIsAccepted: () => {
            assertEq(validate({ ...minimal, principalBusiness: 'pottery' })[0], 'ok')
        },
        // `businessName` (Schedule C line C) is OPTIONAL, and that is the
        // printed form's own instruction: "if no separate business name,
        // leave blank." A sole proprietor trading under their own name has
        // none, and this is what stops that being an error.
        businessNameIsOptionalBecauseThePrintedFormSaysSo: () => {
            const [t, v] = validate(minimal)
            assert(t === 'ok', ['expected ok', t, v])
            assertEq(Object.keys(v).includes('businessName'), false)
        },
    },
    grossReceiptsAssertion: {
        // DOC-12: `option(true)`, so a stored `false` is structurally
        // rejected and absence is the only way to say "no". Asserted on the
        // one field whose absence is load-bearing — `fjs/schedule/c` REFUSES
        // rather than computes when it is absent.
        falseIsStructurallyRejected: () => {
            assertEq(
                validate({ ...minimal, grossReceiptsFullyReportedOnForms1099Nec: false })[0],
                'error')
        },
        absentIsNotFalseAndIsNotTrue: () => {
            const [t, v] = validate(minimal)
            assert(t === 'ok', ['expected ok', t, v])
            assertEq(v.grossReceiptsFullyReportedOnForms1099Nec, undefined)
            assertEq(Object.keys(v).includes('grossReceiptsFullyReportedOnForms1099Nec'), false)
        },
        trueIsStored: () => {
            const [t, v] = validate({
                ...minimal,
                grossReceiptsFullyReportedOnForms1099Nec: true,
            })
            assert(t === 'ok', ['expected ok', t, v])
            assertEq(v.grossReceiptsFullyReportedOnForms1099Nec, true)
        },
    },
    priorYearQualifiedBusinessLossCarryforward: {
        // A STRING, not a checkbox, and `'0.00'` is a real assertion rather
        // than a synonym for absence — the whole difference between this
        // field and the one above it. `fjs/form8995` reads absence as
        // "unstated" and refuses; it reads `'0.00'` as "none" and computes.
        zeroIsAnAssertionAndAbsenceIsNot: () => {
            const [t, v] = validate({
                ...minimal,
                priorYearQualifiedBusinessLossCarryforward: '0.00',
            })
            assert(t === 'ok', ['expected ok', t, v])
            assertEq(v.priorYearQualifiedBusinessLossCarryforward, '0.00')
            const [absentTag, absent] = validate(minimal)
            assert(absentTag === 'ok', ['expected ok', absentTag, absent])
            assertEq(absent.priorYearQualifiedBusinessLossCarryforward, undefined)
            assertEq(
                Object.keys(absent).includes('priorYearQualifiedBusinessLossCarryforward'),
                false,
                'absent is absent, never a materialized undefined')
        },
        aRealCarryforwardRoundTrips: () => {
            const [t, v] = validate({
                ...minimal,
                priorYearQualifiedBusinessLossCarryforward: '18400.00',
            })
            assert(t === 'ok', ['expected ok', t, v])
            assertEq(v.priorYearQualifiedBusinessLossCarryforward, '18400.00')
        },
        // The SIZE of a loss, so a negative is refused — and the refusal says
        // what a negative would DO, which is the actionable half: it would
        // increase the very deduction the carryforward exists to reduce.
        aNegativeIsRefusedNamingWhatItWouldDo: () => {
            const [t, v] = validate({
                ...minimal,
                priorYearQualifiedBusinessLossCarryforward: '-18400.00',
            })
            assertEq(t, 'error')
            assert(
                typeof v === 'string' && v.includes('-18400.00'),
                ['the refusal must quote the value', v])
            assert(
                typeof v === 'string' && v.includes('INCREASING'),
                ['the refusal must say which way the error would run', v])
            assert(
                typeof v === 'string' && v.includes('line 3'),
                ['the refusal must name the printed line it feeds', v])
        },
        // …and it is a MONEY field, so `fjs/document/money_field`'s exactness
        // rule applies to it exactly as it does to every entry amount.
        commaGroupedAndOverPreciseAreRefused: () => {
            assertEq(
                validate({
                    ...minimal,
                    priorYearQualifiedBusinessLossCarryforward: '18,400.00',
                })[0],
                'error')
            assertEq(
                validate({
                    ...minimal,
                    priorYearQualifiedBusinessLossCarryforward: '18400.001',
                })[0],
                'error')
            // …and the CONTROL, which is what says the two above are refused
            // for their shape rather than for existing at all: the same
            // magnitude written exactly is accepted.
            assertEq(
                validate({
                    ...minimal,
                    priorYearQualifiedBusinessLossCarryforward: '18400.00',
                })[0],
                'ok')
        },
    },
    // ── TAX-32 (Phase 31): Form 8995-A's three per-business facts ───────────
    specifiedServiceTradeOrBusiness: {
        // THREE states, and the third is the point. Both answers store, and
        // absence is neither of them — `fjs/form8995a` is what turns absence
        // into a refusal, and it can only do that if this dialect keeps the
        // distinction instead of collapsing it into a boolean.
        bothAnswersStoreAndAbsenceIsNeither: () => {
            const [yesTag, yes] = validate({
                ...minimal, specifiedServiceTradeOrBusiness: 'specifiedService',
            })
            assert(yesTag === 'ok', ['expected ok', yesTag, yes])
            assertEq(yes.specifiedServiceTradeOrBusiness, 'specifiedService')
            const [noTag, no] = validate({
                ...minimal, specifiedServiceTradeOrBusiness: 'notSpecifiedService',
            })
            assert(noTag === 'ok', ['expected ok', noTag, no])
            assertEq(no.specifiedServiceTradeOrBusiness, 'notSpecifiedService')
            const [absentTag, absent] = validate(minimal)
            assert(absentTag === 'ok', ['expected ok', absentTag, absent])
            assertEq(absent.specifiedServiceTradeOrBusiness, undefined)
            assertEq(
                Object.keys(absent).includes('specifiedServiceTradeOrBusiness'),
                false,
                'absent is absent, never a materialized undefined')
            // …and the two stored answers are DIFFERENT strings, which is what
            // makes a reader that tests one of them observable at all.
            assert(
                yes.specifiedServiceTradeOrBusiness !== no.specifiedServiceTradeOrBusiness,
                'the two answers must not be the same string')
        },
        // **THE REASON IT IS NOT A BOOLEAN.** A serializer that materializes
        // every key writes `false`, which as a boolean would be
        // indistinguishable from a taxpayer answering "no" — and "no" RAISES
        // the deduction. Here it is refused, quoted, with the direction named.
        aMaterializedFalseOrEmptyStringIsRefusedRatherThanReadAsNo: () => {
            const [falseTag, falseValue] = validate({
                ...minimal, specifiedServiceTradeOrBusiness: false,
            })
            assertEq(falseTag, 'error', 'a boolean is not one of the two strings')
            assert(falseValue !== undefined, 'a refusal carries something to read')
            const [emptyTag, empty] = validate({
                ...minimal, specifiedServiceTradeOrBusiness: '',
            })
            assertEq(emptyTag, 'error')
            assert(
                typeof empty === 'string' && empty.includes('""'),
                ['the refusal must quote the value it rejected', empty])
            assert(
                typeof empty === 'string' && empty.includes('specifiedService'),
                ['the refusal must name what a valid answer looks like', empty])
            assert(
                typeof empty === 'string' && empty.includes('raises the deduction'),
                ['the refusal must say which way the error would run', empty])
            // A plausible hand edit, refused for the same reason.
            assertEq(
                validate({ ...minimal, specifiedServiceTradeOrBusiness: 'true' })[0], 'error')
            // THE CONTROL: the vocabulary is not refusing everything.
            assertEq(
                validate({
                    ...minimal, specifiedServiceTradeOrBusiness: 'notSpecifiedService',
                })[0],
                'ok')
        },
        // The vocabulary is FROZEN and hand-counted, AGENTS.md's
        // `expectedMoneyBoxFieldCount` idiom: §199A(d)(2) admits two answers,
        // so a third value silently added here fails this leaf even though
        // every check above would happily iterate one element more.
        theVocabularyHasExactlyTwoMembers: () => {
            assertEq(specifiedServiceTradeOrBusinessValues.length, 2)
            assertEq(specifiedServiceTradeOrBusinessValues[0], 'specifiedService')
            assertEq(specifiedServiceTradeOrBusinessValues[1], 'notSpecifiedService')
        },
    },
    w2WagesAndUnadjustedBasis: {
        // `'0.00'` is an assertion and absence is not, exactly as for the
        // carryforward above — and for wages `'0.00'` is the ORDINARY case: a
        // proprietor with no employees issues no Forms W-2.
        zeroIsAnAssertionAndAbsenceIsNot: () => {
            const [t, v] = validate({
                ...minimal, w2Wages: '0.00', unadjustedBasisOfQualifiedProperty: '120000.00',
            })
            assert(t === 'ok', ['expected ok', t, v])
            assertEq(v.w2Wages, '0.00')
            assertEq(v.unadjustedBasisOfQualifiedProperty, '120000.00')
            const [absentTag, absent] = validate(minimal)
            assert(absentTag === 'ok', ['expected ok', absentTag, absent])
            assertEq(absent.w2Wages, undefined)
            assertEq(absent.unadjustedBasisOfQualifiedProperty, undefined)
            assertEq(Object.keys(absent).includes('w2Wages'), false)
            assertEq(
                Object.keys(absent).includes('unadjustedBasisOfQualifiedProperty'), false)
        },
        // Both are money magnitudes, so a negative is refused with the
        // direction of the error named — a negative UBIA would make line 10's
        // cap negative and line 13's "greater of" hand the deduction back.
        //
        // Asserted for EACH field separately: a loop that checked only the
        // first would leave the second unguarded, which is this project's
        // "one limb of the pair is never observed" failure in miniature.
        aNegativeIsRefusedForEachFieldSeparately: () => {
            const [wagesTag, wages] = validate({ ...minimal, w2Wages: '-1.00' })
            assertEq(wagesTag, 'error')
            assert(
                typeof wages === 'string' && wages.includes('w2Wages'),
                ['must name WHICH field', wages])
            assert(
                typeof wages === 'string' && wages.includes('-1.00'),
                ['must quote the value', wages])
            const [ubiaTag, ubia] = validate({
                ...minimal, unadjustedBasisOfQualifiedProperty: '-120000.00',
            })
            assertEq(ubiaTag, 'error')
            assert(
                typeof ubia === 'string'
                    && ubia.includes('unadjustedBasisOfQualifiedProperty'),
                ['must name WHICH field, and it is the second one', ubia])
            assert(
                typeof ubia === 'string' && ubia.includes('-120000.00'),
                ['must quote the value', ubia])
            // THE CONTROL: the same magnitudes written positive are accepted,
            // so the refusals above are about the sign rather than the field.
            assertEq(
                validate({
                    ...minimal, w2Wages: '1.00',
                    unadjustedBasisOfQualifiedProperty: '120000.00',
                })[0],
                'ok')
        },
        // Money-field exactness applies to both, `fjs/document/money_field`'s
        // rule reaching two more fields.
        commaGroupedAndOverPreciseAreRefusedForBoth: () => {
            assertEq(validate({ ...minimal, w2Wages: '120,000.00' })[0], 'error')
            assertEq(validate({ ...minimal, w2Wages: '120000.001' })[0], 'error')
            assertEq(
                validate({
                    ...minimal, unadjustedBasisOfQualifiedProperty: '120,000.00',
                })[0],
                'error')
            assertEq(
                validate({
                    ...minimal, unadjustedBasisOfQualifiedProperty: '120000.001',
                })[0],
                'error')
        },
    },
    datePaid: {
        // The deductible year is the year paid or incurred. Unlike
        // `vnd.fjs.adjustments`, the FOLLOWING year is refused too — there is
        // no business-expense analog of an HSA contribution designated for
        // the prior year, and this leaf is the whole difference between the
        // two dialects' date rules.
        aFollowingYearDateIsRefused: () => {
            const [t, v] = validate({
                ...minimal,
                entries: [{ ...advertising, datePaid: '2026-01-05' }],
            })
            assertEq(t, 'error')
            assert(
                typeof v === 'string' && v.includes('2026-01-05'),
                ['the refusal must quote the date', v])
            assert(
                typeof v === 'string' && v.includes('search advertising'),
                ['the refusal must name WHICH entry, so a reader can find it', v])
        },
        aPriorYearDateIsRefused: () => {
            assertEq(
                validate({ ...minimal, entries: [{ ...advertising, datePaid: '2024-12-31' }] })[0],
                'error')
        },
        boundaryDatesWithinTheYearAccepted: () => {
            assertEq(
                validate({ ...minimal, entries: [{ ...advertising, datePaid: '2025-01-01' }] })[0],
                'ok')
            assertEq(
                validate({ ...minimal, entries: [{ ...advertising, datePaid: '2025-12-31' }] })[0],
                'ok')
        },
        nonIsoDateRejected: () => {
            assertEq(
                validate({ ...minimal, entries: [{ ...advertising, datePaid: '03/14/2025' }] })[0],
                'error')
            assertEq(
                validate({ ...minimal, entries: [{ ...advertising, datePaid: 'March 2025' }] })[0],
                'error')
        },
    },
    amounts: {
        commaGroupedRejected: () => {
            const [t, v] = validate({ ...minimal, entries: [{ ...advertising, amount: '1,250.00' }] })
            assertEq(t, 'error')
            assert(
                typeof v === 'string' && v.includes('search advertising'),
                ['the refusal must name the entry it came from', v])
        },
        canonicalAccepted: () => {
            assertEq(validate({ ...minimal, entries: [{ ...advertising, amount: '1250.00' }] })[0], 'ok')
        },
        // The departure from `fjs/document/money_field`, which accepts a
        // negative amount on purpose (`vnd.fjs.prior_year_capital_loss` needs
        // one). An EXPENSE does not, and this is the leaf that proves the
        // extra check exists rather than being merely described.
        negativeIsRefusedQuotingTheAmount: () => {
            const [t, v] = validate({ ...minimal, entries: [{ ...advertising, amount: '-450.00' }] })
            assertEq(t, 'error')
            assert(
                typeof v === 'string' && v.includes('-450.00'),
                ['the refusal must quote the amount', v])
            assert(
                typeof v === 'string' && v.includes('search advertising'),
                ['the refusal must name the entry', v])
        },
        // The BOUNDARY, one cent apart: minus one cent is refused and zero is
        // accepted. A zero-amount entry is ordinary — a written-off invoice,
        // or a placeholder a taxpayer will fill in — and a check written as
        // `<= 0n` would refuse it, which nothing else here would notice.
        zeroIsAcceptedAndMinusOneCentIsNot: () => {
            assertEq(validate({ ...minimal, entries: [{ ...advertising, amount: '0.00' }] })[0], 'ok')
            assertEq(validate({ ...minimal, entries: [{ ...advertising, amount: '-0.01' }] })[0], 'error')
        },
    },
    // Nothing in this module totals anything: no export sums entries, no
    // Part II line is computed, and no §274(n) limit is applied. A stored
    // total would be a second source of truth able to disagree with the
    // entries it came from — the identical leaf `vnd.fjs.medical_expenses`,
    // `vnd.fjs.itemized_deductions` and `vnd.fjs.adjustments` all carry.
    noTotalIsStored: () => {
        const [t, v] = validate({ ...minimal, entries: [advertising, officeExpense] })
        assert(t === 'ok', ['expected ok', t, v])
        assertEq(Object.keys(v).includes('total'), false)
        assertEq(Object.keys(v).includes('totalExpenses'), false)
        assertEq(Object.keys(v).includes('line28'), false)
        assertEq(v.entries.length, 2)
    },
    // DOC-10: no `formRevision`, and its absence is asserted rather than left
    // to be noticed — the field is not merely unset on this fixture, it is not
    // part of the schema at all, so a blob carrying one is refused.
    noFormRevisionIsAccepted: () => {
        const [t, v] = validate(minimal)
        assert(t === 'ok', ['expected ok', t, v])
        assertEq(Object.keys(v).includes('formRevision'), false)
    },
    // The `category` vocabulary is NOT this dialect's, deliberately: a
    // category `fjs/schedule/c` has never heard of validates HERE and is
    // refused THERE, exactly as `vnd.fjs.itemized_deductions`' free `lineTag`
    // is refused by `fjs/schedule/a`. Stated as a leaf so the layering is
    // checked rather than only described — if this dialect ever grew its own
    // vocabulary check, two places would own one rule.
    anUnknownCategoryIsAcceptedHereAndRefusedOneLayerOut: () => {
        const [t, v] = validate({
            ...minimal,
            entries: [{ ...advertising, category: 'bribes' }],
        })
        assert(t === 'ok', ['the storage boundary does not own the category vocabulary', t, v])
        assertEq(v.entries[0]?.category, 'bribes')
    },
    // DOC-00, `crossDialect`-style: a fully-valid `vnd.fjs.adjustments` value
    // — the dialect this one is modelled on, and therefore the one whose shape
    // is most nearly compatible — fails THIS dialect's `validate`, and the
    // failure's path is exactly `['dialect']`.
    crossDialect: {
        adjustmentsShapeRejectedByBusinessExpenses: () => {
            const [t, v] = validate({
                dialect: 'vnd.fjs.adjustments',
                recipientTin: '222-22-2222',
                taxYear: 2025,
                entries: [],
            })
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
