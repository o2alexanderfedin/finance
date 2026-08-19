/**
 * Form 8962 — the Premium Tax Credit (PTC). TAX-37.
 *
 * Sources, fetched and read directly rather than recalled — see
 * `fjs/form8962/todo/premium-tax-credit.md` for the full list and for the
 * reasoning behind every decision this module encodes:
 * `https://www.irs.gov/pub/irs-pdf/f8962.pdf` (Form 8962 (2025), "Created
 * 3/25/25") and `https://www.irs.gov/pub/irs-pdf/i8962.pdf` (its
 * instructions).
 *
 * ## One execution, TWO destinations, and neither ships alone
 *
 * Form 8962 line 24 is the credit allowed and line 25 is the advance already
 * paid. Exactly one of the two arms below is ever non-zero:
 *
 * - line 24 > line 25 -> line 26, the NET PTC, to Schedule 3 line 9 -> 1040
 *   line 31, where it increases the refund.
 * - line 24 < line 25 -> line 29, the EXCESS ADVANCE PTC REPAYMENT, to
 *   Schedule 2 line 1a -> 1z -> line 3 -> 1040 line 17, where it increases
 *   the tax.
 *
 * Wiring either alone would leave the engine silently wrong for the other
 * half of the population — which is what it was before this module existed:
 * both lines were hard zeros, so it neither credited an under-advanced
 * taxpayer nor collected from an over-advanced one. `fjs/form1040/core` runs
 * this function ONCE, before Schedule 2, and hands the two finished figures
 * to the two schedules, exactly as it already does with
 * `foreignTaxCreditLine`.
 *
 * **Schedule 2 line 19 is NOT a third destination.** Schedule 2 (Form 1040)
 * 2025 line 19 reads "Recapture of net EPE from Form 4255, line 1d, column
 * (l)" — an elective payment election recapture with no connection to Form
 * 8962. The `premiumTaxCreditReconciliation` kind that named it is left
 * refused with a corrected remedy; see `fjs/return/scope`.
 *
 * ## What this module refuses, and why refusing is the designed outcome
 *
 * A wrong premium tax credit is money the taxpayer either does not receive or
 * has to pay back with the return, so every case this engine cannot settle
 * from stored facts REFUSES by name rather than computing a plausible number.
 * The nine conditions are tabulated in this module's `todo/` spec and each is
 * implemented below beside the printed sentence that requires it. The two
 * worth naming here because they are the ones a reader will assume away:
 *
 * - **A missing or zero column B (the SLCSP premium) in a month with
 *   enrollment premiums.** The instructions send the taxpayer to Pub. 974 or
 *   HealthCare.gov's Tax Tool to determine the correct figure. This engine
 *   cannot look it up, and a zero there silently zeroes that month's entire
 *   credit rather than failing loudly.
 * - **Any dependent at all, without the profile's own certification that no
 *   dependent is required to file.** Form 8962 line 2b adds those dependents'
 *   modified AGI into household income, and no document this engine holds
 *   reports it.
 *
 * ## The MODIFIED AGI here is Form 8962's own, and it is a third one
 *
 * i8962 Worksheet 1-1: adjusted gross income, PLUS tax-exempt interest (1040
 * line 2a), PLUS Form 2555 lines 45 and 50, PLUS the NONTAXABLE part of
 * Social Security benefits (1040 line 6a less line 6b). That is not §219's
 * add-back list and not §1411's, which is the whole reason this repo forbids
 * a shared identifier for the acronym.
 *
 * **Form 2555's two lines became a LIVE TERM in TAX-42.** This paragraph used
 * to say they were a structural zero "and only while
 * `foreignEarnedIncomeForm2555` is a refused `fjs/return/scope` kind" — a
 * condition that has now failed: that row split, `foreignEarnedIncomeExclusion`
 * is modeled, and `fjs/form1040/core` supplies the amount. Recording the
 * dependency at the site is what made this a two-line change rather than a
 * hunt, and it is why the sentence is rewritten here rather than deleted.
 *
 * ## The annual path is not an optimisation of the monthly one
 *
 * Both are implemented, and the printed line 10 test chooses. They do not
 * agree: annual column (c) is line 8a and monthly column (c) is line 8b,
 * which is line 8a divided by twelve AND ROUNDED, so twelve monthly
 * contributions differ from one annual one by up to six dollars; and the
 * per-month `min(a, d)` cap does not commute with the annual one. Picking
 * either path universally would be a wrong number for the other's population.
 *
 * @module
 */
import { assert, assertEq, assertNotNullish } from 'functionalscript/fjs/asserts/module.f.mjs'
import { centsFromString, centsToString } from '../exact/module.f.js'
import { of, halfUp } from '../types/rational/module.f.js'
import { taxParamsByYear } from '../tax/params/module.f.js'

/** @import { Source } from '../report/line/module.f.js' */
/** @import { OneZeroNineFiveA } from '../document/1095a/module.f.js' */
/** @import { FederalPovertyLineTable, IndividualFilingStatus, TaxParamSet } from '../tax/params/module.f.js' */

/**
 * A document as stored: its CAS hash beside its already-validated value —
 * the same local `Stored<T>` every schedule module in this repo declares for
 * itself. Nothing here re-validates.
 * @template T
 * @typedef {{ readonly documentHash: string, readonly value: T }} Stored
 */

/** The twelve printed rows of Form 1095-A Part III / Form 8962 lines 12-23. */
const everyMonth = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]

/**
 * Independently hand-typed: how many months a year has. Deliberately NOT
 * `everyMonth.length` — a month silently dropped from that list would shorten
 * every loop below at once, and the monthly path would quietly stop reading
 * December.
 * @type {number}
 */
const expectedMonthCount = 12

/**
 * Everything Form 8962 reads. Every income figure is a 1040 line this engine
 * has ALREADY computed and is handed in rather than recomputed, so a second
 * execution cannot disagree with the first about the return it is pricing.
 *
 * `federalPovertyLineTable` and `noDependentIsRequiredToFileAnIncomeTaxReturn`
 * are the two `vnd.fjs.return_profile` fields this form added: line 4's
 * printed checkbox, and the certification line 2b needs. Both arrive as
 * `undefined`/`false` when the taxpayer did not state them, and this module
 * REFUSES rather than assuming either.
 * @typedef {{
 *   readonly status: IndividualFilingStatus,
 *   readonly claimedAsDependent: boolean,
 *   readonly dependentCount: number,
 *   readonly noDependentIsRequiredToFileAnIncomeTaxReturn: boolean,
 *   readonly federalPovertyLineTable: FederalPovertyLineTable | undefined,
 *   readonly adjustedGrossIncomeCents: bigint,
 *   readonly taxExemptInterestCents: bigint,
 *   readonly form2555Lines45And50Cents: bigint,
 *   readonly socialSecurityBenefitsCents: bigint,
 *   readonly taxableSocialSecurityBenefitsCents: bigint,
 *   readonly marketplaceStatements: readonly Stored<OneZeroNineFiveA>[],
 * }} Form8962Input
 */

/**
 * A completed Form 8962. Every printed line this engine fills in, carried out
 * together so a caller reads the credit and the repayment off ONE execution.
 *
 * `line28RepaymentLimitationCents` is `undefined` — never a large sentinel —
 * when household income is at or above 400% of the poverty line, because the
 * printed instruction is to leave line 28 BLANK and repay the whole of line
 * 27. A sentinel would read as a cap and would be one, the first time anybody
 * took a minimum against it.
 *
 * `path` says which of the two printed calculations ran, so a report can name
 * it and a proof can assert the line 10 test independently of the arithmetic
 * it selects.
 * @typedef {{
 *   readonly kind: 'ok',
 *   readonly line1TaxFamilySize: number,
 *   readonly line2aModifiedAdjustedGrossIncomeCents: bigint,
 *   readonly line3HouseholdIncomeCents: bigint,
 *   readonly line4FederalPovertyLineCents: bigint,
 *   readonly line5PovertyLinePercent: number,
 *   readonly line7ApplicableFigureTenThousandths: number,
 *   readonly line8aAnnualContributionCents: bigint,
 *   readonly line8bMonthlyContributionCents: bigint,
 *   readonly path: 'annual' | 'monthly',
 *   readonly line24TotalPremiumTaxCreditCents: bigint,
 *   readonly line25AdvancePaymentCents: bigint,
 *   readonly line26NetPremiumTaxCreditCents: bigint,
 *   readonly line27ExcessAdvancePaymentCents: bigint,
 *   readonly line28RepaymentLimitationCents: bigint | undefined,
 *   readonly line29ExcessAdvanceRepaymentCents: bigint,
 *   readonly sources: readonly Source[],
 * }} Form8962Result
 */

/**
 * A case this module will not compute. One string, naming the printed rule,
 * the figure or month at issue, and WHERE the amount would have gone — the
 * last of those because a refusal a reader cannot act on is a refusal that
 * teaches nothing (AGENTS.md, on the erased `${destination}` interpolation).
 * @typedef {{ readonly kind: 'error', readonly message: string }} Form8962Refusal
 */

/** @typedef {Form8962Result | Form8962Refusal} Form8962Outcome */

/**
 * Where both of this form's answers end up, quoted in every refusal so the
 * message says what was lost as well as why.
 * @type {string}
 */
const destination = 'Schedule 3 line 9 (the net premium tax credit -> 1040 line 31) and '
    + 'Schedule 2 line 1a (the excess advance repayment -> 1040 line 17)'

/**
 * One month's three columns as exact cents, with absent boxes read as zero
 * FOR ARITHMETIC ONLY — the `present` flags are what the refusals below
 * branch on, so DOC-11's "absent is absent" survives into the decisions even
 * though the sums treat a blank as nothing.
 * @typedef {{
 *   readonly month: number,
 *   readonly enrollmentPremiumCents: bigint,
 *   readonly slcspPremiumCents: bigint,
 *   readonly advancePaymentCents: bigint,
 *   readonly enrollmentPremiumPresent: boolean,
 *   readonly slcspPremiumPresent: boolean,
 * }} MonthlyAmounts
 */

/**
 * Reads one printed row out of a Form 1095-A, by month. A month with no row
 * at all reads as three zeros and two absent flags — which is exactly a
 * pre-enrolment month, and is why the twelve rows are addressed by their own
 * `month` field rather than by position.
 * @type {(statement: OneZeroNineFiveA) => (month: number) => MonthlyAmounts}
 */
