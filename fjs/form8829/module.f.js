/**
 * Form 8829 — Expenses for Business Use of Your Home, and the Schedule C line
 * 30 that `fjs/schedule/c` has carried as a documented zero since it was
 * written. TAX-39.
 *
 * Sources, fetched and read directly rather than recalled (2026-08-19) — see
 * `fjs/form8829/todo/expenses-for-business-use-of-your-home.md` for the full
 * argument behind every decision this module encodes:
 * `https://www.irs.gov/pub/irs-pdf/f8829.pdf` (Form 8829 (2025), Cat. No.
 * 13232M, "Created 10/2/25") and `https://www.irs.gov/pub/irs-pdf/i8829.pdf`
 * (its instructions, Catalog Number 15683B, "Mar 4, 2026").
 *
 * ## The gross income limitation, and the asymmetry that IS the design
 *
 * **A deduction fully allowed this year computes. A deduction the limitation
 * LIMITS refuses.** Printed lines 27 and 33 cap the expenses at line 8's
 * ceiling, and the excess is not lost — Part IV carries it to 2026:
 *
 * ```
 *  8  Schedule C line 29                       <- the ceiling
 * 15  = 8 - 14                                    what is left for operating expenses
 * 26  = 23(a) + 24 + 25                           what the operating expenses are
 * 27  = min(15, 26)  <-- the limitation
 * 43  = 26 - 27      <-- CARRIES OUT to 2026, and is why a binding 27 refuses
 * 28  = 15 - 27                                   what is left for depreciation
 * 32  = 29 + 30 + 31
 * 33  = min(28, 32)  <-- the limitation again
 * 44  = 32 - 33      <-- CARRIES OUT to 2026
 * ```
 *
 * A prior-year figure blocks this engine in BOTH directions, and Schedule E
 * Part I's §280A(c)(5) refusal is the precedent for the outbound one: a
 * carryforward *"this return would have to create"* has nowhere to go. So a
 * non-zero line 43 or 44 refuses.
 *
 * The INBOUND direction is different and is NOT refused, and the distinction
 * is that same precedent's own test — a prior-year number may enter *"where a
 * printed line exists to transcribe it from."* Lines 25 and 31 are exactly
 * such lines: *"Enter any amount from your 2024 Form 8829, line 43"* and
 * *"... line 44"*. One box off a piece of paper the taxpayer already holds,
 * in the shape Form 2441 line 13's grace-period carryover already is. What
 * separates it from Form 2441 line 9b — which this repo DOES refuse — is that
 * line 9b sends the reader to Worksheet A and FIVE prior-year figures that
 * have to be recomputed.
 *
 * **The asymmetry costs less than it looks.** `fjs/schedule/c` already refuses
 * a net loss on line 31, so every return this engine computes has a
 * non-negative line 29, which is line 8. The returns that reach this form have
 * a tentative profit, and for most of them the home-office expenses sit well
 * under it.
 *
 * ## Part III does not use the MACRS machinery, and that is printed
 *
 * i8829's line 41 instruction prints its own twelve-row percentage table, and
 * those rows ARE Publication 946 Table A-7a's year-one row — 39-year
 * nonresidential real property, mid-month convention. `fjs/form4562/macrs`
 * DERIVES that column from i4562 p11's Steps rather than storing it, and its
 * own `proof.thirtyNineYearMidMonthDivergesFromTableA7a` records that the two
 * constructions disagree in ten of twelve cells: the printed table accumulates
 * a ROUNDED monthly increment, so January is `2.461%` where the exact
 * arithmetic gives `2.457%`.
 *
 * Both are permitted on Form 4562, whose instructions offer the Steps as an
 * alternative to the optional tables. **Form 8829's instruction offers no
 * alternative**: it prints the twelve numbers and says to enter one. So the
 * twelve rows are hand-typed here from i8829, and {@link
 * proof.theHandTypedRowsAreTableASevenAAndNotTheDerivedColumn} pins the
 * divergence rather than letting the two drift into agreement.
 *
 * The asset register is not used, and could not be. i8829 line 42:
 * *"**Do not include the amount from Form 8829, line 42, on Schedule C, line
 * 13.**"* — and Schedule C line 13 is exactly where `fjs/schedule/c` routes a
 * `vnd.fjs.asset_register` whose `accountNumber` matches the business, which
 * this home's would. The home would be deducted twice. Separately, the
 * register has no land-value field at all, and line 38 is a land value.
 *
 * ## What this module refuses, and why each refusal is the designed outcome
 *
 * Eleven conditions. The three a reader will assume away:
 *
 * - **An ITEMIZING filer**, at lines 10 and 11. i8829's *Taxpayers claiming
 *   the standard deduction* paragraph makes those two lines the itemizer's
 *   alone; for everyone else the mortgage interest and real estate taxes
 *   arrive as ordinary indirect expenses on lines 16 and 17, line 7 allocates
 *   them, and there is no Schedule A interaction at all. For an itemizer there
 *   is, in both directions: Pub. 936 limits the interest before line 10 sees
 *   it, §164(b)(6)'s $10,000 test decides line 11 through its own worksheet,
 *   and the *personal* share of both then has to reach Schedule A — *"if your
 *   business percentage on line 7 is 30%, 70% of the amount you included in
 *   column (b) of line 10 is deductible as an itemized deduction on Schedule
 *   A."* `fjs/schedule/a` has no inbound channel for a figure another form
 *   removed from it; its interest and tax lines are face-value reads of
 *   `vnd.fjs.itemized_deductions` entries. Computing this side alone would
 *   produce a Form 8829 that is right and a Schedule A that is short — Schedule
 *   E Part I's §280A refusal, at a different printed line.
 * - **The SIMPLIFIED method.** Not a branch of this form: i8829's *Who cannot
 *   use Form 8829* lists *"You have elected to use the simplified method for
 *   your home for 2025"* among the situations in which the form may not be
 *   filed at all. Rev. Proc. 2013-13's $5 per square foot is computed on the
 *   Simplified Method Worksheet in the Instructions for Schedule C, takes no
 *   depreciation, and permits no carryover in either direction. A different
 *   page, and a different phase.
 * - **A binding limitation**, twice — see above. The refusal is the reason
 *   printed lines 43 and 44 are computed here and asserted ZERO rather than
 *   assumed to be.
 *
 * @module
 */
import { assert, assertEq } from 'functionalscript/fjs/asserts/module.f.mjs'
import { centsFromString, centsToString } from '../exact/module.f.js'
import { of, halfUp } from '../types/rational/module.f.js'

/** @import { BusinessExpenses } from '../document/business_expenses/module.f.js' */

/**
 * A case this module will not compute — the same shape `fjs/schedule/c`,
 * `fjs/schedule/e/part_i` and `fjs/form4562` already return, so
 * `fjs/schedule/c` threads it out through the error arm it already has.
 * @typedef {{ readonly kind: 'error', readonly message: string }} Form8829Refusal
 */

/**
 * Where this form's answer ends up, quoted in every refusal so the message
 * says what was lost as well as why — the part of a refusal a reader can act
 * on, and the part AGENTS.md records a whole project sweep failing to assert.
 * @type {string}
 */
const destination = 'Schedule C line 30 (the expenses for business use of your home, '
    + 'Form 8829 line 36 -> Schedule C line 31 -> Schedule 1 line 3 -> 1040 line 8)'

/**
 * The seven printed Form 8829 lines an operating expense can land on — lines
 * 16 through 22, read off the 2025 form face in the form's own order.
 *
 * Lines 9, 10 and 11 are deliberately absent, and their absence is the shape
 * of the itemizer refusal rather than an omission: i8829 makes all three the
 * itemizer's, and this engine refuses that filer. Lines 29 and 30 are absent
 * too — 29 is a casualty loss, refused, and 30 is Part III's own answer rather
 * than anything a taxpayer enters.
 */
export const printedOperatingExpenseLines = /** @type {const} */ ([
    '16', '17', '18', '19', '20', '21', '22',
])

/**
 * The printed caption of each, so a refusal and a report line can name what
 * the reader sees on the paper. `Record<...>` over the tuple above is what
 * makes a line with no caption a `tsc` error rather than a silently unlabelled
 * total — `fjs/schedule/c`'s `expenseCategoryLine` mechanism.
 * @type {Readonly<Record<typeof printedOperatingExpenseLines[number], string>>}
 */
export const operatingExpenseLineCaptions = {
    16: 'Excess mortgage interest',
    17: 'Excess real estate taxes',
    18: 'Insurance',
    19: 'Rent',
    20: 'Repairs and maintenance',
    21: 'Utilities',
    22: 'Other expenses',
}

