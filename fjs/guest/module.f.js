/**
 * EXEC-07 — the frozen guest ABI: the entire vocabulary a stored report
 * program is written against, and the type that puts the whitelist in the
 * type system rather than only in the interpreter.
 *
 * **`CasOp` is defined here because fjs has no such type.** What fjs has is
 * `FileCasOperation` — the *filesystem* effects the CAS performs internally
 * (`ReadBytes`, `Mkdir`, `WriteBytes`, `Rename`, `Rm`, `Stat`, …). That is
 * emphatically not a guest vocabulary: handing it to a guest hands it the
 * store. The four commands below are read-only by construction, and the
 * locked decision they implement is that the *tool handler* writes the
 * result and the run record (EXEC-10), never the guest.
 *
 * Phase 3 built these same four as test fixtures — something for `interpret`
 * to refuse. This module promotes them to the real thing, unchanged in
 * shape so `fjs/exec`'s `interpret` dispatches them without modification.
 * They are `string -> string` and carry JSON, because fjs's JSON `Primitive`
 * has no `bigint` and a guest's result has to cross JSON-RPC — the wire form
 * is a constraint, not a preference (Phase 4, EXACT-05).
 *
 * **Why the entry point is `report` and not `main`.** fjs names entry points
 * by role: `proof` for tests, `main` for Node CLI programs. A report program
 * is a third role. `main` is wrong in both directions — `Program<O> =
 * (options: NodeProgramOptions) => Effect<O, number>` returns an exit code
 * rather than a report, and `NodeProgram = Program<NodeOp>` where `NodeOp`
 * includes `Fetch │ Fs │ Http │ Forever`, so a program typed that way
 * *declares* it may reach the network. Scoping the signature to `CasOp`
 * makes `tsc` reject such a program before it is ever stored, which demotes
 * the interpreter's runtime refusal from sole defense to backstop. Given
 * that a runtime defense has already been escaped once in this project's
 * history (the `match` prototype-dispatch hole, closed upstream in fjs
 * 0.41.0), that layering is the entire point.
 *
 * `ctx` is a parameter rather than an import because a CAS blob cannot
 * resolve bare specifiers — there is no `node_modules` at a content hash. A
 * stored program therefore has **zero** `import` statements, and `ctx` is
 * the only vocabulary it has (Success Criterion 2).
 *
 * @module
 */
import { do_, step, pureOk } from 'functionalscript/fjs/effects/module.f.mjs'
import { ok } from 'functionalscript/fjs/types/result/module.f.mjs'
import { assert, assertEq, assertNotNullish } from 'functionalscript/fjs/asserts/module.f.mjs'
import { interpret } from '../exec/module.f.js'
import { centsFromString, centsToString } from '../exact/module.f.js'

/** @import { Effect, OperationMap } from 'functionalscript/fjs/effects/types.js' */
/** @import { Result } from 'functionalscript/fjs/types/result/types.js' */
/** @import { Assert } from 'functionalscript/fjs/asserts/types.js' */
/** @import { Equal } from 'functionalscript/fjs/types/ts/types.js' */

// ── The frozen vocabulary ────────────────────────────────────────────────────

/**
 * ## The error channel these four carry, and why it is `string`
 *
 * 0.46.0 requires an operation's handler to return a `Result`, and for these
 * four that is not a formality: `buildHostMap`'s `casRead` and `evoRevision`
 * genuinely fail on a hash the snapshot does not hold. Before 0.46.0 they
 * said so by **throwing a bare string**, which crossed `interpret`'s `try`
 * and came back out relabelled — a missing blob was reported to the guest as
 * `operation not permitted: blob not found: …`, i.e. as a POLICY refusal for
 * something that was never a policy question. Nothing asserted the label, so
 * nothing caught it.
 *
 * With the channel typed, a missing blob is `error('blob not found: …')`,
 * `step` short-circuits the guest's chain on it, and `interpret` passes it
 * through its own `E | string` channel to the run record under its own name.
 * The refusal vocabulary is now reserved for actual refusals.
 *
 * `string` rather than a richer type because that is what the run record's
 * `message` field holds, and inventing a tagged error here would be widening
 * the guest vocabulary — a frozen thing — to carry a distinction no consumer
 * makes yet.
 */
