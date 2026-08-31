/**
 * Form 6251 — TAX-33: the Alternative Minimum Tax, Part I (alternative minimum
 * taxable income, lines 1a-4) and Part II (the tax itself, lines 5-11), landing
 * on **Schedule 2 line 2** and thence 1040 line 17.
 *
 * Sources, fetched and read directly (2026-08-16), not from recall:
 * - `https://www.irs.gov/pub/irs-pdf/f6251.pdf` — the 2025 form, "Created
 *   9/17/25", both pages. Every printed line below is transcribed from it.
 * - `https://www.irs.gov/pub/irs-pdf/i6251.pdf` — the 2025 instructions,
 *   `Jan 8, 2026`, for the Exemption Worksheet, the line 2i example, the
 *   married-filing-separately line 4 add-back, and the line 10 composition.
 * - `https://www.irs.gov/pub/irs-drop/rp-24-40.pdf` §2.11 for the dollar
 *   figures, which live in `fjs/tax/params` with their own citations and
 *   appear here only as lookups.
 *
 * ## It lands on line 2, not line 1, and that had to be checked
 *
 * Every AMT reference outside this repository, and this phase's own brief,
 * says *"Schedule 2 line 1"*. That was true through TY2024. The TY2025
 * Schedule 2, fetched and read on 2026-08-16, prints **line 1 as "Additions to
 * tax"** with lettered sub-lines 1a-1z (excess advance premium tax credit
 * repayment, the two clean-vehicle-credit repayments, the EPE recapture
 * lines), **line 2 as "Alternative minimum tax. Attach Form 6251"**, and line
 * 3 as "Add lines 1z and 2". `fjs/schedule/2` transcribed the same layout in
 * Phase 13 and has carried `line2` as the AMT slot ever since. Form 6251's own
 * line 11 agrees, in the other direction: *"Enter here and on Schedule 2 (Form
 * 1040), line 2."*
 *
 * That is not a footnote. Form 6251 line 10 reads Schedule 2 **line 1z** —
 * the additions-to-tax total — and an engine that put the AMT on line 1 would
 * have the form reading its own output.
 *
 * ## The AMT is a PARALLEL tax system, and this module is shaped like one
 *
 * It is not an adjustment to the regular tax. It recomputes taxable income
 * under a second set of rules (Part I), applies a second rate schedule with a
 * second exemption (Part II lines 5-9), and charges only the EXCESS over the
 * regular tax (line 11). A return whose tentative minimum tax is lower than
 * its regular tax adds nothing at all — which is the overwhelmingly common
 * case and the one `anOrdinaryReturnAddsNothing` pins first.
 *
 * ## Part I: what is computed, and what is a documented zero
 *
 * Lines 1a/1b, 2a, 2g, 2i and 2j are computed for real. **Every other line of
 * Part I is a documented zero, and each has its own `fjs/return/scope` kind**
 * so a taxpayer who has one is refused BY NAME rather than silently given a
 * zero. That distinction is the whole reason those fifteen kinds were added in
 * Phase 29: a zero here does not merely omit a line, it UNDERSTATES the tax,
 * and TAX-16 exists for exactly that. Line 2g's kind was reclassified to
 * `modeledKinds` the moment box 9 arrived.
 *
 * **Line 2j is computed while `amtEstatesAndTrusts` is still listed in
 * `unmodeledKindRefusals`**, and that gap is deliberate rather than an
 * oversight: the reclassification is one edit in `fjs/return/scope`, recorded
 * in `fjs/form6251/todo/estates-and-trusts.md`, and the wiring lands first per
 * "wire before reclassify". Until it is made, a taxpayer who DECLARES the kind
 * is refused by scope while the same taxpayer who merely STORES the Schedule
 * K-1 (Form 1041) receives the computed line — which is the correct direction
 * of the two, since a declaration is an assertion about a return and a stored
 * document is a fact about one.
 *
 * - **Line 1a** — 1040 line 14 minus Schedule 1-A line 37, and **line 37, not
 *   line 38**. Line 38 is the Schedule 1-A total that reaches 1040 line 13b;
 *   line 37 is the senior deduction alone. So the OBBBA senior deduction IS
 *   added back into alternative minimum taxable income, and the tips, overtime
 *   and car-loan-interest deductions on lines 13/21/30 are NOT. This engine
 *   models only Parts I, V and VI of Schedule 1-A, so lines 13/21/30 are zero
 *   and **lines 37 and 38 are equal today** — the distinction is unobservable
 *   and therefore an equivalent mutant. {@link proof}.partOne's own
 *   `theScheduleOneALineThisFormReadsIsNotYetDistinguishable` records that
 *   plainly rather than pretending a fixture pins it.
 * - **Line 1b** — 1040 line 11b minus line 1a, "if less than zero, enter as a
 *   negative amount". Not floored: a negative line 1b is the printed
 *   instruction, and flooring it would overstate AMTI for a filer whose
 *   deductions exceed adjusted gross income.
 * - **Line 2a** — *"If filing Schedule A, enter the taxes from Schedule A, line
 *   7; otherwise, enter the amount from Form 1040 or 1040-SR, line 12e."* This
 *   is the **standard-deduction add-back**, and it is easy to miss because
 *   §56(b)(1)(E) disallows the standard deduction while the printed form never
 *   says so on its own face: for a non-itemizer, line 2a IS the standard
 *   deduction that line 1a just subtracted, added straight back. The
 *   instructions' own TIP spells out the consequence — *"you may be able to
 *   lower your total tax by claiming itemized deductions even if your total
 *   itemized deductions are less than the standard deduction"*.
 * - **Line 2b** — a state or local tax refund from Schedule 1 line 1 or 8z,
 *   entered as a negative. A **computed** zero rather than a refused one, and
 *   this is the one Part I line where that is honest: `fjs/document/1099g`
 *   REFUSES a present, non-zero box 2 at validation, so Schedule 1 line 1
 *   cannot be non-zero for any document that reaches this engine, and line 8z's
 *   recovery is `recoveriesOfAmountsDeductedInAnEarlierYear`, a refused scope
 *   kind (`otherIncome`, the coarse kind for the whole of printed line 8, until
 *   the 2026-08-18 split named the recovery specifically). `fjs/return/scope`'s own
 *   `theFormSixTwoFiveOneLinesAreNameableByKind` leaf is where those two
 *   claims are checked rather than asserted here.
 * - **Line 2g** — *"Interest from specified private activity bonds exempt from
 *   the regular tax."* The SECOND preference item this engine computes, and the
 *   one that needs no election, no basis history and no worksheet: Form 1099-INT
 *   **box 9** carries the figure outright. §57(a)(5) has exceptions — bonds
 *   issued in certain years, and §141(e)'s qualified 501(c)(3) bonds, which are
 *   not private activity bonds for this purpose at all — and **none of them is
 *   this engine's to apply, because the PAYER already applied them.** Box 9's
 *   printed instruction is *"shows tax-exempt interest subject to the
 *   alternative minimum tax"*; the box IS the determination. So this line trusts
 *   the payer's classification, which is precisely the posture this engine takes
 *   toward every other transcribed box — W-2 box 1's characterization of what is
 *   wages, 1099-R box 7's distribution code, 1099-DIV box 1b's qualification of
 *   a dividend. Re-deriving §57(a)(5) here would need the CUSIP-level issuance
 *   history of every bond held, and would be second-guessing the one party the
 *   statute puts in a position to know.
 *
 *   Box 9 is a SUBSET of box 8, which 1040 line 2a already sums, so box 9 has
 *   exactly ONE reader in this whole engine and it is this line — a second
 *   summand in the regular tax would count the same interest twice. See
 *   `vnd.fjs.1099int`'s own header for the invariant that keeps the pair
 *   consistent, and `fjs/form1040/core` for the assertion that line 2a does not
 *   move.
 * - **Line 2i** — the incentive stock option spread, from stored Forms 3921.
 *   The larger and stranger of the two preference items this engine computes,
 *   and the reason an ISO exercise can produce tax on income never received. See
 *   {@link isoSpread}.
 * - **Line 2j** — *"Estates and trusts (amount from Schedule K-1 (Form 1041),
 *   box 12, code A)"*, summed over every stored beneficiary's K-1. The printed
 *   caption names the CODE, which is why exactly one of box 12's ten codes is
 *   routed and the other nine still refuse at `fjs/schedule/e`'s coded sweep:
 *   codes B-F are a *portion of* code A bound for Part III's AMT worksheets,
 *   G-I belong on other Part I lines this engine holds at documented zeros, and
 *   J is next year's Form 8801. **The sum is not floored** — a negative code A
 *   is ordinary. See `fjs/form6251/estate_trust`.
 * - **Lines 2c-2f, 2h, 2k-2t and 3** — documented zeros, each with a kind. See
 *   the named constants below, one per printed line, in printed order.
 *
 * ## Part II, and the exemption's own phase-out
 *
 * Lines 5 and 6 are the Exemption Worksheet, transcribed: the exemption
 * reduced by 25 cents per dollar of AMTI above a per-status threshold, floored
 * at zero, then subtracted from AMTI and floored at zero again. Both floors
 * are the printed form's own ("If zero or less, enter -0-"), not defensive
 * clamps.
 *
 * The married-filing-separately **add-back at line 4** is the one piece of
 * Part I that depends on Part II's figures, and the printed form flags it on
 * line 4's own face: *"If married filing separately and line 4 is more than
 * $900,350, see instructions."* The instruction adds the lesser of 25% of the
 * excess over the complete-phase-out amount and the MFS exemption itself. It
 * exists so that a married couple cannot halve their way into a larger
 * combined exemption than a joint return would have had, and it is computed
 * "without regard to this paragraph" — i.e. on line 4 BEFORE the add-back,
 * which {@link form6251} does by naming the two values separately.
 *
 * ## Capital gains: Part III, and the UPPER BOUND that still comes first
 *
 * Line 7 sends a return with qualified dividends or capital gains to **Part
 * III**, a twenty-nine-line worksheet that reapplies the 0/15/20/25%
 * preferential rates inside the AMT. `fjs/form6251/part3` models it (TAX-33),
 * and this module reads its line 40 onto line 7.
 *
 * **The bound Phase 29 found is still computed, still checked first, and is
 * still what makes the guarantee below a proof.** On Part III's own last two
 * lines, **line 40 is the SMALLER of line 38 and line 39**, and line 39 is
 * exactly the flat 26/28% computation applied to line 12, which is line 6. So
 *
 * > Part III's answer ≤ the flat 26/28% figure, always, at every input.
 *
 * Therefore if the flat figure, less the AMT foreign tax credit, is already no
 * greater than the regular tax on line 10, then line 9 ≤ line 10 whatever Part
 * III would have said, and **line 11 is exactly zero** — not approximately,
 * not probably. {@link form6251} computes that bound BEFORE Part III and
 * returns a real, exact `$0.00` for those returns, with `line7IsAnUpperBound`
 * set so a reader knows lines 7 and 9 are bounds rather than figures.
 *
 * Keeping the short circuit is not an optimisation. It is what lets this module
 * answer *"is the AMT zero?"* for a whole class of returns **without depending
 * on Part III being right**, and `fjs/form6251/part3`'s own
 * `theFlatFigureIsAnUpperBoundAtEveryInput` proves the stronger statement the
 * mechanism rests on: line 38 never exceeds line 39 either, because every
 * preferential rate Part III charges is strictly below the AMT's own 26%. The
 * flag therefore still says which path produced the answer, and the assert at
 * Part III's call site below states the bound's claim where it can fail.
 *
 * **This is also what makes criterion 5 true.** A return with no preference
 * items has AMTI at or below the exemption, so line 6 is zero, Part III is
 * never reached, and nothing changes. A return above the exemption but with an
 * ordinary tax bill has its AMT settled at zero by the bound, on the same code
 * path it took before Part III existed.
 *
 * **What is still refused, by name:** Part III required while the regular tax
 * completed NEITHER preferential worksheet. See
 * {@link noRegularPreferentialWorksheetRefusal}.
 *
 * ## The same-year ISO disposition, refused
 *
 * `i6251.pdf`, line 2i: *"If you acquired stock by exercising an ISO and you
 * disposed of that stock in the same year, the tax treatment under the regular
 * tax and the AMT is the same, and no adjustment is required."* Including the
 * spread anyway would OVERSTATE alternative minimum taxable income by the
 * whole of it. Nothing on a Form 3921 says whether the shares were sold, and
 * matching them to a Form 1099-B needs date arithmetic this project has no
 * primitive for — so a stored Form 3921 together with any Form 1099-B
 * reporting a sale is a refusal. See {@link isoDispositionRefusal}.
 *
 * ## Form 8801, the prior-year minimum tax credit — refused by name, elsewhere
 *
 * Paying AMT this year does not produce a credit this year; it produces one
 * NEXT year, on Form 8801, against the regular tax, and only to the extent the
 * AMT arose from deferral items. The incoming carryforward from 2024 is the
 * mirror image, and it is multi-year history this engine does not hold. It is
 * refused by name at `fjs/return/scope`'s `priorYearMinimumTaxCredit` row
 * (Schedule 3 line 6b), not here: it is a CREDIT on another schedule, and a
 * refusal inside Form 6251 would refuse the wrong return — a filer who owes no
 * AMT at all can still be carrying a credit from a year they did.
 *
 * @module
 */
import { assert, assertEq, assertNotNullish } from 'functionalscript/fjs/asserts/module.f.mjs'
import { centsFromString } from '../exact/module.f.js'
import { of, multiply, halfUp } from '../types/rational/module.f.js'
import { oneShare, sharesFromString } from '../document/share_count/module.f.js'
import { taxParamsByYear } from '../tax/params/module.f.js'
import { twentySixTwentyEightPercentTax } from './rate/module.f.js'
import { partThree } from './part3/module.f.js'
import { estateTrustAmtAdjustment } from './estate_trust/module.f.js'

/** @import { FormThirtyNineTwentyOne } from '../document/form3921/module.f.js' */
/** @import { K1EstateTrust } from '../document/k1_1041/module.f.js' */
/** @import { CodedEntry } from '../document/k1_common/module.f.js' */
/** @import { IndividualFilingStatus, TaxParamSet } from '../tax/params/module.f.js' */
/** @import { PartThree, RegularPreferentialWorksheet } from './part3/module.f.js' */

/**
 * The regular tax completed NEITHER preferential worksheet. Part III's lines 15,
 * 20 and 27 each print a fallback for that case and none of them is modeled —
 * see {@link noRegularPreferentialWorksheetRefusal}.
 * @typedef {{ readonly kind: 'none' }} NoRegularPreferentialWorksheet
 */

/**
 * A stored document as this module sees it — mirrors every other consumer's
 * own `Stored<T>`; nothing here re-validates.
 * @template T
 * @typedef {{ readonly documentHash: string, readonly value: T }} Stored
 */

// ── Local helpers ────────────────────────────────────────────────────────────

/**
 * Rounds `cents * (percent / 100)` to the nearest cent, ties away from zero
 * (IRS half-up). Reimplemented locally, per this project's "reimplement an
 * idiom you cannot import" precedent — `fjs/schedule/1a`, `fjs/tax/ssb` and
 * `fjs/form8995` each carry their own copy of these two lines.
 * @type {(cents: bigint) => (percent: bigint) => bigint}
 */
const percentOfCents = cents => percent => halfUp(multiply(of(cents)(1n))(of(percent)(100n)))

/** The larger of two cents figures. @type {(a: bigint) => (b: bigint) => bigint} */
const max = a => b => a > b ? a : b

/** The smaller of two cents figures. @type {(a: bigint) => (b: bigint) => bigint} */
const min = a => b => a < b ? a : b

// ── Inputs ───────────────────────────────────────────────────────────────────

/**
 * Everything Form 6251 reads, and nothing more.
 *
 * Every 1040/Schedule figure arrives as bare cents rather than as a
 * `ReportLine`: this form's own printed lines are intermediates that a report
 * never renders, exactly as `fjs/form8959`'s and `fjs/form8960`'s are, and
 * only the ONE figure that reaches Schedule 2 line 2 needs provenance —
 * which `fjs/schedule/2` attaches, where the sourced lines are in scope.
 *
 * `aStoredNineteenNineBReportsASale` is a BOOLEAN rather than the documents
 * themselves, deliberately. This module has exactly one question to ask of the
 * brokerage forms — did the taxpayer sell anything? — and taking the whole
 * list would let a later edit start reading amounts off them, which is
 * Schedule D's job and would give two modules a say in one number.
 *
 * `specifiedPrivateActivityBondInterestCents` follows that same rule rather than
 * `isoExerciseForms`'s, and the difference between the two is worth stating
 * because both are document-derived. Line 2i is a per-document COMPUTATION
 * (two products and a floored difference, per exercise, refusing a form with a
 * box missing), so the forms themselves have to travel. Line 2g is a plain sum
 * of one box, and the module that already sums 1099-INT boxes — with DOC-11's
 * absent-is-absent rule written once — is `fjs/form1040/core`, where 1040 line
 * 2a's own box-8 sum lives. Taking the interest documents here would put a
 * second reader of that dialect in a second module, which is exactly how box 8
 * and box 9 would come to be summed by two rules that disagree.
 *
 * `estateTrustK1Forms` travels as DOCUMENTS, on `isoExerciseForms`' side of
 * that line rather than line 2g's, and the test the two cases are being sorted
 * by is *"does another module already read this box?"* — not *"is it a plain
 * sum?"*. Box 12 has **no other reader in the engine**: `fjs/form1040/core`
 * reads this dialect's fixed-caption boxes 1, 2a, 2b, 3 and 4a and
 * `fjs/schedule/e` reads box 6, and every coded box is swept and refused. So
 * putting the reader here creates no second rule for one box; it retires a box
 * that was stored and read by nothing. The rows also need per-CODE filtering
 * and a per-ENTRY citation, neither of which survives being pre-summed into
 * cents. The filtering rule itself lives one level down in
 * `fjs/form6251/estate_trust`, which is also what `fjs/schedule/e`'s coded
 * sweep opens its gate from — one hand-typed code list, three call sites.
 * @typedef {{
 *   readonly status: IndividualFilingStatus,
 *   readonly adjustedGrossIncomeCents: bigint,
 *   readonly totalDeductionsCents: bigint,
 *   readonly scheduleOneALine37Cents: bigint,
 *   readonly itemizing: boolean,
 *   readonly scheduleALine7Cents: bigint,
 *   readonly standardDeductionCents: bigint,
 *   readonly isoExerciseForms: readonly Stored<FormThirtyNineTwentyOne>[],
 *   readonly aStoredNineteenNineBReportsASale: boolean,
 *   readonly specifiedPrivateActivityBondInterestCents: bigint,
 *   readonly estateTrustK1Forms: readonly Stored<K1EstateTrust>[],
 *   readonly amtDepreciationAdjustmentCents: bigint,
 *   readonly regularTaxCents: bigint,
 *   readonly scheduleTwoLine1zCents: bigint,
 *   readonly scheduleThreeLine1Cents: bigint,
 *   readonly qualifiedDividendsCents: bigint,
 *   readonly capitalGainDistributionsCents: bigint,
 *   readonly filingScheduleD: boolean,
 *   readonly scheduleD15Cents: bigint,
 *   readonly scheduleD16Cents: bigint,
 *   readonly scheduleD19Cents: bigint,
 *   readonly regularPreferentialWorksheet:
 *     RegularPreferentialWorksheet | NoRegularPreferentialWorksheet,
 *   readonly form2555ExclusionCents: bigint,
 *   readonly form2555ItemizedDeductionsAndExclusionsNotClaimedCents: bigint,
 * }} Form6251Input
 */

