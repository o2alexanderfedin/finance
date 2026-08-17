/**
 * Step 5 — Exactness.
 *
 * Two separate claims, often confused:
 *
 * 1. A binary floating-point number cannot represent most cents values, so
 *    arithmetic on it drifts.
 * 2. Even with exact arithmetic, WHERE you round changes the answer — and the
 *    instructions are specific about where.
 *
 * The engine gets both right, and the second one is the more interesting,
 * because an engine can be perfectly exact and still be wrong by four dollars.
 *
 * @module
 */
import { el, section, table, callout, note, code } from '../lib/dom.js'
import { sourceFooter } from '../lib/github.js'
import {
    profileElecting, tenSmallInterestForms, smallInterestAmount,
} from '../lib/fixtures.js'
import {
    form1040Report, ty2025, money, centsFromString, centsToString, store,
    applyWholeDollarElection,
} from '../lib/engine.js'

/** @import { Step } from '../demo.js' */
/** @import { ReportLine, Source } from '../../fjs/report/line/module.f.js' */

export const id = 'exactness'
export const kicker = 'Step 5'
export const title = 'Exactness'
export const beat = 'Money is never a double, and rounding happens once — over the whole return, at the end, and only if the taxpayer elected it.'
export const tier = 'optional'

/** The amounts summed in the drift demonstration. @type {readonly string[]} */
const drifting = ['1284.37', '92.15', '340.00', '0.10', '0.20']

