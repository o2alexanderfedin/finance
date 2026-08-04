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
 * ## Registry composition — no third registry yet
 *
 * `financeMcpHandlers` composes exactly `casToolRegistry` + `evoToolRegistry`,
 * identical to fjs's own `casMcpHandlers`. Phase 6/7's `fjs_run` tool will be
 * a third registry concatenated into this same array; that seam is left as
 * this comment, not as code, because building it now would be out of scope
 * for this plan (see `fjs/todo/implement-mcp-server.md`).
 *
 * @module
 */
import { step } from 'functionalscript/fjs/effects/module.f.js'
import { create } from 'functionalscript/fjs/effects/memory/module.f.js'
import { stdioTransport } from 'functionalscript/fjs/protocol/mcp/stdio/module.f.js'
import { mcpStep, uninitializedState, fromRegistry } from 'functionalscript/fjs/protocol/mcp/module.f.js'
import { fileCas } from 'functionalscript/fjs/cas/module.f.js'
import { initEvo, evo } from 'functionalscript/fjs/cas/evo/module.f.js'
import { sha256 } from 'functionalscript/fjs/crypto/sha2/module.f.js'
import { casToolRegistry } from 'functionalscript/fjs/mcp/cas/module.f.js'
import { evoToolRegistry } from 'functionalscript/fjs/mcp/evo/module.f.js'
import { emptyState, virtual } from 'functionalscript/fjs/effects/node/virtual/module.f.js'
import { fromVec } from 'functionalscript/fjs/types/uint8array/module.f.js'
import { utf8 } from 'functionalscript/fjs/text/module.f.js'
import { assert, assertEq } from 'functionalscript/fjs/asserts/module.f.js'

/** @import { McpConfig, McpHandlers } from 'functionalscript/fjs/protocol/mcp/module.f.js' */
/** @import { Effect } from 'functionalscript/fjs/effects/module.f.js' */
/** @import { MemOp, Key } from 'functionalscript/fjs/effects/memory/module.f.js' */
/** @import { Read, Write } from 'functionalscript/fjs/effects/node/module.f.js' */
/** @import { FileCasOperation } from 'functionalscript/fjs/cas/module.f.js' */
/** @import { Cache } from 'functionalscript/fjs/cas/evo/module.f.js' */

// ── Handlers ────────────────────────────────────────────────────────────────────
/**
 * MCP handlers for `FileCas` (`casToolRegistry`) plus the Evo API
 * (`evoToolRegistry`) layered on it, bound to `home` and an already-built Evo
 * cache slot (see `initEvo`). Identical composition to fjs's own
 * `casMcpHandlers` — no third registry is concatenated here; that is Phase
 * 6/7's `fjs_run` seam.
 * @type {(home: string) => (cacheKey: Key<Cache>) => McpHandlers<FileCasOperation | MemOp>}
 */
export const financeMcpHandlers = home => cacheKey => fromRegistry([
    ...casToolRegistry(home)(cacheKey),
    ...evoToolRegistry(evo(fileCas(sha256)(home))(cacheKey)),
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
        // that includes evo_list.
        toolsListEnumeratesComposedRegistry: () => {
            const [, listResponse] = responsesOf(runSession())
            const tools = listResponse.result.tools
            assert(tools.length > 0)
            assert(tools.some((/** @type {any} */ t) => t.name === 'evo_list'))
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
}
