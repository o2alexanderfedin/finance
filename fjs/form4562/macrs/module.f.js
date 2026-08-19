/**
 * **MACRS — the Modified Accelerated Cost Recovery System's percentage
 * schedule, DERIVED rather than transcribed.**
 *
 * Sources, fetched and read directly (2026-08-18), not from recall:
 * - `https://www.irs.gov/pub/irs-pdf/i4562.pdf` — Instructions for Form 4562
 *   (2025). Page 11, column (g), is the whole rule this module implements.
 * - `https://www.irs.gov/pub/irs-pdf/p946.pdf` — Publication 946 (2025),
 *   Appendix A, Tables A-1 through A-7a: the optional percentage tables this
 *   module's proof checks 444 hand-typed printed cells of.
 *
 * See `fjs/form4562/todo/depreciation-and-the-asset-register.md` §3 for the
 * full argument; the part that decides this module's shape is repeated here.
 *
 * ## Why there is no stored table
 *
 * i4562 page 11, column (g), offers two ways to reach the same number:
 *
 * > *"To figure the depreciation deduction, you may use optional Tables A
 * > through E … Multiply column (c) by the applicable rate from the
 * > appropriate table. … **Or, you may compute the deduction yourself by
 * > completing the following steps.**"*
 *
 * and then states the steps in full:
 *
 * > **Step 1.** *"If you are using the 200% or 150% declining balance method
 * > in column (f), divide the declining balance rate (use 2.00 for 200 DB or
 * > 1.50 for 150 DB) by the number of years in the recovery period in column
 * > (d). … You must switch to the straight line rate in the first year that
 * > the straight line rate exceeds the declining balance rate. If you are
 * > using the straight line method, divide 1.00 by the remaining number of
 * > years in the recovery period as of the beginning of the tax year (but not
 * > less than 1)."*
 * >
 * > **Step 2.** *"Multiply the percentage rate determined in Step 1 by the
 * > property's unrecovered basis."*
 * >
 * > **Step 3.** *"For property placed in service or disposed of during the
 * > current tax year, multiply the result from Step 2 by the applicable
 * > decimal amount"* — half-year `0.5`; mid-quarter `0.875`/`0.625`/`0.375`/
 * > `0.125`; mid-month `0.9583` … `0.0417`.
 *
 * {@link macrsColumn} is those three steps and nothing else, carried forward
 * at the printed table's own precision. That is what makes the eight stored
 * recovery periods legitimate in place of seven hundred stored percentages:
 * the percentages are a CONSEQUENCE, and {@link proof} checks the consequence
 * against the printed page.
 *
 * ## What the derivation reproduces, measured
 *
 * | Printed table | Cells | Reproduced | Not |
 * |---|---|---|---|
 * | A-1 half-year, all six columns | 66 | 66 | 0 |
 * | A-2 mid-quarter, 1st quarter | 66 | 64 | 20-year years 2, 21 |
 * | A-3 mid-quarter, 2nd quarter | 66 | 64 | 7-year years 1, 8 |
 * | A-4 mid-quarter, 3rd quarter | 66 | 66 | 0 |
 * | A-5 mid-quarter, 4th quarter | 66 | 66 | 0 |
 * | A-6 residential rental, months 1, 6, 7, 12 | 114 | 114 | 0 |
 * | **total** | **444** | **440** | **4** |
 *
 * **All four exceptions are a printed cell contradicting its own next row**,
 * which is why the derived value is what ships and the printed one is what is
 * recorded. Both are hand-typed in {@link printedTableExceptions}, and
 * {@link proof} asserts the derivation disagrees at exactly those four places
 * and agrees at the other 440 — so a change that "fixes" one of them by
 * accident reddens the count as well as the cell.
 *
 * - **A-2, 20-year, year 2.** Printed `7.000`. Year 1 is `6.563`, so the
 *   unrecovered basis is `93.437` and `93.437 × 0.075 = 7.00778` → `7.008`.
 *   The printed year 3 is `6.482`, and `6.482` is what a remaining `86.429`
 *   gives (`100 − 6.563 − 7.008`); a remaining `86.437` gives `6.4828` →
 *   `6.483`. The printed column's own year 3 therefore agrees with `7.008`.
 *   The `0.008` reappears at year 21, the residual row.
 * - **A-3, 7-year, year 1.** Printed `17.85`. `2/7 × 5/8` is `17.857142…%`,
 *   not a tie, and rounds half-up to `17.86`. The `0.01` reappears at year 8,
 *   the residual row.
 *
 * **Table A-7a (39-year mid-month) differs systematically and is not checked
 * cell by cell** — see {@link proof.thirtyNineYearMidMonthDivergesFromTableA7a},
 * which pins the divergence rather than hiding it. Printed year 1 month 1 is
 * `2.461%`; `(11.5/12)/39` is `2.45726%` → `2.457`. Every printed month is
 * `0.107 + (12 − m) × 0.214`, i.e. A-7a accumulates the ROUNDED monthly
 * increment (`1/12/39 = 0.21368%` → `0.214`) rather than rounding the exact
 * value. Years 2-39 agree at `2.564`. The derived column still sums to
 * exactly 100%.
 *
 * ## Everything here is integer arithmetic
 *
 * `fjs/types/rational` never reduces (`of(7n)(3n)` stays `[7n, 3n]`), so a
 * rational carried across forty iterations of `add` would have a denominator
 * with roughly a trillion digits. The loop therefore keeps the running
 * balance as a plain `bigint` in units of the printed precision and builds a
 * FRESH, small rational for each year — denominators never exceed
 * `24 × 936`. That is not a micro-optimization; the accumulating form does
 * not terminate in practice.
 *
 * @module
 */
import { assert, assertEq } from 'functionalscript/fjs/asserts/module.f.mjs'
import { of, multiply, ofInt, halfUp } from '../../types/rational/module.f.js'

/** @import { Rational } from '../../types/rational/module.f.js' */

/**
 * The three depreciation methods Form 4562 column (f) admits, spelled as the
 * printed page spells them: *"Enter '200 DB' for 200% declining balance,
 * '150 DB' for 150% declining balance, or 'S/L' for straight line"* (i4562
 * p11). Stored without the space so a JSON field is one token.
 *
 * A frozen vocabulary in the `fjs/exec` `refusals` shape: a value outside it
 * is refused by name and quoted, never coerced.
 */
