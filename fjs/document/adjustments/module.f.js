/**
 * `vnd.fjs.adjustments` — DOC-19, the substantiation record behind Schedule 1
 * Part II's adjustments to income.
 *
 * **This dialect is not a transcribed IRS form, and that is the whole point of
 * it** — the identical opening `vnd.fjs.medical_expenses` and
 * `vnd.fjs.itemized_deductions` both make, for the identical reason. No
 * information return reports what a teacher spent out of pocket on classroom
 * supplies, and none reports what a taxpayer paid into their own health
 * savings account: no payer files one, and nothing arrives in the mail shaped
 * like Schedule 1. Both deductions are supported by the taxpayer's own
 * records. So this document is *taxpayer-asserted*, and every design decision
 * below is `vnd.fjs.medical_expenses`'s, followed rather than re-argued:
 *
 * - **No `formRevision`.** DOC-10 exists because box semantics drift between
 *   revisions of a printed form; there is no printed form and no boxes here.
 * - **No total.** Nothing sums the entries, nothing applies the $300
 *   per-educator cap, and nothing computes the HSA limit: a stored total
 *   would be a second source of truth able to disagree with the entries it
 *   came from, and the caps belong to `fjs/schedule/1` and `fjs/form8889`.
 * - **No AGI-dependent computation.** Schedule 1 line 21's phase-out needs a
 *   total income this document cannot see, exactly as the 7.5% medical floor
 *   needs an AGI `vnd.fjs.medical_expenses` cannot see.
 * - **`lineTag` is a free string**, mirroring `vnd.fjs.itemized_deductions`:
 *   deciding which Part II line a payment belongs on is deduction logic, and
 *   `fjs/schedule/1` is where an unrecognized tag is REFUSED by name rather
 *   than silently dropped.
 *
 * The subject convention: `formSubject` keys on `(payerTin, recipientTin,
 * accountNumber, taxYear, formType)` (DOC-01), and this record has no payer
 * and no account. Both are `''`, which makes exactly one such subject per
 * taxpayer per tax year — the right cardinality for one running record.
 *
 * ## What this dialect deliberately does NOT carry: student loan interest
 *
 * TAX-23's student loan interest deduction (Schedule 1 line 21) is the third
 * adjustment this phase computes, and it is **not** an entry here. That is a
 * decision, not an omission, and the reason is the sentence this docstring
 * opens with: *Form 1098-E exists.* §6050S requires a lender that receives
 * $600 or more of student loan interest to file one with the IRS and furnish
 * a copy to the borrower, so the opening claim — no information return
 * reports this — is simply false for that one line. Three consequences make
 * carrying it here actively wrong rather than merely inelegant:
 *
 * - **The provenance story would contradict itself.** A dialect whose header
 *   argues "no payer files one, so this is asserted" cannot also hold a
 *   figure a payer does file, without one of the two claims being untrue of
 *   whatever a reader is looking at.
 * - **DOC-10 would be unstatable.** A 1098-E's box 2 checkbox changes what
 *   box 1 MEANS ("box 1 does not include loan origination fees and/or
 *   capitalized interest") — the precise kind of drift `formRevision` exists
 *   for. This dialect has no `formRevision` and should not grow one.
 * - **The cardinality is wrong.** This record's `''` payer makes exactly ONE
 *   subject per taxpayer per year. A borrower with two servicers receives
 *   two 1098-Es, which is two subjects keyed by two payer TINs — the shape
 *   every other transcribed dialect here already has.
 *
 * So student loan interest is transcribed by `vnd.fjs.1098e`, its own
 * dialect, and that module's header records the other half of this decision.
 *
 * ## `individual` is NOT a free string, and that is a departure worth stating
 *
 * `vnd.fjs.medical_expenses` keeps `category` free and says so: enumerating
 * Publication 502 is deduction logic. `individual` is different in kind — it
 * is an IDENTITY, not a category — and both lines this dialect feeds apply
 * their cap **per person**: §62(a)(2)(D) allows $300 to each spouse who is an
 * eligible educator, and §223(b) gives each account beneficiary their own
 * limit. A misspelled `category` costs nothing; a misspelled `individual`
 * silently creates a third person on a two-person return, and each entry
 * attributed to that phantom gets a fresh, uncapped $300. So exactly two
 * values are accepted, and anything else is refused by name.
 *
 * ## `hsaCoverage` — the facts Form 8889 asks for that are not amounts
 *
 * Form 8889 line 1 is a checkbox (self-only or family coverage) and line 7 is
 * an age test; neither is a dollar figure, and neither is reported anywhere.
 * They are recorded here, beside the contributions they qualify, because they
 * are the same taxpayer assertion made at the same time — and because a
 * contribution stored without them is an amount no limit can be applied to.
 *
 * Two of the four fields exist **only so a return this engine cannot compute
 * can still say so out loud**, rather than being computed wrongly:
 * `hadHighDeductibleCoverageAllYear` absent means the monthly proration and
 * the last-month rule apply, which `fjs/form8889` does not model, and
 * `madeQualifiedHsaFundingDistribution` present means Form 8889 line 10 is
 * non-zero, which it also does not model. Both are STORED here and REFUSED
 * there — the DOC-11 discipline that an absent fact is absent rather than
 * favourable, carried one layer up into a refusal a reader can act on.
 *
 * ## The date rule is looser than `vnd.fjs.medical_expenses`', on purpose
 *
 * A medical expense is deducted in the year PAID, full stop, so that dialect
 * refuses any `datePaid` outside its own `taxYear`. An HSA contribution is
 * not like that: a contribution made in the following calendar year, up to
 * the return due date, may be designated for THIS tax year — which is how a
 * large share of real HSA contributions are made. So `taxYear + 1` is
 * accepted here, and `taxYear + 2` is not.
 *
 * **The exact April deadline is deliberately not checked**, for the reason
 * `vnd.fjs.medical_expenses` gives about a 31st of February: the due date
 * moves with weekends and holidays, and a calendar is more than a storage
 * boundary needs to own. What DOES get checked is one line further out:
 * `fjs/schedule/1` refuses a following-year `datePaid` on any tag but an HSA
 * contribution, because a classroom supply bought in March 2026 is a 2026
 * deduction and nothing downstream could ever notice otherwise.
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
/** @import { SubjectKey } from '../subject/module.f.js' */

