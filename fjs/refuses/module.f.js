/**
 * `refuses` — run a call that must REFUSE, and read WHAT it refused with.
 *
 * ## Why this module exists, and why it is the only `try` under `fjs/`
 *
 * AGENTS.md forbids `try` in a `.f.js`, and the rule is right: `throw` is
 * reserved for panics, and a recoverable failure belongs in a `Result` or in
 * an effect's error channel. This module is the one place the rule cannot
 * apply, and the reason is not a limitation of FunctionalScript — it is what
 * `assert` IS.
 *
 * This codebase's refusals throw BARE values (AGENTS.md's own hard rule: a
 * string or an array, never an `Error`). A proof that a refusal fires can
 * therefore be written two ways:
 *
 * - a leaf nested under a `throw` key, which passes for **any** throw; or
 * - catching the value and asserting what it says.
 *
 * The first is strictly weaker, and AGENTS.md records the exact incident:
 * `fjs/tax/table`'s refusal, mutated from `<` to `<=`, still throws at
 * $100,000.00 — via the unrelated "outside every stored band region" path.
 * A `throw:` leaf stays green through that mutation. Asserting the message
 * catches it. The whole "assert the effect, not merely that something
 * happened" lesson the mutation sweep produced points here.
 *
 * So the `try` is not a workaround for a missing construct; it is the only
 * way to READ a value that arrives by `throw`, and reading it is the thing
 * that makes the proof load-bearing. What was wrong before was not the
 * construct but its **spread**: six copies, in four modules, two of them
 * near-identical private `refuses` helpers whose own docstrings said they
 * were "reimplemented locally" because the other was not exported. One rule,
 * one place — so it lives here, exported, and `grep -rn 'try {' fjs` has
 * exactly one hit.
 *
 * **It is written to be lifted upstream unchanged.** Nothing here is
 * finance-specific: it belongs beside `fjs/asserts`, whose `assert` is what
 * produces the values it reads.
 *
 * @module
 */
import { assert, assertEq } from 'functionalscript/fjs/asserts/module.f.mjs'

/**
 * Renders a bare thrown value as the text a proof asserts against.
 *
 * `assert` throws its message argument unchanged, and this codebase's
 * messages are a string or an array (`[sentence, 'label', value, …]`), so
 * both shapes reach here. An array is joined with a single space, which is
 * the rendering every call site already assumed.
 * @type {(thrown: unknown) => string}
 */
export const refusalText = thrown => {
    assert(
        typeof thrown === 'string' || Array.isArray(thrown),
        ['expected a bare thrown value: a string or an array', thrown],
    )
    return typeof thrown === 'string' ? thrown : thrown.join(' ')
}

/**
 * Runs `call`, requires it to throw, and hands the thrown value's text to
 * `check`.
 *
 * Both halves are load-bearing. `check` is what makes the leaf assert WHAT
 * was refused; the `assert(threw, …)` after the `try` is what stops a call
 * that quietly succeeded from passing — without it, a `refuses` whose
 * subject stopped refusing would run zero assertions and report green.
 * @type {(call: () => unknown) => (check: (message: string) => void) => void}
 */
export const refuses = call => check => {
    let threw = false
    try {
        call()
    } catch (thrown) {
        threw = true
        check(refusalText(thrown))
    }
    assert(threw, 'expected the call to refuse, but it completed without throwing')
}

// ── Tests ────────────────────────────────────────────────────────────────────

/**
 * The text `call` refused with.
 *
 * `refuses` hands its message to a callback rather than returning it, so
 * that a leaf which stops refusing runs zero assertions and still fails.
 * Every leaf below wants the message itself, and threading a `let` through
 * a fresh callback five times spelled the same three lines five ways — and
 * left the two `throw:` leaves defining callbacks that, by the very
 * property they prove, no run can reach.
 * @type {(call: () => unknown) => string}
 */
const refusalTextOf = call => {
    let seen = ''
    refuses(call)(message => { seen = message })
    return seen
}

export const proof = {
    // A string message reaches `check` unchanged.
    stringRefusalReachesCheck: () =>
        assertEq(refusalTextOf(() => { throw 'plain refusal' }), 'plain refusal'),
    // An array message is joined with one space — the rendering every call
    // site already assumed.
    arrayRefusalIsJoinedWithSpaces: () =>
        assertEq(refusalTextOf(() => { throw ['sentence', 'label', 42n] }), 'sentence label 42'),
    // `assert`'s own throw is the shape this exists to read.
    readsAssertsOwnThrow: () =>
        assertEq(refusalTextOf(() => assert(false, ['nope', 'because', 1n])), 'nope because 1'),
    throw: {
        // The control the second half exists for: a call that does NOT
        // refuse must fail the leaf, not pass it silently. What throws here
        // is `refuses`' own trailing `assert(threw, …)`, reached because
        // the `catch` never ran.
        aCallThatSucceedsIsItselfARefusal: () => refusalTextOf(() => 'no refusal here'),
        // A thrown `Error` is not a bare value, and this codebase never
        // produces one — reading it is refused rather than rendered, so a
        // proof cannot quietly start asserting against `String(error)`.
        // What throws here is `refusalText`'s own assert, inside the
        // `catch`, before any message reaches the check.
        anErrorInstanceIsNotABareThrownValue: () => refusalTextOf(() => { throw new Error('not bare') }),
    },
}
