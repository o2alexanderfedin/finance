// @ts-nocheck
//
// This file exists outside `tsc`'s type checking on purpose, for the same two
// reasons `fjs-run-integration.test.js`, `payer-report-integration.test.js`
// and `tax-return-integration.test.js` each state in full:
//
// 1. TypeScript cannot resolve `node:child_process` / `node:test` /
//    `node:assert` / `node:fs` / `node:os` / `node:path` / `node:url`
//    without `@types/node`, and AGENTS.md forbids adding any new dependency
//    — including a devDependency — without every repo owner's approval.
// 2. `fjs/effects/node` has no subprocess-spawn effect (filed upstream as
//    `functionalscript#1649`), so a genuinely separate-OS-process proof
//    cannot be written as a pure `.f.js` proof at all.
//
// `@ts-nocheck` disables TYPE checking of this one file only.
//
// ── Why this file exists (Phase 36, The Conversational Path) ────────────────
//
// The phase is one sentence: *documents into chat, "what do I owe for 2025?",
// answer end to end with citing hashes, no code touched.* It restates Phase
// 14's Success Criterion 1, which was never run.
//
// **"No code touched" is the claim under test, not a convenience.** The
// question this file answers is whether the MCP surface AS IT ALREADY SHIPS
// is sufficient for an agent to take raw documents, store them, compute a
// return, and answer a natural-language question with a hash behind every
// figure — without anyone adding a tool or changing the engine. So this file
// adds neither. It is a client, and everything it does, a chat client could
// do.
//
// ## Why this is not `tax-return-integration.test.js` a second time
//
// That file proves the ENGINE: seven subjects, a real `fjs_run`, PROV-05's
// pinned reproduction. It asserts nine 1040 line values and three of line
// 2b's citations. What it does not ask — because it is not its question —
// is whether an agent holding ONLY the MCP surface could have got there, and
// whether EVERY figure's citation actually resolves back out of the store to
// the value it claims. This file asks both, and the second question is the
// phase's own words.
//
// It also differs in what it seeds. `tax-return-integration.test.js` builds
// documents; a chat client receives ARTIFACTS — a scan, a photograph, an
// email attachment — and the structured document is what the agent derives
// from one. So each of the three forms below enters the store twice: once as
// a `vnd.fjs.ocr` artifact (the thing that arrives), once as the dialect
// document read off it. That is what makes the citation question sharp, and
// §"the artifact leg" below records what it found.
//
// ## The verdict, and the four gaps this file pins as assertions
//
// **The answer is reached: $6,135.00 owed, and 144 of the 144 citations
// behind it resolve** — once two things are true that the surface itself
// cannot make true. A phase whose answer is "sufficient" needs a transcript.
// A phase whose answer is "not quite" needs the failing step named and
// MECHANIZED, or it decays into a claim someone has to re-check by hand. So
// each gap below is a subtest, not a paragraph:
//
//   1. *"nothing the surface says names the vocabulary…"* — the whole surface
//      is captured in-session (thirteen tool descriptions and input schemas,
//      all thirty served dialect schemas, the parameter set, the document
//      list, and the unknown-dialect refusal) and searched for the six names
//      an agent must know to author the program. None is there. This is the
//      gap that decides the phase.
//   2. *"a wrong guess at the vocabulary ends the session…"* — the
//      consequence of (1). A program naming a `ctx` member that does not
//      exist is not refused: the server PROCESS exits with code 1, and the
//      chat session's connection is gone. `fjs_check` passes it first.
//   3. *"135 of the 144 citations…"* — nine cite `dependents` on a profile
//      that does not carry it, because the engine cites `… ?? []`. The
//      subtest after it closes those nine from the CLIENT side, with no code
//      changed, which is why this is a gap in the document rather than in the
//      engine.
//   4. *"the statutory figures are cited to a parameter set…"* — every
//      `documentHash` resolves, but $15,750.00 and the Tax Table do not come
//      from a document, and the `paramSetHash` that names where they DO come
//      from is not in the store.
//
// Full narrative, transcript and verdict: `.planning/reports/phase-36-conversational-path.md`.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

// Reused for real, not re-implemented — the same three imports the other
// harnesses take, for the same reasons. `centsFromString` turns the wire's
// decimal strings into exact cents so the expectations below are hand-typed
// `bigint`s; the dialect validators confirm the SEEDS are well-formed before
// the store is asked to compute from them.
//
// `taxReturnReportSource` is imported for ONE purpose and it is the phase's
// own subject: it is the program text the MCP surface cannot supply. See
// `theProgramTextIsSuppliedOutOfBand` below, and the report's §3. This file
// never imports `taxReturnReport` (the function twin) and never calls it, so
// no expected value below can have been produced by the code under test.
import { centsFromString } from './fjs/exact/module.f.js'
import { dialect as returnProfileDialect, validate as validateReturnProfile } from './fjs/return/profile/module.f.js'
import { dialect as w2Dialect, validate as validateW2 } from './fjs/document/w2/module.f.js'
import { dialect as oneZeroNineNineIntDialect, validate as validateOneZeroNineNineInt } from './fjs/document/1099int/module.f.js'
import { dialect as oneZeroNineNineDivDialect, validate as validateOneZeroNineNineDiv } from './fjs/document/1099div/module.f.js'
import { dialect as ocrDialect, validate as validateOcr } from './fjs/document/ocr/module.f.js'
import { taxReturnReportSource } from './fjs/report/tax_return/module.f.js'

const repoRoot = fileURLToPath(new URL('.', import.meta.url))

// Same field values as `fjs/server/module.f.js`'s own `initializeRequest` /
// `initializedNotification`, mirrored rather than imported (module-private
// constants of a pure `.f.js`), identical to the three existing harnesses.
const requestedProtocolVersion = '2025-06-18'
const initializeRequest = id => ({
    jsonrpc: '2.0',
    method: 'initialize',
    id,
    params: {
        protocolVersion: requestedProtocolVersion,
        capabilities: {},
        clientInfo: { name: 'finance-conversational-client', version: '0.0.1' },
    },
})
const initializedNotification = { jsonrpc: '2.0', method: 'notifications/initialized' }

