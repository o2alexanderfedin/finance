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
// ── What this gate is ─────────────────────────────────────────────────────
//
// NOT a MAINT requirement. Phase 17 (PR #84) and Phase 18 (PR #87) both shipped
// on 2026-08-17 and closed MAINT-02..MAINT-08 between them. This file is the
// piece REQUIREMENTS.md asked for by name and that neither phase delivered:
// a standing check rather than a one-time correction.
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
// ## The REVERSE direction, and why it was the bigger hole
//
// Everything above reads REQUIREMENTS.md and asks whether the document is
// consistent with itself and with the code's own counts. Nothing asked the
// opposite question: **does an ID the code CITES exist at all?**
//
// It did not, four times. `TAX-36`, `TAX-37`, `TAX-38` and `TAX-39` were
// coined by four separate pieces of work as code-local handles and cited in
// 21 files under `fjs/**`, while the highest ID REQUIREMENTS.md traced was
// `TAX-35`. A reader following `TAX-39` out of `fjs/form7206/module.f.js`
// landed nowhere.
//
// `fjs/form6781/todo/section-1256-contracts-marked-to-market.md` names this
// gap in its own words -- "nothing checks the reverse direction, that an ID
// cited in `fjs/**` exists at all, and this is the gap that lets it happen"
// -- and the same file demonstrates the cost. Its author checked whether
// `TAX-38` was free with a grep "across every markdown file in the repo".
// Form 2441 had taken `TAX-38` three and a half hours earlier, in `.f.js`
// files a markdown-only grep cannot see, on a commit that was already an
// ancestor of the branch doing the checking. **The registry that would have
// answered that question is REQUIREMENTS.md, and this check is what forces
// the question to be asked there.** See TAX-38's own entry, which records the
// collision rather than tidying it away.
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
import { modeledKinds, unmodeledKindRefusals } from './fjs/return/scope/module.f.js'
import { tripwires } from './fjs/return/tripwire/module.f.js'

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

/**
 * Every `.planning/*.md` AND every root-level `*.md`, read once.
 *
 * The root files were added on the same day README.md gained "**13 tools**,
 * **26 document dialects**" — a claim surface that had not existed an hour
 * earlier. Scanning only `.planning/` would have left the front door as the
 * one document free to go stale, which is the position every other document
 * here was in before it drifted.
 */
const countedDocuments = () => [
    ...readdirSync(planningDir)
        .filter(name => name.endsWith('.md'))
        .map(name => ({ name: `.planning/${name}`, text: readFileSync(join(planningDir, name), 'utf8') })),
    ...readdirSync(repoRoot)
        .filter(name => name.endsWith('.md'))
        .map(name => ({ name, text: readFileSync(join(repoRoot, name), 'utf8') })),
    // `demo/` states the same counts to an AUDIENCE, which is the worst place
    // for them to be wrong. It was not scanned until 2026-08-18, and that is
    // precisely why "twelve tools" and "629 proofs" rotted there unnoticed
    // while every .planning/ copy stayed current. Prose and code both: the
    // step modules carry these numbers in comments and in rendered strings.
    ...['demo', join('demo', 'steps'), join('demo', 'lib')].flatMap(dir =>
        readdirSync(join(repoRoot, dir))
            .filter(name => name.endsWith('.md') || name.endsWith('.js') || name.endsWith('.html'))
            .map(name => ({
                name: `${dir}/${name}`,
                text: readFileSync(join(repoRoot, dir, name), 'utf8'),
            }))),
]

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

/**
 * The partition figures -- `54 modeled, 141 refused, 10 tripwires` -- are
 * scanned over a NARROWER set than the tool and dialect counts, and the
 * narrowing is the whole design rather than a convenience.
 *
 * `CHANGELOG.md:244` says "6 modeled kinds, 44 refused by", and
 * `.planning/ROADMAP.md:519` says "the 6/44 modeled partition". Both are
 * TRUE -- they record what was so when they were written, and a changelog
 * that gets rewritten as the code moves has stopped being a changelog. Only
 * two documents claim the partition as it stands TODAY, and those two are
 * what this reads.
 *
 * This gate did not exist until 2026-08-19, and its absence is why three
 * branches merged that day each wrote a different partition into these two
 * files with nothing complaining. When first run it found
 * `CAPABILITIES.md:110`'s "8 tripwires" against a live table of 10.
 */
