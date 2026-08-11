/**
 * Schedule 1-A (TY2025) — TAX-09: Parts I (Modified Adjusted Gross Income),
 * V (Enhanced Deduction for Seniors), and VI (Total Additional Deductions).
 * Parts II/III/IV (tips, overtime, car loan interest) are OUT OF this
 * phase's scope (13-CONTEXT.md Decision 3.2) — documented zeros, boundary
 * stated below, never silently omitted.
 *
 * Source, transcribed directly (13-RESEARCH.md §1), not from recall:
 * `f1040s1a.pdf` (2025), both pages, "Created 11/4/25".
 *
 * ## The MFS short-circuit runs BEFORE the arithmetic (Decision 5.4/Pitfall 3)
 *
 * The printed caution box: "If married, you must file jointly to claim
 * this deduction." A married-filing-separately filer gets $0
 * UNCONDITIONALLY, at ANY income — MFS shares the non-MFJ $75,000
 * threshold on the form's face, so a low-income MFS filer would otherwise
 * compute a NONZERO deduction if this were left to fall out of the
 * arithmetic. {@link scheduleOneAPartV} returns a zeroed part as its FIRST
 * statement when `status === 'marriedFilingSeparately'`, before `line31` is
 * even assigned — mirroring `fjs/tax/deduction`'s `standardDeductionCents`
 * "exceptions return zero before any increment is added" ordering
 * discipline.
 *
 * ## The phase-out is CONTINUOUS, not $1,000-stepped (Decision 5.5)
 *
 * Line 34 is 6% of the excess over the threshold, computed CENT-EXACT via
 * `halfUp`/`of` (`fjs/types/rational`) — never rounded to a $1,000
 * increment first. This is the opposite convention from Schedule 1-A's OWN
 * tips/overtime/car-loan parts (13-RESEARCH.md §7: stepped, $1,000
 * increments) and from Schedule 8812's CTC/ODC phase-out (stepped, a true
 * cliff) — getting this backwards is this phase's single most likely
 * silent-wrong-number failure (13-CONTEXT.md Decision 5.5).
 *
 * ## Per-taxpayer, not per-return (line36a/36b)
 *
 * The phase-out (lines 31-35) is computed ONCE on the combined MAGI,
 * producing a single already-reduced amount (line35) — but that SAME
 * amount is then granted SEPARATELY to each spouse who independently
 * qualifies (line36a/36b), up to $12,000 combined for an MFJ couple where
 * both spouses are 65+. It is not "one $6,000 phased out once."
 *
 * ## Part I's MAGI is NOT a new concept from AGI (Pitfall 6)
 *
 * Part I literally starts "Enter the amount from Form 1040 ... line 11b"
 * (AGI) and adds foreign-income items this engine never computes (always
 * zero). {@link seniorDeductionPhaseoutIncome} takes the ALREADY-COMPUTED
 * AGI as its input rather than re-deriving it from stored documents, and is
 * one of TAX-15's four separately-named income-measure functions
 * (13-CONTEXT.md Decision 5.6) — it deliberately does not share a name or
 * import with `saltCapPhasedownIncome` or the CTC/ODC phase-out's own
 * income function (both later plans), even though all three currently
 * equal bare AGI: the coincidence is contingent on what remains unmodeled,
 * not on the rules being the same rule.
 *
 * ## Parts II/III/IV are documented zeros, not refusals (Decision 3.2)
 *
 * The frozen 50-kind vocabulary carries exactly ONE kind
 * (`seniorAndOtherScheduleOneADeductions`) for the whole of Schedule 1-A,
 * so a *scope* refusal for the tips/overtime/car-loan parts is not
 * expressible. Each is instead a `ReportLine` with `value: 0n`, citing the
 * profile's own `declaredKinds` box — `fjs/schedule/b`'s Form 8815
 * treatment, copied verbatim in shape. A future phase widening the dialect
 * vocabulary knows exactly what to revisit.
 *
 * ## Why a record and not an array
 *
 * Same reason as `fjs/tax/line16/qdcgt`/`fjs/tax/ssb`:
 * `noUncheckedIndexedAccess` makes an array index `bigint | undefined`, and
 * a record indexes cleanly with the printed line numbers carried in the
 * field names (TAX-15).
 *
 * ## What this module deliberately does NOT do
 *
 * It does not read stored documents (the caller-computed AGI is a trusted
 * `bigint` input) and it is NOT wired into `fjs/form1040/core`'s own line
 * 13b aggregation or `fjs/return/scope`'s kind classification — both are
 * Plan 13-04's job, mirroring `fjs/schedule/b`'s own "standalone,
 * independently callable" boundary.
 *
 * @module
 */
