/**
 * `vnd.fjs.1099r` — DOC-09: Form 1099-R, Distributions From Pensions,
 * Annuities, Retirement or Profit-Sharing Plans, IRAs, Insurance Contracts,
 * etc.
 *
 * Sources, fetched and read directly (11-RESEARCH.md Q1), not from recall:
 * - `https://www.irs.gov/pub/irs-pdf/f1099r.pdf` — the 2026 revision ("Form
 *   1099-R Created 4/2/26"), modeled here as the fuller box set. Fetched
 *   2026-08-07.
 * - `https://www.irs.gov/pub/irs-prior/f1099r--2025.pdf` — the 2025 revision
 *   ("Form 1099-R Created 3/20/25"), what a payer actually issued for TY2025
 *   (the declared taxpayer profile's tax year), diffed against the 2026 form
 *   above. Fetched 2026-08-07.
 *
 * **Boxes 7c (Trump account) and 7d (Earnings on excess contrib.), and the
 * 8a/8b split (Other $ / Percentage of annuity contract %), are 2026-only
 * additions — absent on every real TY2025 document.** The 2025 form prints
 * 7 as one undifferentiated "Distribution code(s)" box (7a/7b's sub-labels
 * are a cosmetic 2026 split of the same box) and 8 as one combined
 * "8 Other $ ___ %" box. Modeling the fuller 2026 set is harmless because
 * every added/split field is `option`-typed (DOC-11): a TY2025 document
 * simply never populates `box7cTrumpAccount` / `box7dEarningsOnExcessContrib`,
 * and the ingestion pass reads the printed `$` into `box8aOther` and the
 * printed `%` into `box8bPercentageOfAnnuityContract` regardless of whether
 * the physical page shows one bordered box or two. Everything else (boxes 1,
 * 2a, 2b's two checkboxes, 3, 4, 5, 6, 9a, 9b, 10, 11, 12, 13, 14-19, and the
 * VOID/CORRECTED header) is identical in meaning and number across both
 * revisions — verified by reading both PDFs, not assumed.
 *
 * **`formRevision` is never derived from `taxYear` (DOC-10).** The
 * "Created MM/DD/YY" string that best identifies a revision prints only on
 * Copy A (the copy filed with the IRS, which a taxpayer never possesses).
 * Copy B/C/2 — what a recipient actually receives and uploads — prints only
 * "Form 1099-R www.irs.gov/Form1099R", with no "Created" date at all; the
 * only revision-distinguishing mark on a recipient's own copy is the
 * "20 25"/"20 26" year watermark, i.e. the same value this schema already
 * stores as `taxYear`. In practice `formRevision` and `taxYear` will usually
 * collapse to the same printed text for a recipient's copy — weaker than
 * DOC-10's stated ideal, but it is the most precise information the source
 * document actually carries, and it stays a field the ingestion pass records
 * verbatim rather than a value ever computed from `taxYear` in code, so a
 * future document that DOES carry a distinguishable revision string can
 * still say so.
 *
 * Follows the `fjs/media/revision` four-stage template exactly as
 * `fjs/document/1099int/module.f.js` and `fjs/document/w2/module.f.js` do:
 * dialect -> mediaType -> schema -> structural validate -> semantic
 * `checkReferences` -> composed `validate`.
 *
 * Field-shape notes:
 * - **Box 7a is a LIST of distribution codes
 *   (`box7aDistributionCodes: option(array(string))`), never a
 *   `(code, amount)` pair-list.** Unlike W-2 box 12, there is no per-code
 *   amount printed beside a 1099-R distribution code — IRS convention
 *   allows up to two codes in the one printed box (e.g. a normal
 *   distribution that is also a direct rollover), and the codes carry the
 *   meaning, not their position, so a list is the right shape — but with no
 *   attached amount to make an empty code meaningless, unlike box 12.
 * - **Boxes 14-19 are a repeating array (`stateLocal`), faithfully stored
 *   and never COMPUTED on** — mirroring `fjs/document/w2/module.f.js`'s
 *   boxes 15-20 exactly. The printed layout on both revisions shows two
 *   stacked `$` lines per box, meaning the physical form itself anticipates
 *   more than one state/locality per document; a payer can report more than
 *   one state, and fixed slot fields cannot express that.
 *
 *   **As of Phase 13 (TAX-13, 13-CONTEXT.md Decision 2.2), `fjs/schedule/a`
 *   now READS `stateTaxWithheld` (never "box 14" by name — the array shape
 *   means there is no single schema key by that name) from this array IN
 *   ITS OWN REAL COMPUTATION** (WR-02, 13-REVIEW.md widened this from "a
 *   PROOF reads it" to "the production path reads it": `scheduleA`'s own
 *   withholding-drift check is wired into every return `fjs/form1040/core`
 *   processes, not merely into this module's own hand-written fixtures) —
 *   not to compute anything, but to WATCH whether the taxpayer-asserted
 *   Schedule A line 5a (state/local income tax paid, under the income-tax
 *   election) is at least the amount already withheld here, since withheld
 *   tax is necessarily paid, refusing the whole return if it is not. That
 *   check never feeds `stateTaxWithheld` into any computed VALUE — line 5a
 *   stays taxpayer-asserted, never derived from this box — so the claim
 *   above stays true of COMPUTING A FEDERAL LINE FROM IT. It is no longer
 *   true that "nothing here reads them": a reader now exists, and it runs
 *   on every return, not merely a drift check that only proofs exercise.
 *   Both claims are deliberately narrower than the original paragraph and
 *   are both true today.
 * - Boxes 8b (Percentage of annuity contract) and 9a (Percentage of total
 *   distribution) are PERCENTAGES, not money, and are deliberately excluded
 *   from `moneyFieldError` — that check enforces this project's cents-scale
 *   exact-decimal rule, which does not apply to a percentage value. Box 11
 *   (1st year of desig. Roth contrib.) is a year, and box 13 (Date of
 *   payment) is a free-text date — this project has no date primitive yet —
 *   so both stay plain `option(string)` with no numeric-exactness check
 *   this phase.
 * - Every checkbox is `option(true)` — DOC-12 — for `corrected`,
 *   `box2bTaxableAmountNotDetermined`, `box2bTotalDistribution`,
 *   `box7bIraSepSimple`, `box7cTrumpAccount`, `box12FatcaFilingRequirement`.
 *
 * @module
 */
