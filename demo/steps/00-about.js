/**
 * Step 0 — what this is, why it exists, what it is built from, how it works,
 * and the three things it does not yet do.
 *
 * The boundaries are on the FIRST page rather than buried at the end. A
 * stakeholder will find them; hearing them from us costs one paragraph and
 * buys the rest of the demo its credibility.
 *
 * @module
 */
import { el, anchor, section, table, callout, code, note } from '../lib/dom.js'
import { sourceFooter, shortSha, release, sourceUrl, proofCount } from '../lib/github.js'
import { modeledKinds, kindVocabulary, unmodeledKindRefusals, tripwires } from '../lib/engine.js'

/** @import { Step } from '../demo.js' */

export const id = 'about'
export const kicker = 'Step 0'
export const title = 'What this is'
export const beat = 'A Form 1040 engine in which every figure carries the documents it came from and the rule it implements — and which refuses, loudly, when it is handed something it does not model.'
export const tier = 'must'

/** @type {Step['render']} */
export const render = root => {
    // ── The claim ────────────────────────────────────────────────────────────
    const claim = section('The claim')
    claim.append(el('p', {
        html: '<strong>Nothing on these pages is asserted.</strong> Every number you '
            + 'will see is computed in your browser by the shipped engine, and every '
            + 'one of them is one click from the code that produced it and the proof '
            + 'that tests it.',
    }))
    // The proof count is READ from `lib/github.js` rather than written here.
    // It is the declared single source of the release string and the proof
    // count, and a figure typed a second time is a figure that goes stale
    // without anyone noticing — which is exactly what happened to this
    // sentence between v0.12.0 and v1.0.0.
    claim.append(el('p', {
        text: 'This is not a slideshow of screenshots and it is not a mock. The pages '
            + `import the same modules that npm test runs ${proofCount} proofs against, `
            + 'and call them directly.',
    }))
    root.append(claim)

    // ── Why ──────────────────────────────────────────────────────────────────
    const why = section('Why')
    why.append(el('p', {
        text: 'Tax software gives you a number. When the number is wrong — or merely '
            + 'surprising — you cannot ask it where the number came from, and you '
            + 'cannot tell the difference between a figure it computed and a figure it '
            + 'guessed at because your situation was outside what it handles.',
    }))
    why.append(el('p', { html: 'This engine takes three positions on that:' }))
    const positions = el('ol')
    positions.append(el('li', {
        html: '<strong>A figure that cannot say where it came from cannot exist.</strong> '
            + 'Traceability is enforced by the type system, not by convention: a report '
            + 'line without its sources does not compile.',
    }))
    positions.append(el('li', {
        html: '<strong>Money is never a floating-point number.</strong> Stored as an exact '
            + 'decimal string, computed as integer cents, rounded once at the end, '
            + 'exactly where the instructions say to round.',
    }))
    positions.append(el('li', {
        html: '<strong>An input the engine does not model refuses the whole return.</strong> '
            + 'Not a partial 1040 with a suspicious zero on one line — no 1040 at all, '
            + 'and a message naming precisely what is missing and which form supplies it.',
    }))
    why.append(positions)
    why.append(callout('info', 'The third one is the product.',
        'Anyone can compute a tax. Knowing exactly when you must not is the harder half, '
        + 'and it is the half that decides whether a number can be relied on.'))
    root.append(why)

    // ── What it is built from ────────────────────────────────────────────────
    const stack = section('What it is built from')
    stack.append(el('p', {
        html: 'The engine is written in <strong>FunctionalScript</strong> — a pure subset '
            + 'of JavaScript with no side effects, no exceptions as control flow, and no '
            + 'host access. A module cannot read a file, open a socket or look at the '
            + 'clock, because the vocabulary to do so is not in the language it is '
            + 'written in.',
    }))
    stack.append(table(
        ['Layer', 'What it is', 'Why it matters here'],
        [
            ['Engine', 'Pure FunctionalScript modules under fjs/', 'Same code in Node, in a browser, and under test'],
            ['Effects', 'Requests as data, satisfied by a host map', 'What a program may do is a list you can read'],
            ['Storage', 'Content-addressed store (SHA-256) + revision log', 'A document\'s name is its content'],
            ['Interface', 'MCP server over stdio, thirteen tools', 'An assistant can drive it without a bespoke API'],
            ['Proofs', 'Every module exports its own proof object', 'Source and test are the same file'],
            ['This demo', 'Vanilla HTML, CSS and ES modules', 'Zero dependencies, zero build step, static hosting'],
        ],
    ))
    stack.append(note(
        'The demo adds no dependency of its own — not a framework, not a bundler, not a '
        + 'charting library. The repository forbids it, and the constraint turned out to '
        + 'cost nothing.'))
    root.append(stack)

    // ── How it works ─────────────────────────────────────────────────────────
    const how = section('How it works')
    how.append(el('p', { text: 'Four steps, in this order, every time:' }))
    const flow = el('ol')
    flow.append(el('li', {
        html: '<strong>Documents go in as they are.</strong> A W-2, a 1099-INT, a return '
            + 'profile — each stored as JSON in its own dialect, each addressed by the '
            + 'SHA-256 of its bytes.',
    }))
    // Both counts are read off the engine, never typed: this sentence said
    // "Six kinds are modeled; forty-four are refused by name" until 2026-08-18,
    // long after the split had moved to 38 and 76.
    flow.append(el('li', {
        html: '<strong>Scope is classified before anything is computed.</strong> The '
            + 'profile declares what kinds of income and deduction the return has. '
            + `${modeledKinds.length} kinds are modeled; ${unmodeledKindRefusals.length} `
            + 'are refused by name.',
    }))
    flow.append(el('li', {
        html: '<strong>Lines are computed in exact cents</strong>, each carrying the '
            + '(document, box) pairs it read and the printed rule it implements.',
    }))
    flow.append(el('li', {
        html: '<strong>Rounding happens once, at the end</strong>, over the whole return, '
            + 'and only if the taxpayer elected it.',
    }))
    how.append(flow)
    how.append(el('h4', { text: 'The scope vocabulary, in numbers' }))
    how.append(table(
        ['', 'Count', 'Meaning'],
        [
            ['Declared kinds in the vocabulary', { text: String(kindVocabulary.length), class: 'money' }, 'Every line of Form 1040 a return can declare'],
            ['Modeled today', { text: String(modeledKinds.length), class: 'money' }, 'Computed end to end, with proofs'],
            ['Refused by name', { text: String(unmodeledKindRefusals.length), class: 'money' }, 'Each names the 1040 line and the form that would supply it'],
            ['Tripwires', { text: String(tripwires.length), class: 'money' }, 'Refuse when the documents prove an obligation the profile never declared'],
        ],
    ))
    how.append(note(
        'All four counts are read from the engine at render time, not typed here. '
        + 'The vocabulary is frozen at the type level, so a kind outside it is a '
        + 'compile error rather than a silent pass — and modeled plus refused is a '
        + 'partition checked by tsc, so a kind belonging to neither fails the build.'))
    root.append(how)

    // ── The boundaries ───────────────────────────────────────────────────────
    const bounds = section(
        'Where the boundaries are',
        'Stated here, on the first page, so nothing later comes as a surprise.')
    // Two claims stood in this block until 2026-08-18 and both had been false
    // for some time. They are recorded rather than deleted, because a page
    // that quietly drops a caveat teaches a reader nothing, while a page that
    // says which caveat closed and when is checkable.
    bounds.append(callout('ok', 'Two boundaries this page used to name have closed.',
        'It said "form1040Report has no production caller — no server path produces a '
        + '1040 today". Phase 21 closed that: a stored guest program, executed by the '
        + 'real fjs_run tool in a separate OS process, computes a complete 1040 from '
        + 'documents added through evo_add, and a pinned rerun reproduces it byte for '
        + 'byte. It also said "the Schedule D branch is selected, then refuses"; Plan '
        + '12.1-04 closed that, and all four of line 16\'s methods compute — step 2 '
        + 'runs each of them in front of you.'))
    bounds.append(callout('warn', 'There is deliberately no "compute my 1040" tool.',
        'The thirteen MCP tools store documents, answer schema and parameter questions, '
        + 'and run a program. None of them is a finance_compute_1040, and the count has '
        + 'not moved through twelve phases on purpose: such a tool would let an assistant '
        + 'stop authoring the program, which is the one thing the architecture exists to '
        + 'prevent. This is a designed property, not a gap — but it does mean a 1040 '
        + 'arrives as the result of a program you can read, never as a black box.'))
    bounds.append(callout('warn', 'One tax year exists.',
        'Tax year 2025 only. The parameter table is keyed by year and every figure in it '
        + 'carries its own citation, so adding a year is transcription rather than '
        + 'redesign — but asking for any other year today is refused by name, and a '
        + 'document store mixing two tax years is refused rather than silently totalled.'))
    bounds.append(callout('warn', 'Some returns whose every declared kind is modeled still refuse.',
        'A nonqualified Roth distribution, a business LOSS, two Schedules SE, or two K-1s '
        + 'from one entity each stop the return rather than guess — the at-risk '
        + 'determination needs a multi-year basis history the store does not have, and '
        + 'netting two businesses is the arithmetic section 704(d) exists to stop. Each '
        + 'refusal names the form or the facts that would supply it.'))
    bounds.append(callout('warn', 'The sandbox claim is narrower than "it cannot reach the network".',
        'What is proven: a stored program asking for network access THROUGH the effect '
        + 'system is refused by name, and a disallowed import is refused before the '
        + 'module body runs. What is not defended: a program body that calls '
        + 'globalThis.fetch directly runs with host privileges. That is a recorded, '
        + 'accepted risk, written in the runner\'s own header — not something discovered '
        + 'while writing this page.'))
    root.append(bounds)

    // ── How to read the pages ────────────────────────────────────────────────
    const reading = section('How to read the rest')
    reading.append(el('p', {
        html: 'Use <strong>Next</strong>, the numbered tabs, or the ← → arrow keys. '
            + 'The last tab, <strong>All</strong>, puts every step on one scrolling '
            + 'page for questions.',
    }))
    reading.append(el('p', {
        html: `Every step ends with links into the repository, pinned to the `
            + `<strong>${release}</strong> release — commit <code>${shortSha}</code>. `
            + `The href carries the commit rather than the tag, because a tag can be `
            + `moved and a commit cannot, so the links keep resolving either way. The `
            + `badge at the top right opens that release, which states what is in it `
            + `and what is not.`,
    }))
    reading.append(code(
        '// the whole build system\n'
        + '<script type="importmap">\n'
        + '{ "imports": { "functionalscript/": "../functionalscript/" } }\n'
        + '</script>'))
    reading.append(note(
        'No bundler, no transpiler, no install. The browser loads the engine\'s modules '
        + 'directly — 108 of them behind one import, none importing anything from node:. '
        + 'That count was 43 when this page was written and was re-measured on '
        + '2026-08-18 by walking the import graph, not by guessing at the growth.'))
    root.append(reading)

    // Anchors re-resolved at v1.0.0 on 2026-08-18. They had drifted by more
    // than a thousand lines apiece, which is the failure mode a line anchor
    // has and a path does not: a wrong `#L` does not 404, it lands quietly in
    // the middle of something else.
    root.append(sourceFooter([
        { label: `fjs/return/scope — the ${modeledKinds.length} modeled and ${unmodeledKindRefusals.length} refused kinds`, path: 'fjs/return/scope/module.f.js', line: 474, proofLine: 1555 },
        { label: 'fjs/return/profile — the frozen kind vocabulary', path: 'fjs/return/profile/module.f.js', line: 126, proofLine: 1199 },
        { label: 'fjs/return/tripwire — the eight tripwires, in 1040 form order', path: 'fjs/return/tripwire/module.f.js', line: 348, proofLine: 785 },
        { label: 'fjs/form1040/core — the whole-return entry point', path: 'fjs/form1040/core/module.f.js', line: 2377, proofLine: 3758 },
        { label: 'tax-return-integration.test.js — a real 1040 through a real fjs_run process', path: 'tax-return-integration.test.js', line: 127 },
        { label: `CHANGELOG.md — what is in ${release}, and what is not`, path: 'CHANGELOG.md' },
        { label: 'AGENTS.md — the rules this codebase is held to', path: 'AGENTS.md' },
        { label: 'README.md', path: 'README.md' },
    ]))

    const repo = el('p', { class: 'note' })
    repo.append(anchor(sourceUrl(''), 'Browse the repository at this commit ↗'))
    root.append(repo)
}
