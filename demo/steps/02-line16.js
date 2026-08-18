/**
 * Step 2 — Line 16, the method dispatch.
 *
 * Form 1040 line 16 is "your tax", and there is no single way to compute it.
 * The instructions print a decision tree; this module implements it in the
 * printed order and returns WHICH method it selected alongside the money.
 *
 * The method tag is not decoration. Swapping two conditions in the dispatcher
 * returns identical cents on every ordinary return — only the tag catches it.
 * A suite built from realistic-looking test returns would have shipped that
 * bug with a fully green board.
 *
 * @module
 */
import { el, input, select, option, button, section, table, callout, note } from '../lib/dom.js'
import { sourceFooter } from '../lib/github.js'
import {
    dispatchLine16, qdcgt, ty2025, centsFromString, money, individualFilingStatuses,
} from '../lib/engine.js'

/** @import { Step } from '../demo.js' */
/** @import { Line16Inputs, Line16Method } from '../../fjs/tax/line16/module.f.js' */
/** @import { IndividualFilingStatus } from '../../fjs/tax/params/module.f.js' */

export const id = 'line16'
export const kicker = 'Step 2'
export const title = 'Line 16'
export const beat = 'Four ways to compute one line, selected from the printed conditions — and a tag on every result saying which one ran.'
export const tier = 'must'

/** Every field the dispatcher asks about, at its neutral value.
 * @type {Line16Inputs}
 */
const neutral = {
    status: 'marriedFilingJointly',
    taxableIncomeCents: centsFromString('97000.00'),
    qualifiedDividendsCents: 0n,
    capitalGainDistributionsCents: 0n,
    filingScheduleD: false,
    scheduleD15Cents: 0n,
    scheduleD16Cents: 0n,
    scheduleD18Cents: 0n,
    scheduleD19Cents: 0n,
    filingForm4952: false,
    form4952Line4gCents: 0n,
    form4952Line4eCents: 0n,
    filingForm2555: false,
    form8615Applies: false,
    scheduleJElected: false,
}

/** What each method is, in one line, for the caption under the tag.
 * @type {Record<Line16Method, string>}
 */
const methodBlurb = {
    taxTable: 'Publication 1040\'s printed Tax Table — the $50-wide band your income falls in, taxed at its midpoint.',
    taxComputationWorksheet: 'The Tax Computation Worksheet — above $100,000 the printed table stops, and a rate-times-income-minus-subtraction row takes over.',
    qdcgt: 'The Qualified Dividends and Capital Gain Tax Worksheet — 25 lines that price the preferential-rate slice separately from the ordinary slice.',
    scheduleDTaxWorksheet: 'The Schedule D Tax Worksheet — 47 lines pricing unrecaptured section 1250 gain at up to 25% and collectibles at 28%, separately from the ordinary and 0/15/20% slices.',
    foreignEarnedIncomeTaxWorksheet: 'The Foreign Earned Income Tax Worksheet wraps whichever base method applies. Not modeled.',
    form8615: 'Form 8615, a child\'s unearned income taxed at the parent\'s rate. Not modeled.',
    scheduleJ: 'Schedule J, farm income averaging. Not modeled.',
}

/** The four printed branches, as presets.
 * @type {readonly {
 *   readonly label: string,
 *   readonly why: string,
 *   readonly over: Partial<Line16Inputs>,
 * }[]}
 */
const presets = [
    {
        label: 'Tax Table',
        why: 'Taxable income under $100,000, nothing preferential.',
        over: { taxableIncomeCents: centsFromString('60000.00') },
    },
    {
        label: 'Tax Computation Worksheet',
        why: 'The same return above $100,000 — the printed table simply ends.',
        over: { taxableIncomeCents: centsFromString('150000.00') },
    },
    {
        label: 'Qualified Dividends worksheet',
        why: 'One dollar of qualified dividends changes the method.',
        over: {
            taxableIncomeCents: centsFromString('97000.00'),
            qualifiedDividendsCents: centsFromString('300.00'),
        },
    },
    {
        label: 'Schedule D Tax Worksheet',
        why: '28%-rate gain on Schedule D routes to its own worksheet, taxed at up to 28% rather than 0/15/20%.',
        over: {
            taxableIncomeCents: centsFromString('97000.00'),
            filingScheduleD: true,
            scheduleD15Cents: centsFromString('5000.00'),
            scheduleD16Cents: centsFromString('5000.00'),
            scheduleD18Cents: centsFromString('1000.00'),
        },
    },
]

