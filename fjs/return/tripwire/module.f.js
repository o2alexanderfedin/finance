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
 * ## The table, and why each of the four entries earns its place
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
 *    form. It is also not expressible: `capitalGainsOrLosses` is a MODELED
 *    kind, so it has no entry in `unmodeledKindRefusals` and
 *    `tripwireRefusal` — which this phase's own criterion 3 requires every
 *    refusal here to go through — could not name a line, a label or a remedy
 *    for it. `form4972LumpSumDistribution` is the kind the form's own
 *    instruction names, it is refused today at 1040 line 16, and its remedy
 *    already reads "requires Form 4972".
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
 *    **This is the SECOND entry to point at a MODELED kind**, and only the
 *    second since Phase 23 built the mechanism for it. `businessIncomeOrLoss`
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
import { assert, assertEq } from 'functionalscript/fjs/asserts/module.f.js'
import { centsFromString } from '../../exact/module.f.js'
import { tripwireRefusal } from '../scope/module.f.js'
import { taxParamsByYear } from '../../tax/params/module.f.js'
import { dialect as w2Dialect } from '../../document/w2/module.f.js'
import { dialect as oneZeroNineNineRDialect } from '../../document/1099r/module.f.js'
import { dialect as oneZeroNineNineGDialect, validate as validate1099g } from '../../document/1099g/module.f.js'
import { dialect as oneZeroNineNineNecDialect } from '../../document/1099nec/module.f.js'

/** @import { IndividualFilingStatus, TaxParamSet } from '../../tax/params/module.f.js' */
/** @import { Kind } from '../profile/module.f.js' */
/** @import { RefusableKind, ScopeOutcome, TripwireFinding } from '../scope/module.f.js' */
/** @import { W2 } from '../../document/w2/module.f.js' */
/** @import { OneZeroNineNineR } from '../../document/1099r/module.f.js' */
/** @import { OneZeroNineNineNec } from '../../document/1099nec/module.f.js' */

// ── What a tripwire reads ────────────────────────────────────────────────────

/**
 * The documents a tripwire predicate may read: exactly the `Form1040Inputs`
 * fields any entry in {@link tripwires} needs, and no more.
 *
 * **Written as a structural subset rather than as `Form1040Inputs` itself**,
 * which is deliberate twice over. It states, at the type level, precisely which
 * of the engine's eleven document lists this guard is allowed to look at — a
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
 * `businessIncomeOrLoss`.
 * @type {number}
 */
const expectedTripwireCount = 4

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
const noDocuments = { w2s: [], retirementForms: [], nonemployeeCompensationForms: [] }

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
    // The hand-typed count, and the structural facts a loop cannot see: three
    // rows, three DISTINCT kinds, and no empty evidence string. A tripwire
    // whose evidence were blank would refuse without saying what proved it,
    // which is the silence this whole module replaces.
    theTableIsExactlyFourDistinctTripwires: () => {
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
    // ── The whole table's behaviour ──────────────────────────────────────
    //
    // Nothing supplied, nothing declared: compute. This is the strongest
    // statement of "a tripwire that always fires is not a tripwire" — the
    // degenerate input every one of the three predicates sees, and none of
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
    // refusal. Three distinctive amounts are supplied and each is searched for
    // separately, so a message that interpolated any one of them reddens here
    // and says which.
    noTaxpayerAmountRidesOutThroughATripwireRefusal: () => {
        const outcome = classify('single')(['wages'])({
            w2s: [{ value: { ...bareW2, box5MedicareWagesAndTips: '387654.32', box8AllocatedTips: '1234.56' } }],
            retirementForms: [{ value: { ...bare1099R, box3CapitalGain: '7654.21' } }],
            nonemployeeCompensationForms: [
                { value: { ...bare1099Nec, box1NonemployeeCompensation: '9876.54' } },
            ],
        })
        assert(outcome.kind === 'error', ['expected a refusal', outcome])
        if (outcome.kind !== 'error') {
            return
        }
        for (const amount of ['387654.32', '1234.56', '7654.21', '9876.54']) {
            assert(
                !outcome.message.includes(amount),
                ['a taxpayer amount reached the refusal message', amount, outcome.message])
        }
        // The control: the message is not empty, and it really did describe
        // all three findings — otherwise "contains no amount" would be
        // satisfied by a message containing nothing.
        assertEq(outcome.unmodeled.length, 4, ['expected all four tripwires to have fired', outcome.unmodeled])
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
