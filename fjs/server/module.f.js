/**
 * The `finance` MCP server: our own composition root, mirroring fjs's own
 * `casMcpServer` (`functionalscript/fjs/mcp/module.f.js`) but with our own
 * identity and store path.
 *
 * ## Why our own `McpConfig`, not `casConfig`
 *
 * `casConfig` (`fjs/mcp/module.f.js`) identifies fjs's own CAS server at
 * protocol version `2024-11-05`. Reusing it would make this server
 * indistinguishable from that one to any client, which is exactly the
 * confusion MCP-03 exists to prevent. `financeConfig` below is a distinct
 * `McpConfig`, pinned to `2025-11-25` per MCP-03.
 *
 * ## The protocol-version pin is a known upstream gap, not a design choice
 *
 * `mcpStep`'s `initialize` handler validates the client's params and then
 * unconditionally returns the configured `protocolVersion` — it does not
 * negotiate against, or even inspect, what the client asked for
 * (`functionalscript/fjs/protocol/mcp/module.f.js`). Whatever string we pin
 * here is what every client is told, regardless of its own request. That gap
 * belongs in fjs's `initialize` handler (a generic protocol capability, not
 * app-specific glue — see AGENTS.md), and is recorded in
 * `fjs/todo/upstream-mcp-protocol-version-negotiation.md`. Do not wrap or
 * replace `mcpStep` here to work around it.
 *
 * ## Registry composition — the full Week 1 registry
 *
 * `financeMcpHandlers` composes `casToolRegistry` + `evoToolRegistry` +
 * `casRefreshTool` (DOC-14's `cas_refresh` — see below) + `financeSchemaTool`
 * (MCP-06's `finance_schema`, Plan 03) + `fjsRunTool` (EXEC-08/EXEC-10/
 * EXEC-11/PROV-03's `fjs_run`, Plans 05-07). This is the seam this module's
 * header used to reserve as a comment — it is wired now, not future work
 * (see `proof.weekOneConvergence` below for the end-to-end proof this
 * composition exists to make possible).
 *
 * ## `cas_refresh` — the DOC-14 cache-refresh lever
 *
 * The Evo cache built by `initEvo` is a point-in-time scan: content written
 * directly into the CAS store by another process (e.g. `npx functionalscript
 * cas add`, the >128 KiB CLI route this store's `evo_add`/MCP stdio path
 * cannot carry — see `05-CONTEXT.md`) is invisible to `evo_head`/`evo_list`
 * until something rescans. `casRefreshTool` is that rescan, exposed as an
 * explicit MCP tool rather than an automatic side effect of every read (an
 * automatic rescan on every call would make every read as expensive as a
 * full store scan, for no benefit at this project's scale — see the
 * threat-model `T-05-04-02` entry in `05-04-PLAN.md`): it reruns
 * `buildCache` over the same `FileCas` `evoToolRegistry` already reads from,
 * and replaces the in-memory cache at the same `cacheKey`, so a caller who
 * knows the store changed underneath the running server can make it notice,
 * without a restart (Success Criterion 5).
 *
 * @module
 */
import { mapStep, pure, step } from 'functionalscript/fjs/effects/module.f.js'
import { create, write } from 'functionalscript/fjs/effects/memory/module.f.js'
import { stdioTransport } from 'functionalscript/fjs/protocol/mcp/stdio/module.f.js'
import { mcpStep, uninitializedState, fromRegistry, toolEntry, okResult } from 'functionalscript/fjs/protocol/mcp/module.f.js'
import { fileCas } from 'functionalscript/fjs/cas/module.f.js'
import { initEvo, evo, buildCache } from 'functionalscript/fjs/cas/evo/module.f.js'
import { sha256 } from 'functionalscript/fjs/crypto/sha2/module.f.js'
import { casToolRegistry } from 'functionalscript/fjs/mcp/cas/module.f.js'
import { evoToolRegistry } from 'functionalscript/fjs/mcp/evo/module.f.js'
import { emptyState, virtual } from 'functionalscript/fjs/effects/node/virtual/module.f.js'
import { fromVec } from 'functionalscript/fjs/types/uint8array/module.f.js'
import { utf8 } from 'functionalscript/fjs/text/module.f.js'
import { array, option, string } from 'functionalscript/fjs/types/rtti/module.f.js'
import { validate as rttiValidate } from 'functionalscript/fjs/types/rtti/validate/module.f.js'
import { assert, assertEq, assertNotNullish } from 'functionalscript/fjs/asserts/module.f.js'
import { dialect as revisionDialect } from 'functionalscript/fjs/media/revision/module.f.js'
import { cBase32ToVec, vecToCBase32 } from 'functionalscript/fjs/basen/cbase32/module.f.js'
import { vec8 } from 'functionalscript/fjs/types/bit_vec/module.f.js'
import { ok } from 'functionalscript/fjs/types/result/module.f.js'
import { tryUtf8, utf8ToString } from 'functionalscript/fjs/text/module.f.js'
import { collectRead } from 'functionalscript/fjs/cas/module.f.js'
import { financeSchemaTool } from './finance_schema/module.f.js'
import { financeTaxParamsTool } from './finance_tax_params/module.f.js'
import { fjsRunTool, placeJsModuleFixture } from './fjs_run/module.f.js'
import { guestCtx } from '../guest/module.f.js'
import { programPath, materializeHome } from '../guest/materialize/module.f.js'
import { validate as validateRun } from '../run/module.f.js'
import { dialect as oneZeroNineNineIntDialect, validate as validateOneZeroNineNineInt } from '../document/1099int/module.f.js'
import { parse as jsonParse } from '../json/module.f.js'
import { unwrap } from 'functionalscript/fjs/types/result/module.f.js'

