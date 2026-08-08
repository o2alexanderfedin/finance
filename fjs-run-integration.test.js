// @ts-nocheck
//
// This file exists outside `tsc`'s type checking on purpose. Two independent
// reasons, both explained in full in `fjs/todo/upstream-node-spawn-effect.md`
// and already applied to `cas-refresh-cross-process.test.js`:
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
//    `cas-refresh-cross-process.test.js`, a root-level impure JS file by
//    necessity (AGENTS.md's carve-out for exactly this category).
//
// `@ts-nocheck` disables TYPE checking of this one file only — it adds
// nothing to `package.json`, and no other file in this repo carries it
// besides `cas-refresh-cross-process.test.js`.
//
// ## Why this test exists (07-09-PLAN.md)
//
// Every existing proof of `fjs_run` — including 07-08's own
// `proof.weekOneConvergence`, despite being titled "end to end" — runs under
// `fjs/effects/node/virtual`: a mocked filesystem, mocked stdio, no separate
// OS process, and a `JsModule` fixture standing in for "materialization
// already happened" because `virtual`'s `writeFile` (an array of `Vec`
// chunks) and its `import_` (which requires a `JsModule` function) are
// representationally incompatible (`fjs/guest/materialize/module.f.js`'s own
// header) — write-then-import cannot be composed in one virtual session at
// all. This test proves that exact seam for real: a genuinely separate
// `node index.js <home>` process, driven over real stdin/stdout, writes a
// program's bytes to a real file via a real MCP `fjs_run` call and then
// really `import()`s it — the one assertion (`existsSync` on the
// materialized `.mjs`) no virtual proof can make.
//
// It also derives full tool coverage (TEST-02) at runtime from the server's
// own `tools/list` response, and proves MCP-05's stdout-is-always-JSON-RPC
// invariant against a real process for the first time (previously only
// asserted under `virtual`).

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtempSync, existsSync, rmSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

// Reused for real, not re-implemented: the same money/dialect/materialize
// helpers 07-08's virtual proof and Plan 05's own proof use, so this test's
// seeding and expected-sum derivation stay consistent with them. None of
// these three imports are a new dependency — `functionalscript` is already
// this repo's one runtime dependency, and the other two are this repo's own
// `.f.js` modules.
import { centsFromString, centsToString } from './fjs/exact/module.f.js'
import { dialect as oneZeroNineNineIntDialect, validate as validateOneZeroNineNineInt } from './fjs/document/1099int/module.f.js'
import { dialect as revisionDialect } from 'functionalscript/fjs/media/revision/module.f.js'
import { materializeHome, programPath } from './fjs/guest/materialize/module.f.js'

const repoRoot = fileURLToPath(new URL('.', import.meta.url))

// Same field values as `fjs/server/module.f.js`'s own `initializeRequest` /
// `initializedNotification` (mirrored here, not imported — module-private
// constants of a pure `.f.js` module), so this real client negotiates
// identically to that file's virtual-harness sessions.
const requestedProtocolVersion = '2025-06-18'
const initializeRequest = id => ({
    jsonrpc: '2.0',
    method: 'initialize',
    id,
    params: {
        protocolVersion: requestedProtocolVersion,
        capabilities: {},
        clientInfo: { name: 'finance-integration-client', version: '0.0.1' },
    },
})
const initializedNotification = { jsonrpc: '2.0', method: 'notifications/initialized' }

/**
 * A guest report program's REAL source text — zero imports (so
 * `checkSpecifiers` passes), written against nothing but `ctx`
 * (`fjs/guest/module.f.js`'s frozen ABI). Enumerates every active subject,
 * resolves each one's head -> revision -> snapshot, and sums every PRESENT
 * `box1InterestIncome`, skipping — never coercing to zero — a document where
 * the key is absent. Mirrors 07-08's `sumInterestReport`/
 * `sumInterestOverSubjects` exactly, as literal source text rather than a
 * `JsModule` fixture, because THIS run really writes these bytes to disk and
 * really `import()`s them.
 */
