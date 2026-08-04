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
 * ## Registry composition — a small local third registry, and a larger one still to come
 *
 * `financeMcpHandlers` composes `casToolRegistry` + `evoToolRegistry` +
 * `casRefreshTool` (DOC-14's `cas_refresh` — see below). Phase 6/7's
 * `fjs_run` tool will be a further, larger registry concatenated into this
 * same array; that seam is still left as a comment, not as code, because
 * building it now would be out of scope for this plan (see
 * `fjs/todo/implement-mcp-server.md`).
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
import { pure, step } from 'functionalscript/fjs/effects/module.f.js'
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
import { assert, assertEq } from 'functionalscript/fjs/asserts/module.f.js'
import { dialect as revisionDialect } from 'functionalscript/fjs/media/revision/module.f.js'
import { vecToCBase32 } from 'functionalscript/fjs/basen/cbase32/module.f.js'
import { vec8 } from 'functionalscript/fjs/types/bit_vec/module.f.js'
import { ok } from 'functionalscript/fjs/types/result/module.f.js'
import { tryUtf8 } from 'functionalscript/fjs/text/module.f.js'

/** @import { McpConfig, McpHandlers, ToolEntry } from 'functionalscript/fjs/protocol/mcp/module.f.js' */
/** @import { Effect, Operation } from 'functionalscript/fjs/effects/module.f.js' */
/** @import { MemOp, Key } from 'functionalscript/fjs/effects/memory/module.f.js' */
/** @import { Read, Write } from 'functionalscript/fjs/effects/node/module.f.js' */
/** @import { FileCasOperation } from 'functionalscript/fjs/cas/module.f.js' */
/** @import { Cache } from 'functionalscript/fjs/cas/evo/module.f.js' */
/** @import { Cas } from 'functionalscript/fjs/cas/module.f.js' */

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
    () => step(buildCache(cas), newCache => step(write(cacheKey, newCache), () => pure(okResult('refreshed')))),
)

// ── Handlers ────────────────────────────────────────────────────────────────────
/**
 * MCP handlers for `FileCas` (`casToolRegistry`) plus the Evo API
 * (`evoToolRegistry`) layered on it, plus `casRefreshTool` (DOC-14), bound to
 * `home` and an already-built Evo cache slot (see `initEvo`).
 * @type {(home: string) => (cacheKey: Key<Cache>) => McpHandlers<FileCasOperation | MemOp>}
 */
export const financeMcpHandlers = home => cacheKey => fromRegistry([
    ...casToolRegistry(home)(cacheKey),
    ...evoToolRegistry(evo(fileCas(sha256)(home))(cacheKey)),
    casRefreshTool(fileCas(sha256)(home))(cacheKey),
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
 * @type {(home: string) => Effect<Read | Write | MemOp | FileCasOperation, void>}
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
 * @type {() => import('functionalscript/fjs/effects/node/virtual/module.f.js').State}
 */
const runSession = () => {
    const input = [initializeRequest, initializedNotification, toolsListRequest, toolsCallRequest]
        .map(m => JSON.stringify(m))
        .join('\n') + '\n'
    const [state] = virtual({ ...emptyState, stdin: toBytes(input) })(financeMcpServer('/'))
    return state
}

/**
 * Non-empty stdout lines from a session `State`, parsed as JSON-RPC. Typed
 * `any` deliberately: these are raw decoded JSON-RPC envelopes, not values
 * carried through fjs's own typed effect system.
 * @type {(state: import('functionalscript/fjs/effects/node/virtual/module.f.js').State) => any[]}
 */
const responsesOf = state => state.stdout.split('\n').filter((/** @type {string} */ line) => line !== '').map((/** @type {string} */ line) => JSON.parse(line))

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
                assertEq(r.jsonrpc, '2.0')
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
            assertEq(initResponse.result.protocolVersion, '2025-11-25')
            assertEq(initResponse.result.serverInfo.name, 'finance-mcp')
        },
        // Both registries composed: tools/list enumerates a non-empty set
        // that includes evo_list and cas_refresh (DOC-14).
        toolsListEnumeratesComposedRegistry: () => {
            const [, listResponse] = responsesOf(runSession())
            const tools = listResponse.result.tools
            assert(tools.length > 0)
            assert(tools.some((/** @type {any} */ t) => t.name === 'evo_list'))
            assert(tools.some((/** @type {any} */ t) => t.name === 'cas_refresh'))
        },
        // A real registered handler answers tools/call — a green tools/call,
        // not merely a green tools/list (the documented silent-failure mode
        // this proof and Plan 03's live check both target).
        toolsCallReachesRealHandler: () => {
            const [, , callResponse] = responsesOf(runSession())
            assert(!('error' in callResponse))
            assertEq(callResponse.result.content[0].type, 'text')
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
             * @type {(state: import('functionalscript/fjs/effects/node/virtual/module.f.js').State, messages: readonly unknown[]) => readonly [import('functionalscript/fjs/effects/node/virtual/module.f.js').State, any[]]}
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
            assertEq(beforeResponses[0].result.content[0].text, '')
            const [state5, refreshResponses] = runBatch(state4, [{ jsonrpc: '2.0', method: 'tools/call', id: 11, params: { name: 'cas_refresh', arguments: {} } }])
            assert(!('error' in refreshResponses[0]))
            // AFTER cas_refresh: the same subject now resolves to the
            // seeded revision's own hash (its only, zero-parent head).
            const [, afterResponses] = runBatch(state5, [evoHeadCall(12)])
            assertEq(afterResponses[0].result.content[0].text, seededHash)
        },
    },
}
