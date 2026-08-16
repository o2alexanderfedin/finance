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
 * ## `Citation` widened to a discriminated union — pulled forward from
 * Slice 2 (13-CONTEXT.md Decision 5.2)
 *
 * Every citation object here used to share one shape: `{ revProc, section,
 * effectiveDate }`. That shape has no honest field for a Public-Law-sourced
 * figure or a bare-IRC-section-sourced figure, and this plan's own new
 * parameter — the Social Security Benefits Worksheet's base amounts
 * (IRC §86(c), long-standing, never Rev.-Proc.-cited) — needs exactly that.
 * Rather than invent a second, parallel citation shape for one parameter,
 * `Citation` widens here, in Wave 1 Plan 1 of Phase 13, to the three-`kind`
 * discriminated union (`'revProc'` / `'publicLaw'` / `'code'`) that
 * 13-CONTEXT.md's Decision 5.2 places in Slice 2 (the senior deduction,
 * which needs the `'publicLaw'` arm). Landing it here instead is a
 * deliberate one-plan pull-forward, not scope creep: this plan's own
 * `socialSecurityBenefitsWorksheetBaseAmounts` needs the `'code'` arm
 * immediately, and widening the type twice (once for `'code'`, again later
 * for `'publicLaw'`) would be strictly more disruptive than widening it
 * once to the union Slice 2 already commits to. The change is additive
 * only: every EXISTING citation literal gains the `revProc` tag as its
 * first field, with no other value changed — verified by a grep over this
 * file's `revProc`-tagged citation literals matching the pre-existing
 * citation-literal count exactly, and by `unmodifiedParametersCite2024_40Only`
 * staying green unmodified.
 *
 * ## `seniorDeduction` — Slice 2's own `'publicLaw'`-kind parameter
 * (13-CONTEXT.md Decision 5.2/5.4/5.5, Phase 13 Wave 2 Plan 03)
 *
 * The OBBBA "Enhanced Deduction for Seniors" (Schedule 1-A Part V): a
 * $6,000 per-qualifying-taxpayer base amount, phased out at a CONTINUOUS 6%
 * of MAGI over $75,000 ($150,000 if MFJ). Every dollar figure here cites
 * `{ kind: 'publicLaw', publicLaw: '119-21', section: '§70103' }` —
 * 13-RESEARCH.md Pitfall 5 confirmed Rev. Proc. 2025-32 does NOT contain
 * this figure (it backs only the $2,200 CTC among this phase's new
 * numbers); the senior deduction is direct OBBBA statute. `phaseoutThreshold`
 * carries exactly FOUR entries (single/marriedFilingJointly/headOfHousehold/
 * qualifyingSurvivingSpouse) — deliberately NO `marriedFilingSeparately`
 * entry, since Decision 5.4/Pitfall 3 makes the deduction $0
 * UNCONDITIONALLY for MFS, at any income; there is no dollar threshold for
 * a status whose amount never depends on one. `fjs/schedule/1a` is where
 * that short-circuit lives, and where the eligibility test on the OTHER
 * four statuses reads `phaseoutThreshold` below.
 *
 * @module
 */
import { assert, assertEq, assertNotNullish } from 'functionalscript/fjs/asserts/module.f.js'
import { centsFromString, centsToString } from '../../exact/module.f.js'

/**
 * A single parameter's own citation: the exact governing authority and the
 * effective date — never one shared citation for a whole document. Three
 * kinds, since this project's parameters come from three genuinely
 * different kinds of authority (13-CONTEXT.md Decision 5.2):
 * - `'revProc'` — an annual IRS Revenue Procedure (e.g. Rev. Proc. 2024-40),
 *   the shape every parameter in this module used before Phase 13.
 * - `'publicLaw'` — a numbered Act of Congress (e.g. Public Law 119-21,
 *   OBBBA), for a figure Congress set directly rather than the IRS having
 *   inflation-adjusted it.
 * - `'code'` — a bare Internal Revenue Code section, for a long-standing
 *   figure with no annual Rev. Proc. and no recent Public Law of its own
 *   (e.g. the Social Security Benefits Worksheet's IRC §86(c) base amounts,
 *   unchanged since 1993).
 * @typedef {{
 *   readonly kind: 'revProc', readonly revProc: string, readonly section: string, readonly effectiveDate: string
 * } | {
 *   readonly kind: 'publicLaw', readonly publicLaw: string, readonly section: string, readonly effectiveDate: string
 * } | {
 *   readonly kind: 'code', readonly section: string, readonly effectiveDate: string
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
        citation: { kind: 'revProc', revProc: '2025-32', section: '§3.01', effectiveDate: '2025-01-01' },
    },
    marriedFilingJointly: {
        amount: '31500.00',
        citation: { kind: 'revProc', revProc: '2025-32', section: '§3.01', effectiveDate: '2025-01-01' },
    },
    marriedFilingSeparately: {
        amount: '15750.00',
        citation: { kind: 'revProc', revProc: '2025-32', section: '§3.01', effectiveDate: '2025-01-01' },
    },
    headOfHousehold: {
        amount: '23625.00',
        citation: { kind: 'revProc', revProc: '2025-32', section: '§3.01', effectiveDate: '2025-01-01' },
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
        citation: { kind: 'revProc', revProc: '2025-32', section: '§3.01', effectiveDate: '2025-01-01' },
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
        citation: { kind: 'revProc', revProc: '2024-40', section: '§2.15(3)', effectiveDate: '2025-01-01' },
    },
    unmarried: {
        amount: '2000.00',
        citation: { kind: 'revProc', revProc: '2024-40', section: '§2.15(3)', effectiveDate: '2025-01-01' },
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
        citation: { kind: 'revProc', revProc: '2024-40', section: '§2.15(2)', effectiveDate: '2025-01-01' },
    },
    earnedIncomeAddOn: {
        amount: '450.00',
        citation: { kind: 'revProc', revProc: '2024-40', section: '§2.15(2)', effectiveDate: '2025-01-01' },
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
        citation: { kind: 'revProc', revProc: '2024-40', section: '§2.01', effectiveDate: '2025-01-01' },
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
        citation: { kind: 'revProc', revProc: '2024-40', section: '§2.01', effectiveDate: '2025-01-01' },
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
        citation: { kind: 'revProc', revProc: '2024-40', section: '§2.01', effectiveDate: '2025-01-01' },
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
        citation: { kind: 'revProc', revProc: '2024-40', section: '§2.01', effectiveDate: '2025-01-01' },
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
        citation: { kind: 'revProc', revProc: '2024-40', section: '§2.01', effectiveDate: '2025-01-01' },
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
        citation: { kind: 'revProc', revProc: '2024-40', section: '§2.01', effectiveDate: '2025-01-01' },
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
        citation: { kind: 'revProc', revProc: '2024-40', section: '§2.03', effectiveDate: '2025-01-01' },
    },
    marriedFilingSeparately: {
        zeroRateMax: '48350.00',
        fifteenRateMax: '300000.00',
        citation: { kind: 'revProc', revProc: '2024-40', section: '§2.03', effectiveDate: '2025-01-01' },
    },
    headOfHousehold: {
        zeroRateMax: '64750.00',
        fifteenRateMax: '566700.00',
        citation: { kind: 'revProc', revProc: '2024-40', section: '§2.03', effectiveDate: '2025-01-01' },
    },
    single: {
        zeroRateMax: '48350.00',
        fifteenRateMax: '533400.00',
        citation: { kind: 'revProc', revProc: '2024-40', section: '§2.03', effectiveDate: '2025-01-01' },
    },
    // Rev. Proc. 2024-40 §2.03 — hand-typed from the same "Married Filing
    // Jointly and Surviving Spouses" row, deliberately NOT spread from
    // `capitalGainsBreakpoints.marriedFilingJointly`.
    qualifyingSurvivingSpouse: {
        zeroRateMax: '96700.00',
        fifteenRateMax: '600050.00',
        citation: { kind: 'revProc', revProc: '2024-40', section: '§2.03', effectiveDate: '2025-01-01' },
    },
    estatesAndTrusts: {
        zeroRateMax: '3250.00',
        fifteenRateMax: '15900.00',
        citation: { kind: 'revProc', revProc: '2024-40', section: '§2.03', effectiveDate: '2025-01-01' },
    },
}

/**
 * The Social Security Benefits Worksheet's two base-amount pairs
 * (`fjs/tax/ssb`'s printed lines 8 and 10) — IRC §86(c), unmodified since
 * 1993, so cited `kind: 'code'` rather than an annual Rev. Proc.
 * (13-CONTEXT.md Decision 5.2, 13-RESEARCH.md §2 "Base amounts, confirmed
 * exactly"). `'other'` covers single, head of household, qualifying
 * surviving spouse, and MFS-lived-apart-all-year — every filing-status case
 * the worksheet's own printed line 8 answers with a DOLLAR figure. The
 * third, genuinely different line-8 case — MFS-lived-with-spouse-at-any-
 * time — is not a third base amount at all; it is a structural skip
 * straight to line 16, so it is modeled as a branch inside `fjs/tax/ssb`
 * itself, never as a parameter here.
 * @type {{
 *   readonly firstThreshold: { readonly marriedFilingJointly: AmountWithCitation, readonly other: AmountWithCitation },
 *   readonly secondThreshold: { readonly marriedFilingJointly: AmountWithCitation, readonly other: AmountWithCitation },
 * }}
 */
export const socialSecurityBenefitsWorksheetBaseAmounts = {
    firstThreshold: {
        marriedFilingJointly: {
            amount: '32000.00',
            citation: { kind: 'code', section: '§86(c)', effectiveDate: '2025-01-01' },
        },
        other: {
            amount: '25000.00',
            citation: { kind: 'code', section: '§86(c)', effectiveDate: '2025-01-01' },
        },
    },
    secondThreshold: {
        marriedFilingJointly: {
            amount: '12000.00',
            citation: { kind: 'code', section: '§86(c)', effectiveDate: '2025-01-01' },
        },
        other: {
            amount: '9000.00',
            citation: { kind: 'code', section: '§86(c)', effectiveDate: '2025-01-01' },
        },
    },
}

/**
 * The OBBBA "Enhanced Deduction for Seniors" (Schedule 1-A Part V) —
 * Public Law 119-21 §70103, TAX-09 (13-CONTEXT.md Decision 5.2/5.4/5.5,
 * 13-RESEARCH.md §1/§7). `phaseoutThreshold` carries exactly the FOUR
 * filing statuses the printed form's own threshold applies to — see this
 * module's own docstring, "`seniorDeduction`", for why
 * `marriedFilingSeparately` has no entry here.
 *
 * ## `saltCap` and `medicalExpenseFloor` — Slice 3's parameters (TAX-13,
 * 13-CONTEXT.md Decision 2.1/3.1, 13-RESEARCH.md §3/Pitfall 2/Pitfall 5)
 *
 * The State and Local Tax Deduction Worksheet's five dollar figures — the
 * $40,000 flat cap, the $10,000 flat floor, and the $500,000/$250,000(MFS)
 * phase-down threshold — are direct OBBBA statute (Public Law 119-21
 * §70120), never Rev. Proc. 2025-32 (which backs only the CTC among this
 * phase's new numbers — Pitfall 5). **The worksheet's own body (lines w1
 * through w9) uses the FLAT, non-MFS-halved dollar figures throughout**;
 * only the FINAL line (w10) halves the computed result for MFS filers.
 * That halving is Schedule A's own arithmetic to perform, not a second,
 * pre-halved parameter stored here — storing an MFS-specific `flatCap` or
 * `floor` would misrepresent what the worksheet's printed lines actually
 * say (Pitfall 2). `phasedownRatePercent` is 30, continuous — no $1,000
 * stepping, unlike the senior deduction's Schedule 1-A siblings.
 *
 * `medicalExpenseFloor` is the 7.5%-of-AGI floor behind Schedule A line 3
 * — long-standing IRC §213(a), unmodified by OBBBA (13-RESEARCH.md
 * assumption A2), so it cites `kind: 'code'` rather than either OBBBA
 * union arm. Shaped with a `ratePercent`, not an `AmountWithCitation`: 7.5
 * is a rate applied to AGI, not a dollar amount, mirroring
 * `seniorDeduction.phaseoutRatePercent` and `Bracket.ratePercent` — plain
 * numbers crossing no money boundary, so neither belongs in
 * `everyDollarStringField`'s round-trip list below.
 * @type {{
 *   readonly amount: AmountWithCitation,
 *   readonly phaseoutRatePercent: number,
 *   readonly phaseoutThreshold: {
 *     readonly single: AmountWithCitation,
 *     readonly marriedFilingJointly: AmountWithCitation,
 *     readonly headOfHousehold: AmountWithCitation,
 *     readonly qualifyingSurvivingSpouse: AmountWithCitation,
 *   },
 * }}
 */
export const seniorDeduction = {
    amount: {
        amount: '6000.00',
        citation: { kind: 'publicLaw', publicLaw: '119-21', section: '§70103', effectiveDate: '2025-01-01' },
    },
    // A plain rate, not money — AGENTS.md's decimal-string rule governs
    // DOLLAR amounts, mirroring `Bracket.ratePercent` above.
    phaseoutRatePercent: 6,
    phaseoutThreshold: {
        single: {
            amount: '75000.00',
            citation: { kind: 'publicLaw', publicLaw: '119-21', section: '§70103', effectiveDate: '2025-01-01' },
        },
        marriedFilingJointly: {
            amount: '150000.00',
            citation: { kind: 'publicLaw', publicLaw: '119-21', section: '§70103', effectiveDate: '2025-01-01' },
        },
        headOfHousehold: {
            amount: '75000.00',
            citation: { kind: 'publicLaw', publicLaw: '119-21', section: '§70103', effectiveDate: '2025-01-01' },
        },
        qualifyingSurvivingSpouse: {
            amount: '75000.00',
            citation: { kind: 'publicLaw', publicLaw: '119-21', section: '§70103', effectiveDate: '2025-01-01' },
        },
    },
}

/**
 * The State and Local Tax Deduction Worksheet's parameters (Schedule A
 * line 5e) — Public Law 119-21 §70120, TAX-13 (13-CONTEXT.md Decision
 * 2.1/3.1, 13-RESEARCH.md §3 "SALT cap: $40,000 ($20,000 MFS), confirmed"
 * / Pitfall 2). Every dollar figure below is the FLAT, non-MFS-halved
 * value the worksheet's own printed lines w1-w9 use — see this module's
 * own docstring, "`saltCap` and `medicalExpenseFloor`", for why no
 * MFS-specific `flatCap`/`floor` is stored: only the worksheet's FINAL
 * line (w10) halves the result for MFS, and that is Schedule A's
 * arithmetic to perform, not a parameter to pre-compute here.
 * `threshold.marriedFilingSeparately` is the one figure in this parameter
 * set that genuinely IS status-specific on the worksheet's own face (w5).
 * @type {{
 *   readonly flatCap: AmountWithCitation,
 *   readonly floor: AmountWithCitation,
 *   readonly phasedownRatePercent: number,
 *   readonly threshold: {
 *     readonly single: AmountWithCitation,
 *     readonly marriedFilingJointly: AmountWithCitation,
 *     readonly marriedFilingSeparately: AmountWithCitation,
 *     readonly headOfHousehold: AmountWithCitation,
 *     readonly qualifyingSurvivingSpouse: AmountWithCitation,
 *   },
 * }}
 */