const programSource = [
    'export const report = ctx => args => ctx.step(ctx.evoList(\'false\'), activeJson => {',
    '    const sumOverSubjects = subjects => acc => {',
    '        const subject = subjects[0]',
    '        if (subject === undefined) {',
    '            return ctx.pure(ctx.centsToString(acc))',
    '        }',
    '        const rest = subjects.slice(1)',
    '        return ctx.step(ctx.evoHead(subject), headsJson => {',
    '            const heads = JSON.parse(headsJson)',
    '            const headHash = heads[0]',
    '            return ctx.step(ctx.evoRevision(headHash), revJson => {',
    '                const rev = JSON.parse(revJson)',
    '                return ctx.step(ctx.casRead(rev.snapshot), docJson => {',
    '                    const doc = JSON.parse(docJson)',
    '                    const next = doc.box1InterestIncome === undefined',
    '                        ? acc',
    '                        : acc + ctx.centsFromString(doc.box1InterestIncome)',
    '                    return sumOverSubjects(rest)(next)',
    '                })',
    '            })',
    '        })',
    '    }',
    '    return sumOverSubjects(JSON.parse(activeJson))(0n)',
    '})',
    '',
].join('\n')

test(
    'TEST-01/TEST-02: fjs_run end to end through a real separate node index.js process and a real filesystem, with full tool coverage',
    { timeout: 60_000 },
    async () => {
        // T-07-09-03: a fresh CAS home under os.tmpdir(), never the repo tree.
        const home = mkdtempSync(join(tmpdir(), 'finance-fjs-run-integration-home-'))
        let serverProc = null
        try {
            // No special working directory is required (07-10): `executeRun`
            // (fjs/server/fjs_run/module.f.js) now imports from the FULL
            // `programPath(materializeHome(materializeHomeRoot))(hash)` path
            // — the SAME path `materializeProgram` itself just wrote,
            // composed from the SAME expressions so the two can never drift
            // apart. Real Node's `import_` effect only resolves a specifier
            // against `process.cwd()` when the specifier is bare/relative
            // (`node_modules/functionalscript/fjs/effects/node/module.js`'s
            // `asyncImport`: `concat(process.cwd())(v)` only for a specifier
            // that is neither absolute nor a URL); an absolute path is used
            // as-is regardless of the launcher's own cwd. The server below
            // is therefore spawned from this test file's own ordinary
            // working directory — never a bespoke `cwd` — which is the
            // decisive proof that production's real launcher (`claude mcp
            // add`, or any other invocation) needs no special working
            // directory either.

            // The real server: a genuinely separate OS process, launched
            // exactly as `node index.js <home>` (fjs/index.f.js's `main`),
            // with no special working directory.
            serverProc = spawn('node', [join(repoRoot, 'index.js'), home], {
                stdio: ['pipe', 'pipe', 'pipe'],
            })

            const responses = []
            const rawStdoutLines = []
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
                        rawStdoutLines.push(line)
                        responses.push(JSON.parse(line))
                    }
                }
            })
            serverProc.stderr.setEncoding('utf8')
            serverProc.stderr.on('data', chunk => { stderrBuf += chunk })

            let nextIdCounter = 0
            const nextId = () => { nextIdCounter += 1; return nextIdCounter }
            const send = message => { serverProc.stdin.write(JSON.stringify(message) + '\n') }

            // T-07-09-02: readiness is proven by matching the response's own
            // JSON-RPC `id`, never by a sleep. The `setTimeout` below is a
            // polling DELAY between checks of that condition — it is never
            // itself the readiness signal, and a dead process (no response,
            // ever) fails this explicitly via the deadline below rather than
            // hanging or silently "passing early".
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

            const toolsCalled = new Set()
            const call = async (name, args) => {
                const id = nextId()
                send({ jsonrpc: '2.0', method: 'tools/call', id, params: { name, arguments: args } })
                toolsCalled.add(name)
                return waitForId(id)
            }

            // ── initialize -> notifications/initialized ──────────────────
            const initId = nextId()
            send(initializeRequest(initId))
            send(initializedNotification)
            const initResponse = await waitForId(initId)
            assert.ok(!('error' in initResponse), `initialize failed: ${JSON.stringify(initResponse)}`)
            assert.equal(initResponse.result.serverInfo.name, 'finance-mcp')
            // The advertised version must be the released one. `financeConfig`
            // carries it as a LITERAL — it is a pure module with no filesystem
            // to read the manifest from — so this is the only place the two can
            // be compared, and without it a release that bumps `package.json`
            // and forgets the server would ship a wrong version silently.
            assert.equal(
                initResponse.result.serverInfo.version,
                JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')).version,
                'MCP serverInfo.version must equal package.json version — bump both together')

            // ── tools/list, read at runtime (TEST-02) — never a hardcoded
            // array, so a tool added later without integration coverage
            // fails THIS test rather than passing unnoticed ──────────────
            const listId = nextId()
            send({ jsonrpc: '2.0', method: 'tools/list', id: listId })
            const listResponse = await waitForId(listId)
            assert.ok(!('error' in listResponse), `tools/list failed: ${JSON.stringify(listResponse)}`)
            const advertisedTools = new Set(listResponse.result.tools.map(t => t.name))
            assert.ok(advertisedTools.size > 0, 'expected at least one advertised tool')

            // ── Seed three vnd.fjs.1099int documents through the REAL
            // cas_add tool, over the real session, against the real
            // filesystem — the difference from 07-08's virtual seed, whose
            // store is a virtual root, not a real directory. One deliberately
            // OMITS box1InterestIncome entirely (never '0.00') ──────────────
            const docCommon = {
                dialect: oneZeroNineNineIntDialect,
                payerTin: '11-1111111',
                recipientTin: '222-22-2222',
                taxYear: 2024,
                formRevision: '2024',
            }
            const docWithInterest = { ...docCommon, accountNumber: 'ACC-0001', box1InterestIncome: '1234.56' }
            const docWithSmallerInterest = { ...docCommon, accountNumber: 'ACC-0002', box1InterestIncome: '10.00' }
            const docWithAbsentInterest = { ...docCommon, accountNumber: 'ACC-0003' }
            for (const doc of [docWithInterest, docWithSmallerInterest, docWithAbsentInterest]) {
                const [vt, vv] = validateOneZeroNineNineInt(doc)
                assert.equal(vt, 'ok', `expected the seeded 1099-INT to validate: ${JSON.stringify(vv)}`)
            }

            const casAdd = async content => {
                const response = await call('cas_add', { content, type: 'text' })
                assert.ok(!response.result.isError, `cas_add failed: ${JSON.stringify(response)}`)
                return response.result.content[0].text
            }

            const docAHash = await casAdd(JSON.stringify(docWithInterest))
            const docBHash = await casAdd(JSON.stringify(docWithSmallerInterest))
            const docCHash = await casAdd(JSON.stringify(docWithAbsentInterest))

            // Revisions written directly as raw vnd.fjs.revision blobs via
            // cas_add (bypassing evo_add, mirroring 07-08/casRefresh's own
            // technique) — cas_add's own handler folds a recognized revision
            // blob into the live Evo cache via syncRevision as it is
            // written, so these are visible to evo_head/evo_list without a
            // restart or an explicit cas_refresh.
            const subjectA = 'finance-integration-subject-A'
            const subjectB = 'finance-integration-subject-B'
            const subjectC = 'finance-integration-subject-C'
            const revisionText = (subject, snapshot) => JSON.stringify({
                dialect: revisionDialect,
                subject,
                parents: [],
                snapshot,
                generation: 0,
            })
            const revAHash = await casAdd(revisionText(subjectA, docAHash))
            const revBHash = await casAdd(revisionText(subjectB, docBHash))
            await casAdd(revisionText(subjectC, docCHash))

            // The program's real source, written for real via cas_add.
            const programHash = await casAdd(programSource)

            // An agent reads the dialect's own field names before authoring
            // a program against them — MCP-06's whole purpose.
            const schemaResponse = await call('finance_schema', { dialect: 'vnd.fjs.1099int' })
            assert.ok(!schemaResponse.result.isError, `finance_schema failed: ${JSON.stringify(schemaResponse)}`)
            assert.ok(
                schemaResponse.result.content[0].text.includes('box1InterestIncome'),
                'expected the schema response to name box1InterestIncome')

            // MCP-07: an agent reads TY2025's parameters through a real tool
            // call rather than recalling them — the decisive reachability
            // proof 08-VALIDATION.md (T-08-04) requires alongside the
            // financeMcpHandlers registry entry, in this SAME real session.
            const taxParamsResponse = await call('finance_tax_params', { year: 2025 })
            assert.ok(!taxParamsResponse.result.isError, `finance_tax_params failed: ${JSON.stringify(taxParamsResponse)}`)
            assert.ok(
                taxParamsResponse.result.content[0].text.includes('31500.00'),
                'expected the finance_tax_params response to name the MFJ standard deduction amount')
            assert.ok(
                taxParamsResponse.result.content[0].text.includes('2025-32'),
                'expected the finance_tax_params response to name its own Rev. Proc. citation')

            // MCP-08: an agent enumerates stored documents through a real
            // tool call, over this SAME real session, against the three
            // subjects/revisions already seeded above (subjectA/B/C) — the
            // decisive reachability proof this SAME-commit ordering
            // constraint exists to require alongside the financeMcpHandlers
            // registry entry (see fjs/server/module.f.js).
            const documentsListResponse = await call('finance_documents_list', {})
            assert.ok(
                !documentsListResponse.result.isError,
                `finance_documents_list failed: ${JSON.stringify(documentsListResponse)}`)
            const documentsListed = JSON.parse(documentsListResponse.result.content[0].text)
            assert.ok(Array.isArray(documentsListed), 'expected finance_documents_list to answer a JSON array')
            assert.ok(
                documentsListed.some(entry => entry.subject === subjectA || entry.subject === subjectB || entry.subject === subjectC),
                `expected finance_documents_list to include one of the already-seeded subjects: ${JSON.stringify(documentsListed)}`)

            // ── The decisive call: fjs_run through the real, separate
            // process — a real write-then-import of the materialized
            // program, something no virtual proof can do ──────────────────
            const runResponse = await call('fjs_run', { hash: programHash })
            assert.equal(runResponse.result.isError, undefined, `fjs_run failed: ${JSON.stringify(runResponse)}`)
            const parsed = JSON.parse(runResponse.result.content[0].text)
            assert.ok(typeof parsed.resultHash === 'string' && parsed.resultHash !== '', 'expected a resultHash')
            assert.ok(typeof parsed.runHash === 'string' && parsed.runHash !== '', 'expected a runHash')
            // PROV-07 (09-CONTEXT.md): the read count and numeric-literal
            // count surface beside the two hashes. This run's own program
            // dispatches evoList plus, per seeded subject, evoHead/
            // evoRevision/casRead — several observed reads; its own stored
            // source text contains at least the `0n` accumulator literal.
            assert.ok(typeof parsed.readCount === 'number' && parsed.readCount > 0, 'expected a positive readCount')
            assert.ok(typeof parsed.literalCount === 'number' && parsed.literalCount >= 1, 'expected literalCount to be at least 1')

            // The expected total, computed INDEPENDENTLY here from the two
            // PRESENT seeded values via centsFromString/centsToString —
            // never a bare literal.
            const expectedTotal = centsToString(centsFromString('1234.56') + centsFromString('10.00'))

            const resultGet = await call('cas_get', { hash: parsed.resultHash, content: true })
            assert.ok(!resultGet.result.isError, `cas_get(resultHash) failed: ${JSON.stringify(resultGet)}`)
            const resultMeta = JSON.parse(resultGet.result.content[0].text)
            assert.equal(resultMeta.text, expectedTotal)

            const runGet = await call('cas_get', { hash: parsed.runHash, content: true })
            assert.ok(!runGet.result.isError, `cas_get(runHash) failed: ${JSON.stringify(runGet)}`)
            const runMeta = JSON.parse(runGet.result.content[0].text)
            const runRecord = JSON.parse(runMeta.text)
            assert.equal(runRecord.status, 'ok')
            // The absent-field document's subject IS enumerated — its
            // evoHead read appears in the PERSISTED record — proving the
            // program actively visited and skipped it, not that this test
            // simply never presented it.
            assert.ok(
                runRecord.inputs.some(i => i.command === 'evoHead' && i.payload[0] === subjectC),
                'expected subjectC (the absent-field document) to have been enumerated')

            // ── 09-07: the pin path through the SHIPPED fjs_run tool,
            // against a real separate process — the assertion that fails
            // when `...pinFields` is dropped from fjsRunTool's own
            // `executeRun(...)` call (E2). No virtual proof can make this
            // assertion at all: `fjsRunTool.handle` cannot reach an 'ok'
            // outcome under `fjs/effects/node/virtual` in a single call
            // (the write/import split `fjs/server/fjs_run/module.f.js`'s
            // own header documents), so every virtual-level pin proof in
            // that file drives `runExecuteRunViaFixture` — a decomposed
            // replay of `executeRun`'s OWN steps — directly, bypassing
            // `fjsRunTool.handle` entirely. This is the one place the gap
            // can be closed for real: a genuinely separate process has no
            // such limitation ──────────────────────────────────────────
            const pinSubject = 'finance-integration-pin-subject'
            const pinLiveRevResponse = await call('evo_add', {
                parents: [],
                subject: pinSubject,
                snapshot: docAHash,
            })
            assert.ok(
                !pinLiveRevResponse.result.isError,
                `evo_add (pin setup) failed: ${JSON.stringify(pinLiveRevResponse)}`)
            const pinLiveRevHash = pinLiveRevResponse.result.content[0].text

            // A program that reads exactly one subject's head — the SAME
            // shape `fjs/server/fjs_run/module.f.js`'s own
            // `pinOverridesTheLiveHeadThroughFullExecuteRun` proof uses at
            // the decomposed-fixture layer, written here as real source
            // text a real process really writes and really imports.
            const pinProgramSource = 'export const report = ctx => args => ctx.evoHead(args[0])'
            const pinProgramHash = await casAdd(pinProgramSource)

            const pinnedParents = ['PINNED-INSTEAD-OF-LIVE-HEAD']
            const pinRunResponse = await call('fjs_run', {
                hash: pinProgramHash,
                args: [pinSubject],
                subject: pinSubject,
                parents: pinnedParents,
            })
            assert.equal(
                pinRunResponse.result.isError, undefined,
                `pinned fjs_run failed: ${JSON.stringify(pinRunResponse)}`)
            const pinParsed = JSON.parse(pinRunResponse.result.content[0].text)

            const pinResultGet = await call('cas_get', { hash: pinParsed.resultHash, content: true })
            assert.ok(!pinResultGet.result.isError, `cas_get(pin resultHash) failed: ${JSON.stringify(pinResultGet)}`)
            const pinResultMeta = JSON.parse(pinResultGet.result.content[0].text)
            // The decisive assertion: the run's OWN result reflects the
            // PINNED parents just supplied, never the live head `evo_add`
            // established a moment ago. If `...pinFields` is ever dropped
            // from `fjsRunTool`'s own `executeRun(...)` call, `executeRun`
            // sees no pin at all and resolves the subject's LIVE head
            // instead — this assertion is what catches that.
            assert.equal(pinResultMeta.text, JSON.stringify(pinnedParents))
            assert.notEqual(pinResultMeta.text, JSON.stringify([pinLiveRevHash]))

            // The persisted run record itself claims the pin it actually
            // applied — the same fields E1/E11's mutations would silently
            // misreport (PROV-03: a record cannot lie about what ran).
            const pinRunGet = await call('cas_get', { hash: pinParsed.runHash, content: true })
            assert.ok(!pinRunGet.result.isError, `cas_get(pin runHash) failed: ${JSON.stringify(pinRunGet)}`)
            const pinRunRecord = JSON.parse(JSON.parse(pinRunGet.result.content[0].text).text)
            assert.equal(pinRunRecord.pinned, true)
            assert.equal(pinRunRecord.subject, pinSubject)
            assert.deepEqual(pinRunRecord.parents, pinnedParents)

            // ── 09-05: the zero-read adversary through the REAL server —
            // the exact verbatim ROADMAP adversary, `() => pure({ line16:
            // 9137 })`, stored for real via THIS SAME live session's cas_add
            // and run through THIS SAME session's fjs_run call. Every other
            // proof of this gate (fjs/server/fjs_run/module.f.js's
            // antiHardcodingGate/zeroReadGate proofs) drives the adversary
            // only under fjs/effects/node/virtual, through
            // runExecuteRunViaFixture — a test-only helper that shares the
            // gate (classifyRunOutcome, 09-05) with the production
            // `executeRun` fjsRunTool actually calls, but has still never,
            // until now, been run against a genuinely separate process. This
            // is the assertion no virtual proof can make: the adversary is
            // refused by the actual shipped code path, in a real process,
            // against a real filesystem ──────────────────────────────────
            const adversarySource = 'export const report = ctx => () => ctx.pure({ line16: 9137 })'
            const adversaryHash = await casAdd(adversarySource)
            const adversaryRunResponse = await call('fjs_run', { hash: adversaryHash })
            assert.equal(
                adversaryRunResponse.result.isError, true,
                `expected the zero-read adversary to be refused: ${JSON.stringify(adversaryRunResponse)}`)
            const adversaryText = adversaryRunResponse.result.content[0].text
            assert.ok(
                adversaryText.includes('zero observed reads'),
                `expected the refusal to name the zero-read condition: ${adversaryText}`)

            // EXEC-12 session survival, proven for the refused call, not
            // merely the successful one above: the SAME live process still
            // answers a FOLLOWING request rather than dying or dropping the
            // connection.
            const survivesAdversaryResponse = await call('cas_list', {})
            assert.ok(
                !survivesAdversaryResponse.result.isError,
                `cas_list after the refused adversary call failed: ${JSON.stringify(survivesAdversaryResponse)}`)

            // ── The one assertion no virtual proof can make: the
            // materialized program .mjs exists on the REAL filesystem,
            // because a real separate process really wrote it and really
            // imported it ────────────────────────────────────────────────
            const materializedPath = programPath(materializeHome(home))(programHash)
            assert.ok(
                existsSync(materializedPath),
                `expected the materialized program to exist at ${materializedPath}`)

            // ── Full tool coverage (TEST-02): every remaining advertised
            // tool reached at least once in this SAME real session ────────
            const evoListResponse = await call('evo_list', {})
            assert.ok(!evoListResponse.result.isError, `evo_list failed: ${JSON.stringify(evoListResponse)}`)

            const evoHeadResponse = await call('evo_head', { subject: subjectA })
            assert.ok(!evoHeadResponse.result.isError, `evo_head failed: ${JSON.stringify(evoHeadResponse)}`)

            const evoRevisionResponse = await call('evo_revision', { hash: revAHash })
            assert.ok(!evoRevisionResponse.result.isError, `evo_revision failed: ${JSON.stringify(evoRevisionResponse)}`)
            void revBHash

            const casListResponse = await call('cas_list', {})
            assert.ok(!casListResponse.result.isError, `cas_list failed: ${JSON.stringify(casListResponse)}`)

            // A distinct evo_add call (not cas_add's own auto-sync path),
            // pointed at an already-stored snapshot so it needs no separate
            // seed write of its own. Runs AFTER the decisive fjs_run call
            // above, so the new subject it creates never perturbs that
            // call's already-made assertions.
            const evoAddResponse = await call('evo_add', {
                parents: [],
                subject: 'finance-integration-coverage-subject',
                snapshot: docAHash,
            })
            assert.ok(!evoAddResponse.result.isError, `evo_add failed: ${JSON.stringify(evoAddResponse)}`)

            const casRefreshResponse = await call('cas_refresh', {})
            assert.ok(!casRefreshResponse.result.isError, `cas_refresh failed: ${JSON.stringify(casRefreshResponse)}`)

            // The self-enforcing check (TEST-02): the set of tools actually
            // called must equal the set tools/list advertised. A tool added
            // in a later phase without integration coverage fails HERE,
            // rather than passing unnoticed.
            assert.equal(
                [...toolsCalled].sort().join(','),
                [...advertisedTools].sort().join(','),
                `expected every advertised tool to be called at least once: ` +
                `called=[${[...toolsCalled].sort()}] advertised=[${[...advertisedTools].sort()}]`)

            // MCP-05's invariant, proven against a real process for the
            // first time (previously only asserted under virtual): every
            // line the server wrote to stdout, across the WHOLE session,
            // parses as JSON-RPC. Each line was already JSON.parsed as it
            // arrived (the `serverProc.stdout.on('data', ...)` handler
            // above) — a parse failure there would already have thrown and
            // failed this test — so this re-checks explicitly, by line,
            // naming the offending line rather than surfacing only as an
            // opaque parse crash mid-session.
            assert.ok(rawStdoutLines.length > 0, 'expected at least one stdout line')
            for (const line of rawStdoutLines) {
                assert.doesNotThrow(
                    () => JSON.parse(line),
                    `expected every stdout line to parse as JSON-RPC, got: ${line}`)
            }

            // Clean EOF shutdown — the established real-process pattern
            // (see cas-refresh-cross-process.test.js).
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
            // T-07-09-04: never leave a stray process or tmp dir behind,
            // even on failure/timeout.
            if (serverProc !== null && serverProc.exitCode === null) {
                serverProc.kill()
            }
            rmSync(home, { recursive: true, force: true })
        }
    },
)
