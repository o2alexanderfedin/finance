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
 * `dialectSchemas` below keys each known dialect tag string to that dialect's
 * own exported schema const (`oneZeroNineNineIntSchema`, `ocrSchema`,
 * `w2Schema`, and so on — the map itself is the list; a count enumerated in
 * prose here would be a third copy, and the first version of this sentence,
 * which said "seven", had been wrong by eighteen for six phases before anyone
 * read it). It contributes no field names of
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
import { dialect as oneZeroNineNineNecDialect, oneZeroNineNineNecSchema } from '../../document/1099nec/module.f.js'
import { dialect as businessExpensesDialect, businessExpensesSchema } from '../../document/business_expenses/module.f.js'
import { dialect as formThirtyNineTwentyOneDialect, formThirtyNineTwentyOneSchema } from '../../document/form3921/module.f.js'
import { dialect as formThirtyNineTwentyTwoDialect, formThirtyNineTwentyTwoSchema } from '../../document/form3922/module.f.js'
import { dialect as basisCorrectionDialect, basisCorrectionSchema } from '../../document/basis_correction/module.f.js'
import { dialect as oneZeroNineFiveADialect, oneZeroNineFiveASchema } from '../../document/1095a/module.f.js'
import { dialect as assetRegisterDialect, assetRegisterSchema } from '../../document/asset_register/module.f.js'
import { dialect as k1PartnershipDialect, k1PartnershipSchema } from '../../document/k1_1065/module.f.js'
import { dialect as k1SCorporationDialect, k1SCorporationSchema } from '../../document/k1_1120s/module.f.js'
import { dialect as k1EstateTrustDialect, k1EstateTrustSchema } from '../../document/k1_1041/module.f.js'
import { dialect as itemizedDeductionsDialect, itemizedDeductionsSchema } from '../../document/itemized_deductions/module.f.js'
import { dialect as priorYearCapitalLossDialect, priorYearCapitalLossSchema } from '../../document/prior_year_capital_loss/module.f.js'
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
    [oneZeroNineNineNecDialect]: oneZeroNineNineNecSchema,
    [businessExpensesDialect]: businessExpensesSchema,
    [formThirtyNineTwentyOneDialect]: formThirtyNineTwentyOneSchema,
    [formThirtyNineTwentyTwoDialect]: formThirtyNineTwentyTwoSchema,
    [basisCorrectionDialect]: basisCorrectionSchema,
    [k1PartnershipDialect]: k1PartnershipSchema,
    [k1SCorporationDialect]: k1SCorporationSchema,
    [k1EstateTrustDialect]: k1EstateTrustSchema,
    // Both are REQUIRED fields on `Form1040Inputs` (`itemizedDeductionForms`,
    // `capitalLossCarryoverForms`), classifiable by `fjs/media/dialects` since
    // Phase 13/15, and until the milestone-v2 reconciliation served no schema
    // at all — so an agent filing for anyone who itemizes, or anyone carrying a
    // capital loss forward, had to GUESS the field names. That is the precise
    // second-source-of-truth this tool exists to make unnecessary.
    // `fjs/server/dialect_parity` is what now stops it recurring.
    [itemizedDeductionsDialect]: itemizedDeductionsSchema,
    [priorYearCapitalLossDialect]: priorYearCapitalLossSchema,
    // Form 1095-A. An agent filing for anyone who bought Marketplace
    // coverage has to author Part III's twelve rows, and guessing whether
    // the column is `columnB` or `slcsp` is exactly the guess this tool
    // exists to make unnecessary.
    [oneZeroNineFiveADialect]: oneZeroNineFiveASchema,
    // `vnd.fjs.asset_register`. An agent filing for any sole proprietor who
    // owns equipment has to author a per-asset register, and guessing whether
    // the field is `convention` or `applicableConvention` -- or that
    // `section168kStatus` exists at all -- is exactly the guess this tool
    // exists to make unnecessary. Registered in the SAME commit as
    // `fjs/media/dialects`'s entry.
    [assetRegisterDialect]: assetRegisterSchema,
}

/**
 * The known dialect tags, in declaration order — used in the refusal message,
 * and read by `fjs/server/dialect_parity` as one of the two sides it compares.
 * @type {readonly string[]}
 */