export const saltCap = {
    flatCap: {
        amount: '40000.00',
        citation: { kind: 'publicLaw', publicLaw: '119-21', section: '§70120', effectiveDate: '2025-01-01' },
    },
    floor: {
        amount: '10000.00',
        citation: { kind: 'publicLaw', publicLaw: '119-21', section: '§70120', effectiveDate: '2025-01-01' },
    },
    // A plain rate, not money — mirroring `seniorDeduction.phaseoutRatePercent`.
    phasedownRatePercent: 30,
    threshold: {
        single: {
            amount: '500000.00',
            citation: { kind: 'publicLaw', publicLaw: '119-21', section: '§70120', effectiveDate: '2025-01-01' },
        },
        marriedFilingJointly: {
            amount: '500000.00',
            citation: { kind: 'publicLaw', publicLaw: '119-21', section: '§70120', effectiveDate: '2025-01-01' },
        },
        marriedFilingSeparately: {
            amount: '250000.00',
            citation: { kind: 'publicLaw', publicLaw: '119-21', section: '§70120', effectiveDate: '2025-01-01' },
        },
        headOfHousehold: {
            amount: '500000.00',
            citation: { kind: 'publicLaw', publicLaw: '119-21', section: '§70120', effectiveDate: '2025-01-01' },
        },
        qualifyingSurvivingSpouse: {
            amount: '500000.00',
            citation: { kind: 'publicLaw', publicLaw: '119-21', section: '§70120', effectiveDate: '2025-01-01' },
        },
    },
}

/**
 * Schedule A line 3's 7.5%-of-AGI medical-expense floor — IRC §213(a),
 * long-standing, unmodified by OBBBA (13-RESEARCH.md §3 "Medical floor:
 * 7.5%, confirmed unchanged"). `ratePercent`, not `amount`: this is a rate
 * applied to AGI, not a dollar amount, so it is a plain number crossing no
 * money boundary — see this module's own docstring for why it is excluded
 * from {@link everyDollarStringField} below.
 * @type {{ readonly ratePercent: number, readonly citation: Citation }}
 */
export const medicalExpenseFloor = {
    ratePercent: 7.5,
    citation: { kind: 'code', section: '§213(a)', effectiveDate: '2025-01-01' },
}

/**
 * Schedule 8812's Child Tax Credit / Credit for Other Dependents /
 * Additional Child Tax Credit figures, plus the phase-out threshold and
 * rate — TAX-12 (13-CONTEXT.md Decision 4.1/4.3, 13-RESEARCH.md §4/§7).
 *
 * **This is the ONE parameter group in this module where the figures are
 * NOT uniformly sourced.** `ctcAmount` ($2,200) is the only figure in this
 * entire phase Rev. Proc. 2025-32 actually backs — confirmed by a full grep
 * of that document (13-RESEARCH.md Pitfall 5, `[VERIFIED: f1040s8.pdf p1
 * line5; rp-25-32.pdf §2.03]`). `odcAmount` ($500), `actcCap` ($1,700), and
 * `phaseoutThreshold` ($400,000 MFJ / $200,000 other) all cite `kind:
 * 'code'`, §24(h) — research's best available identification of the
 * governing U.S. Code subsection (13-RESEARCH.md's own "LOW confidence on
 * exact U.S. Code section numbers for OBBBA provisions" caveat covers the
 * SECTION NUMBER only; the DOLLAR figures themselves are HIGH confidence,
 * read directly off the published 2025 form). Do not default any of these
 * three to `kind: 'revProc'` merely because `ctcAmount` is — that is
 * exactly the sourcing error Pitfall 5 names, inverted.
 *
 * **Carried finding C-3 (13-VALIDATION.md, resolved here): §24(h) is the
 * governing PROVISION, not the literal source of these three amounts.**
 * IRC §24(h)(5) is genuinely where the refundable-credit-cap mechanism
 * lives, but the section itself carries base amounts that Treasury
 * inflation-adjusts for the current tax year through a separate revenue
 * procedure — so a reader who opens §24(h) looking for `$1,700`, `$500` or
 * `$400,000`/`$200,000` will not find those figures written there. This
 * research did not identify the specific Rev. Proc. that performs that
 * OBBBA-era adjustment (unlike `ctcAmount`, where Rev. Proc. 2025-32 §2.03
 * was confirmed by a full grep of the document itself), so `kind: 'code'`
 * stays as the honest, verifiable half of the citation — the governing
 * provision — rather than guessing a Rev. Proc. number this research never
 * checked. What backs the DOLLAR VALUE for all three is `13-RESEARCH.md`'s
 * own `[VERIFIED: f1040s8.pdf p2 line16b]`: each figure was read directly
 * off the printed 2025 Schedule 8812, the same "form face" sourcing this
 * module's other non-`revProc` citations already document above.
 *
 * `phaseoutRatePercent` (5) is a plain rate, mirroring every other
 * `*RatePercent` field in this module. Unlike `seniorDeduction`'s and
 * `saltCap`'s CONTINUOUS phase-outs, Schedule 8812's is STEPPED — a true
 * cliff, rounding the excess UP to the next whole $1,000 before applying the
 * rate (13-RESEARCH.md §7). That rounding arithmetic
 * (`roundUpToNextThousandDollars`) has no precedent anywhere in this
 * codebase and is a later plan's job to write and apply; this module stores
 * the threshold and rate only, exactly as it stores every other phase-out's
 * inputs without performing the phase-out itself.
 *
 * **`actcEarnedIncomeThreshold` ($2,500) and `actcEarnedIncomeRatePercent`
 * (15) — WR-01 (13-REVIEW.md).** Schedule 8812 Part II-A lines 19/20: "Is
 * line 18a more than $2,500? ... Multiply line 19 by 15% (0.15)"
 * (13-RESEARCH.md §4, `[VERIFIED: f1040s8.pdf p2 lines 19-20]`). Both were
 * hardcoded literals in `fjs/form8812` with no citation at all until this
 * fix — every other dollar figure and rate this phase introduces has one.
 * Cited `kind: 'code'`, §24(d) (the ACTC computation subsection) — the SAME
 * "governing provision, not the literal source" caveat `odcAmount`/
 * `actcCap`/`phaseoutThreshold` already carry above (Carried finding C-3):
 * this research did not identify the specific Rev. Proc. performing any
 * inflation adjustment to $2,500, so `kind: 'code'` stays the honest,
 * verifiable half of the citation rather than a guessed Rev. Proc. number.
 * What backs the DOLLAR VALUE and the RATE is the printed 2025 form itself.
 * @type {{
 *   readonly ctcAmount: AmountWithCitation,
 *   readonly odcAmount: AmountWithCitation,
 *   readonly actcCap: AmountWithCitation,
 *   readonly phaseoutThreshold: {
 *     readonly marriedFilingJointly: AmountWithCitation,
 *     readonly other: AmountWithCitation,
 *   },
 *   readonly phaseoutRatePercent: number,
 *   readonly actcEarnedIncomeThreshold: AmountWithCitation,
 *   readonly actcEarnedIncomeRatePercent: number,
 * }}
 */
export const childTaxCredit = {
    ctcAmount: {
        amount: '2200.00',
        citation: { kind: 'revProc', revProc: '2025-32', section: '§2.03', effectiveDate: '2025-01-01' },
    },
    odcAmount: {
        amount: '500.00',
        citation: { kind: 'code', section: '§24(h)', effectiveDate: '2025-01-01' },
    },
    actcCap: {
        amount: '1700.00',
        citation: { kind: 'code', section: '§24(h)', effectiveDate: '2025-01-01' },
    },
    phaseoutThreshold: {
        marriedFilingJointly: {
            amount: '400000.00',
            citation: { kind: 'code', section: '§24(h)', effectiveDate: '2025-01-01' },
        },
        other: {
            amount: '200000.00',
            citation: { kind: 'code', section: '§24(h)', effectiveDate: '2025-01-01' },
        },
    },
    // A plain rate, not money — mirroring `seniorDeduction.phaseoutRatePercent`
    // and `saltCap.phasedownRatePercent`. Applied to the EXCESS after it is
    // rounded UP to the next whole $1,000 (13-RESEARCH.md §7) — that
    // rounding is 13-09's arithmetic to perform, not this module's.
    phaseoutRatePercent: 5,
    // Schedule 8812 Part II-A line 19's own $2,500 earned-income floor —
    // see this field group's own docstring above (WR-01).
    actcEarnedIncomeThreshold: {
        amount: '2500.00',
        citation: { kind: 'code', section: '§24(d)', effectiveDate: '2025-01-01' },
    },
    // Part II-A line 20's own 15% rate — same docstring, same citation
    // reasoning; a plain rate, not money.
    actcEarnedIncomeRatePercent: 15,
}

/**
 * Form 8959's Additional Medicare Tax thresholds — IRC §3101(b)(2), TAX-19
 * (Phase 22's computable tripwires). The 0.9% tax applies to Medicare wages
 * (Form W-2 box 5) **in excess of** the figure below for the filer's status.
 *
 * **These figures are NOT inflation-indexed, and that is the point of storing
 * them here rather than anywhere else.** §3101(b)(2) writes the three dollar
 * amounts into the statute itself — `(A)` $250,000 "in the case of a joint
 * return", `(B)` $125,000 "in the case of a married taxpayer (as defined in
 * section 7703) filing a separate return", `(C)` $200,000 "in any other case"
 * — with no Rev. Proc. adjusting them, unchanged since they took effect for
 * taxable years beginning after December 31, 2012. So this is a `kind: 'code'`
 * citation for the same reason `medicalExpenseFloor` is: there is no annual
 * revenue procedure to cite, and inventing one would be the sourcing error
 * this module's own header exists to prevent. `effectiveDate` still reads
 * `'2025-01-01'`, per that header — every citation here states the year the
 * figure is being APPLIED for, not the year it was enacted.
 *
 * **`qualifyingSurvivingSpouse` is $200,000, NOT MFJ's $250,000 — the one
 * trap in this parameter group.** A QSS return is not a *joint return*, so
 * §3101(b)(2)(A) does not reach it and it falls to `(C)`'s "any other case".
 * Form 8959's own printed threshold table says so directly ("Qualifying
 * surviving spouse … $200,000"). Every OTHER per-status parameter in this
 * module gives QSS the married-filing-jointly figure (see
 * {@link standardDeduction}'s own note), so copying that habit here would
 * understate a QSS filer's threshold by $50,000 and silently disarm the
 * tripwire that reads it. Hand-typed per status, deliberately never spread
 * from another status's entry, for exactly the reason
 * {@link standardDeduction} states: a spread makes two statuses impossible to
 * observe drifting apart.
 *
 * Nothing here stores the 0.9% RATE. This phase builds the tripwire that
 * refuses a return whose W-2s cross the threshold undeclared; it does not
 * compute Form 8959, so a rate would be a parameter with no reader (YAGNI).
 * Phase 23 adds it beside these thresholds when it adds the form.
 *
 * No `estatesAndTrusts` entry: the Additional Medicare Tax is a tax on an
 * individual's wages and self-employment income, and this map is keyed by
 * {@link IndividualFilingStatus} to say so at the type level.
 * @type {Record<IndividualFilingStatus, AmountWithCitation>}
 */
export const additionalMedicareTaxThreshold = {
    single: {
        amount: '200000.00',
        citation: { kind: 'code', section: '§3101(b)(2)(C)', effectiveDate: '2025-01-01' },
    },
    marriedFilingJointly: {
        amount: '250000.00',
        citation: { kind: 'code', section: '§3101(b)(2)(A)', effectiveDate: '2025-01-01' },
    },
    marriedFilingSeparately: {
        amount: '125000.00',
        citation: { kind: 'code', section: '§3101(b)(2)(B)', effectiveDate: '2025-01-01' },
    },
    headOfHousehold: {
        amount: '200000.00',
        citation: { kind: 'code', section: '§3101(b)(2)(C)', effectiveDate: '2025-01-01' },
    },
    // See this group's own docstring: "any other case", NOT the joint-return
    // figure every other per-status parameter in this module gives QSS.
    qualifyingSurvivingSpouse: {
        amount: '200000.00',
        citation: { kind: 'code', section: '§3101(b)(2)(C)', effectiveDate: '2025-01-01' },
    },
}

/**
 * Form 8959's two rates, in BASIS POINTS (hundredths of one percent): the
 * 0.9% Additional Medicare Tax itself (IRC §3101(b)(2)) and the 1.45%
 * ordinary Medicare tax (IRC §3101(b)(1)) that Form 8959 Part V line 21
 * subtracts back out of Form W-2 box 6. TAX-20, Phase 23 — the rate
 * {@link additionalMedicareTaxThreshold}'s own docstring says this phase
 * adds "beside these thresholds when it adds the form."
 *
 * **Basis points, not `ratePercent`, and the reason is arithmetic rather
 * than taste.** Every other rate in this module — `ordinaryBrackets`'
 * 10/12/22/24/32/35/37, `seniorDeduction.phaseoutRatePercent`'s 6,
 * `childTaxCredit.phaseoutRatePercent`'s 5, `actcEarnedIncomeRatePercent`'s
 * 15 — is a whole number of percent, so a `ratePercent: number` field is
 * exact. Neither of these two is: 0.9 and 1.45 are not integers, and
 * storing either as a JavaScript `number` of percent would put a
 * non-terminating binary fraction where this module's whole discipline is
 * exactness (`0.9` and `1.45` are both inexact as IEEE 754 doubles). One
 * hundredth of a percent is the coarsest unit that expresses BOTH exactly as
 * integers, so both are stored that way and the consumer multiplies by
 * `basisPoints / 10000`. `fjs/form8959` performs that multiplication through
 * `fjs/types/rational`, cent-exact, half-up — never through a float.
 *
 * Both are `kind: 'code'` citations for the same reason the thresholds are:
 * §3101(b) writes both rates into the statute (1.45% in `(b)(1)`, "0.9
 * percent" in `(b)(2)`), no Revenue Procedure adjusts either, and inventing
 * a Rev. Proc. number would be the sourcing error this module's own header
 * exists to prevent. The rates carry their citation on a `citation` field of
 * their own rather than through `AmountWithCitation`, because
 * `AmountWithCitation`'s `amount` is a DOLLAR string (T-08-02 checks every
 * one of them round-trips through `centsFromString`) and a rate is not money.
 * @type {{
 *   readonly additionalRateBasisPoints: number,
 *   readonly regularMedicareRateBasisPoints: number,
 *   readonly citation: Citation,
 * }}
 */
export const additionalMedicareTaxRates = {
    // 0.9% — IRC §3101(b)(2), the Additional Medicare Tax itself.
    additionalRateBasisPoints: 90,
    // 1.45% — IRC §3101(b)(1), the ordinary Medicare tax an employer
    // withholds on EVERY dollar of box 5. Form 8959 Part V's whole job is to
    // separate this from the line above it inside one box-6 figure; see
    // `fjs/form8959`'s own Part V docstring for how the printed form does it.
    regularMedicareRateBasisPoints: 145,
    citation: { kind: 'code', section: '§3101(b)', effectiveDate: '2025-01-01' },
}

