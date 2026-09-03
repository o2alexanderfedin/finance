/**
 * DOC-25: dialect validation on the write path.
 *
 * ## What this closes
 *
 * `fjs/todo/no-dialect-validation-on-the-write-path.md` recorded, by reading
 * production code, that nothing between `cas_add` and a stored program's
 * `route` checked a blob against its dialect. Upstream `cas_add` classifies
 * against three UPSTREAM dialects, none of them a finance one, and
 * `detectFinance` — which does carry the per-dialect semantic checks — reached
 * production at exactly one **read-only** site. So a malformed `vnd.fjs.w2`,
 * a box carrying `"12.345"` or a required field missing, was stored, routed
 * and computed from.
 *
 * It had not bitten because every producer calls its dialect's own `validate`
 * before storing. **That is a convention among callers, not an enforced
 * invariant**, and the proof below stores a bad blob without going through any
 * producer, which is the only way to test the invariant rather than the
 * convention.
 *
 * ## Where the check goes, and why here rather than at `route`
 *
 * The note offered three options and preferred validating in the stored
 * program at `route`. **This takes the write boundary instead**, for a reason
 * the note itself supplies: the write path is a public protocol surface. A
 * refusal at `route` arrives after the bytes are stored and addressable, so
 * the store accumulates documents it will never accept — and `fjs_run`'s run
 * record, where that refusal would land, is not where an agent that just
 * called `cas_add` is looking. Refusing at the site that already knows the
 * dialect keeps the store's contents true by construction.
 *
 * `evo_add` is deliberately NOT wrapped: its `snapshot` is a hash, not
 * content, so no document bytes enter through it. `cas_add` is the only tool
 * that writes them.
 *
 * ## What is still storable
 *
 * A blob that does not declare a finance dialect is stored unexamined — the
 * CAS is general-purpose and holds programs, notes and revisions, and the
 * cost the note named for this option was exactly that arbitrary content must
 * remain storable. The check fires only when a payload CLAIMS a finance
 * dialect, and then holds it to that claim.
 *
 * @module
 */
import { financeDialects } from '../../media/dialects/module.f.js'
import { parse as jsonParse } from '../../json/module.f.js'
import { decode as base64Decode, encode as base64Encode } from 'functionalscript/fjs/basen/base64/module.f.mjs'
import { tryUtf8, utf8ToString } from 'functionalscript/fjs/text/module.f.mjs'
import { pureOk } from 'functionalscript/fjs/effects/module.f.mjs'
import { errorResult } from 'functionalscript/fjs/protocol/mcp/module.f.mjs'
import { assert, assertEq, assertNotNullish } from 'functionalscript/fjs/asserts/module.f.mjs'

/** @import { Unknown } from 'functionalscript/fjs/media/json/types.js' */
/** @import { Operation } from 'functionalscript/fjs/effects/types.js' */
/** @import { ToolEntry } from 'functionalscript/fjs/protocol/mcp/types.js' */
/** @import { Vec } from 'functionalscript/fjs/types/bit_vec/types.js' */
/** @import { DialectEntry } from 'functionalscript/fjs/media/types.js' */

/**
 * The bytes `cas_add` would store for these arguments, or `undefined` when
 * they do not resolve — a `null` from either decoder is upstream's own
 * "too large or malformed" case, which its handler already answers, so this
 * module leaves that refusal to the handler rather than duplicating its text.
 * @type {(content: string, type: unknown) => Vec | undefined}
 */
const storedBytes = (content, type) => {
    const v = type === 'base64' ? base64Decode(content) : tryUtf8(content)
    return v === null ? undefined : v
}

/**
 * The registry entry a payload's own `dialect` field names, or `undefined`
 * when it names none this repository knows.
 *
 * Bytes that are not UTF-8, not JSON, not an object, or carry no `dialect`
 * string are all "names none" — the CAS legitimately holds every one of those.
 * A `dialect` naming a tag outside {@link financeDialects} is also "names
 * none": an unknown tag is not this build's to adjudicate, and refusing it
 * would stop the store holding a document dialect that a later build adds.
 * @type {(value: Unknown) => DialectEntry | undefined}
 */
const claimedEntry = value => {
    if (typeof value !== 'object' || value === null || value instanceof Array) { return undefined }
    const tag = value['dialect']
    if (typeof tag !== 'string') { return undefined }
    return financeDialects.find(entry => entry.dialect === tag)
}

