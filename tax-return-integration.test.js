// @ts-nocheck
//
// This file exists outside `tsc`'s type checking on purpose, for the same two
// reasons `fjs-run-integration.test.js` and `payer-report-integration.test.js`
// state in full (and `fjs/todo/upstream-node-spawn-effect.md` documents at
// length):
//
// 1. TypeScript cannot resolve `node:child_process` / `node:test` /
//    `node:assert` / `node:fs` / `node:os` / `node:path` / `node:url`
//    without `@types/node`, and AGENTS.md forbids adding any new dependency
//    — including a devDependency — without every repo owner's approval (a
//    hard stop). That approval is not being sought just to typecheck one
//    test harness.
// 2. `fjs/effects/node` has no subprocess-spawn effect, so a genuinely
//    separate-OS-process proof cannot be written as a pure `.f.js` proof at
//    all. This file is therefore, like `index.js`, `all.test.js` and the two
//    existing integration harnesses, a root-level impure JS file by
//    necessity (AGENTS.md's carve-out for exactly this category).
//
// `@ts-nocheck` disables TYPE checking of this one file only.
//
// ── Why this test exists (Phase 21, EXEC-14 / PROV-09) ──────────────────────
//
// `form1040Report` has never had a production caller. Phase 19's provenance
// header and PROV-05's pinned reproduction have therefore never run against
// an actual 1040 — only against a fixture whose "result" was a JSON array of
// head hashes. This file closes both gaps at once, and it is the ONLY place
// either can be closed, because everything decisive here needs a real
// separate OS process:
//
//   * Criterion 3 — documents in via `evo_add`, the program in CAS, executed
//     by the real `fjs_run` tool, result and `vnd.fjs.run` record written by
//     the handler. Under `fjs/effects/node/virtual` a single `fjs_run` call
//     cannot even reach an `'ok'` outcome (the write/import representational
//     split `fjs/server/fjs_run/module.f.js`'s own header documents).
//   * Criterion 4 — PROV-05's pinned reproduction against THAT real 1040,
//     with the unpinned control leg built and observed to MOVE first
//     (19-VALIDATION.md: "the control leaf is not optional"; an assertion
//     that nothing happened passes trivially when nothing ran).
//   * Criterion 5 — `tools/list` read off a LIVE server, so "no
//     `finance_compute_1040`-shaped tool was added" is checked the way a
//     reviewer would check it, not by reading source.
//
// The program's bytes are `fjs/report/tax_return/module.f.js`'s own exported
// `taxReturnReportSource` — the literal hand-authored text, never a
// re-derived or re-formatted copy, and never that module's function twin
// (which this file deliberately does not import).

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

// Reused for real, not re-implemented. `centsFromString` turns the wire's
// decimal strings back into exact cents so the expectations below can be
// hand-typed `bigint`s; the dialect validators confirm the SEEDS are
// well-formed documents before they are stored; `paramSetHash`/
// `taxParamsByYear` let this file compute the expected provenance hash
// independently of whatever the server reports; and
// `countsTowardReproducibilityAcceptance` is EXEC-13's own consumer, applied
// to records fetched back out of CAS.
//
// `taxReturnReportSource` is the ONLY import from the module under test, and
// it is used only to seed the program's bytes. This file never imports
// `taxReturnReport` (the function twin) and never calls it, so no expected
// value below can have been produced by the code under test (AGENTS.md).
import { centsFromString } from './fjs/exact/module.f.js'
import { dialect as returnProfileDialect, validate as validateReturnProfile } from './fjs/return/profile/module.f.js'
import { dialect as w2Dialect, validate as validateW2 } from './fjs/document/w2/module.f.js'
import { dialect as oneZeroNineNineGDialect, validate as validateOneZeroNineNineG } from './fjs/document/1099g/module.f.js'
// The three Schedule K-1 faces, a 1099-INT and a 1099-DIV, imported for the
// SAME reason the three above are: the seeds must be proven well-formed
// documents before the store is asked to compute from them. See the route-line
// leg below for why they are here at all.
import { dialect as k1PartnershipDialect, validate as validateK1Partnership } from './fjs/document/k1_1065/module.f.js'
import { dialect as k1SCorporationDialect, validate as validateK1SCorporation } from './fjs/document/k1_1120s/module.f.js'
import { dialect as k1EstateTrustDialect, validate as validateK1EstateTrust } from './fjs/document/k1_1041/module.f.js'
import { dialect as oneZeroNineNineIntDialect, validate as validateOneZeroNineNineInt } from './fjs/document/1099int/module.f.js'
import { dialect as oneZeroNineNineDivDialect, validate as validateOneZeroNineNineDiv } from './fjs/document/1099div/module.f.js'
import { paramSetHash, reviewedEstimateFraming, countsTowardReproducibilityAcceptance } from './fjs/report/provenance/module.f.js'
import { taxParamsByYear } from './fjs/tax/params/module.f.js'
import { taxReturnReportSource } from './fjs/report/tax_return/module.f.js'

const repoRoot = fileURLToPath(new URL('.', import.meta.url))

// Same field values as `fjs/server/module.f.js`'s own `initializeRequest` /
// `initializedNotification`, mirrored here rather than imported (module-
// private constants of a pure `.f.js` module) — identical to the two
// existing integration harnesses, so this real client negotiates the same
// way.
const requestedProtocolVersion = '2025-06-18'
const initializeRequest = id => ({
    jsonrpc: '2.0',
    method: 'initialize',
    id,
    params: {
        protocolVersion: requestedProtocolVersion,
        capabilities: {},
        clientInfo: { name: 'finance-tax-return-integration-client', version: '0.0.1' },
    },
})
const initializedNotification = { jsonrpc: '2.0', method: 'notifications/initialized' }

