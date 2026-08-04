/**
 * DOC-04 — the OCR-to-typed revision boundary for `vnd.fjs.1099int`: one
 * `vnd.fjs.ocr` transcription plus the caller's structured identity fields
 * become one typed 1099-INT document.
 *
 * Three rules this conversion exists to enforce, each of which is a wrong
 * tax return if it slips:
 *
 * - **Exactly one conversion path.** Every money box travels
 *   printed string -> exact bigint cents ({@link parseOptionalOcrAmount}) ->
 *   canonical decimal string ({@link centsToString}). That is one function
 *   chain with no second entry point, not two independently invokable
 *   conversions that could drift apart.
 * - **Money is stored as a string, never a JSON number** (AGENTS.md,
 *   absolute) — a JSON number is an IEEE 754 double before any arithmetic
 *   happens. The bigint exists only in the middle of the chain, as the
 *   exactness check; what is stored is the canonical decimal string the
 *   `vnd.fjs.1099int` schema's `option(string)` boxes call for.
 * - **Blank is not zero** (DOC-11). A box absent from `ocr.fields` yields a
 *   key that is genuinely absent from the output object — not present with
 *   an `undefined` value (a different type under
 *   `exactOptionalPropertyTypes`), and never `'0.00'`.
 *
 * Identity fields (`payerTin`, `taxYear`, `formRevision`, `corrected`, the
 * name labels) come from `meta`, not from `ocr.fields`: they are structured
 * data the caller already holds. Re-deriving them from unstructured OCR text
 * would be inference, and this phase stores and reads — it does not
 * calculate.
 *
 * @module
 */
import { assert, assertEq } from 'functionalscript/fjs/asserts/module.f.js'
import { fileCas } from 'functionalscript/fjs/cas/module.f.js'
import { sha256 } from 'functionalscript/fjs/crypto/sha2/module.f.js'
import { emptyState, virtual } from 'functionalscript/fjs/effects/node/virtual/module.f.js'
import { initEvo, evo } from 'functionalscript/fjs/cas/evo/module.f.js'
import { vec8 } from 'functionalscript/fjs/types/bit_vec/module.f.js'
import { vecToCBase32 } from 'functionalscript/fjs/basen/cbase32/module.f.js'
import { centsFromString, centsScale, centsToString } from '../../../exact/module.f.js'
import { parseOptionalOcrAmount } from '../../ocr_amount/module.f.js'
import { formSubject } from '../../subject/module.f.js'
import { dialect, validate } from '../module.f.js'

/** @import { Ocr } from '../../ocr/module.f.js' */
/** @import { OneZeroNineNineInt } from '../module.f.js' */

/**
 * The printed-label -> schema-field mapping for the six money boxes this
 * MVP models, written once and walked in a loop rather than as six
 * near-identical branches. The labels are the strings a vision pass emits
 * for a US 1099-INT; the field names are `vnd.fjs.1099int`'s own.
 */
const boxLabels = /** @type {const} */ ([
    ['Box 1 Interest income', 'box1InterestIncome'],
    ['Box 2 Early withdrawal penalty', 'box2EarlyWithdrawalPenalty'],
    ['Box 3 Interest on U.S. Savings Bonds and Treasury obligations', 'box3UsSavingsBondsAndTreasuryInterest'],
    ['Box 4 Federal income tax withheld', 'box4FederalIncomeTaxWithheld'],
    ['Box 6 Foreign tax paid', 'box6ForeignTaxPaid'],
    ['Box 8 Tax-exempt interest', 'box8TaxExemptInterest'],
])

/** The six schema field names {@link boxLabels} maps onto. */
/** @typedef {(typeof boxLabels)[number][1]} BoxKey */

/**
 * The money-box half of a converted document. Every key optional, in the
 * `exactOptionalPropertyTypes` sense — an absent box is an absent key, not
 * a key holding `undefined`.
 * @typedef {{ readonly [K in BoxKey]?: string }} MoneyBoxes
 */

/**
 * The structured identity fields a caller supplies alongside the
 * transcription. `corrected` mirrors the schema's `option(true)` (DOC-12):
 * `true` or nothing at all — there is deliberately no way to say `false`.
 * @typedef {{
 *   readonly payerTin: string,
 *   readonly recipientTin: string,
 *   readonly accountNumber: string,
 *   readonly taxYear: number,
 *   readonly formRevision: string,
 *   readonly corrected?: true | undefined,
 *   readonly payerName?: string | undefined,
 *   readonly recipientName?: string | undefined,
 * }} ConversionMeta
 */

