/**
 * TAX-16's scope guard: the FROZEN modeled set, the refusal table,
 * {@link classifyScope}, and {@link scopeRefusal} — the one place a scope
 * refusal is built. Since Phase 22 (TAX-19) it also carries
 * {@link tripwireRefusal}, the second builder of that same shape; see "The
 * uncovered failure mode" below.
 *
 * ## Why a declared set and not the store
 *
 * `10-CONTEXT.md` Decision 4 records the finding that killed this phase's
 * original assumption: a guard driven by CAS STORE CONTENTS cannot work,
 * because
 *
 * > the engine never sees the documents it cannot read.
 *
 * A taxpayer with a 1099-DIV in a drawer and none in CAS produces an empty
 * dividend line. So does a taxpayer with no dividends at all. An absent
 * document is indistinguishable from an absent income kind, so a store-driven
 * guard stays silent in exactly the case TAX-16 exists for. The comparison has
 * to be against what the taxpayer DECLARES — `fjs/return/profile`'s
 * {@link kindVocabulary} — against what this engine MODELS, which is the
 * partition below.
 *
 * The converse matters just as much. A line that is *legitimately* zero — no
 * interest declared, no 1099-INT stored — is `0n` citing the profile, NOT a
 * refusal. The whole distinction between "legitimately zero" and "unmodeled,
 * so no return at all" is carried by the declared kind set, which is why the
 * profile document is load-bearing rather than convenient.
 *
 * ## The uncovered failure mode, and the complementary guard (Phase 22, TAX-19)
 *
 * **Everything above is still true, and is not weakened by what follows.** The
 * store-driven guard really is unsound for the reason recorded above, and a
 * legitimately-zero line really can only be told apart from an unmodeled one by
 * the declared set.
 *
 * But the argument has a gap, found by `.planning/PERSONA-COVERAGE.md`'s
 * persona survey ("The structural finding: declaration-driven scoping fails for
 * mandatory taxes"): it assumes every unmodeled item is either ELECTIVE or
 * something the taxpayer knows they have. Some taxes are neither. They trigger
 * on a THRESHOLD, from data the engine ALREADY HOLDS:
 *
 * > A single filer with $300,000 in W-2 box 5 owes Additional Medicare Tax.
 * > Full stop. If they do not know Form 8959 exists — and most people do not —
 * > they will not declare `scheduleTwoTaxes` [renamed `additionalMedicareTax`
 * > by Phase 23's TAX-22 split, below], the guard stays silent, and the
 * > engine emits a confident return understating tax by roughly $900.
 *
 * The guard's soundness rests on the taxpayer knowing what they owe, which is
 * the thing they came to a tax engine not to have to know. That is not an
 * argument against the declared-set design; it is an argument that the design
 * needs a SECOND guard beside it, asking the other question.
 *
 * `fjs/return/tripwire` is that guard: a table of `(predicate over the supplied
 * documents) -> (kind that MUST have been declared)`, evaluated by
 * `fjs/form1040/core` beside {@link classifyScope} and, like it, before any
 * line computes. It refuses through {@link tripwireRefusal}, which shares this
 * module's refusal SHAPE and its single constructor — one refusal vocabulary,
 * two questions, two failure modes. The predicate is deliberately NOT the
 * store-driven guard rejected above: it never asks whether a document is
 * ABSENT (which is unknowable), only whether a document that IS present proves
 * an obligation.
 *
 * ## The partition, and why `tsc` owns it
 *
 * Every one of the fifty-one kinds is either in {@link modeledKinds} or carries an
 * entry in {@link unmodeledKindRefusals}. There is deliberately no third
 * option: {@link _EveryKindIsEitherModeledOrRefused} states the partition as a
 * conditional type, so a kind added to the vocabulary and classified nowhere
 * stops the build at `tsc`, before a single test runs. That is `fjs/guest`'s
 * `_CasOpIsExactlyTheFourCommands` precedent applied one domain over, and for
 * the same reason recorded there: **equality** against the permitted set
 * catches a widening by ANY kind rather than only the ones somebody thought to
 * list, and it also catches accidental narrowing — an entry deleted from the
 * refusal table.
 *
 * ## The dividend/capital-gain boundary, as of Phase 12.1
 *
 * Through Phase 10, this docstring argued that qualified dividends must stay
 * refused even though the QDCGT worksheet already computed: the worksheet's
 * arithmetic was one thing, line 3a's SOURCE — a Form 1099-DIV, whose dialect
 * (`vnd.fjs.1099div`, DOC-06) did not exist yet — was another. **That
 * argument's PRINCIPLE survives; its EXAMPLE does not.** Phase 12 shipped
 * `vnd.fjs.1099div` and `vnd.fjs.1099b`, and Phase 12.1 (`12.1-CONTEXT.md`
 * Decision 1.1) wires both into real computation: `fjs/form1040/core` reads
 * dividend documents into lines 3a/3b/7a unconditionally, `fjs/schedule/d`
 * computes the three-way capital-gain/loss routing, and `fjs/tax/line16`'s
 * Schedule D Tax Worksheet branch computes instead of refusing. Six kinds
 * move from {@link unmodeledKindRefusals} to {@link modeledKinds} in this
 * one atomic change: `qualifiedDividends`, `ordinaryDividends`,
 * `capitalGainDistributions`, `capitalGainsOrLosses`, `unrecaptured1250Gain`,
 * `collectibles28RateGain`.
 *
 * **Two kinds still refuse, deliberately, for two DIFFERENT reasons** — the
 * principle ("a worksheet that can compute is not thereby an engine that can
 * read every form feeding it") still applies to both:
 * - `investmentInterestForm4952` — this phase supplies no Form 4952 dialect
 *   or election, and keeping a LIVE refusal on the Schedule D Tax Worksheet's
 *   OWN branch (2b) is the ongoing proof that TAX-16 still guards something
 *   real now that branch 2a computes. A branch that can only succeed is no
 *   longer evidence of a guard.
 * - `section1202Gain` — 1099-DIV box 2c's dollar amount is already included,
 *   pass-through, inside box 2a (Schedule D line 13); what stays unmodeled is
 *   the §1202 EXCLUSION percentage (50/60/75/100%, driven by when the
 *   underlying QSB stock was acquired **by the fund**), which no 1099-DIV box
 *   reports. Computing it without that percentage would overstate tax for
 *   anyone entitled to the exclusion — a confident wrong answer, the exact
 *   failure TAX-16 exists to prevent. Refusing is the honest, smaller option.
 *
 * ## Slice 1's retirement and Social Security boundary, as of Phase 13 Wave 1
 *
 * Plan 13-02 wires `vnd.fjs.1099r` into 1040 lines 4a/4b (IRA) and 5a/5b
 * (pensions), routed by each document's own `box7bIraSepSimple` checkbox;
 * `vnd.fjs.ssa1099` into line 6a; and the 18-line Social Security Benefits
 * Worksheet (`fjs/tax/ssb`) into line 6b. Line 25b also now sums
 * `vnd.fjs.1099r` withholding alongside 1099-INT/1099-DIV/1099-B, which is
 * why `federalTaxWithheldOnOther1099` moves together with the other three.
 * Four kinds move from {@link unmodeledKindRefusals} to {@link modeledKinds}
 * in this one atomic change: `iraDistributions`, `pensionsAndAnnuities`,
 * `socialSecurityBenefits`, `federalTaxWithheldOnOther1099`.
 *
 * **The IRA-deduction circularity is NOT modeled by a coarse kind refusal.**
 * 13-CONTEXT.md Decision 5.1: the frozen 50-kind vocabulary carries exactly
 * one kind (`scheduleOneAdjustments`) for the whole of Schedule 1 Part II, so
 * it cannot distinguish an IRA deduction (which creates the Pub. 590-A ↔
 * taxable-Social-Security cycle) from an HSA or educator-expense adjustment,
 * which does not. `iraDeductionDeclared`, a new field on
 * `vnd.fjs.return_profile`, is what still refuses that one case — a
 * document-data-sufficiency refusal threaded by `fjs/form1040/core` itself,
 * never a `fjs/return/scope` kind.
 *
 * ## Slice 2's senior-deduction boundary, as of Phase 13 Wave 2
 *
 * Plan 13-04 wires `fjs/schedule/1a`'s Parts I/V/VI (the OBBBA senior
 * deduction's continuous 6% phase-out, MFS short-circuited to $0) into 1040
 * line 13b, then reclassifies `seniorAndOtherScheduleOneADeductions` from
 * {@link unmodeledKindRefusals} to {@link modeledKinds} in the SAME commit —
 * wire before reclassify, the identical discipline Wave 1 (above) and Plan
 * 12.1-04 already established. This closes TAX-09, the phase's second
 * vertical slice: a 65+ TY2025 return's line 13b is a real, non-placeholder
 * figure the moment this one kind moves.
 *
 * **The pre-existing two-kind "65+ profile" proof fixture is RE-POINTED, not
 * deleted.** `theSixtyFivePlusProfileRefusesNamingBothUnmodeledKinds` (this
 * module's own `scope` proof group) hard-coded
 * `seniorAndOtherScheduleOneADeductions` + `childTaxCreditOrOtherDependents`
 * as a two-kind, form-order refusal example; the first of those two just
 * stopped being refusable. Renamed to
 * {@link proof.scope.twoUnmodeledKindsRefuseNamingBothInFormOrder} and
 * re-pointed at `householdEmployeeWages` (1040 line 1b) +
 * `unreportedTips` (1040 line 1c) — a pair that stays refused for the REST
 * of this phase (13-CONTEXT.md Decision 1.4), so the property this fixture
 * exists to prove (two kinds, named together, in 1040 FORM order rather
 * than declaration order) survives past this one wave, unlike the pair it
 * replaces.
 *
 * ## Slice 3's itemizing boundary, as of Phase 13 Wave 3
 *
 * Plan 13-07 wires `fjs/schedule/a` (Schedule A, all 18 printed lines) and
 * `fjs/tax/deduction`'s new `deductionChoice` (the standard-vs-itemized
 * comparison, 13-CONTEXT.md Decision 2.4) into 1040 line 12e, then
 * reclassifies `itemizedDeductions` from {@link unmodeledKindRefusals} to
 * {@link modeledKinds} in the SAME commit — wire before reclassify, the
 * identical discipline Waves 1 and 2 (above) and Plan 12.1-04 already
 * established. This closes TAX-13, the phase's third vertical slice: a
 * return that itemizes computes line 12e for real, with the
 * standard-vs-itemized comparison actually deciding the outcome — including
 * the load-bearing direction where the standard deduction still wins above
 * the base $15,750/$31,500 figure.
 *
 * `netQualifiedDisasterLoss` (line 12e's own exception 5, Schedule A line 15
 * via Form 4684) stays REFUSED — Decision 1.4. Shipping Schedule A's medical/
 * SALT/mortgage/charity sections does not make Form 4684's disaster-loss
 * election computable; its stale remedy string is corrected later, in Wave 5
 * (13-13).
 *
 * **No pre-existing hand-typed proof leaf in this file used
 * `itemizedDeductions` as a "still refused" example fixture** — a full-file
 * read before this reclassification confirmed the only occurrences were its
 * own table row and the neighboring `netQualifiedDisasterLoss` row, so no
 * fixture needed re-pointing this wave. `twoUnmodeledKindsRefuseNamingBothInFormOrder`/
 * `unmodeledFollowsFormOrderNotDeclarationOrder` (Plan 13-04's own repoint,
 * resting on `householdEmployeeWages`/`unreportedTips`) are untouched by
 * this wave's reclassification and still pass unmodified.
 *
 * ## Slice 4's dependents boundary, as of Phase 13 Wave 4 — this closes TAX-12
 *
 * Plan 13-10 wires `fjs/form8812` (Schedule 8812 Part I's CTC/ODC and Part
 * II-A's ACTC, one function execution, Plan 13-09) into 1040 lines 19 and
 * 28, then reclassifies BOTH `childTaxCreditOrOtherDependents` and
 * `additionalChildTaxCredit` from {@link unmodeledKindRefusals} to
 * {@link modeledKinds} in the SAME commit — wire before reclassify, the
 * identical discipline every earlier wave this docstring records already
 * established. This closes TAX-12, the phase's fourth vertical slice, and
 * with it 13-CONTEXT.md's own Decision 6.5: a return with declared
 * dependents computes a real CTC/ODC and ACTC through the full
 * `form1040Report` entry point.
 *
 * **A full-file read before this reclassification found no hand-typed proof
 * leaf in THIS file** using either kind as a "still refused" example
 * fixture — the only occurrences were the two kinds' own table rows, exactly
 * as this plan's own `<interfaces>` text predicted (Plan 13-04's own
 * `twoUnmodeledKindsRefuseNamingBothInFormOrder`/
 * `unmodeledFollowsFormOrderNotDeclarationOrder` deliberately avoided
 * reusing these two kinds when it re-pointed, precisely so this wave would
 * not need to). **`fjs/form1040/core/module.f.js` carried three such
 * fixtures anyway** — `sixtyFivePlusProfile`'s own two-kind declaration and
 * the two leaves built on it — adapted there, not deleted; see this plan's
 * own SUMMARY for the mechanical detail.
 *
 * Part II-B (3+ qualifying children or Puerto Rico residents) is **not** a
 * `fjs/return/scope` kind at all — it is a document-data-sufficiency
 * refusal threaded by `fjs/form1040/core` itself (`unmodeled: []`),
 * mirroring the Schedule D absent-basis and `iraDeductionDeclared`
 * precedents this docstring already records.
 *
 * ## Schedule 2's Additional Medicare Tax and net investment income tax
 * boundary, as of Phase 23 (TAX-20/TAX-21/TAX-22)
 *
 * Phase 23 lands in two commits, and the split between them is the
 * wire-before-reclassify discipline every slice above followed, stated once
 * more because this phase had thirteen more kinds to move than any of them:
 *
 * 1. The coarse `scheduleTwoTaxes` becomes fourteen per-printed-line kinds,
 *    ALL still refused. Nothing is reclassified; the refusals only become
 *    nameable. See {@link unmodeledKindRefusals}' own Schedule 2 block.
 * 2. `fjs/schedule/2` wires lines 11 and 12 to real `fjs/form8959` and
 *    `fjs/form8960` figures and `fjs/form1040/core` carries Form 8959 Part
 *    V's withholding to 1040 line 25c — and `additionalMedicareTax` and
 *    `netInvestmentIncomeTax` move from {@link unmodeledKindRefusals} to
 *    {@link modeledKinds} in the SAME commit as that wiring.
 *
 * The other twelve stay refused, by name, and two of them are load-bearing
 * proof that this guard still guards something: `alternativeMinimumTax`
 * (Form 6251, Phase 29) and `selfEmploymentTax` (Schedule SE, Phase 28) are
 * both on Schedule 2, both refuse on their own after this phase, and both
 * are named in `theTwelveScheduleTwoKindsThisPhaseDidNotWireStillRefuse`.
 *
 * **The Phase 22 tripwire survives this reclassification rather than dying
 * with it**, which is the one thing about this slice that is not simply
 * Phase 13's pattern repeated. See {@link modeledKindDeclarationRemedies}
 * for the decision and the mechanism.
 *
 * ## Schedule 1 Part II's adjustments boundary, as of Phase 24
 * (TAX-23/TAX-24/DOC-19)
 *
 * The same two-commit shape as Phase 23's, one schedule over, and for the
 * same reason: `scheduleOneAdjustments` was one COARSE kind covering all
 * sixteen printed lines of Part II, so nothing on that part was nameable and
 * nothing on it could be reclassified one line at a time.
 *
 * 1. The coarse kind becomes THIRTEEN per-printed-line kinds, ALL still
 *    refused. Nothing is reclassified; the refusals only become nameable.
 *    See {@link unmodeledKindRefusals}' own Schedule 1 block.
 * 2. `fjs/schedule/1` wires lines 11, 13 and 21 to real
 *    `vnd.fjs.adjustments`, `vnd.fjs.1098e` and Form W-2 box 12 code W
 *    figures through `fjs/form8889` and the printed Student Loan Interest
 *    Deduction Worksheet — and `educatorExpenses`,
 *    `healthSavingsAccountDeduction` and `studentLoanInterestDeduction` move
 *    from {@link unmodeledKindRefusals} to {@link modeledKinds} in the SAME
 *    commit as that wiring.
 *
 * The other ten stay refused, by name. Two of them are load-bearing proof
 * that this guard still guards something on this schedule: `iraDeduction`
 * (Schedule 1 line 20) and `deductiblePartOfSelfEmploymentTax` (line 15,
 * Schedule SE, Phase 28) both refuse on their own after this phase, and both
 * are named in `theTenScheduleOneKindsThisPhaseDidNotWireStillRefuse`.
 *
 * **`iraDeduction` now overlaps `vnd.fjs.return_profile`'s own
 * `iraDeductionDeclared` field, and both are kept.** Phase 13 introduced that
 * field precisely because the coarse kind "cannot distinguish an IRA
 * deduction (which creates the Pub. 590-A / taxable-Social-Security cycle)
 * from an HSA or educator-expense adjustment, which does not" — a limitation
 * this split removes. The two now answer the same question by two routes: the
 * KIND refuses at the scope layer, before any line computes, and the FIELD
 * refuses inside `fjs/form1040/core` with a message about the fixed point
 * itself. Removing the field would edit a stored dialect and move every
 * `programHash` that quotes it (PROV-03/PROV-05), which is not a change this
 * phase has any business making for a redundancy; so both stay, the kind
 * fires first, and this paragraph is the record that the redundancy is known
 * rather than accidental.
 *
 * ## Schedule 3's credits boundary, as of Phase 25 (TAX-25/TAX-26/TAX-27)
 *
 * The same two-commit shape as Phases 23 and 24, one schedule further on, and
 * with one difference worth stating: Schedule 3 is the only schedule whose two
 * PARTS each carried a coarse kind, so this split removes TWO rows rather
 * than one.
 *
 * 1. `scheduleThreeNonrefundableCredits` becomes SEVEN per-printed-line kinds
 *    (Part I lines 1, 2, 3, 4, 5a, 5b and the collapsed 6a-6z) and
 *    `scheduleThreeRefundableCredits` becomes FIVE (Part II lines 9, 10, 11,
 *    12 and the collapsed 13a-13z). All twelve are still refused; nothing is
 *    reclassified, and the refusals only become nameable.
 * 2. `fjs/schedule/3` wires lines 3 and 4 to real `fjs/form8863` and
 *    `fjs/form8880` figures, `fjs/form1040/core` carries Form 8863 Part I's
 *    refundable American Opportunity Credit to 1040 line 29 — and
 *    `educationCredits`, `retirementSavingsContributionsCredit` and
 *    `americanOpportunityCredit` move from {@link unmodeledKindRefusals} to
 *    {@link modeledKinds} in the SAME commit as that wiring.
 *
 * **The reclassified set is three kinds, not two, and the third is on a
 * different schedule.** Form 8863 is one form whose output splits across two
 * printed destinations: its nonrefundable part reaches Schedule 3 line 3, and
 * 40% of its American Opportunity half reaches 1040 line 29 directly, never
 * through Schedule 3 at all. So `americanOpportunityCredit` — a 1040 line 29
 * kind that predates this whole block — is reclassified beside the two
 * Schedule 3 kinds, because one function execution makes all three
 * computable at once.
 *
 * **TAX-27's `earnedIncomeCredit` is deliberately NOT reclassified**, and
 * that is the phase's own finding rather than an omission. Its remedy string
 * is rewritten in this phase to name the specific facts
 * `vnd.fjs.return_profile` does not carry — see that row in
 * {@link unmodeledKindRefusals}, which is the whole of what TAX-27 ships.
 *
 * The other nine Schedule 3 kinds stay refused, by name.
 *
 * ## Schedule 1 Part I's income boundary, as of Phase 27 (DOC-20/DOC-21/TAX-30)
 *
 * The same two-commit shape as Phases 23, 24 and 25, on the last block this
 * project had not taken apart — and this one closes the Wave-5 note above
 * rather than merely adding to it.
 *
 * 1. The coarse `scheduleOneAdditionalIncome` becomes SEVEN per-printed-line
 *    kinds, ALL still refused. Nothing is reclassified; the refusals only
 *    become nameable. See {@link unmodeledKindRefusals}' own Schedule 1 Part I
 *    block.
 * 2. `fjs/schedule/c` computes Schedule C from `vnd.fjs.1099nec` box 1 and
 *    `vnd.fjs.business_expenses`, `fjs/schedule/1` wires its line 31 to
 *    printed line 3, and `fjs/form1040/core` carries 1099-NEC box 4 to 1040
 *    line 25b — and `businessIncomeOrLoss` moves from
 *    {@link unmodeledKindRefusals} to {@link modeledKinds} in the SAME commit
 *    as that wiring.
 *
 * The other six stay refused, by name. Two of them are load-bearing proof that
 * this guard still guards something on this block: `farmIncomeOrLoss`
 * (Schedule F) and `rentalRealEstateRoyaltiesPartnershipsSCorps` (Schedule E,
 * Phase 30) both refuse on their own after this phase.
 *
 * **The Phase 22 tripwire mechanism is used a second time**, and this is only
 * the second use since it was built. A stored Form 1099-NEC proves
 * self-employment, so `fjs/return/tripwire` requires `businessIncomeOrLoss` to
 * have been declared — and because this phase MODELS that kind,
 * {@link modeledKindDeclarationRemedies} gains its second entry, exactly as
 * that table's own docstring anticipated. See it for the reasoning, which is
 * `additionalMedicareTax`'s and needed no restating.
 *
 * **`selfEmployedHealthInsuranceDeduction`'s remedy is corrected in this
 * phase, and the correction is the kind of thing that rots silently.** It read
 * *"requires the Pub. 535 self-employed health insurance deduction worksheet
 * and a Schedule C or Schedule K-1 this engine does not model"* — a remedy
 * naming, as its reason, a form this phase builds. Half of it is now false.
 * The worksheet half is still true and still blocks the line, so the row stays
 * refused and only the false clause goes.
 *
 * @module
 */
