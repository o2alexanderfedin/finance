// @ts-nocheck
//
// Phase 33 harness. NOT part of the engine and NOT typechecked, for the same
// reason the root-level gate suites are not: it reads the filesystem, which
// needs `@types/node`, and AGENTS.md forbids adding a dependency for it.
// A TAX YEAR 2024 parameter set for this engine, built for the TaxCalcBench
// run and NOTHING ELSE.
//
// SCRATCH ONLY. This is part of the HARNESS, not part of the engine. It is not
// committed to `fjs/`, it carries no proof, and nothing in the repo reads it.
//
// ── Revision note ────────────────────────────────────────────────────────────
// This supersedes the earlier partial draft at this path (backed up alongside
// as `peer-version.mjs.bak`). Three classes of change:
//
//  1. The 11 members that draft marked "NOT VERIFIED" have now been verified
//     against primary IRS sources and carry real TY2024 figures. The one that
//     mattered most: `federalPovertyLine`. TY2024 Form 8962 uses the 2023 HHS
//     guidelines (14,580 + 5,140), not TY2025's 2024 guidelines — the draft
//     itself flagged that TWO benchmark cases with a Form 1095-A are affected.
//     `premiumTaxCreditRepaymentLimitation` also genuinely moved (950/1,900 and
//     1,575/3,150 in TY2024, vs 975/1,950 and 1,625/3,250 in TY2025), and hits
//     the same two cases.
//  2. Citation sections corrected from §2.xx to §3.xx. Rev. Proc. 2023-34 puts
//     its adjusted items under **SECTION 3** ("SECTION 3. 2024 ADJUSTED ITEMS"),
//     not SECTION 2 — verified by reading rp-23-34.pdf directly. The TY2025
//     procedure numbers them §2.xx, which is where the draft's numbering came
//     from.
//  3. Shape fidelity. Every citation keeps the KIND (and so the exact key set)
//     its TY2025 counterpart uses, and the top bracket keeps its explicit
//     `ceiling: undefined` key. A key-for-key deep comparison against
//     `taxParamsByYear[2025]` now passes.
//
// ── Sources ──────────────────────────────────────────────────────────────────
//   Rev. Proc. 2023-34   TY2024 inflation adjustments (SECTION 3)
//   Notice 2023-75       TY2024 retirement and §25B limits
//   Rev. Proc. 2023-23   2024 HSA limits
//   88 FR 3424           2023 HHS poverty guidelines (what §36B uses for 2024)
//   2024 instructions for Schedule SE, Form 8962, Form 8863; Pub. 590-B (2024)
//
// Money is stored the way the engine stores it: exact decimal strings with two
// fractional digits and NO comma grouping ('14600.00', never '14,600.00').
//
// Members are spread ({...}) rather than JSON-round-tripped, because several
// engine objects carry explicit own keys whose value is `undefined`
// (`brackets[n].ceiling`, `maximumAge`, `ceilingPercent`,
// `adjustedGrossIncomeCeiling`) and JSON would silently drop them.

const R = process.env.FINANCE_ROOT ?? new URL('../../..', import.meta.url).pathname
const { taxParamsByYear } = await import(R + '/fjs/tax/params/module.f.js')

const ty2025 = taxParamsByYear[2025]

// Citation helpers. Each preserves the citation KIND — and therefore the exact
// key set — that the corresponding TY2025 field already uses.

/** Rev. Proc. 2023-34, bare-number `revProc` style (the engine's majority style). */
const rp = section => ({ kind: 'revProc', revProc: '2023-34', section, effectiveDate: '2024-01-01' })
/** Rev. Proc. 2023-34, prefixed style (foreignEarnedIncome / longTermCarePremiumLimits). */
const rpLong = section => ({ kind: 'revProc', revProc: 'Rev. Proc. 2023-34', section, effectiveDate: '2024-01-01' })
/** An Internal Revenue Code citation, re-dated to TY2024. */
const code = section => ({ kind: 'code', section, effectiveDate: '2024-01-01' })
/** 88 FR 3424 — the 2023 HHS poverty guidelines. */
const fr = section => ({ kind: 'federalRegister', federalRegister: '88 FR 3424', section, effectiveDate: '2024-01-01' })

const amt = (amount, citation) => ({ amount, citation })

// ── Rev. Proc. 2023-34 §3.15 ─────────────────────────────────────────────────

const standardDeduction = {
    single: amt('14600.00', rp('§3.15(1)')),
    marriedFilingJointly: amt('29200.00', rp('§3.15(1)')),
    marriedFilingSeparately: amt('14600.00', rp('§3.15(1)')),
    headOfHousehold: amt('21900.00', rp('§3.15(1)')),
    qualifyingSurvivingSpouse: amt('29200.00', rp('§3.15(1)')),
}

