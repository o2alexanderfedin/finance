// @ts-nocheck
//
// A file bigger than one `Vec` arrives whole from `fjs web`.
//
// ## Why this test exists at all
//
// `fjs web` used to answer `413` to any file over **131072** bytes — one
// `Vec` — and eleven of the modules the showcase page imports are over that.
// That is what blocked MAINT-11's one remaining item for four milestones; it
// was filed upstream as `functionalscript#1819` and the local record was
// `fjs/todo/upstream-web-vec-size-limit.md`. `functionalscript@0.52.0` made the
// response body a lazy list of chunks, and the ceiling went away.
//
// **This file is that note's own reproduction, kept running.** The convention
// in this repository is to delete an `upstream-*.md` note once its
// reproduction passes, and the cost of that convention is that the
// reproduction stops being run. A one-line `curl` in a deleted file proves
// nothing next month. So the measurement moved here instead of being thrown
// away with the note: the engine's largest module is requested over a real
// socket and compared, byte for byte, against the bytes on disk.
//
// **It is not the reason `demo/serve.sh` still runs `python3 -m http.server`.**
// Serving that page through `fjs web` is 26 times slower, and a reload is 120
// times slower because nothing can be revalidated; the figures and the
// mechanism are in `fjs/todo/upstream-web-vec-throughput.md` and in
// `demo/serve.sh`'s own comment. Size and speed are different questions, and
// this test answers only the first one.
//
// ## Why it is a root-level plain-JS test
//
// AGENTS.md admits three reasons a `*.test.js` may sit here instead of being a
// `.f.js` proof. This is the second — **it spawns a real process** — and it
// needs one alive across several round trips, which upstream's one-shot `Exec`
// structurally cannot express (`fjs/todo/upstream-node-spawn-effect.md` →
// `functionalscript#1649`). Driving `respond` under
// `fjs/effects/node/virtual` would prove upstream's own module against
// upstream's own in-memory file system, which upstream already does. What
// cannot be proven that way is that the bytes survive a socket.
//
// `@ts-nocheck` disables type checking of this one file, exactly as
// `cas-refresh-cross-process.test.js` and `fjs-run-integration.test.js` do and
// for the same reason: `node:*` specifiers need `@types/node`, and AGENTS.md
// puts any new dependency behind every owner's approval.

