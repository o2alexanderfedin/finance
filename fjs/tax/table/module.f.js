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
 * ## The other side of that boundary: the Tax Computation Worksheet
 *
 * `taxComputationWorksheet` (TAX-03) is the mirror of `lookupTaxTable`:
 * it refuses BELOW $100,000 and names the Tax Table as the remedy, exactly
 * as `lookupTaxTable` refuses at or above and names the worksheet. It is
 * not new arithmetic — the twenty rows Publication 1040's own worksheet
 * prints (i1040gi printed page 80, NOT p124, which is the alphabetical
 * index) are each `rate x taxableIncome - subtraction`, and every one of
 * the twenty printed subtraction constants is exactly
 * `rate x bracketLowerBound - taxAt(bracketLowerBound)`. So the printed
 * worksheet IS `cumulativeBracketTaxCents`, and this module reuses that
 * one bracket walk rather than growing a second one.
 * `taxComputationWorksheetReproducesAllTwentyPrintedRows` proves that on
 * all twenty rows against hand-transcribed printed constants rather than
 * assuming it.
 *
 * The two are joined by `baseTaxForAmount`, the level-3 lookup that
 * returns WHICH method it used, not only a number.
 *
 * @module
 */
import { assert, assertEq } from 'functionalscript/fjs/asserts/module.f.mjs'
import { of, add, multiply, halfUp } from '../../types/rational/module.f.js'
import { centsFromString, centsToString } from '../../exact/module.f.js'
import { taxParamsByYear, individualFilingStatuses } from '../params/module.f.js'
import { refuses } from '../../refuses/module.f.js'

/** @import { TaxParamSet, Bracket, IndividualFilingStatus } from '../params/module.f.js' */
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
 * The Tax Computation Worksheet (TAX-03) — the method Publication 1040
 * directs a filer to at or above $100,000.00, and the exact mirror of
 * `lookupTaxTable`: this function REFUSES below `tableUpperBoundCents`
 * (throwing the bare value via `assert` — never an `Error`) and names the
 * Tax Table as the remedy, just as `lookupTaxTable` refuses at or above
 * and names this worksheet. Between them there is no income at which
 * both answer, and none at which neither does.
 *
 * Not new arithmetic. See this module's docstring: the twenty printed
 * rows are `rate x income - subtraction`, and each subtraction constant
 * is `rate x bracketLowerBound - taxAt(bracketLowerBound)`, so the
 * printed worksheet is `cumulativeBracketTaxCents` written in a form a
 * human can evaluate with a pocket calculator. Reusing the existing
 * bracket walk is therefore the accurate implementation, not a shortcut —
 * a second, worksheet-shaped arithmetic path would be a duplicate rule
 * that could rot against this one (AGENTS.md, "One rule, one place").
 *
 * ## Rounding: to the nearest CENT, never to whole dollars
 *
 * This is deliberate and it differs from the Tax Table's rule directly
 * above. A worksheet line is a line boundary (EXACT-04), so it rounds to
 * this project's own cents precision via `halfUp` — it must NOT call
 * `roundToNearestDollarThenBackToCents`, which encodes the printed
 * TABLE's convention (the printed page has no cents column, so its rows
 * cannot carry cents; a worksheet the filer fills in by hand can and
 * does). Whole dollars are the taxpayer's Form 1040 p23 ELECTION, applied
 * once over the whole report by `applyWholeDollarElection` — a property
 * of the return, not of this worksheet.
 *
 * **Assumption A2 is RESOLVED — 2026-08-17, from the printed page, and it
 * never needed a filed return.** 10-RESEARCH.md recorded a residual
 * uncertainty here on the grounds that "the IRS states no TCW-specific
 * rounding rule", routing the question to Phase 14's acceptance against the
 * user's own return. That was the wrong place to look. The worksheet settles
 * it structurally: **its own printed subtraction amounts carry cents.**
 * Pub. 1040 (2025) p14-15 prints `$60,905.50` for the MFJ 35% row,
 * `$75,937.50` for MFJ 37%, and `$30,452.75`, `$42,979.75` and `$37,968.75`
 * for three more. A worksheet that rounded to whole dollars could not print
 * a quarter of a dollar in the constant a filer subtracts, so cent
 * precision is a property of the form's own design, not an inference from
 * the general p23 rule.
 *
 * The pinned figure follows directly: 35% x $700,000.00 - $60,905.50 =
 * **$184,094.50**, the exact value this module's `proof` asserts. All twenty
 * rows in {@link taxComputationWorksheetRows} were re-verified against that
 * printed page the same day, with zero mismatches, and Section B's own
 * heading -- "Married filing jointly **or Qualifying surviving spouse**" --
 * is what `taxTableColumnFor.qualifyingSurvivingSpouse` mirrors.
 * @type {(brackets: readonly Bracket[]) => (incomeCents: bigint) => bigint}
 */
