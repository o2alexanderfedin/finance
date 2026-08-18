/**
 * Step 8 — who this engine can actually do taxes for.
 *
 * Four reference taxpayers were chosen at the start of the milestone precisely
 * because they were hard, and three of the four were REFUSED then. All four
 * compute a full Form 1040 today. The interesting half of that sentence is the
 * word "full": each one needed a specific set of forms, and this page names
 * them rather than saying "supports most situations".
 *
 * The two dollar figures on this page are the only hand-transcribed values in
 * it. They cannot be computed from the sample return — they come from other
 * taxpayers' fixtures, which live in the engine's own proofs — so each is
 * labelled as transcribed and linked to the exact proof leaf that asserts it.
 * Everything else, including the whole refusal partition, is read off the
 * engine at render time.
 *
 * @module
 */
import { el, anchor, section, table, callout, note } from '../lib/dom.js'
import { sourceFooter, sourceUrl } from '../lib/github.js'
import {
    modeledKinds, unmodeledKindRefusals, kindVocabulary, tripwires,
} from '../lib/engine.js'

/** @import { Step } from '../demo.js' */

export const id = 'personas'
export const kicker = 'Step 8'
export const title = 'Who it can do taxes for'
// The refusal count is READ, not typed — the same discipline the rest of the
// demo keeps. A beat is evaluated at module load, and every import it needs is
// already resolved by then.
export const beat = 'Four reference taxpayers, chosen because they were hard. A milestone ago one of '
    + `them computed; all four do now — and the engine still refuses ${unmodeledKindRefusals.length} `
    + 'kinds by name, which is the same fact stated the other way round.'
export const tier = 'must'

/**
 * A reference taxpayer.
 *
 * `needs` is the list of forms and schedules the return does NOT compute
 * without — not a list of everything touched. That distinction is the point of
 * the page: a taxpayer is "supported" when the mandatory forms compute, not
 * when the common ones do.
 * @typedef {{
 *   readonly who: string,
 *   readonly turns: string,
 *   readonly needs: readonly string[],
 *   readonly was: string,
 * }} Persona
 */

/**
 * The four, in the order `.planning/PERSONA-COVERAGE.md` introduces them.
 *
 * The `was` column is the verdict at the START of milestone v2, kept because
 * "all four compute" is a much weaker claim without it: three of these four
 * produced no return at all, and one produced a wrong one.
 * @type {readonly Persona[]}
 */
const personas = [
    {
        who: 'Retiree',
        turns: 'Distributions that are not all taxable, and a charitable transfer that never becomes income at all.',
        needs: [
            'Qualified charitable distributions — excluded from line 4b rather than deducted',
            'Form 8606 Parts I and II — after-tax IRA basis, so basis is not taxed twice',
            'Social Security Benefits Worksheet — the 18-line one, for line 6b',
        ],
        was: 'computed',
    },
    {
        who: 'Non-profit worker',
        turns: 'Ordinary wages, and three above-the-line adjustments that a return omitting them silently overstates.',
        needs: [
            'Student loan interest deduction — Schedule 1-A, from Form 1098-E',
            'Educator expenses — Schedule 1-A',
            'HSA deduction — Form 8889 Part I',
            'Earned income credit — Schedule EIC, on 1040 line 27a',
        ],
        was: 'computed, and overstated the tax',
    },
    {
        who: 'FAANG engineer',
        turns: 'Wages large enough to trigger two surtaxes nobody files voluntarily, plus equity that arrives already taxed.',
        needs: [
            'Form 8959 — Additional Medicare Tax, mandatory above $200,000 of wages',
            'Form 8960 — Net Investment Income Tax',
            'Form 6251 Parts I, II and III — AMT, including the preferential bands',
            'Basis correction — the broker reports $0 basis on stock payroll already taxed',
        ],
        was: 'refused',
    },
    {
        who: 'Startup founder',
        turns: 'Income that arrives without withholding, through an entity whose type changes the answer.',
        needs: [
            'Schedule C — net profit or loss from the business',
            'Schedule SE — self-employment tax, and the deductible half',
            'Form 8995 / 8995-A — the qualified business income deduction, below and above the threshold',
            'Schedule E and Schedules K-1 — partnership and S-corporation pass-through',
        ],
        was: 'refused, and not close',
    },
]

