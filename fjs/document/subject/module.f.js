/**
 * DOC-01 — the Evo subject convention for this project's documents, decided
 * once, permanently, before any real document exists: a subject cannot be
 * renamed and `fjs/cas` (content-addressable storage) has no delete, so an
 * artifact/subject scheme chosen wrong is not a refactor later, it is a
 * permanent parallel history.
 *
 * Two independent roots, matching two independent things a document can be:
 *
 * - The **artifact** chain — the original scanned/uploaded bytes (a PDF, an
 *   image) — is rooted at the cBase32 hash of that artifact itself
 *   ({@link artifactSubject}). Re-adding the identical bytes resolves to the
 *   identical subject, because the subject *is* the content hash.
 * - Each **extracted form** — the structured data a dialect parses out of an
 *   artifact (e.g. a single 1099-INT) — gets its own subject, keyed on the
 *   business identity of that form: `(payerTin, recipientTin,
 *   accountNumber, taxYear, formType)` ({@link formSubject}). Two different
 *   scans of the same paper form resolve to the same form subject even
 *   though they resolve to two different artifact subjects (see
 *   `T-05-01-02` in this plan's threat model — an accepted consequence of
 *   content-hash-based artifact identity, not a defect).
 *
 * Human-readable labels (a payer's display name, a filename) live inside
 * snapshots, never in subjects — a subject is an opaque, stable key.
 *
 * Neither function performs I/O; both are pure and dialect-independent —
 * this module imports no rtti schema from any specific dialect, so later
 * dialect modules depend on this one, never the reverse.
 *
 * @module
 */
import { assertEq } from 'functionalscript/fjs/asserts/module.f.js'

/**
 * The subject for an artifact's own revision chain: the identity function on
 * the artifact's cBase32 content hash (DOC-01 — "the artifact chain ... is
 * rooted at the cBase32 hash of the original artifact"). The subject *is*
 * that hash, not a derived or prefixed value; re-adding identical bytes
 * therefore always resolves to the identical subject.
 *
 * Exported as a named function, not inlined as `x => x` at call sites, so
 * every caller reads its intent and there is a single place to change if a
 * namespacing convention (e.g. a `artifact:` prefix) is ever introduced.
 *
 * @type {(hash: string) => string}
 */
export const artifactSubject = hash => hash

/**
 * The five fields that key an extracted form's identity, per DOC-01. Not
 * imported from any dialect module — Plan 05-02's `vnd.fjs.1099int` dialect
 * does not exist yet at this wave, and this module must stay
 * dialect-independent so later dialect plans depend on it, never the
 * reverse.
 *
 * `taxYear` is a plain JS `number` (a 4-digit calendar year) — this is not
 * money, so ordinary numeric handling is fine here; it does not route
 * through `fjs/exact`/`fjs/types/decimal`.
 *
 * @typedef {{
 *   readonly payerTin: string,
 *   readonly recipientTin: string,
 *   readonly accountNumber: string,
 *   readonly taxYear: number,
 *   readonly formType: string,
 * }} FormKey
 */

/**
 * The subject for an extracted form instance: deterministically derived
 * from its business key `(payerTin, recipientTin, accountNumber, taxYear,
 * formType)` (DOC-01), independent of which artifact/scan produced it and
 * independent of object identity (two distinct object literals carrying the
 * same five values yield the identical, `===`-equal subject string).
 *
 * Encoded via `JSON.stringify` on a fixed-order array of the five values
 * (`[formType, String(taxYear), payerTin, recipientTin, accountNumber]`)
 * rather than manual delimiter-joining: `JSON.stringify` already escapes
 * embedded quote/comma/colon characters correctly, so two different
 * five-tuples cannot collide by a field boundary shifting (e.g. an
 * `accountNumber` containing a colon cannot be confused with a
 * delimiter) — the same technique `fjs/exact/module.f.js`'s `show` test
 * helper already uses in this repo, so no new serialization logic is
 * invented here (T-05-01-01).
 *
 * @type {(key: FormKey) => string}
 */
export const formSubject = ({ payerTin, recipientTin, accountNumber, taxYear, formType }) =>
    JSON.stringify([formType, String(taxYear), payerTin, recipientTin, accountNumber])

// ── Tests ────────────────────────────────────────────────────────────────────

/** @type {FormKey} */
const baseline = {
    payerTin: '11-1111111',
    recipientTin: '222-22-2222',
    accountNumber: 'ACC-0001',
    taxYear: 2024,
    formType: 'vnd.fjs.1099int',
}

export const proof = {
    // artifactSubject is the identity function on the hash string, and is
    // `===`-stable across repeated calls with the identical argument.
    artifactSubjectIsIdentity: () => {
        assertEq(artifactSubject('abc'), 'abc')
        const hash = 'SOME-CBASE32-HASH'
        assertEq(artifactSubject(hash), artifactSubject(hash))
    },
    // formSubject is deterministic across two DISTINCT object literals that
    // carry the identical five field values — proves it does not
    // accidentally key on object identity.
    formSubjectIsDeterministic: () => {
        const a = { ...baseline }
        const b = { ...baseline }
        assertEq(a === b, false)
        assertEq(formSubject(a), formSubject(b))
    },
    // Changing exactly one of the five fields, holding the other four
    // fixed, changes the resulting subject — one leaf per field.
    changingOneField: {
        payerTin: () => {
            assertEq(formSubject({ ...baseline, payerTin: '99-9999999' }) === formSubject(baseline), false)
        },
        recipientTin: () => {
            assertEq(formSubject({ ...baseline, recipientTin: '999-99-9999' }) === formSubject(baseline), false)
        },
        accountNumber: () => {
            assertEq(formSubject({ ...baseline, accountNumber: 'ACC-9999' }) === formSubject(baseline), false)
        },
        taxYear: () => {
            assertEq(formSubject({ ...baseline, taxYear: 2023 }) === formSubject(baseline), false)
        },
        formType: () => {
            assertEq(formSubject({ ...baseline, formType: 'vnd.fjs.ocr' }) === formSubject(baseline), false)
        },
    },
    // Collision resistance: demonstrates WHY JSON.stringify was chosen over
    // manual colon-joining, not just that it works. `a` and `b` are two
    // genuinely distinct five-tuples (different recipientTin AND different
    // accountNumber) that a naive `[...].join(':')` encoding would collide
    // on, because the colon inside `a.accountNumber` shifts the field
    // boundary to exactly reproduce `b`'s recipientTin/accountNumber split.
    // formSubject's JSON.stringify-array encoding does not collide, because
    // JSON array syntax (quotes + structural commas) delimits fields
    // unambiguously regardless of characters embedded inside a field.
    delimiterCollisionResistance: () => {
        const a = { ...baseline, recipientTin: 'R', accountNumber: '1:2' }
        const b = { ...baseline, recipientTin: 'R:1', accountNumber: '2' }
        /** @type {(k: FormKey) => string} */
        const naiveColonJoin = k =>
            [k.formType, String(k.taxYear), k.payerTin, k.recipientTin, k.accountNumber].join(':')
        // The premise: these two distinct tuples really do collide under a
        // naive delimiter join.
        assertEq(naiveColonJoin(a), naiveColonJoin(b))
        // The proof: formSubject does NOT collide on the same two tuples.
        assertEq(formSubject(a) === formSubject(b), false)
    },
}
