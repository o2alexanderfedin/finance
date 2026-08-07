/**
 * TY2025 tax parameters (TAX-01): the standard deduction, the aged/blind
 * additional amounts, the dependent standard-deduction cap, the ordinary
 * rate brackets for all six filing statuses, and the capital-gains rate
 * breakpoints — stored as compiled-in reference data, each individual
 * parameter carrying its OWN citation object rather than one shared,
 * document-level citation string.
 *
 * ## Why per-parameter citations, not one citation for the whole set
 *
 * "Rev. Proc. 2024-40 as modified by Rev. Proc. 2025-32" is true of exactly
 * one thing stored here — the basic standard deduction. Rev. Proc. 2025-32
 * §3.01 removes ONLY Rev. Proc. 2024-40 §2.15(1) (the original, pre-OBBBA
 * standard deduction), to reflect OBBBA's amendment of IRC §63(c)(7).
 * Everything else in this module — the aged/blind additional amounts
 * (Rev. Proc. 2024-40 §2.15(3)), the dependent standard-deduction cap
 * (Rev. Proc. 2024-40 §2.15(2)), the ordinary rate brackets (Rev. Proc.
 * 2024-40 §2.01), and the capital-gains rate breakpoints (Rev. Proc.
 * 2024-40 §2.03) — is UNMODIFIED by Rev. Proc. 2025-32 and cites Rev. Proc.
 * 2024-40 alone. Applying the "as modified by" phrase to every parameter
 * (rather than only the one it actually describes) is the exact sourcing
 * error this module exists to make structurally impossible: each dollar
 * figure below carries the specific Rev. Proc./section that actually
 * governs it, verified directly against both PDFs
 * (08-RESEARCH.md, "The TY2025 Parameter Set and Its Citations").
 *
 * ## Effective date
 *
 * Every citation below carries `effectiveDate: '2025-01-01'` — each
 * governing Rev. Proc. frames its own figures as applying "for taxable
 * years beginning in 2025," i.e. calendar TY2025 for a calendar-year
 * filer. Documented once here rather than repeated as a per-field
 * rationale.
 *
 * ## `ratePercent` is a rate, not money
 *
 * `ordinaryBrackets[status].brackets[n].ratePercent` is a small
 * whole-number integer (10/12/22/24/32/35/37). AGENTS.md's decimal-string
 * rule governs DOLLAR amounts crossing the money boundary; a rate is
 * neither a dollar amount nor a computed/fractional value, so it is
 * stored as a plain `number`, never a decimal string.
 *
 * ## Absent ceiling means "no ceiling," never a sentinel
 *
 * The last bracket in every status's `brackets` array has
 * `ceiling: undefined` — mirroring DOC-11's absent-is-not-zero
 * discipline, applied to an upper bound instead of a money box: there is
 * no ceiling on the top bracket, so the field is explicitly `undefined`,
 * never an `Infinity`-shaped string or a sentinel number that could be
 * mistaken for a real threshold.
 *
 * ## Not a `vnd.fjs.*` CAS document dialect
 *
 * Per 08-CONTEXT.md's decision: tax-year parameters are code-versioned
 * reference data shipped with the server, not a taxpayer document
 * validated through `fjs/document/base`. `fjs-run-integration.test.js`
 * spawns the real server against a fresh, unseeded CAS home — parameters
 * stored as a CAS document would make `finance_tax_params` fail there
 * until someone remembered to seed them.
 *
 * @module
 */
import { assert, assertEq } from 'functionalscript/fjs/asserts/module.f.js'
import { centsFromString, centsToString } from '../../exact/module.f.js'

/**
 * A single parameter's own citation: the exact Rev. Proc. number, its
 * section, and the effective date — never one shared citation for a
 * whole document.
 * @typedef {{
 *   readonly revProc: string,
 *   readonly section: string,
 *   readonly effectiveDate: string,
 * }} Citation
 */

/**
 * The five individual filing statuses Form 1040 (2025) prints on its own
 * face. Publication 1040's Tax Table prints only FOUR columns — there is
 * no qualifying-surviving-spouse column — and a QSS filer reads the
 * married-filing-jointly column. That mapping is `taxTableColumnFor` in
 * `fjs/tax/table`, stated once there and never an implicit assumption
 * here: QSS is a status in its own right in this module, with its own
 * stored parameters (10-CONTEXT.md Decision 6), because its dollar
 * amounts equal MFJ's while its maximum age/blindness box count does not.
 * @typedef {'single' | 'marriedFilingJointly' | 'marriedFilingSeparately' | 'headOfHousehold' | 'qualifyingSurvivingSpouse'} IndividualFilingStatus
 */

