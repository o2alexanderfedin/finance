/**
 * `buildRunSnapshot`/`buildHostMap` — the synchronous host-map snapshot
 * `interpret` requires (07-CONTEXT.md "The host `OperationMap` must be
 * synchronous"), and the SAME snapshot the pinning decision also requires
 * (07-CONTEXT.md "Pinning is a snapshot taken by the handler, once, at call
 * time").
 *
 * ## Why one function builds both requirements' data
 *
 * `interpret`'s `OperationMap<O, Return<O>>` (`fjs/exec/module.f.js`) pins
 * every handler to a plain synchronous `(a: string) => string` — never an
 * `Effect`-returning one (07-RESEARCH.md Pitfall 3 / Finding 3). `Cas<O>`/
 * `Evo<O>`'s own methods (`read`, `list`, `head`, `revision`) are all
 * `Effect`-returning, so the real host map cannot be a thin wrapper around
 * them: it has to close over data already resolved by ordinary `step`/
 * `foldStep` effects BEFORE `interpret` ever runs. That resolved data is
 * `RunSnapshot`.
 *
 * Separately, EXEC-08's pinning decision requires `subject`/`parents` to
 * resolve to concrete revision hashes once, at call time, so a program's own
 * `evoHead` reads the PINNED value rather than whatever the live store's
 * head happens to be when the program runs. Both requirements need the exact
 * same shape — "resolve the whole reachable store into plain data once,
 * before the guest runs" — so `buildRunSnapshot` builds it once and `pin`,
 * when supplied, overrides only the one named subject's `heads` entry in the
 * result; every other subject still resolves live (T-07-05-03). 07-RESEARCH.md
 * Open Question 2 recommends resolving every hash `cas.list()` returns rather
 * than something narrower keyed off reachability from `subject`/`parents` —
 * simplest-correct at this project's declared scale (a handful of documents).
 *
 * ## Handler shape
 *
 * `buildHostMap(snapshot)` returns an object with exactly the four frozen
 * `CasOp` keys, each reading ONLY from `snapshot` — no I/O, no `Effect`
 * anywhere in the return type. `tsc` rejects the whole map if a handler ever
 * drifted back to returning an `Effect` (07-RESEARCH.md Pitfall 3): that is
 * confirmation the design is right, not something to paper over with `any`
 * (T-07-05-02).
 *
 * ## Retraction (DOC-15) — the documented `evo_add` call, and this file's part in it
 *
 * There is no separate "archive a document" tool. `finance_document_archive`
 * was considered and rejected (11-CONTEXT.md): the already-registered
 * `evo_add` tool already accepts `archived: option(true)` on its input shape,
 * so retracting a wrongly-ingested document is exactly this call, made
 * through `evo_add` like any other revision:
 *
 * ```json
 * {
 *   "name": "evo_add",
 *   "arguments": {
 *     "parents": ["<current head hash of the wrongly-ingested document's subject>"],
 *     "subject": "<the subject>",
 *     "archived": true
 *   }
 * }
 * ```
 *
 * `snapshot` is deliberately OMITTED: with exactly one parent and no explicit
 * `snapshot`, the new revision inherits the parent's own `snapshot` unchanged
 * (`resolveSnapshot`'s single-parent rule) — the archived revision points at
 * the SAME bytes, just flagged `archived: true`. The bytes remain in the
 * store; `archived` means "no longer current", never "gone" (CAS has no
 * delete — `REQUIREMENTS.md`'s Accepted Risks).
 *
 * This module enforces the OTHER half of DOC-15: once such a revision exists,
 * `buildRunSnapshot` excludes it — and therefore its subject's now-superseded
 * head — from what a guest report program's `ctx.evoHead`/`ctx.evoRevision`
 * can resolve. Concretely: any hash whose decoded `RevisionData` carries
 * `archived: true` is excluded from `revisions`, and any head hash for a
 * subject is excluded from `heads` unless it survived that same filter — so
 * an archived-only subject resolves to `heads[subject] === []`,
 * indistinguishable from an unknown subject. `buildHostMap`'s `evoList`
 * handler is untouched: `ctx.evoList('true')` still returns the archived
 * subject's NAME (which reveals nothing about content) — it is the
 * subsequent `evoHead`/`evoRevision` resolution this filtering closes off.
 * This is exactly the mechanism the adversarial proof below (
 * `archivedRevisionUnreachable`) seeds and exercises, so this docstring and
 * that proof describe the same thing rather than two independently
 * maintained accounts of it.
 *
 * **The honest boundary of this guarantee**: `blobs` (raw snapshot bytes by
 * hash) stays completely unfiltered. A report program handed the exact
 * SNAPSHOT hash (not the revision hash) through an external channel — e.g.
 * obtained from `finance_documents_list`'s own `archived: true` response —
 * can still `ctx.casRead` it directly. Closing that would
 * need an access-control redesign far beyond CAS's content-addressable
 * nature (anyone holding an exact hash can read it) and would contradict
 * this project's own Accepted Risk that "retraction remains a policy
 * question, not a capability." This module closes the discovery/resolution
 * chain a report program actually walks (`evoList('true')` ->
 * `evoHead`/`evoRevision`); it does not — and cannot — make retracted bytes
 * unreadable to a party already holding their exact hash.
 *
 * @module
 */
