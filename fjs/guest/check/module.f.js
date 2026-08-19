/**
 * MCP-09 — `fjs_check`'s pure logic: import a stored program and confirm it
 * exports a callable `report`, without ever invoking that export.
 *
 * **This has no security value.** `fjs_check` confirms a shape; it does not
 * sandbox, verify, or certify anything about the program's behavior. By the
 * time this function has an answer, `import()` has already run the module's
 * top-level code with full Node privileges — exactly the same exposure a
 * real `fjs_run` call carries (`fjs/guest/materialize/module.f.js`'s own
 * module header). Mistaking a clean `fjsCheck` result for "this program is
 * safe" is the one failure mode MCP-09 exists to prevent; do not describe
 * this tool, anywhere, as a security control.
 *
 * ## Import-and-confirm, never execute
 *
 * `fjsCheck` reuses `executeRun`'s own steps 1-3
 * (`fjs/server/fjs_run/module.f.js`: resolve hash -> read source -> write to
 * `.fjs-run` -> `loadProgram`) but stops one step short of step 5: it never
 * calls the loaded module's `report` function. `loadProgram`
 * (`fjs/guest/materialize/module.f.js`) already separates "import" from
 * "invoke the loaded export" — that module's own
 * `dirtySourceIsRefusedWithoutEvaluatingTheModuleBody` proof is the existing
 * evidence that a refusal happens before the module body runs. This module's
 * own proof (below) is the DIFFERENT half of that same discipline: once the
 * module HAS loaded, its `report` function itself must still never be
 * called.
 *
 * A program with no `report` export at all, or one whose `report` is not a
 * function, is a successful SMOKE CHECK reporting a fact
 * (`exportsReport: false`) — not a refusal. The program imported fine; it
 * just does not look like a report. Only an unresolvable hash, a CAS miss, a
 * materialize failure, or a disallowed import specifier refuses.
 *
 * @module
 */
import { step, catchStep, pureError, mapStep, history, historyStep, unwrapStep } from 'functionalscript/fjs/effects/module.f.mjs'
import { unwrap } from 'functionalscript/fjs/types/result/module.f.mjs'
import { cBase32ToVec, vecToCBase32 } from 'functionalscript/fjs/basen/cbase32/module.f.mjs'
import { collectRead, fileCas } from 'functionalscript/fjs/cas/module.f.mjs'
import { empty, nonEmpty } from 'functionalscript/fjs/effects/list/module.f.mjs'
import { errorSummary } from 'functionalscript/fjs/effects/node/module.f.mjs'
import { utf8ToString, tryUtf8 } from 'functionalscript/fjs/text/module.f.mjs'
import { sha256 } from 'functionalscript/fjs/crypto/sha2/module.f.mjs'
import { vec8 } from 'functionalscript/fjs/types/bit_vec/module.f.mjs'
import { parse } from 'functionalscript/fjs/path/module.f.mjs'
import { assert, assertEq } from 'functionalscript/fjs/asserts/module.f.mjs'
import { emptyState, virtual } from 'functionalscript/fjs/effects/node/virtual/module.f.mjs'
import { materializeProgram, loadProgram, materializeHome, programPath } from '../materialize/module.f.js'
import { guestCtx } from '../module.f.js'

/** @import { Effect, Operation } from 'functionalscript/fjs/effects/types.js' */
/** @import { Mkdir, WriteFile, Import } from 'functionalscript/fjs/effects/node/types.js' */
/** @import { Cas, FileCasOperation } from 'functionalscript/fjs/cas/types.js' */
/** @import { Result } from 'functionalscript/fjs/types/result/types.js' */
/** @import { List } from 'functionalscript/fjs/effects/list/types.js' */
/** @import { Vec } from 'functionalscript/fjs/types/bit_vec/types.js' */
/** @import { IoChannel } from 'functionalscript/fjs/effects/node/types.js' */
/** @import { State, Dir, JsModule } from 'functionalscript/fjs/effects/node/virtual/types.js' */
/** @import { Report } from '../module.f.js' */

// ── fjsCheck ─────────────────────────────────────────────────────────────────

