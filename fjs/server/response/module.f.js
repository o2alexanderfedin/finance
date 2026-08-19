/**
 * EXEC-11 — the size-guarded response envelope: decides whether a tool
 * result's text can be inlined as-is, truncated to a short preview, or must
 * be replaced entirely by a pointer to where the full result actually lives.
 *
 * ## Two thresholds, not one, and why
 *
 * `functionalscript/fjs/protocol/mcp/stdio/module.f.mjs`'s `writeResponse`
 * enforces exactly one limit: `fjs/types/bigint`'s `maxLength` (`0x100000n`
 * bits = 131,072 bytes = 128 KiB), the size of one encoded JSON-RPC line.
 * Overflowing it is not reported to the caller as a size problem — it
 * degrades silently to a generic `-32603` internal-error fallback (traced in
 * that module's own header comment; reproduced directly, as a contrast, in
 * this module's own proof below).
 *
 * A single threshold set at that same 128 KiB cap would leave no headroom:
 * the cap bounds the WHOLE encoded JSON-RPC line, envelope and all
 * (`jsonrpc`, `id`, `result.content[...]` framing), not just this module's
 * own text. A result sized right up to the cap could still overflow once
 * wrapped, landing right back in the silent `-32603` this module exists to
 * prevent. 07-CONTEXT.md's decision is therefore two named constants, both
 * well clear of the cap: {@link previewBytes} (8 KiB) bounds what is safe to
 * inline in full, and {@link guardBytes} (64 KiB) bounds what is safe to
 * inline as a truncated preview — both roughly half, and a quarter, of the
 * 128 KiB line cap, leaving generous headroom for the envelope around
 * whichever one applies.
 *
 * ## The check runs BEFORE the transport, not instead of catching its error
 *
 * `sizeGuard` is pure and knows nothing about `writeResponse` or stdio at
 * all — it is called by a tool handler on a result's text, and only the
 * ALREADY-SIZED `{ preview, truncated }` it returns is ever wrapped in a
 * response and hand off to the transport. This module's own proof (in the
 * `orderingProof` leaf below) demonstrates that ordering empirically: it
 * asserts the oversized raw content is ABSENT from the virtual session's
 * `stdout`, not merely that the short message is present — the same lesson
 * STATE.md already recorded once for SEC-02-before-`import_` (Phase 6): a
 * "which message came back" proof cannot distinguish "checked before
 * constructing the response" from "constructed the response and got lucky
 * that it still fit".
 *
 * ## Byte length, not `.length`
 *
 * A result's size is measured on its UTF-8 ENCODING
 * (`fjs/text`'s `tryUtf8`), matching how `writeResponse` itself measures the
 * 128 KiB cap (`fjs/types/bit_vec`'s bit-vector `length`, divided by 8) —
 * `content.length` counts UTF-16 code units, which under-counts every
 * character outside the Basic Multilingual Plane and would let a
 * (technically short) string sneak past a threshold meant to bound bytes.
 *
 * ## Parameterized on its thresholds — no real 128 KiB payload in this proof
 *
 * `sizeGuard` takes `guardBytes`/`previewBytes` as its own first two curried
 * parameters (never reads the module's own {@link guardBytes}/
 * {@link previewBytes} constants directly), so its three size bands can be
 * exercised with tiny values (a handful of bytes) at negligible cost. A
 * SEPARATE, trivial proof pins the shipped constants themselves (8192 /
 * 65536) so the parameterized logic proof can never silently drift from what
 * is actually deployed.
 *
 * @module
 */
