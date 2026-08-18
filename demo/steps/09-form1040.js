/**
 * Step 9 — the Form 1040, drawn as the IRS prints it.
 *
 * Both pages, in printed line order, with the printed line numbers and the
 * printed labels, amounts in a ruled right-hand column with their own cents
 * sub-column. No PDF, no image, no web font, no network request of any kind:
 * a strict CSP would refuse them and a laptop with no wifi is the environment
 * this has to survive. Everything below is CSS over elements.
 *
 * **Every amount is a button, and clicking it opens that line's citations
 * directly underneath the line.** That is not a decoration on top of the form
 * — it is the entire thesis of the project rendered in the one layout a
 * taxpayer already knows how to read. A form face without the citations is a
 * screenshot; a citation list without the form face is a database dump. The
 * point is that they are the same object.
 *
 * ## Two things that are deliberately not hardcoded
 *
 * **The amounts.** Every figure comes from `form1040Report` called on the
 * sample return, in this browser, at render time. Not one of the 56 is typed
 * in this file: the only digits below are printed line numbers, the printed
 * labels' own cross-references to other forms, and source-link anchors.
 *
 * **The mapping from a printed row to an amount.** {@link pageOneBands} and
 * {@link pageTwoBands} name the engine line each box holds, and after both pages are drawn the two sets
 * are compared in BOTH directions: a printed row naming a line the engine did
 * not produce, or an engine line no printed row claimed, draws a loud failure
 * panel instead of quietly rendering a form with a hole in it. This is the
 * hand-typed-count idiom AGENTS.md describes, in DOM form — a table derived
 * from `outcome.lines` could never notice `outcome.lines` shrinking.
 *
 * ## Where the printed text comes from
 *
 * The line numbers and labels are hand-transcribed. The transcription this
 * repository already verified against `f1040.pdf` — both pages, read in full
 * — is `10-RESEARCH.md`'s line-by-line table, and it is the authority for
 * every line number here and for the content of every label. That includes
 * the three ways the 2025 face differs from 2024, each visible below: lines
 * **11a** and **11b** (AGI stated at the foot of page 1 and restated at the
 * head of page 2, which is where the page break falls), the lettered
 * deduction block ending at **12e**, and **13b** for Schedule 1-A's new
 * deductions.
 *
 * **What that table does NOT carry is sub-line cross-references**, and those
 * have been DROPPED rather than reconstructed from memory of an earlier
 * year's form: line 1e reads "from Form 2441" and not "from Form 2441, line
 * 26", and likewise 1f, 1g, 29 and 30. Where the verified table does give the
 * cross-reference — Schedule 1 line 10, Schedule 1 line 26, Schedule 1-A line
 * 38, Schedule 2 lines 3 and 21, Schedule 3 lines 8 and 15 — it is printed.
 * A plausible-looking sub-line number is the most expensive kind of error on
 * a page like this, because it is the one a reader would never think to
 * check.
 *
 * The remaining reconstructions are the arithmetic captions, taken from the
 * engine's own operation rather than from the page: lines 1z, 9, 11a, 14, 15,
 * 18, 21, 22, 24, 25d, 32, 33, 34 and 37 describe exactly what
 * `form1040/core` computes for them. They are labelled here so the next
 * person to hold the printed form beside this page knows which strings to
 * check first.
 *
 * @module
 */
import { el, button, section, table, callout, note } from '../lib/dom.js'
import { sourceFooter } from '../lib/github.js'
import { inputs, documentLabel } from '../lib/fixtures.js'
import {
    form1040Report, ty2025, money, moneyParts, shortAddress, individualFilingStatuses,
} from '../lib/engine.js'

/** @import { Step } from '../demo.js' */
/** @import { ReportLine } from '../../fjs/report/line/module.f.js' */

export const id = 'form1040'
export const kicker = 'Step 9'
export const title = 'The Form 1040'
export const beat = 'Both pages of the printed form, filled by the engine, in the layout a taxpayer already knows. Click any amount and the documents it came from open under the line.'
export const tier = 'must'

