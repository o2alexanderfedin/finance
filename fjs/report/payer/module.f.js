/**
 * PROV-08 — the second, genuinely non-tax report: income received per payer,
 * aggregated across every stored `vnd.fjs.1099int`/`vnd.fjs.1099div`
 * document. This module is the payer report's reference/spec, mirroring
 * `fjs/form1040`'s role in the tax engine — proof-tested here, and never
 * imported by `fjs_run` itself (a stored program is materialized text
 * imported by hash at run time, not a call into this module). It is a
 * SIBLING of `fjs/form1040` under `fjs/report/payer/`, not nested under
 * `fjs/form1040/` — nesting it there would quietly re-assert that the
 * report layer is 1040-shaped, which is the very claim PROV-08 exists to
 * deny.
 *
 * **This module imports nothing from `fjs/tax/*`, `fjs/return/*`, or
 * `fjs/form1040/*`.** `payer-report-gate.test.js` (Task 2) scans this
 * directory mechanically for exactly that, so the claim is enforced, not
 * merely asserted. It consults zero tax parameters and produces no 1040
 * line — it is a report ABOUT the taxpayer's money, computed the same way
 * every tax report is (a stored guest program run through `fjs_run`), and
 * that is the entire rhetorical point: "reports are programs" was never
 * specific to the 1040.
 *
 * ## The two-dialect scope boundary (deliberate, not a defect)
 *
 * This report sums exactly two boxes: 1099-INT's `box1InterestIncome` and
 * 1099-DIV's `box1aTotalOrdinaryDividends`. Every other stored dialect —
 * 1099-R, SSA-1099, W-2, brokerage sales, medical expenses, and any future
 * addition — contributes nothing, and a document of any other dialect (or
 * of one of these two dialects with the relevant box absent) is SKIPPED,
 * never coerced to a zero contribution (DOC-11's absent-is-not-zero
 * convention, restated here for a report rather than a form line).
 * Widening this to more income dialects later is a mechanical, additive
 * change to `boxPathFor` below — a future report author adds a dialect/box
 * pair to that one function — not evidence that this module's initial scope
 * was wrong, the same posture Schedule D's own "Decision 2.5" boundary
 * comments take toward their own printed-form scope.
 *
 * ## `payerReportSource` and `payerReport` must be kept in sync by hand
 *
 * As `fjs-run-integration.test.js`'s own module header documents for its
 * `programSource`/fixture pair, this module carries the guest program's
 * literal source TEXT (`payerReportSource`, zero imports, exactly what a
 * real separate process writes to disk and `import()`s) side by side with a
 * REAL JS implementation of the identical logic (`payerReport`, exercised
 * under the virtual `interpret`/`hostMap` harness this module's own proof
 * uses). Neither is derived from the other — `payerReportSource` is not
 * `payerReport.toString()`, because a stored program's text must be
 * hand-authored prose a reviewer can read, not a serialized closure. The two
 * are kept in sync by hand, and by construction: `proof.payerReportAggregatesAcrossPayersAndDialects`
 * below is the host-side/virtual half of that check (it exercises
 * `payerReport` against a hand-typed expected `byPayer`), and
 * `payer-report-integration.test.js`'s own real-process test (Task 3) is the
 * real-process half (it exercises the literal `payerReportSource` bytes
 * against an independently hand-computed expected total). A change to one
 * without the matching change to the other shows up as the two tests'
 * hand-typed expectations silently diverging for what is meant to be the
 * same computation over the same conceptual fixture — there is no runtime
 * cross-check between the two, by design, mirroring 07-08/07-09's own
 * established precedent for this exact split.
 *
 * @module
 */
import { assert, assertEq, assertNotNullish } from 'functionalscript/fjs/asserts/module.f.mjs'
import { guestCtx } from '../../guest/module.f.js'
import { interpret } from '../../exec/module.f.js'

import { ok } from 'functionalscript/fjs/types/result/module.f.mjs'

/** @import { OperationMap } from 'functionalscript/fjs/effects/types.js' */
/** @import { Result } from 'functionalscript/fjs/types/result/types.js' */
/** @import { CasOp, Report } from '../../guest/module.f.js' */

