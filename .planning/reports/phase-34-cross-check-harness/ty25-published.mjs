// @ts-nocheck
//
// Phase 34 harness. NOT part of the engine, not typechecked, not shipped.
//
// The ten Tax Year 2025 federal returns TaxCalcBench publishes
// (<https://github.com/column-tax/tax-calc-bench>, `tax_calc_bench/ty25/`),
// reduced to the nineteen Form 1040 lines its own evaluator grades plus the
// handful of facts those lines are computed from. HAND-TYPED from each case's
// `output.xml`; a `null` is a tag the Modernized e-File schema omits, which
// the benchmark's evaluator reads as zero.
//
// The expected outputs are Column Tax's, produced by its own production
// engine. Nothing in this file may be derived from `fjs/**` — this is the
// independent side of the diff.
//
// `filingStatus` is the return's own `IndividualReturnFilingStatusCd`
// translated to this engine's vocabulary; `agedOrBlindBoxes` is
// `TotalBoxesCheckedCnt` (absent means zero); `preferentialIncome` records
// whether the return carries qualified dividends or a net capital gain, which
// is what decides whether line 16 follows from line 15 alone.

export const cases = [
    {
        name: 'ty25-us-001',
        filingStatus: 'headOfHousehold',
        agedOrBlindBoxes: 0,
        deduction: 'itemized',
        preferentialIncome: '$5,000,000 net long-term capital gain; Form 4952 elects $75,000 of it as investment income',
        lines: {
            '1a': 1100000, '9': 6100000, '10': null, '11': 6100000, '12': 114800,
            '15': 5985200, '16': 1332556, '19': null, '24': 1543108, '25d': 386100,
            '26': null, '27': null, '28': null, '29': null, '32': null,
            '33': 386100, '34': null, '35a': null, '37': 1157008,
        },
    },
    {
        name: 'ty25-us-002',
        filingStatus: 'headOfHousehold',
        agedOrBlindBoxes: 0,
        deduction: 'itemized',
        preferentialIncome: null,
        lines: {
            '1a': 32000, '9': 33650, '10': null, '11': 33650, '12': 26125,
            '15': 7525, '16': 753, '19': 753, '24': null, '25d': 2800,
            '26': null, '27': 2678, '28': 1447, '29': null, '32': 4125,
            '33': 6925, '34': 6925, '35a': 6925, '37': null,
        },
    },
    {
        name: 'ty25-us-003',
        filingStatus: 'marriedFilingJointly',
        agedOrBlindBoxes: 1,
        deduction: 'standard',
        preferentialIncome: null,
        lines: {
            '1a': 32000, '9': 66005, '10': null, '11': 66005, '12': 33100,
            '15': 26905, '16': 2754, '19': null, '24': 2754, '25d': 3200,
            '26': null, '27': null, '28': null, '29': null, '32': null,
            '33': 3200, '34': 446, '35a': 446, '37': null,
        },
    },
    {
        name: 'ty25-us-004',
        filingStatus: 'marriedFilingJointly',
        agedOrBlindBoxes: 0,
        deduction: 'itemized',
        preferentialIncome: '$4,870 qualified dividends; $37,109 net long-term capital gain',
        lines: {
            '1a': 194368, '9': 258140, '10': 275, '11': 257865, '12': 38731,
            '15': 218413, '16': 34963, '19': 2200, '24': 33611, '25d': 33413,
            '26': null, '27': null, '28': null, '29': null, '32': null,
            '33': 33413, '34': null, '35a': null, '37': 198,
        },
    },
    {
        name: 'ty25-us-005',
        filingStatus: 'marriedFilingJointly',
        agedOrBlindBoxes: 0,
        deduction: 'standard',
        preferentialIncome: '$1,500 qualified dividends',
        lines: {
            '1a': 420000, '9': 443100, '10': 1135, '11': 441965, '12': 31500,
            '15': 406492, '16': 83948, '19': 100, '24': 88143, '25d': 6980,
            '26': null, '27': null, '28': null, '29': null, '32': null,
            '33': 6980, '34': null, '35a': null, '37': 81163,
        },
    },
    {
        name: 'ty25-us-006',
        filingStatus: 'marriedFilingSeparately',
        agedOrBlindBoxes: 0,
        deduction: 'standard',
        preferentialIncome: '$12,000 qualified dividends',
        lines: {
            '1a': 80000, '9': 257000, '10': 7065, '11': 249935, '12': 15750,
            '15': 229310, '16': 48402, '19': null, '24': 63983, '25d': 2000,
            '26': null, '27': null, '28': null, '29': null, '32': null,
            '33': 2000, '34': null, '35a': null, '37': 61983,
        },
    },
    {
        name: 'ty25-us-007',
        filingStatus: 'marriedFilingSeparately',
        agedOrBlindBoxes: 0,
        deduction: 'standard',
        preferentialIncome: '$7 qualified dividends; $18,458 net capital gain',
        lines: {
            '1a': 160368, '9': 181723, '10': 181, '11': 181542, '12': 15750,
            '15': 165317, '16': 30861, '19': null, '24': 38258, '25d': 29027,
            '26': null, '27': null, '28': null, '29': null, '32': null,
            '33': 29027, '34': null, '35a': null, '37': 9231,
        },
    },
    {
        name: 'ty25-us-008',
        filingStatus: 'marriedFilingSeparately',
        agedOrBlindBoxes: 0,
        deduction: 'itemized',
        preferentialIncome: null,
        lines: {
            '1a': 160368, '9': 160252, '10': 98, '11': 160154, '12': 37704,
            '15': 122193, '16': 22173, '19': null, '24': 22738, '25d': 28026,
            '26': null, '27': null, '28': null, '29': null, '32': null,
            '33': 28026, '34': 5288, '35a': 5288, '37': null,
        },
    },
    {
        name: 'ty25-us-009',
        filingStatus: 'marriedFilingSeparately',
        agedOrBlindBoxes: 1,
        deduction: 'standard',
        preferentialIncome: '$1,500 qualified dividends',
        lines: {
            '1a': 150000, '9': 162100, '10': null, '11': 162100, '12': 17350,
            '15': 143150, '16': 27068, '19': null, '24': 27373, '25d': 30000,
            '26': null, '27': null, '28': null, '29': null, '32': null,
            '33': 30000, '34': 2627, '35a': 2627, '37': null,
        },
    },
    {
        name: 'ty25-us-010',
        filingStatus: 'qualifyingSurvivingSpouse',
        agedOrBlindBoxes: 0,
        deduction: 'itemized',
        preferentialIncome: null,
        lines: {
            '1a': 1000, '9': 16000, '10': null, '11': 16000, '12': 8426,
            '15': 7574, '16': 758, '19': 373, '24': null, '25d': 1100,
            '26': null, '27': 4089, '28': null, '29': null, '32': 4089,
            '33': 5189, '34': 5189, '35a': 5189, '37': null,
        },
    },
]

/**
 * Hand-typed counts, read off the published set rather than off the array.
 * Ten federal returns; five take the standard deduction; four carry no
 * preferential income and so have a line 16 that follows from line 15 alone.
 */
export const expectedCounts = {
    returns: 10,
    standardDeduction: 5,
    noPreferentialIncome: 4,
}
