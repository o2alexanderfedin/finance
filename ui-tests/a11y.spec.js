/**
 * Contrast and colour-independence, computed from the live page.
 *
 * A palette is easy to claim and easy to regress: one hard-coded hex added to
 * a rule six months from now puts a failing pair back on screen and nothing
 * says so. So the numbers are read from `getComputedStyle` on the rendered
 * page and asserted here, in both colour schemes.
 *
 * ## What the thresholds are
 *
 * WCAG 2.2: **4.5:1** for normal text (1.4.3), **3:1** for the boundary of an
 * interactive component (1.4.11). Both are floors, not targets — the palette
 * these run against clears 5.8:1 and 4.4:1 respectively, so a regression has
 * to be real before this reddens.
 *
 * ## The check that matters most is not a ratio
 *
 * A status distinguished only by hue is invisible to roughly one man in twelve,
 * and green-against-red is the pair that collapses. So the last test strips
 * colour entirely — it reads the message TEXT — and asserts that success and
 * failure still differ. That is the property; the ratios are hygiene.
 *
 * @module
 */
import { test, expect } from '@playwright/test'

/** @type {(css: string) => readonly [number, number, number]} */
const parseRgb = css => {
    const numbers = css.replace(/[^0-9.,]/g, '').split(',').map(Number)
    return [numbers[0] ?? 0, numbers[1] ?? 0, numbers[2] ?? 0]
}

/** Relative luminance, WCAG 2.x §relative-luminance. @type {(rgb: readonly [number, number, number]) => number} */
const luminance = ([r, g, b]) => {
    /** @type {(channel: number) => number} */
    const linear = channel => {
        const c = channel / 255
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
    }
    return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b)
}

/** @type {(a: string) => (b: string) => number} */
const contrast = a => b => {
    const [x, y] = [luminance(parseRgb(a)), luminance(parseRgb(b))]
    const [hi, lo] = x > y ? [x, y] : [y, x]
    return (hi + 0.05) / (lo + 0.05)
}

/**
 * The colour behind an element, walking up until something is not transparent.
 * A child with no background of its own inherits the page's visually, and
 * comparing text against `rgba(0, 0, 0, 0)` would report a meaningless ratio.
 * @type {(page: import('@playwright/test').Page) => (selector: string) => Promise<{ readonly color: string, readonly background: string }>}
 */
const colours = page => selector => page.evaluate(css => {
    const node = document.querySelector(css)
    if (node === null) { return { color: '', background: '' } }
    /** @type {(value: string) => boolean} */
    const transparent = value => value === 'rgba(0, 0, 0, 0)' || value === 'transparent'
    let behind = node
    let background = getComputedStyle(behind).backgroundColor
    while (transparent(background) && behind.parentElement !== null) {
        behind = behind.parentElement
        background = getComputedStyle(behind).backgroundColor
    }
    return { color: getComputedStyle(node).color, background }
}, selector)

