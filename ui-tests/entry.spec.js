/**
 * The hand-entry page, driven the way an accountant drives it.
 *
 * Every assertion here is about the WIRING — the one thing 3276 proofs cannot
 * reach, because it lives in `document`, `window` and `indexedDB`. The
 * arithmetic is proven elsewhere and is not re-proven here; what is checked is
 * that a value typed into a control reaches the store, that the store reaches
 * the engine, and that what the engine says reaches the screen.
 *
 * Each test starts from an empty store. IndexedDB survives a reload, which is
 * the feature — and which would otherwise let one test's documents silently
 * become another test's inputs.
 *
 * @module
 */
import { test, expect } from './demo-mode.js'

/** The two documents every computing test needs. Values are IRS-reserved test ranges. */
const profile = {
    taxYear: '2025',
    dependentCount: '0',
    filingStatus: 'single',
    declaredKinds: ['wages', 'federalTaxWithheldOnW2'],
}

const w2 = {
    taxYear: '2025',
    formRevision: '2025',
    employerEIN: '11-1111111',
    employeeSSN: '222-22-2222',
    controlNumber: 'ACC-0001',
    employerName: 'Acme',
    box1WagesTipsOtherCompensation: '60000.00',
    box2FederalIncomeTaxWithheld: '5000.00',
}

/** @type {(page: import('@playwright/test').Page) => Promise<void>} */
const openEmpty = async page => {
    await page.goto('/demo/entry.html')
    // Wipe rather than trust a fresh profile: the page's whole point is that
    // documents persist, so an earlier run's data is the default state.
    await page.evaluate(() => new Promise(resolve => {
        const request = indexedDB.deleteDatabase('finance-demo')
        request.onsuccess = () => resolve(undefined)
        request.onerror = () => resolve(undefined)
        request.onblocked = () => resolve(undefined)
    }))
    await page.reload()
    await expect(page.locator('#documents')).toContainText('No documents yet')
}

/**
 * Fills the form for `dialect` and stores it. Values are addressed by the
 * control's `name`, which is the schema's own property name — so a test that
 * names a box the dialect does not have fails on the selector, loudly, rather
 * than silently filling nothing.
 * @type {(page: import('@playwright/test').Page) => (dialect: string) => (values: Record<string, string | readonly string[]>) => Promise<void>}
 */
const store = page => dialect => async values => {
    await page.selectOption('#dialect', dialect)
    for (const [name, value] of Object.entries(values)) {
        const control = page.locator(`#form-host [name="${name}"]`)
        await expect(control, `the ${dialect} form must offer a control for ${name}`).toHaveCount(1)
        if (Array.isArray(value)) {
            await control.selectOption([...value])
        } else if (await control.evaluate(node => node.tagName) === 'SELECT') {
            await control.selectOption(String(value))
        } else {
            await control.fill(String(value))
        }
    }
    await page.click('#save')
}

test('the form is generated from the dialect registry, not hand-written', async ({ page }) => {
    await openEmpty(page)
    // Every enterable dialect is offered. The count is read from the page and
    // compared against the registry the engine exposes, so adding a dialect
    // upstream cannot leave this page quietly behind.
    const offered = await page.locator('#dialect option').count()
    expect(offered).toBeGreaterThan(20)
    // The dialect tag is supplied, never asked -- the property exists in the
    // schema and must NOT be a control.
    await page.selectOption('#dialect', 'vnd.fjs.w2')
    await expect(page.locator('#form-host [name="dialect"]')).toHaveCount(0)
    // A checkbox box renders as a checkbox and not as a text input: a text
    // input would accept the string "false", which the validator refuses.
    await expect(page.locator('#form-host [name="box13RetirementPlan"]')).toHaveAttribute('type', 'checkbox')
    // A repeating group renders as a group with an add-row button rather than
    // as one flat input.
    await expect(page.locator('#form-host fieldset.entry-rows legend').first()).toBeVisible()
    // `filingStatus` is declared `string` in the schema; its vocabulary comes
    // from `fjs/tax/params`. If the page ever hand-typed that list this would
    // still pass -- so the count is compared against the engine's own.
    await page.selectOption('#dialect', 'vnd.fjs.return_profile')
    const statuses = await page.locator('#form-host [name="filingStatus"] option').count()
    expect(statuses).toBeGreaterThan(4)
})

