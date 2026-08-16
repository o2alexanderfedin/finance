/**
 * `vnd.fjs.credits` — the taxpayer-asserted record behind Schedule 3's
 * credits, Phase 25.
 *
 * **This dialect is not a transcribed IRS form**, the identical opening
 * `vnd.fjs.adjustments`, `vnd.fjs.medical_expenses` and
 * `vnd.fjs.itemized_deductions` all make. Every design decision below is
 * `vnd.fjs.adjustments`', followed rather than re-argued: no `formRevision`
 * (DOC-10 exists because printed box semantics drift, and there is no printed
 * form here), no stored total (it would be a second source of truth able to
 * disagree with the entries it came from), no income-dependent computation
 * (both credits' phase-outs need an adjusted gross income this document
 * cannot see), and free-string tags whose VOCABULARY lives one layer out
 * where an unrecognized value is refused by name rather than silently
 * dropped.
 *
 * The subject convention is that dialect's too: `formSubject` keys on
 * `(payerTin, recipientTin, accountNumber, taxYear, formType)` (DOC-01), and
 * this record has no payer and no account. Both are `''`, which makes exactly
 * one such record per taxpayer per tax year — the right cardinality for one
 * running record.
 *
 * ## Why ONE record holds two unrelated credits
 *
 * `vnd.fjs.adjustments` already holds two unrelated deductions — a teacher's
 * classroom supplies and a health savings account contribution — in one
 * record, for a reason that is about PROVENANCE rather than about subject
 * matter: both are payments substantiated by the taxpayer's own records, both
 * arrive with no payer and no account, and both therefore have the same
 * cardinality. That argument is what puts Form 8880's and Form 8863's
 * asserted halves together here, and it is worth stating because "one record
 * per printed form" would have been the other obvious arrangement.
 *
 * What would NOT belong here is anything a payer files. Elective deferrals to
 * a 401(k) are on Form W-2 box 12 and are read from there; tuition paid to an
 * institution is on Form 1098-T and is read from there.
 *
 * ## Why the retirement half is asserted at all — Form 5498 exists
 *
 * A reader who has just read `fjs/document/1098e`'s header will ask the
 * obvious question: §6050S made student loan interest transcribed, so why is
 * an IRA contribution not transcribed under §6058/§408(i)? **Form 5498 does
 * exist, and it is nonetheless useless here**, for a reason that has nothing
 * to do with what it reports:
 *
 * > A trustee must furnish Form 5498 by **May 31** of the year following the
 * > contribution year.
 *
 * The return is due in April. A taxpayer filing on time has not received the
 * form that reports their own contribution, and cannot: it is not late, it is
 * not yet due. The figure therefore comes from the taxpayer's own records at
 * the moment the return is prepared, which is exactly the condition that
 * makes an assertion the honest representation — not the absence of an
 * information return, but the absence of one *in time*. Nothing downstream is
 * allowed to treat a 5498 as available.
 *
 * Contributions made between January and the April due date may also be
 * DESIGNATED for the prior year, which is why `datePaid` accepts
 * `taxYear + 1` here exactly as `vnd.fjs.adjustments` does for an HSA
 * contribution, and for the same reason. The exact April deadline is
 * deliberately not checked, per that dialect's own recorded position about a
 * 31st of February: the due date moves with weekends and holidays, and a
 * calendar is more than a storage boundary needs to own.
 *
 * ## The Form 8880 eligibility record, and why its PRESENCE is the assertion
 *
 * §25B(c) makes an individual eligible only if they have attained age 18, are
 * not a full-time student, and are not claimable as another taxpayer's
 * dependent. None of the three is reported by anybody, and two of them point
 * in opposite directions when absent: an absent "is at least 18" would DENY a
 * credit the taxpayer may be owed, while an absent "was a full-time student"
 * would GRANT one they may not be.
 *
 * So the record's PRESENCE is what says the questions were answered, and
 * DOC-12's `option(true)` then says which way each was answered.
 * `fjs/form8880` refuses — rather than computing either direction — when
 * qualifying contributions exist, the credit rate is non-zero, and no
 * eligibility record was supplied for the person who made them. An engine
 * that guessed would be wrong silently in one direction or the other, and
 * there is no safe default between the two.
 *
 * **The dependent test is NOT a field here**, and that is deliberate:
 * `vnd.fjs.return_profile`'s own `claimedAsDependent` is 1040 line 12a's
 * "someone can claim you as a dependent", which is the same fact §25B(c)(3)
 * asks about. One rule, one place (AGENTS.md); a second field would be a
 * second answer able to disagree with the first.
 *
 * `noTestingPeriodDistributions` is the fourth field and the one that carries
 * the most weight. §25B(d)(2) reduces the credit by distributions received
 * across a FOUR-YEAR window — the two prior tax years, this one, and the part
 * of the next one up to the return's due date. Three of those four are
 * outside anything this engine can observe. `fjs/form8880` refuses without
 * this assertion and refuses again, differently, when a stored Form 1099-R
 * proves a distribution inside the part it CAN observe.
 *
 * ## The Form 8863 student record, and the one field that is an ELECTION
 *
 * `credit` is neither a fact nor an amount: it is the taxpayer's own choice
 * of which credit to claim for that student, which the printed Form 8863
 * expresses by which of Part III's lines 27 and 31 gets filled in. §25A(c)(2)
 * forbids claiming both for one student in one year. Exactly two values are
 * accepted and anything else is refused by name, for {@link individuals}' own
 * recorded reason: a misspelling would otherwise have to fall back to one of
 * them, and whichever it fell back to would be a guess worth up to $500 per
 * student.
 *
 * The four `option(true)` facts beside it are Form 8863 Part III's own lines
 * 23 through 26, and their directions are NOT uniform — which is the printed
 * page's doing, not this dialect's. Three of the four are DISQUALIFIERS whose
 * printed question is answered "yes" by presence
 * (`americanOpportunityClaimedForFourPriorYears`,
 * `completedFirstFourYearsOfPostsecondaryEducation`,
 * `convictedOfAFelonyDrugOffense`) and one is a QUALIFIER whose absence
 * denies (`enrolledAtLeastHalfTimeInADegreeProgram`). A reader who assumes
 * one direction for all four gets three of them backwards, so each is named
 * for the fact it asserts rather than for the outcome it produces.
 *
 * ## The filer's own age, and why ONE field settles a four-part rule
 *
 * §25A(i) denies the REFUNDABLE 40% of the American Opportunity Credit to a
 * filer who, at year end, was under 18; or was 18 with earned income not
 * exceeding half their own support; or was over 18 and under 24, a full-time
 * student, with earned income not exceeding half their own support — in each
 * case only where a parent was alive at year end and the filer is not filing
 * jointly. This engine holds none of those facts: `vnd.fjs.return_profile`
 * carries a 65-or-older checkbox and no other age at all.
 *
 * `filerAttainedAgeTwentyFourBeforeTheEndOfTheYear` settles the whole rule in
 * the affirmative direction for almost everyone, because a filer who reached
 * 24 is outside EVERY branch of it whatever the other facts say. Its absence
 * does not deny the credit — `fjs/form8863` REFUSES instead, naming the
 * provision — so a filer genuinely under 24 gets a sentence they can act on
 * rather than a number that is quietly missing 40% of itself.
 *
 * It is at the TOP LEVEL rather than inside a student entry because it is a
 * fact about the person filing, not about anyone being educated; a filer with
 * two students has one age.
 *
 * ## The two expense fields, and why they are two
 *
 * `qualifiedExpensesNotReportedOnForm1098T` is tuition and required fees the
 * taxpayer paid that no institution reported — §6050S has exceptions, and not
 * every payment reaches a form. `courseMaterialsNotPaidToTheInstitution` is
 * books, supplies and equipment bought elsewhere.
 *
 * **They are separate fields because the two credits treat them
 * differently**, which is the single most consequential fact about Form 8863
 * that a one-total design would erase: §25A(f)(1)(D) qualifies course
 * materials for the American Opportunity Credit *whether or not* they were
 * bought from the institution, while the Lifetime Learning Credit reaches
 * them only when they were paid to the institution as a condition of
 * enrolment. Summing the two here would make the same dollar qualify for both
 * credits, and `fjs/form8863` — which owns that rule — could no longer tell
 * them apart. `fjs/document/1098t`'s own header records the other half of
 * this decision.
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
export const dialect = 'vnd.fjs.credits'
/** The media type derived from {@link dialect}: `application/vnd.fjs.credits+json`. */
export const mediaType = mediaTypeOf(dialect)

