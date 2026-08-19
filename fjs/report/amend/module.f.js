/**
 * PROV-06 — the amendment diff: Form 1040-X's Columns A (original)/B (net
 * change)/C (correct), produced mechanically from two `vnd.fjs.run` records
 * identified only by their CAS hashes.
 *
 * **No new storage mechanism.** PROV-06's own decision text is explicit —
 * "No new mechanism required" — so this module only ever READS existing
 * `vnd.fjs.run` records and the result blobs they already point at. It
 * never calls `cas.write`/`evoAdd`; if this module's own output needs to be
 * citable later, that is a job for the SAME `fjsRunTool`-shaped path (make
 * the diff itself a guest program run via `fjs_run`), not a bespoke write
 * from here (15-RESEARCH.md's own Anti-Pattern warning).
 *
 * **The parameter-set guard is `programHash` equality, not a new field.**
 * Guest programs cannot `import` anything and `guestCtx` exposes no
 * tax-parameter lookup, so every dollar figure a stored program consults is
 * a literal baked into that program's own source text — which the CAS hash
 * already covers. Two runs with equal `programHash` are, by construction,
 * two runs of byte-identical source, including whatever parameters it
 * embedded. `args` equality is a defensive second check for a program that
 * embeds multiple years' logic and dispatches on an `args[0]` selector.
 * Neither check needs a new `vnd.fjs.run` field (15-RESEARCH.md Pitfall 1;
 * that would be PROV-04's still-waived work, not PROV-06's).
 *
 * **The whole-dollar election is applied HERE, host-side, over raw cents —
 * never trusted from either stored program.** `applyWholeDollarElection`
 * (`fjs/report/line`) is not part of `guestCtx`, so a guest program cannot
 * have applied it; the two stored results are therefore always raw exact
 * cents, and `elected` arrives as an explicit caller argument (the phase
 * owner's locked resolution — re-deriving it from stored CAS content would
 * only be valid if both runs pinned the same return-profile revision, which
 * can silently be false). Each side is projected INDEPENDENTLY, before the
 * subtraction that produces Column B, so `B = C - A` holds exactly in the
 * PRINTED dollars a filer would copy onto the form — never in raw cents
 * that a rounding pass has not yet touched.
 *
 * **Mismatched programs/args refuse loudly, naming both hashes** — a
 * confident, wrong Column B is worse than an honest refusal (TAX-16). A run
 * that did not succeed (`status !== 'ok'`) has no `resultHash` to diff and
 * refuses too, naming which side and why.
 *
 * @module
 */
import { cBase32ToVec, vecToCBase32 } from 'functionalscript/fjs/basen/cbase32/module.f.mjs'
import { collectRead, fileCas } from 'functionalscript/fjs/cas/module.f.mjs'
import { empty, nonEmpty } from 'functionalscript/fjs/effects/list/module.f.mjs'
import { utf8ToString, tryUtf8 } from 'functionalscript/fjs/text/module.f.mjs'
import { step, catchStep, pure, pureError, mapStep, history, historyStep, unwrapStep } from 'functionalscript/fjs/effects/module.f.mjs'
import { errorSummary } from 'functionalscript/fjs/effects/node/module.f.mjs'
import { emptyState, virtual } from 'functionalscript/fjs/effects/node/virtual/module.f.mjs'
import { sha256 } from 'functionalscript/fjs/crypto/sha2/module.f.mjs'
import { error, ok } from 'functionalscript/fjs/types/result/module.f.mjs'
import { array, record, string } from 'functionalscript/fjs/types/rtti/module.f.mjs'
import { validate as rttiValidate } from 'functionalscript/fjs/types/rtti/validate/module.f.mjs'
import { assert, assertEq, assertNotNullish } from 'functionalscript/fjs/asserts/module.f.mjs'
import { dialect as runDialect, validate as validateRun } from '../../run/module.f.js'
import { applyWholeDollarElection } from '../line/module.f.js'
import { centsFromString, centsToString, tryCentsFromString } from '../../exact/module.f.js'

/** @import { Effect } from 'functionalscript/fjs/effects/types.js' */
/** @import { List } from 'functionalscript/fjs/effects/list/types.js' */
/** @import { Vec } from 'functionalscript/fjs/types/bit_vec/types.js' */
/** @import { IoChannel } from 'functionalscript/fjs/effects/node/types.js' */
/** @import { Cas, FileCasOperation } from 'functionalscript/fjs/cas/types.js' */
/** @import { Result } from 'functionalscript/fjs/types/result/types.js' */
/** @import { Run, RunError } from '../../run/module.f.js' */
/** @import { ReportLine, Source } from '../line/module.f.js' */
/** @import { Ts, Unknown as RttiUnknown } from 'functionalscript/fjs/types/rtti/ts/types.js' */

