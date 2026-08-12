/**
 * Step 6 — Parameters.
 *
 * Every dollar figure the tax year fixes, stored once, each carrying the
 * Revenue Procedure and section it came from. No figure is typed into a
 * computation.
 *
 * Everything on this page is read out of the engine at render time. Nothing is
 * transcribed here.
 *
 * @module
 */
import { el, section, table, callout, note } from '../lib/dom.js'
import { sourceFooter } from '../lib/github.js'
import { ty2025, money, centsFromString, individualFilingStatuses, maxAgedOrBlindBoxes, expectedChartCombinationCount, standardDeductionCents } from '../lib/engine.js'

/** @import { Step } from '../demo.js' */
/** @import { StandardDeductionInput } from '../../fjs/tax/deduction/module.f.js' */

export const id = 'parameters'
export const kicker = 'Step 6'
export const title = 'Parameters'
export const beat = 'Every figure the tax year fixes, stored once, each citing the Revenue Procedure it came from.'
export const tier = 'optional'

/**
 * A `Citation` as one printable string. `Citation` is a discriminated union
 * (`fjs/tax/params`'s `kind: 'revProc' | 'publicLaw' | 'code'`, widened in
 * Phase 13) because not every parameter this engine stores comes from an
 * annual Revenue Procedure — some are direct Public Law text, some are
 * long-standing bare IRC sections with no annual update at all. This page
 * renders whichever authority actually governs the figure, rather than
 * assuming Rev. Proc. for everything.
 * @type {(citation: { readonly kind: 'revProc', readonly revProc: string, readonly section: string } | { readonly kind: 'publicLaw', readonly publicLaw: string, readonly section: string } | { readonly kind: 'code', readonly section: string }) => string}
 */
const cite = citation => {
    if (citation.kind === 'revProc') { return `Rev. Proc. ${citation.revProc} ${citation.section}` }
    if (citation.kind === 'publicLaw') { return `Pub. L. ${citation.publicLaw} ${citation.section}` }
    return `IRC ${citation.section}`
}

