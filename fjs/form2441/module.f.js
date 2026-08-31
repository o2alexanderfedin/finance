/**
 * Form 2441 — the Credit for Child and Dependent Care Expenses, and the
 * taxable dependent care benefits that reach 1040 line 1e. TAX-38.
 *
 * Sources, fetched and read directly rather than recalled (2026-08-18) — see
 * `fjs/form2441/todo/child-and-dependent-care-expenses.md` for the full
 * argument behind every decision this module encodes:
 * `https://www.irs.gov/pub/irs-pdf/f2441.pdf` (Form 2441 (2025), Cat. No.
 * 11862M, "Created 3/18/25") and `https://www.irs.gov/pub/irs-pdf/i2441.pdf`
 * (its instructions, Catalog Number 10842K, "Jul 22, 2025").
 *
 * ## The credit is NOT refundable for 2025, and the form says so twice
 *
 * f2441 line 11: *"Credit for child and dependent care expenses. Enter the
 * smaller of line 9c or line 10 here and on **Schedule 3 (Form 1040), line
 * 2**"* — and Schedule 3 line 2 sits in **Part I, Nonrefundable Credits**,
 * totalling at line 8 into 1040 line 20. The refundability ARPA gave this
 * credit was for tax year 2021 alone; the 2021 form's Part II line 10 is
 * gone, and its slot now holds *"Tax liability limit"*, a ceiling only a
 * nonrefundable credit has.
 *
 * ## TWO functions, because 1040 line 1e is INSIDE this form's own line 7
 *
 * f2441 line 26 lands on 1040 line 1e, which is inside line 1z, inside line 9,
 * inside line 11a. And f2441 line 7 reads *"the amount from Form 1040 ... line
 * 11a"* — the adjusted gross income. Worse, line 10's Credit Limit Worksheet
 * (i2441 p5) reads 1040 line 18, which needs the tax, which needs that AGI.
 *
 * The chain is one-directional, never circular, but it cannot be one call:
 *
 * ```
 * form2441DependentCareBenefits -> line 26 -> 1040 line 1e -> 1z -> 9 -> 11a
 *                               -> line 31                              |
 *                                                 1040 lines 16, 17, 18 <+
 *                                                                       |
 *          Schedule 3 line 1 (foreign tax credit) --------------------->|
 *                                                                       v
 *      form2441Credit(line 3, AGI, tax liability limit) -> line 11 -> Sch 3 line 2
 * ```
 *
 * Running one function twice — once against a guessed AGI — is what
 * `fjs/schedule/se`'s own outcome docstring already forbids: a second
 * execution that can disagree with the first about the return it is pricing.
 *
 * **Lines 27-31 belong to the FIRST function**, even though line 31 feeds Part
 * II's line 3, because they read lines 24 and 25 and nothing else.
 *
 * ## Lines 27-31 with no benefits reproduce line 3's own cap, exactly
 *
 * The printed line 3 caps the column (d) total at $3,000/$6,000 *"If you
 * completed Part III, enter the amount from line 31"*, implying a filer with
 * no benefits skips Part III. **The two are the same arithmetic**: with lines
 * 12 and 13 zero, line 24 = line 25 = 0, so line 28 = 0, line 29 = the cap,
 * line 30 = the expense total, and line 31 = min(cap, expenses) — which is
 * line 3's cap, applied. So lines 27-31 run unconditionally and there is no
 * second cap expression anywhere in this module. Proven by
 * {@link proof.theTwoCaps}, rather than left to be rediscovered.
 *
 * ## The earned income asymmetry between the two parts, which is printed
 *
 * i2441 p4, lines 4 and 5: earned income is 1040 line 1z (less the §911
 * exclusion and clergy amounts) plus Schedule SE line 3 less the Schedule 1
 * line 15 deduction. i2441 p5, line 18, repeats it and adds one clause:
 * *"however, for purposes of lines 18 and 19, earned income doesn't include
 * any dependent care benefits shown on line 12."*
 *
 * So Part III's earned income EXCLUDES the taxable benefits and Part II's
 * INCLUDES them — the two figures differ by exactly line 26. That asymmetry
 * is what breaks the apparent circularity: Part III's line 18 does not depend
 * on Part III's own answer. It is also the single easiest thing to get wrong
 * here, so the two are separate named inputs rather than one shared field.
 *
 * ## What this module refuses, and why each refusal is the designed outcome
 *
 * Eight conditions, each transcribed beside the printed sentence that
 * requires it. The three a reader will assume away:
 *
 * - **Married filing JOINTLY.** Lines 5 and 19 want the SPOUSE's earned
 *   income separately, and nothing in this engine attributes an earned dollar
 *   to one spouse rather than the other. Handing the couple's combined figure
 *   to line 5 would grant the full credit to every couple with a non-working
 *   spouse — precisely the population §21(d)'s limitation exists for.
 * - **A student or disabled filer whose earned-income limitation BINDS.**
 *   §21(d)(2) deems $250 ($500 with two or more qualifying persons) of earned
 *   income for each month, and no document here carries per-month student or
 *   disability status. The deemed amount is a FLOOR, so where the limitation
 *   does not bind it provably cannot move any printed line and the return
 *   computes — which is why the refusal is conditional rather than blanket.
 * - **A line 2 person in neither §21(b)(1) population.** i2441's line 2
 *   CAUTION and its column (c) paragraph together forbid an over-12,
 *   non-disabled person from appearing on line 2 at all, which is what makes
 *   an unchecked column (c) on the PAPER unambiguous — it can only be a child
 *   under 13. `vnd.fjs.credits` is not a transcribed IRS form, so nothing
 *   before this module has applied that caution and the record's silence
 *   carries "nobody asked" alongside "under 13". Absence therefore GRANTED a
 *   qualifying person, which is the direction that decides the shape.
 *
 * ## What this module does NOT refuse for, and the printed reason
 *
 * The §129 exclusion is **not** touched by the qualifying person count, so
 * that count going wrong could never have inflated it independently of the
 * credit. The caption f2441 prints between lines 26 and 27 is the whole
 * argument: *"To claim the child and dependent care credit, complete lines 27
 * through 31 below."* Line 26 — the taxable benefits that reach 1040 line 1e —
 * is built from lines 20 through 25, whose only ceiling is line 21's flat
 * $5,000/$2,500. The count first appears at line 27, on the credit's side of
 * that caption, and reaches Part II through line 31 -> line 3. R6 refuses in
 * BOTH parts anyway, for {@link destination}'s own stated reason.
 *
 * @module
 */
import { assert, assertEq, assertNotNullish } from 'functionalscript/fjs/asserts/module.f.mjs'
import { centsFromString, centsToString } from '../exact/module.f.js'
import { of, halfUp } from '../types/rational/module.f.js'
import { taxParamsByYear } from '../tax/params/module.f.js'

/** @import { IndividualFilingStatus, TaxParamSet } from '../tax/params/module.f.js' */

/**
 * A case this module will not compute. One string, naming the printed rule,
 * the figure at issue, and WHERE the amount would have gone — the last of
 * those because a refusal a reader cannot act on is a refusal that teaches
 * nothing (AGENTS.md, on the erased `${destination}` interpolation).
 * @typedef {{ readonly kind: 'error', readonly message: string }} Form2441Refusal
 */

/**
 * Where BOTH of this form's answers end up, quoted in every refusal so the
 * message says what was lost as well as why. One string for both parts,
 * because a refusal in either stops the whole return: an engine that could
 * not settle Part III has no 1040 line 1e and therefore no adjusted gross
 * income to price Part II against.
 * @type {string}
 */
const destination = '1040 line 1e (the taxable dependent care benefits, Form 2441 line 26) '
    + 'and Schedule 3 line 2 (the credit, Form 2441 line 11 -> 1040 line 20)'

/**
 * The facts BOTH parts read, so the six shared refusals are written once and
 * cannot drift between the two entry points (AGENTS.md, "one rule, one
 * place").
 *
 * `selfEmploymentEarningsPresent` is a fact about the RETURN rather than about
 * Form 2441: see {@link sharedRefusal} for why a return carrying it refuses.
 *
 * `qualifyingPersonsWithNoAgeAssertion` names — rather than counts — the
 * people whose §21(b)(1) population the stored record never stated, because
 * R6's refusal has to say WHICH row of line 2 to go and fix. A count would be
 * a message a reader cannot act on, which is the defect AGENTS.md records the
 * erased `${destination}` interpolation as.
 * @typedef {{
 *   readonly status: IndividualFilingStatus,
 *   readonly qualifyingPersonCount: number,
 *   readonly qualifyingPersonsWithNoAgeAssertion: readonly string[],
 *   readonly careProviderCount: number,
 *   readonly qualifiedExpensesIncurredAndPaidCents: bigint,
 *   readonly filerWasNeitherAStudentNorDisabled: boolean,
 *   readonly priorYearExpensesPaidThisYearCents: bigint,
 *   readonly selfEmploymentEarningsPresent: boolean,
 * }} Form2441Common
 */

/**
 * Everything Form 2441 Part III reads, on top of {@link Form2441Common}.
 *
 * `earnedIncomeExcludingBenefitsCents` is line 18 and is NOT Part II's line 4
 * — see this module's docstring, "The earned income asymmetry".
 *
 * `planMaximumExclusionCents` is `undefined` — never a large sentinel — when
 * the taxpayer's plan sets no maximum below §129's, because line 21's printed
 * instruction is to enter the statutory figure and only then reduce it. A
 * sentinel would read as a cap and would become one at the first `min`.
 * @typedef {Form2441Common & {
 *   readonly dependentCareBenefitsCents: bigint,
 *   readonly graceCarryoverCents: bigint,
 *   readonly forfeitedOrCarriedForwardCents: bigint,
 *   readonly qualifiedExpensesIncurredCents: bigint,
 *   readonly earnedIncomeExcludingBenefitsCents: bigint,
 *   readonly planMaximumExclusionCents: bigint | undefined,
 *   readonly soleProprietorshipOrPartnershipBenefitsCents: bigint,
 * }} Form2441BenefitsInput
 */

/**
 * Form 2441 lines 12 through 31 — Part III and the four lines that carry its
 * answer back into Part II.
 *
 * `line26TaxableBenefitsCents` goes to **1040 line 1e**; `line31Cents` goes to
 * **this form's own line 3**.
 * @typedef {{
 *   readonly kind: 'ok',
 *   readonly line12BenefitsReceivedCents: bigint,
 *   readonly line13GraceCarryoverCents: bigint,
 *   readonly line14ForfeitedOrCarriedForwardCents: bigint,
 *   readonly line15CombinedBenefitsCents: bigint,
 *   readonly line16QualifiedExpensesIncurredCents: bigint,
 *   readonly line17Cents: bigint,
 *   readonly line18EarnedIncomeCents: bigint,
 *   readonly line19SpouseEarnedIncomeCents: bigint,
 *   readonly line20Cents: bigint,
 *   readonly line21ExclusionLimitCents: bigint,
 *   readonly line22SoleProprietorshipOrPartnershipCents: bigint,
 *   readonly line23Cents: bigint,
 *   readonly line24DeductibleBenefitsCents: bigint,
 *   readonly line25ExcludedBenefitsCents: bigint,
 *   readonly line26TaxableBenefitsCents: bigint,
 *   readonly line27ExpenseLimitCents: bigint,
 *   readonly line28ExcludedOrDeductedCents: bigint,
 *   readonly line29Cents: bigint,
 *   readonly line30Cents: bigint,
 *   readonly line31Cents: bigint,
 * }} Form2441BenefitsResult
 */

