/**
 * Form 8863, *Education Credits (American Opportunity and Lifetime Learning
 * Credits)* — Part III per student, Part I's refundable American Opportunity
 * Credit (→ 1040 line 29) and Part II's nonrefundable education credits (→
 * Schedule 3 line 3), from ONE function execution (TAX-26, Phase 25).
 *
 * Source: the printed `f8863.pdf` (2025), line by line, plus the Credit Limit
 * Worksheet in its instructions. A STANDALONE, independently callable pure
 * function over already-extracted facts — the same relationship
 * `fjs/form8880`, `fjs/form8889` and `fjs/form8812` have to their own inputs.
 * It reads no stored documents and is not wired into `fjs/schedule/3` here.
 *
 * **One execution, two destinations**, for `fjs/form8812`'s own recorded
 * reason (13-CONTEXT.md Decision 4.3): Part I's line 8 and Part II's line 19
 * share every intermediate from line 1 down, and computing them separately
 * would leave one destination able to go stale on the other's state. Line 9 —
 * *"Subtract line 8 from line 7"* — is literally the arithmetic that hands
 * the leftover of the refundable computation to the nonrefundable one.
 *
 * ## TWO credits, and conflating them is the trap this module exists around
 *
 * | | American Opportunity | Lifetime Learning |
 * |---|---|---|
 * | computed | per STUDENT | per RETURN |
 * | formula | 100% of the first $2,000 + 25% of the next $2,000 | 20% of up to $10,000 |
 * | maximum | $2,500 per student | $2,000 per return |
 * | refundable | 40%, to 1040 line 29 | never |
 * | years | four taxable years per student | unlimited |
 * | enrolment | at least half-time, in a degree programme | any course |
 * | course materials | qualify wherever bought | only if paid to the institution |
 *
 * The last row is why {@link Form8863Student} carries the two expense figures
 * SEPARATELY rather than pre-summed. §25A(f)(1)(D) qualifies course materials
 * for the American Opportunity Credit whether or not they were bought from
 * the institution; the Lifetime Learning Credit reaches them only when paid
 * to the institution as a condition of enrolment. A single "qualified
 * expenses" input would make the same dollar qualify for both credits, and
 * nothing downstream could ever notice.
 *
 * ## The phase-out income has its OWN name, and its own add-back list
 *
 * TAX-15's rule: this engine now carries FOUR distinct modified adjusted
 * gross incomes and none of them is "the" one. {@link educationCreditPhaseoutIncome}
 * starts from adjusted gross income and adds back §911, §931 and §933
 * exclusions — which is a DIFFERENT list from §1411's (`fjs/form8960`), a
 * different list from Schedule 8812's (`fjs/form8812`), and a differently
 * SHAPED quantity from the student loan interest deduction's, which starts
 * from TOTAL INCOME rather than from adjusted gross income
 * (`fjs/schedule/1`). Every add-back below is permanently zero in this engine
 * — each is either unmodeled or a refused kind — and each is named rather
 * than omitted, mirroring `fjs/schedule/1a`'s own four zero add-backs.
 *
 * ## What this module COMPUTES and what it REFUSES
 *
 * | Printed line | Status |
 * |---|---|
 * | III 27-30 American Opportunity, per student | computed |
 * | III 31 Lifetime Learning, per student | computed |
 * | I 1-7 the refundable computation | computed |
 * | I 8 the 40% refundable portion | computed; **refused** for a filer who cannot show §25A(i) does not reach them |
 * | II 9-18 the nonrefundable computation | computed |
 * | II 19 the Credit Limit Worksheet | computed → Schedule 3 line 3 |
 * | a 1098-T box 4 or 6 prior-year adjustment | **refused** |
 * | a 1098-T box 10 insurance reimbursement | **refused** |
 * | an election contradicted by Part III's own facts | **refused** |
 *
 * ## §25A(i)'s under-24 rule, and why it is a refusal rather than a zero
 *
 * The refundable 40% is **not available** to a filer who, at the end of the
 * year, was under 18; or was 18 and whose earned income did not exceed half
 * their own support; or was over 18 and under 24 and a full-time student
 * whose earned income did not exceed half their own support — in each case
 * only if at least one parent was alive at the end of the year and the filer
 * is not filing a joint return.
 *
 * That is four facts this engine holds none of: the FILER's own age (the
 * profile carries a 65-or-older checkbox and nothing else), the ratio of
 * their earned income to their own support, whether a parent was alive, and
 * — the one it does hold — the filing status.
 *
 * So this module takes ONE input, `filerAttainedAgeTwentyFour`, which resolves
 * the whole rule for the great majority of filers in the affirmative
 * direction: a filer who reached 24 before the end of the year is outside
 * every branch of §25A(i), whatever the other three facts say. When it is
 * false and a refundable amount would otherwise arise, this module REFUSES —
 * it does not quietly move the amount to the nonrefundable side, which would
 * understate the refund without saying so, and it does not pay it out, which
 * would overstate it. A filer genuinely under 24 who IS entitled to the
 * refundable portion cannot be computed by this engine, and gets a refusal
 * naming the provision rather than a number.
 *
 * ## Boxes 4, 6 and 10 are refused HERE, which is why the dialect stores them
 *
 * `fjs/document/1098t` stores a prior-year adjustment and an insurance
 * reimbursement rather than refusing them at ingest, on the ground that both
 * are true and ordinary facts about a real form. This is the layer that acts
 * on them, and both refusals run **before the married-filing-separately
 * short-circuit below** — which is deliberate and is the one ordering
 * decision in this file a reader is likely to get wrong. §25A(g)(6) denies a
 * separate filer this year's CREDIT; it does not repeal the recapture of a
 * PRIOR year's, and a separate filer holding a box 4 adjustment still owes it.
 * Short-circuiting first would have made that recapture silently disappear
 * for exactly one filing status.
 *
 * ## §25A(g)(6): a married-filing-separately return is a determinate ZERO,
 * and `tsc` is what enforces it
 *
 * No education credit at all is allowed on a separate return, at any income —
 * which is why `fjs/tax/params`' {@link educationCredits} stores no threshold
 * for that status. The short-circuit runs as this function's second act,
 * before line 1 is assigned, mirroring `fjs/schedule/1`'s own §221(e)(2)
 * ordering discipline: MFS has no stored threshold at all, so leaving it to
 * fall out of the arithmetic is not merely untidy, it is unrepresentable.
 *
 * **That last word turns out to be literal, and a mutation found it rather
 * than a reading.** Weakening this gate's condition does not produce a wrong
 * number — it stops the build, with TS7053 at printed lines 2 and 13: the
 * early return is what NARROWS `status` out of `IndividualFilingStatus` and
 * into the four keys `phaseoutCeiling` and `phaseoutRange` actually have. So
 * the parameters' omission of a `marriedFilingSeparately` threshold and this
 * gate's presence are ONE mechanism, not two, and neither can be removed
 * while the other stands.
 *
 * Worth knowing before editing either: adding an MFS threshold "for
 * symmetry" would silently make this gate deletable, and deleting the gate is
 * caught only because the threshold is absent. `fjs/schedule/1`'s own
 * §221(e)(2) short-circuit has the same shape for the same reason, and nobody
 * had written it down there either.
 *
 * ## Rounding: the ratio first, then each product — the printed order
 *
 * Lines 6 and 17 both read *"enter the result as a decimal (rounded to at
 * least three places)"*, so the page rounds the RATIO and only then
 * multiplies, exactly as `fjs/schedule/1`'s student loan worksheet does at
 * its own line 7. That module's header records a mutation which proved the
 * two orders are indistinguishable on ordinary fixtures and differ only when
 * the exact ratio sits near a half-thousandth;
 * {@link proof.rounding.theRoundingPointIsTheRatioNotTheProduct} is this
 * form's own fixture at such a point, so the order is constrained here too
 * rather than inherited by analogy.
 *
 * @module
 */