/**
 * One `(documentHash, boxPath, value)` tuple, the same shape
 * `fjs/report/line/module.f.js`'s own `Source` uses — `value` is the raw
 * printed string exactly as read at that box, never re-parsed or rounded
 * here.
 * @typedef {{
 *   readonly documentHash: string,
 *   readonly boxPath: 'box1InterestIncome' | 'box1aTotalOrdinaryDividends',
 *   readonly value: string,
 * }} PayerSource
 */

/**
 * One payer's running total, `ReportLine`-WIRE-shaped (`{ value, sources,
 * rule }`) rather than `ReportLine`-typed: `value` is already the decimal
 * STRING a `ReportLine.value` bigint would project to, because this is the
 * plain object `ctx.pure` hands back across the guest boundary, and fjs's
 * JSON `Primitive` has no `bigint` (EXACT-05) — the same reason `fjs/exec`'s
 * whole guest ABI is string-in/string-out. `sources` is a non-empty array by
 * construction (a payer entry is created only once its first source is
 * found) — never asserted empty, since T-15-01's mitigation is precisely
 * that every entry this report emits carries at least one citation.
 * @typedef {{
 *   readonly value: string,
 *   readonly sources: readonly PayerSource[],
 *   readonly rule: string,
 * }} PayerTotal
 */

/**
 * The whole report's result shape: one entry per payer TIN that contributed
 * at least one present, in-scope box. A payer never present in this object
 * is a payer this report never saw money for — never a payer mapped to a
 * zero-valued entry.
 * @typedef {{ readonly [payerTin: string]: PayerTotal }} ByPayer
 */

/**
 * The one line this report's every emitted total cites as its rule —
 * mirrors `ReportLine.rule` naming a 1040 line, except this report names no
 * 1040 line at all, which is the point.
 * @type {string}
 */
const payerReportRule = 'income received per payer (1099-INT box1, 1099-DIV box1a)'

/**
 * A minimally-shaped stored document, as seen after `JSON.parse` — just
 * enough structure for this report's own two-dialect scope boundary to
 * dispatch on. Deliberately not imported from `fjs/document/1099int` or
 * `fjs/document/1099div` (this module imports no dialect schema at all): the
 * guest program's OWN stored text (`payerReportSource`) cannot import
 * either, since a stored program has zero `import` statements, and this
 * function twin is written against the identical literal field/dialect
 * names for exactly that reason — kept in sync by hand, per the module
 * header above.
 * @typedef {{
 *   readonly dialect: string,
 *   readonly payerTin: string,
 *   readonly box1InterestIncome?: string,
 *   readonly box1aTotalOrdinaryDividends?: string,
 * }} PayerScopedDocument
 */

/**
 * The two-dialect scope boundary, made a single named function so widening
 * it later (per the module header) is a one-function, additive change. A
 * document outside this scope, or a present dialect with its one relevant
 * box absent, yields `undefined` — the caller's job is to SKIP it, never to
 * treat `undefined` as a zero contribution.
 * @type {(doc: PayerScopedDocument) => 'box1InterestIncome' | 'box1aTotalOrdinaryDividends' | undefined}
 */
const boxPathFor = doc => {
    if (doc.dialect === 'vnd.fjs.1099int' && doc.box1InterestIncome !== undefined) {
        return 'box1InterestIncome'
    }
    if (doc.dialect === 'vnd.fjs.1099div' && doc.box1aTotalOrdinaryDividends !== undefined) {
        return 'box1aTotalOrdinaryDividends'
    }
    return undefined
}

/**
 * The guest program's REAL source text — zero imports (so `checkSpecifiers`
 * passes when a real process materializes it), written against nothing but
 * `ctx` (`fjs/guest/module.f.js`'s frozen ABI). Enumerates every active
 * subject via `ctx.evoList('false')`, resolves each one's
 * head -> revision -> snapshot (mirroring `fjs/server/fjs_run/module.f.js`'s
 * own `multiDocumentSumAcrossTwoStoredDocuments` recursion shape), and for
 * every PRESENT in-scope box accumulates into a `byPayer[doc.payerTin]`
 * bucket — never creating an entry for a payer this report saw no in-scope
 * money for. `payerReport` below is the function twin of this exact logic;
 * see the module header for how the two are kept in sync.
 * @type {string}
 */