export const knownDialects = /** @type {readonly string[]} */ (Object.keys(dialectSchemas))

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
 *
 * Phase 27 (DOC-20/DOC-21/TAX-30) registers the SEVENTEENTH AND EIGHTEENTH
 * (`vnd.fjs.1099nec`, `vnd.fjs.business_expenses`), moving the count from 16
 * to 18 in one step, and both gained their own `*Resolves` leaf below.
 *
 * Phase 29 (DOC-22/DOC-23/TAX-34) registers the NINETEENTH, TWENTIETH AND
 * TWENTY-FIRST (`vnd.fjs.form3921`, `vnd.fjs.form3922`,
 * `vnd.fjs.basis_correction`), moving the count from 18 to 21 in one step, and
 * all three gained their own `*Resolves` leaf below. It is the first phase to
 * register THREE: two are the phase's own required dialects and the third is
 * the taxpayer assertion TAX-34's basis adjustment cannot be derived without.
 *
 * Phase 30 (DOC-24/TAX-35) registers the TWENTY-SECOND AND TWENTY-THIRD
 * (`vnd.fjs.k1_1065`, `vnd.fjs.k1_1120s`), moving the count from 21 to 23 in
 * one step, and both gained their own `*Resolves` leaf below. **They are
 * registered with `fjs/media/dialects` in the same commit**, which Phase 29's
 * three were not — see that module's own docstring, "This registry and
 * `fjs/server/finance_schema`'s HAD diverged", for the measurement.
 *
 * The milestone-v2 reconciliation registers the TWENTY-FOURTH AND TWENTY-FIFTH
 * (`vnd.fjs.itemized_deductions`, `vnd.fjs.prior_year_capital_loss`), moving the
 * count from 23 to 25 in one step, and both gained their own `*Resolves` leaf
 * below. Neither is new work: both have been classifiable since Phases 13/15 and
 * both are REQUIRED fields on `Form1040Inputs`. They were simply never served
 * here, which is the half of the divergence that cost an agent field names.
 *
 * TAX-35 registers the TWENTY-SIXTH, `vnd.fjs.k1_1041`, moving the count from
 * 25 to 26, and it gained its own `*Resolves` leaf below. It is the THIRD
 * Schedule K-1 face, and serving the wrong schema for it is the expensive
 * mistake: a caller handed the 1065 schema would write a program reading this
 * face's box 1 interest income as ordinary business income.
 *
 * The Form 4562 wiring registers the TWENTY-EIGHTH, `vnd.fjs.asset_register`,
 * moving the count from 27 to 28, and it gained its own `*Resolves` leaf below.
 *
 * **`fjs/server/dialect_parity` is now what keeps this count and
 * `fjs/media/dialects`'s in step.** Raising one of the two hand-typed counts
 * without registering the dialect in BOTH places reddens that gate by name —
 * which is the check the two paragraphs of prose above turned out not to be.
 * @type {number}
 */
