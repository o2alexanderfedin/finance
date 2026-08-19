/**
 * Form 8995 (TY2025) — TAX-32: *Qualified Business Income Deduction —
 * Simplified Computation*, all seventeen printed lines, plus the named refusal
 * that stands where Form **8995-A** would be.
 *
 * Source, transcribed from the printed `f8995.pdf` face: lines 1(i)-1(v)
 * (per-business QBI), 2-5 (the QBI component), 6-9 (the REIT/PTP component),
 * 10 (the deduction before the income limitation), 11-14 (the income
 * limitation), 15 (the deduction, → 1040 line 13a) and 16-17 (the two loss
 * carryforwards to next year).
 *
 * ## THE ORDERING, which is the trap this whole form is built around
 *
 * §199A's deduction is limited by 20% of TAXABLE INCOME, and taxable income
 * is computed after deductions — including this one. Read naively that is a
 * fixed point.
 *
 * **The printed page breaks it in one word.** Line 11 is *"taxable income
 * BEFORE qualified business income deduction"*, so the limitation is measured
 * against a figure that does not include the thing being limited. There is no
 * circularity, only an ORDER — and the order is not the order of the printed
 * 1040, whose line 13a comes before line 13b. `fjs/form1040/core` therefore
 * computes 13b FIRST and 13a second, and says so at the call site.
 *
 * On the 2025 form that ordering has one more consequence worth stating,
 * because the 2018-2024 instructions do not cover it: 1040 line 14 adds line
 * 12 (the standard or itemized deduction), line 13a (this) and line 13b
 * (Schedule 1-A's additional deductions). So *"taxable income before the
 * qualified business income deduction"* is `line 11 − line 12 − line 13b`,
 * floored at zero — **not** `line 11 − line 12`. Treating the senior
 * deduction as though it came after §199A would overstate line 11 here and,
 * through the 20% limitation, overstate the deduction for exactly the filer
 * OBBBA's senior deduction was written for.
 * {@link taxableIncomeBeforeQualifiedBusinessIncomeDeduction} is that
 * subtraction, named once.
 *
 * ## What QBI IS, and the reduction almost everybody misses
 *
 * §199A(c)(1) defines qualified business income as the net amount of income,
 * gain, deduction and loss with respect to the trade or business. The
 * deductions include the ones a proprietor takes on Schedule 1 rather than on
 * Schedule C, to the extent they are attributable to the business:
 *
 * | Reduces QBI | This engine |
 * |---|---|
 * | Schedule 1 line 15, the deductible half of self-employment tax | **computed** (Phase 28, TAX-31) |
 * | Schedule 1 line 17, the self-employed health insurance deduction | a documented zero; `selfEmployedHealthInsuranceDeduction` is an `fjs/return/scope` refusal |
 * | Schedule 1 line 16, self-employed SEP/SIMPLE/qualified plan contributions | a documented zero; `selfEmployedRetirementPlans` is an `fjs/return/scope` refusal |
 *
 * {@link qualifiedBusinessIncome} performs all three subtractions, with the
 * two permanent zeros NAMED rather than omitted — the same discipline
 * `fjs/schedule/1`'s `studentLoanInterestPhaseoutIncome` follows for
 * §221(b)(2)(C)'s three unreachable exclusions. **The reduction LOWERS the
 * deduction**, so leaving it out would be an understatement of tax, and it is
 * the single most commonly missed step on this form.
 *
 * ## Above the threshold this form does not apply, and `fjs/form8995a` is where
 * the return goes
 *
 * Form 8995 is the *simplified* computation, available only when taxable
 * income before the QBI deduction is at or below §199A(e)(2)'s threshold
 * ($197,300, or $394,600 on a joint return, for TY2025). Above it, Form
 * **8995-A** applies and brings two things no printed line on THIS page asks
 * about:
 *
 * - **The W-2-wage and UBIA limitations** (§199A(b)(2)(B)): the deduction is
 *   capped at the greater of 50% of the business's W-2 wages, or 25% of those
 *   wages plus 2.5% of the unadjusted basis immediately after acquisition of
 *   qualified property. **A sole proprietor with no employees has no W-2
 *   wages**, so the cap bites hard — and UBIA is an asset basis history, the
 *   very thing Schedule C line 13 already refuses for.
 * - **The SSTB phase-in** (§199A(d)(3)): whether the business is a *specified
 *   service trade or business* — health, law, accounting, consulting,
 *   athletics, financial services, or one whose principal asset is the
 *   reputation or skill of its employees or owners.
 *
 * **Both are modeled now** (Phase 31, TAX-32): `fjs/form8995a` transcribes Form
 * 8995-A and its Schedule A, `vnd.fjs.business_expenses` carries the three
 * facts they read as taxpayer assertions, and `fjs/form1040/core` routes 1040
 * line 13a through that module for every return. Computing Form 8995 above the
 * threshold would still OVERSTATE the deduction and understate the tax, so
 * {@link formEightNineNineFiveAIsUnmodeled} stays as the guard that keeps THIS
 * page from being used out of range — one rule in one place, checked from both
 * sides. It is unreachable through the product path, because the router
 * compares the same threshold before delegating here.
 *
 * ## Why no SSTB field was stored in Phase 28, and why one is stored now
 *
 * Phase 28 declined to add an `isSpecifiedServiceTradeOrBusiness` assertion to
 * `vnd.fjs.business_expenses` on the grounds that **it would be a stored field
 * with no reader** — exactly the defect Phase 27 found in `vnd.fjs.w2`'s
 * `box13StatutoryEmployee`, a box modeled since its dialect was written and read
 * by nothing while the engine silently produced a wrong answer for the filers it
 * concerned.
 *
 * §199A(d)(3) was the reason it could wait: below the threshold an SSTB is a
 * qualified trade or business like any other, with no reduction at all, so the
 * assertion could only ever be READ above the threshold — which is where that
 * phase refused.
 *
 * **The day Form 8995-A is modeled is the day the field acquires a reader**, and
 * Phase 31 is that day: `specifiedServiceTradeOrBusiness`, `w2Wages` and
 * `unadjustedBasisOfQualifiedProperty` landed in the same commit as the reader
 * that uses them, and `fjs/form8995a` refuses by name when one is unstated and
 * the answer depends on it. Below the threshold none of the three is read, which
 * is why a return stored before that phase still computes what it always did.
 *
 * ## The prior-year loss carryforward is ASSERTED, and its absence REFUSES
 *
 * §199A(c)(2) carries a negative net QBI forward into the succeeding year,
 * where printed line 3 subtracts it. This engine holds one tax year, and
 * reading an absent carryforward as zero would OVERSTATE the deduction — for
 * the founder with a year-one loss and a year-two profit, who is the canonical
 * §199A(c)(2) taxpayer and this phase's own persona.
 *
 * So `vnd.fjs.business_expenses` carries
 * `priorYearQualifiedBusinessLossCarryforward` (Phase 28), `'0.00'` is the
 * assertion "none", and absence is *unstated* rather than none:
 * {@link priorYearCarryforwardIsUnstated} refuses by name whenever a deduction
 * would otherwise be computed. That dialect's own header carries the argument
 * for why absence cannot mean zero here when it does mean zero for
 * `vnd.fjs.prior_year_capital_loss`.
 *
 * ## Lines 6-9: the REIT half is COMPUTED, the PTP half is not
 *
 * §199A(b)(1)(B)'s second component is 20% of qualified REIT dividends plus
 * qualified publicly traded partnership income, and it is independent of the
 * qualified-business-income component in the strong sense: **it needs no trade
 * or business at all**, it is not reduced by §199A(b)(2)(B)'s wage/UBIA cap,
 * and §199A(d)(3)'s specified-service phase-out does not touch it. A retiree
 * whose only holding is a REIT index fund is entitled to it.
 *
 * Line 6 now carries the REIT half: `vnd.fjs.1099div` box 5 (§199A dividends),
 * which that dialect has stored inside its own money-exactness loop since it
 * shipped and no computation read — the `box13StatutoryEmployee` shape this
 * repository has already paid for twice. `fjs/form1040/core` sums the box over
 * every stored 1099-DIV and cites one `Source` per contributing document.
 *
 * **The PTP half is still zero, and it is zero because it is REFUSED.**
 * Qualified publicly traded partnership income reaches a return on a Schedule
 * K-1, as box 20 code Z or box 17 code V, and `fjs/schedule/e`'s
 * `section199AInformationRefusal` stops the WHOLE return for either — a
 * document-data refusal, so it fires whatever the profile declared.
 * `qualifiedReitDividendsAndPtpIncome` also remains an `fjs/return/scope`
 * refusal, and `fjs/form8995/todo/reit-dividends.md` argues why that row must
 * be SPLIT before either half is reclassified: moving it whole would tell a
 * taxpayer holding a pipeline K-1 that this engine computes their deduction.
 *
 * **Line 7 is therefore a structural zero rather than an unstated assertion.**
 * §199A(c)(2)'s one-tax-year argument, which makes
 * {@link priorYearCarryforwardIsUnstated} refuse for line 3, would apply here
 * too if line 6 could ever be negative — and it cannot: a qualified REIT
 * dividend is a dividend, and a qualified PTP LOSS is the only other way in.
 * That argument is load-bearing on the PTP half staying refused, which is the
 * second reason the kind must not be reclassified whole.
 *
 * ## What else is a documented zero here
 *
 * - **Lines 1(ii) through 1(v).** This engine computes ONE Schedule C and
 *   `fjs/schedule/c` refuses a second business by name, so exactly one row of
 *   the printed table can ever be filled.
 * - **Line 3's cooperative payments** and the DPAD add-on the printed line 15
 *   mentions for patrons of agricultural or horticultural cooperatives: a
 *   patron must use Form 8995-A regardless, so that path is inside the
 *   threshold refusal rather than beside it.
 *
 * @module
 */
