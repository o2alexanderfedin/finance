/**
 * Step 3 — the whole return, lines 1a through 37.
 *
 * The beat: click any line and it tells you which documents it read, which box
 * of each, the raw value at that box, and the printed rule it implements.
 * There is no line on this page that cannot answer that question, because a
 * line that could not would not compile.
 *
 * @module
 */
import { el, section, table, callout, note, code } from '../lib/dom.js'
import { sourceFooter } from '../lib/github.js'
import { inputs, documentLabel } from '../lib/fixtures.js'
import { form1040Report, ty2025, money, shortAddress } from '../lib/engine.js'

/** @import { Step } from '../demo.js' */
/** @import { ReportLine } from '../../fjs/report/line/module.f.js' */

export const id = 'return'
export const kicker = 'Step 3'
export const title = 'The Return'
export const beat = 'Fifty-six printed lines. Click one to see the documents it read, the boxes it read them from, and the rule it implements.'
export const tier = 'must'

/** @type {Step['render']} */
export const render = root => {
    const outcome = form1040Report(ty2025)(inputs)

    if (outcome.kind === 'error') {
        root.append(callout('stop', 'The sample return did not compute.', outcome.message))
        return
    }

    // ── Headline ─────────────────────────────────────────────────────────────
    const headline = section(
        'Dana and Ray Okafor, married filing jointly, tax year 2025',
        'Computed here, in this browser, from the five documents on the previous step.')

    // Line 16's rule carries the method that produced it — `1040 line 16 (Tax
    // Computation Worksheet)` — so these are matched by PREFIX. Matching on
    // equality silently dropped the most important row on this page.
    /** @type {(rule: string) => ReportLine | undefined} */
    const find = rule => outcome.lines.find(line => line.rule.startsWith(rule))
    /** @type {readonly (readonly [string, string])[]} */
    const highlights = [
        ['1040 line 1z', 'Total wages'],
        ['1040 line 2b', 'Taxable interest'],
        ['1040 line 11a', 'Adjusted gross income'],
        ['1040 line 12e', 'Standard deduction'],
        ['1040 line 15', 'Taxable income'],
        ['1040 line 16', 'Tax'],
        ['1040 line 33', 'Total payments'],
        ['1040 line 34', 'Overpaid'],
        ['1040 line 37', 'Amount you owe'],
    ]
    headline.append(table(
        ['Line', 'What it is', 'Amount'],
        highlights.flatMap(([rule, label]) => {
            const line = find(rule)
            return line === undefined
                ? []
                : [[
                    { text: line.rule.replace('1040 ', ''), class: 'mono' },
                    label,
                    { text: money(line.value), class: 'money' },
                ]]
        }),
    ))
    const method = el('div', { class: 'figure-row' })
    method.append(el('span', { class: 'kicker', text: 'Line 16 computed by' }))
    method.append(el('span', { class: 'method', text: outcome.line16Method }))
    headline.append(method)
    headline.append(note(
        'This return\'s taxable income is above $100,000, so the printed Tax Table does '
        + 'not reach it and the Tax Computation Worksheet takes over. The engine chose '
        + 'that; nothing on this page told it to.'))
    root.append(headline)

    // ── The full form ────────────────────────────────────────────────────────
    const full = section(
        `All ${outcome.lines.length} lines`,
        'Click any line. Lines at zero are dimmed, and they cite their sources too — a zero the engine computed is not the same as a zero nobody looked at.')

    const detail = el('div')
    /** @type {(line: ReportLine) => void} */
    const showDetail = line => {
        detail.replaceChildren()
        const panel = el('div', { class: 'callout callout-info' })
        panel.append(el('strong', { text: `${line.rule} — ${money(line.value)}` }))
        detail.append(panel)
        detail.append(table(
            ['Document', 'CAS address', 'Box', 'Raw value as stored'],
            line.sources.map(source => [
                documentLabel(source.documentHash),
                { text: shortAddress(source.documentHash), class: 'mono' },
                { text: source.boxPath, class: 'mono' },
                { text: source.value, class: 'mono' },
            ]),
        ))
        detail.append(note(
            `${line.sources.length} citation${line.sources.length === 1 ? '' : 's'}. `
            + 'The raw value column is the text exactly as it sits in the stored '
            + 'document — not re-formatted, not re-rounded, not re-parsed for display.'))
    }

    const rows = outcome.lines.map(line => {
        const tr = el('tr', { class: line.value === 0n ? 'zero clickable' : 'clickable' })
        const rule = el('td', { class: 'mono' })
        rule.textContent = line.rule.replace('1040 ', '')
        const value = el('td', { class: 'money' })
        value.textContent = money(line.value)
        const cites = el('td', { class: 'dim' })
        cites.textContent = `${line.sources.length} source${line.sources.length === 1 ? '' : 's'}`
        tr.append(rule, value, cites)
        tr.addEventListener('click', () => {
            for (const other of rows) { other.classList.remove('selected') }
            tr.classList.add('selected')
            showDetail(line)
        })
        return tr
    })

    const wrap = el('div', { class: 'table-wrap' })
    const node = el('table')
    const thead = el('thead')
    const headRow = el('tr')
    for (const header of ['Line', 'Amount', 'Traceability']) {
        headRow.append(el('th', { text: header }))
    }
    thead.append(headRow)
    const tbody = el('tbody')
    tbody.append(...rows)
    node.append(thead, tbody)
    wrap.append(node)
    full.append(wrap)
    full.append(detail)
    root.append(full)

    // Open on line 2b, which is the most interesting citation on the return:
    // two boxes of one document plus one box of another.
    const opening = find('1040 line 2b')
    if (opening !== undefined) {
        const index = outcome.lines.indexOf(opening)
        const openingRow = rows[index]
        if (openingRow !== undefined) { openingRow.classList.add('selected') }
        showDetail(opening)
    }

    // ── Why the type says so ─────────────────────────────────────────────────
    const typed = section('A line without its sources does not compile')
    typed.append(el('p', {
        html: 'Traceability here is not a convention anyone has to remember. It is the '
            + 'type of a report line, and <code>sources</code> is a <em>non-empty '
            + 'tuple</em> — so an empty list fails to typecheck just as an omitted '
            + 'field does.',
    }))
    typed.append(code(
        '/** @typedef {{\n'
        + ' *   readonly value: bigint,\n'
        + ' *   readonly sources: readonly [Source, ...(readonly Source[])],\n'
        + ' *   readonly rule: string,\n'
        + ' * }} ReportLine */'))
    typed.append(el('p', {
        html: 'The module also carries a compile-time assertion that a value with '
            + '<code>value</code> and <code>rule</code> but no <code>sources</code> '
            + '<strong>does not</strong> satisfy <code>ReportLine</code>. That '
            + 'assertion was verified the only way such a thing can be: by widening the '
            + 'field, watching the build break, and putting it back.',
    }))
    typed.append(callout('ok', 'Line 2b cites three boxes across two documents.',
        'Boxes 1 and 3 of the Treasury 1099-INT both feed taxable interest, and so does '
        + 'box 1 of the savings 1099-INT. Box 8 — tax-exempt interest — does not, and '
        + 'goes to line 2a instead. A spreadsheet that sums a column called "interest" '
        + 'gets this wrong.'))
    root.append(typed)

    root.append(sourceFooter([
        { label: 'fjs/form1040/core — lines 1a-37 and the whole-return entry point', path: 'fjs/form1040/core/module.f.js', line: 2377, proofLine: 3758 },
        { label: 'fjs/report/line — the ReportLine type and its negative assertion', path: 'fjs/report/line/module.f.js', line: 1, proofLine: 182 },
        { label: 'fjs/tax/deduction — the standard deduction chart, 19 combinations', path: 'fjs/tax/deduction/module.f.js', line: 215, proofLine: 648 },
        { label: 'fjs/tax/line16 — which method priced line 16', path: 'fjs/tax/line16/module.f.js', line: 197, proofLine: 580 },
    ]))
}