/** @typedef {Form2441BenefitsResult | Form2441Refusal} Form2441BenefitsOutcome */

/**
 * Everything Form 2441 Part II reads, on top of {@link Form2441Common}.
 *
 * `line3Cents` is {@link Form2441BenefitsResult}'s `line31Cents`, handed in
 * rather than recomputed, so the §21(c) cap and the §129 exclusion are applied
 * in ONE place and a second execution cannot disagree with the first.
 *
 * `taxLiabilityLimitCents` is line 10, the i2441 p5 Credit Limit Worksheet's
 * own result: 1040 line 18 less Schedule 3 line 1 and line 6l. Computed by the
 * caller, where those lines are, exactly as `adjustedGrossIncomeCents` is.
 * @typedef {Form2441Common & {
 *   readonly line3Cents: bigint,
 *   readonly earnedIncomeCents: bigint,
 *   readonly adjustedGrossIncomeCents: bigint,
 *   readonly taxLiabilityLimitCents: bigint,
 * }} Form2441CreditInput
 */

/**
 * Form 2441 lines 3 through 11. `line11CreditCents` goes to **Schedule 3 line
 * 2 -> 1040 line 20**.
 * @typedef {{
 *   readonly kind: 'ok',
 *   readonly line3Cents: bigint,
 *   readonly line4EarnedIncomeCents: bigint,
 *   readonly line5SpouseEarnedIncomeCents: bigint,
 *   readonly line6Cents: bigint,
 *   readonly line7AdjustedGrossIncomeCents: bigint,
 *   readonly line8Percent: number,
 *   readonly line9aCents: bigint,
 *   readonly line9bPriorYearExpenseCreditCents: bigint,
 *   readonly line9cCents: bigint,
 *   readonly line10TaxLiabilityLimitCents: bigint,
 *   readonly line11CreditCents: bigint,
 * }} Form2441CreditResult
 */

/** @typedef {Form2441CreditResult | Form2441Refusal} Form2441CreditOutcome */

/** @type {(a: bigint) => (b: bigint) => bigint} */
const min = a => b => a < b ? a : b

/** Floors an amount at zero — every printed *"If zero or less, enter -0-"*.
 * @type {(cents: bigint) => bigint} */
const atLeastZero = cents => cents > 0n ? cents : 0n

/**
 * §21(c)'s cap on the expenses the credit may be figured on — Form 2441's
 * lines 3 and 27, which print the identical pair.
 *
 * **Three qualifying persons is $6,000, not $9,000.** §21(c) reads *"$3,000 if
 * there is 1 qualifying individual ... $6,000 if there are 2 or more"* and
 * stops, so this is a two-way branch and never a per-person multiplier.
 *
 * **Zero qualifying persons is $0**, which the printed page never states
 * because a filer with none cannot take the credit at all. The consequence is
 * exactly right and worth following through: line 29 becomes `0 - line 28`,
 * which trips its own *"If zero or less, stop. You can't take the credit"*,
 * and line 31 carries a zero into line 3. That is the return i2441 p2
 * contemplates under line 1 — *"If you had neither a qualifying person nor any
 * care providers for 2025, and you are filing Form 2441 only to report taxable
 * income in Part III"* — and it must still produce a taxable line 26.
 * @type {(taxParamSet: TaxParamSet) => (qualifyingPersonCount: number) => bigint}
 */
export const dependentCareExpenseLimitCents = taxParamSet => qualifyingPersonCount => {
    const limit = taxParamSet.dependentCareExpenseLimit
    if (qualifyingPersonCount <= 0) {
        return 0n
    }
    return centsFromString(qualifyingPersonCount === 1
        ? limit.oneQualifyingPerson.amount
        : limit.twoOrMoreQualifyingPersons.amount)
}

/**
 * Form 2441 line 8 — §21(a)(2)'s applicable percentage, in WHOLE percentage
 * points (so `35` is the printed `.35`).
 *
 * The printed columns are *"Over"* and *"But not over"*, so the comparison is
 * `<=` against the stored ceiling: exactly $15,000 of adjusted gross income
 * takes 35% and $15,000.01 takes 34%. Reading that boundary the other way
 * moves a filer at a round income one percentage point, worth $60 on the
 * $6,000 cap.
 *
 * The last stored band has NO ceiling (*"43,000 — No limit"*), so the `find`
 * below always matches and the assert is a statement about the table rather
 * than a branch a caller can reach.
 * @type {(taxParamSet: TaxParamSet) => (adjustedGrossIncomeCents: bigint) => number}
 */
export const dependentCareCreditPercent = taxParamSet => adjustedGrossIncomeCents => {
    const band = taxParamSet.dependentCareCreditPercentage.bands.find(
        candidate => candidate.adjustedGrossIncomeCeiling === undefined
            || adjustedGrossIncomeCents <= centsFromString(candidate.adjustedGrossIncomeCeiling))
    assert( band !== undefined,
        ['Form 2441 line 8’s last printed row is open-topped', adjustedGrossIncomeCents])
    return band.percent
}

/**
 * Form 2441 line 21 — the §129(a)(2)(A) exclusion ceiling, reduced to the
 * taxpayer's own plan maximum where their plan sets a lower one.
 *
 * The married-filing-separately column is stored and transcribed but is
 * UNREACHABLE through {@link form2441DependentCareBenefits}, which refuses
 * every such return: line 21's own printed condition is *"$2,500 if married
 * filing separately **and you were required to enter your spouse's earned
 * income on line 19**"*, and whether that was required turns on Form 2441 line
 * A's three unstated facts. Exported and proven directly for that reason —
 * an unreachable branch nobody exercises is an unproven branch.
 * @type {(taxParamSet: TaxParamSet) => (status: IndividualFilingStatus) => (planMaximumCents: bigint | undefined) => bigint}
 */
export const dependentCareExclusionLimitCents = taxParamSet => status => planMaximumCents => {
    const limit = taxParamSet.dependentCareAssistanceExclusionLimit
    const statutory = centsFromString(status === 'marriedFilingSeparately'
        ? limit.marriedFilingSeparately.amount
        : limit.standard.amount)
    return planMaximumCents === undefined ? statutory : min(statutory)(planMaximumCents)
}

/**
 * The six refusals BOTH parts make, in printed order, or `undefined` when
 * none applies.
 *
 * Written once and called from both entry points, so an engine that refused a
 * married-filing-separately return's credit while happily excluding its
 * benefits is not a state this module can be in.
 * @type {(taxParamSet: TaxParamSet) => (input: Form2441Common) => Form2441Refusal | undefined}
 */
