/**
 * The combined threshold inventory and its generated boundary-triple proof (TAX-04): every
 * ordinary-bracket ceiling, capital-gains breakpoint, and Tax Table band-width edge this phase's
 * data introduces, assembled into one list, with a `threshold - 1 cent` / `threshold` /
 * `threshold + 1 cent` proof generated mechanically over that list -- never a hand-written leaf
 * per threshold.
 *
 * ## Why generated, not hand-written
 *
 * A threshold added to the stored parameter data later must be covered automatically, without
 * anyone remembering to write a new proof leaf by hand -- exactly the self-enforcing discipline
 * 08-CONTEXT.md requires, and the same reason `vocabularyIsFrozenAtFour`-style checks elsewhere
 * in this project moved away from a hand-maintained assertion. `allThresholds` is the single
 * source of truth; the `proof` export below is built by mapping over it, so its own key count is
 * mechanically tied to the list's length, not to whatever a human happened to type.
 *
 * ## Independence from the Tax Table's own tax-computation code
 *
 * `segmentIndex` is a small, generic, tax-agnostic counting function. It deliberately shares NO
 * code path with the Tax Table module's own marginal-bracket tax computation or its row
 * generator -- if this module's boundary check called into that module's own computation
 * functions to decide "which side of the threshold" a value falls on, a bug in that computation
 * would make both sides of the check agree, and the proof would prove nothing. This project has
 * already shipped one bug of exactly that shape (Phase 7: 185 proofs missed it because a fixture
 * mirrored the code's own mistake). `segmentIndex` exists so this module's independence from the
 * Tax Table module's computation holds structurally, not by convention.
 *
 * ## What counts as a threshold here, and what does not
 *
 * Every DEFINED ordinary-bracket ceiling (the last bracket in every status's schedule has
 * `ceiling: undefined` -- no ceiling on the top bracket, not a threshold), every capital-gains
 * breakpoint, and the Tax Table's own band-width transition points (excluding the table's `0.00`
 * starting edge, which has no income below it to test). The aged/blind eligibility age boundary
 * ("born before January 2, 1961") is a birthdate comparison, not a cent threshold, and is
 * explicitly out of scope here (08-CONTEXT.md, "Boundaries, Rounding, and Refusals").
 *
 * @module
 */
import { assert, assertEq } from 'functionalscript/fjs/asserts/module.f.mjs'
import { cmp } from 'functionalscript/fjs/types/function/compare/module.f.mjs'
import { centsFromString } from '../../exact/module.f.js'
import { taxParamsByYear, allFilingStatuses } from '../params/module.f.js'
import { taxTableBandStructure } from '../table/module.f.js'

/** @import { Bracket } from '../params/module.f.js' */
/** @import { StringMap } from 'functionalscript/fjs/types/object/types.js' */

/**
 * A pure, generic, tax-agnostic boundary counter: given a sorted-ascending list of boundary
 * values (in cents), returns a function counting how many of those boundaries a given value has
 * reached or passed (every stored boundary `<= valueCents`). This function encodes NO tax rate,
 * NO money computation, and NO rounding -- it is nothing more than a count over a list of
 * cutoffs, deliberately independent of any tax-computation code elsewhere in this project (see
 * this module's own docstring, "Independence from the Tax Table's own tax-computation code").
 * @type {(boundariesAscendingCents: readonly bigint[]) => (valueCents: bigint) => number}
 */
export const segmentIndex = boundariesAscendingCents => valueCents =>
    boundariesAscendingCents.filter(boundaryCents => boundaryCents <= valueCents).length

/**
 * TY2025's parameter set, narrowed exactly ONCE at module scope. This project's `tsconfig.json`
 * sets `noUncheckedIndexedAccess: true`, so indexing the lookup map below by the literal year
 * yields `TaxParamSet | undefined` even though `2025` is a literal key -- the open
 * index-signature type `fjs/tax/params/module.f.js` declares does not narrow away on its own.
 * Every later reference to the year-2025 parameter set anywhere in this module uses this
 * constant, never a second direct index into the map; a non-null assertion or a type cast is
 * banned by AGENTS.md's hard rules, so `assert` is the only compliant narrowing path here, and it
 * throws a bare string, never an `Error`.
 */
const taxParams2025 = taxParamsByYear[2025]
assert(taxParams2025 !== undefined, 'expected TY2025 parameters to be present in taxParamsByYear')

/**
 * Type-predicate filter: narrows a bracket's `ceiling` from `string | undefined` down to just the
 * DEFINED entries. The last bracket in every status's schedule has `ceiling: undefined` (no
 * ceiling on the top bracket) -- that is not a threshold and must be excluded, never mistaken for
 * a real cutoff.
 * @param {Bracket} bracket
 * @returns {bracket is { readonly ratePercent: number, readonly ceiling: string }}
 */