// ── Output ───────────────────────────────────────────────────────────────────

/**
 * Every printed line of Parts I and II, in printed order (TAX-15: one printed
 * line, one field), plus two facts about HOW the answer was reached.
 *
 * `line7IsAnUpperBound` is `true` exactly when Part III was required and the
 * upper bound settled the answer at zero WITHOUT running Part III. On such a
 * return `line7` and `line9` are UPPER BOUNDS rather than the figures the
 * printed form would carry, and `line11` is nonetheless exact — see this
 * module's own docstring. On every other return it is `false` and all three
 * lines are the printed figures. **It still tells a reader which path produced
 * the answer**, which is the whole of what it ever claimed: `true` means the
 * bound settled it, `false` means lines 7/9 are figures — now including a real
 * Part III line 40 on line 7.
 *
 * `partThree` is the filled-in Part III worksheet when one was completed, and
 * `undefined` otherwise — which is the case for every return that never reached
 * Part III AND for a return the bound settled at zero without running it. A
 * separate field rather than twenty-nine more lines on this record, following
 * `fjs/tax/line16/qdcgt`'s sibling-module shape: Part III is a worksheet, not a
 * continuation of this form's own numbering.
 *
 * `isoSpreadCents` is line 2i restated on its own field, because it is the
 * largest preference item this engine computes and a report that wants to say
 * WHY a return owes AMT needs it without re-deriving it. Line 2g gets no such
 * second field: it is a pass-through of one summed box rather than something
 * this module derived, so `line2g` already IS the figure a report would quote.
 * @typedef {{
 *   readonly kind: 'ok',
 *   readonly line1a: bigint, readonly line1b: bigint,
 *   readonly line2a: bigint, readonly line2b: bigint, readonly line2c: bigint,
 *   readonly line2d: bigint, readonly line2e: bigint, readonly line2f: bigint,
 *   readonly line2g: bigint, readonly line2h: bigint, readonly line2i: bigint,
 *   readonly line2j: bigint, readonly line2k: bigint, readonly line2l: bigint,
 *   readonly line2m: bigint, readonly line2n: bigint, readonly line2o: bigint,
 *   readonly line2p: bigint, readonly line2q: bigint, readonly line2r: bigint,
 *   readonly line2s: bigint, readonly line2t: bigint,
 *   readonly line3: bigint,
 *   readonly line4BeforeAddBack: bigint,
 *   readonly line4: bigint,
 *   readonly line5: bigint, readonly line6: bigint, readonly line7: bigint,
 *   readonly line8: bigint, readonly line9: bigint, readonly line10: bigint,
 *   readonly line11: bigint,
 *   readonly line7IsAnUpperBound: boolean,
 *   readonly isoSpreadCents: bigint,
 *   readonly partThree: PartThree | undefined,
 * }} Form6251Ok
 */

/**
 * The graceful, tagged refusal — the same shape `fjs/form8949` and
 * `fjs/schedule/d` build, and for the same reason: this is a
 * document-data-sufficiency problem (can THIS return's AMT be honestly
 * computed?), not a declared-kind scope problem, so it does not go through
 * `fjs/return/scope`'s `scopeRefusal` and invents no kind.
 * @typedef {{ readonly kind: 'error', readonly message: string }} Form6251Error
 */

/** @typedef {Form6251Ok | Form6251Error} Form6251Outcome */

// ── Part III's one remaining refusal ────────────────────────────────────────

/**
 * Part III is required, the upper bound does not settle the AMT at zero, and the
 * regular tax completed **neither** the Qualified Dividends and Capital Gain Tax
 * Worksheet **nor** the Schedule D Tax Worksheet.
 *
 * Part III's lines 15, 20 and 27 each print a fallback for that case — line 15's
 * *"if you did not complete a Schedule D Tax Worksheet ... enter the amount from
 * line 13"*, and lines 20 and 27's *"if you did not complete either worksheet
 * for the regular tax, enter the amount from Form 1040 or 1040-SR, line 15; if
 * zero or less, enter -0-"*. Line 13's own no-worksheet reading is not on the
 * form's face at all; it is in `i6251.pdf`. So this corner needs an instruction
 * this module has not transcribed, and it is refused rather than guessed.
 *
 * **When it happens, exactly.** `fjs/tax/line16`'s dispatch reaches neither
 * preferential worksheet only through its LEVEL 1 gate, *"taxable income is zero
 * or less"*, which precedes level 2's worksheet selection. Every other route
 * into "neither worksheet" — Form 2555, Form 8615, Schedule J — already refuses
 * one level up with its own scope kind. So this refusal names the one return
 * shape that reaches it: 1040 line 15 at or below zero, alongside qualified
 * dividends or capital gain, alongside enough of a preference item to put AMTI
 * above the exemption. A large incentive stock option spread on a return whose
 * deductions swallow its ordinary income is that shape.
 *
 * A CONSTANT rather than a function, unlike {@link isoDispositionRefusal}: there
 * is no document to name. What the reader needs is the condition and the way
 * out, and both are the same for every return that hits it.
 * @type {Form6251Error}
 */
const noRegularPreferentialWorksheetRefusal = {
    kind: 'error',
    message: `Form 6251 Part III: this return reports qualified dividends or capital gain, so `
        + `line 7 routes through Part III, and the flat 26%/28% figure does NOT already lose to `
        + `the regular tax — so Part III genuinely decides the answer. But the regular tax `
        + `completed NEITHER the Qualified Dividends and Capital Gain Tax Worksheet nor the `
        + `Schedule D Tax Worksheet, which happens exactly when Form 1040 line 15 (taxable `
        + `income) is zero or less. Part III lines 13, 15, 20 and 27 all read those worksheets, `
        + `and their no-worksheet fallbacks are a separate printed rule this engine has not `
        + `transcribed — line 13's is not on the form's face at all, only in the instructions. `
        + `Refusing rather than substituting a zero: every one of those lines feeds a `
        + `preferential band, so a wrong zero would tax capital gain at 26% or 28% inside the `
        + `alternative minimum tax and OVERSTATE the tax, which is a confident wrong answer.`,
}

/**
 * The refusal a §911 exclusion forces on a return whose alternative minimum
 * taxable income exceeds the exemption AND which reports preferential income.
 *
 * A CONSTANT rather than a function, on
 * {@link noRegularPreferentialWorksheetRefusal}'s own reasoning: there is no
 * document to name, and what the reader needs is the condition and the way
 * out, which are the same for every return that hits it.
 *
 * **The population it costs is narrow, deliberately.** i6251's worksheet
 * begins *"If Form 6251, line 6, is zero, don't complete this worksheet"*, and
 * line 6 is alternative minimum taxable income LESS the exemption — $88,100
 * single, $137,000 joint for 2025. So an expatriate whose AMTI stays under the
 * exemption is untouched by this, whatever their preferential income; only a
 * filer above it, WITH qualified dividends or capital gain, lands here.
 * @type {Form6251Error}
 */
const formTwoFiveFiveFiveWithPartThreeRefusal = {
    kind: 'error',
    message: `Form 6251 line 7: this return excludes foreign earned income under §911 and `
        + `reports qualified dividends or capital gain, and its line 6 is more than zero. `
        + `i6251's Foreign Earned Income Tax Worksheet then routes line 7 through Part III `
        + `"with certain modifications" — its lines 20 and 27 read the REGULAR tax's own `
        + `preferential worksheet, or, where none was completed, line 3 of the Foreign Earned `
        + `Income Tax Worksheet in the Instructions for Form 1040. This engine has not `
        + `transcribed those modifications, and the flat 26%/28% bound this module normally `
        + `leans on does NOT hold once the excluded income is stacked underneath: Part III's `
        + `line 39 would be figured on the worksheet's line 3 rather than on line 6. Refusing `
        + `rather than short-circuiting to $0.00 and understating the alternative minimum tax. `
        + `Nothing reaches Schedule 2 line 2`,
}

// ── Line 2i: the incentive stock option spread ──────────────────────────────

/**
 * The refusal a stored Form 3921 forces on a return that also reports a sale.
 *
 * `i6251.pdf`'s line 2i instruction: *"If you acquired stock by exercising an
 * ISO and you disposed of that stock in the same year, the tax treatment under
 * the regular tax and the AMT is the same, and no adjustment is required."*
 * Including the spread on such a return would OVERSTATE alternative minimum
 * taxable income by the whole of it, which is a confident wrong answer in the
 * other direction from the one this engine usually guards against — and
 * "overstating is safe" is not a principle this project holds.
 *
 * Nothing on a Form 3921 records a disposition. Matching its box 2 exercise
 * date and box 5 share count against a Form 1099-B's box 1b/1c dates and box
 * 1a description is date arithmetic and identity matching, and this project
 * has neither a date primitive nor a lot-identity field.
 *
 * **The control is what keeps this from being an outage**: an exercise-and-HOLD
 * — which is the case that generates AMT in the first place, and the case a
 * FAANG employee is actually in when they need this form — reports no sale, so
 * this never fires for them.
 * @type {(documentHash: string) => Form6251Error}
 */
const isoDispositionRefusal = documentHash => ({
    kind: 'error',
    message: `Form 6251 line 2i: this return stores Form 3921 ${documentHash} (an incentive `
        + `stock option exercise) AND reports at least one sale on a Form 1099-B, and this `
        + `engine cannot tell whether the shares sold were the shares exercised. The printed `
        + `instructions are explicit that a disposition in the SAME year as the exercise `
        + `requires no adjustment at all, so including the spread would overstate alternative `
        + `minimum taxable income by the whole of it — and excluding it would understate by `
        + `the same amount if the sale was of other stock. Neither Form 3921 nor Form 1099-B `
        + `carries a lot identity, and deciding it from the exercise date in box 2 against the `
        + `sale date in box 1c is date arithmetic this project has no primitive for. Refusing `
        + `rather than guessing which.`,
})

/**
 * One Form 3921's alternative-minimum-taxable-income adjustment, following the
 * printed worked example's own ORDER of operations.
 *
 * `i6251.pdf` line 2i: *"multiply the amount in box 4, $25, by the 100 shares
 * in box 5. The result is $2,500, the FMV of all the shares. Then multiply the
 * amount in box 3, $10, by the 100 shares. ... Your adjustment is $1,500
 * ($2,500 − $1,000)."* Two products, each a per-share price times a share
 * count, and the subtraction LAST.
 *
 * **The order is load-bearing only for a fractional share count**, and it is
 * followed anyway. With whole shares both products are exact and any order
 * agrees; with a fraction, rounding each product to the cent before
 * subtracting can differ by a cent from rounding the difference. The printed
 * page rounds each product, so this does too, and
 * `theOrderOfOperationsFollowsThePrintedExample` is the leaf that exhibits an
 * input where the two disagree.
 *
 * Floored at zero PER EXERCISE, not on the sum: §56(b)(3) routes through
 * §83(a), whose words are *"the EXCESS of the fair market value ... over the
 * amount paid"*, and an exercise below the strike price produces no excess.
 * Two exercises, one above water and one below, therefore do not net — which
 * they would if the floor were applied to the total.
 * @type {(exercisePriceCents: bigint) => (fairMarketValueCents: bigint) => (shares: bigint) => bigint}
 */
export const isoSpread = exercisePriceCents => fairMarketValueCents => shares => {
    // Box 4 x box 5: the fair market value of all the shares.
    const fairMarketValueTotal = halfUp(
        multiply(of(fairMarketValueCents)(1n))(of(shares)(oneShare)))
    // Box 3 x box 5: what was paid for all the shares.
    const amountPaidTotal = halfUp(multiply(of(exercisePriceCents)(1n))(of(shares)(oneShare)))
    return max(fairMarketValueTotal - amountPaidTotal)(0n)
}

/**
 * Line 2i over every stored Form 3921, or a refusal naming the first document
 * that cannot produce a spread.
 *
 * **A Form 3921 with any of boxes 3, 4 or 5 absent is REFUSED, not skipped.**
 * DOC-11's absent-is-absent rule, at the point where it changes an answer: a
 * missing box 5 is not an exercise of zero shares, and treating it as one
 * would silently drop a preference item the employer told the IRS about.
 *
 * Summed across every stored form WITHOUT scoping by `employeeTin`, which is
 * the opposite of what `fjs/form8863` does with that same field on a
 * `vnd.fjs.1098t`. A joint return computes ONE Form 6251 over ONE alternative
 * minimum taxable income and §56(b)(3) makes no per-spouse distinction, so
 * both spouses' exercises land on the same line — see
 * `fjs/document/form3921`'s own header.
 * @type {(forms: readonly Stored<FormThirtyNineTwentyOne>[]) => { readonly kind: 'ok', readonly cents: bigint } | Form6251Error}
 */
const isoSpreadTotal = forms => {
    let total = 0n
    for (const form of forms) {
        const { box3ExercisePricePerShare, box4FairMarketValuePerShareOnExerciseDate } = form.value
        const shares = form.value.box5NumberOfSharesTransferred
        if (box3ExercisePricePerShare === undefined
            || box4FairMarketValuePerShareOnExerciseDate === undefined
            || shares === undefined) {
            return {
                kind: 'error',
                message: `Form 6251 line 2i: Form 3921 ${form.documentHash} is missing at least `
                    + `one of box3ExercisePricePerShare, `
                    + `box4FairMarketValuePerShareOnExerciseDate and `
                    + `box5NumberOfSharesTransferred. The §56(b)(3) adjustment is (box 4 − box 3) `
                    + `× box 5 and cannot be computed without all three. An absent box is ABSENT, `
                    + `never zero: a missing share count is not an exercise of no shares, and `
                    + `treating it as one would silently drop a preference item the employer `
                    + `reported to the IRS.`,
            }
        }
        total += isoSpread(centsFromString(box3ExercisePricePerShare))(
            centsFromString(box4FairMarketValuePerShareOnExerciseDate))(
            sharesFromString(shares))
    }
    return { kind: 'ok', cents: total }
}

// ── Form 6251 ────────────────────────────────────────────────────────────────

/**
 * Computes Form 6251 for one return.
 *
 * Every `const` below is one printed line, in printed order, per TAX-15.
 * @type {(taxParamSet: TaxParamSet) => (input: Form6251Input) => Form6251Outcome}
 */