/**
 * Imports a stored program (by CAS hash) and reports whether it exports a
 * callable `report`, WITHOUT ever calling that export.
 *
 * Mirrors `fjs/server/fjs_run/module.f.js`'s `executeRun` steps 1-3
 * verbatim — resolve the hash, read the source out of CAS, materialize it —
 * then calls `loadProgram` (Phase 6, unchanged) and stops. Nothing after the
 * `typeof` check below reads or calls `loaded.report(...)`.
 * **Every failure is in the error channel** (0.46.0), so this whole
 * function is its success path: the CAS miss, the materialize failure and
 * the specifier refusal each short-circuit through `step` rather than being
 * unpacked out of a payload `Result` by three nested `if`s. The one place
 * that still names an error is the `catchStep` that decides what a failed
 * read MEANS here — "program not found", not the IO detail.
 * @type {(materializeHomeRoot: string) => (cas: Cas<FileCasOperation>) => (hash: string) => Effect<FileCasOperation | Mkdir | WriteFile | Import, { readonly exportsReport: boolean }, string>}
 */
export const fjsCheck = materializeHomeRoot => cas => hash => {
    const hashVec = cBase32ToVec(hash)
    if (hashVec === null) {
        return pureError(`program not found: ${hash}`)
    }
    const read = catchStep(collectRead(cas.read(hashVec)), () => pureError(`program not found: ${hash}`))
    const sourceText = mapStep(read, utf8ToString)
    const materialized = historyStep(
        history(sourceText),
        text => materializeProgram(materializeHomeRoot)(hash)(text))
    return step(materialized, ([, text]) => {
        const loaded = loadProgram([])(programPath(materializeHome(materializeHomeRoot))(hash))(text)
        // The whole point of this module: read the presence/type of `report`
        // and stop. Nothing below this line reads or calls
        // `loaded.report(...)`.
        return mapStep(loaded, m => ({ exportsReport: typeof m['report'] === 'function' }))
    })
}

// ── Tests ────────────────────────────────────────────────────────────────────

/**
 * Single-chunk UTF-8 CAS write, mirroring `fjs/server/fjs_run/module.f.js`'s
 * own `seedText`.
 * @type {<O extends Operation>(cas: Cas<O>) => (text: string) => Effect<O, string, never>}
 */
const seedText = cas => text => {
    const bytes = tryUtf8(text)
    assert(bytes !== null, ['expected sample text to encode as UTF-8', text])
    /** @type {List<never, Vec, IoChannel>} */
    const payload = nonEmpty(bytes, empty())
    return mapStep(unwrapStep(cas.write(payload), errorSummary), vecToCBase32)
}

/**
 * Places a `JsModule` fixture at the exact nested location `virtual`'s own
 * path recursion expects — the identical technique
 * `fjs/server/fjs_run/module.f.js`'s own exported `placeJsModuleFixture`
 * uses, reproduced here rather than imported: that function belongs to the
 * server layer built ON TOP of `fjs/guest`, and this module lives inside
 * `fjs/guest` itself, so importing "up" would invert the dependency
 * direction. Duplicating this small, test-only helper costs far less than
 * that inversion would.
 * @type {(root: Dir) => (path: string) => (fn: JsModule) => Dir}
 */
const placeJsModuleFixture = root => path => fn => {
    /** @type {(dir: Dir, segments: readonly string[]) => Dir} */
    const place = (dir, segments) => {
        const [first, ...rest] = segments
        if (first === undefined) {
            throw new Error('expected a non-empty path')
        }
        if (rest.length === 0) {
            return { ...dir, [first]: fn }
        }
        const sub = dir[first]
        const subDir = /** @type {Dir} */ (typeof sub === 'object' && sub !== null && !Array.isArray(sub) ? sub : {})
        return { ...dir, [first]: place(subDir, rest) }
    }
    return place(root, parse(path))
}

