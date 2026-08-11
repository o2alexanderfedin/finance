/**
 * `vnd.fjs.prior_year_capital_loss` — TAX-17: the four prior-year FACTS the
 * Capital Loss Carryover Worksheet (`fjs/tax/carryover/module.f.js`) needs to
 * derive this year's Schedule D lines 6 and 14. Nothing here is the
 * carryover itself.
 *
 * **This dialect stores ONLY the four raw prior-year figures, never a
 * pre-computed carryover total.** The worksheet's 13 printed lines
 * (i1040sd.pdf, 2025 revision, p.10, "Capital Loss Carryover Worksheet —
 * Lines 6 and 14") derive the short-term and long-term carryover amounts
 * from exactly four prior-year *result* figures — 2024 Form 1040/1040-SR/
 * 1040-NR line 15, and 2024 Schedule D lines 7, 15, and 21 — and nothing
 * else; no tax-year parameter of any kind feeds it. This dialect carries
 * those four figures verbatim and no more, mirroring
 * `vnd.fjs.medical_expenses`'s "no stored total" precedent (that dialect
 * stores raw expense entries, never a pre-computed 7.5%-of-AGI-floored
 * deduction): a stored carryover total would be a second source of truth
 * able to disagree with the four figures it should have been derived from,
 * and — per this phase's threat model (T-15-03) — would let a crafted
 * document assert a favorable carryover with no derivation to check it
 * against. The carryover is always DERIVED, by `capitalLossCarryoverWorksheet`,
 * never asserted here.
 *
 * ## No `formRevision`, for the same reason `medical_expenses` has none
 *
 * DOC-10 (`formRevision must be present and non-empty`) exists because box
 * semantics drift between revisions of a printed INFORMATION RETURN — a form
 * a payer files and a taxpayer receives. This is not that. These four
 * figures are the taxpayer's OWN transcription of facts off their OWN
 * prior-year Form 1040 and Schedule D — no payer, no information return, no
 * form revision to cite. `taxYear` here names the PRIOR year these four
 * figures are FROM (e.g. `2024` on a TY2025 return), not the year of a form
 * revision.
 *
 * ## Cardinality and subject, mirroring `medical_expenses`
 *
 * One running record per taxpayer per PRIOR tax year — a taxpayer amends or
 * corrects last year's transcribed figures by storing a new revision under
 * the same subject, exactly as `medical_expenses` does. Like that dialect,
 * this one has no payer and no account number, so `formSubject`'s
 * `(payerTin, recipientTin, accountNumber, taxYear, formType)` keying scheme
 * carries `payerTin: ''` and `accountNumber: ''` for this dialect too — the
 * right cardinality for a fact transcribed from the taxpayer's own return
 * rather than one document per issuer.
 *
 * ## Absence vs. presence-but-broken (15-CONTEXT.md, Area 3, REVISED)
 *
 * **This document being entirely ABSENT is a legitimate `0n` on Schedule D
 * lines 6/14** — a first-year filer, or anyone who genuinely had no
 * prior-year capital loss, has nothing to carry, and refusing there would
 * make an ordinary return unable to file at all. That absence case is
 * handled by the CALLER simply never constructing this document — nothing
 * inside this module's schema or `checkReferences` can express "absent",
 * because a `Ts<typeof priorYearCapitalLossSchema>` value is by definition
 * present. All four money fields below are therefore REQUIRED (never
 * `option`): a document that exists carries every one of the four facts the
 * worksheet needs, or it does not exist at all. If any single one were
 * `option`, this module would need a THIRD state ("exists, but one fact is
 * silently missing") that the worksheet has no honest way to compute
 * against — the printed worksheet has no instruction for "treat this one
 * line as blank." A document that exists but has a missing required field
 * therefore fails STRUCTURAL validation (a distinct `ValidationError`, not a
 * semantic string) — this is TAX-16's honest-refusal rule, applied at the
 * schema-shape layer rather than inside `checkReferences`. A document that
 * exists with all four fields present, but one is a malformed decimal
 * string, fails `checkReferences` and REFUSES BY NAME (T-15-04) — this
 * module's own half of "present-but-broken refuses, naming the field," which
 * no other dialect in this codebase implements for a whole-document
 * absence/malformed distinction quite this way.
 *
 * ## Every figure may be negative, and that is the ordinary case
 *
 * All four figures — a prior-year AGI-adjacent result, and three
 * Schedule D subtotals — can legitimately be negative (a loss year, a
 * capped loss, or a net operating loss carried into Form 1040 line 15).
 * `moneyFieldError` already accepts negative decimal strings (its own
 * `negativeAccepted` leaf proves this), so no positive-only check is added
 * for any of the four.
 *
 * Source, transcribed verbatim from `i1040sd.pdf` (2025 revision, p.10),
 * fetched and read directly by 15-RESEARCH.md, not from recall.
 *
 * @module
 */