// §3.15(3): "$1,550 ... increased to $1,950 if the individual is also
// unmarried and not a surviving spouse."
const agedOrBlindAdditional = {
    married: amt('1550.00', rp('§3.15(3)')),
    unmarried: amt('1950.00', rp('§3.15(3)')),
}

// §3.15(2): "the greater of (1) $1,300, or (2) the sum of $450 and the
// individual's earned income."
const dependentStandardDeductionCap = {
    minimum: amt('1300.00', rp('§3.15(2)')),
    earnedIncomeAddOn: amt('450.00', rp('§3.15(2)')),
}

// ── Rev. Proc. 2023-34 §3.01, Tables 1-5 ─────────────────────────────────────
//
// Ceilings are transcribed from the "not over" column ONLY. The printed
// "excess over" column of Tables 2-4 carries a typo — $191,150 where the
// bracket ceiling is $191,950 — which is easy to copy by accident.
//
// `ceiling: undefined` on the top bracket is written EXPLICITLY: the engine's
// own TY2025 objects carry that key, and a key-for-key shape comparison
// against them fails if it is merely omitted.

const schedule = brackets => ({ citation: rp('§3.01'), brackets })

const ordinaryBrackets = {
    // Table 1 — Married Individuals Filing Joint Returns and Surviving Spouses.
    marriedFilingJointly: schedule([
        { ratePercent: 10, ceiling: '23200.00' },
        { ratePercent: 12, ceiling: '94300.00' },
        { ratePercent: 22, ceiling: '201050.00' },
        { ratePercent: 24, ceiling: '383900.00' },
        { ratePercent: 32, ceiling: '487450.00' },
        { ratePercent: 35, ceiling: '731200.00' },
        { ratePercent: 37, ceiling: undefined },
    ]),
    // Table 2 — Heads of Households.
    headOfHousehold: schedule([
        { ratePercent: 10, ceiling: '16550.00' },
        { ratePercent: 12, ceiling: '63100.00' },
        { ratePercent: 22, ceiling: '100500.00' },
        { ratePercent: 24, ceiling: '191950.00' },
        { ratePercent: 32, ceiling: '243700.00' },
        { ratePercent: 35, ceiling: '609350.00' },
        { ratePercent: 37, ceiling: undefined },
    ]),
    // Table 3 — Unmarried Individuals.
    single: schedule([
        { ratePercent: 10, ceiling: '11600.00' },
        { ratePercent: 12, ceiling: '47150.00' },
        { ratePercent: 22, ceiling: '100525.00' },
        { ratePercent: 24, ceiling: '191950.00' },
        { ratePercent: 32, ceiling: '243725.00' },
        { ratePercent: 35, ceiling: '609350.00' },
        { ratePercent: 37, ceiling: undefined },
    ]),
    // Table 4 — Married Individuals Filing Separate Returns. Identical to
    // single through 32%, diverging at 35% (365,600 vs 609,350).
    marriedFilingSeparately: schedule([
        { ratePercent: 10, ceiling: '11600.00' },
        { ratePercent: 12, ceiling: '47150.00' },
        { ratePercent: 22, ceiling: '100525.00' },
        { ratePercent: 24, ceiling: '191950.00' },
        { ratePercent: 32, ceiling: '243725.00' },
        { ratePercent: 35, ceiling: '365600.00' },
        { ratePercent: 37, ceiling: undefined },
    ]),
    // Table 1 again — transcribed independently, never spread from MFJ,
    // mirroring the engine's own practice.
    qualifyingSurvivingSpouse: schedule([
        { ratePercent: 10, ceiling: '23200.00' },
        { ratePercent: 12, ceiling: '94300.00' },
        { ratePercent: 22, ceiling: '201050.00' },
        { ratePercent: 24, ceiling: '383900.00' },
        { ratePercent: 32, ceiling: '487450.00' },
        { ratePercent: 35, ceiling: '731200.00' },
        { ratePercent: 37, ceiling: undefined },
    ]),
    // Table 5 — Estates and Trusts: four brackets, 10/24/35/37.
    estatesAndTrusts: schedule([
        { ratePercent: 10, ceiling: '3100.00' },
        { ratePercent: 24, ceiling: '11150.00' },
        { ratePercent: 35, ceiling: '15200.00' },
        { ratePercent: 37, ceiling: undefined },
    ]),
}

// ── Rev. Proc. 2023-34 §3.03 ─────────────────────────────────────────────────

const cg = (zeroRateMax, fifteenRateMax) => ({ citation: rp('§3.03'), zeroRateMax, fifteenRateMax })