/**
 * Format tag: names the dialect of this BLOB. The media type it is served
 * with is derived mechanically: `application/` + `dialect` + `+json`.
 */
export const dialect = 'vnd.fjs.adjustments'
/** The media type derived from {@link dialect}: `application/vnd.fjs.adjustments+json`. */
export const mediaType = mediaTypeOf(dialect)

/**
 * The two people a Form 1040 can attribute an adjustment to. Exactly two, and
 * checked — see this module's own docstring, "`individual` is NOT a free
 * string". A joint return has a taxpayer and a spouse; no third party's
 * educator expenses or HSA contributions reach this return at all.
 */
export const individuals = /** @type {const} */ (['taxpayer', 'spouse'])

/**
 * Form 8889 line 1's own two checkboxes. Also checked, and for a sharper
 * reason than {@link individuals}: the two carry limits $4,250 apart
 * (§223(b)(2)), so a value that is neither would have to fall back to one of
 * them, and whichever one it fell back to would be a guess worth thousands of
 * dollars. There is no safe default, so there is no default.
 */
export const hsaCoverageTypes = /** @type {const} */ (['selfOnly', 'family'])

/**
 * One adjustment the taxpayer asserts they paid. `datePaid` is required for
 * the same reason `vnd.fjs.medical_expenses` requires it — the deductible
 * year is the year paid — but the rule it is checked against is looser here;
 * see this module's own docstring, "The date rule is looser".
 *
 * `description` mirrors that dialect's `provider`: free text naming what the
 * payment was, so a refusal or a citation can name something a reader
 * recognizes on their own records.
 */