/** @import { McpConfig, McpHandlers, ToolEntry } from 'functionalscript/fjs/protocol/mcp/module.f.js' */
/** @import { Effect, Operation } from 'functionalscript/fjs/effects/module.f.js' */
/** @import { MemOp, Key } from 'functionalscript/fjs/effects/memory/module.f.js' */
/** @import { Read, Write, Mkdir, WriteFile, Import } from 'functionalscript/fjs/effects/node/module.f.js' */
/** @import { FileCasOperation } from 'functionalscript/fjs/cas/module.f.js' */
/** @import { Cache } from 'functionalscript/fjs/cas/evo/module.f.js' */
/** @import { Cas } from 'functionalscript/fjs/cas/module.f.js' */
/** @import { Unknown } from 'functionalscript/fjs/media/json/module.f.js' */
/** @import { Result } from 'functionalscript/fjs/types/result/module.f.js' */
/** @import { ValidationError } from 'functionalscript/fjs/types/rtti/validate/module.f.js' */
/** @import { Vec } from 'functionalscript/fjs/types/bit_vec/module.f.js' */
/** @import { Report, CasOp } from '../guest/module.f.js' */
/** @import { State } from 'functionalscript/fjs/effects/node/virtual/module.f.js' */

// ── cas_refresh (DOC-14) ────────────────────────────────────────────────────────
/**
 * The `cas_refresh` MCP tool: rescans `cas` via `buildCache` and replaces the
 * in-memory Evo subject/head cache at `cacheKey` with the fresh result — the
 * refresh lever for content mutated by another process (e.g. `npx
 * functionalscript cas add`) since the server started or was last refreshed.
 * Call this after externally adding a revision blob so `evo_head`/`evo_list`
 * see it without a restart (Success Criterion 5). Zero arguments: the tool
 * always rescans the whole store, mirroring `buildCache`'s own full-rescan
 * contract — see the module doc's threat-model note (`T-05-04-02`) on why a
 * full rescan, not a targeted `syncRevision`, is the right lever here.
 * @type {<O extends Operation>(cas: Cas<O>) => (cacheKey: Key<Cache>) => ToolEntry<O | MemOp>}
 */
export const casRefreshTool = cas => cacheKey => toolEntry(
    'cas_refresh',
    'Rescans the CAS store and replaces the in-memory Evo subject/head cache. ' +
    'The refresh lever for content mutated by another process (e.g. `npx ' +
    'functionalscript cas add`) since the server started or was last ' +
    'refreshed; call this after externally adding a revision blob so ' +
    'evo_head/evo_list see it without a restart.',
    {},
    // Two sequential effects, written as a chain rather than as a nest: the
    // rebuild feeds the write, and the write's result is replaced by the
    // response. `mapStep(e, () => v)` is the constant form — upstream's own
    // docstring explains why no `constStep` exists.
    () => mapStep(
        step(buildCache(cas), newCache => write(cacheKey, newCache)),
        () => okResult('refreshed')),
)

// ── Handlers ────────────────────────────────────────────────────────────────────
/**
 * MCP handlers for `FileCas` (`casToolRegistry`) plus the Evo API
 * (`evoToolRegistry`) layered on it, plus `casRefreshTool` (DOC-14),
 * `financeSchemaTool` (MCP-06), `financeTaxParamsTool` (MCP-07), and
 * `fjsRunTool` (EXEC-08/EXEC-10/EXEC-11/PROV-03), bound to `home` and an
 * already-built Evo cache slot (see `initEvo`). `financeSchemaTool`,
 * `financeTaxParamsTool`, and `fjsRunTool` concatenate straight into the
 * same flat array `casRefreshTool` already established the pattern for —
 * no separate composition mechanism, per this file's own precedent.
 * @type {(home: string) => (cacheKey: Key<Cache>) => McpHandlers<FileCasOperation | MemOp | Mkdir | WriteFile | Import>}
 */
