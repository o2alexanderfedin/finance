/**
 * `finance_tax_params` — the MCP-07 tool: given a tax year, return that
 * year's TY parameter set — standard deduction, aged/blind additional
 * amounts, the dependent standard-deduction cap, ordinary rate brackets,
 * capital-gains breakpoints (Plan 08-01), and the Tax Table's own band
 * structure (Plan 08-02) — so an agent READS these figures rather than
 * recalling them. Mirrors `fjs/server/finance_schema/module.f.js`'s shape
 * exactly (open-keyed lookup map, `errorResult` refusal, `toolEntry`
 * construction), substituting a numeric year key for that tool's string
 * dialect tag.
 *
 * ## Rows are never in the response
 *
 * Per 08-CONTEXT.md's explicit "Representation" decision, the response
 * below carries the Tax Table's band STRUCTURE (`taxTableBandStructure`,
 * five regions) but never the ~2,700 generated rows themselves — those
 * would push a single tool response well past the 64KB size guard on every
 * call, for data an agent can derive on demand through `fjs/tax/table`'s
 * own per-band-lookup and per-row-generation exports instead of reading as
 * a flat list.
 *
 * ## The narrowing lesson, applied twice
 *
 * Indexing the year-2025 parameter set yields `TaxParamSet | undefined`
 * under this project's `noUncheckedIndexedAccess`, even for the literal
 * key `2025` — the open index-signature type `fjs/tax/params/module.f.js`
 * declares does not narrow away on its own. `taxParams2025` below is the
 * ONE place this module indexes that map directly; `assert` (never a
 * non-null assertion, never a cast — both banned by AGENTS.md) narrows it
 * once, and `response2025` is built from that narrowed value alone.
 *
 * `taxParamsResponses` below is a SECOND open-keyed map, this time keyed by
 * an arbitrary, untrusted, request-supplied year — that lookup is already
 * the correct pattern (mirroring `finance_schema`'s own
 * `dialectSchemas[args.dialect]` check) and needs no further narrowing: an
 * `undefined` result there is the ordinary, expected "unknown year" case,
 * refused via `errorResult`, never a bug to work around.
 *
 * ## Unknown year: a tool-level `errorResult`, never a throw
 *
 * `toolEntry` already rejects a call missing `year` (or carrying a
 * non-number) via its own RTTI check on `{ year: number }` before this
 * handler ever runs. A `year` that IS a number but names no known tax year
 * is refused here with an actionable message naming both the offending
 * year and the known set, via `errorResult` — the process never crashes
 * and the connection never drops.
 *
 * @module
 */
import { number } from 'functionalscript/fjs/types/rtti/module.f.js'
import { pure, runPure } from 'functionalscript/fjs/effects/module.f.js'
import { toolEntry, okResult, errorResult } from 'functionalscript/fjs/protocol/mcp/module.f.js'
import { assert, assertEq } from 'functionalscript/fjs/asserts/module.f.js'
import { taxParamsByYear } from '../../tax/params/module.f.js'
import { taxTableBandStructure } from '../../tax/table/module.f.js'
import { stringify as jsonText } from '../../json/module.f.js'

/** @import { ToolEntry, ToolsCallResult } from 'functionalscript/fjs/protocol/mcp/module.f.js' */
/** @import { TaxParamSet } from '../../tax/params/module.f.js' */
/** @import { BandRegion } from '../../tax/table/module.f.js' */
/** @import { StringMap } from 'functionalscript/fjs/types/object/module.f.js' */

/**
 * The shape `finance_tax_params` actually returns: every Plan 08-01
 * parameter this project stores for the year, plus the Tax Table's band
 * structure — explicitly NOT the generated rows (see this module's
 * header).
 * @typedef {{
 *   readonly taxYear: number,
 *   readonly standardDeduction: TaxParamSet['standardDeduction'],
 *   readonly agedOrBlindAdditional: TaxParamSet['agedOrBlindAdditional'],
 *   readonly dependentStandardDeductionCap: TaxParamSet['dependentStandardDeductionCap'],
 *   readonly ordinaryBrackets: TaxParamSet['ordinaryBrackets'],
 *   readonly capitalGainsBreakpoints: TaxParamSet['capitalGainsBreakpoints'],
 *   readonly taxTableBandStructure: readonly BandRegion[],
 * }} TaxParamsResponse
 */

/**
 * TY2025's parameter set, narrowed exactly ONCE at module scope — see this
 * module's header, "The narrowing lesson, applied twice". Every later
 * reference to the year-2025 parameter set anywhere in this module —
 * including {@link response2025} and the `proof` below — uses this
 * constant, never a second direct index into {@link taxParamsByYear}.
 */
