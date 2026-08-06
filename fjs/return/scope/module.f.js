/**
 * TAX-16's scope guard: the FROZEN modeled set, the refusal table, and (Task 2)
 * `scopeRefusal` / `classifyScope` — the one place a scope refusal is built.
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
 * ## Why `qualifiedDividends` is NOT modeled, even in the phase that ships QDCGT
 *
 * The Qualified Dividends and Capital Gain Tax Worksheet computes in this same
 * phase (`fjs/tax/line16/qdcgt`, Plan 10-06), and yet a return DECLARING
 * qualified dividends is refused here. That is not a contradiction. The
 * worksheet's arithmetic is one thing; line 3a's SOURCE is another, and its
 * source is a Form 1099-DIV, whose dialect (`vnd.fjs.1099div`, DOC-06) is
 * Phase 12. So the dispatcher's QDCGT arm is proven directly, over worksheet
 * inputs supplied as values (Plans 10-06 and 10-08), while a taxpayer who
 * declares dividends gets a refusal naming the missing dialect instead of a
 * number derived from a document nobody could ingest. That is the guard doing
 * its job, and it is the exact shape of the failure TAX-16 names: an engine
 * that can compute a worksheet is not thereby an engine that can read the form
 * feeding it.
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
 * The six kinds this engine models today, each with the document it actually
 * reads. Frozen in `fjs/guest`'s sense: growing this list is a deliberate act
 * that must be paired with a deletion from {@link unmodeledKindRefusals}, or
 * {@link _EveryKindIsEitherModeledOrRefused} fails to compile.
 *
 * Kept in {@link kindVocabulary} order so the two lists can be diffed against
 * the 1040 face rather than against memory.
 */
export const modeledKinds = /** @type {const} */ ([
    'wages',                       // W-2 box 1                     -> 1040 line 1a
    'taxExemptInterest',           // 1099-INT box 8                -> 1040 line 2a
    'taxableInterest',             // 1099-INT boxes 1 and 3        -> 1040 line 2b
    'federalTaxWithheldOnW2',      // W-2 box 2                     -> 1040 line 25a
    'federalTaxWithheldOn1099Int', // 1099-INT box 4                -> 1040 line 25b
    'estimatedTaxPayments',        // declared on the return profile -> 1040 line 26
])

/** One member of {@link modeledKinds}.
 * @typedef {typeof modeledKinds[number]} ModeledKind
 */

/**
 * {@link modeledKinds} widened to a plain string list — an ordinary widening
 * ASSIGNMENT, not a cast: the tuple's literal member types are a subtype of
 * `string`, so nothing is silenced. It exists because the membership question
 * is asked of a {@link Kind}, and the six-literal tuple's own `.includes`
 * would reject that argument at compile time — the compiler refusing to let us
 * ask the question the guard exists to answer. Same device, same reason, as
 * `fjs/return/profile`'s `kindNames`.
 * @type {readonly string[]}
 */
const modeledKindNames = modeledKinds

// ── The refusal table ────────────────────────────────────────────────────────

