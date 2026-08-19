// @ts-nocheck
//
// This file exists outside `tsc`'s type checking on purpose. Two independent
// reasons, both explained in full in `fjs/todo/upstream-node-spawn-effect.md`:
//
// 1. TypeScript cannot resolve `node:child_process` / `node:test` /
//    `node:assert` / `node:fs` / `node:os` / `node:path` / `node:url`
//    without `@types/node`, and AGENTS.md forbids adding any new dependency
//    — including a devDependency — without every repo owner's approval (a
//    hard stop). That approval is not being sought just to typecheck one
//    test harness.
// 2. `fjs/effects/node` has no subprocess-spawn effect, so a genuinely
//    separate-OS-process proof (what Success Criterion 5 explicitly demands
//    — "an in-process simulation does not test the thing that breaks")
//    cannot be written as a pure `.f.js` proof at all. This file is
//    therefore, like `index.js` and `all.test.js`, a root-level impure JS
//    file by necessity (AGENTS.md's carve-out for exactly this category).
//
// `@ts-nocheck` disables TYPE checking of this one file only — it adds
// nothing to `package.json`, and no other file in this repo carries it.
//
// Test flow (DOC-14 / Success Criterion 5): a real `node index.js <home>`
// server (one OS process) is started against a fresh CAS home; a real
// `fjs cas add` (a second, genuinely independent OS process, spawned from
// this repo's pinned `node_modules` copy — see `fjsCliPath`) writes a
// `vnd.fjs.revision` blob directly into that same store while the server is
// already running, bypassing the running server's `evo_add` entirely; the
// still-running server is told to `cas_refresh`, and its `evo_head` is shown
// to see the externally-written revision afterward — without ever restarting
// the server.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = fileURLToPath(new URL('.', import.meta.url))

// Same field values as `fjs/server/module.f.js`'s own `initializeRequest` /
// `initializedNotification` (mirrored here, not imported — they are
// module-private constants of a pure `.f.js` module), so this real client
// negotiates identically to that file's virtual-harness `proof.session`.
const requestedProtocolVersion = '2025-06-18'
const initializeRequest = {
    jsonrpc: '2.0',
    method: 'initialize',
    id: 1,
    params: {
        protocolVersion: requestedProtocolVersion,
        capabilities: {},
        clientInfo: { name: 'finance-proof-client', version: '0.0.1' },
    },
}
const initializedNotification = { jsonrpc: '2.0', method: 'notifications/initialized' }

/**
 * The FunctionalScript CLI as this repo pins it. Spawned by absolute path
 * into `node_modules/` rather than through `npx`, for two reasons — both
 * measured, not assumed:
 *
 * 1. **Provenance.** `functionalscript`'s `package.json` declares its bin as
 *    `fjs`, not `functionalscript`, so no `node_modules/.bin/functionalscript`
 *    link exists. `npx functionalscript` therefore could not resolve a local
 *    binary by name and fell through to npm's package-resolution path, which
 *    reaches the registry — the child leaked npm's own
 *    "New minor version of npm available!" notice, proving the network call.
 *    A test for a content-addressed store must exercise the version this repo
 *    depends on, not whatever a registry hands back. An absolute path into
 *    `node_modules/` makes that true by construction.
 * 2. **Wall clock.** That resolution cost 6.3s + 2.9s across this test's two
 *    invocations — 84% of an 11.0s run, against a 30s budget. It is why the
 *    test timed out under the full suite's parallel, process-isolated load
 *    while passing in isolation. By absolute path the same two calls cost
 *    2.8s + 1.0s, and the run halves to 5.9s.
 *
 * Nothing about the proof weakens: this is still a real `spawn` of a real,
 * genuinely separate OS process, and it produces a byte-identical content
 * hash (verified directly against the `npx` route before the change).
 */
const fjsCliPath = join(repoRoot, 'node_modules', 'functionalscript', 'fjs', 'module.js')

/**
 * Runs the pinned `fjs <args>` CLI to completion with `HOME` overridden to
 * `home` — a genuinely separate OS process, awaited here (it does not need
 * to overlap with the server) but otherwise the same real `spawn` this file
 * uses for the server itself. Verified end-to-end against this repo:
 * `os.homedir()` (`node_modules/functionalscript/fjs/effects/node/module.mjs:279`)
 * reads the `HOME` environment variable on POSIX, so this is the same store
 * the real server below is pointed at via its own `<home>` CLI argument
 * (`fjs/index.f.js`'s `options.args[0]`).
 */
const runFjsCli = (home, args) => new Promise((resolve, reject) => {
    const child = spawn('node', [fjsCliPath, ...args], {
        cwd: repoRoot,
        env: { ...process.env, HOME: home },
    })
    let stdout = ''
    let stderr = ''
    child.stdout.setEncoding('utf8')
    child.stdout.on('data', chunk => { stdout += chunk })
    child.stderr.setEncoding('utf8')
    child.stderr.on('data', chunk => { stderr += chunk })
    child.on('error', reject)
    child.on('close', code => {
        if (code !== 0) {
            reject(new Error(`fjs ${args.join(' ')} failed (code ${code}): ${stderr}`))
            return
        }
        resolve(stdout.trim())
    })
})

