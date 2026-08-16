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
}
