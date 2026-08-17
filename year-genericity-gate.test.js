// @ts-nocheck
//
// This file exists outside `tsc`'s type checking on purpose, for the same two
// reasons `magi-gate.test.js` and `payer-report-gate.test.js` state in full:
//
// 1. TypeScript cannot resolve `node:fs` / `node:path` / `node:url` without
//    `@types/node`, and AGENTS.md forbids adding any new dependency --
//    including a devDependency -- without every repo owner's approval (a
//    hard stop). That approval is not being sought just to typecheck one
//    test harness.
// 2. A recursive filesystem walk over `fjs/`'s own source text is not
//    something a `.f.js` module's purity rule permits -- no existing
//    FunctionalScript proof precedent exists for file-content scanning
//    (13-PATTERNS.md's own "No Analog Found" table, cited by
//    `magi-gate.test.js`). This file is therefore, like `index.js`,
//    `all.test.js`, `magi-gate.test.js`, and `payer-report-gate.test.js`, a
//    root-level impure JS file by necessity (AGENTS.md's carve-out for
//    exactly this category).
//
// `@ts-nocheck` disables TYPE checking of this one file only.
//
// ── What this gate is, and why it is scoped the way it is (TAX-17) ─────────
//
// A literal, unscoped `grep -rn "2025" fjs/` false-positives on roughly 450
// legitimate lines (15-RESEARCH.md Pitfall 2): every tax/schedule/form module
// names its own test fixtures `taxParams2025` in its own `── Tests ──`
// section, and Rev. Proc. citation literals legitimately contain `'2025-32'`
// and `effectiveDate: '2025-01-01'`. None of those is a hardcoded-year BRANCH
// -- they are index-lookup keys, identifier names, and citation strings, none
// of which changes program BEHAVIOR based on a year comparison.
//
// This gate targets the actual defect SHAPE instead: an identifier ending in
// `year`/`Year` (or the bare identifier `year`) compared against a 4-digit
// literal via a comparison operator, in EITHER argument order --
// `taxYear === 2025`, `2025 !== fiscalYear`, `year <= 2025`, etc. That is a
// BRANCH whose outcome depends on the literal year, which is exactly what
// TAX-17's "any year with parameters and documents computes" claim forbids
// surviving inside `fjs/`'s computation paths.
//
// ## The plan's own literal regex text does not survive its own positive
//    control -- corrected here, not asserted-and-hoped
//
// 15-02-PLAN.md's Task 1 spells out the pattern as
// `/[A-Za-z_$][\w$]*[Yy]ear\s*(?:===|...)\s*\d{4}|.../` and separately
// requires a positive-control leaf asserting the SAME pattern matches
// `'return year !== 2025 ? undefined : x'`. It does not: that alternative
// requires a MANDATORY leading identifier-start character in ADDITION to the
// four-letter `[Yy]ear` suffix, i.e. an identifier of at least 5 characters
// -- so the bare 4-letter identifier `year` can never satisfy it (verified
// directly: `/[A-Za-z_$][\w$]*[Yy]ear/.test('year')` is `false`, because the
// engine needs 1 prefix char plus the 4-letter suffix, and `year` has only 4
// characters total to spend on both). Making the leading identifier-prefix
// group OPTIONAL (`(?:[A-Za-z_$][\w$]*)?` rather than a mandatory
// `[A-Za-z_$][\w$]*`) fixes this without weakening precision: the four
// negative controls below still correctly fail to match (an index access, a
// test-fixture identifier, a citation string, and a comma-separated
// `assertEq` call all still test `false`), the real tree still scans clean,
// and now BOTH literal examples from the plan's own `<action>` text --
// `taxYear === 2025` and `year !== 2025` -- match. Recorded here rather than
// silently substituted, per this plan's own "tune the scope against real
// code rather than asserting a regex and hoping" directive.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = fileURLToPath(new URL('.', import.meta.url))
const scanRoot = join(repoRoot, 'fjs')

const yearBranchPattern =
    /(?:[A-Za-z_$][\w$]*)?[Yy]ear\s*(?:===|!==|==|!=|<=|>=|<|>)\s*\d{4}|\d{4}\s*(?:===|!==|==|!=|<=|>=|<|>)\s*(?:[A-Za-z_$][\w$]*)?[Yy]ear/