test(
    'DOC-14 Success Criterion 5: cas_refresh sees a revision written by a genuinely separate process, without a restart',
    { timeout: 30_000 },
    async () => {
        const home = mkdtempSync(join(tmpdir(), 'finance-cas-refresh-home-'))
        const scratchDir = mkdtempSync(join(tmpdir(), 'finance-cas-refresh-scratch-'))
        let serverProc = null
        try {
            // A >128 KiB fixture — the size the MCP stdio path's line cap
            // cannot carry, and the reason DOC-14's CLI route exists at all.
            const fixturePath = join(scratchDir, 'fixture.bin')
            writeFileSync(fixturePath, Buffer.alloc(140 * 1024, 'a'))

            // The >128 KiB CLI ingestion route (DOC-14's first half, already
            // exists upstream as the `fjs cas add` CLI — this test
            // exercises it, does not build it). Run once here, before the
            // server starts, purely so the resulting content hash is known
            // for the checks below: the raw blob it writes carries no
            // `dialect` tag, so `buildCache`/`initEvo` never fold it into
            // the Evo cache regardless of when it lands — only a
            // `vnd.fjs.revision` blob (written further down, while the
            // server is already running) does, which is what this test
            // actually proves.
            const artifactHash = await runFjsCli(home, ['cas', 'add', fixturePath])
            assert.ok(artifactHash.length > 0, 'expected a cBase32 hash on stdout from cas add')

            // The real server: a real second OS process, launched exactly
            // as `node index.js <home>` (fjs/index.f.js's `main`).
            serverProc = spawn('node', [join(repoRoot, 'index.js'), home], {
                cwd: repoRoot,
                stdio: ['pipe', 'pipe', 'pipe'],
            })

            let stdoutBuf = ''
            let stderrBuf = ''
            const responses = []
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

            const waitForResponses = async (count, timeoutMs = 15_000) => {
                const deadline = Date.now() + timeoutMs
                while (responses.length < count) {
                    if (Date.now() > deadline) {
                        throw new Error(`timed out waiting for ${count} response(s); got ${responses.length} so far (stderr: ${stderrBuf})`)
                    }
                    await new Promise(resolve => setTimeout(resolve, 25))
                }
            }

            const evoHeadRequest = id => ({
                jsonrpc: '2.0',
                method: 'tools/call',
                id,
                params: { name: 'evo_head', arguments: { subject: artifactHash } },
            })

            // initialize -> notifications/initialized -> tools/call
            // evo_head, against the real running server. Before any
            // revision exists in the store, evo_head must answer empty —
            // this is the BEFORE half of the before/after proof.
            const batch1 = [initializeRequest, initializedNotification, evoHeadRequest(2)]
            serverProc.stdin.write(batch1.map(m => JSON.stringify(m)).join('\n') + '\n')
            await waitForResponses(2) // the notification gets no response; initialize + evo_head do
            const [initResponse, beforeHeadResponse] = responses
            assert.ok(!('error' in initResponse), `initialize failed: ${JSON.stringify(initResponse)}`)
            assert.ok(!('error' in beforeHeadResponse), `evo_head (before) failed: ${JSON.stringify(beforeHeadResponse)}`)
            assert.equal(
                beforeHeadResponse.result.content[0].text,
                '',
                'evo_head must be empty before any revision exists for this subject',
            )

            // A `vnd.fjs.revision` blob, written directly into the SAME
            // store by a genuinely separate `fjs cas add`
            // process — bypassing the running server's evo_add entirely.
            // This is the exact scenario DOC-14's refresh path exists for.
            const revisionText = JSON.stringify({
                dialect: 'vnd.fjs.revision',
                subject: artifactHash,
                parents: [],
                snapshot: artifactHash,
                generation: 0,
            })
            const revisionPath = join(scratchDir, 'revision.json')
            writeFileSync(revisionPath, revisionText)
            const revisionHash = await runFjsCli(home, ['cas', 'add', revisionPath])
            assert.ok(revisionHash.length > 0, 'expected a cBase32 hash on stdout from cas add')

            // On the STILL-RUNNING server: cas_refresh, then evo_head again
            // for the same subject — the AFTER half of the before/after
            // proof.
            const batch2 = [
                { jsonrpc: '2.0', method: 'tools/call', id: 3, params: { name: 'cas_refresh', arguments: {} } },
                evoHeadRequest(4),
            ]
            serverProc.stdin.write(batch2.map(m => JSON.stringify(m)).join('\n') + '\n')
            await waitForResponses(4)
            const [, , refreshResponse, afterHeadResponse] = responses
            assert.ok(!('error' in refreshResponse), `cas_refresh failed: ${JSON.stringify(refreshResponse)}`)
            // DOC-16: detectFinance is reachable from a genuinely separate
            // real process's tools/call, over content written by ANOTHER
            // genuinely separate real process (fjs cas add) -- the exact
            // scenario this file already exists to prove for cas_refresh
            // itself, extended here to the dialect registry it now also
            // exercises.
            const refreshBody = JSON.parse(refreshResponse.result.content[0].text)
            assert.ok(
                refreshBody.dialectCounts['application/vnd.fjs.revision+json'] >= 1,
                `expected cas_refresh's dialectCounts to include the externally-written vnd.fjs.revision blob: ${JSON.stringify(refreshBody)}`,
            )
            assert.ok(!('error' in afterHeadResponse), `evo_head (after) failed: ${JSON.stringify(afterHeadResponse)}`)
            assert.equal(
                afterHeadResponse.result.content[0].text,
                revisionHash,
                'evo_head must see the externally-written revision after cas_refresh, without a server restart',
            )

            // Clean EOF shutdown — the established real-process pattern
            // (see .planning/phases/02-.../02-01-PLAN.md's
            // `echo -n | node index.js "$(mktemp -d)"` precedent).
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
            // Never leave a stray process or tmp dir behind, even on
            // failure/timeout.
            if (serverProc !== null && serverProc.exitCode === null) {
                serverProc.kill()
            }
            rmSync(home, { recursive: true, force: true })
            rmSync(scratchDir, { recursive: true, force: true })
        }
    },
)