const sharedRefusal = taxParamSet => input => {
    const {
        status, careProviderCount, qualifiedExpensesIncurredAndPaidCents,
        priorYearExpensesPaidThisYearCents, selfEmploymentEarningsPresent,
        qualifyingPersonsWithNoAgeAssertion,
    } = input
    // R1 — a joint return needs TWO earned incomes and this engine holds one.
    // f2441 line 5: "If married filing jointly, enter your spouse's earned
    // income"; line 6 then takes the SMALLEST of lines 3, 4 and 5. i2441 p4
    // defines each as 1040 line 1z plus Schedule SE line 3 less the Schedule 1
    // line 15 deduction — every term of which this engine computes for the
    // RETURN and none of which it attributes to a person.
    if (status === 'marriedFilingJointly') {
        return {
            kind: 'error',
            message: 'Form 2441 line 5: this return files married filing jointly, and line 5 '
                + 'wants the SPOUSE’s earned income on its own so that line 6 can take the '
                + 'smallest of lines 3, 4 and 5. Nothing in this engine attributes an earned '
                + 'dollar to one spouse rather than the other: 1040 line 1z aggregates every '
                + 'stored Form W-2 without a per-person total, and Schedule SE is computed for '
                + 'the return rather than for a person. Treating the couple’s combined '
                + 'earned income as each spouse’s would grant the whole credit to every '
                + 'couple with a non-working spouse — which is exactly the population '
                + '§21(d)’s limitation exists for. Refusing. The unlock is per-spouse '
                + 'earned income: vnd.fjs.w2’s employeeSSN (box a) against the return '
                + 'profile’s filerSocialSecurityNumber and spouseSocialSecurityNumber '
                + `covers the wage half, and Schedule SE attribution is the rest. Nothing reaches ${destination}`,
        }
    }
    // R2 — f2441 line A. i2441 p3 lists three facts that let a married filing
    // separately filer be "considered unmarried": lived apart for the last six
    // months, the home was the qualifying person's main home for more than half
    // the year, and paid more than half the cost of keeping it up. None is on
    // any document here, and the answer decides line 19's branch and line 21's
    // $5,000-or-$2,500 as well as the credit itself.
    if (status === 'marriedFilingSeparately') {
        return {
            kind: 'error',
            message: 'Form 2441 line A: this return files married filing separately, and such a '
                + 'filer may take the credit only by certifying the three facts i2441 lists '
                + 'under Married Persons Filing Separately — lived apart from the spouse '
                + 'for the last 6 months of the year, the home was the qualifying '
                + 'person’s main home for more than half the year, and paid more than half '
                + 'the cost of keeping up that home. No document this engine holds states any of '
                + 'them, and the same answer decides line 19 (whose earned income) and line 21 '
                + `($5,000 or $2,500). Refusing rather than guessing. Nothing reaches ${destination}`,
        }
    }
    // R3 — earned income for lines 4/5 and 18/19 includes Schedule SE line 3
    // less the Schedule 1 line 15 deduction (i2441 p4, item 2). This engine
    // computes Schedule SE inside Schedule 1 stage one, which runs AFTER 1040
    // line 1z — and 1040 line 1e, this form's own Part III answer, is a term
    // of line 1z. Treating the self-employment half as zero would understate
    // earned income, which raises taxable benefits and shrinks the credit.
    // Wrong in the safe direction is still wrong.
    if (selfEmploymentEarningsPresent) {
        return {
            kind: 'error',
            message: 'Form 2441 lines 4 and 18: this return carries self-employment earnings, '
                + 'and i2441 defines earned income as 1040 line 1z PLUS Schedule SE line 3 less '
                + 'the Schedule 1 line 15 deduction. This engine computes Schedule SE inside '
                + 'Schedule 1 stage one, which runs after 1040 line 1z — and 1040 line 1e, '
                + 'which is Form 2441 line 26, is itself a term of line 1z. Reading the '
                + 'self-employment half as zero would understate earned income, which raises the '
                + 'taxable benefits on line 26 and shrinks the credit on line 6. Refusing rather '
                + 'than computing a figure that is wrong in the taxpayer’s disfavour. The '
                + 'unlock is to compute Schedule SE above the 1040 line 1 block, which nothing '
                + `in Schedule SE prevents. Nothing reaches ${destination}`,
        }
    }
    // R4 — f2441 line 9b and i2441 p4's Worksheet A. Five 2024 figures are
    // needed (that year's Form 2441 lines 3 and 6, its adjusted gross income
    // and both earned incomes) and no stored document carries a prior year's
    // Form 2441 at all.
    if (priorYearExpensesPaidThisYearCents > 0n) {
        return {
            kind: 'error',
            message: `Form 2441 line 9b: this return reports `
                + `${centsToString(priorYearExpensesPaidThisYearCents)} of 2024 expenses paid in `
                + `2025, which i2441 sends to Worksheet A. That worksheet reads five figures off `
                + `the 2024 return — Form 2441 lines 3 and 6, the 2024 adjusted gross `
                + `income, and both 2024 earned incomes — and no document this engine holds `
                + `carries a prior year’s Form 2441. Refusing rather than dropping the `
                + `amount, which would understate the credit by up to 35% of it. Nothing reaches `
                + `${destination}`,
        }
    }
    // R5 — f2441 line 1: "Persons or Organizations Who Provided the Care --
    // You must complete this part", and i2441 p2's Due Diligence: without the
    // provider information "your credit (and exclusion, if applicable) may be
    // disallowed". Gated on EXPENSES rather than on the credit, because a
    // return reporting benefits and no expenses legitimately has no provider
    // (i2441 p2 says to enter "none" on line 1 column (a)).
    if (qualifiedExpensesIncurredAndPaidCents > 0n && careProviderCount === 0) {
        return {
            kind: 'error',
            message: `Form 2441 line 1: this return reports `
                + `${centsToString(qualifiedExpensesIncurredAndPaidCents)} of qualified expenses `
                + `and records no care provider. The printed line says "You must complete this `
                + `part", and i2441’s Due Diligence paragraph warns that a credit claimed `
                + `without the provider’s name, address and identifying number may be `
                + `disallowed. Record them on vnd.fjs.credits’ dependentCareProviders. `
                + `Refusing rather than claiming a credit the return could not substantiate. `
                + `Nothing reaches ${destination}`,
        }
    }
    // R6 — f2441 line 2 column (c), and the §21(b)(1) population every listed
    // person has to be in. i2441 (2025), Column (c): "A person over age 12 at
    // the time the care was provided must be physically or mentally incapable
    // of caring for themselves to be listed on line 2", under a CAUTION
    // reading "Don't list a person on line 2 unless they are listed as an
    // eligible person under Qualifying Person(s), earlier."
    //
    // **Those two sentences settle the paper and NOT the record.** On a
    // correctly prepared Form 2441 an unchecked column (c) can only mean
    // "under age 13", because the over-12-and-not-disabled person is not
    // allowed onto line 2 at all. `vnd.fjs.credits` is not a transcribed IRS
    // form — its own header's first sentence — so nothing upstream of here has
    // applied that caution, and this engine is the preparer that must. Before
    // TAX-38's correction an entry with no age assertion was counted as
    // qualifying, which moved §21(c)'s cap from $3,000 to $6,000 on the second
    // such person and was worth up to $1,050 of credit the taxpayer would owe
    // back.
    //
    // Gated on the NAMES rather than on `qualifyingPersonCount`, because the
    // count cannot say which row to fix and because a return with no
    // qualifying persons at all — i2441 p2's Part-III-only filer — must still
    // compute a taxable line 26.
    if (qualifyingPersonsWithNoAgeAssertion.length !== 0) {
        return {
            kind: 'error',
            message: `Form 2441 line 2 column (c): `
                + `${qualifyingPersonsWithNoAgeAssertion.join(', ')} `
                + `${qualifyingPersonsWithNoAgeAssertion.length === 1 ? 'is' : 'are'} listed as a `
                + `qualifying person with neither age assertion. §21(b)(1) admits exactly two `
                + `populations and i2441 keeps them apart in one sentence — "A person over age 12 `
                + `at the time the care was provided must be physically or mentally incapable of `
                + `caring for themselves to be listed on line 2" — so a listed person is either `
                + `under age 13 when the care was provided or over age 12 and disabled, and this `
                + `record says neither. Set underAgeThirteenWhenTheCareWasProvided or `
                + `overAgeTwelveAndDisabled on that vnd.fjs.credits entry. Refusing rather than `
                + `assuming the qualifying one: a person wrongly counted raises §21(c)'s expense `
                + `cap from `
                + `${centsToString(dependentCareExpenseLimitCents(taxParamSet)(1))} to `
                + `${centsToString(dependentCareExpenseLimitCents(taxParamSet)(2))} and inflates `
                + `a credit the taxpayer would owe back. Nothing reaches ${destination}`,
        }
    }
    // Present only so the deemed-income refusals below can quote the two
    // figures a reader has to compare themselves against. Read from the
    // parameter set rather than written out here, so a year that moves them
    // moves the message too.
    assertNotNullish(
        taxParamSet.dependentCareDeemedEarnedIncomePerMonth,
        'the §21(d)(2) deemed monthly amounts are part of every parameter set')
    return undefined
}

/**
 * The §21(d)(2) refusal, shaped so the two parts can ask it about their own
 * pair of lines.
 *
 * **Conditional on the limitation actually BINDING**, which is the whole
 * design. i2441 p4: *"use the higher of $250 (or $500) or their actual earned
 * income for that month"* — the deemed amount is a FLOOR, so it can only raise
 * the earned income line. Where earned income is already at or above the
 * figure it is being compared with, raising it cannot move any printed line,
 * and the return computes whether or not the taxpayer certified anything.
 * @type {(taxParamSet: TaxParamSet) => (input: Form2441Common) => (lines: {
 *   readonly earnedIncomeCents: bigint,
 *   readonly comparedWithCents: bigint,
 *   readonly earnedIncomeLine: string,
 *   readonly comparedWithLine: string,
 * }) => Form2441Refusal | undefined}
 */
const deemedEarnedIncomeRefusal = taxParamSet => input => lines => {
    const { earnedIncomeCents, comparedWithCents, earnedIncomeLine, comparedWithLine } = lines
    if (
        input.filerWasNeitherAStudentNorDisabled
        || comparedWithCents <= 0n
        || earnedIncomeCents >= comparedWithCents
    ) {
        return undefined
    }
    const deemed = taxParamSet.dependentCareDeemedEarnedIncomePerMonth
    const monthly = input.qualifyingPersonCount >= 2
        ? deemed.twoOrMoreQualifyingPersons.amount
        : deemed.oneQualifyingPerson.amount
    return {
        kind: 'error',
        message: `Form 2441 ${earnedIncomeLine}: earned income of `
            + `${centsToString(earnedIncomeCents)} is below ${comparedWithLine}’s `
            + `${centsToString(comparedWithCents)}, so the §21(d) earned-income limitation `
            + `BINDS and decides how much of this form is allowed. §21(d)(2) deems a filer `
            + `who was a full-time student or was incapable of self-care to have earned at least `
            + `${centsToString(centsFromString(monthly))} for each month or part of a month they `
            + `were — Form 2441 line B’s own checkbox — and no document this `
            + `engine holds records per-month student or disability status. Declare `
            + `dependentCareFilerWasNeitherAStudentNorDisabled on vnd.fjs.credits to certify that `
            + `neither applied in any month, or the deemed income cannot be settled. Refusing `
            + `rather than assuming either way: the two answers differ by up to `
            + `${centsToString(centsFromString(monthly) * 12n)} of earned income. Nothing reaches `
            + `${destination}`,
    }
}

/**
 * Form 2441 Part III and lines 27-31 — the taxable dependent care benefits
 * that reach 1040 line 1e, and the expense figure Part II starts from.
 *
 * **Called for every return, not only for one holding benefits.** A return
 * with no benefits and no dependent care record produces zeros throughout and
 * a line 31 that is exactly the printed line 3 cap; see this module's own
 * docstring.
 * @type {(taxParamSet: TaxParamSet) => (input: Form2441BenefitsInput) => Form2441BenefitsOutcome}
 */
