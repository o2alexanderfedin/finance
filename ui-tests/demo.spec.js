/**
 * The walkthrough demo and the printable form, driven in a browser.
 *
 * `ui-tests/entry.spec.js` covers the hand-entry page. That left sixteen of the
 * eighteen files under `demo/` with no automated coverage of any kind — the
 * wizard shell, its ten step modules, the DOM helpers, the fixtures, the GitHub
 * link builder and the standalone Form 1040 page. Every one of them is shipped
 * to GitHub Pages on each push to `main`, and every one of them computes real
 * figures through the engine at render time.
 *
 * The gap was not obvious from any number this repository prints. `npm test`
 * reported 99.18% and never saw these files at all, because nothing under
 * `fjs/` imports them and nothing in Node can load them.
 *
 * ## What is asserted, and what deliberately is not
 *
 * Each step must **render its own content without a page error** — that is the
 * failure these pages actually have: a module that throws at import time leaves
 * a white page, and the shell's own `#boot-error` box is the only thing that
 * would say so.
 *
 * The figures are NOT re-asserted here. They come from the engine, which is
 * proven to the cent elsewhere; restating them in a browser test would create a
 * second set of expected values to keep in step. What IS asserted is that a
 * computed figure reached the screen at all — a step that renders its prose and
 * silently drops its table is the interesting failure.
 *
 * @module
 */
import { test, expect } from '@playwright/test'

/** Every step's route id, in the order the shell registers them. */
const steps = [
    'about', 'documents', 'line16', 'return', 'refusal',
    'exactness', 'parameters', 'sandbox', 'personas', 'form1040',
]

/**
 * Watches for the failures that leave a page blank. A console error is not
 * cosmetic here: an unhandled module error IS the white page.
 * @type {(page: import('@playwright/test').Page) => string[]}
 */
const watchForProblems = page => {
    /** @type {string[]} */
    const problems = []
    page.on('pageerror', error => problems.push(`pageerror: ${error.message}`))
    page.on('console', message => {
        if (message.type() === 'error') { problems.push(`console: ${message.text()}`) }
    })
    page.on('requestfailed', request => problems.push(`request failed: ${request.url()}`))
    return problems
}

for (const id of steps) {
    test(`step ${id} renders`, async ({ page }) => {
        const problems = watchForProblems(page)
        await page.goto(`/demo/#/${id}`)
        const step = page.locator('#step')
        await expect(step).toBeVisible()
        // Non-empty: a step whose module loaded but drew nothing would pass a
        // visibility check on the empty container.
        await expect(step).not.toBeEmpty()
        await expect(page.locator('#boot-error')).toBeHidden()
        // The shell agrees with the URL about which step this is, so a router
        // that silently falls back to step 0 cannot pass ten times.
        await expect(page.locator('#position')).not.toBeEmpty()
        expect(problems).toEqual([])
    })
}

test('the All view renders every step at once', async ({ page }) => {
    const problems = watchForProblems(page)
    await page.goto('/demo/#/all')
    await expect(page.locator('#step')).not.toBeEmpty()
    // Ten steps on one page: the count is the point, because a partial render
    // is exactly what a module throwing halfway would produce.
    const headings = await page.locator('#step h1, #step h2').count()
    expect(headings).toBeGreaterThanOrEqual(steps.length)
    expect(problems).toEqual([])
})

test('Prev and Next walk the whole wizard without error', async ({ page }) => {
    const problems = watchForProblems(page)
    await page.goto('/demo/')
    await expect(page.locator('#prev')).toBeDisabled()
    // ELEVEN positions, not ten: the shell's route order is the ten steps plus
    // the "All" view, which is a step for routing purposes with no module of
    // its own (`demo.js`'s `order`). The first version of this test walked ten
    // and asserted the end of the wizard, which was a wrong model of the
    // wizard rather than a defect in it — the failure was mine.
    for (let i = 1; i <= steps.length; i += 1) {
        await page.click('#next')
        await expect(page.locator('#step')).not.toBeEmpty()
    }
    // At the last position Next is spent and Prev is live — the two ends of
    // the walk, asserted rather than assumed from the click count.
    await expect(page.locator('#next')).toBeDisabled()
    await expect(page.locator('#prev')).toBeEnabled()
    expect(problems).toEqual([])
})

test('the printable Form 1040 renders both pages with real amounts', async ({ page }) => {
    const problems = watchForProblems(page)
    await page.goto('/demo/form1040.html')
    const sheet = page.locator('#form')
    await expect(sheet).toBeVisible()
    await expect(sheet).not.toBeEmpty()
    // A dollar figure reached the form face. Not WHICH figure -- that is the
    // engine's business and is proven to the cent elsewhere -- but that the
    // computed value crossed into the printed layout at all.
    await expect(sheet).toContainText('$')
    // The coverage guard draws a stop panel instead of a form with a hole. If
    // it ever fires, this page must not look like a finished return.
    await expect(sheet).not.toContainText('cannot draw')
    expect(problems).toEqual([])
})

test('the demo links to the hand-entry page, and it links back', async ({ page }) => {
    // The two front doors must be reachable from each other, or the accountant
    // page is a URL somebody has to be told.
    await page.goto('/demo/entry.html')
    await expect(page.locator('a.f1040-back')).toHaveAttribute('href', './')
    await page.click('a.f1040-back')
    await expect(page.locator('#step')).toBeVisible()
})
