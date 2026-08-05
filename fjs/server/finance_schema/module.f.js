/**
 * `finance_schema` — the MCP-06 tool: given a document dialect tag, return
 * that dialect's OWN RTTI schema, serialized as JSON Schema via fjs's
 * existing `toJsonSchema`. This is the precondition for Success Criterion 1
 * (an agent authors a program against `vnd.fjs.1099int`'s field names): it
 * must read those names from the schema the validator actually enforces,
 * never from a second, hand-maintained field list that could drift from it.
 *
 * ## The lookup map names WHICH schema, never re-describes it
 *
 * `dialectSchemas` below keys each of the four known dialect tag strings to
 * that dialect's own exported schema const (`oneZeroNineNineIntSchema`,
 * `ocrSchema`, `w2Schema`, `medicalExpensesSchema`). It contributes no field
 * names of its own — `toJsonSchema` walks whichever schema constant the map
 * names, so every field an agent sees comes from the same RTTI the dialect's
 * own `validate` enforces. Per `07-CONTEXT.md`, a hand-written field list
 * would be exactly the second-source-of-truth MCP-06 exists to eliminate.
 *
 * ## Unknown dialect: a tool-level `errorResult`, never a throw
 *
 * `toolEntry` already rejects a call missing `dialect` via its own RTTI
 * check on `{ dialect: string }` before this handler ever runs (T-07-03-02).
 * A `dialect` string that IS present but names no known schema is refused
 * here with an actionable message naming both the offending tag and the
 * known set — mirroring `fjs/exec`'s own `refusalMessage` convention — via
 * `errorResult`, so the process never crashes and the connection never
 * drops.
 *
 * @module
 */
import { string } from 'functionalscript/fjs/types/rtti/module.f.js'
import { pure } from 'functionalscript/fjs/effects/module.f.js'
import { runPure } from 'functionalscript/fjs/effects/module.f.js'
import { toolEntry, okResult, errorResult } from 'functionalscript/fjs/protocol/mcp/module.f.js'
import { toJsonSchema } from 'functionalscript/fjs/media/json/schema/module.f.js'
import { assert, assertEq } from 'functionalscript/fjs/asserts/module.f.js'
import { dialect as oneZeroNineNineIntDialect, oneZeroNineNineIntSchema } from '../../document/1099int/module.f.js'
import { dialect as ocrDialect, ocrSchema } from '../../document/ocr/module.f.js'
import { dialect as w2Dialect, w2Schema } from '../../document/w2/module.f.js'
import { dialect as medicalExpensesDialect, medicalExpensesSchema } from '../../document/medical_expenses/module.f.js'

/** @import { Type } from 'functionalscript/fjs/types/rtti/module.f.js' */
/** @import { ToolsCallResult } from 'functionalscript/fjs/protocol/mcp/module.f.js' */

/**
 * Every known document dialect tag, mapped to its OWN exported RTTI schema
 * const — never to a hand-written description of that schema's fields.
 * Typed as an open string-keyed map (not the narrower literal-key object
 * TypeScript would otherwise infer) so looking it up by an arbitrary
 * request-supplied `dialect` string yields a clean `Type | undefined`,
 * never the lossy `{} | null` an `unknown`-cast lookup produces.
 * @type {{ readonly [dialect: string]: Type }}
 */
const dialectSchemas = {
    [oneZeroNineNineIntDialect]: oneZeroNineNineIntSchema,
    [ocrDialect]: ocrSchema,
    [w2Dialect]: w2Schema,
    [medicalExpensesDialect]: medicalExpensesSchema,
}

/** The known dialect tags, in declaration order — used in the refusal message. */
const knownDialects = /** @type {readonly string[]} */ (Object.keys(dialectSchemas))

/**
 * `finance_schema(dialect)`: the MCP tool. Looks `dialect` up in
 * {@link dialectSchemas} and returns `okResult` of that schema's own
 * `toJsonSchema` serialization as JSON text, or an `errorResult` naming the
 * unknown tag and the known set.
 * @type {import('functionalscript/fjs/protocol/mcp/module.f.js').ToolEntry<never>}
 */