// ── The stored result's wire shape ──────────────────────────────────────────
//
// The stored RESULT a run's `resultHash` points at, for a report that
// returns a structured value, is a JSON object keyed by line name, each
// value shaped `{ value: string, sources: readonly Source[], rule: string }`
// — the wire projection of `ReportLine`, exactly as
// `fjs/report/line/module.f.js`'s own `wireProjectionRoundTripsThroughJson`
// proof exhibits it (`value` is a decimal-dollar string, via
// `centsToString`, not a raw cents integer).

const wireSourceSchema = /** @type {const} */ ({
    documentHash: string,
    boxPath: string,
    value: string,
})

const wireLineSchema = /** @type {const} */ ({
    value: string,
    sources: array(wireSourceSchema),
    rule: string,
})

/** rtti schema for a stored result: a record of wire-projected `ReportLine`s, keyed by line name. */
const resultRecordSchema = record(wireLineSchema)

/** @typedef {Ts<typeof wireLineSchema>} WireLine */
/** @typedef {Ts<typeof resultRecordSchema>} WireResultRecord */

const validateResultRecord = rttiValidate(resultRecordSchema)

/**
 * One 1040-X-shaped diff row per line name: Column A (original), Column B
 * (net change), Column C (correct), and the sources each of A/C actually
 * came from — the traceability `ReportLine` already carries, surviving the
 * diff rather than being dropped by it.
 * @typedef {{ readonly [line: string]: {
 *   readonly columnA: string,
 *   readonly columnB: string,
 *   readonly columnC: string,
 *   readonly sourcesA: readonly Source[],
 *   readonly sourcesC: readonly Source[],
 * } }} AmendmentDiffResult
 */

// ── Reading a run record / a stored result back out of CAS by hash ─────────

/**
 * Reads a `vnd.fjs.run` record back out of CAS by hash — the EXACT sequence
 * `fjs/server/fjs_run/module.f.js`'s own `assertPersistedErrorRunRecord` test
 * helper already establishes and proves against real CAS content. Reused
 * verbatim, not re-derived.
 *
 * **Its failure is in the CHANNEL, not the payload** (0.46.0). The read's own
 * `IoChannel` is re-tagged to this module's `string` channel by `catchStep`
 * at the one place that knows what a missing blob means, so every caller
 * composes with a plain `step` and never discharges a `Result` by hand.
 * @type {(cas: Cas<FileCasOperation>) => (runHash: string) => Effect<FileCasOperation, Run, string>}
 */
const readRunRecord = cas => runHash => {
    const vec = cBase32ToVec(runHash)
    if (vec === null) { return pureError(`not a decodable run hash: ${runHash}`) }
    const bytes = catchStep(collectRead(cas.read(vec)), () => pureError(`run record not found: ${runHash}`))
    return step(bytes, read => {
        const [t, v] = validateRun(/** @type {RttiUnknown} */ (JSON.parse(utf8ToString(read))))
        return pure(t === 'error' ? error(runErrorMessage(v)) : ok(v))
    })
}

/**
 * `validateRun`'s error arm is `ValidationError | string` (a structural rtti
 * failure or a `checkReferences` message), but this module's own error
 * channel is a plain string throughout — flattening happens here, once,
 * rather than by narrowing `RunError`'s shape at every call site.
 * @type {(e: RunError) => string}
 */
const runErrorMessage = e => typeof e === 'string' ? e : `${e.message} (at ${e.path.join('.')})`

/**
 * Reads the JSON blob a run's `resultHash` points at and validates it as a
 * record of wire-projected `ReportLine`s. Same read sequence as
 * {@link readRunRecord} — reused, not re-derived.
 * @type {(cas: Cas<FileCasOperation>) => (resultHash: string) => Effect<FileCasOperation, WireResultRecord, string>}
 */
const readResultRecord = cas => resultHash => {
    const vec = cBase32ToVec(resultHash)
    if (vec === null) { return pureError(`not a decodable result hash: ${resultHash}`) }
    const bytes = catchStep(collectRead(cas.read(vec)), () => pureError(`result blob not found: ${resultHash}`))
    return step(bytes, read => {
        const parsed = /** @type {RttiUnknown} */ (JSON.parse(utf8ToString(read)))
        const [t, v] = validateResultRecord(parsed)
        return pure(t === 'error'
            ? error(`stored result at ${resultHash} is not a ReportLine-shaped record: ${v.message} (at ${v.path.join('.')})`)
            : ok(v))
    })
}

// ── Reconstructing ReportLine[], projecting, diffing ────────────────────────