/**
 * One hand-transcribed figure, with the proof leaf that asserts it.
 *
 * These are the only two values on this page not read from the engine at
 * render time. Both come from fixtures that are not this demo's sample return
 * — a $1,000,000 equity position and an $80,000 pass-through — so there is
 * nothing on this page to compute them from. Rather than invent a fifth
 * fixture to re-derive a number the engine already asserts, they are
 * transcribed and linked, exactly as step 2's regression cases are.
 * @typedef {{
 *   readonly amount: string,
 *   readonly headline: string,
 *   readonly body: string,
 *   readonly proofPath: string,
 *   readonly proofLine: number,
 *   readonly proofName: string,
 * }} Figure
 */

/** @type {readonly Figure[]} */
const figures = [
    {
        amount: '$49,467.75',
        headline: 'of equity income was being taxed twice.',
        body: 'A broker reports $0 cost basis on shares that vested through payroll — correctly, '
            + 'because the broker never saw the compensation event. The wages were already taxed '
            + 'on the W-2. Sell the shares and the same money is taxed a second time as a capital '
            + 'gain against a basis of nothing. On the reference return that is $150,000.00 of '
            + 'phantom gain: AGI $350,000.00 instead of $200,000.00, and $86,534.75 of tax where '
            + '$37,067.00 is owed.',
        proofPath: 'fjs/form1040/core/module.f.js',
        proofLine: 10025,
        proofName: 'theDoubleTaxationIsPricedAtFortyNineThousandFourHundredAndSixtySeven',
    },
    {
        amount: '$10,049.64',
        headline: 'separates a general partner from an S-corp shareholder.',
        body: 'Same $80,000.00 of business income, same person, same work. A general partner\'s '
            + 'share is self-employment income and carries self-employment tax; an S-corporation '
            + 'shareholder\'s distributive share is not, under Rev. Rul. 59-221. Line 8, line 9 '
            + 'and the standard deduction are identical on both returns; total tax is not. When '
            + 'the stored documents do not say which one you are, the engine refuses rather than '
            + 'picking the cheaper reading.',
        proofPath: 'fjs/form1040/core/module.f.js',
        proofLine: 4736,
        proofName: 'anSCorporationShareholderOwesNoSelfEmploymentTaxOnTheSameEightyThousand',
    },
]

