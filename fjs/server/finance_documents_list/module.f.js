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
 * identity-peek schema: rtti permits properties a schema does not mention
 * (verified against `fjs/server/module.f.js`'s own comment to the same
 * effect), so any real document — which always carries a required
 * `dialect: string` and `taxYear: number` under every existing dialect's own
 * schema — validates against this loose schema trivially, and every other
 * field is simply ignored.
 *
 * ## The `'unknown'` sentinel — a deliberate, arbitrary-but-recorded pick
 *
 * A parsed snapshot that is well-formed JSON but carries NO `dialect` field
 * at all is structurally possible under the loose schema above. CONTEXT does
 * not name a sentinel for this case (RESEARCH.md Assumption A2); this module
 * picks the literal string `'unknown'`. Any documented choice would satisfy
 * the stated success criteria — this one is recorded here so a future reader
 * does not mistake it for a discovered convention.
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
import { number, option, string } from 'functionalscript/fjs/types/rtti/module.f.js'
import { validate as rttiValidate } from 'functionalscript/fjs/types/rtti/validate/module.f.js'
import { step, mapStep, foldStep, pure } from 'functionalscript/fjs/effects/module.f.js'
import { collectRead, fileCas } from 'functionalscript/fjs/cas/module.f.js'
import { cBase32ToVec, vecToCBase32 } from 'functionalscript/fjs/basen/cbase32/module.f.js'
import { utf8ToString, tryUtf8 } from 'functionalscript/fjs/text/module.f.js'
import { toolEntry, okResult } from 'functionalscript/fjs/protocol/mcp/module.f.js'
import { initEvo, evo as evoOf } from 'functionalscript/fjs/cas/evo/module.f.js'
import { sha256 } from 'functionalscript/fjs/crypto/sha2/module.f.js'
import { emptyState, virtual } from 'functionalscript/fjs/effects/node/virtual/module.f.js'
import { ok } from 'functionalscript/fjs/types/result/module.f.js'
import { assert, assertEq } from 'functionalscript/fjs/asserts/module.f.js'
import { parse, stringify as jsonText } from '../../json/module.f.js'

/** @import { Operation } from 'functionalscript/fjs/effects/module.f.js' */
/** @import { MemOp } from 'functionalscript/fjs/effects/memory/module.f.js' */
/** @import { Cas, FileCas, FileCasOperation } from 'functionalscript/fjs/cas/module.f.js' */
/** @import { Evo } from 'functionalscript/fjs/cas/evo/module.f.js' */
/** @import { ToolEntry } from 'functionalscript/fjs/protocol/mcp/module.f.js' */
/** @import { State } from 'functionalscript/fjs/effects/node/virtual/module.f.js' */

/**
 * A LOCAL, deliberately loose identity-peek schema — see the module header's
 * "No dialect-registry validation" section for why this never imports
 * `finance_schema`'s own lookup map.
 */
const documentIdentitySchema = /** @type {const} */ ({ dialect: option(string), taxYear: option(number) })

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
    const entryFor = (/** @type {string} */ subject) => (/** @type {string} */ headHash) => step(
        evo.revision(headHash),
        revResult => {
            if (revResult[0] === 'error') {
                // Should not happen: headHash was itself just returned by
                // evo.head, but code defensively per this project's
                // noUncheckedIndexedAccess discipline.
                return pure(undefined)
            }
            const snapshotRef = revResult[1].snapshot
            if (snapshotRef === undefined) {
                // Should not happen either: readRevision's own contract
                // says `snapshot` is "always present" on output, but the
                // field is typed optional (RevisionData's input/output
                // vocabulary is shared) -- narrow rather than assume.
                return pure(undefined)
            }
            const snapshotHash = cBase32ToVec(snapshotRef)
            if (snapshotHash === null) {
                return pure(undefined)
            }
            return step(
                collectRead(cas.read(snapshotHash)),
                blobResult => {
                    if (blobResult[0] === 'error') {
                        // A genuinely broken/missing snapshot blob -- skip.
                        return pure(undefined)
                    }
                    const [parseTag, parsed] = parse(utf8ToString(blobResult[1]))
                    if (parseTag === 'error') {
                        // The "non-JSON snapshot blob" skip case -- see the
                        // module header's "Failure modes" section.
                        return pure(undefined)
                    }
                    const [t, identity] = rttiValidate(documentIdentitySchema)(parsed)
                    const dialect = t === 'ok' && identity.dialect !== undefined
                        ? identity.dialect
                        : 'unknown'
                    const taxYear = t === 'ok' ? identity.taxYear : undefined
                    /** @type {DocumentListEntry} */
                    const entry = { subject, dialect, ...(taxYear === undefined ? {} : { taxYear }), hash: headHash }
                    return pure(entry)
                },
            )
        },
    )
    return toolEntry(
        'finance_documents_list',
        'Enumerates stored documents as a JSON array of ' +
        '{subject, dialect, taxYear, hash}. Active by default; pass ' +
        'archived: true to list archived documents instead. One row per ' +
        '(subject, head) pair -- a subject with concurrent heads yields ' +
        'one row per head, all sharing the same subject.',
        { archived: option(true) },
        ({ archived }) => mapStep(
            step(
                evo.list(archived),
                subjects => foldStep(
                    pure(subjects),
                    /** @type {readonly DocumentListEntry[]} */ ([]),
                    subject => acc => step(
                        evo.head(subject),
                        heads => foldStep(
                            pure(heads),
                            acc,
                            headHash => innerAcc => mapStep(
                                entryFor(subject)(headHash),
                                entry => entry === undefined ? innerAcc : [...innerAcc, entry],
                            ),
                        ),
                    ),
                ),
            ),
            list => okResult(jsonText(list)),
        ),
    )
}