/**
 * Reconstructs one named `ReportLine` from its wire shape as a `Result`,
 * never a throw. This wire content is untrusted CAS-stored data,
 * only structurally validated by `resultRecordSchema` — `array(wireSourceSchema)`
 * permits length 0, and `value: string` accepts any string, so an empty
 * `sources` array and a non-decimal `value` both pass that structural check.
 * This function is the semantic second step, mirroring the structural-rtti +
 * semantic-`checkReferences` two-step every document dialect in this
 * codebase already uses (e.g. `fjs/document/1099b/module.f.js`'s
 * `validate`/`checkReferences` split): `value` is parsed via the
 * `Result`-returning `tryCentsFromString`, never the throwing
 * `centsFromString`; `sources` is checked non-empty explicitly here, rather
 * than assumed from `fjs/report/line`'s compile-time non-empty-tuple
 * guarantee (`readonly [Source, ...(readonly Source[])]`), which holds only
 * on the TypeScript side of the JSON/CAS serialization boundary and is NOT
 * preserved by rtti's `resultRecordSchema` (rtti has no non-empty-array
 * combinator). A wire record violating either check is a malformed stored
 * result, refused by name as an `error(...)` `Result` — never a throw —
 * rather than silently treated as sourceless or crashing the process.
 * @type {(name: string) => (w: WireLine) => Result<{ readonly name: string, readonly line: ReportLine }, string>}
 */
const namedReportLineFromWire = name => w => {
    if (w.sources.length === 0) {
        return error(`stored line "${name}" has no sources`)
    }
    const parsed = tryCentsFromString(w.value)
    if (parsed[0] === 'error') {
        return error(`stored line "${name}" has a malformed value: "${w.value}" (${parsed[1]})`)
    }
    // The length check above already refused an empty `sources`, so `first`
    // is unreachably `undefined` here — `assertNotNullish` is purely a
    // compiler-narrowing device for that internal invariant
    // (`noUncheckedIndexedAccess`), not a second, redundant check against
    // untrusted input. The one check against untrusted input is the length
    // check above.
    const [first, ...rest] = w.sources
    /** @type {{ readonly name: string, readonly line: ReportLine }} */
    const named = {
        name,
        line: { value: parsed[1], sources: [assertNotNullish(first, `stored line "${name}" has no sources`), ...rest], rule: w.rule },
    }
    return ok(named)
}

/**
 * Maps every entry of a stored result record through
 * {@link namedReportLineFromWire}, short-circuiting on the first `error` —
 * the same fail-fast, name-the-offender shape {@link readResultRecord} uses
 * one layer up.
 * @type {(wireRecord: WireResultRecord) => Result<readonly { readonly name: string, readonly line: ReportLine }[], string>}
 */
const namedLinesFromRecord = wireRecord => {
    /** @type {{ readonly name: string, readonly line: ReportLine }[]} */
    const named = []
    for (const [name, w] of Object.entries(wireRecord)) {
        const wire = assertNotNullish(w, `stored record has an undefined entry for "${name}"`)
        const result = namedReportLineFromWire(name)(wire)
        if (result[0] === 'error') {
            return error(result[1])
        }
        named.push(result[1])
    }
    return ok(named)
}

/**
 * Applies the whole-dollar election to one side's `ReportLine[]`,
 * independently of the other side (each side's own report may have summed a
 * different set of documents), and returns the projected lines re-keyed by
 * name for the diff step below.
 * @type {(elected: boolean) => (named: readonly { readonly name: string, readonly line: ReportLine }[]) => ReadonlyMap<string, ReportLine>}
 */
const projectedLinesByName = elected => named => {
    const lines = named.map(n => n.line)
    const projected = applyWholeDollarElection(elected)(lines)
    return new Map(named.map((n, i) => {
        const line = assertNotNullish(projected[i], `projected line index ${i} out of bounds`)
        return /** @type {readonly [string, ReportLine]} */ ([n.name, line])
    }))
}

/**
 * The diff itself: for the UNION of line names present on either side,
 * Column A/C are each side's projected cents (or `'0.00'`/`[]` when that
 * side never had the line at all), and Column B IS `centsToString(centsC -
 * centsA)` — never a value computed separately that merely happens to
 * agree, so `B = C - A` holds by construction. Returns a `Result`, refusing
 * by name (never throwing) if either side's stored record has a malformed
 * line — see {@link namedReportLineFromWire}.
 * @type {(elected: boolean) => (wireA: WireResultRecord) => (wireB: WireResultRecord) => Result<AmendmentDiffResult, string>}
 */