/**
 * Reads a stored blob by cBase32 hash; yields its content as text, or fails
 * if the snapshot does not hold that hash.
 * @typedef {readonly ['casRead', (a: string) => Result<string, string>]} CasRead
 */
/**
 * Lists subjects; the argument selects active or archived. Yields JSON.
 * @typedef {readonly ['evoList', (a: string) => Result<string, string>]} EvoList
 */
/**
 * Yields a subject's head hashes, as JSON.
 * @typedef {readonly ['evoHead', (a: string) => Result<string, string>]} EvoHead
 */
/**
 * Yields one revision by hash, decoded, as JSON.
 * @typedef {readonly ['evoRevision', (a: string) => Result<string, string>]} EvoRevision
 */

/**
 * The complete guest operation set. Four read-only commands and nothing
 * else — no write, no delete, no network, no clock, no randomness. Adding a
 * member is cheap today and expensive once programs exist, which is what
 * "frozen" means here.
 * @typedef {CasRead | EvoList | EvoHead | EvoRevision} CasOp
 */

/**
 * `do_` narrowed per command. `do_('casRead')` alone under-constrains `O` to
 * bare `Operation` rather than `CasRead`; the annotation is what pins it —
 * the same reason `fjs/exec` annotates its fixture constructors.
 * @type {(a: string) => Effect<CasRead, string, string>}
 */
const casRead = do_('casRead')

/** @type {(a: string) => Effect<EvoList, string, string>} */
const evoList = do_('evoList')

/** @type {(a: string) => Effect<EvoHead, string, string>} */
const evoHead = do_('evoHead')

/** @type {(a: string) => Effect<EvoRevision, string, string>} */
const evoRevision = do_('evoRevision')

/**
 * Everything a stored program can do, handed to it as a parameter.
 *
 * Deliberately a plain object literal. An earlier version null-prototyped it
 * as "defence in depth"; that is removed because the defence already exists
 * where it belongs — `match` resolves handlers through an own-property-only
 * `at` lookup, so an inherited name never dispatches (EXEC-02, fixed
 * upstream in fjs 0.41.0). Re-stating the guarantee here with
 * `setPrototypeOf` implies the upstream fix is not trusted, and leaves two
 * places to reason about instead of one.
 *
 * **Widened per 07-CONTEXT.md Decision 1, not per this module's own
 * docstring above (yet).** EXEC-07's original requirement text is *"A `ctx`
 * object carries the vocabulary — combinators, read-only operation
 * constructors, money helpers, `args`."* Phase 6 shipped only the four
 * operation constructors; `step`/`pure` (composition combinators) and
 * `centsFromString`/`centsToString` (money helpers) are added here to
 * deliver the rest of that sentence. This is a widening of `ctx`, **not** of
 * the operation vocabulary: `step` and `pure` are re-exported directly from
 * `functionalscript/fjs/effects/module.f.mjs` and are pure data composition —
 * they build an `Effect` value, they never themselves become a `command`,
 * and they never reach `match`. `CasOp` (four commands) and `casOpNames`
 * are untouched below; `proof.vocabularyIsFrozenAtFour` and
 * `proof.combinatorsAreNeverOperations` are the runtime guards that this
 * distinction stays true.
 */