export const form2441DependentCareBenefits = taxParamSet => input => {
    const shared = sharedRefusal(taxParamSet)(input)
    if (shared !== undefined) {
        return shared
    }
    const {
        status, qualifyingPersonCount, qualifiedExpensesIncurredAndPaidCents,
        dependentCareBenefitsCents, graceCarryoverCents, forfeitedOrCarriedForwardCents,
        qualifiedExpensesIncurredCents, earnedIncomeExcludingBenefitsCents,
        planMaximumExclusionCents, soleProprietorshipOrPartnershipBenefitsCents,
    } = input
    // R6 — f2441 line 22 / line 24. i2441 p5, Line 24: "Include your
    // deductible benefits in the total entered on Schedule C (Form 1040), line
    // 14; Schedule E (Form 1040), line 19 or line 28; or Schedule F (Form
    // 1040), line 15". Computing line 24 while leaving those schedules
    // untouched would exclude the benefit from income WITHOUT ever deducting
    // it on the business return — the benefit taken twice.
    if (soleProprietorshipOrPartnershipBenefitsCents > 0n) {
        return {
            kind: 'error',
            message: `Form 2441 line 22: `
                + `${centsToString(soleProprietorshipOrPartnershipBenefitsCents)} of the reported `
                + `dependent care benefits came from a sole proprietorship or partnership, which `
                + `line 24 turns into DEDUCTIBLE rather than excluded benefits. i2441 sends that `
                + `deduction to Schedule C line 14, Schedule E line 19 or 28, or Schedule F line `
                + `15, and this engine computes none of those three lines from this form. `
                + `Excluding the amount here without deducting it there would take the same `
                + `benefit twice. Refusing. Nothing reaches ${destination}`,
        }
    }
    // Line 12 — "the total amount of dependent care benefits you received",
    // which for an employee is Form W-2 box 10, summed by the caller.
    const line12BenefitsReceivedCents = dependentCareBenefitsCents
    // Line 13 — carried over from 2024 and used during 2025's grace period.
    const line13GraceCarryoverCents = graceCarryoverCents
    // Line 14 — forfeited, or carried forward into 2026. Printed inside
    // parentheses on the form's own face because line 15 SUBTRACTS it.
    const line14ForfeitedOrCarriedForwardCents = forfeitedOrCarriedForwardCents
    // Line 15 — i2441 p5: "Add the amounts on lines 12 and 13 and subtract
    // from that total the amount on line 14."
    const line15CombinedBenefitsCents
        = line12BenefitsReceivedCents + line13GraceCarryoverCents
            - line14ForfeitedOrCarriedForwardCents
    // Line 16 — "the total of all qualified expenses incurred in 2025 ... It
    // doesn't matter when the expenses were paid." NOT line 2 column (d),
    // which is what was incurred AND PAID.
    const line16QualifiedExpensesIncurredCents = qualifiedExpensesIncurredCents
    const line17Cents = min(line15CombinedBenefitsCents)(line16QualifiedExpensesIncurredCents)
    // Lines 18 and 19. Line 19's printed instruction for a filer who is
    // neither joint nor separate is "All others, enter the amount from line
    // 18", and both other statuses have already refused above.
    const line18EarnedIncomeCents = earnedIncomeExcludingBenefitsCents
    const line19SpouseEarnedIncomeCents = line18EarnedIncomeCents
    const deemed = deemedEarnedIncomeRefusal(taxParamSet)(input)({
        earnedIncomeCents: line18EarnedIncomeCents,
        comparedWithCents: line17Cents,
        earnedIncomeLine: 'line 18',
        comparedWithLine: 'line 17',
    })
    if (deemed !== undefined) {
        return deemed
    }
    // Line 20 — "Enter the smallest of line 17, 18, or 19. If zero or less,
    // enter -0-."
    const line20Cents = atLeastZero(
        min(min(line17Cents)(line18EarnedIncomeCents))(line19SpouseEarnedIncomeCents))
    const line21ExclusionLimitCents
        = dependentCareExclusionLimitCents(taxParamSet)(status)(planMaximumExclusionCents)
    // Line 22 is a structural zero here: any non-zero amount refused above.
    const line22SoleProprietorshipOrPartnershipCents = soleProprietorshipOrPartnershipBenefitsCents
    const line23Cents = line15CombinedBenefitsCents - line22SoleProprietorshipOrPartnershipCents
    // Line 24 — "Deductible benefits. Enter the smallest of line 20, 21, or
    // 22." Written as the printed three-way minimum rather than as the `0n`
    // line 22 forces, so a future phase that models the business schedules
    // deletes the refusal above and finds this line already correct.
    //
    // **EQUIVALENT MUTANT, recorded rather than left to be rediscovered.**
    // Multiplying this whole expression by `0n` cannot turn the suite red at
    // any input, because the R6 refusal above makes line 22 a structural zero
    // and `min(x, y, 0)` over non-negative amounts is already zero. The
    // printed three-way minimum is transcribed anyway, for the reason above
    // and because a reader diffing this against the page should find every
    // printed sentence in it. Verified by mutation.
    const line24DeductibleBenefitsCents = min(
        min(line20Cents)(line21ExclusionLimitCents))(line22SoleProprietorshipOrPartnershipCents)
    // Line 25 — "Excluded benefits. If you checked 'No' on line 22, enter the
    // smaller of line 20 or line 21. Otherwise, subtract line 24 from the
    // smaller of line 20 or line 21. If zero or less, enter -0-." The two
    // branches coincide while line 24 is zero; both are written because the
    // printed page has both.
    //
    // **The SECOND equivalent mutant here, and it is the same one twice.**
    // Collapsing this ternary to its `Otherwise` arm alone also stays green,
    // for the identical reason: line 24 above is zero, so `smaller - 0` is
    // `smaller`. The two are one property of line 22, not two of line 25 —
    // and the day the business schedules compute, BOTH mutations start
    // biting together.
    const smallerOfTwentyAndTwentyOne = min(line20Cents)(line21ExclusionLimitCents)
    const line25ExcludedBenefitsCents = atLeastZero(
        line22SoleProprietorshipOrPartnershipCents <= 0n
            ? smallerOfTwentyAndTwentyOne
            : smallerOfTwentyAndTwentyOne - line24DeductibleBenefitsCents)
    // Line 26 — "Taxable benefits. Subtract line 25 from line 23. If zero or
    // less, enter -0-. Also, enter this amount on Form 1040 ... line 1e."
    const line26TaxableBenefitsCents = atLeastZero(line23Cents - line25ExcludedBenefitsCents)
    const line27ExpenseLimitCents
        = dependentCareExpenseLimitCents(taxParamSet)(qualifyingPersonCount)
    const line28ExcludedOrDeductedCents
        = line24DeductibleBenefitsCents + line25ExcludedBenefitsCents
    // Line 29 — "Subtract line 28 from line 27. If zero or less, stop. You
    // can't take the credit." **This is where §129 reduces §21's cap dollar
    // for dollar**, and it is the whole interaction between the two: a filer
    // with one qualifying person, $8,000 of expenses and $5,000 excluded gets
    // NO credit, not a credit on $3,000.
    const line29Cents = line27ExpenseLimitCents - line28ExcludedOrDeductedCents
    // Line 30 — "Complete line 2 on page 1 of this form. Don't include in
    // column (d) any benefits shown on line 28 above. Then, add the amounts in
    // column (d)." Written as the paid-expense total less line 28 rather than
    // as a second taxpayer-supplied figure, because a second figure is a
    // second source of truth able to disagree with the first.
    const line30Cents = atLeastZero(
        qualifiedExpensesIncurredAndPaidCents - line28ExcludedOrDeductedCents)
    // Line 31 — "Enter the smaller of line 29 or line 30." Line 29's own
    // "stop" is what the floor expresses: a non-positive line 29 is no credit,
    // never a negative line 3.
    const line31Cents = line29Cents <= 0n ? 0n : min(line29Cents)(line30Cents)
    return {
        kind: 'ok',
        line12BenefitsReceivedCents,
        line13GraceCarryoverCents,
        line14ForfeitedOrCarriedForwardCents,
        line15CombinedBenefitsCents,
        line16QualifiedExpensesIncurredCents,
        line17Cents,
        line18EarnedIncomeCents,
        line19SpouseEarnedIncomeCents,
        line20Cents,
        line21ExclusionLimitCents,
        line22SoleProprietorshipOrPartnershipCents,
        line23Cents,
        line24DeductibleBenefitsCents,
        line25ExcludedBenefitsCents,
        line26TaxableBenefitsCents,
        line27ExpenseLimitCents,
        line28ExcludedOrDeductedCents,
        line29Cents,
        line30Cents,
        line31Cents,
    }
}

/**
 * Form 2441 Part II, lines 3 through 11 — the nonrefundable credit that
 * reaches Schedule 3 line 2.
 *
 * Run AFTER {@link form2441DependentCareBenefits} and after the 1040 has an
 * adjusted gross income and a tax; see this module's own docstring for the
 * chain and why it cannot be one call.
 * @type {(taxParamSet: TaxParamSet) => (input: Form2441CreditInput) => Form2441CreditOutcome}
 */
export const form2441Credit = taxParamSet => input => {
    const shared = sharedRefusal(taxParamSet)(input)
    if (shared !== undefined) {
        return shared
    }
    const { line3Cents, earnedIncomeCents, adjustedGrossIncomeCents, taxLiabilityLimitCents }
        = input
    // Line 4 — the filer's earned income. Line 5's printed instruction for a
    // filer who is neither joint nor separate is "all others, enter the amount
    // from line 4", and both other statuses have already refused above.
    const line4EarnedIncomeCents = earnedIncomeCents
    const line5SpouseEarnedIncomeCents = line4EarnedIncomeCents
    const deemed = deemedEarnedIncomeRefusal(taxParamSet)(input)({
        earnedIncomeCents: line4EarnedIncomeCents,
        comparedWithCents: line3Cents,
        earnedIncomeLine: 'line 4',
        comparedWithLine: 'line 3',
    })
    if (deemed !== undefined) {
        return deemed
    }
    // Line 6 — "Enter the smallest of line 3, 4, or 5. If zero or less, enter
    // -0-."
    const line6Cents = atLeastZero(
        min(min(line3Cents)(line4EarnedIncomeCents))(line5SpouseEarnedIncomeCents))
    // Line 7 — "Enter the amount from Form 1040, 1040-SR, or 1040-NR, line
    // 11a", which the 2025 Form 1040 labels "This is your adjusted gross
    // income". Line 11 on that form is a different figure and line 11b is the
    // same one restated, so the printed reference is worth transcribing
    // exactly.
    const line7AdjustedGrossIncomeCents = adjustedGrossIncomeCents
    const line8Percent = dependentCareCreditPercent(taxParamSet)(line7AdjustedGrossIncomeCents)
    // Line 9a — "Multiply line 6 by the decimal amount on line 8." The
    // percentage is whole points, so the product is divided by 100 and rounded
    // HALF-UP to the cent. The printed page prints no rounding rule for this
    // line, and half-up to the cent is this repo's convention wherever a rate
    // meets an exact amount; the alternative, truncation, would cost the
    // taxpayer up to a cent and would differ from every other rate line here.
    const line9aCents = halfUp(of(line6Cents * BigInt(line8Percent))(100n))
    // Line 9b — Worksheet A's credit for 2024 expenses paid in 2025. A
    // structural zero: `sharedRefusal` above refuses any such expense outright,
    // so this is "the printed -0- the form tells everyone else to enter"
    // rather than an amount this engine dropped.
    const line9bPriorYearExpenseCreditCents = 0n
    const line9cCents = line9aCents + line9bPriorYearExpenseCreditCents
    // Line 10 — the i2441 p5 Credit Limit Worksheet's result, computed by the
    // caller from 1040 line 18 and Schedule 3 lines 1 and 6l. Its own "But if
    // zero or less, stop; you can't take the credit" is the floor below.
    const line10TaxLiabilityLimitCents = taxLiabilityLimitCents
    // Line 11 — "Enter the smaller of line 9c or line 10 here and on Schedule
    // 3 (Form 1040), line 2."
    const line11CreditCents = atLeastZero(min(line9cCents)(line10TaxLiabilityLimitCents))
    return {
        kind: 'ok',
        line3Cents,
        line4EarnedIncomeCents,
        line5SpouseEarnedIncomeCents,
        line6Cents,
        line7AdjustedGrossIncomeCents,
        line8Percent,
        line9aCents,
        line9bPriorYearExpenseCreditCents,
        line9cCents,
        line10TaxLiabilityLimitCents,
        line11CreditCents,
    }
}

// ── Tests ────────────────────────────────────────────────────────────────────

const taxParams2025 = taxParamsByYear[2025]
assert(taxParams2025 !== undefined, 'expected TY2025 parameters to be present in taxParamsByYear')

/**
 * A head-of-household filer — the paradigm single-parent Form 2441 filer, and
 * a status the printed line 5 answers with "all others, enter the amount from
 * line 4". Every leaf below varies one fact of this.
 * @type {Form2441Common}
 */
const oneChildBase = {
    status: 'headOfHousehold',
    qualifyingPersonCount: 1,
    // The ordinary return: the one child's §21(b)(1)(A) population IS stated,
    // so R6 is silent. Every leaf below that varies this varies ONE fact, and
    // the R6 leaves vary this one.
    qualifyingPersonsWithNoAgeAssertion: [],
    careProviderCount: 1,
    qualifiedExpensesIncurredAndPaidCents: 0n,
    filerWasNeitherAStudentNorDisabled: true,
    priorYearExpensesPaidThisYearCents: 0n,
    selfEmploymentEarningsPresent: false,
}

