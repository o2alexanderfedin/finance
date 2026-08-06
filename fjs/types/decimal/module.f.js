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
 * Plan 01 precedent), this file's *code* is generic and liftable as-is:
 * `scale` is a parameter, never hardcoded, no export or type names a currency
 * or a tax concept, and it imports nothing from this repo. The scale-2
 * instantiation lives in `fjs/exact/module.f.js`, not here.
 *
 * The prose does cite money, deliberately — the precision hazard that
 * motivates fixed-scale parsing is easiest to state in the terms where it
 * actually bites. A lift upstream should generalise the comment rather than
 * drop the rationale.
 *
 * @module
 */
import { assert, assertEq } from 'functionalscript/fjs/asserts/module.f.js'
import { error, ok, unwrap } from 'functionalscript/fjs/types/result/module.f.js'

/** @import { Result } from 'functionalscript/fjs/types/result/module.f.js' */

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
export const parse = scale => s => unwrap(tryParse(scale)(s))

/**
 * {@link parse}'s total form: the same rules, refusing with an `error` value
 * instead of a throw.
 *
 * This is the primitive and `parse` is the wrapper, not the other way round.
 * A caller that must not throw — a dialect's `validate`, which turns bad
 * input into a reported message — otherwise has to wrap the call in
 * `try`/`catch`, and `.f.js` files have none (AGENTS.md §6.5): FunctionalScript
 * itself has no `try`, so a module that needs one is a module whose dependency
 * refuses in the wrong shape.
 * @type {(scale: number) => (s: string) => Result<bigint, string>}
 */
export const tryParse = scale => s => {
    const m = decimalPattern.exec(s)
    if (m === null) { return error('not a decimal number: ' + s) }
    const [, sign, intPart, fracPart] = m
    if (intPart === undefined) { return error('not a decimal number: ' + s) }
    const frac = fracPart ?? ''
    if (frac.length > scale) { return error('more than ' + scale + ' fractional digits: ' + s) }
    const padded = frac.padEnd(scale, '0')
    const magnitude = BigInt(intPart) * 10n ** BigInt(scale) + (padded === '' ? 0n : BigInt(padded))
    return ok(sign === '-' ? -magnitude : magnitude)
}

/**
 * Formats a minor-unit `bigint` back into a fixed-scale decimal string,
 * always emitting exactly `scale` fractional digits, zero-padded (e.g. at
 * `scale = 2`, `123456n` becomes `'1234.56'`). Exact inverse of `parse` at
 * the same `scale`.
 * @type {(scale: number) => (n: bigint) => string}
 */
export const format = scale => n => {
    const sign = n < 0n ? '-' : ''
    const magnitude = n < 0n ? -n : n
    const digits = magnitude.toString().padStart(scale + 1, '0')
    return scale === 0
        ? sign + digits
        : sign + digits.slice(0, digits.length - scale) + '.' + digits.slice(digits.length - scale)
}

// ── Tests ────────────────────────────────────────────────────────────────────

export const proof = {
    // `tryParse` is the primitive; these pin that it refuses with a value
    // rather than a throw, and that `parse` still throws on the same input —
    // the pair has to keep both behaviours, since callers depend on each.
    tryParse: {
        acceptsWhatParseAccepts: () => {
            assertEq(unwrap(tryParse(2)('1234.56')), 123456n)
            assertEq(unwrap(tryParse(2)('-0.05')), -5n)
            assertEq(unwrap(tryParse(2)('7')), 700n)
        },
        refusesWithAValueNotAThrow: () => {
            assertEq(tryParse(2)('not a number')[0], 'error')
            assertEq(tryParse(2)('1.234')[0], 'error')
            assertEq(tryParse(2)('1,234.56')[0], 'error')
        },
        errorNamesTheInput: () => {
            const [, v] = tryParse(2)('1.234')
            assert(String(v).includes('1.234'), String(v))
        },
    },
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
    // `parse` is `unwrap(tryParse(...))`, so these also pin that the wrapper
    // still throws where the total form returns an error — the pair has to
    // keep both behaviours.
    throw: {
        overPrecision: () => parse(2)('1234.567'),
        garbage: () => parse(2)('abc'),
        emptyString: () => parse(2)(''),
    },
}
