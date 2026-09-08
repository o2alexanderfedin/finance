/**
 * Phase 34's second-implementation cross-check: figures this engine produces,
 * set against figures produced by somebody else for Tax Year 2025.
 *
 * ## What this module is for, and why it is not more of the same
 *
 * Every other proof in `fjs/tax/**` compares this engine against a *printed
 * page* — a Rev. Proc. table, a form instruction, a worksheet row. That
 * catches a transcription error, and this repository's `fjs/tax/params`
 * proofs do it thoroughly. It cannot catch a rule this engine and the printed
 * page are both silent about, because there is only ever one implementation
 * in the room.
 *
 * Phase 34's premise is that a SECOND implementation disagreeing is what
 * finds those. The roadmap's own wording is the owner's documents through a
 * commercial filer; the owner's documents do not exist yet, so the substitute
 * is a set of complete Tax Year 2025 Forms 1040 that a commercial filer
 * published, with every line stated. See
 * `.planning/reports/phase-34-cross-check.md` for what the substitute does
 * NOT cover.
 *
 * ## The source
 *
 * `TaxCalcBench` — <https://github.com/column-tax/tax-calc-bench>, paper
 * <https://arxiv.org/abs/2507.16126> — publishes, beside its Tax Year 2024
 * set, ten Tax Year 2025 federal returns whose expected output is a complete
 * Internal Revenue Service Modernized e-File `Return` document. They are
 * produced by Column Tax, a commercial tax-preparation company, from its own
 * production engine: an implementation written by different people, from the
 * same statute, with no code in common with this one.
 *
 * **Tax Year 2025 is the point.** Phase 33 ran the same benchmark's fifty-one
 * Tax Year 2024 cases through this engine and had to hand-transcribe a whole
 * Tax Year 2024 parameter set to do it — a set its own report calls *"the
 * standing suspect in every number"* and *"the largest single source of
 * uncertainty"*. Nothing in that run touched the parameters this engine
 * actually ships. These ten do: they are priced with `taxParamsByYear[2025]`
 * exactly as a real return would be, no overrides of any kind.
 *
 * ## Why only two lines, and why that is still worth having
 *
 * A whole-return diff needs every input, and the benchmark's Tax Year 2025
 * inputs are scanned document PDFs plus a proprietary interview schema. Nine
 * of the ten returns also carry a form this engine does not model at all —
 * Form 4952's investment-interest election, Form 4684, Form 8283, Form 8582,
 * Schedule R, a Form W-2G, Form 8995-A Schedule C. Reconstructing those
 * inputs by hand would produce divergences that measure the reconstruction,
 * not the engine, which is exactly the trap Phase 33's report names in its
 * own §5.4.
 *
 * So this module takes only the lines whose INPUT the published return itself
 * states, so that both sides of every comparison below come from outside this
 * repository:
 *
 * - **line 12e**, from the filing status and the line 12d box count the
 *   return prints. Five returns take the standard deduction.
 * - **line 16**, from the line 15 taxable income the return prints. Four
 *   returns compute it from taxable income alone; the other six carry
 *   qualified dividends or a net capital gain, so their line 16 comes from a
 *   worksheet that needs figures this module deliberately does not
 *   reconstruct. {@link lineSixteenNotReachableFromTaxableIncomeAlone} names
 *   each one and why.
 *
 * Two lines out of nineteen is a narrow diff. It is also the first time any
 * figure this engine ships for Tax Year 2025 has been set against a second
 * implementation's answer for the same year, and line 16 is the one line
 * every other line exists to reach.
 *
 * ## Whole dollars
 *
 * A Modernized e-File `Return` carries whole dollars, so every published
 * figure below is a whole dollar amount and the comparison rounds this
 * engine's exact cents to the nearest dollar before comparing — Form 1040's
 * own p23 election, applied to one line because one line is what is being
 * compared. For three of the four line-16 cases the rounding is a no-op (the
 * Tax Table prints whole dollars already); for the fourth it is not, and that
 * is stated at the leaf.
 *
 * @module
 */
import { assert, assertEq } from 'functionalscript/fjs/asserts/module.f.mjs'
import { of, halfUp } from '../../types/rational/module.f.js'
import { centsFromString, centsToString } from '../../exact/module.f.js'
import { taxParamsByYear } from '../params/module.f.js'
import { baseTaxForAmount } from '../table/module.f.js'
import { standardDeductionCents } from '../deduction/module.f.js'

