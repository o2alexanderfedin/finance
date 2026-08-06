/**
 * Form 1040 line 16's METHOD DISPATCH (TAX-03), across all four printed
 * methods — Tax Table, Tax Computation Worksheet, Qualified Dividends and
 * Capital Gain Tax Worksheet, Schedule D Tax Worksheet — plus the three
 * level-0 wrappers that outrank every one of them.
 *
 * **Line 16 is not bracket arithmetic**, and after this module the engine
 * cannot pretend it is. The instruction page (i1040gi p36) states one
 * default and then a list of overrides, and the overrides are not
 * commutative.
 *
 * ## Why every outcome carries a `method`, on the refusing arm too
 *
 * A proof asserting only `cents` cannot distinguish "chose the QDCGT
 * worksheet and got the right answer" from "chose the Tax Table and got
 * the right answer because the taxpayer had no preferential income."
 * Those are the same number and different engines, and only one of them
 * stays right when the taxpayer's facts change. `fjs/tax/table`'s
 * {@link baseTaxForAmount} already carries the tag for the same reason,
 * one level down.
 *
 * The tag sits on the ERROR arm as well, which is the part that is easy
 * to lose. 10-CONTEXT.md Decision 1 ships the Schedule D Tax Worksheet
 * branch as a TAX-16 REFUSAL rather than a computation, so that branch
 * returns no cents at all. Without a tag there would be nothing whatever
 * to assert about which branch was selected, and TAX-03's "a proof per
 * branch" would be unprovable for one of its four branches — the phase's
 * central claim would have a hole exactly where the hardest computation
 * was deferred.
 *
 * ## Why the ordering is the hard part, stated once
 *
 * **When Schedule D lines 18 and 19 are both zero and Form 4952 is not
 * filed, the Schedule D Tax Worksheet is algebraically identical to the
 * QDCGT** (10-RESEARCH.md derived the line-by-line mapping from both
 * printed worksheets). So every test case without unrecaptured §1250 gain
 * or collectibles gain — which is every ordinary brokerage return —
 * produces the *same cents* under either ordering. A green suite of such
 * cases proves nothing at all about the order.
 *
 * The failure that hides behind that identity: route a taxpayer who has
 * BOTH qualified dividends and §1250 or collectibles gain to the QDCGT,
 * and the whole preferential slice is taxed at 0/15/20%, where the
 * Schedule D Tax Worksheet taxes unrecaptured §1250 gain at up to 25%
 * (its lines 35–40) and collectibles at 28% (its lines 41–43). The answer
 * is wrong, it is wrong in the taxpayer's favour, and nothing screams.
 *
 * That is why level 2a is tested STRICTLY BEFORE level 2c below, and why
 * the proof that catches a swap asserts the **selected method** on an
 * input with a NON-ZERO Schedule D line 19 — see
 * `scheduleDConditionsOutrankQualifiedDividends` and its control.
 *
 * ## The three level-0 entries are WRAPPERS, not a fifth peer branch
 *
 * The Foreign Earned Income Tax Worksheet (i1040gi p37) does not replace
 * the dispatch; it RE-ENTERS it. Its own line 4 reads: "Figure the tax on
 * the amount on line 3. Use the Tax Table, Tax Computation Worksheet,
 * Qualified Dividends and Capital Gain Tax Worksheet, Schedule D Tax
 * Worksheet, or Form 8615, whichever applies." Form 8615 re-enters the
 * same way, and Schedule J is an election over a re-entered base. So they
 * are modelled here as the OUTERMOST level and each one refuses: this
 * module knows which method was selected, and knows it cannot compute the
 * wrapper around it, which is precisely a TAX-16 scope refusal rather
 * than a silently ordinary number.
 *
 * ## One rule, one place
 *
 * Every refusal below is built by `fjs/return/scope`'s {@link scopeRefusal}
 * and nothing else. This module never constructs a refusal message or an
 * `unmodeled` list of its own; it only widens the refusal with the method
 * tag that says which branch produced it. T-10-08-03 is exactly the risk
 * of a second, parallel refusal mechanism growing here — the same defect
 * that once left the zero-read kill condition duplicated with every proof
 * bound to the copy that did not ship.
 *
 * @module
 */
import { assert, assertEq } from 'functionalscript/fjs/asserts/module.f.js'
import { baseTaxForAmount } from '../table/module.f.js'
import { taxParamsByYear } from '../params/module.f.js'
import { qdcgt } from './qdcgt/module.f.js'
import { scopeRefusal } from '../../return/scope/module.f.js'

/** @import { TaxParamSet, IndividualFilingStatus } from '../params/module.f.js' */
/** @import { ScopeError, UnmodeledKind } from '../../return/scope/module.f.js' */