import { assert, assertEq } from 'functionalscript/fjs/asserts/module.f.js'
import { of, multiply, halfUp } from '../types/rational/module.f.js'
import { centsFromString } from '../exact/module.f.js'
import { taxParamsByYear } from '../tax/params/module.f.js'

/** @import { TaxParamSet, IndividualFilingStatus } from '../tax/params/module.f.js' */

/**
 * A case this module will not compute — the same shape `fjs/schedule/c`,
 * `fjs/schedule/se` and `fjs/schedule/1` already return, so
 * `fjs/form1040/core` threads it through the error arm it already has. No
 * `unmodeled` field: these are document-data-sufficiency refusals
 * (12.1-CONTEXT.md Decision 2.6's category), never `fjs/return/scope` kinds.
 * @typedef {{ readonly kind: 'error', readonly message: string }} Form8995Refusal
 */

/**
 * Rounds `cents * (percent / 100)` to the nearest cent, ties away from zero —
 * printed lines 5, 9 and 14, all three of which multiply by §199A's ONE 20%.
 *
 * `ratePercent` rather than basis points because 20 is a whole number of
 * percent and `fjs/tax/params` stores it that way; see that module's own
 * {@link qualifiedBusinessIncomeDeduction} for the rule. Reimplemented here
 * rather than imported, per this project's "reimplement an idiom you cannot
 * import" precedent.
 * @type {(cents: bigint) => (percent: bigint) => bigint}
 */
const percentOfCents = cents => percent =>
    halfUp(multiply(of(cents)(1n))(of(percent)(100n)))

// ── The two named inputs this form does not compute for itself ───────────────

/**
 * **§199A(c)(1)'s qualified business income for one Schedule C**: the net
 * profit, REDUCED by the deductions attributable to the business that a
 * proprietor takes on Schedule 1 rather than on Schedule C.
 *
 * All three subtractions are written out, and two of them are permanently
 * zero — named rather than omitted, exactly as `fjs/schedule/1`'s
 * `studentLoanInterestPhaseoutIncome` names §221(b)(2)(C)'s three unreachable
 * exclusions. A reader has to be able to see WHICH reductions this engine
 * applies and which it merely has no figure for.
 *
 * Floored at zero, because §199A(c)(1) is a NET amount and a negative one is
 * not qualified business income but a §199A(c)(2) carryforward — and
 * `fjs/schedule/c` refuses a Schedule C loss before this function is ever
 * reached, so the floor is the printed line 4's rule rather than a live case.
 * @type {(input: { readonly netProfitCents: bigint, readonly deductibleHalfOfSelfEmploymentTaxCents: bigint }) => bigint}
 */
export const qualifiedBusinessIncome = input => {
    const { netProfitCents, deductibleHalfOfSelfEmploymentTaxCents } = input
    // Schedule 1 line 17. `selfEmployedHealthInsuranceDeduction` is an
    // `fjs/return/scope` refusal -- the Pub. 535 worksheet's §162(l)(2)(A)
    // cap needs facts this engine does not hold -- so it is permanently zero
    // here and NAMED so a reader can see the term exists.
    const selfEmployedHealthInsuranceDeductionCents = 0n
    // Schedule 1 line 16. `selfEmployedRetirementPlans` is an
    // `fjs/return/scope` refusal for the same shape of reason: Pub. 560's
    // limit depends on net self-employment earnings AND on a plan document
    // nothing here records.
    const selfEmployedRetirementPlanDeductionCents = 0n
    const net = netProfitCents
        - deductibleHalfOfSelfEmploymentTaxCents
        - selfEmployedHealthInsuranceDeductionCents
        - selfEmployedRetirementPlanDeductionCents
    return net > 0n ? net : 0n
}

/**
 * **Printed line 11's own quantity**: *"taxable income before qualified
 * business income deduction"*, which on the 2025 Form 1040 is
 * `line 11 − line 12 − line 13b`, floored at zero.
 *
 * NOT `line 11 − line 12`. See this module's own docstring: the 2025 face
 * splits the old single line 13 into 13a (this deduction) and 13b (Schedule
 * 1-A's additional deductions), and only 13a is the one line 11 must be
 * measured "before". Leaving 13b in would overstate this figure and, through
 * the 20% limitation on line 14, overstate the deduction for a senior with a
 * business.
 * @type {(input: { readonly adjustedGrossIncomeCents: bigint, readonly deductionCents: bigint, readonly additionalDeductionsCents: bigint }) => bigint}
 */
export const taxableIncomeBeforeQualifiedBusinessIncomeDeduction = input => {
    const { adjustedGrossIncomeCents, deductionCents, additionalDeductionsCents } = input
    const before = adjustedGrossIncomeCents - deductionCents - additionalDeductionsCents
    return before > 0n ? before : 0n
}

/**
 * **Printed line 12's own quantity**, net capital gain, transcribed from the
 * Form 8995 instructions' own definition: qualified dividends (1040 line 3a)
 * plus the smaller of Schedule D line 15 or line 16 — *"if either is blank or
 * a loss, enter -0-"* — or, for a filer without a Schedule D, 1040 line 7a.
 *
 * **This is the same rule the Qualified Dividends and Capital Gain Tax
 * Worksheet applies on its own lines 2 and 3**, and it is written here a
 * second time rather than imported because that one is a private `const`
 * inside `fjs/tax/line16/qdcgt`'s big transcription. `fjs/form1040/core`'s
 * `formEightNineNineFivesNetCapitalGainIsTheWorksheetsOwn` is the leaf that
 * COMPARES the two at the wiring layer, where both are in scope — AGENTS.md's
 * "a hand-typed list drifts unless something compares it to what it mirrors",
 * applied to a rule rather than a list.
 *
 * The "blank or a loss" guard is an EQUIVALENT MUTANT in the same way it is
 * there: the `min` below already returns zero when either amount is zero, so
 * `<= 0n` and `< 0n` cannot be told apart at any input. It is kept in the
 * shape the page prints, because a transcribed worksheet is diffed against
 * the page rather than minimised.
 * @type {(input: { readonly qualifiedDividendsCents: bigint, readonly filingScheduleD: boolean, readonly scheduleD15Cents: bigint, readonly scheduleD16Cents: bigint, readonly line7aCents: bigint }) => bigint}
 */