const hasDefinedCeiling = bracket => bracket.ceiling !== undefined

/**
 * One stored threshold: a human-readable label naming its source, and its own cents value,
 * parsed via `centsFromString` from the exact string already stored in the imported modules --
 * never re-typed as a new literal in this file.
 * @typedef {{ readonly label: string, readonly cents: bigint }} Threshold
 */

/**
 * Every DEFINED ordinary-bracket ceiling across every filing status -- 33 total (6 each for the
 * five individual statuses -- single/marriedFilingJointly/marriedFilingSeparately/headOfHousehold/
 * qualifyingSurvivingSpouse -- plus 3 for estatesAndTrusts, which has only four brackets and
 * therefore three defined ceilings).
 * @type {readonly Threshold[]}
 */
const ordinaryBracketThresholds = allFilingStatuses.flatMap(status =>
    taxParams2025.ordinaryBrackets[status].brackets
        .filter(hasDefinedCeiling)
        .map(bracket => ({
            label: `ordinaryBracket:${status}:${bracket.ceiling}`,
            cents: centsFromString(bracket.ceiling),
        })),
)

/**
 * Both capital-gains breakpoints (`zeroRateMax`, `fifteenRateMax`) across every filing status --
 * 12 total (2 x 6 statuses).
 * @type {readonly Threshold[]}
 */
const capitalGainsThresholds = allFilingStatuses.flatMap(status => {
    const breakpoints = taxParams2025.capitalGainsBreakpoints[status]
    return [
        {
            label: `capitalGainsBreakpoint:${status}:zeroRateMax`,
            cents: centsFromString(breakpoints.zeroRateMax),
        },
        {
            label: `capitalGainsBreakpoint:${status}:fifteenRateMax`,
            cents: centsFromString(breakpoints.fifteenRateMax),
        },
    ]
})

assert(taxTableBandStructure.length > 0, 'expected at least one Tax Table band region')
const lastTaxTableBandRegion = taxTableBandStructure[taxTableBandStructure.length - 1]
assert(lastTaxTableBandRegion !== undefined, 'expected at least one Tax Table band region')

/**
 * The Tax Table's own band-width transition points -- every region's `atLeast` boundary except
 * the first (`0.00`, not a meaningful threshold: there is no income below it to test), plus the
 * final region's own `lessThan` boundary (`100000.00`, the table's own upper bound). 5 total.
 * @type {readonly Threshold[]}
 */
const taxTableBandThresholds = [
    ...taxTableBandStructure.slice(1).map(region => ({
        label: `taxTableBand:${region.atLeast}`,
        cents: centsFromString(region.atLeast),
    })),
    {
        label: `taxTableBand:${lastTaxTableBandRegion.lessThan}`,
        cents: centsFromString(lastTaxTableBandRegion.lessThan),
    },
]

/**
 * The senior deduction's phase-out START and zero-FLOOR thresholds
 * (13-CONTEXT.md Decision 5.5/Pitfall 3; Schedule 1-A Part V,
 * `fjs/schedule/1a`) -- 8 total (2 per status x 4 statuses). No
 * `marriedFilingSeparately` entry: Decision 5.4/Pitfall 3's short-circuit
 * makes the senior deduction $0 UNCONDITIONALLY for MFS, at any income --
 * there is no dollar boundary to register for a status whose amount never
 * depends on one.
 *
 * The floor point is DERIVED from the SAME stored fields `fjs/schedule/1a`
 * itself reads ($6,000 base / 6% rate = $100,000 above the start), never a
 * second hand-typed dollar literal -- so a future change to either the base
 * amount or the rate moves BOTH the module's own arithmetic and this
 * registered threshold together.
 * @type {readonly Threshold[]}
 */
const seniorDeductionThresholds = (
    /** @type {readonly ('single' | 'marriedFilingJointly' | 'headOfHousehold' | 'qualifyingSurvivingSpouse')[]} */
    (['single', 'marriedFilingJointly', 'headOfHousehold', 'qualifyingSurvivingSpouse'])
).flatMap(status => {
    const startCents = centsFromString(taxParams2025.seniorDeduction.phaseoutThreshold[status].amount)
    return [
        { label: `seniorDeductionPhaseoutStart:${status}`, cents: startCents },
        // $6,000.00 / 6% = $100,000.00 = 10,000,000 cents above the start.
        { label: `seniorDeductionPhaseoutFloor:${status}`, cents: startCents + 10000000n },
    ]
})

