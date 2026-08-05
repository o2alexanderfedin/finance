/**
 * SEC-02, SEC-03 and EXEC-09 — turning a stored blob into an executable
 * module without inheriting the ways that go wrong.
 *
 * Three separable concerns, kept separable because each fails differently:
 *
 * - **{@link checkSpecifiers} (SEC-02)** runs *before* materialization.
 *   After it, the check is worthless: `import()` evaluates the module body
 *   immediately, so by the time a module value exists, anything the blob
 *   wanted to do on load has already happened. REQUIREMENTS' accepted-risks
 *   section records that this happens with full Node privileges and that
 *   Node's permission model has no network permission — which is precisely
 *   why the specifier gate has to be the thing that runs first.
 * - **{@link programFileName} (SEC-03)** derives the filename from the
 *   content hash. Node's ESM cache is keyed by URL and never evicts, so a
 *   reused temp filename silently re-runs the *first* program: the second
 *   program's bytes are never executed and nothing reports an error. A
 *   hash-derived name makes that failure mode unreachable — two different
 *   programs cannot collide, and the same program deliberately does.
 * - **{@link loadProgram} (EXEC-09)** reaches `import()` through fjs's
 *   `import_` **effect** rather than as a raw expression, which is what
 *   makes the whole path proof-testable under `fjs/effects/node/virtual`
 *   with no filesystem at all.
 *
 * @module
 */
import { step, pure } from 'functionalscript/fjs/effects/module.f.js'
import { import_ } from 'functionalscript/fjs/effects/node/module.f.js'
import { error, ok } from 'functionalscript/fjs/types/result/module.f.js'
import { join } from 'functionalscript/fjs/path/module.f.js'
import { emptyState, virtual } from 'functionalscript/fjs/effects/node/virtual/module.f.js'
import { assert, assertEq } from 'functionalscript/fjs/asserts/module.f.js'
import { guestCtx } from '../module.f.js'
import { interpret } from '../../exec/module.f.js'

/** @import { Effect } from 'functionalscript/fjs/effects/module.f.js' */
/** @import { Import, Module } from 'functionalscript/fjs/effects/node/module.f.js' */
/** @import { Result } from 'functionalscript/fjs/types/result/module.f.js' */

// ── SEC-02: the specifier allow-list ─────────────────────────────────────────

/**
 * Every form that names a module specifier in ESM source: a static
 * `import`/`export ... from 'x'`, a bare side-effect `import 'x'`, and a
 * dynamic `import('x')`. Each alternative anchors on its own keyword and
 * captures the specifier that follows it.
 *
 * A specifier may be quoted three ways, and the third is not like the other
 * two. Group 1 captures a `'`- or `"`-quoted specifier, whose text is exactly
 * what the source says. Group 2 captures a backtick-quoted one — legal in a
 * dynamic `import()` — whose text may be assembled at runtime by a `${...}`
 * substitution and so is *not* knowable from the source. The two are captured
 * separately because they get different answers, not because they differ in
 * shape: see {@link checkSpecifiers}.
 *
 * Every quote body is a negated character class (`[^'"]*`, `` [^`]* ``)
 * rather than a lazy wildcard, so matching is linear in input length with no
 * catastrophic-backtracking shape.
 * @type {RegExp}
 */
