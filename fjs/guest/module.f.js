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
import { do_ } from 'functionalscript/fjs/effects/module.f.js'
import { assert, assertEq } from 'functionalscript/fjs/asserts/module.f.js'
import { interpret } from '../exec/module.f.js'

/** @import { Effect, OperationMap } from 'functionalscript/fjs/effects/module.f.js' */
/** @import { Assert } from 'functionalscript/fjs/asserts/module.f.js' */
/** @import { Equal } from 'functionalscript/fjs/types/ts/module.f.js' */

// ── The frozen vocabulary ────────────────────────────────────────────────────

/** Reads a stored blob by cBase32 hash; yields its content as text. */
/** @typedef {readonly ['casRead', (a: string) => string]} CasRead */
/** Lists subjects; the argument selects active or archived. Yields JSON. */
/** @typedef {readonly ['evoList', (a: string) => string]} EvoList */
/** Yields a subject's head hashes, as JSON. */
/** @typedef {readonly ['evoHead', (a: string) => string]} EvoHead */
/** Yields one revision by hash, decoded, as JSON. */
/** @typedef {readonly ['evoRevision', (a: string) => string]} EvoRevision */

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
 * @type {(a: string) => Effect<CasRead, string>}
 */
const casRead = do_('casRead')

/** @type {(a: string) => Effect<EvoList, string>} */
const evoList = do_('evoList')

/** @type {(a: string) => Effect<EvoHead, string>} */
const evoHead = do_('evoHead')

/** @type {(a: string) => Effect<EvoRevision, string>} */
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
 */
export const guestCtx = {
    casRead,
    evoList,
    evoHead,
    evoRevision,
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
 * @typedef {(ctx: GuestCtx) => (args: readonly string[]) => Effect<CasOp, T>} Report
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
 * @type {OperationMap<CasOp, string>}
 */
const hostMap = {
    casRead: (/** @type {string} */ a) => `casRead:${a}`,
    evoList: (/** @type {string} */ a) => `evoList:${a}`,
    evoHead: (/** @type {string} */ a) => `evoHead:${a}`,
    evoRevision: (/** @type {string} */ a) => `evoRevision:${a}`,
}

export const proof = {
    // The RUNTIME half of Success Criterion 1. The type half is the
    // `Assert<Equal<…>>` above, which `tsc` has already checked by the time
    // this runs; this pins the value side to the same four names, so the
    // vocabulary cannot drift between what the type permits and what the
    // context actually offers.
    vocabularyIsFrozenAtFour: () => {
        assertEq(casOpNames.join(','), 'casRead,evoList,evoHead,evoRevision')
        assertEq(Object.keys(guestCtx).join(','), casOpNames.join(','))
    },
    // Every constructor dispatches through the REAL interpreter.
    everyConstructorDispatches: () => {
        for (const [name, construct] of Object.entries(guestCtx)) {
            const [t, v] = interpret(hostMap)(construct('x'))
            assert(t === 'ok', [name, 'expected ok', t, v])
            const [value, reads] = v
            assertEq(value, `${name}:x`)
            assertEq(reads.length, 1)
            assertEq(reads[0]?.[0], name)
        }
    },
    // A `report`-shaped program composed only from ctx runs end to end, with
    // no import of any kind inside it — Success Criterion 2's shape.
    reportShapedProgramRuns: () => {
        /** @type {Report<string>} */
        const report = ctx => args => ctx.casRead(args[0] ?? '')
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