/**
 * Form 8960's Net Investment Income Tax thresholds — IRC **§1411(b)**,
 * TAX-21, Phase 23. The 3.8% tax applies to the LESSER of net investment
 * income and the excess of §1411's own modified adjusted gross income over
 * the figure below for the filer's status.
 *
 * **These are a DIFFERENT STATUTE's thresholds that happen to share three of
 * §3101(b)(2)'s four dollar figures, and they are stored separately for
 * exactly that reason.** Aliasing this parameter to
 * {@link additionalMedicareTaxThreshold} — spreading it, re-exporting it,
 * or having `fjs/form8960` read the Medicare one — would make the two
 * impossible to observe drifting apart, which is the same argument
 * {@link standardDeduction} makes about spreading one status's entry onto
 * another, one level up. They already differ TODAY, in the one row below
 * that a reader is most likely to copy wrong:
 *
 * **`qualifyingSurvivingSpouse` is $250,000 here, and $200,000 under
 * §3101(b)(2) — the two statutes disagree, and this is the direction that
 * disagreement runs.** §1411(b)(1) reads *"in the case of a taxpayer making
 * a joint return under section 6013 **or a surviving spouse (as defined in
 * section 2(a))**, $250,000"* — the surviving-spouse clause is written into
 * the statute itself, and §2(a) is precisely the qualifying-surviving-spouse
 * filing status. §3101(b)(2)(A) has NO such clause; it says only "in the
 * case of a joint return", so a QSS return falls to that statute's
 * `(C)` "any other case" at $200,000. Form 8960's own printed threshold
 * table says $250,000 for a qualifying surviving spouse and Form 8959's says
 * $200,000, which is the check that resolves the two against paper rather
 * than against memory. Getting this backwards in EITHER direction is a
 * silent wrong number: copying §3101's answer here understates the NIIT
 * threshold by $50,000 for a widow(er), and copying this one there
 * overstates the Medicare one by the same amount.
 *
 * `marriedFilingSeparately` is **½ of the joint figure** by §1411(b)(2)'s own
 * words rather than a separately-enacted amount, which is why it lands on the
 * same $125,000 §3101(b)(2)(B) states outright. Hand-typed per status anyway,
 * never computed from the joint row and never spread from it: a halving
 * performed here would be a rule this module states twice.
 *
 * Like §3101(b)(2)'s, these figures are **not inflation-indexed** — §1411 has
 * carried the same three amounts since it took effect for taxable years
 * beginning after December 31, 2012, with no Revenue Procedure adjusting
 * them. Hence `kind: 'code'`, for the reason
 * {@link additionalMedicareTaxThreshold} records in full.
 *
 * No `estatesAndTrusts` entry: §1411(a)(2) taxes an estate or trust against
 * the dollar amount at which the highest income-tax bracket BEGINS, not
 * against a threshold of its own, and Form 8960 Part III splits into
 * individual (lines 13-17) and estate/trust (lines 18a-21) halves to say so.
 * This map is keyed by {@link IndividualFilingStatus} so that boundary is a
 * type rather than a comment.
 * @type {Record<IndividualFilingStatus, AmountWithCitation>}
 */
export const netInvestmentIncomeTaxThreshold = {
    single: {
        amount: '200000.00',
        citation: { kind: 'code', section: '§1411(b)(3)', effectiveDate: '2025-01-01' },
    },
    marriedFilingJointly: {
        amount: '250000.00',
        citation: { kind: 'code', section: '§1411(b)(1)', effectiveDate: '2025-01-01' },
    },
    marriedFilingSeparately: {
        amount: '125000.00',
        citation: { kind: 'code', section: '§1411(b)(2)', effectiveDate: '2025-01-01' },
    },
    headOfHousehold: {
        amount: '200000.00',
        citation: { kind: 'code', section: '§1411(b)(3)', effectiveDate: '2025-01-01' },
    },
    // See this group's own docstring: §1411(b)(1)'s "or a surviving spouse
    // (as defined in section 2(a))" clause puts QSS on the JOINT figure here
    // -- the OPPOSITE of `additionalMedicareTaxThreshold`, where the same
    // status gets $200,000 because §3101(b)(2)(A) has no such clause.
    qualifyingSurvivingSpouse: {
        amount: '250000.00',
        citation: { kind: 'code', section: '§1411(b)(1)', effectiveDate: '2025-01-01' },
    },
}

/**
 * Form 8960's single rate, in BASIS POINTS: 3.8% — IRC §1411(a)(1), TAX-21.
 *
 * A bare number rather than an object, unlike {@link additionalMedicareTaxRates},
 * because §1411 has exactly ONE rate to store: Form 8960 never has to
 * subtract a second, ordinary rate back out of a withholding box the way
 * Form 8959 Part V does with the 1.45% Medicare tax. Grouping one field into
 * an object to look symmetric with a two-field neighbour would be a shape
 * chosen for tidiness over what the statute says.
 *
 * Basis points for the same exactness reason {@link additionalMedicareTaxRates}
 * records: 3.8 is not a whole number of percent, and `3.8` is not exact as an
 * IEEE 754 double. 380 hundredths of a percent is.
 *
 * Its citation travels with the thresholds' rather than on a field of its
 * own: §1411(a)(1) is the same sentence that imposes the tax the thresholds
 * bound, and {@link netInvestmentIncomeTaxThreshold}'s own entries cite
 * §1411(b), one subsection over.
 * @type {number}
 */
export const netInvestmentIncomeTaxRateBasisPoints = 380

/**
 * Schedule 1 line 21's student loan interest deduction — IRC §221, TAX-23,
 * Phase 24.
 *
 * ## These figures ARE inflation-indexed, and that is the opposite of the two
 * parameter groups directly above
 *
 * {@link additionalMedicareTaxThreshold} and {@link netInvestmentIncomeTaxThreshold}
 * each state, at length, that their dollar amounts are written into the
 * statute and that **no Revenue Procedure adjusts them**. That reasoning does
 * NOT carry over here, and copying it would be a silent error one tax year
 * from now: **§221(f)(1) requires the phase-out thresholds to be
 * inflation-adjusted every year**, rounded to the next lowest multiple of
 * $5,000. The figures below are TY2025's and TY2025's alone. When a second
 * tax year is added to {@link taxParamsByYear}, `maximumDeduction` may well
 * stay $2,500 (§221(b)(1) is a flat statutory cap that §221(f) does NOT
 * index — see below) while every threshold moves.
 *
 * The movement is real rather than theoretical: $70,000/$140,000 (2021),
 * $70,000/$145,000 (2022), $75,000/$155,000 (2023), $80,000/$165,000 (2024),
 * $85,000/$170,000 (2025). Five consecutive years, four changes.
 *
 * ## Two figures, not three — `phaseoutRange`, never a stored end point
 *
 * A reader of §221(b)(2)(B) sees the deduction "begin to phase out" at
 * $85,000 ($170,000 joint) and be "completely phased out" at $100,000
 * ($200,000 joint) — three numbers per status, of which only two are
 * independent. **The printed Student Loan Interest Deduction Worksheet uses
 * exactly the two stored here**: its line 5 is {@link phaseoutThreshold} and
 * its line 7 divides by {@link phaseoutRange} ("Divide line 6 by $15,000
 * ($30,000 if married filing jointly)"). Storing the completely-phased-out
 * end point as a THIRD figure would be a second source of truth able to
 * disagree with the two the computation actually reads;
 * `studentLoanInterestPhaseoutEndPointsMatchTheStatutoryFigures` asserts the
 * DERIVED sum against a hand-typed $100,000/$200,000 instead, which is the
 * check a third stored field would have made impossible.
 *
 * ## `marriedFilingSeparately` has no entry, and that is a filing-status gate
 *
 * §221(e)(2) — *"if the taxpayer is married at the close of the taxable
 * year, the deduction shall be allowed ... only if the taxpayer and the
 * taxpayer's spouse file a joint return"* — makes the deduction $0
 * UNCONDITIONALLY for a married-filing-separately filer, at ANY income. So
 * there is no dollar threshold for a status whose amount never depends on
 * one, exactly as {@link seniorDeduction}'s own `phaseoutThreshold` omits the
 * same status for the same reason. `fjs/schedule/1` is where that
 * short-circuit lives, ahead of the worksheet's own line 1.
 *
 * ## Citation kind
 *
 * `kind: 'code'`, §221's own subsections — the same "governing provision, not
 * the literal source" position {@link childTaxCredit} records as Carried
 * finding C-3. §221(b)(2)(B) genuinely is where the phase-out mechanism and
 * its base amounts live, and §221(f) is genuinely what indexes them; what
 * §221 does NOT contain is the TY2025 dollar figures themselves, which come
 * from the printed 2025 Student Loan Interest Deduction Worksheet (Schedule 1
 * line 21) in the Form 1040 instructions. Guessing a Rev. Proc. section
 * number this research never opened would be the sourcing error this module's
 * own header exists to prevent.
 * @type {{
 *   readonly maximumDeduction: AmountWithCitation,
 *   readonly phaseoutThreshold: {
 *     readonly single: AmountWithCitation,
 *     readonly marriedFilingJointly: AmountWithCitation,
 *     readonly headOfHousehold: AmountWithCitation,
 *     readonly qualifyingSurvivingSpouse: AmountWithCitation,
 *   },
 *   readonly phaseoutRange: {
 *     readonly single: AmountWithCitation,
 *     readonly marriedFilingJointly: AmountWithCitation,
 *     readonly headOfHousehold: AmountWithCitation,
 *     readonly qualifyingSurvivingSpouse: AmountWithCitation,
 *   },
 * }}
 */
export const studentLoanInterestDeduction = {
    // §221(b)(1) writes "$2,500" into the statute and §221(f) indexes only
    // subsection (b)(2)(B)'s threshold amounts, never this cap. It has been
    // $2,500 since 2001 and is the one figure in this group that is NOT
    // expected to move with the tax year.
    maximumDeduction: {
        amount: '2500.00',
        citation: { kind: 'code', section: '§221(b)(1)', effectiveDate: '2025-01-01' },
    },
    phaseoutThreshold: {
        single: {
            amount: '85000.00',
            citation: { kind: 'code', section: '§221(b)(2)(B)', effectiveDate: '2025-01-01' },
        },
        marriedFilingJointly: {
            amount: '170000.00',
            citation: { kind: 'code', section: '§221(b)(2)(B)', effectiveDate: '2025-01-01' },
        },
        // The printed worksheet's line 5 groups "Single, head of household,
        // or qualifying surviving spouse" on ONE row, so these two carry the
        // same figure as `single`. Hand-typed per status anyway, never spread
        // from `single`, for the reason `standardDeduction` states: a spread
        // makes two statuses impossible to observe drifting apart.
        headOfHousehold: {
            amount: '85000.00',
            citation: { kind: 'code', section: '§221(b)(2)(B)', effectiveDate: '2025-01-01' },
        },
        qualifyingSurvivingSpouse: {
            amount: '85000.00',
            citation: { kind: 'code', section: '§221(b)(2)(B)', effectiveDate: '2025-01-01' },
        },
    },
    // The printed worksheet's line 7 divisor. NOT a rate and NOT derivable
    // from the thresholds above — see this group's own docstring, "Two
    // figures, not three".
    phaseoutRange: {
        single: {
            amount: '15000.00',
            citation: { kind: 'code', section: '§221(b)(2)(B)', effectiveDate: '2025-01-01' },
        },
        marriedFilingJointly: {
            amount: '30000.00',
            citation: { kind: 'code', section: '§221(b)(2)(B)', effectiveDate: '2025-01-01' },
        },
        headOfHousehold: {
            amount: '15000.00',
            citation: { kind: 'code', section: '§221(b)(2)(B)', effectiveDate: '2025-01-01' },
        },
        qualifyingSurvivingSpouse: {
            amount: '15000.00',
            citation: { kind: 'code', section: '§221(b)(2)(B)', effectiveDate: '2025-01-01' },
        },
    },
}

/**
 * Schedule 1 line 11's educator expense deduction — IRC §62(a)(2)(D), TAX-24,
 * Phase 24.
 *
 * **ONE figure is stored, and the printed form's "$600" is deliberately NOT a
 * second one.** Schedule 1's own instruction reads *"If you and your spouse
 * are filing jointly and both of you were eligible educators, the maximum
 * deduction is $600. Neither spouse can deduct more than $300 of qualified
 * expenses."* The $600 is therefore two applications of the $300 cap, not an
 * independent parameter — storing it would create a figure that could
 * disagree with twice the one below, and `fjs/schedule/1` applies the cap
 * per eligible educator so the joint maximum falls out rather than being
 * asserted.
 *
 * **Indexed, like {@link studentLoanInterestDeduction} and unlike §3101(b)(2).**
 * §62(d)(3) inflation-adjusts the $250 base amount in $50 increments; the $50
 * step is coarse enough that the figure has sat at $300 since TY2022, which
 * is exactly the shape of parameter a reader is most likely to mistake for a
 * flat statutory constant. It is not one.
 *
 * **What this engine cannot check, and does not pretend to.** §62(d)(1)
 * defines an *eligible educator* as a kindergarten-through-grade-12 teacher,
 * instructor, counselor, principal or aide who worked **at least 900 hours**
 * during a school year in a school providing elementary or secondary
 * education. Neither the hours nor the role is reported by any information
 * return, and no document this engine models carries either. Eligibility is
 * therefore ASSERTED — by the taxpayer, through a `vnd.fjs.adjustments` entry
 * tagged for this line — and `fjs/document/adjustments`'s own docstring is
 * where that trust boundary is stated in full.
 * @type {{ readonly maximumPerEligibleEducator: AmountWithCitation }}
 */
export const educatorExpenses = {
    maximumPerEligibleEducator: {
        amount: '300.00',
        citation: { kind: 'code', section: '§62(a)(2)(D)', effectiveDate: '2025-01-01' },
    },
}

/**
 * Schedule 1 line 13's health savings account deduction (Form 8889 Part I) —
 * IRC §223, TAX-24, Phase 24.
 *
 * **This group holds BOTH kinds of figure at once, which is why it is worth
 * reading rather than skimming.** The two annual contribution limits are
 * inflation-indexed (§223(g)(1), adjusted every year and published in a
 * standalone Revenue Procedure each May, well before the annual §1(f) one);
 * the catch-up amount is NOT — §223(b)(3)(B) writes "$1,000" into the statute
 * and §223(g) indexes only subsection (b)(2), so the catch-up has been
 * $1,000 every year since 2009. A reader who assumes the group is uniformly
 * one or the other gets the wrong answer about half of it, which is the same
 * failure mode {@link childTaxCredit}'s own docstring names (Pitfall 5,
 * inverted).
 *
 * `selfOnly` versus `family` is Form 8889 line 1's own checkbox, and it is
 * the taxpayer's HDHP coverage type, not their filing status: a
 * married-filing-jointly couple with self-only coverage gets $4,300, and a
 * single filer with family coverage gets $8,550. Keying this by filing status
 * would be the most natural wrong thing to do with it, so it is keyed by
 * coverage type at the type level and there is no `IndividualFilingStatus`
 * anywhere in this group.
 *
 * `kind: 'code'` for all three, per the same "governing provision, not the
 * literal source" position {@link studentLoanInterestDeduction} records:
 * §223(b)(2)(A)/(B) is where the self-only/family limits live and §223(g) is
 * what indexes them, but the TY2025 dollar figures come from the printed 2025
 * Form 8889 and its instructions.
 * @type {{
 *   readonly annualLimit: {
 *     readonly selfOnly: AmountWithCitation,
 *     readonly family: AmountWithCitation,
 *   },
 *   readonly catchUpContribution: AmountWithCitation,
 * }}
 */
export const healthSavingsAccount = {
    annualLimit: {
        selfOnly: {
            amount: '4300.00',
            citation: { kind: 'code', section: '§223(b)(2)(A)', effectiveDate: '2025-01-01' },
        },
        family: {
            amount: '8550.00',
            citation: { kind: 'code', section: '§223(b)(2)(B)', effectiveDate: '2025-01-01' },
        },
    },
    // §223(b)(3)(B)'s flat statutory $1,000, for an account beneficiary who
    // has attained age 55 before the close of the taxable year. NOT indexed
    // — see this group's own docstring.
    catchUpContribution: {
        amount: '1000.00',
        citation: { kind: 'code', section: '§223(b)(3)(B)', effectiveDate: '2025-01-01' },
    },
}

/**
 * One row of Form 8880's own line 9 rate table: the credit rate that applies
 * when adjusted gross income does not exceed {@link ceiling}.
 *
 * `ceiling: undefined` on the LAST row, mirroring {@link Bracket}'s own
 * open-topped last entry — above the highest printed figure the rate is zero
 * and there is no further boundary. Sharing {@link Bracket}'s TYPE would have
 * been shorter and is deliberately not done: a bracket is a MARGINAL rate on
 * income, applied to the slice between two ceilings, and one of these is a
 * CLIFF rate applied to the whole contribution. Two quantities with the same
 * shape and opposite arithmetic are exactly the pair a shared name makes
 * indistinguishable.
 * @typedef {{ readonly ratePercent: number, readonly ceiling: string | undefined }} SaversCreditBand
 */