import { assert, assertEq } from 'functionalscript/fjs/asserts/module.f.js'
import { kindVocabulary } from '../profile/module.f.js'

/** @import { Assert } from 'functionalscript/fjs/asserts/module.f.js' */
/** @import { Equal } from 'functionalscript/fjs/types/ts/module.f.js' */
/** @import { Kind } from '../profile/module.f.js' */

// ── The frozen modeled set ───────────────────────────────────────────────────

/**
 * The twenty-six kinds this engine models today, each with the document it
 * actually reads. Frozen in `fjs/guest`'s sense: growing this list is a
 * deliberate act that must be paired with a deletion from
 * {@link unmodeledKindRefusals}, or {@link _EveryKindIsEitherModeledOrRefused}
 * fails to compile.
 *
 * Kept in {@link kindVocabulary} order so the two lists can be diffed against
 * the 1040 face rather than against memory. The six entries before
 * `federalTaxWithheldOnW2` were Plan 12.1-04's own addition
 * (12.1-CONTEXT.md Decision 1.1); `iraDistributions`, `pensionsAndAnnuities`,
 * `socialSecurityBenefits` and `federalTaxWithheldOnOther1099` are Plan
 * 13-02's own (Phase 13 Wave 1, TAX-10) — see this module's own docstring,
 * "Slice 1's retirement and Social Security boundary". `seniorAndOtherScheduleOneADeductions`
 * is Plan 13-04's own (Phase 13 Wave 2, TAX-09) — see "Slice 2's
 * senior-deduction boundary". `itemizedDeductions` is Plan 13-07's own
 * (Phase 13 Wave 3, TAX-13) — see "Slice 3's itemizing boundary".
 * `childTaxCreditOrOtherDependents` and `additionalChildTaxCredit` are Plan
 * 13-10's own (Phase 13 Wave 4, TAX-12) — see "Slice 4's dependents
 * boundary". `additionalMedicareTax` and `netInvestmentIncomeTax` are Phase
 * 23's own (TAX-20/TAX-21) — see "Schedule 2's Additional Medicare Tax and
 * net investment income tax boundary" in this module's own docstring.
 */
export const modeledKinds = /** @type {const} */ ([
    'wages',                       // W-2 box 1                     -> 1040 line 1a
    'taxExemptInterest',           // 1099-INT box 8                -> 1040 line 2a
    'taxableInterest',             // 1099-INT boxes 1 and 3        -> 1040 line 2b
    'qualifiedDividends',          // 1099-DIV box 1b                -> 1040 line 3a
    'ordinaryDividends',           // 1099-DIV box 1a                -> 1040 line 3b
    'iraDistributions',            // 1099-R (box7bIraSepSimple)     -> 1040 lines 4a/4b
    'pensionsAndAnnuities',        // 1099-R (not box7bIraSepSimple) -> 1040 lines 5a/5b
    'socialSecurityBenefits',      // SSA-1099 box 5 + SSB worksheet -> 1040 lines 6a/6b
    'unemploymentCompensation',    // 1099-G box 1 -> Schedule 1 line 7 -> 1040 line 8
    'businessIncomeOrLoss',        // Schedule C line 31 -> Schedule 1 line 3 -> 1040 line 8
    'capitalGainDistributions',    // 1099-DIV box 2a                -> 1040 line 7a
    'capitalGainsOrLosses',        // Form 8949 + Schedule D          -> 1040 line 7a
    'unrecaptured1250Gain',        // 1099-DIV box 2b + Sch D worksheet -> Schedule D line 19
    'collectibles28RateGain',      // 1099-DIV box 2d + Sch D worksheet -> Schedule D line 18
    'educatorExpenses',            // vnd.fjs.adjustments -> Schedule 1 line 11 -> 1040 line 10
    'healthSavingsAccountDeduction', // Form 8889 Part I  -> Schedule 1 line 13 -> 1040 line 10
    'studentLoanInterestDeduction', // 1098-E + worksheet -> Schedule 1 line 21 -> 1040 line 10
    'itemizedDeductions',          // Schedule A + deductionChoice   -> 1040 line 12e
    'seniorAndOtherScheduleOneADeductions', // Schedule 1-A Parts I/V/VI -> 1040 line 13b
    'additionalMedicareTax',       // Form 8959 -> Schedule 2 line 11 -> 1040 lines 23/25c
    'netInvestmentIncomeTax',      // Form 8960 -> Schedule 2 line 12 -> 1040 line 23
    'childTaxCreditOrOtherDependents', // Schedule 8812 Part I       -> 1040 line 19
    'educationCredits',            // Form 8863 line 19 -> Schedule 3 line 3 -> 1040 line 20
    'retirementSavingsContributionsCredit', // Form 8880 -> Schedule 3 line 4 -> 1040 line 20
    'federalTaxWithheldOnW2',      // W-2 box 2                     -> 1040 line 25a
    'federalTaxWithheldOn1099Int', // 1099-INT box 4                -> 1040 line 25b
    'federalTaxWithheldOnOther1099', // 1099-R/1099-DIV/1099-B box 4 -> 1040 line 25b
    'estimatedTaxPayments',        // declared on the return profile -> 1040 line 26
    'additionalChildTaxCredit',    // Schedule 8812 Part II-A       -> 1040 line 28
    'americanOpportunityCredit',   // Form 8863 line 8              -> 1040 line 29
])

/** One member of {@link modeledKinds}.
 * @typedef {typeof modeledKinds[number]} ModeledKind
 */

/**
 * {@link modeledKinds} widened to a plain string list — an ordinary widening
 * ASSIGNMENT, not a cast: the tuple's literal member types are a subtype of
 * `string`, so nothing is silenced. It exists because the membership question
 * is asked of a {@link Kind}, and the twelve-literal tuple's own `.includes`
 * would reject that argument at compile time — the compiler refusing to let us
 * ask the question the guard exists to answer. Same device, same reason, as
 * `fjs/return/profile`'s `kindNames`.
 * @type {readonly string[]}
 */
const modeledKindNames = modeledKinds

// ── The refusal table ────────────────────────────────────────────────────────

/**
 * The fifty declared kinds this engine does not model, each naming the
 * form line that cannot be computed, a human label, and the remedy — the form
 * or schedule required and, where one exists, the requirement ID and phase
 * that will supply it. `10-RESEARCH.md`'s "Form 1040 Lines 1a-37" table is the
 * source of every line number and remedy here; it was read off the 2025 form
 * face (`f1040.pdf`, both pages) rather than inferred.
 *
 * **A list of entries, not a `Record` keyed by kind.** Plan 10-07's action
 * block specifies `Record<UnmodeledKind, {...}>` *and* derives `UnmodeledKind`
 * as `keyof typeof unmodeledKindRefusals`, which is circular and cannot be
 * written. The non-circular reading — `Record<Exclude<Kind, ModeledKind>, …>` —
 * would make {@link _EveryKindIsEitherModeledOrRefused} a tautology, i.e.
 * exactly the decorative assertion that plan forbids. It also cannot produce a
 * `readonly UnmodeledKind[]` for {@link scopeRefusal} without an
 * `Object.keys(...)` cast, which AGENTS.md bans. An entry list solves all
 * three at once: `kind` is a field, so the union below is derived from the
 * data, the ordering is the 1040's own, and every list operation stays typed.
 *
 * The order is {@link kindVocabulary}'s order, which is 1040 form order, and
 * that is load-bearing rather than tidy: {@link scopeRefusal} walks this table
 * to order what it names, so `refusalTableFollowsKindVocabularyOrder` pins it.
 */
