/**
 * TAX-19's computable tripwires: a table of
 * `(predicate over the SUPPLIED documents) -> (kind that MUST have been
 * declared)`, evaluated by `fjs/form1040/core` beside `classifyScope` and,
 * like it, **before any line computes**.
 *
 * ## Why this exists, and why it is NOT folded into `classifyScope`
 *
 * `fjs/return/scope` compares what the taxpayer DECLARES against what this
 * engine MODELS. That design is correct, and its reasoning — recorded at
 * length in that module's own docstring — is sound: a guard driven by CAS
 * store contents cannot work, because *"the engine never sees the documents it
 * cannot read."* Nothing here weakens it.
 *
 * But it has an uncovered failure mode, found by
 * `.planning/PERSONA-COVERAGE.md`'s persona survey ("The structural finding").
 * Some taxes are neither elective nor knowledge-dependent — they trigger on a
 * THRESHOLD, from data the engine ALREADY HOLDS:
 *
 * > A single filer with $300,000 in W-2 box 5 owes Additional Medicare Tax.
 * > Full stop. If they do not know Form 8959 exists — and most people do not —
 * > they will not declare `scheduleTwoTaxes` [renamed `additionalMedicareTax`
 * > by Phase 23's TAX-22 split], the guard stays silent, and the
 * > engine emits a confident return understating tax by roughly $900.
 *
 * The scope guard's soundness rests on the taxpayer knowing what they owe,
 * which is the thing they came to a tax engine not to have to know.
 *
 * So this module asks a DIFFERENT question with a DIFFERENT failure mode.
 * `classifyScope`: *"is what they declared computable?"* {@link
 * classifyTripwires}: *"did they fail to declare something the documents
 * PROVE?"* Two questions, two guards, **one refusal vocabulary** — every
 * refusal here is built by `fjs/return/scope`'s own `tripwireRefusal`, which
 * shares the single `ScopeError` constructor with `scopeRefusal`. This never
 * becomes a second, parallel refusal type; that is the defect AGENTS.md
 * records four shipped instances of.
 *
 * **This is not the store-driven guard that was rejected.** That one would ask
 * whether a document is ABSENT, which is unknowable — a 1099-DIV in a drawer
 * and no dividends at all produce the identical empty line. Every predicate
 * here asks only whether a document that IS PRESENT proves an obligation.
 * Absence is never evidence of anything, here or there.
 *
 * ## The table, and why each of its entries earns its place
 *
 * There are SIX as of Phase 30, and the number is deliberately not repeated
 * through this header: `expectedTripwireCount` is the one place it is written
 * down, because that one is asserted.
 *
 * 1. **W-2 box 5 above the Additional Medicare Tax threshold ->
 *    `additionalMedicareTax`.** The phase's motivating case. Box 5 is UNCAPPED
 *    (unlike box 3, which stops at the Social Security wage base), the
 *    thresholds are statutory and NOT inflation-indexed, and they live in
 *    `fjs/tax/params` with their own IRC §3101(b)(2) citation rather than as
 *    literals here — a bare threshold literal in a predicate is the same
 *    defect the repo's `year-genericity gate` exists to catch, one step
 *    removed. Summed ACROSS every W-2 supplied, because two employers each
 *    below the threshold can total above it and each employer withholds only
 *    on its own wages.
 * 2. **1099-R box 3 (capital gain) non-zero -> `form4972LumpSumDistribution`.**
 *    A non-zero box 3 means a lump-sum distribution from a qualified plan for
 *    a participant born before January 2, 1936, part of which may be taxed as
 *    capital gain on Form 4972. This engine reads box 2a into 1040 line 4b/5b
 *    and taxes the whole distribution as ordinary income, and nothing anywhere
 *    in `fjs/` reads box 3 — so the return it emits is a confident wrong
 *    answer in the OVERSTATING direction, which is still the failure TAX-16
 *    exists to prevent.
 *
 *    **This entry deliberately does NOT point at `capitalGainsOrLosses`, which
 *    is what this phase's brief specified, and the reason is on the printed
 *    form itself.** Box 3's own instruction reads *"you may be able to elect
 *    to treat this amount as a capital gain on Form 4972 (**not on Schedule
 *    D**)"* — the amount never reaches Schedule D or 1040 line 7a at all, so a
 *    refusal naming `capitalGainsOrLosses` would send the reader to the wrong
 *    form. `form4972LumpSumDistribution` is the kind the form's own
 *    instruction names, it is refused today at 1040 line 16, and its remedy
 *    already reads "requires Form 4972".
 *
 *    **The second half of this paragraph used to read "it is also not
 *    expressible", and that clause is now false and deleted.** It said
 *    `capitalGainsOrLosses` is a MODELED kind with no entry in
 *    `unmodeledKindRefusals`, so `tripwireRefusal` could name no line, label
 *    or remedy for it. Phase 23 then built `modeledKindDeclarationRemedies`
 *    for exactly that case, entry 4 below uses it, and TAX-35's entry 8 now
 *    names `capitalGainsOrLosses` itself. **The printed-form reason above is
 *    what still keeps 1099-R box 3 out of it** — a reason about where THAT
 *    amount goes, which no later phase can invalidate. A rule and the
 *    scaffolding excuse for it were written in one breath here, and only the
 *    rule survived; the excuse would have blocked a needed entry for three
 *    phases had entry 8 gone looking for permission rather than checking.
 * 3. **W-2 box 8 (allocated tips) non-zero -> `unreportedTips`.** Allocated
 *    tips are NOT included in box 1, so the wages this engine reads are short
 *    by exactly that amount; i1040gi's line 1c instruction requires including
 *    box 8 unless the taxpayer can prove smaller unreported tips, and Form
 *    4137 then computes the Social Security and Medicare tax on them. Nothing
 *    in `fjs/` reads box 8 — it is stored, exactness-checked, and silently
 *    dropped. Understating, threshold-free, and entirely knowledge-dependent
 *    on a taxpayer's part: exactly this module's shape.
 * 4. **1099-NEC box 1 (nonemployee compensation) non-zero ->
 *    `businessIncomeOrLoss`** (Phase 27, TAX-30). The clearest entry in the
 *    table, and the one whose absence would have been the worst: a stored
 *    Form 1099-NEC PROVES self-employment. The payer filed one precisely
 *    because the recipient was not an employee, so the amount is Schedule C
 *    gross receipts and nothing else. Without this row, a filer who does not
 *    declare `businessIncomeOrLoss` gets a return with box 1 nowhere on it —
 *    Schedule C line 1 never runs, Schedule 1 line 3 stays a documented zero,
 *    and 1040 line 8 is short by the whole of their business income, silently.
 *
 *    **This was the SECOND entry to point at a MODELED kind**, and for three
 *    phases the only one besides the first since Phase 23 built the mechanism.
 *    TAX-35's entry 8 (`capitalGainsOrLosses`) is the third. `businessIncomeOrLoss`
 *    is computable as of the same phase, so its remedy in
 *    `fjs/return/scope`'s `modeledKindDeclarationRemedies` says "declare it
 *    and this engine computes it" rather than "go and get a form" — see that
 *    table's own docstring, whose reasoning is `additionalMedicareTax`'s and
 *    needed no restating.
 *
 *    **It is deliberately NOT paired with a Schedule SE entry**, and Phase
 *    28 makes that decision better rather than obsolete. A 1099-NEC also
 *    proves self-employment TAX, and when this paragraph was written
 *    `selfEmploymentTax` was a scope refusal, so a second tripwire would have
 *    refused the same return twice for one fact — and, worse, a taxpayer who
 *    fixed the first by declaring `businessIncomeOrLoss` would then have been
 *    refused by the second with no way to proceed at all.
 *
 *    **That last clause is now false: `selfEmploymentTax` is MODELED** (Phase
 *    28, TAX-31), so declaring it is no longer a dead end. The entry still
 *    does not exist, for the FIRST reason alone and for a new one: Schedule 2
 *    line 4 is computed UNCONDITIONALLY, off the same Schedule SE execution
 *    that produces Schedule 1 line 15, so a filer who declares nothing at all
 *    still gets their self-employment tax. There is no silent understatement
 *    left for a tripwire to catch — which is the only thing this module
 *    exists for.
 *
 * 5. **A stored Form 3921 -> `alternativeMinimumTax`** (Phase 29, TAX-33).
 *    The sharpest predicate in this table, and the only one with no amount
 *    test at all: it asks whether the DOCUMENT exists. A Form 3921 is issued
 *    for nothing except the exercise of an incentive stock option, and
 *    §56(b)(3) makes the excess of the stock's fair market value at exercise
 *    over what was paid for it an alternative minimum taxable income
 *    preference. There is no threshold to cross and no box that could be zero
 *    in a way that matters; the only open question is the SIZE of the
 *    preference, which `fjs/form6251` computes and which it refuses by name
 *    when a box is missing rather than this predicate second-guessing it.
 *
 *    It is also the entry whose silence would be worst. An exercise-and-hold
 *    produces **no cash**: nothing was sold, no broker reported anything, and
 *    the regular tax does not know the exercise happened. A filer who does not
 *    declare `alternativeMinimumTax` would receive a confident return with no
 *    hint that a six-figure tax on income they never received is due — the
 *    exact shape of the box-5 case this module was built for, at a much larger
 *    magnitude.
 *
 *    **This is the THIRD entry to point at a MODELED kind**, so its remedy in
 *    `fjs/return/scope`'s `modeledKindDeclarationRemedies` says "declare it and
 *    this engine computes it". That remedy is unusually long, and deliberately:
 *    declaring the kind makes the tax compute AND walks the filer into a form
 *    whose Part I this engine mostly refuses, so it names both halves rather
 *    than promising more than Phase 29 delivers.
 *
 * ## The fourth entry that was specified and is NOT here, and why
 *
 * This phase's brief proposed **1099-G box 2 (state/local income tax refunds)
 * non-zero -> `scheduleOneAdditionalIncome`** (the kind Phase 27 renamed to
 * the per-line `taxableStateLocalRefunds` when it split Schedule 1 Part I),
 * and asked whether it is reachable. **It is not.** `fjs/document/1099g`'s own `checkReferences` lists
 * `box2StateOrLocalIncomeTaxRefunds` in its `unmodeledMoneyBoxes` table and
 * REFUSES any present, non-zero value at validation time — so a 1099-G that
 * would trip such a tripwire cannot be stored in CAS at all, and by the time
 * a document reaches the engine it has already passed `validate`
 * (`fjs/form1040/core`'s own `Stored<T>` docstring: nothing re-validates
 * here). A tripwire on it could never fire through the product path.
 *
 * Shipping it anyway would be the "required-red leaf that cannot redden"
 * anti-pattern this project has already hit once, so it is omitted — and
 * {@link proof.theRejectedFourthEntryIsUnreachableBecauseValidationRefusesIt}
 * records WHY as a checked claim rather than as prose. That leaf turns red the
 * day `fjs/document/1099g` stops refusing box 2, which is the day this table
 * needs a fourth entry.
 *
 * ## Every predicate is total, and absence is never a trigger
 *
 * DOC-11: an absent box is ABSENT, never zero. Every predicate below skips an
 * absent box rather than defaulting it, so a W-2 with no box 5 at all
 * contributes nothing to the sum rather than a zero that would be identical in
 * value but different in meaning. A present-but-ZERO box does not fire either
 * — a transcript printing `0.00` in an unused box is the common case, and a
 * tripwire that fired on it would refuse nearly every return, which is the
 * failure mode "a tripwire that always fires is not a tripwire" names.
 *
 * ## Two mutation findings worth keeping
 *
 * Sixteen mutations were run against this phase's code, each in its own
 * snapshot, and every one turned the suite red. Two of them found a property
 * of this code nobody had written down, so they are recorded here rather than
 * only in a report (AGENTS.md: "a surprise in either direction usually means
 * the code has a property nobody had written down"):
 *
 * - **Reading 1099-R box 2a instead of box 3 reddens FOUR PRE-EXISTING
 *   `fjs/form1040/core` proofs**, not merely this module's own two — because
 *   real retirement fixtures in that file DO carry `box2aTaxableAmount`, so a
 *   tripwire on box 2a would refuse ordinary pension and IRA returns that
 *   compute correctly today. The box choice is load-bearing against the
 *   existing fixture population, not only against this module's own; had the
 *   predicate been written one box off, the failure would have been an outage
 *   rather than a subtle wrong number.
 * - **The 1099-G finding is guarded from the other side.** Deleting
 *   `box2StateOrLocalIncomeTaxRefunds` from `fjs/document/1099g`'s
 *   `unmodeledMoneyBoxes` reddens
 *   {@link proof.theRejectedFourthEntryIsUnreachableBecauseValidationRefusesIt}
 *   — so the omission recorded above is not a claim that decays quietly. The
 *   day that validation stops refusing, this module fails and someone has to
 *   decide whether to add the fourth row.
 *
 * @module
 */
import { assert, assertEq } from 'functionalscript/fjs/asserts/module.f.mjs'
import { centsFromString } from '../../exact/module.f.js'
import { tripwireRefusal } from '../scope/module.f.js'
import { taxParamsByYear } from '../../tax/params/module.f.js'
import { dialect as w2Dialect } from '../../document/w2/module.f.js'
import { dialect as oneZeroNineNineRDialect } from '../../document/1099r/module.f.js'
import { dialect as oneZeroNineNineGDialect, validate as validate1099g } from '../../document/1099g/module.f.js'
import { dialect as oneZeroNineNineNecDialect } from '../../document/1099nec/module.f.js'
import { dialect as formThirtyNineTwentyOneDialect } from '../../document/form3921/module.f.js'
import { dialect as k1PartnershipDialect } from '../../document/k1_1065/module.f.js'
import { dialect as k1SCorporationDialect } from '../../document/k1_1120s/module.f.js'