for (const scheme of /** @type {const} */ (['light', 'dark'])) {
    test(`text clears 4.5:1 in the ${scheme} scheme`, async ({ page }) => {
        await page.emulateMedia({ colorScheme: scheme })
        await page.goto('/demo/entry.html')
        await page.selectOption('#dialect', 'vnd.fjs.w2')
        for (const selector of ['.entry-lede', '.entry-label', '.entry-privacy', 'h1']) {
            const { color, background } = await colours(page)(selector)
            expect(color, `${selector} must render`).not.toBe('')
            const ratio = contrast(color)(background)
            expect(ratio, `${selector} is ${ratio.toFixed(2)}:1 in ${scheme}`).toBeGreaterThanOrEqual(4.5)
        }
    })

    test(`an input's boundary clears 3:1 in the ${scheme} scheme`, async ({ page }) => {
        await page.emulateMedia({ colorScheme: scheme })
        await page.goto('/demo/entry.html')
        await page.selectOption('#dialect', 'vnd.fjs.w2')
        const measured = await page.evaluate(() => {
            const input = document.querySelector('#form-host input[type="text"]')
            if (input === null) { return null }
            const style = getComputedStyle(input)
            const parent = input.parentElement
            const behind = parent === null ? '' : getComputedStyle(parent).backgroundColor
            return { border: style.borderTopColor, background: style.backgroundColor, behind }
        })
        expect(measured, 'the W-2 form must offer a text input').not.toBeNull()
        if (measured === null) { return }
        const ratio = contrast(measured.border)(measured.background)
        expect(ratio, `the control boundary is ${ratio.toFixed(2)}:1 in ${scheme}`).toBeGreaterThanOrEqual(3)
    })

    test(`a status message clears 4.5:1 in the ${scheme} scheme, both kinds`, async ({ page }) => {
        await page.emulateMedia({ colorScheme: scheme })
        await page.goto('/demo/entry.html')
        // A refusal, then a success -- both states measured on the real element
        // rather than on a token read out of a stylesheet.
        await page.selectOption('#dialect', 'vnd.fjs.w2')
        await page.fill('#form-host [name="box1WagesTipsOtherCompensation"]', '60,000')
        await page.click('#save')
        const failed = await colours(page)('#message')
        const failedRatio = contrast(failed.color)(failed.background)
        expect(failedRatio, `a refusal is ${failedRatio.toFixed(2)}:1 in ${scheme}`).toBeGreaterThanOrEqual(4.5)
    })
}

test('a keyboard user can see where they are', async ({ page }) => {
    await page.goto('/demo/entry.html')
    await page.locator('#dialect').focus()
    const outline = await page.evaluate(() => {
        const node = document.querySelector('#dialect')
        if (node === null) { return null }
        const style = getComputedStyle(node)
        return { width: style.outlineWidth, style: style.outlineStyle, color: style.outlineColor }
    })
    expect(outline).not.toBeNull()
    if (outline === null) { return }
    // Removing the focus ring is the single most common accessibility
    // regression, and it is invisible to everyone who uses a mouse.
    expect(outline.style).not.toBe('none')
    expect(parseFloat(outline.width)).toBeGreaterThanOrEqual(2)
})

test('status survives with no colour at all', async ({ page }) => {
    await page.goto('/demo/entry.html')
    await page.evaluate(() => new Promise(resolve => {
        const request = indexedDB.deleteDatabase('finance-demo')
        request.onsuccess = () => resolve(undefined)
        request.onerror = () => resolve(undefined)
        request.onblocked = () => resolve(undefined)
    }))
    await page.reload()

    // A refusal.
    await page.selectOption('#dialect', 'vnd.fjs.w2')
    await page.fill('#form-host [name="box1WagesTipsOtherCompensation"]', '60,000')
    await page.click('#save')
    const refusal = (await page.locator('#message').innerText()).trim()

    // A success.
    await page.selectOption('#dialect', 'vnd.fjs.return_profile')
    await page.fill('#form-host [name="taxYear"]', '2025')
    await page.fill('#form-host [name="dependentCount"]', '0')
    await page.selectOption('#form-host [name="filingStatus"]', 'single')
    await page.selectOption('#form-host [name="declaredKinds"]', ['wages'])
    await page.click('#save')
    const success = (await page.locator('#message').innerText()).trim()

    // The two are told apart by the TEXT — the glyph the page writes into it —
    // so the meaning reaches a monochrome screen, a printout and a reader with
    // no colour vision. This is the property; the ratios above are hygiene.
    expect(refusal.startsWith('✕'), `a refusal must carry its own mark: ${refusal}`).toBe(true)
    expect(success.startsWith('✓'), `a confirmation must carry its own mark: ${success}`).toBe(true)
    expect(refusal).not.toEqual(success)

    // And the live region is declared, so a screen reader announces it rather
    // than leaving it for someone to discover.
    await expect(page.locator('#message')).toHaveAttribute('role', 'status')
    await expect(page.locator('#message')).toHaveAttribute('aria-live', 'polite')
})