export const guestCtx = {
    casRead,
    evoList,
    evoHead,
    evoRevision,
    step,
    // `pure` is upstream's `pureOk` since 0.46.0, and the KEY deliberately
    // keeps the old name. A guest writes `ctx.pure("ok")` — a bare value —
    // and 0.46.0 split that constructor in two: `pure` now takes a whole
    // `Result`, `pureOk` takes the value. The value-taking one is what every
    // stored program means. Renaming the key to match upstream would edit the
    // SOURCE TEXT of programs that are content-addressed: every stored
    // program's hash would change, every pinned run record would stop
    // resolving, and PROV-09's byte-for-byte rerun would be comparing against
    // a program that no longer exists. The vocabulary a guest sees is this
    // project's to keep stable; upstream's spelling of the same constructor
    // is not part of it.
    pure: pureOk,
    centsFromString,
    centsToString,
}

/** @typedef {typeof guestCtx} GuestCtx */

/**
 * The frozen command names, in `guestCtx` insertion order — which is the
 * order a refusal message's permitted list reads as (`Object.keys` reports
 * insertion order).
 * @type {readonly string[]}
 */
export const casOpNames = ['casRead', 'evoList', 'evoHead', 'evoRevision']

/**
 * The entry point every stored report program exports. Not `main`: see the
 * module docstring. The inner arrow is literally `(args) => Effect<CasOp,
 * T>`, which is EXEC-07's stated signature; `ctx` precedes it because a CAS
 * blob has nowhere to import a vocabulary from.
 * @template T
 * @typedef {(ctx: GuestCtx) => (args: readonly string[]) => Effect<CasOp, T, string>} Report
 */

// ── The whitelist, in the type system (Success Criterion 1) ──────────────────

/**
 * Success Criterion 1, as a single compile-time assertion: the guest
 * vocabulary is **exactly** these four command names.
 *
 * `CasOp[0]` distributes over the union and collects each operation's name
 * literal, so this pins the whole vocabulary rather than probing it. Add
 * `Fetch` to `CasOp` and `CasOp[0]` gains `'fetch'`, `Equal` becomes
 * `false`, and `Assert` fails its `T extends true` constraint — the build
 * stops at `tsc`, before a single test runs.
 *
 * This replaces an earlier version that enumerated forbidden operations
 * (`Extends<Fetch, CasOp> extends false ? true : never`, once each for
 * `Fetch`/`Fs`/`Http`/`Forever`/`WriteBytes`/`Rm`) behind a locally defined
 * `Extends` helper. Equality against the permitted set is strictly stronger
 * and much shorter: it catches a widening by ANY operation rather than only
 * the six somebody thought to list, and it also catches accidental
 * *narrowing* — dropping a command — which the enumeration missed entirely.
 * `Equal` and `Assert` are FunctionalScript's own (`fjs/types/ts`,
 * `fjs/asserts`), following the `Assert<Equal<…>>` idiom used throughout
 * `fjs/types/rtti`'s proofs, so no bespoke type helper is defined here.
 * @typedef {Assert<Equal<CasOp[0], 'casRead' | 'evoList' | 'evoHead' | 'evoRevision'>>} _CasOpIsExactlyTheFourCommands
 */

// ── Tests ────────────────────────────────────────────────────────────────────

/**
 * A host map matching the frozen vocabulary exactly. Mirrors `fjs/exec`'s
 * fixture map so this module's constructors are exercised against the real
 * `interpret`, not a stand-in. The `OperationMap<CasOp, string>` annotation
 * is required, not decorative: without it the map's inferred object type
 * does not satisfy `interpret`'s parameter and `tsc` reports the whole
 * literal as unassignable.
 * @type {OperationMap<CasOp, Result<string, string>>}
 */
const hostMap = {
    casRead: (/** @type {string} */ a) => ok(`casRead:${a}`),
    evoList: (/** @type {string} */ a) => ok(`evoList:${a}`),
    evoHead: (/** @type {string} */ a) => ok(`evoHead:${a}`),
    evoRevision: (/** @type {string} */ a) => ok(`evoRevision:${a}`),
}