import { step, mapStep, foldStep, pure } from 'functionalscript/fjs/effects/module.f.js'
import { collectRead, fileCas } from 'functionalscript/fjs/cas/module.f.js'
import { vecToCBase32 } from 'functionalscript/fjs/basen/cbase32/module.f.js'
import { utf8ToString, tryUtf8 } from 'functionalscript/fjs/text/module.f.js'
import { initEvo, evo } from 'functionalscript/fjs/cas/evo/module.f.js'
import { sha256 } from 'functionalscript/fjs/crypto/sha2/module.f.js'
import { emptyState, virtual } from 'functionalscript/fjs/effects/node/virtual/module.f.js'
import { ok } from 'functionalscript/fjs/types/result/module.f.js'
import { assert, assertEq } from 'functionalscript/fjs/asserts/module.f.js'
import { interpret } from '../../../exec/module.f.js'
import { guestCtx } from '../../../guest/module.f.js'
import { stringify as jsonText } from '../../../json/module.f.js'

/** @import { Effect, Operation, OperationMap } from 'functionalscript/fjs/effects/module.f.js' */
/** @import { MemOp } from 'functionalscript/fjs/effects/memory/module.f.js' */
/** @import { Cas } from 'functionalscript/fjs/cas/module.f.js' */
/** @import { Evo } from 'functionalscript/fjs/cas/evo/module.f.js' */
/** @import { CasOp } from '../../../guest/module.f.js' */

// ── RunSnapshot: the whole reachable store, resolved before interpret runs ───

/**
 * The whole reachable CAS/Evo store, resolved into plain data before
 * `interpret` runs. See the module header for why one snapshot serves both
 * the synchronous-host-map constraint and pinning.
 *
 * - `blobs` maps every cBase32 hash `cas.list()` returns to its decoded
 *   UTF-8 text.
 * - `activeSubjects`/`archivedSubjects` are `evo.list()`/`evo.list(true)`'s
 *   results, resolved once.
 * - `heads` maps every one of those subjects to its current head hashes
 *   (from `evo.head`) — or, for the pinned subject, to `pin.parents`.
 * - `revisions` maps every hash that `evo.revision(hash)` successfully
 *   decodes (skipped, not errored, for a hash that is not a valid revision —
 *   mirroring `buildCache`'s own "ignore non-revision blobs" precedent) to
 *   `jsonText(RevisionData)`.
 * @typedef {{
 *   readonly blobs: Readonly<Record<string, string>>,
 *   readonly activeSubjects: readonly string[],
 *   readonly archivedSubjects: readonly string[],
 *   readonly heads: Readonly<Record<string, readonly string[]>>,
 *   readonly revisions: Readonly<Record<string, string>>,
 * }} RunSnapshot
 */

/**
 * A pinning request: `subject`/`parents` resolved to concrete revision
 * hashes ONCE at call time (EXEC-08). `undefined` means an unpinned run —
 * PROV-03's `pinned: false`.
 * @typedef {{ readonly subject: string, readonly parents: readonly string[] } | undefined} Pin
 */

/** @type {RunSnapshot} */
const emptySnapshot = { blobs: {}, activeSubjects: [], archivedSubjects: [], heads: {}, revisions: {} }

