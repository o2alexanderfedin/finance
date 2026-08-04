/**
 * `base(dialect)` — the shared document-base spread helper (DOC-00).
 *
 * Every document dialect built in this phase (and later phases) declares its
 * `dialect` field via this one helper, not by hand-writing
 * `{ dialect: 'vnd.fjs.x', ... }` per type — mirroring the
 * `application/vnd.fjs.<name>+json` naming convention `fjs/media/revision`
 * already establishes (see AGENTS.md, "New file formats follow the Revision
 * precedent").
 *
 * An rtti `Struct` is a plain string-keyed map of types, so this repo's type
 * system has no schema-inheritance mechanism to lean on — a dialect schema
 * is instead assembled by spreading this helper's result ahead of the
 * dialect's own fields:
 *
 * ```js
 * export const schema = { ...base('vnd.fjs.1099int'), payerTin: string, ... }
 * ```
 *
 * `dialect` is spread *first* on purpose: RTTI's struct validator walks a
 * schema's keys in order, so on a mismatched blob it reports `dialect` — the
 * discriminant — as the first failing field, rather than surfacing some
 * unrelated field further down the schema first (Plan 05-02's criterion-1
 * proof depends on this).
 *
 * This is the entire shared base today — one field. No speculative fields
 * (`sourceRef`, `createdAt`, ...) are added here; nothing this phase's
 * requirements call for needs them. If a later dialect (Phase 11+: W-2,
 * 1099-DIV, etc.) needs to widen this base, that is the signal worth
 * revisiting this decision, not something to pre-guess now.
 *
 * @module
 */
import { assertEq } from 'functionalscript/fjs/asserts/module.f.js'

/**
 * Returns `{ dialect }`, with `dialect`'s literal string type preserved in
 * the return type rather than widened to plain `string` — required so that
 * a dialect schema built by spreading this result still carries an
 * exact-literal `dialect` discriminant (DOC-00's criterion 1: structural
 * validation alone must reject another dialect's blob).
 *
 * @type {<D extends string>(dialect: D) => { readonly dialect: D }}
 */
export const base = dialect => ({ dialect })

// ── Tests ────────────────────────────────────────────────────────────────────

// Type-level negative case (documents the literal-preservation requirement
// this module exists to satisfy). Verified live during development — see
// SUMMARY for the RED/GREEN `tsc` transcript this exact block produced:
// RED (generic annotation removed, `dialect` widened to plain `string`):
// `tsc --noEmit` exits 0 — the wrong-literal assignment below is NOT
// rejected, even though it should be. GREEN (generic annotation restored):
// `tsc --noEmit` reports
// `error TS2322: Type '"vnd.fjs.wrong"' is not assignable to type
// '"vnd.fjs.ocr"'.` on the line below. Left commented here so the
// permanently-green suite never carries a deliberately-failing compile
// check.
//
// const _sample = base('vnd.fjs.ocr')
// /** @type {typeof _sample.dialect} */
// const _wrongDialectLiteral = 'vnd.fjs.wrong'

export const proof = {
    // Two calls with different dialect strings produce distinct, correct
    // `{ dialect }` objects.
    distinctDialects: () => {
        assertEq(base('vnd.fjs.ocr').dialect, 'vnd.fjs.ocr')
        assertEq(base('vnd.fjs.1099int').dialect, 'vnd.fjs.1099int')
    },
    // Spreading the result into a larger object literal produces an object
    // with both keys present, `dialect` first.
    spreadOrder: () => {
        const spread = { ...base('vnd.fjs.x'), y: 1 }
        assertEq(spread.dialect, 'vnd.fjs.x')
        assertEq(spread.y, 1)
        assertEq(Object.keys(spread)[0], 'dialect')
    },
}