import { tryUtf8, utf8, utf8ToString } from 'functionalscript/fjs/text/module.f.mjs'
import { length as bitLength, maxLengthBytes, msb, u8List, u8ListToVec } from 'functionalscript/fjs/types/bit_vec/module.f.mjs'
import { take } from 'functionalscript/fjs/types/list/module.f.mjs'
import { assert, assertEq } from 'functionalscript/fjs/asserts/module.f.mjs'
import { fromVec } from 'functionalscript/fjs/types/uint8array/module.f.mjs'
import { pureOk } from 'functionalscript/fjs/effects/module.f.mjs'
import { create } from 'functionalscript/fjs/effects/memory/module.f.mjs'
import { emptyState, virtual } from 'functionalscript/fjs/effects/node/virtual/module.f.mjs'
import { fromRegistry, mcpStep, okResult, toolEntry, uninitializedState } from 'functionalscript/fjs/protocol/mcp/module.f.mjs'
import { stdioTransport } from 'functionalscript/fjs/protocol/mcp/stdio/module.f.mjs'
import { internalError, jsonrpc } from 'functionalscript/fjs/protocol/json_rpc/module.f.mjs'
import { parse as jsonParse } from '../../json/module.f.js'
import { unwrap } from 'functionalscript/fjs/types/result/module.f.mjs'

/** @import { Vec } from 'functionalscript/fjs/types/bit_vec/types.js' */
/** @import { McpConfig, ToolEntry } from 'functionalscript/fjs/protocol/mcp/types.js' */
/** @import { State } from 'functionalscript/fjs/effects/node/virtual/types.js' */

/**
 * The inline-preview threshold (8 KiB, in bytes): a result whose UTF-8
 * encoding is at most this many bytes is returned in full, untruncated. Well
 * clear of the 128 KiB stdio line cap (`fjs/types/bigint`'s
 * `maxLength = 0x100000n` bits) — see the module header.
 * @type {number}
 */
export const previewBytes = 8192

/**
 * The total-response guard (64 KiB, in bytes): a result whose UTF-8 encoding
 * is at most this many bytes, but more than {@link previewBytes}, is
 * returned as a truncated preview of its first `previewBytes` bytes. Beyond
 * this threshold the result is not inlined at all — see {@link sizeGuard}.
 * Well clear of the 128 KiB stdio line cap — see the module header.
 * @type {number}
 */
export const guardBytes = 65536

/**
 * The exact message {@link sizeGuard} returns once `content` exceeds
 * `guardBytes` — Success Criterion 5's wording, verbatim, with `hash`
 * interpolated. Exported as its own named function (not inlined at both call
 * sites below) so the contract is a single source of truth, in this module
 * and in its own proof.
 * @type {(hash: string) => string}
 */
export const tooLargeMessage = hash => `result too large; stored at ${hash}`

/**
 * `content`'s first `n` UTF-8 bytes, decoded back to a string. Only ever
 * called once a caller has already confirmed `content`'s byte length is
 * within `guardBytes` (64 KiB) — comfortably under `tryUtf8`'s own 128 KiB
 * ceiling — so `encoded` here is always the real vector, never the overflow
 * sentinel.
 * @type {(n: number) => (encoded: Vec) => string}
 */
const bytePrefix = n => encoded => utf8ToString(u8ListToVec(msb)(take(n)(u8List(msb)(encoded))))

/**
 * The size-guarded response decision (EXEC-11): given `content`'s UTF-8 byte
 * length against the two curried thresholds, decides whether to inline it in
 * full, inline a truncated preview, or replace it with
 * {@link tooLargeMessage}. Parameterized on its own thresholds — never reads
 * this module's `previewBytes`/`guardBytes` constants directly — so the
 * three bands can be proven with tiny values and no large allocation (see
 * the module header).
 *
 * `content` itself exceeding the transport's own 128 KiB cap (`tryUtf8`
 * returning `null`) is treated the same as exceeding `guardBytes`: a
 * pathologically large `content` is, a fortiori, over any `guardBytes` this
 * function would ever be configured with, so it degrades to the same
 * "too large" answer rather than a distinct failure mode.
 * @type {(guardBytes: number) => (previewBytes: number) => (content: string, hash: string) => { readonly preview: string, readonly truncated: boolean }}
 */
export const sizeGuard = guardBytes => previewBytes => (content, hash) => {
    const encoded = tryUtf8(content)
    if (encoded === null) {
        return { preview: tooLargeMessage(hash), truncated: true }
    }
    const bytes = bitLength(encoded) / 8n
    if (bytes <= previewBytes) {
        return { preview: content, truncated: false }
    }
    if (bytes <= guardBytes) {
        return { preview: bytePrefix(previewBytes)(encoded), truncated: true }
    }
    return { preview: tooLargeMessage(hash), truncated: true }
}