/** @import { IndividualFilingStatus } from '../params/module.f.js' */
/** @import { Line16BaseMethod } from '../table/module.f.js' */

/**
 * TY2025's parameter set, narrowed exactly once at module scope — the same
 * idiom, and for the same reason, as `fjs/tax/table/module.f.js`'s own
 * constant of this name: `noUncheckedIndexedAccess` makes the lookup
 * `TaxParamSet | undefined`, and AGENTS.md bans both a cast and a non-null
 * assertion over it.
 */
const taxParams2025 = taxParamsByYear[2025]
assert(taxParams2025 !== undefined, 'expected TY2025 parameters to be present in taxParamsByYear')

/**
 * One published return's line 12e, with the two facts the printed form itself
 * carries that decide it: the filing status box, and the count of line 12d
 * age/blindness boxes the return checks.
 *
 * `name` is the benchmark's own lowercase case directory name. It is spelled
 * in lower case deliberately: an upper-case form would match the
 * requirement-ID shape `planning-truth-gate.test.js` scans this tree for, and
 * a fixture that looks like a citation is a fixture that will one day be read
 * as one.
 * @typedef {{
 *   readonly name: string,
 *   readonly status: IndividualFilingStatus,
 *   readonly agedOrBlindBoxes: number,
 *   readonly publishedLineTwelveE: string,
 * }} PublishedStandardDeduction
 */

/**
 * The five published Tax Year 2025 returns that take the standard deduction,
 * hand-typed from each case's own `output.xml`:
 * `IndividualReturnFilingStatusCd`, `TotalBoxesCheckedCnt` (absent means
 * zero) and `TotalItemizedOrStandardDedAmt`. Nothing here is computed, and
 * nothing here may be derived from `fjs/tax/params` — these figures ARE the
 * independent side.
 *
 * The married-filing-separately row with one box is the sharp one. Its
 * $17,350 is $15,750 plus $1,600, not plus $2,000: Rev. Proc. 2024-40
 * §2.15(3)'s larger unmarried increment does not reach a married filer even
 * when that filer files alone, and a second implementation agreeing on
 * $17,350 is what says this engine reads the right one of the two.
 * @type {readonly PublishedStandardDeduction[]}
 */
export const publishedStandardDeductions = [
    // ty25-us-003: married filing jointly, spouse 65 or older (one box).
    { name: 'ty25-us-003', status: 'marriedFilingJointly', agedOrBlindBoxes: 1, publishedLineTwelveE: '33100.00' },
    // ty25-us-005: married filing jointly, no boxes.
    { name: 'ty25-us-005', status: 'marriedFilingJointly', agedOrBlindBoxes: 0, publishedLineTwelveE: '31500.00' },
    // ty25-us-006: married filing separately, no boxes.
    { name: 'ty25-us-006', status: 'marriedFilingSeparately', agedOrBlindBoxes: 0, publishedLineTwelveE: '15750.00' },
    // ty25-us-007: married filing separately, no boxes.
    { name: 'ty25-us-007', status: 'marriedFilingSeparately', agedOrBlindBoxes: 0, publishedLineTwelveE: '15750.00' },
    // ty25-us-009: married filing separately, taxpayer 65 or older (one box).
    { name: 'ty25-us-009', status: 'marriedFilingSeparately', agedOrBlindBoxes: 1, publishedLineTwelveE: '17350.00' },
]

/**
 * One published return's line 16, with the line 15 taxable income it is
 * computed from and the method the printed page directs at that income.
 * @typedef {{
 *   readonly name: string,
 *   readonly status: IndividualFilingStatus,
 *   readonly publishedLineFifteen: string,
 *   readonly publishedLineSixteen: string,
 *   readonly expectedMethod: Line16BaseMethod,
 * }} PublishedLineSixteen
 */