import { assert, assertEq } from 'functionalscript/fjs/asserts/module.f.mjs'
import { of, halfUp } from '../types/rational/module.f.js'
import { centsFromString } from '../exact/module.f.js'
import { taxParamsByYear } from '../tax/params/module.f.js'

/** @import { TaxParamSet, IndividualFilingStatus } from '../tax/params/module.f.js' */

// ── The named income function (TAX-15) ───────────────────────────────────────

/**
 * **§25A(d)(3)'s modified adjusted gross income for the education credits** —
 * Form 8863's own lines 3 and 14, *"Enter the amount from Form 1040 or
 * 1040-SR, line 11. If you're filing Form 2555 or 4563, or you're excluding
 * income from Puerto Rico, see Pub. 970 for the amount to enter."*
 *
 * Its add-back list, per that instruction, every term permanently zero in
 * this engine and named rather than omitted:
 * - Form 2555's foreign earned income exclusion (§911) — **LIVE as of
 *   TAX-42**. `foreignEarnedIncomeExclusion` is a modeled kind, and this
 *   sentence used to say a return with one "produces no Form 1040 at all".
 * - Form 4563's exclusion for bona fide residents of American Samoa (§931) —
 *   no dialect models it.
 * - The §933 exclusion for income from Puerto Rico — no dialect models it.
 *
 * Deliberately does NOT call, import, or share a name with
 * `fjs/form8960`'s §1411 measure, `fjs/form8812`'s
 * `childTaxCreditPhaseoutIncome`, or `fjs/schedule/1`'s
 * `studentLoanInterestPhaseoutIncome` — the `qssParametersEqualMfjAndAreStoredIndependently`
 * precedent (`fjs/tax/params`): identical values, computed independently,
 * because the coincidence is contingent on what remains unmodeled today
 * rather than on the underlying rules being one rule. The student loan
 * measure is not even the same SHAPE, starting from total income rather than
 * from adjusted gross income.
 * @type {(agiCents: bigint) => (form2555ExclusionCents: bigint) => bigint}
 */
export const educationCreditPhaseoutIncome = agiCents => form2555ExclusionCents => {
    const form2555ForeignEarnedIncomeExclusion = form2555ExclusionCents
    const form4563AmericanSamoaExclusion = 0n
    const section933PuertoRicoExclusion = 0n
    return agiCents
        + form2555ForeignEarnedIncomeExclusion
        + form4563AmericanSamoaExclusion
        + section933PuertoRicoExclusion
}

// ── Inputs ───────────────────────────────────────────────────────────────────

/**
 * The taxpayer's own election between the two credits for one student — the
 * string values `fjs/document/credits` validates at the storage boundary.
 * §25A(c)(2) forbids both for one student in one year.
 * @typedef {'americanOpportunity' | 'lifetimeLearning'} EducationCreditElection
 */

/**
 * One student, as this module sees them: the election, the three expense
 * figures, Form 8863 Part III's own four yes/no facts (lines 23 through 26,
 * already normalized from `option(true)` to definite booleans by the caller),
 * and the two 1098-T conditions this module refuses on.
 *
 * The three expense figures are separate on purpose:
 * - `institutionalExpenseCents` is what an institution was paid — the sum of
 *   a stored 1098-T's box 1 and any `vnd.fjs.credits` assertion of tuition no
 *   institution reported. It qualifies for BOTH credits.
 * - `courseMaterialsNotPaidToTheInstitutionCents` qualifies for the American
 *   Opportunity Credit ONLY (§25A(f)(1)(D)); see this module's own docstring.
 * - `scholarshipsCents` is a 1098-T box 5 figure, which REDUCES the base for
 *   both (§25A(g)(2)).
 * @typedef {{
 *   readonly studentName: string,
 *   readonly credit: EducationCreditElection,
 *   readonly institutionalExpenseCents: bigint,
 *   readonly courseMaterialsNotPaidToTheInstitutionCents: bigint,
 *   readonly scholarshipsCents: bigint,
 *   readonly enrolledAtLeastHalfTimeInADegreeProgram: boolean,
 *   readonly americanOpportunityClaimedForFourPriorYears: boolean,
 *   readonly completedFirstFourYearsOfPostsecondaryEducation: boolean,
 *   readonly convictedOfAFelonyDrugOffense: boolean,
 *   readonly aStoredFormCarriesAPriorYearAdjustment: boolean,
 *   readonly aStoredFormCarriesAnInsuranceReimbursement: boolean,
 * }} Form8863Student
 */

/**
 * Everything Form 8863 reads.
 *
 * `earlierScheduleThreeCreditsCents` is the Credit Limit Worksheet's own line
 * 5, *"Enter the total of your credits from Schedule 3, lines 1 and 2, and
 * Schedule R, line 22"* — the two credits §26 orders BEFORE this one. Both
 * are refused `fjs/return/scope` kinds today, so the caller passes `0n`; the
 * input exists so the ordering is expressed rather than assumed.
 * @typedef {{
 *   readonly status: IndividualFilingStatus,
 *   readonly agiCents: bigint,
 *   readonly students: readonly Form8863Student[],
 *   readonly line18Cents: bigint,
 *   readonly earlierScheduleThreeCreditsCents: bigint,
 *   readonly filerAttainedAgeTwentyFour: boolean,
 *   readonly form2555ExclusionCents: bigint,
 * }} Form8863Input
 */

// ── Outputs ──────────────────────────────────────────────────────────────────

/**
 * One student's Part III, all five printed money lines. Lines 27 through 30
 * are the American Opportunity computation and line 31 is the Lifetime
 * Learning one; the printed page fills in ONE of the two per student, and the
 * other four (or one) lines stay blank. They are all present and zero here
 * rather than absent, for the reason `fjs/tax/line16/qdcgt` keeps its own
 * line 11: every printed line exists.
 * @typedef {{
 *   readonly studentName: string,
 *   readonly credit: EducationCreditElection,
 *   readonly line27: bigint, readonly line28: bigint, readonly line29: bigint,
 *   readonly line30: bigint, readonly line31: bigint,
 * }} Form8863StudentLines
 */

/**
 * The Credit Limit Worksheet from Form 8863's instructions, all seven printed
 * lines. Its line 7 is Form 8863 line 19, and thence Schedule 3 line 3.
 * @typedef {{
 *   readonly c1: bigint, readonly c2: bigint, readonly c3: bigint,
 *   readonly c4: bigint, readonly c5: bigint, readonly c6: bigint,
 *   readonly c7: bigint,
 * }} Form8863CreditLimitWorksheet
 */

/**
 * @typedef {{
 *   readonly kind: 'ok',
 *   readonly students: readonly Form8863StudentLines[],
 *   readonly line1: bigint, readonly line2: bigint, readonly line3: bigint,
 *   readonly line4: bigint, readonly line5: bigint, readonly line6Thousandths: bigint,
 *   readonly line7: bigint, readonly line8: bigint, readonly line9: bigint,
 *   readonly line10: bigint, readonly line11: bigint, readonly line12: bigint,
 *   readonly line13: bigint, readonly line14: bigint, readonly line15: bigint,
 *   readonly line16: bigint, readonly line17Thousandths: bigint,
 *   readonly line18: bigint, readonly line19: bigint,
 *   readonly creditLimitWorksheet: Form8863CreditLimitWorksheet,
 * }} Form8863Result
 */

/**
 * A case this module will not compute. A VALUE, never a throw — the same
 * shape `fjs/form8880`, `fjs/form8889` and `fjs/schedule/d` already return.
 * No `unmodeled` field: this is document-data sufficiency, not an
 * `fjs/return/scope` kind.
 * @typedef {{ readonly kind: 'error', readonly message: string }} Form8863Refusal
 */

