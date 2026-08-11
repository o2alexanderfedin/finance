// @ts-nocheck
//
// This file exists outside `tsc`'s type checking on purpose, for the same two
// reasons `cas-refresh-cross-process.test.js` states in full:
//
// 1. TypeScript cannot resolve `node:fs` / `node:path` without `@types/node`,
//    and AGENTS.md forbids adding any new dependency -- including a
//    devDependency -- without every repo owner's approval (a hard stop).
//    That approval is not being sought just to typecheck one test harness.
// 2. A recursive filesystem walk over `fjs/`'s own source text is not
//    something a `.f.js` module's purity rule permits -- no existing
//    FunctionalScript proof precedent exists for file-content scanning
//    (13-PATTERNS.md's own "No Analog Found" table). This file is
//    therefore, like `index.js` and `all.test.js`, a root-level impure JS
//    file by necessity (AGENTS.md's carve-out for exactly this category).
//
// `@ts-nocheck` disables TYPE checking of this one file only.
//
// ── What this gate is, and why it is stronger than criterion 5's own text ──
//
// Success Criterion 5 (`13-ROADMAP.md`) is literally `grep -rn "magi" fjs/`
// returning nothing. That command is CASE-SENSITIVE: it catches a lowercase
// `magi` identifier, but a camelCase `Magi` (e.g. `seniorMagi`) sails
// straight past it. Carried finding C-1 (13-VALIDATION.md) found exactly
// this hole -- four proof-fixture names in `fjs/schedule/1a` and a
// cross-reference comment in `fjs/form1040/core` carried `Magi` and were
// invisible to the literal criterion. 13-13 renamed those (see this plan's
// first commit); THIS gate exists so the hole itself closes, not just
// today's instances of it.
//
// TAX-15's whole point is that the IRA deduction, Roth eligibility, the
// Premium Tax Credit, IRMAA and the student-loan-interest deduction do NOT
// share one MAGI -- each rule's add-back list is its own. A gate that only
// catches lowercase `magi` would let a future `seniorMagi` or `saltMagi`
// variable land and quietly reintroduce a shared-MAGI assumption. So this
// gate is deliberately CASE-INSENSITIVE on the "agi" tail while an M/m
// leads it -- it matches `magi`, `Magi`, `MAgi`, `mAGI`'s prefix, etc. --
// while still permitting the exact, all-uppercase `MAGI` acronym in prose
// and docstrings (Decision 3.6 explicitly allows that; the whole worksheet
// commentary in `fjs/schedule/1a` and `fjs/tax/params` uses it).
//
// The regex is exactly `[a-zA-Z]*[Mm]agi[a-zA-Z]*` -- the same pattern
// 13-VALIDATION.md's own carried finding C-1 names as the verification
// command (`grep -rno "[a-zA-Z]*[Mm]agi[a-zA-Z]*" fjs/`), so the shell
// command an engineer runs by hand and the mechanical gate below agree by
// construction. Why this ONE pattern achieves both halves at once: it
// requires an `M`/`m` immediately followed by the literal lowercase `agi`.
// The all-uppercase acronym `MAGI` spells `M` then `A`-`G`-`I` -- uppercase
// -- which does not match the fixed lowercase `agi` in the pattern, so
// prose `MAGI` never trips it. Any mixed-case or lowercase identifier
// containing `magi` -- `Magi`, `magi`, `xMagiValue`, `saltMagi` -- DOES
// match, because in each of those the letters right after the `M`/`m` are
// literally `a`, `g`, `i` in lowercase.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = fileURLToPath(new URL('.', import.meta.url))
const scanRoot = join(repoRoot, 'fjs')

// The case-insensitive-on-"M", case-sensitive-on-"agi" pattern explained
// above. Applied per-line so a failure can report a 1-based line number,
// matching `grep -n`'s own convention.
const magiIdentifierPattern = /[a-zA-Z]*[Mm]agi[a-zA-Z]*/

/**
 * Recursively lists every file under `dir`, skipping `node_modules` and the
 * vendored `functionalscript` submodule (deliberately never checked out --
 * AGENTS.md's own "uninitialized submodule" caution -- and not this repo's
 * own source in any case). This gate's own scan root is `fjs/` only, and
 * this file lives at the repo root, so no self-exclusion logic is needed:
 * the walk below can never reach `magi-gate.test.js` itself.
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

test('MAGI gate: no fjs/ file contains a lowercase-or-mixed-case "magi" identifier', () => {
    const offenses = []
    for (const filePath of listFilesRecursively(scanRoot)) {
        const text = readFileSync(filePath, 'utf8')
        const lines = text.split('\n')
        for (let i = 0; i < lines.length; i += 1) {
            const line = lines[i]
            const match = magiIdentifierPattern.exec(line)
            if (match !== null) {
                offenses.push(
                    `${relative(repoRoot, filePath)}:${i + 1}: "${match[0]}" in: ${line.trim()}`,
                )
            }
        }
    }
    assert.equal(
        offenses.length,
        0,
        `found ${offenses.length} lowercase-or-mixed-case "magi" identifier(s), each a shared-MAGI ` +
        `regression TAX-15 forbids:\n${offenses.join('\n')}`,
    )
})

test('MAGI gate positive control: the uppercase "MAGI" acronym is still permitted in prose', () => {
    let foundUppercaseMagiProse = false
    for (const filePath of listFilesRecursively(scanRoot)) {
        const text = readFileSync(filePath, 'utf8')
        if (text.includes('MAGI')) {
            foundUppercaseMagiProse = true
            break
        }
    }
    assert.equal(
        foundUppercaseMagiProse,
        true,
        'expected at least one legitimate uppercase "MAGI" prose usage under fjs/ (e.g. a docstring ' +
        'naming the concept) -- if this fails, either the gate above has started rejecting prose ' +
        '(too strong) or every prose usage was removed; either way, investigate before "fixing" this ' +
        'leaf to pass',
    )
})