/** @import { IndividualFilingStatus, TaxParamSet } from '../../tax/params/module.f.js' */
/** @import { Kind } from '../profile/module.f.js' */
/** @import { RefusableKind, ScopeOutcome, TripwireFinding } from '../scope/module.f.js' */
/** @import { W2 } from '../../document/w2/module.f.js' */
/** @import { OneZeroNineNineR } from '../../document/1099r/module.f.js' */
/** @import { OneZeroNineNineNec } from '../../document/1099nec/module.f.js' */
/** @import { FormThirtyNineTwentyOne } from '../../document/form3921/module.f.js' */
/** @import { K1Partnership } from '../../document/k1_1065/module.f.js' */
/** @import { K1SCorporation } from '../../document/k1_1120s/module.f.js' */
/** @import { K1EstateTrust } from '../../document/k1_1041/module.f.js' */
/** @import { RentalProperty } from '../../document/rental_property/module.f.js' */
/** @import { OneZeroNineNineB } from '../../document/1099b/module.f.js' */
/** @import { Farm } from '../../document/farm/module.f.js' */

// ── What a tripwire reads ────────────────────────────────────────────────────

/**
 * The documents a tripwire predicate may read: exactly the `Form1040Inputs`
 * fields any entry in {@link tripwires} needs, and no more.
 *
 * **Written as a structural subset rather than as `Form1040Inputs` itself**,
 * which is deliberate twice over. It states, at the type level, precisely which
 * of the engine's document lists this guard is allowed to look at — six of the
 * twenty-three `Form1040Inputs` carries as of Phase 30, and NOT a number stated
 * here in prose, because that is how this sentence came to say "eleven" while
 * the answer was twenty-two. Read the field list below; it is the statement. A
 * predicate cannot quietly start reading the return profile or the medical
 * expense records. And it keeps this module free of any dependency on
 * `fjs/form1040/core`, which imports THIS module at run time; a
 * `Form1040Inputs` parameter would make the two mutually dependent for no gain,
 * since `Form1040Inputs` is assignable to this shape structurally and `tsc`
 * checks that at the one call site.
 *
 * `documentHash` is deliberately absent from the element type. A tripwire
 * refusal carries no taxpayer data of any kind (T-10-07-04), so a predicate has
 * no legitimate use for a hash and cannot reach one to put in a message.
 * @typedef {{
 *   readonly w2s: readonly { readonly value: W2 }[],
 *   readonly retirementForms: readonly { readonly value: OneZeroNineNineR }[],
 *   readonly nonemployeeCompensationForms: readonly { readonly value: OneZeroNineNineNec }[],
 *   readonly isoExerciseForms: readonly { readonly value: FormThirtyNineTwentyOne }[],
 *   readonly partnershipK1Forms: readonly { readonly value: K1Partnership }[],
 *   readonly sCorporationK1Forms: readonly { readonly value: K1SCorporation }[],
 *   readonly estateTrustK1Forms: readonly { readonly value: K1EstateTrust }[],
 *   readonly rentalProperties: readonly { readonly value: RentalProperty }[],
 *   readonly brokerageForms: readonly { readonly value: OneZeroNineNineB }[],
 *   readonly farmForms: readonly { readonly value: Farm }[],
 * }} SuppliedDocuments
 */

/**
 * Everything a predicate is given: the year's parameters (so a threshold is
 * looked up, never written down here), the filer's status (so a per-status
 * threshold can be selected), and the documents.
 * @typedef {{
 *   readonly taxParamSet: TaxParamSet,
 *   readonly filingStatus: IndividualFilingStatus,
 *   readonly documents: SuppliedDocuments,
 * }} TripwireContext
 */

/**
 * One row of the table: the kind the documents may prove is required, the
 * compiled-in prose naming the evidence, and the predicate.
 *
 * `kind` is a {@link RefusableKind}, not a `Kind`, and `tsc` owns that
 * restriction: `fjs/return/scope`'s `tripwireRefusal` names each kind's form
 * line, human label and remedy by looking it up, so a tripwire pointing at a
 * kind neither table describes could not be described at all.
 *
 * **This used to read `UnmodeledKind`, and the sentence that followed it said
 * a kind moving to `modeledKinds` "stops this file compiling, which is the
 * right moment to decide whether its tripwire still means anything."** Phase
 * 23 was that moment for entry 3 below, and the decision was to keep the
 * tripwire: `additionalMedicareTax` became a modeled kind, and rather than
 * delete the guard, `fjs/return/scope` gained
 * `modeledKindDeclarationRemedies` so a modeled kind can still be named — with
 * a remedy that now says "declare it and this engine computes it" instead of
 * "go and get Form 8959". That table's own docstring records the reasoning in
 * full. The compile-time trip still works, one table over: a
 * declaration-required kind that is NOT modeled fails
 * `_EveryDeclarationRequiredKindIsModeled`.
 *
 * `evidence` is a compiled-in literal, never interpolated from a document. See
 * {@link proof.noTaxpayerAmountRidesOutThroughATripwireRefusal}.
 * @typedef {{
 *   readonly kind: RefusableKind,
 *   readonly evidence: string,
 *   readonly triggered: (context: TripwireContext) => boolean,
 * }} Tripwire
 */

// ── Reading a money box ──────────────────────────────────────────────────────

/**
 * One money box's cents, with DOC-11's absent-is-absent rule: a box that is not
 * there contributes nothing rather than a zero. The two produce the same
 * bigint, and that is exactly why the rule is stated here rather than assumed —
 * nothing downstream could tell them apart.
 * @type {(printed: string | undefined) => bigint}
 */
const boxCents = printed => printed === undefined ? 0n : centsFromString(printed)

/**
 * Whether a money box is PRESENT and non-zero. Re-parses through
 * `centsFromString` rather than comparing the printed string against `'0.00'`,
 * because `'0'`, `'0.00'` and `'-0.00'` are all zero and only the parse knows
 * that — the identical reasoning `fjs/document/1099g`'s own zero check records.
 * @type {(printed: string | undefined) => boolean}
 */
const boxIsNonZero = printed => printed !== undefined && centsFromString(printed) !== 0n

// ── The table ────────────────────────────────────────────────────────────────

/**
 * The tripwires, in 1040 form order. See this module's own docstring for the
 * justification of each entry and for the fourth that was rejected.
 *
 * The order here is cosmetic: {@link classifyTripwires} refuses through
 * `tripwireRefusal`, which orders what it names by walking
 * `unmodeledKindRefusals` (1040 form order) rather than by the order findings
 * arrive in. Keeping this list in the same order anyway means the two can be
 * read side by side.
 * @type {readonly Tripwire[]}
 */