/** @type {Step['render']} */
export const render = root => {
    // ── Binary floating point ────────────────────────────────────────────────
    const floats = section(
        'A double cannot hold a cent',
        'The same five amounts, summed as JavaScript numbers and as exact integer cents.')

    const asFloat = drifting.reduce((total, amount) => total + Number(amount), 0)
    const asCents = drifting.reduce((total, amount) => total + centsFromString(amount), 0n)

    floats.append(table(
        ['Amount', 'As a JSON number (double)', 'As exact cents'],
        drifting.map(amount => [
            { text: amount, class: 'mono' },
            { text: String(Number(amount)), class: 'mono' },
            { text: `${centsFromString(amount)}n`, class: 'mono' },
        ]),
    ))
    floats.append(el('h4', { text: 'The totals' }))
    floats.append(table(
        ['Method', 'Result'],
        [
            ['Summed as doubles', { text: String(asFloat), class: 'mono' }],
            ['Summed as exact cents', { text: `${asCents}n → ${centsToString(asCents)}`, class: 'mono' }],
            ['Agree?', asFloat.toFixed(2) === centsToString(asCents) ? 'to two places, yes' : 'no — the double has already drifted'],
        ],
    ))
    floats.append(note(
        'The classic case is on the third and fourth rows: 0.1 + 0.2 is not 0.3 in '
        + 'binary floating point. On five amounts the drift is invisible. It does not '
        + 'stay invisible, and — this is the part that matters — you cannot tell from '
        + 'the answer whether it has happened.'))
    floats.append(callout('ok', 'The engine never holds money as a number.',
        'A decimal string on the wire and in storage; a bigint count of cents in '
        + 'computation. There is no code path on which a monetary value becomes a '
        + 'double, including the one that draws these pages.'))
    root.append(floats)

    // ── round(sum) vs sum(round) ─────────────────────────────────────────────
    const rounding = section(
        'Where you round changes the answer',
        'Ten interest documents of $1.39 each, on a return that elected whole dollars.')

    rounding.append(el('blockquote', {
        class: 'lede',
        text: '"You can round off cents to whole dollars on your return and schedules. If '
            + 'you do round to whole dollars, you must round all amounts… If you have to '
            + 'add two or more amounts to figure the amount to enter on a line, include '
            + 'cents when adding the amounts and round off only the total." '
            + '— Form 1040 instructions, p23',
    }))

    const withElection = {
        profile: store(profileElecting(true)),
        w2s: [],
        interestForms: tenSmallInterestForms,
        dividendForms: [],
        brokerageForms: [],
        retirementForms: [],
        socialSecurityForms: [],
        itemizedDeductionForms: [],
        medicalExpenseForms: [],
        capitalLossCarryoverForms: [],
        unemploymentForms: [],
        adjustmentForms: [],
        studentLoanInterestForms: [],
        tuitionForms: [],
        creditForms: [],
        iraForms: [],
        nonemployeeCompensationForms: [],
        businessExpenseForms: [],
        priorYearIraBasisForms: [],
        isoExerciseForms: [],
        employeeStockPurchaseForms: [],
        basisCorrectionForms: [],
        partnershipK1Forms: [],
        sCorporationK1Forms: [],
        estateTrustK1Forms: [],
    }
    const withoutElection = { ...withElection, profile: store(profileElecting(false)) }

    const elected = form1040Report(ty2025)(withElection)
    const exact = form1040Report(ty2025)(withoutElection)

    if (elected.kind === 'error' || exact.kind === 'error') {
        rounding.append(callout('stop', 'The rounding demonstration did not compute.',
            elected.kind === 'error' ? elected.message : 'unexpected refusal'))
    } else {
        const line2bElected = elected.lines.find(line => line.rule === '1040 line 2b')
        const line2bExact = exact.lines.find(line => line.rule === '1040 line 2b')
        const perDocument = centsFromString(smallInterestAmount)
        // sum(round): each document rounded to whole dollars first.
        const naive = BigInt(tenSmallInterestForms.length)
            * (perDocument / 100n + (perDocument % 100n >= 50n ? 1n : 0n)) * 100n
        rounding.append(table(
            ['Approach', 'Line 2b', 'What it did'],
            [
                [
                    'Exact cents (no election)',
                    { text: money(line2bExact === undefined ? 0n : line2bExact.value), class: 'money' },
                    'Ten × $1.39, added with cents',
                ],
                [
                    'Election, rounded ONCE at the end',
                    { text: money(line2bElected === undefined ? 0n : line2bElected.value), class: 'money' },
                    'round($13.90) — what the instructions say',
                ],
                [
                    'Rounding each document first',
                    { text: money(naive), class: 'money' },
                    '10 × round($1.39) — plausible, and wrong',
                ],
            ],
        ))
        const gap = (line2bElected === undefined ? 0n : line2bElected.value) - naive
        rounding.append(callout(gap === 0n ? 'warn' : 'ok',
            `The difference is ${money(gap < 0n ? -gap : gap)} on ten small documents.`,
            'It scales with the number of documents, and it is always in the same '
            + 'direction. Both approaches are exact arithmetic; only one follows the '
            + 'printed instruction.'))
        rounding.append(note(
            'The election is applied once, over the whole line list, at the very end of '
            + 'the report — which is what makes the result round(sum) rather than '
            + 'sum(round). Applying it twice is not applying it once.'))
    }
    root.append(rounding)

    // ── Ties ─────────────────────────────────────────────────────────────────
    const ties = section('And the tie goes away from zero, at both signs')
    ties.append(el('p', {
        html: '"Increase amounts from 50 to 99 cents to the next dollar" is a half-up '
            + 'rule. JavaScript\'s <code>Math.round</code> breaks ties toward positive '
            + 'infinity, so it rounds <code>-2.50</code> to <code>-2</code> — a '
            + 'systematic bias in the taxpayer\'s favour on every loss.',
    }))
    // Run the tie values through the SHIPPED election rather than typing the
    // answers here — the whole page argues that a stated number is worth less
    // than a computed one.
    /** @type {readonly [Source, ...(readonly Source[])]} */
    const tieSource = [{ documentHash: 'demo', boxPath: 'tie', value: 'tie' }]
    /** @type {readonly ReportLine[]} */
    const tieLines = [
        { value: centsFromString('2.50'), sources: tieSource, rule: 'tie, positive' },
        { value: -centsFromString('2.50'), sources: tieSource, rule: 'tie, negative' },
    ]
    const ties250 = applyWholeDollarElection(true)(tieLines)
    ties.append(table(
        ['Value', 'Math.round', 'The engine'],
        ties250.map((line, index) => {
            const original = index === 0 ? 2.5 : -2.5
            return [
                { text: original.toFixed(2), class: 'mono' },
                { text: String(Math.round(original)), class: 'mono' },
                { text: String(line.value / 100n), class: 'mono' },
            ]
        }),
    ))
    ties.append(code(
        '// exact rationals over bigint — no floating point on this path\n'
        + 'halfUp(of(cents)(100n))'))
    ties.append(note(
        'The engine deliberately does NOT share this rounding with the Tax Table\'s. '
        + 'They compute the same numbers today and implement different rules: one is '
        + 'the taxpayer\'s election, which they may decline, and the other is a property '
        + 'of a printed table that has no cents column. Merging them would let declining '
        + 'the election silently stop the table from rounding.'))
    root.append(ties)

    root.append(sourceFooter([
        { label: 'fjs/exact — exact decimal parsing and formatting at the cents scale', path: 'fjs/exact/module.f.js', line: 34, proofLine: 70 },
        { label: 'fjs/report/line — the whole-dollar election, applied once', path: 'fjs/report/line/module.f.js', line: 162, proofLine: 182 },
        { label: 'fjs/form1040/core — where the election is applied in the report', path: 'fjs/form1040/core/module.f.js', line: 1130, proofLine: 1648 },
    ]))
}