const currentPartitionDocuments = () => ['CAPABILITIES.md', 'STATE.md']
    .map(name => ({
        name: `.planning/${name}`,
        text: readFileSync(join(planningDir, name), 'utf8'),
    }))

/** Finds `54 modeled` / `**54 modeled, 141 refused**`. */
const modeledCountPattern = /(?<![\w-])(\d+) modeled\b/g

/** Finds `141 refused`. */
const refusedCountPattern = /(?<![\w-])(\d+) refused\b/g

/** Finds `10 tripwires` / `**8 tripwires**`. */
const tripwireCountPattern = /(?<![\w-])(\d+) tripwires\b/g

const claimsIn = (text, pattern) => [...text.matchAll(pattern)].map(m => Number(m[1]))

// ── The reverse direction: an ID cited anywhere must have a requirement ────

/**
 * The ID prefixes REQUIREMENTS.md actually uses. **Hand-typed -- TEN of
 * them** -- and not derived from the document, for the reason AGENTS.md
 * states about `Object.keys` over the code under test: a vocabulary read out
 * of REQUIREMENTS.md would make this check's own coverage a function of the
 * file it is checking, so deleting every `TAX-*` requirement would silently
 * stop every `TAX-*` citation from being checked. `theCitationPrefix\
 * VocabularyIsExactlyWhatRequirementsUses` below asserts the two agree, which
 * is the `expectedThresholdCount` idiom: the hand-typed side is the
 * independent one, and a new prefix in the document has to be admitted here
 * on purpose.
 *
 * `DOCC` precedes `DOC` because JavaScript alternation is ordered, and
 * `DOC|DOCC` would try `DOC` first on `DOCC-01`. It backtracks and gets there
 * either way; the order makes that not need checking.
 */
const requirementPrefixes = [
    'DOCC', 'MAINT', 'EXACT', 'EXEC', 'PROV', 'TEST', 'TAX', 'DOC', 'MCP', 'SEC',
]

/** Hand-typed beside the list above, per AGENTS.md. */
const expectedRequirementPrefixCount = 10

/**
 * **What counts as a citation**, stated rather than left to the regex: one of
 * the ten prefixes above, a hyphen, and digits, not glued to a word on either
 * side.
 *
 * The prefix whitelist is what does the real work. `1099-B`, `W-2`, `K-1`,
 * `SSA-1099`, `SHA-256`, `UTF-8`, `RRB-1099`, and the ~50 fixture account
 * numbers (`ACC-0001`, `BUS-7206`, `PTR-0003`, `IRA-0002`, ...) are all
 * ID-shaped and all excluded by their prefix alone. Measured: over the whole
 * scanned set, an unconstrained `[A-Z]+-[0-9]+` finds 85 tokens with no
 * requirement behind them; this pattern finds four.
 *
 * **The two lookarounds are NOT symmetric, and the asymmetry is load-bearing
 * rather than an oversight.**
 *
 * - Leading `(?<![\w-])` is `toolCountPattern`'s own guard, and it keeps
 *   `SUBTAX-36` or `nonDOC-19` from reading as citations.
 * - Trailing `(?![\w])` deliberately does **not** exclude a following hyphen.
 *   A first draft used `(?![\w-])` for symmetry and dropped two real
 *   citations: `SEC-02-before-\`import_\`` in `fjs/server/response` (twice)
 *   and `EXEC-12-style` in `fjs-run-integration.test.js`. Both resolve today,
 *   so the symmetric version was green and wrong -- a false NEGATIVE, the
 *   direction a green suite cannot show you. The trailing `\w` guard still
 *   rejects `TAX-12a`, and nothing in the tree is `PREFIX-<digits><letter>`.
 */
const citationPattern = new RegExp(
    `(?<![\\w-])(?:${requirementPrefixes.join('|')})-[0-9]+(?![\\w])`, 'g')

/** Every distinct requirement ID cited in one document, in first-seen order. */
const citationsIn = text => [...new Set(text.match(citationPattern) ?? [])]