import { assert, assertEq } from 'functionalscript/fjs/asserts/module.f.js'
import { of, multiply, halfUp } from '../../types/rational/module.f.js'
import { centsFromString } from '../../exact/module.f.js'
import { taxParamsByYear } from '../../tax/params/module.f.js'

/** @import { TaxParamSet, IndividualFilingStatus } from '../../tax/params/module.f.js' */
/** @import { ReturnProfile } from '../../return/profile/module.f.js' */
/** @import { ReportLine } from '../../report/line/module.f.js' */

/**
 * A stored document as this module sees it — mirrors `fjs/schedule/b`'s
 * own `Stored<T>`; nothing here re-validates.
 * @template T
 * @typedef {{ readonly documentHash: string, readonly value: T }} Stored
 */

/**
 * Rounds `cents * (percent / 100)` to the nearest cent, ties away from zero
 * (IRS half-up) — line34's own 6% multiplication. Reimplemented locally
 * (not imported from `fjs/tax/ssb`, which does not export it) per this
 * project's "reimplement an idiom you cannot import" precedent
 * (`fjs/schedule/b`).
 * @type {(cents: bigint) => (percent: bigint) => bigint}
 */
const percentOfCents = cents => percent => halfUp(multiply(of(cents)(1n))(of(percent)(100n)))

/**
 * TAX-15's named income function for the senior-deduction phase-out
 * (13-CONTEXT.md Decision 3.5/5.6) — Schedule 1-A Part I, line 3, "the
 * shared MAGI." Its own add-back list, per the printed form (13-RESEARCH.md
 * §1), every term currently zero and unmodeled in this engine (Pitfall 6):
 * - Puerto Rico excluded income (line 2a) — not modeled, always 0.
 * - Form 2555 line 45, foreign earned income exclusion (line 2b) —
 *   refused if declared (a scope kind this engine does not model), so
 *   always 0 for any return this engine can compute.
 * - Form 2555 line 50, foreign housing exclusion (line 2c) — same.
 * - Form 4563 line 15, American Samoa income exclusion (line 2d) — not
 *   modeled, always 0.
 *
 * Reads the ALREADY-COMPUTED AGI as input, per Pitfall 6, rather than
 * re-deriving it from stored documents.
 * @type {(agiCents: bigint) => bigint}
 */
export const seniorDeductionPhaseoutIncome = agiCents => {
    // Add-backs, per the printed form (see this function's own docstring
    // above) — every term currently zero.
    const puertoRicoExcludedIncome = 0n
    const form2555Line45ForeignEarnedIncomeExclusion = 0n
    const form2555Line50ForeignHousingExclusion = 0n
    const form4563Line15AmericanSamoaExclusion = 0n
    return agiCents
        + puertoRicoExcludedIncome
        + form2555Line45ForeignEarnedIncomeExclusion
        + form2555Line50ForeignHousingExclusion
        + form4563Line15AmericanSamoaExclusion
}

/**
 * @typedef {{
 *   readonly line1: bigint, readonly line2a: bigint, readonly line2b: bigint,
 *   readonly line2c: bigint, readonly line2d: bigint, readonly line2e: bigint,
 *   readonly line3: bigint,
 * }} SchedulePartIResult
 */

/**
 * Schedule 1-A Part I, lines 1-3 — "Modified Adjusted Gross Income (MAGI)
 * Amount", the shared input to Parts II-V.
 * @type {(agiCents: bigint) => SchedulePartIResult}
 */
export const scheduleOneAPartI = agiCents => {
    // 1. "Enter the amount from Form 1040 ... line 11b" (AGI).
    const line1 = agiCents
    // 2a. Puerto Rico excluded income -- not modeled, always 0.
    const line2a = 0n
    // 2b. Form 2555 line 45 -- refused if declared, always 0 here.
    const line2b = 0n
    // 2c. Form 2555 line 50 -- same.
    const line2c = 0n
    // 2d. Form 4563 line 15 -- not modeled, always 0.
    const line2d = 0n
    // 2e. "Add lines 2a through 2d."
    const line2e = line2a + line2b + line2c + line2d
    // 3. "Add lines 1 and 2e." -- Schedule 1-A's shared MAGI.
    const line3 = line1 + line2e
    return { line1, line2a, line2b, line2c, line2d, line2e, line3 }
}

