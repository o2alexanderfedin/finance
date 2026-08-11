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

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
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
