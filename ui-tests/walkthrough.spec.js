/**
 * The demo walkthrough — one test, one page, one continuous story.
 *
 * ## Why this exists separately from the suite
 *
 * The 46 tests in the other spec files are *checks*. Each one is deliberately
 * minimal and deliberately isolated: its own browser context, its own fresh
 * page, one or two actions, then a verdict. That is what makes them trustworthy
 * and what makes them fast — and it is exactly what makes them a poor demo.
 * Watching them is watching a reel of single clicks, each preceded by a window
 * opening and followed by it closing, because isolation is the point.
 *
 * A demo wants the opposite of isolation. It wants **accumulated state** — the
 * profile is still there when the W-2 arrives, the W-2 is still there when the
 * return computes — and it wants to stay on one page long enough for a person
 * to follow what changed and why.
 *
 * So this is not a repurposed check. It is a scripted run through the thing the
 * project is actually for: **an accountant sits down, enters source documents,
 * and gets tax output back, with every figure carrying its source.**
 *
 * It is still a test. Every step asserts, so a broken app fails the demo rather
 * than quietly presenting a lie to whoever is watching. But it is excluded from
 * `npm test`: it is slow by design, and a check that takes a minute per action
 * would be a bad citizen in a suite that answers "is it broken?" in 17 seconds.
 *
 * ```sh
 * npm --prefix ui-tests run demo          # this file, at the demo pace
 * npm --prefix ui-tests run demo:all      # the whole suite, headed
 * npm --prefix ui-tests test              # the 46 checks, headless — no walkthrough
 * ```
 *
 * @module
 */
import { test, expect } from './demo-mode.js'

/** The story is long and paced on purpose; the default budget does not apply. */
test.setTimeout(30 * 60 * 1000)

/** Narration, so the terminal tells the same story as the screen. */
const say = (/** @type {string} */ line) => console.log(`\n  ── ${line}`)

const profile = {
    taxYear: '2025',
    dependentCount: '0',
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

test('walkthrough: an accountant enters documents and gets a return', async ({ page }) => {
    say('Opening the hand-entry page, with an empty store.')
    await page.goto('/demo/entry.html')
    await page.evaluate(() => new Promise(resolve => {
        const request = indexedDB.deleteDatabase('finance-demo')
        request.onsuccess = () => resolve(undefined)
        request.onerror = () => resolve(undefined)
        request.onblocked = () => resolve(undefined)
    }))
    await page.reload()
    await expect(page.locator('#documents')).toContainText('No documents yet')

    const offered = await page.locator('#dialect option').count()
    say(`${offered} document types are on offer — and none of these forms was hand-written.`)
    say('Each one is generated from that dialect\'s own rtti schema, so the form')
    say('and the validator cannot drift apart.')

    // ── 1. The return profile ────────────────────────────────────────────────
    say('First document: the return profile. Who is filing, and what kinds of income.')
    await page.selectOption('#dialect', 'vnd.fjs.return_profile')
    for (const [name, value] of Object.entries(profile)) {
        await page.locator(`#form-host [name="${name}"]`).fill(value)
    }
    await page.selectOption('#form-host [name="filingStatus"]', 'single')
    await page.selectOption('#form-host [name="declaredKinds"]', ['wages', 'federalTaxWithheldOnW2'])
    await page.click('#save')
    await expect(page.locator('#message')).toContainText('Stored as')
    say('Stored. The identifier is a content address, not a row number.')

    // ── 2. The W-2 ───────────────────────────────────────────────────────────
    say('Second document: a W-2. Watch the form redraw itself for a different dialect.')
    await page.selectOption('#dialect', 'vnd.fjs.w2')
    say('Box b is `employerEIN` and box a is `employeeSSN` — what the printed form')
    say('calls them, not what this codebase found convenient.')
    for (const [name, value] of Object.entries(w2)) {
        await page.locator(`#form-host [name="${name}"]`).fill(value)
    }
    await page.click('#save')
    await expect(page.locator('#message')).toContainText('Stored as')
    await expect(page.locator('#documents')).toContainText('vnd.fjs.w2')

    // ── 3. A correction ──────────────────────────────────────────────────────
    say('The employer sends a correction: wages were 70,000, not 60,000.')
    say('Re-entering the same employer and year AMENDS rather than duplicates.')
    await page.selectOption('#dialect', 'vnd.fjs.w2')
    for (const [name, value] of Object.entries({ ...w2, box1WagesTipsOtherCompensation: '70000.00' })) {
        await page.locator(`#form-host [name="${name}"]`).fill(value)
    }
    await page.click('#save')
    await expect(page.locator('#message')).toContainText('amending')
    await expect(page.locator('#documents tr', { hasText: 'vnd.fjs.w2' })).toHaveCount(1)
    say('One W-2 in the list, not two — the correction supersedes its parent.')

    // ── 4. The return ────────────────────────────────────────────────────────
    say('Now compute. The engine runs in this browser; nothing is sent anywhere.')
    await page.click('#compute')
    const result = page.locator('#result')
    await expect(result).toContainText('Form 1040')
    const line1a = result.locator('tr', { hasText: '1040 line 1a' }).first()
    await expect(line1a).toContainText('$70,000.00')
    say('Line 1a is the CORRECTED figure, and it carries the document it came from.')
    await expect(line1a.locator('td.entry-hash')).not.toBeEmpty()
    await expect(result.locator('tr', { hasText: '1040 line 25a' }).first()).toContainText('$5,000.00')
    say('Withholding reached the payments section too — this is a whole return.')

    // ── 5. The form face, and where each number came from ────────────────────
    say('The same figures on the printed form face. Clicking an amount opens its sources.')
    await page.goto('/demo/#/form1040')
    const amount = page.locator('#step button.f1040-amt').first()
    await amount.click()
    await expect(amount).toHaveClass(/f1040-amt-open/)
    const detail = page.locator('#step .f1040-detail')
    await expect(detail).toContainText('citation')
    say('Document, CAS address, box, and the raw value exactly as stored —')
    say('not re-formatted, not re-rounded. A number without its source is the')
    say('failure this whole project exists to prevent.')

    // ── 6. The live dispatcher ───────────────────────────────────────────────
    say('Last: line 16 is not one formula. Four printed branches, chosen live.')
    await page.goto('/demo/#/line16')
    for (const preset of ['Tax Table', 'Qualified Dividends worksheet', 'Schedule D Tax Worksheet']) {
        say(`Preset: ${preset}`)
        await page.getByRole('button', { name: preset, exact: true }).click()
        await expect(page.locator('#step .method').first()).not.toBeEmpty()
        await expect(page.locator('#step .big-figure').first()).not.toBeEmpty()
    }
    say('The tag shows the method the ENGINE picked — not the button\'s label.')
    say('Walkthrough complete.')
})
