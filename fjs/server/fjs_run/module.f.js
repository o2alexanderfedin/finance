/**
 * `fjs_run` — EXEC-08, EXEC-10, EXEC-11, PROV-03: the MCP tool that runs a
 * stored report program against pinned inputs and returns the hashes of
 * everything the run produced.
 *
 * ## Two exports, two concerns
 *
 * {@link executeRun} (this task) is pure orchestration: hash -> CAS blob ->
 * materialize -> load -> snapshot -> interpret. It never touches CAS for a
 * WRITE and never touches MCP — the tool handler that performs both writes
 * and shapes the MCP response (`fjsRunTool`) is the next task in this plan.
 * This split is what makes Success Criterion 3 (the tool handler, never the
 * guest, performs both CAS writes) checkable in two independent ways:
 * `casWrite`/`evoAdd` are structurally absent from the guest's ABI
 * (`fjs/guest/module.f.js`, re-verified by grep below), AND `executeRun`
 * itself — the thing that actually RUNS the guest — never calls
 * `cas.write` anywhere in its own body.
 *
 * ## `executeRun`'s five steps, and the known Phase 3 limitation it inherits
 *
 * 1. Resolve `input.hash` to a `Vec` (`cBase32ToVec`) and read the program's
 *    source out of CAS (`collectRead(cas.read(...))`, UTF-8 decoded). Either
 *    an unparsable hash or a CAS miss short-circuits immediately, before
 *    materialization or interpretation ever run.
 * 2. `materializeProgram` (Plan 05) writes those exact bytes to the
 *    dedicated `.fjs-run` subdirectory. A write failure short-circuits too.
 * 3. `loadProgram` (Phase 6, unchanged) runs `checkSpecifiers` then
 *    `import_`s the module. Reused here as `loadProgram([])(programFileName
 *    (input.hash))(sourceText)` — the BARE hash-derived filename, not the
 *    full materialize path. This is deliberate, not an oversight:
 *    `fjs/guest/materialize/module.f.js`'s own header documents that
 *    `fjs/effects/node/virtual` cannot execute freshly-written bytes as a
 *    module, so a write-then-import combination can never produce an `'ok'`
 *    outcome in one virtual session for the SAME path — real Node's
 *    `import()` reads whatever `writeFile` actually wrote, so production
 *    performs both steps for real, at the full path. Composing the two
 *    established techniques "side by side" (that module's own phrase) is
 *    exactly what every proof below does: the write is exercised for real
 *    (a fresh, unwritten leaf), and the load exercises a `JsModule` fixture
 *    at the bare name, standing in for "materialization already succeeded" —
 *    the same stand-in `fjs/guest/materialize/module.f.js`'s own
 *    `underVirtual.cleanProgramImportsAndRuns` proof uses. Wiring
 *    `fjs_run` into a real running server with a real working directory is
 *    this plan's own documented follow-up, not silently dropped.
 * 4. `buildRunSnapshot`/`buildHostMap` (Plan 05) resolve the pinned or live
 *    snapshot into the synchronous host map `interpret` requires.
 * 5. `interpret` (Phase 3, unchanged) runs the loaded `report`. Its returned
 *    `Read[]` is the ONLY source `inputs[]` is ever populated from — never a
 *    program's own citation list (07-CONTEXT.md, Success Criterion 2).
 *
 * A refusal reached partway through a chain discards the accumulated read
 * set — this is `fjs/exec`'s OWN already-documented behavior (see that
 * module's `refusalPartwayThroughAChainReportsTheRefusedCommand` comment),
 * not something this plan changes or re-solves. A failed run's persisted
 * `inputs[]` is therefore legitimately empty for a mid-execution refusal.
 *
 * ## Concrete `FileCasOperation`, not a generic `<O extends Operation>`
 *
 * `buildRunSnapshot`/`buildHostMap` (Plan 05) and `casRefreshTool`
 * (`fjs/server/module.f.js`) are generic over `O` because their FIRST
 * curried parameter already mentions `O` (`cas: Cas<O>`), so TypeScript can
 * resolve it the moment that parameter is applied. `executeRun`'s OWN first
 * parameter is `materializeHomeRoot: string`, which mentions nothing about
 * `O` — verified empirically that this makes `tsc` commit to `O`'s bare
 * constraint at that first application, before `cas`/`evoApi` are ever
 * seen, so every later application then fails to unify against a concrete
 * `Cas<FileCasOperation>` argument. Since this codebase has exactly one
 * `Cas` implementation (`fileCas`; `financeMcpHandlers`'s own signature is
 * concrete for the same reason), fixing this export to `FileCasOperation`
 * costs nothing in practice and keeps the curry order the plan specifies.
 *
 * @module
 */
