/**
 * Schedule 8812 (Form 1040) — TAX-12: Part I (Child Tax Credit and Credit
 * for Other Dependents, feeding 1040 line 19) and Part II-A (Additional
 * Child Tax Credit, feeding 1040 line 28), both computed from ONE function
 * execution sharing internal intermediates (13-CONTEXT.md Decision 4.3 —
 * shipping half the form would leave line 28 refusing on a return with a
 * completed Schedule 8812 sitting in front of it, an outcome no taxpayer
 * could interpret).
 *
 * Source, transcribed directly (13-RESEARCH.md §4), not from recall:
 * `f1040s8.pdf` (2025), both pages, "Created 7/30/25"; `i1040s8.pdf`.
 *
 * ## The phase-out is STEPPED — do NOT read this as `fjs/schedule/1a`'s idiom
 *
 * Schedule 8812's phase-out is 5% of the excess over the threshold, where
 * the excess is rounded UP to the next whole $1,000 first — a true cliff.
 * `$1` over the threshold costs the FULL $50 (5% of the first $1,000 step)
 * immediately. This is the OPPOSITE of `fjs/schedule/1a`'s senior-deduction
 * phase-out (CONTINUOUS, cent-exact, never rounded to a $1,000 step) and of
 * `fjs/schedule/a`'s SALT cap phase-down (also continuous) — getting this
 * backwards is this phase's single most likely silent-wrong-number failure
 * (13-CONTEXT.md Decision 5.5). {@link roundUpToNextThousandDollars} has NO
 * precedent anywhere in this codebase (13-PATTERNS.md's "No Analog Found"
 * table) and carries its own dedicated boundary proofs below, independent
 * of the module's end-to-end fixtures.
 *
 * ## Classification is DERIVED from facts, never supplied
 *
 * A qualifying child (→ line 4, $2,200 CTC) is a dependent under age 17 at
 * year end AND carrying a valid employment-eligible SSN — the printed
 * form's own two-fact test (13-RESEARCH.md §4). Every other declared
 * dependent → line 6, $500 ODC. This module classifies the `dependents`
 * array itself via a pure filter, exactly as 13-08 intended by deliberately
 * NOT accepting a pre-classified count as input — trusting a supplied count
 * would make the engine's own classification unverifiable.
 *
 * ## The citizenship/national/resident-alien test is an ACCEPTED TRUST BOUNDARY
 *
 * (13-CONTEXT.md Decision 5.7.) The printed form's ODC test also requires
 * the dependent be a U.S. citizen, national, or resident alien (and not the
 * taxpayer or spouse) — facts `vnd.fjs.return_profile`'s `dependents` array
 * deliberately does NOT carry (13-08's own docstring). The taxpayer's act of
 * declaring a dependent already asserts this; this module's own
 * classification runs on only the two facts the array does carry (age, SSN
 * validity), mirroring `fjs/schedule/b`'s Form 8815 documented-boundary
 * treatment for a fact this engine trusts rather than re-derives.
 *
 * ## Part II-B (3+ qualifying children / Puerto Rico residents) is REFUSED,
 * never silently zeroed
 *
 * `line16b >= $5,100` (3 or more qualifying children, since $1,700 x 3 =
 * $5,100 exactly) is a REAL case this engine cannot yet finish — a
 * document-data-sufficiency refusal (12.1 Decision 2.6's category), not a
 * documented zero. Computing Part II-A's line27 as though Part II-B's own
 * lines were zero would silently understate the ACTC for a real taxpayer
 * this engine has enough information to serve correctly, were Part II-B
 * modeled — exactly the failure mode TAX-16's discipline exists to prevent.
 *
 * ## The form's own early exits are modeled faithfully, as control flow, not
 * as optimizations
 *
 * Line 12 (`IF line8 <= line11: STOP`, no CTC/ODC/ACTC at all — line12
 * itself enters $0 and every line past it is unreachable), line 16a's own
 * floor (never negative, since line14 is a `min` against line12), and
 * line16b's `< $5,100` skip of Part II-B are the printed form's own control
 * flow, transcribed as such.
 *
 * ## Credit Limit Worksheet A's line 2 was a documented zero until Phase 25,
 * and is now a real figure
 *
 * Through Phase 24 this section read: *"Every Schedule 3 credit this
 * worksheet's own line 2 could sum (foreign tax credit, dependent care,
 * education credits, etc.) is unmodeled for this profile (13-RESEARCH.md §4),
 * so line 2 collapses to bare `0n`"*. It was true when written and Phase 25
 * (TAX-25/TAX-26) makes it false: Schedule 3 lines 3 and 4 now compute real
 * education and saver's credits, and the printed worksheet's own line 2 sums
 * *"Schedule 3, line 1; line 2; line 3; line 4; line 6d; line 6e; line 6f;
 * line 6l; line 6m; Form 5695 line 30; Form 8910 line 15; Form 8936 line
 * 23"*. Two of those twelve are now non-zero.
 *
 * So `scheduleThreeCreditsCents` is an INPUT, and the caller
 * (`fjs/form1040/core`) supplies Schedule 3 lines 3 + 4 off the SAME
 * `scheduleThree(...)` execution that produced them. What this encodes is
 * §26's ordering: the child tax credit is applied to what is left of the tax
 * after the other nonrefundable personal credits, so a taxpayer whose
 * education credit already consumed the liability gets no child tax credit
 * from it — and, because Part II-A exists, may get the additional child tax
 * credit refunded instead.
 * `creditLimitWorksheetA.scheduleThreeCreditsReduceTheChildTaxCredit` is what
 * watches that happen.
 *
 * The other ten summands are still documented zeros, and line 2 is still
 * written as its OWN line, computed, exactly as `qdcgt`'s own line 11 (a pure
 * copy of line 9) is kept as its own line rather than folded away
 * (AGENTS.md's "every printed line exists" discipline).
 *
 * ## What this module deliberately does NOT do
 *
 * It does not read stored documents — every input (`agiCents`,
 * `line18Cents`, `earnedIncomeCents`, `nontaxableCombatPayCents`) is a
 * caller-already-computed `bigint`, and `dependents` is the caller-supplied,
 * already-normalized array (mirroring `fjs/schedule/b`'s own
 * `hadForeignFinancialAccount === true` normalization idiom, performed by
 * the caller before this module ever sees the array). It is NOT wired into
 * `fjs/form1040/core`'s own line 19/28 aggregation — that is 13-10's job,
 * mirroring `fjs/schedule/1a`'s/`fjs/schedule/a`'s own "standalone,
 * independently callable" scope boundary.
 *
 * @module
 */
