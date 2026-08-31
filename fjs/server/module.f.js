/**
 * The `finance` MCP server: our own composition root, mirroring fjs's own
 * `casMcpServer` (`functionalscript/fjs/mcp/module.f.mjs`) but with our own
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
 * ## The protocol revision is negotiated upstream, and we advertise one
 *
 * This section read "a known upstream gap, not a design choice" until 2026-08-31,
 * and told the reader not to wrap or replace `mcpStep` to work around it. **The
 * gap closed in fjs 0.47.0 and this file did not notice for four days.**
 * `mcpStep`'s `initialize` handler now calls `_negotiateVersion(supported,
 * requested)`, which echoes the client's revision when `supported` contains it
 * and answers with the latest supported one otherwise
 * (`functionalscript/fjs/protocol/mcp/module.f.mjs`). The instruction not to
 * work around it stands, for the better reason that there is nothing to work
 * around.
 *
 * {@link financeConfig} advertises **exactly one** revision, so in practice
 * every client is still told `2025-11-25` — see the note there for why that is
 * a decision rather than the old pin surviving under a new name, and
 * {@link proof} `session.negotiatesTheProtocolRevision` for the leaf that can
 * tell those two apart.
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
import { mapStep, catchStep, pureOk, step, foldStep } from 'functionalscript/fjs/effects/module.f.mjs'
import { empty, nonEmpty } from 'functionalscript/fjs/effects/list/module.f.mjs'
import { errorSummary } from 'functionalscript/fjs/effects/node/module.f.mjs'
import { create, write } from 'functionalscript/fjs/effects/memory/module.f.mjs'
import { stdioTransport } from 'functionalscript/fjs/protocol/mcp/stdio/module.f.mjs'
import { mcpStep, uninitializedState, fromRegistry, toolEntry, toolResultStep } from 'functionalscript/fjs/protocol/mcp/module.f.mjs'
import { fileCas } from 'functionalscript/fjs/cas/module.f.mjs'
import { initEvo, evo, buildCache } from 'functionalscript/fjs/cas/evo/module.f.mjs'
import { sha256 } from 'functionalscript/fjs/crypto/sha2/module.f.mjs'
import { casToolRegistry } from 'functionalscript/fjs/mcp/cas/module.f.mjs'
import { evoToolRegistry } from 'functionalscript/fjs/mcp/evo/module.f.mjs'
import { emptyState, virtual } from 'functionalscript/fjs/effects/node/virtual/module.f.mjs'
import { fromVec } from 'functionalscript/fjs/types/uint8array/module.f.mjs'
import { utf8 } from 'functionalscript/fjs/text/module.f.mjs'
import { array, open, option, or, string } from 'functionalscript/fjs/rtti/module.f.mjs'
import { validate as rttiValidate } from 'functionalscript/fjs/rtti/validate/module.f.mjs'
import { assert, assertEq, assertNotNullish } from 'functionalscript/fjs/asserts/module.f.mjs'
import { dialect as revisionDialect } from 'functionalscript/fjs/media/revision/module.f.mjs'
import { cBase32ToVec, vecToCBase32 } from 'functionalscript/fjs/basen/cbase32/module.f.mjs'
import { vec8 } from 'functionalscript/fjs/types/bit_vec/module.f.mjs'
import { unwrap } from 'functionalscript/fjs/types/result/module.f.mjs'
import { tryUtf8, utf8ToString } from 'functionalscript/fjs/text/module.f.mjs'
import { collectRead } from 'functionalscript/fjs/cas/module.f.mjs'
import { financeSchemaTool } from './finance_schema/module.f.js'
import { financeTaxParamsTool } from './finance_tax_params/module.f.js'
import { financeDocumentsListTool } from './finance_documents_list/module.f.js'
import { validatingWrites } from './write_validation/module.f.js'
import { fjsRunTool, placeJsModuleFixture } from './fjs_run/module.f.js'
import { fjsCheck } from '../guest/check/module.f.js'
import { detectFinance } from '../media/dialects/module.f.js'
import { guestCtx } from '../guest/module.f.js'
import { programPath, materializeHome } from '../guest/materialize/module.f.js'
import { validate as validateRun } from '../run/module.f.js'
import { dialect as oneZeroNineNineIntDialect, validate as validateOneZeroNineNineInt } from '../document/1099int/module.f.js'
import { parse as jsonParse, stringify as jsonText } from '../json/module.f.js'

/** @import { McpConfig, McpHandlers, ToolEntry, ToolsCallResult } from 'functionalscript/fjs/protocol/mcp/types.js' */
/** @import { Effect, Operation } from 'functionalscript/fjs/effects/types.js' */
/** @import { MemOp, Key } from 'functionalscript/fjs/effects/memory/types.js' */
/** @import { Read, Write, Mkdir, WriteFile, Import, IoChannel, NodeOp } from 'functionalscript/fjs/effects/node/types.js' */
/** @import { List } from 'functionalscript/fjs/effects/list/types.js' */
/** @import { FileCasOperation } from 'functionalscript/fjs/cas/types.js' */
/** @import { Cache } from 'functionalscript/fjs/cas/evo/types.js' */
/** @import { Cas } from 'functionalscript/fjs/cas/types.js' */
/** @import { Unknown } from 'functionalscript/fjs/media/json/types.js' */
/** @import { Result } from 'functionalscript/fjs/types/result/types.js' */
/** @import { ValidationError } from 'functionalscript/fjs/rtti/common/types.js' */
/** @import { Vec } from 'functionalscript/fjs/types/bit_vec/types.js' */
/** @import { Report, CasOp } from '../guest/module.f.js' */
/** @import { State } from 'functionalscript/fjs/effects/node/virtual/types.js' */

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
 *
 * DOC-16: after the cache rebuild/write, this ALSO re-lists and re-reads
 * every blob `cas` holds, classifies each via `fjs/media/dialects`'
 * `detectFinance`, and reports a `{ [mimeType]: count }` map in the
 * response — this is `detect`'s one real, reachable running path (see that
 * module's own header for why: registered-but-unreachable is precisely the
 * defect Phase 16 exists to clean up). A CAS read failure is skipped
 * silently, mirroring `financeDocumentsListTool`'s own defensive skip for a
 * bad read; per T-15-12 this second full-store pass is accepted as
 * consistent with `buildCache`'s own already-full-rescan contract, not a
 * new cost `cas_refresh` introduces.
 *
 * **BREAKING response-shape change from the pre-Phase-15 bare-string
 * form.** `cas_refresh` used to answer the literal string `'refreshed'`; it
 * now answers `{ status: 'refreshed', dialectCounts }`. Named explicitly
 * here as a boundary, the same way `fjs/schedule/d`'s own docstring names
 * Decision 2.5 rather than leaving it implicit — this is a real,
 * backward-incompatible change to an already-shipped MCP tool contract
 * (every in-repo caller was updated in this same commit, so nothing here is
 * broken, but a client written against the OLD bare-string form would
 * break silently), not an additive widening.
 * @type {<O extends Operation>(cas: Cas<O>) => (cacheKey: Key<Cache>) => ToolEntry<O | MemOp>}
 */