/**
 * One printed row of the form face.
 *
 * - `line` names the engine line whose amount belongs in this row's box. A
 *   row with one gets a clickable amount box; a row without gets an empty
 *   ruled box, which on the paper form is exactly what it is.
 * - `check` marks the rows the form prints as a checkbox rather than a money
 *   box — line 6c's lump-sum election, line 7b's "Schedule D not required",
 *   the four dependency and age/blindness boxes at 12a-12d, and the deposit
 *   routing block at 35b-35d. The engine emits no amount for any of them
 *   because there is no amount to emit.
 * - `sub` indents the row, the way the printed form indents the `a`/`b` pairs
 *   under a parent line.
 * @typedef {{
 *   readonly n: string,
 *   readonly label: string,
 *   readonly line?: string,
 *   readonly check?: true,
 *   readonly sub?: true,
 * }} PrintedRow
 */

/**
 * A run of printed rows under one of the form's own left-margin band labels
 * ("Income", "Tax and Credits", "Refund", …).
 * @typedef {{ readonly band: string, readonly rows: readonly PrintedRow[] }} Band
 */

/**
 * Page 1: the income block, ending at line 11a — adjusted gross income — which
 * is where the 2025 face breaks.
 * @type {readonly Band[]}
 */
const pageOneBands = [
    {
        band: 'Income',
        rows: [
            { n: '1a', label: 'Total amount from Form(s) W-2, box 1 (see instructions)', line: '1a' },
            { n: '1b', label: 'Household employee wages not reported on Form(s) W-2', line: '1b' },
            { n: '1c', label: 'Tip income not reported on line 1a (see instructions)', line: '1c' },
            { n: '1d', label: 'Medicaid waiver payments not reported on Form(s) W-2 (see instructions)', line: '1d' },
            { n: '1e', label: 'Taxable dependent care benefits from Form 2441', line: '1e' },
            { n: '1f', label: 'Employer-provided adoption benefits from Form 8839', line: '1f' },
            { n: '1g', label: 'Wages from Form 8919', line: '1g' },
            { n: '1h', label: 'Other earned income (see instructions)', line: '1h' },
            { n: '1i', label: 'Nontaxable combat pay election (see instructions)', line: '1i' },
            { n: '1z', label: 'Add lines 1a through 1h', line: '1z' },
            { n: '2a', label: 'Tax-exempt interest', line: '2a', sub: true },
            { n: '2b', label: 'Taxable interest', line: '2b', sub: true },
            { n: '3a', label: 'Qualified dividends', line: '3a', sub: true },
            { n: '3b', label: 'Ordinary dividends', line: '3b', sub: true },
            { n: '4a', label: 'IRA distributions', line: '4a', sub: true },
            { n: '4b', label: 'Taxable amount', line: '4b', sub: true },
            { n: '5a', label: 'Pensions and annuities', line: '5a', sub: true },
            { n: '5b', label: 'Taxable amount', line: '5b', sub: true },
            { n: '6a', label: 'Social security benefits', line: '6a', sub: true },
            { n: '6b', label: 'Taxable amount', line: '6b', sub: true },
            { n: '6c', label: 'If you elect to use the lump-sum election method, check here', check: true, sub: true },
            { n: '7a', label: 'Capital gain or (loss). Attach Schedule D if required', line: '7a' },
            { n: '7b', label: 'If not required, check here', check: true, sub: true },
            { n: '8', label: 'Additional income from Schedule 1, line 10', line: '8' },
            { n: '9', label: 'Add lines 1z, 2b, 3b, 4b, 5b, 6b, 7a, and 8. This is your total income', line: '9' },
            { n: '10', label: 'Adjustments to income from Schedule 1, line 26', line: '10' },
            { n: '11a', label: 'Subtract line 10 from line 9. This is your adjusted gross income', line: '11a' },
        ],
    },
]

/**
 * Page 2: the deduction block the 2025 face moved here, then the tax, the
 * credits, the payments, and the refund or the amount owed.
 * @type {readonly Band[]}
 */