/**
 * Every filing status this project's TY2025 parameters cover, including
 * `'estatesAndTrusts'` (which has ordinary brackets and capital-gains
 * breakpoints, per Rev. Proc. 2024-40 §2.01/§2.03, but no standard
 * deduction and no printed Tax Table column).
 * @typedef {IndividualFilingStatus | 'estatesAndTrusts'} FilingStatus
 */

/** A dollar amount with its own citation.
 * @typedef {{ readonly amount: string, readonly citation: Citation }} AmountWithCitation
 */

/**
 * One ordinary-rate bracket: a rate and the dollar ceiling above which
 * the NEXT bracket applies — `undefined` on the last bracket (no
 * ceiling, never a sentinel).
 * @typedef {{ readonly ratePercent: number, readonly ceiling: string | undefined }} Bracket
 */

/** A filing status's full ordinary-rate schedule, with its own citation.
 * @typedef {{ readonly citation: Citation, readonly brackets: readonly Bracket[] }} BracketSchedule
 */

/** A filing status's capital-gains rate breakpoints, with its own citation.
 * @typedef {{
 *   readonly zeroRateMax: string,
 *   readonly fifteenRateMax: string,
 *   readonly citation: Citation,
 * }} CapitalGainsBreakpoints
 */

/**
 * The five individual filing statuses Form 1040 (2025) prints on its own
 * face (excludes `'estatesAndTrusts'`, which is not an individual filing
 * status at all). Publication 1040's Tax Table prints only FOUR columns;
 * a qualifying-surviving-spouse filer reads the married-filing-jointly
 * column, via `taxTableColumnFor` in `fjs/tax/table` — never by this list
 * being assumed to line up one-for-one with the printed columns.
 * Exported so later modules iterate this list instead of hand-typing the
 * same status names repeatedly.
 * @type {readonly IndividualFilingStatus[]}
 */
export const individualFilingStatuses = [
    'single',
    'marriedFilingJointly',
    'marriedFilingSeparately',
    'headOfHousehold',
    'qualifyingSurvivingSpouse',
]

/**
 * Every filing status this project's TY2025 parameters cover —
 * {@link individualFilingStatuses} plus `'estatesAndTrusts'`.
 * @type {readonly FilingStatus[]}
 */
export const allFilingStatuses = [...individualFilingStatuses, 'estatesAndTrusts']

/**
 * The basic standard deduction, OBBBA-revised — Rev. Proc. 2025-32
 * §3.01, which removes Rev. Proc. 2024-40 §2.15(1)'s original (pre-OBBBA)
 * figures. No `estatesAndTrusts` entry: the standard deduction does not
 * apply there.
 * @type {Record<IndividualFilingStatus, AmountWithCitation>}
 */
export const standardDeduction = {
    single: {
        amount: '15750.00',
        citation: { revProc: '2025-32', section: '§3.01', effectiveDate: '2025-01-01' },
    },
    marriedFilingJointly: {
        amount: '31500.00',
        citation: { revProc: '2025-32', section: '§3.01', effectiveDate: '2025-01-01' },
    },
    marriedFilingSeparately: {
        amount: '15750.00',
        citation: { revProc: '2025-32', section: '§3.01', effectiveDate: '2025-01-01' },
    },
    headOfHousehold: {
        amount: '23625.00',
        citation: { revProc: '2025-32', section: '§3.01', effectiveDate: '2025-01-01' },
    },
    // Rev. Proc. 2025-32 §3.01's table names one row "Married Individuals
    // Filing Joint Returns and Surviving Spouses" — a qualifying surviving
    // spouse reads THAT row, which is why the citation below is identical
    // to marriedFilingJointly's rather than a new one. The amount is
    // hand-typed from that table, deliberately NOT spread from
    // `standardDeduction.marriedFilingJointly`: a spread would move QSS
    // silently whenever MFJ's figure was mutated, so nothing could ever
    // observe the two statuses drifting apart.
    qualifyingSurvivingSpouse: {
        amount: '31500.00',
        citation: { revProc: '2025-32', section: '§3.01', effectiveDate: '2025-01-01' },
    },
}

