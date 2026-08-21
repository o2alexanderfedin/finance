/**
 * Hand entry: type a return's documents, get the return.
 *
 * ## What this file is allowed to know
 *
 * Almost nothing. It draws controls, reads their values, and puts JSON into the
 * browser's store. It does not know what a W-2 is, which boxes exist, what
 * makes one valid, how a document reaches a 1040 line, or how any figure is
 * computed. Every one of those lives in `fjs/` and reaches this file through
 * `lib/engine.js`, the demo's single door into the engine:
 *
 * - **which documents exist** — `enterableDialects`, the registry proven equal
 *   to the set the server serves;
 * - **what boxes each one has** — `fieldsOf(toJsonSchema(schema))`, derived
 *   from the same constant the validator uses;
 * - **whether an entry is acceptable** — the dialect's own `validate`, the
 *   same function the MCP server calls;
 * - **what the documents add up to** — `taxReturnReport`, the function twin of
 *   the program `fjs_run` executes on the server, read through `storeView`.
 *
 * So this page cannot disagree with the engine about anything, because it
 * restates nothing the engine says. If a dialect gains a box, the box appears
 * here; if a rule changes, the number changes here. There is no second copy to
 * update, and no hand-written form to forget.
 *
 * ## Nothing leaves the machine
 *
 * There is no network call in this file or in `lib/store.js`. A client's W-2
 * typed into this page goes to IndexedDB in the accountant's own browser and
 * nowhere else. That is deliberate: a preparer's duty over a client's return
 * information is easiest to keep when there is nothing to disclose.
 *
 * ## Why this is not a `.f.js`
 *
 * It touches `document`, `window` and `indexedDB`. Same carve-out `demo.js`
 * and `form1040.js` state: the logic worth proving is in `fjs/`, and there is
 * none here — this file decides nothing.
 *
 * @module
 */
import {
    enterableDialects, dialectNamed, fieldsOf, askedFields, toJsonSchema,
    storeView, taxReturnReport, taxGuestCtx, ty2025, formSubject,
    interpret, individualFilingStatuses, kindVocabulary, money, shortAddress,
} from './lib/engine.js'
import { openDatabase, casAdd, evoAdd, readAll, clearAll } from './lib/store.js'

/** @import { FieldModel } from '../fjs/document/form_model/module.f.js' */
/** @import { Unknown as JsonUnknown } from 'functionalscript/fjs/media/json/types.js' */

/** @type {<T extends HTMLElement>(id: string, kind: new () => T) => T} */
const required = (id, kind) => {
    const node = document.getElementById(id)
    if (!(node instanceof kind)) {
        throw `entry page: #${id} is missing from entry.html, or is the wrong element`
    }
    return node
}

/** @type {(tag: string) => (options?: { readonly text?: string, readonly className?: string }) => HTMLElement} */
const el = tag => (options = {}) => {
    const node = document.createElement(tag)
    if (options.text !== undefined) { node.textContent = options.text }
    if (options.className !== undefined) { node.className = options.className }
    return node
}

/**
 * The vocabularies the schema cannot carry.
 *
 * `filingStatus` is a union of four literals in the dialect's own reasoning but
 * is declared `string`, deliberately: the permitted values live in
 * `fjs/tax/params`, because a status this dialect accepted and that module had
 * no parameters for would be a profile the engine cannot compute. Same for the
 * kind vocabulary. So the select's options are read from the modules that own
 * them — never typed here, which is the whole reason this page cannot drift.
 * @type {(name: string) => readonly string[] | undefined}
 */
const vocabularyFor = name => {
    if (name === 'filingStatus') { return individualFilingStatuses }
    if (name === 'declaredKinds') { return kindVocabulary }
    return undefined
}

// ── Drawing one field ────────────────────────────────────────────────────────

/** @type {(field: FieldModel) => (path: string) => HTMLElement} */
const drawField = field => path => {
    const wrapper = el('label')({ className: 'entry-field' })
    const caption = el('span')({ text: field.label, className: 'entry-label' })
    if (field.required) { caption.append(el('abbr')({ text: '*', className: 'entry-required' })) }
    wrapper.append(caption)

    const vocabulary = vocabularyFor(field.name)
    if (vocabulary !== undefined) {
        const select = document.createElement('select')
        select.name = path
        select.multiple = field.kind === 'stringList'
        if (!select.multiple) { select.append(new Option('', '')) }
        for (const value of vocabulary) { select.append(new Option(value, value)) }
        wrapper.append(select)
        return wrapper
    }
    if (field.kind === 'checkbox') {
        const box = document.createElement('input')
        box.type = 'checkbox'
        box.name = path
        wrapper.prepend(box)
        return wrapper
    }
    if (field.kind === 'stringList') {
        const input = document.createElement('input')
        input.type = 'text'
        input.name = path
        input.placeholder = 'comma separated'
        wrapper.append(input)
        return wrapper
    }
    const input = document.createElement('input')
    input.type = field.kind === 'number' ? 'number' : 'text'
    input.name = path
    wrapper.append(input)
    return wrapper
}