/**
 * The two people a Form 1040 can attribute a retirement contribution to —
 * exactly `vnd.fjs.adjustments`' own {@link individuals}, restated here
 * rather than imported for that module's own stated reason: this dialect must
 * be readable on its own, and a per-person CAP is what makes the value
 * load-bearing. Form 8880's line 6 has one column for the taxpayer and one
 * for the spouse, each capped at $2,000 separately, so a misspelled
 * `individual` would silently create a third column with a fresh, uncapped
 * $2,000 of its own.
 */
export const individuals = /** @type {const} */ (['taxpayer', 'spouse'])

/**
 * The two credits Form 8863 offers per student, and the taxpayer's own
 * ELECTION between them — §25A(c)(2) forbids both for one student in one
 * year. Checked for the sharper of {@link individuals}' two reasons: the two
 * differ by up to $500 per student and by whether any of it is refundable, so
 * a value that is neither would have to fall back to one of them and the
 * fallback would be a guess worth real money. There is no safe default, so
 * there is no default.
 */
export const educationCreditElections = /** @type {const} */ ([
    'americanOpportunity',
    'lifetimeLearning',
])

/**
 * One retirement contribution the taxpayer asserts they made — Form 8880's
 * own lines 1 and 2, minus the elective deferrals that arrive on Form W-2 box
 * 12 and are read from there.
 *
 * `contributionTag` is a free string, mirroring `vnd.fjs.adjustments`'
 * `lineTag`: deciding which printed line a contribution belongs on is credit
 * logic, and `fjs/form8880` is where an unrecognized tag is REFUSED by name.
 * `description` mirrors that dialect's own, so a refusal or a citation can
 * name something a reader recognizes on their own records.
 */