export const casRefreshTool = cas => cacheKey => toolEntry(
    'cas_refresh',
    'Rescans the CAS store and replaces the in-memory Evo subject/head cache, ' +
    'and reports a per-dialect count of every stored blob classified via ' +
    'fjs/media/dialects\' detectFinance (DOC-16). The refresh lever for ' +
    'content mutated by another process (e.g. `npx functionalscript cas ' +
    'add`) since the server started or was last refreshed; call this after ' +
    'externally adding a revision blob so evo_head/evo_list see it without ' +
    'a restart.',
    {},
    // Sequential effects, written as a chain rather than as a nest: the
    // rebuild feeds the write, the write feeds a full re-list-and-classify
    // fold over cas, and that fold's result becomes the response.
    // `mapStep(e, () => v)` is the constant form — upstream's own docstring
    // explains why no `constStep` exists.
    () => {
        const rebuilt = step(buildCache(cas), newCache => write(cacheKey, newCache))
        const counted = step(rebuilt, () => step(
            cas.list(),
            hashes => foldStep(
                pureOk(hashes),
                /** @type {{ [mimeType: string]: number }} */ ({}),
                // The per-item skip is a `catchStep`, and it has to be:
                // `foldStep` short-circuits on the first `error` since
                // 0.46.0, so a single unreadable blob would otherwise abandon
                // the whole count instead of being passed over. Only the
                // read is forgiven — a failure of `cas.list()` itself is not
                // skippable and reaches the handler's answer below.
                hash => acc => catchStep(
                    mapStep(
                        collectRead(cas.read(hash)),
                        blob => {
                            const mimeType = detectFinance(blob).mime_type
                            return { ...acc, [mimeType]: (acc[mimeType] ?? 0) + 1 }
                        },
                    ),
                    () => pureOk(acc),
                ),
            ),
        ))
        // An MCP handler answers `never`, and that is the claim upstream says
        // it is: a refresh that could not read the store becomes a JSON-RPC
        // error response rather than a failure the transport has to carry.
        // `toolResultStep` (MAINT-11) states both renderers in one call, which
        // is what deleted the `mapStep`/`catchStep` pair that stood here.
        return toolResultStep(
            counted,
            dialectCounts => jsonText({ status: 'refreshed', dialectCounts }),
            e => `cas_refresh failed: ${errorSummary(e)}`)
    },
)

// ── fjs_check (MCP-09) ────────────────────────────────────────────────────────
/**
 * The `fjs_check` MCP tool (MCP-09): a cheap, honest sanity check that a
 * stored program (by CAS hash) imports cleanly and exports something that
 * looks like a report — never a run. **This tool has NO security value.**
 * It confirms a shape; it is not a sandbox, a verification, or a trust
 * boundary, and the program's top-level code has already run (via
 * `import()`) by the time this answers — exactly the same exposure a real
 * `fjs_run` call carries. See `fjs/guest/check/module.f.js`'s own module
 * header (place 2 of the "no security value" statement's three required
 * places is this tool's own description below; place 3 is README.md) for
 * the full account of what `fjsCheck` does and does not guarantee.
 * @type {(materializeHomeRoot: string) => (cas: Cas<FileCasOperation>) => ToolEntry<FileCasOperation | Mkdir | WriteFile | Import>}
 */