/**
 * The additional standard deduction for being aged 65+ or blind — Rev.
 * Proc. 2024-40 §2.15(3), UNMODIFIED by Rev. Proc. 2025-32 (which removes
 * only §2.15(1), never §2.15(3)). Stored as a PER-QUALIFYING-CONDITION
 * amount: a taxpayer who is both 65+ and blind gets it twice, and each of
 * a married couple's spouses who separately qualifies gets it again —
 * that stacking arithmetic is the caller's job in a later phase; this
 * module stores the two per-condition constants only.
 * @type {{ readonly married: AmountWithCitation, readonly unmarried: AmountWithCitation }}
 */
export const agedOrBlindAdditional = {
    married: {
        amount: '1600.00',
        citation: { revProc: '2024-40', section: '§2.15(3)', effectiveDate: '2025-01-01' },
    },
    unmarried: {
        amount: '2000.00',
        citation: { revProc: '2024-40', section: '§2.15(3)', effectiveDate: '2025-01-01' },
    },
}

/**
 * The dependent standard-deduction cap's two constants — Rev. Proc.
 * 2024-40 §2.15(2), UNMODIFIED by Rev. Proc. 2025-32. The actual cap
 * formula (`max(minimum, earnedIncome + earnedIncomeAddOn)`) is a later
 * phase's computation; this module stores the two constants only.
 * @type {{ readonly minimum: AmountWithCitation, readonly earnedIncomeAddOn: AmountWithCitation }}
 */
export const dependentStandardDeductionCap = {
    minimum: {
        amount: '1350.00',
        citation: { revProc: '2024-40', section: '§2.15(2)', effectiveDate: '2025-01-01' },
    },
    earnedIncomeAddOn: {
        amount: '450.00',
        citation: { revProc: '2024-40', section: '§2.15(2)', effectiveDate: '2025-01-01' },
    },
}

/**
 * Ordinary rate brackets for every filing status — Rev. Proc. 2024-40
 * §2.01, UNMODIFIED by Rev. Proc. 2025-32. Brackets are ordered ascending
 * by `ratePercent`/`ceiling`; `ceiling` is the dollar amount above which
 * the NEXT bracket applies, and is `undefined` on the last bracket (no
 * ceiling — never a sentinel). `estatesAndTrusts` has only four rates
 * (10/24/35/37%) — there is no 12%/22%/32% bracket for this status; this
 * is not an omission.
 * @type {Record<FilingStatus, BracketSchedule>}
 */