const diffWireRecords = elected => wireA => wireB => {
    const namedA = namedLinesFromRecord(wireA)
    if (namedA[0] === 'error') { return error(namedA[1]) }
    const namedB = namedLinesFromRecord(wireB)
    if (namedB[0] === 'error') { return error(namedB[1]) }
    const mapA = projectedLinesByName(elected)(namedA[1])
    const mapB = projectedLinesByName(elected)(namedB[1])
    const names = new Set([...Object.keys(wireA), ...Object.keys(wireB)])
    /** @type {{ [line: string]: { columnA: string, columnB: string, columnC: string, sourcesA: readonly Source[], sourcesC: readonly Source[] } }} */
    const result = {}
    for (const name of names) {
        const lineA = mapA.get(name)
        const lineB = mapB.get(name)
        const centsA = lineA?.value ?? 0n
        const centsC = lineB?.value ?? 0n
        result[name] = {
            columnA: centsToString(centsA),
            columnB: centsToString(centsC - centsA),
            columnC: centsToString(centsC),
            sourcesA: lineA?.sources ?? [],
            sourcesC: lineB?.sources ?? [],
        }
    }
    return ok(result)
}

// ── amendmentDiff ────────────────────────────────────────────────────────────

/**
 * This diff's own effect shape, named once so every helper below can
 * declare an explicit return type — without it, `tsc` infers the union
 * return type of a deeply-nested `step` callback from only its FIRST
 * returned branch (every early `pure(error(...))` guard), silently
 * collapsing the type and rejecting the later `pure(ok(...))` branch. Naming
 * the type and annotating each helper explicitly is the fix, not a
 * work-around: each helper's own JSDoc `@type` is the single place its
 * return type is asserted, and `tsc` checks the function body against it.
 * @typedef {Effect<FileCasOperation, AmendmentDiffResult, string>} DiffEffect
 */

/**
 * The second half of {@link amendmentDiff}: given both stored results (once
 * already known comparable and `ok`), reads each result blob and diffs them.
 * @type {(cas: Cas<FileCasOperation>) => (elected: boolean) => (runHashA: string) => (runHashB: string) => (resultHashA: string) => (resultHashB: string) => DiffEffect}
 */
const readResultsAndDiff = cas => elected => runHashA => runHashB => resultHashA => resultHashB => {
    const wireA = catchStep(
        readResultRecord(cas)(resultHashA),
        e => pureError(`run A's (${runHashA}) stored result is invalid: ${e}`))
    const wireB = catchStep(
        readResultRecord(cas)(resultHashB),
        e => pureError(`run B's (${runHashB}) stored result is invalid: ${e}`))
    const both = historyStep(history(wireA), () => wireB)
    return step(both, ([b, a]) => pure(diffWireRecords(elected)(a)(b)))
}

/**
 * The comparability guards and dispatch to {@link readResultsAndDiff}, given
 * both run records already read back out of CAS.
 *
 * Both records arrive as plain `Run`s: a read that failed short-circuited in
 * {@link amendmentDiff}'s `step`, so the two `if (result[0] === 'error')`
 * arms this function used to open with are now the error channel's job.
 * @type {(cas: Cas<FileCasOperation>) => (elected: boolean) => (runHashA: string) => (runHashB: string) => (runA: Run) => (runB: Run) => DiffEffect}
 */
const compareRunsAndDiff = cas => elected => runHashA => runHashB => runA => runB => {
    if (runA.programHash !== runB.programHash) {
        return pureError(
            `not comparable: run A (${runHashA}) has programHash "${runA.programHash}", ` +
            `run B (${runHashB}) has programHash "${runB.programHash}" — refusing to diff two different programs`)
    }
    if (JSON.stringify(runA.args) !== JSON.stringify(runB.args)) {
        return pureError(
            `not comparable: run A (${runHashA}) has args ${JSON.stringify(runA.args)}, ` +
            `run B (${runHashB}) has args ${JSON.stringify(runB.args)} — refusing to diff two different invocations`)
    }
    if (runA.status !== 'ok') {
        return pureError(`run A (${runHashA}) did not succeed, nothing to diff: ${runA.error}`)
    }
    if (runB.status !== 'ok') {
        return pureError(`run B (${runHashB}) did not succeed, nothing to diff: ${runB.error}`)
    }
    const resultHashA = assertNotNullish(runA.resultHash, 'an ok run record must have a resultHash')
    const resultHashB = assertNotNullish(runB.resultHash, 'an ok run record must have a resultHash')
    return readResultsAndDiff(cas)(elected)(runHashA)(runHashB)(resultHashA)(resultHashB)
}

/**
 * PROV-06: reads two `vnd.fjs.run` records by hash, refuses loudly if they
 * are not comparable, otherwise reads both stored results, applies the
 * whole-dollar election host-side to each side independently, and diffs
 * them into Form 1040-X's Columns A/B/C per 1040 line.
 * @type {(cas: Cas<FileCasOperation>) => (elected: boolean) => (runHashA: string) => (runHashB: string) => DiffEffect}
 */