export const fjsCheckTool = materializeHomeRoot => cas => toolEntry(
    'fjs_check',
    'Smoke-checks a stored program (by CAS hash): imports it and reports whether it ' +
    'exports a callable report, without running it to completion. This tool has NO ' +
    'security value — it confirms a shape, never a sandbox, verification, or trust ' +
    'boundary, and the program\'s top-level code has already run by the time this ' +
    'answers. Use fjs_run to actually execute a program.',
    { hash: string },
    args => {
        return toolResultStep(fjsCheck(materializeHomeRoot)(cas)(args.hash), jsonText, message => message)
    },
)

// ── Handlers ────────────────────────────────────────────────────────────────────
/**
 * MCP handlers for `FileCas` (`casToolRegistry`) plus the Evo API
 * (`evoToolRegistry`) layered on it, plus `casRefreshTool` (DOC-14),
 * `financeSchemaTool` (MCP-06), `financeTaxParamsTool` (MCP-07),
 * `financeDocumentsListTool` (MCP-08), `fjsRunTool` (EXEC-08/EXEC-10/
 * EXEC-11/PROV-03), and `fjsCheckTool` (MCP-09), bound to `home` and an
 * already-built Evo cache slot (see `initEvo`). `financeSchemaTool`,
 * `financeTaxParamsTool`, `financeDocumentsListTool`, `fjsRunTool`, and
 * `fjsCheckTool` concatenate straight into the same flat array
 * `casRefreshTool` already established the pattern for — no separate
 * composition mechanism, per this file's own precedent.
 * @type {(home: string) => (cacheKey: Key<Cache>) => McpHandlers<FileCasOperation | MemOp | Mkdir | WriteFile | Import>}
 */
export const financeMcpHandlers = home => cacheKey => fromRegistry([
    ...validatingWrites(casToolRegistry(home)(cacheKey)),
    ...evoToolRegistry(evo(fileCas(sha256)(home))(cacheKey)),
    casRefreshTool(fileCas(sha256)(home))(cacheKey),
    financeSchemaTool,
    financeTaxParamsTool,
    financeDocumentsListTool(evo(fileCas(sha256)(home))(cacheKey))(fileCas(sha256)(home)),
    fjsRunTool(home)(fileCas(sha256)(home))(evo(fileCas(sha256)(home))(cacheKey)),
    fjsCheckTool(home)(fileCas(sha256)(home)),
])

// ── Session configuration ───────────────────────────────────────────────────────
/**
 * Static MCP configuration for the `finance` server: advertises the `tools`
 * capability, identifies as our own server (never fjs's own CAS server
 * identity), and pins the protocol version to `2025-11-25` per MCP-03.
 *
 * **`version` must equal `package.json`'s.** It is a literal because this is a
 * pure module — there is no filesystem here to read the manifest from — so the
 * two can drift, and a server advertising a version it is not is worse than
 * one advertising none. `fjs-run-integration.test.js` reads the real manifest
 * and asserts the advertised value against it, which is the only place that
 * comparison can be made; bump both together.
 * @type {McpConfig}
 */
export const financeConfig = {
    serverInfo: { name: 'finance-mcp', version: '1.0.0' },
    capabilities: { tools: {} },
    // ONE revision, now that 0.47.0's `_negotiateVersion` means the list could
    // hold several. The software is not published, so there is no client on an
    // older revision to serve and a second entry would advertise a compatibility
    // this project has never had to keep. Adding one is cheap and reversible;
    // claiming support for a revision nothing is tested against is not.
    protocolVersions: ['2025-11-25'],
}

// ── Server ──────────────────────────────────────────────────────────────────────
/**
 * Runs the `finance` MCP server over stdio: scans `home` once to build the
 * Evo subject/head cache (`initEvo`), allocates the session-state slot,
 * builds the `mcpStep` for the composed tool registry, and drives the
 * read → parse → dispatch → write loop until stdin EOF. Mirrors fjs's own
 * `casMcpServer` exactly, substituting `financeConfig`/`financeMcpHandlers`
 * for `casConfig`/`casMcpHandlers`.
 * @type {(home: string) => Effect<Read | Write | MemOp | FileCasOperation | Mkdir | WriteFile | Import, void, IoChannel>}
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
 * A single-chunk `cas.write` payload. **The annotation is load-bearing**:
 * `nonEmpty`/`empty` are generic in their operation set, and without a
 * contextual type the write's op-set widens to the whole `Operation`
 * universe and `virtual` will not accept it.
 * @type {(bytes: Vec) => List<never, Vec, IoChannel>}
 */
const oneChunk = bytes => nonEmpty(bytes, empty())

/**
 * `virtual`, with the effect's error channel discharged by a panic — fixture
 * setup a proof has no answer to. `unwrap` throws a BARE value, as `assert`
 * does. Sites that ASSERT on the outcome keep plain `virtual`.
 * @type {(state: State) => <O extends NodeOp, T, E>(e: Effect<O, T, E>) => readonly [State, T]}
 */
