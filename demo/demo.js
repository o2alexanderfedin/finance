/**
 * The wizard shell: a step registry, a hash router, Prev/Next, and an "All"
 * view that renders every step onto one scrolling page for questions.
 *
 * The shell knows nothing about any step's contents. A step is an ES module
 * exporting `{ id, title, beat, tier, render }`, and `render(root)` is handed
 * an empty element to fill. That is the whole contract, which is why a step
 * can be cut on the morning of a demo by deleting one line below.
 *
 * @module
 */
import { sha, shortSha, planningUrl } from './lib/github.js'
import { el } from './lib/dom.js'

import * as about from './steps/00-about.js'
import * as documents from './steps/01-documents.js'
import * as line16 from './steps/02-line16.js'
import * as theReturn from './steps/03-return.js'
import * as refusal from './steps/04-refusal.js'
import * as exactness from './steps/05-exactness.js'
import * as parameters from './steps/06-parameters.js'
import * as sandbox from './steps/07-sandbox.js'

/**
 * A step module's contract, in full. The shell knows this and nothing else
 * about any step — which is why a step can be cut on the morning of a demo by
 * deleting one entry from the list below.
 * @typedef {{
 *   readonly id: string,
 *   readonly title: string,
 *   readonly kicker?: string,
 *   readonly beat?: string,
 *   readonly tier?: string,
 *   readonly render: (root: HTMLElement) => void,
 * }} Step
 */

/** Ship order. Every prefix of this list is a complete demo.
 * @type {readonly Step[]}
 */
const steps = [about, documents, line16, theReturn, refusal, exactness, parameters, sandbox]

/** The "All" view is a step for routing purposes, with no module of its own. */
const allId = 'all'

/**
 * A required element, by id and expected type.
 *
 * `getElementById` yields `HTMLElement | null`, and `instanceof` narrows to the
 * specific type without a cast — which matters because the shell reaches for
 * `.href` and `.disabled`, and a bare `HTMLElement` has neither.
 * @type {<T extends HTMLElement>(id: string, kind: new () => T) => T}
 */
const required = (id, kind) => {
    const node = document.getElementById(id)
    if (!(node instanceof kind)) {
        throw `demo shell: #${id} is missing from index.html, or is the wrong element`
    }
    return node
}

const stepNav = required('steps', HTMLElement)
const stepBody = required('step', HTMLElement)
const prevButton = required('prev', HTMLButtonElement)
const nextButton = required('next', HTMLButtonElement)
const position = required('position', HTMLElement)
const badge = required('badge', HTMLAnchorElement)
const badgeText = required('badge-text', HTMLElement)

// The badge states a historical fact about a pinned commit — the only honest
// way to put a test count on a page that outlives the count.
badge.href = planningUrl('10-VERIFICATION.md')
badge.title = `verified at ${shortSha}`
badgeText.textContent = `494/494 · 492 proofs · ${shortSha}`

/** Every routable id, in order. @type {readonly string[]} */
const order = [...steps.map(step => step.id), allId]

/**
 * The first routable id. Bound with an explicit check rather than indexed
 * inline: `noUncheckedIndexedAccess` makes `order[0]` a `string | undefined`,
 * and a cast or a `!` is banned. It is unreachable — `steps` is never empty.
 */
const firstId = order[0]
if (firstId === undefined) { throw 'demo shell: the step list is empty' }

/** The id in the URL hash, defaulting to the first step. @type {() => string} */
const currentId = () => {
    const id = window.location.hash.replace(/^#\/?/, '')
    return order.includes(id) ? id : firstId
}

/**
 * Renders one step into a fresh container.
 *
 * A step that throws must not blank the page: the failure is caught, drawn
 * where the step would have been, and the rest of the demo keeps working. On
 * stage, a broken panel that says so beats a white screen.
 * @type {(step: Step) => HTMLElement}
 */
const renderStep = step => {
    const container = el('div', { class: 'step-panel' })
    const head = el('div', { class: 'step-head' })
    head.append(el('span', { class: 'kicker', text: step.kicker ?? 'Step' }))
    head.append(el('h2', { text: step.title }))
    if (step.beat !== undefined) { head.append(el('p', { class: 'beat', text: step.beat })) }
    container.append(head)
    const body = el('div')
    try {
        step.render(body)
    } catch (error) {
        // fjs throws bare values, so this is never assumed to be an `Error`.
        body.append(el('div', {
            class: 'callout callout-stop',
            text: `This step failed to render: ${String(error)}`,
        }))
    }
    container.append(body)
    return container
}

const renderAll = () => {
    const container = el('div')
    const head = el('div', { class: 'step-head' })
    head.append(el('span', { class: 'kicker', text: 'All steps' }))
    head.append(el('h2', { text: 'Everything, on one page' }))
    head.append(el('p', {
        class: 'beat',
        text: 'The same steps, rendered together, for questions. Every figure is recomputed here — nothing is cached from the pages you just walked through.',
    }))
    container.append(head)
    for (const step of steps) {
        const wrap = el('div', { class: 'all-step' })
        wrap.append(renderStep(step))
        container.append(wrap)
    }
    return container
}

/**
 * One tab. `anchor` is for links that leave the page, so these are built here:
 * a same-document hash link must NOT open in a new tab.
 * @type {(href: string, marker: string, label: string, current: boolean, className: string) => HTMLAnchorElement}
 */
const tab = (href, marker, label, current, className) => {
    const link = document.createElement('a')
    link.className = className
    link.href = href
    link.append(el('span', { class: 'n', text: marker }))
    link.append(el('span', { text: label }))
    if (current) { link.setAttribute('aria-current', 'true') }
    return link
}

/** @type {(id: string) => void} */
const drawNav = id => {
    stepNav.replaceChildren()
    steps.forEach((step, index) => {
        stepNav.append(tab(
            `#/${step.id}`,
            String(index),
            step.title,
            step.id === id,
            step.tier === 'optional' ? 'tier-optional' : '',
        ))
    })
    stepNav.append(tab(`#/${allId}`, '∑', 'All', id === allId, ''))
}

const draw = () => {
    const id = currentId()
    const index = order.indexOf(id)
    drawNav(id)
    stepBody.replaceChildren()
    const found = steps.find(step => step.id === id)
    stepBody.append(found === undefined ? renderAll() : renderStep(found))
    prevButton.disabled = index <= 0
    nextButton.disabled = index >= order.length - 1
    position.textContent = id === allId
        ? 'All steps'
        : `${index + 1} of ${order.length}`
    window.scrollTo({ top: 0 })
    stepBody.focus({ preventScroll: true })
}

/** @type {(delta: number) => void} */
const go = delta => {
    const target = order[order.indexOf(currentId()) + delta]
    if (target === undefined) { return }
    window.location.hash = `#/${target}`
}

prevButton.addEventListener('click', () => go(-1))
nextButton.addEventListener('click', () => go(1))
window.addEventListener('hashchange', draw)

// Arrow keys move between steps, unless the focus is on a control that uses
// them itself — a slider or a select.
window.addEventListener('keydown', event => {
    if (event.metaKey || event.ctrlKey || event.altKey) { return }
    const target = event.target
    if (target instanceof HTMLElement
        && ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName)) { return }
    if (event.key === 'ArrowRight') { go(1) }
    if (event.key === 'ArrowLeft') { go(-1) }
})

draw()

// A pinned build is worth stating once where anyone can find it.
console.info(`finance demo — engine pinned to ${sha}`)
