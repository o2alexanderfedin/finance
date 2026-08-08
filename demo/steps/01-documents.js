/**
 * Step 1 — Documents.
 *
 * The beat: these are the inputs, stored exactly as they arrive, addressed by
 * their content, and validated by the dialect that owns them. Money is a
 * string everywhere.
 *
 * The addresses on this page are computed in the browser by the same SHA-256
 * the content store uses, over the same bytes shown on screen.
 *
 * @module
 */
import { el, section, table, callout, note } from '../lib/dom.js'
import { sourceFooter } from '../lib/github.js'
import { documents } from '../lib/fixtures.js'
import {
    storedText, casAddress, storedBytes, shortAddress,
    validateProfile, validateW2, validate1099Int,
} from '../lib/engine.js'

/** @import { Step } from '../demo.js' */
/** @import { Unknown } from 'functionalscript/fjs/media/json/module.f.js' */

export const id = 'documents'
export const kicker = 'Step 1'
export const title = 'Documents'
export const beat = 'Five stored documents. Each one addressed by the SHA-256 of its own bytes, each one validated by the dialect that owns it — and every money field a string, never a floating-point number.'
export const tier = 'must'

/**
 * Runs the validator its dialect owns over a stored document and renders the
 * verdict.
 *
 * Each validator takes an arbitrary JSON value — that is the point of a
 * dialect validator, it is what stands between an untrusted blob and the
 * engine — so nothing here needs a cast to call one.
 * @type {(dialect: string, value: Unknown) => HTMLElement}
 */
const verdict = (dialect, value) => {
    const result = dialect === 'vnd.fjs.return_profile' ? validateProfile(value)
        : dialect === 'vnd.fjs.w2' ? validateW2(value)
        : dialect === 'vnd.fjs.1099int' ? validate1099Int(value)
        : undefined
    if (result === undefined) { throw `no validator for dialect ${dialect}` }
    // An fjs `Result` is a tagged tuple: `['ok', value]` or `['error', reason]`.
    const ok = result[0] === 'ok'
    return el('span', {
        class: ok ? 'method' : 'method refuses',
        text: ok ? 'valid' : 'rejected',
    })
}

/** @type {Step['render']} */
export const render = root => {
    // ── The inventory ────────────────────────────────────────────────────────
    const inventory = section(
        'The sample return',
        'A married couple filing jointly: two W-2s, two 1099-INTs, and the return profile that says what kind of return this is.')
    inventory.append(table(
        ['Document', 'Dialect', 'Bytes', 'CAS address', 'Dialect check'],
        documents.map(document => [
            document.label,
            { text: document.dialect, class: 'mono' },
            { text: String(storedBytes(document.stored.value).length), class: 'money' },
            { text: shortAddress(document.stored.documentHash), class: 'mono' },
            verdict(document.dialect, document.stored.value),
        ]),
    ))
    inventory.append(note(
        'The address column is not a label attached to these documents — it is the '
        + 'SHA-256 of the exact bytes shown below, computed in this browser by '
        + 'functionalscript\'s own hash, rendered in the same alphabet the store\'s '
        + 'shard paths use. Change one character of a document and its address changes.'))
    root.append(inventory)

    // ── Money as a string ────────────────────────────────────────────────────
    const strings = section('Every money field is a string')
    strings.append(el('p', {
        html: 'Look at any amount below: it is quoted. <code>"1284.37"</code>, never '
            + '<code>1284.37</code>. A JSON number is an IEEE 754 double, and a double '
            + 'cannot hold every cents value exactly — the error is small, silent, and '
            + 'accumulates across a return.',
    }))
    strings.append(el('p', {
        html: 'The dialect enforces it: a money box arriving as a JSON number is '
            + '<strong>rejected at ingest</strong>, and every present money box is '
            + 're-parsed as an exact decimal at the cents scale before the document is '
            + 'accepted. What flows onward is a <code>bigint</code> count of cents.',
    }))
    strings.append(callout('ok', 'The rule holds at both ends.',
        'Strings on the wire and in storage, integer cents in computation. No value on '
        + 'this page has ever been a floating-point number.'))
    root.append(strings)

    // ── The documents themselves ─────────────────────────────────────────────
    for (const document of documents) {
        const panel = section(document.label)
        const text = storedText(document.stored.value)
        const meta = el('div', { class: 'figure-row' })
        const address = el('div')
        address.append(el('div', {
            class: 'kicker',
            text: 'CAS address — SHA-256 of the bytes below',
        }))
        address.append(el('div', { class: 'mono', text: document.stored.documentHash }))
        meta.append(address)
        panel.append(meta)
        const pre = el('pre', { class: 'code' })
        pre.append(el('code', { text }))
        panel.append(pre)
        // A recomputation of the displayed text, so the page can catch itself
        // showing an address that does not belong to what it printed.
        const recomputed = casAddress(new TextEncoder().encode(text))
        if (recomputed !== document.stored.documentHash) {
            panel.append(callout('stop', 'Address mismatch.',
                `The text above hashes to ${recomputed}, not to the address shown. `
                + 'This page is wrong; do not trust it.'))
        }
        root.append(panel)
    }

    root.append(sourceFooter([
        { label: 'fjs/document/w2 — the W-2 dialect and its validator', path: 'fjs/document/w2/module.f.js', line: 93, proofLine: 308 },
        { label: 'fjs/document/1099int — the 1099-INT dialect and its validator', path: 'fjs/document/1099int/module.f.js', line: 69, proofLine: 220 },
        { label: 'fjs/return/profile — the return profile dialect', path: 'fjs/return/profile/module.f.js', line: 167, proofLine: 469 },
        { label: 'fjs/exact — exact decimal parsing at the cents scale', path: 'fjs/exact/module.f.js', line: 34, proofLine: 70 },
    ]))
}