const virtualOrPanic = state => e => {
    const [next, r] = virtual(state)(e)
    return [next, unwrap(r)]
}
/**
 * UTF-8 bytes of `s` as a plain array — the virtual stdin byte stream, same
 * helper `fjs/protocol/mcp/stdio/proof.f.js` and `fjs/mcp/proof.f.js` use.
 * @type {(s: string) => readonly number[]}
 */
const toBytes = s => [...fromVec(utf8(s))]

/**
 * The `protocolVersion` the simulated client asks for in `initialize` —
 * deliberately **not** one `financeConfig` advertises. Against the shipped
 * single-entry list `_negotiateVersion` therefore counter-proposes
 * `2025-11-25`, which is what the rest of `proof.session` reads.
 *
 * That is also why this constant cannot demonstrate negotiation: with one
 * advertised revision the counter-proposal equals the old unconditional pin,
 * so the answer is the same either way. `negotiatesTheProtocolRevision` builds
 * its own two-entry config for that.
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
 * **The served tool set, hand-typed — the independent side of a comparison,
 * not documentation.**
 *
 * `financeMcpHandlers` composes this set from two upstream registries plus six
 * individual tools, so no single line of this file states what the server
 * actually serves. This list does, and
 * {@link toolsListIsExactlyTheHandTypedToolSet} compares the two.
 *
 * ## Why a set and not a count
 *
 * The tool count is the project's most load-bearing invariant.
 * `.planning/REQUIREMENTS.md` permanently forbids a `finance_compute_1040`
 * tool — the whole architecture exists so the agent AUTHORS a program rather
 * than calling one — and `.planning/CAPABILITIES.md` states the count has not
 * moved through twelve phases. **Nothing enforced either claim.**
 * `toolsListEnumeratesComposedRegistry` below asserts `tools.length > 0` and
 * names six of the thirteen, so adding a fourteenth tool — including the
 * forbidden one — left the whole suite green.
 *
 * A hand-typed COUNT would not have been enough either, and this repo has the
 * receipts: `fjs/server/dialect_parity`'s own header records two
 * twenty-three-entry registries that were not the same twenty-three, each
 * carrying a count that could only see its own list. **A total cannot see a
 * swap.** So the leaf below checks containment in BOTH directions and the
 * length against {@link expectedServedToolCount}, which is a second
 * hand-typed statement rather than `everyServedToolHandTyped.length` — two
 * independent claims that have to agree.
 */
/** @type {readonly string[]} */
export const everyServedToolHandTyped = ([
    'cas_add', 'cas_get', 'cas_list', 'cas_refresh',
    'evo_add', 'evo_list', 'evo_head', 'evo_revision',
    'finance_schema', 'finance_tax_params', 'finance_documents_list',
    'fjs_run', 'fjs_check',
])

/**
 * Hand-typed independently of {@link everyServedToolHandTyped}'s contents, so
 * a name added to that list alone reddens rather than passing quietly.
 * Thirteen since Phase 21; **a change here needs a reason in REQUIREMENTS.md,
 * not just a passing suite.**
 */
export const expectedServedToolCount = 13

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
 * **Parsing goes through `fjs/json`'s total `parse`** (imported above as
 * `jsonParse`), not the host's `JSON.parse`. It returns
 * `Result<Unknown, string>` rather than throwing a `SyntaxError`, which is
 * what makes it usable here at all: a `.f.js` module has no `try`
 * (AGENTS.md §Testing).
 *
 * This paragraph read the opposite until 2026-08-17 — it said `JSON.parse`
 * was used directly because upstream's `parse` was an alias for it at fjs
 * 0.41.0, and named functionalscript#1430 as the fix to wait for. **The fix
 * landed in 0.43.1, the import above was migrated, and the comment was
 * not.** It also cited `fjs/todo/upstream-json-parse-split.md`, retired and
 * deleted in `c1441e1` for the same reason. A comment stating the opposite
 * of the line beneath it survives every test in the suite; only reading the
 * import catches it.
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
 * **Each schema below states `open`, and that is now load-bearing.** Every one
 * names only what its own leaf reads, so a full JSON-RPC envelope has to
 * validate against a partial schema. Until `functionalscript` 0.47.0 that came
 * free — this paragraph read "rtti permits properties a schema does not mention
 * — verified", and it did. 0.47.0 reverses the default: a bare struct is closed,
 * so every one of these would have started rejecting the very responses it was
 * written to read. `open` is what the old sentence was relying on, said out loud.
 *
 * The nesting is not decoration either. `open` states the rest of ONE container,
 * so `result` and each element of `tools`/`content` need their own — the eight
 * proofs in `proof.session` and `proof.casRefresh` failed at exactly those paths
 * (`['result','serverInfo']`, `['result','tools','0']`) until they had it.
 * @type {<T>(validator: (value: Unknown) => Result<T, ValidationError>) => (value: Unknown | undefined) => T}
 */
const decoder = validator => value => {
    assert(value !== undefined, 'expected a JSON-RPC response, got none')
    const [t, v] = validator(value)
    assert(t !== 'error', ['unexpected JSON-RPC response shape', v])
    return v
}

/** Every response carries this, whatever else it carries. */
const envelopeSchema = open({ jsonrpc: string })

/** What `initializeIgnoresRequestedProtocolVersion` reads. */
const initResultSchema = open({
    result: open({ protocolVersion: string, serverInfo: open({ name: string }) }),
})