// ── Task 2: the ordering proof, and the transport-fallback contrast ─────────
//
// The rest of this module has no dependency on MCP or stdio at all — it is
// pure. Everything below exists solely to PROVE the ordering claim in the
// module header: that `sizeGuard`'s decision is made before a response ever
// reaches the transport, not merely that the right-looking text comes back.
// This mirrors `fjs/server/module.f.js`'s own `financeMcpServer` proof
// harness (a minimal registry driven through `virtual` + `stdioTransport`),
// scaled down to exactly what these two leaves need.

/** A minimal `McpConfig` for driving a session through `mcpStep`, distinct from `financeConfig` (this is a proof harness, not the real server identity). @type {McpConfig} */
const harnessConfig = {
    serverInfo: { name: 'size-guard-proof-harness', version: '0.0.0' },
    capabilities: { tools: {} },
    protocolVersion: 'size-guard-proof',
}

/** UTF-8 bytes of `s` as a plain array — the virtual stdin byte stream, same helper `fjs/server/module.f.js` uses. @type {(s: string) => readonly number[]} */
const toBytes = s => [...fromVec(utf8(s))]

/** Non-empty stdout lines from a session `State`, parsed as JSON-RPC envelopes. @type {(state: State) => readonly unknown[]} */
const responsesOf = state => state.stdout
    .split('\n')
    .filter((/** @type {string} */ line) => line !== '')
    .map((/** @type {string} */ line) => unwrap(jsonParse(line)))

const initializeRequest = {
    jsonrpc: '2.0',
    method: 'initialize',
    id: 1,
    params: {
        protocolVersion: 'size-guard-proof-client',
        capabilities: {},
        clientInfo: { name: 'size-guard-proof-client', version: '0.0.0' },
    },
}
const initializedNotification = { jsonrpc: '2.0', method: 'notifications/initialized' }

/**
 * Drives `initialize` -> `notifications/initialized` -> `tools/call` against a
 * single-tool `registry` over the virtual Node interpreter, and returns the
 * resulting `State` so a proof leaf can assert on `stdout` directly. `toolId`
 * is the id the `tools/call` request itself carries, so a leaf can pick its
 * own response out of the (at least two) response lines a session produces.
 * @type {(registry: readonly ToolEntry<never>[]) => (toolName: string) => (toolId: number) => State}
 */
const runToolCallSession = registry => toolName => toolId => {
    const handlers = fromRegistry(registry)
    const [state0, session] = virtual(emptyState)(create(uninitializedState))
    // `virtual` answers a `Result` in 0.46.0; allocating a memory slot cannot
    // fail against the virtual runner, and `unwrap` panics with a bare value
    // if it somehow did.
    const sessionKey = unwrap(session)
    const toolsCallRequest = { jsonrpc: '2.0', method: 'tools/call', id: toolId, params: { name: toolName, arguments: {} } }
    const input = [initializeRequest, initializedNotification, toolsCallRequest]
        .map(m => JSON.stringify(m))
        .join('\n') + '\n'
    const [state1] = virtual({ ...state0, stdin: toBytes(input) })(
        stdioTransport(mcpStep(harnessConfig)(handlers)(sessionKey)))
    return state1
}

/**
 * The oversized content the ordering proof runs `sizeGuard` on — well over
 * the tiny 8-byte guard the tool below configures, and containing a marker
 * substring distinctive enough that its absence from `stdout` is a real
 * assertion, not a coincidence. Deliberately small (a few dozen bytes): the
 * whole point of parameterizing `sizeGuard` on tiny thresholds (module
 * header) is that tripping the "too large" band never requires a real 64 KiB
 * or 128 KiB payload.
 */
const orderingProofRawContent = 'RAW-CONTENT-MARKER-must-never-reach-stdout-in-full'
const orderingProofHash = 'ORDERING-PROOF-HASH'

/**
 * A test-only tool applying `sizeGuard` (tiny thresholds: an 8-byte guard, a
 * 4-byte preview — both far below `orderingProofRawContent`'s length) to
 * oversized content before ever returning it, exactly the shape a real
 * `fjs_run`-style handler would use. `okResult` wraps only the ALREADY-SIZED
 * `preview`, never the raw content.
 * @type {ToolEntry<never>}
 */