const capitalGainsBreakpoints = {
    marriedFilingJointly: cg('94050.00', '583750.00'),
    marriedFilingSeparately: cg('47025.00', '291850.00'),
    headOfHousehold: cg('63000.00', '551350.00'),
    single: cg('47025.00', '518900.00'),
    qualifyingSurvivingSpouse: cg('94050.00', '583750.00'),
    estatesAndTrusts: cg('3150.00', '15450.00'),
}

// ── OBBBA members, neutralised ───────────────────────────────────────────────

// OBBBA (Public Law 119-21) §70103 created the senior deduction for taxable
// years beginning after 2024. It DID NOT EXIST in TY2024, so the amount is
// zero: whatever the phase-out arithmetic does, `max(0, 0 - anything)` is zero.
// Leaving it at its TY2025 value would have subtracted $6,000 per eligible
// filer from every over-65 return in the benchmark.
//
// The thresholds are deliberately left in place rather than zeroed — with a
// zero amount they are unreachable either way — and the citation still points
// at §70103 with its true 2025-01-01 effective date, which is precisely WHY
// the TY2024 amount is $0.
const seniorDeduction = {
    ...ty2025.seniorDeduction,
    amount: amt('0.00', { kind: 'publicLaw', publicLaw: '119-21', section: '§70103', effectiveDate: '2025-01-01' }),
}

// TY2024's SALT cap is the flat $10,000 of IRC §164(b)(6), as enacted by Public
// Law 115-97 (TCJA) §11042. OBBBA §70120's $40,000 cap, $10,000 floor and 30%
// phasedown above $500,000 are all TY2025-only, so the phasedown is switched
// off two ways at once: `phasedownRatePercent` is 0, and `floor` equals
// `flatCap`, so `saltCapWorksheet`'s w9 is $10,000 at every income level.
//
// The $5,000 MFS cap needs no separate parameter and is NOT lost: `fjs/schedule/a`
// halves w9 for an MFS filer on worksheet line w10, which is the engine's own
// documented reason for storing only flat, non-halved figures here.
const salt = { kind: 'publicLaw', publicLaw: '115-97', section: '§11042', effectiveDate: '2024-01-01' }

const saltCap = {
    flatCap: amt('10000.00', salt),
    floor: amt('10000.00', salt),
    phasedownRatePercent: 0,
    threshold: {
        single: amt('0.00', salt),
        marriedFilingJointly: amt('0.00', salt),
        marriedFilingSeparately: amt('0.00', salt),
        headOfHousehold: amt('0.00', salt),
        qualifyingSurvivingSpouse: amt('0.00', salt),
    },
}

// TY2024 CTC: $2,000 per qualifying child (§24(h)(2)), $500 for other
// dependents (§24(h)(4)), $1,700 refundable (Rev. Proc. 2023-34 §3.05).
// OBBBA §70104 raised the credit to $2,200 for TY2025; that is the only
// figure in this member that moved.
const childTaxCredit = {
    ...ty2025.childTaxCredit,
    ctcAmount: amt('2000.00', rp('§3.05')),
}

// ── Rev. Proc. 2023-34 §3.06 ─────────────────────────────────────────────────
// The §32(b)(1) credit and phase-out percentages are statutory and unchanged.

const eicTier = (creditPercentBasisPoints, phaseoutPercentBasisPoints, earned, max, mfj, other) => ({
    creditPercentBasisPoints,
    phaseoutPercentBasisPoints,
    earnedIncomeAmount: amt(earned, rp('§3.06(1)')),
    maximumCredit: amt(max, rp('§3.06(1)')),
    phaseoutAmount: {
        marriedFilingJointly: amt(mfj, rp('§3.06(1)')),
        other: amt(other, rp('§3.06(1)')),
    },
})

const earnedIncomeCredit = {
    investmentIncomeLimit: amt('11600.00', rp('§3.06(2)')),
    bandWidth: ty2025.earnedIncomeCredit.bandWidth,
    percentagesCitation: code('§32(b)(1)'),
    tiers: {
        none: eicTier(765, 765, '8260.00', '632.00', '17250.00', '10330.00'),
        one: eicTier(3400, 1598, '12390.00', '4213.00', '29640.00', '22720.00'),
        two: eicTier(4000, 2106, '17400.00', '6960.00', '29640.00', '22720.00'),
        threeOrMore: eicTier(4500, 2106, '17400.00', '7830.00', '29640.00', '22720.00'),
    },
}