/** What `toolsListEnumeratesComposedRegistry` reads. */
const toolsListResultSchema = open({
    result: open({ tools: array(open({ name: string })) }),
})

/** What the `tools/call` leaves read, here and in the DOC-14 proof below. */
const callResultSchema = open({
    result: open({ content: array(open({ type: string, text: string })) }),
})

/** What `weekOneConvergence`'s `fjs_run` leaf reads — same as {@link callResultSchema} plus the optional `isError` flag a failed tool call carries. */
const callResultWithIsErrorSchema = open({
    result: open({ content: array(open({ type: string, text: string })), isError: or(option, true) }),
})

/**
 * A two-entry `McpConfig`, built here and shipped nowhere.
 *
 * {@link financeConfig} advertises one revision, and with one entry
 * `_negotiateVersion` returns that entry for every request — the same answer
 * the unconditional pin it replaced gave. A list whose answer can differ from
 * its latest is the only thing that tells the two apart, so the proof builds
 * one rather than widening what the server advertises (see the note beside
 * `financeConfig` for why that stays at one).
 *
 * `2025-06-18` is a real MCP revision and is deliberately NOT first: the
 * decisive case asks for it by name, and a server that pinned instead of
 * negotiating would answer `2025-11-25`.
 * @type {McpConfig}
 */
const twoRevisionConfig = {
    ...financeConfig,
    protocolVersions: ['2025-11-25', '2025-06-18'],
}

/**
 * The revision `initialize` answers with, for an advertised list and a client
 * request. Drives the real `mcpStep` over the virtual interpreter rather than
 * calling `_negotiateVersion` — that function is upstream's and not exported,
 * and reading it directly would prove something about a reimplementation of
 * the handler instead of about the handler.
 * @type {(config: McpConfig) => (requested: string) => string}
 */
