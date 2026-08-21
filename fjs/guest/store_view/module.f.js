/**
 * A read-only store, as the four operations a guest program may ask for.
 *
 * `taxReturnReport` — the function twin of the bytes an agent stores and
 * `fjs_run` executes — reads documents through exactly four commands:
 * `evoList`, `evoHead`, `evoRevision` and `casRead`. Give it those four over
 * any pair of maps and it computes a return, wherever the maps came from: a
 * server's `$HOME/.cas`, a browser's IndexedDB, or a proof's literals.
 *
 * That is the whole point of this module. The hand-entry page needed a way to
 * feed typed documents to the engine, and the obvious move — assemble
 * `Form1040Inputs` in the page — would have been the THIRD assembly of that
 * structure in this repository. The 2026-08-20 milestone audit recorded the
 * first two and that nothing compares them. A third would have been a third
 * thing to keep in step with a dialect table that grows.
 *
 * ## Heads are derived, never stored
 *
 * A subject's heads are its revisions that no other revision names as a
 * parent. Storing a heads list beside the revisions would be a second
 * statement of the same fact, and an amendment that updated one and not the
 * other would show a superseded W-2 as if it were current — money counted
 * twice, quietly. Derived, that cannot happen.
 *
 * @module
 */
import { ok, error } from 'functionalscript/fjs/types/result/module.f.mjs'
import { assert, assertEq, assertNotNullish } from 'functionalscript/fjs/asserts/module.f.mjs'
import { interpret } from '../../exec/module.f.js'
import { taxGuestCtx } from '../tax/module.f.js'
import { taxReturnReport } from '../../report/tax_return/module.f.js'
import { taxParamsByYear } from '../../tax/params/module.f.js'
import { formSubject } from '../../document/subject/module.f.js'

/** @import { OperationMap, Return } from 'functionalscript/fjs/effects/types.js' */
/** @import { CasOp } from '../module.f.js' */

/**
 * A revision as this view needs to read it. Narrower than
 * `fjs/media/revision`'s `Revision` on purpose: these are the only members the
 * four operations touch, so a caller may hand over anything revision-shaped.
 *
 * @typedef {{
 *     readonly subject: string,
 *     readonly parents: readonly string[],
 *     readonly snapshot: string,
 *     readonly archived?: true | undefined,
 * }} StoredRevision
 */

/** @typedef {ReadonlyMap<string, StoredRevision>} Revisions */

/**
 * Every subject with at least one revision, in first-seen order.
 * @type {(revisions: Revisions) => readonly string[]}
 */
export const subjectsOf = revisions =>
    [...new Set([...revisions.values()].map(r => r.subject))]

/**
 * The revision hashes of `subject` that nothing supersedes — a revision no
 * other revision claims as a parent.
 * @type {(revisions: Revisions) => (subject: string) => readonly string[]}
 */
export const headsOf = revisions => subject => {
    const superseded = new Set([...revisions.values()].flatMap(r => [...r.parents]))
    return [...revisions.entries()]
        .filter(([hash, r]) => r.subject === subject && !superseded.has(hash))
        .map(([hash]) => hash)
}

/**
 * The four operations, over the two maps.
 *
 * Every failure answers `error` with a message naming what was asked for.
 * `casRead` of an absent hash is the case that matters: a document whose blob
 * is missing must stop the return, because the alternative is a return
 * computed from the documents that happened to load.
 *
 * The annotation is `OperationMap<CasOp, Return<CasOp>>` — the type
 * `interpret` accepts — rather than a hand-written record of four signatures.
 * Spelling the four out again would be a second statement of the guest
 * vocabulary that `fjs/guest`'s `CasOp` already owns, and adding a fifth
 * command upstream would then leave this file quietly behind.
 * @type {(store: { readonly blobs: ReadonlyMap<string, string>, readonly revisions: Revisions }) => OperationMap<CasOp, Return<CasOp>>}
 */
export const storeView = ({ blobs, revisions }) => ({
    casRead: hash => {
        const text = blobs.get(hash)
        return text === undefined ? error(`no such hash: ${hash}`) : ok(text)
    },
    // The argument is the string `'true'` or `'false'`: whether to include
    // archived subjects. Anything else is a caller bug rather than a subject
    // filter, and is refused instead of guessed at.
    evoList: includeArchived => {
        if (includeArchived !== 'true' && includeArchived !== 'false') {
            return error(`evoList expects 'true' or 'false', got: ${includeArchived}`)
        }
        const all = subjectsOf(revisions)
        const kept = includeArchived === 'true'
            ? all
            : all.filter(subject => !headsOf(revisions)(subject).every(hash =>
                revisions.get(hash)?.archived === true))
        return ok(JSON.stringify(kept))
    },
    evoHead: subject => ok(JSON.stringify(headsOf(revisions)(subject))),
    evoRevision: hash => {
        const revision = revisions.get(hash)
        return revision === undefined
            ? error(`no such revision: ${hash}`)
            : ok(JSON.stringify(revision))
    },
})