/** @typedef {Form8863Result | Form8863Refusal} Form8863Outcome */

// ── Form 8863 itself ─────────────────────────────────────────────────────────

/**
 * The all-zero result a §25A(g)(6) separate return produces — every printed
 * line, explicitly. Written as a function rather than as an early `return` of
 * a literal so the shape cannot drift from {@link Form8863Result}'s, and so
 * the zero case is one object rather than twenty scattered `0n`s.
 * @type {(students: readonly Form8863StudentLines[]) => Form8863Result}
 */
const allZero = students => ({
    kind: 'ok',
    students,
    line1: 0n, line2: 0n, line3: 0n, line4: 0n, line5: 0n, line6Thousandths: 0n,
    line7: 0n, line8: 0n, line9: 0n,
    line10: 0n, line11: 0n, line12: 0n, line13: 0n, line14: 0n, line15: 0n,
    line16: 0n, line17Thousandths: 0n, line18: 0n, line19: 0n,
    creditLimitWorksheet: { c1: 0n, c2: 0n, c3: 0n, c4: 0n, c5: 0n, c6: 0n, c7: 0n },
})

/**
 * Computes Form 8863's Part III, Part I and Part II from one execution, or
 * refuses by name. See this module's own docstring for the full table.
 * @type {(taxParamSet: TaxParamSet) => (input: Form8863Input) => Form8863Outcome}
 */
