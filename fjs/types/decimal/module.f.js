/**
 * Fixed-scale decimal string <-> `bigint` conversion: `parse` and `format`.
 * `scale` is the number of fractional digits a value carries; conversion is
 * exact in both directions at any `scale` — `parse` refuses (via `assert`) a
 * string that carries more fractional digits than `scale` rather than
 * rounding or truncating it away, and `format` always emits exactly `scale`
 * fractional digits, zero-padded.
 *
 * No `Number()`, no floating-point conversion function of any kind, appears
 * anywhere in this file — string manipulation and `BigInt()` only. This
 * matters because a JSON/JS number is an IEEE 754 double before any
 * arithmetic even happens, and that representation is provably lossy for
 * money: multiplying `1.005` by `100` does not land on `100.5`, and the
 * obvious built-in way to format a double to two decimal places rounds a
 * value like `1.005` down to `"1.00"` — a silent one-cent error, in the
 * taxpayer's disfavour, with no visible failure. This module exists to make
 * that class of hazard structurally impossible: every value here is either a
 * string or a `bigint`, never a double, from parse to format.
 *
 * Per AGENTS.md's staging rule (a missing generic capability is written here
 * first, then lifted upstream unchanged — mirroring `fjs/types/rational`'s
 * Plan 01 precedent), this file is generic and liftable as-is: `scale` is a
 * parameter, never hardcoded, and there is zero finance-specific content
 * anywhere in it. The project's own scale-2 ("cents") instantiation lives in
 * `fjs/exact/module.f.js`, not here.
 *
 * @module
 */
import { assert, assertNotNullish } from 'functionalscript/fjs/asserts/module.f.js'

/**
 * Matches a full decimal string: an optional leading `-`, one or more
 * integer digits, and an optional `.` followed by one or more fractional
 * digits. Both digit groups are simple, non-nested `\d+` quantifiers with no
 * alternation — evaluation is linear in input length regardless of content,
 * so this pattern has no catastrophic-backtracking shape.
 * @type {RegExp}
 */
const decimalPattern = /^(-)?(\d+)(?:\.(\d+))?$/

/**
 * Parses a fixed-scale decimal string into its exact minor-unit `bigint`
 * (e.g. at `scale = 2`, `'1234.56'` becomes `123456n`). Refuses, via
 * `assert`, a string that is not a decimal number at all, or one that
 * carries more than `scale` fractional digits — over-precision is a refusal,
 * never a silent rounding or truncation. Fewer than `scale` fractional
 * digits, or none at all (a whole number with no decimal point), is exact
 * zero-padding, not an error.
 * @type {(scale: number) => (s: string) => bigint}
 */
export const parse = scale => s => {
    void scale; void s; void decimalPattern; void assertNotNullish
    throw 'not implemented'
}

/**
 * Formats a minor-unit `bigint` back into a fixed-scale decimal string,
 * always emitting exactly `scale` fractional digits, zero-padded (e.g. at
 * `scale = 2`, `123456n` becomes `'1234.56'`). Exact inverse of `parse` at
 * the same `scale`.
 * @type {(scale: number) => (n: bigint) => string}
 */
export const format = scale => n => {
    void scale; void n
    throw 'not implemented'
}

// ── Tests ────────────────────────────────────────────────────────────────────

export const proof = {
    roundTrip: {
        positive: () => {
            const result = format(2)(parse(2)('1234.56'))
            assert(result === '1234.56', result)
        },
        negative: () => {
            const result = format(2)(parse(2)('-1234.56'))
            assert(result === '-1234.56', result)
        },
    },
    parse: {
        wholeDollarNoDecimalPoint: () => {
            const result = parse(2)('5')
            assert(result === 500n, result)
        },
        singleFractionalDigitPadded: () => {
            const result = parse(2)('1234.5')
            assert(result === 123450n, result)
        },
        zero: () => {
            assert(parse(2)('0.00') === 0n, 'parse zero')
            assert(format(2)(0n) === '0.00', 'format zero')
        },
        negativeSmall: () => {
            assert(parse(2)('-0.05') === -5n, 'parse negative small')
            assert(format(2)(-5n) === '-0.05', 'format negative small')
        },
    },
    throw: {
        overPrecision: () => parse(2)('1234.567'),
        garbage: () => parse(2)('abc'),
        emptyString: () => parse(2)(''),
    },
}