/**
 * Reads the money boxes out of an OCR field map, keeping only those the
 * form actually printed. A box whose label is missing from `fields` is
 * skipped entirely, so its key never appears in the result (DOC-11).
 * @type {(fields: Ocr['fields']) => MoneyBoxes}
 */
const moneyBoxes = fields => {
    /** @type {MoneyBoxes} */
    let boxes = {}
    for (const [label, field] of boxLabels) {
        const cents = parseOptionalOcrAmount(centsScale)(fields[label])
        if (cents === undefined) {
            continue
        }
        boxes = { ...boxes, [field]: centsToString(cents) }
    }
    return boxes
}

/**
 * Converts a `vnd.fjs.ocr` transcription plus the caller's identity fields
 * into a typed `vnd.fjs.1099int` document. Pure; performs no I/O and stores
 * nothing — the caller decides whether the result is worth committing, and
 * under which subject (see `fjs/document/subject`).
 *
 * Refuses, via the exact decimal parser's own `assert`, any printed box
 * value that is not an exact amount. There is no lenient path and no
 * default: an unparseable box is a throw, never a zero.
 * @type {(ocr: Ocr, meta: ConversionMeta) => OneZeroNineNineInt}
 */
export const convert = (ocr, meta) => ({
    dialect,
    payerTin: meta.payerTin,
    recipientTin: meta.recipientTin,
    accountNumber: meta.accountNumber,
    taxYear: meta.taxYear,
    formRevision: meta.formRevision,
    ...(meta.corrected === true ? { corrected: /** @type {const} */ (true) } : {}),
    ...(meta.payerName === undefined ? {} : { payerName: meta.payerName }),
    ...(meta.recipientName === undefined ? {} : { recipientName: meta.recipientName }),
    ...moneyBoxes(ocr.fields),
})

// ── Tests ────────────────────────────────────────────────────────────────────

/** @type {ConversionMeta} */
const meta = {
    payerTin: '11-1111111',
    recipientTin: '222-22-2222',
    accountNumber: 'ACC-0001',
    // Deliberately mismatched: the form revision is NOT the tax year. The
    // proof below asserts they differ, so it cannot pass by the two fields
    // coincidentally carrying the same value (DOC-10).
    taxYear: 2025,
    formRevision: '2024',
}

/** @type {(fields: Ocr['fields']) => Ocr} */
const ocrOf = fields => ({ dialect: 'vnd.fjs.ocr', pages: ['(transcription text)'], fields })

/** The form type used for this dialect's Evo subjects. */
const formType = 'vnd.fjs.1099int'