// ── Tests ────────────────────────────────────────────────────────────────────

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
    const [, result] = virtual(state)(tool.handle(args))
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
 * document with NO dialect field at all; (4) an archived-only subject (one
 * `evo.add` with `archived: true`, no prior active head); (5) a non-JSON
 * snapshot blob, written directly via `cas.write` and pointed at by a
 * revision; (6) a subject with two concurrent, unmerged heads.
 * @type {() => {
 *   readonly active: readonly DocumentListEntry[],
 *   readonly archived: readonly DocumentListEntry[],
 * }}
 */
const buildFixture = () => {
    const home = '/'
    const cas = fileCas(sha256)(home)
    const [state0, cacheKey] = virtual(emptyState)(initEvo(cas))
    const e = evoOf(cas)(cacheKey)

    /**
     * Writes `text` to CAS and returns its cBase32 hash, threading `state`.
     * @type {(state: State) => (text: string) => readonly [State, string]}
     */
    const writeDoc = state => text => {
        const bytes = tryUtf8(text)
        assert(bytes !== null, ['expected the sample document to encode as UTF-8', text])
        const [nextState, writeResult] = virtual(state)(
            cas.write(pure({ first: ok(bytes), tail: pure(undefined) })))
        assert(writeResult[0] === 'ok', ['expected the document write to succeed', writeResult])
        return /** @type {const} */ ([nextState, vecToCBase32(writeResult[1])])
    }

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

    // (4) An archived-only subject: one add with archived: true, no prior
    // active head.
    const [state7, archivedHash] = writeDoc(state6)(
        JSON.stringify({ dialect: 'vnd.fjs.1099int', taxYear: 2025 }))
    const [state8, archivedAdd] = virtual(state7)(
        e.add({ parents: [], subject: 'subjectArchived', snapshot: archivedHash, archived: true }))
    assert(archivedAdd[0] === 'ok', ['expected the archived-only add to succeed', archivedAdd])

    // (5) A non-JSON snapshot blob, written directly via cas.write and
    // pointed at by a revision.
    const brokenBytes = tryUtf8('not valid json at all {{{')
    assert(brokenBytes !== null, 'expected the broken sample to encode as UTF-8')
    const [state9, brokenWrite] = virtual(state8)(
        cas.write(pure({ first: ok(brokenBytes), tail: pure(undefined) })))
    assert(brokenWrite[0] === 'ok', ['expected the broken-blob write to succeed', brokenWrite])
    const brokenHash = vecToCBase32(brokenWrite[1])
    const [state10, brokenAdd] = virtual(state9)(
        e.add({ parents: [], subject: 'subjectBrokenSnapshot', snapshot: brokenHash }))
    assert(brokenAdd[0] === 'ok', ['expected the broken-snapshot add to succeed', brokenAdd])

    // (6) A subject with two concurrent, unmerged heads.
    const [state11, concurrentHashA] = writeDoc(state10)(
        JSON.stringify({ dialect: 'vnd.fjs.1099int', taxYear: 2025, box1InterestIncome: '1.00' }))
    const [state12, concurrentAddA] = virtual(state11)(
        e.add({ parents: [], subject: 'subjectConcurrent', snapshot: concurrentHashA }))
    assert(concurrentAddA[0] === 'ok', ['expected the first concurrent add to succeed', concurrentAddA])
    const [state13, concurrentHashB] = writeDoc(state12)(
        JSON.stringify({ dialect: 'vnd.fjs.1099int', taxYear: 2025, box1InterestIncome: '2.00' }))
    const [state14, concurrentAddB] = virtual(state13)(
        e.add({ parents: [], subject: 'subjectConcurrent', snapshot: concurrentHashB }))
    assert(concurrentAddB[0] === 'ok', ['expected the second concurrent add to succeed', concurrentAddB])

    return {
        active: listThrough(state14)(cas)(e)({}),
        archived: listThrough(state14)(cas)(e)({ archived: true }),
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
        // A non-JSON snapshot blob is skipped, not crashed on: absent from
        // EITHER list, and buildFixture (which drives both calls) already
        // completed without throwing.
        brokenSnapshotSkippedNotCrashed: () => {
            const { active, archived } = buildFixture()
            assertEq(findSubject(active)('subjectBrokenSnapshot'), undefined)
            assertEq(findSubject(archived)('subjectBrokenSnapshot'), undefined)
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
    },
}
