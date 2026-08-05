/**
 * The Tax Table (TAX-02): Publication 1040 (2025)'s own "Tax and Earned
 * Income Credit Tables" — the band structure that decides which printed row
 * an income falls in, and an exact rational-arithmetic generator that
 * derives each row's tax from `fjs/tax/params/module.f.js`'s stored
 * ordinary rate brackets, never from a ~2,700-row literal table (see
 * 08-CONTEXT.md's "Representation" decision).
 *
 * ## Band structure, not a uniform width
 *
 * The table's row width is NOT constant: `$0`-`$5` is a $5 row, `$5`-`$25`
 * is two $10 rows, `$25`-`$3,000` is $25 rows, and `$3,000`-`$100,000` is
 * $50 rows — verified directly against Publication 1040 (2025)'s own
 * printed page (08-RESEARCH.md, "The Tax Table's Band Structure"). A
 * generator that assumed a uniform $50 band from $0 would misprice every
 * row below $3,000.
 *
 * ## The midpoint rule, and why it rounds to the nearest DOLLAR, not cent
 *
 * Every row's printed tax is the tax owed on the row's own MIDPOINT income,
 * rounded to the nearest whole dollar (IRS's own published methodology —
 * the printed table never shows cents). This is a materially different
 * rounding step than this project's usual cents-precision `halfUp`: the
 * MFJ `$18,000`-`$18,050` row's midpoint is `$18,025.00`, taxed at the
 * MFJ 10% bracket to give an EXACT `$1,802.50` — correct to the cent, and
 * already an integer number of cents, so rounding to the nearest CENT
 * would leave it at `$1,802.50` unchanged. But Publication 1040 prints
 * `1,803` for this row (verified, 08-RESEARCH.md), because the table
 * additionally rounds that exact tax to the nearest whole DOLLAR
 * (`$1,802.50` ties exactly at the half-dollar, and `halfUp` breaks the
 * tie away from zero, giving `$1,803`). `generateRow` below therefore
 * converts the exact cents-precision tax into a dollar-scale `Rational`
 * before calling `halfUp`, then re-expresses the whole-dollar result in
 * this project's own cents convention (`× 100`) purely so a Tax Table row
 * stays comparable to every other stored dollar amount in this codebase.
 * Skipping the dollar-level round (rounding the cents-Rational directly)
 * reproduces `$1,802.50` — the exact wrong answer Success Criterion 3
 * exists to catch — so this is a deliberate, load-bearing rounding step,
 * not a stylistic choice; hand-verified against every row in
 * `handTranscribedRows` before being trusted (see this module's `proof`).
 *
 * ## The $100,000 refusal
 *
 * Publication 1040 prints "$100,000 or over, use the Tax Computation
 * Worksheet" immediately after the table's last row. `lookupTaxTable`
 * refuses a lookup at or above `$100,000.00` rather than silently
 * returning nothing or the last row — Phase 10's Tax Computation
 * Worksheet (TAX-03) is exactly what belongs past this boundary, and a
 * silent gap here would be invisible until that phase discovered it the
 * hard way.
 *
 * @module
 */
import { assert } from 'functionalscript/fjs/asserts/module.f.js'
import { of, add, multiply, halfUp } from '../../types/rational/module.f.js'
import { centsFromString, centsToString } from '../../exact/module.f.js'
import { taxParamsByYear } from '../params/module.f.js'

/** @import { TaxParamSet, Bracket } from '../params/module.f.js' */
/** @import { Rational } from '../../types/rational/module.f.js' */

/**
 * One region of the Tax Table's band structure: `atLeast`/`lessThan` (the
 * dollar-string boundaries Publication 1040 itself prints as "At
 * least"/"But less than") and `width` (the row width inside this region —
 * `lessThan - atLeast` divides evenly by it).
 * @typedef {{ readonly atLeast: string, readonly lessThan: string, readonly width: string }} BandRegion
 */

/**
 * The Tax Table's verified 5-region band structure — identical across all
 * four filing statuses (08-RESEARCH.md, "Band width does not differ by
 * filing status — confirmed"). Every width below (500, 1000, 1000, 2500,
 * 5000 cents) is even; `generateRow`'s own docstring documents why that
 * matters.
 * @type {readonly BandRegion[]}
 */