export const netCapitalGainLine12 = input => {
    const {
        qualifiedDividendsCents, filingScheduleD, scheduleD15Cents, scheduleD16Cents, line7aCents,
    } = input
    const longTerm = filingScheduleD
        ? (scheduleD15Cents <= 0n || scheduleD16Cents <= 0n
            ? 0n
            : (scheduleD15Cents < scheduleD16Cents ? scheduleD15Cents : scheduleD16Cents))
        : (line7aCents > 0n ? line7aCents : 0n)
    return qualifiedDividendsCents + longTerm
}

// ── The two refusals ─────────────────────────────────────────────────────────

/**
 * **Form 8995-A, and the two limitations it brings.** A real named function
 * for the form this engine does not have, returning the only honest answer it
 * can — the same shape, and for the same reason, as `fjs/schedule/c`'s
 * `atRiskDeterminationLine32` and `fjs/schedule/se`'s
 * {@link optionalMethodsPartII}.
 *
 * It fires only when there IS qualified business income: a filer with
 * $500,000 of wages and no business is above the threshold and has no §199A
 * deduction to compute either way, and refusing them would be a blanket
 * refusal of every high-income return. The comparison is at or below,
 * matching the printed instruction's own *"at or below"*.
 * @type {(taxParamSet: TaxParamSet) => (status: IndividualFilingStatus) => (input: { readonly qualifiedBusinessIncomeCents: bigint, readonly taxableIncomeBeforeQbiCents: bigint }) => Form8995Refusal | { readonly kind: 'ok' }}
 */
export const formEightNineNineFiveAIsUnmodeled = taxParamSet => status => input => {
    const { qualifiedBusinessIncomeCents, taxableIncomeBeforeQbiCents } = input
    const threshold = centsFromString(
        taxParamSet.qualifiedBusinessIncomeDeduction.thresholdAmount[status].amount)
    if (qualifiedBusinessIncomeCents === 0n || taxableIncomeBeforeQbiCents <= threshold) {
        return { kind: 'ok' }
    }
    return {
        kind: 'error',
        message: `Form 8995 line 11: taxable income before the qualified business income `
            + `deduction is ${taxableIncomeBeforeQbiCents} cents, above §199A(e)(2)'s `
            + `${taxParamSet.qualifiedBusinessIncomeDeduction.thresholdAmount[status].amount} `
            + `threshold for a ${status} return, so the SIMPLIFIED computation on Form 8995 does `
            + `not apply and Form 8995-A does. fjs/form8995a computes Form 8995-A (Phase 31), and `
            + `fjs/form1040/core routes to it, so reaching THIS refusal means the simplified `
            + `form was asked for directly at an income it does not cover. Two things on Form `
            + `8995-A decide the answer there, and neither is on this page. §199A(b)(2)(B) caps `
            + `the deduction at `
            + `the greater of 50% of the business's W-2 wages or 25% of those wages plus 2.5% of `
            + `the unadjusted basis immediately after acquisition of qualified property — a sole `
            + `proprietor with no employees has NO W-2 wages, so that cap bites hard, and UBIA is `
            + `the asset basis history Schedule C line 13 already refuses for. §199A(d)(3) then `
            + `phases the deduction out entirely for a SPECIFIED SERVICE trade or business `
            + `(health, law, accounting, consulting, athletics, financial services, or one whose `
            + `principal asset is the reputation or skill of its owners), and no printed line here `
            + `asks which this business is. Computing Form 8995 anyway would overstate the `
            + `deduction and understate the tax; computing 8995-A as though there were no wages `
            + `and no qualified property would overstate the tax. `
            + `vnd.fjs.business_expenses carries all three facts as assertions `
            + `(specifiedServiceTradeOrBusiness, w2Wages, `
            + `unadjustedBasisOfQualifiedProperty) and fjs/form8995a reads them`,
    }
}

/**
 * **§199A(c)(2)'s carryforward, unstated.** Printed line 3 subtracts a prior
 * year's negative net qualified business income from this year's, and this
 * engine holds one tax year.
 *
 * Absence cannot be read as zero, because that would OVERSTATE the deduction
 * — the founder with a year-one loss and a year-two profit is the canonical
 * §199A(c)(2) taxpayer. `vnd.fjs.business_expenses` carries the assertion, and
 * that dialect's own header argues why this differs from
 * `vnd.fjs.prior_year_capital_loss`, whose absence legitimately means none.
 *
 * Like {@link formEightNineNineFiveAIsUnmodeled}, it fires only when a
 * deduction would otherwise be computed — so a return with no business, or
 * one whose qualified business income is zero, is untouched.
 * @type {(input: { readonly qualifiedBusinessIncomeCents: bigint, readonly assertedCarryforward: string | undefined }) => Form8995Refusal | { readonly kind: 'ok' }}
 */
export const priorYearCarryforwardIsUnstated = input => {
    const { qualifiedBusinessIncomeCents, assertedCarryforward } = input
    if (qualifiedBusinessIncomeCents === 0n || assertedCarryforward !== undefined) {
        return { kind: 'ok' }
    }
    return {
        kind: 'error',
        message: 'Form 8995 line 3 (qualified business net loss carryforward from prior years): '
            + 'the business expenses record does not state one. §199A(c)(2) treats a year whose '
            + 'net qualified business income was negative as a LOSS carried into the succeeding '
            + 'year, where it reduces this deduction — and this engine holds one tax year, so it '
            + 'cannot know the figure. Reading an absent carryforward as zero would overstate '
            + 'the deduction and understate the tax, and the case is not exotic: a business with '
            + 'a loss in its first year and a profit in its second is exactly who §199A(c)(2) is '
            + 'written for. Set priorYearQualifiedBusinessLossCarryforward on the business '
            + 'expenses record — "0.00" is the assertion that there was none, and it is a '
            + 'different statement from leaving the field out',
    }
}

// ── The printed form ─────────────────────────────────────────────────────────

/**
 * Form 8995's seventeen printed lines. `line1i` is the single per-business row
 * this engine can fill; rows 1(ii)-1(v) have no field, because
 * `fjs/schedule/c` refuses a second business by name.
 * @typedef {{
 *   readonly line1i: bigint, readonly line2: bigint, readonly line3: bigint,
 *   readonly line4: bigint, readonly line5: bigint, readonly line6: bigint,
 *   readonly line7: bigint, readonly line8: bigint, readonly line9: bigint,
 *   readonly line10: bigint, readonly line11: bigint, readonly line12: bigint,
 *   readonly line13: bigint, readonly line14: bigint, readonly line15: bigint,
 *   readonly line16: bigint, readonly line17: bigint,
 * }} Form8995
 */

/**
 * @typedef {{
 *   readonly qualifiedBusinessIncomeCents: bigint,
 *   readonly priorYearLossCarryforwardCents: bigint,
 *   readonly taxableIncomeBeforeQbiCents: bigint,
 *   readonly netCapitalGainCents: bigint,
 *   readonly qualifiedReitDividendsCents: bigint,
 * }} Form8995Input
 */

/**
 * Fills in Form 8995 for one return. Every `const` below is one printed line,
 * in printed order, with the printed instruction quoted above it.
 * @type {(taxParamSet: TaxParamSet) => (input: Form8995Input) => Form8995}
 */