export const ordinaryBrackets = {
    marriedFilingJointly: {
        citation: { revProc: '2024-40', section: '§2.01', effectiveDate: '2025-01-01' },
        brackets: [
            { ratePercent: 10, ceiling: '23850.00' },
            { ratePercent: 12, ceiling: '96950.00' },
            { ratePercent: 22, ceiling: '206700.00' },
            { ratePercent: 24, ceiling: '394600.00' },
            { ratePercent: 32, ceiling: '501050.00' },
            { ratePercent: 35, ceiling: '751600.00' },
            { ratePercent: 37, ceiling: undefined },
        ],
    },
    headOfHousehold: {
        citation: { revProc: '2024-40', section: '§2.01', effectiveDate: '2025-01-01' },
        brackets: [
            { ratePercent: 10, ceiling: '17000.00' },
            { ratePercent: 12, ceiling: '64850.00' },
            { ratePercent: 22, ceiling: '103350.00' },
            { ratePercent: 24, ceiling: '197300.00' },
            { ratePercent: 32, ceiling: '250500.00' },
            { ratePercent: 35, ceiling: '626350.00' },
            { ratePercent: 37, ceiling: undefined },
        ],
    },
    single: {
        citation: { revProc: '2024-40', section: '§2.01', effectiveDate: '2025-01-01' },
        brackets: [
            { ratePercent: 10, ceiling: '11925.00' },
            { ratePercent: 12, ceiling: '48475.00' },
            { ratePercent: 22, ceiling: '103350.00' },
            { ratePercent: 24, ceiling: '197300.00' },
            { ratePercent: 32, ceiling: '250525.00' },
            { ratePercent: 35, ceiling: '626350.00' },
            { ratePercent: 37, ceiling: undefined },
        ],
    },
    marriedFilingSeparately: {
        citation: { revProc: '2024-40', section: '§2.01', effectiveDate: '2025-01-01' },
        brackets: [
            { ratePercent: 10, ceiling: '11925.00' },
            { ratePercent: 12, ceiling: '48475.00' },
            { ratePercent: 22, ceiling: '103350.00' },
            { ratePercent: 24, ceiling: '197300.00' },
            { ratePercent: 32, ceiling: '250525.00' },
            { ratePercent: 35, ceiling: '375800.00' },
            { ratePercent: 37, ceiling: undefined },
        ],
    },
    // Rev. Proc. 2024-40 §2.01 Table 1 — the same table
    // `marriedFilingJointly` above reads, since that table covers "Married
    // Individuals Filing Joint Returns and Surviving Spouses". Every
    // ceiling below is hand-typed from that table, deliberately NOT spread
    // from `ordinaryBrackets.marriedFilingJointly`, for the reason stated
    // on `standardDeduction.qualifyingSurvivingSpouse`.
    qualifyingSurvivingSpouse: {
        citation: { revProc: '2024-40', section: '§2.01', effectiveDate: '2025-01-01' },
        brackets: [
            { ratePercent: 10, ceiling: '23850.00' },
            { ratePercent: 12, ceiling: '96950.00' },
            { ratePercent: 22, ceiling: '206700.00' },
            { ratePercent: 24, ceiling: '394600.00' },
            { ratePercent: 32, ceiling: '501050.00' },
            { ratePercent: 35, ceiling: '751600.00' },
            { ratePercent: 37, ceiling: undefined },
        ],
    },
    estatesAndTrusts: {
        citation: { revProc: '2024-40', section: '§2.01', effectiveDate: '2025-01-01' },
        brackets: [
            { ratePercent: 10, ceiling: '3150.00' },
            { ratePercent: 24, ceiling: '11450.00' },
            { ratePercent: 35, ceiling: '15650.00' },
            { ratePercent: 37, ceiling: undefined },
        ],
    },
}

/**
 * Maximum capital-gains rate breakpoints for every filing status — Rev.
 * Proc. 2024-40 §2.03, UNMODIFIED by Rev. Proc. 2025-32.
 * @type {Record<FilingStatus, CapitalGainsBreakpoints>}
 */
export const capitalGainsBreakpoints = {
    marriedFilingJointly: {
        zeroRateMax: '96700.00',
        fifteenRateMax: '600050.00',
        citation: { revProc: '2024-40', section: '§2.03', effectiveDate: '2025-01-01' },
    },
    marriedFilingSeparately: {
        zeroRateMax: '48350.00',
        fifteenRateMax: '300000.00',
        citation: { revProc: '2024-40', section: '§2.03', effectiveDate: '2025-01-01' },
    },
    headOfHousehold: {
        zeroRateMax: '64750.00',
        fifteenRateMax: '566700.00',
        citation: { revProc: '2024-40', section: '§2.03', effectiveDate: '2025-01-01' },
    },
    single: {
        zeroRateMax: '48350.00',
        fifteenRateMax: '533400.00',
        citation: { revProc: '2024-40', section: '§2.03', effectiveDate: '2025-01-01' },
    },
    // Rev. Proc. 2024-40 §2.03 — hand-typed from the same "Married Filing
    // Jointly and Surviving Spouses" row, deliberately NOT spread from
    // `capitalGainsBreakpoints.marriedFilingJointly`.
    qualifyingSurvivingSpouse: {
        zeroRateMax: '96700.00',
        fifteenRateMax: '600050.00',
        citation: { revProc: '2024-40', section: '§2.03', effectiveDate: '2025-01-01' },
    },
    estatesAndTrusts: {
        zeroRateMax: '3250.00',
        fifteenRateMax: '15900.00',
        citation: { revProc: '2024-40', section: '§2.03', effectiveDate: '2025-01-01' },
    },
}