/**
 * The two regression cases, HAND-TYPED from the worksheet.
 *
 * These are the only hand-entered expected values in this demo. They were
 * reproduced independently four times — by research, by the planner, by the
 * executor, and once more by hand — before being written down, and the page
 * recomputes them live and shows a loud mismatch if the engine disagrees.
 *
 * What they pin is the omission of line 25's `min`, NOT naive Tax Table use:
 * an engine that merely looks line 1 up in the table gets both right, because
 * that is exactly what line 24 computes and `min` selects it.
 */
/** @type {readonly {
 *   readonly label: string, readonly line15: string, readonly line3a: string,
 *   readonly line23: string, readonly line24: string, readonly line16: string,
 * }[]} */
const regressionCases = [
    { label: 'A', line15: '97000.00', line3a: '300.00', line23: '11175.00', line24: '11174.00', line16: '11174.00' },
    { label: 'B', line15: '96999.00', line3a: '299.00', line23: '11174.85', line24: '11163.00', line16: '11163.00' },
]

/**
 * A dollar slider.
 *
 * `readout()` only redraws the label; the `input` listener is what writes back
 * into the caller's state. Keeping the two apart is what lets a preset set a
 * slider's position without the slider then clobbering the preset.
 */
/**
 * @type {(label: string, max: number, step: number, initial: number, onInput: (cents: bigint) => void) => {
 *   readonly wrap: HTMLElement,
 *   readonly slider: HTMLInputElement,
 *   readonly readout: () => void,
 * }}
 */
const rangeControl = (label, max, step, initial, onInput) => {
    const wrap = el('div', { class: 'control' })
    wrap.append(el('label', { text: label }))
    const slider = input()
    slider.type = 'range'
    slider.min = '0'
    slider.max = String(max)
    slider.step = String(step)
    slider.value = String(initial)
    const value = el('span', { class: 'value' })
    wrap.append(slider, value)
    const cents = () => BigInt(slider.value) * 100n
    const readout = () => { value.textContent = money(cents()) }
    slider.addEventListener('input', () => {
        readout()
        onInput(cents())
    })
    return { wrap, slider, readout }
}

/**
 * Narrows the filing-status `<select>`'s string value to the union the engine
 * is written against.
 *
 * A `<select>`'s `.value` is a `string`, and the whole point of the frozen
 * status list is that a value outside it is not computable — so this searches
 * the engine's own list and what flows onward is the MEMBER THAT MATCHED,
 * never the raw string. AGENTS.md bans a cast, and a cast here would be
 * exactly the wrong tool: it would silence the one question worth asking.
 * @type {(value: string) => IndividualFilingStatus}
 */
const filingStatusNamed = value => {
    const found = individualFilingStatuses.find(status => status === value)
    if (found === undefined) { throw `not a filing status this engine models: ${value}` }
    return found
}