const pageTwoBands = [
    {
        band: 'Standard Deduction',
        rows: [
            { n: '11b', label: 'Amount from line 11a (adjusted gross income)', line: '11b' },
            { n: '12a', label: 'Check if: Someone can claim you as a dependent', check: true, sub: true },
            { n: '12b', label: 'Someone can claim your spouse as a dependent', check: true, sub: true },
            { n: '12c', label: 'Spouse itemizes on a separate return or you were a dual-status alien', check: true, sub: true },
            { n: '12d', label: 'Age/Blindness: you or your spouse were born before January 2, 1961, or are blind', check: true, sub: true },
            { n: '12e', label: 'Standard deduction or itemized deductions (from Schedule A)', line: '12e' },
            { n: '13a', label: 'Qualified business income deduction from Form 8995 or Form 8995-A', line: '13a' },
            { n: '13b', label: 'Additional deductions from Schedule 1-A, line 38', line: '13b' },
            { n: '14', label: 'Add lines 12, 13a, and 13b', line: '14' },
            { n: '15', label: 'Subtract line 14 from line 11b. If zero or less, enter -0-. This is your taxable income', line: '15' },
        ],
    },
    {
        band: 'Tax and Credits',
        rows: [
            { n: '16', label: 'Tax (see instructions). Check if any from Form(s): 1 8814, 2 4972, 3 other', line: '16' },
            { n: '17', label: 'Amount from Schedule 2, line 3', line: '17' },
            { n: '18', label: 'Add lines 16 and 17', line: '18' },
            { n: '19', label: 'Child tax credit or credit for other dependents from Schedule 8812', line: '19' },
            { n: '20', label: 'Amount from Schedule 3, line 8', line: '20' },
            { n: '21', label: 'Add lines 19 and 20', line: '21' },
            { n: '22', label: 'Subtract line 21 from line 18. If zero or less, enter -0-', line: '22' },
            { n: '23', label: 'Other taxes, including self-employment tax, from Schedule 2, line 21', line: '23' },
            { n: '24', label: 'Add lines 22 and 23. This is your total tax', line: '24' },
        ],
    },
    {
        band: 'Payments',
        rows: [
            { n: '25a', label: 'Federal income tax withheld from Form(s) W-2', line: '25a', sub: true },
            { n: '25b', label: 'Federal income tax withheld from Form(s) 1099', line: '25b', sub: true },
            { n: '25c', label: 'Federal income tax withheld from other forms (see instructions)', line: '25c', sub: true },
            { n: '25d', label: 'Add lines 25a through 25c', line: '25d', sub: true },
            { n: '26', label: '2025 estimated tax payments and amount applied from 2024 return', line: '26' },
            { n: '27a', label: 'Earned income credit (EIC)', line: '27a', sub: true },
            { n: '28', label: 'Additional child tax credit from Schedule 8812', line: '28', sub: true },
            { n: '29', label: 'American opportunity credit from Form 8863', line: '29', sub: true },
            { n: '30', label: 'Refundable adoption credit from Form 8839', line: '30', sub: true },
            { n: '31', label: 'Amount from Schedule 3, line 15', line: '31', sub: true },
            { n: '32', label: 'Add lines 27a, 28, 29, 30, and 31. These are your total other payments and refundable credits', line: '32' },
            { n: '33', label: 'Add lines 25d, 26, and 32. These are your total payments', line: '33' },
        ],
    },
    {
        band: 'Refund',
        rows: [
            { n: '34', label: 'If line 33 is more than line 24, subtract line 24 from line 33. This is the amount you overpaid', line: '34' },
            { n: '35a', label: 'Amount of line 34 you want refunded to you. If Form 8888 is attached, check here', line: '35a' },
            { n: '35b', label: 'Routing number', check: true, sub: true },
            { n: '35c', label: 'Type: Checking or Savings', check: true, sub: true },
            { n: '35d', label: 'Account number', check: true, sub: true },
            { n: '36', label: 'Amount of line 34 you want applied to your 2026 estimated tax', line: '36' },
        ],
    },
    {
        band: 'Amount You Owe',
        rows: [
            { n: '37', label: 'Subtract line 33 from line 24. This is the amount you owe', line: '37' },
            { n: '38', label: 'Estimated tax penalty (see instructions)' },
        ],
    },
]

/**
 * The printed labels for the five filing-status boxes.
 *
 * Hand-typed against the printed form, and checked below against the engine's
 * own `individualFilingStatuses` in BOTH directions — a status the engine
 * knows and this list forgot would otherwise render a form face with a box
 * missing and nothing to say so.
 * @type {readonly (readonly [string, string])[]}
 */