/**
 * The two printed columns, and they are not interchangeable. i8829, *Columns
 * (a) and (b)*: *"Direct expenses benefit only the business part of your home
 * ... Enter 100% of your direct expenses on the appropriate line in column
 * (a). Indirect expenses are for keeping up and running your entire home ...
 * Generally, enter 100% of your indirect expenses on the appropriate line in
 * column (b)."*
 *
 * Line 24 multiplies only column (b) by line 7; column (a) reaches line 26
 * whole. Reading one as the other either allocates a direct expense that must
 * not be allocated — costing the taxpayer the non-business share of a repair
 * made only to the office — or fails to allocate an indirect one, deducting
 * the personal share of the electricity bill.
 */
export const printedExpenseColumns = /** @type {const} */ (['direct', 'indirect'])

/**
 * i8829 line 41's twelve printed rows, in THOUSANDTHS of a percentage point,
 * keyed by the two-digit month a home was first used for business in the tax
 * year. Hand-typed from the instruction's own table.
 *
 * These are Publication 946 Table A-7a's year-one row and NOT the column
 * `fjs/form4562/macrs` derives; see this module's docstring, and
 * {@link proof.theHandTypedRowsAreTableASevenAAndNotTheDerivedColumn}, which
 * hand-types the derived row beside them so the divergence is asserted rather
 * than assumed away.
 * @type {Readonly<Record<string, bigint>>}
 */
export const firstYearDepreciationPercentageThousandths = {
    '01': 2461n, '02': 2247n, '03': 2033n, '04': 1819n, '05': 1605n, '06': 1391n,
    '07': 1177n, '08': 963n, '09': 749n, '10': 535n, '11': 321n, '12': 107n,
}

/**
 * The steady-state row, for a home first used for business *"after May 12,
 * 1993, and before 2025"* — 39 years straight line, in thousandths of a
 * percentage point. The one figure of the table that `fjs/form4562/macrs`'s
 * derived column DOES agree with.
 * @type {bigint}
 */
export const laterYearDepreciationPercentageThousandths = 2564n

/**
 * The first tax year i8829's flat 2.564% covers. The table's own condition is
 * *"after May 12, 1993"*, so a home first used for business in 1993 needs the
 * Publication 946 percentage instead and is refused; 1994 onwards is
 * unambiguously inside the flat row.
 * @type {number}
 */
export const firstFlatPercentageYear = 1994

/** `YYYY-MM` — month and year, with NO day, exactly as
 * `vnd.fjs.asset_register`'s `datePlacedInService` is and for the same reason:
 * the mid-month convention reads the month, and a day would invite a reader to
 * believe it mattered.
 * @type {RegExp} */
const monthAndYear = /^(\d{4})-(\d{2})$/

/** Everything Form 8829 reads.
 *
 * `line29TentativeProfitCents` is Schedule C line 29 and is the caller's,
 * because this form's line 8 is downstream of every Part II expense line —
 * exactly as Form 2441's two entry points are downstream of 1040 line 11a.
 * @typedef {{
 *   readonly record: NonNullable<BusinessExpenses['businessUseOfHome']>,
 *   readonly taxYear: number,
 *   readonly line29TentativeProfitCents: bigint,
 *   readonly businessLabel: string,
 * }} Form8829Input
 */

/**
 * Every printed line of a computed Form 8829. Lines 9, 10, 11, 29 and 35 are
 * present and structurally zero: the refusals above are what make them zero,
 * and a line the printed form has is a line this record has.
 * @typedef {{
 *   readonly kind: 'ok',
 *   readonly line1AreaUsedForBusiness: number,
 *   readonly line2TotalAreaOfHome: number,
 *   readonly line7BusinessPercentageHundredths: bigint,
 *   readonly line8Cents: bigint,
 *   readonly line9CasualtyLossesCents: bigint,
 *   readonly line10DeductibleMortgageInterestCents: bigint,
 *   readonly line11RealEstateTaxesCents: bigint,
 *   readonly line12DirectCents: bigint,
 *   readonly line12IndirectCents: bigint,
 *   readonly line13Cents: bigint,
 *   readonly line14Cents: bigint,
 *   readonly line15Cents: bigint,
 *   readonly line23DirectCents: bigint,
 *   readonly line23IndirectCents: bigint,
 *   readonly line24Cents: bigint,
 *   readonly line25Cents: bigint,
 *   readonly line26Cents: bigint,
 *   readonly line27Cents: bigint,
 *   readonly line28Cents: bigint,
 *   readonly line29ExcessCasualtyLossesCents: bigint,
 *   readonly line30Cents: bigint,
 *   readonly line31Cents: bigint,
 *   readonly line32Cents: bigint,
 *   readonly line33Cents: bigint,
 *   readonly line34Cents: bigint,
 *   readonly line35CasualtyLossPortionCents: bigint,
 *   readonly line36Cents: bigint,
 *   readonly line37Cents: bigint,
 *   readonly line38Cents: bigint,
 *   readonly line39Cents: bigint,
 *   readonly line40Cents: bigint,
 *   readonly line41PercentThousandths: bigint,
 *   readonly line42Cents: bigint,
 *   readonly line43Cents: bigint,
 *   readonly line44Cents: bigint,
 * }} Form8829Result
 */

/** @typedef {Form8829Result | Form8829Refusal} Form8829Outcome */

/** Every printed *"If zero or less, enter -0-"*.
 * @type {(cents: bigint) => bigint} */
const atLeastZero = cents => cents > 0n ? cents : 0n

/** @type {(a: bigint) => (b: bigint) => bigint} */
const min = a => b => a < b ? a : b

/** An absent optional amount is a printed blank, which is a zero.
 * @type {(amount: string | undefined) => bigint} */
const centsOrZero = amount => amount === undefined ? 0n : centsFromString(amount)

/**
 * Allocates an indirect amount by line 7 — printed lines 13, 24 and 40.
 *
 * **The ratio is exact and line 7 is NOT rounded first**, which is a
 * deliberate departure from the shape of the printed page and is worth stating
 * because a reader diffing against the paper will notice it. Line 3 prints
 * *"Enter the result as a percentage"* with no stated precision and no decimal
 * places on the face, so rounding it and then multiplying would make the
 * answer depend on a precision the form never states — on a $300,000 basis,
 * two decimal places of line 7 is $1.50 of line 40. Rounding is applied ONCE,
 * half-up to the cent, where this repo applies it everywhere a rate meets an
 * exact amount.
 * @type {(areaUsedForBusiness: number) => (totalAreaOfHome: number) => (cents: bigint) => bigint}
 */
const allocate = areaUsedForBusiness => totalAreaOfHome => cents =>
    halfUp(of(cents * BigInt(areaUsedForBusiness))(BigInt(totalAreaOfHome)))

/**
 * The eleven refusals, in the order a filer meets them — Schedule E Part I's
 * documented ordering rule: the record's own SHAPE first, then the statutory
 * eligibility that decides whether the form may be filed at all, then the
 * facts each printed line needs, and the LIMITATION last, because its message
 * quotes figures that only exist once every line above it is built.
 * @type {(input: Form8829Input) => Form8829Outcome}
 */
