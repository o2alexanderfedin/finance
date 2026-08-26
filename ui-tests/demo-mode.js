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

/**
 * The one knob: how fast the demo goes. Everything below is derived from it,
 * so raising `DEMO_SLOW_MO` slows the WHOLE run rather than one part of it —
 * the first version had 700ms and 60ms hard-coded here, which made those
 * stretches un-slowable no matter what pace was asked for.
 */
const pace = (() => {
    const asked = Number(process.env.DEMO_SLOW_MO ?? '1500')
    return Number.isFinite(asked) && asked > 0 ? asked : 1500
})()

/**
 * Reads a millisecond knob from the environment, falling back when it is
 * unset.
 *
 * **`Number('')` is `0`, not `NaN`.** The first version wrote
 * `Number(process.env[name] ?? '')` and then accepted any finite value `>= 0`
 * — so an UNSET variable produced a perfectly valid zero and the fallback was
 * unreachable. Every derived pause was silently 0: no scroll settle, no pause
 * after an action, no hold at the end. The demo flashed exactly as if none of
 * this code existed, while `DEMO_AFTER_MS=4000` worked and made it look like
 * the mechanism was sound.
 *
 * The lesson is the coercion, not the typo: an empty string is the one input
 * that turns "absent" into a legal number.
 * @type {(name: string, fallback: number) => number}
 */
const knob = (name, fallback) => {
    const raw = process.env[name]
    if (raw === undefined || raw.trim() === '') { return fallback }
    const asked = Number(raw)
    return Number.isFinite(asked) && asked >= 0 ? asked : fallback
}

/**
 * Timestamped trace of every pause, enabled with `DEMO_TRACE=1`. Written
 * because "it still flashes" and a measured timeline is the only way to find
 * out which delays actually happen and which are claimed.
 */
const traceOn = process.env.DEMO_TRACE === '1'
const t0 = Date.now()
/** @type {(what: string, ms: number) => void} */
const trace = (what, ms) => {
    if (traceOn) { console.log(`  [t+${String(Date.now() - t0).padStart(6)}ms] ${what} wait=${ms}ms`) }
}

/** How long to let a smooth scroll run before acting. */
const scrollSettleMs = knob('DEMO_SCROLL_MS', Math.max(700, pace / 2))

/**
 * **The pause that was missing.** `slowMo` delays the moment BEFORE an action,
 * so the run pauses, then clicks, then immediately asserts and ends — the
 * RESULT of the click, which is the whole thing worth watching, was on screen
 * for milliseconds before the next step wiped it or the test finished and the
 * window closed. This holds the page still afterwards so the change can be
 * read.
 */
const afterActionMs = knob('DEMO_AFTER_MS', pace)

/**
 * How long to hold the final state of each test before its browser context is
 * torn down. Without this the last assertion passes and the window vanishes
 * on the same frame, so the outcome is never seen at all.
 */
const holdEndMs = knob('DEMO_HOLD_MS', pace * 2)

/**
 * Milliseconds per character when demo mode types into a field.
 *
 * `fill()` sets a field's whole value in one operation — correct, fast, and
 * invisible. Eight boxes on a W-2 become eight instantaneous flashes with a
 * pause between them, so raising `slowMo` buys longer stares at a static page
 * rather than more to watch. In demo mode a fill is therefore CLEARED and then
 * TYPED, which is the part of a form demo an audience actually follows.
 */
const typeDelayMs = knob('DEMO_TYPE_MS', 60)

/**
 * Values worth typing. A long one — a pasted program, a base64 blob — would
 * take a minute a character at a time, so those are still set outright.
 */
const typeable = (/** @type {unknown} */ value) =>
    typeof value === 'string' && value.length > 0 && value.length <= 40

/**
 * Input types a person can actually TYPE into.
 *
 * A `<input type="range">` cannot be typed into at all — `fill` moves the
 * thumb, `pressSequentially` does nothing. The first version of the typing
 * change ignored this and broke exactly one test, the line-16 income slider,
 * which is the whole reason the full suite is run in demo mode before this
 * ships: the divergence between "set the value" and "type the value" is real,
 * and it shows up on the controls where typing is not a thing.
 */
const typeableControl = (/** @type {import('@playwright/test').Locator} */ locator) =>
    locator.evaluate(node => {
        if (node instanceof HTMLTextAreaElement) { return true }
        if (!(node instanceof HTMLInputElement)) { return false }
        return ['text', 'email', 'search', 'tel', 'url', 'password', 'number', '']
            .includes(node.type)
    }).catch(() => false)

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
        trace('scroll-settle', scrollSettleMs)
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
                // A typed fill fires an `input` event per keystroke where
                // `fill` fires one. That is a real behavioural difference, so
                // it is verified rather than assumed: the whole suite runs in
                // demo mode, and a page that misbehaved under per-character
                // input would redden there.
                const type = name === 'fill' && typeable(args[0])
                    && await typeableControl(target)
                // Typing is visible but FRAGILE in a way `fill` is not: it
                // takes many keystrokes over hundreds of milliseconds, and if
                // the page redraws the field in that window the characters go
                // to a detached node and the field is left EMPTY. That is not
                // hypothetical — it emptied `formRevision` in the walkthrough
                // and the engine refused the document for a missing value,
                // which reads like an app bug and is not one.
                //
                // So the typed value is read back, and a fill repairs it if it
                // did not stick. Demo mode may look different; it must never
                // end up with different data than `fill` would have produced.
                const wanted = String(args[0])
                const done = type
                    ? await target.clear()
                        .then(() => target.pressSequentially(wanted, { delay: typeDelayMs }))
                        .then(() => target.inputValue())
                        .then(got => got === wanted ? undefined : value.apply(target, args))
                    : await value.apply(target, args)
                // Hold the result on screen. Without this the next step starts
                // immediately and the change is never seen.
                trace(`after-locator.${name}`, afterActionMs)
                await target.page().waitForTimeout(afterActionMs)
                return done
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
                // `goto`'s first argument is a URL, not a selector -- passing
                // it to `locator()` would be nonsense. It still earns a pause
                // afterwards: without one, the freshly drawn page is acted on
                // before anybody has looked at it.
                if (name !== 'goto' && typeof selector === 'string') {
                    await reveal(target.locator(selector))
                }
                const done = await value.apply(target, args)
                trace(`after-page.${name}`, afterActionMs)
                await target.waitForTimeout(afterActionMs)
                return done
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

// Hold the finished state before the context is torn down. A test's last
// assertion passing and its window disappearing happen on the same frame
// otherwise, so the outcome — the computed 1040, the opened citation panel —
// is the one thing a watcher never gets to look at.
if (demoMode) {
    test.afterEach(async ({ page }) => {
        trace('hold-end-of-test', holdEndMs)
        await page.waitForTimeout(holdEndMs).catch(() => undefined)
    })
}

export { expect }
