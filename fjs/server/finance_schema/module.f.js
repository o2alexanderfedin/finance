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
 * `dialectSchemas` below keys each of the seven known dialect tag strings to
 * that dialect's own exported schema const (`oneZeroNineNineIntSchema`,
 * `ocrSchema`, `w2Schema`, `medicalExpensesSchema`, `returnProfileSchema`,
 * `oneZeroNineNineRSchema`, `ssa1099Schema`). It contributes no field names of
 * its own — `toJsonSchema` walks whichever schema constant the map names, so
 * every field an agent sees comes from the same RTTI the dialect's own
 * `validate` enforces. Per `07-CONTEXT.md`, a hand-written field list would be
 * exactly the second-source-of-truth MCP-06 exists to eliminate.
 *
 * `vnd.fjs.return_profile` is the fifth and is not a document read off a
 * printed form at all — it is what the taxpayer DECLARES (10-CONTEXT.md
 * Decision 4). It belongs here for the same reason as the other four: an
 * agent authoring a program against the declared kind set must read the field
 * names from the schema the validator enforces, never guess them.
 *
 * `vnd.fjs.1099r` and `vnd.fjs.ssa1099` are the sixth and seventh (DOC-08,
 * DOC-09) — printed retirement/benefit forms, following the same "read from
 * the schema, never guess" rule as every other dialect here.
 *
 * `vnd.fjs.1099div` and `vnd.fjs.1099b` are the eighth and ninth (DOC-06,
 * DOC-07) — printed brokerage forms, following the same "read from the
 * schema, never guess" rule as every other dialect here.
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
import { dialect as returnProfileDialect, returnProfileSchema } from '../../return/profile/module.f.js'
import { dialect as oneZeroNineNineRDialect, oneZeroNineNineRSchema } from '../../document/1099r/module.f.js'
import { dialect as ssa1099Dialect, ssa1099Schema } from '../../document/ssa1099/module.f.js'
import { dialect as oneZeroNineNineGDialect, oneZeroNineNineGSchema } from '../../document/1099g/module.f.js'
import { dialect as oneZeroNineNineDivDialect, oneZeroNineNineDivSchema } from '../../document/1099div/module.f.js'
import { dialect as oneZeroNineNineBDialect, oneZeroNineNineBSchema } from '../../document/1099b/module.f.js'
import { dialect as adjustmentsDialect, adjustmentsSchema } from '../../document/adjustments/module.f.js'
import { dialect as oneZeroNineEightEDialect, oneZeroNineEightESchema } from '../../document/1098e/module.f.js'
import { dialect as oneZeroNineEightTDialect, oneZeroNineEightTSchema } from '../../document/1098t/module.f.js'
import { dialect as creditsDialect, creditsSchema } from '../../document/credits/module.f.js'
import { dialect as iraDialect, iraSchema } from '../../document/ira/module.f.js'
import { dialect as priorYearIraBasisDialect, priorYearIraBasisSchema } from '../../document/prior_year_ira_basis/module.f.js'
import { stringify as jsonText } from '../../json/module.f.js'

/** @import { Type } from 'functionalscript/fjs/types/rtti/module.f.js' */
/** @import { ToolEntry, ToolsCallResult } from 'functionalscript/fjs/protocol/mcp/module.f.js' */
/** @import { Unknown as JsonUnknown } from 'functionalscript/fjs/media/json/module.f.js' */
/** @import { StringMap } from 'functionalscript/fjs/types/object/module.f.js' */

/**
 * Every known document dialect tag, mapped to its OWN exported RTTI schema
 * const — never to a hand-written description of that schema's fields.
 * Typed as an open string-keyed map (not the narrower literal-key object
 * TypeScript would otherwise infer) so looking it up by an arbitrary
 * request-supplied `dialect` string yields a clean `Type | undefined`,
 * never the lossy `{} | null` an `unknown`-cast lookup produces.
 * @type {StringMap<Type>}
 */