/**
 * Which of Form 1040 line 16's methods produced an outcome.
 *
 * The first four are TAX-03's four branches: three of them COMPUTE, and
 * `'scheduleDTaxWorksheet'` is SELECTED and then refuses (10-CONTEXT.md
 * Decision 1 — that worksheet needs Phase 12's brokerage documents to
 * have anything to compute over, so implementing it now would mean
 * writing the hardest computation in v1 against inputs that do not yet
 * exist). The last three are the level-0 wrappers described in this
 * module's docstring; they are not peer branches.
 * @typedef {'taxTable' | 'taxComputationWorksheet' | 'qdcgt' | 'scheduleDTaxWorksheet'
 *   | 'foreignEarnedIncomeTaxWorksheet' | 'form8615' | 'scheduleJ'} Line16Method
 */

/** A computed line 16: the cents, and which method produced them.
 * @typedef {{ readonly kind: 'ok', readonly method: Line16Method, readonly cents: bigint }} Line16Ok
 */

/**
 * A refused line 16: `fjs/return/scope`'s {@link ScopeError} — its exact
 * `message` and `unmodeled` fields, unmodified — plus the method tag
 * saying WHICH branch was selected before it refused.
 *
 * Written as an INTERSECTION with `ScopeError` rather than as a fresh
 * object type spelling out `message` and `unmodeled` again. That is not
 * tidiness: a re-spelled shape is a second declaration of what a refusal
 * is, and it would drift from `fjs/return/scope`'s the first time that
 * module gained a field. Here the two cannot drift, and the arms below
 * take `message` and `unmodeled` from {@link scopeRefusal} by shorthand
 * so neither value can be invented locally.
 * @typedef {ScopeError & { readonly method: Line16Method }} Line16Error
 */

/** One line-16 decision: computed, or refused — tagged either way.
 * @typedef {Line16Ok | Line16Error} Line16Outcome
 */

/**
 * Everything the line-16 decision tree asks about a return. Every field
 * is a FACT ABOUT THE RETURN, never a pre-decided method: the whole point
 * of TAX-03 is that the selection is made here, once, from the printed
 * conditions, rather than by a caller that already believes it knows.
 *
 * `scheduleD18Cents` and `scheduleD19Cents` earn their place even though
 * this phase cannot compute the worksheet they select — they are the ONLY
 * inputs on which the Schedule D Tax Worksheet and the QDCGT disagree, so
 * a dispatcher that did not read them could not tell the two branches
 * apart at all.
 * @typedef {{
 *   readonly status: IndividualFilingStatus,
 *   readonly taxableIncomeCents: bigint,
 *   readonly qualifiedDividendsCents: bigint,
 *   readonly capitalGainDistributionsCents: bigint,
 *   readonly filingScheduleD: boolean,
 *   readonly scheduleD15Cents: bigint,
 *   readonly scheduleD16Cents: bigint,
 *   readonly scheduleD18Cents: bigint,
 *   readonly scheduleD19Cents: bigint,
 *   readonly filingForm4952: boolean,
 *   readonly form4952Line4gCents: bigint,
 *   readonly filingForm2555: boolean,
 *   readonly form8615Applies: boolean,
 *   readonly scheduleJElected: boolean,
 * }} Line16Inputs
 */

/**
 * The line-16 method dispatch, in the printed order, as four levels. Each
 * level below carries the instruction text it implements, so this can be
 * diffed against i1040gi p36 line by line rather than against memory.
 * @type {(taxParamSet: TaxParamSet) => (inputs: Line16Inputs) => Line16Outcome}
 */