/** Every file under `dir`, recursively, whose name `keep` accepts. */
const readTree = (dir, keep) => readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = join(dir, entry.name)
    return entry.isDirectory()
        ? readTree(full, keep)
        : keep(entry.name)
            ? [{ name: full.slice(repoRoot.length), text: readFileSync(full, 'utf8') }]
            : []
})

/**
 * Everything whose requirement citations are a claim about the tree **as it
 * stands**: all of `fjs/**` (sources and the `todo/` specs beside them), the
 * root-level gate and integration suites, and -- through
 * `countedDocuments()` -- `demo/`, `.planning/*.md` and the root `*.md`
 * files.
 *
 * **`CHANGELOG.md` is the one exclusion**, for the reason
 * `currentPartitionDocuments()` gives about `6 modeled kinds, 44 refused`: a
 * changelog records what was true on the day it was written, and a check that
 * demands history be falsified when a requirement is later renamed is a check
 * that will be deleted. Stated honestly, the exclusion is **not load-bearing
 * today** -- every one of the eleven IDs CHANGELOG.md names still resolves --
 * unlike the partition one, which is. It is here so the first rename does not
 * have to argue with a gate.
 *
 * This file is inside its own scanned set. That is deliberate -- its prose
 * cites real IDs and they should resolve -- and it is why the positive
 * control below builds its fabricated ID by concatenation instead of writing
 * the literal.
 */
const citingSources = () => [
    ...readTree(join(repoRoot, 'fjs'), name => name.endsWith('.f.js') || name.endsWith('.md')),
    ...readdirSync(repoRoot)
        .filter(name => name.endsWith('.js'))
        .map(name => ({ name, text: readFileSync(join(repoRoot, name), 'utf8') })),
    ...countedDocuments().filter(({ name }) => name !== 'CHANGELOG.md'),
]

/** Measured 2026-08-19: 171. A floor, so a broken walk cannot pass silently. */
const minimumCitingSourceCount = 150

/**
 * A phase report states its status TWICE: once in frontmatter (`status:
 * passed`) and once in the body (`**Status:** passed`). Two statements of one
 * fact, in one file, and nothing compared them -- the same shape as
 * REQUIREMENTS.md's checkbox-versus-table drift this file already watches.
 *
 * It is not hypothetical. On 2026-08-20 two reports were found disagreeing
 * with themselves:
 *
 * - `13-VERIFICATION.md` -- frontmatter `passed` (updated when the manual-only
 *   item was discharged on 2026-08-17), body `human_needed` (never touched).
 *   Both true on their own day; both in the file at once for three days.
 * - `20-VERIFICATION.md` -- `gaps_found` in both places while the gap had been
 *   closed by `1697896` on the day the report was written.
 *
 * And then, while fixing exactly that, the fix updated 20's frontmatter and
 * left its body -- **recreating the defect inside the commit that repaired
 * it**. A one-off scan caught that, which is the whole argument for making the
 * scan a standing check instead of something someone remembers to run.
 *
 * The body form is compared on its FIRST WORD only: a body status is allowed
 * to carry an explanation after it (`passed -- 6 of 6 criteria met, ...`) and
 * routinely does. The frontmatter form carries no prose.
 */