import { array, number, option, string } from 'functionalscript/fjs/types/rtti/module.f.mjs'
import { validate as rttiValidate } from 'functionalscript/fjs/types/rtti/validate/module.f.mjs'
import { error, ok } from 'functionalscript/fjs/types/result/module.f.mjs'
import { assert, assertEq } from 'functionalscript/fjs/asserts/module.f.mjs'
import { base, mediaTypeOf } from '../base/module.f.js'
import { formRevisionError } from '../form_revision/module.f.js'
import { moneyFieldError } from '../money_field/module.f.js'

/** @import { Result } from 'functionalscript/fjs/types/result/module.f.mjs' */
/** @import { Ts, Unknown } from 'functionalscript/fjs/types/rtti/ts/module.f.mjs' */
/** @import { ValidationError } from 'functionalscript/fjs/types/rtti/validate/module.f.mjs' */

/**
 * Format tag: names the dialect of this BLOB. The media type it is served
 * with is derived mechanically: `application/` + `dialect` + `+json`.
 */
export const dialect = 'vnd.fjs.1099r'
/** The media type derived from {@link dialect}: `application/vnd.fjs.1099r+json`. */
export const mediaType = mediaTypeOf(dialect)

/**
 * One boxes-14-through-19 row: a state line and the locality line printed
 * beside it, mirroring `fjs/document/w2/module.f.js`'s `stateLocalEntry`
 * shape exactly. Every field but `state` is absent-able, because the
 * printed form routinely leaves the locality half blank (DOC-11).
 */
