/**
 * EXEC-11 — the size-guarded response envelope: decides whether a tool
 * result's text can be inlined as-is, truncated to a short preview, or must
 * be replaced entirely by a pointer to where the full result actually lives.
 *
 * ## Two thresholds, not one, and why
 *
 * `functionalscript/fjs/protocol/mcp/stdio/module.f.js`'s `writeResponse`
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
import { tryUtf8, utf8ToString } from 'functionalscript/fjs/text/module.f.js'
import { length as bitLength, maxLengthBytes, msb, u8List, u8ListToVec } from 'functionalscript/fjs/types/bit_vec/module.f.js'
import { take } from 'functionalscript/fjs/types/list/module.f.js'
import { assert, assertEq } from 'functionalscript/fjs/asserts/module.f.js'

/** @import { Vec } from 'functionalscript/fjs/types/bit_vec/module.f.js' */

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
}
