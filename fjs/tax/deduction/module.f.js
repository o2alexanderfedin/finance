/**
 * Form 1040 line 12e (TAX-06): the standard deduction, with the age and
 * blindness increments the printed Standard Deduction Chart adds, and the
 * exceptions that override the chart entirely.
 *
 * ## The trap this module exists to close
 *
 * `single` and `marriedFilingSeparately` share the SAME $15,750 basic
 * standard deduction but take DIFFERENT aged/blind increments — $2,000 and
 * $1,600. Any implementation that derives the increment from the dollar
 * figure it is being added to, or that partitions statuses as
 * "unmarried = not married filing jointly", is wrong by $400 per checked
 * box — up to $1,600 on a four-box return. See
 * {@link agedOrBlindIncrementFor}, which is the one place the rule lives.
 *
 * ## What is here, and what deliberately is not
 *
 * The five exceptions Form 1040's line 12e instructions print
 * (i1040gi.pdf p34) are handled here as follows:
 *
 * - **Exception 1** — someone can claim the taxpayer (or spouse) as a
 *   dependent: the Standard Deduction Worksheet for Dependents applies
 *   instead of the chart. {@link dependentStandardDeduction}.
 * - **Exception 2** — married filing separately and the spouse itemizes:
 *   the standard deduction is ZERO.
 * - **Exception 3** — dual-status alien: likewise ZERO.
 * - **Exception 4** — the age/blindness boxes. This is not an exception at
 *   all in this model: it is the `agedOrBlindBoxes` input.
 * - **Exception 5** — a net qualified disaster loss election. NOT handled
 *   here: it requires Schedule A, which this engine does not model, so it
 *   is a declared kind the scope guard refuses (Plan 10-07). It must never
 *   become a quiet fall-through to the chart.
 *
 * The MFS fourth box's own qualifying condition — the chart's footnote,
 * "your spouse had no income, isn't filing a return, and can't be claimed
 * as a dependent on another person's return" — is enforced at INGEST, on
 * the return profile, not here. This module receives a box count and can
 * only enforce the maximum. One rule, one place (AGENTS.md): the two gates
 * sit at two layers deliberately, and duplicating the ingest condition here
 * would create the second copy that rots.
 *
 * @module
 */
import { assert, assertEq } from 'functionalscript/fjs/asserts/module.f.js'
import { centsFromString } from '../../exact/module.f.js'
import { taxParamsByYear } from '../params/module.f.js'

/** @import { IndividualFilingStatus, TaxParamSet } from '../params/module.f.js' */
/** @import { StringMap } from 'functionalscript/fjs/types/object/module.f.js' */

/**
 * Which of `fjs/tax/params`' two aged/blind additional amounts a filing
 * status takes — **the rule, stated once, here**.
 *
 * Rev. Proc. 2024-40 §2.15(3) grants the larger $2,000 amount to an
 * individual who is "unmarried **and not a surviving spouse**". So:
 *
 * - `$2,000` — single, head of household
 * - `$1,600` — married filing jointly, married filing separately, **and
 *   qualifying surviving spouse**
 *
 * `fjs/tax/params`' field names `agedOrBlindAdditional.married` /
 * `.unmarried` are a LOSSY COMPRESSION of that rule and must never be read
 * as the rule itself: a qualifying surviving spouse is not married, yet
 * takes the `married` amount. That file stores the two constants with their
 * citation; the mapping from a filing status to one of them is this
 * module's job, and this is the only place it exists.
 *
 * Typed as a `Record` over the full status union on purpose: a sixth filing
 * status added later fails `tsc` HERE, where someone must decide which
 * amount it takes, instead of falling silently into a default.
 * @type {Record<IndividualFilingStatus, 'married' | 'unmarried'>}
 */
