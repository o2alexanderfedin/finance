/**
 * The `test` every spec imports — plain Playwright, plus one demo-mode habit:
 * **scroll the thing being acted on into the middle of the screen, visibly,
 * before acting on it.**
 *
 * ## Why this file has to exist
 *
 * Playwright already scrolls an element into view before clicking it, so the
 * click never misses. But it scrolls over CDP, and that jump is instant and
 * ignores CSS. Measured, rather than assumed — a probe sampled `window.scrollY`
 * every animation frame across a pre-action scroll, with and without
 * `html { scroll-behavior: smooth }` injected into the page:
 *
 * ```
 * smooth=false  before=0 after=8041  distinct samples: 2   (0, 8041)
 * smooth=true   before=0 after=8041  distinct samples: 2   (0, 8041)
 * ```
 *
 * Two samples means one frame: the page teleports 8041px. Identical with the
 * CSS and without it. So injecting `scroll-behavior: smooth` — the obvious
 * first idea, and the one this file originally contained — is **cargo cult**:
 * it reads like a fix and does nothing. A watcher sees the page snap to a
 * different position with no sense of where it came from or what moved.
 *
 * The only way to make the scroll observable is to perform it ourselves, in
 * the page, before handing over to Playwright — `scrollIntoView({ behavior:
 * 'smooth', block: 'center' })`, then wait for it to settle. Playwright's own
 * `scrollIntoViewIfNeeded()` still runs afterwards as part of the action; by
 * then the element is already centred, so it has nothing left to do and the
 * jump nobody can follow never happens.
 *
 * ## Why it is safe
 *
 * **In regular mode this file returns Playwright's own objects untouched.**
 * The wrapper is constructed only when `DEMO=1`, so nothing here can affect
 * `npm test` or CI: the proxy does not exist on that path. That is deliberate
 * — a presentation aid that could redden the real suite would be a bad trade
 * at any level of polish.
 *
 * @module
 */
import { test as base, expect } from '@playwright/test'

const demoMode = process.env.DEMO === '1' || process.env.DEMO === 'true'

/** How long to let a smooth scroll run before acting. */
const scrollSettleMs = 700

/**
 * Locator methods that DO something to the page. These are the ones worth
 * scrolling to first; a method that merely reads (`innerText`, `count`) must
 * not move the page, or the view would lurch on assertions too.
 */
const actionNames = new Set([
    'click', 'dblclick', 'fill', 'check', 'uncheck', 'setChecked',
    'selectOption', 'press', 'hover', 'focus', 'tap', 'type', 'clear',
    'selectText', 'setInputFiles', 'dragTo',
])

/** Methods that return another locator, which must stay wrapped. */
const chainNames = new Set([
    'first', 'last', 'nth', 'filter', 'locator', 'and', 'or',
    'getByRole', 'getByText', 'getByLabel', 'getByTestId',
    'getByPlaceholder', 'getByAltText', 'getByTitle',
])

/**
 * Centres `locator` on screen with a real, animated scroll — but only when it
 * is not already comfortably visible, so a run does not jitter between two
 * controls that share a screen.
 * @type {(locator: import('@playwright/test').Locator) => Promise<void>}
 */
const reveal = async locator => {
    // Every step is best-effort. A locator that resolves to nothing, or to
    // many nodes, is Playwright's business to report from the real action --
    // this helper must never turn a clear assertion failure into a confusing
    // one raised from inside a scrolling convenience.
    try {
        const needed = await locator.evaluate(node => {
            const box = node.getBoundingClientRect()
            const margin = window.innerHeight * 0.25
            return box.top < margin || box.bottom > window.innerHeight - margin
        })
        if (needed !== true) { return }
        await locator.evaluate(node => node.scrollIntoView({ behavior: 'smooth', block: 'center' }))
        await locator.page().waitForTimeout(scrollSettleMs)
    } catch { /* leave it to the action itself */ }
}

/**
 * @type {(locator: import('@playwright/test').Locator) => import('@playwright/test').Locator}
 */
const wrapLocator = locator => new Proxy(locator, {
    get: (target, property, receiver) => {
        const value = Reflect.get(target, property, receiver)
        if (typeof value !== 'function') { return value }
        const name = String(property)
        if (actionNames.has(name)) {
            return async (/** @type {readonly unknown[]} */ ...args) => {
                await reveal(target)
                return value.apply(target, args)
            }
        }
        if (chainNames.has(name)) {
            return (/** @type {readonly unknown[]} */ ...args) =>
                wrapLocator(value.apply(target, args))
        }
        return value.bind(target)
    },
})

/** Page methods that take a selector and then act on it. */
const pageActionNames = new Set([
    'click', 'dblclick', 'fill', 'check', 'uncheck', 'setChecked',
    'selectOption', 'press', 'hover', 'focus', 'tap', 'type',
])

/** Page methods that hand back a locator. */
const pageLocatorNames = new Set([
    'locator', 'getByRole', 'getByText', 'getByLabel', 'getByTestId',
    'getByPlaceholder', 'getByAltText', 'getByTitle',
])

/**
 * @type {(page: import('@playwright/test').Page) => import('@playwright/test').Page}
 */
const wrapPage = page => new Proxy(page, {
    get: (target, property, receiver) => {
        const value = Reflect.get(target, property, receiver)
        if (typeof value !== 'function') { return value }
        const name = String(property)
        if (pageLocatorNames.has(name)) {
            return (/** @type {readonly unknown[]} */ ...args) =>
                wrapLocator(value.apply(target, args))
        }
        if (pageActionNames.has(name)) {
            return async (/** @type {readonly unknown[]} */ ...args) => {
                const [selector] = args
                if (typeof selector === 'string') { await reveal(target.locator(selector)) }
                return value.apply(target, args)
            }
        }
        return value.bind(target)
    },
})

/**
 * The `test` object the specs use. Identical to Playwright's outside demo
 * mode — `wrapPage` is never even called.
 */
export const test = base.extend({
    page: async ({ page }, use) => {
        await use(demoMode ? wrapPage(page) : page)
    },
})

export { expect }