export const payerReportSource = [
    'export const report = ctx => args => ctx.step(ctx.evoList(\'false\'), activeJson => {',
    '    const rule = \'income received per payer (1099-INT box1, 1099-DIV box1a)\'',
    '    const boxPathFor = doc => {',
    '        if (doc.dialect === \'vnd.fjs.1099int\' && doc.box1InterestIncome !== undefined) {',
    '            return \'box1InterestIncome\'',
    '        }',
    '        if (doc.dialect === \'vnd.fjs.1099div\' && doc.box1aTotalOrdinaryDividends !== undefined) {',
    '            return \'box1aTotalOrdinaryDividends\'',
    '        }',
    '        return undefined',
    '    }',
    '    const walk = subjects => byPayer => {',
    '        const subject = subjects[0]',
    '        if (subject === undefined) {',
    '            return ctx.pure(byPayer)',
    '        }',
    '        const rest = subjects.slice(1)',
    '        return ctx.step(ctx.evoHead(subject), headsJson => {',
    '            const heads = JSON.parse(headsJson)',
    '            const headHash = heads[0]',
    '            return ctx.step(ctx.evoRevision(headHash), revJson => {',
    '                const rev = JSON.parse(revJson)',
    '                return ctx.step(ctx.casRead(rev.snapshot), docJson => {',
    '                    const doc = JSON.parse(docJson)',
    '                    const boxPath = boxPathFor(doc)',
    '                    if (boxPath === undefined) {',
    '                        return walk(rest)(byPayer)',
    '                    }',
    '                    const raw = doc[boxPath]',
    '                    const amount = ctx.centsFromString(raw)',
    '                    const existing = byPayer[doc.payerTin]',
    '                    const existingValue = existing === undefined ? 0n : ctx.centsFromString(existing.value)',
    '                    const existingSources = existing === undefined ? [] : existing.sources',
    '                    const nextByPayer = {',
    '                        ...byPayer,',
    '                        [doc.payerTin]: {',
    '                            value: ctx.centsToString(existingValue + amount),',
    '                            sources: [...existingSources, { documentHash: rev.snapshot, boxPath, value: raw }],',
    '                            rule,',
    '                        },',
    '                    }',
    '                    return walk(rest)(nextByPayer)',
    '                })',
    '            })',
    '        })',
    '    }',
    '    return walk(JSON.parse(activeJson))({})',
    '})',
    '',
].join('\n')

/**
 * The function twin of {@link payerReportSource} — the IDENTICAL logic,
 * written as real JS rather than derived from the string (see the module
 * header for why neither is generated from the other). Exercised under the
 * virtual `interpret`/`hostMap` harness in this module's own proof, below.
 * The inner arrow ignores `args` (this report takes none), the same reason
 * `fjs/server/fjs_run/module.f.js`'s own `sumReport`/`demoReport` fixtures
 * declare a zero-argument inner function against `Report`'s one-argument
 * signature — TypeScript admits a function with fewer parameters than its
 * declared type.
 * @type {Report<unknown>}
 */