/**
 * The four published Tax Year 2025 returns whose line 16 follows from line 15
 * alone — no qualified dividends, no net capital gain, so no preferential
 * rate worksheet stands between the two. Both figures in every row are
 * hand-typed from the case's own `output.xml` (`TaxableIncomeAmt` and
 * `TaxAmt`).
 *
 * The four are chosen by the source's own data, not for convenience, and
 * between them they exercise three different things:
 *
 * - **the Tax Table's midpoint rule at a half-dollar tie**, twice.
 *   `ty25-us-002`'s $7,525 is the midpoint of its own $7,500-$7,550 band and
 *   ten percent of it is exactly $752.50; `ty25-us-010`'s band midpoint
 *   $7,575 gives exactly $757.50. A filer expecting plain bracket arithmetic
 *   gets $752 and $757; the printed table, and this engine, and the second
 *   implementation all say $753 and $758.
 * - **a qualifying surviving spouse priced at all**, which nothing else in
 *   this repository does against an outside answer. It does NOT pin the
 *   column, and an early draft of this docstring claimed it did. Pointing
 *   `taxTableColumnFor.qualifyingSurvivingSpouse` at `single` leaves this row
 *   green: $7,574 is inside the ten-percent bracket for every status, so the
 *   single and married-filing-jointly columns print the same $758 there. The
 *   leaf that does pin the column is `fjs/tax/table`'s own
 *   `qualifyingSurvivingSpouseReadsTheMarriedFilingJointlyColumn`, at
 *   $25,300, and the mutation above reddens exactly that one. The claim was
 *   written down before it was run, and running it is what corrected it.
 * - **the Tax Computation Worksheet above $100,000** — `ty25-us-008` at
 *   $122,193 of married-filing-separately taxable income.
 * @type {readonly PublishedLineSixteen[]}
 */
export const publishedLineSixteens = [
    { name: 'ty25-us-002', status: 'headOfHousehold', publishedLineFifteen: '7525.00', publishedLineSixteen: '753.00', expectedMethod: 'taxTable' },
    { name: 'ty25-us-003', status: 'marriedFilingJointly', publishedLineFifteen: '26905.00', publishedLineSixteen: '2754.00', expectedMethod: 'taxTable' },
    { name: 'ty25-us-008', status: 'marriedFilingSeparately', publishedLineFifteen: '122193.00', publishedLineSixteen: '22173.00', expectedMethod: 'taxComputationWorksheet' },
    { name: 'ty25-us-010', status: 'qualifyingSurvivingSpouse', publishedLineFifteen: '7574.00', publishedLineSixteen: '758.00', expectedMethod: 'taxTable' },
]

/**
 * The six published returns whose line 16 this module does NOT check, each
 * with the reason, so the census is a statement that can be argued with
 * rather than a silence.
 *
 * Every one of the six carries qualified dividends, a net capital gain, or
 * both, so its line 16 comes from the Qualified Dividends and Capital Gain
 * Tax Worksheet — which needs the split between ordinary and preferential
 * income, and that split is not a line the graded set publishes. Checking
 * them would mean reconstructing Schedule D and Form 1099-DIV from the
 * benchmark's input PDFs, and a reconstruction is what would then be on
 * trial.
 *
 * `ty25-us-001` is the one worth reading twice. Its published line 16 is
 * $1,332,556, and the plain worksheet answer for a head of household with
 * $5,985,200 of taxable income and $5,000,000 of long-term capital gain is
 * $1,319,806 — $12,750 lower. The difference is seventeen percent of the
 * $75,000 the return elects, on Form 4952, to treat as investment income:
 * that election moves $75,000 out of the twenty-percent rate and into the
 * thirty-seven percent one. There is no `fjs/form4952`, so the election
 * cannot be made here at all.
 * @type {readonly { readonly name: string, readonly reason: string }[]}
 */
export const lineSixteenNotReachableFromTaxableIncomeAlone = [
    {
        name: 'ty25-us-001',
        reason: '$5,000,000 of long-term capital gain, and a Form 4952 election of $75,000 as investment income that no module here can make',
    },
    { name: 'ty25-us-004', reason: '$4,870 of qualified dividends and $37,109 of net long-term capital gain' },
    { name: 'ty25-us-005', reason: '$1,500 of qualified dividends' },
    { name: 'ty25-us-006', reason: '$12,000 of qualified dividends' },
    { name: 'ty25-us-007', reason: '$7 of qualified dividends and $18,458 of net capital gain' },
    { name: 'ty25-us-009', reason: '$1,500 of qualified dividends' },
]