const dialectSchemas = {
    [oneZeroNineNineIntDialect]: oneZeroNineNineIntSchema,
    [ocrDialect]: ocrSchema,
    [w2Dialect]: w2Schema,
    [medicalExpensesDialect]: medicalExpensesSchema,
    [returnProfileDialect]: returnProfileSchema,
    [oneZeroNineNineRDialect]: oneZeroNineNineRSchema,
    [ssa1099Dialect]: ssa1099Schema,
    [oneZeroNineNineGDialect]: oneZeroNineNineGSchema,
    [oneZeroNineNineDivDialect]: oneZeroNineNineDivSchema,
    [oneZeroNineNineBDialect]: oneZeroNineNineBSchema,
    [adjustmentsDialect]: adjustmentsSchema,
    [oneZeroNineEightEDialect]: oneZeroNineEightESchema,
    [oneZeroNineEightTDialect]: oneZeroNineEightTSchema,
    [creditsDialect]: creditsSchema,
    [iraDialect]: iraSchema,
    [priorYearIraBasisDialect]: priorYearIraBasisSchema,
}

/** The known dialect tags, in declaration order — used in the refusal message. */
const knownDialects = /** @type {readonly string[]} */ (Object.keys(dialectSchemas))

/**
 * Independently hand-typed: how many dialects {@link dialectSchemas} registers
 * today. Deliberately NOT `knownDialects.length`.
 *
 * `unknownDialectRefused` below loops over {@link knownDialects} asserting each
 * tag is named in the refusal message, and it is tempting to conclude that a
 * newly registered dialect is therefore covered "for free". **It is not.**
 * `knownDialects` is `Object.keys(dialectSchemas)` — the code under test — so
 * deleting an entry from the map deletes it from the loop's iteration set at
 * the same instant, and that proof stays green over a dialect that quietly
 * stopped being served. Verified by mutation: removing the
 * `vnd.fjs.return_profile` entry reddened `returnProfileResolves` alone, and
 * `unknownDialectRefused` passed.
 *
 * This is AGENTS.md's rule — "a proof's expected value must not be produced by
 * the code under test" — and the same `expectedThresholdCount` /
 * `expectedMoneyBoxFieldCount` idiom `fjs/tax/boundary` and
 * `fjs/document/1099int` already use. Raise it in the same commit that
 * registers a new dialect, and add that dialect's own `*Resolves` leaf. This
 * commit registers the EIGHTH AND NINTH dialects (`vnd.fjs.1099div`,
 * `vnd.fjs.1099b`), so the count moves from 7 to 9 in one step and both new
 * dialects gained their own `*Resolves` leaf below.
 *
 * Phase 24 (DOC-19/TAX-23) registers the ELEVENTH AND TWELFTH
 * (`vnd.fjs.adjustments`, `vnd.fjs.1098e`), moving the count from 10 to 12
 * in one step, and both gained their own `*Resolves` leaf below — the same
 * paired discipline this docstring's own last paragraph asks for.
 *
 * Phase 25 (TAX-25/TAX-26) registers the THIRTEENTH AND FOURTEENTH
 * (`vnd.fjs.1098t`, `vnd.fjs.credits`), moving the count from 12 to 14 in one
 * step, and both gained their own `*Resolves` leaf below.
 *
 * Phase 26 (TAX-28/TAX-29) registers the FIFTEENTH AND SIXTEENTH
 * (`vnd.fjs.ira`, `vnd.fjs.prior_year_ira_basis`), moving the count from 14
 * to 16 in one step, and both gained their own `*Resolves` leaf below.
 * @type {number}
 */
const expectedKnownDialectCount = 16

/**
 * `finance_schema(dialect)`: the MCP tool. Looks `dialect` up in
 * {@link dialectSchemas} and returns `okResult` of that schema's own
 * `toJsonSchema` serialization as JSON text, or an `errorResult` naming the
 * unknown tag and the known set.
 * @type {ToolEntry<never>}
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
        // `toJsonSchema` returns rtti's `UnknownConst`, which differs from
        // `json`'s `Unknown` only by admitting `undefined` — and a JSON Schema
        // never holds one, since `toJsonSchema` builds every field it emits.
        return pure(okResult(jsonText(/** @type {JsonUnknown} */ (toJsonSchema(schema)))))
    },
)

// ── Tests ────────────────────────────────────────────────────────────────────

