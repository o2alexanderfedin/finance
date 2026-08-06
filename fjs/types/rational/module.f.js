/**
 * `Rational` — an exact rational number as `[numerator, denominator]`, a pair
 * of `bigint`s whose denominator is always strictly positive after
 * construction. Alongside it: exact arithmetic (`add`, `multiply`, `sum`)
 * and one named rounding mode, `halfUp` — IRS half-up rounding, ties away
 * from zero at both signs (matches Java's `BigDecimal.ROUND_HALF_UP`,
 * explicitly *not* JavaScript's built-in number rounding, which is biased
 * toward `+Infinity` on ties — rounding `-2.5` toward `-2` rather than `-3`,
 * a systematic bias in the taxpayer's favor on every loss; `halfUp`'s proof
 * pins the divergence explicitly).
 *
 * Construction never divides, reduces, or approximates. `of` is a pure
 * sign-normalizing pass-through — moving a negative sign off the
 * denominator and onto the numerator — not a rounding constructor. A money
 * type that rounds on construction must not exist here: if a value rounded
 * when built, `round(sum(x)) !== sum(round(x))` would become unrepresentable
 * and the whole point of separating exact arithmetic from named rounding
 * would be lost.
 *
 * This file is written to be lifted into FunctionalScript (see AGENTS.md's
 * staging rule). Its *code* is generic: no cents, no money type, no currency
 * or tax concept appears in any export or type here, and it imports nothing
 * from this repo. The scale-2 instantiation lives in `fjs/exact/module.f.js`.
 *
 * The prose above is not generic, deliberately. `halfUp` exists because a
 * specific rule was needed — ties away from zero at both signs — and the
 * reason it is not the built-in rounding is worth stating where the function
 * is defined rather than losing it. A lift upstream should generalise this
 * comment; it should not silently drop the rationale.
 *
 * Deliberately absent: any per-item-rounding convenience (no `roundEach`,
 * no `mapRound`). Composing `halfUp(sum(list))` directly at the call site
 * is the only path this module offers, which is what keeps
 * `round(sum(x))` the natural operation and `sum(round(x))` an extra step
 * nobody is invited to take.
 *
 * @module
 */
import { fold } from 'functionalscript/fjs/common/monoid/module.f.js'
import { assert, assertEq } from 'functionalscript/fjs/asserts/module.f.js'

/** @import { List } from 'functionalscript/fjs/types/list/module.f.js' */

/**
 * An exact rational number: `[numerator, denominator]`. The denominator is
 * always strictly positive after construction; the sign, if any, lives on
 * the numerator. Never reduced — `of(7n)(3n)` stays `[7n, 3n]` forever,
 * not `[7n, 3n]` simplified to anything smaller.
 * @typedef {readonly [bigint, bigint]} Rational
 */

// ── Construction and arithmetic ─────────────────────────────────────────────

/**
 * Constructs a `Rational` from a numerator and denominator. Refuses a zero
 * denominator (a throw, never a silent `Infinity`/`NaN`). Normalizes sign
 * onto the numerator so the denominator stays positive. Never divides,
 * reduces, or approximates — this is a pure pass-through, not a rounding
 * constructor.
 * @type {(numerator: bigint) => (denominator: bigint) => Rational}
 */
export const of = numerator => denominator => {
    assert(denominator !== 0n, 'rational denominator must not be zero')
    return denominator < 0n ? [-numerator, -denominator] : [numerator, denominator]
}

/**
 * Constructs a `Rational` equal to the integer `n` (i.e. `n / 1`).
 * @type {(n: bigint) => Rational}
 */
export const ofInt = n => of(n)(1n)

/**
 * Negates a `Rational` exactly.
 * @type {(a: Rational) => Rational}
 */
export const negate = a => [-a[0], a[1]]

/**
 * Adds two `Rational`s exactly, via unreduced cross-multiplication.
 * @type {(a: Rational) => (b: Rational) => Rational}
 */
export const add = a => b => of(a[0] * b[1] + b[0] * a[1])(a[1] * b[1])

/**
 * Multiplies two `Rational`s exactly.
 * @type {(a: Rational) => (b: Rational) => Rational}
 */
export const multiply = a => b => of(a[0] * b[0])(a[1] * b[1])

/**
 * Sums a list of `Rational`s exactly, left fold from `ofInt(0n)` through
 * `add`.
 * @type {(input: List<Rational>) => Rational}
 */
export const sum = fold({ identity: ofInt(0n), operation: add })

// ── Rounding ─────────────────────────────────────────────────────────────────

