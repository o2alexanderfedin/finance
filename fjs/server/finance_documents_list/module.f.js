/**
 * `finance_documents_list` — the MCP-08 tool: enumerates stored documents as
 * a JSON array of `{ subject, dialect, taxYear, hash }`, active by default,
 * `archived: true` opting in — mirroring upstream `evo_list`'s own
 * convention rather than inventing a second one. This is the read-side half
 * of the "documented answer to 'I uploaded the wrong document'" success
 * criterion (11-CONTEXT.md); the write side is the already-registered
 * `evo_add` tool's `archived: true` argument, documented at
 * `fjs/server/fjs_run/snapshot/module.f.js`'s module header.
 *
 * ## This tool is HOST-SIDE, not a guest report program
 *
 * `financeDocumentsListTool` closes directly over `Evo<O>`/`Cas<O>` — it is
 * never routed through `fjs_run`'s `interpret`/guest sandbox, mirroring
 * `finance_schema`/`finance_tax_params`'s own construction rather than
 * `fjs_run`'s guest-program indirection (RESEARCH.md Q4's "Alternatives
 * Considered"). Consequently it is NOT subject to Plan 11-02's DOC-15
 * guest-visibility guarantee (`buildRunSnapshot`'s archived-revision
 * filtering): an authorized local caller enumerating their own store,
 * including archived documents on request, is a HOST administrative
 * capability, not a sandboxed guest report program reading tax data. See
 * this file's own threat model (11-03-PLAN.md) for the accepted-risk
 * disposition of `archived: true`.
 *
 * ## No dialect-registry validation — a deliberate anti-pattern avoidance
 *
 * A document whose head is NOT one of the known finance dialects is still
 * listed, carrying its actual dialect tag (11-CONTEXT.md's "A document that
 * cannot be listed is exactly how 'I uploaded the wrong thing' stays
 * invisible"). Classifying a document's dialect is therefore done WITHOUT
 * validating against `finance_schema`'s own dialect-to-schema lookup map:
 * that would force importing every dialect's schema just to reject unknown ones,
 * and would conflate "not one of ours" with "structurally invalid" — a
 * well-formed document naming an unregistered dialect string is neither.
 * Instead, {@link documentIdentitySchema} is a LOCAL, deliberately loose
 * identity-peek schema, and it says so with `open`: any real document — which
 * always carries a required `dialect: string` and `taxYear: number` under
 * every existing dialect's own schema, plus that dialect's form-specific
 * fields — validates against it trivially, and every other field is simply
 * ignored. Until `functionalscript` 0.47.0 the looseness came free; this
 * paragraph read "rtti permits properties a schema does not mention (verified
 * against `fjs/server/module.f.js`'s own comment to the same effect)", and it
 * did. 0.47.0 reverses the default and `fjs/server`'s comment was corrected
 * with it, leaving this echo of it stating the exact opposite of the truth
 * over a schema that had gone closed. `open` is what the old sentence was
 * relying on, said out loud — see {@link documentIdentitySchema} itself.
 *
 * ## The `'unknown'` sentinel — a deliberate, arbitrary-but-recorded pick
 *
 * A parsed snapshot that is well-formed JSON but carries NO `dialect` field
 * at all, OR carries a `dialect` field of the WRONG JSON type (e.g. `dialect:
 * 123`), is structurally possible under the loose schema above — both fail
 * {@link documentIdentitySchema}'s structural validation the same way
 * (`t === 'error'`), so both fall into this same sentinel below. CONTEXT does
 * not name a sentinel for either case (RESEARCH.md Assumption A2); this
 * module picks the literal string `'unknown'` for both. Any documented choice
 * would satisfy the stated success criteria — this one is recorded here so a
 * future reader does not mistake it for a discovered convention, or mistake
 * the sentinel as covering only the narrower "missing field" case.
 *
 * ## One row per (subject, head) pair — not one row per subject
 *
 * `evo.head(subject)` can return more than one hash (concurrent, unmerged
 * branches). CONTEXT's `{ subject, dialect, taxYear, hash }` response shape
 * names a single `hash` per entry, which reads more literally as one row per
 * HEAD, not per subject (RESEARCH.md Open Question 2). This module
 * implements that literal reading: a subject with N concurrent heads yields
 * N rows sharing the same `subject` but carrying different `hash` values.
 *
 * ## Failure modes, all skips, never a crash or a thrown exception
 *
 * Per RESEARCH.md Q4, every step from a listed subject down to a parsed
 * document is defensive: an empty `evo.head` result, an `evo.revision`
 * error, a `RevisionData` with no resolvable `snapshot`, an unreadable CAS
 * blob, or bytes that are not valid UTF-8/JSON are all treated as "skip this
 * (subject, head) pair", never as a thrown exception reaching the MCP
 * transport (T-11-03-01). A non-JSON snapshot blob is exactly the
 * "non-revision blob" skip case CONTEXT names — `evo.list()` only ever
 * returns subjects that already have a resolvable revision chain, so the
 * realistic instance of this skip is a SNAPSHOT blob (the document itself)
 * that fails to parse as JSON, not a revision blob.
 *
 * @module
 */