const monthlyAmountsOf = statement => month => {
    const row = statement.monthlyCoverage.find(entry => entry.month === month)
    const columnA = row?.columnAEnrollmentPremiums
    const columnB = row?.columnBSlcspPremium
    const columnC = row?.columnCAdvancePaymentOfPtc
    return {
        month,
        enrollmentPremiumCents: columnA === undefined ? 0n : centsFromString(columnA),
        slcspPremiumCents: columnB === undefined ? 0n : centsFromString(columnB),
        advancePaymentCents: columnC === undefined ? 0n : centsFromString(columnC),
        enrollmentPremiumPresent: columnA !== undefined,
        slcspPremiumPresent: columnB !== undefined,
    }
}

/**
 * One {@link Source} per PRESENT Part III box, in printed order: month 1
 * columns A, B, C, then month 2, and so on. Absent boxes cite nothing
 * (DOC-11) — a blank month contributes neither an amount nor a citation.
 * @type {(statement: Stored<OneZeroNineFiveA>) => readonly Source[]}
 */
const partThreeSources = statement => everyMonth.flatMap(month => {
    const row = statement.value.monthlyCoverage.find(entry => entry.month === month)
    if (row === undefined) {
        return []
    }
    /** @type {readonly (readonly [string, string | undefined])[]} */
    const columns = [
        ['columnAEnrollmentPremiums', row.columnAEnrollmentPremiums],
        ['columnBSlcspPremium', row.columnBSlcspPremium],
        ['columnCAdvancePaymentOfPtc', row.columnCAdvancePaymentOfPtc],
    ]
    return columns.flatMap(([column, value]) => value === undefined
        ? []
        : [{
            documentHash: statement.documentHash,
            boxPath: `monthlyCoverage[month=${month}].${column}`,
            value,
        }])
})

/**
 * Form 8962 line 4: the federal poverty line for this tax family size, from
 * whichever of i8962's Tables 1-1, 1-2 and 1-3 the taxpayer declared.
 *
 * The printed tables stop at family size 8 and continue by footnote — "add
 * $5,380 for each additional person" — which is the same arithmetic the eight
 * rows already are, so this is one expression rather than a table lookup with
 * a special case above it. `fjs/tax/params`' own proof is what pins the pair
 * against all twenty-four printed rows and all three footnote examples.
 * @type {(taxParamSet: TaxParamSet) => (table: FederalPovertyLineTable) => (familySize: number) => bigint}
 */
export const federalPovertyLineCents = taxParamSet => table => familySize => {
    const entry = taxParamSet.federalPovertyLine[table]
    return centsFromString(entry.firstPerson.amount)
        + centsFromString(entry.eachAdditionalPerson.amount) * BigInt(familySize - 1)
}

/**
 * Form 8962 line 5, via i8962 Worksheet 2: household income as a whole
 * percent of the federal poverty line.
 *
 * **Truncated, never rounded** — the worksheet's own words are *"Do not
 * round; instead, multiply this number by 100 ... and then drop any numbers
 * after the decimal point. For example, for 0.9984, enter the result as 99;
 * for 1.8565, enter the result as 185; and for 3.997, enter the result as
 * 399."* Rounding instead of truncating would move a household one percentage
 * point up the applicable-figure table, and at the 200/300/400 boundaries it
 * would move it a whole repayment-limitation band.
 *
 * **Capped at 401**, also the worksheet's: if household income exceeds four
 * times the poverty line, enter 401 rather than the true percentage. 401 and
 * 4,010 select the same applicable figure and the same (absent) repayment
 * limitation, so the cap is faithful as well as printed.
 * @type {(householdIncomeCents: bigint) => (povertyLineCents: bigint) => number}
 */
export const povertyLinePercent = householdIncomeCents => povertyLineCents => {
    assert(povertyLineCents > 0n, 'the federal poverty line is a positive amount for every family size')
    return householdIncomeCents > povertyLineCents * 4n
        ? 401
        : Number(householdIncomeCents * 100n / povertyLineCents)
}

/**
 * Form 8962 line 7: the applicable figure, in TEN-THOUSANDTHS — the printed
 * Table 2 column carries four decimal places, so `850` here is the printed
 * `0.0850`.
 *
 * §36B(b)(3)(A)(i)'s sliding scale, interpolated linearly across whichever of
 * the six stored tiers contains the percentage and rounded HALF-UP to four
 * decimals. That reproduces every one of Table 2's 252 printed rows exactly;
 * this module's proof re-runs a hand-typed sample of those printed rows,
 * including all six tier boundaries, against this function.
 *
 * A tier's stored percentages are in hundredths of a percentage point, which
 * are numerically the same as ten-thousandths of a fraction (0.01% = 0.0001),
 * so no scaling happens here. Said out loud because a reader who assumed a
 * conversion was missing would "fix" it by a factor of a hundred.
 * @type {(taxParamSet: TaxParamSet) => (percent: number) => number}
 */
export const applicableFigureTenThousandths = taxParamSet => percent => {
    const tier = taxParamSet.premiumTaxCreditApplicablePercentage.tiers.find(
        candidate => percent >= candidate.floorPercent
            && (candidate.ceilingPercent === undefined || percent < candidate.ceilingPercent))
    assert(
        tier !== undefined,
        ['§36B(b)(3)(A)(iii)’s tiers cover every percentage from zero upwards', percent])
    if (tier === undefined) {
        throw ['no applicable-percentage tier', percent]
    }
    const ceiling = tier.ceilingPercent
    if (ceiling === undefined || tier.initialHundredthsOfPercent === tier.finalHundredthsOfPercent) {
        return tier.initialHundredthsOfPercent
    }
    const rise = BigInt(tier.finalHundredthsOfPercent - tier.initialHundredthsOfPercent)
    const run = BigInt(ceiling - tier.floorPercent)
    const along = BigInt(percent - tier.floorPercent)
    return tier.initialHundredthsOfPercent + Number(halfUp(of(rise * along)(run)))
}

/**
 * Rounds a cents amount to the nearest WHOLE DOLLAR, half up, and returns it
 * in cents — the rounding lines 8a and 8b both call for ("Round to nearest
 * whole dollar amount", printed on the form's own face).
 * @type {(cents: bigint) => bigint}
 */
const toWholeDollarCents = cents => halfUp(of(cents)(100n)) * 100n

/**
 * Form 8962 line 10's own test, computed from the transcribed rows: may the
 * ANNUAL calculation on line 11 be used?
 *
 * i8962 p14 — "Check 'Yes' and continue to line 11 if all of the following
 * apply ... You were enrolled in the qualified health plan for all 12 months
 * during 2025 ... Your enrollment premium was the same for every month ...
 * Your SLCSP premium is the same for every month". And, above it: "If you
 * were enrolled in a qualified health plan for fewer than 12 months during
 * 2025, check 'No'."
 *
 * Compared as CENTS rather than as the stored strings, so a `'900.00'` beside
 * a `'900.0'` is one premium rather than two — the exactness check the dialect
 * already ran is about magnitude, not about spelling.
 * @type {(months: readonly MonthlyAmounts[]) => boolean}
 */
export const annualCalculationApplies = months => {
    const first = months[0]
    if (first === undefined || months.length !== expectedMonthCount) {
        return false
    }
    return months.every(month =>
        month.enrollmentPremiumPresent
        && month.slcspPremiumPresent
        && month.enrollmentPremiumCents === first.enrollmentPremiumCents
        && month.slcspPremiumCents === first.slcspPremiumCents)
}

/**
 * Form 8962 line 28: the repayment limitation, or `undefined` when there is
 * none.
 *
 * `undefined` at and above 400% of the poverty line is the printed
 * instruction, not a missing case — i8962 line 28: *"If your entry on Form
 * 8962, line 5, is 400 or more, there is no repayment limitation. You must
 * repay the amount shown on line 27."* The caller must therefore treat
 * `undefined` as "no cap", never as zero.
 *
 * Only `single` reads the left column. Rev. Proc. 2024-40 §2.07 spells it as
 * "unmarried individuals (other than surviving spouses and heads of
 * household)", so head of household and qualifying surviving spouse take the
 * larger figure — the OPPOSITE of `additionalMedicareTaxThreshold`'s
 * treatment of the same statuses.
 * @type {(taxParamSet: TaxParamSet) => (status: IndividualFilingStatus) => (percent: number) => bigint | undefined}
 */
export const repaymentLimitationCents = taxParamSet => status => percent => {
    const band = taxParamSet.premiumTaxCreditRepaymentLimitation.bands.find(
        candidate => percent < candidate.povertyLinePercentCeiling)
    return band === undefined
        ? undefined
        : centsFromString(status === 'single' ? band.single : band.other)
}

/**
 * Computes Form 8962 for a return that holds at least one Form 1095-A.
 *
 * **Called only when a Form 1095-A is stored.** A return with none has no
 * premium tax credit to reconcile and no advance payment to repay, and
 * `fjs/form1040/core` produces its two profile-declared zeros without ever
 * reaching this function — which is what keeps an ordinary return's report
 * byte-for-byte what it was before this form existed.
 * @type {(taxParamSet: TaxParamSet) => (input: Form8962Input) => Form8962Outcome}
 */