/**
 * IRS half-up rounding: rounds a `Rational` to the nearest `bigint`, ties
 * breaking away from zero at both signs. Rounding is a property of a 1040
 * line — never call this on construction, only at the point a line's
 * value is reported. Explicitly not JavaScript's built-in number rounding,
 * whose tie-break is biased toward `+Infinity` (it rounds `-2.5` to `-2`
 * but `2.5` to `3`), a systematic bias in the taxpayer's favor on every
 * loss — the proof below pins the divergence at `-2.5` exactly.
 *
 * bigint `/` and `%` both truncate toward zero, and `%`'s result carries the
 * dividend's sign (e.g. `-5n % 2n === -1n`, not `1n`). That is exactly what
 * this formula relies on: `q = n / d` is already the round-toward-zero
 * answer for this rational. `r = n % d` is the leftover remainder, signed
 * the same way `n` is. If `r` is zero there is no remainder to round — `q`
 * is exact. Otherwise compare `2 * |r|` against `d`: if the remainder's
 * magnitude is at least half the denominator (a tie or past it), nudge `q`
 * one step further from zero, in the direction `r`'s sign already points
 * (`+1` if `r` is positive, `-1` if `r` is negative). Below half, `q` is
 * left as the round-toward-zero answer, which is also the correctly
 * rounded one in that case.
 * @type {(a: Rational) => bigint}
 */
export const halfUp = ([n, d]) => {
    const q = n / d
    const r = n % d
    if (r === 0n) {
        return q
    }
    const absR = r < 0n ? -r : r
    return absR * 2n >= d ? q + (r > 0n ? 1n : -1n) : q
}

// ── Tests ────────────────────────────────────────────────────────────────────

/**
 * Serializes a `Rational` (or a plain bigint tuple) for exact test
 * comparison. Plain `JSON.stringify` cannot serialize `bigint` on its own
 * (it throws `TypeError: Do not know how to serialize a BigInt`), so this
 * passes a replacer that renders each bigint via `.toString()` first.
 * Test-only — not part of this module's exported surface.
 * @type {(a: readonly bigint[]) => string}
 */
const show = a => JSON.stringify(a, (_key, v) => typeof v === 'bigint' ? v.toString() : v)

export const proof = {
    construction: {
        exactNoReduction: () => {
            assertEq(show(of(7n)(3n)), show([7n, 3n]))
        },
        negativeDenominatorNormalized: () => {
            assertEq(show(of(1n)(-2n)), show([-1n, 2n]))
        },
    },
    arithmetic: {
        // T-08-06-03: `negate` has zero callers and, until this proof, zero
        // coverage — reducing it to the identity function (`a => a`) left
        // the suite green. Covers both a positive and a negative numerator,
        // and that the denominator is left untouched.
        negate: () => {
            assertEq(show(negate(of(3n)(4n))), show([-3n, 4n]))
            assertEq(show(negate(of(-3n)(4n))), show([3n, 4n]))
        },
        add: () => {
            assertEq(show(add(of(1n)(3n))(of(1n)(6n))), show([9n, 18n]))
        },
        multiply: () => {
            assertEq(show(multiply(of(1n)(3n))(of(2n)(5n))), show([2n, 15n]))
        },
        sum: () => {
            assertEq(
                show(sum([of(1n)(2n), of(1n)(2n), of(1n)(2n)])),
                show([12n, 8n]))
        },
    },
    rounding: {
        tieAwayFromZeroPositive: () => {
            assertEq(halfUp(of(5n)(2n)), 3n)
        },
        tieAwayFromZeroNegativeDiffersFromMathRound: () => {
            const ours = halfUp(of(-5n)(2n))
            assertEq(ours, -3n)
            const builtIn = BigInt(Math.round(-2.5))
            assertEq(builtIn, -2n)
            assert(ours !== builtIn, 'halfUp must differ from the built-in rounding at the -2.5 tie')
        },
        towardZeroBelowHalf: () => {
            assertEq(halfUp(of(1n)(3n)), 0n)
            assertEq(halfUp(of(-1n)(3n)), 0n)
        },
        awayFromZeroAboveHalf: () => {
            assertEq(halfUp(of(2n)(3n)), 1n)
            assertEq(halfUp(of(-2n)(3n)), -1n)
        },
        exactNoRemainder: () => {
            assertEq(halfUp(of(6n)(3n)), 2n)
        },
    },
    // The exhibited counterexample (ROADMAP.md Phase 4 success criterion 3):
    // round(sum(x)) and sum(round(x)) can disagree on the same input.
    lineRoundingVsPerItemRounding: () => {
        const items = [of(1n)(2n), of(1n)(2n), of(1n)(2n)]
        const roundOfSum = halfUp(sum(items))
        assertEq(roundOfSum, 2n)
        const sumOfRounds = items.map(halfUp).reduce((a, b) => a + b, 0n)
        assertEq(sumOfRounds, 3n)
        assert(roundOfSum !== sumOfRounds, 'round(sum(x)) must be able to differ from sum(round(x))')
    },
    throw: {
        zeroDenominator: () => of(1n)(0n),
    },
}
