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
import { assert, assertEq } from 'functionalscript/fjs/asserts/module.f.js'
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
 * `phaseoutRatePercent` (5) is a plain rate, mirroring every other
 * `*RatePercent` field in this module. Unlike `seniorDeduction`'s and
 * `saltCap`'s CONTINUOUS phase-outs, Schedule 8812's is STEPPED — a true
 * cliff, rounding the excess UP to the next whole $1,000 before applying the
 * rate (13-RESEARCH.md §7). That rounding arithmetic
 * (`roundUpToNextThousandDollars`) has no precedent anywhere in this
 * codebase and is a later plan's job to write and apply; this module stores
 * the threshold and rate only, exactly as it stores every other phase-out's
 * inputs without performing the phase-out itself.
 * @type {{
 *   readonly ctcAmount: AmountWithCitation,
 *   readonly odcAmount: AmountWithCitation,
 *   readonly actcCap: AmountWithCitation,
 *   readonly phaseoutThreshold: {
 *     readonly marriedFilingJointly: AmountWithCitation,
 *     readonly other: AmountWithCitation,
 *   },
 *   readonly phaseoutRatePercent: number,
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
 *   readonly socialSecurityBenefitsWorksheetBaseAmounts: typeof socialSecurityBenefitsWorksheetBaseAmounts,
 *   readonly seniorDeduction: typeof seniorDeduction,
 *   readonly saltCap: typeof saltCap,
 *   readonly medicalExpenseFloor: typeof medicalExpenseFloor,
 *   readonly childTaxCredit: typeof childTaxCredit,
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
        socialSecurityBenefitsWorksheetBaseAmounts,
        seniorDeduction,
        saltCap,
        medicalExpenseFloor,
        childTaxCredit,
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
        ]
        const revProcSourced = allChildTaxCreditAmounts.filter(entry => entry.citation.kind === 'revProc')
        assertEq(revProcSourced.length, 1, ['expected exactly one revProc-sourced figure', revProcSourced])
        assertEq(revProcSourced[0], childTaxCredit.ctcAmount)
    },
}