const adjustmentEntry = /** @type {const} */ ({
    lineTag: string,
    datePaid: string,
    description: string,
    amount: string,
    individual: string,
})

/**
 * One person's HSA coverage facts — Form 8889 line 1's coverage checkbox and
 * the three yes/no facts its Part I arithmetic branches on. All three
 * booleans follow DOC-12's checkbox convention (`option(true)`, so absence is
 * the only way to say "no"), extended to a taxpayer-asserted fact exactly as
 * `vnd.fjs.return_profile`'s own `dependents` array already does.
 *
 * `hadHighDeductibleCoverageAllYear` and `madeQualifiedHsaFundingDistribution`
 * are the two whose ABSENCE and PRESENCE respectively make the deduction
 * uncomputable rather than zero — see this module's docstring.
 */
const hsaCoverageEntry = /** @type {const} */ ({
    individual: string,
    coverageType: string,
    hadHighDeductibleCoverageAllYear: option(true),
    eligibleForCatchUpContribution: option(true),
    madeQualifiedHsaFundingDistribution: option(true),
})

/**
 * rtti schema for an `adjustments` BLOB. `dialect` is spread first (via
 * `base`) so structural validation reports it as the first failing field on a
 * mismatched blob (DOC-00's discriminant). NO `formRevision` — DOC-10 does
 * not apply; there is no printed form.
 */