// ── The taxpayer ────────────────────────────────────────────────────────────
//
// One single filer for tax year 2025, three forms, and withholding
// deliberately SHORT of the tax — so the answer to "what do I owe for 2025?"
// is an amount owed (1040 line 37) rather than a refund. Every other
// integration fixture in this repository overpays; a question about owing
// that can only ever be answered "you are owed a refund" is not the question
// the phase asks.
//
// Every identifier is digit-only. `ACC-0001`-shaped fixture strings read as
// requirement citations to `planning-truth-gate.test.js`'s ID scan, and this
// file is inside that scan's own source set.
const taxpayerSsn = '222-22-2222'

// ── The arithmetic, hand-derived, checkable without running anything ────────
//
//   line 1a  wages                                             88,000.00
//   line 2b  taxable interest                                   2,400.00
//   line 3b  ordinary dividends                                  3,600.00
//   line 9   total income                                       94,000.00
//   line 11  adjusted gross income (nothing to adjust)          94,000.00
//   line 12e standard deduction, single, TY2025                 15,750.00
//   line 15  taxable income  94,000.00 - 15,750.00              78,250.00
//   line 16  tax (Tax Table)                                    12,135.00
//   line 25a federal income tax withheld, Form W-2 box 2         6,000.00
//   line 33  total payments                                      6,000.00
//   line 37  AMOUNT YOU OWE  12,135.00 - 6,000.00                6,135.00
//
// **Line 16 is a Tax Table BAND lookup, not a bracket evaluation**, and it is
// hand-derived from the printed table's own rule rather than recomputed with
// the engine. `78,250.00` opens the "at least $78,250, but less than $78,300"
// row (the $50 band region runs from $3,000 to $100,000), whose printed tax is
// the bracket schedule applied to that band's $78,275 MIDPOINT:
//
//   10% x 11,925.00 (the first bracket, in full)          =  1,192.50
//   12% x (48,475.00 - 11,925.00 = 36,550.00)             =  4,386.00
//   22% x (78,275.00 - 48,475.00 = 29,800.00)             =  6,556.00
//                                                            ---------
//                                                            12,134.50
//
// rounded half up to the whole dollar the table prints:      12,135.00.
//
// The same derivation reproduces `tax-return-integration.test.js`'s own
// figure ($41,709.00 -> the $41,700/$41,750 band, midpoint $41,725,
// 1,192.50 + 12% x 29,800.00 = 4,768.50 -> $4,769), which is the check that
// the midpoint-and-half-up rule used here is the right one rather than a
// guess that happened to land.
const expectedLineCents = [
    ['1040 line 1a', 8800000n],
    ['1040 line 2b', 240000n],
    ['1040 line 3b', 360000n],
    ['1040 line 9', 9400000n],
    ['1040 line 11b', 9400000n],
    ['1040 line 12e', 1575000n],
    ['1040 line 15', 7825000n],
    ['1040 line 16 (Tax Table)', 1213500n],
    ['1040 line 25a', 600000n],
    ['1040 line 33', 600000n],
    ['1040 line 34', 0n],
    ['1040 line 37', 613500n],
]

/** The answer the question asks for, stated once. */
const amountOwedRule = '1040 line 37'
const amountOwedCents = 613500n

/**
 * The vocabulary a stored report program has to be written in — `ctx`'s own
 * member names (`fjs/guest/module.f.js`'s frozen ABI plus `fjs/guest/tax`'s
 * two additions) and the entry-point spelling the executor requires.
 *
 * Hand-typed here rather than derived from `guestCtx`/`taxGuestCtx`, and
 * that is the point: this is the INDEPENDENT side of a search. A list built
 * by `Object.keys(guestCtx)` would prove that the surface omits whatever
 * `guestCtx` currently holds; this one states what an agent must know, so
 * the leaf keeps meaning the same thing if the ABI is later widened.
 *
 * `evoList`, `evoHead`, `evoRevision` and `casRead` are deliberately NOT
 * here. Those four ARE reachable from the surface — `fjs/exec`'s refusal
 * message prints the permitted command list — so including them would make
 * the search trivially fail and prove nothing. The six below are the ones
 * with no path from the surface at all, and `form1040Report` is the one that
 * decides the phase: without it a guest can sum boxes but cannot produce a
 * 1040.
 */
const guestVocabularyTheAgentMustKnow = [
    'form1040Report',
    'taxParams',
    'centsFromString',
    'centsToString',
    'ctx.step',
    'ctx.pure',
]

/**
 * The advertised tool set, hand-typed — Phase 21's own list, unchanged,
 * because this phase adds nothing. A count alone cannot see a swap, so both
 * the names and the count are stated and both are asserted.
 */
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

/**
 * The content hashes the four stored documents take, hand-typed so the hash
 * table in `.planning/reports/phase-36-conversational-path.md` is pinned to
 * this run rather than transcribed from one.
 *
 * These are stable because the store is content-addressed and the fixture
 * above is a literal: the same bytes hash to the same address on every
 * machine and every day. A fixture edited by one byte reddens exactly the
 * row it moved, which is the report staying true by construction instead of
 * by someone remembering.
 *
 * The program, result and run hashes are deliberately NOT pinned this way —
 * they move with `taxReturnReportSource` and with the engine, so a literal
 * here would redden on every unrelated engine change and teach the next
 * reader to update it without reading it.
 */
const expectedStoredHashes = {
    profile: '1fkm7jz0skzaxdfstfakdz4z00d4f7t98sp7q233q43rt97mv69r',
    w2: '1gk7pmczjxjdcme3w4wj1q4vxrc4x9b25xq88888xpm9dx0pb6cr',
    interest: '8nnemgkk1vy29e1bx2e4adanpbn36afwmyaft1bpw71ffhaknp98',
    dividends: 'xpka6kk85992ejkdawbpjtq8wt3jr7qh1x56qvjh4sssc454s0e8',
    dividendArtifact: '43ft5bp5te3t9jkw88gv4k9thxe8e2dc47fdxzf5kyh6ysk5z28r',
}