/**
 * Schedule 3 line 4's retirement savings contributions credit, the *Saver's
 * Credit* — IRC §25B, Form 8880, TAX-25, Phase 25.
 *
 * ## The rate schedule is a CLIFF, and that is the whole risk in this group
 *
 * Read {@link seniorDeduction}'s continuous 6% phase-out and
 * {@link studentLoanInterestDeduction}'s three-decimal ratio, then read this
 * one, because it is neither. Form 8880 line 9 is a LOOKUP: adjusted gross
 * income selects one of four rates — 50%, 20%, 10% or nothing — and the whole
 * of line 7 is multiplied by it. **One cent over a band boundary costs real
 * money.** A single filer with $2,000 of contributions and $23,750.00 of AGI
 * receives $1,000; at $23,750.01 the same taxpayer receives $400. There is no
 * taper between the two, and no arithmetic anywhere on the printed form
 * softens the step.
 *
 * This is the third distinct phase-out SHAPE this engine now models —
 * `fjs/schedule/1a`'s continuous curve, `fjs/form8812`'s $1,000-stepped 5%,
 * and this four-way cliff — and reading any of the three as another is this
 * phase's most likely silent-wrong-number failure.
 *
 * ## The bands are INDEXED, and the two figures a reader will look for are
 * not stored
 *
 * §25B(g) inflation-adjusts every dollar figure in §25B(b)'s table (rounded
 * to the next lowest multiple of $500), so all twelve figures below are
 * TY2025's and TY2025's alone. The movement is real: the top joint band was
 * $73,000 (2023), $76,500 (2024) and $79,000 (2025).
 *
 * The three statuses that share a column on the printed table —
 * `single`, `marriedFilingSeparately` and `qualifyingSurvivingSpouse` — each
 * carry their own hand-typed copy rather than being spread from one another,
 * for the reason {@link standardDeduction} states: a spread makes two
 * statuses impossible to observe drifting apart, and AGENTS.md records a
 * mutation in which married-filing-separately stayed green precisely because
 * it genuinely shared single's figure.
 *
 * ## What is NOT here, and why
 *
 * §25B(d)(2)'s TESTING PERIOD reduction (Form 8880 line 4) has no parameter,
 * because it is not a dollar figure — it is the sum of distributions received
 * across a four-year window (2023, 2024, 2025, and 2026 up to the return's
 * due date). `fjs/form8880` REFUSES rather than treating that line as zero;
 * see its own docstring.
 *
 * §25B(c)'s eligibility conditions (age 18 or over, not a full-time student,
 * not claimable as another taxpayer's dependent) are facts, not amounts, and
 * are likewise absent from this group.
 *
 * ## Citation kind
 *
 * `kind: 'code'`, per the same "governing provision, not the literal source"
 * position {@link studentLoanInterestDeduction} records: §25B(a) is where the
 * $2,000 contribution cap lives and §25B(b) is where the rate table lives,
 * but the TY2025 dollar figures themselves come from the printed 2025 Form
 * 8880's own line 9 table. Naming a Revenue Procedure section this work never
 * opened would be the sourcing error this module's header exists to prevent.
 * @type {{
 *   readonly contributionCap: AmountWithCitation,
 *   readonly rateBands: {
 *     readonly single: readonly SaversCreditBand[],
 *     readonly marriedFilingJointly: readonly SaversCreditBand[],
 *     readonly marriedFilingSeparately: readonly SaversCreditBand[],
 *     readonly headOfHousehold: readonly SaversCreditBand[],
 *     readonly qualifyingSurvivingSpouse: readonly SaversCreditBand[],
 *   },
 *   readonly rateBandCitation: Citation,
 * }}
 */
export const retirementSavingsContributionsCredit = {
    // §25B(a): the applicable percentage multiplies "so much of the qualified
    // retirement savings contributions ... as does not exceed $2,000". PER
    // PERSON — Form 8880's line 6 has a column for the taxpayer and one for
    // the spouse, and the cap is applied inside each column before line 7
    // adds them. NOT indexed: §25B(g) reaches subsection (b)'s table amounts
    // only, and this figure has been $2,000 since 2002.
    contributionCap: {
        amount: '2000.00',
        citation: { kind: 'code', section: '§25B(a)', effectiveDate: '2025-01-01' },
    },
    rateBands: {
        single: [
            { ratePercent: 50, ceiling: '23750.00' },
            { ratePercent: 20, ceiling: '25500.00' },
            { ratePercent: 10, ceiling: '39500.00' },
            { ratePercent: 0, ceiling: undefined },
        ],
        marriedFilingJointly: [
            { ratePercent: 50, ceiling: '47500.00' },
            { ratePercent: 20, ceiling: '51000.00' },
            { ratePercent: 10, ceiling: '79000.00' },
            { ratePercent: 0, ceiling: undefined },
        ],
        marriedFilingSeparately: [
            { ratePercent: 50, ceiling: '23750.00' },
            { ratePercent: 20, ceiling: '25500.00' },
            { ratePercent: 10, ceiling: '39500.00' },
            { ratePercent: 0, ceiling: undefined },
        ],
        headOfHousehold: [
            { ratePercent: 50, ceiling: '35625.00' },
            { ratePercent: 20, ceiling: '38250.00' },
            { ratePercent: 10, ceiling: '59250.00' },
            { ratePercent: 0, ceiling: undefined },
        ],
        qualifyingSurvivingSpouse: [
            { ratePercent: 50, ceiling: '23750.00' },
            { ratePercent: 20, ceiling: '25500.00' },
            { ratePercent: 10, ceiling: '39500.00' },
            { ratePercent: 0, ceiling: undefined },
        ],
    },
    // ONE citation for the whole table rather than one per band, mirroring
    // {@link ordinaryBrackets}' own per-schedule `citation`: the twenty rows
    // are one printed table with one governing provision, and twenty copies
    // of the same three fields would be noise a reader has to diff.
    rateBandCitation: { kind: 'code', section: '§25B(b)', effectiveDate: '2025-01-01' },
}

/**
 * Schedule 3 line 3 and 1040 line 29's education credits — IRC §25A, Form
 * 8863, TAX-26, Phase 25.
 *
 * ## TWO credits, one statute, and conflating them is the trap
 *
 * The American Opportunity Credit and the Lifetime Learning Credit share
 * §25A and share a phase-out range, and share almost nothing else:
 *
 * | | American Opportunity | Lifetime Learning |
 * |---|---|---|
 * | computed | per STUDENT | per RETURN |
 * | formula | 100% of the first $2,000 + 25% of the next $2,000 | 20% of up to $10,000 |
 * | maximum | $2,500 per student | $2,000 per return |
 * | refundable | 40% (→ 1040 line 29) | never |
 * | years | 4 taxable years per student | unlimited |
 * | enrolment | at least half-time, in a degree programme | any course |
 * | course materials | qualify wherever bought | only if paid to the institution |
 *
 * The last row is the one no 1098-T can settle and the reason
 * `vnd.fjs.credits` exists; `fjs/document/1098t`'s own header records it.
 *
 * ## The phase-out figures are STATUTORY and NOT indexed — the opposite of
 * {@link retirementSavingsContributionsCredit} directly above
 *
 * §25A(d) once indexed the Lifetime Learning Credit's own separate,
 * lower thresholds. The Taxpayer Certainty and Disaster Tax Relief Act of
 * 2020 repealed that indexing and aligned the Lifetime Learning Credit with
 * the American Opportunity Credit's fixed $80,000/$160,000 start, so BOTH
 * credits have used $80,000/$160,000 with a $10,000/$20,000 range every year
 * since 2021 and no Revenue Procedure moves them. A reader who inherits the
 * "these are indexed" reasoning from the group above gets this one wrong, in
 * the same way {@link healthSavingsAccount}'s own docstring warns about its
 * mixed group.
 *
 * ## The CEILING is stored, not the start — because the printed form reads
 * downwards
 *
 * Form 8863 lines 2 and 13 both read *"Enter: $180,000 if married filing
 * jointly; $90,000 if single, head of household, or qualifying surviving
 * spouse"*, line 3/14 subtract modified adjusted gross income FROM it, and
 * lines 5/16 divide by *"$20,000 if married filing jointly; $10,000
 * otherwise"*. Those two are exactly the figures stored below. The $80,000 /
 * $160,000 a reader of §25A(d)(2) expects is the DERIVED difference, and
 * `educationCreditPhaseoutStartsMatchTheStatutoryFigures` asserts it against
 * hand-typed statutory numbers rather than storing a third field that could
 * disagree with the two the computation reads — the identical decision
 * {@link studentLoanInterestDeduction} records under "Two figures, not
 * three", taken from the other end.
 *
 * ## `marriedFilingSeparately` has no entry, and that is a filing-status gate
 *
 * §25A(g)(6): no education credit at all is allowed to a married individual
 * filing a separate return, at ANY income. So there is no threshold for a
 * status whose amount never depends on one — the identical omission, for the
 * identical kind of reason, as {@link studentLoanInterestDeduction}'s under
 * §221(e)(2). `fjs/form8863` is where that short-circuit lives.
 *
 * **The omission and that short-circuit are ONE mechanism, and `tsc` is what
 * joins them** — a property found by mutating rather than by reading, and
 * recorded in full in `fjs/form8863`'s own docstring. Because these two
 * records have four keys rather than five, `fjs/form8863`'s early return for
 * a separate filer is the only thing that narrows `IndividualFilingStatus`
 * down to what they carry; weakening it stops the build at TS7053 rather than
 * producing a wrong number. **Adding a `marriedFilingSeparately` entry here
 * "for symmetry" would silently make that gate deletable.** Do not.
 *
 * ## Citation kind
 *
 * `kind: 'code'` throughout, at the subsection depth this work can actually
 * support. §25A(b)/(c) genuinely carry the two credits' own formulas, §25A(d)
 * the phase-out mechanism, §25A(g)(6) the separate-return denial and §25A(i)
 * the American Opportunity Credit's special rules including its refundable
 * portion — but the PARAGRAPH-level subdivision inside §25A(i) was not read
 * against the statute here, so no paragraph number is written that this work
 * did not verify. The literal source of every figure below is the printed
 * 2025 Form 8863 and its own line text.
 * @type {{
 *   readonly americanOpportunity: {
 *     readonly fullRateExpenseCap: AmountWithCitation,
 *     readonly totalExpenseCap: AmountWithCitation,
 *     readonly reducedRatePercent: number,
 *     readonly maximumCredit: AmountWithCitation,
 *     readonly refundablePercent: number,
 *   },
 *   readonly lifetimeLearning: {
 *     readonly expenseCap: AmountWithCitation,
 *     readonly ratePercent: number,
 *   },
 *   readonly phaseoutCeiling: {
 *     readonly single: AmountWithCitation,
 *     readonly marriedFilingJointly: AmountWithCitation,
 *     readonly headOfHousehold: AmountWithCitation,
 *     readonly qualifyingSurvivingSpouse: AmountWithCitation,
 *   },
 *   readonly phaseoutRange: {
 *     readonly single: AmountWithCitation,
 *     readonly marriedFilingJointly: AmountWithCitation,
 *     readonly headOfHousehold: AmountWithCitation,
 *     readonly qualifyingSurvivingSpouse: AmountWithCitation,
 *   },
 * }}
 */
export const educationCredits = {
    americanOpportunity: {
        // Form 8863 line 28, "Subtract $2,000 from line 27" — the slice
        // credited at 100%.
        fullRateExpenseCap: {
            amount: '2000.00',
            citation: { kind: 'code', section: '§25A(i)', effectiveDate: '2025-01-01' },
        },
        // Form 8863 line 27, "Don't enter more than $4,000" — the whole
        // expense figure the per-student computation may consider.
        totalExpenseCap: {
            amount: '4000.00',
            citation: { kind: 'code', section: '§25A(i)', effectiveDate: '2025-01-01' },
        },
        // Form 8863 line 29, "Multiply line 28 by 25% (0.25)".
        reducedRatePercent: 25,
        // $2,000 + 25% x $2,000. Stored anyway rather than derived, and
        // `theAmericanOpportunityMaximumIsTheTwoRatesApplied` asserts the
        // identity — because the maximum is what a taxpayer and an auditor
        // both recognize, and a derived-only figure could not be compared
        // against the printed instruction that states it.
        maximumCredit: {
            amount: '2500.00',
            citation: { kind: 'code', section: '§25A(i)', effectiveDate: '2025-01-01' },
        },
        // Form 8863 line 8, "Multiply line 7 by 40% (0.40)" -> 1040 line 29.
        refundablePercent: 40,
    },
    lifetimeLearning: {
        // Form 8863 line 11, "Enter the smaller of line 10 or $10,000".
        // PER RETURN, not per student — the single most-confused fact about
        // this credit.
        expenseCap: {
            amount: '10000.00',
            citation: { kind: 'code', section: '§25A(c)(1)', effectiveDate: '2025-01-01' },
        },
        // Form 8863 line 12, "Multiply line 11 by 20% (0.20)".
        ratePercent: 20,
    },
    phaseoutCeiling: {
        single: {
            amount: '90000.00',
            citation: { kind: 'code', section: '§25A(d)', effectiveDate: '2025-01-01' },
        },
        marriedFilingJointly: {
            amount: '180000.00',
            citation: { kind: 'code', section: '§25A(d)', effectiveDate: '2025-01-01' },
        },
        // The printed lines 2 and 13 group "single, head of household, or
        // qualifying surviving spouse" on one row, so these two carry the
        // same figure as `single` — hand-typed per status anyway, never
        // spread, for the reason {@link standardDeduction} states.
        headOfHousehold: {
            amount: '90000.00',
            citation: { kind: 'code', section: '§25A(d)', effectiveDate: '2025-01-01' },
        },
        qualifyingSurvivingSpouse: {
            amount: '90000.00',
            citation: { kind: 'code', section: '§25A(d)', effectiveDate: '2025-01-01' },
        },
    },
    phaseoutRange: {
        single: {
            amount: '10000.00',
            citation: { kind: 'code', section: '§25A(d)', effectiveDate: '2025-01-01' },
        },
        marriedFilingJointly: {
            amount: '20000.00',
            citation: { kind: 'code', section: '§25A(d)', effectiveDate: '2025-01-01' },
        },
        headOfHousehold: {
            amount: '10000.00',
            citation: { kind: 'code', section: '§25A(d)', effectiveDate: '2025-01-01' },
        },
        qualifyingSurvivingSpouse: {
            amount: '10000.00',
            citation: { kind: 'code', section: '§25A(d)', effectiveDate: '2025-01-01' },
        },
    },
}

/**
 * §408(d)(8)'s qualified charitable distribution limits — TAX-28, Phase 26.
 *
 * ## Both figures are INDEXED, and one of them is inside the other
 *
 * SECURE 2.0 §307 made both dollar figures inflation-adjusted, so neither is
 * a statutory constant and both are TY2025's alone. The annual limit was
 * $100,000 from 2006 through 2023, $105,000 for 2024 and $108,000 for 2025;
 * the one-time split-interest figure was $50,000 for 2023, $53,000 for 2024
 * and $54,000 for 2025. A reader who remembers "$100,000" — which is the
 * figure written in §408(d)(8)(A) itself and the figure every pre-2024 IRS
 * article states — is looking at a number that has moved twice since.
 *
 * **{@link splitInterestOneTimeLimit} is not an ADDITIONAL allowance.** The
 * printed instruction is explicit: *"Generally, your total QCDs for the year
 * can't be more than $108,000. **This includes** any amount (up to $54,000)
 * of a one-time QCD to a split-interest entity (SIE)."* So the smaller figure
 * is a sub-cap carved out of the larger one, never a second budget beside it,
 * and reading the pair as $162,000 is the most natural wrong thing to do with
 * them. `fjs/form8606` REFUSES a split-interest election outright rather than
 * computing it (see that module's own docstring for what an SIE election
 * would additionally require), and this figure is stored so that refusal can
 * NAME the limit the taxpayer is asking about rather than describe it
 * vaguely.
 *
 * ## Per INDIVIDUAL, which is not per RETURN
 *
 * *"If you file a joint return, the same rules apply to your spouse."* A
 * married couple with two IRAs and two donors has two separate $108,000
 * limits, and there is no combined figure anywhere on the printed page — so
 * nothing in this group is keyed by filing status, deliberately. The
 * per-person scoping is `fjs/form8606`'s, keyed on the recipient TIN the
 * documents themselves carry.
 *
 * ## Citation kind
 *
 * `kind: 'code'`, per the same "governing provision, not the literal source"
 * position {@link studentLoanInterestDeduction} records: §408(d)(8)(A) is
 * where the annual exclusion lives and §408(d)(8)(F) is where the one-time
 * split-interest election lives, but the TY2025 dollar figures themselves
 * come from the printed 2025 Form 1040 instructions' own Line 4a and 4b
 * "Exception 3" paragraph (`i1040gi.pdf`, fetched and read directly rather
 * than recalled).
 * @type {{
 *   readonly annualLimitPerIndividual: AmountWithCitation,
 *   readonly splitInterestOneTimeLimit: AmountWithCitation,
 * }}
 */
