/**
 * The DOM helpers every step uses. Deliberately tiny: this is a presentation
 * layer, and a framework here would be a dependency the project does not
 * permit and a layer between a stakeholder and the numbers.
 *
 * Two properties are worth stating, because both are enforced rather than
 * remembered:
 *
 * - **Nothing here ever assigns `innerHTML` from data.** Text goes in through
 *   `textContent`, so a value read off a stored document cannot become markup.
 *   `html` exists for the handful of literal fragments written in this
 *   repository, and its parameter is documented as such.
 * - **The typed constructors below return the SPECIFIC element type**
 *   (`input`, `select`, `anchor`, `button`), never a bare `HTMLElement`.
 *   `tsc` runs over this directory with the same strict settings as the
 *   engine, so reaching for `.value` on something that might not have one
 *   fails the build rather than failing on stage.
 *
 * @module
 */

/**
 * What a cell may be: an element, a plain value rendered as text, or a
 * `{ text, class }` pair that sets both.
 * @typedef {HTMLElement | string | number | { readonly text: string, readonly class?: string }} Cell
 */

/**
 * Options for {@link el}. `html` is only ever passed literals written in this
 * repository — never a document field, never anything a user typed.
 * @typedef {{
 *   readonly class?: string,
 *   readonly text?: string,
 *   readonly html?: string,
 *   readonly attrs?: Readonly<Record<string, string>>,
 * }} ElOptions
 */

/**
 * Applies {@link ElOptions} to an already-created element. Shared by every
 * constructor below so the option handling exists once.
 * @type {<T extends HTMLElement>(node: T, options: ElOptions) => T}
 */
const decorate = (node, options) => {
    if (options.class !== undefined) { node.className = options.class }
    if (options.text !== undefined) { node.textContent = options.text }
    if (options.html !== undefined) { node.innerHTML = options.html }
    for (const [name, value] of Object.entries(options.attrs ?? {})) {
        node.setAttribute(name, value)
    }
    return node
}

/**
 * A generic element. Returns `HTMLElement`, so anything needing `.value`,
 * `.href` or `.disabled` must use one of the specific constructors below —
 * which is the point.
 * @type {(tag: string, options?: ElOptions) => HTMLElement}
 */
export const el = (tag, options = {}) => decorate(document.createElement(tag), options)

/** An `<input>`, typed. @type {(options?: ElOptions) => HTMLInputElement} */
export const input = (options = {}) => decorate(document.createElement('input'), options)

/** A `<select>`, typed. @type {(options?: ElOptions) => HTMLSelectElement} */
export const select = (options = {}) => decorate(document.createElement('select'), options)

/** An `<option>`, typed. @type {(value: string, label: string) => HTMLOptionElement} */
export const option = (value, label) => {
    const node = document.createElement('option')
    node.value = value
    node.textContent = label
    return node
}

/**
 * A `<button type="button">`. The explicit type matters: a bare `<button>`
 * inside a form submits it.
 * @type {(label: string, options?: ElOptions) => HTMLButtonElement}
 */
export const button = (label, options = {}) => {
    const node = decorate(document.createElement('button'), options)
    node.type = 'button'
    node.textContent = label
    return node
}

/**
 * An external link. Always `target="_blank"` with `rel="noreferrer"` — every
 * anchor this demo emits leaves the page.
 * @type {(href: string, label: string, options?: ElOptions) => HTMLAnchorElement}
 */
export const anchor = (href, label, options = {}) => {
    const node = decorate(document.createElement('a'), options)
    node.href = href
    node.target = '_blank'
    node.rel = 'noreferrer'
    node.textContent = label
    return node
}

/**
 * A section with a heading and an optional lede — the shape every step's body
 * repeats.
 * @type {(title: string, lede?: string) => HTMLElement}
 */
export const section = (title, lede) => {
    const node = el('section', { class: 'panel' })
    node.append(el('h3', { text: title }))
    if (lede !== undefined) { node.append(el('p', { class: 'lede', text: lede })) }
    return node
}

/**
 * Renders one {@link Cell} into a `<td>`.
 * @type {(cell: Cell) => HTMLTableCellElement}
 */
const cellNode = cell => {
    const td = document.createElement('td')
    if (cell instanceof HTMLElement) {
        td.append(cell)
        return td
    }
    if (typeof cell === 'string' || typeof cell === 'number') {
        td.textContent = String(cell)
        return td
    }
    td.textContent = cell.text
    if (cell.class !== undefined) { td.className = cell.class }
    return td
}

/**
 * A table from a header row and body rows, wrapped in a horizontally
 * scrollable container so a wide table never makes the PAGE scroll sideways.
 * @type {(headers: readonly string[], rows: readonly (readonly Cell[])[], options?: { readonly class?: string }) => HTMLElement}
 */
export const table = (headers, rows, options = {}) => {
    const wrap = el('div', { class: 'table-wrap' })
    const node = el('table', { class: options.class ?? '' })
    const thead = el('thead')
    const headRow = el('tr')
    for (const header of headers) { headRow.append(el('th', { text: header })) }
    thead.append(headRow)
    const tbody = el('tbody')
    for (const row of rows) {
        const tr = el('tr')
        for (const cell of row) { tr.append(cellNode(cell)) }
        tbody.append(tr)
    }
    node.append(thead, tbody)
    wrap.append(node)
    return wrap
}

/** A short note under a table or figure. @type {(text: string) => HTMLElement} */
export const note = text => el('p', { class: 'note', text })

/**
 * A callout box.
 * @type {(kind: 'ok' | 'warn' | 'stop' | 'info', title: string, body: string) => HTMLElement}
 */
export const callout = (kind, title, body) => {
    const node = el('div', { class: `callout callout-${kind}` })
    node.append(el('strong', { text: title }))
    node.append(el('span', { text: body }))
    return node
}

/** A fenced code block. @type {(text: string) => HTMLElement} */
export const code = text => {
    const pre = el('pre', { class: 'code' })
    pre.append(el('code', { text }))
    return pre
}