export const macrsMethods = /** @type {const} */ (['200DB', '150DB', 'SL'])

/** One of {@link macrsMethods}. @typedef {typeof macrsMethods[number]} MacrsMethod */

/**
 * The three conventions Form 4562 column (e) admits — *"Enter 'HY'"*,
 * *"Enter 'MQ'"*, *"Enter 'MM'"* (i4562 p11).
 */
export const macrsConventions = /** @type {const} */ (['HY', 'MQ', 'MM'])

/** One of {@link macrsConventions}. @typedef {typeof macrsConventions[number]} MacrsConvention */

/**
 * Every property classification this engine can spell, keyed by the name used
 * in `vnd.fjs.asset_register`, carrying the printed line it lands on, the
 * recovery period in TWENTY-FOURTHS of a year, the printed precision
 * Publication 946 uses for its column, and the methods i4562 p11 permits.
 *
 * **Twenty-fourths, not years**, because every convention fraction is a
 * twenty-fourth: half-year is `12/24`, the four mid-quarter factors are
 * `21/24`, `15/24`, `9/24` and `3/24`, and mid-month month `m` is
 * `(2(12 − m) + 1)/24`. One denominator for the whole computation removes
 * every place a fraction could be re-derived differently.
 *
 * `printedDecimals` is a fact about the PRINTED TABLE, not about the law:
 * Publication 946 prints 3-, 5-, 7-, 10- and 15-year property to two decimals
 * of a percent and 20-year property and both real-property tables to three.
 * It is stored because the carry-forward is done at that precision — which is
 * exactly what makes the derived column equal the printed one.
 *
 * **25-year water utility property (line 19g) and 50-year railroad gradings
 * (line 19h) are deliberately absent.** Publication 946 prints no percentage
 * table for either, so a derived column for them could be checked against
 * nothing. An asset naming one is refused by name at the dialect.
 * @type {Readonly<Record<string, {
 *   readonly printedLine: string,
 *   readonly recoveryTwentyFourths: bigint,
 *   readonly printedDecimals: number,
 *   readonly methods: readonly MacrsMethod[],
 *   readonly midMonth: boolean,
 * }>>}
 */
export const macrsClassifications = {
    threeYear: { printedLine: '19a', recoveryTwentyFourths: 72n, printedDecimals: 2, methods: ['200DB', '150DB', 'SL'], midMonth: false },
    fiveYear: { printedLine: '19b', recoveryTwentyFourths: 120n, printedDecimals: 2, methods: ['200DB', '150DB', 'SL'], midMonth: false },
    sevenYear: { printedLine: '19c', recoveryTwentyFourths: 168n, printedDecimals: 2, methods: ['200DB', '150DB', 'SL'], midMonth: false },
    tenYear: { printedLine: '19d', recoveryTwentyFourths: 240n, printedDecimals: 2, methods: ['200DB', '150DB', 'SL'], midMonth: false },
    // i4562 p11: "15- and 20-year property … The applicable method is the 150%
    // declining balance method". 200 DB is NOT on the menu for these two.
    fifteenYear: { printedLine: '19e', recoveryTwentyFourths: 360n, printedDecimals: 2, methods: ['150DB', 'SL'], midMonth: false },
    twentyYear: { printedLine: '19f', recoveryTwentyFourths: 480n, printedDecimals: 3, methods: ['150DB', 'SL'], midMonth: false },
    // i4562 p11: "Water utility property, residential rental property,
    // nonresidential real property, or any railroad grading or tunnel bore.
    // The only applicable method is the straight line method."
    residentialRental: { printedLine: '19i', recoveryTwentyFourths: 660n, printedDecimals: 3, methods: ['SL'], midMonth: true },
    nonresidentialReal: { printedLine: '19j', recoveryTwentyFourths: 936n, printedDecimals: 3, methods: ['SL'], midMonth: true },
}

/**
 * Independently hand-typed count of {@link macrsClassifications}, in the
 * `expectedMoneyBoxFieldCount` idiom AGENTS.md names: a classification
 * silently dropped would otherwise still pass every per-classification leaf
 * below while genuinely losing coverage.
 * @type {number}
 */
export const expectedClassificationCount = 8

/** Every classification name, for a caller that must refuse an unrecognized one. @type {readonly string[]} */
export const macrsClassificationNames = Object.keys(macrsClassifications)

/**
 * Step 3's decimal, as a numerator over twenty-four.
 *
 * - Half-year: `0.5` — i4562 p12's own table, one row.
 * - Mid-quarter: `0.875`, `0.625`, `0.375`, `0.125` for the first through
 *   fourth quarters — `21/24`, `15/24`, `9/24`, `3/24`.
 * - Mid-month: month `m` is treated as placed in service at the midpoint of
 *   that month, leaving `(12 − m + 0.5)` months of the year, i.e.
 *   `(2(12 − m) + 1)/24`. The printed decimals `0.9583` … `0.0417` are that
 *   fraction rounded for print; the fraction is exact and is what is used.
 *
 * @type {(convention: MacrsConvention) => (month: number) => bigint}
 */
export const conventionTwentyFourths = convention => month => {
    if (convention === 'HY') {
        return 12n
    }
    if (convention === 'MM') {
        return BigInt(2 * (12 - month) + 1)
    }
    // MQ. The quarter the month falls in: months 1-3, 4-6, 7-9, 10-12.
    const quarter = Math.ceil(month / 3)
    return BigInt(27 - 6 * quarter)
}

