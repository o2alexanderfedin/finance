// @ts-nocheck
//
// This file exists outside `tsc`'s type checking on purpose, for the same two
// reasons `magi-gate.test.js`, `payer-report-gate.test.js` and
// `year-genericity-gate.test.js` state in full: TypeScript cannot resolve
// `node:fs`/`node:path`/`node:url` without `@types/node`, and AGENTS.md
// forbids adding any dependency -- including a devDependency -- without every
// repo owner's approval; and reading `.planning/`'s own source text is not
// something a `.f.js` module's purity rule permits. `@ts-nocheck` disables
// TYPE checking of this one file only.
//
// ── What this gate is (MAINT-02..MAINT-05, Phase 17) ──────────────────────
//
// `.planning/REQUIREMENTS.md` states every requirement TWICE: once as a
// checkbox in its body (`- [x] **MAINT-07** ...`) and once as a row in a
// traceability table at the bottom. Two statements of one fact, and until this
// file existed, **nothing compared them**.
//
// That is not a hypothesis. REQUIREMENTS.md carries a shell snippet directly
// above the table that finds exactly this drift, followed by its own verdict:
//
//     "A second source of truth is safe only when something watches it drift.
//      Nothing watches this one -- the command above is not run by any gate.
//      Phase 17 (Documentation Truth Pass) owns making it an actual check
//      rather than a snippet someone has to remember."
//
// This file is that check. When it was first run it found five rows --
// MAINT-02, MAINT-03, MAINT-04, MAINT-05, MAINT-06 -- whose table Status read
// `Pending` while their bodies were ticked `[x]` and carried dated,
// evidence-bearing resolution notes. The snippet had been sitting in the file
// that would have caught them; nobody ran it, which is the entire argument for
// a gate over a documented command.
//
// ## Why it reads TWO tables, and why that is not an accident
//
// v1 requirements are traced one-per-row with a Status column. v2 requirements
// are traced in a SECOND table, grouped several IDs to a row, with a persona
// column and no Status. A first version of this gate knew only about the first
// table and "found" all 23 v2 requirements missing -- a false alarm that would
// have been fixed by inventing 23 rows that already existed elsewhere.
// **Recorded rather than quietly corrected**: a gate's first run is where its
// own false-positive rate is cheapest to discover, and a gate that cries wolf
// gets disabled, which is worse than not having it.
//
// So coverage is checked against the UNION (every requirement must be traced
// somewhere), while the checkbox-vs-Status comparison is applied only to the
// table that actually has a Status column.
//
// ## The count claims
//
// `.planning/` also states the served MCP tool count and the document dialect
// count in prose. Both are compared against the code rather than against each
// other: the tool count against `expectedServedToolCount`, which
// `fjs/server`'s own `toolsListIsExactlyTheHandTypedToolSet` proof has already
// compared to a live `tools/list`; the dialect count against `knownDialects`
// itself. The tool count is the project's most load-bearing invariant --
// REQUIREMENTS.md permanently forbids a `finance_compute_1040` tool, because
// the architecture exists so the agent AUTHORS a program rather than calling
// one -- so a document quietly advertising a different number is worth
// reddening over.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expectedServedToolCount } from './fjs/server/module.f.js'
import { knownDialects } from './fjs/server/finance_schema/module.f.js'

const repoRoot = fileURLToPath(new URL('.', import.meta.url))
const planningDir = join(repoRoot, '.planning')
const requirementsPath = join(planningDir, 'REQUIREMENTS.md')

/** `- [x] **MAINT-07** *(T3)*: ...` -- the body statement of a requirement. */
const bodyPattern = /^- \[([x ])\] \*\*([A-Z]+-[0-9]+)\*\*/

/** `| MAINT-07 | T3 | Phase 18 ... | Complete | Verified |` -- one ID per row. */
const singleRowPattern = /^\| *([A-Z]+-[0-9]+) *\|/

/** `| DOC-22, DOC-23, TAX-33, TAX-34 | T3 | 29 - ... |` -- the v2 grouped form. */
const groupedRowPattern = /^\| *((?:[A-Z]+-[0-9]+)(?:, *[A-Z]+-[0-9]+)+) *\|/

/**
 * The only value in the Status column that means "not done". Everything else
 * -- `Done`, `Complete`, `Verified`, and the several rows carrying a sentence
 * of prose instead -- is treated as done. Deliberately a whitelist of ONE:
 * a new not-done word would go unnoticed by a blacklist, and the failure mode
 * of this choice is a missed warning rather than a false alarm.
 */
const notDone = /^pending$/i

const parseRequirements = () => {
    const lines = readFileSync(requirementsPath, 'utf8').split('\n')
    const body = new Map()
    const statusByRequirement = new Map()
    const traced = new Set()
    for (const line of lines) {
        const bodyMatch = line.match(bodyPattern)
        if (bodyMatch !== null) { body.set(bodyMatch[2], bodyMatch[1] === 'x') }
        const singleMatch = line.match(singleRowPattern)
        if (singleMatch !== null) {
            const columns = line.split('|').map(c => c.trim())
            statusByRequirement.set(singleMatch[1], columns[5] ?? '')
            traced.add(singleMatch[1])
        }
        const groupedMatch = line.match(groupedRowPattern)
        if (groupedMatch !== null) {
            for (const id of groupedMatch[1].split(/, */)) { traced.add(id) }
        }
    }
    return { body, statusByRequirement, traced }
}