/**
 * A repeating group. Rows are added on demand; an untouched group contributes
 * nothing, which is what keeps an optional array absent rather than present
 * and empty — a distinction the dialects' `option(...)` boxes care about.
 * @type {(field: FieldModel) => (path: string) => HTMLElement}
 */
const drawRows = field => path => {
    const group = el('fieldset')({ className: 'entry-rows' })
    group.append(el('legend')({ text: field.label }))
    const body = el('div')({ className: 'entry-rows-body' })
    group.append(body)
    let count = 0
    const addRow = () => {
        const row = el('div')({ className: 'entry-row' })
        for (const inner of field.fields ?? []) {
            row.append(drawField(inner)(`${path}.${count}.${inner.name}`))
        }
        body.append(row)
        count += 1
    }
    const add = el('button')({ text: `Add ${field.label.toLowerCase()} row`, className: 'entry-add-row' })
    if (add instanceof HTMLButtonElement) {
        add.type = 'button'
        add.addEventListener('click', addRow)
    }
    group.append(add)
    return group
}

/** @type {(dialect: string) => HTMLFormElement} */
const drawForm = dialect => {
    const entry = dialectNamed(dialect)
    const form = document.createElement('form')
    form.className = 'entry-form'
    if (entry === undefined) { return form }
    for (const field of askedFields(fieldsOf(toJsonSchema(entry.schema)))) {
        form.append(field.kind === 'rows' ? drawRows(field)(field.name) : drawField(field)(field.name))
    }
    return form
}

// ── Reading the form back ────────────────────────────────────────────────────

/**
 * The typed value, as the dialect wants it: money as strings exactly as typed,
 * absent boxes ABSENT rather than empty-string, and a checkbox present only
 * when ticked. An empty string in a money box is not zero — it is a box nobody
 * filled in, and the two must not become the same thing on the way in.
 * @type {(form: HTMLFormElement) => (dialect: string) => Record<string, JsonUnknown>}
 */
const readForm = form => dialect => {
    /** @type {Record<string, JsonUnknown>} */
    const flat = { dialect }
    /** @type {Map<string, Map<number, Record<string, JsonUnknown>>>} */
    const groups = new Map()
    for (const node of form.elements) {
        if (!(node instanceof HTMLInputElement || node instanceof HTMLSelectElement)) { continue }
        const parts = node.name.split('.')
        const value = node instanceof HTMLInputElement && node.type === 'checkbox'
            ? (node.checked ? true : undefined)
            : node instanceof HTMLSelectElement && node.multiple
                ? [...node.selectedOptions].map(o => o.value)
                : node.value.trim() === '' ? undefined : node.value.trim()
        if (value === undefined || (Array.isArray(value) && value.length === 0)) { continue }
        if (parts.length === 1) {
            const name = parts[0]
            if (name === undefined) { continue }
            flat[name] = node.type === 'number' && typeof value === 'string' ? Number(value) : value
            continue
        }
        const [group, index, member] = parts
        if (group === undefined || index === undefined || member === undefined) { continue }
        const rows = groups.get(group) ?? new Map()
        const row = rows.get(Number(index)) ?? {}
        rows.set(Number(index), { ...row, [member]: value })
        groups.set(group, rows)
    }
    for (const [group, rows] of groups) {
        flat[group] = [...rows.entries()].sort((a, b) => a[0] - b[0]).map(([, row]) => row)
    }
    return flat
}

/**
 * A document's Evo subject, derived from its business key exactly as the
 * server derives it (`fjs/document/subject`, DOC-01). Re-entering the same
 * form for the same payer and year therefore lands on the SAME subject, which
 * is what makes a correction an amendment rather than a second document
 * counted twice.
 * @type {(value: Record<string, JsonUnknown>) => string}
 */
const subjectOf = value => {
    const text = (/** @type {string} */ key) =>
        typeof value[key] === 'string' ? value[key] : ''
    return formSubject({
        payerTin: text('payerTin'),
        recipientTin: text('recipientTin'),
        accountNumber: text('accountNumber'),
        taxYear: typeof value['taxYear'] === 'number' ? value['taxYear'] : 0,
        formType: text('dialect'),
    })
}

// ── The page ─────────────────────────────────────────────────────────────────

const picker = required('dialect', HTMLSelectElement)
const formHost = required('form-host', HTMLElement)
const saveButton = required('save', HTMLButtonElement)
const messageBox = required('message', HTMLElement)
const documentList = required('documents', HTMLElement)
const resultBox = required('result', HTMLElement)
const computeButton = required('compute', HTMLButtonElement)
const clearButton = required('clear', HTMLButtonElement)

const database = await openDatabase()