/**
 * Recursively lists every file under `dir`, skipping `node_modules` and the
 * vendored `functionalscript` submodule -- the same skip list
 * `magi-gate.test.js`/`payer-report-gate.test.js` use, for the same reason
 * (that submodule is deliberately never checked out and is not this repo's
 * own source).
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

test('year-genericity gate: no fjs/ file contains a bare hardcoded-year comparison branch', () => {
    const offenses = []
    for (const filePath of listFilesRecursively(scanRoot)) {
        const text = readFileSync(filePath, 'utf8')
        const lines = text.split('\n')
        for (let i = 0; i < lines.length; i += 1) {
            const line = lines[i]
            const match = yearBranchPattern.exec(line)
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
        `found ${offenses.length} hardcoded-year comparison branch(es), each a year-genericity ` +
        `regression TAX-17 forbids:\n${offenses.join('\n')}`,
    )
})

test('year-genericity gate negative controls: legitimate 2025 usages do not trip the pattern', () => {
    // Index access -- `taxParamsByYear`/`taxParamsResponses`'s own construction
    // sites legitimately hold a 2025 map key, never a comparison.
    assert.equal(
        yearBranchPattern.test('taxParamsByYear[2025]'),
        false,
        'expected an index-access lookup to NOT be flagged as a comparison branch',
    )
    // A test-fixture identifier NAME containing the literal year, not a
    // comparison against it -- every tax/schedule/form module's own
    // `── Tests ──` section does this.
    assert.equal(
        yearBranchPattern.test('const taxParams2025 = taxParamsByYear[2025]'),
        false,
        'expected a test-fixture identifier declaration to NOT be flagged as a comparison branch',
    )
    // A Rev. Proc. citation string -- legitimately present throughout
    // `fjs/tax/params/module.f.js`.
    assert.equal(
        yearBranchPattern.test(
            "citation: { kind: 'revProc', revProc: '2025-32', section: '§3.01', effectiveDate: '2025-01-01' }",
        ),
        false,
        'expected a Rev. Proc. citation string to NOT be flagged as a comparison branch',
    )
    // An `assertEq` proof call -- comma-separated arguments, not a
    // comparison operator.
    assert.equal(
        yearBranchPattern.test('assertEq(a, 2025)'),
        false,
        'expected a comma-separated assertEq call to NOT be flagged as a comparison branch',
    )
})

test('year-genericity gate positive control: a genuinely hardcoded-year branch DOES trip the pattern', () => {
    // Two synthetic in-memory strings, never written into real fjs/ source --
    // AGENTS.md: "a gate needs a control". Both are drawn verbatim from this
    // plan's own <action> text.
    const syntheticOffendingLineA = 'if (taxYear === 2025) { return refuse() }'
    const syntheticOffendingLineB = 'return year !== 2025 ? undefined : x'
    assert.ok(
        yearBranchPattern.test(syntheticOffendingLineA),
        'expected the pattern to match a synthetic === hardcoded-year branch -- if this fails, the ' +
        'gate above is vacuously strict and would never catch a real regression',
    )
    assert.ok(
        yearBranchPattern.test(syntheticOffendingLineB),
        'expected the pattern to match a synthetic !== hardcoded-year branch (operand order reversed, ' +
        'bare "year" identifier) -- if this fails, the gate above is vacuously strict and would never ' +
        'catch a real regression',
    )
    // Mutation-checkable half of the control: narrowing the operator
    // alternation to ONLY `===` must stop matching the `!==` synthetic
    // string above -- demonstrating the control is sensitive to the
    // pattern's actual strength, not merely present for show.
    const narrowedToTripleEqualsOnly =
        /(?:[A-Za-z_$][\w$]*)?[Yy]ear\s*(?:===)\s*\d{4}|\d{4}\s*(?:===)\s*(?:[A-Za-z_$][\w$]*)?[Yy]ear/
    assert.ok(
        !narrowedToTripleEqualsOnly.test(syntheticOffendingLineB),
        'expected an artificially operator-narrowed pattern to NOT match the !== synthetic offending ' +
        'line -- this is the mutation the real gate above must be strong enough to avoid',
    )
    assert.ok(
        narrowedToTripleEqualsOnly.test(syntheticOffendingLineA),
        'expected the operator-narrowed pattern to still match the === synthetic offending line, so ' +
        'the mutation above isolates the !== operator specifically, not the whole gate',
    )
})