export const qualifiedCharitableDistribution = {
    annualLimitPerIndividual: {
        amount: '108000.00',
        citation: { kind: 'code', section: '§408(d)(8)(A)', effectiveDate: '2025-01-01' },
    },
    // The sub-cap, NOT a second budget — see this group's own docstring.
    splitInterestOneTimeLimit: {
        amount: '54000.00',
        citation: { kind: 'code', section: '§408(d)(8)(F)', effectiveDate: '2025-01-01' },
    },
}

/**
 * **§1402(b)(2)'s $400 self-employment floor** — the ONE self-employment
 * figure Phase 27 stores, and the one it needs in order to REFUSE honestly
 * rather than to compute.
 *
 * *"…the term 'net earnings from self-employment' [shall not include] …if such
 * net earnings for the taxable year are less than $400."* Below it, no
 * self-employment tax is due at all; at or above it, Schedule SE is required.
 *
 * **Nothing here stores the 92.35% factor or the 12.4%/2.9% rates**, and that
 * omission is the point: this phase does NOT compute self-employment tax
 * (TAX-31 is Phase 28). A rate would be a parameter with no reader, which is
 * exactly the YAGNI note {@link additionalMedicareTaxThreshold} carries about
 * its own 0.9% before Phase 23 added the form that reads it.
 *
 * The single reader is `fjs/schedule/c`, which compares this figure against
 * Schedule C line 31's NET PROFIT rather than against net earnings from
 * self-employment — a conservative over-approximation, since net earnings are
 * 92.35% of net profit and therefore always smaller. That module's own
 * docstring records why the approximation goes in the refusing direction on
 * purpose, and why importing the 92.35% factor to tighten it would be
 * starting Schedule SE.
 *
 * **Not inflation-indexed.** §1402(b)(2) has read $400 since 1990 and there is
 * no annual revenue procedure to cite, so this is a `kind: 'code'` citation
 * for the same reason {@link additionalMedicareTaxThreshold}'s is.
 * `effectiveDate` still reads `'2025-01-01'`: every citation here states the
 * year the figure is being APPLIED for.
 * @type {{ readonly minimumNetEarnings: AmountWithCitation }}
 */
export const selfEmploymentTax = {
    minimumNetEarnings: {
        amount: '400.00',
        citation: { kind: 'code', section: '§1402(b)(2)', effectiveDate: '2025-01-01' },
    },
}

/**
 * A full tax-year parameter set: every TY2025 parameter this phase
 * requires, together.
 *
 * **`taxYear` is a member, and it is FIRST.** Added in Phase 21 (EXEC-14),
 * when a parameter set first began travelling on its own: `taxGuestCtx`
 * hands one to a stored guest program, which has no `taxParamsByYear` to
 * look anything up in and no way to learn which year it is computing unless
 * the set says so. A parameter set that cannot name its own year is a
 * value that loses meaning the moment it leaves the map it was keyed by.
 *
 * It also closes a latent provenance defect. `paramSetHash` fingerprints
 * this object's serialization, so two different years whose figures
 * happened to coincide would have hashed IDENTICALLY, and two runs against
 * genuinely different years would have looked like the same parameters.
 * The year is part of the identity of a parameter set, so it is part of the
 * hash. (This does change every `paramSetHash` value relative to before
 * Phase 21 — deliberately, and in the same commit as the reason.)
 *
 * FIRST rather than appended, mirroring `fjs/document/base`'s `dialect`:
 * the discriminant reads first in the serialization a human inspects, and
 * `paramSetHash` is source-order sensitive (see `fjs/report/provenance`), so
 * the position is a decision rather than an accident.
 * @typedef {{
 *   readonly taxYear: number,
 *   readonly standardDeduction: typeof standardDeduction,
 *   readonly agedOrBlindAdditional: typeof agedOrBlindAdditional,
 *   readonly dependentStandardDeductionCap: typeof dependentStandardDeductionCap,
 *   readonly ordinaryBrackets: typeof ordinaryBrackets,
 *   readonly capitalGainsBreakpoints: typeof capitalGainsBreakpoints,
 *   readonly socialSecurityBenefitsWorksheetBaseAmounts: typeof socialSecurityBenefitsWorksheetBaseAmounts,
 *   readonly seniorDeduction: typeof seniorDeduction,
 *   readonly saltCap: typeof saltCap,
 *   readonly medicalExpenseFloor: typeof medicalExpenseFloor,
 *   readonly childTaxCredit: typeof childTaxCredit,
 *   readonly additionalMedicareTaxThreshold: typeof additionalMedicareTaxThreshold,
 *   readonly additionalMedicareTaxRates: typeof additionalMedicareTaxRates,
 *   readonly netInvestmentIncomeTaxThreshold: typeof netInvestmentIncomeTaxThreshold,
 *   readonly netInvestmentIncomeTaxRateBasisPoints: typeof netInvestmentIncomeTaxRateBasisPoints,
 *   readonly studentLoanInterestDeduction: typeof studentLoanInterestDeduction,
 *   readonly educatorExpenses: typeof educatorExpenses,
 *   readonly healthSavingsAccount: typeof healthSavingsAccount,
 *   readonly retirementSavingsContributionsCredit: typeof retirementSavingsContributionsCredit,
 *   readonly educationCredits: typeof educationCredits,
 *   readonly qualifiedCharitableDistribution: typeof qualifiedCharitableDistribution,
 *   readonly selfEmploymentTax: typeof selfEmploymentTax,
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
        taxYear: 2025,
        standardDeduction,
        agedOrBlindAdditional,
        dependentStandardDeductionCap,
        ordinaryBrackets,
        capitalGainsBreakpoints,
        socialSecurityBenefitsWorksheetBaseAmounts,
        seniorDeduction,
        saltCap,
        medicalExpenseFloor,
        childTaxCredit,
        additionalMedicareTaxThreshold,
        additionalMedicareTaxRates,
        netInvestmentIncomeTaxThreshold,
        netInvestmentIncomeTaxRateBasisPoints,
        studentLoanInterestDeduction,
        educatorExpenses,
        healthSavingsAccount,
        retirementSavingsContributionsCredit,
        educationCredits,
        qualifiedCharitableDistribution,
        selfEmploymentTax,
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
 * Narrows a `Citation` to its `'revProc'` arm, throwing (never casting) if
 * it is not. Every citation this module stored BEFORE Phase 13 is
 * `'revProc'`-sourced (Rev. Proc. 2024-40/2025-32); the widened `Citation`
 * union (13-CONTEXT.md Decision 5.2) means `tsc` can no longer see `.revProc`
 * on a bare `Citation` without this narrow, so the below proof leaves —
 * which read `.revProc` on exactly the entries that predate the widening —
 * route through here rather than through a cast (AGENTS.md's "no cast over
 * an indexed access" rule, applied to a discriminated union instead).
 * @type {(citation: Citation) => Extract<Citation, { readonly kind: 'revProc' }>}
 */
const assertRevProcCitation = citation => {
    assert(citation.kind === 'revProc', ['expected a revProc-kind citation', citation])
    return citation
}

/**
 * Narrows a `Citation` to its `'publicLaw'` arm, throwing (never casting)
 * if it is not — the same narrowing idiom as {@link assertRevProcCitation},
 * for `seniorDeduction`'s OBBBA-statute citations (13-CONTEXT.md Decision
 * 5.2/13-RESEARCH.md Pitfall 5).
 * @type {(citation: Citation) => Extract<Citation, { readonly kind: 'publicLaw' }>}
 */
const assertPublicLawCitation = citation => {
    assert(citation.kind === 'publicLaw', ['expected a publicLaw-kind citation', citation])
    return citation
}

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
    socialSecurityBenefitsWorksheetBaseAmounts.firstThreshold.marriedFilingJointly.amount,
    socialSecurityBenefitsWorksheetBaseAmounts.firstThreshold.other.amount,
    socialSecurityBenefitsWorksheetBaseAmounts.secondThreshold.marriedFilingJointly.amount,
    socialSecurityBenefitsWorksheetBaseAmounts.secondThreshold.other.amount,
    seniorDeduction.amount.amount,
    seniorDeduction.phaseoutThreshold.single.amount,
    seniorDeduction.phaseoutThreshold.marriedFilingJointly.amount,
    seniorDeduction.phaseoutThreshold.headOfHousehold.amount,
    seniorDeduction.phaseoutThreshold.qualifyingSurvivingSpouse.amount,
    saltCap.flatCap.amount,
    saltCap.floor.amount,
    saltCap.threshold.single.amount,
    saltCap.threshold.marriedFilingJointly.amount,
    saltCap.threshold.marriedFilingSeparately.amount,
    saltCap.threshold.headOfHousehold.amount,
    saltCap.threshold.qualifyingSurvivingSpouse.amount,
    childTaxCredit.ctcAmount.amount,
    childTaxCredit.odcAmount.amount,
    childTaxCredit.actcCap.amount,
    childTaxCredit.phaseoutThreshold.marriedFilingJointly.amount,
    childTaxCredit.phaseoutThreshold.other.amount,
    childTaxCredit.actcEarnedIncomeThreshold.amount,
    ...individualFilingStatuses.map(status => additionalMedicareTaxThreshold[status].amount),
    ...individualFilingStatuses.map(status => netInvestmentIncomeTaxThreshold[status].amount),
    studentLoanInterestDeduction.maximumDeduction.amount,
    studentLoanInterestDeduction.phaseoutThreshold.single.amount,
    studentLoanInterestDeduction.phaseoutThreshold.marriedFilingJointly.amount,
    studentLoanInterestDeduction.phaseoutThreshold.headOfHousehold.amount,
    studentLoanInterestDeduction.phaseoutThreshold.qualifyingSurvivingSpouse.amount,
    studentLoanInterestDeduction.phaseoutRange.single.amount,
    studentLoanInterestDeduction.phaseoutRange.marriedFilingJointly.amount,
    studentLoanInterestDeduction.phaseoutRange.headOfHousehold.amount,
    studentLoanInterestDeduction.phaseoutRange.qualifyingSurvivingSpouse.amount,
    educatorExpenses.maximumPerEligibleEducator.amount,
    healthSavingsAccount.annualLimit.selfOnly.amount,
    healthSavingsAccount.annualLimit.family.amount,
    healthSavingsAccount.catchUpContribution.amount,
    retirementSavingsContributionsCredit.contributionCap.amount,
    ...individualFilingStatuses.flatMap(status =>
        retirementSavingsContributionsCredit.rateBands[status]
            .map(band => band.ceiling)
            .filter(isDefinedString),
    ),
    educationCredits.americanOpportunity.fullRateExpenseCap.amount,
    educationCredits.americanOpportunity.totalExpenseCap.amount,
    educationCredits.americanOpportunity.maximumCredit.amount,
    educationCredits.lifetimeLearning.expenseCap.amount,
    educationCredits.phaseoutCeiling.single.amount,
    educationCredits.phaseoutCeiling.marriedFilingJointly.amount,
    educationCredits.phaseoutCeiling.headOfHousehold.amount,
    educationCredits.phaseoutCeiling.qualifyingSurvivingSpouse.amount,
    educationCredits.phaseoutRange.single.amount,
    educationCredits.phaseoutRange.marriedFilingJointly.amount,
    educationCredits.phaseoutRange.headOfHousehold.amount,
    educationCredits.phaseoutRange.qualifyingSurvivingSpouse.amount,
    qualifiedCharitableDistribution.annualLimitPerIndividual.amount,
    qualifiedCharitableDistribution.splitInterestOneTimeLimit.amount,
    selfEmploymentTax.minimumNetEarnings.amount,
]