export const form8863 = taxParamSet => input => {
    const {
        status, agiCents, students, line18Cents, earlierScheduleThreeCreditsCents,
        filerAttainedAgeTwentyFour, form2555ExclusionCents,
    } = input
    const { americanOpportunity, lifetimeLearning } = taxParamSet.educationCredits

    // ── The two document refusals, BEFORE the §25A(g)(6) short-circuit ───
    //
    // Deliberate, and the one ordering decision in this file a reader is
    // likely to get wrong — see this module's own docstring, "Boxes 4, 6 and
    // 10". A separate filer gets no credit THIS year and may still owe the
    // recapture of a PRIOR year's, so short-circuiting first would make that
    // recapture disappear for exactly one filing status.
    for (const student of students) {
        if (student.aStoredFormCarriesAPriorYearAdjustment) {
            return {
                kind: 'error',
                message: `Form 8863: the Form 1098-T for ${student.studentName} reports an `
                    + `adjustment for a prior year (box 4 or box 6), which means a figure a `
                    + `previous year's return already used has changed. §25A(g)(4) recaptures the `
                    + `difference as additional tax on 1040 line 16, which this engine does not `
                    + `model — 'educationCreditRecapture' is a refused kind in its own right. `
                    + `Refusing rather than computing this year's credit beside a tax it omitted`,
            }
        }
        if (student.aStoredFormCarriesAnInsuranceReimbursement) {
            return {
                kind: 'error',
                message: `Form 8863: the Form 1098-T for ${student.studentName} reports an `
                    + `insurance contract reimbursement or refund (box 10). Pub. 970's rules on `
                    + `refunded expenses turn on WHEN the reimbursement was received relative to `
                    + `the return, and can require either a reduction this year or a recapture in `
                    + `a later one; this engine models neither timing. Refusing rather than `
                    + `subtracting it and hoping the timing was the simple case`,
            }
        }
    }

    // ── §25A(g)(6): a separate return gets no education credit, at any
    //    income. Ahead of line 1, mirroring `fjs/schedule/1`'s own §221(e)(2)
    //    ordering: this status has no stored threshold at all, so leaving the
    //    zero to fall out of the arithmetic is unrepresentable rather than
    //    merely untidy.
    /** @type {readonly Form8863StudentLines[]} */
    const blankStudents = students.map(student => ({
        studentName: student.studentName,
        credit: student.credit,
        line27: 0n, line28: 0n, line29: 0n, line30: 0n, line31: 0n,
    }))
    if (status === 'marriedFilingSeparately') {
        return allZero(blankStudents)
    }

    const fullRateCapCents = centsFromString(americanOpportunity.fullRateExpenseCap.amount)
    const totalCapCents = centsFromString(americanOpportunity.totalExpenseCap.amount)

    // ── Part III, per student ────────────────────────────────────────────
    /** @type {Form8863StudentLines[]} */
    const studentLines = []
    for (const student of students) {
        // "Adjusted qualified education expenses" (§25A(g)(2)): scholarships
        // and grants reduce the base. The two credits' bases DIFFER by the
        // course materials term -- see this module's own docstring.
        const americanOpportunityBase = student.institutionalExpenseCents
            + student.courseMaterialsNotPaidToTheInstitutionCents
            - student.scholarshipsCents
        const lifetimeLearningBase = student.institutionalExpenseCents - student.scholarshipsCents
        if (student.credit === 'lifetimeLearning') {
            // 31. "Adjusted qualified education expenses." Lines 27-30 stay
            //     blank on the printed page for this student.
            studentLines.push({
                studentName: student.studentName,
                credit: student.credit,
                line27: 0n, line28: 0n, line29: 0n, line30: 0n,
                line31: lifetimeLearningBase > 0n ? lifetimeLearningBase : 0n,
            })
            continue
        }
        // 27. "Adjusted qualified education expenses. Don't enter more than
        //     $4,000."
        const uncapped = americanOpportunityBase > 0n ? americanOpportunityBase : 0n
        const line27 = uncapped < totalCapCents ? uncapped : totalCapCents
        // The printed Part III's own lines 23-26 decide whether this student
        // may take the American Opportunity Credit at all. The taxpayer
        // ELECTED it; if the four facts say otherwise, the election and the
        // facts contradict each other and this engine will not resolve a
        // contradiction between two taxpayer assertions by silently picking
        // one. The printed page routes such a student to line 31 -- doing
        // that here would hand them the Lifetime Learning Credit without
        // saying so, and a taxpayer who believed they had claimed $2,500
        // would find $2,000 or less with nothing explaining the difference.
        //
        // Gated on there being expenses to credit: a disqualified student
        // with no adjusted expenses produces $0 either way, and refusing
        // there would be noise rather than information.
        if (line27 > 0n) {
            /** @type {readonly (readonly [boolean, string])[]} */
            const disqualifiers = [
                [
                    student.americanOpportunityClaimedForFourPriorYears,
                    'the American Opportunity Credit has already been claimed for this student for '
                    + 'four prior tax years (Part III line 23)',
                ],
                [
                    !student.enrolledAtLeastHalfTimeInADegreeProgram,
                    'this return does not assert that the student was enrolled at least half-time '
                    + 'in a programme leading to a degree or recognized credential (Part III line 24)',
                ],
                [
                    student.completedFirstFourYearsOfPostsecondaryEducation,
                    'the student had already completed the first four years of postsecondary '
                    + 'education (Part III line 25)',
                ],
                [
                    student.convictedOfAFelonyDrugOffense,
                    'the student has a felony conviction for possession or distribution of a '
                    + 'controlled substance (Part III line 26)',
                ],
            ]
            const failing = disqualifiers.filter(([fails]) => fails).map(([, reason]) => reason)
            const [firstReason] = failing
            if (firstReason !== undefined) {
                return {
                    kind: 'error',
                    message: `Form 8863: this return elects the American Opportunity Credit for `
                        + `${student.studentName}, but ${firstReason}. §25A(b)(2) does not allow it. `
                        + `The printed form would route this student to the Lifetime Learning `
                        + `Credit instead; this engine refuses rather than changing an election the `
                        + `taxpayer made, because a return that quietly claimed a different, `
                        + `smaller, entirely nonrefundable credit would not say so anywhere`,
                }
            }
        }
        // 28. "Subtract $2,000 from line 27. If zero or less, enter -0-."
        const line28 = line27 > fullRateCapCents ? line27 - fullRateCapCents : 0n
        // 29. "Multiply line 28 by 25% (0.25)."
        const line29 = halfUp(of(line28 * BigInt(americanOpportunity.reducedRatePercent))(100n))
        // 30. "If line 28 is zero, enter the amount from line 27. Otherwise,
        //     add $2,000 to the amount on line 29."
        const line30 = line28 === 0n ? line27 : fullRateCapCents + line29
        studentLines.push({
            studentName: student.studentName,
            credit: student.credit,
            line27, line28, line29, line30, line31: 0n,
        })
    }

    // ── Part I: the refundable American Opportunity Credit ───────────────
    // 1. "After completing Part III for each student, enter the total of all
    //    amounts from all Parts III, line 30."
    const line1 = studentLines.reduce((total, s) => total + s.line30, 0n)
    // 2. "$180,000 if married filing jointly; $90,000 if single, head of
    //    household, or qualifying surviving spouse."
    const line2 = centsFromString(taxParamSet.educationCredits.phaseoutCeiling[status].amount)
    // 3. Modified adjusted gross income, through its OWN named function
    //    (TAX-15) rather than a bare `agiCents` here.
    const line3 = educationCreditPhaseoutIncome(agiCents)(form2555ExclusionCents)
    // 4. "Subtract line 3 from line 2. If zero or less, STOP; you can't take
    //    any education credit." A whole-form stop, not merely a Part I one --
    //    lines 13/14/15 repeat the identical comparison, so line 15 is
    //    non-positive exactly when this is, and the printed page says so
    //    once.
    if (line3 >= line2) {
        return allZero(studentLines)
    }
    const line4 = line2 - line3
    // 5. "$20,000 if married filing jointly; $10,000 if single, head of
    //    household, or qualifying surviving spouse."
    const line5 = centsFromString(taxParamSet.educationCredits.phaseoutRange[status].amount)
    // 6. "If line 4 is equal to or more than line 5, enter 1.000. Otherwise,
    //    divide line 4 by line 5. Enter the result as a decimal (rounded to
    //    at least three places)." The page rounds the RATIO, then multiplies.
    const line6Thousandths = line4 >= line5 ? 1000n : halfUp(of(line4 * 1000n)(line5))
    // 7. "Multiply line 1 by line 6."
    const line7 = halfUp(of(line1 * line6Thousandths)(1000n))
    // 8. "Refundable American opportunity credit. Multiply line 7 by 40%
    //    (0.40). Enter here and on Form 1040 or 1040-SR, line 29."
    //
    //    §25A(i)'s under-24 rule is what this engine cannot determine; see
    //    the module docstring. Refused only when it would actually change
    //    something, so a filer with no American Opportunity Credit at all is
    //    never asked about their own age.
    if (line7 > 0n && !filerAttainedAgeTwentyFour) {
        return {
            kind: 'error',
            message: 'Form 8863 line 8 (the refundable American opportunity credit) cannot be '
                + 'computed: §25A(i) denies the refundable 40% to certain filers under age 24, and '
                + 'nothing on this return establishes that the filer had attained 24 by the end of '
                + "the year. The rule also turns on the filer's earned income as a fraction of "
                + 'their own support and on whether a parent was alive at year end, neither of '
                + 'which any document this engine models carries. Refusing rather than paying out '
                + '40% that may not be refundable, or quietly moving it to the nonrefundable side '
                + 'and understating the refund without saying so',
        }
    }
    const line8 = halfUp(of(line7 * BigInt(americanOpportunity.refundablePercent))(100n))
    // 9. "Subtract line 8 from line 7. Enter here and on line 2 of the Credit
    //    Limit Worksheet." THE handoff from Part I to Part II.
    const line9 = line7 - line8

    // ── Part II: the nonrefundable education credits ─────────────────────
    // 10. "After completing Part III for each student, enter the total of all
    //     amounts from all Parts III, line 31."
    const line10 = studentLines.reduce((total, s) => total + s.line31, 0n)
    // 11. "Enter the smaller of line 10 or $10,000." PER RETURN -- the single
    //     most-confused fact about this credit, and the reason this cap is
    //     applied to the SUM here rather than inside Part III as the American
    //     Opportunity Credit's $4,000 is.
    const lifetimeCapCents = centsFromString(lifetimeLearning.expenseCap.amount)
    const line11 = line10 < lifetimeCapCents ? line10 : lifetimeCapCents
    // 12. "Multiply line 11 by 20% (0.20)."
    const line12 = halfUp(of(line11 * BigInt(lifetimeLearning.ratePercent))(100n))
    // 13/14. The SAME two figures as lines 2 and 3, restated as their own
    //        printed lines rather than folded away.
    const line13 = line2
    const line14 = line3
    // 15. "Subtract line 14 from line 13. If zero or less, skip lines 16 and
    //     17, enter -0- on line 18." Unreachable as a zero here, because
    //     line 4's own stop above already returned; kept as the printed
    //     line's own arithmetic.
    const line15 = line13 > line14 ? line13 - line14 : 0n
    // 16/17. The same range and the same three-decimal ratio as lines 5/6.
    const line16 = line5
    const line17Thousandths = line15 >= line16 ? 1000n : halfUp(of(line15 * 1000n)(line16))
    // 18. "Multiply line 12 by line 17."
    const line18 = halfUp(of(line12 * line17Thousandths)(1000n))

    // ── The Credit Limit Worksheet ───────────────────────────────────────
    const c1 = line18
    const c2 = line9
    const c3 = c1 + c2
    const c4 = line18Cents
    const c5 = earlierScheduleThreeCreditsCents
    const c6 = c4 > c5 ? c4 - c5 : 0n
    const c7 = c3 < c6 ? c3 : c6
    // 19. "Nonrefundable education credits. Enter the amount from line 7 of
    //     the Credit Limit Worksheet here and on Schedule 3 (Form 1040),
    //     line 3."
    const line19 = c7
    assert(line19 >= 0n, ['Form 8863 line 19 must never be negative', line19])
    assert(line8 >= 0n, ['Form 8863 line 8 must never be negative', line8])

    return {
        kind: 'ok',
        students: studentLines,
        line1, line2, line3, line4, line5, line6Thousandths, line7, line8, line9,
        line10, line11, line12, line13, line14, line15, line16, line17Thousandths,
        line18, line19,
        creditLimitWorksheet: { c1, c2, c3, c4, c5, c6, c7 },
    }
}

// ── Tests ────────────────────────────────────────────────────────────────────

/**
 * TY2025's parameter set, narrowed exactly ONCE at module scope, mirroring
 * `fjs/form8880`'s and `fjs/form8889`'s own precedent.
 */
const taxParams2025 = taxParamsByYear[2025]
assert(taxParams2025 !== undefined, 'expected TY2025 parameters to be present in taxParamsByYear')

/** @type {(overrides: Partial<Form8863Student>) => Form8863Student} */
const student = overrides => ({
    studentName: 'A. Student',
    credit: 'americanOpportunity',
    institutionalExpenseCents: 0n,
    courseMaterialsNotPaidToTheInstitutionCents: 0n,
    scholarshipsCents: 0n,
    enrolledAtLeastHalfTimeInADegreeProgram: true,
    americanOpportunityClaimedForFourPriorYears: false,
    completedFirstFourYearsOfPostsecondaryEducation: false,
    convictedOfAFelonyDrugOffense: false,
    aStoredFormCarriesAPriorYearAdjustment: false,
    aStoredFormCarriesAnInsuranceReimbursement: false,
    ...overrides,
})

/** @type {(overrides: Partial<Form8863Input>) => Form8863Input} */
const baseInput = overrides => ({
    status: 'single',
    agiCents: 4000000n,             // $40,000.00 -- far below the phase-out
    students: [student({ institutionalExpenseCents: 900000n })], // $9,000.00
    line18Cents: 100000000n,        // ample, so the credit limit never binds
    earlierScheduleThreeCreditsCents: 0n,
    filerAttainedAgeTwentyFour: true,
    form2555ExclusionCents: 0n,
    ...overrides,
})