export const form6251 = taxParamSet => input => {
    const {
        status, adjustedGrossIncomeCents, totalDeductionsCents, scheduleOneALine37Cents,
        itemizing, scheduleALine7Cents, standardDeductionCents,
        isoExerciseForms, aStoredNineteenNineBReportsASale,
        specifiedPrivateActivityBondInterestCents, estateTrustK1Forms,
        amtDepreciationAdjustmentCents,
        regularTaxCents, scheduleTwoLine1zCents, scheduleThreeLine1Cents,
        qualifiedDividendsCents, capitalGainDistributionsCents,
        filingScheduleD, scheduleD15Cents, scheduleD16Cents, scheduleD19Cents,
        regularPreferentialWorksheet,
        form2555ExclusionCents, form2555ItemizedDeductionsAndExclusionsNotClaimedCents,
    } = input
    const { alternativeMinimumTax } = taxParamSet

    // The same-year-disposition question, asked BEFORE any line is computed:
    // it decides whether line 2i has a figure at all, and a partly-built form
    // would be a form nobody can act on.
    const [firstIsoForm] = isoExerciseForms
    if (firstIsoForm !== undefined && aStoredNineteenNineBReportsASale) {
        return isoDispositionRefusal(firstIsoForm.documentHash)
    }
    const isoOutcome = isoSpreadTotal(isoExerciseForms)
    if (isoOutcome.kind === 'error') {
        return isoOutcome
    }
    // Line 2j's own document question, asked here for the same reason: a code
    // A row printed as `STMT` carries no figure, and a half-built form is a
    // form nobody can act on.
    const estateTrustOutcome = estateTrustAmtAdjustment(estateTrustK1Forms)
    if (estateTrustOutcome.kind === 'error') {
        return estateTrustOutcome
    }

    // ── Part I: Alternative Minimum Taxable Income ───────────────────────

    // 1a. "Subtract Schedule 1-A (Form 1040), line 37, from Form 1040 line
    //     14." Line 37, NOT the line 38 total that reaches 1040 line 13b --
    //     see this module's docstring.
    const line1a = totalDeductionsCents - scheduleOneALine37Cents
    // 1b. "Subtract line 1a from Form 1040 line 11b (if less than zero, enter
    //     as a negative amount)." Deliberately NOT floored.
    const line1b = adjustedGrossIncomeCents - line1a
    // 2a. "If filing Schedule A, enter the taxes from Schedule A, line 7;
    //     otherwise, enter the amount from Form 1040 line 12e." The
    //     standard-deduction add-back §56(b)(1)(E) requires, in the form the
    //     printed page states it.
    const line2a = itemizing ? scheduleALine7Cents : standardDeductionCents
    // 2b. State/local tax refund from Schedule 1 line 1 or 8z, as a negative.
    //     A COMPUTED zero: `fjs/document/1099g` refuses a non-zero box 2 at
    //     validation, so Schedule 1 line 1 cannot be non-zero here, and line
    //     8z's recovery is the refused
    //     `recoveriesOfAmountsDeductedInAnEarlierYear` kind.
    const line2b = 0n
    // 2c. Investment interest expense (Form 4952) -- `investmentInterestForm4952`.
    const line2c = 0n
    // 2d. Depletion -- `amtDepletion`.
    const line2d = 0n
    // 2e. Net operating loss deduction from Schedule 1 line 8a --
    //     `amtNetOperatingLossDeduction`.
    const line2e = 0n
    // 2f. Alternative tax net operating loss deduction -- the same kind: 2e
    //     adds the regular deduction back and 2f allows the AMT one, two
    //     halves of one taxpayer fact.
    const line2f = 0n
    // 2g. "Interest from specified private activity bonds exempt from the
    //     regular tax." Form 1099-INT BOX 9, summed across every supplied
    //     document by `fjs/form1040/core` and handed over as cents.
    //
    //     §57(a)(5) has exceptions -- bonds issued in certain years, and
    //     §141(e) qualified 501(c)(3) bonds, which are not private activity
    //     bonds for this purpose at all -- and NONE of them is applied here,
    //     because the PAYER already applied them. Box 9's printed instruction
    //     is "shows tax-exempt interest subject to the alternative minimum
    //     tax": the box IS the determination. This engine trusts the payer's
    //     classification, the same posture it takes toward W-2 box 1's
    //     characterization of wages and 1099-DIV box 1b's qualification of a
    //     dividend. Re-deriving the exceptions would need the issuance history
    //     of every bond held and would second-guess the one party the statute
    //     puts in a position to know.
    //
    //     Box 9 is a SUBSET of box 8, which 1040 line 2a already sums, so this
    //     is box 9's ONLY reader anywhere in the engine -- see
    //     `fjs/form1040/core`'s own no-double-count leaf.
    const line2g = specifiedPrivateActivityBondInterestCents
    // 2h. Qualified small business stock -- `section1202Gain`, the kind that
    //     already refuses the §1202 exclusion at 1099-DIV box 2c.
    const line2h = 0n
    // 2i. "Exercise of incentive stock options (excess of AMT income over
    //     regular tax income)" -- THE ONE PREFERENCE ITEM THIS ENGINE
    //     COMPUTES, from stored Forms 3921.
    const line2i = isoOutcome.cents
    // 2j. "Estates and trusts (amount from Schedule K-1 (Form 1041), box 12,
    //     code A)" -- THE THIRD ADJUSTMENT THIS ENGINE COMPUTES, and the only
    //     one whose printed caption names the CODE it reads. The sum lives in
    //     `fjs/form6251/estate_trust`, which also owns the code list
    //     `fjs/schedule/e`'s coded sweep opens its gate from.
    //
    //     NOT floored: a negative code A is an ordinary AMT adjustment (an
    //     estate whose AMT depreciation now exceeds its regular depreciation),
    //     and flooring it would OVERSTATE alternative minimum taxable income.
    //     Codes B-F are a PORTION of code A and belong to Part III's
    //     worksheets, G-I belong on other Part I lines, and J belongs on next
    //     year's Form 8801 -- every one of them still refuses at
    //     `fjs/schedule/e`.
    const line2j = estateTrustOutcome.cents
    // 2k. Disposition of property (a different AMT basis) --
    //     `amtDispositionOfProperty`. This is where an ISO exercised in an
    //     EARLIER year and sold in this one lands, and it is why line 2i's
    //     own basis increase is a multi-year fact this engine cannot carry.
    const line2k = 0n
    // 2l. "Depreciation on assets placed in service after 1986" --
    //     `amtDepreciation`, computed by `fjs/form4562` from a
    //     `vnd.fjs.asset_register` and threaded here through
    //     `fjs/schedule/c`'s own completed Form 4562. §56(a)(1)(A)(ii)
    //     puts 200% declining balance property on the 150% declining
    //     balance method over the SAME recovery period, and the adjustment
    //     is the difference.
    //
    //     **NOT floored**, for the identical reason line 2j is not: 200 DB
    //     front-loads, so past the halfway point of an asset's life the
    //     alternative schedule is the larger of the two and the adjustment
    //     is NEGATIVE. Flooring it would overstate alternative minimum
    //     taxable income for every business with mature equipment.
    const line2l = amtDepreciationAdjustmentCents
    // 2m. Passive activities -- `amtPassiveActivities`.
    const line2m = 0n
    // 2n. Loss limitations -- `amtLossLimitations`.
    const line2n = 0n
    // 2o. Circulation costs -- `amtCirculationCosts`.
    const line2o = 0n
    // 2p. Long-term contracts -- `amtLongTermContracts`.
    const line2p = 0n
    // 2q. Mining costs -- `amtMiningCosts`.
    const line2q = 0n
    // 2r. Research and experimental costs -- `amtResearchAndExperimentalCosts`.
    const line2r = 0n
    // 2s. Income from certain installment sales before January 1, 1987 --
    //     `amtPre1987InstallmentSales`.
    const line2s = 0n
    // 2t. Intangible drilling costs preference -- `amtIntangibleDrillingCosts`.
    const line2t = 0n
    // 3. "Other adjustments, including income-based related adjustments" --
    //    SEVEN kinds as of the 2026-08-18 split, one per printed heading in
    //    i6251 pp. 8-9 (`amtPre1987Depreciation`,
    //    `amtPollutionControlFacilities`, `amtTaxShelterFarmActivities`,
    //    `amtCharitableContributionsOfCertainProperty`,
    //    `amtBusinessInterestLimitation`,
    //    `amtNonPrincipalResidenceMortgageInterest`, `amtRelatedAdjustments`),
    //    plus `netQualifiedDisasterLoss`, which already named the eighth.
    const line3 = 0n

    // 4. "Alternative minimum taxable income. Combine lines 1b through 3."
    const line4BeforeAddBack = line1b + line2a + line2b + line2c + line2d + line2e + line2f
        + line2g + line2h + line2i + line2j + line2k + line2l + line2m + line2n + line2o
        + line2p + line2q + line2r + line2s + line2t + line3
    // 4, continued. "(If married filing separately and line 4 is more than
    //    $900,350, see instructions.)" The instruction: include an additional
    //    amount, the LESSER of 25% of the excess over that figure and the MFS
    //    exemption. Computed on line 4 "determined without regard to this
    //    paragraph", which is `line4BeforeAddBack` above.
    const completePhaseoutCents = centsFromString(
        alternativeMinimumTax.exemptionCompletePhaseout[status].amount)
    const exemptionCents = centsFromString(alternativeMinimumTax.exemption[status].amount)
    const marriedFilingSeparatelyAddBack = status === 'marriedFilingSeparately'
        && line4BeforeAddBack > completePhaseoutCents
        ? min(percentOfCents(line4BeforeAddBack - completePhaseoutCents)(
            BigInt(alternativeMinimumTax.exemptionPhaseoutRatePercent)))(exemptionCents)
        : 0n
    const line4 = line4BeforeAddBack + marriedFilingSeparatelyAddBack

    // ── Part II: Alternative Minimum Tax ─────────────────────────────────

    // 5. "Exemption" -- the printed chart, and the Exemption Worksheet behind
    //    it when line 4 is over the chart's middle column. The worksheet's
    //    five steps, in order: the base amount, AMTI, the threshold, the
    //    excess floored at zero, 25% of it, and the base less that, floored
    //    at zero.
    const phaseoutThresholdCents = centsFromString(
        alternativeMinimumTax.exemptionPhaseoutThreshold[status].amount)
    const exemptionWorksheetLine4 = max(line4 - phaseoutThresholdCents)(0n)
    const exemptionWorksheetLine5 = percentOfCents(exemptionWorksheetLine4)(
        BigInt(alternativeMinimumTax.exemptionPhaseoutRatePercent))
    const line5 = max(exemptionCents - exemptionWorksheetLine5)(0n)
    // 6. "Subtract line 5 from line 4. If more than zero, go to line 7. If
    //    zero or less, enter -0- here and on lines 7, 9, and 11, and go to
    //    line 10."
    const line6 = max(line4 - line5)(0n)

    // 10. "Add Form 1040 line 16 (minus any tax from Form 4972), and Schedule
    //     2 line 1z. Subtract from the result Schedule 3 line 1 and any
    //     negative amount reported on Form 8978, line 14. If zero or less,
    //     enter -0-." Computed BEFORE line 7 because the Part III bound below
    //     compares against it -- the printed form's own line 6 instruction
    //     ("go to line 10") already routes this way for a zero line 6.
    //
    //     Form 4972 and Form 8978 are both refused `fjs/return/scope` kinds
    //     (`form4972LumpSumDistribution`, `partnerAdditionalReportingYearTax`),
    //     so both terms are documented zeros rather than unmodeled ones.
    const line10 = max(regularTaxCents + scheduleTwoLine1zCents - scheduleThreeLine1Cents)(0n)

    // The zero-line-6 short circuit, exactly as printed: lines 7, 9 and 11 are
    // all -0-. This is the path every return with no preference items takes,
    // and it is why criterion 5 holds.
    if (line6 === 0n) {
        return {
            kind: 'ok',
            line1a, line1b,
            line2a, line2b, line2c, line2d, line2e, line2f, line2g, line2h, line2i,
            line2j, line2k, line2l, line2m, line2n, line2o, line2p, line2q, line2r,
            line2s, line2t,
            line3, line4BeforeAddBack, line4, line5, line6,
            line7: 0n, line8: 0n, line9: 0n, line10, line11: 0n,
            line7IsAnUpperBound: false,
            isoSpreadCents: line2i,
            partThree: undefined,
        }
    }

    // 7, the "All others" bullet: "If line 6 is $239,100 or less ($119,550 or
    //    less if married filing separately), multiply line 6 by 26% (0.26).
    //    Otherwise, multiply line 6 by 28% (0.28) and subtract $4,782 ($2,391
    //    if married filing separately) from the result."
    //
    //    Written as the two-bracket schedule it is, rather than as the printed
    //    shortcut: 26% of the first slice plus 28% of the excess. The two are
    //    algebraically identical, because the subtracted constant is exactly
    //    the threshold times the two-point rate difference, and
    //    `theTwentySixTwentyEightScheduleMatchesThePrintedShortcut` hand-types
    //    $4,782 and $2,391 and proves it. Rounded ONCE, on the combined exact
    //    rational, so the two forms agree to the cent rather than nearly.
    //
    //    The schedule itself lives in `fjs/form6251/rate` since TAX-33,
    //    because this form prints it THREE times -- here and at Part III's
    //    lines 18 and 39 -- and three copies is "one rule, one place" with
    //    three ways to rot.
    //    **TAX-42: with a §911 exclusion, line 7 is the Foreign Earned Income
    //    Tax Worksheet's line 6, not this flat figure applied to line 6.**
    //    i6251 p10 prints its own worksheet for exactly this line, and its
    //    lines 4 and 5 are the "All others" bullet above applied to two
    //    DIFFERENT amounts — the excluded income stacked on line 6, less the
    //    excluded income alone.
    //
    //    Its `Before you begin` is what makes the ordering here right: *"If
    //    Form 6251, line 6, is zero, don't complete this worksheet."* The
    //    zero-line-6 short circuit above has already returned, so every path
    //    that reaches this line has a positive line 6.
    //
    //    Lines 1 through 3 of that worksheet, in its own numbering:
    //      1.  Form 6251 line 6
    //      2a. Form 2555 lines 45 and 50 (line 50 is refused, hence zero)
    //      2b. itemized deductions or exclusions related to excluded income
    //      2c. 2a − 2b, floored at zero
    //      3.  1 + 2c
    const worksheetLine2a = form2555ExclusionCents
    const worksheetLine2b = form2555ItemizedDeductionsAndExclusionsNotClaimedCents
    const worksheetLine2c = max(worksheetLine2a - worksheetLine2b)(0n)
    const flatOn = twentySixTwentyEightPercentTax(taxParamSet)(status)
    //    Written as ONE expression rather than an `if`: at a zero line 2c the
    //    worksheet's line 4 and line 5 differ by exactly `flatOn(line6)`,
    //    since `flatOn(0n)` is zero — so the general form already IS the
    //    ordinary answer, and `theWorksheetIsANoOpWithNoExclusion` is the leaf
    //    that says so rather than a comment claiming it.
    const flatTwentySixTwentyEight
        = flatOn(line6 + worksheetLine2c) - flatOn(worksheetLine2c)

    // 8. "Alternative minimum tax foreign tax credit." EQUAL to Schedule 3
    //    line 1, and this was a documented zero until TAX-36 made that line
    //    real.
    //
    //    **Wiring line 10 without wiring this would make the AMT worse than
    //    leaving both alone.** The form subtracts a foreign tax credit on
    //    both sides of its comparison: line 9 = line 7 - line 8 and line 10 =
    //    the regular tax less Schedule 3 line 1, with line 11 = line 9 - line
    //    10. Move line 10 alone and the AMT rises by exactly the credit.
    //
    //    §59(a)(1) defines the AMTFTC as the §27(a) credit redetermined with
    //    the pre-credit tentative minimum tax and AMTI substituted into §904.
    //    Under §904(j) there is no §904(a) limitation to redetermine, so the
    //    substitutions change nothing and the two figures are equal — which
    //    is also what Form 6251's own line 8 instruction tells a filer who
    //    did not file Form 1116. The correct net effect of a §904(j) credit
    //    on the AMT is therefore ZERO.
    //
    //    **This equality holds only while §904(j) is the ONLY route to
    //    Schedule 3 line 1 in this engine**, which it is: `fjs/schedule/3`'s
    //    `foreignTaxCreditLine` refuses every other case. The day Form 1116
    //    is modeled, line 8 becomes its own AMT-basis Form 1116 figure and
    //    this assignment is wrong.
    const line8 = scheduleThreeLine1Cents

    // 7, the FIRST bullet: Part III is required when the return reported
    //    capital gain distributions directly on 1040 line 7, or qualified
    //    dividends on line 3a, or had a gain on BOTH Schedule D lines 15 and
    //    16. The same three conditions `fjs/tax/line16`'s own dispatcher reads
    //    for the regular tax, which is not a coincidence: Part III is the AMT
    //    restatement of that worksheet.
    const scheduleDLinesFifteenAndSixteenAreBothGains
        = filingScheduleD && scheduleD15Cents > 0n && scheduleD16Cents > 0n
    const partThreeRequired = qualifiedDividendsCents > 0n
        || (!filingScheduleD && capitalGainDistributionsCents > 0n)
        || scheduleDLinesFifteenAndSixteenAreBothGains

    if (partThreeRequired) {
        // **TAX-42's one refusal on this form.** With a §911 exclusion in
        // play, Part III is not the Part III this module computes: i6251 p10's
        // worksheet line 4 says to put its OWN line 3 on Form 6251 line 12 and
        // then "see Form 2555, later, to see if you must complete Part III
        // with certain modifications" — and p13's `Form 2555` notes under Line
        // 20 and Line 27 redirect both to the regular tax's worksheets, or,
        // failing those, to line 3 of the 1040 instructions' Foreign Earned
        // Income Tax Worksheet.
        //
        // Every bound below rests on line 39 being `flatOn(line 12)` with line
        // 12 equal to line 6, and with the exclusion it is neither. So this
        // refuses BEFORE the bound rather than after it: a bound that no
        // longer holds would short-circuit to $0.00 and understate the tax.
        if (worksheetLine2c !== 0n) {
            return formTwoFiveFiveFiveWithPartThreeRefusal
        }
        // Part III line 40 is "the SMALLER of line 38 or line 39", and line 39
        // is exactly this flat computation applied to line 12, which is line
        // 6. So Part III's answer can only be LOWER. If the flat figure
        // already loses to the regular tax, so does Part III's, and line 11 is
        // exactly zero whatever Part III would have said.
        if (flatTwentySixTwentyEight - line8 <= line10) {
            return {
                kind: 'ok',
                line1a, line1b,
                line2a, line2b, line2c, line2d, line2e, line2f, line2g, line2h, line2i,
                line2j, line2k, line2l, line2m, line2n, line2o, line2p, line2q, line2r,
                line2s, line2t,
                line3, line4BeforeAddBack, line4, line5, line6,
                line7: flatTwentySixTwentyEight,
                line8,
                line9: flatTwentySixTwentyEight - line8,
                line10,
                line11: 0n,
                line7IsAnUpperBound: true,
                isoSpreadCents: line2i,
                partThree: undefined,
            }
        }
        // The bound did NOT settle it, so Part III has to be filled in for
        // real. The one case it cannot be: the regular tax completed NEITHER
        // preferential worksheet, which leaves lines 15, 20 and 27 reading
        // printed fallbacks this engine does not model.
        if (regularPreferentialWorksheet.kind === 'none') {
            return noRegularPreferentialWorksheetRefusal
        }
        // Part III, lines 12-40. Line 12 is line 6 -- "Enter the amount from
        // Form 6251, line 6" -- which is what makes line 39 identically
        // `flatTwentySixTwentyEight` and the bound above exact.
        const partThreeResult = partThree(taxParamSet)({
            status,
            line12Cents: line6,
            scheduleD19Cents,
            regularWorksheet: regularPreferentialWorksheet,
        })
        // THE BOUND, ASSERTED WHERE IT COULD FAIL. Everything above rests on
        // Part III's answer never exceeding the flat figure; line 40's own
        // printed `min` against line 39 makes that structural, and line 39 is
        // this same computation on this same amount. Asserted rather than
        // trusted, because if it ever failed, every `$0.00` this module returned
        // on the short-circuit above would have been an understatement --
        // `fjs/tax/line16/qdcgt`'s own argument for asserting instead of
        // flooring, applied to the one invariant this form cannot get wrong.
        assert(
            partThreeResult.line39 === flatTwentySixTwentyEight,
            ['Form 6251 line 39 must be line 7\'s own flat figure',
                partThreeResult.line39, flatTwentySixTwentyEight])
        assert(
            partThreeResult.line40 <= flatTwentySixTwentyEight,
            ['Form 6251 Part III must never exceed the flat 26/28% figure',
                partThreeResult.line40, flatTwentySixTwentyEight])
        // 7, via Part III: "Enter the smaller of line 38 or line 39 HERE AND ON
        //    LINE 7."
        const line7FromPartThree = partThreeResult.line40
        const line9FromPartThree = line7FromPartThree - line8
        return {
            kind: 'ok',
            line1a, line1b,
            line2a, line2b, line2c, line2d, line2e, line2f, line2g, line2h, line2i,
            line2j, line2k, line2l, line2m, line2n, line2o, line2p, line2q, line2r,
            line2s, line2t,
            line3, line4BeforeAddBack, line4, line5, line6,
            line7: line7FromPartThree,
            line8,
            line9: line9FromPartThree,
            line10,
            line11: max(line9FromPartThree - line10)(0n),
            // The figures ARE the printed figures now, so the flag is false --
            // which is exactly what it has always meant.
            line7IsAnUpperBound: false,
            isoSpreadCents: line2i,
            partThree: partThreeResult,
        }
    }

    // 9. "Tentative minimum tax. Subtract line 8 from line 7."
    const line7 = flatTwentySixTwentyEight
    const line9 = line7 - line8
    // 11. "AMT. Subtract line 10 from line 9. If zero or less, enter -0-.
    //     Enter here and on Schedule 2 (Form 1040), line 2." THE EXCESS, and
    //     only the excess.
    const line11 = max(line9 - line10)(0n)

    return {
        kind: 'ok',
        line1a, line1b,
        line2a, line2b, line2c, line2d, line2e, line2f, line2g, line2h, line2i,
        line2j, line2k, line2l, line2m, line2n, line2o, line2p, line2q, line2r,
        line2s, line2t,
        line3, line4BeforeAddBack, line4, line5, line6,
        line7, line8, line9, line10, line11,
        line7IsAnUpperBound: false,
        isoSpreadCents: line2i,
        partThree: undefined,
    }
}