export const proof = {
    // Phase 21 (EXEC-14): every parameter set agrees with the KEY it is
    // stored under. A set travelling on its own — which is what
    // `taxGuestCtx` now does with it — is only trustworthy if its own
    // `taxYear` is the year the caller asked for, and this is the one place
    // that correspondence can be checked.
    //
    // The hand-typed count is not decoration: `Object.keys(taxParamsByYear)`
    // is the iteration set AND the thing under test, so the loop alone could
    // never notice a year disappearing (AGENTS.md's fourth shipped defect).
    // One year today; adding a second is meant to fail this line and be
    // updated deliberately.
    everyParameterSetKnowsTheYearItIsKeyedBy: () => {
        assertEq(Object.keys(taxParamsByYear).length, 1)
        for (const key of Object.keys(taxParamsByYear)) {
            const set = taxParamsByYear[Number(key)]
            assertEq(assertNotNullish(set, ['expected a parameter set at', key]).taxYear, Number(key))
        }
        // Read once more by the literal key a caller would actually use, so
        // this leaf also fails if 2025 stops being present at all rather
        // than merely disagreeing with itself.
        assertEq(assertNotNullish(taxParamsByYear[2025], 'expected TY2025').taxYear, 2025)
    },
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
            assertEq(assertRevProcCitation(entry.citation).revProc, '2025-32')
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
        assertEq(assertRevProcCitation(agedOrBlindAdditional.married.citation).revProc, '2024-40')
        assertEq(agedOrBlindAdditional.married.citation.section, '§2.15(3)')
        assertEq(agedOrBlindAdditional.married.citation.effectiveDate, '2025-01-01')
        assertEq(assertRevProcCitation(agedOrBlindAdditional.unmarried.citation).revProc, '2024-40')
        assertEq(agedOrBlindAdditional.unmarried.citation.section, '§2.15(3)')
        assertEq(agedOrBlindAdditional.unmarried.citation.effectiveDate, '2025-01-01')
        assertEq(assertRevProcCitation(dependentStandardDeductionCap.minimum.citation).revProc, '2024-40')
        assertEq(dependentStandardDeductionCap.minimum.citation.section, '§2.15(2)')
        assertEq(dependentStandardDeductionCap.minimum.citation.effectiveDate, '2025-01-01')
        assertEq(assertRevProcCitation(dependentStandardDeductionCap.earnedIncomeAddOn.citation).revProc, '2024-40')
        assertEq(dependentStandardDeductionCap.earnedIncomeAddOn.citation.section, '§2.15(2)')
        assertEq(dependentStandardDeductionCap.earnedIncomeAddOn.citation.effectiveDate, '2025-01-01')
        for (const status of allFilingStatuses) {
            assertEq(assertRevProcCitation(ordinaryBrackets[status].citation).revProc, '2024-40')
            assertEq(ordinaryBrackets[status].citation.section, '§2.01')
            assertEq(ordinaryBrackets[status].citation.effectiveDate, '2025-01-01')
            assertEq(assertRevProcCitation(capitalGainsBreakpoints[status].citation).revProc, '2024-40')
            assertEq(capitalGainsBreakpoints[status].citation.section, '§2.03')
            assertEq(capitalGainsBreakpoints[status].citation.effectiveDate, '2025-01-01')
        }
    },
    // TAX-19: Form 8959's thresholds, hand-typed here from IRC §3101(b)(2)'s
    // own three dollar figures and Form 8959's printed threshold table --
    // never read back from the stored object, so a wrong stored figure cannot
    // pass by comparing against itself.
    //
    // The QSS row is the reason this leaf asserts every status separately
    // rather than looping with one shared expectation: a QSS return is not a
    // JOINT return, so §3101(b)(2)(A)'s $250,000 does not reach it and it
    // falls to (C)'s $200,000 -- the OPPOSITE of what every other per-status
    // parameter in this module does with QSS. The subsection letter is
    // asserted alongside the amount so the two cannot drift: a $250,000 QSS
    // amount would have to arrive with an (A) citation to pass, and it would
    // still fail on the amount.
    additionalMedicareTaxThresholdsAreTheUnindexedStatutoryFigures: () => {
        /** @type {Record<IndividualFilingStatus, readonly [string, string]>} */
        const expected = {
            single: ['200000.00', '§3101(b)(2)(C)'],
            marriedFilingJointly: ['250000.00', '§3101(b)(2)(A)'],
            marriedFilingSeparately: ['125000.00', '§3101(b)(2)(B)'],
            headOfHousehold: ['200000.00', '§3101(b)(2)(C)'],
            qualifyingSurvivingSpouse: ['200000.00', '§3101(b)(2)(C)'],
        }
        for (const status of individualFilingStatuses) {
            const entry = additionalMedicareTaxThreshold[status]
            const [amount, section] = expected[status]
            assertEq(entry.amount, amount, ['wrong Additional Medicare Tax threshold', status, entry.amount])
            // Not a Rev. Proc. figure and not a Public Law one: the statute
            // itself carries the dollar amounts, and nothing indexes them.
            assertEq(entry.citation.kind, 'code', ['expected a bare-IRC citation', status, entry.citation])
            assertEq(entry.citation.section, section, ['wrong governing subsection', status, entry.citation])
            assertEq(entry.citation.effectiveDate, '2025-01-01')
        }
        // The trap, stated as its own assertion rather than left implicit in
        // the table above: QSS does NOT share the married-filing-jointly
        // figure here, unlike `standardDeduction` and every other per-status
        // parameter in this module.
        assert(
            additionalMedicareTaxThreshold.qualifyingSurvivingSpouse.amount
                !== additionalMedicareTaxThreshold.marriedFilingJointly.amount,
            [
                'a qualifying surviving spouse is not filing a JOINT return, so §3101(b)(2)(A) does not reach it',
                additionalMedicareTaxThreshold.qualifyingSurvivingSpouse.amount,
            ],
        )
    },
    // TAX-21: Form 8960's thresholds, hand-typed from IRC §1411(b)'s own
    // three dollar figures and Form 8960's printed threshold table -- never
    // read back from the stored object, and never derived from
    // `additionalMedicareTaxThreshold`, whose three shared figures are a
    // coincidence of two statutes rather than one rule.
    //
    // Asserted per status, with the subsection letter beside the amount, for
    // the same reason the §3101 leaf above is: a QSS amount that drifted onto
    // the wrong figure would have to arrive with the wrong subsection too,
    // and it would still fail on the amount.
    netInvestmentIncomeTaxThresholdsAreTheUnindexedStatutoryFigures: () => {
        /** @type {Record<IndividualFilingStatus, readonly [string, string]>} */
        const expected = {
            single: ['200000.00', '§1411(b)(3)'],
            marriedFilingJointly: ['250000.00', '§1411(b)(1)'],
            marriedFilingSeparately: ['125000.00', '§1411(b)(2)'],
            headOfHousehold: ['200000.00', '§1411(b)(3)'],
            // §1411(b)(1)'s "or a surviving spouse (as defined in section
            // 2(a))" -- the JOINT figure, unlike §3101(b)(2).
            qualifyingSurvivingSpouse: ['250000.00', '§1411(b)(1)'],
        }
        for (const status of individualFilingStatuses) {
            const entry = netInvestmentIncomeTaxThreshold[status]
            const [amount, section] = expected[status]
            assertEq(entry.amount, amount, ['wrong net investment income tax threshold', status, entry.amount])
            assertEq(entry.citation.kind, 'code', ['expected a bare-IRC citation', status, entry.citation])
            assertEq(entry.citation.section, section, ['wrong governing subsection', status, entry.citation])
            assertEq(entry.citation.effectiveDate, '2025-01-01')
        }
    },
    // THE TRAP, stated as a leaf of its own rather than left implicit in the
    // two tables above: the two statutes AGREE on four filing statuses and
    // DISAGREE on the fifth, and the disagreement runs in a specific
    // direction. §1411(b)(1) names "a surviving spouse (as defined in section
    // 2(a))" beside the joint return; §3101(b)(2)(A) names only the joint
    // return, so QSS falls to its (C) "any other case". Copying either
    // statute's answer onto the other is a silent $50,000 error, and this
    // leaf is what refuses to let the two parameters be unified by anyone who
    // notices four of the five rows match.
    //
    // The four agreeing rows are asserted too, deliberately: a leaf that only
    // asserted the disagreement would still pass if someone changed BOTH
    // parameters in the same direction, and the agreement is what makes the
    // one disagreement meaningful rather than noise.
    theTwoStatutesAgreeOnFourStatusesAndDisagreeOnlyOnASurvivingSpouse: () => {
        /** The four statuses the two statutes agree on — hand-typed, never
         * derived by filtering `individualFilingStatuses` against the data,
         * so a fifth status quietly joining the agreement is visible.
         * @type {readonly IndividualFilingStatus[]} */
        const agreeingStatuses = ['single', 'marriedFilingJointly', 'marriedFilingSeparately', 'headOfHousehold']
        for (const status of agreeingStatuses) {
            const medicare = additionalMedicareTaxThreshold[status]
            const netInvestment = netInvestmentIncomeTaxThreshold[status]
            assertEq(
                medicare.amount,
                netInvestment.amount,
                ['§3101(b)(2) and §1411(b) state the same figure for this status', status],
            )
            // …and they are still two separate statutes saying it, which is
            // what makes the fifth row possible at all.
            assert(
                medicare.citation.section !== netInvestment.citation.section,
                ['the same figure must still cite two different statutes', status, medicare.citation.section],
            )
        }
        assertEq(
            netInvestmentIncomeTaxThreshold.qualifyingSurvivingSpouse.amount,
            netInvestmentIncomeTaxThreshold.marriedFilingJointly.amount,
            '§1411(b)(1) puts a surviving spouse ON the joint figure',
        )
        assert(
            additionalMedicareTaxThreshold.qualifyingSurvivingSpouse.amount
                !== netInvestmentIncomeTaxThreshold.qualifyingSurvivingSpouse.amount,
            [
                'the two statutes must NOT agree for a qualifying surviving spouse: §1411(b)(1) says $250,000 '
                + 'and §3101(b)(2)(C) says $200,000',
                additionalMedicareTaxThreshold.qualifyingSurvivingSpouse.amount,
                netInvestmentIncomeTaxThreshold.qualifyingSurvivingSpouse.amount,
            ],
        )
    },
    // The three rates, hand-typed as basis points from the two statutes'
    // own words: §3101(b)(1) "1.45 percent", §3101(b)(2) "0.9 percent",
    // §1411(a)(1) "3.8 percent".
    //
    // The second half of this leaf is the REASON the unit is basis points
    // rather than percent, asserted rather than left to the docstring: not
    // one of the three is a whole number of percent, so a `ratePercent:
    // number` field would have had to carry `0.9`, `1.45` or `3.8` — each an
    // inexact IEEE 754 double — into a module whose entire discipline is
    // exactness. If a future rate IS a whole percent, this half stays green
    // for it and the assertion below names which one broke the pattern.
    theStatutoryRatesAreStoredExactlyAsBasisPoints: () => {
        assertEq(additionalMedicareTaxRates.additionalRateBasisPoints, 90, '0.9% — IRC §3101(b)(2)')
        assertEq(additionalMedicareTaxRates.regularMedicareRateBasisPoints, 145, '1.45% — IRC §3101(b)(1)')
        assertEq(netInvestmentIncomeTaxRateBasisPoints, 380, '3.8% — IRC §1411(a)(1)')
        assertEq(additionalMedicareTaxRates.citation.kind, 'code')
        assertEq(additionalMedicareTaxRates.citation.section, '§3101(b)')
        assertEq(additionalMedicareTaxRates.citation.effectiveDate, '2025-01-01')
        for (const basisPoints of [
            additionalMedicareTaxRates.additionalRateBasisPoints,
            additionalMedicareTaxRates.regularMedicareRateBasisPoints,
            netInvestmentIncomeTaxRateBasisPoints,
        ]) {
            assert(
                basisPoints % 100 !== 0,
                [
                    'this rate IS a whole number of percent, so the basis-point unit is no longer what makes it '
                    + 'exact — revisit whether it belongs beside `ratePercent` instead',
                    basisPoints,
                ],
            )
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
    // TAX-10/13-CONTEXT.md Decision 5.2: the SSB worksheet's four base
    // amounts cite IRC §86(c) directly — `kind: 'code'`, never
    // `kind: 'revProc'` — because no annual Rev. Proc. sets them (unchanged
    // since 1993). Asserted field by field (`kind`, `section`,
    // `effectiveDate`, `amount`), independently of
    // `unmodifiedParametersCite2024_40Only` above, so this proof's own name
    // stays literally true: nothing here shares that leaf's Rev.-Proc.-only
    // claim.
    socialSecurityBaseAmountsCiteIrc86cOnly: () => {
        /** @type {(label: string) => (entry: AmountWithCitation) => (expectedAmount: string) => void} */
        const checkOne = label => entry => expectedAmount => {
            assertEq(entry.amount, expectedAmount, ['SSB base amount mismatch', label])
            assertEq(entry.citation.kind, 'code', ['expected the code citation kind', label])
            assertEq(entry.citation.section, '§86(c)', ['expected IRC §86(c)', label])
            assertEq(entry.citation.effectiveDate, '2025-01-01', ['expected the TY2025 effective date', label])
        }
        checkOne('firstThreshold.marriedFilingJointly')(socialSecurityBenefitsWorksheetBaseAmounts.firstThreshold.marriedFilingJointly)('32000.00')
        checkOne('firstThreshold.other')(socialSecurityBenefitsWorksheetBaseAmounts.firstThreshold.other)('25000.00')
        checkOne('secondThreshold.marriedFilingJointly')(socialSecurityBenefitsWorksheetBaseAmounts.secondThreshold.marriedFilingJointly)('12000.00')
        checkOne('secondThreshold.other')(socialSecurityBenefitsWorksheetBaseAmounts.secondThreshold.other)('9000.00')
    },
    // TAX-09/13-RESEARCH.md Pitfall 5: every `seniorDeduction` dollar
    // figure cites OBBBA Public Law 119-21 §70103 directly — NEVER
    // `kind: 'revProc'` and never Rev. Proc. 2025-32 (which does not
    // contain this figure at all). Asserted per field
    // (`kind`/`publicLaw`/`section`/`effectiveDate`), on every one of the
    // five stored amounts, never via one deep-equality assertion against a
    // second copy of the object.
    seniorDeductionCitesPublicLaw11921Section70103: () => {
        const entries = [
            seniorDeduction.amount,
            seniorDeduction.phaseoutThreshold.single,
            seniorDeduction.phaseoutThreshold.marriedFilingJointly,
            seniorDeduction.phaseoutThreshold.headOfHousehold,
            seniorDeduction.phaseoutThreshold.qualifyingSurvivingSpouse,
        ]
        for (const entry of entries) {
            const citation = assertPublicLawCitation(entry.citation)
            assertEq(citation.publicLaw, '119-21', ['expected OBBBA Public Law 119-21', entry])
            assertEq(citation.section, '§70103', ['expected OBBBA §70103', entry])
            assertEq(citation.effectiveDate, '2025-01-01', ['expected the TY2025 effective date', entry])
        }
        assertEq(seniorDeduction.amount.amount, '6000.00')
        assertEq(seniorDeduction.phaseoutRatePercent, 6)
        assertEq(seniorDeduction.phaseoutThreshold.single.amount, '75000.00')
        assertEq(seniorDeduction.phaseoutThreshold.marriedFilingJointly.amount, '150000.00')
        assertEq(seniorDeduction.phaseoutThreshold.headOfHousehold.amount, '75000.00')
        assertEq(seniorDeduction.phaseoutThreshold.qualifyingSurvivingSpouse.amount, '75000.00')
    },
    // TAX-13/13-RESEARCH.md Pitfall 5: every `saltCap` dollar figure cites
    // OBBBA Public Law 119-21 §70120 directly — NEVER `kind: 'revProc'`,
    // and never Rev. Proc. 2025-32 (which does not contain this figure at
    // all, the exact trap Pitfall 5 names). Asserted per field
    // (`kind`/`publicLaw`/`section`/`effectiveDate`), on every one of the
    // seven stored amounts, never via one deep-equality assertion against
    // a second copy of the object.
    saltCapCitesPublicLaw11921Section70120: () => {
        const entries = [
            saltCap.flatCap,
            saltCap.floor,
            saltCap.threshold.single,
            saltCap.threshold.marriedFilingJointly,
            saltCap.threshold.marriedFilingSeparately,
            saltCap.threshold.headOfHousehold,
            saltCap.threshold.qualifyingSurvivingSpouse,
        ]
        for (const entry of entries) {
            const citation = assertPublicLawCitation(entry.citation)
            assertEq(citation.publicLaw, '119-21', ['expected OBBBA Public Law 119-21', entry])
            assertEq(citation.section, '§70120', ['expected OBBBA §70120', entry])
            assertEq(citation.effectiveDate, '2025-01-01', ['expected the TY2025 effective date', entry])
        }
        assertEq(saltCap.flatCap.amount, '40000.00')
        assertEq(saltCap.floor.amount, '10000.00')
        assertEq(saltCap.phasedownRatePercent, 30)
        assertEq(saltCap.threshold.single.amount, '500000.00')
        assertEq(saltCap.threshold.marriedFilingJointly.amount, '500000.00')
        assertEq(saltCap.threshold.marriedFilingSeparately.amount, '250000.00')
        assertEq(saltCap.threshold.headOfHousehold.amount, '500000.00')
        assertEq(saltCap.threshold.qualifyingSurvivingSpouse.amount, '500000.00')
    },
    // TAX-13/13-RESEARCH.md §3 "Medical floor: 7.5%, confirmed unchanged":
    // the medical-expense floor cites IRC §213(a) directly — `kind:
    // 'code'`, long-standing and unmodified by OBBBA, never a Rev. Proc.
    // and never a Public Law.
    medicalExpenseFloorCitesIrc213aOnly: () => {
        assertEq(medicalExpenseFloor.ratePercent, 7.5)
        assertEq(medicalExpenseFloor.citation.kind, 'code')
        assertEq(medicalExpenseFloor.citation.section, '§213(a)')
        assertEq(medicalExpenseFloor.citation.effectiveDate, '2025-01-01')
    },
    // TAX-12/13-RESEARCH.md Pitfall 5: the CTC amount ($2,200) is the ONLY
    // figure in `childTaxCredit` — and the only new figure in this entire
    // phase — Rev. Proc. 2025-32 actually backs.
    childTaxCreditCtcAmountCitesRevProc202532Section203: () => {
        const citation = assertRevProcCitation(childTaxCredit.ctcAmount.citation)
        assertEq(citation.revProc, '2025-32')
        assertEq(citation.section, '§2.03')
        assertEq(citation.effectiveDate, '2025-01-01')
        assertEq(childTaxCredit.ctcAmount.amount, '2200.00')
    },
    // The exact trap Pitfall 5 names, inverted: ODC/ACTC-cap/phase-out must
    // NOT inherit the CTC's Rev. Proc. citation. Asserted per field
    // (`kind`/`section`/`effectiveDate`) on every one of the four remaining
    // stored amounts.
    childTaxCreditOdcActcCapAndPhaseoutCiteIrc24hOnly: () => {
        const entries = [
            childTaxCredit.odcAmount,
            childTaxCredit.actcCap,
            childTaxCredit.phaseoutThreshold.marriedFilingJointly,
            childTaxCredit.phaseoutThreshold.other,
        ]
        for (const entry of entries) {
            assertEq(entry.citation.kind, 'code', ['expected the code citation kind, NOT revProc', entry])
            assertEq(entry.citation.section, '§24(h)', ['expected IRC §24(h)', entry])
            assertEq(entry.citation.effectiveDate, '2025-01-01', ['expected the TY2025 effective date', entry])
        }
        assertEq(childTaxCredit.odcAmount.amount, '500.00')
        assertEq(childTaxCredit.actcCap.amount, '1700.00')
        assertEq(childTaxCredit.phaseoutThreshold.marriedFilingJointly.amount, '400000.00')
        assertEq(childTaxCredit.phaseoutThreshold.other.amount, '200000.00')
        assertEq(childTaxCredit.phaseoutRatePercent, 5)
    },
    // WR-01 (13-REVIEW.md): the ACTC earned-income floor ($2,500) and rate
    // (15%) — Schedule 8812 Part II-A lines 19/20 — cite IRC §24(d) directly,
    // the SAME "governing provision, not literal source" pattern as
    // `odcAmount`/`actcCap`/`phaseoutThreshold` above (Carried finding C-3),
    // never a guessed Rev. Proc. number.
    childTaxCreditActcEarnedIncomeFloorAndRateCiteIrc24dOnly: () => {
        assertEq(childTaxCredit.actcEarnedIncomeThreshold.citation.kind, 'code')
        assertEq(childTaxCredit.actcEarnedIncomeThreshold.citation.section, '§24(d)')
        assertEq(childTaxCredit.actcEarnedIncomeThreshold.citation.effectiveDate, '2025-01-01')
        assertEq(childTaxCredit.actcEarnedIncomeThreshold.amount, '2500.00')
        assertEq(childTaxCredit.actcEarnedIncomeRatePercent, 15)
    },
    // The specific claim the acceptance criteria names: the CTC citation and
    // ONLY the CTC citation among this group is `kind: 'revProc'` — asserted
    // by counting, not by re-reading the two leaves above, so a future
    // addition to this group that quietly defaults to `'revProc'` fails
    // here even if it is never individually asserted against.
    onlyCtcAmountIsRevProcSourcedAmongChildTaxCreditFigures: () => {
        const allChildTaxCreditAmounts = [
            childTaxCredit.ctcAmount,
            childTaxCredit.odcAmount,
            childTaxCredit.actcCap,
            childTaxCredit.phaseoutThreshold.marriedFilingJointly,
            childTaxCredit.phaseoutThreshold.other,
            childTaxCredit.actcEarnedIncomeThreshold,
        ]
        const revProcSourced = allChildTaxCreditAmounts.filter(entry => entry.citation.kind === 'revProc')
        assertEq(revProcSourced.length, 1, ['expected exactly one revProc-sourced figure', revProcSourced])
        assertEq(revProcSourced[0], childTaxCredit.ctcAmount)
    },
    // TAX-23: §221's cap, thresholds and phase-out ranges, hand-typed here
    // from the printed 2025 Student Loan Interest Deduction Worksheet
    // (Schedule 1 line 21) -- never read back off the stored object, so a
    // wrong stored figure cannot pass by comparing against itself.
    //
    // Four statuses, asserted individually rather than looped with one shared
    // expectation, because the printed worksheet's line 5 GROUPS "Single,
    // head of household, or qualifying surviving spouse" onto one row while
    // giving married-filing-jointly its own: three of the four agreeing is a
    // fact about the form, and a loop would make the one that differs
    // indistinguishable from a typo.
    studentLoanInterestFiguresMatchThePrintedWorksheet: () => {
        assertEq(studentLoanInterestDeduction.maximumDeduction.amount, '2500.00', '§221(b)(1)')
        /** @type {Record<'single' | 'marriedFilingJointly' | 'headOfHousehold' | 'qualifyingSurvivingSpouse', readonly [string, string]>} */
        const expected = {
            // [worksheet line 5 threshold, worksheet line 7 divisor]
            single: ['85000.00', '15000.00'],
            marriedFilingJointly: ['170000.00', '30000.00'],
            headOfHousehold: ['85000.00', '15000.00'],
            qualifyingSurvivingSpouse: ['85000.00', '15000.00'],
        }
        assertEq(studentLoanInterestDeduction.phaseoutThreshold.single.amount, expected.single[0])
        assertEq(studentLoanInterestDeduction.phaseoutRange.single.amount, expected.single[1])
        assertEq(studentLoanInterestDeduction.phaseoutThreshold.marriedFilingJointly.amount, expected.marriedFilingJointly[0])
        assertEq(studentLoanInterestDeduction.phaseoutRange.marriedFilingJointly.amount, expected.marriedFilingJointly[1])
        assertEq(studentLoanInterestDeduction.phaseoutThreshold.headOfHousehold.amount, expected.headOfHousehold[0])
        assertEq(studentLoanInterestDeduction.phaseoutRange.headOfHousehold.amount, expected.headOfHousehold[1])
        assertEq(studentLoanInterestDeduction.phaseoutThreshold.qualifyingSurvivingSpouse.amount, expected.qualifyingSurvivingSpouse[0])
        assertEq(studentLoanInterestDeduction.phaseoutRange.qualifyingSurvivingSpouse.amount, expected.qualifyingSurvivingSpouse[1])
        // The married-filing-jointly divisor is exactly twice the other
        // three, which is what makes a transposed pair of figures visible
        // rather than merely wrong.
        assert(
            centsFromString(studentLoanInterestDeduction.phaseoutRange.marriedFilingJointly.amount)
                === 2n * centsFromString(studentLoanInterestDeduction.phaseoutRange.single.amount),
            [
                'the printed worksheet line 7 divides by $30,000 on a joint return and $15,000 otherwise',
                studentLoanInterestDeduction.phaseoutRange.marriedFilingJointly.amount,
            ],
        )
    },
    // The check a THIRD stored figure would have made impossible: threshold
    // plus range must land exactly on §221(b)(2)(B)'s own "completely phased
    // out" figures, hand-typed from the statute's TY2025 adjusted amounts
    // ($100,000, and $200,000 for a joint return). See
    // `studentLoanInterestDeduction`'s own docstring, "Two figures, not
    // three" -- the end point is DERIVED here precisely so it can never be a
    // second source of truth in the module itself.
    studentLoanInterestPhaseoutEndPointsMatchTheStatutoryFigures: () => {
        /** @type {readonly [string, string][]} */
        const expected = [
            ['single', '100000.00'],
            ['marriedFilingJointly', '200000.00'],
            ['headOfHousehold', '100000.00'],
            ['qualifyingSurvivingSpouse', '100000.00'],
        ]
        assertEq(expected.length, 4, 'four statuses can claim this deduction; MFS cannot claim it at all')
        for (const [status, completelyPhasedOut] of expected) {
            const entry = status === 'single' ? studentLoanInterestDeduction.phaseoutThreshold.single
                : status === 'marriedFilingJointly' ? studentLoanInterestDeduction.phaseoutThreshold.marriedFilingJointly
                : status === 'headOfHousehold' ? studentLoanInterestDeduction.phaseoutThreshold.headOfHousehold
                : studentLoanInterestDeduction.phaseoutThreshold.qualifyingSurvivingSpouse
            const range = status === 'single' ? studentLoanInterestDeduction.phaseoutRange.single
                : status === 'marriedFilingJointly' ? studentLoanInterestDeduction.phaseoutRange.marriedFilingJointly
                : status === 'headOfHousehold' ? studentLoanInterestDeduction.phaseoutRange.headOfHousehold
                : studentLoanInterestDeduction.phaseoutRange.qualifyingSurvivingSpouse
            assertEq(
                centsToString(centsFromString(entry.amount) + centsFromString(range.amount)),
                completelyPhasedOut,
                ['threshold + range must equal §221(b)(2)(B)\'s completely-phased-out figure', status],
            )
        }
    },
    // TAX-23: §221 is INDEXED (§221(f)), unlike §3101(b)(2) and §1411(b) one
    // parameter group up, whose own docstrings say at length that nothing
    // adjusts them. This leaf pins the citation kind and section for every
    // §221 figure so the two groups cannot be conflated by a reader who
    // notices that both are `kind: 'code'` -- the citation KIND is the same
    // for both, and the indexing behaviour is the opposite.
    studentLoanInterestFiguresCiteIrc221Only: () => {
        /** @type {readonly (readonly [AmountWithCitation, string])[]} */
        const entries = [
            [studentLoanInterestDeduction.maximumDeduction, '§221(b)(1)'],
            [studentLoanInterestDeduction.phaseoutThreshold.single, '§221(b)(2)(B)'],
            [studentLoanInterestDeduction.phaseoutThreshold.marriedFilingJointly, '§221(b)(2)(B)'],
            [studentLoanInterestDeduction.phaseoutThreshold.headOfHousehold, '§221(b)(2)(B)'],
            [studentLoanInterestDeduction.phaseoutThreshold.qualifyingSurvivingSpouse, '§221(b)(2)(B)'],
            [studentLoanInterestDeduction.phaseoutRange.single, '§221(b)(2)(B)'],
            [studentLoanInterestDeduction.phaseoutRange.marriedFilingJointly, '§221(b)(2)(B)'],
            [studentLoanInterestDeduction.phaseoutRange.headOfHousehold, '§221(b)(2)(B)'],
            [studentLoanInterestDeduction.phaseoutRange.qualifyingSurvivingSpouse, '§221(b)(2)(B)'],
        ]
        assertEq(entries.length, 9, 'one cap, four thresholds, four ranges')
        for (const [entry, section] of entries) {
            assertEq(entry.citation.kind, 'code', ['expected a bare-IRC citation', entry])
            assertEq(entry.citation.section, section, ['wrong governing subsection', entry])
            assertEq(entry.citation.effectiveDate, '2025-01-01', ['expected the TY2025 effective date', entry])
        }
    },
    // TAX-24: the educator-expense cap, hand-typed from Schedule 1's own
    // printed line 11 instruction. The second half is the point of the leaf:
    // the printed "$600 if both spouses are eligible educators" must NOT be
    // stored, because it is two applications of the $300 cap rather than an
    // independent figure -- and a field quietly added here later would fail
    // the key count.
    educatorExpenseCapIsPerEligibleEducatorAndNotAJointFigure: () => {
        assertEq(educatorExpenses.maximumPerEligibleEducator.amount, '300.00', '§62(a)(2)(D), TY2025')
        assertEq(educatorExpenses.maximumPerEligibleEducator.citation.kind, 'code')
        assertEq(educatorExpenses.maximumPerEligibleEducator.citation.section, '§62(a)(2)(D)')
        assertEq(educatorExpenses.maximumPerEligibleEducator.citation.effectiveDate, '2025-01-01')
        assertEq(
            Object.keys(educatorExpenses).length,
            1,
            'the joint $600 is twice the stored $300, never a second stored figure',
        )
    },
    // TAX-24: Form 8889's two indexed limits and its unindexed catch-up,
    // hand-typed from the printed 2025 Form 8889. The catch-up assertion is
    // separated from the two limits deliberately -- it is the one figure in
    // this group §223(g) does NOT index, and grouping it with the two that
    // move would invite exactly the uniform-sourcing error this module's own
    // header exists to prevent.
    healthSavingsAccountLimitsMatchThePrintedForm8889: () => {
        assertEq(healthSavingsAccount.annualLimit.selfOnly.amount, '4300.00', 'TY2025 self-only')
        assertEq(healthSavingsAccount.annualLimit.family.amount, '8550.00', 'TY2025 family')
        assertEq(healthSavingsAccount.annualLimit.selfOnly.citation.section, '§223(b)(2)(A)')
        assertEq(healthSavingsAccount.annualLimit.family.citation.section, '§223(b)(2)(B)')
        assertEq(healthSavingsAccount.annualLimit.selfOnly.citation.kind, 'code')
        assertEq(healthSavingsAccount.annualLimit.family.citation.kind, 'code')
        assertEq(healthSavingsAccount.annualLimit.selfOnly.citation.effectiveDate, '2025-01-01')
        assertEq(healthSavingsAccount.annualLimit.family.citation.effectiveDate, '2025-01-01')
        // Family coverage is NOT twice self-only, and that asymmetry is the
        // single most likely place for a wrong figure to hide: $8,550 is
        // $8,600 minus $50, so a reader who "simplifies" to 2x self-only
        // overstates the limit by $50 for every family-coverage filer.
        assert(
            centsFromString(healthSavingsAccount.annualLimit.family.amount)
                !== 2n * centsFromString(healthSavingsAccount.annualLimit.selfOnly.amount),
            [
                'the family limit is NOT twice the self-only limit; §223(b)(2) adjusts the two independently',
                healthSavingsAccount.annualLimit.family.amount,
            ],
        )
    },
    healthSavingsAccountCatchUpIsTheFlatUnindexedStatutoryFigure: () => {
        assertEq(healthSavingsAccount.catchUpContribution.amount, '1000.00', '§223(b)(3)(B)')
        assertEq(healthSavingsAccount.catchUpContribution.citation.kind, 'code')
        assertEq(healthSavingsAccount.catchUpContribution.citation.section, '§223(b)(3)(B)')
        assertEq(healthSavingsAccount.catchUpContribution.citation.effectiveDate, '2025-01-01')
        // §223(g) indexes subsection (b)(2) only, so the catch-up cites a
        // DIFFERENT subsection from the two limits above -- the structural
        // fact that says "this one does not move".
        assert(
            healthSavingsAccount.catchUpContribution.citation.section
                !== healthSavingsAccount.annualLimit.selfOnly.citation.section,
            [
                'the unindexed catch-up must not share a subsection with the indexed limits',
                healthSavingsAccount.catchUpContribution.citation.section,
            ],
        )
    },

    // ── TAX-25: Form 8880's rate table ─────────────────────────────────────
    saversCredit: {
        // Every one of the twelve stored ceilings, hand-typed here off the
        // printed 2025 Form 8880 line 9 table rather than read back from the
        // data, in the printed table's own three-row-per-column order. This
        // is the leaf a transposed column or a stale prior-year figure has to
        // get past, and neither the loop below nor
        // `everyDollarAmountIsAStringAndRoundTrips` could catch either.
        theTwelveBandCeilingsMatchThePrintedFormEightyEightyTable: () => {
            /** @type {Record<IndividualFilingStatus, readonly [string, string, string]>} */
            const expected = {
                marriedFilingJointly: ['47500.00', '51000.00', '79000.00'],
                headOfHousehold: ['35625.00', '38250.00', '59250.00'],
                single: ['23750.00', '25500.00', '39500.00'],
                marriedFilingSeparately: ['23750.00', '25500.00', '39500.00'],
                qualifyingSurvivingSpouse: ['23750.00', '25500.00', '39500.00'],
            }
            for (const status of individualFilingStatuses) {
                const bands = retirementSavingsContributionsCredit.rateBands[status]
                const printed = expected[status]
                assertEq(bands.length, 4, ['three printed rows plus the open-topped zero band', status])
                assertEq(bands[0]?.ceiling, printed[0], ['50% band ceiling', status])
                assertEq(bands[1]?.ceiling, printed[1], ['20% band ceiling', status])
                assertEq(bands[2]?.ceiling, printed[2], ['10% band ceiling', status])
                assertEq(bands[3]?.ceiling, undefined, ['the last band is open-topped', status])
            }
        },
        // The rates themselves, in order, for every status. Separated from
        // the ceilings above so a table whose ceilings are right and whose
        // rates were shifted by one row names itself.
        theFourRatesAreFiftyTwentyTenAndZeroForEveryStatus: () => {
            for (const status of individualFilingStatuses) {
                const bands = retirementSavingsContributionsCredit.rateBands[status]
                assertEq(bands[0]?.ratePercent, 50, ['first band', status])
                assertEq(bands[1]?.ratePercent, 20, ['second band', status])
                assertEq(bands[2]?.ratePercent, 10, ['third band', status])
                assertEq(bands[3]?.ratePercent, 0, ['the open-topped band credits nothing', status])
            }
        },
        // Every column's ceilings ascend. A table whose rows were reordered
        // would still hold twelve correct figures and would still pass a
        // membership check; only monotonicity notices.
        everyColumnAscends: () => {
            for (const status of individualFilingStatuses) {
                retirementSavingsContributionsCredit.rateBands[status]
                    .map(band => band.ceiling)
                    .filter(isDefinedString)
                    .map(centsFromString)
                    .reduce((previous, ceiling) => {
                        assert(
                            ceiling > previous,
                            ['a saver\'s credit band ceiling is out of order', status, ceiling, previous],
                        )
                        return ceiling
                    }, -1n)
            }
        },
        // The printed table's own three-column STRUCTURE, asserted as a
        // relationship rather than as three more copies of the same figures:
        // head of household is exactly three quarters of the joint column and
        // the single column exactly half of it, at every row. That is how
        // §25B(b) is written, and it is a property no single mistyped figure
        // can satisfy by accident.
        headOfHouseholdIsThreeQuartersOfJointAndSingleIsHalf: () => {
            const joint = retirementSavingsContributionsCredit.rateBands.marriedFilingJointly
            const hoh = retirementSavingsContributionsCredit.rateBands.headOfHousehold
            const single = retirementSavingsContributionsCredit.rateBands.single
            for (const row of [0, 1, 2]) {
                const jointCeiling = joint[row]?.ceiling
                const hohCeiling = hoh[row]?.ceiling
                const singleCeiling = single[row]?.ceiling
                assert(
                    jointCeiling !== undefined && hohCeiling !== undefined && singleCeiling !== undefined,
                    ['every one of the three printed rows must carry a ceiling', row],
                )
                if (jointCeiling === undefined || hohCeiling === undefined || singleCeiling === undefined) {
                    throw ['unreachable', row]
                }
                assertEq(
                    4n * centsFromString(hohCeiling),
                    3n * centsFromString(jointCeiling),
                    ['head of household is three quarters of the joint column', row],
                )
                assertEq(
                    2n * centsFromString(singleCeiling),
                    centsFromString(jointCeiling),
                    ['single is half of the joint column', row],
                )
            }
        },
        // The three statuses the printed table groups on ONE row carry the
        // same figures — stated as an assertion rather than as a spread, so
        // the day a Revenue Procedure separates them the divergence is
        // visible here instead of impossible to express.
        singleSeparateAndSurvivingSpouseShareTheThirdColumnToday: () => {
            for (const row of [0, 1, 2]) {
                const single = retirementSavingsContributionsCredit.rateBands.single[row]?.ceiling
                assertEq(
                    retirementSavingsContributionsCredit.rateBands.marriedFilingSeparately[row]?.ceiling,
                    single,
                    ['married filing separately shares single\'s printed column today', row],
                )
                assertEq(
                    retirementSavingsContributionsCredit.rateBands.qualifyingSurvivingSpouse[row]?.ceiling,
                    single,
                    ['qualifying surviving spouse shares single\'s printed column today', row],
                )
            }
        },
        theContributionCapIsTwoThousandPerPersonAndIsNotIndexed: () => {
            assertEq(retirementSavingsContributionsCredit.contributionCap.amount, '2000.00', '§25B(a)')
            assertEq(retirementSavingsContributionsCredit.contributionCap.citation.kind, 'code')
            assertEq(retirementSavingsContributionsCredit.contributionCap.citation.section, '§25B(a)')
            assertEq(
                retirementSavingsContributionsCredit.contributionCap.citation.effectiveDate,
                '2025-01-01',
            )
            // §25B(g) reaches subsection (b)'s table only, so the cap cites a
            // DIFFERENT subsection from the bands beside it — the structural
            // fact that says "this one does not move", exactly as the HSA
            // catch-up's own leaf above does.
            assert(
                retirementSavingsContributionsCredit.contributionCap.citation.section
                    !== retirementSavingsContributionsCredit.rateBandCitation.section,
                [
                    'the unindexed cap must not share a subsection with the indexed table',
                    retirementSavingsContributionsCredit.contributionCap.citation.section,
                ],
            )
        },
        theRateTableCarriesOneCitationForTheWholePrintedTable: () => {
            assertEq(retirementSavingsContributionsCredit.rateBandCitation.kind, 'code')
            assertEq(retirementSavingsContributionsCredit.rateBandCitation.section, '§25B(b)')
            assertEq(retirementSavingsContributionsCredit.rateBandCitation.effectiveDate, '2025-01-01')
        },
        // §25B(d)(2)'s testing-period reduction and §25B(c)'s eligibility
        // conditions are FACTS, not amounts, and this group carries neither.
        // Hand-typed key count, so a fourth field quietly added here — the
        // shape a "just store zero for line 4" change would take — fails.
        exactlyThreeFieldsAreStored: () => {
            assertEq(
                Object.keys(retirementSavingsContributionsCredit).length,
                3,
                'the testing period is not a dollar figure and has no parameter here',
            )
        },
    },

    // ── TAX-26: Form 8863's two credits ────────────────────────────────────
    educationCredits: {
        // The American Opportunity Credit's four printed figures, hand-typed
        // off Form 8863 Part III lines 27-30.
        americanOpportunityFiguresMatchThePrintedFormEightyEightSixtyThree: () => {
            assertEq(educationCredits.americanOpportunity.fullRateExpenseCap.amount, '2000.00', 'line 28')
            assertEq(educationCredits.americanOpportunity.totalExpenseCap.amount, '4000.00', 'line 27 cap')
            assertEq(educationCredits.americanOpportunity.reducedRatePercent, 25, 'line 29')
            assertEq(educationCredits.americanOpportunity.maximumCredit.amount, '2500.00')
            assertEq(educationCredits.americanOpportunity.refundablePercent, 40, 'line 8')
        },
        // The maximum is not an independent figure: it is the two rates
        // applied to the two expense slices. Asserted rather than derived
        // away, per this group's own docstring.
        theAmericanOpportunityMaximumIsTheTwoRatesApplied: () => {
            const { fullRateExpenseCap, totalExpenseCap, reducedRatePercent, maximumCredit }
                = educationCredits.americanOpportunity
            const firstSlice = centsFromString(fullRateExpenseCap.amount)
            const secondSlice = centsFromString(totalExpenseCap.amount) - firstSlice
            assertEq(
                firstSlice + secondSlice * BigInt(reducedRatePercent) / 100n,
                centsFromString(maximumCredit.amount),
                '$2,000 + 25% of the next $2,000 = $2,500',
            )
        },
        lifetimeLearningFiguresMatchThePrintedFormEightyEightSixtyThree: () => {
            assertEq(educationCredits.lifetimeLearning.expenseCap.amount, '10000.00', 'line 11')
            assertEq(educationCredits.lifetimeLearning.ratePercent, 20, 'line 12')
            // 20% of $10,000 is the $2,000 per-RETURN maximum the printed
            // instructions state. Derived here rather than stored, because
            // unlike the American Opportunity maximum no printed LINE holds
            // it — line 12 is the last word.
            assertEq(
                centsFromString(educationCredits.lifetimeLearning.expenseCap.amount)
                    * BigInt(educationCredits.lifetimeLearning.ratePercent) / 100n,
                200000n,
                '20% of $10,000 = $2,000 per return',
            )
        },
        // Form 8863 lines 2/13 and 5/16, hand-typed. Both credits read the
        // SAME two figures, which has been true only since 2021.
        phaseoutCeilingsAndRangesMatchThePrintedForm: () => {
            assertEq(educationCredits.phaseoutCeiling.marriedFilingJointly.amount, '180000.00')
            assertEq(educationCredits.phaseoutCeiling.single.amount, '90000.00')
            assertEq(educationCredits.phaseoutCeiling.headOfHousehold.amount, '90000.00')
            assertEq(educationCredits.phaseoutCeiling.qualifyingSurvivingSpouse.amount, '90000.00')
            assertEq(educationCredits.phaseoutRange.marriedFilingJointly.amount, '20000.00')
            assertEq(educationCredits.phaseoutRange.single.amount, '10000.00')
            assertEq(educationCredits.phaseoutRange.headOfHousehold.amount, '10000.00')
            assertEq(educationCredits.phaseoutRange.qualifyingSurvivingSpouse.amount, '10000.00')
        },
        // The DERIVED start of the phase-out, against the statutory figures
        // a reader of §25A(d)(2) expects — the check a third stored field
        // would have made impossible. See this group's own docstring, "The
        // CEILING is stored, not the start".
        educationCreditPhaseoutStartsMatchTheStatutoryFigures: () => {
            /** @type {readonly (readonly ['single' | 'marriedFilingJointly' | 'headOfHousehold' | 'qualifyingSurvivingSpouse', bigint])[]} */
            const expected = [
                ['single', 8000000n],
                ['marriedFilingJointly', 16000000n],
                ['headOfHousehold', 8000000n],
                ['qualifyingSurvivingSpouse', 8000000n],
            ]
            assertEq(expected.length, 4, 'four statuses; §25A(g)(6) denies the credit to the fifth')
            for (const [status, start] of expected) {
                assertEq(
                    centsFromString(educationCredits.phaseoutCeiling[status].amount)
                        - centsFromString(educationCredits.phaseoutRange[status].amount),
                    start,
                    ['the phase-out start is the ceiling less the range', status],
                )
            }
        },
        // §25A(g)(6): no education credit at all on a separate return, so
        // there is no threshold for it — the identical omission
        // `studentLoanInterestDeduction` makes under §221(e)(2).
        marriedFilingSeparatelyHasNoThresholdBecauseItHasNoCredit: () => {
            assertEq(Object.keys(educationCredits.phaseoutCeiling).length, 4)
            assertEq(Object.keys(educationCredits.phaseoutRange).length, 4)
            assertEq(
                Object.keys(educationCredits.phaseoutCeiling).includes('marriedFilingSeparately'),
                false,
            )
            assertEq(
                Object.keys(educationCredits.phaseoutRange).includes('marriedFilingSeparately'),
                false,
            )
        },
        // These figures are NOT indexed, which is the opposite of the group
        // directly above them in this file. Stated as its own leaf so the
        // claim is somewhere a reader looks, and pinned through the citation
        // rather than through prose alone.
        everyEducationCreditFigureCitesTheCodeAndNotARevenueProcedure: () => {
            /** @type {readonly AmountWithCitation[]} */
            const every = [
                educationCredits.americanOpportunity.fullRateExpenseCap,
                educationCredits.americanOpportunity.totalExpenseCap,
                educationCredits.americanOpportunity.maximumCredit,
                educationCredits.lifetimeLearning.expenseCap,
                educationCredits.phaseoutCeiling.single,
                educationCredits.phaseoutCeiling.marriedFilingJointly,
                educationCredits.phaseoutCeiling.headOfHousehold,
                educationCredits.phaseoutCeiling.qualifyingSurvivingSpouse,
                educationCredits.phaseoutRange.single,
                educationCredits.phaseoutRange.marriedFilingJointly,
                educationCredits.phaseoutRange.headOfHousehold,
                educationCredits.phaseoutRange.qualifyingSurvivingSpouse,
            ]
            assertEq(every.length, 12, 'hand-counted: four AOC/LLC figures and eight phase-out figures')
            for (const figure of every) {
                assertEq(figure.citation.kind, 'code', ['not indexed, so no Revenue Procedure', figure.amount])
                assertEq(figure.citation.effectiveDate, '2025-01-01')
                assert(
                    figure.citation.section.startsWith('§25A'),
                    ['every education credit figure is §25A\'s', figure.citation.section],
                )
            }
        },
    },
    // ── TAX-28 (Phase 26): §408(d)(8)'s two QCD limits ──────────────────────
    qualifiedCharitableDistribution: {
        // Both figures hand-typed off the printed 2025 Form 1040 instructions'
        // own Line 4a/4b "Exception 3" paragraph, never derived from each
        // other and never from anything this module computes.
        bothTy2025LimitsMatchThePrintedInstruction: () => {
            assertEq(
                qualifiedCharitableDistribution.annualLimitPerIndividual.amount,
                '108000.00',
                'i1040gi: "your total QCDs for the year can\'t be more than $108,000"',
            )
            assertEq(
                qualifiedCharitableDistribution.splitInterestOneTimeLimit.amount,
                '54000.00',
                'i1040gi: "any amount (up to $54,000) of a one-time QCD to a split-interest entity"',
            )
        },
        // The single most consequential property of the pair, and the one a
        // reader is most likely to get backwards: the split-interest figure
        // is a SUB-CAP carved out of the annual limit, not a second budget
        // beside it. Asserted as a strict inequality rather than described,
        // so a future year's figures cannot silently invert the relation.
        theSplitInterestLimitIsInsideTheAnnualLimitNotBesideIt: () => {
            const annual = centsFromString(
                qualifiedCharitableDistribution.annualLimitPerIndividual.amount)
            const splitInterest = centsFromString(
                qualifiedCharitableDistribution.splitInterestOneTimeLimit.amount)
            assert(
                splitInterest < annual,
                ['the one-time SIE limit must be strictly inside the annual limit',
                    qualifiedCharitableDistribution.splitInterestOneTimeLimit.amount,
                    qualifiedCharitableDistribution.annualLimitPerIndividual.amount],
            )
            // And the reading this leaf exists to forbid: the two are not
            // added. $108,000 + $54,000 = $162,000 is not a limit that exists
            // anywhere on the printed page.
            assert(
                annual + splitInterest !== annual,
                'the sum is a real number; it is simply not a limit',
            )
            assertEq(centsToString(annual + splitInterest), '162000.00')
        },
        // Nothing in this group is keyed by filing status — the limit is per
        // INDIVIDUAL, and a joint return has two of them rather than one
        // larger one. Asserted rather than described, so a status-keyed
        // rewrite has to delete this leaf deliberately.
        //
        // `[FINDING, this phase's verification]` The FIRST attempt at this
        // mutation — adding `single:` to the object alone — does not compile:
        // the group's own `@type` annotation is a closed two-field record, so
        // `tsc` stops at **TS2353** before a test runs, and the gate measures
        // the compiler rather than the suite (AGENTS.md's first failure mode).
        // Reshaped to widen the ANNOTATION and the object together, which is
        // the rewrite a future phase would actually perform, the mutation
        // reddens exactly this leaf and nothing else. So the annotation is the
        // primary guard and this leaf is the one that survives the annotation
        // being widened with it — which is precisely the case prose could not
        // catch.
        neitherLimitIsKeyedByFilingStatus: () => {
            for (const status of individualFilingStatuses) {
                assertEq(
                    Object.keys(qualifiedCharitableDistribution).includes(status),
                    false,
                    ['a QCD limit is per individual, never per filing status', status],
                )
            }
            assertEq(Object.keys(qualifiedCharitableDistribution).length, 2)
        },
        // Both are §408(d)(8)'s, both `kind: 'code'` for the reason
        // `studentLoanInterestDeduction` records — and the two sections
        // DIFFER, because the annual exclusion and the one-time election are
        // separate provisions that a single shared citation would hide.
        eachLimitCitesItsOwnSubparagraph: () => {
            assertEq(
                qualifiedCharitableDistribution.annualLimitPerIndividual.citation.kind, 'code')
            assertEq(
                qualifiedCharitableDistribution.annualLimitPerIndividual.citation.section,
                '§408(d)(8)(A)')
            assertEq(
                qualifiedCharitableDistribution.annualLimitPerIndividual.citation.effectiveDate,
                '2025-01-01')
            assertEq(
                qualifiedCharitableDistribution.splitInterestOneTimeLimit.citation.kind, 'code')
            assertEq(
                qualifiedCharitableDistribution.splitInterestOneTimeLimit.citation.section,
                '§408(d)(8)(F)')
            assertEq(
                qualifiedCharitableDistribution.splitInterestOneTimeLimit.citation.effectiveDate,
                '2025-01-01')
            assert(
                qualifiedCharitableDistribution.annualLimitPerIndividual.citation.section
                    !== qualifiedCharitableDistribution.splitInterestOneTimeLimit.citation.section,
                'two separate provisions must not share one citation',
            )
        },
    },
}