/**
 * Resolves every hash `cas.list()` returns into `blobs`/`revisions`, folds
 * in `evoApi.list()`/`evoApi.list(true)`'s subjects and each one's
 * `evoApi.head`, and — when `pin` is supplied — overrides `pin.subject`'s
 * `heads` entry with `pin.parents`, regardless of what the live store's
 * current head for that subject is. Every other subject's heads resolve
 * live, as normal.
 * @type {<O extends Operation>(cas: Cas<O>) => (evoApi: Evo<O>) => (pin: Pin) => Effect<O | MemOp, RunSnapshot>}
 */
export const buildRunSnapshot = cas => evoApi => pin => {
    const withBlobsAndRevisions = step(
        cas.list(),
        hashes => foldStep(
            pure(hashes),
            emptySnapshot,
            hash => state => step(
                collectRead(cas.read(hash)),
                blobResult => {
                    if (blobResult[0] === 'error') {
                        // A hash cas.list() reported but could not itself be
                        // read: skip it, mirroring buildCache's own "ignore
                        // what does not decode" precedent rather than
                        // failing the whole snapshot over one bad blob.
                        return pure(state)
                    }
                    const hashStr = vecToCBase32(hash)
                    const blobs = { ...state.blobs, [hashStr]: utf8ToString(blobResult[1]) }
                    return step(
                        evoApi.revision(hashStr),
                        revResult => pure({
                            ...state,
                            blobs,
                            // DOC-15: a revision flagged `archived: true` is
                            // excluded from `revisions` here, at the exact
                            // point its decoded RevisionData is already in
                            // scope — the SAME accumulator step that builds
                            // `revisions`, not a separate pass afterward. See
                            // the module header's "Retraction (DOC-15)"
                            // section for the full guarantee and its honest
                            // boundary.
                            revisions: revResult[0] === 'ok' && revResult[1].archived !== true
                                ? { ...state.revisions, [hashStr]: jsonText(revResult[1]) }
                                : state.revisions,
                        }),
                    )
                },
            ),
        ),
    )
    const withSubjects = step(
        withBlobsAndRevisions,
        state => step(
            evoApi.list(),
            activeSubjects => step(
                evoApi.list(true),
                archivedSubjects => pure({ ...state, activeSubjects, archivedSubjects }),
            ),
        ),
    )
    const withHeads = step(
        withSubjects,
        state => foldStep(
            pure([...state.activeSubjects, ...state.archivedSubjects]),
            state,
            subject => s => step(
                evoApi.head(subject),
                headHashes => {
                    // DOC-15: `state.revisions` (built by withBlobsAndRevisions,
                    // which runs before withHeads in this chain) already
                    // excludes any hash whose decoded revision carries
                    // `archived: true`. Reuse that SAME filtered map to derive
                    // which of this subject's head hashes are non-archived,
                    // rather than re-deriving archived status a second way
                    // (AGENTS.md "one rule, one place"). An archived-only
                    // subject's activeHeadHashes is then `[]` — indistinguishable
                    // from an unknown subject, to a report program.
                    const activeHeadHashes = headHashes.filter(h => state.revisions[h] !== undefined)
                    return pure({ ...s, heads: { ...s.heads, [subject]: activeHeadHashes } })
                },
            ),
        ),
    )
    return mapStep(
        withHeads,
        state => pin === undefined
            ? state
            : { ...state, heads: { ...state.heads, [pin.subject]: pin.parents } },
    )
}

// ── buildHostMap: the plain synchronous OperationMap<CasOp, string> ──────────

/**
 * The synchronous `OperationMap<CasOp, string>` `interpret` dispatches
 * through. Every handler reads ONLY from `snapshot` — never performs I/O,
 * never returns an `Effect`.
 *
 * `casRead`/`evoRevision` throw a plain string (never an `Error`) when the
 * hash is absent from the snapshot — consistent with this codebase's
 * bare-throw discipline; `interpret`'s own `assert(typeof thrown ===
 * 'string')` catch-and-report path already converts it into an actionable
 * refusal message.
 *
 * `evoList`'s argument selects active vs. archived: `'true'` (the literal
 * string, since `CasOp` carries only `string -> string`) answers with the
 * archived subjects, anything else with the active ones — mirroring
 * `Evo.list(archived?: true)`'s own default-is-active convention.
 * @type {(snapshot: RunSnapshot) => OperationMap<CasOp, string>}
 */