import { number, open, option, or, string } from 'functionalscript/fjs/rtti/module.f.mjs'
import { validate as rttiValidate } from 'functionalscript/fjs/rtti/validate/module.f.mjs'
import { step, catchStep, mapStep, foldStep, pureOk, pureError, notImplemented } from 'functionalscript/fjs/effects/module.f.mjs'
import { empty, nonEmpty } from 'functionalscript/fjs/effects/list/module.f.mjs'
import { collectRead, fileCas } from 'functionalscript/fjs/cas/module.f.mjs'
import { cBase32ToVec, vecToCBase32 } from 'functionalscript/fjs/basen/cbase32/module.f.mjs'
import { utf8ToString, tryUtf8 } from 'functionalscript/fjs/text/module.f.mjs'
import { toolEntry, toolResultStep } from 'functionalscript/fjs/protocol/mcp/module.f.mjs'
import { errorSummary } from 'functionalscript/fjs/effects/node/module.f.mjs'
import { initEvo, evo as evoOf } from 'functionalscript/fjs/cas/evo/module.f.mjs'
import { sha256 } from 'functionalscript/fjs/crypto/sha2/module.f.mjs'
import { emptyState, virtual } from 'functionalscript/fjs/effects/node/virtual/module.f.mjs'
import { unwrap } from 'functionalscript/fjs/types/result/module.f.mjs'
import { assert, assertEq } from 'functionalscript/fjs/asserts/module.f.mjs'
import { parse, stringify as jsonText } from '../../json/module.f.js'

/** @import { Effect, Operation } from 'functionalscript/fjs/effects/types.js' */
/** @import { List } from 'functionalscript/fjs/effects/list/types.js' */
/** @import { Vec } from 'functionalscript/fjs/types/bit_vec/types.js' */
/** @import { IoChannel, NodeOp } from 'functionalscript/fjs/effects/node/types.js' */
/** @import { MemOp } from 'functionalscript/fjs/effects/memory/types.js' */
/** @import { Cas, FileCas, FileCasOperation } from 'functionalscript/fjs/cas/types.js' */
/** @import { Evo, RevisionData } from 'functionalscript/fjs/cas/evo/types.js' */
/** @import { ToolEntry, ToolsCallResult } from 'functionalscript/fjs/protocol/mcp/types.js' */
/** @import { State } from 'functionalscript/fjs/effects/node/virtual/types.js' */

/**
 * A LOCAL, deliberately loose identity-peek schema — see the module header's
 * "No dialect-registry validation" section for why this never imports
 * `finance_schema`'s own lookup map.
 *
 * **`open` is what makes it loose, and dropping it silently breaks every
 * normal document.** Since functionalscript 0.47.0 (upstream #1732) a bare
 * struct is CLOSED, so the bare form admits a document carrying `dialect`
 * and `taxYear` and NOTHING ELSE — which no stored document is, every
 * dialect's own schema requiring form-specific fields beyond those two. The
 * bare form therefore reports every real document as `'unknown'` with no
 * `taxYear`, and the failure is invisible: it arrives as a well-formed row,
 * not an error. This schema is READ against a wire format that grows fields
 * by design, which is precisely the case upstream's own `open` docstring
 * names.
 */
const documentIdentitySchema = open(/** @type {const} */ ({ dialect: or(option, string), taxYear: or(option, number) }))

/**
 * The shape of one `finance_documents_list` response entry — see the module
 * header's "One row per (subject, head) pair" section. `taxYear` is
 * genuinely absent-able (a malformed/no-dialect blob may carry none), so
 * every construction site uses the conditional-spread discipline
 * (`...(taxYear === undefined ? {} : { taxYear })`) rather than a plain
 * `{ taxYear: possiblyUndefined }`, which passes `tsc` under
 * `exactOptionalPropertyTypes` and inserts a literal `taxYear: undefined`
 * key at runtime.
 * @typedef {{
 *   readonly subject: string,
 *   readonly dialect: string,
 *   readonly taxYear?: number,
 *   readonly hash: string,
 * }} DocumentListEntry
 */

/**
 * `finance_documents_list`: the MCP-08 tool. See the module header for the
 * full design. Resolves every listed subject's head hash(es) into a response
 * entry via the nested `step`/`foldStep` accumulator-fold idiom
 * `fjs/server/fjs_run/snapshot/module.f.js`'s `buildRunSnapshot` already
 * establishes for folding an effectful loop into an accumulator, rather than
 * RESEARCH.md's own "illustrative, not literal" sketch.
 * @type {<O extends Operation>(evo: Evo<O>) => (cas: Cas<O>) => ToolEntry<O | MemOp>}
 */
