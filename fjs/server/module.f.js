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
export const proof = {
    // financeMcpServer is never called in integration tests because it drives
    // a real stdio server; call it here to cover its Effect-building body —
    // the stdio server *process* cannot be proof-tested directly (see
    // fjs/todo/implement-mcp-server.md).
    financeMcpServer: () => { financeMcpServer('/') },
}