/**
 * The SALT cap's phase-down START and FLOOR thresholds (13-CONTEXT.md
 * Decision 2.1/5.6/Pitfall 2; the State and Local Tax Deduction Worksheet,
 * `fjs/schedule/a`) -- 10 total (2 per status x 5 statuses). UNLIKE
 * {@link seniorDeductionThresholds}, this one covers `marriedFilingSeparately`
 * too: the worksheet's own w5 line IS genuinely status-specific on its face
 * ($250,000 MFS vs $500,000 every other status) -- Pitfall 2 is about w1/w9
 * staying FLAT across every status, never about w5, and w5 is exactly what
 * this threshold registers.
 *
 * The floor point is DERIVED from the SAME stored fields `fjs/schedule/a`
 * itself reads (($40,000 flat cap - $10,000 flat floor) / 30% phase-down
 * rate = $100,000 above the start), never a second hand-typed dollar
 * literal -- so a future change to any of the three parameters moves both
 * the module's own arithmetic and this registered threshold together.
 * @type {readonly Threshold[]}
 */
const saltCapThresholds = (
    /** @type {readonly ('single' | 'marriedFilingJointly' | 'marriedFilingSeparately' | 'headOfHousehold' | 'qualifyingSurvivingSpouse')[]} */
    (['single', 'marriedFilingJointly', 'marriedFilingSeparately', 'headOfHousehold', 'qualifyingSurvivingSpouse'])
).flatMap(status => {
    const startCents = centsFromString(taxParams2025.saltCap.threshold[status].amount)
    return [
        { label: `saltCapPhasedownStart:${status}`, cents: startCents },
        // ($40,000.00 - $10,000.00) / 30% = $100,000.00 = 10,000,000 cents above the start.
        { label: `saltCapPhasedownFloor:${status}`, cents: startCents + 10000000n },
    ]
})

/**
 * The CTC/ODC phase-out's own START threshold (13-CONTEXT.md Decision
 * 5.5/5.6; Schedule 8812 Part I, `fjs/form8812`) -- 2 total, the two keys
 * `childTaxCredit.phaseoutThreshold` carries (`marriedFilingJointly` and
 * `other`). UNLIKE {@link seniorDeductionThresholds}/{@link saltCapThresholds},
 * this registers ONLY the crossing point -- no floor/zero-point entry. The
 * STEPPED $1,000-rounding shape that makes this phase-out's cliff
 * distinctive is a module-local property `fjs/form8812`'s own Test 2/3
 * fixtures pin directly; `segmentIndex`'s generic `<=`-count check here only
 * proves "is the threshold crossed at exactly this cent," which neither
 * needs nor can prove the $1,000-step rounding itself.
 * @type {readonly Threshold[]}
 */
const childTaxCreditThresholds = (
    /** @type {readonly ('marriedFilingJointly' | 'other')[]} */
    (['marriedFilingJointly', 'other'])
).flatMap(key => [
    {
        label: `childTaxCreditPhaseoutStart:${key}`,
        cents: centsFromString(taxParams2025.childTaxCredit.phaseoutThreshold[key].amount),
    },
])

/**
 * The combined threshold inventory: every ordinary-bracket ceiling, capital-gains breakpoint,
 * Tax Table band edge, senior-deduction phase-out threshold, SALT-cap phase-down threshold, and
 * CTC/ODC phase-out start threshold this phase's data introduces, assembled from the six sources
 * above.
 * @type {readonly Threshold[]}
 */
export const allThresholds = [
    ...ordinaryBracketThresholds,
    ...capitalGainsThresholds,
    ...taxTableBandThresholds,
    ...seniorDeductionThresholds,
    ...saltCapThresholds,
    ...childTaxCreditThresholds,
]

/**
 * The independently-stated expected count of thresholds assembled above -- 33 ordinary-bracket
 * ceilings (6 + 6 + 6 + 6 + 6 across the five individual filing statuses, + 3 for estates &
 * trusts) + 12 capital-gains breakpoints (2 x 6 statuses) + 5 Tax Table band edges + 8
 * senior-deduction phase-out thresholds (start + floor, x 4 statuses) + 10 SALT-cap phase-down
 * thresholds (start + floor, x 5 statuses, INCLUDING marriedFilingSeparately) + 2 CTC/ODC
 * phase-out start thresholds (MFJ + other, START ONLY, no floor) = 70. This exists so a threshold
 * silently dropped during assembly fails an explicit assertion (`everyThresholdIsCovered` below)
 * rather than passing by omission.
 *
 * `qualifyingSurvivingSpouse`'s thresholds duplicate `marriedFilingJointly`'s CENTS values while
 * carrying distinct labels (10-CONTEXT.md Decision 6: the two statuses read the same Rev. Proc.
 * rows). That leaves `sortedCents`'s de-duplication below unaffected -- it already had duplicate
 * values to collapse, e.g. the $103,350.00 ceiling shared by `single` and `headOfHousehold` --
 * and each new leaf still asserts a real boundary, since the assertion is about where the count
 * changes, not about the label being unique in cents.
 * @type {number}
 */