export const taxTableBandStructure = [
    { atLeast: '0.00', lessThan: '5.00', width: '5.00' },
    { atLeast: '5.00', lessThan: '15.00', width: '10.00' },
    { atLeast: '15.00', lessThan: '25.00', width: '10.00' },
    { atLeast: '25.00', lessThan: '3000.00', width: '25.00' },
    { atLeast: '3000.00', lessThan: '100000.00', width: '50.00' },
]

/**
 * The table's own upper bound, in cents: exactly $100,000.00. A lookup at
 * or above this bound is refused (`lookupTaxTable`), never silently
 * resolved — see this module's docstring, "The $100,000 refusal".
 * @type {bigint}
 */
export const tableUpperBoundCents = centsFromString('100000.00')

/**
 * The standard marginal-bracket formula, in exact rationals, expressed in
 * CENTS (i.e. the same units as `incomeCents`): recurses over the ordered
 * bracket list — an accumulator of remaining income cents, the previous
 * bracket's own ceiling in cents, and the running `Rational` total —
 * rather than a mutable loop variable, matching this repo's functional
 * style (see `fjs/server/module.f.js`'s `sumInterestOverSubjects` for the
 * same destructure-and-recurse shape). Each bracket covers the lesser of
 * its own remaining capacity (`ceiling - previousCeiling`) and whatever
 * income is left; the last bracket (`ceiling: undefined`) absorbs all
 * remaining income at its own rate. Never uses any floating-point
 * rounding or string-based numeric coercion anywhere in this function —
 * the result is an exact, unrounded `Rational` in cents (which may carry
 * a fractional-cent remainder, e.g. a 37%-bracket band whose width isn't
 * a multiple of 100 cents); rounding is `generateRow`'s job, not this
 * function's.
 * @type {(brackets: readonly Bracket[]) => (incomeCents: bigint) => Rational}
 */
export const cumulativeBracketTaxCents = brackets => incomeCents => {
    /**
     * @type {(remaining: readonly Bracket[]) => (remainingIncomeCents: bigint) => (previousCeilingCents: bigint) => (totalSoFar: Rational) => Rational}
     */
    const walk = remaining => remainingIncomeCents => previousCeilingCents => totalSoFar => {
        if (remainingIncomeCents <= 0n) {
            return totalSoFar
        }
        const [bracket, ...rest] = remaining
        assert(bracket !== undefined, 'expected a bracket to cover all remaining income')
        const ceilingCents = bracket.ceiling === undefined
            ? previousCeilingCents + remainingIncomeCents
            : centsFromString(bracket.ceiling)
        const bandCapacityCents = ceilingCents - previousCeilingCents
        const bandWidthCents = bandCapacityCents < remainingIncomeCents ? bandCapacityCents : remainingIncomeCents
        const bandTaxCents = of(bandWidthCents * BigInt(bracket.ratePercent))(100n)
        return walk(rest)(remainingIncomeCents - bandWidthCents)(ceilingCents)(add(totalSoFar)(bandTaxCents))
    }
    return walk(brackets)(incomeCents)(0n)(of(0n)(1n))
}

/**
 * Rounds an exact cents-precision tax `Rational` to the nearest whole
 * DOLLAR (ties away from zero, via `halfUp`) — Publication 1040's own
 * printing convention, never nearest cent (see this module's docstring,
 * "The midpoint rule, and why it rounds to the nearest DOLLAR, not cent")
 * — then re-expresses that whole-dollar bigint in this project's cents
 * convention (`× 100`) so a Tax Table row's columns stay comparable to
 * every other stored dollar amount in this codebase.
 * @type {(taxCents: Rational) => bigint}
 */
const roundToNearestDollarThenBackToCents = taxCents => halfUp(multiply(taxCents)(of(1n)(100n))) * 100n

/**
 * Generates one column's tax for a band starting at `atLeastCents` and
 * spanning `widthCents`, from a single filing status's ordinary brackets.
 * The row's own printed value is the tax on the band's MIDPOINT income,
 * dollar-rounded (see `roundToNearestDollarThenBackToCents`) — never the
 * tax at the band's lower or upper bound.
 *
 * Every stored band width in `taxTableBandStructure` (500, 1000, 1000,
 * 2500, 5000 cents) is even, so `widthCents / 2n` is always an exact
 * integer division with no truncated remainder — this is a documented
 * invariant of the stored data, not an assumption; this module's own
 * `bandStructureTilesWithNoGapOrOverlap` proof re-derives each width from
 * the stored `atLeast`/`lessThan` pair and asserts this evenness holds.
 * @type {(brackets: readonly Bracket[]) => (atLeastCents: bigint) => (widthCents: bigint) => bigint}
 */