/** Every `.planning/*.md`, read once. */
const planningDocuments = () => readdirSync(planningDir)
    .filter(name => name.endsWith('.md'))
    .map(name => ({ name, text: readFileSync(join(planningDir, name), 'utf8') }))

/**
 * Finds `13 tools` / `**13 tools**`. The leading `(?<![\w-])` keeps it from
 * firing inside a hyphenated or alphanumeric neighbour.
 */
const toolCountPattern = /(?<![\w-])(\d+) tools\b/g

/**
 * Finds `26 dialects` / `26 document dialects`. The lookbehind is load-bearing
 * and was added from a real false positive: `K-1 dialects` in REQUIREMENTS.md
 * otherwise matches with a captured count of `1`.
 */
const dialectCountPattern = /(?<![\w-])(\d+) (?:document )?dialects\b/g

const claimsIn = (text, pattern) => [...text.matchAll(pattern)].map(m => Number(m[1]))

test('every requirement is traced somewhere, and every traced ID has a body', () => {
    const { body, traced } = parseRequirements()
    assert.ok(body.size > 0, 'no requirements parsed -- the body pattern has drifted')
    const untraced = [...body.keys()].filter(id => !traced.has(id))
    assert.deepEqual(untraced, [], `requirements with no traceability row: ${untraced.join(', ')}`)
    const ghosts = [...traced].filter(id => !body.has(id))
    assert.deepEqual(ghosts, [], `traceability rows with no requirement body: ${ghosts.join(', ')}`)
})

test('no requirement is ticked in its body while its table Status says Pending', () => {
    const { body, statusByRequirement } = parseRequirements()
    const disagreements = [...body]
        .filter(([id, ticked]) =>
            statusByRequirement.has(id)
            && ticked
            && notDone.test(statusByRequirement.get(id)))
        .map(([id]) => `${id} (checkbox [x], Status "${statusByRequirement.get(id)}")`)
    assert.deepEqual(disagreements, [], `checkbox and traceability table disagree: ${disagreements.join('; ')}`)
})

test('no requirement is unticked in its body while its table Status says done', () => {
    const { body, statusByRequirement } = parseRequirements()
    const disagreements = [...body]
        .filter(([id, ticked]) =>
            statusByRequirement.has(id)
            && !ticked
            && /^(done|complete|verified)$/i.test(statusByRequirement.get(id)))
        .map(([id]) => `${id} (checkbox [ ], Status "${statusByRequirement.get(id)}")`)
    assert.deepEqual(disagreements, [], `checkbox and traceability table disagree: ${disagreements.join('; ')}`)
})

test('every documented MCP tool count equals what the server actually serves', () => {
    const wrong = planningDocuments().flatMap(({ name, text }) =>
        claimsIn(text, toolCountPattern)
            .filter(claimed => claimed !== expectedServedToolCount)
            .map(claimed => `${name} claims ${claimed} tools, server serves ${expectedServedToolCount}`))
    assert.deepEqual(wrong, [], wrong.join('; '))
})

test('every documented dialect count equals the schema registry', () => {
    const wrong = planningDocuments().flatMap(({ name, text }) =>
        claimsIn(text, dialectCountPattern)
            .filter(claimed => claimed !== knownDialects.length)
            .map(claimed => `${name} claims ${claimed} dialects, registry has ${knownDialects.length}`))
    assert.deepEqual(wrong, [], wrong.join('; '))
})

// ── Positive controls: each check above must be able to FAIL ───────────────
//
// A gate nobody has watched redden is a gate nobody knows works. These drive
// the same predicates over synthetic text with a known defect in it.

test('positive control: the checkbox-vs-Status predicate detects a disagreement', () => {
    const synthetic = ['- [x] **FAKE-01** *(T3)*: a ticked requirement.',
        '| FAKE-01 | T3 | Phase 99 - nowhere | Backlog | Pending |'].join('\n')
    const body = new Map(); const status = new Map()
    for (const line of synthetic.split('\n')) {
        const b = line.match(bodyPattern)
        if (b !== null) { body.set(b[2], b[1] === 'x') }
        const r = line.match(singleRowPattern)
        if (r !== null) { status.set(r[1], line.split('|').map(c => c.trim())[5] ?? '') }
    }
    assert.equal(body.get('FAKE-01'), true, 'the body pattern must parse the synthetic row')
    assert.ok(notDone.test(status.get('FAKE-01')), 'the Status pattern must recognise Pending')
})

test('positive control: the grouped-row pattern parses a multi-ID v2 row', () => {
    const row = '| DOC-22, DOC-23, TAX-33, TAX-34 | T3 | 29 - Equity Compensation | delivered |'
    const match = row.match(groupedRowPattern)
    assert.notEqual(match, null, 'the v2 grouped form must parse')
    assert.deepEqual(match[1].split(/, */), ['DOC-22', 'DOC-23', 'TAX-33', 'TAX-34'])
})

test('positive control: a wrong tool count in prose is detected', () => {
    assert.deepEqual(claimsIn('the server exposes **14 tools** today', toolCountPattern), [14])
})

test('negative control: `K-1 dialects` is not read as a dialect count', () => {
    assert.deepEqual(claimsIn('Part II lines 27-32 from both K-1 dialects', dialectCountPattern), [])
    assert.deepEqual(claimsIn('**26 document dialects**', dialectCountPattern), [26])
})