export const financeDocumentsListTool = evo => cas => {
    /**
     * Resolves one (subject, headHash) pair into a response entry, or
     * `undefined` to skip it — see the module header's "Failure modes"
     * section for what each skip branch below corresponds to. `O` is fixed
     * by the enclosing closure's own `evo`/`cas` (already `Evo<O>`/`Cas<O>`
     * there), so the return type here is left to be inferred from `step`'s
     * own signature rather than re-stated against a type parameter that is
     * not in scope for a nested `@type` annotation.
     */
    const entryFor = (/** @type {string} */ subject) => (/** @type {string} */ headHash) => {
        const resolved = step(
            evo.revision(headHash),
            revision => {
                const snapshotRef = revision.snapshot
                if (snapshotRef === undefined) {
                    // Should not happen: readRevision's own contract says
                    // `snapshot` is "always present" on output, but the field
                    // is typed optional (RevisionData's input/output
                    // vocabulary is shared) -- narrow rather than assume.
                    return pureOk(undefined)
                }
                const snapshotHash = cBase32ToVec(snapshotRef)
                if (snapshotHash === null) {
                    return pureOk(undefined)
                }
                return step(
                    collectRead(cas.read(snapshotHash)),
                    blob => {
                        const [parseTag, parsed] = parse(utf8ToString(blob))
                        if (parseTag === 'error') {
                            // The "non-JSON snapshot blob" skip case -- see the
                            // module header's "Failure modes" section.
                            return pureOk(undefined)
                        }
                        const [t, identity] = rttiValidate(documentIdentitySchema)(parsed)
                        const dialect = t === 'ok' && identity.dialect !== undefined
                            ? identity.dialect
                            : 'unknown'
                        const taxYear = t === 'ok' ? identity.taxYear : undefined
                        /** @type {DocumentListEntry} */
                        const entry = { subject, dialect, ...(taxYear === undefined ? {} : { taxYear }), hash: headHash }
                        return pureOk(entry)
                    },
                )
            },
        )
        // **The skip is a `catchStep`, and it covers both fallible reads.**
        // An undecodable revision (should not happen: `headHash` came from
        // `evo.head`) and a broken or missing snapshot blob were two
        // hand-written `if (r[0] === 'error') return pureOk(undefined)` arms;
        // both mean the same thing here — this (subject, head) pair yields no
        // row — so they are one recovery now. It must stay a per-pair
        // recovery: `foldStep` short-circuits on the first `error` since
        // 0.46.0, so letting either failure reach the fold would drop every
        // remaining document rather than this one row.
        return catchStep(resolved, () => pureOk(undefined))
    }
    return toolEntry(
        'finance_documents_list',
        'Enumerates stored documents as a JSON array of ' +
        '{subject, dialect, taxYear, hash}. Active by default; pass ' +
        'archived: true to list archived documents instead. One row per ' +
        '(subject, head) pair -- a subject with concurrent heads yields ' +
        'one row per head, all sharing the same subject.',
        { archived: or(option, true) },
        // `toolResultStep` (MAINT-11) states the value and error renderers in one
        // call; it is what deleted the `mapStep`/`catchStep` sandwich that used
        // to wrap this fold on both sides.
        ({ archived }) => toolResultStep(
            step(
                evo.list(archived),
                subjects => foldStep(
                    pureOk(subjects),
                    /** @type {readonly DocumentListEntry[]} */ ([]),
                    subject => acc => step(
                        evo.head(subject),
                        heads => foldStep(
                            pureOk(heads),
                            acc,
                            headHash => innerAcc => mapStep(
                                entryFor(subject)(headHash),
                                entry => entry === undefined ? innerAcc : [...innerAcc, entry],
                            ),
                        ),
                    ),
                ),
            ),
            jsonText,
            // An MCP handler answers `never`: a runner that cannot dispatch
            // `evo.list`/`evo.head` becomes a JSON-RPC error response here
            // rather than a failure the transport has to carry.
            e => `finance_documents_list failed: ${errorSummary(e)}`),
    )
}

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
 * Runs `financeDocumentsListTool(...).handle` against an already-seeded
 * store under `virtual`, and returns the parsed `DocumentListEntry[]` — the
 * handler issues real `Cas`/`Evo` effects (unlike `finance_schema`'s/
 * `finance_tax_params`'s `pure`-only handlers), so it must be driven through
 * `virtual`, never `runPure`.
 * @type {(state: State) => (cas: FileCas) => (e: Evo<FileCasOperation>) =>
 *   (args: { readonly archived?: true }) => readonly DocumentListEntry[]}
 */
const listThrough = state => cas => e => args => {
    const tool = financeDocumentsListTool(e)(cas)
    const [, result] = virtualOrPanic(state)(tool.handle(args))
    assert(result.isError !== true, ['expected finance_documents_list to succeed', result])
    const item = result.content[0]
    assert(item !== undefined && item.type === 'text', ['expected a text content item', item])
    const [t, parsed] = parse(item.text)
    assert(t === 'ok', ['expected the response to be valid JSON', item.text])
    return /** @type {readonly DocumentListEntry[]} */ (parsed)
}

/**
 * Finds the entry for `subject` in `entries`, or `undefined` if absent.
 * @type {(entries: readonly DocumentListEntry[]) => (subject: string) => DocumentListEntry | undefined}
 */
const findSubject = entries => subject => entries.find(entry => entry.subject === subject)

/**
 * Writes `text` to `cas` and returns its cBase32 hash, threading `state`.
 * Shared by both fixtures below — {@link buildFixture}'s seven writes and
 * {@link buildStubbedRevisionFixture}'s single one.
 * @type {(cas: FileCas) => (state: State) => (text: string) => readonly [State, string]}
 */
const writeDocTo = cas => state => text => {
    const bytes = tryUtf8(text)
    assert(bytes !== null, ['expected the sample document to encode as UTF-8', text])
    const [nextState, writeResult] = virtual(state)(
        cas.write(oneChunk(bytes)))
    assert(writeResult[0] === 'ok', ['expected the document write to succeed', writeResult])
    return /** @type {const} */ ([nextState, vecToCBase32(writeResult[1])])
}

/**
 * Seeds a fresh, `virtual`-backed store with every document shape this
 * module's proof needs, and returns the active/archived lists
 * `finance_documents_list` itself computes over that store. Called fresh by
 * every leaf below (never memoized at module scope) so each leaf's
 * assertion is independent of any other leaf having run first — `virtual`
 * never touches the real filesystem, so re-seeding on every call is cheap
 * and side-effect-free.
 *
 * Seeds, per the plan: (1) an active document with a KNOWN dialect; (2) a
 * well-formed document with an UNREGISTERED dialect tag; (3) a well-formed
 * document with NO dialect field at all; (3b) a well-formed document whose
 * `dialect` field is PRESENT but the wrong JSON type (IN-01); (4) an
 * archived-only subject (one `evo.add` with `archived: true`, no prior
 * active head); (5) a non-JSON snapshot blob, written directly via
 * `cas.write` and pointed at by a revision; (6) a subject with two
 * concurrent, unmerged heads.
 * @type {() => {
 *   readonly active: readonly DocumentListEntry[],
 *   readonly archived: readonly DocumentListEntry[],
 * }}
 */
/**
 * Well-formed cBase32 that names a blob nothing ever wrote — the read failure
 * `entryFor` recovers from, as distinct from a blob that is present and does
 * not parse.
 */
const absentSnapshotHash = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'

const buildFixture = () => {
    const home = '/'
    const cas = fileCas(sha256)(home)
    const [state0, cacheKey] = virtualOrPanic(emptyState)(initEvo(cas))
    const e = evoOf(cas)(cacheKey)

    const writeDoc = writeDocTo(cas)

    // (1) An active document with a KNOWN dialect.
    const [state1, knownHash] = writeDoc(state0)(
        JSON.stringify({ dialect: 'vnd.fjs.1099int', taxYear: 2025, box1InterestIncome: '12.34' }))
    const [state2, knownAdd] = virtual(state1)(
        e.add({ parents: [], subject: 'subjectKnown', snapshot: knownHash }))
    assert(knownAdd[0] === 'ok', ['expected the known-dialect add to succeed', knownAdd])

    // (2) A well-formed document with an UNREGISTERED dialect tag.
    const [state3, unknownDialectHash] = writeDoc(state2)(
        JSON.stringify({ dialect: 'vnd.fjs.not-a-real-dialect', taxYear: 2025 }))
    const [state4, unknownDialectAdd] = virtual(state3)(
        e.add({ parents: [], subject: 'subjectUnknownDialect', snapshot: unknownDialectHash }))
    assert(unknownDialectAdd[0] === 'ok', ['expected the unknown-dialect add to succeed', unknownDialectAdd])

    // (3) A well-formed document with NO dialect field at all.
    const [state5, noDialectHash] = writeDoc(state4)(JSON.stringify({ taxYear: 2025 }))
    const [state6, noDialectAdd] = virtual(state5)(
        e.add({ parents: [], subject: 'subjectNoDialectField', snapshot: noDialectHash }))
    assert(noDialectAdd[0] === 'ok', ['expected the no-dialect-field add to succeed', noDialectAdd])

    // (3b) IN-01: a well-formed document whose `dialect` field is PRESENT
    // but the WRONG JSON type (a number, not a string) -- a distinct way to
    // fail documentIdentitySchema's structural validation from (3)'s
    // missing-field case, folded into the SAME 'unknown' sentinel (see the
    // module header's "The 'unknown' sentinel" section).
    const [state7, wrongTypeDialectHash] = writeDoc(state6)(JSON.stringify({ dialect: 123, taxYear: 2025 }))
    const [state8, wrongTypeDialectAdd] = virtual(state7)(
        e.add({ parents: [], subject: 'subjectWrongTypeDialect', snapshot: wrongTypeDialectHash }))
    assert(wrongTypeDialectAdd[0] === 'ok', ['expected the wrong-type-dialect add to succeed', wrongTypeDialectAdd])

    // (4) An archived-only subject: one add with archived: true, no prior
    // active head.
    const [state9, archivedHash] = writeDoc(state8)(
        JSON.stringify({ dialect: 'vnd.fjs.1099int', taxYear: 2025 }))
    const [state10, archivedAdd] = virtual(state9)(
        e.add({ parents: [], subject: 'subjectArchived', snapshot: archivedHash, archived: true }))
    assert(archivedAdd[0] === 'ok', ['expected the archived-only add to succeed', archivedAdd])

    // (5) A non-JSON snapshot blob, written directly via cas.write and
    // pointed at by a revision.
    const brokenBytes = tryUtf8('not valid json at all {{{')
    assert(brokenBytes !== null, 'expected the broken sample to encode as UTF-8')
    const [state11, brokenWrite] = virtual(state10)(
        cas.write(oneChunk(brokenBytes)))
    assert(brokenWrite[0] === 'ok', ['expected the broken-blob write to succeed', brokenWrite])
    const brokenHash = vecToCBase32(brokenWrite[1])
    const [state12, brokenAdd] = virtual(state11)(
        e.add({ parents: [], subject: 'subjectBrokenSnapshot', snapshot: brokenHash }))
    assert(brokenAdd[0] === 'ok', ['expected the broken-snapshot add to succeed', brokenAdd])

    // (6) A subject with two concurrent, unmerged heads.
    const [state13, concurrentHashA] = writeDoc(state12)(
        JSON.stringify({ dialect: 'vnd.fjs.1099int', taxYear: 2025, box1InterestIncome: '1.00' }))
    const [state14, concurrentAddA] = virtual(state13)(
        e.add({ parents: [], subject: 'subjectConcurrent', snapshot: concurrentHashA }))
    assert(concurrentAddA[0] === 'ok', ['expected the first concurrent add to succeed', concurrentAddA])
    const [state15, concurrentHashB] = writeDoc(state14)(
        JSON.stringify({ dialect: 'vnd.fjs.1099int', taxYear: 2025, box1InterestIncome: '2.00' }))
    const [state16, concurrentAddB] = virtual(state15)(
        e.add({ parents: [], subject: 'subjectConcurrent', snapshot: concurrentHashB }))
    assert(concurrentAddB[0] === 'ok', ['expected the second concurrent add to succeed', concurrentAddB])

    // (7) A revision whose snapshot hash is well-formed cBase32 but names a
    // blob that was never written. This is the ONLY case that reaches
    // `entryFor`'s `catchStep` recovery: (5)'s broken blob is present and
    // fails to PARSE, which the decode arm answers, while an absent blob
    // fails to READ. Until this fixture existed the recovery had no coverage
    // at all, so the "skip this pair, never crash" behaviour the module
    // header promises was a claim rather than a demonstrated property.
    const [state17, absentAdd] = virtual(state16)(
        e.add({ parents: [], subject: 'subjectAbsentSnapshot', snapshot: absentSnapshotHash }))
    assert(absentAdd[0] === 'ok', ['expected the absent-snapshot add to succeed', absentAdd])

    return {
        active: listThrough(state17)(cas)(e)({}),
        archived: listThrough(state17)(cas)(e)({ archived: true }),
    }
}

// ── The two "should not happen" narrows in `entryFor`, and how to reach them ──
//
// `entryFor` narrows twice on a `RevisionData` it has just read: `snapshot`
// absent, and `snapshot` present but not decodable as cBase32. Neither can
// be reached by seeding the STORE, and it is worth writing down why rather
// than leaving the next reader to rediscover it. `evo.revision` is
// upstream's `readRevision`, which decodes the blob through
// `fjs/media/revision`'s `validate` -- where `snapshot` is a REQUIRED field
// and `checkReferences` rejects one that fails `isHash` -- and then projects
// it through `toRevisionData`, which re-spells the field as
// `canonicalHash(snapshot)`. So a hand-written revision blob missing
// `snapshot`, or carrying an undecodable one, does not produce a
// snapshot-less `RevisionData`: it fails to decode at all, and the row is
// skipped by the `catchStep` that `absentSnapshotSkippedAndTheRestSurvive`
// already covers. Verified against upstream 0.48.0 directly.
//
// What CAN produce it is the tool's own parameter. `financeDocumentsListTool`
// is generic over `Evo<O>`, whose `revision` is declared to answer a
// `RevisionData` -- and `RevisionData.snapshot` is `Hash | undefined`,
// because that one type is the shared input/output vocabulary of `add` and
// `revision` alike (the narrows' own comment says exactly this). A conforming
// `Evo` may therefore answer without a `snapshot`, and the tool's documented
// contract is that such a row is SKIPPED rather than crashing the MCP
// transport (T-11-03-01). That contract is stated at the parameter, so it is
// proven at the parameter.
//
// The fabrication is kept to one method: `list`, `head` and `add` are the
// real store's, the store itself is really seeded, and only the ONE
// `revision` answer for a hash the fixture names is swapped. Each leaf below
// pairs the stubbed listing against the SAME store listed through the
// unmodified `Evo`, so "absent because skipped" is told apart from "absent
// because the fixture never stored it".

/**
 * `real`, with `revision` answering from `answers` for the hashes it names
 * and delegating every other hash — and every other method — unchanged.
 * @type {(real: Evo<FileCasOperation>) => (answers: Readonly<Record<string, RevisionData>>) => Evo<FileCasOperation>}
 */
const evoAnsweringRevisions = real => answers => ({
    ...real,
    revision: hash => {
        const answer = answers[hash]
        return answer === undefined ? real.revision(hash) : pureOk(answer)
    },
})

/**
 * `real`, with `list` failing on the channel `Evo` declares for it.
 *
 * `notImplemented` rather than an `evoError`, and the choice is forced:
 * `Evo.list`'s channel is `EvoChannel = EvoError | NotImplemented`, this
 * tool renders its failures with `errorSummary` (an `IoChannel` renderer),
 * and `EvoError` is not an `IoChannel` — so `NotImplemented` is the only
 * value that both a conforming `Evo` may raise and this tool's own renderer
 * can be handed. It is also the realistic one: the shipped `evo.list` is a
 * memory-cache read, whose only failure is a runner that cannot dispatch it.
 * @type {(real: Evo<FileCasOperation>) => (command: string) => Evo<FileCasOperation>}
 */
const evoWhoseListCannotBeDispatched = real => command => ({
    ...real,
    list: () => pureError(notImplemented(command)),
})

/** The `snapshot` reference the stubbed revision carries: not cBase32, so `cBase32ToVec` answers `null`. */
const undecodableSnapshotRef = '!!! not a cbase32 hash !!!'

/**
 * A small store — one ordinary subject and two whose single head is answered
 * by {@link evoAnsweringRevisions} — listed BOTH ways: through the real
 * `Evo` and through the stub. See the block comment above for why the stub
 * is the only route to `entryFor`'s two narrows.
 *
 * All three subjects are added through the real `evo.add`, so every one of
 * them genuinely exists, genuinely has a head, and genuinely resolves — the
 * `real` listing below asserts that, and it is what makes the stubbed
 * listing's omissions mean something.
 * @type {() => {
 *   readonly real: readonly DocumentListEntry[],
 *   readonly stubbed: readonly DocumentListEntry[],
 *   readonly listFailure: ToolsCallResult,
 * }}
 */
const buildStubbedRevisionFixture = () => {
    const home = '/'
    const cas = fileCas(sha256)(home)
    const [state0, cacheKey] = virtualOrPanic(emptyState)(initEvo(cas))
    const real = evoOf(cas)(cacheKey)
    const writeDoc = writeDocTo(cas)

    // One document, three subjects pointing at it. The subjects differ, so
    // the three revisions differ, so their head hashes differ — which is
    // what lets the stub answer for two of them and not the third.
    const [state1, docHash] = writeDoc(state0)(
        JSON.stringify({ dialect: 'vnd.fjs.1099int', taxYear: 2025, box1InterestIncome: '3.00' }))
    const [state2, controlAdd] = virtual(state1)(
        real.add({ parents: [], subject: 'subjectControl', snapshot: docHash }))
    assert(controlAdd[0] === 'ok', ['expected the control add to succeed', controlAdd])
    const [state3, snapshotlessAdd] = virtual(state2)(
        real.add({ parents: [], subject: 'subjectSnapshotlessRevision', snapshot: docHash }))
    assert(snapshotlessAdd[0] === 'ok', ['expected the snapshotless-subject add to succeed', snapshotlessAdd])
    const [state4, undecodableAdd] = virtual(state3)(
        real.add({ parents: [], subject: 'subjectUndecodableSnapshotRef', snapshot: docHash }))
    assert(undecodableAdd[0] === 'ok', ['expected the undecodable-ref-subject add to succeed', undecodableAdd])

    const stub = evoAnsweringRevisions(real)({
        // No `snapshot` at all — legal `RevisionData`, and the field the
        // first narrow is about.
        [snapshotlessAdd[1]]: { parents: [], subject: 'subjectSnapshotlessRevision', generation: 0 },
        // A `snapshot` that is present and does not decode — the second.
        [undecodableAdd[1]]: {
            parents: [],
            subject: 'subjectUndecodableSnapshotRef',
            snapshot: undecodableSnapshotRef,
            generation: 0,
        },
    })
    const failing = financeDocumentsListTool(evoWhoseListCannotBeDispatched(real)('evo.list'))(cas)
    return {
        real: listThrough(state4)(cas)(real)({}),
        stubbed: listThrough(state4)(cas)(stub)({}),
        listFailure: virtualOrPanic(state4)(failing.handle({}))[1],
    }
}

export const proof = {
    financeDocumentsListTool: {
        // The default (no archived arg) call includes every active
        // document -- known dialect, unknown dialect, and no-dialect-field
        // alike -- and excludes the archived-only subject.
        activeByDefault: () => {
            const { active } = buildFixture()
            assert(findSubject(active)('subjectKnown') !== undefined, active)
            assert(findSubject(active)('subjectUnknownDialect') !== undefined, active)
            assert(findSubject(active)('subjectNoDialectField') !== undefined, active)
            assertEq(findSubject(active)('subjectArchived'), undefined)
        },
        // { archived: true } includes the archived-only subject and
        // excludes every active one.
        archivedOptIn: () => {
            const { archived } = buildFixture()
            assert(findSubject(archived)('subjectArchived') !== undefined, archived)
            assertEq(findSubject(archived)('subjectKnown'), undefined)
            assertEq(findSubject(archived)('subjectUnknownDialect'), undefined)
            assertEq(findSubject(archived)('subjectNoDialectField'), undefined)
        },
        // A NORMAL stored document -- one carrying form-specific fields
        // beyond the two {@link documentIdentitySchema} names -- is reported
        // with its REAL dialect and taxYear. This is the case every other
        // leaf here missed: `subjectKnown` has carried
        // `box1InterestIncome` since this fixture was written, but nothing
        // asserted what its row said, so a closed identity schema would
        // silently report every real document as 'unknown' with no taxYear
        // and the suite would stay green. Both literals are hand-typed
        // against the fixture blob, never read back from it.
        realDocumentWithFormFieldsKeepsItsIdentity: () => {
            const { active } = buildFixture()
            const entry = findSubject(active)('subjectKnown')
            assert(entry !== undefined, active)
            assertEq(entry.dialect, 'vnd.fjs.1099int')
            assertEq(entry.taxYear, 2025)
        },
        // An unregistered dialect tag is carried through verbatim -- never
        // hidden, never coerced to the 'unknown' sentinel.
        unknownDialectListedWithRealTag: () => {
            const { active } = buildFixture()
            const entry = findSubject(active)('subjectUnknownDialect')
            assert(entry !== undefined, active)
            assertEq(entry.dialect, 'vnd.fjs.not-a-real-dialect')
        },
        // A well-formed document with no dialect field at all uses the
        // 'unknown' sentinel -- a DISTINCT case and a DISTINCT leaf from
        // the unregistered-dialect case above, per this file's own module
        // header ("The 'unknown' sentinel" vs. "No dialect-registry
        // validation").
        missingDialectFieldUsesSentinel: () => {
            const { active } = buildFixture()
            const entry = findSubject(active)('subjectNoDialectField')
            assert(entry !== undefined, active)
            assertEq(entry.dialect, 'unknown')
        },
        // IN-01: a PRESENT but wrongly-typed `dialect` field (a number, not
        // a string) is a DISTINCT structural-validation failure from the
        // missing-field case above, and this pins that it is folded into
        // the SAME 'unknown' sentinel rather than crashing or being treated
        // as a genuine dialect tag.
        wrongTypeDialectFieldUsesSentinel: () => {
            const { active } = buildFixture()
            const entry = findSubject(active)('subjectWrongTypeDialect')
            assert(entry !== undefined, active)
            assertEq(entry.dialect, 'unknown')
        },
        // A non-JSON snapshot blob is skipped, not crashed on: absent from
        // EITHER list, and buildFixture (which drives both calls) already
        // completed without throwing.
        brokenSnapshotSkippedNotCrashed: () => {
            const { active, archived } = buildFixture()
            assertEq(findSubject(active)('subjectBrokenSnapshot'), undefined)
            assertEq(findSubject(archived)('subjectBrokenSnapshot'), undefined)
        },
        /**
         * The OTHER way a snapshot fails, and the one `entryFor`'s `catchStep`
         * recovery exists for: the blob is not there to read at all, rather
         * than present and unparseable. The leaf above cannot reach that arm —
         * its blob reads fine and fails to decode.
         *
         * Both must skip rather than crash, and both must leave every other
         * subject in the listing: `foldStep` short-circuits on the first error
         * since 0.46.0, so a failure escaping the per-pair recovery would drop
         * the remaining documents rather than this one row. That is what the
         * second half asserts.
         */
        absentSnapshotSkippedAndTheRestSurvive: () => {
            const { active, archived } = buildFixture()
            assertEq(findSubject(active)('subjectAbsentSnapshot'), undefined)
            assertEq(findSubject(archived)('subjectAbsentSnapshot'), undefined)
            assert(findSubject(active)('subjectKnown') !== undefined, active)
            assert(findSubject(active)('subjectConcurrent') !== undefined, active)
        },
        // Every entry in a non-empty result carries subject/dialect/hash,
        // and taxYear is either a number or genuinely absent -- never
        // null, never the string "undefined" (the conditional-spread
        // discipline's own failure mode).
        entryShape: () => {
            const { active, archived } = buildFixture()
            const all = [...active, ...archived]
            assert(all.length > 0, 'expected at least one entry to check the shape of')
            for (const entry of all) {
                assert(typeof entry.subject === 'string', entry)
                assert(typeof entry.dialect === 'string', entry)
                assert(typeof entry.hash === 'string', entry)
                assert(
                    entry.taxYear === undefined || typeof entry.taxYear === 'number',
                    ['expected taxYear to be a number or absent, never null/string', entry],
                )
            }
        },
        // A subject with two concurrent, unmerged heads yields two rows
        // sharing the same subject but carrying different hashes -- the
        // design choice this file's module header documents, verified
        // behaviorally rather than only asserted in prose.
        oneRowPerSubjectHeadPair: () => {
            const { active } = buildFixture()
            const concurrentEntries = active.filter(entry => entry.subject === 'subjectConcurrent')
            assertEq(concurrentEntries.length, 2)
            const [first, second] = concurrentEntries
            assert(first !== undefined && second !== undefined, concurrentEntries)
            assert(first.hash !== second.hash, concurrentEntries)
        },
        /**
         * The `Evo` the tool is handed answers a `RevisionData` carrying NO
         * `snapshot` — legal under the type `Evo.revision` declares, and the
         * first of `entryFor`'s two "should not happen" narrows. The row is
         * SKIPPED, not crashed on: the module header's failure-mode contract
         * (T-11-03-01) says a `RevisionData` with no resolvable snapshot is a
         * skip, and this is that sentence measured.
         *
         * **The control is the same store listed through the unmodified
         * `Evo`**, where the subject IS present. Without it this leaf would
         * pass just as happily against a fixture that never stored the
         * subject at all.
         *
         * The survivors matter for a second reason: `foldStep` short-circuits
         * on the first `error` since 0.46.0, so a narrow that let the failure
         * out instead of answering `pureOk(undefined)` would drop every
         * remaining document, not just this row.
         */
        aRevisionWithNoSnapshotIsSkippedNotCrashedOn: () => {
            const { real, stubbed } = buildStubbedRevisionFixture()
            assert(
                findSubject(real)('subjectSnapshotlessRevision') !== undefined,
                ['the subject must really be listed when its revision resolves', real])
            assertEq(findSubject(stubbed)('subjectSnapshotlessRevision'), undefined)
            assert(findSubject(stubbed)('subjectControl') !== undefined, stubbed)
            assert(findSubject(stubbed)('subjectUndecodableSnapshotRef') === undefined, stubbed)
        },
        /**
         * The second narrow: a `snapshot` that is PRESENT and does not decode
         * as cBase32 ({@link undecodableSnapshotRef}). A distinct case from
         * the one above and from `absentSnapshotSkippedAndTheRestSurvive`,
         * whose reference decodes fine and names a blob nothing wrote — three
         * different points on the same path, each skipping the row.
         *
         * Same control shape: the subject is listed through the real `Evo`,
         * and `subjectControl` survives the skip.
         */
        anUndecodableSnapshotReferenceIsSkippedNotCrashedOn: () => {
            const { real, stubbed } = buildStubbedRevisionFixture()
            assert(
                findSubject(real)('subjectUndecodableSnapshotRef') !== undefined,
                ['the subject must really be listed when its revision resolves', real])
            assertEq(findSubject(stubbed)('subjectUndecodableSnapshotRef'), undefined)
            assert(findSubject(stubbed)('subjectControl') !== undefined, stubbed)
        },
        /**
         * The handler's own error renderer. `entryFor` recovers per (subject,
         * head) pair, so nothing a single document does can reach it — only a
         * failure of `evo.list`/`evo.head` themselves, which the shipped
         * `Evo` serves from a memory cache and so cannot fail against a
         * working runner.
         *
         * What the leaf pins is the module header's transport claim: such a
         * failure becomes an `isError: true` RESULT naming the tool, never a
         * failure the JSON-RPC transport has to carry. Both halves are
         * asserted — the tool's own prefix, and upstream's rendering of the
         * channel value, which is the part that tells a caller WHAT failed.
         */
        aListFailureBecomesAnErrorResultNamingTheTool: () => {
            const { listFailure } = buildStubbedRevisionFixture()
            assertEq(listFailure.isError, true)
            const item = listFailure.content[0]
            assert(item !== undefined && item.type === 'text', ['expected a text content item', listFailure])
            assertEq(item.text, 'finance_documents_list failed: operation not implemented: evo.list')
        },
    },
}
