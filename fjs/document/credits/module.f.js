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
import { array, number, option, string } from 'functionalscript/fjs/types/rtti/module.f.mjs'
import { validate as rttiValidate } from 'functionalscript/fjs/types/rtti/validate/module.f.mjs'
import { error, ok } from 'functionalscript/fjs/types/result/module.f.mjs'
import { assert, assertEq, assertNotNullish } from 'functionalscript/fjs/asserts/module.f.mjs'
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
 * One care provider — Form 2441 Part I line 1, columns (a) through (e).
 *
 * Every column is here, including the two that are not amounts, because the
 * printed line is *"You must complete this part"* and a credit claimed without
 * it *"may be disallowed unless you can show you used due diligence"* (i2441
 * p2). `fjs/form2441` refuses a return that paid qualified expenses and
 * recorded no provider.
 *
 * `identifyingNumber` is a free STRING and not a TIN pattern, because i2441 p3
 * prints four things that legitimately go in column (c) and only one of them
 * is a number: an SSN or ITIN, an EIN, the word *"Tax-Exempt"* for a tax-exempt
 * organization, and *"LAFCP"* for a Living Abroad Foreign Care Provider. A
 * pattern check here would refuse three printed answers, so the field carries
 * what the taxpayer would write on the paper.
 *
 * `householdEmployee` is column (d)'s Yes/No box, `option(true)` per DOC-12.
 * Nothing on Form 2441 reads it — it is the trigger for Schedule H, which this
 * engine does not compute — and it is stored anyway because the printed line
 * requires an answer and a transcription that drops a printed box is a
 * transcription a reader cannot check against the page.
 */
const dependentCareProviderEntry = /** @type {const} */ ({
    name: string,
    address: string,
    identifyingNumber: string,
    householdEmployee: option(true),
    amountPaid: string,
})

/**
 * One qualifying person — Form 2441 Part II line 2, columns (a) through (d).
 *
 * `qualifiedExpensesIncurredAndPaid` is column (d) and is deliberately NOT the
 * same figure as {@link creditsSchema}'s `dependentCareQualifiedExpensesIncurred`
 * (line 16). The printed page asks two different questions: column (d) wants
 * what was *"incurred and paid in 2025"*, and line 16 wants what was
 * *"incurred in 2025 ... It doesn't matter when the expenses were paid."* They
 * coincide for most filers and diverge for anyone who paid a December bill in
 * January, which is exactly the population Form 2441 line 9b and Worksheet A
 * exist for. Storing one figure and using it for both would erase the
 * distinction the form is built around.
 *
 * ## The two age assertions, and why ONE checkbox was not enough
 *
 * `overAgeTwelveAndDisabled` is column (c). It is a taxpayer ASSERTION about a
 * person, in the shape `educationStudentEntry`'s four Form 8863 boxes already
 * are, and this dialect does not police it: §21(b)(1)(B)'s "physically or
 * mentally incapable of caring for themselves" is not a fact any document
 * reports and not one arithmetic can check.
 *
 * `underAgeThirteenWhenTheCareWasProvided` is §21(b)(1)(A)'s age test, and it
 * has NO printed column of its own. It is here because **this dialect is not a
 * transcribed IRS form** — the first sentence of this module — and the printed
 * page's own device for settling the age is a CAUTION addressed to whoever
 * fills the paper in, which nobody here has read. i2441 (2025), Part II, Line
 * 2, Column (c), third sentence:
 *
 * > *"A person over age 12 at the time the care was provided must be
 * > physically or mentally incapable of caring for themselves to be listed on
 * > line 2."*
 *
 * and the CAUTION printed immediately above it:
 *
 * > *"Don't list a person on line 2 unless they are listed as an eligible
 * > person under Qualifying Person(s), earlier."*
 *
 * On the PAPER those two sentences do close the ambiguity: an unchecked column
 * (c) on a correctly prepared Form 2441 can only mean "under age 13", because
 * the over-12-and-not-disabled person may not appear on line 2 at all. That is
 * why the sweep's report of this field
 * (`fjs/todo/stored-but-unread-field-sweep.md`) is wrong where it says absence
 * is ambiguous *on the form*.
 *
 * It is right about the RECORD, which is a different object. Here the engine
 * is the preparer: nothing between the taxpayer's own care receipts and
 * `fjs/form2441` applies that caution, so an absent `overAgeTwelveAndDisabled`
 * carries all three of "under 13", "over 12 and not disabled" and "nobody
 * asked" at once — and the engine granted a qualifying person in every one of
 * them. That is this dialect's own recorded rule about `option(true)` being
 * violated in the direction it names as decisive
 * ({@link earnedIncomeCreditVocabularies}, in `fjs/return/profile`): *"Here the
 * wrong default GRANTS a credit."* A person wrongly counted moves §21(c)'s cap
 * from $3,000 to $6,000 and is worth up to $1,050 of credit the taxpayer will
 * owe back.
 *
 * So each of the printed page's two eligible populations gets its own
 * `option(true)`, absence of BOTH is *unstated* rather than a silent grant, and
 * `fjs/form2441` refuses by name — exactly as `fjs/form8863` refuses without
 * `filerAttainedAgeTwentyFourBeforeTheEndOfTheYear` and `fjs/form8880`
 * without a `saversCreditEligibility` record. A DATE OF BIRTH was the other
 * candidate and is not what the printed structure asks for: column (c)'s test
 * is *"at the time the care was provided"*, and neither line 2 nor line 1
 * prints a care date to compare a birthday against, so a stored date of birth
 * would still not settle the child who turns 13 in June (i2441, Qualifying
 * Person(s), item 1: *"If the child turned 13 during the year, the child is a
 * qualifying person for the part of the year they were under age 13."*). The
 * taxpayer knows; the arithmetic cannot.
 *
 * **Both present is a CONTRADICTION and is refused by {@link checkReferences}.**
 * "Over age 12 at the time the care was provided" and "under age 13 when the
 * care was provided" cannot both hold of the same care, so a record asserting
 * both has answered the same printed question twice, differently. That refusal
 * belongs here rather than in `fjs/form2441` because it is a property of the
 * stored record and not of any computation.
 */