export const dispatchLine16 = taxParamSet => inputs => {
    const {
        status, taxableIncomeCents, qualifiedDividendsCents, capitalGainDistributionsCents,
        filingScheduleD, scheduleD15Cents, scheduleD16Cents, scheduleD18Cents, scheduleD19Cents,
        filingForm4952, form4952Line4gCents, filingForm2555, form8615Applies, scheduleJElected,
    } = inputs
    // The QDCGT arm, shared by level 2's THREE printed bullets (2c, 2d,
    // 2e) — each of which is written below as its own `if`, exactly as
    // the page prints it, rather than fused into one disjunction. Fusing
    // them would read more compactly and would destroy the property this
    // plan exists to protect: 2c and 2e have different relationships to
    // level 2a (2c is invisible to a taxpayer with no qualified
    // dividends; 2e is not), so a single fused condition could not be
    // moved past 2a in the one way the ordering mutation requires.
    //
    // A function, called only on the arm that selects it: the worksheet
    // must not run for a return the dispatcher refuses.
    /** @type {() => Line16Outcome} */
    const qdcgtOutcome = () => ({
        kind: 'ok',
        method: 'qdcgt',
        cents: qdcgt(taxParamSet)({
            status,
            line1Cents: taxableIncomeCents,
            line2Cents: qualifiedDividendsCents,
            filingScheduleD,
            scheduleD15Cents,
            scheduleD16Cents,
            line7aCents: capitalGainDistributionsCents,
        }).line25,
    })
    // ── LEVEL 0 — WRAPPERS, OUTERMOST ────────────────────────────────────
    //
    // "But if you are filing Form 2555, you must use the Foreign Earned
    // Income Tax Worksheet instead." — stated TWICE on p36, once under
    // the Schedule D Tax Worksheet heading and once under the QDCGT
    // heading, which is what makes it outrank BOTH preferential
    // worksheets rather than sitting beside them.
    //
    // 0a. Form 2555 filed.
    if (filingForm2555) {
        const { message, unmodeled } = scopeRefusal(['foreignEarnedIncomeForm2555'])
        return { kind: 'error', method: 'foreignEarnedIncomeTaxWorksheet', message, unmodeled }
    }
    // 0b. Form 8615 conditions met (a child's unearned income over
    //     $2,700). Form 8615 re-enters this dispatch internally, so it is
    //     a wrapper for the same reason Form 2555 is.
    if (form8615Applies) {
        const { message, unmodeled } = scopeRefusal(['childsUnearnedIncomeForm8615'])
        return { kind: 'error', method: 'form8615', message, unmodeled }
    }
    // 0c. Schedule J ELECTED. An election, never mandatory — "your tax
    //     MAY be less if you choose to figure it using income averaging"
    //     — which is why the input is named `scheduleJElected` and not
    //     `filingScheduleJ`.
    if (scheduleJElected) {
        const { message, unmodeled } = scopeRefusal(['farmIncomeAveragingScheduleJ'])
        return { kind: 'error', method: 'scheduleJ', message, unmodeled }
    }
    // ── LEVEL 1 — THE PREFERENTIAL-RATE GATE ─────────────────────────────
    //
    // From the Schedule D Tax Worksheet header's own "Exception"
    // (i1040sd p15).
    //
    // 1a. Form 1040 line 15 is zero or less: neither preferential
    //     worksheet runs and the tax is $0. Tagged `'taxTable'` because
    //     that is the method the printed default names for an amount
    //     below $100,000 — not because a table lookup happened.
    if (taxableIncomeCents <= 0n) {
        return { kind: 'ok', method: 'taxTable', cents: 0n }
    }
    // 1b is NOT a separate branch here. 10-RESEARCH.md states it as
    // "(Sch D line 15 <= 0 OR Sch D line 16 <= 0) AND line 3a = 0 ->
    // neither worksheet", which is exactly the negation of 2c, 2d and 2e
    // below: such a return falls through all three to level 3 on its own.
    // Written down so a reader diffing this against the research tree
    // does not conclude a level went missing.
    //
    // ── LEVEL 2 — WHICH PREFERENTIAL WORKSHEET ───────────────────────────
    //
    // The Schedule D Tax Worksheet is tested STRICTLY BEFORE the QDCGT.
    // The instructions say so in words — the QDCGT heading opens "Use the
    // Qualified Dividends and Capital Gain Tax Worksheet, later, to
    // figure your tax IF YOU DON'T HAVE TO USE THE SCHEDULE D TAX
    // WORKSHEET" — and this module's docstring says why the order is
    // undetectable by any ordinary test case.
    const scheduleDLinesFifteenAndSixteenAreBothGains
        = filingScheduleD && scheduleD15Cents > 0n && scheduleD16Cents > 0n
    // 2a. "You have to file Schedule D, line 18 or 19 of Schedule D is
    //     more than zero, and lines 15 and 16 of Schedule D are gains."
    //
    //     WHY 2a MUST PRECEDE 2c. A taxpayer with both qualified
    //     dividends and §1250 or collectibles gain routed to the QDCGT
    //     gets the whole preferential slice taxed at 0/15/20%, while the
    //     Schedule D Tax Worksheet taxes unrecaptured §1250 gain at up to
    //     25% and collectibles at 28%. The answer is wrong, it is wrong
    //     in the taxpayer's favour, and nothing screams — because with
    //     lines 18 and 19 zero the two worksheets are algebraically
    //     identical, so no ordinary test case can tell the two orderings
    //     apart. Only the SELECTED METHOD can.
    if (scheduleDLinesFifteenAndSixteenAreBothGains
        && (scheduleD18Cents > 0n || scheduleD19Cents > 0n)) {
        // Only the lines that are actually non-zero are named, so the
        // refusal says what THIS return has rather than what the branch
        // is about in general. Both annotations are contextual types on
        // an empty-or-singleton literal, not casts.
        /** @type {readonly UnmodeledKind[]} */
        const collectiblesKind = scheduleD18Cents > 0n ? ['collectibles28RateGain'] : []
        /** @type {readonly UnmodeledKind[]} */
        const unrecapturedKind = scheduleD19Cents > 0n ? ['unrecaptured1250Gain'] : []
        const kinds = [...collectiblesKind, ...unrecapturedKind]
        const { message, unmodeled } = scopeRefusal(kinds)
        return { kind: 'error', method: 'scheduleDTaxWorksheet', message, unmodeled }
    }
    // 2b. "You have to file Form 4952 and you have an amount on line 4g,
    //     even if you don't need to file Schedule D."
    //
    //     [FINDING, 10-RESEARCH.md] The form face and the instructions
    //     DISAGREE. Schedule D line 20 asks "Are lines 18 and 19 both
    //     zero or blank AND YOU ARE NOT FILING FORM 4952?", which would
    //     route a Form 4952 filer with line 4g = 0 into the Schedule D
    //     Tax Worksheet. The line-16 instructions and the Schedule D Tax
    //     Worksheet's own header both state the stricter form, `4952
    //     filed AND 4g > 0`, and the header governs because it is the
    //     worksheet you would be entering. The stricter form is what is
    //     implemented; the discrepancy is recorded here because it
    //     matters for Phase 12, when that worksheet actually computes.
    if (filingForm4952 && form4952Line4gCents > 0n) {
        const { message, unmodeled } = scopeRefusal(['investmentInterestForm4952'])
        return { kind: 'error', method: 'scheduleDTaxWorksheet', message, unmodeled }
    }
    // 2c. "You reported qualified dividends on Form 1040 or 1040-SR,
    //     line 3a."
    if (qualifiedDividendsCents > 0n) {
        return qdcgtOutcome()
    }
    // 2d. "You don't have to file Schedule D and you reported capital
    //     gain distributions on Form 1040 or 1040-SR, line 7a."
    if (!filingScheduleD && capitalGainDistributionsCents > 0n) {
        return qdcgtOutcome()
    }
    // 2e. "You are filing Schedule D, and Schedule D, lines 15 and 16,
    //     are both more than zero."
    if (scheduleDLinesFifteenAndSixteenAreBothGains) {
        return qdcgtOutcome()
    }
    // ── LEVEL 3 — THE BASE LOOKUP ────────────────────────────────────────
    //
    // "If your taxable income is less than $100,000, you must use the Tax
    // Table... If your taxable income is $100,000 or more, use the Tax
    // Computation Worksheet." Decided in ONE place — `fjs/tax/table`'s
    // `baseTaxForAmount` — which the QDCGT's lines 22 and 24 also call
    // back down into, so the $100,000 seam exists exactly once.
    const base = baseTaxForAmount(taxParamSet)(status)(taxableIncomeCents)
    return { kind: 'ok', method: base.method, cents: base.cents }
}