/** @type {(outcome: Form8863Outcome) => Form8863Result} */
const okResult = outcome => {
    assert(outcome.kind === 'ok', ['expected a computed Form 8863', outcome])
    return outcome
}

/** @type {(outcome: Form8863Outcome) => Form8863Refusal} */
const refusal = outcome => {
    assert(outcome.kind === 'error', ['expected a refusal', outcome])
    return outcome
}

/** @type {(input: Form8863Input) => Form8863Outcome} */
const compute = form8863(taxParams2025)

export const proof = {
    // ── The American Opportunity Credit's own two-rate formula ─────────────
    americanOpportunity: {
        // The maximum case, every line hand-typed from the printed form's own
        // arithmetic: $9,000 of expenses caps at line 27 = $4,000; line 28 =
        // $4,000 - $2,000 = $2,000; line 29 = 25% of $2,000 = $500; line 30 =
        // $2,000 + $500 = $2,500; line 1 = $2,500; line 6 = 1.000 (income far
        // below the phase-out); line 7 = $2,500; line 8 = 40% of $2,500 =
        // $1,000 -> 1040 line 29; line 9 = $2,500 - $1,000 = $1,500 ->
        // Schedule 3 line 3 (the liability limit is ample).
        theMaximumPerStudentIsTwoThousandFiveHundred: () => {
            const result = okResult(compute(baseInput({})))
            const s = result.students[0]
            assertEq(s?.line27, 400000n, '$4,000.00 -- capped, not the $9,000.00 paid')
            assertEq(s?.line28, 200000n, '$4,000.00 - $2,000.00')
            assertEq(s?.line29, 50000n, '25% of $2,000.00 = $500.00')
            assertEq(s?.line30, 250000n, '$2,000.00 + $500.00 = $2,500.00')
            assertEq(result.line1, 250000n)
            assertEq(result.line6Thousandths, 1000n, 'no phase-out at $40,000.00')
            assertEq(result.line7, 250000n)
            assertEq(result.line8, 100000n, '40% of $2,500.00 = $1,000.00 -> 1040 line 29')
            assertEq(result.line9, 150000n, '$2,500.00 - $1,000.00 = $1,500.00')
            assertEq(result.line19, 150000n, '-> Schedule 3 line 3')
        },
        // Below $2,000 the credit is 100% of the expenses and line 30 takes
        // its OTHER branch ("if line 28 is zero, enter the amount from line
        // 27"). $1,500 of expenses is a $1,500 credit, not $2,000 and not
        // $375.
        underTwoThousandTheCreditIsAllOfTheExpenses: () => {
            const result = okResult(compute(baseInput({
                students: [student({ institutionalExpenseCents: 150000n })],
            })))
            const s = result.students[0]
            assertEq(s?.line27, 150000n)
            assertEq(s?.line28, 0n, 'the second slice is empty')
            assertEq(s?.line30, 150000n, '100% of the first $2,000.00 of expenses')
            assertEq(result.line7, 150000n)
        },
        // Exactly $2,000 is the boundary between line 30's two branches, and
        // both must give $2,000. A `>` written `>=` at line 28, or the
        // branches taken the other way round, moves this to $2,000 + 25% of
        // nothing... which is the same. The value that DOES distinguish them
        // is one cent more, so both are asserted together.
        theTwoThousandBoundaryTakesBothBranchesToTheSamePlace: () => {
            const at = okResult(compute(baseInput({
                students: [student({ institutionalExpenseCents: 200000n })],
            })))
            assertEq(at.students[0]?.line28, 0n, 'exactly $2,000.00: the second slice is empty')
            assertEq(at.students[0]?.line30, 200000n, '$2,000.00')
            const oneCentMore = okResult(compute(baseInput({
                students: [student({ institutionalExpenseCents: 200001n })],
            })))
            assertEq(oneCentMore.students[0]?.line28, 1n, '$0.01 in the second slice')
            assertEq(oneCentMore.students[0]?.line29, 0n, '25% of $0.01 rounds to $0.00')
            assertEq(oneCentMore.students[0]?.line30, 200000n, 'still $2,000.00')
            const fourCentsMore = okResult(compute(baseInput({
                students: [student({ institutionalExpenseCents: 200004n })],
            })))
            assertEq(fourCentsMore.students[0]?.line29, 1n, '25% of $0.04 = $0.01, the first cent')
            assertEq(fourCentsMore.students[0]?.line30, 200001n)
        },
        // PER STUDENT: two students at the maximum give $5,000, not $2,500.
        // The cap is inside Part III, applied once per student, and this is
        // the leaf that says so.
        theMaximumIsPerStudentNotPerReturn: () => {
            const result = okResult(compute(baseInput({
                students: [
                    student({ studentName: 'A. Student', institutionalExpenseCents: 900000n }),
                    student({ studentName: 'B. Student', institutionalExpenseCents: 900000n }),
                ],
            })))
            assertEq(result.students.length, 2)
            assertEq(result.line1, 500000n, '$2,500.00 x 2 = $5,000.00')
            assertEq(result.line8, 200000n, '40% of $5,000.00 = $2,000.00')
        },
        // Course materials bought outside the institution DO count here.
        // $1,500 of tuition plus $700 of textbooks reaches $2,200, which
        // crosses the $2,000 boundary that $1,500 alone does not.
        courseMaterialsBoughtElsewhereCountForThisCredit: () => {
            const result = okResult(compute(baseInput({
                students: [student({
                    institutionalExpenseCents: 150000n,
                    courseMaterialsNotPaidToTheInstitutionCents: 70000n,
                })],
            })))
            assertEq(result.students[0]?.line27, 220000n, '$1,500.00 + $700.00')
            assertEq(result.students[0]?.line28, 20000n, '$200.00 in the second slice')
            assertEq(result.students[0]?.line29, 5000n, '25% of $200.00 = $50.00')
            assertEq(result.students[0]?.line30, 205000n, '$2,000.00 + $50.00 = $2,050.00')
        },
        // §25A(g)(2): scholarships REDUCE the base. $9,000 of tuition against
        // $6,000 of scholarships leaves $3,000, which is BELOW the $4,000 cap
        // — so this leaf also proves the cap is not being applied before the
        // subtraction, which would have left $4,000.
        scholarshipsReduceTheBaseBeforeTheCap: () => {
            const result = okResult(compute(baseInput({
                students: [student({
                    institutionalExpenseCents: 900000n,
                    scholarshipsCents: 600000n,
                })],
            })))
            assertEq(result.students[0]?.line27, 300000n, '$9,000.00 - $6,000.00 = $3,000.00')
            assert(
                result.students[0]?.line27 !== 400000n,
                ['the cap must not be applied before the scholarship subtraction', result.students[0]],
            )
            assertEq(result.students[0]?.line30, 225000n, '$2,000.00 + 25% of $1,000.00 = $2,250.00')
        },
        // A scholarship larger than the expenses gives ZERO, never a negative
        // credit. The printed page has no negative branch and neither does
        // this one.
        scholarshipsExceedingTheExpensesGiveZeroNotANegative: () => {
            const result = okResult(compute(baseInput({
                students: [student({
                    institutionalExpenseCents: 200000n,
                    scholarshipsCents: 500000n,
                })],
            })))
            assertEq(result.students[0]?.line27, 0n)
            assertEq(result.students[0]?.line30, 0n)
            assertEq(result.line8, 0n)
        },
    },

    // ── The Lifetime Learning Credit ───────────────────────────────────────
    lifetimeLearning: {
        // 20% of up to $10,000, PER RETURN, entirely nonrefundable. $6,000 of
        // expenses is a $1,200 credit and NONE of it reaches 1040 line 29.
        twentyPercentAndNothingRefundable: () => {
            const result = okResult(compute(baseInput({
                students: [student({
                    credit: 'lifetimeLearning',
                    institutionalExpenseCents: 600000n,
                })],
            })))
            assertEq(result.students[0]?.line31, 600000n)
            assertEq(result.students[0]?.line30, 0n, 'the American Opportunity lines stay blank')
            assertEq(result.line1, 0n, 'nothing reaches Part I')
            assertEq(result.line8, 0n, 'and nothing reaches 1040 line 29')
            assertEq(result.line10, 600000n)
            assertEq(result.line11, 600000n)
            assertEq(result.line12, 120000n, '20% of $6,000.00 = $1,200.00')
            assertEq(result.line19, 120000n, '-> Schedule 3 line 3, all of it nonrefundable')
        },
        // The $10,000 cap is PER RETURN, which is the opposite of the
        // American Opportunity Credit's per-student $4,000. Two students with
        // $8,000 each give $16,000 of expenses and a $2,000 credit, not
        // $3,200.
        theCapIsPerReturnNotPerStudent: () => {
            const result = okResult(compute(baseInput({
                students: [
                    student({ studentName: 'A. Student', credit: 'lifetimeLearning', institutionalExpenseCents: 800000n }),
                    student({ studentName: 'B. Student', credit: 'lifetimeLearning', institutionalExpenseCents: 800000n }),
                ],
            })))
            assertEq(result.line10, 1600000n, '$16,000.00 of expenses')
            assertEq(result.line11, 1000000n, 'capped at $10,000.00 for the RETURN')
            assertEq(result.line12, 200000n, '$2,000.00 -- never $3,200.00')
        },
        // Course materials bought OUTSIDE the institution do NOT count here,
        // which is the row of this module's own table that a one-expense-total
        // design would have erased. The same $700 of textbooks that raised the
        // American Opportunity base above changes nothing at all.
        courseMaterialsBoughtElsewhereDoNotCountForThisCredit: () => {
            const withMaterials = okResult(compute(baseInput({
                students: [student({
                    credit: 'lifetimeLearning',
                    institutionalExpenseCents: 150000n,
                    courseMaterialsNotPaidToTheInstitutionCents: 70000n,
                })],
            })))
            const without = okResult(compute(baseInput({
                students: [student({
                    credit: 'lifetimeLearning',
                    institutionalExpenseCents: 150000n,
                })],
            })))
            assertEq(withMaterials.line10, 150000n, '$1,500.00 -- the textbooks are excluded')
            assertEq(withMaterials.line10, without.line10, 'and they change nothing at all')
            assertEq(withMaterials.line12, 30000n, '20% of $1,500.00 = $300.00')
        },
        // The two credits on one return, one student each: the American
        // Opportunity half splits across two 1040 destinations and the
        // Lifetime Learning half reaches only one.
        bothCreditsOnOneReturnReachTheirOwnDestinations: () => {
            const result = okResult(compute(baseInput({
                students: [
                    student({ studentName: 'A. Student', institutionalExpenseCents: 900000n }),
                    student({ studentName: 'B. Student', credit: 'lifetimeLearning', institutionalExpenseCents: 600000n }),
                ],
            })))
            assertEq(result.line1, 250000n, 'the American Opportunity student alone')
            assertEq(result.line10, 600000n, 'the Lifetime Learning student alone')
            assertEq(result.line8, 100000n, '$1,000.00 refundable -> 1040 line 29')
            assertEq(result.line9, 150000n, '$1,500.00 of the AOC is nonrefundable')
            assertEq(result.line18, 120000n, '$1,200.00 of Lifetime Learning')
            assertEq(result.line19, 270000n, '$1,500.00 + $1,200.00 -> Schedule 3 line 3')
        },
    },

    // ── The phase-out, at its boundaries ───────────────────────────────────
    phaseout: {
        // The single filer's range is $80,000 to $90,000. Hand-typed
        // boundaries: at $80,000.00 the ratio is 1.000 and the credit is
        // whole; one cent later it starts to shrink; at $90,000.00 exactly
        // the form STOPS ("if zero or less").
        singleFilerAtBothEndsOfTheRange: () => {
            const atStart = okResult(compute(baseInput({ agiCents: 8000000n })))
            assertEq(atStart.line4, 1000000n, '$90,000.00 - $80,000.00 = $10,000.00')
            assertEq(atStart.line6Thousandths, 1000n, 'equal to line 5, so 1.000')
            assertEq(atStart.line7, 250000n, 'the whole $2,500.00')

            const oneCentIn = okResult(compute(baseInput({ agiCents: 8000001n })))
            assertEq(oneCentIn.line4, 999999n, '$9,999.99')
            assertEq(oneCentIn.line6Thousandths, 1000n, '0.9999999 rounds to 1.000 at three places')
            assertEq(oneCentIn.line7, 250000n, 'and one cent of income costs nothing, unlike Form 8880')

            const oneCentBelowTheCeiling = okResult(compute(baseInput({ agiCents: 8999999n })))
            assertEq(oneCentBelowTheCeiling.line4, 1n, '$0.01 of headroom left')
            assertEq(oneCentBelowTheCeiling.line6Thousandths, 0n, '0.000001 rounds to 0.000')
            assertEq(oneCentBelowTheCeiling.line7, 0n)

            const atTheCeiling = compute(baseInput({ agiCents: 9000000n }))
            const stopped = okResult(atTheCeiling)
            assertEq(stopped.line4, 0n, 'exactly at $90,000.00: line 4 is zero, so the form STOPS')
            assertEq(stopped.line7, 0n)
            assertEq(stopped.line19, 0n)
            assertEq(stopped.line1, 0n, 'the stop zeroes Part II as well as Part I')
        },
        // Halfway through the range the credit is halved. $85,000.00 leaves
        // $5,000 of $10,000, a ratio of 0.500, and $2,500 becomes $1,250 --
        // of which 40% ($500) is refundable.
        halfwayThroughTheRangeHalvesTheCredit: () => {
            const result = okResult(compute(baseInput({ agiCents: 8500000n })))
            assertEq(result.line4, 500000n, '$5,000.00')
            assertEq(result.line6Thousandths, 500n, '0.500')
            assertEq(result.line7, 125000n, '$1,250.00')
            assertEq(result.line8, 50000n, '40% of $1,250.00 = $500.00')
            assertEq(result.line9, 75000n, '$750.00')
        },
        // The joint range is twice as wide and starts twice as high, and the
        // ratio at the SAME fraction of it is the same -- which is what a
        // status-blind range would get wrong.
        theJointRangeIsTwiceAsWideAndStartsTwiceAsHigh: () => {
            const result = okResult(compute(baseInput({
                status: 'marriedFilingJointly',
                agiCents: 17000000n,     // $170,000.00 -- halfway through $160,000-$180,000
            })))
            assertEq(result.line2, 18000000n, '$180,000.00')
            assertEq(result.line5, 2000000n, '$20,000.00')
            assertEq(result.line4, 1000000n, '$10,000.00')
            assertEq(result.line6Thousandths, 500n, '0.500 -- the same fraction, a different range')
            assertEq(result.line7, 125000n)
        },
        // The Lifetime Learning Credit phases out over the SAME range, which
        // has only been true since 2021. Lines 13/14/15/16/17 restate lines
        // 2/3/4/5/6 and this is the leaf that pins the equality rather than
        // leaving it to be assumed.
        bothCreditsPhaseOutOverTheSameRangeToday: () => {
            const result = okResult(compute(baseInput({
                agiCents: 8500000n,
                students: [
                    student({ studentName: 'A. Student', institutionalExpenseCents: 900000n }),
                    student({ studentName: 'B. Student', credit: 'lifetimeLearning', institutionalExpenseCents: 600000n }),
                ],
            })))
            assertEq(result.line13, result.line2, 'line 13 restates line 2')
            assertEq(result.line14, result.line3, 'line 14 restates line 3')
            assertEq(result.line15, result.line4, 'line 15 restates line 4')
            assertEq(result.line16, result.line5, 'line 16 restates line 5')
            assertEq(result.line17Thousandths, result.line6Thousandths, 'and line 17 restates line 6')
            assertEq(result.line18, 60000n, '$1,200.00 x 0.500 = $600.00')
        },
    },

    // ── The rounding point (the printed order, constrained) ────────────────
    rounding: {
        // The printed page rounds the RATIO to three places and only then
        // multiplies. `fjs/schedule/1`'s header records that ordinary
        // fixtures cannot tell that apart from one rounding at the end; the
        // two differ only where the exact ratio sits near a half-thousandth.
        //
        // Here: adjusted gross income $84,995.00 leaves line 4 = $5,005.00,
        // and 5,005 / 10,000 = 0.5005 exactly — the half-thousandth the
        // printed line 6 rounds UP to 0.501. Against line 1 = $2,500.00:
        //   printed order:   $2,500.00 x 0.501            = $1,252.50
        //   the alternative: round($2,500.00 x 0.5005)    = $1,251.25
        // — $1.25 apart. This is the ONLY leaf in this file that constrains
        // the order.
        //
        // **The first draft of this fixture used $84,997.50 and asserted
        // 0.501, and it was wrong**: 0.50025 rounds DOWN to 0.500, so the two
        // orders agreed and the leaf proved nothing while looking as though
        // it did. It failed on its first run and is recorded here rather than
        // quietly corrected, because a rounding fixture that lands on the
        // wrong side of the boundary is exactly the decoration this discipline
        // exists to catch.
        theRoundingPointIsTheRatioNotTheProduct: () => {
            const result = okResult(compute(baseInput({ agiCents: 8499500n })))
            assertEq(result.line4, 500500n, '$5,005.00')
            assertEq(result.line6Thousandths, 501n, '0.5005 rounds UP to 0.501 at three places')
            assertEq(result.line7, 125250n, '$2,500.00 x 0.501 = $1,252.50')
            const oneRoundingAtTheEnd = halfUp(of(250000n * 500500n)(1000000n))
            assertEq(oneRoundingAtTheEnd, 125125n, 'the alternative order would give $1,251.25')
            assert(
                result.line7 !== oneRoundingAtTheEnd,
                ['this fixture must distinguish the two orders', result.line7, oneRoundingAtTheEnd],
            )
        },
    },

    // ── The Credit Limit Worksheet, and the ordering it encodes ────────────
    creditLimitWorksheet: {
        // The nonrefundable half cannot exceed the tax it offsets. $200 of
        // tax caps a $1,500 nonrefundable credit at $200 -- and the
        // REFUNDABLE half is untouched, which is the whole difference between
        // the two destinations.
        theNonrefundableHalfIsCappedByTaxLiabilityAndTheRefundableHalfIsNot: () => {
            const result = okResult(compute(baseInput({ line18Cents: 20000n })))
            assertEq(result.line8, 100000n, '$1,000.00 refundable, uncapped -> 1040 line 29')
            assertEq(result.creditLimitWorksheet.c3, 150000n, '$1,500.00 wanted')
            assertEq(result.creditLimitWorksheet.c6, 20000n, '$200.00 of tax available')
            assertEq(result.line19, 20000n, '$200.00 -> Schedule 3 line 3')
        },
        // The worksheet's line 5 subtracts the credits §26 orders BEFORE this
        // one (Schedule 3 lines 1 and 2, and Schedule R). Both are refused
        // kinds today, so the input is always `0n` in production — this leaf
        // exercises the arithmetic anyway, so the ordering is proven rather
        // than merely expressed.
        earlierCreditsReduceTheLimit: () => {
            const result = okResult(compute(baseInput({
                line18Cents: 100000n,
                earlierScheduleThreeCreditsCents: 40000n,
            })))
            assertEq(result.creditLimitWorksheet.c4, 100000n, '$1,000.00 of tax')
            assertEq(result.creditLimitWorksheet.c5, 40000n, '$400.00 of earlier credits')
            assertEq(result.creditLimitWorksheet.c6, 60000n, '$600.00 left')
            assertEq(result.line19, 60000n, 'the $1,500.00 wanted, capped at $600.00')
        },
        // A credit that exceeds the tax must not create a refund. Zero tax
        // gives zero on Schedule 3 line 3 — while the refundable $1,000 still
        // reaches 1040 line 29, because that is what refundable means.
        aNonrefundableCreditExceedingTheTaxCreatesNoRefund: () => {
            const result = okResult(compute(baseInput({ line18Cents: 0n })))
            assertEq(result.line19, 0n, 'no tax, so no nonrefundable credit')
            assertEq(result.line8, 100000n, 'the refundable half is unaffected')
        },
    },

    // ── §25A(g)(6): the separate return ───────────────────────────────────
    marriedFilingSeparately: {
        // A determinate ZERO at any income, not a refusal — the identical
        // treatment `fjs/schedule/1`'s student loan worksheet gives §221(e)(2).
        everyLineIsZeroAtAnyIncome: () => {
            const result = okResult(compute(baseInput({
                status: 'marriedFilingSeparately',
                agiCents: 1000n,     // $10.00 -- as far below the phase-out as possible
            })))
            assertEq(result.line1, 0n)
            assertEq(result.line8, 0n, 'nothing reaches 1040 line 29')
            assertEq(result.line19, 0n, 'nothing reaches Schedule 3 line 3')
            assertEq(result.students.length, 1, 'the student is still named, with blank lines')
            assertEq(result.students[0]?.line27, 0n)
        },
        // The CONTROL: the SAME return on any other status computes. A
        // short-circuit written against something other than the status
        // would fail this.
        theSameReturnAsASingleFilerComputes: () => {
            const result = okResult(compute(baseInput({ agiCents: 1000n })))
            assert(result.line19 > 0n, ['expected a real credit', result.line19])
        },
    },

    // ── The refusals ──────────────────────────────────────────────────────
    refusals: {
        // §25A(i)'s under-24 rule. The message must name the provision and
        // BOTH of the facts this engine cannot obtain, because a reader told
        // only "cannot compute" cannot tell a gap from an incompleteness.
        anUnderTwentyFourFilerIsRefusedNamingTheProvision: () => {
            const result = refusal(compute(baseInput({ filerAttainedAgeTwentyFour: false })))
            assert(result.message.includes('§25A(i)'), ['must name the provision', result.message])
            assert(result.message.includes('line 8'), ['must name the printed line', result.message])
            assert(
                result.message.includes('half their own support')
                    || result.message.includes('fraction of'),
                ['must name the support test it cannot evaluate', result.message],
            )
            assert(
                result.message.includes('parent was alive'),
                ['must name the parent test it cannot evaluate', result.message],
            )
        },
        // …but ONLY when it would change something. A return whose American
        // Opportunity Credit is zero — here, a Lifetime Learning student —
        // never has line 8 to compute, and is never asked the filer's age.
        aLifetimeLearningOnlyReturnIsNeverAskedTheFilersAge: () => {
            const outcome = compute(baseInput({
                filerAttainedAgeTwentyFour: false,
                students: [student({ credit: 'lifetimeLearning', institutionalExpenseCents: 600000n })],
            }))
            const result = okResult(outcome)
            assertEq(result.line19, 120000n, 'and it computes the full $1,200.00')
        },
        // A 1098-T prior-year adjustment. The message must name the
        // recapture and the kind that refuses it, because that is the half a
        // reader can act on.
        aPriorYearAdjustmentIsRefusedNamingTheRecapture: () => {
            const result = refusal(compute(baseInput({
                students: [student({
                    institutionalExpenseCents: 900000n,
                    aStoredFormCarriesAPriorYearAdjustment: true,
                })],
            })))
            assert(result.message.includes('box 4'), ['must name the box', result.message])
            assert(
                result.message.includes('educationCreditRecapture'),
                ['must name the kind that already refuses this', result.message],
            )
            assert(result.message.includes('A. Student'), ['must name the student', result.message])
        },
        // …and it fires on a SEPARATE return too, which is the ordering
        // decision this module's docstring calls out. §25A(g)(6) denies this
        // year's credit; it does not repeal a prior year's recapture, and
        // short-circuiting first would have made the refusal vanish for
        // exactly one filing status.
        aPriorYearAdjustmentIsRefusedEvenOnASeparateReturn: () => {
            const result = refusal(compute(baseInput({
                status: 'marriedFilingSeparately',
                students: [student({ aStoredFormCarriesAPriorYearAdjustment: true })],
            })))
            assert(result.message.includes('prior year'), ['must still refuse', result.message])
        },
        anInsuranceReimbursementIsRefusedNamingBoxTen: () => {
            const result = refusal(compute(baseInput({
                students: [student({
                    institutionalExpenseCents: 900000n,
                    aStoredFormCarriesAnInsuranceReimbursement: true,
                })],
            })))
            assert(result.message.includes('box 10'), ['must name the box', result.message])
            assert(result.message.includes('Pub. 970'), ['must name the rules it cannot apply', result.message])
        },
        // An election contradicted by Part III's own facts. Each of the four
        // is asserted on its own, so a gate that checked three of them would
        // be caught — the printed page has four questions and a filter that
        // dropped one would still refuse the other three.
        eachOfTheFourPartThreeFactsRefusesAnAmericanOpportunityElection: () => {
            /** @type {readonly (readonly [Partial<Form8863Student>, string])[]} */
            const cases = [
                [{ americanOpportunityClaimedForFourPriorYears: true }, 'line 23'],
                [{ enrolledAtLeastHalfTimeInADegreeProgram: false }, 'line 24'],
                [{ completedFirstFourYearsOfPostsecondaryEducation: true }, 'line 25'],
                [{ convictedOfAFelonyDrugOffense: true }, 'line 26'],
            ]
            assertEq(cases.length, 4, 'Form 8863 Part III lines 23 through 26, hand-counted')
            for (const [overrides, printedLine] of cases) {
                const result = refusal(compute(baseInput({
                    students: [student({ institutionalExpenseCents: 900000n, ...overrides })],
                })))
                assert(
                    result.message.includes(printedLine),
                    ['the refusal must name the printed question that failed', printedLine, result.message],
                )
                assert(
                    result.message.includes('§25A(b)(2)'),
                    ['must name the provision', result.message],
                )
            }
        },
        // The CONTROL for the four above: the SAME student with all four
        // answered favourably computes. A gate that refused every American
        // Opportunity election would pass all four leaves above.
        aFullyQualifiedStudentIsNotRefused: () => {
            assertEq(compute(baseInput({})).kind, 'ok')
        },
        // …and a DISQUALIFIED student with no adjusted expenses is not
        // refused either, because the answer could not change anything. This
        // is what keeps the gate from firing on a student whose scholarships
        // covered everything.
        aDisqualifiedStudentWithNoExpensesIsNotRefused: () => {
            const outcome = compute(baseInput({
                students: [student({
                    institutionalExpenseCents: 200000n,
                    scholarshipsCents: 200000n,
                    enrolledAtLeastHalfTimeInADegreeProgram: false,
                })],
            }))
            assertEq(outcome.kind, 'ok', 'no expenses, so nothing the election could change')
        },
    },

    // The named income function equals bare adjusted gross income today, and
    // line 3 equals it on every fixture — documented, not silently assumed
    // (the equivalent leaf `fjs/form8812` writes for its own measure).
    linkedIncomeFunction: {
        lineThreeEqualsTheNamedFunctionForEveryFixture: () => {
            for (const agi of [0n, 4000000n, 8000000n, 8500000n, 8999999n]) {
                const result = okResult(compute(baseInput({ agiCents: agi })))
                assertEq(result.line3, educationCreditPhaseoutIncome(agi)(0n))
            }
        },
        theNamedFunctionEqualsBareAdjustedGrossIncomeWithNoExclusion: () => {
            assertEq(educationCreditPhaseoutIncome(0n)(0n), 0n)
            assertEq(educationCreditPhaseoutIncome(12345600n)(0n), 12345600n)
        },
        // **TAX-42: §911's exclusion is a LIVE add-back**, and it can cost the
        // whole credit. i8863's line 3 instruction is the modified AGI a
        // §911 filer must add their exclusion back into; a single filer at
        // $40,000.00 of adjusted gross income is far below the $80,000.00
        // phase-out floor, and the same filer with a $130,000.00 exclusion is
        // above the $90,000.00 ceiling and takes NOTHING.
        theExclusionAddsBackAndCanCostTheWholeCredit: () => {
            // $40,000.00 of adjusted gross income is far below the $80,000.00
            // phase-out floor; adding back a $130,000.00 exclusion puts
            // modified AGI at $170,000.00, past the $90,000.00 ceiling, and
            // line 4's printed STOP takes the whole credit.
            //
            // The printed stop returns the all-zero form, so `line3` reads
            // $0.00 rather than $170,000.00 — that is `allZero`'s shape and
            // not a missing add-back, which is why this leaf asserts the
            // OUTCOME and the leaf below asserts the arithmetic on a fixture
            // that survives the stop.
            const withExclusion = okResult(compute(baseInput({
                form2555ExclusionCents: 13000000n,
            })))
            assertEq(withExclusion.line19, 0n, 'the credit is gone entirely')
        },
        // The same add-back where it REDUCES rather than kills: a $45,000.00
        // exclusion puts modified AGI at $85,000.00, halfway through the
        // $80,000-$90,000 phase-out range, so line 3 is visible and the credit
        // survives at less than the control's.
        theExclusionAddsBackInsideThePhaseOutRange: () => {
            const withExclusion = okResult(compute(baseInput({
                form2555ExclusionCents: 4500000n,
            })))
            assertEq(
                withExclusion.line3, 8500000n,
                '$40,000.00 + $45,000.00 = $85,000.00 of modified AGI')
            const without = okResult(compute(baseInput({})))
            assert(
                withExclusion.line19 > 0n && withExclusion.line19 < without.line19,
                ['the add-back must reduce the credit without erasing it',
                    withExclusion.line19, without.line19])
        },
        // THE CONTROL: the identical fixture without the exclusion takes a
        // real credit, so the leaf above measures the add-back rather than
        // some other refusal.
        controlTheSameFilerWithNoExclusionTakesTheCredit: () => {
            const without = okResult(compute(baseInput({})))
            assertEq(without.line3, 4000000n, 'bare adjusted gross income')
            assert(without.line19 > 0n, ['the control must take a credit', without.line19])
        },
    },

    // Every printed line is named. Hand-typed counts, so a line silently
    // dropped from any of the three returned records is caught.
    everyPrintedLineIsNamed: () => {
        const result = okResult(compute(baseInput({})))
        assertEq(
            Object.keys(result).length,
            22,
            'kind, students, printed lines 1-19 (lines 6 and 17 as thousandths), the worksheet',
        )
        const s = result.students[0]
        assert(s !== undefined, ['expected one student', result.students])
        assertEq(Object.keys(s ?? {}).length, 7, 'the name and election plus printed lines 27-31')
        assertEq(Object.keys(result.creditLimitWorksheet).length, 7, 'the worksheet has seven lines')
    },
}