// ── Wave 5's ten corrections (Plan 13-13, Decision 1.4 + 13-11's finding) ────
//
// Ten entries below name a phase in their remedy that has now shipped
// WITHOUT making the kind computable -- a remedy naming a phase that
// shipped without it is a FALSE remedy, worse than a vague one, because a
// taxpayer reading it believes the gap will close on its own. Two different
// reasons produced the ten, and they read differently on purpose:
//
// - Decision 1.4's five (`householdEmployeeWages`, `medicaidWaiverPayments`,
//   `otherEarnedIncome`, `federalTaxWithheldOnOtherForms`,
//   `netQualifiedDisasterLoss`) were simply never going to be reached this
//   phase -- Phase 13's own wave plan never touched them. Their remedy now
//   reads `(no phase yet)`, the same phrasing every other not-yet-scheduled
//   kind in this table already uses (see `dependentCareBenefits`,
//   `adoptionBenefits`, etc., immediately above), so a reader cannot tell
//   these five apart from any other ordinary backlog item.
// - The other five (`scheduleOneAdditionalIncome`, `scheduleOneAdjustments`,
//   `scheduleTwoTaxes`, `scheduleThreeNonrefundableCredits`,
//   `scheduleThreeRefundableCredits`) ARE reached: Schedule 1/2/3 modules
//   exist and are wired (Plans 13-11/13-12, TAX-14). They remain refused
//   anyway, because the frozen `kindVocabulary` declares each as one COARSE
//   kind covering many distinct printed lines, and this engine has no
//   per-line dialect to attribute a real amount to any one of them -- so
//   their remedy says exactly that structural reason, not "(no phase yet)".
//
// **Phase 23 (TAX-22) closed the third of those five.** `scheduleTwoTaxes`
// no longer exists: the "one COARSE kind covering many distinct printed
// lines" diagnosis above was exactly right, and the remedy for it was to
// stop having a coarse kind rather than to keep describing one. It is now
// fourteen rows, one per printed Schedule 2 line group, each naming its own
// form.
//
// **Phase 24 (TAX-23/TAX-24) closed the second.** `scheduleOneAdjustments`
// no longer exists either; it is now thirteen rows, one per printed Schedule
// 1 Part II line.
//
// **Phase 25 (TAX-25/TAX-26) closed the fourth and the fifth together.**
// `scheduleThreeNonrefundableCredits` and `scheduleThreeRefundableCredits`
// are now seven and five rows respectively, one per printed Schedule 3 line.
//
// **Phase 27 (DOC-20/DOC-21/TAX-30) closed the first, which was the last one
// standing.** `scheduleOneAdditionalIncome` is now seven rows, one per printed
// Schedule 1 Part I line. **None of the five coarse kinds remains**, and this
// note is kept rather than deleted because the diagnosis it records -- that a
// kind covering many printed lines can only refuse them together, so nothing
// on that block is nameable and nothing on it can be reclassified one line at
// a time -- is the reasoning four separate phases then acted on. It is the
// argument to reach for the next time somebody proposes one kind for a whole
// schedule.
export const unmodeledKindRefusals = /** @type {const} */ ([
    { kind: 'householdEmployeeWages', line: '1040 line 1b', label: 'household employee wages', remedy: 'no dialect models it (no phase yet)' },
    { kind: 'unreportedTips', line: '1040 line 1c', label: 'unreported tips', remedy: 'requires Form 4137 (no phase yet)' },
    { kind: 'medicaidWaiverPayments', line: '1040 line 1d', label: 'nontaxable Medicaid waiver payments', remedy: 'no dialect models it (no phase yet)' },
    { kind: 'dependentCareBenefits', line: '1040 line 1e', label: 'dependent care benefits', remedy: 'requires Form 2441 (no phase yet)' },
    { kind: 'adoptionBenefits', line: '1040 line 1f', label: 'employer-provided adoption benefits', remedy: 'requires Form 8839 (no phase yet)' },
    { kind: 'form8919Wages', line: '1040 line 1g', label: 'Form 8919 wages', remedy: 'requires Form 8919 (no phase yet)' },
    { kind: 'otherEarnedIncome', line: '1040 line 1h', label: 'other earned income', remedy: 'no dialect models it (no phase yet)' },
    { kind: 'nontaxableCombatPayElection', line: '1040 line 1i', label: 'nontaxable combat pay election', remedy: 'no dialect models it (no phase yet)' },
    { kind: 'section1202Gain', line: 'Form 1099-DIV box 2c', label: 'section 1202 gain', remedy: 'requires the §1202 exclusion percentage, which no 1099-DIV box carries (no phase yet)' },
    { kind: 'investmentInterestForm4952', line: 'Form 4952 line 4g', label: 'investment interest expense election', remedy: 'requires Form 4952 and the Schedule D Tax Worksheet (TAX-11, Phase 12)' },
    // ── Schedule 1 Part I's seven per-line kinds (TAX-30, Phase 27) ─────────
    //
    // `scheduleOneAdditionalIncome` -- one coarse row covering this whole
    // block -- stood here until Phase 27 split it, and it was the LAST of the
    // five rows the Wave-5 note above lists. Its remedy said, honestly, that
    // "this coarse kind covers many distinct Schedule 1 line items with no
    // per-line dialect to attribute a real amount to any one of them", which
    // is a sentence a taxpayer can do nothing with: it named neither the line
    // that cannot be computed nor the form that would compute it. Each row
    // below names both, and `line` names the SCHEDULE 1 line first and the
    // 1040 line it reaches second, exactly as the Part II, Schedule 2 and
    // Schedule 3 blocks below already do.
    //
    // **One of the seven is NOT here**, because it is MODELED:
    // `businessIncomeOrLoss` (line 3) moved to {@link modeledKinds} in the
    // SAME commit as the `fjs/schedule/c`/`fjs/schedule/1`/`fjs/form1040/core`
    // wiring that makes it computable -- wire before reclassify, exactly as
    // Phases 23, 24 and 25 did. The split commit before it added all seven as
    // refusals and reclassified nothing.
    //
    // Printed line 7 has no row here and never did: `unemploymentCompensation`
    // is a MODELED kind (Phase 20) and lives far above, among the 1040 lines
    // it was grouped with before this schedule was taken apart.
    { kind: 'taxableStateLocalRefunds', line: 'Schedule 1 line 1 -> 1040 line 8', label: 'taxable refunds, credits or offsets of state and local income taxes', remedy: 'requires the Pub. 525 tax-benefit-rule recovery worksheet, whose inputs are the PRIOR year’s itemized deductions and standard deduction — this engine models one tax year and holds no prior-year return, which is also why `vnd.fjs.1099g` refuses a non-zero box 2 at storage (no phase yet)' },
    { kind: 'alimonyReceived', line: 'Schedule 1 line 2a -> 1040 line 8', label: 'alimony received', remedy: 'requires the divorce-decree date, since only a pre-2019 decree makes alimony taxable to the recipient, and no dialect models it (no phase yet)' },
    { kind: 'otherGainsOrLosses', line: 'Schedule 1 line 4 -> 1040 line 8', label: 'other gains or losses', remedy: 'requires Form 4797, and for a casualty or theft Form 4684 (no phase yet)' },
    { kind: 'rentalRealEstateRoyaltiesPartnershipsSCorps', line: 'Schedule 1 line 5 -> 1040 line 8', label: 'rental real estate, royalties, partnerships, S corporations and trusts', remedy: 'requires Schedule E, and for a partnership or S-corporation stake the Schedule K-1 dialects (DOC-24/TAX-35, Phase 30)' },
    { kind: 'farmIncomeOrLoss', line: 'Schedule 1 line 6 -> 1040 line 8', label: 'farm income or loss', remedy: 'requires Schedule F (no phase yet)' },
    { kind: 'otherIncome', line: 'Schedule 1 line 8a-8z -> 1040 line 8', label: 'other income', remedy: 'the printed form itself collapses twenty-six lettered sub-lines here — among them net operating loss, gambling winnings, jury duty pay, cancellation of debt and the taxable Olympic-medal exclusion — and this engine models none of them (no phase yet)' },
    // ── Schedule 1 Part II's thirteen per-line kinds (TAX-23/24, Phase 24) ──
    //
    // `scheduleOneAdjustments` -- one coarse row covering this whole block --
    // stood here until Phase 24 split it. Its remedy said, honestly, that
    // "this coarse kind covers many distinct Schedule 1 line items with no
    // per-line dialect to attribute a real amount to any one of them", which
    // is a sentence a taxpayer can do nothing with: it named neither the line
    // that cannot be computed nor the form that would compute it. Each row
    // below names both, and `line` names the SCHEDULE 1 line first and the
    // 1040 line it reaches second, exactly as the Schedule 2 block above
    // does.
    //
    // **Three of the thirteen are NOT here**, because they are MODELED:
    // `educatorExpenses` (line 11), `healthSavingsAccountDeduction` (line 13)
    // and `studentLoanInterestDeduction` (line 21) moved to
    // {@link modeledKinds} in the SAME commit as the
    // `fjs/schedule/1`/`fjs/form1040/core` wiring that makes them computable
    // -- wire before reclassify, exactly as Phase 23's own two-step Schedule
    // 2 split did and as every slice this module's docstring records already
    // established. The split commit before it added all thirteen as
    // refusals and reclassified nothing.
    { kind: 'reservistPerformingArtistFeeBasisExpenses', line: 'Schedule 1 line 12 -> 1040 line 10', label: 'certain business expenses of reservists, performing artists and fee-basis government officials', remedy: 'requires Form 2106 (no phase yet)' },
    { kind: 'movingExpensesArmedForces', line: 'Schedule 1 line 14 -> 1040 line 10', label: 'moving expenses for members of the Armed Forces', remedy: 'requires Form 3903 (no phase yet)' },
    { kind: 'deductiblePartOfSelfEmploymentTax', line: 'Schedule 1 line 15 -> 1040 line 10', label: 'the deductible part of self-employment tax', remedy: 'requires Schedule SE (TAX-31, Phase 28)' },
    { kind: 'selfEmployedRetirementPlans', line: 'Schedule 1 line 16 -> 1040 line 10', label: 'self-employed SEP, SIMPLE and qualified plan contributions', remedy: 'requires the Pub. 560 deduction worksheet, whose limit depends on net self-employment earnings this engine does not compute (no phase yet)' },
    // The remedy below said "and a Schedule C or Schedule K-1 this engine does
    // not model" until Phase 27, which built Schedule C. Half a remedy going
    // false is worse than a vague one: a reader is told the gap is a missing
    // form that is no longer missing. What still blocks the line is the
    // WORKSHEET, whose §162(l)(2)(A) cap is the net earnings from the trade or
    // business -- Schedule SE line 4, Phase 28 -- so the row stays and the
    // false clause goes.
    { kind: 'selfEmployedHealthInsuranceDeduction', line: 'Schedule 1 line 17 -> 1040 line 10', label: 'the self-employed health insurance deduction', remedy: 'requires the Pub. 535 self-employed health insurance deduction worksheet, whose §162(l)(2)(A) cap is the net earnings from the trade or business — Schedule C is modeled as of Phase 27 but that net-earnings figure is Schedule SE’s (TAX-31, Phase 28)' },
    { kind: 'penaltyOnEarlyWithdrawalOfSavings', line: 'Schedule 1 line 18 -> 1040 line 10', label: 'the penalty on early withdrawal of savings', remedy: 'requires Form 1099-INT box 2, which `vnd.fjs.1099int` stores but no computation reads (no phase yet)' },
    { kind: 'alimonyPaid', line: 'Schedule 1 line 19a -> 1040 line 10', label: 'alimony paid', remedy: 'requires the recipient\u2019s SSN and the divorce-decree date, since only a pre-2019 decree makes alimony deductible, and no dialect models either (no phase yet)' },
    { kind: 'iraDeduction', line: 'Schedule 1 line 20 -> 1040 line 10', label: 'the IRA deduction', remedy: 'requires Pub. 590-A Worksheet 1-1, whose own modified adjusted gross income depends on 1040 line 6b while line 6b depends on this deduction \u2014 a fixed point this engine does not model (no phase yet)' },
    { kind: 'archerMsaDeduction', line: 'Schedule 1 line 23 -> 1040 line 10', label: 'the Archer MSA deduction', remedy: 'requires Form 8853 (no phase yet)' },
    { kind: 'otherAdjustments', line: 'Schedule 1 line 24a-24z -> 1040 line 10', label: 'other adjustments to income', remedy: 'the printed form itself collapses eleven lettered sub-lines here and this engine models none of them (no phase yet)' },
    { kind: 'netQualifiedDisasterLoss', line: '1040 line 12e', label: 'net qualified disaster loss', remedy: 'requires Form 4684 (no phase yet)' },
    { kind: 'qualifiedBusinessIncomeDeduction', line: '1040 line 13a', label: 'qualified business income deduction', remedy: 'requires Form 8995 or 8995-A (TAX-32, Phase 28)' },
    // ── Schedule 2's fourteen per-line kinds (TAX-22, Phase 23) ─────────────
    //
    // `scheduleTwoTaxes` -- one coarse row covering this whole block --
    // stood here until Phase 23 split it. Its remedy said, honestly, that
    // "this coarse kind covers AMT, self-employment tax and other Schedule 2
    // items this engine has no dialect for", which is a sentence a taxpayer
    // can do nothing with: it named neither the line that cannot be computed
    // nor the form that would compute it. Each row below names both, and
    // `line` names the SCHEDULE 2 line first and the 1040 line it reaches
    // second, because a reader holding a Schedule 2 needs the former and a
    // reader holding a 1040 needs the latter.
    //
    // Schedule 2 lines 5 and 6 have no row here on purpose: `unreportedTips`
    // (Form 4137) and `form8919Wages` (Form 8919) already name those two
    // taxes, one 1040 line each, above. See `fjs/return/profile`'s own
    // vocabulary comment.
    { kind: 'advancePremiumTaxCreditAndOtherRepayments', line: 'Schedule 2 line 1a-1z -> 1040 line 17', label: 'excess advance premium tax credit repayment and the other Part I repayments', remedy: 'requires Form 8962, and for the clean-vehicle-credit and elective-payment-election recapture sub-lines Forms 8936 and 3800 (no phase yet)' },
    { kind: 'alternativeMinimumTax', line: 'Schedule 2 line 2 -> 1040 line 17', label: 'alternative minimum tax', remedy: 'requires Form 6251 (TAX-33, Phase 29)' },
    { kind: 'selfEmploymentTax', line: 'Schedule 2 line 4 -> 1040 line 23', label: 'self-employment tax', remedy: 'requires Schedule SE (TAX-31, Phase 28)' },
    { kind: 'additionalTaxOnTaxFavoredAccounts', line: 'Schedule 2 line 8 -> 1040 line 23', label: 'additional tax on IRAs or other tax-favored accounts', remedy: 'requires Form 5329 (no phase yet)' },
    { kind: 'householdEmploymentTaxes', line: 'Schedule 2 line 9 -> 1040 line 23', label: 'household employment taxes', remedy: 'requires Schedule H (no phase yet)' },
    { kind: 'uncollectedTaxOnTipsOrGroupTermLife', line: 'Schedule 2 line 13 -> 1040 line 23', label: 'uncollected Social Security, Medicare or RRTA tax on tips or group-term life insurance', remedy: 'requires Form W-2 box 12 codes A, B, M or N, which no dialect field models (no phase yet)' },
    { kind: 'interestOnResidentialLotAndTimeshareInstallments', line: 'Schedule 2 line 14 -> 1040 line 23', label: 'interest on the tax due on installment income from residential lots and timeshares', remedy: 'requires the §453(l)(3) computation, which no document this engine models supplies (no phase yet)' },
    { kind: 'interestOnDeferredInstallmentSaleTax', line: 'Schedule 2 line 15 -> 1040 line 23', label: 'interest on the deferred tax on installment sales over $150,000', remedy: 'requires the §453A(c) computation, which no document this engine models supplies (no phase yet)' },
    { kind: 'lowIncomeHousingCreditRecapture', line: 'Schedule 2 line 16 -> 1040 line 23', label: 'recapture of the low-income housing credit', remedy: 'requires Form 8611 (no phase yet)' },
    { kind: 'otherAdditionalTaxes', line: 'Schedule 2 line 17a-17z -> 1040 line 23', label: 'other additional taxes', remedy: 'the printed form itself collapses more than twenty lettered sub-lines here and this engine models none of them (no phase yet)' },
    { kind: 'premiumTaxCreditReconciliation', line: 'Schedule 2 line 19 -> 1040 line 23', label: 'reconciliation of the premium tax credit and excess advance payment recapture', remedy: 'requires Form 8962 (no phase yet)' },
    { kind: 'section965NetTaxLiabilityInstallment', line: 'Schedule 2 line 20', label: 'section 965 net tax liability installment', remedy: 'requires Form 965-A (no phase yet)' },
    // ── Schedule 3 Part I's seven per-line kinds (TAX-25/26, Phase 25) ──────
    //
    // `scheduleThreeNonrefundableCredits` -- one coarse row covering this
    // whole block -- stood here until Phase 25 split it, and its remedy was
    // the last surviving copy of the sentence Phase 23 and Phase 24 each
    // deleted one schedule earlier: "this coarse kind covers many distinct
    // Schedule 3 nonrefundable credits with no per-credit dialect to
    // attribute a real amount to any one of them". A taxpayer can do nothing
    // with that. Each row below names the printed line that cannot be
    // computed AND the form that would compute it, and `line` names the
    // SCHEDULE 3 line first and the 1040 line it reaches second, exactly as
    // the Schedule 1 and Schedule 2 blocks above do.
    //
    // **Two of the seven are NOT here**, because they are MODELED:
    // `educationCredits` (line 3) and `retirementSavingsContributionsCredit`
    // (line 4) moved to {@link modeledKinds} in the SAME commit as the
    // `fjs/schedule/3`/`fjs/form1040/core` wiring that makes them computable
    // -- wire before reclassify, exactly as Phases 23 and 24 did. The split
    // commit before it added all twelve as refusals and reclassified nothing.
    //
    // `americanOpportunityCredit` (1040 line 29) moved with them, out of the
    // Part II block far below, because Form 8863's ONE execution produces
    // both it and line 3 -- see this module's own docstring.
    //
    // `dependentCareCredit` and `dependentCareBenefits` (1040 line 1e) are
    // BOTH kinds, and that is deliberate, unlike the Schedule 2 block above
    // where `unreportedTips` deliberately got no second kind for its own tax.
    // The two halves of Form 2441 are separable facts a taxpayer can have one
    // of without the other: Part III's employer-provided benefits are
    // INCLUDIBLE INCOME, and Part II's credit is a credit. Declaring one
    // would not be declaring the other.
    { kind: 'foreignTaxCredit', line: 'Schedule 3 line 1 -> 1040 line 20', label: 'the foreign tax credit', remedy: 'requires Form 1116 (no phase yet)' },
    { kind: 'dependentCareCredit', line: 'Schedule 3 line 2 -> 1040 line 20', label: 'the credit for child and dependent care expenses', remedy: 'requires Form 2441 Part II (no phase yet)' },
    { kind: 'residentialCleanEnergyCredit', line: 'Schedule 3 line 5a -> 1040 line 20', label: 'the residential clean energy credit', remedy: 'requires Form 5695 Part I (no phase yet)' },
    { kind: 'energyEfficientHomeImprovementCredit', line: 'Schedule 3 line 5b -> 1040 line 20', label: 'the energy efficient home improvement credit', remedy: 'requires Form 5695 Part II (no phase yet)' },
    { kind: 'otherNonrefundableCredits', line: 'Schedule 3 line 6a-6z -> 1040 line 20', label: 'other nonrefundable credits', remedy: 'the printed form itself collapses thirteen lettered sub-lines here — among them the general business credit, the prior-year minimum tax credit, the NONrefundable half of the adoption credit and the credit for the elderly or disabled on Schedule R — and this engine models none of them (no phase yet)' },
    { kind: 'federalTaxWithheldOnOtherForms', line: '1040 line 25c', label: 'federal income tax withheld on other forms', remedy: 'no dialect models it (no phase yet)' },
    { kind: 'earnedIncomeCredit', line: '1040 line 27a', label: 'earned income credit', remedy: '§32(c)(3)’s qualifying-child test needs four facts `vnd.fjs.return_profile`’s dependents array does not carry — a checked relationship vocabulary, full-time-student status, permanent and total disability, and residency in the United States for more than half the year — and §32(c)(1) needs three about the filer that it does not carry either: an age between 25 and 65 for the childless credit, a valid social security number, and not being another taxpayer’s qualifying child. This engine holds none of the seven, and a wrong earned income credit is the most audited figure on the return; see fjs/todo/tax-27-earned-income-credit.md (no phase yet)' },
    { kind: 'refundableAdoptionCredit', line: '1040 line 30', label: 'refundable adoption credit', remedy: 'requires Form 8839 (no phase yet)' },
    // ── Schedule 3 Part II's five per-line kinds (Phase 25) ─────────────────
    //
    // `scheduleThreeRefundableCredits` -- one coarse row covering this whole
    // block -- stood here until Phase 25 split it, for the identical reason
    // as Part I's above. NONE of the five is reclassified by this phase or
    // any commit in it: TAX-25 and TAX-26 reach Part I's lines 3 and 4 only.
    //
    // `excessSocialSecurityWithheld` is the row worth reading. Every other
    // refusal in this whole table is unmodeled because no document this
    // engine holds carries the figure. That one is different: `vnd.fjs.w2`
    // box 4 already carries it, on every W-2 this engine stores, and the
    // computation is a comparison against one indexed maximum. It is refused
    // because it is not modeled, not because it is unmodelable -- a
    // distinction the remedy says out loud, so a reader is not told to go and
    // find a form that does not exist. `fjs/schedule/3`'s own docstring has
    // recorded this boundary since Phase 13.
    { kind: 'netPremiumTaxCredit', line: 'Schedule 3 line 9 -> 1040 line 31', label: 'the net premium tax credit', remedy: 'requires Form 8962 (no phase yet)' },
    { kind: 'amountPaidWithExtensionRequest', line: 'Schedule 3 line 10 -> 1040 line 31', label: 'the amount paid with a request for an extension to file', remedy: 'no dialect models it — there is no information return for a payment made with Form 4868 (no phase yet)' },
    { kind: 'excessSocialSecurityWithheld', line: 'Schedule 3 line 11 -> 1040 line 31', label: 'excess Social Security and tier-1 RRTA tax withheld', remedy: 'no form is missing: this is computable from the Form W-2 box 4 figures this engine already stores, by comparing their sum against the annual Social Security wage-base maximum, and it is unmodeled only because no phase has yet stored that maximum or written the comparison (no phase yet)' },
    { kind: 'federalFuelTaxCredit', line: 'Schedule 3 line 12 -> 1040 line 31', label: 'the credit for federal tax paid on fuels', remedy: 'requires Form 4136 (no phase yet)' },
    { kind: 'otherPaymentsAndRefundableCredits', line: 'Schedule 3 line 13a-13z -> 1040 line 31', label: 'other payments or refundable credits', remedy: 'the printed form itself collapses five lettered sub-lines here and this engine models none of them (no phase yet)' },
    // ── The nine line-16 entries below matter more than they look ────────────
    //
    // `[VERIFIED: i1040gi.pdf p34, "Line 16 Tax"]` — line 16 is a SUM, not just
    // the result of the four-way method dispatch: "Include in the total on the
    // entry space on line 16 all of the following taxes that apply." The first
    // three below REPLACE the dispatch (Form 2555's Foreign Earned Income Tax
    // Worksheet, Form 8615, Schedule J); the last six ADD to it (Forms 8814,
    // 4972, a section 962 election, an education credit recapture, Forms 8621
    // and 8978).
    //
    // An engine that models line 16 as "the dispatch result" and silently omits
    // the add-ons is exactly TAX-16's failure mode: every line above 16 agrees
    // with the taxpayer's own return, line 16 is quietly short, and nothing in
    // the report says why. They are refusals precisely so that cannot happen.
    { kind: 'foreignEarnedIncomeForm2555', line: '1040 line 16', label: 'foreign earned income exclusion', remedy: 'requires Form 2555 and the Foreign Earned Income Tax Worksheet (no phase yet)' },
    { kind: 'childsUnearnedIncomeForm8615', line: '1040 line 16', label: "a child's unearned income", remedy: 'requires Form 8615 (no phase yet)' },
    { kind: 'farmIncomeAveragingScheduleJ', line: '1040 line 16', label: 'farm and fishing income averaging', remedy: 'requires Schedule J (no phase yet)' },
    { kind: 'form8814ChildInterestAndDividends', line: '1040 line 16', label: 'tax from Form 8814', remedy: 'requires Form 8814 (no phase yet)' },
    { kind: 'form4972LumpSumDistribution', line: '1040 line 16', label: 'tax from Form 4972', remedy: 'requires Form 4972 (no phase yet)' },
    { kind: 'section962Election', line: '1040 line 16', label: 'tax with respect to a section 962 election', remedy: 'no phase yet' },
    { kind: 'educationCreditRecapture', line: '1040 line 16', label: 'recapture of an education credit', remedy: 'no phase yet' },
    { kind: 'form8621', line: '1040 line 16', label: 'tax from Form 8621 line 16e', remedy: 'no phase yet' },
    { kind: 'form8978', line: '1040 line 16', label: 'tax from Form 8978 line 14', remedy: 'no phase yet' },
])

/** One entry of {@link unmodeledKindRefusals}.
 * @typedef {typeof unmodeledKindRefusals[number]} KindRefusal
 */

/** A {@link Kind} this engine does not model — exactly the kinds
 * {@link unmodeledKindRefusals} carries an entry for.
 * @typedef {KindRefusal['kind']} UnmodeledKind
 */