/**
 * TY2025's parameter set, narrowed exactly ONCE at module scope, exactly
 * how `fjs/tax/table` and `fjs/tax/line16/qdcgt` do it:
 * `noUncheckedIndexedAccess` makes the year lookup `TaxParamSet |
 * undefined` even at a literal key, and a cast or a non-null assertion is
 * banned (AGENTS.md), so `assert` — which throws a bare string, never an
 * `Error` — is the only compliant narrowing.
 */
const taxParams2025 = taxParamsByYear[2025]
assert(taxParams2025 !== undefined, 'expected TY2025 parameters to be present in taxParamsByYear')

// ── Tests ────────────────────────────────────────────────────────────────────

/**
 * A return with NOTHING switched on: no preferential income, no Schedule
 * D, no wrapper form. Every leaf below spreads this and overrides only
 * the fields it is actually exercising, so what a leaf is testing is
 * visible at the leaf rather than buried in a fourteen-field literal.
 *
 * `taxableIncomeCents` is deliberately left at a value NO leaf relies on
 * (`0n` would silently satisfy level 1a), so a leaf that forgets to set
 * it fails loudly rather than passing for the wrong reason.
 * @type {Line16Inputs}
 */
const nothingSwitchedOn = {
    status: 'marriedFilingJointly',
    taxableIncomeCents: 1n,
    qualifiedDividendsCents: 0n,
    capitalGainDistributionsCents: 0n,
    filingScheduleD: false,
    scheduleD15Cents: 0n,
    scheduleD16Cents: 0n,
    scheduleD18Cents: 0n,
    scheduleD19Cents: 0n,
    filingForm4952: false,
    form4952Line4gCents: 0n,
    filingForm2555: false,
    form8615Applies: false,
    scheduleJElected: false,
}