// ── Notice 2023-75 ───────────────────────────────────────────────────────────
// §219(g)(3)(B)(i) joint/QSS $123,000; (ii) all other active participants
// $77,000; (iii) MFS "is not subject to an annual cost-of-living adjustment
// and remains $0". Ranges ($10,000; $20,000 joint) are statutory.
const iraDeduction = {
    ...ty2025.iraDeduction,
    phaseoutThreshold: {
        single: amt('77000.00', code('§219(g)(3)(B)(ii)')),
        marriedFilingSeparately: amt('0.00', code('§219(g)(3)(B)(iii)')),
        headOfHousehold: amt('77000.00', code('§219(g)(3)(B)(ii)')),
        qualifyingSurvivingSpouse: amt('123000.00', code('§219(g)(3)(B)(i)')),
    },
}

// Notice 2023-75, §25B(b)(1)(A)/(B)/(C)-(D) AGI limitations for 2024.
const saverBands = (fifty, twenty, ten) => [
    { ratePercent: 50, ceiling: fifty },
    { ratePercent: 20, ceiling: twenty },
    { ratePercent: 10, ceiling: ten },
    { ratePercent: 0, ceiling: undefined },
]

const retirementSavingsContributionsCredit = {
    ...ty2025.retirementSavingsContributionsCredit,
    rateBands: {
        single: saverBands('23000.00', '25000.00', '38250.00'),
        marriedFilingJointly: saverBands('46000.00', '50000.00', '76500.00'),
        marriedFilingSeparately: saverBands('23000.00', '25000.00', '38250.00'),
        headOfHousehold: saverBands('34500.00', '37500.00', '57375.00'),
        qualifyingSurvivingSpouse: saverBands('23000.00', '25000.00', '38250.00'),
    },
    rateBandCitation: code('§25B(b)'),
}

// ── Remaining inflation-adjusted members ─────────────────────────────────────

// Rev. Proc. 2023-34 §3.30: "$2,500 maximum deduction ... begins to phase out
// ... in excess of $80,000 ($165,000 for joint returns), and is completely
// phased out ... $95,000 or more ($195,000 or more for joint returns)."
// The ranges that implies (15,000; 30,000 joint) equal TY2025's.
const studentLoanInterestDeduction = {
    ...ty2025.studentLoanInterestDeduction,
    phaseoutThreshold: {
        single: amt('80000.00', code('§221(b)(2)(B)')),
        marriedFilingJointly: amt('165000.00', code('§221(b)(2)(B)')),
        headOfHousehold: amt('80000.00', code('§221(b)(2)(B)')),
        qualifyingSurvivingSpouse: amt('80000.00', code('§221(b)(2)(B)')),
    },
}

// Rev. Proc. 2023-23 §2.01(1): self-only $4,150, family $8,300 for calendar
// year 2024. The §223(b)(3)(B) catch-up is a fixed statutory $1,000.
const healthSavingsAccount = {
    ...ty2025.healthSavingsAccount,
    annualLimit: {
        selfOnly: amt('4150.00', code('§223(b)(2)(A)')),
        family: amt('8300.00', code('§223(b)(2)(B)')),
    },
}

// Pub. 590-B (2024): "The maximum annual exclusion for QCDs is $105,000" and
// "you can elect to make a one-time distribution of up to $53,000".
const qualifiedCharitableDistribution = {
    annualLimitPerIndividual: amt('105000.00', code('§408(d)(8)(A)')),
    splitInterestOneTimeLimit: amt('53000.00', code('§408(d)(8)(F)')),
}

// 2024 Instructions for Schedule SE: "the maximum amount of combined wages and
// self-employment earnings subject to social security tax is $168,600."
const selfEmploymentTax = {
    ...ty2025.selfEmploymentTax,
    socialSecurityWageBase: amt('168600.00', code('§1402(b)(1)')),
}

// Rev. Proc. 2023-34 §3.27: thresholds $383,900 joint / $191,950 all other;
// phase-in range TOPS $483,900 / $241,950 — i.e. the same $100,000 / $50,000
// widths the engine stores, so `phaseInRange` is unchanged.
const qbi = a => amt(a, code('§199A(e)(2)'))
const qualifiedBusinessIncomeDeduction = {
    ...ty2025.qualifiedBusinessIncomeDeduction,
    thresholdAmount: {
        single: qbi('191950.00'),
        marriedFilingJointly: amt('383900.00', code('§199A(e)(2)(B)')),
        marriedFilingSeparately: qbi('191950.00'),
        headOfHousehold: qbi('191950.00'),
        qualifyingSurvivingSpouse: qbi('191950.00'),
    },
}