export const tripwires = [
    {
        kind: 'unreportedTips',
        evidence: 'Form W-2 box 8 (allocated tips) is non-zero, and allocated tips are excluded from box 1, '
            + 'so this engine\'s wage total is short by that amount; they reach 1040 line 1c through Form 4137',
        triggered: context =>
            context.documents.w2s.some(w2 => boxIsNonZero(w2.value.box8AllocatedTips)),
    },
    {
        kind: 'dependentCareBenefits',
        evidence: 'Form W-2 box 10 (dependent care benefits) is non-zero, so §129 requires the excludable '
            + 'part to be figured on Form 2441 Part III and the REST to be reported as wages on 1040 line 1e; '
            + 'how much is excludable turns on the qualified expenses you incurred, which no information '
            + 'return reports',
        // The box that was STORED and read by nothing until TAX-38. This
        // tripwire is what keeps it from going quiet again: a taxpayer whose
        // employer funded a dependent care FSA has taxable income unless they
        // substantiate expenses against it, and the engine cannot see those
        // expenses without a `vnd.fjs.credits` record.
        triggered: context =>
            context.documents.w2s.some(w2 => boxIsNonZero(w2.value.box10DependentCareBenefits)),
    },
    {
        kind: 'form4972LumpSumDistribution',
        evidence: 'Form 1099-R box 3 (capital gain, included in box 2a) is non-zero, so this is a lump-sum '
            + 'distribution eligible for capital-gain treatment on Form 4972 (not on Schedule D), which this '
            + 'engine instead taxes in full as ordinary income at 1040 line 4b or 5b',
        triggered: context =>
            context.documents.retirementForms.some(form => boxIsNonZero(form.value.box3CapitalGain)),
    },
    {
        kind: 'additionalMedicareTax',
        evidence: 'Form W-2 box 5 (Medicare wages and tips), summed across every W-2 supplied, is above this '
            + 'filing status\'s Additional Medicare Tax threshold (IRC §3101(b)(2), not inflation-indexed), '
            + 'so Form 8959 is required and its tax reaches 1040 line 23 through Schedule 2 line 11',
        // "In excess of" is the statute's own word, so this is a STRICT
        // comparison: a filer exactly AT the threshold owes nothing and must
        // compute normally. `boundaryPair` below prices that at one cent.
        triggered: context =>
            context.documents.w2s.reduce(
                (total, w2) => total + boxCents(w2.value.box5MedicareWagesAndTips),
                0n,
            ) > centsFromString(
                context.taxParamSet.additionalMedicareTaxThreshold[context.filingStatus].amount,
            ),
    },
    {
        kind: 'alternativeMinimumTax',
        evidence: 'a stored Form 3921 reports the exercise of an incentive stock option, and '
            + '§56(b)(3) makes the excess of the stock\'s fair market value at exercise over what '
            + 'was paid for it an alternative minimum taxable income preference — tax on income '
            + 'never received, in a year the shares may not even be sellable — which reaches 1040 '
            + 'line 17 through Form 6251 line 2i and Schedule 2 line 2',
        // NO threshold, and no non-zero box test either. The other three
        // entries ask whether an amount crossed a line; this one asks only
        // whether the DOCUMENT exists, because a Form 3921 is issued for
        // nothing except an ISO exercise and an ISO exercise is a preference
        // item at any size. `fjs/form6251` refuses a form whose boxes 3, 4 or
        // 5 are missing rather than this predicate second-guessing it, so
        // "exists" is the whole question here.
        triggered: context => context.documents.isoExerciseForms.length > 0,
    },
    {
        kind: 'rentalRealEstateAndRoyalties',
        evidence: 'a stored vnd.fjs.rental_property reports non-zero rents received or royalties '
            + 'received, which is printed Schedule E Part I line 3 or line 4 — gross income under '
            + '\u00a761(a)(5), whatever the property\'s expenses turn out to be — and it reaches '
            + '1040 line 8 through printed Schedule E lines 26 and 41 and Schedule 1 line 5, none '
            + 'of which is computed for a return that does not declare it',
        // **The entry `vnd.fjs.rental_property` could not ship without.**
        // `fjs/schedule/e/part_i` runs off the stored documents, but the
        // engine's schedules are dispatched on the DECLARED kind (12.1-CONTEXT
        // Decision 1.6), so an undeclared return would carry a stored rental
        // property that no printed line ever reads -- rent sitting in the store
        // while line 26 prints a documented zero. That is a silent
        // understatement of income, which is the failure TAX-16 exists to
        // prevent, and this row is what stops it.
        //
        // A ZERO on both lines does not trigger it: a property bought in
        // December and not yet let is a real record with no income, and a
        // tripwire that fired on it would refuse a return that has nothing to
        // add. A property with expenses and no rent is exactly the case
        // `fjs/schedule/e/part_i` would refuse as a LOSS anyway, one layer in,
        // with a message naming Form 8582 -- which is a better message than
        // this one.
        triggered: context =>
            context.documents.rentalProperties.some(property =>
                boxIsNonZero(property.value.rentsReceived)
                || boxIsNonZero(property.value.royaltiesReceived)),
    },
    {
        kind: 'farmIncomeOrLoss',
        evidence: 'a stored vnd.fjs.farm reports non-zero income on one of printed Schedule F Part '
            + 'I\'s printed lines 1a through 8, which is gross income under \u00a761(a)(2), and it '
            + 'reaches 1040 line 8 through printed Schedule F lines 9 and 34 and Schedule 1 line '
            + '6 — and printed Schedule SE line 1a besides, which is self-employment tax at '
            + '15.3% of 92.35% of it — none of which is computed for a return that does not '
            + 'declare it',
        // **The entry `vnd.fjs.farm` could not ship without**, and it is the
        // rule the tenth entry's own docstring states: a dialect a filer can
        // store before anything checks that the return declares it is a dialect
        // that can go unread. `fjs/schedule/f` runs off the stored documents,
        // but the engine's schedules are dispatched on the DECLARED kind
        // (12.1-CONTEXT Decision 1.6), so an undeclared return would carry a
        // stored farm that no printed line ever reads.
        //
        // **This one understates TWO taxes rather than one**, which is why its
        // evidence names both: the income tax on 1040 line 8, and the
        // self-employment tax printed Schedule SE line 1a charges on the same
        // line 34.
        //
        // The predicate reads the SIX income fields that can stand alone, and
        // it deliberately does NOT read the three "Taxable amount" halves
        // (printed lines 3b, 5c and 6b) — each is bounded by its own gross,
        // which is already in the list, so reading both would be reading one
        // fact twice. Printed line 1b is a COST and printed line 4a is not
        // stored at all (it is computed from Forms 1099-G), so neither is here.
        //
        // A farm with every income line at ZERO does not trigger it: a farm
        // bought in December with nothing sold yet is a real record with no
        // income, and `fjs/schedule/f` would refuse it as a LOSS one layer in
        // with a message naming §461(l) — which is a better message than this
        // one.
        triggered: context =>
            context.documents.farmForms.some(farm =>
                boxIsNonZero(farm.value.salesOfPurchasedLivestockAndOtherResaleItems)
                || boxIsNonZero(farm.value.salesOfRaisedProductsAndLivestock)
                || boxIsNonZero(farm.value.cooperativeDistributions)
                || boxIsNonZero(farm.value.agriculturalProgramPaymentsNotReportedOnForm1099G)
                || boxIsNonZero(farm.value.commodityCreditCorporationLoansReportedUnderElection)
                || boxIsNonZero(farm.value.commodityCreditCorporationLoansForfeited)
                || boxIsNonZero(farm.value.cropInsuranceProceedsReceived)
                || boxIsNonZero(farm.value.cropInsuranceProceedsDeferredFromPriorYear)
                || boxIsNonZero(farm.value.customHireIncome)
                || boxIsNonZero(farm.value.otherIncome)),
    },
    {
        kind: 'businessIncomeOrLoss',
        evidence: 'a stored Form 1099-NEC reports non-zero box 1 nonemployee compensation, which is '
            + 'self-employment income by definition — the payer filed a 1099-NEC precisely because '
            + 'the recipient was not an employee — and it reaches 1040 line 8 through Schedule C '
            + 'line 31 and Schedule 1 line 3, neither of which is computed for a return that does '
            + 'not declare it',
        triggered: context =>
            context.documents.nonemployeeCompensationForms.some(
                form => boxIsNonZero(form.value.box1NonemployeeCompensation)),
    },
    {
        kind: 'partnershipAndSCorporationIncome',
        evidence: 'a stored Schedule K-1 reports non-zero box 1 ordinary business income, which is '
            + 'pass-through income from a partnership or an S corporation — the entity itself pays '
            + 'no tax on it, so the whole of the owner\'s share is taxed on the owner\'s return '
            + 'whether or not a single dollar was distributed — and it reaches 1040 line 8 through '
            + 'Schedule E Part II and Schedule 1 line 5, neither of which is computed for a return '
            + 'that does not declare it. For a GENERAL partner it also carries self-employment tax '
            + 'to 1040 line 23 through Schedule SE line 2 and Schedule 2 line 4',
        // BOTH dialects, and box 1 on each -- which is the one box the two
        // printed faces agree on. The predicate asks the same question of two
        // documents rather than one, because the tripwire's question is
        // "does a document prove this obligation" and either dialect does.
        //
        // A ZERO box 1 does not trigger it: a dormant partnership issues a
        // Schedule K-1 with nothing on it, and refusing that filer would be an
        // outage rather than a guard. `boxIsNonZero` is also what keeps a
        // negative box 1 IN scope -- a loss still requires the declaration,
        // and `fjs/schedule/e` is where it then refuses by name.
        triggered: context =>
            context.documents.partnershipK1Forms.some(
                form => boxIsNonZero(form.value.box1OrdinaryBusinessIncome))
            || context.documents.sCorporationK1Forms.some(
                form => boxIsNonZero(form.value.box1OrdinaryBusinessIncome)),
    },
    {
        kind: 'estateAndTrustIncome',
        evidence: 'a stored Schedule K-1 (Form 1041) reports non-zero box 6 ordinary business '
            + 'income, which is a beneficiary\'s share of an estate\'s or trust\'s business income '
            + '— §652(a)/§662(a) tax it to the beneficiary for the year the fiduciary\'s income was '
            + 'required to be distributed, whether or not it was actually paid over — and it '
            + 'reaches 1040 line 8 through Schedule E Part III and Schedule 1 line 5, neither of '
            + 'which is computed for a return that does not declare it',
        // A SEPARATE tripwire from `partnershipAndSCorporationIncome`, and the
        // separation is the point rather than duplication. The two declared
        // kinds are distinct, so a filer who declared the partnership one and
        // stored a Schedule K-1 (Form 1041) must still be stopped -- folding
        // box 6 into the predicate above would let that declaration cover a
        // document it does not cover, and the beneficiary's income would reach
        // line 41 undeclared.
        //
        // Box 6 rather than box 1: this printed face numbers its ordinary
        // business income SIX, and box 1 on it is interest income. Reading
        // "box 1" across three K-1 faces is exactly the collision DOC-24's
        // separate dialects exist to prevent, and it would make this predicate
        // fire on a beneficiary's interest while missing their business share.
        //
        // A ZERO box 6 does not trigger it, and a NEGATIVE one does -- the same
        // two properties `boxIsNonZero` gives the predicate above, for the same
        // reasons: a dormant trust files a Schedule K-1 with nothing on it, and
        // a loss still requires the declaration before `fjs/schedule/e`'s
        // `beneficiaryLossRefusal` can name §642(h) as the reason it stops.
        triggered: context =>
            context.documents.estateTrustK1Forms.some(
                form => boxIsNonZero(form.value.box6OrdinaryBusinessIncome)),
    },
    {
        kind: 'capitalGainsOrLosses',
        evidence: 'a stored Schedule K-1 reports a non-zero separately stated capital gain — the '
            + 'partner\'s box 8 or 9a, the shareholder\'s box 7 or 8a, or the beneficiary\'s box 3 '
            + 'or 4a — which \u00a7702(a)(1)-(2), \u00a71366(a)(1)(A) and \u00a7652(b)/\u00a7662(b) '
            + 'require the owner to take into account SEPARATELY, retaining its short-term or '
            + 'long-term character in the owner\'s hands, and it reaches 1040 line 7a through '
            + 'printed Schedule D lines 5 and 12, which are not computed for a return that does '
            + 'not declare it; OR a stored Form 1099-B reports a non-zero box 11 (aggregate '
            + 'profit or loss on regulated futures, foreign currency or section 1256 option '
            + 'contracts), which \u00a71256(a)(3) treats as 60% long-term and 40% short-term '
            + 'capital gain or loss regardless of holding period, and which reaches 1040 line 7a '
            + 'through Form 6781 lines 8 and 9 and printed Schedule D lines 4 and 11 — likewise '
            + 'not computed for a return that does not declare it',
        // **The entry TAX-35's routing half could not ship without.** Until
        // that routing, these six boxes REFUSED at storage, so the amount
        // could not reach a return at all and no tripwire was needed. Now
        // they store and compute -- but `fjs/form1040/core`'s
        // `filingScheduleD` is read VERBATIM off the declared kind and never
        // off document presence (12.1-CONTEXT.md Decision 1.6), so an
        // undeclared return would run no Schedule D and drop the gain
        // SILENTLY. Trading a loud storage refusal for a silent
        // understatement is precisely the failure TAX-16 exists to prevent,
        // and this row is what keeps the trade from happening.
        //
        // Six boxes across three faces, each read by its OWN field name.
        // "Box 3" is other net rental income on both entity faces and a
        // short-term capital gain only on the beneficiary's, so a shared
        // "box 3 is a capital gain" rule would fire on two rentals and miss
        // nothing it should have caught -- the same collision DOC-24's
        // separate dialects exist to prevent, in predicate form.
        //
        // The 28%-rate and unrecaptured-§1250 boxes are deliberately NOT
        // in this predicate: they still refuse at storage, so they can never
        // be non-zero on a stored document and a term for them would be
        // unreachable rather than merely redundant.
        //
        // A ZERO box does not trigger it and a NEGATIVE one does, for the
        // two reasons the entries above already give: a fund that closed the
        // year flat issues a Schedule K-1 with nothing on it, and a capital
        // LOSS still requires the declaration -- Schedule D line 21's
        // $3,000 cap is exactly the computation a filer would lose by not
        // declaring.
        //
        // **TAX-38 adds the 1099-B box 11 disjunct to THIS row rather than
        // adding a row.** `theTableIsExactlyElevenDistinctTripwires` (named
        // `…Ten…` when TAX-38 shipped, before the Schedule F wiring added the
        // eleventh row) requires the
        // kinds to be distinct, and that is the right rule: one kind's
        // evidence belongs in one place, so a reader who is refused sees every
        // reason at once instead of two refusals naming the same declaration.
        // The reasoning is identical to the K-1 half's — `filingScheduleD` is
        // read off the declared kind, so a futures trader who does not declare
        // `capitalGainsOrLosses` would run no Schedule D and the whole box 11
        // aggregate would vanish.
        //
        // Box 11 rather than boxes 8, 9 and 10: box 11 is the ONLY one of the
        // four that reaches a printed line (Form 6781 line 1), and a document
        // with a non-zero component and a zero aggregate is a real, filed
        // 1099-B — a trader who closed the year exactly flat — whose Schedule
        // D contribution is nothing. Firing on the components would refuse
        // that return for an amount of zero.
        //
        // Box 11 rather than box 1d: the box-1 capital-gain path already has
        // its own coverage through the K-1 half and through `fjs/form8949`'s
        // own refusals, and the printed form makes the two disjoint —
        // "This box does not include proceeds from regulated futures contracts
        // or Section 1256 option contracts."
        //
        // A ZERO box 11 does not trigger it and a NEGATIVE one does, for the
        // same two reasons: a flat year is a real filed form, and a section
        // 1256 LOSS still needs the declaration before Schedule D line 21's
        // $3,000 cap can be computed on it.
        triggered: context =>
            context.documents.partnershipK1Forms.some(
                form => boxIsNonZero(form.value.box8NetShortTermCapitalGain)
                    || boxIsNonZero(form.value.box9aNetLongTermCapitalGain))
            || context.documents.sCorporationK1Forms.some(
                form => boxIsNonZero(form.value.box7NetShortTermCapitalGain)
                    || boxIsNonZero(form.value.box8aNetLongTermCapitalGain))
            || context.documents.estateTrustK1Forms.some(
                form => boxIsNonZero(form.value.box3NetShortTermCapitalGain)
                    || boxIsNonZero(form.value.box4aNetLongTermCapitalGain))
            || context.documents.brokerageForms.some(
                form => boxIsNonZero(form.value.box11AggregateProfitOrLoss)),
    },
]

// ── The rule ─────────────────────────────────────────────────────────────────

/**
 * TAX-19, in one comparison: what the DOCUMENTS prove is required against what
 * the taxpayer DECLARED. A tripwire whose kind is already declared is silent —
 * the taxpayer knows, and `classifyScope` is the guard that then has something
 * to say about it. A tripwire whose predicate does not hold is silent. Only a
 * kind that is BOTH proven by a document AND absent from the declaration
 * refuses.
 *
 * **The silent case is the load-bearing one.** A guard that fires on every
 * return is not a guard, it is an outage; the whole value of this table is that
 * a taxpayer below every threshold gets a computed 1040 and never learns this
 * code exists.
 *
 * Returns `fjs/return/scope`'s `ScopeOutcome` — the same union `classifyScope`
 * returns, so `fjs/form1040/core` handles both arms identically and there is
 * one refusal vocabulary rather than two.
 * @type {(taxParamSet: TaxParamSet) => (filingStatus: IndividualFilingStatus) => (declaredKinds: readonly Kind[]) => (documents: SuppliedDocuments) => ScopeOutcome}
 */
export const classifyTripwires = taxParamSet => filingStatus => declaredKinds => documents => {
    /** @type {TripwireContext} */
    const context = { taxParamSet, filingStatus, documents }
    /** @type {readonly TripwireFinding[]} */
    const fired = tripwires.flatMap(tripwire =>
        declaredKinds.includes(tripwire.kind) || !tripwire.triggered(context)
            ? []
            : [{ kind: tripwire.kind, evidence: tripwire.evidence }])
    if (fired.length === 0) {
        return { kind: 'ok' }
    }
    return tripwireRefusal(fired)
}

// ── Tests ────────────────────────────────────────────────────────────────────

/**
 * TY2025's parameter set, narrowed exactly once at module scope — the same
 * `assert` path every other consumer uses, since `noUncheckedIndexedAccess`
 * makes the open year-keyed lookup yield `TaxParamSet | undefined` and a cast
 * or `!` is banned.
 */
const taxParams2025 = taxParamsByYear[2025]
assert(taxParams2025 !== undefined, 'expected TY2025 parameters to be present in taxParamsByYear')

/**
 * Independently HAND-TYPED: the number of tripwires {@link tripwires} carries
 * today. Deliberately NOT `tripwires.length` — every loop below iterates the
 * table, which is the code under test, so a row deleted would vanish from the
 * loop in the same instant (AGENTS.md's fourth shipped defect). The duplication
 * is the mechanism, not a smell.
 *
 * Phase 22 shipped THREE, not the four its brief specified: see this module's
 * own docstring for why the 1099-G box 2 entry is unreachable and omitted.
 * Phase 27 adds the fourth, and it is a different one — 1099-NEC box 1 ->
 * `businessIncomeOrLoss`. Phase 29 adds the fifth — a stored Form 3921 ->
 * `alternativeMinimumTax`, the first with no amount test at all. Phase 30 adds
 * the sixth — a stored Schedule K-1 of EITHER dialect with non-zero box 1 ->
 * `partnershipAndSCorporationIncome`, the first whose predicate reads two
 * document lists rather than one. TAX-35's routing half adds the eighth — a
 * stored Schedule K-1 of ANY of the three dialects with a non-zero separately
 * stated capital gain box -> `capitalGainsOrLosses`, the first whose predicate
 * reads all three document lists and six different box numbers.
 *
 * The Schedule E Part I wiring adds the TENTH — a stored
 * `vnd.fjs.rental_property` with non-zero rents or royalties ->
 * `rentalRealEstateAndRoyalties`. It is the first whose subject dialect ships
 * in the same commit as its tripwire, which is the order the rule asks for: a
 * dialect a filer can store before anything checks that the return declares it
 * is a dialect that can go unread.
 *
 * The Schedule F wiring adds the ELEVENTH under the same rule — a stored
 * `vnd.fjs.farm` with income on any of printed Part I's stand-alone lines ->
 * `farmIncomeOrLoss`. It is the first whose omission would understate TWO
 * taxes: the income tax on 1040 line 8 and the self-employment tax printed
 * Schedule SE line 1a charges on the same Schedule F line 34.
 * @type {number}
 */