/**
 * Replays `fjsCheck`'s OWN materialize -> load sequence, decomposed across
 * TWO `virtual` sessions — the SAME technique
 * `fjs/server/fjs_run/module.f.js`'s `runExecuteRunViaFixture` uses at the
 * `executeRun` layer, applied one layer down (no snapshot/interpret step
 * here, since `fjsCheck` stops before that). Under `virtual`,
 * `materializeProgram`'s real write and `loadProgram`'s real `import_`
 * cannot both succeed at the SAME path within the SAME session
 * (`fjs/guest/materialize/module.f.js`'s own header: `writeFile`'s
 * array-of-`Vec` representation and `import_`'s `JsModule` requirement are
 * incompatible there) — so the write is exercised for real in the first
 * session (a fresh, unwritten path), then the written array is swapped for
 * a `JsModule` fixture (plain state surgery, not an effect) before the
 * second session runs `loadProgram` against it. This is what lets the
 * SUCCESS-path leaves below observe an `ok` result at all; the ERROR-path
 * leaves (missing/malformed hash, dirty specifier) need no such
 * decomposition, since they short-circuit before this collision could ever
 * occur, and call `fjsCheck` directly.
 *
 * **This helper's own load-and-check step is a SEPARATE copy of
 * `fjsCheck`'s tail, not a call to `fjsCheck` itself** — exactly the same
 * relationship `runExecuteRunViaFixture` has to `executeRun` (that helper's
 * own header: "nothing about `executeRun`'s OWN logic changes; only the
 * TEST's ability to observe an 'ok' outcome ... does"). A mutation to
 * `fjsCheck`'s OWN body (e.g. one that calls `loaded.report(...)` before
 * returning) is therefore NOT caught by the leaves below — verified by
 * mutation during this module's own development, watched to fail exactly
 * this way, then reverted. The decisive proof against the REAL, single,
 * composed `fjsCheck` export — and thus against the shipped `fjs_check` MCP
 * tool — is `fjs-run-integration.test.js`'s real-process `fjs_check` call
 * (Plan 15-03 Task 2), which pairs a report that would THROW if invoked with
 * a following call proving the SAME server process survives — the one
 * assertion no virtual proof of this file can make, mirroring exactly why
 * `fjs-run-integration.test.js` is `executeRun`'s own decisive proof too.
 * @type {(home: string) => (hash: string) => (source: string) => (fixture: JsModule) => (state: State) => readonly [State, Result<{ readonly exportsReport: boolean }, string>]}
 */
const runFjsCheckViaFixture = home => hash => source => fixture => state => {
    const [state1, materializeResult] = virtual(state)(materializeProgram(home)(hash)(source))
    assert(materializeResult[0] === 'ok', ['expected the real materialize write to succeed', materializeResult])
    const path = programPath(materializeHome(home))(hash)
    const root = placeJsModuleFixture(state1.root)(path)(fixture)
    const state2 = { ...state1, root }
    return virtual(state2)(
        mapStep(loadProgram([])(path)(source), m => ({ exportsReport: typeof m['report'] === 'function' })))
}

/** A program written the way a real report is: ctx only, zero imports. */
const cleanSource = 'export const report = ctx => args => ctx.pure("x")'

