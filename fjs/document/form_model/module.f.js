/**
 * A hand-entry form, derived from the dialect's own schema.
 *
 * ## Why this exists rather than one form per dialect
 *
 * There are thirty registered dialects. Hand-writing a form for each would
 * create a second statement of every document's shape, and this repository has
 * been bitten repeatedly by exactly that: two statements of one fact, with
 * nothing comparing them, one of them going stale. A W-2 box added to
 * `fjs/document/w2`'s schema and forgotten in a hand-written form would be a
 * silently missing input — money the return never sees.
 *
 * So the form is **derived from the schema the validator already uses**.
 * `toJsonSchema` (upstream `fjs/media/json/schema`) walks any rtti schema, and
 * `fjs/server/finance_schema` already serves exactly that to MCP clients. This
 * module turns that JSON Schema into a field list a renderer can draw. The
 * field list therefore cannot drift from the validator: both grow from the
 * same constant, and the two-way proof below pins it.
 *
 * ## What the schema does and does not carry
 *
 * Four node shapes appear across all thirty dialects, and each maps to one
 * control:
 *
 * | JSON Schema node | Field kind | Renders as |
 * |---|---|---|
 * | `{ const: true }` | `checkbox` | a checkbox — the `option(true)` idiom, present-or-absent, never `false` |
 * | `{ const: 'vnd.fjs.w2' }` | `fixed` | nothing; the dialect tag is supplied, not asked |
 * | `{ type: 'string' }` | `text` | a text input |
 * | `{ type: 'number' }` | `number` | a number input |
 * | `{ type: 'array', items: { type: 'string' } }` | `stringList` | a repeating single input |
 * | `{ type: 'array', items: { type: 'object', … } }` | `rows` | a repeating group, `fields` carrying the row's own models |
 *
 * **What it does NOT carry is a union.** `filingStatus` is a union of four
 * literals in rtti and reaches JSON Schema as a bare `{ type: 'string' }`; the
 * fifty-one-member kind vocabulary reaches it as `{ type: 'array', items: {
 * type: 'string' } }`. Their permitted values live in the modules that own
 * them — `individualFilingStatuses` in `fjs/tax/params`, `kindVocabulary` in
 * `fjs/return/profile` — and a renderer that wants a `<select>` reads them
 * from there. **This module does not hand-type either list**, because a
 * hand-typed copy of a vocabulary is the drift this module exists to avoid.
 *
 * ## Labels are derived, never tabulated
 *
 * `labelOf` mechanically de-camelizes: `box1WagesTipsOtherCompensation`
 * becomes `Box 1 wages tips other compensation`. A hand-written label table
 * would read better and would go stale silently the first time a field is
 * renamed. A derived label that reads awkwardly is a **visible** defect
 * anybody can fix; a stale table is an invisible one. That trade is this
 * repository's own recorded lesson, applied before it costs anything.
 *
 * No regular expressions: no `.f.js` module in this tree uses one, and
 * upstream's own style rules forbid them outright.
 *
 * @module
 */
import { assert, assertEq, assertNotNullish } from 'functionalscript/fjs/asserts/module.f.mjs'
import { toJsonSchema } from 'functionalscript/fjs/media/json/schema/module.f.mjs'
import { w2Schema } from '../w2/module.f.js'
import { returnProfileSchema } from '../../return/profile/module.f.js'

/** @import { Unknown as JsonUnknown } from 'functionalscript/fjs/media/json/types.js' */

/**
 * What a renderer needs to draw one control. `fields` is present only on
 * `rows`, and is the row's own field list.
 *
 * @typedef {{
 *     readonly name: string,
 *     readonly label: string,
 *     readonly kind: FieldKind,
 *     readonly required: boolean,
 *     readonly fixedValue?: JsonUnknown,
 *     readonly fields?: readonly FieldModel[],
 * }} FieldModel
 */

/** @typedef {'text' | 'number' | 'checkbox' | 'fixed' | 'stringList' | 'rows'} FieldKind */