/** @type {(entries: readonly (readonly [string, StoredRevision])[]) => Revisions} */
const revisionsOf = entries => new Map(entries)

/** @type {(subject: string) => (snapshot: string) => (parents: readonly string[]) => StoredRevision} */
const revision = subject => snapshot => parents => ({ subject, parents, snapshot })

// ── The end-to-end proof's own two documents ─────────────────────────────────
//
// Hand-built here rather than imported from `demo/`: nothing under `fjs/` may
// depend on the demo. They are the smallest pair that produces a real return —
// a profile declaring wages, and one W-2 carrying them.

const proofW2 = {
    dialect: 'vnd.fjs.w2',
    taxYear: 2025,
    employerName: 'Acme',
    employerEIN: '11-1111111',
    employeeSSN: '222-22-2222',
    box1WagesTipsOtherCompensation: '60000.00',
    box2FederalIncomeTaxWithheld: '5000.00',
}

const proofProfile = {
    dialect: 'vnd.fjs.return_profile',
    taxYear: 2025,
    filingStatus: 'single',
    dependentCount: 0,
    declaredKinds: ['wages', 'federalTaxWithheldOnW2'],
}

const w2Subject = formSubject({
    payerTin: '11-1111111',
    recipientTin: '222-22-2222',
    accountNumber: '',
    taxYear: 2025,
    formType: 'vnd.fjs.w2',
})

/**
 * The two documents as a store. Blob keys are literal rather than real content
 * addresses: this view is hash-agnostic by construction — it looks blobs up by
 * whatever string a revision's `snapshot` names — so a real SHA-256 here would
 * add ceremony and prove nothing extra. The browser's store computes real ones
 * (`demo/lib/store.js`), and THAT is where the address matters.
 */
const proofStore = {
    blobs: new Map([
        ['blob-w2', JSON.stringify(proofW2)],
        ['blob-profile', JSON.stringify(proofProfile)],
    ]),
    revisions: revisionsOf([
        ['rev-w2', revision(w2Subject)('blob-w2')([])],
        ['rev-profile', revision('return-profile/2025')('blob-profile')([])],
    ]),
}