/**
 * The refusal text for a `cas_add`, or `undefined` when the write may proceed.
 *
 * The verdict comes from the claimed dialect's OWN `match` — the very
 * predicate `detect` consults when it classifies a blob — rather than from a
 * second copy of the per-dialect checks, or from comparing
 * `detectFinance(bytes).mime_type` against the tag. The mime comparison was
 * written first and was wrong in a way worth recording: `detect` answers
 * `application/vnd.fjs.w2+json` while the payload says `vnd.fjs.w2`, so the
 * two never matched and every document claiming a dialect was refused —
 * including valid ones. Asking the entry directly cannot drift from
 * classification, because it is what classification asks.
 * @type {(args: Unknown) => string | undefined}
 */
export const casAddRefusal = args => {
    if (typeof args !== 'object' || args === null || args instanceof Array) { return undefined }
    const content = args['content']
    if (typeof content !== 'string') { return undefined }
    const bytes = storedBytes(content, args['type'])
    if (bytes === undefined) { return undefined }
    // `utf8ToString` is total — `(msbV: Utf8) => string`, never `null` — so
    // bytes that are not valid UTF-8 are decoded lossily rather than
    // rejected here. A `if (text === null) { return undefined }` used to sit
    // on this line and could not fire: it read as the guard for the
    // not-text case, and the not-text case is actually declined one line
    // below, where the lossy text fails to parse as JSON. See
    // `whatThisCheckDeclinesToJudge`'s own not-UTF-8 row, which pins that.
    const text = utf8ToString(bytes)
    const parsed = jsonParse(text)
    if (parsed[0] === 'error') { return undefined }
    const entry = claimedEntry(parsed[1])
    if (entry === undefined) { return undefined }
    return entry.match(parsed[1])
        ? undefined
        : `refused: content declares ${entry.dialect} but does not satisfy it. Nothing was stored. ` +
          'Read the dialect\'s schema with finance_schema and fix the document, or drop the ' +
          '`dialect` field if this is not a finance document.'
}

/**
 * A registry with `cas_add`'s handler fronted by {@link casAddRefusal}.
 *
 * Wrapping the entry rather than reimplementing the tool is what keeps this
 * from becoming a second write path: the store call, the chunking, the size
 * cap and the hash spelling all stay upstream's, and the only thing added is
 * a refusal in front. An entry this does not name is returned unchanged, so
 * a future upstream tool is not silently gated by a check that never
 * considered it.
 * @type {<O extends Operation>(entries: readonly ToolEntry<O>[]) => readonly ToolEntry<O>[]}
 */
export const validatingWrites = entries => entries.map(entry => {
    if (entry.name !== 'cas_add') { return entry }
    return {
        ...entry,
        description: `${entry.description} Content declaring a finance dialect must satisfy that dialect; if it does not, nothing is stored and the refusal names the dialect.`,
        handle: args => {
            const refusal = casAddRefusal(args)
            return refusal === undefined ? entry.handle(args) : pureOk(errorResult(refusal))
        },
    }
})

// ── Tests ────────────────────────────────────────────────────────────────────

/**
 * A `vnd.fjs.w2` that satisfies its dialect, written out by hand.
 *
 * **Deliberately not built by a producer.** Every producer calls its dialect's
 * `validate` before storing, which is the convention this module exists to
 * stop relying on; a fixture routed through one could not express the payload
 * an unconverted client sends. Hand-writing it is the point, not a shortcut.
 */
const validW2 = {
    dialect: 'vnd.fjs.w2',
    employerEIN: '12-3456789',
    employeeSSN: '123-45-6789',
    controlNumber: 'ctl-0001',
    taxYear: 2025,
    formRevision: '2025',
    box1WagesTipsOtherCompensation: '50000.00',
}

/** @type {(value: unknown) => string | undefined} */
const refusalFor = value => casAddRefusal({ content: JSON.stringify(value) })

/**
 * The same payload a client would send with `type: "base64"`.
 * @type {(value: unknown) => string}
 */
const asBase64 = value => assertNotNullish(
    base64Encode(assertNotNullish(tryUtf8(JSON.stringify(value)), 'a JSON string is always valid UTF-8')),
    'byte-aligned input always encodes')

/** Base64 for the two bytes `FF FE`, which no UTF-8 decoder accepts. */
const base64OfNonUtf8Bytes = '//4='