import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createServer } from 'node:net'
import { request as httpRequest } from 'node:http'
import { readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = fileURLToPath(new URL('.', import.meta.url))

/**
 * The ceiling `fjs web` used to answer `413` above, hand-typed.
 *
 * NOT imported from `functionalscript/fjs/types/bit_vec`. The number is this
 * test's claim about the dependency, and a claim read out of the dependency is
 * the dependency agreeing with itself. If upstream's `Vec` ever changes size,
 * this literal is what makes the disagreement visible instead of invisible.
 */
const oldCeilingBytes = 131072

/**
 * The largest module the showcase page imports, named rather than searched for.
 *
 * Deriving "the largest `.f.js` in the tree" would make the subject a function
 * of the tree being tested — the shape AGENTS.md records having been bitten by
 * four times. Naming it means a day when nothing in `fjs/**` is over the
 * ceiling any more is reported by the first assertion rather than silently
 * turning this leaf into a test of a small file.
 */
const largeModule = 'fjs/form1040/core/module.f.js'

/** A file well under the old ceiling, for the control leaf. */
const smallFile = 'demo/entry.html'

/** A port the kernel says is free, so two agents' runs do not collide. */
const freePort = () => new Promise((resolve, reject) => {
    const probe = createServer()
    probe.on('error', reject)
    probe.listen(0, '127.0.0.1', () => {
        const { port } = probe.address()
        probe.close(() => resolve(port))
    })
})

/**
 * How long one request may take before it is called a failure.
 *
 * The large module is about a megabyte over the loopback interface, which takes
 * about a second here, so thirty is far more room than a working server needs
 * and still a bound. The leaves below are given a longer limit than this, on
 * purpose: whichever clock runs out first writes the failure message, and this
 * one knows the path and carries the server's own output.
 */
const requestTimeoutMs = 30_000

/** The same bound for the start-up probe, short because a refusal is instant. */
const probeTimeoutMs = 2_000

/** How long the server gets to come up before the hook gives up. */
const startupTimeoutMs = 20_000

/**
 * One request, with keep-alive off and a deadline.
 *
 * `agent: false` gives every call its own socket and closes it when the
 * response ends. A pooled socket would outlive the last assertion and hold the
 * process open, which reads as a hang rather than as a pass.
 *
 * THE DEADLINE IS NOT A CONVENIENCE. An error on the socket settles this
 * promise, but a server that accepts the connection and then stops writing
 * produces no error at all: the response never ends, the promise stays pending,
 * and the open handles keep the test process alive. `node --test` sets no
 * timeout of its own, so without the timer below that case gives no failing
 * test and no output — the run sits there until something outside it loses
 * patience. A half-sent body is the exact shape of breakage this file exists to
 * notice, since `fjs web` answers from a lazy list of chunks, so the one failure
 * mode most worth reporting was the one that could not be reported.
 *
 * `req.destroy(error)` is what turns it into a report: it emits `'error'` with
 * that error, so the handler below is the single place a failure leaves here.
 */
const fetchPath = (port, path, timeoutMs) => new Promise((resolve, reject) => {
    let timer = null
    // Clearing matters as much as setting: a live timer is an open handle, and
    // one left behind would hold the process for `timeoutMs` after the last
    // assertion passed.
    const fail = e => {
        clearTimeout(timer)
        reject(e)
    }
    const req = httpRequest({ host: '127.0.0.1', port, path, method: 'GET', agent: false }, res => {
        const chunks = []
        res.on('data', chunk => chunks.push(chunk))
        // Destroying the request mid-body makes the response emit too. Without
        // this listener that would be an unhandled `'error'`, which ends the
        // whole process instead of failing one leaf.
        res.on('error', fail)
        res.on('end', () => {
            clearTimeout(timer)
            resolve({
                status: res.statusCode,
                headers: res.headers,
                body: Buffer.concat(chunks),
            })
        })
    })
    req.on('error', fail)
    timer = setTimeout(
        () => req.destroy(new Error(
            `no complete response for ${path} within ${timeoutMs} ms — the connection was `
            + `accepted and the body never ended\n${served.said}`)),
        timeoutMs)
    req.end()
})

/** What the hooks own and the leaves read. */
const served = { port: 0, child: null, said: '' }

/**
 * Waits until the server answers, or gives up loudly.
 *
 * A fixed sleep would be either slow or flaky, and the interesting failure —
 * the server refusing the port or the root and exiting with a message — is one
 * this loop reports, because a dead child makes every attempt fail and the
 * server's own words are in `served.said`.
 *
 * The budget is wall-clock, the way the other spawning suites here count it,
 * and not a number of attempts: with a per-request deadline a count would
 * multiply by it, so a server that stalled on every probe would keep the hook
 * for a hundred times `probeTimeoutMs` instead of the twenty seconds promised.
 */
const awaitServer = async port => {
    const deadline = Date.now() + startupTimeoutMs
    let last = null
    while (Date.now() < deadline) {
        try {
            return await fetchPath(port, `/${smallFile}`, probeTimeoutMs)
        } catch (e) {
            last = e
            await new Promise(resolve => setTimeout(resolve, 100))
        }
    }
    throw new Error(
        `fjs web never answered on port ${port} within ${startupTimeoutMs} ms: ${last}\n${served.said}`)
}

before(async () => {
    served.port = await freePort()
    // The repository root IS the served root — no staging, no symlinks. The
    // demo's own layout is `demo/serve.sh`'s business and is irrelevant here:
    // the question is whether a large file survives a socket.
    served.child = spawn(join(repoRoot, 'node_modules', '.bin', 'fjs'),
        ['web', repoRoot, String(served.port)],
        { cwd: repoRoot, stdio: ['ignore', 'pipe', 'pipe'] })
    // Read both streams so a chatty server cannot fill a pipe and block. The
    // text is kept for the failure messages, which is the only place it is read.
    served.child.stdout.on('data', chunk => { served.said += chunk })
    served.child.stderr.on('data', chunk => { served.said += chunk })
    const first = await awaitServer(served.port)
    assert.equal(first.status, 200, `fjs web did not serve ${smallFile}: ${served.said}`)
    // An outer bound on the hook as well as on each request inside it, so this
    // hook cannot become the unbounded wait again by a later edit.
}, { timeout: 60_000 })

after(() => {
    served.child.kill('SIGTERM')
})

test('MAINT-11: `fjs web` serves a file above the old `Vec` ceiling, every byte of it', {
    // Longer than `requestTimeoutMs`, so the request's own deadline is what
    // reports a stall; this one only catches a wait nothing else bounds.
    timeout: 60_000,
}, async () => {
    const onDisk = readFileSync(join(repoRoot, largeModule))
    const size = statSync(join(repoRoot, largeModule)).size
    assert.equal(onDisk.length, size)
    assert.ok(size > oldCeilingBytes,
        `${largeModule} is ${size} bytes, which is not above the ${oldCeilingBytes}-byte ceiling this `
        + 'leaf exists to clear — name a file that is, or the leaf has stopped testing anything')

    const got = await fetchPath(served.port, `/${largeModule}`, requestTimeoutMs)
    // Through 0.51.0 this was `413`, with the size in the body: "file is
    // 1022499 bytes; this server cannot answer with more than 131072".
    assert.equal(got.status, 200,
        `served ${got.status} for ${largeModule}: ${got.body.toString('utf8').slice(0, 200)}`)
    // The count first, because it is the number a reader can act on; the
    // comparison second, because a hole in the middle is what a count misses.
    assert.equal(got.body.length, size, `asked for ${size} bytes and received ${got.body.length}`)
    assert.equal(got.headers['content-length'], String(size))
    assert.equal(Buffer.compare(got.body, onDisk), 0,
        `${largeModule} arrived at the right length and with different bytes`)
})

test('MAINT-11 control: a file under the old ceiling is served whole too', {
    timeout: 60_000,
}, async () => {
    // AGENTS.md's rule that a gate needs a control. Without this leaf, the one
    // above reads as "this server works"; with it, it reads as "this server
    // works ABOVE A SIZE", which is the claim being made.
    const onDisk = readFileSync(join(repoRoot, smallFile))
    assert.ok(onDisk.length < oldCeilingBytes,
        `${smallFile} is ${onDisk.length} bytes and is supposed to be the SMALL case`)

    const got = await fetchPath(served.port, `/${smallFile}`, requestTimeoutMs)
    assert.equal(got.status, 200)
    assert.equal(got.body.length, onDisk.length)
    assert.equal(Buffer.compare(got.body, onDisk), 0)
})