export const agedOrBlindIncrementFor = {
    single: 'unmarried',
    marriedFilingJointly: 'married',
    // NOT 'unmarried', even though MFS shares single's $15,750 basic
    // deduction. Rev. Proc. 2024-40 §2.15(3) keys the amount on marital
    // status, not on the figure it is added to.
    marriedFilingSeparately: 'married',
    headOfHousehold: 'unmarried',
    // A qualifying surviving spouse is not married and takes the 'married'
    // amount anyway — §2.15(3)'s "and not a surviving spouse" clause, which
    // is precisely what the params field names cannot express.
    qualifyingSurvivingSpouse: 'married',
}

/**
 * The maximum number of age/blindness boxes each filing status can check on
 * Form 1040 line 12d — the row count the printed Standard Deduction Chart
 * stops at for that status. A count above it is refused by
 * {@link standardDeductionCents}, never clamped: a profile claiming more
 * boxes than its status permits is bad input, and silently capping it would
 * hand back a plausible number for an impossible return.
 * @type {Record<IndividualFilingStatus, number>}
 */
export const maxAgedOrBlindBoxes = {
    // No spouse to check boxes for.
    single: 2,
    // The chart prints rows for 1 / 2 / 3 / 4.
    marriedFilingJointly: 4,
    // SETTLED — do not re-litigate. 10-CONTEXT.md's "Standard deduction
    // TY2025 — VERIFIED, and one correction" records the 1040-SR Standard
    // Deduction Chart (f1040s.pdf p4) read end to end: MFS prints rows for
    // 1 / 2 / 3 / 4 at $17,350 / $18,950 / $20,550 / $22,150. An earlier
    // brief stated this maximum as 3; that came from a chart read truncated
    // before the fourth row. The fourth box is CONDITIONAL, and its
    // condition is enforced at ingest (see this module's docstring), not
    // here.
    marriedFilingSeparately: 4,
    // i1040gi p33: "Don't check any boxes for your spouse if your filing
    // status is head of household."
    headOfHousehold: 2,
    // The chart stops at 2 — 10-CONTEXT.md Decision 6. QSS shares every
    // DOLLAR figure with MFJ but not this count, so mapping QSS onto MFJ
    // would silently permit a four-box deduction no QSS filer can claim.
    qualifyingSurvivingSpouse: 2,
}

/**
 * Everything line 12e needs about a return: the filing status, the number
 * of age/blindness boxes checked on line 12d, and the three checkbox facts
 * that trigger exceptions 1-3 — plus the earned income the Standard
 * Deduction Worksheet for Dependents reads when exception 1 applies.
 * @typedef {{
 *   readonly status: IndividualFilingStatus,
 *   readonly agedOrBlindBoxes: number,
 *   readonly claimedAsDependent: boolean,
 *   readonly spouseItemizes: boolean,
 *   readonly dualStatusAlien: boolean,
 *   readonly earnedIncomeCents: bigint,
 * }} StandardDeductionInput
 */

/**
 * The **Standard Deduction Worksheet for Dependents** (i1040gi.pdf p35) —
 * exception 1, which REPLACES the chart for a taxpayer someone else can
 * claim as a dependent, rather than capping the chart's result afterwards.
 *
 * Transcribed line for line, with the printed line numbers as the local
 * names (TAX-15), so a diff against the page is possible:
 *
 * - `line1` — the number of age/blindness boxes checked on line 12d.
 * - `line2` — earned income above the worksheet's threshold, plus the $450
 *   add-on; otherwise the flat $1,350 minimum.
 * - `line3` — the filing status's basic standard deduction.
 * - `line4a` — the SMALLER of `line2` and `line3`. (The printed worksheet
 *   says STOP here for a filer born after January 1, 1961 and not blind,
 *   which is the `line1 === 0` case: `line4b` is then zero and `line4c`
 *   equals `line4a`, so the stop is expressed by the arithmetic rather than
 *   by a second code path.)
 * - `line4b` — `line1` × the status's aged/blind increment.
 * - `line4c` — `line4a` plus `line4b`, which is Form 1040 line 12e.
 *
 * The printed worksheet's line 3 lists only single/MFS, MFJ and HoH — it
 * does not name a qualifying surviving spouse. Research assumption **A3**:
 * QSS reads $31,500 there, by parity with the Standard Deduction Chart and
 * the Form 1040 face margin, which is what `standardDeduction` already
 * stores. Recorded here so it is findable if Phase 14's acceptance
 * disagrees.
 * @type {(taxParamSet: TaxParamSet) => (status: IndividualFilingStatus, agedOrBlindBoxes: number, earnedIncomeCents: bigint) => bigint}
 */