// Rev. Proc. 2023-34 §3.32: "$305,000 ($610,000 for joint returns)."
// `singleLineFilingTest` is DERIVED, not quoted: the engine stores 156,500 for
// TY2025, exactly half of that year's 313,000, so TY2024 is half of 305,000.
const ebl = a => amt(a, rp('§3.32'))
const excessBusinessLossThreshold = {
    thresholdAmount: {
        single: ebl('305000.00'),
        marriedFilingJointly: ebl('610000.00'),
        marriedFilingSeparately: ebl('305000.00'),
        headOfHousehold: ebl('305000.00'),
        qualifyingSurvivingSpouse: ebl('305000.00'),
    },
    singleLineFilingTest: amt('152500.00', code('§461(l)(1)')),
}

// Rev. Proc. 2023-34 §3.11.
const a11 = a => amt(a, rp('§3.11'))
const alternativeMinimumTax = {
    ...ty2025.alternativeMinimumTax,
    exemption: {
        single: a11('85700.00'),
        marriedFilingJointly: a11('133300.00'),
        marriedFilingSeparately: a11('66650.00'),
        headOfHousehold: a11('85700.00'),
        qualifyingSurvivingSpouse: a11('133300.00'),
    },
    exemptionPhaseoutThreshold: {
        single: a11('609350.00'),
        marriedFilingJointly: a11('1218700.00'),
        marriedFilingSeparately: a11('609350.00'),
        headOfHousehold: a11('609350.00'),
        qualifyingSurvivingSpouse: a11('1218700.00'),
    },
    exemptionCompletePhaseout: {
        single: a11('952150.00'),
        marriedFilingJointly: a11('1751900.00'),
        marriedFilingSeparately: a11('875950.00'),
        headOfHousehold: a11('952150.00'),
        qualifyingSurvivingSpouse: a11('1751900.00'),
    },
    upperRateThreshold: {
        single: a11('232600.00'),
        marriedFilingJointly: a11('232600.00'),
        marriedFilingSeparately: a11('116300.00'),
        headOfHousehold: a11('232600.00'),
        qualifyingSurvivingSpouse: a11('232600.00'),
    },
}

// §36B(d)(3) uses the poverty guidelines in effect on the first day of the
// coverage year's open enrollment. For TY2024 coverage that is the 2023 HHS
// update, 88 FR 3424 — the very figures Tables 1-1/1-2/1-3 of the 2024
// Instructions for Form 8962 print. TY2025's set carries the 2024 guidelines,
// so this member genuinely moved and the benchmark's Form 1095-A cases feel it.
const federalPovertyLine = {
    contiguous48AndDistrictOfColumbia: {
        firstPerson: amt('14580.00', fr('HHS Poverty Guidelines for 2023, 48 contiguous states and DC')),
        eachAdditionalPerson: amt('5140.00', fr('HHS Poverty Guidelines for 2023, 48 contiguous states and DC')),
    },
    alaska: {
        firstPerson: amt('18210.00', fr('HHS Poverty Guidelines for 2023, Alaska')),
        eachAdditionalPerson: amt('6430.00', fr('HHS Poverty Guidelines for 2023, Alaska')),
    },
    hawaii: {
        firstPerson: amt('16770.00', fr('HHS Poverty Guidelines for 2023, Hawaii')),
        eachAdditionalPerson: amt('5910.00', fr('HHS Poverty Guidelines for 2023, Hawaii')),
    },
}

// Rev. Proc. 2023-34 §3.07.
const premiumTaxCreditRepaymentLimitation = {
    citation: rp('§3.07'),
    bands: [
        { povertyLinePercentCeiling: 200, single: '375.00', other: '750.00' },
        { povertyLinePercentCeiling: 300, single: '950.00', other: '1900.00' },
        { povertyLinePercentCeiling: 400, single: '1575.00', other: '3150.00' },
    ],
}

// Rev. Proc. 2023-34 §3.28.
const ltc = (band, minimumAgeExclusive, maximumAge, amount, section) =>
    ({ band, minimumAgeExclusive, maximumAge, amount, citation: rpLong('§3.28, ' + section) })

const longTermCarePremiumLimits = [
    ltc('ageFortyOrYounger', undefined, 40, '470.00', 'age 40 or less'),
    ltc('ageFortyOneToFifty', 40, 50, '880.00', 'more than 40 but not more than 50'),
    ltc('ageFiftyOneToSixty', 50, 60, '1760.00', 'more than 50 but not more than 60'),
    ltc('ageSixtyOneToSeventy', 60, 70, '4710.00', 'more than 60 but not more than 70'),
    ltc('ageSeventyOneOrOlder', 70, undefined, '5880.00', 'more than 70'),
]

