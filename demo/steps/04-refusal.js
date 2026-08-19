/**
 * Step 4 — Refusal. The product thesis in one gesture.
 *
 * Tick a kind of income this engine does not model and the WHOLE return
 * refuses. Not a partial 1040 with a suspicious zero on one line — no 1040 at
 * all, and a message naming what is missing and which form would supply it.
 *
 * The error arm of the outcome has no `lines` field, so there is nothing for a
 * renderer to draw. That is a type-level property, not a convention: adding a
 * partial line list back does not compile.
 *
 * @module
 */
import { el, input, section, table, callout, note, code } from '../lib/dom.js'
import { sourceFooter } from '../lib/github.js'
import { inputsDeclaring } from '../lib/fixtures.js'
import {
    form1040Report, ty2025, money, unmodeledKindRefusals, modeledKinds, kindVocabulary,
} from '../lib/engine.js'

/** @import { Step } from '../demo.js' */
/** @import { Kind } from '../../fjs/return/profile/module.f.js' */
/** @import { UnmodeledKind } from '../../fjs/return/scope/module.f.js' */

export const id = 'refusal'
export const kicker = 'Step 4'
export const title = 'Refusal'
export const beat = 'Declare one thing this engine does not model and the entire return refuses — naming what is missing, which line it belongs on, and which form supplies it.'
export const tier = 'must'

/** The kinds offered as toggles: the ones a stakeholder will actually ask about.
 * @type {readonly UnmodeledKind[]}
 */
const offered = [
    'unreportedTips',
    // `scheduleOneAdditionalIncome` — the coarse kind for the whole of
    // Schedule 1 Part I — was split into seven per-printed-line kinds in
    // Phase 27 (TAX-30) and no longer exists. `farmIncomeOrLoss` (Schedule 1
    // line 6, Schedule F) is its replacement here: a Part I line that is
    // still refused after that split, so this toggle still demonstrates the
    // same block of the same schedule. Deliberately NOT `businessIncomeOrLoss`
    // — that one is MODELED as of the same phase.
    'farmIncomeOrLoss',
    // `qualifiedBusinessIncomeDeduction` moved to `modeledKinds` in Phase 28
    // (TAX-32) — swapped for the §199A component that is STILL refused, so
    // this toggle keeps demonstrating the same deduction and the same 1040
    // line while naming something the engine genuinely cannot compute.
    //
    // Re-pointed again when the coarse REIT/PTP kind was SPLIT: its REIT
    // half now computes off 1099-DIV box 5, and only the PTP half is still
    // refused. Naming the half that is genuinely unreachable is the whole
    // point of this toggle — the pair would now be half a lie.
    'qualifiedPubliclyTradedPartnershipIncome',
    // `itemizedDeductions` moved to `modeledKinds` in Plan 13-07 (Phase 13
    // Wave 3, TAX-13) — swapped for `netQualifiedDisasterLoss`, its former
    // neighbor in the refusal table, which stays refused per Decision 1.4.
    'netQualifiedDisasterLoss',
    // `childTaxCreditOrOtherDependents`/`additionalChildTaxCredit` moved to
    // `modeledKinds` in Plan 13-10 (Phase 13 Wave 4, TAX-12) — swapped for
    // two of Decision 1.4's five permanently-refused kinds, so this toggle
    // list never needs re-pointing again for the rest of the phase.
    'medicaidWaiverPayments',
    'otherEarnedIncome',
]

/**
 * The refusal-table entry for a kind.
 * @type {(kind: string) => typeof unmodeledKindRefusals[number] | undefined}
 */
const refusalFor = kind => unmodeledKindRefusals.find(entry => entry.kind === kind)