export const payerReport = ctx => () => ctx.step(ctx.evoList('false'), activeJson => {
    /**
     * @type {(subjects: readonly string[]) => (byPayer: ByPayer) => import('functionalscript/fjs/effects/types.js').Effect<CasOp, ByPayer, string>}
     */
    const walk = subjects => byPayer => {
        const subject = subjects[0]
        if (subject === undefined) {
            return ctx.pure(byPayer)
        }
        const rest = subjects.slice(1)
        return ctx.step(ctx.evoHead(subject), headsJson => {
            /** @type {readonly string[]} */
            const heads = JSON.parse(headsJson)
            const headHash = assertNotNullish(heads[0], ['expected at least one head', subject])
            return ctx.step(ctx.evoRevision(headHash), revJson => {
                /** @type {{ readonly snapshot: string }} */
                const rev = JSON.parse(revJson)
                return ctx.step(ctx.casRead(rev.snapshot), docJson => {
                    /** @type {PayerScopedDocument} */
                    const doc = JSON.parse(docJson)
                    const boxPath = boxPathFor(doc)
                    if (boxPath === undefined) {
                        return walk(rest)(byPayer)
                    }
                    const raw = assertNotNullish(doc[boxPath], ['expected the in-scope box to be present', boxPath])
                    const amount = ctx.centsFromString(raw)
                    const existing = byPayer[doc.payerTin]
                    const existingValue = existing === undefined ? 0n : ctx.centsFromString(existing.value)
                    const existingSources = existing === undefined ? [] : existing.sources
                    /** @type {ByPayer} */
                    const nextByPayer = {
                        ...byPayer,
                        [doc.payerTin]: {
                            value: ctx.centsToString(existingValue + amount),
                            sources: [...existingSources, { documentHash: rev.snapshot, boxPath, value: raw }],
                            rule: payerReportRule,
                        },
                    }
                    return walk(rest)(nextByPayer)
                })
            })
        })
    }
    return walk(JSON.parse(activeJson))({})
})

// ── Tests ────────────────────────────────────────────────────────────────────

// Fixture identifiers for the unit proof below — a hand-built, in-memory
// three-document store (never real CAS/Evo; that is Task 3's job) covering
// exactly the scope boundary this module documents: two 1099-INTs from
// different payers, one with box1InterestIncome present and one absent
// (DOC-11's skip, never a zero), and one 1099-DIV — from the SAME payer as
// the present 1099-INT, so the proof also demonstrates accumulation of one
// payer's total ACROSS two documents and two dialects, not merely a single
// box read.
const payerWithBothDialects = '11-1111111'
const payerWithAbsentBoxOnly = '22-2222222'

const subjectIntPresent = 'payer-report-subject-int-present'
const subjectIntAbsent = 'payer-report-subject-int-absent'
const subjectDivPresent = 'payer-report-subject-div-present'

const headIntPresent = 'payer-report-head-int-present'
const headIntAbsent = 'payer-report-head-int-absent'
const headDivPresent = 'payer-report-head-div-present'

const docHashIntPresent = 'payer-report-doc-hash-int-present'
const docHashIntAbsent = 'payer-report-doc-hash-int-absent'
const docHashDivPresent = 'payer-report-doc-hash-div-present'

/** @type {Readonly<Record<string, readonly string[]>>} */
const headsBySubject = {
    [subjectIntPresent]: [headIntPresent],
    [subjectIntAbsent]: [headIntAbsent],
    [subjectDivPresent]: [headDivPresent],
}

/** @type {Readonly<Record<string, string>>} */
const snapshotByHead = {
    [headIntPresent]: docHashIntPresent,
    [headIntAbsent]: docHashIntAbsent,
    [headDivPresent]: docHashDivPresent,
}

/** @type {Readonly<Record<string, PayerScopedDocument>>} */
const documentByHash = {
    [docHashIntPresent]: {
        dialect: 'vnd.fjs.1099int',
        payerTin: payerWithBothDialects,
        box1InterestIncome: '100.00',
    },
    [docHashIntAbsent]: {
        dialect: 'vnd.fjs.1099int',
        payerTin: payerWithAbsentBoxOnly,
    },
    [docHashDivPresent]: {
        dialect: 'vnd.fjs.1099div',
        payerTin: payerWithBothDialects,
        box1aTotalOrdinaryDividends: '50.00',
    },
}