/**
 * **The MODELED kinds a tripwire may still require to have been DECLARED**
 * (Phase 23) — the smallest table this module has, and the one that needs
 * the most explanation.
 *
 * Until Phase 23, every kind a tripwire could point at was an
 * {@link UnmodeledKind}, and `fjs/return/tripwire`'s own `Tripwire` docstring
 * said why: {@link tripwireRefusal} describes a kind by looking it up in
 * {@link unmodeledKindRefusals}, so a tripwire aimed at a modeled kind could
 * not be described. It added, correctly, that a kind moving to
 * {@link modeledKinds} "therefore stops this file compiling, which is the
 * right moment to decide whether its tripwire still means anything."
 *
 * **Phase 23 is that moment, and the decision was to keep the tripwire.**
 * Its box-5 entry requires `additionalMedicareTax`, which this phase makes
 * computable. The two facts are not in tension once the alternative is
 * stated: without the tripwire, a filer above the threshold who has never
 * heard of Form 8959 would have the tax computed onto their return with no
 * indication that a Schedule 2 tax had appeared, and the whole declared-set
 * design (this module's first section) rests on a taxpayer's declaration
 * being what puts a category of tax on their return. So the refusal survives
 * — with a completely different REMEDY. Before this phase it said *"requires
 * Form 8959"*, which asked the taxpayer to go and find a form. Now it says
 * *"declare it and this engine computes it for you"*, which is a one-word
 * fix and the reason the phase exists.
 *
 * **This is not a third arm of the partition.** Every kind here is in
 * {@link modeledKinds} — `_EveryDeclarationRequiredKindIsModeled` makes that
 * a `tsc` property, so an entry naming a refused kind, or a kind that later
 * moves back into {@link unmodeledKindRefusals}, stops the build. What this
 * table adds is a DESCRIPTION for a kind the refusal table no longer
 * describes, nothing more; {@link _EveryKindIsEitherModeledOrRefused} is
 * untouched and still owns the partition.
 *
 * `netInvestmentIncomeTax` is deliberately NOT here. No tripwire points at
 * it, because §1411's threshold is on modified adjusted gross income rather
 * than on any single stored box, and a tripwire runs before AGI is computed —
 * see `fjs/return/tripwire`'s own docstring for why an over-approximation
 * would be worse than no entry. An unused row here would be a description of
 * a refusal nothing can raise.
 */
export const modeledKindDeclarationRemedies = /** @type {const} */ ([
    {
        kind: 'additionalMedicareTax',
        line: 'Schedule 2 line 11 -> 1040 line 23',
        label: 'Additional Medicare Tax',
        remedy: 'declare additionalMedicareTax on the return profile and this engine computes Form 8959 '
            + 'from Form W-2 boxes 5 and 6, including the withholding your employer already made (TAX-20, Phase 23)',
    },
    {
        kind: 'businessIncomeOrLoss',
        line: 'Schedule 1 line 3 -> 1040 line 8',
        label: 'business income or loss',
        remedy: 'declare businessIncomeOrLoss on the return profile and this engine computes '
            + 'Schedule C from your Forms 1099-NEC and a vnd.fjs.business_expenses record '
            + '(TAX-30, Phase 27). Note that Schedule C is where this ends: self-employment tax '
            + 'on Schedule SE and the qualified business income deduction on Form 8995 are still '
            + 'refused by name (TAX-31/TAX-32, Phase 28)',
    },
])

/** One entry of {@link modeledKindDeclarationRemedies}.
 * @typedef {typeof modeledKindDeclarationRemedies[number]} ModeledKindRemedy
 */

/** A MODELED {@link Kind} a tripwire may nonetheless require to have been
 * declared — exactly the kinds {@link modeledKindDeclarationRemedies} carries
 * an entry for.
 * @typedef {ModeledKindRemedy['kind']} DeclarationRequiredKind
 */

/**
 * Every kind a refusal — of either arm — can NAME. The declared-scope arm
 * only ever names an {@link UnmodeledKind}; the tripwire arm can also name a
 * {@link DeclarationRequiredKind}.
 * @typedef {UnmodeledKind | DeclarationRequiredKind} RefusableKind
 */

/**
 * A `tsc` property, in the shape {@link _EveryKindIsEitherModeledOrRefused}
 * already establishes one module section above: every
 * {@link DeclarationRequiredKind} must be a {@link ModeledKind}.
 *
 * Verified by widening the guarded thing and watching this line fail to
 * compile, per the discipline that assertion's own docstring records. Without
 * it, a kind could sit in BOTH {@link unmodeledKindRefusals} and
 * {@link modeledKindDeclarationRemedies} and be described twice, with the
 * first lookup silently winning.
 * @typedef {Assert<Equal<Extract<ModeledKind, DeclarationRequiredKind>, DeclarationRequiredKind>>} _EveryDeclarationRequiredKindIsModeled
 */

/**
 * One kind as a refusal can describe it: the form line that cannot be
 * computed (or, for a {@link DeclarationRequiredKind}, the line the
 * undeclared tax would land on), a human label, and the remedy.
 *
 * The two tables' rows already have this shape, so this typedef is what lets
 * {@link tripwireRefusal} walk them as one list without a cast.
 * @typedef {{ readonly kind: RefusableKind, readonly line: string, readonly label: string, readonly remedy: string }} KindDescription
 */

/**
 * One kind's description, from whichever of the two tables carries it — no
 * description at all for a modeled kind no tripwire may require.
 *
 * Written as a named function with an explicit return type rather than
 * inline in the `flatMap` below, because `tsc` otherwise infers the two
 * branches as two DIFFERENT array element types and refuses to unify them
 * (TS2345). The annotation is the fix; a cast would have been the other one,
 * and AGENTS.md bans it.
 * @type {(kind: Kind) => readonly KindDescription[]}
 */
const describeKind = kind => {
    const refusal = unmodeledKindRefusals.find(entry => entry.kind === kind)
    if (refusal !== undefined) {
        return [refusal]
    }
    const declarationRemedy = modeledKindDeclarationRemedies.find(entry => entry.kind === kind)
    return declarationRemedy === undefined ? [] : [declarationRemedy]
}

/**
 * {@link unmodeledKindRefusals} and {@link modeledKindDeclarationRemedies}
 * as ONE list, in {@link kindVocabulary} order.
 *
 * Built by walking the VOCABULARY rather than by concatenating the two
 * tables, which is what keeps the ordering property {@link tripwireRefusal}
 * relies on true: 1040 form order comes from the module that owns the
 * vocabulary, not from the order somebody happened to append a second table
 * in. It is also the reason `refusalTableFollowsKindVocabularyOrder` still
 * only has to constrain one table — this walk cannot be out of order.
 * @type {readonly KindDescription[]}
 */
const describableKinds = kindVocabulary.flatMap(describeKind)

/**
 * The partition, as a compile-time property (`fjs/guest`'s
 * `_CasOpIsExactlyTheFourCommands` precedent).
 *
 * Add a kind to `fjs/return/profile`'s {@link kindVocabulary} and classify it
 * in neither list, and `Equal` becomes `false`, `Assert` fails its
 * `T extends true` constraint, and the build stops at `tsc`. Delete an entry
 * from {@link unmodeledKindRefusals} and the same thing happens from the other
 * direction. **Equality, not two `extends` checks**: it catches a widening by
 * ANY kind rather than only the ones somebody thought to list, and it catches
 * accidental narrowing, which an enumeration misses entirely.
 *
 * Verified by widening the guarded thing and watching this line fail to
 * compile — Plan 10-07's mutations 2 and 3, transcripts in the SUMMARY. An
 * unverified negative type property is decoration.
 * @typedef {Assert<Equal<Kind, ModeledKind | UnmodeledKind>>} _EveryKindIsEitherModeledOrRefused
 */

// ── The rule ─────────────────────────────────────────────────────────────────

/**
 * One scope decision. `10-CONTEXT.md` Decision 2 fixes the shape: an unmodeled
 * declared input makes the ENTIRE report an error result naming what is
 * unmodeled. A partial 1040 is never returned, so there is no way to mistake
 * one for a complete return — the strictest reading of criterion 4's "never a
 * silently omitted line".
 *
 * **The `unmodeled` field keeps its name even though, since Phase 23, it can
 * carry one MODELED kind.** What it has always meant is "the kinds this
 * refusal names", and for the declared-scope arm those are exactly the
 * unmodeled ones; the tripwire arm can now also name a
 * {@link DeclarationRequiredKind}, whose computation this engine performs
 * only once it is declared. Renaming the field would edit the SOURCE TEXT of
 * the stored 1040 guest program in `fjs/report/tax_return`, which would move
 * every `programHash` and every pinned-rerun record that quotes one — a
 * provenance change (PROV-03/PROV-05) this phase has no business making for
 * a field name. The type is what says what may be in it.
 *
 * The discriminated `kind` is `fjs/report/guard`'s `RunOutcome` shape,
 * deliberately WITHOUT its `reads` field: a scope refusal is decided before any
 * read happens, and inventing an empty `reads` would claim a run that never
 * occurred — and would collide with the one value `classifyRunOutcome` treats
 * as its own kill condition. The two guards are siblings and neither subsumes
 * the other: `classifyRunOutcome` catches "computed nothing"; this catches
 * "computed only part of the return and said nothing".
 * @typedef {{ readonly kind: 'ok' } | { readonly kind: 'error', readonly message: string, readonly unmodeled: readonly RefusableKind[] }} ScopeOutcome
 */

/**
 * The ERROR member of {@link ScopeOutcome}, extracted so {@link scopeRefusal}
 * can return exactly it.
 *
 * This is not tidiness. Plan 10-08's line-16 dispatcher spreads the result
 * into its own `Line16Outcome` error arm; if {@link scopeRefusal} returned the
 * whole union, that call site could reach `message` and `unmodeled` only
 * through a cast or a `!`, both banned by AGENTS.md, and the one remaining
 * compliant option — an `assert` at every call site — would move the narrowing
 * out of the single place the rule lives and into each consumer.
 * @typedef {Extract<ScopeOutcome, { readonly kind: 'error' }>} ScopeError
 */

/**
 * **The ONLY place a `ScopeError` VALUE is constructed.** Both public builders
 * below — {@link scopeRefusal} (the taxpayer declared something unmodeled) and
 * {@link tripwireRefusal} (the DOCUMENTS prove something the taxpayer did not
 * declare) — route through this one body, so mutating it is the only way to
 * change what any call site in the engine refuses with.
 *
 * That sentence is copied from `fjs/report/guard`'s `classifyRunOutcome`
 * deliberately, and so is the reason: the zero-read kill condition once existed
 * in two places, every proof bound to the copy that did not ship, and the
 * shipped rule had no coverage at all while 258 tests were green. A second,
 * parallel scope-refusal builder would reproduce that defect exactly — which is
 * why Phase 22 added a second QUESTION here rather than a second refusal TYPE.
 *
 * `preamble` and `parts` are joined by `'; '` and `' | '` respectively, which
 * is the format {@link expectedUnreportedTipsRefusalMessage} has pinned
 * character-for-character since Phase 10; extracting this function changed no
 * byte of it.
 * @type {(preamble: string) => (parts: readonly string[]) => (kinds: readonly RefusableKind[]) => ScopeError}
 */
const scopeError = preamble => parts => kinds => ({
    kind: 'error',
    message: `${preamble}; ${parts.join(' | ')}`,
    unmodeled: kinds,
})

/**
 * **The declared-scope refusal**: the taxpayer DECLARED a kind this engine does
 * not model. Plan 10-08's Schedule D Tax Worksheet arm and its three line-16
 * wrapper arms import this function; they do not construct a
 * `{ kind: 'error' }` of their own, and neither does {@link tripwireRefusal},
 * which shares {@link scopeError} with it.
 *
 * The message names, for each kind, the 1040 line that cannot be computed, the
 * human label, and the remedy — because a refusal that does not say WHAT is
 * unmodeled is no better than the silence it replaces. Nothing but this
 * module's compiled-in strings reaches the message: no taxpayer amount, name or
 * document hash can be carried out through it (T-10-07-04), which the
 * hand-typed {@link expectedUnreportedTipsRefusalMessage} pins exactly.
 *
 * The order is {@link kindVocabulary}'s (1040 form order), obtained by walking
 * {@link unmodeledKindRefusals} rather than by sorting the argument, so two
 * profiles declaring the same kinds in different orders produce byte-identical
 * messages. That walk is also what makes the lookup total: the entry and its
 * `kind` come from the same record, so there is no indexed access to narrow and
 * no cast to be tempted by.
 *
 * A refusal that names nothing would be precisely the silent partial return
 * this module exists to prevent, so an empty argument throws a bare value
 * rather than producing one.
 * @type {(kinds: readonly UnmodeledKind[]) => ScopeError}
 */
export const scopeRefusal = kinds => {
    assert(
        kinds.length !== 0,
        ['a scope refusal must name at least one unmodeled kind', kinds],
    )
    const entries = unmodeledKindRefusals.filter(r => kinds.includes(r.kind))
    return scopeError(
        `scope refusal: this return declares ${entries.length} kind(s) this engine does not model, so no Form 1040 is produced`,
    )(
        entries.map(r => `${r.kind} at ${r.line} (${r.label}): ${r.remedy}`),
    )(
        entries.map(r => r.kind),
    )
}

/**
 * One tripwire that fired: the kind the supplied documents PROVE must have been
 * declared, and the compiled-in prose naming the evidence that proves it.
 *
 * `evidence` is a `string` the CALLER supplies, and every caller supplies a
 * literal compiled into `fjs/return/tripwire`'s own table — never a value read
 * off a taxpayer document. That is what keeps T-10-07-04 (no taxpayer amount,
 * name or document hash reaches a refusal message) true of this arm as well as
 * the declared-scope arm — and `fjs/return/tripwire`'s own
 * `noTaxpayerAmountRidesOutThroughATripwireRefusal` leaf is what stops it from
 * being a convention nobody checks, since this module cannot see where a
 * caller's string came from. The evidence names the BOX and the FORM the
 * amount would have gone to, which is the half a reader can act on; the amount
 * itself they already have in front of them.
 * @typedef {{ readonly kind: RefusableKind, readonly evidence: string }} TripwireFinding
 */

/**
 * **The documents-prove-it refusal** (TAX-19, Phase 22) — the complementary
 * half of {@link classifyScope}, and deliberately NOT folded into it.
 *
 * `classifyScope` answers *"is what the taxpayer declared computable?"*. This
 * answers a different question with a different failure mode: *"did the
 * taxpayer fail to declare something the supplied documents PROVE?"* A single
 * filer with $300,000 in W-2 box 5 owes Additional Medicare Tax whether or not
 * they have heard of Form 8959, and `classifyScope` is silent on that case by
 * construction — its soundness rests on the taxpayer knowing what they owe,
 * which is the thing they came to a tax engine not to have to know
 * (`.planning/PERSONA-COVERAGE.md`, "The structural finding").
 *
 * It shares this module's ONE refusal shape and ONE constructor
 * ({@link scopeError}), for the reason that function's own docstring records.
 * What differs is the sentence: this one says the DOCUMENTS require the kind,
 * where {@link scopeRefusal} says the RETURN declared it — reading a tripwire
 * refusal as though the taxpayer had declared something would send them looking
 * for a declaration they never made.
 *
 * Ordering, totality and the empty-argument refusal are all
 * {@link scopeRefusal}'s, for the same reasons: the walk is over
 * {@link unmodeledKindRefusals}, so two tripwires firing in either order
 * produce byte-identical messages, and every lookup takes its `kind` from the
 * record it came from rather than from an index.
 * @type {(findings: readonly TripwireFinding[]) => ScopeError}
 */
export const tripwireRefusal = findings => {
    assert(
        findings.length !== 0,
        ['a tripwire refusal must name at least one required kind', findings],
    )
    // Walk the DESCRIPTION list (1040 form order), pairing each entry with
    // the finding that named it — never the findings list, whose order is the
    // tripwire table's rather than the form's. Since Phase 23 that list is
    // {@link describableKinds} rather than {@link unmodeledKindRefusals}
    // alone, so a tripwire may also name a MODELED kind whose computation
    // this engine will not perform undeclared; see
    // {@link modeledKindDeclarationRemedies} for why one exists.
    const paired = describableKinds.flatMap(r => {
        const finding = findings.find(f => f.kind === r.kind)
        return finding === undefined ? [] : [{ entry: r, evidence: finding.evidence }]
    })
    return scopeError(
        `tripwire refusal: the supplied documents require ${paired.length} kind(s) this return did not declare, so no Form 1040 is produced`,
    )(
        paired.map(p => `${p.entry.kind} at ${p.entry.line} (${p.entry.label}): ${p.evidence} — ${p.entry.remedy}`),
    )(
        paired.map(p => p.entry.kind),
    )
}

/**
 * TAX-16, in one comparison: the kinds the taxpayer DECLARED against the kinds
 * this engine MODELS. Declaring nothing is in scope and yields a return of
 * zeros; declaring only modeled kinds is in scope; declaring anything else
 * refuses the whole return through {@link scopeRefusal}.
 *
 * The two filters are not redundant. The first is the rule itself — declared
 * MINUS modeled — and is what makes the guard's inversion break the `'ok'` path
 * as well as the refusal path, which is what a control leg is for. The second
 * re-expresses that same set through {@link unmodeledKindRefusals}, the typed
 * carrier of {@link UnmodeledKind}; the two sets are equal because
 * {@link _EveryKindIsEitherModeledOrRefused} says so at `tsc` level, which is
 * why the second filter needs neither a cast nor a fallback.
 * @type {(declaredKinds: readonly Kind[]) => ScopeOutcome}
 */
export const classifyScope = declaredKinds => {
    const declaredAndNotModeled = declaredKinds.filter(kind => !modeledKindNames.includes(kind))
    if (declaredAndNotModeled.length === 0) {
        return { kind: 'ok' }
    }
    return scopeRefusal(
        unmodeledKindRefusals
            .map(r => r.kind)
            .filter(kind => declaredAndNotModeled.includes(kind)),
    )
}

// ── Tests ────────────────────────────────────────────────────────────────────

/**
 * Independently hand-typed: the number of kinds {@link modeledKinds} names
 * today. Deliberately NOT `modeledKinds.length` — if it were, adding or
 * dropping a kind would move both sides together and this check could never
 * fail. The duplication is the mechanism, not a smell (AGENTS.md). `6 -> 12`
 * was Plan 12.1-04's own six-kind reclassification; `12 -> 16` was Plan
 * 13-02's own four-kind reclassification (Phase 13 Wave 1, TAX-10); `16 ->
 * 17` was Plan 13-04's own one-kind reclassification (Phase 13 Wave 2,
 * TAX-09); `17 -> 18` was Plan 13-07's own one-kind reclassification (Phase
 * 13 Wave 3, TAX-13); `18 -> 20` was Plan 13-10's own two-kind
 * reclassification (Phase 13 Wave 4, TAX-12); `20 -> 21` was Phase 20's own
 * `unemploymentCompensation`; `21 -> 23` was Phase 23's own two-kind
 * reclassification (TAX-20/TAX-21), landed in the same commit as the
 * Schedule 2 line 11/12 wiring that makes both computable; `23 -> 26` was
 * Phase 24's own three-kind Schedule 1 Part II reclassification; and
 * `26 -> 29` is Phase 25's own (`educationCredits`,
 * `retirementSavingsContributionsCredit`, `americanOpportunityCredit`),
 * landed beside the Schedule 3 wiring that makes all three computable.
 * @type {number}
 */
const expectedModeledKindCount = 30