export const form8995 = taxParamSet => input => {
    const {
        qualifiedBusinessIncomeCents, priorYearLossCarryforwardCents,
        taxableIncomeBeforeQbiCents, netCapitalGainCents, qualifiedReitDividendsCents,
    } = input
    const rate = BigInt(taxParamSet.qualifiedBusinessIncomeDeduction.ratePercent)
    // 1(i)(c). "Qualified business income or (loss)" for the first trade or
    //          business. One row, because this engine computes one Schedule C
    //          and refuses a second by name.
    const line1i = qualifiedBusinessIncomeCents
    // 2. "Total qualified business income or (loss). Combine lines 1i through
    //    1v, column (c)."
    const line2 = line1i
    // 3. "Qualified business net (loss) carryforward from prior years." A
    //    SUBTRACTION -- the printed box is parenthesised -- and the stored
    //    assertion holds its magnitude, so the sign is applied here and only
    //    here. `vnd.fjs.business_expenses` refuses a negative value for
    //    exactly that reason.
    const line3 = -priorYearLossCarryforwardCents
    // 4. "Total qualified business income. Combine lines 2 and 3. If zero or
    //    less, enter -0-."
    const line4Combined = line2 + line3
    const line4 = line4Combined > 0n ? line4Combined : 0n
    // 5. "Qualified business income component. Multiply line 4 by 20% (0.20)."
    const line5 = percentOfCents(line4)(rate)
    // 6. "Qualified REIT dividends and publicly traded partnership (PTP)
    //    income or (loss)." The REIT half is Form 1099-DIV box 5 (§199A
    //    dividends), summed over every stored 1099-DIV by `fjs/form1040/core`
    //    and cited one Source per contributing document. The PTP half is a
    //    documented zero because it is REFUSED: PTP income arrives as
    //    Schedule K-1 box 20 code Z or box 17 code V, and `fjs/schedule/e`'s
    //    `section199AInformationRefusal` stops the whole return for either.
    //    A PTP LOSS -- the only thing that could make this line negative --
    //    is refused by the same guard, which is why line 7 below is a
    //    structural zero rather than an assertion.
    const qualifiedPubliclyTradedPartnershipIncomeCents = 0n
    const line6 = qualifiedReitDividendsCents + qualifiedPubliclyTradedPartnershipIncomeCents
    // 7. "Qualified REIT dividends and PTP (loss) carryforward from prior
    //    years." Zero, and NOT for the reason it was before line 6 acquired a
    //    reader. §199A(c)(2)'s one-tax-year argument would apply here exactly
    //    as it does to line 3, if line 6 could go negative. It cannot: box 5
    //    is a dividend and `vnd.fjs.1099div`'s money check rejects anything
    //    that is not an exact decimal amount, and the only other summand -- a
    //    qualified PTP loss -- is refused by name one module over. See this
    //    module's docstring; the day PTP income is wired is the day this line
    //    must become an assertion.
    const line7 = 0n
    // 8. "Total qualified REIT dividends and PTP income. Combine lines 6 and
    //    7. If zero or less, enter -0-."
    const line8Combined = line6 + line7
    const line8 = line8Combined > 0n ? line8Combined : 0n
    // 9. "REIT and PTP component. Multiply line 8 by 20% (0.20)."
    const line9 = percentOfCents(line8)(rate)
    // 10. "Qualified business income deduction before the income limitation.
    //     Add lines 5 and 9."
    const line10 = line5 + line9
    // 11. "Taxable income before qualified business income deduction." See
    //     {@link taxableIncomeBeforeQualifiedBusinessIncomeDeduction}, which
    //     is where the 2025 form's line 13b subtraction lives.
    const line11 = taxableIncomeBeforeQbiCents
    // 12. "Net capital gain." See {@link netCapitalGainLine12}.
    const line12 = netCapitalGainCents
    // 13. "Subtract line 12 from line 11. If zero or less, enter -0-."
    const line13Difference = line11 - line12
    const line13 = line13Difference > 0n ? line13Difference : 0n
    // 14. "Income limitation. Multiply line 13 by 20% (0.20)." THE LIMITATION,
    //     and for an ordinary sole proprietor with no other income it BINDS:
    //     the standard deduction has already come off line 11, so 20% of
    //     what is left is smaller than 20% of the business's own income.
    const line14 = percentOfCents(line13)(rate)
    // 15. "Qualified business income deduction. Enter the lesser of line 10
    //     or line 14." -> 1040 line 13a.
    //
    //     The printed line continues "...then add the DPAD under section
    //     199A(g) allocated from an agricultural or horticultural
    //     cooperative", which cannot arise here: a patron of such a
    //     cooperative must use Form 8995-A regardless of income, and that
    //     form is refused whole.
    const line15 = line10 < line14 ? line10 : line14
    // 16. "Total qualified business (loss) carryforward. Add lines 2 and 3.
    //     If greater than zero, enter -0-." What THIS year hands the next
    //     one, which this engine records rather than uses.
    const line16 = line4Combined < 0n ? line4Combined : 0n
    // 17. "Total qualified REIT dividends and PTP (loss) carryforward. Add
    //     lines 6 and 7. If greater than zero, enter -0-."
    const line17 = line8Combined < 0n ? line8Combined : 0n
    assert(line15 >= 0n, ['Form 8995 line 15 must never be negative', line15])
    return {
        line1i, line2, line3, line4, line5, line6, line7, line8, line9,
        line10, line11, line12, line13, line14, line15, line16, line17,
    }
}

// ── The whole computation, guards included ───────────────────────────────────

/** @typedef {{ readonly kind: 'ok', readonly form: Form8995 } | Form8995Refusal} QualifiedBusinessIncomeDeductionOutcome */

/**
 * @typedef {{
 *   readonly status: IndividualFilingStatus,
 *   readonly netProfitCents: bigint,
 *   readonly deductibleHalfOfSelfEmploymentTaxCents: bigint,
 *   readonly assertedPriorYearLossCarryforward: string | undefined,
 *   readonly taxableIncomeBeforeQbiCents: bigint,
 *   readonly netCapitalGainCents: bigint,
 *   readonly qualifiedReitDividendsCents: bigint,
 * }} QualifiedBusinessIncomeDeductionInput
 */

/**
 * The §199A deduction end to end: the QBI reduction, the two refusals, then
 * the printed form.
 *
 * The order of the two guards is the order they must run in. The
 * carryforward is checked FIRST because it changes line 4 and therefore the
 * deduction itself, while the threshold check reads only line 11 — so a
 * return that is missing the assertion AND above the threshold is told about
 * the assertion, which is the one a taxpayer can act on today.
 * @type {(taxParamSet: TaxParamSet) => (input: QualifiedBusinessIncomeDeductionInput) => QualifiedBusinessIncomeDeductionOutcome}
 */
export const qualifiedBusinessIncomeDeduction = taxParamSet => input => {
    const {
        status, netProfitCents, deductibleHalfOfSelfEmploymentTaxCents,
        assertedPriorYearLossCarryforward, taxableIncomeBeforeQbiCents, netCapitalGainCents,
        qualifiedReitDividendsCents,
    } = input
    const qualifiedBusinessIncomeCents = qualifiedBusinessIncome({
        netProfitCents, deductibleHalfOfSelfEmploymentTaxCents,
    })
    const carryforward = priorYearCarryforwardIsUnstated({
        qualifiedBusinessIncomeCents,
        assertedCarryforward: assertedPriorYearLossCarryforward,
    })
    if (carryforward.kind === 'error') {
        return carryforward
    }
    const aboveThreshold = formEightNineNineFiveAIsUnmodeled(taxParamSet)(status)({
        qualifiedBusinessIncomeCents, taxableIncomeBeforeQbiCents,
    })
    if (aboveThreshold.kind === 'error') {
        return aboveThreshold
    }
    return {
        kind: 'ok',
        form: form8995(taxParamSet)({
            qualifiedBusinessIncomeCents,
            priorYearLossCarryforwardCents: assertedPriorYearLossCarryforward === undefined
                ? 0n
                : centsFromString(assertedPriorYearLossCarryforward),
            taxableIncomeBeforeQbiCents,
            netCapitalGainCents,
            qualifiedReitDividendsCents,
        }),
    }
}

// ── Tests ────────────────────────────────────────────────────────────────────

/** TY2025's parameter set, narrowed exactly ONCE at module scope. */
const taxParams2025 = taxParamsByYear[2025]
assert(taxParams2025 !== undefined, 'expected TY2025 parameters to be present in taxParamsByYear')

