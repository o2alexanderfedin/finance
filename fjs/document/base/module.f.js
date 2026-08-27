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
import { assertEq } from 'functionalscript/fjs/asserts/module.f.mjs'

/** @import { ConstObject, Rest, Type } from 'functionalscript/fjs/types/rtti/types.js' */

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

/**
 * The members a container schema **declares**, read out of the wrapper that
 * states its rest.
 *
 * Since `functionalscript` 0.47.0 a bare `Struct` is **closed** — it admits the
 * members it names and no others — so every dialect schema here says `open(...)`
 * to keep the acceptance it had at 0.46.1 and to stay readable by a client
 * written against an older revision. `open(c)` is a *thunk* returning
 * `['rest', c, unknown]`, so a schema is no longer the plain object it used to
 * be, and **the ways this repo introspects one all break silently**:
 * `Object.keys(schema)` answers `[]`, and `'box1' in schema` answers `false`.
 *
 * Silently is the word that matters. `tsc` catches `schema.someField` and
 * catches nothing else, because `Object.keys` and `in` are legal on any object.
 * A proof asserting a field is ABSENT — `assert(!('boxG' in declaredMembers(k1SCorporationSchema)))`
 * — would therefore keep passing while testing nothing at all, which is this
 * project's most expensive recorded defect (STATE.md, "Vacuous proof"). Reading
 * through this helper is what makes the unwrapping explicit at each site instead
 * of a property access that happens to still compile.
 *
 * @type {<C extends ConstObject>(schema: Rest<C, Type>) => C}
 */
export const declaredMembers = schema => schema()[1]

/**
 * The media type a dialect tag derives, mechanically:
 * `application/` + tag + `+json`, the `fjs/media/revision` convention
 * AGENTS.md points at.
 *
 * Five modules wrote this same template literal by hand, differing only in
 * which `dialect` const was in scope. The derivation is one rule, so it is
 * written once — and it lives beside {@link base} because both express the
 * same thing: what a dialect tag *implies*.
 *
 * The return type is the template literal type, not plain `string`, so a
 * caller's `mediaType` keeps the exact value in its type the way the
 * hand-written spelling did.
 *
 * @type {<D extends string>(dialect: D) => `application/${D}+json`}
 */
export const mediaTypeOf = dialect => `application/${dialect}+json`

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
