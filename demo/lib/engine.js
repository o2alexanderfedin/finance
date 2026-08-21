/**
 * The one place this demo reaches into the engine.
 *
 * Everything below is imported from the SHIPPED modules under `fjs/` — the
 * same files `npm test` runs its 2220 project-local proofs against. Nothing
 * is re-implemented
 * here, nothing is mocked, and no number this demo displays is typed into a
 * fixture except the ones explicitly labelled as hand-transcribed expected
 * values.
 *
 * This works in a browser for one reason: every module under `fjs/` is pure
 * FunctionalScript and imports nothing from `node:`. The transitive closure
 * behind this file is 108 modules and contains no host API at all — no
 * filesystem, no network, no clock. (43 when this header was written;
 * re-measured on 2026-08-18 by walking the import graph.) A bundler is not merely unnecessary,
 * there is nothing for it to do: the browser's own module loader resolves
 * `functionalscript/...` through the import map in `index.html`.
 *
 * @module
 */
import { form1040Report, form1040IncomeLines, unionSources } from '../../fjs/form1040/core/module.f.js'
import { dispatchLine16 } from '../../fjs/tax/line16/module.f.js'
import { qdcgt } from '../../fjs/tax/line16/qdcgt/module.f.js'
import {
    lookupTaxTable, taxComputationWorksheet, baseTaxForAmount, rowFor,
    tableUpperBoundCents, handTranscribedRows, handTranscribedTaxComputationWorksheetRows,
} from '../../fjs/tax/table/module.f.js'
import { standardDeductionCents, maxAgedOrBlindBoxes, expectedChartCombinationCount } from '../../fjs/tax/deduction/module.f.js'
import { taxParamsByYear, individualFilingStatuses } from '../../fjs/tax/params/module.f.js'
import { validate as validateProfile, kindVocabulary } from '../../fjs/return/profile/module.f.js'
import { classifyScope, modeledKinds, unmodeledKindRefusals, scopeRefusal } from '../../fjs/return/scope/module.f.js'
import { tripwires } from '../../fjs/return/tripwire/module.f.js'
import { applyWholeDollarElection } from '../../fjs/report/line/module.f.js'
import { validate as validateW2, w2Schema } from '../../fjs/document/w2/module.f.js'
import { validate as validate1099Int, oneZeroNineNineIntSchema } from '../../fjs/document/1099int/module.f.js'
import { centsFromString, centsToString, tryCentsFromString } from '../../fjs/exact/module.f.js'
import { interpret, stepBudget } from '../../fjs/exec/module.f.js'
import { checkSpecifiers, programFileName } from '../../fjs/guest/materialize/module.f.js'
import { casOpNames, guestCtx } from '../../fjs/guest/module.f.js'
import { computeSync, sha256 } from 'functionalscript/fjs/crypto/sha2/module.f.mjs'
import { toJsonSchema } from 'functionalscript/fjs/media/json/schema/module.f.mjs'
import { documentDialects, enterableDialects, dialectNamed } from '../../fjs/document/registry/module.f.js'
import { fieldsOf, askedFields, labelOf } from '../../fjs/document/form_model/module.f.js'
import { storeView } from '../../fjs/guest/store_view/module.f.js'
import { taxReturnReport } from '../../fjs/report/tax_return/module.f.js'
import { taxGuestCtx } from '../../fjs/guest/tax/module.f.js'
import { formSubject } from '../../fjs/document/subject/module.f.js'
import { ok } from 'functionalscript/fjs/types/result/module.f.mjs'
import { vecToCBase32 } from 'functionalscript/fjs/basen/cbase32/module.f.mjs'
import { vec8 } from 'functionalscript/fjs/types/bit_vec/module.f.mjs'
import { do_, step, pure } from 'functionalscript/fjs/effects/module.f.mjs'

export {
    // The hand-entry app's door: the dialect registry, the schema-derived form
    // model, the store view the guest program reads through, and the guest
    // program itself. Everything the app needs to turn typed boxes into a
    // return, and nothing it needs to KNOW about how a return is computed.
    documentDialects, enterableDialects, dialectNamed,
    fieldsOf, askedFields, labelOf,
    storeView, taxReturnReport, taxGuestCtx, formSubject,
    toJsonSchema,
    interpret, stepBudget, checkSpecifiers, programFileName, casOpNames, guestCtx,
    do_, step, pure, ok,
    form1040Report, form1040IncomeLines, unionSources,
    dispatchLine16, qdcgt,
    lookupTaxTable, taxComputationWorksheet, baseTaxForAmount, rowFor,
    tableUpperBoundCents, handTranscribedRows, handTranscribedTaxComputationWorksheetRows,
    standardDeductionCents, maxAgedOrBlindBoxes, expectedChartCombinationCount,
    individualFilingStatuses,
    validateProfile, kindVocabulary,
    classifyScope, modeledKinds, unmodeledKindRefusals, scopeRefusal, tripwires,
    applyWholeDollarElection,
    validateW2, w2Schema, validate1099Int, oneZeroNineNineIntSchema,
    centsFromString, centsToString, tryCentsFromString,
}