const statusPairs = () => readTree(planningDir, name => name.endsWith('.md'))
    .flatMap(({ name, text }) => {
        if (!text.startsWith('---')) { return [] }
        const end = text.indexOf('\n---', 3)
        if (end === -1) { return [] }
        const front = text.slice(0, end)
        const body = text.slice(end)
        const declared = /^status: *(\S+)/m.exec(front)
        const stated = /^\*\*Status:\*\* *([A-Za-z_]+)/m.exec(body)
        return declared === null || stated === null
            ? []
            : [{ name, declared: declared[1].replace(/["']/g, ''), stated: stated[1] }]
    })

/** Measured 2026-08-20: 18. A floor, so a broken walk cannot pass silently. */
const minimumStatusPairCount = 12

test('no phase report disagrees with itself about its own status', () => {
    const pairs = statusPairs()
    assert.ok(pairs.length >= minimumStatusPairCount,
        `found ${pairs.length} frontmatter/body status pairs, expected at least ${minimumStatusPairCount}`)
    const disagreeing = pairs.filter(({ declared, stated }) => declared !== stated)
    assert.deepEqual(disagreeing, [],
        'a report whose frontmatter and body state different statuses; the newer edit updated one and not the other')
})

test('positive control: a report disagreeing with itself IS detected', () => {
    // Built by concatenation rather than written literally, for the reason
    // `citingSources()` gives: this file is inside its own scanned set.
    const front = ['---', 'phase: 99-synthetic', 'sta' + 'tus: passed', '---'].join('\n')
    const body = ['', '# Synthetic', '', '**Sta' + 'tus:** human_needed', ''].join('\n')
    const text = front + body
    const end = text.indexOf('\n---', 3)
    assert.notEqual(end, -1)
    assert.equal(/^status: *(\S+)/m.exec(text.slice(0, end))[1], 'passed')
    assert.equal(/^\*\*Status:\*\* *([A-Za-z_]+)/m.exec(text.slice(end))[1], 'human_needed')
})

test('negative control: an explanation after the body status is not a disagreement', () => {
    // `20-VERIFICATION.md` carries exactly this shape, and a whole-line
    // comparison would read it as a mismatch against a bare `passed`.
    const stated = /^\*\*Status:\*\* *([A-Za-z_]+)/m.exec(
        '\n**Status:** passed -- 6 of 6 criteria met. Read `gaps_found` until 2026-08-20.\n')
    assert.equal(stated[1], 'passed')
})

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

test('every requirement ID cited in the tree has a body in REQUIREMENTS.md', () => {
    const { body } = parseRequirements()
    assert.ok(body.size > 0, 'no requirements parsed -- the body pattern has drifted')
    const sources = citingSources()
    assert.ok(
        sources.length >= minimumCitingSourceCount,
        `only ${sources.length} files scanned -- the walk has broken, and an empty set passes everything`)
    const firstCitedIn = new Map()
    for (const { name, text } of sources) {
        for (const id of citationsIn(text)) {
            if (!firstCitedIn.has(id)) { firstCitedIn.set(id, name) }
        }
    }
    const dangling = [...firstCitedIn]
        .filter(([id]) => !body.has(id))
        .map(([id, name]) => `${id} (first cited in ${name})`)
        .sort()
    assert.deepEqual(dangling, [], `IDs cited with no requirement behind them: ${dangling.join('; ')}`)
})

test('the hand-typed citation prefixes are exactly the ones REQUIREMENTS.md uses', () => {
    const { body } = parseRequirements()
    const used = [...new Set([...body.keys()].map(id => id.slice(0, id.indexOf('-'))))].sort()
    assert.deepEqual(used, [...requirementPrefixes].sort(),
        'REQUIREMENTS.md uses a prefix this gate does not scan for, or vice versa')
    assert.equal(requirementPrefixes.length, expectedRequirementPrefixCount)
})

test('every documented MCP tool count equals what the server actually serves', () => {
    const wrong = countedDocuments().flatMap(({ name, text }) =>
        claimsIn(text, toolCountPattern)
            .filter(claimed => claimed !== expectedServedToolCount)
            .map(claimed => `${name} claims ${claimed} tools, server serves ${expectedServedToolCount}`))
    assert.deepEqual(wrong, [], wrong.join('; '))
})

test('every documented dialect count equals the schema registry', () => {
    const wrong = countedDocuments().flatMap(({ name, text }) =>
        claimsIn(text, dialectCountPattern)
            .filter(claimed => claimed !== knownDialects.length)
            .map(claimed => `${name} claims ${claimed} dialects, registry has ${knownDialects.length}`))
    assert.deepEqual(wrong, [], wrong.join('; '))
})

test('every documented modeled-kind count equals the scope registry', () => {
    const wrong = currentPartitionDocuments().flatMap(({ name, text }) =>
        claimsIn(text, modeledCountPattern)
            .filter(claimed => claimed !== modeledKinds.length)
            .map(claimed => `${name} claims ${claimed} modeled, registry has ${modeledKinds.length}`))
    assert.deepEqual(wrong, [], wrong.join('; '))
})

test('every documented refused-kind count equals the scope registry', () => {
    const wrong = currentPartitionDocuments().flatMap(({ name, text }) =>
        claimsIn(text, refusedCountPattern)
            .filter(claimed => claimed !== unmodeledKindRefusals.length)
            .map(claimed => `${name} claims ${claimed} refused, registry has ${unmodeledKindRefusals.length}`))
    assert.deepEqual(wrong, [], wrong.join('; '))
})

test('every documented tripwire count equals the tripwire table', () => {
    const wrong = currentPartitionDocuments().flatMap(({ name, text }) =>
        claimsIn(text, tripwireCountPattern)
            .filter(claimed => claimed !== tripwires.length)
            .map(claimed => `${name} claims ${claimed} tripwires, table has ${tripwires.length}`))
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

test('positive control: a wrong partition figure in prose is detected', () => {
    assert.deepEqual(claimsIn('**38 modeled, 76 refused**', modeledCountPattern), [38])
    assert.deepEqual(claimsIn('**38 modeled, 76 refused**', refusedCountPattern), [76])
    assert.deepEqual(claimsIn('so **8 tripwires** refuse when', tripwireCountPattern), [8])
})

test('negative control: a historical partition figure is out of the scanned set', () => {
    // `6/44 modeled` in ROADMAP.md and `6 modeled kinds, 44 refused` in
    // CHANGELOG.md are true of the day they were written. Neither file is in
    // `currentPartitionDocuments()`, and that is what keeps this gate from
    // demanding that history be falsified.
    assert.deepEqual(
        currentPartitionDocuments().map(d => d.name),
        ['.planning/CAPABILITIES.md', '.planning/STATE.md'])
    // And the scoping is doing real work rather than being belt-and-braces:
    // ROADMAP's slash form DOES match, capturing the denominator.
    assert.deepEqual(claimsIn('the 6/44 modeled partition as a `tsc` property', modeledCountPattern), [44])
})

test('positive control: an ID with no requirement behind it is detected', () => {
    // Built by concatenation on purpose. This file is inside `citingSources()`,
    // so a literal `TAX-<two digits that are not a requirement>` written here
    // would make the gate above redden on its own control -- the exact
    // self-reference the `FAKE-01` prefix avoids for the checkbox controls.
    const fabricated = `${'TAX'}-97`
    assert.deepEqual(citationsIn(`repointed at ${fabricated}, and never written down`), [fabricated])
    assert.equal(parseRequirements().body.has(fabricated), false)
})

test('negative control: text that merely LOOKS like an ID is not a citation', () => {
    // Every one of these appears in the scanned set today, and an
    // unconstrained `[A-Z]+-[0-9]+` reads all of them as requirement IDs.
    assert.deepEqual(citationsIn('Form 1099-B box 11, Form W-2 box 10, a K-1, SHA-256, UTF-8'), [])
    assert.deepEqual(citationsIn('subjects ACC-0001, BUS-7206, PTR-0003, IRA-0002 and NY-99'), [])
    // A whitelisted prefix glued to a longer word is not a citation either --
    // the `K-1 dialects` hazard `dialectCountPattern` documents, in ID shape.
    assert.deepEqual(citationsIn('a SUBTAX-36 and a nonDOC-19 and 1099-DOC-19'), [])
})

test('negative control: a range in prose reads as its endpoints, and a suffixed ID still reads', () => {
    // A range is two citations and never a third, invented, one.
    assert.deepEqual(citationsIn('a grep for TAX-30 through TAX-35'), ['TAX-30', 'TAX-35'])
    // And the asymmetric trailing guard: both of these are REAL citations in
    // the tree (`fjs/server/response/module.f.js`, `fjs-run-integration.test.js`)
    // that a symmetric `(?![\w-])` silently dropped.
    assert.deepEqual(citationsIn('SEC-02-before-`import_` and EXEC-12-style survival'), ['SEC-02', 'EXEC-12'])
})

test('negative control: CHANGELOG.md is out of the citing set, and fjs/** is in it', () => {
    const names = citingSources().map(({ name }) => name)
    assert.equal(names.includes('CHANGELOG.md'), false,
        'a changelog must stay free to name a requirement that was later renamed')
    assert.equal(names.includes('AGENTS.md'), true)
    assert.equal(names.includes('fjs/return/scope/module.f.js'), true)
    assert.equal(names.includes('fjs/form6781/todo/section-1256-contracts-marked-to-market.md'), true)
    assert.equal(names.includes('.planning/REQUIREMENTS.md'), true)
    assert.equal(names.some(name => name.startsWith('demo/')), true)
})