import { number, option, string } from 'functionalscript/fjs/types/rtti/module.f.js'
import { validate as rttiValidate } from 'functionalscript/fjs/types/rtti/validate/module.f.js'
import { error, ok } from 'functionalscript/fjs/types/result/module.f.js'
import { assert, assertEq } from 'functionalscript/fjs/asserts/module.f.js'
import { base, mediaTypeOf } from '../base/module.f.js'
import { moneyFieldError } from '../money_field/module.f.js'

/** @import { Result } from 'functionalscript/fjs/types/result/module.f.js' */
/** @import { Ts, Unknown } from 'functionalscript/fjs/types/rtti/ts/module.f.js' */
/** @import { ValidationError } from 'functionalscript/fjs/types/rtti/validate/module.f.js' */

/**
 * Format tag: names the dialect of this BLOB. The media type it is served
 * with is derived mechanically: `application/` + `dialect` + `+json`.
 */
export const dialect = 'vnd.fjs.prior_year_capital_loss'
/** The media type derived from {@link dialect}: `application/vnd.fjs.prior_year_capital_loss+json`. */
export const mediaType = mediaTypeOf(dialect)

/**
 * rtti schema for a `prior_year_capital_loss` BLOB. `dialect` is spread
 * first (via `base`) so structural validation reports it as the first
 * failing field on a mismatched blob (DOC-00's discriminant). All four
 * money fields are REQUIRED `string`, never `option` — see this module's
 * own docstring, "Absence vs. presence-but-broken", for why: the ABSENT
 * case is handled by the caller never constructing this document at all,
 * never by a field inside it being optional.
 */
export const priorYearCapitalLossSchema = /** @type {const} */ ({
    ...base(dialect),
    recipientTin: string,
    taxYear: number,
    corrected: option(true),
    priorYearFormLine15: string,
    priorYearScheduleDLine7: string,
    priorYearScheduleDLine15: string,
    priorYearScheduleDLine21: string,
})

/** @typedef {Ts<typeof priorYearCapitalLossSchema>} PriorYearCapitalLoss */

/** Structural-only validator: checks the shape, not the semantic refinements below. */
const validateShape = rttiValidate(priorYearCapitalLossSchema)

/**
 * The four required money fields, walked in a loop so the exactness check
 * (and its refusal-naming-the-field behavior) is written once. Named at
 * module scope so `checkReferences`' own loop below and this module's
 * generated proofs walk the identical list rather than the check and its
 * test being free to drift apart (AGENTS.md, "one rule, one place"). Order
 * matches the worksheet's own printed-line reading order (line 1's source,
 * then line 2's, line 5's, line 9's — i1040sd.pdf p.10). Typed via
 * `@type {const}` (not a wider `keyof PriorYearCapitalLoss`) so `r[field]`
 * below resolves to exactly `string` — the same reason
 * `fjs/document/1099b/module.f.js`'s `moneyBoxFields` does it this way.
 */
const requiredMoneyFields = /** @type {const} */ ([
    'priorYearFormLine15',
    'priorYearScheduleDLine7',
    'priorYearScheduleDLine15',
    'priorYearScheduleDLine21',
])

/**
 * Independently hand-typed: the number of required money fields
 * {@link requiredMoneyFields} is expected to name today. Deliberately NOT
 * derived from `requiredMoneyFields.length` — mirrors `fjs/document/1099b`'s
 * `expectedMoneyBoxFieldCount` idiom: a field silently dropped from the list
 * would otherwise still pass every generated leaf while genuinely losing
 * coverage.
 * @type {number}
 */