const taxParams2025 = taxParamsByYear[2025]
assert(taxParams2025 !== undefined, 'expected TY2025 parameters to be present in taxParamsByYear')

/**
 * TY2025's full `finance_tax_params` response, built from the narrowed
 * {@link taxParams2025} alone.
 *
 * ## This constant must NEVER be the content proof's expected side
 *
 * `year2025Resolves` below does NOT compare the tool's actual output
 * against this SAME constant. That was tried and is exactly wrong: this
 * constant is also what the production handler serializes
 * (`taxParamsResponses[2025]`, built from this same object), so a proof
 * comparing the handler's output against `response2025` can never fail on
 * CONTENT — it only proves JSON round-trips. Confirmed by mutation, twice
 * (see `year2025Resolves`'s own docstring): `npx tsc` stayed clean and
 * `npm test` stayed green for both. A proof's expected side must be
 * produced independently of the code under test; the duplication of
 * hand-typing each figure again is the point, not a smell this module
 * should DRY away.
 * @type {TaxParamsResponse}
 */
export const response2025 = {
    taxYear: 2025,
    standardDeduction: taxParams2025.standardDeduction,
    agedOrBlindAdditional: taxParams2025.agedOrBlindAdditional,
    dependentStandardDeductionCap: taxParams2025.dependentStandardDeductionCap,
    ordinaryBrackets: taxParams2025.ordinaryBrackets,
    capitalGainsBreakpoints: taxParams2025.capitalGainsBreakpoints,
    taxTableBandStructure,
}

/**
 * Every known tax year, mapped to its own exported {@link TaxParamsResponse}
 * const — never to a hand-written description of that year's figures.
 * Typed as an open NUMERIC-keyed map (mirroring `finance_schema`'s
 * open-string-keyed-map lesson, applied here to a numeric key), so looking
 * this up by an arbitrary, untrusted, request-supplied year yields a clean
 * `TaxParamsResponse | undefined`. Exactly one entry today: TY2025.
 * @type {{ readonly [year: number]: TaxParamsResponse }}
 */
export const taxParamsResponses = {
    2025: response2025,
}

/** The known tax years, in declaration order — used in the refusal message. */
export const knownYears = Object.keys(taxParamsResponses).map(Number)

/**
 * `finance_tax_params(year)`: the MCP tool. Looks `year` up in
 * {@link taxParamsResponses} and returns `okResult` of that year's response
 * as JSON text, or an `errorResult` naming the unknown year and the known
 * set.
 * @type {ToolEntry<never>}
 */
export const financeTaxParamsTool = toolEntry(
    'finance_tax_params',
    'Takes {"year": 2025} — the argument is `year`, NOT `taxYear`, which is ' +
    'what `fjs_run` calls the same concept and what this tool names the field ' +
    'in its own response; passing `taxYear` here returns "invalid arguments: ' +
    'unexpected value". Returns that year\'s TY parameter set — standard ' +
    'deduction, aged/blind additional amounts, ordinary rate brackets, ' +
    'capital-gains breakpoints, and the Tax Table\'s band structure, each ' +
    'carrying its own Rev. Proc. citation — read this before authoring a ' +
    'program that consults a tax figure, so parameters are read, never ' +
    'recalled.',
    { year: number },
    args => {
        const response = taxParamsResponses[args.year]
        if (response === undefined) {
            return pure(errorResult(
                `unknown tax year: ${args.year}; known: ${knownYears.join(', ')}`,
            ))
        }
        return pure(okResult(jsonText(response)))
    },
)

// ── Tests ────────────────────────────────────────────────────────────────────

/**
 * Runs `financeTaxParamsTool.handle` for `year` and returns the resulting
 * `ToolsCallResult` — every call resolves via `pure`, so `runPure` always
 * yields exactly one value; a genuinely empty result here would mean the
 * handler unexpectedly issued a command, which `assert` below catches.
 * @type {(year: number) => ToolsCallResult}
 */
const call = year => {
    const [result] = runPure(financeTaxParamsTool.handle({ year }))
    assert(result !== undefined, 'expected finance_tax_params to resolve via pure, not a command')
    return result
}

/**
 * Narrows a `ToolsCallResult`'s first content item to its `text` field.
 * `content[0]` is a `TextContent | EmbeddedResource` union; `financeTaxParamsTool`
 * only ever returns `textContent` items (via `okResult`/`errorResult`), so
 * asserting `type === 'text'` here is a proof-time sanity check, not a cast.
 * @type {(result: ToolsCallResult) => string}
 */