/** @type {Step['render']} */
export const render = root => {
    // ── The live dispatcher ──────────────────────────────────────────────────
    const live = section(
        'Change the return, watch the method change',
        'Everything below is one call to the shipped dispatcher. Nothing is precomputed.')

    let state = { ...neutral }

    const result = el('div')
    const tag = el('span', { class: 'method' })
    const amount = el('span', { class: 'big-figure' })
    const blurb = el('p', { class: 'note' })
    const detail = el('div')

    const recompute = () => {
        const outcome = dispatchLine16(ty2025)(state)
        tag.className = outcome.kind === 'ok' ? 'method' : 'method refuses'
        tag.textContent = outcome.method
        amount.textContent = outcome.kind === 'ok' ? money(outcome.cents) : 'refused'
        blurb.textContent = methodBlurb[outcome.method]
        detail.replaceChildren()
        if (outcome.kind === 'error') {
            detail.append(callout('stop', 'This return gets no line 16.', outcome.message))
            detail.append(table(
                ['Unmodeled input'],
                outcome.unmodeled.map(kind => [{ text: kind, class: 'mono' }]),
            ))
        } else if (outcome.method === 'qdcgt') {
            const worksheet = qdcgt(ty2025)({
                status: state.status,
                line1Cents: state.taxableIncomeCents,
                line2Cents: state.qualifiedDividendsCents,
                filingScheduleD: state.filingScheduleD,
                scheduleD15Cents: state.scheduleD15Cents,
                scheduleD16Cents: state.scheduleD16Cents,
                line7aCents: state.capitalGainDistributionsCents,
            })
            detail.append(el('h4', { text: 'The worksheet\'s last four lines' }))
            detail.append(table(
                ['Worksheet line', 'What it is', 'Amount'],
                [
                    ['22', 'Tax on line 21 by the base method', { text: money(worksheet.line22), class: 'money' }],
                    ['23', 'Lines 20 + 21 + 22 — the split computation', { text: money(worksheet.line23), class: 'money' }],
                    ['24', 'Tax on ALL of line 1 by the base method', { text: money(worksheet.line24), class: 'money' }],
                    ['25', 'The SMALLER of 23 and 24 — this is line 16', { text: money(worksheet.line25), class: 'money' }],
                ],
            ))
            detail.append(note(
                `Lines 22 and 24 were priced by ${worksheet.method22} and `
                + `${worksheet.method24}. They can differ within a single return, which `
                + 'is why the worksheet records them separately.'))
        }
    }

    // Controls.
    const controls = el('div', { class: 'controls' })

    const statusWrap = el('div', { class: 'control' })
    statusWrap.append(el('label', { text: 'Filing status' }))
    const statusSelect = select()
    for (const status of individualFilingStatuses) {
        statusSelect.append(option(status, status))
    }
    statusSelect.value = neutral.status
    statusSelect.addEventListener('change', () => {
        state = { ...state, status: filingStatusNamed(statusSelect.value) }
        recompute()
    })
    statusWrap.append(statusSelect)
    controls.append(statusWrap)

    const income = rangeControl('Line 15 — taxable income', 250000, 500, 97000, cents => {
        state = { ...state, taxableIncomeCents: cents }
        recompute()
    })
    controls.append(income.wrap)

    const dividends = rangeControl('Line 3a — qualified dividends', 20000, 100, 0, cents => {
        state = { ...state, qualifiedDividendsCents: cents }
        recompute()
    })
    controls.append(dividends.wrap)

    live.append(controls)

    // The Schedule D toggle now COMPUTES (Plan 12.1-04); the other three
    // toggles select the level-0 WRAPPER branches, which still refuse —
    // no kind for Form 2555, Form 8615, or Schedule J is in scope.
    const toggles = el('div', { class: 'checks' })
    /** @type {readonly {
     *   readonly label: string,
     *   readonly apply: (on: boolean) => Partial<Line16Inputs>,
     * }[]} */
    const toggleSpecs = [
        { label: 'Filing Schedule D (with 28%-rate gain)', apply: on => on
            ? {
                filingScheduleD: true,
                scheduleD15Cents: centsFromString('5000.00'),
                scheduleD16Cents: centsFromString('5000.00'),
                scheduleD18Cents: centsFromString('1000.00'),
            }
            : { filingScheduleD: false, scheduleD15Cents: 0n, scheduleD16Cents: 0n, scheduleD18Cents: 0n } },
        { label: 'Form 2555 — foreign earned income', apply: on => ({ filingForm2555: on }) },
        { label: 'Form 8615 — child\'s unearned income', apply: on => ({ form8615Applies: on }) },
        { label: 'Schedule J — farm income averaging', apply: on => ({ scheduleJElected: on }) },
    ]
    for (const spec of toggleSpecs) {
        const label = el('label')
        const box = input()
        box.type = 'checkbox'
        box.addEventListener('change', () => {
            label.classList.toggle('on', box.checked)
            state = { ...state, ...spec.apply(box.checked) }
            recompute()
        })
        label.append(box, el('span', { text: spec.label }))
        toggles.append(label)
    }
    live.append(toggles)

    const row = el('div', { class: 'figure-row' })
    row.append(tag, amount)
    result.append(row, blurb, detail)
    live.append(result)
    root.append(live)

    // ── Presets ──────────────────────────────────────────────────────────────
    const jump = section('The four printed branches')
    jump.append(el('p', {
        text: 'Each button sets the return to the conditions that select one branch. '
            + 'All four compute — the Schedule D Tax Worksheet joined the other three '
            + 'as of Plan 12.1-04.',
    }))
    const buttons = el('div', { class: 'checks' })
    for (const preset of presets) {
        const jumpButton = button(preset.label, { class: 'nav-button' })
        jumpButton.title = preset.why
        jumpButton.addEventListener('click', () => {
            const next = {
                ...neutral,
                status: filingStatusNamed(statusSelect.value),
                ...preset.over,
            }
            // Move the sliders first — their `input` handlers write back into
            // `state`, so the preset must be applied AFTER they have settled or
            // a slider's stale position would overwrite it.
            income.slider.value = String(next.taxableIncomeCents / 100n)
            dividends.slider.value = String(next.qualifiedDividendsCents / 100n)
            income.readout()
            dividends.readout()
            state = next
            recompute()
            root.scrollIntoView({ behavior: 'smooth', block: 'start' })
        })
        buttons.append(jumpButton)
    }
    jump.append(buttons)
    jump.append(table(
        ['Branch', 'Selected when'],
        presets.map(preset => [preset.label, preset.why]),
    ))
    root.append(jump)

    // ── The regression pair ──────────────────────────────────────────────────
    const regression = section(
        'The regression pair',
        'Two returns a dollar apart. They exist to pin one specific defect: dropping worksheet line 25\'s min.')
    const rows = []
    let mismatch = false
    for (const testCase of regressionCases) {
        const worksheet = qdcgt(ty2025)({
            status: 'marriedFilingJointly',
            line1Cents: centsFromString(testCase.line15),
            line2Cents: centsFromString(testCase.line3a),
            filingScheduleD: false,
            scheduleD15Cents: 0n,
            scheduleD16Cents: 0n,
            line7aCents: 0n,
        })
        const expected = centsFromString(testCase.line16)
        const agrees = worksheet.line25 === expected
            && worksheet.line23 === centsFromString(testCase.line23)
            && worksheet.line24 === centsFromString(testCase.line24)
        if (!agrees) { mismatch = true }
        rows.push([
            testCase.label,
            { text: money(centsFromString(testCase.line15)), class: 'money' },
            { text: money(centsFromString(testCase.line3a)), class: 'money' },
            { text: money(worksheet.line23), class: 'money' },
            { text: money(worksheet.line24), class: 'money' },
            { text: money(worksheet.line25), class: 'money' },
            { text: money(worksheet.line23 - worksheet.line25), class: 'money' },
            agrees ? '✓ matches' : '✗ MISMATCH',
        ])
    }
    regression.append(table(
        ['Case', 'Line 15', 'Line 3a', 'Line 23', 'Line 24', 'Line 16', 'Overcharge if min dropped', 'vs hand-typed'],
        rows,
    ))
    if (mismatch) {
        regression.append(callout('stop', 'The engine disagrees with the hand-typed table.',
            'One of the two is wrong and this page cannot tell you which. Do not present '
            + 'these figures until it is resolved.'))
    } else {
        regression.append(callout('ok', 'The engine reproduces both cases exactly.',
            'The hand-typed expected values and the live computation agree to the cent.'))
    }
    regression.append(el('p', {
        html: 'The "overcharge" column is what the taxpayer would pay if line 25\'s '
            + '<code>min</code> were dropped. It is not a bounded error: it is '
            + 'whatever the two computations happen to differ by, and it grows with '
            + 'the amount of preferential-rate income.',
    }))
    regression.append(callout('warn', 'Three of five worked examples cannot see this defect at all.',
        'In the control, split and all-rates cases, line 23 is already the smaller of '
        + 'the two — so dropping the min changes nothing. A suite assembled from '
        + 'realistic-looking returns would have shipped the bug green. These two cases '
        + 'were constructed to sit on the wrong side of it.'))
    root.append(regression)

    // ── Why the tag matters ──────────────────────────────────────────────────
    const tagPanel = section('Why the result carries a method tag')
    tagPanel.append(el('p', {
        html: 'Swap two conditions in the dispatcher and it returns <strong>identical '
            + 'cents</strong> on every ordinary return. The money is the same; the '
            + 'reasoning is wrong. Only the tag notices.',
    }))
    tagPanel.append(el('p', {
        text: 'That is why the tag is on the error arm too. A refusal that cannot say '
            + 'which branch it refused from is a refusal you cannot act on.',
    }))
    root.append(tagPanel)

    root.append(sourceFooter([
        { label: 'fjs/tax/line16 — the dispatch, in printed order', path: 'fjs/tax/line16/module.f.js', line: 197, proofLine: 580 },
        { label: 'fjs/tax/line16/qdcgt — the 25-line worksheet', path: 'fjs/tax/line16/qdcgt/module.f.js', line: 131, proofLine: 284 },
        { label: 'fjs/tax/table — Tax Table and Tax Computation Worksheet', path: 'fjs/tax/table/module.f.js', line: 226, proofLine: 571 },
        { label: 'fjs/return/scope — the one place a refusal is constructed', path: 'fjs/return/scope/module.f.js', line: 1226, proofLine: 1555 },
    ]))

    income.readout()
    dividends.readout()
    recompute()
}