const orderingProofTool = toolEntry(
    'size_guard_ordering_probe',
    'Test-only: applies sizeGuard to oversized content before returning it.',
    {},
    () => pureOk(okResult(sizeGuard(8)(4)(orderingProofRawContent, orderingProofHash).preview)),
)

/** The oversized content the contrast leaf returns WITHOUT `sizeGuard` — a real payload over the transport's own 128 KiB line cap, reproducing `writeResponse`'s own generic fallback (see that module's `proof.f.js`, which uses the identical technique to prove the fallback exists). */
const contrastRawContent = 'Y'.repeat(Number(maxLengthBytes) + 1)

/**
 * A test-only tool returning an oversized result directly, with no
 * `sizeGuard` in front of it — the failure mode this whole module exists to
 * prevent, reproduced directly rather than argued about.
 * @type {ToolEntry<never>}
 */
const contrastTool = toolEntry(
    'size_guard_contrast_probe',
    'Test-only: returns an oversized result WITHOUT sizeGuard.',
    {},
    () => pureOk(okResult(contrastRawContent)),
)

// ── Tests ────────────────────────────────────────────────────────────────────

export const proof = {
    // Task 1 acceptance criteria: all three size bands, exercised with tiny
    // thresholds so no large string is ever allocated in this proof.
    sizeGuard: {
        // Under previewBytes: returned whole, untruncated.
        underPreviewInlinedInFull: () => {
            const result = sizeGuard(16)(8)('short', 'HASH')
            assertEq(result.preview, 'short')
            assertEq(result.truncated, false)
        },
        // Over previewBytes, under guardBytes: a truncated preview of
        // exactly the first previewBytes bytes.
        betweenThresholdsTruncatedToPreview: () => {
            const result = sizeGuard(16)(4)('a longer string', 'HASH')
            assertEq(result.preview, 'a lo')
            assertEq(result.truncated, true)
        },
        // Over guardBytes: replaced entirely by the exact contract string —
        // no large string allocated to prove it (the ordinary short literal
        // already in this test IS "way too long" relative to a 4-byte guard).
        overGuardReplacedWithTooLargeMessage: () => {
            const result = sizeGuard(4)(2)('way too long for this guard', 'HASH')
            assertEq(result.preview, 'result too large; stored at HASH')
            assertEq(result.truncated, true)
        },
        // tooLargeMessage is the single source of truth for the contract
        // string; pin its exact shape once, directly.
        tooLargeMessageIsTheContractString: () => {
            assertEq(tooLargeMessage('ABC123'), 'result too large; stored at ABC123')
        },
        // R1/R2 (09-07): the three band proofs above all use content
        // comfortably either side of a threshold, so `sizeGuard`'s `<=` at
        // both `previewBytes` and `guardBytes` can be mutated to `<`
        // undetected — nothing lands ON a boundary. These two land exactly
        // on each one. Byte length is measured the SAME way `sizeGuard`
        // itself measures it (`tryUtf8` + bit_vec `length`/8), never
        // `.length`, so this proof and the code under test agree on what a
        // byte is — a repeated single-byte ASCII character makes that
        // measurement and `content`'s own `.length` coincide here, but the
        // assertion below still goes through the shared measurement so it
        // would still catch a change to how bytes are counted.
        exactBoundaries: {
            // Exactly `previewBytes`: still inlined in FULL, untruncated.
            // `<=` keeps this band; a `<` mutation at `previewBytes` would
            // push it into the truncated-preview band instead.
            exactlyPreviewBytesInlinedInFullNotTruncated: () => {
                const guard = 16
                const preview = 8
                const content = 'x'.repeat(preview)
                const encoded = tryUtf8(content)
                assert(encoded !== null, 'expected the boundary content to encode as UTF-8')
                assertEq(bitLength(encoded) / 8n, BigInt(preview))
                const result = sizeGuard(guard)(preview)(content, 'HASH')
                assertEq(result.truncated, false)
                assertEq(result.preview, content)
            },
            // Exactly `guardBytes` (and over `previewBytes`): a truncated
            // PREVIEW, never the "too large" message. `<=` keeps this band;
            // a `<` mutation at `guardBytes` would push it into the
            // too-large band instead, even though the content is not over
            // the guard at all.
            exactlyGuardBytesTruncatedNotTooLarge: () => {
                const guard = 16
                const preview = 8
                const content = 'x'.repeat(guard)
                const encoded = tryUtf8(content)
                assert(encoded !== null, 'expected the boundary content to encode as UTF-8')
                assertEq(bitLength(encoded) / 8n, BigInt(guard))
                const result = sizeGuard(guard)(preview)(content, 'HASH')
                assertEq(result.truncated, true)
                assertEq(result.preview, content.slice(0, preview))
                assert(
                    result.preview !== tooLargeMessage('HASH'),
                    'expected a truncated preview, not the too-large message, exactly at guardBytes')
            },
        },
    },
    // A separate, trivial proof pinning the SHIPPED constants — kept apart
    // from the parameterized logic proof above so the two can never drift:
    // the logic proof exercises arbitrary thresholds; this one exercises
    // only the two specific values this module actually ships.
    shippedConstants: {
        previewBytesIs8KiB: () => {
            assertEq(previewBytes, 8192)
        },
        guardBytesIs64KiB: () => {
            assertEq(guardBytes, 65536)
        },
        // Both constants stay well clear of the 128 KiB stdio line cap this
        // module's header cites — the headroom the two-threshold design
        // exists to preserve.
        bothConstantsClearOfTheStdioCap: () => {
            assert(BigInt(previewBytes) < maxLengthBytes, 'previewBytes must stay under the stdio cap')
            assert(BigInt(guardBytes) < maxLengthBytes, 'guardBytes must stay under the stdio cap')
            assertEq(maxLengthBytes, 131072n)
        },
    },
    // Task 2, leaf 1: the ordering proof. The point is NOT that the short
    // message comes back — it is that the raw oversized content is ABSENT
    // from stdout, which a "which message came back" proof cannot establish
    // (the STATE.md lesson from SEC-02-before-`import_`, Phase 6): a response
    // built from `sizeGuard`'s output and one built from the raw content and
    // then coincidentally truncated somewhere downstream would both produce
    // the same returned text, but only the first is actually SAFE.
    orderingProof: {
        tooLargeMessageReachesStdoutButRawContentNeverDoes: () => {
            const state = runToolCallSession([orderingProofTool])('size_guard_ordering_probe')(2)
            assert(
                state.stdout.includes(tooLargeMessage(orderingProofHash)),
                ['expected the too-large message in stdout', state.stdout])
            assert(
                !state.stdout.includes(orderingProofRawContent),
                'the raw oversized content leaked into stdout — sizeGuard did not run before the transport')
        },
    },
    // Task 2, leaf 2: the contrast. Directly reproduces the failure mode
    // EXEC-11 exists to prevent — an oversized result with NO sizeGuard in
    // front of it hits `writeResponse`'s own generic `-32603` fallback, which
    // carries no size-specific text at all. This is the failure a caller
    // sees with no `sizeGuard`; demonstrating it directly (not by argument)
    // is what makes the ordering proof above meaningful by comparison.
    contrastLeaf: {
        unsizedOversizedResultReproducesGenericInternalErrorFallback: () => {
            const state = runToolCallSession([contrastTool])('size_guard_contrast_probe')(2)
            const responses = /** @type {readonly { readonly jsonrpc: string, readonly id?: unknown, readonly error?: { readonly code: number, readonly message: string } }[]} */ (responsesOf(state))
            const toolCallResponse = responses.find(r => r.id === 2)
            assert(toolCallResponse !== undefined, ['expected a tools/call response', responses])
            assert(toolCallResponse.error !== undefined, ['expected an error response', toolCallResponse])
            assertEq(toolCallResponse.jsonrpc, jsonrpc)
            assertEq(toolCallResponse.error.code, internalError.code)
            assertEq(toolCallResponse.error.message, internalError.message)
            assert(
                !JSON.stringify(toolCallResponse).toLowerCase().includes('too large'),
                ['expected the generic fallback, not a size-specific message', toolCallResponse])
        },
    },
}
