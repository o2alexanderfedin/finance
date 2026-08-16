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

            // ── The fixture: one single filer, two W-2s, one 1099-G ───────
            //
            // The shape 20-VERIFICATION.md established when it ran a real
            // IRS Wage and Income Transcript's shape through the engine for
            // the first time, with the wages split across two employers here
            // so the summing across documents is exercised rather than
            // assumed.
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

            const profileHash = await casAdd(JSON.stringify(profileDocument))
            const w2AHash = await casAdd(JSON.stringify(w2A))
            const w2BHash = await casAdd(JSON.stringify(w2B))
            const oneZeroNineNineGHash = await casAdd(JSON.stringify(oneZeroNineNineG))
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
            await evoAdd({ parents: [], subject: subjectProfile, snapshot: profileHash })
            const w2ARevision1 = await evoAdd({ parents: [], subject: subjectW2A, snapshot: w2AHash })
            await evoAdd({ parents: [], subject: subjectW2B, snapshot: w2BHash })
            await evoAdd({ parents: [], subject: subject1099G, snapshot: oneZeroNineNineGHash })

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
            // `evoHead`/`evoRevision`/`casRead` per subject — thirteen reads
            // over four subjects. Hand-typed, because "greater than zero"
            // would pass for a program that read one document and invented
            // the rest.
            assert.equal(run.readCount, 13)
            assert.ok(typeof run.literalCount === 'number', 'expected a literalCount')

            // ── The return itself, against INDEPENDENTLY known figures ────
            //
            // Hand-typed at the assertion, never re-derived from the code
            // under test (AGENTS.md). The arithmetic, checkable by a reader
            // without running anything: wages $35,937.00 + $9,568.00 =
            // $45,505.00 (line 1a); plus $4,554.00 of unemployment
            // compensation (line 8) = $50,059.00 total income (line 9); less
            // TY2025's $15,750.00 single standard deduction = $34,309.00
            // taxable income (line 15); Tax Table tax $3,881.00 (line 16);
            // withholding $6,384.00 + $2,578.00 = $8,962.00 (line 25a) plus
            // $454.00 (line 25b) = $9,416.00 paid; $9,416.00 - $3,881.00 =
            // $5,535.00 overpaid (line 34).
            const resultBytes = await casGetText(run.resultHash)
            const returnResult = JSON.parse(resultBytes)
            assert.equal(returnResult.kind, 'ok', `expected a computed return: ${resultBytes.slice(0, 400)}`)
            assert.equal(returnResult.taxYear, 2025)
            assert.equal(returnResult.line16Method, 'taxTable')
            assert.equal(returnResult.lines.length, 56)
            const centsAt = rule => {
                const line = returnResult.lines.find(candidate => candidate.rule === rule)
                assert.ok(line !== undefined, `expected the return to carry ${rule}`)
                return centsFromString(line.value)
            }
            assert.equal(centsAt('1040 line 1a'), 4550500n)
            assert.equal(centsAt('1040 line 8'), 455400n)
            assert.equal(centsAt('1040 line 9'), 5005900n)
            assert.equal(centsAt('1040 line 15'), 3430900n)
            assert.equal(centsAt('1040 line 16 (Tax Table)'), 388100n)
            assert.equal(centsAt('1040 line 25a'), 896200n)
            assert.equal(centsAt('1040 line 25b'), 45400n)
            assert.equal(centsAt('1040 line 34'), 553500n)

            // Traceability survived the whole round trip: line 8 still names
            // the 1099-G box it came from, by the document's own CAS hash.
            const lineEight = returnResult.lines.find(candidate => candidate.rule === '1040 line 8')
            assert.ok(
                lineEight.sources.some(s =>
                    s.documentHash === oneZeroNineNineGHash
                    && s.boxPath === 'box1UnemploymentCompensation'),
                `expected line 8 to cite the stored 1099-G: ${JSON.stringify(lineEight.sources)}`)

            // ── The `vnd.fjs.run` record the HANDLER wrote ────────────────
            const runRecord = JSON.parse(await casGetText(run.runHash))
            assert.equal(runRecord.status, 'ok')
            assert.equal(runRecord.dialect, 'vnd.fjs.run')
            assert.equal(runRecord.programHash, programHash)
            assert.equal(runRecord.taxYear, 2025)
            assert.equal(runRecord.paramSetHash, paramSetHash(taxParamsByYear[2025]))
            assert.equal(runRecord.resultHash, run.resultHash)
            assert.equal(runRecord.pinned, false)
            for (const subject of [subjectProfile, subjectW2A, subjectW2B, subject1099G]) {
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
                553500n)

            // Both pinned records claim the pin they actually applied, and
            // both count toward reproducibility acceptance (EXEC-13).
            for (const pinned of [pinnedRun1, pinnedRun2]) {
                const record = JSON.parse(await casGetText(pinned.runHash))
                assert.equal(record.pinned, true)
                assert.equal(record.subject, subjectW2A)
                assert.deepEqual(record.parents, [w2ARevision1])
                assert.equal(countsTowardReproducibilityAcceptance(record), true)
            }

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