export const form8829 = input => {
    const { record, taxYear, line29TentativeProfitCents, businessLabel } = input
    const where = `for the business ${businessLabel}`
    // R1 — the ELECTION, and it is the first check because it decides whether
    // this form exists for this taxpayer at all. i8829, Who cannot use Form
    // 8829: "You have elected to use the simplified method for your home for
    // 2025."
    if (record.method === 'simplified') {
        return {
            kind: 'error',
            message: `Form 8829 ${where}: this record elects the SIMPLIFIED method, and i8829's `
                + `"Who cannot use Form 8829" lists that election among the situations in which `
                + `this form may not be filed at all. The simplified method is Rev. Proc. 2013-13's `
                + `$5.00 per square foot on at most 300 square feet, figured on the Simplified `
                + `Method Worksheet in the Instructions for Schedule C — a different printed page `
                + `with different rules: it takes no depreciation, and it permits no carryover of `
                + `the disallowed part in either direction, so the allowed amount is simply lost `
                + `rather than deferred. This engine computes the ACTUAL-expense method; set `
                + `businessUseOfHome.method to actualExpenses to use it. Refusing rather than `
                + `computing one method's arithmetic under the other's name. Nothing reaches `
                + `${destination}`,
        }
    }
    if (record.method !== 'actualExpenses') {
        return {
            kind: 'error',
            message: `Form 8829 ${where}: businessUseOfHome.method is `
                + `${JSON.stringify(record.method)}, which is neither actualExpenses nor `
                + `simplified. §280A(c) admits exactly two ways to figure this deduction and the `
                + `taxpayer ELECTS between them, so this field is a string precisely to stop a `
                + `serializer's empty value from falling into either. Refusing rather than `
                + `defaulting: the two produce different deductions of different sizes. Nothing `
                + `reaches ${destination}`,
        }
    }
    // R2 — the STANDARD DEDUCTION assertion, at printed lines 10 and 11. See
    // this module's docstring for why the itemizer is the refused case and the
    // standard-deduction filer is the computable one, and for why the
    // difference is a fact about the RETURN that this record has to state:
    // whether the standard deduction wins is not known until Schedule A runs,
    // which is after the adjusted gross income this schedule feeds.
    if (record.claimingTheStandardDeduction !== true) {
        return {
            kind: 'error',
            message: `Form 8829 ${where}: lines 10 and 11 are for a filer who ITEMIZES, and this `
                + `record does not assert claimingTheStandardDeduction. i8829: "If you claim the `
                + `standard deduction, you will not include any mortgage interest or real estate `
                + `taxes on lines 10 and 11; instead, you will claim the entire business use of `
                + `the home portion of those expenses using lines 16 and 17." For that filer this `
                + `form needs no Schedule A at all. For an itemizer it needs one twice over: `
                + `Pub. 936 limits the mortgage interest BEFORE line 10 sees it, §164(b)(6)'s `
                + `$10,000 test decides line 11 through i8829's own Line 11 Worksheet, and the `
                + `personal share then has to reach Schedule A — "if your business percentage on `
                + `line 7 is 30%, 70% of the amount you included in column (b) of line 10 is `
                + `deductible as an itemized deduction on Schedule A." fjs/schedule/a has no `
                + `inbound channel for a figure another form removed from it; its lines 5b and 8a `
                + `are face-value reads of vnd.fjs.itemized_deductions entries. Computing this `
                + `side alone would produce a Form 8829 that is right and a Schedule A that is `
                + `short. Assert claimingTheStandardDeduction if the standard deduction is what `
                + `this return claims. Nothing reaches ${destination}`,
        }
    }
    // R3 — line 8's own first sentence. "If ALL the gross income from your
    // trade or business is from the business use of your home, enter on line 8
    // the amount from Schedule(s) C, line 29" — and otherwise the taxpayer
    // must first split gross income between the home and the other place of
    // business, "consider[ing] the amount of time you spend at each location
    // as well as other facts". No document here carries a minute of anybody's
    // time.
    if (record.allGrossIncomeFromTheBusinessUseOfTheHome !== true) {
        return {
            kind: 'error',
            message: `Form 8829 line 8 ${where}: this record does not assert `
                + `allGrossIncomeFromTheBusinessUseOfTheHome. The printed line reads Schedule C `
                + `line 29 only under i8829's own condition — "If all the gross income from your `
                + `trade or business is from the business use of your home" — and otherwise the `
                + `taxpayer must first determine the part of gross income that IS, "consider[ing] `
                + `the amount of time you spend at each location as well as other facts". Nothing `
                + `this engine holds records a minute of anybody's time, and line 8 is the CEILING `
                + `on the whole deduction, so reading it too high would allow expenses the `
                + `limitation should have deferred. Nothing reaches ${destination}`,
        }
    }
    // R4 — the daycare exception, printed lines 4 through 6. The percentage
    // stops being a floor-area ratio and becomes hours-times-days over 8,760,
    // and eligibility turns on a state licence.
    if (record.daycareFacility === true) {
        return {
            kind: 'error',
            message: `Form 8829 lines 4-6 ${where}: this record asserts a DAYCARE facility, whose `
                + `business percentage is not line 3's floor-area ratio at all. Line 4 is "days `
                + `used for daycare during year" multiplied by "hours used per day", line 5 is `
                + `8,760 hours (prorated if the use started or stopped during the year), and line `
                + `6 divides one by the other before line 7 multiplies the two percentages `
                + `together. Neither count is on any document here. Eligibility itself is a `
                + `further fact — i8829 requires that you "have applied for (and not have been `
                + `rejected), been granted (and still have in effect), or be exempt from having a `
                + `license ... as a daycare center". And where the daycare area is part exclusive `
                + `and part shared, i8829's Special Computation replaces Part I entirely with an `
                + `attached statement. Nothing reaches ${destination}`,
        }
    }
    // R5 — any casualty loss, printed lines 9, 29 and 35. Form 4684 is not
    // modeled, and line 9 alone needs a WORKSHEET version of its Section A
    // that is computed and then not filed.
    const casualtyLossesCents = centsOrZero(record.casualtyLosses)
    if (casualtyLossesCents > 0n) {
        return {
            kind: 'error',
            message: `Form 8829 lines 9 and 29 ${where}: this record reports `
                + `${centsToString(casualtyLossesCents)} of casualty losses, and this engine does `
                + `not compute Form 4684. i8829 sends line 9 through "a worksheet version of `
                + `Section A of Form 4684 treating all your casualty losses (and gains) as `
                + `personal expenses" which is computed and then NOT filed, reads lines 15 and 18 `
                + `of it, and restricts the amount to a federally declared disaster. Line 35 then `
                + `carries a portion back OUT to Form 4684 line 27. Three printed lines of this `
                + `form are a round trip through a form that does not exist here. Nothing reaches `
                + `${destination}`,
        }
    }
    // R6 — a second home. The printed subtitle is "Use a separate Form 8829
    // for each home you used for the business during the year", and this
    // record holds one businessUseOfHome per business document.
    if (record.aSecondHomeWasUsedForThisBusiness === true) {
        return {
            kind: 'error',
            message: `Form 8829 ${where}: this record asserts that a SECOND home was used for `
                + `this business, and the printed subtitle is "Use a separate Form 8829 for each `
                + `home you used for the business during the year". One vnd.fjs.business_expenses `
                + `document carries one businessUseOfHome record, so the second home has nowhere `
                + `to be stored — and each home has its own Part I percentage, its own Part III `
                + `basis and its own Part IV carryover, none of which may be pooled. Nothing `
                + `reaches ${destination}`,
        }
    }
    // R7 — every operating expense entry must name a printed line and a
    // printed column. `fjs/schedule/c`'s own rule for an unrecognized
    // category, applied where the tag decides whether line 7 allocates the
    // amount or not.
    for (const expense of record.expenses) {
        if (!printedOperatingExpenseLines.some(candidate => candidate === expense.line)) {
            return {
                kind: 'error',
                message: `Form 8829 ${where}: the expense ${JSON.stringify(expense.description)} `
                    + `names line ${JSON.stringify(expense.line)}, which is not one of the printed `
                    + `operating expense lines ${printedOperatingExpenseLines.join(', ')}. Lines 9, `
                    + `10 and 11 are absent because i8829 makes all three the ITEMIZER's and this `
                    + `engine refuses that filer; line 29 is a casualty loss, refused; line 30 is `
                    + `Part III's own answer rather than an entry. Refusing rather than dropping `
                    + `the amount into a total nothing printed adds. Nothing reaches ${destination}`,
            }
        }
        if (!printedExpenseColumns.some(candidate => candidate === expense.column)) {
            return {
                kind: 'error',
                message: `Form 8829 ${where}: the expense ${JSON.stringify(expense.description)} `
                    + `names column ${JSON.stringify(expense.column)}, which is neither direct nor `
                    + `indirect. i8829: "Direct expenses benefit only the business part of your `
                    + `home ... Enter 100% of your direct expenses ... in column (a). Indirect `
                    + `expenses are for keeping up and running your entire home ... in column (b)." `
                    + `Line 24 multiplies only column (b) by line 7's business percentage, so `
                    + `reading one as the other either allocates a repair made only to the office `
                    + `or deducts the personal share of the electricity. Nothing reaches `
                    + `${destination}`,
            }
        }
    }
    // ── Part I ──────────────────────────────────────────────────────────────
    // Lines 1 and 2 are checked at the dialect: a zero total area and an area
    // larger than the home are both refused there, so line 3's division is
    // total here and line 7 cannot exceed 100%.
    const line1AreaUsedForBusiness = record.areaUsedForBusiness
    const line2TotalAreaOfHome = record.totalAreaOfHome
    const share = allocate(line1AreaUsedForBusiness)(line2TotalAreaOfHome)
    // Line 3 / line 7 as a percentage in HUNDREDTHS of a point, for the report
    // only — every allocation below goes through {@link allocate}'s exact
    // ratio instead. "For daycare facilities not used exclusively for
    // business, multiply line 6 by line 3 ... All others, enter the amount
    // from line 3", and the daycare case has refused above.
    const line7BusinessPercentageHundredths = halfUp(
        of(BigInt(line1AreaUsedForBusiness) * 10000n)(BigInt(line2TotalAreaOfHome)))
    // ── Part II ─────────────────────────────────────────────────────────────
    // Line 8 — Schedule C line 29, under R3's assertion. The gains and losses
    // the printed line adds and subtracts are Form 8949, Schedule D and Form
    // 4797 amounts "allocable to the trade or business in which you use your
    // home"; a return whose gross income is ENTIRELY from the business use of
    // the home, which R3 is, has no such other-place-of-business figure to
    // split off.
    const line8Cents = line29TentativeProfitCents
    // Lines 9, 10 and 11 are STRUCTURAL zeros: R5 refuses a casualty loss and
    // R2 refuses the itemizer, who is the only filer i8829 puts an amount on
    // lines 10 and 11 for. Written out rather than folded away, because the
    // day the itemizer computes is the day they stop being zero.
    const line9CasualtyLossesCents = 0n
    const line10DeductibleMortgageInterestCents = 0n
    const line11RealEstateTaxesCents = 0n
    const line12DirectCents = 0n
    const line12IndirectCents = line9CasualtyLossesCents
        + line10DeductibleMortgageInterestCents + line11RealEstateTaxesCents
    const line13Cents = share(line12IndirectCents)
    const line14Cents = line12DirectCents + line13Cents
    const line15Cents = atLeastZero(line8Cents - line14Cents)
    // Lines 16-22, summed to line 23 per column. One pass over the entries,
    // because the printed lines differ only in their captions: nothing on the
    // form treats line 19's rent differently from line 21's utilities.
    /** @type {(column: string) => bigint} */
    const columnTotal = column => record.expenses
        .filter(expense => expense.column === column)
        .reduce((total, expense) => total + centsFromString(expense.amount), 0n)
    const line23DirectCents = columnTotal('direct')
    const line23IndirectCents = columnTotal('indirect')
    const line24Cents = share(line23IndirectCents)
    // Line 25 — "Enter any amount from your 2024 Form 8829, line 43." An
    // inbound prior-year figure with a printed line to transcribe it from; see
    // this module's docstring.
    const line25Cents = centsOrZero(record.priorYearOperatingExpensesCarryover)
    const line26Cents = line23DirectCents + line24Cents + line25Cents
    const line27Cents = min(line15Cents)(line26Cents)
    // ── Part III, computed here because line 30 reads line 42 ───────────────
    if (record.additionsOrImprovementsPlacedInService === true) {
        return {
            kind: 'error',
            message: `Form 8829 line 42 ${where}: this record asserts additions or improvements `
                + `placed in service after the home was first used for business. i8829 excludes `
                + `them from lines 37 through 40 — "Do not include any amounts on lines 37 through `
                + `40 for these expenditures" — and depreciates each SEPARATELY, at the line 41 `
                + `percentage for its own month placed in service, with "a statement showing your `
                + `computation" attached and "See attached" written below the entry space. This `
                + `record holds one basis and one placed-in-service month, so a second schedule of `
                + `improvements has nowhere to be stored and would be depreciated at the home's `
                + `own rate instead of its own. Nothing reaches ${destination}`,
        }
    }
    if (record.stoppedUsingTheHomeForBusinessBeforeYearEnd === true) {
        return {
            kind: 'error',
            message: `Form 8829 line 41 ${where}: this record asserts that the business use of the `
                + `home STOPPED before the end of the year, and i8829's line 41 table sends that `
                + `case to "the percentage given in Pub. 946 as adjusted by the instructions under `
                + `Sale or Other Disposition Before the Recovery Period Ends". That adjustment is `
                + `a mid-month proration of the year of disposition, and the twelve percentages `
                + `this module hand-types from i8829 are the full-year figures. Using one of them `
                + `would overstate the depreciation, and the part-year rule reaches every `
                + `operating expense on lines 16-22 besides — i8829's Columns (a) and (b): "If you `
                + `did not operate a business for the entire year, you can deduct only the `
                + `expenses paid or incurred for the portion of the year you used your home for `
                + `business." Nothing reaches ${destination}`,
        }
    }
    const first = record.firstUsedForBusiness
    if (first === undefined) {
        return {
            kind: 'error',
            message: `Form 8829 line 41 ${where}: this record does not state `
                + `firstUsedForBusiness, and line 41's printed table is keyed on nothing else. `
                + `The twelve rows for a home first used for business during the tax year run `
                + `from 2.461% (January) to 0.107% (December) — a factor of 23 on the same basis `
                + `— and a home first used in an earlier year takes a flat 2.564%. There is no `
                + `safe default among fourteen answers. Record the month and year as YYYY-MM. `
                + `Nothing reaches ${destination}`,
        }
    }
    const parsed = monthAndYear.exec(first)
    if (parsed === null) {
        return {
            kind: 'error',
            message: `Form 8829 line 41 ${where}: firstUsedForBusiness `
                + `${JSON.stringify(first)} is not a YYYY-MM month and year. The mid-month `
                + `convention behind line 41's table reads the MONTH and nothing finer, which is `
                + `why there is no day here — vnd.fjs.asset_register's datePlacedInService is the `
                + `same shape for the same reason. Nothing reaches ${destination}`,
        }
    }
    const [, firstYearText, firstMonthText] = parsed
    assert(
        firstYearText !== undefined && firstMonthText !== undefined,
        ['a matched YYYY-MM has both groups', first])
    if (firstYearText === undefined || firstMonthText === undefined) {
        throw ['a matched YYYY-MM has both groups', first]
    }
    const firstYear = Number(firstYearText)
    if (firstYear > taxYear) {
        return {
            kind: 'error',
            message: `Form 8829 line 41 ${where}: firstUsedForBusiness ${first} is AFTER tax year `
                + `${taxYear}. A home not yet used for business has no line 40 basis and no `
                + `deduction on this return at all. Nothing reaches ${destination}`,
        }
    }
    if (firstYear < firstFlatPercentageYear) {
        return {
            kind: 'error',
            message: `Form 8829 line 41 ${where}: this home was first used for business in `
                + `${firstYearText}, and i8829's flat 2.564% row covers a home first used "after `
                + `May 12, 1993, and before ${taxYear}". Before that date the table sends the `
                + `reader to "the percentage given in Pub. 946" — or, before 1987, to Pub. 534 — `
                + `and a home first used for business between January and 12 May 1993 depends on `
                + `whether construction had started or a binding contract existed before 13 May `
                + `1993, a fact no document here carries. This module hand-types i8829's own `
                + `fourteen printed percentages and no others. Nothing reaches ${destination}`,
        }
    }
    const monthPercent = firstYearDepreciationPercentageThousandths[firstMonthText]
    if (firstYear === taxYear && monthPercent === undefined) {
        return {
            kind: 'error',
            message: `Form 8829 line 41 ${where}: firstUsedForBusiness ${first} names month `
                + `${JSON.stringify(firstMonthText)}, which is not one of the twelve rows i8829 `
                + `prints. Nothing reaches ${destination}`,
        }
    }
    const line41PercentThousandths = firstYear === taxYear
        ? monthPercent ?? laterYearDepreciationPercentageThousandths
        : laterYearDepreciationPercentageThousandths
    // Lines 37 through 40. i8829: line 37 is "the cost or other basis of your
    // home (including land), or, if less, the fair market value of your home
    // on the date you first used the home for business", line 38 is the land
    // in it, and neither is adjusted for later changes.
    const line37Cents = centsOrZero(record.homeAdjustedBasisOrFairMarketValue)
    const line38Cents = centsOrZero(record.landIncludedInThatBasis)
    if (line38Cents > line37Cents) {
        return {
            kind: 'error',
            message: `Form 8829 line 39 ${where}: the land value on line 38 `
                + `(${centsToString(line38Cents)}) exceeds the whole basis on line 37 `
                + `(${centsToString(line37Cents)}), and line 39 subtracts one from the other to `
                + `get the basis of the BUILDING. The printed line 37 is the basis "including `
                + `land", so line 38 is a part of it and cannot be larger. Nothing reaches `
                + `${destination}`,
        }
    }
    const line39Cents = line37Cents - line38Cents
    const line40Cents = share(line39Cents)
    // Line 42 — "Multiply line 40 by the percentage on line 41." The
    // percentage is printed to three decimals of a point, which IS a stated
    // precision, so the division is by 100,000 and the rounding is half-up to
    // the cent.
    const line42Cents = halfUp(of(line40Cents * line41PercentThousandths)(100000n))
    // ── Part II, resumed ────────────────────────────────────────────────────
    const line28Cents = atLeastZero(line15Cents - line27Cents)
    // Line 29 is a structural zero: R5 refuses any casualty loss.
    const line29ExcessCasualtyLossesCents = 0n
    const line30Cents = line42Cents
    const line31Cents = centsOrZero(
        record.priorYearExcessCasualtyLossesAndDepreciationCarryover)
    const line32Cents = line29ExcessCasualtyLossesCents + line30Cents + line31Cents
    const line33Cents = min(line28Cents)(line32Cents)
    // R8 and R9 — THE LIMITATION, in printed order, and the reason lines 43
    // and 44 below can be asserted zero rather than assumed to be. Each names
    // the Part IV line the excess would have carried out on, and the amount.
    const line43Cents = atLeastZero(line26Cents - line27Cents)
    if (line43Cents > 0n) {
        return {
            kind: 'error',
            message: `Form 8829 line 27 ${where}: the operating expenses on line 26 `
                + `(${centsToString(line26Cents)}) exceed line 15's remaining gross income `
                + `(${centsToString(line15Cents)}), so §280A(c)(5)'s gross income limitation BINDS `
                + `and line 27 allows only the smaller. The `
                + `${centsToString(line43Cents)} difference is not lost — printed line 43 carries `
                + `it to 2026, where i8829 says it "will be subject to the deduction limit for `
                + `that year, whether or not you live in the same home during that year". This `
                + `engine holds ONE tax year and has no way to hand a figure to the next one, so `
                + `a return that computed this would deduct the allowed part and silently destroy `
                + `the deferred part. A deduction fully allowed this year computes; a LIMITED one `
                + `refuses. Nothing reaches ${destination}`,
        }
    }
    const line44Cents = atLeastZero(line32Cents - line33Cents)
    if (line44Cents > 0n) {
        return {
            kind: 'error',
            message: `Form 8829 line 33 ${where}: the depreciation on line 32 `
                + `(${centsToString(line32Cents)}) exceeds line 28's remaining gross income `
                + `(${centsToString(line28Cents)}), so §280A(c)(5)'s gross income limitation BINDS `
                + `at the second tier and line 33 allows only the smaller. The `
                + `${centsToString(line44Cents)} difference carries to 2026 on printed line 44, `
                + `and this engine holds one tax year. The depreciation tier is the one that binds `
                + `SECOND — i8829 orders the tiers so operating expenses are allowed first — so a `
                + `return can reach here with line 27 fully allowed. A deduction fully allowed `
                + `this year computes; a LIMITED one refuses. Nothing reaches ${destination}`,
        }
    }
    const line34Cents = line14Cents + line27Cents + line33Cents
    // Line 35 is a structural zero: R5 refuses every casualty loss, and this
    // is the portion of lines 14 and 33 that would have gone back to Form
    // 4684 line 27.
    const line35CasualtyLossPortionCents = 0n
    const line36Cents = line34Cents - line35CasualtyLossPortionCents
    return {
        kind: 'ok',
        line1AreaUsedForBusiness,
        line2TotalAreaOfHome,
        line7BusinessPercentageHundredths,
        line8Cents,
        line9CasualtyLossesCents,
        line10DeductibleMortgageInterestCents,
        line11RealEstateTaxesCents,
        line12DirectCents,
        line12IndirectCents,
        line13Cents,
        line14Cents,
        line15Cents,
        line23DirectCents,
        line23IndirectCents,
        line24Cents,
        line25Cents,
        line26Cents,
        line27Cents,
        line28Cents,
        line29ExcessCasualtyLossesCents,
        line30Cents,
        line31Cents,
        line32Cents,
        line33Cents,
        line34Cents,
        line35CasualtyLossPortionCents,
        line36Cents,
        line37Cents,
        line38Cents,
        line39Cents,
        line40Cents,
        line41PercentThousandths,
        line42Cents,
        line43Cents,
        line44Cents,
    }
}