export const dependentStandardDeduction = taxParamSet => (status, agedOrBlindBoxes, earnedIncomeCents) => {
    const { minimum, earnedIncomeAddOn } = taxParamSet.dependentStandardDeductionCap
    const minimumCents = centsFromString(minimum.amount)
    const addOnCents = centsFromString(earnedIncomeAddOn.amount)
    // Research assumption A5. The worksheet prints its line 2 threshold as
    // $900, which is arithmetically twice the stored $450 add-on for TY2025;
    // the worksheet states it as its own restatement, not as a separately
    // governed parameter with its own Rev. Proc. citation. So it is DERIVED
    // from the stored add-on rather than hand-typed as a bare literal that
    // would be a second, uncited constant able to drift from it.
    //
    // The threshold is invisible from the outside: at exactly the threshold
    // both arms give the same $1,350, precisely because the add-on is half
    // the minimum. Only one cent above it can distinguish the arms, which is
    // what this module's three boundary probes exist to pin.
    const earnedIncomeThresholdCents = addOnCents * 2n
    const line1 = agedOrBlindBoxes
    const line2 = earnedIncomeCents > earnedIncomeThresholdCents
        ? earnedIncomeCents + addOnCents
        : minimumCents
    const line3 = centsFromString(taxParamSet.standardDeduction[status].amount)
    const line4a = line2 < line3 ? line2 : line3
    const line4b = BigInt(line1) * centsFromString(
        taxParamSet.agedOrBlindAdditional[agedOrBlindIncrementFor[status]].amount,
    )
    const line4c = line4a + line4b
    return line4c
}

/**
 * Form 1040 line 12e in exact cents.
 *
 * The ORDER of the four steps below is the rule, not an optimisation:
 *
 * 1. **Validate the box count first.** An impossible box count is
 *    impossible whether or not an exception would later have zeroed the
 *    result — a return claiming five boxes must be refused, never quietly
 *    answered `0n`.
 * 2. **Exceptions 2 and 3 return zero before any increment is added.**
 *    i1040gi p34 states it twice: the standard deduction is zero "even if
 *    you were born before January 2, 1961, or were blind". A blind
 *    70-year-old MFS filer whose spouse itemizes gets `$0`, not `$18,950`.
 * 3. **Exception 1 delegates to the Dependents worksheet**, which replaces
 *    the chart entirely rather than capping its result afterwards.
 * 4. Otherwise the chart: the status's basic standard deduction, with one
 *    increment per checked box.
 * @type {(taxParamSet: TaxParamSet) => (input: StandardDeductionInput) => bigint}
 */
export const standardDeductionCents = taxParamSet => input => {
    const { status, agedOrBlindBoxes, claimedAsDependent, spouseItemizes, dualStatusAlien } = input
    // Bound to a local rather than indexed inline: AGENTS.md bans a cast or
    // a `!` over a lookup, and naming it also lets the refusal below report
    // the maximum it enforced.
    const maximum = maxAgedOrBlindBoxes[status]
    assert(
        Number.isInteger(agedOrBlindBoxes),
        ['the age/blindness box count must be a whole number', status, `boxes=${agedOrBlindBoxes}`],
    )
    assert(
        agedOrBlindBoxes >= 0,
        ['the age/blindness box count must not be negative', status, `boxes=${agedOrBlindBoxes}`],
    )
    // The refusal names the status, the offending count and the maximum —
    // and no money value (T-10-05-04).
    assert(
        agedOrBlindBoxes <= maximum,
        [
            'the age/blindness box count exceeds this filing status\'s maximum',
            status,
            `boxes=${agedOrBlindBoxes}`,
            `maximum=${maximum}`,
        ],
    )
    if (spouseItemizes || dualStatusAlien) {
        return 0n
    }
    if (claimedAsDependent) {
        return dependentStandardDeduction(taxParamSet)(status, agedOrBlindBoxes, input.earnedIncomeCents)
    }
    const basicCents = centsFromString(taxParamSet.standardDeduction[status].amount)
    const incrementCents = centsFromString(
        taxParamSet.agedOrBlindAdditional[agedOrBlindIncrementFor[status]].amount,
    )
    return basicCents + BigInt(agedOrBlindBoxes) * incrementCents
}