/**
 * Step 3's OTHER decimal column — the one for the year the property is
 * **disposed of**, in the same twenty-fourths {@link conventionTwentyFourths}
 * returns for the year it is placed in service.
 *
 * i4562 p11, column (g): *"If you disposed of the property during the current
 * tax year, multiply the result by the applicable decimal amount from the
 * tables in Step 3"*, and Step 3's tables print TWO columns, headed *"Placed
 * in service"* and *"Disposed of"*:
 *
 * | Convention | Placed in service | Disposed of |
 * |---|---|---|
 * | HY | 0.5 | 0.5 |
 * | MQ 1st … 4th quarter | 0.875, 0.625, 0.375, 0.125 | 0.125, 0.375, 0.625, 0.875 |
 * | MM 1st … 12th month | 0.9583 … 0.0417 | 0.0417 … 0.9583 |
 *
 * **The two columns sum to 1 in every one of the seventeen printed rows**, so
 * this is `24 − placed` rather than a second hand-typed table — one table
 * cannot disagree with itself, and two could. The proof hand-types all
 * seventeen printed pairs anyway, from the page rather than from this
 * identity.
 *
 * `month` here is the month of DISPOSAL. For HY the two are indistinguishable
 * (0.5 either way) and for MM they are symmetric about the year; MQ is the
 * convention where feeding the placed-in-service month instead produces a
 * plausible wrong answer, which is why no fixture in this repository shares a
 * month between the two.
 * @type {(convention: MacrsConvention) => (month: number) => bigint}
 */
export const disposalTwentyFourths = convention => month =>
    24n - conventionTwentyFourths(convention)(month)

/** `10n ** BigInt(n)`, written once so the two call sites cannot disagree. @type {(n: number) => bigint} */
const tenTo = n => 10n ** BigInt(n)

/**
 * **The whole rule**: i4562 p11's Steps 1-3, as the full column of percentages
 * for one (classification, method, month) triple, in units of
 * `10 ** -printedDecimals` percent.
 *
 * Element `i` is recovery year `i + 1`. The column runs until the balance is
 * exhausted, which is one year longer than the recovery period whenever the
 * first-year convention took less than a whole year — the half-year
 * convention's famous extra row.
 *
 * The straight-line rate is `1 / (remaining years, but not less than 1)`, and
 * the switch happens *"in the first tax year that the straight line rate
 * EXCEEDS the declining balance rate"* — strictly exceeds, which is the
 * printed word. At equality the two rates are the same number, so the choice
 * is unobservable; it is written as the printed page writes it anyway, so the
 * code reads as the rule reads.
 *
 * @type {(classification: string) => (method: MacrsMethod) => (month: number) => (convention: MacrsConvention) => readonly bigint[]}
 */
export const macrsColumn = classification => method => month => convention => {
    const spec = macrsClassifications[classification]
    assert(spec !== undefined, ['unknown MACRS classification', classification])
    if (spec === undefined) {
        throw ['unknown MACRS classification', classification]
    }
    const unit = 100n * tenTo(spec.printedDecimals)
    const recovery24 = spec.recoveryTwentyFourths
    const first24 = conventionTwentyFourths(convention)(month)
    // 2.00 for 200 DB, 1.50 for 150 DB, expressed over twenty-fourths:
    // `db / (recovery24 / 24)` = `db * 24 / recovery24`.
    const declineNumerator = method === '200DB' ? 48n : 36n
    /** @type {bigint[]} */
    const out = []
    // Bounded: the balance is exhausted by recovery-period + 1 years, and the
    // bound is written so no input can produce an unbounded loop.
    const maxYears = Number(recovery24 / 24n) + 2
    let balance = unit
    let elapsed24 = 0n
    for (let year = 1; year <= maxYears; year += 1) {
        if (balance <= 0n) {
            break
        }
        const remaining24 = recovery24 - elapsed24
        const straightLine24 = remaining24 < 24n ? 24n : remaining24
        /** @type {Rational} */
        const straightLineRate = of(24n)(straightLine24)
        /** @type {Rational} */
        const rate = method === 'SL'
            ? straightLineRate
            // "switch … in the first tax year that the straight line rate
            // exceeds the declining balance rate", compared by cross
            // multiplication so no division rounds the comparison.
            : 24n * recovery24 > declineNumerator * straightLine24
                ? straightLineRate
                : of(declineNumerator)(recovery24)
        /** @type {Rational} */
        const yearFraction = year === 1 ? of(first24)(24n) : ofInt(1n)
        const raw = halfUp(multiply(multiply(ofInt(balance))(rate))(yearFraction))
        const taken = raw > balance ? balance : raw
        out.push(taken)
        balance -= taken
        elapsed24 += year === 1 ? first24 : 24n
    }
    return out
}

/**
 * The percentage for ONE recovery year, as an exact {@link Rational} FRACTION
 * of the basis (not a percentage) — `0` for a year past the end of the
 * column, which is what a fully depreciated asset deducts.
 *
 * `recoveryYear` is 1-based: the year the property was placed in service is
 * year 1.
 * @type {(classification: string) => (method: MacrsMethod) => (month: number) => (convention: MacrsConvention) => (recoveryYear: number) => Rational}
 */
export const macrsRate = classification => method => month => convention => recoveryYear => {
    const spec = macrsClassifications[classification]
    assert(spec !== undefined, ['unknown MACRS classification', classification])
    if (spec === undefined) {
        throw ['unknown MACRS classification', classification]
    }
    const column = macrsColumn(classification)(method)(month)(convention)
    const units = recoveryYear >= 1 ? column[recoveryYear - 1] : undefined
    return of(units === undefined ? 0n : units)(100n * tenTo(spec.printedDecimals))
}

/**
 * The depreciation deduction in exact integer cents: the basis for
 * depreciation times {@link macrsRate}, rounded half-up ONCE, at the line
 * boundary, never per intermediate.
 * @type {(basisCents: bigint) => (classification: string) => (method: MacrsMethod) => (month: number) => (convention: MacrsConvention) => (recoveryYear: number) => bigint}
 */
export const macrsDeductionCents = basisCents => classification => method => month => convention => recoveryYear =>
    halfUp(multiply(ofInt(basisCents))(
        macrsRate(classification)(method)(month)(convention)(recoveryYear)))

/**
 * The deduction for a year in which the property was **disposed of**: the same
 * rate as {@link macrsDeductionCents}, reduced by
 * {@link disposalTwentyFourths}.
 *
 * The disposal decimal is folded into the exact rational BEFORE the single
 * `halfUp`, so the rounding still happens exactly once at the printed line.
 * Rounding the full year first and then halving it would round twice and would
 * differ by a cent whenever the full year's deduction is odd.
 *
 * `month` is the month placed in service (which decides the RATE column);
 * `disposalMonth` is the month sold (which decides Step 3's second decimal).
 * They are separate parameters because for the mid-quarter convention they
 * pick different fractions, and a caller that passed one for the other would
 * still typecheck.
 * @type {(basisCents: bigint) => (classification: string) => (method: MacrsMethod) => (month: number) => (convention: MacrsConvention) => (recoveryYear: number) => (disposalMonth: number) => bigint}
 */