/**
 * TY2025's parameters, narrowed once.
 *
 * `noUncheckedIndexedAccess` is on across the repository, so the year-keyed
 * lookup is `TaxParamSet | undefined`, and a cast or a `!` is banned. Throwing
 * on absence is the only compliant narrowing — and it is unreachable, because
 * 2025 is in the table.
 */
const found = taxParamsByYear[2025]
if (found === undefined) { throw 'TY2025 parameters missing from taxParamsByYear' }

/** @type {typeof found} */
export const ty2025 = found

// ── Content addressing ───────────────────────────────────────────────────────

/**
 * The CAS address of a stored document, computed in the browser by the SAME
 * SHA-256 the server's content store uses (`fileCas(sha256)`), rendered in the
 * same crockford-base32 alphabet (`vecToCBase32`) the store's shard paths use.
 *
 * This is not a stand-in for a hash. It is the hash. Feed these bytes to the
 * running MCP server and it files them under this address.
 * @type {(bytes: Uint8Array) => string}
 */
export const casAddress = bytes =>
    vecToCBase32(computeSync(sha256)([...bytes].map(byte => vec8(BigInt(byte)))))

/**
 * A document's stored bytes: its JSON with keys in declaration order and two
 * spaces of indentation — the exact text shown on the Documents step, so the
 * address on screen is the address OF the text on screen.
 * @type {(value: unknown) => string}
 */
export const storedText = value => JSON.stringify(value, null, 2)

/** A document's stored bytes as UTF-8. @type {(value: unknown) => Uint8Array} */
export const storedBytes = value => new TextEncoder().encode(storedText(value))

/**
 * Wraps a document value as the `Stored<T>` the engine consumes, addressing it
 * by content. Every `documentHash` this demo shows or cites therefore comes
 * from the bytes, never from a fixture constant.
 * @type {<T>(value: T) => { documentHash: string, value: T }}
 */
export const store = value => ({
    documentHash: casAddress(storedBytes(value)),
    value,
})

// ── Presentation ─────────────────────────────────────────────────────────────

/**
 * Exact cents split into the three pieces a printed form prints separately:
 * the sign, the grouped dollars, and the two-digit cents that live in the
 * form's own narrow right-hand column.
 *
 * The grouping is done on the DIGITS — never by handing the value to
 * `Intl.NumberFormat`, which takes a `number` and would round a large
 * return's total through a double on the way to the screen. The whole point
 * of the engine is that this never happens; the display must not undo it on
 * the last hop.
 *
 * This exists as its own function because the Form 1040 step needs the two
 * halves in two different cells and {@link money} needs them joined. One
 * split, two renderings — rather than a second, subtly different, splitter.
 * @type {(cents: bigint) => { readonly sign: string, readonly dollars: string, readonly cents: string }}
 */
export const moneyParts = cents => {
    const magnitude = cents < 0n ? -cents : cents
    // Split on the cents scale ARITHMETICALLY rather than by slicing the
    // formatted string at a `.`: `noUncheckedIndexedAccess` makes a `split`
    // result's members `string | undefined`, and AGENTS.md bans both a cast
    // and a `!` over that. Dividing is also simply what the value means.
    const dollars = magnitude / 100n
    const remainder = magnitude % 100n
    return {
        sign: cents < 0n ? '-' : '',
        dollars: String(dollars).replace(/\B(?=(\d{3})+(?!\d))/g, ','),
        cents: String(remainder).padStart(2, '0'),
    }
}

/**
 * Formats exact cents as dollars with thousands separators.
 * @type {(cents: bigint) => string}
 */
export const money = cents => {
    const parts = moneyParts(cents)
    return `${parts.sign}$${parts.dollars}.${parts.cents}`
}

/**
 * The first and last six characters of a CAS address, for a table cell.
 * @type {(address: string) => string}
 */
export const shortAddress = address => `${address.slice(0, 6)}…${address.slice(-6)}`
