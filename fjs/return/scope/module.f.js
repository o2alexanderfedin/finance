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
 * Every one of the one hundred and ninety-five kinds is either in {@link modeledKinds} or carries an
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
 * (Form 6251, Phase 29) and `selfEmploymentTax` (Schedule SE) are both on
 * Schedule 2, both refused on their own after Phase 23, and both were named
 * in the leaf now called `theScheduleTwoKindsStillUnwiredRefuse`. **Phase 28
 * wired `selfEmploymentTax`**, so eleven stay refused today and that leaf
 * carries the correction; the AMT half of the claim is unchanged.
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
 * The other ten stay refused, by name. Two of them were load-bearing proof
 * that this guard still guards something on this schedule: `iraDeduction`
 * (Schedule 1 line 20) and `deductiblePartOfSelfEmploymentTax` (line 15,
 * Schedule SE) both refused on their own after Phase 24. **Phase 28 wired the
 * second**, so nine stay refused today and the leaf now called
 * `theScheduleOneKindsStillUnwiredRefuse` carries the correction; the
 * IRA-deduction half of the claim is unchanged, since that fixed point is
 * still unmodeled.
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
 * ## Schedule SE and §199A's boundary, as of Phase 28 (TAX-31/TAX-32)
 *
 * The first phase since Phase 20 that does NOT begin by splitting a coarse
 * kind, because after Phase 27 none was left. It moves three kinds in and
 * adds three new ones, and the two halves are separate acts:
 *
 * 1. `fjs/schedule/se` computes Schedule SE and `fjs/form8995` the §199A
 *    deduction, and `deductiblePartOfSelfEmploymentTax` (Schedule 1 line 15),
 *    `selfEmploymentTax` (Schedule 2 line 4) and
 *    `qualifiedBusinessIncomeDeduction` (1040 line 13a) move from
 *    {@link unmodeledKindRefusals} to {@link modeledKinds} in the SAME commit
 *    as that wiring — wire before reclassify, as every slice above did.
 * 2. THREE kinds are added, for facts the two new printed forms carry and
 *    nothing stored can reveal: `churchEmployeeIncome` (Schedule SE line 5a,
 *    and §1402(g)'s exemption behind it), `selfEmploymentOptionalMethods`
 *    (Schedule SE Part II) and `qualifiedReitDividendsAndPtpIncome` (Form
 *    8995 lines 6-9).
 *
 * **A vocabulary grows when a form arrives that can name something it could
 * not name before**, and that is what happened here: none of the three had a
 * kind while Schedule SE and Form 8995 did not exist, because there was no
 * printed line for a taxpayer to be told about.
 *
 * **{@link expectedUnmodeledKindCount} does not move**, `62 - 3 + 3`, and its
 * own docstring says so — a count that stays still through a phase that
 * changed six rows is exactly the case where a hand-typed constant proves
 * nothing on its own.
 *
 * **Two remedies are corrected in this phase, and one of them for the second
 * time.** `selfEmployedRetirementPlans` and
 * `selfEmployedHealthInsuranceDeduction` both named net self-employment
 * earnings as their blocker — a figure Phase 28 computes. Each row now names
 * what is ACTUALLY still missing (the plan, and the premiums), which is the
 * same repair Phase 27 made to the second row and the reason this paragraph
 * exists rather than a silent edit.
 *
 * **TAX-39 corrects THIS paragraph, and the correction is the interesting
 * one.** Pairing the two rows here was read by a later reader as a claim that
 * they shared a blocker, and they did not. The retirement plan's missing fact
 * is a PLAN DOCUMENT that no dialect can hold without modelling the plan; the
 * premiums' missing fact was a `lineTag` on a dialect that already existed.
 * One of the two shipped a phase later and the other has no phase in sight.
 * **Two rows whose remedies quote the same form are not two rows with the same
 * problem** — see `fjs/schedule/1/todo/self-employed-health-insurance.md` §1,
 * which makes the same point about `fjs/form2441`'s Schedule SE refusal, the
 * other row this one kept company with.
 *
 * ## Schedule E's boundary, as of Phase 30 (DOC-24/TAX-35)
 *
 * The two-commit shape again, on the ONE kind Phase 27's own split left too
 * coarse — and the paragraph above that called Phase 27's split "the last" is
 * corrected here rather than deleted, because the correction is the finding.
 *
 * 1. `rentalRealEstateRoyaltiesPartnershipsSCorps` becomes FIVE kinds, one per
 *    printed Schedule E PART, all still refused. Nothing is reclassified.
 * 2. `fjs/schedule/e` computes Schedule E Part II from `vnd.fjs.k1_1065` and
 *    `vnd.fjs.k1_1120s`, `fjs/schedule/1` wires its line 41 to printed line 5,
 *    and `fjs/schedule/se` reads 1065 box 14 code A — and
 *    `partnershipAndSCorporationIncome` moves from
 *    {@link unmodeledKindRefusals} to {@link modeledKinds} in the SAME commit
 *    as that wiring.
 *
 * **Why a per-printed-LINE kind was still too coarse, which is the lesson
 * worth carrying forward.** Phases 23 through 27 split four coarse kinds by
 * the rule "one kind per printed line", and that rule is very nearly right.
 * Printed Schedule 1 line 5 is where it breaks: one line number, one caption,
 * and five entirely different taxpayer facts behind it — rental real estate,
 * partnership and S-corporation stakes, estates and trusts, REMIC residual
 * interests and farm rentals, each with its own form, its own documents and
 * its own limitation rules. A filer with rental property and a filer with an
 * S-corporation share were refused by the SAME row naming the SAME whole
 * schedule, so neither could be told what was actually missing and neither
 * could be reclassified without the other. The rule is one kind per thing a
 * taxpayer can truthfully declare having.
 *
 * The other four stay refused, by name, and two of them are load-bearing proof
 * that this guard still guards something on Schedule E: a filer with rental
 * real estate is refused by `rentalRealEstateAndRoyalties` naming **Part I**,
 * not by a message about a schedule the engine now partly computes.
 *
 * **The Phase 22 tripwire mechanism is used a THIRD time.** A stored Schedule
 * K-1 with non-zero box 1 proves pass-through income, so `fjs/return/tripwire`
 * requires `partnershipAndSCorporationIncome` to have been declared — and
 * because this phase MODELS that kind,
 * {@link modeledKindDeclarationRemedies} gains its third entry.
 *
 * ## The last six coarse kinds, split on 2026-08-18
 *
 * Six rows in {@link unmodeledKindRefusals} still named a printed line that
 * collapses many unrelated facts — `otherIncome` (Schedule 1 line 8a-8z),
 * `otherAdjustments` (24a-24z), `otherAdditionalTaxes` (Schedule 2 line
 * 17a-17z), `otherNonrefundableCredits` (Schedule 3 line 6a-6z),
 * `otherPaymentsAndRefundableCredits` (13a-13z) and `amtOtherAdjustments`
 * (Form 6251 line 3). They are eighty-four rows now, and **nothing is
 * reclassified**: {@link expectedModeledKindCount} does not move, and
 * `theSplitReclassifiedNothing` is the leaf that says so by set equality
 * rather than by the length comparison a swap would survive.
 *
 * The spec, the fact lists and the instruction pages every one was read off
 * are in `fjs/return/scope/todo/split-the-six-coarse-kinds.md`. Three things
 * from it belong here, because they are properties of this table rather than
 * of that phase:
 *
 * 1. **The rule is one kind per fact a taxpayer can truthfully declare
 *    having** — Phase 30's own words, and the default reading is one kind per
 *    printed lettered sub-line. It has three riders. A printed line with no
 *    fact behind it gets no kind: Schedule 3 line 6e is *Reserved for future
 *    use*, and the whole 2025 instruction for Schedule 1 line 24z and
 *    Schedule 3 line 6z is "Leave line 24z blank" / "Leave line 6z blank".
 *    A WRITE-IN line gets one kind per example the instructions name PLUS a
 *    residual, because the line is defined as open and a closed list would be
 *    a lie in the other direction. And where one form this engine does not
 *    have feeds two printed lines that nobody can declare separately, ONE
 *    kind names both — `section1202Gain`'s precedent, which is why five
 *    existing rows absorbed seven of the sub-lines instead of seven new kinds
 *    being invented for facts already declarable.
 * 2. **The one deliberate departure** is Form 6251 line 3's *Related
 *    Adjustments*, which is one kind rather than the seven its bullet list
 *    would give. All seven share one blocker exactly — a limit recomputed on
 *    an AMT income base this engine does not compute — the printed form takes
 *    them combined into one entry, and the instructions say "include the
 *    following", so seven kinds would assert a closed set. The reason is
 *    written into `amtRelatedAdjustments`' own remedy, at the site.
 * 3. **Three of the six remedies were wrong about their own printed form**,
 *    which is what reading it rather than the remedy turns up first: line 8
 *    prints twenty-three lettered sub-lines and the remedy said twenty-six,
 *    line 24 prints twelve and the remedy said eleven, line 17 prints
 *    eighteen and the remedy said "more than twenty". A count nothing
 *    compares to anything is the shape this file already knows.
 *
 * **What the split found is worth more than the split.** `vnd.fjs.w2` stores
 * `box11NonqualifiedPlans`, validates it for exactness, and no computation
 * reads it — the fourth ingest-and-drop after `box2EarlyWithdrawalPenalty`,
 * `box6ForeignTaxPaid` and `box10DependentCareBenefits`, and the box Schedule
 * 1 line 8t's instructions point at. It is REPORTED rather than wired, and the
 * reason is in `nonqualifiedDeferredCompensationPension`'s remedy: unlike the
 * other three, the figure alone is not enough, because box 11 amounts are
 * already inside box 1 and moving one without removing it there double-counts
 * it while removing it changes earned income.
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
 * The thirty-eight kinds this engine models today, each with the document it
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
 * `deductiblePartOfSelfEmploymentTax`, `qualifiedBusinessIncomeDeduction` and
 * `selfEmploymentTax` are Phase 28's own (TAX-31/TAX-32) — see "Schedule SE
 * and §199A's boundary" below.
 */
export const modeledKinds = /** @type {const} */ ([
    'wages',                       // W-2 box 1                     -> 1040 line 1a
    // TAX-38's INCOME half, reclassified in the SAME commit as the
    // `fjs/form1040/core` wiring that reads Form W-2 box 10 -- a box this
    // dialect had STORED and no computation had ever read, so the zero on
    // 1040 line 1e was a silent understatement of tax for every taxpayer with
    // a dependent care FSA. The third stored-but-unread box this project has
    // found, after `box2EarlyWithdrawalPenalty` on `vnd.fjs.1099int`.
    //
    // Modeled does NOT mean always computed: `fjs/form2441` refuses seven
    // printed conditions AT THE FORM, each naming the taxpayer's own figures
    // -- which a scope refusal could never have said.
    'dependentCareBenefits',       // W-2 box 10 -> Form 2441 line 26 -> 1040 line 1e
    'taxExemptInterest',           // 1099-INT box 8                -> 1040 line 2a
    'taxableInterest',             // 1099-INT boxes 1 and 3        -> 1040 line 2b
    'qualifiedDividends',          // 1099-DIV box 1b                -> 1040 line 3a
    'ordinaryDividends',           // 1099-DIV box 1a                -> 1040 line 3b
    'iraDistributions',            // 1099-R (box7bIraSepSimple)     -> 1040 lines 4a/4b
    'pensionsAndAnnuities',        // 1099-R (not box7bIraSepSimple) -> 1040 lines 5a/5b
    'socialSecurityBenefits',      // SSA-1099 box 5 + SSB worksheet -> 1040 lines 6a/6b
    'unemploymentCompensation',    // 1099-G box 1 -> Schedule 1 line 7 -> 1040 line 8
    'businessIncomeOrLoss',        // Schedule C line 31 -> Schedule 1 line 3 -> 1040 line 8
    'partnershipAndSCorporationIncome', // Schedule E line 41 -> Schedule 1 line 5 -> 1040 line 8
    'capitalGainDistributions',    // 1099-DIV box 2a                -> 1040 line 7a
    'capitalGainsOrLosses',        // Form 8949 + Schedule D          -> 1040 line 7a
    'unrecaptured1250Gain',        // 1099-DIV box 2b + Sch D worksheet -> Schedule D line 19
    'collectibles28RateGain',      // 1099-DIV box 2d + Sch D worksheet -> Schedule D line 18
    'educatorExpenses',            // vnd.fjs.adjustments -> Schedule 1 line 11 -> 1040 line 10
    'healthSavingsAccountDeduction', // Form 8889 Part I  -> Schedule 1 line 13 -> 1040 line 10
    // Reclassified in the SAME commit as the `fjs/schedule/1` line 14 wiring
    // that makes it computable -- wire before reclassify, as every slice
    // since Phase 13 has done. `fjs/form3903` had been written, proven and
    // committed with NO caller, because Schedule 1 was held elsewhere at the
    // time; a form module nothing calls cannot be noticed being wired wrong,
    // so the kind stayed refused until the caller existed.
    //
    // What made it computable is TWO things arriving, not one: two
    // `vnd.fjs.adjustments` line tags for Form 3903's printed lines 1 and 2,
    // and `movingExpensesArmedForcesPermanentChangeOfStation` on
    // `vnd.fjs.return_profile` -- the §217(g) certification the printed form
    // asks for before its first line, which no information return reports.
    'movingExpensesArmedForces',   // vnd.fjs.adjustments + W-2 box 12 code P -> Form 3903 -> Schedule 1 line 14 -> 1040 line 10
    'deductiblePartOfSelfEmploymentTax', // Schedule SE line 13 -> Schedule 1 line 15 -> 1040 line 10
    // TAX-39. What made it computable was NOT an ordering change: every
    // figure Form 7206 reads was already in scope where Schedule 1 line 17 is
    // built. It was SIX `vnd.fjs.adjustments` line tags (Form 7206's printed
    // line 1 and its five §213(d)(10) age bands) and ONE profile certification
    // (`notEligibleForAnySubsidizedEmployerHealthPlanInAnyMonth`, §162(l)(2)(B)),
    // which is `movingExpensesArmedForces`' own two-things-arriving shape one
    // line up. No dialect was added.
    'selfEmployedHealthInsuranceDeduction', // vnd.fjs.adjustments -> Form 7206 line 14 -> Schedule 1 line 17 -> 1040 line 10
    'penaltyOnEarlyWithdrawalOfSavings', // 1099-INT box 2 -> Schedule 1 line 18 -> 1040 line 10
    'iraDeduction',               // vnd.fjs.adjustments + W-2 box 13 -> Schedule 1 line 20 -> 1040 line 10
    'studentLoanInterestDeduction', // 1098-E + worksheet -> Schedule 1 line 21 -> 1040 line 10
    'itemizedDeductions',          // Schedule A + deductionChoice   -> 1040 line 12e
    'qualifiedBusinessIncomeDeduction', // Form 8995 line 15         -> 1040 line 13a
    'qualifiedReitDividends',      // 1099-DIV box 5 -> Form 8995 line 6 -> 1040 line 13a
    'seniorAndOtherScheduleOneADeductions', // Schedule 1-A Parts I/V/VI -> 1040 line 13b
    'alternativeMinimumTax',       // Form 6251 line 11 -> Schedule 2 line 2 -> 1040 line 17
    // Reclassified in the SAME commit as the wiring that makes it
    // computable: `vnd.fjs.asset_register` -> `fjs/form4562` -> Schedule C
    // line 13 AND Form 6251 line 2l, off ONE completed Form 4562. The old
    // remedy said this engine held "a per-asset basis, method and
    // placed-in-service date ... for nothing", and that is what the
    // register supplies. What §56(a)(1)(A)(ii) then needs is the SAME
    // schedule at 150% declining balance over the same recovery period,
    // which `fjs/form4562/macrs` already derives -- and the two printed
    // cautions that switch the adjustment off (i4562 p7) are read off the
    // register's own `section168kStatus`, never guessed.
    'amtDepreciation',             // Form 4562 -> Form 6251 line 2l -> Schedule 2 line 2 -> 1040 line 17
    'selfEmploymentTax',           // Schedule SE line 12 -> Schedule 2 line 4 -> 1040 line 23
    'additionalMedicareTax',       // Form 8959 -> Schedule 2 line 11 -> 1040 lines 23/25c
    'netInvestmentIncomeTax',      // Form 8960 -> Schedule 2 line 12 -> 1040 line 23
    'uncollectedTaxOnTipsOrGroupTermLife', // W-2 box 12 codes A/B/M/N -> Schedule 2 line 13 -> 1040 line 23
    'childTaxCreditOrOtherDependents', // Schedule 8812 Part I       -> 1040 line 19
    // TAX-36, reclassified in the SAME commit as the `fjs/schedule/3` line 1
    // wiring. **Only §904(j) is modeled, and the kind is modeled anyway** --
    // which is the judgement call worth naming. §904(a)'s limitation is Form
    // 1116 and this engine still does not compute it, so a filer above
    // §904(j)(2)(B)'s $300/$600 ceiling, or one who will not make the
    // election, is REFUSED at the line with their own figures in the message.
    // A kind stays refused when nothing about it can be computed; this one
    // can be computed for most of the population that has it -- anybody
    // holding an international index fund -- and the sub-case that cannot is
    // refused where a taxpayer can see why.
    // TAX-37, reclassified in the SAME commit as the `fjs/form1040/core`
    // wiring that runs Form 8962 once and hands its two answers to the two
    // schedules. **The two are ONE comparison** -- Form 8962 line 24 against
    // line 25 -- so neither could be reclassified without the other: an
    // engine that credited an under-advanced enrollee and silently dropped an
    // over-advanced one's repayment is wrong in exactly the population it
    // misses.
    //
    // `excessAdvancePremiumTaxCreditRepayment` is Schedule 2 line 1a ONLY.
    // The coarse `advancePremiumTaxCreditAndOtherRepayments` that stood in
    // the refusal table below was split into three (see `fjs/return/profile`'s
    // vocabulary), because lines 1b through 1f are Forms 8936 and 4255 and
    // nothing stored distinguishes them from line 1a -- so modeling the
    // coarse kind would have handed a clean-vehicle-credit repayer a zero
    // while telling them the kind was in scope.
    //
    // Nine printed conditions REFUSE at the form rather than at this table,
    // each naming what is missing and where the amount would have gone; see
    // `fjs/form8962`. Being modeled is a claim about what CAN be computed,
    // exactly as `foreignTaxCredit` below records.
    'excessAdvancePremiumTaxCreditRepayment', // Form 1095-A -> Form 8962 line 29 -> Schedule 2 line 1a -> 1040 line 17
    'foreignTaxCredit',            // 1099-DIV box 7 + 1099-INT box 6 -> Schedule 3 line 1 -> 1040 line 20
    // TAX-38's CREDIT half, and the other product of the same Form 2441
    // execution `dependentCareBenefits` above is one product of. NOT
    // refundable for 2025: f2441 line 11 sends it to Schedule 3 line 2, which
    // the printed page files under Part I, Nonrefundable Credits. ARPA's 2021
    // refundability is gone and the slot its Part II line 10 occupied now
    // holds a tax-liability limit.
    'dependentCareCredit',         // Form 2441 line 11 -> Schedule 3 line 2 -> 1040 line 20
    'educationCredits',            // Form 8863 line 19 -> Schedule 3 line 3 -> 1040 line 20
    'retirementSavingsContributionsCredit', // Form 8880 -> Schedule 3 line 4 -> 1040 line 20
    'excessSocialSecurityWithheld', // W-2 box 4 -> Schedule 3 line 11 -> 1040 line 31
    // Reclassified in the SAME commit as the `fjs/schedule/3` line 10 wiring.
    // What made it computable is not a form arriving but a FIELD arriving:
    // `scheduleThreeLine10AmountPaidWithExtensionRequest` on
    // `vnd.fjs.return_profile`, beside 1040 lines 26/35a/36 and for their
    // reason -- no information return reports a Form 4868 payment, so the
    // taxpayer is the only source there has ever been.
    'amountPaidWithExtensionRequest', // return profile -> Schedule 3 line 10 -> 1040 line 31
    'federalTaxWithheldOnW2',      // W-2 box 2                     -> 1040 line 25a
    'federalTaxWithheldOn1099Int', // 1099-INT box 4                -> 1040 line 25b
    'federalTaxWithheldOnOther1099', // 1099-R/1099-DIV/1099-B box 4 -> 1040 line 25b
    'estimatedTaxPayments',        // declared on the return profile -> 1040 line 26
    // TAX-27's own (Phase 32), and reclassified in the SAME commit as the
    // `fjs/form1040/core` line 27a wiring that makes it computable. What made
    // it computable is not a form arriving but FACTS arriving: ten §32
    // vocabularies on `vnd.fjs.return_profile`, which is why its refusal row
    // named seven of them rather than naming a schedule.
    'earnedIncomeCredit',          // §32 + the 2025 EIC Table    -> 1040 line 27a
    'additionalChildTaxCredit',    // Schedule 8812 Part II-A       -> 1040 line 28
    'americanOpportunityCredit',   // Form 8863 line 8              -> 1040 line 29
    // Reclassified the moment `vnd.fjs.1099int` gained box 9. Its refusal row
    // had called itself "the SHARPEST gap on Form 6251 and the only one where
    // the missing figure is a printed box on a dialect this engine already
    // stores" -- and said adding box 9 "would close it outright". It did.
    'amtPrivateActivityBondInterest', // 1099-INT box 9 -> Form 6251 line 2g -> 1040 line 17
    'amtEstatesAndTrusts',        // K-1 (1041) box 12 code A -> Form 6251 line 2j -> 1040 line 17
    // TAX-35's own, and reclassified in the SAME commit as the wiring that
    // makes it computable -- `fjs/schedule/e`'s `beneficiaryRow` reading
    // `vnd.fjs.k1_1041` box 6 into printed Part III columns (d) and (f), which
    // reach line 41 through the addition that was already there.
    //
    // The dialect was registered in both registries by an earlier commit and
    // read by NOTHING, which is the `box13StatutoryEmployee` shape this repo
    // has already paid for once: a stored face no computation consumes cannot
    // be noticed being wrong. Wiring first, reclassify beside it.
    'estateAndTrustIncome',        // Schedule E Part III -> Schedule 1 line 5 -> 1040 line 8
    // TAX-37's REFUNDABLE half, and the other arm of the same Form 8962
    // comparison `excessAdvancePremiumTaxCreditRepayment` above is one arm
    // of. Listed here rather than beside it because this list follows
    // `kindVocabulary`'s order, which is the 1040's own, and Schedule 3 line
    // 9 comes long after Schedule 2 line 1a.
    'netPremiumTaxCredit',         // Form 1095-A -> Form 8962 line 26 -> Schedule 3 line 9 -> 1040 line 31
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
 * The one hundred and forty-three declared kinds this engine does not model, each naming the
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
    { kind: 'medicaidWaiverPayments', line: '1040 line 1d, and Schedule 1 line 8s -> 1040 line 8', label: 'nontaxable Medicaid waiver payments', remedy: 'no dialect models it. ONE kind names both printed lines because they are one fact seen twice: the payment goes on 1040 line 1a or 1d and the SAME amount comes back out on Schedule 1 line 8s as a negative, so a taxpayer could not truthfully declare one half (no phase yet)' },
    { kind: 'adoptionBenefits', line: '1040 line 1f', label: 'employer-provided adoption benefits', remedy: 'requires Form 8839 (no phase yet)' },
    { kind: 'form8919Wages', line: '1040 line 1g', label: 'Form 8919 wages', remedy: 'requires Form 8919 (no phase yet)' },
    { kind: 'otherEarnedIncome', line: '1040 line 1h', label: 'other earned income', remedy: 'no dialect models it (no phase yet)' },
    { kind: 'nontaxableCombatPayElection', line: '1040 line 1i', label: 'nontaxable combat pay election', remedy: 'no dialect models it (no phase yet)' },
    { kind: 'section1202Gain', line: 'Form 1099-DIV box 2c; Form 6251 line 2h -> Schedule 2 line 2 -> 1040 line 17', label: 'section 1202 gain', remedy: 'requires the §1202 exclusion percentage, which no 1099-DIV box carries. The SAME missing percentage blocks Form 6251 line 2h, which is 7% of the excluded gain as a positive AMT preference — so this one kind names both, rather than Phase 29 inventing a second declaration for one taxpayer fact (no phase yet)' },
    { kind: 'investmentInterestForm4952', line: 'Form 4952 line 4g; Form 6251 line 2c -> Schedule 2 line 2 -> 1040 line 17', label: 'investment interest expense election', remedy: 'requires Form 4952 and the Schedule D Tax Worksheet (TAX-11, Phase 12). The SAME missing form blocks Form 6251 line 2c, which is the difference between the regular-tax and AMT investment interest deductions and needs a SECOND Form 4952 filled in with AMT amounts — so this one kind names both, rather than Phase 29 inventing a second declaration for one taxpayer fact' },
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
    // ── Schedule 1 line 5's five per-Schedule-E-PART kinds (TAX-35, Phase 30) ─
    //
    // `rentalRealEstateRoyaltiesPartnershipsSCorps` -- one row for the whole
    // of Schedule E -- stood here until Phase 30 split it. Its remedy read
    // "requires Schedule E, and for a partnership or S-corporation stake the
    // Schedule K-1 dialects", which named a whole schedule for a filer who has
    // one part of it, and could only ever be reclassified all at once. Each row
    // below names its own printed PART, its own line range and its own missing
    // form. `line` names the SCHEDULE E lines first, then Schedule 1's, then
    // the 1040's, because the reader of this refusal is holding a Schedule E.
    //
    // **One of the five is NOT here**, because it is MODELED:
    // `partnershipAndSCorporationIncome` (Part II) moved to
    // {@link modeledKinds} in the SAME commit as the
    // `fjs/schedule/e`/`fjs/schedule/1`/`fjs/form1040/core` wiring that makes
    // it computable -- wire before reclassify, exactly as Phases 23, 24, 25 and
    // 27 did. The split commit before it added all five as refusals and
    // reclassified nothing.
    { kind: 'rentalRealEstateAndRoyalties', line: 'Schedule E Part I lines 3-26 -> Schedule 1 line 5 -> 1040 line 8', label: 'rental real estate and royalty income or loss', remedy: 'requires Schedule E Part I, whose per-property columns need the rents received and the fair rental and personal-use days that §280A allocates by — neither of which any dialect here carries. The DEPRECIATION half of this refusal is gone: `vnd.fjs.asset_register` and `fjs/form4562` now compute a Form 4562 line 22, and a register for a rental activity is REFUSED by name at `fjs/schedule/c` rather than silently dropped, precisely because Part I is the printed line its depreciation would have to reach. A royalty additionally needs its own printed line 4, which is Part I’s and not Part II’s, so a Schedule K-1 royalty box cannot ride into line 41 on the partnership block (no phase yet)' },
    { kind: 'remicResidualInterest', line: 'Schedule E Part IV lines 38-39 -> Schedule 1 line 5 -> 1040 line 8', label: 'real estate mortgage investment conduit (REMIC) residual interest', remedy: 'requires Schedule Q (Form 1066), and §860E(a) taxes the excess inclusion whether or not it was received and forbids offsetting it with any net operating loss — so a zero here is not merely an omission but a floor this engine cannot enforce (no phase yet)' },
    { kind: 'netFarmRentalIncomeForm4835', line: 'Schedule E Part V line 40 -> Schedule 1 line 5 -> 1040 line 8', label: 'net farm rental income or loss', remedy: 'requires Form 4835, which a landowner uses for crop-share rents received without materially participating — and materially participating instead moves the whole activity to Schedule F, which `farmIncomeOrLoss` already refuses. Neither form is modeled (no phase yet)' },
    { kind: 'farmIncomeOrLoss', line: 'Schedule 1 line 6 -> 1040 line 8', label: 'farm income or loss', remedy: 'requires Schedule F (no phase yet)' },
    // ── Schedule 1 line 8's twenty-eight kinds (2026-08-18) ────────────────
    //
    // `otherIncome` stood here as ONE row for the whole of printed line 8. Its
    // remedy read "the printed form itself collapses twenty-six lettered
    // sub-lines here — among them net operating loss, gambling winnings, jury
    // duty pay, cancellation of debt and the taxable Olympic-medal exclusion —
    // and this engine models none of them (no phase yet)", which is a sentence
    // a taxpayer can do nothing with: it names a form, a count and a sample,
    // and never the document THEY are missing. It was also wrong about the
    // count — `f1040s1.pdf` (2025) prints twenty-THREE lettered sub-lines,
    // 8a through 8v and 8z, with no 8w, 8x or 8y.
    //
    // Each row below names one printed sub-line and the document, form or
    // determination that would supply it, read off `f1040s1.pdf` (2025) and
    // `i1040gi.pdf` (2025) pp. 90-93. Nothing is reclassified: all
    // twenty-eight refuse, and `expectedModeledKindCount` does not move.
    //
    // Two of the twenty-three sub-lines have no row here, because a row for
    // each already existed and was EXTENDED rather than duplicated — 8d
    // (`foreignEarnedIncomeForm2555`) and 8s (`medicaidWaiverPayments`). That
    // is `section1202Gain`'s precedent, five rows below: one kind naming both
    // printed lines rather than a second declaration for one taxpayer fact.
    //
    // Line 8z is EIGHT rows. Its instructions name seven examples and then
    // leave the line open ("any taxable income not reported elsewhere on your
    // return or other schedules"), so seven rows name the examples and
    // `otherIncomeNotListed` is the residual that says, in its own remedy,
    // that no single form closes it.
    { kind: 'netOperatingLossDeduction', line: 'Schedule 1 line 8a -> 1040 line 8', label: 'a net operating loss deduction from an earlier year', remedy: 'requires Form 172 and the earlier year’s loss: an NOL is carried forward from a return this engine does not hold, since it models one tax year (no phase yet)' },
    { kind: 'gamblingWinnings', line: 'Schedule 1 line 8b -> 1040 line 8', label: 'gambling winnings not attributable to a trade or business', remedy: 'requires a Form W-2G dialect, which does not exist here. The losses that offset them are Schedule A line 16 and are capped at the winnings, so a winnings figure without a losses figure would overstate tax for anyone who itemizes (no phase yet)' },
    { kind: 'cancellationOfDebt', line: 'Schedule 1 line 8c -> 1040 line 8', label: 'cancellation of debt', remedy: 'requires a Form 1099-C dialect and the Pub. 4681 exclusion determination — insolvency, bankruptcy or qualified principal residence indebtedness — without which a box 2 amount that is not taxable at all would be taxed in full (no phase yet)' },
    { kind: 'form8853MsaAndLongTermCareIncome', line: 'Schedule 1 line 8e -> 1040 line 8', label: 'taxable Archer MSA, Medicare Advantage MSA and long-term care insurance income', remedy: 'requires Form 8853 lines 8, 12 and 26, which this engine does not compute and no dialect reports (no phase yet)' },
    { kind: 'healthSavingsAccountIncome', line: 'Schedule 1 line 8f -> 1040 line 8', label: 'taxable health savings account income', remedy: 'requires Form 8889 lines 16 and 20. `fjs/schedule/1` reads Form W-2 box 12 code W for the line 13 DEDUCTION, but nothing stored reports a DISTRIBUTION, and the income half cannot be inferred from the contribution half (no phase yet)' },
    { kind: 'alaskaPermanentFundDividends', line: 'Schedule 1 line 8g -> 1040 line 8', label: 'Alaska Permanent Fund dividends', remedy: 'no dialect models the Alaska Department of Revenue’s annual dividend statement, and the amount reaches no federal information return this engine reads (no phase yet)' },
    { kind: 'juryDutyPay', line: 'Schedule 1 line 8h -> 1040 line 8', label: 'jury duty pay', remedy: 'no dialect models it — a court pays it on no federal information return this engine reads. The matching deduction for pay turned over to an employer is Schedule 1 line 24a and is its own kind (no phase yet)' },
    { kind: 'prizesAndAwards', line: 'Schedule 1 line 8i -> 1040 line 8', label: 'prizes and awards', remedy: 'requires a Form 1099-MISC dialect (box 3), which does not exist here (no phase yet)' },
    { kind: 'notForProfitActivityIncome', line: 'Schedule 1 line 8j -> 1040 line 8', label: 'income from an activity not engaged in for profit', remedy: 'requires the §183 hobby-versus-business determination that decides whether the income belongs here or on Schedule C, and no dialect records it (no phase yet)' },
    { kind: 'stockOptionIncome', line: 'Schedule 1 line 8k -> 1040 line 8', label: 'income from the exercise of stock options not reported on 1040 line 1h', remedy: 'requires the exercise price and the fair market value at exercise for a NONSTATUTORY option that never went through payroll. `vnd.fjs.form3921` records an INCENTIVE stock option exercise under §422, which is not this line — its spread is a Form 6251 preference, not ordinary income (no phase yet)' },
    { kind: 'personalPropertyRentalIncome', line: 'Schedule 1 line 8l -> 1040 line 8', label: 'income from the rental of personal property engaged in for profit but not as a business', remedy: 'no dialect models it, and the for-profit-but-not-a-business determination that keeps it off Schedule C is the taxpayer’s. The matching expenses are Schedule 1 line 24b and are their own kind (no phase yet)' },
    { kind: 'olympicAndParalympicMedals', line: 'Schedule 1 line 8m -> 1040 line 8', label: 'the value of Olympic and Paralympic medals and USOC prize money', remedy: 'requires a Form 1099-MISC dialect (box 3). The §74(d) nontaxable offset is Schedule 1 line 24c and is its own kind, and it needs adjusted gross income figured INCLUDING this amount (no phase yet)' },
    { kind: 'section951Inclusion', line: 'Schedule 1 line 8n -> 1040 line 8', label: 'a section 951(a) subpart F inclusion', remedy: 'requires Forms 5471, Schedule I lines 1a through 1h and line 2, and no dialect models a controlled foreign corporation return (no phase yet)' },
    { kind: 'section951AInclusion', line: 'Schedule 1 line 8o -> 1040 line 8', label: 'a section 951A(a) global intangible low-taxed income inclusion', remedy: 'requires Form 8992 Part II line 5, and no dialect models it (no phase yet)' },
    { kind: 'excessBusinessLossAdjustment', line: 'Schedule 1 line 8p -> 1040 line 8', label: 'the section 461(l) excess business loss adjustment', remedy: 'requires Form 461 line 16, which limits an aggregate trade-or-business loss across every business the taxpayer has — this engine models one Schedule C and does not aggregate (no phase yet)' },
    { kind: 'ableAccountDistributions', line: 'Schedule 1 line 8q -> 1040 line 8', label: 'taxable distributions from an ABLE account', remedy: 'requires Form 1099-QA and the designated beneficiary’s qualified disability expenses for the year, neither of which any dialect models (no phase yet)' },
    { kind: 'scholarshipAndFellowshipGrants', line: 'Schedule 1 line 8r -> 1040 line 8', label: 'scholarship and fellowship grants not reported on Form W-2', remedy: '`vnd.fjs.1098t` box 5 records scholarships or grants and `fjs/schedule/3` already reads it, but the TAXABLE part is what was not spent on tuition and course-related expenses — room, board and travel — and no document reports what the money was spent on, nor whether the taxpayer was a degree candidate (no phase yet)' },
    { kind: 'nonqualifiedDeferredCompensationPension', line: 'Schedule 1 line 8t -> 1040 line 8', label: 'a pension or annuity from a nonqualified deferred compensation plan or a nongovernmental section 457 plan', remedy: 'the amount is Form W-2 box 11, which `vnd.fjs.w2` STORES as `box11NonqualifiedPlans` and no computation reads. What is missing is not the figure but a decision: box 11 amounts are already inside box 1, which `fjs/form1040/core` puts on 1040 line 1a in full, so carrying one here without removing it there double-counts it — and removing it changes earned income, and with it the earned income credit (no phase yet)' },
    { kind: 'wagesEarnedWhileIncarcerated', line: 'Schedule 1 line 8u -> 1040 line 8', label: 'wages earned while incarcerated', remedy: 'the amount arrives on a Form W-2 or a Form 1099 that does not distinguish it, and no dialect records the penal-institution fact that moves it off 1040 line 1a (no phase yet)' },
    { kind: 'digitalAssetOrdinaryIncome', line: 'Schedule 1 line 8v -> 1040 line 8', label: 'ordinary income received in digital assets and not reported elsewhere', remedy: 'requires a Form 1099-DA dialect, which does not exist here — and forks, staking and mining income often arrives on no information return at all (no phase yet)' },
    { kind: 'recoveriesOfAmountsDeductedInAnEarlierYear', line: 'Schedule 1 line 8z -> 1040 line 8', label: 'recoveries of amounts deducted in an earlier year', remedy: 'requires the Pub. 525 tax-benefit rule, whose input is the PRIOR year’s return — this engine models one tax year. It is the same blocker `taxableStateLocalRefunds` carries on printed line 1, and the two of them together are what keep Form 6251 line 2b a computed zero (no phase yet)' },
    { kind: 'reemploymentTradeAdjustmentAssistance', line: 'Schedule 1 line 8z -> 1040 line 8', label: 'reemployment trade adjustment assistance (RTAA) payments', remedy: 'the amount is Form 1099-G box 5, which `vnd.fjs.1099g` REFUSES at storage when non-zero rather than dropping it. Nothing else is missing: what this line needs is a computation to carry the box here (no phase yet)' },
    { kind: 'lossOnCorrectiveDistributionsOfExcessDeferrals', line: 'Schedule 1 line 8z -> 1040 line 8', label: 'a loss on a corrective distribution of excess deferrals', remedy: 'requires the §402(g) excess deferral and the loss allocable to it; `vnd.fjs.1099r` carries the distribution but no field records which part is the corrective distribution or its allocable loss (no phase yet)' },
    { kind: 'insurancePolicyDividendsExceedingPremiums', line: 'Schedule 1 line 8z -> 1040 line 8', label: 'dividends on an insurance policy that exceed the net premiums paid', remedy: 'requires the total of every net premium paid on the contract over its whole life, which no annual information return reports (no phase yet)' },
    { kind: 'charitableContributionDeductionRecapture', line: 'Schedule 1 line 8z -> 1040 line 8', label: 'recapture of a charitable contribution deduction', remedy: 'requires the earlier year’s deduction — for a fractional interest in tangible personal property under Pub. 526, or for property the charity disposed of within three years — and this engine holds no prior-year return. The 10% ADDITIONAL TAX that travels with the fractional-interest case is Schedule 2 line 17g and is its own kind (no phase yet)' },
    { kind: 'disasterReliefPayments', line: 'Schedule 1 line 8z -> 1040 line 8', label: 'the taxable part of disaster relief payments', remedy: 'requires the §139 determination of which payments reimbursed which expenses, and no dialect models a disaster relief payment (no phase yet)' },
    { kind: 'educationSavingsAccountDistributions', line: 'Schedule 1 line 8z -> 1040 line 8', label: 'taxable distributions from a Coverdell education savings account or a qualified tuition program', remedy: 'requires Form 1099-Q and the beneficiary’s qualified education expenses for the year. `vnd.fjs.1098t` box 1 records tuition BILLED, which is neither the same figure nor enough — it excludes room and board and says nothing about a rollover (no phase yet)' },
    { kind: 'otherIncomeNotListed', line: 'Schedule 1 line 8z -> 1040 line 8', label: 'other taxable income the printed line does not name', remedy: 'line 8z is a WRITE-IN. Its instructions define it as “any taxable income not reported elsewhere on your return or other schedules” and then give examples rather than a closed list — the seven they name are each their own kind above. This one is the residual, and no single form closes it: a taxpayer declaring it has to say what it is (no phase yet)' },
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
    // **SEVEN of the thirteen are NOT here**, because they are MODELED:
    // `educatorExpenses` (line 11), `healthSavingsAccountDeduction` (line 13)
    // and `studentLoanInterestDeduction` (line 21) moved to
    // {@link modeledKinds} in the SAME commit as the
    // `fjs/schedule/1`/`fjs/form1040/core` wiring that makes them computable
    // -- wire before reclassify, exactly as Phase 23's own two-step Schedule
    // 2 split did and as every slice this module's docstring records already
    // established. The split commit before it added all thirteen as
    // refusals and reclassified nothing.
    //
    // Three more followed, each beside its own wiring:
    // `penaltyOnEarlyWithdrawalOfSavings` (line 18) and `iraDeduction` (line
    // 20), and `deductiblePartOfSelfEmploymentTax` (line 15) in Phase 28
    // beside the Schedule SE wiring. **`movingExpensesArmedForces` (line 14)
    // is the seventh**, beside the `fjs/schedule/1` Form 3903 wiring.
    //
    // So seven of the thirteen are modeled and SIX rows remain below. The
    // count in this sentence is the part that rots -- it read "three" for
    // three phases after it had become six -- which is why
    // `theScheduleOneKindsStillUnwiredRefuse` hand-types the six and asserts
    // their number rather than trusting a sentence.
    { kind: 'reservistPerformingArtistFeeBasisExpenses', line: 'Schedule 1 line 12 -> 1040 line 10', label: 'certain business expenses of reservists, performing artists and fee-basis government officials', remedy: 'requires Form 2106 (no phase yet)' },
    // **This remedy was corrected in Phase 28, and it is the second time this
    // table has had to make that correction.** It read "whose limit depends on
    // net self-employment earnings this engine does not compute" -- and Phase
    // 28 computes them, on Schedule SE line 4a. A remedy whose stated reason
    // has been removed is worse than a vague one: a reader is told the gap is
    // a figure that is no longer missing. What still blocks the line is
    // everything ELSE Pub. 560's worksheet needs, and the row says so.
    { kind: 'selfEmployedRetirementPlans', line: 'Schedule 1 line 16 -> 1040 line 10', label: 'self-employed SEP, SIMPLE and qualified plan contributions', remedy: 'requires the Pub. 560 deduction worksheet. Its net-earnings input is computable as of Phase 28 (Schedule SE line 4a), but nothing this engine holds records the PLAN — which of SEP, SIMPLE and qualified the contribution was made to, the plan\u2019s own contribution rate, and how much was actually contributed, none of which appears on any information return (no phase yet)' },
    // **`selfEmployedHealthInsuranceDeduction` STOOD HERE until TAX-39, and it
    // is worth reading what its remedy said, because the remedy was WRONG in a
    // way three phases of careful correction never caught.** It read:
    //
    //   "requires the Pub. 535 self-employed health insurance deduction
    //    worksheet. Both figures it once lacked now exist ... and what remains
    //    missing is the premiums"
    //
    // Two phases had already repaired this row -- Phase 27 deleted a clause
    // naming a Schedule C it then built, Phase 28 deleted one naming a
    // Schedule SE it then built -- and each repair left the FIRST clause
    // untouched, because nobody re-checked it. **Publication 535 was
    // discontinued after tax year 2022.** IRS, *About Publication 535*: "We
    // have discontinued Publication 535, Business Expenses; the last revision
    // was for 2022." A reader sent to find that worksheet in 2025 would have
    // found a three-year-old revision and computed a prior year's rule.
    //
    // The replacement is a printed FORM, Form 7206, and `fjs/form7206`'s own
    // header carries the citation. The lesson this table should keep is the
    // one the two earlier repairs did not surface: **a remedy naming an
    // external source has an expiry the repository cannot see, and the clause
    // least likely to be re-read is the one that has been true longest.**
    { kind: 'alimonyPaid', line: 'Schedule 1 line 19a -> 1040 line 10', label: 'alimony paid', remedy: 'requires the recipient\u2019s SSN and the divorce-decree date, since only a pre-2019 decree makes alimony deductible, and no dialect models either (no phase yet)' },
    { kind: 'archerMsaDeduction', line: 'Schedule 1 line 23 -> 1040 line 10', label: 'the Archer MSA deduction', remedy: 'requires Form 8853 (no phase yet)' },
    // ── Schedule 1 line 24's ten kinds (2026-08-18) ────────────────────────
    //
    // `otherAdjustments` stood here as ONE row reading "the printed form
    // itself collapses eleven lettered sub-lines here and this engine models
    // none of them (no phase yet)" — which named no sub-line, no form and no
    // document, and miscounted: `f1040s1.pdf` (2025) page 2 prints twelve,
    // 24a through 24k and 24z.
    //
    // Read off that page and `i1040gi.pdf` (2025) pp. 99-100. Line 24j has no
    // row here because `foreignEarnedIncomeForm2555` names it, and line 24z
    // has none because its entire 2025 instruction reads "Leave line 24z
    // blank" — the one write-in line in this table with nothing behind it.
    { kind: 'juryDutyPayGivenToEmployer', line: 'Schedule 1 line 24a -> 1040 line 10', label: 'the deduction for jury duty pay turned over to an employer', remedy: 'requires the Schedule 1 line 8h jury duty pay AND the fact that the employer kept paying salary and was repaid out of it, and no dialect models either (no phase yet)' },
    { kind: 'personalPropertyRentalExpenses', line: 'Schedule 1 line 24b -> 1040 line 10', label: 'deductible expenses of a personal property rental engaged in for profit', remedy: 'requires the expenses of the Schedule 1 line 8l rental. `vnd.fjs.business_expenses` records SCHEDULE C expenses, and this rental is by definition not a business, so its expenses have no dialect (no phase yet)' },
    { kind: 'olympicAndParalympicMedalsExclusion', line: 'Schedule 1 line 24c -> 1040 line 10', label: 'the nontaxable amount of Olympic and Paralympic medals and USOC prize money', remedy: 'requires the Schedule 1 line 8m amount, which has no dialect, and the §74(d) test against adjusted gross income figured INCLUDING it — $1,000,000, or $500,000 if married filing separately (no phase yet)' },
    { kind: 'reforestationAmortizationAndExpenses', line: 'Schedule 1 line 24d -> 1040 line 10', label: 'reforestation amortization and expenses', remedy: 'requires the §194 election and the qualified timber property’s basis, amortized over 84 months through Form 4562 Part VI. `fjs/form4562` computes depreciation from `vnd.fjs.asset_register`, which models no timber property and carries no §194 election (no phase yet)' },
    { kind: 'tradeActSupplementalUnemploymentRepayment', line: 'Schedule 1 line 24e -> 1040 line 10', label: 'repayment of supplemental unemployment benefits under the Trade Act of 1974', remedy: 'requires the repayment and the earlier year in which the benefit was included in income, and no dialect models either (no phase yet)' },
    { kind: 'section501c18DPensionContributions', line: 'Schedule 1 line 24f -> 1040 line 10', label: 'contributions to a section 501(c)(18)(D) pension plan', remedy: 'requires the contribution and the Pub. 525 determination that the plan qualifies under §501(c)(18)(D), which the printed instruction for this line refers to Pub. 525 for and no stored document states (no phase yet)' },
    { kind: 'chaplainSection403bContributions', line: 'Schedule 1 line 24g -> 1040 line 10', label: 'contributions by a chaplain to a section 403(b) plan', remedy: 'requires the Pub. 517 determination that the chaplain is self-employed for this purpose, and the contribution; no dialect records either (no phase yet)' },
    { kind: 'unlawfulDiscriminationClaimAttorneyFees', line: 'Schedule 1 line 24h -> 1040 line 10', label: 'attorney fees and court costs for an action involving an unlawful discrimination claim', remedy: 'the deduction is capped at the gross income from the action, so it needs BOTH the fees and the award — and no dialect models a settlement or how it was allocated (no phase yet)' },
    { kind: 'irsWhistleblowerAwardAttorneyFees', line: 'Schedule 1 line 24i -> 1040 line 10', label: 'attorney fees and court costs paid in connection with an IRS whistleblower award', remedy: 'capped at the award includible in gross income, so it needs both figures, and no dialect models either (no phase yet)' },
    { kind: 'excessDeductionsOfSection67eExpenses', line: 'Schedule 1 line 24k -> 1040 line 10', label: 'excess deductions of section 67(e) expenses from a terminating estate or trust', remedy: 'the amount is Schedule K-1 (Form 1041) box 11 code A, which `vnd.fjs.k1_1041` stores and `fjs/schedule/e`’s coded-box sweep REFUSES by name rather than dropping. What is missing is a computation that reads code A and carries it here — the same box also carries codes B, C and D, which belong elsewhere (no phase yet)' },
    { kind: 'netQualifiedDisasterLoss', line: '1040 line 12e, and Form 6251 line 3 -> Schedule 2 line 2 -> 1040 line 17', label: 'net qualified disaster loss', remedy: 'requires Form 4684. The SAME increased standard deduction is added back for the alternative minimum tax on Form 6251 line 3 — one of that line\u2019s seven printed headings — so this one kind names both, rather than the line 3 split inventing a second declaration for one taxpayer fact (no phase yet)' },
    // ── Phase 28's own new row (TAX-32) ─────────────────────────────────────
    //
    // `qualifiedBusinessIncomeDeduction` stood HERE until Phase 28 and is now
    // MODELED. What replaces it is not a rewording of it: Form 8995 lines 6-9
    // are a separate component of the same deduction, reachable by a taxpayer
    // who has no trade or business at all, and this engine computes the other
    // component and not this one.
    { kind: 'qualifiedPubliclyTradedPartnershipIncome', line: 'Form 8995 line 6 -> 1040 line 13a', label: 'qualified publicly traded partnership income', remedy: 'requires Schedule K-1 box 20 code Z or box 17 code V, which `fjs/schedule/e`\u2019s `section199AInformationRefusal` refuses outright \u2014 a document-data refusal, so it stops the whole return whatever the profile declares. It also requires printed Form 8995 line 7, the prior-year REIT/PTP loss carryforward: line 6 can go negative only through a qualified PTP loss, never a REIT dividend, so line 7 is a safe structural zero ONLY while this kind refuses (no phase yet)' },
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
    // ── TAX-37: the coarse `advancePremiumTaxCreditAndOtherRepayments` stood
    // HERE and is now three kinds. `excessAdvancePremiumTaxCreditRepayment`
    // (line 1a) is MODELED; the two rows below are what remains, and neither
    // is a rewording of the kind that left -- a taxpayer can owe either
    // without ever having bought Marketplace coverage.
    //
    // The old row's remedy named "Forms 8936 and 3800". **Form 3800 is the
    // general business credit; the elective-payment-election recapture on
    // Schedule 2 lines 1d-1f comes from Form 4255**, which the printed 2025
    // Schedule 2 names on its own face at every one of those lines. Corrected
    // here rather than carried forward.
    { kind: 'cleanVehicleCreditRepayment', line: 'Schedule 2 lines 1b and 1c -> 1040 line 17', label: 'repayment of a new or previously owned clean vehicle credit transferred to a registered dealer', remedy: 'requires Form 8936 and Schedule A (Form 8936), Parts II and IV. §30D(g)(10)/§25E(f) make the buyer repay a transferred credit when it turns out they were not eligible for it — commonly because modified adjusted gross income exceeded the §30D(f)(10) threshold — and no document this engine holds records that a credit was transferred to a dealer at the point of sale (no phase yet)' },
    { kind: 'electivePaymentElectionRecapture', line: 'Schedule 2 lines 1d, 1e and 1f, and line 19 -> 1040 line 17 and 1040 line 23', label: 'recapture of net elective payment elections, and the excessive-payment amounts that travel with it', remedy: 'requires Form 4255, whose lines 1d and 2a the printed Schedule 2 names at four separate places (lines 1d, 1e, 1f and 19). §6417 lets certain taxpayers elect to treat an energy credit as a payment of tax; the recapture is a per-property, multi-year computation this engine holds no document for. ONE kind covers all four printed lines because they are four consequences of one election (no phase yet)' },
    // ── Form 6251 Part I's own lines, one kind each (TAX-33, Phase 29) ──────
    //
    // The fifteen §56/§57 adjustments and preferences this engine cannot
    // compute. Every one of them is an ADD-BACK, which is what makes this
    // block different from every other in this table: a blank line here does
    // not merely omit an item, it UNDERSTATES alternative minimum taxable
    // income and therefore the tax. Refusing each by name is the only honest
    // alternative to a silent zero.
    //
    // `line` names the FORM 6251 line first and the Schedule 2 line it reaches
    // second, mirroring the Schedule 2 block above: a reader holding a Form
    // 6251 needs the former and a reader holding a 1040 needs the latter.
    //
    // Two of Part I's unmodeled lines are absent from this block on purpose,
    // because a kind for either already exists: line 2c (investment interest)
    // is `investmentInterestForm4952` and line 2h (qualified small business
    // stock) is `section1202Gain`, both far above. Each of those two rows now
    // names its Form 6251 line alongside the line it already named.
    { kind: 'amtDepletion', line: 'Form 6251 line 2d -> Schedule 2 line 2 -> 1040 line 17', label: 'the alternative minimum tax depletion adjustment', remedy: 'requires the depletion deduction refigured under §57(a)(1) with AMT income and deductions, and with the §611 deduction limited to the property\'s AMT-adjusted basis — a per-property computation for which this engine holds no document at all (no phase yet)' },
    { kind: 'amtNetOperatingLossDeduction', line: 'Form 6251 lines 2e and 2f -> Schedule 2 line 2 -> 1040 line 17', label: 'the net operating loss add-back and the alternative tax net operating loss deduction', remedy: 'requires the ATNOL: every prior year\'s loss refigured under the AMT rules, limited to 90% of alternative minimum taxable income figured without it. That is a multi-year history this engine does not hold, and Schedule 1 line 8a — the regular deduction line 2e adds back — is itself the refused `netOperatingLossDeduction` kind. ONE kind covers both printed lines because they are two halves of one fact: 2e removes the regular deduction and 2f allows the AMT one in its place (no phase yet)' },
    { kind: 'amtDispositionOfProperty', line: 'Form 6251 line 2k -> Schedule 2 line 2 -> 1040 line 17', label: 'the difference between the AMT and regular-tax gain or loss on a disposition', remedy: 'requires the taxpayer\'s AMT BASIS in the property disposed of, which differs from the regular-tax basis by every adjustment made in every prior year — most commonly the §56(b)(3) incentive stock option spread, which increases AMT basis in the year of exercise and reduces the AMT gain whenever the shares are later sold. This engine computes that spread (Form 6251 line 2i) but cannot carry it forward: it holds no prior-year AMT basis document, and Form 3921 is issued for the exercise year only (no phase yet)' },
    { kind: 'amtPassiveActivities', line: 'Form 6251 line 2m -> Schedule 2 line 2 -> 1040 line 17', label: 'the passive activity adjustment', remedy: 'requires §469 passive activity losses refigured with AMT amounts, which needs Form 8582 and the Schedule E activities behind it (Phase 30 brings Schedule E Parts II and III; Form 8582 has no phase yet)' },
    { kind: 'amtLossLimitations', line: 'Form 6251 line 2n -> Schedule 2 line 2 -> 1040 line 17', label: 'the loss-limitation adjustment', remedy: 'requires the §465 at-risk and §1366(d) basis limitations refigured with AMT amounts, both of which need a partner\'s or shareholder\'s basis history this engine does not hold (no phase yet)' },
    { kind: 'amtCirculationCosts', line: 'Form 6251 line 2o -> Schedule 2 line 2 -> 1040 line 17', label: 'the circulation expenditures adjustment', remedy: 'requires §173 circulation expenditures amortized over three years for the AMT rather than deducted currently. No document this engine holds identifies an expenditure as circulation costs, and the §59(e) election that removes the adjustment entirely is an election nothing records (no phase yet)' },
    { kind: 'amtLongTermContracts', line: 'Form 6251 line 2p -> Schedule 2 line 2 -> 1040 line 17', label: 'the long-term contract adjustment', remedy: 'requires §460\'s percentage-of-completion method applied for the AMT to contracts accounted for otherwise, which needs per-contract costs and completion percentages on no information return (no phase yet)' },
    { kind: 'amtMiningCosts', line: 'Form 6251 line 2q -> Schedule 2 line 2 -> 1040 line 17', label: 'the mining exploration and development costs adjustment', remedy: 'requires §§616/617 costs amortized over ten years for the AMT. Same shape as the circulation-costs row: no document identifies the expenditure, and the §59(e) election that removes the adjustment is unrecorded (no phase yet)' },
    { kind: 'amtResearchAndExperimentalCosts', line: 'Form 6251 line 2r -> Schedule 2 line 2 -> 1040 line 17', label: 'the research and experimental costs adjustment', remedy: 'requires §174A expenditures amortized over ten years for the AMT, and the §59(e) election that removes the adjustment. Neither the expenditure nor the election appears on any document this engine holds (no phase yet)' },
    { kind: 'amtPre1987InstallmentSales', line: 'Form 6251 line 2s -> Schedule 2 line 2 -> 1040 line 17', label: 'income from certain installment sales before January 1, 1987', remedy: 'requires the installment method disallowed for the AMT on pre-1987 dispositions — a thirty-nine-year-old transaction history this engine has no document type for and could not verify if it had (no phase yet)' },
    { kind: 'amtIntangibleDrillingCosts', line: 'Form 6251 line 2t -> Schedule 2 line 2 -> 1040 line 17', label: 'the intangible drilling costs preference', remedy: 'requires §57(a)(2)\'s excess intangible drilling costs over 65% of net income from oil, gas and geothermal properties, computed per property. No document this engine holds reports a drilling cost, and the §59(e) 60-month write-off election that removes the preference is unrecorded (no phase yet)' },
    // ── Form 6251 line 3's seven kinds (2026-08-18) ────────────────────────
    //
    // `amtOtherAdjustments` stood here as ONE row, and unlike the five other
    // coarse rows this one's remedy DID name its contents — the §179
    // deduction, business use of a home, conservation expenses and the rest.
    // It was still coarse in the way that matters: one row means one refusal,
    // so a taxpayer with a pre-1987 depreciation schedule and a taxpayer with
    // an AMT Form 8990 were told the same thing, and neither could be
    // reclassified without the other.
    //
    // Read off `i6251.pdf` (2025) pp. 8-9, which gives line 3 seven named
    // headings and a "Related Adjustments" group. SIX of the headings are
    // rows below. The seventh, "Net Qualified Disaster Loss", has none:
    // `netQualifiedDisasterLoss` already names that standard deduction at
    // 1040 line 12e and its row is extended to name this line too.
    //
    // "Related Adjustments" is ONE row, `amtRelatedAdjustments`, and it is
    // the single deliberate departure from one-kind-per-printed-fact in this
    // whole split — see its remedy, which states the reason at the site.
    { kind: 'amtPre1987Depreciation', line: 'Form 6251 line 3 -> Schedule 2 line 2 -> 1040 line 17', label: 'the pre-1987-rules depreciation adjustment', remedy: 'requires every property depreciated under the Tax Reform Act of 1986 transitional rules refigured straight line — 19 years for 19-year real property, 15 for low-income housing — and `vnd.fjs.asset_register` records nothing placed in service before 1987 (no phase yet)' },
    { kind: 'amtPollutionControlFacilities', line: 'Form 6251 line 3 -> Schedule 2 line 2 -> 1040 line 17', label: 'the pollution control facility amortization adjustment', remedy: 'requires the §169 election and the facility refigured under ADS or straight-line MACRS. `fjs/form4562` computes MACRS from `vnd.fjs.asset_register`, which has no §169 certified facility and no §169 election (no phase yet)' },
    { kind: 'amtTaxShelterFarmActivities', line: 'Form 6251 line 3 -> Schedule 2 line 2 -> 1040 line 17', label: 'the tax shelter farm activity adjustment', remedy: 'requires every gain and loss of a §58(a)(2) NON-passive tax shelter farm activity refigured under the AMT, with each refigured loss suspended and carried forward indefinitely — a multi-year suspension this engine does not hold, and Schedule F is unmodeled besides (no phase yet)' },
    { kind: 'amtCharitableContributionsOfCertainProperty', line: 'Form 6251 line 3 -> Schedule 2 line 2 -> 1040 line 17', label: 'the adjustment for a charitable contribution of property with a different AMT basis', remedy: 'requires the §170(e) property’s AMT basis, which differs from its regular-tax basis only where an earlier year’s AMT adjustment moved it — a carried basis this engine does not hold (no phase yet)' },
    { kind: 'amtBusinessInterestLimitation', line: 'Form 6251 line 3 -> Schedule 2 line 2 -> 1040 line 17', label: 'the business interest limitation adjustment', remedy: 'requires a SECOND Form 8990 filled in with AMT amounts and the difference at its line 30; this engine computes no Form 8990 at all (no phase yet)' },
    { kind: 'amtNonPrincipalResidenceMortgageInterest', line: 'Form 6251 line 3 -> Schedule 2 line 2 -> 1040 line 17', label: 'the adjustment for mortgage interest on a dwelling that is not a qualified dwelling for the AMT', remedy: 'requires which dwelling each Schedule A interest amount was paid on, and whether it is a qualified dwelling for the AMT — a houseboat and a recreational vehicle are not. `vnd.fjs.itemized_deductions` records the interest without the property it was paid on (no phase yet)' },
    { kind: 'amtRelatedAdjustments', line: 'Form 6251 line 3 -> Schedule 2 line 2 -> 1040 line 17', label: 'the related adjustments — every item whose limit rests on an income base other than adjusted gross income', remedy: 'ONE kind rather than one per affected item, because all of them share a single blocker and the printed form takes them COMBINED into one line 3 entry: each is a limit recomputed on an AMT income base this engine does not compute. The instructions name the §179 deduction, business or rental use of a home, conservation expenses, taxable IRA distributions where prior-year IRA deductions differed for the AMT, the self-employed health insurance deduction, the self-employed SEP/SIMPLE/qualified plans deduction and the IRA deduction under §219(b)(1)(B)’s earned income limitation — and says “include the following”, so the list is not closed either (no phase yet)' },
    // ── Phase 28's own two new rows (TAX-31) ────────────────────────────────
    //
    // `selfEmploymentTax` stood HERE until Phase 28 and is now MODELED. The
    // two rows that replace it are the two facts on the printed Schedule SE
    // that nothing stored can reveal, and neither is a rewording of the kind
    // that left: a taxpayer can owe self-employment tax that this engine
    // computes correctly and still have either of these, in which case the
    // computed figure is wrong.
    { kind: 'churchEmployeeIncome', line: 'Schedule SE line 5a -> Schedule 2 line 4 -> 1040 line 23', label: 'church employee income, and the §1402(g) exemption behind it', remedy: 'requires a Form W-2 field that does not exist: church employee income is wages from an organization that elected exemption from employer Social Security and Medicare tax under §3121(w), on which the EMPLOYEE owes self-employment tax, and nothing on the printed W-2 marks it. The same gap runs the other way for §1402(g), where an approved Form 4029, or a Form 4361 for a minister or member of a religious order, exempts the earnings entirely — so this engine can neither tax the earnings that should be taxed nor exempt the ones that should not (no phase yet)' },
    { kind: 'selfEmploymentOptionalMethods', line: 'Schedule SE Part II (lines 14-17) -> Schedule 2 line 4 -> 1040 line 23', label: 'the farm and non-farm optional methods of figuring net earnings', remedy: 'these are ELECTIONS to report a fixed fraction of gross income as net earnings, usually in order to earn Social Security credits in a low-income year, and no document this engine holds records an election. The non-farm method additionally needs Schedule C line 7 gross income together with the printed test that you "were self-employed at least 2 of the 3 prior years", a multi-year history this engine does not hold, and the farm method needs Schedule F (no phase yet)' },
    { kind: 'additionalTaxOnTaxFavoredAccounts', line: 'Schedule 2 line 8 -> 1040 line 23', label: 'additional tax on IRAs or other tax-favored accounts', remedy: 'requires Form 5329 (no phase yet)' },
    { kind: 'householdEmploymentTaxes', line: 'Schedule 2 line 9 -> 1040 line 23', label: 'household employment taxes', remedy: 'requires Schedule H (no phase yet)' },
    { kind: 'interestOnResidentialLotAndTimeshareInstallments', line: 'Schedule 2 line 14 -> 1040 line 23', label: 'interest on the tax due on installment income from residential lots and timeshares', remedy: 'requires the §453(l)(3) computation, which no document this engine models supplies (no phase yet)' },
    { kind: 'interestOnDeferredInstallmentSaleTax', line: 'Schedule 2 line 15 -> 1040 line 23', label: 'interest on the deferred tax on installment sales over $150,000', remedy: 'requires the §453A(c) computation, which no document this engine models supplies (no phase yet)' },
    { kind: 'lowIncomeHousingCreditRecapture', line: 'Schedule 2 line 16 -> 1040 line 23', label: 'recapture of the low-income housing credit', remedy: 'requires Form 8611 (no phase yet)' },
    // ── Schedule 2 line 17's twenty kinds (2026-08-18) ─────────────────────
    //
    // `otherAdditionalTaxes` stood here as ONE row reading "the printed form
    // itself collapses more than twenty lettered sub-lines here and this
    // engine models none of them (no phase yet)". "More than twenty" was a
    // guess: `f1040s2.pdf` (2025) page 2 prints eighteen, 17a through 17q and
    // 17z. Read off that page and `i1040gi.pdf` (2025) pp. 113-114.
    //
    // Line 17a is FOUR rows rather than one: its instruction lists five
    // numbered recaptures reaching four different forms, and the first two
    // are the same Form 3468 investment credit recaptured through Form 4255.
    //
    // Lines 17p and 17q have no row here — both are interest from Form 8621,
    // and `form8621`'s row is extended to name them. Line 17z is two rows
    // plus an extension: the prevailing wage and apprenticeship penalties,
    // the residual, and `form8978`, whose negative adjustment lands here.
    { kind: 'investmentCreditRecapture', line: 'Schedule 2 line 17a -> 1040 line 23', label: 'recapture of the investment credit', remedy: 'requires Form 4255 column (j) lines 1b, 1j, 1l and 1m together with the Form 3468 Part IV non-EPE recapture, and behind them the earlier year’s credit and the property’s remaining recapture period — this engine holds no prior-year return (no phase yet)' },
    { kind: 'newMarketsCreditRecapture', line: 'Schedule 2 line 17a -> 1040 line 23', label: 'recapture of the new markets credit', remedy: 'requires Form 8874 and the earlier year’s credit, which this engine does not hold (no phase yet)' },
    { kind: 'employerProvidedChildcareCreditRecapture', line: 'Schedule 2 line 17a -> 1040 line 23', label: 'recapture of the credit for employer-provided childcare facilities', remedy: 'requires Form 8882 and the earlier year’s credit, which this engine does not hold (no phase yet)' },
    { kind: 'section6418TransferRecapture', line: 'Schedule 2 line 17a -> 1040 line 23', label: 'recapture attributable to a section 6418 credit transfer', remedy: 'requires Form 4255 column (m)(3), which records a credit BOUGHT from another taxpayer; nothing stored here records a transfer election (no phase yet)' },
    { kind: 'federalMortgageSubsidyRecapture', line: 'Schedule 2 line 17b -> 1040 line 23', label: 'recapture of a federal mortgage subsidy', remedy: 'requires Form 8828 and the bond-financed loan behind it: the sale price, the holding period and the modified adjusted gross income at sale, none of which any dialect models (no phase yet)' },
    { kind: 'hsaDistributionAdditionalTax', line: 'Schedule 2 line 17c -> 1040 line 23', label: 'the additional tax on health savings account distributions', remedy: 'requires Form 8889 line 17b — 20% of a distribution not used for qualified medical expenses. `vnd.fjs.w2` box 12 code W gives the CONTRIBUTION side only, and nothing stored reports a distribution or what it paid for (no phase yet)' },
    { kind: 'hsaIneligibleIndividualAdditionalTax', line: 'Schedule 2 line 17d -> 1040 line 23', label: 'the additional tax for failing to remain an HSA-eligible individual', remedy: 'requires Form 8889 line 21 and the last-month rule’s testing period — a fact about the FOLLOWING year’s coverage, which a one-year engine cannot hold (no phase yet)' },
    { kind: 'archerMsaDistributionAdditionalTax', line: 'Schedule 2 line 17e -> 1040 line 23', label: 'the additional tax on Archer MSA distributions', remedy: 'requires Form 8853 line 9b, and no dialect reports an Archer MSA distribution (no phase yet)' },
    { kind: 'medicareAdvantageMsaDistributionAdditionalTax', line: 'Schedule 2 line 17f -> 1040 line 23', label: 'the additional tax on Medicare Advantage MSA distributions', remedy: 'requires Form 8853 line 13b, and no dialect reports a Medicare Advantage MSA distribution (no phase yet)' },
    { kind: 'charitableFractionalInterestRecaptureTax', line: 'Schedule 2 line 17g -> 1040 line 23', label: 'the additional tax on recapture of a charitable deduction for a fractional interest in tangible personal property', remedy: '10% of the recaptured amount, so it needs the earlier year’s deduction — the same missing prior-year return that blocks the INCOME half on Schedule 1 line 8z (no phase yet)' },
    { kind: 'section409ANonqualifiedPlanTax', line: 'Schedule 2 line 17h -> 1040 line 23', label: 'the 20% tax on income from a nonqualified deferred compensation plan that fails section 409A', remedy: 'the income is Form W-2 box 12 code Z or Form 1099-MISC box 15. `vnd.fjs.w2` stores box 12 entries and no computation reads a code Z; the §409A(a)(1)(B)(ii) interest added to the 20% also needs the year each amount was deferred (no phase yet)' },
    { kind: 'section457ANonqualifiedPlanTax', line: 'Schedule 2 line 17i -> 1040 line 23', label: 'the 20% tax on compensation from a section 457A nonqualified deferred compensation plan', remedy: 'requires the amount that first became determinable this year and the §457A(c)(2) interest, which needs the earlier year in which it would otherwise have been includible (no phase yet)' },
    { kind: 'section72m5ExcessBenefitsTax', line: 'Schedule 2 line 17j -> 1040 line 23', label: 'the section 72(m)(5) excess benefits tax', remedy: 'requires the Pub. 560 computation of a 5% owner’s excess benefit from a qualified plan, and no dialect records plan ownership (no phase yet)' },
    { kind: 'goldenParachutePaymentsTax', line: 'Schedule 2 line 17k -> 1040 line 23', label: 'the 20% tax on excess golden parachute payments', remedy: 'the amount is Form W-2 box 12 code K; `vnd.fjs.w2` stores box 12 entries and no computation reads a code K. The instructions also send a payee to Form 1099-NEC box 3, which the 2025 form face labels “Reserved for future use” (no phase yet)' },
    { kind: 'accumulationDistributionOfTrustsTax', line: 'Schedule 2 line 17l -> 1040 line 23', label: 'the tax on an accumulation distribution of a trust', remedy: 'requires Form 4970 and the trust’s throwback years — a multi-year history this engine does not hold (no phase yet)' },
    { kind: 'expatriatedCorporationInsiderStockCompensationExciseTax', line: 'Schedule 2 line 17m -> 1040 line 23', label: 'the excise tax on insider stock compensation from an expatriated corporation', remedy: 'requires the §4985 determination that the taxpayer is a disqualified individual of a corporation that expatriated, and no dialect records it (no phase yet)' },
    { kind: 'lookBackInterest', line: 'Schedule 2 line 17n -> 1040 line 23', label: 'look-back interest under section 167(g) or 460(b)', remedy: 'requires Form 8697 or Form 8866 and the earlier years’ income from the long-term contract or the income-forecast property, which this engine does not hold (no phase yet)' },
    { kind: 'nonresidentAlienNonEffectivelyConnectedIncomeTax', line: 'Schedule 2 line 17o -> 1040 line 23', label: 'tax on non-effectively-connected income for the part of the year the taxpayer was a nonresident alien', remedy: 'requires Form 1040-NR. This engine computes a Form 1040 for a full-year resident and `vnd.fjs.return_profile` has no field in which to declare a dual-status year (no phase yet)' },
    { kind: 'prevailingWageAndApprenticeshipPenalties', line: 'Schedule 2 line 17z -> 1040 line 23', label: 'the prevailing wage and apprenticeship penalties', remedy: 'requires Form 4255 columns (o) and (p), reached through Form 7210, Form 8933 or Form 4255 itself, and no dialect models an energy credit claim (no phase yet)' },
    { kind: 'otherAdditionalTaxesNotListed', line: 'Schedule 2 line 17z -> 1040 line 23', label: 'other additional taxes the printed line does not name', remedy: 'line 17z is a WRITE-IN. Its instructions define it as “any taxes not reported elsewhere on your return or other schedules” and then list examples — the prevailing-wage penalties and a negative Form 8978 adjustment, each its own kind. This one is the residual, and no single form closes it (no phase yet)' },
    // ── TAX-37's finding: THIS ROW DESCRIBED THE WRONG FORM, and it is
    // corrected rather than reclassified.
    //
    // Schedule 2 (Form 1040) 2025 line 19 reads, in full: "Recapture of net
    // EPE from Form 4255, line 1d, column (l)". It is an elective payment
    // election recapture and has nothing to do with Form 8962. The premium
    // tax credit reaches Form 1040 at exactly TWO places, both of which this
    // commit wires: Schedule 3 line 9 (net PTC, Form 8962 line 26) and
    // Schedule 2 line 1a (excess advance repayment, Form 8962 line 29). There
    // is no third.
    //
    // So this kind CANNOT be honestly reclassified: its `line` named a line
    // that is not a premium tax credit line, and Form 8962 arriving does not
    // make Form 4255's recapture computable. The `line`, `label` and `remedy`
    // are corrected to say what Schedule 2 line 19 actually is.
    //
    // **The kind's NAME is now the only wrong thing left about it**, and
    // renaming a member of the frozen `kindVocabulary` is a separate decision
    // from wiring a form: it invalidates every stored profile that declares
    // it. Recorded here, and in `fjs/form8962/todo/premium-tax-credit.md`,
    // rather than done silently — a reader who trusts the name will otherwise
    // re-derive the same wrong mapping. `electivePaymentElectionRecapture`
    // above is the kind that names line 19 correctly; this row remains as the
    // second, misnamed declaration of the same fact until the vocabulary is
    // deliberately changed.
    { kind: 'premiumTaxCreditReconciliation', line: 'Schedule 2 line 19 -> 1040 line 23', label: 'recapture of a net elective payment election (NOT the premium tax credit, despite this kind\u2019s name)', remedy: 'requires Form 4255 line 1d column (l). This kind is MISNAMED: the 2025 printed Schedule 2 line 19 is the elective payment election recapture, not a premium tax credit line. Form 8962 reaches the return at Schedule 3 line 9 and Schedule 2 line 1a, and this engine computes both; declare netPremiumTaxCredit or excessAdvancePremiumTaxCreditRepayment for those. See fjs/form8962/todo/premium-tax-credit.md (no phase yet)' },
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
    // **THREE of the seven are NOT here**, because they are MODELED:
    // `educationCredits` (line 3) and `retirementSavingsContributionsCredit`
    // (line 4) moved to {@link modeledKinds} in the SAME commit as the
    // `fjs/schedule/3`/`fjs/form1040/core` wiring that makes them computable
    // -- wire before reclassify, exactly as Phases 23 and 24 did. The split
    // commit before it added all twelve as refusals and reclassified nothing.
    //
    // `foreignTaxCredit` (line 1) is the third, at TAX-36, and it left for a
    // reason no other row in this table has yet: **its remedy was true of the
    // case that motivated it and false of the case that dominates it.**
    // "Requires Form 1116" describes §904(a)'s general limitation exactly,
    // and describes §904(j)'s de-minimis election -- $300, or $600 on a joint
    // return, of passive income taxes shown on payee statements -- not at
    // all. The election needs no Form 1116, and it is what an ordinary
    // international-index-fund holder uses. `fjs/schedule/3`'s
    // `foreignTaxCreditLine` computes that case and REFUSES the rest at the
    // line, carrying the taxpayer's own total and ceiling, which is a better
    // refusal than this table could ever produce.
    //
    // `americanOpportunityCredit` (1040 line 29) moved with them, out of the
    // Part II block far below, because Form 8863's ONE execution produces
    // both it and line 3 -- see this module's own docstring.
    //
    // `dependentCareCredit` and `dependentCareBenefits` (1040 line 1e) BOTH
    // left this table at TAX-38, and their separateness -- deliberate, unlike
    // the Schedule 2 block above where `unreportedTips` got no second kind for
    // its own tax -- is what let them move together honestly: Part III's
    // employer-provided benefits are INCLUDIBLE INCOME and Part II's credit is
    // a credit, so a taxpayer can have either without the other, and
    // `fjs/form1040/core` computes each from its own half of one Form 2441
    // execution.
    { kind: 'residentialCleanEnergyCredit', line: 'Schedule 3 line 5a -> 1040 line 20', label: 'the residential clean energy credit', remedy: 'requires Form 5695 Part I (no phase yet)' },
    { kind: 'energyEfficientHomeImprovementCredit', line: 'Schedule 3 line 5b -> 1040 line 20', label: 'the energy efficient home improvement credit', remedy: 'requires Form 5695 Part II (no phase yet)' },
    // ── Schedule 3 line 6's eleven kinds (2026-08-18) ──────────────────────
    //
    // `otherNonrefundableCredits` stood here as ONE row. Its remedy was the
    // most informative of the six — it named the general business credit,
    // Form 8801, the nonrefundable half of the adoption credit and Schedule R,
    // and spent a paragraph on why Form 8801 matters now that Phase 29
    // computes the AMT. That paragraph survives, moved onto
    // `priorYearMinimumTaxCredit`, which is the row it was always about.
    //
    // Read off `f1040s3.pdf` (2025) and `i1040gi.pdf` (2025) p116. Line 6e has
    // no row because the printed form reserves it; line 6l has none because
    // `form8978` names it; line 6z has none because its entire instruction
    // reads "Leave line 6z blank".
    { kind: 'generalBusinessCredit', line: 'Schedule 3 line 6a -> 1040 line 20', label: 'the general business credit', remedy: 'requires Form 3800, which aggregates some three dozen component credits and applies §38(c)’s tax-liability limitation with a one-year carryback and a twenty-year carryforward — a multi-year history this engine does not hold (no phase yet)' },
    { kind: 'priorYearMinimumTaxCredit', line: 'Schedule 3 line 6b -> 1040 line 20', label: 'the credit for prior year minimum tax', remedy: 'requires Form 8801 and the alternative minimum tax PAID in an earlier year on DEFERRAL items. `fjs/form6251` computes this year’s AMT, which is what creates the credit for NEXT year, but no document this engine holds records a prior year’s minimum tax — so a filer carrying one in from 2024 cannot claim it here (no phase yet)' },
    { kind: 'adoptionCredit', line: 'Schedule 3 line 6c -> 1040 line 20', label: 'the nonrefundable adoption credit', remedy: 'requires Form 8839, the qualified adoption expenses, the child’s special-needs determination and the year the adoption became final. The REFUNDABLE half on 1040 line 30 and the employer-provided benefits exclusion on 1040 line 1f are their own kinds, and all three come off the same unbuilt form (no phase yet)' },
    { kind: 'creditForTheElderlyOrDisabled', line: 'Schedule 3 line 6d -> 1040 line 20', label: 'the credit for the elderly or the disabled', remedy: 'requires Schedule R and the §22(e)(3) determination of permanent and total disability, certified by a physician — which no stored document carries (no phase yet)' },
    { kind: 'newCleanVehicleCredit', line: 'Schedule 3 line 6f -> 1040 line 20', label: 'the new clean vehicle credit', remedy: 'requires Form 8936 Part III and the seller’s report behind it: the vehicle identification number, the battery and critical-mineral sourcing tests and the modified adjusted gross income cap. The REPAYMENT of one transferred to a dealer is Schedule 2 lines 1b and 1c and is its own kind (no phase yet)' },
    { kind: 'mortgageInterestCredit', line: 'Schedule 3 line 6g -> 1040 line 20', label: 'the mortgage interest credit', remedy: 'requires Form 8396 and a state or local mortgage credit certificate. `vnd.fjs.itemized_deductions` records mortgage interest PAID, which is the deduction rather than the credit, and no dialect models a certificate (no phase yet)' },
    { kind: 'districtOfColumbiaFirstTimeHomebuyerCredit', line: 'Schedule 3 line 6h -> 1040 line 20', label: 'the District of Columbia first-time homebuyer credit', remedy: 'claimable only as a carryforward from 2024 — no home bought after 2011 qualifies — and this engine holds no prior-year return to carry anything forward from (no phase yet)' },
    { kind: 'qualifiedElectricVehicleCredit', line: 'Schedule 3 line 6i -> 1040 line 20', label: 'the qualified electric vehicle credit', remedy: 'claimable only as a passive activity credit carried forward from an earlier year — no vehicle placed in service after 2006 qualifies — and this engine holds no prior-year return (no phase yet)' },
    { kind: 'alternativeFuelVehicleRefuelingPropertyCredit', line: 'Schedule 3 line 6j -> 1040 line 20', label: 'the alternative fuel vehicle refueling property credit', remedy: 'requires Form 8911 and the census-tract eligibility of the property’s location, which no dialect models (no phase yet)' },
    { kind: 'creditToHoldersOfTaxCreditBonds', line: 'Schedule 3 line 6k -> 1040 line 20', label: 'the credit to holders of tax credit bonds', remedy: 'requires Form 8912 and the issuer’s credit rate and allowance dates, which no dialect models (no phase yet)' },
    { kind: 'previouslyOwnedCleanVehicleCredit', line: 'Schedule 3 line 6m -> 1040 line 20', label: 'the credit for previously owned clean vehicles', remedy: 'requires Form 8936 Part IV, the seller’s report, and the $25,000 sale-price and modified-adjusted-gross-income caps. The REPAYMENT of one transferred to a dealer is Schedule 2 line 1c and is its own kind (no phase yet)' },
    { kind: 'federalTaxWithheldOnOtherForms', line: '1040 line 25c', label: 'federal income tax withheld on other forms', remedy: 'no dialect models it (no phase yet)' },
    { kind: 'refundableAdoptionCredit', line: '1040 line 30', label: 'refundable adoption credit', remedy: 'requires Form 8839 (no phase yet)' },
    // ── Schedule 3 Part II's five per-line kinds (Phase 25) ─────────────────
    //
    // `scheduleThreeRefundableCredits` -- one coarse row covering this whole
    // block -- stood here until Phase 25 split it, for the identical reason
    // as Part I's above. NONE of the five is reclassified by this phase or
    // any commit in it: TAX-25 and TAX-26 reach Part I's lines 3 and 4 only.
    //
    // `excessSocialSecurityWithheld` used to sit here and was the row worth
    // reading: alone in this table, it was refused because it was not
    // modeled rather than because it was unmodelable -- `vnd.fjs.w2` box 4
    // already carried the figure on every W-2 this engine stores. It is
    // MODELED now (Schedule 3 line 11), so the row is gone and no refusal in
    // this table says "no form is missing" any more. What the row taught
    // survives as a rule: a remedy must distinguish a missing FORM from a
    // missing COMPUTATION, because only one of the two is something a
    // taxpayer can act on.
    //
    // `amountPaidWithExtensionRequest` (line 10) has now left too, and its
    // row taught the neighbouring lesson. Its remedy read "no dialect models
    // it — there is no information return for a payment made with Form 4868",
    // which named a missing DIALECT rather than a missing FORM: the first of
    // those this project can close by itself, and it did, with one
    // `option(string)` field on `vnd.fjs.return_profile` beside the three
    // 1040 boxes already there for exactly the same reason. So the rule the
    // row above states has a second half — **a remedy naming a missing
    // dialect is a remedy this repo owns**, and the three rows that still
    // say it (`federalTaxWithheldOnOtherForms` above, and Schedule 1's own
    // two) are where to look next.
    { kind: 'federalFuelTaxCredit', line: 'Schedule 3 line 12 -> 1040 line 31', label: 'the credit for federal tax paid on fuels', remedy: 'requires Form 4136 (no phase yet)' },
    // ── Schedule 3 line 13's eight kinds (2026-08-18) ──────────────────────
    //
    // `otherPaymentsAndRefundableCredits` stood here as ONE row reading "the
    // printed form itself collapses five lettered sub-lines here and this
    // engine models none of them (no phase yet)". The count was right and the
    // sentence was still unusable. Read off `f1040s3.pdf` (2025) and
    // `i1040gi.pdf` (2025) p117.
    //
    // Line 13z is FOUR rows: its instructions name three credits outright —
    // §960(c)'s excess limitation account, Form 8689's Virgin Islands
    // allocation and Form 1062's farmland deferral — and leave the line open,
    // so a residual stands beside them.
    { kind: 'form2439UndistributedCapitalGains', line: 'Schedule 3 line 13a -> 1040 line 31', label: 'the credit for tax paid by a regulated investment company or REIT on undistributed long-term capital gains', remedy: 'requires Form 2439, which no dialect models — and its box 1a gain has to reach Schedule D as well, so crediting the tax without the gain would understate income while overstating payments (no phase yet)' },
    { kind: 'section1341CreditForRepayment', line: 'Schedule 3 line 13b -> 1040 line 31', label: 'the section 1341 credit for repayment of amounts included in income in an earlier year', remedy: 'requires the earlier year’s tax recomputed without the repaid amount, and this engine models one tax year and holds no prior-year return (no phase yet)' },
    { kind: 'netElectivePaymentElectionAmount', line: 'Schedule 3 line 13c -> 1040 line 31', label: 'the net elective payment election amount', remedy: 'requires Form 3800 Part III line 6 column (j) — §6417’s elective payment of an energy credit — and no dialect models a credit claim (no phase yet)' },
    { kind: 'deferredNet965TaxLiability', line: 'Schedule 3 line 13d -> 1040 line 31', label: 'the deferred amount of net section 965 tax liability', remedy: 'requires Form 965-A and the installment election made in an earlier year, which this engine does not hold. The installment PAYABLE this year is Schedule 2 line 20 and is its own kind (no phase yet)' },
    { kind: 'section960cExcessLimitationCredit', line: 'Schedule 3 line 13z -> 1040 line 31', label: 'the section 960(c) credit for an excess limitation account', remedy: 'requires Form 1116 Part III and the excess limitation account carried between years, and this engine holds no prior-year return (no phase yet)' },
    { kind: 'usVirginIslandsTaxAllocation', line: 'Schedule 3 line 13z -> 1040 line 31', label: 'U.S. tax allocable to the U.S. Virgin Islands', remedy: 'requires Form 8689 and a Virgin Islands residence or source determination, for which `vnd.fjs.return_profile` has no field (no phase yet)' },
    { kind: 'qualifiedFarmlandGainDeferral', line: 'Schedule 3 line 13z -> 1040 line 31', label: 'the deferral of net income tax on gain from a sale of qualified farmland', remedy: 'requires Form 1062 line 14 and the election to defer, of which 75% is entered here; no dialect models a farmland sale or the election (no phase yet)' },
    { kind: 'otherRefundableCreditsNotListed', line: 'Schedule 3 line 13z -> 1040 line 31', label: 'other refundable credits the printed line does not name', remedy: 'line 13z is a WRITE-IN. Its instructions name three credits — §960(c), Form 8689 and Form 1062 — each its own kind above, and leave the line open for others. This one is the residual, and no single form closes it (no phase yet)' },
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
    { kind: 'foreignEarnedIncomeForm2555', line: '1040 line 16; Schedule 1 line 8d -> 1040 line 8; Schedule 1 line 24j -> 1040 line 10', label: 'foreign earned income exclusion, and the housing deduction beside it', remedy: 'requires Form 2555 and the Foreign Earned Income Tax Worksheet. ONE kind names all three printed lines because one form produces them: line 45 is the exclusion on Schedule 1 line 8d, line 50 the housing deduction on Schedule 1 line 24j, and the worksheet reprices 1040 line 16 (no phase yet)' },
    { kind: 'childsUnearnedIncomeForm8615', line: '1040 line 16', label: "a child's unearned income", remedy: 'requires Form 8615 (no phase yet)' },
    { kind: 'farmIncomeAveragingScheduleJ', line: '1040 line 16', label: 'farm and fishing income averaging', remedy: 'requires Schedule J (no phase yet)' },
    { kind: 'form8814ChildInterestAndDividends', line: '1040 line 16', label: 'tax from Form 8814', remedy: 'requires Form 8814 (no phase yet)' },
    { kind: 'form4972LumpSumDistribution', line: '1040 line 16', label: 'tax from Form 4972', remedy: 'requires Form 4972 (no phase yet)' },
    { kind: 'section962Election', line: '1040 line 16', label: 'tax with respect to a section 962 election', remedy: 'no phase yet' },
    { kind: 'educationCreditRecapture', line: '1040 line 16', label: 'recapture of an education credit', remedy: 'no phase yet' },
    { kind: 'form8621', line: '1040 line 16; Schedule 2 lines 17p and 17q -> 1040 line 23', label: 'tax from Form 8621 line 16e, and the interest that travels with it', remedy: 'requires Form 8621, which no dialect models. ONE kind names all three printed lines because one PFIC holding produces them: line 16e is the \u00a71291 deferred tax, line 16f the interest on it, and line 24 the interest on a \u00a71294 election — nobody can hold the interest without holding the form (no phase yet)' },
    { kind: 'form8978', line: '1040 line 16; Schedule 3 line 6l -> 1040 line 20; Schedule 2 line 17z -> 1040 line 23', label: 'the Form 8978 partner audit adjustment, positive or negative', remedy: 'requires Form 8978, which no dialect models. ONE kind names all three printed lines because one partnership audit produces them and the SIGN of line 14 decides where it lands: positive to 1040 line 16, negative to Schedule 3 line 6l and, once that line is exhausted, to Schedule 2 line 17z as a negative write-in (no phase yet)' },
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
 *
 * **`alternativeMinimumTax` is the THIRD entry** (Phase 29, TAX-33), and it
 * is the one whose tripwire is the most nearly conclusive of the three. A
 * stored Form 3921 does not merely suggest an alternative minimum tax — it is
 * an exercise of an incentive stock option, which §56(b)(3) makes a preference
 * item, full stop; the only question left is the size of it. Its remedy is
 * unusually long on purpose: declaring the kind makes the tax compute, and it
 * ALSO walks the filer into a form whose Part I this engine mostly refuses, so
 * the remedy names both halves rather than promising more than Phase 29
 * delivers.
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
        kind: 'alternativeMinimumTax',
        line: 'Schedule 2 line 2 -> 1040 line 17',
        label: 'alternative minimum tax',
        remedy: 'declare alternativeMinimumTax on the return profile and this engine computes '
            + 'Form 6251 from your Forms 3921, the standard-deduction add-back and the '
            + 'senior deduction, and charges only the EXCESS over your regular tax (TAX-33, '
            + 'Phase 29). Note where that computation still stops: Form 6251 Part I\'s other '
            + 'fifteen §56/§57 adjustments each refuse by name, and a return with qualified '
            + 'dividends or capital gains refuses unless the Part III upper bound already '
            + 'settles the tax at $0.00',
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
    {
        kind: 'partnershipAndSCorporationIncome',
        line: 'Schedule E Part II lines 27-32 -> Schedule 1 line 5 -> 1040 line 8',
        label: 'partnership and S corporation income or loss',
        remedy: 'declare partnershipAndSCorporationIncome on the return profile and this engine '
            + 'computes Schedule E Part II from your Schedule K-1s (TAX-35, Phase 30), including '
            + 'the self-employment tax a GENERAL partner owes on box 14 code A and the '
            + 'self-employment tax an S-corporation shareholder does not. Note where it stops: a '
            + 'LOSS refuses, because §704(d)/§1366(d) basis is a multi-year history; and Schedule '
            + 'E Parts I and IV each have their own declared kind and each refuses. Part III now '
            + 'COMPUTES and has its own declared kind, estateAndTrustIncome. Six separately '
            + 'stated boxes on the partnership face and five on the S-corporation face now '
            + 'compute ELSEWHERE than Schedule E — interest on 1040 line 2b, dividends on lines '
            + '3a/3b, and capital gains on Schedule D lines 5 and 12 (TAX-35) — so the ones that '
            + 'still refuse by name are the rentals, the royalties, the guaranteed payments, the '
            + '§1231 gain, the §179 deduction, the foreign taxes and the two capital-gain slices '
            + 'bound for the 28%-rate and unrecaptured-§1250 worksheets',
    },
    {
        kind: 'capitalGainsOrLosses',
        line: 'Schedule D -> 1040 line 7a',
        label: 'capital gains or losses',
        remedy: 'declare capitalGainsOrLosses on the return profile and this engine computes '
            + 'Schedule D and Form 8949 from your Forms 1099-B, your Forms 1099-DIV capital gain '
            + 'distributions, and — since TAX-35 — the separately stated capital gain on your '
            + 'Schedule K-1s: printed line 5 takes the short-term figure from box 8 of a Form '
            + '1065 K-1, box 7 of a Form 1120-S K-1 or box 3 of a Form 1041 K-1, and printed '
            + 'line 12 takes the long-term figure from box 9a, box 8a or box 4a of the same '
            + 'three faces. Note where it stops: the 28%-rate and unrecaptured-\u00a71250 slices '
            + 'of that long-term figure (boxes 9b/9c, 8b/8c and 4b/4c) still refuse by name at '
            + 'storage, because this engine computes both worksheets from Form 1099-DIV boxes '
            + '2d and 2b only',
    },
    {
        kind: 'dependentCareBenefits',
        line: 'Form 2441 line 26 -> 1040 line 1e',
        label: 'dependent care benefits',
        remedy: 'declare dependentCareBenefits on the return profile and this engine computes '
            + 'Form 2441 Part III from Form W-2 box 10 (TAX-38), excluding what §129 allows '
            + 'and taxing the rest on 1040 line 1e. **Box 10 was stored and read by nothing '
            + 'before TAX-38**, so this line was $0.00 for everyone with a dependent care '
            + 'flexible spending account, which understates tax. Note that the exclusion needs '
            + 'facts no information return carries: without a vnd.fjs.credits record stating the '
            + 'qualified expenses INCURRED in the year (Form 2441 line 16), nothing can be '
            + 'excluded and the whole of box 10 is taxable — which is correct, because an '
            + 'expense you cannot substantiate is one you cannot exclude a benefit against',
    },
    {
        kind: 'estateAndTrustIncome',
        line: 'Schedule E Part III lines 33-37 -> Schedule 1 line 5 -> 1040 line 8',
        label: 'estate and trust income or loss',
        remedy: 'declare estateAndTrustIncome on the return profile and this engine computes '
            + 'Schedule E Part III from your Schedule K-1s (Form 1041) (TAX-35). Box 6, the '
            + 'beneficiary\'s share of ordinary business income, reaches printed line 33 column '
            + '(d) or (f) on your material-participation determination, and NO self-employment tax '
            + 'follows it: \u00a71402(a) reaches a trade or business you carry on, and a '
            + 'beneficiary does not carry on the fiduciary\'s. Note where it stops: a LOSS refuses '
            + 'under \u00a7642(h)/\u00a7643 rather than \u00a7704(d), because a beneficiary is '
            + 'generally allocated no loss at all and \u00a7642(h) passes one out only on '
            + 'termination, in box 11. Five other boxes on that face now compute ELSEWHERE than '
            + 'Schedule E — box 1 interest on 1040 line 2b, boxes 2a/2b dividends on lines '
            + '3b/3a, and boxes 3/4a capital gains on Schedule D lines 5 and 12 (TAX-35) — and '
            + 'the rest still refuse by name at storage, quoting the printed "Report on" '
            + 'destination. Box 5 is emphatically among them: it is other portfolio and '
            + 'nonbusiness income for Schedule E line 33 column (f), not the interest a '
            + 'partner\'s box 5 carries',
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
 * `29 -> 30` was Phase 27's own `businessIncomeOrLoss`, beside the
 * `fjs/schedule/c` wiring; and `30 -> 33` is Phase 28's own three
 * (`deductiblePartOfSelfEmploymentTax`, `selfEmploymentTax` and
 * `qualifiedBusinessIncomeDeduction`), landed beside the `fjs/schedule/se`
 * and `fjs/form8995` wiring that makes all three computable.
 *
 * `45 -> 46` is Schedule 3 line 10's own `amountPaidWithExtensionRequest`,
 * beside the `fjs/schedule/3` wiring that reads
 * `scheduleThreeLine10AmountPaidWithExtensionRequest` off the return profile.
 *
 * `46 -> 47` is Schedule 3 line 1's own `foreignTaxCredit` (TAX-36), beside
 * the `fjs/schedule/3` `foreignTaxCreditLine` wiring. **The first kind here
 * that is modeled for a SUB-CASE only:** §904(j)'s de-minimis election is
 * computed and §904(a)'s general limitation (Form 1116) is refused at the
 * line, with the taxpayer's own total and ceiling in the message. Being
 * modeled is a claim about what CAN be computed, not a promise that every
 * return declaring the kind will be.
 *
 * `47 -> 49` is TAX-37's own Form 8962 pair --
 * `excessAdvancePremiumTaxCreditRepayment` and `netPremiumTaxCredit` --
 * landed beside the `fjs/form1040/core` wiring that runs the form once and
 * hands its two answers to Schedule 2 and Schedule 3. **Two rather than one,
 * and the pairing is the point:** they are the mutually exclusive arms of
 * Form 8962's own line 24 / line 25 comparison, so reclassifying either alone
 * would leave the engine silently wrong for the half of the population on the
 * other arm.
 *
 * `49 -> 51` is TAX-38's Form 2441 pair — `dependentCareBenefits` and
 * `dependentCareCredit` — landed beside the `fjs/form1040/core` wiring that
 * runs Part III before 1040 line 1z and Part II after the tax. **Two, and
 * unlike Form 8962's pair these are NOT two arms of one comparison**: a
 * taxpayer can have employer-provided benefits without any credit and a credit
 * without any benefits. They moved together because ONE execution produces
 * both, and because the §129 exclusion on the income half reduces the §21(c)
 * cap on the credit half dollar for dollar — reclassifying either alone would
 * have left the other reading a cap the exclusion had already eaten.
 * @type {number}
 */
const expectedModeledKindCount = 53

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
    'dependentCareBenefits',
    'taxExemptInterest',
    'taxableInterest',
    'qualifiedDividends',
    'ordinaryDividends',
    'iraDistributions',
    'pensionsAndAnnuities',
    'socialSecurityBenefits',
    'unemploymentCompensation',
    'businessIncomeOrLoss',
    'partnershipAndSCorporationIncome',
    'capitalGainDistributions',
    'capitalGainsOrLosses',
    'unrecaptured1250Gain',
    'collectibles28RateGain',
    'educatorExpenses',
    'healthSavingsAccountDeduction',
    'movingExpensesArmedForces',
    'deductiblePartOfSelfEmploymentTax',
    'selfEmployedHealthInsuranceDeduction',
    'penaltyOnEarlyWithdrawalOfSavings',
    'iraDeduction',
    'studentLoanInterestDeduction',
    'itemizedDeductions',
    'qualifiedBusinessIncomeDeduction',
    'qualifiedReitDividends',
    'seniorAndOtherScheduleOneADeductions',
    'alternativeMinimumTax',
    'amtDepreciation',
    'selfEmploymentTax',
    'additionalMedicareTax',
    'netInvestmentIncomeTax',
    'uncollectedTaxOnTipsOrGroupTermLife',
    'excessAdvancePremiumTaxCreditRepayment',
    'childTaxCreditOrOtherDependents',
    'foreignTaxCredit',
    'dependentCareCredit',
    'educationCredits',
    'retirementSavingsContributionsCredit',
    'excessSocialSecurityWithheld',
    'amountPaidWithExtensionRequest',
    'federalTaxWithheldOnW2',
    'federalTaxWithheldOn1099Int',
    'federalTaxWithheldOnOther1099',
    'estimatedTaxPayments',
    'earnedIncomeCredit',
    'additionalChildTaxCredit',
    'americanOpportunityCredit',
    'amtPrivateActivityBondInterest',
    'amtEstatesAndTrusts',
    'estateAndTrustIncome',
    'netPremiumTaxCredit',
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
 *
 * **Phase 28 leaves this figure at 62, and that is a coincidence rather than
 * a quiet phase.** `62 - 3 + 3`: three kinds were reclassified to
 * {@link modeledKinds} beside the wiring that computes them
 * (`deductiblePartOfSelfEmploymentTax`, `selfEmploymentTax`,
 * `qualifiedBusinessIncomeDeduction`), and three genuinely new ones were
 * added for facts the two new forms print and nothing stored can reveal
 * (`churchEmployeeIncome`, `selfEmploymentOptionalMethods`,
 * `qualifiedReitDividendsAndPtpIncome`). A count that does not move is
 * exactly the case where a hand-typed constant proves nothing on its own —
 * `theHandTypedListNamesEveryModeledKind` and the vocabulary count in
 * `fjs/return/profile`, which DID move by three, are what catch it.
 *
 * **It happened a SECOND time, and for a different reason worth telling
 * apart.** Splitting `qualifiedReitDividendsAndPtpIncome` moved this count
 * `73 - 1 + 1`: the coarse row left and a `qualifiedPubliclyTradedPartnership\u2010
 * Income` row took its place, while the REIT half went to
 * {@link modeledKinds}. So an unmoved count meant one row reclassified and
 * one row rewritten, not a quiet phase and not a no-op. The vocabulary count
 * in `fjs/return/profile` moved 114 -> 115, which is again what catches it.
 *
 * `62 -> 77` is Phase 29's own first commit (TAX-33), and it is fifteen ADDED
 * rather than a coarse kind split: Form 6251 Part I's §56/§57 adjustments and
 * preferences, one kind per printed line, none of them nameable before that
 * form existed. Nothing is reclassified in the same step —
 * `77 -> 76` is that phase's own ONE-kind reclassification one commit later
 * (`alternativeMinimumTax`), beside the `fjs/schedule/2` line 2 wiring that
 * makes it computable. Wire before reclassify, as every slice since Phase 13
 * has done.
 *
 * `76 -> 80` is Phase 30's own Schedule E split (DOC-24/TAX-35): `76 - 1 + 5`,
 * one coarse `rentalRealEstateRoyaltiesPartnershipsSCorps` row replaced by
 * five per-Schedule-E-PART rows, with NO kind reclassified in the same step.
 * `80 -> 79` is that phase's own ONE-kind reclassification one commit later
 * (`partnershipAndSCorporationIncome`), beside the `fjs/schedule/e` wiring
 * that makes it computable.
 *
 * `69 -> 68` is Schedule 3 line 1's own `foreignTaxCredit` (TAX-36),
 * reclassified beside the `fjs/schedule/3` wiring. Its remedy read "requires
 * Form 1116", which was true of §904(a)'s general case and FALSE of
 * §904(j)'s de-minimis election — and the election is what most of the
 * population holding a foreign tax actually uses. **A remedy can be true of
 * the case that motivated it and false of the case that dominates it**, which
 * is a third way for a row in this table to go stale, alongside the two the
 * rows below record.
 *
 * `70 -> 69` is Schedule 3 line 10's own `amountPaidWithExtensionRequest`,
 * reclassified beside the `fjs/schedule/3` wiring that computes it. Its
 * remedy is the FIRST in this table to have been closed by adding a field to
 * a dialect this repo owns rather than by building a printed form: it read
 * "no dialect models it", and a remedy naming a missing DIALECT rather than a
 * missing FORM is one this project can close itself.
 *
 * **`68 -> 68` is TAX-37's, and the arithmetic that leaves it unchanged is
 * exactly what a bare count cannot see.** Two rows LEAVE — `netPremiumTaxCredit`
 * (reclassified) and the coarse `advancePremiumTaxCreditAndOtherRepayments`
 * (split away) — and two ARRIVE: `cleanVehicleCreditRepayment` and
 * `electivePaymentElectionRecapture`, the Schedule 2 line 1 sub-lines Form
 * 8962 does not reach. `68 - 2 + 2`. Written out because a count that does
 * not move across a commit that changed four rows is indistinguishable, at a
 * glance, from a commit that changed nothing — which is why the hand-typed
 * SET (`everyModeledKindHandTyped`) and the per-schedule `stillRefused`
 * lists, not this number, are what actually pin this phase.
 *
 * **`68 -> 66` is TAX-38's**, and here the count DOES move: two rows leave
 * (`dependentCareBenefits` at 1040 line 1e and `dependentCareCredit` at
 * Schedule 3 line 2) and none arrives, because Form 2441 has no coarse kind to
 * split. `68 - 2`.
 *
 * **`65 -> 143` is the last six coarse kinds being split at once**, on
 * 2026-08-18: `65 - 6 + 84`. `otherIncome` becomes twenty-eight rows,
 * `otherAdjustments` ten, `otherAdditionalTaxes` twenty,
 * `otherNonrefundableCredits` eleven, `otherPaymentsAndRefundableCredits`
 * eight and `amtOtherAdjustments` seven. **Nothing is reclassified**, which is
 * what makes this the largest move this constant has ever made while
 * {@link expectedModeledKindCount} does not move at all — and the pair of
 * facts together is the whole claim: the vocabulary grew, the engine did not.
 *
 * Seven further printed sub-lines are covered WITHOUT a new kind, by
 * extending a row that already existed (`foreignEarnedIncomeForm2555`,
 * `medicaidWaiverPayments`, `form8621`, `form8978`, `netQualifiedDisasterLoss`).
 * A count of 91 would have been the number reached by giving each printed
 * sub-line a kind of its own regardless — and it would have let one taxpayer
 * fact be declared twice, which is the failure `section1202Gain`'s own row
 * has guarded against since Phase 12.1. See
 * `fjs/return/scope/todo/split-the-six-coarse-kinds.md`.
 *
 * **`143 -> 142` is TAX-39's**, and it is the ONE kind reclassified since the
 * split: `selfEmployedHealthInsuranceDeduction` leaves this table for
 * {@link modeledKinds}, beside `fjs/form7206` and Schedule 1 line 17's own
 * wiring. No row arrives, so `143 - 1`. The two moves compose by plain
 * subtraction because they do not overlap — the split invented ten new
 * Schedule 1 Part II rows for printed line 24 and touched none of the
 * thirteen Phase 24 wrote, one of which is line 17.
 * @type {number}
 */
const expectedUnmodeledKindCount = 142

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
        modeledKindsIsExactlyFiftyThree: () => {
            assertEq(modeledKinds.length, expectedModeledKindCount)
            assertEq(new Set(modeledKinds).size, expectedModeledKindCount)
        },
        unmodeledRefusalsIsExactlyOneHundredAndFortyTwo: () => {
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
                    // Phase 28's own addition, and the first that is not a
                    // numbered 1040 schedule: Schedule SE's two rows name a
                    // SCHEDULE SE line first and then trace it through
                    // Schedule 2 to the 1040 (`Schedule SE line 5a ->
                    // Schedule 2 line 4 -> 1040 line 23`), because the
                    // taxpayer fact lives on Schedule SE and the money lands
                    // two forms later. Part II has no single line number, so
                    // its row names the PART.
                    || r.line.startsWith('Schedule SE line')
                    || r.line.startsWith('Schedule SE Part')
                    // Phase 30's own addition, the same shape as Schedule
                    // SE's: Schedule E's five rows name a SCHEDULE E PART and
                    // its printed line range first, then trace it through
                    // Schedule 1 line 5 to the 1040. The taxpayer fact lives on
                    // a part of Schedule E, and all five parts land on one
                    // Schedule 1 line — so a row naming only "Schedule 1 line
                    // 5" would be indistinguishable from the other four.
                    || r.line.startsWith('Schedule E Part')
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
        theThirtyEightScheduleOnePartOneKindsNameTheirOwnPrintedLine: () => {
            /** @type {readonly (readonly [string, string])[]} */
            const expected = [
                ['taxableStateLocalRefunds', 'Schedule 1 line 1'],
                ['alimonyReceived', 'Schedule 1 line 2a'],
                ['businessIncomeOrLoss', 'Schedule 1 line 3'],
                ['otherGainsOrLosses', 'Schedule 1 line 4'],
                // Printed line 5 is FIVE kinds as of Phase 30, one per
                // Schedule E part, and they must sit in Schedule E order
                // between line 4's kind and line 6's — so this list carries
                // all five rather than a stand-in for the block.
                ['rentalRealEstateAndRoyalties', 'Schedule 1 line 5'],
                ['partnershipAndSCorporationIncome', 'Schedule 1 line 5'],
                // MODELED as of TAX-35, and still listed: this leaf states the
                // printed ORDER of Schedule 1 Part I's kinds, which does not
                // change when one of them starts computing. Dropping it here
                // would have quietly reduced the ordering this leaf checks.
                ['estateAndTrustIncome', 'Schedule 1 line 5'],
                ['remicResidualInterest', 'Schedule 1 line 5'],
                ['netFarmRentalIncomeForm4835', 'Schedule 1 line 5'],
                ['farmIncomeOrLoss', 'Schedule 1 line 6'],
                ['netOperatingLossDeduction', 'Schedule 1 line 8a'],
                ['gamblingWinnings', 'Schedule 1 line 8b'],
                ['cancellationOfDebt', 'Schedule 1 line 8c'],
                ['form8853MsaAndLongTermCareIncome', 'Schedule 1 line 8e'],
                ['healthSavingsAccountIncome', 'Schedule 1 line 8f'],
                ['alaskaPermanentFundDividends', 'Schedule 1 line 8g'],
                ['juryDutyPay', 'Schedule 1 line 8h'],
                ['prizesAndAwards', 'Schedule 1 line 8i'],
                ['notForProfitActivityIncome', 'Schedule 1 line 8j'],
                ['stockOptionIncome', 'Schedule 1 line 8k'],
                ['personalPropertyRentalIncome', 'Schedule 1 line 8l'],
                ['olympicAndParalympicMedals', 'Schedule 1 line 8m'],
                ['section951Inclusion', 'Schedule 1 line 8n'],
                ['section951AInclusion', 'Schedule 1 line 8o'],
                ['excessBusinessLossAdjustment', 'Schedule 1 line 8p'],
                ['ableAccountDistributions', 'Schedule 1 line 8q'],
                ['scholarshipAndFellowshipGrants', 'Schedule 1 line 8r'],
                ['nonqualifiedDeferredCompensationPension', 'Schedule 1 line 8t'],
                ['wagesEarnedWhileIncarcerated', 'Schedule 1 line 8u'],
                ['digitalAssetOrdinaryIncome', 'Schedule 1 line 8v'],
                ['recoveriesOfAmountsDeductedInAnEarlierYear', 'Schedule 1 line 8z'],
                ['reemploymentTradeAdjustmentAssistance', 'Schedule 1 line 8z'],
                ['lossOnCorrectiveDistributionsOfExcessDeferrals', 'Schedule 1 line 8z'],
                ['insurancePolicyDividendsExceedingPremiums', 'Schedule 1 line 8z'],
                ['charitableContributionDeductionRecapture', 'Schedule 1 line 8z'],
                ['disasterReliefPayments', 'Schedule 1 line 8z'],
                ['educationSavingsAccountDistributions', 'Schedule 1 line 8z'],
                ['otherIncomeNotListed', 'Schedule 1 line 8z'],
            ]
            assertEq(expected.length, 38,
                'Phase 27 produced seven, Phase 30 expanded line 5 into five, and the '
                + '2026-08-18 split replaced the coarse line-8 kind with twenty-eight: 7 - 1 + 5 - 1 + 28')
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
                //
                // The third arm is Phase 30's: Schedule E's five rows name
                // their own PART first and reach Schedule 1 line 5 in the
                // MIDDLE of the trace rather than at its start. ` -> ` on both
                // sides keeps that as unambiguous as the trailing space is.
                assert(
                    row.line === line
                    || row.line.startsWith(`${line} `)
                    || row.line.includes(` -> ${line} -> `),
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
        // TAX-35's split, stated INDEPENDENTLY of the table it split, and it
        // is the half the leaf above cannot state: five kinds share ONE
        // Schedule 1 line, so an ordering check against that line number would
        // pass with all five rows naming the same part.
        //
        // The five printed PART names and their line ranges are hand-typed off
        // the 2025 `f1040se.pdf` face. Part V is deliberately absent as a
        // refused kind for its own sake -- its line 41 is the TOTAL this engine
        // computes, and only its line 40 (Form 4835) is refusable, which is
        // what `netFarmRentalIncomeForm4835` names.
        theFiveScheduleEKindsNameTheirOwnPrintedPart: () => {
            /** @type {readonly (readonly [string, string])[]} */
            const expected = [
                ['rentalRealEstateAndRoyalties', 'Schedule E Part I lines 3-26'],
                ['partnershipAndSCorporationIncome', 'Schedule E Part II lines 27-32'],
                ['estateAndTrustIncome', 'Schedule E Part III lines 33-37'],
                ['remicResidualInterest', 'Schedule E Part IV lines 38-39'],
                ['netFarmRentalIncomeForm4835', 'Schedule E Part V line 40'],
            ]
            assertEq(expected.length, 5, 'Schedule E has five parts, hand-counted off the printed form')
            // The five PART names must be distinct, which is the property the
            // leaf above cannot check: all five reach `Schedule 1 line 5`, so
            // only the part distinguishes them.
            assertEq(
                new Set(expected.map(([, part]) => part)).size,
                5,
                'two Schedule E kinds name the same printed part',
            )
            for (const [kind, part] of expected) {
                const row = unmodeledKindRefusals.find(r => r.kind === kind)
                if (row === undefined) {
                    assert(
                        modeledKindNames.includes(kind),
                        ['a Schedule E kind is neither refused nor modeled', kind],
                    )
                    continue
                }
                assert(
                    row.line.startsWith(`${part} -> `),
                    ['a Schedule E refusal row names the wrong printed part', kind, part, row.line],
                )
                assert(
                    row.line.includes('Schedule 1 line 5 -> 1040 line 8'),
                    ['every Schedule E row must trace through Schedule 1 line 5 to 1040 line 8', kind, row.line],
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
        theThirtyFiveScheduleTwoKindsNameTheirOwnPrintedLine: () => {
            /** @type {readonly (readonly [string, string])[]} */
            const expected = [
                ['excessAdvancePremiumTaxCreditRepayment', 'Schedule 2 line 1a'],
                ['cleanVehicleCreditRepayment', 'Schedule 2 lines 1b and 1c'],
                // The ONE kind in this table whose `line` names two 1040
                // destinations, because Form 4255's recapture genuinely reaches
                // both: Part I's lines 1d-1f and Part II's line 19.
                ['electivePaymentElectionRecapture', 'Schedule 2 lines 1d, 1e and 1f, and line 19'],
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
                ['investmentCreditRecapture', 'Schedule 2 line 17a'],
                ['newMarketsCreditRecapture', 'Schedule 2 line 17a'],
                ['employerProvidedChildcareCreditRecapture', 'Schedule 2 line 17a'],
                ['section6418TransferRecapture', 'Schedule 2 line 17a'],
                ['federalMortgageSubsidyRecapture', 'Schedule 2 line 17b'],
                ['hsaDistributionAdditionalTax', 'Schedule 2 line 17c'],
                ['hsaIneligibleIndividualAdditionalTax', 'Schedule 2 line 17d'],
                ['archerMsaDistributionAdditionalTax', 'Schedule 2 line 17e'],
                ['medicareAdvantageMsaDistributionAdditionalTax', 'Schedule 2 line 17f'],
                ['charitableFractionalInterestRecaptureTax', 'Schedule 2 line 17g'],
                ['section409ANonqualifiedPlanTax', 'Schedule 2 line 17h'],
                ['section457ANonqualifiedPlanTax', 'Schedule 2 line 17i'],
                ['section72m5ExcessBenefitsTax', 'Schedule 2 line 17j'],
                ['goldenParachutePaymentsTax', 'Schedule 2 line 17k'],
                ['accumulationDistributionOfTrustsTax', 'Schedule 2 line 17l'],
                ['expatriatedCorporationInsiderStockCompensationExciseTax', 'Schedule 2 line 17m'],
                ['lookBackInterest', 'Schedule 2 line 17n'],
                ['nonresidentAlienNonEffectivelyConnectedIncomeTax', 'Schedule 2 line 17o'],
                ['prevailingWageAndApprenticeshipPenalties', 'Schedule 2 line 17z'],
                ['otherAdditionalTaxesNotListed', 'Schedule 2 line 17z'],
                ['premiumTaxCreditReconciliation', 'Schedule 2 line 19'],
                ['section965NetTaxLiabilityInstallment', 'Schedule 2 line 20'],
            ]
            assertEq(
                expected.length, 35,
                'Phase 23\u2019s split produced fourteen, TAX-37 replaced the coarse line-1 kind with '
                + 'three, and the 2026-08-18 split replaced the coarse line-17 kind with twenty: '
                + '14 - 1 + 3 - 1 + 20')
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
        // TAX-33, Phase 29: the fifteen Form 6251 Part I kinds, in the FORM'S
        // own printed order, each naming its own printed line. The same shape
        // as the Schedule 2 leaf above, and it exists for a sharper reason:
        // every one of these is an ADD-BACK, so a row that named the wrong
        // line would send a taxpayer to look for the wrong understatement.
        //
        // Hand-typed off `f6251.pdf` (2025), in printed order, and NOT derived
        // by filtering the refusal table for rows whose `line` starts with
        // "Form 6251" -- a list computed from the table under test could never
        // notice a row missing.
        //
        // Lines 2a, 2b, 2c, 2h, 2i, 2j and 2l are absent, each for its own
        // reason: 2a, 2i, 2j and 2l COMPUTE, 2b is a computed zero (see the
        // leaf below), and 2c and 2h are named by
        // `investmentInterestForm4952` and `section1202Gain`, which already
        // existed. 2j joined the computing set with `amtEstatesAndTrusts`'s
        // reclassification, and 2l with the Form 4562 wiring.
        theEighteenFormSixTwoFiveOneKindsStillRefusingNameTheirOwnPrintedLine: () => {
            /** @type {readonly (readonly [Kind, string])[]} */
            const expected = [
                ['amtDepletion', 'Form 6251 line 2d'],
                ['amtNetOperatingLossDeduction', 'Form 6251 lines 2e and 2f'],
                ['amtDispositionOfProperty', 'Form 6251 line 2k'],
                ['amtPassiveActivities', 'Form 6251 line 2m'],
                ['amtLossLimitations', 'Form 6251 line 2n'],
                ['amtCirculationCosts', 'Form 6251 line 2o'],
                ['amtLongTermContracts', 'Form 6251 line 2p'],
                ['amtMiningCosts', 'Form 6251 line 2q'],
                ['amtResearchAndExperimentalCosts', 'Form 6251 line 2r'],
                ['amtPre1987InstallmentSales', 'Form 6251 line 2s'],
                ['amtIntangibleDrillingCosts', 'Form 6251 line 2t'],
                ['amtPre1987Depreciation', 'Form 6251 line 3'],
                ['amtPollutionControlFacilities', 'Form 6251 line 3'],
                ['amtTaxShelterFarmActivities', 'Form 6251 line 3'],
                ['amtCharitableContributionsOfCertainProperty', 'Form 6251 line 3'],
                ['amtBusinessInterestLimitation', 'Form 6251 line 3'],
                ['amtNonPrincipalResidenceMortgageInterest', 'Form 6251 line 3'],
                ['amtRelatedAdjustments', 'Form 6251 line 3'],
            ]
            // FOURTEEN, not the fifteen Phase 29 wrote. `kindVocabulary` still
            // carries fifteen `amt*` kinds -- the assertion further down still
            // says so -- but one of them, `amtPrivateActivityBondInterest`, is
            // now MODELED, so it has no refusal row for this table to name.
            // The two counts measure different things and must not be unified.
            assertEq(expected.length, 18,
                'eighteen still-refusing kinds: twelve, less the coarse line-3 kind, plus the '
                + 'seven the 2026-08-18 split read off i6251.pdf pp. 8-9')
            // Every one is in the vocabulary, in the order listed -- read from
            // `kindVocabulary`, which this module does not own.
            expected
                .map(([kind]) => kindVocabulary.findIndex(candidate => candidate === kind))
                .reduce((previous, position) => {
                    assert(
                        position > previous,
                        ['a Form 6251 kind is missing from the vocabulary, or is out of printed order',
                            position, previous],
                    )
                    return position
                }, -1)
            for (const [kind, line] of expected) {
                const row = unmodeledKindRefusals.find(r => r.kind === kind)
                assert(row !== undefined, ['a Form 6251 Part I kind must refuse', kind])
                if (row === undefined) {
                    continue
                }
                assert(
                    row.line.startsWith(`${line} `),
                    ['a Form 6251 refusal row names the wrong printed line', kind, line, row.line])
                // Every one of them reaches 1040 line 17 through Schedule 2
                // line 2 -- the destination is what a reader can act on, and
                // Phase 20's own verification found that erasing a destination
                // survived an entire suite.
                assert(
                    row.line.includes('Schedule 2 line 2 -> 1040 line 17'),
                    ['a Form 6251 row must name where the understated tax would have landed',
                        kind, row.line])
                // …and each REFUSES on its own, which is the whole point of
                // giving them names.
                const outcome = classifyScope([kind])
                assert(outcome.kind === 'error', ['this Form 6251 kind must refuse', kind, outcome])
            }
            // The two Part I lines that are named by a kind which already
            // existed, rather than by one of the fifteen. Asserted here, in
            // the same leaf, so a later phase cannot quietly add a sixteenth
            // kind for one of them and give one taxpayer fact two
            // declarations.
            /** @type {readonly (readonly [Kind, string])[]} */
            const namedByAPreExistingKind = [
                ['investmentInterestForm4952', 'Form 6251 line 2c'],
                ['section1202Gain', 'Form 6251 line 2h'],
                // Line 3's SEVENTH printed heading, "Net Qualified Disaster
                // Loss" (i6251 p8). The 2026-08-18 split gave the other six
                // headings a kind each and this one none, because the standard
                // deduction it adds back is the one `netQualifiedDisasterLoss`
                // already names at 1040 line 12e. Listed here so a later phase
                // cannot quietly add a nineteenth kind for it.
                ['netQualifiedDisasterLoss', 'Form 6251 line 3'],
            ]
            for (const [kind, formLine] of namedByAPreExistingKind) {
                const row = unmodeledKindRefusals.find(r => r.kind === kind)
                assert(row !== undefined, ['expected the pre-existing kind to still refuse', kind])
                if (row === undefined) {
                    continue
                }
                assert(
                    row.line.includes(formLine),
                    ['the pre-existing row must ALSO name its Form 6251 line', kind, row.line])
            }
        },
        // Form 6251 line 2b is the ONE unmodeled-looking Part I line whose
        // zero is COMPUTED rather than refused, and this is the leaf that
        // keeps that claim from decaying into a convenient assumption. The
        // line reads a state or local tax refund off Schedule 1 line 1 or line
        // 8z, and BOTH are unreachable here for reasons that live in other
        // modules:
        //
        // - `fjs/document/1099g` refuses a present, non-zero box 2 at
        //   VALIDATION, so no stored document can put a figure on Schedule 1
        //   line 1. `fjs/return/tripwire`'s own
        //   `theRejectedFourthEntryIsUnreachableBecauseValidationRefusesIt`
        //   pins that half against the dialect itself.
        // - Schedule 1 line 8z's recovery is the
        //   `recoveriesOfAmountsDeductedInAnEarlierYear` kind, refused here.
        //   It was the coarse `otherIncome` until the 2026-08-18 split.
        //
        // The day either changes, this leaf reddens and `fjs/form6251`'s
        // line 2b stops being a computed zero.
        formSixTwoFiveOneLineTwoBIsAComputedZeroNotARefusedOne: () => {
            /** @type {readonly Kind[]} */
            const lineTwoBRestsOn = [
                'taxableStateLocalRefunds',
                // Was `otherIncome`, the coarse kind for the whole of printed
                // line 8, until the 2026-08-18 split. Printed Form 6251 line
                // 2b reads "Tax refund from Schedule 1 (Form 1040), line 1 or
                // line 8z" — and the line 8z half is specifically a RECOVERY
                // of an amount deducted in an earlier year, which is now its
                // own kind. Naming the coarse kind here was true and vague;
                // naming this one says which of line 8z's eight kinds the
                // computed zero actually rests on.
                'recoveriesOfAmountsDeductedInAnEarlierYear',
            ]
            for (const kind of lineTwoBRestsOn) {
                const outcome = classifyScope([kind])
                assert(
                    outcome.kind === 'error',
                    ['Form 6251 line 2b rests on this kind still being refused', kind, outcome])
            }
            // …and no SIXTEENTH `amt*` kind was invented for line 2b, which
            // would have been the other way to handle it and would have
            // refused every return with a state tax refund. Counted rather
            // than named, so a kind added for ANY Part I line without a leaf
            // in `theThirteenFormSixTwoFiveOneKindsStillRefusingNameTheirOwnPrintedLine`
            // reddens here too.
            assertEq(
                kindVocabulary.filter(kind => kind.startsWith('amt')).length,
                21,
                'exactly twenty-one Form 6251 Part I kinds; line 2b is not one of them')
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
        // 24a-24z block -- ten kinds of its own since the 2026-08-18 split --
        // and line 26 is the Part II total itself. A kind for any of the three
        // would be a declaration a taxpayer could never truthfully make.
        theTwentyTwoScheduleOneKindsNameTheirOwnPrintedLine: () => {
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
                ['juryDutyPayGivenToEmployer', 'Schedule 1 line 24a'],
                ['personalPropertyRentalExpenses', 'Schedule 1 line 24b'],
                ['olympicAndParalympicMedalsExclusion', 'Schedule 1 line 24c'],
                ['reforestationAmortizationAndExpenses', 'Schedule 1 line 24d'],
                ['tradeActSupplementalUnemploymentRepayment', 'Schedule 1 line 24e'],
                ['section501c18DPensionContributions', 'Schedule 1 line 24f'],
                ['chaplainSection403bContributions', 'Schedule 1 line 24g'],
                ['unlawfulDiscriminationClaimAttorneyFees', 'Schedule 1 line 24h'],
                ['irsWhistleblowerAwardAttorneyFees', 'Schedule 1 line 24i'],
                ['excessDeductionsOfSection67eExpenses', 'Schedule 1 line 24k'],
            ]
            assertEq(expected.length, 22,
                'Phase 24 produced thirteen and the 2026-08-18 split replaced the coarse '
                + 'line-24 kind with ten: 13 - 1 + 10')
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
        theTwentyNineScheduleThreeKindsNameTheirOwnPrintedLine: () => {
            /** @type {readonly (readonly [string, string, string])[]} */
            const expected = [
                ['foreignTaxCredit', 'Schedule 3 line 1', '1040 line 20'],
                ['dependentCareCredit', 'Schedule 3 line 2', '1040 line 20'],
                ['educationCredits', 'Schedule 3 line 3', '1040 line 20'],
                ['retirementSavingsContributionsCredit', 'Schedule 3 line 4', '1040 line 20'],
                ['residentialCleanEnergyCredit', 'Schedule 3 line 5a', '1040 line 20'],
                ['energyEfficientHomeImprovementCredit', 'Schedule 3 line 5b', '1040 line 20'],
                ['generalBusinessCredit', 'Schedule 3 line 6a', '1040 line 20'],
                ['priorYearMinimumTaxCredit', 'Schedule 3 line 6b', '1040 line 20'],
                ['adoptionCredit', 'Schedule 3 line 6c', '1040 line 20'],
                ['creditForTheElderlyOrDisabled', 'Schedule 3 line 6d', '1040 line 20'],
                ['newCleanVehicleCredit', 'Schedule 3 line 6f', '1040 line 20'],
                ['mortgageInterestCredit', 'Schedule 3 line 6g', '1040 line 20'],
                ['districtOfColumbiaFirstTimeHomebuyerCredit', 'Schedule 3 line 6h', '1040 line 20'],
                ['qualifiedElectricVehicleCredit', 'Schedule 3 line 6i', '1040 line 20'],
                ['alternativeFuelVehicleRefuelingPropertyCredit', 'Schedule 3 line 6j', '1040 line 20'],
                ['creditToHoldersOfTaxCreditBonds', 'Schedule 3 line 6k', '1040 line 20'],
                ['previouslyOwnedCleanVehicleCredit', 'Schedule 3 line 6m', '1040 line 20'],
                ['netPremiumTaxCredit', 'Schedule 3 line 9', '1040 line 31'],
                ['amountPaidWithExtensionRequest', 'Schedule 3 line 10', '1040 line 31'],
                ['excessSocialSecurityWithheld', 'Schedule 3 line 11', '1040 line 31'],
                ['federalFuelTaxCredit', 'Schedule 3 line 12', '1040 line 31'],
                ['form2439UndistributedCapitalGains', 'Schedule 3 line 13a', '1040 line 31'],
                ['section1341CreditForRepayment', 'Schedule 3 line 13b', '1040 line 31'],
                ['netElectivePaymentElectionAmount', 'Schedule 3 line 13c', '1040 line 31'],
                ['deferredNet965TaxLiability', 'Schedule 3 line 13d', '1040 line 31'],
                ['section960cExcessLimitationCredit', 'Schedule 3 line 13z', '1040 line 31'],
                ['usVirginIslandsTaxAllocation', 'Schedule 3 line 13z', '1040 line 31'],
                ['qualifiedFarmlandGainDeferral', 'Schedule 3 line 13z', '1040 line 31'],
                ['otherRefundableCreditsNotListed', 'Schedule 3 line 13z', '1040 line 31'],
            ]
            assertEq(expected.length, 29,
                'Phase 25 produced twelve and the 2026-08-18 split replaced both coarse '
                + 'collapsed kinds with nineteen: 12 - 2 + 11 + 8')
            assertEq(
                expected.filter(([, , destination]) => destination === '1040 line 20').length,
                17,
                'Part I has seventeen, hand-counted: lines 1, 2, 3, 4, 5a, 5b and line 6\u2019s eleven',
            )
            assertEq(
                expected.filter(([, , destination]) => destination === '1040 line 31').length,
                12,
                'Part II has twelve, hand-counted: lines 9, 10, 11, 12 and line 13\u2019s eight',
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
        // ── The 2026-08-18 split, stated INDEPENDENTLY of the table it split ──
        //
        // Eighty-four kinds replaced six, and the six were coarse in one
        // specific way: a taxpayer with a Form 1099-C and a taxpayer with an
        // Alaska Permanent Fund dividend read the IDENTICAL sentence, which
        // named neither of their documents. So the property worth proving is
        // not that each new kind refuses — the four `stillRefuse` leaves above
        // already say that — but that each refuses **differently**, naming its
        // own printed line, its own label and its own remedy.
        //
        // The eighty-four names are hand-typed here, in the printed order of
        // the six blocks, and deliberately NOT derived by filtering
        // {@link unmodeledKindRefusals} for rows added on a date or matching a
        // line prefix: a list computed from the table under test could never
        // notice a row missing, which is AGENTS.md's fourth shipped defect.
        everyKindThisSplitAddedRefusesWithItsOwnSentence: () => {
            /** @type {readonly Kind[]} */
            const added = [
                'netOperatingLossDeduction',
                'gamblingWinnings',
                'cancellationOfDebt',
                'form8853MsaAndLongTermCareIncome',
                'healthSavingsAccountIncome',
                'alaskaPermanentFundDividends',
                'juryDutyPay',
                'prizesAndAwards',
                'notForProfitActivityIncome',
                'stockOptionIncome',
                'personalPropertyRentalIncome',
                'olympicAndParalympicMedals',
                'section951Inclusion',
                'section951AInclusion',
                'excessBusinessLossAdjustment',
                'ableAccountDistributions',
                'scholarshipAndFellowshipGrants',
                'nonqualifiedDeferredCompensationPension',
                'wagesEarnedWhileIncarcerated',
                'digitalAssetOrdinaryIncome',
                'recoveriesOfAmountsDeductedInAnEarlierYear',
                'reemploymentTradeAdjustmentAssistance',
                'lossOnCorrectiveDistributionsOfExcessDeferrals',
                'insurancePolicyDividendsExceedingPremiums',
                'charitableContributionDeductionRecapture',
                'disasterReliefPayments',
                'educationSavingsAccountDistributions',
                'otherIncomeNotListed',
                'juryDutyPayGivenToEmployer',
                'personalPropertyRentalExpenses',
                'olympicAndParalympicMedalsExclusion',
                'reforestationAmortizationAndExpenses',
                'tradeActSupplementalUnemploymentRepayment',
                'section501c18DPensionContributions',
                'chaplainSection403bContributions',
                'unlawfulDiscriminationClaimAttorneyFees',
                'irsWhistleblowerAwardAttorneyFees',
                'excessDeductionsOfSection67eExpenses',
                'investmentCreditRecapture',
                'newMarketsCreditRecapture',
                'employerProvidedChildcareCreditRecapture',
                'section6418TransferRecapture',
                'federalMortgageSubsidyRecapture',
                'hsaDistributionAdditionalTax',
                'hsaIneligibleIndividualAdditionalTax',
                'archerMsaDistributionAdditionalTax',
                'medicareAdvantageMsaDistributionAdditionalTax',
                'charitableFractionalInterestRecaptureTax',
                'section409ANonqualifiedPlanTax',
                'section457ANonqualifiedPlanTax',
                'section72m5ExcessBenefitsTax',
                'goldenParachutePaymentsTax',
                'accumulationDistributionOfTrustsTax',
                'expatriatedCorporationInsiderStockCompensationExciseTax',
                'lookBackInterest',
                'nonresidentAlienNonEffectivelyConnectedIncomeTax',
                'prevailingWageAndApprenticeshipPenalties',
                'otherAdditionalTaxesNotListed',
                'generalBusinessCredit',
                'priorYearMinimumTaxCredit',
                'adoptionCredit',
                'creditForTheElderlyOrDisabled',
                'newCleanVehicleCredit',
                'mortgageInterestCredit',
                'districtOfColumbiaFirstTimeHomebuyerCredit',
                'qualifiedElectricVehicleCredit',
                'alternativeFuelVehicleRefuelingPropertyCredit',
                'creditToHoldersOfTaxCreditBonds',
                'previouslyOwnedCleanVehicleCredit',
                'form2439UndistributedCapitalGains',
                'section1341CreditForRepayment',
                'netElectivePaymentElectionAmount',
                'deferredNet965TaxLiability',
                'section960cExcessLimitationCredit',
                'usVirginIslandsTaxAllocation',
                'qualifiedFarmlandGainDeferral',
                'otherRefundableCreditsNotListed',
                'amtPre1987Depreciation',
                'amtPollutionControlFacilities',
                'amtTaxShelterFarmActivities',
                'amtCharitableContributionsOfCertainProperty',
                'amtBusinessInterestLimitation',
                'amtNonPrincipalResidenceMortgageInterest',
                'amtRelatedAdjustments',
            ]
            assertEq(added.length, 84,
                'eighty-four kinds, hand-counted off the six printed blocks: 28 + 10 + 20 + 11 + 8 + 7')
            assertEq(new Set(added).size, 84, 'and each is named once')
            const sentences = added.map(kind => {
                const outcome = classifyScope([kind])
                assert(
                    outcome.kind === 'error',
                    ['a kind this split added must refuse on its own', kind, outcome])
                const row = unmodeledKindRefusals.find(r => r.kind === kind)
                if (row === undefined) {
                    throw ['a kind this split added must carry a refusal row', kind]
                }
                // The three fields a reader can act on. AGENTS.md's own
                // Phase 20 finding is why the LINE is asserted and not only
                // the label: erasing a destination survived an entire suite
                // once, because five proofs asserted the box name and none
                // asserted where the amount would have gone.
                assert(
                    outcome.message.includes(row.line),
                    ['the refusal must name the printed line', kind, outcome.message])
                assert(
                    outcome.message.includes(row.label),
                    ['the refusal must name the label', kind, outcome.message])
                assert(
                    outcome.message.includes(row.remedy),
                    ['the refusal must name the remedy', kind, outcome.message])
                // The INFORMATIONAL part of the sentence, without the kind
                // name. **Not `outcome.message`, and the difference is the
                // whole leaf**: `scopeRefusal` interpolates `r.kind` into
                // every message, so eighty-four whole messages are distinct
                // the moment eighty-four names are — which the assertion two
                // lines above already checked. A distinctness test over the
                // messages would have been decoration that could never redden,
                // and it was written that way first (AGENTS.md, \u201ca proof is not
                // known to work until you have watched it fail\u201d).
                return `${row.line} | ${row.label} | ${row.remedy}`
            })
            // THE POINT OF THE SPLIT, in one assertion: eighty-four rows that
            // each say something different about where the money goes and what
            // would supply it. Two rows copied from one coarse row would fail
            // here even with two distinct kind names in front of them, which
            // is exactly the state the six rows this split removed were in.
            assertEq(
                new Set(sentences).size, 84,
                'no two of the eighty-four refusals may name the same line, label and remedy')
        },
        // THE CONTROL FOR THE LEAF ABOVE. A split that quietly reclassified
        // something would pass every assertion up to here: the eighty-four new
        // rows would still refuse distinctly while a SIXTY-FIFTH kind had
        // slipped into `modeledKinds`. This is the leaf that says the engine's
        // claims did not move at all.
        //
        // It asserts set EQUALITY between the two independent statements of the
        // modeled set rather than only the lengths
        // `theHandTypedListNamesEveryModeledKind` compares — a swap (one kind
        // out, one in) keeps every length identical.
        // The five printed sub-lines the 2026-08-18 split covered by EXTENDING a
        // row that already existed, rather than by adding a kind. This is the
        // leaf that keeps that decision honest in both directions.
        //
        // A later phase reading the Schedule 1 block and finding no row for
        // line 8d would naturally add one — and one taxpayer fact would then
        // have TWO declarations, which is the failure `section1202Gain`'s row
        // has guarded against since Phase 12.1 and which the Form 6251 leaf
        // above already states for its own two lines. So each pair below is
        // checked for the row that DOES name it, and for the absence of a
        // second row naming the same printed sub-line.
        theFiveSubLinesNamedByAKindThatAlreadyExisted: () => {
            /** @type {readonly (readonly [Kind, string])[]} */
            const absorbed = [
                ['medicaidWaiverPayments', 'Schedule 1 line 8s'],
                ['foreignEarnedIncomeForm2555', 'Schedule 1 line 8d'],
                ['foreignEarnedIncomeForm2555', 'Schedule 1 line 24j'],
                ['form8621', 'Schedule 2 lines 17p and 17q'],
                ['form8978', 'Schedule 3 line 6l'],
            ]
            assertEq(absorbed.length, 5,
                'five printed sub-lines are named by a kind that already existed, hand-counted')
            for (const [kind, printedLine] of absorbed) {
                const row = unmodeledKindRefusals.find(r => r.kind === kind)
                if (row === undefined) {
                    throw ['a kind that absorbed a printed sub-line must still refuse', kind]
                }
                assert(
                    row.line.includes(printedLine),
                    ['the absorbing row must name the printed sub-line it took on', kind, printedLine, row.line])
                const outcome = classifyScope([kind])
                assert(
                    outcome.kind === 'error',
                    ['an absorbing kind must still refuse on its own', kind, outcome])
                assertEq(
                    unmodeledKindRefusals.filter(r => r.line.includes(printedLine)).length,
                    1,
                    ['exactly one row may name this printed sub-line, or one taxpayer fact has two declarations',
                        printedLine],
                )
            }
            // Form 8978's THIRD destination is a write-in line that several
            // rows legitimately share, so it is checked for presence only — the
            // uniqueness assertion above would be false of it by design.
            const form8978Row = unmodeledKindRefusals.find(r => r.kind === 'form8978')
            if (form8978Row === undefined) {
                throw ['form8978 must still refuse']
            }
            assert(
                form8978Row.line.includes('Schedule 2 line 17z'),
                ['Form 8978\u2019s negative adjustment also lands on the Schedule 2 write-in line',
                    form8978Row.line])
        },
        // The three printed lines the split gave NO kind, because there is no
        // fact behind them to declare. Two are write-in lines whose entire 2025
        // instruction is "Leave line 24z blank" / "Leave line 6z blank"
        // (i1040gi pp. 100, 116) and one is reserved on the form face.
        //
        // Stated as an assertion rather than a comment because the rule for
        // every OTHER write-in line in this table is the opposite — line 8z,
        // line 17z and line 13z each carry a residual kind — so these three are
        // exactly the exceptions a later reader would "fix".
        theThreePrintedLinesWithNoFactBehindThemHaveNoKind: () => {
            const noFact = [
                'Schedule 1 line 24z',
                'Schedule 3 line 6e',
                'Schedule 3 line 6z',
            ]
            assertEq(noFact.length, 3, 'three printed lines with nothing to declare, hand-counted')
            for (const printedLine of noFact) {
                assertEq(
                    unmodeledKindRefusals.filter(r => r.line.includes(printedLine)).length,
                    0,
                    ['a printed line with no fact behind it must have no refusal row', printedLine],
                )
            }
            // The control, and it is what stops this leaf passing on a table
            // that lost every row: the three write-in lines that DO carry a
            // residual kind still do.
            const residuals = [
                ['otherIncomeNotListed', 'Schedule 1 line 8z'],
                ['otherAdditionalTaxesNotListed', 'Schedule 2 line 17z'],
                ['otherRefundableCreditsNotListed', 'Schedule 3 line 13z'],
            ]
            assertEq(residuals.length, 3, 'three write-in lines carry a residual kind, hand-counted')
            for (const [kind, printedLine] of residuals) {
                const row = unmodeledKindRefusals.find(r => r.kind === kind)
                if (row === undefined) {
                    throw ['a write-in line must keep its residual kind', kind]
                }
                assert(
                    row.line.startsWith(`${printedLine} `),
                    ['a residual kind must name its own write-in line', kind, printedLine, row.line])
            }
        },
        theSplitReclassifiedNothing: () => {
            /** @type {readonly string[]} */
            const modeledNames = modeledKinds
            // **52 until TAX-39, 53 now, and the leaf's name is still true.**
            // The split itself reclassified nothing; `fjs/form7206` then
            // reclassified exactly one kind
            // (`selfEmployedHealthInsuranceDeduction`), so what this literal
            // states is `52 + 1`. The two set comparisons below are what
            // actually carry the claim — they are set equality against
            // `everyModeledKindHandTyped`, so a kind arriving in `modeledKinds`
            // without arriving in the hand-typed list reddens here whatever
            // this number says.
            assertEq(
                modeledNames.length, 53,
                'the fifty-two the split left untouched, plus TAX-39\'s one')
            for (const kind of everyModeledKindHandTyped) {
                assert(
                    modeledNames.includes(kind),
                    ['a kind that was modeled before the split is no longer in modeledKinds', kind])
            }
            for (const kind of modeledNames) {
                assert(
                    everyModeledKindHandTyped.some(candidate => candidate === kind),
                    ['a kind became modeled in a split that was supposed to reclassify nothing', kind])
            }
            // …and none of the fifty-two acquired a refusal row beside its
            // membership, which is the other way the partition could have
            // broken while every count stayed put.
            /** @type {readonly string[]} */
            const refusedNames = unmodeledKindRefusals.map(entry => entry.kind)
            for (const kind of everyModeledKindHandTyped) {
                assert(
                    !refusedNames.includes(kind),
                    ['a modeled kind also carries a refusal row', kind])
            }
            // The six coarse names are GONE from the vocabulary, not merely
            // unused. `tsc` enforces this through `Kind` — which is why the
            // list is widened to `string` before the comparison, the same
            // device `modeledKindNames` uses — and this states it for a reader
            // who is not running the compiler.
            /** @type {readonly string[]} */
            const vocabularyNames = kindVocabulary
            const split = [
                'otherIncome',
                'otherAdjustments',
                'otherAdditionalTaxes',
                'otherNonrefundableCredits',
                'otherPaymentsAndRefundableCredits',
                'amtOtherAdjustments',
            ]
            assertEq(split.length, 6, 'six coarse kinds were split, hand-counted')
            for (const gone of split) {
                assert(
                    !vocabularyNames.includes(gone),
                    ['a coarse kind this split removed is still in the vocabulary', gone])
                assert(
                    !refusedNames.includes(gone),
                    ['a coarse kind this split removed still carries a refusal row', gone])
            }
            // The gate is still a gate in the other direction too: declaring
            // nothing computes, and so does declaring all fifty-two at once.
            // Without these two a split that made `classifyScope` refuse
            // EVERYTHING would pass every assertion above.
            assertEq(
                classifyScope([]).kind, 'ok',
                'declaring nothing must still be in scope after the split')
            assertEq(
                classifyScope(everyModeledKindHandTyped).kind, 'ok',
                'every modeled kind together must still be in scope after the split')
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
        everyModeledKindDeclaredTogetherIsInScope: () => {
            const outcome = classifyScope(everyModeledKindHandTyped)
            assertEq(outcome.kind, 'ok', ['every modeled kind must be in scope when declared together', outcome])
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
        // The Form 4562 wiring's ONE reclassified kind, alone -- every
        // reclassification since Phase 12.1 has added exactly this leaf. It is
        // the only one of the fifteen `amt*` Part I kinds that moved, so
        // `theTwelveFormSixTwoFiveOneKindsStillRefusingNameTheirOwnPrintedLine`
        // above is its other half: this one says it is in scope, that one says
        // the twelve beside it are still not.
        amtDepreciationIsInScopeAlone: () => {
            const outcome = classifyScope(['amtDepreciation'])
            assertEq(
                outcome.kind, 'ok',
                ['Form 6251 line 2l\'s kind alone must be in scope', outcome])
        },
        // **THE BOUNDARY PHASE 27 DID NOT CROSS, AND PHASE 28 DID.** This
        // leaf asserted the opposite until Phase 28: it required
        // `selfEmploymentTax`, `qualifiedBusinessIncomeDeduction` and
        // `deductiblePartOfSelfEmploymentTax` to REFUSE beside a computable
        // Schedule C, and its own comment said "the day either stops refusing
        // without Phase 28 having landed, this reddens." Phase 28 landed, so
        // the same three declarations are re-pointed to the answer that
        // replaced them — a self-employed return that declares all four kinds
        // truthfully is now IN SCOPE, which is the whole persona this phase
        // exists to unblock.
        theThreePhase28KindsBesideScheduleCAreNowInScope: () => {
            const wholeFounderReturn = classifyScope([
                'businessIncomeOrLoss',
                'selfEmploymentTax',
                'deductiblePartOfSelfEmploymentTax',
                'qualifiedBusinessIncomeDeduction',
            ])
            assertEq(
                wholeFounderReturn.kind, 'ok',
                ['a truthfully-declared self-employed return must now compute', wholeFounderReturn])
            // …and each of the three alone, which is what says the set above
            // is in scope because every member is rather than because the
            // guard stopped looking.
            /** @type {readonly Kind[]} */
            const wired = [
                'selfEmploymentTax',
                'deductiblePartOfSelfEmploymentTax',
                'qualifiedBusinessIncomeDeduction',
            ]
            assertEq(wired.length, 3, 'hand-counted: Schedule 2 line 4, Schedule 1 line 15 and 1040 line 13a')
            for (const kind of wired) {
                assertEq(classifyScope([kind]).kind, 'ok', ['must be in scope alone', kind])
            }
        },
        // …and the boundary THIS phase does not cross, stated the same way
        // Phase 27 stated its own. Three kinds arrive refused in the same
        // commit that reclassifies the three above, and every one of them is
        // a fact on a form this phase built rather than a form it did not.
        theThreeKindsPhase28AddsRefuseByName: () => {
            /** @type {readonly (readonly [Kind, string])[]} */
            const added = [
                ['churchEmployeeIncome', '§1402(g)'],
                ['selfEmploymentOptionalMethods', 'ELECTIONS'],
                ['qualifiedPubliclyTradedPartnershipIncome', 'code Z'],
            ]
            assertEq(added.length, 3, 'hand-counted: two Schedule SE facts and one Form 8995 component')
            for (const [kind, phrase] of added) {
                const outcome = classifyScope([kind])
                assert(outcome.kind === 'error', ['this kind must refuse', kind, outcome])
                assert(
                    outcome.message.includes(phrase),
                    ['the refusal must name what is actually missing', kind, phrase, outcome.message])
            }
            // …and they refuse BESIDE a computable Schedule C, which is the
            // case that matters: a founder with church employee income has a
            // Schedule C this engine computes and a Schedule SE it does not.
            assertEq(
                classifyScope(['businessIncomeOrLoss', 'churchEmployeeIncome']).kind,
                'error')
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
        uncollectedTaxOnTipsOrGroupTermLifeIsInScopeAlone: () => {
            const outcome = classifyScope(['uncollectedTaxOnTipsOrGroupTermLife'])
            assertEq(
                outcome.kind, 'ok',
                ['Schedule 2 line 13\'s kind alone must be in scope', outcome])
        },
        excessSocialSecurityWithheldIsInScopeAlone: () => {
            const outcome = classifyScope(['excessSocialSecurityWithheld'])
            assertEq(
                outcome.kind, 'ok',
                ['Schedule 3 line 11\'s kind alone must be in scope', outcome])
        },
        foreignTaxCreditIsInScopeAlone: () => {
            const outcome = classifyScope(['foreignTaxCredit'])
            assertEq(
                outcome.kind, 'ok',
                ['Schedule 3 line 1\'s kind alone must be in scope', outcome])
        },
        amountPaidWithExtensionRequestIsInScopeAlone: () => {
            const outcome = classifyScope(['amountPaidWithExtensionRequest'])
            assertEq(
                outcome.kind, 'ok',
                ['Schedule 3 line 10\'s kind alone must be in scope', outcome])
        },
        amtEstatesAndTrustsIsInScopeAlone: () => {
            const outcome = classifyScope(['amtEstatesAndTrusts'])
            assertEq(
                outcome.kind, 'ok',
                ['Form 6251 line 2j\'s kind alone must be in scope', outcome])
        },
        qualifiedReitDividendsIsInScopeAlone: () => {
            const outcome = classifyScope(['qualifiedReitDividends'])
            assertEq(
                outcome.kind, 'ok',
                ['Form 8995 line 6\'s REIT half alone must be in scope', outcome])
        },
        movingExpensesArmedForcesIsInScopeAlone: () => {
            const outcome = classifyScope(['movingExpensesArmedForces'])
            assertEq(
                outcome.kind, 'ok',
                ['Schedule 1 line 14\'s kind alone must be in scope', outcome])
        },
        // THE CONTROL for the leaf above, and it is not decorative here.
        // Form 3903's deduction turns on a §217(g) certification that lives
        // on `vnd.fjs.return_profile`, NOT on this declaration -- so being in
        // scope must not be read as being eligible. `otherEarnedIncome` is
        // the kind `fjs/form3903`'s own over-reimbursement refusal depends on
        // staying refused, and the day it computes, that refusal becomes
        // wrong; this asserts it has not moved.
        otherEarnedIncomeStillRefusesBesideIt: () => {
            const outcome = classifyScope(['otherEarnedIncome'])
            assert(
                outcome.kind === 'error',
                ['1040 line 1h must still refuse: fjs/form3903 sends its excess there', outcome])
        },
        // The control the split exists for. Reclassifying the coarse kind
        // whole would have made this pass too, and a taxpayer holding a
        // pipeline K-1 would have been told a deduction was computed for a
        // return `fjs/schedule/e` refuses outright.
        qualifiedPubliclyTradedPartnershipIncomeStillRefusesAlone: () => {
            const outcome = classifyScope(['qualifiedPubliclyTradedPartnershipIncome'])
            assert(
                outcome.kind === 'error',
                ['the PTP half must still refuse on its own', outcome])
            assert(
                outcome.message.includes('code Z'),
                ['and must name the K-1 box that refuses', outcome.message])
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
        //
        // **Phase 30 replaced line 5's single entry with its five parts**, so
        // this list is ten rather than six. `rentalRealEstate\
        // RoyaltiesPartnershipsSCorps` is gone from the vocabulary entirely —
        // a fact `tsc` enforces rather than this leaf, since `Kind` no longer
        // holds the name — and the five that stand in its place are listed
        // individually so the split cannot quietly reduce what still refuses.
        theScheduleOnePartOneKindsNoPhaseHasWiredStillRefuse: () => {
            /** @type {readonly Kind[]} */
            const stillRefused = [
                'taxableStateLocalRefunds',
                'alimonyReceived',
                'otherGainsOrLosses',
                'rentalRealEstateAndRoyalties',
                'remicResidualInterest',
                'netFarmRentalIncomeForm4835',
                'farmIncomeOrLoss',
                'netOperatingLossDeduction',
                'gamblingWinnings',
                'cancellationOfDebt',
                'form8853MsaAndLongTermCareIncome',
                'healthSavingsAccountIncome',
                'alaskaPermanentFundDividends',
                'juryDutyPay',
                'prizesAndAwards',
                'notForProfitActivityIncome',
                'stockOptionIncome',
                'personalPropertyRentalIncome',
                'olympicAndParalympicMedals',
                'section951Inclusion',
                'section951AInclusion',
                'excessBusinessLossAdjustment',
                'ableAccountDistributions',
                'scholarshipAndFellowshipGrants',
                'nonqualifiedDeferredCompensationPension',
                'wagesEarnedWhileIncarcerated',
                'digitalAssetOrdinaryIncome',
                'recoveriesOfAmountsDeductedInAnEarlierYear',
                'reemploymentTradeAdjustmentAssistance',
                'lossOnCorrectiveDistributionsOfExcessDeferrals',
                'insurancePolicyDividendsExceedingPremiums',
                'charitableContributionDeductionRecapture',
                'disasterReliefPayments',
                'educationSavingsAccountDistributions',
                'otherIncomeNotListed',
            ]
            assertEq(
                stillRefused.length,
                35,
                'six printed Part I lines Phase 27 left refused, line 5 expanded into its five '
                + 'Schedule E parts, less the one Phase 30 wired and the one TAX-35 wired, and '
                + 'the coarse line-8 kind replaced by twenty-eight: 8 - 1 + 28')
            for (const kind of stillRefused) {
                const outcome = classifyScope([kind])
                assert(
                    outcome.kind === 'error',
                    ['this Schedule 1 Part I kind must still refuse after the split', kind, outcome],
                )
            }
            // Two of the ten, each with the form it still needs — so a refusal
            // that stopped naming Schedule F or Schedule E reddens here rather
            // than only in the table loop.
            const farm = classifyScope(['farmIncomeOrLoss'])
            assert(farm.kind === 'error', ['farm income must still refuse', farm])
            assert(
                farm.message.includes('Schedule F'),
                ['the farm refusal must name Schedule F', farm.message],
            )
            const rental = classifyScope(['rentalRealEstateAndRoyalties'])
            assert(rental.kind === 'error', ['rental real estate must still refuse', rental])
            assert(
                rental.message.includes('Schedule E Part I'),
                ['the rental refusal must name Schedule E PART I, not the whole schedule', rental.message],
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
        // **`selfEmploymentTax` left this list in Phase 28** (TAX-31), which
        // wired Schedule 2 line 4 to `fjs/schedule/se`. Eleven remain, and
        // the assertions below about Form 6251 are unchanged: the AMT is
        // Phase 29's.
        theScheduleTwoKindsStillUnwiredRefuse: () => {
            /** @type {readonly Kind[]} */
            const stillRefused = [
                'cleanVehicleCreditRepayment',
                'electivePaymentElectionRecapture',
                'additionalTaxOnTaxFavoredAccounts',
                'householdEmploymentTaxes',
                'interestOnResidentialLotAndTimeshareInstallments',
                'interestOnDeferredInstallmentSaleTax',
                'lowIncomeHousingCreditRecapture',
                'investmentCreditRecapture',
                'newMarketsCreditRecapture',
                'employerProvidedChildcareCreditRecapture',
                'section6418TransferRecapture',
                'federalMortgageSubsidyRecapture',
                'hsaDistributionAdditionalTax',
                'hsaIneligibleIndividualAdditionalTax',
                'archerMsaDistributionAdditionalTax',
                'medicareAdvantageMsaDistributionAdditionalTax',
                'charitableFractionalInterestRecaptureTax',
                'section409ANonqualifiedPlanTax',
                'section457ANonqualifiedPlanTax',
                'section72m5ExcessBenefitsTax',
                'goldenParachutePaymentsTax',
                'accumulationDistributionOfTrustsTax',
                'expatriatedCorporationInsiderStockCompensationExciseTax',
                'lookBackInterest',
                'nonresidentAlienNonEffectivelyConnectedIncomeTax',
                'prevailingWageAndApprenticeshipPenalties',
                'otherAdditionalTaxesNotListed',
                'premiumTaxCreditReconciliation',
                'section965NetTaxLiabilityInstallment',
            ]
            assertEq(
                stillRefused.length, 29,
                'sixteen Schedule 2 kinds -- fourteen, less the coarse line-1 kind TAX-37 split, plus its '
                + 'three sub-line kinds -- less Phase 23\'s two, Phase 28\'s one, Phase 29\'s one, TAX-37\'s '
                + 'own line 1a and line 13, and the coarse line-17 kind replaced by twenty: 10 - 1 + 20')
            for (const kind of stillRefused) {
                const outcome = classifyScope([kind])
                assert(
                    outcome.kind === 'error',
                    ['this Schedule 2 kind must still refuse after the split', kind, outcome],
                )
            }
            // Phase 23's brief named AMT and self-employment tax
            // specifically, as the two kinds whose continued refusal proved
            // the split had named things rather than widened them. BOTH are
            // MODELED now — self-employment tax as of Phase 28,
            // `alternativeMinimumTax` as of Phase 29 — so the pair that once
            // stood for "this guard still guards something" is gone, and what
            // replaces it is stated rather than deleted.
            //
            // The ten above are what still refuses on this schedule. The AMT's
            // own assertions move to `fjs/form6251` and to
            // `theThirteenFormSixTwoFiveOneKindsStillRefusingNameTheirOwnPrintedLine`, where
            // fifteen NEW Schedule-2-line-2 kinds refuse by name — so this
            // schedule's refusal surface grew in the same phase its most
            // prominent refusal was computed away.
            assertEq(
                classifyScope(['selfEmploymentTax']).kind, 'ok',
                'self-employment tax is Schedule 2 line 4, and Phase 28 computes it')
            assertEq(
                classifyScope(['alternativeMinimumTax']).kind, 'ok',
                'the alternative minimum tax is Schedule 2 line 2, and Phase 29 computes it')
            // …and declaring it names the DECLARATION as the remedy, not a
            // form to go and find, because the engine computes it once told.
            const amt = tripwireRefusal([{
                kind: 'alternativeMinimumTax',
                evidence: 'a stored Form 3921 proves an incentive stock option exercise',
            }])
            assert(
                amt.message.includes('declare alternativeMinimumTax'),
                ['the remedy must be the declaration, not a form hunt', amt.message])
            assert(
                amt.message.includes('Form 6251'),
                ['and it must still name the form the tax is computed on', amt.message])
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
        // **`deductiblePartOfSelfEmploymentTax` left this list in Phase 28**
        // (TAX-31), which wired Schedule 1 line 15 to Schedule SE line 13.
        // **`movingExpensesArmedForces` left it beside the `fjs/schedule/1`
        // Form 3903 wiring**, in the same commit, for the same reason. Six
        // remained; the 2026-08-18 split then added ten line-24 kinds, and
        // **`selfEmployedHealthInsuranceDeduction` left beside `fjs/form7206`
        // and Schedule 1 line 17's own wiring (TAX-39)**, for the third time
        // the same reason. Fourteen remain.
        theScheduleOneKindsStillUnwiredRefuse: () => {
            /** @type {readonly Kind[]} */
            const stillRefused = [
                'reservistPerformingArtistFeeBasisExpenses',
                'selfEmployedRetirementPlans',
                'alimonyPaid',
                'archerMsaDeduction',
                'juryDutyPayGivenToEmployer',
                'personalPropertyRentalExpenses',
                'olympicAndParalympicMedalsExclusion',
                'reforestationAmortizationAndExpenses',
                'tradeActSupplementalUnemploymentRepayment',
                'section501c18DPensionContributions',
                'chaplainSection403bContributions',
                'unlawfulDiscriminationClaimAttorneyFees',
                'irsWhistleblowerAwardAttorneyFees',
                'excessDeductionsOfSection67eExpenses',
            ]
            assertEq(
                stillRefused.length, 14,
                'thirteen Schedule 1 Part II kinds, less Phase 24\'s three, Phase 28\'s one, '
                + 'TAX-39\'s line 17, lines 18 and 20, and line 14\'s own Form 3903 wiring, '
                + 'and the coarse line-24 kind replaced by ten: 6 - 1 - 1 + 10')
            for (const kind of stillRefused) {
                const outcome = classifyScope([kind])
                assert(
                    outcome.kind === 'error',
                    ['this Schedule 1 Part II kind must still refuse after the split', kind, outcome],
                )
            }
            // `iraDeduction` stood here with two assertions demanding its
            // refusal name Pub. 590-A's worksheet and its own printed line.
            // It COMPUTES now: the worksheet turned out to be three ordered
            // passes rather than the fixed point this file called it, and
            // Appendix B Worksheet 1 is `fjs/tax/ssb` run with line 20 taken
            // as zero. The kind is modeled, so the assertions are replaced by
            // the one that is still true.
            assertEq(
                classifyScope(['iraDeduction']).kind, 'ok',
                'the IRA deduction computes as of Schedule 1 line 20\'s wiring')
            // Phase 24's brief named the IRA deduction and the deductible
            // half of self-employment tax specifically. The first still
            // refuses; the second is MODELED as of Phase 28, and the
            // assertions that were paired here are re-pointed rather than
            // deleted -- **two of the three remedies below still name
            // Schedule SE as the reason they cannot be computed, and both are
            // still true for a different reason.** Pub. 560's limit and
            // §162(l)(2)(A)'s cap both need net self-employment earnings,
            // which this engine now HAS; what neither has is the plan
            // document or the premium record the worksheet also needs, and
            // those remedies say so.
            assertEq(
                classifyScope(['deductiblePartOfSelfEmploymentTax']).kind, 'ok',
                'the deductible half is Schedule 1 line 15, and Phase 28 computes it')
            // **This loop ran over TWO kinds until TAX-39 and now runs over
            // one.** Phase 28's note above said both remedies named Schedule SE
            // and that what each actually still lacked was "the plan or the
            // premium record". That was right about the retirement plan and
            // WRONG about the premiums, in the only way that matters: a premium
            // record was buildable on a dialect that already existed, and the
            // retirement plan's is not -- Pub. 560's worksheet needs which of
            // SEP, SIMPLE or qualified the contribution went to and at what
            // plan rate, which no document and no certification can supply
            // without modelling the plan itself.
            for (const kind of ['selfEmployedRetirementPlans']) {
                const narrowed = kindVocabulary.find(candidate => candidate === kind)
                assert(narrowed !== undefined, ['not a kind', kind])
                const outcome = classifyScope([narrowed])
                assert(outcome.kind === 'error', ['this one still refuses', kind, outcome])
            }
            assertEq(
                classifyScope(['selfEmployedHealthInsuranceDeduction']).kind, 'ok',
                'Schedule 1 line 17 computes as of TAX-39, through Form 7206')
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
         // **REPLACED in Phase 32 (TAX-27), which MODELED this kind.** The leaf
        // here was `theEarnedIncomeCreditRefusalNamesTheFactsThatAreMissing`,
        // and it pinned Phase 25's remedy string — the one naming the seven
        // §32 facts `vnd.fjs.return_profile` did not carry. Those facts are now
        // carried, `fjs/schedule/eic` computes the credit, and a remedy naming
        // them would be false.
        //
        // Replaced with a STRONGER statement rather than deleted, and stated
        // here so a later feedback pass does not revert it: the old leaf could
        // only assert that a refusal said the right words, and this one
        // asserts there is no refusal at all AND that the kind is where the
        // partition says it is. A deletion would have left the reclassification
        // pinned by nothing but the two hand-typed counts.
        //
        // `earnedIncomeCredit` gets no {@link modeledKindDeclarationRemedies}
        // entry, for `netInvestmentIncomeTax`'s exact reason: no tripwire
        // points at it. A tripwire would have to see a §32 fact on a stored
        // document, and every one of the ten is a taxpayer ASSERTION that
        // appears on no information return — so a row here would describe a
        // refusal nothing can raise.
        theEarnedIncomeCreditIsModeledAndNoLongerRefuses: () => {
            const outcome = classifyScope(['earnedIncomeCredit'])
            assertEq(
                outcome.kind, 'ok',
                ['§32 is computed as of Phase 32; declaring it must no longer refuse', outcome],
            )
            // The partition, both halves: in the modeled list and absent from
            // the refusal table. Asserting only the first would pass while a
            // stale refusal row sat beside it — which is exactly the state
            // `_EveryKindIsEitherModeledOrRefused` forbids at `tsc` level, and
            // this leaf is the runtime witness that the tsc property is about
            // the thing a reader thinks it is.
            assert(
                modeledKinds.some(kind => kind === 'earnedIncomeCredit'),
                'earnedIncomeCredit must be in modeledKinds',
            )
            // Widened to `string` before the comparison, deliberately: with
            // the literal union `tsc` reports TS2367 ("no overlap") and the
            // check cannot be written at all. That compile error IS the
            // stronger guarantee — a stale row would stop the build — and the
            // widening is what lets the runtime leaf state the same fact for a
            // reader who is not running the compiler. An ordinary widening
            // assignment, never a cast, the same device `modeledKindNames`
            // uses one section up.
            /** @type {readonly string[]} */
            const refusedNames = unmodeledKindRefusals.map(entry => entry.kind)
            assert(
                !refusedNames.includes('earnedIncomeCredit'),
                'earnedIncomeCredit must no longer carry a refusal row',
            )
            // The control, so this leaf cannot pass on a `classifyScope` that
            // stopped refusing anything at all: the neighbouring 1040 line 30
            // credit is still refused, and by name.
            const stillRefused = classifyScope(['refundableAdoptionCredit'])
            assert(stillRefused.kind === 'error', ['1040 line 30 must still refuse', stillRefused])
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
        theTwentyTwoScheduleThreeKindsStillWithoutAFormStillRefuse: () => {
            /** @type {readonly Kind[]} */
            const stillRefused = [
                'residentialCleanEnergyCredit',
                'energyEfficientHomeImprovementCredit',
                'generalBusinessCredit',
                'priorYearMinimumTaxCredit',
                'adoptionCredit',
                'creditForTheElderlyOrDisabled',
                'newCleanVehicleCredit',
                'mortgageInterestCredit',
                'districtOfColumbiaFirstTimeHomebuyerCredit',
                'qualifiedElectricVehicleCredit',
                'alternativeFuelVehicleRefuelingPropertyCredit',
                'creditToHoldersOfTaxCreditBonds',
                'previouslyOwnedCleanVehicleCredit',
                'federalFuelTaxCredit',
                'form2439UndistributedCapitalGains',
                'section1341CreditForRepayment',
                'netElectivePaymentElectionAmount',
                'deferredNet965TaxLiability',
                'section960cExcessLimitationCredit',
                'usVirginIslandsTaxAllocation',
                'qualifiedFarmlandGainDeferral',
                'otherRefundableCreditsNotListed',
            ]
            assertEq(stillRefused.length, 22,
                'twelve Schedule 3 kinds minus lines 1, 2, 3, 4, 9, 10 and 11, all seven now '
                + 'modeled — line 2 left this list at TAX-38 with Form 2441 — and both '
                + 'coarse collapsed kinds replaced by nineteen: 5 - 2 + 19')
            for (const kind of stillRefused) {
                const outcome = classifyScope([kind])
                assert(
                    outcome.kind === 'error',
                    ['this Schedule 3 kind must still refuse after the split', kind, outcome],
                )
            }
            // **The foreign tax credit's two assertions were HERE and are
            // gone**, not merely because the kind moved but because what they
            // asserted became wrong: they demanded that declaring
            // `foreignTaxCredit` refuse the return naming Form 1116, and
            // §904(j)'s election needs no Form 1116. The refusal that
            // replaces them is `fjs/schedule/3`'s, raised at the line with
            // the taxpayer's own total in it, and
            // `foreignTaxCreditReachesTheReturn` in `fjs/form1040/core`
            // drives it end to end. A scope refusal could never have said
            // "your $300.01 is one cent over".
            // **The net premium tax credit's three assertions were HERE and
            // are gone**, for the same reason the foreign tax credit's were:
            // they demanded that declaring `netPremiumTaxCredit` refuse the
            // return naming Form 8962, and Form 8962 is computed now. What
            // replaces them is `netPremiumTaxCreditIsInScopeAlone` below,
            // plus the nine refusals `fjs/form8962` raises AT THE FORM with
            // the taxpayer's own month and figures in the message — which a
            // scope refusal could never have said.
        },
        // TAX-37's two, each in scope ON ITS OWN. Declared separately rather
        // than together, because the failure worth catching is one of the two
        // arms being reclassified without the other: a return declaring only
        // the credit, or only the repayment, is an ordinary return and must
        // compute.
        netPremiumTaxCreditIsInScopeAlone: () => {
            assertEq(classifyScope(['netPremiumTaxCredit']).kind, 'ok')
        },
        excessAdvancePremiumTaxCreditRepaymentIsInScopeAlone: () => {
            assertEq(classifyScope(['excessAdvancePremiumTaxCreditRepayment']).kind, 'ok')
        },
        // ── TAX-38, Form 2441 ───────────────────────────────────────────
        //
        // Each half of Form 2441 is in scope on its own, which is the whole
        // reason they are two kinds: employer-provided benefits with no
        // credit is an ordinary return, and so is a credit with no benefits.
        dependentCareBenefitsIsInScopeAlone: () => {
            assertEq(classifyScope(['dependentCareBenefits']).kind, 'ok')
        },
        dependentCareCreditIsInScopeAlone: () => {
            assertEq(classifyScope(['dependentCareCredit']).kind, 'ok')
        },
        bothFormTwentyFourFortyOneHalvesTogetherAreInScope: () => {
            assertEq(
                classifyScope(['dependentCareBenefits', 'dependentCareCredit']).kind,
                'ok')
        },
        // The CONTROL: the neighbouring 1040 line 1 sub-lines and the
        // neighbouring Schedule 3 Part I credits still refuse. Without this,
        // "Form 2441 is modeled" could not be told from "1040 line 1 and
        // Schedule 3 Part I are modeled".
        theNeighbouringLineOneAndScheduleThreeKindsStillRefuse: () => {
            for (const kind of /** @type {readonly Kind[]} */ ([
                'adoptionBenefits',
                'form8919Wages',
                'otherEarnedIncome',
                'residentialCleanEnergyCredit',
            ])) {
                const outcome = classifyScope([kind])
                assert(
                    outcome.kind === 'error',
                    ['Form 2441 does not make this kind computable', kind, outcome])
            }
        },
        // ...and both together, which is what a taxpayer who does not yet
        // know which arm they are on would truthfully declare.
        bothPremiumTaxCreditArmsTogetherAreInScope: () => {
            assertEq(
                classifyScope([
                    'netPremiumTaxCredit', 'excessAdvancePremiumTaxCreditRepayment',
                ]).kind,
                'ok')
        },
        // The CONTROL, and the finding this slice recorded: the three kinds
        // that still name Schedule 2 line 1's OTHER sub-lines, and the
        // misnamed line-19 kind, all still refuse. Without this, "the premium
        // tax credit is modeled" could not be told from "Schedule 2 Part I is
        // modeled".
        theOtherPartOneRepaymentsAndTheMisnamedLineNineteenKindStillRefuse: () => {
            for (const kind of /** @type {readonly Kind[]} */ ([
                'cleanVehicleCreditRepayment',
                'electivePaymentElectionRecapture',
                'premiumTaxCreditReconciliation',
            ])) {
                const outcome = classifyScope([kind])
                assert(
                    outcome.kind === 'error',
                    ['Form 8962 does not make this kind computable', kind, outcome])
            }
            // `premiumTaxCreditReconciliation` is MISNAMED -- Schedule 2 line
            // 19 is Form 4255's net elective payment election recapture, not
            // a premium tax credit line -- and its refusal now says so, in
            // the words a reader holding the printed schedule can check.
            const misnamed = classifyScope(['premiumTaxCreditReconciliation'])
            assert(misnamed.kind === 'error', ['expected a refusal', misnamed])
            if (misnamed.kind !== 'error') {
                throw ['expected error', misnamed]
            }
            assert(
                misnamed.message.includes('Form 4255'),
                ['the corrected remedy must name the form Schedule 2 line 19 actually attaches',
                    misnamed.message])
            assert(
                misnamed.message.includes('MISNAMED'),
                ['and must say outright that the kind\u2019s own name is wrong', misnamed.message])
            assert(
                misnamed.message.includes('netPremiumTaxCredit'),
                ['and must point at the kinds that DO name the premium tax credit',
                    misnamed.message])
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
        // `refundableAdoptionCredit` (1040 line 30) is a kind that CAN. In
        // vocabulary — that is, 1040 form — order it comes AFTER
        // `additionalMedicareTax` (Schedule 2 line 11 -> 1040 line 23). Under
        // a concatenated `[...unmodeledKindRefusals, ...modeledKindDeclarationRemedies]`
        // it would come FIRST, because it lives in the first table and the
        // modeled kind is appended after the whole of it. Findings are
        // supplied here in the WRONG order too, so the leaf pins the walk
        // rather than the argument.
        //
        // **This leaf used `earnedIncomeCredit` (1040 line 27a) until Phase
        // 32, which MODELED it.** Re-pointed rather than deleted: the property
        // is about the walk and not about that kind, and any refused kind
        // after Schedule 2 line 11 in the vocabulary exhibits it. Line 30's
        // refundable adoption credit is the nearest one.
        aModeledKindIsOrderedByTheVocabularyNotByWhichTableItCameFrom: () => {
            const outcome = tripwireRefusal([
                { kind: 'refundableAdoptionCredit', evidence: 'evidence for 1040 line 30' },
                { kind: 'additionalMedicareTax', evidence: 'evidence for Schedule 2 line 11' },
            ])
            assertEq(outcome.unmodeled.length, 2, ['expected both kinds named', outcome.unmodeled])
            assertEq(
                outcome.unmodeled[0],
                'additionalMedicareTax',
                ['Schedule 2 line 11 reaches 1040 line 23, which comes before line 30', outcome.unmodeled],
            )
            assertEq(outcome.unmodeled[1], 'refundableAdoptionCredit', ['1040 line 30 comes second', outcome.unmodeled])
            // Both clauses asserted PRESENT before their positions are
            // compared, since `indexOf` returns -1 for a missing string and
            // -1 is less than everything -- the way an ordering assertion
            // passes over a message that lost half its content.
            assert(
                outcome.message.includes('evidence for Schedule 2 line 11'),
                ['the modeled kind\'s own evidence must be carried', outcome.message],
            )
            assert(
                outcome.message.includes('evidence for 1040 line 30'),
                ['the refused kind\'s own evidence must be carried', outcome.message],
            )
            assert(
                outcome.message.indexOf('evidence for Schedule 2 line 11')
                    < outcome.message.indexOf('evidence for 1040 line 30'),
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
            // `2 -> 3` is Phase 29's own `alternativeMinimumTax`.
            // `3 -> 4` is Phase 30's own `partnershipAndSCorporationIncome`.
            // `4 -> 5` is TAX-35's own `estateAndTrustIncome`.
            // `5 -> 6` is TAX-35's own `capitalGainsOrLosses`, added by the
            // passthrough-routing half: printed Schedule D lines 5 and 12
            // now read six K-1 boxes that used to refuse at storage, and a
            // filer who does not declare the kind would otherwise have those
            // boxes accepted and never read.
            const expectedDeclarationRequiredCount = 7
            assertEq(
                modeledKindDeclarationRemedies.length,
                expectedDeclarationRequiredCount,
                ['exactly six modeled kinds are declaration-required today', modeledKindDeclarationRemedies],
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