const retirementContributionEntry = /** @type {const} */ ({
    contributionTag: string,
    datePaid: string,
    description: string,
    amount: string,
    individual: string,
})

/**
 * One person's §25B(c) eligibility answers. See this module's own docstring,
 * "The Form 8880 eligibility record", for why the record's PRESENCE is the
 * assertion and why the dependent test is deliberately not a field here.
 */
const saversCreditEligibilityEntry = /** @type {const} */ ({
    individual: string,
    attainedAgeEighteen: option(true),
    wasAFullTimeStudent: option(true),
    noTestingPeriodDistributions: option(true),
})

/**
 * One student whose education expenses this return claims — Form 8863 Part
 * III, one instance per student.
 *
 * `studentTin` is what a stored `vnd.fjs.1098t`'s `recipientTin` is matched
 * against, and it is deliberately not assumed to be the taxpayer's:
 * §25A(f)(1)(A) reaches a dependent's expenses, so a parent's return carries
 * a student entry keyed by the child's TIN. `fjs/document/1098t`'s own header
 * records that hazard in full.
 */
const educationStudentEntry = /** @type {const} */ ({
    studentTin: string,
    studentName: string,
    credit: string,
    qualifiedExpensesNotReportedOnForm1098T: option(string),
    courseMaterialsNotPaidToTheInstitution: option(string),
    enrolledAtLeastHalfTimeInADegreeProgram: option(true),
    americanOpportunityClaimedForFourPriorYears: option(true),
    completedFirstFourYearsOfPostsecondaryEducation: option(true),
    convictedOfAFelonyDrugOffense: option(true),
})

/**
 * rtti schema for a `credits` BLOB. `dialect` is spread first (via `base`) so
 * structural validation reports it as the first failing field on a mismatched
 * blob (DOC-00's discriminant). NO `formRevision` — DOC-10 does not apply;
 * there is no printed form.
 *
 * All three arrays are `option`: a taxpayer who claims only one of the two
 * credits supplies only that credit's data, and a record with neither is a
 * real (if pointless) state rather than a validation failure.
 */
export const creditsSchema = /** @type {const} */ ({
    ...base(dialect),
    recipientTin: string,
    taxYear: number,
    corrected: option(true),
    retirementContributions: option(array(retirementContributionEntry)),
    saversCreditEligibility: option(array(saversCreditEligibilityEntry)),
    educationStudents: option(array(educationStudentEntry)),
    // §25A(i)'s under-24 restriction on the REFUNDABLE American Opportunity
    // Credit — a fact about the FILER rather than about any one student,
    // which is why it sits at the top level beside the three arrays rather
    // than inside `educationStudents`. See this module's own docstring, "The
    // filer's own age".
    filerAttainedAgeTwentyFourBeforeTheEndOfTheYear: option(true),
})

/** @typedef {Ts<typeof creditsSchema>} Credits */

/** Structural-only validator: checks the shape, not the semantic refinements below. */
const validateShape = rttiValidate(creditsSchema)

/**
 * Either a structural validation error or a semantic (string) error message.
 * @typedef {ValidationError | string} CreditsError
 */

/**
 * An ISO calendar date, `YYYY-MM-DD` — the identical expression
 * `vnd.fjs.adjustments` and `vnd.fjs.medical_expenses` use, and identical in
 * what it deliberately does not check.
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

/** {@link educationCreditElections}, widened for the same reason.
 * @type {readonly string[]}
 */
const educationCreditElectionNames = educationCreditElections