const expectedTripwireCount = 11

/** A W-2 carrying nothing but the fields its schema requires. @type {W2} */
const bareW2 = {
    dialect: w2Dialect,
    payerTin: '11-1111111',
    recipientTin: '222-22-2222',
    accountNumber: '',
    taxYear: 2025,
    formRevision: '2025',
}

/** A 1099-R carrying nothing but the fields its schema requires. @type {OneZeroNineNineR} */
const bare1099R = {
    dialect: oneZeroNineNineRDialect,
    payerTin: '33-3333333',
    recipientTin: '222-22-2222',
    accountNumber: '',
    taxYear: 2025,
    formRevision: '2025',
}

/** A 1099-NEC carrying nothing but the fields its schema requires. @type {OneZeroNineNineNec} */
const bare1099Nec = {
    dialect: oneZeroNineNineNecDialect,
    payerTin: '44-4444444',
    recipientTin: '222-22-2222',
    accountNumber: '',
    taxYear: 2025,
    formRevision: '2025',
}

/** No documents at all — the base every fixture below widens. @type {SuppliedDocuments} */
const noDocuments = {
    w2s: [], retirementForms: [], nonemployeeCompensationForms: [], isoExerciseForms: [],
    partnershipK1Forms: [], sCorporationK1Forms: [], estateTrustK1Forms: [],
    rentalProperties: [], brokerageForms: [], farmForms: [],
}

/**
 * A 1099-B carrying nothing but the fields its schema requires — the base the
 * section 1256 leaves widen. `sourceArtifactHash` is a real cBase32 hash: this
 * dialect requires one, and a fixture that could not survive `validate` proves
 * nothing about a stored document.
 * @type {OneZeroNineNineB}
 */
const bare1099B = {
    dialect: 'vnd.fjs.1099b',
    payerTin: '55-5555555',
    recipientTin: '222-22-2222',
    accountNumber: '',
    taxYear: 2025,
    formRevision: '2025',
    sourceArtifactHash: 'bhtsw5fzcphk3hqrsyzk5wzp2ktnkkfnc8p8w6ynqxwlfa2vcrfg',
}

/** A cash-method farm with a real printed line 2. @type {Farm} */
const farm = {
    dialect: 'vnd.fjs.farm',
    recipientTin: '222-22-2222',
    accountNumber: 'FARM-0001',
    taxYear: 2025,
    principalCropOrActivity: 'corn and soybeans',
    accountingMethod: 'cash',
    materiallyParticipated: 'yes',
    investmentAtRisk: 'allAtRisk',
    salesOfRaisedProductsAndLivestock: '142600.00',
    cropInsuranceProceedsDeferredFromPriorYear: '0.00',
    entries: [],
}

/** A rental property with a real printed line 3. @type {RentalProperty} */
const rentalProperty = {
    dialect: 'vnd.fjs.rental_property',
    recipientTin: '222-22-2222',
    accountNumber: 'RENT-0001',
    taxYear: 2025,
    propertyType: 'singleFamilyResidence',
    physicalAddress: '18 Alder Street, Wells, ME 04090',
    fairRentalDays: 365,
    personalUseDays: 0,
    rentsReceived: '24000.00',
    entries: [],
}

/** A partnership Schedule K-1 with a real box 1 share. @type {K1Partnership} */
const partnershipK1 = {
    dialect: k1PartnershipDialect,
    payerTin: '33-3333333',
    recipientTin: '222-22-2222',
    accountNumber: 'PTR-0001',
    taxYear: 2025,
    formRevision: '2025',
    boxGGeneralPartnerOrLlcMemberManager: true,
    materialParticipation: 'materiallyParticipated',
    box1OrdinaryBusinessIncome: '80000.00',
    box14SelfEmploymentEarnings: [{ code: 'A', amount: '80000.00' }],
}

/** An S-corporation Schedule K-1 with the same box 1 share. @type {K1SCorporation} */
const sCorporationK1 = {
    dialect: k1SCorporationDialect,
    payerTin: '44-4444444',
    recipientTin: '222-22-2222',
    accountNumber: 'SHR-0001',
    taxYear: 2025,
    formRevision: '2025',
    materialParticipation: 'materiallyParticipated',
    box1OrdinaryBusinessIncome: '80000.00',
}

/**
 * A beneficiary's Schedule K-1 (Form 1041) with a real box 6 share. Box SIX,
 * not box 1 -- on this printed face box 1 is interest income, and the whole
 * reason DOC-24 keeps three dialects apart is that reading "box 1" across them
 * silently swaps one item for another.
 * @type {K1EstateTrust}
 */
const estateTrustK1 = {
    dialect: 'vnd.fjs.k1_1041',
    payerTin: '66-6666666',
    recipientTin: '222-22-2222',
    taxYear: 2025,
    formRevision: '2025',
    boxHDomesticBeneficiary: true,
    materialParticipation: 'materiallyParticipated',
    box6OrdinaryBusinessIncome: '80000.00',
}

/**
 * The same three faces with **no ordinary-business-income box at all** — a
 * partner or beneficiary in an investment vehicle whose whole share is
 * portfolio and capital gain (TAX-35).
 *
 * Spelled out rather than spread with `box1OrdinaryBusinessIncome: undefined`,
 * for the reason every K-1 fixture in this tree gives: a spread of `undefined`
 * leaves the KEY present, and absent versus present-but-undefined are exactly
 * the two states DOC-11 exists to keep apart.
 *
 * They exist because the capital-gain tripwire's CONTROLS cannot be built from
 * the fixtures above: those carry a non-zero box 1 (box 6 on the 1041), so the
 * `partnershipAndSCorporationIncome` and `estateAndTrustIncome` entries fire
 * and a "declared, therefore silent" leaf can never observe silence. That is
 * not a nuisance — it is the reason a control has to isolate ONE predicate.
 * @type {K1Partnership}
 */
const partnershipK1NoBusinessIncome = {
    dialect: k1PartnershipDialect,
    payerTin: '33-3333333',
    recipientTin: '222-22-2222',
    accountNumber: 'PTR-0004',
    taxYear: 2025,
    formRevision: '2025',
    boxGGeneralPartnerOrLlcMemberManager: true,
    materialParticipation: 'materiallyParticipated',
}

/** @type {K1SCorporation} */
const sCorporationK1NoBusinessIncome = {
    dialect: k1SCorporationDialect,
    payerTin: '44-4444444',
    recipientTin: '222-22-2222',
    accountNumber: 'SHR-0004',
    taxYear: 2025,
    formRevision: '2025',
    materialParticipation: 'materiallyParticipated',
}

/** @type {K1EstateTrust} */
const estateTrustK1NoBusinessIncome = {
    dialect: 'vnd.fjs.k1_1041',
    payerTin: '66-6666666',
    recipientTin: '222-22-2222',
    taxYear: 2025,
    formRevision: '2025',
    boxHDomesticBeneficiary: true,
    materialParticipation: 'materiallyParticipated',
}

/** A Form 3921 carrying the three boxes the §56(b)(3) spread reads.
 * @type {FormThirtyNineTwentyOne}
 */
const isoExercise = {
    dialect: formThirtyNineTwentyOneDialect,
    payerTin: '66-6666666',
    recipientTin: '222-22-2222',
    accountNumber: '',
    taxYear: 2025,
    formRevision: 'April 2025',
    sourceArtifactHash: 'deadbeef00112233445566778899aabbccddeeff0011223344556677889900',
    box3ExercisePricePerShare: '5.00',
    box4FairMarketValuePerShareOnExerciseDate: '105.00',
    box5NumberOfSharesTransferred: '10000',
}

/**
 * A document set holding W-2s with exactly these box-5 amounts, one per entry.
 * @type {(medicareWages: readonly string[]) => SuppliedDocuments}
 */
const w2sWithMedicareWages = medicareWages => ({
    ...noDocuments,
    w2s: medicareWages.map(amount => ({ value: { ...bareW2, box5MedicareWagesAndTips: amount } })),
})

/**
 * Runs the guard against TY2025's real parameter set.
 * @type {(filingStatus: IndividualFilingStatus) => (declaredKinds: readonly Kind[]) => (documents: SuppliedDocuments) => ScopeOutcome}
 */
const classify = filingStatus => declaredKinds => documents =>
    classifyTripwires(taxParams2025)(filingStatus)(declaredKinds)(documents)

/**
 * The hand-typed box-5 amounts that sit EXACTLY at each status's Additional
 * Medicare Tax threshold, written out here rather than read from
 * `additionalMedicareTaxThreshold` — a boundary proof whose boundary came from
 * the code under test could never notice the boundary moving. `fjs/tax/params`
 * pins these same five figures against IRC §3101(b)(2) independently; this list
 * is the second, separate statement of them, and the two must agree.
 *
 * The qualifying-surviving-spouse row is the one worth reading twice: $200,000,
 * NOT married-filing-jointly's $250,000, because a QSS return is not a JOINT
 * return.
 * @type {Record<IndividualFilingStatus, string>}
 */
const thresholdAtExactly = {
    single: '200000.00',
    marriedFilingJointly: '250000.00',
    marriedFilingSeparately: '125000.00',
    headOfHousehold: '200000.00',
    qualifyingSurvivingSpouse: '200000.00',
}

/** One cent above a hand-typed threshold. @type {Record<IndividualFilingStatus, string>} */
const thresholdPlusOneCent = {
    single: '200000.01',
    marriedFilingJointly: '250000.01',
    marriedFilingSeparately: '125000.01',
    headOfHousehold: '200000.01',
    qualifyingSurvivingSpouse: '200000.01',
}

/** Every individual filing status, hand-typed so a status dropped from
 * `fjs/tax/params`' own exported list still fails the loops below.
 * @type {readonly IndividualFilingStatus[]}
 */
const everyStatus = [
    'single',
    'marriedFilingJointly',
    'marriedFilingSeparately',
    'headOfHousehold',
    'qualifyingSurvivingSpouse',
]