// ── Tests ────────────────────────────────────────────────────────────────────

/**
 * TY2025's parameter set, narrowed exactly once at module scope — the same
 * `assert` path every other consumer uses.
 */
const taxParams2025 = taxParamsByYear[2025]
assert(taxParams2025 !== undefined, 'expected TY2025 parameters to be present in taxParamsByYear')

/** The shared DOC-13 fixture hash every dialect in this tree reuses.
 * @type {string}
 */
const sharedSourceArtifactHash = 'deadbeef00112233445566778899aabbccddeeff0011223344556677889900'

/**
 * A stored Form 3921 with the three boxes the spread reads.
 * @type {(hash: string) => (exercisePrice: string) => (fairMarketValue: string) => (shares: string) => Stored<FormThirtyNineTwentyOne>}
 */
const isoForm = hash => exercisePrice => fairMarketValue => shares => ({
    documentHash: hash,
    value: {
        dialect: 'vnd.fjs.form3921',
        transferorTin: '11-1111111',
        employeeTin: '222-22-2222',
        accountNumber: 'ACC-0001',
        taxYear: 2025,
        formRevision: 'April 2025',
        sourceArtifactHash: sharedSourceArtifactHash,
        box2DateOptionExercised: '03/13/2025',
        box3ExercisePricePerShare: exercisePrice,
        box4FairMarketValuePerShareOnExerciseDate: fairMarketValue,
        box5NumberOfSharesTransferred: shares,
    },
})

/**
 * A stored beneficiary's Schedule K-1 (Form 1041) carrying exactly the box 12
 * rows given, and no income box at all — these leaves are about line 2j, not
 * about Schedule E.
 * @type {(hash: string) => (box12: readonly CodedEntry[]) => Stored<K1EstateTrust>}
 */
const beneficiaryK1 = hash => box12 => ({
    documentHash: hash,
    value: {
        dialect: 'vnd.fjs.k1_1041',
        estateOrTrustEIN: '66-6666666',
        beneficiaryIdentifyingNumber: '222-22-2222',
        taxYear: 2025,
        formRevision: '2025',
        payerName: 'The Harrow Family Trust',
        boxHDomesticBeneficiary: /** @type {const} */ (true),
        materialParticipation: 'materiallyParticipated',
        box12AlternativeMinimumTaxItems: box12,
    },
})

/**
 * Every input zero, no documents, single filer — the base every fixture below
 * widens. Written out rather than defaulted, so a fixture that forgets a field
 * gets an explicit zero rather than an `undefined`.
 * @type {Form6251Input}
 */
const nothing = {
    status: 'single',
    amtDepreciationAdjustmentCents: 0n,
    form2555ExclusionCents: 0n,
    form2555ItemizedDeductionsAndExclusionsNotClaimedCents: 0n,
    adjustedGrossIncomeCents: 0n,
    totalDeductionsCents: 0n,
    scheduleOneALine37Cents: 0n,
    itemizing: false,
    scheduleALine7Cents: 0n,
    standardDeductionCents: 0n,
    isoExerciseForms: [],
    aStoredNineteenNineBReportsASale: false,
    specifiedPrivateActivityBondInterestCents: 0n,
    estateTrustK1Forms: [],
    regularTaxCents: 0n,
    scheduleTwoLine1zCents: 0n,
    scheduleThreeLine1Cents: 0n,
    qualifiedDividendsCents: 0n,
    capitalGainDistributionsCents: 0n,
    filingScheduleD: false,
    scheduleD15Cents: 0n,
    scheduleD16Cents: 0n,
    scheduleD19Cents: 0n,
    // The base fixture reports no preferential income at all, so the regular tax
    // completed no preferential worksheet -- which is the HONEST default here and
    // not merely the empty one. Fixtures that DO reach Part III override it, and
    // `partThreeRefusesWhenTheRegularTaxCompletedNeitherWorksheet` is the leaf
    // that exercises this arm reaching Part III.
    regularPreferentialWorksheet: { kind: 'none' },
}

/**
 * The regular tax's QDCGT lines 4 and 5, as a fixture helper — `line4` is the
 * preferential slice (qualified dividends plus net capital gain) and `line5` the
 * ordinary remainder of taxable income.
 * @type {(line4: bigint) => (line5: bigint) => RegularPreferentialWorksheet}
 */
const regularQdcgt = line4 => line5 => ({
    kind: 'qdcgt', qdcgtLine4Cents: line4, qdcgtLine5Cents: line5,
})

/**
 * An ordinary wage return, expressed the way `fjs/form1040/core` would hand it
 * over: adjusted gross income, the standard deduction as both the total
 * deduction and the line 12e figure, and the regular tax already computed.
 * @type {(agi: bigint) => (standardDeduction: bigint) => (regularTax: bigint) => Form6251Input}
 */
const wageReturn = agi => standardDeduction => regularTax => ({
    ...nothing,
    adjustedGrossIncomeCents: agi,
    totalDeductionsCents: standardDeduction,
    standardDeductionCents: standardDeduction,
    regularTaxCents: regularTax,
})

/** Runs Form 6251 against TY2025's real parameter set.
 * @type {(input: Form6251Input) => Form6251Outcome}
 */
const run = input => form6251(taxParams2025)(input)

/**
 * Unwraps a `Form6251Ok`, throwing the whole outcome if it was an error.
 * @type {(outcome: Form6251Outcome) => Form6251Ok}
 */
const expectOk = outcome => {
    assert(outcome.kind === 'ok', ['expected ok', outcome])
    return outcome
}

/** TY2025's single-filer standard deduction, hand-typed. @type {bigint} */
const singleStandardDeduction = 1575000n