/** @type {Step['render']} */
export const render = root => {
    // ── Standard deduction ───────────────────────────────────────────────────
    const deduction = section(
        'The basic standard deduction',
        'Revised by the One Big Beautiful Bill Act — which is why these cite Rev. Proc. 2025-32 and not the original 2024-40 release.')
    deduction.append(table(
        ['Filing status', 'Amount', 'Authority', 'Effective'],
        individualFilingStatuses.map(status => {
            const entry = ty2025.standardDeduction[status]
            return [
                { text: status, class: 'mono' },
                { text: money(centsFromString(entry.amount)), class: 'money' },
                cite(entry.citation),
                entry.citation.effectiveDate,
            ]
        }),
    ))
    deduction.append(note(
        'A qualifying surviving spouse reads the same printed row as married filing '
        + 'jointly, so the amounts match — but the figure is stored separately rather '
        + 'than copied. A copy would move both statuses at once and no test could ever '
        + 'notice them drifting apart.'))
    root.append(deduction)

    // ── Age and blindness ────────────────────────────────────────────────────
    const aged = section(
        'The additional deduction for being 65 or older, or blind',
        'Per qualifying condition, not per person: someone both 65+ and blind gets it twice.')
    aged.append(table(
        ['Case', 'Amount per box', 'Authority'],
        [
            [
                'Married',
                { text: money(centsFromString(ty2025.agedOrBlindAdditional.married.amount)), class: 'money' },
                cite(ty2025.agedOrBlindAdditional.married.citation),
            ],
            [
                'Unmarried',
                { text: money(centsFromString(ty2025.agedOrBlindAdditional.unmarried.amount)), class: 'money' },
                cite(ty2025.agedOrBlindAdditional.unmarried.citation),
            ],
        ],
    ))
    aged.append(el('h4', { text: 'How many boxes each status may check' }))
    aged.append(table(
        ['Filing status', 'Maximum boxes'],
        individualFilingStatuses.map(status => [
            { text: status, class: 'mono' },
            { text: String(maxAgedOrBlindBoxes[status]), class: 'money' },
        ]),
    ))
    aged.append(note(
        `Those maxima and the base amounts generate ${expectedChartCombinationCount} `
        + 'distinct chart combinations, each with its own proof. A filer claiming more '
        + 'boxes than their status permits is refused, naming the maximum it enforced — '
        + 'never quietly answered with a number.'))
    root.append(aged)

    // ── Brackets ─────────────────────────────────────────────────────────────
    const brackets = section(
        'Ordinary rate brackets',
        'The last bracket has no ceiling — it is absent, never a sentinel value standing in for infinity.')
    for (const status of individualFilingStatuses) {
        const schedule = ty2025.ordinaryBrackets[status]
        const panel = el('div')
        panel.append(el('h4', { text: `${status} — ${cite(schedule.citation)}` }))
        panel.append(table(
            ['Rate', 'Applies up to'],
            schedule.brackets.map(bracket => [
                { text: `${bracket.ratePercent}%`, class: 'money' },
                bracket.ceiling === undefined
                    ? { text: 'no ceiling', class: 'dim' }
                    : { text: money(centsFromString(bracket.ceiling)), class: 'money' },
            ]),
        ))
        brackets.append(panel)
    }
    root.append(brackets)

    // ── Capital gains breakpoints ────────────────────────────────────────────
    const gains = section(
        'Preferential-rate breakpoints',
        'The Qualified Dividends worksheet reads its lines 6 and 13 straight from here — the printed figures ARE these values, character for character.')
    gains.append(table(
        ['Filing status', '0% up to', '15% up to', 'Authority'],
        individualFilingStatuses.map(status => {
            const entry = ty2025.capitalGainsBreakpoints[status]
            return [
                { text: status, class: 'mono' },
                { text: money(centsFromString(entry.zeroRateMax)), class: 'money' },
                { text: money(centsFromString(entry.fifteenRateMax)), class: 'money' },
                cite(entry.citation),
            ]
        }),
    ))
    gains.append(callout('ok', 'No figure is typed twice.',
        'A worksheet that re-typed a breakpoint would be a second source of truth for a '
        + 'number the Revenue Procedure already fixes once. When the IRS moves it, one '
        + 'value changes and everything downstream follows.'))
    root.append(gains)

    // ── A worked lookup ──────────────────────────────────────────────────────
    const worked = section(
        'The chart, exercised',
        'The standard deduction the engine computes for a few combinations — not read from a table on this page, but computed by the shipped function.')
    // `StandardDeductionInput` has NO optional fields — every checkbox fact is
    // required, so a case cannot silently omit one and get a default. These are
    // written against a neutral base rather than repeating six fields seven
    // times.
    /** @type {StandardDeductionInput} */
    const neutralInput = {
        status: 'single',
        agedOrBlindBoxes: 0,
        claimedAsDependent: false,
        spouseItemizes: false,
        dualStatusAlien: false,
        earnedIncomeCents: 0n,
    }
    /** @type {readonly { readonly label: string, readonly input: StandardDeductionInput }[]} */
    const cases = [
        { label: 'Single, no boxes', input: neutralInput },
        { label: 'Single, 65 or older', input: { ...neutralInput, agedOrBlindBoxes: 1 } },
        { label: 'MFJ, no boxes', input: { ...neutralInput, status: 'marriedFilingJointly' } },
        { label: 'MFJ, both 65+ and both blind', input: { ...neutralInput, status: 'marriedFilingJointly', agedOrBlindBoxes: 4 } },
        { label: 'MFS, spouse itemizes', input: { ...neutralInput, status: 'marriedFilingSeparately', spouseItemizes: true } },
        { label: 'MFS, spouse itemizes, filer is 65+ and blind', input: { ...neutralInput, status: 'marriedFilingSeparately', agedOrBlindBoxes: 2, spouseItemizes: true } },
        { label: 'Dual-status alien', input: { ...neutralInput, dualStatusAlien: true } },
    ]
    worked.append(table(
        ['Case', 'Line 12e'],
        cases.map(testCase => [
            testCase.label,
            { text: money(standardDeductionCents(ty2025)(testCase.input)), class: 'money' },
        ]),
    ))
    worked.append(callout('warn', 'The last three rows are a bug that was caught late.',
        'A married-filing-separately filer whose spouse itemizes gets $0 — "even if you '
        + 'were born before January 2, 1961, or were blind". Those two conditions '
        + 'reached the chart unwatched for most of a phase: a blind 65-year-old could '
        + 'have taken $22,150 instead of nothing, with the whole suite green. Two proof '
        + 'leaves now watch them through the return profile.'))
    root.append(worked)

    root.append(sourceFooter([
        { label: 'fjs/tax/params — every stored figure and its citation', path: 'fjs/tax/params/module.f.js', line: 153, proofLine: 418 },
        { label: 'fjs/tax/deduction — the chart and its exceptions', path: 'fjs/tax/deduction/module.f.js', line: 215, proofLine: 387 },
        { label: 'fjs/tax/table — where the brackets become a tax', path: 'fjs/tax/table/module.f.js', line: 131, proofLine: 571 },
    ]))
}