/** @type {(text: string) => (kind: 'ok' | 'error') => void} */
const say = text => kind => {
    messageBox.textContent = text
    messageBox.className = `entry-message entry-message-${kind}`
    messageBox.hidden = text === ''
}

for (const { dialect } of enterableDialects) {
    picker.append(new Option(dialect, dialect))
}

/** @type {() => void} */
const showForm = () => {
    formHost.replaceChildren(drawForm(picker.value))
    say('')('ok')
}

/** @type {() => Promise<void>} */
const refreshDocuments = async () => {
    const { blobs, revisions } = await readAll(database)
    documentList.replaceChildren()
    if (revisions.size === 0) {
        documentList.append(el('p')({ text: 'No documents yet.', className: 'entry-empty' }))
        return
    }
    const table = el('table')({ className: 'entry-table' })
    const head = el('tr')({})
    for (const caption of ['Dialect', 'Subject', 'Snapshot']) {
        head.append(el('th')({ text: caption }))
    }
    table.append(head)
    const superseded = new Set([...revisions.values()].flatMap(r => [...r.parents]))
    for (const [hash, revision] of revisions) {
        if (superseded.has(hash)) { continue }
        const blob = blobs.get(revision.snapshot)
        const parsed = blob === undefined ? {} : JSON.parse(blob)
        const row = el('tr')({})
        row.append(el('td')({ text: String(parsed.dialect ?? '—') }))
        row.append(el('td')({ text: revision.subject }))
        row.append(el('td')({ text: shortAddress(revision.snapshot), className: 'entry-hash' }))
        table.append(row)
    }
    documentList.append(table)
}

saveButton.addEventListener('click', async () => {
    const form = formHost.firstElementChild
    if (!(form instanceof HTMLFormElement)) { return }
    const dialect = picker.value
    const entry = dialectNamed(dialect)
    if (entry === undefined) { return }
    const value = readForm(form)(dialect)
    const [tag, refusal] = entry.validate(value)
    if (tag === 'error') {
        // The engine's own refusal, verbatim. Not a message this page invents:
        // an accountant who sees a rejection here is seeing exactly what the
        // server would have said.
        say(typeof refusal === 'string' ? refusal : JSON.stringify(refusal))('error')
        return
    }
    const subject = subjectOf(value)
    const snapshot = await casAdd(database)(value)
    const { revisions } = await readAll(database)
    const superseded = new Set([...revisions.values()].flatMap(r => [...r.parents]))
    const parents = [...revisions.entries()]
        .filter(([hash, r]) => r.subject === subject && !superseded.has(hash))
        .map(([hash]) => hash)
    await evoAdd(database)({ subject, snapshot, parents })
    say(parents.length === 0
        ? `Stored as ${shortAddress(snapshot)}.`
        : `Stored as ${shortAddress(snapshot)}, amending the previous entry for this subject.`)('ok')
    showForm()
    await refreshDocuments()
})

computeButton.addEventListener('click', async () => {
    const store = await readAll(database)
    const [tag, value] = interpret(storeView(store))(taxReturnReport(taxGuestCtx(ty2025))([]))
    resultBox.replaceChildren()
    if (tag !== 'ok') {
        resultBox.append(el('p')({ text: `The program stopped: ${JSON.stringify(value)}`, className: 'entry-message-error' }))
        return
    }
    const result = value[0]
    if (result.kind !== 'ok') {
        // A refusal is a VALUE here, and showing it whole is the point: the
        // engine says what it will not compute and why, rather than printing a
        // confident zero.
        resultBox.append(el('h2')({ text: 'Refused' }))
        resultBox.append(el('p')({ text: result.message }))
        if (result.unmodeled.length > 0) {
            resultBox.append(el('p')({ text: `Unmodeled: ${result.unmodeled.join(', ')}` }))
        }
        return
    }
    const table = el('table')({ className: 'entry-table' })
    const head = el('tr')({})
    for (const caption of ['Line', 'Amount', 'Cited documents']) {
        head.append(el('th')({ text: caption }))
    }
    table.append(head)
    for (const line of result.lines) {
        const row = el('tr')({})
        row.append(el('td')({ text: line.rule }))
        row.append(el('td')({ text: money(BigInt(line.value.replace('.', ''))), className: 'entry-amount' }))
        row.append(el('td')({
            text: line.sources.map(s => `${shortAddress(s.documentHash)} ${s.boxPath}`).join('; '),
            className: 'entry-hash',
        }))
        table.append(row)
    }
    resultBox.append(el('h2')({ text: 'Form 1040' }))
    resultBox.append(table)
})

clearButton.addEventListener('click', async () => {
    if (!window.confirm('Delete every document in this browser? This cannot be undone.')) { return }
    await clearAll(database)
    resultBox.replaceChildren()
    say('Store emptied.')('ok')
    await refreshDocuments()
})

picker.addEventListener('change', showForm)
showForm()
await refreshDocuments()