export const proof = {
    // ── i6251 p10's Foreign Earned Income Tax Worksheet—Line 7 (TAX-42) ─────
    //
    // A single filer with $250,000.00 of adjusted gross income and the
    // standard deduction, hand-computed against Rev. Proc. 2024-40 §2.11 and
    // §55(b)(1)'s two rates:
    //
    //   line 4 (AMTI) = $234,250.00 taxable income + $15,750.00 added back
    //                 = $250,000.00
    //   line 5        = $88,100.00 (below the $626,350.00 phase-out threshold)
    //   line 6        = $161,900.00
    //
    // With a $130,000.00 exclusion the worksheet's line 3 is $291,900.00:
    //   line 4 = 26%×239,100 = 62,166.00 + 28%×52,800 = 14,784.00 → $76,950.00
    //   line 5 = 26%×130,000                          →           $33,800.00
    //   line 6 = 76,950.00 − 33,800.00                →           $43,150.00
    //
    // Without it, line 7 is 26% × 161,900.00 = $42,094.00 — so ignoring the
    // worksheet UNDERSTATES the tentative minimum tax by $1,056.00, in the
    // taxpayer's favour, which is why it is implemented rather than skipped.
    foreignEarnedIncomeTaxWorksheetForLineSeven: {
        theExclusionStacksUnderneathTheAlternativeMinimumTax: () => {
            const base = wageReturn(25000000n)(singleStandardDeduction)(0n)
            const without = expectOk(run(base))
            assertEq(without.line6, 16190000n, '$250,000.00 − $88,100.00')
            assertEq(without.line7, 4209400n, '26% of $161,900.00')
            const withExclusion = expectOk(run({ ...base, form2555ExclusionCents: 13000000n }))
            assertEq(withExclusion.line6, 16190000n, 'line 6 itself does not move')
            assertEq(withExclusion.line7, 4315000n, '$76,950.00 − $33,800.00')
            assert(
                withExclusion.line7 !== without.line7,
                ['the worksheet must move line 7', withExclusion.line7])
        },
        // THE CONTROL, and the one that makes the single-expression form above
        // safe: with no exclusion the worksheet is `flatOn(line6) − flatOn(0)`,
        // and `flatOn(0)` is zero, so it IS the ordinary answer rather than a
        // second code path that happens to agree.
        theWorksheetIsANoOpWithNoExclusion: () => {
            const base = wageReturn(25000000n)(singleStandardDeduction)(0n)
            assertEq(
                expectOk(run({ ...base, form2555ExclusionCents: 0n })).line7,
                expectOk(run(base)).line7)
        },
        // Worksheet line 2b reduces the stack. $30,000.00 of itemized
        // deductions related to the excluded income puts line 2c at
        // $100,000.00 and line 3 at $261,900.00:
        //   line 4 = 28%×261,900 − 4,782 = 73,332.00 − 4,782.00 = $68,550.00
        //   line 5 = 26%×100,000                                = $26,000.00
        //   line 6 = 68,550.00 − 26,000.00                      = $42,550.00
        lineTwoBReducesTheStack: () => {
            const result = expectOk(run({
                ...wageReturn(25000000n)(singleStandardDeduction)(0n),
                form2555ExclusionCents: 13000000n,
                form2555ItemizedDeductionsAndExclusionsNotClaimedCents: 3000000n,
            }))
            assertEq(result.line7, 4255000n, '$68,550.00 − $26,000.00 = $42,550.00')
            assert(
                result.line7 !== 4315000n,
                ['ignoring line 2b would leave $43,150.00', result.line7])
        },
        // The worksheet's own `Before you begin`: "If Form 6251, line 6, is
        // zero, don't complete this worksheet." A $50,000.00 salary puts AMTI
        // below the $88,100.00 exemption, so line 6 is zero and the exclusion
        // — however large — changes nothing. **This is the arm every ordinary
        // expatriate return takes**, and it is why the refusal below costs so
        // little.
        aZeroLineSixIgnoresTheWorksheetEntirely: () => {
            const result = expectOk(run({
                ...wageReturn(5000000n)(singleStandardDeduction)(0n),
                form2555ExclusionCents: 13000000n,
                qualifiedDividendsCents: 500000n,
            }))
            assertEq(result.line6, 0n, '$50,000.00 is below the $88,100.00 exemption')
            assertEq(result.line7, 0n)
            assertEq(result.line11, 0n, 'and no alternative minimum tax at all')
        },
        // Part III with a §911 exclusion REFUSES: i6251's worksheet routes
        // line 4 through Part III "with certain modifications" this engine has
        // not transcribed, and the flat bound the module leans on stops
        // holding once the excluded income is stacked underneath.
        partThreeWithAnExclusionRefusesRatherThanBounding: () => {
            const outcome = run({
                ...wageReturn(25000000n)(singleStandardDeduction)(0n),
                form2555ExclusionCents: 13000000n,
                qualifiedDividendsCents: 500000n,
                regularPreferentialWorksheet: regularQdcgt(500000n)(22925000n),
            })
            assert(outcome.kind === 'error', ['expected a refusal', outcome])
            assert(
                outcome.message.includes('Foreign Earned Income Tax Worksheet'),
                ['the refusal must name the worksheet', outcome.message])
            assert(
                outcome.message.includes('Part III'),
                ['and the part it cannot complete', outcome.message])
            assert(
                outcome.message.includes('Schedule 2 line 2'),
                ['and where the amount would have gone', outcome.message])
        },
        // THE CONTROLS, both directions. Preferential income WITHOUT the
        // exclusion computes, and the exclusion WITHOUT preferential income
        // computes — only the combination refuses.
        controlPreferentialIncomeAloneStillComputes: () => {
            const outcome = run({
                ...wageReturn(25000000n)(singleStandardDeduction)(0n),
                qualifiedDividendsCents: 500000n,
                regularPreferentialWorksheet: regularQdcgt(500000n)(22925000n),
            })
            assertEq(outcome.kind, 'ok', ['preferential income alone must compute', outcome])
        },
        controlTheExclusionAloneStillComputes: () => {
            const outcome = run({
                ...wageReturn(25000000n)(singleStandardDeduction)(0n),
                form2555ExclusionCents: 13000000n,
            })
            assertEq(outcome.kind, 'ok', ['the exclusion alone must compute', outcome])
        },
    },
    // THE REGRESSION CONTROL, first on purpose and stated three ways. A return
    // with nothing at all, and an ordinary wage return, and a HIGH-income wage
    // return: none adds a cent of AMT. Criterion 5, at this module.
    anOrdinaryReturnAddsNothing: () => {
        assertEq(expectOk(run(nothing)).line11, 0n, 'no income at all')
        // A $90,000.00 salary. AMTI = taxable income + the standard deduction
        // added back = $74,250.00 + $15,750.00 = $90,000.00, which is above
        // NOTHING: the exemption is $88,100.00, so line 6 is $1,900.00 and the
        // form does NOT short-circuit -- 26% of $1,900.00 is $494.00, against
        // a regular tax of roughly $12,000.00, so line 11 is still zero.
        const salary = expectOk(run(wageReturn(9000000n)(singleStandardDeduction)(1200000n)))
        assertEq(salary.line4, 9000000n, 'AMTI = $90,000.00 -- the standard deduction is added back')
        assertEq(salary.line6, 190000n, '$90,000.00 - $88,100.00 = $1,900.00')
        assertEq(salary.line7, 49400n, '26% of $1,900.00 = $494.00')
        assertEq(salary.line11, 0n, 'and it loses to a $12,000.00 regular tax')
        // A $400,000.00 salary, where the tentative minimum tax is a real
        // six-figure number and still loses.
        //   AMTI      400,000.00
        //   line 5    88,100.00 (below the $626,350 threshold: no phase-out)
        //   line 6    311,900.00
        //   line 7    26% of 239,100 = 62,166.00, plus 28% of 72,800 = 20,384.00
        //             = 82,550.00
        //   line 10   a regular tax of 100,000.00
        //   line 11   -0-
        const high = expectOk(run(wageReturn(40000000n)(singleStandardDeduction)(10000000n)))
        assertEq(high.line5, 8810000n, 'the full exemption: AMTI is below the phase-out threshold')
        assertEq(high.line6, 31190000n, '$400,000.00 - $88,100.00 = $311,900.00')
        assertEq(high.line7, 8255000n, '$62,166.00 + $20,384.00 = $82,550.00')
        assertEq(high.line11, 0n, 'the AMT is the EXCESS, and there is none')
    },
    // THE PHASE'S MOTIVATING RETURN. A FAANG employee exercises an incentive
    // stock option and HOLDS: 10,000 shares, a $5.00 strike, a $105.00 fair
    // market value at exercise. Nothing was sold, so no cash came in and the
    // regular tax does not know the exercise happened at all.
    //
    //   Form 3921  box 4 x box 5   105.00 x 10,000        $1,050,000.00
    //              box 3 x box 5     5.00 x 10,000           $50,000.00
    //   line 2i    the spread                            $1,000,000.00
    //
    //   salary                                              $250,000.00
    //   1040 line 14 / 12e   the standard deduction           $15,750.00
    //   1040 line 11b        AGI                             $250,000.00
    //   line 1a    250,000.00 - 15,750.00 is NOT this line; line 1a is the
    //              DEDUCTION: 15,750.00 - 0.00                $15,750.00
    //   line 1b    250,000.00 - 15,750.00                    $234,250.00
    //   line 2a    the standard-deduction add-back            $15,750.00
    //   line 4     234,250.00 + 15,750.00 + 1,000,000.00   $1,250,000.00
    //   line 5     the exemption phases out: AMTI is 1,250,000.00 - 626,350.00
    //              = 623,650.00 over the threshold; 25% of that is 155,912.50,
    //              which exceeds the $88,100.00 exemption, so                $0.00
    //   line 6     1,250,000.00 - 0.00                     $1,250,000.00
    //   line 7     26% of 239,100.00                          $62,166.00
    //            + 28% of 1,010,900.00                       $283,052.00
    //                                                        $345,218.00
    //   line 10    a regular tax of                            $55,000.00
    //   line 11    345,218.00 - 55,000.00                     $290,218.00
    //
    // $290,218.00 of tax on income never received, in a year the employee sold
    // nothing. That is what Form 6251 is for.
    theIncentiveStockOptionExerciseAndHold: () => {
        const result = expectOk(run({
            ...wageReturn(25000000n)(singleStandardDeduction)(5500000n),
            isoExerciseForms: [isoForm('doc-iso')('5.00')('105.00')('10000')],
        }))
        assertEq(result.isoSpreadCents, 100000000n, 'the spread: $1,000,000.00')
        assertEq(result.line2i, 100000000n, 'and it lands on line 2i')
        assertEq(result.line1a, 1575000n, 'line 1a = $15,750.00 of deduction, less $0.00 of Sch 1-A')
        assertEq(result.line1b, 23425000n, 'line 1b = $250,000.00 - $15,750.00 = $234,250.00')
        assertEq(result.line2a, 1575000n, 'line 2a = the standard deduction, added back')
        assertEq(result.line4, 125000000n, 'line 4 = AMTI = $1,250,000.00')
        assertEq(result.line5, 0n, 'line 5 = $0.00 -- the exemption is fully phased out')
        assertEq(result.line6, 125000000n)
        assertEq(result.line7, 34521800n, 'line 7 = $62,166.00 + $283,052.00 = $345,218.00')
        assertEq(result.line9, 34521800n, 'line 9 = line 7, there being no AMT foreign tax credit')
        assertEq(result.line10, 5500000n, 'line 10 = the regular tax')
        assertEq(result.line11, 29021800n, 'line 11 = $345,218.00 - $55,000.00 = $290,218.00')
        assertEq(result.line7IsAnUpperBound, false, 'Part III was never reached: no preferential income')
    },
    // THE EXCESS, AND ONLY THE EXCESS -- stated as a pair on ONE fixture, so a
    // wiring that reported the tentative minimum tax itself, rather than its
    // excess over the regular tax, reddens. The SAME return as above with a
    // regular tax one cent BELOW and one cent ABOVE the tentative minimum tax.
    theAmtIsTheExcessAndNothingWhenThereIsNone: () => {
        const withIso = {
            ...wageReturn(25000000n)(singleStandardDeduction)(0n),
            isoExerciseForms: [isoForm('doc-iso-excess')('5.00')('105.00')('10000')],
        }
        const tentative = 34521800n
        const oneCentBelow = expectOk(run({ ...withIso, regularTaxCents: tentative - 1n }))
        assertEq(oneCentBelow.line11, 1n, 'a regular tax one cent short leaves exactly one cent of AMT')
        const exactly = expectOk(run({ ...withIso, regularTaxCents: tentative }))
        assertEq(exactly.line11, 0n, 'exactly equal: no excess, no AMT')
        const oneCentAbove = expectOk(run({ ...withIso, regularTaxCents: tentative + 1n }))
        assertEq(oneCentAbove.line11, 0n, '"If zero or less, enter -0-" -- never a negative AMT')
        assertEq(oneCentAbove.line9, tentative, 'and line 9 is unchanged: only line 11 floors')
    },
    partOne: {
        // The standard-deduction add-back, isolated. §56(b)(1)(E) disallows
        // the standard deduction, and the printed form implements that by
        // subtracting it at line 1a and adding it back at line 2a. Both halves
        // asserted, and the NET asserted too -- a wiring that dropped BOTH
        // would leave line 4 identical and only this third assertion would
        // notice.
        theStandardDeductionIsSubtractedThenAddedStraightBack: () => {
            const result = expectOk(run(wageReturn(10000000n)(singleStandardDeduction)(0n)))
            assertEq(result.line1a, 1575000n, 'subtracted at line 1a')
            assertEq(result.line1b, 8425000n, '$100,000.00 - $15,750.00 = $84,250.00 of taxable income')
            assertEq(result.line2a, 1575000n, 'and added straight back at line 2a')
            assertEq(result.line4, 10000000n, 'so AMTI is the whole $100,000.00 of AGI')
            // The NET, stated against the AGI the fixture supplied rather than
            // against a second literal: dropping BOTH halves of the add-back
            // would leave line 4 identical to dropping neither, and only this
            // comparison against the input would notice a pair that moved
            // together in the wrong direction.
            assertEq(
                result.line1b + result.line2a, 10000000n,
                'the add-back is exact: line 1b plus line 2a is the whole AGI again')
        },
        // An ITEMIZING return takes Schedule A line 7 instead, and the two are
        // genuinely different numbers -- §56(b)(1)(A)(ii) disallows the state
        // and local tax deduction for the AMT, and line 2a is how the printed
        // form adds it back. A filer with $10,000.00 of SALT inside $30,000.00
        // of itemized deductions adds back the $10,000.00, not the $30,000.00.
        anItemizingReturnAddsBackScheduleALineSevenNotTheWholeDeduction: () => {
            const result = expectOk(run({
                ...nothing,
                adjustedGrossIncomeCents: 30000000n,
                totalDeductionsCents: 3000000n,
                itemizing: true,
                scheduleALine7Cents: 1000000n,
                // Present and DIFFERENT, so a wiring that read the wrong field
                // would produce a different answer rather than the same one.
                standardDeductionCents: singleStandardDeduction,
            }))
            assertEq(result.line1b, 27000000n, '$300,000.00 - $30,000.00 = $270,000.00')
            assertEq(result.line2a, 1000000n, 'line 2a = Schedule A line 7, the $10,000.00 of taxes')
            assertEq(result.line4, 28000000n, 'AMTI = $270,000.00 + $10,000.00 = $280,000.00')
            assert(
                result.line2a !== singleStandardDeduction,
                'an itemizing return must NOT add back the standard deduction')
        },
        // Line 1b may be NEGATIVE, and the printed instruction says so in
        // those words. A retiree with $10,000.00 of adjusted gross income and
        // a $15,750.00 standard deduction has -$5,750.00 of taxable income for
        // this line's purposes, and flooring it would overstate AMTI by
        // $5,750.00.
        lineOneBMayBeNegativeAndIsNotFloored: () => {
            const result = expectOk(run(wageReturn(1000000n)(singleStandardDeduction)(0n)))
            assertEq(result.line1b, -575000n, '$10,000.00 - $15,750.00 = -$5,750.00')
            assertEq(result.line4, 1000000n, 'and AMTI comes back to the $10,000.00 of AGI')
            assertEq(result.line6, 0n, 'far below the exemption')
            assertEq(result.line11, 0n)
        },
        // Schedule 1-A line 37 is SUBTRACTED from the deduction total at line
        // 1a, which means the senior deduction is added back into AMTI while
        // the tips/overtime/car-loan deductions on Schedule 1-A lines 13, 21
        // and 30 are not. A 65-year-old with a $6,000.00 senior deduction:
        // line 1a is the deduction total LESS that $6,000.00.
        theSeniorDeductionIsAddedBackIntoAlternativeMinimumTaxableIncome: () => {
            const withoutSenior = expectOk(run(wageReturn(5000000n)(singleStandardDeduction)(0n)))
            // 1040 line 14 is line 12e PLUS lines 13a and 13b, so a senior
            // deduction raises the TOTAL deduction while leaving line 12e --
            // the standard deduction line 2a adds back -- exactly where it
            // was. Setting both to the same figure, as a first draft of this
            // fixture did, adds the senior deduction back TWICE and makes AMTI
            // $6,000.00 too high.
            const withSenior = expectOk(run({
                ...nothing,
                adjustedGrossIncomeCents: 5000000n,
                totalDeductionsCents: singleStandardDeduction + 600000n,
                standardDeductionCents: singleStandardDeduction,
                scheduleOneALine37Cents: 600000n,
            }))
            assertEq(withSenior.line1a, 1575000n, 'line 1a = $21,750.00 - $6,000.00 = $15,750.00')
            assertEq(
                withSenior.line4, withoutSenior.line4,
                'the senior deduction reduces regular taxable income and NOT AMTI')
            assertEq(withSenior.line4, 5000000n, 'AMTI is still the whole $50,000.00 of AGI')
        },
        // HONESTY LEAF, and it is here because the alternative is a fixture
        // that pretends to pin something it cannot. Form 6251 line 1a reads
        // Schedule 1-A line **37**, not the line 38 total that reaches 1040
        // line 13b, and this engine models only Parts I, V and VI of that
        // schedule -- so lines 13, 21 and 30 are permanently zero and 37 and
        // 38 are EQUAL. No input to this module can tell the two apart; a
        // mutation swapping them would be an equivalent mutant.
        //
        // What this leaf pins instead is the shape of the input: line 1a
        // subtracts a figure that is NOT the whole Schedule 1-A total the
        // moment those three parts compute. The day `fjs/schedule/1a` grows
        // Parts II/III/IV, `fjs/schedule/2`'s own wiring has to choose, and
        // this comment is where the choice is written down.
        theScheduleOneALineThisFormReadsIsNotYetDistinguishable: () => {
            const result = expectOk(run({
                ...wageReturn(5000000n)(2175000n)(0n),
                scheduleOneALine37Cents: 600000n,
            }))
            assertEq(result.line1a, 1575000n, 'line 1a subtracts whatever it is handed')
            // The claim, as an assertion about this module's INPUT rather than
            // about Schedule 1-A: the field is named for line 37, and a caller
            // handing it line 38 would be handing it a different number the
            // day the two differ.
            assert(
                'scheduleOneALine37Cents' in nothing,
                'the input field is named for the printed line it reads, not for the schedule total')
        },
    },
    exemption: {
        // THE PHASE-OUT BOUNDARIES, per status, at the threshold and one cent
        // past it -- the exercise the phase brief asks for. The thresholds are
        // HAND-TYPED here rather than read from `fjs/tax/params`: a boundary
        // proof whose boundary came from the code under test could never
        // notice the boundary moving.
        theBoundaryPairAtEveryStatus: () => {
            /** @type {Record<IndividualFilingStatus, readonly [bigint, bigint]>} */
            const thresholdAndExemption = {
                single: [62635000n, 8810000n],
                marriedFilingJointly: [125270000n, 13700000n],
                marriedFilingSeparately: [62635000n, 6850000n],
                headOfHousehold: [62635000n, 8810000n],
                qualifyingSurvivingSpouse: [125270000n, 13700000n],
            }
            /** @type {readonly IndividualFilingStatus[]} */
            const everyStatus = [
                'single', 'marriedFilingJointly', 'marriedFilingSeparately',
                'headOfHousehold', 'qualifyingSurvivingSpouse',
            ]
            for (const status of everyStatus) {
                const [threshold, exemption] = assertNotNullish(
                    thresholdAndExemption[status], status)
                // Exactly AT the threshold: the worksheet's line 4 is zero, so
                // the whole exemption survives. AMTI is driven entirely by the
                // ISO spread here, so the fixture's AMTI is exact.
                const at = expectOk(run({
                    ...nothing, status, adjustedGrossIncomeCents: threshold,
                }))
                assertEq(at.line4, threshold, ['AMTI is exactly the threshold', status])
                assertEq(at.line5, exemption, ['exactly at the threshold: no phase-out', status])
                // One cent above: 25% of ONE cent is a QUARTER of a cent, and
                // half-up rounds a quarter DOWN, so the exemption is still
                // whole. This is not a rounding accident to be papered over —
                // it is the phase-out's real granularity, and asserting a
                // one-cent drop here (as a first draft of this leaf did) would
                // have been asserting arithmetic nobody had done.
                const oneCentAbove = expectOk(run({
                    ...nothing, status, adjustedGrossIncomeCents: threshold + 1n,
                }))
                assertEq(
                    oneCentAbove.line5, exemption,
                    ['one cent above: 25% of a cent is a quarter, which rounds down', status])
                // TWO cents above: 25% of two cents is exactly half a cent,
                // which half-up rounds AWAY from zero to one. So the first
                // cent of exemption is lost here, and nowhere else. This is
                // the assertion that catches a `>` silently becoming `>=`, the
                // 25% becoming any other rate, and half-up becoming
                // round-half-even.
                const twoCentsAbove = expectOk(run({
                    ...nothing, status, adjustedGrossIncomeCents: threshold + 2n,
                }))
                assertEq(
                    twoCentsAbove.line5, exemption - 1n,
                    ['two cents above: 25% of two cents is a tie, and ties go away from zero', status])
                // One cent BELOW: still the whole exemption, so the boundary is
                // pinned from both sides.
                const below = expectOk(run({
                    ...nothing, status, adjustedGrossIncomeCents: threshold - 1n,
                }))
                assertEq(below.line5, exemption, ['one cent below: no phase-out either', status])
            }
        },
        // The COMPLETE phase-out, per status, and one cent either side of it.
        // Above this figure the exemption is exactly zero and stays there --
        // the worksheet's own "If zero or less, enter -0-" floor, which
        // without this leaf could go negative and INCREASE line 6.
        theExemptionReachesZeroAtTheCompletePhaseoutAndStopsThere: () => {
            /** @type {Record<IndividualFilingStatus, bigint>} */
            const completePhaseout = {
                single: 97875000n,
                marriedFilingJointly: 180070000n,
                // MFS: below its own add-back threshold this figure is not
                // reachable without the add-back firing, so it is exercised
                // through the add-back leaf instead -- see
                // `theMarriedFilingSeparatelyAddBack` below.
                marriedFilingSeparately: 90035000n,
                headOfHousehold: 97875000n,
                qualifyingSurvivingSpouse: 180070000n,
            }
            for (const status of ['single', 'marriedFilingJointly', 'headOfHousehold', 'qualifyingSurvivingSpouse']) {
                const narrowed = assertNotNullish(
                    ['single', 'marriedFilingJointly', 'marriedFilingSeparately', 'headOfHousehold', 'qualifyingSurvivingSpouse']
                        .find(candidate => candidate === status),
                    status)
                const only = /** @type {IndividualFilingStatus} */ (narrowed)
                const complete = assertNotNullish(completePhaseout[only], status)
                const oneCentBelow = expectOk(run({
                    ...nothing, status: only, adjustedGrossIncomeCents: complete - 4n,
                }))
                assert(
                    oneCentBelow.line5 > 0n,
                    ['four cents below the complete phase-out, a cent of exemption survives', status,
                        oneCentBelow.line5])
                const at = expectOk(run({
                    ...nothing, status: only, adjustedGrossIncomeCents: complete,
                }))
                assertEq(at.line5, 0n, ['exactly at the complete phase-out: zero', status])
                const far = expectOk(run({
                    ...nothing, status: only, adjustedGrossIncomeCents: complete + 100000000n,
                }))
                assertEq(far.line5, 0n, ['and it stays zero, never negative', status])
                assertEq(
                    far.line6, far.line4,
                    ['with no exemption, line 6 is the whole of AMTI', status])
            }
        },
        // THE MARRIED-FILING-SEPARATELY ADD-BACK, which is the one piece of
        // Part I that reads a Part II figure. The printed instruction's own
        // worked example, transcribed: "if the amount on line 4 is $920,350,
        // enter $925,350 instead -- the additional $5,000 is 25% of $20,000
        // ($920,350 minus $900,350)."
        theMarriedFilingSeparatelyAddBack: () => {
            const worked = expectOk(run({
                ...nothing, status: 'marriedFilingSeparately',
                adjustedGrossIncomeCents: 92035000n,
            }))
            assertEq(worked.line4BeforeAddBack, 92035000n, 'AMTI before the paragraph: $920,350.00')
            assertEq(worked.line4, 92535000n, 'the instructions\' own answer: $925,350.00')
            // The cap: "If line 4 is $1,174,350 or more, include an additional
            // $68,500." Hand-typed from the instruction, and $1,174,350 is
            // $900,350 + four times the $68,500 exemption.
            const atTheCap = expectOk(run({
                ...nothing, status: 'marriedFilingSeparately',
                adjustedGrossIncomeCents: 117435000n,
            }))
            assertEq(atTheCap.line4, 117435000n + 6850000n, 'capped at the $68,500.00 exemption')
            const wayAbove = expectOk(run({
                ...nothing, status: 'marriedFilingSeparately',
                adjustedGrossIncomeCents: 500000000n,
            }))
            assertEq(wayAbove.line4 - wayAbove.line4BeforeAddBack, 6850000n, 'still capped')
            // The control, and it is the half most likely to be got wrong: the
            // add-back is MFS-only. The identical AMTI on every other status
            // adds nothing.
            for (const status of ['single', 'marriedFilingJointly', 'headOfHousehold', 'qualifyingSurvivingSpouse']) {
                const narrowed = assertNotNullish(
                    ['single', 'marriedFilingJointly', 'marriedFilingSeparately', 'headOfHousehold', 'qualifyingSurvivingSpouse']
                        .find(candidate => candidate === status),
                    status)
                const only = /** @type {IndividualFilingStatus} */ (narrowed)
                const other = expectOk(run({
                    ...nothing, status: only, adjustedGrossIncomeCents: 92035000n,
                }))
                assertEq(
                    other.line4, other.line4BeforeAddBack,
                    ['only married filing separately adds back', status])
            }
            // …and BELOW the threshold, MFS adds nothing either.
            const belowThreshold = expectOk(run({
                ...nothing, status: 'marriedFilingSeparately',
                adjustedGrossIncomeCents: 90035000n,
            }))
            assertEq(
                belowThreshold.line4, belowThreshold.line4BeforeAddBack,
                'exactly AT $900,350.00 is not "more than" it')
        },
    },
    rateSchedule: {
        // THE TWO RATES, and the printed shortcut they are equivalent to. The
        // form says "multiply line 6 by 28% and subtract $4,782" above the
        // breakpoint; this module says "26% of the first $239,100 plus 28% of
        // the rest". The two constants are HAND-TYPED off the printed page,
        // and this is the leaf that proves the two statements of one rule
        // agree -- at the breakpoint, one cent above it, and far above it.
        theTwentySixTwentyEightScheduleMatchesThePrintedShortcut: () => {
            /** @type {(status: IndividualFilingStatus) => (breakpoint: bigint) => (subtrahend: bigint) => void} */
            const check = status => breakpoint => subtrahend => {
                // The printed shortcut, written out here independently of the
                // module: 26% below the breakpoint, otherwise 28% of the whole
                // less the constant.
                /** @type {(lineSix: bigint) => bigint} */
                const printedShortcut = lineSix => lineSix <= breakpoint
                    ? percentOfCents(lineSix)(26n)
                    : percentOfCents(lineSix)(28n) - subtrahend
                const exemption = centsFromString(
                    taxParams2025.alternativeMinimumTax.exemption[status].amount)
                // The claim is about line 7 GIVEN line 6, so the fixture reads
                // the module's own line 6 and feeds it to the independently
                // written shortcut. Predicting line 6 from the AMTI would mean
                // re-deriving the exemption phase-out and the
                // married-filing-separately add-back here, which is a
                // different rule's job and which a first draft of this leaf
                // got wrong for exactly that reason.
                let sawTheLowerBand = false
                let sawTheUpperBand = false
                for (const amti of [breakpoint + exemption, breakpoint + exemption + 1n, 300000000n]) {
                    const result = expectOk(run({
                        ...nothing, status, adjustedGrossIncomeCents: amti,
                    }))
                    assertEq(
                        result.line7, printedShortcut(result.line6),
                        ['the two statements of §55(b)(1)(A) must agree', status, result.line6])
                    if (result.line6 <= breakpoint) {
                        sawTheLowerBand = true
                    } else {
                        sawTheUpperBand = true
                    }
                }
                // …and BOTH branches were exercised, so an agreement that held
                // only on one side of the breakpoint cannot pass.
                assert(sawTheLowerBand, ['the 26% branch was never reached', status])
                assert(sawTheUpperBand, ['the 28% branch was never reached', status])
            }
            // $239,100 and $4,782 = 2% of it; $119,550 and $2,391 = 2% of that.
            check('single')(23910000n)(478200n)
            check('marriedFilingJointly')(23910000n)(478200n)
            check('marriedFilingSeparately')(11955000n)(239100n)
            check('headOfHousehold')(23910000n)(478200n)
            check('qualifyingSurvivingSpouse')(23910000n)(478200n)
        },
        // The breakpoint is HALVED for married filing separately, and nothing
        // else about the schedule is. Asserted as a comparison between two
        // statuses at one AMTI, so a status reading the wrong row names
        // itself: at $250,000.00 of line 6, a single filer is $10,900.00 into
        // the 28% band and an MFS filer is $130,450.00 into it.
        theBreakpointIsHalvedForMarriedFilingSeparately: () => {
            const single = expectOk(run({
                ...nothing, status: 'single', adjustedGrossIncomeCents: 25000000n + 8810000n,
            }))
            assertEq(single.line6, 25000000n)
            // 26% of 239,100 = 62,166.00; 28% of 10,900 = 3,052.00.
            assertEq(single.line7, 6521800n, '$62,166.00 + $3,052.00 = $65,218.00')
            const separate = expectOk(run({
                ...nothing, status: 'marriedFilingSeparately',
                adjustedGrossIncomeCents: 25000000n + 6850000n,
            }))
            assertEq(separate.line6, 25000000n, 'the same line 6, on the other status')
            // 26% of 119,550 = 31,083.00; 28% of 130,450 = 36,526.00.
            assertEq(separate.line7, 6760900n, '$31,083.00 + $36,526.00 = $67,609.00')
            assert(
                separate.line7 > single.line7,
                'the halved breakpoint pushes more of the same base into the 28% band')
        },
    },
    incentiveStockOptions: {
        // The published example, from the printed instructions: 100 shares, a
        // $10.00 strike, a $25.00 fair market value, a $1,500.00 adjustment.
        // Asserted on the exported `isoSpread` directly as well as through the
        // form, since the instructions state the intermediate products too.
        theInstructionsWorkedExample: () => {
            assertEq(isoSpread(1000n)(2500n)(sharesFromString('100')), 150000n, '$1,500.00')
            const result = expectOk(run({
                ...nothing, isoExerciseForms: [isoForm('doc-example')('10.00')('25.00')('100')],
            }))
            assertEq(result.line2i, 150000n)
        },
        // An exercise BELOW the strike price contributes NOTHING, and two
        // exercises do not net. §83(a)'s "excess ... over" floors each
        // exercise at zero on its own, so an underwater exercise cannot shelter
        // an above-water one.
        anUnderwaterExerciseContributesNothingAndDoesNotNet: () => {
            const underwaterAlone = expectOk(run({
                ...nothing, isoExerciseForms: [isoForm('doc-under')('25.00')('10.00')('100')],
            }))
            assertEq(underwaterAlone.line2i, 0n, 'no excess, no adjustment')
            const both = expectOk(run({
                ...nothing,
                isoExerciseForms: [
                    isoForm('doc-under-2')('25.00')('10.00')('100'),
                    isoForm('doc-over')('10.00')('25.00')('100'),
                ],
            }))
            assertEq(
                both.line2i, 150000n,
                'the $1,500.00 gain stands alone: a per-exercise floor, not a floor on the sum')
        },
        // THE ORDER OF OPERATIONS, exhibited on an input where it MATTERS. The
        // printed example multiplies each per-share price by the share count
        // and subtracts LAST. With a fractional share count the two orders can
        // differ by a cent, and this fixture is chosen so they do:
        //
        //   box 3  $10.005 is not expressible; use $0.01 and $0.02 per share
        //   box 5  0.5 shares
        //   printed order:  round(0.02 x 0.5) - round(0.01 x 0.5)
        //                 = round(0.01) - round(0.005) = 1 - 1 = 0 cents
        //   other order:    round((0.02 - 0.01) x 0.5) = round(0.005) = 1 cent
        //
        // Half a cent rounds half-up to one cent in both products, so the
        // printed order yields ZERO and the difference-first order yields ONE.
        theOrderOfOperationsFollowsThePrintedExample: () => {
            const half = sharesFromString('0.5')
            assertEq(isoSpread(1n)(2n)(half), 0n, 'round(1) - round(1) = 0, the PRINTED order')
            // The order this module does NOT use, written out here so the two
            // are visibly different rather than assumed to be.
            const differenceFirst = halfUp(multiply(of(2n - 1n)(1n))(of(half)(oneShare)))
            assertEq(differenceFirst, 1n, 'round((2 - 1) x 0.5) = round(0.5) = 1')
            assert(
                isoSpread(1n)(2n)(half) !== differenceFirst,
                'the two orders genuinely disagree on this input, which is why the printed one is followed')
        },
        // A fractional share count of a realistic size still computes exactly.
        // 12.5 shares at $100.00 over a $10.00 strike: $1,250.00 - $125.00.
        aFractionalShareCountComputesExactly: () => {
            assertEq(isoSpread(1000n)(10000n)(sharesFromString('12.5')), 112500n, '$1,125.00')
        },
        // A Form 3921 missing any of the three boxes REFUSES, naming all
        // three. Each of the three shapes is exercised, because a check
        // written for box 5 alone would leave the other two silently
        // contributing a zero.
        aFormThreeNineTwoOneMissingABoxRefuses: () => {
            /** @type {(overrides: Partial<FormThirtyNineTwentyOne>) => void} */
            const expectRefusal = overrides => {
                const base = isoForm('doc-partial')('10.00')('25.00')('100')
                const outcome = run({
                    ...nothing,
                    isoExerciseForms: [{ ...base, value: { ...base.value, ...overrides } }],
                })
                assertEq(outcome.kind, 'error', ['expected a refusal', overrides, outcome])
                if (outcome.kind !== 'error') {
                    throw ['expected error', outcome]
                }
                assert(outcome.message.includes('doc-partial'), ['name the document', outcome.message])
                assert(
                    outcome.message.includes('box5NumberOfSharesTransferred'),
                    ['name the boxes the adjustment needs', outcome.message])
                assert(
                    outcome.message.includes('ABSENT'),
                    ['say WHY: an absent box is not a zero', outcome.message])
            }
            expectRefusal({ box3ExercisePricePerShare: undefined })
            expectRefusal({ box4FairMarketValuePerShareOnExerciseDate: undefined })
            expectRefusal({ box5NumberOfSharesTransferred: undefined })
            // The control, in the same leaf: the unmodified fixture computes.
            assertEq(
                expectOk(run({
                    ...nothing, isoExerciseForms: [isoForm('doc-partial')('10.00')('25.00')('100')],
                })).line2i,
                150000n)
        },
        // Both spouses' exercises land on the ONE Form 6251 a joint return
        // files -- summed WITHOUT scoping by `employeeTin`, which is the
        // opposite of what `fjs/form8863` does with the same field. Two forms
        // with two different employee TINs.
        bothSpousesExercisesLandOnOneForm: () => {
            const taxpayer = isoForm('doc-spouse-a')('10.00')('25.00')('100')
            const spouseForm = isoForm('doc-spouse-b')('10.00')('25.00')('200')
            const spouse = {
                ...spouseForm,
                value: { ...spouseForm.value, employeeTin: '444-44-4444' },
            }
            const result = expectOk(run({
                ...nothing, status: 'marriedFilingJointly',
                isoExerciseForms: [taxpayer, spouse],
            }))
            assertEq(result.line2i, 450000n, '$1,500.00 + $3,000.00 = $4,500.00')
            assert(
                taxpayer.value.employeeTin !== spouse.value.employeeTin,
                'this fixture is deliberately two different employees')
        },
        // THE SAME-YEAR DISPOSITION REFUSAL, and its control. A stored Form
        // 3921 plus any reported sale refuses; an exercise-and-HOLD -- which
        // is the case that generates AMT at all -- computes.
        aStoredFormThreeNineTwoOneWithASaleRefuses: () => {
            const outcome = run({
                ...nothing,
                isoExerciseForms: [isoForm('doc-iso-sold')('10.00')('25.00')('100')],
                aStoredNineteenNineBReportsASale: true,
            })
            assertEq(outcome.kind, 'error', ['expected a refusal', outcome])
            if (outcome.kind !== 'error') {
                throw ['expected error', outcome]
            }
            assert(outcome.message.includes('doc-iso-sold'), ['name the form', outcome.message])
            // The three things a reader can act on, each asserted separately.
            assert(
                outcome.message.includes('SAME year'),
                ['the printed rule that makes this ambiguous', outcome.message])
            assert(
                outcome.message.includes('overstate'),
                ['the direction the wrong answer would go', outcome.message])
            assert(
                outcome.message.includes('date arithmetic'),
                ['what is missing', outcome.message])
        },
        anExerciseAndHoldWithNoSaleComputes: () => {
            const result = expectOk(run({
                ...nothing,
                isoExerciseForms: [isoForm('doc-iso-held')('10.00')('25.00')('100')],
                aStoredNineteenNineBReportsASale: false,
            }))
            assertEq(result.line2i, 150000n, 'the ordinary exercise-and-hold computes')
        },
        // A return with a SALE but NO Form 3921 is untouched -- the refusal is
        // about the pair, not about either half. Without this the guard could
        // have been written on the sale alone and every brokerage return would
        // refuse.
        aSaleWithNoFormThreeNineTwoOneIsUntouched: () => {
            assertEq(
                expectOk(run({ ...nothing, aStoredNineteenNineBReportsASale: true })).line11,
                0n)
        },
    },
    // ── Line 2g: specified private activity bond interest, §57(a)(5) ─────────
    privateActivityBonds: {
        // THE MOTIVATING RETURN FOR THIS LINE, and it is a quieter one than the
        // incentive stock option's: a professional on a salary who also holds
        // municipal bonds, some of them private-activity. Every figure
        // hand-typed and derived independently below.
        //
        //   salary                                              $250,000.00
        //   1040 line 14 / 12e   the standard deduction           $15,750.00
        //   1099-INT box 8       tax-exempt interest              $60,000.00
        //   1099-INT box 9       ...of which private-activity      $60,000.00
        //
        //   line 1a    the deduction, less $0.00 of Sch 1-A         $15,750.00
        //   line 1b    250,000.00 - 15,750.00                     $234,250.00
        //   line 2a    the standard-deduction add-back             $15,750.00
        //   line 2g    box 9, added straight back                  $60,000.00
        //   line 4     234,250.00 + 15,750.00 + 60,000.00         $310,000.00
        //   line 5     310,000.00 is below the $626,350.00 phase-out
        //              threshold, so the exemption survives whole   $88,100.00
        //   line 6     310,000.00 - 88,100.00                     $221,900.00
        //   line 7     221,900.00 is below the $239,100.00 breakpoint, so 26%
        //              of the whole: 221,900.00 x 0.26             $57,694.00
        //   line 10    a regular tax of                            $52,000.00
        //   line 11    57,694.00 - 52,000.00                        $5,694.00
        //
        // $5,694.00 of tax the regular return cannot see at all — §103(a)
        // excludes every cent of that interest from gross income, so 1040 line
        // 2a reports it and line 15 does not tax it, and §57(a)(5) adds the
        // private-activity part back for the AMT alone.
        theMunicipalBondHolderWhoOwesAlternativeMinimumTax: () => {
            const result = expectOk(run({
                ...wageReturn(25000000n)(singleStandardDeduction)(5200000n),
                specifiedPrivateActivityBondInterestCents: 6000000n,
            }))
            assertEq(result.line2g, 6000000n, 'line 2g = box 9 = $60,000.00')
            assertEq(result.line1b, 23425000n, 'line 1b = $250,000.00 - $15,750.00 = $234,250.00')
            assertEq(result.line2a, 1575000n, 'line 2a = the standard deduction, added back')
            assertEq(result.line4, 31000000n, 'line 4 = AMTI = $310,000.00')
            assertEq(result.line5, 8810000n, 'the full exemption: AMTI is below the phase-out threshold')
            assertEq(result.line6, 22190000n, '$310,000.00 - $88,100.00 = $221,900.00')
            assertEq(result.line7, 5769400n, '26% of $221,900.00 = $57,694.00')
            assertEq(result.line10, 5200000n, 'line 10 = the regular tax')
            assertEq(result.line11, 569400n, 'line 11 = $57,694.00 - $52,000.00 = $5,694.00')
            assertEq(result.line7IsAnUpperBound, false, 'Part III was never reached')
            // The ISO field is untouched, so the AMT above is attributable to
            // line 2g and to nothing else this module computes.
            assertEq(result.isoSpreadCents, 0n, 'no incentive stock option is involved')
            assertEq(result.line2i, 0n)
        },
        // THE SAME RETURN WITH NO PRIVATE-ACTIVITY BONDS owes NOTHING, stated
        // as a pair against the fixture above so the whole $5,694.00 is
        // attributed to box 9 rather than to the salary. This is criterion 5 at
        // this line: a return with no tax-exempt interest computes exactly what
        // it computed before box 9 existed.
        //
        //   line 4     234,250.00 + 15,750.00                     $250,000.00
        //   line 6     250,000.00 - 88,100.00                     $161,900.00
        //   line 7     26% of 161,900.00                           $42,094.00
        //   line 11    42,094.00 loses to a 52,000.00 regular tax       -0-
        theSameReturnWithoutThemOwesNothing: () => {
            const result = expectOk(run(wageReturn(25000000n)(singleStandardDeduction)(5200000n)))
            assertEq(result.line2g, 0n, 'no box 9, no add-back')
            assertEq(result.line4, 25000000n, 'AMTI is the whole $250,000.00 of AGI and no more')
            assertEq(result.line6, 16190000n, '$250,000.00 - $88,100.00 = $161,900.00')
            assertEq(result.line7, 4209400n, '26% of $161,900.00 = $42,094.00')
            assertEq(result.line11, 0n, 'and it loses to the regular tax')
        },
        // LINE 2G REACHES AMTI ONE FOR ONE, asserted as a DIFFERENCE between
        // two runs rather than against a second literal. This is what catches a
        // wiring that computed line 2g correctly and then forgot to add it into
        // line 4 -- the field would hold the right figure and the tax would be
        // unchanged, and only a comparison across the pair notices.
        theWholeOfBoxNineLandsInAlternativeMinimumTaxableIncome: () => {
            const withBonds = expectOk(run({
                ...wageReturn(25000000n)(singleStandardDeduction)(5200000n),
                specifiedPrivateActivityBondInterestCents: 6000000n,
            }))
            const without = expectOk(run(wageReturn(25000000n)(singleStandardDeduction)(5200000n)))
            assertEq(
                withBonds.line4 - without.line4, 6000000n,
                'AMTI rises by exactly box 9, no more and no less')
            assertEq(
                withBonds.line4BeforeAddBack - without.line4BeforeAddBack, 6000000n,
                'and it is in line 4 BEFORE the married-filing-separately paragraph')
            assert(
                withBonds.line11 > without.line11,
                ['and the tax rises with it', withBonds.line11, without.line11])
        },
        // ONE CENT of box 9 moves alternative minimum taxable income by one
        // cent. Line 2g is a pass-through of a summed box, not a percentage or
        // a limitation, so nothing rounds it -- and this is the leaf that says
        // so rather than leaving it to be inferred from a round fixture.
        oneCentOfBoxNineIsOneCentOfAmti: () => {
            const result = expectOk(run({
                ...wageReturn(25000000n)(singleStandardDeduction)(5200000n),
                specifiedPrivateActivityBondInterestCents: 1n,
            }))
            assertEq(result.line2g, 1n)
            assertEq(result.line4, 25000001n, '$250,000.00 plus one cent')
        },
        // The figure lands on line 2g and on NO OTHER Part I line. Written as
        // an explicit sweep of the twenty printed 2a-2t fields, because the
        // failure this guards against -- box 9 wired to the neighbouring 2f or
        // 2h -- would leave line 4, line 11 and every tax figure IDENTICAL, and
        // no assertion about the tax could ever see it. Line 2a is excluded
        // from the sweep: it carries the standard-deduction add-back, which is a
        // real non-zero figure on this fixture.
        boxNineLandsOnTwoGAndOnNoOtherPartOneLine: () => {
            const result = expectOk(run({
                ...wageReturn(25000000n)(singleStandardDeduction)(5200000n),
                specifiedPrivateActivityBondInterestCents: 6000000n,
            }))
            assertEq(result.line2g, 6000000n, 'on line 2g')
            /** @type {readonly (readonly [string, bigint])[]} */
            const everyOtherPartOneLine = [
                ['line2b', result.line2b], ['line2c', result.line2c], ['line2d', result.line2d],
                ['line2e', result.line2e], ['line2f', result.line2f], ['line2h', result.line2h],
                ['line2i', result.line2i], ['line2j', result.line2j], ['line2k', result.line2k],
                ['line2l', result.line2l], ['line2m', result.line2m], ['line2n', result.line2n],
                ['line2o', result.line2o], ['line2p', result.line2p], ['line2q', result.line2q],
                ['line2r', result.line2r], ['line2s', result.line2s], ['line2t', result.line2t],
                ['line3', result.line3],
            ]
            assertEq(
                everyOtherPartOneLine.length, 19,
                'the nineteen Part I lines that are neither 2a nor 2g, hand-counted off the printed form')
            for (const [name, value] of everyOtherPartOneLine) {
                assertEq(value, 0n, ['box 9 must not land on this line', name, value])
            }
        },
        // BOTH preference items on ONE return, and they ADD rather than one
        // winning: §57(a)(5) and §56(b)(3) are separate printed lines and
        // neither is a limitation on the other. Without this leaf a wiring that
        // overwrote line 2i with line 2g -- or summed only the larger -- would
        // pass every fixture above.
        theTwoComputedPreferenceItemsBothLandAndAdd: () => {
            const result = expectOk(run({
                ...wageReturn(25000000n)(singleStandardDeduction)(5500000n),
                specifiedPrivateActivityBondInterestCents: 6000000n,
                isoExerciseForms: [isoForm('doc-iso-and-bonds')('5.00')('105.00')('10000')],
            }))
            assertEq(result.line2g, 6000000n, 'line 2g = $60,000.00 of box 9')
            assertEq(result.line2i, 100000000n, 'line 2i = $1,000,000.00 of ISO spread')
            // 234,250.00 + 15,750.00 + 60,000.00 + 1,000,000.00 = 1,310,000.00
            assertEq(result.line4, 131000000n, 'AMTI = $1,310,000.00 -- both, added')
            assert(
                result.line2g !== result.line2i,
                'this fixture is deliberately two DIFFERENT amounts, so a swap names itself')
        },
    },
    estatesAndTrusts: {
        // THE MOTIVATING RETURN FOR LINE 2J, and it is the quietest of the
        // three: a salaried beneficiary of a family trust, who owes alternative
        // minimum tax because of a form the TRUST filed. Every figure
        // hand-typed and derived independently below.
        //
        //   salary                                              $250,000.00
        //   1040 line 14 / 12e   the standard deduction           $15,750.00
        //   K-1 (1041) box 12 code A                              $75,000.00
        //
        //   line 1a    the deduction, less $0.00 of Sch 1-A         $15,750.00
        //   line 1b    250,000.00 - 15,750.00                     $234,250.00
        //   line 2a    the standard-deduction add-back             $15,750.00
        //   line 2j    box 12 code A                               $75,000.00
        //   line 4     234,250.00 + 15,750.00 + 75,000.00         $325,000.00
        //   line 5     325,000.00 is below the $626,350.00 phase-out
        //              threshold, so the exemption survives whole   $88,100.00
        //   line 6     325,000.00 - 88,100.00                     $236,900.00
        //   line 7     236,900.00 is below the $239,100.00 breakpoint, so 26%
        //              of the whole: 236,900.00 x 0.26             $61,594.00
        //   line 10    a regular tax of                            $52,000.00
        //   line 11    61,594.00 - 52,000.00                        $9,594.00
        theBeneficiaryWhoOwesAlternativeMinimumTax: () => {
            const result = expectOk(run({
                ...wageReturn(25000000n)(singleStandardDeduction)(5200000n),
                estateTrustK1Forms: [beneficiaryK1('doc-k1-a')([{ code: 'A', amount: '75000.00' }])],
            }))
            assertEq(result.line2j, 7500000n, 'line 2j = box 12 code A = $75,000.00')
            assertEq(result.line1b, 23425000n, 'line 1b = $250,000.00 - $15,750.00 = $234,250.00')
            assertEq(result.line2a, 1575000n, 'line 2a = the standard deduction, added back')
            assertEq(result.line4, 32500000n, 'line 4 = AMTI = $325,000.00')
            assertEq(result.line5, 8810000n, 'the full exemption: AMTI is below the phase-out threshold')
            assertEq(result.line6, 23690000n, '$325,000.00 - $88,100.00 = $236,900.00')
            assertEq(result.line7, 6159400n, '26% of $236,900.00 = $61,594.00')
            assertEq(result.line10, 5200000n, 'line 10 = the regular tax')
            assertEq(result.line11, 959400n, 'line 11 = $61,594.00 - $52,000.00 = $9,594.00')
            // The other two computed preference items are untouched, so the AMT
            // above is attributable to line 2j and to nothing else.
            assertEq(result.line2g, 0n, 'no private-activity bond interest is involved')
            assertEq(result.line2i, 0n, 'and no incentive stock option')
        },
        // THE SAME RETURN WITH NO SCHEDULE K-1 owes NOTHING, stated as a pair
        // against the fixture above so the whole $9,594.00 is attributed to box
        // 12 rather than to the salary.
        //
        //   line 4     234,250.00 + 15,750.00                     $250,000.00
        //   line 6     250,000.00 - 88,100.00                     $161,900.00
        //   line 7     26% of 161,900.00                           $42,094.00
        //   line 11    42,094.00 loses to a 52,000.00 regular tax       -0-
        theSameReturnWithoutTheScheduleKOneOwesNothing: () => {
            const result = expectOk(run(wageReturn(25000000n)(singleStandardDeduction)(5200000n)))
            assertEq(result.line2j, 0n, 'no K-1, no adjustment')
            assertEq(result.line4, 25000000n, 'AMTI is the whole $250,000.00 of AGI and no more')
            assertEq(result.line6, 16190000n, '$250,000.00 - $88,100.00 = $161,900.00')
            assertEq(result.line7, 4209400n, '26% of $161,900.00 = $42,094.00')
            assertEq(result.line11, 0n, 'and it loses to the regular tax')
        },
        // LINE 2J REACHES AMTI ONE FOR ONE, as a DIFFERENCE across the pair
        // rather than against a second literal — the leaf that catches a line
        // 2j computed correctly and then left out of line 4's sum, where the
        // field would hold the right figure and the tax would not move.
        theWholeOfCodeALandsInAlternativeMinimumTaxableIncome: () => {
            const withK1 = expectOk(run({
                ...wageReturn(25000000n)(singleStandardDeduction)(5200000n),
                estateTrustK1Forms: [beneficiaryK1('doc-k1-a')([{ code: 'A', amount: '75000.00' }])],
            }))
            const without = expectOk(run(wageReturn(25000000n)(singleStandardDeduction)(5200000n)))
            assertEq(
                withK1.line4 - without.line4, 7500000n,
                'AMTI rises by exactly box 12 code A, no more and no less')
            assertEq(
                withK1.line4BeforeAddBack - without.line4BeforeAddBack, 7500000n,
                'and it is in line 4 BEFORE the married-filing-separately paragraph')
            assert(
                withK1.line11 > without.line11,
                ['and the tax rises with it', withK1.line11, without.line11])
        },
        /**
         * **A NEGATIVE code A REDUCES alternative minimum taxable income**, and
         * this is the leaf a floor at zero fails. The printed line carries no
         * "if zero or less, enter -0-" and `i6251.pdf`'s own *Who Must File*
         * item 4 contemplates lines 2c through 3 summing negative.
         *
         *   line 4     234,250.00 + 15,750.00 - 25,000.00         $225,000.00
         *   line 6     225,000.00 - 88,100.00                     $136,900.00
         */
        aNegativeAdjustmentReducesAlternativeMinimumTaxableIncome: () => {
            const result = expectOk(run({
                ...wageReturn(25000000n)(singleStandardDeduction)(5200000n),
                estateTrustK1Forms: [beneficiaryK1('doc-k1-neg')([{ code: 'A', amount: '-25000.00' }])],
            }))
            assertEq(result.line2j, -2500000n, 'line 2j = minus $25,000.00, unfloored')
            assertEq(result.line4, 22500000n, 'AMTI = $225,000.00, BELOW the $250,000.00 it would be')
            assertEq(result.line6, 13690000n, '$225,000.00 - $88,100.00 = $136,900.00')
            // And on a return that DOES owe alternative minimum tax, the
            // negative adjustment lowers the tax itself. $100,000.00 of
            // private-activity bond interest puts AMTI above the 28% breakpoint:
            //
            //   without   line 4  234,250 + 15,750 + 100,000      $350,000.00
            //             line 6  350,000.00 - 88,100.00          $261,900.00
            //             line 7  26% of 239,100.00 = 62,166.00
            //                   + 28% of  22,800.00 =  6,384.00    $68,550.00
            //             line 11 68,550.00 - 52,000.00            $16,550.00
            //   with      line 4  350,000.00 - 25,000.00          $325,000.00
            //             line 6  325,000.00 - 88,100.00          $236,900.00
            //             line 7  26% of 236,900.00                $61,594.00
            //             line 11 61,594.00 - 52,000.00             $9,594.00
            const bonds = {
                ...wageReturn(25000000n)(singleStandardDeduction)(5200000n),
                specifiedPrivateActivityBondInterestCents: 10000000n,
            }
            const withoutK1 = expectOk(run(bonds))
            const withNegative = expectOk(run({
                ...bonds,
                estateTrustK1Forms: [beneficiaryK1('doc-k1-neg')([{ code: 'A', amount: '-25000.00' }])],
            }))
            assertEq(withoutK1.line11, 1655000n, '$16,550.00 of AMT without the K-1')
            assertEq(withNegative.line11, 959400n, '$9,594.00 with it -- the tax FELL')
        },
        // The figure lands on line 2j and on NO OTHER Part I line. The same
        // explicit sweep line 2g gets, and for the same reason: box 12 wired to
        // the neighbouring 2i or 2k would leave line 4, line 11 and every tax
        // figure IDENTICAL, and no assertion about the tax could see it.
        codeALandsOnTwoJAndOnNoOtherPartOneLine: () => {
            const result = expectOk(run({
                ...wageReturn(25000000n)(singleStandardDeduction)(5200000n),
                estateTrustK1Forms: [beneficiaryK1('doc-k1-a')([{ code: 'A', amount: '75000.00' }])],
            }))
            assertEq(result.line2j, 7500000n, 'on line 2j')
            /** @type {readonly (readonly [string, bigint])[]} */
            const everyOtherPartOneLine = [
                ['line2b', result.line2b], ['line2c', result.line2c], ['line2d', result.line2d],
                ['line2e', result.line2e], ['line2f', result.line2f], ['line2g', result.line2g],
                ['line2h', result.line2h], ['line2i', result.line2i], ['line2k', result.line2k],
                ['line2l', result.line2l], ['line2m', result.line2m], ['line2n', result.line2n],
                ['line2o', result.line2o], ['line2p', result.line2p], ['line2q', result.line2q],
                ['line2r', result.line2r], ['line2s', result.line2s], ['line2t', result.line2t],
                ['line3', result.line3],
            ]
            assertEq(
                everyOtherPartOneLine.length, 19,
                'the nineteen Part I lines that are neither 2a nor 2j, hand-counted off the printed form')
            for (const [name, value] of everyOtherPartOneLine) {
                assertEq(value, 0n, ['box 12 code A must not land on this line', name, value])
            }
        },
        // ALL THREE computed preference items on ONE return, ADDING: §57(a)(5),
        // §56(b)(3) and the fiduciary's adjustment are three separate printed
        // lines and none is a limitation on the others. Three DIFFERENT
        // amounts, so any swap between them names itself.
        theThreeComputedPreferenceItemsAllLandAndAdd: () => {
            const result = expectOk(run({
                ...wageReturn(25000000n)(singleStandardDeduction)(5500000n),
                specifiedPrivateActivityBondInterestCents: 6000000n,
                isoExerciseForms: [isoForm('doc-iso-and-trust')('5.00')('105.00')('10000')],
                estateTrustK1Forms: [beneficiaryK1('doc-k1-a')([{ code: 'A', amount: '75000.00' }])],
            }))
            assertEq(result.line2g, 6000000n, 'line 2g = $60,000.00 of box 9')
            assertEq(result.line2i, 100000000n, 'line 2i = $1,000,000.00 of ISO spread')
            assertEq(result.line2j, 7500000n, 'line 2j = $75,000.00 of box 12 code A')
            // 234,250.00 + 15,750.00 + 60,000.00 + 1,000,000.00 + 75,000.00
            assertEq(result.line4, 138500000n, 'AMTI = $1,385,000.00 -- all three, added')
        },
        // The `STMT` row's refusal reaches the CALLER, rather than being
        // absorbed into a zero here: no line is computed and the whole form
        // refuses, exactly as a Form 3921 missing a box does.
        aCodeARowWithNoAmountRefusesTheWholeForm: () => {
            const outcome = run({
                ...wageReturn(25000000n)(singleStandardDeduction)(5200000n),
                estateTrustK1Forms: [beneficiaryK1('doc-k1-stmt')([{ code: 'A' }])],
            })
            assert(outcome.kind === 'error', ['expected the whole form to refuse', outcome])
            assert(outcome.message.includes('doc-k1-stmt'), ['name the document', outcome.message])
            assert(outcome.message.includes('line 2j'), ['name the line', outcome.message])
            // The CONTROL: the same return whose row carries an amount
            // computes, so this is not a form that refuses every K-1.
            assertEq(
                expectOk(run({
                    ...wageReturn(25000000n)(singleStandardDeduction)(5200000n),
                    estateTrustK1Forms: [beneficiaryK1('doc-k1-stmt')([{ code: 'A', amount: '75000.00' }])],
                })).line2j,
                7500000n)
        },
    },
    partThree: {
        // THE UPPER BOUND, settling a return the engine would otherwise have
        // had to refuse. A $400,000.00 salary with $20,000.00 of qualified
        // dividends: Part III is required, and the flat 26/28% figure is
        // $82,550.00 against a $100,000.00 regular tax, so line 11 is exactly
        // zero whatever Part III would have said.
        theUpperBoundSettlesAReturnWithQualifiedDividendsAtZero: () => {
            const result = expectOk(run({
                ...wageReturn(40000000n)(singleStandardDeduction)(10000000n),
                qualifiedDividendsCents: 2000000n,
            }))
            assertEq(result.line11, 0n, 'exactly zero, by the bound')
            assertEq(
                result.line7IsAnUpperBound, true,
                'and the outcome SAYS lines 7 and 9 are bounds rather than figures')
            assert(
                result.line9 <= result.line10,
                'the bound holds: even the flat figure loses to the regular tax')
        },
        // ★ THE RETURN PHASE 29 HAD TO REFUSE, COMPUTING. The same return with a
        // $1,000,000.00 ISO spread beside its qualified dividends: the flat
        // figure is far above the regular tax, so the bound does not settle it
        // and Part III genuinely decides the answer.
        //
        // MERGE NOTE / TAX-33. This leaf REPLACES a refusal proof
        // (`theSameReturnWithAPreferenceItemRefusesNamingPartThree`) with a
        // computing one, deliberately: the refusal it asserted is the thing
        // TAX-33 removes. Do not restore it. Note also why it could not simply
        // be left alone — the refusal that survives on this module
        // (`noRegularPreferentialWorksheetRefusal`) contains the strings "Part
        // III", "26%" and "preferential" too, so the old leaf would have stayed
        // GREEN against a completely different refusal. That is AGENTS.md's
        // "assert the effect, not the error message" in its most dangerous form.
        //
        //   AMTI       384,250.00 + 15,750.00 + 1,000,000.00   $1,400,000.00
        //   line 5     fully phased out                                $0.00
        //   line 6     = line 12                              $1,400,000.00
        //   QDCGT 4    the qualified dividends                    $20,000.00
        //   QDCGT 5    384,250.00 - 20,000.00                    $364,250.00
        //   III 17     1,400,000.00 - 20,000.00                $1,380,000.00
        //   III 18     26% x 239,100.00 = 62,166.00
        //            + 28% x 1,140,900.00 = 319,452.00           $381,618.00
        //   III 21     48,350.00 - 364,250.00 is negative              -0-
        //   III 30     the $20,000.00, all of it at 15%           $20,000.00
        //   III 31     15% x 20,000.00                             $3,000.00
        //   III 38     381,618.00 + 3,000.00                     $384,618.00
        //   III 39     62,166.00 + 28% x 1,160,900.00 = 325,052.00
        //                                                        $387,218.00
        //   III 40     the smaller                                $384,618.00
        //   line 7     Part III line 40                           $384,618.00
        //   line 10    the regular tax                            $100,000.00
        //   line 11    384,618.00 - 100,000.00                    $284,618.00
        theSameReturnWithAPreferenceItemNowComputesPartThree: () => {
            const result = expectOk(run({
                ...wageReturn(40000000n)(singleStandardDeduction)(10000000n),
                qualifiedDividendsCents: 2000000n,
                regularPreferentialWorksheet: regularQdcgt(2000000n)(36425000n),
                isoExerciseForms: [isoForm('doc-iso-qd')('5.00')('105.00')('10000')],
            }))
            assertEq(result.line6, 140000000n, 'line 6 = $1,400,000.00')
            const three = assertNotNullish(result.partThree, 'Part III must have been completed')
            assertEq(three.line12, 140000000n, 'Part III line 12 IS Form 6251 line 6')
            assertEq(three.line17, 138000000n, 'line 17 = $1,380,000.00 of ordinary AMT income')
            assertEq(three.line18, 38161800n, 'line 18 = $381,618.00')
            assertEq(three.line30, 2000000n, 'line 30 = the $20,000.00 of qualified dividends')
            assertEq(three.line31, 300000n, 'line 31 = 15% of it = $3,000.00')
            assertEq(three.line38, 38461800n, 'line 38 = $384,618.00')
            assertEq(three.line39, 38721800n, 'line 39 = $387,218.00, the flat 26/28% figure')
            assertEq(three.line40, 38461800n, 'line 40 = $384,618.00')
            assertEq(result.line7, 38461800n, 'and line 40 lands on LINE 7')
            assertEq(result.line9, 38461800n, 'line 9 = line 7, there being no AMT foreign tax credit')
            assertEq(result.line11, 28461800n, 'line 11 = $384,618.00 - $100,000.00 = $284,618.00')
            assertEq(
                result.line7IsAnUpperBound, false,
                'the flag is FALSE: line 7 is the printed figure, not a bound')
            // WHAT PART III BUYS, as its own assertion and derived
            // independently: 28% - 15% = 13%, and 13% of $20,000.00 is
            // $2,600.00. Taxing the qualified dividends at the flat AMT rate --
            // which is what Phase 29 refused rather than do -- would have
            // overstated this return's AMT by exactly that.
            assertEq(
                three.line39 - result.line7, 260000n,
                'the flat computation would charge 28% where Part III charges 15%')
        },
        // THE ONE REFUSAL LEFT ON THIS FORM, and it is not about Part III being
        // unmodeled: it is Part III required while the regular tax completed
        // NEITHER preferential worksheet, which happens exactly when 1040 line
        // 15 is zero or less. A filer whose deductions swallow their ordinary
        // income while a $1,000,000.00 ISO spread puts AMTI far above the
        // exemption is that return.
        partThreeRefusesWhenTheRegularTaxCompletedNeitherWorksheet: () => {
            const outcome = run({
                ...nothing,
                // No taxable income at all, so `fjs/tax/line16`'s level-1 gate
                // fires and neither preferential worksheet runs...
                adjustedGrossIncomeCents: 0n,
                regularTaxCents: 0n,
                // ...but there ARE qualified dividends, so Part III is required,
                // and a $1,000,000.00 spread puts AMTI above the exemption.
                qualifiedDividendsCents: 2000000n,
                isoExerciseForms: [isoForm('doc-iso-no-worksheet')('5.00')('105.00')('10000')],
            })
            assertEq(outcome.kind, 'error', ['expected a refusal', outcome])
            if (outcome.kind !== 'error') {
                throw ['expected error', outcome]
            }
            // The four things a reader can act on, each asserted separately --
            // and none of them a string the OTHER refusals on this module share,
            // so this leaf cannot pass against the wrong refusal.
            assert(
                outcome.message.includes('NEITHER'),
                ['name the condition', outcome.message])
            assert(
                outcome.message.includes('taxable income'),
                ['say WHEN it happens', outcome.message])
            assert(
                outcome.message.includes('OVERSTATE'),
                ['say which way the wrong answer would go', outcome.message])
            assert(
                outcome.message.includes('not on the form\'s face'),
                ['say what is missing: an instruction, not a figure', outcome.message])
            // THE CONTROL (AGENTS.md: "a gate needs a control"). The identical
            // return with a completed regular-tax worksheet computes.
            const computed = expectOk(run({
                ...nothing,
                adjustedGrossIncomeCents: 0n,
                regularTaxCents: 0n,
                qualifiedDividendsCents: 2000000n,
                regularPreferentialWorksheet: regularQdcgt(2000000n)(0n),
                isoExerciseForms: [isoForm('doc-iso-worksheet')('5.00')('105.00')('10000')],
            }))
            assertNotNullish(computed.partThree, 'the control completes Part III')
            assert(computed.line11 > 0n, ['and owes a real AMT', computed.line11])
        },
        // Each of the THREE conditions the printed line 7 lists selects Part
        // III on its own, and each is exercised separately -- a predicate
        // written for qualified dividends alone would leave the other two
        // silently taxed at 26/28%.
        //
        // Since TAX-33 the observable is `partThree` being FILLED IN rather than
        // an error being returned, which is a stronger assertion than the
        // refusal it replaces: a condition that stopped selecting Part III used
        // to turn an error into an ok, and now turns a completed worksheet into
        // an absent one while the return still computes. Both the presence and
        // the resulting line 7 are checked, because a Part III that ran and was
        // then ignored would leave `partThree` present and line 7 flat.
        eachOfTheThreePrintedConditionsSelectsPartThree: () => {
            const base = {
                ...wageReturn(40000000n)(singleStandardDeduction)(10000000n),
                regularPreferentialWorksheet: regularQdcgt(2000000n)(36425000n),
                isoExerciseForms: [isoForm('doc-iso-three')('5.00')('105.00')('10000')],
            }
            /** @type {(input: Form6251Input) => (label: string) => void} */
            const expectPartThree = input => label => {
                const result = expectOk(run(input))
                const three = assertNotNullish(result.partThree, label)
                assertEq(result.line7, three.line40, [label, 'line 7 must be Part III line 40'])
                assert(
                    result.line7 < three.line39,
                    [label, 'and strictly below the flat figure on this fixture',
                        result.line7, three.line39])
            }
            expectPartThree({ ...base, qualifiedDividendsCents: 1n })(
                'condition 1: qualified dividends on 1040 line 3a')
            expectPartThree({ ...base, capitalGainDistributionsCents: 1n, filingScheduleD: false })(
                'condition 2: capital gain distributions reported DIRECTLY on 1040 line 7')
            expectPartThree({
                ...base, filingScheduleD: true, scheduleD15Cents: 1n, scheduleD16Cents: 1n,
            })('condition 3: a gain on BOTH Schedule D lines 15 and 16')
            // …and the control: the same return with none of the three does NOT
            // complete Part III, and takes the flat 26/28% figure on line 7.
            const clean = expectOk(run(base))
            assertEq(clean.partThree, undefined, 'no condition, no Part III')
            assertEq(clean.line7IsAnUpperBound, false)
            assert(clean.line11 > 0n, ['the control must owe real AMT', clean.line11])
        },
        // Condition 2's own qualifier, which is easy to drop: capital gain
        // distributions select Part III only when they were reported DIRECTLY
        // on 1040 line 7, i.e. when no Schedule D was filed. A filer WITH a
        // Schedule D whose lines 15 and 16 are not both gains does not go to
        // Part III on account of box 2a.
        capitalGainDistributionsSelectPartThreeOnlyWithoutAScheduleD: () => {
            const base = {
                ...wageReturn(40000000n)(singleStandardDeduction)(10000000n),
                regularPreferentialWorksheet: regularQdcgt(500000n)(37850000n),
                isoExerciseForms: [isoForm('doc-iso-cgd')('5.00')('105.00')('10000')],
                capitalGainDistributionsCents: 500000n,
            }
            assertNotNullish(
                expectOk(run({ ...base, filingScheduleD: false })).partThree,
                'reported directly: Part III is completed')
            // Schedule D filed, and line 16 a LOSS -- so neither condition 2
            // nor condition 3 fires, and Part III is NOT completed.
            assertEq(
                expectOk(run({
                    ...base, filingScheduleD: true,
                    scheduleD15Cents: 500000n, scheduleD16Cents: -100000n,
                })).partThree,
                undefined,
                'a Schedule D was filed, so box 2a did not reach line 7 directly')
        },
        // The bound is an UPPER bound on Part III, so a return it settles must
        // have line 9 no greater than line 10 -- stated as a property over a
        // sweep rather than one fixture, since the bound's whole value is that
        // it holds at every input.
        everySettledReturnReallyIsBounded: () => {
            for (const regularTax of [8255000n, 9000000n, 20000000n]) {
                const result = expectOk(run({
                    ...wageReturn(40000000n)(singleStandardDeduction)(regularTax),
                    qualifiedDividendsCents: 2000000n,
                }))
                assertEq(result.line11, 0n, ['settled', regularTax])
                assert(result.line9 <= result.line10, ['bounded', regularTax])
            }
            // …and exactly ONE cent of regular tax less than the flat figure
            // is NOT settled, so the boundary of the bound is where it says it
            // is rather than a cent either side. Since TAX-33 the unsettled side
            // COMPUTES rather than refusing, and the observable is that it took
            // the Part III path: `partThree` filled in and the flag false.
            const oneCentShort = expectOk(run({
                ...wageReturn(40000000n)(singleStandardDeduction)(8254999n),
                qualifiedDividendsCents: 2000000n,
                regularPreferentialWorksheet: regularQdcgt(2000000n)(36425000n),
            }))
            assertNotNullish(
                oneCentShort.partThree,
                'one cent short of the flat figure: the bound no longer settles it, so Part III runs')
            assertEq(
                oneCentShort.line7IsAnUpperBound, false,
                'and line 7 is a printed figure rather than a bound')
            // …while exactly AT the flat figure the bound still settles it, on
            // the OTHER code path -- so this pair pins the boundary from both
            // sides and pins which path each side takes.
            const exactly = expectOk(run({
                ...wageReturn(40000000n)(singleStandardDeduction)(8255000n),
                qualifiedDividendsCents: 2000000n,
                regularPreferentialWorksheet: regularQdcgt(2000000n)(36425000n),
            }))
            assertEq(exactly.partThree, undefined, 'settled: Part III never ran')
            assertEq(exactly.line7IsAnUpperBound, true, 'and the flag says the answer is a bound')
            assertEq(exactly.line11, 0n, 'exactly $0.00, whatever Part III would have said')
        },
        // ★ CRITERION 2, and the FLAG'S MEANING after TAX-33, stated as a triple
        // over ONE return varied only in its regular tax. The flag is not
        // decoration: it is the difference between "lines 7 and 9 are bounds and
        // line 11 is exactly zero" and "lines 7 and 9 are the printed figures".
        //
        // Both paths are exercised, and the SHORT CIRCUIT is shown to be a
        // short circuit rather than an equivalent computation: on the settled
        // return line 7 is the FLAT figure ($82,550.00) and on the computed one
        // it is Part III's smaller line 40. A refactor that deleted the short
        // circuit and always ran Part III would leave line 11 correct on both
        // and change line 7 on the first -- which only this leaf notices.
        theFlagSaysWhichPathProducedTheAnswer: () => {
            const base = {
                ...wageReturn(40000000n)(singleStandardDeduction)(0n),
                qualifiedDividendsCents: 2000000n,
                regularPreferentialWorksheet: regularQdcgt(2000000n)(36425000n),
            }
            // The flat figure on this AMTI: 26% of $239,100.00 = $62,166.00 plus
            // 28% of $72,800.00 = $20,384.00, hand-typed.
            const flat = 8255000n
            const settled = expectOk(run({ ...base, regularTaxCents: flat }))
            assertEq(settled.line7IsAnUpperBound, true, 'the bound settled it')
            assertEq(settled.line7, flat, 'so line 7 is the FLAT figure, a bound')
            assertEq(settled.partThree, undefined, 'and Part III was never run')
            assertEq(settled.line11, 0n)
            const computed = expectOk(run({ ...base, regularTaxCents: flat - 1n }))
            assertEq(computed.line7IsAnUpperBound, false, 'one cent less, and the bound does not')
            const three = assertNotNullish(computed.partThree, 'so Part III ran')
            assertEq(computed.line7, three.line40, 'and line 7 is its line 40')
            assert(
                computed.line7 < flat,
                ['which is STRICTLY below the flat figure, so the two paths are distinguishable',
                    computed.line7, flat])
            assertEq(
                flat - computed.line7, 260000n,
                '13% of the $20,000.00 of qualified dividends = $2,600.00, hand-computed')
            // The bound's own claim, over the pair: whichever path ran, line 7
            // never exceeds the flat figure.
            assert(settled.line7 <= flat && computed.line7 <= flat, 'THE BOUND holds on both paths')
        },
    },
    // Line 10 is a SUM and a difference, not a pass-through of 1040 line 16.
    // Each of the three terms is moved independently, so a wiring that dropped
    // any one names itself.
    lineTen: {
        theThreeTermsEachMoveLineTen: () => {
            const base = {
                ...wageReturn(25000000n)(singleStandardDeduction)(5500000n),
                isoExerciseForms: [isoForm('doc-iso-ten')('5.00')('105.00')('10000')],
            }
            const plain = expectOk(run(base))
            assertEq(plain.line10, 5500000n, 'line 16 alone')
            const withAdditions = expectOk(run({ ...base, scheduleTwoLine1zCents: 100000n }))
            assertEq(withAdditions.line10, 5600000n, 'Schedule 2 line 1z ADDS')
            assertEq(
                withAdditions.line11, plain.line11 - 100000n,
                'and the AMT falls by the same amount, because the AMT is the excess')
            const withCredit = expectOk(run({ ...base, scheduleThreeLine1Cents: 100000n }))
            assertEq(withCredit.line10, 5400000n, 'Schedule 3 line 1 SUBTRACTS')
            // **CORRECTED at TAX-36, and the correction is the finding.**
            // This line asserted `plain.line11 + 100000n` -- "and the AMT
            // rises" -- which was true only while line 8 was a hard zero.
            // Line 8 is the AMT foreign tax credit and now tracks Schedule 3
            // line 1 (§59(a)(1) redetermines the §27(a) credit, and under
            // §904(j) there is nothing to redetermine), so the SAME figure
            // comes off both sides of `line11 = line9 - line10` and the AMT
            // does not move at all. A wiring that moved line 10 alone would
            // have raised a §904(j) filer's AMT by exactly their foreign tax.
            assertEq(
                withCredit.line8, 100000n,
                'line 8 is the AMT foreign tax credit — the SAME $1,000.00')
            assertEq(
                withCredit.line9, plain.line9 - 100000n,
                'so the tentative minimum tax falls by it too')
            assertEq(
                withCredit.line11, plain.line11,
                'and the AMT is unmoved: a §904(j) credit nets to zero here')
        },
        // "If zero or less, enter -0-." A foreign tax credit larger than the
        // regular tax floors line 10 rather than making it negative, which
        // would otherwise INCREASE the AMT above the tentative minimum tax.
        lineTenIsFlooredAtZero: () => {
            const result = expectOk(run({
                ...wageReturn(25000000n)(singleStandardDeduction)(100000n),
                isoExerciseForms: [isoForm('doc-iso-floor')('5.00')('105.00')('10000')],
                scheduleThreeLine1Cents: 500000n,
            }))
            assertEq(result.line10, 0n, 'never negative')
            assertEq(result.line11, result.line9, 'so the whole tentative minimum tax is the AMT')
        },
    },
    // Every printed line of Parts I and II is a named field, and the count is
    // hand-typed. `Object.keys(result)` is the thing under test, so the
    // constant beside it is what catches a line quietly disappearing.
    everyPrintedLineIsNamed: () => {
        const result = expectOk(run(nothing))
        // 1a, 1b, 2a-2t (20), 3, 4BeforeAddBack, 4, 5, 6, 7, 8, 9, 10, 11,
        // plus `kind`, `line7IsAnUpperBound`, `isoSpreadCents` and `partThree`.
        // (`partThree` is `undefined` on this fixture and STILL counted:
        // `Object.keys` lists a property explicitly set to `undefined`, which is
        // what makes this count catch the field disappearing.)
        const expectedFieldCount = 36
        assertEq(
            Object.keys(result).length,
            expectedFieldCount,
            ['expected exactly the printed lines plus kind, the bound flag and the spread',
                Object.keys(result)])
    },
    dialectIndependence: () => {
        const result = expectOk(run(nothing))
        assert(!('dialect' in result), 'form6251 output must not carry a dialect tag')
        assert(!('mediaType' in result), 'form6251 output must not carry a mediaType')
    },
}
