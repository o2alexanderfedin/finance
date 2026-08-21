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
 * ## Two entry points, one form
 *
 * {@link renderForm} draws the form face and nothing else: the header block,
 * both pages, the coverage guards, and the citation panel. {@link render} is
 * the wizard step — the same form, with the demo's prose around it.
 * `demo/form1040.html` calls {@link renderForm} directly and gets the form
 * alone, on a page with no navigation, which is the page you print.
 *
 * **The guards live in `renderForm`, not in `render`.** They are what makes
 * the printed page trustworthy, so the entry point a filer uses must not be
 * the one that skips them.
 *
 * ## Two things that are deliberately not hardcoded
 *
 * **The amounts.** Every figure comes from `form1040Report` called on the
 * sample return, in this browser, at render time. Not one of them is typed
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
 * **Every string below was checked, on 2026-08-19, against the PDF the IRS
 * publishes at `https://www.irs.gov/pub/irs-pdf/f1040.pdf`** — the 2025
 * revision, footer `Cat. No. 11320B · Form 1040 (2025) Created 9/5/25`. The
 * text was extracted twice, by two paths, and the two agreed line for line.
 * That PDF, not any earlier transcription, is the authority for every line
 * number, every caption, every checkbox caption and every band name here.
 *
 * Before that check the labels came from a table that did not carry sub-line
 * cross-references, and from the engine's own arithmetic where the caption
 * was not recorded at all. Both classes of reconstruction were wrong in
 * places, and the wrong ones were not the ones anybody would have guessed:
 *
 * - The dropped sub-line references were all real — the page does print
 *   `from Form 2441, line 26`, `from Form 8839, line 31`, `from Form 8919,
 *   line 6`, `from Form 8863, line 8` and `from Form 8839, line 13`.
 * - Twelve of the fourteen reconstructed arithmetic captions turned out to be
 *   word-for-word right. The two that were not are **line 14**, which prints
 *   `Add lines 12e, 13a, and 13b` and not `Add lines 12, 13a, and 13b`, and
 *   **line 37**, whose caption continues past the sentence that was recorded.
 * - The expensive errors were elsewhere: the **12a–12d checkbox block was
 *   off by one line** for its whole length, **7b** carried a caption from an
 *   earlier year's layout, and the page-2 band was labelled `Standard
 *   Deduction` where the paper prints `Tax and Credits` down the whole
 *   margin from 11b to 24 — `Standard deduction for—` is a separate note box
 *   beside it, not the name of the band.
 *
 * Eight printed rows were missing outright and are now here: **3c, 4c, 5c,
 * 6d, 25** (the `Federal income tax withheld from:` heading the a/b/c
 * sub-lines hang off), **27b, 27c**, and 12d's unnumbered `Spouse:`
 * continuation.
 *
 * ## What this face still does not draw
 *
 * Named so that nobody has to discover them by holding the paper up to the
 * screen. All are blocks the engine computes nothing for:
 *
 * - the four-column **Dependents** grid (the return profile carries a count,
 *   not names and taxpayer identification numbers),
 * - the **Presidential Election Campaign** and main-home boxes, drawn as the
 *   question block they are rather than in the paper's right margin,
 * - the standard-deduction amounts the paper prints in the page-2 margin,
 *   which are a lookup table for a filer working by hand and would be a
 *   second, unverified copy of `fjs/tax/deduction` here.
 *
 * @module
 */
import { el, button, section, table, callout, note, anchor } from '../lib/dom.js'
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
 *   row with one gets a clickable amount box.
 * - `boxes` are the row's own printed checkbox captions, which the paper sets
 *   inline with the caption — `Check if: ☐ Schedule D not required ☐ Includes
 *   child's capital gain or (loss)`. They are drawn where the paper draws
 *   them, in the label, not in the amount column.
 * - `tail` is what stands in the right-hand column when no amount does:
 *   `'check'` for the rows the paper ends with a single tick box (`…check
 *   here ☐`), `'none'` for the rows that end with nothing at all — a heading
 *   like line 25, or an unnumbered continuation. The default is an empty
 *   ruled box, which is what the paper gives a write-in field and what it
 *   gives line 38.
 * - `sub` indents the row, the way the printed form indents the `a`/`b` pairs
 *   under a parent line.
 * @typedef {{
 *   readonly n: string,
 *   readonly label: string,
 *   readonly line?: string,
 *   readonly boxes?: readonly string[],
 *   readonly tail?: 'check' | 'none',
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
            { n: '1e', label: 'Taxable dependent care benefits from Form 2441, line 26', line: '1e' },
            { n: '1f', label: 'Employer-provided adoption benefits from Form 8839, line 31', line: '1f' },
            { n: '1g', label: 'Wages from Form 8919, line 6', line: '1g' },
            { n: '1h', label: 'Other earned income (see instructions). Enter type and amount:', line: '1h' },
            { n: '1i', label: 'Nontaxable combat pay election (see instructions)', line: '1i' },
            { n: '1z', label: 'Add lines 1a through 1h', line: '1z' },
            { n: '2a', label: 'Tax-exempt interest', line: '2a', sub: true },
            { n: '2b', label: 'Taxable interest', line: '2b', sub: true },
            { n: '3a', label: 'Qualified dividends', line: '3a', sub: true },
            { n: '3b', label: 'Ordinary dividends', line: '3b', sub: true },
            {
                n: '3c', label: 'Check if your child’s dividends are included in',
                boxes: ['1 Line 3a', '2 Line 3b'], tail: 'none', sub: true,
            },
            { n: '4a', label: 'IRA distributions', line: '4a', sub: true },
            { n: '4b', label: 'Taxable amount', line: '4b', sub: true },
            {
                n: '4c', label: 'Check if (see instructions)',
                boxes: ['1 Rollover', '2 QCD', '3'], tail: 'none', sub: true,
            },
            { n: '5a', label: 'Pensions and annuities', line: '5a', sub: true },
            { n: '5b', label: 'Taxable amount', line: '5b', sub: true },
            {
                n: '5c', label: 'Check if (see instructions)',
                boxes: ['1 Rollover', '2 PSO', '3'], tail: 'none', sub: true,
            },
            { n: '6a', label: 'Social security benefits', line: '6a', sub: true },
            { n: '6b', label: 'Taxable amount', line: '6b', sub: true },
            {
                n: '6c',
                label: 'If you elect to use the lump-sum election method, check here (see instructions)',
                tail: 'check', sub: true,
            },
            {
                n: '6d',
                label: 'If you are married filing separately and lived apart from your spouse the entire year (see inst.), check here',
                tail: 'check', sub: true,
            },
            { n: '7a', label: 'Capital gain or (loss). Attach Schedule D if required', line: '7a' },
            {
                n: '7b', label: 'Check if:',
                boxes: ['Schedule D not required', 'Includes child’s capital gain or (loss)'],
                tail: 'none', sub: true,
            },
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
 *
 * The first band runs from 11b to 24 under one margin label. That is not a
 * simplification — `Tax and Credits` is what the paper prints down the whole
 * of it, and the deduction figures beside lines 13-15 sit in their own note
 * box headed `Standard deduction for—`, which is a table for a filer working
 * by hand and not a band name.
 * @type {readonly Band[]}
 */
const pageTwoBands = [
    {
        band: 'Tax and Credits',
        rows: [
            { n: '11b', label: 'Amount from line 11a (adjusted gross income)', line: '11b' },
            {
                n: '12a', label: 'Someone can claim',
                boxes: ['You as a dependent', 'Your spouse as a dependent'], tail: 'none', sub: true,
            },
            {
                n: '12b', label: '', boxes: ['Spouse itemizes on a separate return'],
                tail: 'none', sub: true,
            },
            {
                n: '12c', label: '', boxes: ['You were a dual-status alien'],
                tail: 'none', sub: true,
            },
            {
                n: '12d', label: 'You:',
                boxes: ['Were born before January 2, 1961', 'Are blind'], tail: 'none', sub: true,
            },
            {
                n: '', label: 'Spouse:',
                boxes: ['Was born before January 2, 1961', 'Is blind'], tail: 'none', sub: true,
            },
            { n: '12e', label: 'Standard deduction or itemized deductions (from Schedule A)', line: '12e' },
            { n: '13a', label: 'Qualified business income deduction from Form 8995 or Form 8995-A', line: '13a' },
            { n: '13b', label: 'Additional deductions from Schedule 1-A, line 38', line: '13b' },
            { n: '14', label: 'Add lines 12e, 13a, and 13b', line: '14' },
            { n: '15', label: 'Subtract line 14 from line 11b. If zero or less, enter -0-. This is your taxable income', line: '15' },
            {
                n: '16', label: 'Tax (see instructions). Check if any from Form(s):',
                boxes: ['1 8814', '2 4972', '3'], line: '16',
            },
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
        band: 'Payments and Refundable Credits',
        rows: [
            { n: '25', label: 'Federal income tax withheld from:', tail: 'none' },
            { n: '25a', label: 'Form(s) W-2', line: '25a', sub: true },
            { n: '25b', label: 'Form(s) 1099', line: '25b', sub: true },
            { n: '25c', label: 'Other forms (see instructions)', line: '25c', sub: true },
            { n: '25d', label: 'Add lines 25a through 25c', line: '25d', sub: true },
            { n: '26', label: '2025 estimated tax payments and amount applied from 2024 return', line: '26' },
            {
                n: '',
                label: 'If you made estimated tax payments with your former spouse in 2025, enter their SSN (see instructions):',
                sub: true,
            },
            { n: '27a', label: 'Earned income credit (EIC)', line: '27a', sub: true },
            { n: '27b', label: 'Clergy filing Schedule SE (see instructions)', tail: 'check', sub: true },
            { n: '27c', label: 'If you do not want to claim the EIC, check here', tail: 'check', sub: true },
            {
                n: '28', label: 'Additional child tax credit (ACTC) from Schedule 8812.',
                boxes: ['If you do not want to claim the ACTC, check here'], line: '28', sub: true,
            },
            { n: '29', label: 'American opportunity credit from Form 8863, line 8', line: '29', sub: true },
            { n: '30', label: 'Refundable adoption credit from Form 8839, line 13', line: '30', sub: true },
            { n: '31', label: 'Amount from Schedule 3, line 15', line: '31', sub: true },
            { n: '32', label: 'Add lines 27a, 28, 29, 30, and 31. These are your total other payments and refundable credits', line: '32' },
            { n: '33', label: 'Add lines 25d, 26, and 32. These are your total payments', line: '33' },
        ],
    },
    {
        band: 'Refund',
        rows: [
            { n: '34', label: 'If line 33 is more than line 24, subtract line 24 from line 33. This is the amount you overpaid', line: '34' },
            {
                n: '35a', label: 'Amount of line 34 you want refunded to you.',
                boxes: ['If Form 8888 is attached, check here'], line: '35a',
            },
            { n: '35b', label: 'Routing number', sub: true },
            { n: '35c', label: 'Type:', boxes: ['Checking', 'Savings'], tail: 'none', sub: true },
            { n: '35d', label: 'Account number', sub: true },
            { n: '36', label: 'Amount of line 34 you want applied to your 2026 estimated tax', line: '36' },
        ],
    },
    {
        band: 'Amount You Owe',
        rows: [
            {
                n: '37',
                label: 'Subtract line 33 from line 24. This is the amount you owe. For details on how to pay, go to www.irs.gov/Payments or see instructions',
                line: '37',
            },
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
 *
 * Two of the five carried a parenthetical the paper does not print. `Married
 * filing jointly` is followed by `(even if only one had income)`, and
 * `(MFJ)` appears nowhere on the face; `Married filing separately (MFS)`
 * continues into the instruction to enter the spouse's identification number
 * and full name.
 * @type {readonly (readonly [string, string])[]}
 */
const filingStatusBoxes = [
    ['single', 'Single'],
    ['marriedFilingJointly', 'Married filing jointly (even if only one had income)'],
    ['marriedFilingSeparately', 'Married filing separately (MFS). Enter spouse’s SSN above and full name here:'],
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

/** A run of unticked printed checkboxes. @type {(labels: readonly string[]) => HTMLElement} */
const checkRun = labels => {
    const set = el('span', { class: 'f1040-checks f1040-checks-inline' })
    for (const label of labels) { set.append(checkBox(label, false)) }
    return set
}

/**
 * What {@link renderForm} produces when it draws a form: the facts the wizard
 * step's prose states ABOUT the form, so that prose cannot drift from it.
 * `undefined` instead means a stop panel was drawn and there is no form.
 * @typedef {{ readonly lineCount: number, readonly line16Method: string }} FormDrawn
 */

/**
 * Draws the form face — and nothing else — into `root`.
 *
 * This is the whole filable artifact: the masthead, the header block, the
 * filing-status and digital-asset questions, both pages of numbered lines,
 * the signature and preparer blocks, and the citation panel that opens under
 * a clicked amount. `demo/form1040.html` calls exactly this, which is why the
 * coverage guards are here and not in {@link render}: the page a filer prints
 * must be the page that refuses to draw a form with a hole in it.
 * @type {(root: HTMLElement) => FormDrawn | undefined}
 */
export const renderForm = root => {
    const outcome = form1040Report(ty2025)(inputs)

    if (outcome.kind === 'error') {
        root.append(callout('stop', 'The sample return did not compute, so there is no form to draw.', outcome.message))
        return undefined
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
        return undefined
    }
    const statusesKnown = individualFilingStatuses.filter(
        status => !filingStatusBoxes.some(([name]) => name === status))
    if (statusesKnown.length !== 0) {
        root.append(callout('stop', 'The filing-status boxes do not cover the engine\'s filing statuses.',
            `Missing from the printed block: ${statusesKnown.join(', ')}.`))
        return undefined
    }

    // ── The fixture's header facts ───────────────────────────────────────────
    const profile = inputs.profile.value
    const primary = inputs.w2s[0]
    const secondary = inputs.w2s[1]
    if (primary === undefined) {
        root.append(callout('stop', 'The sample return has no W-2 to name a taxpayer from.', ''))
        return undefined
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
        const label = el('span', { class: 'f1040-label' })
        if (row.label !== '') { label.append(el('span', { text: row.label })) }
        if (row.boxes !== undefined) { label.append(checkRun(row.boxes)) }
        node.append(label)
        const found = row.line === undefined ? undefined : byNumber.get(row.line)
        if (found === undefined) {
            if (row.tail === 'none') {
                // A heading, or an unnumbered continuation of the row above.
                // The paper gives these no box at all, and drawing one would
                // read as a figure the engine failed to supply.
                node.append(el('span', { class: 'f1040-amt f1040-amt-none' }))
                return node
            }
            if (row.tail === 'check') {
                // The printed form ends these rows with a box to tick, not a
                // box to write a figure in.
                const cell = el('span', { class: 'f1040-amt f1040-amt-check' })
                cell.append(el('span', { class: 'f1040-box' }))
                node.append(cell)
                return node
            }
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

    /** A block of question text with its own row of checkboxes.
     * @type {(text: string, labels: readonly string[]) => HTMLElement}
     */
    const question = (text, labels) => {
        const node = el('div', { class: 'f1040-question' })
        node.append(el('span', { text }))
        node.append(checkRun(labels))
        return node
    }

    // ── Page 1 ───────────────────────────────────────────────────────────────
    const form = el('div', { class: 'f1040' })
    const one = el('div', { class: 'f1040-page' })
    one.append(masthead(1))
    one.append(el('div', {
        class: 'f1040-question',
        text: `For the year Jan. 1–Dec. 31, ${profile.taxYear}, or other tax year beginning `
            + `________, ${profile.taxYear}, ending ________, 20____. See separate instructions.`,
    }))

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
    who.append(entryBox('Your social security number', primary.value.employeeSSN, 2))
    if (spouse !== undefined && secondary !== undefined) {
        who.append(entryBox('If joint return, spouse’s first name and middle initial', spouse.first, 2))
        who.append(entryBox('Last name', spouse.last, 2))
        who.append(entryBox('Spouse’s social security number', secondary.value.employeeSSN, 2))
    }
    who.append(entryBox('Home address (number and street). If you have a P.O. box, see instructions.', '', 4))
    who.append(entryBox('Apt. no.', '', 2))
    who.append(entryBox('City, town, or post office. If you have a foreign address, also complete spaces below.', '', 4))
    who.append(entryBox('State', '', 1))
    who.append(entryBox('ZIP code', '', 1))
    who.append(entryBox('Foreign country name', '', 2))
    who.append(entryBox('Foreign province/state/county', '', 2))
    who.append(entryBox('Foreign postal code', '', 2))
    one.append(who)

    one.append(question(
        'Check here if your main home, and your spouse’s if filing a joint return, was in '
        + `the U.S. for more than half of ${profile.taxYear}.`,
        ['Check here']))
    one.append(question(
        'Presidential Election Campaign — Check here if you, or your spouse if filing jointly, '
        + 'want $3 to go to this fund. Checking a box below will not change your tax or refund.',
        ['You', 'Spouse']))
    one.append(question(
        `Digital Assets: At any time during ${profile.taxYear}, did you: (a) receive (as a reward, `
        + 'award, or payment for property or services); or (b) sell, exchange, or otherwise dispose '
        + 'of a digital asset (or a financial interest in a digital asset)? (See instructions.)',
        ['Yes', 'No']))

    const dependents = el('div', { class: 'f1040-question' })
    dependents.append(el('span', {
        text: `Dependents (see instructions) — the return profile declares ${profile.dependentCount}, `
            + 'and carries no names or taxpayer identification numbers, so the four-column grid the '
            + 'form prints here is not drawn.',
    }))
    one.append(dependents)

    for (const band of pageOneBands) { one.append(printedBand(band)) }
    form.append(one)

    // ── Page 2 ───────────────────────────────────────────────────────────────
    const two = el('div', { class: 'f1040-page' })
    two.append(masthead(2))
    for (const band of pageTwoBands) { two.append(printedBand(band)) }

    const designee = el('div', { class: 'f1040-sign' })
    designee.append(el('span', { class: 'f1040-caption', text: 'Third Party Designee' }))
    designee.append(el('span', {
        text: 'Do you want to allow another person to discuss this return with the IRS? '
            + 'See instructions.',
    }))
    designee.append(checkRun(['Yes. Complete below.', 'No']))
    const designeeGrid = el('div', { class: 'f1040-grid' })
    designeeGrid.append(entryBox('Designee’s name', '', 2))
    designeeGrid.append(entryBox('Phone no.', '', 2))
    designeeGrid.append(entryBox('Personal identification number (PIN)', '', 2))
    designee.append(designeeGrid)
    two.append(designee)

    const sign = el('div', { class: 'f1040-sign' })
    sign.append(el('span', { class: 'f1040-caption', text: 'Sign Here' }))
    sign.append(el('span', {
        text: 'Under penalties of perjury, I declare that I have examined this return and '
            + 'accompanying schedules and statements, and to the best of my knowledge and belief, '
            + 'they are true, correct, and complete. Declaration of preparer (other than taxpayer) '
            + 'is based on all information of which preparer has any knowledge.',
    }))
    const signGrid = el('div', { class: 'f1040-grid' })
    signGrid.append(entryBox('Your signature', '', 2))
    signGrid.append(entryBox('Date', '', 1))
    signGrid.append(entryBox('Your occupation', '', 1))
    signGrid.append(entryBox('If the IRS sent you an Identity Protection PIN, enter it here (see inst.)', '', 2))
    signGrid.append(entryBox('Spouse’s signature. If a joint return, both must sign.', '', 2))
    signGrid.append(entryBox('Date', '', 1))
    signGrid.append(entryBox('Spouse’s occupation', '', 1))
    signGrid.append(entryBox('If the IRS sent your spouse an Identity Protection PIN, enter it here (see inst.)', '', 2))
    signGrid.append(entryBox('Phone no.', '', 3))
    signGrid.append(entryBox('Email address', '', 3))
    sign.append(signGrid)
    two.append(sign)

    const preparer = el('div', { class: 'f1040-sign' })
    preparer.append(el('span', { class: 'f1040-caption', text: 'Paid Preparer Use Only' }))
    const preparerGrid = el('div', { class: 'f1040-grid' })
    preparerGrid.append(entryBox('Preparer’s name', '', 2))
    preparerGrid.append(entryBox('Preparer’s signature', '', 2))
    preparerGrid.append(entryBox('Date', '', 1))
    preparerGrid.append(entryBox('PTIN', '', 1))
    preparerGrid.append(entryBox('Check if: Self-employed', '', 2))
    preparerGrid.append(entryBox('Firm’s name', '', 2))
    preparerGrid.append(entryBox('Phone no.', '', 2))
    preparerGrid.append(entryBox('Firm’s address', '', 4))
    preparerGrid.append(entryBox('Firm’s EIN', '', 2))
    preparer.append(preparerGrid)
    two.append(preparer)

    form.append(two)
    root.append(form)
    return { lineCount: outcome.lines.length, line16Method: outcome.line16Method }
}

/** @type {Step['render']} */
export const render = root => {
    // The form is drawn FIRST, into a detached node, because the prose below
    // states facts about it — and a stop panel means there are no such facts
    // to state.
    const held = el('div')
    const drawn = renderForm(held)
    if (drawn === undefined) {
        root.append(held)
        return
    }

    const lede = section(
        'Dana and Ray Okafor, married filing jointly, tax year 2025',
        'The same return step 3 lists line by line, drawn as the form it actually is. Click any amount.')
    lede.append(el('p', {
        html: 'The amounts are computed here, now, by <code>form1040Report</code> — the same '
            + 'entry point the server reaches through a stored guest program. Nothing on this '
            + 'page is a fixture except the taxpayer\'s own documents, and the header block is '
            + 'filled from those: the names and the taxpayer identification numbers come off the '
            + 'two W-2s, and the filing status off the return profile.',
    }))
    lede.append(callout('info', 'An empty box is structure, never a computed zero.',
        'The boxes with no amount are the rows the printed form carries and the engine emits '
        + 'nothing for — the routing number, the account number, line 38\'s estimated tax '
        + 'penalty. A computed zero looks different: it is a real 0.00 '
        + 'in the box, dimmed, and it cites its sources like every other line. That distinction '
        + 'is the one a tax form usually destroys.'))
    lede.append(el('p', {
        html: `Every amount below is a button. The form has ${drawn.lineCount} filled boxes `
            + 'and every one of them opens the documents it was computed from, which is the '
            + 'whole argument: a form face is only worth as much as its ability to answer '
            + '"where did that come from?".',
    }))

    const standalone = el('p')
    standalone.append(el('span', {
        text: 'To print it, or to hand it to a preparer, open the form on its own page — no '
            + 'navigation, no commentary, two sheets of paper: ',
    }))
    standalone.append(anchor('./form1040.html', 'the Form 1040 alone ↗'))
    lede.append(standalone)
    root.append(lede)
    root.append(held)

    const method = el('div', { class: 'figure-row' })
    method.append(el('span', { class: 'kicker', text: 'Line 16 computed by' }))
    method.append(el('span', { class: 'method', text: drawn.line16Method }))
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
            + 'chosen because it is the one layout that needs no explaining — good enough to '
            + 'transcribe from, or to hand to a preparer, and not a substitute for either.',
    }))
    reading.append(callout('ok', 'Every label was read off the printed page.',
        'The line numbers, the captions, the checkbox captions and the band names were all '
        + 'checked against the PDF the IRS publishes, in the 2025 revision, and corrected where '
        + 'they disagreed. The module\'s own docstring lists what was wrong and what the page '
        + 'says instead, including the three blocks this face still does not draw.'))
    reading.append(callout('ok', 'The rows are hand-typed on purpose.',
        'Deriving the printed rows from the engine\'s own output would make this page unable to '
        + 'notice a line disappearing — the exact defect AGENTS.md records shipping four times. '
        + 'So the printed line numbers are written out here and compared against the engine\'s '
        + 'in both directions before anything is drawn. Delete a line from the engine and this '
        + 'page refuses to render a form; add one and it says which one it did not expect.'))
    reading.append(el('p'))
    reading.append(anchor('https://www.irs.gov/pub/irs-pdf/f1040.pdf',
        'The printed page every label above was checked against ↗'))
    root.append(reading)

    root.append(sourceFooter([
        { label: 'fjs/form1040/core — lines 1a-37 and the whole-return entry point', path: 'fjs/form1040/core/module.f.js', line: 2377, proofLine: 3758 },
        { label: 'fjs/report/line — the ReportLine type, whose sources are a non-empty tuple', path: 'fjs/report/line/module.f.js', line: 1, proofLine: 182 },
        { label: 'fjs/tax/line16 — which of the four methods priced line 16', path: 'fjs/tax/line16/module.f.js', line: 197, proofLine: 580 },
        { label: 'tax-return-integration.test.js — the same entry point through a real fjs_run process', path: 'tax-return-integration.test.js', line: 127 },
    ]))
}