export const proof = {
    heads: {
        // One revision is its own head. The degenerate case, and the one every
        // freshly entered document is in.
        aLoneRevisionIsTheHead: () => {
            const r = revisionsOf([['rev-1', revision('w2/acme')('blob-1')([])]])
            assertEq(headsOf(r)('w2/acme').join(), 'rev-1')
            assertEq(subjectsOf(r).join(), 'w2/acme')
        },
        // An amendment supersedes: the corrected W-2 is the head and the
        // original is not, so the engine sees ONE W-2 rather than two. This is
        // the leaf that would redden if heads were ever stored rather than
        // derived and the two fell out of step.
        anAmendmentSupersedesItsParent: () => {
            const r = revisionsOf([
                ['rev-1', revision('w2/acme')('blob-1')([])],
                ['rev-2', revision('w2/acme')('blob-2')(['rev-1'])],
            ])
            assertEq(headsOf(r)('w2/acme').join(), 'rev-2')
        },
        // Two subjects do not contaminate each other, and a parent in one
        // subject does not suppress a same-named revision in another.
        subjectsAreIndependent: () => {
            const r = revisionsOf([
                ['rev-1', revision('w2/acme')('blob-1')([])],
                ['rev-2', revision('w2/beta')('blob-2')([])],
                ['rev-3', revision('w2/acme')('blob-3')(['rev-1'])],
            ])
            assertEq(headsOf(r)('w2/acme').join(), 'rev-3')
            assertEq(headsOf(r)('w2/beta').join(), 'rev-2')
            assertEq(subjectsOf(r).length, 2)
        },
    },
    // The decisive one. Everything above is a unit; this runs the ACTUAL guest
    // program -- `taxReturnReport`, the function twin of the bytes `fjs_run`
    // executes on the server -- against this view and gets a real 1040 back.
    // If this leaf is green, a browser holding these two maps computes the
    // same return the server does, through the same program.
    endToEnd: {
        theTwinComputesARealReturnThroughThisView: () => {
            const ctx = taxGuestCtx(assertNotNullish(taxParamsByYear['2025'], 'TY2025 parameters'))
            const [tag, value] = interpret(storeView(proofStore))(taxReturnReport(ctx)([]))
            assert(tag === 'ok', ['the program must run to completion', tag, value])
            if (tag !== 'ok') { return }
            const result = value[0]
            assertEq(result.kind, 'ok')
            if (result.kind !== 'ok') { return }
            // Line 1a is the W-2's box 1, to the cent, and it cites the
            // document it came from -- the citation is the demo's whole point.
            const line1a = assertNotNullish(
                result.lines.find(l => l.rule === '1040 line 1a'), 'line 1a')
            // A string, not a bigint: `RenderedLine.value` is the decimal
            // string the bigint projects to, because fjs's JSON primitive has
            // no bigint and the guest boundary is JSON.
            assertEq(line1a.value, '60000.00')
            assert(line1a.sources.length > 0, ['line 1a must cite a document'])
            // Line 25a is the W-2's box 2 -- withholding reaches the payments
            // section, so this is not one line computed in isolation.
            const line25a = assertNotNullish(
                result.lines.find(l => l.rule === '1040 line 25a'), 'line 25a')
            assertEq(line25a.value, '5000.00')
        },
        // The control: drop the W-2's blob and the SAME call must fail rather
        // than compute a return from the profile alone. A store view that
        // shrugs at a missing document is worse than none.
        aMissingBlobStopsTheReturn: () => {
            const ctx = taxGuestCtx(assertNotNullish(taxParamsByYear['2025'], 'TY2025 parameters'))
            const crippled = { blobs: new Map([...proofStore.blobs].filter(([k]) => k !== 'blob-w2')), revisions: proofStore.revisions }
            const [tag] = interpret(storeView(crippled))(taxReturnReport(ctx)([]))
            assertEq(tag, 'error')
        },
    },
    operations: {
        // The happy path of all four, against a store with one document.
        allFourAnswerFromTheMaps: () => {
            const view = storeView({
                blobs: new Map([['blob-1', '{"dialect":"vnd.fjs.w2"}']]),
                revisions: revisionsOf([['rev-1', revision('w2/acme')('blob-1')([])]]),
            })
            assertEq(view.evoList('false')[1], '["w2/acme"]')
            assertEq(view.evoHead('w2/acme')[1], '["rev-1"]')
            const [revisionTag, revisionText] = view.evoRevision('rev-1')
            assertEq(revisionTag, 'ok')
            assert(typeof revisionText === 'string' && revisionText.includes('blob-1'),
                ['a revision must name its snapshot', revisionText])
            assertEq(view.casRead('blob-1')[1], '{"dialect":"vnd.fjs.w2"}')
        },
        // A missing blob STOPS the return. The alternative -- an empty string,
        // or an empty document -- is a return computed from whatever happened
        // to load, which is the one outcome this project refuses to produce
        // quietly.
        anAbsentBlobIsAnErrorAndNotAnEmptyDocument: () => {
            const view = storeView({ blobs: new Map(), revisions: revisionsOf([]) })
            const [tag, message] = view.casRead('missing')
            assertEq(tag, 'error')
            assert(typeof message === 'string' && message.includes('missing'),
                ['the message must name the hash asked for', message])
        },
        anAbsentRevisionIsAnErrorToo: () => {
            const view = storeView({ blobs: new Map(), revisions: revisionsOf([]) })
            assertEq(view.evoRevision('nope')[0], 'error')
        },
        // `evoList` takes a string flag, and a third value is a caller bug.
        // Guessing at it would silently list archived documents into a return.
        evoListRefusesAnythingButTrueOrFalse: () => {
            const view = storeView({ blobs: new Map(), revisions: revisionsOf([]) })
            assertEq(view.evoList('false')[0], 'ok')
            assertEq(view.evoList('true')[0], 'ok')
            assertEq(view.evoList('')[0], 'error')
            assertEq(view.evoList('yes')[0], 'error')
        },
        // An archived subject is out of the default listing and in the
        // explicit one.
        archivedSubjectsAreExcludedUnlessAskedFor: () => {
            /** @type {StoredRevision} */
            const archived = { subject: 'w2/gone', parents: [], snapshot: 'blob-9', archived: true }
            const view = storeView({
                blobs: new Map(),
                revisions: revisionsOf([
                    ['rev-1', revision('w2/acme')('blob-1')([])],
                    ['rev-9', archived],
                ]),
            })
            assertEq(view.evoList('false')[1], '["w2/acme"]')
            assertEq(view.evoList('true')[1], '["w2/acme","w2/gone"]')
        },
    },
}