import { assert, assertEq } from 'functionalscript/fjs/asserts/module.f.js'
import { of, halfUp } from '../types/rational/module.f.js'
import { centsFromString } from '../exact/module.f.js'
import { taxParamsByYear } from '../tax/params/module.f.js'

/** @import { TaxParamSet, IndividualFilingStatus } from '../tax/params/module.f.js' */

// ── Inputs ───────────────────────────────────────────────────────────────────

/**
 * One dependent entry as this module sees it — mirrors
 * `vnd.fjs.return_profile`'s own `dependents` array element shape (13-08),
 * already normalized from that schema's `option(true)` boolean-shaped
 * fields to definite booleans by the caller (the same `=== true`
 * normalization `fjs/schedule/b` performs on `hadForeignFinancialAccount`
 * before this module's own kind of consumer ever sees it). This module
 * imports no type from `fjs/return/profile`, which exports no per-entry
 * type of its own (`fjs/schedule/a`'s own `ItemizedEntry` precedent).
 * @typedef {{
 *   readonly relationship: string,
 *   readonly ssnValidForEmployment: boolean,
 *   readonly ageAtYearEnd: number,
 *   readonly livedWithTaxpayer: boolean,
 * }} DependentEntry
 */

/**
 * Everything Schedule 8812 reads: the filing status and AGI a caller has
 * already computed, the declared `dependents` array, the tax-after-Schedule-
 * 2-Part-I amount Credit Limit Worksheet A's own line 1 needs (1040 line 18),
 * the Schedule 3 credits its line 2 subtracts (Phase 25), and the two
 * earned-income figures Part II-A's line 19 needs.
 * @typedef {{
 *   readonly status: IndividualFilingStatus,
 *   readonly agiCents: bigint,
 *   readonly dependents: readonly DependentEntry[],
 *   readonly line18Cents: bigint,
 *   readonly scheduleThreeCreditsCents: bigint,
 *   readonly earnedIncomeCents: bigint,
 *   readonly nontaxableCombatPayCents: bigint,
 * }} Form8812Input
 */

// ── The CTC/ODC phase-out's own named income function (Decision 5.6) ──────────

/**
 * TAX-15's named income function for the CTC/ODC phase-out (13-CONTEXT.md
 * Decision 5.6) — Schedule 8812 line 3, "modified AGI ... the amount on
 * line 3 of Schedule 8812" (13-RESEARCH.md §4's own glossary quote). Its own
 * add-back list, per the printed form, every term currently zero and
 * unmodeled in this engine:
 * - Puerto Rico excluded income (line 2a) — not modeled, always 0.
 * - Form 2555 line 45, foreign earned income exclusion (line 2b) — refused
 *   if declared (a scope kind this engine does not model), so always 0 for
 *   any return this engine can compute.
 * - Form 2555 line 50, foreign housing exclusion (line 2c) — same.
 *
 * Deliberately does NOT import or call `fjs/schedule/1a`'s
 * `seniorDeductionPhaseoutIncome` or `fjs/schedule/a`'s
 * `saltCapPhasedownIncome`, even though all three currently equal bare AGI
 * — the `qssParametersEqualMfjAndAreStoredIndependently` precedent
 * (`fjs/tax/params`): identical values, stored independently, because the
 * coincidence is contingent on what remains unmodeled today, not on the
 * underlying rules being the same rule. `proof` below pins the equality
 * against this module's own line 3 explicitly, rather than assuming it.
 * @type {(agiCents: bigint) => bigint}
 */