// ── Tests ────────────────────────────────────────────────────────────────────

/**
 * TY2025's parameter set, narrowed exactly ONCE at module scope —
 * `noUncheckedIndexedAccess` makes the open year-keyed lookup yield
 * `TaxParamSet | undefined`, and a cast or `!` is banned, so `assert` is the
 * only compliant narrowing path.
 */
const taxParams2025 = taxParamsByYear[2025]
assert(taxParams2025 !== undefined, 'expected TY2025 parameters to be present in taxParamsByYear')

/**
 * One row of the printed Standard Deduction Chart: a filing status, a box
 * count, and the amount the chart prints for that pair — **hand-typed**,
 * never computed.
 * @typedef {{
 *   readonly status: IndividualFilingStatus,
 *   readonly boxes: number,
 *   readonly expectedCents: bigint,
 * }} ChartRow
 */

/**
 * The number of combinations the Standard Deduction Chart prints, stated
 * INDEPENDENTLY of the table below so that a dropped row cannot take its
 * own proof leaf away with it — `chartCombinations.length` would agree with
 * itself no matter what was deleted.
 *
 * It is **19**: single 3 (0/1/2) + MFJ 5 (0..4) + MFS 5 (0..4) + HoH 3
 * (0/1/2) + QSS 3 (0/1/2). 10-RESEARCH.md's prose says "The full
 * enumeration (17 leaves)" above a table whose own rows sum to 19 — the
 * table is right and the prose miscounts its own rows. Do not "correct"
 * this downward to match that sentence.
 * @type {number}
 */
export const expectedChartCombinationCount = 19

/**
 * Every combination the Standard Deduction Chart prints, in cents, each
 * expectation HAND-TYPED from the chart (i1040gi.pdf p35 / f1040s.pdf p4).
 *
 * Computing the expectation as the basic deduction plus n increments would
 * make this proof the code under test — the exact defect this project has
 * shipped three times (AGENTS.md). The duplication is the mechanism.
 * @type {readonly ChartRow[]}
 */
const chartCombinations = [
    // Single — $15,750, +$2,000 per box, up to 2.
    { status: 'single', boxes: 0, expectedCents: 1575000n },
    { status: 'single', boxes: 1, expectedCents: 1775000n },
    { status: 'single', boxes: 2, expectedCents: 1975000n },
    // Married filing jointly — $31,500, +$1,600 per box, up to 4.
    { status: 'marriedFilingJointly', boxes: 0, expectedCents: 3150000n },
    { status: 'marriedFilingJointly', boxes: 1, expectedCents: 3310000n },
    { status: 'marriedFilingJointly', boxes: 2, expectedCents: 3470000n },
    { status: 'marriedFilingJointly', boxes: 3, expectedCents: 3630000n },
    { status: 'marriedFilingJointly', boxes: 4, expectedCents: 3790000n },
    // Married filing separately — single's $15,750 with the MARRIED
    // $1,600 increment, up to 4. These four non-zero rows are the ones a
    // status partitioned as "unmarried = not MFJ" gets wrong.
    { status: 'marriedFilingSeparately', boxes: 0, expectedCents: 1575000n },
    { status: 'marriedFilingSeparately', boxes: 1, expectedCents: 1735000n },
    { status: 'marriedFilingSeparately', boxes: 2, expectedCents: 1895000n },
    { status: 'marriedFilingSeparately', boxes: 3, expectedCents: 2055000n },
    { status: 'marriedFilingSeparately', boxes: 4, expectedCents: 2215000n },
    // Head of household — $23,625, +$2,000 per box, up to 2.
    { status: 'headOfHousehold', boxes: 0, expectedCents: 2362500n },
    { status: 'headOfHousehold', boxes: 1, expectedCents: 2562500n },
    { status: 'headOfHousehold', boxes: 2, expectedCents: 2762500n },
    // Qualifying surviving spouse — MFJ's dollars, but the chart stops at 2.
    { status: 'qualifyingSurvivingSpouse', boxes: 0, expectedCents: 3150000n },
    { status: 'qualifyingSurvivingSpouse', boxes: 1, expectedCents: 3310000n },
    { status: 'qualifyingSurvivingSpouse', boxes: 2, expectedCents: 3470000n },
]

