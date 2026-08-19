/**
 * This project's exact-arithmetic module (EXACT-01..05): composes
 * `fjs/types/decimal` (the storage/wire boundary — fixed-scale decimal
 * strings) and `fjs/types/rational` (exact computation and the `halfUp`
 * rounding mode) into this project's money representation — bigint minor
 * units ("cents", decimal scale 2) with rates as exact rationals.
 *
 * Unlike its two dependencies, this file is **not** itself an upstream
 * candidate: it is local integration naming a specific scale, which is
 * finance-context framing, not a generic capability. `fjs/types/decimal`
 * and `fjs/types/rational` are the two pieces AGENTS.md's staging rule
 * actually targets for lifting into FunctionalScript unchanged.
 *
 * @module
 */
import { parse, tryParse, format } from '../types/decimal/module.f.js'
import { ofInt, multiply, of, halfUp } from '../types/rational/module.f.js'
import { assertEq } from 'functionalscript/fjs/asserts/module.f.mjs'

/** @import { Result } from 'functionalscript/fjs/types/result/module.f.mjs' */

/**
 * This project's money scale: 2 fractional digits, i.e. cents.
 * @type {number}
 */
export const centsScale = 2

/**
 * Parses a decimal string at this project's money scale into exact
 * bigint cents — a partial application of `fjs/types/decimal`'s generic
 * `parse` at `centsScale`. No new logic here.
 * @type {(s: string) => bigint}
 */
export const centsFromString = parse(centsScale)

/**
 * {@link centsFromString}'s total form — the same parse at this project's
 * money scale, refusing with an `error` value instead of a throw. What a
 * dialect's `validate` calls, since it must report bad input rather than
 * propagate it and `.f.js` files have no `try`.
 * @type {(s: string) => Result<bigint, string>}
 */
export const tryCentsFromString = tryParse(centsScale)

/**
 * Formats exact bigint cents back into a decimal string at this
 * project's money scale — a partial application of `fjs/types/decimal`'s
 * generic `format` at `centsScale`. No new logic here.
 *
 * Cents are exactly what `centsFromString` returns: a plain `bigint`,
 * with no construction path that rounds — a money type that rounds on
 * construction must not exist here, satisfied by there being no such
 * type at all, not by a class that happens not to round.
 * @type {(n: bigint) => string}
 */
export const centsToString = format(centsScale)

// ── Tests ────────────────────────────────────────────────────────────────────

/**
 * Serializes a `Rational` (or a plain bigint tuple) for exact test
 * comparison. Plain `JSON.stringify` cannot serialize `bigint` on its
 * own (it throws `TypeError: Do not know how to serialize a BigInt`), so
 * this passes a replacer that renders each bigint via `.toString()`
 * first. Test-only — not part of this module's exported surface.
 * @type {(a: readonly bigint[]) => string}
 */
const show = a => JSON.stringify(a, (_key, v) => typeof v === 'bigint' ? v.toString() : v)

export const proof = {
    // EXACT-05, demonstrated on one concrete value: a decimal string at
    // the storage/wire boundary, an exact rational mid-computation, a
    // single round to bigint cents at the line boundary, and back to a
    // decimal string for the MCP wire. Each stage asserted individually
    // so a failure localizes to the specific layer that broke.
    threeLayersOnOneValue: () => {
        // Layer 1: the storage/wire-boundary decimal string. Never a
        // JSON number — a JSON number is an IEEE 754 double before any
        // arithmetic happens.
        const stored = '1234.56'

        // Layer 1 -> layer 2: exact parse into bigint cents.
        const cents = centsFromString(stored)
        assertEq(cents, 123456n)

        // Layer 2: computation, with an exact rational share at a rate
        // that is not representable as a terminating decimal (1/7) —
        // surviving without any floating-point corruption.
        const share = multiply(ofInt(cents))(of(1n)(7n))
        assertEq(show(share), show([123456n, 7n]))

        // Rounded once, at the line boundary, never per-item: 123456/7
        // cents = 17636.571428... cents; the fractional part exceeds
        // one-half, so halfUp rounds away from zero to 17637.
        const lineCents = halfUp(share)
        assertEq(lineCents, 17637n)

        // Layer 2 -> layer 3: back to a decimal string for the MCP
        // wire. fjs's JSON Primitive has no bigint, so a bigint schema
        // cannot cross JSON-RPC — this is not a stylistic choice.
        const wire = centsToString(lineCents)
        assertEq(wire, '176.37')
    },
}