export const childTaxCreditPhaseoutIncome = agiCents => {
    // Add-backs, per this function's own docstring above — every term
    // currently zero.
    const puertoRicoExcludedIncome = 0n
    const form2555Line45ForeignEarnedIncomeExclusion = 0n
    const form2555Line50ForeignHousingExclusion = 0n
    return agiCents
        + puertoRicoExcludedIncome
        + form2555Line45ForeignEarnedIncomeExclusion
        + form2555Line50ForeignHousingExclusion
}

// ── The one $1,000-step rounding primitive this whole phase-out turns on ──────

/**
 * "If more than zero and NOT a multiple of $1,000, enter the NEXT multiple
 * of $1,000" (13-RESEARCH.md §4, Schedule 8812 line 10's own printed
 * instruction) — a true cliff, module-local (no existing precedent anywhere
 * in `fjs/`; see this module's own docstring). Ceiling-divides `cents` to
 * the next whole $1,000 (100,000 cents): an EXACT multiple stays itself
 * (never rounds up a further $1,000), and zero excess stays zero (no
 * phantom step). `{@link proof}`'s own `roundUpToNextThousandDollars`
 * block pins all three properties independently of every end-to-end
 * Schedule 8812 fixture.
 * @type {(cents: bigint) => bigint}
 */
const roundUpToNextThousandDollars = cents =>
    cents === 0n ? 0n : ((cents - 1n) / 100000n + 1n) * 100000n

// ── Schedule 8812 itself ────────────────────────────────────────────────────

/**
 * @typedef {{
 *   readonly kind: 'ok',
 *   readonly line1: bigint, readonly line2a: bigint, readonly line2b: bigint,
 *   readonly line2c: bigint, readonly line2d: bigint, readonly line3: bigint,
 *   readonly line4: bigint, readonly line5: bigint, readonly line6: bigint,
 *   readonly line7: bigint, readonly line8: bigint, readonly line9: bigint,
 *   readonly line10: bigint, readonly line11: bigint, readonly line12: bigint,
 *   readonly line13: bigint, readonly line14: bigint,
 *   readonly line16a: bigint, readonly line16b: bigint, readonly line17: bigint,
 *   readonly line18a: bigint, readonly line18b: bigint,
 *   readonly line19: bigint, readonly line20: bigint,
 *   readonly line27: bigint,
 * } | {
 *   readonly kind: 'error',
 *   readonly message: string,
 *   readonly unmodeled: readonly [],
 * }} Form8812Outcome
 */

/**
 * $5,100.00 in cents — 3 x $1,700 (the ACTC-per-child cap), the exact
 * crossover at which Part II-B (3+ qualifying children, or Puerto Rico
 * residents) becomes reachable and this module refuses (13-RESEARCH.md
 * §4's own `<` / `>=` printed test).
 * @type {bigint}
 */
const partTwoBThresholdCents = 510000n

/**
 * Computes Schedule 8812 Part I (line 19) and Part II-A (line 28) for one
 * return, from ONE function execution, sharing every internal intermediate
 * (13-CONTEXT.md Decision 4.3 — see this module's own docstring).
 * @type {(taxParamSet: TaxParamSet) => (input: Form8812Input) => Form8812Outcome}
 */