/**
 * One of the Internal Revenue Service's OWN Tax Year 2025 Assurance Testing
 * System scenarios, in the two respects it and this engine can be compared:
 * the standard deduction it enters on line 12e, and the tax it enters on
 * line 16 for the taxable income it prints on line 15.
 *
 * `publishedLineTwelveE` and `publishedLineSixteen` are what the scenario
 * prints. `engineLineSixteen` is what this engine answers, hand-typed from
 * the printed source it comes from — the 2025 Tax Table for the first, the
 * 2025 Tax Computation Worksheet for the second — never read back from the
 * code under test.
 * @typedef {{
 *   readonly name: string,
 *   readonly status: IndividualFilingStatus,
 *   readonly publishedLineTwelveE: string,
 *   readonly publishedLineFifteen: string,
 *   readonly publishedLineSixteen: string,
 *   readonly engineLineTwelveE: string,
 *   readonly engineLineSixteen: string,
 *   readonly expectedMethod: Line16BaseMethod,
 * }} TestScenario
 */

/**
 * The two Assurance Testing System scenarios that carry a COMPLETED Form
 * 1040, out of the eight the Internal Revenue Service publishes for Tax Year
 * 2025 at
 * <https://www.irs.gov/e-file-providers/tax-year-2025-form-1040-series-and-extensions-modernized-e-file-mef-assurance-testing-system-ats-information>.
 * The other six print the taxpayer's documents and leave every computed line
 * blank — which is what the scenarios are for: a software developer computes
 * them and the Service checks the resulting XML against its schema and its
 * business rules, none of which recompute line 16.
 *
 * **This is the one place in Phase 34 where a disagreement was found, and it
 * runs three ways.** Both scenarios disagree with this engine on line 12e;
 * one also disagrees on line 16; and the second scenario's line 16 agrees
 * exactly, which is what makes the other two disagreements findings rather
 * than a blanket failure to understand the source.
 *
 * - **line 12e, both scenarios: the pre-OBBBA standard deduction.** Scenario
 *   12 enters $15,000 for a single filer and scenario 13 enters $30,000 for a
 *   joint one. Those are Rev. Proc. 2024-40 §2.15's original Tax Year 2025
 *   figures, superseded by P.L. 119-21 §70103 and restated as $15,750 and
 *   $31,500 in Rev. Proc. 2025-32 §3.01 — which is what this engine stores,
 *   what Publication 17 (2025) pages 1 and 20 print, and what the scenarios'
 *   OWN form face prints in its left margin two lines above the entry. The
 *   scenario is internally inconsistent, not merely different from us.
 * - **line 16, scenario 13: the Tax Table was not used.** On $1,620 of joint
 *   taxable income the scenario enters $162, which is exactly ten percent of
 *   $1,620. The printed Tax Table's $1,600-$1,625 row says **161**, because
 *   the row prices its own midpoint of $1,612.50. Below $100,000 the Tax
 *   Table is not optional, so $161 is the entry the form asks for.
 * - **line 16, scenario 12: agreement, to the dollar.** $107,445 of single
 *   taxable income is above the table, so the Tax Computation Worksheet
 *   applies: 24% x $107,445.00 - $7,153.00 = $18,633.80, and the scenario
 *   enters $18,634. Note that this agreement is WITH the scenario's own
 *   line 15, stale deduction and all — the two disagreements are about which
 *   figures go in, and this one is about the arithmetic that follows.
 * @type {readonly TestScenario[]}
 */
export const internalRevenueServiceTestScenarios = [
    {
        name: 'assurance testing scenario 12',
        status: 'single',
        publishedLineTwelveE: '15000.00',
        publishedLineFifteen: '107445.00',
        publishedLineSixteen: '18634.00',
        engineLineTwelveE: '15750.00',
        engineLineSixteen: '18633.80',
        expectedMethod: 'taxComputationWorksheet',
    },
    {
        name: 'assurance testing scenario 13',
        status: 'marriedFilingJointly',
        publishedLineTwelveE: '30000.00',
        publishedLineFifteen: '1620.00',
        publishedLineSixteen: '162.00',
        engineLineTwelveE: '31500.00',
        engineLineSixteen: '161.00',
        expectedMethod: 'taxTable',
    },
]

/**
 * Hand-typed counts, read off the published set rather than off the arrays
 * above. `.length` on a transcription can never fail: a row deleted in an
 * edit takes the diff's coverage with it while every remaining row still
 * passes — AGENTS.md's fourth shipped defect, in miniature.
 *
 * Ten returns in the published Tax Year 2025 federal set. Five take the
 * standard deduction; the other five itemize. Four have a line 16 that
 * follows from taxable income alone; the other six do not, and four plus six
 * must still be ten.
 */