/** @type {(common: Form2441Common) => Form2441BenefitsInput} */
const benefitsOf = common => ({
    ...common,
    dependentCareBenefitsCents: 0n,
    graceCarryoverCents: 0n,
    forfeitedOrCarriedForwardCents: 0n,
    qualifiedExpensesIncurredCents: 0n,
    earnedIncomeExcludingBenefitsCents: 0n,
    planMaximumExclusionCents: undefined,
    soleProprietorshipOrPartnershipBenefitsCents: 0n,
})

/** @type {(common: Form2441Common) => Form2441CreditInput} */
const creditOf = common => ({
    ...common,
    line3Cents: 0n,
    earnedIncomeCents: 0n,
    adjustedGrossIncomeCents: 0n,
    taxLiabilityLimitCents: 0n,
})

/** @type {(outcome: Form2441BenefitsOutcome) => Form2441BenefitsResult} */
const expectBenefitsOk = outcome => {
    assert(outcome.kind === 'ok', ['expected Form 2441 Part III to compute, not refuse', outcome])
    return outcome
}

/** @type {(outcome: Form2441CreditOutcome) => Form2441CreditResult} */
const expectCreditOk = outcome => {
    assert(outcome.kind === 'ok', ['expected Form 2441 Part II to compute, not refuse', outcome])
    return outcome
}

/** @type {(outcome: Form2441BenefitsOutcome | Form2441CreditOutcome) => string} */
const expectRefusal = outcome => {
    assert(outcome.kind === 'error', ['expected Form 2441 to refuse', outcome])
    return outcome.message
}

/**
 * Every refusal must say WHERE the amount would have gone — the part of the
 * message a reader can act on, and the part AGENTS.md records an entire
 * project sweep failing to assert.
 * @type {(message: string) => void}
 */
const assertNamesBothDestinations = message => {
    assert(
        message.includes('1040 line 1e') && message.includes('Schedule 3 line 2'),
        ['a refusal must name both lines the amount would have reached', message])
    assert(
        message.includes('line 26') && message.includes('line 11'),
        ['and the Form 2441 line that feeds each', message])
}