/**
 * The program a surface-only agent plausibly writes: it uses the four
 * read-only commands (the ONE part of the vocabulary the surface can
 * disclose, via `fjs/exec`'s refusal message), walks a subject down to its
 * document exactly as a real report does, and then reaches for a tax entry
 * point it has to GUESS the name of, because nothing it can call names one.
 *
 * `computeForm1040` is a good-faith guess, not a straw man: it is the name
 * the tool set's own vocabulary suggests (`finance_documents_list`,
 * `finance_tax_params`, `finance_schema`) for the operation the question
 * needs, and it is close to the name `.planning/REQUIREMENTS.md` permanently
 * forbids as a TOOL (`finance_compute_1040`) — the forbidding of which is
 * exactly why the capability has to be reached some other way.
 */
const guessedVocabularyProgramSource = [
    'export const report = ctx => args => ctx.step(ctx.evoList(\'false\'), activeJson => {',
    '    const subjects = JSON.parse(activeJson)',
    '    return ctx.step(ctx.evoHead(subjects[0]), headsJson => {',
    '        const heads = JSON.parse(headsJson)',
    '        return ctx.step(ctx.evoRevision(heads[0]), revJson => {',
    '            const rev = JSON.parse(revJson)',
    '            return ctx.step(ctx.casRead(rev.snapshot), docJson => {',
    '                const doc = JSON.parse(docJson)',
    '                return ctx.pure(JSON.stringify(ctx.computeForm1040({ documents: [doc], year: 2025 })))',
    '            })',
    '        })',
    '    })',
    '})',
    '',
].join('\n')

/**
 * Spawns one real `node index.js <home>` server and returns the client
 * primitives every leg below speaks through — the same `send`/`waitForId`/
 * `call` shapes the three existing harnesses use, extracted here only
 * because THIS file needs two server processes (the second one is killed by
 * the program it runs, which is the finding) and a second hand-mirrored copy
 * inside one file would be a copy with no reader.
 *
 * Readiness is proven by matching the response's own JSON-RPC `id`, never by
 * a sleep. `exitInfo()` reports a server that died rather than answered, so a
 * dead process fails a leaf explicitly instead of hanging to its deadline.
 */