export const financeSchemaTool = toolEntry(
    'finance_schema',
    'Given a document dialect tag (e.g. vnd.fjs.1099int), returns that ' +
    "dialect's own field schema as JSON Schema — read this before authoring " +
    'a program against a dialect, so field names are read, never guessed.',
    { dialect: string },
    args => {
        const schema = dialectSchemas[args.dialect]
        if (schema === undefined) {
            return pure(errorResult(
                `unknown dialect: ${args.dialect}; known: ${knownDialects.join(', ')}`,
            ))
        }
        return pure(okResult(JSON.stringify(toJsonSchema(schema))))
    },
)

// ── Tests ────────────────────────────────────────────────────────────────────

/**
 * Runs `financeSchemaTool.handle` for `dialect` and returns the resulting
 * `ToolsCallResult` — every call resolves via `pure`, so `runPure` always
 * yields exactly one value; a genuinely empty result here would mean the
 * handler unexpectedly issued a command, which `assert` below catches.
 * @type {(dialect: string) => import('functionalscript/fjs/protocol/mcp/module.f.js').ToolsCallResult}
 */
const call = dialect => {
    const [result] = runPure(financeSchemaTool.handle({ dialect }))
    assert(result !== undefined, 'expected finance_schema to resolve via pure, not a command')
    return result
}

/**
 * Narrows a `ToolsCallResult`'s first content item to its `text` field.
 * `content[0]` is a `TextContent | EmbeddedResource` union; `financeSchemaTool`
 * only ever returns `textContent` items (via `okResult`/`errorResult`), so
 * asserting `type === 'text'` here is a proof-time sanity check, not a cast.
 * @type {(result: ToolsCallResult) => string}
 */
const textOf = result => {
    const item = result.content[0]
    assert(item !== undefined && item.type === 'text', ['expected a text content item', item])
    return item.text
}

export const proof = {
    // Task 2: one full round-trip leaf per known dialect (the returned
    // text, JSON-parsed, deep-equals `toJsonSchema` called directly on that
    // dialect's own schema const — never a hand-written JSON literal, which
    // would reintroduce the second-source-of-truth MCP-06 forbids), plus one
    // leaf for the unknown-dialect refusal. Five leaves total.
    oneZeroNineNineIntResolves: () => {
        const result = call('vnd.fjs.1099int')
        assertEq(result.isError, undefined)
        assertEq(
            JSON.stringify(JSON.parse(textOf(result))),
            JSON.stringify(toJsonSchema(oneZeroNineNineIntSchema)),
        )
    },
    ocrResolves: () => {
        const result = call('vnd.fjs.ocr')
        assertEq(result.isError, undefined)
        assertEq(
            JSON.stringify(JSON.parse(textOf(result))),
            JSON.stringify(toJsonSchema(ocrSchema)),
        )
    },
    w2Resolves: () => {
        const result = call('vnd.fjs.w2')
        assertEq(result.isError, undefined)
        assertEq(
            JSON.stringify(JSON.parse(textOf(result))),
            JSON.stringify(toJsonSchema(w2Schema)),
        )
    },
    medicalExpensesResolves: () => {
        const result = call('vnd.fjs.medical_expenses')
        assertEq(result.isError, undefined)
        assertEq(
            JSON.stringify(JSON.parse(textOf(result))),
            JSON.stringify(toJsonSchema(medicalExpensesSchema)),
        )
    },
    // An unknown dialect is a tool-level errorResult, never a throw — names
    // the offending tag in the message (T-07-03-02).
    unknownDialectRefused: () => {
        const result = call('vnd.fjs.does-not-exist')
        assertEq(result.isError, true)
        const text = textOf(result)
        assert(text.includes('vnd.fjs.does-not-exist'), ['expected offending dialect named', text])
        for (const known of knownDialects) {
            assert(text.includes(known), ['expected known dialect named', known, text])
        }
    },
}