/**
 * A full tax-year parameter set: every TY2025 parameter this phase
 * requires, together.
 * @typedef {{
 *   readonly standardDeduction: typeof standardDeduction,
 *   readonly agedOrBlindAdditional: typeof agedOrBlindAdditional,
 *   readonly dependentStandardDeductionCap: typeof dependentStandardDeductionCap,
 *   readonly ordinaryBrackets: typeof ordinaryBrackets,
 *   readonly capitalGainsBreakpoints: typeof capitalGainsBreakpoints,
 * }} TaxParamSet
 */

/**
 * The parameter set, keyed by tax year. Typed as an OPEN numeric-keyed
 * map (mirroring `finance_schema`'s `dialectSchemas` lesson: the
 * narrower literal-key type TS would otherwise infer from a single
 * entry produces the same lossy lookup type this repo has already hit
 * once), so looking this up by an arbitrary requested year yields a
 * clean `TaxParamSet | undefined`. Exactly one entry today: TY2025.
 * @type {{ readonly [year: number]: TaxParamSet }}
 */
export const taxParamsByYear = {
    2025: {
        standardDeduction,
        agedOrBlindAdditional,
        dependentStandardDeductionCap,
        ordinaryBrackets,
        capitalGainsBreakpoints,
    },
}

// ── Tests ────────────────────────────────────────────────────────────────────

/**
 * Type-predicate filter: narrows a `string | undefined` list down to
 * just the defined `string` entries — used once to gather every stored
 * bracket ceiling that actually exists (the last bracket's `undefined`
 * ceiling is skipped, never treated as an amount).
 * @type {(value: string | undefined) => value is string}
 */
const isDefinedString = value => value !== undefined

/**
 * Every dollar-string field this module exports, gathered once so the
 * round-trip check below (`everyDollarAmountIsAStringAndRoundTrips`)
 * walks the data instead of a second, hand-written list that could
 * drift from it.
 * @type {readonly string[]}
 */
const everyDollarStringField = [
    ...individualFilingStatuses.map(status => standardDeduction[status].amount),
    agedOrBlindAdditional.married.amount,
    agedOrBlindAdditional.unmarried.amount,
    dependentStandardDeductionCap.minimum.amount,
    dependentStandardDeductionCap.earnedIncomeAddOn.amount,
    ...allFilingStatuses.flatMap(status =>
        ordinaryBrackets[status].brackets
            .map(bracket => bracket.ceiling)
            .filter(isDefinedString),
    ),
    ...allFilingStatuses.flatMap(status => [
        capitalGainsBreakpoints[status].zeroRateMax,
        capitalGainsBreakpoints[status].fifteenRateMax,
    ]),
]