export const form8962 = taxParamSet => input => {
    const {
        status, claimedAsDependent, dependentCount,
        noDependentIsRequiredToFileAnIncomeTaxReturn, federalPovertyLineTable,
        adjustedGrossIncomeCents, taxExemptInterestCents,
        form2555Lines45And50Cents,
        socialSecurityBenefitsCents, taxableSocialSecurityBenefitsCents,
        marketplaceStatements,
    } = input
    const first = marketplaceStatements[0]
    assert(
        first !== undefined,
        'form8962 is called only for a return holding a Form 1095-A; see its own docstring')
    if (first === undefined) {
        throw 'form8962 requires at least one Form 1095-A'
    }
    // R1 — i8962's rules for combining several Forms 1095-A are per-situation
    // and contradictory across situations: for two policies in the SAME state
    // the column B premium is taken from ONE form and NOT added, while for
    // policies in different states the column B premiums ARE added. Nothing
    // stored distinguishes the two, and the two answers differ by the whole of
    // a second SLCSP premium.
    if (marketplaceStatements.length > 1) {
        const policies = marketplaceStatements
            .map(statement => statement.value.marketplaceAssignedPolicyNumber)
            .join(', ')
        return {
            kind: 'error',
            message: `Form 8962: ${marketplaceStatements.length} Forms 1095-A are stored `
                + `(policies ${policies}) and this engine computes one. The instructions combine `
                + `several forms DIFFERENTLY depending on whether the policies were in the same `
                + `state (take column B from one form only, do not add) or in different states `
                + `(add the column B amounts), and no stored field says which. Refusing rather `
                + `than guessing, because the two readings differ by a whole second `
                + `second-lowest-cost-silver-plan premium. Nothing reaches ${destination}`,
        }
    }
    const statement = first
    // R5 — f1095a p2, VOID box: "That Form 1095-A was sent in error. You
    // shouldn't have received a Form 1095-A for this policy. Don't use the
    // information on this or the previously received Form 1095-A to figure
    // your premium tax credit on Form 8962."
    if (statement.value.voidBox === true) {
        return {
            kind: 'error',
            message: `Form 8962: the stored Form 1095-A for policy `
                + `${statement.value.marketplaceAssignedPolicyNumber} has its VOID box checked, `
                + `and a VOID statement was sent in error — the printed instructions say not to `
                + `use it, or the one it voids, to figure the premium tax credit. Refusing `
                + `rather than computing from a withdrawn document. Nothing reaches ${destination}`,
        }
    }
    // R2 — §36B(c)(1)(C): a married taxpayer filing separately is not an
    // applicable taxpayer. Form 8962's line A is the exception, and BOTH of
    // its grounds (domestic abuse, spousal abandonment) are certifications no
    // information return reports. Refusing rather than either denying the
    // credit outright or granting it: the two are thousands of dollars apart
    // and the fact that decides between them is not stored.
    if (status === 'marriedFilingSeparately') {
        return {
            kind: 'error',
            message: 'Form 8962: this return files married filing separately, and §36B(c)(1)(C) '
                + 'makes such a filer an applicable taxpayer only under Form 8962 line A’s '
                + 'exception for a victim of domestic abuse or spousal abandonment. That '
                + 'certification is not on any document this engine holds, and the two answers '
                + 'differ by the entire credit: without the exception the whole advance payment '
                + 'is repaid (subject to the Table 5 limitation, applied separately to each '
                + `spouse); with it the credit is computed normally. Refusing. Nothing reaches ${destination}`,
        }
    }
    // R11 — a filer someone else can claim as a dependent. i8962's line 1
    // drops that filer (or spouse) from the tax family size, and this repo's
    // profile carries ONE flag for 1040 line 12a's TWO checkboxes, so a joint
    // return cannot say which of the two it means. A tax family size that is
    // wrong by one moves the poverty line by a whole increment.
    if (claimedAsDependent) {
        return {
            kind: 'error',
            message: 'Form 8962: this return states that someone can claim the filer (or the '
                + 'filer’s spouse) as a dependent, and Form 8962 line 1 then excludes that '
                + 'person from the tax family size. `claimedAsDependent` is ONE profile flag '
                + 'standing for 1040 line 12a’s TWO checkboxes, so it cannot say which '
                + 'person is excluded on a joint return, and a family size wrong by one moves '
                + `the federal poverty line by a whole per-person increment. Refusing. Nothing reaches ${destination}`,
        }
    }
    // R4 — Form 8962 line 2b. The dependents whose modified AGI joins
    // household income are precisely those "required to file an income tax
    // return because their income meets the income tax return filing
    // threshold", and no dialect here records a dependent's income at all.
    if (dependentCount > 0 && !noDependentIsRequiredToFileAnIncomeTaxReturn) {
        return {
            kind: 'error',
            message: `Form 8962 line 2b: this return claims ${dependentCount} dependent(s), and `
                + `household income includes the combined modified AGI of every dependent who is `
                + `REQUIRED to file an income tax return. No document this engine holds reports a `
                + `dependent’s income. Declare noDependentIsRequiredToFileAnIncomeTaxReturn `
                + `on the return profile to certify that none of them meets the filing threshold, `
                + `or the credit cannot be computed. Refusing rather than treating line 2b as `
                + `zero, which would overstate the credit for anyone whose dependent works. `
                + `Nothing reaches ${destination}`,
        }
    }
    // R3 — Form 8962 line 4's own printed checkbox. Alaska's poverty line is
    // 25% above the contiguous states' and Hawaii's is 15% above, so guessing
    // the commonest one would understate the credit for the two states where
    // Marketplace premiums are highest.
    if (federalPovertyLineTable === undefined) {
        return {
            kind: 'error',
            message: 'Form 8962 line 4: which federal poverty line table applies is a printed '
                + 'checkbox on the form (Alaska, Hawaii, or the other 48 states and DC) and this '
                + 'return profile does not state it. The three tables differ by up to 25% at the '
                + 'same family size, which moves line 5 and therefore the applicable figure. '
                + 'Declare federalPovertyLineTable on the return profile. Note that a filer who '
                + 'moved during the year, or a joint filer whose spouses lived in different '
                + 'states, uses the table with the HIGHER amounts. Refusing rather than assuming '
                + `the contiguous 48. Nothing reaches ${destination}`,
        }
    }
    // Line 1 — you, your spouse if filing jointly, and your dependents.
    const line1TaxFamilySize = 1 + (status === 'marriedFilingJointly' ? 1 : 0) + dependentCount
    // R6 — Part II lists exactly the individuals the taxpayer certified would
    // be in the tax family. MORE covered individuals than the tax family means
    // the policy covers somebody outside it, which is Form 8962 line 9's
    // "allocating policy amounts" and sends the taxpayer to Part IV. FEWER is
    // ordinary and is NOT refused: a family member on employer coverage is
    // simply not on this policy, and column B is already the coverage
    // family's premium.
    if (statement.value.coveredIndividuals.length > line1TaxFamilySize) {
        return {
            kind: 'error',
            message: `Form 8962 line 9: the stored Form 1095-A covers `
                + `${statement.value.coveredIndividuals.length} individuals while this return’s `
                + `tax family size is ${line1TaxFamilySize}, so the policy covers someone outside `
                + `the tax family and the enrollment premiums, the SLCSP premium and the advance `
                + `payments must be ALLOCATED between two tax families on Part IV. This engine `
                + `does not model Part IV, and an unallocated computation would claim another `
                + `household’s premiums. Refusing. Nothing reaches ${destination}`,
        }
    }
    // Line 2a — i8962 Worksheet 1-1. **Form 2555 lines 45 and 50 are a LIVE
    // TERM as of TAX-42**, and this comment is where they stopped being a
    // structural zero. The add-back is why excluding foreign earned income
    // does not buy a larger premium tax credit: §36B(d)(2)(B)(ii) puts
    // "any amount excluded from gross income under section 911" back into
    // modified adjusted gross income by name.
    //
    // **It is not a circularity.** Nothing on Form 2555 reads the premium tax
    // credit — lines 27 through 50 read foreign earned income, qualifying
    // days, housing expenses and deductions allocable to excluded income, and
    // §36B appears nowhere on that form or in its instructions. The edge runs
    // one way, unlike Rev. Proc. 2014-41 §2.05's genuine §162(l) cycle, which
    // `fjs/schedule/1` refuses for exactly the reason this one does not need
    // to. See `fjs/form2555/todo/foreign-earned-income.md` §5a.
    //
    // A form-level proof here cannot see the wiring that supplies it;
    // `fjs/form1040/core`'s
    // `theForeignEarnedIncomeExclusionAddsBackIntoHouseholdIncome` is where
    // that is proven. The nontaxable Social Security add-back is
    // floored at zero because worksheet line 4 is conditional — "If line 6a is
    // more than line 6b, subtract line 6b from line 6a" — and 6b can never
    // exceed 6a in practice, but a negative add-back would be a subtraction
    // the worksheet never authorises.
    const nontaxableSocialSecurityCents
        = socialSecurityBenefitsCents > taxableSocialSecurityBenefitsCents
            ? socialSecurityBenefitsCents - taxableSocialSecurityBenefitsCents
            : 0n
    const line2aModifiedAdjustedGrossIncomeCents
        = adjustedGrossIncomeCents + taxExemptInterestCents + form2555Lines45And50Cents
        + nontaxableSocialSecurityCents
    // Line 3 — "Combine them even if one or both of them are negative. If the
    // total is less than zero, enter -0-." Line 2b is zero under the
    // certification checked above.
    const line3HouseholdIncomeCents = line2aModifiedAdjustedGrossIncomeCents > 0n
        ? line2aModifiedAdjustedGrossIncomeCents
        : 0n
    const line4FederalPovertyLineCents
        = federalPovertyLineCents(taxParamSet)(federalPovertyLineTable)(line1TaxFamilySize)
    const line5PovertyLinePercent
        = povertyLinePercent(line3HouseholdIncomeCents)(line4FederalPovertyLineCents)
    // R9 — §36B(c)(1)(A) makes an applicable taxpayer one whose household
    // income is between 100% and 400% of the poverty line, and ARPA removed
    // only the upper bound. Below 100% the credit survives only through
    // i8962's two escapes: the Marketplace's own enrollment-time estimate that
    // income WOULD be at least 100%, or lawful presence together with Medicaid
    // ineligibility on immigration grounds. Neither is on any stored document,
    // and the difference between them is the whole credit against the whole
    // advance repaid.
    if (line5PovertyLinePercent < 100) {
        return {
            kind: 'error',
            message: `Form 8962 line 5: household income of `
                + `${centsToString(line3HouseholdIncomeCents)} is `
                + `${line5PovertyLinePercent}% of the `
                + `${centsToString(line4FederalPovertyLineCents)} federal poverty line for a tax `
                + `family of ${line1TaxFamilySize}, which is below 100%. §36B(c)(1)(A) then `
                + `allows the credit only if the Marketplace estimated at enrollment that income `
                + `would reach 100%, or if an enrolled individual is lawfully present and `
                + `ineligible for Medicaid because of immigration status. Neither fact is on any `
                + `document this engine holds, and without one the entire advance payment is `
                + `repaid instead. Refusing. Nothing reaches ${destination}`,
        }
    }
    const line7ApplicableFigureTenThousandths
        = applicableFigureTenThousandths(taxParamSet)(line5PovertyLinePercent)
    // Line 8a — "Multiply line 3 by line 7 ... rounded to the nearest whole
    // dollar amount." The figure is in ten-thousandths, so the product is
    // divided by 10,000 before the dollar rounding.
    const line8aAnnualContributionCents = toWholeDollarCents(
        halfUp(of(line3HouseholdIncomeCents * BigInt(line7ApplicableFigureTenThousandths))(10000n)))
    // Line 8b — "Divide line 8a by 12.0 ... rounded to the nearest whole
    // dollar amount." Twelve of these is NOT line 8a, which is exactly why
    // both paths exist.
    const line8bMonthlyContributionCents = toWholeDollarCents(
        halfUp(of(line8aAnnualContributionCents)(12n)))
    const months = everyMonth.map(monthlyAmountsOf(statement.value))
    for (const month of months) {
        // R7 — the SLCSP lookup. A month with enrollment premiums but no
        // column B is the case i8962 sends to Pub. 974 / HealthCare.gov's Tax
        // Tool. A zero here would set column (d) to zero and wipe out that
        // month's entire credit without anything saying so.
        if (month.enrollmentPremiumCents > 0n && month.slcspPremiumCents <= 0n) {
            return {
                kind: 'error',
                message: `Form 8962 line ${11 + month.month} column (b): month ${month.month} of `
                    + `the stored Form 1095-A reports `
                    + `${centsToString(month.enrollmentPremiumCents)} of enrollment premiums in `
                    + `column A and no second-lowest-cost silver plan premium in column B. The `
                    + `applicable SLCSP premium must then be looked up in Pub. 974 or at `
                    + `HealthCare.gov/Tax-Tool/, which this engine cannot do, and treating it as `
                    + `zero would silently zero that month’s entire credit. Refusing. `
                    + `Nothing reaches ${destination}`,
            }
        }
        // R8 — f1095a p2, column C: an advance payment beside a blank column A
        // means the insurer terminated the policy for non-payment. Whether any
        // credit is allowed for the month then turns on whether the premiums
        // were paid by the return's due date, which no stored document says —
        // and the advance must be reconciled either way.
        if (month.advancePaymentCents > 0n && month.enrollmentPremiumCents <= 0n) {
            return {
                kind: 'error',
                message: `Form 8962 line ${11 + month.month} column (a): month ${month.month} of `
                    + `the stored Form 1095-A reports `
                    + `${centsToString(month.advancePaymentCents)} of advance premium tax credit `
                    + `in column C and no enrollment premium in column A, which means the policy `
                    + `was terminated for non-payment that month. Whether a credit is allowed `
                    + `then depends on whether the premiums were paid by the due date of this `
                    + `return, a fact no document this engine holds reports, while the advance `
                    + `payment must be reconciled either way. Refusing. Nothing reaches ${destination}`,
            }
        }
    }
    const path = annualCalculationApplies(months) ? 'annual' : 'monthly'
    // Line 11 (annual) or lines 12-23 (monthly). Columns (c), (d) and (e) in
    // both: (c) is the contribution amount, (d) = max(b - c, 0), and (e) =
    // min(a, d). What differs is (c) — line 8a once, or line 8b twelve times —
    // and whether the (a)/(d) cap is taken once or per month.
    /** @type {(a: bigint) => (b: bigint) => (c: bigint) => bigint} */
    const allowedCredit = a => b => c => {
        const d = b > c ? b - c : 0n
        return a < d ? a : d
    }
    const annualEnrollmentPremiumCents = months.reduce(
        (total, month) => total + month.enrollmentPremiumCents, 0n)
    const annualSlcspPremiumCents = months.reduce(
        (total, month) => total + month.slcspPremiumCents, 0n)
    const line24TotalPremiumTaxCreditCents = path === 'annual'
        ? allowedCredit(annualEnrollmentPremiumCents)(annualSlcspPremiumCents)(
            line8aAnnualContributionCents)
        : months.reduce(
            (total, month) => {
                // "If columns (a) and (b) of any of lines 12 through 23 are
                // blank, leave column (c) of the corresponding line blank" —
                // an uncovered month contributes nothing.
                //
                // **This guard is an EQUIVALENT MUTANT, and the property is
                // written down rather than left to be rediscovered.**
                // Deleting it cannot turn the suite red at any input, because
                // `allowedCredit` already returns zero for a blank month: `d`
                // is `max(b - c, 0)`, which is zero when `b` is zero, and `e`
                // is `min(a, d)`, which is zero when `a` is zero. The printed
                // instruction is transcribed anyway, because a reader
                // comparing this code against the form should find every
                // printed sentence in it, and because the two operations that
                // absorb it are one refactor away from not absorbing it.
                //
                // Verified by mutation, and the first attempt at this note
                // was WRONG in a way worth keeping: removing this `if` left
                // the suite green, and so did removing `max(b - c, 0)`'s
                // floor — because the skip meant no fixture ever reached
                // `allowedCredit` with a column (b) below column (c). **Two
                // guards, each unobservable while the other stands.** The
                // leaf that separates them is
                // `aMonthWhoseSlcspPremiumIsBelowTheContributionContributesZeroNotANegative`,
                // which reaches the floor with the skip in place; with it, the
                // floor mutation bites and this `if` is confirmed as the
                // genuinely redundant one.
                if (month.enrollmentPremiumCents <= 0n && month.slcspPremiumCents <= 0n) {
                    return total
                }
                return total + allowedCredit(month.enrollmentPremiumCents)(month.slcspPremiumCents)(
                    line8bMonthlyContributionCents)
            },
            0n)
    // Line 25 is the same figure on both paths — column (f) is transcribed,
    // never computed — but it is summed here rather than read off line 33 so
    // that it comes from the SAME twelve rows the credit did.
    const line25AdvancePaymentCents = months.reduce(
        (total, month) => total + month.advancePaymentCents, 0n)
    // Lines 26 through 29. Exactly one of line 26 and line 29 is ever
    // non-zero; when the two totals are equal, both are.
    const line26NetPremiumTaxCreditCents
        = line24TotalPremiumTaxCreditCents > line25AdvancePaymentCents
            ? line24TotalPremiumTaxCreditCents - line25AdvancePaymentCents
            : 0n
    const line27ExcessAdvancePaymentCents
        = line25AdvancePaymentCents > line24TotalPremiumTaxCreditCents
            ? line25AdvancePaymentCents - line24TotalPremiumTaxCreditCents
            : 0n
    const line28RepaymentLimitationCents
        = repaymentLimitationCents(taxParamSet)(status)(line5PovertyLinePercent)
    // Line 29 — "Enter the smaller of line 27 or line 28. If line 28 is blank,
    // enter the amount from line 27 on line 29." `undefined` is NOT zero here,
    // and reading it as one would forgive the entire repayment for every
    // household at or above 400% of the poverty line, which is precisely the
    // population with the largest excess.
    const line29ExcessAdvanceRepaymentCents = line28RepaymentLimitationCents === undefined
        ? line27ExcessAdvancePaymentCents
        : (line27ExcessAdvancePaymentCents < line28RepaymentLimitationCents
            ? line27ExcessAdvancePaymentCents
            : line28RepaymentLimitationCents)
    return {
        kind: 'ok',
        line1TaxFamilySize,
        line2aModifiedAdjustedGrossIncomeCents,
        line3HouseholdIncomeCents,
        line4FederalPovertyLineCents,
        line5PovertyLinePercent,
        line7ApplicableFigureTenThousandths,
        line8aAnnualContributionCents,
        line8bMonthlyContributionCents,
        path,
        line24TotalPremiumTaxCreditCents,
        line25AdvancePaymentCents,
        line26NetPremiumTaxCreditCents,
        line27ExcessAdvancePaymentCents,
        line28RepaymentLimitationCents,
        line29ExcessAdvanceRepaymentCents,
        sources: partThreeSources(statement),
    }
}

