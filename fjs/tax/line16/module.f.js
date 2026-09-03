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
 * to lose. Through Phase 12, 10-CONTEXT.md Decision 1 shipped the Schedule
 * D Tax Worksheet branch as a TAX-16 REFUSAL rather than a computation, so
 * that branch returned no cents at all. **As of Plan 12.1-04
 * (12.1-CONTEXT.md Decision 1.1), branch 2a COMPUTES**, via
 * `fjs/tax/line16/sdtw`; branch 2b (Form 4952) still refuses, and it is now
 * the live evidence that the guard still works — a branch that can only
 * succeed would no longer be evidence of anything. Without a method tag on
 * BOTH arms there would be nothing to assert about which branch was
 * selected, and TAX-03's "a proof per branch" would be unprovable for the
 * one branch that still refuses.
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
 * the proof that catches a swap asserts the **selected method** — and, as
 * of Plan 12.1-04, a real VALUE too — on an input with a NON-ZERO Schedule
 * D line 19 — see `scheduleDConditionsOutrankQualifiedDividends` and its
 * control.
 *
 * ## The three level-0 entries are WRAPPERS, not a fifth peer branch
 *
 * The Foreign Earned Income Tax Worksheet (i1040gi p37) does not replace
 * the dispatch; it RE-ENTERS it. Its own line 4 reads: "Figure the tax on
 * the amount on line 3. Use the Tax Table, Tax Computation Worksheet,
 * Qualified Dividends and Capital Gain Tax Worksheet, Schedule D Tax
 * Worksheet, or Form 8615, whichever applies." Form 8615 re-enters the
 * same way, and Schedule J is an election over a re-entered base. So they
 * are modelled here as the OUTERMOST level.
 *
 * **As of TAX-42, level 0a COMPUTES.** That sentence about re-entering the
 * dispatch stood in this docstring for four phases while the branch below it
 * refused; it is now what the code does. {@link levelsOneThroughThree} is a
 * private function that takes the taxable income to price, and BOTH the
 * ordinary path and the worksheet's line 4 call it — one body, so the
 * worksheet cannot drift from the dispatch it is supposed to re-enter.
 *
 * ## §911(f), and why an approximation here is the dangerous kind
 *
 * The whole content of the worksheet is that excluded income still pushes
 * the remaining income into higher brackets. §911(f)(1) states it as the
 * excess of the tax on (taxable income PLUS the excluded amount) over the
 * tax on (the excluded amount alone), and i2555 p3 makes it mandatory:
 * *"you must figure the tax on your nonexcluded income using the tax rates
 * that would have applied had you not claimed the exclusions."*
 *
 * The lazy implementation — price the remaining income and stop — is always
 * SMALLER than the printed answer under a progressive schedule, so it
 * under-taxes silently and in the taxpayer's favour. That is why the fixture
 * behind `theStackingRuleChangesTheBracket` is one where the difference is a
 * whole bracket rather than a rounding.
 *
 * **Lines 4 and 5 name DIFFERENT method sets, and the asymmetry is the
 * worksheet.** Line 4 lists every method including both preferential
 * worksheets and Form 8615; line 5 says *"If the amount on line 2c is less
 * than $100,000, use the Tax Table … $100,000 or more, use the Tax
 * Computation Worksheet"* and names no preferential worksheet at all. So
 * line 5 is `fjs/tax/table`'s {@link baseTaxForAmount} and nothing else.
 *
 * ## The one corner level 0a refuses: a capital gain excess
 *
 * The worksheet's footnote sends a filer whose QDCGT line 4 (or Schedule D
 * Tax Worksheet line 10) exceeds 1040 line 15 to a SECOND, modified copy of
 * that worksheet, with four modifications reaching as far as the Unrecaptured
 * Section 1250 Gain Worksheet. Those four are untranscribed, and running the
 * unmodified worksheet would price the preferential slice at the wrong band,
 * so `foreignEarnedIncomeCapitalGainExcess` refuses. Every other Form 2555
 * return — including one whose line 3 selects the QDCGT with no excess —
 * computes.
 *
 * Level 0b and 0c still refuse outright: this module knows which method was
 * selected, and knows it cannot compute those wrappers, which is precisely a
 * TAX-16 scope refusal rather than a silently ordinary number.
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
import { assert, assertEq } from 'functionalscript/fjs/asserts/module.f.mjs'
import { baseTaxForAmount } from '../table/module.f.js'
import { taxParamsByYear } from '../params/module.f.js'
import { qdcgt } from './qdcgt/module.f.js'
import { sdtw } from './sdtw/module.f.js'
import { scopeRefusal } from '../../return/scope/module.f.js'

/** @import { TaxParamSet, IndividualFilingStatus } from '../params/module.f.js' */
/** @import { ScopeError, UnmodeledKind } from '../../return/scope/module.f.js' */
/** @import { Qdcgt } from './qdcgt/module.f.js' */
/** @import { Sdtw } from './sdtw/module.f.js' */

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

/**
 * Which preferential worksheet actually ran, carrying the filled-in worksheet
 * with it — or `'none'` when neither did.
 *
 * It rides on the `ok` arm because **Form 6251 Part III reads the regular tax's
 * own worksheet** (TAX-33): its lines 13, 15, 20 and 27 each read a line off the
 * QDCGT or the Schedule D Tax Worksheet, and lines 20 and 27 say *"as figured for
 * the regular tax"* in so many words. The alternative was a second
 * `qdcgt(...)`/`sdtw(...)` execution at the AMT's own call site, from a second
 * hand-built input — which is AGENTS.md's "one rule, one place" inverted, and the
 * exact shape `fjs/form1040/core` already refuses for Schedule SE: *"its line 13
 * has ALREADY reduced `income.line11b`, so a second execution here would be
 * pricing a return the first one changed."*
 *
 * `'none'` is not merely the empty case. It is REACHABLE — level 1's *"taxable
 * income is zero or less"* gate returns before level 2 selects a worksheet — and
 * `fjs/form6251` refuses by name on it rather than substituting a zero.
 * @typedef {{ readonly kind: 'qdcgt', readonly worksheet: Qdcgt }
 *   | { readonly kind: 'scheduleDTaxWorksheet', readonly worksheet: Sdtw }
 *   | { readonly kind: 'none' }} Line16Preferential
 */

