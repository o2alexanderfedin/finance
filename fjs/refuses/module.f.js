/**
 * `refuses` — run a call that must REFUSE, and read WHAT it refused with —
 * and {@link attempt}, the one primitive underneath it that actually
 * catches.
 *
 * ## Why this module exists, and why it is the only `try` under `fjs/`
 *
 * AGENTS.md forbids `try` in a `.f.js`, and the rule is right: `throw` is
 * reserved for panics, and a recoverable failure belongs in a `Result` or in
 * an effect's error channel. This module is the one place the rule cannot
 * apply. There are now TWO reasons for that, and only the first is about
 * proofs.
 *
 * ### Reason one: what `assert` IS
 *
 * The reason is not a limitation of FunctionalScript — it is what `assert`
 * IS. This codebase's refusals throw BARE values (AGENTS.md's own hard rule:
 * a string or an array, never an `Error`). A proof that a refusal fires can
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
 * one place — so it lives here, exported.
 *
 * ### Reason two (2026-09-09): the untrusted-guest boundary
 *
 * The second reason is **production**, not test, and it is written in here
 * because a real defect proved it was missing. `fjs/server/fjs_run` runs a
 * GUEST program: arbitrary JavaScript that arrived over MCP, was
 * materialized from a CAS blob and imported. A guest can throw, and when it
 * does the throw is nothing like a panic — it reached for a name the guest
 * context does not have. `ctx.computeForm1040(...)` is a plausible guess at
 * a vocabulary no tool description names, `fjs_check` passes such a program
 * (its own description says it confirms a shape and is not a trust
 * boundary), and until this date the resulting `TypeError` travelled all the
 * way out through `run(main)` and **exited the server process** — no
 * `isError`, no run record, and an MCP connection the client could not use
 * again.
 *
 * A guest's throw is not our panic. It is a recoverable failure of untrusted
 * INPUT, which by this project's own rules belongs in an error channel. But
 * it still ARRIVES by `throw`, and reading a value that arrives by `throw`
 * is the one thing this module exists to do — so the boundary is drawn
 * here, in the one place already permitted to catch, and `fjs_run` calls
 * {@link attempt} rather than opening a second `try` of its own.
 *
 * That is why {@link attempt} is a separate export and why {@link refuses}
 * is now written on top of it: the file still holds exactly one `try`, so
 * the grep AGENTS.md makes the rule checkable with —
 * `grep -rn 'try {' fjs --include='*.f.js'` — still returns exactly one CODE
 * hit, inside {@link attempt} below. AGENTS.md line 94 stays literally true
 * and needed no edit.
 *
 * **It is written to be lifted upstream unchanged.** Nothing here is
 * finance-specific: it belongs beside `fjs/asserts`, whose `assert` is what
 * produces the values {@link refusalText} reads.
 *
 * @module
 */
import { assert, assertEq } from 'functionalscript/fjs/asserts/module.f.mjs'
import { ok, error } from 'functionalscript/fjs/types/result/module.f.mjs'

/** @import { Result } from 'functionalscript/fjs/types/result/types.js' */

/**
 * Runs `call` and reports what happened as a `Result`: the value it
 * returned, or **the raw thrown value, uninterpreted**.
 *
 * This is the whole carve-out, and it does exactly one thing, because every
 * additional thing it might do is a decision some caller does not want:
 *
 * - it does not RENDER — {@link refusalText} and {@link thrownSummary} are
 *   two different renderings of a caught value, and which one is correct
 *   depends on who threw (see {@link thrownSummary});
 * - it does not CLASSIFY — a caller that only wants "did it refuse at all"
 *   reads `[0]`, and {@link refuses} below is that caller;
 * - it does not WRAP, so identity survives the error arm and a proof can
 *   assert `===` against the very object it threw.
 *
 * The error side is typed `unknown`, not `string`, deliberately. A refusal
 * in this codebase throws a bare string or array; a guest throws whatever it
 * likes, including a real `Error`. Narrowing here would be a lie at the
 * second call site.
 * @type {<T>(call: () => T) => Result<T, unknown>}
 */
export const attempt = call => {
    try {
        return ok(call())
    } catch (thrown) {
        return error(thrown)
    }
}

