/**
 * `fjs_run` — EXEC-08, EXEC-10, EXEC-11, PROV-03: the MCP tool that runs a
 * stored report program against pinned inputs and returns the hashes of
 * everything the run produced.
 *
 * ## Two exports, two concerns
 *
 * {@link executeRun} is pure orchestration: hash -> CAS blob -> materialize
 * -> load -> snapshot -> interpret. It never touches CAS for a WRITE and
 * never touches MCP. {@link fjsRunTool} is the handler: it calls
 * `executeRun`, then performs the two writes `executeRun` itself never
 * does — the result blob and the `vnd.fjs.run` record — applies the size
 * guard, and shapes the MCP response. This split is what makes Success
 * Criterion 3 (the tool handler, never the guest, performs both CAS writes)
 * checkable in two independent ways: `casWrite`/`evoAdd` are structurally
 * absent from the guest's ABI (`fjs/guest/module.f.js`, re-verified by grep
 * below), AND `executeRun` itself — the thing that actually RUNS the guest —
 * never calls `cas.write` anywhere in its own body.
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
 * ## `fjsRunTool`'s handle: the writes, the record, never a raw throw
 *
 * On `{kind:'ok', value, reads}`: `String(value)` is written to CAS
 * UNCONDITIONALLY — the result is always citable by hash, never only
 * conditionally on size (07-CONTEXT.md). A `vnd.fjs.run` record is built
 * from `reads` alone, validated (defensively — a validation failure here is
 * this module's own bug, never a guest's, so it is asserted, not branched
 * on) and written to CAS too. `sizeGuard` (Plan 04) is applied to the
 * result text, never to the raw value. On `{kind:'error', message, reads}`:
 * a record with `status:'error'` is STILL written (provenance that only
 * covers successes is not provenance) and the response is an `errorResult`
 * naming both the failure and where its record lives. Nowhere in this
 * mapping is a caught value branched on via `instanceof Error` — fjs's
 * `assert`/`unwrap` throw bare values (03-CONTEXT.md), and `interpret`
 * already converts `match`'s bare-string refusal into an `error(...)`
 * before it ever reaches this module.
 *
 * ## Concrete `FileCasOperation`, not a generic `<O extends Operation>`
 *
 * `buildRunSnapshot`/`buildHostMap` (Plan 05) and `casRefreshTool`
 * (`fjs/server/module.f.js`) are generic over `O` because their FIRST
 * curried parameter already mentions `O` (`cas: Cas<O>`), so TypeScript can
 * resolve it the moment that parameter is applied. `executeRun`/
 * `fjsRunTool`'s OWN first parameter is `materializeHomeRoot: string`,
 * which mentions nothing about `O` — verified empirically that this makes
 * `tsc` commit to `O`'s bare constraint at that first application, before
 * `cas`/`evoApi` are ever seen, so every later application then fails to
 * unify against a concrete `Cas<FileCasOperation>` argument. Since this
 * codebase has exactly one `Cas` implementation (`fileCas`,
 * `financeMcpHandlers`'s own signature is concrete for the same reason),
 * fixing both exports to `FileCasOperation` costs nothing in practice and
 * keeps the curry order the plan specifies.
 *
 * @module
 */
import { step, pure, mapStep } from 'functionalscript/fjs/effects/module.f.js'
import { collectRead, fileCas } from 'functionalscript/fjs/cas/module.f.js'
import { cBase32ToVec, vecToCBase32 } from 'functionalscript/fjs/basen/cbase32/module.f.js'
import { utf8ToString, tryUtf8 } from 'functionalscript/fjs/text/module.f.js'
import { ok } from 'functionalscript/fjs/types/result/module.f.js'
import { option, array, string } from 'functionalscript/fjs/types/rtti/module.f.js'
import { toolEntry, okResult, errorResult } from 'functionalscript/fjs/protocol/mcp/module.f.js'
import { sha256 } from 'functionalscript/fjs/crypto/sha2/module.f.js'
import { initEvo, evo } from 'functionalscript/fjs/cas/evo/module.f.js'
import { emptyState, virtual } from 'functionalscript/fjs/effects/node/virtual/module.f.js'
import { assert, assertEq, assertNotNullish } from 'functionalscript/fjs/asserts/module.f.js'
import { interpret } from '../../exec/module.f.js'
import { guestCtx } from '../../guest/module.f.js'
import { materializeProgram, programFileName, loadProgram } from '../../guest/materialize/module.f.js'
import { buildRunSnapshot, buildHostMap } from './snapshot/module.f.js'
import { dialect, validate as validateRun } from '../../run/module.f.js'
import { sizeGuard, previewBytes, guardBytes } from '../response/module.f.js'

