/**
 * Every interactive control in the demo, actually operated.
 *
 * ## The gap this closes
 *
 * `demo.spec.js` asserts that each of the ten steps RENDERS: visible, non-empty,
 * no page error. That is the failure which blanks a page, and it is worth
 * catching. But it is the only failure those tests can catch.
 *
 * Six of the step modules install event handlers — a slider, a `<select>`, two
 * kinds of checkbox, four preset buttons, a clickable table row, a live text
 * box, a citation-opening amount box, and the printable form's print button.
 * **Not one of them was ever clicked by a test.** A handler that threw on its
 * first click would have left all 31 browser tests green, because rendering is
 * not clicking, and the demo's whole claim — that these figures are computed
 * live by the shipped engine rather than baked into the page — lives entirely
 * on the far side of a handler no test invoked.
 *
 * ## What is asserted
 *
 * Each test drives a control and asserts the DOM CHANGED IN THE WAY THAT
 * CONTROL PROMISES — not merely that something happened. The four presets in
 * step 2 are the sharpest example: each one claims to select a different
 * printed branch of the line-16 dispatcher, so the test clicks each and reads
 * back the method the engine chose. A preset wired to the wrong state, or a
 * dispatcher that silently fell through to the Tax Table, fails here and
 * nowhere else in this repository.
 *
 * The figures themselves are NOT re-asserted to the cent. That is proven in the
 * engine's own leaves, and restating amounts here would create a second set of
 * expected values to keep in step. What is asserted is that the control reached
 * the engine and the engine's answer reached the screen.
 *
 * @module
 */
import { test, expect } from '@playwright/test'

/**
 * Watches for the failures that leave a page blank or a handler dead. An
 * unhandled error inside a click handler surfaces here and nowhere else.
 * @type {(page: import('@playwright/test').Page) => string[]}
 */
const watchForProblems = page => {
    /** @type {string[]} */
    const problems = []
    page.on('pageerror', error => problems.push(`pageerror: ${error.message}`))
    page.on('console', message => {
        if (message.type() === 'error') { problems.push(`console: ${message.text()}`) }
    })
    return problems
}

// ── Step 2: the live line-16 dispatcher ──────────────────────────────────────

/**
 * Each preset's button label, and the method the dispatcher must choose once
 * that preset is applied. These method names are the engine's own keys, read
 * back out of the page — so a rename upstream reddens this rather than passing
 * against a stale string.
 */
const presets = [
    { label: 'Tax Table', method: 'taxTable' },
    { label: 'Tax Computation Worksheet', method: 'taxComputationWorksheet' },
    { label: 'Qualified Dividends worksheet', method: 'qdcgt' },
    { label: 'Schedule D Tax Worksheet', method: 'scheduleDTaxWorksheet' },
]

for (const { label, method } of presets) {
    test(`line 16: the "${label}" preset selects the ${method} branch`, async ({ page }) => {
        const problems = watchForProblems(page)
        await page.goto('/demo/#/line16')
        await page.getByRole('button', { name: label, exact: true }).click()
        // The method tag is the dispatcher's own answer, not the button's label.
        await expect(page.locator('#step .method').first()).toHaveText(method)
        // And a figure was priced -- a branch that selected but computed
        // nothing would leave this empty.
        await expect(page.locator('#step .big-figure').first()).not.toBeEmpty()
        expect(problems).toEqual([])
    })
}

test('line 16: moving the income slider reprices the return', async ({ page }) => {
    const problems = watchForProblems(page)
    await page.goto('/demo/#/line16')
    const figure = page.locator('#step .big-figure').first()
    const before = await figure.innerText()
    // `fill` on a range input sets the value AND dispatches `input`, which is
    // the event the handler listens for.
    await page.locator('#step input[type="range"]').first().fill('150000')
    await expect(figure).not.toHaveText(before)
    expect(problems).toEqual([])
})

test('line 16: changing filing status reprices the return', async ({ page }) => {
    const problems = watchForProblems(page)
    await page.goto('/demo/#/line16')
    const select = page.locator('#step select').first()
    const figure = page.locator('#step .big-figure').first()
    const before = await figure.innerText()
    // Pick whichever option is not currently selected, so the test does not
    // depend on the neutral status keeping its name.
    const values = await select.locator('option').evaluateAll(nodes =>
        nodes.map(node => /** @type {HTMLOptionElement} */(node).value))
    const current = await select.inputValue()
    const other = values.find(value => value !== current)
    expect(other, 'the status list must offer more than one status').toBeTruthy()
    await select.selectOption(String(other))
    await expect(figure).not.toHaveText(before)
    expect(problems).toEqual([])
})

test('line 16: a scope toggle marks itself and reaches the engine', async ({ page }) => {
    const problems = watchForProblems(page)
    await page.goto('/demo/#/line16')
    const method = page.locator('#step .method').first()
    const before = await method.innerText()
    // Form 8615 is one of the kinds this engine does NOT model, so checking it
    // must change the dispatcher's answer rather than merely tint a label.
    const label = page.locator('#step label', { hasText: 'Form 8615' }).first()
    await label.locator('input[type="checkbox"]').check()
    await expect(label).toHaveClass(/on/)
    await expect(method).not.toHaveText(before)
    expect(problems).toEqual([])
})

// ── Step 3: the return, and its citations ────────────────────────────────────

test('return: clicking a line selects it and opens its sources', async ({ page }) => {
    const problems = watchForProblems(page)
    await page.goto('/demo/#/return')
    const row = page.locator('#step tr.clickable').first()
    await expect(row).not.toHaveClass(/selected/)
    await row.click()
    // Selection is single: the row clicked is marked, and it is the only one.
    await expect(row).toHaveClass(/selected/)
    await expect(page.locator('#step tr.selected')).toHaveCount(1)
    expect(problems).toEqual([])
})

