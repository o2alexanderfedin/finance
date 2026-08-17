/**
 * The semantic check the two equity-compensation dialects share: a stored
 * NUMBER OF SHARES must be an exact non-negative decimal string at this
 * project's share scale, and its magnitude must stay inside
 * `Number.MAX_SAFE_INTEGER` in minor units.
 *
 * `fjs/document/money_field` is the precedent this file follows, one column
 * over, and its own header states the extraction rule: the check is written
 * once because "identical-by-copy is how two dialects come to disagree about
 * what an amount is." `vnd.fjs.form3921` box 5 and `vnd.fjs.form3922` box 6
 * are the two dialects, and both arrive in the same phase, so this is
 * extracted at its second user rather than speculatively at its first.
 *
 * ## A share count is NOT money, and this is not `moneyFieldError` renamed
 *
 * Three of the rules differ, each for a reason on the printed form:
 *
 * 1. **The scale is 6, not 2.** Money in this project is cents (`fjs/exact`'s
 *    `centsScale`). A share count is not denominated in cents and rounding it
 *    to two places would be arithmetically wrong: an employee stock purchase
 *    plan buys whole dollars' worth of stock at a fractional price and issues
 *    the resulting fraction of a share, so a real Form 3922 box 6 routinely
 *    prints something like `12.3456`. Six is the scale chosen because it
 *    covers every broker convention this project has seen printed and because
 *    a scale has to be SOME number; it is stated here, once, rather than
 *    assumed at each call site.
 * 2. **A negative count is refused.** `moneyFieldError` accepts negatives, and
 *    it must — Form 1099-B boxes 8 through 11 are profit-OR-loss boxes and its
 *    own `negativeAccepted` leaf pins that. There is no such thing as a
 *    negative number of shares transferred, and accepting one would let the
 *    Form 6251 line 2i spread come out with the sign reversed.
 * 3. **The magnitude bound is in SHARE minor units**, i.e. millionths of a
 *    share, not cents. Same `Number.MAX_SAFE_INTEGER` reason, different unit.
 *
 * Returns an error message or `undefined` rather than a `Result`, exactly as
 * `moneyFieldError` does and for the same reason: callers are already inside
 * a `checkReferences` that owns the `Result` shape.
 *
 * ## Why this is NOT staged as an upstream-candidate generic
 *
 * AGENTS.md's staging rule targets code with "no locale or domain assumptions
 * baked in" — `fjs/types/decimal` is the example, with `scale` as a parameter.
 * This file is the opposite side of that boundary, and deliberately so: it
 * names a specific scale for a specific kind of quantity on specific printed
 * IRS forms. It composes the generic (`fjs/types/decimal`'s `tryParse`) rather
 * than reimplementing it, which is the whole of what the rule asks.
 *
 * @module
 */
import { assert, assertEq } from 'functionalscript/fjs/asserts/module.f.js'
import { parse, tryParse, format } from '../../types/decimal/module.f.js'
import { maxSafeCents } from '../money_field/module.f.js'

/**
 * This project's share scale: 6 fractional digits, i.e. millionths of a
 * share. See this module's own docstring for why it is not 2.
 * @type {number}
 */
export const shareScale = 6

/**
 * Parses a share-count string into exact bigint MILLIONTHS of a share — a
 * partial application of `fjs/types/decimal`'s generic `parse` at
 * {@link shareScale}. Throws on a malformed string, exactly as
 * `centsFromString` does; {@link shareCountError} is the total form a
 * dialect's `validate` calls.
 * @type {(s: string) => bigint}
 */
export const sharesFromString = parse(shareScale)

/**
 * Formats exact bigint millionths of a share back into a decimal string at
 * {@link shareScale} — the exact inverse of {@link sharesFromString}.
 * @type {(n: bigint) => string}
 */
export const sharesToString = format(shareScale)

/**
 * One share of stock, in the minor units {@link sharesFromString} returns.
 * Named rather than written as `10n ** 6n` at each site, because a spread
 * computation divides by it and a wrong power of ten there is a factor-of-ten
 * error in a taxpayer's alternative minimum taxable income.
 * @type {bigint}
 */
export const oneShare = 10n ** BigInt(shareScale)

/**
 * Checks one present share-count string. `undefined` means it is fine; a
 * string is the reason it is not.
 *
 * `maxSafeCents` is reused as the magnitude bound rather than a second
 * constant of the same value: it is `BigInt(Number.MAX_SAFE_INTEGER)`, which
 * is a property of the runtime rather than of money, and its own docstring
 * says so. Importing it keeps one statement of that bound in the tree.
 * @type {(label: string) => (printed: string) => string | undefined}
 */