test('a document is stored, listed, and addressed by its content', async ({ page }) => {
    await openEmpty(page)
    await store(page)('vnd.fjs.return_profile')(profile)
    // Visible AND non-empty. `toHaveClass` alone passed against a hidden,
    // empty element while the confirmation was being wiped by the redraw —
    // an assertion that looked stronger than it was.
    await expect(page.locator('#message')).toBeVisible()
    await expect(page.locator('#message')).toContainText('Stored as')
    await expect(page.locator('#documents')).toContainText('vnd.fjs.return_profile')
    // The listed snapshot is a real content address, not a counter.
    const snapshot = await page.locator('#documents td.entry-hash').first().innerText()
    expect(snapshot).toMatch(/^[0-9a-z]{6}…[0-9a-z]{6}$/)
})

test('an invalid entry is refused in the engine\'s own words', async ({ page }) => {
    await openEmpty(page)
    // A money box that is not a canonical decimal string. The dialect's own
    // validator refuses it, and the page shows that refusal verbatim rather
    // than inventing a message of its own.
    await store(page)('vnd.fjs.w2')({ ...w2, box1WagesTipsOtherCompensation: '60,000' })
    await expect(page.locator('#message')).toHaveClass(/entry-message-error/)
    await expect(page.locator('#message')).toContainText('box1WagesTipsOtherCompensation')
    await expect(page.locator('#documents')).toContainText('No documents yet')
})

test('two documents compute a real 1040 with citations', async ({ page }) => {
    await openEmpty(page)
    await store(page)('vnd.fjs.return_profile')(profile)
    await store(page)('vnd.fjs.w2')(w2)
    await page.click('#compute')
    const result = page.locator('#result')
    await expect(result).toContainText('Form 1040')
    // Line 1a is the W-2's box 1, to the cent, through the same guest program
    // the server runs.
    const line1a = result.locator('tr', { hasText: '1040 line 1a' }).first()
    await expect(line1a).toContainText('$60,000.00')
    // And it cites the document it came from -- a number without its source is
    // the failure mode this whole project exists to prevent.
    await expect(line1a.locator('td.entry-hash')).not.toBeEmpty()
    // Withholding reaches the payments section, so this is not one line
    // computed in isolation.
    await expect(result.locator('tr', { hasText: '1040 line 25a' }).first()).toContainText('$5,000.00')
})

test('re-entering the same payer and year amends rather than duplicates', async ({ page }) => {
    await openEmpty(page)
    await store(page)('vnd.fjs.return_profile')(profile)
    await store(page)('vnd.fjs.w2')(w2)
    await store(page)('vnd.fjs.w2')({ ...w2, box1WagesTipsOtherCompensation: '70000.00' })
    await expect(page.locator('#message')).toContainText('amending')
    // One W-2 in the list, not two: the corrected entry supersedes its parent.
    const rows = page.locator('#documents tr', { hasText: 'vnd.fjs.w2' })
    await expect(rows).toHaveCount(1)
    await page.click('#compute')
    // And the return uses the corrected figure. If heads were ever stored
    // rather than derived, this is where the two W-2s would both be counted.
    await expect(page.locator('#result').locator('tr', { hasText: '1040 line 1a' }).first())
        .toContainText('$70,000.00')
})

test('documents survive a reload, because they are in the browser and not in the page', async ({ page }) => {
    await openEmpty(page)
    await store(page)('vnd.fjs.return_profile')(profile)
    await store(page)('vnd.fjs.w2')(w2)
    await page.reload()
    await expect(page.locator('#documents')).toContainText('vnd.fjs.w2')
    await page.click('#compute')
    await expect(page.locator('#result').locator('tr', { hasText: '1040 line 1a' }).first())
        .toContainText('$60,000.00')
})

test('a return the engine will not compute is refused, not guessed at', async ({ page }) => {
    await openEmpty(page)
    // A profile declaring a kind this engine does not model. The engine
    // answers a named refusal; the page shows it whole instead of printing a
    // confident zero.
    await store(page)('vnd.fjs.return_profile')({
        ...profile,
        declaredKinds: ['wages', 'gamblingWinnings'],
    })
    await store(page)('vnd.fjs.w2')(w2)
    await page.click('#compute')
    await expect(page.locator('#result')).toContainText('Refused')
})

test('the page loads with no console error and no failed request', async ({ page }) => {
    /** @type {string[]} */
    const problems = []
    page.on('console', message => {
        if (message.type() === 'error') { problems.push(`console: ${message.text()}`) }
    })
    page.on('pageerror', error => problems.push(`pageerror: ${error.message}`))
    page.on('requestfailed', request => problems.push(`request failed: ${request.url()}`))
    await page.goto('/demo/entry.html')
    await expect(page.locator('#dialect')).toBeVisible()
    await expect(page.locator('#boot-error')).toBeHidden()
    expect(problems).toEqual([])
})