// Rev. Proc. 2023-34 §3.39: $126,500. `daysInTaxYear` is a calendar fact with
// no authority to cite, and 2024 is a LEAP YEAR, so Form 2555 line 39's
// divisor — "the number of days in your 2024 tax year" — is 366, not 365.
const foreignEarnedIncome = {
    maximumExclusion: amt('126500.00', rpLong('§3.39')),
    daysInTaxYear: 366,
}

// ═════════════════════════════════════════════════════════════════════════════

/**
 * TY2024 tax parameters, key-for-key identical in shape to
 * `taxParamsByYear[2025]`. `taxYear` is FIRST, mirroring `TaxParamSet`.
 */
export const taxParams2024 = {
    ...ty2025,
    taxYear: 2024,
    standardDeduction,
    agedOrBlindAdditional,
    dependentStandardDeductionCap,
    ordinaryBrackets,
    capitalGainsBreakpoints,
    seniorDeduction,
    saltCap,
    childTaxCredit,
    earnedIncomeCredit,
    iraDeduction,
    studentLoanInterestDeduction,
    healthSavingsAccount,
    retirementSavingsContributionsCredit,
    qualifiedCharitableDistribution,
    selfEmploymentTax,
    qualifiedBusinessIncomeDeduction,
    excessBusinessLossThreshold,
    alternativeMinimumTax,
    federalPovertyLine,
    premiumTaxCreditRepaymentLimitation,
    longTermCarePremiumLimits,
    foreignEarnedIncome,
}

// ── Provenance ───────────────────────────────────────────────────────────────

/**
 * Every member whose VALUE differs from TY2025, with the TY2024 figures and
 * the IRS source each was read from.
 */
