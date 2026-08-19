/**
 * The sample return: one household's documents, exactly as they would be
 * stored.
 *
 * These are INPUTS. Not one figure below is an expected result — every number
 * the demo displays is computed from these by the shipped engine. The only
 * hand-typed expected values in the whole demo are step 2's two regression
 * cases, which are labelled as such where they appear and were reproduced
 * independently four times before being written down.
 *
 * Money is a `string` in every stored document and never a JSON number. That
 * is the dialects' rule, not a demo convention: `1284.37` as a JSON number is
 * a double, and a double cannot hold every cents value exactly. The engine
 * parses these strings to `bigint` cents and never leaves that representation.
 *
 * **Every value below is annotated with the engine's own dialect type** — as a
 * variable annotation, never a cast, because AGENTS.md bans casts and because
 * an annotation is what makes `tsc` CHECK these literals rather than infer
 * whatever they happen to be. A typo in a box name or a money field arriving
 * as a number fails the build here, before anything renders.
 *
 * @module
 */
import { store } from './engine.js'

/** @import { W2 } from '../../fjs/document/w2/module.f.js' */
/** @import { OneZeroNineNineInt } from '../../fjs/document/1099int/module.f.js' */
/** @import { ReturnProfile } from '../../fjs/return/profile/module.f.js' */
/** @import { Unknown } from 'functionalscript/fjs/media/json/module.f.js' */

/** The household. Names are fictional; TINs are IRS-reserved test ranges.
 * @type {ReturnProfile}
 */
const returnProfileValue = {
    dialect: 'vnd.fjs.return_profile',
    taxYear: 2025,
    filingStatus: 'marriedFilingJointly',
    dependentCount: 0,
    declaredKinds: [
        'wages',
        'taxExemptInterest',
        'taxableInterest',
        'federalTaxWithheldOnW2',
        'federalTaxWithheldOn1099Int',
        'estimatedTaxPayments',
    ],
    line26EstimatedTaxPayments: '2500.00',
}

export const returnProfile = store(returnProfileValue)

/** Dana's W-2. @type {W2} */
const w2DanaValue = {
    dialect: 'vnd.fjs.w2',
    payerTin: '11-1111111',
    recipientTin: '222-22-2222',
    accountNumber: 'W2-DANA-2025',
    taxYear: 2025,
    formRevision: '2025',
    employerName: 'Northwind Traders',
    employeeName: 'Dana Okafor',
    box1WagesTipsOtherCompensation: '82400.00',
    box2FederalIncomeTaxWithheld: '9140.00',
}

export const w2Dana = store(w2DanaValue)

/** Ray's W-2. @type {W2} */
const w2RayValue = {
    dialect: 'vnd.fjs.w2',
    payerTin: '33-3333333',
    recipientTin: '444-44-4444',
    accountNumber: 'W2-RAY-2025',
    taxYear: 2025,
    formRevision: '2025',
    employerName: 'Cascade Public Library',
    employeeName: 'Ray Okafor',
    box1WagesTipsOtherCompensation: '61250.00',
    box2FederalIncomeTaxWithheld: '6310.00',
}

export const w2Ray = store(w2RayValue)

/**
 * The joint savings 1099-INT. Box 8 is tax-exempt interest, which lands on
 * line 2a and is deliberately NOT added into line 2b — a distinction worth
 * showing, since a spreadsheet that sums "interest" gets it wrong.
 * @type {OneZeroNineNineInt}
 */
const int1099SavingsValue = {
    dialect: 'vnd.fjs.1099int',
    payerTin: '55-5555555',
    recipientTin: '222-22-2222',
    accountNumber: 'SAV-8842',
    taxYear: 2025,
    formRevision: '2025',
    payerName: 'Cascadia Mutual Savings',
    box1InterestIncome: '1284.37',
    box4FederalIncomeTaxWithheld: '128.00',
    box8TaxExemptInterest: '410.00',
}

export const int1099Savings = store(int1099SavingsValue)

/**
 * A second 1099-INT carrying box 3, US savings bond and Treasury interest.
 * Boxes 1 and 3 BOTH feed line 2b, which is why line 2b cites two boxes of
 * this one document.
 * @type {OneZeroNineNineInt}
 */
const int1099TreasuryValue = {
    dialect: 'vnd.fjs.1099int',
    payerTin: '66-6666666',
    recipientTin: '222-22-2222',
    accountNumber: 'TRE-0091',
    taxYear: 2025,
    formRevision: '2025',
    payerName: 'Treasury Direct',
    box1InterestIncome: '92.15',
    box3UsSavingsBondsAndTreasuryInterest: '340.00',
}

export const int1099Treasury = store(int1099TreasuryValue)