const textOf = result => {
    const item = result.content[0]
    assert(item !== undefined && item.type === 'text', ['expected a text content item', item])
    return item.text
}

/**
 * Narrows an `unknown` JSON value to a plain, non-null, non-array object —
 * the precondition for reading any of its fields via {@link field}.
 * `typeof value === 'object' && value !== null && !Array.isArray(value)`
 * is a genuine runtime check; `assert`'s `asserts v` signature narrows
 * `value` on it exactly as an `if` on the same expression would — never a
 * cast, never a non-null assertion.
 * @type {(value: unknown, description: string) => object}
 */
const asObject = (value, description) => {
    assert(
        typeof value === 'object' && value !== null && !Array.isArray(value),
        ['expected a JSON object', description, value],
    )
    return value
}

/**
 * Reads a named field off a JSON object, returning `unknown` — never
 * `value[key]` directly (a plain `object` has no index signature to read
 * through, and casting one in to make it read is exactly the pattern this
 * fix bans). `Reflect.get`'s own return type is `any`; assigning that
 * `any` to this function's declared `unknown` return costs no cast, since
 * `any` converts to any type for free.
 * @type {(value: object, key: string) => unknown}
 */
const field = (value, key) => Reflect.get(value, key)

/**
 * Narrows an `unknown` JSON value to `string`.
 * @type {(value: unknown, description: string) => string}
 */
const asString = (value, description) => {
    assert(typeof value === 'string', ['expected a string', description, value])
    return value
}

/**
 * Narrows an `unknown` JSON value to `number`.
 * @type {(value: unknown, description: string) => number}
 */
const asNumber = (value, description) => {
    assert(typeof value === 'number', ['expected a number', description, value])
    return value
}

/**
 * Narrows an `unknown` JSON value to a JSON array (element type
 * `unknown`).
 * @type {(value: unknown, description: string) => readonly unknown[]}
 */
const asArray = (value, description) => {
    assert(Array.isArray(value), ['expected an array', description, value])
    return value
}