export const buildHostMap = snapshot => ({
    casRead: hash => {
        const blob = snapshot.blobs[hash]
        if (blob === undefined) {
            throw `blob not found: ${hash}`
        }
        return blob
    },
    evoList: archivedFlag => jsonText(
        archivedFlag === 'true' ? snapshot.archivedSubjects : snapshot.activeSubjects),
    evoHead: subject => jsonText(snapshot.heads[subject] ?? []),
    evoRevision: hash => {
        const revision = snapshot.revisions[hash]
        if (revision === undefined) {
            throw `revision not found: ${hash}`
        }
        return revision
    },
})

// ── Tests ────────────────────────────────────────────────────────────────────

/** A hand-built snapshot, for the `buildHostMap` proofs that don't need a real store. */
/** @type {RunSnapshot} */
const twoBlobSnapshot = {
    blobs: { hashA: 'content-a', hashB: 'content-b' },
    activeSubjects: [],
    archivedSubjects: [],
    heads: {},
    revisions: {},
}

export const proof = {
    // ── buildHostMap: the synchronous OperationMap<CasOp, string> ───────────
    hostMap: {
        // The type-check itself: `interpret` accepts `buildHostMap(snapshot)`
        // directly, with no cast. If `buildHostMap`'s return type ever drifted
        // to something `interpret`'s `OperationMap<CasOp, string>` parameter
        // rejects, this line — not a runtime assertion — is what would fail
        // (`tsc`, via `npm test`).
        typeChecksAgainstOperationMap: () => {
            const [t] = interpret(buildHostMap(twoBlobSnapshot))(guestCtx.casRead('hashA'))
            assertEq(t, 'ok')
        },
        // Success Criterion 1's enabling shape, repeated: two dispatched
        // commands chained through ctx.step, both actually reaching the
        // synchronous host map's closures, in order.
        composesAcrossTwoReadsViaStep: () => {
            const chain = guestCtx.step(guestCtx.casRead('hashA'), () => guestCtx.casRead('hashB'))
            const [t, v] = interpret(buildHostMap(twoBlobSnapshot))(chain)
            assert(t === 'ok', ['expected ok', t, v])
            const [value, reads] = v
            assertEq(value, 'content-b')
            assertEq(reads.length, 2)
            assertEq(reads[0]?.[0], 'casRead')
            assertEq(reads[1]?.[0], 'casRead')
        },
        // Pinning: a subject whose snapshot-recorded head differs from the
        // pin override must answer with the PINNED parents, never the live
        // one — the direct behavioral proof of EXEC-08's pinning decision at
        // the host-map layer (buildRunSnapshot's own pin-override proof,
        // below, proves the same thing one layer up, against a real store).
        pinOverridesTheLiveHead: () => {
            /** @type {RunSnapshot} */
            const snapshot = {
                ...twoBlobSnapshot,
                heads: { subjectS: ['LIVE_HEAD_HASH'] },
            }
            const pinned = { ...snapshot, heads: { ...snapshot.heads, subjectS: ['PINNED_HASH'] } }
            const [t, v] = interpret(buildHostMap(pinned))(guestCtx.evoHead('subjectS'))
            assert(t === 'ok', ['expected ok', t, v])
            assertEq(v[0], JSON.stringify(['PINNED_HASH']))
            assert(v[0] !== JSON.stringify(snapshot.heads['subjectS']), 'must not answer with the live head')
        },
        // A hash absent from the snapshot refuses, and does so by throwing
        // (this codebase's bare-throw discipline, 07-CONTEXT.md).
        //
        // MERGE NOTE (do not re-revert). A feedback pass rewrote this as a bare
        // `throw: { casReadOnAbsentHash }` leaf, dropping all three assertions
        // below, on the stated grounds that "reading a thrown value requires
        // catching it, and a `.f.js` module may not". That premise is false —
        // `fjs/exec/module.f.js` catches in shipped production code, and this
        // proof passes under `npm test`. The `throw:` form is strictly weaker:
        // it passes for ANY throw, including one raised by an unrelated path
        // before `casRead` is ever consulted. Asserting WHAT was thrown, not
        // merely that something was, is the specific gap the mutation sweep
        // found across this codebase, so the assertions stay.
        casReadOnAbsentHashThrowsAPlainString: () => {
            const map = buildHostMap(twoBlobSnapshot)
            try {
                map.casRead('absent-hash')
                assert(false, 'expected casRead to throw for an absent hash')
            } catch (thrown) {
                assertEq(typeof thrown, 'string')
                assert(!(thrown instanceof Error), 'must never throw an Error')
                assert(String(thrown).includes('absent-hash'), String(thrown))
            }
        },
    },

    // ── buildRunSnapshot: resolving a real store, under virtual ─────────────
    // Under fjs/effects/node/virtual, seeding a real FileCas + Evo cache
    // (following the fjs/server/module.f.js casRefresh proof's pattern) so
    // this proves buildRunSnapshot against the real Cas<O>/Evo<O> shapes,
    // not a hand-built RunSnapshot.
    buildRunSnapshotResolvesTheStore: {
        blobsSubjectsHeadsAndRevisions: () => {
            const home = '/'
            const cas = fileCas(sha256)(home)
            const [state0, cacheKey] = virtual(emptyState)(initEvo(cas))
            // A plain (non-revision) document blob.
            const docText = '{"box1InterestIncome":"12.34"}'
            const docBytes = tryUtf8(docText)
            assert(docBytes !== null, 'expected the sample document to encode as UTF-8')
            const [state1, docWrite] = virtual(state0)(
                cas.write(pure({ first: ok(docBytes), tail: pure(undefined) })))
            assert(docWrite[0] === 'ok', ['expected the document write to succeed', docWrite])
            const docHash = vecToCBase32(docWrite[1])
            // A revision naming that document as its snapshot, for a fresh
            // subject — through evo.add, so both the store AND the cache end
            // up consistent with each other.
            const e = evo(cas)(cacheKey)
            const [state2, addResult] = virtual(state1)(
                e.add({ parents: [], subject: 'subjectS', snapshot: docHash }))
            assert(addResult[0] === 'ok', ['expected the revision add to succeed', addResult])
            const revisionHash = addResult[1]
            const [, snapshot] = virtual(state2)(buildRunSnapshot(cas)(e)(undefined))
            // The plain document blob's own bytes are resolved verbatim.
            assertEq(snapshot.blobs[docHash], docText)
            // The revision blob is ALSO just a blob in cas.list()'s eyes, so
            // it is resolved into `blobs` too, alongside being decoded into
            // `revisions` — both, not one or the other.
            assert(snapshot.blobs[revisionHash] !== undefined, 'expected the revision blob itself to be resolved')
            assert(snapshot.revisions[revisionHash] !== undefined, 'expected the revision to decode into revisions')
            // The document hash never decodes as a revision — skipped, not
            // errored, mirroring buildCache's own precedent.
            assertEq(snapshot.revisions[docHash], undefined)
            // The subject is active (its only head is not archived) and its
            // head is exactly the one revision just added.
            assert(snapshot.activeSubjects.includes('subjectS'), snapshot.activeSubjects)
            assertEq(JSON.stringify(snapshot.heads['subjectS']), JSON.stringify([revisionHash]))
        },
        // The pin override survives all the way through a real resolved
        // snapshot: the subject's snapshot-derived (live) head is replaced by
        // the supplied pin.parents, and nothing else about the snapshot
        // changes.
        pinOverridesTheResolvedHead: () => {
            const home = '/'
            const cas = fileCas(sha256)(home)
            const [state0, cacheKey] = virtual(emptyState)(initEvo(cas))
            const docBytes = tryUtf8('{}')
            assert(docBytes !== null, 'expected "{}" to encode as UTF-8')
            const [state1, docWrite] = virtual(state0)(
                cas.write(pure({ first: ok(docBytes), tail: pure(undefined) })))
            assert(docWrite[0] === 'ok', ['expected the document write to succeed', docWrite])
            const docHash = vecToCBase32(docWrite[1])
            const e = evo(cas)(cacheKey)
            const [state2, addResult] = virtual(state1)(
                e.add({ parents: [], subject: 'subjectS', snapshot: docHash }))
            assert(addResult[0] === 'ok', ['expected the revision add to succeed', addResult])
            const liveHead = addResult[1]
            const [, unpinned] = virtual(state2)(buildRunSnapshot(cas)(e)(undefined))
            assertEq(JSON.stringify(unpinned.heads['subjectS']), JSON.stringify([liveHead]))
            const [, pinned] = virtual(state2)(
                buildRunSnapshot(cas)(e)({ subject: 'subjectS', parents: ['PINNED_INSTEAD'] }))
            assertEq(JSON.stringify(pinned.heads['subjectS']), JSON.stringify(['PINNED_INSTEAD']))
            assert(
                JSON.stringify(pinned.heads['subjectS']) !== JSON.stringify(unpinned.heads['subjectS']),
                'the pin must actually change what the snapshot reports')
        },
    },
}