const publishedFederalReturnCount = 10
const publishedStandardDeductionCount = 5
const publishedLineSixteenCount = 4
const notReachableLineSixteenCount = 6

/**
 * Eight Form 1040 scenarios in the Tax Year 2025 Assurance Testing System
 * set (numbered 1-5, 8, 12 and 13; the set also carries one Form 1040-SS and
 * one Form 4868, which are not Forms 1040), of which two carry a completed
 * return. Hand-typed from the published index and from opening all eight.
 */
const testScenarioCount = 2

/**
 * The exact cents this engine computes, rounded to the nearest whole dollar
 * (ties away from zero) and re-expressed in cents, so it is comparable with a
 * Modernized e-File whole-dollar figure. Not new arithmetic: this is the same
 * `halfUp` over a dollar-scale `Rational` that `fjs/tax/table`'s own row
 * generator uses, applied here to ONE line because one line is what is being
 * compared.
 *
 * **Exactly one row here can tell `halfUp` from truncation, and it is not one
 * of the commercial filer's.** Replacing this function's body with
 * `cents / 100n * 100n` reddens one leaf:
 * `scenarioTwelveAgreesAndScenarioThirteenDoesNot`, whose $18,633.80 truncates
 * to $18,633 against a published $18,634. Not one of the four
 * `publishedLineSixteens` rows moves, and that is a property of those rows
 * rather than of the rounding — three carry no cents at all and the fourth
 * carries thirty-two, so none reaches a half dollar.
 * `everyPublishedRowRoundsDownwardSoTruncationWouldAlsoAgree` states that as
 * an assertion, so the limit is recorded rather than assumed.
 *
 * This paragraph said "no published row here can tell them apart" until the
 * test scenarios were added below and the mutation was re-run. It was true
 * when written and false four hours later, which is the whole argument for
 * re-running a recorded observation rather than citing it.
 * @type {(cents: bigint) => bigint}
 */
const toWholeDollarCents = cents => halfUp(of(cents)(100n)) * 100n

