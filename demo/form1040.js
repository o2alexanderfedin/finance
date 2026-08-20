/**
 * The standalone Form 1040 page: the form, alone, on a sheet you can print.
 *
 * ## Why this exists
 *
 * The engine returns `{ value, rule, sources }` — cited numbers. The wizard's
 * step 9 turns those into the printed form face, but it does so surrounded by
 * a step header, a lede, callouts and a source footer, inside a shell with a
 * navigation bar and Prev/Next buttons. None of that belongs on a sheet handed
 * to a preparer, and none of it can be removed from a wizard step without
 * removing the explanation the wizard exists to give.
 *
 * So the form has two front doors and ONE implementation.
 * `steps/09-form1040.js` exports `renderForm`, which draws the form face and
 * nothing else — including both directions of the coverage guard, which is
 * the point: the page a filer prints must be the page that refuses to draw a
 * form with a silent hole in it. This file is eleven lines of browser glue
 * over that export, and `demo.css`'s `@media print` block does the rest.
 *
 * ## Why this file is not a `.f.js`
 *
 * Same reason as `demo.js`: it touches `document` and `window`, neither of
 * which a pure FunctionalScript module may see. Everything it renders comes
 * from `renderForm`, which is shared, so there is no logic here to prove.
 *
 * @module
 */
import { renderForm } from './steps/09-form1040.js'

/**
 * A required element, by id and expected type — the same narrowing `demo.js`
 * uses. `getElementById` yields `HTMLElement | null`, and `instanceof` gets to
 * the specific type without a cast, which matters because `.disabled` and
 * `.click` are not on a bare `HTMLElement`.
 * @type {<T extends HTMLElement>(id: string, kind: new () => T) => T}
 */
const required = (id, kind) => {
    const node = document.getElementById(id)
    if (!(node instanceof kind)) {
        throw `form 1040 page: #${id} is missing from form1040.html, or is the wrong element`
    }
    return node
}

const sheet = required('form', HTMLElement)
const printButton = required('print', HTMLButtonElement)

printButton.addEventListener('click', () => window.print())

// No `try` around this. A step in the wizard is caught by the shell so one
// broken panel does not blank a nine-step demo; here the form IS the page, and
// a half-drawn form that looks complete is worse than an error the browser
// reports. `renderForm` draws its own stop panel for every failure it can
// name, and returns `undefined` when it does.
renderForm(sheet)