/**
 * Runs `financeSchemaTool.handle` for `dialect` and returns the resulting
 * `ToolsCallResult` — every call resolves via `pure`, so `runPure` always
 * yields exactly one value; a genuinely empty result here would mean the
 * handler unexpectedly issued a command, which `assert` below catches.
 * @type {(dialect: string) => ToolsCallResult}
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
    // leaf for the unknown-dialect refusal and one hand-typed count that the
    // refusal loop cannot supply itself. Eleven leaves total.
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
    // Phase 24 (DOC-19): the taxpayer-asserted Schedule 1 Part II record.
    adjustmentsResolves: () => {
        const result = call('vnd.fjs.adjustments')
        assertEq(result.isError, undefined)
        assertEq(
            JSON.stringify(JSON.parse(textOf(result))),
            JSON.stringify(toJsonSchema(adjustmentsSchema)),
        )
    },
    // Phase 24 (TAX-23): the transcribed half of Schedule 1 line 21.
    oneZeroNineEightEResolves: () => {
        const result = call('vnd.fjs.1098e')
        assertEq(result.isError, undefined)
        assertEq(
            JSON.stringify(JSON.parse(textOf(result))),
            JSON.stringify(toJsonSchema(oneZeroNineEightESchema)),
        )
    },
    // Phase 25 (TAX-26): the transcribed half of the education credits.
    oneZeroNineEightTResolves: () => {
        const result = call('vnd.fjs.1098t')
        assertEq(result.isError, undefined)
        assertEq(
            JSON.stringify(JSON.parse(textOf(result))),
            JSON.stringify(toJsonSchema(oneZeroNineEightTSchema)),
        )
    },
    // Phase 25 (TAX-25/TAX-26): the taxpayer-asserted Schedule 3 credits record.
    creditsResolves: () => {
        const result = call('vnd.fjs.credits')
        assertEq(result.isError, undefined)
        assertEq(
            JSON.stringify(JSON.parse(textOf(result))),
            JSON.stringify(toJsonSchema(creditsSchema)),
        )
    },
    // Phase 26 (TAX-28/TAX-29): the taxpayer-asserted IRA record behind the
    // QCD election and Form 8606 Part I, and the prior-year basis carried
    // into that form's line 2. The tag is hand-typed here, never read back
    // off `dialectSchemas`, for the reason `expectedKnownDialectCount`'s own
    // docstring gives at length.
    iraResolves: () => {
        const result = call('vnd.fjs.ira')
        assertEq(result.isError, undefined)
        assertEq(
            JSON.stringify(JSON.parse(textOf(result))),
            JSON.stringify(toJsonSchema(iraSchema)),
        )
    },
    priorYearIraBasisResolves: () => {
        const result = call('vnd.fjs.prior_year_ira_basis')
        assertEq(result.isError, undefined)
        assertEq(
            JSON.stringify(JSON.parse(textOf(result))),
            JSON.stringify(toJsonSchema(priorYearIraBasisSchema)),
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
    returnProfileResolves: () => {
        const result = call('vnd.fjs.return_profile')
        assertEq(result.isError, undefined)
        assertEq(
            JSON.stringify(JSON.parse(textOf(result))),
            JSON.stringify(toJsonSchema(returnProfileSchema)),
        )
    },
    oneZeroNineNineRResolves: () => {
        const result = call('vnd.fjs.1099r')
        assertEq(result.isError, undefined)
        assertEq(
            JSON.stringify(JSON.parse(textOf(result))),
            JSON.stringify(toJsonSchema(oneZeroNineNineRSchema)),
        )
    },
    ssa1099Resolves: () => {
        const result = call('vnd.fjs.ssa1099')
        assertEq(result.isError, undefined)
        assertEq(
            JSON.stringify(JSON.parse(textOf(result))),
            JSON.stringify(toJsonSchema(ssa1099Schema)),
        )
    },
    oneZeroNineNineDivResolves: () => {
        const result = call('vnd.fjs.1099div')
        assertEq(result.isError, undefined)
        assertEq(
            JSON.stringify(JSON.parse(textOf(result))),
            JSON.stringify(toJsonSchema(oneZeroNineNineDivSchema)),
        )
    },
    oneZeroNineNineBResolves: () => {
        const result = call('vnd.fjs.1099b')
        assertEq(result.isError, undefined)
        assertEq(
            JSON.stringify(JSON.parse(textOf(result))),
            JSON.stringify(toJsonSchema(oneZeroNineNineBSchema)),
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
    // The independent half of the leaf above: the loop's iteration set is
    // derived from `dialectSchemas`, so it cannot notice an entry going
    // missing. This count is hand-typed and can.
    everyRegisteredDialectIsCounted: () => {
        assertEq(
            knownDialects.length,
            expectedKnownDialectCount,
            [
                'expected exactly the independently-stated dialect count',
                knownDialects.length,
                expectedKnownDialectCount,
            ],
        )
    },
}