export const taxComputationWorksheet = brackets => incomeCents => {
    assert(
        incomeCents >= tableUpperBoundCents,
        [
            `income of ${centsToString(incomeCents)} is below $100,000`,
            'use the Tax Table',
        ],
    )
    return halfUp(cumulativeBracketTaxCents(brackets)(incomeCents))
}

/**
 * The four money columns Publication 1040's printed Tax Table actually
 * has — and therefore the four money keys of a `Row`. There is no
 * qualifying-surviving-spouse column on the printed page.
 * @typedef {'single' | 'marriedFilingJointly' | 'marriedFilingSeparately' | 'headOfHousehold'} TaxTableColumn
 */

/**
 * Which printed Tax Table column each individual filing status reads.
 * Four statuses read their own; a QUALIFYING SURVIVING SPOUSE reads the
 * married-filing-jointly column, because Publication 1040's Tax Table
 * prints no QSS column at all. The Tax Computation Worksheet says the
 * same thing in its own words — its Section B is headed "Married filing
 * jointly or Qualifying surviving spouse" (see
 * `handTranscribedTaxComputationWorksheetRows`) — so this is the primary
 * source's mapping, not an inference from the two statuses happening to
 * share dollar amounts.
 *
 * This is the ONE place that mapping exists. A call site must never
 * re-decide it: QSS is a filing status in its own right in
 * `fjs/tax/params` (10-CONTEXT.md Decision 6, because its maximum
 * age/blindness box count is 2 where MFJ's is 4), so "QSS is just MFJ"
 * is true of exactly this lookup and false in general — precisely the
 * kind of half-truth that gets copied to a second site and then applied
 * where it does not hold.
 *
 * Typed as a `Record` over the whole `IndividualFilingStatus` union
 * deliberately: a sixth filing status added to `fjs/tax/params` later
 * fails `tsc` HERE, at the one place that must decide what column it
 * reads, rather than falling through silently to a wrong number.
 * @type {Record<IndividualFilingStatus, TaxTableColumn>}
 */
export const taxTableColumnFor = {
    single: 'single',
    marriedFilingJointly: 'marriedFilingJointly',
    marriedFilingSeparately: 'marriedFilingSeparately',
    headOfHousehold: 'headOfHousehold',
    qualifyingSurvivingSpouse: 'marriedFilingJointly',
}

/**
 * Which of Form 1040 line 16's two BASE methods produced an amount — the
 * Tax Table, or the Tax Computation Worksheet. (The QDCGT worksheet and
 * the Schedule D Tax Worksheet sit a level ABOVE this and are the
 * dispatcher's business, not this lookup's; both of the former call back
 * DOWN into this one.)
 * @typedef {'taxTable' | 'taxComputationWorksheet'} Line16BaseMethod
 */

/**
 * A base-tax answer: the cents, and which method produced them.
 * @typedef {{ readonly method: Line16BaseMethod, readonly cents: bigint }} BaseTaxResult
 */

/**
 * The level-3 base lookup (TAX-03): tax on an amount, by the Tax Table
 * below $100,000.00 and by the Tax Computation Worksheet at or above it —
 * decided in ONE place, which returns WHICH method it used rather than
 * only a number.
 *
 * ## Why the tag exists at all
 *
 * Because a proof asserting only `cents` cannot distinguish "chose the
 * QDCGT worksheet and got the right answer" from "chose the Tax Table and
 * got the right answer because the taxpayer had no preferential income."
 * Those are the same number and different engines, and only one of them
 * stays right when the taxpayer's facts change. The tag is what makes
 * TAX-03's "explicit dispatch" testable instead of merely asserted.
 *
 * It also pins the $100,000 seam, where the two methods genuinely
 * disagree: one more cent of taxable income moves a single filer from
 * $16,909 to $16,914 — a $5 jump — because the Tax Table prices the
 * MIDPOINT of a $50 band while the worksheet prices the income itself.
 * Nothing above line 16 can see that discontinuity, so it is pinned here.
 *
 * ## The structural fact Plan 10-06 depends on
 *
 * The QDCGT worksheet's lines 22 and 24 call this function SEPARATELY,
 * with DIFFERENT amounts. One execution of one return can therefore
 * legitimately use the Tax Table for one of them and the Tax Computation
 * Worksheet for the other — so neither the method nor the cents may be
 * computed once and reused for both.
 * @type {(taxParamSet: TaxParamSet) => (status: IndividualFilingStatus) => (incomeCents: bigint) => BaseTaxResult}
 */