export const amendmentDiff = cas => elected => runHashA => runHashB => {
    const runA = catchStep(
        readRunRecord(cas)(runHashA),
        e => pureError(`could not read run A (${runHashA}): ${e}`))
    const runB = catchStep(
        readRunRecord(cas)(runHashB),
        e => pureError(`could not read run B (${runHashB}): ${e}`))
    const both = historyStep(history(runA), () => runB)
    return step(both, ([b, a]) => compareRunsAndDiff(cas)(elected)(runHashA)(runHashB)(a)(b))
}

// ── Tests ────────────────────────────────────────────────────────────────────
//
// Everything below this marker is test-only. `cas.write` appears several
// times below (via `seedText`) to seed fixtures — this is the accepted
// exception this plan's own acceptance criteria name explicitly ("scope the
// grep, or note the exception"): every production code path above this
// marker never calls `cas.write`/`evoAdd`.

/**
 * TEST-FIXTURE ONLY. Writes `text`'s UTF-8 bytes to CAS as a single chunk —
 * the same `cas.write(pureOk({first: ok(bytes), tail: pureOk(undefined)}))`
 * pattern `fjs/server/fjs_run/module.f.js`'s own test helpers use.
 * @type {(cas: Cas<FileCasOperation>) => (text: string) => Effect<FileCasOperation, string, never>}
 */
const seedText = cas => text => {
    const bytes = tryUtf8(text)
    assert(bytes !== null, ['expected fixture text to encode as UTF-8', text])
    // The payload is annotated rather than inferred: `nonEmpty`/`empty` are
    // generic in `O`, and without a contextual type the write's op-set widens
    // to the whole `Operation` universe.
    /** @type {List<FileCasOperation, Vec, IoChannel>} */
    const payload = nonEmpty(bytes, empty())
    // A failed fixture write has no answer here, so the panic is written down
    // with `unwrapStep` rather than hand-asserted off a payload `Result`.
    const written = unwrapStep(cas.write(payload), errorSummary)
    return mapStep(written, vecToCBase32)
}

/** TEST-FIXTURE ONLY. @type {(programHash: string) => (args: readonly string[]) => (resultHash: string) => Run} */
const okRun = programHash => args => resultHash => ({
    dialect: runDialect,
    programHash,
    args,
    taxYear: 2025,
    paramSetHash: 'sha256-paramset1',
    pinned: false,
    status: 'ok',
    inputs: [],
    resultHash,
})

/** TEST-FIXTURE ONLY. @type {(programHash: string) => (args: readonly string[]) => (message: string) => Run} */
const errorRun = programHash => args => message => ({
    dialect: runDialect,
    programHash,
    args,
    taxYear: 2025,
    paramSetHash: 'sha256-paramset1',
    pinned: false,
    status: 'error',
    inputs: [],
    error: message,
})

/**
 * TEST-FIXTURE ONLY. Seeds two wire-shaped result blobs, two `ok` run
 * records pointing at them, then calls {@link amendmentDiff} and returns its
 * `Result`.
 * @type {(cas: Cas<FileCasOperation>) => (programHashA: string) => (argsA: readonly string[]) => (wireA: Readonly<Record<string, unknown>>) => (programHashB: string) => (argsB: readonly string[]) => (wireB: Readonly<Record<string, unknown>>) => (elected: boolean) => DiffEffect}
 */
const runOkDiffFixture = cas => programHashA => argsA => wireA => programHashB => argsB => wireB => elected =>
    step(seedText(cas)(JSON.stringify(wireA)), resultHashA =>
        step(seedText(cas)(JSON.stringify(wireB)), resultHashB =>
            step(seedText(cas)(JSON.stringify(okRun(programHashA)(argsA)(resultHashA))), runHashA =>
                step(seedText(cas)(JSON.stringify(okRun(programHashB)(argsB)(resultHashB))), runHashB =>
                    amendmentDiff(cas)(elected)(runHashA)(runHashB)))))

/**
 * TEST-FIXTURE ONLY. Seeds one `ok` run (with its wire result) and one
 * `error` run (no result blob at all — an error run never has one), then
 * calls `amendmentDiff`, returning its `Result`. `errorSide` selects which
 * of the two positions is the failing one.
 * @type {(cas: Cas<FileCasOperation>) => (errorSide: 'a' | 'b') => (programHash: string) => (args: readonly string[]) => (wire: Readonly<Record<string, unknown>>) => (message: string) => DiffEffect}
 */