export const form8812 = taxParamSet => input => {
    const {
        status, agiCents, dependents, line18Cents, scheduleThreeCreditsCents,
        earnedIncomeCents, nontaxableCombatPayCents,
    } = input
    const { childTaxCredit } = taxParamSet

    // Classification -- derived from age + SSN validity, never supplied
    // (see module docstring, "Classification is DERIVED from facts").
    const qualifyingChildren = dependents.filter(d => d.ageAtYearEnd < 17 && d.ssnValidForEmployment)
    const otherDependents = dependents.filter(d => !(d.ageAtYearEnd < 17 && d.ssnValidForEmployment))

    // ── Part I ───────────────────────────────────────────────────────────
    // 1. "Enter the amount from Form 1040 ... line 11a" (AGI).
    const line1 = agiCents
    // 2a. Puerto Rico excluded income -- not modeled, always 0.
    const line2a = 0n
    // 2b. Form 2555 line 45 -- refused if declared, always 0 here.
    const line2b = 0n
    // 2c. Form 2555 line 50 -- same.
    const line2c = 0n
    // 2d. "Add lines 2a through 2c."
    const line2d = line2a + line2b + line2c
    // 3. "Add lines 1 and 2d." -- "modified AGI" for CTC/ODC purposes. Calls
    // {@link childTaxCreditPhaseoutIncome} directly (WR-05) rather than
    // re-deriving the identical `line1 + line2d` arithmetic a second time in
    // this file -- every add-back above is a documented, permanent 0, so
    // this is not a behavior change; `lineThreeEqualsChildTaxCreditPhaseoutIncomeForEveryFixture`
    // below still pins the equality, now trivially, as a regression guard.
    const line3 = childTaxCreditPhaseoutIncome(agiCents)
    // 4. Count of qualifying children under 17 with a required SSN.
    const line4 = BigInt(qualifyingChildren.length)
    // 5. "Multiply line 4 by $2,200."
    const line5 = line4 * centsFromString(childTaxCredit.ctcAmount.amount)
    // 6. Count of other dependents.
    const line6 = BigInt(otherDependents.length)
    // 7. "Multiply line 6 by $500."
    const line7 = line6 * centsFromString(childTaxCredit.odcAmount.amount)
    // 8. "Add lines 5 and 7."
    const line8 = line5 + line7
    // 9. $400,000 MFJ / $200,000 all other statuses.
    const line9 = status === 'marriedFilingJointly'
        ? centsFromString(childTaxCredit.phaseoutThreshold.marriedFilingJointly.amount)
        : centsFromString(childTaxCredit.phaseoutThreshold.other.amount)
    // 10. "Subtract line 9 from line 3. If zero or less, enter -0-. If more
    //     than zero and not a multiple of $1,000, enter the next multiple of
    //     $1,000." THE STEPPED CLIFF -- see module docstring.
    const excess = line3 > line9 ? line3 - line9 : 0n
    const line10 = excess === 0n ? 0n : roundUpToNextThousandDollars(excess)
    // 11. "Multiply line 10 by 5% (0.05)." Reads the STORED, cited
    // `phaseoutRatePercent` (WR-01, 13-REVIEW.md) rather than a hardcoded
    // `5n` — mirroring `fjs/schedule/1a`'s/`fjs/schedule/a`'s own
    // `BigInt(...phaseoutRatePercent)` precedent, so a future correction to
    // this stored rate actually changes the computed credit.
    const line11 = halfUp(of(line10 * BigInt(childTaxCredit.phaseoutRatePercent))(100n))
    // 12. "Is line 8 more than line 11?" If NOT (line 8 <= line 11): STOP.
    //     No CTC/ODC/ACTC at all -- every line past line 12 is unreachable
    //     on the printed page. Modeled here as control flow, not merely
    //     arithmetic that happens to land on zero.
    if (line8 <= line11) {
        return {
            kind: 'ok',
            line1, line2a, line2b, line2c, line2d, line3, line4, line5, line6, line7, line8,
            line9, line10, line11,
            line12: 0n, line13: 0n, line14: 0n,
            line16a: 0n, line16b: 0n, line17: 0n,
            line18a: 0n, line18b: 0n, line19: 0n, line20: 0n,
            line27: 0n,
        }
    }
    const line12 = line8 - line11
    // 13. Credit Limit Worksheet A, computed explicitly here -- line2 is a
    //     documented zero (see module docstring), not hard-coded away.
    const clwLine1 = line18Cents
    // 2. Schedule 3 lines 1, 2, 3, 4, 6d, 6e, 6f, 6l, 6m and Forms
    //    5695/8910/8936. Lines 3 and 4 are REAL as of Phase 25 and arrive as
    //    an input; the other ten are documented zeros because each is a
    //    refused `fjs/return/scope` kind. See this module's own docstring.
    const clwLine2 = scheduleThreeCreditsCents
    // 3. "Subtract line 2 from line 1." The floor is this engine's, not the
    //    printed page's -- the worksheet assumes line 1 is the larger, which
    //    was necessarily true while line 2 was always zero and is not any
    //    more.
    const clwLine3 = clwLine1 > clwLine2 ? clwLine1 - clwLine2 : 0n
    const line13 = clwLine3
    // 14. "Smaller of line 12 or line 13." -> 1040 line 19.
    const line14 = line12 < line13 ? line12 : line13

    // ── Part II-A ────────────────────────────────────────────────────────
    // 16a. "Subtract line 14 from line 12." Never negative -- line 14 is a
    //      `min` against line 12 (the "no-floor assertion" idiom, `qdcgt`).
    const line16a = line12 - line14
    assert(line16a >= 0n, ['Schedule 8812 line 16a must never be negative', line16a])
    // 16b. Count of qualifying children under 17 with SSN, x $1,700 (the
    //      ACTC-per-child cap).
    const line16b = line4 * centsFromString(childTaxCredit.actcCap.amount)
    // Part II-B (3+ qualifying children / Puerto Rico residents) is OUT OF
    // SCOPE this phase -- refuse honestly, before line 17 is computed,
    // rather than silently compute a wrong Part II-A result (module
    // docstring, "Part II-B ... is REFUSED").
    if (line16b >= partTwoBThresholdCents) {
        return {
            kind: 'error',
            message: 'Schedule 8812 Part II-B (3+ qualifying children or Puerto Rico residents) is not modeled this phase',
            unmodeled: [],
        }
    }
    // 17. "Smaller of line 16a or line 16b." Part II-B skipped
    //     (line16b < $5,100).
    const line17 = line16a < line16b ? line16a : line16b
    // 18a/18b. Earned income and nontaxable combat pay, taken as given.
    const line18a = earnedIncomeCents
    const line18b = nontaxableCombatPayCents
    // 19. "Is line 18a more than $2,500?" Reads the STORED, cited
    // `actcEarnedIncomeThreshold` (WR-01) rather than a hardcoded `250000n`.
    const actcEarnedIncomeThresholdCents = centsFromString(childTaxCredit.actcEarnedIncomeThreshold.amount)
    const line19 = line18a > actcEarnedIncomeThresholdCents ? line18a - actcEarnedIncomeThresholdCents : 0n
    // 20. "Multiply line 19 by 15% (0.15)." Reads the STORED, cited
    // `actcEarnedIncomeRatePercent` rather than a hardcoded `15n`.
    const line20 = halfUp(of(line19 * BigInt(childTaxCredit.actcEarnedIncomeRatePercent))(100n))
    // 27. "Smaller of line 17 or line 20" (Part II-B skipped). -> 1040 line 28.
    const line27 = line17 < line20 ? line17 : line20

    return {
        kind: 'ok',
        line1, line2a, line2b, line2c, line2d, line3, line4, line5, line6, line7, line8,
        line9, line10, line11, line12, line13, line14,
        line16a, line16b, line17, line18a, line18b, line19, line20, line27,
    }
}