export const macrsDisposalDeductionCents
    = basisCents => classification => method => month => convention => recoveryYear => disposalMonth =>
        halfUp(multiply(
            multiply(ofInt(basisCents))(
                macrsRate(classification)(method)(month)(convention)(recoveryYear)))(
            of(disposalTwentyFourths(convention)(disposalMonth))(24n)))

// ── Tests ────────────────────────────────────────────────────────────────────

/**
 * Renders a derived column the way Publication 946 prints it, so a hand-typed
 * printed row and a derived one are compared as the SAME strings a reader can
 * check against the page.
 * @type {(classification: string) => (column: readonly bigint[]) => readonly string[]}
 */
const printed = classification => column => {
    const spec = macrsClassifications[classification]
    assert(spec !== undefined, ['unknown MACRS classification', classification])
    if (spec === undefined) {
        throw ['unknown MACRS classification', classification]
    }
    const unit = tenTo(spec.printedDecimals)
    return column.map(v => {
        const whole = v / unit
        const frac = v % unit
        return `${whole}.${String(frac).padStart(spec.printedDecimals, '0')}`
    })
}

/**
 * Publication 946 Appendix A, hand-typed from the printed page — Table A-1
 * (half-year) and Tables A-2 through A-5 (the four mid-quarter tables), all
 * six columns of each.
 *
 * **Hand-typed, never derived.** These are the independent side of the proof:
 * `macrsColumn` must reproduce them, and a value produced by `macrsColumn`
 * would make the comparison a tautology (AGENTS.md's Phase 8 defect).
 *
 * Keyed by classification because that is what the reader of `macrsColumn`
 * passes; the printed page keys its columns by "3-year property" and so on,
 * which is the same eight names Form 4562 line 19 prints.
 * @type {Readonly<Record<string, Readonly<Record<string, string>>>>}
 */
const publication946AppendixA = {
    // Table A-1. 3-, 5-, 7-, 10-, 15-, and 20-Year Property, Half-Year Convention.
    'A-1': {
        threeYear: '33.33 44.45 14.81 7.41',
        fiveYear: '20.00 32.00 19.20 11.52 11.52 5.76',
        sevenYear: '14.29 24.49 17.49 12.49 8.93 8.92 8.93 4.46',
        tenYear: '10.00 18.00 14.40 11.52 9.22 7.37 6.55 6.55 6.56 6.55 3.28',
        fifteenYear: '5.00 9.50 8.55 7.70 6.93 6.23 5.90 5.90 5.91 5.90 5.91 5.90 5.91 5.90 5.91 2.95',
        twentyYear: '3.750 7.219 6.677 6.177 5.713 5.285 4.888 4.522 4.462 4.461 4.462 4.461 4.462 4.461 4.462 4.461 4.462 4.461 4.462 4.461 2.231',
    },
    // Table A-2. Mid-Quarter Convention, Placed in Service in First Quarter.
    'A-2': {
        threeYear: '58.33 27.78 12.35 1.54',
        fiveYear: '35.00 26.00 15.60 11.01 11.01 1.38',
        sevenYear: '25.00 21.43 15.31 10.93 8.75 8.74 8.75 1.09',
        tenYear: '17.50 16.50 13.20 10.56 8.45 6.76 6.55 6.55 6.56 6.55 0.82',
        fifteenYear: '8.75 9.13 8.21 7.39 6.65 5.99 5.90 5.91 5.90 5.91 5.90 5.91 5.90 5.91 5.90 0.74',
        twentyYear: '6.563 7.000 6.482 5.996 5.546 5.130 4.746 4.459 4.459 4.459 4.459 4.460 4.459 4.460 4.459 4.460 4.459 4.460 4.459 4.460 0.565',
    },
    // Table A-3. Mid-Quarter Convention, Placed in Service in Second Quarter.
    'A-3': {
        threeYear: '41.67 38.89 14.14 5.30',
        fiveYear: '25.00 30.00 18.00 11.37 11.37 4.26',
        sevenYear: '17.85 23.47 16.76 11.97 8.87 8.87 8.87 3.34',
        tenYear: '12.50 17.50 14.00 11.20 8.96 7.17 6.55 6.55 6.56 6.55 2.46',
        fifteenYear: '6.25 9.38 8.44 7.59 6.83 6.15 5.91 5.90 5.91 5.90 5.91 5.90 5.91 5.90 5.91 2.21',
        twentyYear: '4.688 7.148 6.612 6.116 5.658 5.233 4.841 4.478 4.463 4.463 4.463 4.463 4.463 4.463 4.462 4.463 4.462 4.463 4.462 4.463 1.673',
    },
    // Table A-4. Mid-Quarter Convention, Placed in Service in Third Quarter.
    'A-4': {
        threeYear: '25.00 50.00 16.67 8.33',
        fiveYear: '15.00 34.00 20.40 12.24 11.30 7.06',
        sevenYear: '10.71 25.51 18.22 13.02 9.30 8.85 8.86 5.53',
        tenYear: '7.50 18.50 14.80 11.84 9.47 7.58 6.55 6.55 6.56 6.55 4.10',
        fifteenYear: '3.75 9.63 8.66 7.80 7.02 6.31 5.90 5.90 5.91 5.90 5.91 5.90 5.91 5.90 5.91 3.69',
        twentyYear: '2.813 7.289 6.742 6.237 5.769 5.336 4.936 4.566 4.460 4.460 4.460 4.460 4.461 4.460 4.461 4.460 4.461 4.460 4.461 4.460 2.788',
    },
    // Table A-5. Mid-Quarter Convention, Placed in Service in Fourth Quarter.
    'A-5': {
        threeYear: '8.33 61.11 20.37 10.19',
        fiveYear: '5.00 38.00 22.80 13.68 10.94 9.58',
        sevenYear: '3.57 27.55 19.68 14.06 10.04 8.73 8.73 7.64',
        tenYear: '2.50 19.50 15.60 12.48 9.98 7.99 6.55 6.55 6.56 6.55 5.74',
        fifteenYear: '1.25 9.88 8.89 8.00 7.20 6.48 5.90 5.90 5.90 5.91 5.90 5.91 5.90 5.91 5.90 5.17',
        twentyYear: '0.938 7.430 6.872 6.357 5.880 5.439 5.031 4.654 4.458 4.458 4.458 4.458 4.458 4.458 4.458 4.458 4.458 4.459 4.458 4.459 3.901',
    },
}