/**
 * Renders a bare thrown value as the text a proof asserts against.
 *
 * `assert` throws its message argument unchanged, and this codebase's
 * messages are a string or an array (`[sentence, 'label', value, …]`), so
 * both shapes reach here. An array is joined with a single space, which is
 * the rendering every call site already assumed.
 *
 * **This is a PARTIAL renderer and stays partial on purpose.** It refuses
 * anything that is not a bare value, which is what stops a proof from
 * quietly beginning to assert against `String(someError)`. For exactly the
 * same reason it must never be pointed at a GUEST's throw — see
 * {@link thrownSummary}, which exists because doing so would fire this
 * assert inside the very handler installed to stop a throw from escaping.
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
 * What {@link thrownSummary} answers when the thrown value cannot be
 * rendered at all. A constant, so the last resort has no way to fail.
 * @type {string}
 */
const unrenderable = 'an unrenderable thrown value'

/**
 * Renders an ARBITRARY thrown value — a guest's, not ours — as one line of
 * text safe to put in an MCP response and in a run record.
 *
 * ## Why this is not {@link refusalText}
 *
 * `refusalText` asserts its argument is a bare string or array. A guest
 * throws a real `TypeError`. Routing a guest's throw through `refusalText`
 * would fire that assert INSIDE the handler installed to catch the guest,
 * reintroducing the same process-killing throw one level deeper — in the
 * code written to prevent it. Two renderings, two functions, and the
 * partial one keeps its teeth.
 *
 * ## Total by construction, not by enumeration
 *
 * A hostile or merely broken value can refuse to be rendered: an object
 * whose `toString` throws, an `Error` whose `message` is a getter that
 * throws, a `Symbol` a template literal will not take. Enumerating those
 * cases with `typeof` tests would leave the next one out, so the whole
 * rendering — BOTH arms — runs inside {@link attempt}, and anything that
 * escapes lands on the {@link unrenderable} constant. The proof below fixes
 * the `toString` shape; the other shapes are the same line of code.
 *
 * ## Never the stack
 *
 * `name: message`, never `stack`. A stack carries the absolute path the
 * program was materialized to, and this process has no operator-facing sink
 * — every rendering here reaches a remote MCP client, directly as
 * `fjs_run`'s `errorResult` text and indirectly through the `status:'error'`
 * run record that same client can `cas_get`. That is precisely the reason
 * `fjs/guest/materialize`'s `errorSummary` convention exists, argued at
 * length in that module's own header; this is the same rule for the one
 * channel `errorSummary` cannot cover, because a guest's `TypeError` is not
 * an `IoChannel`.
 * @type {(thrown: unknown) => string}
 */
export const thrownSummary = thrown => {
    const rendered = attempt(() => thrown instanceof Error
        ? `${thrown.name}: ${thrown.message}`
        : String(thrown))
    return rendered[0] === 'ok' ? rendered[1] : unrenderable
}

/**
 * Runs `call`, requires it to throw, and hands the thrown value's text to
 * `check`.
 *
 * Both halves are load-bearing. `check` is what makes the leaf assert WHAT
 * was refused; the `assert` on the outcome's tag is what stops a call that
 * quietly succeeded from passing — without it, a `refuses` whose subject
 * stopped refusing would run zero assertions and report green.
 *
 * Re-expressed on {@link attempt} on 2026-09-09, when the guest boundary
 * needed the catch as a primitive and the file had to keep exactly one
 * `try`. Behaviour is unchanged and deliberately so: the same two assertions
 * run in the same order (`assert` narrows `outcome` to its error arm, which
 * is the `let threw` this used to thread by hand), a call that succeeds
 * still fails on the same message, and a non-bare thrown value still refuses
 * inside `refusalText` rather than being rendered.
 * @type {(call: () => unknown) => (check: (message: string) => void) => void}
 */
