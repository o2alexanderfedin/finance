/**
 * TAX-16's scope guard: the FROZEN modeled set, the refusal table,
 * {@link classifyScope}, and {@link scopeRefusal} — the one place a scope
 * refusal is built.
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
 * ## The partition, and why `tsc` owns it
 *
 * Every one of the fifty kinds is either in {@link modeledKinds} or carries an
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
 * @module
 */
import { assert, assertEq } from 'functionalscript/fjs/asserts/module.f.js'
import { kindVocabulary } from '../profile/module.f.js'

/** @import { Assert } from 'functionalscript/fjs/asserts/module.f.js' */
/** @import { Equal } from 'functionalscript/fjs/types/ts/module.f.js' */
/** @import { Kind } from '../profile/module.f.js' */

// ── The frozen modeled set ───────────────────────────────────────────────────

/**
 * The eighteen kinds this engine models today, each with the document it
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
 * boundary".
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
 * The thirty declared kinds this engine does not model, each naming the
 * 1040 line that cannot be computed, a human label, and the remedy — the form
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
    { kind: 'scheduleTwoTaxes', line: '1040 lines 17 and 23', label: 'additional taxes from Schedule 2', remedy: 'this coarse kind covers AMT, self-employment tax and other Schedule 2 items this engine has no dialect for (no phase yet)' },
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
 * The discriminated `kind` is `fjs/report/guard`'s `RunOutcome` shape,
 * deliberately WITHOUT its `reads` field: a scope refusal is decided before any
 * read happens, and inventing an empty `reads` would claim a run that never
 * occurred — and would collide with the one value `classifyRunOutcome` treats
 * as its own kill condition. The two guards are siblings and neither subsumes
 * the other: `classifyRunOutcome` catches "computed nothing"; this catches
 * "computed only part of the return and said nothing".
 * @typedef {{ readonly kind: 'ok' } | { readonly kind: 'error', readonly message: string, readonly unmodeled: readonly UnmodeledKind[] }} ScopeOutcome
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
 * **The ONLY place a scope refusal is built.** Plan 10-08's Schedule D Tax
 * Worksheet arm and its three line-16 wrapper arms import this function; they
 * do not construct a `{ kind: 'error' }` of their own. Mutating this one body
 * is therefore the only way to change what any call site refuses with.
 *
 * That sentence is copied from `fjs/report/guard`'s `classifyRunOutcome`
 * deliberately, and so is the reason: the zero-read kill condition once existed
 * in two places, every proof bound to the copy that did not ship, and the
 * shipped rule had no coverage at all while 258 tests were green. A second,
 * parallel scope-refusal builder would reproduce that defect exactly.
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
    return {
        kind: 'error',
        message: `scope refusal: this return declares ${entries.length} kind(s) this engine does not model, so no Form 1040 is produced; `
            + entries.map(r => `${r.kind} at ${r.line} (${r.label}): ${r.remedy}`).join(' | '),
        unmodeled: entries.map(r => r.kind),
    }
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
 * 13 Wave 3, TAX-13); `18 -> 20` is Plan 13-10's own two-kind
 * reclassification (Phase 13 Wave 4, TAX-12).
 * @type {number}
 */
const expectedModeledKindCount = 21

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
 * Plan 13-10's own two-kind reclassification.
 * @type {number}
 */
const expectedUnmodeledKindCount = 30

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
        modeledKindsIsExactlyTwenty: () => {
            assertEq(modeledKinds.length, expectedModeledKindCount)
            assertEq(new Set(modeledKinds).size, expectedModeledKindCount)
        },
        unmodeledRefusalsIsExactlyThirty: () => {
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
    },
    scope: {
        // Declaring nothing is IN SCOPE. This is the leaf that keeps the guard
        // from degenerating into "refuse anything unusual": a return with no
        // declared kinds computes a 1040 of zeros, it does not refuse.
        emptyDeclarationIsInScope: () => {
            const outcome = classifyScope([])
            assertEq(outcome.kind, 'ok', ['declaring nothing must be in scope', outcome])
        },
        // All twenty modeled kinds, hand-typed rather than read from
        // `modeledKinds`, so this leaf states independently what the engine
        // claims to be able to compute.
        allTwentyModeledKindsDeclaredTogetherAreInScope: () => {
            const outcome = classifyScope([
                'wages',
                'taxExemptInterest',
                'taxableInterest',
                'qualifiedDividends',
                'ordinaryDividends',
                'iraDistributions',
                'pensionsAndAnnuities',
                'socialSecurityBenefits',
                'capitalGainDistributions',
                'capitalGainsOrLosses',
                'unrecaptured1250Gain',
                'collectibles28RateGain',
                'itemizedDeductions',
                'seniorAndOtherScheduleOneADeductions',
                'childTaxCreditOrOtherDependents',
                'federalTaxWithheldOnW2',
                'federalTaxWithheldOn1099Int',
                'federalTaxWithheldOnOther1099',
                'estimatedTaxPayments',
                'additionalChildTaxCredit',
            ])
            assertEq(outcome.kind, 'ok', ['the twenty modeled kinds must be in scope', outcome])
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
        // Every one of the thirty refuses on its own, naming its own
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
        // `unmodeledRefusalsIsExactlyThirty`'s hand-typed count, and
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
}