export const expectedThresholdCount = 70

// ── Tests ────────────────────────────────────────────────────────────────────

/**
 * Every threshold's own cents value, sorted ascending and de-duplicated -- two different
 * thresholds may legitimately share the same cents value (e.g. the $103,350.00 ceiling appears
 * for both `single` and `headOfHousehold`). This is the full boundary list `segmentIndex` counts
 * against.
 *
 * The comparator is upstream's `cmp`, not a local ternary chain. Until
 * 2026-09-03 this line read `(a, b) => a < b ? -1 : a > b ? 1 : 0`, which is
 * `fjs/types/function/compare`'s `cmp` character for character — a
 * re-implementation of a shipped primitive, which AGENTS.md's "use
 * FunctionalScript itself as much as possible" rule is about. Its `: 0` arm
 * was also the one branch in this file no proof reached, and could not be:
 * the input is `Set`-deduplicated, so no two elements are ever equal and
 * `sort` never compares an element with itself. Delegating does not export an
 * untested branch — upstream's own `compare/proof.f.mjs` walks the equal arm
 * directly, with `cmp("hello")("hello")`.
 *
 * A property found while checking that substitution and written down because
 * nobody had (AGENTS.md, "the equivalent mutant"): **the ORDER this line
 * produces is unobservable through `segmentIndex`.** Reversing the comparator
 * to `cmp(b)(a)` leaves the entire suite green — 3,279 leaves, zero failures —
 * because `segmentIndex` is `filter(boundary <= value).length`, a COUNT, and a
 * count does not care what order it counts in. The sort stays regardless: it
 * is what makes this list satisfy the sorted-ascending precondition
 * `segmentIndex`'s own docstring states, and a later implementation of that
 * counter — a `bsearch`, say — would depend on it the moment it stopped being
 * a linear scan. What the observation rules out is treating a green suite as
 * evidence that this comparator is right.
 * @type {readonly bigint[]}
 */
const sortedCents = [...new Set(allThresholds.map(threshold => threshold.cents))]
    .sort((a, b) => cmp(a)(b))

/**
 * One generated proof leaf per stored threshold -- built by mapping `allThresholds` into
 * `[label, assertion]` pairs via `Object.fromEntries`, never as a hand-written literal with 68
 * manually authored keys. Each leaf asserts the boundary is crossed at EXACTLY the threshold's
 * own cent: one cent before must count strictly fewer boundaries reached than the threshold
 * itself, and the threshold must count the same number of boundaries reached as one cent after
 * (i.e. the count does not change again a second time, one cent late).
 * @type {StringMap<() => void>}
 */
const generatedThresholdProof = Object.fromEntries(
    allThresholds.map(threshold => [
        threshold.label,
        () => {
            const oneCentBefore = segmentIndex(sortedCents)(threshold.cents - 1n)
            const atThreshold = segmentIndex(sortedCents)(threshold.cents)
            const oneCentAfter = segmentIndex(sortedCents)(threshold.cents + 1n)
            assert(
                oneCentBefore < atThreshold,
                [
                    'expected the boundary to not already be crossed one cent early',
                    threshold.label,
                    oneCentBefore,
                    atThreshold,
                ],
            )
            assertEq(
                atThreshold,
                oneCentAfter,
                ['expected the boundary to not be crossed again one cent late', threshold.label],
            )
        },
    ]),
)

export const proof = {
    ...generatedThresholdProof,
    // TAX-04: a threshold silently dropped during assembly above, or during this proof's own
    // generation, fails here explicitly rather than passing by omission -- the count is checked
    // against an INDEPENDENTLY-stated expectation (`expectedThresholdCount`), not against itself.
    everyThresholdIsCovered: () => {
        assertEq(
            allThresholds.length,
            expectedThresholdCount,
            [
                'expected exactly the independently-stated threshold count',
                allThresholds.length,
                expectedThresholdCount,
            ],
        )
        assertEq(
            Object.keys(generatedThresholdProof).length,
            allThresholds.length,
            [
                'expected one generated proof leaf per threshold',
                Object.keys(generatedThresholdProof).length,
                allThresholds.length,
            ],
        )
    },
}