// ── Step 4: the refusal ──────────────────────────────────────────────────────

test('refusal: declaring an unmodeled kind makes the engine decline', async ({ page }) => {
    const problems = watchForProblems(page)
    await page.goto('/demo/#/refusal')
    const label = page.locator('#step .checks label').first()
    await label.locator('input[type="checkbox"]').check()
    await expect(label).toHaveClass(/on/)
    // The point of the step: an undeclared kind is refused BY NAME rather than
    // quietly computed as a zero.
    await expect(page.locator('#step')).toContainText('declines to file')
    expect(problems).toEqual([])
})

// ── Step 7: the import gate, driven live ─────────────────────────────────────

test('sandbox: the gate refuses every import and admits a program with none', async ({ page }) => {
    const problems = watchForProblems(page)
    await page.goto('/demo/#/sandbox')
    const box = page.locator('#step input[type="text"]').first()
    // The verdict panel is the div appended immediately after the try-it
    // control, which is what makes this structural rather than positional --
    // the specimen table above it is full of `.method` spans too.
    const verdict = page.locator('#step .control:has(input[type="text"]) + div .method')

    // It loads pre-filled with a host import, which must be refused.
    await expect(verdict).toHaveText('refused')

    // **A relative import is refused too, and that is not a bug.** The step
    // calls `checkSpecifiers([])` -- an allow-list with NOTHING on it -- so
    // every quoted specifier fails, `./module.f.js` included. The first draft
    // of this test asserted "admitted" here on the assumption that relative
    // imports are harmless; `fjs/guest/materialize/module.f.js:203` says
    // otherwise, and a stored report program imports nothing at all.
    await box.fill('import { f } from \'./module.f.js\'')
    await expect(verdict).toHaveText('refused')

    // No import, no specifier to check: admitted. This is the only shape that
    // passes, and it is the shape every stored program actually has.
    await box.fill('export const main = () => 1')
    await expect(verdict).toHaveText('admitted')

    // And a specifier the gate cannot read statically must NOT be waved
    // through -- a gate that cannot decide refuses.
    await box.fill('import(someVariable)')
    await expect(verdict).toHaveText('refused')
    expect(problems).toEqual([])
})

// ── Step 9 and the printable page: citations on the form face ────────────────

test('form 1040 step: clicking an amount opens its citation panel', async ({ page }) => {
    const problems = watchForProblems(page)
    await page.goto('/demo/#/form1040')
    const box = page.locator('#step button.f1040-amt').first()
    await box.click()
    await expect(box).toHaveClass(/f1040-amt-open/)
    // The panel names the line and lists where the number came from -- a
    // figure without its source is the failure this project exists to prevent.
    const detail = page.locator('#step .f1040-detail')
    await expect(detail).toContainText('citation')
    await expect(detail.locator('table')).toBeVisible()
    // One panel at a time: two open at once would let a reader read a line
    // number against the wrong source list.
    await expect(page.locator('#step .f1040-amt-open')).toHaveCount(1)
    expect(problems).toEqual([])
})

test('the printable form\'s print button is wired to the browser', async ({ page }) => {
    const problems = watchForProblems(page)
    await page.goto('/demo/form1040.html')
    // `window.print()` would block on a real print dialog, so it is replaced
    // before the click. Asserting the CALL is the point: the button existing
    // and the button working are different claims.
    await page.evaluate(() => {
        Object.defineProperty(window, 'printed', { value: false, writable: true })
        window.print = () => { /** @type {any} */(window).printed = true }
    })
    await page.click('#print')
    expect(await page.evaluate(() => /** @type {any} */(window).printed)).toBe(true)
    expect(problems).toEqual([])
})

// ── The shell itself ─────────────────────────────────────────────────────────

test('arrow keys move between steps', async ({ page }) => {
    const problems = watchForProblems(page)
    await page.goto('/demo/#/about')
    const position = await page.locator('#position').innerText()
    await page.locator('body').press('ArrowRight')
    await expect(page.locator('#position')).not.toHaveText(position)
    await page.locator('body').press('ArrowLeft')
    await expect(page.locator('#position')).toHaveText(position)
    expect(problems).toEqual([])
})

test('arrow keys inside a control belong to the control, not the wizard', async ({ page }) => {
    const problems = watchForProblems(page)
    // The carve-out in `demo.js`: a slider and a `<select>` use the arrow keys
    // themselves, so the shell must NOT steal them. Without this test the
    // handler could drop its tagName guard and every test above would still
    // pass -- while a reader dragging a slider by keyboard would be thrown to
    // the next step mid-adjustment.
    await page.goto('/demo/#/line16')
    const position = await page.locator('#position').innerText()
    const slider = page.locator('#step input[type="range"]').first()
    await slider.focus()
    const before = await slider.inputValue()
    await slider.press('ArrowRight')
    // The step did not move...
    await expect(page.locator('#position')).toHaveText(position)
    // ...and the slider did.
    expect(await slider.inputValue()).not.toBe(before)
    expect(problems).toEqual([])
})

test('the wizard routes from the URL, not just from its buttons', async ({ page }) => {
    const problems = watchForProblems(page)
    // A deep link is how anyone shares a step. The shell must honour the hash
    // on first load, not fall back to step 0 and look plausible.
    await page.goto('/demo/#/personas')
    const position = await page.locator('#position').innerText()
    await page.goto('/demo/#/about')
    await expect(page.locator('#position')).not.toHaveText(position)
    expect(problems).toEqual([])
})