/**
 * A line-12e input with every exception switched off — the plain chart
 * case. Exception leaves build on it with a spread, so the one fact each
 * leaf changes is the only thing that differs from the control.
 * @type {(status: IndividualFilingStatus, boxes: number) => StandardDeductionInput}
 */
const chartInput = (status, boxes) => ({
    status,
    agedOrBlindBoxes: boxes,
    claimedAsDependent: false,
    spouseItemizes: false,
    dualStatusAlien: false,
    earnedIncomeCents: 0n,
})

/**
 * Runs a line-12e call that must REFUSE, and hands the thrown value's text
 * to `check` so a leaf can assert WHAT was thrown, never merely that
 * something threw (AGENTS.md: the mutation sweep found several assertions
 * making exactly that mistake). `assert` throws a BARE value — a string or
 * an array — never an `Error`, which is why the value is read directly
 * instead of through `.message`.
 * @type {(call: () => bigint) => (check: (message: string) => void) => void}
 */
const refuses = call => check => {
    let threw = false
    try {
        call()
    } catch (thrown) {
        threw = true
        assert(
            typeof thrown === 'string' || Array.isArray(thrown),
            ['expected a bare thrown value: a string or an array', thrown],
        )
        check(typeof thrown === 'string' ? thrown : thrown.join(' '))
    }
    assert(threw, 'expected the call to refuse, but it returned an amount')
}

/**
 * One generated proof leaf per printed chart combination, keyed
 * `{status}_{n}Boxes` — built by mapping the hand-typed table rather than
 * written out as 19 hand-keyed leaves, so a row added to the table brings
 * its leaf with it.
 * @type {StringMap<() => void>}
 */
const generatedChartProof = Object.fromEntries(
    chartCombinations.map(row => [
        `${row.status}_${row.boxes}Boxes`,
        () => {
            assertEq(
                standardDeductionCents(taxParams2025)(chartInput(row.status, row.boxes)),
                row.expectedCents,
                ['standard deduction chart mismatch', row.status, row.boxes],
            )
        },
    ]),
)