/**
 * Hand-typed off the statute and the printed page, in CENTS — never read from
 * `fjs/tax/params`, so a boundary proof whose boundary came from the code
 * under test cannot exist. `fjs/tax/params` pins the same figures against
 * §199A(e)(2) independently, and both must agree.
 */
const printedThresholdCents = 19730000n
/** The joint threshold, §199A(e)(2)(A)'s "200 percent of such amount". */
const printedJointThresholdCents = 39460000n

/** Runs the whole computation against TY2025's real parameter set.
 * @type {(input: QualifiedBusinessIncomeDeductionInput) => QualifiedBusinessIncomeDeductionOutcome}
 */
const run = input => qualifiedBusinessIncomeDeduction(taxParams2025)(input)

/** A single filer with a business and nothing else, asserting no
 * carryforward — the base every fixture below widens.
 * @type {QualifiedBusinessIncomeDeductionInput}
 */
const soleProprietor = {
    status: 'single',
    netProfitCents: 0n,
    deductibleHalfOfSelfEmploymentTaxCents: 0n,
    assertedPriorYearLossCarryforward: '0.00',
    taxableIncomeBeforeQbiCents: 0n,
    netCapitalGainCents: 0n,
    qualifiedReitDividendsCents: 0n,
}

/** Narrows an outcome to its OK arm, throwing (never casting).
 * @type {(outcome: QualifiedBusinessIncomeDeductionOutcome) => Form8995}
 */
const ok = outcome => {
    assert(outcome.kind === 'ok', ['expected a computed Form 8995', outcome])
    return outcome.form
}

/** Narrows an outcome to its refusal arm, throwing (never casting).
 * @type {(outcome: QualifiedBusinessIncomeDeductionOutcome) => Form8995Refusal}
 */
const refusal = outcome => {
    assert(outcome.kind === 'error', ['expected a refusal', outcome])
    return outcome
}

