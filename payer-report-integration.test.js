// @ts-nocheck
//
// This file exists outside `tsc`'s type checking on purpose, for the same two
// reasons `fjs-run-integration.test.js` states in full (and
// `fjs/todo/upstream-node-spawn-effect.md` documents at length):
//
// 1. TypeScript cannot resolve `node:child_process` / `node:test` /
//    `node:assert` / `node:fs` / `node:os` / `node:path` / `node:url`
//    without `@types/node`, and AGENTS.md forbids adding any new dependency
//    — including a devDependency — without every repo owner's approval (a
//    hard stop). That approval is not being sought just to typecheck one
//    test harness.
// 2. `fjs/effects/node` has no subprocess-spawn effect, so a genuinely
//    separate-OS-process proof cannot be written as a pure `.f.js` proof at
//    all. This file is therefore, like `index.js`, `all.test.js`, and
//    `fjs-run-integration.test.js`, a root-level impure JS file by necessity
//    (AGENTS.md's carve-out for exactly this category).
//
// `@ts-nocheck` disables TYPE checking of this one file only.
//
// ── Why this test exists (PROV-08, 15-01-PLAN.md Task 3) ────────────────────
//
// Every proof of `fjs/report/payer/module.f.js` so far (that module's own
// unit proof, Task 1) exercises `payerReport`, the FUNCTION twin, under a
// hand-built virtual `interpret`/`hostMap` — never the literal
// `payerReportSource` bytes, and never a real `fjs_run` call. "With no
// engine change" (PROV-08's own criterion) is only demonstrated, not merely
// asserted, if the literal stored program text actually runs through the
// real, unmodified `fjs_run` MCP path in a genuinely separate OS process —
// exactly the seam `fjs-run-integration.test.js` proves for the tax-report
// shape, replicated here for a report that consults no tax parameter at
// all. This file therefore mirrors `fjs-run-integration.test.js`'s exact
// real-process harness (spawn, NDJSON stdin/stdout framing, `waitForId`,
// `casAdd`, cleanup in `finally`) rather than reinventing it.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

// Reused for real, not re-implemented — the same money/dialect helpers
// `fjs-run-integration.test.js` itself reuses. `payerReportSource` is the
// ONLY import from the module under test, and it is used only to seed the
// program's bytes — this test never imports `payerReport` (the function
// twin) and never calls it, so the expected totals below cannot have been
// derived from the code under test (AGENTS.md).
import { centsFromString, centsToString } from './fjs/exact/module.f.js'
import { dialect as oneZeroNineNineIntDialect, validate as validateOneZeroNineNineInt } from './fjs/document/1099int/module.f.js'
import { dialect as oneZeroNineNineDivDialect, validate as validateOneZeroNineNineDiv } from './fjs/document/1099div/module.f.js'
import { dialect as revisionDialect } from 'functionalscript/fjs/media/revision/module.f.mjs'
import { payerReportSource } from './fjs/report/payer/module.f.js'

const repoRoot = fileURLToPath(new URL('.', import.meta.url))

// Same field values as `fjs/server/module.f.js`'s own `initializeRequest` /
// `initializedNotification`, mirrored here rather than imported (module-
// private constants of a pure `.f.js` module) — identical to
// `fjs-run-integration.test.js`'s own copy, so this real client negotiates
// the same way.
const requestedProtocolVersion = '2025-06-18'
const initializeRequest = id => ({
    jsonrpc: '2.0',
    method: 'initialize',
    id,
    params: {
        protocolVersion: requestedProtocolVersion,
        capabilities: {},
        clientInfo: { name: 'finance-payer-report-integration-client', version: '0.0.1' },
    },
})
const initializedNotification = { jsonrpc: '2.0', method: 'notifications/initialized' }