export const generateRow = brackets => atLeastCents => widthCents => {
    const midpointCents = atLeastCents + widthCents / 2n
    return roundToNearestDollarThenBackToCents(cumulativeBracketTaxCents(brackets)(midpointCents))
}

/**
 * One Tax Table row: the printed "At least"/"But less than" band
 * boundaries (in cents) plus the four "Your tax is—" columns Publication
 * 1040 itself prints (Estates & Trusts is excluded — it is not a column on
 * Publication 1040's own Tax Table).
 * @typedef {{
 *   readonly atLeastCents: bigint,
 *   readonly lessThanCents: bigint,
 *   readonly single: bigint,
 *   readonly marriedFilingJointly: bigint,
 *   readonly marriedFilingSeparately: bigint,
 *   readonly headOfHousehold: bigint,
 * }} Row
 */

/**
 * Builds one Tax Table row — all four filing-status columns — for a band
 * starting at `atLeastCents` and spanning `widthCents`.
 * @type {(taxParamSet: TaxParamSet) => (atLeastCents: bigint) => (widthCents: bigint) => Row}
 */
export const rowFor = taxParamSet => atLeastCents => widthCents => ({
    atLeastCents,
    lessThanCents: atLeastCents + widthCents,
    single: generateRow(taxParamSet.ordinaryBrackets.single.brackets)(atLeastCents)(widthCents),
    marriedFilingJointly:
        generateRow(taxParamSet.ordinaryBrackets.marriedFilingJointly.brackets)(atLeastCents)(widthCents),
    marriedFilingSeparately:
        generateRow(taxParamSet.ordinaryBrackets.marriedFilingSeparately.brackets)(atLeastCents)(widthCents),
    headOfHousehold:
        generateRow(taxParamSet.ordinaryBrackets.headOfHousehold.brackets)(atLeastCents)(widthCents),
})

/**
 * Looks up the Tax Table row covering `incomeCents`. Refuses (throws the
 * bare message string via `assert` — never constructs or throws an
 * `Error`) at or above `tableUpperBoundCents` ($100,000.00), naming the Tax
 * Computation Worksheet verbatim as Publication 1040 itself does.
 * Otherwise finds the one `taxTableBandStructure` region containing
 * `incomeCents`, floors `incomeCents` to that region's own band boundary,
 * and builds the row.
 * @type {(taxParamSet: TaxParamSet) => (incomeCents: bigint) => Row}
 */
export const lookupTaxTable = taxParamSet => incomeCents => {
    assert(
        incomeCents < tableUpperBoundCents,
        [
            `income of ${centsToString(incomeCents)} is $100,000 or more`,
            'use the Tax Computation Worksheet',
        ],
    )
    const region = taxTableBandStructure.find(
        candidate => incomeCents >= centsFromString(candidate.atLeast) && incomeCents < centsFromString(candidate.lessThan),
    )
    assert(region !== undefined, ['income falls outside every stored Tax Table band region', centsToString(incomeCents)])
    const widthCents = centsFromString(region.width)
    const regionAtLeastCents = centsFromString(region.atLeast)
    const bandIndex = (incomeCents - regionAtLeastCents) / widthCents
    const atLeastCents = regionAtLeastCents + bandIndex * widthCents
    return rowFor(taxParamSet)(atLeastCents)(widthCents)
}

/**
 * TY2025's parameter set, narrowed exactly ONCE at module scope. This
 * project's `tsconfig.json` sets `noUncheckedIndexedAccess: true`, so
 * indexing the lookup map below by the literal year yields
 * `TaxParamSet | undefined` even though `2025` is a literal key — the
 * open index-signature type `fjs/tax/params/module.f.js` declares does
 * not narrow away on its own. Every later reference to the year-2025
 * parameter set anywhere in this module — including the `proof` below —
 * uses this constant, never a second direct index into the map; a
 * non-null assertion or a type cast is banned by AGENTS.md's hard rules,
 * so `assert` is the only compliant narrowing path here, and it throws a
 * bare string, never an `Error`.
 */
const taxParams2025 = taxParamsByYear[2025]
assert(taxParams2025 !== undefined, 'expected TY2025 parameters to be present in taxParamsByYear')