const expectedMoneyBoxFieldCount = 4

/**
 * Either a structural validation error or a semantic (string) error message.
 * @typedef {ValidationError | string} PriorYearCapitalLossError
 */

/**
 * Checks the semantic refinement structural validation cannot express:
 * every one of the four required money fields is an exact decimal string
 * within safe magnitude — REFUSING BY NAME on the first malformed one
 * (T-15-04). Every field is present by construction here (all four are
 * required, not `option`), so this loop never skips a field the way
 * `1099b`'s does for its optional boxes.
 * @type {(r: PriorYearCapitalLoss) => Result<PriorYearCapitalLoss, PriorYearCapitalLossError>}
 */
export const checkReferences = r => {
    for (const field of requiredMoneyFields) {
        const message = moneyFieldError(field)(r[field])
        if (message !== undefined) {
            return error(message)
        }
    }
    return ok(r)
}

/**
 * Validates an already-parsed JSON value as a `prior_year_capital_loss`
 * BLOB: structural (rtti) validation followed by the semantic check in
 * {@link checkReferences}. Dialect discrimination happens exclusively
 * through the schema's exact-literal `dialect` constant — the serialized
 * JSON text is never inspected.
 * @type {(value: Unknown) => Result<PriorYearCapitalLoss, PriorYearCapitalLossError>}
 */
export const validate = value => {
    const [t, v] = validateShape(value)
    if (t === 'error') {
        return error(v)
    }
    return checkReferences(v)
}

// ── Tests ────────────────────────────────────────────────────────────────────

/**
 * A fully-populated, always-valid fixture — Worked Example B's own inputs
 * from `fjs/tax/carryover/module.f.js`'s worked examples (ST loss $10,000,
 * LT gain $1,000, line21 -$3,000, Form1040 line15 +$20,000), reused here so
 * this dialect's own fixtures are drawn from the same worked scenario the
 * worksheet module independently verifies.
 * @type {PriorYearCapitalLoss}
 */
const minimal = {
    dialect,
    recipientTin: '222-22-2222',
    taxYear: 2024,
    priorYearFormLine15: '20000.00',
    priorYearScheduleDLine7: '-10000.00',
    priorYearScheduleDLine15: '1000.00',
    priorYearScheduleDLine21: '-3000.00',
}

/**
 * A money box's name could be quietly dropped from {@link requiredMoneyFields}
 * without anyone noticing. One generated leaf per named field supplies a
 * comma-grouped amount to that field alone and asserts `validate` refuses,
 * built by mapping {@link requiredMoneyFields} itself into `[field,
 * assertion]` pairs (never as four hand-written near-identical leaves) —
 * the same idiom `fjs/document/1099b/module.f.js`'s generated leaves use, so
 * a field added to the list later is covered automatically.
 *
 * A field's own generated leaf disappears WITH it if the field is dropped
 * from the list, so this alone cannot catch a removal — {@link
 * expectedMoneyBoxFieldCount} above pairs it with an independently
 * hand-typed count.
 * @type {{ readonly [field: string]: () => void }}
 */
const generatedMoneyFieldExactnessProof = Object.fromEntries(
    requiredMoneyFields.map(field => [
        field,
        () => {
            const [t, v] = validate({ ...minimal, [field]: '1,234.56' })
            assertEq(t, 'error', ['expected a comma-grouped amount in this field to be refused', field, t, v])
        },
    ]),
)

/**
 * Same idiom as {@link generatedMoneyFieldExactnessProof}, one leaf per
 * field asserting that OMITTING it entirely fails STRUCTURAL validation
 * (`ValidationError`, not a semantic string) and NAMES that field —
 * distinguishing "missing" from "present but malformed", mirroring
 * `1099b`'s own `sourceArtifactHashRequired`.
 * @type {{ readonly [field: string]: () => void }}
 */