// ── The advertised tool set, HAND-TYPED (Success Criterion 5) ───────────────
//
// Thirteen names, written out here rather than read off the server, because
// the whole point is to notice the set CHANGING. A count alone would miss a
// swap; a name list alone would miss an addition if it were built from the
// response. Both are hand-typed and both are asserted.
//
// REQUIREMENTS.md's Out of Scope list forbids a `finance_compute_1040` tool
// — "would destroy the thesis permanently. The agent would call it and never
// author a program again." Phase 21 delivers a real 1040 WITHOUT adding one:
// the engine reaches the guest as a value on `ctx`, so this list is byte for
// byte what it was before the phase.
const expectedToolNames = [
    'cas_add',
    'cas_get',
    'cas_list',
    'cas_refresh',
    'evo_add',
    'evo_head',
    'evo_list',
    'evo_revision',
    'finance_documents_list',
    'finance_schema',
    'finance_tax_params',
    'fjs_check',
    'fjs_run',
]
const expectedToolCount = 13

test(
    'EXEC-14/PROV-09: a stored guest program computes a real 1040 through a separate fjs_run process, and a pinned rerun reproduces it byte for byte',
    { timeout: 120_000 },
    async () => {
        const home = mkdtempSync(join(tmpdir(), 'finance-tax-return-integration-home-'))
        let serverProc = null
        try {
            // No special working directory required — the same conclusion
            // `fjs-run-integration.test.js` establishes (07-10): `executeRun`
            // imports from the full materialize path it itself wrote.
            serverProc = spawn('node', [join(repoRoot, 'index.js'), home], {
                stdio: ['pipe', 'pipe', 'pipe'],
            })

            const responses = []
            let stdoutBuf = ''
            let stderrBuf = ''
            serverProc.stdout.setEncoding('utf8')
            serverProc.stdout.on('data', chunk => {
                stdoutBuf += chunk
                let idx
                while ((idx = stdoutBuf.indexOf('\n')) !== -1) {
                    const line = stdoutBuf.slice(0, idx)
                    stdoutBuf = stdoutBuf.slice(idx + 1)
                    if (line !== '') {
                        responses.push(JSON.parse(line))
                    }
                }
            })
            serverProc.stderr.setEncoding('utf8')
            serverProc.stderr.on('data', chunk => { stderrBuf += chunk })

            let nextIdCounter = 0
            const nextId = () => { nextIdCounter += 1; return nextIdCounter }
            const send = message => { serverProc.stdin.write(JSON.stringify(message) + '\n') }

            // Readiness is proven by matching the response's own JSON-RPC
            // `id`, never by a sleep — the T-07-09-02 discipline.
            const waitForId = async (id, timeoutMs = 30_000) => {
                const deadline = Date.now() + timeoutMs
                while (true) {
                    const found = responses.find(r => r && r.id === id)
                    if (found !== undefined) {
                        return found
                    }
                    if (Date.now() > deadline) {
                        throw new Error(`timed out waiting for response id ${id} (stderr: ${stderrBuf})`)
                    }
                    await new Promise(resolve => setTimeout(resolve, 25))
                }
            }

            const call = async (name, args) => {
                const id = nextId()
                send({ jsonrpc: '2.0', method: 'tools/call', id, params: { name, arguments: args } })
                return waitForId(id)
            }

            // ── initialize -> notifications/initialized ──────────────────
            const initId = nextId()
            send(initializeRequest(initId))
            send(initializedNotification)
            const initResponse = await waitForId(initId)
            assert.ok(!('error' in initResponse), `initialize failed: ${JSON.stringify(initResponse)}`)
            assert.equal(initResponse.result.serverInfo.name, 'finance-mcp')

            // ── Success Criterion 5, against a LIVE server ────────────────
            const listId = nextId()
            send({ jsonrpc: '2.0', method: 'tools/list', id: listId })
            const listResponse = await waitForId(listId)
            assert.ok(!('error' in listResponse), `tools/list failed: ${JSON.stringify(listResponse)}`)
            const advertisedToolNames = listResponse.result.tools.map(t => t.name).sort()
            assert.equal(
                advertisedToolNames.length,
                expectedToolCount,
                `tools/list must advertise exactly ${expectedToolCount} tools; got ${JSON.stringify(advertisedToolNames)}`)
            assert.deepEqual(
                advertisedToolNames,
                [...expectedToolNames].sort(),
                'the advertised tool set must be unchanged by Phase 21')
            // The specific thing REQUIREMENTS.md rules out, named: no tool
            // may offer to compute a 1040. This is the assertion a reviewer
            // performs by eye, mechanized — and it would fail for
            // `finance_compute_1040`, `finance_1040`, `compute_form1040` and
            // anything else carrying the form number.
            for (const name of advertisedToolNames) {
                assert.ok(
                    !name.includes('1040'),
                    `no tool may name the form it computes; found ${name}`)
            }

            const casAdd = async content => {
                const response = await call('cas_add', { content, type: 'text' })
                assert.ok(!response.result.isError, `cas_add failed: ${JSON.stringify(response)}`)
                return response.result.content[0].text
            }
            const evoAdd = async args => {
                const response = await call('evo_add', args)
                assert.ok(!response.result.isError, `evo_add failed: ${JSON.stringify(response)}`)
                return response.result.content[0].text
            }
            const casGetText = async hash => {
                const response = await call('cas_get', { hash, content: true })
                assert.ok(!response.result.isError, `cas_get failed: ${JSON.stringify(response)}`)
                return JSON.parse(response.result.content[0].text).text
            }

            // ── The fixture: one single filer, two W-2s, one 1099-G, and
            //    one Schedule K-1 of EACH of the three faces ───────────────
            //
            // The shape 20-VERIFICATION.md established when it ran a real
            // IRS Wage and Income Transcript's shape through the engine for
            // the first time, with the wages split across two employers here
            // so the summing across documents is exercised rather than
            // assumed.
            //
            // ## Why the three Schedule K-1s are seeded HERE, in the main run
            //
            // `taxReturnReportSource` — the stored program TEXT this file
            // executes — carries three Schedule K-1 route lines
            // (`vnd.fjs.k1_1065`, `vnd.fjs.k1_1120s`, `vnd.fjs.k1_1041`).
            // Until this fixture existed, NO test seeded a Schedule K-1 of
            // any dialect, so all three were dead text in every run the
            // suite performed — a divergence between the stored text and its
            // function twin in `fjs/report/tax_return` would have shipped in
            // real money (those collections feed 1040 lines 2b, 3a and 3b).
            //
            // **A zero-box K-1 would have been a FAKE PASS.** The program's
            // own reducer fallthrough (`route` returns `undefined`, `collect`
            // then returns `acc` unchanged) SILENTLY IGNORES an unrouted
            // document — correct behaviour, and exactly what makes presence
            // untestable: delete a route line from the stored text and a
            // K-1 carrying no amounts changes nothing observable. `readCount`
            // does not rescue it either, because its `1 + 3×n` dispatches all
            // happen in the document-loading loop BEFORE the dialect
            // dispatch, so it moves whether or not the document is bucketed.
            // Only a NON-ZERO box that moves a printed line proves the route
            // line ran.
            //
            // So each K-1 carries exactly one interest box, with a DISTINCT
            // amount per face, and the line 2b citation assertions below name
            // each dialect-qualified box path individually — which is how
            // deleting any ONE of the three route lines is attributable
            // rather than merely detectable.
            //
            // The boxes are chosen to compute rather than refuse: interest
            // reaches 1040 line 2b unconditionally, with no `declaredKinds`
            // gate. The 1041's box 6 (trips `estateAndTrustIncome`) and every
            // face's capital-gain boxes (trip `capitalGainsOrLosses`) are
            // deliberately avoided — either would turn this into a refusal
            // leg instead of a computed return.
            const recipientTin = '222-22-2222'
            const profileDocument = {
                dialect: returnProfileDialect,
                taxYear: 2025,
                filingStatus: 'single',
                dependentCount: 0,
                declaredKinds: [
                    'wages',
                    'unemploymentCompensation',
                    'federalTaxWithheldOnW2',
                    'federalTaxWithheldOnOther1099',
                ],
            }
            const w2A = {
                dialect: w2Dialect,
                payerTin: '11-1111111',
                recipientTin,
                accountNumber: 'ACC-W2-A',
                taxYear: 2025,
                formRevision: '2025',
                box1WagesTipsOtherCompensation: '35937.00',
                box2FederalIncomeTaxWithheld: '6384.00',
            }
            const w2B = {
                dialect: w2Dialect,
                payerTin: '44-4444444',
                recipientTin,
                accountNumber: 'ACC-W2-B',
                taxYear: 2025,
                formRevision: '2025',
                box1WagesTipsOtherCompensation: '9568.00',
                box2FederalIncomeTaxWithheld: '2578.00',
            }
            const oneZeroNineNineG = {
                dialect: oneZeroNineNineGDialect,
                payerTin: '55-5555555',
                recipientTin,
                accountNumber: 'ACC-1099G',
                taxYear: 2025,
                formRevision: '2025',
                box1UnemploymentCompensation: '4554.00',
                box4FederalIncomeTaxWithheld: '454.00',
            }
            // The partner's separately stated interest is box 5 (§702(a)(8)),
            // the shareholder's is box 4 (§1366(a)(1)(A)) and the
            // beneficiary's is box 1 — three different numbers for the same
            // item, which is the collision three separate dialects exist to
            // keep apart. Three distinct amounts, so a transposition between
            // two faces cannot be absorbed by the sum.
            const k1Partnership = {
                dialect: k1PartnershipDialect,
                payerTin: '33-3333333',
                recipientTin,
                accountNumber: 'ACC-K1-1065',
                taxYear: 2025,
                formRevision: '2025',
                boxGGeneralPartnerOrLlcMemberManager: true,
                materialParticipation: 'materiallyParticipated',
                box5InterestIncome: '1200.00',
            }
            const k1SCorporation = {
                dialect: k1SCorporationDialect,
                payerTin: '77-7777777',
                recipientTin,
                accountNumber: 'ACC-K1-1120S',
                taxYear: 2025,
                formRevision: '2025',
                materialParticipation: 'materiallyParticipated',
                box4InterestIncome: '2500.00',
            }
            const k1EstateTrust = {
                dialect: k1EstateTrustDialect,
                payerTin: '88-8888888',
                recipientTin,
                taxYear: 2025,
                formRevision: '2025',
                boxHDomesticBeneficiary: true,
                materialParticipation: 'materiallyParticipated',
                box1InterestIncome: '3700.00',
            }
            // The amendment used by both PROV-05 legs: the SAME employer's
            // W-2 with a different box 1, so an unpinned rerun's line 1a —
            // and therefore every line downstream of it — genuinely moves.
            const w2AAmended = { ...w2A, box1WagesTipsOtherCompensation: '99999.00' }
            const w2AAmendedTwice = { ...w2A, box1WagesTipsOtherCompensation: '77777.00' }

            assert.equal(validateReturnProfile(profileDocument)[0], 'ok', 'expected the seeded return profile to validate')
            for (const doc of [w2A, w2B, w2AAmended, w2AAmendedTwice]) {
                const [t, v] = validateW2(doc)
                assert.equal(t, 'ok', `expected the seeded W-2 to validate: ${JSON.stringify(v)}`)
            }
            assert.equal(validateOneZeroNineNineG(oneZeroNineNineG)[0], 'ok', 'expected the seeded 1099-G to validate')
            for (const [name, [t, v]] of [
                ['k1_1065', validateK1Partnership(k1Partnership)],
                ['k1_1120s', validateK1SCorporation(k1SCorporation)],
                ['k1_1041', validateK1EstateTrust(k1EstateTrust)],
            ]) {
                assert.equal(t, 'ok', `expected the seeded ${name} Schedule K-1 to validate: ${JSON.stringify(v)}`)
            }

            const profileHash = await casAdd(JSON.stringify(profileDocument))
            const w2AHash = await casAdd(JSON.stringify(w2A))
            const w2BHash = await casAdd(JSON.stringify(w2B))
            const oneZeroNineNineGHash = await casAdd(JSON.stringify(oneZeroNineNineG))
            const k1PartnershipHash = await casAdd(JSON.stringify(k1Partnership))
            const k1SCorporationHash = await casAdd(JSON.stringify(k1SCorporation))
            const k1EstateTrustHash = await casAdd(JSON.stringify(k1EstateTrust))
            const w2AAmendedHash = await casAdd(JSON.stringify(w2AAmended))
            const w2AAmendedTwiceHash = await casAdd(JSON.stringify(w2AAmendedTwice))

            // Criterion 3's "documents in via `evo_add`" clause, taken
            // literally: the real tool, not a raw `vnd.fjs.revision` blob
            // written through `cas_add` (the shortcut the two existing
            // integration harnesses take).
            const subjectProfile = 'tax-return-integration-profile'
            const subjectW2A = 'tax-return-integration-w2-a'
            const subjectW2B = 'tax-return-integration-w2-b'
            const subject1099G = 'tax-return-integration-1099g'
            const subjectK1Partnership = 'tax-return-integration-k1-1065'
            const subjectK1SCorporation = 'tax-return-integration-k1-1120s'
            const subjectK1EstateTrust = 'tax-return-integration-k1-1041'
            await evoAdd({ parents: [], subject: subjectProfile, snapshot: profileHash })
            const w2ARevision1 = await evoAdd({ parents: [], subject: subjectW2A, snapshot: w2AHash })
            await evoAdd({ parents: [], subject: subjectW2B, snapshot: w2BHash })
            await evoAdd({ parents: [], subject: subject1099G, snapshot: oneZeroNineNineGHash })
            await evoAdd({ parents: [], subject: subjectK1Partnership, snapshot: k1PartnershipHash })
            await evoAdd({ parents: [], subject: subjectK1SCorporation, snapshot: k1SCorporationHash })
            await evoAdd({ parents: [], subject: subjectK1EstateTrust, snapshot: k1EstateTrustHash })

            // The program's REAL stored source — the exact bytes
            // `fjs/report/tax_return/module.f.js` exports.
            const programHash = await casAdd(taxReturnReportSource)

            // ── The decisive call (Criterion 1 and Criterion 3) ───────────
            const runResponse = await call('fjs_run', { hash: programHash, taxYear: 2025 })
            assert.equal(runResponse.result.isError, undefined, `fjs_run failed: ${JSON.stringify(runResponse)}`)
            const run = JSON.parse(runResponse.result.content[0].text)

            // Phase 19's provenance header, populated on a REAL 1040 for the
            // first time. `paramSetHash` is compared against a value this
            // file computes itself, so "the server reported some hash" is
            // not enough to pass.
            assert.equal(run.taxYear, 2025)
            assert.equal(run.paramSetHash, paramSetHash(taxParamsByYear[2025]))
            assert.equal(run.programHash, programHash)
            assert.equal(run.reviewedEstimateFraming, reviewedEstimateFraming)
            // PROV-07: this program dispatches `evoList` once plus
            // `evoHead`/`evoRevision`/`casRead` per subject — twenty-two
            // reads over seven subjects. Hand-typed, because "greater than
            // zero" would pass for a program that read one document and
            // invented the rest.
            //
            // These dispatches all happen in the document-loading loop, which
            // runs BEFORE the dialect dispatch, so this number moves for any
            // seeded subject whether or not the program has a route line for
            // its dialect. It is therefore NOT evidence that the three
            // Schedule K-1 route lines executed — the money assertions below
            // are.
            assert.equal(run.readCount, 22)
            assert.ok(typeof run.literalCount === 'number', 'expected a literalCount')

            // ── The return itself, against INDEPENDENTLY known figures ────
            //
            // Hand-typed at the assertion, never re-derived from the code
            // under test (AGENTS.md). The arithmetic, checkable by a reader
            // without running anything: wages $35,937.00 + $9,568.00 =
            // $45,505.00 (line 1a); the three Schedule K-1s' separately
            // stated interest $1,200.00 + $2,500.00 + $3,700.00 = $7,400.00
            // (line 2b); plus $4,554.00 of unemployment compensation
            // (line 8) = $57,459.00 total income (line 9); less TY2025's
            // $15,750.00 single standard deduction = $41,709.00 taxable
            // income (line 15); Tax Table tax $4,769.00 (line 16);
            // withholding $6,384.00 + $2,578.00 = $8,962.00 (line 25a) plus
            // $454.00 (line 25b) = $9,416.00 paid; $9,416.00 - $4,769.00 =
            // $4,647.00 overpaid (line 34).
            //
            // **Line 16 is a Tax Table BAND lookup, not a bracket
            // evaluation**, and it is hand-derived from Publication 1040's
            // own rows rather than recomputed with the engine. $41,709.00
            // falls in the "at least $41,700, but less than $41,750" row,
            // whose printed tax is the bracket schedule applied to the band's
            // $41,725 MIDPOINT: $1,192.50 (10% of the first $11,925) + 12% x
            // ($41,725 - $11,925 = $29,800) = $1,192.50 + $3,576.00 =
            // $4,768.50, rounded half up to $4,769. The same derivation
            // reproduces this file's PREVIOUS figure exactly — $34,309.00 was
            // the $34,300/$34,350 band, midpoint $34,325, $1,192.50 + 12% x
            // $22,400 = $3,880.50 -> $3,881 — which is the check that the
            // midpoint-and-half-up rule used here is the right one and not a
            // guess that happened to land.
            const resultBytes = await casGetText(run.resultHash)
            const returnResult = JSON.parse(resultBytes)
            assert.equal(returnResult.kind, 'ok', `expected a computed return: ${resultBytes.slice(0, 400)}`)
            assert.equal(returnResult.taxYear, 2025)
            assert.equal(returnResult.line16Method, 'taxTable')
            assert.equal(returnResult.lines.length, 56)
            // Form 8995 printed line 16 — §199A(c)(2)'s carryforward to the
            // succeeding year — rides beside `line16Method` rather than inside
            // `lines`, because `lines` is Form 1040 lines 1a through 37 and
            // this is a line of a different form. This fixture has no trade or
            // business at all, so it is "0.00"; the SHAPE is what matters here,
            // because the value's own rendering is what the in-module leaf
            // `everyResultFieldIsRenderedFromTheOutcomeInTheSourceText` pins.
            // Without this, the source text could stop emitting the field
            // entirely and the real-process run would not notice.
            assert.ok(
                returnResult.qualifiedBusinessLossCarryforward !== undefined,
                'the rendered result must carry the §199A(c)(2) carryforward')
            assert.equal(returnResult.qualifiedBusinessLossCarryforward.value, '0.00')
            assert.ok(
                returnResult.qualifiedBusinessLossCarryforward.rule.includes('Form 8995 line 16'),
                'and it must name its own printed line')
            const centsAt = rule => {
                const line = returnResult.lines.find(candidate => candidate.rule === rule)
                assert.ok(line !== undefined, `expected the return to carry ${rule}`)
                return centsFromString(line.value)
            }
            assert.equal(centsAt('1040 line 1a'), 4550500n)
            assert.equal(centsAt('1040 line 2b'), 740000n)
            assert.equal(centsAt('1040 line 8'), 455400n)
            assert.equal(centsAt('1040 line 9'), 5745900n)
            assert.equal(centsAt('1040 line 15'), 4170900n)
            assert.equal(centsAt('1040 line 16 (Tax Table)'), 476900n)
            assert.equal(centsAt('1040 line 25a'), 896200n)
            assert.equal(centsAt('1040 line 25b'), 45400n)
            assert.equal(centsAt('1040 line 34'), 464700n)

            // Traceability survived the whole round trip: line 8 still names
            // the 1099-G box it came from, by the document's own CAS hash.
            const lineEight = returnResult.lines.find(candidate => candidate.rule === '1040 line 8')
            assert.ok(
                lineEight.sources.some(s =>
                    s.documentHash === oneZeroNineNineGHash
                    && s.boxPath === 'box1UnemploymentCompensation'),
                `expected line 8 to cite the stored 1099-G: ${JSON.stringify(lineEight.sources)}`)

            // ── The three Schedule K-1 route lines, ATTRIBUTED ────────────
            //
            // Line 2b's total above proves that SOME K-1 interest was routed;
            // it cannot say which of the three route lines ran, because a sum
            // absorbs a missing summand indistinguishably from a wrong one.
            // These three assertions bind each face to its OWN CAS hash and
            // its OWN dialect-qualified box path, so deleting exactly one
            // route line from `taxReturnReportSource` reddens exactly one of
            // them (plus the totals) and names the face that broke.
            //
            // The box paths are dialect-qualified in the program's own text
            // for a reason this fixture makes concrete: `k1_1041`'s interest
            // box is literally `box1InterestIncome`, the same field name the
            // 1099-INT uses, so an unqualified citation could not tell a
            // beneficiary's interest from a bank's.
            const lineTwoB = returnResult.lines.find(candidate => candidate.rule === '1040 line 2b')
            for (const [face, documentHash, boxPath, printed] of [
                ['partner', k1PartnershipHash, 'k1_1065.box5InterestIncome', '1200.00'],
                ['shareholder', k1SCorporationHash, 'k1_1120s.box4InterestIncome', '2500.00'],
                ['beneficiary', k1EstateTrustHash, 'k1_1041.box1InterestIncome', '3700.00'],
            ]) {
                assert.ok(
                    lineTwoB.sources.some(s =>
                        s.documentHash === documentHash
                        && s.boxPath === boxPath
                        && s.value === printed),
                    `expected line 2b to cite the ${face}'s ${boxPath}: ${JSON.stringify(lineTwoB.sources)}`)
            }

            // ── The `vnd.fjs.run` record the HANDLER wrote ────────────────
            const runRecord = JSON.parse(await casGetText(run.runHash))
            assert.equal(runRecord.status, 'ok')
            assert.equal(runRecord.dialect, 'vnd.fjs.run')
            assert.equal(runRecord.programHash, programHash)
            assert.equal(runRecord.taxYear, 2025)
            assert.equal(runRecord.paramSetHash, paramSetHash(taxParamsByYear[2025]))
            assert.equal(runRecord.resultHash, run.resultHash)
            assert.equal(runRecord.pinned, false)
            for (const subject of [
                subjectProfile, subjectW2A, subjectW2B, subject1099G,
                subjectK1Partnership, subjectK1SCorporation, subjectK1EstateTrust,
            ]) {
                assert.ok(
                    runRecord.inputs.some(i => i.command === 'evoHead' && i.payload[0] === subject),
                    `expected the run record to show ${subject} was enumerated`)
            }
            assert.ok(
                runRecord.inputs.some(i => i.command === 'casRead' && i.payload[0] === oneZeroNineNineGHash),
                'expected the run record to show the 1099-G blob was read')
            // An unpinned run is not a reproduction (EXEC-13's own consumer,
            // applied to a record fetched back out of CAS).
            assert.equal(countsTowardReproducibilityAcceptance(runRecord), false)

            // ── PROV-05, Step 1: the UNPINNED control leg ─────────────────
            //
            // 19-VALIDATION.md makes this leg mandatory and orders it FIRST:
            // the pinned assertion below is a NEGATIVE ("nothing moved"),
            // and a negative passes trivially when the mechanism under test
            // never ran. So the amendment is landed and the unpinned rerun
            // is OBSERVED to move before the pinned leg is trusted at all.
            const w2ARevision2 = await evoAdd({
                parents: [w2ARevision1],
                subject: subjectW2A,
                snapshot: w2AAmendedHash,
            })

            const controlRerunResponse = await call('fjs_run', { hash: programHash, taxYear: 2025 })
            assert.equal(
                controlRerunResponse.result.isError, undefined,
                `control fjs_run (unpinned rerun) failed: ${JSON.stringify(controlRerunResponse)}`)
            const controlRerun = JSON.parse(controlRerunResponse.result.content[0].text)
            const controlRerunBytes = await casGetText(controlRerun.resultHash)

            // The decisive control assertion: the amendment really does move
            // an unpinned return. Both forms — the hash and the bytes.
            assert.notEqual(controlRerun.resultHash, run.resultHash)
            assert.notEqual(controlRerunBytes, resultBytes)
            // …and it moved the number a reader can point at, rather than
            // some incidental byte: line 1a now carries the amended wage
            // ($99,999.00 + $9,568.00 = $109,567.00), hand-typed.
            const controlRerunResult = JSON.parse(controlRerunBytes)
            assert.equal(
                centsFromString(
                    controlRerunResult.lines.find(c => c.rule === '1040 line 1a').value),
                10956700n)

            // ── PROV-05, Step 2: the PINNED legs, against that real 1040 ──
            //
            // Pinned to the W-2 subject's FIRST revision. Every other
            // subject still resolves live, which is exactly the property
            // that makes this a pin rather than a snapshot of the store.
            const pinArguments = {
                hash: programHash,
                taxYear: 2025,
                subject: subjectW2A,
                parents: [w2ARevision1],
            }

            const pinnedRun1Response = await call('fjs_run', pinArguments)
            assert.equal(
                pinnedRun1Response.result.isError, undefined,
                `pinned fjs_run #1 failed: ${JSON.stringify(pinnedRun1Response)}`)
            const pinnedRun1 = JSON.parse(pinnedRun1Response.result.content[0].text)
            const pinnedBytes1 = await casGetText(pinnedRun1.resultHash)

            // The pin reproduces the PRE-amendment return exactly — the
            // strongest available statement that it resolved the revision it
            // was pinned to rather than the live head, since the live head
            // has already been observed (above) to produce different bytes.
            assert.equal(pinnedBytes1, resultBytes)

            // A SECOND amendment lands on the pinned subject, between the
            // two pinned runs.
            await evoAdd({
                parents: [w2ARevision2],
                subject: subjectW2A,
                snapshot: w2AAmendedTwiceHash,
            })

            // The SAME pinned call again — same subject, same
            // `parents: [w2ARevision1]`, never the revisions the two
            // amendments added.
            const pinnedRun2Response = await call('fjs_run', pinArguments)
            assert.equal(
                pinnedRun2Response.result.isError, undefined,
                `pinned fjs_run #2 failed: ${JSON.stringify(pinnedRun2Response)}`)
            const pinnedRun2 = JSON.parse(pinnedRun2Response.result.content[0].text)
            const pinnedBytes2 = await casGetText(pinnedRun2.resultHash)

            // The decisive PROV-05 assertion, in both forms 19-CONTEXT.md
            // requires — hash equality alone is close to a
            // content-addressing tautology, so the fetched bytes are
            // compared too — and now, for the first time, against a real
            // Form 1040 rather than a fixture.
            assert.equal(pinnedRun1.resultHash, pinnedRun2.resultHash)
            assert.equal(pinnedBytes1, pinnedBytes2)
            // The reproduced bytes are a real return, not an error value
            // that happens to be stable.
            const pinnedResult = JSON.parse(pinnedBytes2)
            assert.equal(pinnedResult.kind, 'ok')
            assert.equal(
                centsFromString(pinnedResult.lines.find(c => c.rule === '1040 line 34').value),
                464700n)

            // Both pinned records claim the pin they actually applied, and
            // both count toward reproducibility acceptance (EXEC-13).
            for (const pinned of [pinnedRun1, pinnedRun2]) {
                const record = JSON.parse(await casGetText(pinned.runHash))
                assert.equal(record.pinned, true)
                assert.equal(record.subject, subjectW2A)
                assert.deepEqual(record.parents, [w2ARevision1])
                assert.equal(countsTowardReproducibilityAcceptance(record), true)
            }

            // ── Two more of the stored text's route lines, EXECUTED ───────
            //
            // `fjs/todo/tax-return-report-source-route-lines-unexercised.md`
            // sized this and left it open. The stored program's own text
            // carries a route line per dialect, and the text is executed ONLY
            // here — the twin's routing sweep in
            // `fjs/report/tax_return` interprets the FUNCTION, not these
            // bytes. The main fixture above executes six of the twenty-eight
            // route lines (the return profile, the W-2, the 1099-G and the
            // three Schedule K-1 faces); the rest were covered by a
            // `String.includes` of the dialect tag and nothing else — which
            // cannot see a line that is present and WRONG. This leg takes it
            // to eight; the todo sizes the twenty left.
            //
            // This leg seeded the three Schedule K-1 faces itself until the
            // main fixture acquired them. Seeding them again HERE, under the
            // same three subject names, would be a second copy of three route
            // lines already executed above and attributed there by box path —
            // so only the two faces the main fixture does NOT carry remain.
            //
            // **Why a zero-box document would have been a fake pass**, and
            // this leg is not one: the reducer's fallthrough returns `acc`
            // unchanged for an unrouted document — deliberately, so a stored
            // blob of a dialect this report does not consume cannot fail the
            // run — so presence is unobservable and only an AMOUNT THAT MOVES
            // proves the line executed. The 1099-INT carries interest, which
            // reaches 1040 line 2b through no declaration gate, and its
            // $9.00 is chosen so that **every subset of the four contributors
            // to that line sums to a different figure**: against the main
            // fixture's $1,200.00 + $2,500.00 + $3,700.00 the total is
            // $7,409.00, and dropping any one line leaves $6,209.00,
            // $4,909.00, $3,709.00 or $7,400.00 — so a failure names which
            // route line broke rather than only that one did.
            //
            // The 1099-INT makes the `boxPath` assertions below LOAD BEARING
            // rather than belt-and-braces: `k1_1041`'s interest box is
            // literally `box1InterestIncome`, the same name the 1099-INT
            // uses, so a beneficiary's K-1 misrouted into `interestForms`
            // would still contribute its $3,700.00 to the total and only the
            // dialect-qualified `boxPath` would say so. The main leg's own
            // citation assertions ran in a store with no 1099-INT in it, so
            // they could not have caught that collision; these can. The
            // interest box wears a DIFFERENT NUMBER on each of the three K-1
            // faces — 5 on the partner's, 4 on the shareholder's, 1 on the
            // beneficiary's — which is the collision DOC-24's separate
            // dialects exist to prevent.
            //
            // Run HERE — after every assertion above, before the mixed-year
            // leg — because it permanently adds two subjects to the store,
            // and the figures above are hand-typed against a seven-subject
            // one.
            const bankInterest = {
                dialect: oneZeroNineNineIntDialect,
                payerTin: '10-1010101',
                recipientTin,
                accountNumber: 'ACC-1099INT',
                taxYear: 2025,
                formRevision: '2025',
                box1InterestIncome: '9.00',
            }
            // The SECOND route line, and it is deliberately not a second
            // contributor to line 2b: it lands on printed lines 3a and 3b, so
            // the leg says the recipe generalizes past one printed line.
            // Box 1b is the QUALIFIED SUBSET of box 1a, never an addend
            // beside it — a transposition of the two is exactly what the
            // separate assertions below catch.
            const bankDividend = {
                dialect: oneZeroNineNineDivDialect,
                payerTin: '12-1212121',
                recipientTin,
                accountNumber: 'ACC-1099DIV',
                taxYear: 2025,
                formRevision: '2025',
                sourceArtifactHash: 'deadbeef00112233445566778899aabbccddeeff0011223344556677889900',
                box1aTotalOrdinaryDividends: '250.00',
                box1bQualifiedDividends: '100.00',
            }
            assert.equal(validateOneZeroNineNineInt(bankInterest)[0], 'ok', 'expected the seeded 1099-INT to validate')
            assert.equal(validateOneZeroNineNineDiv(bankDividend)[0], 'ok', 'expected the seeded 1099-DIV to validate')

            const bankInterestHash = await casAdd(JSON.stringify(bankInterest))
            const bankDividendHash = await casAdd(JSON.stringify(bankDividend))
            await evoAdd({ parents: [], subject: 'tax-return-integration-1099int', snapshot: bankInterestHash })
            await evoAdd({ parents: [], subject: 'tax-return-integration-1099div', snapshot: bankDividendHash })

            const routeRunResponse = await call('fjs_run', { hash: programHash, taxYear: 2025 })
            assert.equal(
                routeRunResponse.result.isError, undefined,
                `route-line fjs_run failed: ${JSON.stringify(routeRunResponse)}`)
            const routeRun = JSON.parse(routeRunResponse.result.content[0].text)
            // `1 + 3 × 9`: nine subjects now, the main fixture's seven plus
            // these two. Hand-typed, like the twenty-two above.
            assert.equal(routeRun.readCount, 28)
            const routeBytes = await casGetText(routeRun.resultHash)
            const routeResult = JSON.parse(routeBytes)
            assert.equal(routeResult.kind, 'ok', `expected a computed return: ${routeBytes.slice(0, 400)}`)
            const routeCentsAt = rule => {
                const line = routeResult.lines.find(candidate => candidate.rule === rule)
                assert.ok(line !== undefined, `expected the return to carry ${rule}`)
                return centsFromString(line.value)
            }
            // The arithmetic, checkable by a reader without running anything.
            // The live W-2A is the SECOND amendment ($77,777.00) by this point
            // — the two PROV-05 legs above landed it — so wages are
            // $77,777.00 + $9,568.00 = $87,345.00. Interest is the three K-1
            // boxes the main fixture seeded plus the bank's, $1,200.00 +
            // $2,500.00 + $3,700.00 + $9.00 = $7,409.00. Ordinary dividends
            // are $250.00, of which $100.00 is the qualified SUBSET and is
            // therefore NOT added again. Unemployment is unchanged at
            // $4,554.00, so total income is $87,345.00 + $7,409.00 + $250.00
            // + $4,554.00 = $99,558.00, less TY2025's $15,750.00 single
            // standard deduction = $83,808.00 of taxable income.
            assert.equal(routeCentsAt('1040 line 1a'), 8734500n)
            assert.equal(routeCentsAt('1040 line 2b'), 740900n)
            assert.equal(routeCentsAt('1040 line 3a'), 10000n)
            assert.equal(routeCentsAt('1040 line 3b'), 25000n)
            assert.equal(routeCentsAt('1040 line 8'), 455400n)
            assert.equal(routeCentsAt('1040 line 9'), 9955800n)
            assert.equal(routeCentsAt('1040 line 15'), 8380800n)
            // Line 16 is deliberately NOT asserted here. It is a Tax Table
            // band lookup — a step function whose expected value would have to
            // be hand-derived from Publication 1040's own rows, and never
            // recomputed with the engine — and this leg is about two route
            // lines, not about the tax table. The main run above pins line 16.
            //
            // ── Each route line SEPARATELY, by dialect-qualified boxPath ──
            //
            // The total alone cannot tell a document routed into the wrong
            // bucket from one routed into the right one, because both buckets
            // reach the same printed line. These two assertions can: each
            // names the document the server itself hashed and the box path
            // `fjs/form1040/core` cites for that face.
            const routeLineTwoB = routeResult.lines.find(candidate => candidate.rule === '1040 line 2b')
            const citedBox = (documentHash, boxPath) => routeLineTwoB.sources.some(
                s => s.documentHash === documentHash && s.boxPath === boxPath)
            assert.ok(
                citedBox(k1EstateTrustHash, 'k1_1041.box1InterestIncome'),
                `line 2b must cite the beneficiary's box 1: ${JSON.stringify(routeLineTwoB.sources)}`)
            // Unqualified, and that is the point of the pair: the bank's box 1
            // and the beneficiary's box 1 are the same NAME on two faces, and
            // only the qualification tells them apart.
            assert.ok(
                citedBox(bankInterestHash, 'box1InterestIncome'),
                `line 2b must cite the bank's box 1: ${JSON.stringify(routeLineTwoB.sources)}`)

            // ── The mixed-year refusal, through the REAL stored bytes ─────
            //
            // Run LAST, because it permanently adds a 2024 document to the
            // store and every assertion above needs a store that computes.
            //
            // Every other proof of this rule exercises the function TWIN;
            // this is the only place the literal `taxReturnReportSource`
            // bytes are checked against it, in a real process, which is the
            // same reason `payer-report-integration.test.js` exists for its
            // own program. The refusal is a returned VALUE, not an `fjs_run`
            // failure: the program computed an answer, and the answer is
            // "I will not compute this". So `fjs_run` itself succeeds.
            const w2PriorYear = {
                dialect: w2Dialect,
                payerTin: '66-6666666',
                recipientTin,
                accountNumber: 'ACC-W2-PRIOR',
                taxYear: 2024,
                formRevision: '2024',
                box1WagesTipsOtherCompensation: '80000.00',
            }
            assert.equal(validateW2(w2PriorYear)[0], 'ok', 'expected the seeded 2024 W-2 to validate')
            const w2PriorYearHash = await casAdd(JSON.stringify(w2PriorYear))
            await evoAdd({
                parents: [],
                subject: 'tax-return-integration-w2-prior-year',
                snapshot: w2PriorYearHash,
            })

            const mixedYearResponse = await call('fjs_run', { hash: programHash, taxYear: 2025 })
            assert.equal(
                mixedYearResponse.result.isError, undefined,
                `fjs_run itself must succeed; the refusal is the program's own value: ${JSON.stringify(mixedYearResponse)}`)
            const mixedYear = JSON.parse(mixedYearResponse.result.content[0].text)
            const mixedYearResult = JSON.parse(await casGetText(mixedYear.resultHash))
            assert.equal(
                mixedYearResult.kind, 'error',
                `expected the stored program to refuse a mixed-year store: ${JSON.stringify(mixedYearResult).slice(0, 400)}`)
            // All four facts, against the REAL document hash the server
            // itself assigned — a hash this test could not have predicted,
            // so the message is genuinely carrying it rather than echoing a
            // literal.
            assert.ok(
                mixedYearResult.message.includes(w2PriorYearHash),
                `the refusal must name the offending document hash: ${mixedYearResult.message}`)
            assert.ok(
                mixedYearResult.message.includes('vnd.fjs.w2'),
                `the refusal must name the offending dialect: ${mixedYearResult.message}`)
            assert.ok(
                mixedYearResult.message.includes('2024'),
                `the refusal must name the document's own tax year: ${mixedYearResult.message}`)
            assert.ok(
                mixedYearResult.message.includes('2025'),
                `the refusal must name the year this run computes: ${mixedYearResult.message}`)
            // It refused instead of computing: no lines were produced at all.
            assert.equal(mixedYearResult.lines, undefined)

            // Clean EOF shutdown — the established real-process pattern.
            serverProc.stdin.end()
            const exitCode = await new Promise((resolve, reject) => {
                const timer = setTimeout(
                    () => reject(new Error(`server did not exit within timeout (stderr: ${stderrBuf})`)),
                    10_000,
                )
                serverProc.on('exit', code => {
                    clearTimeout(timer)
                    resolve(code)
                })
            })
            serverProc = null
            assert.equal(exitCode, 0, `server did not exit cleanly (stderr: ${stderrBuf})`)
            assert.equal(stderrBuf, '', 'no diagnostics expected on stderr')
        } finally {
            if (serverProc !== null && serverProc.exitCode === null) {
                serverProc.kill()
            }
            rmSync(home, { recursive: true, force: true })
        }
    },
)
