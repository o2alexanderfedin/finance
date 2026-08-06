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
        assert(false, ['the Standard Deduction Worksheet for Dependents is not implemented yet', status])
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
}