const negotiatedWith = config => requested => {
    const server = step(
        initEvo(fileCas(sha256)('/')),
        cacheKey => step(
            create(uninitializedState),
            sessionKey => stdioTransport(mcpStep(config)(financeMcpHandlers('/')(cacheKey))(sessionKey)),
        ),
    )
    const request = {
        ...initializeRequest,
        params: { ...initializeRequest.params, protocolVersion: requested },
    }
    const [state] = virtual({ ...emptyState, stdin: toBytes(JSON.stringify(request) + '\n') })(server)
    const [initResponse] = responsesOf(state)
    return asInitResult(initResponse).result.protocolVersion
}

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
    // virtual Node interpreter. A virtual harness proves the pieces speak
    // correctly to each other; it cannot prove a real client will call a tool
    // — that is Plan 03's job.
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
        // The session answers with our own server identity, and — against the
        // shipped single-entry list — with `2025-11-25` whatever was asked.
        // This leaf was named `initializeIgnoresRequestedProtocolVersion` and
        // read as proof that `mcpStep` never inspected the request. **It was
        // never that proof.** With one advertised revision the counter-proposal
        // equals the unconditional pin, so the assertion survived the exact
        // change it was written to detect — 0.47.0 added negotiation and this
        // leaf stayed green without being touched. It now says only what it can
        // see; `negotiatesTheProtocolRevision` is where the behaviour is shown.
        initializeAnswersWithOurIdentityAndAdvertisedRevision: () => {
            const [initResponse] = responsesOf(runSession())
            const init = asInitResult(initResponse)
            assertEq(init.result.protocolVersion, '2025-11-25')
            assertEq(init.result.serverInfo.name, 'finance-mcp')
        },
        // DOC-25. The dialect check is on the WRITE PATH, not merely in a
        // helper: this drives the real `cas_add` tool through the composed
        // registry and the stdio transport, with a malformed `vnd.fjs.w2`
        // written out by hand — no producer, because every producer already
        // calls `validate` and routing through one would test the convention
        // instead of the invariant. `cas_list` is read back to show the
        // refusal was BEFORE the store, not after it.
        casAddRefusesAMalformedDocumentAndStoresNothing: () => {
            const malformed = JSON.stringify({
                dialect: 'vnd.fjs.w2',
                employerEIN: '12-3456789',
                employeeSSN: '123-45-6789',
                controlNumber: 'ctl-0001',
                taxYear: 2025,
                formRevision: '2025',
                // Money carries three decimals — the dialect's own semantic check.
                box1WagesTipsOtherCompensation: '12.345',
            })
            const messages = [
                initializeRequest,
                initializedNotification,
                { jsonrpc: '2.0', method: 'tools/call', id: 20, params: { name: 'cas_add', arguments: { content: malformed } } },
                { jsonrpc: '2.0', method: 'tools/call', id: 21, params: { name: 'cas_list', arguments: {} } },
            ]
            const input = messages.map(m => JSON.stringify(m)).join('\n') + '\n'
            const [state] = virtual({ ...emptyState, stdin: toBytes(input) })(financeMcpServer('/'))
            const [, addResponse, listResponse] = responsesOf(state)
            const add = asCallResultWithIsError(addResponse)
            assertEq(add.result.isError, true)
            const text = assertNotNullish(add.result.content[0], ['expected a content item', add]).text
            assert(text.includes('vnd.fjs.w2'), ['the refusal must name the dialect', text])
            assert(text.includes('Nothing was stored'), [text])
            // Nothing reached the store: an empty listing is the whole point,
            // since a refusal AFTER the write would leave the hash listed.
            assertEq(asCallResult(listResponse).result.content[0]?.text, '')
        },
        // The same call with the money corrected stores — so the leaf above
        // proves a refusal, not a `cas_add` that is broken for everything.
        casAddStoresAWellFormedDocument: () => {
            const wellFormed = JSON.stringify({
                dialect: 'vnd.fjs.w2',
                employerEIN: '12-3456789',
                employeeSSN: '123-45-6789',
                controlNumber: 'ctl-0001',
                taxYear: 2025,
                formRevision: '2025',
                box1WagesTipsOtherCompensation: '50000.00',
            })
            const messages = [
                initializeRequest,
                initializedNotification,
                { jsonrpc: '2.0', method: 'tools/call', id: 22, params: { name: 'cas_add', arguments: { content: wellFormed } } },
            ]
            const input = messages.map(m => JSON.stringify(m)).join('\n') + '\n'
            const [state] = virtual({ ...emptyState, stdin: toBytes(input) })(financeMcpServer('/'))
            const [, addResponse] = responsesOf(state)
            const add = asCallResultWithIsError(addResponse)
            assertEq(add.result.isError, undefined)
            assert(assertNotNullish(add.result.content[0], ['expected a content item', add]).text.length > 0, 'expected a hash back')
        },
        // MAINT-10. The revision is NEGOTIATED, not pinned: a revision the
        // server advertises comes back as asked, and one it does not comes back
        // as the latest advertised. Row 1 is what fails under a pin.
        negotiatesTheProtocolRevision: () => {
            /** @type {readonly (readonly [string, string, string])[]} */
            const cases = [
                ['a supported NON-latest revision is echoed, not replaced by the latest',
                    '2025-06-18', '2025-06-18'],
                ['the latest is echoed when it is what was asked for',
                    '2025-11-25', '2025-11-25'],
                ['an unsupported revision is answered with the latest supported one',
                    '2024-11-05', '2025-11-25'],
            ]
            assertEq(cases.length, 3, 'echo, echo-the-latest, and counter-propose are the whole of _negotiateVersion')
            for (const [label, requested, expected] of cases) {
                assertEq(negotiatedWith(twoRevisionConfig)(requested), expected, label)
            }
        },
        // Why the leaf above needs a config of its own, stated as an assertion
        // rather than as a comment: over the SHIPPED list every request is
        // answered with the single advertised revision, so no request
        // distinguishes negotiating from pinning.
        theShippedConfigAdvertisesExactlyOneRevision: () => {
            assertEq(financeConfig.protocolVersions.length, 1)
            assertEq(financeConfig.protocolVersions[0], '2025-11-25')
            assertEq(negotiatedWith(financeConfig)('2025-06-18'), '2025-11-25')
            assertEq(negotiatedWith(financeConfig)('2025-11-25'), '2025-11-25')
        },
        // All seven registries composed: tools/list enumerates a non-empty
        // set that includes evo_list and cas_refresh (DOC-14), plus
        // finance_schema (MCP-06), finance_tax_params (MCP-07, Plan 08-04),
        // finance_documents_list (MCP-08, Plan 11-05), and fjs_run
        // (EXEC-08/EXEC-10/EXEC-11/PROV-03).
        toolsListEnumeratesComposedRegistry: () => {
            const [, listResponse] = responsesOf(runSession())
            const tools = asToolsListResult(listResponse).result.tools
            assert(tools.length > 0)
            assert(tools.some(t => t.name === 'evo_list'))
            assert(tools.some(t => t.name === 'cas_refresh'))
            assert(tools.some(t => t.name === 'finance_schema'))
            assert(tools.some(t => t.name === 'finance_tax_params'))
            assert(tools.some(t => t.name === 'finance_documents_list'))
            assert(tools.some(t => t.name === 'fjs_run'))
        },
        // **The comparison the leaf above is not.** It asserts `length > 0`
        // and names six of thirteen, so a FOURTEENTH tool — including the
        // `finance_compute_1040` that REQUIREMENTS.md permanently forbids,
        // and whose absence CAPABILITIES.md advertises as an architectural
        // guarantee — was invisible to it. Containment is checked in both
        // directions because one direction only catches a removal and the
        // other only catches an addition; a swap needs both.
        toolsListIsExactlyTheHandTypedToolSet: () => {
            const [, listResponse] = responsesOf(runSession())
            const served = asToolsListResult(listResponse).result.tools.map(t => t.name)
            assertEq(
                served.length,
                expectedServedToolCount,
                ['the served tool count moved -- REQUIREMENTS.md must say why', served],
            )
            const missing = everyServedToolHandTyped.filter(name => !served.includes(name))
            assertEq(missing.length, 0, ['a hand-typed tool is no longer served', missing])
            const unexpected = served.filter(name => !everyServedToolHandTyped.includes(name))
            assertEq(
                unexpected.length,
                0,
                ['a tool is served that the hand-typed set does not name', unexpected],
            )
        },
        theHandTypedListNamesEveryServedTool: () => {
            assertEq(
                everyServedToolHandTyped.length,
                expectedServedToolCount,
                [
                    'the hand-typed tool list and the hand-typed count disagree',
                    everyServedToolHandTyped.length,
                    expectedServedToolCount,
                ],
            )
            assertEq(
                new Set(everyServedToolHandTyped).size,
                expectedServedToolCount,
                'and it names each tool once',
            )
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
    // `evo.add`, exactly as `node_modules/functionalscript/fjs/cas/evo/proof.f.mjs`'s
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
            const [state0, cacheKey] = virtualOrPanic(emptyState)(initEvo(cas))
            // 2. Seed a revision directly into the store, bypassing evo.add,
            //    strictly AFTER the cache above was already built.
            const subject = vecToCBase32(vec8(0x77n))
            const text = `{"dialect":"${revisionDialect}","subject":"${subject}","parents":[],"snapshot":"${subject}","generation":0}`
            const bytes = tryUtf8(text)
            assert(bytes !== null, 'expected the sample revision text to encode as UTF-8')
            // A single-chunk `List<never, IoResult<Vec>>`, built directly via
            // `oneChunk` rather than a bare `nonEmpty(bytes, empty())`: those
            // two are declared `<O extends Operation, T, E>`, and calling them
            // with no usable inference context widens `O` to the bare
            // `Operation` constraint, which then fails to unify with
            // `virtual`'s `NodeOp`. The annotation on `oneChunk` supplies the
            // context. (An earlier version of this comment concluded that the
            // cons cell had to be hand-built with `pure` instead. It does not
            // — `cas.write`'s payload is a `List<O, Vec, IoChannel>` in
            // 0.46.0, whose items are bare `Vec`s, so a hand-built
            // `{ first: ok(bytes), … }` is now the wrong shape as well as the
            // long way round.)
            const [state1, w] = virtual(state0)(cas.write(oneChunk(bytes)))
            assert(w[0] === 'ok', ['expected seed write ok', w])
            const seededHash = vecToCBase32(w[1])
            // 3. The session-state slot, exactly as financeMcpServer allocates it.
            const [state2, sessionKey] = virtualOrPanic(state1)(create(uninitializedState))
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
            // `error` and no `result`. The response body is now a JSON
            // object (DOC-16's dialectCounts widening), so this leaf checks
            // the `status` field rather than the old bare-string body —
            // `dialectCounts.casRefreshReportsDialectCounts` (below) is what
            // pins the counts themselves.
            assertEq(
                JSON.parse(asCallResult(refreshResponses[0]).result.content[0]?.text ?? '{}').status,
                'refreshed')
            // AFTER cas_refresh: the same subject now resolves to the
            // seeded revision's own hash (its only, zero-parent head).
            const [, afterResponses] = runBatch(state5, [evoHeadCall(12)])
            assertEq(asCallResult(afterResponses[0]).result.content[0]?.text, seededHash)
        },
        // DOC-16: cas_refresh's dialectCounts response, over three blobs
        // seeded directly into the store (the same technique
        // seedInvisibleUntilRefreshed above uses) — one vnd.fjs.1099int
        // document, one vnd.fjs.revision blob, and one well-formed JSON
        // blob naming a dialect NONE of financeDialects registers. The
        // unregistered blob's chosen behavior (documented at
        // casRefreshTool's own module header): it falls through to
        // detectFinance's ordinary text/plain verdict and is counted under
        // that sentinel, never silently absorbed into either registered
        // dialect's own count.
        dialectCountsReportsPerDialectClassification: () => {
            const home = '/'
            const cas = fileCas(sha256)(home)
            const [state0, cacheKey] = virtualOrPanic(emptyState)(initEvo(cas))
            /**
             * Writes `text` directly into `cas` — the same seeding
             * technique `seedInvisibleUntilRefreshed` (above) uses —
             * threading `state`.
             * @type {(state: State) => (text: string) => readonly [State, string]}
             */
            const seedBlob = state => text => {
                const bytes = tryUtf8(text)
                assert(bytes !== null, ['expected the seed text to encode as UTF-8', text])
                const [nextState, w] = virtual(state)(cas.write(oneChunk(bytes)))
                assert(w[0] === 'ok', ['expected the seed write to succeed', w])
                return /** @type {const} */ ([nextState, vecToCBase32(w[1])])
            }
            const [state1] = seedBlob(state0)(JSON.stringify({
                dialect: oneZeroNineNineIntDialect,
                payerTin: '11-1111111',
                recipientTin: '222-22-2222',
                accountNumber: 'ACC-0001',
                taxYear: 2024,
                formRevision: '2024',
            }))
            const revisionSubject = vecToCBase32(vec8(0x22n))
            const [state2] = seedBlob(state1)(
                `{"dialect":"${revisionDialect}","subject":"${revisionSubject}","parents":[],"snapshot":"${revisionSubject}","generation":0}`)
            const [state3] = seedBlob(state2)(JSON.stringify({ dialect: 'vnd.fjs.not-a-real-dialect' }))
            const [state4, sessionKey] = virtualOrPanic(state3)(create(uninitializedState))
            const handlers = financeMcpHandlers(home)(cacheKey)
            /**
             * @type {(state: State, messages: readonly unknown[]) => readonly [State, readonly Unknown[]]}
             */
            const runBatch = (state, messages) => {
                const input = messages.map(m => JSON.stringify(m)).join('\n') + '\n'
                const [nextState] = virtual({ ...state, stdout: '', stderr: '', stdin: toBytes(input) })(
                    stdioTransport(mcpStep(financeConfig)(handlers)(sessionKey)))
                return [nextState, responsesOf(nextState)]
            }
            const [state5] = runBatch(state4, [initializeRequest, initializedNotification])
            const [, refreshResponses] = runBatch(state5, [
                { jsonrpc: '2.0', method: 'tools/call', id: 11, params: { name: 'cas_refresh', arguments: {} } },
            ])
            const body = JSON.parse(asCallResult(refreshResponses[0]).result.content[0]?.text ?? '{}')
            assertEq(body.status, 'refreshed')
            assertEq(body.dialectCounts['application/vnd.fjs.1099int+json'], 1)
            assertEq(body.dialectCounts['application/vnd.fjs.revision+json'], 1)
            assertEq(body.dialectCounts['text/plain'], 1)
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
             * hash — the same `cas.write(pureOk({first: ok(bytes), tail:
             * pureOk(undefined)}))` pattern `casRefresh.seedInvisibleUntilRefreshed`
             * (above) uses, factored here so the seven sequential writes below
             * (three documents, three revisions, one program) don't repeat it
             * seven times.
             * @type {(state: State) => (text: string) => readonly [State, string]}
             */
            const seedText = state => text => {
                const bytes = tryUtf8(text)
                assert(bytes !== null, ['expected seed text to encode as UTF-8', text])
                const [nextState, w] = virtual(state)(cas.write(oneChunk(bytes)))
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
             * @type {(subjects: readonly string[]) => (acc: bigint) => Effect<CasOp, string, string>}
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
            const [state8, cacheKey] = virtualOrPanic(state7)(initEvo(cas))
            const [state9, sessionKey] = virtualOrPanic(state8)(create(uninitializedState))
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
                { jsonrpc: '2.0', method: 'tools/call', id: 21, params: { name: 'fjs_run', arguments: { hash: programHash, taxYear: 2025 } } },
            ])
            const runResult = asCallResultWithIsError(runResponses[0])
            assertEq(runResult.result.isError, true)
            const runText = runResult.result.content[0]?.text
            assert(runText !== undefined, ['expected fjs_run to answer with text content', runResult])
            // `materialize failed:` is this project's own words for the step,
            // not the host's — see `fjs/guest/materialize`'s convention
            // docstring. It replaced `invalid file`, which was `virtual`'s
            // `writeFile` message reaching a protocol client verbatim through
            // `errorMessage`; on a real filesystem that same slot carries the
            // absolute path. The prefix is what keeps this leaf able to name
            // WHICH of executeRun's five steps surfaced now that the host's
            // own text is gone, since `errorSummary` alone renders `io error`
            // under `virtual` (whose `fail` attaches no OS code).
            assert(
                runText.includes('materialize failed'),
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
    // Two of the served tools reach the store, and each wraps its whole
    // effect in a `catchStep` so a store that cannot be read becomes a
    // JSON-RPC error RESULT — `isError: true`, with a text item naming the
    // failure — rather than a failure the transport has to carry, which
    // would drop the connection and leave the agent nothing to report.
    // Neither `catchStep` had ever been entered by a proof: every leaf
    // above drives these tools against a store that works.
    //
    // Both rows call the tool entry's own `handle` directly. Going through
    // the transport would prove the same thing with three layers in the
    // way, and the claim here is about the handler's answer.
    storeFailuresBecomeErrorResultsNotTransportFailures: () => {
        // The cache is built against a store that WORKS, so the refresh row
        // below fails at its own `cas.list()` rather than at the rebuild.
        const [seeded, cacheKey] = virtualOrPanic(emptyState)(initEvo(fileCas(sha256)('/good')))
        // `.cas` present but not a directory. `fileCas.list` forgives a
        // MISSING store — a fresh one has none — and refuses an unreadable
        // one, and it is the second that this row is about.
        const unreadable = { ...seeded, root: { ...seeded.root, blocked: { '.cas': [] } } }
        /** @type {readonly (readonly [string, () => ToolsCallResult, string])[]} */
        const cases = [
            ['cas_refresh over a store whose .cas cannot be read',
                () => virtualOrPanic(unreadable)(casRefreshTool(fileCas(sha256)('/blocked'))(cacheKey).handle({}))[1],
                'cas_refresh failed'],
            // A legal cBase32 address with nothing stored behind it.
            ['fjs_check on a hash with no program behind it',
                () => virtualOrPanic(emptyState)(fjsCheckTool('/check')(fileCas(sha256)('/check')).handle({ hash: 'aaaaaaaa' }))[1],
                'program not found'],
        ]
        assertEq(cases.length, 2, 'the two served tools whose store access can fail')
        for (const [label, call, fragment] of cases) {
            const result = call()
            assertEq(result.isError, true, label)
            const first = assertNotNullish(result.content[0], [label, result])
            assert(first.type === 'text', [label, result])
            assert(first.text.includes(fragment), [label, first.text])
        }
    },
}