// ── Tests ────────────────────────────────────────────────────────────────────

/**
 * TY2025's parameter set, narrowed exactly ONCE at module scope, mirroring
 * `fjs/schedule/1a`'s/`fjs/schedule/a`'s own precedent.
 */
const taxParams2025 = taxParamsByYear[2025]
assert(taxParams2025 !== undefined, 'expected TY2025 parameters to be present in taxParamsByYear')

/** @type {(ageAtYearEnd: number) => (ssnValidForEmployment: boolean) => DependentEntry} */
const dependent = ageAtYearEnd => ssnValidForEmployment => ({
    relationship: 'child',
    ssnValidForEmployment,
    ageAtYearEnd,
    livedWithTaxpayer: true,
})

/** @type {(overrides: Partial<Form8812Input>) => Form8812Input} */
const baseInput = overrides => ({
    status: 'single',
    agiCents: 0n,
    dependents: [],
    line18Cents: 0n,
    scheduleThreeCreditsCents: 0n,
    earnedIncomeCents: 0n,
    nontaxableCombatPayCents: 0n,
    ...overrides,
})

/**
 * Asserts the outcome is `kind: 'ok'` and returns it narrowed, so every
 * fixture below can read line fields without repeating the discriminant
 * check.
 * @type {(outcome: Form8812Outcome) => Extract<Form8812Outcome, { kind: 'ok' }>}
 */
const expectOk = outcome => {
    assert(outcome.kind === 'ok', ['expected an ok outcome', outcome])
    if (outcome.kind !== 'ok') { throw ['unreachable', outcome] }
    return outcome
}