export const financeMcpHandlers = home => cacheKey => fromRegistry([
    ...casToolRegistry(home)(cacheKey),
    ...evoToolRegistry(evo(fileCas(sha256)(home))(cacheKey)),
    casRefreshTool(fileCas(sha256)(home))(cacheKey),
    financeSchemaTool,
    financeTaxParamsTool,
    fjsRunTool(home)(fileCas(sha256)(home))(evo(fileCas(sha256)(home))(cacheKey)),
])

// ── Session configuration ───────────────────────────────────────────────────────
/**
 * Static MCP configuration for the `finance` server: advertises the `tools`
 * capability, identifies as our own server (never fjs's own CAS server
 * identity), and pins the protocol version to `2025-11-25` per MCP-03.
 * @type {McpConfig}
 */
export const financeConfig = {
    serverInfo: { name: 'finance-mcp', version: '0.0.0' },
    capabilities: { tools: {} },
    protocolVersion: '2025-11-25',
}

// ── Server ──────────────────────────────────────────────────────────────────────
/**
 * Runs the `finance` MCP server over stdio: scans `home` once to build the
 * Evo subject/head cache (`initEvo`), allocates the session-state slot,
 * builds the `mcpStep` for the composed tool registry, and drives the
 * read → parse → dispatch → write loop until stdin EOF. Mirrors fjs's own
 * `casMcpServer` exactly, substituting `financeConfig`/`financeMcpHandlers`
 * for `casConfig`/`casMcpHandlers`.
 * @type {(home: string) => Effect<Read | Write | MemOp | FileCasOperation | Mkdir | WriteFile | Import, void>}
 */
export const financeMcpServer = home => step(
    initEvo(fileCas(sha256)(home)),
    cacheKey => step(
        create(uninitializedState),
        sessionKey => stdioTransport(mcpStep(financeConfig)(financeMcpHandlers(home)(cacheKey))(sessionKey)),
    ),
)

// ── Tests ────────────────────────────────────────────────────────────────────
/**
 * UTF-8 bytes of `s` as a plain array — the virtual stdin byte stream, same
 * helper `fjs/protocol/mcp/stdio/proof.f.js` and `fjs/mcp/proof.f.js` use.
 * @type {(s: string) => readonly number[]}
 */
const toBytes = s => [...fromVec(utf8(s))]

/**
 * The `protocolVersion` the simulated client asks for in `initialize` —
 * deliberately **not** `financeConfig.protocolVersion` (`2025-11-25`). The
 * whole point of `proof.session` is observing, empirically, that `mcpStep`
 * still answers with our pinned version regardless of this request (see
 * `fjs/todo/upstream-mcp-protocol-version-negotiation.md`).
 */
const requestedProtocolVersion = '2025-06-18'

const initializeRequest = {
    jsonrpc: '2.0',
    method: 'initialize',
    id: 1,
    params: {
        protocolVersion: requestedProtocolVersion,
        capabilities: {},
        clientInfo: { name: 'finance-proof-client', version: '0.0.1' },
    },
}
const initializedNotification = { jsonrpc: '2.0', method: 'notifications/initialized' }
const toolsListRequest = { jsonrpc: '2.0', method: 'tools/list', id: 2 }
const toolsCallRequest = {
    jsonrpc: '2.0',
    method: 'tools/call',
    id: 3,
    params: { name: 'evo_list', arguments: {} },
}

/**
 * Drives the full `initialize` -> `notifications/initialized` -> `tools/list`
 * -> `tools/call` session against the real assembled `financeMcpServer` over
 * the virtual Node interpreter — no real process, no real filesystem, no
 * `Promise`. Returns the resulting virtual `State` so each proof leaf below
 * can assert on `stdout`/`stderr` independently.
 * @type {() => State}
 */
const runSession = () => {
    const input = [initializeRequest, initializedNotification, toolsListRequest, toolsCallRequest]
        .map(m => JSON.stringify(m))
        .join('\n') + '\n'
    const [state] = virtual({ ...emptyState, stdin: toBytes(input) })(financeMcpServer('/'))
    return state
}

/**
 * Non-empty stdout lines from a session `State`, decoded as JSON-RPC
 * envelopes. Typed `Unknown` — fjs's JSON value type — rather than `any`:
 * these arrive from outside the typed effect system, so nothing is known
 * about their shape until a schema says so. `decode` below is how a leaf
 * says so.
 *
 * `JSON.parse` is used directly rather than `fjs/media/json`'s `parse`
 * because at fjs 0.41.0 the latter is literally `export const parse =
 * JSON.parse` — the same function under another name, so importing it would
 * be a rename dressed as a fix. Upstream is splitting that export into a
 * total, tokenizer-backed `parse` returning a `Result` and a deprecated
 * `parseNative` (functionalscript#1430); when that lands, this is the one
 * line to revisit. Recorded in `fjs/todo/upstream-json-parse-split.md`.
 * @type {(state: State) => readonly Unknown[]}
 */
