/**
 * The semantic check every dialect's money field shares: a stored amount
 * must be an exact decimal string at this project's cents scale, and its
 * magnitude must stay inside `Number.MAX_SAFE_INTEGER`.
 *
 * Extracted when the third dialect needed it (`vnd.fjs.1099int`,
 * `vnd.fjs.w2`, `vnd.fjs.medical_expenses`), not written speculatively for
 * the first. The check is identical in each, and identical-by-copy is how
 * two dialects come to disagree about what an amount is.
 *
 * Returns an error message or `undefined` rather than a `Result`: callers
 * are already inside a `checkReferences` that owns the `Result` shape, and
 * a nullable message composes into a loop without unwrapping at every step.
 *
 * @module
 */
import { assert, assertEq } from 'functionalscript/fjs/asserts/module.f.mjs'
import { centsToString, tryCentsFromString } from '../../exact/module.f.js'

/**
 * `Number.MAX_SAFE_INTEGER` as a bigint, so the bound is compared
 * bigint-to-bigint and the value never passes through `Number()` — which
 * would reintroduce exactly the precision hazard `fjs/types/decimal`
 * exists to prevent.
 * @type {bigint}
 */
export const maxSafeCents = BigInt(Number.MAX_SAFE_INTEGER)

/**
 * Checks one present money string. `undefined` means it is fine; a string
 * is the reason it is not.
 *
 * `tryCentsFromString` refuses with an `error` value, so nothing throws and
 * this file needs no `try` — which `.f.js` files may not use (AGENTS.md
 * §6.5). The refusal must never escape a dialect's `validate`, and now it
 * cannot: there is no throw to escape. A comma-grouped value reaches this
 * check only if it bypassed the OCR conversion boundary, and is refused
 * rather than repaired: repairing it here would be the second conversion
 * path DOC-04 exists to prevent.
 * @type {(label: string) => (printed: string) => string | undefined}
 */
export const moneyFieldError = label => printed => {
    const [t, v] = tryCentsFromString(printed)
    if (t === 'error') { return `${label} is not an exact decimal: ${v}` }
    const magnitude = v < 0n ? -v : v
    return magnitude > maxSafeCents ? `${label} exceeds safe integer magnitude: ${printed}` : undefined
}

// ── Tests ────────────────────────────────────────────────────────────────────

export const proof = {
    canonicalAmountAccepted: () => {
        assertEq(moneyFieldError('box1')('1234.56'), undefined)
    },
    negativeAccepted: () => {
        assertEq(moneyFieldError('box1')('-0.05'), undefined)
    },
    // The comma-grouped form is the OCR boundary's input, never a stored
    // value — refused here, never repaired into one.
    commaGroupedRefused: () => {
        const e = moneyFieldError('box1')('1,234.56')
        assert(e !== undefined, 'a comma-grouped amount must be refused')
    },
    overPrecisionRefused: () => {
        const e = moneyFieldError('box1')('1.234')
        assert(e !== undefined, 'more fractional digits than the cents scale must be refused')
    },
    garbageRefused: () => {
        const e = moneyFieldError('box1')('approx. 1200')
        assert(e !== undefined, 'a non-numeric amount must be refused')
    },
    // The bound is a bigint comparison and it is exact: these two amounts
    // differ by a single cent, and nothing but the bound itself separates
    // them. Derived through `centsToString` rather than written as literals,
    // so the boundary cannot drift away from `maxSafeCents`.
    safeIntegerBoundary: () => {
        assertEq(moneyFieldError('box1')(centsToString(maxSafeCents)), undefined)
        const e = moneyFieldError('box1')(centsToString(maxSafeCents + 1n))
        assert(e !== undefined, 'one cent beyond MAX_SAFE_INTEGER must be refused')
    },
    // Sign is not what the bound tests: the same magnitude is refused
    // negative, so a large loss cannot slip through.
    negativeBeyondSafeIntegerRefused: () => {
        const e = moneyFieldError('box1')(centsToString(-(maxSafeCents + 1n)))
        assert(e !== undefined, 'a large negative magnitude must be refused too')
    },
    // The label travels into the message, so a failure localizes to the box
    // that caused it rather than to "some money field".
    messageNamesTheField: () => {
        const e = moneyFieldError('box7SocialSecurityTips')('nope')
        assert(e !== undefined, 'expected an error')
        assert(e.includes('box7SocialSecurityTips'), e)
    },
}