const startServer = home => {
    const proc = spawn('node', [join(repoRoot, 'index.js'), home], { stdio: ['pipe', 'pipe', 'pipe'] })
    const responses = []
    let stdoutBuf = ''
    let stderrBuf = ''
    let exited = null
    proc.on('exit', (code, signal) => { exited = { code, signal } })
    proc.stdout.setEncoding('utf8')
    proc.stdout.on('data', chunk => {
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
    proc.stderr.setEncoding('utf8')
    proc.stderr.on('data', chunk => { stderrBuf += chunk })

    let nextIdCounter = 0
    const nextId = () => { nextIdCounter += 1; return nextIdCounter }
    const send = message => { proc.stdin.write(JSON.stringify(message) + '\n') }
    const waitForId = async (id, timeoutMs = 30_000) => {
        const deadline = Date.now() + timeoutMs
        while (true) {
            const found = responses.find(r => r && r.id === id)
            if (found !== undefined) {
                return found
            }
            if (exited !== null) {
                return { serverExited: exited, stderr: stderrBuf }
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
    const handshake = async () => {
        const initId = nextId()
        send(initializeRequest(initId))
        send(initializedNotification)
        const initResponse = await waitForId(initId)
        assert.ok(!('error' in initResponse), `initialize failed: ${JSON.stringify(initResponse)}`)
        return initResponse
    }
    return {
        proc,
        nextId,
        send,
        waitForId,
        call,
        handshake,
        exitInfo: () => exited,
        stderr: () => stderrBuf,
        stop: () => { proc.kill() },
    }
}

test(
    'Phase 36: documents into a session, "what do I owe for 2025?", answered end to end with a resolving hash behind every figure',
    { timeout: 180_000 },
    async t => {
        const home = mkdtempSync(join(tmpdir(), 'finance-conversational-path-home-'))
        let server = null
        let probeServer = null
        try {
            // No special working directory required — the same conclusion
            // `fjs-run-integration.test.js` establishes (07-10): `executeRun`
            // imports from the full materialize path it itself wrote.
            server = startServer(home)
            const { call } = server

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

            // ── Hoisted across the subtests below ────────────────────────
            // Produced by one concern, read by a later one — the same
            // arrangement `fjs-run-integration.test.js` documents (WR-03).
            // Every assignment stays at its original site.
            let advertisedTools
            let capturedSurface
            let unknownDialectRefusal
            let dividendArtifactHash
            let storedHashes
            let subjectNames
            let profileRevisionHash
            let programHash
            let run
            let returnResult

            await t.test('the session opens: a real handshake and the thirteen tools this phase does not add to', async () => {
                const initResponse = await server.handshake()
                assert.equal(initResponse.result.serverInfo.name, 'finance-mcp')
                assert.equal(initResponse.result.protocolVersion, '2025-11-25')

                const listId = server.nextId()
                server.send({ jsonrpc: '2.0', method: 'tools/list', id: listId })
                const listResponse = await server.waitForId(listId)
                assert.ok(!('error' in listResponse), `tools/list failed: ${JSON.stringify(listResponse)}`)
                advertisedTools = listResponse.result.tools
                const advertisedToolNames = advertisedTools.map(tool => tool.name).sort()
                assert.equal(advertisedToolNames.length, expectedToolCount)
                assert.deepEqual(advertisedToolNames, [...expectedToolNames].sort(),
                    'the conversational path must run on the shipped tool set, unchanged')
                // The thing REQUIREMENTS.md rules out, named: no tool may
                // offer to compute the form. This phase is the reason that
                // rule is load-bearing rather than decorative — everything
                // below is the cost of NOT having such a tool, paid in full.
                for (const name of advertisedToolNames) {
                    assert.ok(!name.includes('1040'), `no tool may name the form it computes; found ${name}`)
                }
            })

            await t.test('discovery: the agent reads the dialect list, four schemas and the parameter set off the surface', async () => {
                // MCP-06. An agent does not know the dialect tags either, and
                // the surface tells it: an unknown tag is refused with the
                // known set named. This is the ONE piece of self-description
                // the server volunteers, and it is worth showing because
                // §"the vocabulary" leaf below turns on there being no
                // equivalent for the guest ABI.
                const unknown = await call('finance_schema', { dialect: 'vnd.fjs.not-a-real-dialect' })
                assert.equal(unknown.result.isError, true)
                unknownDialectRefusal = unknown.result.content[0].text
                assert.ok(unknownDialectRefusal.startsWith('unknown dialect: vnd.fjs.not-a-real-dialect; known: '),
                    `expected the refusal to name the offending tag and the known set: ${unknownDialectRefusal}`)
                const knownFromRefusal = unknownDialectRefusal
                    .slice(unknownDialectRefusal.indexOf('known: ') + 'known: '.length)
                    .split(', ')
                for (const dialect of [returnProfileDialect, w2Dialect, oneZeroNineNineIntDialect, oneZeroNineNineDivDialect, ocrDialect]) {
                    assert.ok(knownFromRefusal.includes(dialect),
                        `expected the refusal's known set to name ${dialect}`)
                }

                // Every served schema, read the way an agent would: it now
                // knows the tags, so it asks for each. Captured whole for the
                // vocabulary search below.
                const schemaTexts = []
                for (const dialect of knownFromRefusal) {
                    const response = await call('finance_schema', { dialect })
                    assert.ok(!response.result.isError, `finance_schema(${dialect}) failed: ${JSON.stringify(response)}`)
                    schemaTexts.push(response.result.content[0].text)
                }
                assert.equal(schemaTexts.length, knownFromRefusal.length)
                // The four this taxpayer needs name their own money boxes, so
                // the agent can read the boxes off the scans into the right
                // fields — MCP-06's whole purpose.
                const namedBoxes = [
                    [w2Dialect, 'box1WagesTipsOtherCompensation'],
                    [w2Dialect, 'box2FederalIncomeTaxWithheld'],
                    [oneZeroNineNineIntDialect, 'box1InterestIncome'],
                    [oneZeroNineNineDivDialect, 'box1aTotalOrdinaryDividends'],
                    [returnProfileDialect, 'declaredKinds'],
                ]
                for (const [dialect, box] of namedBoxes) {
                    const index = knownFromRefusal.indexOf(dialect)
                    assert.ok(index !== -1, `expected ${dialect} in the known set`)
                    assert.ok(schemaTexts[index].includes(box),
                        `expected ${dialect}'s schema to name ${box}`)
                }

                // MCP-07: the agent reads TY2025's parameters rather than
                // recalling them.
                const taxParamsResponse = await call('finance_tax_params', { year: 2025 })
                assert.ok(!taxParamsResponse.result.isError, `finance_tax_params failed: ${JSON.stringify(taxParamsResponse)}`)
                const taxParamsText = taxParamsResponse.result.content[0].text
                assert.ok(taxParamsText.includes('15750.00'),
                    'expected the parameter set to name the single standard deduction this return uses')
                assert.ok(taxParamsText.includes('2025-32'),
                    'expected the parameter set to carry its own Rev. Proc. citation')

                capturedSurface = [
                    JSON.stringify(advertisedTools),
                    unknownDialectRefusal,
                    ...schemaTexts,
                    taxParamsText,
                ].join('\n')
                // A floor, so a broken capture cannot pass the search below by
                // being empty. Thirty schemas plus thirteen tool entries is
                // far more than this; the number is a tripwire, not a target.
                assert.ok(capturedSurface.length > 45_000,
                    `only ${capturedSurface.length} characters of surface captured — the capture has broken`)
            })

            await t.test('the documents arrive: three artifacts as received, three documents read off them, one declared profile', async () => {
                // What a chat client actually hands over: the scan. Stored
                // first, and by its own hash, so the document below can point
                // back at the thing it was read from.
                const w2Artifact = {
                    dialect: ocrDialect,
                    pages: ['Form W-2 Wage and Tax Statement 2025'],
                    fields: { box1: '88000.00', box2: '6000.00' },
                }
                const interestArtifact = {
                    dialect: ocrDialect,
                    pages: ['Form 1099-INT Interest Income 2025'],
                    fields: { box1: '2400.00' },
                }
                const dividendArtifact = {
                    dialect: ocrDialect,
                    pages: ['Form 1099-DIV Dividends and Distributions 2025'],
                    fields: { box1a: '3600.00' },
                }
                for (const artifact of [w2Artifact, interestArtifact, dividendArtifact]) {
                    const [status, value] = validateOcr(artifact)
                    assert.equal(status, 'ok', `expected the artifact to validate: ${JSON.stringify(value)}`)
                }
                const w2ArtifactHash = await casAdd(JSON.stringify(w2Artifact))
                const interestArtifactHash = await casAdd(JSON.stringify(interestArtifact))
                dividendArtifactHash = await casAdd(JSON.stringify(dividendArtifact))
                assert.equal(dividendArtifactHash, expectedStoredHashes.dividendArtifact)
                assert.notEqual(w2ArtifactHash, interestArtifactHash)

                // The structured documents the agent derives from the scans.
                // **Only `vnd.fjs.1099div` has anywhere to record which scan
                // it came from.** `sourceArtifactHash` is a required field on
                // that dialect (and on `vnd.fjs.1099b`) and exists on no
                // other, so the W-2's and the 1099-INT's artifacts are stored
                // and orphaned. The artifact leg of the citation chain is
                // therefore one dialect wide, and the report says so.
                const profileDocument = {
                    dialect: returnProfileDialect,
                    taxYear: 2025,
                    filingStatus: 'single',
                    dependentCount: 0,
                    declaredKinds: ['wages', 'taxableInterest', 'ordinaryDividends', 'federalTaxWithheldOnW2'],
                }
                const w2Document = {
                    dialect: w2Dialect,
                    employerEIN: '11-1111111',
                    employeeSSN: taxpayerSsn,
                    controlNumber: '70155001',
                    taxYear: 2025,
                    formRevision: '2025',
                    box1WagesTipsOtherCompensation: '88000.00',
                    box2FederalIncomeTaxWithheld: '6000.00',
                }
                const interestDocument = {
                    dialect: oneZeroNineNineIntDialect,
                    payerTin: '33-3333333',
                    recipientTin: taxpayerSsn,
                    accountNumber: '40088001',
                    taxYear: 2025,
                    formRevision: '2025',
                    box1InterestIncome: '2400.00',
                }
                const dividendDocument = {
                    dialect: oneZeroNineNineDivDialect,
                    payerTin: '55-5555555',
                    recipientTin: taxpayerSsn,
                    accountNumber: '50077002',
                    taxYear: 2025,
                    formRevision: '2025',
                    sourceArtifactHash: dividendArtifactHash,
                    box1aTotalOrdinaryDividends: '3600.00',
                }
                assert.equal(validateReturnProfile(profileDocument)[0], 'ok')
                assert.equal(validateW2(w2Document)[0], 'ok')
                assert.equal(validateOneZeroNineNineInt(interestDocument)[0], 'ok')
                assert.equal(validateOneZeroNineNineDiv(dividendDocument)[0], 'ok')

                storedHashes = {
                    profile: await casAdd(JSON.stringify(profileDocument)),
                    w2: await casAdd(JSON.stringify(w2Document)),
                    interest: await casAdd(JSON.stringify(interestDocument)),
                    dividends: await casAdd(JSON.stringify(dividendDocument)),
                }
                // The report's hash table, pinned to this run.
                assert.deepEqual(storedHashes, {
                    profile: expectedStoredHashes.profile,
                    w2: expectedStoredHashes.w2,
                    interest: expectedStoredHashes.interest,
                    dividends: expectedStoredHashes.dividends,
                })

                subjectNames = {
                    profile: 'conversational-profile',
                    w2: 'conversational-w2',
                    interest: 'conversational-interest',
                    dividends: 'conversational-dividends',
                }
                // The profile's first revision hash is kept: the amendment
                // subtest below adds a second revision onto it, which is what
                // `parents` means.
                profileRevisionHash = await evoAdd({ parents: [], subject: subjectNames.profile, snapshot: storedHashes.profile })
                for (const key of ['w2', 'interest', 'dividends']) {
                    await evoAdd({ parents: [], subject: subjectNames[key], snapshot: storedHashes[key] })
                }

                // MCP-08: the agent confirms what it just filed. The listed
                // `hash` is the HEAD REVISION's, not the document's — one row
                // per (subject, head) pair — so the route from this listing to
                // a document body runs evo_revision -> snapshot -> cas_get,
                // and the next assertion walks it, because that is the route
                // an agent answering a question about a stored figure takes.
                const listResponse = await call('finance_documents_list', {})
                assert.ok(!listResponse.result.isError, `finance_documents_list failed: ${JSON.stringify(listResponse)}`)
                const listed = JSON.parse(listResponse.result.content[0].text)
                assert.equal(listed.length, 4)
                for (const key of ['profile', 'w2', 'interest', 'dividends']) {
                    const entry = listed.find(candidate => candidate.subject === subjectNames[key])
                    assert.ok(entry !== undefined, `expected ${subjectNames[key]} in the document list`)
                    assert.equal(entry.taxYear, 2025)
                    assert.notEqual(entry.hash, storedHashes[key],
                        'the listed hash is the head revision, not the document')
                    const revisionResponse = await call('evo_revision', { hash: entry.hash })
                    assert.ok(!revisionResponse.result.isError, `evo_revision failed: ${JSON.stringify(revisionResponse)}`)
                    const revision = JSON.parse(revisionResponse.result.content[0].text)
                    assert.equal(revision.snapshot, storedHashes[key],
                        'the listed head must resolve, through its revision, to the document that was filed')
                    assert.equal(JSON.parse(await casGetText(revision.snapshot)).dialect, entry.dialect)
                }
            })

            await t.test('the gap: nothing the surface says names the vocabulary a stored program must be written in', async () => {
                // The whole captured surface — every tool name, description
                // and input schema, every served dialect schema, the tax
                // parameter set, and the one refusal that volunteers a list —
                // searched for the six names §"guestVocabularyTheAgentMustKnow"
                // states an agent must know to author the program the next
                // subtest runs.
                assert.ok(capturedSurface.length > 0, 'the surface capture must precede this search')
                const found = guestVocabularyTheAgentMustKnow.filter(name => capturedSurface.includes(name))
                assert.deepEqual(found, [],
                    'the MCP surface names part of the guest vocabulary after all — re-read the report before trusting its verdict')

                // The control: the search is capable of finding something.
                // Without it, a capture that silently became empty, or a
                // `.includes` misuse, would pass this leaf as a "gap".
                for (const present of ['box1WagesTipsOtherCompensation', 'finance_documents_list', '15750.00']) {
                    assert.ok(capturedSurface.includes(present),
                        `the search must be able to find ${present}, or its emptiness proves nothing`)
                }

                // And the ONE fragment that IS reachable, stated so the
                // finding is not overclaimed: `fjs/exec`'s refusal prints the
                // four permitted command names. It is reachable only by
                // running a program that violates the policy, and four
                // read-only commands are not enough to author a 1040 — but it
                // is not nothing, and a report that pretended otherwise would
                // be wrong in the direction that matters.
                assert.equal(capturedSurface.includes('evoRevision'), false,
                    'even the four op names are absent from the STATIC surface; they surface only in a refusal')
            })

            await t.test('the program text is supplied out of band, and everything after it is the surface again', async () => {
                // **This line is the phase's answer.** `taxReturnReportSource`
                // is a module export of this repository; no MCP call returns
                // it, and nothing above disclosed enough to write it. A Claude
                // Code session could READ it — the repository is on disk — and
                // that reading is what this import stands in for. A Claude
                // Desktop session, holding the MCP surface and nothing else,
                // could not.
                programHash = await casAdd(taxReturnReportSource)

                // MCP-09: the agent smoke-checks before running. Note what
                // this does and does not say — `exportsReport` is a shape,
                // never a sandbox or a verification (the tool's own
                // description says so), and the next subtest is what that
                // costs.
                const checkResponse = await call('fjs_check', { hash: programHash })
                assert.ok(!checkResponse.result.isError, `fjs_check failed: ${JSON.stringify(checkResponse)}`)
                assert.deepEqual(JSON.parse(checkResponse.result.content[0].text), { exportsReport: true })

                const runResponse = await call('fjs_run', { hash: programHash, taxYear: 2025 })
                assert.equal(runResponse.result.isError, undefined, `fjs_run failed: ${JSON.stringify(runResponse)}`)
                run = JSON.parse(runResponse.result.content[0].text)
                assert.equal(run.taxYear, 2025)
                assert.equal(run.programHash, programHash)
                // PROV-07: one `evoList` plus `evoHead`/`evoRevision`/`casRead`
                // per subject — 1 + 3 x 4. Hand-typed, because "greater than
                // zero" passes for a program that read one document and
                // invented the rest.
                assert.equal(run.readCount, 13)

                returnResult = JSON.parse(await casGetText(run.resultHash))
                assert.equal(returnResult.kind, 'ok',
                    `expected a computed return, got: ${JSON.stringify(returnResult).slice(0, 400)}`)
                assert.equal(returnResult.taxYear, 2025)
                assert.equal(returnResult.line16Method, 'taxTable')
            })

            await t.test('the answer: "what do I owe for 2025?" is $6,135.00, and every figure behind it is the hand-derived one', async () => {
                const centsAt = rule => {
                    const line = returnResult.lines.find(candidate => candidate.rule === rule)
                    assert.ok(line !== undefined, `expected the return to carry ${rule}`)
                    return centsFromString(line.value)
                }
                for (const [rule, cents] of expectedLineCents) {
                    assert.equal(centsAt(rule), cents, `${rule} is not the hand-derived figure`)
                }
                // The question was "what do I OWE". Line 34 (overpaid) is zero
                // and line 37 (amount you owe) is not — asserted as a pair, so
                // a return that refunded instead could not pass by carrying
                // the right number on the wrong line.
                assert.equal(centsAt('1040 line 34'), 0n)
                assert.equal(centsAt(amountOwedRule), amountOwedCents)
                // And the arithmetic that makes it an answer rather than a
                // figure, restated against the lines themselves.
                assert.equal(centsAt('1040 line 16 (Tax Table)') - centsAt('1040 line 33'), amountOwedCents)
            })

            // The phase's own words: "answer end to end with citing hashes".
            // A citation nobody resolves is a string. So each one is fetched
            // through `cas_get` — the same tool a client would use — the
            // document is parsed, and the box the citation names is compared
            // to the value the citation claims.
            //
            // Declared out here, not inside the subtest that first uses it,
            // because the amendment subtest runs the SAME resolver over a
            // second run's result: two copies could drift, and the second
            // subtest's whole point is that its numbers are comparable to the
            // first's.
            const bodyByHash = new Map()
            const bodyOf = async hash => {
                if (!bodyByHash.has(hash)) {
                    bodyByHash.set(hash, JSON.parse(await casGetText(hash)))
                }
                return bodyByHash.get(hash)
            }
            // `boxPath` is dialect-qualified where two dialects spell the same
            // box the same way (`k1_1041.box1InterestIncome` versus a
            // 1099-INT's `box1InterestIncome`), so the field name is the last
            // segment. Array-valued boxes (`declaredKinds`) are cited as their
            // JSON rendering, which is how the engine states a value that is
            // not money.
            const renderStored = value => typeof value === 'string' ? value : JSON.stringify(value)

            /**
             * Walks every rendered line's every source, fetching each cited
             * document through `cas_get` and comparing the box the citation
             * names against the value it claims.
             *
             * Three outcomes are counted separately and none is collapsed
             * into the others: `resolved` (the document carries the field and
             * it says what the citation says), `absent` (the document does not
             * carry the field at all) and `mismatched` (it carries it and
             * disagrees). A single "did it resolve" boolean would report the
             * first two identically, and they are not the same failure — see
             * the two assertions below.
             */
            const resolveCitations = async result => {
                const citedHashes = new Set()
                const absent = []
                const mismatched = []
                let resolved = 0
                let sourceCount = 0
                assert.ok(result.lines.length > 0, 'a return with no lines cannot be checked')
                const carryforward = result.qualifiedBusinessLossCarryforward
                assert.ok(carryforward !== undefined, 'the rendered result must carry the §199A(c)(2) carryforward')
                for (const line of [...result.lines, carryforward]) {
                    assert.ok(Array.isArray(line.sources) && line.sources.length > 0,
                        `a rendered line carries no source: ${line.rule}`)
                    for (const source of line.sources) {
                        sourceCount += 1
                        citedHashes.add(source.documentHash)
                        const document = await bodyOf(source.documentHash)
                        const field = source.boxPath.slice(source.boxPath.lastIndexOf('.') + 1)
                        if (!Object.hasOwn(document, field)) {
                            absent.push(`${line.rule} -> ${source.boxPath} = ${source.value}`)
                        } else if (renderStored(document[field]) !== source.value) {
                            mismatched.push(`${line.rule} -> ${source.boxPath}: claims ${source.value}, stored ${renderStored(document[field])}`)
                        } else {
                            resolved += 1
                        }
                    }
                }
                return { citedHashes: [...citedHashes].sort(), absent, mismatched, resolved, sourceCount }
            }

            await t.test('every figure cites a hash, and 135 of the 144 citations read back out of the store carrying the claimed value', async () => {
                const chain = await resolveCitations(returnResult)
                // Hand-typed counts. A resolver that silently visited nothing
                // passes every assertion above; these are what say it did not.
                assert.equal(returnResult.lines.length, 56)
                assert.equal(chain.sourceCount, 144)
                assert.equal(chain.resolved, 135)
                // **No citation states a value the stored document contradicts.**
                // This is the strong half of the phase's claim and it holds
                // outright: not one of the 129 names a figure the store
                // disagrees with.
                assert.deepEqual(chain.mismatched, [])
                // **Nine do name a field the stored document does not carry**,
                // and this is the citation chain's one break. All nine are the
                // same box on the same document: `fjs/form1040/core` cites
                // `dependents` as `JSON.stringify(profile.value.dependents ?? [])`,
                // so a profile that OMITS the optional array — which this one
                // does, legally, because `checkReferences` only requires
                // agreement with `dependentCount` when the array is present —
                // is cited as saying `[]` when it says nothing at all. The
                // claim is semantically true (this taxpayer has no dependents)
                // and literally unreadable: an auditor following the citation
                // finds no such field.
                //
                // Listed line by line rather than counted, so a tenth line
                // acquiring the same defaulted citation reddens here and names
                // itself. `theSameRunResolvesCompletelyOnceTheProfileStatesTheArray`
                // (the next subtest) is what shows this is closable by the
                // AGENT, at document-authoring time, with no code changed.
                assert.deepEqual(chain.absent, [
                    '1040 line 19 -> dependents = []',
                    '1040 line 21 -> dependents = []',
                    '1040 line 22 -> dependents = []',
                    '1040 line 24 -> dependents = []',
                    '1040 line 28 -> dependents = []',
                    '1040 line 32 -> dependents = []',
                    '1040 line 33 -> dependents = []',
                    '1040 line 34 -> dependents = []',
                    '1040 line 37 -> dependents = []',
                ])
                // Every cited hash is one of the four documents actually
                // filed, and all four are cited — so no figure was traced to
                // something the session never stored, and no stored document
                // went unread.
                assert.deepEqual(chain.citedHashes, Object.values(storedHashes).sort())

                // The bottom line specifically, named rather than left to the
                // sweep: the amount owed cites the wage and withholding boxes
                // it is computed from, by the W-2's own hash.
                const amountOwed = returnResult.lines.find(candidate => candidate.rule === amountOwedRule)
                for (const boxPath of ['box1WagesTipsOtherCompensation', 'box2FederalIncomeTaxWithheld']) {
                    assert.ok(
                        amountOwed.sources.some(source =>
                            source.documentHash === storedHashes.w2 && source.boxPath === boxPath),
                        `expected ${amountOwedRule} to cite the stored W-2's ${boxPath}: ${JSON.stringify(amountOwed.sources)}`)
                }
                // And the interest and dividend figures, each to its own form.
                const line2b = returnResult.lines.find(candidate => candidate.rule === '1040 line 2b')
                assert.ok(line2b.sources.some(source =>
                    source.documentHash === storedHashes.interest
                    && source.boxPath === 'box1InterestIncome'
                    && source.value === '2400.00'))
                const line3b = returnResult.lines.find(candidate => candidate.rule === '1040 line 3b')
                assert.ok(line3b.sources.some(source =>
                    source.documentHash === storedHashes.dividends
                    && source.boxPath === 'box1aTotalOrdinaryDividends'
                    && source.value === '3600.00'))

                // One step further back than any existing proof goes: the
                // 1099-DIV's own `sourceArtifactHash` resolves to the scan the
                // agent read the box off, and that scan states the same
                // figure. This is the artifact leg, and it exists for exactly
                // one of the three forms — see the seeding subtest.
                const dividendDocument = await bodyOf(storedHashes.dividends)
                assert.equal(dividendDocument.sourceArtifactHash, dividendArtifactHash)
                const artifact = JSON.parse(await casGetText(dividendDocument.sourceArtifactHash))
                assert.equal(artifact.dialect, ocrDialect)
                assert.equal(artifact.fields.box1a, '3600.00')
                assert.equal(artifact.fields.box1a, line3b.value)
            })

            await t.test('the break closes from the client side: a profile that states the empty array resolves all 144', async () => {
                // The remedy for the nine, and the reason they are reported as
                // a gap in the DOCUMENT rather than a defect in the engine's
                // traceability: the agent amends the profile to state
                // `dependents: []` explicitly — an ordinary `evo_add` onto the
                // existing subject, through the shipped tools — and reruns.
                // Nothing in `fjs/` changes.
                //
                // This leg is also the control for the previous one. An
                // assertion that nine citations do not resolve is a negative,
                // and a negative passes for a resolver that never ran; here
                // the SAME resolver, over a second run of the SAME program,
                // reports zero. If it reported zero in both places the check
                // would be vacuous, and it does not.
                const amendedProfile = {
                    dialect: returnProfileDialect,
                    taxYear: 2025,
                    filingStatus: 'single',
                    dependentCount: 0,
                    dependents: [],
                    declaredKinds: ['wages', 'taxableInterest', 'ordinaryDividends', 'federalTaxWithheldOnW2'],
                }
                assert.equal(validateReturnProfile(amendedProfile)[0], 'ok')
                const amendedProfileHash = await casAdd(JSON.stringify(amendedProfile))
                assert.notEqual(amendedProfileHash, storedHashes.profile)
                await evoAdd({
                    parents: [profileRevisionHash],
                    subject: subjectNames.profile,
                    snapshot: amendedProfileHash,
                })

                const rerunResponse = await call('fjs_run', { hash: programHash, taxYear: 2025 })
                assert.equal(rerunResponse.result.isError, undefined, `fjs_run failed: ${JSON.stringify(rerunResponse)}`)
                const rerun = JSON.parse(rerunResponse.result.content[0].text)
                const rerunResult = JSON.parse(await casGetText(rerun.resultHash))
                assert.equal(rerunResult.kind, 'ok')

                const rerunChain = await resolveCitations(rerunResult)
                assert.equal(rerunChain.sourceCount, 144)
                assert.deepEqual(rerunChain.absent, [])
                assert.deepEqual(rerunChain.mismatched, [])
                assert.equal(rerunChain.resolved, 144)
                assert.deepEqual(rerunChain.citedHashes, [
                    amendedProfileHash,
                    storedHashes.w2,
                    storedHashes.interest,
                    storedHashes.dividends,
                ].sort())

                // And the answer did not move: an empty array and an absent
                // one are the same taxpayer, so a remedy that changed the
                // amount owed would have been the wrong remedy.
                const centsAt = rule => centsFromString(
                    rerunResult.lines.find(candidate => candidate.rule === rule).value)
                assert.equal(centsAt(amountOwedRule), amountOwedCents)
                assert.equal(centsAt('1040 line 16 (Tax Table)'), 1213500n)
            })

            await t.test('the gap: the statutory figures are cited to a parameter set the surface cannot fetch', async () => {
                // Line 12e is $15,750.00 and its citation resolves — but to
                // `filingStatus: 'single'`, the input that SELECTED the
                // amount, not to the amount. Nothing in the store says
                // $15,750.00; it came from the parameter set.
                const deduction = returnResult.lines.find(candidate => candidate.rule === '1040 line 12e')
                assert.equal(centsFromString(deduction.value), 1575000n)
                assert.deepEqual(deduction.sources.map(source => source.boxPath), ['filingStatus'])
                assert.equal(deduction.sources[0].value, 'single')
                assert.equal(deduction.sources[0].documentHash, storedHashes.profile)

                // PROV-04's provenance header names where it DID come from,
                // by hash — and that hash is not in the store, so a client
                // holding the surface cannot fetch what it names.
                assert.ok(typeof run.paramSetHash === 'string' && run.paramSetHash !== '')
                const fetched = await call('cas_get', { hash: run.paramSetHash, content: true })
                assert.equal(fetched.result.isError, true,
                    'if the parameter set now resolves, this gap has closed and the report is out of date')
                assert.equal(fetched.result.content[0].text, `no such hash: ${run.paramSetHash}`)

                // The run record carries the same unresolvable hash, so this
                // is a property of the provenance record and not of one
                // response.
                const runRecord = JSON.parse(await casGetText(run.runHash))
                assert.equal(runRecord.status, 'ok')
                assert.equal(runRecord.dialect, 'vnd.fjs.run')
                assert.equal(runRecord.paramSetHash, run.paramSetHash)
                assert.equal(runRecord.resultHash, run.resultHash)
                assert.equal(runRecord.pinned, false)
                for (const key of ['profile', 'w2', 'interest', 'dividends']) {
                    assert.ok(
                        runRecord.inputs.some(input => input.command === 'evoHead' && input.payload[0] === subjectNames[key]),
                        `expected the run record to show ${subjectNames[key]} was enumerated`)
                    assert.ok(
                        runRecord.inputs.some(input => input.command === 'casRead' && input.payload[0] === storedHashes[key]),
                        `expected the run record to show ${subjectNames[key]}'s document was read`)
                }
            })

            await t.test('the gap: a wrong guess at the vocabulary ends the session rather than being refused', async () => {
                // A SEPARATE server process and a SEPARATE store, because the
                // finding is that this one dies. Running it against the
                // session above would take the rest of this test with it.
                const probeHome = mkdtempSync(join(tmpdir(), 'finance-conversational-probe-home-'))
                try {
                    probeServer = startServer(probeHome)
                    await probeServer.handshake()
                    const probeCasAdd = async content => {
                        const response = await probeServer.call('cas_add', { content, type: 'text' })
                        assert.ok(!response.result.isError, `cas_add failed: ${JSON.stringify(response)}`)
                        return response.result.content[0].text
                    }
                    // One real document, so the run is not refused earlier for
                    // reading nothing — the refusal the next leaf pins.
                    const probeDocument = {
                        dialect: oneZeroNineNineIntDialect,
                        payerTin: '33-3333333',
                        recipientTin: taxpayerSsn,
                        accountNumber: '40088001',
                        taxYear: 2025,
                        formRevision: '2025',
                        box1InterestIncome: '2400.00',
                    }
                    const probeDocumentHash = await probeCasAdd(JSON.stringify(probeDocument))
                    assert.equal(probeDocumentHash, expectedStoredHashes.interest,
                        'the same bytes must take the same address in a different store')
                    const probeEvo = await probeServer.call('evo_add', {
                        parents: [], subject: 'conversational-probe-interest', snapshot: probeDocumentHash,
                    })
                    assert.ok(!probeEvo.result.isError, `evo_add failed: ${JSON.stringify(probeEvo)}`)

                    const guessHash = await probeCasAdd(guessedVocabularyProgramSource)
                    // `fjs_check` passes it. That is not a bug in `fjs_check`
                    // — its description says it confirms a shape and has no
                    // security value — it is the reason the check cannot
                    // stand between an agent and the next line.
                    const checkResponse = await probeServer.call('fjs_check', { hash: guessHash })
                    assert.deepEqual(JSON.parse(checkResponse.result.content[0].text), { exportsReport: true })

                    const guessRun = await probeServer.call('fjs_run', { hash: guessHash, taxYear: 2025 })
                    // Not `isError: true` with a message the agent could read
                    // and correct. The process is gone.
                    assert.equal(guessRun.result, undefined,
                        `expected no tool result at all; the server was expected to die: ${JSON.stringify(guessRun)}`)
                    assert.deepEqual(guessRun.serverExited, { code: 1, signal: null })
                    assert.ok(guessRun.stderr.includes('TypeError: ctx.computeForm1040 is not a function'),
                        `expected the guest's own TypeError on stderr: ${guessRun.stderr.slice(0, 400)}`)
                    // The connection really is unusable afterwards, not merely
                    // slow: a subsequent call gets the same exit report.
                    const afterwards = await probeServer.call('cas_list', {})
                    assert.deepEqual(afterwards.serverExited, { code: 1, signal: null })
                } finally {
                    rmSync(probeHome, { recursive: true, force: true })
                }
            })

            await t.test('what the surface does refuse well: a program that computes without reading anything', async () => {
                // The counterweight to the leaf above, and the reason it is
                // stated as a gap in the guest ABI rather than as "guest
                // programs are unguarded". A program that reads NOTHING is
                // refused precisely, in the agent's own terms, with the run
                // record preserved — exactly the behaviour the crash above
                // does not get. `fjs_run` is fine here; the difference is
                // whether the failure is one `executeRun` can see coming.
                const blindHash = await casAdd([
                    'export const report = ctx => args => ctx.pure(JSON.stringify({ amountOwed: "6135.00" }))',
                    '',
                ].join('\n'))
                const blindRun = await call('fjs_run', { hash: blindHash, taxYear: 2025 })
                assert.equal(blindRun.result.isError, true)
                const message = blindRun.result.content[0].text
                assert.ok(message.includes('report produced zero observed reads over any stored document'),
                    `expected the zero-reads refusal: ${message}`)
                assert.ok(message.includes('run record: '), `expected a run record hash in the refusal: ${message}`)
                // The server is still answering. Stated against the previous
                // leaf's `serverExited`, so "refused" and "died" are told
                // apart by an assertion rather than by the reader.
                assert.equal(server.exitInfo(), null)
                const stillAlive = await call('cas_list', {})
                assert.ok(!stillAlive.result.isError, `expected the session to survive a refusal: ${JSON.stringify(stillAlive)}`)
            })
        } finally {
            if (server !== null) { server.stop() }
            if (probeServer !== null) { probeServer.stop() }
            rmSync(home, { recursive: true, force: true })
        }
    })