/**
 * The modeled set, hand-typed a SECOND time and in {@link kindVocabulary}'s
 * own order — the independent statement of what this engine claims it can
 * compute, which `scope.allTwentyNineModeledKindsDeclaredTogetherAreInScope`
 * declares and `scope.theHandTypedListNamesEveryModeledKind` compares against
 * {@link expectedModeledKindCount}.
 *
 * It lives at module scope rather than inside the leaf that uses it so the
 * comparison leaf can reach it too. Deliberately NOT `modeledKinds` widened:
 * a list derived from the thing it mirrors is not an independent statement,
 * it is an alias, and this list has now fallen silently short TWICE (Phase 20
 * by one, Phase 24 by three) precisely because nothing compared it to
 * anything.
 * @type {readonly Kind[]}
 */
const everyModeledKindHandTyped = [
    'wages',
    'taxExemptInterest',
    'taxableInterest',
    'qualifiedDividends',
    'ordinaryDividends',
    'iraDistributions',
    'pensionsAndAnnuities',
    'socialSecurityBenefits',
    'unemploymentCompensation',
    'businessIncomeOrLoss',
    'capitalGainDistributions',
    'capitalGainsOrLosses',
    'unrecaptured1250Gain',
    'collectibles28RateGain',
    'educatorExpenses',
    'healthSavingsAccountDeduction',
    'studentLoanInterestDeduction',
    'itemizedDeductions',
    'seniorAndOtherScheduleOneADeductions',
    'additionalMedicareTax',
    'netInvestmentIncomeTax',
    'childTaxCreditOrOtherDependents',
    'educationCredits',
    'retirementSavingsContributionsCredit',
    'federalTaxWithheldOnW2',
    'federalTaxWithheldOn1099Int',
    'federalTaxWithheldOnOther1099',
    'estimatedTaxPayments',
    'additionalChildTaxCredit',
    'americanOpportunityCredit',
]

/**
 * Independently hand-typed: the number of entries
 * {@link unmodeledKindRefusals} carries today, counted off the plan's table
 * rather than read from `.length`, for the same reason.
 *
 * This is the counterweight to every proof below that ITERATES the refusal
 * table. A loop over a collection derived from the code under test can never
 * notice that collection shrinking — the project's fourth instance of the
 * signature defect, found this phase in `unknownDialectRefused`'s
 * `Object.keys(dialectSchemas)` loop. `50 - 20 = 30` is asserted here against
 * `kindVocabulary.length`, which `fjs/return/profile` in turn pins against its
 * own hand-typed `50`. `44 -> 38` was Plan 12.1-04's own six-kind
 * reclassification; `38 -> 34` was Plan 13-02's own four-kind
 * reclassification; `34 -> 33` was Plan 13-04's own one-kind reclassification;
 * `33 -> 32` was Plan 13-07's own one-kind reclassification; `32 -> 30` is
 * Plan 13-10's own two-kind reclassification. `30 -> 43` was Phase 23's own
 * Schedule 2 split (TAX-22): `30 - 1 + 14`, one coarse `scheduleTwoTaxes`
 * row replaced by fourteen per-printed-line rows, with NO kind reclassified
 * in the same step. `43 -> 41` is that phase's own two-kind reclassification
 * one commit later (`additionalMedicareTax` and `netInvestmentIncomeTax`),
 * beside the Schedule 2 wiring that makes both computable — wire before
 * reclassify, in the SAME commit, as every earlier slice did.
 *
 * `41 -> 53` is Phase 24's own Schedule 1 Part II split (TAX-23/TAX-24):
 * `41 - 1 + 13`, one coarse `scheduleOneAdjustments` row replaced by thirteen
 * per-printed-line rows, with NO kind reclassified in the same step. `53 ->
 * 50` is that phase's own three-kind reclassification one commit later
 * (`educatorExpenses`, `healthSavingsAccountDeduction`,
 * `studentLoanInterestDeduction`), beside the Schedule 1 wiring that makes
 * all three computable.
 *
 * `50 -> 60` is Phase 25's own Schedule 3 split (TAX-25/TAX-26): `50 - 2 +
 * 12`, TWO coarse rows replaced by twelve per-printed-line rows, with NO kind
 * reclassified in the same step. Two rather than one because Schedule 3 is
 * the only schedule whose Parts I and II each had a coarse kind of their own.
 * `60 -> 57` is that phase's own THREE-kind reclassification one commit later
 * (`educationCredits`, `retirementSavingsContributionsCredit` and
 * `americanOpportunityCredit`), beside the Schedule 3 wiring that makes all
 * three computable. Three rather than two because the third is not on
 * Schedule 3 at all: Form 8863's single execution produces the refundable
 * amount 1040 line 29 carries as well as the nonrefundable one line 3 does.
 *
 * `57 -> 63` is Phase 27's own Schedule 1 PART I split (TAX-30): `57 - 1 + 7`,
 * one coarse `scheduleOneAdditionalIncome` row replaced by seven
 * per-printed-line rows, with NO kind reclassified in the same step. `63 ->
 * 62` is that phase's own ONE-kind reclassification one commit later
 * (`businessIncomeOrLoss`), beside the `fjs/schedule/c` wiring that makes it
 * computable.
 * @type {number}
 */
const expectedUnmodeledKindCount = 62

/**
 * The complete refusal message for a return declaring exactly
 * `unreportedTips` — hand-typed here, character for character, from
 * the fields the refusal table carries rather than produced by running
 * {@link scopeRefusal} and pasting what came out.
 *
 * **Re-pointed from `socialSecurityBenefits` to `unreportedTips` by Plan
 * 13-02.** `socialSecurityBenefits` moved from {@link unmodeledKindRefusals}
 * to {@link modeledKinds} in this plan's own Task 2 (Phase 13 Wave 1,
 * TAX-10), so the example this constant pinned no longer refuses at all —
 * an unused local under `noUnusedLocals: true` (TS6133, a `tsc` failure, not
 * a test failure) the instant its last reference goes away. `unreportedTips`
 * stays refused for the rest of this phase (Decision 1.4; its remedy string
 * is one of the five NOT corrected until Wave 5), so it is the control kind
 * every leaf below is re-pointed at — the identical assertions (whole-
 * message format, structured-`unmodeled` pin, bare-value shape) preserved
 * verbatim, per this plan's own instruction never to delete this coverage.
 *
 * It is the strongest single statement of two properties at once. It pins the
 * message FORMAT, so the line, the label and the remedy cannot silently swap
 * places or be dropped; and it pins T-10-07-04, the information-disclosure
 * disposition — the refusal a user sees is exactly this compiled-in sentence,
 * with no room for a taxpayer amount, name or document hash to ride along.
 * @type {string}
 */
const expectedUnreportedTipsRefusalMessage
    = 'scope refusal: this return declares 1 kind(s) this engine does not model, '
    + 'so no Form 1040 is produced; unreportedTips at 1040 line 1c '
    + '(unreported tips): requires Form 4137 (no phase yet)'

/**
 * The complete refusal message for a tripwire naming exactly `unreportedTips`
 * with a one-clause evidence string — hand-typed here, character for
 * character, from the fields {@link unmodeledKindRefusals} carries plus the
 * evidence the fixture supplies, rather than produced by running
 * {@link tripwireRefusal} and pasting what came out.
 *
 * `unreportedTips` is the control kind this file already pins the
 * declared-scope message against (see
 * {@link expectedUnreportedTipsRefusalMessage}), reused here so the two
 * sentences can be compared directly: SAME kind, SAME line, SAME label, SAME
 * remedy, DIFFERENT preamble and one extra evidence clause. That contrast is
 * the property this constant exists to pin — a tripwire refusal must not read
 * as though the taxpayer had declared something, because a reader would then
 * go looking for a declaration they never made.
 * @type {string}
 */
const expectedUnreportedTipsTripwireMessage
    = 'tripwire refusal: the supplied documents require 1 kind(s) this return did not declare, '
    + 'so no Form 1040 is produced; unreportedTips at 1040 line 1c '
    + '(unreported tips): Form W-2 box 8 (allocated tips) is non-zero '
    + '— requires Form 4137 (no phase yet)'