import { step, pure, mapStep } from 'functionalscript/fjs/effects/module.f.js'
import { collectRead, fileCas } from 'functionalscript/fjs/cas/module.f.js'
import { cBase32ToVec, vecToCBase32 } from 'functionalscript/fjs/basen/cbase32/module.f.js'
import { utf8ToString, tryUtf8 } from 'functionalscript/fjs/text/module.f.js'
import { ok } from 'functionalscript/fjs/types/result/module.f.js'
import { sha256 } from 'functionalscript/fjs/crypto/sha2/module.f.js'
import { initEvo, evo } from 'functionalscript/fjs/cas/evo/module.f.js'
import { emptyState, virtual } from 'functionalscript/fjs/effects/node/virtual/module.f.js'
import { assert, assertEq } from 'functionalscript/fjs/asserts/module.f.js'
import { interpret } from '../../exec/module.f.js'
import { guestCtx } from '../../guest/module.f.js'
import { materializeProgram, programFileName, loadProgram } from '../../guest/materialize/module.f.js'
import { buildRunSnapshot, buildHostMap } from './snapshot/module.f.js'

/** @import { Effect, Operation } from 'functionalscript/fjs/effects/module.f.js' */
/** @import { MemOp } from 'functionalscript/fjs/effects/memory/module.f.js' */
/** @import { Mkdir, WriteFile, Import } from 'functionalscript/fjs/effects/node/module.f.js' */
/** @import { Cas, FileCasOperation } from 'functionalscript/fjs/cas/module.f.js' */
/** @import { Evo } from 'functionalscript/fjs/cas/evo/module.f.js' */
/** @import { Read } from '../../exec/module.f.js' */
/** @import { Report } from '../../guest/module.f.js' */

// ── executeRun ────────────────────────────────────────────────────────────────

/**
 * One `executeRun` invocation's outcome: the program's value plus every
 * command `interpret` actually dispatched to reach it, or a refusal message
 * (whose `reads` is `[]` for a mid-chain refusal — see the module header).
 * @template T
 * @typedef {{ readonly kind: 'ok', readonly value: T, readonly reads: readonly Read[] } | { readonly kind: 'error', readonly message: string, readonly reads: readonly Read[] }} RunOutcome
 */

/**
 * Runs a stored program (by CAS hash) against `input.args`, optionally
 * pinned to a concrete `subject`/`parents` snapshot. See the module header
 * for the five-step sequence this composes, unchanged, from Plan 05
 * (`materializeProgram`/`buildRunSnapshot`/`buildHostMap`), Phase 6
 * (`programFileName`/`loadProgram`), and Phase 3 (`interpret`).
 * @type {(materializeHomeRoot: string) => (cas: Cas<FileCasOperation>) => (evoApi: Evo<FileCasOperation>) => (input: { readonly hash: string, readonly args: readonly string[], readonly subject?: string, readonly parents?: readonly string[] }) => Effect<FileCasOperation | Mkdir | WriteFile | Import | MemOp, RunOutcome<unknown>>}
 */
export const executeRun = materializeHomeRoot => cas => evoApi => input => {
    const hashVec = cBase32ToVec(input.hash)
    if (hashVec === null) {
        return pure(/** @type {RunOutcome<unknown>} */ ({ kind: 'error', message: `program not found: ${input.hash}`, reads: [] }))
    }
    return step(collectRead(cas.read(hashVec)), readResult => {
        if (readResult[0] === 'error') {
            return pure(/** @type {RunOutcome<unknown>} */ ({ kind: 'error', message: `program not found: ${input.hash}`, reads: [] }))
        }
        const sourceText = utf8ToString(readResult[1])
        return step(materializeProgram(materializeHomeRoot)(input.hash)(sourceText), materializeResult => {
            if (materializeResult[0] === 'error') {
                return pure(/** @type {RunOutcome<unknown>} */ ({ kind: 'error', message: materializeResult[1], reads: [] }))
            }
            return step(loadProgram([])(programFileName(input.hash))(sourceText), loadResult => {
                if (loadResult[0] === 'error') {
                    return pure(/** @type {RunOutcome<unknown>} */ ({ kind: 'error', message: loadResult[1], reads: [] }))
                }
                const pin = input.subject !== undefined && input.parents !== undefined
                    ? { subject: input.subject, parents: input.parents }
                    : undefined
                return step(buildRunSnapshot(cas)(evoApi)(pin), snapshot => {
                    const hostMap = buildHostMap(snapshot)
                    const loaded = /** @type {{ readonly report: Report<unknown> }} */ (loadResult[1])
                    const [t, v] = interpret(hostMap)(loaded.report(guestCtx)(input.args))
                    if (t === 'error') {
                        return pure(/** @type {RunOutcome<unknown>} */ ({ kind: 'error', message: v, reads: [] }))
                    }
                    const [value, reads] = v
                    return pure(/** @type {RunOutcome<unknown>} */ ({ kind: 'ok', value, reads }))
                })
            })
        })
    })
}