export const baseTaxForAmount = taxParamSet => status => incomeCents => {
    if (incomeCents < tableUpperBoundCents) {
        // `taxTableColumnFor` is a `Record` keyed by the status union and
        // `Row` is a concrete object type, so both lookups below are total
        // and neither needs a cast or a non-null assertion — the shape of
        // the types is what makes AGENTS.md's ban on those affordable here.
        const column = taxTableColumnFor[status]
        return { method: 'taxTable', cents: lookupTaxTable(taxParamSet)(incomeCents)[column] }
    }
    return {
        method: 'taxComputationWorksheet',
        cents: taxComputationWorksheet(taxParamSet.ordinaryBrackets[status].brackets)(incomeCents),
    }
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

// ── Tests ────────────────────────────────────────────────────────────────────

/**
 * One row hand-transcribed directly from the printed Tax Table. Every
 * printed amount is a whole-dollar `number` (the table never prints
 * cents); `rowByRowDiffMatchesPublishedTable` converts to this project's
 * cents convention before comparing against `lookupTaxTable`'s output.
 * @typedef {{
 *   readonly atLeast: string,
 *   readonly lessThan: string,
 *   readonly single: number,
 *   readonly marriedFilingJointly: number,
 *   readonly marriedFilingSeparately: number,
 *   readonly headOfHousehold: number,
 * }} TranscribedRow
 */

/**
 * Ten rows hand-transcribed directly from Publication 1040 (2025)'s own
 * printed Tax Table — the independent side of T-08-01's diff. These share
 * NO code path with `generateRow`/`cumulativeBracketTaxCents`: every
 * figure below was read off the printed page, never computed by the code
 * under test (08-VALIDATION.md, T-08-01; mutation-verified in this
 * plan's Task 3). The sample spans every band-width region, both width
 * transitions (the $10->$25 narrowing at $25, and the $25->$50 widening
 * at $3,000), Success Criterion 3's own $18,000 MFJ row, and the table's
 * final row immediately before the $100,000 refusal boundary.
 * @type {readonly TranscribedRow[]}
 */
export const handTranscribedRows = [
    // Publication 1040 (2025), Tax and Earned Income Credit Tables, read directly.
    { atLeast: '0.00', lessThan: '5.00', single: 0, marriedFilingJointly: 0, marriedFilingSeparately: 0, headOfHousehold: 0 },
    { atLeast: '5.00', lessThan: '15.00', single: 1, marriedFilingJointly: 1, marriedFilingSeparately: 1, headOfHousehold: 1 },
    { atLeast: '15.00', lessThan: '25.00', single: 2, marriedFilingJointly: 2, marriedFilingSeparately: 2, headOfHousehold: 2 },
    { atLeast: '25.00', lessThan: '50.00', single: 4, marriedFilingJointly: 4, marriedFilingSeparately: 4, headOfHousehold: 4 },
    // Publication 1040 (2025), page 2, read from the printed table -- these
    // two rows are NOT given literal values anywhere in 08-RESEARCH.md, and
    // deriving them from generateRow/cumulativeBracketTaxCents would
    // reintroduce T-08-01's tautology for these two rows specifically, so
    // they were transcribed independently, character by character, from
    // the printed page rather than computed.
    { atLeast: '975.00', lessThan: '1000.00', single: 99, marriedFilingJointly: 99, marriedFilingSeparately: 99, headOfHousehold: 99 },
    { atLeast: '1000.00', lessThan: '1025.00', single: 101, marriedFilingJointly: 101, marriedFilingSeparately: 101, headOfHousehold: 101 },
    // Publication 1040 (2025), Tax and Earned Income Credit Tables, read
    // directly -- the $25->$50 band-width transition.
    { atLeast: '2975.00', lessThan: '3000.00', single: 299, marriedFilingJointly: 299, marriedFilingSeparately: 299, headOfHousehold: 299 },
    { atLeast: '3000.00', lessThan: '3050.00', single: 303, marriedFilingJointly: 303, marriedFilingSeparately: 303, headOfHousehold: 303 },
    // Publication 1040 (2025), Tax and Earned Income Credit Tables, read
    // directly -- Success Criterion 3's own row.
    { atLeast: '18000.00', lessThan: '18050.00', single: 1925, marriedFilingJointly: 1803, marriedFilingSeparately: 1925, headOfHousehold: 1823 },
    // Publication 1040 (2025), Tax and Earned Income Credit Tables, read
    // directly -- the table's last row, immediately followed on the
    // printed page by "$100,000 or over, use the Tax Computation
    // Worksheet".
    { atLeast: '99950.00', lessThan: '100000.00', single: 16909, marriedFilingJointly: 11823, marriedFilingSeparately: 16909, headOfHousehold: 15170 },
]

/**
 * One row of the printed Tax Computation Worksheet: the section's filing
 * status, the row's "At least"/"But less than" taxable-income band
 * (`lessThan` is `undefined` on each section's last, open-ended row —
 * absent, never a sentinel, mirroring `Bracket.ceiling`), the
 * whole-number percentage the printed row multiplies by, and the printed
 * SUBTRACTION constant as a decimal string (money is a string, never a
 * JSON number — AGENTS.md).
 *
 * `ratePercent` is a rate, not money, so it is a plain `number`, exactly
 * as `fjs/tax/params`' `Bracket.ratePercent` is.
 * @typedef {{
 *   readonly status: IndividualFilingStatus,
 *   readonly atLeast: string,
 *   readonly lessThan: string | undefined,
 *   readonly ratePercent: number,
 *   readonly subtraction: string,
 * }} TranscribedWorksheetRow
 */

/**
 * All twenty rows of the 2025 Tax Computation Worksheet, hand-transcribed
 * from Form 1040 instructions `i1040gi.pdf`, **printed page 80** — the
 * independent side of T-10-03-01's diff. (Printed page 80, NOT p124: p124
 * is the alphabetical index. An earlier research note had this wrong and
 * the correction is carried here so the citation is checkable.)
 *
 * These constants share NO code path with `cumulativeBracketTaxCents`:
 * every figure below was read off the printed page. That independence is
 * the entire mechanism of `taxComputationWorksheetReproducesAllTwentyPrintedRows`
 * — the moment a subtraction constant here is computed rather than
 * transcribed, the diff becomes the tautology AGENTS.md records this
 * project shipping three times.
 *
 * Printed section B is headed "**Married filing jointly or Qualifying
 * surviving spouse**". That heading is the primary source's OWN
 * confirmation that a QSS filer reads the married-filing-jointly
 * schedule (10-CONTEXT.md Decision 6), and it is what
 * `taxTableColumnFor.qualifyingSurvivingSpouse` rests on — so the
 * worksheet is transcribed with four sections, not five, exactly as
 * printed. Section D (head of household) is where the schedules visibly
 * diverge: its 32% row ends at $250,500.00, $25 below single/MFS's
 * $250,525.00.
 * @type {readonly TranscribedWorksheetRow[]}
 */
export const handTranscribedTaxComputationWorksheetRows = [
    // Section A — Single
    { status: 'single', atLeast: '100000.00', lessThan: '103350.00', ratePercent: 22, subtraction: '5086.00' },
    { status: 'single', atLeast: '103350.00', lessThan: '197300.00', ratePercent: 24, subtraction: '7153.00' },
    { status: 'single', atLeast: '197300.00', lessThan: '250525.00', ratePercent: 32, subtraction: '22937.00' },
    { status: 'single', atLeast: '250525.00', lessThan: '626350.00', ratePercent: 35, subtraction: '30452.75' },
    { status: 'single', atLeast: '626350.00', lessThan: undefined, ratePercent: 37, subtraction: '42979.75' },
    // Section B — Married filing jointly or Qualifying surviving spouse
    { status: 'marriedFilingJointly', atLeast: '100000.00', lessThan: '206700.00', ratePercent: 22, subtraction: '10172.00' },
    { status: 'marriedFilingJointly', atLeast: '206700.00', lessThan: '394600.00', ratePercent: 24, subtraction: '14306.00' },
    { status: 'marriedFilingJointly', atLeast: '394600.00', lessThan: '501050.00', ratePercent: 32, subtraction: '45874.00' },
    { status: 'marriedFilingJointly', atLeast: '501050.00', lessThan: '751600.00', ratePercent: 35, subtraction: '60905.50' },
    { status: 'marriedFilingJointly', atLeast: '751600.00', lessThan: undefined, ratePercent: 37, subtraction: '75937.50' },
    // Section C — Married filing separately
    { status: 'marriedFilingSeparately', atLeast: '100000.00', lessThan: '103350.00', ratePercent: 22, subtraction: '5086.00' },
    { status: 'marriedFilingSeparately', atLeast: '103350.00', lessThan: '197300.00', ratePercent: 24, subtraction: '7153.00' },
    { status: 'marriedFilingSeparately', atLeast: '197300.00', lessThan: '250525.00', ratePercent: 32, subtraction: '22937.00' },
    { status: 'marriedFilingSeparately', atLeast: '250525.00', lessThan: '375800.00', ratePercent: 35, subtraction: '30452.75' },
    { status: 'marriedFilingSeparately', atLeast: '375800.00', lessThan: undefined, ratePercent: 37, subtraction: '37968.75' },
    // Section D — Head of household
    { status: 'headOfHousehold', atLeast: '100000.00', lessThan: '103350.00', ratePercent: 22, subtraction: '6825.00' },
    { status: 'headOfHousehold', atLeast: '103350.00', lessThan: '197300.00', ratePercent: 24, subtraction: '8892.00' },
    { status: 'headOfHousehold', atLeast: '197300.00', lessThan: '250500.00', ratePercent: 32, subtraction: '24676.00' },
    { status: 'headOfHousehold', atLeast: '250500.00', lessThan: '626350.00', ratePercent: 35, subtraction: '32191.00' },
    { status: 'headOfHousehold', atLeast: '626350.00', lessThan: undefined, ratePercent: 37, subtraction: '44718.00' },
]

/**
 * The printed worksheet's row count, hand-typed from the page: four
 * sections of five rows. Deliberately NOT
 * `handTranscribedTaxComputationWorksheetRows.length` — read off the
 * transcription it is meant to police, this constant could never fail,
 * and a row silently dropped in an edit would take the diff's coverage
 * with it while every remaining row still passed.
 */
const expectedTaxComputationWorksheetRowCount = 20

/**
 * $100,000.00 above a section's last, open-ended row — the probe offset
 * that reaches the 37% band without needing a second hand-typed income
 * per section.
 */
const openTopRowProbeOffsetCents = centsFromString('100000.00')

/** One dollar in cents — the step back from a row's exclusive upper bound. */
const oneDollarCents = centsFromString('1.00')

/**
 * The four money columns Publication 1040's Tax Table prints, hand-typed
 * from the printed page rather than read off `taxTableColumnFor`'s own
 * values or off a `Row`'s keys — `everyIndividualFilingStatusMapsToAPrintedColumn`
 * compares the mapping against THIS, so deriving it from the mapping
 * would make that leaf compare the mapping with itself.
 * @type {readonly TaxTableColumn[]}
 */
const printedTaxTableColumns = ['single', 'marriedFilingJointly', 'marriedFilingSeparately', 'headOfHousehold']

/** The printed Tax Table's column count, hand-typed — not `printedTaxTableColumns.length`. */
const expectedPrintedTaxTableColumnCount = 4

export const proof = {
    // T-08-01: every generated row matches the independently-transcribed
    // published figure, across every band-width region and both width
    // transitions. Four separate assertEq calls per row -- never one
    // aggregate deep comparison -- so a single wrong column names itself
    // (mirroring fjs/document/1099int/module.f.js's per-field assertion
    // pattern).
    rowByRowDiffMatchesPublishedTable: () => {
        for (const transcribed of handTranscribedRows) {
            const row = lookupTaxTable(taxParams2025)(centsFromString(transcribed.atLeast))
            assertEq(
                row.single,
                BigInt(transcribed.single) * 100n,
                ['single column mismatch', transcribed.atLeast],
            )
            assertEq(
                row.marriedFilingJointly,
                BigInt(transcribed.marriedFilingJointly) * 100n,
                ['marriedFilingJointly column mismatch', transcribed.atLeast],
            )
            assertEq(
                row.marriedFilingSeparately,
                BigInt(transcribed.marriedFilingSeparately) * 100n,
                ['marriedFilingSeparately column mismatch', transcribed.atLeast],
            )
            assertEq(
                row.headOfHousehold,
                BigInt(transcribed.headOfHousehold) * 100n,
                ['headOfHousehold column mismatch', transcribed.atLeast],
            )
        }
    },
    // Success Criterion 3, isolated: the MFJ $18,000 row is $1,803 by table
    // lookup (the midpoint rule), explicitly NOT $1,800 -- the naive
    // bracket-arithmetic answer at the row's own lower bound that training
    // data teaches, and the exact mistake this phase exists to prevent.
    mfjEighteenThousandRowIsEighteenOhThree: () => {
        const row = lookupTaxTable(taxParams2025)(centsFromString('18000.00'))
        assertEq(row.marriedFilingJointly, 180300n)
        assert(
            row.marriedFilingJointly !== 180000n,
            ['expected the midpoint-rounded table value, not naive bracket arithmetic at the lower bound', row.marriedFilingJointly],
        )
    },
    // The band structure alone (no row generation) tiles $0 -> $100,000
    // with no gap and no overlap, and every region's width is even --
    // re-confirming generateRow's own documented invariant from the stored
    // data itself, not assumed.
    bandStructureTilesWithNoGapOrOverlap: () => {
        const first = taxTableBandStructure[0]
        assert(first !== undefined, 'expected at least one band region')
        assertEq(first.atLeast, '0.00')
        const last = taxTableBandStructure[taxTableBandStructure.length - 1]
        assert(last !== undefined, 'expected at least one band region')
        assertEq(last.lessThan, '100000.00')
        /** @type {string | undefined} */
        let previousLessThan = undefined
        for (const region of taxTableBandStructure) {
            if (previousLessThan !== undefined) {
                assertEq(
                    region.atLeast,
                    previousLessThan,
                    ['expected no gap or overlap between adjacent band regions', region.atLeast],
                )
            }
            const regionSpanCents = centsFromString(region.lessThan) - centsFromString(region.atLeast)
            const widthCents = centsFromString(region.width)
            assertEq(
                regionSpanCents % widthCents,
                0n,
                ['region span must divide evenly by its own row width', region.atLeast],
            )
            assertEq(widthCents % 2n, 0n, ['expected an even band width', region.atLeast])
            previousLessThan = region.lessThan
        }
    },
    // T-08-03 (T-08-06-04, strengthened): a lookup at exactly $100,000.00
    // is refused (the bare thrown value is asserted directly -- never an
    // `Error`, never `instanceof Error`). Weakening the refusal's `<` to
    // `<=` still throws at exactly $100,000.00 -- but via an unrelated
    // path ("income falls outside every stored band region") instead of
    // the intended refusal. Asserting only "did it throw" cannot tell
    // these apart, so the thrown message's CONTENT is asserted: it must
    // name the $100,000 boundary AND the Tax Computation Worksheet
    // verbatim, exactly as Publication 1040 itself does. A lookup one
    // cent below still resolves, to the table's own last row.
    tableRefusesAtOneHundredThousandAndAbove: () => {
        // `refuses` (`fjs/refuses`) is the one place under `fjs/` that may
        // `try`, and it carries the two assertions this leaf used to make
        // itself: that the thrown value is a bare string or array (never an
        // `Error`) and that the call threw at all.
        refuses(() => lookupTaxTable(taxParams2025)(centsFromString('100000.00')))(message => {
            assert(
                message.includes('100,000'),
                ['expected the thrown message to name the $100,000 boundary', message],
            )
            assert(
                message.includes('Tax Computation Worksheet'),
                ['expected the thrown message to name the Tax Computation Worksheet', message],
            )
        })
    },
    // One cent below still resolves, to the table's own last row — the
    // control that makes the refusal above a boundary rather than a blanket
    // failure.
    //
    // MERGE NOTE (do not re-revert). A feedback pass rewrote the refusal above
    // as a bare `throw: { ... }` leaf, on the stated grounds that "reading a
    // thrown value means catching it, and a `.f.js` module may not". That is
    // not true — `fjs/exec/module.f.js` catches in shipped production code, and
    // this proof passes under `npm test`. The `throw:` form is also strictly
    // weaker: it passes for ANY throw, and mutating the refusal's `<` to `<=`
    // still throws at exactly $100,000.00, just via the unrelated "outside
    // every stored band region" path. That is the precise gap the mutation
    // sweep found ("assertions checked THAT a refusal threw, not WHAT it
    // threw"), so the content assertion stays.
    tableResolvesOneCentBelowOneHundredThousand: () => {
        const lastRow = lookupTaxTable(taxParams2025)(centsFromString('99999.99'))
        assertEq(lastRow.atLeastCents, centsFromString('99950.00'))
        assertEq(lastRow.lessThanCents, centsFromString('100000.00'))
    },
    // T-10-03-01, and the verification of this plan's load-bearing claim:
    // all twenty printed Tax Computation Worksheet rows are reproduced,
    // to the cent, by the bracket walk this module already shipped for
    // the Tax Table.
    //
    // The expected side is `ratePercent x income / 100 - subtraction`
    // computed from `handTranscribedTaxComputationWorksheetRows` ALONE —
    // hand-transcribed printed constants, sharing no code path with
    // `cumulativeBracketTaxCents`. Two independent things are therefore
    // on trial at once: the transcription, and the stored brackets in
    // `fjs/tax/params`. Mutating a stored HoH ceiling (250500 -> 250525,
    // the plausible copy-paste from single/MFS) turns this leaf red,
    // which is what shows it checks the stored data rather than itself.
    //
    // Two probes per row: the row's own lower bound, and either one
    // dollar below its exclusive upper bound or, for a section's
    // open-ended last row, $100,000 above the lower bound. Both probes
    // are whole-dollar incomes, and that is ASSERTED rather than assumed,
    // because `BigInt(ratePercent) * incomeCents / 100n` is bigint
    // division: at an income carrying cents it would truncate and the
    // expected side would quietly stop being exact.
    taxComputationWorksheetReproducesAllTwentyPrintedRows: () => {
        assertEq(
            handTranscribedTaxComputationWorksheetRows.length,
            expectedTaxComputationWorksheetRowCount,
            'expected four printed sections of five rows each',
        )
        for (const row of handTranscribedTaxComputationWorksheetRows) {
            const { brackets } = taxParams2025.ordinaryBrackets[row.status]
            const atLeastCents = centsFromString(row.atLeast)
            const probesCents = row.lessThan === undefined
                ? [atLeastCents, atLeastCents + openTopRowProbeOffsetCents]
                : [atLeastCents, centsFromString(row.lessThan) - oneDollarCents]
            for (const incomeCents of probesCents) {
                assertEq(
                    incomeCents % 100n,
                    0n,
                    ['probe income must be a whole-dollar amount', row.status, row.atLeast],
                )
                const expectedCents =
                    BigInt(row.ratePercent) * incomeCents / 100n - centsFromString(row.subtraction)
                assertEq(
                    taxComputationWorksheet(brackets)(incomeCents),
                    expectedCents,
                    ['printed worksheet row mismatch', row.status, row.atLeast, centsToString(incomeCents)],
                )
            }
        }
    },
    // The worksheet keeps CENTS. Every value below is hand-typed from
    // `rate x income - subtraction` on the printed page, never computed
    // by calling the code under test:
    //   MFJ  $700,000.00: 35% x 700,000.00 - 60,905.50 = $184,094.50
    //   HoH  $626,350.00: 37% x 626,350.00 - 44,718.00 = $187,031.50
    // Both end in a half dollar, which is the point: rounding this
    // worksheet to whole dollars the way the printed TABLE rounds its
    // rows would move both by fifty cents.
    //
    // This was recorded for months as "the leaf that would move if
    // 10-RESEARCH.md's assumption A2 turns out wrong". A2 was RESOLVED on
    // 2026-08-17 against Pub. 1040 (2025) p14-15, and this leaf does not
    // move: the worksheet's own printed SUBTRACTION AMOUNTS carry cents
    // ($60,905.50 here, and $30,452.75 / $42,979.75 / $37,968.75 elsewhere
    // in the same table), so a whole-dollar reading is not available to the
    // form. See this module's `taxComputationWorksheet` docstring.
    taxComputationWorksheetKeepsCentsAndNeverRoundsToWholeDollars: () => {
        const mfjAtSevenHundredThousand =
            taxComputationWorksheet(taxParams2025.ordinaryBrackets.marriedFilingJointly.brackets)(70000000n)
        assertEq(mfjAtSevenHundredThousand, 18409450n)
        assert(
            mfjAtSevenHundredThousand !== 18409500n,
            ['expected cent precision, not the whole-dollar rounding the printed Tax Table uses', mfjAtSevenHundredThousand],
        )
        const hohAtTopBracketFloor =
            taxComputationWorksheet(taxParams2025.ordinaryBrackets.headOfHousehold.brackets)(62635000n)
        assertEq(hohAtTopBracketFloor, 18703150n)
        assert(
            hohAtTopBracketFloor !== 18703200n,
            ['expected cent precision, not the whole-dollar rounding the printed Tax Table uses', hohAtTopBracketFloor],
        )
    },
    // The mirror of `tableRefusesAtOneHundredThousandAndAbove`, in the
    // opposite direction: below $100,000.00 the worksheet refuses and
    // names the Tax Table. The thrown value's CONTENT is asserted, never
    // merely that it threw — the exact weakness the Phase 9 sweep found,
    // and here it is load-bearing twice over, because
    // `cumulativeBracketTaxCents` itself throws on a bracket list that
    // cannot cover the income, so "it threw" alone cannot tell the
    // boundary refusal apart from an unrelated data failure.
    taxComputationWorksheetRefusesBelowOneHundredThousand: () => {
        refuses(
            () => taxComputationWorksheet(taxParams2025.ordinaryBrackets.single.brackets)(centsFromString('99999.99')),
        )(message => {
            assert(
                message.includes('100,000'),
                ['expected the thrown message to name the $100,000 boundary', message],
            )
            assert(
                message.includes('Tax Table'),
                ['expected the thrown message to name the Tax Table', message],
            )
        })
    },
    // The control leg the refusal above needs (AGENTS.md: "a gate needs a
    // control"): at EXACTLY $100,000.00 the worksheet answers, and
    // answers $16,914.00 — Section A's first printed row, 22% x
    // 100,000.00 - 5,086.00, hand-typed from page 80. Weakening the
    // gate's `>=` to `>` refuses here instead.
    taxComputationWorksheetResolvesAtExactlyOneHundredThousand: () => {
        assertEq(
            taxComputationWorksheet(taxParams2025.ordinaryBrackets.single.brackets)(tableUpperBoundCents),
            1691400n,
        )
    },
    // T-10-03-02: the $100,000.00 seam, pinned on BOTH sides and in BOTH
    // dimensions. One cent of extra taxable income changes the answer by
    // $5.00 AND changes the method that produced it, and a proof that
    // asserted only `cents` would be blind to a dispatcher that returned
    // the right number by the wrong route.
    //
    // Both expected amounts are hand-typed from the printed pages, never
    // computed here: $16,909 is the single column of the Tax Table's last
    // printed row ($99,950-$100,000, i1040gi p79) and $16,914 is Section
    // A's first Tax Computation Worksheet row (p80, 22% x 100,000.00 -
    // 5,086.00). The $5.00 gap between them is asserted too, because that
    // discontinuity is the thing itself — it is real, it is invisible
    // anywhere above line 16, and it is what a "simplify the seam"
    // refactor would quietly erase.
    seamAtOneHundredThousandChangesBothTheNumberAndTheMethod: () => {
        const oneCentBelow = baseTaxForAmount(taxParams2025)('single')(centsFromString('99999.99'))
        assertEq(oneCentBelow.method, 'taxTable', 'expected the Tax Table one cent below the bound')
        assertEq(oneCentBelow.cents, 1690900n, 'expected the printed table\'s last single-column row')
        const atTheBound = baseTaxForAmount(taxParams2025)('single')(centsFromString('100000.00'))
        assertEq(
            atTheBound.method,
            'taxComputationWorksheet',
            'expected the Tax Computation Worksheet at exactly the bound',
        )
        assertEq(atTheBound.cents, 1691400n, 'expected Section A\'s first printed worksheet row')
        assertEq(
            atTheBound.cents - oneCentBelow.cents,
            500n,
            'expected the printed $5.00 discontinuity across the $100,000 seam',
        )
    },
    // T-10-03-03: a qualifying surviving spouse reads the printed
    // MARRIED-FILING-JOINTLY column. The expected $2,562.00 is the IRS's
    // OWN worked Tax Table Example (i1040gi p68: "Mr. and Mrs. Brown are
    // filing a joint return. Their taxable income is $25,300"), hand-typed
    // from the page and read here through the QSS status — so this leaf
    // fails if QSS is ever pointed at any other column, and it fails with
    // a real published number rather than one this module produced.
    qualifyingSurvivingSpouseReadsTheMarriedFilingJointlyColumn: () => {
        assertEq(taxTableColumnFor.qualifyingSurvivingSpouse, 'marriedFilingJointly')
        const result = baseTaxForAmount(taxParams2025)('qualifyingSurvivingSpouse')(centsFromString('25300.00'))
        assertEq(result.method, 'taxTable')
        assertEq(result.cents, 256200n, 'expected the printed Tax Table Example\'s own answer')
    },
    // The `Record` over the status union is a `tsc` guarantee that every
    // status is MAPPED; this leaf is the runtime half it cannot give —
    // that every status is mapped to a column the printed table actually
    // HAS, and that a `Row` really carries that key. A mapping to a
    // plausible-looking name that is not a `Row` money key would typecheck
    // against a wider column type and then read `undefined` in production.
    everyIndividualFilingStatusMapsToAPrintedColumn: () => {
        assertEq(
            printedTaxTableColumns.length,
            expectedPrintedTaxTableColumnCount,
            'Publication 1040 prints four Tax Table money columns',
        )
        const row = lookupTaxTable(taxParams2025)(centsFromString('25300.00'))
        for (const status of individualFilingStatuses) {
            const column = taxTableColumnFor[status]
            assert(
                printedTaxTableColumns.includes(column),
                ['expected a column Publication 1040 actually prints', status, column],
            )
            assert(
                Object.hasOwn(row, column),
                ['expected a Row to carry this money key', status, column],
            )
        }
    },
}