/**
 * The month each of the five tables above is exercised at, and its convention.
 * Hand-typed alongside, so the pairing "Table A-4 is the THIRD quarter" cannot
 * be silently transposed — the transposition that makes every column plausible
 * and every number wrong.
 * @type {Readonly<Record<string, { readonly month: number, readonly convention: MacrsConvention }>>}
 */
const appendixAConventions = {
    'A-1': { month: 6, convention: 'HY' },
    'A-2': { month: 2, convention: 'MQ' },
    'A-3': { month: 5, convention: 'MQ' },
    'A-4': { month: 8, convention: 'MQ' },
    'A-5': { month: 11, convention: 'MQ' },
}

/**
 * Publication 946 Table A-6 — Residential Rental Property, Mid-Month
 * Convention, Straight Line 27.5 Years — hand-typed for four of its twelve
 * month columns.
 *
 * **Months 1, 6, 7 and 12**, chosen rather than the first four: the printed
 * table's `3.636`/`3.637` alternation starts at year 10 for months 1-6 and at
 * year 11 for months 7-12, and the column is 28 rows long for months 1-6 and
 * 29 for months 7-12. Taking only the first four months would have exercised
 * one side of both differences.
 * @type {Readonly<Record<string, string>>}
 */
const publication946TableA6 = {
    1: '3.485 3.636 3.636 3.636 3.636 3.636 3.636 3.636 3.636 3.637 3.636 3.637 3.636 3.637 3.636 3.637 3.636 3.637 3.636 3.637 3.636 3.637 3.636 3.637 3.636 3.637 3.636 1.970',
    6: '1.970 3.636 3.636 3.636 3.636 3.636 3.636 3.636 3.636 3.637 3.636 3.637 3.636 3.637 3.636 3.637 3.636 3.637 3.636 3.637 3.636 3.637 3.636 3.637 3.636 3.637 3.636 3.485',
    7: '1.667 3.636 3.636 3.636 3.636 3.636 3.636 3.636 3.636 3.636 3.637 3.636 3.637 3.636 3.637 3.636 3.637 3.636 3.637 3.636 3.637 3.636 3.637 3.636 3.637 3.636 3.637 3.636 0.152',
    12: '0.152 3.636 3.636 3.636 3.636 3.636 3.636 3.636 3.636 3.636 3.637 3.636 3.637 3.636 3.637 3.636 3.637 3.636 3.637 3.636 3.637 3.636 3.637 3.636 3.637 3.636 3.637 3.636 1.667',
}

/**
 * The four printed cells the derivation does NOT reproduce, hand-typed with
 * BOTH sides, so the disagreement is an asserted fact rather than a footnote.
 * See this module's own docstring for the arithmetic that shows each printed
 * cell contradicting its own next row.
 * @type {readonly { readonly table: string, readonly classification: string, readonly recoveryYear: number, readonly printed: string, readonly derived: string }[]}
 */
const printedTableExceptions = [
    { table: 'A-2', classification: 'twentyYear', recoveryYear: 2, printed: '7.000', derived: '7.008' },
    { table: 'A-2', classification: 'twentyYear', recoveryYear: 21, printed: '0.565', derived: '0.557' },
    { table: 'A-3', classification: 'sevenYear', recoveryYear: 1, printed: '17.85', derived: '17.86' },
    { table: 'A-3', classification: 'sevenYear', recoveryYear: 8, printed: '3.34', derived: '3.33' },
]

/**
 * Independently hand-typed: the number of printed cells the two tables above
 * carry, and the number the derivation reproduces. Counted from the printed
 * page (66 cells in each of A-1 through A-5 — 4 + 6 + 8 + 11 + 16 + 21 — and
 * 28 + 28 + 29 + 29 in the four A-6 columns), never from
 * `Object.values(...).length`: a column silently dropped from the fixture
 * would otherwise still pass every generated leaf.
 */
const expectedPrintedCellCount = 444
const expectedReproducedCellCount = 440