/** @type {(c: string) => boolean} */
const isUpper = c => c >= 'A' && c <= 'Z'

/** @type {(c: string) => boolean} */
const isLower = c => c >= 'a' && c <= 'z'

/** @type {(c: string) => boolean} */
const isDigit = c => c >= '0' && c <= '9'

/**
 * A space belongs between two characters when the case or the character class
 * changes: `box1` -> `box 1`, `1Wages` -> `1 Wages`, `taxYear` -> `tax Year`.
 * An underscore is already a boundary and becomes the space itself.
 * @type {(previous: string) => (current: string) => boolean}
 */
/**
 * The end of the run of characters of `name`'s kind that starts at `from`.
 * @type {(kind: (c: string) => boolean) => (name: string) => (from: number) => number}
 */
const runEnd = kind => name => from => {
    let end = from
    while (end < name.length && kind(name[end] ?? '')) { end += 1 }
    return end
}

/**
 * A property name as a human label, derived rather than tabulated. Read the
 * module docstring for why a derived-but-awkward label beats a hand-written
 * one that can go stale.
 * @type {(name: string) => string}
 */
export const labelOf = name => {
    /** @type {string[]} */
    const words = []
    let i = 0
    while (i < name.length) {
        const c = name[i] ?? ''
        if (c === '_') { i += 1; continue }
        if (isDigit(c)) {
            const end = runEnd(isDigit)(name)(i)
            words.push(name.slice(i, end))
            i = end
            continue
        }
        if (isUpper(c)) {
            const end = runEnd(isUpper)(name)(i)
            // TWO OR MORE capitals in a row is an acronym, and an acronym is
            // a word — `EIN`, not `e i n`. Splitting it per letter was the
            // old behaviour and it turned `employerEIN`, a name chosen to
            // match the printed W-2, into "Employer e i n".
            if (end - i >= 2) {
                // `HTTPServer`: the last capital of a run that is followed by
                // lowercase belongs to the NEXT word, not to the acronym.
                const acronymEnd = end < name.length && isLower(name[end] ?? '') ? end - 1 : end
                words.push(name.slice(i, acronymEnd))
                i = acronymEnd
                continue
            }
            const wordEnd = runEnd(isLower)(name)(i + 1)
            words.push(name.slice(i, wordEnd).toLowerCase())
            i = wordEnd
            continue
        }
        const end = runEnd(isLower)(name)(i)
        words.push(name.slice(i, end))
        i = end
    }
    const joined = words.join(' ')
    return `${joined.slice(0, 1).toUpperCase()}${joined.slice(1)}`
}

/**
 * The node as a property bag, or `undefined` when it is not one. A narrowing
 * accessor rather than a `node is …` predicate: `tsc` does not accept a type
 * predicate declared through `@type` on an arrow, and the alternative — a cast
 * at each use — is what AGENTS.md forbids.
 * @type {(node: JsonUnknown | undefined) => { readonly [k in string]: JsonUnknown | undefined } | undefined}
 */
const asObject = node =>
    typeof node === 'object' && node !== null && !Array.isArray(node)
        // `Object.fromEntries(Object.entries(...))` rather than the node
        // itself: `Array.isArray` narrows its TRUE branch but not its false
        // one for a `readonly` array type, so `tsc` still sees `TreeArray`
        // here. Rebuilding the bag is honest -- no cast, no `any` -- and the
        // nodes are schema fragments, not data.
        ? Object.fromEntries(Object.entries(node))
        : undefined

/** @type {(node: JsonUnknown | undefined) => (key: string) => JsonUnknown | undefined} */
const member = node => key => asObject(node)?.[key]

/**
 * The field kind for one property node. Anything unrecognized is `text` — a
 * control that shows the raw string is wrong-looking rather than absent, and
 * an absent control loses money silently.
 * @type {(node: JsonUnknown | undefined) => FieldKind}
 */
const kindOf = node => {
    const constant = member(node)('const')
    if (constant !== undefined) { return constant === true ? 'checkbox' : 'fixed' }
    const type = member(node)('type')
    if (type === 'number') { return 'number' }
    if (type === 'array') {
        return member(member(node)('items'))('type') === 'object' ? 'rows' : 'stringList'
    }
    return 'text'
}