export const proof = {
    partition: {
        // Both counts against hand-typed constants, and their sum against the
        // vocabulary this module partitions -- so the 20/30 split cannot
        // drift by a kind quietly migrating from one list to the other. This
        // IS the hand-typed count-guard Mutation Gate M4 (Plan 12.1-04 Task
        // 3, re-verified live by Plan 13-02's own four-kind move, Plan
        // 13-04's own one-kind move, Plan 13-07's own one-kind move, and
        // Plan 13-10's own two-kind move) targets: removing one entry from
        // `modeledKinds` without touching `expectedModeledKindCount` must
        // redden this leaf.
        modeledKindsIsExactlyThirty: () => {
            assertEq(modeledKinds.length, expectedModeledKindCount)
            assertEq(new Set(modeledKinds).size, expectedModeledKindCount)
        },
        unmodeledRefusalsIsExactlySixtyTwo: () => {
            assertEq(unmodeledKindRefusals.length, expectedUnmodeledKindCount)
            assertEq(
                new Set(unmodeledKindRefusals.map(r => r.kind)).size,
                expectedUnmodeledKindCount,
            )
        },
        theTwoHandTypedCountsSumToTheWholeVocabulary: () => {
            assertEq(
                expectedModeledKindCount + expectedUnmodeledKindCount,
                kindVocabulary.length,
                [
                    'the modeled and refused counts must together cover every declared kind',
                    expectedModeledKindCount + expectedUnmodeledKindCount,
                    kindVocabulary.length,
                ],
            )
        },
        // The runtime half of `_EveryKindIsEitherModeledOrRefused`, which `tsc`
        // has already checked by the time this runs. It iterates the
        // VOCABULARY -- the domain being partitioned, owned by another module
        // -- not either half of the partition, so a kind vanishing from one
        // half is caught here as well as by the counts above.
        partitionCoversTheVocabularyWithNoOverlap: () => {
            for (const kind of kindVocabulary) {
                const inModeled = modeledKindNames.includes(kind) ? 1 : 0
                const inRefusals = unmodeledKindRefusals.filter(r => r.kind === kind).length
                assertEq(
                    inModeled + inRefusals,
                    1,
                    ['every declared kind must be classified exactly once', kind, inModeled, inRefusals],
                )
            }
        },
        // Every entry names all three fields, and `line` names a real form
        // location rather than prose. Criterion 4 is "never a silently omitted
        // line": a refusal that cannot say WHICH line is omitted is no better
        // than silence.
        everyRefusalNamesALineALabelAndARemedy: () => {
            for (const r of unmodeledKindRefusals) {
                assert(r.line.length > 0, ['refusal entry has an empty line', r.kind])
                assert(r.label.length > 0, ['refusal entry has an empty label', r.kind])
                assert(r.remedy.length > 0, ['refusal entry has an empty remedy', r.kind])
                assert(
                    r.line.startsWith('1040 line')
                    || r.line.startsWith('Schedule D line')
                    // Phase 23's own addition: the fourteen Schedule 2 rows
                    // name their SCHEDULE 2 line first (`Schedule 2 line 11
                    // -> 1040 line 23`), because a coarse `1040 lines 17 and
                    // 23` is what made the kind they replaced unactionable.
                    || r.line.startsWith('Schedule 2 line')
                    // Phase 24's own addition, the same shape one schedule
                    // over: the thirteen Schedule 1 Part II rows name their
                    // SCHEDULE 1 line first (`Schedule 1 line 20 -> 1040
                    // line 10`), for the same reason -- a coarse "1040 line
                    // 10" is what made the kind they replaced unactionable.
                    || r.line.startsWith('Schedule 1 line')
                    // Phase 25's own addition, the same shape one schedule
                    // further on: the twelve Schedule 3 rows name their
                    // SCHEDULE 3 line first (`Schedule 3 line 4 -> 1040 line
                    // 20`), for the same reason -- a coarse "1040 line 20"
                    // is what made the two kinds they replaced unactionable.
                    || r.line.startsWith('Schedule 3 line')
                    || r.line.startsWith('Form '),
                    ['refusal entry does not name a form location', r.kind, r.line],
                )
            }
        },
        // The table is in 1040 form order, which `scopeRefusal` (Task 2) relies
        // on to order what it names: it walks this table rather than sorting,
        // so "ordered by kindVocabulary position" is true only while this
        // holds. Positions are read from the vocabulary, not from the table.
        refusalTableFollowsKindVocabularyOrder: () => {
            unmodeledKindRefusals
                .map(r => kindVocabulary.indexOf(r.kind))
                .reduce((previous, position) => {
                    assert(
                        position > previous,
                        ['refusal table is out of 1040 form order', position, previous],
                    )
                    return position
                }, -1)
        },
        // TAX-30, Phase 27: the seven Schedule 1 PART I kinds, in SCHEDULE 1's
        // own printed order, each naming its own printed line. The identical
        // shape as the three leaves below, on the last block this project had
        // not taken apart.
        //
        // Two things this one has to say that none of those did. **Printed
        // line 7 is deliberately absent**, and it is the only line in any of
        // the four splits whose kind predates its own block:
        // `unemploymentCompensation` has been modeled since Phase 20 and sits
        // far earlier in the vocabulary, so an ordering check that expected it
        // here would fail for a reason that is history rather than error —
        // which is why this list names six positions plus the modeled one it
        // does not constrain. And lines 9 and 10 are absent because both are
        // totals; a kind for a total would let a taxpayer declare a sum
        // without declaring anything it is a sum of, the same reasoning
        // Schedule 3's lines 7/8/14/15 already carry.
        theSevenScheduleOnePartOneKindsNameTheirOwnPrintedLine: () => {
            /** @type {readonly (readonly [string, string])[]} */
            const expected = [
                ['taxableStateLocalRefunds', 'Schedule 1 line 1'],
                ['alimonyReceived', 'Schedule 1 line 2a'],
                ['businessIncomeOrLoss', 'Schedule 1 line 3'],
                ['otherGainsOrLosses', 'Schedule 1 line 4'],
                ['rentalRealEstateRoyaltiesPartnershipsSCorps', 'Schedule 1 line 5'],
                ['farmIncomeOrLoss', 'Schedule 1 line 6'],
                ['otherIncome', 'Schedule 1 line 8a-8z'],
            ]
            assertEq(expected.length, 7, 'the split produced seven kinds, hand-counted off the printed form')
            expected
                .map(([kind]) => kindVocabulary.findIndex(candidate => candidate === kind))
                .reduce((previous, position) => {
                    assert(
                        position > previous,
                        ['a Schedule 1 Part I kind is missing from the vocabulary, or is out of Schedule 1 order', position, previous],
                    )
                    return position
                }, -1)
            // Printed line 7's kind is elsewhere in the vocabulary and MODELED,
            // which is a fact about this block worth checking rather than only
            // describing: if `unemploymentCompensation` ever fell back into the
            // refusal table, Part I would have two undeclarable lines and this
            // leaf's own explanation would be wrong.
            assert(
                modeledKindNames.includes('unemploymentCompensation'),
                'Schedule 1 line 7 has no row in this block because its kind is modeled',
            )
            for (const [kind, line] of expected) {
                const row = unmodeledKindRefusals.find(r => r.kind === kind)
                if (row === undefined) {
                    assert(
                        modeledKindNames.includes(kind),
                        ['a Schedule 1 Part I kind is neither refused nor modeled', kind],
                    )
                    continue
                }
                // The trailing space is what stops `Schedule 1 line 1` from
                // matching `Schedule 1 line 12`, and `line 8` from matching
                // `line 8a-8z`.
                assert(
                    row.line === line || row.line.startsWith(`${line} `),
                    ['a Schedule 1 Part I refusal row names the wrong printed line', kind, line, row.line],
                )
                // EVERY Part I row reaches the same 1040 line, because every
                // one of them is a summand of line 10 — and line 8, not line
                // 10, is where Part I lands. A row that named 1040 line 10
                // would have confused Part I's destination with Part II's,
                // which is the single most likely error in a block written
                // beside the one below.
                assert(
                    row.line.includes('1040 line 8'),
                    ['every Schedule 1 Part I row must also name the 1040 line it reaches', kind, row.line],
                )
                assert(
                    !row.line.includes('1040 line 10'),
                    ['a Schedule 1 Part I row names Part II\'s destination', kind, row.line],
                )
            }
        },
        // TAX-22's split, stated INDEPENDENTLY of the table it split. The
        // fourteen kind names and the fourteen Schedule 2 line numbers are
        // hand-typed here off the printed form, in the form's own order, and
        // compared against the table — so a kind that lost its row, gained
        // the wrong line, or drifted out of Schedule 2 order names itself.
        // This is the counterweight `unmodeledRefusalsIsExactlyFiftySeven`'s
        // bare count cannot be: thirteen rows could be added with one wrong
        // line number and the count would still be 43.
        //
        // Schedule 2 lines 3, 5, 6, 7, 10, 18 and 21 are deliberately absent
        // from this list. 3, 7, 18 and 21 are TOTALS of other lines, 10 is
        // "Reserved for future use" on the printed face, and 5 and 6 are
        // already named by `unreportedTips` (Form 4137) and `form8919Wages`
        // (Form 8919) — see `fjs/return/profile`'s own vocabulary comment.
        theFourteenScheduleTwoKindsNameTheirOwnPrintedLine: () => {
            /** @type {readonly (readonly [string, string])[]} */
            const expected = [
                ['advancePremiumTaxCreditAndOtherRepayments', 'Schedule 2 line 1a-1z'],
                ['alternativeMinimumTax', 'Schedule 2 line 2'],
                ['selfEmploymentTax', 'Schedule 2 line 4'],
                ['additionalTaxOnTaxFavoredAccounts', 'Schedule 2 line 8'],
                ['householdEmploymentTaxes', 'Schedule 2 line 9'],
                ['additionalMedicareTax', 'Schedule 2 line 11'],
                ['netInvestmentIncomeTax', 'Schedule 2 line 12'],
                ['uncollectedTaxOnTipsOrGroupTermLife', 'Schedule 2 line 13'],
                ['interestOnResidentialLotAndTimeshareInstallments', 'Schedule 2 line 14'],
                ['interestOnDeferredInstallmentSaleTax', 'Schedule 2 line 15'],
                ['lowIncomeHousingCreditRecapture', 'Schedule 2 line 16'],
                ['otherAdditionalTaxes', 'Schedule 2 line 17a-17z'],
                ['premiumTaxCreditReconciliation', 'Schedule 2 line 19'],
                ['section965NetTaxLiabilityInstallment', 'Schedule 2 line 20'],
            ]
            assertEq(expected.length, 14, 'the split produced fourteen kinds, hand-counted off the printed form')
            // Every one is a kind the vocabulary carries, and every one is in
            // the vocabulary in the order listed above -- read from
            // `kindVocabulary`, which this module does not own.
            expected
                .map(([kind]) => kindVocabulary.findIndex(candidate => candidate === kind))
                .reduce((previous, position) => {
                    assert(
                        position > previous,
                        ['a Schedule 2 kind is missing from the vocabulary, or is out of Schedule 2 order', position, previous],
                    )
                    return position
                }, -1)
            // …and every one carries a refusal row OR is modeled, with the
            // printed line it names. A kind reclassified to `modeledKinds`
            // leaves this table, which is why the modeled case is a pass
            // rather than a failure -- what this leaf pins is that a kind
            // cannot be BOTH absent from the table and absent from the
            // modeled set, which `_EveryKindIsEitherModeledOrRefused` owns,
            // and that a row which IS present names the right line.
            for (const [kind, line] of expected) {
                const row = unmodeledKindRefusals.find(r => r.kind === kind)
                if (row === undefined) {
                    assert(
                        modeledKindNames.includes(kind),
                        ['a Schedule 2 kind is neither refused nor modeled', kind],
                    )
                    continue
                }
                // The trailing space (or end of string) is what stops
                // `Schedule 2 line 1` from matching `Schedule 2 line 1a-1z`,
                // and `line 1` from matching `line 12`. The section 965 row
                // is the one whose `line` ENDS at the Schedule 2 line number,
                // because that line is a memo entry the printed form does not
                // add into line 21 and so it reaches no 1040 line at all.
                assert(
                    row.line === line || row.line.startsWith(`${line} `),
                    ['a Schedule 2 refusal row names the wrong printed line', kind, line, row.line],
                )
                assert(
                    row.line.includes('1040 line 17') || row.line.includes('1040 line 23')
                    || kind === 'section965NetTaxLiabilityInstallment',
                    [
                        'every Schedule 2 row but the section 965 memo line must also name the 1040 line it reaches',
                        kind,
                        row.line,
                    ],
                )
            }
        },
        // TAX-23/TAX-24, Phase 24: the thirteen Schedule 1 Part II kinds, in
        // SCHEDULE 1's own printed order, each naming its own printed line.
        // The identical shape as the Schedule 2 leaf above, one schedule
        // over, and identical in what it is for: a table with thirteen rows
        // where a coarse kind used to sit is only an improvement if each row
        // names something a taxpayer can act on.
        //
        // Printed lines 21 through 26 are NOT all here. Line 22 is "Reserved
        // for future use" with no box to fill, line 25 is the TOTAL of the
        // 24a-24z block `otherAdjustments` already covers, and line 26 is the
        // Part II total itself -- a kind for any of the three would be a
        // declaration a taxpayer could never truthfully make.
        theThirteenScheduleOneKindsNameTheirOwnPrintedLine: () => {
            /** @type {readonly (readonly [string, string])[]} */
            const expected = [
                ['educatorExpenses', 'Schedule 1 line 11'],
                ['reservistPerformingArtistFeeBasisExpenses', 'Schedule 1 line 12'],
                ['healthSavingsAccountDeduction', 'Schedule 1 line 13'],
                ['movingExpensesArmedForces', 'Schedule 1 line 14'],
                ['deductiblePartOfSelfEmploymentTax', 'Schedule 1 line 15'],
                ['selfEmployedRetirementPlans', 'Schedule 1 line 16'],
                ['selfEmployedHealthInsuranceDeduction', 'Schedule 1 line 17'],
                ['penaltyOnEarlyWithdrawalOfSavings', 'Schedule 1 line 18'],
                ['alimonyPaid', 'Schedule 1 line 19a'],
                ['iraDeduction', 'Schedule 1 line 20'],
                ['studentLoanInterestDeduction', 'Schedule 1 line 21'],
                ['archerMsaDeduction', 'Schedule 1 line 23'],
                ['otherAdjustments', 'Schedule 1 line 24a-24z'],
            ]
            assertEq(expected.length, 13, 'the split produced thirteen kinds, hand-counted off the printed form')
            expected
                .map(([kind]) => kindVocabulary.findIndex(candidate => candidate === kind))
                .reduce((previous, position) => {
                    assert(
                        position > previous,
                        ['a Schedule 1 kind is missing from the vocabulary, or is out of Schedule 1 order', position, previous],
                    )
                    return position
                }, -1)
            for (const [kind, line] of expected) {
                const row = unmodeledKindRefusals.find(r => r.kind === kind)
                if (row === undefined) {
                    assert(
                        modeledKindNames.includes(kind),
                        ['a Schedule 1 kind is neither refused nor modeled', kind],
                    )
                    continue
                }
                // The trailing space is what stops `Schedule 1 line 1` from
                // matching `Schedule 1 line 12`, and `line 2` from matching
                // `line 24a-24z`.
                assert(
                    row.line === line || row.line.startsWith(`${line} `),
                    ['a Schedule 1 refusal row names the wrong printed line', kind, line, row.line],
                )
                // EVERY Part II row reaches the same 1040 line, because every
                // one of them is a summand of line 26. There is no memo-line
                // exception here, unlike Schedule 2's section 965 row.
                assert(
                    row.line.includes('1040 line 10'),
                    ['every Schedule 1 Part II row must also name the 1040 line it reaches', kind, row.line],
                )
            }
        },
        // TAX-25/TAX-26, Phase 25: the twelve Schedule 3 kinds, in SCHEDULE
        // 3's own printed order, each naming its own printed line. The
        // identical shape as the two leaves above, one schedule further on.
        //
        // Two things this one has to say that neither of those did. First,
        // the twelve span BOTH PARTS of one schedule and therefore reach TWO
        // different 1040 lines — Part I's seven reach line 20 and Part II's
        // five reach line 31 — so the destination is checked per row against
        // a hand-typed expectation rather than against one shared string.
        // Second, lines 7, 8, 14 and 15 are deliberately absent: all four are
        // TOTALS (7 of the 6a-6z block, 8 of Part I, 14 of the 13a-13z block,
        // 15 of Part II), and a kind for a total would let a taxpayer declare
        // a sum without declaring anything it is a sum of.
        theTwelveScheduleThreeKindsNameTheirOwnPrintedLine: () => {
            /** @type {readonly (readonly [string, string, string])[]} */
            const expected = [
                ['foreignTaxCredit', 'Schedule 3 line 1', '1040 line 20'],
                ['dependentCareCredit', 'Schedule 3 line 2', '1040 line 20'],
                ['educationCredits', 'Schedule 3 line 3', '1040 line 20'],
                ['retirementSavingsContributionsCredit', 'Schedule 3 line 4', '1040 line 20'],
                ['residentialCleanEnergyCredit', 'Schedule 3 line 5a', '1040 line 20'],
                ['energyEfficientHomeImprovementCredit', 'Schedule 3 line 5b', '1040 line 20'],
                ['otherNonrefundableCredits', 'Schedule 3 line 6a-6z', '1040 line 20'],
                ['netPremiumTaxCredit', 'Schedule 3 line 9', '1040 line 31'],
                ['amountPaidWithExtensionRequest', 'Schedule 3 line 10', '1040 line 31'],
                ['excessSocialSecurityWithheld', 'Schedule 3 line 11', '1040 line 31'],
                ['federalFuelTaxCredit', 'Schedule 3 line 12', '1040 line 31'],
                ['otherPaymentsAndRefundableCredits', 'Schedule 3 line 13a-13z', '1040 line 31'],
            ]
            assertEq(expected.length, 12, 'the split produced twelve kinds, hand-counted off the printed form')
            assertEq(
                expected.filter(([, , destination]) => destination === '1040 line 20').length,
                7,
                'Part I has seven, hand-counted: lines 1, 2, 3, 4, 5a, 5b and the collapsed 6a-6z',
            )
            assertEq(
                expected.filter(([, , destination]) => destination === '1040 line 31').length,
                5,
                'Part II has five, hand-counted: lines 9, 10, 11, 12 and the collapsed 13a-13z',
            )
            expected
                .map(([kind]) => kindVocabulary.findIndex(candidate => candidate === kind))
                .reduce((previous, position) => {
                    assert(
                        position > previous,
                        ['a Schedule 3 kind is missing from the vocabulary, or is out of Schedule 3 order', position, previous],
                    )
                    return position
                }, -1)
            for (const [kind, line, destination] of expected) {
                const row = unmodeledKindRefusals.find(r => r.kind === kind)
                if (row === undefined) {
                    assert(
                        modeledKindNames.includes(kind),
                        ['a Schedule 3 kind is neither refused nor modeled', kind],
                    )
                    continue
                }
                // The trailing space is what stops `Schedule 3 line 1` from
                // matching `Schedule 3 line 12`, and `line 5` from matching
                // `line 5a`.
                assert(
                    row.line === line || row.line.startsWith(`${line} `),
                    ['a Schedule 3 refusal row names the wrong printed line', kind, line, row.line],
                )
                // Part I reaches 1040 line 20 and Part II reaches line 31.
                // A row that named the OTHER part's destination would be the
                // most consequential single-token error possible here — a
                // nonrefundable credit described as a refundable one — and
                // this is the assertion that catches it.
                assert(
                    row.line.includes(destination),
                    ['a Schedule 3 row names the wrong 1040 destination', kind, destination, row.line],
                )
            }
        },
    },
    scope: {
        // Declaring nothing is IN SCOPE. This is the leaf that keeps the guard
        // from degenerating into "refuse anything unusual": a return with no
        // declared kinds computes a 1040 of zeros, it does not refuse.
        emptyDeclarationIsInScope: () => {
            const outcome = classifyScope([])
            assertEq(outcome.kind, 'ok', ['declaring nothing must be in scope', outcome])
        },
        // All twenty-three modeled kinds, hand-typed rather than read from
        // `modeledKinds`, so this leaf states independently what the engine
        // claims to be able to compute.
        //
        // **This leaf silently fell one short between 2026-08-14 and
        // 2026-08-15.** Phase 20 added `unemploymentCompensation` to
        // `modeledKinds` and did not add it here, so the leaf that exists
        // precisely to state the modeled set INDEPENDENTLY went on asserting a
        // twenty-kind set against a twenty-one-kind engine — and stayed green,
        // because declaring a subset is in scope. An independent statement that
        // is never compared to the thing it mirrors is not independent, it is
        // just a second place to be wrong. `modeledKindCountIsExact` below is
        // what makes the omission visible.
        //
        // **It fell short a SECOND time, by three, between 2026-08-16 and this
        // phase.** Phase 24 reclassified `educatorExpenses`,
        // `healthSavingsAccountDeduction` and `studentLoanInterestDeduction`
        // and did not add them here, so this leaf spent a phase asserting a
        // twenty-three-kind set against a twenty-six-kind engine — green
        // throughout, for the identical reason recorded above. The paragraph
        // above named the mechanism and did not stop it, because nothing
        // COMPARED the list to anything.
        //
        // `theHandTypedListNamesEveryModeledKind` below is that comparison,
        // and it is the difference between a warning and a guard. It checks
        // this list's LENGTH against `expectedModeledKindCount` — the OTHER
        // hand-typed constant, not `modeledKinds.length` — so the two
        // independent statements of the modeled set have to agree with each
        // other, and a kind added to one of them alone reddens.
        allThirtyModeledKindsDeclaredTogetherAreInScope: () => {
            const outcome = classifyScope(everyModeledKindHandTyped)
            assertEq(outcome.kind, 'ok', ['the thirty modeled kinds must be in scope', outcome])
        },
        theHandTypedListNamesEveryModeledKind: () => {
            assertEq(
                everyModeledKindHandTyped.length,
                expectedModeledKindCount,
                [
                    'the hand-typed in-scope list has fallen short of the hand-typed modeled count',
                    everyModeledKindHandTyped.length,
                    expectedModeledKindCount,
                ],
            )
            assertEq(
                new Set(everyModeledKindHandTyped).size,
                expectedModeledKindCount,
                'and it names each kind once',
            )
        },
        // TAX-30, Phase 27: the ONE kind this phase reclassified, alone —
        // every reclassification since Phase 12.1 has added exactly this leaf,
        // and `unemploymentCompensationIsInScopeAlone`'s own comment records
        // what it cost the one phase that skipped it. With a single kind the
        // declared-together and declared-alone leaves would be the same
        // assertion, so there is one leaf here rather than two.
        businessIncomeOrLossIsInScopeAlone: () => {
            const outcome = classifyScope(['businessIncomeOrLoss'])
            assertEq(outcome.kind, 'ok', ['Schedule C\'s kind alone must be in scope', outcome])
        },
        // …and the boundary this phase deliberately did NOT cross, stated as
        // a checked claim rather than as prose in a docstring. A taxpayer
        // whose Schedule C now computes still cannot file a return that
        // declares self-employment TAX or the qualified business income
        // deduction: both are Phase 28's, and both must still refuse. The day
        // either stops refusing without Phase 28 having landed, this reddens.
        theTwoPhase28KindsBesideScheduleCStillRefuse: () => {
            const selfEmployment = classifyScope(['businessIncomeOrLoss', 'selfEmploymentTax'])
            assert(
                selfEmployment.kind === 'error',
                ['self-employment tax must still refuse beside a computable Schedule C', selfEmployment])
            assert(
                selfEmployment.message.includes('Schedule SE'),
                ['it must still name Schedule SE', selfEmployment.message])
            const qbi = classifyScope(['businessIncomeOrLoss', 'qualifiedBusinessIncomeDeduction'])
            assert(
                qbi.kind === 'error',
                ['the QBI deduction must still refuse beside a computable Schedule C', qbi])
            assert(
                qbi.message.includes('8995'),
                ['it must still name Form 8995', qbi.message])
            const deductibleHalf = classifyScope([
                'businessIncomeOrLoss', 'deductiblePartOfSelfEmploymentTax',
            ])
            assert(
                deductibleHalf.kind === 'error',
                ['Schedule 1 line 15 must still refuse', deductibleHalf])
        },
        // TAX-25/TAX-26, Phase 25: the three kinds this phase reclassified,
        // declared TOGETHER and WITHOUT any of the other twenty-six — the
        // atomic transition's own acceptance criterion, isolated from the
        // declared-together leaf above so a failure names this phase rather
        // than the whole engine. Every earlier reclassification added the
        // same pair of leaves; this one follows.
        theThreeKindsThisPhaseWiredAreInScopeTogether: () => {
            const outcome = classifyScope([
                'educationCredits',
                'retirementSavingsContributionsCredit',
                'americanOpportunityCredit',
            ])
            assertEq(outcome.kind, 'ok', ['this phase\'s three kinds must be in scope', outcome])
        },
        eachOfThisPhasesThreeKindsIsInScopeAlone: () => {
            /** @type {readonly Kind[]} */
            const wired = [
                'educationCredits',
                'retirementSavingsContributionsCredit',
                'americanOpportunityCredit',
            ]
            assertEq(wired.length, 3, 'hand-counted: two Schedule 3 lines and one 1040 line')
            for (const kind of wired) {
                assertEq(classifyScope([kind]).kind, 'ok', ['must be in scope alone', kind])
            }
        },
        // NOTE: no count leaf is added here. A `modeledKinds.length === 21`
        // assertion was written at this spot on 2026-08-15 and then DELETED
        // once a mutation showed it reddening alongside
        // `partition.modeledKindsIsExactlyTwentyOne`, which has asserted
        // exactly that against a hand-typed constant since Phase 10. Two
        // proofs failing for one cause is not twice the confidence; it is one
        // proof and one thing to keep in sync. What the count leaf does NOT
        // catch — and what actually went wrong in Phase 20 — is the
        // hand-typed list above falling short while the count stays right,
        // because the two are maintained in different places.
        //
        // `unemploymentCompensation` ALONE. Phases 12.1, 13 (twice) and 20's
        // own reclassifications each added a single-kind leaf beside the
        // declared-together one; Phase 20 broke that four-phase convention and
        // added none, which left NO proof that the exact condition starting the
        // phase — a real transcript refused because unemployment was unmodeled —
        // is now in scope on its own. The declared-together leaf cannot cover
        // this: it passes even with the kind absent.
        unemploymentCompensationIsInScopeAlone: () => {
            const outcome = classifyScope(['unemploymentCompensation'])
            assertEq(outcome.kind, 'ok', ['unemployment compensation alone must be in scope', outcome])
        },
        // Plan 13-02's own four newly-reclassified kinds, declared TOGETHER
        // and WITHOUT any of the other twelve — the atomic transition's own
        // acceptance criterion, isolated from the leaf above so a failure
        // here localizes to exactly these four.
        theFourKindsThisPlanReclassifiedAreInScopeTogether: () => {
            const outcome = classifyScope([
                'iraDistributions',
                'pensionsAndAnnuities',
                'socialSecurityBenefits',
                'federalTaxWithheldOnOther1099',
            ])
            assertEq(outcome.kind, 'ok', ['the four newly-modeled kinds must be in scope', outcome])
        },
        // Plan 13-04's own one-kind reclassification (Phase 13 Wave 2,
        // TAX-09), isolated from the leaf above the same way: a failure here
        // localizes to exactly this one kind.
        seniorAndOtherScheduleOneADeductionsIsInScopeAlone: () => {
            const outcome = classifyScope(['seniorAndOtherScheduleOneADeductions'])
            assertEq(outcome.kind, 'ok', ['the newly-modeled senior-deduction kind must be in scope', outcome])
        },
        // Plan 13-07's own one-kind reclassification (Phase 13 Wave 3,
        // TAX-13), isolated the same way: a failure here localizes to
        // exactly this one kind.
        itemizedDeductionsIsInScopeAlone: () => {
            const outcome = classifyScope(['itemizedDeductions'])
            assertEq(outcome.kind, 'ok', ['the newly-modeled itemized-deductions kind must be in scope', outcome])
        },
        // Plan 13-10's own two-kind reclassification (Phase 13 Wave 4,
        // TAX-12), declared TOGETHER and WITHOUT any of the other
        // eighteen -- the atomic transition's own acceptance criterion,
        // isolated from the leaf above so a failure here localizes to
        // exactly these two.
        theTwoKindsThisPlanReclassifiedAreInScopeTogether: () => {
            const outcome = classifyScope([
                'childTaxCreditOrOtherDependents',
                'additionalChildTaxCredit',
            ])
            assertEq(outcome.kind, 'ok', ['the two newly-modeled Schedule 8812 kinds must be in scope', outcome])
        },
        // Phase 23's own two-kind reclassification (TAX-20/TAX-21), declared
        // TOGETHER and WITHOUT any of the other twenty-one -- the atomic
        // transition's own acceptance criterion, isolated so a failure here
        // localizes to exactly these two.
        theTwoKindsThisPhaseReclassifiedAreInScopeTogether: () => {
            const outcome = classifyScope(['additionalMedicareTax', 'netInvestmentIncomeTax'])
            assertEq(outcome.kind, 'ok', ['the two newly-modeled Schedule 2 kinds must be in scope', outcome])
        },
        // …and each ALONE, which the declared-together leaf above cannot
        // cover: it passes even with one of the two absent. Phase 20 broke
        // the four-phase convention of adding a single-kind leaf and left NO
        // proof that the exact condition starting that phase was now in
        // scope; the comment above `unemploymentCompensationIsInScopeAlone`
        // records the cost. Two leaves, not one, so a failure names which
        // kind.
        additionalMedicareTaxIsInScopeAlone: () => {
            const outcome = classifyScope(['additionalMedicareTax'])
            assertEq(outcome.kind, 'ok', ['Form 8959\'s kind alone must be in scope', outcome])
        },
        netInvestmentIncomeTaxIsInScopeAlone: () => {
            const outcome = classifyScope(['netInvestmentIncomeTax'])
            assertEq(outcome.kind, 'ok', ['Form 8960\'s kind alone must be in scope', outcome])
        },
        // TAX-30, Phase 27: the SIX Schedule 1 Part I kinds this phase did NOT
        // wire must still refuse on their own, or the split quietly widened
        // the engine's claims rather than named them. The SAME property the
        // three leaves below state for Schedules 1 Part II, 2 and 3.
        //
        // This leaf read `theSevenScheduleOnePartOneKindsAllStillRefuse` in
        // the split commit, which reclassified nothing — wire before
        // reclassify — and became this six-kind list in the commit that wired
        // `fjs/schedule/c`. Both halves of that two-step are recorded here
        // rather than only in a commit message, because the ordering is the
        // discipline and a reader of this file is who needs it.
        //
        // Hand-typed, in Schedule 1 order, and deliberately NOT derived by
        // subtracting the wired kind from the seven: a list computed from the
        // tables under test could never notice a seventh kind silently
        // becoming modeled.
        theSixScheduleOnePartOneKindsThisPhaseDidNotWireStillRefuse: () => {
            /** @type {readonly Kind[]} */
            const stillRefused = [
                'taxableStateLocalRefunds',
                'alimonyReceived',
                'otherGainsOrLosses',
                'rentalRealEstateRoyaltiesPartnershipsSCorps',
                'farmIncomeOrLoss',
                'otherIncome',
            ]
            assertEq(stillRefused.length, 6, 'seven printed Part I lines minus the one this phase wired')
            for (const kind of stillRefused) {
                const outcome = classifyScope([kind])
                assert(
                    outcome.kind === 'error',
                    ['this Schedule 1 Part I kind must still refuse after the split', kind, outcome],
                )
            }
            // Two of the six, each with the form it still needs — so a refusal
            // that stopped naming Schedule F or Schedule E reddens here rather
            // than only in the table loop.
            const farm = classifyScope(['farmIncomeOrLoss'])
            assert(farm.kind === 'error', ['farm income must still refuse', farm])
            assert(
                farm.message.includes('Schedule F'),
                ['the farm refusal must name Schedule F', farm.message],
            )
            const rental = classifyScope(['rentalRealEstateRoyaltiesPartnershipsSCorps'])
            assert(rental.kind === 'error', ['rental and pass-through income must still refuse', rental])
            assert(
                rental.message.includes('Schedule E'),
                ['the rental refusal must name Schedule E', rental.message],
            )
        },
        // THE CONTROL FOR THE RECLASSIFICATION ABOVE, and the criterion the
        // phase brief states in its own words: "AMT and self-employment tax
        // still refuse by name after the split." Twelve of Schedule 2's
        // fourteen kinds were NOT wired by this phase, and every one of them
        // must still refuse ON ITS OWN -- otherwise the split would have
        // quietly widened the engine's claims rather than named them.
        //
        // Hand-typed, in Schedule 2 order, and deliberately NOT derived by
        // subtracting the two wired kinds from the fourteen: a list computed
        // from the tables under test could never notice a thirteenth kind
        // silently becoming modeled.
        theTwelveScheduleTwoKindsThisPhaseDidNotWireStillRefuse: () => {
            /** @type {readonly Kind[]} */
            const stillRefused = [
                'advancePremiumTaxCreditAndOtherRepayments',
                'alternativeMinimumTax',
                'selfEmploymentTax',
                'additionalTaxOnTaxFavoredAccounts',
                'householdEmploymentTaxes',
                'uncollectedTaxOnTipsOrGroupTermLife',
                'interestOnResidentialLotAndTimeshareInstallments',
                'interestOnDeferredInstallmentSaleTax',
                'lowIncomeHousingCreditRecapture',
                'otherAdditionalTaxes',
                'premiumTaxCreditReconciliation',
                'section965NetTaxLiabilityInstallment',
            ]
            assertEq(stillRefused.length, 12, 'fourteen Schedule 2 kinds minus the two this phase wired')
            for (const kind of stillRefused) {
                const outcome = classifyScope([kind])
                assert(
                    outcome.kind === 'error',
                    ['this Schedule 2 kind must still refuse after the split', kind, outcome],
                )
            }
            // The two the phase's brief names specifically, with the form
            // each still needs -- so a refusal that stopped naming Form 6251
            // or Schedule SE reddens here rather than only in the table loop.
            const amt = classifyScope(['alternativeMinimumTax'])
            assert(amt.kind === 'error', ['the alternative minimum tax must still refuse', amt])
            assert(amt.message.includes('Form 6251'), ['the AMT refusal must still name Form 6251', amt.message])
            assert(
                amt.message.includes('Schedule 2 line 2'),
                ['the AMT refusal must name its own Schedule 2 line', amt.message],
            )
            const selfEmployment = classifyScope(['selfEmploymentTax'])
            assert(selfEmployment.kind === 'error', ['self-employment tax must still refuse', selfEmployment])
            assert(
                selfEmployment.message.includes('Schedule SE'),
                ['the self-employment refusal must still name Schedule SE', selfEmployment.message],
            )
            assert(
                selfEmployment.message.includes('Schedule 2 line 4'),
                ['the self-employment refusal must name its own Schedule 2 line', selfEmployment.message],
            )
        },
        // TAX-23/TAX-24, Phase 24: the SAME property one schedule over. The
        // ten Schedule 1 Part II kinds this phase did NOT wire must still
        // refuse on their own, or the split quietly widened the engine's
        // claims rather than named them.
        //
        // Hand-typed, in Schedule 1 order, and deliberately NOT derived by
        // subtracting the three wired kinds from the thirteen: a list
        // computed from the tables under test could never notice an eleventh
        // kind silently becoming modeled.
        theTenScheduleOneKindsThisPhaseDidNotWireStillRefuse: () => {
            /** @type {readonly Kind[]} */
            const stillRefused = [
                'reservistPerformingArtistFeeBasisExpenses',
                'movingExpensesArmedForces',
                'deductiblePartOfSelfEmploymentTax',
                'selfEmployedRetirementPlans',
                'selfEmployedHealthInsuranceDeduction',
                'penaltyOnEarlyWithdrawalOfSavings',
                'alimonyPaid',
                'iraDeduction',
                'archerMsaDeduction',
                'otherAdjustments',
            ]
            assertEq(stillRefused.length, 10, 'thirteen Schedule 1 Part II kinds minus the three this phase wired')
            for (const kind of stillRefused) {
                const outcome = classifyScope([kind])
                assert(
                    outcome.kind === 'error',
                    ['this Schedule 1 Part II kind must still refuse after the split', kind, outcome],
                )
            }
            // The two the phase's brief names specifically, each with the
            // reason it still cannot be computed -- so a refusal that stopped
            // naming the fixed point, or Schedule SE, reddens here rather
            // than only in the table loop.
            const ira = classifyScope(['iraDeduction'])
            assert(ira.kind === 'error', ['the IRA deduction must still refuse', ira])
            assert(
                ira.message.includes('590-A'),
                ['the IRA refusal must still name the worksheet it needs', ira.message],
            )
            assert(
                ira.message.includes('Schedule 1 line 20'),
                ['the IRA refusal must name its own Schedule 1 line', ira.message],
            )
            const selfEmploymentHalf = classifyScope(['deductiblePartOfSelfEmploymentTax'])
            assert(
                selfEmploymentHalf.kind === 'error',
                ['the deductible half of self-employment tax must still refuse', selfEmploymentHalf],
            )
            assert(
                selfEmploymentHalf.message.includes('Schedule SE'),
                ['it must still name Schedule SE', selfEmploymentHalf.message],
            )
            assert(
                selfEmploymentHalf.message.includes('Schedule 1 line 15'),
                ['it must name its own Schedule 1 line', selfEmploymentHalf.message],
            )
        },
        // **TAX-27, Phase 25: the requirement whose whole delivery is this
        // refusal.** The Earned Income Credit is NOT computed by this phase
        // and `earnedIncomeCredit` stays refused, which is a decision rather
        // than an omission — see `fjs/todo/tax-27-earned-income-credit.md`
        // for the fact-by-fact analysis.
        //
        // What Phase 25 changed is the REMEDY. It used to read "requires
        // Schedule EIC (no phase yet)", which tells a taxpayer to go and find
        // a form and tells the next engineer nothing at all. It now names the
        // specific facts `vnd.fjs.return_profile` does not carry, and this
        // leaf asserts the part of the message that carries the information
        // rather than the part that is easy to assert — AGENTS.md's own
        // recorded lesson from the Phase 20 mutant that erased a destination
        // and survived five refusal proofs.
        theEarnedIncomeCreditRefusalNamesTheFactsThatAreMissing: () => {
            const outcome = classifyScope(['earnedIncomeCredit'])
            assert(outcome.kind === 'error', ['the earned income credit must still refuse', outcome])
            if (outcome.kind !== 'error') {
                throw ['unreachable', outcome]
            }
            assert(
                outcome.message.includes('1040 line 27a'),
                ['must name the line that cannot be computed', outcome.message],
            )
            // The four qualifying-child facts, each named. A remedy that
            // dropped one would leave a reader believing a widening was
            // smaller than it is.
            for (const fact of [
                'relationship vocabulary',
                'full-time-student status',
                'permanent and total disability',
                'more than half the year',
            ]) {
                assert(
                    outcome.message.includes(fact),
                    ['the refusal must name this missing qualifying-child fact', fact, outcome.message],
                )
            }
            // …and the three about the filer.
            for (const fact of [
                'between 25 and 65',
                'social security number',
                'another taxpayer’s qualifying child',
            ]) {
                assert(
                    outcome.message.includes(fact),
                    ['the refusal must name this missing filer fact', fact, outcome.message],
                )
            }
            // The provisions, so a reader can go to the statute rather than
            // to a form that would not help them.
            assert(
                outcome.message.includes('§32(c)(3)') && outcome.message.includes('§32(c)(1)'),
                ['the refusal must name both provisions', outcome.message],
            )
            // And the file that carries the whole analysis, which is the one
            // part of this message the NEXT ENGINEER can act on.
            assert(
                outcome.message.includes('fjs/todo/tax-27-earned-income-credit.md'),
                ['the refusal must point at the recorded analysis', outcome.message],
            )
        },
        // TAX-25/TAX-26, Phase 25: the SAME property one schedule further on.
        // The nine Schedule 3 kinds this phase did NOT wire must still refuse
        // on their own, or the split quietly widened the engine's claims
        // rather than named them.
        //
        // Hand-typed, in Schedule 3 order, and deliberately NOT derived by
        // subtracting the two wired kinds from the twelve — a list computed
        // from the tables under test could never notice a tenth kind silently
        // becoming modeled.
        theNineScheduleThreeKindsThisPhaseDidNotWireStillRefuse: () => {
            /** @type {readonly Kind[]} */
            const stillRefused = [
                'foreignTaxCredit',
                'dependentCareCredit',
                'residentialCleanEnergyCredit',
                'energyEfficientHomeImprovementCredit',
                'otherNonrefundableCredits',
                'netPremiumTaxCredit',
                'amountPaidWithExtensionRequest',
                'excessSocialSecurityWithheld',
                'federalFuelTaxCredit',
                'otherPaymentsAndRefundableCredits',
            ]
            assertEq(stillRefused.length, 10, 'twelve Schedule 3 kinds minus the two this phase wired')
            for (const kind of stillRefused) {
                const outcome = classifyScope([kind])
                assert(
                    outcome.kind === 'error',
                    ['this Schedule 3 kind must still refuse after the split', kind, outcome],
                )
            }
            // The two the phase's own record names, each with the reason it
            // still cannot be computed.
            const foreign = classifyScope(['foreignTaxCredit'])
            assert(foreign.kind === 'error', ['the foreign tax credit must still refuse', foreign])
            assert(
                foreign.message.includes('Form 1116'),
                ['the foreign tax credit refusal must name Form 1116', foreign.message],
            )
            assert(
                foreign.message.includes('Schedule 3 line 1'),
                ['it must name its own Schedule 3 line', foreign.message],
            )
            const premium = classifyScope(['netPremiumTaxCredit'])
            assert(premium.kind === 'error', ['the net premium tax credit must still refuse', premium])
            assert(
                premium.message.includes('Form 8962'),
                ['the net premium tax credit refusal must name Form 8962', premium.message],
            )
            assert(
                premium.message.includes('1040 line 31'),
                ['it must name the REFUNDABLE 1040 line it reaches', premium.message],
            )
            // And the one whose remedy says NO FORM IS MISSING — the only row
            // in this whole table that can. A remedy rewritten to "requires
            // Form NNNN" would be a lie a reader would act on.
            const excess = classifyScope(['excessSocialSecurityWithheld'])
            assert(excess.kind === 'error', ['excess Social Security must still refuse', excess])
            assert(
                excess.message.includes('no form is missing'),
                ['this refusal must say that no form is missing', excess.message],
            )
            assert(
                excess.message.includes('box 4'),
                ['and must name the box it could already read', excess.message],
            )
        },
        // The gate. Its control is the leaf immediately below, which is this
        // same declaration with `unreportedTips` removed -- without it, a
        // guard that refused EVERY profile would pass this leaf.
        //
        // Re-pointed from `socialSecurityBenefits` to `unreportedTips` by
        // Plan 13-02 (see {@link expectedUnreportedTipsRefusalMessage} for
        // why): `socialSecurityBenefits` moved to {@link modeledKinds} in
        // this plan's own Task 2, so the example this gate exercised no
        // longer refuses at all. `unreportedTips` stays refused for the rest
        // of this phase and is not one of the five stale-remedy kinds Wave 5
        // corrects (Decision 1.4).
        //
        // Content, not merely refusal (AGENTS.md, and Phase 9's sweep, which
        // found several assertions checking THAT a refusal happened rather than
        // what it said): the structured `unmodeled` field is asserted element
        // by element, and the line, the label and the remedy are three separate
        // `includes` calls so a failure names which part went missing.
        unreportedTipsRefusesNamingItsLineLabelAndRemedy: () => {
            const outcome = classifyScope(['wages', 'taxableInterest', 'unreportedTips'])
            assert(
                outcome.kind === 'error',
                ['a declared unmodeled kind must refuse the whole return', outcome],
            )
            assertEq(outcome.unmodeled.length, 1, ['expected exactly one unmodeled kind', outcome.unmodeled])
            assertEq(outcome.unmodeled[0], 'unreportedTips', ['expected the declared kind named', outcome.unmodeled])
            assert(
                outcome.message.includes('1040 line 1c'),
                ['expected the refusal to name the 1040 line', outcome.message],
            )
            assert(
                outcome.message.includes('unreported tips'),
                ['expected the refusal to name the human label', outcome.message],
            )
            assert(
                outcome.message.includes('Form 4137'),
                ['expected the refusal to name the remedy', outcome.message],
            )
        },
        // THE CONTROL for the leaf above: the same declaration minus the one
        // unmodeled kind computes. A gate that refuses everything passes every
        // refusal proof ever written and nothing else; this is what
        // distinguishes this guard from that one.
        controlTheSameDeclarationWithoutUnreportedTipsIsInScope: () => {
            const outcome = classifyScope(['wages', 'taxableInterest'])
            assertEq(outcome.kind, 'ok', ['the same profile minus the unmodeled kind must compute', outcome])
        },
        // The exact sentence, against a hand-typed expectation. See
        // {@link expectedUnreportedTipsRefusalMessage} for why a whole-message
        // assertion earns its brittleness twice over.
        theRefusalMessageIsExactlyTheHandTypedSentence: () => {
            const outcome = classifyScope(['unreportedTips'])
            assert(outcome.kind === 'error', ['expected a refusal', outcome])
            assertEq(
                outcome.message,
                expectedUnreportedTipsRefusalMessage,
                ['the refusal message must be exactly the hand-typed sentence', outcome.message],
            )
        },
        // A generic, two-kind, FORM-ORDER control pair — `householdEmployeeWages`
        // (1040 line 1b) and `unreportedTips` (1040 line 1c), both named in
        // 13-CONTEXT.md Decision 1.4 as staying refused through the rest of
        // this phase (neither is reclassified by any later plan). Proves the
        // SAME property the deleted `seniorAndOtherScheduleOneADeductions`/
        // `childTaxCreditOrOtherDependents` pair proved: two declared
        // unmodeled kinds are BOTH named, in 1040 form order.
        //
        // **Re-pointed by Plan 13-04** (Phase 13 Wave 2, TAX-09):
        // `seniorAndOtherScheduleOneADeductions` moved to {@link modeledKinds}
        // in this plan's own Task 2, so the original two-kind "65+ profile"
        // fixture this leaf exercised (originally named
        // `theSixtyFivePlusProfileRefusesNamingBothUnmodeledKinds`) stopped
        // refusing on that kind. Renamed to reflect what the leaf actually
        // proves now — a generic two-kind, form-order control pair, not the
        // 65+ profile's own remaining gaps — mirroring Plan 13-02's own
        // `unreportedTips` re-pointing precedent one reclassification
        // earlier. Do NOT pin the whole refusal MESSAGE containing
        // `householdEmployeeWages`'s remedy string: Plan 13-13 rewrites its
        // stale phase-naming suffix to `'no phase yet'` (see this table's
        // own header comment above), which would break this fixture three
        // waves later; only line locators and kind ordering are asserted
        // here.
        //
        // Deliberately asserts lines but NOT remedies, so that dropping the
        // remedy term from the message localizes to the one leaf above that
        // does assert it (`unreportedTipsRefusesNamingItsLineLabelAndRemedy`).
        twoUnmodeledKindsRefuseNamingBothInFormOrder: () => {
            const outcome = classifyScope([
                'wages',
                'taxableInterest',
                'householdEmployeeWages',
                'unreportedTips',
            ])
            assert(outcome.kind === 'error', ['two unmodeled kinds must refuse', outcome])
            assertEq(outcome.unmodeled.length, 2, ['expected both unmodeled kinds', outcome.unmodeled])
            assertEq(outcome.unmodeled[0], 'householdEmployeeWages', ['expected line 1b named first', outcome.unmodeled])
            assertEq(outcome.unmodeled[1], 'unreportedTips', ['expected line 1c named second', outcome.unmodeled])
            assert(
                outcome.message.includes('1040 line 1b'),
                ['expected householdEmployeeWages\'s line named', outcome.message],
            )
            assert(
                outcome.message.includes('1040 line 1c'),
                ['expected unreportedTips\'s line named', outcome.message],
            )
        },
        // THE CONTROL for the gate above: the same declaration with those two
        // kinds removed computes. Renamed alongside its own gate leaf — its
        // assertion (`classifyScope(['wages', 'taxableInterest'])` computes)
        // is unchanged; only the name and the neighboring "65+ profile"
        // framing need to stop claiming a pairing that no longer holds.
        controlTheSameDeclarationWithoutThoseTwoKindsIsInScope: () => {
            const outcome = classifyScope(['wages', 'taxableInterest'])
            assertEq(outcome.kind, 'ok', ['dropping the two unmodeled kinds must compute', outcome])
        },
        // `unmodeled` is ordered by 1040 form order, not by declaration order,
        // so the refusal two taxpayers see for the same two kinds is the same
        // sentence. The expected order is hand-typed; the two messages are then
        // compared to each other, which is what actually pins the stability.
        //
        // Re-pointed by Plan 13-04, same reason and same replacement pair as
        // `twoUnmodeledKindsRefuseNamingBothInFormOrder` above.
        unmodeledFollowsFormOrderNotDeclarationOrder: () => {
            const declaredOneWay = classifyScope([
                'unreportedTips',
                'householdEmployeeWages',
            ])
            const declaredTheOther = classifyScope([
                'householdEmployeeWages',
                'unreportedTips',
            ])
            assert(declaredOneWay.kind === 'error', ['expected a refusal', declaredOneWay])
            assert(declaredTheOther.kind === 'error', ['expected a refusal', declaredTheOther])
            assertEq(
                declaredOneWay.unmodeled.join(','),
                'householdEmployeeWages,unreportedTips',
                ['expected 1040 form order, not declaration order', declaredOneWay.unmodeled],
            )
            assertEq(
                declaredOneWay.message,
                declaredTheOther.message,
                ['the same declared kinds must produce the same message', declaredOneWay.message, declaredTheOther.message],
            )
        },
        // Every one of the forty-one refuses on its own, naming its own
        // line and label -- so no entry can be present in the table yet
        // unreachable through the guard. `section1202Gain` and
        // `investmentInterestForm4952` are both still in this table (Plan
        // 12.1-04's own T-12.1-01 control, re-verified again by Plan 13-02's
        // own four-kind reclassification), so this loop is also the ongoing
        // re-verification that both still refuse.
        //
        // This loop iterates the code under test, which by itself could never
        // notice the table SHRINKING: an entry deleted disappears from the loop
        // in the same instant (the project's fourth signature defect, found
        // this phase in a proof looping `Object.keys(dialectSchemas)`). Two
        // things stand behind it, both independent of this table:
        // `unmodeledRefusalsIsExactlyFiftySeven`'s hand-typed count, and
        // `_EveryKindIsEitherModeledOrRefused`, which makes a deletion a `tsc`
        // failure. What the loop adds is reachability, which neither of those
        // can see; the CONTENT of two entries is pinned by the hand-typed
        // leaves above.
        everyUnmodeledKindRefusesNamingItsOwnLineAndLabel: () => {
            for (const r of unmodeledKindRefusals) {
                const outcome = classifyScope([r.kind])
                assert(outcome.kind === 'error', ['expected this kind to be refused', r.kind, outcome])
                assertEq(outcome.unmodeled.length, 1, ['expected exactly this kind named', r.kind, outcome.unmodeled])
                assertEq(outcome.unmodeled[0], r.kind, ['expected exactly this kind named', r.kind, outcome.unmodeled])
                assert(
                    outcome.message.includes(r.line),
                    ['expected the refusal to name this kind\'s 1040 line', r.kind, outcome.message],
                )
                assert(
                    outcome.message.includes(r.label),
                    ['expected the refusal to name this kind\'s label', r.kind, outcome.message],
                )
            }
        },
        // The distinction the whole return-profile document exists to carry. A
        // return declaring only wages is IN SCOPE even though the engine will
        // report zero for interest, dividends, pensions and everything else --
        // those lines are legitimately zero, not unmodeled. Nothing about the
        // CAS store is consulted to tell the two apart; only the declared set
        // can, which is why a store-driven guard was unsound (Decision 4).
        deliberateOmissionIsNotARefusal: () => {
            const outcome = classifyScope(['wages'])
            assertEq(outcome.kind, 'ok', ['a legitimately empty line is not a refusal', outcome])
        },
        // AGENTS.md: refusals in this codebase are BARE VALUES. A consumer
        // branching on an `Error` instance would miss every one of them, so
        // this pins the shape the consumers in Plans 10-08 and 10-10 may rely
        // on: a plain object, a string message, a real array.
        //
        // Re-pointed from `socialSecurityBenefits` to `unreportedTips` by
        // Plan 13-02, same reason as this file's other three re-pointed
        // leaves (see {@link expectedUnreportedTipsRefusalMessage}).
        refusalIsABareValueShapeNotAnError: () => {
            const outcome = classifyScope(['unreportedTips'])
            assert(outcome.kind === 'error', ['expected a refusal', outcome])
            assertEq(typeof outcome.message, 'string', ['message must be a string', outcome])
            assert(Array.isArray(outcome.unmodeled), ['unmodeled must be an array', outcome])
            assert(
                !(outcome instanceof Error),
                ['a scope refusal is a bare value, never an Error instance', outcome],
            )
        },
        // A refusal naming nothing IS the silent partial return this module
        // exists to prevent, so building one throws -- and the thrown value's
        // CONTENT is asserted, not merely that something was thrown: a bare
        // `throw:` leaf would pass for any failure, including one raised before
        // this code was reached.
        refusalNamingNothingIsItselfRefused: () => {
            let threw = false
            try {
                scopeRefusal([])
            } catch (e) {
                threw = true
                assert(typeof e === 'string' || Array.isArray(e), ['expected a bare thrown value, not an Error', e])
                const message = typeof e === 'string' ? e : Array.isArray(e) ? e.join(' ') : ''
                assert(
                    message.includes('must name at least one unmodeled kind'),
                    ['expected the thrown value to say what was missing', e],
                )
            }
            assert(threw, 'expected scopeRefusal to refuse building a refusal that names nothing')
        },
    },
    // ── The complementary guard's refusal builder (Phase 22, TAX-19) ─────
    //
    // These leaves test the SHAPE and the SENTENCE only. Whether any
    // particular document actually fires a tripwire is `fjs/return/tripwire`'s
    // question, and every leaf there routes through the builder proven here.
    tripwireRefusal: {
        // The exact sentence, against a hand-typed expectation — the same
        // whole-message discipline `theRefusalMessageIsExactlyTheHandTypedSentence`
        // applies to the declared-scope arm, so the tripwire arm's format
        // cannot silently lose the evidence clause, the remedy, or the line.
        theMessageIsExactlyTheHandTypedSentence: () => {
            const outcome = tripwireRefusal([
                { kind: 'unreportedTips', evidence: 'Form W-2 box 8 (allocated tips) is non-zero' },
            ])
            assertEq(outcome.kind, 'error')
            assertEq(
                outcome.message,
                expectedUnreportedTipsTripwireMessage,
                ['the tripwire refusal must be exactly the hand-typed sentence', outcome.message],
            )
            assertEq(outcome.unmodeled.length, 1, ['expected exactly one kind named', outcome.unmodeled])
            assertEq(outcome.unmodeled[0], 'unreportedTips', ['expected the required kind named', outcome.unmodeled])
        },
        // The two sentences must not be confusable. Same kind, same line,
        // same label, same remedy — and a reader must still be able to tell
        // "you declared something unmodeled" from "your documents prove
        // something you did not declare", because those call for opposite
        // actions. Asserted as a DIFFERENCE plus the two distinguishing
        // phrases, so collapsing either preamble into the other reddens here.
        aTripwireRefusalDoesNotReadAsADeclaredOne: () => {
            const declared = classifyScope(['unreportedTips'])
            const tripped = tripwireRefusal([
                { kind: 'unreportedTips', evidence: 'Form W-2 box 8 (allocated tips) is non-zero' },
            ])
            assert(declared.kind === 'error', ['expected a declared-scope refusal', declared])
            if (declared.kind !== 'error') {
                return
            }
            assert(
                declared.message !== tripped.message,
                ['the two refusals must not be the same sentence', tripped.message],
            )
            assert(
                declared.message.includes('this return declares'),
                ['the declared-scope refusal must say the RETURN declared it', declared.message],
            )
            assert(
                tripped.message.includes('the supplied documents require'),
                ['the tripwire refusal must say the DOCUMENTS require it', tripped.message],
            )
            // …and it must not claim a declaration that was never made.
            assert(
                !tripped.message.includes('this return declares'),
                ['a tripwire refusal must not say the return declared anything', tripped.message],
            )
        },
        // Both kinds named, in 1040 FORM order, from findings supplied in the
        // OPPOSITE order — the same property
        // `unmodeledFollowsFormOrderNotDeclarationOrder` pins on the other
        // arm, and for the same reason: two taxpayers whose documents trip the
        // same two tripwires must see one sentence, not two orderings of it.
        // `householdEmployeeWages` (1040 line 1b) and `unreportedTips` (line
        // 1c) are the pair this file already uses for form-order control
        // (13-CONTEXT.md Decision 1.4 keeps both refused).
        twoFindingsAreNamedInFormOrderNotFindingOrder: () => {
            const outcome = tripwireRefusal([
                { kind: 'unreportedTips', evidence: 'evidence for line 1c' },
                { kind: 'householdEmployeeWages', evidence: 'evidence for line 1b' },
            ])
            assertEq(outcome.unmodeled.length, 2, ['expected both required kinds', outcome.unmodeled])
            assertEq(outcome.unmodeled[0], 'householdEmployeeWages', ['expected line 1b named first', outcome.unmodeled])
            assertEq(outcome.unmodeled[1], 'unreportedTips', ['expected line 1c named second', outcome.unmodeled])
            // Each finding's OWN evidence must travel with its OWN kind — a
            // build that paired them by POSITION rather than by kind would
            // produce the same two kinds with one evidence clause used twice,
            // and the `unmodeled` assertions above could not see it. Both
            // clauses are asserted PRESENT first, because an `indexOf`
            // comparison alone is satisfied by a missing string (`-1` is less
            // than everything) — the exact way an ordering assertion passes
            // over a message that lost half its content.
            assert(
                outcome.message.includes('evidence for line 1b'),
                ['the line-1b finding\'s own evidence must be carried', outcome.message],
            )
            assert(
                outcome.message.includes('evidence for line 1c'),
                ['the line-1c finding\'s own evidence must be carried', outcome.message],
            )
            assert(
                outcome.message.indexOf('evidence for line 1b') < outcome.message.indexOf('evidence for line 1c'),
                ['each kind must carry its own evidence, in form order', outcome.message],
            )
        },
        // A tripwire refusal naming nothing is the silent partial return this
        // module exists to prevent, exactly as on the other arm — and the
        // thrown value's CONTENT is asserted, never merely that it threw.
        aRefusalNamingNothingIsItselfRefused: () => {
            let threw = false
            try {
                tripwireRefusal([])
            } catch (e) {
                threw = true
                assert(typeof e === 'string' || Array.isArray(e), ['expected a bare thrown value, not an Error', e])
                const message = typeof e === 'string' ? e : Array.isArray(e) ? e.join(' ') : ''
                assert(
                    message.includes('must name at least one required kind'),
                    ['expected the thrown value to say what was missing', e],
                )
            }
            assert(threw, 'expected tripwireRefusal to refuse building a refusal that names nothing')
        },
        // Every entry in the refusal table is reachable through THIS arm too,
        // naming its own line, label and remedy — so a kind a future tripwire
        // points at cannot turn out to be undescribable. The loop iterates the
        // code under test and therefore cannot see the table shrinking; what
        // stands behind it is `unmodeledRefusalsIsExactlyFiftySeven`'s hand-typed
        // count and `_EveryKindIsEitherModeledOrRefused`, exactly as recorded
        // for the declared-scope loop above.
        // Phase 23's own new arm: a MODELED kind a tripwire still requires to
        // have been DECLARED is describable, and its remedy says something
        // categorically different from every refusal above it. A reader of a
        // declared-scope refusal is being told to go and find a form this
        // engine cannot compute; a reader of THIS one is being told to add a
        // word to their return profile and the engine will do the rest.
        // Asserted as the presence of the instruction AND the absence of the
        // old "requires Form 8959" phrasing, so a remedy that reverted to the
        // pre-Phase-23 wording reddens here.
        aModeledKindIsDescribableAndItsRemedySaysToDeclareIt: () => {
            const outcome = tripwireRefusal([
                { kind: 'additionalMedicareTax', evidence: 'a document proves it' },
            ])
            assertEq(outcome.kind, 'error')
            assertEq(outcome.unmodeled.length, 1, ['expected exactly one kind named', outcome.unmodeled])
            assertEq(outcome.unmodeled[0], 'additionalMedicareTax', ['expected Form 8959\'s kind', outcome.unmodeled])
            assert(
                outcome.message.includes('Schedule 2 line 11 -> 1040 line 23'),
                ['the refusal must name the line the tax lands on', outcome.message],
            )
            assert(
                outcome.message.includes('declare additionalMedicareTax on the return profile'),
                ['the remedy must tell the reader to DECLARE it', outcome.message],
            )
            assert(
                outcome.message.includes('this engine computes Form 8959'),
                ['the remedy must say the engine will then compute it', outcome.message],
            )
            assert(
                !outcome.message.includes('requires Form 8959'),
                [
                    'the remedy must no longer send the reader off to find a form this engine now computes',
                    outcome.message,
                ],
            )
        },
        // THE ORDERING PROPERTY THE NEW TABLE COULD HAVE BROKEN, and the
        // pair that is capable of noticing. `describableKinds` is built by
        // walking `kindVocabulary`, NOT by concatenating the two tables, and
        // that distinction is invisible for most pairs: `additionalMedicareTax`
        // sits after every 1040-line-1-through-13 kind, so pairing it with
        // `unreportedTips` (1040 line 1c) gives the same order either way,
        // which is why `fjs/return/tripwire`'s own two-tripwire leaf cannot
        // see this.
        //
        // `earnedIncomeCredit` (1040 line 27a) is the kind that CAN. In
        // vocabulary — that is, 1040 form — order it comes AFTER
        // `additionalMedicareTax` (Schedule 2 line 11 -> 1040 line 23). Under
        // a concatenated `[...unmodeledKindRefusals, ...modeledKindDeclarationRemedies]`
        // it would come FIRST, because it lives in the first table and the
        // modeled kind is appended after the whole of it. Findings are
        // supplied here in the WRONG order too, so the leaf pins the walk
        // rather than the argument.
        aModeledKindIsOrderedByTheVocabularyNotByWhichTableItCameFrom: () => {
            const outcome = tripwireRefusal([
                { kind: 'earnedIncomeCredit', evidence: 'evidence for 1040 line 27a' },
                { kind: 'additionalMedicareTax', evidence: 'evidence for Schedule 2 line 11' },
            ])
            assertEq(outcome.unmodeled.length, 2, ['expected both kinds named', outcome.unmodeled])
            assertEq(
                outcome.unmodeled[0],
                'additionalMedicareTax',
                ['Schedule 2 line 11 reaches 1040 line 23, which comes before line 27a', outcome.unmodeled],
            )
            assertEq(outcome.unmodeled[1], 'earnedIncomeCredit', ['1040 line 27a comes second', outcome.unmodeled])
            // Both clauses asserted PRESENT before their positions are
            // compared, since `indexOf` returns -1 for a missing string and
            // -1 is less than everything -- the way an ordering assertion
            // passes over a message that lost half its content.
            assert(
                outcome.message.includes('evidence for Schedule 2 line 11'),
                ['the modeled kind\'s own evidence must be carried', outcome.message],
            )
            assert(
                outcome.message.includes('evidence for 1040 line 27a'),
                ['the refused kind\'s own evidence must be carried', outcome.message],
            )
            assert(
                outcome.message.indexOf('evidence for Schedule 2 line 11')
                    < outcome.message.indexOf('evidence for 1040 line 27a'),
                ['the two tables must be interleaved in form order, not concatenated', outcome.message],
            )
        },
        // …and the kind really is MODELED, which is what makes the remedy
        // above true rather than a promise the engine cannot keep. Stated
        // here, beside the sentence, rather than only in `partition`: the
        // runtime half of `_EveryDeclarationRequiredKindIsModeled`.
        everyDeclarationRequiredKindIsModeledAndDescribable: () => {
            // `1 -> 2` is Phase 27's own `businessIncomeOrLoss`, the second
            // and only other use of this table since Phase 23 built it.
            const expectedDeclarationRequiredCount = 2
            assertEq(
                modeledKindDeclarationRemedies.length,
                expectedDeclarationRequiredCount,
                ['exactly two modeled kinds are declaration-required today', modeledKindDeclarationRemedies],
            )
            for (const entry of modeledKindDeclarationRemedies) {
                assert(
                    modeledKindNames.includes(entry.kind),
                    ['a declaration-required kind must be MODELED', entry.kind],
                )
                // The disjointness, restated at runtime. `tsc` already
                // PROVES it -- comparing the two literal unions directly is
                // TS2367, "no overlap" -- so the check is only expressible
                // through the same widening ASSIGNMENT `modeledKindNames`
                // uses, and it exists to survive the day a future kind makes
                // the two unions overlap and the compiler goes quiet.
                /** @type {readonly string[]} */
                const refusedKindNames = unmodeledKindRefusals.map(r => r.kind)
                assert(
                    !refusedKindNames.includes(entry.kind),
                    ['a declaration-required kind must NOT also carry a refusal row', entry.kind],
                )
                // …and declaring it is in scope, which is the whole point of
                // the remedy this table carries.
                assertEq(
                    classifyScope([entry.kind]).kind,
                    'ok',
                    ['declaring a declaration-required kind must compute', entry.kind],
                )
            }
        },
        everyKindIsDescribableThroughTheTripwireArm: () => {
            for (const r of unmodeledKindRefusals) {
                const outcome = tripwireRefusal([{ kind: r.kind, evidence: 'a document proves it' }])
                assertEq(outcome.unmodeled.length, 1, ['expected exactly this kind named', r.kind, outcome.unmodeled])
                assertEq(outcome.unmodeled[0], r.kind, ['expected exactly this kind named', r.kind, outcome.unmodeled])
                assert(
                    outcome.message.includes(r.line),
                    ['expected the refusal to name this kind\'s 1040 line', r.kind, outcome.message],
                )
                assert(
                    outcome.message.includes(r.label),
                    ['expected the refusal to name this kind\'s label', r.kind, outcome.message],
                )
                assert(
                    outcome.message.includes(r.remedy),
                    ['expected the refusal to name this kind\'s remedy', r.kind, outcome.message],
                )
                assert(
                    outcome.message.includes('a document proves it'),
                    ['expected the refusal to name the evidence', r.kind, outcome.message],
                )
            }
        },
    },
}