/** @import { Effect, Operation } from 'functionalscript/fjs/effects/module.f.js' */
/** @import { MemOp } from 'functionalscript/fjs/effects/memory/module.f.js' */
/** @import { Mkdir, WriteFile, Import } from 'functionalscript/fjs/effects/node/module.f.js' */
/** @import { Cas, FileCasOperation } from 'functionalscript/fjs/cas/module.f.js' */
/** @import { Evo } from 'functionalscript/fjs/cas/evo/module.f.js' */
/** @import { ToolEntry } from 'functionalscript/fjs/protocol/mcp/module.f.js' */
/** @import { Vec } from 'functionalscript/fjs/types/bit_vec/module.f.js' */
/** @import { Read } from '../../exec/module.f.js' */
/** @import { Report } from '../../guest/module.f.js' */
/** @import { Run } from '../../run/module.f.js' */

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

// ── fjsRunTool: handler-performed writes, the run record, the response ──────

/**
 * Writes `text`'s UTF-8 bytes to CAS as a single chunk — the same
 * `cas.write(pure({first: ok(bytes), tail: pure(undefined)}))` pattern
 * `fjs/server/module.f.js`'s `casRefresh` proof and
 * `fjs/server/fjs_run/snapshot/module.f.js`'s own store-seeding proofs use —
 * and returns the resulting content hash. A write failure here is asserted,
 * not branched on: writing a moderately-sized in-memory string is not a
 * normal-operation failure mode this plan's error taxonomy covers (that
 * taxonomy is about GUEST failures — missing hash, dirty specifier, a
 * non-`Error` throw — not CAS infrastructure failures).
 * @type {<O extends Operation>(cas: Cas<O>) => (text: string) => Effect<O, string>}
 */
const writeTextToCas = cas => text => {
    const bytes = tryUtf8(text)
    assert(bytes !== null, ['expected text destined for CAS to encode as UTF-8', text])
    return mapStep(
        cas.write(pure({ first: ok(bytes), tail: pure(undefined) })),
        writeResult => {
            assert(writeResult[0] === 'ok', ['expected a CAS write to succeed', writeResult])
            return vecToCBase32(writeResult[1])
        },
    )
}

/**
 * `fjs_run`'s input contract: a program hash, optional `args`, and an
 * optional `subject`/`parents` pin (07-CONTEXT.md — both present pins the
 * run; either absent is an ordinary unpinned run, recorded as
 * `pinned: false`).
 */
export const fjsRunInputSchema = /** @type {const} */ ({
    hash: string,
    args: option(array(string)),
    subject: option(string),
    parents: option(array(string)),
})

/**
 * The `fjs_run` MCP tool: runs a stored report program against pinned
 * inputs, writes the result and the `vnd.fjs.run` record to CAS (the
 * handler, never the guest — see the module header), and returns
 * `{ resultHash, runHash, preview, truncated }` — the same four keys
 * regardless of outcome shape or size.
 * @type {(materializeHomeRoot: string) => (cas: Cas<FileCasOperation>) => (evoApi: Evo<FileCasOperation>) => ToolEntry<FileCasOperation | Mkdir | WriteFile | Import | MemOp>}
 */