export const overridden = [
    { member: 'standardDeduction', ty2024Value: '14,600 / 29,200 / 14,600 / 21,900 / 29,200', source: 'Rev. Proc. 2023-34 §3.15(1); confirmed by 7 benchmark expected outputs' },
    { member: 'agedOrBlindAdditional', ty2024Value: '1,550 married / 1,950 unmarried', source: 'Rev. Proc. 2023-34 §3.15(3); confirmed by 4 benchmark expected outputs' },
    { member: 'dependentStandardDeductionCap', ty2024Value: '1,300 floor / 450 earned-income add-on', source: 'Rev. Proc. 2023-34 §3.15(2)' },
    { member: 'ordinaryBrackets', ty2024Value: 'the five TY2024 rate schedules plus estates & trusts (3,100/11,150/15,200)', source: 'Rev. Proc. 2023-34 §3.01, Tables 1-5; confirmed by three benchmark cases. Ceilings read from the "not over" column — the "excess over" column carries a $191,150 typo for the $191,950 ceiling' },
    { member: 'capitalGainsBreakpoints', ty2024Value: '47,025/518,900 single; 94,050/583,750 MFJ & QSS; 63,000/551,350 HOH; 47,025/291,850 MFS; 3,150/15,450 estates', source: 'Rev. Proc. 2023-34 §3.03' },
    { member: 'seniorDeduction', ty2024Value: 'NEUTRALISED — amount 0.00', source: 'OBBBA (P.L. 119-21) §70103 applies only to taxable years beginning after 2024; the deduction did not exist in TY2024 and must contribute exactly zero' },
    { member: 'saltCap', ty2024Value: 'flatCap 10,000, floor 10,000, phasedownRatePercent 0, thresholds 0.00', source: 'IRC §164(b)(6) as enacted by P.L. 115-97 (TCJA) §11042 — flat $10,000, no phasedown. OBBBA §70120 raised it to $40,000 only from TY2025. The $5,000 MFS cap needs no parameter: fjs/schedule/a halves w9 for MFS at worksheet line w10' },
    { member: 'childTaxCredit', ty2024Value: 'CTC 2,000 (was 2,200); ODC 500, ACTC cap 1,700 and the 400k/200k thresholds unchanged', source: 'IRC §24(h)(2) for the $2,000; Rev. Proc. 2023-34 §3.05 confirms the $1,700 refundable amount. OBBBA §70104 raised the credit to $2,200 for TY2025' },
    { member: 'earnedIncomeCredit', ty2024Value: 'max credits 632 / 4,213 / 6,960 / 7,830; earned-income amounts 8,260 / 12,390 / 17,400 / 17,400; thresholds MFJ 17,250 & 29,640, other 10,330 & 22,720; investment income limit 11,600', source: 'Rev. Proc. 2023-34 §3.06(1) and §3.06(2); 632 and 4,213 confirmed by benchmark expected outputs' },
    { member: 'iraDeduction', ty2024Value: 'phase-out thresholds 77,000 single/HOH, 123,000 joint-or-QSS, 0 MFS (limit 7,000 + 1,000 catch-up and the 10,000/20,000 ranges unchanged)', source: 'Notice 2023-75 (§219(g)(3)(B)(i)/(ii)/(iii) applicable dollar amounts for 2024)' },
    { member: 'studentLoanInterestDeduction', ty2024Value: 'phase-out begins 80,000 (165,000 joint); ranges 15,000/30,000 unchanged', source: 'Rev. Proc. 2023-34 §3.30' },
    { member: 'healthSavingsAccount', ty2024Value: 'self-only 4,150 / family 8,300 (catch-up 1,000 unchanged)', source: 'Rev. Proc. 2023-23 §2.01(1)' },
    { member: 'retirementSavingsContributionsCredit', ty2024Value: '50/20/10% AGI ceilings — MFJ 46,000/50,000/76,500; HOH 34,500/37,500/57,375; single, MFS and QSS 23,000/25,000/38,250', source: 'Notice 2023-75 (§25B(b)(1)(A), (B) and (C)-(D) for 2024)' },
    { member: 'qualifiedCharitableDistribution', ty2024Value: 'annual limit 105,000; one-time split-interest election 53,000', source: 'Publication 590-B (2024): "The maximum annual exclusion for QCDs is $105,000"; "a one-time distribution of up to $53,000"' },
    { member: 'selfEmploymentTax', ty2024Value: 'social security wage base 168,600 (12.4% / 2.9% rates and the $400 floor unchanged)', source: '2024 Instructions for Schedule SE: "the maximum amount of combined wages and self-employment earnings subject to social security tax is $168,600"' },
    { member: 'qualifiedBusinessIncomeDeduction', ty2024Value: 'thresholds 191,950 (383,900 joint); phase-in widths 50,000/100,000 unchanged', source: 'Rev. Proc. 2023-34 §3.27 (range tops 241,950 / 483,900 imply the same widths)' },
    { member: 'excessBusinessLossThreshold', ty2024Value: '305,000 (610,000 joint); singleLineFilingTest 152,500', source: 'Rev. Proc. 2023-34 §3.32 for 305,000/610,000. singleLineFilingTest is DERIVED, not quoted: half the single-filer threshold, exactly as TY2025\'s 156,500 is half of 313,000' },
    { member: 'alternativeMinimumTax', ty2024Value: 'exemption 85,700 single/HOH, 133,300 MFJ/QSS, 66,650 MFS; phase-out threshold 609,350 / 1,218,700; complete phase-out 952,150 / 1,751,900 / 875,950 MFS; 28% breakpoint 232,600 (116,300 MFS)', source: 'Rev. Proc. 2023-34 §3.11' },
    { member: 'federalPovertyLine', ty2024Value: 'contiguous 48 + DC 14,580 + 5,140; Alaska 18,210 + 6,430; Hawaii 16,770 + 5,910', source: '88 FR 3424 (2023 HHS poverty guidelines) — what §36B(d)(3) uses for 2024 coverage, reprinted as Tables 1-1/1-2/1-3 of the 2024 Instructions for Form 8962. Affects the benchmark\'s Form 1095-A cases' },
    { member: 'premiumTaxCreditRepaymentLimitation', ty2024Value: '<200%: 375/750; 200-300%: 950/1,900; 300-400%: 1,575/3,150', source: 'Rev. Proc. 2023-34 §3.07 (TY2025 carries 975/1,950 and 1,625/3,250, so this genuinely moved)' },
    { member: 'longTermCarePremiumLimits', ty2024Value: '470 / 880 / 1,760 / 4,710 / 5,880', source: 'Rev. Proc. 2023-34 §3.28' },
    { member: 'foreignEarnedIncome', ty2024Value: 'maximum exclusion 126,500; daysInTaxYear 366', source: 'Rev. Proc. 2023-34 §3.39 for 126,500. daysInTaxYear has no authority to cite: 2024 is a leap year, so Form 2555 line 39\'s divisor is 366' },
]

/**
 * Every member left carrying its TY2025 value, with the reason. In every case
 * the TY2024 figure was CHECKED and found identical — none of these is an
 * unresolved gap, and nothing in this set is unverified.
 */