const stateLocalEntry = /** @type {const} */ ({
    state: string,
    payerStateNo: option(string),
    stateTaxWithheld: option(string),
    stateDistribution: option(string),
    localTaxWithheld: option(string),
    localityName: option(string),
    localDistribution: option(string),
})

/**
 * rtti schema for a `1099r` BLOB. `dialect` is spread first (via `base`) so
 * structural validation reports it as the first failing field on a
 * mismatched blob (DOC-00's discriminant).
 */
export const oneZeroNineNineRSchema = /** @type {const} */ ({
    ...base(dialect),
    payerTin: string,
    recipientTin: string,
    accountNumber: string,
    taxYear: number,
    formRevision: string,
    corrected: option(true),
    box1GrossDistribution: option(string),
    box2aTaxableAmount: option(string),
    box2bTaxableAmountNotDetermined: option(true),
    box2bTotalDistribution: option(true),
    box3CapitalGain: option(string),
    box4FederalIncomeTaxWithheld: option(string),
    box5EmployeeContribOrInsurancePremiums: option(string),
    box6NuaInEmployerSecurities: option(string),
    box7aDistributionCodes: option(array(string)),
    box7bIraSepSimple: option(true),
    box7cTrumpAccount: option(true),
    box7dEarningsOnExcessContrib: option(string),
    box8aOther: option(string),
    box8bPercentageOfAnnuityContract: option(string),
    box9aPercentageOfTotalDistribution: option(string),
    box9bTotalEmployeeContrib: option(string),
    box10AmountAllocableToIrrWithin5Years: option(string),
    box11FirstYearOfDesigRothContrib: option(string),
    box12FatcaFilingRequirement: option(true),
    box13DateOfPayment: option(string),
    stateLocal: option(array(stateLocalEntry)),
    payerName: option(string),
    recipientName: option(string),
})

/** @typedef {Ts<typeof oneZeroNineNineRSchema>} OneZeroNineNineR */

/** Structural-only validator: checks the shape, not the semantic refinements below. */
const validateShape = rttiValidate(oneZeroNineNineRSchema)

/**
 * The scalar money boxes, walked in a loop so the exactness check is
 * written once. Typed via `@type {const}` (not a wider `keyof
 * OneZeroNineNineR`) so `r[field]` resolves to exactly `string | undefined`
 * — the same reason `vnd.fjs.1099int`/`vnd.fjs.w2` do it this way.
 * `box8bPercentageOfAnnuityContract` and `box9aPercentageOfTotalDistribution`
 * are deliberately NOT here — they are percentages, not money (see module
 * docstring). `box11FirstYearOfDesigRothContrib` (a year) and
 * `box13DateOfPayment` (a free-text date) are excluded for the same reason:
 * neither is a money amount.
 */
const moneyBoxFields = /** @type {const} */ ([
    'box1GrossDistribution',
    'box2aTaxableAmount',
    'box3CapitalGain',
    'box4FederalIncomeTaxWithheld',
    'box5EmployeeContribOrInsurancePremiums',
    'box6NuaInEmployerSecurities',
    'box7dEarningsOnExcessContrib',
    'box8aOther',
    'box9bTotalEmployeeContrib',
    'box10AmountAllocableToIrrWithin5Years',
])

/**
 * The four money-carrying fields of one boxes-14-through-19 row (`state` is
 * an identity label, not an amount, so it is excluded). Named once, at
 * module scope, so `checkReferences`' own loop below and this module's
 * generated exactness proof (further down) walk the identical list rather
 * than the check and its test being free to drift apart (AGENTS.md, "one
 * rule, one place").
 */
const stateLocalMoneyFields = /** @type {const} */ ([
    'stateTaxWithheld',
    'stateDistribution',
    'localTaxWithheld',
    'localDistribution',
])

/**
 * Either a structural validation error or a semantic (string) error message.
 * @typedef {ValidationError | string} OneZeroNineNineRError
 */