/** @type {(node: JsonUnknown | undefined) => readonly string[]} */
const requiredNames = node => {
    const r = member(node)('required')
    return Array.isArray(r) ? r.filter(n => typeof n === 'string') : []
}

/**
 * Every property of an object-shaped JSON Schema node, as field models, in the
 * order the schema states them. A `rows` field carries its row's own models,
 * derived by the same walk — the nesting in `box12` (`code`/`amount`) and
 * `box15Through20` (state and local columns) needs nothing special.
 * @type {(node: JsonUnknown | undefined) => readonly FieldModel[]}
 */
export const fieldsOf = node => {
    const properties = asObject(member(node)('properties'))
    if (properties === undefined) { return [] }
    const required = requiredNames(node)
    return Object.keys(properties).map(name => {
        const property = properties[name]
        const kind = kindOf(property)
        const base = {
            name,
            label: labelOf(name),
            kind,
            required: required.includes(name),
        }
        if (kind === 'fixed') {
            return { ...base, fixedValue: /** @type {JsonUnknown} */ (member(property)('const')) }
        }
        if (kind === 'rows') {
            return { ...base, fields: fieldsOf(member(property)('items')) }
        }
        return base
    })
}

/**
 * A field a person is asked to fill in: everything except the dialect tag and
 * anything else the schema pins to a constant.
 * @type {(fields: readonly FieldModel[]) => readonly FieldModel[]}
 */
export const askedFields = fields => fields.filter(f => f.kind !== 'fixed')

/**
 * One named field, or a failure that names the field that was missing rather
 * than a bare `undefined` two lines later.
 * @type {(fields: readonly FieldModel[]) => (name: string) => FieldModel}
 */
const named = fields => name =>
    assertNotNullish(fields.find(f => f.name === name), ['no such field', name])