// ── Tests ────────────────────────────────────────────────────────────────────

const taxParams2025 = taxParamsByYear[2025]
assert(taxParams2025 !== undefined, 'expected TY2025 parameters to be present in taxParamsByYear')
if (taxParams2025 === undefined) {
    throw 'expected TY2025 parameters'
}

/** @type {(statement: OneZeroNineFiveA) => Stored<OneZeroNineFiveA>} */
const stored = statement => ({ documentHash: 'sha256-1095a-01', value: statement })

/**
 * A Form 1095-A carrying twelve identical rows — the shape Form 8962 line 10
 * answers "Yes" to.
 * @type {(columnA: string) => (columnB: string) => (columnC: string) => OneZeroNineFiveA}
 */
const uniformStatement = columnA => columnB => columnC => ({
    dialect: 'vnd.fjs.1095a',
    marketplaceIdentifier: '99',
    marketplaceAssignedPolicyNumber: 'POLICY-0001',
    policyIssuerName: 'Some Health Plan, Inc.',
    recipientTin: '222-22-2222',
    taxYear: 2025,
    formRevision: '2025',
    sourceArtifactHash: 'deadbeef00112233445566778899aabbccddeeff0011223344556677889900',
    coveredIndividuals: [{ name: 'Some Person' }],
    monthlyCoverage: everyMonth.map(month => ({
        month,
        columnAEnrollmentPremiums: columnA,
        columnBSlcspPremium: columnB,
        columnCAdvancePaymentOfPtc: columnC,
    })),
})

/**
 * A single filer with no dependents, in the contiguous 48, whose only income
 * is adjusted gross income — the base every leaf below varies one fact of.
 * @type {(agi: string) => (statement: OneZeroNineFiveA) => Form8962Input}
 */
const singleFilerWith = agi => statement => ({
    status: 'single',
    claimedAsDependent: false,
    dependentCount: 0,
    noDependentIsRequiredToFileAnIncomeTaxReturn: false,
    federalPovertyLineTable: 'contiguous48AndDistrictOfColumbia',
    adjustedGrossIncomeCents: centsFromString(agi),
    taxExemptInterestCents: 0n,
    form2555Lines45And50Cents: 0n,
    socialSecurityBenefitsCents: 0n,
    taxableSocialSecurityBenefitsCents: 0n,
    marketplaceStatements: [stored(statement)],
})

/** @type {(outcome: Form8962Outcome) => Form8962Result} */
const expectOk = outcome => {
    assert(outcome.kind === 'ok', ['expected Form 8962 to compute, not refuse', outcome])
    if (outcome.kind !== 'ok') {
        throw ['expected ok', outcome]
    }
    return outcome
}

