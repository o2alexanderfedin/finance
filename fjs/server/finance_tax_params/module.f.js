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
import { pure } from 'functionalscript/fjs/effects/module.f.js'
import { toolEntry, okResult, errorResult } from 'functionalscript/fjs/protocol/mcp/module.f.js'
import { assert } from 'functionalscript/fjs/asserts/module.f.js'
import { taxParamsByYear } from '../../tax/params/module.f.js'
import { taxTableBandStructure } from '../../tax/table/module.f.js'

/** @import { TaxParamSet } from '../../tax/params/module.f.js' */
/** @import { BandRegion } from '../../tax/table/module.f.js' */

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
 * {@link taxParams2025} alone. Exported so Task 2's proof compares the
 * tool's actual output against this SAME constant, never a second,
 * hand-typed literal and never a fresh `taxParamsResponses[2025]` index
 * (which would be `TaxParamsResponse | undefined` again).
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
 * @type {import('functionalscript/fjs/protocol/mcp/module.f.js').ToolEntry<never>}
 */
export const financeTaxParamsTool = toolEntry(
    'finance_tax_params',
    'Given a tax year, returns that year\'s TY parameter set — standard ' +
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
        return pure(okResult(JSON.stringify(response)))
    },
)