/**
 * A student entry's two money fields, walked in a loop so the exactness check
 * is written once. Typed via `@type {const}` (not a wider `keyof`) so
 * `student[field]` resolves to exactly `string | undefined` — the same device
 * `fjs/document/w2`'s own `stateLocalMoneyFields` uses for a nested array's
 * amounts, and the reason `fjs/document/w2` names that list at module scope
 * rather than inline: {@link checkReferences}' loop and the proof that counts
 * the list must walk the identical array (AGENTS.md, "one rule, one place").
 */
const studentExpenseFields = /** @type {const} */ ([
    'qualifiedExpensesNotReportedOnForm1098T',
    'courseMaterialsNotPaidToTheInstitution',
])

/**
 * Checks the semantic refinements the structural schema cannot express:
 *
 * 1. Every `datePaid` is an ISO `YYYY-MM-DD` date whose YEAR is the
 *    document's `taxYear` or the year after it.
 * 2. Every `amount` — a contribution, or either of a student's two expense
 *    fields — is an exact decimal within safe magnitude.
 * 3. Every `individual`, on a contribution AND on an eligibility record, is
 *    one of exactly {@link individuals}.
 * 4. Every student's `credit` is one of exactly
 *    {@link educationCreditElections}.
 * 5. No person carries two eligibility records, and no student TIN appears
 *    twice. Both would make the applicable answer depend on which record a
 *    reader happened to look at first, and a lookup that silently takes the
 *    first match is the shape of error this repository exists to prevent —
 *    `vnd.fjs.adjustments`' own `hsaCoverage` duplicate check, applied to two
 *    arrays instead of one.
 *
 * Every refusal names the offending VALUE, not merely the field: a message
 * saying "credit must be americanOpportunity or lifetimeLearning" tells a
 * reader what the rule is, and one that also quotes `americanOportunity`
 * tells them where to look.
 * @type {(r: Credits) => Result<Credits, CreditsError>}
 */
export const checkReferences = r => {
    for (const entry of r.retirementContributions ?? []) {
        const m = isoDate.exec(entry.datePaid)
        if (m === null) {
            return error(`datePaid is not an ISO YYYY-MM-DD date: ${entry.datePaid}`)
        }
        const [, year] = m
        if (year !== String(r.taxYear) && year !== String(r.taxYear + 1)) {
            return error(
                `datePaid ${entry.datePaid} is neither in tax year ${r.taxYear} nor in the `
                + `following year — a retirement contribution counts for the year it was made, `
                + `except for one designated for the prior year before the return's due date`)
        }
        if (!individualNames.includes(entry.individual)) {
            return error(
                `individual ${entry.individual} for ${entry.description} is neither `
                + `'taxpayer' nor 'spouse' — Form 8880 caps each person's contributions `
                + `separately, and a third person's column would never be capped at all`)
        }
        const amountMessage = moneyFieldError(
            `amount for ${entry.description} on ${entry.datePaid}`)(entry.amount)
        if (amountMessage !== undefined) {
            return error(amountMessage)
        }
    }
    /** @type {string[]} */
    const seenIndividuals = []
    for (const eligibility of r.saversCreditEligibility ?? []) {
        if (!individualNames.includes(eligibility.individual)) {
            return error(
                `saversCreditEligibility individual ${eligibility.individual} is neither `
                + `'taxpayer' nor 'spouse'`)
        }
        if (seenIndividuals.includes(eligibility.individual)) {
            return error(
                `saversCreditEligibility carries two records for ${eligibility.individual} — `
                + `§25B(c) is one set of answers per person per year`)
        }
        seenIndividuals.push(eligibility.individual)
    }
    /** @type {string[]} */
    const seenStudentTins = []
    for (const student of r.educationStudents ?? []) {
        if (!educationCreditElectionNames.includes(student.credit)) {
            return error(
                `credit ${student.credit} for ${student.studentName} is neither `
                + `'americanOpportunity' nor 'lifetimeLearning' — §25A(c)(2) allows exactly one `
                + `of the two per student per year and the choice is worth up to $500 plus its `
                + `refundable portion`)
        }
        if (seenStudentTins.includes(student.studentTin)) {
            return error(
                `educationStudents carries two entries for ${student.studentName} — Form 8863 `
                + `Part III is one instance per student per year`)
        }
        seenStudentTins.push(student.studentTin)
        for (const field of studentExpenseFields) {
            const printed = student[field]
            if (printed === undefined) {
                continue
            }
            const message = moneyFieldError(`${field} for ${student.studentName}`)(printed)
            if (message !== undefined) {
                return error(message)
            }
        }
    }
    return ok(r)
}

/**
 * Validates an already-parsed JSON value as a `credits` BLOB: structural
 * (rtti) validation followed by {@link checkReferences}. Dialect
 * discrimination happens exclusively through the schema's exact-literal
 * `dialect` constant — the serialized JSON text is never inspected.
 * @type {(value: Unknown) => Result<Credits, CreditsError>}
 */