export const refuses = call => check => {
    const outcome = attempt(call)
    assert(outcome[0] === 'error', 'expected the call to refuse, but it completed without throwing')
    check(refusalText(outcome[1]))
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
    attempt: {
        // The ok arm carries what the call returned, and the tag says which
        // arm it is — so a caller reads a `Result` instead of guessing.
        okArmCarriesTheReturnedValue: () => {
            const outcome = attempt(() => 'the returned value')
            assert(outcome[0] === 'ok', ['expected a completed call to be an ok result', outcome])
            assertEq(outcome[1], 'the returned value')
        },
        // The error arm carries the RAW thrown value, asserted by IDENTITY
        // rather than by its rendering. An `attempt` that rendered, wrapped
        // or normalised what it caught would still produce equal-LOOKING
        // text and could not pass this leaf. "No interpretation" is the
        // whole contract, and identity is the only assertion that states it.
        errorArmCarriesTheRawThrownValueByIdentity: () => {
            const thrown = new TypeError('ctx.computeForm1040 is not a function')
            const outcome = attempt(() => { throw thrown })
            assert(outcome[0] === 'error', ['expected a throwing call to be an error result', outcome])
            assert(outcome[1] === thrown, ['expected the very value that was thrown, uninterpreted', outcome[1]])
        },
        // A bare value survives the error arm unchanged too — this project's
        // own refusals are strings and arrays, and `refuses` reads them back
        // out of exactly this arm.
        errorArmDoesNotCoerceABareValue: () => {
            const outcome = attempt(() => { throw ['sentence', 'label'] })
            assert(outcome[0] === 'error', ['expected a throwing call to be an error result', outcome])
            assertEq(JSON.stringify(outcome[1]), JSON.stringify(['sentence', 'label']))
        },
    },
    thrownSummary: {
        // The shape the guest boundary actually meets: a real `TypeError`,
        // rendered as `name: message` — asserted as the WHOLE string, never
        // a substring.
        anErrorRendersAsNameThenMessage: () =>
            assertEq(
                thrownSummary(new TypeError('ctx.computeForm1040 is not a function')),
                'TypeError: ctx.computeForm1040 is not a function'),
        // The stack is never in it. Asserted as the whole text AND as an
        // absence, because `includes('Error: boom')` would also hold of a
        // rendering that appended the entire stack after it — which is the
        // leak this rule exists to prevent, a stack carrying the materialize
        // home's absolute path into an MCP response and a run record.
        anErrorsStackNeverReachesTheText: () => {
            const rendered = thrownSummary(new Error('boom'))
            assertEq(rendered, 'Error: boom')
            assert(!rendered.includes('module.f.js'), ['a stack frame reached the rendered text', rendered])
        },
        // A bare string — this codebase's own refusal shape — is its own
        // rendering, so a host refusal that reaches the guest channel is not
        // mangled on the way through.
        aBareStringIsItsOwnRendering: () =>
            assertEq(thrownSummary('a bare refusal'), 'a bare refusal'),
        // Anything else is stringified, without interpretation.
        anArrayIsStringified: () =>
            assertEq(thrownSummary(['sentence', 'label', 42n]), 'sentence,label,42'),
        // The last resort, and the reason the renderer is total by
        // construction rather than by enumeration: a value that refuses to
        // BE rendered answers the constant instead of throwing out of the
        // renderer. A `thrownSummary` written as a bare `String(thrown)`
        // reddens here — and that is the version which would kill the
        // process from inside the handler installed to stop the process
        // being killed.
        aValueThatRefusesToRenderFallsBackToAConstant: () =>
            assertEq(
                thrownSummary({ toString: () => { throw 'a toString that refuses' } }),
                'an unrenderable thrown value'),
    },
    throw: {
        // The control the second half exists for: a call that does NOT
        // refuse must fail the leaf, not pass it silently. What throws here
        // is `refuses`' own `assert` on the outcome tag, reached because
        // `attempt` reported the ok arm.
        aCallThatSucceedsIsItselfARefusal: () => refusalTextOf(() => 'no refusal here'),
        // A thrown `Error` is not a bare value, and this codebase never
        // produces one — reading it is refused rather than rendered, so a
        // proof cannot quietly start asserting against `String(error)`.
        // What throws here is `refusalText`'s own assert, on the error arm
        // `attempt` returned, before any message reaches the check.
        // `thrownSummary` is the renderer for THIS shape; `refusalText`
        // stays partial precisely so this line still throws.
        anErrorInstanceIsNotABareThrownValue: () => refusalTextOf(() => { throw new Error('not bare') }),
    },
}