/**
 * @typedef {{
 *   readonly line31: bigint, readonly line32: bigint, readonly line33: bigint,
 *   readonly line34: bigint, readonly line35: bigint, readonly line36a: bigint,
 *   readonly line36b: bigint, readonly line37: bigint,
 * }} SchedulePartVResult
 */

/**
 * @typedef {{
 *   readonly status: IndividualFilingStatus,
 *   readonly phaseoutIncomeCents: bigint,
 *   readonly taxpayerHasValidSsnAndBornBefore1961Jan2: boolean,
 *   readonly spouseHasValidSsnAndBornBefore1961Jan2: boolean,
 * }} SchedulePartVInput
 */

/**
 * Schedule 1-A Part V, lines 31-37 — transcribed exactly per
 * 13-RESEARCH.md's own transcription of f1040s1a.pdf (2025) p2. See this
 * module's own docstring for the MFS short-circuit and the continuous
 * (never $1,000-stepped) phase-out.
 * @type {(taxParamSet: TaxParamSet) => (input: SchedulePartVInput) => SchedulePartVResult}
 */
export const scheduleOneAPartV = taxParamSet => input => {
    const {
        status, phaseoutIncomeCents,
        taxpayerHasValidSsnAndBornBefore1961Jan2, spouseHasValidSsnAndBornBefore1961Jan2,
    } = input
    // Decision 5.4/Pitfall 3: the MFS short-circuit runs BEFORE line31 is
    // even assigned -- a filing-status gate, not a consequence of the
    // arithmetic below.
    if (status === 'marriedFilingSeparately') {
        return { line31: 0n, line32: 0n, line33: 0n, line34: 0n, line35: 0n, line36a: 0n, line36b: 0n, line37: 0n }
    }
    const { seniorDeduction } = taxParamSet
    const mfj = status === 'marriedFilingJointly'
    // 31. "Enter the amount from Part I, line 3" -- the shared MAGI.
    const line31 = phaseoutIncomeCents
    // 32. Filing-status threshold -- $150,000 MFJ, $75,000 every other
    //     status this branch reaches (single/HoH/QSS).
    const line32 = centsFromString(seniorDeduction.phaseoutThreshold[status].amount)
    // 33. "Subtract line 32 from line 31. If zero or less, skip line 34 and
    //     enter $6,000 on line 35."
    const line33 = line31 > line32 ? line31 - line32 : 0n
    // 34. "Multiply line 33 by 6% (0.06)." CONTINUOUS -- never rounded to a
    //     $1,000 increment (Decision 5.5).
    const line34 = percentOfCents(line33)(BigInt(seniorDeduction.phaseoutRatePercent))
    const baseCents = centsFromString(seniorDeduction.amount.amount)
    // 35. "Subtract line 34 from $6,000. If zero or less, enter -0-."
    const line35 = line34 < baseCents ? baseCents - line34 : 0n
    // 36a. "If you have a valid SSN and were born before January 2, 1961,
    //      enter the amount from line 35" -- otherwise blank (0).
    const line36a = taxpayerHasValidSsnAndBornBefore1961Jan2 ? line35 : 0n
    // 36b. Same test, for the spouse -- only reachable when MFJ.
    const line36b = mfj && spouseHasValidSsnAndBornBefore1961Jan2 ? line35 : 0n
    // 37. "Add lines 36a and 36b." -- "Enhanced deduction for seniors."
    const line37 = line36a + line36b
    assert(line37 >= 0n, ['Schedule 1-A line 37 must never be negative', line37])
    return { line31, line32, line33, line34, line35, line36a, line36b, line37 }
}

/**
 * A line that is zero because the taxpayer declared no such income, citing
 * the return profile's own `declaredKinds` box — reimplemented locally,
 * private, per `fjs/schedule/b`'s own precedent (this module does not
 * import from `fjs/form1040/core`, which does not export this helper).
 * @type {(profile: Stored<ReturnProfile>) => (rule: string) => ReportLine}
 */