/**
 * Checks the semantic refinements the structural schema cannot express:
 * `formRevision` is non-empty (DOC-10), every PRESENT scalar money box is an
 * exact decimal within safe magnitude, and every PRESENT `stateLocal` row's
 * money fields are too. Absent boxes are skipped, never defaulted (DOC-11).
 * No additional per-code check is required on `box7aDistributionCodes` —
 * unlike W-2's box 12, there is no attached amount to make an empty code
 * meaningless.
 * @type {(r: OneZeroNineNineR) => Result<OneZeroNineNineR, OneZeroNineNineRError>}
 */
export const checkReferences = r => {
    const formRevisionMessage = formRevisionError(r.formRevision)
    if (formRevisionMessage !== undefined) {
        return error(formRevisionMessage)
    }
    for (const field of moneyBoxFields) {
        const printed = r[field]
        if (printed === undefined) {
            continue
        }
        const message = moneyFieldError(field)(printed)
        if (message !== undefined) {
            return error(message)
        }
    }
    for (const entry of r.stateLocal ?? []) {
        for (const field of stateLocalMoneyFields) {
            const printed = entry[field]
            if (printed === undefined) {
                continue
            }
            const message = moneyFieldError(`${entry.state} ${field}`)(printed)
            if (message !== undefined) {
                return error(message)
            }
        }
    }
    return ok(r)
}

/**
 * Validates an already-parsed JSON value as a `1099r` BLOB: structural
 * (rtti) validation followed by the semantic checks in
 * {@link checkReferences}. Dialect discrimination happens exclusively
 * through the schema's exact-literal `dialect` constant — the serialized
 * JSON text is never inspected.
 * @type {(value: Unknown) => Result<OneZeroNineNineR, OneZeroNineNineRError>}
 */
export const validate = value => {
    const [t, v] = validateShape(value)
    if (t === 'error') {
        return error(v)
    }
    return checkReferences(v)
}

// ── Tests ────────────────────────────────────────────────────────────────────

/** @type {OneZeroNineNineR} */
const minimal = {
    dialect,
    payerTin: '11-1111111',
    recipientTin: '222-22-2222',
    accountNumber: 'ACC-0001',
    taxYear: 2025,
    formRevision: '2025',
}

/**
 * T-11-01-01: a money box's name could be quietly dropped from
 * {@link moneyBoxFields} without anyone noticing — the field stays
 * `option(string)` structurally, so a comma-grouped amount in a dropped box
 * would then validate as ok. One generated leaf per NAMED scalar box
 * supplies a comma-grouped value to that box alone and asserts `validate`
 * refuses, built by mapping {@link moneyBoxFields} itself into `[field,
 * assertion]` pairs (never as ten hand-written near-identical leaves) — the
 * same idiom `fjs/document/w2/module.f.js`'s generated leaves use — so a box
 * added to the list later is covered automatically.
 *
 * A box's own generated leaf disappears WITH it if the box is dropped from
 * the list, so this alone cannot catch a removal — {@link
 * expectedMoneyBoxFieldCount} below pairs it with an independently
 * hand-typed count. The duplication is the mechanism (AGENTS.md: "a proof's
 * expected value must not be produced by the code under test").
 * @type {{ readonly [field: string]: () => void }}
 */
const generatedScalarMoneyBoxExactnessProof = Object.fromEntries(
    moneyBoxFields.map(field => [
        field,
        () => {
            const [t, v] = validate({ ...minimal, [field]: '1,234.56' })
            assertEq(t, 'error', ['expected a comma-grouped amount in this box to be refused', field, t, v])
        },
    ]),
)

/**
 * Independently hand-typed: the number of scalar money boxes
 * {@link moneyBoxFields} is expected to name today. Deliberately NOT derived
 * from `moneyBoxFields.length` — see {@link generatedScalarMoneyBoxExactnessProof}.
 * @type {number}
 */
const expectedMoneyBoxFieldCount = 10

/**
 * Same idiom as {@link generatedScalarMoneyBoxExactnessProof}, for the four
 * boxes-14-through-19 money fields named in {@link stateLocalMoneyFields}
 * instead of the scalar {@link moneyBoxFields}.
 * @type {{ readonly [field: string]: () => void }}
 */