export const proof = {
    // ── Error paths: no representational collision, call fjsCheck directly ──
    errors: {
        // A malformed cBase32 hash short-circuits before CAS is ever read.
        malformedHashIsRefused: () => {
            const home = '/check-malformed'
            const cas = fileCas(sha256)(home)
            const [, result] = virtual(emptyState)(fjsCheck(home)(cas)('not-a-real-hash'))
            assertEq(result[0], 'error')
            if (result[0] === 'error') {
                assert(result[1].includes('not-a-real-hash'), result[1])
            }
        },
        // A syntactically valid cBase32 hash that was never written to THIS
        // store — the genuine CAS-miss branch, distinct from the malformed-hash
        // branch above (mirrors fjs/server/fjs_run/module.f.js's own
        // missingHashBecomesErrorResult technique).
        casMissIsRefused: () => {
            const home = '/check-cas-miss'
            const cas = fileCas(sha256)(home)
            const missingHash = vecToCBase32(vec8(0xabn))
            const [, result] = virtual(emptyState)(fjsCheck(home)(cas)(missingHash))
            assertEq(result[0], 'error')
            if (result[0] === 'error') {
                assert(result[1].includes(missingHash), result[1])
            }
        },
        // A disallowed import specifier is refused with the SAME message
        // loadProgram itself produces — checkSpecifiers runs and refuses
        // BEFORE import_ is ever reached, so this never touches the
        // materialize/load representational collision.
        dirtyImportSpecifierIsRefused: () => {
            const home = '/check-dirty'
            const cas = fileCas(sha256)(home)
            const [state0, seeded] = virtual(emptyState)(
                seedText(cas)(`import fs from 'node:fs'\n${cleanSource}`))
            const [, result] = virtual(state0)(fjsCheck(home)(cas)(unwrap(seeded)))
            assertEq(result[0], 'error')
            if (result[0] === 'error') {
                assert(result[1].includes('node:fs'), result[1])
            }
        },
    },

    // ── The decisive proof: import happens, report is never invoked ─────────
    neverExecutes: {
        // A program whose report IS a function: fjsCheck resolves
        // ok({ exportsReport: true }), and the loaded module's own report
        // function is NEVER invoked — the spy stays false. This is MCP-09's
        // whole point, asserted as an observed side effect (or its absence),
        // never as "fjsCheck returned quickly" or "did not throw".
        exportsReportTrueAndReportNeverCalled: () => {
            const home = '/check-success'
            const hash = 'CONTENTHASH'
            /** @type {{ reportCalled: boolean }} */
            const spy = { reportCalled: false }
            /** @type {Report<string>} */
            const spiedReport = ctx => () => {
                spy.reportCalled = true
                return ctx.pure('x')
            }
            const fixture = () => ({ report: spiedReport })
            const [, result] = runFjsCheckViaFixture(home)(hash)(cleanSource)(fixture)(emptyState)
            assert(result[0] === 'ok', ['expected fjsCheck to succeed', result])
            if (result[0] === 'ok') {
                assertEq(result[1].exportsReport, true)
            }
            // The point of MCP-09, in one assertion: fjsCheck imported the
            // module (the fixture above proves that, since exportsReport
            // read the fixture's own shape) but never called report.
            assertEq(spy.reportCalled, false)
        },
        // The control: the SAME fixture's report function DOES flip the spy
        // when actually invoked — proving the spy is capable of detecting
        // invocation, so its staying false above is meaningful evidence, not
        // a spy that never fires (AGENTS.md: "a gate needs a control").
        controlDirectInvocationFlipsTheSameSpy: () => {
            /** @type {{ reportCalled: boolean }} */
            const spy = { reportCalled: false }
            /** @type {Report<string>} */
            const spiedReport = ctx => () => {
                spy.reportCalled = true
                return ctx.pure('x')
            }
            const loaded = { report: spiedReport }
            // The SAME call shape executeRun's own interpreter would make
            // (interpret(hostMap)(loaded.report(guestCtx)(args))) — fjsCheck
            // itself must never reach this line.
            loaded.report(guestCtx)([])
            assertEq(spy.reportCalled, true)
        },
        // A program with no report export at all, or one whose report is not
        // a function, resolves ok({ exportsReport: false }) — a successful
        // smoke check reporting a fact, never an error. The program imported
        // fine; it just does not look like a report.
        exportsReportFalseWhenReportIsAbsentOrNotAFunction: () => {
            const home = '/check-no-report'
            for (const [hash, fixture] of /** @type {readonly (readonly [string, () => Record<string, unknown>])[]} */ ([
                ['CONTENTHASH-ABSENT', () => ({ somethingElse: 1 })],
                ['CONTENTHASH-STRING', () => ({ report: 'not a function' })],
            ])) {
                const [, result] = runFjsCheckViaFixture(home)(hash)(cleanSource)(fixture)(emptyState)
                assert(result[0] === 'ok', ['expected fjsCheck to succeed even with no report export', result])
                if (result[0] === 'ok') {
                    assertEq(result[1].exportsReport, false)
                }
            }
        },
    },
}