export const proof = {
    branches: {
        // The IRS's OWN printed Tax Table Example (i1040gi p68: "Mr. and
        // Mrs. Brown are filing a joint return. Their taxable income is
        // $25,300"), hand-typed from the page. Level 3, the default the
        // instruction page states before any override.
        //
        // The method is asserted as well as the cents, because $2,562.00
        // is also what a QDCGT execution over a return with no
        // preferential income would produce — the two engines agree here
        // and the tag is the only thing that says which one ran.
        ordinaryReturnSelectsTheTaxTable: () => {
            const outcome = dispatchLine16(taxParams2025)({
                ...nothingSwitchedOn,
                taxableIncomeCents: 2530000n,
            })
            assertEq(outcome.kind, 'ok', ['an ordinary return computes', outcome])
            assertEq(outcome.method, 'taxTable', ['expected the printed default method', outcome])
            assert(outcome.kind === 'ok', ['expected a computed outcome', outcome])
            assertEq(outcome.cents, 256200n, 'the printed Tax Table Example\'s own answer, $2,562.00')
        },
        // The $100,000 seam, pinned on BOTH sides and in BOTH dimensions
        // through the dispatcher rather than through `baseTaxForAmount`
        // directly — so a dispatcher that decided the base method itself,
        // instead of delegating, is caught here.
        //
        // $16,909 is the single column of the Tax Table's last printed
        // row ($99,950-$100,000, i1040gi p79) and $16,914 is Section A's
        // first Tax Computation Worksheet row (p80, 22% x 100,000.00 -
        // 5,086.00). Both hand-typed.
        theOneHundredThousandSeamSelectsTheTaxComputationWorksheet: () => {
            const below = dispatchLine16(taxParams2025)({
                ...nothingSwitchedOn,
                status: 'single',
                taxableIncomeCents: 9999999n,
            })
            assertEq(below.method, 'taxTable', ['one cent below the bound is a table lookup', below])
            assert(below.kind === 'ok', ['expected a computed outcome', below])
            assertEq(below.cents, 1690900n, 'the printed table\'s last single-column row, $16,909.00')
            const atTheBound = dispatchLine16(taxParams2025)({
                ...nothingSwitchedOn,
                status: 'single',
                taxableIncomeCents: 10000000n,
            })
            assertEq(
                atTheBound.method,
                'taxComputationWorksheet',
                ['exactly at the bound the worksheet takes over', atTheBound],
            )
            assert(atTheBound.kind === 'ok', ['expected a computed outcome', atTheBound])
            assertEq(atTheBound.cents, 1691400n, 'Section A\'s first printed worksheet row, $16,914.00')
        },
        // ROADMAP criterion 2's case A, reached THROUGH the dispatcher:
        // MFJ, line 15 = $97,000.00, line 3a = $300.00, no Schedule D.
        // Level 2c selects the QDCGT and line 25 is $11,174.00.
        //
        // Hand-typed from 10-CONTEXT.md's independently-reproduced table
        // (research, planner and executor each recomputed it from
        // i1040gi p38 and the stored brackets, and all three agree). The
        // worksheet's own 25 lines are pinned in `fjs/tax/line16/qdcgt`;
        // what this leaf adds is that the DISPATCHER reaches it.
        qualifiedDividendsSelectQdcgtOnRegressionCaseA: () => {
            const outcome = dispatchLine16(taxParams2025)({
                ...nothingSwitchedOn,
                taxableIncomeCents: 9700000n,
                qualifiedDividendsCents: 30000n,
            })
            assertEq(outcome.kind, 'ok', ['case A computes', outcome])
            assertEq(outcome.method, 'qdcgt', ['line 3a must select the QDCGT worksheet', outcome])
            assert(outcome.kind === 'ok', ['expected a computed outcome', outcome])
            assertEq(outcome.cents, 1117400n, 'Form 1040 line 16 = $11,174.00')
        },
        // Criterion 2's case B, the partner one dollar away: MFJ, line 15
        // = $96,999.00, line 3a = $299.00. $11,163.00, hand-typed from
        // the same reproduced table. The PAIR is what pins line 25's
        // `min` — a min-less engine returns essentially the same number
        // for both returns — and the pair's own 50 line assertions live
        // in `fjs/tax/line16/qdcgt`.
        qualifiedDividendsSelectQdcgtOnRegressionCaseB: () => {
            const outcome = dispatchLine16(taxParams2025)({
                ...nothingSwitchedOn,
                taxableIncomeCents: 9699900n,
                qualifiedDividendsCents: 29900n,
            })
            assertEq(outcome.kind, 'ok', ['case B computes', outcome])
            assertEq(outcome.method, 'qdcgt', ['line 3a must select the QDCGT worksheet', outcome])
            assert(outcome.kind === 'ok', ['expected a computed outcome', outcome])
            assertEq(outcome.cents, 1116300n, 'Form 1040 line 16 = $11,163.00')
        },
        // Level 2a with Schedule D line 19 non-zero. Line 3a is
        // deliberately $300.00: that is what makes this leaf
        // DISCRIMINATING, because level 2c only competes when there are
        // qualified dividends to route. With line 3a at zero the two
        // orderings agree and this leaf could not see a swap.
        //
        // Content, not merely refusal (AGENTS.md, and Phase 9's sweep,
        // which found several assertions checking THAT a refusal happened
        // rather than what it said): the `unmodeled` array is asserted
        // element by element and the message's line, label and remedy are
        // three separate `includes` calls so a failure names which part
        // went missing.
        scheduleDLineNineteenRefusesNamingUnrecapturedSection1250Gain: () => {
            const outcome = dispatchLine16(taxParams2025)({
                ...nothingSwitchedOn,
                taxableIncomeCents: 9700000n,
                qualifiedDividendsCents: 30000n,
                filingScheduleD: true,
                scheduleD15Cents: 4000000n,
                scheduleD16Cents: 4000000n,
                scheduleD19Cents: 1000000n,
            })
            assertEq(outcome.method, 'scheduleDTaxWorksheet', ['expected the Schedule D branch', outcome])
            assert(outcome.kind === 'error', ['the Schedule D branch refuses (Decision 1)', outcome])
            assertEq(outcome.unmodeled.length, 1, ['expected exactly one unmodeled kind', outcome.unmodeled])
            assertEq(outcome.unmodeled[0], 'unrecaptured1250Gain', ['expected line 19\'s kind', outcome.unmodeled])
            assert(
                outcome.message.includes('unrecaptured section 1250 gain'),
                ['expected the refusal to name unrecaptured section 1250 gain', outcome.message],
            )
            assert(
                outcome.message.includes('Schedule D line 19'),
                ['expected the refusal to name the Schedule D line', outcome.message],
            )
            assert(
                outcome.message.includes('Schedule D Tax Worksheet'),
                ['expected the refusal to name the remedy', outcome.message],
            )
        },
        // Level 2a's other trigger, Schedule D line 18, and then both at
        // once. Line 3a is again $300.00, for the same reason.
        //
        // With both non-zero the two kinds are named in 1040 form order —
        // unrecaptured §1250 gain (Schedule D line 19) before 28% rate
        // gain (Schedule D line 18) — because `scopeRefusal` WALKS its
        // own table rather than sorting its argument, so two returns
        // declaring the same pair produce byte-identical messages.
        scheduleDLineEighteenRefusesNamingTwentyEightPercentRateGain: () => {
            const collectiblesOnly = dispatchLine16(taxParams2025)({
                ...nothingSwitchedOn,
                taxableIncomeCents: 9700000n,
                qualifiedDividendsCents: 30000n,
                filingScheduleD: true,
                scheduleD15Cents: 4000000n,
                scheduleD16Cents: 4000000n,
                scheduleD18Cents: 500000n,
            })
            assertEq(collectiblesOnly.method, 'scheduleDTaxWorksheet', ['expected the Schedule D branch', collectiblesOnly])
            assert(collectiblesOnly.kind === 'error', ['the Schedule D branch refuses', collectiblesOnly])
            assertEq(collectiblesOnly.unmodeled.length, 1, ['expected exactly one unmodeled kind', collectiblesOnly.unmodeled])
            assertEq(collectiblesOnly.unmodeled[0], 'collectibles28RateGain', ['expected line 18\'s kind', collectiblesOnly.unmodeled])
            assert(
                collectiblesOnly.message.includes('28% rate gain'),
                ['expected the refusal to name 28% rate gain', collectiblesOnly.message],
            )
            assert(
                collectiblesOnly.message.includes('Schedule D line 18'),
                ['expected the refusal to name the Schedule D line', collectiblesOnly.message],
            )
            const both = dispatchLine16(taxParams2025)({
                ...nothingSwitchedOn,
                taxableIncomeCents: 9700000n,
                qualifiedDividendsCents: 30000n,
                filingScheduleD: true,
                scheduleD15Cents: 4000000n,
                scheduleD16Cents: 4000000n,
                scheduleD18Cents: 500000n,
                scheduleD19Cents: 1000000n,
            })
            assertEq(both.method, 'scheduleDTaxWorksheet', ['expected the Schedule D branch', both])
            assert(both.kind === 'error', ['the Schedule D branch refuses', both])
            assertEq(both.unmodeled.length, 2, ['expected BOTH unmodeled kinds named', both.unmodeled])
            assertEq(both.unmodeled[0], 'unrecaptured1250Gain', ['expected 1040 form order, line 19 first', both.unmodeled])
            assertEq(both.unmodeled[1], 'collectibles28RateGain', ['expected 1040 form order, line 18 second', both.unmodeled])
            assert(
                both.message.includes('unrecaptured section 1250 gain'),
                ['expected the refusal to name unrecaptured section 1250 gain', both.message],
            )
            assert(
                both.message.includes('28% rate gain'),
                ['expected the refusal to name 28% rate gain', both.message],
            )
        },
        // The SAME Schedule D conditions with line 3a = $0. The branch is
        // reachable without qualified dividends too, and this leaf is
        // kept deliberately even though it CANNOT see a swapped 2a/2c
        // order — level 2c never fires without qualified dividends, so
        // the reordering is invisible here.
        //
        // That blindness is the point. This is the shape of every
        // ordinary test case somebody would have written, and it is the
        // documented GREEN half of the ordering mutation: a suite made of
        // leaves like this one would have shipped a swapped order fully
        // green. See `scheduleDConditionsOutrankQualifiedDividends` for
        // the leaf that does see it.
        scheduleDBranchIsReachableWithoutQualifiedDividends: () => {
            const outcome = dispatchLine16(taxParams2025)({
                ...nothingSwitchedOn,
                taxableIncomeCents: 9700000n,
                filingScheduleD: true,
                scheduleD15Cents: 4000000n,
                scheduleD16Cents: 4000000n,
                scheduleD19Cents: 1000000n,
            })
            assertEq(outcome.method, 'scheduleDTaxWorksheet', ['expected the Schedule D branch', outcome])
            assert(outcome.kind === 'error', ['the Schedule D branch refuses', outcome])
            assertEq(outcome.unmodeled.length, 1, ['expected exactly one unmodeled kind', outcome.unmodeled])
            assertEq(outcome.unmodeled[0], 'unrecaptured1250Gain', ['expected line 19\'s kind', outcome.unmodeled])
        },
        // Level 2b: Form 4952 with an amount on line 4g reaches the
        // Schedule D Tax Worksheet EVEN WITHOUT Schedule D, which is the
        // half of that branch a Schedule-D-shaped test would miss
        // entirely.
        formFourNineFiveTwoWithLineFourGRefusesNamingTheElection: () => {
            const outcome = dispatchLine16(taxParams2025)({
                ...nothingSwitchedOn,
                taxableIncomeCents: 9700000n,
                qualifiedDividendsCents: 30000n,
                filingForm4952: true,
                form4952Line4gCents: 250000n,
            })
            assertEq(outcome.method, 'scheduleDTaxWorksheet', ['Form 4952 line 4g selects the Schedule D branch', outcome])
            assert(outcome.kind === 'error', ['that branch refuses', outcome])
            assertEq(outcome.unmodeled.length, 1, ['expected exactly one unmodeled kind', outcome.unmodeled])
            assertEq(outcome.unmodeled[0], 'investmentInterestForm4952', ['expected the Form 4952 kind', outcome.unmodeled])
            assert(
                outcome.message.includes('investment interest expense election'),
                ['expected the refusal to name the investment interest election', outcome.message],
            )
            assert(
                outcome.message.includes('Form 4952 line 4g'),
                ['expected the refusal to name Form 4952 line 4g', outcome.message],
            )
        },
        // THE CONTROL for the leaf above, and the leaf that pins the
        // [FINDING] at level 2b: the instructions' STRICTER condition is
        // what ships. A Form 4952 filer with line 4g = 0 is NOT sent to
        // the Schedule D Tax Worksheet — Schedule D line 20's looser
        // form-face wording ("and you are not filing Form 4952") would
        // send them there and refuse a return that must compute.
        //
        // $11,174.00 is case A's own hand-typed answer, which is what
        // makes this a control rather than merely a non-refusal: the
        // return computes, and it computes the SAME number it would
        // without Form 4952 in the picture at all.
        controlFormFourNineFiveTwoWithZeroLineFourGStillSelectsQdcgt: () => {
            const outcome = dispatchLine16(taxParams2025)({
                ...nothingSwitchedOn,
                taxableIncomeCents: 9700000n,
                qualifiedDividendsCents: 30000n,
                filingForm4952: true,
                form4952Line4gCents: 0n,
            })
            assertEq(outcome.kind, 'ok', ['Form 4952 without a line 4g amount must not refuse', outcome])
            assertEq(outcome.method, 'qdcgt', ['expected the QDCGT worksheet', outcome])
            assert(outcome.kind === 'ok', ['expected a computed outcome', outcome])
            assertEq(outcome.cents, 1117400n, 'the same $11,174.00 as without Form 4952')
        },
        // Level 0a outranks level 2c: a Form 2555 filer WITH qualified
        // dividends is a Foreign Earned Income Tax Worksheet return, not
        // a QDCGT return. Line 3a is non-zero deliberately — with it at
        // zero this leaf could not tell a wrapper from a fall-through.
        formTwentyFiveFiftyFiveOutranksQdcgt: () => {
            const outcome = dispatchLine16(taxParams2025)({
                ...nothingSwitchedOn,
                taxableIncomeCents: 9700000n,
                qualifiedDividendsCents: 30000n,
                filingForm2555: true,
            })
            assertEq(
                outcome.method,
                'foreignEarnedIncomeTaxWorksheet',
                ['Form 2555 outranks both preferential worksheets', outcome],
            )
            assert(outcome.kind === 'error', ['the wrapper refuses', outcome])
            assertEq(outcome.unmodeled.length, 1, ['expected exactly one unmodeled kind', outcome.unmodeled])
            assertEq(outcome.unmodeled[0], 'foreignEarnedIncomeForm2555', ['expected the Form 2555 kind', outcome.unmodeled])
            assert(
                outcome.message.includes('foreign earned income exclusion'),
                ['expected the refusal to name the exclusion', outcome.message],
            )
        },
        // The other two wrappers, each with qualified dividends present
        // for the same reason: both must outrank level 2c.
        formEightSixFifteenAndScheduleJAreSelectedAsWrappers: () => {
            const childsIncome = dispatchLine16(taxParams2025)({
                ...nothingSwitchedOn,
                taxableIncomeCents: 9700000n,
                qualifiedDividendsCents: 30000n,
                form8615Applies: true,
            })
            assertEq(childsIncome.method, 'form8615', ['Form 8615 outranks the preferential worksheets', childsIncome])
            assert(childsIncome.kind === 'error', ['the wrapper refuses', childsIncome])
            assertEq(childsIncome.unmodeled[0], 'childsUnearnedIncomeForm8615', ['expected the Form 8615 kind', childsIncome.unmodeled])
            assert(
                childsIncome.message.includes('a child\'s unearned income'),
                ['expected the refusal to name the child\'s unearned income', childsIncome.message],
            )
            const incomeAveraging = dispatchLine16(taxParams2025)({
                ...nothingSwitchedOn,
                taxableIncomeCents: 9700000n,
                qualifiedDividendsCents: 30000n,
                scheduleJElected: true,
            })
            assertEq(incomeAveraging.method, 'scheduleJ', ['Schedule J outranks the preferential worksheets', incomeAveraging])
            assert(incomeAveraging.kind === 'error', ['the wrapper refuses', incomeAveraging])
            assertEq(incomeAveraging.unmodeled[0], 'farmIncomeAveragingScheduleJ', ['expected the Schedule J kind', incomeAveraging.unmodeled])
            assert(
                incomeAveraging.message.includes('farm and fishing income averaging'),
                ['expected the refusal to name income averaging', incomeAveraging.message],
            )
        },
        // Level 1a. Taxable income of zero is $0 of tax and NEITHER
        // worksheet runs, even with $5,000.00 of qualified dividends
        // sitting on line 3a. Without the gate this return falls into
        // level 2c and the QDCGT computes $0 by a different route — the
        // same cents by the wrong method, which is why the METHOD is the
        // load-bearing assertion in this leaf and the cents are not.
        zeroTaxableIncomeSelectsTheTaxTableAtZeroWithoutRunningAWorksheet: () => {
            const outcome = dispatchLine16(taxParams2025)({
                ...nothingSwitchedOn,
                status: 'single',
                taxableIncomeCents: 0n,
                qualifiedDividendsCents: 500000n,
            })
            assertEq(outcome.kind, 'ok', ['zero taxable income computes', outcome])
            assertEq(
                outcome.method,
                'taxTable',
                ['zero taxable income must not reach a preferential worksheet', outcome],
            )
            assert(outcome.kind === 'ok', ['expected a computed outcome', outcome])
            assertEq(outcome.cents, 0n, 'no taxable income, no tax')
        },
    },
}