export const validate = value => {
    const [t, v] = validateShape(value)
    if (t === 'error') {
        return error(v)
    }
    return checkReferences(v)
}

// ── Tests ────────────────────────────────────────────────────────────────────

/** @type {Credits} */
const minimal = {
    dialect,
    recipientTin: '222-22-2222',
    taxYear: 2025,
}

/** A traditional IRA contribution made during the tax year itself. */
const iraContribution = {
    contributionTag: 'iraContribution',
    datePaid: '2025-07-15',
    description: 'traditional IRA contribution',
    amount: '1500.00',
    individual: 'taxpayer',
}

/** One student claiming the American Opportunity Credit. */
const undergraduateStudent = {
    studentTin: '333-33-3333',
    studentName: 'A. Student',
    credit: 'americanOpportunity',
    courseMaterialsNotPaidToTheInstitution: '700.00',
    enrolledAtLeastHalfTimeInADegreeProgram: true,
}

/** Hand-typed, so a value quietly ADDED to either vocabulary is caught even
 * though every generated leaf below would happily iterate one more.
 * @type {number} */
const expectedIndividualCount = 2
/** @type {number} */
const expectedElectionCount = 2
/** @type {number} */
const expectedStudentExpenseFieldCount = 2

export const proof = {
    dialectAndMediaType: () => {
        assertEq(dialect, 'vnd.fjs.credits')
        assertEq(mediaType, 'application/vnd.fjs.credits+json')
    },
    vocabularies: {
        // The hand-typed counterweight to every loop below that walks these
        // lists (AGENTS.md's hand-typed-count idiom): a third value silently
        // joining either would widen what this dialect accepts, and no
        // generated leaf could notice.
        bothVocabulariesAreExactlyTwoValues: () => {
            assertEq(individuals.length, expectedIndividualCount)
            assertEq(educationCreditElections.length, expectedElectionCount)
            assertEq(individuals[0], 'taxpayer')
            assertEq(individuals[1], 'spouse')
            assertEq(educationCreditElections[0], 'americanOpportunity')
            assertEq(educationCreditElections[1], 'lifetimeLearning')
        },
        theTwoStudentExpenseFieldsAreNamedAndCounted: () => {
            assertEq(studentExpenseFields.length, expectedStudentExpenseFieldCount)
            assertEq(studentExpenseFields[0], 'qualifiedExpensesNotReportedOnForm1098T')
            assertEq(studentExpenseFields[1], 'courseMaterialsNotPaidToTheInstitution')
        },
    },
    validate: {
        // A record with none of the three arrays is a real state, and it is
        // not the same as having no document.
        emptyRecordValidates: () => {
            const [t, v] = validate(minimal)
            assert(t === 'ok', ['expected ok', t, v])
            assertEq(v.retirementContributions, undefined)
            assertEq(v.saversCreditEligibility, undefined)
            assertEq(v.educationStudents, undefined)
        },
        populatedRoundTrips: () => {
            const [t, v] = validate({
                ...minimal,
                retirementContributions: [iraContribution],
                saversCreditEligibility: [{
                    individual: 'taxpayer',
                    attainedAgeEighteen: true,
                    noTestingPeriodDistributions: true,
                }],
                educationStudents: [undergraduateStudent],
            })
            assert(t === 'ok', ['expected ok', t, v])
            assertEq(v.retirementContributions?.length, 1)
            assertEq(v.retirementContributions?.[0]?.amount, '1500.00')
            assertEq(v.saversCreditEligibility?.[0]?.attainedAgeEighteen, true)
            assertEq(v.educationStudents?.[0]?.credit, 'americanOpportunity')
            assertEq(v.educationStudents?.[0]?.courseMaterialsNotPaidToTheInstitution, '700.00')
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
    individual: {
        aMisspelledIndividualIsRefusedNamingTheValue: () => {
            const [t, v] = validate({
                ...minimal,
                retirementContributions: [{ ...iraContribution, individual: 'spuose' }],
            })
            assertEq(t, 'error')
            assert(typeof v === 'string' && v.includes('spuose'), ['the refusal must quote the value', v])
            assert(
                typeof v === 'string' && v.includes('traditional IRA contribution'),
                ['the refusal must name WHICH entry, so a reader can find it', v],
            )
        },
        // Both accepted values, asserted individually. A gate that refused
        // everything would pass the leaf above; this is its control.
        bothIndividualsAreAccepted: () => {
            for (const individual of ['taxpayer', 'spouse']) {
                assertEq(
                    validate({ ...minimal, retirementContributions: [{ ...iraContribution, individual }] })[0],
                    'ok',
                    `${individual} must be accepted`,
                )
            }
        },
        eligibilityIndividualIsCheckedToo: () => {
            const [t, v] = validate({
                ...minimal,
                saversCreditEligibility: [{ individual: 'child' }],
            })
            assertEq(t, 'error')
            assert(typeof v === 'string' && v.includes('child'), ['the refusal must quote the value', v])
        },
        // Two records for one person make the applicable answer depend on
        // which one a reader looks at first. Refused, naming the person.
        twoEligibilityRecordsForOnePersonAreRefused: () => {
            const [t, v] = validate({
                ...minimal,
                saversCreditEligibility: [
                    { individual: 'taxpayer', attainedAgeEighteen: true },
                    { individual: 'taxpayer', wasAFullTimeStudent: true },
                ],
            })
            assertEq(t, 'error')
            assert(typeof v === 'string' && v.includes('taxpayer'), ['the refusal must name the person', v])
        },
        // The CONTROL for the leaf above: one record EACH for two different
        // people is the ordinary married-couple case and must be accepted. A
        // duplicate check written against the array length rather than the
        // person would refuse this, and nothing else would notice.
        oneEligibilityRecordEachForTwoPeopleIsAccepted: () => {
            const [t, v] = validate({
                ...minimal,
                saversCreditEligibility: [
                    { individual: 'taxpayer', attainedAgeEighteen: true },
                    { individual: 'spouse', attainedAgeEighteen: true },
                ],
            })
            assert(t === 'ok', ['expected ok', t, v])
            assertEq(v.saversCreditEligibility?.length, 2)
        },
    },
    eligibilityFlags: {
        // DOC-12: every yes/no fact is `option(true)`, so a stored `false` is
        // structurally rejected and absence is the only way to say "no".
        // Asserted on all three, because all three are load-bearing:
        // `fjs/form8880` REFUSES without the first and denies the credit on
        // the second.
        falseIsStructurallyRejectedOnEveryFlag: () => {
            for (const field of ['attainedAgeEighteen', 'wasAFullTimeStudent', 'noTestingPeriodDistributions']) {
                assertEq(
                    validate({
                        ...minimal,
                        saversCreditEligibility: [{ individual: 'taxpayer', [field]: false }],
                    })[0],
                    'error',
                    `${field} must reject a stored false`,
                )
            }
        },
        absentIsNotFalseAndIsNotTrue: () => {
            const [t, v] = validate({
                ...minimal,
                saversCreditEligibility: [{ individual: 'taxpayer' }],
            })
            assert(t === 'ok', ['expected ok', t, v])
            assertEq(v.saversCreditEligibility?.[0]?.attainedAgeEighteen, undefined)
            assertEq(v.saversCreditEligibility?.[0]?.wasAFullTimeStudent, undefined)
            assertEq(v.saversCreditEligibility?.[0]?.noTestingPeriodDistributions, undefined)
        },
        // The §25B(c)(3) dependent test is NOT a field here — it is 1040 line
        // 12a on `vnd.fjs.return_profile`, and one rule lives in one place.
        // Asserted rather than described, so a field added later has to
        // delete this leaf deliberately.
        theDependentTestIsNotAFieldOnThisDialect: () => {
            const [t, v] = validate({
                ...minimal,
                saversCreditEligibility: [{ individual: 'taxpayer', attainedAgeEighteen: true }],
            })
            assert(t === 'ok', ['expected ok', t, v])
            const record = v.saversCreditEligibility?.[0]
            assert(record !== undefined, ['expected the record', v])
            assertEq(Object.keys(record ?? {}).includes('claimedAsDependent'), false)
            assertEq(Object.keys(record ?? {}).includes('claimableAsDependent'), false)
        },
    },
    educationStudents: {
        aMisspelledCreditElectionIsRefusedNamingTheValueAndTheStudent: () => {
            const [t, v] = validate({
                ...minimal,
                educationStudents: [{ ...undergraduateStudent, credit: 'americanOportunity' }],
            })
            assertEq(t, 'error')
            assert(
                typeof v === 'string' && v.includes('americanOportunity'),
                ['the refusal must quote the value', v],
            )
            assert(
                typeof v === 'string' && v.includes('A. Student'),
                ['the refusal must name WHICH student', v],
            )
        },
        bothElectionsAreAccepted: () => {
            for (const credit of ['americanOpportunity', 'lifetimeLearning']) {
                assertEq(
                    validate({ ...minimal, educationStudents: [{ ...undergraduateStudent, credit }] })[0],
                    'ok',
                    `${credit} must be accepted`,
                )
            }
        },
        twoEntriesForOneStudentAreRefused: () => {
            const [t, v] = validate({
                ...minimal,
                educationStudents: [
                    undergraduateStudent,
                    { ...undergraduateStudent, credit: 'lifetimeLearning' },
                ],
            })
            assertEq(t, 'error')
            assert(typeof v === 'string' && v.includes('A. Student'), ['must name the student', v])
        },
        // The CONTROL: two DIFFERENT students, one on each credit, is the
        // ordinary two-children-in-college case and must be accepted. §25A
        // allows a different election per student; only the same student
        // twice is forbidden.
        twoDifferentStudentsOnDifferentCreditsAreAccepted: () => {
            const [t, v] = validate({
                ...minimal,
                educationStudents: [
                    undergraduateStudent,
                    {
                        studentTin: '555-55-5555',
                        studentName: 'B. Student',
                        credit: 'lifetimeLearning',
                        qualifiedExpensesNotReportedOnForm1098T: '3000.00',
                    },
                ],
            })
            assert(t === 'ok', ['expected ok', t, v])
            assertEq(v.educationStudents?.length, 2)
            assertEq(v.educationStudents?.[1]?.credit, 'lifetimeLearning')
        },
        // The two expense fields stay TWO fields on the way through — a
        // dialect that merged them would make the same dollar qualify for
        // both credits, which is the one thing `fjs/document/1098t`'s header
        // says this design exists to prevent.
        theTwoExpenseFieldsRoundTripSeparately: () => {
            const [t, v] = validate({
                ...minimal,
                educationStudents: [{
                    ...undergraduateStudent,
                    qualifiedExpensesNotReportedOnForm1098T: '1200.00',
                    courseMaterialsNotPaidToTheInstitution: '700.00',
                }],
            })
            assert(t === 'ok', ['expected ok', t, v])
            assertEq(v.educationStudents?.[0]?.qualifiedExpensesNotReportedOnForm1098T, '1200.00')
            assertEq(v.educationStudents?.[0]?.courseMaterialsNotPaidToTheInstitution, '700.00')
        },
        commaGroupedExpenseRejectedNamingTheFieldAndTheStudent: () => {
            for (const field of studentExpenseFields) {
                const [t, v] = validate({
                    ...minimal,
                    educationStudents: [{ ...undergraduateStudent, [field]: '1,200.00' }],
                })
                assertEq(t, 'error', `${field} must reject a comma-grouped amount`)
                assert(typeof v === 'string' && v.includes(field), [field, v])
                assert(typeof v === 'string' && v.includes('A. Student'), [field, v])
            }
        },
        // The four Part III facts point in NON-UNIFORM directions and are
        // named for the fact each asserts, not for the outcome it produces.
        // All four round-trip, and all four reject a stored `false`.
        allFourPartThreeFactsAreOptionTrue: () => {
            const fields = [
                'enrolledAtLeastHalfTimeInADegreeProgram',
                'americanOpportunityClaimedForFourPriorYears',
                'completedFirstFourYearsOfPostsecondaryEducation',
                'convictedOfAFelonyDrugOffense',
            ]
            assertEq(fields.length, 4, 'Form 8863 Part III lines 23 through 26, hand-counted')
            for (const field of fields) {
                assertEq(
                    validate({
                        ...minimal,
                        educationStudents: [{ ...undergraduateStudent, [field]: true }],
                    })[0],
                    'ok',
                    `${field} must be storable`,
                )
                assertEq(
                    validate({
                        ...minimal,
                        educationStudents: [{ ...undergraduateStudent, [field]: false }],
                    })[0],
                    'error',
                    `${field} must reject a stored false`,
                )
            }
        },
    },
    datePaid: {
        aDateTwoYearsOutIsRefused: () => {
            const [t, v] = validate({
                ...minimal,
                retirementContributions: [{ ...iraContribution, datePaid: '2027-01-05' }],
            })
            assertEq(t, 'error')
            assert(typeof v === 'string' && v.includes('2027-01-05'), ['the refusal must quote the date', v])
        },
        aPriorYearDateIsRefused: () => {
            assertEq(validate({
                ...minimal,
                retirementContributions: [{ ...iraContribution, datePaid: '2024-12-31' }],
            })[0], 'error')
        },
        // A contribution made in the FOLLOWING calendar year is storable,
        // because it may be designated for this tax year — the same window
        // `vnd.fjs.adjustments` opens for an HSA contribution, and for the
        // same reason. Form 5498's May 31 furnishing date is why the figure
        // is asserted at all; see this module's own docstring.
        aFollowingYearDateIsAccepted: () => {
            const [t, v] = validate({
                ...minimal,
                retirementContributions: [{ ...iraContribution, datePaid: '2026-04-10' }],
            })
            assert(t === 'ok', ['a prior-year-designated contribution must be storable', t, v])
            assertEq(v.retirementContributions?.[0]?.datePaid, '2026-04-10')
        },
        boundaryDatesWithinTheYearAccepted: () => {
            assertEq(validate({
                ...minimal,
                retirementContributions: [{ ...iraContribution, datePaid: '2025-01-01' }],
            })[0], 'ok')
            assertEq(validate({
                ...minimal,
                retirementContributions: [{ ...iraContribution, datePaid: '2025-12-31' }],
            })[0], 'ok')
        },
        nonIsoDateRejected: () => {
            assertEq(validate({
                ...minimal,
                retirementContributions: [{ ...iraContribution, datePaid: '07/15/2025' }],
            })[0], 'error')
        },
    },
    amounts: {
        commaGroupedRejected: () => {
            const [t, v] = validate({
                ...minimal,
                retirementContributions: [{ ...iraContribution, amount: '1,500.00' }],
            })
            assertEq(t, 'error')
            assert(
                typeof v === 'string' && v.includes('traditional IRA contribution'),
                ['the refusal must name the entry it came from', v],
            )
        },
        canonicalAccepted: () => {
            assertEq(validate({
                ...minimal,
                retirementContributions: [{ ...iraContribution, amount: '1500.00' }],
            })[0], 'ok')
        },
    },
    // Nothing in this module totals anything: no export sums entries, no cap
    // is applied, and both credits' phase-outs need an adjusted gross income
    // this document cannot see. A stored total would be a second source of
    // truth able to disagree with the entries it came from — the identical
    // leaf `vnd.fjs.adjustments`, `vnd.fjs.medical_expenses` and
    // `vnd.fjs.itemized_deductions` all carry, and the identical reason.
    noTotalIsStored: () => {
        const [t, v] = validate({
            ...minimal,
            retirementContributions: [iraContribution],
            educationStudents: [undergraduateStudent],
        })
        assert(t === 'ok', ['expected ok', t, v])
        assertEq(Object.keys(v).includes('total'), false)
        assertEq(Object.keys(v).includes('saversCreditAmount'), false)
        assertEq(Object.keys(v).includes('qualifiedExpensesTotal'), false)
    },
    filerAge: {
        // The field is at the TOP LEVEL, not inside a student entry — a
        // filer with two students has one age. Asserted rather than
        // described, so moving it into `educationStudents` has to delete this
        // leaf deliberately.
        theFilersAgeIsATopLevelFactAndNotAPerStudentOne: () => {
            const [t, v] = validate({
                ...minimal,
                educationStudents: [undergraduateStudent],
                filerAttainedAgeTwentyFourBeforeTheEndOfTheYear: true,
            })
            assert(t === 'ok', ['expected ok', t, v])
            assertEq(v.filerAttainedAgeTwentyFourBeforeTheEndOfTheYear, true)
            assertEq(
                Object.keys(v.educationStudents?.[0] ?? {})
                    .includes('filerAttainedAgeTwentyFourBeforeTheEndOfTheYear'),
                false,
            )
        },
        // DOC-12: `false` is structurally rejected, and DOC-11: absent stays
        // absent. Absence here is what makes `fjs/form8863` REFUSE rather
        // than deny, so a materialized `false` and a genuine absence must not
        // be confusable — they lead to the same behaviour today only because
        // one of the two cannot be stored at all.
        falseIsStructurallyRejectedAndAbsentStaysAbsent: () => {
            assertEq(
                validate({ ...minimal, filerAttainedAgeTwentyFourBeforeTheEndOfTheYear: false })[0],
                'error',
            )
            const [t, v] = validate(minimal)
            assert(t === 'ok', ['expected ok', t, v])
            assert(
                !('filerAttainedAgeTwentyFourBeforeTheEndOfTheYear' in v),
                ['an absent assertion must stay absent', v],
            )
        },
    },
    // DOC-10: no `formRevision`, and its absence is asserted rather than left
    // to be noticed — the field is not merely unset on this fixture, it is
    // not part of the schema at all, so a blob carrying one is refused.
    noFormRevisionIsAccepted: () => {
        const [t, v] = validate(minimal)
        assert(t === 'ok', ['expected ok', t, v])
        assertEq(Object.keys(v).includes('formRevision'), false)
    },
    // DOC-00, `crossDialect`-style: a fully-valid `vnd.fjs.adjustments`
    // value — the dialect this one is modelled on, and therefore the one
    // whose shape is most nearly compatible — fails THIS dialect's
    // `validate`, and the failure's path is exactly `['dialect']`.
    crossDialect: {
        adjustmentsShapeRejectedByCredits: () => {
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