const filingStatusBoxes = [
    ['single', 'Single'],
    ['marriedFilingJointly', 'Married filing jointly (MFJ)'],
    ['marriedFilingSeparately', 'Married filing separately (MFS)'],
    ['headOfHousehold', 'Head of household (HOH)'],
    ['qualifyingSurvivingSpouse', 'Qualifying surviving spouse (QSS)'],
]

/**
 * The engine's line number for a report line's rule.
 *
 * Line 16's rule carries the METHOD that priced it — `1040 line 16 (Tax
 * Computation Worksheet)` — so the trailing parenthetical is stripped rather
 * than matched around. Step 3 learned this the expensive way: matching on
 * equality silently dropped the most interesting row on the page.
 * @type {(rule: string) => string}
 */
const lineNumberOf = rule => rule.replace(/^1040 line /, '').replace(/ \(.*\)$/, '')

/** A printed line number with a `$` box, split out of a page's bands.
 * @type {(bands: readonly Band[]) => readonly string[]}
 */
const claimedLines = bands =>
    bands.flatMap(band => band.rows.flatMap(row => row.line === undefined ? [] : [row.line]))

/**
 * A person's name split the way the form prints it: given names in one box,
 * surname in the next.
 *
 * `employeeName` is OPTIONAL on the W-2 dialect — box e is not one of the
 * fields the engine needs to compute anything — so the absent case draws two
 * empty boxes rather than inventing a placeholder. An empty box on a form is
 * honest; "Unknown Taxpayer" is not.
 * @type {(full: string | undefined) => { readonly first: string, readonly last: string }}
 */
const nameBoxes = full => {
    if (full === undefined) { return { first: '', last: '' } }
    const cut = full.lastIndexOf(' ')
    return cut < 0
        ? { first: full, last: '' }
        : { first: full.slice(0, cut), last: full.slice(cut + 1) }
}

/**
 * A captioned entry box, the way the header block of the form prints one: a
 * ruled cell with its caption in small type above the value.
 *
 * The column span goes on as a CLASS rather than an inline style, so the
 * narrow-screen rules in `demo.css` can drop the whole grid to a single
 * column without fighting an inline declaration — and so this file emits no
 * style attribute at all, which keeps the page honest under a content
 * security policy that forbids inline style.
 * @type {(caption: string, value: string, span?: 1 | 2 | 3 | 4) => HTMLElement}
 */
const entryBox = (caption, value, span = 1) => {
    const box = el('div', { class: `f1040-entry f1040-span-${span}` })
    box.append(el('span', { class: 'f1040-caption', text: caption }))
    box.append(el('span', { class: 'f1040-value', text: value }))
    return box
}

/** A single printed checkbox with its label. @type {(label: string, on: boolean) => HTMLElement} */
const checkBox = (label, on) => {
    const wrap = el('span', { class: on ? 'f1040-check f1040-check-on' : 'f1040-check' })
    wrap.append(el('span', { class: 'f1040-box', text: on ? '✕' : '' }))
    wrap.append(el('span', { text: label }))
    return wrap
}