export const leftAtTy2025 = [
    { member: 'additionalMedicareTaxEmployerWithholdingThreshold', reason: "§3102(f)(1)'s flat $200,000 employer withholding trigger — statutory, never inflation-adjusted, added to the engine by Phase 33's own fix" },
    { member: 'socialSecurityBenefitsWorksheetBaseAmounts', reason: 'unchanged since 1993 — §86(c) fixes 32,000/25,000 and 12,000/9,000 in the statute with no inflation adjustment' },
    { member: 'medicalExpenseFloor', reason: '§213(a)\'s 7.5%-of-AGI floor is statutory and permanent; no annual adjustment exists' },
    { member: 'additionalMedicareTaxThreshold', reason: '§3101(b)(2)\'s 200,000/250,000/125,000 are statutory and expressly NOT indexed for inflation' },
    { member: 'additionalMedicareTaxRates', reason: '§3101(b): 1.45% regular plus 0.9% additional, statutory' },
    { member: 'socialSecurityTaxWithholding', reason: '§3101(a)\'s 6.2% employee rate is statutory. The WAGE BASE it applies to lives in selfEmploymentTax, which IS overridden' },
    { member: 'foreignTaxCreditDeMinimisElection', reason: '§904(j)(2)(B)\'s $300 / $600 joint de minimis ceiling is statutory and not indexed' },
    { member: 'netInvestmentIncomeTaxThreshold', reason: '§1411(b)\'s 200,000/250,000/125,000 are statutory and expressly not indexed' },
    { member: 'netInvestmentIncomeTaxRateBasisPoints', reason: '§1411(a)\'s 3.8% rate is statutory' },
    { member: 'sectionTwelveFiftySixCharacterSplit', reason: '§1256(a)(3)\'s 40% short-term / 60% long-term split is statutory' },
    { member: 'educatorExpenses', reason: 'verified identical — Rev. Proc. 2023-34 §3.13 sets the §62(a)(2)(D) deduction at $300, the same figure TY2025 carries' },
    { member: 'educationCredits', reason: 'verified identical — the 2024 Instructions for Form 8863 give AOTC and LLC phase-outs of 80,000-90,000 (single/HOH) and 160,000-180,000 (MFJ), i.e. ceiling 90,000/180,000 with ranges 10,000/20,000. §25A(i) and §25A(d)(2) are not inflation-indexed, and the $2,500 max, 40% refundable share, 20% LLC rate and $10,000 LLC cap are statutory' },
    { member: 'premiumTaxCreditApplicablePercentage', reason: 'verified identical — Table 2 of the 2024 Instructions for Form 8962 reproduces the ARPA/IRA applicable-figure schedule (0.0000 at 150%, 0.0200 at 200%, 0.0400 at 250%, 0.0600 at 300%, 0.0850 at 400%+), which §36B(b)(3)(A)(i) keeps in force for 2021-2025' },
    { member: 'dependentCareExpenseLimit', reason: '§21(c)\'s $3,000 / $6,000 limits are statutory and not indexed (the ARPA increase applied only to 2021)' },
    { member: 'dependentCareCreditPercentage', reason: '§21(a)(2)\'s 35%-down-to-20% band table, stepping every $2,000 of AGI from $15,000, is statutory' },
    { member: 'dependentCareAssistanceExclusionLimit', reason: '§129(a)(2)\'s $5,000 ($2,500 MFS) exclusion is statutory and not indexed (the ARPA increase applied only to 2021)' },
    { member: 'dependentCareDeemedEarnedIncomePerMonth', reason: '§21(d)(2)\'s $250 / $500 deemed monthly earned income is statutory' },
]

export default taxParams2024

// ── Cross-checks the benchmark itself supplies ───────────────────────────────
//
// Each is an expected output of a benchmark case, recomputed by hand from the
// numbers above. None relies on this engine.
//
//   single                          line 12 = 14,600   (7 cases)
//   MFJ                             line 12 = 29,200   (11 cases)
//   HOH                             line 12 = 21,900   (4 cases)
//   single + 65 + blind             line 12 = 18,500 = 14,600 + 2 x 1,950
//   single + 65                     line 12 = 16,550 = 14,600 + 1,950
//   MFJ, two filers 65 AND blind    line 12 = 35,400 = 29,200 + 4 x 1,550
//   HOH + 65                        line 12 = 23,850 = 21,900 + 1,950
//   single, taxable 130,400         line 16 = 24,339 (Tax Computation Worksheet)
//                                   = 1,160 + 4,266 + 11,742.50 + 7,170 = 24,338.50
//   MFJ, taxable 105,800            line 16 = 13,382
//                                   = 2,320 + 8,532 + 2,530
//   HOH, taxable 26,000             line 16 = 2,792 (Tax Table, midpoint 26,025)
//                                   = 1,655 + 1,137
//   single, no children             line 27 = 632   (EIC maximum, no-child tier)
//   HOH, one child                  line 27 = 4,213 (EIC maximum, one-child tier)
//
// All of the above, plus a key-for-key shape comparison against
// `taxParamsByYear[2025]` and a money-string format check, are executed by
// `../check.mjs`.