export const shareCountError = label => printed => {
    const [t, v] = tryParse(shareScale)(printed)
    if (t === 'error') { return `${label} is not an exact decimal share count: ${v}` }
    if (v < 0n) { return `${label} is a negative number of shares: ${printed}` }
    return v > maxSafeCents ? `${label} exceeds safe integer magnitude: ${printed}` : undefined
}

// ── Tests ────────────────────────────────────────────────────────────────────

export const proof = {
    wholeShareCountAccepted: () => {
        assertEq(shareCountError('box5')('100'), undefined)
        assertEq(sharesFromString('100'), 100000000n)
    },
    // The case that makes the scale-6 decision load-bearing rather than
    // cosmetic: a real ESPP purchase issues a fraction of a share, and this
    // is the value `moneyFieldError` would have refused as over-precise.
    fractionalShareCountAccepted: () => {
        assertEq(shareCountError('box6')('12.3456'), undefined)
        assertEq(sharesFromString('12.3456'), 12345600n)
        // …and the cents scale really would have refused it, so the two
        // helpers are not interchangeable. Stated here rather than assumed,
        // because the whole reason this file exists is that they differ.
        assertEq(tryParse(2)('12.3456')[0], 'error')
    },
    // Rule 2: the one place this diverges from `moneyFieldError` in the
    // direction that changes an answer. `moneyFieldError`'s own
    // `negativeAccepted` leaf is the control on the other side.
    negativeShareCountRefusedNamingTheSign: () => {
        const e = shareCountError('box5')('-100')
        assert(e !== undefined, 'a negative number of shares must be refused')
        assert(String(e).includes('negative'), ['the refusal must say WHY', e])
        assert(String(e).includes('box5'), ['the refusal must name the field', e])
    },
    // THE BOUNDARY PAIR, at one millionth of a share, and it exists because a
    // mutation found its absence. Weakening the guard from `v < 0n` to
    // `v < -1n` -- a plausible off-by-one -- left the whole suite GREEN, since
    // the two differ only at exactly `-0.000001` shares and no fixture sat
    // there. A sign guard whose boundary nothing pins is a guard whose
    // boundary can move.
    theSignBoundaryIsExactlyZero: () => {
        assertEq(shareCountError('box5')('0'), undefined, 'zero shares is not a negative count')
        assertEq(shareCountError('box5')('0.000000'), undefined, 'and neither is zero written out')
        const e = shareCountError('box5')('-0.000001')
        assert(e !== undefined, 'one millionth of a share below zero IS a negative count')
        assert(String(e).includes('negative'), ['the refusal must say WHY', e])
    },
    // Seven fractional digits is one more than the scale carries, so it is a
    // refusal rather than a silent truncation -- `fjs/types/decimal`'s own
    // over-precision rule, exercised at THIS scale so a scale changed here
    // reddens.
    overPrecisionRefused: () => {
        const e = shareCountError('box6')('1.1234567')
        assert(e !== undefined, 'more fractional digits than the share scale must be refused')
        assertEq(shareCountError('box6')('1.123456'), undefined, 'exactly six digits is fine')
    },
    commaGroupedRefused: () => {
        const e = shareCountError('box5')('1,000')
        assert(e !== undefined, 'a comma-grouped share count must be refused')
    },
    garbageRefused: () => {
        const e = shareCountError('box5')('one hundred')
        assert(e !== undefined, 'a non-numeric share count must be refused')
    },
    // The bound is a bigint comparison in SHARE minor units, and it is exact:
    // these two counts differ by one millionth of a share. Derived through
    // `sharesToString` rather than written as a literal, so the boundary
    // cannot drift away from the bound it is testing.
    safeIntegerBoundary: () => {
        assertEq(shareCountError('box5')(sharesToString(maxSafeCents)), undefined)
        const e = shareCountError('box5')(sharesToString(maxSafeCents + 1n))
        assert(e !== undefined, 'one millionth of a share beyond MAX_SAFE_INTEGER must be refused')
    },
    // `oneShare` is the divisor a spread computation uses; a wrong power of
    // ten there is a factor-of-ten error in AMTI. Asserted against the
    // parse of the string "1", which is an independent statement of the
    // same fact.
    oneShareAgreesWithTheParseOfOne: () => {
        assertEq(oneShare, 1000000n)
        assertEq(oneShare, sharesFromString('1'))
    },
    roundTrip: () => {
        assertEq(sharesToString(sharesFromString('12.3456')), '12.345600')
        assertEq(sharesToString(sharesFromString('100')), '100.000000')
    },
}