export const proof = {
    // ── Success Criterion 3 ─────────────────────────────────────────────
    // The printed string, commas and all, becomes exact cents — proven at
    // both layers: the canonical string that gets STORED, and the exact
    // bigint that string means. Asserting only the string would let the
    // numeric meaning drift; asserting only the cents would let a
    // non-canonical string be stored.
    printedGroupedAmountBecomesExactCents: () => {
        const result = convert(ocrOf({ 'Box 1 Interest income': '1,234.56' }), meta)
        assertEq(result.box1InterestIncome, '1234.56')
        assert(result.box1InterestIncome !== undefined, 'box 1 must be present')
        assertEq(centsFromString(result.box1InterestIncome), 123456n)
    },

    // ── Success Criterion 4, leaf 2 — DOC-11: blank is not zero ─────────
    // A box the form never printed is an ABSENT KEY, not a key holding
    // undefined and not a zero amount. This leaf was verified by mutation:
    // making absence fall back to '0.00' fails it.
    blankBoxIsAbsentNotZero: () => {
        const result = convert(ocrOf({ 'Box 1 Interest income': '1,234.56' }), meta)
        assertEq('box2EarlyWithdrawalPenalty' in result, false)
        assertEq(result.box2EarlyWithdrawalPenalty, undefined)
        // The neighbouring present box proves the absence is specific to the
        // unprinted label, not a conversion that dropped every box.
        assertEq('box1InterestIncome' in result, true)
    },

    // ── Success Criterion 4, leaf 3 — DOC-10: the form revision travels ──
    formRevisionIsCarriedAndDistinctFromTaxYear: () => {
        const result = convert(ocrOf({}), meta)
        assertEq(result.formRevision, meta.formRevision)
        assertEq(result.taxYear, 2025)
        assert(
            result.formRevision !== String(result.taxYear),
            'formRevision must be carried in its own right, never derived from taxYear')
    },

    // ── Success Criterion 4, leaf 4 — DOC-12: CORRECTED is readable ──────
    corrected: {
        checkedBoxConvertsToTrue: () => {
            const result = convert(ocrOf({}), { ...meta, corrected: true })
            assertEq('corrected' in result, true)
            assertEq(result.corrected, true)
        },
        // Absence is the ONLY way to say "not corrected" — `corrected: false`
        // is not a member of the schema, so the key must not appear at all.
        uncheckedBoxOmitsTheKeyEntirely: () => {
            const result = convert(ocrOf({}), meta)
            assertEq('corrected' in result, false)
        },
    },

    // The conversion's output is not merely well-shaped by construction: it
    // passes the dialect's own structural + semantic validator, which
    // re-parses every present money box through `fjs/exact`.
    outputValidatesAgainstItsOwnDialect: () => {
        const result = convert(
            ocrOf({
                'Box 1 Interest income': '1,234.56',
                'Box 4 Federal income tax withheld': '123.45',
                'Box 8 Tax-exempt interest': '7',
            }),
            { ...meta, corrected: true, payerName: 'Some Bank' })
        assertEq(result.box8TaxExemptInterest, '7.00')
        const [t, v] = validate(result)
        assert(t === 'ok', ['expected the converted document to validate', t, v])
    },

    // A printed value that is not an exact amount is refused, not coerced.
    throw: {
        unparseableBoxValue: () => convert(ocrOf({ 'Box 1 Interest income': 'approx. 1200' }), meta),
    },

    // ── Success Criterion 4, leaf 1 — same artifact, same subject ────────
    // Exercised against the REAL fjs/cas/evo API through the `virtual` Node
    // interpreter (the idiom fjs's own evo/proof.f.js uses), not by
    // re-deriving the subject string twice: the question is whether a
    // second ingestion of the same extracted form advances one history or
    // forks a parallel one, and only Evo can answer that.
    sameFormResolvesToOneSubject: () => {
        const cas = fileCas(sha256)('.')
        const [state0, cacheKey] = virtual(emptyState)(initEvo(cas))
        const e = evo(cas)(cacheKey)
        const converted = convert(ocrOf({ 'Box 1 Interest income': '1,234.56' }), meta)
        const subject = formSubject({ ...converted, formType })

        // First ingestion.
        const [state1, first] = virtual(state0)(
            e.add({ parents: [], subject, snapshot: vecToCBase32(vec8(0x11n)) }))
        assert(first[0] === 'ok', ['expected the first add to succeed', first])

        // Re-processing the SAME form — a fresh scan, a corrected copy — is
        // a child of the first revision under the SAME subject, because the
        // subject is derived from the form's business identity, not from
        // the artifact or the occasion.
        const [state2, second] = virtual(state1)(
            e.add({ parents: [first[1]], subject, snapshot: vecToCBase32(vec8(0x12n)) }))
        assert(second[0] === 'ok', ['expected the second add to succeed', second])

        const [state3, heads] = virtual(state2)(e.head(subject))
        assertEq(heads.length, 1)
        assertEq(heads[0], second[1])

        // Contrast: a DIFFERENT form (one field changed) is a different
        // subject, and adding under it leaves the first subject's head
        // untouched. Without this, the leaf above would also pass for a
        // subject function that collapsed every form onto one key.
        const otherSubject = formSubject({ ...converted, accountNumber: 'ACC-9999', formType })
        assert(otherSubject !== subject, 'a different account number must be a different subject')
        const [state4, other] = virtual(state3)(
            e.add({ parents: [], subject: otherSubject, snapshot: vecToCBase32(vec8(0x13n)) }))
        assert(other[0] === 'ok', ['expected the contrast add to succeed', other])
        const [, headsAfter] = virtual(state4)(e.head(subject))
        assertEq(headsAfter.length, 1)
        assertEq(headsAfter[0], second[1])
    },
}