// ── Tests ────────────────────────────────────────────────────────────────────

/**
 * The base record every leaf below varies ONE fact of: a 200-square-foot
 * office in a 2,000-square-foot home — **10%, which is not 100%**, and that is
 * the whole point of the fixture. AGENTS.md records a mutation surviving here
 * because *"every fixture in the repo used 100% business use, one month and
 * one year"*, and Form 8829 is a percentage-of-use form.
 * @type {NonNullable<BusinessExpenses['businessUseOfHome']>}
 */
const tenPercentHome = {
    method: 'actualExpenses',
    claimingTheStandardDeduction: true,
    allGrossIncomeFromTheBusinessUseOfTheHome: true,
    areaUsedForBusiness: 200,
    totalAreaOfHome: 2000,
    expenses: [],
    homeAdjustedBasisOrFairMarketValue: '250000.00',
    landIncludedInThatBasis: '50000.00',
    firstUsedForBusiness: '2019-06',
}

/** @type {(record: NonNullable<BusinessExpenses['businessUseOfHome']>) => (line29Cents: bigint) => Form8829Input} */
const inputOf = record => line29Cents => ({
    record,
    taxYear: 2025,
    line29TentativeProfitCents: line29Cents,
    businessLabel: `'consulting'`,
})

/** @type {(outcome: Form8829Outcome) => Form8829Result} */
const expectOk = outcome => {
    assert(outcome.kind === 'ok', ['expected Form 8829 to compute, not refuse', outcome])
    return outcome
}