test(
    'PROV-08: the stored payer-report program runs through a real, separate fjs_run process and returns correct per-payer totals',
    { timeout: 60_000 },
    async () => {
        const home = mkdtempSync(join(tmpdir(), 'finance-payer-report-integration-home-'))
        let serverProc = null
        try {
            // No special working directory required — same conclusion
            // `fjs-run-integration.test.js` establishes (07-10): `executeRun`
            // imports from the full materialize path it itself wrote, never
            // a bare specifier resolved against the launcher's cwd.
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
            // `id`, never by a sleep — same T-07-09-02 discipline
            // `fjs-run-integration.test.js` follows.
            const waitForId = async (id, timeoutMs = 20_000) => {
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

            const casAdd = async content => {
                const response = await call('cas_add', { content, type: 'text' })
                assert.ok(!response.result.isError, `cas_add failed: ${JSON.stringify(response)}`)
                return response.result.content[0].text
            }

            // ── Seed two payers' worth of documents: payerX's 1099-INT has
            // box1InterestIncome PRESENT; payerY's 1099-INT has it ABSENT
            // (never coerced to zero — DOC-11), and payerY ALSO has a
            // present 1099-DIV — proving the absent INT box neither blocks
            // nor corrupts payerY's DIV-derived total ──────────────────────
            const payerX = '11-1111111'
            const payerY = '22-2222222'
            const intAmount = '1234.56'
            const divAmount = '500.25'
            const sourceArtifactHash = 'deadbeef00112233445566778899aabbccddeeff0011223344556677889900'

            const docXInt = {
                dialect: oneZeroNineNineIntDialect,
                payerTin: payerX,
                recipientTin: '333-33-3333',
                accountNumber: 'ACC-PAYER-X',
                taxYear: 2024,
                formRevision: '2024',
                box1InterestIncome: intAmount,
            }
            const docYIntAbsent = {
                dialect: oneZeroNineNineIntDialect,
                payerTin: payerY,
                recipientTin: '333-33-3333',
                accountNumber: 'ACC-PAYER-Y-INT',
                taxYear: 2024,
                formRevision: '2024',
                // box1InterestIncome deliberately omitted — absent, not zero.
            }
            const docYDiv = {
                dialect: oneZeroNineNineDivDialect,
                payerTin: payerY,
                recipientTin: '333-33-3333',
                accountNumber: 'ACC-PAYER-Y-DIV',
                taxYear: 2024,
                formRevision: '2024',
                sourceArtifactHash,
                box1aTotalOrdinaryDividends: divAmount,
            }

            const [intXValid] = validateOneZeroNineNineInt(docXInt)
            assert.equal(intXValid, 'ok', 'expected the seeded payerX 1099-INT to validate')
            const [intYValid] = validateOneZeroNineNineInt(docYIntAbsent)
            assert.equal(intYValid, 'ok', 'expected the seeded payerY 1099-INT (absent box) to validate')
            const [divYValid] = validateOneZeroNineNineDiv(docYDiv)
            assert.equal(divYValid, 'ok', 'expected the seeded payerY 1099-DIV to validate')

            const docXIntHash = await casAdd(JSON.stringify(docXInt))
            const docYIntAbsentHash = await casAdd(JSON.stringify(docYIntAbsent))
            const docYDivHash = await casAdd(JSON.stringify(docYDiv))

            // Revisions written directly as raw vnd.fjs.revision blobs via
            // cas_add (bypassing evo_add) — the same established technique
            // `fjs-run-integration.test.js` uses; cas_add's own handler
            // folds a recognized revision blob into the live Evo cache as it
            // is written, so these are visible to evo_list/evo_head with no
            // restart or explicit cas_refresh.
            const subjectXInt = 'payer-report-integration-subject-x-int'
            const subjectYIntAbsent = 'payer-report-integration-subject-y-int-absent'
            const subjectYDiv = 'payer-report-integration-subject-y-div'
            const revisionText = (subject, snapshot) => JSON.stringify({
                dialect: revisionDialect,
                subject,
                parents: [],
                snapshot,
                generation: 0,
            })
            await casAdd(revisionText(subjectXInt, docXIntHash))
            await casAdd(revisionText(subjectYIntAbsent, docYIntAbsentHash))
            await casAdd(revisionText(subjectYDiv, docYDivHash))

            // The payer report's REAL stored source, written for real via
            // cas_add — the exact bytes `fjs/report/payer/module.f.js`
            // exports, never a rewritten or re-derived copy.
            const programHash = await casAdd(payerReportSource)

            // ── The decisive call: fjs_run through the real, separate
            // process, over the payer report's own literal stored text ────
            const runResponse = await call('fjs_run', { hash: programHash, taxYear: 2025 })
            assert.equal(runResponse.result.isError, undefined, `fjs_run failed: ${JSON.stringify(runResponse)}`)
            const parsed = JSON.parse(runResponse.result.content[0].text)
            assert.ok(typeof parsed.resultHash === 'string' && parsed.resultHash !== '', 'expected a resultHash')
            assert.ok(typeof parsed.runHash === 'string' && parsed.runHash !== '', 'expected a runHash')

            // The expected result, computed INDEPENDENTLY here — via
            // centsFromString/centsToString from fjs/exact directly on the
            // literal seed amounts above, never by importing `payerReport`
            // or re-deriving the totals from the module under test
            // (AGENTS.md: a proof's expected side must not be produced by
            // the code under test).
            const payerReportRule = 'income received per payer (1099-INT box1, 1099-DIV box1a)'
            const expectedByPayer = {
                [payerX]: {
                    value: centsToString(centsFromString(intAmount)),
                    sources: [{ documentHash: docXIntHash, boxPath: 'box1InterestIncome', value: intAmount }],
                    rule: payerReportRule,
                },
                [payerY]: {
                    value: centsToString(centsFromString(divAmount)),
                    sources: [{ documentHash: docYDivHash, boxPath: 'box1aTotalOrdinaryDividends', value: divAmount }],
                    rule: payerReportRule,
                },
            }

            const resultGet = await call('cas_get', { hash: parsed.resultHash, content: true })
            assert.ok(!resultGet.result.isError, `cas_get(resultHash) failed: ${JSON.stringify(resultGet)}`)
            const resultMeta = JSON.parse(resultGet.result.content[0].text)
            const actualByPayer = JSON.parse(resultMeta.text)
            assert.deepEqual(actualByPayer, expectedByPayer)

            // The absent-box payer's document was genuinely visited (its
            // subject's evoHead read appears in the PERSISTED run record),
            // proving the program actively walked and skipped it, rather
            // than this test simply never presenting it — the same
            // decisive-visitation check `fjs-run-integration.test.js` makes
            // for its own absent-field subject.
            const runGet = await call('cas_get', { hash: parsed.runHash, content: true })
            assert.ok(!runGet.result.isError, `cas_get(runHash) failed: ${JSON.stringify(runGet)}`)
            const runMeta = JSON.parse(runGet.result.content[0].text)
            const runRecord = JSON.parse(runMeta.text)
            assert.equal(runRecord.status, 'ok')
            assert.ok(
                runRecord.inputs.some(i => i.command === 'evoHead' && i.payload[0] === subjectYIntAbsent),
                'expected the absent-box subject to have been enumerated')

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