const expectedKnownDialectCount = 28

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
    // Phase 27 (DOC-20/DOC-21/TAX-30): Form 1099-NEC and the taxpayer-asserted
    // Schedule C Part II expenses record behind it. The tag is hand-typed
    // here, never read back off `dialectSchemas`, for the reason
    // `expectedKnownDialectCount`'s own docstring gives at length.
    oneZeroNineNineNecResolves: () => {
        const result = call('vnd.fjs.1099nec')
        assertEq(result.isError, undefined)
        assertEq(
            JSON.stringify(JSON.parse(textOf(result))),
            JSON.stringify(toJsonSchema(oneZeroNineNineNecSchema)),
        )
    },
    businessExpensesResolves: () => {
        const result = call('vnd.fjs.business_expenses')
        assertEq(result.isError, undefined)
        assertEq(
            JSON.stringify(JSON.parse(textOf(result))),
            JSON.stringify(toJsonSchema(businessExpensesSchema)),
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
    // Phase 29 (DOC-22/DOC-23/TAX-34): the two equity-compensation forms
    // neither of which is filed with the return, and the taxpayer's own basis
    // correction. Each tag hand-typed, never read back off `dialectSchemas`.
    formThirtyNineTwentyOneResolves: () => {
        const result = call('vnd.fjs.form3921')
        assertEq(result.isError, undefined)
        assertEq(
            JSON.stringify(JSON.parse(textOf(result))),
            JSON.stringify(toJsonSchema(formThirtyNineTwentyOneSchema)),
        )
    },
    formThirtyNineTwentyTwoResolves: () => {
        const result = call('vnd.fjs.form3922')
        assertEq(result.isError, undefined)
        assertEq(
            JSON.stringify(JSON.parse(textOf(result))),
            JSON.stringify(toJsonSchema(formThirtyNineTwentyTwoSchema)),
        )
    },
    // Form 1095-A, the Health Insurance Marketplace Statement -- the
    // TWENTY-SEVENTH, registered in the same commit as the Form 8962 wiring
    // that reads it. The tag is hand-typed here, never read back off
    // `dialectSchemas`, for the reason `expectedKnownDialectCount`'s own
    // docstring gives at length.
    oneZeroNineFiveAResolves: () => {
        const result = call('vnd.fjs.1095a')
        assertEq(result.isError, undefined)
        assertEq(
            JSON.stringify(JSON.parse(textOf(result))),
            JSON.stringify(toJsonSchema(oneZeroNineFiveASchema)),
        )
    },
    // TWENTY-EIGHTH, registered in the same commit as the Form 4562 wiring.
    assetRegisterResolves: () => {
        const result = call('vnd.fjs.asset_register')
        assertEq(result.isError, undefined)
        assertEq(
            JSON.stringify(JSON.parse(textOf(result))),
            JSON.stringify(toJsonSchema(assetRegisterSchema)),
        )
    },
    basisCorrectionResolves: () => {
        const result = call('vnd.fjs.basis_correction')
        assertEq(result.isError, undefined)
        assertEq(
            JSON.stringify(JSON.parse(textOf(result))),
            JSON.stringify(toJsonSchema(basisCorrectionSchema)),
        )
    },
    // Phase 30 (DOC-24/TAX-35): the two Schedule K-1 dialects. Two, not one,
    // because the printed box numbering differs between Form 1065 and Form
    // 1120-S — and the tool that serves a schema to a program author is
    // exactly where that difference has to be visible, since an author who
    // reads the wrong schema writes a program that reads the wrong box. Each
    // tag hand-typed, never read back off `dialectSchemas`.
    k1PartnershipResolves: () => {
        const result = call('vnd.fjs.k1_1065')
        assertEq(result.isError, undefined)
        assertEq(
            JSON.stringify(JSON.parse(textOf(result))),
            JSON.stringify(toJsonSchema(k1PartnershipSchema)),
        )
    },
    k1SCorporationResolves: () => {
        const result = call('vnd.fjs.k1_1120s')
        assertEq(result.isError, undefined)
        assertEq(
            JSON.stringify(JSON.parse(textOf(result))),
            JSON.stringify(toJsonSchema(k1SCorporationSchema)),
        )
    },
    // TAX-35's third Schedule K-1. The tag is hand-typed here, like the two
    // above, so serving this dialect the WRONG schema reddens by name.
    k1EstateTrustResolves: () => {
        const result = call('vnd.fjs.k1_1041')
        assertEq(result.isError, undefined)
        assertEq(
            JSON.stringify(JSON.parse(textOf(result))),
            JSON.stringify(toJsonSchema(k1EstateTrustSchema)),
        )
    },
    // The milestone-v2 reconciliation: the two dialects the 1040 engine
    // REQUIRES (`itemizedDeductionForms` and `capitalLossCarryoverForms` are
    // both non-optional members of `Form1040Inputs`) and this tool served no
    // schema for until now. Each tag hand-typed, never read back off
    // `dialectSchemas`.
    itemizedDeductionsResolves: () => {
        const result = call('vnd.fjs.itemized_deductions')
        assertEq(result.isError, undefined)
        assertEq(
            JSON.stringify(JSON.parse(textOf(result))),
            JSON.stringify(toJsonSchema(itemizedDeductionsSchema)),
        )
    },
    priorYearCapitalLossResolves: () => {
        const result = call('vnd.fjs.prior_year_capital_loss')
        assertEq(result.isError, undefined)
        assertEq(
            JSON.stringify(JSON.parse(textOf(result))),
            JSON.stringify(toJsonSchema(priorYearCapitalLossSchema)),
        )
    },
    // The two schemas the tool serves for those tags are DIFFERENT documents,
    // asserted rather than assumed. A registration that pointed both tags at
    // one schema would satisfy both leaves above — each compares the tool's
    // output against the schema it imported — and would be precisely the
    // single-schema mistake DOC-24's "two dialects, not one" exists to
    // prevent.
    theTwoScheduleK1SchemasAreNotTheSameSchema: () => {
        const partnership = textOf(call('vnd.fjs.k1_1065'))
        const sCorporation = textOf(call('vnd.fjs.k1_1120s'))
        assert(partnership !== sCorporation, 'the two K-1 schemas must differ')
        // ...and they differ in the specific way that costs money: the
        // partnership face carries a self-employment box and a partner type,
        // and the S-corporation face carries neither.
        assert(partnership.includes('box14SelfEmploymentEarnings'), [partnership])
        assert(!sCorporation.includes('box14SelfEmploymentEarnings'), [sCorporation])
        assert(partnership.includes('boxGGeneralPartnerOrLlcMemberManager'), [partnership])
        assert(!sCorporation.includes('boxGGeneralPartnerOrLlcMemberManager'), [sCorporation])
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