/**
 * A host map matching the frozen `CasOp` vocabulary exactly, backed by the
 * fixture maps above rather than a real CAS/Evo store — the same
 * `interpret(hostMap)` technique `fjs/guest/module.f.js`'s own
 * `reportShapedProgramRuns` proof uses, extended here to the full
 * evoList/evoHead/evoRevision/casRead recursion shape
 * `fjs/server/fjs_run/module.f.js`'s `multiDocumentSumAcrossTwoStoredDocuments`
 * exercises against a real CAS. This report needs no real CAS to prove its
 * OWN aggregation logic — that is what makes it a unit proof rather than an
 * integration proof (Task 3 is the integration proof, against the real
 * thing).
 *
 * Every handler answers `ok`: this fixture's own lookups panic (via
 * `assertNotNullish`) rather than refusing, because a missing fixture entry
 * is a broken proof and not a case the report is meant to survive. The
 * `Result` return is `CasOp`'s — an operation set declares one channel for
 * all four — not a claim that any of these four can fail.
 * @type {OperationMap<CasOp, Result<string, string>>}
 */
const hostMap = {
    evoList: () => ok(JSON.stringify([subjectIntPresent, subjectIntAbsent, subjectDivPresent])),
    evoHead: (/** @type {string} */ subject) =>
        ok(JSON.stringify(assertNotNullish(headsBySubject[subject], ['unknown subject', subject]))),
    evoRevision: (/** @type {string} */ headHash) =>
        ok(JSON.stringify({ snapshot: assertNotNullish(snapshotByHead[headHash], ['unknown head', headHash]) })),
    casRead: (/** @type {string} */ hash) =>
        ok(JSON.stringify(assertNotNullish(documentByHash[hash], ['unknown document hash', hash]))),
}

export const proof = {
    // The sync check's host-side/virtual half (see module header): exercises
    // `payerReport` end to end through the real `interpret`, over the
    // fixture documents above, and asserts against HAND-TYPED expected cents
    // — never a value `payerReport` itself produced (AGENTS.md).
    payerReportAggregatesAcrossPayersAndDialects: () => {
        const [t, v] = interpret(hostMap)(payerReport(guestCtx)([]))
        assert(t === 'ok', ['expected the payer report to run to completion', t, v])
        const [value] = v
        const byPayer = /** @type {ByPayer} */ (value)

        // The payer who appears in BOTH a present 1099-INT and a present
        // 1099-DIV: $100.00 + $50.00 = $150.00, hand-typed, never derived
        // from centsFromString/centsToString applied to the module's own
        // inputs.
        const bothDialectsTotal = assertNotNullish(
            byPayer[payerWithBothDialects],
            ['expected an entry for the payer present in both dialects', byPayer])
        assertEq(bothDialectsTotal.value, '150.00')
        assertEq(bothDialectsTotal.sources.length, 2)
        assertEq(bothDialectsTotal.rule, payerReportRule)
        const [firstSource, secondSource] = bothDialectsTotal.sources
        assertEq(assertNotNullish(firstSource, 'expected a first source').documentHash, docHashIntPresent)
        assertEq(assertNotNullish(firstSource, 'expected a first source').boxPath, 'box1InterestIncome')
        assertEq(assertNotNullish(firstSource, 'expected a first source').value, '100.00')
        assertEq(assertNotNullish(secondSource, 'expected a second source').documentHash, docHashDivPresent)
        assertEq(assertNotNullish(secondSource, 'expected a second source').boxPath, 'box1aTotalOrdinaryDividends')
        assertEq(assertNotNullish(secondSource, 'expected a second source').value, '50.00')

        // DOC-11's skip, never a zero: the payer whose ONLY document has the
        // in-scope box absent must not appear in the result AT ALL — not as
        // an entry with an empty sources array, not as a zero-valued entry.
        assertEq(byPayer[payerWithAbsentBoxOnly], undefined)
    },
    // A payer who contributes nothing in scope is invisible, not zeroed —
    // restated as its own leaf so a future reader searching for "absent is
    // not zero" coverage of THIS module finds it without re-deriving it
    // from the aggregation leaf above.
    payerWithNoInScopeBoxIsAbsentNotZero: () => {
        const [t, v] = interpret(hostMap)(payerReport(guestCtx)([]))
        assert(t === 'ok', ['expected the payer report to run to completion', t, v])
        const [value] = v
        const byPayer = /** @type {ByPayer} */ (value)
        assert(
            !Object.hasOwn(byPayer, payerWithAbsentBoxOnly),
            ['expected no key at all for a payer with no in-scope box present', byPayer])
    },
}