/**
 * Every document in the sample return, in the order the Documents step lists
 * them.
 *
 * `value` is typed as an arbitrary JSON value, which is the widest thing all
 * three dialects share and exactly what a dialect validator accepts — so the
 * Documents step can re-validate each of these without a cast. This list
 * exists to be ITERATED for display; a step needing one dialect's fields
 * imports that document directly and keeps its precise type.
 * @type {readonly {
 *   readonly label: string,
 *   readonly dialect: string,
 *   readonly stored: { readonly documentHash: string, readonly value: Unknown },
 * }[]}
 */
export const documents = [
    { label: 'Return profile', dialect: 'vnd.fjs.return_profile', stored: returnProfile },
    { label: 'W-2 — Dana', dialect: 'vnd.fjs.w2', stored: w2Dana },
    { label: 'W-2 — Ray', dialect: 'vnd.fjs.w2', stored: w2Ray },
    { label: '1099-INT — savings', dialect: 'vnd.fjs.1099int', stored: int1099Savings },
    { label: '1099-INT — Treasury', dialect: 'vnd.fjs.1099int', stored: int1099Treasury },
]

/**
 * Which document a CAS address belongs to, for a friendlier citation than a
 * bare hash.
 *
 * Lives here rather than in a step because two steps need it — the Return
 * step's line detail and the Form 1040 step's amount detail — and a citation
 * label that reads differently on two pages of one demo is a small lie about
 * whether they are looking at the same document.
 * @type {(hash: string) => string}
 */
export const documentLabel = hash => {
    const found = documents.find(document => document.stored.documentHash === hash)
    return found === undefined ? '(unknown document)' : found.label
}

/**
 * The engine's `Form1040Inputs` for the sample return. `dividendForms`/
 * `brokerageForms` are Plan 12.1-04's own widening of `Form1040Inputs`;
 * `retirementForms`/`socialSecurityForms` are Plan 13-02's own widening;
 * `itemizedDeductionForms`/`medicalExpenseForms` are Plan 13-07's own
 * widening; `capitalLossCarryoverForms` is Plan 15-05's own widening
 * (TAX-17) — the sample return holds none of the seven, so all are empty;
 * `inputsDeclaring` below spreads `...inputs`, so every field is inherited
 * automatically by every demo step that consumes it.
 */
export const inputs = {
    profile: returnProfile,
    w2s: [w2Dana, w2Ray],
    interestForms: [int1099Savings, int1099Treasury],
    dividendForms: [],
    brokerageForms: [],
    retirementForms: [],
    socialSecurityForms: [],
    itemizedDeductionForms: [],
    medicalExpenseForms: [],
    capitalLossCarryoverForms: [],
    unemploymentForms: [],
    adjustmentForms: [],
    studentLoanInterestForms: [],
    tuitionForms: [],
    creditForms: [],
    iraForms: [],
    nonemployeeCompensationForms: [],
    businessExpenseForms: [],
    priorYearIraBasisForms: [],
    isoExerciseForms: [],
    partnershipK1Forms: [],
    sCorporationK1Forms: [],
    estateTrustK1Forms: [],
    employeeStockPurchaseForms: [],
    basisCorrectionForms: [],
    marketplaceStatements: [],
}

/**
 * The same return with extra declared kinds, used by the Refusal step.
 *
 * The profile is RE-STORED rather than edited in place, so its address changes
 * with its content: a different declaration is a different document, and the
 * page shows that honestly.
 * @type {(extraKinds: readonly ReturnProfile['declaredKinds'][number][]) => typeof inputs}
 */
export const inputsDeclaring = extraKinds => ({
    ...inputs,
    profile: store({
        ...returnProfileValue,
        declaredKinds: [...returnProfileValue.declaredKinds, ...extraKinds],
    }),
})

/**
 * The same return with the taxpayer's whole-dollar election set, used by the
 * Exactness step.
 * @type {(elected: boolean) => ReturnProfile}
 */
export const profileElecting = elected => elected
    ? { ...returnProfileValue, wholeDollarElection: true }
    : returnProfileValue

/**
 * Ten identical $1.39 interest documents, for the Exactness step.
 *
 * i1040gi p23: "If you have to add two or more amounts to figure the amount to
 * enter on a line, include cents when adding the amounts and round off only
 * the total." Ten of these sum to $13.90, which rounds to $14. Rounding each
 * one first gives ten $1s. The engine applies the election ONCE, over the
 * whole line list, at the end.
 */
export const tenSmallInterestForms = Array.from({ length: 10 }, (_, index) => {
    /** @type {OneZeroNineNineInt} */
    const value = {
        dialect: 'vnd.fjs.1099int',
        payerTin: '77-7777777',
        recipientTin: '222-22-2222',
        accountNumber: `MICRO-${String(index + 1).padStart(2, '0')}`,
        taxYear: 2025,
        formRevision: '2025',
        payerName: 'Ten small accounts',
        box1InterestIncome: '1.39',
    }
    return store(value)
})

/** The per-document amount those ten carry, named once so no step re-types it. */
export const smallInterestAmount = '1.39'