export const proof = {
    qualifiedBusinessIncome: {
        // **THE REDUCTION EVERYBODY MISSES**, priced. A $50,000.00 net profit
        // with $3,532.39 of deductible self-employment tax gives $46,467.61
        // of qualified business income, not $50,000.00 — and 20% of the
        // difference is $706.48 of deduction that is not allowed.
        theDeductibleHalfOfSelfEmploymentTaxReducesIt: () => {
            assertEq(
                qualifiedBusinessIncome({
                    netProfitCents: 5000000n,
                    deductibleHalfOfSelfEmploymentTaxCents: 353239n,
                }),
                4646761n,
                '$50,000.00 - $3,532.39 = $46,467.61',
            )
            // The unreduced figure, asserted to DIFFER: without this half a
            // function that ignored the reduction entirely would pass any
            // fixture whose deductible half happened to be zero.
            assertEq(5000000n - 4646761n, 353239n, 'the reduction is the whole deductible half')
            // 20% of $3,532.39 is $706.48 of deduction the reduction removes.
            assertEq(353239n * 20n / 100n, 70647n, 'and about $706.48 of deduction with it')
        },
        // The two permanently-zero terms are NAMED in the function rather
        // than omitted, and this leaf is what says the arithmetic is the
        // three-term one: with a zero deductible half the answer is the net
        // profit exactly, which is only true because the other two terms are
        // zero rather than absent.
        theOtherTwoReductionsAreZeroRatherThanAbsent: () => {
            assertEq(
                qualifiedBusinessIncome({
                    netProfitCents: 5000000n,
                    deductibleHalfOfSelfEmploymentTaxCents: 0n,
                }),
                5000000n,
                'health insurance and retirement contributions both refuse, so both are $0.00',
            )
        },
        // Floored at zero: §199A(c)(1) is a NET amount, and a negative one is
        // a §199A(c)(2) carryforward rather than negative QBI. Unreachable
        // through the product path -- `fjs/schedule/c` refuses a loss -- so
        // this is the printed rule implemented rather than a live case.
        aNetNegativeFloorsAtZero: () => {
            assertEq(
                qualifiedBusinessIncome({
                    netProfitCents: 10000n,
                    deductibleHalfOfSelfEmploymentTaxCents: 50000n,
                }),
                0n,
            )
        },
    },

    taxableIncomeBeforeTheDeduction: {
        // **THE 2025 FORM'S OWN SUBTRACTION**, and the trap: line 13b comes
        // OFF, line 13a does not. A senior with a business, $60,000.00 of
        // AGI, the $15,750.00 single standard deduction and a $6,000.00
        // Schedule 1-A senior deduction has $38,250.00 of taxable income
        // before §199A — not $44,250.00.
        //
        // The difference is 20% of $6,000.00 = $1,200.00 of income
        // limitation, which is real money on exactly the return OBBBA's
        // senior deduction was written for.
        theSeniorDeductionComesOffBeforeSectionOneNineNineA: () => {
            assertEq(
                taxableIncomeBeforeQualifiedBusinessIncomeDeduction({
                    adjustedGrossIncomeCents: 6000000n,
                    deductionCents: 1575000n,
                    additionalDeductionsCents: 600000n,
                }),
                3825000n,
                '$60,000.00 - $15,750.00 - $6,000.00 = $38,250.00',
            )
            // The wrong answer, hand-computed and asserted to differ.
            assertEq(6000000n - 1575000n, 4425000n, 'leaving line 13b in would give $44,250.00')
            assertEq(4425000n - 3825000n, 600000n, '$6,000.00 apart, and 20% of it is $1,200.00')
        },
        // Floored at zero -- a deduction larger than AGI is not negative
        // taxable income, and 20% of a negative would be a negative
        // limitation that made line 15 negative.
        aDeductionLargerThanAgiFloorsAtZero: () => {
            assertEq(
                taxableIncomeBeforeQualifiedBusinessIncomeDeduction({
                    adjustedGrossIncomeCents: 100000n,
                    deductionCents: 1575000n,
                    additionalDeductionsCents: 0n,
                }),
                0n,
            )
        },
    },

    netCapitalGain: {
        // Qualified dividends PLUS the smaller of Schedule D lines 15 and 16.
        // $300.00 of qualified dividends and a $1,000.00/$1,500.00 pair gives
        // $1,300.00 -- hand-added, and the pair is unequal so a `min` written
        // the wrong way round lands on $1,800.00.
        qualifiedDividendsPlusTheSmallerOfTheTwoScheduleDLines: () => {
            assertEq(
                netCapitalGainLine12({
                    qualifiedDividendsCents: 30000n,
                    filingScheduleD: true,
                    scheduleD15Cents: 100000n,
                    scheduleD16Cents: 150000n,
                    line7aCents: 150000n,
                }),
                130000n,
                '$300.00 + min($1,000.00, $1,500.00) = $1,300.00',
            )
        },
        // A LOSS on either Schedule D line enters -0-, so a capital loss
        // cannot INCREASE the §199A income limitation by making line 13
        // larger than line 11.
        aScheduleDLossEntersZero: () => {
            assertEq(
                netCapitalGainLine12({
                    qualifiedDividendsCents: 30000n,
                    filingScheduleD: true,
                    scheduleD15Cents: -300000n,
                    scheduleD16Cents: 150000n,
                    line7aCents: 0n,
                }),
                30000n,
                'the qualified dividends alone',
            )
        },
        // Without a Schedule D, line 7a is the whole long-term figure -- a
        // 1099-DIV box 2a capital gain distribution, which is long-term by
        // statute.
        withoutAScheduleDItIsLineSevenA: () => {
            assertEq(
                netCapitalGainLine12({
                    qualifiedDividendsCents: 30000n,
                    filingScheduleD: false,
                    scheduleD15Cents: 999999n,
                    scheduleD16Cents: 999999n,
                    line7aCents: 40000n,
                }),
                70000n,
                '$300.00 + $400.00 = $700.00, and the Schedule D figures are not read at all',
            )
        },
    },

    // THE WORKED SOLE-PROPRIETOR RETURN, hand-derived end to end, and the
    // case where the INCOME LIMITATION binds -- which is the ordinary case
    // for a proprietor with no other income, not an edge case.
    //
    //   net profit                                        $50,000.00
    //   deductible half of self-employment tax             $3,532.39
    //   QBI  50,000.00 - 3,532.39                         $46,467.61
    //   line 4  = QBI (no carryforward)                   $46,467.61
    //   line 5  20% of 4,646,761 = 929,352.2 -> 929,352    $9,293.52
    //   line 10 = line 5                                   $9,293.52
    //   line 11 AGI 46,467.61 less 15,750.00 deduction    $30,717.61
    //   line 12 no capital gain                                $0.00
    //   line 13 = line 11                                 $30,717.61
    //   line 14 20% of 3,071,761 = 614,352.2 -> 614,352    $6,143.52
    //   line 15 lesser of 9,293.52 and 6,143.52            $6,143.52
    //
    // AGI is $46,467.61 rather than $50,000.00 because Schedule 1 line 15
    // has already come off it -- the same $3,532.39 that reduced QBI, doing
    // its OTHER job. Both uses are real and neither is a double count.
    theIncomeLimitationBindsForAnOrdinarySoleProprietor: () => {
        const form = ok(run({
            ...soleProprietor,
            netProfitCents: 5000000n,
            deductibleHalfOfSelfEmploymentTaxCents: 353239n,
            taxableIncomeBeforeQbiCents: 3071761n,
        }))
        assertEq(form.line1i, 4646761n, 'line 1(i)(c) = $46,467.61 of QBI')
        assertEq(form.line2, 4646761n, 'line 2 restates it')
        assertEq(form.line3, 0n, 'line 3 = $0.00, an ASSERTED absence of carryforward')
        assertEq(form.line4, 4646761n, 'line 4 = $46,467.61')
        assertEq(form.line5, 929352n, 'line 5 = $9,293.52 = 20% of $46,467.61')
        assertEq(form.line10, 929352n, 'line 10 = $9,293.52 (nothing from REITs or PTPs)')
        assertEq(form.line11, 3071761n, 'line 11 = $30,717.61 of taxable income before §199A')
        assertEq(form.line12, 0n, 'line 12 = $0.00')
        assertEq(form.line13, 3071761n, 'line 13 = $30,717.61')
        assertEq(form.line14, 614352n, 'line 14 = $6,143.52 = 20% of $30,717.61')
        assertEq(form.line15, 614352n, 'line 15 = $6,143.52 -> 1040 line 13a, the LESSER')
        // …and the limitation really is what chose it: line 10 is larger.
        assert(form.line10 > form.line14, ['the income limitation must bind here', form.line10, form.line14])
        assertEq(form.line10 - form.line15, 315000n, '$3,150.00 of deduction the limitation removes')
    },

    // THE OTHER SIDE OF THE `min`, so line 15 is a comparison rather than a
    // second name for line 14. A filer with a SMALL business and a large
    // salary: $10,000.00 of QBI against $120,000.00 of taxable income means
    // 20% of the QBI ($2,000.00) is the smaller, and the limitation does not
    // bind.
    theQbiComponentWinsWhenTaxableIncomeIsLarge: () => {
        const form = ok(run({
            ...soleProprietor,
            netProfitCents: 1000000n,
            deductibleHalfOfSelfEmploymentTaxCents: 0n,
            taxableIncomeBeforeQbiCents: 12000000n,
        }))
        assertEq(form.line10, 200000n, 'line 10 = $2,000.00 = 20% of $10,000.00')
        assertEq(form.line14, 2400000n, 'line 14 = $24,000.00 = 20% of $120,000.00')
        assertEq(form.line15, 200000n, 'line 15 = $2,000.00, the lesser')
        assert(form.line14 > form.line10, 'and the limitation does NOT bind here')
    },

    // NET CAPITAL GAIN comes OFF line 11 before the 20% is taken, and it can
    // change the answer. The same $120,000.00 of taxable income, but
    // $110,000.00 of it is net capital gain: line 13 falls to $10,000.00,
    // line 14 to $2,000.00, and the two sides of the `min` are now EQUAL --
    // one dollar more of capital gain and the limitation binds.
    netCapitalGainReducesTheIncomeLimitation: () => {
        const form = ok(run({
            ...soleProprietor,
            netProfitCents: 1000000n,
            deductibleHalfOfSelfEmploymentTaxCents: 0n,
            taxableIncomeBeforeQbiCents: 12000000n,
            netCapitalGainCents: 11000000n,
        }))
        assertEq(form.line12, 11000000n, 'line 12 = $110,000.00')
        assertEq(form.line13, 1000000n, 'line 13 = $10,000.00')
        assertEq(form.line14, 200000n, 'line 14 = $2,000.00')
        assertEq(form.line15, 200000n, 'line 15 = $2,000.00')
        const more = ok(run({
            ...soleProprietor,
            netProfitCents: 1000000n,
            deductibleHalfOfSelfEmploymentTaxCents: 0n,
            taxableIncomeBeforeQbiCents: 12000000n,
            netCapitalGainCents: 11500000n,
        }))
        assertEq(more.line13, 500000n, 'line 13 = $5,000.00')
        assertEq(more.line15, 100000n, 'line 15 = $1,000.00 -- the limitation now binds')
    },

    carryforward: {
        // A REAL carryforward reduces the deduction, and the arithmetic is
        // the printed page's: line 3 is NEGATIVE even though the stored
        // assertion holds a non-negative magnitude. $46,467.61 of QBI less an
        // $18,400.00 carryforward is $28,067.61, and 20% of it is $5,613.52.
        aPriorYearLossReducesThisYearsDeduction: () => {
            const form = ok(run({
                ...soleProprietor,
                netProfitCents: 5000000n,
                deductibleHalfOfSelfEmploymentTaxCents: 353239n,
                assertedPriorYearLossCarryforward: '18400.00',
                taxableIncomeBeforeQbiCents: 12000000n,
            }))
            assertEq(form.line2, 4646761n, 'line 2 = $46,467.61')
            assertEq(form.line3, -1840000n, 'line 3 = -$18,400.00, negated HERE and only here')
            assertEq(form.line4, 2806761n, 'line 4 = $28,067.61')
            assertEq(form.line5, 561352n, 'line 5 = $5,613.52 = 20% of $28,067.61, half-up from 561,352.2')
            assertEq(form.line15, 561352n, 'line 15 = $5,613.52')
            // …and the answer WITHOUT the carryforward, so the reduction is
            // observable rather than merely present.
            const none = ok(run({
                ...soleProprietor,
                netProfitCents: 5000000n,
                deductibleHalfOfSelfEmploymentTaxCents: 353239n,
                taxableIncomeBeforeQbiCents: 12000000n,
            }))
            assertEq(none.line15, 929352n, 'without it, $9,293.52')
            assertEq(none.line15 - form.line15, 368000n, '$3,680.00 = 20% of $18,400.00')
        },
        // A carryforward LARGER than this year's QBI floors line 4 at zero
        // and carries the remainder forward again on line 16 -- which is what
        // that line is for, and the only place this engine records a figure
        // for a future year at all.
        aCarryforwardLargerThanThisYearsIncomeFloorsAndRecarries: () => {
            const form = ok(run({
                ...soleProprietor,
                netProfitCents: 5000000n,
                deductibleHalfOfSelfEmploymentTaxCents: 0n,
                assertedPriorYearLossCarryforward: '80000.00',
                taxableIncomeBeforeQbiCents: 12000000n,
            }))
            assertEq(form.line4, 0n, 'line 4 = $0.00, floored')
            assertEq(form.line15, 0n, 'no deduction at all this year')
            assertEq(form.line16, -3000000n, 'line 16 = -$30,000.00 carried into next year')
        },
        // Line 16 is -0- when there is no loss to carry, so a profitable year
        // does not hand the next one a phantom figure. The printed rule is
        // "if greater than zero, enter -0-", which is the opposite floor from
        // line 4's and the one a transcription is most likely to invert.
        lineSixteenIsZeroWhenThereIsNoLossToCarry: () => {
            const form = ok(run({
                ...soleProprietor,
                netProfitCents: 5000000n,
                deductibleHalfOfSelfEmploymentTaxCents: 0n,
                taxableIncomeBeforeQbiCents: 12000000n,
            }))
            assert(form.line4 > 0n, 'the control: line 4 is a real positive amount')
            assertEq(form.line16, 0n, 'line 16 = $0.00, not $50,000.00')
            assertEq(form.line17, 0n, 'and line 17 likewise')
        },
        // **THE ASSERTION IS REQUIRED**, and its absence refuses by name.
        anUnstatedCarryforwardRefusesNamingTheFieldAndTheSection: () => {
            const result = refusal(run({
                ...soleProprietor,
                netProfitCents: 5000000n,
                deductibleHalfOfSelfEmploymentTaxCents: 353239n,
                assertedPriorYearLossCarryforward: undefined,
                taxableIncomeBeforeQbiCents: 12000000n,
            }))
            assert(result.message.includes('§199A(c)(2)'), ['must name the section', result.message])
            assert(result.message.includes('line 3'), ['must name the printed line', result.message])
            assert(
                result.message.includes('priorYearQualifiedBusinessLossCarryforward'),
                ['must name the field that fixes it', result.message])
            assert(
                result.message.includes('"0.00"'),
                ['must say how to assert that there was none', result.message])
            assert(
                result.message.includes('understate the tax'),
                ['must say which direction the error would run', result.message])
        },
        // THE CONTROL, and it is the one that keeps the guard from being a
        // blanket refusal: an absent assertion on a return with NO qualified
        // business income computes, because there is no deduction for a
        // carryforward to reduce. That is every return without a business.
        anUnstatedCarryforwardWithNoBusinessIncomeComputes: () => {
            const form = ok(run({ ...soleProprietor, assertedPriorYearLossCarryforward: undefined }))
            assertEq(form.line15, 0n, 'no business, no deduction, no refusal')
        },
        // …and the second control: `'0.00'` is a real assertion and computes,
        // which is what makes the refusal above about the field being ABSENT
        // rather than about its value.
        anExplicitZeroComputes: () => {
            const form = ok(run({
                ...soleProprietor,
                netProfitCents: 5000000n,
                deductibleHalfOfSelfEmploymentTaxCents: 353239n,
                assertedPriorYearLossCarryforward: '0.00',
                taxableIncomeBeforeQbiCents: 12000000n,
            }))
            assertEq(form.line3, 0n)
            assertEq(form.line15, 929352n, '$9,293.52')
        },
    },

    threshold: {
        // THE BOUNDARY PAIR, one cent apart, against a hand-typed
        // §199A(e)(2) threshold. EXACTLY at $197,300.00 the simplified form
        // still applies -- the printed instruction says "at or below" -- and
        // one cent above it, Form 8995-A does and this engine refuses.
        theBoundaryPairIsAtOrBelow: () => {
            const at = ok(run({
                ...soleProprietor,
                netProfitCents: 5000000n,
                taxableIncomeBeforeQbiCents: printedThresholdCents,
            }))
            assertEq(at.line11, printedThresholdCents, 'exactly at the threshold computes')
            assertEq(at.line15, 1000000n, 'line 15 = $10,000.00 = 20% of $50,000.00')
            const above = refusal(run({
                ...soleProprietor,
                netProfitCents: 5000000n,
                taxableIncomeBeforeQbiCents: printedThresholdCents + 1n,
            }))
            assert(above.message.includes('8995-A'), ['must name the form that applies', above.message])
        },
        // The refusal names BOTH limitations and the fact that a sole
        // proprietor has no W-2 wages -- a message naming only "Form 8995-A"
        // would tell a reader nothing they can act on, and one naming only
        // the SSTB question would suggest that answering it is enough.
        theRefusalNamesBothLimitationsAndTheDirectionOfEachError: () => {
            const result = refusal(run({
                ...soleProprietor,
                netProfitCents: 30000000n,
                taxableIncomeBeforeQbiCents: 25000000n,
            }))
            assert(result.message.includes('§199A(b)(2)(B)'), ['the wage/UBIA cap', result.message])
            assert(result.message.includes('§199A(d)(3)'), ['the SSTB phase-out', result.message])
            assert(result.message.includes('50%'), ['the wage percentage', result.message])
            assert(result.message.includes('2.5%'), ['the UBIA percentage', result.message])
            assert(
                result.message.includes('no employees has NO W-2 wages'),
                ['must say why the cap bites for this taxpayer', result.message])
            assert(
                result.message.includes('overstate the deduction')
                    && result.message.includes('overstate the tax'),
                ['must name BOTH directions the error could run', result.message])
            assert(
                result.message.includes('25000000'),
                ['must quote the taxable income it is refusing', result.message])
        },
        // **THE CONTROL THAT MATTERS MOST**: a filer far above the threshold
        // with NO qualified business income computes, and their line 13a is
        // $0.00. Without this, the refusal above would break every
        // high-income return in the engine -- a $500,000 wage earner has no
        // §199A deduction and never needed Form 8995 at all.
        aHighIncomeReturnWithNoBusinessIsUntouched: () => {
            const form = ok(run({
                ...soleProprietor,
                netProfitCents: 0n,
                taxableIncomeBeforeQbiCents: 50000000n,
            }))
            assertEq(form.line15, 0n, '$500,000.00 of taxable income and no deduction, no refusal')
        },
        // Each status reads its OWN threshold, against hand-typed cents. The
        // joint figure is DOUBLE and every other status gets the general
        // one — including a qualifying surviving spouse, whose own 24%
        // bracket ceiling is the joint $394,600 and whose §199A threshold is
        // NOT. Same taxable income, two answers.
        aQualifyingSurvivingSpouseDoesNotGetTheJointThreshold: () => {
            /** @type {(status: IndividualFilingStatus) => QualifiedBusinessIncomeDeductionOutcome} */
            const at250k = status => run({
                ...soleProprietor,
                status,
                netProfitCents: 5000000n,
                taxableIncomeBeforeQbiCents: 25000000n,
            })
            assertEq(at250k('marriedFilingJointly').kind, 'ok', '$250,000 is below the joint $394,600')
            assertEq(at250k('qualifyingSurvivingSpouse').kind, 'error', 'and above the general $197,300')
            assertEq(at250k('single').kind, 'error')
            assertEq(at250k('marriedFilingSeparately').kind, 'error')
            assertEq(at250k('headOfHousehold').kind, 'error')
            // …and the joint boundary is where the hand-typed figure says.
            assertEq(
                run({
                    ...soleProprietor,
                    status: 'marriedFilingJointly',
                    netProfitCents: 5000000n,
                    taxableIncomeBeforeQbiCents: printedJointThresholdCents,
                }).kind,
                'ok')
            assertEq(
                run({
                    ...soleProprietor,
                    status: 'marriedFilingJointly',
                    netProfitCents: 5000000n,
                    taxableIncomeBeforeQbiCents: printedJointThresholdCents + 1n,
                }).kind,
                'error')
        },
        // The hand-typed thresholds above must be the SAME figures
        // `fjs/tax/params` stores. Its own leaf, so a disagreement names
        // itself rather than surfacing as a confusing pair of boundary
        // failures — `fjs/return/tripwire`'s idiom, one form over.
        theHandTypedThresholdsAgreeWithTheStoredParameters: () => {
            assertEq(
                taxParams2025.qualifiedBusinessIncomeDeduction.thresholdAmount.single.amount,
                '197300.00')
            assertEq(
                taxParams2025.qualifiedBusinessIncomeDeduction.thresholdAmount.marriedFilingJointly.amount,
                '394600.00')
            assertEq(centsFromString('197300.00'), printedThresholdCents)
            assertEq(centsFromString('394600.00'), printedJointThresholdCents)
            assertEq(taxParams2025.qualifiedBusinessIncomeDeduction.ratePercent, 20)
        },
    },

    reitAndPtp: {
        // **THE RETIREE WITH A REIT INDEX FUND AND NO BUSINESS.** §199A(b)(1)(B)
        // is a component of its own: $1,000.00 of Form 1099-DIV box 5 gives
        // $200.00 of deduction on a return whose line 1(i) is empty. Every
        // figure hand-typed.
        //
        //   line 6   box 5, §199A dividends                   $1,000.00
        //   line 8   6 + 7, floored                           $1,000.00
        //   line 9   20% of 100,000                             $200.00
        //   line 10  line 5 ($0.00) + line 9                    $200.00
        //   line 11  taxable income before §199A              $49,250.00
        //   line 14  20% of 4,925,000                         $9,850.00
        //   line 15  the LESSER                                 $200.00
        aReitDividendWithNoBusinessAtAllProducesADeduction: () => {
            const form = ok(run({
                ...soleProprietor,
                qualifiedReitDividendsCents: 100000n,
                taxableIncomeBeforeQbiCents: 4925000n,
            }))
            assertEq(form.line1i, 0n, 'no trade or business at all')
            assertEq(form.line5, 0n, 'and therefore no qualified business income component')
            assertEq(form.line6, 100000n, 'line 6 = $1,000.00 of qualified REIT dividends')
            assertEq(form.line8, 100000n, 'line 8 = $1,000.00')
            assertEq(form.line9, 20000n, 'line 9 = $200.00 = 20% of $1,000.00')
            assertEq(form.line10, 20000n, 'line 10 = $200.00, the REIT component alone')
            assertEq(form.line14, 985000n, 'line 14 = $9,850.00 = 20% of $49,250.00')
            assertEq(form.line15, 20000n, 'line 15 = $200.00 -> 1040 line 13a')
            // …and THE CONTROL: the identical return without the box.
            assertEq(
                ok(run({ ...soleProprietor, taxableIncomeBeforeQbiCents: 4925000n })).line15,
                0n,
                'without box 5 there is no deduction at all')
        },
        // **BOTH COMPONENTS, ADDED ON LINE 10.** The founder of
        // `theIncomeLimitationBindsForAnOrdinarySoleProprietor` who also holds
        // a REIT fund: $9,293.52 from line 5 and $200.00 from line 9. Each
        // half asserted separately, so a wiring that dropped either one is
        // visible rather than absorbed by the sum.
        theTwoComponentsAreAddedOnLineTen: () => {
            const form = ok(run({
                ...soleProprietor,
                netProfitCents: 5000000n,
                deductibleHalfOfSelfEmploymentTaxCents: 353239n,
                qualifiedReitDividendsCents: 100000n,
                taxableIncomeBeforeQbiCents: 12000000n,
            }))
            assertEq(form.line5, 929352n, 'line 5 = $9,293.52, the QBI component')
            assertEq(form.line9, 20000n, 'line 9 = $200.00, the REIT component')
            assertEq(form.line10, 949352n, 'line 10 = $9,493.52 = $9,293.52 + $200.00')
            assertEq(form.line14, 2400000n, 'line 14 = $24,000.00, and it does not bind')
            assertEq(form.line15, 949352n, 'line 15 = $9,493.52')
            // …and the same return WITHOUT the dividend, so the $200.00 is
            // observable rather than merely present.
            const none = ok(run({
                ...soleProprietor,
                netProfitCents: 5000000n,
                deductibleHalfOfSelfEmploymentTaxCents: 353239n,
                taxableIncomeBeforeQbiCents: 12000000n,
            }))
            assertEq(none.line15, 929352n, 'without it, $9,293.52')
            assertEq(form.line15 - none.line15, 20000n, 'exactly 20% of the $1,000.00 dividend')
        },
        // §199A(a)(1)(B)'s income limitation caps the COMBINED figure, so a
        // REIT dividend does not escape line 14 — it escapes the wage/UBIA
        // limitation, which is a different thing and lives on Form 8995-A.
        // $500.00 of taxable income before §199A allows $100.00 of deduction
        // against a $200.00 REIT component.
        theIncomeLimitationStillCapsTheReitComponent: () => {
            const form = ok(run({
                ...soleProprietor,
                qualifiedReitDividendsCents: 100000n,
                taxableIncomeBeforeQbiCents: 50000n,
            }))
            assertEq(form.line10, 20000n, 'line 10 = $200.00')
            assertEq(form.line14, 10000n, 'line 14 = $100.00 = 20% of $500.00')
            assertEq(form.line15, 10000n, 'line 15 = $100.00, the LESSER')
            assert(form.line10 > form.line14, ['the limitation must bind here', form.line10, form.line14])
        },
        // **THE PTP HALF IS STILL ZERO**, and line 6 says so arithmetically:
        // it equals the REIT input exactly, with nothing added. Line 7 and
        // line 17 stay zero for the reason the module docstring gives — a
        // qualified PTP LOSS is the only thing that could make either
        // nonzero, and `fjs/schedule/e` refuses the K-1 that would carry it.
        thePtpHalfContributesNothingAndNothingCarriesForward: () => {
            const form = ok(run({
                ...soleProprietor,
                qualifiedReitDividendsCents: 314159n,
                taxableIncomeBeforeQbiCents: 12000000n,
            }))
            assertEq(form.line6, 314159n, 'line 6 is the REIT dividend and NOTHING else')
            assertEq(form.line7, 0n, 'line 7 = $0.00, a structural zero')
            assertEq(form.line8, 314159n, 'line 8 = $3,141.59')
            assertEq(form.line17, 0n, 'line 17 = $0.00 -- nothing carries into next year')
            // The printed rule on line 17 is "if greater than zero, enter
            // -0-", the OPPOSITE floor from line 8's, and the one a
            // transcription is likeliest to invert. Line 8 is positive here,
            // so a transcription that shared line 8's floor would print
            // $3,141.59 on line 17.
            assert(form.line8 > 0n, 'the control: line 8 is a real positive amount')
        },
        // A return with no 1099-DIV box 5 at all keeps the zeros it always
        // had, asserted at a REALISTIC business input rather than at zero —
        // where "zero because the input was zero" and "zero because the lines
        // were unreachable" would be indistinguishable.
        withoutBoxFiveTheComponentIsZeroAndLineTenStillAdds: () => {
            const form = ok(run({
                ...soleProprietor,
                netProfitCents: 5000000n,
                taxableIncomeBeforeQbiCents: 12000000n,
            }))
            assertEq(form.line6, 0n, 'line 6 = $0.00 -- no 1099-DIV reported box 5')
            assertEq(form.line8, 0n, 'line 8 = $0.00')
            assertEq(form.line9, 0n, 'line 9 = $0.00')
            assertEq(form.line10, form.line5 + form.line9, 'line 10 adds BOTH components')
            assert(form.line5 > 0n, 'the control: line 5 is a real amount, so the sum is observable')
        },
    },

    // Hand-typed line-count guard, this project's mutation-gate idiom: a line
    // dropped from the returned record fails here even though every leaf
    // above reads only the lines it names. Lines 1(i), 2-17 — seventeen,
    // which is exactly the printed page with none missing. Rows 1(ii)-1(v)
    // are NOT among them: `fjs/schedule/c` refuses a second business, so
    // there is never a second row to fill.
    everyPrintedLineIsNamed: () => {
        const form = ok(run({
            ...soleProprietor,
            netProfitCents: 5000000n,
            taxableIncomeBeforeQbiCents: 12000000n,
        }))
        const expectedFieldCount = 17
        assertEq(
            Object.keys(form).length,
            expectedFieldCount,
            ['expected exactly 17 named Form 8995 fields', Object.keys(form)],
        )
    },

    // A return with no business at all: every line zero, and no refusal. The
    // degenerate input, and the statement that this form cannot invent a
    // deduction out of nothing.
    noBusinessIsZeroEverywhere: () => {
        const form = ok(run(soleProprietor))
        assertEq(form.line15, 0n, 'no deduction')
        assertEq(form.line10, 0n)
        assertEq(form.line16, 0n, 'and nothing carried into next year')
    },
}