const responsesOf = state => state.stdout
    .split('\n')
    .filter((/** @type {string} */ line) => line !== '')
    .map((/** @type {string} */ line) => unwrap(jsonParse(line)))

/**
 * Turns an rtti validator into a narrowing decoder: it yields the validated
 * value, or throws the validation error if the response is not the shape the
 * caller expects. Also absorbs the `| undefined` that
 * `noUncheckedIndexedAccess` puts on every destructured response, so a leaf
 * that indexes past the end fails here with a clear message instead of
 * further along.
 *
 * The type parameter is inferred from the VALIDATOR's own result rather than
 * recomputed as `Ts<typeof schema>`. That is not a style choice: the generic
 * form `<T extends Type>(schema: T) => … => Ts<T>` makes `tsc` give up with
 * `TS2589: Type instantiation is excessively deep and possibly infinite`,
 * because rtti's `Unknown` is recursive. Letting `rttiValidate` compute the
 * type once, at its own call site, keeps the instantiation shallow.
 *
 * This is what replaced `any`. The difference is not ceremony: under `any`,
 * `callResponse.result.content[0].type` failed with a `TypeError` about
 * reading a property of `undefined`, naming neither the response nor the
 * field that was wrong. A schema failure names the path. It also makes each
 * leaf declare the response shape it depends on, so a server change that
 * altered that shape fails at the decode rather than somewhere downstream.
 *
 * rtti permits properties a schema does not mention — verified — so each
 * schema below names only what its own leaf reads, and a full JSON-RPC
 * envelope validates against a partial one.
 * @type {<T>(validator: (value: Unknown) => Result<T, ValidationError>) => (value: Unknown | undefined) => T}
 */
const decoder = validator => value => {
    assert(value !== undefined, 'expected a JSON-RPC response, got none')
    const [t, v] = validator(value)
    if (t === 'error') {
        throw ['unexpected JSON-RPC response shape', v]
    }
    return v
}

/** Every response carries this, whatever else it carries. */
const envelopeSchema = /** @type {const} */ ({ jsonrpc: string })

/** What `initializeIgnoresRequestedProtocolVersion` reads. */
const initResultSchema = /** @type {const} */ ({
    result: { protocolVersion: string, serverInfo: { name: string } },
})

/** What `toolsListEnumeratesComposedRegistry` reads. */
const toolsListResultSchema = /** @type {const} */ ({
    result: { tools: array({ name: string }) },
})

/** What the `tools/call` leaves read, here and in the DOC-14 proof below. */
const callResultSchema = /** @type {const} */ ({
    result: { content: array({ type: string, text: string }) },
})

/** What `weekOneConvergence`'s `fjs_run` leaf reads — same as {@link callResultSchema} plus the optional `isError` flag a failed tool call carries. */
const callResultWithIsErrorSchema = /** @type {const} */ ({
    result: { content: array({ type: string, text: string }), isError: option(true) },
})

const asEnvelope = decoder(rttiValidate(envelopeSchema))
const asInitResult = decoder(rttiValidate(initResultSchema))
const asToolsListResult = decoder(rttiValidate(toolsListResultSchema))
const asCallResult = decoder(rttiValidate(callResultSchema))
const asCallResultWithIsError = decoder(rttiValidate(callResultWithIsErrorSchema))