/** @type {(outcome: Form8962Outcome) => string} */
const expectRefusal = outcome => {
    assert(outcome.kind === 'error', ['expected Form 8962 to refuse', outcome])
    if (outcome.kind !== 'error') {
        throw ['expected error', outcome]
    }
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
        message.includes('Schedule 3 line 9') && message.includes('Schedule 2 line 1a'),
        ['a refusal must name both lines the amount would have reached', message])
    assert(
        message.includes('1040 line 31') && message.includes('1040 line 17'),
        ['and both 1040 lines those schedules feed', message])
}

export const proof = {
    // ── Table 2, from the printed page ──────────────────────────────────────
    //
    // Twenty-one hand-typed rows of i8962's applicable-figure table, INCLUDING
    // every tier boundary and both rows on each side of it. These are read off
    // the printed table, never produced by the interpolation under test.
    applicableFigure: {
        theHandTypedPrintedRows: () => {
            /** @type {readonly (readonly [number, number])[]} */
            const printed = [
                [0, 0], [99, 0], [149, 0], [150, 0], [151, 4], [152, 8],
                [175, 100], [199, 196], [200, 200], [201, 204],
                [225, 300], [249, 396], [250, 400], [251, 404],
                [275, 500], [299, 596], [300, 600], [301, 603], [302, 605], [303, 608],
                [350, 725], [399, 848], [400, 850], [401, 850],
            ]
            assertEq(printed.length, 24, 'the hand-typed sample of Table 2 has twenty-four rows')
            for (const row of printed) {
                const [percent, expected] = row
                assertEq(
                    applicableFigureTenThousandths(taxParams2025)(percent),
                    expected,
                    [
                        'i8962 Table 2 prints this applicable figure for this line 5 percentage',
                        percent,
                        expected,
                    ])
            }
        },
        // The half-up rounding is observable ONLY in the 300-400 tier, where
        // the slope is 0.00025 per point and every odd step lands on a half.
        // Truncating instead would print 0.0603 as 0.0602.
        theThreeHundredTierRoundsHalfUp: () => {
            assertEq(
                applicableFigureTenThousandths(taxParams2025)(301),
                603,
                '600 + 25/10 = 602.5, and i8962 prints 0.0603 — rounded up, not truncated')
            assertEq(
                applicableFigureTenThousandths(taxParams2025)(303),
                608,
                '600 + 75/10 = 607.5, and i8962 prints 0.0608')
        },
        // The figure is MONOTONIC across the whole printed range: it never
        // falls as income rises. A tier read one row off, or two tiers
        // transposed, breaks this without breaking any single hand-typed row
        // outside the transposed pair.
        theFigureNeverFallsAsIncomeRises: () => {
            let previous = -1
            for (let percent = 0; percent <= 401; ++percent) {
                const figure = applicableFigureTenThousandths(taxParams2025)(percent)
                assert(
                    figure >= previous,
                    ['the applicable figure is non-decreasing in household income', percent, figure])
                previous = figure
            }
            assertEq(previous, 850, 'and it finishes at 8.50%')
        },
    },
    // ── Line 5, i8962 Worksheet 2 ───────────────────────────────────────────
    povertyLinePercent: {
        // The worksheet's OWN three worked examples: "for 0.9984, enter the
        // result as 99; for 1.8565, enter the result as 185; and for 3.997,
        // enter the result as 399". Constructed against a $10,000.00 poverty
        // line so the ratio is the household income with the decimal moved.
        theWorksheetsOwnThreeExamples: () => {
            const povertyLine = 1000000n
            assertEq(povertyLinePercent(998400n)(povertyLine), 99, '0.9984 -> 99, not 100')
            assertEq(povertyLinePercent(1856500n)(povertyLine), 185, '1.8565 -> 185')
            assertEq(povertyLinePercent(3997000n)(povertyLine), 399, '3.997 -> 399, not 400')
        },
        // Truncation, not rounding, at the boundary that costs the most: one
        // cent below 400% must still read 399, because 399 has a repayment
        // limitation and 400 has none.
        theBoundaryAtFourHundredPercentTruncates: () => {
            const povertyLine = 1000000n
            assertEq(povertyLinePercent(3999999n)(povertyLine), 399, '399.9999% is 399')
            assertEq(povertyLinePercent(4000000n)(povertyLine), 400, 'exactly 400% is 400')
            assertEq(
                povertyLinePercent(4000001n)(povertyLine),
                401,
                'one cent over four times the poverty line is the worksheet’s 401 cap')
        },
        // The 401 cap is a CAP: ten times the poverty line reads the same as
        // one cent over four times it.
        theCapIsFlat: () => {
            assertEq(povertyLinePercent(10000000n)(1000000n), 401)
        },
    },
    federalPovertyLine: {
        // The three tables produce three different answers for the same family
        // size — the property a single shared table would silently destroy.
        theThreeTablesDisagreeForTheSameFamilySize: () => {
            const of4 = /** @type {(table: FederalPovertyLineTable) => bigint} */ (
                table => federalPovertyLineCents(taxParams2025)(table)(4))
            assertEq(of4('contiguous48AndDistrictOfColumbia'), 3120000n, '$31,200.00 — i8962 Table 1-1')
            assertEq(of4('alaska'), 3900000n, '$39,000.00 — i8962 Table 1-2')
            assertEq(of4('hawaii'), 3588000n, '$35,880.00 — i8962 Table 1-3')
        },
        aFamilyOfOneIsTheFirstPersonAmountAlone: () => {
            assertEq(
                federalPovertyLineCents(taxParams2025)('contiguous48AndDistrictOfColumbia')(1),
                1506000n,
                '$15,060.00 with no increment added')
        },
    },
    repaymentLimitation: {
        // Every printed cell of Table 5, hand-typed, plus the blank fourth
        // row. Two statuses per band because the columns differ.
        everyPrintedCell: () => {
            const cap = /** @type {(status: IndividualFilingStatus) => (percent: number) => bigint | undefined} */ (
                status => percent => repaymentLimitationCents(taxParams2025)(status)(percent))
            assertEq(cap('single')(100), 37500n, '$375 below 200%')
            assertEq(cap('marriedFilingJointly')(100), 75000n, '$750 below 200%')
            assertEq(cap('single')(199), 37500n, '$375 at 199%')
            assertEq(cap('single')(200), 97500n, '$975 at 200%')
            assertEq(cap('marriedFilingJointly')(200), 195000n, '$1,950 at 200%')
            assertEq(cap('single')(299), 97500n, '$975 at 299%')
            assertEq(cap('single')(300), 162500n, '$1,625 at 300%')
            assertEq(cap('marriedFilingJointly')(300), 325000n, '$3,250 at 300%')
            assertEq(cap('single')(399), 162500n, '$1,625 at 399%')
        },
        // The whole risk of this table: at 400 there is NO limitation, and
        // `undefined` is what says so. A zero would forgive the repayment
        // entirely; a large number would look like a cap and be one.
        thereIsNoLimitationAtOrAboveFourHundredPercent: () => {
            assertEq(repaymentLimitationCents(taxParams2025)('single')(400), undefined)
            assertEq(repaymentLimitationCents(taxParams2025)('marriedFilingJointly')(401), undefined)
            assertEq(repaymentLimitationCents(taxParams2025)('headOfHousehold')(400), undefined)
        },
        // Only `single` reads the left column — asserted for all five statuses
        // rather than for the two a writer would think of, because the trap is
        // qualifying surviving spouse, where §3101(b)(2) puts the SAME status
        // on the smaller figure.
        onlySingleTakesTheSmallerColumn: () => {
            assertEq(repaymentLimitationCents(taxParams2025)('single')(250), 97500n)
            for (const status of /** @type {readonly IndividualFilingStatus[]} */ ([
                'marriedFilingJointly', 'marriedFilingSeparately', 'headOfHousehold',
                'qualifyingSurvivingSpouse',
            ])) {
                assertEq(
                    repaymentLimitationCents(taxParams2025)(status)(250),
                    195000n,
                    ['Rev. Proc. 2024-40 §2.07’s "all other taxpayers" column', status])
            }
        },
    },
    // ── Form 8962 line 10: which calculation runs ───────────────────────────
    lineTenTest: {
        theTwelveMonthCount: () => {
            assertEq(everyMonth.length, expectedMonthCount, 'twelve printed rows, lines 21-32')
        },
        // i8962's own Example 2: "$800 for the enrollment premiums in column A
        // on lines 21 through 32 and $850 for the applicable SLCSP premium in
        // column B ... They check 'Yes' on Form 8962, line 10".
        uniformTwelveMonthsUsesTheAnnualPath: () => {
            const result = expectOk(form8962(taxParams2025)(
                singleFilerWith('30000.00')(uniformStatement('800.00')('850.00')('400.00'))))
            assertEq(result.path, 'annual')
        },
        // i8962's own Example 1: Lee's column B reads $900 for eleven months
        // and $650 for December. "Lee checks 'No' on line 10 and completes
        // lines 12 through 23."
        oneDifferingSlcspMonthForcesTheMonthlyPath: () => {
            const statement = uniformStatement('1000.00')('900.00')('400.00')
            const result = expectOk(form8962(taxParams2025)(singleFilerWith('30000.00')({
                ...statement,
                monthlyCoverage: statement.monthlyCoverage.map(row => row.month === 12
                    ? { ...row, columnBSlcspPremium: '650.00' }
                    : row),
            })))
            assertEq(result.path, 'monthly')
        },
        oneDifferingEnrollmentMonthForcesTheMonthlyPath: () => {
            const statement = uniformStatement('1000.00')('900.00')('400.00')
            const result = expectOk(form8962(taxParams2025)(singleFilerWith('30000.00')({
                ...statement,
                monthlyCoverage: statement.monthlyCoverage.map(row => row.month === 6
                    ? { ...row, columnAEnrollmentPremiums: '1100.00' }
                    : row),
            })))
            assertEq(result.path, 'monthly')
        },
        // "If you were enrolled in a qualified health plan for fewer than 12
        // months during 2025, check 'No'."
        elevenCoveredMonthsForcesTheMonthlyPath: () => {
            const statement = uniformStatement('1000.00')('900.00')('400.00')
            const result = expectOk(form8962(taxParams2025)(singleFilerWith('30000.00')({
                ...statement,
                monthlyCoverage: statement.monthlyCoverage.filter(row => row.month !== 1),
            })))
            assertEq(result.path, 'monthly')
        },
        // A month whose row EXISTS but whose column A is blank is not
        // enrollment. Written as a separate leaf from the missing-row one
        // because the two reach `annualCalculationApplies` by different
        // routes.
        aBlankColumnAInAPresentRowForcesTheMonthlyPath: () => {
            const statement = uniformStatement('1000.00')('900.00')('0.00')
            const rows = statement.monthlyCoverage.map(row => row.month === 4
                ? { month: 4, columnCAdvancePaymentOfPtc: '0.00' }
                : row)
            assertEq(
                annualCalculationApplies(everyMonth.map(monthlyAmountsOf({
                    ...statement,
                    monthlyCoverage: rows,
                }))),
                false)
        },
    },
    // ── The two arms, worked end to end ─────────────────────────────────────
    //
    // Every expected figure below is arithmetic done by hand from the printed
    // form and stated in the assertion message, never read back off the
    // function under test.
    annualPath: {
        /*
         * Single filer, no dependents, contiguous 48, AGI $30,000.00.
         *
         *  line 1  tax family size            1
         *  line 3  household income           $30,000.00
         *  line 4  federal poverty line       $15,060.00
         *  line 5  30000 * 100 / 15060 = 199.20...  -> 199
         *  line 7  Table 2 at 199             0.0196
         *  line 8a 30000 * 0.0196 = 588.00    -> $588
         *  line 8b 588 / 12 = 49              -> $49
         *  line 11 (a) 12 * 800 = $9,600  (b) 12 * 850 = $10,200
         *          (c) $588  (d) 10200 - 588 = $9,612  (e) min(9600, 9612) = $9,600
         *          (f) 12 * 400 = $4,800
         *  line 24 $9,600   line 25 $4,800
         *  line 26 9600 - 4800 = $4,800 -> Schedule 3 line 9
         */
        anUnderAdvancedTaxpayerIsOwedTheDifference: () => {
            const result = expectOk(form8962(taxParams2025)(
                singleFilerWith('30000.00')(uniformStatement('800.00')('850.00')('400.00'))))
            assertEq(result.line1TaxFamilySize, 1)
            assertEq(result.line3HouseholdIncomeCents, 3000000n, '$30,000.00 of household income')
            assertEq(result.line4FederalPovertyLineCents, 1506000n, '$15,060.00 poverty line')
            assertEq(result.line5PovertyLinePercent, 199, '199% — truncated from 199.20%')
            assertEq(result.line7ApplicableFigureTenThousandths, 196, '0.0196 from Table 2')
            assertEq(result.line8aAnnualContributionCents, 58800n, '$588.00 annual contribution')
            assertEq(result.line8bMonthlyContributionCents, 4900n, '$49.00 monthly contribution')
            assertEq(result.path, 'annual')
            assertEq(result.line24TotalPremiumTaxCreditCents, 960000n, '$9,600.00 of credit')
            assertEq(result.line25AdvancePaymentCents, 480000n, '$4,800.00 advanced')
            assertEq(result.line26NetPremiumTaxCreditCents, 480000n, '$4,800.00 net PTC')
            assertEq(result.line27ExcessAdvancePaymentCents, 0n, 'nothing to repay')
            assertEq(result.line29ExcessAdvanceRepaymentCents, 0n)
        },
        /*
         * The SAME return with $900.00 of advance paid every month:
         *  (f) 12 * 900 = $10,800, so line 25 $10,800 against line 24 $9,600.
         *  line 27 10800 - 9600 = $1,200
         *  line 28 line 5 is 199, below 200, single -> $375
         *  line 29 min(1200, 375) = $375 -> Schedule 2 line 1a
         */
        anOverAdvancedTaxpayerRepaysTheCappedAmount: () => {
            const result = expectOk(form8962(taxParams2025)(
                singleFilerWith('30000.00')(uniformStatement('800.00')('850.00')('900.00'))))
            assertEq(result.line24TotalPremiumTaxCreditCents, 960000n, '$9,600.00 of credit')
            assertEq(result.line25AdvancePaymentCents, 1080000n, '$10,800.00 advanced')
            assertEq(result.line26NetPremiumTaxCreditCents, 0n, 'line 26 is blank on this arm')
            assertEq(result.line27ExcessAdvancePaymentCents, 120000n, '$1,200.00 of excess advance')
            assertEq(result.line28RepaymentLimitationCents, 37500n, '$375.00 Table 5 limitation')
            assertEq(result.line29ExcessAdvanceRepaymentCents, 37500n, '$375.00 repaid, not $1,200.00')
        },
        // The two arms are MUTUALLY EXCLUSIVE, and this is what a wiring that
        // added them together would break.
        exactlyOneArmIsEverNonZero: () => {
            for (const advance of ['0.00', '400.00', '900.00', '1200.00']) {
                const result = expectOk(form8962(taxParams2025)(
                    singleFilerWith('30000.00')(uniformStatement('800.00')('850.00')(advance))))
                assert(
                    result.line26NetPremiumTaxCreditCents === 0n
                    || result.line29ExcessAdvanceRepaymentCents === 0n,
                    ['line 26 and line 29 can never both be non-zero', advance, result])
            }
        },
    },
    monthlyPath: {
        /*
         * The SAME filer as above, but enrolled only for July through
         * December (six months), $800 column A, $850 column B, $400 column C.
         *
         *  line 5/7/8a/8b are unchanged: 199, 0.0196, $588, $49.
         *  Each covered month: (d) 850 - 49 = $801, (e) min(800, 801) = $800.
         *  line 24 6 * 800 = $4,800.  line 25 6 * 400 = $2,400.
         *  line 26 4800 - 2400 = $2,400.
         *
         * Note what the ANNUAL path would have produced on the same rows had
         * it been reachable: (b) 6 * 850 = $5,100, (c) $588, (d) $4,512, (e)
         * min(4800, 4512) = $4,512 — SEVEN HUNDRED DOLLARS LESS. That gap is
         * why the line 10 test is a required dispatch rather than a shortcut.
         */
        aPartYearEnrolleeIsPricedMonthByMonth: () => {
            const statement = uniformStatement('800.00')('850.00')('400.00')
            const result = expectOk(form8962(taxParams2025)(singleFilerWith('30000.00')({
                ...statement,
                monthlyCoverage: statement.monthlyCoverage.filter(row => row.month >= 7),
            })))
            assertEq(result.path, 'monthly')
            assertEq(result.line8bMonthlyContributionCents, 4900n, '$49.00 per month')
            assertEq(result.line24TotalPremiumTaxCreditCents, 480000n, '$4,800.00 — six months of $800.00')
            assertEq(result.line25AdvancePaymentCents, 240000n, '$2,400.00 advanced')
            assertEq(result.line26NetPremiumTaxCreditCents, 240000n, '$2,400.00 net PTC')
        },
        /*
         * **A month whose SLCSP premium is BELOW the monthly contribution
         * amount contributes ZERO, never a negative** — column (d)'s printed
         * "If the result is zero or less, enter -0-".
         *
         * Added after a mutation, and the mutation is worth recording because
         * it came in a PAIR that hid each other. Removing the blank-month skip
         * left the suite green (the `max`/`min` absorb it), and removing
         * column (d)'s zero floor ALSO left the suite green — because the skip
         * meant no fixture ever reached `allowedCredit` with a column (b)
         * below column (c). Two guards, each unobservable while the other
         * stands, and no leaf in this file distinguished either.
         *
         * The case is real rather than contrived: a taxpayer at 401% of the
         * poverty line contributes $496.00 a month, and a young enrollee's
         * second-lowest-cost silver plan can easily be $400.00. They get no
         * credit — and, without the floor, they would be handed a NEGATIVE
         * one, which line 27 then turns into $1,056.00 of repayment on top of
         * an advance they never received.
         *
         *   line 8a $70,000.00 x 0.0850 = $5,950   line 8b $5,950 / 12 = $496
         *   each month (d) = max($400 - $496, 0) = $0, (e) = min($900, $0) = $0
         *   line 24 $0   line 25 11 x $100.00 = $1,100   line 27 $1,100
         */
        aMonthWhoseSlcspPremiumIsBelowTheContributionContributesZeroNotANegative: () => {
            const statement = uniformStatement('900.00')('400.00')('100.00')
            const result = expectOk(form8962(taxParams2025)(singleFilerWith('70000.00')({
                ...statement,
                monthlyCoverage: statement.monthlyCoverage.filter(row => row.month !== 1),
            })))
            assertEq(result.path, 'monthly')
            assertEq(result.line8bMonthlyContributionCents, 49600n, '$496.00 a month')
            assertEq(
                result.line24TotalPremiumTaxCreditCents,
                0n,
                'no credit at all — never a negative one')
            assertEq(result.line25AdvancePaymentCents, 110000n, '$1,100.00 advanced')
            assertEq(
                result.line27ExcessAdvancePaymentCents,
                110000n,
                '$1,100.00 repaid; a negative line 24 would make this $2,156.00')
            assertEq(
                result.line28RepaymentLimitationCents,
                undefined,
                'and at 401% of the poverty line there is no cap on it')
        },
        // An uncovered month contributes NOTHING — not a negative. Without the
        // blank-row rule, six uncovered months would each subtract the $49
        // contribution from a zero SLCSP premium.
        uncoveredMonthsContributeNothingRatherThanANegative: () => {
            const statement = uniformStatement('800.00')('850.00')('400.00')
            const withBlankRows = expectOk(form8962(taxParams2025)(singleFilerWith('30000.00')({
                ...statement,
                monthlyCoverage: statement.monthlyCoverage.map(row => row.month >= 7
                    ? row
                    : { month: row.month }),
            })))
            const withMissingRows = expectOk(form8962(taxParams2025)(singleFilerWith('30000.00')({
                ...statement,
                monthlyCoverage: statement.monthlyCoverage.filter(row => row.month >= 7),
            })))
            assertEq(
                withBlankRows.line24TotalPremiumTaxCreditCents,
                withMissingRows.line24TotalPremiumTaxCreditCents,
                'a printed blank row and an absent row are the same six covered months')
            assertEq(withBlankRows.line24TotalPremiumTaxCreditCents, 480000n, '$4,800.00')
        },
        /*
         * **The WHOLE-DOLLAR ROUNDING, on both lines, and half UP.** Added
         * because a mutation replacing `halfUp` with truncation left the
         * entire suite green: every other fixture in this file happens to
         * produce an exact number of dollars on lines 8a and 8b, so nothing
         * observed the rounding at all.
         *
         * Household income $23,350.00 is 155% of the $15,060.00 poverty line
         * (155.04%, truncated), Table 2's applicable figure at 155 is 0.0020,
         * and line 8a is $23,350.00 x 0.0020 = **$46.70 -> $47**, not $46.
         * Line 8b is $47 / 12 = **$3.9166... -> $4**, not $3.
         *
         * Eleven covered months, so the monthly path runs and line 8b is
         * observable; column A is $500.00 and column B is $400.00, so column
         * (d) = $400 - $4 = $396.00 BINDS below column (a) and the monthly
         * contribution reaches the answer. Line 24 is 11 x $396.00 =
         * $4,356.00; truncating either rounding would give 11 x $397.00 =
         * $4,367.00.
         */
        theWholeDollarRoundingOnBothLinesIsHalfUp: () => {
            const statement = uniformStatement('500.00')('400.00')('100.00')
            const result = expectOk(form8962(taxParams2025)(singleFilerWith('23350.00')({
                ...statement,
                monthlyCoverage: statement.monthlyCoverage.filter(row => row.month !== 1),
            })))
            assertEq(result.line5PovertyLinePercent, 155)
            assertEq(result.line7ApplicableFigureTenThousandths, 20, '0.0020 from Table 2')
            assertEq(
                result.line8aAnnualContributionCents,
                4700n,
                '$47.00 — $46.70 rounded UP to the nearest whole dollar, never truncated to $46.00')
            assertEq(
                result.line8bMonthlyContributionCents,
                400n,
                '$4.00 — $3.9166... rounded UP, never truncated to $3.00')
            assertEq(result.path, 'monthly')
            assertEq(
                result.line24TotalPremiumTaxCreditCents,
                435600n,
                '$4,356.00 — eleven months of $400.00 less the $4.00 contribution; '
                + 'truncating either rounding would give $4,367.00')
        },
        /*
         * The month-by-month CAP, which the annual path cannot express: a
         * single expensive month whose enrollment premium exceeds the SLCSP
         * premium is capped at its own column (a), not against the year's.
         *
         *  Twelve months of $2,000 column A and $850 column B, $0 advance.
         *  (d) 850 - 49 = $801 each month; (e) min(2000, 801) = $801.
         *  line 24 = 12 * 801 = $9,612.
         */
        eachMonthsCreditIsCappedByItsOwnPremium: () => {
            const statement = uniformStatement('2000.00')('850.00')('0.00')
            const result = expectOk(form8962(taxParams2025)(singleFilerWith('30000.00')({
                ...statement,
                // One month differs so the monthly path is selected; its own
                // arithmetic is identical to the other eleven's because the
                // cap binds on column (d) either way.
                monthlyCoverage: statement.monthlyCoverage.filter(row => row.month !== 1),
            })))
            assertEq(result.path, 'monthly')
            assertEq(
                result.line24TotalPremiumTaxCreditCents,
                881100n,
                '$8,811.00 — eleven months of $801.00, capped by column (d) rather than column (a)')
        },
    },
    // ── Above 400%: a credit, and NO repayment cap ──────────────────────────
    aboveFourHundredPercent: {
        /*
         * Single filer, AGI $70,000.00, contiguous 48, family of one.
         *  line 5  70000 * 100 / 15060 = 464.8...  -> capped at 401
         *  line 7  0.0850
         *  line 8a 70000 * 0.085 = $5,950   line 8b 5950 / 12 = 495.83 -> $496
         *  Twelve months of $900 column A, $850 column B, $600 column C.
         *  Annual: (d) 10200 - 5950 = $4,250, (e) min(10800, 4250) = $4,250.
         *  line 24 $4,250  line 25 $7,200  line 27 $2,950
         *  line 28 BLANK — and line 29 is the whole $2,950.
         */
        theRepaymentIsUncapped: () => {
            const result = expectOk(form8962(taxParams2025)(
                singleFilerWith('70000.00')(uniformStatement('900.00')('850.00')('600.00'))))
            assertEq(result.line5PovertyLinePercent, 401, 'Worksheet 2’s 401 cap')
            assertEq(result.line7ApplicableFigureTenThousandths, 850, '8.50%')
            assertEq(result.line8aAnnualContributionCents, 595000n, '$5,950.00')
            assertEq(result.line24TotalPremiumTaxCreditCents, 425000n, '$4,250.00 of credit — the cliff is repealed for 2025')
            assertEq(result.line25AdvancePaymentCents, 720000n, '$7,200.00 advanced')
            assertEq(result.line27ExcessAdvancePaymentCents, 295000n, '$2,950.00 of excess')
            assertEq(
                result.line28RepaymentLimitationCents,
                undefined,
                'line 28 is BLANK at 400% or more')
            assertEq(
                result.line29ExcessAdvanceRepaymentCents,
                295000n,
                'the WHOLE $2,950.00 is repaid — reading a blank line 28 as zero would forgive it')
        },
        // The control, one band down: the same return at 399% IS capped. Two
        // leaves rather than one, because a limitation lookup that returned
        // `undefined` for everything would pass the leaf above alone.
        theControlJustBelowFourHundredPercentIsCapped: () => {
            // $60,000.00 is 398.4% of $15,060.00.
            const result = expectOk(form8962(taxParams2025)(
                singleFilerWith('60000.00')(uniformStatement('900.00')('850.00')('900.00'))))
            assertEq(result.line5PovertyLinePercent, 398)
            assertEq(result.line28RepaymentLimitationCents, 162500n, '$1,625.00 at 398%')
            assertEq(
                result.line29ExcessAdvanceRepaymentCents,
                162500n,
                'capped at $1,625.00 rather than the full excess')
            assert(
                result.line27ExcessAdvancePaymentCents > 162500n,
                ['the cap must actually bind for this leaf to prove anything', result])
        },
    },
    // ── Household income is Form 8962's own, not the AGI ────────────────────
    householdIncome: {
        // Tax-exempt interest and the NONTAXABLE half of Social Security both
        // join household income, and dropping either understates the
        // percentage — which OVERSTATES the credit.
        taxExemptInterestAndNontaxableSocialSecurityBothJoin: () => {
            const base = singleFilerWith('30000.00')(uniformStatement('800.00')('850.00')('400.00'))
            const plain = expectOk(form8962(taxParams2025)(base))
            const withAddBacks = expectOk(form8962(taxParams2025)({
                ...base,
                taxExemptInterestCents: 500000n,
                socialSecurityBenefitsCents: 1200000n,
                taxableSocialSecurityBenefitsCents: 200000n,
            }))
            assertEq(plain.line3HouseholdIncomeCents, 3000000n, '$30,000.00 of AGI alone')
            assertEq(
                withAddBacks.line3HouseholdIncomeCents,
                4500000n,
                '$30,000.00 + $5,000.00 tax-exempt interest + $10,000.00 nontaxable Social Security')
            assertEq(withAddBacks.line5PovertyLinePercent, 298, '298% rather than 199%')
            assert(
                withAddBacks.line24TotalPremiumTaxCreditCents
                    < plain.line24TotalPremiumTaxCreditCents,
                ['a higher household income buys a smaller credit', plain, withAddBacks])
        },
        // The TAXABLE half must NOT be added twice: it is already inside AGI.
        // Observable because line 6b moves while line 6a does not.
        theTaxablePartOfSocialSecurityIsNotAddedBack: () => {
            const base = singleFilerWith('30000.00')(uniformStatement('800.00')('850.00')('400.00'))
            const all = expectOk(form8962(taxParams2025)({
                ...base, socialSecurityBenefitsCents: 1000000n, taxableSocialSecurityBenefitsCents: 0n,
            }))
            const half = expectOk(form8962(taxParams2025)({
                ...base, socialSecurityBenefitsCents: 1000000n, taxableSocialSecurityBenefitsCents: 500000n,
            }))
            assertEq(all.line3HouseholdIncomeCents, 4000000n, '$30,000.00 + the whole $10,000.00')
            assertEq(half.line3HouseholdIncomeCents, 3500000n, '$30,000.00 + the nontaxable $5,000.00')
        },
        // Line 6b can never exceed line 6a on a real return, and the add-back
        // is floored rather than allowed to go negative.
        theAddBackIsFlooredAtZero: () => {
            const base = singleFilerWith('30000.00')(uniformStatement('800.00')('850.00')('400.00'))
            const result = expectOk(form8962(taxParams2025)({
                ...base, socialSecurityBenefitsCents: 100000n, taxableSocialSecurityBenefitsCents: 500000n,
            }))
            assertEq(result.line3HouseholdIncomeCents, 3000000n, 'the AGI, unreduced')
        },
        // The tax family size drives line 4, and one more dependent moves the
        // poverty line by a whole increment. Proven WITH the line 2b
        // certification present, so the refusal below is not what is being
        // observed here.
        eachDependentRaisesThePovertyLineByOneIncrement: () => {
            const base = singleFilerWith('30000.00')(uniformStatement('800.00')('850.00')('400.00'))
            const withTwo = expectOk(form8962(taxParams2025)({
                ...base,
                dependentCount: 2,
                noDependentIsRequiredToFileAnIncomeTaxReturn: true,
                marketplaceStatements: base.marketplaceStatements.map(entry => ({
                    ...entry,
                    value: {
                        ...entry.value,
                        coveredIndividuals: [{ name: 'A' }, { name: 'B' }, { name: 'C' }],
                    },
                })),
            }))
            assertEq(withTwo.line1TaxFamilySize, 3)
            assertEq(
                withTwo.line4FederalPovertyLineCents,
                2582000n,
                '$25,820.00 — $15,060.00 plus two $5,380.00 increments')
            assertEq(withTwo.line5PovertyLinePercent, 116, '116% rather than 199%')
        },
        // A joint return counts the spouse. One leaf, because the arithmetic
        // is the same increment as a dependent's and the risk is forgetting
        // the spouse entirely.
        aJointReturnCountsTheSpouse: () => {
            const base = singleFilerWith('30000.00')(uniformStatement('800.00')('850.00')('400.00'))
            const joint = expectOk(form8962(taxParams2025)({
                ...base,
                status: 'marriedFilingJointly',
                marketplaceStatements: base.marketplaceStatements.map(entry => ({
                    ...entry,
                    value: { ...entry.value, coveredIndividuals: [{ name: 'A' }, { name: 'B' }] },
                })),
            }))
            assertEq(joint.line1TaxFamilySize, 2)
            assertEq(joint.line4FederalPovertyLineCents, 2044000n, '$20,440.00 for a family of two')
        },
    },
    // ── Provenance ──────────────────────────────────────────────────────────
    sources: {
        // One Source per PRESENT Part III box, at the dialect's own field
        // name, carrying the raw stored string.
        eachPresentBoxIsCitedOnce: () => {
            const result = expectOk(form8962(taxParams2025)(
                singleFilerWith('30000.00')(uniformStatement('800.00')('850.00')('400.00'))))
            assertEq(result.sources.length, 36, 'twelve months times three present columns')
            const firstSource = assertNotNullish(result.sources[0], 'the first citation')
            assertEq(firstSource.documentHash, 'sha256-1095a-01')
            assertEq(firstSource.boxPath, 'monthlyCoverage[month=1].columnAEnrollmentPremiums')
            assertEq(firstSource.value, '800.00', 'the raw stored decimal, never re-formatted')
            const lastSource = assertNotNullish(
                result.sources[result.sources.length - 1], 'the last citation')
            assertEq(lastSource.boxPath, 'monthlyCoverage[month=12].columnCAdvancePaymentOfPtc')
        },
        // DOC-11 at the citation layer: an absent box cites nothing.
        absentBoxesCiteNothing: () => {
            const statement = uniformStatement('800.00')('850.00')('400.00')
            const result = expectOk(form8962(taxParams2025)(singleFilerWith('30000.00')({
                ...statement,
                monthlyCoverage: statement.monthlyCoverage.filter(row => row.month >= 7),
            })))
            assertEq(result.sources.length, 18, 'six months times three columns')
            assert(
                result.sources.every(source => !source.boxPath.includes('month=1]')),
                ['no citation may name a month with no printed row', result.sources])
        },
    },
    // ── The nine refusals, each with its own control ────────────────────────
    refusals: {
        aSecondFormTenNinetyFiveAIsRefusedByPolicyNumber: () => {
            const base = singleFilerWith('30000.00')(uniformStatement('800.00')('850.00')('400.00'))
            const message = expectRefusal(form8962(taxParams2025)({
                ...base,
                marketplaceStatements: [
                    ...base.marketplaceStatements,
                    {
                        documentHash: 'sha256-1095a-02',
                        value: {
                            ...uniformStatement('700.00')('750.00')('300.00'),
                            marketplaceAssignedPolicyNumber: 'POLICY-0002',
                        },
                    },
                ],
            }))
            assert(
                message.includes('POLICY-0001') && message.includes('POLICY-0002'),
                ['the refusal must name both policies a reader has to go and look at', message])
            assertNamesBothDestinations(message)
        },
        aVoidStatementIsRefused: () => {
            const message = expectRefusal(form8962(taxParams2025)(singleFilerWith('30000.00')({
                ...uniformStatement('800.00')('850.00')('400.00'),
                voidBox: true,
            })))
            assert(message.includes('VOID'), ['the refusal must name the printed box', message])
            assertNamesBothDestinations(message)
        },
        marriedFilingSeparatelyIsRefused: () => {
            const base = singleFilerWith('30000.00')(uniformStatement('800.00')('850.00')('400.00'))
            const message = expectRefusal(
                form8962(taxParams2025)({ ...base, status: 'marriedFilingSeparately' }))
            assert(
                message.includes('§36B(c)(1)(C)'),
                ['the refusal must name the provision that disqualifies the filer', message])
            assertNamesBothDestinations(message)
        },
        aFilerClaimableAsADependentIsRefused: () => {
            const base = singleFilerWith('30000.00')(uniformStatement('800.00')('850.00')('400.00'))
            const message = expectRefusal(
                form8962(taxParams2025)({ ...base, claimedAsDependent: true }))
            assert(
                message.includes('claimedAsDependent') && message.includes('line 12a'),
                ['the refusal must name the field and the printed line behind it', message])
            assertNamesBothDestinations(message)
        },
        aDependentWithoutTheCertificationIsRefused: () => {
            const base = singleFilerWith('30000.00')(uniformStatement('800.00')('850.00')('400.00'))
            const message = expectRefusal(form8962(taxParams2025)({ ...base, dependentCount: 1 }))
            assert(
                message.includes('noDependentIsRequiredToFileAnIncomeTaxReturn'),
                ['the refusal must name the field that would unlock it', message])
            assert(
                message.includes('line 2b'),
                ['and the printed line that needs it', message])
            assertNamesBothDestinations(message)
        },
        anAbsentPovertyLineTableIsRefused: () => {
            const base = singleFilerWith('30000.00')(uniformStatement('800.00')('850.00')('400.00'))
            const message = expectRefusal(
                form8962(taxParams2025)({ ...base, federalPovertyLineTable: undefined }))
            assert(
                message.includes('federalPovertyLineTable'),
                ['the refusal must name the field that would unlock it', message])
            assert(
                message.includes('Alaska') && message.includes('Hawaii'),
                ['and the two tables a reader might not know exist', message])
            assertNamesBothDestinations(message)
        },
        aPolicyCoveringMoreThanTheTaxFamilyIsRefused: () => {
            const message = expectRefusal(form8962(taxParams2025)(singleFilerWith('30000.00')({
                ...uniformStatement('800.00')('850.00')('400.00'),
                coveredIndividuals: [{ name: 'A' }, { name: 'B' }],
            })))
            assert(
                message.includes('Part IV'),
                ['the refusal must name the printed part that would compute it', message])
            assertNamesBothDestinations(message)
        },
        // FEWER covered individuals than the tax family is the CONTROL: a
        // family member on employer coverage is not on the policy, and this
        // must compute rather than refuse.
        aPolicyCoveringFewerThanTheTaxFamilyComputes: () => {
            const base = singleFilerWith('30000.00')(uniformStatement('800.00')('850.00')('400.00'))
            const result = expectOk(form8962(taxParams2025)({
                ...base,
                status: 'marriedFilingJointly',
                dependentCount: 1,
                noDependentIsRequiredToFileAnIncomeTaxReturn: true,
            }))
            assertEq(result.line1TaxFamilySize, 3, 'three in the tax family, one on the policy')
            assert(
                result.line24TotalPremiumTaxCreditCents > 0n,
                ['and the credit is computed rather than refused', result])
        },
        aMissingSlcspPremiumIsRefusedByMonth: () => {
            const statement = uniformStatement('800.00')('850.00')('400.00')
            const message = expectRefusal(form8962(taxParams2025)(singleFilerWith('30000.00')({
                ...statement,
                monthlyCoverage: statement.monthlyCoverage.map(row => row.month === 9
                    ? { month: 9, columnAEnrollmentPremiums: '800.00', columnCAdvancePaymentOfPtc: '400.00' }
                    : row),
            })))
            assert(
                message.includes('month 9') && message.includes('line 20 column (b)'),
                ['the refusal must name the month AND the printed Form 8962 line', message])
            assert(
                message.includes('Pub. 974') && message.includes('HealthCare.gov'),
                ['and where the taxpayer can obtain the missing figure', message])
            assertNamesBothDestinations(message)
        },
        aZeroSlcspPremiumIsRefusedToo: () => {
            const statement = uniformStatement('800.00')('850.00')('400.00')
            const message = expectRefusal(form8962(taxParams2025)(singleFilerWith('30000.00')({
                ...statement,
                monthlyCoverage: statement.monthlyCoverage.map(row => row.month === 3
                    ? { ...row, columnBSlcspPremium: '0.00' }
                    : row),
            })))
            assert(
                message.includes('month 3'),
                ['a printed -0- is the same refusal as a blank', message])
        },
        // The CONTROL for both SLCSP leaves: a month with no coverage at all
        // has no column B either, and must NOT refuse.
        aMonthWithNoCoverageAtAllIsNotRefused: () => {
            const statement = uniformStatement('800.00')('850.00')('400.00')
            const result = expectOk(form8962(taxParams2025)(singleFilerWith('30000.00')({
                ...statement,
                monthlyCoverage: statement.monthlyCoverage.map(row => row.month === 3
                    ? { month: 3 }
                    : row),
            })))
            assertEq(result.path, 'monthly')
            assert(
                result.line24TotalPremiumTaxCreditCents > 0n,
                ['eleven covered months still buy a credit', result])
        },
        anAdvancePaymentWithoutAnEnrollmentPremiumIsRefused: () => {
            const statement = uniformStatement('800.00')('850.00')('400.00')
            const message = expectRefusal(form8962(taxParams2025)(singleFilerWith('30000.00')({
                ...statement,
                monthlyCoverage: statement.monthlyCoverage.map(row => row.month === 11
                    ? { month: 11, columnCAdvancePaymentOfPtc: '400.00' }
                    : row),
            })))
            assert(
                message.includes('month 11') && message.includes('terminated for non-payment'),
                ['the refusal must name the month and the printed reason', message])
            assertNamesBothDestinations(message)
        },
        householdIncomeBelowOneHundredPercentIsRefused: () => {
            // $10,000.00 is 66% of $15,060.00.
            const message = expectRefusal(form8962(taxParams2025)(
                singleFilerWith('10000.00')(uniformStatement('800.00')('850.00')('400.00'))))
            assert(
                message.includes('66%') && message.includes('§36B(c)(1)(A)'),
                ['the refusal must quote the computed percentage and the provision', message])
            assert(
                message.includes('Medicaid'),
                ['and the escape a reader might qualify for', message])
            assertNamesBothDestinations(message)
        },
        // The CONTROL for the 100% floor: exactly 100% computes.
        exactlyOneHundredPercentComputes: () => {
            const result = expectOk(form8962(taxParams2025)(
                singleFilerWith('15060.00')(uniformStatement('800.00')('850.00')('400.00'))))
            assertEq(result.line5PovertyLinePercent, 100)
            assertEq(
                result.line7ApplicableFigureTenThousandths,
                0,
                'below 150% the applicable figure is zero, so the credit is the whole premium')
            assertEq(
                result.line24TotalPremiumTaxCreditCents,
                960000n,
                '$9,600.00 — min(12 x 800, 12 x 850 - 0)')
        },
    },
}