export const proof = {
    // T-08-05: the standard deduction is the OBBBA-revised figure, citing
    // Rev. Proc. 2025-32 §3.01 — never the original 2024-40 release.
    standardDeductionCitesObbbaRevision: () => {
        /** @type {Record<IndividualFilingStatus, string>} */
        const expectedAmounts = {
            single: '15750.00',
            marriedFilingJointly: '31500.00',
            marriedFilingSeparately: '15750.00',
            headOfHousehold: '23625.00',
            qualifyingSurvivingSpouse: '31500.00',
        }
        for (const status of individualFilingStatuses) {
            const entry = standardDeduction[status]
            assertEq(entry.citation.revProc, '2025-32')
            assertEq(entry.citation.section, '§3.01')
            assertEq(entry.citation.effectiveDate, '2025-01-01')
            assertEq(entry.amount, expectedAmounts[status])
        }
    },
    // T-08-05 (the other direction): every parameter Rev. Proc. 2025-32
    // did NOT touch cites Rev. Proc. 2024-40 alone — a citation copied
    // verbatim from the standard deduction onto these would fail here.
    // T-08-06-03: extended beyond `revProc` to also assert `section` and
    // `effectiveDate` — mutating a citation's section (e.g. §2.15(3) →
    // §2.15(9)) or effectiveDate (2025-01-01 → 2026-01-01) previously
    // survived undetected because only `revProc` was ever read.
    unmodifiedParametersCite2024_40Only: () => {
        assertEq(agedOrBlindAdditional.married.citation.revProc, '2024-40')
        assertEq(agedOrBlindAdditional.married.citation.section, '§2.15(3)')
        assertEq(agedOrBlindAdditional.married.citation.effectiveDate, '2025-01-01')
        assertEq(agedOrBlindAdditional.unmarried.citation.revProc, '2024-40')
        assertEq(agedOrBlindAdditional.unmarried.citation.section, '§2.15(3)')
        assertEq(agedOrBlindAdditional.unmarried.citation.effectiveDate, '2025-01-01')
        assertEq(dependentStandardDeductionCap.minimum.citation.revProc, '2024-40')
        assertEq(dependentStandardDeductionCap.minimum.citation.section, '§2.15(2)')
        assertEq(dependentStandardDeductionCap.minimum.citation.effectiveDate, '2025-01-01')
        assertEq(dependentStandardDeductionCap.earnedIncomeAddOn.citation.revProc, '2024-40')
        assertEq(dependentStandardDeductionCap.earnedIncomeAddOn.citation.section, '§2.15(2)')
        assertEq(dependentStandardDeductionCap.earnedIncomeAddOn.citation.effectiveDate, '2025-01-01')
        for (const status of allFilingStatuses) {
            assertEq(ordinaryBrackets[status].citation.revProc, '2024-40')
            assertEq(ordinaryBrackets[status].citation.section, '§2.01')
            assertEq(ordinaryBrackets[status].citation.effectiveDate, '2025-01-01')
            assertEq(capitalGainsBreakpoints[status].citation.revProc, '2024-40')
            assertEq(capitalGainsBreakpoints[status].citation.section, '§2.03')
            assertEq(capitalGainsBreakpoints[status].citation.effectiveDate, '2025-01-01')
        }
    },
    // T-08-02: every stored dollar amount is a `string`, never a JSON
    // number, and round-trips exactly through
    // `centsFromString`/`centsToString` — mirroring `fjs/exact`'s own
    // `proof.threeLayersOnOneValue`.
    everyDollarAmountIsAStringAndRoundTrips: () => {
        for (const value of everyDollarStringField) {
            assert(typeof value === 'string', ['expected a decimal string', value])
            assertEq(centsToString(centsFromString(value)), value)
        }
    },
    // T-08-06-01: every ordinary bracket ceiling AND rate, for all six
    // filing statuses, asserted against Rev. Proc. 2024-40 §2.01, Tables
    // 1-5, read directly from the published PDF (rp-24-40.pdf, pages
    // 5-7) — independent of this module's own stored data, so a wrong
    // stored figure cannot pass by comparing against itself. Asserted per
    // status, per bracket index (rate AND ceiling separately) — never one
    // aggregate deep comparison — so a single wrong figure names itself.
    // Includes the structural facts the printed tables show: estates &
    // trusts has exactly four brackets (10/24/35/37, no 12/22/32), every
    // status's final bracket has ceiling `undefined` (no ceiling), and
    // single/MFS are identical through 32% (250,525) but diverge at 35%
    // (626,350 vs 375,800), while HoH's 32% ceiling (250,500) is $25 below
    // single/MFS's. Rev. Proc. 2024-40 §2.01's Table 1 covers "Married
    // Individuals Filing Joint Returns and Surviving Spouses", so MFJ and
    // QSS are each transcribed from that one table INDEPENDENTLY below —
    // both hand-typed, neither derived from the other.
    everyOrdinaryBracketMatchesRevProc202440Tables1Through5: () => {
        /**
         * @type {Record<FilingStatus, readonly { readonly ratePercent: number, readonly ceiling: string | undefined }[]>}
         */
        const expected = {
            marriedFilingJointly: [
                { ratePercent: 10, ceiling: '23850.00' },
                { ratePercent: 12, ceiling: '96950.00' },
                { ratePercent: 22, ceiling: '206700.00' },
                { ratePercent: 24, ceiling: '394600.00' },
                { ratePercent: 32, ceiling: '501050.00' },
                { ratePercent: 35, ceiling: '751600.00' },
                { ratePercent: 37, ceiling: undefined },
            ],
            headOfHousehold: [
                { ratePercent: 10, ceiling: '17000.00' },
                { ratePercent: 12, ceiling: '64850.00' },
                { ratePercent: 22, ceiling: '103350.00' },
                { ratePercent: 24, ceiling: '197300.00' },
                { ratePercent: 32, ceiling: '250500.00' },
                { ratePercent: 35, ceiling: '626350.00' },
                { ratePercent: 37, ceiling: undefined },
            ],
            single: [
                { ratePercent: 10, ceiling: '11925.00' },
                { ratePercent: 12, ceiling: '48475.00' },
                { ratePercent: 22, ceiling: '103350.00' },
                { ratePercent: 24, ceiling: '197300.00' },
                { ratePercent: 32, ceiling: '250525.00' },
                { ratePercent: 35, ceiling: '626350.00' },
                { ratePercent: 37, ceiling: undefined },
            ],
            marriedFilingSeparately: [
                { ratePercent: 10, ceiling: '11925.00' },
                { ratePercent: 12, ceiling: '48475.00' },
                { ratePercent: 22, ceiling: '103350.00' },
                { ratePercent: 24, ceiling: '197300.00' },
                { ratePercent: 32, ceiling: '250525.00' },
                { ratePercent: 35, ceiling: '375800.00' },
                { ratePercent: 37, ceiling: undefined },
            ],
            qualifyingSurvivingSpouse: [
                { ratePercent: 10, ceiling: '23850.00' },
                { ratePercent: 12, ceiling: '96950.00' },
                { ratePercent: 22, ceiling: '206700.00' },
                { ratePercent: 24, ceiling: '394600.00' },
                { ratePercent: 32, ceiling: '501050.00' },
                { ratePercent: 35, ceiling: '751600.00' },
                { ratePercent: 37, ceiling: undefined },
            ],
            estatesAndTrusts: [
                { ratePercent: 10, ceiling: '3150.00' },
                { ratePercent: 24, ceiling: '11450.00' },
                { ratePercent: 35, ceiling: '15650.00' },
                { ratePercent: 37, ceiling: undefined },
            ],
        }
        for (const status of allFilingStatuses) {
            const { brackets } = ordinaryBrackets[status]
            const expectedBrackets = expected[status]
            assertEq(brackets.length, expectedBrackets.length, ['unexpected bracket count', status])
            for (const [index, expectedBracket] of expectedBrackets.entries()) {
                const bracket = brackets[index]
                assert(bracket !== undefined, ['expected a bracket at this index', status, index])
                assertEq(bracket.ratePercent, expectedBracket.ratePercent, ['bracket rate mismatch', status, index])
                assertEq(bracket.ceiling, expectedBracket.ceiling, ['bracket ceiling mismatch', status, index])
            }
        }
    },
    // T-08-06-01 (capital gains side): every capital-gains breakpoint —
    // both the zero-rate and 15%-rate maximum — for all six filing
    // statuses, asserted against Rev. Proc. 2024-40 §2.03, read directly
    // from the published PDF (rp-24-40.pdf, pages 7-8). Asserted per
    // status, per field, so a single wrong figure names itself.
    everyCapitalGainsBreakpointMatchesRevProc202440Section203: () => {
        /** @type {Record<FilingStatus, { readonly zeroRateMax: string, readonly fifteenRateMax: string }>} */
        const expected = {
            marriedFilingJointly: { zeroRateMax: '96700.00', fifteenRateMax: '600050.00' },
            marriedFilingSeparately: { zeroRateMax: '48350.00', fifteenRateMax: '300000.00' },
            headOfHousehold: { zeroRateMax: '64750.00', fifteenRateMax: '566700.00' },
            single: { zeroRateMax: '48350.00', fifteenRateMax: '533400.00' },
            qualifyingSurvivingSpouse: { zeroRateMax: '96700.00', fifteenRateMax: '600050.00' },
            estatesAndTrusts: { zeroRateMax: '3250.00', fifteenRateMax: '15900.00' },
        }
        for (const status of allFilingStatuses) {
            const entry = capitalGainsBreakpoints[status]
            const expectedEntry = expected[status]
            assertEq(entry.zeroRateMax, expectedEntry.zeroRateMax, ['zero-rate max mismatch', status])
            assertEq(entry.fifteenRateMax, expectedEntry.fifteenRateMax, ['fifteen-rate max mismatch', status])
        }
    },
    // 10-CONTEXT.md Decision 6: a qualifying surviving spouse reads the
    // SAME Rev. Proc. rows a married-filing-jointly filer does — Rev.
    // Proc. 2025-32 §3.01's "Married Individuals Filing Joint Returns and
    // Surviving Spouses" and Rev. Proc. 2024-40 §2.01 Table 1 / §2.03's
    // matching row — so every dollar figure the two statuses carry here is
    // equal.
    //
    // What this leaf is, and what it is NOT. It pins the RELATIONSHIP the
    // Rev. Proc. tables state, not the values: the values are pinned
    // independently, against the published tables, by the hand-typed
    // expectations in `standardDeductionCitesObbbaRevision`,
    // `everyOrdinaryBracketMatchesRevProc202440Tables1Through5` and
    // `everyCapitalGainsBreakpointMatchesRevProc202440Section203` above.
    // So this leaf comparing stored data against stored data is NOT the
    // tautology AGENTS.md warns about — it is a second, deliberately
    // weaker check layered on top of a primary-source one, and it is what
    // catches the failure mode the primary-source checks cannot: a future
    // edit that updates ONE of the two statuses (data and expectation
    // together, consistently) and forgets the other. Equality is asserted
    // field by field, never as one deep comparison, so a single divergence
    // names itself.
    //
    // It is also why neither status is stored as a spread of the other:
    // with a spread this leaf could never fail, and the drift it exists to
    // detect would be unrepresentable.
    qssParametersEqualMfjAndAreStoredIndependently: () => {
        assertEq(
            standardDeduction.qualifyingSurvivingSpouse.amount,
            standardDeduction.marriedFilingJointly.amount,
            'expected QSS and MFJ to share Rev. Proc. 2025-32 §3.01\'s standard deduction',
        )
        const qssBrackets = ordinaryBrackets.qualifyingSurvivingSpouse.brackets
        const mfjBrackets = ordinaryBrackets.marriedFilingJointly.brackets
        assertEq(qssBrackets.length, mfjBrackets.length, 'expected QSS and MFJ bracket counts to agree')
        for (const [index, mfjBracket] of mfjBrackets.entries()) {
            const qssBracket = qssBrackets[index]
            assert(qssBracket !== undefined, ['expected a QSS bracket at this index', index])
            assertEq(qssBracket.ratePercent, mfjBracket.ratePercent, ['QSS/MFJ bracket rate drift', index])
            assertEq(qssBracket.ceiling, mfjBracket.ceiling, ['QSS/MFJ bracket ceiling drift', index])
        }
        assertEq(
            capitalGainsBreakpoints.qualifyingSurvivingSpouse.zeroRateMax,
            capitalGainsBreakpoints.marriedFilingJointly.zeroRateMax,
            'QSS/MFJ zero-rate max drift',
        )
        assertEq(
            capitalGainsBreakpoints.qualifyingSurvivingSpouse.fifteenRateMax,
            capitalGainsBreakpoints.marriedFilingJointly.fifteenRateMax,
            'QSS/MFJ fifteen-rate max drift',
        )
    },
    // Estates & Trusts uses only 4 rates (10/24/35/37%) — no
    // 12%/22%/32% bracket for this status; not an omission.
    estatesAndTrustsHasExactlyFourBrackets: () => {
        const { brackets } = ordinaryBrackets.estatesAndTrusts
        assertEq(brackets.length, 4)
        assertEq(
            JSON.stringify(brackets.map(bracket => bracket.ratePercent)),
            JSON.stringify([10, 24, 35, 37]),
        )
        const last = brackets[brackets.length - 1]
        assert(last !== undefined, 'expected a last bracket')
        assertEq(last.ceiling, undefined)
    },
    // Every status's bracket array is ordered ascending by ceiling, and
    // `ceiling` is `undefined` if and only if it is the array's last
    // entry — never a gap, never a second undefined ceiling.
    bracketsAreSortedAscendingWithOnlyTheLastCeilingUndefined: () => {
        for (const status of allFilingStatuses) {
            const { brackets } = ordinaryBrackets[status]
            let previousCeilingCents = -1n
            for (const [index, bracket] of brackets.entries()) {
                const isLast = index === brackets.length - 1
                if (isLast) {
                    assertEq(bracket.ceiling, undefined)
                    continue
                }
                assert(
                    bracket.ceiling !== undefined,
                    ['expected a defined ceiling on a non-last bracket', status, index],
                )
                const ceilingCents = centsFromString(bracket.ceiling)
                assert(
                    ceilingCents > previousCeilingCents,
                    ['expected strictly increasing ceilings', status, index],
                )
                previousCeilingCents = ceilingCents
            }
        }
    },
}