/** @type {(outcome: Form8829Outcome) => string} */
const expectRefusal = outcome => {
    assert(outcome.kind === 'error', ['expected Form 8829 to refuse', outcome])
    return outcome.message
}

/**
 * Every refusal must say WHERE the deduction would have gone. AGENTS.md
 * records the erased `${destination}` interpolation surviving an entire suite
 * because five refusal proofs asserted the box name and not the destination.
 * @type {(message: string) => void}
 */
const assertNamesTheDestination = message => {
    assert(
        message.includes('Schedule C line 30') && message.includes('Schedule 1 line 3'),
        ['a refusal must name the line the deduction would have reached, and the chain out',
            message])
}

export const proof = {
    // ── Part I, and the percentage everything else runs through ─────────────
    partOne: {
        // 200 / 2000 = 10.00%, hand-typed. The printed line 3 is "Divide line
        // 1 by line 2. Enter the result as a percentage."
        theBusinessPercentageIsTheFloorAreaRatio: () => {
            const result = expectOk(form8829(inputOf(tenPercentHome)(1000000n)))
            assertEq(result.line1AreaUsedForBusiness, 200)
            assertEq(result.line2TotalAreaOfHome, 2000)
            assertEq(result.line7BusinessPercentageHundredths, 1000n, '10.00%')
        },
        // A percentage that does NOT divide evenly, so the exact-ratio
        // decision above is observable: 150 / 700 is 21.428571...%, which
        // rounds to 21.43% but must allocate from the exact ratio.
        anIndivisibleRatioAllocatesFromTheExactShare: () => {
            const result = expectOk(form8829(inputOf({
                ...tenPercentHome,
                areaUsedForBusiness: 150,
                totalAreaOfHome: 700,
                expenses: [
                    { line: '21', column: 'indirect', description: 'electricity', amount: '3500.00' },
                ],
            })(10000000n)))
            assertEq(result.line7BusinessPercentageHundredths, 2143n, '21.43%, rounded HALF-UP')
            // $3,500.00 x 150/700 = $750.00 exactly. Rounding line 7 to
            // 21.43% first would give $750.05 — five cents of difference on
            // one utility bill, and the reason the ratio is not rounded.
            assertEq(result.line24Cents, 75000n, '$750.00 from the exact 150/700 share')
        },
        // The whole home used for business is 100%, which is the fixture
        // monoculture AGENTS.md warns about — kept as ONE leaf beside the 10%
        // base rather than as the base itself.
        aWholeHomeIsOneHundredPercent: () => {
            const result = expectOk(form8829(inputOf({
                ...tenPercentHome, areaUsedForBusiness: 900, totalAreaOfHome: 900,
                expenses: [
                    { line: '19', column: 'indirect', description: 'rent', amount: '1200.00' },
                ],
            })(10000000n)))
            assertEq(result.line7BusinessPercentageHundredths, 10000n, '100.00%')
            assertEq(result.line24Cents, 120000n, 'the whole rent')
        },
    },
    // ── Part III, worked from i8829's own printed table ─────────────────────
    partThree: {
        /*
         * A home worth $250,000 including $50,000 of land, 10% used for
         * business, first used in June 2019 — so line 41 is the flat 2.564%.
         *
         *   line 37 $250,000.00   line 38 $50,000.00   line 39 $200,000.00
         *   line 40 $200,000.00 x 10% = $20,000.00
         *   line 42 $20,000.00 x 2.564% = $512.80
         *
         * Every figure hand-typed from the paper.
         */
        aPriorYearHomeTakesTheFlatRow: () => {
            const result = expectOk(form8829(inputOf(tenPercentHome)(10000000n)))
            assertEq(result.line37Cents, 25000000n, '$250,000.00')
            assertEq(result.line38Cents, 5000000n, '$50,000.00 of land')
            assertEq(result.line39Cents, 20000000n, '$200,000.00 of building')
            assertEq(result.line40Cents, 2000000n, '$20,000.00 of business basis')
            assertEq(result.line41PercentThousandths, 2564n, '2.564%')
            assertEq(result.line42Cents, 51280n, '$512.80')
            assertEq(result.line30Cents, 51280n, 'line 30 IS line 42')
        },
        /*
         * The SAME home first used for business in March 2025 takes line 41's
         * March row, 2.033%: $20,000.00 x 2.033% = $406.60. A month that is
         * not January and not December, because those two are the only cells
         * where the printed table and `fjs/form4562/macrs`' derived column
         * happen to agree.
         */
        aCurrentYearHomeTakesItsOwnMonthsRow: () => {
            const result = expectOk(form8829(inputOf({
                ...tenPercentHome, firstUsedForBusiness: '2025-03',
            })(10000000n)))
            assertEq(result.line41PercentThousandths, 2033n, '2.033%, i8829’s March row')
            assertEq(result.line42Cents, 40660n, '$406.60')
        },
        /**
         * ★ **THE LEAF A SURVIVING MUTATION BOUGHT.** Every other fixture in
         * this module divides evenly — $20,000.00 x 2.564% is $512.80 to the
         * cent — so replacing line 42's `halfUp` with truncation left the
         * WHOLE suite green. A rate line whose rounding nobody exercises is a
         * rate line with no rounding rule.
         *
         * $1,000.25 of business basis at 2.564% is 2,564.641 hundredths of a
         * cent. Half-up is **$25.65**; truncation is $25.64. Hand-typed:
         * 100,025 x 2,564 = 256,464,100, and 256,464,100 / 100,000 = 2,564.641.
         */
        lineFortyTwoRoundsHalfUpRatherThanTruncating: () => {
            const result = expectOk(form8829(inputOf({
                ...tenPercentHome,
                areaUsedForBusiness: 900,
                totalAreaOfHome: 900,
                homeAdjustedBasisOrFairMarketValue: '1000.25',
                landIncludedInThatBasis: '0.00',
            })(10000000n)))
            assertEq(result.line40Cents, 100025n, '$1,000.25 of business basis')
            assertEq(result.line42Cents, 2565n, '$25.65 — half-up, not the $25.64 of truncation')
        },
        /**
         * The same gap on the OTHER rounding, and it was there for the same
         * reason: every allocation fixture divided evenly. $100.00 of an
         * indirect expense in a home two-thirds of which is used for business
         * is 6,666.67 cents — **$66.67** half-up, $66.66 truncated.
         */
        theAllocationRoundsHalfUpRatherThanTruncating: () => {
            const result = expectOk(form8829(inputOf({
                ...tenPercentHome,
                areaUsedForBusiness: 2,
                totalAreaOfHome: 3,
                homeAdjustedBasisOrFairMarketValue: '0.00',
                landIncludedInThatBasis: '0.00',
                expenses: [
                    { line: '21', column: 'indirect', description: 'utilities', amount: '100.00' },
                ],
            })(10000000n)))
            assertEq(result.line24Cents, 6667n, '$66.67 — half-up, not the $66.66 of truncation')
        },
        /**
         * **The hand-typed rows are Table A-7a's, NOT the column
         * `fjs/form4562/macrs` derives.** Both rows are hand-typed here, from
         * i8829 and from that module's own proof, so the two cannot drift into
         * agreement without this leaf noticing.
         *
         * Ten of the twelve differ. That module's own leaf asserts the same
         * two-of-twelve agreement from the other side; this one asserts it
         * from the table Form 8829 actually prints, and asserts that THIS
         * module ships the printed value rather than the derived one.
         */
        theHandTypedRowsAreTableASevenAAndNotTheDerivedColumn: () => {
            // i8829 line 41's twelve rows, in thousandths of a point.
            const printed = [2461, 2247, 2033, 1819, 1605, 1391, 1177, 963, 749, 535, 321, 107]
            // `fjs/form4562/macrs`' derived year-1 row, hand-typed from that
            // module's `thirtyNineYearMidMonthDivergesFromTableA7a`.
            const derived = [2457, 2244, 2030, 1816, 1603, 1389, 1175, 962, 748, 534, 321, 107]
            assertEq(printed.length, 12, 'twelve printed rows')
            assertEq(derived.length, 12, 'and twelve derived ones')
            let agreements = 0
            for (let month = 1; month <= 12; month += 1) {
                const key = String(month).padStart(2, '0')
                const shipped = firstYearDepreciationPercentageThousandths[key]
                const expected = printed[month - 1]
                const other = derived[month - 1]
                // Never `continue` past a lookup miss: a missing month must
                // FAIL rather than shrink this loop's coverage.
                assert(shipped !== undefined, ['no shipped percentage for month', key])
                assert(expected !== undefined && other !== undefined, ['hand-typed row short', key])
                if (shipped === undefined || expected === undefined || other === undefined) {
                    throw ['month missing', key]
                }
                assertEq(shipped, BigInt(expected), ['this module ships i8829’s printed row', key])
                if (expected === other) {
                    agreements += 1
                }
            }
            assertEq(
                agreements,
                2,
                'exactly two of the twelve agree with the derived column — November and December')
            // The largest cell is where it matters: January is 2.461% printed
            // against 2.457% derived, four thousandths of a point.
            const january = firstYearDepreciationPercentageThousandths['01']
            assert(january !== undefined, 'January is a printed row')
            assertEq(january, 2461n, 'and this module ships the PRINTED 2.461%, not 2.457%')
        },
    },
    // ── Part II, worked end to end from the printed page ────────────────────
    partTwo: {
        /*
         * The whole form, worked by hand off f8829 for a $60,000 tentative
         * profit and a 10% home:
         *
         *   line 8  $60,000.00                     line 14 $0.00 (structural)
         *   line 15 $60,000.00
         *   line 23 (a) $600.00 direct repair to the office
         *   line 23 (b) $9,600.00 = 3,000 insurance + 2,400 utilities + 4,200 rent
         *   line 24 $9,600.00 x 10% = $960.00      line 25 $0.00
         *   line 26 600 + 960 + 0 = $1,560.00
         *   line 27 min(60,000, 1,560) = $1,560.00 line 28 $58,440.00
         *   line 30 $512.80 (Part III)             line 32 $512.80
         *   line 33 min(58,440, 512.80) = $512.80
         *   line 34 0 + 1,560 + 512.80 = $2,072.80
         *   line 36 $2,072.80  ->  Schedule C line 30
         *   lines 43 and 44 both $0.00
         */
        theWholeFormWithTheLimitationNotBinding: () => {
            const result = expectOk(form8829(inputOf({
                ...tenPercentHome,
                expenses: [
                    { line: '20', column: 'direct', description: 'office repaint', amount: '600.00' },
                    { line: '18', column: 'indirect', description: 'homeowner insurance', amount: '3000.00' },
                    { line: '21', column: 'indirect', description: 'utilities', amount: '2400.00' },
                    { line: '19', column: 'indirect', description: 'rent', amount: '4200.00' },
                ],
            })(6000000n)))
            assertEq(result.line8Cents, 6000000n, '$60,000.00 — Schedule C line 29')
            assertEq(result.line14Cents, 0n, 'lines 9-11 are structural zeros')
            assertEq(result.line15Cents, 6000000n)
            assertEq(result.line23DirectCents, 60000n, '$600.00 in column (a)')
            assertEq(result.line23IndirectCents, 960000n, '$9,600.00 in column (b)')
            assertEq(result.line24Cents, 96000n, '$960.00 — 10% of column (b)')
            assertEq(result.line26Cents, 156000n, '$1,560.00')
            assertEq(result.line27Cents, 156000n, 'the limitation does not bind')
            assertEq(result.line28Cents, 5844000n, '$58,440.00 left for depreciation')
            assertEq(result.line30Cents, 51280n, '$512.80')
            assertEq(result.line33Cents, 51280n, 'and all of it is allowed')
            assertEq(result.line34Cents, 207280n)
            assertEq(result.line36Cents, 207280n, '$2,072.80 reaches Schedule C line 30')
            assertEq(result.line43Cents, 0n, 'nothing carries out')
            assertEq(result.line44Cents, 0n, 'and nothing carries out here either')
        },
        // **A DIRECT expense is not allocated and an INDIRECT one is**, which
        // is the single easiest thing to get wrong on this form. The same
        // $1,000.00 in the two columns is $1,000.00 and $100.00.
        theTwoColumnsAreNotInterchangeable: () => {
            /** @type {(column: string) => Form8829Result} */
            const of1000 = column => expectOk(form8829(inputOf({
                ...tenPercentHome,
                expenses: [
                    { line: '20', column, description: 'repairs', amount: '1000.00' },
                ],
            })(6000000n)))
            assertEq(of1000('direct').line26Cents, 100000n, '$1,000.00 whole, column (a)')
            assertEq(of1000('indirect').line26Cents, 10000n, '$100.00 — 10%, column (b)')
        },
        // A prior-year carryover IN is transcribed and USED — the direction
        // this form does not refuse. $1,000.00 on line 25 raises line 26 by
        // exactly $1,000.00 and, with the limitation not binding, line 36 too.
        aPriorYearCarryoverInIsAddedToLineTwentySix: () => {
            const withoutIt = expectOk(form8829(inputOf(tenPercentHome)(6000000n)))
            const withIt = expectOk(form8829(inputOf({
                ...tenPercentHome, priorYearOperatingExpensesCarryover: '1000.00',
            })(6000000n)))
            assertEq(withoutIt.line25Cents, 0n, 'an absent carryover is the printed blank')
            assertEq(withIt.line25Cents, 100000n, '$1,000.00 off the 2024 line 43')
            assertEq(
                withIt.line36Cents - withoutIt.line36Cents,
                100000n,
                'and the whole $1,000.00 reaches the deduction')
        },
        // Line 31's carryover reaches the SECOND tier and not the first.
        aPriorYearCarryoverInReachesTheDepreciationTier: () => {
            const result = expectOk(form8829(inputOf({
                ...tenPercentHome,
                priorYearExcessCasualtyLossesAndDepreciationCarryover: '300.00',
            })(6000000n)))
            assertEq(result.line26Cents, 0n, 'the operating tier is untouched')
            assertEq(result.line31Cents, 30000n, '$300.00')
            assertEq(result.line32Cents, 81280n, '$512.80 of depreciation plus $300.00')
            assertEq(result.line33Cents, 81280n, 'both allowed')
        },
    },
    // ── The eleven refusals, each with its control ──────────────────────────
    refusals: {
        theSimplifiedMethodIsRefusedNamingItsOwnWorksheet: () => {
            const message = expectRefusal(form8829(inputOf({
                ...tenPercentHome, method: 'simplified',
            })(6000000n)))
            assert(
                message.includes('Simplified Method Worksheet')
                && message.includes('Instructions for Schedule C')
                && message.includes('300 square feet')
                && message.includes('$5.00 per square foot'),
                ['the refusal must name where the figure the taxpayer wants actually lives',
                    message])
            assert(
                message.includes('Who cannot use Form 8829'),
                ['and the printed heading that makes the two exclusive', message])
            assertNamesTheDestination(message)
        },
        anUnrecognizedMethodIsRefusedRatherThanDefaulted: () => {
            const message = expectRefusal(form8829(inputOf({
                ...tenPercentHome, method: '',
            })(6000000n)))
            assert(
                message.includes('actualExpenses') && message.includes('simplified'),
                ['the refusal must name both values it would accept', message])
            assertNamesTheDestination(message)
        },
        anItemizerIsRefusedNamingBothWorksheetsAndScheduleA: () => {
            const { claimingTheStandardDeduction: _dropped, ...itemizing } = tenPercentHome
            const message = expectRefusal(form8829(inputOf(itemizing)(6000000n)))
            assert(
                message.includes('Pub. 936') && message.includes('§164(b)(6)')
                && message.includes('Line 11 Worksheet'),
                ['the refusal must name both limits an itemizer has to apply first', message])
            assert(
                message.includes('Schedule A that is short')
                && message.includes('vnd.fjs.itemized_deductions'),
                ['and why the OTHER half of the split has nowhere to land', message])
            assert(
                message.includes('claimingTheStandardDeduction'),
                ['and the field that unlocks it', message])
            assertNamesTheDestination(message)
        },
        anUnassertedGrossIncomeSourceIsRefusedAtLineEight: () => {
            const { allGrossIncomeFromTheBusinessUseOfTheHome: _dropped, ...unstated }
                = tenPercentHome
            const message = expectRefusal(form8829(inputOf(unstated)(6000000n)))
            assert(
                message.includes('line 8') && message.includes('amount of time you spend'),
                ['the refusal must name the printed line and the allocation it cannot make',
                    message])
            assert(
                message.includes('CEILING'),
                ['and why reading it too high matters', message])
            assertNamesTheDestination(message)
        },
        aDaycareFacilityIsRefusedNamingTheHoursComputation: () => {
            const message = expectRefusal(form8829(inputOf({
                ...tenPercentHome, daycareFacility: true,
            })(6000000n)))
            assert(
                message.includes('8,760') && message.includes('lines 4-6')
                && message.includes('license'),
                ['the refusal must name the printed lines, the hours and the licence test',
                    message])
            assertNamesTheDestination(message)
        },
        aCasualtyLossIsRefusedNamingFormFortySixEightyFour: () => {
            const message = expectRefusal(form8829(inputOf({
                ...tenPercentHome, casualtyLosses: '5000.00',
            })(6000000n)))
            assert(
                message.includes('Form 4684') && message.includes('5000.00')
                && message.includes('federally declared disaster'),
                ['the refusal must name the missing form, quote the amount, and name the test',
                    message])
            assertNamesTheDestination(message)
        },
        // The CONTROL for the casualty gate: a ZERO casualty loss is an
        // ordinary return. A gate on PRESENCE rather than on amount would
        // pass the leaf above alone.
        aZeroCasualtyLossComputes: () => {
            const result = expectOk(form8829(inputOf({
                ...tenPercentHome, casualtyLosses: '0.00',
            })(6000000n)))
            assertEq(result.line9CasualtyLossesCents, 0n)
            assertEq(result.line36Cents, 51280n, '$512.80 of depreciation and nothing else')
        },
        aSecondHomeIsRefusedNamingThePrintedSubtitle: () => {
            const message = expectRefusal(form8829(inputOf({
                ...tenPercentHome, aSecondHomeWasUsedForThisBusiness: true,
            })(6000000n)))
            assert(
                message.includes('separate Form 8829 for each home'),
                ['the refusal must quote the printed subtitle', message])
            assertNamesTheDestination(message)
        },
        anExpenseNamingAnUnprintedLineIsRefused: () => {
            const message = expectRefusal(form8829(inputOf({
                ...tenPercentHome,
                expenses: [
                    { line: '10', column: 'indirect', description: 'mortgage interest', amount: '9000.00' },
                ],
            })(6000000n)))
            assert(
                message.includes('mortgage interest') && message.includes('16, 17, 18, 19, 20, 21, 22'),
                ['the refusal must name the entry and every line it could have used', message])
            assert(
                message.includes('ITEMIZER'),
                ['and why line 10 in particular is absent', message])
            assertNamesTheDestination(message)
        },
        anExpenseNamingAnUnprintedColumnIsRefused: () => {
            const message = expectRefusal(form8829(inputOf({
                ...tenPercentHome,
                expenses: [
                    { line: '21', column: 'both', description: 'utilities', amount: '2400.00' },
                ],
            })(6000000n)))
            assert(
                message.includes('utilities') && message.includes('neither direct nor indirect'),
                ['the refusal must name the entry and both printed columns', message])
            assertNamesTheDestination(message)
        },
        // The CONTROL for both tag gates: every printed line and every
        // printed column is ACCEPTED. A gate that refused every tag would pass
        // the two leaves above.
        //
        // The loop is over the module's OWN exported tuples, which cannot
        // notice one shrinking — so both counts are hand-typed beside it, the
        // idiom AGENTS.md prescribes for exactly this shape.
        everyPrintedLineAndColumnIsAccepted: () => {
            assertEq(printedOperatingExpenseLines.length, 7, 'f8829 prints lines 16 through 22')
            assertEq(printedExpenseColumns.length, 2, 'and two columns, (a) and (b)')
            for (const line of printedOperatingExpenseLines) {
                for (const column of printedExpenseColumns) {
                    const result = expectOk(form8829(inputOf({
                        ...tenPercentHome,
                        expenses: [
                            { line, column, description: 'an expense', amount: '1000.00' },
                        ],
                    })(6000000n)))
                    assertEq(
                        column === 'direct' ? result.line23DirectCents : result.line23IndirectCents,
                        100000n,
                        [`line ${line} column ${column} reaches its own column total`])
                    const caption = operatingExpenseLineCaptions[line]
                    assert(caption !== undefined, ['every printed line has a caption', line])
                }
            }
        },
        // ── R8: the operating-expense limitation ────────────────────────────
        //
        // $2,000.00 of tentative profit against $9,600.00 of indirect
        // expenses at 100% use: line 26 is $9,600.00, line 15 is $2,000.00,
        // and $7,600.00 would carry out on line 43.
        aBindingOperatingLimitationIsRefusedNamingLineFortyThree: () => {
            const message = expectRefusal(form8829(inputOf({
                ...tenPercentHome, areaUsedForBusiness: 900, totalAreaOfHome: 900,
                expenses: [
                    { line: '19', column: 'indirect', description: 'rent', amount: '9600.00' },
                ],
            })(200000n)))
            assert(
                message.includes('line 27') && message.includes('line 43')
                && message.includes('7600.00'),
                ['the refusal must name both printed lines and quote what would have carried out',
                    message])
            assert(
                message.includes('fully allowed this year computes'),
                ['and state the asymmetry that IS the design', message])
            assertNamesTheDestination(message)
        },
        // ── R9: the SECOND tier, reached with the first fully allowed ───────
        //
        // The tiers are ordered, so a return can have every operating expense
        // allowed and still be limited on depreciation. $600.00 of profit
        // against $500.00 of rent at 100% use leaves $100.00 for a $512.80
        // depreciation: $412.80 would carry out on line 44. Without this leaf,
        // deleting the line 44 refusal would leave the suite green.
        aBindingDepreciationLimitationIsRefusedNamingLineFortyFour: () => {
            const message = expectRefusal(form8829(inputOf({
                ...tenPercentHome, areaUsedForBusiness: 900, totalAreaOfHome: 900,
                expenses: [
                    { line: '19', column: 'indirect', description: 'rent', amount: '500.00' },
                ],
            })(60000n)))
            assert(
                message.includes('line 33') && message.includes('line 44'),
                ['the refusal must name both printed lines', message])
            // $250,000 - $50,000 = $200,000 at 100% x 2.564% = $5,128.00, of
            // which $100.00 is allowed, so $5,028.00 carries out. Hand-typed.
            assert(
                message.includes('5028.00'),
                ['and quote what would have carried out', message])
            assert(
                message.includes('the one that binds SECOND'),
                ['and say that this is the SECOND tier, which is the whole reason this leaf is '
                    + 'distinguishable from the line 43 one', message])
            assertNamesTheDestination(message)
        },
        // THE CONTROL for both limitation refusals, and it is one cent the
        // other side of the boundary: line 26 exactly EQUAL to line 15
        // computes, because line 43 is then zero. A gate written `>=` rather
        // than `>` would refuse this.
        expensesExactlyEqualToTheCeilingCompute: () => {
            const result = expectOk(form8829(inputOf({
                ...tenPercentHome, areaUsedForBusiness: 900, totalAreaOfHome: 900,
                firstUsedForBusiness: '2019-06',
                homeAdjustedBasisOrFairMarketValue: '0.00',
                landIncludedInThatBasis: '0.00',
                expenses: [
                    { line: '19', column: 'indirect', description: 'rent', amount: '2000.00' },
                ],
            })(200000n)))
            assertEq(result.line15Cents, 200000n, '$2,000.00 of room')
            assertEq(result.line26Cents, 200000n, 'and exactly $2,000.00 of expenses')
            assertEq(result.line27Cents, 200000n, 'all of it allowed')
            assertEq(result.line43Cents, 0n, 'nothing carries out, so nothing refuses')
            assertEq(result.line36Cents, 200000n)
        },
        // One cent MORE, and it refuses. The boundary from the other side.
        oneCentOverTheCeilingRefuses: () => {
            const message = expectRefusal(form8829(inputOf({
                ...tenPercentHome, areaUsedForBusiness: 900, totalAreaOfHome: 900,
                homeAdjustedBasisOrFairMarketValue: '0.00',
                landIncludedInThatBasis: '0.00',
                expenses: [
                    { line: '19', column: 'indirect', description: 'rent', amount: '2000.01' },
                ],
            })(200000n)))
            assert(message.includes('0.01'), ['one cent is a carryover too', message])
        },
        // ── Part III's three refusals ───────────────────────────────────────
        anAdditionOrImprovementIsRefusedNamingTheSeparateComputation: () => {
            const message = expectRefusal(form8829(inputOf({
                ...tenPercentHome, additionsOrImprovementsPlacedInService: true,
            })(6000000n)))
            assert(
                message.includes('lines 37 through 40') && message.includes('See attached'),
                ['the refusal must name the lines the improvements are excluded from', message])
            assertNamesTheDestination(message)
        },
        stoppingBeforeYearEndIsRefusedNamingBothTheDepreciationAndTheExpenses: () => {
            const message = expectRefusal(form8829(inputOf({
                ...tenPercentHome, stoppedUsingTheHomeForBusinessBeforeYearEnd: true,
            })(6000000n)))
            assert(
                message.includes('Sale or Other Disposition Before the Recovery Period Ends'),
                ['the refusal must name the publication section that adjusts line 41', message])
            assert(
                message.includes('portion of the year you used your home for business'),
                ['and the OTHER half of the rule, which reaches lines 16-22', message])
            assertNamesTheDestination(message)
        },
        anUnstatedFirstUseIsRefusedNamingTheSpreadOfTheTable: () => {
            const { firstUsedForBusiness: _dropped, ...unstated } = tenPercentHome
            const message = expectRefusal(form8829(inputOf(unstated)(6000000n)))
            assert(
                message.includes('2.461%') && message.includes('0.107%')
                && message.includes('2.564%'),
                ['the refusal must quote the spread of the answers it will not guess between',
                    message])
            assertNamesTheDestination(message)
        },
        aMalformedFirstUseIsRefused: () => {
            const message = expectRefusal(form8829(inputOf({
                ...tenPercentHome, firstUsedForBusiness: '2025-06-01',
            })(6000000n)))
            assert(
                message.includes('YYYY-MM') && message.includes('mid-month'),
                ['the refusal must name the shape and the convention that explains it', message])
        },
        aHomeFirstUsedAfterTheTaxYearIsRefused: () => {
            const message = expectRefusal(form8829(inputOf({
                ...tenPercentHome, firstUsedForBusiness: '2026-01',
            })(6000000n)))
            assert(
                message.includes('AFTER tax year 2025'),
                ['the refusal must say which way round the years are', message])
        },
        aHomeFirstUsedBeforeNineteenNinetyFourIsRefusedNamingPublicationNineFortySix: () => {
            const message = expectRefusal(form8829(inputOf({
                ...tenPercentHome, firstUsedForBusiness: '1993-04',
            })(6000000n)))
            assert(
                message.includes('Pub. 946') && message.includes('May 12, 1993')
                && message.includes('Pub. 534'),
                ['the refusal must name both publications and the printed date', message])
            assertNamesTheDestination(message)
        },
        // THE CONTROL for the whole first-use block: 1994 is the first year
        // the flat row unambiguously covers, and it computes.
        theFirstYearTheFlatRowCoversComputes: () => {
            const result = expectOk(form8829(inputOf({
                ...tenPercentHome, firstUsedForBusiness: '1994-01',
            })(6000000n)))
            assertEq(result.line41PercentThousandths, 2564n)
            assertEq(result.line42Cents, 51280n, '$512.80')
        },
        aLandValueLargerThanTheBasisIsRefused: () => {
            const message = expectRefusal(form8829(inputOf({
                ...tenPercentHome,
                homeAdjustedBasisOrFairMarketValue: '100000.00',
                landIncludedInThatBasis: '150000.00',
            })(6000000n)))
            assert(
                message.includes('line 39') && message.includes('including land'),
                ['the refusal must name the subtraction and quote the printed phrase that makes '
                    + 'line 38 a PART of line 37', message])
        },
    },
    // ── The counts, hand-typed ──────────────────────────────────────────────
    counts: {
        // The idiom AGENTS.md prescribes for a list a proof loops over: a
        // hand-typed count beside it, so deleting an entry fails here even
        // though the loop iterates one item fewer.
        theTableAndTheVocabulariesAreTheSizeThePrintedPageIs: () => {
            assertEq(
                Object.keys(firstYearDepreciationPercentageThousandths).length,
                12,
                'i8829 line 41 prints twelve monthly rows')
            assertEq(printedOperatingExpenseLines.length, 7, 'and lines 16 through 22 is seven')
            assertEq(Object.keys(operatingExpenseLineCaptions).length, 7, 'one caption each')
            assertEq(printedExpenseColumns.length, 2, 'columns (a) and (b)')
            assertEq(laterYearDepreciationPercentageThousandths, 2564n, '39-year straight line')
            assertEq(firstFlatPercentageYear, 1994, 'the first year after "May 12, 1993"')
        },
    },
}