const dependentCareQualifyingPersonEntry = /** @type {const} */ ({
    name: string,
    tin: string,
    overAgeTwelveAndDisabled: option(true),
    underAgeThirteenWhenTheCareWasProvided: option(true),
    qualifiedExpensesIncurredAndPaid: string,
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
    // ── Form 2441, TAX-38 ───────────────────────────────────────────────────
    //
    // The third Schedule 3 credit whose asserted half lives on this dialect,
    // and it satisfies this module's own inclusion rule exactly: what a
    // taxpayer paid a daycare is substantiated by their own records, arrives
    // with no payer and no account, and has one-record-per-taxpayer-per-year
    // cardinality. What a taxpayer's EMPLOYER provided is not here — that is
    // Form W-2 box 10, which `fjs/document/w2` already stores and which
    // `fjs/form1040/core` now reads.
    //
    // FLAT rather than one nested `dependentCare` object, matching every other
    // field on this dialect and on `vnd.fjs.return_profile`: the two arrays
    // below are the printed form's own two tables, and the seven scalars are
    // seven separate printed lines rather than members of anything.
    dependentCareProviders: option(array(dependentCareProviderEntry)),
    dependentCareQualifyingPersons: option(array(dependentCareQualifyingPersonEntry)),
    // Line 16 — "the total of all qualified expenses incurred in 2025 for the
    // care of your qualifying person(s). It doesn't matter when the expenses
    // were paid." ABSENT reads as zero and NOT as "the same as column (d)",
    // and the direction is deliberate: line 17 is min(line 15, line 16), so a
    // zero here makes every dependent care benefit taxable. A filer who
    // cannot substantiate an expense cannot exclude a benefit against it, and
    // erring the other way would understate income.
    dependentCareQualifiedExpensesIncurred: option(string),
    // Line 13 — an amount carried over from 2024 and used during 2025's grace
    // period (Notice 2005-42). Adds to the benefits being reconciled.
    dependentCareGraceCarryoverUsed: option(string),
    // Line 14 — an amount forfeited, or permitted to be carried forward into
    // 2026. SUBTRACTS on line 15, which is why the printed line prints its own
    // parentheses; stored as a positive amount, negated where the form
    // subtracts it.
    dependentCareForfeitedOrCarriedForward: option(string),
    // Line 22 — "Is any amount on line 12 or 13 from your sole proprietorship
    // or partnership?" `fjs/form2441` REFUSES a non-zero amount here rather
    // than computing line 24, because line 24's deductible benefits land on
    // Schedule C line 14, Schedule E line 19 or 28, or Schedule F line 15
    // (i2441 p5) and this engine would exclude the benefit from income
    // without ever deducting it on the business schedule.
    dependentCareBenefitsFromSoleProprietorshipOrPartnership: option(string),
    // Line 21's second sentence — "don't enter more than the maximum amount
    // allowed under your dependent care plan". A PLAN fact, not a statutory
    // one: §129(a)(2)(A)'s $5,000 is in `fjs/tax/params`, and this is the
    // taxpayer's own lower ceiling where their plan sets one. Absent means the
    // plan set none, which is safe in the one direction that matters — a plan
    // cannot pay out more than its own maximum, so box 10 already bounds it.
    dependentCarePlanMaximumExclusion: option(string),
    // Form 2441 line B's printed checkbox, read in the NEGATIVE direction:
    // the box certifies that deemed income IS being entered, and this field
    // certifies that it is NOT needed. §21(d)(2) deems a student or disabled
    // filer $250 (or $500) of earned income a MONTH, and no document here
    // carries per-month student or disability status. `fjs/form2441` refuses,
    // rather than assuming either way, whenever the earned-income limitation
    // actually binds and this certification is absent — and computes without
    // it when the limitation does not bind, because the deemed amount is a
    // floor and cannot then move any printed line.
    dependentCareFilerWasNeitherAStudentNorDisabled: option(true),
    // Line 9b — "If you paid 2024 expenses in 2025, complete Worksheet A".
    // `fjs/form2441` REFUSES a non-zero amount: Worksheet A needs five 2024
    // figures (that year's Form 2441 lines 3 and 6, its adjusted gross income,
    // and both spouses' earned income) and no stored document carries a prior
    // year's Form 2441 at all.
    dependentCarePriorYearExpensesPaidThisYear: option(string),
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
 * The six SCALAR Form 2441 money fields, walked in one loop for the reason
 * {@link studentExpenseFields} gives. The two ARRAY amounts — a provider's
 * `amountPaid` and a qualifying person's `qualifiedExpensesIncurredAndPaid` —
 * are checked separately below, exactly as `fjs/document/w2` separates its
 * scalar money boxes from the ones nested inside boxes 12 and 15-20.
 */
const dependentCareMoneyFields = /** @type {const} */ ([
    'dependentCareQualifiedExpensesIncurred',
    'dependentCareGraceCarryoverUsed',
    'dependentCareForfeitedOrCarriedForward',
    'dependentCareBenefitsFromSoleProprietorshipOrPartnership',
    'dependentCarePlanMaximumExclusion',
    'dependentCarePriorYearExpensesPaidThisYear',
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
 * 6. Every Form 2441 amount — the six scalars, a care provider's `amountPaid`
 *    and a qualifying person's `qualifiedExpensesIncurredAndPaid` — is an
 *    exact decimal within safe magnitude.
 * 7. No care provider carries an EMPTY `identifyingNumber` (Form 2441 line 1
 *    column (c) admits four printed answers, none of them blank), and no
 *    qualifying person's TIN appears twice — a duplicate there raises §21(c)'s
 *    expense cap from $3,000 to $6,000.
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
    // ── Form 2441 (TAX-38) ──────────────────────────────────────────────────
    for (const field of dependentCareMoneyFields) {
        const printed = r[field]
        if (printed === undefined) {
            continue
        }
        const message = moneyFieldError(field)(printed)
        if (message !== undefined) {
            return error(message)
        }
    }
    for (const provider of r.dependentCareProviders ?? []) {
        const message = moneyFieldError(`amountPaid for care provider ${provider.name}`)(
            provider.amountPaid)
        if (message !== undefined) {
            return error(message)
        }
        // Form 2441 line 1 column (c) admits four printed answers — an SSN or
        // ITIN, an EIN, "Tax-Exempt" and "LAFCP" — so the VALUE is not
        // checked, only its presence. An empty column (c) is a return the IRS
        // may disallow the credit on (i2441 p2, Due Diligence), and refusing
        // it here says so at ingest rather than at the form.
        if (provider.identifyingNumber === '') {
            return error(
                `care provider ${provider.name} carries an empty identifyingNumber — Form 2441 `
                + `line 1 column (c) admits an SSN or ITIN, an EIN, "Tax-Exempt" for a tax-exempt `
                + `organization, or "LAFCP" for a living-abroad foreign care provider, but not a `
                + `blank; a credit claimed without it may be disallowed`)
        }
    }
    /** @type {string[]} */
    const seenQualifyingPersonTins = []
    for (const person of r.dependentCareQualifyingPersons ?? []) {
        const message = moneyFieldError(
            `qualifiedExpensesIncurredAndPaid for ${person.name}`)(
            person.qualifiedExpensesIncurredAndPaid)
        if (message !== undefined) {
            return error(message)
        }
        // §21(c)'s cap is per RETURN and keyed to how many qualifying persons
        // there are, so one person entered twice does not merely double their
        // expenses — it moves the whole return from the $3,000 cap to the
        // $6,000 one. `educationStudents`' own duplicate check, applied where
        // a duplicate is worth twice as much.
        if (seenQualifyingPersonTins.includes(person.tin)) {
            return error(
                `dependentCareQualifyingPersons carries two entries for ${person.name} — Form `
                + `2441 line 2 is one row per person, and a person counted twice raises §21(c)'s `
                + `expense cap from $3,000 to $6,000`)
        }
        seenQualifyingPersonTins.push(person.tin)
        // §21(b)(1)'s two populations are DISJOINT, in the printed page's own
        // words. i2441 (2025) line 2 column (c) asks whether the person "was
        // over age 12 at the time the care was provided and was disabled";
        // `underAgeThirteenWhenTheCareWasProvided` asserts the opposite of the
        // first conjunct about the same care. A record asserting both has
        // answered one question twice, differently, and neither answer can be
        // preferred — so it is refused here rather than resolved. Absence of
        // BOTH is a different thing entirely: it is *unstated*, which is
        // `fjs/form2441`'s refusal to make, because only the form knows what
        // the missing answer would have been worth.
        if (
            person.overAgeTwelveAndDisabled === true
            && person.underAgeThirteenWhenTheCareWasProvided === true
        ) {
            return error(
                `qualifying person ${person.name} asserts BOTH overAgeTwelveAndDisabled and `
                + `underAgeThirteenWhenTheCareWasProvided — i2441 line 2 column (c) asks whether `
                + `the person "was over age 12 at the time the care was provided and was `
                + `disabled", and the same care cannot have been provided both over age 12 and `
                + `under age 13; drop whichever assertion is not true of this person`)
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
/** Independently hand-typed: the six SCALAR Form 2441 money fields. A field
 * dropped from `dependentCareMoneyFields` would otherwise shrink the exactness
 * loop AND the leaf that walks it in the same instant — AGENTS.md's fourth
 * shipped defect, in the shape this dialect is most exposed to.
 * @type {number} */
const expectedDependentCareMoneyFieldCount = 6

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
    // ── Form 2441 (TAX-38) ──────────────────────────────────────────────────
    dependentCare: {
        // A complete Part I / Part II / Part III record round-trips, and the
        // CONTROL for every refusal below.
        aCompleteRecordRoundTrips: () => {
            const [t, v] = validate({
                ...minimal,
                dependentCareProviders: [{
                    name: 'Sunny Days Daycare',
                    address: '1 Main St, Springfield, IL 62701',
                    identifyingNumber: '11-1111111',
                    amountPaid: '7200.00',
                }],
                dependentCareQualifyingPersons: [{
                    name: 'A. Child',
                    tin: '444-44-4444',
                    qualifiedExpensesIncurredAndPaid: '7200.00',
                }],
                dependentCareQualifiedExpensesIncurred: '7200.00',
                dependentCareFilerWasNeitherAStudentNorDisabled: true,
            })
            assert(t === 'ok', ['expected ok', t, v])
            if (t !== 'ok') {
                throw ['expected ok', v]
            }
            const provider = assertNotNullish(v.dependentCareProviders?.[0], 'the provider')
            assertEq(provider.amountPaid, '7200.00', 'the raw stored decimal, never re-formatted')
            assertEq(provider.householdEmployee, undefined, 'column (d) was not answered')
            const person = assertNotNullish(
                v.dependentCareQualifyingPersons?.[0], 'the qualifying person')
            assertEq(person.qualifiedExpensesIncurredAndPaid, '7200.00')
            assertEq(v.dependentCareQualifiedExpensesIncurred, '7200.00')
        },
        // Every one of the eight Form 2441 money fields is exactness-checked.
        // Written as a LOOP over a hand-typed list of the six scalars plus two
        // hand-written array cases, so a field dropped from
        // `dependentCareMoneyFields` fails the count beside it rather than
        // silently shrinking this leaf's coverage.
        everyMoneyFieldRejectsAnInexactDecimal: () => {
            assertEq(
                dependentCareMoneyFields.length,
                expectedDependentCareMoneyFieldCount,
                'six scalar Form 2441 money fields')
            for (const field of dependentCareMoneyFields) {
                const [t, v] = validate({ ...minimal, [field]: '1,000.00' })
                assertEq(t, 'error', [field, 'a thousands separator is not an exact decimal', v])
            }
            const [providerT] = validate({
                ...minimal,
                dependentCareProviders: [{
                    name: 'X', address: 'Y', identifyingNumber: 'Z', amountPaid: '1e3',
                }],
            })
            assertEq(providerT, 'error', 'a care provider amount is checked too')
            const [personT] = validate({
                ...minimal,
                dependentCareQualifyingPersons: [{
                    name: 'X', tin: '444-44-4444', qualifiedExpensesIncurredAndPaid: '12.345',
                }],
            })
            assertEq(personT, 'error', 'and a qualifying person amount, at three decimal places')
        },
        // The CONTROL for the exactness loop: the same eight fields accept a
        // well-formed decimal. A check that refused everything would pass the
        // leaf above on its own.
        everyMoneyFieldAcceptsAnExactDecimal: () => {
            for (const field of dependentCareMoneyFields) {
                const [t, v] = validate({ ...minimal, [field]: '1000.00' })
                assert(t === 'ok', [field, 'an exact decimal is accepted', v])
            }
        },
        anEmptyProviderIdentifyingNumberIsRefusedByName: () => {
            const [t, v] = validate({
                ...minimal,
                dependentCareProviders: [{
                    name: 'Sunny Days Daycare',
                    address: '1 Main St',
                    identifyingNumber: '',
                    amountPaid: '7200.00',
                }],
            })
            assertEq(t, 'error')
            assert(
                typeof v === 'string'
                && v.includes('Sunny Days Daycare')
                && v.includes('Tax-Exempt')
                && v.includes('LAFCP'),
                ['the refusal must name the provider and the printed alternatives', v])
        },
        // The three NON-numeric answers Form 2441 line 1 column (c) prints are
        // all accepted. This is the control for the emptiness check, and it is
        // three leaves in one because a pattern check added later would pass
        // the empty-string test and fail every one of these.
        theThreePrintedNonNumericIdentifyingNumbersAreAccepted: () => {
            for (const printed of ['Tax-Exempt', 'LAFCP', 'See W-2']) {
                const [t, v] = validate({
                    ...minimal,
                    dependentCareProviders: [{
                        name: 'An Employer',
                        address: '1 Main St',
                        identifyingNumber: printed,
                        amountPaid: '0.00',
                    }],
                })
                assert(t === 'ok', [printed, 'i2441 p3 prints this in column (c)', v])
            }
        },
        aDuplicateQualifyingPersonIsRefusedNamingTheCapItWouldMove: () => {
            const person = {
                name: 'A. Child',
                tin: '444-44-4444',
                qualifiedExpensesIncurredAndPaid: '3000.00',
            }
            const [t, v] = validate({
                ...minimal,
                dependentCareQualifyingPersons: [person, { ...person, name: 'A. Child (again)' }],
            })
            assertEq(t, 'error')
            assert(
                typeof v === 'string' && v.includes('$3,000') && v.includes('$6,000'),
                ['the refusal must name what a duplicate is worth, not merely that it exists', v])
        },
        // The CONTROL: two DIFFERENT qualifying persons are the ordinary
        // two-child return and must not be refused.
        twoDifferentQualifyingPersonsAreAccepted: () => {
            const [t, v] = validate({
                ...minimal,
                dependentCareQualifyingPersons: [
                    { name: 'A. Child', tin: '444-44-4444', qualifiedExpensesIncurredAndPaid: '3000.00' },
                    { name: 'B. Child', tin: '555-55-5555', qualifiedExpensesIncurredAndPaid: '3000.00' },
                ],
            })
            assert(t === 'ok', ['two children is an ordinary return', v])
        },
        // ── The two §21(b)(1) populations are DISJOINT ─────────────────────
        //
        // A record asserting both has answered i2441 line 2 column (c) twice,
        // differently, and neither answer can be preferred. Refused HERE
        // rather than in `fjs/form2441`, because it is a property of the
        // stored record: no computation is needed to see it.
        aPersonInBothPopulationsAtOnceIsRefused: () => {
            const [t, v] = validate({
                ...minimal,
                dependentCareQualifyingPersons: [{
                    name: 'A. Child',
                    tin: '444-44-4444',
                    overAgeTwelveAndDisabled: true,
                    underAgeThirteenWhenTheCareWasProvided: true,
                    qualifiedExpensesIncurredAndPaid: '3000.00',
                }],
            })
            assertEq(t, 'error')
            assert(
                typeof v === 'string'
                && v.includes('A. Child')
                && v.includes('over age 12 at the time the care was provided'),
                ['the refusal must name the person and quote the printed sentence', v])
        },
        // THREE controls, because the refusal has to fire on exactly one of
        // the four states of a pair of `option(true)`s. Hand-typed as four
        // rows rather than generated, so a state that stops being tested
        // fails the count rather than disappearing from a loop.
        theOtherThreeAgeAssertionStatesAreNotRefusedHere: () => {
            /** @type {readonly (readonly [string, boolean, boolean])[]} */
            const states = [
                ['neither — unstated, which is fjs/form2441 R6’s to refuse', false, false],
                ['§21(b)(1)(A), the under-13 dependent', false, true],
                ['§21(b)(1)(B)/(C), the disabled spouse or dependent', true, false],
            ]
            assertEq(states.length, 3, 'three of the four states of the pair are accepted here')
            for (const state of states) {
                const [why, over, under] = state
                const [t, v] = validate({
                    ...minimal,
                    dependentCareQualifyingPersons: [{
                        name: 'A. Child',
                        tin: '444-44-4444',
                        ...(over ? { overAgeTwelveAndDisabled: true } : {}),
                        ...(under ? { underAgeThirteenWhenTheCareWasProvided: true } : {}),
                        qualifiedExpensesIncurredAndPaid: '3000.00',
                    }],
                })
                assert(t === 'ok', [why, v])
            }
        },
        // DOC-12 in both directions: an absent certification stays absent
        // rather than reading back as `false`, and `false` is REFUSED rather
        // than accepted as "not certified" — the same discipline every other
        // `option(true)` on this dialect follows.
        theStudentOrDisabledCertificationIsOptionTrue: () => {
            const [absentT, absentV] = validate(minimal)
            assert(absentT === 'ok', ['expected ok', absentV])
            if (absentT !== 'ok') {
                throw ['expected ok', absentV]
            }
            assert(
                !('dependentCareFilerWasNeitherAStudentNorDisabled' in absentV),
                ['an absent certification must stay absent', absentV])
            const [falseT] = validate({
                ...minimal,
                dependentCareFilerWasNeitherAStudentNorDisabled: false,
            })
            assertEq(falseT, 'error', 'DOC-12: `false` is not a value this field takes')
        },
    },
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