const profileDeclaredZeroLine = profile => rule => ({
    value: 0n,
    sources: [{
        documentHash: profile.documentHash,
        boxPath: 'declaredKinds',
        value: JSON.stringify(profile.value.declaredKinds),
    }],
    rule,
})

/**
 * @typedef {{
 *   readonly line13: ReportLine, readonly line21: ReportLine, readonly line30: ReportLine,
 *   readonly line37: bigint, readonly line38: bigint,
 * }} SchedulePartVIResult
 */

/**
 * Schedule 1-A Part VI, line 38 — "Total Additional Deductions." Lines 13
 * (tips, Part II), 21 (overtime, Part III), and 30 (car loan interest, Part
 * IV) are DOCUMENTED ZEROS — out of this phase's scope (13-CONTEXT.md
 * Decision 3.2), never silently omitted; see this module's own docstring.
 * @type {(profile: Stored<ReturnProfile>) => (line37: bigint) => SchedulePartVIResult}
 */
export const scheduleOneAPartVI = profile => line37 => {
    const zero = profileDeclaredZeroLine(profile)
    // 13. "No Tax on Tips" (Part II) -- not modeled this phase; see this
    //     module's own docstring, "Parts II/III/IV are documented zeros".
    const line13 = zero('Schedule 1-A line 13 (No Tax on Tips, Part II -- not modeled this phase)')
    // 21. "No Tax on Overtime" (Part III) -- same boundary.
    const line21 = zero('Schedule 1-A line 21 (No Tax on Overtime, Part III -- not modeled this phase)')
    // 30. "No Tax on Car Loan Interest" (Part IV) -- same boundary.
    const line30 = zero('Schedule 1-A line 30 (No Tax on Car Loan Interest, Part IV -- not modeled this phase)')
    // 38. "Add lines 13, 21, 30, and 37." -> Form 1040/1040-SR line 13b.
    const line38 = line13.value + line21.value + line30.value + line37
    return { line13, line21, line30, line37, line38 }
}

/**
 * @typedef {{
 *   readonly status: IndividualFilingStatus,
 *   readonly agiCents: bigint,
 *   readonly taxpayerHasValidSsnAndBornBefore1961Jan2: boolean,
 *   readonly spouseHasValidSsnAndBornBefore1961Jan2: boolean,
 *   readonly profile: Stored<ReturnProfile>,
 * }} ScheduleOneAInput
 */

/**
 * @typedef {{
 *   readonly partI: SchedulePartIResult,
 *   readonly partV: SchedulePartVResult,
 *   readonly partVI: SchedulePartVIResult,
 * }} ScheduleOneA
 */

/**
 * Computes Schedule 1-A (Parts I, V, VI) for one return.
 * @type {(taxParamSet: TaxParamSet) => (input: ScheduleOneAInput) => ScheduleOneA}
 */
export const scheduleOneA = taxParamSet => input => {
    const {
        status, agiCents,
        taxpayerHasValidSsnAndBornBefore1961Jan2, spouseHasValidSsnAndBornBefore1961Jan2,
        profile,
    } = input
    const partI = scheduleOneAPartI(agiCents)
    const partV = scheduleOneAPartV(taxParamSet)({
        status, phaseoutIncomeCents: partI.line3,
        taxpayerHasValidSsnAndBornBefore1961Jan2, spouseHasValidSsnAndBornBefore1961Jan2,
    })
    const partVI = scheduleOneAPartVI(profile)(partV.line37)
    return { partI, partV, partVI }
}

// ── Tests ────────────────────────────────────────────────────────────────────

/**
 * TY2025's parameter set, narrowed exactly ONCE at module scope, mirroring
 * `fjs/tax/ssb`'s own precedent.
 */
const taxParams2025 = taxParamsByYear[2025]
assert(taxParams2025 !== undefined, 'expected TY2025 parameters to be present in taxParamsByYear')

/** @type {ReturnProfile} */
const minimalProfileValue = {
    dialect: 'vnd.fjs.return_profile',
    taxYear: 2025,
    filingStatus: 'single',
    dependentCount: 0,
    declaredKinds: [],
}

/** @type {Stored<ReturnProfile>} */
const profileNoDeclaredKinds = { documentHash: 'profile-hash-0001', value: minimalProfileValue }

