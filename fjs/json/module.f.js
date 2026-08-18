/**
 * The project's JSON text codec — `fjs/media/json`, bound once.
 *
 * Every value this repository writes to CAS or puts on the wire is serialized
 * here rather than by the host's `JSON`. Two reasons, in the order they
 * matter:
 *
 * - **`JSON` is the host, not FunctionalScript.** Nothing in `fjs/` defines
 *   it and NaNVM has no `JSON` object, so a `.f.js` module reaching for it
 *   depends on the JS engine it happens to run under. AGENTS.md's "use
 *   FunctionalScript itself as much as possible" is the rule; this module is
 *   what makes following it a one-line import.
 * - **One binding, not six.** `stringify` is curried on a `MapEntries`
 *   function, so every call site had to choose one. Six call sites choosing
 *   independently is six chances to choose differently — and property order
 *   is observable in a content-addressed store, where a different order is a
 *   different hash. `identity` (source order, the host's own rule) is chosen
 *   once, here.
 *
 * `parse` is re-exported unchanged. It is total — `Result<Unknown, string>`,
 * not a throw — which is the other half of why the host's version had to go:
 * `JSON.parse` throws a `SyntaxError`, and a `.f.js` module has no `try`
 * (AGENTS.md §Testing). The note that used to be cited here,
 * `fjs/todo/upstream-json-parse-split.md`, was retired and deleted in
 * `c1441e1` once 0.43.1 shipped the total parser its own text asked for.
 *
 * **`parse` returns its keys sorted, `stringify` writes them in source
 * order.** So `stringify(unwrap(parse(text)))` canonicalizes rather than
 * reproducing `text`, and in a content-addressed store that is the difference
 * between two hashes. Hash the bytes that were written; never hash a
 * re-serialization of a parsed value and expect the original address. Both
 * halves are pinned by proofs below, because the asymmetry is invisible at
 * the call site.
 *
 * @module
 */
import { stringify as jsonStringify, parse } from 'functionalscript/fjs/media/json/module.f.js'
import { identity } from 'functionalscript/fjs/types/function/module.f.js'
import { unwrap } from 'functionalscript/fjs/types/result/module.f.js'
import { assertEq } from 'functionalscript/fjs/asserts/module.f.js'

/** @import { Unknown } from 'functionalscript/fjs/media/json/module.f.js' */

export { parse }

/**
 * Serializes a JSON value to text, properties in source order.
 * @type {(value: Unknown) => string}
 */
export const stringify = jsonStringify(identity)

// ── Tests ────────────────────────────────────────────────────────────────────

export const proof = {
    // `stringify` preserves source order — this is the choice that fixes the
    // content hash of every record written through this module, so it is
    // pinned rather than left to be inferred.
    stringifyKeepsSourceOrder: () => {
        assertEq(stringify({ b: 1, a: 2 }), '{"b":1,"a":2}')
    },
    // …but `parse` returns its keys SORTED, so a text round trip normalizes
    // rather than preserving. Pinned because of what it means downstream: a
    // record read back and re-serialized does not necessarily reproduce the
    // bytes it was stored as, so a CAS hash must be taken over the text that
    // was actually written, never over a re-serialization of the parsed value.
    parseSortsKeysSoRoundTripCanonicalizes: () => {
        assertEq(stringify(unwrap(parse('{"b":1,"a":2}'))), '{"a":2,"b":1}')
    },
    // The round trip is nonetheless stable after the first pass: parsing an
    // already-canonical text and re-serializing reproduces it exactly.
    roundTripIsIdempotentOnceCanonical: () => {
        /** @type {Unknown} */
        const value = { b: 'two', a: [1, null, true], n: 1.5 }
        const once = stringify(unwrap(parse(stringify(value))))
        assertEq(stringify(unwrap(parse(once))), once)
    },
    // `parse` is total: malformed input is an error value, never a throw.
    parseIsTotal: () => {
        assertEq(parse('not json')[0], 'error')
    },
}