export const proof = {
    // financeMcpServer is never called in integration tests because it drives
    // a real stdio server; call it here to cover its Effect-building body —
    // the stdio server *process* cannot be proof-tested directly (see
    // fjs/todo/implement-mcp-server.md).
    financeMcpServer: () => { financeMcpServer('/') },
    // Full-session proof (MCP-05): initialize -> notifications/initialized ->
    // tools/list -> tools/call, driven against financeMcpServer through the
    // virtual Node interpreter. See fjs/todo/upstream-mcp-protocol-version-negotiation.md
    // for the non-negotiation gap this proof demonstrates empirically. A
    // virtual harness proves the pieces speak correctly to each other; it
    // cannot prove a real client will call a tool — that is Plan 03's job.
    session: {
        // Every stdout line across the whole session is valid JSON-RPC, and
        // exactly one per request (the notification gets none) — the
        // stdout-purity assertion (MCP-05). If anything non-JSON-RPC were
        // ever written to stdout, this parse would throw and the leaf would
        // fail.
        stdoutIsPureJsonRpc: () => {
            const responses = responsesOf(runSession())
            assertEq(responses.length, 3)
            for (const r of responses) {
                assertEq(asEnvelope(r).jsonrpc, '2.0')
            }
        },
        // No diagnostics were emitted anywhere in the session.
        stderrIsEmpty: () => {
            assertEq(runSession().stderr, '')
        },
        // Empirical, proof-backed non-negotiation: the client asked for
        // `requestedProtocolVersion` ('2025-06-18'), but the response still
        // carries our pinned '2025-11-25' and our own server identity —
        // mcpStep never inspects what the client requested.
        initializeIgnoresRequestedProtocolVersion: () => {
            const [initResponse] = responsesOf(runSession())
            const init = asInitResult(initResponse)
            assertEq(init.result.protocolVersion, '2025-11-25')
            assertEq(init.result.serverInfo.name, 'finance-mcp')
        },
        // All six registries composed: tools/list enumerates a non-empty set
        // that includes evo_list and cas_refresh (DOC-14), plus finance_schema
        // (MCP-06), finance_tax_params (MCP-07, Plan 08-04), and fjs_run
        // (EXEC-08/EXEC-10/EXEC-11/PROV-03).
        toolsListEnumeratesComposedRegistry: () => {
            const [, listResponse] = responsesOf(runSession())
            const tools = asToolsListResult(listResponse).result.tools
            assert(tools.length > 0)
            assert(tools.some(t => t.name === 'evo_list'))
            assert(tools.some(t => t.name === 'cas_refresh'))
            assert(tools.some(t => t.name === 'finance_schema'))
            assert(tools.some(t => t.name === 'finance_tax_params'))
            assert(tools.some(t => t.name === 'fjs_run'))
        },
        // A real registered handler answers tools/call — a green tools/call,
        // not merely a green tools/list (the documented silent-failure mode
        // this proof and Plan 03's live check both target).
        toolsCallReachesRealHandler: () => {
            const [, , callResponse] = responsesOf(runSession())
            // A schema that requires `result` already excludes an error
            // response: a JSON-RPC error envelope carries `error` and no
            // `result`, so decoding is itself the "not an error" assertion.
            assertEq(asCallResult(callResponse).result.content[0]?.type, 'text')
        },
    },
    // DOC-14 (Success Criterion 5's mechanism, proven in-process): a
    // `vnd.fjs.revision` blob seeded directly into the store — bypassing
    // `evo.add`, exactly as `node_modules/functionalscript/fjs/cas/evo/proof.f.js`'s
    // `buildCacheIncludesScannedRevision` leaf does — simulates content
    // written by another process. The cache built once at `initEvo` time,
    // strictly before the seed write below, cannot know about it, so
    // `evo_head` must answer empty until `cas_refresh` rescans the store.
    // The genuinely separate-OS-process version of this same scenario is
    // `cas-refresh-cross-process.test.js`; this leaf proves the refresh
    // MECHANISM fast and repeatably, it does not substitute for that test.
    casRefresh: {
        seedInvisibleUntilRefreshed: () => {
            const home = '/'
            const cas = fileCas(sha256)(home)
            // 1. The cache financeMcpHandlers reads from, built over an empty
            //    store — nothing to find yet.
            const [state0, cacheKey] = virtual(emptyState)(initEvo(cas))
            // 2. Seed a revision directly into the store, bypassing evo.add,
            //    strictly AFTER the cache above was already built.
            const subject = vecToCBase32(vec8(0x77n))
            const text = `{"dialect":"${revisionDialect}","subject":"${subject}","parents":[],"snapshot":"${subject}","generation":0}`
            const bytes = tryUtf8(text)
            assert(bytes !== null, 'expected the sample revision text to encode as UTF-8')
            // A single-chunk `List<never, IoResult<Vec>>`, built directly via
            // `pure` rather than `fjs/effects/list`'s `nonEmpty`/`empty`: those
            // are declared `<O extends Operation, T>`, and calling them with no
            // usable inference context (as `node_modules/functionalscript/fjs/cas/evo/proof.f.js`
            // does — a file this project's `tsconfig.json` excludes from
            // checking) widens `O` to the bare `Operation` constraint here,
            // which then fails to unify with `virtual`'s `NodeOp`. `pure`
            // fixes its effect parameter at `never`, side-stepping the
            // inference gap while building the identical `{first, tail}` cons
            // cell shape `nonEmpty`/`empty` themselves construct.
            const [state1, w] = virtual(state0)(cas.write(pure({ first: ok(bytes), tail: pure(undefined) })))
            assert(w[0] === 'ok', ['expected seed write ok', w])
            const seededHash = vecToCBase32(w[1])
            // 3. The session-state slot, exactly as financeMcpServer allocates it.
            const [state2, sessionKey] = virtual(state1)(create(uninitializedState))
            const handlers = financeMcpHandlers(home)(cacheKey)
            /**
             * Drives one NDJSON batch of `messages` against the composed
             * handlers over the still-threaded memory state, isolating this
             * batch's own stdout (each call starts from a fresh `stdout`)
             * while carrying every other field of `state` (crucially
             * `memoryValues`/`memoryNext`, so the session and cache slots
             * persist across batches) forward.
             * @type {(state: State, messages: readonly unknown[]) => readonly [State, readonly Unknown[]]}
             */
            const runBatch = (state, messages) => {
                const input = messages.map(m => JSON.stringify(m)).join('\n') + '\n'
                const [nextState] = virtual({ ...state, stdout: '', stderr: '', stdin: toBytes(input) })(stdioTransport(mcpStep(financeConfig)(handlers)(sessionKey)))
                return [nextState, responsesOf(nextState)]
            }
            const evoHeadCall = (/** @type {number} */ id) => ({
                jsonrpc: '2.0',
                method: 'tools/call',
                id,
                params: { name: 'evo_head', arguments: { subject } },
            })
            const [state3] = runBatch(state2, [initializeRequest, initializedNotification])
            // BEFORE cas_refresh: the cache from step 1 never saw the seed.
            const [state4, beforeResponses] = runBatch(state3, [evoHeadCall(10)])
            assertEq(asCallResult(beforeResponses[0]).result.content[0]?.text, '')
            const [state5, refreshResponses] = runBatch(state4, [{ jsonrpc: '2.0', method: 'tools/call', id: 11, params: { name: 'cas_refresh', arguments: {} } }])
            // Decoding against a schema that requires `result` is itself the
            // "not an error" assertion — a JSON-RPC error envelope carries
            // `error` and no `result`. It also pins what the tool actually
            // answered, which `!('error' in …)` never did.
            assertEq(asCallResult(refreshResponses[0]).result.content[0]?.text, 'refreshed')
            // AFTER cas_refresh: the same subject now resolves to the
            // seeded revision's own hash (its only, zero-parent head).
            const [, afterResponses] = runBatch(state5, [evoHeadCall(12)])
            assertEq(asCallResult(afterResponses[0]).result.content[0]?.text, seededHash)
        },
    },
    // ── The Week 1 Convergence (todo/plan.md's Week 1 finish line, Success
    // Criterion 1) ───────────────────────────────────────────────────────
    // The full path through the REAL financeMcpServer/mcpStep/stdioTransport
    // stack, never a bespoke harness: an agent calls
    // finance_schema('vnd.fjs.1099int'), a program stored via cas.write is
    // run through fjs_run over that SAME real stack.
    //
    // 07-10: this proof's fjs_run leg can no longer demonstrate a SUCCESSFUL
    // sum here, and this is expected, not a regression this plan
    // introduces. `executeRun`'s import path is now fixed to match its own
    // materialize-write path (the bug this plan fixes), and
    // `fjs/effects/node/virtual`'s `writeFile` (array-of-`Vec`) and
    // `import_` (`JsModule` function) representations are incompatible at
    // the SAME path within the SAME session (see
    // `fjs/server/fjs_run/module.f.js`'s module header and its
    // `runExecuteRunViaFixture` helper for the full account, empirically
    // confirmed both directions). Unlike the leaf-level proofs in that
    // file, THIS proof drives `fjs_run` through the real, opaque
    // `mcpStep`/`stdioTransport` batch dispatch — there is no seam here to
    // decompose the materialize-write from the fixture-backed load the way
    // `runExecuteRunViaFixture` does at the `fjs_run/module.f.js` layer. So
    // this leaf now asserts the CORRECT, surfaced consequence instead: the
    // real stack still correctly reports the failure and still persists a
    // `status:'error'` run record (PROV-03) — never a dropped connection or
    // an unhandled throw. The GENUINE, decisive proof that a real separate
    // process actually sums the interest correctly through fjs_run now
    // lives EXCLUSIVELY in `fjs-run-integration.test.js`, which drives a
    // real `node index.js` process against a real filesystem and asserts
    // the correct total — precisely the "one assertion no virtual proof can
    // make" that test's own header already claims, now proven to extend to
    // the WHOLE success path, not just the materialized-file's existence.
    weekOneConvergence: {
        agentSumsInterestAcrossStoredDocumentsThroughTheRealServerStack: () => {
            const home = '/week-one'
            const cas = fileCas(sha256)(home)

            // ── Seed three 1099-INT documents, each behind its own subject.
            // Two carry box1InterestIncome; the third OMITS the key entirely
            // (never '0.00') — the mandatory absent-is-skipped case, proven
            // distinct from a present-zero case below.
            const docCommon = /** @type {const} */ ({
                dialect: oneZeroNineNineIntDialect,
                payerTin: '11-1111111',
                recipientTin: '222-22-2222',
                taxYear: 2024,
                formRevision: '2024',
            })
            const docWithInterest = { ...docCommon, accountNumber: 'ACC-0001', box1InterestIncome: '1234.56' }
            const docWithSmallerInterest = { ...docCommon, accountNumber: 'ACC-0002', box1InterestIncome: '10.00' }
            const docWithAbsentInterest = { ...docCommon, accountNumber: 'ACC-0003' }
            for (const doc of [docWithInterest, docWithSmallerInterest, docWithAbsentInterest]) {
                const [vt, vv] = validateOneZeroNineNineInt(doc)
                assert(vt === 'ok', ['expected the seeded 1099-INT to validate', vt, vv])
            }

            /**
             * Single-chunk UTF-8 CAS write, returning the resulting content
             * hash — the same `cas.write(pure({first: ok(bytes), tail:
             * pure(undefined)}))` pattern `casRefresh.seedInvisibleUntilRefreshed`
             * (above) uses, factored here so the seven sequential writes below
             * (three documents, three revisions, one program) don't repeat it
             * seven times.
             * @type {(state: State) => (text: string) => readonly [State, string]}
             */
            const seedText = state => text => {
                const bytes = tryUtf8(text)
                assert(bytes !== null, ['expected seed text to encode as UTF-8', text])
                const [nextState, w] = virtual(state)(cas.write(pure({ first: ok(bytes), tail: pure(undefined) })))
                assert(w[0] === 'ok', ['expected the seed write to succeed', w])
                return [nextState, vecToCBase32(w[1])]
            }

            const [state0, docAHash] = seedText(emptyState)(JSON.stringify(docWithInterest))
            const [state1, docBHash] = seedText(state0)(JSON.stringify(docWithSmallerInterest))
            const [state2, docCHash] = seedText(state1)(JSON.stringify(docWithAbsentInterest))

            // Revisions seeded directly into the store (bypassing evo_add),
            // mirroring casRefresh.seedInvisibleUntilRefreshed's own
            // technique — one per document, each behind its own subject.
            const subjectA = vecToCBase32(vec8(0x01n))
            const subjectB = vecToCBase32(vec8(0x02n))
            const subjectC = vecToCBase32(vec8(0x03n))
            /** @type {(subject: string, snapshot: string) => string} */
            const revisionText = (subject, snapshot) =>
                `{"dialect":"${revisionDialect}","subject":"${subject}","parents":[],"snapshot":"${snapshot}","generation":0}`
            const [state3] = seedText(state2)(revisionText(subjectA, docAHash))
            const [state4] = seedText(state3)(revisionText(subjectB, docBHash))
            const [state5] = seedText(state4)(revisionText(subjectC, docCHash))

            // Store the guest program's source via cas.write — the real
            // content-addressed write an agent would perform (that WRITE
            // mechanism was already independently proven in Plan 05; `virtual`
            // cannot execute freshly-written bytes as code, so the
            // established JsModule stand-in below is the correct technique
            // for the EXECUTION half — see fjs/guest/materialize/module.f.js's
            // own header). The stored source text is otherwise irrelevant:
            // the JsModule fixture below is what actually runs.
            const [state6, programHash] = seedText(state5)(
                'export const report = ctx => args => ctx.pure("unused")')

            /**
             * Sums every PRESENT box1InterestIncome across `subjects`,
             * skipping — never coercing to zero — a document where the key is
             * absent. Enumerates each subject's head, resolves the revision,
             * reads the snapshot, and recurses: the same evoHead ->
             * evoRevision -> casRead chain
             * `multiDocumentSumAcrossTwoStoredDocuments`
             * (fjs/server/fjs_run/module.f.js) already proves at the
             * executeRun layer, extended here to actually skip an absent
             * field rather than assuming every document has one.
             * @type {(subjects: readonly string[]) => (acc: bigint) => Effect<CasOp, string>}
             */
            const sumInterestOverSubjects = subjects => acc => {
                const [subject, ...rest] = subjects
                if (subject === undefined) {
                    return guestCtx.pure(guestCtx.centsToString(acc))
                }
                return guestCtx.step(guestCtx.evoHead(subject), headsJson => {
                    const heads = /** @type {readonly string[]} */ (JSON.parse(headsJson))
                    const headHash = assertNotNullish(heads[0], ['expected at least one head', subject])
                    return guestCtx.step(guestCtx.evoRevision(headHash), revJson => {
                        const rev = /** @type {{ readonly snapshot: string }} */ (JSON.parse(revJson))
                        return guestCtx.step(guestCtx.casRead(rev.snapshot), docJson => {
                            const doc = /** @type {{ readonly box1InterestIncome?: string }} */ (JSON.parse(docJson))
                            const next = doc.box1InterestIncome === undefined
                                ? acc
                                : acc + guestCtx.centsFromString(doc.box1InterestIncome)
                            return sumInterestOverSubjects(rest)(next)
                        })
                    })
                })
            }
            /** @type {Report<string>} */
            const sumInterestReport = ctx => () => ctx.step(
                ctx.evoList('false'),
                activeJson => sumInterestOverSubjects(/** @type {readonly string[]} */ (JSON.parse(activeJson)))(0n))

            // 07-10: keyed at the FULL materialize path executeRun now
            // imports from, not the bare hash-derived name — see the
            // updated docstring above for why this fixture no longer lets
            // the fjs_run call below succeed (it collides with executeRun's
            // OWN real materialize-write at this SAME path), and why that
            // is the correct, expected consequence.
            const root = placeJsModuleFixture(state6.root)(programPath(materializeHome(home))(programHash))(() => ({ report: sumInterestReport }))
            const state7 = { ...state6, root }

            // Build the cache AFTER every document/revision/program above is
            // already in the store, so the subjects are visible from the
            // start — unlike casRefresh's own proof, which deliberately
            // builds the cache BEFORE its seed to demonstrate invisibility.
            // The session-state slot is allocated exactly as financeMcpServer
            // allocates it.
            const [state8, cacheKey] = virtual(state7)(initEvo(cas))
            const [state9, sessionKey] = virtual(state8)(create(uninitializedState))
            const handlers = financeMcpHandlers(home)(cacheKey)

            /**
             * Drives one NDJSON batch of `messages` against the composed
             * handlers over the still-threaded memory state — the same
             * technique `casRefresh.seedInvisibleUntilRefreshed` (above)
             * establishes.
             * @type {(state: State, messages: readonly unknown[]) => readonly [State, readonly Unknown[]]}
             */
            const runBatch = (state, messages) => {
                const input = messages.map(m => JSON.stringify(m)).join('\n') + '\n'
                const [nextState] = virtual({ ...state, stdout: '', stderr: '', stdin: toBytes(input) })(
                    stdioTransport(mcpStep(financeConfig)(handlers)(sessionKey)))
                return [nextState, responsesOf(nextState)]
            }

            const [state10] = runBatch(state9, [initializeRequest, initializedNotification])

            // An agent reads the dialect's own field names before authoring a
            // program against them — MCP-06's whole purpose.
            const [state11, schemaResponses] = runBatch(state10, [
                { jsonrpc: '2.0', method: 'tools/call', id: 20, params: { name: 'finance_schema', arguments: { dialect: 'vnd.fjs.1099int' } } },
            ])
            const schemaResult = asCallResult(schemaResponses[0])
            assertEq(schemaResult.result.content[0]?.type, 'text')
            assert(
                (schemaResult.result.content[0]?.text ?? '').includes('box1InterestIncome'),
                ['expected the schema response to name box1InterestIncome', schemaResult])

            // The run itself. 07-10: correctly surfaces as an error under
            // virtual now (see the docstring above) — never a dropped
            // connection, never an unhandled throw, and still persists a
            // status:'error' run record (PROV-03). The genuine success
            // path — the correct interest total, computed through a real
            // separate process and a real filesystem — is proven
            // exclusively by `fjs-run-integration.test.js`.
            const [state12, runResponses] = runBatch(state11, [
                { jsonrpc: '2.0', method: 'tools/call', id: 21, params: { name: 'fjs_run', arguments: { hash: programHash } } },
            ])
            const runResult = asCallResultWithIsError(runResponses[0])
            assertEq(runResult.result.isError, true)
            const runText = runResult.result.content[0]?.text
            assert(runText !== undefined, ['expected fjs_run to answer with text content', runResult])
            assert(
                runText.includes('invalid file'),
                ['expected the surfaced error to name the materialize-write collision (07-10)', runText])

            const runHashMatch = /run record: (\S+)\)/.exec(runText)
            assert(runHashMatch !== null, ['expected the error text to name a run record hash', runText])
            const runHash = assertNotNullish(runHashMatch[1], ['expected the run record hash capture group to be present', runText])
            const runHashVec = cBase32ToVec(runHash)
            assert(runHashVec !== null, ['expected a decodable runHash', runHash])
            const [, runRecordRead] = virtual(state12)(collectRead(cas.read(/** @type {Vec} */ (runHashVec))))
            assert(runRecordRead[0] === 'ok', ['expected the run record to read back from CAS', runRecordRead])
            const [vt, runRecord] = validateRun(JSON.parse(utf8ToString(runRecordRead[1])))
            assert(vt === 'ok', ['expected the persisted error record to validate', vt, runRecord])
            if (vt === 'ok') {
                assertEq(runRecord.status, 'error')
            }
        },
    },
}