const generatedStateLocalMoneyExactnessProof = Object.fromEntries(
    stateLocalMoneyFields.map(field => [
        field,
        () => {
            const [t, v] = validate({ ...minimal, stateLocal: [{ state: 'CA', [field]: '1,234.56' }] })
            assertEq(
                t,
                'error',
                ['expected a comma-grouped amount in this stateLocal field to be refused', field, t, v])
        },
    ]),
)

/**
 * Independently hand-typed: the number of boxes-14-through-19 money fields
 * {@link stateLocalMoneyFields} is expected to name today. Deliberately NOT
 * derived from `stateLocalMoneyFields.length` — see
 * {@link generatedScalarMoneyBoxExactnessProof}.
 * @type {number}
 */
const expectedStateLocalMoneyFieldCount = 4

export const proof = {
    dialectAndMediaType: () => {
        assertEq(dialect, 'vnd.fjs.1099r')
        assertEq(mediaType, 'application/vnd.fjs.1099r+json')
    },
    validate: {
        fullyPopulatedValidates: () => {
            const [t, v] = validate({
                ...minimal,
                corrected: true,
                box1GrossDistribution: '10000.00',
                box2aTaxableAmount: '8000.00',
                box2bTaxableAmountNotDetermined: true,
                box2bTotalDistribution: true,
                box3CapitalGain: '500.00',
                box4FederalIncomeTaxWithheld: '1000.00',
                box5EmployeeContribOrInsurancePremiums: '250.00',
                box6NuaInEmployerSecurities: '100.00',
                box7aDistributionCodes: ['7', 'G'],
                box7bIraSepSimple: true,
                box7cTrumpAccount: true,
                box7dEarningsOnExcessContrib: '25.00',
                box8aOther: '50.00',
                box8bPercentageOfAnnuityContract: '12.5',
                box9aPercentageOfTotalDistribution: '100',
                box9bTotalEmployeeContrib: '75.00',
                box10AmountAllocableToIrrWithin5Years: '200.00',
                box11FirstYearOfDesigRothContrib: '2020',
                box12FatcaFilingRequirement: true,
                box13DateOfPayment: '2025-06-15',
                stateLocal: [
                    { state: 'CA', stateTaxWithheld: '100.00', stateDistribution: '2000.00' },
                    { state: 'CA', stateTaxWithheld: '10.00', stateDistribution: '200.00' },
                ],
                payerName: 'Some Plan Administrator',
                recipientName: 'Some Person',
            })
            assert(t === 'ok', ['expected ok', t, v])
            assertEq(v.box7aDistributionCodes?.length, 2)
            assertEq(v.stateLocal?.length, 2)
        },
        // DOC-11: every box omitted is valid, and reads back absent rather
        // than as a zero amount or a false flag.
        blankBoxesOmittedValidates: () => {
            const [t, v] = validate(minimal)
            assert(t === 'ok', ['expected ok', t, v])
            assertEq(v.box1GrossDistribution, undefined)
            assertEq(v.corrected, undefined)
            assertEq(v.box7aDistributionCodes, undefined)
            assertEq(v.stateLocal, undefined)
        },
        // DOC-12: `false` is not a member of `option(true)` for any of the
        // six checkbox fields — rejected structurally, never accepted as
        // "not checked".
        falseFlagsRejected: () => {
            assertEq(validate({ ...minimal, corrected: false })[0], 'error')
            assertEq(validate({ ...minimal, box2bTaxableAmountNotDetermined: false })[0], 'error')
            assertEq(validate({ ...minimal, box2bTotalDistribution: false })[0], 'error')
            assertEq(validate({ ...minimal, box7bIraSepSimple: false })[0], 'error')
            assertEq(validate({ ...minimal, box7cTrumpAccount: false })[0], 'error')
            assertEq(validate({ ...minimal, box12FatcaFilingRequirement: false })[0], 'error')
        },
        wrongDialectRejected: () => {
            const [t, v] = validate({ ...minimal, dialect: 'vnd.fjs.w2' })
            assertEq(t, 'error')
            if (t !== 'error') {
                throw ['expected error', t, v]
            }
            if (typeof v === 'string') {
                throw ['expected a structural ValidationError', v]
            }
            assertEq(v.path[0], 'dialect')
        },
    },
    box7a: {
        // The code carries the meaning, so a repeated/second code must
        // survive in order — unlike box 7a's fixed printed slot, the list
        // shape has no positional meaning to lose.
        repeatedCodeIsPreserved: () => {
            const [t, v] = validate({ ...minimal, box7aDistributionCodes: ['7', 'G'] })
            assert(t === 'ok', ['expected ok', t, v])
            assertEq(v.box7aDistributionCodes?.length, 2)
            assertEq(v.box7aDistributionCodes?.[0], '7')
            assertEq(v.box7aDistributionCodes?.[1], 'G')
        },
    },
    stateLocal: {
        // "Faithfully" has to mean this: several rows, including two for
        // the SAME state, round-tripping in order with nothing merged or
        // summed.
        multipleRowsIncludingRepeatedStateRoundTrip: () => {
            const rows = [
                { state: 'CA', stateTaxWithheld: '100.00', stateDistribution: '2000.00' },
                { state: 'CA', stateTaxWithheld: '10.00', stateDistribution: '200.00' },
                { state: 'NY', stateTaxWithheld: '50.00', localityName: 'NYC', localTaxWithheld: '5.00' },
            ]
            const [t, v] = validate({ ...minimal, stateLocal: rows })
            assert(t === 'ok', ['expected ok', t, v])
            assertEq(v.stateLocal?.length, 3)
            assertEq(v.stateLocal?.[0]?.stateTaxWithheld, '100.00')
            assertEq(v.stateLocal?.[1]?.stateTaxWithheld, '10.00')
            assertEq(v.stateLocal?.[2]?.localityName, 'NYC')
            // The two CA rows stay two rows. Nothing here adds them up.
            assertEq(v.stateLocal?.[0]?.state, v.stateLocal?.[1]?.state)
        },
        inexactAmountRejected: () => {
            const [t] = validate({ ...minimal, stateLocal: [{ state: 'CA', stateTaxWithheld: '1,000.00' }] })
            assertEq(t, 'error')
        },
    },
    checkReferences: {
        emptyFormRevisionRejected: () => {
            assertEq(validate({ ...minimal, formRevision: '' })[0], 'error')
        },
        // T-11-01-01: every money box named in `moneyBoxFields` and
        // `stateLocalMoneyFields` is proven to actually be walked by the
        // exactness loops, not merely assumed because
        // `box1GrossDistribution` happens to be covered above.
        moneyBoxExactness: {
            ...generatedScalarMoneyBoxExactnessProof,
            everyMoneyBoxIsCovered: () => {
                assertEq(
                    moneyBoxFields.length,
                    expectedMoneyBoxFieldCount,
                    [
                        'expected exactly the independently-stated money box count',
                        moneyBoxFields.length,
                        expectedMoneyBoxFieldCount,
                    ],
                )
            },
        },
        stateLocalMoneyExactness: {
            ...generatedStateLocalMoneyExactnessProof,
            everyFieldIsCovered: () => {
                assertEq(
                    stateLocalMoneyFields.length,
                    expectedStateLocalMoneyFieldCount,
                    [
                        'expected exactly the independently-stated stateLocal money field count',
                        stateLocalMoneyFields.length,
                        expectedStateLocalMoneyFieldCount,
                    ],
                )
            },
        },
        // Anti-pattern guard (11-RESEARCH.md): a percentage box carrying
        // more than two decimal places still validates ok, proving it is
        // genuinely exempt from `moneyFieldError`, not merely untested.
        percentageBoxesAcceptAnyStringWithoutExactnessCheck: () => {
            const [t, v] = validate({
                ...minimal,
                box8bPercentageOfAnnuityContract: '12.345',
                box9aPercentageOfTotalDistribution: '100.000',
            })
            assert(t === 'ok', ['expected ok — percentage boxes are not exact-decimal checked', t, v])
        },
    },
}