/** @type {Step['render']} */
export const render = root => {
    const outcome = form1040Report(ty2025)(inputs)

    if (outcome.kind === 'error') {
        root.append(callout('stop', 'The sample return did not compute, so there is no form to draw.', outcome.message))
        return
    }

    /** Every computed line, by printed line number. @type {Map<string, ReportLine>} */
    const byNumber = new Map(outcome.lines.map(line => [lineNumberOf(line.rule), line]))

    // ── The two-way coverage check ───────────────────────────────────────────
    //
    // AGENTS.md's fourth shipped defect was a proof whose iteration set came
    // from the code under test, so it could never notice that set shrinking.
    // The same trap is available to a form renderer: build the rows FROM
    // `outcome.lines` and a line that stops being produced simply stops being
    // drawn, on a page whose whole claim is that it prints the whole form.
    // So the rows are hand-typed, and the two sets are compared both ways.
    const claimed = [...claimedLines(pageOneBands), ...claimedLines(pageTwoBands)]
    const missingFromEngine = claimed.filter(number => !byNumber.has(number))
    const missingFromForm = [...byNumber.keys()].filter(number => !claimed.includes(number))
    if (missingFromEngine.length !== 0 || missingFromForm.length !== 0) {
        root.append(callout('stop', 'The printed form and the engine disagree about which lines exist.',
            `Printed rows naming a line the engine did not produce: ${missingFromEngine.join(', ') || 'none'}. `
            + `Engine lines no printed row claimed: ${missingFromForm.join(', ') || 'none'}. `
            + 'The form is not drawn, because a form face with a silent hole in it is worse '
            + 'than no form face.'))
        return
    }
    const statusesKnown = individualFilingStatuses.filter(
        status => !filingStatusBoxes.some(([name]) => name === status))
    if (statusesKnown.length !== 0) {
        root.append(callout('stop', 'The filing-status boxes do not cover the engine\'s filing statuses.',
            `Missing from the printed block: ${statusesKnown.join(', ')}.`))
        return
    }

    // ── The fixture's header facts ───────────────────────────────────────────
    const profile = inputs.profile.value
    const primary = inputs.w2s[0]
    const secondary = inputs.w2s[1]
    if (primary === undefined) {
        root.append(callout('stop', 'The sample return has no W-2 to name a taxpayer from.', ''))
        return
    }
    const you = nameBoxes(primary.value.employeeName)
    const spouse = secondary === undefined ? undefined : nameBoxes(secondary.value.employeeName)

    // ── The detail panel, moved under whichever line was clicked ─────────────
    const detail = el('div', { class: 'f1040-detail' })
    /** @type {HTMLElement | undefined} */
    let selected = undefined
    /** @type {(line: ReportLine, box: HTMLElement) => void} */
    const openDetail = (line, box) => {
        if (selected !== undefined) { selected.classList.remove('f1040-amt-open') }
        selected = box
        box.classList.add('f1040-amt-open')
        detail.replaceChildren()
        const head = el('div', { class: 'f1040-detail-head' })
        head.append(el('strong', { text: line.rule }))
        head.append(el('span', { class: 'money', text: money(line.value) }))
        detail.append(head)
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
            + 'The raw value column is the text exactly as it sits in the stored document — '
            + 'not re-formatted, not re-rounded, not re-parsed for display.'))
        // The panel is ONE node, moved. Two panels open at once would let a
        // reader compare a line number against the wrong citation list.
        const owner = box.parentElement
        if (owner !== null) { owner.after(detail) }
    }

    /** One printed row. @type {(row: PrintedRow) => HTMLElement} */
    const printedRow = row => {
        const node = el('div', { class: row.sub === true ? 'f1040-row f1040-row-sub' : 'f1040-row' })
        node.append(el('span', { class: 'f1040-n', text: row.n }))
        node.append(el('span', { class: 'f1040-label', text: row.label }))
        if (row.check === true) {
            // The printed form gives these rows a box to tick, not a box to
            // write a figure in. Drawing an amount box here — even an empty
            // one — would invite the reading that a number is missing.
            const cell = el('span', { class: 'f1040-amt f1040-amt-check' })
            cell.append(el('span', { class: 'f1040-box' }))
            node.append(cell)
            return node
        }
        const found = row.line === undefined ? undefined : byNumber.get(row.line)
        if (found === undefined) {
            node.append(el('span', { class: 'f1040-amt f1040-amt-empty' }))
            return node
        }
        const parts = moneyParts(found.value)
        const box = button('', { class: found.value === 0n ? 'f1040-amt f1040-amt-zero' : 'f1040-amt' })
        box.append(el('span', { class: 'f1040-dollars', text: `${parts.sign}${parts.dollars}` }))
        box.append(el('span', { class: 'f1040-cents', text: parts.cents }))
        box.title = `${found.rule} — ${found.sources.length} source${found.sources.length === 1 ? '' : 's'}`
        box.addEventListener('click', () => openDetail(found, box))
        node.append(box)
        return node
    }

    /** One band of rows under its left-margin label. @type {(band: Band) => HTMLElement} */
    const printedBand = band => {
        const node = el('div', { class: 'f1040-band' })
        node.append(el('div', { class: 'f1040-band-name', text: band.band }))
        const rows = el('div', { class: 'f1040-band-rows' })
        for (const row of band.rows) { rows.append(printedRow(row)) }
        node.append(rows)
        return node
    }

    /** The masthead both pages carry. @type {(page: number) => HTMLElement} */
    const masthead = page => {
        const node = el('div', { class: 'f1040-masthead' })
        const left = el('div', { class: 'f1040-mast-left' })
        left.append(el('span', { class: 'f1040-caption', text: 'Department of the Treasury—Internal Revenue Service' }))
        left.append(el('span', { class: 'f1040-mast-form', text: 'Form 1040' }))
        node.append(left)
        const middle = el('div', { class: 'f1040-mast-mid' })
        middle.append(el('span', { class: 'f1040-mast-title', text: 'U.S. Individual Income Tax Return' }))
        middle.append(el('span', { class: 'f1040-caption', text: `Page ${page} of 2` }))
        node.append(middle)
        const right = el('div', { class: 'f1040-mast-right' })
        right.append(el('span', { class: 'f1040-mast-year', text: String(profile.taxYear) }))
        right.append(el('span', { class: 'f1040-caption', text: 'OMB No. 1545-0074' }))
        node.append(right)
        return node
    }

    // ── Page 1 ───────────────────────────────────────────────────────────────
    const form = el('div', { class: 'f1040' })
    const one = el('div', { class: 'f1040-page' })
    one.append(masthead(1))

    const status = el('div', { class: 'f1040-status' })
    status.append(el('span', { class: 'f1040-caption', text: 'Filing Status — check only one box' }))
    const statusBoxes = el('div', { class: 'f1040-checks' })
    for (const [name, label] of filingStatusBoxes) {
        statusBoxes.append(checkBox(label, name === profile.filingStatus))
    }
    status.append(statusBoxes)
    one.append(status)

    const who = el('div', { class: 'f1040-grid' })
    who.append(entryBox('Your first name and middle initial', you.first, 2))
    who.append(entryBox('Last name', you.last, 2))
    who.append(entryBox('Your social security number', primary.value.recipientTin, 2))
    if (spouse !== undefined && secondary !== undefined) {
        who.append(entryBox('If joint return, spouse\'s first name and middle initial', spouse.first, 2))
        who.append(entryBox('Last name', spouse.last, 2))
        who.append(entryBox('Spouse\'s social security number', secondary.value.recipientTin, 2))
    }
    who.append(entryBox('Home address (number and street). If you have a P.O. box, see instructions', '', 4))
    who.append(entryBox('Apt. no.', '', 2))
    who.append(entryBox('City, town, or post office. If you have a foreign address, also complete spaces below', '', 4))
    who.append(entryBox('State', '', 1))
    who.append(entryBox('ZIP code', '', 1))
    one.append(who)

    const digital = el('div', { class: 'f1040-question' })
    digital.append(el('span', {
        text: 'Digital assets: At any time during 2025, did you receive, sell, exchange, or '
            + 'otherwise dispose of a digital asset (or a financial interest in a digital asset)?',
    }))
    const digitalBoxes = el('div', { class: 'f1040-checks' })
    digitalBoxes.append(checkBox('Yes', false))
    digitalBoxes.append(checkBox('No', false))
    digital.append(digitalBoxes)
    one.append(digital)

    const dependents = el('div', { class: 'f1040-question' })
    dependents.append(el('span', {
        text: `Dependents (see instructions) — the return profile declares ${profile.dependentCount}, `
            + 'so the grid the form prints here is empty.',
    }))
    one.append(dependents)

    for (const band of pageOneBands) { one.append(printedBand(band)) }
    form.append(one)

    // ── Page 2 ───────────────────────────────────────────────────────────────
    const two = el('div', { class: 'f1040-page' })
    two.append(masthead(2))
    for (const band of pageTwoBands) { two.append(printedBand(band)) }

    const sign = el('div', { class: 'f1040-sign' })
    sign.append(el('span', { class: 'f1040-caption', text: 'Sign Here' }))
    sign.append(el('span', {
        text: 'Under penalties of perjury, I declare that I have examined this return and '
            + 'accompanying schedules and statements, and to the best of my knowledge and belief, '
            + 'they are true, correct, and complete.',
    }))
    const signGrid = el('div', { class: 'f1040-grid' })
    signGrid.append(entryBox('Your signature', '', 3))
    signGrid.append(entryBox('Date', '', 1))
    signGrid.append(entryBox('Your occupation', '', 2))
    signGrid.append(entryBox('Spouse\'s signature. If a joint return, BOTH must sign', '', 3))
    signGrid.append(entryBox('Date', '', 1))
    signGrid.append(entryBox('Spouse\'s occupation', '', 2))
    sign.append(signGrid)
    two.append(sign)
    form.append(two)

    // ── The page around the form ─────────────────────────────────────────────
    const lede = section(
        'Dana and Ray Okafor, married filing jointly, tax year 2025',
        'The same return step 3 lists as 56 lines, drawn as the form it actually is. Click any amount.')
    lede.append(el('p', {
        html: 'The amounts are computed here, now, by <code>form1040Report</code> — the same '
            + 'entry point the server reaches through a stored guest program. Nothing on this '
            + 'page is a fixture except the taxpayer\'s own documents, and the header block is '
            + 'filled from those: the names and the taxpayer identification numbers come off the '
            + 'two W-2s, and the filing status off the return profile.',
    }))
    lede.append(callout('info', 'An empty box is structure, never a computed zero.',
        'The boxes with no amount are the rows the printed form carries and the engine emits '
        + 'nothing for — the routing number, the lump-sum election, the dependency checkboxes, '
        + 'line 38\'s estimated tax penalty. A computed zero looks different: it is a real 0.00 '
        + 'in the box, dimmed, and it cites its sources like every other line. That distinction '
        + 'is the one a tax form usually destroys.'))
    lede.append(el('p', {
        html: `Every amount below is a button. The form has ${outcome.lines.length} filled boxes `
            + 'and every one of them opens the documents it was computed from, which is the '
            + 'whole argument: a form face is only worth as much as its ability to answer '
            + '"where did that come from?".',
    }))
    root.append(lede)
    root.append(form)

    const method = el('div', { class: 'figure-row' })
    method.append(el('span', { class: 'kicker', text: 'Line 16 computed by' }))
    method.append(el('span', { class: 'method', text: outcome.line16Method }))
    root.append(method)

    const reading = section('What this layout is, and what it is not')
    reading.append(el('p', {
        html: '<strong>There is no PDF here.</strong> No embedded document, no image, no web '
            + 'font, no request of any kind — the page runs under a strict content security '
            + 'policy and works with the network unplugged. What you are looking at is elements '
            + 'and CSS: a grid with the line number in a narrow left column, the printed label '
            + 'in the middle, and a ruled amount box on the right with its own cents sub-column, '
            + 'because that is how the paper prints money.',
    }))
    reading.append(el('p', {
        html: 'It is <strong>not</strong> a filing-quality reproduction and does not claim to be. '
            + 'The typography is the reader\'s own system font, the margins are not the IRS\'s, '
            + 'and no OMB-approved substitute form was submitted for approval. It is a layout '
            + 'chosen because it is the one layout that needs no explaining.',
    }))
    reading.append(callout('ok', 'The rows are hand-typed on purpose.',
        'Deriving the printed rows from the engine\'s own output would make this page unable to '
        + 'notice a line disappearing — the exact defect AGENTS.md records shipping four times. '
        + 'So the printed line numbers are written out here and compared against the engine\'s '
        + 'in both directions before anything is drawn. Delete a line from the engine and this '
        + 'page refuses to render a form; add one and it says which one it did not expect.'))
    root.append(reading)

    root.append(sourceFooter([
        { label: 'fjs/form1040/core — lines 1a-37 and the whole-return entry point', path: 'fjs/form1040/core/module.f.js', line: 2377, proofLine: 3758 },
        { label: 'fjs/report/line — the ReportLine type, whose sources are a non-empty tuple', path: 'fjs/report/line/module.f.js', line: 1, proofLine: 182 },
        { label: 'fjs/tax/line16 — which of the four methods priced line 16', path: 'fjs/tax/line16/module.f.js', line: 197, proofLine: 580 },
        { label: 'tax-return-integration.test.js — the same entry point through a real fjs_run process', path: 'tax-return-integration.test.js', line: 127 },
    ]))
}