export const proof = {
    // The hand-typed count, and the structural facts a loop cannot see: eleven
    // rows, eleven DISTINCT kinds, and no empty evidence string. A tripwire
    // whose evidence were blank would refuse without saying what proved it,
    // which is the silence this whole module replaces.
    //
    // This sentence said "five" while the table held eight, and the leaf was
    // named `theTableIsExactlyFiveDistinctTripwires` at the same time. Both
    // were prose about a number, and neither is what `expectedTripwireCount`
    // asserts — which is precisely why the count stayed right while its own
    // description went wrong. Corrected with the name — and renamed a second
    // time by the Schedule F wiring, whose `vnd.fjs.farm` entry is the
    // eleventh row.
    theTableIsExactlyElevenDistinctTripwires: () => {
        assertEq(tripwires.length, expectedTripwireCount)
        assertEq(new Set(tripwires.map(t => t.kind)).size, expectedTripwireCount)
        for (const tripwire of tripwires) {
            assert(tripwire.evidence.length > 0, ['a tripwire carries no evidence', tripwire.kind])
        }
    },
    // ── Entry 1: W-2 box 5 -> additionalMedicareTax ──────────────────────
    additionalMedicareTax: {
        // THE PHASE'S MOTIVATING CASE. A single filer with $300,000 in box 5
        // and no `additionalMedicareTax` declaration refuses, and the refusal names
        // the three things a reader can act on: the box that proved it, the
        // form they need, and the 1040 line it lands on. Each is asserted
        // SEPARATELY so erasing any one of the three reddens this leaf and
        // says which one went missing.
        threeHundredThousandUndeclaredRefusesNamingForm8959AndLine23: () => {
            const outcome = classify('single')(['wages'])(w2sWithMedicareWages(['300000.00']))
            assert(outcome.kind === 'error', ['a $300,000 box 5 must refuse when undeclared', outcome])
            if (outcome.kind !== 'error') {
                return
            }
            assertEq(outcome.unmodeled.length, 1, ['expected exactly one required kind', outcome.unmodeled])
            assertEq(outcome.unmodeled[0], 'additionalMedicareTax', ['expected Schedule 2 line 11 named', outcome.unmodeled])
            assert(
                outcome.message.includes('Form 8959'),
                ['the refusal must name the form the taxpayer needs', outcome.message])
            assert(
                outcome.message.includes('1040 line 23'),
                ['the refusal must name the 1040 line the tax lands on', outcome.message])
            assert(
                outcome.message.includes('box 5'),
                ['the refusal must name the box that proved it', outcome.message])
            // And the evidence must actually say WHY, not merely that a
            // threshold exists: erasing the "above ... threshold" clause
            // leaves a message that names a form for no stated reason.
            assert(
                outcome.message.includes('Additional Medicare Tax threshold'),
                ['the refusal must name what was crossed', outcome.message])
        },
        // THE NEGATIVE CONTROL, and it matters as much as the gate: a filer
        // BELOW the threshold who declared nothing about Schedule 2 computes,
        // silently and normally. Without this leaf, a guard that refused every
        // return would pass every refusal proof in this file.
        belowThresholdAndUndeclaredComputesSilently: () => {
            const outcome = classify('single')(['wages'])(w2sWithMedicareWages(['199999.99']))
            assertEq(outcome.kind, 'ok', ['a box 5 below the threshold must not refuse', outcome])
        },
        // THE BOUNDARY PAIR. The statute taxes wages "in excess of" the
        // threshold, so exactly AT it is not in excess of it. One cent apart,
        // asserted for every filing status, against hand-typed amounts —
        // this is the pair that catches `>` silently becoming `>=`.
        boundaryPair: {
            exactlyAtTheThresholdComputesForEveryStatus: () => {
                for (const status of everyStatus) {
                    const outcome = classify(status)(['wages'])(
                        w2sWithMedicareWages([thresholdAtExactly[status]]))
                    assertEq(
                        outcome.kind,
                        'ok',
                        ['exactly at the threshold is not "in excess of" it', status, outcome])
                }
            },
            oneCentAboveTheThresholdRefusesForEveryStatus: () => {
                for (const status of everyStatus) {
                    const outcome = classify(status)(['wages'])(
                        w2sWithMedicareWages([thresholdPlusOneCent[status]]))
                    assert(
                        outcome.kind === 'error',
                        ['one cent above the threshold must refuse', status, outcome])
                    if (outcome.kind === 'error') {
                        assertEq(outcome.unmodeled[0], 'additionalMedicareTax', [status, outcome.unmodeled])
                    }
                }
            },
            // The hand-typed boundaries above must be the SAME figures
            // `fjs/tax/params` stores. Stated as its own leaf so a
            // disagreement names itself rather than surfacing as a confusing
            // pair of boundary failures — and so this file's independence
            // from the parameter module is a checked correspondence rather
            // than an unverified duplicate.
            theHandTypedBoundariesAgreeWithTheStoredParameters: () => {
                for (const status of everyStatus) {
                    assertEq(
                        taxParams2025.additionalMedicareTaxThreshold[status].amount,
                        thresholdAtExactly[status],
                        ['the hand-typed boundary disagrees with the stored parameter', status])
                }
            },
        },
        // A qualifying surviving spouse's threshold is $200,000, not MFJ's
        // $250,000 — the one status where this parameter does NOT follow the
        // married-filing-jointly figure every other per-status parameter in
        // `fjs/tax/params` gives it. $220,000 is the amount that tells the two
        // apart: it refuses for QSS and computes for MFJ. If the tripwire ever
        // read MFJ's threshold for QSS, this leaf is what says so.
        aQualifyingSurvivingSpouseDoesNotGetTheJointThreshold: () => {
            const documents = w2sWithMedicareWages(['220000.00'])
            const qss = classify('qualifyingSurvivingSpouse')(['wages'])(documents)
            const mfj = classify('marriedFilingJointly')(['wages'])(documents)
            assert(qss.kind === 'error', ['$220,000 is above a QSS filer\'s $200,000 threshold', qss])
            assertEq(mfj.kind, 'ok', ['$220,000 is below a joint filer\'s $250,000 threshold', mfj])
        },
        // Summed ACROSS documents, not per document. Two employers at
        // $150,000 each withhold nothing extra — neither is above $200,000 —
        // yet the filer owes the tax on $100,000. A per-document predicate
        // would compute a silently short return here, which is precisely the
        // case this table exists for.
        twoW2sEachBelowTheThresholdStillSumAboveIt: () => {
            const outcome = classify('single')(['wages'])(
                w2sWithMedicareWages(['150000.00', '150000.00']))
            assert(outcome.kind === 'error', ['box 5 must be summed across W-2s', outcome])
            // The control, in the same leaf so the two cannot drift: the same
            // two employers at half the wages compute.
            const control = classify('single')(['wages'])(
                w2sWithMedicareWages(['99999.00', '99999.00']))
            assertEq(control.kind, 'ok', ['the same two employers below the threshold must compute', control])
        },
        // DOC-11 at the guard: a W-2 that left box 5 blank contributes
        // nothing, never a zero — and, more to the point, never blocks a
        // return. Paired with a present-but-zero box in the same leaf, since
        // the two are the same VALUE and only this assertion distinguishes
        // the intent.
        anAbsentOrZeroBoxFiveNeverFires: () => {
            const absent = classify('single')([])({ ...noDocuments, w2s: [{ value: bareW2 }] })
            assertEq(absent.kind, 'ok', ['an absent box 5 must not fire', absent])
            const zero = classify('single')([])(w2sWithMedicareWages(['0.00']))
            assertEq(zero.kind, 'ok', ['a zero box 5 must not fire', zero])
        },
        // The taxpayer who DOES know: declaring `additionalMedicareTax` silences
        // this tripwire entirely, at any wage. It does not make the return
        // computable — `classifyScope` refuses that declaration on its own,
        // one guard over — but the two guards must not both fire for one
        // fact, and this is the leaf that says the tripwire's job ends where
        // the declaration begins.
        aDeclaredScheduleTwoSilencesTheTripwire: () => {
            const outcome = classify('single')(['wages', 'additionalMedicareTax'])(
                w2sWithMedicareWages(['300000.00']))
            assertEq(outcome.kind, 'ok', ['a declared kind must not trip its own tripwire', outcome])
        },
    },
    // ── Entry 2: 1099-R box 3 -> form4972LumpSumDistribution ─────────────
    lumpSumCapitalGain: {
        // The gate and its control in one leaf: a non-zero box 3 refuses and
        // names Form 4972; the same 1099-R with a zero box 3 computes.
        aNonZeroBoxThreeRefusesNamingForm4972: () => {
            const outcome = classify('single')(['wages'])({
                ...noDocuments,
                retirementForms: [{ value: { ...bare1099R, box3CapitalGain: '5000.00' } }],
            })
            assert(outcome.kind === 'error', ['a non-zero 1099-R box 3 must refuse', outcome])
            if (outcome.kind !== 'error') {
                return
            }
            assertEq(outcome.unmodeled[0], 'form4972LumpSumDistribution', ['expected Form 4972 named', outcome.unmodeled])
            assert(
                outcome.message.includes('Form 4972'),
                ['the refusal must name the form the taxpayer needs', outcome.message])
            assert(
                outcome.message.includes('box 3'),
                ['the refusal must name the box that proved it', outcome.message])
            // The form's own instruction, carried into the message because it
            // is the half a reader would otherwise get wrong: this amount does
            // NOT go on Schedule D.
            assert(
                outcome.message.includes('not on Schedule D'),
                ['the refusal must say where the amount does NOT go', outcome.message])
        },
        // THE NEGATIVE CONTROL: an ordinary 1099-R — the overwhelmingly common
        // case, a pension or IRA distribution with no capital-gain element —
        // computes silently. A zero box 3 and an absent box 3 are both tested,
        // since they are the same value and differ only in meaning.
        anOrdinaryRetirementDistributionComputesSilently: () => {
            const absent = classify('single')(['pensionsAndAnnuities'])({
                ...noDocuments,
                retirementForms: [{ value: { ...bare1099R, box1GrossDistribution: '40000.00' } }],
            })
            assertEq(absent.kind, 'ok', ['an absent box 3 must not fire', absent])
            const zero = classify('single')(['pensionsAndAnnuities'])({
                ...noDocuments,
                retirementForms: [{ value: { ...bare1099R, box3CapitalGain: '0.00' } }],
            })
            assertEq(zero.kind, 'ok', ['a zero box 3 must not fire', zero])
        },
        // Declaring the kind silences it, exactly as on entry 1.
        aDeclaredForm4972SilencesTheTripwire: () => {
            const outcome = classify('single')(['form4972LumpSumDistribution'])({
                ...noDocuments,
                retirementForms: [{ value: { ...bare1099R, box3CapitalGain: '5000.00' } }],
            })
            assertEq(outcome.kind, 'ok', ['a declared kind must not trip its own tripwire', outcome])
        },
    },
    // ── Entry 3: W-2 box 8 -> unreportedTips ─────────────────────────────
    allocatedTips: {
        aNonZeroBoxEightRefusesNamingForm4137AndLine1c: () => {
            const outcome = classify('single')(['wages'])({
                ...noDocuments,
                w2s: [{ value: { ...bareW2, box1WagesTipsOtherCompensation: '30000.00', box8AllocatedTips: '2400.00' } }],
            })
            assert(outcome.kind === 'error', ['a non-zero W-2 box 8 must refuse', outcome])
            if (outcome.kind !== 'error') {
                return
            }
            assertEq(outcome.unmodeled[0], 'unreportedTips', ['expected unreported tips named', outcome.unmodeled])
            assert(
                outcome.message.includes('Form 4137'),
                ['the refusal must name the form the taxpayer needs', outcome.message])
            assert(
                outcome.message.includes('1040 line 1c'),
                ['the refusal must name the 1040 line the amount lands on', outcome.message])
            assert(
                outcome.message.includes('box 8'),
                ['the refusal must name the box that proved it', outcome.message])
            // The reason this understates rather than merely omits: box 8 is
            // NOT inside box 1, so the wage total this engine reads is short.
            assert(
                outcome.message.includes('excluded from box 1'),
                ['the refusal must say why the wage total is short', outcome.message])
        },
        // THE NEGATIVE CONTROL: an ordinary W-2 with wages and withholding and
        // no allocated tips — the shape of nearly every W-2 in this
        // repository's own fixtures — computes silently.
        anOrdinaryW2ComputesSilently: () => {
            const absent = classify('single')(['wages'])({
                ...noDocuments,
                w2s: [{ value: { ...bareW2, box1WagesTipsOtherCompensation: '30000.00' } }],
            })
            assertEq(absent.kind, 'ok', ['an absent box 8 must not fire', absent])
            const zero = classify('single')(['wages'])({
                ...noDocuments,
                w2s: [{ value: { ...bareW2, box8AllocatedTips: '0.00' } }],
            })
            assertEq(zero.kind, 'ok', ['a zero box 8 must not fire', zero])
        },
        aDeclaredUnreportedTipsSilencesTheTripwire: () => {
            const outcome = classify('single')(['unreportedTips'])({
                ...noDocuments,
                w2s: [{ value: { ...bareW2, box8AllocatedTips: '2400.00' } }],
            })
            assertEq(outcome.kind, 'ok', ['a declared kind must not trip its own tripwire', outcome])
        },
    },
    // ── Entry 5: a stored Form 3921 -> alternativeMinimumTax ─────────────
    incentiveStockOptionExercise: {
        // PHASE 29'S MOTIVATING CASE, and the sharpest entry in this table: a
        // stored Form 3921 does not merely SUGGEST an alternative minimum tax,
        // it is an exercise of an incentive stock option, which §56(b)(3)
        // makes a preference item outright. The only open question is the
        // size. Each of the four things a reader can act on is asserted
        // SEPARATELY, so erasing any one reddens this leaf and says which
        // went missing.
        aStoredFormThreeNineTwoOneUndeclaredRefusesNamingFormSixTwoFiveOne: () => {
            const outcome = classify('single')(['wages'])({
                ...noDocuments,
                isoExerciseForms: [{ value: isoExercise }],
            })
            assert(outcome.kind === 'error', ['a stored Form 3921 must refuse when undeclared', outcome])
            if (outcome.kind !== 'error') {
                return
            }
            assertEq(outcome.unmodeled.length, 1, ['expected exactly one required kind', outcome.unmodeled])
            assertEq(
                outcome.unmodeled[0], 'alternativeMinimumTax',
                ['expected Schedule 2 line 2 named', outcome.unmodeled])
            assert(
                outcome.message.includes('Form 6251'),
                ['the refusal must name the form the tax is computed on', outcome.message])
            assert(
                outcome.message.includes('Schedule 2 line 2'),
                ['the refusal must name the Schedule 2 line it lands on', outcome.message])
            assert(
                outcome.message.includes('1040 line 17'),
                ['and the 1040 line that reaches', outcome.message])
            assert(
                outcome.message.includes('§56(b)(3)'),
                ['the refusal must name the provision that makes it a preference', outcome.message])
            // The half a reader most needs: this is tax on income NEVER
            // RECEIVED. Without that clause the message names a form for no
            // stated reason, and the filer has no idea why a year in which
            // they sold nothing produced a tax bill.
            assert(
                outcome.message.includes('never received'),
                ['the refusal must say WHY this is surprising', outcome.message])
            // The REMEDY is a declaration, not a form hunt, because
            // `alternativeMinimumTax` is MODELED as of this phase — the third
            // kind ever to reach `modeledKindDeclarationRemedies`.
            assert(
                outcome.message.includes('declare alternativeMinimumTax'),
                ['the remedy must be the declaration', outcome.message])
        },
        // THE NEGATIVE CONTROL, and it is the overwhelmingly common return: no
        // Form 3921 at all, nothing declared, computes silently. Without this
        // leaf a predicate that fired on every return would pass the gate
        // above.
        aReturnWithNoFormThreeNineTwoOneComputesSilently: () => {
            assertEq(classify('single')(['wages'])(noDocuments).kind, 'ok')
        },
        // THE ONE ENTRY IN THIS TABLE WITH NO AMOUNT TEST, stated as its own
        // leaf because it breaks the pattern the other four follow. Every
        // other predicate here asks whether a box is present and NON-ZERO;
        // this one asks only whether the document exists. A Form 3921 with all
        // three money boxes absent still fires, and it must: the employer
        // reported an exercise to the IRS, and `fjs/form6251` is where a form
        // missing a box is refused by name rather than treated as an exercise
        // of nothing.
        aFormThreeNineTwoOneWithNoBoxesAtAllStillFires: () => {
            /** @type {FormThirtyNineTwentyOne} */
            const bare = {
                dialect: formThirtyNineTwentyOneDialect,
                payerTin: '66-6666666',
                recipientTin: '222-22-2222',
                accountNumber: '',
                taxYear: 2025,
                formRevision: 'April 2025',
                sourceArtifactHash: 'deadbeef00112233445566778899aabbccddeeff0011223344556677889900',
            }
            const outcome = classify('single')(['wages'])({
                ...noDocuments,
                isoExerciseForms: [{ value: bare }],
            })
            assert(
                outcome.kind === 'error',
                ['an exercise is a preference item at any size, including an unstated one', outcome])
        },
        // Declaring the kind silences it, exactly as on the other four
        // entries — and here that declaration also makes the return
        // COMPUTABLE, which is what the remedy promises.
        aDeclaredAlternativeMinimumTaxSilencesTheTripwire: () => {
            const outcome = classify('single')(['wages', 'alternativeMinimumTax'])({
                ...noDocuments,
                isoExerciseForms: [{ value: isoExercise }],
            })
            assertEq(outcome.kind, 'ok', ['a declared kind must not trip its own tripwire', outcome])
        },
    },
    // ── Entry 4: 1099-NEC box 1 -> businessIncomeOrLoss ──────────────────
    nonemployeeCompensation: {
        // PHASE 27'S MOTIVATING CASE, and the one the phase brief states as
        // its own criterion 3: a stored 1099-NEC with self-employment
        // undeclared must refuse, NAMING SCHEDULE C. Each of the four things
        // a reader can act on is asserted SEPARATELY, so erasing any one
        // reddens this leaf and says which went missing.
        aStored1099NecUndeclaredRefusesNamingScheduleC: () => {
            const outcome = classify('single')(['wages'])({
                ...noDocuments,
                nonemployeeCompensationForms: [
                    { value: { ...bare1099Nec, box1NonemployeeCompensation: '48000.00' } },
                ],
            })
            assert(outcome.kind === 'error', ['a stored 1099-NEC must refuse when undeclared', outcome])
            if (outcome.kind !== 'error') {
                return
            }
            assertEq(outcome.unmodeled.length, 1, ['expected exactly one required kind', outcome.unmodeled])
            assertEq(outcome.unmodeled[0], 'businessIncomeOrLoss', ['expected Schedule 1 line 3 named', outcome.unmodeled])
            assert(
                outcome.message.includes('Schedule C'),
                ['the refusal must name the form the income belongs on', outcome.message])
            assert(
                outcome.message.includes('Schedule 1 line 3'),
                ['the refusal must name the Schedule 1 line it reaches', outcome.message])
            assert(
                outcome.message.includes('box 1'),
                ['the refusal must name the box that proved it', outcome.message])
            // The REMEDY is the half that distinguishes this entry from the
            // other three: `businessIncomeOrLoss` is MODELED, so the fix is a
            // declaration rather than a form the taxpayer has to go and find.
            // A remedy that still said "requires Schedule C" would send them
            // looking for something this engine already computes.
            assert(
                outcome.message.includes('declare businessIncomeOrLoss'),
                ['the remedy must be the declaration, not a form hunt', outcome.message])
        },
        // THE NEGATIVE CONTROL: a return with no 1099-NEC at all computes,
        // and so does one whose box 1 is absent or zero. DOC-11 at the guard.
        anAbsentOrZeroBoxOneNeverFires: () => {
            const none = classify('single')(['wages'])(noDocuments)
            assertEq(none.kind, 'ok', ['no 1099-NEC must not fire', none])
            const absent = classify('single')(['wages'])({
                ...noDocuments,
                nonemployeeCompensationForms: [{ value: bare1099Nec }],
            })
            assertEq(absent.kind, 'ok', ['an absent box 1 must not fire', absent])
            const zero = classify('single')(['wages'])({
                ...noDocuments,
                nonemployeeCompensationForms: [
                    { value: { ...bare1099Nec, box1NonemployeeCompensation: '0.00' } },
                ],
            })
            assertEq(zero.kind, 'ok', ['a zero box 1 must not fire', zero])
        },
        // A 1099-NEC carrying ONLY backup withholding — box 4 with no box 1 —
        // is a real, if unusual, document, and it must NOT fire: box 4 is a
        // payment, not income, and it reaches 1040 line 25b whether or not a
        // Schedule C exists. A predicate written against the wrong box would
        // refuse this return and no other leaf here would notice.
        aFormWithOnlyBoxFourDoesNotFire: () => {
            const outcome = classify('single')(['wages'])({
                ...noDocuments,
                nonemployeeCompensationForms: [
                    { value: { ...bare1099Nec, box4FederalIncomeTaxWithheld: '1200.00' } },
                ],
            })
            assertEq(outcome.kind, 'ok', ['box 4 alone must not fire the box-1 tripwire', outcome])
        },
        // Declaring the kind silences it, exactly as on the other three
        // entries — and here that declaration also makes the return
        // COMPUTABLE, which is what the remedy promises.
        aDeclaredBusinessIncomeSilencesTheTripwire: () => {
            const outcome = classify('single')(['wages', 'businessIncomeOrLoss'])({
                ...noDocuments,
                nonemployeeCompensationForms: [
                    { value: { ...bare1099Nec, box1NonemployeeCompensation: '48000.00' } },
                ],
            })
            assertEq(outcome.kind, 'ok', ['a declared kind must not trip its own tripwire', outcome])
        },
    },
    // ── Entry 10: vnd.fjs.rental_property -> rentalRealEstateAndRoyalties ──
    //
    // A landlord stores a property record and does not know printed Schedule E
    // Part I has to be declared. Undeclared, the engine would emit a confident
    // 1040 short by the whole of the rent, with the document sitting in the
    // store unread — which is the exact silent understatement this table
    // exists to stop.
    rentalProperty: {
        aStoredRentalPropertyWithRentRefusesWhenUndeclared: () => {
            const outcome = classify('single')(['wages'])({
                ...noDocuments,
                rentalProperties: [{ value: rentalProperty }],
            })
            assert(outcome.kind === 'error', ['a stored rental property must refuse when undeclared', outcome])
            if (outcome.kind !== 'error') {
                return
            }
            assertEq(outcome.unmodeled.length, 1, ['expected exactly one required kind', outcome.unmodeled])
            assertEq(
                outcome.unmodeled[0],
                'rentalRealEstateAndRoyalties',
                ['expected Schedule E Part I named', outcome.unmodeled])
            assert(
                outcome.message.includes('Schedule E'),
                ['the refusal must name the schedule the income belongs on', outcome.message])
            assert(
                outcome.message.includes('Schedule 1 line 5'),
                ['the refusal must name the Schedule 1 line it reaches', outcome.message])
            assert(
                outcome.message.includes('line 3'),
                ['the refusal must name the printed line that proved it', outcome.message])
            // The REMEDY: the kind is MODELED, so the fix is a declaration
            // rather than a form the taxpayer has to go and find.
            assert(
                outcome.message.includes('declare rentalRealEstateAndRoyalties'),
                ['the remedy must be the declaration, not a form hunt', outcome.message])
            // And the remedy must say where Part I STOPS, or a filer reads it
            // as a promise it does not make.
            assert(
                outcome.message.includes('Form 8582'),
                ['the remedy must name the loss limitation it cannot compute', outcome.message])
        },
        // A ROYALTY fires it too, through the OTHER printed line. A predicate
        // written against `rentsReceived` alone would miss every royalty
        // record, and nothing else here would notice.
        aRoyaltyFiresItThroughPrintedLineFour: () => {
            const outcome = classify('single')(['wages'])({
                ...noDocuments,
                rentalProperties: [{
                    value: {
                        ...rentalProperty,
                        accountNumber: 'ROY-0001',
                        propertyType: 'royalties',
                        physicalAddress: undefined,
                        fairRentalDays: undefined,
                        personalUseDays: undefined,
                        rentsReceived: undefined,
                        royaltiesReceived: '3200.00',
                    },
                }],
            })
            assert(outcome.kind === 'error', ['a stored royalty must refuse when undeclared', outcome])
            if (outcome.kind !== 'error') {
                return
            }
            assertEq(outcome.unmodeled[0], 'rentalRealEstateAndRoyalties', outcome.unmodeled)
        },
        // THE NEGATIVE CONTROL: no rental property at all, and a property
        // whose rents are zero. A December purchase not yet let is a real
        // record with nothing to add, and a tripwire that fired on it would
        // refuse a return that has no rental income.
        anAbsentOrZeroRentNeverFires: () => {
            const none = classify('single')(['wages'])(noDocuments)
            assertEq(none.kind, 'ok', ['no rental property must not fire', none])
            const zero = classify('single')(['wages'])({
                ...noDocuments,
                rentalProperties: [{ value: { ...rentalProperty, rentsReceived: '0.00' } }],
            })
            assertEq(zero.kind, 'ok', ['a zero line 3 must not fire', zero])
        },
        aDeclaredRentalSilencesTheTripwire: () => {
            const outcome = classify('single')(['wages', 'rentalRealEstateAndRoyalties'])({
                ...noDocuments,
                rentalProperties: [{ value: rentalProperty }],
            })
            assertEq(outcome.kind, 'ok', ['a declared kind must not trip its own tripwire', outcome])
        },
    },
    // ── Entry 11: vnd.fjs.farm -> farmIncomeOrLoss ─────────────────────────
    //
    // A farmer stores a farm record and does not know printed Schedule F has to
    // be declared. Undeclared, the engine would emit a confident 1040 short by
    // the whole of the farm profit AND by the self-employment tax on it, with
    // the document sitting in the store unread.
    farm: {
        aStoredFarmWithIncomeRefusesWhenUndeclared: () => {
            const outcome = classify('single')(['wages'])({
                ...noDocuments,
                farmForms: [{ value: farm }],
            })
            assert(outcome.kind === 'error', ['a stored farm must refuse when undeclared', outcome])
            if (outcome.kind !== 'error') {
                return
            }
            assertEq(outcome.unmodeled.length, 1, ['expected exactly one required kind', outcome.unmodeled])
            assertEq(
                outcome.unmodeled[0],
                'farmIncomeOrLoss',
                ['expected Schedule F named', outcome.unmodeled])
            assert(
                outcome.message.includes('Schedule F'),
                ['the refusal must name the schedule the income belongs on', outcome.message])
            assert(
                outcome.message.includes('Schedule 1 line 6'),
                ['the refusal must name the Schedule 1 line it reaches', outcome.message])
            // ★ **THE SECOND TAX.** This entry is the only one whose omission
            // understates TWO taxes, and the evidence has to say so or a filer
            // reads the refusal as being about income tax alone.
            assert(
                outcome.message.includes('Schedule SE line 1a'),
                ['the refusal must name the self-employment tax too', outcome.message])
            assert(
                outcome.message.includes('15.3%'),
                ['and the rate, which is the part a filer can price', outcome.message])
            // The REMEDY: the kind is MODELED, so the fix is a declaration
            // rather than a form the taxpayer has to go and find.
            assert(
                outcome.message.includes('declare farmIncomeOrLoss'),
                ['the remedy must be the declaration, not a form hunt', outcome.message])
            // And the remedy must say where Schedule F STOPS, or a filer reads
            // it as a promise it does not make.
            assert(
                outcome.message.includes('§461(l)'),
                ['the remedy must name the loss limitation it cannot compute', outcome.message])
            assert(
                outcome.message.includes('line 45'),
                ['and the printed line the accrual method refuses at', outcome.message])
        },
        /**
         * ★ **EVERY ONE OF THE TEN INCOME FIELDS FIRES IT, ONE AT A TIME.**
         * A predicate written against printed line 2 alone would miss a farm
         * whose whole income is a crop insurance payment, and nothing else here
         * would notice. The count is hand-typed beside the list for the reason
         * AGENTS.md gives: a field silently dropped from the disjunction would
         * otherwise just make this loop one iteration shorter.
         */
        everyPrintedIncomeFieldFiresItOnItsOwn: () => {
            /** @type {readonly string[]} */
            const fields = [
                'salesOfPurchasedLivestockAndOtherResaleItems',
                'salesOfRaisedProductsAndLivestock',
                'cooperativeDistributions',
                'agriculturalProgramPaymentsNotReportedOnForm1099G',
                'commodityCreditCorporationLoansReportedUnderElection',
                'commodityCreditCorporationLoansForfeited',
                'cropInsuranceProceedsReceived',
                'cropInsuranceProceedsDeferredFromPriorYear',
                'customHireIncome',
                'otherIncome',
            ]
            assertEq(fields.length, 10, 'hand-counted off the predicate')
            for (const field of fields) {
                const outcome = classify('single')(['wages'])({
                    ...noDocuments,
                    farmForms: [{
                        value: {
                            ...farm,
                            salesOfRaisedProductsAndLivestock: undefined,
                            cropInsuranceProceedsDeferredFromPriorYear: '0.00',
                            [field]: '1000.00',
                        },
                    }],
                })
                assert(outcome.kind === 'error', ['this printed line must fire the tripwire', field, outcome])
            }
            // THE CONTROL, and it is the one that makes the loop mean
            // something: a farm with EVERY one of those fields absent or zero
            // does NOT fire. A predicate that returned `true` unconditionally
            // would pass the loop above and fail here.
            const quiet = classify('single')(['wages'])({
                ...noDocuments,
                farmForms: [{
                    value: {
                        ...farm,
                        salesOfRaisedProductsAndLivestock: '0.00',
                        cropInsuranceProceedsDeferredFromPriorYear: '0.00',
                    },
                }],
            })
            assertEq(quiet.kind, 'ok', ['a farm with no income yet must not fire', quiet])
        },
        // THE NEGATIVE CONTROLS: no farm at all, and the declared case.
        anAbsentFarmNeverFiresAndADeclaredOneIsSilent: () => {
            const none = classify('single')(['wages'])(noDocuments)
            assertEq(none.kind, 'ok', ['no farm must not fire', none])
            const declared = classify('single')(['wages', 'farmIncomeOrLoss'])({
                ...noDocuments,
                farmForms: [{ value: farm }],
            })
            assertEq(declared.kind, 'ok', ['a declared kind must not trip its own tripwire', declared])
        },
    },
    // ── Entry 7: Form 1041 K-1 box 6 -> estateAndTrustIncome (TAX-35) ────
    beneficiaryIncome: {
        // A beneficiary holds a Schedule K-1 (Form 1041) and does not know
        // Schedule E Part III exists. Sections 652(a)/662(a) tax the share for
        // the year the fiduciary's income was required to be distributed,
        // whether or not a dollar was paid over -- so undeclared, the engine
        // would emit a confident 1040 short by $80,000.00 of income.
        aStoredEstateTrustK1UndeclaredRefusesNamingScheduleEPartIII: () => {
            const outcome = classify('single')(['wages'])({
                ...noDocuments,
                estateTrustK1Forms: [{ value: estateTrustK1 }],
            })
            assert(outcome.kind === 'error', ['a stored Form 1041 K-1 must refuse when undeclared', outcome])
            if (outcome.kind !== 'error') {
                return
            }
            assertEq(outcome.unmodeled.length, 1, ['expected exactly one required kind', outcome.unmodeled])
            assertEq(
                outcome.unmodeled[0],
                'estateAndTrustIncome',
                ['expected Schedule E Part III named', outcome.unmodeled])
            assert(
                outcome.message.includes('Schedule E Part III'),
                ['the refusal must name the printed part', outcome.message])
            assert(
                outcome.message.includes('estateAndTrustIncome'),
                ['the remedy must name the kind to declare', outcome.message])
        },
        // **THE DISCRIMINATING CASE, and the reason this is a SEVENTH tripwire
        // rather than a widening of the sixth.** Declaring the PARTNERSHIP kind
        // must NOT silence a beneficiary's document: they are different kinds
        // reaching the same printed Schedule 1 line through different printed
        // Schedule E parts. Folding box 6 into entry 6's predicate would make
        // this outcome `ok` and hand the filer a 1040 short by the share.
        aDeclaredPartnershipKindDoesNotSilenceTheBeneficiaryTripwire: () => {
            const outcome = classify('single')(['wages', 'partnershipAndSCorporationIncome'])({
                ...noDocuments,
                estateTrustK1Forms: [{ value: estateTrustK1 }],
            })
            assert(outcome.kind === 'error', ['the partnership declaration must not cover a Form 1041 K-1', outcome])
            if (outcome.kind !== 'error') {
                return
            }
            assertEq(outcome.unmodeled[0], 'estateAndTrustIncome', [outcome.unmodeled])
        },
        // THE CONTROL: declared, it is silent -- otherwise a tripwire that
        // refused every beneficiary would pass the two leaves above.
        aDeclaredEstateAndTrustIncomeSilencesTheTripwire: () => {
            const outcome = classify('single')(['wages', 'estateAndTrustIncome'])({
                ...noDocuments,
                estateTrustK1Forms: [{ value: estateTrustK1 }],
            })
            assertEq(outcome.kind, 'ok', ['a declared kind must not trip its own tripwire', outcome])
        },
        // A ZERO box 6 is not evidence: a dormant trust files a Schedule K-1
        // with nothing on it, and refusing that filer would be an outage.
        aZeroBoxSixIsNotEvidence: () => {
            const outcome = classify('single')(['wages'])({
                ...noDocuments,
                estateTrustK1Forms: [{ value: { ...estateTrustK1, box6OrdinaryBusinessIncome: '0.00' } }],
            })
            assertEq(outcome.kind, 'ok', ['a zero box 6 must not trip the tripwire', outcome])
        },
        // A LOSS still requires the declaration -- `fjs/schedule/e`'s
        // `beneficiaryLossRefusal` is where it then refuses by name under
        // section 642(h), and it cannot be reached by a return that never
        // declared the kind at all.
        aNegativeBoxSixStillRequiresTheDeclaration: () => {
            const outcome = classify('single')(['wages'])({
                ...noDocuments,
                estateTrustK1Forms: [{ value: { ...estateTrustK1, box6OrdinaryBusinessIncome: '-4000.00' } }],
            })
            assert(outcome.kind === 'error', ['a loss still requires the declaration', outcome])
        },
    },
    // ── Entry 8: a Schedule K-1 capital gain -> capitalGainsOrLosses ────
    //
    // TAX-35's routing half could not ship without this group. Before it,
    // these six boxes REFUSED at storage; after it they store and compute,
    // but only if `capitalGainsOrLosses` is declared -- so without the
    // tripwire the routing would have swapped a loud refusal for a silent
    // understatement.
    passThroughCapitalGains: {
        // The partner's box 8, undeclared: the gain reaches nothing at all,
        // because `fjs/form1040/core`'s `filingScheduleD` never runs.
        // Each thing a reader can act on is asserted SEPARATELY.
        aPartnerShortTermGainUndeclaredRefusesNamingScheduleD: () => {
            const outcome = classify('single')(['wages'])({
                ...noDocuments,
                partnershipK1Forms: [{
                    value: { ...partnershipK1NoBusinessIncome, box8NetShortTermCapitalGain: '12000.00' },
                }],
            })
            assert(outcome.kind === 'error', ['a stored K-1 capital gain must refuse', outcome])
            if (outcome.kind !== 'error') {
                return
            }
            assertEq(outcome.unmodeled[0], 'capitalGainsOrLosses', [outcome.unmodeled])
            assert(outcome.message.includes('Schedule D'), [outcome.message])
            assert(outcome.message.includes('line 5'), ['the remedy must name the printed line', outcome.message])
        },
        // The partner's box 9a, the LONG-term half of the same face -- a
        // separate leaf, because a predicate testing only one of the two
        // boxes passes the leaf above while dropping every long-term gain.
        aPartnerLongTermGainUndeclaredAlsoRefuses: () => {
            const outcome = classify('single')(['wages'])({
                ...noDocuments,
                partnershipK1Forms: [{
                    value: { ...partnershipK1NoBusinessIncome, box9aNetLongTermCapitalGain: '12000.00' },
                }],
            })
            assert(outcome.kind === 'error', ['box 9a is evidence too', outcome])
            if (outcome.kind !== 'error') {
                return
            }
            assertEq(outcome.unmodeled[0], 'capitalGainsOrLosses', [outcome.unmodeled])
            assert(outcome.message.includes('line 12'), ['the remedy must name the printed line', outcome.message])
        },
        // The shareholder's box 7 / box 8a -- DIFFERENT numbers for the same
        // two printed lines, which is the whole reason the predicate reads
        // each dialect's own field name.
        aShareholderGainUndeclaredRefusesAtItsOwnBoxNumbers: () => {
            const shortTerm = classify('single')(['wages'])({
                ...noDocuments,
                sCorporationK1Forms: [{
                    value: { ...sCorporationK1NoBusinessIncome, box7NetShortTermCapitalGain: '3000.00' },
                }],
            })
            assert(shortTerm.kind === 'error', ['box 7 is the shareholder short-term box', shortTerm])
            const longTerm = classify('single')(['wages'])({
                ...noDocuments,
                sCorporationK1Forms: [{
                    value: { ...sCorporationK1NoBusinessIncome, box8aNetLongTermCapitalGain: '3000.00' },
                }],
            })
            assert(longTerm.kind === 'error', ['box 8a is the shareholder long-term box', longTerm])
        },
        // The beneficiary's box 3 / box 4a. **Box 3 is the sharpest of the
        // six**: on both entity faces box 3 is OTHER NET RENTAL INCOME, so a
        // shared "box 3 is a capital gain" rule would fire on two rentals.
        aBeneficiaryGainUndeclaredRefusesAtItsOwnBoxNumbers: () => {
            const shortTerm = classify('single')(['wages'])({
                ...noDocuments,
                estateTrustK1Forms: [{
                    value: { ...estateTrustK1NoBusinessIncome, box3NetShortTermCapitalGain: '3000.00' },
                }],
            })
            assert(shortTerm.kind === 'error', ['box 3 is the beneficiary short-term box', shortTerm])
            const longTerm = classify('single')(['wages'])({
                ...noDocuments,
                estateTrustK1Forms: [{
                    value: { ...estateTrustK1NoBusinessIncome, box4aNetLongTermCapitalGain: '3000.00' },
                }],
            })
            assert(longTerm.kind === 'error', ['box 4a is the beneficiary long-term box', longTerm])
        },
        // THE CONTROL: declared, it is silent. Without this leaf a tripwire
        // that refused every K-1 holder would pass all four above.
        aDeclaredCapitalGainsOrLossesSilencesTheTripwire: () => {
            const outcome = classify('single')(['wages', 'capitalGainsOrLosses'])({
                ...noDocuments,
                partnershipK1Forms: [{
                    value: { ...partnershipK1NoBusinessIncome, box8NetShortTermCapitalGain: '12000.00' },
                }],
            })
            assertEq(outcome.kind, 'ok', ['a declared kind must not trip its own tripwire', outcome])
        },
        // THE SECOND CONTROL: a ZERO box is not evidence. A fund that closed
        // the year flat issues a Schedule K-1 with nothing on it, and
        // refusing that filer would be an outage rather than a guard.
        aZeroCapitalGainBoxIsNotEvidence: () => {
            const outcome = classify('single')(['wages'])({
                ...noDocuments,
                partnershipK1Forms: [{
                    value: {
                        ...partnershipK1NoBusinessIncome,
                        box8NetShortTermCapitalGain: '0.00',
                        box9aNetLongTermCapitalGain: '0.00',
                    },
                }],
            })
            assertEq(outcome.kind, 'ok', ['a zero gain must not trip the tripwire', outcome])
        },
        // THE THIRD CONTROL, and the one that keeps this entry from
        // swallowing its neighbour: a K-1 carrying ONLY box 1 business
        // income must name `partnershipAndSCorporationIncome` and NOT
        // `capitalGainsOrLosses`. A predicate that read any non-zero money
        // box would pass every leaf above and refuse the wrong kind here.
        aBoxOneOnlyKOneDoesNotTripTheCapitalGainEntry: () => {
            const outcome = classify('single')(['wages'])({
                ...noDocuments,
                partnershipK1Forms: [{ value: partnershipK1 }],
            })
            assert(outcome.kind === 'error', ['box 1 still trips its own entry', outcome])
            if (outcome.kind !== 'error') {
                return
            }
            assert(
                !outcome.unmodeled.includes('capitalGainsOrLosses'),
                ['ordinary business income is not a capital gain', outcome.unmodeled])
        },
        // A LOSS still requires the declaration: Schedule D line 21's $3,000
        // cap is exactly the computation an undeclared filer would lose, so
        // a negative box is evidence in the OVERSTATING direction and the
        // tripwire must still fire.
        aNegativeCapitalGainStillRequiresTheDeclaration: () => {
            const outcome = classify('single')(['wages'])({
                ...noDocuments,
                estateTrustK1Forms: [{
                    value: { ...estateTrustK1NoBusinessIncome, box3NetShortTermCapitalGain: '-8000.00' },
                }],
            })
            assert(outcome.kind === 'error', ['a loss still requires the declaration', outcome])
            if (outcome.kind !== 'error') {
                return
            }
            assertEq(outcome.unmodeled[0], 'capitalGainsOrLosses', [outcome.unmodeled])
        },
        // ── TAX-38's disjunct: a 1099-B box 11 -> capitalGainsOrLosses ──
        //
        // ★ THE CASE THE FORM 6781 WIRING COULD NOT SHIP WITHOUT. Before that
        // wiring, box 11 was stored, exactness-checked and read by NOTHING, so
        // an undeclared futures trader lost the amount either way. After it,
        // the amount reaches 1040 line 7a -- but only through
        // `filingScheduleD`, which is read off the DECLARED kind. Without this
        // disjunct the wiring would have moved the silent drop rather than
        // closed it.
        aSectionTwelveFiftySixAggregateUndeclaredRefusesNamingScheduleD: () => {
            const outcome = classify('single')(['wages'])({
                ...noDocuments,
                brokerageForms: [{
                    value: { ...bare1099B, box11AggregateProfitOrLoss: '43000.00' },
                }],
            })
            assert(outcome.kind === 'error', ['a stored box 11 must refuse when undeclared', outcome])
            if (outcome.kind !== 'error') {
                return
            }
            assertEq(outcome.unmodeled[0], 'capitalGainsOrLosses', [outcome.unmodeled])
            assert(outcome.message.includes('Schedule D'), [outcome.message])
            assert(
                outcome.message.includes('capital gain'),
                ['the remedy must say what the amount IS', outcome.message])
        },
        // THE CONTROL: declared, it is silent -- stated separately from the
        // K-1 control above, because a disjunct added to the predicate and
        // NOT to the declaration check would pass that one and fail this.
        aDeclaredCapitalGainsOrLossesSilencesTheSectionTwelveFiftySixHalfToo: () => {
            const outcome = classify('single')(['wages', 'capitalGainsOrLosses'])({
                ...noDocuments,
                brokerageForms: [{
                    value: { ...bare1099B, box11AggregateProfitOrLoss: '43000.00' },
                }],
            })
            assertEq(outcome.kind, 'ok', ['a declared kind must not trip its own tripwire', outcome])
        },
        // THE SECOND CONTROL, and the reason the predicate reads box 11 and
        // not boxes 8, 9 and 10: a trader who closed the year exactly flat
        // files a real 1099-B whose components are non-zero and whose
        // AGGREGATE is zero. Their Schedule D contribution is nothing, so
        // refusing them would be an outage rather than a guard.
        aFlatYearWithNonZeroComponentsAndAZeroAggregateIsNotEvidence: () => {
            const outcome = classify('single')(['wages'])({
                ...noDocuments,
                brokerageForms: [{
                    value: {
                        ...bare1099B,
                        box8ProfitOrLossRealized: '5000.00',
                        box9UnrealizedProfitOrLossPriorYearEnd: '3000.00',
                        box10UnrealizedProfitOrLossCurrentYearEnd: '-2000.00',
                        box11AggregateProfitOrLoss: '0.00',
                    },
                }],
            })
            assertEq(outcome.kind, 'ok', ['a zero aggregate must not trip the tripwire', outcome])
        },
        // THE THIRD CONTROL, and the one that keeps this disjunct from
        // swallowing the ordinary brokerage 1099-B: a form carrying a stock
        // sale in box 1d and NONE of the section 1256 boxes is silent. The
        // printed form makes the two disjoint -- box 1d "does not include
        // proceeds from regulated futures contracts or Section 1256 option
        // contracts" -- and a predicate reading any non-zero money box on this
        // dialect would refuse every taxpayer who ever sold a share.
        anOrdinaryStockSaleNineteenNineBIsNotEvidence: () => {
            const outcome = classify('single')(['wages'])({
                ...noDocuments,
                brokerageForms: [{
                    value: {
                        ...bare1099B,
                        box1dProceeds: '10000.00',
                        box1eCostOrOtherBasis: '7000.00',
                        box4FederalIncomeTaxWithheld: '250.00',
                    },
                }],
            })
            assertEq(outcome.kind, 'ok', ['an ordinary sale is not section 1256 evidence', outcome])
        },
        // A section 1256 LOSS still requires the declaration, for exactly the
        // reason the K-1 leaf above gives: Schedule D line 21's $3,000 cap is
        // the computation an undeclared filer would lose, and §1256(a)(3)
        // splits a LOSS 60/40 just as it splits a gain.
        aNegativeSectionTwelveFiftySixAggregateStillRequiresTheDeclaration: () => {
            const outcome = classify('single')(['wages'])({
                ...noDocuments,
                brokerageForms: [{
                    value: { ...bare1099B, box11AggregateProfitOrLoss: '-37000.00' },
                }],
            })
            assert(outcome.kind === 'error', ['a loss still requires the declaration', outcome])
            if (outcome.kind !== 'error') {
                return
            }
            assertEq(outcome.unmodeled[0], 'capitalGainsOrLosses', [outcome.unmodeled])
        },
    },
    // ── Entry 6: Schedule K-1 box 1 -> partnershipAndSCorporationIncome ──
    passThroughIncome: {
        // PHASE 30'S MOTIVATING CASE. A founder holds a Schedule K-1 and does
        // not know Schedule E exists; the entity paid no tax on the income and
        // may have distributed none of it, and the whole share is taxable on
        // this return. Undeclared, the engine would emit a confident 1040
        // short by $80,000.00 of income.
        //
        // Each of the four things a reader can act on is asserted SEPARATELY.
        aStoredPartnershipK1UndeclaredRefusesNamingScheduleE: () => {
            const outcome = classify('single')(['wages'])({
                ...noDocuments,
                partnershipK1Forms: [{ value: partnershipK1 }],
            })
            assert(outcome.kind === 'error', ['a stored K-1 must refuse when undeclared', outcome])
            if (outcome.kind !== 'error') {
                return
            }
            assertEq(outcome.unmodeled.length, 1, ['expected exactly one required kind', outcome.unmodeled])
            assertEq(
                outcome.unmodeled[0],
                'partnershipAndSCorporationIncome',
                ['expected Schedule E Part II named', outcome.unmodeled])
            assert(
                outcome.message.includes('Schedule E Part II'),
                ['the refusal must name the printed PART, not the whole schedule', outcome.message])
            assert(
                outcome.message.includes('Schedule 1 line 5'),
                ['the refusal must name the Schedule 1 line it reaches', outcome.message])
            assert(
                outcome.message.includes('box 1'),
                ['the refusal must name the box that proved it', outcome.message])
            // The half a filer most needs to hear, and the reason this
            // tripwire is worth more than most: the tax is owed on income
            // that may never have been distributed.
            assert(
                outcome.message.includes('whether or not a single dollar was distributed'),
                ['the evidence must state why the income is taxable at all', outcome.message])
            // The remedy is a DECLARATION, because the kind is modeled.
            assert(
                outcome.message.includes('declare partnershipAndSCorporationIncome'),
                ['the remedy must be the declaration, not a form hunt', outcome.message])
        },
        // **The SAME tripwire fires for the other dialect**, which is the half
        // a predicate written against one document list would miss entirely —
        // and it is the likelier omission, because the 1065 face is the one
        // with the self-employment box and therefore the one a reader
        // remembers.
        aStoredSCorporationK1FiresTheSameTripwire: () => {
            const outcome = classify('single')(['wages'])({
                ...noDocuments,
                sCorporationK1Forms: [{ value: sCorporationK1 }],
            })
            assert(outcome.kind === 'error', ['a stored 1120-S K-1 must refuse when undeclared', outcome])
            if (outcome.kind !== 'error') {
                return
            }
            assertEq(outcome.unmodeled[0], 'partnershipAndSCorporationIncome', [outcome.unmodeled])
        },
        // THE NEGATIVE CONTROL: absent, and a dormant entity's zero box 1.
        // DOC-11 at the guard — a partnership that did nothing still issues a
        // Schedule K-1, and refusing that filer would be an outage.
        anAbsentOrZeroBoxOneNeverFires: () => {
            const none = classify('single')(['wages'])(noDocuments)
            assertEq(none.kind, 'ok', ['no K-1 must not fire', none])
            const absent = classify('single')(['wages'])({
                ...noDocuments,
                partnershipK1Forms: [{
                    value: { ...partnershipK1, box1OrdinaryBusinessIncome: undefined, box14SelfEmploymentEarnings: undefined },
                }],
            })
            assertEq(absent.kind, 'ok', ['an absent box 1 must not fire', absent])
            const zero = classify('single')(['wages'])({
                ...noDocuments,
                sCorporationK1Forms: [{ value: { ...sCorporationK1, box1OrdinaryBusinessIncome: '0.00' } }],
            })
            assertEq(zero.kind, 'ok', ['a zero box 1 must not fire', zero])
        },
        // A LOSS still fires it, which is deliberate and is the one place this
        // predicate's `boxIsNonZero` is doing something a `> 0` would not: a
        // filer with a pass-through LOSS must still declare the kind, and
        // `fjs/schedule/e` is then where the loss refuses by name. Silently
        // computing a return for them would be the same silence in the other
        // direction.
        aLossFiresItToo: () => {
            const outcome = classify('single')(['wages'])({
                ...noDocuments,
                partnershipK1Forms: [{
                    value: {
                        ...partnershipK1,
                        box1OrdinaryBusinessIncome: '-12000.00',
                        box14SelfEmploymentEarnings: [{ code: 'A', amount: '-12000.00' }],
                    },
                }],
            })
            assert(outcome.kind === 'error', ['a pass-through LOSS must still require the declaration', outcome])
        },
        aDeclaredPassThroughSilencesTheTripwire: () => {
            const outcome = classify('single')(['wages', 'partnershipAndSCorporationIncome'])({
                ...noDocuments,
                partnershipK1Forms: [{ value: partnershipK1 }],
            })
            assertEq(outcome.kind, 'ok', ['a declared kind must not trip its own tripwire', outcome])
        },
    },
    // ── The whole table's behaviour ──────────────────────────────────────
    //
    // Nothing supplied, nothing declared: compute. This is the strongest
    // statement of "a tripwire that always fires is not a tripwire" — the
    // degenerate input every one of the predicates sees, and none of
    // them may fire on it.
    noDocumentsAtAllComputes: () => {
        assertEq(classify('single')([])(noDocuments).kind, 'ok')
        for (const status of everyStatus) {
            assertEq(
                classify(status)([])(noDocuments).kind,
                'ok',
                ['an empty document set must compute for every status', status])
        }
    },
    // Two tripwires firing at once name BOTH kinds, in 1040 form order — the
    // W-2 carries allocated tips (line 1c) AND box-5 wages above the
    // threshold (lines 17/23). A guard that stopped at the first finding
    // would name one and leave the taxpayer to discover the other after
    // fixing it.
    twoTripwiresFiringNameBothKindsInFormOrder: () => {
        const outcome = classify('single')(['wages'])({
            ...noDocuments,
            w2s: [{ value: { ...bareW2, box5MedicareWagesAndTips: '300000.00', box8AllocatedTips: '2400.00' } }],
        })
        assert(outcome.kind === 'error', ['two tripwires must refuse', outcome])
        if (outcome.kind !== 'error') {
            return
        }
        assertEq(outcome.unmodeled.length, 2, ['expected both required kinds', outcome.unmodeled])
        assertEq(outcome.unmodeled[0], 'unreportedTips', ['expected 1040 line 1c named first', outcome.unmodeled])
        assertEq(outcome.unmodeled[1], 'additionalMedicareTax', ['expected Schedule 2 line 11 named second', outcome.unmodeled])
        // Both remedies present, so neither is silently dropped when the
        // other is named.
        assert(outcome.message.includes('Form 4137'), ['expected the tips remedy', outcome.message])
        assert(outcome.message.includes('Form 8959'), ['expected the Medicare remedy', outcome.message])
    },
    // T-10-07-04 at this guard. `fjs/return/scope` cannot check where a
    // caller's evidence string came from, so this is the leaf that keeps the
    // convention honest: the taxpayer's OWN amounts, which are the only
    // taxpayer data a predicate here ever touches, must not appear in the
    // refusal. ELEVEN distinctive amounts are supplied and each is searched for
    // separately, so a message that interpolated any one of them reddens here
    // and says which. A stored rental property's rent is the ninth, a stored
    // 1099-B's box 11 section 1256 aggregate is the tenth, and a stored farm's
    // printed line 2 is the eleventh.
    noTaxpayerAmountRidesOutThroughATripwireRefusal: () => {
        const outcome = classify('single')(['wages'])({
            w2s: [{ value: { ...bareW2, box5MedicareWagesAndTips: '387654.32', box8AllocatedTips: '1234.56' } }],
            retirementForms: [{ value: { ...bare1099R, box3CapitalGain: '7654.21' } }],
            nonemployeeCompensationForms: [
                { value: { ...bare1099Nec, box1NonemployeeCompensation: '9876.54' } },
            ],
            partnershipK1Forms: [{
                value: { ...partnershipK1, box1OrdinaryBusinessIncome: '5432.10' },
            }],
            sCorporationK1Forms: [],
            estateTrustK1Forms: [{
                value: { ...estateTrustK1, box6OrdinaryBusinessIncome: '6543.21' },
            }],
            isoExerciseForms: [{
                value: {
                    ...isoExercise,
                    box3ExercisePricePerShare: '3.21',
                    box4FairMarketValuePerShareOnExerciseDate: '54.32',
                },
            }],
            rentalProperties: [{ value: { ...rentalProperty, rentsReceived: '8765.43' } }],
            brokerageForms: [{ value: { ...bare1099B, box11AggregateProfitOrLoss: '2468.13' } }],
            farmForms: [{
                value: { ...farm, salesOfRaisedProductsAndLivestock: '2109.87' },
            }],
        })
        assert(outcome.kind === 'error', ['expected a refusal', outcome])
        if (outcome.kind !== 'error') {
            return
        }
        for (const amount of ['387654.32', '1234.56', '7654.21', '9876.54', '3.21', '54.32', '5432.10', '6543.21', '8765.43', '2468.13', '2109.87']) {
            assert(
                !outcome.message.includes(amount),
                ['a taxpayer amount reached the refusal message', amount, outcome.message])
        }
        // The control: the message is not empty, and it really did describe
        // all three findings — otherwise "contains no amount" would be
        // satisfied by a message containing nothing.
        // **The two branches each moved this from 8 to 9 and the merge had to
        // move it to 10.** The section 1256 half of the `capitalGainsOrLosses`
        // entry and the new `farmIncomeOrLoss` entry fire on DIFFERENT stored
        // documents and name DIFFERENT kinds, so they add rather than overlap
        // — and because both sides wrote the identical `8 -> 9`, git merged
        // the two changes into one without a conflict. A count that agrees
        // with both parents is exactly the shape a silent merge loss takes.
        assertEq(outcome.unmodeled.length, 10, ['expected all ten tripwires to have fired', outcome.unmodeled])
    },
    // The rejected fourth entry, recorded as a CHECKED claim rather than as
    // prose (see this module's docstring). `fjs/document/1099g` refuses a
    // present, non-zero box 2 at validation, so a tripwire on it could never
    // fire through the product path — every document reaching the engine has
    // already passed `validate`.
    //
    // The control is the same 1099-G with a ZERO box 2, which validates: that
    // is what makes this leaf evidence about box 2's REFUSAL rather than about
    // the fixture being malformed in some unrelated way. The day either half
    // changes, this leaf reddens and the table needs a fourth row.
    theRejectedFourthEntryIsUnreachableBecauseValidationRefusesIt: () => {
        const base1099G = {
            dialect: oneZeroNineNineGDialect,
            payerTin: '55-5555555',
            recipientTin: '222-22-2222',
            accountNumber: '',
            taxYear: 2025,
            formRevision: '2025',
        }
        const [refused, why] = validate1099g({ ...base1099G, box2StateOrLocalIncomeTaxRefunds: '1500.00' })
        assertEq(
            refused,
            'error',
            ['a non-zero 1099-G box 2 must be refused at validation, which is what makes a tripwire on it unreachable', why])
        const [accepted] = validate1099g({ ...base1099G, box2StateOrLocalIncomeTaxRefunds: '0.00' })
        assertEq(
            accepted,
            'ok',
            ['the control: a zero box 2 validates, so the refusal above is about the AMOUNT, not the shape'])
        // …and no tripwire in the table names this kind, so nothing here
        // claims coverage it does not have.
        //
        // **The kind named here changed in Phase 27, and the change is an
        // improvement this leaf could not have had before.** It read
        // `scheduleOneAdditionalIncome` — the COARSE kind covering the whole
        // of Schedule 1 Part I — because that was the only kind a 1099-G box
        // 2 could have been said to require. Phase 27 split that kind into one
        // per printed line, so the rejected fourth entry can now name the
        // exact line it would have pointed at: `taxableStateLocalRefunds`,
        // Schedule 1 line 1.
        assert(
            !tripwires.some(t => t.kind === 'taxableStateLocalRefunds'),
            'no tripwire may point at a kind whose documents cannot reach the engine')
    },
}
