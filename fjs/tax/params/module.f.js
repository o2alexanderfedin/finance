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
import { assert, assertEq, assertNotNullish } from 'functionalscript/fjs/asserts/module.f.mjs'
import { centsFromString, centsToString } from '../../exact/module.f.js'
import { of, halfUp } from '../../types/rational/module.f.js'

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
 * - `'federalRegister'` — an agency notice published in the Federal Register,
 *   for a figure a department OTHER than Treasury sets and the tax law then
 *   incorporates by reference. Added for {@link federalPovertyLine}: the HHS
 *   poverty guidelines are §36B(d)(3)'s input and no IRS document originates
 *   them, so filing them under `'code'` would have named an authority that
 *   does not publish the numbers.
 * @typedef {{
 *   readonly kind: 'revProc', readonly revProc: string, readonly section: string, readonly effectiveDate: string
 * } | {
 *   readonly kind: 'publicLaw', readonly publicLaw: string, readonly section: string, readonly effectiveDate: string
 * } | {
 *   readonly kind: 'code', readonly section: string, readonly effectiveDate: string
 * } | {
 *   readonly kind: 'federalRegister', readonly federalRegister: string, readonly section: string, readonly effectiveDate: string
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
 *
 * **`§86(c)` is the governing PROVISION for all four figures, and the literal
 * source of only two of them.** Re-verified 2026-08-17 against the printed
 * pages, discharging `13-VERIFICATION.md`'s manual-only item. `firstThreshold`
 * ($25,000 / $32,000) is §86(c)(1) verbatim. `secondThreshold` ($9,000 /
 * $12,000) is **not written in §86(c) at all** — that section states the
 * *adjusted base amounts* $34,000 and $44,000, and the worksheet prints their
 * DIFFERENCES from the base amounts instead (34,000 − 25,000 = 9,000;
 * 44,000 − 32,000 = 12,000). A reader who opens §86(c) looking for `$9,000`
 * will not find it, exactly as this module's `childTaxCredit` docstring
 * already records for `§24(h)` and `$1,700`. `kind: 'code'` stays for the same
 * reason it stays there: the governing provision is the honest, verifiable
 * half of the citation, and the DOLLAR VALUES are backed by the printed
 * worksheet face. Neither figure is inflation-indexed — §86's amounts have
 * been unchanged since 1993 — so neither can go stale between tax years, which
 * is why they are `kind: 'code'` and not an annual Rev. Proc.
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
 * The FOUR qualifying-child tiers §32(b)(1)'s and §32(b)(2)(A)'s own printed
 * tables are keyed by. Written in the order the STATUTE prints them rather
 * than Rev. Proc. 2024-40 §2.06(1)'s (which puts "None" last), because the
 * statute's order is ascending and an ascending list of counts is the one a
 * reader can check against `qualifyingChildCount` without a mapping step.
 *
 * `'threeOrMore'` is not a count and is deliberately not spelled as one:
 * §32(b)(1)'s own row reads *"3 or more qualifying children"*, so a fourth
 * child changes nothing and a tier NAME that said `'three'` would invite a
 * lookup by count that silently has no entry at four.
 */
export const earnedIncomeCreditChildTiers = /** @type {const} */ ([
    'none', 'one', 'two', 'threeOrMore',
])

/** One member of {@link earnedIncomeCreditChildTiers}.
 * @typedef {typeof earnedIncomeCreditChildTiers[number]} EarnedIncomeCreditChildTier
 */

/**
 * One tier's five figures.
 *
 * **`phaseoutAmount` is keyed `marriedFilingJointly`/`other`, not by all five
 * statuses**, and that is §32(b)(2)(B)'s own shape rather than a shortcut:
 * the statute states ONE phaseout amount per tier and then says a joint
 * return's is *"increased by $5,000"* (as indexed). Rev. Proc. 2024-40
 * §2.06(1) prints exactly two rows for the same reason, and Worksheet A's
 * line 5 asks exactly one question — *"married filing jointly"* or not. A
 * five-status map here would be four copies of one figure, three of which
 * nothing could ever notice drifting.
 *
 * This is the OPPOSITE decision from {@link additionalMedicareTaxThreshold},
 * which hand-types a qualifying surviving spouse's own $200,000 precisely
 * because that status does NOT share the joint figure. Here it does: Rev.
 * Proc. 2024-40 §2.06(1)'s second row is captioned *"All other filing
 * statuses"*, and the printed EIC Table's own column heading groups *"Single,
 * head of household, or qualifying surviving spouse"* against *"Married
 * filing jointly"*. The rule is the same in both places — read the printed
 * grouping, never assume one — and it produces different answers.
 * @typedef {{
 *   readonly creditPercentBasisPoints: number,
 *   readonly phaseoutPercentBasisPoints: number,
 *   readonly earnedIncomeAmount: AmountWithCitation,
 *   readonly maximumCredit: AmountWithCitation,
 *   readonly phaseoutAmount: {
 *     readonly marriedFilingJointly: AmountWithCitation,
 *     readonly other: AmountWithCitation,
 *   },
 * }} EarnedIncomeCreditTier
 */

/**
 * §32's own parameters — TAX-27, Phase 32. Read by `fjs/schedule/eic`.
 *
 * ## Two sources, and neither is guessed
 *
 * - **The percentages are STATUTORY and NOT indexed.** §32(b)(1) prints a
 *   four-row table of credit and phaseout percentages — 34/15.98, 40/21.06,
 *   45/21.06 and 7.65/7.65 — and §32(j) indexes *"each of the dollar amounts
 *   in subsections (b)(2) and (i)(1)"*, which is the amounts and not the
 *   percentages. So they cite `kind: 'code'` at §32(b)(1), for the same
 *   reason {@link additionalMedicareTaxRates} does: there is no annual revenue
 *   procedure to cite and inventing one would be the sourcing error this
 *   module's own header exists to prevent.
 * - **Every dollar figure IS indexed**, by §32(j), and comes from Rev. Proc.
 *   2024-40 §2.06 — read off the published PDF, not recalled. §2.06(1)'s
 *   table supplies the earned income amount, the maximum credit and both
 *   phaseout amounts per tier; §2.06(2) supplies {@link investmentIncomeLimit}.
 *
 * ## BASIS POINTS, not `ratePercent`, for all eight percentages
 *
 * 15.98, 21.06 and 7.65 are not whole numbers of percent, and none of
 * `0.1598`, `0.2106` or `0.0765` is exact as an IEEE 754 double — the same
 * argument {@link additionalMedicareTaxRates} states in full. 34, 40 and 45
 * ARE whole, and are stored in basis points anyway: a group where six fields
 * are basis points and two are percent is a group where a reader has to check
 * the units at every call site, and `fjs/schedule/eic` walks all four tiers
 * through one expression.
 *
 * ## What is deliberately NOT stored: the completed phaseout amount
 *
 * Rev. Proc. 2024-40 §2.06(1) prints a *"Completed Phaseout Amount"* row —
 * $19,104/$50,434/$57,310/$61,555 and $26,214/$57,554/$64,430/$68,675 — and
 * every one of the eight is DERIVABLE from the three figures above it:
 * `phaseoutAmount + maximumCredit / phaseoutPercent`, to the nearest dollar.
 * Storing it would be a second source of truth able to disagree with the
 * figures the computation actually reads — exactly the position
 * {@link studentLoanInterestDeduction} takes on its own phase-out end point.
 * `earnedIncomeCreditCompletedPhaseoutAmountsMatchTheRevenueProcedure`
 * asserts the DERIVED eight against the eight hand-typed published figures
 * instead, which is the check a ninth and tenth stored field would have made
 * impossible.
 *
 * {@link maximumCredit} IS stored even though it too looks derivable, and the
 * difference is that it is not: the printed EIC Table is built on the ROUNDED
 * dollar figure. For the childless tier the exact product is
 * $8,490 x 7.65% = $649.485 and the table's phase-out column is computed from
 * $649 — a band whose entry the exact product would put one dollar higher.
 * See `fjs/schedule/eic`'s own docstring, which reproduces the two rows that
 * settle it. `earnedIncomeCreditMaximumCreditIsTheRoundedProduct` asserts the
 * stored figure against the rounded product, so a transcription slip in
 * either the percentage or the earned income amount still fails.
 *
 * ## A property of {@link earnedIncomeAmount} nobody had written down
 *
 * **A small mutation of the childless tier's `earnedIncomeAmount` is an
 * EQUIVALENT MUTANT and no proof can bite on it.** Moving $8,490 to $8,480 was
 * run against the whole suite and left it green. Two neighbouring operations
 * absorb it, and both are the printed table's own (AGENTS.md, "the equivalent
 * mutant: a mutation a neighbouring operation absorbs"):
 *
 * - the proof above rounds the product to whole DOLLARS, and 7.65% of $10 is
 *   $0.765, so the rounded maximum credit stays $649;
 * - `fjs/schedule/eic` reads this figure only to decide which $50 band reaches
 *   it, so any change that does not cross a $50 boundary changes no credit at
 *   any income.
 *
 * So the observable resolution of this parameter is the band, not the dollar.
 * `phaseInTopForTheChildlessAndThreeChildTiers` pins it to exactly that
 * resolution — $8,449.99 gives $645 and $8,450.00 gives $649 — and a mutation
 * that crosses a $50 boundary does redden ($8,590 was run and fails the proof
 * above). Written here rather than left to be rediscovered as a coverage gap.
 *
 * ## `bandWidth` is a parameter, not a constant in the reader
 *
 * §32(f)(1) makes the credit *"determined under tables prescribed by the
 * Secretary"* and §32(f)(2) fixes those tables' brackets at *"not greater
 * than $50 each"*. The width is therefore a figure with a citation, like
 * every other figure here, and `fjs/schedule/eic` reads it rather than
 * spelling `5000n` inline.
 * @type {{
 *   readonly investmentIncomeLimit: AmountWithCitation,
 *   readonly bandWidth: AmountWithCitation,
 *   readonly percentagesCitation: Citation,
 *   readonly tiers: Record<EarnedIncomeCreditChildTier, EarnedIncomeCreditTier>,
 * }}
 */
export const earnedIncomeCredit = {
    // §32(i)(1)'s $10,000, indexed by §32(j)(1) from calendar year 2020.
    investmentIncomeLimit: {
        amount: '11950.00',
        citation: { kind: 'revProc', revProc: '2024-40', section: '§2.06(2)', effectiveDate: '2025-01-01' },
    },
    bandWidth: {
        amount: '50.00',
        citation: { kind: 'code', section: '§32(f)(2)', effectiveDate: '2025-01-01' },
    },
    // ONE citation for the eight percentages, because §32(b)(1) is one printed
    // table with one row per tier — the same shape, for the same reason, as
    // {@link additionalMedicareTaxRates}' shared §3101(b) citation.
    percentagesCitation: { kind: 'code', section: '§32(b)(1)', effectiveDate: '2025-01-01' },
    tiers: {
        none: {
            creditPercentBasisPoints: 765,
            phaseoutPercentBasisPoints: 765,
            earnedIncomeAmount: {
                amount: '8490.00',
                citation: { kind: 'revProc', revProc: '2024-40', section: '§2.06(1)', effectiveDate: '2025-01-01' },
            },
            maximumCredit: {
                amount: '649.00',
                citation: { kind: 'revProc', revProc: '2024-40', section: '§2.06(1)', effectiveDate: '2025-01-01' },
            },
            phaseoutAmount: {
                marriedFilingJointly: {
                    amount: '17730.00',
                    citation: { kind: 'revProc', revProc: '2024-40', section: '§2.06(1)', effectiveDate: '2025-01-01' },
                },
                other: {
                    amount: '10620.00',
                    citation: { kind: 'revProc', revProc: '2024-40', section: '§2.06(1)', effectiveDate: '2025-01-01' },
                },
            },
        },
        one: {
            creditPercentBasisPoints: 3400,
            phaseoutPercentBasisPoints: 1598,
            earnedIncomeAmount: {
                amount: '12730.00',
                citation: { kind: 'revProc', revProc: '2024-40', section: '§2.06(1)', effectiveDate: '2025-01-01' },
            },
            maximumCredit: {
                amount: '4328.00',
                citation: { kind: 'revProc', revProc: '2024-40', section: '§2.06(1)', effectiveDate: '2025-01-01' },
            },
            phaseoutAmount: {
                marriedFilingJointly: {
                    amount: '30470.00',
                    citation: { kind: 'revProc', revProc: '2024-40', section: '§2.06(1)', effectiveDate: '2025-01-01' },
                },
                other: {
                    amount: '23350.00',
                    citation: { kind: 'revProc', revProc: '2024-40', section: '§2.06(1)', effectiveDate: '2025-01-01' },
                },
            },
        },
        two: {
            creditPercentBasisPoints: 4000,
            phaseoutPercentBasisPoints: 2106,
            earnedIncomeAmount: {
                amount: '17880.00',
                citation: { kind: 'revProc', revProc: '2024-40', section: '§2.06(1)', effectiveDate: '2025-01-01' },
            },
            maximumCredit: {
                amount: '7152.00',
                citation: { kind: 'revProc', revProc: '2024-40', section: '§2.06(1)', effectiveDate: '2025-01-01' },
            },
            phaseoutAmount: {
                marriedFilingJointly: {
                    amount: '30470.00',
                    citation: { kind: 'revProc', revProc: '2024-40', section: '§2.06(1)', effectiveDate: '2025-01-01' },
                },
                other: {
                    amount: '23350.00',
                    citation: { kind: 'revProc', revProc: '2024-40', section: '§2.06(1)', effectiveDate: '2025-01-01' },
                },
            },
        },
        // Hand-typed in full, deliberately never spread from `two` — §32(b)(1)
        // gives the two tiers the SAME phaseout percentage and §32(b)(2)(A)
        // the SAME earned income amount, which is exactly the coincidence
        // {@link standardDeduction}'s own note says a spread makes impossible
        // to observe drifting apart. The credit percentage and the maximum
        // credit differ, and a future year could move any of them.
        threeOrMore: {
            creditPercentBasisPoints: 4500,
            phaseoutPercentBasisPoints: 2106,
            earnedIncomeAmount: {
                amount: '17880.00',
                citation: { kind: 'revProc', revProc: '2024-40', section: '§2.06(1)', effectiveDate: '2025-01-01' },
            },
            maximumCredit: {
                amount: '8046.00',
                citation: { kind: 'revProc', revProc: '2024-40', section: '§2.06(1)', effectiveDate: '2025-01-01' },
            },
            phaseoutAmount: {
                marriedFilingJointly: {
                    amount: '30470.00',
                    citation: { kind: 'revProc', revProc: '2024-40', section: '§2.06(1)', effectiveDate: '2025-01-01' },
                },
                other: {
                    amount: '23350.00',
                    citation: { kind: 'revProc', revProc: '2024-40', section: '§2.06(1)', effectiveDate: '2025-01-01' },
                },
            },
        },
    },
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
 * The employee's Social Security tax rate — IRC **§3101(a)**, 6.2%, in BASIS
 * POINTS. Schedule 3 line 11 multiplies {@link selfEmploymentTax}'s
 * `socialSecurityWageBase` by it to obtain the maximum any ONE employer may
 * withhold, $10,918.20 for TY2025.
 *
 * Placed beside {@link additionalMedicareTaxRates} because the two are
 * subsections of ONE section: §3101(a) is the Social Security half of FICA
 * and §3101(b) the Medicare half. Nothing else in this module reads chapter
 * 21 at all.
 *
 * **This is NOT half of {@link selfEmploymentTax}'s 12.4%, and storing it
 * separately is the point.** §1401(a) imposes 12.4% on a self-employed
 * person's net earnings (chapter 2, SECA); §3101(a) imposes 6.2% on an
 * employee's wages (chapter 21, FICA), with §3111(a) imposing the matching
 * 6.2% on the employer. Each statute writes its own number outright. That the
 * three are related 1:2 today is arithmetic, not law, and a derived 620 would
 * be a second copy of a rule no statute states — the
 * {@link additionalMedicareTaxThreshold}-versus-{@link netInvestmentIncomeTaxThreshold}
 * position this module already takes three times, for the same reason. The
 * contrast worth holding beside it is §1402(a)(12), which this module cites as
 * the reason 92.35% is DERIVED rather than stored: there the statute performs
 * the derivation itself, and here no statute does.
 *
 * **NOT indexed.** §3101(a) has read "6.2 percent" since 1990. The figure that
 * moves with inflation is the wage base it multiplies, which lives in
 * {@link selfEmploymentTax} and carries that warning in its own docstring.
 *
 * Basis points rather than `ratePercent` for the exactness reason
 * {@link additionalMedicareTaxRates} states in full: 6.2 is not a whole number
 * of percent, and `0.062` is not exact as an IEEE 754 double. The consumer
 * multiplies by `basisPoints / 10000` through `fjs/types/rational`, cent-exact
 * and half-up — never through a float. `kind: 'code'` for the same reason
 * §3101(b)'s citation is: the statute states the rate, and no Revenue
 * Procedure adjusts it.
 * @type {{
 *   readonly employeeRateBasisPoints: number,
 *   readonly citation: Citation,
 * }}
 */
export const socialSecurityTaxWithholding = {
    // 6.2% — IRC §3101(a), the tax an employer withholds from box 3 wages and
    // reports in Form W-2 box 4.
    employeeRateBasisPoints: 620,
    citation: { kind: 'code', section: '§3101(a)', effectiveDate: '2025-01-01' },
}

/**
 * The §904(j)(2)(B) de-minimis ceiling on creditable foreign taxes — the
 * figure below which an individual may ELECT out of the §904(a) limitation
 * and take the foreign tax credit straight onto Schedule 3 line 1, with no
 * Form 1116 at all. TAX-36, and see
 * `fjs/schedule/3/todo/foreign-tax-credit.md` for the whole of what the
 * election does and does not assert.
 *
 * §904(j)(2)(B): *"the amount of the creditable foreign taxes paid or accrued
 * by the individual during the taxable year does not exceed **$300 ($600 in
 * the case of a joint return)**"*.
 *
 * **The ceiling is on the TAXES, not on the income.** It is the one of
 * §904(j)(2)'s three conditions this engine can check for itself; (A)'s
 * all-passive, all-on-a-payee-statement test and (C)'s election are taxpayer
 * assertions carried on `vnd.fjs.return_profile`. A small figure here is not
 * evidence that (A) holds.
 *
 * **`qualifyingSurvivingSpouse` is $300, NOT $600 — the trap in this group**,
 * and the same one {@link additionalMedicareTaxThreshold} carries one
 * parameter over. The statute's larger figure is *"in the case of a joint
 * return"*, and a qualifying surviving spouse does not file one: that status
 * borrows the joint rate schedule and the joint standard deduction, and
 * nothing else. Head of household and married-filing-separately are $300 for
 * the identical reading. Only `marriedFilingJointly` is a joint return.
 *
 * Hand-typed per status, deliberately never spread from another status's
 * entry, for the reason {@link standardDeduction} states: a spread makes two
 * statuses impossible to observe drifting apart.
 *
 * **NOT indexed.** §904(j)(2)(B) has read $300/$600 since the Taxpayer Relief
 * Act of 1997 §1105 added the subsection, and no Revenue Procedure adjusts
 * it — so `kind: 'code'`, for the same reason
 * {@link additionalMedicareTaxThreshold}'s citations are, and inventing a Rev.
 * Proc. number would be the sourcing error this module's own header exists to
 * prevent. `effectiveDate` reads `'2025-01-01'` per that header: every
 * citation here states the year the figure is being APPLIED for.
 *
 * No `estatesAndTrusts` entry: §904(j)(1) opens *"In the case of an
 * individual"*, and this map is keyed by {@link IndividualFilingStatus} to
 * say so at the type level.
 * @type {Record<IndividualFilingStatus, AmountWithCitation>}
 */
export const foreignTaxCreditDeMinimisElection = {
    single: {
        amount: '300.00',
        citation: { kind: 'code', section: '§904(j)(2)(B)', effectiveDate: '2025-01-01' },
    },
    // The ONE joint return, and therefore the one $600.
    marriedFilingJointly: {
        amount: '600.00',
        citation: { kind: 'code', section: '§904(j)(2)(B)', effectiveDate: '2025-01-01' },
    },
    marriedFilingSeparately: {
        amount: '300.00',
        citation: { kind: 'code', section: '§904(j)(2)(B)', effectiveDate: '2025-01-01' },
    },
    headOfHousehold: {
        amount: '300.00',
        citation: { kind: 'code', section: '§904(j)(2)(B)', effectiveDate: '2025-01-01' },
    },
    // See this group's own docstring: NOT a joint return, so NOT $600.
    qualifyingSurvivingSpouse: {
        amount: '300.00',
        citation: { kind: 'code', section: '§904(j)(2)(B)', effectiveDate: '2025-01-01' },
    },
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
 * Schedule 1 line 20's traditional IRA deduction — IRC §219, Publication
 * 590-A Worksheet 1-2 and Appendix B Worksheet 2.
 *
 * ## Two indexed figures, two statutory constants, and one that is neither
 *
 * {@link studentLoanInterestDeduction}'s own docstring warns that copying
 * "no Revenue Procedure adjusts these" onto an indexed group is a silent
 * error one tax year later. This group is the sharpest case of that yet,
 * because it holds THREE kinds of figure at once:
 *
 * - `deductibleAmount` and every `phaseoutThreshold` are **inflation-indexed**
 *   (§219(b)(5)(C) and §219(g)(3)(B)'s own flush language), and IRS Notice
 *   2024-80 is what published the TY2025 values. They moved for 2025:
 *   $77,000 -> $79,000 (single/HoH) and $123,000 -> $126,000 (joint/QSS).
 * - `catchUpContribution` is indexed by §219(b)(5)(C)(iii) in $500
 *   increments and has therefore sat at **$1,000 since 2006** — the
 *   {@link healthSavingsAccount} trap exactly: a figure that looks constant
 *   and is not. Notice 2024-80 says "remains $1,000", not "is $1,000".
 * - `phaseoutRange`, `minimumPhasedOutLimit` and `roundingIncrement` are
 *   written into §219(g)(2) itself and nothing indexes them.
 *
 * ## `marriedFilingJointly` has NO entry, and neither does a covered spouse
 *
 * `fjs/schedule/1` REFUSES a joint return carrying a traditional IRA
 * contribution — §219(f)(2) computes the limit "separately for each
 * individual", coverage is a Form W-2 box 13 checkbox, and nothing this
 * engine models says which spouse a Form W-2 belongs to. So the status has
 * no dollar threshold here, exactly as {@link studentLoanInterestDeduction}
 * omits `marriedFilingSeparately` and {@link seniorDeduction} omits it too:
 * there is no threshold for a status whose amount never depends on one.
 *
 * Two published TY2025 figures are therefore recorded HERE, in prose, rather
 * than stored — the phase that models joint returns needs both and neither is
 * derivable from what is below:
 *
 * - §219(g)(3)(B)(i), a joint return where the CONTRIBUTOR is the active
 *   participant: **$126,000**, over a **$20,000** range. (That pair IS
 *   stored, under `qualifyingSurvivingSpouse` — see below.)
 * - §219(g)(7)(A), a joint return where the contributor is NOT an active
 *   participant but their spouse is: **$236,000** — over a **$10,000**
 *   range, NOT $20,000, because §219(g)(7)(B) overrides §219(g)(2)(A)(ii)'s
 *   joint divisor. Publication 590-A Worksheet 1-2 puts that taxpayer in its
 *   "All others … 70% (80%)" row rather than its joint "35% (40%)" row for
 *   exactly this reason, and getting it wrong is the classic §219
 *   implementation bug.
 *
 * ## `qualifyingSurvivingSpouse` carries the JOINT figures — the opposite of
 * {@link additionalMedicareTaxThreshold}
 *
 * That group gives QSS §3101(b)(2)(C)'s "any other case" amount, on the
 * ground that a QSS return is not a JOINT return. **Here the authority says
 * the opposite in so many words.** IRS Notice 2024-80: *"The applicable
 * amount under section 219(g)(3)(B)(i) for determining the deductible amount
 * of an IRA contribution for taxpayers who are active participants filing a
 * joint return **or as a qualifying widow(er)** is increased from $123,000 to
 * $126,000."* Publication 590-A's Table 1-2 groups "married filing jointly or
 * qualifying surviving spouse" on one row, and Worksheet 1-2's own lines 3
 * and 4 name that status in the $20,000/35%/40% branch.
 *
 * So the range is $20,000 for a QSS as well, and the two groups disagree
 * about QSS on purpose. Both docstrings say so, so that a reader who finds
 * one cannot copy it onto the other.
 *
 * ## `marriedFilingSeparately`'s `$0.00` is a real threshold, not a sentinel
 *
 * §219(g)(3)(B)(iii) sets the applicable dollar amount for a married
 * individual filing separately to zero, and Notice 2024-80 states it "is not
 * subject to an annual cost-of-living adjustment and remains $0". So the
 * phase-out runs from the first dollar of modified AGI to $10,000 — a
 * genuine `$0.00` threshold with a genuine range beside it, and NOT the
 * "this status is short-circuited" absence that
 * {@link studentLoanInterestDeduction} uses for the same status. §219(g)(4)
 * is what makes it survivable: a couple who lived apart for the whole year
 * are "not … treated as married individuals for purposes of this
 * subsection", and `fjs/schedule/1` routes such a filer to `single`.
 *
 * ## Two figures per status, never three — and no stored percentage
 *
 * Publication 590-A Worksheet 1-2 line 4 prints percentages (35%/40% for a
 * joint or QSS filer, 70%/80% for everyone else). **They are not stored**,
 * because they are `deductibleAmount / phaseoutRange` and
 * `(deductibleAmount + catchUpContribution) / phaseoutRange` exactly — a
 * stored percentage would be a fourth figure able to disagree with the three
 * the computation actually reads. The completely-phased-out end points
 * ($89,000, $146,000, $10,000) are likewise DERIVED, per the "two figures,
 * not three" position {@link studentLoanInterestDeduction} records;
 * `iraDeductionPhaseoutEndPointsAndPercentagesMatchPublication590A` asserts
 * the derived values against hand-typed ones.
 *
 * ## Citation kind
 *
 * `kind: 'code'`, §219's own subsections — the same "governing provision, not
 * the literal source" position {@link studentLoanInterestDeduction} takes.
 * §219(b)(5) and §219(g)(2)/(g)(3) genuinely are where these limits, this
 * mechanism and these applicable dollar amounts live; what §219 does not
 * contain is the TY2025 indexed figures, which come from IRS Notice 2024-80
 * and are reprinted in Publication 590-A Tables 1-2/1-3.
 * @type {{
 *   readonly deductibleAmount: AmountWithCitation,
 *   readonly catchUpContribution: AmountWithCitation,
 *   readonly minimumPhasedOutLimit: AmountWithCitation,
 *   readonly roundingIncrement: AmountWithCitation,
 *   readonly phaseoutThreshold: {
 *     readonly single: AmountWithCitation,
 *     readonly marriedFilingSeparately: AmountWithCitation,
 *     readonly headOfHousehold: AmountWithCitation,
 *     readonly qualifyingSurvivingSpouse: AmountWithCitation,
 *   },
 *   readonly phaseoutRange: {
 *     readonly single: AmountWithCitation,
 *     readonly marriedFilingSeparately: AmountWithCitation,
 *     readonly headOfHousehold: AmountWithCitation,
 *     readonly qualifyingSurvivingSpouse: AmountWithCitation,
 *   },
 * }}
 */
export const iraDeduction = {
    deductibleAmount: {
        amount: '7000.00',
        citation: { kind: 'code', section: '§219(b)(5)(A)', effectiveDate: '2025-01-01' },
    },
    // §219(b)(5)(B)(ii)'s "applicable amount" for an individual who attains
    // age 50 before the close of the taxable year. **No document in this
    // repository carries a birth date**, so `fjs/schedule/1` never assumes
    // either answer: it computes the deduction against BOTH limits and
    // refuses only when the two disagree.
    catchUpContribution: {
        amount: '1000.00',
        citation: { kind: 'code', section: '§219(b)(5)(B)(ii)', effectiveDate: '2025-01-01' },
    },
    // §219(g)(2)(B), "No reduction below $200 until complete phase-out": a
    // partially phased-out limit is never between $1 and $199. It is either
    // at least $200 or exactly zero, and zero only when the un-floored
    // computation was already zero.
    minimumPhasedOutLimit: {
        amount: '200.00',
        citation: { kind: 'code', section: '§219(g)(2)(B)', effectiveDate: '2025-01-01' },
    },
    // §219(g)(2)(C) rounds "any amount determined under this paragraph" — the
    // REDUCTION — to the next LOWEST $10. Subtracting a reduction rounded
    // down rounds the surviving limit UP, which is the direction Publication
    // 590-A Worksheet 1-2 line 4 states ("round it to the next highest
    // multiple of $10. (For example, $611.40 is rounded to $620.)").
    // `fjs/schedule/1` implements the worksheet's direction on the surviving
    // limit; both are the same rule read from opposite ends.
    roundingIncrement: {
        amount: '10.00',
        citation: { kind: 'code', section: '§219(g)(2)(C)', effectiveDate: '2025-01-01' },
    },
    phaseoutThreshold: {
        single: {
            amount: '79000.00',
            citation: { kind: 'code', section: '§219(g)(3)(B)(ii)', effectiveDate: '2025-01-01' },
        },
        marriedFilingSeparately: {
            amount: '0.00',
            citation: { kind: 'code', section: '§219(g)(3)(B)(iii)', effectiveDate: '2025-01-01' },
        },
        // Publication 590-A Table 1-2 groups "single or head of household" on
        // one row, so this carries the same figure as `single`. Hand-typed
        // per status anyway, never spread from it, for the reason
        // `standardDeduction` states: a spread makes two statuses impossible
        // to observe drifting apart.
        headOfHousehold: {
            amount: '79000.00',
            citation: { kind: 'code', section: '§219(g)(3)(B)(ii)', effectiveDate: '2025-01-01' },
        },
        qualifyingSurvivingSpouse: {
            amount: '126000.00',
            citation: { kind: 'code', section: '§219(g)(3)(B)(i)', effectiveDate: '2025-01-01' },
        },
    },
    // §219(g)(2)(A)(ii)'s divisor: "$10,000 ($20,000 in the case of a joint
    // return)". A qualifying surviving spouse takes the $20,000 figure on
    // Publication 590-A Worksheet 1-2's own authority — see this group's
    // docstring, which is also where §219(g)(7)(B)'s $10,000 override for a
    // non-covered spouse ON a joint return is recorded.
    phaseoutRange: {
        single: {
            amount: '10000.00',
            citation: { kind: 'code', section: '§219(g)(2)(A)(ii)', effectiveDate: '2025-01-01' },
        },
        marriedFilingSeparately: {
            amount: '10000.00',
            citation: { kind: 'code', section: '§219(g)(2)(A)(ii)', effectiveDate: '2025-01-01' },
        },
        headOfHousehold: {
            amount: '10000.00',
            citation: { kind: 'code', section: '§219(g)(2)(A)(ii)', effectiveDate: '2025-01-01' },
        },
        qualifyingSurvivingSpouse: {
            amount: '20000.00',
            citation: { kind: 'code', section: '§219(g)(2)(A)(ii)', effectiveDate: '2025-01-01' },
        },
    },
}

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
 * **Schedule SE's four parameters** — §1402(b)(2)'s $400 floor, §1402(b)(1)'s
 * Social Security wage base, §1401's two rates and §164(f)(1)'s half. TAX-31,
 * Phase 28.
 *
 * Phase 27 stored ONE of these, the $400 floor, and its docstring said
 * plainly why the other three were absent: *"a rate would be a parameter with
 * no reader"*, because that phase refused self-employment tax rather than
 * computing it. Phase 28 supplies the reader — `fjs/schedule/se` — and the
 * three arrive with it, in the same commit, exactly as
 * {@link additionalMedicareTaxRates}' own 0.9% arrived beside Form 8959.
 *
 * ## The four figures, and which of them moves with inflation
 *
 * **`minimumNetEarnings` — $400, §1402(b)(2), NOT indexed.** *"…the term 'net
 * earnings from self-employment' [shall not include] …if such net earnings
 * for the taxable year are less than $400."* It has read $400 since 1990.
 * Schedule SE line 4c is the printed line that applies it, and it applies it
 * to NET EARNINGS — 92.35% of net profit — never to net profit itself. Phase
 * 27's `fjs/schedule/c` deliberately compared it against net PROFIT because
 * applying the 92.35% factor would have been computing Schedule SE; Phase 28
 * computes Schedule SE, so that over-approximation is gone and the comparison
 * now happens where the printed form puts it.
 *
 * **`socialSecurityWageBase` — $176,100, INDEXED, and the only figure in this
 * group that moves.** §1402(b)(1) caps the amount of combined wages and
 * self-employment earnings subject to the Social Security portion at *"the
 * contribution and benefit base (as determined under section 230 of the
 * Social Security Act)"*. That base is set each year by the Social Security
 * Administration, not by an IRS Revenue Procedure: $160,200 (2023), $168,600
 * (2024), $176,100 (2025). **This figure is TY2025's and TY2025's alone**, and
 * a second tax year added to {@link taxParamsByYear} must carry its own —
 * the same warning {@link studentLoanInterestDeduction} carries, and the
 * OPPOSITE of the two rates below it.
 *
 * Its citation is `kind: 'code'` at §1402(b)(1), which is the GOVERNING
 * PROVISION rather than the literal source of the digits — precisely the
 * position {@link qualifiedCharitableDistribution} already records for its own
 * two limits, whose figures likewise come off a printed page rather than out
 * of the cited section. Naming a Revenue Procedure here would be worse than
 * imprecise: no Revenue Procedure sets this base, and inventing a number for
 * one is the sourcing error this module's own header exists to prevent.
 *
 * **`rates` — 12.4% and 2.9%, §1401(a) and §1401(b), NOT indexed.** Both are
 * written into the statute and neither has moved since 1990. Stored in BASIS
 * POINTS for the exactness reason {@link additionalMedicareTaxRates} states in
 * full: 12.4 and 2.9 are not whole numbers of percent, and neither `0.124` nor
 * `0.029` is exact as an IEEE 754 double. One shared `citation` for the two,
 * because §1401 is one section with a subsection per rate — the same shape,
 * for the same reason, as {@link additionalMedicareTaxRates}' §3101(b).
 *
 * **`deductibleHalf` — 50%, §164(f)(1), NOT indexed.** Schedule SE line 13,
 * which reaches Schedule 1 line 15. A WHOLE number of percent, so
 * `ratePercent` rather than basis points — this module's own stated rule, and
 * the reason the field name differs from its neighbour's.
 *
 * ## What is deliberately NOT stored: the 92.35% factor
 *
 * Schedule SE line 4a prints *"multiply line 3 by 92.35% (0.9235)"*, and this
 * group does not store 9235. **It is derivable from the two rates above, and
 * §1402(a)(12) is the provision that derives it**: the deduction it allows is
 * *"the product of the taxpayer's net earnings from self-employment
 * (determined without regard to this paragraph) and one-half of the sum of
 * the rates imposed by subsections (a) and (b) of section 1401"* — half of
 * 12.4% + 2.9% is 7.65%, and 100% − 7.65% = 92.35%.
 *
 * So a stored 9235 would be a SECOND copy of a rule these two rates already
 * fix, and the two copies could disagree. `fjs/schedule/se`'s own
 * `netEarningsFactorBasisPoints` performs §1402(a)(12)'s arithmetic on the
 * rates below, and that module's `theNinetyTwoPointThreeFiveFactorIsDerived\
 * FromTheTwoRatesRatherThanStored` leaf checks the result against the printed
 * page's own 0.9235. That is the AGENTS.md idiom — the hand-typed figure
 * exists and something COMPARES it — applied to a rate rather than to a list.
 * @type {{
 *   readonly minimumNetEarnings: AmountWithCitation,
 *   readonly socialSecurityWageBase: AmountWithCitation,
 *   readonly rates: {
 *     readonly oldAgeSurvivorsAndDisabilityInsuranceBasisPoints: number,
 *     readonly hospitalInsuranceBasisPoints: number,
 *     readonly citation: Citation,
 *   },
 *   readonly deductibleHalf: {
 *     readonly ratePercent: number,
 *     readonly citation: Citation,
 *   },
 * }}
 */
export const selfEmploymentTax = {
    minimumNetEarnings: {
        amount: '400.00',
        citation: { kind: 'code', section: '§1402(b)(2)', effectiveDate: '2025-01-01' },
    },
    // The ONE figure in this group that moves with inflation -- see this
    // group's own docstring. Schedule SE line 7 prints it.
    socialSecurityWageBase: {
        amount: '176100.00',
        citation: { kind: 'code', section: '§1402(b)(1)', effectiveDate: '2025-01-01' },
    },
    rates: {
        // 12.4% -- §1401(a), old-age, survivors, and disability insurance.
        // Schedule SE line 10 multiplies by it, and it is the ONLY one of the
        // two the wage base caps.
        oldAgeSurvivorsAndDisabilityInsuranceBasisPoints: 1240,
        // 2.9% -- §1401(b)(1), hospital insurance. Schedule SE line 11
        // multiplies by it, and it is UNCAPPED: there is no wage base for the
        // Medicare portion, which is why line 11 reads line 6 directly rather
        // than the `min` line 10 takes.
        hospitalInsuranceBasisPoints: 290,
        citation: { kind: 'code', section: '§1401', effectiveDate: '2025-01-01' },
    },
    deductibleHalf: {
        // 50% -- §164(f)(1). Schedule SE line 13 -> Schedule 1 line 15.
        ratePercent: 50,
        citation: { kind: 'code', section: '§164(f)(1)', effectiveDate: '2025-01-01' },
    },
}

/**
 * **§199A's qualified business income deduction** — the 20% rate and the
 * per-status threshold above which Form 8995 stops applying and Form 8995-A
 * takes over. TAX-32, Phase 28.
 *
 * ## The rate is a WHOLE percent, unlike its two neighbours
 *
 * §199A(b)(2)(A) and §199A(a)(1)(B) both read *"20 percent"*, and
 * §199A(b)(3)/(e) never fractionalise it. So `ratePercent: 20` rather than
 * basis points — this module's own rule ("a rate that is a whole number of
 * percent is exact as a `number`"), and the reason this group's field name
 * differs from {@link selfEmploymentTax}' `...BasisPoints` immediately above.
 * Form 8995 multiplies by it on lines 5, 9 and 14; all three read this ONE
 * field, so the three printed lines cannot drift apart.
 *
 * ## The threshold is INDEXED, and it is stored rather than derived
 *
 * §199A(e)(2)(A) sets $157,500 ($315,000 for a joint return) and
 * §199A(e)(2)(B) inflation-adjusts both every year. TY2025's are $197,300 and
 * $394,600, and a second tax year added to {@link taxParamsByYear} must carry
 * its own — the {@link studentLoanInterestDeduction} warning again, not
 * {@link additionalMedicareTaxThreshold}'s "no Revenue Procedure adjusts
 * them".
 *
 * **Four of these five figures are identical, today, to the 24%-bracket
 * ceilings already stored in {@link ordinaryBrackets} — and they are stored
 * anyway. The fifth is not identical at all, which is the whole argument.**
 *
 * The agreement is not an accident of drafting: TCJA set §199A's 2018
 * threshold at the same $157,500/$315,000 where the 24% bracket ended, and
 * both have been indexed from that base ever since. But they are indexed
 * SEPARATELY, by two provisions with their own rounding rules (§1(f)(3) for
 * the brackets, §199A(e)(2)(B) for this), so nothing makes them stay equal.
 *
 * And for a **qualifying surviving spouse they are already $197,300 apart
 * TODAY**: that status reads the JOINT rate schedule (§1(a), via §2(a)), so
 * its 24% bracket ends at $394,600 — while §199A(e)(2)(A) doubles its
 * threshold only *"in the case of a taxpayer filing a joint return"*, which a
 * surviving spouse is not, so §199A gives that status the general $197,300.
 * **This is the §3101(b)(2)-versus-§1411(b) trap for the third time in this
 * module**, and the third time it lands on qualifying surviving spouse:
 * §1411(b)(1) writes "or a surviving spouse" into the statute and §3101(b)(2)
 * does not, and §199A(e)(2) does not either. A derivation from the bracket
 * ceiling would have silently doubled a widow(er)'s §199A threshold and let
 * a return that must use Form 8995-A compute on Form 8995 instead.
 *
 * `theThresholdCoincidesWithTheBracketCeilingForFourStatusesAndNotForTheFifth`
 * is the leaf that states both halves. **If its first half reddens, that is
 * information rather than a defect**: one of the two moved, and a reader has
 * to find out which. The SDTW's own line-19 breakpoint is the opposite case
 * and IS derived from the bracket ceiling, because §1(h)(1)(A)(ii) defines it
 * *by reference to* "the dollar amount at which the 32-percent bracket
 * begins". §199A(e)(2) contains no such reference.
 *
 * **`marriedFilingSeparately` gets the non-joint figure**, $197,300, not half
 * of the joint one — the general rule applies at its FULL amount, the
 * opposite of §1411(b)(2)'s explicit halving one parameter group up.
 * Hand-typed per status anyway, never spread from `single`, for the reason
 * {@link standardDeduction} records.
 *
 * ## Citation kind
 *
 * `kind: 'code'` at §199A(e)(2), the governing provision — the same position
 * {@link qualifiedCharitableDistribution} records. The TY2025 digits are the
 * inflation-adjusted amounts an annual Revenue Procedure publishes, and this
 * project has NOT verified which section of Rev. Proc. 2024-40 carries them
 * against the PDF itself. Naming a section that was not read would be the
 * precise sourcing error this module's header exists to prevent, and it is
 * strictly worse than citing the statute that governs the figure.
 *
 * ## `phaseInRange` — §199A's OTHER dollar figure, and it is NOT a ratio of
 * the threshold (TAX-32, Phase 31, `fjs/form8995a`)
 *
 * Above the threshold the deduction does not stop; it phases. Form 8995-A's
 * **printed line 23** (Part III, the W-2-wage/UBIA phase-in) and **Schedule A
 * (Form 8995-A)'s printed line 8** (the specified-service phase-in) both read
 * *"Enter $50,000 ($100,000 if married filing jointly)"*, and each is the
 * DENOMINATOR of a phase-in percentage whose numerator is
 * `taxable income − threshold`. Both pages were fetched and transcribed
 * (2026-08-17) rather than recalled.
 *
 * **It is stored, never derived, and the arithmetic is what proves it must
 * be.** 25% of $197,300 is $49,325, and 25.34...% would be a fraction nothing
 * states — so the range is not a percentage of the threshold. The two figures
 * are set by different provisions and move for different reasons:
 *
 * | Figure | Provision | Indexed? |
 * |---|---|---|
 * | threshold, $197,300 / $394,600 | §199A(e)(2)(A), adjusted by (e)(2)(B) | YES, annually |
 * | phase-in range, $50,000 / $100,000 | §199A(b)(3)(B)(ii), §199A(d)(3)(B) | **NO adjustment clause exists** |
 *
 * §199A(e)(2)(B) inflation-adjusts "the $157,500 amount in subparagraph (A)"
 * and nothing else. The range's own subparagraphs state their dollars flat,
 * with no cost-of-living sentence anywhere near them — which is why a figure
 * derived from the threshold would have drifted the moment the threshold was
 * indexed and the range was not. **The printed page confirms the direction**:
 * $247,300 − $197,300 = $50,000 exactly (line 23's own upper bound, printed in
 * Part III's own "more than $197,300 but not $247,300"), and
 * $494,600 − $394,600 = $100,000 exactly.
 *
 * `theRangeIsStoredRatherThanDerivedFromTheThreshold` is the leaf that states
 * both halves: the range is the printed figure, and it is NOT 25% of the
 * threshold. **If the second half ever reddens, a derivation has crept in.**
 *
 * The joint figure IS double here, unlike {@link thresholdAmount}'s, and for a
 * reason worth separating: §199A(b)(3)(B)(ii) writes "$100,000 in the case of a
 * joint return" as its own literal rather than as "200 percent of such
 * amount". So a qualifying surviving spouse gets the $50,000 range for the same
 * reason it gets the $197,300 threshold — it does not file a joint return —
 * and each status is hand-typed rather than spread, exactly as above.
 *
 * Citation `kind: 'code'` at **§199A(b)(3)(B)** rather than at §199A(e)(2):
 * (e)(2) defines the threshold and says nothing about a range. Schedule A's
 * copy of the same figure governs under §199A(d)(3), named in the per-status
 * comments — one figure, two provisions that happen to state it identically,
 * which is a fact about the statute rather than a shortcut taken here.
 * @type {{
 *   readonly ratePercent: number,
 *   readonly rateCitation: Citation,
 *   readonly thresholdAmount: Record<IndividualFilingStatus, AmountWithCitation>,
 *   readonly phaseInRange: Record<IndividualFilingStatus, AmountWithCitation>,
 * }}
 */
export const qualifiedBusinessIncomeDeduction = {
    // 20% -- §199A(a)(1)(B)/(b)(2)(A). Form 8995 lines 5, 9 and 14.
    ratePercent: 20,
    rateCitation: { kind: 'code', section: '§199A(b)(2)(A)', effectiveDate: '2025-01-01' },
    thresholdAmount: {
        single: {
            amount: '197300.00',
            citation: { kind: 'code', section: '§199A(e)(2)', effectiveDate: '2025-01-01' },
        },
        marriedFilingJointly: {
            amount: '394600.00',
            citation: { kind: 'code', section: '§199A(e)(2)(B)', effectiveDate: '2025-01-01' },
        },
        // The general rule's figure, NOT half the joint one -- see this
        // group's own docstring.
        marriedFilingSeparately: {
            amount: '197300.00',
            citation: { kind: 'code', section: '§199A(e)(2)', effectiveDate: '2025-01-01' },
        },
        headOfHousehold: {
            amount: '197300.00',
            citation: { kind: 'code', section: '§199A(e)(2)', effectiveDate: '2025-01-01' },
        },
        // See this group's own docstring: §199A(e)(2)(A) doubles the
        // threshold only for "a taxpayer filing a joint return", and a
        // surviving spouse does not file one -- so this status gets the
        // general $197,300 even though its BRACKETS are the joint schedule's
        // and its 24% ceiling is $394,600. The same trap §3101(b)(2) and
        // §1411(b)(1) already disagree about, one status at a time.
        qualifyingSurvivingSpouse: {
            amount: '197300.00',
            citation: { kind: 'code', section: '§199A(e)(2)', effectiveDate: '2025-01-01' },
        },
    },
    // Form 8995-A printed line 23, and Schedule A (Form 8995-A) printed line 8,
    // both transcribed from the fetched pages: "Enter $50,000 ($100,000 if
    // married filing jointly)". NEVER derived from the threshold above -- see
    // this group's own docstring for why 25% of $197,300 = $49,325 is the
    // arithmetic that settles it.
    phaseInRange: {
        single: {
            amount: '50000.00',
            citation: { kind: 'code', section: '§199A(b)(3)(B)(ii)', effectiveDate: '2025-01-01' },
        },
        // "$100,000 in the case of a joint return" -- its OWN literal in the
        // statute, not "200 percent of such amount" as §199A(e)(2)(A) writes
        // the threshold's doubling.
        marriedFilingJointly: {
            amount: '100000.00',
            citation: { kind: 'code', section: '§199A(b)(3)(B)(ii)', effectiveDate: '2025-01-01' },
        },
        // Separately, jointly, and not at all are three different filings, and
        // only the joint one gets $100,000. MFS takes the general figure at its
        // FULL amount, mirroring the threshold row above it.
        marriedFilingSeparately: {
            amount: '50000.00',
            citation: { kind: 'code', section: '§199A(b)(3)(B)(ii)', effectiveDate: '2025-01-01' },
        },
        headOfHousehold: {
            amount: '50000.00',
            citation: { kind: 'code', section: '§199A(b)(3)(B)(ii)', effectiveDate: '2025-01-01' },
        },
        // A surviving spouse does not FILE a joint return, so the $100,000
        // literal does not reach it -- the same reading that gives this status
        // the general $197,300 threshold one group up.
        qualifyingSurvivingSpouse: {
            amount: '50000.00',
            citation: { kind: 'code', section: '§199A(b)(3)(B)(ii)', effectiveDate: '2025-01-01' },
        },
    },
}

/**
 * **§55's alternative minimum tax** — the exemption, its phase-out, and the
 * two rates. TAX-33, Phase 29, for `fjs/form6251`.
 *
 * Source, fetched and read directly (2026-08-16), not from recall:
 * `https://www.irs.gov/pub/irs-drop/rp-24-40.pdf` §2.11, which carries every
 * dollar figure below in three printed tables; cross-checked against
 * `https://www.irs.gov/pub/irs-pdf/f6251.pdf` (2025, "Created 9/17/25"),
 * whose own line 5 chart and line 7 bullet print the same numbers on the face
 * of the form, and against `i6251.pdf` (2025, `Jan 8, 2026`), whose Exemption
 * Worksheet prints the complete-phase-out amounts.
 *
 * ## Rev. Proc. 2025-32 does NOT touch these, and that had to be checked
 *
 * {@link standardDeduction} cites Rev. Proc. **2025-32** because the OBBBA
 * revised it mid-year, and copying that reasoning here would be wrong.
 * Rev. Proc. 2025-32's own "SECTION 3. 2025 ADJUSTED ITEMS AS MODIFIED,
 * SUPERSEDED OR SUPPLEMENTED" removes exactly two sections of Rev. Proc.
 * 2024-40 — §2.15(1), the standard deduction, and §2.25, the §179 expensing
 * election. §2.11 is not among them, so Rev. Proc. 2024-40 is still the
 * governing TY2025 authority for every figure here. **The OBBBA does amend
 * §55(d)**: its §70107 makes the increased exemption permanent and resets the
 * phase-out thresholds, but Rev. Proc. 2025-32 §2.07's own words are *"for
 * any taxable year beginning before January 1, 2027"* for the new $1,000,000
 * figure, and its AMT table is printed under "SECTION 4. **2026** ADJUSTED
 * ITEMS". None of it reaches TY2025. A second tax year added to
 * {@link taxParamsByYear} must carry Rev. Proc. 2025-32 §4.10's figures and a
 * phase-out rate that is no longer 25%.
 *
 * ## `exemptionCompletePhaseout` is STORED, not derived, and something
 * compares it
 *
 * The third column is arithmetically redundant: a complete phase-out amount
 * is the threshold plus four times the exemption, because 25 cents of
 * exemption goes for every dollar of excess. It is stored anyway, for two
 * reasons that are not tidiness.
 *
 * It is a figure the IRS PRINTS — Rev. Proc. 2024-40 §2.11's own
 * "Complete Phaseout Amount" column, and the Exemption Worksheet's own
 * opening note ("If Form 6251, line 4, is equal to or more than $978,750 …
 * your exemption is zero") — so storing it keeps this module a transcription
 * of what was read rather than a mix of transcription and arithmetic. And it
 * has a SECOND reader that is not the phase-out at all: the married-filing-
 * separately AMTI add-back at Form 6251 line 4, whose own threshold is the
 * MFS complete-phase-out amount ($900,350) and whose cap is the MFS exemption
 * ($68,500) — see `fjs/form6251`'s own line 4.
 *
 * `theCompletePhaseoutAmountsAgreeWithTheirOwnArithmetic` is what keeps the
 * redundancy honest: it COMPARES the stored third column against the first
 * two and the rate, per status. A hand-typed list that nothing compares
 * drifts (AGENTS.md); this one cannot drift without saying so.
 *
 * ## Head of household reads the UNMARRIED row, and qualifying surviving
 * spouse reads the JOINT one
 *
 * Rev. Proc. 2024-40 §2.11 prints four rows, and neither of the two names a
 * filing status this module keys by: *"Joint Returns or Surviving Spouses"*
 * and *"Unmarried Individuals (other than Surviving Spouses)"*. So head of
 * household — an unmarried individual who is not a surviving spouse — takes
 * $88,100/$626,350, and qualifying surviving spouse takes $137,000/$1,252,700.
 * Form 6251's own printed line 5 chart says the same in the other direction
 * ("Single or head of household … $88,100"; "Married filing jointly or
 * qualifying surviving spouse … $137,000"), which is the check that resolves
 * the mapping against paper rather than against memory.
 *
 * **This is the fourth time this module has had to decide what a qualifying
 * surviving spouse gets, and the FIRST three disagreed with each other**:
 * §3101(b)(2) gives it the single figure, §1411(b)(1) the joint one,
 * §199A(e)(2) the single one. Here it is the joint one, and it is written out
 * per status rather than spread from `marriedFilingJointly` for the reason
 * {@link standardDeduction} records.
 *
 * **The `estatesAndTrusts` row is deliberately absent**, even though
 * Rev. Proc. 2024-40 §2.11 prints one ($30,700 / $102,500 / $225,300). Form
 * 6251 is *Alternative Minimum Tax — Individuals*; an estate or trust
 * computes its AMT on Schedule I (Form 1041), which this engine does not
 * model at all. Keying by {@link IndividualFilingStatus} makes that boundary a
 * type rather than a comment — the same decision
 * {@link netInvestmentIncomeTaxThreshold} records one statute over.
 *
 * ## The two rates are whole percents, and the printed "$4,782" is NOT stored
 *
 * §55(b)(1)(A) writes "26 percent" and "28 percent", both whole numbers, so
 * they are `ratePercent` fields rather than basis points — this module's own
 * rule (see {@link additionalMedicareTaxRates} for the case that goes the
 * other way).
 *
 * Form 6251's line 7 prints the 28% branch as *"multiply line 6 by 28% (0.28)
 * and subtract $4,782 ($2,391 if married filing separately)"*. That constant
 * is nothing but `upperRateThreshold × (28 − 26)%` — $239,100 × 2% = $4,782,
 * and $119,550 × 2% = $2,391 — i.e. the printed form's way of writing a
 * two-bracket schedule as one multiplication. Storing it would be storing the
 * same fact twice, in a form that could drift from the threshold it is
 * derived from. `fjs/form6251` computes the two brackets directly instead, and
 * that module's own `theTwentySixTwentyEightScheduleMatchesThePrintedShortcut`
 * is the leaf that hand-types $4,782 and $2,391 and proves the two forms of
 * the rule agree.
 * @type {{
 *   readonly exemption: Record<IndividualFilingStatus, AmountWithCitation>,
 *   readonly exemptionPhaseoutThreshold: Record<IndividualFilingStatus, AmountWithCitation>,
 *   readonly exemptionCompletePhaseout: Record<IndividualFilingStatus, AmountWithCitation>,
 *   readonly exemptionPhaseoutRatePercent: number,
 *   readonly exemptionPhaseoutRateCitation: Citation,
 *   readonly lowerRatePercent: number,
 *   readonly upperRatePercent: number,
 *   readonly rateCitation: Citation,
 *   readonly upperRateThreshold: Record<IndividualFilingStatus, AmountWithCitation>,
 * }}
 */
export const alternativeMinimumTax = {
    // Rev. Proc. 2024-40 §2.11, first table -- "the exemption amounts under
    // § 55(d)(1)".
    exemption: {
        single: {
            amount: '88100.00',
            citation: { kind: 'revProc', revProc: '2024-40', section: '§2.11', effectiveDate: '2025-01-01' },
        },
        marriedFilingJointly: {
            amount: '137000.00',
            citation: { kind: 'revProc', revProc: '2024-40', section: '§2.11', effectiveDate: '2025-01-01' },
        },
        marriedFilingSeparately: {
            amount: '68500.00',
            citation: { kind: 'revProc', revProc: '2024-40', section: '§2.11', effectiveDate: '2025-01-01' },
        },
        // "Unmarried Individuals (other than Surviving Spouses)" -- see this
        // group's own docstring.
        headOfHousehold: {
            amount: '88100.00',
            citation: { kind: 'revProc', revProc: '2024-40', section: '§2.11', effectiveDate: '2025-01-01' },
        },
        // "Joint Returns or Surviving Spouses" -- the JOINT figure, unlike
        // §3101(b)(2) and §199A(e)(2), which both give this status the single
        // one.
        qualifyingSurvivingSpouse: {
            amount: '137000.00',
            citation: { kind: 'revProc', revProc: '2024-40', section: '§2.11', effectiveDate: '2025-01-01' },
        },
    },
    // Rev. Proc. 2024-40 §2.11, third table, "Threshold Phaseout Amount"
    // column -- "the amounts used under § 55(d)(2) to determine the phaseout
    // of the exemption amounts". Married filing separately shares the
    // UNMARRIED threshold here ($626,350) while taking half the exemption,
    // which is why its complete phase-out lands lower than anyone else's.
    exemptionPhaseoutThreshold: {
        single: {
            amount: '626350.00',
            citation: { kind: 'revProc', revProc: '2024-40', section: '§2.11', effectiveDate: '2025-01-01' },
        },
        marriedFilingJointly: {
            amount: '1252700.00',
            citation: { kind: 'revProc', revProc: '2024-40', section: '§2.11', effectiveDate: '2025-01-01' },
        },
        marriedFilingSeparately: {
            amount: '626350.00',
            citation: { kind: 'revProc', revProc: '2024-40', section: '§2.11', effectiveDate: '2025-01-01' },
        },
        headOfHousehold: {
            amount: '626350.00',
            citation: { kind: 'revProc', revProc: '2024-40', section: '§2.11', effectiveDate: '2025-01-01' },
        },
        qualifyingSurvivingSpouse: {
            amount: '1252700.00',
            citation: { kind: 'revProc', revProc: '2024-40', section: '§2.11', effectiveDate: '2025-01-01' },
        },
    },
    // Rev. Proc. 2024-40 §2.11, third table, "Complete Phaseout Amount"
    // column. Stored rather than derived, and compared against the
    // arithmetic -- see this group's own docstring.
    exemptionCompletePhaseout: {
        single: {
            amount: '978750.00',
            citation: { kind: 'revProc', revProc: '2024-40', section: '§2.11', effectiveDate: '2025-01-01' },
        },
        marriedFilingJointly: {
            amount: '1800700.00',
            citation: { kind: 'revProc', revProc: '2024-40', section: '§2.11', effectiveDate: '2025-01-01' },
        },
        // ALSO the married-filing-separately AMTI add-back threshold at Form
        // 6251 line 4 -- a second, unrelated reader of this one figure.
        marriedFilingSeparately: {
            amount: '900350.00',
            citation: { kind: 'revProc', revProc: '2024-40', section: '§2.11', effectiveDate: '2025-01-01' },
        },
        headOfHousehold: {
            amount: '978750.00',
            citation: { kind: 'revProc', revProc: '2024-40', section: '§2.11', effectiveDate: '2025-01-01' },
        },
        qualifyingSurvivingSpouse: {
            amount: '1800700.00',
            citation: { kind: 'revProc', revProc: '2024-40', section: '§2.11', effectiveDate: '2025-01-01' },
        },
    },
    // 25 cents of exemption for every dollar of AMTI above the threshold.
    // A WHOLE percent, so `ratePercent` rather than basis points.
    exemptionPhaseoutRatePercent: 25,
    // Rev. Proc. 2024-40 §2.11 names this provision by number in its own
    // sentence ("the amounts used under § 55(d)(2)"), which is where this
    // section reference was read rather than recalled.
    exemptionPhaseoutRateCitation: { kind: 'code', section: '§55(d)(2)', effectiveDate: '2025-01-01' },
    // §55(b)(1)(A): 26% on the first slice of the AMT base, 28% above it.
    lowerRatePercent: 26,
    upperRatePercent: 28,
    rateCitation: { kind: 'code', section: '§55(b)(1)(A)', effectiveDate: '2025-01-01' },
    // Rev. Proc. 2024-40 §2.11, second table -- "under § 55(b)(1), the excess
    // taxable income above which the 28 percent tax rate applies". The
    // Rev. Proc. prints exactly TWO rows, "Married Individuals Filing Separate
    // Returns" and "All Other Taxpayers", so the MFS figure is HALF and every
    // other status shares one amount. Written out per status regardless.
    upperRateThreshold: {
        single: {
            amount: '239100.00',
            citation: { kind: 'revProc', revProc: '2024-40', section: '§2.11', effectiveDate: '2025-01-01' },
        },
        marriedFilingJointly: {
            amount: '239100.00',
            citation: { kind: 'revProc', revProc: '2024-40', section: '§2.11', effectiveDate: '2025-01-01' },
        },
        // The one status the Rev. Proc.'s second table separates out, and the
        // only halved figure in this whole group.
        marriedFilingSeparately: {
            amount: '119550.00',
            citation: { kind: 'revProc', revProc: '2024-40', section: '§2.11', effectiveDate: '2025-01-01' },
        },
        headOfHousehold: {
            amount: '239100.00',
            citation: { kind: 'revProc', revProc: '2024-40', section: '§2.11', effectiveDate: '2025-01-01' },
        },
        qualifyingSurvivingSpouse: {
            amount: '239100.00',
            citation: { kind: 'revProc', revProc: '2024-40', section: '§2.11', effectiveDate: '2025-01-01' },
        },
    },
}

/**
 * Which of Form 8962 line 4's three printed federal-poverty-line tables
 * applies — the line's own checkbox, transcribed as a vocabulary rather than
 * as a state name.
 *
 * A STATE would be the wrong shape. i8962 p8, Line 4: *"If you moved during
 * 2025 and you lived in Alaska and/or Hawaii, or you are filing jointly and
 * you and your spouse lived in different states, use the table with the
 * higher dollar amounts for your family size."* So the taxpayer declares
 * which TABLE governs, which is a fact a state name does not determine.
 * @typedef {'contiguous48AndDistrictOfColumbia' | 'alaska' | 'hawaii'} FederalPovertyLineTable
 */

/**
 * The three tables {@link federalPovertyLine} carries, exported so consumers
 * iterate this list rather than hand-typing the same three names repeatedly —
 * {@link individualFilingStatuses}' own precedent.
 * @type {readonly FederalPovertyLineTable[]}
 */
export const federalPovertyLineTables = [
    'contiguous48AndDistrictOfColumbia',
    'alaska',
    'hawaii',
]

/**
 * Form 8962 line 4 — the federal poverty line, by tax family size and by
 * table. TAX-37.
 *
 * ## The year is the trap, and it is a PRIOR one
 *
 * **The 2025 Form 8962 uses the 2024 poverty guidelines.** Not a
 * simplification and not a lag this module is papering over — it is what the
 * printed instructions say, verbatim (i8962 p8, Line 4): *"(For 2025, the
 * 2024 federal poverty lines are used for this purpose and are shown
 * below.)"* §36B(d)(3)(B) is why: the poverty line is the one *"in effect on
 * the first day of the regular enrollment period"* for coverage in the tax
 * year, and open enrollment for 2025 coverage began in November 2024, when
 * the 2024 guidelines were the ones in effect.
 *
 * Reaching for 2025's figures instead would be silently wrong in the
 * direction that costs money: they are higher, so every household's line 5
 * percentage would come out LOWER, the applicable figure would fall, and the
 * credit would be overstated — which the taxpayer then repays with the
 * return. The figures below are checked digit-by-digit against the printed
 * Tables 1-1, 1-2 and 1-3, whose eight rows each are reproduced in this
 * module's own proof from the printed page rather than from this data.
 *
 * ## Shape: a first person and an increment, not eight rows
 *
 * The printed tables list family sizes 1 through 8 and then a footnote —
 * *"If your family size was more than 8 people, add $5,380 for each
 * additional person"* — which is the same arithmetic the eight printed rows
 * already are. Storing base-plus-increment stores the rule; storing eight
 * rows and a ninth number would store it twice and let the two disagree. The
 * proof below is what pins the pair against all eight printed rows of all
 * three tables, so the compression is verified rather than assumed.
 *
 * ## Citation kind: `'federalRegister'`, a FOURTH kind
 *
 * These figures are not an IRS Revenue Procedure's, not an Act of Congress's,
 * and not a bare Code section's. They are the Department of Health and Human
 * Services' annual poverty guidelines, published in the Federal Register —
 * 89 FR 2961, "Annual Update of the HHS Poverty Guidelines", HHS Office of
 * the Secretary, published 2024-01-17 (verified live against
 * federalregister.gov's own API, not recalled). §36B(d)(3)(A) is what makes
 * them a tax figure at all, by defining "poverty line" as the one in
 * §2110(c)(5) of the Social Security Act.
 *
 * Filing them under `kind: 'code'` would have avoided widening {@link Citation}
 * and would have named an authority that does not publish these numbers.
 * 13-CONTEXT.md Decision 5.2 widened the union twice before for exactly this
 * reason; this is the third time, and `effectiveDate` reads `'2025-01-01'` per
 * this module's header — the year the figure is APPLIED for, which is what
 * makes the prior-year sourcing visible in the data rather than only in prose.
 * @type {Record<FederalPovertyLineTable, {
 *   readonly firstPerson: AmountWithCitation,
 *   readonly eachAdditionalPerson: AmountWithCitation,
 * }>}
 */
export const federalPovertyLine = {
    contiguous48AndDistrictOfColumbia: {
        firstPerson: {
            amount: '15060.00',
            citation: { kind: 'federalRegister', federalRegister: '89 FR 2961', section: 'HHS Poverty Guidelines for 2024, 48 contiguous states and DC', effectiveDate: '2025-01-01' },
        },
        eachAdditionalPerson: {
            amount: '5380.00',
            citation: { kind: 'federalRegister', federalRegister: '89 FR 2961', section: 'HHS Poverty Guidelines for 2024, 48 contiguous states and DC', effectiveDate: '2025-01-01' },
        },
    },
    // Alaska and Hawaii are NOT the contiguous figure scaled — HHS publishes
    // them as separate schedules, and both the base and the increment differ.
    // Hand-typed per table for the reason `standardDeduction` states about
    // spreading one status's entry onto another.
    alaska: {
        firstPerson: {
            amount: '18810.00',
            citation: { kind: 'federalRegister', federalRegister: '89 FR 2961', section: 'HHS Poverty Guidelines for 2024, Alaska', effectiveDate: '2025-01-01' },
        },
        eachAdditionalPerson: {
            amount: '6730.00',
            citation: { kind: 'federalRegister', federalRegister: '89 FR 2961', section: 'HHS Poverty Guidelines for 2024, Alaska', effectiveDate: '2025-01-01' },
        },
    },
    hawaii: {
        firstPerson: {
            amount: '17310.00',
            citation: { kind: 'federalRegister', federalRegister: '89 FR 2961', section: 'HHS Poverty Guidelines for 2024, Hawaii', effectiveDate: '2025-01-01' },
        },
        eachAdditionalPerson: {
            amount: '6190.00',
            citation: { kind: 'federalRegister', federalRegister: '89 FR 2961', section: 'HHS Poverty Guidelines for 2024, Hawaii', effectiveDate: '2025-01-01' },
        },
    },
}

/**
 * One tier of §36B(b)(3)(A)'s applicable percentage table: the household
 * income band, as a whole percent of the federal poverty line, and the
 * percentage at each end of it, in HUNDREDTHS OF A PERCENTAGE POINT.
 *
 * Hundredths rather than a decimal, for {@link additionalMedicareTaxRates}'
 * own reason: 8.5 is not exact as an IEEE 754 double and 850 hundredths is.
 * `ceilingPercent` is `undefined` on the open-topped last tier — no sentinel,
 * matching {@link Bracket}'s own convention.
 * @typedef {{
 *   readonly floorPercent: number,
 *   readonly ceilingPercent: number | undefined,
 *   readonly initialHundredthsOfPercent: number,
 *   readonly finalHundredthsOfPercent: number,
 * }} ApplicablePercentageTier
 */

/**
 * Form 8962 line 7's *applicable figure* — IRC §36B(b)(3)(A), TAX-37.
 *
 * ## Six tiers reproduce all 252 printed rows of Table 2, exactly
 *
 * The instructions print a lookup table with a row for every whole percent
 * from "less than 150" to "400 or more". The statute prints six tiers and an
 * interpolation rule: §36B(b)(3)(A)(i) says the applicable percentage
 * *"increases on a sliding scale in a linear manner"* from the initial to the
 * final percentage across each income tier.
 *
 * The tiers below, interpolated linearly and rounded HALF-UP to four decimal
 * places, were checked against every one of the 252 printed rows extracted
 * from i8962 Table 2: **zero mismatches, and no printed row unaccounted
 * for.** That check is what makes six stored tiers legitimate in place of 252
 * transcribed rows, and this module's own proof re-runs a hand-typed sample of
 * those printed rows — including every tier boundary — against the
 * interpolation, so the equivalence is proven here rather than asserted here.
 *
 * ## These are ARPA's tiers, and they are the reason there is still a credit
 * above 400%
 *
 * §36B(b)(3)(A)(iii), as added by ARPA §9661 and extended by IRA §12001,
 * replaces the ordinary table *"in the case of a taxable year beginning after
 * December 31, 2020, and before January 1, 2026"* — which includes TY2025 and
 * excludes TY2026. Two consequences a reader must not carry forward:
 *
 * - **The subsidy cliff is gone for 2025.** The top tier has a floor of 400
 *   and no ceiling, so a household above 400% of the poverty line still has an
 *   applicable figure (8.5%) and can still take a credit. The pre-ARPA table
 *   simply stopped, and above 400% the credit was zero.
 * - **§36B(b)(3)(A)(ii)'s inflation indexing does not apply for these years**,
 *   which is why no Revenue Procedure adjusts these figures and the citation
 *   below is `kind: 'code'`.
 *
 * **Form 8962's REPAYMENT limitation table disagrees with this one about what
 * 400% means, and both are transcribed as printed.** Here, 400 and above is a
 * tier with a percentage; in {@link premiumTaxCreditRepaymentLimitation}, 400
 * and above is where the limitation stops existing. The two tables are not
 * two views of one boundary and must never be merged.
 * @type {{
 *   readonly tiers: readonly ApplicablePercentageTier[],
 *   readonly citation: Citation,
 * }}
 */
export const premiumTaxCreditApplicablePercentage = {
    tiers: [
        // "Up to 150.0 percent — initial 0.0, final 0.0". Table 2 prints this
        // as the single row "less than 150" plus the row "150".
        { floorPercent: 0, ceilingPercent: 150, initialHundredthsOfPercent: 0, finalHundredthsOfPercent: 0 },
        { floorPercent: 150, ceilingPercent: 200, initialHundredthsOfPercent: 0, finalHundredthsOfPercent: 200 },
        { floorPercent: 200, ceilingPercent: 250, initialHundredthsOfPercent: 200, finalHundredthsOfPercent: 400 },
        { floorPercent: 250, ceilingPercent: 300, initialHundredthsOfPercent: 400, finalHundredthsOfPercent: 600 },
        { floorPercent: 300, ceilingPercent: 400, initialHundredthsOfPercent: 600, finalHundredthsOfPercent: 850 },
        // Open-topped: `ceilingPercent` is `undefined`, never a large
        // sentinel. Worksheet 2 caps line 5 at 401 anyway, but the tier is
        // written as the statute writes it.
        { floorPercent: 400, ceilingPercent: undefined, initialHundredthsOfPercent: 850, finalHundredthsOfPercent: 850 },
    ],
    citation: { kind: 'code', section: '§36B(b)(3)(A)(iii)', effectiveDate: '2025-01-01' },
}

/**
 * One band of Form 8962 Table 5: the household-income ceiling (as a whole
 * percent of the federal poverty line, EXCLUSIVE) and the two limitation
 * amounts.
 *
 * `single` and `other` rather than a full {@link IndividualFilingStatus} map,
 * because the printed table has exactly two columns and Rev. Proc. 2024-40
 * §2.07 spells the first as *"unmarried individuals (other than surviving
 * spouses and heads of household)"*. Modelling it as five statuses would
 * invent four figures the source does not print.
 * @typedef {{
 *   readonly povertyLinePercentCeiling: number,
 *   readonly single: string,
 *   readonly other: string,
 * }} RepaymentLimitationBand
 */

/**
 * Form 8962 line 28 — the limitation on the tax imposed for excess advance
 * payments. IRC §36B(f)(2)(B), Rev. Proc. 2024-40 §2.07, TAX-37.
 *
 * ## At and above 400% there is NO limitation, and that is the whole risk
 *
 * There are THREE bands, not four, and the missing fourth is deliberate.
 * i8962 p17, Line 28: *"If your entry on Form 8962, line 5, is 400 or more,
 * there is no repayment limitation. You must repay the amount shown on line
 * 27. Leave line 28 blank and enter the amount from line 27 on line 29."*
 *
 * A fourth band carrying a large sentinel would look harmless and would be a
 * silent UNDERSTATEMENT of tax for exactly the population with the largest
 * excess advance payments — a household that reported a low income at
 * enrollment and finished the year above 400% of the poverty line can owe the
 * entire year's advance back, with no cap at all. `fjs/form8962` therefore
 * treats "no band matched" as "no limitation", never as "zero".
 *
 * ## Only `single` reads the left column
 *
 * Form 8962 Table 5 heads its two columns "for a filing status of Single" and
 * "for any other filing status", and Rev. Proc. 2024-40 §2.07 makes the
 * exclusion explicit: *"unmarried individuals (other than surviving spouses
 * and heads of household)"*. So head of household and qualifying surviving
 * spouse take the LARGER figure.
 *
 * **This is the opposite direction from
 * {@link additionalMedicareTaxThreshold}, where a qualifying surviving spouse
 * takes the smaller amount because §3101(b)(2)(A) speaks only of a joint
 * return.** Two statutes, two answers for the same status, and copying either
 * one onto the other is a silent wrong number. Read the printed table.
 *
 * Married filing separately reads the right column too — and the limitation
 * *"appl[ies] to you and your spouse separately based on the household income
 * reported on each return"* (i8962 p17). That is only reachable for a filer
 * who qualifies for one of §36B(c)(1)(C)'s exceptions, which `fjs/form8962`
 * refuses on; the row is stored as printed anyway rather than omitted,
 * because a parameter table is a transcription of a page.
 *
 * `kind: 'revProc'`: §36B(f)(2)(B)(ii) inflation-adjusts these amounts, and
 * Rev. Proc. 2024-40 §2.07 is where TY2025's come from.
 * @type {{
 *   readonly bands: readonly RepaymentLimitationBand[],
 *   readonly citation: Citation,
 * }}
 */
export const premiumTaxCreditRepaymentLimitation = {
    bands: [
        { povertyLinePercentCeiling: 200, single: '375.00', other: '750.00' },
        { povertyLinePercentCeiling: 300, single: '975.00', other: '1950.00' },
        { povertyLinePercentCeiling: 400, single: '1625.00', other: '3250.00' },
    ],
    citation: { kind: 'revProc', revProc: '2024-40', section: '§2.07', effectiveDate: '2025-01-01' },
}

/**
 * §21(c)'s ceiling on the work-related expenses the credit may be figured on
 * — Form 2441's own lines 3 and 27, which print the two amounts twice each.
 *
 * TWO amounts and not a per-person multiplier: §21(c) reads *"$3,000 if there
 * is 1 qualifying individual ... $6,000 if there are 2 or more"*, and stops.
 * Three qualifying persons is $6,000, not $9,000, and a reader who models this
 * as `$3,000 x count` gets the two-person case right and every larger family
 * wrong.
 *
 * **Zero qualifying persons is not a stored row**, because the printed page
 * has none: a filer with no qualifying person cannot take the credit at all.
 * `fjs/form2441` supplies the $0 that follows and says so at the site.
 * @type {{
 *   readonly oneQualifyingPerson: AmountWithCitation,
 *   readonly twoOrMoreQualifyingPersons: AmountWithCitation,
 * }}
 */
export const dependentCareExpenseLimit = {
    oneQualifyingPerson: {
        amount: '3000.00',
        citation: { kind: 'code', section: '§21(c)(1)', effectiveDate: '2025-01-01' },
    },
    twoOrMoreQualifyingPersons: {
        amount: '6000.00',
        citation: { kind: 'code', section: '§21(c)(2)', effectiveDate: '2025-01-01' },
    },
}

/**
 * One printed row of Form 2441 line 8's decimal-amount table: the adjusted
 * gross income the row runs up to (INCLUSIVE — the printed column head is
 * *"But not over"*), and the applicable percentage in whole percentage points.
 *
 * `adjustedGrossIncomeCeiling` is `undefined` on the last row, never a large
 * sentinel, exactly as {@link ApplicablePercentageTier}'s `ceilingPercent` is:
 * the printed row reads *"43,000 — No limit"*, and a sentinel would be a
 * ceiling the first time anybody compared against it.
 *
 * `percent` is a whole number because the printed column carries exactly two
 * decimal places of a fraction (`.35`) and never a third. Stored as 35 rather
 * than as 0.35 for {@link netInvestmentIncomeTaxRateBasisPoints}' own reason:
 * money here is exact integer arithmetic, and a fraction in a parameter table
 * is a float waiting to happen.
 * @typedef {{
 *   readonly adjustedGrossIncomeCeiling: string | undefined,
 *   readonly percent: number,
 * }} DependentCarePercentageBand
 */

/**
 * Form 2441 line 8 — §21(a)(2)'s applicable percentage, all sixteen printed
 * rows transcribed.
 *
 * ## Sixteen rows rather than the formula, and the formula rather than the rows
 *
 * §21(a)(2) states it as arithmetic: 35 percent *"reduced (but not below 20
 * percent) by 1 percentage point for each $2,000 (or fraction thereof) by
 * which the taxpayer's adjusted gross income for the taxable year exceeds
 * $15,000."* The form prints the sixteen rows that arithmetic produces.
 *
 * The ROWS are stored, unlike {@link premiumTaxCreditApplicablePercentage}'s
 * six interpolated tiers, and the difference is not a matter of taste: that
 * table's printed form has 252 rows and storing them would be a transcription
 * error waiting to happen, while this one has sixteen and fits on the page
 * whole. A stored row cannot be wrong about its own fraction-of-$2,000
 * rounding, which is the part of §21(a)(2) a formula gets wrong most easily —
 * $17,000.01 of adjusted gross income is a FRACTION of the second $2,000 and
 * therefore costs a whole percentage point.
 *
 * ## The boundaries are INCLUSIVE at the top, and that is worth a sentence
 *
 * The printed columns are *"Over"* and *"But not over"*, so exactly $15,000
 * takes 35% and $15,000.01 takes 34%. Reading the boundary the other way moves
 * a filer at a round income one point, which on the $6,000 cap is $60.
 *
 * ## These are the PRE-OBBBA figures, and 2026 will not share them
 *
 * P.L. 119-21 §70404 raises the starting percentage to 50 and re-cuts the
 * whole schedule **for taxable years beginning after December 31, 2025**. So
 * this table is TY2025's and a second tax year added to {@link taxParamsByYear}
 * must carry its own — the reason it is a per-year parameter rather than a
 * constant in `fjs/form2441`.
 *
 * `kind: 'code'`: §21 sets plain dollar amounts and plain percentages that no
 * annual Revenue Procedure inflation-adjusts. A reader looking for these in
 * Rev. Proc. 2024-40 will not find them.
 * @type {{
 *   readonly bands: readonly DependentCarePercentageBand[],
 *   readonly citation: Citation,
 * }}
 */
export const dependentCareCreditPercentage = {
    bands: [
        { adjustedGrossIncomeCeiling: '15000.00', percent: 35 },
        { adjustedGrossIncomeCeiling: '17000.00', percent: 34 },
        { adjustedGrossIncomeCeiling: '19000.00', percent: 33 },
        { adjustedGrossIncomeCeiling: '21000.00', percent: 32 },
        { adjustedGrossIncomeCeiling: '23000.00', percent: 31 },
        { adjustedGrossIncomeCeiling: '25000.00', percent: 30 },
        { adjustedGrossIncomeCeiling: '27000.00', percent: 29 },
        { adjustedGrossIncomeCeiling: '29000.00', percent: 28 },
        { adjustedGrossIncomeCeiling: '31000.00', percent: 27 },
        { adjustedGrossIncomeCeiling: '33000.00', percent: 26 },
        { adjustedGrossIncomeCeiling: '35000.00', percent: 25 },
        { adjustedGrossIncomeCeiling: '37000.00', percent: 24 },
        { adjustedGrossIncomeCeiling: '39000.00', percent: 23 },
        { adjustedGrossIncomeCeiling: '41000.00', percent: 22 },
        { adjustedGrossIncomeCeiling: '43000.00', percent: 21 },
        // "43,000 — No limit". Open-topped, and 20 is §21(a)(2)'s own floor
        // rather than the end of a list that happened to stop.
        { adjustedGrossIncomeCeiling: undefined, percent: 20 },
    ],
    citation: { kind: 'code', section: '§21(a)(2)', effectiveDate: '2025-01-01' },
}

/**
 * §129(a)(2)(A)'s ceiling on what a dependent care assistance program may
 * exclude from gross income — Form 2441 line 21.
 *
 * i2441 p5, Line 21, states both figures for 2025 in its own words: *"the
 * maximum amount that can be excluded from your income through a dependent
 * care assistance program is $5,000 ($2,500 if married filing separately)"*.
 *
 * **The $2,500 row is stored and never reached today**, and that is recorded
 * rather than left to be discovered: `fjs/form2441` refuses every married-
 * filing-separately return, because line 21's own printed condition — *"and
 * you were required to enter your spouse's earned income on line 19"* — turns
 * on the same three facts Form 2441 line A certifies and no document here
 * carries. A parameter table is a transcription of a page, so the row is
 * present as printed.
 *
 * Line 21 also says *"don't enter more than the maximum amount allowed under
 * your dependent care plan"*. That per-plan cap is a TAXPAYER fact, not a tax
 * parameter, and lives on `vnd.fjs.credits`; this figure is the statutory
 * ceiling it is taken against.
 *
 * P.L. 119-21 §70404 raises $5,000 to $7,500 for taxable years beginning after
 * December 31, 2025 — so, exactly like {@link dependentCareCreditPercentage},
 * this is TY2025's row and not a constant.
 * @type {{
 *   readonly standard: AmountWithCitation,
 *   readonly marriedFilingSeparately: AmountWithCitation,
 * }}
 */
export const dependentCareAssistanceExclusionLimit = {
    standard: {
        amount: '5000.00',
        citation: { kind: 'code', section: '§129(a)(2)(A)', effectiveDate: '2025-01-01' },
    },
    marriedFilingSeparately: {
        amount: '2500.00',
        citation: { kind: 'code', section: '§129(a)(2)(A)', effectiveDate: '2025-01-01' },
    },
}

/**
 * §21(d)(2)'s DEEMED earned income, per month, for a spouse who was a full-
 * time student or was incapable of self-care — Form 2441's line B and i2441
 * p4's *If You or Your Spouse Was a Student or Disabled*.
 *
 * These two figures are stored so that `fjs/form2441`'s refusal can QUOTE
 * them. The engine holds no per-month student or disability status, so it
 * never applies the rule; what it does instead is tell a filer whose earned-
 * income limitation binds exactly what they would be entitled to if they
 * qualified, which is the only part of that refusal a reader can act on.
 * A parameter nothing reads is a parameter nobody checks, so this one is read.
 *
 * The amount depends on the number of QUALIFYING PERSONS, not on the number
 * of students — *"at least $250 ($500 if you had two or more qualifying
 * persons at any time during 2025)"* — which is the same $3,000/$6,000 split
 * {@link dependentCareExpenseLimit} makes, and the same trap: three qualifying
 * persons is $500 a month, not $750.
 * @type {{
 *   readonly oneQualifyingPerson: AmountWithCitation,
 *   readonly twoOrMoreQualifyingPersons: AmountWithCitation,
 * }}
 */
export const dependentCareDeemedEarnedIncomePerMonth = {
    oneQualifyingPerson: {
        amount: '250.00',
        citation: { kind: 'code', section: '§21(d)(2)(A)', effectiveDate: '2025-01-01' },
    },
    twoOrMoreQualifyingPersons: {
        amount: '500.00',
        citation: { kind: 'code', section: '§21(d)(2)(B)', effectiveDate: '2025-01-01' },
    },
}

/**
 * One age band of §213(d)(10)'s eligible-long-term-care-premium limitation:
 * the band as printed on Form 7206 line 2(b), and the per-person dollar cap
 * for that band.
 *
 * `maximumAge` is `undefined` on the open-topped last band — no sentinel,
 * matching {@link Bracket}'s own convention for a bracket with no ceiling.
 * `minimumAgeExclusive` is EXCLUSIVE because the statute's own bands are:
 * "more than 40 but not more than 50". Getting that boundary backwards moves
 * a 50-year-old from $900 to $1,800.
 * @typedef {{
 *   readonly band: LongTermCareAgeBand,
 *   readonly minimumAgeExclusive: number | undefined,
 *   readonly maximumAge: number | undefined,
 *   readonly amount: string,
 *   readonly citation: Citation,
 * }} LongTermCarePremiumLimit
 */

/**
 * The five age bands §213(d)(10) prints, named. Exported so consumers iterate
 * this list rather than hand-typing the same five names — {@link
 * individualFilingStatuses}' and {@link federalPovertyLineTables}' precedent.
 *
 * **The names are the AGES, not ordinals.** A band called `tier3` would be
 * unreadable at the call site and impossible to check against the printed
 * page; `fjs/schedule/1` turns each of these into a `vnd.fjs.adjustments`
 * `lineTag` a taxpayer has to pick correctly, so the name is the whole user
 * interface to a figure that ranges over an order of magnitude.
 * @typedef {'ageFortyOrYounger' | 'ageFortyOneToFifty' | 'ageFiftyOneToSixty' | 'ageSixtyOneToSeventy' | 'ageSeventyOneOrOlder'} LongTermCareAgeBand
 */

/**
 * §213(d)(10)'s eligible long-term care premium limitations, as indexed for
 * taxable years beginning in 2025 — Form 7206 line 2(b), TAX-39.
 *
 * ## Where these come from, and why the Rev. Proc. SECTION number matters
 *
 * Rev. Proc. 2024-40 **§2.28**, "Eligible Long-Term Care Premiums", verbatim:
 * *"For taxable years beginning in 2025, the limitations under § 213(d)(10),
 * regarding eligible long-term care premiums includible in the term 'medical
 * care', as adjusted for inflation, are as follows"*. It is **§2.28 and not
 * §2.27** — §2.27 is the qualified-business-income threshold, an unrelated
 * figure this module also stores, and a mis-typed section number would cite a
 * real section of a real Revenue Procedure that says something else entirely.
 *
 * The five amounts are corroborated on the face of **Form 7206 (2025)** line
 * 2(b), transcribed from the printed PDF rather than recalled: *"$480 — if
 * that person is age 40 or younger / $900 — if age 41 to 50 / $1,800 — if age
 * 51 to 60 / $4,810 — if age 61 to 70 / $6,020 — if age 71 or older"*. The
 * printed form states the bands INCLUSIVELY ("age 41 to 50") and the statute
 * states them EXCLUSIVELY ("more than 40 but not more than 50"); the two agree
 * on every integer age, and this table stores the statutory form because that
 * is the one that answers what happens at exactly 40 and exactly 50.
 *
 * ## The cap is PER PERSON, and that is the part an aggregate would lose
 *
 * Form 7206 line 2: *"For coverage under a qualified long-term care insurance
 * contract, enter for each person covered the smaller of (a) or (b)"*, and
 * the note beneath it: *"If more than one person is covered, figure
 * separately the amount to enter for each person. Then enter the total of
 * those amounts."* A couple aged 55 and 65 paying $3,000 each may deduct
 * $1,800 + $3,000 = $4,800, not one $4,810 cap against $6,000 and not one
 * $1,800 cap either. `fjs/form7206` applies the cap per covered person for
 * exactly this reason and its own proof pins the two-person case.
 *
 * ## `age at the end of the tax year`, which is why these are TAGS and not
 * a birth date
 *
 * The band is the person's *"age at the end of the tax year"* (Form 7206 line
 * 2(b)). **No document in this repository carries a birth date** — the same
 * fact `adjustmentLineTags`' own `traditionalIraContributionAgeFiftyOrOver`
 * records, and the reason `form4972LumpSumDistribution` is refused. So the
 * band is asserted by the taxpayer through the `lineTag` they choose, exactly
 * as §219(b)(5)(B)(ii)'s age-50 catch-up already is one line up the same
 * schedule and on the same document.
 * @type {readonly LongTermCarePremiumLimit[]}
 */
export const longTermCarePremiumLimits = [
    {
        band: 'ageFortyOrYounger',
        minimumAgeExclusive: undefined,
        maximumAge: 40,
        amount: '480.00',
        citation: { kind: 'revProc', revProc: 'Rev. Proc. 2024-40', section: '§2.28, age 40 or less', effectiveDate: '2025-01-01' },
    },
    {
        band: 'ageFortyOneToFifty',
        minimumAgeExclusive: 40,
        maximumAge: 50,
        amount: '900.00',
        citation: { kind: 'revProc', revProc: 'Rev. Proc. 2024-40', section: '§2.28, more than 40 but not more than 50', effectiveDate: '2025-01-01' },
    },
    {
        band: 'ageFiftyOneToSixty',
        minimumAgeExclusive: 50,
        maximumAge: 60,
        amount: '1800.00',
        citation: { kind: 'revProc', revProc: 'Rev. Proc. 2024-40', section: '§2.28, more than 50 but not more than 60', effectiveDate: '2025-01-01' },
    },
    {
        band: 'ageSixtyOneToSeventy',
        minimumAgeExclusive: 60,
        maximumAge: 70,
        amount: '4810.00',
        citation: { kind: 'revProc', revProc: 'Rev. Proc. 2024-40', section: '§2.28, more than 60 but not more than 70', effectiveDate: '2025-01-01' },
    },
    {
        band: 'ageSeventyOneOrOlder',
        minimumAgeExclusive: 70,
        maximumAge: undefined,
        amount: '6020.00',
        citation: { kind: 'revProc', revProc: 'Rev. Proc. 2024-40', section: '§2.28, more than 70', effectiveDate: '2025-01-01' },
    },
]


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
 *   readonly earnedIncomeCredit: typeof earnedIncomeCredit,
 *   readonly additionalMedicareTaxThreshold: typeof additionalMedicareTaxThreshold,
 *   readonly additionalMedicareTaxRates: typeof additionalMedicareTaxRates,
 *   readonly socialSecurityTaxWithholding: typeof socialSecurityTaxWithholding,
 *   readonly foreignTaxCreditDeMinimisElection: typeof foreignTaxCreditDeMinimisElection,
 *   readonly netInvestmentIncomeTaxThreshold: typeof netInvestmentIncomeTaxThreshold,
 *   readonly netInvestmentIncomeTaxRateBasisPoints: typeof netInvestmentIncomeTaxRateBasisPoints,
 *   readonly iraDeduction: typeof iraDeduction,
 *   readonly studentLoanInterestDeduction: typeof studentLoanInterestDeduction,
 *   readonly educatorExpenses: typeof educatorExpenses,
 *   readonly healthSavingsAccount: typeof healthSavingsAccount,
 *   readonly retirementSavingsContributionsCredit: typeof retirementSavingsContributionsCredit,
 *   readonly educationCredits: typeof educationCredits,
 *   readonly qualifiedCharitableDistribution: typeof qualifiedCharitableDistribution,
 *   readonly selfEmploymentTax: typeof selfEmploymentTax,
 *   readonly qualifiedBusinessIncomeDeduction: typeof qualifiedBusinessIncomeDeduction,
 *   readonly alternativeMinimumTax: typeof alternativeMinimumTax,
 *   readonly federalPovertyLine: typeof federalPovertyLine,
 *   readonly premiumTaxCreditApplicablePercentage: typeof premiumTaxCreditApplicablePercentage,
 *   readonly premiumTaxCreditRepaymentLimitation: typeof premiumTaxCreditRepaymentLimitation,
 *   readonly dependentCareExpenseLimit: typeof dependentCareExpenseLimit,
 *   readonly dependentCareCreditPercentage: typeof dependentCareCreditPercentage,
 *   readonly dependentCareAssistanceExclusionLimit: typeof dependentCareAssistanceExclusionLimit,
 *   readonly dependentCareDeemedEarnedIncomePerMonth: typeof dependentCareDeemedEarnedIncomePerMonth,
 *   readonly longTermCarePremiumLimits: typeof longTermCarePremiumLimits,
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
        earnedIncomeCredit,
        additionalMedicareTaxThreshold,
        additionalMedicareTaxRates,
        socialSecurityTaxWithholding,
        foreignTaxCreditDeMinimisElection,
        netInvestmentIncomeTaxThreshold,
        netInvestmentIncomeTaxRateBasisPoints,
        iraDeduction,
        studentLoanInterestDeduction,
        educatorExpenses,
        healthSavingsAccount,
        retirementSavingsContributionsCredit,
        educationCredits,
        qualifiedCharitableDistribution,
        selfEmploymentTax,
        qualifiedBusinessIncomeDeduction,
        alternativeMinimumTax,
        federalPovertyLine,
        premiumTaxCreditApplicablePercentage,
        premiumTaxCreditRepaymentLimitation,
        dependentCareExpenseLimit,
        dependentCareCreditPercentage,
        dependentCareAssistanceExclusionLimit,
        dependentCareDeemedEarnedIncomePerMonth,
        longTermCarePremiumLimits,
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
    ...individualFilingStatuses.map(status => foreignTaxCreditDeMinimisElection[status].amount),
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
    iraDeduction.deductibleAmount.amount,
    iraDeduction.catchUpContribution.amount,
    iraDeduction.minimumPhasedOutLimit.amount,
    iraDeduction.roundingIncrement.amount,
    iraDeduction.phaseoutThreshold.single.amount,
    iraDeduction.phaseoutThreshold.marriedFilingSeparately.amount,
    iraDeduction.phaseoutThreshold.headOfHousehold.amount,
    iraDeduction.phaseoutThreshold.qualifyingSurvivingSpouse.amount,
    iraDeduction.phaseoutRange.single.amount,
    iraDeduction.phaseoutRange.marriedFilingSeparately.amount,
    iraDeduction.phaseoutRange.headOfHousehold.amount,
    iraDeduction.phaseoutRange.qualifyingSurvivingSpouse.amount,
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
    selfEmploymentTax.socialSecurityWageBase.amount,
    ...individualFilingStatuses.map(
        status => qualifiedBusinessIncomeDeduction.thresholdAmount[status].amount),
    ...individualFilingStatuses.flatMap(status => [
        alternativeMinimumTax.exemption[status].amount,
        alternativeMinimumTax.exemptionPhaseoutThreshold[status].amount,
        alternativeMinimumTax.exemptionCompletePhaseout[status].amount,
        alternativeMinimumTax.upperRateThreshold[status].amount,
    ]),
    ...federalPovertyLineTables.flatMap(table => [
        federalPovertyLine[table].firstPerson.amount,
        federalPovertyLine[table].eachAdditionalPerson.amount,
    ]),
    ...premiumTaxCreditRepaymentLimitation.bands.flatMap(band => [band.single, band.other]),
    dependentCareExpenseLimit.oneQualifyingPerson.amount,
    dependentCareExpenseLimit.twoOrMoreQualifyingPersons.amount,
    // The last band's ceiling is `undefined` ("43,000 — No limit") and is
    // filtered out rather than coerced, exactly as the last ordinary bracket's
    // is above.
    ...dependentCareCreditPercentage.bands
        .map(band => band.adjustedGrossIncomeCeiling)
        .filter(isDefinedString),
    dependentCareAssistanceExclusionLimit.standard.amount,
    dependentCareAssistanceExclusionLimit.marriedFilingSeparately.amount,
    dependentCareDeemedEarnedIncomePerMonth.oneQualifyingPerson.amount,
    dependentCareDeemedEarnedIncomePerMonth.twoOrMoreQualifyingPersons.amount,
]

export const proof = {
    // ── TAX-39: §213(d)(10)'s long-term care premium limits ────────────────
    //
    // **Hand-typed from Form 7206 (2025) line 2(b) and Rev. Proc. 2024-40
    // §2.28, not from the table above.** The expected side is a literal
    // `Record` written out band by band, which is the idiom
    // `standardDeductionCitesObbbaRevision` uses two leaves down and the
    // reason AGENTS.md gives for it: an expected value produced by the code
    // under test proves the code equals itself.
    //
    // The COUNT is asserted beside the loop for the fourth-shipped-defect
    // reason — `longTermCarePremiumLimits` is both the iteration set and the
    // subject, so a deleted band would vanish from the loop in the same
    // instant it vanished from the data.
    longTermCarePremiumLimitsMatchThePrintedFormAndTheRevenueProcedure: () => {
        /** @type {Record<LongTermCareAgeBand, string>} */
        const printed = {
            ageFortyOrYounger: '480.00',
            ageFortyOneToFifty: '900.00',
            ageFiftyOneToSixty: '1800.00',
            ageSixtyOneToSeventy: '4810.00',
            ageSeventyOneOrOlder: '6020.00',
        }
        assertEq(longTermCarePremiumLimits.length, 5, 'five printed bands')
        assertEq(Object.keys(printed).length, 5, 'and five hand-typed expectations')
        for (const limit of longTermCarePremiumLimits) {
            const expected = printed[limit.band]
            assertEq(limit.amount, expected, `band ${limit.band}`)
            // Every figure carries Rev. Proc. 2024-40 §2.28 — never §2.27,
            // which is the qualified-business-income threshold. A section
            // number that names a real but different rule is the failure this
            // assertion exists for.
            assertEq(limit.citation.kind, 'revProc')
            assert(
                limit.citation.kind === 'revProc' && limit.citation.revProc === 'Rev. Proc. 2024-40',
                ['the governing Revenue Procedure', limit.band, limit.citation])
            assert(
                limit.citation.section.startsWith('§2.28'),
                ['§2.28, Eligible Long-Term Care Premiums', limit.band, limit.citation.section])
        }
    },
    // The bands must PARTITION the ages: each one's exclusive floor is the
    // previous one's inclusive ceiling, the first is open below and the last
    // open above. Stated as arithmetic over consecutive pairs rather than as
    // five more literals, because what this leaf is for is the boundary the
    // statute and the printed form state differently — "more than 40 but not
    // more than 50" versus "age 41 to 50".
    theLongTermCareBandsPartitionEveryAgeWithNoGapAndNoOverlap: () => {
        const [first, ...rest] = longTermCarePremiumLimits
        assert(first !== undefined, 'five bands')
        if (first === undefined) { throw 'expected a first band' }
        assertEq(first.minimumAgeExclusive, undefined, 'the first band is open below')
        assertEq(rest.length, 4, 'four bands follow the first')
        const last = longTermCarePremiumLimits[longTermCarePremiumLimits.length - 1]
        assert(last !== undefined, 'a last band')
        if (last === undefined) { throw 'expected a last band' }
        assertEq(last.maximumAge, undefined, 'and the last is open above')
        for (let index = 1; index < longTermCarePremiumLimits.length; index += 1) {
            const previous = longTermCarePremiumLimits[index - 1]
            const current = longTermCarePremiumLimits[index]
            assert(previous !== undefined && current !== undefined, ['a pair', index])
            if (previous === undefined || current === undefined) { throw 'expected a pair' }
            assertEq(
                current.minimumAgeExclusive, previous.maximumAge,
                `band ${current.band} must start exactly where ${previous.band} ends`)
            // And the amounts must ascend, which is what makes a transposed
            // pair of rows visible: $4,810 and $6,020 are adjacent and easy to
            // swap, and every other assertion here would still pass.
            assert(
                centsFromString(current.amount) > centsFromString(previous.amount),
                ['the cap must rise with age', previous.band, current.band])
        }
    },
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
    // §3101(a)'s 6.2%, in the statute's own words, with its citation asserted
    // SEPARATELY from its value — a rate that is right while citing the wrong
    // section and a rate that is wrong while citing the right one are
    // different defects.
    theEmployeeSocialSecurityRateIsSectionThirtyOneOhOnesOwnSixPointTwo: () => {
        assertEq(
            socialSecurityTaxWithholding.employeeRateBasisPoints, 620,
            '6.2% — IRC §3101(a), the rate an employer withholds into Form W-2 box 4')
        assertEq(socialSecurityTaxWithholding.citation.kind, 'code')
        assertEq(socialSecurityTaxWithholding.citation.section, '§3101(a)')
        assertEq(socialSecurityTaxWithholding.citation.effectiveDate, '2025-01-01')
        // The unit test this module applies to every other rate: 6.2 is not a
        // whole number of percent, so basis points are what make it exact.
        assert(
            socialSecurityTaxWithholding.employeeRateBasisPoints % 100 !== 0,
            ['§3101(a)\'s rate IS a whole number of percent — revisit the unit',
                socialSecurityTaxWithholding.employeeRateBasisPoints])
    },
    // The product, checked against a figure NEITHER stored parameter
    // produced: the 2025 Schedule 3 instructions for line 11 print the
    // maximum outright as **$10,918.20**, and that is what is hand-typed
    // here. Two stored parameters multiplied together are not evidence about
    // either one until something outside this module says what the answer
    // should be — the idiom `fjs/schedule/se`'s 0.9235 leaf uses, applied to
    // the pair §3121(a)(1) actually needs.
    //
    // It is also the leaf that notices the SHARED wage base moving. §1402(b)(1)
    // and §3121(a)(1) both defer to one Social Security Act §230 base, so
    // `selfEmploymentTax.socialSecurityWageBase` is read by chapter 2 AND
    // chapter 21; a TY2026 figure dropped in without revisiting this line
    // would silently change a refund on Schedule 3 line 11.
    theSocialSecurityWithholdingMaximumIsTheInstructionsOwnFigure: () => {
        const maximum = halfUp(of(
            centsFromString(selfEmploymentTax.socialSecurityWageBase.amount)
            * BigInt(socialSecurityTaxWithholding.employeeRateBasisPoints))(10000n))
        assertEq(
            centsToString(maximum), '10918.20',
            '$176,100.00 x 6.2% — the 2025 Schedule 3 line 11 instructions print $10,918.20')
    },
    // §904(j)(2)(B)'s two figures, in the statute's own words, with the
    // citation asserted SEPARATELY from the value — a threshold that is right
    // while citing the wrong subsection and one that is wrong while citing
    // the right one are different defects.
    //
    // Asserted PER STATUS and hand-typed five times, never as one loop over
    // an expected map, so a single wrong figure names its own status. The
    // three $300 rows are the interesting ones: each is a status the statute
    // does NOT call a joint return, and a copy-paste of the joint figure into
    // any of them would hand that filer twice the ceiling.
    theDeMinimisCeilingIsThreeHundredExceptOnAJointReturn: () => {
        assertEq(
            foreignTaxCreditDeMinimisElection.single.amount, '300.00',
            '$300 — §904(j)(2)(B), a single filer is not a joint return')
        assertEq(
            foreignTaxCreditDeMinimisElection.marriedFilingJointly.amount, '600.00',
            '$600 — §904(j)(2)(B), "in the case of a joint return"')
        assertEq(
            foreignTaxCreditDeMinimisElection.marriedFilingSeparately.amount, '300.00',
            '$300 — a separate return is not a joint return')
        assertEq(
            foreignTaxCreditDeMinimisElection.headOfHousehold.amount, '300.00',
            '$300 — head of household is not a joint return')
        assertEq(
            foreignTaxCreditDeMinimisElection.qualifyingSurvivingSpouse.amount, '300.00',
            '$300 — a qualifying surviving spouse does not file a JOINT return, '
            + 'whatever rate schedule the status borrows')
        // Exactly ONE status may carry the larger figure. Stated as a count
        // rather than as five equalities, so a sixth status added later
        // cannot quietly take $600 by default.
        assertEq(
            individualFilingStatuses.filter(
                status => foreignTaxCreditDeMinimisElection[status].amount === '600.00').length,
            1,
            'exactly one filing status is a joint return')
    },
    everyDeMinimisCeilingCitesSubsectionJ: () => {
        for (const status of individualFilingStatuses) {
            const { citation } = foreignTaxCreditDeMinimisElection[status]
            assertEq(citation.kind, 'code', status)
            assertEq(citation.section, '§904(j)(2)(B)', status)
            assertEq(citation.effectiveDate, '2025-01-01', status)
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
    // ── IRC §219, Schedule 1 line 20: the traditional IRA deduction ─────────
    //
    // Every expected value below is hand-typed from IRS Notice 2024-80 and
    // Publication 590-A Table 1-2, never read back out of `iraDeduction`.
    // The subsection letter is asserted beside each amount so the two cannot
    // drift: a $126,000 figure sitting under `single` would have to arrive
    // with a `(g)(3)(B)(i)` citation to pass, and it would still fail on the
    // amount.
    iraDeductionLimitsAreNoticeTwentyFourEightyFigures: () => {
        assertEq(iraDeduction.deductibleAmount.amount, '7000.00', '§219(b)(5)(A), Notice 2024-80')
        assertEq(iraDeduction.deductibleAmount.citation.section, '§219(b)(5)(A)')
        assertEq(iraDeduction.deductibleAmount.citation.kind, 'code')
        assertEq(iraDeduction.deductibleAmount.citation.effectiveDate, '2025-01-01')
        assertEq(iraDeduction.catchUpContribution.amount, '1000.00', '§219(b)(5)(B)(ii), "remains $1,000"')
        assertEq(iraDeduction.catchUpContribution.citation.section, '§219(b)(5)(B)(ii)')
        // §219(g)(2)(B) and (C), the two figures written into the statute
        // itself. Publication 590-A Worksheet 1-2 line 4 prints both in one
        // sentence: "round it to the next highest multiple of $10 … However,
        // if the result is less than $200, enter $200."
        assertEq(iraDeduction.minimumPhasedOutLimit.amount, '200.00', '§219(g)(2)(B)')
        assertEq(iraDeduction.minimumPhasedOutLimit.citation.section, '§219(g)(2)(B)')
        assertEq(iraDeduction.roundingIncrement.amount, '10.00', '§219(g)(2)(C)')
        assertEq(iraDeduction.roundingIncrement.citation.section, '§219(g)(2)(C)')
    },
    // The four statuses that can compute this deduction, each with its own
    // threshold, its own range and its own subsection. Hand-typed as four
    // separate rows rather than looped with a shared expectation, for the
    // reason `additionalMedicareTaxThresholdsAreTheUnindexedStatutoryFigures`
    // states about ITS QSS row -- except that here QSS goes the OTHER way and
    // takes the joint figures, on Notice 2024-80's own words ("filing a joint
    // return or as a qualifying widow(er)").
    //
    // `marriedFilingJointly` is deliberately absent and there is no fifth
    // row: `fjs/schedule/1` refuses a joint return carrying a contribution,
    // so the status has no threshold here at all.
    iraDeductionPhaseoutThresholdsArePublication590ATableOneTwo: () => {
        /** @type {readonly (readonly [string, string, string, string])[]} */
        const expected = [
            ['single', '79000.00', '10000.00', '§219(g)(3)(B)(ii)'],
            ['headOfHousehold', '79000.00', '10000.00', '§219(g)(3)(B)(ii)'],
            ['qualifyingSurvivingSpouse', '126000.00', '20000.00', '§219(g)(3)(B)(i)'],
            ['marriedFilingSeparately', '0.00', '10000.00', '§219(g)(3)(B)(iii)'],
        ]
        assertEq(
            expected.length, 4,
            'four statuses compute; a joint return refuses and so stores nothing')
        for (const [status, threshold, range, section] of expected) {
            const storedThreshold = status === 'single' ? iraDeduction.phaseoutThreshold.single
                : status === 'headOfHousehold' ? iraDeduction.phaseoutThreshold.headOfHousehold
                    : status === 'qualifyingSurvivingSpouse'
                        ? iraDeduction.phaseoutThreshold.qualifyingSurvivingSpouse
                        : iraDeduction.phaseoutThreshold.marriedFilingSeparately
            const storedRange = status === 'single' ? iraDeduction.phaseoutRange.single
                : status === 'headOfHousehold' ? iraDeduction.phaseoutRange.headOfHousehold
                    : status === 'qualifyingSurvivingSpouse'
                        ? iraDeduction.phaseoutRange.qualifyingSurvivingSpouse
                        : iraDeduction.phaseoutRange.marriedFilingSeparately
            assertEq(storedThreshold.amount, threshold, ['wrong §219(g)(3)(B) applicable dollar amount', status])
            assertEq(storedThreshold.citation.section, section, ['wrong subsection', status])
            assertEq(storedRange.amount, range, ['wrong §219(g)(2)(A)(ii) divisor', status])
            assertEq(storedRange.citation.section, '§219(g)(2)(A)(ii)', ['wrong divisor citation', status])
        }
    },
    // The check a THIRD and FOURTH stored figure would have made impossible.
    // Publication 590-A Worksheet 1-2's own table prints a completely-
    // phased-out end point per status, and its line 4 prints a PERCENTAGE per
    // status; this module stores neither, because both are derivable from the
    // three figures the computation actually reads. Derived here and compared
    // against hand-typed values off the printed worksheet.
    //
    // The percentages are `deductibleAmount / range` and
    // `(deductibleAmount + catchUp) / range` -- 70%/80% for single, head of
    // household and married-filing-separately, and 35%/40% for a qualifying
    // surviving spouse, which is the pair Worksheet 1-2 prints in its
    // "Married filing jointly or qualifying surviving spouse" row.
    iraDeductionPhaseoutEndPointsAndPercentagesMatchPublication590A: () => {
        /** @type {readonly (readonly [string, string, number, number])[]} */
        const expected = [
            ['single', '89000.00', 70, 80],
            ['headOfHousehold', '89000.00', 70, 80],
            ['qualifyingSurvivingSpouse', '146000.00', 35, 40],
            ['marriedFilingSeparately', '10000.00', 70, 80],
        ]
        assertEq(expected.length, 4, 'one row per computable status')
        const baseCents = centsFromString(iraDeduction.deductibleAmount.amount)
        const catchUpCents = centsFromString(iraDeduction.catchUpContribution.amount)
        for (const [status, endPoint, basePercent, catchUpPercent] of expected) {
            const storedThreshold = status === 'single' ? iraDeduction.phaseoutThreshold.single
                : status === 'headOfHousehold' ? iraDeduction.phaseoutThreshold.headOfHousehold
                    : status === 'qualifyingSurvivingSpouse'
                        ? iraDeduction.phaseoutThreshold.qualifyingSurvivingSpouse
                        : iraDeduction.phaseoutThreshold.marriedFilingSeparately
            const storedRange = status === 'single' ? iraDeduction.phaseoutRange.single
                : status === 'headOfHousehold' ? iraDeduction.phaseoutRange.headOfHousehold
                    : status === 'qualifyingSurvivingSpouse'
                        ? iraDeduction.phaseoutRange.qualifyingSurvivingSpouse
                        : iraDeduction.phaseoutRange.marriedFilingSeparately
            const rangeCents = centsFromString(storedRange.amount)
            assertEq(
                centsToString(centsFromString(storedThreshold.amount) + rangeCents),
                endPoint,
                ['threshold + range must equal Publication 590-A’s end point', status])
            assertEq(
                Number(baseCents * 100n / rangeCents), basePercent,
                ['wrong Worksheet 1-2 line 4 percentage, under age 50', status])
            assertEq(
                Number((baseCents + catchUpCents) * 100n / rangeCents), catchUpPercent,
                ['wrong Worksheet 1-2 line 4 percentage, age 50 or over', status])
        }
    },
    // ── TAX-27, Phase 32: §32's own three independent checks ────────────────
    //
    // The Revenue Procedure prints SIX rows per tier and this module stores
    // FOUR of them. The two it does not store are the two these leaves
    // recompute — which is the whole point: a figure that is stored cannot
    // check the figure it was transcribed beside, and a figure that is derived
    // can. Every expected value below is hand-typed off Rev. Proc. 2024-40
    // §2.06(1)'s printed table, never read back out of `earnedIncomeCredit`.
    earnedIncomeCreditMaximumCreditIsTheRoundedProduct: () => {
        /** @type {readonly (readonly [EarnedIncomeCreditChildTier, string])[]} */
        const expected = [
            // §32(b)(1) x §32(b)(2)(A), to the nearest dollar:
            //   none        $8,490 x  7.65% =   $649.485 -> $649
            //   one        $12,730 x 34%    = $4,328.20  -> $4,328
            //   two        $17,880 x 40%    = $7,152.00  -> $7,152
            //   threeOrMore $17,880 x 45%   = $8,046.00  -> $8,046
            ['none', '649.00'],
            ['one', '4328.00'],
            ['two', '7152.00'],
            ['threeOrMore', '8046.00'],
        ]
        assertEq(expected.length, 4, '§32(b)(1) prints exactly four tiers')
        for (const [name, printed] of expected) {
            const tier = earnedIncomeCredit.tiers[name]
            // To the nearest DOLLAR, not the nearest cent: the divisor is
            // 10,000 (basis points) x 100 (cents in a dollar), and the whole
            // dollars are multiplied back up to cents. $649.485 is the case
            // that distinguishes the two -- to the cent it is $649.49, and the
            // printed maximum credit is $649.
            const product = halfUp(of(
                centsFromString(tier.earnedIncomeAmount.amount)
                * BigInt(tier.creditPercentBasisPoints))(1000000n)) * 100n
            assertEq(
                centsToString(product), printed,
                ['the credit percentage of the earned income amount, rounded, must be the printed maximum credit', name])
            assertEq(
                tier.maximumCredit.amount, printed,
                ['the STORED maximum credit must be the same figure', name])
        }
    },
    // Rev. Proc. 2024-40 §2.06(1)'s "Completed Phaseout Amount" rows, both of
    // them, hand-typed and asserted against a figure DERIVED from the three
    // stored ones -- see {@link earnedIncomeCredit}'s "What is deliberately
    // NOT stored". Eight independent statements, and a slip in any of the
    // twelve stored figures they are built from fails at least one.
    earnedIncomeCreditCompletedPhaseoutAmountsMatchTheRevenueProcedure: () => {
        /** @type {readonly (readonly [EarnedIncomeCreditChildTier, string, string])[]} */
        const expected = [
            // tier          married filing jointly   all other filing statuses
            ['none', '26214.00', '19104.00'],
            ['one', '57554.00', '50434.00'],
            ['two', '64430.00', '57310.00'],
            ['threeOrMore', '68675.00', '61555.00'],
        ]
        assertEq(expected.length, 4, '§2.06(1) prints exactly four tiers')
        for (const [name, joint, other] of expected) {
            const tier = earnedIncomeCredit.tiers[name]
            // maximumCredit / phaseoutPercent, to the nearest CENT, then the
            // phaseout amount added and the sum taken to the nearest DOLLAR --
            // which is the rounding the printed figures carry (they are whole
            // dollars, and $19,103.66 prints as $19,104).
            const span = halfUp(of(
                centsFromString(tier.maximumCredit.amount) * 10000n)(
                BigInt(tier.phaseoutPercentBasisPoints)))
            /** @type {readonly (readonly [string, AmountWithCitation])[]} */
            const both = [
                [joint, tier.phaseoutAmount.marriedFilingJointly],
                [other, tier.phaseoutAmount.other],
            ]
            for (const [printed, start] of both) {
                const wholeDollars = halfUp(of(centsFromString(start.amount) + span)(100n)) * 100n
                assertEq(
                    centsToString(wholeDollars), printed,
                    ['phaseout amount + maximum credit / phaseout percentage must equal the printed completed phaseout amount', name, printed])
            }
        }
    },
    // The percentages are §32(b)(1)'s own and are NOT indexed -- the same
    // check, for the same reason, as `studentLoanInterestFiguresCiteIrc221Only`
    // one group down, and the opposite of the dollar figures beside them.
    // Hand-typed basis points, never read back off the tier they describe.
    earnedIncomeCreditPercentagesAreTheStatutoryOnes: () => {
        /** @type {readonly (readonly [EarnedIncomeCreditChildTier, number, number])[]} */
        const expected = [
            ['none', 765, 765],
            ['one', 3400, 1598],
            ['two', 4000, 2106],
            ['threeOrMore', 4500, 2106],
        ]
        assertEq(expected.length, 4)
        for (const [name, credit, phaseout] of expected) {
            const tier = earnedIncomeCredit.tiers[name]
            assertEq(tier.creditPercentBasisPoints, credit, ['§32(b)(1) credit percentage', name])
            assertEq(tier.phaseoutPercentBasisPoints, phaseout, ['§32(b)(1) phaseout percentage', name])
        }
        assertEq(earnedIncomeCredit.percentagesCitation.kind, 'code')
        assertEq(earnedIncomeCredit.percentagesCitation.section, '§32(b)(1)')
        // The two figures §32(j) DOES index, and §32(f)(2)'s bracket width,
        // which it does not.
        assertEq(earnedIncomeCredit.investmentIncomeLimit.amount, '11950.00')
        assertEq(earnedIncomeCredit.bandWidth.amount, '50.00')
        assertEq(earnedIncomeCredit.bandWidth.citation.section, '§32(f)(2)')
        assertEq(earnedIncomeCreditChildTiers.length, 4)
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
    // ── TAX-31 (Phase 28): Schedule SE's four parameters ────────────────────
    selfEmploymentTax: {
        // Every figure hand-typed off the printed 2025 Schedule SE face and
        // the two statutes, never derived from each other and never from
        // anything this module computes. The two rates are the ones a reader
        // is most likely to transpose (12.4 for the CAPPED portion, 2.9 for
        // the uncapped one), so each is asserted with the printed line that
        // multiplies by it named in the message.
        everyFigureMatchesTheStatuteAndThePrintedPage: () => {
            assertEq(
                selfEmploymentTax.minimumNetEarnings.amount, '400.00',
                'Schedule SE line 4c: "if less than $400, stop; you don\'t owe self-employment tax"')
            assertEq(
                selfEmploymentTax.socialSecurityWageBase.amount, '176100.00',
                'Schedule SE line 7: "maximum amount of combined wages and self-employment earnings subject to social security tax ... for 2025"')
            assertEq(
                selfEmploymentTax.rates.oldAgeSurvivorsAndDisabilityInsuranceBasisPoints, 1240,
                'Schedule SE line 10: "multiply the smaller of line 6 or line 9 by 12.4% (0.124)" — §1401(a)')
            assertEq(
                selfEmploymentTax.rates.hospitalInsuranceBasisPoints, 290,
                'Schedule SE line 11: "multiply line 6 by 2.9% (0.029)" — §1401(b)')
            assertEq(
                selfEmploymentTax.deductibleHalf.ratePercent, 50,
                'Schedule SE line 13: "multiply line 12 by 50% (0.50)" — §164(f)(1)')
        },
        // The two rates ADD to the 15.3% every reader knows self-employment
        // tax by, and that sum is the figure §1402(a)(12) halves. Asserted as
        // its own leaf because it is the one relation between them: a
        // transposition (290/1240) would leave both figures present and both
        // individually plausible while making the sum unchanged — so this
        // leaf alone would NOT catch it, and the leaf above is what does.
        // Both exist deliberately.
        theTwoRatesSumToFifteenPointThreePercent: () => {
            assertEq(
                selfEmploymentTax.rates.oldAgeSurvivorsAndDisabilityInsuranceBasisPoints
                    + selfEmploymentTax.rates.hospitalInsuranceBasisPoints,
                1530,
                '12.4% + 2.9% = 15.3%, the combined §1401 rate',
            )
            // …and §1402(a)(12)'s "one-half of the sum of the rates" is
            // therefore 7.65%, which is a WHOLE number of basis points. If a
            // future year's rates summed to an odd number of basis points,
            // the derivation `fjs/schedule/se` performs would not be exact,
            // and this is where that would be noticed.
            assertEq(1530 % 2, 0, 'half the combined rate must be a whole number of basis points')
        },
        // Exactly ONE of the four moves with inflation, and the citations say
        // which. Every figure here is `kind: 'code'` — none is Rev.-Proc.-
        // sourced, and the wage base is SSA-sourced rather than IRS-sourced,
        // so naming a Revenue Procedure for any of them would be an invented
        // citation (this module's header's own named failure).
        everyFigureCitesItsOwnGoverningProvision: () => {
            /** @type {readonly (readonly [string, Citation])[]} */
            const every = [
                ['minimumNetEarnings', selfEmploymentTax.minimumNetEarnings.citation],
                ['socialSecurityWageBase', selfEmploymentTax.socialSecurityWageBase.citation],
                ['rates', selfEmploymentTax.rates.citation],
                ['deductibleHalf', selfEmploymentTax.deductibleHalf.citation],
            ]
            assertEq(every.length, 4, 'four parameters, four citations')
            for (const [name, citation] of every) {
                assertEq(citation.kind, 'code', ['no Revenue Procedure sets this figure', name])
                assertEq(citation.effectiveDate, '2025-01-01', name)
            }
            assertEq(selfEmploymentTax.minimumNetEarnings.citation.section, '§1402(b)(2)')
            assertEq(selfEmploymentTax.socialSecurityWageBase.citation.section, '§1402(b)(1)')
            assertEq(selfEmploymentTax.rates.citation.section, '§1401')
            assertEq(selfEmploymentTax.deductibleHalf.citation.section, '§164(f)(1)')
            // Four DISTINCT sections. A citation copied from a neighbour --
            // the failure `standardDeductionCitesObbbaRevision`'s opposite
            // number exists for -- would collapse this set.
            assertEq(
                new Set(every.map(([, citation]) => citation.section)).size, 4,
                'four separately-enacted provisions must not share a citation')
        },
        // The 92.35% factor is NOT here, and this leaf is what stops it
        // quietly arriving as a fifth field. `fjs/schedule/se` derives it from
        // the two rates per §1402(a)(12); a stored copy would be a second
        // source of truth for a rule those rates already fix.
        theNinetyTwoPointThreeFiveFactorIsNotStored: () => {
            const stored = Object.keys(selfEmploymentTax)
            assertEq(stored.length, 4, ['four fields, no factor', stored])
            for (const name of stored) {
                assert(
                    !name.toLowerCase().includes('factor')
                        && !name.toLowerCase().includes('netearnings9235'),
                    ['the 92.35% factor is derived in `fjs/schedule/se`, never stored here', name],
                )
            }
        },
    },
    // ── TAX-32 (Phase 28): §199A's rate and threshold ───────────────────────
    qualifiedBusinessIncomeDeduction: {
        // Hand-typed off the statute and the printed 2025 Form 8995 threshold
        // sentence, per status, so a figure copied from the wrong row names
        // itself.
        everyThresholdMatchesTheStatute: () => {
            /** @type {Record<IndividualFilingStatus, string>} */
            const expected = {
                single: '197300.00',
                marriedFilingJointly: '394600.00',
                marriedFilingSeparately: '197300.00',
                headOfHousehold: '197300.00',
                qualifyingSurvivingSpouse: '197300.00',
            }
            for (const status of individualFilingStatuses) {
                assertEq(
                    qualifiedBusinessIncomeDeduction.thresholdAmount[status].amount,
                    expected[status],
                    ['§199A(e)(2) threshold for this status', status],
                )
                assertEq(qualifiedBusinessIncomeDeduction.thresholdAmount[status].citation.kind, 'code')
                assert(
                    qualifiedBusinessIncomeDeduction.thresholdAmount[status].citation.section
                        .startsWith('§199A(e)(2)'),
                    ['every threshold is §199A(e)(2)\'s', status])
            }
            assertEq(
                qualifiedBusinessIncomeDeduction.ratePercent, 20,
                '§199A(b)(2)(A): "20 percent of the taxpayer\'s qualified business income"')
            assertEq(qualifiedBusinessIncomeDeduction.rateCitation.kind, 'code')
            assertEq(qualifiedBusinessIncomeDeduction.rateCitation.section, '§199A(b)(2)(A)')
        },
        // ONE status gets the doubled figure, and it is the JOINT one alone.
        // Asserted as an inequality against every other status rather than
        // only as a value, so a QSS row quietly copied from the MFJ row --
        // the exact mistake §3101(b)(2) and §1411(b)(1) already disagree
        // about, twice, in this module -- reddens here.
        onlyAJointReturnGetsTheDoubledThreshold: () => {
            const joint = centsFromString(
                qualifiedBusinessIncomeDeduction.thresholdAmount.marriedFilingJointly.amount)
            const general = centsFromString(
                qualifiedBusinessIncomeDeduction.thresholdAmount.single.amount)
            assertEq(joint, general * 2n, '§199A(e)(2)(A): "200 percent of such amount"')
            for (const status of individualFilingStatuses) {
                if (status === 'marriedFilingJointly') {
                    continue
                }
                assertEq(
                    centsFromString(qualifiedBusinessIncomeDeduction.thresholdAmount[status].amount),
                    general,
                    ['only "a taxpayer filing a joint return" doubles; this status does not', status],
                )
            }
        },
        // THE COINCIDENCE WATCH, and the status it already fails for. See
        // this group's own docstring: four statuses agree with the
        // 24%-bracket ceiling and a qualifying surviving spouse does not,
        // because §199A(e)(2)(A)'s doubling turns on FILING a joint return
        // while §2(a) only lends that status the joint RATE SCHEDULE.
        //
        // If the first half reddens, that is information rather than a
        // defect: the two amounts are indexed by different provisions and
        // may legitimately part. If the SECOND half reddens, a derivation
        // has crept in and a widow(er)'s §199A threshold has doubled.
        theThresholdCoincidesWithTheBracketCeilingForFourStatusesAndNotForTheFifth: () => {
            /** @type {(status: IndividualFilingStatus) => string} */
            const twentyFourPercentCeiling = status => {
                const bracket = ordinaryBrackets[status].brackets.find(
                    candidate => candidate.ratePercent === 24)
                return assertNotNullish(
                    assertNotNullish(bracket, ['no 24% bracket', status]).ceiling,
                    ['the 24% bracket has no ceiling', status])
            }
            for (const status of ['single', 'marriedFilingJointly', 'marriedFilingSeparately', 'headOfHousehold']) {
                const narrowed = individualFilingStatuses.find(candidate => candidate === status)
                const only = assertNotNullish(narrowed, ['not a filing status', status])
                assertEq(
                    qualifiedBusinessIncomeDeduction.thresholdAmount[only].amount,
                    twentyFourPercentCeiling(only),
                    ['§199A and the 24% bracket coincide today for this status', only],
                )
            }
            assertEq(
                qualifiedBusinessIncomeDeduction.thresholdAmount.qualifyingSurvivingSpouse.amount,
                '197300.00')
            assertEq(twentyFourPercentCeiling('qualifyingSurvivingSpouse'), '394600.00')
            assert(
                qualifiedBusinessIncomeDeduction.thresholdAmount.qualifyingSurvivingSpouse.amount
                    !== twentyFourPercentCeiling('qualifyingSurvivingSpouse'),
                'a qualifying surviving spouse\'s §199A threshold is NOT the joint bracket ceiling',
            )
        },
        // ── TAX-32 (Phase 31): the phase-in RANGE ───────────────────────────
        // Hand-typed off Form 8995-A's printed line 23 and Schedule A's printed
        // line 8, per status, both fetched 2026-08-17. $50,000 everywhere
        // except a JOINT return's $100,000.
        everyPhaseInRangeMatchesThePrintedPage: () => {
            /** @type {Record<IndividualFilingStatus, string>} */
            const expected = {
                single: '50000.00',
                marriedFilingJointly: '100000.00',
                marriedFilingSeparately: '50000.00',
                headOfHousehold: '50000.00',
                qualifyingSurvivingSpouse: '50000.00',
            }
            for (const status of individualFilingStatuses) {
                assertEq(
                    qualifiedBusinessIncomeDeduction.phaseInRange[status].amount,
                    expected[status],
                    ['Form 8995-A line 23 phase-in range for this status', status],
                )
                assertEq(qualifiedBusinessIncomeDeduction.phaseInRange[status].citation.kind, 'code')
                assert(
                    qualifiedBusinessIncomeDeduction.phaseInRange[status].citation.section
                        .startsWith('§199A(b)(3)(B)'),
                    ['the range is §199A(b)(3)(B)(ii)\'s, NOT §199A(e)(2)\'s', status])
            }
        },
        // **THE LEAF THAT KEEPS THE RANGE FROM BEING DERIVED.** 25% of the
        // single threshold is $49,325.00, which is $675.00 short of the printed
        // $50,000.00 — so no percentage of the threshold produces the range,
        // and the two figures are indexed by different provisions (one of which
        // has no indexing clause at all).
        //
        // The second half is the direction that matters: if a later edit
        // replaces the stored figure with `threshold * 25 / 100`, THIS reddens.
        theRangeIsStoredRatherThanDerivedFromTheThreshold: () => {
            const threshold = centsFromString(
                qualifiedBusinessIncomeDeduction.thresholdAmount.single.amount)
            const range = centsFromString(
                qualifiedBusinessIncomeDeduction.phaseInRange.single.amount)
            assertEq(threshold, 19730000n, '$197,300.00')
            assertEq(range, 5000000n, '$50,000.00')
            // 19,730,000 * 25 / 100 = 4,932,500 cents = $49,325.00, hand-divided.
            assertEq(threshold * 25n / 100n, 4932500n, '25% of the threshold is $49,325.00')
            assert(
                range !== threshold * 25n / 100n,
                ['the range is NOT a quarter of the threshold', range, threshold * 25n / 100n])
            assertEq(range - threshold * 25n / 100n, 67500n, 'and it is $675.00 more')
        },
        // The printed PART III upper bound is threshold + range, and the page
        // states all four numbers independently: "more than $197,300 but not
        // $247,300 ($394,600 and $494,600 if married filing jointly)". Adding
        // the two stored figures must reproduce the two upper bounds, which is
        // the cheapest check that a wrong range would fail.
        //
        //   19,730,000 + 5,000,000 = 24,730,000  -> $247,300.00
        //   39,460,000 + 10,000,000 = 49,460,000 -> $494,600.00
        theThresholdPlusTheRangeIsThePrintedUpperBound: () => {
            const generalUpperBound = centsFromString(
                qualifiedBusinessIncomeDeduction.thresholdAmount.single.amount)
                + centsFromString(qualifiedBusinessIncomeDeduction.phaseInRange.single.amount)
            assertEq(generalUpperBound, 24730000n, 'Form 8995-A Part III: "but not $247,300"')
            const jointUpperBound = centsFromString(
                qualifiedBusinessIncomeDeduction.thresholdAmount.marriedFilingJointly.amount)
                + centsFromString(
                    qualifiedBusinessIncomeDeduction.phaseInRange.marriedFilingJointly.amount)
            assertEq(jointUpperBound, 49460000n, 'and "$494,600 if married filing jointly"')
            // …and the joint upper bound is exactly double the general one,
            // which is a consequence of both figures doubling rather than an
            // input: it holds only if the range doubled too.
            assertEq(jointUpperBound, generalUpperBound * 2n)
        },
    },
    // ── TAX-33 (Phase 29): §55's exemption, phase-out and two rates ─────────
    alternativeMinimumTax: {
        // Every dollar figure hand-typed from Rev. Proc. 2024-40 §2.11's own
        // three tables and cross-checked against Form 6251's printed line 5
        // chart, per status, so a figure copied from the wrong Rev. Proc. row
        // names itself. The two rows the Rev. Proc. prints are "Joint Returns
        // or Surviving Spouses" and "Unmarried Individuals (other than
        // Surviving Spouses)", neither of which is a filing status this
        // module keys by -- so the MAPPING is what this leaf really pins.
        everyExemptionAndThresholdMatchesTheRevenueProcedure: () => {
            /** @type {Record<IndividualFilingStatus, readonly [string, string, string, string]>} */
            const expected = {
                single: ['88100.00', '626350.00', '978750.00', '239100.00'],
                marriedFilingJointly: ['137000.00', '1252700.00', '1800700.00', '239100.00'],
                marriedFilingSeparately: ['68500.00', '626350.00', '900350.00', '119550.00'],
                // "Unmarried Individuals (other than Surviving Spouses)".
                headOfHousehold: ['88100.00', '626350.00', '978750.00', '239100.00'],
                // "Joint Returns or Surviving Spouses".
                qualifyingSurvivingSpouse: ['137000.00', '1252700.00', '1800700.00', '239100.00'],
            }
            for (const status of individualFilingStatuses) {
                const [exemption, threshold, complete, upper] = expected[status]
                assertEq(
                    alternativeMinimumTax.exemption[status].amount, exemption,
                    ['§55(d)(1) exemption for this status', status])
                assertEq(
                    alternativeMinimumTax.exemptionPhaseoutThreshold[status].amount, threshold,
                    ['§55(d)(2) threshold phase-out amount for this status', status])
                assertEq(
                    alternativeMinimumTax.exemptionCompletePhaseout[status].amount, complete,
                    ['§55(d)(2) complete phase-out amount for this status', status])
                assertEq(
                    alternativeMinimumTax.upperRateThreshold[status].amount, upper,
                    ['§55(b)(1) 28%-rate threshold for this status', status])
            }
        },
        // The Rev. Proc. is the authority, and it is 2024-40 rather than
        // 2025-32 -- checked, not assumed: Rev. Proc. 2025-32's own SECTION 3
        // removes only §2.15(1) and §2.25 of Rev. Proc. 2024-40 for TY2025,
        // and §2.11 is neither. The section string is asserted beside the
        // Rev. Proc. number for the reason `unmodifiedParametersCite2024_40Only`
        // records: a citation whose section was never read is the sourcing
        // error this module's header exists to prevent.
        everyStoredAmountCitesRevProc2024_40Section2_11: () => {
            /** @type {readonly Record<IndividualFilingStatus, AmountWithCitation>[]} */
            const maps = [
                alternativeMinimumTax.exemption,
                alternativeMinimumTax.exemptionPhaseoutThreshold,
                alternativeMinimumTax.exemptionCompletePhaseout,
                alternativeMinimumTax.upperRateThreshold,
            ]
            // Hand-typed beside the loop: four maps, five statuses, twenty
            // citations. A map deleted from the list above would otherwise
            // vanish from the iteration set in the same instant.
            assertEq(maps.length, 4, 'expected exactly the four per-status amount maps')
            for (const map of maps) {
                for (const status of individualFilingStatuses) {
                    const entry = map[status]
                    assertEq(assertRevProcCitation(entry.citation).revProc, '2024-40', status)
                    assertEq(entry.citation.section, '§2.11', status)
                    assertEq(entry.citation.effectiveDate, '2025-01-01', status)
                }
            }
        },
        // THE COMPARISON that keeps the stored third column honest (see this
        // group's own docstring). A complete phase-out amount is the
        // threshold plus `exemption / rate` -- 100/25 = four times the
        // exemption -- so this is the one place the redundancy is checked
        // rather than trusted. The MFS row is the interesting one: it shares
        // the UNMARRIED threshold and takes HALF the exemption, so its
        // complete phase-out is $900,350 rather than $978,750, and a row
        // copied from `single` would redden here and nowhere else.
        theCompletePhaseoutAmountsAgreeWithTheirOwnArithmetic: () => {
            const rate = BigInt(alternativeMinimumTax.exemptionPhaseoutRatePercent)
            for (const status of individualFilingStatuses) {
                const exemption = centsFromString(alternativeMinimumTax.exemption[status].amount)
                const threshold = centsFromString(
                    alternativeMinimumTax.exemptionPhaseoutThreshold[status].amount)
                const complete = centsFromString(
                    alternativeMinimumTax.exemptionCompletePhaseout[status].amount)
                assertEq(
                    complete,
                    threshold + exemption * 100n / rate,
                    [
                        'the stored complete phase-out amount disagrees with threshold + exemption/rate',
                        status, centsToString(complete),
                        centsToString(threshold + exemption * 100n / rate),
                    ],
                )
            }
            // …and the MFS row really is the one that differs from the
            // unmarried row despite sharing its threshold, so the loop above
            // is not passing on five identical shapes.
            assertEq(
                alternativeMinimumTax.exemptionPhaseoutThreshold.marriedFilingSeparately.amount,
                alternativeMinimumTax.exemptionPhaseoutThreshold.single.amount,
                'MFS shares the unmarried THRESHOLD')
            assert(
                alternativeMinimumTax.exemptionCompletePhaseout.marriedFilingSeparately.amount
                    !== alternativeMinimumTax.exemptionCompletePhaseout.single.amount,
                'MFS does NOT share the unmarried COMPLETE phase-out, because its exemption is half')
        },
        // The three rates, hand-typed off §55's own words, with their
        // citation kinds. `kind: 'code'` for all three: the Rev. Proc.
        // publishes the DOLLAR amounts, not the percentages.
        theRatesAreTheStatutoryWholePercents: () => {
            assertEq(alternativeMinimumTax.lowerRatePercent, 26, '§55(b)(1)(A)(i): "26 percent"')
            assertEq(alternativeMinimumTax.upperRatePercent, 28, '§55(b)(1)(A)(ii): "28 percent"')
            assertEq(alternativeMinimumTax.rateCitation.kind, 'code')
            assertEq(alternativeMinimumTax.rateCitation.section, '§55(b)(1)(A)')
            assertEq(alternativeMinimumTax.rateCitation.effectiveDate, '2025-01-01')
            assertEq(
                alternativeMinimumTax.exemptionPhaseoutRatePercent, 25,
                '25 cents of exemption per dollar of AMTI over the threshold')
            assertEq(alternativeMinimumTax.exemptionPhaseoutRateCitation.kind, 'code')
            assertEq(alternativeMinimumTax.exemptionPhaseoutRateCitation.section, '§55(d)(2)')
            assertEq(alternativeMinimumTax.exemptionPhaseoutRateCitation.effectiveDate, '2025-01-01')
        },
        // No `estatesAndTrusts` row, deliberately -- Rev. Proc. 2024-40 §2.11
        // prints one ($30,700 exemption) and Form 6251 is *Individuals*. The
        // absence is asserted rather than left to the type, so widening the
        // map to `FilingStatus` later has to be a decision someone makes on
        // purpose.
        thereIsNoEstateOrTrustRow: () => {
            for (const name of ['exemption', 'exemptionPhaseoutThreshold', 'exemptionCompletePhaseout', 'upperRateThreshold']) {
                const map = alternativeMinimumTax[
                    /** @type {'exemption' | 'exemptionPhaseoutThreshold' | 'exemptionCompletePhaseout' | 'upperRateThreshold'} */
                    (name)]
                assertEq(Object.keys(map).length, individualFilingStatuses.length, name)
                assert(
                    !Object.keys(map).includes('estatesAndTrusts'),
                    ['an estate or trust computes AMT on Schedule I (Form 1041), not Form 6251', name])
            }
        },
    },
    // ── Form 8962's three parameter groups (TAX-37) ─────────────────────────
    federalPovertyLine: {
        // Every one of the twenty-four printed rows of i8962 Tables 1-1, 1-2
        // and 1-3, hand-typed from the printed page and NOT derived from the
        // stored base-and-increment pair — which is the whole point, since
        // that pair is the thing under test. Family sizes 1 through 8, three
        // tables.
        allTwentyFourPrintedRowsAgreeWithTheStoredBaseAndIncrement: () => {
            /** @type {Record<FederalPovertyLineTable, readonly bigint[]>} */
            const printed = {
                contiguous48AndDistrictOfColumbia: [
                    1506000n, 2044000n, 2582000n, 3120000n, 3658000n, 4196000n, 4734000n, 5272000n,
                ],
                alaska: [
                    1881000n, 2554000n, 3227000n, 3900000n, 4573000n, 5246000n, 5919000n, 6592000n,
                ],
                hawaii: [
                    1731000n, 2350000n, 2969000n, 3588000n, 4207000n, 4826000n, 5445000n, 6064000n,
                ],
            }
            for (const table of federalPovertyLineTables) {
                const rows = printed[table]
                assertEq(rows.length, 8, ['each printed table has eight rows', table])
                const first = centsFromString(federalPovertyLine[table].firstPerson.amount)
                const each = centsFromString(federalPovertyLine[table].eachAdditionalPerson.amount)
                for (let size = 1; size <= 8; ++size) {
                    const expected = assertNotNullish(rows[size - 1], ['row', table, size])
                    assertEq(
                        first + each * BigInt(size - 1),
                        expected,
                        [
                            'the stored base-and-increment must reproduce this printed row exactly',
                            table,
                            size,
                            centsToString(expected),
                        ],
                    )
                }
            }
        },
        // The footnote under each printed table works one example, and all
        // three are worked here: "if your family size is 11 ... Enter the
        // result of $68,860" (contiguous), $86,110 (Alaska), $79,210
        // (Hawaii). This is what proves the increment is the increment rather
        // than a number that merely happens to fit eight rows.
        theOverEightFootnoteExamplesAreReproduced: () => {
            /** @type {Record<FederalPovertyLineTable, bigint>} */
            const familyOfEleven = {
                contiguous48AndDistrictOfColumbia: 6886000n,
                alaska: 8611000n,
                hawaii: 7921000n,
            }
            for (const table of federalPovertyLineTables) {
                const expected = familyOfEleven[table]
                assertEq(
                    centsFromString(federalPovertyLine[table].firstPerson.amount)
                        + centsFromString(federalPovertyLine[table].eachAdditionalPerson.amount) * 10n,
                    expected,
                    ['i8962’s own worked example for a family of eleven', table, centsToString(expected)],
                )
            }
        },
        // The three tables are genuinely DIFFERENT figures, not one table
        // referenced three times. A spread would make this leaf impossible to
        // fail and the Alaska/Hawaii uplift impossible to observe going
        // missing.
        theThreeTablesAreThreeDistinctSchedules: () => {
            const amounts = federalPovertyLineTables.map(
                table => federalPovertyLine[table].firstPerson.amount)
            assertEq(new Set(amounts).size, 3, ['three tables, three first-person amounts', amounts])
            const increments = federalPovertyLineTables.map(
                table => federalPovertyLine[table].eachAdditionalPerson.amount)
            assertEq(new Set(increments).size, 3, ['three tables, three increments', increments])
            // Alaska is the highest of the three at every family size, and
            // Hawaii sits between it and the mainland. Asserted because a
            // transposition of the two would keep all three distinct.
            assert(
                centsFromString(federalPovertyLine.alaska.firstPerson.amount)
                    > centsFromString(federalPovertyLine.hawaii.firstPerson.amount),
                'Alaska’s poverty line is above Hawaii’s')
            assert(
                centsFromString(federalPovertyLine.hawaii.firstPerson.amount)
                    > centsFromString(
                        federalPovertyLine.contiguous48AndDistrictOfColumbia.firstPerson.amount),
                'Hawaii’s poverty line is above the contiguous 48’s')
        },
        // The PRIOR-year sourcing, made assertable. The 2025 contiguous
        // first-person guideline is $15,650; this parameter must be $15,060,
        // the 2024 one, because that is what the 2025 Form 8962 uses. The
        // wrong-year figure is hand-typed here so the check is a comparison
        // against a real alternative rather than against nothing.
        theFiguresAreTheTwentyTwentyFourGuidelinesNotTheTwentyTwentyFiveOnes: () => {
            const twentyTwentyFiveContiguousFirstPerson = 1565000n
            assertEq(
                centsFromString(
                    federalPovertyLine.contiguous48AndDistrictOfColumbia.firstPerson.amount),
                1506000n,
                'i8962 Table 1-1 prints $15,060 — the 2024 guideline')
            assert(
                centsFromString(
                    federalPovertyLine.contiguous48AndDistrictOfColumbia.firstPerson.amount)
                    !== twentyTwentyFiveContiguousFirstPerson,
                'the 2025 guideline ($15,650) is NOT what the 2025 Form 8962 uses — see this group’s docstring')
        },
        everyFigureCitesTheFederalRegisterNoticeThatPublishedIt: () => {
            for (const table of federalPovertyLineTables) {
                for (const entry of [
                    federalPovertyLine[table].firstPerson,
                    federalPovertyLine[table].eachAdditionalPerson,
                ]) {
                    assertEq(entry.citation.kind, 'federalRegister', table)
                    const citation = entry.citation
                    assert(
                        citation.kind === 'federalRegister',
                        ['expected a federalRegister-kind citation', table, citation])
                    assertEq(citation.federalRegister, '89 FR 2961', table)
                    assertEq(citation.effectiveDate, '2025-01-01', table)
                    assert(
                        citation.section.includes('2024'),
                        [
                            'the citation must say which YEAR of guidelines these are, since that is the trap',
                            table,
                            citation.section,
                        ])
                }
            }
        },
    },
    premiumTaxCreditApplicablePercentage: {
        // The six tiers of §36B(b)(3)(A)(iii), hand-typed from the statute
        // rather than read back off the stored list, and compared entry by
        // entry. The hand-typed COUNT is what a dropped tier fails.
        theSixStatutoryTiers: () => {
            /** @type {readonly (readonly [number, number | undefined, number, number])[]} */
            const statutory = [
                [0, 150, 0, 0],
                [150, 200, 0, 200],
                [200, 250, 200, 400],
                [250, 300, 400, 600],
                [300, 400, 600, 850],
                [400, undefined, 850, 850],
            ]
            assertEq(
                premiumTaxCreditApplicablePercentage.tiers.length,
                6,
                '§36B(b)(3)(A)(iii) prints six income tiers')
            assertEq(statutory.length, 6, 'and the hand-typed statement of them has six too')
            for (let i = 0; i < statutory.length; ++i) {
                const expected = assertNotNullish(statutory[i], ['hand-typed tier', i])
                const stored = assertNotNullish(premiumTaxCreditApplicablePercentage.tiers[i], ['stored tier', i])
                assertEq(stored.floorPercent, expected[0], ['tier floor', i])
                assertEq(stored.ceilingPercent, expected[1], ['tier ceiling', i])
                assertEq(stored.initialHundredthsOfPercent, expected[2], ['tier initial percentage', i])
                assertEq(stored.finalHundredthsOfPercent, expected[3], ['tier final percentage', i])
            }
        },
        // The tiers are CONTIGUOUS and cover every percentage from zero
        // upwards with no gap and no overlap. A gap would make one household
        // income have no applicable figure at all, which the printed table
        // never does.
        theTiersCoverEveryPercentageWithoutAGapOrAnOverlap: () => {
            const tiers = premiumTaxCreditApplicablePercentage.tiers
            const first = assertNotNullish(tiers[0], 'the tier list is not empty')
            assertEq(first.floorPercent, 0, 'the first tier starts at zero')
            for (let i = 1; i < tiers.length; ++i) {
                const previous = assertNotNullish(tiers[i - 1], ['previous tier', i])
                const current = assertNotNullish(tiers[i], ['current tier', i])
                assertEq(
                    previous.ceilingPercent,
                    current.floorPercent,
                    ['each tier begins exactly where the last one ended', i])
                assertEq(
                    previous.finalHundredthsOfPercent,
                    current.initialHundredthsOfPercent,
                    ['and the percentage is continuous across the join', i])
            }
            const last = assertNotNullish(tiers[tiers.length - 1], 'the tier list is not empty')
            assertEq(last.ceilingPercent, undefined, 'the last tier is open-topped, with no sentinel')
        },
        // The top tier exists AT ALL, which is the ARPA/IRA change: before it,
        // a household above 400% of the poverty line had no applicable figure
        // and therefore no credit.
        thereIsStillAnApplicableFigureAboveFourHundredPercent: () => {
            const top = assertNotNullish(
                premiumTaxCreditApplicablePercentage.tiers[
                    premiumTaxCreditApplicablePercentage.tiers.length - 1],
                'the tier list is not empty')
            assertEq(top.floorPercent, 400)
            assertEq(top.initialHundredthsOfPercent, 850, '8.50% — i8962 Table 2’s "400 or more" row')
            assertEq(top.finalHundredthsOfPercent, 850, 'flat, not sliding')
        },
        theCitationIsTheStatuteAndNotARevenueProcedure: () => {
            // §36B(b)(3)(A)(ii)'s indexing is switched off for tax years
            // beginning before 2026, so no Rev. Proc. adjusts this table and
            // naming one would be an invented source.
            assertEq(premiumTaxCreditApplicablePercentage.citation.kind, 'code')
            assertEq(premiumTaxCreditApplicablePercentage.citation.section, '§36B(b)(3)(A)(iii)')
            assertEq(premiumTaxCreditApplicablePercentage.citation.effectiveDate, '2025-01-01')
        },
    },
    premiumTaxCreditRepaymentLimitation: {
        // The three printed rows of i8962 Table 5, hand-typed from the page.
        theThreePrintedBands: () => {
            /** @type {readonly (readonly [number, bigint, bigint])[]} */
            const printed = [
                [200, 37500n, 75000n],
                [300, 97500n, 195000n],
                [400, 162500n, 325000n],
            ]
            assertEq(
                premiumTaxCreditRepaymentLimitation.bands.length,
                3,
                'i8962 Table 5 has THREE capped rows; the fourth row is "leave line 28 blank"')
            assertEq(printed.length, 3)
            for (let i = 0; i < printed.length; ++i) {
                const expected = assertNotNullish(printed[i], ['hand-typed band', i])
                const stored = assertNotNullish(premiumTaxCreditRepaymentLimitation.bands[i], ['stored band', i])
                assertEq(stored.povertyLinePercentCeiling, expected[0], ['band ceiling', i])
                assertEq(centsFromString(stored.single), expected[1], ['single column', i])
                assertEq(centsFromString(stored.other), expected[2], ['any-other-status column', i])
            }
        },
        // There is NO band at or above 400, and the absence is asserted
        // rather than left to the reader: a fourth band would be a silent cap
        // on an uncapped repayment.
        thereIsNoBandAtOrAboveFourHundredPercent: () => {
            for (const band of premiumTaxCreditRepaymentLimitation.bands) {
                assert(
                    band.povertyLinePercentCeiling <= 400,
                    ['no Table 5 band caps a household at or above 400% of the poverty line', band])
            }
            assert(
                !premiumTaxCreditRepaymentLimitation.bands.some(
                    band => band.povertyLinePercentCeiling > 400),
                'i8962 line 28: "If your entry on Form 8962, line 5, is 400 or more, there is no repayment limitation"')
        },
        // The "any other filing status" column is exactly twice the Single
        // one in all three bands — which is a property of the printed table
        // and NOT how either column is stored. Asserted as a cross-check on
        // the transcription, in the direction a single transposed digit would
        // break.
        theOtherColumnIsTwiceTheSingleColumnInEveryBand: () => {
            for (const band of premiumTaxCreditRepaymentLimitation.bands) {
                assertEq(
                    centsFromString(band.other),
                    centsFromString(band.single) * 2n,
                    ['Rev. Proc. 2024-40 §2.07 prints the second column at twice the first', band])
            }
        },
        theBandsAreOrderedAndStrictlyIncreasing: () => {
            const bands = premiumTaxCreditRepaymentLimitation.bands
            for (let i = 1; i < bands.length; ++i) {
                const previous = assertNotNullish(bands[i - 1], ['previous band', i])
                const current = assertNotNullish(bands[i], ['current band', i])
                assert(
                    previous.povertyLinePercentCeiling < current.povertyLinePercentCeiling,
                    ['Table 5 reads downwards in increasing income order', i])
                assert(
                    centsFromString(previous.single) < centsFromString(current.single),
                    ['and the limitation rises with income', i])
            }
        },
        theCitationIsTheRevenueProcedureThatIndexedTheAmounts: () => {
            const citation = assertRevProcCitation(premiumTaxCreditRepaymentLimitation.citation)
            assertEq(citation.revProc, '2024-40')
            assertEq(citation.section, '§2.07')
            assertEq(citation.effectiveDate, '2025-01-01')
        },
    },
    // ── Form 2441 (TAX-38) ──────────────────────────────────────────────────
    //
    // Every expected value below is hand-typed off the printed 2025 Form 2441
    // and its instructions. Nothing here is produced by `fjs/form2441`.
    dependentCareExpenseLimit: {
        // f2441 line 3: "Don't enter more than $3,000 if you had one
        // qualifying person or $6,000 if you had two or more persons", and
        // line 27 prints the identical pair.
        theTwoPrintedAmounts: () => {
            assertEq(
                centsFromString(dependentCareExpenseLimit.oneQualifyingPerson.amount),
                300000n,
                '$3,000.00 for one qualifying person')
            assertEq(
                centsFromString(dependentCareExpenseLimit.twoOrMoreQualifyingPersons.amount),
                600000n,
                '$6,000.00 for two or more')
        },
        // The pair is 1:2, which is a property of the printed page and not of
        // how either amount is stored. A transposed digit in either breaks it.
        theSecondIsExactlyTwiceTheFirst: () => {
            assertEq(
                centsFromString(dependentCareExpenseLimit.twoOrMoreQualifyingPersons.amount),
                centsFromString(dependentCareExpenseLimit.oneQualifyingPerson.amount) * 2n)
        },
        // `kind: 'code'` and not `'revProc'`: §21(c) is a plain statutory
        // dollar amount that no annual Revenue Procedure inflation-adjusts.
        bothCiteTheCodeSectionRatherThanARevenueProcedure: () => {
            for (const entry of [
                dependentCareExpenseLimit.oneQualifyingPerson,
                dependentCareExpenseLimit.twoOrMoreQualifyingPersons,
            ]) {
                assertEq(entry.citation.kind, 'code', ['§21(c) is not inflation-adjusted', entry])
                assertEq(entry.citation.effectiveDate, '2025-01-01')
            }
            assertEq(dependentCareExpenseLimit.oneQualifyingPerson.citation.section, '§21(c)(1)')
            assertEq(
                dependentCareExpenseLimit.twoOrMoreQualifyingPersons.citation.section,
                '§21(c)(2)')
        },
    },
    dependentCareCreditPercentage: {
        // All sixteen printed rows of Form 2441 line 8's table, hand-typed as
        // the form prints them: the "But not over" ceiling and the decimal
        // amount, in printed order. The count is hand-typed BESIDE the list
        // so a row silently dropped from the stored table fails here even
        // though a loop over the stored rows would happily iterate one fewer.
        theSixteenPrintedRows: () => {
            /** @type {readonly (readonly [string | undefined, number])[]} */
            const printed = [
                ['15000.00', 35], ['17000.00', 34], ['19000.00', 33], ['21000.00', 32],
                ['23000.00', 31], ['25000.00', 30], ['27000.00', 29], ['29000.00', 28],
                ['31000.00', 27], ['33000.00', 26], ['35000.00', 25], ['37000.00', 24],
                ['39000.00', 23], ['41000.00', 22], ['43000.00', 21], [undefined, 20],
            ]
            assertEq(printed.length, 16, 'the printed table has sixteen rows')
            assertEq(
                dependentCareCreditPercentage.bands.length,
                16,
                'and the stored table has sixteen too')
            for (let i = 0; i < printed.length; ++i) {
                const row = assertNotNullish(printed[i], ['printed row', i])
                const band = assertNotNullish(dependentCareCreditPercentage.bands[i], ['band', i])
                const [ceiling, percent] = row
                assertEq(band.adjustedGrossIncomeCeiling, ceiling, ['row ceiling', i])
                assertEq(band.percent, percent, ['row percentage', i])
            }
        },
        // §21(a)(2)'s own arithmetic, checked against the transcription from
        // the other side: 35 less one point per $2,000 (or fraction) above
        // $15,000, floored at 20. Independent of the loop above because it
        // derives each row rather than reading it.
        everyRowMatchesTheStatutoryArithmetic: () => {
            const bands = dependentCareCreditPercentage.bands
            for (let i = 0; i < bands.length; ++i) {
                const band = assertNotNullish(bands[i], ['band', i])
                assertEq(
                    band.percent,
                    Math.max(20, 35 - i),
                    ['§21(a)(2) drops one percentage point per $2,000 step', i])
            }
        },
        // The last row is OPEN-TOPPED — "43,000 — No limit" — and every other
        // row has a ceiling. A sentinel in the last slot would look like a
        // ceiling and become one the first time anybody compared against it.
        onlyTheLastRowIsOpenTopped: () => {
            const bands = dependentCareCreditPercentage.bands
            const last = assertNotNullish(bands[bands.length - 1], 'the last band')
            assertEq(last.adjustedGrossIncomeCeiling, undefined, '"43,000 — No limit"')
            assertEq(last.percent, 20, 'the statutory floor of 20 percent')
            for (let i = 0; i < bands.length - 1; ++i) {
                assert(
                    assertNotNullish(bands[i], ['band', i]).adjustedGrossIncomeCeiling !== undefined,
                    ['every row but the last prints a "But not over" amount', i])
            }
        },
        // The ceilings rise and the percentages fall, monotonically. Two rows
        // transposed break this without breaking any single hand-typed row
        // outside the transposed pair.
        theCeilingsRiseAndThePercentagesFall: () => {
            const bands = dependentCareCreditPercentage.bands
            for (let i = 1; i < bands.length; ++i) {
                const previous = assertNotNullish(bands[i - 1], ['previous', i])
                const current = assertNotNullish(bands[i], ['current', i])
                const previousCeiling = previous.adjustedGrossIncomeCeiling
                const currentCeiling = current.adjustedGrossIncomeCeiling
                assert(previousCeiling !== undefined, ['only the last row is open-topped', i])
                if (previousCeiling !== undefined && currentCeiling !== undefined) {
                    assert(
                        centsFromString(previousCeiling) < centsFromString(currentCeiling),
                        ['the table reads downwards in increasing income order', i])
                }
                assert(
                    current.percent < previous.percent,
                    ['and the percentage falls as income rises', i])
            }
        },
        // Every printed step is exactly $2,000 wide after the first, which is
        // §21(a)(2)'s "$2,000 (or fraction thereof)" written as a table.
        everyStepAfterTheFirstIsTwoThousandDollarsWide: () => {
            const bands = dependentCareCreditPercentage.bands
            for (let i = 2; i < bands.length - 1; ++i) {
                const previous = assertNotNullish(
                    assertNotNullish(bands[i - 1], ['previous', i]).adjustedGrossIncomeCeiling,
                    ['previous ceiling', i])
                const current = assertNotNullish(
                    assertNotNullish(bands[i], ['current', i]).adjustedGrossIncomeCeiling,
                    ['current ceiling', i])
                assertEq(
                    centsFromString(current) - centsFromString(previous),
                    200000n,
                    ['$2,000.00 per step', i])
            }
        },
        theCitationIsTheCodeSection: () => {
            assertEq(dependentCareCreditPercentage.citation.kind, 'code')
            assertEq(dependentCareCreditPercentage.citation.section, '§21(a)(2)')
            assertEq(dependentCareCreditPercentage.citation.effectiveDate, '2025-01-01')
        },
    },
    dependentCareAssistanceExclusionLimit: {
        // i2441 p5, Line 21: "For 2025, the maximum amount that can be
        // excluded from your income through a dependent care assistance
        // program is $5,000 ($2,500 if married filing separately)."
        theTwoPrintedAmounts: () => {
            assertEq(
                centsFromString(dependentCareAssistanceExclusionLimit.standard.amount),
                500000n,
                '$5,000.00')
            assertEq(
                centsFromString(
                    dependentCareAssistanceExclusionLimit.marriedFilingSeparately.amount),
                250000n,
                '$2,500.00 — HALF, not the same figure')
        },
        // The married-filing-separately figure is exactly half, asserted in
        // the direction a copy-paste of the $5,000 row would break.
        theSeparateFigureIsHalf: () => {
            assertEq(
                centsFromString(
                    dependentCareAssistanceExclusionLimit.marriedFilingSeparately.amount) * 2n,
                centsFromString(dependentCareAssistanceExclusionLimit.standard.amount))
        },
        bothCiteSectionOneTwentyNine: () => {
            for (const entry of [
                dependentCareAssistanceExclusionLimit.standard,
                dependentCareAssistanceExclusionLimit.marriedFilingSeparately,
            ]) {
                assertEq(entry.citation.kind, 'code')
                assertEq(entry.citation.section, '§129(a)(2)(A)')
                assertEq(entry.citation.effectiveDate, '2025-01-01')
            }
        },
    },
    dependentCareDeemedEarnedIncomePerMonth: {
        // i2441 p4: "Their earned income for each month is considered to be
        // at least $250 ($500 if you had two or more qualifying persons at
        // any time during 2025)."
        theTwoPrintedMonthlyAmounts: () => {
            assertEq(
                centsFromString(
                    dependentCareDeemedEarnedIncomePerMonth.oneQualifyingPerson.amount),
                25000n,
                '$250.00 a month')
            assertEq(
                centsFromString(
                    dependentCareDeemedEarnedIncomePerMonth.twoOrMoreQualifyingPersons.amount),
                50000n,
                '$500.00 a month for two or more qualifying persons')
        },
        // Twelve months of the deemed amount is exactly the matching expense
        // cap ($3,000 and $6,000) — an arithmetic relationship between two
        // INDEPENDENTLY stored tables, which is why it is worth asserting: it
        // catches a digit dropped from either one.
        twelveMonthsOfEachIsTheMatchingExpenseCap: () => {
            assertEq(
                centsFromString(
                    dependentCareDeemedEarnedIncomePerMonth.oneQualifyingPerson.amount) * 12n,
                centsFromString(dependentCareExpenseLimit.oneQualifyingPerson.amount),
                '12 x $250.00 = $3,000.00')
            assertEq(
                centsFromString(
                    dependentCareDeemedEarnedIncomePerMonth.twoOrMoreQualifyingPersons.amount)
                    * 12n,
                centsFromString(dependentCareExpenseLimit.twoOrMoreQualifyingPersons.amount),
                '12 x $500.00 = $6,000.00')
        },
        bothCiteTheirOwnSubparagraph: () => {
            assertEq(
                dependentCareDeemedEarnedIncomePerMonth.oneQualifyingPerson.citation.section,
                '§21(d)(2)(A)')
            assertEq(
                dependentCareDeemedEarnedIncomePerMonth.twoOrMoreQualifyingPersons.citation.section,
                '§21(d)(2)(B)')
        },
    },
}

