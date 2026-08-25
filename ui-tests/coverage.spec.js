/**
 * Coverage for the two files no proof can reach.
 *
 * `demo/entry.js` and `demo/lib/store.js` touch `document`, `window` and
 * `indexedDB`, so `node --test --experimental-test-coverage` never sees them:
 * nothing under `fjs/` imports them and nothing in Node can. They are the only
 * shipped files in that position, and "the suite is at 99%" said nothing about
 * them at all.
 *
 * So the browser measures them. V8 hands back per-byte execution ranges for
 * every script the page loaded; this run drives the whole flow — draw a form,
 * store two documents, amend one, refuse one, compute, empty the store — and
 * then asserts a floor on each file.
 *
 * **The floor is asserted, not reported.** A coverage number printed into a log
 * is a number nobody reads until it has already fallen; a threshold that fails
 * the run is a check. This is the same reasoning `planning-truth-gate.test.js`
 * applies to the planning documents.
 *
 * @module
 */
import { test, expect } from './demo-mode.js'

/** The files this run must exercise, with the floor each must clear. */
const floors = [
    { file: 'demo/entry.js', floor: 90 },
    { file: 'demo/lib/store.js', floor: 90 },
]

/**
 * Executed bytes over total bytes, from V8's range list.
 *
 * Ranges are byte offsets with a `count`; a range with `count === 0` is code
 * that loaded and did not run. Summing the covered ranges and dividing by the
 * script's length gives the same figure a line-based reporter approximates,
 * without needing a source map — and byte coverage is the stricter of the two,
 * because a partially executed line counts partially.
 * @type {(entry: { readonly source?: string, readonly functions: readonly { readonly ranges: readonly { readonly startOffset: number, readonly endOffset: number, readonly count: number }[] }[] }) => number}
 */
const percentOf = entry => {
    const total = (entry.source ?? '').length
    if (total === 0) { return 0 }
    /** @type {Map<number, boolean>} */
    const executed = new Map()
    for (const fn of entry.functions) {
        for (const range of fn.ranges) {
            for (let offset = range.startOffset; offset < range.endOffset; offset += 1) {
                // A later, narrower range wins: V8 emits the enclosing
                // function first and its uncovered branches after it.
                executed.set(offset, range.count > 0)
            }
        }
    }
    let covered = 0
    for (const hit of executed.values()) { if (hit) { covered += 1 } }
    return (covered / total) * 100
}

test('the browser-only files are exercised to their floor', async ({ page }) => {
    await page.coverage.startJSCoverage({ resetOnNavigation: false })

    await page.goto('/demo/entry.html')
    await page.evaluate(() => new Promise(resolve => {
        const request = indexedDB.deleteDatabase('finance-demo')
        request.onsuccess = () => resolve(undefined)
        request.onerror = () => resolve(undefined)
        request.onblocked = () => resolve(undefined)
    }))
    await page.reload()

    /** @type {(dialect: string) => (values: Record<string, string | readonly string[]>) => Promise<void>} */
    const store = dialect => async values => {
        await page.selectOption('#dialect', dialect)
        for (const [name, value] of Object.entries(values)) {
            const control = page.locator(`#form-host [name="${name}"]`)
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

    const w2 = {
        taxYear: '2025', formRevision: '2025',
        employerEIN: '11-1111111', employeeSSN: '222-22-2222', controlNumber: 'ACC-0001',
        employerName: 'Acme',
        box1WagesTipsOtherCompensation: '60000.00',
        box2FederalIncomeTaxWithheld: '5000.00',
    }

    // Every branch the page has, in one pass.
    await store('vnd.fjs.return_profile')({
        taxYear: '2025', dependentCount: '0', filingStatus: 'single',
        declaredKinds: ['wages', 'federalTaxWithheldOnW2'],
    })
    await store('vnd.fjs.w2')(w2)                                    // first revision
    await store('vnd.fjs.w2')({ ...w2, box1WagesTipsOtherCompensation: '70000.00' })  // amendment
    await store('vnd.fjs.w2')({ ...w2, box1WagesTipsOtherCompensation: '60,000' })    // refusal
    // A checkbox and a repeating row, which nothing above touches.
    await page.selectOption('#dialect', 'vnd.fjs.w2')
    await page.check('#form-host [name="box13RetirementPlan"]')
    await page.locator('#form-host button.entry-add-row').first().click()
    await page.click('#compute')
    await expect(page.locator('#result')).toContainText('Form 1040')
    page.on('dialog', dialog => dialog.accept())
    await page.click('#clear')
    await expect(page.locator('#documents')).toContainText('No documents yet')
    await page.click('#compute')

    const entries = await page.coverage.stopJSCoverage()
    /** @type {string[]} */
    const report = []
    for (const { file, floor } of floors) {
        const entry = entries.find(e => e.url.endsWith(file))
        expect(entry, `${file} must have been loaded by the page`).toBeTruthy()
        if (entry === undefined) { continue }
        const percent = percentOf(entry)
        report.push(`${file}: ${percent.toFixed(2)}%`)
        expect(percent, `${file} is below its ${floor}% floor`).toBeGreaterThanOrEqual(floor)
    }
    // Printed as well as asserted: a number that only appears on failure tells
    // nobody how much headroom there is.
    console.log(`  browser coverage — ${report.join(', ')}`)
})