export const proof = {
    // Test 1 (continuous phase-out, no stepping).
    continuousPhaseoutAtExactThreshold: () => {
        const result = scheduleOneAPartV(taxParams2025)({
            status: 'single',
            phaseoutIncomeCents: 7500000n, // $75,000.00 -- exactly at the start threshold
            taxpayerHasValidSsnAndBornBefore1961Jan2: true,
            spouseHasValidSsnAndBornBefore1961Jan2: false,
        })
        assertEq(result.line33, 0n, 'line 33 = $0.00 -- at or below threshold')
        assertEq(result.line34, 0n, 'line 34 = $0.00')
        assertEq(result.line35, 600000n, 'line 35 = $6,000.00, the full base amount')
        assertEq(result.line37, 600000n, 'line 37 = $6,000.00')
    },
    continuousPhaseoutSingleAtEightyThousandDollars: () => {
        const result = scheduleOneAPartV(taxParams2025)({
            status: 'single',
            phaseoutIncomeCents: 8000000n, // $80,000.00
            taxpayerHasValidSsnAndBornBefore1961Jan2: true,
            spouseHasValidSsnAndBornBefore1961Jan2: false,
        })
        assertEq(result.line33, 500000n, 'line 33 = $5,000.00, the excess over $75,000')
        assertEq(result.line34, 30000n, 'line 34 = $300.00, 6% of the excess -- CENT-EXACT, no $1,000 stepping')
        assertEq(result.line35, 570000n, 'line 35 = $5,700.00')
        assertEq(result.line37, 570000n, 'line 37 = $5,700.00')
    },

    // Hand-written boundary trio (TAX-04/13-PATTERNS.md), phase-out START,
    // single: $74,999.99 / $75,000.00 / $75,000.01. The 6% rate's coarseness
    // (6% of $0.01 = $0.0006, far below the half-cent rounding threshold)
    // means all three land on the SAME $6,000.00 full amount --
    // continuousPhaseoutSingleAtEightyThousandDollars above is what proves the
    // SAME 6% rate genuinely reduces the deduction at dollar-level
    // granularity. This trio pins the CONDITIONAL's own edge (line33's `>`
    // comparison), not a doomed cent-level output difference.
    phaseoutStartBoundaryTrioSingle: () => {
        const belowResult = scheduleOneAPartV(taxParams2025)({
            status: 'single', phaseoutIncomeCents: 7499999n, // $74,999.99
            taxpayerHasValidSsnAndBornBefore1961Jan2: true, spouseHasValidSsnAndBornBefore1961Jan2: false,
        })
        assertEq(belowResult.line33, 0n, 'below the threshold: line 33 = $0.00')
        assertEq(belowResult.line35, 600000n, 'below the threshold: the full $6,000.00')

        const atResult = scheduleOneAPartV(taxParams2025)({
            status: 'single', phaseoutIncomeCents: 7500000n, // $75,000.00 exactly
            taxpayerHasValidSsnAndBornBefore1961Jan2: true, spouseHasValidSsnAndBornBefore1961Jan2: false,
        })
        assertEq(atResult.line33, 0n, 'at the threshold: line 33 = $0.00 ("if zero or less")')
        assertEq(atResult.line35, 600000n, 'at the threshold: still the full $6,000.00')

        const aboveResult = scheduleOneAPartV(taxParams2025)({
            status: 'single', phaseoutIncomeCents: 7500001n, // $75,000.01
            taxpayerHasValidSsnAndBornBefore1961Jan2: true, spouseHasValidSsnAndBornBefore1961Jan2: false,
        })
        assertEq(aboveResult.line33, 1n, 'above the threshold: line 33 = $0.01, the `>` branch now fires')
        assertEq(
            aboveResult.line35, 600000n,
            'one cent of excess is below the half-cent rounding threshold, so line 35 is still $6,000.00',
        )
    },
    phaseoutStartBoundaryTrioMfj: () => {
        const atResult = scheduleOneAPartV(taxParams2025)({
            status: 'marriedFilingJointly', phaseoutIncomeCents: 15000000n, // $150,000.00 exactly
            taxpayerHasValidSsnAndBornBefore1961Jan2: true, spouseHasValidSsnAndBornBefore1961Jan2: true,
        })
        assertEq(atResult.line32, 15000000n, 'line 32 = $150,000.00, the MFJ threshold')
        assertEq(atResult.line35, 600000n, 'at the threshold: still the full $6,000.00')

        const aboveResult = scheduleOneAPartV(taxParams2025)({
            status: 'marriedFilingJointly', phaseoutIncomeCents: 15100000n, // $151,000.00 -- $1,000 above
            taxpayerHasValidSsnAndBornBefore1961Jan2: true, spouseHasValidSsnAndBornBefore1961Jan2: true,
        })
        assertEq(aboveResult.line33, 100000n, 'line 33 = $1,000.00, the excess')
        assertEq(aboveResult.line34, 6000n, 'line 34 = $60.00, 6% of $1,000.00 -- cent-exact')
        assertEq(aboveResult.line35, 594000n, 'line 35 = $5,940.00')
    },

    // Test 2 (floor at zero).
    phaseoutFloorsAtZeroAtTheExactZeroPoint: () => {
        const result = scheduleOneAPartV(taxParams2025)({
            status: 'single',
            phaseoutIncomeCents: 17500000n, // $175,000.00 -- $75,000 + $6,000/0.06
            taxpayerHasValidSsnAndBornBefore1961Jan2: true,
            spouseHasValidSsnAndBornBefore1961Jan2: false,
        })
        assertEq(result.line33, 10000000n, 'line 33 = $100,000.00')
        assertEq(result.line34, 600000n, 'line 34 = $6,000.00, exactly the base amount')
        assertEq(result.line35, 0n, 'line 35 = $0.00 -- floored')
    },
    // One cent below/above the exact zero point: the 6% rate is COARSER
    // than one cent of MAGI (each cent of excess moves line34 by only 0.06
    // cents, far below the half-cent rounding threshold), so BOTH one-cent
    // probes round to the SAME $0.00 as the exact zero point -- a real,
    // provable property of this arithmetic, not a bug. See
    // continuousPhaseoutSingleAtEightyThousandDollars/phaseoutStartBoundaryTrioMfj
    // above for fixtures where the SAME 6% arithmetic visibly bites at
    // dollar-level granularity.
    phaseoutFloorOneCentBelowTheZeroPointStillRoundsToZero: () => {
        const result = scheduleOneAPartV(taxParams2025)({
            status: 'single',
            phaseoutIncomeCents: 17499999n, // $174,999.99 -- one cent below the zero point
            taxpayerHasValidSsnAndBornBefore1961Jan2: true,
            spouseHasValidSsnAndBornBefore1961Jan2: false,
        })
        assertEq(result.line34, 600000n, 'line 34 rounds UP to exactly $6,000.00 (599,999.94 half-up rounds to 600,000)')
        assertEq(result.line35, 0n, 'line 35 = $0.00 -- one cent of MAGI cannot move the rounded output here')
    },
    phaseoutFloorOneCentAboveTheZeroPointStaysZero: () => {
        const result = scheduleOneAPartV(taxParams2025)({
            status: 'single',
            phaseoutIncomeCents: 17500001n, // $175,000.01 -- one cent above the zero point
            taxpayerHasValidSsnAndBornBefore1961Jan2: true,
            spouseHasValidSsnAndBornBefore1961Jan2: false,
        })
        assertEq(result.line34, 600000n, 'line 34 rounds DOWN to exactly $6,000.00 (600,000.06 half-up rounds to 600,000)')
        assertEq(result.line35, 0n, 'line 35 = $0.00 -- no cliff past the floor')
    },
    phaseoutFloorAtZeroMfjAtTwoFiftyThousand: () => {
        const result = scheduleOneAPartV(taxParams2025)({
            status: 'marriedFilingJointly',
            phaseoutIncomeCents: 25000000n, // $250,000.00 -- $150,000 + $6,000/0.06
            taxpayerHasValidSsnAndBornBefore1961Jan2: true,
            spouseHasValidSsnAndBornBefore1961Jan2: true,
        })
        assertEq(result.line33, 10000000n, 'line 33 = $100,000.00')
        assertEq(result.line34, 600000n, 'line 34 = $6,000.00')
        assertEq(
            result.line35, 0n,
            'line 35 = $0.00 -- floored, for BOTH spouses (line36a and line36b both read the SAME phased-out line35)',
        )
        assertEq(result.line37, 0n, 'line 37 = $0.00')
    },

    // Test 3 (MFS short-circuit, Decision 5.4/Pitfall 3).
    mfsAtZeroPhaseoutIncomeGetsZeroNotDecisiveAlone: () => {
        const result = scheduleOneAPartV(taxParams2025)({
            status: 'marriedFilingSeparately',
            phaseoutIncomeCents: 0n,
            taxpayerHasValidSsnAndBornBefore1961Jan2: true,
            spouseHasValidSsnAndBornBefore1961Jan2: false,
        })
        assertEq(result.line37, 0n, 'line 37 = $0.00 -- not decisive alone: the ordinary arithmetic would ALSO give $0 at $0 MAGI')
    },
    // THE decisive proof: at $10,000 MAGI, well UNDER the $75,000
    // threshold, the ORDINARY arithmetic (absent the short-circuit) would
    // give the FULL $6,000 -- this fixture proves the short-circuit is a
    // GATE, not a consequence of the arithmetic.
    mfsAtTenThousandPhaseoutIncomeGetsZeroDecisiveShortCircuitProof: () => {
        const result = scheduleOneAPartV(taxParams2025)({
            status: 'marriedFilingSeparately',
            phaseoutIncomeCents: 1000000n, // $10,000.00 -- well under $75,000
            taxpayerHasValidSsnAndBornBefore1961Jan2: true,
            spouseHasValidSsnAndBornBefore1961Jan2: false,
        })
        assertEq(
            result.line37, 0n,
            'line 37 = $0.00 -- MFS is $0 unconditionally, even though $10,000 MAGI is far below the $75,000 threshold',
        )
    },

    // Test 4 (per-spouse, not per-return).
    mfjBothSpousesQualifyingGetsDoubleTheSamePhaseOutAmount: () => {
        const result = scheduleOneAPartV(taxParams2025)({
            status: 'marriedFilingJointly',
            phaseoutIncomeCents: 0n,
            taxpayerHasValidSsnAndBornBefore1961Jan2: true,
            spouseHasValidSsnAndBornBefore1961Jan2: true,
        })
        assertEq(result.line35, 600000n, 'line 35 = $6,000.00, the ONE phase-out computation on combined MAGI')
        assertEq(result.line36a, 600000n)
        assertEq(result.line36b, 600000n)
        assertEq(result.line37, 1200000n, 'line 37 = $12,000.00 -- the SAME line35 granted to EACH qualifying spouse, not halved')
    },

    // Test 5 (Parts II/III/IV documented zero; line38).
    partViSumsToLineThirtySevenWhenNoTipsOvertimeCarLoanDeclared: () => {
        const result = scheduleOneA(taxParams2025)({
            status: 'single',
            agiCents: 8000000n, // $80,000.00
            taxpayerHasValidSsnAndBornBefore1961Jan2: true,
            spouseHasValidSsnAndBornBefore1961Jan2: false,
            profile: profileNoDeclaredKinds,
        })
        assertEq(result.partVI.line13.value, 0n)
        assertEq(result.partVI.line21.value, 0n)
        assertEq(result.partVI.line30.value, 0n)
        assertEq(result.partVI.line13.sources[0].boxPath, 'declaredKinds')
        assertEq(result.partVI.line21.sources[0].boxPath, 'declaredKinds')
        assertEq(result.partVI.line30.sources[0].boxPath, 'declaredKinds')
        assertEq(result.partVI.line37, 570000n, 'line 37 = $5,700.00 (from the $80,000 MAGI fixture)')
        assertEq(result.partVI.line38, result.partVI.line37, 'line 38 equals line 37 exactly -- no tips/overtime/car-loan declared')
    },

    // Part I's own MAGI (line3) and seniorDeductionPhaseoutIncome are the
    // SAME rule (Schedule 1-A's own Part I feeding its own Part V), so they
    // are asserted equal on every fixture -- documented, not silently
    // assumed (TAX-15/Decision 5.6's precedent, applied within one schedule).
    partILine3EqualsSeniorDeductionPhaseoutIncomeForEveryFixture: () => {
        for (const agi of [0n, 8000000n, 17500000n, 99999999n]) {
            assertEq(scheduleOneAPartI(agi).line3, seniorDeductionPhaseoutIncome(agi))
        }
    },
    seniorDeductionPhaseoutIncomeEqualsBareAgiToday: () => {
        assertEq(seniorDeductionPhaseoutIncome(0n), 0n)
        assertEq(seniorDeductionPhaseoutIncome(12345600n), 12345600n)
    },
}
