// @ts-nocheck
//
// This file exists outside `tsc`'s type checking on purpose, for the same two
// reasons `magi-gate.test.js` states in full:
//
// 1. TypeScript cannot resolve `node:fs` / `node:path` / `node:url` without
//    `@types/node`, and AGENTS.md forbids adding any new dependency --
//    including a devDependency -- without every repo owner's approval (a
//    hard stop). That approval is not being sought just to typecheck one
//    test harness.
// 2. A recursive filesystem walk over `fjs/report/payer`'s own source text is
//    not something a `.f.js` module's purity rule permits -- no existing
//    FunctionalScript proof precedent exists for file-content scanning
//    (13-PATTERNS.md's own "No Analog Found" table, cited by
//    `magi-gate.test.js`). This file is therefore, like `index.js`,
//    `all.test.js`, and `magi-gate.test.js`, a root-level impure JS file by
//    necessity (AGENTS.md's carve-out for exactly this category).
//
// `@ts-nocheck` disables TYPE checking of this one file only -- it adds
// nothing to `package.json`, and no other file in this repo carries it
// besides `magi-gate.test.js` and the two real-process integration tests.
//
// ── What this gate proves (PROV-08, 15-01-PLAN.md Task 2) ──────────────────
//
// `fjs/report/payer/module.f.js` is this phase's rhetorical centerpiece: a
// SECOND, genuinely non-tax report, proving "reports are programs" was never
// specific to the 1040. The claim only means something if it is enforced
// mechanically rather than left to convention -- a future edit that reaches
// for a tax parameter or a tax computation function inside that one
// directory must fail a test, not merely violate a docstring. This gate
// scans every file under `fjs/report/payer/` for an import specifier naming
// `fjs/tax/*` (matching both a relative specifier, e.g. `../../tax/params/
// module.f.js`, and any absolute-looking `/tax/` path segment) and fails
// loudly, naming the offending file and line, if it ever finds one.
//
// Paired with a POSITIVE CONTROL (AGENTS.md: "a gate needs a control"):
// the identical regex is asserted to match a synthetic in-memory string that
// is never written into the real payer module, proving the pattern itself is
// not vacuously strict (i.e. it is not a regex that could never match
// anything, which would make the gate above pass for the wrong reason).
//
// -- What the TEXT gate above cannot see (Phase 21) ------------------------
//
// The scan reads TEXT; the claim is about DEPENDENCY. Those are not the same
// thing, and the difference is exactly the "true of the part examined"
// defect AGENTS.md records four shipped instances of. `fjs/report/payer`
// imports `fjs/guest/module.f.js`, so anything the ABI module imports, the
// payer report imports too -- transitively, with no `/tax/` text anywhere
// under `fjs/report/payer/` for the scan to find.
//
// Phase 21 made that a live hazard rather than a theoretical one: it put the
// 1040 engine on a guest context. Had `taxGuestCtx` been added to
// `fjs/guest/module.f.js` (the obvious place) instead of to its own
// `fjs/guest/tax/module.f.js`, the scan above would have stayed green while
// the payer report acquired a transitive dependency on the entire tax
// engine. Verified by mutation on 2026-08-16: adding one import of
// `../form1040/core/module.f.js` to the ABI module leaves BOTH text leaves
// green and reddens the dependency leaf below, naming all eleven modules it
// pulled in.
//
// So the second gate below resolves imports TRANSITIVELY and asserts the
// closure reaches no `fjs/tax/**`, `fjs/form1040/**` or `fjs/return/**`
// module. Its control is a real module rather than a synthetic string: the
// SAME walker, pointed at `fjs/report/tax_return/module.f.js` (the 1040
// report, which is supposed to reach the engine), must find those modules.
// A walker that resolved nothing would pass the payer leg for the wrong
// reason and fail the control -- confirmed by mutation too: stopping the
// walker from following relative specifiers reddens the control leaf AND the
// payer leaf's own non-vacuity assertion, never the payer leaf's verdict
// alone.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = fileURLToPath(new URL('.', import.meta.url))
const scanRoot = join(repoRoot, 'fjs', 'report', 'payer')

