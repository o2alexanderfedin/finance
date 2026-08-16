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
 * @module
 */
import { assert, assertEq } from 'functionalscript/fjs/asserts/module.f.js'
import { kindVocabulary } from '../profile/module.f.js'

/** @import { Assert } from 'functionalscript/fjs/asserts/module.f.js' */
/** @import { Equal } from 'functionalscript/fjs/types/ts/module.f.js' */
/** @import { Kind } from '../profile/module.f.js' */

// ── The frozen modeled set ───────────────────────────────────────────────────

/**
 * The twenty-three kinds this engine models today, each with the document it
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
    'capitalGainDistributions',    // 1099-DIV box 2a                -> 1040 line 7a
    'capitalGainsOrLosses',        // Form 8949 + Schedule D          -> 1040 line 7a
    'unrecaptured1250Gain',        // 1099-DIV box 2b + Sch D worksheet -> Schedule D line 19
    'collectibles28RateGain',      // 1099-DIV box 2d + Sch D worksheet -> Schedule D line 18
    'itemizedDeductions',          // Schedule A + deductionChoice   -> 1040 line 12e
    'seniorAndOtherScheduleOneADeductions', // Schedule 1-A Parts I/V/VI -> 1040 line 13b
    'additionalMedicareTax',       // Form 8959 -> Schedule 2 line 11 -> 1040 lines 23/25c
    'netInvestmentIncomeTax',      // Form 8960 -> Schedule 2 line 12 -> 1040 line 23
    'childTaxCreditOrOtherDependents', // Schedule 8812 Part I       -> 1040 line 19
    'federalTaxWithheldOnW2',      // W-2 box 2                     -> 1040 line 25a
    'federalTaxWithheldOn1099Int', // 1099-INT box 4                -> 1040 line 25b
    'federalTaxWithheldOnOther1099', // 1099-R/1099-DIV/1099-B box 4 -> 1040 line 25b
    'estimatedTaxPayments',        // declared on the return profile -> 1040 line 26
    'additionalChildTaxCredit',    // Schedule 8812 Part II-A       -> 1040 line 28
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
 * The forty-one declared kinds this engine does not model, each naming the
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
// form. The two remaining Schedule 3 entries and the two Schedule 1 entries
// still read the way this note describes, and are the same argument waiting
// for the same treatment.
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
    { kind: 'scheduleOneAdditionalIncome', line: '1040 line 8', label: 'additional income from Schedule 1', remedy: 'this coarse kind covers many distinct Schedule 1 line items with no per-line dialect to attribute a real amount to any one of them (no phase yet)' },
    { kind: 'scheduleOneAdjustments', line: '1040 line 10', label: 'adjustments to income from Schedule 1', remedy: 'this coarse kind covers many distinct Schedule 1 line items with no per-line dialect to attribute a real amount to any one of them (no phase yet)' },
    { kind: 'netQualifiedDisasterLoss', line: '1040 line 12e', label: 'net qualified disaster loss', remedy: 'requires Form 4684 (no phase yet)' },
    { kind: 'qualifiedBusinessIncomeDeduction', line: '1040 line 13a', label: 'qualified business income deduction', remedy: 'requires Form 8995 or 8995-A (no phase yet)' },
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
    { kind: 'scheduleThreeNonrefundableCredits', line: '1040 line 20', label: 'nonrefundable credits from Schedule 3', remedy: 'this coarse kind covers many distinct Schedule 3 nonrefundable credits with no per-credit dialect to attribute a real amount to any one of them (no phase yet)' },
    { kind: 'federalTaxWithheldOnOtherForms', line: '1040 line 25c', label: 'federal income tax withheld on other forms', remedy: 'no dialect models it (no phase yet)' },
    { kind: 'earnedIncomeCredit', line: '1040 line 27a', label: 'earned income credit', remedy: 'requires Schedule EIC (no phase yet)' },
    { kind: 'americanOpportunityCredit', line: '1040 line 29', label: 'American opportunity credit', remedy: 'requires Form 8863 (no phase yet)' },
    { kind: 'refundableAdoptionCredit', line: '1040 line 30', label: 'refundable adoption credit', remedy: 'requires Form 8839 (no phase yet)' },
    { kind: 'scheduleThreeRefundableCredits', line: '1040 line 31', label: 'refundable credits from Schedule 3', remedy: 'this coarse kind covers many distinct Schedule 3 refundable credits with no per-credit dialect to attribute a real amount to any one of them (no phase yet)' },
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
 * `unemploymentCompensation`; and `21 -> 23` is Phase 23's own two-kind
 * reclassification (TAX-20/TAX-21), landed in the same commit as the
 * Schedule 2 line 11/12 wiring that makes both computable.
 * @type {number}
 */
const expectedModeledKindCount = 23

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
 * @type {number}
 */
const expectedUnmodeledKindCount = 41

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
        modeledKindsIsExactlyTwentyThree: () => {
            assertEq(modeledKinds.length, expectedModeledKindCount)
            assertEq(new Set(modeledKinds).size, expectedModeledKindCount)
        },
        unmodeledRefusalsIsExactlyFortyOne: () => {
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
        // TAX-22's split, stated INDEPENDENTLY of the table it split. The
        // fourteen kind names and the fourteen Schedule 2 line numbers are
        // hand-typed here off the printed form, in the form's own order, and
        // compared against the table — so a kind that lost its row, gained
        // the wrong line, or drifted out of Schedule 2 order names itself.
        // This is the counterweight `unmodeledRefusalsIsExactlyFortyOne`'s
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
        allTwentyThreeModeledKindsDeclaredTogetherAreInScope: () => {
            const outcome = classifyScope([
                'wages',
                'taxExemptInterest',
                'taxableInterest',
                'qualifiedDividends',
                'ordinaryDividends',
                'iraDistributions',
                'pensionsAndAnnuities',
                'socialSecurityBenefits',
                'unemploymentCompensation',
                'capitalGainDistributions',
                'capitalGainsOrLosses',
                'unrecaptured1250Gain',
                'collectibles28RateGain',
                'itemizedDeductions',
                'seniorAndOtherScheduleOneADeductions',
                'additionalMedicareTax',
                'netInvestmentIncomeTax',
                'childTaxCreditOrOtherDependents',
                'federalTaxWithheldOnW2',
                'federalTaxWithheldOn1099Int',
                'federalTaxWithheldOnOther1099',
                'estimatedTaxPayments',
                'additionalChildTaxCredit',
            ])
            assertEq(outcome.kind, 'ok', ['the twenty-three modeled kinds must be in scope', outcome])
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
        // `unmodeledRefusalsIsExactlyFortyOne`'s hand-typed count, and
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
        // stands behind it is `unmodeledRefusalsIsExactlyFortyOne`'s hand-typed
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
            const expectedDeclarationRequiredCount = 1
            assertEq(
                modeledKindDeclarationRemedies.length,
                expectedDeclarationRequiredCount,
                ['exactly one modeled kind is declaration-required today', modeledKindDeclarationRemedies],
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