const generatedRequiredFieldProof = Object.fromEntries(
    requiredMoneyFields.map(field => [
        `${field}Required`,
        () => {
            // `Object.entries`/`fromEntries`, not a `delete` on a strictly-typed
            // required field (tsc rejects `delete` on a non-optional property —
            // "the operand of a delete operator must be optional"), and not a
            // per-field hand-written destructure (which would defeat the point
            // of generating one leaf per field from a single list).
            const withoutField = Object.fromEntries(
                Object.entries(minimal).filter(([key]) => key !== field),
            )
            const [t, v] = validate(withoutField)
            assertEq(t, 'error')
            if (t !== 'error') {
                throw ['expected error', t, v]
            }
            if (typeof v === 'string') {
                throw ['expected a structural ValidationError, not a semantic string', v]
            }
            assert(v.path.includes(field), ['expected the ValidationError to name the missing field', field, v])
        },
    ]),
)

export const proof = {
    dialectAndMediaType: () => {
        assertEq(dialect, 'vnd.fjs.prior_year_capital_loss')
        assertEq(mediaType, 'application/vnd.fjs.prior_year_capital_loss+json')
    },
    fullyPopulatedValidates: () => {
        const [t, v] = validate({ ...minimal, corrected: true })
        assert(t === 'ok', ['expected ok', t, v])
        assertEq(v.priorYearFormLine15, '20000.00')
        assertEq(v.priorYearScheduleDLine7, '-10000.00')
        assertEq(v.priorYearScheduleDLine15, '1000.00')
        assertEq(v.priorYearScheduleDLine21, '-3000.00')
    },
    wrongDialectRejected: () => {
        const [t, v] = validate({ ...minimal, dialect: 'vnd.fjs.medical_expenses' })
        assertEq(t, 'error')
        if (t !== 'error') {
            throw ['expected error', t, v]
        }
        if (typeof v === 'string') {
            throw ['expected a structural ValidationError', v]
        }
        assertEq(v.path[0], 'dialect')
    },
    correctedFalseRejected: () => {
        assertEq(validate({ ...minimal, corrected: false })[0], 'error')
    },
    // Every one of the four figures may legitimately be negative — this is
    // the ORDINARY case (a loss year, a capped loss, or a prior-year AGI
    // reduced by an NOL), not an edge case.
    negativeValuesAccepted: () => {
        const [t, v] = validate({
            dialect,
            recipientTin: '222-22-2222',
            taxYear: 2024,
            priorYearFormLine15: '-5000.00',
            priorYearScheduleDLine7: '-8000.00',
            priorYearScheduleDLine15: '-2000.00',
            priorYearScheduleDLine21: '-3000.00',
        })
        assert(t === 'ok', ['expected ok — all four figures may be negative', t, v])
    },
    // T-15-04: a present-but-malformed field refuses, and the refusal NAMES
    // that exact field — the honest-refusal half of this dialect's own
    // absence-vs-broken distinction (see module docstring).
    presentButInvalidFieldRefusesNamingTheField: () => {
        const [t, v] = validate({ ...minimal, priorYearScheduleDLine7: 'approx. -10000' })
        assertEq(t, 'error')
        if (t !== 'error') {
            throw ['expected error', t, v]
        }
        if (typeof v !== 'string') {
            throw ['expected a semantic string error naming the field, not a structural ValidationError', v]
        }
        assert(
            v.includes('priorYearScheduleDLine7'),
            ['expected the refusal to name the exact broken field', v],
        )
    },
    moneyFieldExactness: {
        ...generatedMoneyFieldExactnessProof,
        everyMoneyFieldIsCovered: () => {
            assertEq(
                requiredMoneyFields.length,
                expectedMoneyBoxFieldCount,
                [
                    'expected exactly the independently-stated money field count',
                    requiredMoneyFields.length,
                    expectedMoneyBoxFieldCount,
                ],
            )
        },
    },
    requiredFields: generatedRequiredFieldProof,
    // No `total`/`carryover`-named field exists anywhere in the schema — the
    // carryover is always DERIVED by the worksheet, never asserted here
    // (module docstring; T-15-03).
    noCarryoverTotalIsStored: () => {
        const [t, v] = validate(minimal)
        assert(t === 'ok', ['expected ok', t, v])
        const keys = Object.keys(v)
        assertEq(keys.some(key => key.toLowerCase().includes('total')), false)
        assertEq(keys.some(key => key.toLowerCase().includes('carryover')), false)
    },
}