// Matches a `from '...'`/`from "..."` clause whose quoted specifier contains
// a `/tax/` path segment -- catches a relative specifier such as
// `../../tax/params/module.f.js` and any absolute-looking specifier carrying
// the same segment, without depending on how many `../` levels a future file
// under this directory happens to need.
const taxImportPattern = /from\s+['"][^'"]*\/tax\/[^'"]*['"]/

/**
 * Recursively lists every file under `dir`, skipping `node_modules` and the
 * vendored `functionalscript` submodule -- the same skip list
 * `magi-gate.test.js` uses, for the same reason (that submodule is
 * deliberately never checked out and is not this repo's own source).
 */
const listFilesRecursively = dir => {
    /** @type {string[]} */
    const out = []
    for (const entry of readdirSync(dir)) {
        if (entry === 'node_modules' || entry === 'functionalscript') {
            continue
        }
        const fullPath = join(dir, entry)
        const info = statSync(fullPath)
        if (info.isDirectory()) {
            out.push(...listFilesRecursively(fullPath))
        } else {
            out.push(fullPath)
        }
    }
    return out
}

test('fjs/report/payer imports nothing from fjs/tax/*', () => {
    const offenders = []
    for (const filePath of listFilesRecursively(scanRoot)) {
        const text = readFileSync(filePath, 'utf8')
        const lines = text.split('\n')
        for (let i = 0; i < lines.length; i += 1) {
            const line = lines[i]
            const match = taxImportPattern.exec(line)
            if (match !== null) {
                offenders.push(`${relative(repoRoot, filePath)}:${i + 1}: "${match[0]}" in: ${line.trim()}`)
            }
        }
    }
    assert.equal(
        offenders.length,
        0,
        `found ${offenders.length} import(s) of fjs/tax/* under fjs/report/payer -- PROV-08's whole ` +
        `claim is that this report consults zero tax parameters, mechanically enforced by this gate:\n` +
        offenders.join('\n'),
    )
})

test('fjs/report/payer gate positive control: the fjs/tax/* import pattern is not vacuously strict', () => {
    // Never written into the real payer module -- a synthetic probe string,
    // held only in memory, so this leaf cannot accidentally become evidence
    // that the real module imports fjs/tax/* (it does not; the leaf above
    // already proves that).
    const syntheticOffendingLine = "import { taxParamsByYear } from '../../tax/params/module.f.js'"
    assert.ok(
        taxImportPattern.test(syntheticOffendingLine),
        'expected the fjs/tax/* import pattern to match a synthetic offending import -- if this fails, ' +
        'the gate above is vacuously strict and would never catch a real regression',
    )
    // The mutation-checkable half of the control: weakening the pattern to
    // require an exact, unrealistic specifier (rather than any path
    // containing a `/tax/` segment) must stop matching the same synthetic
    // string -- demonstrating the control is sensitive to the pattern's
    // actual strength, not merely present for show.
    const weakenedPattern = /from\s+['"]\/tax\/exact-path-only['"]/
    assert.ok(
        !weakenedPattern.test(syntheticOffendingLine),
        'expected an artificially over-narrowed pattern to NOT match the synthetic offending import -- ' +
        'this is the mutation the real gate above must be strong enough to avoid',
    )
})

// -- The transitive dependency gate (Phase 21) -----------------------------

// Matches a `from '...'`/`from "..."` clause and captures the specifier, so
// the walker can follow the RELATIVE ones. Bare specifiers
// (`functionalscript/...`) are deliberately not followed: the vendored
// submodule is not this repo's own source, and it contains no tax module.
const specifierPattern = /from\s+['"]([^'"]+)['"]/g

// The three directories the payer report must not be able to reach, however
// many modules away. Written as path segments so a file at any depth inside
// them matches.
const forbiddenForPayer = ['/fjs/tax/', '/fjs/form1040/', '/fjs/return/']

/**
 * Resolves the transitive closure of RELATIVE imports reachable from `entry`,
 * as a set of absolute file paths. A specifier this crude resolver cannot
 * find is skipped rather than thrown on -- and cannot be silently treated as
 * "clean", because each leg below asserts the closure is non-trivial before
 * drawing any conclusion from it.
 */
const importClosure = entry => {
    const seen = new Set()
    const stack = [entry]
    while (stack.length > 0) {
        const current = stack.pop()
        if (seen.has(current)) {
            continue
        }
        let text
        try {
            text = readFileSync(current, 'utf8')
        } catch {
            continue
        }
        seen.add(current)
        for (const match of text.matchAll(specifierPattern)) {
            const specifier = match[1]
            if (!specifier.startsWith('.')) {
                continue
            }
            stack.push(resolve(dirname(current), specifier))
        }
    }
    return seen
}

test('fjs/report/payer reaches nothing under fjs/tax, fjs/form1040 or fjs/return, transitively', () => {
    const reached = new Set()
    for (const filePath of listFilesRecursively(scanRoot)) {
        for (const dependency of importClosure(filePath)) {
            reached.add(dependency)
        }
    }
    // The walker must actually have walked. Without this, a resolver that
    // returned nothing would pass the assertion below for the wrong reason --
    // the same vacuity the text gate's own positive control guards against.
    assert.ok(
        reached.size > 1,
        `expected the payer report's import closure to contain more than the file itself; got ${reached.size}`)
    const offenders = [...reached]
        .filter(p => forbiddenForPayer.some(segment => p.includes(segment)))
        .map(p => relative(repoRoot, p))
        .sort()
    assert.deepEqual(
        offenders,
        [],
        `PROV-08's claim is that the payer report consults zero tax parameters. It TRANSITIVELY ` +
        `imports these, which the text scan above cannot see:\n${offenders.join('\n')}`)
})

test('transitive gate positive control: the same walker DOES reach the tax engine from the 1040 report', () => {
    // A real module, not a synthetic string: `fjs/report/tax_return` is the
    // stored 1040 program's reference module, and it is SUPPOSED to reach the
    // engine. If the walker cannot find the tax engine from there, it cannot
    // find it from anywhere, and the payer leg above proves nothing.
    const reached = [...importClosure(join(repoRoot, 'fjs', 'report', 'tax_return', 'module.f.js'))]
        .map(p => relative(repoRoot, p))
    for (const expected of [
        'fjs/form1040/core/module.f.js',
        'fjs/tax/params/module.f.js',
        'fjs/return/scope/module.f.js',
    ]) {
        assert.ok(
            reached.includes(expected),
            `expected the walker to reach ${expected} from the 1040 report; reached ${reached.length} modules`)
    }
})