export const proof = {
    // ── Line 8's printed table, read through the module ─────────────────────
    //
    // Sixteen hand-typed boundary pairs off f2441 line 8, chosen so that every
    // one of them is a BOUNDARY: the exact "But not over" amount and one cent
    // past it. The stored table is proven against the printed rows in
    // `fjs/tax/params`; what is proven here is the direction of the comparison,
    // which is the part a reader gets wrong.
    line8Percent: {
        everyPrintedBoundaryTakesTheLowerRow: () => {
            /** @type {readonly (readonly [string, number, number])[]} */
            const boundaries = [
                ['15000.00', 35, 34], ['17000.00', 34, 33], ['19000.00', 33, 32],
                ['21000.00', 32, 31], ['23000.00', 31, 30], ['25000.00', 30, 29],
                ['27000.00', 29, 28], ['29000.00', 28, 27], ['31000.00', 27, 26],
                ['33000.00', 26, 25], ['35000.00', 25, 24], ['37000.00', 24, 23],
                ['39000.00', 23, 22], ['41000.00', 22, 21], ['43000.00', 21, 20],
            ]
            assertEq(boundaries.length, 15, 'fifteen boundaries between sixteen printed rows')
            for (const boundary of boundaries) {
                const [amount, atOrBelow, justAbove] = boundary
                const cents = centsFromString(amount)
                assertEq(
                    dependentCareCreditPercent(taxParams2025)(cents),
                    atOrBelow,
                    ['"But not over" is INCLUSIVE, so exactly this amount takes the lower row', amount])
                assertEq(
                    dependentCareCreditPercent(taxParams2025)(cents + 1n),
                    justAbove,
                    ['and one cent more takes the next row', amount])
            }
        },
        // The two ends. Zero and a negative adjusted gross income both take
        // 35%, and the floor is 20% however large the income is.
        theTableIsFlatOutsideItsPrintedEnds: () => {
            assertEq(dependentCareCreditPercent(taxParams2025)(0n), 35, 'no income is 35%')
            assertEq(
                dependentCareCreditPercent(taxParams2025)(-100000n),
                35,
                'a negative adjusted gross income is still 35% — never an error')
            assertEq(
                dependentCareCreditPercent(taxParams2025)(100000000n),
                20,
                '$1,000,000.00 is §21(a)(2)’s 20% floor')
        },
    },
    // ── The §21(c) cap ──────────────────────────────────────────────────────
    expenseLimit: {
        // THREE qualifying persons is $6,000, not $9,000 — the mistake a
        // per-person multiplier makes, and one the two-person case cannot see.
        theCapIsTwoWayAndNotPerPerson: () => {
            const cap = dependentCareExpenseLimitCents(taxParams2025)
            assertEq(cap(0), 0n, 'no qualifying person, no cap and no credit')
            assertEq(cap(1), 300000n, '$3,000.00')
            assertEq(cap(2), 600000n, '$6,000.00')
            assertEq(cap(3), 600000n, '$6,000.00 — NOT $9,000.00')
            assertEq(cap(7), 600000n, '$6,000.00 however many there are')
        },
    },
    // ── Line 21, including the branch the refusals make unreachable ─────────
    exclusionLimit: {
        theStatutoryFigureForEveryStatusThatCanReachIt: () => {
            const limit = dependentCareExclusionLimitCents(taxParams2025)
            for (const status of /** @type {readonly IndividualFilingStatus[]} */ ([
                'single', 'headOfHousehold', 'qualifyingSurvivingSpouse', 'marriedFilingJointly',
            ])) {
                assertEq(limit(status)(undefined), 500000n, ['§129(a)(2)(A)’s $5,000.00', status])
            }
        },
        // Married filing separately reads the OTHER column. Unreachable
        // through either entry point — every such return refuses — and proven
        // directly for exactly that reason.
        marriedFilingSeparatelyReadsTheHalvedColumn: () => {
            assertEq(
                dependentCareExclusionLimitCents(taxParams2025)('marriedFilingSeparately')(undefined),
                250000n,
                '$2,500.00, not $5,000.00')
        },
        // "Don't enter more than the maximum amount allowed under your
        // dependent care plan" — the plan's cap BINDS below the statute's and
        // is IGNORED above it.
        aPlanMaximumBindsOnlyWhenItIsLower: () => {
            const limit = dependentCareExclusionLimitCents(taxParams2025)('single')
            assertEq(limit(400000n), 400000n, 'a $4,000.00 plan caps at $4,000.00')
            assertEq(limit(700000n), 500000n, 'a $7,000.00 plan still caps at the statutory $5,000.00')
            assertEq(limit(500000n), 500000n, 'and an equal one at $5,000.00')
        },
    },
    // ── Part III, worked from the printed page ──────────────────────────────
    partThree: {
        /*
         * i2441 p5's OWN worked example for line 14:
         *
         *   "you chose to have your employer set aside $5,000 ... The $5,000
         *   is shown in box 10 of your Form W-2. In 2025, you incurred and
         *   were reimbursed for $4,950 of qualified expenses. You would enter
         *   $5,000 on line 12 and $50, the amount forfeited, on line 14."
         *
         * Head of household, one child, $40,000 of wages.
         *   line 15  5000 + 0 - 50   = $4,950
         *   line 16  $4,950 incurred
         *   line 17  min(4950, 4950) = $4,950
         *   line 18  $40,000   line 19 = line 18
         *   line 20  min(4950, 40000, 40000) = $4,950
         *   line 21  $5,000
         *   line 23  4950 - 0       = $4,950
         *   line 24  min(4950, 5000, 0) = $0
         *   line 25  min(4950, 5000)    = $4,950
         *   line 26  4950 - 4950        = $0 taxable
         *   line 27  $3,000    line 28  0 + 4950 = $4,950
         *   line 29  3000 - 4950 = -$1,950  -> STOP, no credit
         *   line 31  $0
         */
        theInstructionsOwnForfeitureExample: () => {
            const result = expectBenefitsOk(form2441DependentCareBenefits(taxParams2025)({
                ...benefitsOf(oneChildBase),
                qualifiedExpensesIncurredAndPaidCents: 495000n,
                dependentCareBenefitsCents: 500000n,
                forfeitedOrCarriedForwardCents: 5000n,
                qualifiedExpensesIncurredCents: 495000n,
                earnedIncomeExcludingBenefitsCents: 4000000n,
            }))
            assertEq(result.line15CombinedBenefitsCents, 495000n, '$4,950.00 — $5,000 less the $50 forfeited')
            assertEq(result.line17Cents, 495000n, '$4,950.00')
            assertEq(result.line20Cents, 495000n, '$4,950.00')
            assertEq(result.line21ExclusionLimitCents, 500000n, '$5,000.00')
            assertEq(result.line24DeductibleBenefitsCents, 0n, 'nothing deductible — line 22 is zero')
            assertEq(result.line25ExcludedBenefitsCents, 495000n, '$4,950.00 excluded')
            assertEq(result.line26TaxableBenefitsCents, 0n, 'nothing taxable reaches 1040 line 1e')
            assertEq(result.line27ExpenseLimitCents, 300000n, '$3,000.00 for one qualifying person')
            assertEq(result.line28ExcludedOrDeductedCents, 495000n, '$4,950.00 excluded or deducted')
            assertEq(result.line29Cents, -195000n, '-$1,950.00 — line 29’s own "stop"')
            assertEq(
                result.line31Cents,
                0n,
                'NO credit at all, and never a negative line 3: §129 ate the whole §21 cap')
        },
        /*
         * **The §129/§21 interaction, with TWO qualifying persons, where a
         * credit survives.** Identical facts to the brief's own worked case.
         *
         *   $8,000 of expenses, $5,000 of box 10 benefits, two children,
         *   $60,000 of wages, head of household.
         *
         *   line 15  $5,000    line 16 $8,000    line 17 min = $5,000
         *   line 20  min(5000, 60000, 60000) = $5,000    line 21 $5,000
         *   line 25  min(5000, 5000) = $5,000 excluded
         *   line 26  5000 - 5000 = $0 taxable
         *   line 27  $6,000     line 28 $5,000
         *   line 29  6000 - 5000 = $1,000
         *   line 30  8000 - 5000 = $3,000
         *   line 31  min(1000, 3000) = $1,000  -> line 3
         *
         * With ONE qualifying person and the same facts, line 27 is $3,000 and
         * line 29 is -$2,000: no credit. The two are asserted together,
         * because the whole point of the interaction is that the answer turns
         * on the cap and not on the expenses.
         */
        theExclusionReducesTheExpenseCapDollarForDollar: () => {
            /** @type {(count: number) => Form2441BenefitsInput} */
            const withChildren = count => ({
                ...benefitsOf({ ...oneChildBase, qualifyingPersonCount: count }),
                qualifiedExpensesIncurredAndPaidCents: 800000n,
                dependentCareBenefitsCents: 500000n,
                qualifiedExpensesIncurredCents: 800000n,
                earnedIncomeExcludingBenefitsCents: 6000000n,
            })
            const two = expectBenefitsOk(form2441DependentCareBenefits(taxParams2025)(withChildren(2)))
            assertEq(two.line17Cents, 500000n, '$5,000.00 — capped by the benefits, not the expenses')
            assertEq(two.line25ExcludedBenefitsCents, 500000n, 'the whole $5,000.00 is excluded')
            assertEq(two.line26TaxableBenefitsCents, 0n, 'nothing taxable')
            assertEq(two.line27ExpenseLimitCents, 600000n, '$6,000.00 for two qualifying persons')
            assertEq(two.line29Cents, 100000n, '$1,000.00 of cap survives the exclusion')
            assertEq(two.line30Cents, 300000n, '$3,000.00 of expenses were not paid with benefits')
            assertEq(two.line31Cents, 100000n, '$1,000.00 — the CAP binds, not the expenses')
            const one = expectBenefitsOk(form2441DependentCareBenefits(taxParams2025)(withChildren(1)))
            assertEq(one.line27ExpenseLimitCents, 300000n, '$3,000.00 for one')
            assertEq(one.line29Cents, -200000n, '-$2,000.00')
            assertEq(
                one.line31Cents,
                0n,
                'the SAME $8,000 of expenses buys no credit at all with one child')
        },
        /*
         * i2441 p5's OWN worked example for line 16:
         *
         *   "You received $2,000 in cash under your employer's dependent care
         *   plan for 2025 ... Only $900 of qualified expenses were incurred in
         *   2025 for the care of your 5-year-old dependent child. You would
         *   enter $2,000 on line 12 and $900 on line 16."
         *
         *   line 15 $2,000   line 16 $900   line 17 min = $900
         *   line 20 $900     line 21 $5,000  line 25 min(900, 5000) = $900
         *   line 23 $2,000   line 26 2000 - 900 = **$1,100 TAXABLE** -> 1040 1e
         *
         * This is the leaf that proves the engine reports income it previously
         * reported as zero.
         */
        theInstructionsOwnUnderspentPlanExample: () => {
            const result = expectBenefitsOk(form2441DependentCareBenefits(taxParams2025)({
                ...benefitsOf(oneChildBase),
                qualifiedExpensesIncurredAndPaidCents: 90000n,
                dependentCareBenefitsCents: 200000n,
                qualifiedExpensesIncurredCents: 90000n,
                earnedIncomeExcludingBenefitsCents: 4000000n,
            }))
            assertEq(result.line17Cents, 90000n, '$900.00 — the EXPENSES bind, not the benefits')
            assertEq(result.line25ExcludedBenefitsCents, 90000n, 'only $900.00 may be excluded')
            assertEq(result.line23Cents, 200000n, '$2,000.00 of benefits')
            assertEq(
                result.line26TaxableBenefitsCents,
                110000n,
                '$1,100.00 of TAXABLE dependent care benefits reach 1040 line 1e')
        },
        // The Part-III-only return i2441 p2 contemplates: box 10 benefits, no
        // qualifying person and no care provider at all. **Every dollar is
        // taxable**, and this is the case the engine reported as zero before
        // this module existed — an understatement of tax, which is the
        // dangerous direction.
        benefitsWithNoExpensesAreTaxableInFull: () => {
            const result = expectBenefitsOk(form2441DependentCareBenefits(taxParams2025)({
                ...benefitsOf({
                    ...oneChildBase, qualifyingPersonCount: 0, careProviderCount: 0,
                }),
                dependentCareBenefitsCents: 500000n,
                earnedIncomeExcludingBenefitsCents: 4000000n,
            }))
            assertEq(result.line16QualifiedExpensesIncurredCents, 0n, 'nothing incurred')
            assertEq(result.line17Cents, 0n)
            assertEq(result.line25ExcludedBenefitsCents, 0n, 'nothing may be excluded')
            assertEq(
                result.line26TaxableBenefitsCents,
                500000n,
                'the WHOLE $5,000.00 is wages — this line was a hard zero before TAX-38')
            assertEq(result.line31Cents, 0n, 'and no credit, because there is no qualifying person')
        },
        // Line 21 binds when the benefits exceed §129's ceiling: $8,000 of box
        // 10 against $8,000 of expenses excludes $5,000 and taxes $3,000.
        theExclusionCeilingBindsAboveFiveThousand: () => {
            const result = expectBenefitsOk(form2441DependentCareBenefits(taxParams2025)({
                ...benefitsOf({ ...oneChildBase, qualifyingPersonCount: 2 }),
                qualifiedExpensesIncurredAndPaidCents: 800000n,
                dependentCareBenefitsCents: 800000n,
                qualifiedExpensesIncurredCents: 800000n,
                earnedIncomeExcludingBenefitsCents: 6000000n,
            }))
            assertEq(result.line17Cents, 800000n, '$8,000.00 — neither benefits nor expenses bind')
            assertEq(result.line20Cents, 800000n)
            assertEq(result.line21ExclusionLimitCents, 500000n, '§129 caps at $5,000.00')
            assertEq(result.line25ExcludedBenefitsCents, 500000n)
            assertEq(
                result.line26TaxableBenefitsCents,
                300000n,
                '$3,000.00 taxable — the amount above the §129 ceiling')
        },
        // Line 18 CAPS the exclusion for a low earner: $5,000 of benefits
        // against $1,200 of earned income excludes only $1,200.
        earnedIncomeCapsTheExclusion: () => {
            const result = expectBenefitsOk(form2441DependentCareBenefits(taxParams2025)({
                ...benefitsOf(oneChildBase),
                qualifiedExpensesIncurredAndPaidCents: 500000n,
                dependentCareBenefitsCents: 500000n,
                qualifiedExpensesIncurredCents: 500000n,
                earnedIncomeExcludingBenefitsCents: 120000n,
            }))
            assertEq(result.line17Cents, 500000n)
            assertEq(result.line18EarnedIncomeCents, 120000n, '$1,200.00 of earned income')
            assertEq(result.line20Cents, 120000n, 'line 20 is the SMALLEST of 17, 18 and 19')
            assertEq(result.line25ExcludedBenefitsCents, 120000n)
            assertEq(
                result.line26TaxableBenefitsCents,
                380000n,
                '$3,800.00 taxable — earned income, not §129, is what capped this')
        },
        // Line 14 SUBTRACTS. Asserted against the same facts without a
        // forfeiture, because a sign error here is invisible in any single
        // fixture.
        theForfeitureSubtractsRatherThanAdds: () => {
            const base = {
                ...benefitsOf(oneChildBase),
                qualifiedExpensesIncurredAndPaidCents: 500000n,
                dependentCareBenefitsCents: 300000n,
                qualifiedExpensesIncurredCents: 500000n,
                earnedIncomeExcludingBenefitsCents: 4000000n,
            }
            const without = expectBenefitsOk(form2441DependentCareBenefits(taxParams2025)(base))
            const with100 = expectBenefitsOk(form2441DependentCareBenefits(taxParams2025)({
                ...base, forfeitedOrCarriedForwardCents: 10000n,
            }))
            assertEq(without.line15CombinedBenefitsCents, 300000n, '$3,000.00')
            assertEq(
                with100.line15CombinedBenefitsCents,
                290000n,
                '$2,900.00 — a $100.00 forfeiture makes line 15 SMALLER')
        },
        // Line 13 ADDS, in the opposite direction from line 14 and in the same
        // expression, which is why the two are proven separately.
        theGraceCarryoverAdds: () => {
            const result = expectBenefitsOk(form2441DependentCareBenefits(taxParams2025)({
                ...benefitsOf(oneChildBase),
                qualifiedExpensesIncurredAndPaidCents: 500000n,
                dependentCareBenefitsCents: 300000n,
                graceCarryoverCents: 20000n,
                qualifiedExpensesIncurredCents: 500000n,
                earnedIncomeExcludingBenefitsCents: 4000000n,
            }))
            assertEq(
                result.line15CombinedBenefitsCents,
                320000n,
                '$3,200.00 — $3,000.00 of box 10 plus a $200.00 grace-period carryover')
        },
    },
    // ── Lines 27-31 with no benefits ARE the printed line 3 cap ─────────────
    theTwoCaps: {
        // The equality this module's docstring claims, asserted rather than
        // asserted-in-prose: with no benefits, line 31 is min(the §21(c) cap,
        // the expenses) for every combination of the two that matters.
        withNoBenefitsLineThirtyOneIsExactlyThePrintedLineThreeCap: () => {
            /** @type {readonly (readonly [number, string, bigint])[]} */
            const cases = [
                [1, '2000.00', 200000n],
                [1, '3000.00', 300000n],
                [1, '9000.00', 300000n],
                [2, '5000.00', 500000n],
                [2, '6000.00', 600000n],
                [2, '9000.00', 600000n],
                [0, '9000.00', 0n],
            ]
            assertEq(cases.length, 7, 'both sides of both caps, plus the no-person case')
            for (const entry of cases) {
                const [count, expenses, expected] = entry
                const result = expectBenefitsOk(form2441DependentCareBenefits(taxParams2025)({
                    ...benefitsOf({ ...oneChildBase, qualifyingPersonCount: count }),
                    qualifiedExpensesIncurredAndPaidCents: centsFromString(expenses),
                    earnedIncomeExcludingBenefitsCents: 6000000n,
                }))
                assertEq(result.line12BenefitsReceivedCents, 0n, 'no Part III benefits at all')
                assertEq(result.line28ExcludedOrDeductedCents, 0n)
                assertEq(
                    result.line31Cents,
                    expected,
                    ['line 31 with no benefits is the printed line 3 cap', count, expenses])
            }
        },
    },
    // ── Part II, worked from the printed page ───────────────────────────────
    partTwo: {
        /*
         * Head of household, one child, $3,000 of qualified expenses,
         * $40,000 of earned income and $40,000 of adjusted gross income, tax
         * enough to absorb the credit.
         *
         *   line 3  $3,000   line 4 $40,000   line 5 = line 4
         *   line 6  min(3000, 40000, 40000) = $3,000
         *   line 7  $40,000  -> line 8's row "39,000—41,000" = .22
         *   line 9a 3000 x 0.22 = **$660.00**
         *   line 11 min(660, 5000) = $660.00 -> Schedule 3 line 2
         */
        anOrdinarySingleParentCredit: () => {
            const result = expectCreditOk(form2441Credit(taxParams2025)({
                ...creditOf(oneChildBase),
                qualifiedExpensesIncurredAndPaidCents: 300000n,
                line3Cents: 300000n,
                earnedIncomeCents: 4000000n,
                adjustedGrossIncomeCents: 4000000n,
                taxLiabilityLimitCents: 500000n,
            }))
            assertEq(result.line6Cents, 300000n, '$3,000.00')
            assertEq(result.line8Percent, 22, '$40,000.00 is in the "39,000—41,000" row')
            assertEq(result.line9aCents, 66000n, '$660.00 — 22% of $3,000.00')
            assertEq(result.line9bPriorYearExpenseCreditCents, 0n, 'the printed -0- on line 9b')
            assertEq(result.line9cCents, 66000n)
            assertEq(result.line11CreditCents, 66000n, '$660.00 reaches Schedule 3 line 2')
        },
        /*
         * The MAXIMUM credit the 2025 form can produce, which is the figure a
         * reader will check this engine against first: two qualifying persons,
         * $6,000 of expenses and adjusted gross income at or below $15,000.
         *
         *   line 6 $6,000  line 8 .35  line 9a 6000 x 0.35 = **$2,100.00**
         *
         * Asserted at exactly $15,000 of AGI, which is the boundary the
         * printed "But not over" column makes inclusive.
         */
        theLargestCreditTheFormCanProduce: () => {
            const result = expectCreditOk(form2441Credit(taxParams2025)({
                ...creditOf({ ...oneChildBase, qualifyingPersonCount: 2 }),
                qualifiedExpensesIncurredAndPaidCents: 600000n,
                line3Cents: 600000n,
                earnedIncomeCents: 1500000n,
                adjustedGrossIncomeCents: 1500000n,
                taxLiabilityLimitCents: 1000000n,
            }))
            assertEq(result.line8Percent, 35, 'exactly $15,000.00 is still the 35% row')
            assertEq(result.line9aCents, 210000n, '$2,100.00')
            assertEq(result.line11CreditCents, 210000n)
        },
        // Line 10 BINDS: the credit is nonrefundable, so a filer with $100 of
        // tax gets $100 and not $660. This is the leaf that would go green if
        // somebody made the credit refundable.
        theTaxLiabilityLimitCapsTheCredit: () => {
            const result = expectCreditOk(form2441Credit(taxParams2025)({
                ...creditOf(oneChildBase),
                qualifiedExpensesIncurredAndPaidCents: 300000n,
                line3Cents: 300000n,
                earnedIncomeCents: 4000000n,
                adjustedGrossIncomeCents: 4000000n,
                taxLiabilityLimitCents: 10000n,
            }))
            assertEq(result.line9cCents, 66000n, '$660.00 of credit computed')
            assertEq(
                result.line11CreditCents,
                10000n,
                '$100.00 allowed — the credit is NONREFUNDABLE and line 10 is the ceiling')
        },
        // A filer with no tax at all gets nothing, and the floor is zero
        // rather than a negative credit. The Credit Limit Worksheet's own
        // "But if zero or less, stop; you can't take the credit."
        aNegativeTaxLiabilityLimitYieldsNoCreditRatherThanANegativeOne: () => {
            const result = expectCreditOk(form2441Credit(taxParams2025)({
                ...creditOf(oneChildBase),
                qualifiedExpensesIncurredAndPaidCents: 300000n,
                line3Cents: 300000n,
                earnedIncomeCents: 4000000n,
                adjustedGrossIncomeCents: 4000000n,
                taxLiabilityLimitCents: -50000n,
            }))
            assertEq(result.line11CreditCents, 0n, 'never a negative credit')
        },
        // Line 6's earned-income term BINDS below line 3 — with the §21(d)
        // certification present, so the refusal below is not what is being
        // observed here.
        earnedIncomeBelowTheExpensesCapsLineSix: () => {
            const result = expectCreditOk(form2441Credit(taxParams2025)({
                ...creditOf(oneChildBase),
                qualifiedExpensesIncurredAndPaidCents: 300000n,
                line3Cents: 300000n,
                earnedIncomeCents: 120000n,
                adjustedGrossIncomeCents: 120000n,
                taxLiabilityLimitCents: 500000n,
            }))
            assertEq(result.line6Cents, 120000n, '$1,200.00 — earned income, not the $3,000.00 cap')
            assertEq(result.line8Percent, 35, '$1,200.00 of AGI is the 35% row')
            assertEq(result.line9aCents, 42000n, '$420.00 — 35% of $1,200.00')
        },
        // The half-up rounding of line 9a, observable only where the product
        // does not land on a whole cent: $1,234.57 x 21% = $259.2597, which is
        // **$259.26** and not $259.25.
        lineNineARoundsHalfUpToTheCent: () => {
            const result = expectCreditOk(form2441Credit(taxParams2025)({
                ...creditOf(oneChildBase),
                qualifiedExpensesIncurredAndPaidCents: 123457n,
                line3Cents: 123457n,
                earnedIncomeCents: 4200000n,
                adjustedGrossIncomeCents: 4200000n,
                taxLiabilityLimitCents: 500000n,
            }))
            assertEq(result.line8Percent, 21, '$42,000.00 is the "41,000—43,000" row')
            assertEq(
                result.line9aCents,
                25926n,
                '$259.26 — $259.2597 rounded UP, never truncated to $259.25')
        },
    },
    // ── The eight refusals, each with its own control ───────────────────────
    refusals: {
        aJointReturnIsRefusedBecauseTheSpouseSplitIsUnavailable: () => {
            const message = expectRefusal(form2441Credit(taxParams2025)({
                ...creditOf({ ...oneChildBase, status: 'marriedFilingJointly' }),
                line3Cents: 300000n,
                earnedIncomeCents: 4000000n,
                adjustedGrossIncomeCents: 4000000n,
                taxLiabilityLimitCents: 500000n,
            }))
            assert(
                message.includes('line 5') && message.includes('employeeSSN'),
                ['the refusal must name the printed line and the route to unlocking it', message])
            assertNamesBothDestinations(message)
        },
        // The SAME refusal from Part III, so an engine cannot exclude a joint
        // return's benefits while refusing its credit.
        aJointReturnIsRefusedInPartThreeToo: () => {
            const message = expectRefusal(form2441DependentCareBenefits(taxParams2025)({
                ...benefitsOf({ ...oneChildBase, status: 'marriedFilingJointly' }),
                dependentCareBenefitsCents: 500000n,
                earnedIncomeExcludingBenefitsCents: 4000000n,
            }))
            assert(message.includes('line 5'), ['the same printed line', message])
        },
        marriedFilingSeparatelyIsRefused: () => {
            const message = expectRefusal(form2441DependentCareBenefits(taxParams2025)({
                ...benefitsOf({ ...oneChildBase, status: 'marriedFilingSeparately' }),
                dependentCareBenefitsCents: 500000n,
                earnedIncomeExcludingBenefitsCents: 4000000n,
            }))
            assert(
                message.includes('line A') && message.includes('6 months'),
                ['the refusal must name the printed checkbox and one of its three conditions', message])
            assertNamesBothDestinations(message)
        },
        // The CONTROL for both status refusals: the three statuses the printed
        // line 5 answers with "all others" all compute.
        theThreeUnmarriedStatusesAllCompute: () => {
            for (const status of /** @type {readonly IndividualFilingStatus[]} */ ([
                'single', 'headOfHousehold', 'qualifyingSurvivingSpouse',
            ])) {
                const result = expectCreditOk(form2441Credit(taxParams2025)({
                    ...creditOf({ ...oneChildBase, status }),
                    qualifiedExpensesIncurredAndPaidCents: 300000n,
                    line3Cents: 300000n,
                    earnedIncomeCents: 4000000n,
                    adjustedGrossIncomeCents: 4000000n,
                    taxLiabilityLimitCents: 500000n,
                }))
                assertEq(result.line11CreditCents, 66000n, [status, '$660.00'])
            }
        },
        selfEmploymentEarningsAreRefusedNamingTheOrderingThatCausesIt: () => {
            const message = expectRefusal(form2441DependentCareBenefits(taxParams2025)({
                ...benefitsOf({ ...oneChildBase, selfEmploymentEarningsPresent: true }),
                dependentCareBenefitsCents: 500000n,
                earnedIncomeExcludingBenefitsCents: 4000000n,
            }))
            assert(
                message.includes('Schedule SE line 3') && message.includes('Schedule 1 line 15'),
                ['the refusal must name both printed lines earned income is built from', message])
            assert(
                message.includes('1040 line 1z'),
                ['and the line whose ordering is the blocker', message])
            assertNamesBothDestinations(message)
        },
        priorYearExpensesPaidThisYearAreRefusedNamingWorksheetA: () => {
            const message = expectRefusal(form2441Credit(taxParams2025)({
                ...creditOf({ ...oneChildBase, priorYearExpensesPaidThisYearCents: 60000n }),
                line3Cents: 300000n,
                earnedIncomeCents: 4000000n,
                adjustedGrossIncomeCents: 4000000n,
                taxLiabilityLimitCents: 500000n,
            }))
            assert(
                message.includes('Worksheet A') && message.includes('600.00'),
                ['the refusal must name the worksheet AND quote the amount at issue', message])
            assertNamesBothDestinations(message)
        },
        // The CONTROL: a ZERO prior-year expense is the ordinary return and
        // must not refuse. A gate that refused on presence rather than on
        // amount would pass the leaf above alone.
        aZeroPriorYearExpenseComputes: () => {
            const result = expectCreditOk(form2441Credit(taxParams2025)({
                ...creditOf({ ...oneChildBase, priorYearExpensesPaidThisYearCents: 0n }),
                line3Cents: 300000n,
                earnedIncomeCents: 4000000n,
                adjustedGrossIncomeCents: 4000000n,
                taxLiabilityLimitCents: 500000n,
            }))
            assertEq(result.line11CreditCents, 66000n)
        },
        expensesWithNoCareProviderAreRefused: () => {
            const message = expectRefusal(form2441DependentCareBenefits(taxParams2025)({
                ...benefitsOf({ ...oneChildBase, careProviderCount: 0 }),
                qualifiedExpensesIncurredAndPaidCents: 300000n,
                qualifiedExpensesIncurredCents: 300000n,
                earnedIncomeExcludingBenefitsCents: 4000000n,
            }))
            assert(
                message.includes('dependentCareProviders') && message.includes('3000.00'),
                ['the refusal must name the field that unlocks it and the amount at stake', message])
            assertNamesBothDestinations(message)
        },
        // The CONTROL for the provider gate, and it is the case i2441 p2
        // explicitly contemplates: benefits with NO expenses and NO provider
        // must compute rather than refuse, because that return exists only to
        // report taxable income in Part III.
        benefitsWithNoExpensesAndNoProviderAreNotRefused: () => {
            const result = expectBenefitsOk(form2441DependentCareBenefits(taxParams2025)({
                ...benefitsOf({
                    ...oneChildBase, qualifyingPersonCount: 0, careProviderCount: 0,
                }),
                dependentCareBenefitsCents: 500000n,
                earnedIncomeExcludingBenefitsCents: 4000000n,
            }))
            assertEq(result.line26TaxableBenefitsCents, 500000n)
        },
        // ── R6, f2441 line 2 column (c) ────────────────────────────────────
        //
        // The understatement `fjs/todo/stored-but-unread-field-sweep.md`
        // flagged: an entry in neither §21(b)(1) population used to be counted
        // as qualifying. Asserted in BOTH parts, because the count reaches
        // Part III at line 27 and Part II at line 3.
        aQualifyingPersonWithNoAgeAssertionIsRefusedNamingThePersonAndTheCap: () => {
            const message = expectRefusal(form2441Credit(taxParams2025)({
                ...creditOf({
                    ...oneChildBase,
                    qualifyingPersonsWithNoAgeAssertion: ['A. Child'],
                }),
                line3Cents: 300000n,
                earnedIncomeCents: 4000000n,
                adjustedGrossIncomeCents: 4000000n,
                taxLiabilityLimitCents: 500000n,
            }))
            // WHICH row of line 2 to fix, and WHICH field unlocks it: the two
            // halves of a message a reader can act on.
            assert(
                message.includes('A. Child')
                && message.includes('underAgeThirteenWhenTheCareWasProvided')
                && message.includes('overAgeTwelveAndDisabled'),
                ['the refusal must name the person and both fields that settle them', message])
            // The printed sentence the whole refusal rests on, and the two
            // caps whose difference is what the wrong answer was worth.
            assert(
                message.includes('over age 12 at the time the care was provided')
                && message.includes('3000.00') && message.includes('6000.00'),
                ['and quote the printed rule and the cap it moves', message])
            assertNamesBothDestinations(message)
        },
        aQualifyingPersonWithNoAgeAssertionIsRefusedInPartThreeToo: () => {
            const message = expectRefusal(form2441DependentCareBenefits(taxParams2025)({
                ...benefitsOf({
                    ...oneChildBase,
                    qualifyingPersonsWithNoAgeAssertion: ['A. Child'],
                }),
                dependentCareBenefitsCents: 500000n,
                earnedIncomeExcludingBenefitsCents: 4000000n,
            }))
            assert(message.includes('line 2 column (c)'), ['the same printed column', message])
        },
        // Every unstated person is named, not just the first — a refusal that
        // fixed one row and refused again on the next would be a worse
        // refusal than one that lists them all.
        everyUnstatedPersonIsNamedRatherThanTheFirst: () => {
            const message = expectRefusal(form2441Credit(taxParams2025)({
                ...creditOf({
                    ...oneChildBase,
                    qualifyingPersonCount: 2,
                    qualifyingPersonsWithNoAgeAssertion: ['A. Child', 'B. Child'],
                }),
                line3Cents: 600000n,
                earnedIncomeCents: 4000000n,
                adjustedGrossIncomeCents: 4000000n,
                taxLiabilityLimitCents: 500000n,
            }))
            assert(
                message.includes('A. Child, B. Child') && message.includes('are listed'),
                ['both names, and the plural verb', message])
        },
        // The CONTROL: a return whose every listed person IS in one of the two
        // populations computes, and the credit is the whole $660.00 rather
        // than a quietly reduced one. Without it, a gate that refused every
        // Form 2441 would pass all three leaves above.
        //
        // WHICH population each person is in is not visible here — this
        // function receives the names already filtered — so the proof that the
        // filter admits BOTH lives where the filter does, in
        // `fjs/form1040/core`'s `bothQualifyingPersonPopulationsAreAdmitted`.
        aReturnWhoseEveryPersonIsInAPopulationComputes: () => {
            const result = expectCreditOk(form2441Credit(taxParams2025)({
                ...creditOf({ ...oneChildBase, qualifyingPersonsWithNoAgeAssertion: [] }),
                line3Cents: 300000n,
                earnedIncomeCents: 4000000n,
                adjustedGrossIncomeCents: 4000000n,
                taxLiabilityLimitCents: 500000n,
            }))
            assertEq(result.line11CreditCents, 66000n, '$660.00 — 22% of $3,000.00')
        },
        // The SECOND control, and the one i2441 p2 names: a return with no
        // qualifying person at all is not "a person in neither population",
        // it is the Part-III-only filer, and it must still report its taxable
        // benefits. A gate keyed on `qualifyingPersonCount === 0` rather than
        // on the names would refuse this return.
        aReturnWithNoQualifyingPersonAtAllStillComputesItsTaxableBenefits: () => {
            const result = expectBenefitsOk(form2441DependentCareBenefits(taxParams2025)({
                ...benefitsOf({
                    ...oneChildBase, qualifyingPersonCount: 0, careProviderCount: 0,
                    qualifyingPersonsWithNoAgeAssertion: [],
                }),
                dependentCareBenefitsCents: 500000n,
                earnedIncomeExcludingBenefitsCents: 4000000n,
            }))
            assertEq(result.line26TaxableBenefitsCents, 500000n, 'the whole $5,000.00 is wages')
        },
        soleProprietorshipBenefitsAreRefusedNamingTheThreeBusinessSchedules: () => {
            const message = expectRefusal(form2441DependentCareBenefits(taxParams2025)({
                ...benefitsOf(oneChildBase),
                dependentCareBenefitsCents: 500000n,
                soleProprietorshipOrPartnershipBenefitsCents: 200000n,
                qualifiedExpensesIncurredCents: 500000n,
                qualifiedExpensesIncurredAndPaidCents: 500000n,
                earnedIncomeExcludingBenefitsCents: 4000000n,
            }))
            assert(
                message.includes('Schedule C line 14')
                && message.includes('Schedule F line 15'),
                ['the refusal must name where the deduction it cannot take would have gone', message])
            assertNamesBothDestinations(message)
        },
        // §21(d)(2): the limitation BINDS in Part II — earned income $1,200
        // against a $3,000 line 3 — and no certification.
        aBindingLimitationWithoutTheCertificationIsRefusedInPartTwo: () => {
            const message = expectRefusal(form2441Credit(taxParams2025)({
                ...creditOf({ ...oneChildBase, filerWasNeitherAStudentNorDisabled: false }),
                line3Cents: 300000n,
                earnedIncomeCents: 120000n,
                adjustedGrossIncomeCents: 120000n,
                taxLiabilityLimitCents: 500000n,
            }))
            assert(
                message.includes('dependentCareFilerWasNeitherAStudentNorDisabled'),
                ['the refusal must name the field that would unlock it', message])
            assert(
                message.includes('line B') && message.includes('250.00'),
                ['the printed checkbox and the deemed monthly amount', message])
            assert(
                message.includes('3000.00') && message.includes('1200.00'),
                ['and BOTH figures whose comparison made the limitation bind', message])
            assertNamesBothDestinations(message)
        },
        // The same rule in Part III, against lines 17 and 18 rather than 3 and
        // 4 — two separate call sites, so two leaves.
        aBindingLimitationWithoutTheCertificationIsRefusedInPartThree: () => {
            const message = expectRefusal(form2441DependentCareBenefits(taxParams2025)({
                ...benefitsOf({ ...oneChildBase, filerWasNeitherAStudentNorDisabled: false }),
                dependentCareBenefitsCents: 500000n,
                qualifiedExpensesIncurredCents: 500000n,
                qualifiedExpensesIncurredAndPaidCents: 500000n,
                earnedIncomeExcludingBenefitsCents: 120000n,
            }))
            assert(
                message.includes('line 18') && message.includes('line 17'),
                ['Part III names its OWN pair of printed lines, not Part II’s', message])
        },
        // Two qualifying persons quotes the $500 monthly figure rather than
        // the $250 one — the trap being that §21(d)(2) keys on QUALIFYING
        // PERSONS and not on students.
        theDeemedAmountQuotedDependsOnTheQualifyingPersonCount: () => {
            const message = expectRefusal(form2441Credit(taxParams2025)({
                ...creditOf({
                    ...oneChildBase,
                    qualifyingPersonCount: 2,
                    filerWasNeitherAStudentNorDisabled: false,
                }),
                line3Cents: 600000n,
                earnedIncomeCents: 120000n,
                adjustedGrossIncomeCents: 120000n,
                taxLiabilityLimitCents: 500000n,
            }))
            assert(
                message.includes('500.00') && message.includes('6000.00'),
                ['$500.00 a month, and $6,000.00 over twelve months', message])
        },
        // **The CONTROL that carries the whole design**: with the limitation
        // NOT binding, an uncertified return computes. The deemed amount is a
        // floor, so raising line 4 above line 3 cannot move line 6 — and a
        // blanket refusal would fail here.
        anUncertifiedReturnWhoseLimitationDoesNotBindComputes: () => {
            const result = expectCreditOk(form2441Credit(taxParams2025)({
                ...creditOf({ ...oneChildBase, filerWasNeitherAStudentNorDisabled: false }),
                line3Cents: 300000n,
                earnedIncomeCents: 4000000n,
                adjustedGrossIncomeCents: 4000000n,
                taxLiabilityLimitCents: 500000n,
            }))
            assertEq(result.line6Cents, 300000n, 'line 3 binds, so §21(d)(2) cannot change anything')
            assertEq(result.line11CreditCents, 66000n)
        },
        // The boundary of that control: earned income EXACTLY equal to line 3
        // does not bind either, because line 6's minimum is unchanged by any
        // increase.
        earnedIncomeExactlyEqualToLineThreeDoesNotBind: () => {
            const result = expectCreditOk(form2441Credit(taxParams2025)({
                ...creditOf({ ...oneChildBase, filerWasNeitherAStudentNorDisabled: false }),
                line3Cents: 300000n,
                earnedIncomeCents: 300000n,
                adjustedGrossIncomeCents: 300000n,
                taxLiabilityLimitCents: 500000n,
            }))
            assertEq(result.line6Cents, 300000n)
        },
        // One cent below is the other side of that boundary, and it refuses.
        // Two leaves rather than one, because a comparison written `>` instead
        // of `>=` passes the leaf above and fails only here.
        oneCentBelowLineThreeDoesBind: () => {
            const message = expectRefusal(form2441Credit(taxParams2025)({
                ...creditOf({ ...oneChildBase, filerWasNeitherAStudentNorDisabled: false }),
                line3Cents: 300000n,
                earnedIncomeCents: 299999n,
                adjustedGrossIncomeCents: 299999n,
                taxLiabilityLimitCents: 500000n,
            }))
            assert(message.includes('2999.99'), ['the refusal quotes the earned income', message])
        },
        // A ZERO line 3 never binds, however small earned income is — the
        // Part-III-only return again, which must not be refused for want of a
        // certification about a credit it is not claiming.
        aZeroLineThreeNeverBindsHoweverSmallEarnedIncomeIs: () => {
            const result = expectCreditOk(form2441Credit(taxParams2025)({
                ...creditOf({
                    ...oneChildBase,
                    qualifyingPersonCount: 0,
                    careProviderCount: 0,
                    filerWasNeitherAStudentNorDisabled: false,
                }),
                line3Cents: 0n,
                earnedIncomeCents: 0n,
                adjustedGrossIncomeCents: 4000000n,
                taxLiabilityLimitCents: 500000n,
            }))
            assertEq(result.line11CreditCents, 0n, 'no credit, and no refusal either')
        },
    },
}