/**
 * Base64 for the 35 bytes
 * `{"dialect":"vnd.fjs.w2","note":"<FF>"}` — a document that CLAIMS
 * `vnd.fjs.w2` and does not satisfy it (every required box is missing),
 * carrying a raw `FF` byte inside the `note` string so the payload as a
 * whole is **not valid UTF-8**.
 *
 * Hand-typed rather than built by {@link asBase64}, and that is the point:
 * `tryUtf8` takes a JS string and can only ever produce well-formed bytes,
 * so a byte sequence no encoder would emit has to be written down. The
 * literal is the transcription of those 35 bytes and nothing reads it back
 * from the code under test.
 */
const base64OfNonUtf8W2Claim = 'eyJkaWFsZWN0Ijoidm5kLmZqcy53MiIsIm5vdGUiOiL/In0='

export const proof = {
    /**
     * `cas_add` accepts `type: "base64"`, so the check has to decode the same
     * way the handler does — otherwise a malformed document could be smuggled
     * past it simply by encoding it. Both directions are stated, because a
     * check that refused EVERY base64 payload would also pass a
     * refusal-only test.
     */
    theBase64PathIsCheckedToo: () => {
        /** @type {readonly (readonly [string, unknown, boolean])[]} */
        const cases = [
            ['a valid document arrives base64-encoded and stores', validW2, false],
            ['a malformed one cannot hide behind the encoding',
                { ...validW2, box1WagesTipsOtherCompensation: '12.345' }, true],
        ]
        assertEq(cases.length, 2, 'smuggling is only disproved by checking both directions')
        for (const [label, value, refused] of cases) {
            assertEq(casAddRefusal({ content: asBase64(value), type: 'base64' }) !== undefined, refused, label)
        }
    },
    /**
     * Bytes that are **not valid UTF-8** buy no exemption from the dialect
     * check: {@link base64OfNonUtf8W2Claim} still claims `vnd.fjs.w2`, still
     * fails it, and is still refused — naming the dialect, exactly as a
     * well-encoded claim is.
     *
     * This is the row the deleted `if (text === null) { return undefined }`
     * in {@link casAddRefusal} would have inverted. That line read as the
     * guard for "these bytes are not text", and if `utf8ToString` had ever
     * answered `null` it would have SKIPPED the check for precisely the
     * payloads a client controls byte-for-byte — a malformed W2 stored by
     * appending one illegal byte. It could not fire (`utf8ToString` is
     * `(msbV: Utf8) => string`, total), so what actually happens is the
     * lossy decode below, and this leaf pins that: the not-text case is
     * declined one line further on, at `jsonParse`, and only when the lossy
     * text is not JSON at all.
     *
     * The control is `whatThisCheckDeclinesToJudge`'s own not-UTF-8 row —
     * `FF FE`, whose lossy decode is not JSON — which is declined. A check
     * that refused every non-UTF-8 payload would pass this leaf and fail
     * that one.
     */
    nonUtf8BytesBuyNoExemptionFromTheDialectCheck: () => {
        const refusal = casAddRefusal({ content: base64OfNonUtf8W2Claim, type: 'base64' })
        assert(refusal !== undefined, 'a non-UTF-8 payload claiming a dialect must still be held to it')
        assert(refusal.includes('vnd.fjs.w2'), [refusal])
        assert(refusal.includes('Nothing was stored'), [refusal])
    },
    /**
     * Everything this check declines to judge, so the write reaches upstream's
     * handler with its own answer intact.
     *
     * The two decode rows matter most: content that is not base64, and content
     * that decodes to bytes that are not UTF-8, are upstream's "too large or
     * malformed" and "not text" cases. Answering them here would put a second,
     * differently-worded refusal in front of one that already exists.
     *
     * The second row is declined at `jsonParse`, NOT by a not-text guard:
     * `FF FE` decodes lossily to `ÿþ`, which is not JSON. See
     * `nonUtf8BytesBuyNoExemptionFromTheDialectCheck` above for the other
     * half — non-UTF-8 bytes whose lossy text IS a dialect claim are judged
     * like any other.
     */
    whatThisCheckDeclinesToJudge: () => {
        /** @type {readonly (readonly [string, Unknown])[]} */
        const cases = [
            ['content that is not valid base64', { content: '!!!not base64!!!', type: 'base64' }],
            ['bytes that decode but are not UTF-8', { content: base64OfNonUtf8Bytes, type: 'base64' }],
            ['arguments that are not an object at all', 'nope'],
            ['arguments that are an array', [1, 2]],
            ['arguments that are null', null],
            ['a `content` that is not a string', { content: 5 }],
        ]
        assertEq(cases.length, 6, 'two decode failures, three non-object argument shapes, one wrong field type')
        for (const [label, args] of cases) {
            assertEq(casAddRefusal(args), undefined, label)
        }
    },
    /**
     * DOC-25. A payload that claims a dialect is held to it, and one that
     * claims none is stored unexamined.
     *
     * The `taxYear` row is the schema half and the money row is the semantic
     * half, so a regression that dropped either check still reddens this leaf.
     */
    aClaimedDialectIsEnforcedAndNothingElseIs: () => {
        /** @type {readonly (readonly [string, unknown, boolean])[]} */
        const cases = [
            ['a document that satisfies its dialect stores', validW2, false],
            ['money with three decimals is refused — the dialect\'s own semantic check',
                { ...validW2, box1WagesTipsOtherCompensation: '12.345' }, true],
            ['a missing required field is refused — the schema half',
                { dialect: 'vnd.fjs.w2', employerEIN: '12-3456789', controlNumber: 'ctl-0001', taxYear: 2025, formRevision: '2025' }, true],
            ['a required field of the wrong type is refused', { ...validW2, taxYear: '2025' }, true],
            ['a tag no registry knows is not this build\'s to adjudicate',
                { ...validW2, dialect: 'vnd.example.other' }, false],
            ['JSON carrying no dialect at all is ordinary content', { a: 1 }, false],
        ]
        assertEq(cases.length, 6, 'both halves of the check, plus the three ways a payload claims nothing')
        for (const [label, value, refused] of cases) {
            assertEq(refusalFor(value) !== undefined, refused, [label, refusalFor(value)])
        }
    },
    /**
     * Bytes that are not a finance document at all remain storable — the cost
     * the todo note named for choosing the write boundary, paid explicitly
     * rather than discovered later by a caller who could not store a program.
     */
    arbitraryContentIsStillStorable: () => {
        /** @type {readonly (readonly [string, string])[]} */
        const cases = [
            ['plain text', 'hello world'],
            ['a JSON array', '[1, 2, 3]'],
            ['not JSON at all', '{ this is not json'],
            ['empty content', ''],
        ]
        assertEq(cases.length, 4, 'text, a non-object JSON value, malformed JSON, and nothing')
        for (const [label, content] of cases) {
            assertEq(casAddRefusal({ content }), undefined, label)
        }
    },
    /** The refusal names the dialect, so a caller knows which schema to read. */
    theRefusalNamesTheDialect: () => {
        const refusal = refusalFor({ ...validW2, box1WagesTipsOtherCompensation: '12.345' })
        assert(refusal !== undefined, 'expected a refusal')
        assert(refusal.includes('vnd.fjs.w2'), [refusal])
        assert(refusal.includes('Nothing was stored'), [refusal])
        assert(refusal.includes('finance_schema'), [refusal])
    },
    /**
     * {@link validatingWrites} fronts `cas_add` and returns every other entry
     * unchanged — by identity, not by comparing fields, so an entry that grew
     * a field cannot pass this by accident.
     */
    onlyCasAddIsFronted: () => {
        /** @type {readonly {readonly name: string, readonly description: string, readonly inputRtti: never, readonly handle: never}[]} */
        const registry = [
            { name: 'cas_add', description: 'd', inputRtti: /** @type {never} */ (0), handle: /** @type {never} */ (0) },
            { name: 'cas_get', description: 'd', inputRtti: /** @type {never} */ (0), handle: /** @type {never} */ (0) },
        ]
        const wrapped = validatingWrites(registry)
        assertEq(wrapped.length, registry.length)
        assert(wrapped[0] !== registry[0], 'cas_add must be replaced')
        assert(wrapped[1] === registry[1], 'every other entry must be returned by identity')
        const fronted = assertNotNullish(wrapped[0], 'the wrapper must return an entry for cas_add')
        assertEq(fronted.name, 'cas_add')
        assert(fronted.description.includes('finance dialect'), 'the refusal must be documented on the tool')
    },
}