// ── Tests ────────────────────────────────────────────────────────────────────

/** Single-chunk UTF-8 CAS write, mirroring the proofs `fjs/server/fjs_run/snapshot/module.f.js` and `fjs/server/module.f.js` already establish. @type {<O extends Operation>(cas: Cas<O>) => (text: string) => Effect<O, string>} */
const seedText = cas => text => {
    const bytes = tryUtf8(text)
    assert(bytes !== null, ['expected sample text to encode as UTF-8', text])
    return mapStep(cas.write(pure({ first: ok(bytes), tail: pure(undefined) })), w => {
        assert(w[0] === 'ok', ['expected the seed write to succeed', w])
        return vecToCBase32(w[1])
    })
}

export const proof = {
    // ── Task 1: executeRun ──────────────────────────────────────────────
    executeRun: {
        // Success Criterion 1's enabling shape: a program that loops over
        // BOTH stored documents (via evoList/evoHead/evoRevision/casRead,
        // sequenced through ctx.step) and sums a field across them, run
        // through the FULL executeRun orchestration. The loaded module
        // comes from a JsModule fixture at the bare hash-derived name — see
        // the module header for why a real materialize-write and a real
        // import cannot target the SAME path in one virtual session.
        multiDocumentSumAcrossTwoStoredDocuments: () => {
            const home = '/success'
            const cas = fileCas(sha256)(home)
            const [state0, cacheKey] = virtual(emptyState)(initEvo(cas))
            const e = evo(cas)(cacheKey)

            const [state1, docAHash] = virtual(state0)(seedText(cas)('{"amount":"10.00"}'))
            const [state2, docBHash] = virtual(state1)(seedText(cas)('{"amount":"20.00"}'))
            const [state3, addA] = virtual(state2)(e.add({ parents: [], subject: 'subjectA', snapshot: docAHash }))
            assert(addA[0] === 'ok', ['expected subject A revision add to succeed', addA])
            const [state4, addB] = virtual(state3)(e.add({ parents: [], subject: 'subjectB', snapshot: docBHash }))
            assert(addB[0] === 'ok', ['expected subject B revision add to succeed', addB])

            // The program's OWN stored source: zero imports, so
            // checkSpecifiers passes. Its actual text is otherwise
            // irrelevant to this proof — the loaded module comes from the
            // JsModule fixture below, not from parsing this text.
            const [state5, programHash] = virtual(state4)(
                seedText(cas)('export const report = ctx => args => ctx.pure("0.00")'))
            const name = programFileName(programHash)

            /** @type {(subjects: readonly string[]) => (acc: bigint) => import('functionalscript/fjs/effects/module.f.js').Effect<import('../../guest/module.f.js').CasOp, string>} */
            const sumOverSubjects = subjects => acc => {
                const [subject, ...rest] = subjects
                if (subject === undefined) {
                    return guestCtx.pure(guestCtx.centsToString(acc))
                }
                return guestCtx.step(guestCtx.evoHead(subject), headsJson => {
                    const heads = /** @type {readonly string[]} */ (JSON.parse(headsJson))
                    const headHash = /** @type {string} */ (heads[0])
                    return guestCtx.step(guestCtx.evoRevision(headHash), revJson => {
                        const rev = /** @type {{ readonly snapshot: string }} */ (JSON.parse(revJson))
                        return guestCtx.step(guestCtx.casRead(rev.snapshot), docJson => {
                            const doc = /** @type {{ readonly amount: string }} */ (JSON.parse(docJson))
                            return sumOverSubjects(rest)(acc + guestCtx.centsFromString(doc.amount))
                        })
                    })
                })
            }
            /** @type {import('../../guest/module.f.js').Report<string>} */
            const sumReport = ctx => () => ctx.step(
                ctx.evoList('false'),
                activeJson => sumOverSubjects(/** @type {readonly string[]} */ (JSON.parse(activeJson)))(0n))

            const root = { ...state5.root, [name]: () => ({ report: sumReport }) }
            const [, outcome] = virtual({ ...state5, root })(
                executeRun(home)(cas)(e)({ hash: programHash, args: [] }))
            assert(outcome.kind === 'ok', ['expected an ok outcome', outcome])
            if (outcome.kind === 'ok') {
                assertEq(outcome.value, '30.00')
                assert(outcome.reads.length >= 2, ['expected at least 2 reads', outcome.reads])
            }
        },
        // A missing/unresolvable hash short-circuits before materialize or
        // interpret ever run. The spy/counter this criterion asks for is
        // the virtual filesystem's own root: materializeProgram
        // unconditionally mkdirs and writes, so ANY invocation leaves a
        // trace there; its total absence is the proof it never ran.
        missingHashShortCircuitsBeforeMaterializeOrInterpret: () => {
            const home = '/missing'
            const cas = fileCas(sha256)(home)
            const [state0, cacheKey] = virtual(emptyState)(initEvo(cas))
            const e = evo(cas)(cacheKey)
            const [state1, outcome] = virtual(state0)(
                executeRun(home)(cas)(e)({ hash: 'not-a-real-hash', args: [] }))
            assertEq(outcome.kind, 'error')
            if (outcome.kind === 'error') {
                assert(outcome.message.includes('not-a-real-hash'), outcome.message)
                assertEq(outcome.reads.length, 0)
            }
            assertEq(Object.keys(state1.root).length, 0)
        },
        // A dirty specifier in the stored source is refused, naming the
        // offending specifier — reached via loadProgram's own
        // checkSpecifiers gate (Phase 6, unchanged).
        dirtySpecifierNamesTheOffendingSpecifier: () => {
            const home = '/dirty'
            const cas = fileCas(sha256)(home)
            const [state0, cacheKey] = virtual(emptyState)(initEvo(cas))
            const e = evo(cas)(cacheKey)
            const [state1, dirtyHash] = virtual(state0)(
                seedText(cas)(`import fs from 'node:fs'\nexport const report = ctx => args => ctx.pure('x')`))
            const [, outcome] = virtual(state1)(executeRun(home)(cas)(e)({ hash: dirtyHash, args: [] }))
            assertEq(outcome.kind, 'error')
            if (outcome.kind === 'error') {
                assert(outcome.message.includes('node:fs'), outcome.message)
            }
        },
        // The pin override changes what ctx.evoHead resolves to inside a
        // RUNNING program, through the full executeRun path — not just
        // buildHostMap in isolation (Plan 05's own proof, one layer down).
        pinOverridesTheLiveHeadThroughFullExecuteRun: () => {
            const home = '/pin'
            const cas = fileCas(sha256)(home)
            const [state0, cacheKey] = virtual(emptyState)(initEvo(cas))
            const e = evo(cas)(cacheKey)
            const [state1, docHash] = virtual(state0)(seedText(cas)('{}'))
            const [state2, addResult] = virtual(state1)(e.add({ parents: [], subject: 'subjectS', snapshot: docHash }))
            assert(addResult[0] === 'ok', ['expected the revision add to succeed', addResult])

            const [state3, programHash] = virtual(state2)(
                seedText(cas)('export const report = ctx => args => ctx.pure("unused")'))
            const name = programFileName(programHash)
            /** @type {import('../../guest/module.f.js').Report<string>} */
            const pinReport = ctx => runArgs => ctx.evoHead(runArgs[0] ?? '')
            const root = { ...state3.root, [name]: () => ({ report: pinReport }) }

            const [, outcome] = virtual({ ...state3, root })(
                executeRun(home)(cas)(e)({
                    hash: programHash,
                    args: ['subjectS'],
                    subject: 'subjectS',
                    parents: ['PINNED_INSTEAD'],
                }))
            assert(outcome.kind === 'ok', ['expected an ok outcome', outcome])
            if (outcome.kind === 'ok') {
                assertEq(outcome.value, JSON.stringify(['PINNED_INSTEAD']))
                assert(
                    outcome.value !== JSON.stringify([addResult[1]]),
                    'must not resolve to the live head')
            }
        },
    },
}