export const proof = {
    // year2025Resolves is the ONLY content-correctness proof this module
    // has. It must NOT compare the tool's output against response2025 (or
    // any other value the handler itself serializes) — that was tried and
    // is exactly wrong: response2025 IS what the handler serializes, so
    // such a comparison can never fail on content, only on JSON
    // round-tripping. Confirmed by mutation, twice, independently:
    //   1. taxTableBandStructure -> taxTableBandStructure.slice(1) in
    //      response2025 -- silently drops the Tax Table's entire $0-$5
    //      band region from what an agent is served. `npx tsc` stayed
    //      clean; `npm test` stayed GREEN, 262/262.
    //   2. swapping married/unmarried in agedOrBlindAdditional -- an agent
    //      gets the wrong dollar figure for their filing status. `npx tsc`
    //      stayed clean; `npm test` stayed GREEN.
    // The rule this establishes: a proof's expected side must never be
    // produced by the code under test (or by data the code under test
    // also consumes to build its own answer). Every literal below is
    // hand-typed from fjs/tax/params/module.f.js and
    // fjs/tax/table/module.f.js directly -- the DUPLICATION is the point,
    // not a smell to DRY away, because an expected value's entire worth is
    // that it is independent of the thing it checks.
    year2025Resolves: () => {
        const result = call(2025)
        assertEq(result.isError, undefined)

        /** @type {unknown} */
        const parsed = JSON.parse(textOf(result))
        const root = asObject(parsed, 'response root')

        assertEq(asNumber(field(root, 'taxYear'), 'taxYear'), 2025)

        // standardDeduction — every individual filing status's own
        // amount, each citing the OBBBA-revised Rev. Proc. 2025-32 §3.01
        // — never the pre-OBBBA 2024-40 figure.
        const standardDeduction = asObject(field(root, 'standardDeduction'), 'standardDeduction')
        /** @type {StringMap<string>} */
        const expectedStandardDeduction = {
            single: '15750.00',
            marriedFilingJointly: '31500.00',
            marriedFilingSeparately: '15750.00',
            headOfHousehold: '23625.00',
            qualifyingSurvivingSpouse: '31500.00',
        }
        for (const status of Object.keys(expectedStandardDeduction)) {
            const expectedAmount = expectedStandardDeduction[status]
            assert(expectedAmount !== undefined, ['missing expectation for status', status])
            const entry = asObject(field(standardDeduction, status), `standardDeduction.${status}`)
            assertEq(
                asString(field(entry, 'amount'), `standardDeduction.${status}.amount`),
                expectedAmount,
            )
            const citation = asObject(field(entry, 'citation'), `standardDeduction.${status}.citation`)
            assertEq(
                asString(field(citation, 'revProc'), `standardDeduction.${status}.citation.revProc`),
                '2025-32',
            )
            assertEq(
                asString(field(citation, 'section'), `standardDeduction.${status}.citation.section`),
                '§3.01',
            )
        }

        // agedOrBlindAdditional — asserted per key BY NAME (never as a
        // pair) so a married/unmarried swap fails: this is mutation #2
        // above. married is the smaller figure ($1,600.00), unmarried the
        // larger ($2,000.00); both cite Rev. Proc. 2024-40 ALONE — never
        // "as modified by 2025-32", which governs only the basic standard
        // deduction above.
        const agedOrBlindAdditional = asObject(field(root, 'agedOrBlindAdditional'), 'agedOrBlindAdditional')
        const married = asObject(field(agedOrBlindAdditional, 'married'), 'agedOrBlindAdditional.married')
        assertEq(asString(field(married, 'amount'), 'agedOrBlindAdditional.married.amount'), '1600.00')
        const marriedCitation = asObject(field(married, 'citation'), 'agedOrBlindAdditional.married.citation')
        assertEq(
            asString(field(marriedCitation, 'revProc'), 'agedOrBlindAdditional.married.citation.revProc'),
            '2024-40',
        )
        const unmarried = asObject(field(agedOrBlindAdditional, 'unmarried'), 'agedOrBlindAdditional.unmarried')
        assertEq(asString(field(unmarried, 'amount'), 'agedOrBlindAdditional.unmarried.amount'), '2000.00')
        const unmarriedCitation = asObject(field(unmarried, 'citation'), 'agedOrBlindAdditional.unmarried.citation')
        assertEq(
            asString(field(unmarriedCitation, 'revProc'), 'agedOrBlindAdditional.unmarried.citation.revProc'),
            '2024-40',
        )

        // dependentStandardDeductionCap — the two constants.
        const dependentStandardDeductionCap = asObject(
            field(root, 'dependentStandardDeductionCap'),
            'dependentStandardDeductionCap',
        )
        const minimum = asObject(
            field(dependentStandardDeductionCap, 'minimum'),
            'dependentStandardDeductionCap.minimum',
        )
        assertEq(asString(field(minimum, 'amount'), 'dependentStandardDeductionCap.minimum.amount'), '1350.00')
        const earnedIncomeAddOn = asObject(
            field(dependentStandardDeductionCap, 'earnedIncomeAddOn'),
            'dependentStandardDeductionCap.earnedIncomeAddOn',
        )
        assertEq(
            asString(field(earnedIncomeAddOn, 'amount'), 'dependentStandardDeductionCap.earnedIncomeAddOn.amount'),
            '450.00',
        )

        // ordinaryBrackets — all six filing statuses present (the five
        // individual statuses plus estatesAndTrusts), and MFJ's first
        // bracket, whose $23,850 ceiling is the figure the whole Tax
        // Table's low end depends on.
        //
        // This length assertion, not the expectation loop above, is what
        // makes an OMITTED status visible: that loop iterates
        // `expectedStandardDeduction`'s own keys, so a status dropped from
        // BOTH the response and the expectations would pass it silently.
        // Confirmed by mutation (Plan 10-01, Task 2, mutation 2).
        const ordinaryBrackets = asObject(field(root, 'ordinaryBrackets'), 'ordinaryBrackets')
        assertEq(Object.keys(ordinaryBrackets).length, 6)
        const mfjBrackets = asObject(
            field(ordinaryBrackets, 'marriedFilingJointly'),
            'ordinaryBrackets.marriedFilingJointly',
        )
        const mfjBracketList = asArray(
            field(mfjBrackets, 'brackets'),
            'ordinaryBrackets.marriedFilingJointly.brackets',
        )
        const mfjFirstBracket = asObject(
            mfjBracketList[0],
            'ordinaryBrackets.marriedFilingJointly.brackets[0]',
        )
        assertEq(
            asNumber(field(mfjFirstBracket, 'ratePercent'), 'ordinaryBrackets.marriedFilingJointly.brackets[0].ratePercent'),
            10,
        )
        assertEq(
            asString(field(mfjFirstBracket, 'ceiling'), 'ordinaryBrackets.marriedFilingJointly.brackets[0].ceiling'),
            '23850.00',
        )

        // capitalGainsBreakpoints — all six statuses present, and two
        // concrete breakpoints (MFJ and QSS), each hand-typed from
        // fjs/tax/params/module.f.js and read back off the response the
        // tool ACTUALLY serves — never compared against `response2025` or
        // against `fjs/tax/params`' own exports, both of which this
        // module's header records as unable to fail on content.
        const capitalGainsBreakpoints = asObject(field(root, 'capitalGainsBreakpoints'), 'capitalGainsBreakpoints')
        assertEq(Object.keys(capitalGainsBreakpoints).length, 6)
        const mfjBreakpoints = asObject(
            field(capitalGainsBreakpoints, 'marriedFilingJointly'),
            'capitalGainsBreakpoints.marriedFilingJointly',
        )
        assertEq(
            asString(field(mfjBreakpoints, 'zeroRateMax'), 'capitalGainsBreakpoints.marriedFilingJointly.zeroRateMax'),
            '96700.00',
        )
        assertEq(
            asString(field(mfjBreakpoints, 'fifteenRateMax'), 'capitalGainsBreakpoints.marriedFilingJointly.fifteenRateMax'),
            '600050.00',
        )
        const qssBreakpoints = asObject(
            field(capitalGainsBreakpoints, 'qualifyingSurvivingSpouse'),
            'capitalGainsBreakpoints.qualifyingSurvivingSpouse',
        )
        assertEq(
            asString(field(qssBreakpoints, 'zeroRateMax'), 'capitalGainsBreakpoints.qualifyingSurvivingSpouse.zeroRateMax'),
            '96700.00',
        )

        // taxTableBandStructure — the length (5) AND every region's own
        // atLeast/lessThan/width, hand-typed from
        // fjs/tax/table/module.f.js's taxTableBandStructure. This is
        // exactly the field mutation #1 above mutated
        // (taxTableBandStructure.slice(1)); checking every region's own
        // boundaries (not just the length) also catches a mutation that
        // drops one region while duplicating another to preserve the
        // count.
        const bandStructure = asArray(field(root, 'taxTableBandStructure'), 'taxTableBandStructure')
        assertEq(bandStructure.length, 5)
        /** @type {readonly { readonly atLeast: string, readonly lessThan: string, readonly width: string }[]} */
        const expectedBandStructure = [
            { atLeast: '0.00', lessThan: '5.00', width: '5.00' },
            { atLeast: '5.00', lessThan: '15.00', width: '10.00' },
            { atLeast: '15.00', lessThan: '25.00', width: '10.00' },
            { atLeast: '25.00', lessThan: '3000.00', width: '25.00' },
            { atLeast: '3000.00', lessThan: '100000.00', width: '50.00' },
        ]
        for (const [index, expectedRegion] of expectedBandStructure.entries()) {
            const region = asObject(bandStructure[index], `taxTableBandStructure[${index}]`)
            assertEq(
                asString(field(region, 'atLeast'), `taxTableBandStructure[${index}].atLeast`),
                expectedRegion.atLeast,
            )
            assertEq(
                asString(field(region, 'lessThan'), `taxTableBandStructure[${index}].lessThan`),
                expectedRegion.lessThan,
            )
            assertEq(
                asString(field(region, 'width'), `taxTableBandStructure[${index}].width`),
                expectedRegion.width,
            )
        }
    },
    // A round trip through JSON — NOT a content proof (year2025Resolves
    // above is the content proof). This only confirms the response's own
    // serialization is stable under JSON.stringify(JSON.parse(text)),
    // which every plain-data JS object satisfies trivially; it says
    // nothing about whether the VALUES served are correct. Kept as a
    // cheap sanity check, explicitly labeled so nobody mistakes it for
    // content coverage again (that mistake is this module's whole bug
    // history — see year2025Resolves's own docstring).
    responseRoundTripsThroughJson: () => {
        const result = call(2025)
        const text = textOf(result)
        assertEq(JSON.stringify(JSON.parse(text)), text)
    },
    // The no-generated-rows design holds in PRACTICE, not only in intent:
    // the returned text stays comfortably inside the 64KB MCP size guard.
    responseStaysUnderSizeGuard: () => {
        const result = call(2025)
        assert(textOf(result).length < 65536, ['expected the response to stay under the 64KB size guard', textOf(result).length])
    },
    // An unknown tax year is a tool-level errorResult, never a throw —
    // names both the offending year and the known set, mirroring
    // finance_schema's unknownDialectRefused leaf.
    unknownYearRefused: () => {
        const result = call(2024)
        assertEq(result.isError, true)
        const text = textOf(result)
        assert(text.includes('2024'), ['expected the offending year named', text])
        assert(text.includes('2025'), ['expected the known year named', text])
    },
}