const statusErrorDiffFixture = cas => errorSide => programHash => args => wire => message =>
    step(seedText(cas)(JSON.stringify(wire)), resultHash =>
        step(seedText(cas)(JSON.stringify(okRun(programHash)(args)(resultHash))), okHash =>
            step(seedText(cas)(JSON.stringify(errorRun(programHash)(args)(message))), errorHash =>
                errorSide === 'a'
                    ? amendmentDiff(cas)(false)(errorHash)(okHash)
                    : amendmentDiff(cas)(false)(okHash)(errorHash))))

/**
 * Asserts `columnB === centsToString(centsFromString(columnC) -
 * centsFromString(columnA))` for every line in a diff result, as a bigint
 * -cents identity — not merely trusted from the implementation (this
 * plan's own acceptance criterion).
 * @type {(diff: AmendmentDiffResult) => void}
 */
const assertColumnBEqualsColumnCMinusColumnA = diff => {
    for (const [name, cols] of Object.entries(diff)) {
        assertEq(
            centsFromString(cols.columnB),
            centsFromString(cols.columnC) - centsFromString(cols.columnA),
            `columnB must equal columnC - columnA (bigint cents) for line "${name}"`)
    }
}

export const proof = {
    // Task 1 behavior #1: two same-program, same-args `ok` runs diff to
    // A/B/C with B = C - A exact. `'1000.00'`/`'1500.00'` are decimal-dollar
    // wire strings — `fjs/report/line`'s own wire-projection convention (see
    // that module's `wireProjectionRoundTripsThroughJson` proof: `value:
    // centsToString(line.value)`) — corrected from the plan's own literal
    // `'100000'`/`'150000'`, which this module's own `centsFromString`
    // (a plain decimal-string parser, NO implied cents-integer scaling)
    // would read as $100,000.00/$150,000.00, not the $1,000/$1,500 the
    // plan's own expected `columnA`/`columnC` name. Verified directly
    // against `fjs/types/decimal/module.f.js`'s own `parse` before writing
    // this leaf; recorded in this plan's SUMMARY.
    sameProgramSameArgsDiffsToColumnsWithExactIdentity: () => {
        const home = '/amend/basic'
        const cas = fileCas(sha256)(home)
        const wireA = { interest: { value: '1000.00', sources: [{ documentHash: 'sha256-doc-before', boxPath: 'box1InterestIncome', value: '1000.00' }], rule: '1040 line 2b' } }
        const wireB = { interest: { value: '1500.00', sources: [{ documentHash: 'sha256-doc-after', boxPath: 'box1InterestIncome', value: '1500.00' }], rule: '1040 line 2b' } }
        const [, result] = virtual(emptyState)(runOkDiffFixture(cas)('sha256-program1')([])(wireA)('sha256-program1')([])(wireB)(false))
        assertEq(result[0], 'ok')
        if (result[0] !== 'ok') { throw ['expected ok', result] }
        const diff = result[1]
        const interest = assertNotNullish(diff['interest'], 'expected an interest line in the diff')
        assertEq(interest.columnA, '1000.00')
        assertEq(interest.columnB, '500.00')
        assertEq(interest.columnC, '1500.00')
        assertEq(interest.sourcesA.length, 1)
        assertEq(interest.sourcesC.length, 1)
        assertColumnBEqualsColumnCMinusColumnA(diff)
    },

    guards: {
        // Two runs of DIFFERENT programs -> refused, naming both hashes —
        // never a silent diff.
        programHashMismatchRefused: () => {
            const home = '/amend/program-mismatch'
            const cas = fileCas(sha256)(home)
            const wire = { interest: { value: '10.00', sources: [{ documentHash: 'sha256-doc', boxPath: 'box1InterestIncome', value: '10.00' }], rule: '1040 line 2b' } }
            const [, result] = virtual(emptyState)(runOkDiffFixture(cas)('sha256-programA')([])(wire)('sha256-programB')([])(wire)(false))
            assertEq(result[0], 'error')
            if (result[0] !== 'error') { throw ['expected error', result] }
            assert(result[1].includes('sha256-programA'), result[1])
            assert(result[1].includes('sha256-programB'), result[1])
        },
        // Positive control: an otherwise-identical pair with the SAME
        // programHash succeeds — the mismatch refusal above is a
        // comparison, not a blanket refusal.
        matchingProgramHashSucceeds: () => {
            const home = '/amend/program-match'
            const cas = fileCas(sha256)(home)
            const wire = { interest: { value: '10.00', sources: [{ documentHash: 'sha256-doc', boxPath: 'box1InterestIncome', value: '10.00' }], rule: '1040 line 2b' } }
            const [, result] = virtual(emptyState)(runOkDiffFixture(cas)('sha256-programA')([])(wire)('sha256-programA')([])(wire)(false))
            assertEq(result[0], 'ok')
        },
        // Same programHash, DIFFERENT args -> refused (the defensive second
        // check), naming both.
        argsMismatchRefused: () => {
            const home = '/amend/args-mismatch'
            const cas = fileCas(sha256)(home)
            const wire = { interest: { value: '10.00', sources: [{ documentHash: 'sha256-doc', boxPath: 'box1InterestIncome', value: '10.00' }], rule: '1040 line 2b' } }
            const [, result] = virtual(emptyState)(runOkDiffFixture(cas)('sha256-programA')(['2024'])(wire)('sha256-programA')(['2025'])(wire)(false))
            assertEq(result[0], 'error')
            if (result[0] !== 'error') { throw ['expected error', result] }
            assert(result[1].includes('2024'), result[1])
            assert(result[1].includes('2025'), result[1])
        },
        // Positive control: same programHash AND same args succeeds.
        matchingArgsSucceeds: () => {
            const home = '/amend/args-match'
            const cas = fileCas(sha256)(home)
            const wire = { interest: { value: '10.00', sources: [{ documentHash: 'sha256-doc', boxPath: 'box1InterestIncome', value: '10.00' }], rule: '1040 line 2b' } }
            const [, result] = virtual(emptyState)(runOkDiffFixture(cas)('sha256-programA')(['2024'])(wire)('sha256-programA')(['2024'])(wire)(false))
            assertEq(result[0], 'ok')
        },
        // Run A failed (no resultHash to diff) -> refused, naming side A and
        // its error message.
        errorSideARefusedNamingTheFailure: () => {
            const home = '/amend/error-a'
            const cas = fileCas(sha256)(home)
            const wire = { interest: { value: '10.00', sources: [{ documentHash: 'sha256-doc', boxPath: 'box1InterestIncome', value: '10.00' }], rule: '1040 line 2b' } }
            const [, result] = virtual(emptyState)(statusErrorDiffFixture(cas)('a')('sha256-programA')([])(wire)('refused: no such subject'))
            assertEq(result[0], 'error')
            if (result[0] !== 'error') { throw ['expected error', result] }
            assert(result[1].includes('refused: no such subject'), result[1])
        },
        // Run B failed -> refused, naming side B and its error message.
        errorSideBRefusedNamingTheFailure: () => {
            const home = '/amend/error-b'
            const cas = fileCas(sha256)(home)
            const wire = { interest: { value: '10.00', sources: [{ documentHash: 'sha256-doc', boxPath: 'box1InterestIncome', value: '10.00' }], rule: '1040 line 2b' } }
            const [, result] = virtual(emptyState)(statusErrorDiffFixture(cas)('b')('sha256-programA')([])(wire)('refused: no such subject'))
            assertEq(result[0], 'error')
            if (result[0] !== 'error') { throw ['expected error', result] }
            assert(result[1].includes('refused: no such subject'), result[1])
        },
    },

    // CR-01: a schema-valid but semantically malformed stored result (rtti's
    // `resultRecordSchema` has no non-empty-array combinator and accepts any
    // string for `value`) must be refused by name as a `Result`, never
    // escape as an uncaught throw. Neither case was exercised by any of this
    // module's other proof leaves before this fix.
    malformedStoredResult: {
        // Schema-valid: `array(wireSourceSchema)` permits length 0. Must be
        // refused BY NAME, never thrown — the exact repro this finding's own
        // review reproduced live against the pre-fix implementation.
        emptySourcesRefusedNamingTheLine: () => {
            const home = '/amend/malformed-empty-sources'
            const cas = fileCas(sha256)(home)
            const wireA = { interest: { value: '10.00', sources: [], rule: '1040 line 2b' } }
            const wireB = { interest: { value: '10.00', sources: [{ documentHash: 'sha256-doc', boxPath: 'box1InterestIncome', value: '10.00' }], rule: '1040 line 2b' } }
            const [, result] = virtual(emptyState)(runOkDiffFixture(cas)('sha256-programA')([])(wireA)('sha256-programA')([])(wireB)(false))
            assertEq(result[0], 'error')
            if (result[0] !== 'error') { throw ['expected error, not a thrown value', result] }
            assert(result[1].includes('interest'), result[1])
            assert(result[1].includes('no sources'), result[1])
        },
        // Schema-valid: `value: string` accepts any string, including a
        // non-decimal one. Must be refused BY NAME, never thrown.
        malformedValueRefusedNamingTheLine: () => {
            const home = '/amend/malformed-value'
            const cas = fileCas(sha256)(home)
            const wireA = { interest: { value: 'not-a-number', sources: [{ documentHash: 'sha256-doc', boxPath: 'box1InterestIncome', value: '10.00' }], rule: '1040 line 2b' } }
            const wireB = { interest: { value: '10.00', sources: [{ documentHash: 'sha256-doc', boxPath: 'box1InterestIncome', value: '10.00' }], rule: '1040 line 2b' } }
            const [, result] = virtual(emptyState)(runOkDiffFixture(cas)('sha256-programA')([])(wireA)('sha256-programA')([])(wireB)(false))
            assertEq(result[0], 'error')
            if (result[0] !== 'error') { throw ['expected error, not a thrown value', result] }
            assert(result[1].includes('interest'), result[1])
            assert(result[1].includes('not-a-number'), result[1])
        },
    },

    election: {
        // The IRS's own printed example (i1040gi p23): "$1.39 becomes $1" —
        // reused from fjs/report/line/module.f.js's own proof, not
        // re-derived. Both sides carry the identical raw-cents value, so
        // columnB stays '0.00' and this leaf isolates the PROJECTION
        // behavior from the diff arithmetic.
        electedProjectsHostSideBeforeDiffing: () => {
            const home = '/amend/elected-139'
            const cas = fileCas(sha256)(home)
            const wire = { interest: { value: '1.39', sources: [{ documentHash: 'sha256-doc', boxPath: 'box1InterestIncome', value: '1.39' }], rule: '1040 line 2b' } }
            const [, result] = virtual(emptyState)(runOkDiffFixture(cas)('sha256-programA')([])(wire)('sha256-programA')([])(wire)(true))
            assertEq(result[0], 'ok')
            if (result[0] !== 'ok') { throw ['expected ok', result] }
            const interest = assertNotNullish(result[1]['interest'], 'expected an interest line')
            assertEq(interest.columnA, '1.00')
            assertEq(interest.columnC, '1.00')
            assertEq(interest.columnB, '0.00')
        },
        // The IRS's own printed tie (i1040gi p23): "$2.50 becomes $3" — half
        // rounds away from zero, reused from the same proof, not re-derived.
        electedRoundsTheIrsTwoFiftyTieUpToThreeDollars: () => {
            const home = '/amend/elected-250'
            const cas = fileCas(sha256)(home)
            const wire = { interest: { value: '2.50', sources: [{ documentHash: 'sha256-doc', boxPath: 'box1InterestIncome', value: '2.50' }], rule: '1040 line 2b' } }
            const [, result] = virtual(emptyState)(runOkDiffFixture(cas)('sha256-programA')([])(wire)('sha256-programA')([])(wire)(true))
            assertEq(result[0], 'ok')
            if (result[0] !== 'ok') { throw ['expected ok', result] }
            const interest = assertNotNullish(result[1]['interest'], 'expected an interest line')
            assertEq(interest.columnA, '3.00')
            assertEq(interest.columnC, '3.00')
        },
        // Declining the election: the SAME $1.39 line reads back unprojected
        // on both columns.
        notElectedLeavesTheLineUnprojected: () => {
            const home = '/amend/not-elected'
            const cas = fileCas(sha256)(home)
            const wire = { interest: { value: '1.39', sources: [{ documentHash: 'sha256-doc', boxPath: 'box1InterestIncome', value: '1.39' }], rule: '1040 line 2b' } }
            const [, result] = virtual(emptyState)(runOkDiffFixture(cas)('sha256-programA')([])(wire)('sha256-programA')([])(wire)(false))
            assertEq(result[0], 'ok')
            if (result[0] !== 'ok') { throw ['expected ok', result] }
            const interest = assertNotNullish(result[1]['interest'], 'expected an interest line')
            assertEq(interest.columnA, '1.39')
            assertEq(interest.columnC, '1.39')
        },
    },

    // A line present only on the "after" side (a genuinely new line the
    // correction introduced) -> columnA '0.00'/sourcesA [], columnC/sourcesC
    // populated normally.
    newLineIntroducedByTheCorrectionAppearsWithZeroColumnA: () => {
        const home = '/amend/new-line'
        const cas = fileCas(sha256)(home)
        const wireA = {}
        const wireB = { newDeduction: { value: '250.00', sources: [{ documentHash: 'sha256-doc-new', boxPath: 'box5StateAndLocalTaxes', value: '250.00' }], rule: 'schedule a line 5a' } }
        const [, result] = virtual(emptyState)(runOkDiffFixture(cas)('sha256-programA')([])(wireA)('sha256-programA')([])(wireB)(false))
        assertEq(result[0], 'ok')
        if (result[0] !== 'ok') { throw ['expected ok', result] }
        const diff = result[1]
        const newDeduction = assertNotNullish(diff['newDeduction'], 'expected the new line to appear in the diff')
        assertEq(newDeduction.columnA, '0.00')
        assertEq(newDeduction.sourcesA.length, 0)
        assertEq(newDeduction.columnC, '250.00')
        assertEq(newDeduction.sourcesC.length, 1)
        assertColumnBEqualsColumnCMinusColumnA(diff)
    },
}