const specifierPattern = /(?:\bfrom\s*|\bimport\s*\(?\s*|\bexport\s*\(?\s*)(?:['"]([^'"]*)['"]|`([^`]*)`)/g

/**
 * Refuses a program whose source names any specifier outside `allowed`,
 * returning the source unchanged when it is clean and the offending
 * specifier when it is not.
 *
 * `allowed` is a parameter, and for a stored report program it is **empty**
 * — Success Criterion 2 requires zero imports in a blob, because a CAS blob
 * cannot resolve bare specifiers: there is no `node_modules` at a content
 * hash. An empty allow-list rejects `https://attacker/x.js` and `node:fs`
 * alike, which is exactly Criterion 3.
 *
 * It is written as an allow-list rather than as a hardcoded reject-all
 * because the parameter costs one line, and a function named for an
 * allow-list that cannot express one is a name that stops being true the
 * first time somebody needs it to.
 *
 * A backtick-quoted specifier is refused **unconditionally**, never compared
 * against `allowed`. `` import(`${x}`) `` names a module whose text this
 * function cannot know: the substitution is evaluated at import time, long
 * after the gate has run. Comparing whatever literal text sits between the
 * backticks would be checking a string the program never uses. Since this
 * gate exists precisely because everything after it is too late (see the
 * module header), the only sound answer to a specifier it cannot read is to
 * refuse — a gate that cannot decide must not pass.
 *
 * The refusal is unconditional even for a substitution-free `` `node:fs` ``,
 * which is in principle readable. Distinguishing the two would mean deciding
 * which template literals are static, and that decision is the beginning of
 * writing a JavaScript parser here rather than a gate.
 * @type {(allowed: readonly string[]) => (source: string) => Result<string, string>}
 */
export const checkSpecifiers = allowed => source => {
    for (const m of source.matchAll(specifierPattern)) {
        const specifier = m[1]
        const templateSpecifier = m[2]
        if (templateSpecifier !== undefined) {
            return error('import specifier not permitted: a template-literal specifier cannot be checked statically')
        }
        if (specifier !== undefined && !allowed.includes(specifier)) {
            return error(`import specifier not permitted: ${specifier}`)
        }
    }
    return ok(source)
}

// ── SEC-03: content-hash-derived filenames ───────────────────────────────────

/**
 * The filename a program with this content hash materializes under. The
 * hash is the CAS's own cBase32 content address, so distinctness of
 * filenames follows from content-addressing rather than from anything this
 * function does — content-to-hash is the CAS's job and is proven there
 * (Phase 5). What this function guarantees is that nothing else enters the
 * name: no counter, no timestamp, no PID. A counter-suffixed scheme would
 * satisfy "distinct programs get distinct names" while breaking the other
 * half of Criterion 4, and that half is the one SEC-03 exists for.
 *
 * `.mjs` because a blob is ESM and carries no `package.json` to declare it.
 * @type {(hash: string) => string}
 */
export const programFileName = hash => `${hash}.mjs`

/**
 * The full path a program materializes at, under `home`. Kept separate from
 * {@link programFileName} because `fjs/effects/node/virtual`'s `import_`
 * accepts only a single-segment path — verified: it returns
 * `error('no such file')` unless the parsed path has length 1 — so a proof
 * under `virtual` addresses the bare filename while a real run addresses
 * this.
 * @type {(home: string) => (hash: string) => string}
 */
export const programPath = home => hash => join(home, programFileName(hash))

// ── EXEC-09: import through the effect, never a raw expression ───────────────

/**
 * Loads a materialized program: the specifier gate first, then `import_` on
 * the given path. Returns the module, or the refusal that stopped it.
 *
 * `path` is a parameter rather than being derived here so the gate ordering
 * stays visible and testable: the whole point of SEC-02 is that the check
 * happens before anything is imported, and a function that computed its own
 * path would let that ordering be rearranged without the signature changing.
 *
 * No raw `import(...)` expression appears anywhere in this module (EXEC-09)
 * — `import_` is an operation, so the entire path runs under `virtual` with
 * no filesystem.
 * @type {(allowed: readonly string[]) => (path: string) => (source: string) => Effect<Import, Result<Module, string>>}
 */
export const loadProgram = allowed => path => source => {
    const [t, v] = checkSpecifiers(allowed)(source)
    if (t === 'error') {
        return pure(error(v))
    }
    return step(import_(path), imported => {
        const [it, iv] = imported
        return pure(it === 'error' ? error(`import failed: ${String(iv)}`) : ok(iv))
    })
}

// ── Tests ────────────────────────────────────────────────────────────────────

/** A program written the way Criterion 2 requires: ctx only, zero imports. */
const cleanSource = 'export const report = ctx => args => ctx.casRead(args[0])'

/**
 * The `report` entry point a materialized module exposes — the runtime
 * counterpart of {@link cleanSource}, used as the JsModule fixture's export
 * so the proof exercises a real entry point rather than an empty object.
 * @type {import('../module.f.js').Report<string>}
 */
const guestReport = ctx => args => ctx.casRead(args[0] ?? '')

/** A host map for the frozen vocabulary, so a loaded program can be RUN. */
/** @type {import('functionalscript/fjs/effects/module.f.js').OperationMap<import('../module.f.js').CasOp, string>} */
const hostMap = {
    casRead: a => `casRead:${a}`,
    evoList: a => `evoList:${a}`,
    evoHead: a => `evoHead:${a}`,
    evoRevision: a => `evoRevision:${a}`,
}
Object.setPrototypeOf(hostMap, null)

export const proof = {
    // ── Success Criterion 3 ─────────────────────────────────────────────
    specifiers: {
        // The two the criterion names by hand.
        remoteUrlRejected: () => {
            const [t, v] = checkSpecifiers([])(`const m = await import('https://attacker/x.js')`)
            assertEq(t, 'error')
            assert(String(v).includes('https://attacker/x.js'), String(v))
        },
        nodeBuiltinRejected: () => {
            const [t, v] = checkSpecifiers([])(`import fs from 'node:fs'`)
            assertEq(t, 'error')
            assert(String(v).includes('node:fs'), String(v))
        },
        // The forms an attacker would reach for once the obvious two are
        // closed: a bare side-effect import, a re-export, a data: URL, and a
        // relative path escaping the store.
        otherSpecifierFormsRejected: () => {
            for (const src of [
                `import 'node:child_process'`,
                `export { x } from 'https://evil/y.js'`,
                `await import("data:text/javascript,globalThis.x=1")`,
                `import x from '../../etc/passwd'`,
            ]) {
                assertEq(checkSpecifiers([])(src)[0], 'error')
            }
        },
        // A dynamic `import()` may quote its specifier with a backtick, and a
        // template literal may interpolate — so its text is not knowable by
        // reading the source at all. Neither form can be checked against an
        // allow-list, so both are refused outright rather than parsed: a gate
        // that cannot decide must not pass.
        templateLiteralSpecifierRejected: () => {
            for (const src of [
                'await import(`node:fs`)',
                'await import(`${globalThis.pick()}`)',
                'export { x } from `https://evil/y.js`',
            ]) {
                assertEq(checkSpecifiers([])(src)[0], 'error')
            }
        },
        // A program that imports nothing passes — the gate rejects
        // specifiers, not programs.
        cleanProgramAccepted: () => {
            const [t, v] = checkSpecifiers([])(cleanSource)
            assert(t === 'ok', ['expected ok', t, v])
            assertEq(v, cleanSource)
        },
        // The allow-list is a real allow-list, not a reject-all wearing the
        // name: the same specifier passes when it is listed.
        allowListActuallyAllows: () => {
            const src = `import x from 'permitted-thing'`
            assertEq(checkSpecifiers([])(src)[0], 'error')
            assertEq(checkSpecifiers(['permitted-thing'])(src)[0], 'ok')
        },
    },

    // ── Success Criterion 4 ─────────────────────────────────────────────
    filenames: {
        // Half one: two distinct programs never collide.
        distinctHashesGiveDistinctNames: () => {
            assert(
                programFileName('AAAA') !== programFileName('BBBB'),
                'two content hashes must not share a materialization name')
        },
        // Half two, and the one a counter-suffix scheme silently breaks:
        // the SAME hash must give the SAME name, because that identity is
        // what lets Node's URL-keyed, never-evicting ESM cache reuse the
        // module instead of re-running the first program under a reused
        // name. Proving only half one would pass for `${hash}-${n}.mjs`.
        sameHashIsStable: () => {
            assertEq(programFileName('AAAA'), programFileName('AAAA'))
        },
        // Nothing but the hash enters the name — no counter, no clock, no
        // PID. Asserted by construction rather than by inspecting the string
        // for things that are absent.
        nameIsExactlyTheHash: () => {
            assertEq(programFileName('AAAA'), 'AAAA.mjs')
            assert(programPath('/store')('AAAA').endsWith('AAAA.mjs'), programPath('/store')('AAAA'))
        },
    },

    // ── Success Criterion 5 ─────────────────────────────────────────────
    // The whole materialize-and-run path under `fjs/effects/node/virtual`,
    // with a `JsModule` at the CAS path and NO real filesystem. `import_` is
    // an operation, so `virtual` interprets it like any other — which is the
    // entire reason EXEC-09 insists on the effect rather than a raw
    // `import(...)` expression, which no interpreter can intercept.
    underVirtual: {
        cleanProgramImportsAndRuns: () => {
            const hash = 'CONTENTHASH'
            const name = programFileName(hash)
            // The materialized module, placed at the hash-derived path. A
            // JsModule is a function so `virtual` can tell it from a Vec.
            const root = { [name]: () => ({ report: guestReport }) }
            const [, result] = virtual({ ...emptyState, root })(loadProgram([])(name)(cleanSource))
            const [t, v] = result
            assert(t === 'ok', ['expected the module to load', t, v])
            // It is the module we placed — and its entry point actually
            // RUNS, composed only from the frozen ctx and interpreted by
            // Phase 3's interpreter. Asserting the export is a function
            // would prove the fixture was returned; running it proves the
            // materialize -> import -> execute path end to end.
            const loaded = /** @type {{ readonly report: import('../module.f.js').Report<string> }} */ (v)
            const [rt, rv] = interpret(hostMap)(loaded.report(guestCtx)(['abc']))
            assert(rt === 'ok', ['expected the loaded program to run', rt, rv])
            assertEq(rv[0], 'casRead:abc')
        },
        // The gate runs BEFORE `import_`, and the ONLY thing that
        // distinguishes the two orderings is whether the module body ran.
        //
        // An earlier version of this leaf asserted that a dirty source
        // produced a specifier message rather than an import error. That
        // proved nothing: the module at this path loads fine, so BOTH
        // orderings end in the specifier message. Moving the check after
        // `import_` left the suite fully green — the guarantee was
        // decorative until this leaf was rewritten.
        //
        // A JsModule is a function `virtual` invokes on import, and
        // upstream's own docstring notes the fixture may close over state
        // for exactly this purpose. So the fixture records its own
        // invocation: if the gate ran first, the body was never evaluated.
        // That is the real security property — after `import()`, whatever
        // the blob wanted to do on load has already happened.
        dirtySourceIsRefusedWithoutEvaluatingTheModuleBody: () => {
            const name = programFileName('CONTENTHASH')
            /** @type {{ evaluated: boolean }} */
            const spy = { evaluated: false }
            const root = {
                [name]: () => {
                    spy.evaluated = true
                    return { report: guestReport }
                },
            }
            const dirty = `import fs from 'node:fs'\n${cleanSource}`
            const [, result] = virtual({ ...emptyState, root })(loadProgram([])(name)(dirty))
            const [t, v] = result
            assertEq(t, 'error')
            assert(String(v).includes('node:fs'), String(v))
            // The point of SEC-02, in one assertion.
            assertEq(spy.evaluated, false)
        },
        // The control: the same fixture DOES evaluate for a clean source,
        // so the assertion above is about the gate, not about a spy that
        // never fires.
        cleanSourceDoesEvaluateTheModuleBody: () => {
            const name = programFileName('CONTENTHASH')
            /** @type {{ evaluated: boolean }} */
            const spy = { evaluated: false }
            const root = {
                [name]: () => {
                    spy.evaluated = true
                    return { report: guestReport }
                },
            }
            const [, result] = virtual({ ...emptyState, root })(loadProgram([])(name)(cleanSource))
            assertEq(result[0], 'ok')
            assertEq(spy.evaluated, true)
        },
        // A missing module is an error value, not a throw — the same
        // discipline Phase 3 locked for refusals.
        missingModuleIsAnErrorValue: () => {
            const [, result] = virtual({ ...emptyState, root: {} })(
                loadProgram([])(programFileName('ABSENT'))(cleanSource))
            assertEq(result[0], 'error')
        },
    },
}