export const fjsRunTool = materializeHomeRoot => cas => evoApi => toolEntry(
    'fjs_run',
    'Runs a stored report program (by CAS hash) against pinned inputs and returns ' +
    'the result and run-record hashes. Supply subject and parents together to pin ' +
    'the snapshot the program\'s evoHead reads; omit both for an ordinary unpinned run.',
    fjsRunInputSchema,
    /** @type {(args: import('functionalscript/fjs/types/rtti/ts/module.f.js').Ts<typeof fjsRunInputSchema>) => Effect<FileCasOperation | Mkdir | WriteFile | Import | MemOp, import('functionalscript/fjs/protocol/mcp/module.f.js').ToolsCallResult>} */
    (args => {
        const programArgs = args.args ?? []
        const pinned = args.subject !== undefined && args.parents !== undefined
        return step(
            executeRun(materializeHomeRoot)(cas)(evoApi)({
                hash: args.hash,
                args: programArgs,
                ...(args.subject === undefined ? {} : { subject: args.subject }),
                ...(args.parents === undefined ? {} : { parents: args.parents }),
            }),
            outcome => {
                const inputs = outcome.reads.map(([command, payload]) => ({
                    command,
                    payload: payload.map(String),
                }))
                const pinFields = /** @type {{ readonly subject?: string, readonly parents?: readonly string[] }} */ ({
                    ...(args.subject === undefined ? {} : { subject: args.subject }),
                    ...(args.parents === undefined ? {} : { parents: args.parents }),
                })
                if (outcome.kind === 'ok') {
                    const text = String(outcome.value)
                    return step(writeTextToCas(cas)(text), resultHash => {
                        /** @type {Run} */
                        const record = {
                            dialect,
                            programHash: args.hash,
                            args: programArgs,
                            pinned,
                            ...pinFields,
                            status: 'ok',
                            inputs,
                            resultHash,
                        }
                        const [vt, vv] = validateRun(record)
                        assert(vt === 'ok', ['fjs_run assembled an invalid ok run record - executor bug', vv])
                        return step(writeTextToCas(cas)(JSON.stringify(vv)), runHash => {
                            const { preview, truncated } = sizeGuard(guardBytes)(previewBytes)(text, resultHash)
                            return pure(okResult(JSON.stringify({ resultHash, runHash, preview, truncated })))
                        })
                    })
                }
                /** @type {Run} */
                const record = {
                    dialect,
                    programHash: args.hash,
                    args: programArgs,
                    pinned,
                    ...pinFields,
                    status: 'error',
                    inputs,
                    error: outcome.message,
                }
                const [vt, vv] = validateRun(record)
                assert(vt === 'ok', ['fjs_run assembled an invalid error run record - executor bug', vv])
                return step(writeTextToCas(cas)(JSON.stringify(vv)), runHash =>
                    pure(errorResult(`fjs_run failed: ${outcome.message} (run record: ${runHash})`)))
            },
        )
    }),
)

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

    // ── Task 2: fjsRunTool ───────────────────────────────────────────────
    fjsRunTool: {
        // Success Criterion 3's static half — casWrite/evoAdd absent from
        // the guest ABI — is re-verified after this plan's own edits by
        // this plan's own `<verify>` step
        // (`grep -n "casWrite|evoAdd" fjs/guest/module.f.js
        // fjs/guest/materialize/module.f.js`), not duplicated here: a grep
        // over the guest ABI's own two files is exactly what that
        // criterion names, and reproducing it via an impure in-module file
        // read would cost purity for no additional coverage.
        //
        // Criterion 2, the adversarial proof: a program reads a document it
        // never cites in its return value; the PERSISTED record — decoded
        // back out of CAS by its own returned runHash, never the in-process
        // Read[] — still names that read.
        adversarial: {
            persistedRunRecordContainsAnUncitedRead: () => {
                const home = '/adversarial'
                const cas = fileCas(sha256)(home)
                const [state0, cacheKey] = virtual(emptyState)(initEvo(cas))
                const e = evo(cas)(cacheKey)
                const [state1, citedHash] = virtual(state0)(seedText(cas)('{"cited":true}'))
                const [state2, uncitedHash] = virtual(state1)(seedText(cas)('{"uncited":true}'))
                const [state3, programHash] = virtual(state2)(
                    seedText(cas)('export const report = ctx => args => ctx.pure("unused")'))
                const name = programFileName(programHash)

                /** @type {import('../../guest/module.f.js').Report<string>} */
                const adversarialReport = ctx => () => ctx.step(
                    ctx.casRead(citedHash),
                    citedValue => ctx.step(ctx.casRead(uncitedHash), () => ctx.pure(citedValue)))
                const root = { ...state3.root, [name]: () => ({ report: adversarialReport }) }

                const [state4, callResult] = virtual({ ...state3, root })(
                    fjsRunTool(home)(cas)(e).handle({ hash: programHash }))
                assertEq(callResult.isError, undefined)
                const first = callResult.content[0]
                if (first === undefined || first.type !== 'text') {
                    throw ['expected a text content item', callResult]
                }
                const parsed = /** @type {{ readonly resultHash: string, readonly runHash: string, readonly preview: string, readonly truncated: boolean }} */ (JSON.parse(first.text))

                const runHashVec = cBase32ToVec(parsed.runHash)
                assert(runHashVec !== null, ['expected a decodable runHash', parsed.runHash])
                const [, runReadResult] = virtual(state4)(
                    collectRead(cas.read(/** @type {Vec} */ (runHashVec))))
                assert(runReadResult[0] === 'ok', ['expected the run record to read back', runReadResult])
                const [vt, record] = validateRun(JSON.parse(utf8ToString(runReadResult[1])))
                assert(vt === 'ok', ['expected the persisted record to validate', vt, record])
                if (vt === 'ok') {
                    assert(
                        record.inputs.some(i => i.command === 'casRead' && i.payload[0] === uncitedHash),
                        ['expected inputs[] to contain the uncited read', record.inputs])
                }
            },
        },
        // Criterion 3, the behavioral proof: exactly two new CAS hashes
        // appear after one handle call, and both decode to content the
        // HANDLER itself constructed.
        behavioral: {
            exactlyTwoNewHandlerConstructedHashesAppear: () => {
                const home = '/behavioral'
                const cas = fileCas(sha256)(home)
                const [state0, cacheKey] = virtual(emptyState)(initEvo(cas))
                const e = evo(cas)(cacheKey)
                const [state1, programHash] = virtual(state0)(
                    seedText(cas)('export const report = ctx => args => ctx.pure("answer-42")'))
                const name = programFileName(programHash)
                /** @type {import('../../guest/module.f.js').Report<string>} */
                const trivialReport = ctx => () => ctx.pure('answer-42')
                const root = { ...state1.root, [name]: () => ({ report: trivialReport }) }
                const state1b = { ...state1, root }

                const [, hashesBefore] = virtual(state1b)(cas.list())
                const hashesBeforeSet = new Set(hashesBefore.map(vecToCBase32))

                const [state2, callResult] = virtual(state1b)(fjsRunTool(home)(cas)(e).handle({ hash: programHash }))
                assertEq(callResult.isError, undefined)
                const first = callResult.content[0]
                if (first === undefined || first.type !== 'text') {
                    throw ['expected a text content item', callResult]
                }
                const parsed = /** @type {{ readonly resultHash: string, readonly runHash: string, readonly preview: string, readonly truncated: boolean }} */ (JSON.parse(first.text))

                const [, hashesAfter] = virtual(state2)(cas.list())
                const hashesAfterSet = new Set(hashesAfter.map(vecToCBase32))
                const newHashes = [...hashesAfterSet].filter(h => !hashesBeforeSet.has(h))
                assertEq(newHashes.length, 2)
                assert(newHashes.includes(parsed.resultHash), ['expected resultHash among the new hashes', newHashes])
                assert(newHashes.includes(parsed.runHash), ['expected runHash among the new hashes', newHashes])

                const resultHashVec = cBase32ToVec(parsed.resultHash)
                assert(resultHashVec !== null, 'expected a decodable resultHash')
                const [, resultRead] = virtual(state2)(collectRead(cas.read(/** @type {Vec} */ (resultHashVec))))
                assert(resultRead[0] === 'ok', ['expected the result to read back', resultRead])
                assertEq(utf8ToString(resultRead[1]), 'answer-42')

                const runHashVec = cBase32ToVec(parsed.runHash)
                assert(runHashVec !== null, 'expected a decodable runHash')
                const [, runRead] = virtual(state2)(collectRead(cas.read(/** @type {Vec} */ (runHashVec))))
                assert(runRead[0] === 'ok', ['expected the run record to read back', runRead])
                const [vt] = validateRun(JSON.parse(utf8ToString(runRead[1])))
                assertEq(vt, 'ok')
            },
        },
        // A successful run's response has exactly the four uniform keys,
        // and the result is written to CAS even for a trivially small
        // value (truncated === false, but resultHash still resolves).
        responseShape: {
            fourKeysExactlyAndResultAlwaysResolvable: () => {
                const home = '/shape'
                const cas = fileCas(sha256)(home)
                const [state0, cacheKey] = virtual(emptyState)(initEvo(cas))
                const e = evo(cas)(cacheKey)
                const [state1, programHash] = virtual(state0)(
                    seedText(cas)('export const report = ctx => args => ctx.pure("tiny")'))
                const name = programFileName(programHash)
                /** @type {import('../../guest/module.f.js').Report<string>} */
                const tinyReport = ctx => () => ctx.pure('tiny')
                const root = { ...state1.root, [name]: () => ({ report: tinyReport }) }

                const [state2, callResult] = virtual({ ...state1, root })(
                    fjsRunTool(home)(cas)(e).handle({ hash: programHash }))
                assertEq(callResult.isError, undefined)
                const first = callResult.content[0]
                if (first === undefined || first.type !== 'text') {
                    throw ['expected a text content item', callResult]
                }
                const parsed = /** @type {Record<string, unknown>} */ (JSON.parse(first.text))
                assertEq(JSON.stringify(Object.keys(parsed).sort()), JSON.stringify(['preview', 'resultHash', 'runHash', 'truncated']))
                assertEq(parsed['truncated'], false)

                const resultHash = /** @type {string} */ (parsed['resultHash'])
                const resultHashVec = cBase32ToVec(resultHash)
                assert(resultHashVec !== null, 'expected resultHash to be resolvable even for a tiny value')
                const [, resultRead] = virtual(state2)(collectRead(cas.read(/** @type {Vec} */ (resultHashVec))))
                assert(resultRead[0] === 'ok', ['expected the tiny result to read back', resultRead])
                assertEq(utf8ToString(resultRead[1]), 'tiny')
            },
        },
        // A failed run still gets a run record (07-CONTEXT.md): status
        // 'error', the error message present, no resultHash.
        errorPath: {
            failedRunStillGetsARunRecord: () => {
                const home = '/error-path'
                const cas = fileCas(sha256)(home)
                const [state0, cacheKey] = virtual(emptyState)(initEvo(cas))
                const e = evo(cas)(cacheKey)
                const [state1, callResult] = virtual(state0)(
                    fjsRunTool(home)(cas)(e).handle({ hash: 'not-a-real-hash' }))
                assertEq(callResult.isError, true)
                const first = callResult.content[0]
                if (first === undefined || first.type !== 'text') {
                    throw ['expected a text content item', callResult]
                }
                const match = /run record: (\S+)\)/.exec(first.text)
                assert(match !== null, ['expected the error text to name a run record hash', first.text])
                const runHash = assertNotNullish(match[1], 'expected the run record hash capture group to be present')
                const runHashVec = cBase32ToVec(runHash)
                assert(runHashVec !== null, 'expected a decodable runHash')
                const [, runRead] = virtual(state1)(collectRead(cas.read(/** @type {Vec} */ (runHashVec))))
                assert(runRead[0] === 'ok', ['expected the error run record to read back', runRead])
                const [vt, record] = validateRun(JSON.parse(utf8ToString(runRead[1])))
                assert(vt === 'ok', ['expected the error record to validate', vt, record])
                if (vt === 'ok') {
                    assertEq(record.status, 'error')
                    assert(record.error !== undefined && record.error.includes('not-a-real-hash'), record.error)
                    assertEq(record.resultHash, undefined)
                }
            },
        },
    },
}