export const proof = {
    // Test 1 (classification, derived from age + SSN validity).
    classification: {
        underSeventeenWithValidSsnCountsAsQualifyingChild: () => {
            const result = expectOk(form8812(taxParams2025)(baseInput({
                dependents: [dependent(10)(true)],
            })))
            assertEq(result.line4, 1n, 'line 4 = 1 qualifying child')
            assertEq(result.line6, 0n, 'line 6 = 0 other dependents')
            assertEq(result.line5, 220000n, 'line 5 = $2,200.00')
        },
        twentyYearOldCountsAsOtherDependentRegardlessOfSsn: () => {
            const result = expectOk(form8812(taxParams2025)(baseInput({
                dependents: [dependent(20)(true)],
            })))
            assertEq(result.line4, 0n, 'line 4 = 0 qualifying children')
            assertEq(result.line6, 1n, 'line 6 = 1 other dependent')
            assertEq(result.line7, 50000n, 'line 7 = $500.00')
        },
        underSeventeenWithoutValidSsnCountsAsOtherDependentNotQualifyingChild: () => {
            const result = expectOk(form8812(taxParams2025)(baseInput({
                dependents: [dependent(10)(false)],
            })))
            assertEq(result.line4, 0n, 'line 4 = 0 -- age alone is not enough, per the form\'s own two-fact test')
            assertEq(result.line6, 1n, 'line 6 = 1 -- falls through to ODC')
        },
    },

    // Test 2 (the stepped cliff, the highest-risk boundary in this phase).
    steppedCliff: {
        mfjOneCentOverThresholdCostsTheFullFiftyDollarStep: () => {
            const atThreshold = expectOk(form8812(taxParams2025)(baseInput({
                status: 'marriedFilingJointly',
                agiCents: 40000000n, // $400,000.00 -- exactly at the threshold
                dependents: [dependent(10)(true)],
                line18Cents: 100000000n,
            })))
            assertEq(atThreshold.line10, 0n, 'line 10 = $0.00 at exactly the threshold')
            assertEq(atThreshold.line11, 0n, 'line 11 = $0.00 at exactly the threshold')

            const overThreshold = expectOk(form8812(taxParams2025)(baseInput({
                status: 'marriedFilingJointly',
                agiCents: 40000001n, // $400,000.01 -- one cent over
                dependents: [dependent(10)(true)],
                line18Cents: 100000000n,
            })))
            assertEq(overThreshold.line10, 100000n, 'line 10 = $1,000.00 -- $0.01 excess rounds UP to the next $1,000')
            assertEq(
                overThreshold.line11, 5000n,
                'line 11 = $50.00 -- a SINGLE CENT over the threshold costs the full $50 step immediately',
            )
        },
        // Contrast with `fjs/schedule/1a`'s own continuous phase-out at its
        // own threshold: there, one cent of excess moves the deduction by
        // 0.06 cents (below the half-cent rounding threshold, i.e.
        // effectively $0.00 of visible movement) -- see
        // `fjs/schedule/1a`'s own `phaseoutStartBoundaryTrioSingle`. Here,
        // one cent of excess moves the credit by the FULL $50.00 first step
        // -- the defining difference between a continuous curve and a true
        // stepped cliff.
        otherStatusThresholdBoundaryTrio: () => {
            const below = expectOk(form8812(taxParams2025)(baseInput({
                status: 'single',
                agiCents: 19999999n, // $199,999.99 -- one cent below
                dependents: [dependent(10)(true)],
                line18Cents: 100000000n,
            })))
            assertEq(below.line10, 0n, 'one cent below: line 10 = $0.00')
            assertEq(below.line11, 0n, 'one cent below: line 11 = $0.00')

            const at = expectOk(form8812(taxParams2025)(baseInput({
                status: 'single',
                agiCents: 20000000n, // $200,000.00 -- exactly at
                dependents: [dependent(10)(true)],
                line18Cents: 100000000n,
            })))
            assertEq(at.line10, 0n, 'exactly at: line 10 = $0.00 ("if zero or less")')
            assertEq(at.line11, 0n, 'exactly at: line 11 = $0.00')

            const above = expectOk(form8812(taxParams2025)(baseInput({
                status: 'single',
                agiCents: 20000001n, // $200,000.01 -- one cent above
                dependents: [dependent(10)(true)],
                line18Cents: 100000000n,
            })))
            assertEq(above.line10, 100000n, 'one cent above: line 10 = $1,000.00 -- the cliff')
            assertEq(above.line11, 5000n, 'one cent above: line 11 = $50.00, the full step')
        },
    },

    // Test 3 (roundUpToNextThousandDollars, standalone -- this module's own
    // highest-risk primitive, per its own dedicated proofs).
    roundUpToNextThousandDollars: {
        oneCentRoundsUpToTheFirstThousand: () => {
            assertEq(roundUpToNextThousandDollars(1n), 100000n, '$0.01 -> $1,000.00')
        },
        exactMultipleDoesNotRoundUpAgain: () => {
            assertEq(
                roundUpToNextThousandDollars(100000n), 100000n,
                '$1,000.00, already an exact multiple, stays $1,000.00 -- does NOT round to $2,000.00',
            )
        },
        oneCentOverAMultipleRoundsUpToTheNextOne: () => {
            assertEq(roundUpToNextThousandDollars(100001n), 200000n, '$1,000.01 -> $2,000.00')
        },
        zeroExcessStaysZeroNoPhantomStep: () => {
            assertEq(roundUpToNextThousandDollars(0n), 0n, '$0.00 excess must not produce a phantom $1,000.00 step')
        },
        // The $50-per-step cliff at exactly threshold + 1 cent, standalone
        // (independent of the full end-to-end fixtures above): 5% of the
        // FIRST rounded step.
        fiftyDollarCliffAtOneCentOverAThreshold: () => {
            const rounded = roundUpToNextThousandDollars(1n) // threshold + $0.01 excess
            const fivePercent = halfUp(of(rounded * 5n)(100n))
            assertEq(fivePercent, 5000n, '5% of the first $1,000 step = $50.00')
        },
    },

    // Test 4 (Part I -> Part II-A sharing intermediates, one function
    // execution, never leaving Part II-A independently computable on stale
    // Part I state).
    partOneStopShortCircuitsBothParts: () => {
        // Zero dependents -> line8 = $0, which is <= line11 ($0) at any
        // income -- line 12's own STOP fires immediately.
        const result = expectOk(form8812(taxParams2025)(baseInput({
            status: 'single',
            agiCents: 5000000n, // $50,000.00
            dependents: [],
            line18Cents: 100000000n,
            earnedIncomeCents: 6000000n,
            nontaxableCombatPayCents: 0n,
        })))
        assertEq(result.line8, 0n, 'line 8 = $0.00 -- no dependents')
        assertEq(result.line12, 0n, 'line 12 = $0.00 -- STOP')
        assertEq(result.line13, 0n, 'line 13 = $0.00 -- unreachable past the STOP')
        assertEq(result.line14, 0n, 'line 14 = $0.00 -- 1040 line 19 gets nothing')
        assertEq(result.line16a, 0n, 'line 16a = $0.00 -- Part II-A never independently computed')
        assertEq(result.line16b, 0n, 'line 16b = $0.00')
        assertEq(result.line27, 0n, 'line 27 = $0.00 -- 1040 line 28 gets nothing either, from the SAME STOP')
        // A high-income single filer with ONE qualifying child: line8 =
        // $2,200 fully phased out by an income far past the threshold, so
        // line11 alone exceeds line8 -- the SAME STOP, reached through the
        // phase-out this time, not through zero dependents.
        const phasedOutResult = expectOk(form8812(taxParams2025)(baseInput({
            status: 'single',
            agiCents: 100000000n, // $1,000,000.00 -- deep past the $200,000 threshold
            dependents: [dependent(10)(true)],
            line18Cents: 100000000n,
        })))
        assertEq(phasedOutResult.line11 >= phasedOutResult.line8, true, 'line 11 fully consumes line 8')
        assertEq(phasedOutResult.line12, 0n, 'line 12 = $0.00 -- STOP via the phase-out, not via zero dependents')
        assertEq(phasedOutResult.line27, 0n, 'line 27 = $0.00 -- the same STOP reaches Part II-A')
    },

    // Test 5 (ACTC, line16b < $5,100, Part II-B skipped).
    actcPartTwoBSkippedUnderTheThreshold: () => {
        const result = expectOk(form8812(taxParams2025)(baseInput({
            status: 'single',
            agiCents: 5000000n, // $50,000.00 -- well under the phase-out threshold
            dependents: [dependent(5)(true), dependent(8)(true)], // 2 qualifying children
            line18Cents: 100000000n, // ample tax liability, so line13 never binds
            earnedIncomeCents: 6000000n, // $60,000.00
            nontaxableCombatPayCents: 0n,
        })))
        assertEq(result.line4, 2n, 'line 4 = 2 qualifying children')
        assertEq(result.line16b, 340000n, 'line 16b = $3,400.00 = $1,700 x 2 -- under $5,100')
        assertEq(result.line19, 5750000n, 'line 19 = $57,500.00 = $60,000 - $2,500')
        assertEq(result.line20, 862500n, 'line 20 = $8,625.00 -- 15% of line 19')
        assertEq(
            result.line27, result.line17 < result.line20 ? result.line17 : result.line20,
            'line 27 = smaller of line 17 or line 20 directly -- Part II-B never entered',
        )
    },

    // Test 6 (Part II-B boundary, documented refusal -- named, never silent).
    partTwoBRefusal: {
        threeQualifyingChildrenRefusesNamingPartTwoB: () => {
            const outcome = form8812(taxParams2025)(baseInput({
                status: 'single',
                agiCents: 5000000n,
                dependents: [dependent(5)(true), dependent(8)(true), dependent(11)(true)], // 3
                line18Cents: 100000000n,
                earnedIncomeCents: 6000000n,
            }))
            assertEq(outcome.kind, 'error', 'expected a refusal, never a silently-wrong line27')
            if (outcome.kind === 'error') {
                assert(
                    outcome.message.includes('Part II-B'),
                    ['expected the refusal to name Part II-B', outcome.message],
                )
                assertEq(outcome.unmodeled.length, 0, 'unmodeled is empty -- this is not a fjs/return/scope kind refusal')
            }
        },
        // The control: 2 qualifying children (the SAME income/liability
        // shape) computes normally, never refusing.
        twoQualifyingChildrenIsTheControlAndComputesNormally: () => {
            const outcome = form8812(taxParams2025)(baseInput({
                status: 'single',
                agiCents: 5000000n,
                dependents: [dependent(5)(true), dependent(8)(true)], // 2
                line18Cents: 100000000n,
                earnedIncomeCents: 6000000n,
            }))
            assertEq(outcome.kind, 'ok', 'expected the 2-child control to compute, not refuse')
        },
    },

    // Test 7 (Credit Limit Worksheet A modeled explicitly, not collapsed).
    creditLimitWorksheetA: {
        cappedByLine13WhenTaxLiabilityIsSmall: () => {
            const result = expectOk(form8812(taxParams2025)(baseInput({
                status: 'single',
                agiCents: 5000000n,
                dependents: [dependent(10)(true)], // line8 = $2,200
                line18Cents: 100000n, // $1,000.00 tax after Schedule 2 Part I -- smaller than line12
            })))
            assertEq(result.line13, 100000n, 'line 13 = clw line3 = clw line1 - clw line2 (zero here) = $1,000.00')
            assertEq(result.line14, 100000n, 'line 14 = smaller of line12 ($2,200) or line13 ($1,000) = $1,000.00')
        },
        // **§26's ordering, watched.** Phase 25 made worksheet line 2 real:
        // Schedule 3's education and saver's credits come out of the tax
        // BEFORE the child tax credit sees it. The same $1,000.00 of tax,
        // with $600.00 already consumed by Schedule 3, leaves $400.00.
        //
        // Hand-derived: clw line 1 = $1,000.00, line 2 = $600.00, line 3 =
        // $400.00. Line 12 = $2,200.00 (one qualifying child, no phase-out),
        // so line 14 = min($2,200.00, $400.00) = $400.00 -> 1040 line 19.
        scheduleThreeCreditsReduceTheChildTaxCredit: () => {
            const result = expectOk(form8812(taxParams2025)(baseInput({
                status: 'single',
                agiCents: 5000000n,
                dependents: [dependent(10)(true)],
                line18Cents: 100000n,
                scheduleThreeCreditsCents: 60000n,
            })))
            assertEq(result.line13, 40000n, '$1,000.00 of tax less $600.00 of Schedule 3 credits')
            assertEq(result.line14, 40000n, '-> 1040 line 19')
            // …and the credit the child tax credit could not use is not lost:
            // line 16a carries it into Part II-A, where the ADDITIONAL child
            // tax credit may refund it. Ordering moves money between two
            // 1040 lines rather than destroying it, which is the property a
            // reader of the worksheet most needs to see.
            assertEq(result.line16a, 180000n, '$2,200.00 - $400.00 = $1,800.00 into Part II-A')
        },
        // Schedule 3 credits exceeding the whole liability leave NOTHING for
        // the child tax credit, and worksheet line 3 floors at zero rather
        // than going negative — a floor this engine had no way to reach until
        // line 2 stopped being a constant.
        scheduleThreeCreditsExceedingTheLiabilityFloorAtZero: () => {
            const result = expectOk(form8812(taxParams2025)(baseInput({
                status: 'single',
                agiCents: 5000000n,
                dependents: [dependent(10)(true)],
                line18Cents: 100000n,
                scheduleThreeCreditsCents: 250000n,
            })))
            assertEq(result.line13, 0n, 'never negative')
            assertEq(result.line14, 0n, '1040 line 19 gets nothing')
        },
    },

    // WR-01 (13-REVIEW.md): line11/line19/line20 must read `childTaxCredit`'s
    // STORED rate/threshold, not a hardcoded literal that happens to equal
    // it today. Each figure is independently hand-computed here directly
    // from `taxParams2025.childTaxCredit`, not from a copy of this module's
    // own arithmetic -- a stored-parameter change that this module failed to
    // read would diverge from these expectations even though nothing in
    // this module's own source changed.
    ratesAndThresholdReadFromStoredParams: {
        phaseoutRateMatchesStoredPercent: () => {
            const result = expectOk(form8812(taxParams2025)(baseInput({
                status: 'single',
                agiCents: 20000001n, // $200,000.01 -- one cent over the threshold
                dependents: [dependent(10)(true)],
            })))
            const expectedLine11 = halfUp(of(result.line10 * BigInt(taxParams2025.childTaxCredit.phaseoutRatePercent))(100n))
            assertEq(result.line11, expectedLine11, 'line 11 must equal line10 x the STORED phaseoutRatePercent')
            assertEq(taxParams2025.childTaxCredit.phaseoutRatePercent, 5, 'today\'s stored rate is 5%')
        },
        actcFloorAndRateMatchStoredParams: () => {
            const result = expectOk(form8812(taxParams2025)(baseInput({
                status: 'single',
                agiCents: 5000000n,
                dependents: [dependent(5)(true)],
                line18Cents: 100000000n,
                earnedIncomeCents: 6000000n, // $60,000.00
            })))
            const storedThresholdCents = centsFromString(taxParams2025.childTaxCredit.actcEarnedIncomeThreshold.amount)
            const expectedLine19 = result.line18a > storedThresholdCents ? result.line18a - storedThresholdCents : 0n
            assertEq(result.line19, expectedLine19, 'line 19 must use the STORED actcEarnedIncomeThreshold')
            const expectedLine20 = halfUp(of(expectedLine19 * BigInt(taxParams2025.childTaxCredit.actcEarnedIncomeRatePercent))(100n))
            assertEq(result.line20, expectedLine20, 'line 20 must use the STORED actcEarnedIncomeRatePercent')
            assertEq(taxParams2025.childTaxCredit.actcEarnedIncomeThreshold.amount, '2500.00', 'today\'s stored floor is $2,500.00')
            assertEq(taxParams2025.childTaxCredit.actcEarnedIncomeRatePercent, 15, 'today\'s stored rate is 15%')
        },
    },

    // Part I's own line 3 and `childTaxCreditPhaseoutIncome` are the SAME
    // rule, asserted equal on every fixture -- documented, not silently
    // assumed (TAX-15/Decision 5.6's precedent, mirroring the equivalent
    // equality proof `fjs/schedule/1a` writes for its own phase-out income
    // function).
    linkedIncomeFunction: {
        lineThreeEqualsChildTaxCreditPhaseoutIncomeForEveryFixture: () => {
            for (const agi of [0n, 8000000n, 20000001n, 40000001n, 99999999n]) {
                const result = expectOk(form8812(taxParams2025)(baseInput({ agiCents: agi })))
                assertEq(result.line3, childTaxCreditPhaseoutIncome(agi))
            }
        },
        childTaxCreditPhaseoutIncomeEqualsBareAgiToday: () => {
            assertEq(childTaxCreditPhaseoutIncome(0n), 0n)
            assertEq(childTaxCreditPhaseoutIncome(12345600n), 12345600n)
        },
    },
}