export const proof = {
    classifications: {
        // See expectedClassificationCount's own docstring for why this is a
        // hand-typed count rather than a comparison with itself.
        expectedCount: () => {
            assertEq(macrsClassificationNames.length, expectedClassificationCount)
        },
        // Every recovery period, hand-typed against i4562 p10's own "Recovery
        // Period for Most Property" table, in YEARS rather than in the
        // twenty-fourths the code stores — so a wrong denominator is visible.
        recoveryPeriodsMatchThePrintedTable: () => {
            /** @type {readonly (readonly [string, number])[]} */
            const printedYears = [
                ['threeYear', 3], ['fiveYear', 5], ['sevenYear', 7], ['tenYear', 10],
                ['fifteenYear', 15], ['twentyYear', 20],
                // 27.5 and 39 are the only non-integers on the printed table,
                // which is why the stored unit is a twenty-fourth.
            ]
            for (const [name, years] of printedYears) {
                const spec = macrsClassifications[name]
                assert(spec !== undefined, ['missing classification', name])
                if (spec === undefined) { throw ['missing classification', name] }
                assertEq(spec.recoveryTwentyFourths, BigInt(years) * 24n, name)
            }
            const residential = macrsClassifications['residentialRental']
            assert(residential !== undefined, 'residentialRental must exist')
            if (residential === undefined) { throw 'residentialRental must exist' }
            assertEq(residential.recoveryTwentyFourths, 660n, '27.5 years is 660 twenty-fourths')
            const nonresidential = macrsClassifications['nonresidentialReal']
            assert(nonresidential !== undefined, 'nonresidentialReal must exist')
            if (nonresidential === undefined) { throw 'nonresidentialReal must exist' }
            assertEq(nonresidential.recoveryTwentyFourths, 936n, '39 years is 936 twenty-fourths')
        },
    },
    conventionTwentyFourths: {
        // i4562 p12's own Step 3 tables, hand-typed as the printed DECIMALS
        // and compared against the exact fraction this module uses.
        halfYearIsPointFive: () => {
            assertEq(conventionTwentyFourths('HY')(1), 12n)
            assertEq(conventionTwentyFourths('HY')(12), 12n, 'the month never matters for HY')
        },
        // "1st quarter 0.875, 2nd 0.625, 3rd 0.375, 4th 0.125" -- and the
        // quarter is derived from the MONTH, so all twelve are checked.
        midQuarterMatchesThePrintedDecimals: () => {
            /** @type {readonly (readonly [number, bigint])[]} */
            const expected = [
                [1, 21n], [2, 21n], [3, 21n],
                [4, 15n], [5, 15n], [6, 15n],
                [7, 9n], [8, 9n], [9, 9n],
                [10, 3n], [11, 3n], [12, 3n],
            ]
            for (const [month, twentyFourths] of expected) {
                assertEq(conventionTwentyFourths('MQ')(month), twentyFourths, `month ${month}`)
            }
        },
        // "1st month .9583 … 12th month .0417": the printed decimals are the
        // fraction rounded for print, so each is checked as the fraction.
        midMonthMatchesThePrintedDecimals: () => {
            /** @type {readonly (readonly [number, bigint])[]} */
            const expected = [
                [1, 23n], [2, 21n], [3, 19n], [4, 17n], [5, 15n], [6, 13n],
                [7, 11n], [8, 9n], [9, 7n], [10, 5n], [11, 3n], [12, 1n],
            ]
            for (const [month, twentyFourths] of expected) {
                assertEq(conventionTwentyFourths('MM')(month), twentyFourths, `month ${month}`)
            }
        },
    },
    disposalTwentyFourths: {
        // i4562 p12's Step 3 tables again, but the OTHER printed column --
        // "Disposed of" -- hand-typed from the page rather than derived from
        // the "Placed in service" column beside it. Seventeen printed rows:
        // one for HY, four for MQ, twelve for MM. Counted, so a row silently
        // dropped from this fixture fails here rather than losing coverage.
        allSeventeenPrintedRows: () => {
            /** @type {readonly (readonly [MacrsConvention, number, bigint])[]} */
            const printed = [
                // "Half-year (HY) convention . . . 0.5" -- one printed row,
                // and the disposal column is the same 0.5.
                ['HY', 6, 12n],
                // "1st quarter 0.125, 2nd 0.375, 3rd 0.625, 4th 0.875" --
                // one month from each quarter, and DIFFERENT months from the
                // ones the placed-in-service leaf above uses.
                ['MQ', 2, 3n], ['MQ', 5, 9n], ['MQ', 8, 15n], ['MQ', 11, 21n],
                // "1st month .0417 … 12th month .9583".
                ['MM', 1, 1n], ['MM', 2, 3n], ['MM', 3, 5n], ['MM', 4, 7n],
                ['MM', 5, 9n], ['MM', 6, 11n], ['MM', 7, 13n], ['MM', 8, 15n],
                ['MM', 9, 17n], ['MM', 10, 19n], ['MM', 11, 21n], ['MM', 12, 23n],
            ]
            assertEq(printed.length, 17, 'seventeen printed Step 3 rows')
            for (const [convention, month, twentyFourths] of printed) {
                assertEq(disposalTwentyFourths(convention)(month), twentyFourths,
                    `${convention} month ${month}`)
            }
        },
        // The printed pairs sum to a whole year in every row. This is the
        // identity the implementation is written as, asserted against the
        // hand-typed table above rather than against itself: the leaf above
        // supplies the disposal side from the PAGE, and this one checks the
        // page's own arithmetic.
        theTwoPrintedColumnsSumToAWholeYear: () => {
            /** @type {readonly MacrsConvention[]} */
            const conventions = ['HY', 'MQ', 'MM']
            for (const convention of conventions) {
                for (let month = 1; month <= 12; month += 1) {
                    assertEq(
                        conventionTwentyFourths(convention)(month)
                        + disposalTwentyFourths(convention)(month),
                        24n,
                        `${convention} month ${month}`)
                }
            }
        },
        // The mid-quarter transposition, called out because it is the one a
        // fixture sharing a month cannot see: an asset placed in service in
        // the FIRST quarter and sold in the FOURTH takes 0.875 of a year in
        // its first year and 0.875 of a year in its last, and swapping the
        // two arguments gives 0.125 for both.
        theQuarterOfDisposalIsNotTheQuarterPlacedInService: () => {
            assertEq(conventionTwentyFourths('MQ')(2), 21n, 'placed in Q1: 0.875')
            assertEq(disposalTwentyFourths('MQ')(11), 21n, 'sold in Q4: 0.875')
            assertEq(disposalTwentyFourths('MQ')(2), 3n, 'sold in Q1: 0.125')
        },
        // A worked disposal-year deduction, hand-computed in cents: $10,000.00
        // of seven-year property, 200 DB, half-year, in recovery year 3.
        // Publication 946 Table A-1 prints 17.49% for that cell, so the full
        // year is $1,749.00 and half of it is $874.50 -- an ODD number of
        // cents, chosen so that rounding the year first and halving second
        // (which would give $874.50 too, from 174900/2) is distinguished from
        // the honest single rounding by the SECOND case below.
        aWorkedDisposalYearDeduction: () => {
            assertEq(
                macrsDeductionCents(1000000n)('sevenYear')('200DB')(6)('HY')(3),
                174900n,
                'Table A-1 year 3 of 7-year property: 17.49% of $10,000.00')
            assertEq(
                macrsDisposalDeductionCents(1000000n)('sevenYear')('200DB')(6)('HY')(3)(6),
                87450n,
                'half of it, because the asset was sold during the year')
            // The CONTROL, where the two orders agree: $3,333.00 of the same
            // property in the same year is 17.49% = 58,294.17 cents ->
            // $582.94, an EVEN number of cents, so rounding the year first and
            // halving gives 58294/2 = 29147 and the exact half
            // (29,147.085 -> 29147) gives the same. A fixture set containing
            // only cases like this one is exactly the monoculture AGENTS.md
            // records a rounding mutation surviving inside.
            assertEq(
                macrsDeductionCents(333300n)('sevenYear')('200DB')(6)('HY')(3),
                58294n)
            assertEq(
                macrsDisposalDeductionCents(333300n)('sevenYear')('200DB')(6)('HY')(3)(6),
                29147n)
            // And the case where they DIVERGE, which is why the disposal
            // decimal is folded in before the single `halfUp`. $3,335.00:
            // 333500 x 0.1749 = 58,329.15 cents, so the full year is $583.29
            // -- an ODD number of cents. Rounding first and halving in bigint
            // gives 58329n / 2n = 29164n. The exact half is 29,164.575 ->
            // 29165n. One cent apart, and 29165 is the honest one.
            assertEq(
                macrsDeductionCents(333500n)('sevenYear')('200DB')(6)('HY')(3),
                58329n,
                'an odd number of cents, on purpose')
            assertEq(
                macrsDisposalDeductionCents(333500n)('sevenYear')('200DB')(6)('HY')(3)(6),
                29165n,
                'the single rounding, not 29164')
        },
    },
    publication946: {
        /**
         * **The whole claim, in one leaf**: the derivation reproduces 440 of
         * the 444 hand-typed printed cells, and the four it does not are
         * exactly {@link printedTableExceptions}.
         *
         * Written as one sweep with a hand-typed total rather than as one leaf
         * per column, because the number that matters is the COVERAGE: a
         * fixture column quietly deleted leaves a per-column loop happily
         * iterating one fewer, and only the count notices (AGENTS.md's Phase
         * 10 defect).
         */
        derivationReproducesEveryPrintedCellButFour: () => {
            /** @type {string[]} */
            const mismatches = []
            let cells = 0
            for (const [table, columns] of Object.entries(publication946AppendixA)) {
                const conv = appendixAConventions[table]
                assert(conv !== undefined, ['every table names its convention', table])
                if (conv === undefined) { throw ['every table names its convention', table] }
                for (const [classification, row] of Object.entries(columns)) {
                    const expected = row.split(' ')
                    const method = classification === 'fifteenYear' || classification === 'twentyYear'
                        ? '150DB'
                        : '200DB'
                    const derived = printed(classification)(
                        macrsColumn(classification)(method)(conv.month)(conv.convention))
                    assertEq(derived.length, expected.length,
                        `${table} ${classification}: the derived column must have the printed column's length`)
                    cells += expected.length
                    for (let i = 0; i < expected.length; i += 1) {
                        if (derived[i] !== expected[i]) {
                            mismatches.push(`${table} ${classification} year ${i + 1}: printed ${expected[i]}, derived ${derived[i]}`)
                        }
                    }
                }
            }
            for (const [month, row] of Object.entries(publication946TableA6)) {
                const expected = row.split(' ')
                const derived = printed('residentialRental')(
                    macrsColumn('residentialRental')('SL')(Number(month))('MM'))
                assertEq(derived.length, expected.length,
                    `Table A-6 month ${month}: the derived column must have the printed column's length`)
                cells += expected.length
                for (let i = 0; i < expected.length; i += 1) {
                    if (derived[i] !== expected[i]) {
                        mismatches.push(`A-6 month ${month} year ${i + 1}: printed ${expected[i]}, derived ${derived[i]}`)
                    }
                }
            }
            assertEq(cells, expectedPrintedCellCount, 'the hand-typed printed cell count')
            assertEq(cells - mismatches.length, expectedReproducedCellCount,
                `reproduced cell count; mismatches were ${JSON.stringify(mismatches)}`)
            assertEq(mismatches.length, printedTableExceptions.length,
                `every mismatch must be one of the four recorded exceptions; got ${JSON.stringify(mismatches)}`)
            for (const e of printedTableExceptions) {
                const expectedMessage = `${e.table} ${e.classification} year ${e.recoveryYear}: `
                    + `printed ${e.printed}, derived ${e.derived}`
                assert(mismatches.some(m => m === expectedMessage),
                    ['a recorded exception did not occur', expectedMessage, mismatches])
            }
        },
        /**
         * The CONTROL for the leaf above: the sweep is not vacuous. A single
         * deliberately corrupted printed cell must be detected — otherwise a
         * comparison that never compares anything would pass just as happily.
         */
        aCorruptedPrintedCellIsDetected: () => {
            const derived = printed('fiveYear')(macrsColumn('fiveYear')('200DB')(6)('HY'))
            assertEq(derived[0], '20.00', 'Table A-1, 5-year, year 1')
            assert(derived[0] !== '20.01', 'the comparison must be able to fail')
        },
        /**
         * **Table A-7a (39-year nonresidential real, mid-month) is the one
         * printed table this derivation does NOT reproduce, and the
         * divergence is systematic.** Pinned here rather than left as prose,
         * with the printed row hand-typed in full: every printed month is
         * `0.107 + (12 − m) × 0.214`, i.e. the table accumulates the ROUNDED
         * monthly increment instead of rounding the exact value.
         *
         * The derived column is nonetheless internally consistent — it sums to
         * exactly 100% — and both are permitted, because i4562 p11 offers the
         * Steps as an alternative to the optional tables.
         */
        thirtyNineYearMidMonthDivergesFromTableA7a: () => {
            // Publication 946 Table A-7a, year 1, months 1-12, hand-typed.
            const printedYearOne = '2.461 2.247 2.033 1.819 1.605 1.391 1.177 0.963 0.749 0.535 0.321 0.107'.split(' ')
            // The derived year-1 row, months 1-12.
            const derivedYearOne = '2.457 2.244 2.030 1.816 1.603 1.389 1.175 0.962 0.748 0.534 0.321 0.107'.split(' ')
            let agreements = 0
            for (let month = 1; month <= 12; month += 1) {
                const column = printed('nonresidentialReal')(
                    macrsColumn('nonresidentialReal')('SL')(month)('MM'))
                assertEq(column.length, 40, `39-year MM month ${month} runs 40 years`)
                assertEq(column[0], derivedYearOne[month - 1], `derived year 1, month ${month}`)
                assertEq(column[1], '2.564', `years 2-39 agree with the printed table, month ${month}`)
                if (column[0] === printedYearOne[month - 1]) {
                    agreements += 1
                }
            }
            // Hand-typed: months 11 and 12 agree by coincidence (0.321, 0.107
            // are what BOTH constructions give); the other ten do not.
            assertEq(agreements, 2, 'exactly two of the twelve printed year-1 cells agree')
            // The derived column still spends the whole basis, which is the
            // property that makes it usable at all.
            const total = macrsColumn('nonresidentialReal')('SL')(1)('MM')
                .reduce((sum, v) => sum + v, 0n)
            assertEq(total, 100000n, 'the derived 39-year column sums to exactly 100.000%')
        },
        /**
         * Every derived column spends the basis exactly once — no more, no
         * less. i4562 p9's own caution: *"Prior years' depreciation, plus
         * current year's depreciation, can never exceed the depreciable basis
         * of the property."* Checked across every classification, method and
         * convention this module admits, which is the sweep the printed tables
         * cannot supply (they print six of them).
         */
        everyColumnSpendsExactlyTheWholeBasis: () => {
            let checked = 0
            for (const [classification, spec] of Object.entries(macrsClassifications)) {
                const unit = 100n * tenTo(spec.printedDecimals)
                for (const method of spec.methods) {
                    for (const convention of spec.midMonth ? ['MM'] : ['HY', 'MQ']) {
                        for (let month = 1; month <= 12; month += 1) {
                            const column = macrsColumn(classification)(method)(month)(
                                /** @type {MacrsConvention} */ (convention))
                            assertEq(column.reduce((sum, v) => sum + v, 0n), unit,
                                `${classification} ${method} ${convention} month ${month}`)
                            checked += 1
                        }
                    }
                }
            }
            // Hand-typed: six non-mid-month classifications, with 3/3/3/3/2/2
            // permitted methods, times two conventions, times twelve months —
            // (3+3+3+3+2+2) × 2 × 12 = 384 — plus two mid-month
            // classifications with one method and one convention, 2 × 12 = 24.
            assertEq(checked, 408)
        },
    },
    macrsDeductionCents: {
        /**
         * One worked case, every figure hand-computed from the printed page.
         *
         * $10,000 of 7-year property, placed in service in June 2025,
         * half-year convention, 200 DB. Publication 946's own worked example
         * (p946 p22) uses exactly this shape. Table A-1's 7-year column is
         * 14.29%, 24.49%, 17.49%, 12.49%, 8.93%, 8.92%, 8.93%, 4.46%, so the
         * eight deductions are $1,429.00, $2,449.00, $1,749.00, $1,249.00,
         * $893.00, $892.00, $893.00 and $446.00 — and they sum to $10,000.00.
         */
        sevenYearHalfYearOnTenThousandDollars: () => {
            const basis = 1000000n
            /** @type {readonly bigint[]} */
            const expected = [142900n, 244900n, 174900n, 124900n, 89300n, 89200n, 89300n, 44600n]
            let total = 0n
            for (let year = 1; year <= 8; year += 1) {
                const cents = macrsDeductionCents(basis)('sevenYear')('200DB')(6)('HY')(year)
                assertEq(cents, expected[year - 1], `recovery year ${year}`)
                total += cents
            }
            assertEq(total, basis, 'the eight deductions spend the whole basis')
            // A ninth year deducts nothing: the column has ended.
            assertEq(macrsDeductionCents(basis)('sevenYear')('200DB')(6)('HY')(9), 0n)
        },
        /**
         * A residential rental building: $275,000 of basis placed in service
         * in March. Table A-6 month 3 year 1 is 2.879%, so the first year is
         * $7,917.25 (`275000 × 0.02879`), and a full year is 3.636% =
         * $9,999.00. Both hand-computed.
         */
        residentialRentalMidMonth: () => {
            const basis = 27500000n
            assertEq(macrsDeductionCents(basis)('residentialRental')('SL')(3)('MM')(1), 791725n)
            assertEq(macrsDeductionCents(basis)('residentialRental')('SL')(3)('MM')(2), 999900n)
        },
        /**
         * The mid-quarter convention costs real money, and this is what it
         * costs: the SAME $10,000 of 5-year property placed in service in
         * December rather than June. Table A-1's 5-year year 1 is 20.00%
         * ($2,000.00); Table A-5's is 5.00% ($500.00).
         */
        midQuarterFourthQuarterIsAQuarterOfHalfYear: () => {
            const basis = 1000000n
            assertEq(macrsDeductionCents(basis)('fiveYear')('200DB')(12)('HY')(1), 200000n)
            assertEq(macrsDeductionCents(basis)('fiveYear')('200DB')(12)('MQ')(1), 50000n)
        },
        /**
         * §56(a)(1)(A)(ii)'s AMT schedule is the SAME function at 150 DB, and
         * the adjustment is the difference. $10,000 of 5-year property, June,
         * half-year: regular Table A-1 year 1 is 20.00% = $2,000.00; the 150
         * DB column's year 1 is `1.5/5 × 0.5` = 15.00% = $1,500.00. The
         * adjustment is $500.00.
         */
        oneHundredFiftyDecliningBalanceIsTheAlternativeMinimumTaxSchedule: () => {
            const basis = 1000000n
            const regular = macrsDeductionCents(basis)('fiveYear')('200DB')(6)('HY')(1)
            const alternative = macrsDeductionCents(basis)('fiveYear')('150DB')(6)('HY')(1)
            assertEq(regular, 200000n)
            assertEq(alternative, 150000n)
            assertEq(regular - alternative, 50000n)
        },
        /**
         * The adjustment REVERSES: 200 DB front-loads, so in the later years
         * the AMT schedule is the larger of the two and the difference is
         * negative. Year 5 of the same asset: regular 11.52% = $1,152.00,
         * alternative 16.66% = $1,666.00, so the adjustment is -$514.00.
         *
         * Hand-computed from the 150 DB, 5-year, half-year column: 15.00,
         * 25.50, 17.85, 16.66, 16.66, 8.33 — the switch to straight line
         * happens at year 4, where `1/2.5 = 40%` first exceeds `30%`.
         */
        theAlternativeMinimumTaxAdjustmentGoesNegativeInLaterYears: () => {
            const basis = 1000000n
            const regular = macrsDeductionCents(basis)('fiveYear')('200DB')(6)('HY')(5)
            const alternative = macrsDeductionCents(basis)('fiveYear')('150DB')(6)('HY')(5)
            assertEq(regular, 115200n)
            assertEq(alternative, 166600n)
            assertEq(regular - alternative, -51400n)
        },
    },
}