/** A computed line 16: the cents, which method produced them, and the
 * preferential worksheet that ran (if any).
 * @typedef {{
 *   readonly kind: 'ok',
 *   readonly method: Line16Method,
 *   readonly cents: bigint,
 *   readonly preferential: Line16Preferential,
 * }} Line16Ok
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
 * `scheduleD18Cents` and `scheduleD19Cents` earn their place because they
 * are the ONLY inputs on which the Schedule D Tax Worksheet and the QDCGT
 * disagree, so a dispatcher that did not read them could not tell the two
 * branches apart at all. As of Plan 12.1-04, branch 2a COMPUTES via
 * `fjs/tax/line16/sdtw` rather than refusing; `form4952Line4eCents` is
 * threaded to it (SDTW line 4) even though `dispatchLine16` itself never
 * reads it.
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
 *   readonly form4952Line4eCents: bigint,
 *   readonly filingForm2555: boolean,
 *   readonly form2555Line45Cents: bigint,
 *   readonly form2555Line50Cents: bigint,
 *   readonly form2555ItemizedDeductionsAndExclusionsNotClaimedCents: bigint,
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
        filingForm4952, form4952Line4gCents, form4952Line4eCents, filingForm2555,
        form2555Line45Cents, form2555Line50Cents,
        form2555ItemizedDeductionsAndExclusionsNotClaimedCents,
        form8615Applies, scheduleJElected,
    } = inputs
    // Levels 1 through 3, as ONE body taking the taxable income to price.
    //
    // It is a function of that amount because the Foreign Earned Income Tax
    // Worksheet's line 4 prices a DIFFERENT amount from 1040 line 15 — its own
    // line 3 — through the very same decision tree ("Use the Tax Table, Tax
    // Computation Worksheet, Qualified Dividends and Capital Gain Tax
    // Worksheet, Schedule D Tax Worksheet … whichever applies"). Two copies of
    // this tree would be two copies of the ordering that this module's own
    // docstring says no ordinary test case can tell apart, which is exactly
    // the "one rule, one place" failure AGENTS.md records.
    //
    // Every OTHER input is closed over rather than passed: the preferential
    // conditions (qualified dividends, capital gain distributions, the four
    // Schedule D lines, Form 4952) are facts about the return and do not
    // change between the two calls. Only the amount does.
    /** @type {(taxableIncomeForTheseLevelsCents: bigint) => Line16Outcome} */
    const levelsOneThroughThree = taxableIncomeForTheseLevelsCents => {
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
        //
        // The worksheet is bound to a local and RETURNED alongside its line 25,
        // rather than dereferenced inline: Form 6251 Part III reads four of its
        // lines, and computing it twice is how two executions come to disagree.
        /** @type {() => Line16Outcome} */
        const qdcgtOutcome = () => {
            const worksheet = qdcgt(taxParamSet)({
                status,
                line1Cents: taxableIncomeForTheseLevelsCents,
                line2Cents: qualifiedDividendsCents,
                filingScheduleD,
                scheduleD15Cents,
                scheduleD16Cents,
                line7aCents: capitalGainDistributionsCents,
            })
            return {
                kind: 'ok',
                method: 'qdcgt',
                cents: worksheet.line25,
                preferential: { kind: 'qdcgt', worksheet },
            }
        }
        // The Schedule D Tax Worksheet arm, mirroring `qdcgtOutcome`'s own
        // shape — a function, called only on the arm that selects it (branch
        // 2a's guard, below, stays byte-identical; only its BODY changes, from
        // a refusal to this computation, in this one Plan 12.1-04 commit).
        /** @type {() => Line16Outcome} */
        const sdtwOutcome = () => {
            const worksheet = sdtw(taxParamSet)({
                status,
                line1Cents: taxableIncomeForTheseLevelsCents,
                line2Cents: qualifiedDividendsCents,
                form4952Line4gCents,
                form4952Line4eCents,
                scheduleD15Cents,
                scheduleD16Cents,
                scheduleD18Cents,
                scheduleD19Cents,
            })
            return {
                kind: 'ok',
                method: 'scheduleDTaxWorksheet',
                cents: worksheet.line47,
                preferential: { kind: 'scheduleDTaxWorksheet', worksheet },
            }
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
        if (taxableIncomeForTheseLevelsCents <= 0n) {
            return { kind: 'ok', method: 'taxTable', cents: 0n, preferential: { kind: 'none' } }
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
        //
        //     As of Plan 12.1-04 (12.1-CONTEXT.md Decision 1.1), this branch
        //     COMPUTES via `sdtwOutcome()` instead of refusing — the guard
        //     above stays byte-identical; only the body changes.
        if (scheduleDLinesFifteenAndSixteenAreBothGains
            && (scheduleD18Cents > 0n || scheduleD19Cents > 0n)) {
            return sdtwOutcome()
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
        const base = baseTaxForAmount(taxParamSet)(status)(taxableIncomeForTheseLevelsCents)
        return {
            kind: 'ok', method: base.method, cents: base.cents, preferential: { kind: 'none' },
        }
    }

    // ── LEVEL 0 — WRAPPERS, OUTERMOST ────────────────────────────────────
    //
    // "But if you are filing Form 2555, you must use the Foreign Earned
    // Income Tax Worksheet instead." — stated TWICE on p36, once under
    // the Schedule D Tax Worksheet heading and once under the QDCGT
    // heading, which is what makes it outrank BOTH preferential
    // worksheets rather than sitting beside them.
    //
    // 0a. Form 2555 filed — the Foreign Earned Income Tax Worksheet
    //     (i1040gi p37), §911(f). COMPUTES as of TAX-42, and the GUARD is
    //     the one that stood here while the body refused, byte for byte —
    //     branch 2a's own precedent for changing a body and not a
    //     condition.
    if (filingForm2555) {
        // 1. "Enter the amount from Form 1040 or 1040-SR, line 15." Printed
        //    1040 line 15 is itself "if zero or less, enter -0-", so the floor
        //    is the 1040's rather than this worksheet's invention.
        //
        //    The worksheet's CAUTION — "If Form 1040 or 1040-SR, line 15, is
        //    zero, don't complete this worksheet" — is deliberately NOT a
        //    short-circuit here, because the arithmetic below already returns
        //    what skipping it would: at line 1 = 0, line 3 equals line 2c, so
        //    lines 4 and 5 price the same amount and line 6 is zero.
        //    `aForeignFilerWithNoTaxableIncomeOwesNothing` is the leaf that
        //    says so rather than a comment claiming it.
        const worksheetLine1 = taxableIncomeCents > 0n ? taxableIncomeCents : 0n
        // 2a. "Enter the amount from your (and your spouse's if filing
        //     jointly) Form 2555, lines 45 and 50." Line 50 is the housing
        //     DEDUCTION and is structurally zero —
        //     `foreignHousingExclusionOrDeduction` is a refused kind — and it
        //     is NAMED rather than omitted, the discipline `fjs/form7206`
        //     line 12 already follows for this same form.
        const worksheetLine2a = form2555Line45Cents + form2555Line50Cents
        // 2b. "Enter the total amount of any itemized deductions or
        //     exclusions you couldn't claim because they are related to
        //     excluded income."
        const worksheetLine2b = form2555ItemizedDeductionsAndExclusionsNotClaimedCents
        // 2c. "Subtract line 2b from line 2a. If zero or less, enter -0-."
        const worksheetLine2cBeforeFloor = worksheetLine2a - worksheetLine2b
        const worksheetLine2c = worksheetLine2cBeforeFloor > 0n ? worksheetLine2cBeforeFloor : 0n
        // 3. "Add lines 1 and 2c."
        const worksheetLine3 = worksheetLine1 + worksheetLine2c
        // 4. "Figure the tax on the amount on line 3. Use the Tax Table, Tax
        //    Computation Worksheet, Qualified Dividends and Capital Gain Tax
        //    Worksheet, Schedule D Tax Worksheet, or Form 8615, whichever
        //    applies." Which is this dispatch's own levels 1 through 3 on a
        //    DIFFERENT amount — never a second copy of them.
        const lineFourOutcome = levelsOneThroughThree(worksheetLine3)
        if (lineFourOutcome.kind === 'error') {
            // Level 2b's Form 4952 refusal, reached through the worksheet.
            // Re-tagged with THIS method, because the branch a reader needs to
            // know they were in is the wrapper, not the level under it.
            return { ...lineFourOutcome, method: 'foreignEarnedIncomeTaxWorksheet' }
        }
        // The footnote's CAPITAL GAIN EXCESS test, and the one corner this
        // wrapper refuses. "Subtract Form 1040 or 1040-SR, line 15, from line
        // 4 of your Qualified Dividends and Capital Gain Tax Worksheet (line
        // 10 of your Schedule D Tax Worksheet). If the result is more than
        // zero, that amount is your capital gain excess."
        //
        // Read off the worksheet that actually RAN, never recomputed: QDCGT
        // line 4 is qualified dividends plus net capital gain, and the
        // Schedule D Tax Worksheet's line 10 is the same slice under that
        // worksheet's own numbering. `'none'` contributes zero, which can
        // never exceed a floored line 1 — a return that reached no
        // preferential worksheet has no preferential slice to be in excess.
        const preferentialSliceCents = lineFourOutcome.preferential.kind === 'qdcgt'
            ? lineFourOutcome.preferential.worksheet.line4
            : lineFourOutcome.preferential.kind === 'scheduleDTaxWorksheet'
                ? lineFourOutcome.preferential.worksheet.line10
                : 0n
        if (preferentialSliceCents > worksheetLine1) {
            const { message, unmodeled } = scopeRefusal(['foreignEarnedIncomeCapitalGainExcess'])
            return { kind: 'error', method: 'foreignEarnedIncomeTaxWorksheet', message, unmodeled }
        }
        // 5. "Figure the tax on the amount on line 2c. If the amount on line
        //    2c is less than $100,000, use the Tax Table … $100,000 or more,
        //    use the Tax Computation Worksheet." NO preferential worksheet is
        //    named on this line, and that asymmetry with line 4 is the
        //    worksheet's whole content — so this is `baseTaxForAmount` and
        //    nothing else, never a second `levelsOneThroughThree`.
        const worksheetLine5 = baseTaxForAmount(taxParamSet)(status)(worksheetLine2c).cents
        // 6. "Subtract line 5 from line 4. Enter the result. If zero or less,
        //    enter -0-."
        //
        //    **Written as an ASSERTION rather than a floor, and a surviving
        //    mutation is why.** Replacing `> 0n ? … : 0n` with the bare
        //    difference left the entire suite green — the equivalent-mutant
        //    shape AGENTS.md describes, where a neighbouring operation already
        //    enforces what the mutated token enforced. Here the neighbour is
        //    the capital-gain-excess guard six lines up, and the argument is
        //    worth writing down because nobody had:
        //
        //    - line 3 = line 1 + line 2c, so line 3 >= line 2c;
        //    - the guard has just refused every return whose preferential
        //      slice exceeds line 1, so on this path the QDCGT's line 5 (its
        //      ordinary remainder, line 1 less line 4) is at least line 2c,
        //      and the same holds of the Schedule D Tax Worksheet's line 14;
        //    - both preferential worksheets end in a `min` against the
        //      ORDINARY tax on their own line 1, and both of their arms are
        //      monotone in it;
        //    - `baseTaxForAmount` is monotone non-decreasing, band midpoints
        //      included.
        //
        //    So line 4 >= line 5 identically, and the printed "-0-" clause is
        //    unreachable. A floor would then be a silent mask: the one way
        //    line 6 could go negative is a defect above it, and masking that
        //    to zero would understate the tax without a word. `fjs/tax/line16/qdcgt`'s
        //    own no-floor assertion and `fjs/form8812`'s line 16a are the
        //    precedent — `assert` throws a BARE value, never an `Error`.
        const worksheetLine6 = lineFourOutcome.cents - worksheetLine5
        assert(
            worksheetLine6 >= 0n,
            ['the Foreign Earned Income Tax Worksheet\'s line 4 can never be below its line 5',
                lineFourOutcome.cents, worksheetLine5])
        return {
            kind: 'ok',
            method: 'foreignEarnedIncomeTaxWorksheet',
            cents: worksheetLine6,
            // The worksheet that priced line 4, carried out unchanged. Form
            // 6251 Part III reads its lines "as figured for the regular tax",
            // and with Form 2555 in play the regular tax's worksheet IS the
            // one run on line 3 — i6251 p13's own `Form 2555` note under
            // Line 20 says exactly that.
            preferential: lineFourOutcome.preferential,
        }
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
    return levelsOneThroughThree(taxableIncomeCents)
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
    form4952Line4eCents: 0n,
    filingForm2555: false,
    form2555Line45Cents: 0n,
    form2555Line50Cents: 0n,
    form2555ItemizedDeductionsAndExclusionsNotClaimedCents: 0n,
    form8615Applies: false,
    scheduleJElected: false,
}

/**
 * The DISCRIMINATING return, defined once and used by BOTH the ordering
 * leaf and the branch table's `scheduleDTaxWorksheet` row.
 *
 * MFJ, Form 1040 line 15 = $97,000.00, line 3a = $300.00, filing Schedule
 * D with lines 15 and 16 both $40,000.00 gains, line 19 = $10,000.00 and
 * line 18 = $0.
 *
 * Every field is load-bearing and none may be "simplified":
 * - line 3a > 0 is what lets level 2c COMPETE. With it at zero the two
 *   orderings agree and no observation could tell them apart.
 * - Schedule D line 19 > 0 is what makes them DISAGREE. It is the only
 *   kind of input on which the Schedule D Tax Worksheet and the QDCGT
 *   differ at all, because with lines 18 and 19 zero the two worksheets
 *   are algebraically identical.
 *
 * Correct dispatch: `scheduleDTaxWorksheet`, refusing. Under a swapped
 * 2a/2c order: `qdcgt`, computing an `ok` outcome.
 * @type {Line16Inputs}
 */
const scheduleDWithUnrecapturedGainAndQualifiedDividends = {
    ...nothingSwitchedOn,
    taxableIncomeCents: 9700000n,
    qualifiedDividendsCents: 30000n,
    filingScheduleD: true,
    scheduleD15Cents: 4000000n,
    scheduleD16Cents: 4000000n,
    scheduleD19Cents: 1000000n,
}

/** One row of the TAX-03 branch table.
 * @typedef {{
 *   readonly name: string,
 *   readonly inputs: Line16Inputs,
 *   readonly expectedMethod: Line16Method,
 * }} BranchRow
 */

/**
 * Independently hand-typed: the number of branches TAX-03 names — "Tax
 * Table, Tax Computation Worksheet, QDCGT worksheet, Schedule D Tax
 * Worksheet", counted off the requirement text, NOT read from
 * `taxThreeBranches.length` and not derived from {@link Line16Method}
 * (which also carries the three wrappers).
 *
 * This is the counterweight AGENTS.md's fourth signature defect calls
 * for. A table-driven leaf whose iteration set came from the code under
 * test could never notice a branch being removed — the entry would
 * vanish from the loop in the same instant. The duplication is the
 * mechanism, not a smell.
 * @type {number}
 */
const expectedTaxThreeBranchCount = 4

/**
 * One input set per TAX-03 branch, with the method each must select.
 *
 * The `scheduleDTaxWorksheet` row deliberately reuses
 * {@link scheduleDWithUnrecapturedGainAndQualifiedDividends} — the SAME
 * discriminating input as `scheduleDConditionsOutrankQualifiedDividends`
 * — so that a swapped 2a/2c order turns TWO independent leaves red, in
 * two different proofs, rather than resting entirely on one. The ordering
 * leaf is the one a later feedback pass is most likely to "simplify" into
 * a cents or kind check; if it does, this table still fires. A single
 * point of failure guarding the phase's least visible defect is not a
 * place to economise.
 * @type {readonly BranchRow[]}
 */
const taxThreeBranches = [
    {
        name: 'Tax Table',
        inputs: { ...nothingSwitchedOn, taxableIncomeCents: 2530000n },
        expectedMethod: 'taxTable',
    },
    {
        name: 'Tax Computation Worksheet',
        inputs: { ...nothingSwitchedOn, status: 'single', taxableIncomeCents: 10000000n },
        expectedMethod: 'taxComputationWorksheet',
    },
    {
        name: 'Qualified Dividends and Capital Gain Tax Worksheet',
        inputs: { ...nothingSwitchedOn, taxableIncomeCents: 9700000n, qualifiedDividendsCents: 30000n },
        expectedMethod: 'qdcgt',
    },
    {
        name: 'Schedule D Tax Worksheet',
        inputs: scheduleDWithUnrecapturedGainAndQualifiedDividends,
        expectedMethod: 'scheduleDTaxWorksheet',
    },
]

/** One row of the refusing-arm table.
 * @typedef {{
 *   readonly name: string,
 *   readonly inputs: Line16Inputs,
 *   readonly expectedMethod: Line16Method,
 *   readonly expectedUnmodeled: readonly UnmodeledKind[],
 *   readonly expectedLabels: readonly string[],
 * }} RefusingRow
 */

/**
 * Independently hand-typed: the number of arms of this dispatcher that
 * REFUSE — the three level-0 wrappers, and level 2b. Counted off the
 * printed decision tree rather than read from the table below, for the
 * reason on {@link expectedTaxThreeBranchCount}. `5 -> 4` as of Plan
 * 12.1-04: level 2a COMPUTES now, so it is no longer a refusing arm — see
 * `scheduleDConditionsOutrankQualifiedDividends` for its own proof.
 * @type {number}
 */
const expectedRefusingArmCount = 4

/**
 * Every refusing arm, with what its refusal must NAME.
 *
 * `expectedUnmodeled` and `expectedLabels` are hand-typed here rather
 * than read from `fjs/return/scope`'s `unmodeledKindRefusals`. Reading
 * them from that table would make this leaf agree with whatever the table
 * happens to say, including after a label was silently changed — the
 * expected side must not be produced by the code under test, and the
 * refusal table is exactly the code this leaf is checking the dispatcher
 * against.
 * @type {readonly RefusingRow[]}
 */
const refusingArms = [
    {
        // Level 0a COMPUTES as of TAX-42; what still refuses inside it is the
        // footnote's capital gain excess. $30,000 of qualified dividends
        // against $100.00 of taxable income is that condition exactly: the
        // QDCGT's line 4 is the whole $30,000 and 1040 line 15 is $100.00.
        name: 'level 0a — Form 2555, capital gain excess',
        inputs: { ...nothingSwitchedOn, taxableIncomeCents: 10000n, qualifiedDividendsCents: 3000000n, filingForm2555: true, form2555Line45Cents: 13000000n },
        expectedMethod: 'foreignEarnedIncomeTaxWorksheet',
        expectedUnmodeled: ['foreignEarnedIncomeCapitalGainExcess'],
        expectedLabels: ['a capital gain excess inside the Foreign Earned Income Tax Worksheet'],
    },
    {
        name: 'level 0b — Form 8615',
        inputs: { ...nothingSwitchedOn, taxableIncomeCents: 9700000n, qualifiedDividendsCents: 30000n, form8615Applies: true },
        expectedMethod: 'form8615',
        expectedUnmodeled: ['childsUnearnedIncomeForm8615'],
        expectedLabels: ['a child\'s unearned income'],
    },
    {
        name: 'level 0c — Schedule J',
        inputs: { ...nothingSwitchedOn, taxableIncomeCents: 9700000n, qualifiedDividendsCents: 30000n, scheduleJElected: true },
        expectedMethod: 'scheduleJ',
        expectedUnmodeled: ['farmIncomeAveragingScheduleJ'],
        expectedLabels: ['farm and fishing income averaging'],
    },
    {
        name: 'level 2b — Form 4952 line 4g',
        inputs: { ...nothingSwitchedOn, taxableIncomeCents: 9700000n, qualifiedDividendsCents: 30000n, filingForm4952: true, form4952Line4gCents: 250000n },
        expectedMethod: 'scheduleDTaxWorksheet',
        expectedUnmodeled: ['investmentInterestForm4952'],
        expectedLabels: ['investment interest expense election'],
    },
]

export const proof = {
    // ── The preferential worksheet this dispatcher carries out (TAX-33) ──────
    //
    // WHY THIS BLOCK EXISTS. A mutation making the QDCGT arm report
    // `{ kind: 'none' }` reddened exactly ONE leaf in the whole suite, and it
    // was an end-to-end fixture two modules away in `fjs/form1040/core`. That
    // is the shape AGENTS.md warns about — wiring observable only by accident,
    // at a distance — so the field is pinned here, at the module that produces
    // it. With this block the same mutation reddens two leaves, one of them
    // local.
    preferential: {
        // Each arm reports ITSELF, and the worksheet it carries is the ONE that
        // produced `cents`. Asserted as an identity against `cents` rather than
        // against a second literal: that is what makes a second, divergent
        // execution impossible to introduce silently.
        eachArmCarriesTheWorksheetThatProducedTheCents: () => {
            // The QDCGT arm: qualified dividends on 1040 line 3a (bullet 2c).
            const qdcgtArm = dispatchLine16(taxParams2025)({
                ...nothingSwitchedOn,
                taxableIncomeCents: 25425000n,
                qualifiedDividendsCents: 2000000n,
            })
            assert(qdcgtArm.kind === 'ok', ['expected a computed outcome', qdcgtArm])
            assertEq(qdcgtArm.method, 'qdcgt')
            assertEq(qdcgtArm.preferential.kind, 'qdcgt', 'and the worksheet says so too')
            assert(qdcgtArm.preferential.kind === 'qdcgt', 'narrowing')
            assertEq(
                qdcgtArm.preferential.worksheet.line25, qdcgtArm.cents,
                'the carried worksheet IS the one that produced line 16')
            // Hand-typed from the FAANG return's own derivation in
            // `fjs/form1040/core`: line 4 = $20,000.00, line 5 = $234,250.00.
            assertEq(qdcgtArm.preferential.worksheet.line4, 2000000n, 'QDCGT line 4 = $20,000.00')
            assertEq(
                qdcgtArm.preferential.worksheet.line5, 23425000n, 'QDCGT line 5 = $234,250.00')
            // The Schedule D Tax Worksheet arm: bullet 2a, Schedule D line 19
            // non-zero.
            const scheduleDArm = dispatchLine16(taxParams2025)({
                ...nothingSwitchedOn,
                taxableIncomeCents: 60000000n,
                filingScheduleD: true,
                scheduleD15Cents: 20000000n,
                scheduleD16Cents: 20000000n,
                scheduleD18Cents: 3000000n,
                scheduleD19Cents: 5000000n,
            })
            assert(scheduleDArm.kind === 'ok', ['expected a computed outcome', scheduleDArm])
            assertEq(scheduleDArm.method, 'scheduleDTaxWorksheet')
            assertEq(scheduleDArm.preferential.kind, 'scheduleDTaxWorksheet')
            assert(scheduleDArm.preferential.kind === 'scheduleDTaxWorksheet', 'narrowing')
            assertEq(
                scheduleDArm.preferential.worksheet.line47, scheduleDArm.cents,
                'the carried worksheet IS the one that produced line 16')
            // THE FOUR LINES Form 6251 Part III reads, and lines 14 and 21 are
            // DIFFERENT figures on this return -- which is the whole reason both
            // travel. Hand-derived: taxable income $600,000.00 with $200,000.00
            // of net capital gain, of which $50,000.00 is unrecaptured §1250
            // gain and $30,000.00 is 28%-rate gain.
            //   line 10  the whole preferential slice          $200,000.00
            //   line 13  200,000.00 - (30,000.00 + 50,000.00)  $120,000.00
            //   line 14  600,000.00 - 120,000.00               $480,000.00
            //   line 21  the larger of 400,000.00 and the
            //            $197,300.00 breakpoint                $400,000.00
            const { worksheet } = scheduleDArm.preferential
            assertEq(worksheet.line10, 20000000n, 'SDTW line 10 = $200,000.00')
            assertEq(worksheet.line13, 12000000n, 'SDTW line 13 = $120,000.00')
            assertEq(worksheet.line14, 48000000n, 'SDTW line 14 = $480,000.00')
            assertEq(worksheet.line21, 40000000n, 'SDTW line 21 = $400,000.00')
            assert(
                worksheet.line14 !== worksheet.line21,
                ['Part III lines 20 and 27 read these two, and they differ',
                    worksheet.line14, worksheet.line21])
        },
        // `'none'` IS REACHABLE, and by exactly one route: level 1's "taxable
        // income is zero or less" gate, which returns before level 2 selects a
        // worksheet. `fjs/form6251` refuses by name on it, so this leaf is what
        // says that refusal is not dead code.
        //
        // The OTHER half is what a mutation found: a level-1 gate that reported
        // a QDCGT worksheet it never ran passed the whole suite, because nothing
        // asserted the NEGATIVE. So the kind is asserted here on a return whose
        // qualified dividends are non-zero -- the only shape where "no worksheet
        // ran" and "a worksheet could have run" come apart.
        //
        // Paired with its control in the same leaf: an ordinary return above the
        // gate but below every preferential bullet ALSO reports `'none'`, and
        // that one is the common case rather than the corner.
        neitherWorksheetIsReportedAsSuchAndIsReachable: () => {
            const noTaxableIncome = dispatchLine16(taxParams2025)({
                ...nothingSwitchedOn,
                taxableIncomeCents: 0n,
                // Qualified dividends PRESENT, so this is not merely an empty
                // return: the level-1 gate outranks bullet 2c, which is exactly
                // the collision Form 6251 Part III has to refuse.
                qualifiedDividendsCents: 2000000n,
            })
            assert(noTaxableIncome.kind === 'ok', ['expected ok', noTaxableIncome])
            assertEq(noTaxableIncome.cents, 0n, 'no taxable income, no tax')
            assertEq(
                noTaxableIncome.preferential.kind, 'none',
                'the level-1 gate returns before any worksheet is selected')
            // The control: a plain wage return reports `'none'` too, and
            // computes a real tax.
            const ordinary = dispatchLine16(taxParams2025)({
                ...nothingSwitchedOn,
                taxableIncomeCents: 2530000n,
            })
            assert(ordinary.kind === 'ok', ['expected ok', ordinary])
            assertEq(ordinary.preferential.kind, 'none', 'no preferential income, no worksheet')
            assert(ordinary.cents > 0n, ['and a real tax', ordinary.cents])
        },
    },
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
        // Level 2d — "You don't have to file Schedule D and you reported
        // capital gain distributions on Form 1040 or 1040-SR, line 7a." The
        // one level-2 bullet with no leaf of its own until 2026-09-03: every
        // QDCGT fixture above arrives via 2c (qualified dividends) or 2e
        // (Schedule D gains), so `return qdcgtOutcome()` under 2d was
        // unexecuted shipped code while three neighbouring bullets were
        // proven.
        //
        // Line 3a is deliberately ZERO. With it non-zero 2c fires first and
        // this leaf would pass while 2d was deleted — the same shape as the
        // ordering hazard this module's docstring is about, one bullet down.
        //
        // MFJ, line 15 = $50,000.00, line 7a = $3,000.00, no Schedule D.
        // Hand-derived from i1040gi p38 against the stored MFJ brackets and
        // Rev. Proc. 2024-40 §2.03's $96,700.00 zero-rate ceiling:
        //
        //   QDCGT line 3 = line 7a = 3,000.00 (the routing this bullet is for)
        //   line 4 = 3,000.00; line 5 = 50,000.00 - 3,000.00 = 47,000.00
        //   line 7 = min(50,000.00, 96,700.00) = 50,000.00
        //   line 8 = min(47,000.00, 50,000.00) = 47,000.00
        //   line 9 = 3,000.00 — the whole distribution, taxed at 0%
        //   lines 16-21 are all zero, so line 23 = line 22
        //   line 22 prices line 5 by the Tax Table: the $47,000-$47,050 row
        //     is the tax on its $47,025.00 midpoint,
        //     10% x 23,850.00 + 12% x (47,025.00 - 23,850.00) = $5,166.00
        //   line 24 prices line 1 the same way: the $50,000-$50,050 row is
        //     10% x 23,850.00 + 12% x (50,025.00 - 23,850.00) = $5,526.00
        //   line 25 = min(5,166.00, 5,526.00) = $5,166.00
        //
        // $5,166.00 is therefore also what makes this leaf load-bearing
        // rather than a tag check: a dispatcher that dropped bullet 2d
        // would fall through to level 3 and price the whole $50,000.00 by
        // the Tax Table for $5,526.00 — the $360.00 difference is the 0%
        // rate on the distribution, which is exactly the relief this bullet
        // exists to deliver. The control below asserts that figure.
        capitalGainDistributionsWithNoScheduleDAndNoDividendsSelectQdcgt: () => {
            const outcome = dispatchLine16(taxParams2025)({
                ...nothingSwitchedOn,
                taxableIncomeCents: 5000000n,
                capitalGainDistributionsCents: 300000n,
            })
            assertEq(outcome.kind, 'ok', ['bullet 2d computes', outcome])
            assertEq(
                outcome.method, 'qdcgt',
                ['line 7a alone must select the QDCGT worksheet', outcome])
            assert(outcome.kind === 'ok', ['expected a computed outcome', outcome])
            assertEq(outcome.cents, 516600n, 'Form 1040 line 16 = $5,166.00')
            assertEq(outcome.preferential.kind, 'qdcgt', 'and it carries the worksheet it ran')
            assert(outcome.preferential.kind === 'qdcgt', 'narrowing')
            // The routing itself: bullet 2d exists because line 7a, not
            // Schedule D, is where this filer's gain is written, and the
            // worksheet's printed line 3 is where it has to land.
            assertEq(
                outcome.preferential.worksheet.line3, 300000n,
                'QDCGT line 3 reads Form 1040 line 7a = $3,000.00')
            assertEq(
                outcome.preferential.worksheet.line9, 300000n,
                'and the whole $3,000.00 falls in the 0%-taxed slice')
        },
        // The control bullet 2d needs: the SAME return with no capital gain
        // distribution is an ordinary Tax Table return at $5,526.00. Without
        // it, a dispatcher that routed everything to the QDCGT would pass the
        // leaf above (AGENTS.md, "a gate needs a control").
        controlTheSameReturnWithNoCapitalGainDistributionIsATaxTableReturn: () => {
            const outcome = dispatchLine16(taxParams2025)({
                ...nothingSwitchedOn,
                taxableIncomeCents: 5000000n,
            })
            assertEq(outcome.kind, 'ok', ['the control computes', outcome])
            assertEq(outcome.method, 'taxTable', ['no preferential income, no worksheet', outcome])
            assert(outcome.kind === 'ok', ['expected a computed outcome', outcome])
            assertEq(outcome.cents, 552600n, 'the $50,000-$50,050 MFJ Tax Table row = $5,526.00')
            assertEq(outcome.preferential.kind, 'none', 'and no worksheet was run at all')
        },
        // Level 2a with Schedule D line 19 non-zero. Line 3a is
        // deliberately $300.00: that is what makes this leaf
        // DISCRIMINATING, because level 2c only competes when there are
        // qualified dividends to route. With line 3a at zero the two
        // orderings agree and this leaf could not see a swap.
        //
        // As of Plan 12.1-04, branch 2a COMPUTES. This fixture is IDENTICAL
        // in shape to 12.1-RESEARCH.md's Worked Example 1
        // (`scheduleDWithUnrecapturedGainAndQualifiedDividends`), so
        // `757500n` ($7,575.00) is REUSED from that hand-verified figure,
        // never recomputed here.
        scheduleDLineNineteenComputesNamingUnrecapturedSection1250Gain: () => {
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
            assert(outcome.kind === 'ok', ['the Schedule D branch computes as of Plan 12.1-04', outcome])
            assertEq(outcome.cents, 757500n, 'Worked Example 1\'s own answer, $7,575.00')
        },
        // Level 2a's other trigger, Schedule D line 18, and then both at
        // once. Line 3a is again $300.00, for the same reason.
        //
        // NEITHER fixture matches either of 12.1-RESEARCH.md's two worked
        // examples, so both expected `cents` figures were HAND-COMPUTED
        // independently from the printed Schedule D Tax Worksheet
        // (i1040sd.pdf pp.15-16), cross-checked at minimum lines 41-47,
        // before being written down (12.1-CONTEXT.md Decision 3.4) —
        // never derived by calling `sdtw`/`dispatchLine16` and trusting the
        // output.
        //
        // Collectibles-only: line21=$61,700.00, line22=$35,000.00 (the 0%
        // slice), line41=$97,000.00 so line42=$0.00 (28% add-on is $0.00);
        // line44 = tax on $61,700.00 (MFJ Tax Table, 10%x$23,850.00 +
        // 12%x$37,875.00 = $2,385.00+$4,545.00=$6,930.00); line45 =
        // $45.00 (line31, 15% of the $300.00 slice) + $6,930.00 =
        // $6,975.00; line46 = tax on $97,000.00 = $11,174.00 (the same
        // figure Example 1's own control leaf already hand-verifies);
        // line47 = min($6,975.00, $11,174.00) = $6,975.00.
        scheduleDLineEighteenComputesNamingTwentyEightPercentRateGain: () => {
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
            assert(collectiblesOnly.kind === 'ok', ['the Schedule D branch computes as of Plan 12.1-04', collectiblesOnly])
            assertEq(collectiblesOnly.cents, 697500n, 'hand-computed: $6,975.00')
            // Both lines 18 AND 19 non-zero: line21=$71,700.00,
            // line22=$25,000.00; line44 = tax on $71,700.00 (10%x$23,850.00
            // + 12%x$47,875.00 = $2,385.00+$5,745.00=$8,130.00); line45 =
            // $45.00 + $8,130.00 = $8,175.00; line47 = min($8,175.00,
            // $11,174.00) = $8,175.00.
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
            assert(both.kind === 'ok', ['the Schedule D branch computes as of Plan 12.1-04', both])
            assertEq(both.cents, 817500n, 'hand-computed: $8,175.00')
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
        //
        // Hand-computed (no qualified dividends, so line2=$0.00
        // throughout): line21=$67,000.00; line44 = tax on $67,000.00
        // (10%x$23,850.00 + 12%x$43,175.00 = $2,385.00+$5,181.00=
        // $7,566.00). line31 is still $45.00 (15% of line30=$300.00) even
        // with no dividends — a Schedule D artifact of the worksheet's own
        // algebra (line25/line29 both land on $300.00 through Schedule D's
        // own terms alone), not a dividend term. line45 = $45.00 +
        // $7,566.00 = $7,611.00; line47 = min($7,611.00, $11,174.00) =
        // $7,611.00.
        scheduleDBranchComputesReachableWithoutQualifiedDividends: () => {
            const outcome = dispatchLine16(taxParams2025)({
                ...nothingSwitchedOn,
                taxableIncomeCents: 9700000n,
                filingScheduleD: true,
                scheduleD15Cents: 4000000n,
                scheduleD16Cents: 4000000n,
                scheduleD19Cents: 1000000n,
            })
            assertEq(outcome.method, 'scheduleDTaxWorksheet', ['expected the Schedule D branch', outcome])
            assert(outcome.kind === 'ok', ['the Schedule D branch computes as of Plan 12.1-04', outcome])
            assertEq(outcome.cents, 761100n, 'hand-computed: $7,611.00')
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
        // ── Level 0a: the Foreign Earned Income Tax Worksheet (TAX-42) ──────
        //
        // Level 0a outranks level 2c: a Form 2555 filer WITH qualified
        // dividends is a Foreign Earned Income Tax Worksheet return, not a
        // QDCGT return. Line 3a is non-zero deliberately — with it at zero
        // this leaf could not tell a wrapper from a fall-through — and the
        // worksheet's own line 4 then RE-ENTERS the dispatch and selects the
        // QDCGT on its line 3, which is what `preferential` shows.
        formTwentyFiveFiftyFiveOutranksQdcgt: () => {
            const outcome = dispatchLine16(taxParams2025)({
                ...nothingSwitchedOn,
                taxableIncomeCents: 9700000n,
                qualifiedDividendsCents: 30000n,
                filingForm2555: true,
                form2555Line45Cents: 6000000n,
            })
            assertEq(
                outcome.method,
                'foreignEarnedIncomeTaxWorksheet',
                ['Form 2555 outranks both preferential worksheets', outcome],
            )
            assert(outcome.kind === 'ok', ['the wrapper computes as of TAX-42', outcome])
            assertEq(
                outcome.preferential.kind, 'qdcgt',
                ['worksheet line 4 re-enters the dispatch and lands on the QDCGT',
                    outcome.preferential.kind])
        },
        // **THE STACKING RULE, §911(f), and the leaf the whole wrapper exists
        // for.** A single filer with $30,000.00 of taxable income left after a
        // $130,000.00 exclusion. Hand-computed from the 2025 single brackets
        // (Rev. Proc. 2024-40 §2.01), NOT from this module:
        //
        //   worksheet line 3 = $30,000 + $130,000 = $160,000
        //   line 4  = 10%×11,925          =  1,192.50
        //           + 12%×(48,475−11,925) =  4,386.00
        //           + 22%×(103,350−48,475)= 12,072.50
        //           + 24%×(160,000−103,350)=13,596.00  →  $31,247.00
        //   line 5  = the same first three               = 17,651.00
        //           + 24%×(130,000−103,350) =  6,396.00  →  $24,047.00
        //   line 6  = 31,247.00 − 24,047.00              →   $7,200.00
        //
        // **The fudge is $3,365.00**, which `theStackingRuleChangesTheBracket`
        // asserts is NOT the answer: taxing the remaining $30,000 on its own
        // reads the Tax Table at the $30,000–$30,050 band's midpoint and
        // charges 10% and 12%. The exclusion moves the whole remainder into
        // the 24% bracket, and the two answers differ by $3,835.00 — a
        // difference no rounding could produce, which is the point of choosing
        // a fixture that crosses two bracket boundaries rather than one.
        theStackingRuleChangesTheBracket: () => {
            const outcome = dispatchLine16(taxParams2025)({
                ...nothingSwitchedOn,
                status: 'single',
                taxableIncomeCents: 3000000n,
                filingForm2555: true,
                form2555Line45Cents: 13000000n,
            })
            assert(outcome.kind === 'ok', ['the worksheet computes', outcome])
            assertEq(outcome.method, 'foreignEarnedIncomeTaxWorksheet')
            assertEq(outcome.cents, 720000n, '$31,247.00 − $24,047.00 = $7,200.00')
            assert(
                outcome.cents !== 336500n,
                ['taxing the remaining $30,000.00 alone would give $3,365.00', outcome.cents])
        },
        // THE CONTROL for the leaf above, and the only way to see the $3,365.00
        // is real rather than invented: the SAME taxable income with no
        // exclusion is an ordinary Tax Table return.
        //
        //   $30,000–$30,050 band, midpoint $30,025
        //   10%×11,925 = 1,192.50 + 12%×(30,025−11,925) = 2,172.00 → 3,364.50
        //   dollar-rounded half-up → $3,365.00
        controlTheSameTaxableIncomeWithNoExclusionIsAnOrdinaryTaxTableReturn: () => {
            const outcome = dispatchLine16(taxParams2025)({
                ...nothingSwitchedOn,
                status: 'single',
                taxableIncomeCents: 3000000n,
            })
            assert(outcome.kind === 'ok', ['an ordinary return computes', outcome])
            assertEq(outcome.method, 'taxTable')
            assertEq(outcome.cents, 336500n, 'the $30,025 midpoint, dollar-rounded')
        },
        // The whole worksheet inside the Tax Table, where BOTH lines 4 and 5
        // read band midpoints rather than the income itself. Married filing
        // jointly, $20,000.00 of taxable income and a $60,000.00 exclusion,
        // hand-computed from the 2025 joint brackets:
        //
        //   line 3 = $80,000 → band $80,000–$80,050, midpoint $80,025
        //            10%×23,850 = 2,385.00 + 12%×(80,025−23,850) = 6,741.00
        //                                                       →  $9,126.00
        //   line 5 = $60,000 → midpoint $60,025
        //            2,385.00 + 12%×(60,025−23,850) = 4,341.00   →  $6,726.00
        //   line 6 = 9,126.00 − 6,726.00                         →  $2,400.00
        //
        // The bracket moves here too: $20,000 alone is entirely inside the 10%
        // band, and stacked on $60,000 every dollar of it is at 12%.
        theWorksheetInsideTheTaxTableReadsTwoBandMidpoints: () => {
            const outcome = dispatchLine16(taxParams2025)({
                ...nothingSwitchedOn,
                taxableIncomeCents: 2000000n,
                filingForm2555: true,
                form2555Line45Cents: 6000000n,
            })
            assert(outcome.kind === 'ok', ['the worksheet computes', outcome])
            assertEq(outcome.cents, 240000n, '$9,126.00 − $6,726.00 = $2,400.00')
            assert(
                outcome.cents !== 200300n,
                ['$20,000.00 alone is $2,002.50, dollar-rounded to $2,003.00', outcome.cents])
        },
        // Worksheet line 2b — "any itemized deductions or exclusions you
        // couldn't claim because they are related to excluded income" — bites,
        // and it bites in the taxpayer's FAVOUR, which is why omitting it
        // would be an overstatement rather than an under-tax.
        //
        // The same single filer as `theStackingRuleChangesTheBracket`, with
        // $30,000.00 on line 2b:
        //   line 2c = 130,000 − 30,000 = $100,000; line 3 = $130,000
        //   line 4  = $24,047.00 (the previous leaf's line 5)
        //   line 5  = 1,192.50 + 4,386.00 + 22%×(100,000−48,475) = 11,335.50
        //                                                      →  $16,914.00
        //   line 6  = 24,047.00 − 16,914.00                     →   $7,133.00
        lineTwoBReducesTheStackAndTheTax: () => {
            const outcome = dispatchLine16(taxParams2025)({
                ...nothingSwitchedOn,
                status: 'single',
                taxableIncomeCents: 3000000n,
                filingForm2555: true,
                form2555Line45Cents: 13000000n,
                form2555ItemizedDeductionsAndExclusionsNotClaimedCents: 3000000n,
            })
            assert(outcome.kind === 'ok', ['the worksheet computes', outcome])
            assertEq(outcome.cents, 713300n, '$24,047.00 − $16,914.00 = $7,133.00')
            assert(
                outcome.cents !== 720000n,
                ['ignoring line 2b would leave the $7,200.00 of the leaf above', outcome.cents])
        },
        // Line 2b larger than line 2a floors line 2c at zero rather than
        // subtracting from the stack — "Subtract line 2b from line 2a. If zero
        // or less, enter -0-." Without the floor, line 3 would fall BELOW 1040
        // line 15 and line 5 would price a negative amount.
        lineTwoCFloorsAtZeroRatherThanGoingNegative: () => {
            const outcome = dispatchLine16(taxParams2025)({
                ...nothingSwitchedOn,
                status: 'single',
                taxableIncomeCents: 3000000n,
                filingForm2555: true,
                form2555Line45Cents: 500000n,
                form2555ItemizedDeductionsAndExclusionsNotClaimedCents: 900000n,
            })
            assert(outcome.kind === 'ok', ['the worksheet computes', outcome])
            assertEq(
                outcome.cents, 336500n,
                'line 2c is $0.00, so line 3 is line 1 and line 6 is the ordinary $3,365.00')
        },
        // Line 50 is the housing DEDUCTION and is a structural zero — NAMED
        // rather than omitted. Worksheet line 2a is "lines 45 AND 50", and
        // this leaf is what shows the second half is added rather than
        // ignored: the same $130,000.00 arriving half on each line reaches the
        // identical $7,200.00.
        lineFiftyIsAddedToLineFortyFiveOnWorksheetLineTwoA: () => {
            const split = dispatchLine16(taxParams2025)({
                ...nothingSwitchedOn,
                status: 'single',
                taxableIncomeCents: 3000000n,
                filingForm2555: true,
                form2555Line45Cents: 6500000n,
                form2555Line50Cents: 6500000n,
            })
            assert(split.kind === 'ok', ['the worksheet computes', split])
            assertEq(split.cents, 720000n, '$65,000.00 + $65,000.00 is the same $130,000.00 stack')
        },
        // The worksheet's CAUTION — "If Form 1040 or 1040-SR, line 15, is
        // zero, don't complete this worksheet" — is NOT a short-circuit in
        // this implementation, and this is the leaf that says the arithmetic
        // reaches the same place. At line 1 = $0.00, line 3 equals line 2c, so
        // lines 4 and 5 price the same amount and line 6 is $0.00.
        aForeignFilerWithNoTaxableIncomeOwesNothing: () => {
            const outcome = dispatchLine16(taxParams2025)({
                ...nothingSwitchedOn,
                status: 'single',
                taxableIncomeCents: 0n,
                filingForm2555: true,
                form2555Line45Cents: 13000000n,
            })
            assert(outcome.kind === 'ok', ['the worksheet computes', outcome])
            assertEq(outcome.method, 'foreignEarnedIncomeTaxWorksheet')
            assertEq(outcome.cents, 0n, 'line 4 and line 5 price the same $130,000.00')
        },
        // A NEGATIVE 1040 line 15 reaches the same place through line 1's own
        // floor. Printed 1040 line 15 is itself "if zero or less, enter -0-",
        // so a caller handing this dispatcher a negative taxable income must
        // not produce a negative line 3.
        aNegativeTaxableIncomeFloorsAtZeroOnWorksheetLineOne: () => {
            const outcome = dispatchLine16(taxParams2025)({
                ...nothingSwitchedOn,
                status: 'single',
                taxableIncomeCents: -500000n,
                filingForm2555: true,
                form2555Line45Cents: 13000000n,
            })
            assert(outcome.kind === 'ok', ['the worksheet computes', outcome])
            assertEq(outcome.cents, 0n, 'line 1 is $0.00, not −$5,000.00')
        },
        // A stored Form 2555 that excludes NOTHING leaves line 16 exactly
        // where it was. Line 2c is zero, line 3 is line 1, line 5 is the tax
        // on zero, and line 6 is the ordinary answer — the worksheet is a
        // no-op rather than a different engine.
        //
        // THE CONTROL for every leaf above: without it, a worksheet that
        // returned `line 4` and dropped line 5 entirely would pass
        // `theStackingRuleChangesTheBracket` only by luck, and would pass this
        // one never.
        aStoredFormTwoFiveFiveFiveThatExcludesNothingLeavesLineSixteenAlone: () => {
            const outcome = dispatchLine16(taxParams2025)({
                ...nothingSwitchedOn,
                status: 'single',
                taxableIncomeCents: 3000000n,
                filingForm2555: true,
            })
            assert(outcome.kind === 'ok', ['the worksheet computes', outcome])
            assertEq(outcome.method, 'foreignEarnedIncomeTaxWorksheet')
            assertEq(outcome.cents, 336500n, 'the same $3,365.00 an ordinary return pays')
        },
        // **The preferential re-entry, priced.** A single filer with $50,000.00
        // of taxable income, $2,000.00 of qualified dividends and a $60,000.00
        // exclusion. Worksheet line 3 is $110,000, which the QDCGT prices
        // (hand-computed from that worksheet's printed lines, single column,
        // $48,350 zero-rate ceiling and $533,400 fifteen-rate ceiling):
        //
        //   QDCGT line 5  = 110,000 − 2,000            = 108,000
        //         line 9  = min(110,000, 48,350) − min(108,000, 48,350) = 0
        //         line 17 = 2,000, line 18 = 15%×2,000 =     300.00
        //         line 21 = 20%×0                      =       0.00
        //         line 22 = tax on 108,000 (worksheet) = 18,767.00
        //         line 23 = 19,067.00; line 24 = tax on 110,000 = 19,247.00
        //         line 25 = min(23, 24)                = $19,067.00
        //   worksheet line 5 = tax on $60,000 (Tax Table, midpoint $60,025)
        //                    = 1,192.50 + 4,386.00 + 22%×11,550 = 8,119.50
        //                    dollar-rounded half-up  = $8,120.00
        //   worksheet line 6 = 19,067.00 − 8,120.00   = $10,947.00
        theWorksheetLineFourRunsTheQdcgtOnItsOwnLineThree: () => {
            const outcome = dispatchLine16(taxParams2025)({
                ...nothingSwitchedOn,
                status: 'single',
                taxableIncomeCents: 5000000n,
                qualifiedDividendsCents: 200000n,
                filingForm2555: true,
                form2555Line45Cents: 6000000n,
            })
            assert(outcome.kind === 'ok', ['no capital gain excess here, so it computes', outcome])
            assertEq(outcome.method, 'foreignEarnedIncomeTaxWorksheet')
            assertEq(outcome.preferential.kind, 'qdcgt')
            assert(
                outcome.preferential.kind === 'qdcgt',
                ['the QDCGT rides out on the ok arm', outcome.preferential.kind])
            assertEq(
                outcome.preferential.worksheet.line1, 11000000n,
                'and it was run on worksheet line 3, $110,000.00 — not on 1040 line 15')
            assertEq(outcome.cents, 1094700n, '$19,067.00 − $8,120.00 = $10,947.00')
        },
        // **The capital gain excess**, the one corner level 0a refuses. Same
        // filer, $1,000.00 of taxable income and $30,000.00 of qualified
        // dividends: QDCGT line 4 is the whole $30,000.00 and 1040 line 15 is
        // $1,000.00, so the excess is $29,000.00 and the printed footnote
        // sends the filer to a second, modified worksheet.
        aCapitalGainExcessInsideTheWorksheetRefusesByName: () => {
            const outcome = dispatchLine16(taxParams2025)({
                ...nothingSwitchedOn,
                status: 'single',
                taxableIncomeCents: 100000n,
                qualifiedDividendsCents: 3000000n,
                filingForm2555: true,
                form2555Line45Cents: 13000000n,
            })
            assert(outcome.kind === 'error', ['a capital gain excess must refuse', outcome])
            assertEq(outcome.method, 'foreignEarnedIncomeTaxWorksheet')
            assertEq(outcome.unmodeled.length, 1, outcome.unmodeled)
            assertEq(outcome.unmodeled[0], 'foreignEarnedIncomeCapitalGainExcess')
            assert(
                outcome.message.includes('capital gain excess'),
                ['the refusal must name the printed term', outcome.message])
            assert(
                outcome.message.includes('1040 line 16'),
                ['and where the amount would have gone', outcome.message])
        },
        // THE CONTROL for the refusal above, and it is the boundary rather
        // than a distant case: the SAME $30,000.00 of qualified dividends
        // against a taxable income of exactly $30,000.00 has NO excess — the
        // footnote's test is "more than zero" — and computes.
        controlPreferentialIncomeEqualToTaxableIncomeIsNotAnExcess: () => {
            const outcome = dispatchLine16(taxParams2025)({
                ...nothingSwitchedOn,
                status: 'single',
                taxableIncomeCents: 3000000n,
                qualifiedDividendsCents: 3000000n,
                filingForm2555: true,
                form2555Line45Cents: 13000000n,
            })
            assert(outcome.kind === 'ok', ['equal is not an excess', outcome])
            assertEq(outcome.method, 'foreignEarnedIncomeTaxWorksheet')
            assertEq(outcome.preferential.kind, 'qdcgt')
        },
        // ONE cent over the boundary refuses. Paired with the leaf above this
        // is what pins `>` rather than `>=`, which is the comparison mutation
        // AGENTS.md records surviving in this very module once before.
        oneCentOfCapitalGainExcessRefuses: () => {
            const outcome = dispatchLine16(taxParams2025)({
                ...nothingSwitchedOn,
                status: 'single',
                taxableIncomeCents: 2999999n,
                qualifiedDividendsCents: 3000000n,
                filingForm2555: true,
                form2555Line45Cents: 13000000n,
            })
            assert(outcome.kind === 'error', ['one cent of excess refuses', outcome])
            assertEq(outcome.unmodeled[0], 'foreignEarnedIncomeCapitalGainExcess')
        },
        // A return with NO preferential income has no preferential slice to be
        // in excess, however small its taxable income. Without this leaf a
        // `'none'` arm that contributed something other than zero would go
        // unnoticed, and every ordinary expatriate return would refuse.
        controlNoPreferentialIncomeIsNeverACapitalGainExcess: () => {
            const outcome = dispatchLine16(taxParams2025)({
                ...nothingSwitchedOn,
                status: 'single',
                taxableIncomeCents: 0n,
                filingForm2555: true,
                form2555Line45Cents: 13000000n,
            })
            assert(outcome.kind === 'ok', ['no worksheet ran, so no excess', outcome])
            assertEq(outcome.preferential.kind, 'none')
        },
        // ── WHERE §911(f) MEETS FORM 4797, and it is a real interaction ──────
        //
        // These two leaves exist because two branches cut from the same commit
        // each reached HALF of this. Form 2555 (TAX-42) made level 0a compute
        // by re-entering levels 1 through 3 on the worksheet's line 3; Form
        // 4797 (TAX-41) made Schedule D line 19 non-zero for the first time,
        // which is what sends level 2a to the Schedule D Tax Worksheet instead
        // of the QDCGT. Neither branch could write a fixture holding both, so
        // when they were integrated the `scheduleDTaxWorksheet` arm of the
        // capital-gain-excess test above became REACHABLE AND UNPROVEN —
        // replacing `preferential.worksheet.line10` with `… * 0n` left the
        // whole suite green.
        //
        // The composition itself is sound and these leaves say why rather
        // than assert that it is: level 2a's condition reads Schedule D lines
        // 15, 16, 18 and 19, none of which the stacking rule touches, so the
        // worksheet SELECTED is the same one an identical domestic return
        // would get — only the AMOUNT it is run on changes, from 1040 line 15
        // to the worksheet's line 3.
        aSectionTwelveFiftyGainKeepsTheScheduleDTaxWorksheetInsideTheStackedWorksheet: () => {
            const outcome = dispatchLine16(taxParams2025)({
                ...scheduleDWithUnrecapturedGainAndQualifiedDividends,
                filingForm2555: true,
                form2555Line45Cents: 3000000n,
            })
            assert(outcome.kind === 'ok', ['both together must compute', outcome])
            // The OUTER method is the wrapper's, and the worksheet it carries
            // out is the Schedule D Tax Worksheet — not the QDCGT. A stacking
            // rule that re-ran level 2c would report `qdcgt` here and price the
            // unrecaptured §1250 gain at the wrong band, in the taxpayer's
            // favour, which is exactly the silent direction §911(f) exists to
            // stop.
            assertEq(outcome.method, 'foreignEarnedIncomeTaxWorksheet')
            assertEq(outcome.preferential.kind, 'scheduleDTaxWorksheet')
            assert(outcome.preferential.kind === 'scheduleDTaxWorksheet', 'narrowing')
            // Run on the STACKED amount: $97,000.00 of taxable income plus the
            // $30,000.00 exclusion is the worksheet's own line 3.
            assertEq(
                outcome.preferential.worksheet.line1, 12700000n,
                'the Schedule D Tax Worksheet ran on worksheet line 3, not on 1040 line 15')
            // And the tax is higher than the identical return without the
            // exclusion — `scheduleDConditionsOutrankQualifiedDividends`'s own
            // $7,575.00, hand-typed here rather than recomputed.
            assertEq(outcome.cents, 1254900n, '$12,549.00, against $7,575.00 unstacked')
            assert(
                outcome.cents > 757500n,
                ['excluded income still prices what remains', outcome.cents])
        },
        // The capital gain excess read off the SCHEDULE D TAX WORKSHEET's own
        // line 10 rather than the QDCGT's line 4 — the arm the printed
        // footnote names in its parenthesis, *"(line 10 of your Schedule D Tax
        // Worksheet)"*, and the one no fixture reached until Form 4797 landed.
        //
        // ZERO qualified dividends and zero capital gain distributions, so the
        // whole preferential slice is the §1231 gain on Schedule D lines 15 and
        // 16: a guard that fell through to the `'none'` arm, or read a QDCGT
        // that never ran, would contribute `0n`, never exceed line 1, and let
        // this return compute against a worksheet the engine has not
        // transcribed.
        theCapitalGainExcessReadsTheScheduleDTaxWorksheetsOwnLineTen: () => {
            const outcome = dispatchLine16(taxParams2025)({
                ...nothingSwitchedOn,
                taxableIncomeCents: 10000n,
                filingScheduleD: true,
                scheduleD15Cents: 4000000n,
                scheduleD16Cents: 4000000n,
                scheduleD19Cents: 1000000n,
                filingForm2555: true,
                form2555Line45Cents: 13000000n,
            })
            assert(outcome.kind === 'error', ['a $40,000.00 slice over $100.00 of taxable income is an excess', outcome])
            assertEq(outcome.method, 'foreignEarnedIncomeTaxWorksheet')
            assertEq(outcome.unmodeled[0], 'foreignEarnedIncomeCapitalGainExcess')
        },
        // THE CONTROL for the leaf above: the identical Schedule D return with
        // no exclusion computes, so the refusal is the excess and not the
        // §1250 gain.
        controlTheSameScheduleDReturnWithoutAnExclusionComputes: () => {
            const outcome = dispatchLine16(taxParams2025)({
                ...nothingSwitchedOn,
                taxableIncomeCents: 10000n,
                filingScheduleD: true,
                scheduleD15Cents: 4000000n,
                scheduleD16Cents: 4000000n,
                scheduleD19Cents: 1000000n,
            })
            assert(outcome.kind === 'ok', ['without §911 there is no worksheet to be in excess of', outcome])
            assertEq(outcome.method, 'scheduleDTaxWorksheet')
        },
        // Level 2b's Form 4952 refusal, reached THROUGH the worksheet's line 4
        // and re-tagged with the wrapper's own method. The refusal a reader
        // needs is the one naming Form 4952; the method is what says which
        // branch they were in when it fired.
        aFormFourNineFiveTwoRefusalInsideTheWorksheetKeepsTheWrapperMethod: () => {
            const outcome = dispatchLine16(taxParams2025)({
                ...nothingSwitchedOn,
                status: 'single',
                taxableIncomeCents: 3000000n,
                qualifiedDividendsCents: 30000n,
                filingForm4952: true,
                form4952Line4gCents: 250000n,
                filingForm2555: true,
                form2555Line45Cents: 13000000n,
            })
            assert(outcome.kind === 'error', ['the inner refusal travels out', outcome])
            assertEq(outcome.method, 'foreignEarnedIncomeTaxWorksheet')
            assertEq(outcome.unmodeled[0], 'investmentInterestForm4952')
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
    ordering: {
        // ★ THE ORDERING PROOF. The one leaf in this phase that can see a
        // swapped 2a/2c dispatch order.
        //
        // As of Plan 12.1-04, branch 2a COMPUTES rather than refuses, and
        // that makes this leaf's own assertion STRICTLY STRONGER than it
        // was through Phase 12: before, only the METHOD TAG could tell a
        // correct dispatch from a swapped one (with Schedule D lines 18/19
        // zero, the two worksheets are algebraically identical, so no
        // ordinary test case can distinguish them). Now that BOTH branches
        // compute over the SAME non-degenerate input (Schedule D line 19 =
        // $10,000.00, non-zero), a swapped order must change the returned
        // VALUE too: `757500n` ($7,575.00, correct) versus `637500n`
        // ($6,375.00, `controlSameInputsWithZeroEighteenAndNineteenSelectQdcgt`'s
        // own hand-verified figure) — Mutation Gate M3 (Plan 12.1-04 Task
        // 3) watches this leaf redden on exactly that swap.
        //
        // Its control is `controlSameInputsWithZeroEighteenAndNineteenSelectQdcgt`,
        // immediately below: the same return with lines 18 and 19 at zero
        // must still reach the QDCGT. Without it, a dispatcher that routed
        // every Schedule D filer to the Schedule D Tax Worksheet would pass
        // this leaf.
        scheduleDConditionsOutrankQualifiedDividends: () => {
            const outcome = dispatchLine16(taxParams2025)(
                scheduleDWithUnrecapturedGainAndQualifiedDividends,
            )
            assertEq(
                outcome.method,
                'scheduleDTaxWorksheet',
                [
                    'level 2a must be tested BEFORE level 2c: a return with both qualified dividends'
                    + ' and unrecaptured section 1250 gain belongs to the Schedule D Tax Worksheet',
                    outcome,
                ],
            )
            assert(
                outcome.kind === 'ok',
                ['that branch is selected and computes (Plan 12.1-04)', outcome],
            )
            assertEq(outcome.cents, 757500n, 'Worked Example 1\'s own answer, $7,575.00')
        },
        // THE CONTROL for `scheduleDConditionsOutrankQualifiedDividends`.
        // The identical return with Schedule D lines 18 and 19 both zero
        // and Form 4952 not filed is a legitimate QDCGT return and must
        // COMPUTE. A gate that refused every Schedule D filer would pass
        // the ordering leaf and nothing else; this is what distinguishes
        // this dispatcher from that one.
        //
        // $6,375.00 is hand-typed, derived from the printed worksheet and
        // the stored TY2025 brackets BEFORE the code was run:
        //   L3 = min(40,000, 40,000) = 40,000.00 ; L4 = 40,300.00
        //   L5 = 97,000 - 40,300 = 56,700.00 ; L9 = 96,700 - 56,700 = 40,000.00 at 0%
        //   L12 = L17 = 300.00 ; L18 = 15% x 300 = 45.00 ; L20 = L21 = 0
        //   L22 = Tax Table MFJ band [56,700 , 56,750), midpoint 56,725:
        //         10% x 23,850 = 2,385.00 plus 12% x 32,875 = 3,945.00 = 6,330.00
        //   L23 = 45 + 6,330 = 6,375.00 ; L24 = 11,174.00 ; L25 = min = 6,375.00
        //
        // $11,174.00 is the printed MFJ Tax Table row $97,000-$97,050,
        // and the comparison against it is what says the preferential
        // treatment actually happened: this return pays $4,799.00 LESS
        // than the same taxable income run straight through the table.
        controlSameInputsWithZeroEighteenAndNineteenSelectQdcgt: () => {
            const outcome = dispatchLine16(taxParams2025)({
                ...scheduleDWithUnrecapturedGainAndQualifiedDividends,
                scheduleD18Cents: 0n,
                scheduleD19Cents: 0n,
                filingForm4952: false,
            })
            assertEq(outcome.kind, 'ok', ['the legitimate Schedule D return must not be refused', outcome])
            assertEq(outcome.method, 'qdcgt', ['expected the QDCGT worksheet', outcome])
            assert(outcome.kind === 'ok', ['expected a computed outcome', outcome])
            assertEq(outcome.cents, 637500n, 'Form 1040 line 16 = $6,375.00')
            assert(
                outcome.cents < 1117400n,
                [
                    'the preferential slice must be taxed below the straight Tax Table amount'
                    + ' for $97,000.00 of taxable income',
                    outcome.cents,
                ],
            )
        },
        // A return with no Schedule D, no qualified dividends and no
        // capital gain distributions never reaches level 2 at all — on
        // both sides of the $100,000 seam.
        //
        // Its own control is the third block: the SAME income with
        // qualified dividends added does reach level 2. Without it this
        // leaf would pass for a dispatcher that never selected a
        // preferential worksheet under any circumstances.
        profileWithNoPreferentialIncomeNeverReachesLevelTwo: () => {
            /** @type {readonly Line16Method[]} */
            const baseMethods = ['taxTable', 'taxComputationWorksheet']
            const below = dispatchLine16(taxParams2025)({
                ...nothingSwitchedOn,
                taxableIncomeCents: 5000000n,
            })
            assert(
                baseMethods.includes(below.method),
                ['no preferential income must fall through to the base lookup', below],
            )
            assertEq(below.method, 'taxTable', ['$50,000.00 is a table lookup', below])
            const above = dispatchLine16(taxParams2025)({
                ...nothingSwitchedOn,
                taxableIncomeCents: 25000000n,
            })
            assert(
                baseMethods.includes(above.method),
                ['no preferential income must fall through to the base lookup', above],
            )
            assertEq(
                above.method,
                'taxComputationWorksheet',
                ['$250,000.00 is a Tax Computation Worksheet return', above],
            )
            const withDividends = dispatchLine16(taxParams2025)({
                ...nothingSwitchedOn,
                taxableIncomeCents: 5000000n,
                qualifiedDividendsCents: 100000n,
            })
            assert(
                !baseMethods.includes(withDividends.method),
                ['the SAME income with qualified dividends must reach level 2', withDividends],
            )
            assertEq(withDividends.method, 'qdcgt', ['expected the QDCGT worksheet', withDividends])
        },
    },
    exhaustiveness: {
        // TAX-03 names FOUR branches and every one of them must be
        // reachable. One input set per branch, each asserting the method
        // the dispatcher selects, against a HAND-TYPED count — so a
        // branch quietly removed from the dispatcher fails here rather
        // than merely losing its own leaf and taking its own evidence
        // with it.
        //
        // The `scheduleDTaxWorksheet` row uses the same discriminating
        // input as the ordering leaf, deliberately: see
        // {@link taxThreeBranches}.
        dispatchIsExhaustiveOverTheFourTaxThreeBranches: () => {
            assertEq(
                taxThreeBranches.length,
                expectedTaxThreeBranchCount,
                ['TAX-03 names four line-16 branches', taxThreeBranches.length],
            )
            assertEq(
                new Set(taxThreeBranches.map(row => row.expectedMethod)).size,
                expectedTaxThreeBranchCount,
                ['the four rows must name four DISTINCT methods', taxThreeBranches.map(row => row.expectedMethod)],
            )
            for (const row of taxThreeBranches) {
                const outcome = dispatchLine16(taxParams2025)(row.inputs)
                assertEq(
                    outcome.method,
                    row.expectedMethod,
                    ['this input set must select this branch', row.name, outcome],
                )
            }
        },
        // Criterion 4: a refusal NAMES what is unmodeled. A leaf
        // asserting only `kind === 'error'` would make it vacuous —
        // exactly the weakness Phase 9's sweep found in several places,
        // where assertions checked THAT a refusal threw rather than what
        // it threw.
        //
        // The hand-typed count stands behind the loop for the same reason
        // it stands behind the branch table: the rows are proof-owned,
        // but a row silently deleted would still shrink the loop.
        everyRefusingArmNamesWhatIsUnmodeled: () => {
            assertEq(
                refusingArms.length,
                expectedRefusingArmCount,
                ['this dispatcher has four refusing arms', refusingArms.length],
            )
            for (const row of refusingArms) {
                const outcome = dispatchLine16(taxParams2025)(row.inputs)
                assertEq(outcome.method, row.expectedMethod, ['expected this arm', row.name, outcome])
                assert(outcome.kind === 'error', ['expected this arm to refuse', row.name, outcome])
                assert(
                    outcome.unmodeled.length > 0,
                    ['a refusal that names nothing is the silence it replaces', row.name, outcome],
                )
                assertEq(
                    outcome.unmodeled.length,
                    row.expectedUnmodeled.length,
                    ['expected exactly these unmodeled kinds', row.name, outcome.unmodeled],
                )
                for (const [index, kind] of row.expectedUnmodeled.entries()) {
                    assertEq(
                        outcome.unmodeled[index],
                        kind,
                        ['expected this kind at this position', row.name, index, outcome.unmodeled],
                    )
                }
                for (const label of row.expectedLabels) {
                    assert(
                        outcome.message.includes(label),
                        ['expected the refusal message to name this label', row.name, label, outcome.message],
                    )
                }
            }
        },
    },
}

// ── Where the degenerate-equivalence differential now lives ──────────────────
//
// 10-RESEARCH.md's DEGENERATE-EQUIVALENCE DIFFERENTIAL — on inputs where
// Schedule D lines 18 and 19 are both zero, the Schedule D Tax Worksheet
// and the QDCGT must return the SAME CENTS — is exactly the property
// behind everything this module says about ordering (it is precisely why
// a swapped 2a/2c order was invisible to the number through Phase 12,
// while that branch still refused). Plan 12.1-02 built this proof, ahead
// of this module's own wiring: `fjs/tax/line16/sdtw`'s own
// `degenerateEquivalenceWithQdcgt`-style leaf validates BOTH
// transcriptions against each other directly, over a shared fixture,
// independently of this dispatcher.
//
// This module's OWN ordering evidence, now that branch 2a computes, is
// STRONGER than a differential: `scheduleDConditionsOutrankQualifiedDividends`
// and the `scheduleDTaxWorksheet` row of
// `dispatchIsExhaustiveOverTheFourTaxThreeBranches` assert a REAL, non-zero
// cents figure on a non-degenerate input (Schedule D line 19 > 0), and
// Mutation Gate M3 (Plan 12.1-04 Task 3) watches a swapped 2a/2c order
// change that figure from `757500n` to `637500n` — a value disagreement,
// not merely a tag disagreement.