export const proof = {
    ...generatedChartProof,
    // A chart row dropped from the table above — or a leaf lost during this
    // proof's own generation — fails here explicitly instead of passing by
    // omission. Checked against the INDEPENDENTLY-stated count, never
    // against the table's own length.
    everyPrintedChartCombinationIsCovered: () => {
        assertEq(
            chartCombinations.length,
            expectedChartCombinationCount,
            [
                'expected exactly the independently-stated chart combination count',
                chartCombinations.length,
                expectedChartCombinationCount,
            ],
        )
        assertEq(
            Object.keys(generatedChartProof).length,
            expectedChartCombinationCount,
            [
                'expected one generated proof leaf per chart combination',
                Object.keys(generatedChartProof).length,
                expectedChartCombinationCount,
            ],
        )
    },
    // T-10-05-02. The CONTROL for all four refusal leaves below is the
    // generated chart proof itself: `qualifyingSurvivingSpouse_2Boxes`,
    // `headOfHousehold_2Boxes` and `marriedFilingJointly_4Boxes` each show
    // the maximum ITSELF computes, so these refusals are boundaries rather
    // than a gate that refuses everything. Named here instead of duplicated.
    refusesThreeBoxesForQualifyingSurvivingSpouse: () => {
        refuses(() => standardDeductionCents(taxParams2025)(chartInput('qualifyingSurvivingSpouse', 3)))(
            message => {
                assert(
                    message.includes('qualifyingSurvivingSpouse'),
                    ['expected the refusal to name the filing status', message],
                )
                assert(message.includes('boxes=3'), ['expected the refusal to name the offending count', message])
                assert(message.includes('maximum=2'), ['expected the refusal to name the maximum', message])
            },
        )
    },
    refusesThreeBoxesForHeadOfHousehold: () => {
        refuses(() => standardDeductionCents(taxParams2025)(chartInput('headOfHousehold', 3)))(message => {
            assert(
                message.includes('headOfHousehold'),
                ['expected the refusal to name the filing status', message],
            )
            assert(message.includes('boxes=3'), ['expected the refusal to name the offending count', message])
            assert(message.includes('maximum=2'), ['expected the refusal to name the maximum', message])
        })
    },
    refusesFiveBoxesForMarriedFilingJointly: () => {
        refuses(() => standardDeductionCents(taxParams2025)(chartInput('marriedFilingJointly', 5)))(message => {
            assert(
                message.includes('marriedFilingJointly'),
                ['expected the refusal to name the filing status', message],
            )
            assert(message.includes('boxes=5'), ['expected the refusal to name the offending count', message])
            assert(message.includes('maximum=4'), ['expected the refusal to name the maximum', message])
        })
    },
    refusesNegativeBoxCount: () => {
        refuses(() => standardDeductionCents(taxParams2025)(chartInput('single', -1)))(message => {
            assert(
                message.includes('must not be negative'),
                ['expected the refusal to name the negative box count as the reason', message],
            )
            assert(message.includes('boxes=-1'), ['expected the refusal to name the offending count', message])
        })
    },
    // ── Exception 1: the Standard Deduction Worksheet for Dependents ─────
    //
    // Every expectation below is hand-typed from the printed worksheet
    // (i1040gi.pdf p35), never computed here. The CONTROL for this whole
    // group is the generated chart proof: `single_0Boxes` shows the same
    // filer WITHOUT `claimedAsDependent` getting the full $15,750, so these
    // leaves measure the worksheet replacing the chart rather than a
    // function that returns a small number for everyone.
    //
    // Line 2's minimum arm: $500 of earned income is below the worksheet's
    // threshold, so line 2 is the flat $1,350 minimum.
    dependentWithFiveHundredEarnedIncomeTakesTheMinimumArm: () => {
        assertEq(
            standardDeductionCents(taxParams2025)({
                ...chartInput('single', 0),
                claimedAsDependent: true,
                earnedIncomeCents: 50000n,
            }),
            135000n,
        )
    },
    // Line 2's earned-income arm: $2,000 is above the threshold, so line 2
    // is earned income plus the $450 add-on = $2,450.
    dependentWithTwoThousandEarnedIncomeTakesTheEarnedIncomeArm: () => {
        assertEq(
            standardDeductionCents(taxParams2025)({
                ...chartInput('single', 0),
                claimedAsDependent: true,
                earnedIncomeCents: 200000n,
            }),
            245000n,
        )
    },
    // Line 4a's cap binds: $20,000 of earned income would make line 2
    // $20,450, but line 4a takes the SMALLER of line 2 and line 3, and line
    // 3 is single's $15,750.
    dependentEarnedIncomeIsCappedByLine4aAtTheBasicDeduction: () => {
        assertEq(
            standardDeductionCents(taxParams2025)({
                ...chartInput('single', 0),
                claimedAsDependent: true,
                earnedIncomeCents: 2000000n,
            }),
            1575000n,
        )
    },
    // Line 4b stacks on top of line 4a: $2,450 plus two $2,000 boxes.
    dependentEarnedIncomeArmStacksTwoAgedOrBlindBoxes: () => {
        assertEq(
            standardDeductionCents(taxParams2025)({
                ...chartInput('single', 2),
                claimedAsDependent: true,
                earnedIncomeCents: 200000n,
            }),
            645000n,
        )
    },
    // The three-probe boundary around line 2's threshold. The threshold
    // itself is INVISIBLE — both arms yield $1,350 at exactly the threshold,
    // because the add-on is exactly half the minimum for TY2025 — so only
    // the third probe, one cent above, can tell the two arms apart.
    dependentEarnedIncomeOneCentBelowTheThresholdIsTheMinimum: () => {
        assertEq(
            standardDeductionCents(taxParams2025)({
                ...chartInput('single', 0),
                claimedAsDependent: true,
                earnedIncomeCents: 89999n,
            }),
            135000n,
        )
    },
    dependentEarnedIncomeExactlyAtTheThresholdIsTheMinimum: () => {
        assertEq(
            standardDeductionCents(taxParams2025)({
                ...chartInput('single', 0),
                claimedAsDependent: true,
                earnedIncomeCents: 90000n,
            }),
            135000n,
        )
    },
    dependentEarnedIncomeOneCentAboveTheThresholdMovesOffTheMinimum: () => {
        assertEq(
            standardDeductionCents(taxParams2025)({
                ...chartInput('single', 0),
                claimedAsDependent: true,
                earnedIncomeCents: 90001n,
            }),
            135001n,
        )
    },
    // ── Exceptions 2 and 3: hard zeros that SURVIVE age and blindness ────
    //
    // T-10-05-03. Both leaves check the exception with the MAXIMUM number of
    // boxes set, because the failure mode is a blind 70-year-old MFS filer
    // being handed $22,150 instead of $0 — and a leaf that tested the
    // exception with zero boxes could not see it. The controls are
    // `marriedFilingSeparately_4Boxes` (2215000n) and `single_2Boxes`
    // (1975000n): the identical inputs without the exception flag produce
    // those non-zero amounts, so a zero here is the exception acting, not a
    // function that returns zero for everything.
    spouseItemizesIsZeroEvenWithFourBoxesChecked: () => {
        assertEq(
            standardDeductionCents(taxParams2025)({
                ...chartInput('marriedFilingSeparately', 4),
                spouseItemizes: true,
            }),
            0n,
        )
    },
    dualStatusAlienIsZeroEvenWithTwoBoxesChecked: () => {
        assertEq(
            standardDeductionCents(taxParams2025)({
                ...chartInput('single', 2),
                dualStatusAlien: true,
            }),
            0n,
        )
    },
    // Exception 2 also beats exception 1: a dependent whose spouse itemizes
    // gets zero, not a Dependents-worksheet amount.
    spouseItemizesIsZeroEvenForADependentWithFourBoxesChecked: () => {
        assertEq(
            standardDeductionCents(taxParams2025)({
                ...chartInput('marriedFilingSeparately', 4),
                spouseItemizes: true,
                claimedAsDependent: true,
                earnedIncomeCents: 200000n,
            }),
            0n,
        )
    },
    // T-10-05-02, the precedence leaf: box-count validation runs BEFORE the
    // hard-zero exceptions, so an impossible five-box return is REFUSED
    // rather than quietly answered `0n`. This is the genuinely
    // order-sensitive property of {@link standardDeductionCents} — an
    // exception must never mask invalid input.
    fiveBoxesIsRefusedEvenWhenAnExceptionWouldHaveZeroedTheResult: () => {
        refuses(() =>
            standardDeductionCents(taxParams2025)({
                ...chartInput('marriedFilingSeparately', 5),
                spouseItemizes: true,
            }),
        )(message => {
            assert(
                message.includes('marriedFilingSeparately'),
                ['expected the refusal to name the filing status', message],
            )
            assert(message.includes('boxes=5'), ['expected the refusal to name the offending count', message])
            assert(message.includes('maximum=4'), ['expected the refusal to name the maximum', message])
        })
    },
}