export const proof = {
    // The census first, so a row silently dropped from either list below
    // fails here rather than quietly shrinking the diff.
    theTenPublishedReturnsAreAccountedFor: () => {
        assertEq(
            publishedStandardDeductions.length,
            publishedStandardDeductionCount,
            'expected five published returns taking the standard deduction',
        )
        assertEq(
            publishedLineSixteens.length,
            publishedLineSixteenCount,
            'expected four published returns whose line 16 follows from line 15 alone',
        )
        assertEq(
            lineSixteenNotReachableFromTaxableIncomeAlone.length,
            notReachableLineSixteenCount,
            'expected six published returns whose line 16 needs a preferential-rate worksheet',
        )
        assertEq(
            publishedLineSixteenCount + notReachableLineSixteenCount,
            publishedFederalReturnCount,
            'every published return is either checked at line 16 or named as unreachable',
        )
        // No return may appear in both line-16 lists. Without this, moving a
        // case from one list to the other and forgetting to delete it would
        // still satisfy the arithmetic above.
        for (const unreachable of lineSixteenNotReachableFromTaxableIncomeAlone) {
            assert(
                publishedLineSixteens.every(checked => checked.name !== unreachable.name),
                ['a return may not be both checked and named unreachable', unreachable.name],
            )
        }
    },
    // Line 12e, five returns. The comparison is against the published
    // `TotalItemizedOrStandardDedAmt`, never against `standardDeduction` or
    // `agedOrBlindAdditional` — reading either of those back would compare
    // `fjs/tax/params` with itself, which is the tautology AGENTS.md records
    // this project shipping four times.
    everyPublishedStandardDeductionAgrees: () => {
        for (const published of publishedStandardDeductions) {
            const ours = standardDeductionCents(taxParams2025)({
                status: published.status,
                agedOrBlindBoxes: published.agedOrBlindBoxes,
                claimedAsDependent: false,
                spouseItemizes: false,
                dualStatusAlien: false,
                earnedIncomeCents: 0n,
            })
            assertEq(
                ours,
                centsFromString(published.publishedLineTwelveE),
                ['line 12e disagrees with the published return', published.name, centsToString(ours)],
            )
        }
    },
    // The married-filing-separately aged increment, isolated from the loop
    // above so it names itself when it breaks. $17,350 - $15,750 = $1,600,
    // and the published return is what says so; picking the unmarried
    // $2,000 would give $17,750 and this engine would be a second
    // implementation disagreeing with the first.
    marriedFilingSeparatelyTakesTheMarriedAgedIncrementNotTheUnmarriedOne: () => {
        const withOneBox = standardDeductionCents(taxParams2025)({
            status: 'marriedFilingSeparately',
            agedOrBlindBoxes: 1,
            claimedAsDependent: false,
            spouseItemizes: false,
            dualStatusAlien: false,
            earnedIncomeCents: 0n,
        })
        assertEq(withOneBox, centsFromString('17350.00'))
        assert(
            withOneBox !== centsFromString('17750.00'),
            ['expected the married increment, not the unmarried one', centsToString(withOneBox)],
        )
    },
    // Line 16, four returns — the method as well as the number, because two
    // routes can reach the same figure and a dispatcher that took the wrong
    // one would be invisible to an amount-only assertion (the shape
    // `fjs/tax/table`'s own seam proof exists for).
    //
    // `ty25-us-008` is the row where the whole-dollar rounding is not a
    // no-op: twenty-four percent of $122,193 less the printed $7,153
    // subtraction is $22,173.32 to the cent, and the published return says
    // $22,173. The other three come off the Tax Table, which prints whole
    // dollars, so their rounding changes nothing.
    everyPublishedLineSixteenAgrees: () => {
        for (const published of publishedLineSixteens) {
            const ours = baseTaxForAmount(taxParams2025)(published.status)(
                centsFromString(published.publishedLineFifteen),
            )
            assertEq(
                ours.method,
                published.expectedMethod,
                ['line 16 reached by the wrong method', published.name, ours.method],
            )
            assertEq(
                toWholeDollarCents(ours.cents),
                centsFromString(published.publishedLineSixteen),
                ['line 16 disagrees with the published return', published.name, centsToString(ours.cents)],
            )
        }
    },
    // The rounding above is load-bearing exactly once, and this leaf is what
    // says so: `ty25-us-008`'s exact answer carries thirty-two cents, so a
    // reader cannot conclude from the loop that every row happened to be a
    // whole dollar already. Both figures are hand-typed — $22,173.32 from
    // the printed worksheet row (24% x $122,193.00 - $7,153.00, Publication
    // 17 (2025) page 123, Section C) and $22,173 from the published return.
    theOneRowWhereWholeDollarRoundingChangesTheAnswer: () => {
        const ours = baseTaxForAmount(taxParams2025)('marriedFilingSeparately')(centsFromString('122193.00'))
        assertEq(ours.cents, centsFromString('22173.32'))
        assertEq(toWholeDollarCents(ours.cents), centsFromString('22173.00'))
    },
    // Two of the four line-16 rows land on an exact half dollar, and that is
    // the Tax Table's whole point: the midpoint rule plus a tie broken away
    // from zero. Asserted directly rather than left implicit in the loop,
    // and with the naive answer named, so a rounding regression says which
    // of the two it produced.
    twoPublishedReturnsSitOnAHalfDollarTie: () => {
        const headOfHousehold = baseTaxForAmount(taxParams2025)('headOfHousehold')(centsFromString('7525.00'))
        assertEq(headOfHousehold.cents, centsFromString('753.00'))
        assert(
            headOfHousehold.cents !== centsFromString('752.00'),
            ['expected the tie broken away from zero, not toward it', centsToString(headOfHousehold.cents)],
        )
        const survivingSpouse = baseTaxForAmount(taxParams2025)('qualifyingSurvivingSpouse')(centsFromString('7574.00'))
        assertEq(survivingSpouse.cents, centsFromString('758.00'))
        assert(
            survivingSpouse.cents !== centsFromString('757.00'),
            ['expected the tie broken away from zero, not toward it', centsToString(survivingSpouse.cents)],
        )
    },
    // The limit of the COMMERCIAL FILER's half of the comparison, written
    // down as an assertion rather than left for the next reader to discover
    // by mutating it a second time. Not one of the four rows in
    // `publishedLineSixteens` carries a fraction of half a dollar or more, so
    // `toWholeDollarCents` and plain truncation agree on every one of them.
    //
    // This is deliberately NOT a claim that the rounding is right — it is a
    // claim about that published data. What pins the rounding is the test
    // scenario's $18,633.80 (see `toWholeDollarCents`) and, for the
    // tie-breaking direction specifically, `fjs/tax/table`'s $18,000
    // married-filing-jointly row.
    // The Assurance Testing System scenarios, and the three-way result they
    // produce. Every figure compared here is hand-typed: the scenario's own
    // entries from its published PDF, and this engine's from the printed
    // source it comes from.
    //
    // A disagreement is PINNED rather than tolerated. `assert` on the
    // inequality is what stops the day this engine starts answering $162 or
    // $30,000 from passing silently as "the scenario and we now agree" — the
    // engine moving toward a wrong published figure is exactly as much a
    // regression as it moving away from a right one, and only the pinned
    // inequality can tell them apart.
    theTwoTestScenariosWithACompletedReturn: () => {
        assertEq(
            internalRevenueServiceTestScenarios.length,
            testScenarioCount,
            'expected two of the eight Form 1040 scenarios to carry a completed return',
        )
        for (const scenario of internalRevenueServiceTestScenarios) {
            const ourDeduction = standardDeductionCents(taxParams2025)({
                status: scenario.status,
                agedOrBlindBoxes: 0,
                claimedAsDependent: false,
                spouseItemizes: false,
                dualStatusAlien: false,
                earnedIncomeCents: 0n,
            })
            assertEq(
                ourDeduction,
                centsFromString(scenario.engineLineTwelveE),
                ['line 12e is not the figure Rev. Proc. 2025-32 §3.01 states', scenario.name, centsToString(ourDeduction)],
            )
            assert(
                ourDeduction !== centsFromString(scenario.publishedLineTwelveE),
                [
                    'this engine has adopted the superseded pre-OBBBA standard deduction',
                    scenario.name,
                    centsToString(ourDeduction),
                ],
            )
            const ourTax = baseTaxForAmount(taxParams2025)(scenario.status)(
                centsFromString(scenario.publishedLineFifteen),
            )
            assertEq(
                ourTax.method,
                scenario.expectedMethod,
                ['line 16 reached by the wrong method', scenario.name, ourTax.method],
            )
            assertEq(
                ourTax.cents,
                centsFromString(scenario.engineLineSixteen),
                ['line 16 is not the figure the printed page gives', scenario.name, centsToString(ourTax.cents)],
            )
        }
    },
    // Scenario 12's line 16 AGREES, and scenario 13's does not. Split out
    // from the loop above because they are different results and a loop that
    // reported them together would let either one change unnoticed.
    //
    // The control matters more than usual here: without it, "this engine
    // disagrees with an Internal Revenue Service test scenario" would be a
    // claim with nothing behind it. Scenario 12 is that control, and it
    // agrees to the dollar on the harder of the two arithmetics.
    scenarioTwelveAgreesAndScenarioThirteenDoesNot: () => {
        const twelve = baseTaxForAmount(taxParams2025)('single')(centsFromString('107445.00'))
        assertEq(toWholeDollarCents(twelve.cents), centsFromString('18634.00'))
        const thirteen = baseTaxForAmount(taxParams2025)('marriedFilingJointly')(centsFromString('1620.00'))
        assertEq(thirteen.cents, centsFromString('161.00'))
        assert(
            thirteen.cents !== centsFromString('162.00'),
            [
                'the scenario\'s $162 is ten percent of $1,620; the printed Tax Table prices the band midpoint $1,612.50',
                centsToString(thirteen.cents),
            ],
        )
        // The naive answer at the band's own lower bound is a third number
        // again, and naming it is what says this leaf is about the midpoint
        // rule rather than about rounding: ten percent of $1,600 is $160.
        assert(
            thirteen.cents !== centsFromString('160.00'),
            ['expected the band midpoint, not its lower bound', centsToString(thirteen.cents)],
        )
    },
    everyPublishedRowRoundsDownwardSoTruncationWouldAlsoAgree: () => {
        const halfADollarInCents = 50n
        for (const published of publishedLineSixteens) {
            const { cents } = baseTaxForAmount(taxParams2025)(published.status)(
                centsFromString(published.publishedLineFifteen),
            )
            assert(
                cents % 100n < halfADollarInCents,
                [
                    'a published row reaching a half dollar would make this comparison depend on the rounding direction',
                    published.name,
                    centsToString(cents),
                ],
            )
        }
    },
}