export const proof = {
    labels: {
        // Each case is a real property name from a shipped schema, not an
        // invented one — a label rule proven on invented names is proven on
        // nothing.
        digitAfterLetterAndLetterAfterDigit: () => {
            assertEq(labelOf('box1WagesTipsOtherCompensation'), 'Box 1 wages tips other compensation')
            assertEq(labelOf('box12'), 'Box 12')
            assertEq(labelOf('box15Through20'), 'Box 15 through 20')
        },
        underscoreBecomesTheSpace: () => {
            assertEq(labelOf('spouseBornBeforeJan2_1961'), 'Spouse born before jan 2 1961')
        },
        // An acronym is one word. These are the identity fields FORM-KEY-02
        // renamed to match the printed forms, so the rule is proven on the
        // names that motivated it.
        consecutiveCapitalsAreAnAcronym: () => {
            assertEq(labelOf('employerEIN'), 'Employer EIN')
            assertEq(labelOf('employeeSSN'), 'Employee SSN')
            assertEq(labelOf('estateOrTrustEIN'), 'Estate or trust EIN')
            assertEq(labelOf('partnershipEIN'), 'Partnership EIN')
        },
        // A SINGLE capital is not an acronym: `filerEin` is written as a word
        // in its schema and must read as one, or the rule would be guessing
        // at intent the name does not carry.
        oneCapitalIsAWordNotAnAcronym: () => {
            assertEq(labelOf('filerEin'), 'Filer ein')
            assertEq(labelOf('recipientSsn'), 'Recipient ssn')
        },
        // The trailing capital of a run belongs to the word that follows it.
        aRunFollowedByLowercaseSplits: () => {
            assertEq(labelOf('einNumber'), 'Ein number')
            assertEq(labelOf('EINNumber'), 'EIN number')
        },
        plainCamelCase: () => {
            assertEq(labelOf('taxYear'), 'Tax year')
            assertEq(labelOf('dependentCount'), 'Dependent count')
        },
        // The positive control for the rule itself: a label that merely echoed
        // the property name would pass none of the three cases above.
        echoingTheNameIsNotALabel: () => {
            assert(labelOf('taxYear') !== 'taxYear', ['a label must not be the raw property name'])
        },
    },
    fields: {
        // The two-way check. Every property becomes exactly one field and
        // every field names a property -- containment in both directions plus
        // a length, which is what catches a rename that a one-way check reads
        // as a coincidence.
        everyW2PropertyBecomesExactlyOneField: () => {
            const schema = toJsonSchema(w2Schema)
            const properties = Object.keys(assertNotNullish(asObject(member(schema)('properties'))))
            const fields = fieldsOf(schema)
            assertEq(fields.length, properties.length)
            for (const name of properties) {
                assert(fields.some(f => f.name === name), ['property without a field', name])
            }
            for (const f of fields) {
                assert(properties.includes(f.name), ['field without a property', f.name])
            }
        },
        everyProfilePropertyBecomesExactlyOneField: () => {
            const schema = toJsonSchema(returnProfileSchema)
            const properties = Object.keys(assertNotNullish(asObject(member(schema)('properties'))))
            const fields = fieldsOf(schema)
            assertEq(fields.length, properties.length)
            for (const name of properties) {
                assert(fields.some(f => f.name === name), ['property without a field', name])
            }
        },
        // One field of each kind, taken from a shipped schema. `option(true)`
        // must reach a checkbox and not a text box: a text box would accept
        // the string `"false"`, which the validator refuses and which no
        // checkbox can produce.
        eachKindIsRecognized: () => {
            const w2 = named(fieldsOf(toJsonSchema(w2Schema)))
            assertEq(w2('box1WagesTipsOtherCompensation').kind, 'text')
            assertEq(w2('box13RetirementPlan').kind, 'checkbox')
            assertEq(w2('dialect').kind, 'fixed')
            assertEq(w2('box12').kind, 'rows')
            const profile = named(fieldsOf(toJsonSchema(returnProfileSchema)))
            assertEq(profile('dependentCount').kind, 'number')
            assertEq(profile('declaredKinds').kind, 'stringList')
        },
        // A row carries its own fields, and they are the row's properties --
        // the same two-way check one level down.
        rowsCarryTheirOwnFields: () => {
            const box12 = named(fieldsOf(toJsonSchema(w2Schema)))('box12')
            const names = (box12.fields ?? []).map(f => f.name)
            assertEq(names.length, 2)
            assert(names.includes('code'), ['box12 row must carry code', names])
            assert(names.includes('amount'), ['box12 row must carry amount', names])
            // Both are required INSIDE the row, which is a different question
            // from box12 itself being optional on the W-2.
            for (const f of box12.fields ?? []) {
                assert(f.required, ['a box 12 row needs both members', f.name])
            }
        },
        // The dialect tag is supplied, never asked. If it were asked, an
        // accountant could type a dialect the document is not.
        theDialectTagIsFixedAndNotAsked: () => {
            const fields = fieldsOf(toJsonSchema(w2Schema))
            assertEq(named(fields)('dialect').fixedValue, 'vnd.fjs.w2')
            assert(!askedFields(fields).some(f => f.name === 'dialect'),
                ['the dialect tag must not be asked'])
            assertEq(askedFields(fields).length, fields.length - 1)
        },
        // Required-ness comes from the schema, not from a second list here.
        requiredComesFromTheSchema: () => {
            const w2 = toJsonSchema(w2Schema)
            const stated = requiredNames(w2)
            const marked = fieldsOf(w2).filter(f => f.required).map(f => f.name)
            assertEq(marked.length, stated.length)
            for (const name of stated) {
                assert(marked.includes(name), ['stated required, not marked', name])
            }
        },
        // Negative control: a schema with no properties yields no fields
        // rather than throwing, so a dialect this walk does not understand
        // degrades to an empty form instead of taking the page down.
        anObjectWithoutPropertiesYieldsNoFields: () => {
            assertEq(fieldsOf({ type: 'object' }).length, 0)
            assertEq(fieldsOf('not a schema at all').length, 0)
        },
    },
}