export const adjustmentsSchema = /** @type {const} */ ({
    ...base(dialect),
    recipientTin: string,
    taxYear: number,
    corrected: option(true),
    entries: array(adjustmentEntry),
    hsaCoverage: option(array(hsaCoverageEntry)),
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

/** @typedef {Ts<typeof adjustmentsSchema>} Adjustments */

/** Structural-only validator: checks the shape, not the semantic refinements below. */
const validateShape = rttiValidate(adjustmentsSchema)

/**
 * Either a structural validation error or a semantic (string) error message.
 * @typedef {ValidationError | string} AdjustmentsError
 */

/**
 * An ISO calendar date, `YYYY-MM-DD` — the identical expression
 * `vnd.fjs.medical_expenses` uses, and identical in what it deliberately does
 * not check (a 31st of February is a calendar's problem, not a storage
 * boundary's).
 * @type {RegExp}
 */
const isoDate = /^(\d{4})-(\d{2})-(\d{2})$/

/**
 * {@link individuals} widened to a plain string list, so the membership
 * question can be asked of the `string` a JSON blob's field actually is. An
 * ordinary widening ASSIGNMENT, never a cast — the same device, for the same
 * reason, as `fjs/return/scope`'s `modeledKindNames`.
 * @type {readonly string[]}
 */
const individualNames = individuals

/** {@link hsaCoverageTypes}, widened for the same reason.
 * @type {readonly string[]}
 */
const hsaCoverageTypeNames = hsaCoverageTypes

/**
 * Checks the semantic refinements the structural schema cannot express:
 *
 * 1. Every `datePaid` is an ISO `YYYY-MM-DD` date whose YEAR is the
 *    document's `taxYear` or the year after it.
 * 2. Every `amount` is an exact decimal within safe magnitude.
 * 3. Every `individual` — on an entry AND on an `hsaCoverage` record — is one
 *    of exactly {@link individuals}.
 * 4. Every `coverageType` is one of exactly {@link hsaCoverageTypes}.
 * 5. No person carries two `hsaCoverage` records. Form 8889 line 1 is one
 *    checkbox per person per year; two records would make the applicable
 *    limit depend on which one a reader happened to look at first, and a
 *    lookup that silently takes the first match is the shape of error this
 *    repository exists to prevent.
 *
 * Every refusal names the offending VALUE, not merely the field: a message
 * saying "individual must be taxpayer or spouse" tells a reader what the rule
 * is, and one that also quotes `spuose` tells them where to look.
 * @type {(r: Adjustments) => Result<Adjustments, AdjustmentsError>}
 */
export const checkReferences = r => {
    for (const entry of r.entries) {
        const m = isoDate.exec(entry.datePaid)
        if (m === null) {
            return error(`datePaid is not an ISO YYYY-MM-DD date: ${entry.datePaid}`)
        }
        const [, year] = m
        if (year !== String(r.taxYear) && year !== String(r.taxYear + 1)) {
            return error(
                `datePaid ${entry.datePaid} is neither in tax year ${r.taxYear} nor in the `
                + `following year — an adjustment is deducted in the year it was paid, except `
                + `for a health savings account contribution designated for the prior year`)
        }
        if (!individualNames.includes(entry.individual)) {
            return error(
                `individual ${entry.individual} for ${entry.description} is neither `
                + `'taxpayer' nor 'spouse' — a per-person cap attributed to a third person `
                + `would never be capped at all`)
        }
        const amountMessage = moneyFieldError(
            `amount for ${entry.description} on ${entry.datePaid}`)(entry.amount)
        if (amountMessage !== undefined) {
            return error(amountMessage)
        }
    }
    /** @type {string[]} */
    const seenIndividuals = []
    for (const coverage of r.hsaCoverage ?? []) {
        if (!individualNames.includes(coverage.individual)) {
            return error(
                `hsaCoverage individual ${coverage.individual} is neither 'taxpayer' nor 'spouse'`)
        }
        if (!hsaCoverageTypeNames.includes(coverage.coverageType)) {
            return error(
                `hsaCoverage coverageType ${coverage.coverageType} for ${coverage.individual} is `
                + `neither 'selfOnly' nor 'family' — Form 8889 line 1 has exactly these two `
                + `checkboxes and their limits differ by thousands of dollars`)
        }
        if (seenIndividuals.includes(coverage.individual)) {
            return error(
                `hsaCoverage carries two records for ${coverage.individual} — Form 8889 line 1 `
                + `is one coverage checkbox per person per year`)
        }
        seenIndividuals.push(coverage.individual)
    }
    return ok(r)
}

/**
 * Validates an already-parsed JSON value as an `adjustments` BLOB: structural
 * (rtti) validation followed by {@link checkReferences}. Dialect
 * discrimination happens exclusively through the schema's exact-literal
 * `dialect` constant — the serialized JSON text is never inspected.
 * @type {(value: Unknown) => Result<Adjustments, AdjustmentsError>}
 */
export const validate = value => {
    const [t, v] = validateShape(value)
    if (t === 'error') {
        return error(v)
    }
    return checkReferences(v)
}

// ── Tests ────────────────────────────────────────────────────────────────────

/** @type {Adjustments} */
const minimal = {
    dialect,
    recipientTin: '222-22-2222',
    taxYear: 2025,
    entries: [],
}

/** Classroom supplies — the commonest educator expense. */
const classroomSupplies = {
    lineTag: 'educatorExpenses',
    datePaid: '2025-09-02',
    description: 'classroom supplies',
    amount: '287.45',
    individual: 'taxpayer',
}

/** An HSA contribution made during the tax year itself. */
const hsaContribution = {
    lineTag: 'hsaContribution',
    datePaid: '2025-06-30',
    description: 'HSA contribution',
    amount: '2000.00',
    individual: 'taxpayer',
}

/** Hand-typed, so a value quietly ADDED to either vocabulary is caught even
 * though every generated leaf below would happily iterate one more.
 * @type {number} */
const expectedIndividualCount = 2
/** @type {number} */
const expectedCoverageTypeCount = 2

export const proof = {
    dialectAndMediaType: () => {
        assertEq(dialect, 'vnd.fjs.adjustments')
        assertEq(mediaType, 'application/vnd.fjs.adjustments+json')
    },
    vocabularies: {
        // The hand-typed counterweight to every loop below that walks these
        // two lists (AGENTS.md's hand-typed-count idiom): a third value
        // silently joining `individuals` would widen what this dialect
        // accepts, and no generated leaf could notice.
        bothVocabulariesAreExactlyTwoValues: () => {
            assertEq(individuals.length, expectedIndividualCount)
            assertEq(hsaCoverageTypes.length, expectedCoverageTypeCount)
            assertEq(individuals[0], 'taxpayer')
            assertEq(individuals[1], 'spouse')
            assertEq(hsaCoverageTypes[0], 'selfOnly')
            assertEq(hsaCoverageTypes[1], 'family')
        },
    },
    validate: {
        // A taxpayer with no adjustments recorded yet is a real state, and it
        // is not the same as having no document.
        emptyEntriesValidates: () => {
            const [t, v] = validate(minimal)
            assert(t === 'ok', ['expected ok', t, v])
            assertEq(v.entries.length, 0)
            assertEq(v.hsaCoverage, undefined)
        },
        populatedRoundTrips: () => {
            const [t, v] = validate({
                ...minimal,
                entries: [classroomSupplies, { ...hsaContribution, individual: 'spouse' }],
                hsaCoverage: [{
                    individual: 'spouse',
                    coverageType: 'family',
                    hadHighDeductibleCoverageAllYear: true,
                }],
            })
            assert(t === 'ok', ['expected ok', t, v])
            assertEq(v.entries.length, 2)
            assertEq(v.entries[0]?.lineTag, 'educatorExpenses')
            assertEq(v.entries[0]?.amount, '287.45')
            assertEq(v.entries[1]?.individual, 'spouse')
            assertEq(v.hsaCoverage?.length, 1)
            assertEq(v.hsaCoverage?.[0]?.coverageType, 'family')
        },
        wrongDialectRejected: () => {
            const [t, v] = validate({ ...minimal, dialect: 'vnd.fjs.medical_expenses' })
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
    individual: {
        // The departure this dialect makes from `vnd.fjs.medical_expenses`'s
        // free-string `category`, proven rather than merely argued: a
        // misspelling is refused, and the refusal QUOTES the offending value
        // (the only part of the message a reader can act on) rather than only
        // restating the rule.
        aMisspelledIndividualIsRefusedNamingTheValue: () => {
            const [t, v] = validate({
                ...minimal,
                entries: [{ ...classroomSupplies, individual: 'spuose' }],
            })
            assertEq(t, 'error')
            assert(typeof v === 'string' && v.includes('spuose'), ['the refusal must quote the value', v])
            assert(
                typeof v === 'string' && v.includes('classroom supplies'),
                ['the refusal must name WHICH entry, so a reader can find it', v],
            )
        },
        // Both accepted values, asserted individually. A gate that refused
        // everything would pass the leaf above; this is its control.
        bothIndividualsAreAccepted: () => {
            assertEq(validate({ ...minimal, entries: [{ ...classroomSupplies, individual: 'taxpayer' }] })[0], 'ok')
            assertEq(validate({ ...minimal, entries: [{ ...classroomSupplies, individual: 'spouse' }] })[0], 'ok')
        },
        // Casing is not normalized: `Taxpayer` is a different string, and a
        // dialect that quietly lower-cased it would be repairing input rather
        // than validating it — the same position `fjs/document/ocr_amount`
        // takes about comma degrouping belonging one layer out.
        casingIsNotNormalized: () => {
            assertEq(validate({ ...minimal, entries: [{ ...classroomSupplies, individual: 'Taxpayer' }] })[0], 'error')
        },
        hsaCoverageIndividualIsCheckedToo: () => {
            const [t, v] = validate({
                ...minimal,
                hsaCoverage: [{ individual: 'child', coverageType: 'selfOnly' }],
            })
            assertEq(t, 'error')
            assert(typeof v === 'string' && v.includes('child'), ['the refusal must quote the value', v])
        },
    },
    hsaCoverage: {
        bothCoverageTypesAreAccepted: () => {
            for (const coverageType of ['selfOnly', 'family']) {
                assertEq(
                    validate({ ...minimal, hsaCoverage: [{ individual: 'taxpayer', coverageType }] })[0],
                    'ok',
                    `${coverageType} must be accepted`,
                )
            }
        },
        anUnknownCoverageTypeIsRefusedNamingTheValueAndThePerson: () => {
            const [t, v] = validate({
                ...minimal,
                hsaCoverage: [{ individual: 'taxpayer', coverageType: 'selfPlusOne' }],
            })
            assertEq(t, 'error')
            assert(typeof v === 'string' && v.includes('selfPlusOne'), ['the refusal must quote the value', v])
            assert(typeof v === 'string' && v.includes('taxpayer'), ['the refusal must name the person', v])
        },
        // Two records for one person make the applicable limit depend on
        // which one a reader looks at first. Refused, naming the person.
        twoRecordsForOnePersonAreRefused: () => {
            const [t, v] = validate({
                ...minimal,
                hsaCoverage: [
                    { individual: 'taxpayer', coverageType: 'selfOnly' },
                    { individual: 'taxpayer', coverageType: 'family' },
                ],
            })
            assertEq(t, 'error')
            assert(typeof v === 'string' && v.includes('taxpayer'), ['the refusal must name the person', v])
        },
        // The CONTROL for the leaf above: one record EACH for two different
        // people is the ordinary married-couple case and must be accepted. A
        // duplicate check written against the array length rather than the
        // person would refuse this, and nothing else would notice.
        oneRecordEachForTwoPeopleIsAccepted: () => {
            const [t, v] = validate({
                ...minimal,
                hsaCoverage: [
                    { individual: 'taxpayer', coverageType: 'selfOnly' },
                    { individual: 'spouse', coverageType: 'selfOnly' },
                ],
            })
            assert(t === 'ok', ['expected ok', t, v])
            assertEq(v.hsaCoverage?.length, 2)
        },
        // DOC-12: the three yes/no facts are `option(true)`, so a stored
        // `false` is structurally rejected and absence is the only way to say
        // "no". Asserted on the one whose absence is load-bearing —
        // `fjs/form8889` REFUSES rather than computes when it is absent.
        allYearCoverageFalseIsStructurallyRejected: () => {
            assertEq(validate({
                ...minimal,
                hsaCoverage: [{
                    individual: 'taxpayer',
                    coverageType: 'selfOnly',
                    hadHighDeductibleCoverageAllYear: false,
                }],
            })[0], 'error')
        },
        absentIsNotFalseAndIsNotTrue: () => {
            const [t, v] = validate({
                ...minimal,
                hsaCoverage: [{ individual: 'taxpayer', coverageType: 'family' }],
            })
            assert(t === 'ok', ['expected ok', t, v])
            assertEq(v.hsaCoverage?.[0]?.hadHighDeductibleCoverageAllYear, undefined)
            assertEq(v.hsaCoverage?.[0]?.eligibleForCatchUpContribution, undefined)
            assertEq(v.hsaCoverage?.[0]?.madeQualifiedHsaFundingDistribution, undefined)
        },
    },
    datePaid: {
        // The deductible year is the year PAID. Two years out is refused,
        // exactly as `vnd.fjs.medical_expenses` refuses ANY year but its own.
        aDateTwoYearsOutIsRefused: () => {
            const [t, v] = validate({ ...minimal, entries: [{ ...classroomSupplies, datePaid: '2027-01-05' }] })
            assertEq(t, 'error')
            assert(typeof v === 'string' && v.includes('2027-01-05'), ['the refusal must quote the date', v])
        },
        aPriorYearDateIsRefused: () => {
            assertEq(validate({ ...minimal, entries: [{ ...classroomSupplies, datePaid: '2024-12-31' }] })[0], 'error')
        },
        // The departure from `vnd.fjs.medical_expenses`, proven: a
        // contribution made in the FOLLOWING calendar year is storable,
        // because it may be designated for this tax year. Whether the
        // particular `lineTag` may do that is `fjs/schedule/1`'s rule, not
        // this boundary's.
        aFollowingYearDateIsAccepted: () => {
            const [t, v] = validate({
                ...minimal,
                entries: [{ ...hsaContribution, datePaid: '2026-04-10' }],
            })
            assert(t === 'ok', ['a prior-year-designated HSA contribution must be storable', t, v])
            assertEq(v.entries[0]?.datePaid, '2026-04-10')
        },
        boundaryDatesWithinTheYearAccepted: () => {
            assertEq(validate({ ...minimal, entries: [{ ...classroomSupplies, datePaid: '2025-01-01' }] })[0], 'ok')
            assertEq(validate({ ...minimal, entries: [{ ...classroomSupplies, datePaid: '2025-12-31' }] })[0], 'ok')
        },
        // The far edge of the accepted window: the LAST day of the following
        // year is still storable, because this boundary deliberately does not
        // own a calendar (see this module's own docstring). The deduction
        // rule that actually bites lives one layer out.
        theLastDayOfTheFollowingYearIsStillStorable: () => {
            assertEq(validate({ ...minimal, entries: [{ ...hsaContribution, datePaid: '2026-12-31' }] })[0], 'ok')
        },
        nonIsoDateRejected: () => {
            assertEq(validate({ ...minimal, entries: [{ ...classroomSupplies, datePaid: '09/02/2025' }] })[0], 'error')
            assertEq(validate({ ...minimal, entries: [{ ...classroomSupplies, datePaid: 'September 2025' }] })[0], 'error')
        },
    },
    amounts: {
        commaGroupedRejected: () => {
            const [t, v] = validate({ ...minimal, entries: [{ ...classroomSupplies, amount: '1,287.45' }] })
            assertEq(t, 'error')
            assert(
                typeof v === 'string' && v.includes('classroom supplies'),
                ['the refusal must name the entry it came from', v],
            )
        },
        canonicalAccepted: () => {
            assertEq(validate({ ...minimal, entries: [{ ...classroomSupplies, amount: '1287.45' }] })[0], 'ok')
        },
    },
    // Nothing in this module totals anything: no export sums entries, no cap
    // is applied, and Schedule 1 line 21's phase-out needs a total income
    // this document cannot see. A stored total would be a second source of
    // truth able to disagree with the entries it came from — the identical
    // leaf `vnd.fjs.medical_expenses` and `vnd.fjs.itemized_deductions` both
    // carry, and the identical reason.
    noTotalIsStored: () => {
        const [t, v] = validate({
            ...minimal,
            entries: [classroomSupplies, hsaContribution],
        })
        assert(t === 'ok', ['expected ok', t, v])
        assertEq(Object.keys(v).includes('total'), false)
        assertEq(Object.keys(v).includes('educatorExpensesTotal'), false)
        assertEq(v.entries.length, 2)
    },
    // DOC-10: no `formRevision`, and its absence is asserted rather than left
    // to be noticed — the field is not merely unset on this fixture, it is
    // not part of the schema at all, so a blob carrying one is refused.
    noFormRevisionIsAccepted: () => {
        const [t, v] = validate(minimal)
        assert(t === 'ok', ['expected ok', t, v])
        assertEq(Object.keys(v).includes('formRevision'), false)
    },
    // DOC-00, `crossDialect`-style: a fully-valid `vnd.fjs.medical_expenses`
    // value — the dialect this one is modelled on, and therefore the one
    // whose shape is most nearly compatible — fails THIS dialect's
    // `validate`, and the failure's path is exactly `['dialect']`.
    crossDialect: {
        medicalExpensesShapeRejectedByAdjustments: () => {
            const [t, v] = validate({
                dialect: 'vnd.fjs.medical_expenses',
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