/** @type {Step['render']} */
export const render = root => {
    const live = section(
        'Declare something outside what the engine models',
        'The sample return from the previous step, unchanged, plus whatever you tick below.')

    /** @type {readonly Kind[]} */
    let declared = []
    const output = el('div')

    const recompute = () => {
        const outcome = form1040Report(ty2025)(inputsDeclaring(declared))
        output.replaceChildren()
        if (outcome.kind === 'ok') {
            const line37 = outcome.lines.find(line => line.rule === '1040 line 37')
            const line34 = outcome.lines.find(line => line.rule === '1040 line 34')
            const row = el('div', { class: 'figure-row' })
            row.append(el('span', { class: 'method', text: 'return produced' }))
            row.append(el('span', {
                class: 'big-figure',
                text: line34 !== undefined && line34.value > 0n
                    ? `${money(line34.value)} overpaid`
                    : `${money(line37 === undefined ? 0n : line37.value)} owed`,
            }))
            output.append(row)
            output.append(callout('ok', `${outcome.lines.length} lines, computed.`,
                `Line 16 was priced by ${outcome.line16Method}. Every line carries its `
                + 'sources. This is a complete return.'))
            return
        }
        const row = el('div', { class: 'figure-row' })
        row.append(el('span', { class: 'method refuses', text: 'no return produced' }))
        output.append(row)
        output.append(callout('stop', 'The engine declines to file this return.', outcome.message))
        output.append(el('h4', { text: 'What it named, and what would supply it' }))
        output.append(table(
            ['Unmodeled input', 'Belongs on', 'What it needs'],
            outcome.unmodeled.map(kind => {
                const entry = refusalFor(kind)
                return [
                    { text: kind, class: 'mono' },
                    entry === undefined ? '—' : entry.line,
                    entry === undefined ? '—' : entry.remedy,
                ]
            }),
        ))
        output.append(note(
            'There is no partial 1040 behind this message. The refusing outcome has no '
            + 'line list at all — not an empty one — so a caller cannot render a form '
            + 'of zeros and mistake it for a finished return.'))
    }

    const toggles = el('div', { class: 'checks' })
    for (const kind of offered) {
        const entry = refusalFor(kind)
        const label = el('label')
        label.title = entry === undefined ? '' : `${entry.label} — ${entry.line}`
        const box = input()
        box.type = 'checkbox'
        box.addEventListener('change', () => {
            label.classList.toggle('on', box.checked)
            declared = box.checked
                ? [...declared, kind]
                : declared.filter(other => other !== kind)
            recompute()
        })
        label.append(box, el('span', { text: entry === undefined ? kind : entry.label }))
        toggles.append(label)
    }
    live.append(toggles)
    live.append(output)
    root.append(live)

    // ── Why the whole return ─────────────────────────────────────────────────
    const why = section('Why the WHOLE return, and not just that line')
    why.append(el('p', {
        html: 'The rejected alternative was a per-line refusal inside a returned report. '
            + 'It is more informative for a developer — and it ships a document that '
            + '<strong>looks like a 1040</strong> while being incomplete. That is '
            + 'exactly the failure this exists to prevent.',
    }))
    why.append(code(
        '// the error arm has no `lines` field at all\n'
        + '{ kind: \'ok\',    lines: ReportLine[], line16Method }\n'
        + '{ kind: \'error\', message, unmodeled: UnmodeledKind[] }'))
    why.append(el('p', {
        text: 'Scope is classified before any line is computed. Not one figure is '
            + 'produced for a return the engine cannot finish — so there is nothing '
            + 'half-computed lying around to be picked up by mistake.',
    }))
    root.append(why)

    // ── The vocabulary ───────────────────────────────────────────────────────
    const vocabulary = section(
        'The full refusal table',
        `Every one of the ${unmodeledKindRefusals.length} kinds the engine declines, in Form 1040 order, each naming its line and its remedy. Read from the engine, not typed here.`)
    vocabulary.append(table(
        ['Declared kind', 'Belongs on', 'What it needs'],
        unmodeledKindRefusals.map(entry => [
            { text: entry.kind, class: 'mono' },
            entry.line,
            entry.remedy,
        ]),
    ))
    vocabulary.append(note(
        `${modeledKinds.length} modeled + ${unmodeledKindRefusals.length} refused `
        + `= ${kindVocabulary.length} kinds in the vocabulary. That the two partitions `
        + 'exactly cover it is checked by the compiler: a kind that is neither modeled '
        + 'nor refused is a build error, so a new line of the 1040 cannot be silently '
        + 'ignored.'))
    root.append(vocabulary)

    const closing = section('The point')
    closing.append(el('p', {
        html: 'Software that computes a tax is common. Software that knows exactly when '
            + 'it must not, and says so in terms a preparer can act on, is the part '
            + 'that decides whether the number can be relied on at all.',
    }))
    root.append(closing)

    root.append(sourceFooter([
        { label: 'fjs/return/scope — classification and the one place a refusal is built', path: 'fjs/return/scope/module.f.js', line: 474, proofLine: 1555 },
        { label: `fjs/return/scope — the ${unmodeledKindRefusals.length}-entry refusal table`, path: 'fjs/return/scope/module.f.js', line: 623 },
        { label: 'fjs/form1040/core — the guard runs before any line is computed', path: 'fjs/form1040/core/module.f.js', line: 2377, proofLine: 3758 },
        { label: 'fjs/return/profile — the frozen kind vocabulary', path: 'fjs/return/profile/module.f.js', line: 126, proofLine: 1199 },
    ]))

    recompute()
}