/**
 * The forty-four declared kinds this engine does not model, each naming the
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
export const unmodeledKindRefusals = /** @type {const} */ ([
    { kind: 'householdEmployeeWages', line: '1040 line 1b', label: 'household employee wages', remedy: 'no dialect models it (Phase 13)' },
    { kind: 'unreportedTips', line: '1040 line 1c', label: 'unreported tips', remedy: 'requires Form 4137 (no phase yet)' },
    { kind: 'medicaidWaiverPayments', line: '1040 line 1d', label: 'nontaxable Medicaid waiver payments', remedy: 'no dialect models it (Phase 13)' },
    { kind: 'dependentCareBenefits', line: '1040 line 1e', label: 'dependent care benefits', remedy: 'requires Form 2441 (no phase yet)' },
    { kind: 'adoptionBenefits', line: '1040 line 1f', label: 'employer-provided adoption benefits', remedy: 'requires Form 8839 (no phase yet)' },
    { kind: 'form8919Wages', line: '1040 line 1g', label: 'Form 8919 wages', remedy: 'requires Form 8919 (no phase yet)' },
    { kind: 'otherEarnedIncome', line: '1040 line 1h', label: 'other earned income', remedy: 'no dialect models it (Phase 13)' },
    { kind: 'nontaxableCombatPayElection', line: '1040 line 1i', label: 'nontaxable combat pay election', remedy: 'no dialect models it (no phase yet)' },
    { kind: 'qualifiedDividends', line: '1040 line 3a', label: 'qualified dividends', remedy: 'requires vnd.fjs.1099div (DOC-06, Phase 12)' },
    { kind: 'ordinaryDividends', line: '1040 line 3b', label: 'ordinary dividends', remedy: 'requires vnd.fjs.1099div (DOC-06, Phase 12)' },
    { kind: 'iraDistributions', line: '1040 lines 4a/4b', label: 'IRA distributions', remedy: 'requires vnd.fjs.1099r (DOC-09, Phase 11)' },
    { kind: 'pensionsAndAnnuities', line: '1040 lines 5a/5b', label: 'pensions and annuities', remedy: 'requires vnd.fjs.1099r (DOC-09, Phase 11)' },
    { kind: 'socialSecurityBenefits', line: '1040 lines 6a/6b', label: 'social security benefits', remedy: 'requires vnd.fjs.ssa1099 and the Social Security Benefits Worksheet (TAX-10, Phase 13)' },
    { kind: 'capitalGainDistributions', line: '1040 line 7a', label: 'capital gain distributions', remedy: 'requires vnd.fjs.1099div (DOC-06, Phase 12)' },
    { kind: 'capitalGainsOrLosses', line: '1040 line 7a', label: 'capital gains or losses', remedy: 'requires Form 8949 and Schedule D (TAX-11, Phase 12)' },
    { kind: 'unrecaptured1250Gain', line: 'Schedule D line 19', label: 'unrecaptured section 1250 gain', remedy: 'requires the Schedule D Tax Worksheet and the Unrecaptured Section 1250 Gain Worksheet (TAX-11, Phase 12)' },
    { kind: 'collectibles28RateGain', line: 'Schedule D line 18', label: '28% rate gain', remedy: 'requires the Schedule D Tax Worksheet and the 28% Rate Gain Worksheet (TAX-11, Phase 12)' },
    { kind: 'section1202Gain', line: 'Form 1099-DIV box 2c', label: 'section 1202 gain', remedy: 'requires vnd.fjs.1099div and Schedule D (DOC-06 and TAX-11, Phase 12)' },
    { kind: 'investmentInterestForm4952', line: 'Form 4952 line 4g', label: 'investment interest expense election', remedy: 'requires Form 4952 and the Schedule D Tax Worksheet (TAX-11, Phase 12)' },
    { kind: 'scheduleOneAdditionalIncome', line: '1040 line 8', label: 'additional income from Schedule 1', remedy: 'requires Schedule 1 (TAX-14, Phase 13)' },
    { kind: 'scheduleOneAdjustments', line: '1040 line 10', label: 'adjustments to income from Schedule 1', remedy: 'requires Schedule 1 (TAX-14, Phase 13)' },
    { kind: 'itemizedDeductions', line: '1040 line 12e', label: 'itemized deductions', remedy: 'requires Schedule A (TAX-13, Phase 13)' },
    { kind: 'netQualifiedDisasterLoss', line: '1040 line 12e', label: 'net qualified disaster loss', remedy: 'requires Schedule A (TAX-13, Phase 13)' },
    { kind: 'qualifiedBusinessIncomeDeduction', line: '1040 line 13a', label: 'qualified business income deduction', remedy: 'requires Form 8995 or 8995-A (no phase yet)' },
    { kind: 'seniorAndOtherScheduleOneADeductions', line: '1040 line 13b', label: 'additional deductions from Schedule 1-A', remedy: 'requires Schedule 1-A (TAX-09, Phase 13)' },
    { kind: 'scheduleTwoTaxes', line: '1040 lines 17 and 23', label: 'additional taxes from Schedule 2', remedy: 'requires Schedule 2 (TAX-14, Phase 13)' },
    { kind: 'childTaxCreditOrOtherDependents', line: '1040 line 19', label: 'child tax credit or credit for other dependents', remedy: 'requires Schedule 8812 (TAX-12, Phase 13)' },
    { kind: 'scheduleThreeNonrefundableCredits', line: '1040 line 20', label: 'nonrefundable credits from Schedule 3', remedy: 'requires Schedule 3 (TAX-14, Phase 13)' },
    { kind: 'federalTaxWithheldOnOther1099', line: '1040 line 25b', label: 'federal income tax withheld on Forms 1099 other than 1099-INT', remedy: 'requires vnd.fjs.1099r, vnd.fjs.1099div or vnd.fjs.1099b (Phases 11 and 12)' },
    { kind: 'federalTaxWithheldOnOtherForms', line: '1040 line 25c', label: 'federal income tax withheld on other forms', remedy: 'no dialect models it (Phase 13)' },
    { kind: 'earnedIncomeCredit', line: '1040 line 27a', label: 'earned income credit', remedy: 'requires Schedule EIC (no phase yet)' },
    { kind: 'additionalChildTaxCredit', line: '1040 line 28', label: 'additional child tax credit', remedy: 'requires Schedule 8812 (TAX-12, Phase 13)' },
    { kind: 'americanOpportunityCredit', line: '1040 line 29', label: 'American opportunity credit', remedy: 'requires Form 8863 (no phase yet)' },
    { kind: 'refundableAdoptionCredit', line: '1040 line 30', label: 'refundable adoption credit', remedy: 'requires Form 8839 (no phase yet)' },
    { kind: 'scheduleThreeRefundableCredits', line: '1040 line 31', label: 'refundable credits from Schedule 3', remedy: 'requires Schedule 3 (TAX-14, Phase 13)' },
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

// ── Tests ────────────────────────────────────────────────────────────────────

/**
 * Independently hand-typed: the number of kinds {@link modeledKinds} names
 * today. Deliberately NOT `modeledKinds.length` — if it were, adding or
 * dropping a kind would move both sides together and this check could never
 * fail. The duplication is the mechanism, not a smell (AGENTS.md).
 * @type {number}
 */
const expectedModeledKindCount = 6

/**
 * Independently hand-typed: the number of entries
 * {@link unmodeledKindRefusals} carries today, counted off the plan's table
 * rather than read from `.length`, for the same reason.
 *
 * This is the counterweight to every proof below that ITERATES the refusal
 * table. A loop over a collection derived from the code under test can never
 * notice that collection shrinking — the project's fourth instance of the
 * signature defect, found this phase in `unknownDialectRefused`'s
 * `Object.keys(dialectSchemas)` loop. `50 - 6 = 44` is asserted here against
 * `kindVocabulary.length`, which `fjs/return/profile` in turn pins against its
 * own hand-typed `50`.
 * @type {number}
 */
const expectedUnmodeledKindCount = 44

export const proof = {
    partition: {
        // Both counts against hand-typed constants, and their sum against the
        // vocabulary this module partitions -- so the 6/44 split cannot drift
        // by a kind quietly migrating from one list to the other.
        modeledKindsIsExactlySix: () => {
            assertEq(modeledKinds.length, expectedModeledKindCount)
            assertEq(new Set(modeledKinds).size, expectedModeledKindCount)
        },
        unmodeledRefusalsIsExactlyFortyFour: () => {
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
}