/**
 * The four frozen commands, keyed by name — the same function references
 * `guestCtx` holds. `everyConstructorDispatches` (below) looks a command up
 * by name out of `casOpNames` rather than iterating
 * `Object.entries(guestCtx)`: now that `guestCtx` also carries `step`,
 * `pure`, and the money helpers, that union no longer has one shared call
 * shape (`tsc` rejects `construct('x')` over it directly — a fifth, mixed
 * value type does not have a single unary `string -> Effect` signature).
 * This record exists only to give the lookup a single, uniform call shape
 * to type against.
 * @type {Readonly<Record<string, (a: string) => Effect<CasOp, string, string>>>}
 */
const commandConstructorsByName = { casRead, evoList, evoHead, evoRevision }

export const proof = {
    // Task 1's own delivered behavior (07-CONTEXT.md Decision 1): `step`/
    // `pure` are re-exported directly — the same function object, never
    // wrapped — and the money helpers are `fjs/exact`'s own exports with no
    // re-implementation or re-rounding. `Object.is` is the direct check for
    // "same function object"; `typeof ... === 'function'` alone would also
    // pass for a wrapper, which is exactly what this must rule out.
    //
    // `ctx.pure` is checked against `pureOk`, not `pure`: 0.46.0 split the
    // one constructor into a value-taking and a Result-taking half, and the
    // value-taking half is what `ctx.pure` always was. The KEY keeps its name
    // because stored programs are content-addressed — see `guestCtx`. This
    // assertion is what stops the key being quietly repointed at the
    // Result-taking `pure`, which would typecheck at the ctx and fail only
    // inside guest source nobody typechecks.
    guestCtxReExportsCombinatorsAndMoneyHelpers: () => {
        assert(Object.is(guestCtx.step, step), ['guestCtx.step must be the same function object as step'])
        assert(Object.is(guestCtx.pure, pureOk), ['guestCtx.pure must be the same function object as pureOk'])
        assert(
            Object.is(guestCtx.centsFromString, centsFromString),
            ['guestCtx.centsFromString must be the same function object as fjs/exact\'s centsFromString'])
        assert(
            Object.is(guestCtx.centsToString, centsToString),
            ['guestCtx.centsToString must be the same function object as fjs/exact\'s centsToString'])
        assertEq(guestCtx.centsFromString('1234.56'), 123456n)
    },
    // The RUNTIME half of Success Criterion 1. The type half is the
    // `Assert<Equal<…>>` above, which `tsc` has already checked by the time
    // this runs; this pins the value side to the same four names, so the
    // vocabulary cannot drift between what the type permits and what the
    // context actually offers.
    //
    // Revised for 07-CONTEXT.md Decision 1. The original version asserted
    // `Object.keys(guestCtx).join(',') === casOpNames.join(',')` — a single
    // exact-equality check that doubled as "ctx has only the four commands"
    // and "the four commands are exactly casOpNames". Widening `guestCtx`
    // with `step`/`pure`/the money helpers breaks the first half forever,
    // by design. The fix is deliberately NOT to weaken the check to "ctx's
    // keys are a superset of casOpNames" or "at least four" — either would
    // also pass if a FIFTH *command* were slipped into `guestCtx` alongside
    // a fifth name added to `casOpNames`, which is exactly the widening this
    // proof exists to catch (07-RESEARCH.md Pitfall 5). Instead the single
    // check is split into three independently falsifiable assertion groups:
    // `casOpNames.join(',')` stays a live, unchanged string-equality literal
    // (a fifth command name still fails this line, precisely as before);
    // each of the four frozen names is separately asserted to still be
    // `guestCtx`'s own property; and the four new combinator/helper members
    // are separately asserted to exist and be callable. No group can
    // silently subsume another.
    vocabularyIsFrozenAtFour: () => {
        assertEq(casOpNames.join(','), 'casRead,evoList,evoHead,evoRevision')
        for (const name of casOpNames) {
            assert(Object.hasOwn(guestCtx, name), [name, 'missing from guestCtx'])
        }
        assertEq(typeof guestCtx.step, 'function')
        assertEq(typeof guestCtx.pure, 'function')
        assertEq(typeof guestCtx.centsFromString, 'function')
        assertEq(typeof guestCtx.centsToString, 'function')
    },
    // The regression guard T-07-01-02 names: nothing may silently promote a
    // combinator or a money helper into the dispatched-operation set. Unlike
    // `vocabularyIsFrozenAtFour` (which asserts the four commands are still
    // present), this asserts the four non-commands are still absent from
    // `casOpNames` — the two checks are complementary, not redundant.
    combinatorsAreNeverOperations: () => {
        assert(!casOpNames.includes('step'), ['step must never be listed as a command'])
        assert(!casOpNames.includes('pure'), ['pure must never be listed as a command'])
        assert(!casOpNames.includes('centsFromString'), ['centsFromString must never be listed as a command'])
        assert(!casOpNames.includes('centsToString'), ['centsToString must never be listed as a command'])
    },
    // Every constructor dispatches through the REAL interpreter.
    //
    // Revised for 07-CONTEXT.md Decision 1: re-scoped from
    // `Object.entries(guestCtx)` to the command subset (`casOpNames`) only.
    // `step` is binary and `pure` takes a value, not a command payload
    // string — neither is a unary `string -> Effect` operation constructor,
    // so calling either the way a command is called does not typecheck
    // (confirmed: `tsc` rejects `construct('x')` over the mixed union
    // before this revision). Behavior for the four commands themselves is
    // byte-for-byte unchanged from before this plan.
    everyConstructorDispatches: () => {
        for (const name of casOpNames) {
            const construct = assertNotNullish(commandConstructorsByName[name], [name, 'unknown command'])
            const [t, v] = interpret(hostMap)(construct('x'))
            assert(t === 'ok', [name, 'expected ok', t, v])
            const [value, reads] = v
            assertEq(value, `${name}:x`)
            assertEq(reads.length, 1)
            assertEq(reads[0]?.[0], name)
        }
    },
    // The proof that composition actually works end to end, not just that
    // `step`/`pure` are present as values: two dispatched commands chained
    // through `ctx.step`, interpreted by the REAL interpreter, asserting
    // both the final value and that both commands were actually dispatched,
    // in order. This is Success Criterion 1's enabling primitive — summing
    // a field across every stored document requires exactly this shape,
    // repeated.
    stepComposesTwoDispatchedCommands: () => {
        const chain = guestCtx.step(guestCtx.casRead('doc-a'), value => guestCtx.evoHead(value))
        const [t, v] = interpret(hostMap)(chain)
        assert(t === 'ok', ['expected ok', t, v])
        const [value, reads] = v
        assertEq(value, 'evoHead:casRead:doc-a')
        assertEq(reads.length, 2)
        assertEq(reads[0]?.[0], 'casRead')
        assertEq(reads[1]?.[0], 'evoHead')
    },
    // A `report`-shaped program composed only from ctx runs end to end, with
    // no import of any kind inside it — Success Criterion 2's shape.
    reportShapedProgramRuns: () => {
        /** @type {Report<string>} */
        // `assertNotNullish` rather than `args[0] ?? ''`: the fixture is
        // always called with a hash, and reading a missing one as the empty
        // string would have this leaf assert against a read nobody asked for.
        const report = ctx => args => ctx.casRead(assertNotNullish(args[0], ['a hash is always supplied', args]))
        const [t, v] = interpret(hostMap)(report(guestCtx)(['abc']))
        assert(t === 'ok', ['expected ok', t, v])
        assertEq(v[0], 'casRead:abc')
    },
    // The runtime backstop — a command outside the frozen set refused with
    // the permitted list — is proven in `fjs/exec`'s own proofs (EXEC-03),
    // not duplicated here. Constructing such a probe requires the `any`
    // escape `fjs/exec` confines to its test-fixture section; reproducing it
    // would put the only `any` under `fjs/` into a second file to re-prove
    // something already covered.
}
