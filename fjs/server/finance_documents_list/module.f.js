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
import { collectRead } from 'functionalscript/fjs/cas/module.f.js'
import { cBase32ToVec } from 'functionalscript/fjs/basen/cbase32/module.f.js'
import { utf8ToString } from 'functionalscript/fjs/text/module.f.js'
import { toolEntry, okResult } from 'functionalscript/fjs/protocol/mcp/module.f.js'
import { parse, stringify as jsonText } from '../../json/module.f.js'

/** @import { Operation } from 'functionalscript/fjs/effects/module.f.js' */
/** @import { MemOp } from 'functionalscript/fjs/effects/memory/module.f.js' */
/** @import { Cas } from 'functionalscript/fjs/cas/module.f.js' */
/** @import { Evo } from 'functionalscript/fjs/cas/evo/module.f.js' */
/** @import { ToolEntry } from 'functionalscript/fjs/protocol/mcp/module.f.js' */

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