/** @type {Step['render']} */
export const render = root => {
    // ── The four ─────────────────────────────────────────────────────────────
    const four = section(
        'Four reference taxpayers',
        'Chosen at the start of the milestone because each one breaks a different part of a 1040. Three of the four were refused outright then.')
    four.append(table(
        ['Person', 'At the start', 'Today'],
        personas.map(persona => [
            persona.who,
            { text: persona.was, class: 'dim' },
            el('span', { class: 'method', text: 'a full Form 1040' }),
        ]),
    ))
    four.append(note(
        'The middle column is what makes the right one worth anything. "Supports four personas" '
        + 'said about four easy ones is not a claim; these were picked to be the hard ones.'))

    for (const persona of personas) {
        const card = el('div', { class: 'persona' })
        card.append(el('h4', { text: persona.who }))
        card.append(el('p', { class: 'lede', text: persona.turns }))
        const list = el('ul')
        for (const need of persona.needs) { list.append(el('li', { text: need })) }
        card.append(list)
        four.append(card)
    }
    four.append(note(
        'Each list is what the return does not compute WITHOUT — the mandatory set, not '
        + 'everything touched. Form 8959 is the clearest case: it is not optional above '
        + '$200,000 of wages, and a return that quietly omits it understates the tax.'))
    root.append(four)

    // ── The two figures ──────────────────────────────────────────────────────
    const priced = section(
        'Two figures worth knowing',
        'Both are what a wrong answer costs, priced end to end by the engine on real fixtures.')
    priced.append(callout('warn', 'These two are hand-transcribed, and that is why they are labelled.',
        'Every other number in this demo is computed in your browser while you watch. These two '
        + 'come from other taxpayers\' fixtures inside the engine\'s own proofs, so there is '
        + 'nothing on this page to recompute them from. Each links to the proof leaf that '
        + 'asserts it, which is the only honest way to put a figure you did not compute on a '
        + 'page that promises it computes everything.'))
    for (const figure of figures) {
        const block = el('div', { class: 'persona' })
        const row = el('div', { class: 'figure-row' })
        row.append(el('span', { class: 'big-figure', text: figure.amount }))
        row.append(el('span', { class: 'kicker', text: figure.headline }))
        block.append(row)
        block.append(el('p', { text: figure.body }))
        const link = el('p', { class: 'note' })
        link.append(el('span', { text: 'asserted by ' }))
        link.append(anchor(
            sourceUrl(figure.proofPath, figure.proofLine),
            `proof.${figure.proofName} ↗`))
        block.append(link)
        priced.append(block)
    }
    root.append(priced)

    // ── Refusal is the product ───────────────────────────────────────────────
    const partition = section(
        'Refusing by name is the product, not the limitation',
        'The same engine that files those four returns declines to file a great many others, and it can tell you exactly which.')
    partition.append(table(
        ['', 'Count', 'Meaning'],
        [
            ['Kinds in the frozen vocabulary', { text: String(kindVocabulary.length), class: 'money' }, 'Every income, deduction, credit and payment a return can declare'],
            ['Modeled', { text: String(modeledKinds.length), class: 'money' }, 'Computed end to end, with proofs'],
            ['Refused by name', { text: String(unmodeledKindRefusals.length), class: 'money' }, 'Each names the 1040 line and the form that would supply it'],
            ['Tripwires', { text: String(tripwires.length), class: 'money' }, 'Fire when the DOCUMENTS prove an obligation the profile never declared'],
        ],
    ))
    partition.append(note(
        'Read off the engine at render time, never typed on this page. Modeled and refused are a '
        + 'partition checked by tsc: a compile-time assertion fails the build if any kind falls '
        + 'in neither, so the two counts cannot drift apart or quietly leave a gap between them.'))
    partition.append(el('p', {
        html: 'The reason this is the product rather than an apology for it: <strong>every tax '
            + 'engine has a boundary.</strong> The question is only whether it knows where the '
            + 'boundary is. One that does not will hand you a return with a confident zero on '
            + 'the line it could not compute, and nothing on the page distinguishes that zero '
            + 'from a zero it worked out.',
    }))
    partition.append(el('p', {
        text: 'This one refuses the whole return instead, names the kind, names the 1040 line it '
            + 'belongs on, and names the form that would supply it. Step 4 lets you tick one and '
            + 'watch the return disappear.',
    }))
    partition.append(callout('info', 'The tripwires are the harder half of the same idea.',
        'A refusal you declared is easy — you asked for something we do not model. A tripwire '
        + 'fires on a taxpayer who has never heard of the form: the documents in the store prove '
        + 'an obligation the profile did not declare, so the return refuses rather than compute '
        + 'without it. Without one of them, a $300,000 W-2 understated the tax by roughly $900, '
        + 'silently. And each tripwire is proven to stay QUIET on a return that does not owe the '
        + 'thing — a tripwire that always fires is not a tripwire.'))
    root.append(partition)

    root.append(sourceFooter([
        { label: '.planning/CAPABILITIES.md — the measured surface at this release', path: '.planning/CAPABILITIES.md' },
        { label: '.planning/PERSONA-COVERAGE.md — the survey these four come from', path: '.planning/PERSONA-COVERAGE.md' },
        { label: 'fjs/return/scope — the modeled/refused partition and its tsc assertion', path: 'fjs/return/scope/module.f.js', line: 474, proofLine: 1555 },
        { label: 'fjs/return/tripwire — the eight tripwires, in 1040 form order', path: 'fjs/return/tripwire/module.f.js', line: 348, proofLine: 785 },
        { label: 'fjs/form8959 — Additional Medicare Tax (FAANG engineer)', path: 'fjs/form8959/module.f.js' },
        { label: 'fjs/form6251/part3 — AMT on the preferential bands (FAANG engineer)', path: 'fjs/form6251/part3/module.f.js' },
        { label: 'fjs/schedule/se — self-employment tax (startup founder)', path: 'fjs/schedule/se/module.f.js' },
        { label: 'fjs/form8995 — the qualified business income deduction (startup founder)', path: 'fjs/form8995/module.f.js' },
        { label: 'fjs/form8606 — after-tax IRA basis (retiree)', path: 'fjs/form8606/module.f.js' },
        { label: 'fjs/schedule/eic — the earned income credit (non-profit worker)', path: 'fjs/schedule/eic/module.f.js' },
    ]))
}
