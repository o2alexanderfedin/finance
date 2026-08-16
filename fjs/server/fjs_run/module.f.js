/**
 * `fjs_run` — EXEC-08, EXEC-10, EXEC-11, PROV-03: the MCP tool that runs a
 * stored report program against pinned inputs and returns the hashes of
 * everything the run produced.
 *
 * ## Two exports, two concerns
 *
 * {@link executeRun} is pure orchestration: hash -> CAS blob -> materialize
 * -> load -> snapshot -> interpret. It never touches CAS for a WRITE and
 * never touches MCP. {@link fjsRunTool} is the handler: it calls
 * `executeRun`, then performs the two writes `executeRun` itself never
 * does — the result blob and the `vnd.fjs.run` record — applies the size
 * guard, and shapes the MCP response. This split is what makes Success
 * Criterion 3 (the tool handler, never the guest, performs both CAS writes)
 * checkable in two independent ways: `casWrite`/`evoAdd` are structurally
 * absent from the guest's ABI (`fjs/guest/module.f.js`, re-verified by grep
 * below), AND `executeRun` itself — the thing that actually RUNS the guest —
 * never calls `cas.write` anywhere in its own body.
 *
 * ## `executeRun`'s five steps, and the known Phase 3 limitation it inherits
 *
 * 1. Resolve `input.hash` to a `Vec` (`cBase32ToVec`) and read the program's
 *    source out of CAS (`collectRead(cas.read(...))`, UTF-8 decoded). Either
 *    an unparsable hash or a CAS miss short-circuits immediately, before
 *    materialization or interpretation ever run.
 * 2. `materializeProgram` (Plan 05) writes those exact bytes to the
 *    dedicated `.fjs-run` subdirectory. A write failure short-circuits too.
 * 3. `loadProgram` (Phase 6, unchanged) runs `checkSpecifiers` then
 *    `import_`s the module. Called here as `loadProgram([])(programPath
 *    (materializeHome(materializeHomeRoot))(input.hash))(sourceText)` — the
 *    FULL path `materializeProgram` (step 2) just wrote to, composed from
 *    the SAME `materializeHome`/`programPath` expressions so the write path
 *    and the import path cannot drift apart again (07-10: an earlier
 *    revision passed the bare hash-derived filename here instead, which
 *    real Node's `import_` effect resolves against `process.cwd()`, not
 *    `materializeHomeRoot` — see
 *    `node_modules/functionalscript/fjs/effects/node/module.js`'s
 *    `asyncImport`. Every proof below existed at the time and none caught
 *    it, because each one placed its `JsModule` fixture at that SAME bare
 *    name — see `fjs/todo/upstream-node-spawn-effect.md`-adjacent 07-10 fix
 *    notes for the full story). `fjs/guest/materialize/module.f.js`'s own
 *    header documents that `fjs/effects/node/virtual` cannot execute
 *    freshly-written bytes as a module, so a write-then-import combination
 *    can never produce an `'ok'` outcome in one virtual session for the
 *    SAME path — real Node's `import()` reads whatever `writeFile` actually
 *    wrote, so production performs both steps for real, at the full path.
 *    Composing the two established techniques "side by side" (that
 *    module's own phrase) is exactly what every proof below does: the
 *    write is exercised for real (a fresh, unwritten leaf), and the load
 *    exercises a `JsModule` fixture nested at that SAME full path, standing
 *    in for "materialization already succeeded" — the same stand-in
 *    `fjs/guest/materialize/module.f.js`'s own
 *    `underVirtual.cleanProgramImportsAndRuns` proof uses (at ITS OWN
 *    parameterized `path`, not this module's specific one). Wiring
 *    `fjs_run` into a real running server needs no special working
 *    directory — the launcher's own `process.cwd()` is irrelevant once the
 *    import path is always absolute.
 * 4. `buildRunSnapshot`/`buildHostMap` (Plan 05) resolve the pinned or live
 *    snapshot into the synchronous host map `interpret` requires.
 * 5. `interpret` (Phase 3, unchanged) runs the loaded `report`. Its returned
 *    `Read[]` is the ONLY source `inputs[]` is ever populated from — never a
 *    program's own citation list (07-CONTEXT.md, Success Criterion 2).
 *
 * A refusal reached partway through a chain discards the accumulated read
 * set — this is `fjs/exec`'s OWN already-documented behavior (see that
 * module's `refusalPartwayThroughAChainReportsTheRefusedCommand` comment),
 * not something this plan changes or re-solves. A failed run's persisted
 * `inputs[]` is therefore legitimately empty for a mid-execution refusal.
 *
 * ## `fjsRunTool`'s handle: the writes, the record, never a raw throw
 *
 * On `{kind:'ok', value, reads}`: `String(value)` is written to CAS
 * UNCONDITIONALLY — the result is always citable by hash, never only
 * conditionally on size (07-CONTEXT.md). A `vnd.fjs.run` record is built
 * from `reads` alone, validated (defensively — a validation failure here is
 * this module's own bug, never a guest's, so it is asserted, not branched
 * on) and written to CAS too. `sizeGuard` (Plan 04) is applied to the
 * result text, never to the raw value. On `{kind:'error', message, reads}`:
 * a record with `status:'error'` is STILL written (provenance that only
 * covers successes is not provenance) and the response is an `errorResult`
 * naming both the failure and where its record lives. Nowhere in this
 * mapping is a caught value branched on via `instanceof Error` — fjs's
 * `assert`/`unwrap` throw bare values (03-CONTEXT.md), and `interpret`
 * already converts `match`'s bare-string refusal into an `error(...)`
 * before it ever reaches this module.
 *
 * ## Concrete `FileCasOperation`, not a generic `<O extends Operation>`
 *
 * `buildRunSnapshot`/`buildHostMap` (Plan 05) and `casRefreshTool`
 * (`fjs/server/module.f.js`) are generic over `O` because their FIRST
 * curried parameter already mentions `O` (`cas: Cas<O>`), so TypeScript can
 * resolve it the moment that parameter is applied. `executeRun`/
 * `fjsRunTool`'s OWN first parameter is `materializeHomeRoot: string`,
 * which mentions nothing about `O` — verified empirically that this makes
 * `tsc` commit to `O`'s bare constraint at that first application, before
 * `cas`/`evoApi` are ever seen, so every later application then fails to
 * unify against a concrete `Cas<FileCasOperation>` argument. Since this
 * codebase has exactly one `Cas` implementation (`fileCas`,
 * `financeMcpHandlers`'s own signature is concrete for the same reason),
 * fixing both exports to `FileCasOperation` costs nothing in practice and
 * keeps the curry order the plan specifies.
 *
 * ## PROV-07's anti-hardcoding design, in plain words
 *
 * The zero-read kill condition ({@link classifyRunOutcome}, imported from
 * `fjs/report/guard/module.f.js`) is the mechanism that defeats
 * `() => pure({ line16: 9137 })` — a program that recites an answer instead
 * of computing one from a stored document. This file no longer defines that
 * rule; it CONSUMES it, at the two call sites below ({@link executeRun} and
 * {@link runExecuteRunViaFixture}). The full plain-words account of all
 * three PROV-07 mechanisms (the kill condition, the two reported counts, and
 * the perturbation gate with its control leg), plus the history of the
 * duplicate-copy defect this file used to carry, now lives in
 * `fjs/report/guard/module.f.js`'s own module header — read it there.
 *
 * @module
 */
import { step, pure, mapStep, do_ } from 'functionalscript/fjs/effects/module.f.js'
import { collectRead, fileCas } from 'functionalscript/fjs/cas/module.f.js'
import { cBase32ToVec, vecToCBase32 } from 'functionalscript/fjs/basen/cbase32/module.f.js'
import { utf8ToString, tryUtf8 } from 'functionalscript/fjs/text/module.f.js'
import { ok } from 'functionalscript/fjs/types/result/module.f.js'
import { option, array, number, string } from 'functionalscript/fjs/types/rtti/module.f.js'
import { toolEntry, okResult, errorResult } from 'functionalscript/fjs/protocol/mcp/module.f.js'
import { sha256 } from 'functionalscript/fjs/crypto/sha2/module.f.js'
import { initEvo, evo } from 'functionalscript/fjs/cas/evo/module.f.js'
import { emptyState, virtual } from 'functionalscript/fjs/effects/node/virtual/module.f.js'
import { assert, assertEq, assertNotNullish } from 'functionalscript/fjs/asserts/module.f.js'
import { validate as rttiValidate } from 'functionalscript/fjs/types/rtti/validate/module.f.js'
import { unknown as jsonUnknown, stringify as jsonStringify } from 'functionalscript/fjs/media/json/module.f.js'
import { identity } from 'functionalscript/fjs/types/function/module.f.js'
import { interpret } from '../../exec/module.f.js'
import { countNumericLiterals } from '../../report/audit/module.f.js'
import { classifyRunOutcome } from '../../report/guard/module.f.js'
import { guestCtx } from '../../guest/module.f.js'
import { taxGuestCtx } from '../../guest/tax/module.f.js'
import { materializeProgram, loadProgram, materializeHome, programPath } from '../../guest/materialize/module.f.js'
import { buildRunSnapshot, buildHostMap } from './snapshot/module.f.js'
import { dialect, validate as validateRun } from '../../run/module.f.js'
import { taxParamsByYear } from '../../tax/params/module.f.js'
import { dialect as returnProfileDialect } from '../../return/profile/module.f.js'
import { paramSetHash, reviewedEstimateFraming } from '../../report/provenance/module.f.js'
import { sizeGuard, previewBytes, guardBytes } from '../response/module.f.js'
import { readUtf8File } from 'functionalscript/fjs/effects/node/module.f.js'
import { vec8, length as bitLength } from 'functionalscript/fjs/types/bit_vec/module.f.js'
import { parse } from 'functionalscript/fjs/path/module.f.js'
import { stringify as jsonText } from '../../json/module.f.js'

/** @import { Effect, Operation } from 'functionalscript/fjs/effects/module.f.js' */
/** @import { MemOp } from 'functionalscript/fjs/effects/memory/module.f.js' */
/** @import { Mkdir, WriteFile, Import } from 'functionalscript/fjs/effects/node/module.f.js' */
/** @import { Cas, FileCasOperation } from 'functionalscript/fjs/cas/module.f.js' */
/** @import { Evo } from 'functionalscript/fjs/cas/evo/module.f.js' */
/** @import { ToolEntry, ToolsCallResult } from 'functionalscript/fjs/protocol/mcp/module.f.js' */
/** @import { Vec } from 'functionalscript/fjs/types/bit_vec/module.f.js' */
/** @import { CasOp, Report } from '../../guest/module.f.js' */
/** @import { TaxReport } from '../../guest/tax/module.f.js' */
/** @import { TaxParamSet } from '../../tax/params/module.f.js' */
/** @import { ReturnProfile } from '../../return/profile/module.f.js' */
/** @import { State, Dir, JsModule } from 'functionalscript/fjs/effects/node/virtual/module.f.js' */
/** @import { Run } from '../../run/module.f.js' */
/** @import { RunOutcome } from '../../report/guard/module.f.js' */
/** @import { ReportLine } from '../../report/line/module.f.js' */
/** @import { Unknown as JsonUnknown } from 'functionalscript/fjs/media/json/module.f.js' */
/** @import { Ts, Unknown as RttiUnknown } from 'functionalscript/fjs/types/rtti/ts/module.f.js' */

// ── executeRun ────────────────────────────────────────────────────────────────
//
// 09-06: `RunOutcome` and `classifyRunOutcome` — PROV-07's zero-read kill
// condition — no longer live in this file. They are imported from
// `fjs/report/guard/module.f.js`, above; see that module's header for the
// full account. This file consumes the rule at the two call sites below
// ({@link executeRun} and {@link runExecuteRunViaFixture}), it does not
// define it.

/**
 * Runs a stored program (by CAS hash) against `input.args`, optionally
 * pinned to a concrete `subject`/`parents` snapshot. See the module header
 * for the five-step sequence this composes, unchanged, from Plan 05
 * (`materializeProgram`/`buildRunSnapshot`/`buildHostMap`), Phase 6
 * (`programPath`/`loadProgram`), and Phase 3 (`interpret`).
 *
 * ## `input.taxParams` (Phase 21, EXEC-14)
 *
 * The ALREADY-RESOLVED parameter set the guest computes against. It is a
 * required field and it is **passed in, never looked up here** — this
 * function must not touch `taxParamsByYear`. `fjsRunTool` has already
 * resolved `args.taxYear` (refusing an unknown year before anything runs)
 * and has already hashed that exact object into the run record's
 * `paramSetHash`; a second lookup here could disagree with it, and a run
 * record that names parameters the guest did not use is precisely the lie
 * PROV-04 exists to prevent.
 *
 * The whole (wider) context goes to EVERY program, tax or not: a program
 * that does not read `ctx.form1040Report`/`ctx.taxParams` is unaffected by
 * their presence, which is why `fjs/report/payer`'s own stored program
 * still runs here unchanged.
 *
 * **The "never re-resolve" half of that rule is currently UNPROVEN, and
 * measured to be so.** Replacing `input.taxParams` below with a fresh
 * `taxParamsByYear[2025]` lookup was run as a mutation gate on 2026-08-16
 * and **survived the entire suite** (6419/6419, exit 0). It cannot fail
 * today for a reason that has nothing to do with test quality:
 * `taxParamsByYear` holds exactly ONE year, so threading the caller's
 * object and re-resolving it are observationally identical at every input
 * that exists. The first phase to add a second tax year should re-run that
 * gate — it will bite then — and until it does, this paragraph is the only
 * thing standing between the rule and a silent regression. What IS proven:
 * the parameter set actually reaches the guest (substituting a different
 * standard deduction here reddens `tax-return-integration.test.js`), and
 * `tsc` refuses a bare `guestCtx` in its place (TS2739, `taxParams` and
 * `form1040Report` missing).
 * @type {(materializeHomeRoot: string) => (cas: Cas<FileCasOperation>) => (evoApi: Evo<FileCasOperation>) => (input: { readonly hash: string, readonly args: readonly string[], readonly taxParams: TaxParamSet, readonly subject?: string, readonly parents?: readonly string[] }) => Effect<FileCasOperation | Mkdir | WriteFile | Import | MemOp, RunOutcome<unknown>>}
 */
export const executeRun = materializeHomeRoot => cas => evoApi => input => {
    const hashVec = cBase32ToVec(input.hash)
    if (hashVec === null) {
        return pure(/** @type {RunOutcome<unknown>} */ ({ kind: 'error', message: `program not found: ${input.hash}`, reads: [] }))
    }
    return step(collectRead(cas.read(hashVec)), readResult => {
        if (readResult[0] === 'error') {
            return pure(/** @type {RunOutcome<unknown>} */ ({ kind: 'error', message: `program not found: ${input.hash}`, reads: [] }))
        }
        const sourceText = utf8ToString(readResult[1])
        // PROV-07 (the reported half): computed HERE, at the exact point
        // checkSpecifiers will read this SAME string from moments later
        // (inside loadProgram) — never a second reading of the source.
        const literalCount = countNumericLiterals(sourceText)
        return step(materializeProgram(materializeHomeRoot)(input.hash)(sourceText), materializeResult => {
            if (materializeResult[0] === 'error') {
                return pure(/** @type {RunOutcome<unknown>} */ ({ kind: 'error', message: materializeResult[1], reads: [] }))
            }
            return step(loadProgram([])(programPath(materializeHome(materializeHomeRoot))(input.hash))(sourceText), loadResult => {
                if (loadResult[0] === 'error') {
                    return pure(/** @type {RunOutcome<unknown>} */ ({ kind: 'error', message: loadResult[1], reads: [] }))
                }
                const pin = input.subject !== undefined && input.parents !== undefined
                    ? { subject: input.subject, parents: input.parents }
                    : undefined
                return step(buildRunSnapshot(cas)(evoApi)(pin), snapshot => {
                    const hostMap = buildHostMap(snapshot)
                    const loaded = /** @type {{ readonly report: TaxReport<unknown> }} */ (loadResult[1])
                    const [t, v] = interpret(hostMap)(loaded.report(taxGuestCtx(input.taxParams))(input.args))
                    if (t === 'error') {
                        return pure(/** @type {RunOutcome<unknown>} */ ({ kind: 'error', message: v, reads: [] }))
                    }
                    const [value, reads] = v
                    // 09-06: classifyRunOutcome (imported from
                    // fjs/report/guard/module.f.js) is the zero-read kill
                    // condition's ONLY definition — this is the production
                    // call site.
                    return pure(classifyRunOutcome(literalCount)(value, reads))
                })
            })
        })
    })
}

// ── fjsRunTool: handler-performed writes, the run record, the response ──────

/**
 * Writes `text`'s UTF-8 bytes to CAS as a single chunk — the same
 * `cas.write(pure({first: ok(bytes), tail: pure(undefined)}))` pattern
 * `fjs/server/module.f.js`'s `casRefresh` proof and
 * `fjs/server/fjs_run/snapshot/module.f.js`'s own store-seeding proofs use —
 * and returns the resulting content hash. A write failure here is asserted,
 * not branched on: writing a moderately-sized in-memory string is not a
 * normal-operation failure mode this plan's error taxonomy covers (that
 * taxonomy is about GUEST failures — missing hash, dirty specifier, a
 * non-`Error` throw — not CAS infrastructure failures).
 * @type {<O extends Operation>(cas: Cas<O>) => (text: string) => Effect<O, string>}
 */
const writeTextToCas = cas => text => {
    const bytes = tryUtf8(text)
    assert(bytes !== null, ['expected text destined for CAS to encode as UTF-8', text])
    return mapStep(
        cas.write(pure({ first: ok(bytes), tail: pure(undefined) })),
        writeResult => {
            assert(writeResult[0] === 'ok', ['expected a CAS write to succeed', writeResult])
            return vecToCBase32(writeResult[1])
        },
    )
}

/** rtti validator for "is this a JSON value", from `fjs/media/json`'s own schema. */
const validateJsonValue = rttiValidate(jsonUnknown)

/** `JSON.stringify`'s rules, in FunctionalScript — property order left as-is. */
const stringifyJsonValue = jsonStringify(identity)

/**
 * One outcome with its result already reduced to the text that gets hashed,
 * stored, and previewed — `value` swapped for `text`, everything else carried
 * through unchanged.
 *
 * **Derived from `RunOutcome` rather than restated.** An earlier spelling wrote
 * the field list out by hand, and when phase 9 added `literalCount` to
 * `RunOutcome`'s `'ok'` arm the two drifted: the rebuilt object silently
 * dropped the field, and the anti-hardcoding audit would have written
 * `literalCount: undefined` into every run record. Deriving with `Omit`/
 * `Extract` means a field added to `RunOutcome` cannot go missing here without
 * `tsc` saying so — which is how that drift was caught.
 * @template T
 * @typedef {(Omit<Extract<RunOutcome<T>, { kind: 'ok' }>, 'value'> & { readonly text: string }) | Extract<RunOutcome<T>, { kind: 'error' }>} TextOutcome
 */

/**
 * Reduces a run's result to the exact bytes CAS should hold.
 *
 * The guest ABI is `Report<T>` with `T` unconstrained (`fjs/guest`), so a
 * report may legitimately return a structured value — and one asked to compute
 * a total will. `String(value)` turns every such value into `'[object
 * Object]'`, which then gets hashed, stored, and named by the run record's
 * `resultHash`: the answer is destroyed and the provenance record attests to
 * the destruction, with nothing reporting an error. That is the one outcome
 * this repository's whole traceability claim cannot survive.
 *
 * Three cases, in the order they are checked:
 *
 * - **A string is passed through byte-for-byte.** Not `stringify`d — quoting a
 *   string that was already the answer would change every existing program's
 *   result hash for no gain. This keeps the common case identical to before.
 * - **Any other JSON value is serialized by `fjs/media/json`'s `stringify`**,
 *   which is FunctionalScript rather than the host (AGENTS.md's "use
 *   FunctionalScript itself as much as possible") and is reversible: the stored
 *   bytes parse back to the value the program computed.
 * - **Anything else becomes an error outcome**, carrying its observed reads, so
 *   it still gets a `status: 'error'` run record. `fjs/media/json`'s own
 *   `unknown` schema decides which values are representable, so this module
 *   does not maintain a second opinion about what JSON is. A report returning a
 *   `bigint`, a function, or `undefined` is a broken report; saying so is the
 *   only answer that does not silently corrupt the result.
 * @type {(o: RunOutcome<unknown>) => TextOutcome<unknown>}
 */
const withResultText = o => {
    if (o.kind === 'error') { return o }
    // Everything except `value` is carried through by spreading the outcome
    // rather than by naming its fields — `literalCount` reaches the run record
    // that way, and so does whatever a later phase adds.
    const { value: _value, ...rest } = o
    if (typeof o.value === 'string') { return { ...rest, text: o.value } }
    // The guest's result is `unknown` — it crossed the ABI from a stored blob,
    // so nothing has constrained it. The widening cast only hands it to the
    // validator; the narrowing one below is what the validator just earned,
    // `rtti`'s `Unknown` differing from `json`'s only by admitting `undefined`,
    // which `jsonUnknown` is precisely what rejects.
    const [t, v] = validateJsonValue(/** @type {RttiUnknown} */ (o.value))
    return t === 'error'
        ? {
            kind: 'error',
            message: `the report returned a value that is not representable as JSON: ${jsonText(v)}`,
            reads: o.reads,
        }
        : {
            ...rest,
            text: stringifyJsonValue(/** @type {JsonUnknown} */ (v)),
        }
}

/**
 * `fjsRunTool`'s OWN post-outcome logic (the writes, the record, never a raw
 * throw — see the module header), factored out of {@link fjsRunTool}'s
 * `handle` so it is independently callable against a GIVEN `RunOutcome`.
 *
 * 07-10: this split exists for testability, not for production's own sake —
 * `fjsRunTool.handle`'s behavior is UNCHANGED, it now just delegates here
 * after calling `executeRun`. It matters because, once `executeRun`'s own
 * import path is fixed to match its own materialize-write path (this
 * plan's fix), `fjs/effects/node/virtual` can no longer produce a
 * `kind:'ok'` `RunOutcome` from ONE call to `executeRun`/`fjsRunTool.handle`
 * — `writeFile`'s array-of-`Vec` representation and `import_`'s `JsModule`
 * (function) requirement are incompatible at the SAME path within the SAME
 * virtual session (see the module header), so `executeRun`'s own
 * materialize step now either collides with a pre-placed fixture (`'invalid
 * file'`) or succeeds and leaves an array `import_` then refuses (`'not a
 * JsModule'`) — either way, an error, confirmed empirically for every
 * ordering. A proof that needs an 'ok' outcome to reach THIS logic must
 * therefore produce that outcome by decomposing `executeRun`'s OWN steps
 * across two virtual sessions (see `runExecuteRunViaFixture` below, the
 * "side by side" technique `fjs/guest/materialize/module.f.js`'s own header
 * already establishes) and hand the result to `handleRunOutcome` directly,
 * rather than by calling `fjsRunTool.handle` end to end for the success
 * case. Real Node has no such limitation — `fjsRunTool` itself is
 * unchanged, and `fjs-run-integration.test.js` proves the real, single-call
 * round trip end to end against a genuinely separate process.
 * @type {(cas: Cas<FileCasOperation>) => (programHash: string) => (programArgs: readonly string[]) => (pinned: boolean) => (pinFields: { readonly subject?: string, readonly parents?: readonly string[] }) => (provenance: { readonly taxYear: number, readonly paramSetHash: string }) => (outcome: RunOutcome<unknown>) => Effect<FileCasOperation | MemOp, ToolsCallResult>}
 */
const handleRunOutcome = cas => programHash => programArgs => pinned => pinFields => provenance => rawOutcome => {
    const outcome = withResultText(rawOutcome)
    const inputs = outcome.reads.map(([command, payload]) => ({
        command,
        payload: payload.map(String),
    }))
    if (outcome.kind === 'ok') {
        const { text } = outcome
        return step(writeTextToCas(cas)(text), resultHash => {
            /** @type {Run} */
            const record = {
                dialect,
                programHash,
                args: programArgs,
                taxYear: provenance.taxYear,
                paramSetHash: provenance.paramSetHash,
                pinned,
                ...pinFields,
                status: 'ok',
                inputs,
                resultHash,
            }
            const [vt, vv] = validateRun(record)
            assert(vt === 'ok', ['fjs_run assembled an invalid ok run record - executor bug', vv])
            return step(writeTextToCas(cas)(jsonText(vv)), runHash => {
                const { preview, truncated } = sizeGuard(guardBytes)(previewBytes)(text, resultHash)
                // PROV-07: readCount derives from `inputs` — the SAME array
                // just persisted into the run record above, never a second
                // counter (09-CONTEXT.md). literalCount is outcome's own
                // count, computed once in executeRun/runExecuteRunViaFixture
                // at the point the source text was already in hand.
                return pure(okResult(jsonText({
                    resultHash,
                    runHash,
                    preview,
                    truncated,
                    readCount: inputs.length,
                    literalCount: outcome.literalCount,
                    taxYear: provenance.taxYear,
                    paramSetHash: provenance.paramSetHash,
                    programHash,
                    reviewedEstimateFraming,
                })))
            })
        })
    }
    /** @type {Run} */
    const record = {
        dialect,
        programHash,
        args: programArgs,
        taxYear: provenance.taxYear,
        paramSetHash: provenance.paramSetHash,
        pinned,
        ...pinFields,
        status: 'error',
        inputs,
        error: outcome.message,
    }
    const [vt, vv] = validateRun(record)
    assert(vt === 'ok', ['fjs_run assembled an invalid error run record - executor bug', vv])
    return step(writeTextToCas(cas)(jsonText(vv)), runHash =>
        pure(errorResult(`fjs_run failed: ${outcome.message} (run record: ${runHash})`)))
}

/**
 * `fjs_run`'s input contract: a program hash, optional `args`, a REQUIRED
 * `taxYear` (PROV-04 — explicit caller argument, never inferred, mirroring
 * the `elected` precedent Phase 15 set for the same reason), and an
 * optional `subject`/`parents` pin (07-CONTEXT.md — both present pins the
 * run; either absent is an ordinary unpinned run, recorded as
 * `pinned: false`). `toolEntry`'s own RTTI check rejects a call missing
 * `taxYear` or supplying a non-number before the handler ever runs.
 */
export const fjsRunInputSchema = /** @type {const} */ ({
    hash: string,
    args: option(array(string)),
    taxYear: number,
    subject: option(string),
    parents: option(array(string)),
})

/**
 * The `fjs_run` MCP tool: runs a stored report program against pinned
 * inputs, writes the result and the `vnd.fjs.run` record to CAS (the
 * handler, never the guest — see the module header), and, on success,
 * returns `{ resultHash, runHash, preview, truncated, readCount,
 * literalCount, taxYear, paramSetHash, programHash,
 * reviewedEstimateFraming }` — the same ten keys regardless of outcome
 * size. `readCount` and `literalCount` (PROV-07, 09-CONTEXT.md) surface
 * beside the two hashes: `readCount` is `inputs.length` (the SAME
 * observed-read array the run record persists), `literalCount` is the
 * numeric-literal count of the program's own source text
 * (`fjs/report/audit`'s `countNumericLiterals`). `taxYear`/`paramSetHash`/
 * `programHash`/`reviewedEstimateFraming` (PROV-04) are the provenance
 * header: which tax year's parameters were in effect, a content hash of
 * that exact parameter set, the CAS hash of the program that ran, and the
 * "reviewed estimate" framing constant, carried verbatim.
 * @type {(materializeHomeRoot: string) => (cas: Cas<FileCasOperation>) => (evoApi: Evo<FileCasOperation>) => ToolEntry<FileCasOperation | Mkdir | WriteFile | Import | MemOp>}
 */
export const fjsRunTool = materializeHomeRoot => cas => evoApi => toolEntry(
    'fjs_run',
    'Runs a stored report program (by CAS hash) against pinned inputs and returns ' +
    'the result and run-record hashes. Requires taxYear (the tax year whose parameter ' +
    'set was in effect for this run). Supply subject and parents together to pin ' +
    'the snapshot the program\'s evoHead reads; omit both for an ordinary unpinned run.',
    fjsRunInputSchema,
    /** @type {(args: Ts<typeof fjsRunInputSchema>) => Effect<FileCasOperation | Mkdir | WriteFile | Import | MemOp, ToolsCallResult>} */
    (args => {
        // PROV-04: taxYear is an explicit caller argument, never inferred
        // (mirroring the `elected` precedent Phase 15 set for the same
        // reason). An unknown year is refused BEFORE executeRun ever runs —
        // the identical shape `finance_tax_params`'s own unknown-year
        // refusal uses, never a throw, never a cast past the `| undefined`
        // noUncheckedIndexedAccess produces.
        const taxParamSet = taxParamsByYear[args.taxYear]
        if (taxParamSet === undefined) {
            return pure(errorResult(
                `unknown tax year: ${args.taxYear}; known: ${Object.keys(taxParamsByYear).map(Number).join(', ')}`,
            ))
        }
        const resolvedParamSetHash = paramSetHash(taxParamSet)
        const programArgs = args.args ?? []
        const pinned = args.subject !== undefined && args.parents !== undefined
        // Both or neither. A half-supplied pin is an ordinary unpinned run
        // (07-CONTEXT.md), and an unpinned run has no subject to record — so
        // the lone field is dropped rather than carried into the record, where
        // it would name a subject the run was never pinned to. `checkReferences`
        // rejects that combination, so carrying it would also make the executor
        // assemble a record its own validator refuses.
        const pinFields = /** @type {{ readonly subject?: string, readonly parents?: readonly string[] }} */ (
            pinned ? { subject: args.subject, parents: args.parents } : {})
        return step(
            executeRun(materializeHomeRoot)(cas)(evoApi)({
                hash: args.hash,
                args: programArgs,
                // EXEC-14: the SAME `taxParamSet` object the unknown-year
                // refusal above already accepted and `resolvedParamSetHash`
                // was computed over — threaded through, never re-resolved.
                // Re-looking it up would let the run record's paramSetHash
                // and the guest's actual parameters disagree.
                taxParams: taxParamSet,
                ...pinFields,
            }),
            outcome => handleRunOutcome(cas)(args.hash)(programArgs)(pinned)(pinFields)({ taxYear: args.taxYear, paramSetHash: resolvedParamSetHash })(outcome),
        )
    }),
)

// ── Tests ────────────────────────────────────────────────────────────────────

/**
 * TY2025's parameter set, narrowed exactly once — the value every proof
 * below hands to `executeRun`/{@link runExecuteRunViaFixture} in place of
 * the one `fjsRunTool` resolves from its caller's `taxYear`.
 * `noUncheckedIndexedAccess` makes the open year-keyed lookup yield
 * `TaxParamSet | undefined`, and a cast or `!` is banned, so `assert` is the
 * only compliant narrowing path.
 *
 * Every proof below passes THIS object rather than a year, which is the
 * shape the production caller uses too — the year-to-parameters resolution
 * happens once, in `fjsRunTool`, and nothing downstream repeats it.
 */
const taxParamsFixture = taxParamsByYear[2025]
assert(taxParamsFixture !== undefined, 'expected TY2025 parameters to be present in taxParamsByYear')

/** Single-chunk UTF-8 CAS write, mirroring the proofs `fjs/server/fjs_run/snapshot/module.f.js` and `fjs/server/module.f.js` already establish. @type {<O extends Operation>(cas: Cas<O>) => (text: string) => Effect<O, string>} */
const seedText = cas => text => {
    const bytes = tryUtf8(text)
    assert(bytes !== null, ['expected sample text to encode as UTF-8', text])
    return mapStep(cas.write(pure({ first: ok(bytes), tail: pure(undefined) })), w => {
        assert(w[0] === 'ok', ['expected the seed write to succeed', w])
        return vecToCBase32(w[1])
    })
}

/**
 * Places a `JsModule` fixture (a plain zero-argument function
 * `fjs/effects/node/virtual`'s `import_` invokes on import) at the exact
 * nested location `virtual`'s own path recursion expects for `path` —
 * peeling one segment (`fjs/path/module.f.js`'s `parse`) into one nested
 * object level per segment, merging into `root` without disturbing sibling
 * entries at any level.
 *
 * 07-10: `executeRun` now imports from the FULL materialize path
 * (`programPath(materializeHome(materializeHomeRoot))(hash)`), never the
 * bare hash-derived filename — see the module header's account of the bug
 * this fixes. Every proof below must therefore key its `JsModule` fixture
 * at that SAME full path, not the bare name: keying at the bare name (the
 * pre-fix state of this file) would make a proof pass against code that
 * imports from the wrong place, exactly the blind spot that let the
 * production bug ship.
 * @type {(root: Dir) => (path: string) => (fn: JsModule) => Dir}
 */
export const placeJsModuleFixture = root => path => fn => {
    /** @type {(dir: Dir, segments: readonly string[]) => Dir} */
    const place = (dir, segments) => {
        const [first, ...rest] = segments
        if (first === undefined) {
            throw new Error('expected a non-empty path')
        }
        if (rest.length === 0) {
            return { ...dir, [first]: fn }
        }
        const sub = dir[first]
        const subDir = /** @type {Dir} */ (typeof sub === 'object' && sub !== null && !Array.isArray(sub) ? sub : {})
        return { ...dir, [first]: place(subDir, rest) }
    }
    return place(root, parse(path))
}

/**
 * Replays `executeRun`'s OWN materialize -> load -> snapshot -> interpret
 * sequence (Plan 05/Phase 6/Phase 3, unchanged — see the module header) for
 * a proof that needs a `kind:'ok'` `RunOutcome`, decomposed across TWO
 * `virtual` sessions rather than one call to `executeRun` itself.
 *
 * 07-10: this decomposition exists ONLY because `executeRun` can no longer
 * produce an 'ok' outcome under `virtual` in a single call, now that its
 * import path is fixed to match its own materialize-write path —
 * `fjs/effects/node/virtual`'s `writeFile` (array-of-`Vec`) and `import_`
 * (`JsModule` function) representations are incompatible at the SAME path
 * within the SAME session (confirmed empirically both ways: a pre-placed
 * `JsModule` fixture makes the REAL write fail with `'invalid file'` before
 * `loadProgram` ever runs; no fixture lets the write succeed but leaves an
 * array, so `import_` refuses with `'not a JsModule'`). This is exactly the
 * representational split `fjs/guest/materialize/module.f.js`'s own header
 * already documents and resolves by composing the write and the load "side
 * by side" rather than chained in one session — this helper applies that
 * SAME technique at `executeRun`'s own layer: the write is exercised for
 * real via its OWN `materializeProgram` call (a separate `virtual` session,
 * with nothing yet at the target path so it genuinely succeeds), then the
 * written array is swapped for a `JsModule` fixture (plain state surgery,
 * not an effect), then `loadProgram`/`buildRunSnapshot`/`buildHostMap`/
 * `interpret` — `executeRun`'s OWN remaining steps, called in the SAME
 * order — run in a second `virtual` session against that fixture. Nothing
 * about `executeRun`'s OWN logic changes; only the TEST's ability to
 * observe an 'ok' outcome under a filesystem that cannot execute
 * freshly-written bytes does. Real Node has no such limitation, which is
 * exactly why `fjs-run-integration.test.js` exists as the decisive,
 * single-call, real-process proof of the SAME round trip.
 *
 * Phase 21 (EXEC-14): `taxParams` is now a parameter of this helper too,
 * for the same reason everything else here is a faithful replay —
 * `executeRun` supplies `taxGuestCtx(input.taxParams)` to the loaded
 * program, so a helper that supplied a bare `guestCtx` would be replaying a
 * sequence production does not run, and a stored program reaching for
 * `ctx.form1040Report` would fail here for a reason no production caller
 * could ever hit.
 * @type {(home: string) => (taxParams: TaxParamSet) => (cas: Cas<FileCasOperation>) => (evoApi: Evo<FileCasOperation>) => (hash: string) => (source: string) => (report: TaxReport<unknown>) => (args: readonly string[]) => (pin: { readonly subject: string, readonly parents: readonly string[] } | undefined) => (state: State) => readonly [State, RunOutcome<unknown>]}
 */
const runExecuteRunViaFixture = home => taxParams => cas => evoApi => hash => source => report => args => pin => state => {
    // PROV-07: mirrors executeRun's own literalCount computation, from the
    // SAME `source` parameter this helper already receives.
    const literalCount = countNumericLiterals(source)
    const [state1, materializeResult] = virtual(state)(materializeProgram(home)(hash)(source))
    assert(materializeResult[0] === 'ok', ['expected the real materialize write to succeed', materializeResult])
    const path = programPath(materializeHome(home))(hash)
    const root = placeJsModuleFixture(state1.root)(path)(() => ({ report }))
    const state2 = { ...state1, root }
    return virtual(state2)(
        step(loadProgram([])(path)(source), loadResult => {
            if (loadResult[0] === 'error') {
                return pure(/** @type {RunOutcome<unknown>} */ ({ kind: 'error', message: loadResult[1], reads: [] }))
            }
            return step(buildRunSnapshot(cas)(evoApi)(pin), snapshot => {
                const hostMap = buildHostMap(snapshot)
                const loaded = /** @type {{ readonly report: TaxReport<unknown> }} */ (loadResult[1])
                const [t, v] = interpret(hostMap)(loaded.report(taxGuestCtx(taxParams))(args))
                if (t === 'error') {
                    return pure(/** @type {RunOutcome<unknown>} */ ({ kind: 'error', message: v, reads: [] }))
                }
                const [value, reads] = v
                // 09-06: shares the SAME imported classifyRunOutcome
                // executeRun calls above — no second copy of the zero-read
                // rule.
                return pure(classifyRunOutcome(literalCount)(value, reads))
            })
        }),
    )
}

// ── EXEC-12: error-taxonomy proof support ────────────────────────────────────

/**
 * `fjs/exec`'s own test-fixture escape hatch (`fjs/exec/module.f.js`),
 * reproduced locally rather than imported: constructing a probe outside
 * `CasOp`'s frozen vocabulary requires casting `do_` to `any`, and that
 * module's own comment confines the cast to ITS OWN test-fixture section —
 * so this file builds an equivalent local escape hatch instead of importing
 * across that boundary. A real `CasOp`-typed `Report` cannot construct this
 * (`tsc` refuses a literal `'fetch'` command), which is exactly why
 * `nonErrorThrowBecomesErrorResult` (below) needs it: it stands in for a
 * stored/generated program whose command string bypassed `tsc` before ever
 * reaching `interpret`'s runtime refusal.
 * @type {(command: string) => (...payload: readonly unknown[]) => Effect<CasOp, string>}
 */
const unsafeDo = /** @type {any} */ (do_)

/**
 * Extracts the run-record hash embedded in `fjsRunTool`'s own error text
 * (`... (run record: <hash>)`), reads that record back OUT of `cas` — never
 * the in-process outcome — and asserts it validates with `status: 'error'`.
 * All three error-taxonomy leaves below make this identical assertion
 * (PROV-03: a failed run still gets a run record), so it is factored here
 * once rather than repeated three times.
 * @type {(cas: Cas<FileCasOperation>) => (state: State) => (errorText: string) => void}
 */
const assertPersistedErrorRunRecord = cas => state => errorText => {
    const match = /run record: (\S+)\)/.exec(errorText)
    assert(match !== null, ['expected the error text to name a run record hash', errorText])
    const runHash = assertNotNullish(match[1], 'expected the run record hash capture group to be present')
    const runHashVec = cBase32ToVec(runHash)
    assert(runHashVec !== null, 'expected a decodable runHash')
    const [, runRead] = virtual(state)(collectRead(cas.read(/** @type {Vec} */ (runHashVec))))
    assert(runRead[0] === 'ok', ['expected the error run record to read back', runRead])
    const [vt, record] = validateRun(JSON.parse(utf8ToString(runRead[1])))
    assert(vt === 'ok', ['expected the error record to validate', vt, record])
    if (vt === 'ok') {
        assertEq(record.status, 'error')
    }
}

/**
 * A trivial, well-behaved report program's source — one harmless `evoList`
 * dispatch ({@link classifyRunOutcome}'s zero-read gate: a zero-length
 * observed-read set is now an error outcome, so even this plumbing fixture
 * must dispatch at least one real read) then `ctx.pure('ok')` — the SAME
 * text {@link seedGoodProgram} stores
 * into CAS and {@link assertSessionSurvivesAFollowingCall} materializes/loads
 * via {@link runExecuteRunViaFixture}. Kept in sync with {@link goodReport}'s
 * own actual body (which is what really runs, per this file's established
 * write/JsModule split) so this stored text never misleadingly describes a
 * different program than the one that executes.
 * @type {string}
 */
const goodProgramSource = 'export const report = ctx => args => ctx.step(ctx.evoList("false"), () => ctx.pure("ok"))'

/**
 * Seeds {@link goodProgramSource} into `state`'s CAS store, returning its
 * hash. No JsModule fixture is placed here (07-10): `fjsRunTool`/executeRun
 * always attempt their OWN real materialize-write internally, which would
 * collide with any fixture pre-placed ahead of time (see the module header
 * and {@link runExecuteRunViaFixture}'s own header) — so fixture placement
 * happens at CALL time instead, in
 * {@link assertSessionSurvivesAFollowingCall}.
 * @type {(cas: Cas<FileCasOperation>) => (state: State) => readonly [State, string]}
 */
const seedGoodProgram = cas => state => {
    const [state1, hash] = virtual(state)(seedText(cas)(goodProgramSource))
    return [state1, hash]
}

/**
 * Drives a KNOWN-GOOD run against `state` and asserts it succeeds — the
 * "never a dropped connection" half of EXEC-12's criterion 4, not merely
 * "never a process crash": a caller that survives a refusal but leaves the
 * session unable to answer a FOLLOWING call has only proven half the claim.
 *
 * 07-10: this can no longer call `fjsRunTool.handle` directly for the SAME
 * reason `runExecuteRunViaFixture` exists — a single call cannot produce an
 * 'ok' `RunOutcome` under `virtual` once `executeRun`'s own write and import
 * target the identical path. So the outcome is produced via
 * {@link runExecuteRunViaFixture} (the decomposed materialize/load/snapshot/
 * interpret sequence) and handed to {@link handleRunOutcome} directly —
 * `fjsRunTool`'s OWN post-outcome logic, unchanged, just invoked without
 * re-deriving the outcome through `executeRun` itself.
 *
 * A full `financeMcpServer`-style multi-batch session
 * (`fjs/server/module.f.js`'s own `casRefresh.seedInvisibleUntilRefreshed`
 * pattern, threading `State` across `runBatch` calls) is heavier than
 * needed here: `fjsRunTool` is not yet wired into `financeMcpServer` — that
 * wiring is Plan 09's own documented follow-up (07-06-SUMMARY.md's "Next
 * Phase Readiness") — so there is no assembled registry/transport to drive
 * a `tools/list` or `ping` through yet. Driving a second run against the
 * SAME threaded virtual `State` is the smaller-scoped equivalent Task 2's
 * own plan text explicitly permits, documented here rather than silently
 * substituted.
 * @type {(materializeHomeRoot: string) => (cas: Cas<FileCasOperation>) => (evoApi: Evo<FileCasOperation>) => (state: State) => (goodHash: string) => void}
 */
const assertSessionSurvivesAFollowingCall = home => cas => e => state => goodHash => {
    // PROV-07: one harmless evoList dispatch, even against an empty store,
    // gives reads.length === 1 — required now that a zero-read outcome is
    // refused as an error rather than returned as 'ok' (see the module's
    // RunOutcome typedef and the zero-read gate in executeRun above).
    /** @type {Report<string>} */
    const goodReport = ctx => () => ctx.step(ctx.evoList('false'), () => ctx.pure('ok'))
    const [state1, outcome] = runExecuteRunViaFixture(home)(taxParamsFixture)(cas)(e)(goodHash)(goodProgramSource)(goodReport)([])(undefined)(state)
    const [, followUp] = virtual(state1)(handleRunOutcome(cas)(goodHash)([])(false)({})({ taxYear: 2025, paramSetHash: 'sha256-paramset1' })(outcome))
    assertEq(followUp.isError, undefined)
}

export const proof = {
    // ── Task 1: executeRun ──────────────────────────────────────────────
    executeRun: {
        // Success Criterion 1's enabling shape: a program that loops over
        // BOTH stored documents (via evoList/evoHead/evoRevision/casRead,
        // sequenced through ctx.step) and sums a field across them, run
        // through executeRun's OWN materialize -> load -> snapshot ->
        // interpret sequence — decomposed via runExecuteRunViaFixture
        // (07-10) rather than a single call to executeRun, which can no
        // longer return an 'ok' outcome under virtual now that its import
        // path matches its own materialize-write path (see that helper's
        // own header, and the module header, for why).
        multiDocumentSumAcrossTwoStoredDocuments: () => {
            const home = '/success'
            const cas = fileCas(sha256)(home)
            const [state0, cacheKey] = virtual(emptyState)(initEvo(cas))
            const e = evo(cas)(cacheKey)

            const [state1, docAHash] = virtual(state0)(seedText(cas)('{"amount":"10.00"}'))
            const [state2, docBHash] = virtual(state1)(seedText(cas)('{"amount":"20.00"}'))
            const [state3, addA] = virtual(state2)(e.add({ parents: [], subject: 'subjectA', snapshot: docAHash }))
            assert(addA[0] === 'ok', ['expected subject A revision add to succeed', addA])
            const [state4, addB] = virtual(state3)(e.add({ parents: [], subject: 'subjectB', snapshot: docBHash }))
            assert(addB[0] === 'ok', ['expected subject B revision add to succeed', addB])

            // The program's OWN stored source: zero imports, so
            // checkSpecifiers passes. Its actual text is otherwise
            // irrelevant to this proof — the loaded module comes from the
            // JsModule fixture below, not from parsing this text.
            const programSource = 'export const report = ctx => args => ctx.pure("0.00")'
            const [state5, programHash] = virtual(state4)(seedText(cas)(programSource))

            /** @type {(subjects: readonly string[]) => (acc: bigint) => Effect<CasOp, string>} */
            const sumOverSubjects = subjects => acc => {
                const [subject, ...rest] = subjects
                if (subject === undefined) {
                    return guestCtx.pure(guestCtx.centsToString(acc))
                }
                return guestCtx.step(guestCtx.evoHead(subject), headsJson => {
                    const heads = /** @type {readonly string[]} */ (JSON.parse(headsJson))
                    const headHash = assertNotNullish(heads[0], ['expected at least one head', subject])
                    return guestCtx.step(guestCtx.evoRevision(headHash), revJson => {
                        const rev = /** @type {{ readonly snapshot: string }} */ (JSON.parse(revJson))
                        return guestCtx.step(guestCtx.casRead(rev.snapshot), docJson => {
                            const doc = /** @type {{ readonly amount: string }} */ (JSON.parse(docJson))
                            return sumOverSubjects(rest)(acc + guestCtx.centsFromString(doc.amount))
                        })
                    })
                })
            }
            /** @type {Report<string>} */
            const sumReport = ctx => () => ctx.step(
                ctx.evoList('false'),
                activeJson => sumOverSubjects(/** @type {readonly string[]} */ (JSON.parse(activeJson)))(0n))

            const [, outcome] = runExecuteRunViaFixture(home)(taxParamsFixture)(cas)(e)(programHash)(programSource)(sumReport)([])(undefined)(state5)
            assert(outcome.kind === 'ok', ['expected an ok outcome', outcome])
            if (outcome.kind === 'ok') {
                assertEq(outcome.value, '30.00')
                assert(outcome.reads.length >= 2, ['expected at least 2 reads', outcome.reads])
            }
        },
        // A missing/unresolvable hash short-circuits before materialize or
        // interpret ever run. The spy/counter this criterion asks for is
        // the virtual filesystem's own root: materializeProgram
        // unconditionally mkdirs and writes, so ANY invocation leaves a
        // trace there; its total absence is the proof it never ran.
        missingHashShortCircuitsBeforeMaterializeOrInterpret: () => {
            const home = '/missing'
            const cas = fileCas(sha256)(home)
            const [state0, cacheKey] = virtual(emptyState)(initEvo(cas))
            const e = evo(cas)(cacheKey)
            const [state1, outcome] = virtual(state0)(
                executeRun(home)(cas)(e)({ hash: 'not-a-real-hash', args: [], taxParams: taxParamsFixture }))
            assertEq(outcome.kind, 'error')
            if (outcome.kind === 'error') {
                assert(outcome.message.includes('not-a-real-hash'), outcome.message)
                assertEq(outcome.reads.length, 0)
            }
            assertEq(Object.keys(state1.root).length, 0)
        },
        // A dirty specifier in the stored source is refused, naming the
        // offending specifier — reached via loadProgram's own
        // checkSpecifiers gate (Phase 6, unchanged).
        dirtySpecifierNamesTheOffendingSpecifier: () => {
            const home = '/dirty'
            const cas = fileCas(sha256)(home)
            const [state0, cacheKey] = virtual(emptyState)(initEvo(cas))
            const e = evo(cas)(cacheKey)
            const [state1, dirtyHash] = virtual(state0)(
                seedText(cas)(`import fs from 'node:fs'\nexport const report = ctx => args => ctx.pure('x')`))
            const [, outcome] = virtual(state1)(executeRun(home)(cas)(e)({ hash: dirtyHash, args: [], taxParams: taxParamsFixture }))
            assertEq(outcome.kind, 'error')
            if (outcome.kind === 'error') {
                assert(outcome.message.includes('node:fs'), outcome.message)
            }
        },
        // The pin override changes what ctx.evoHead resolves to inside a
        // RUNNING program, through executeRun's OWN materialize -> load ->
        // snapshot -> interpret sequence — decomposed via
        // runExecuteRunViaFixture (07-10), never buildHostMap in isolation
        // (Plan 05's own proof, one layer down).
        pinOverridesTheLiveHeadThroughFullExecuteRun: () => {
            const home = '/pin'
            const cas = fileCas(sha256)(home)
            const [state0, cacheKey] = virtual(emptyState)(initEvo(cas))
            const e = evo(cas)(cacheKey)
            const [state1, docHash] = virtual(state0)(seedText(cas)('{}'))
            const [state2, addResult] = virtual(state1)(e.add({ parents: [], subject: 'subjectS', snapshot: docHash }))
            assert(addResult[0] === 'ok', ['expected the revision add to succeed', addResult])

            const programSource = 'export const report = ctx => args => ctx.pure("unused")'
            const [state3, programHash] = virtual(state2)(seedText(cas)(programSource))
            /** @type {Report<string>} */
            const pinReport = ctx => runArgs => ctx.evoHead(runArgs[0] ?? '')

            const [, outcome] = runExecuteRunViaFixture(home)(taxParamsFixture)(cas)(e)(programHash)(programSource)(pinReport)(['subjectS'])(
                { subject: 'subjectS', parents: ['PINNED_INSTEAD'] })(state3)
            assert(outcome.kind === 'ok', ['expected an ok outcome', outcome])
            if (outcome.kind === 'ok') {
                assertEq(outcome.value, JSON.stringify(['PINNED_INSTEAD']))
                assert(
                    outcome.value !== JSON.stringify([addResult[1]]),
                    'must not resolve to the live head')
            }
        },
        // EXEC-14: the 1040 engine reaches a LOADED guest program through
        // executeRun's OWN materialize -> load -> snapshot -> interpret
        // sequence, computing from a document really stored in a real CAS
        // and read back through the frozen four commands.
        //
        // Deliberately a small local fixture rather than an import of
        // `fjs/report/tax_return`: `fjs_run` imports no report module (see
        // that module's own header — a stored program is materialized text
        // imported by hash at run time, never a call into the module that
        // documents it), and this leaf is about the WIRING, not about the
        // 1040 arithmetic, which `fjs/report/tax_return` and
        // `fjs/form1040/core` prove between them.
        //
        // Expected value hand-typed: $15,750.00 is TY2025's single standard
        // deduction as printed in Rev. Proc. 2025-32 §3.01. It is not read
        // back out of `taxParamsFixture`, so this leaf notices the engine
        // being handed the wrong parameters, not merely being handed some.
        theEngineReachesALoadedProgramThroughFullExecuteRun: () => {
            const home = '/tax-engine'
            const cas = fileCas(sha256)(home)
            const [state0, cacheKey] = virtual(emptyState)(initEvo(cas))
            const e = evo(cas)(cacheKey)
            const [state1, profileHash] = virtual(state0)(seedText(cas)(jsonText({
                dialect: returnProfileDialect,
                taxYear: 2025,
                filingStatus: 'single',
                dependentCount: 0,
                declaredKinds: ['wages'],
            })))
            const [state2, addResult] = virtual(state1)(
                e.add({ parents: [], subject: 'subjectProfile', snapshot: profileHash }))
            assert(addResult[0] === 'ok', ['expected the profile revision add to succeed', addResult])

            const programSource = 'export const report = ctx => args => ctx.pure("unused")'
            const [state3, programHash] = virtual(state2)(seedText(cas)(programSource))

            /** @type {TaxReport<string>} */
            const engineReport = ctx => runArgs => ctx.step(ctx.evoHead(runArgs[0] ?? ''), headsJson => {
                /** @type {readonly string[]} */
                const heads = JSON.parse(headsJson)
                const headHash = assertNotNullish(heads[0], 'expected at least one head')
                return ctx.step(ctx.evoRevision(headHash), revJson => {
                    /** @type {{ readonly snapshot: string }} */
                    const rev = JSON.parse(revJson)
                    return ctx.step(ctx.casRead(rev.snapshot), docJson => {
                        const outcome = ctx.form1040Report({
                            profile: {
                                documentHash: rev.snapshot,
                                value: /** @type {ReturnProfile} */ (JSON.parse(docJson)),
                            },
                            w2s: [],
                            interestForms: [],
                            dividendForms: [],
                            brokerageForms: [],
                            retirementForms: [],
                            socialSecurityForms: [],
                            itemizedDeductionForms: [],
                            medicalExpenseForms: [],
                            capitalLossCarryoverForms: [],
                            unemploymentForms: [],
                            adjustmentForms: [],
                            studentLoanInterestForms: [], tuitionForms: [], creditForms: [],
                            nonemployeeCompensationForms: [], businessExpenseForms: [],
                            iraForms: [], priorYearIraBasisForms: [],
                        })
                        assert(outcome.kind === 'ok', ['expected the engine to compute', outcome])
                        if (outcome.kind !== 'ok') {
                            return ctx.pure('')
                        }
                        const deduction = assertNotNullish(
                            outcome.lines.find(line => line.rule === '1040 line 12e'),
                            'expected line 12e')
                        return ctx.pure(ctx.centsToString(deduction.value))
                    })
                })
            })

            const [, outcome] = runExecuteRunViaFixture(home)(taxParamsFixture)(cas)(e)(programHash)(
                programSource)(engineReport)(['subjectProfile'])(undefined)(state3)
            assert(outcome.kind === 'ok', ['expected an ok outcome', outcome])
            if (outcome.kind === 'ok') {
                assertEq(outcome.value, '15750.00')
                // The reads really happened through the frozen commands —
                // three of them, on a program that computed a tax line. A
                // 1040 assembled without touching the store would show none.
                assertEq(outcome.reads.length, 3)
            }
        },
    },

    // ── Task 2: fjsRunTool ───────────────────────────────────────────────
    fjsRunTool: {
        // Success Criterion 3's static half — casWrite/evoAdd absent from
        // the guest ABI — is re-verified after this plan's own edits by
        // this plan's own `<verify>` step
        // (`grep -n "casWrite|evoAdd" fjs/guest/module.f.js
        // fjs/guest/materialize/module.f.js`), not duplicated here: a grep
        // over the guest ABI's own two files is exactly what that
        // criterion names, and reproducing it via an impure in-module file
        // read would cost purity for no additional coverage.
        //
        // Criterion 2, the adversarial proof: a program reads a document it
        // never cites in its return value; the PERSISTED record — decoded
        // back out of CAS by its own returned runHash, never the in-process
        // Read[] — still names that read.
        adversarial: {
            persistedRunRecordContainsAnUncitedRead: () => {
                const home = '/adversarial'
                const cas = fileCas(sha256)(home)
                const [state0, cacheKey] = virtual(emptyState)(initEvo(cas))
                const e = evo(cas)(cacheKey)
                const [state1, citedHash] = virtual(state0)(seedText(cas)('{"cited":true}'))
                const [state2, uncitedHash] = virtual(state1)(seedText(cas)('{"uncited":true}'))
                const programSource = 'export const report = ctx => args => ctx.pure("unused")'
                const [state3, programHash] = virtual(state2)(seedText(cas)(programSource))

                /** @type {Report<string>} */
                const adversarialReport = ctx => () => ctx.step(
                    ctx.casRead(citedHash),
                    citedValue => ctx.step(ctx.casRead(uncitedHash), () => ctx.pure(citedValue)))

                // 07-10: a single call to fjsRunTool.handle can no longer
                // return an 'ok' outcome under virtual (see the module
                // header and runExecuteRunViaFixture's own header), so the
                // outcome is produced via the decomposed materialize/load
                // sequence and handed to handleRunOutcome directly —
                // fjsRunTool's OWN post-outcome logic, unchanged.
                const [state3b, outcome] = runExecuteRunViaFixture(home)(taxParamsFixture)(cas)(e)(programHash)(programSource)(adversarialReport)([])(undefined)(state3)
                const [state4, callResult] = virtual(state3b)(handleRunOutcome(cas)(programHash)([])(false)({})({ taxYear: 2025, paramSetHash: 'sha256-paramset1' })(outcome))
                assertEq(callResult.isError, undefined)
                const first = callResult.content[0]
                if (first === undefined || first.type !== 'text') {
                    throw ['expected a text content item', callResult]
                }
                const parsed = /** @type {{ readonly resultHash: string, readonly runHash: string, readonly preview: string, readonly truncated: boolean }} */ (JSON.parse(first.text))

                const runHashVec = cBase32ToVec(parsed.runHash)
                assert(runHashVec !== null, ['expected a decodable runHash', parsed.runHash])
                const [, runReadResult] = virtual(state4)(
                    collectRead(cas.read(/** @type {Vec} */ (runHashVec))))
                assert(runReadResult[0] === 'ok', ['expected the run record to read back', runReadResult])
                const [vt, record] = validateRun(JSON.parse(utf8ToString(runReadResult[1])))
                assert(vt === 'ok', ['expected the persisted record to validate', vt, record])
                if (vt === 'ok') {
                    assert(
                        record.inputs.some(i => i.command === 'casRead' && i.payload[0] === uncitedHash),
                        ['expected inputs[] to contain the uncited read', record.inputs])
                }
            },
        },
        // Criterion 3, the behavioral proof: exactly two new CAS hashes
        // appear after one handle call, and both decode to content the
        // HANDLER itself constructed.
        behavioral: {
            exactlyTwoNewHandlerConstructedHashesAppear: () => {
                const home = '/behavioral'
                const cas = fileCas(sha256)(home)
                const [state0, cacheKey] = virtual(emptyState)(initEvo(cas))
                const e = evo(cas)(cacheKey)
                const programSource = 'export const report = ctx => args => ctx.pure("answer-42")'
                const [state1, programHash] = virtual(state0)(seedText(cas)(programSource))
                // PROV-07: one harmless evoList dispatch gives
                // reads.length === 1, required now that a zero-read outcome
                // is refused as an error instead of returned as 'ok'.
                /** @type {Report<string>} */
                const trivialReport = ctx => () => ctx.step(ctx.evoList('false'), () => ctx.pure('answer-42'))

                const [, hashesBefore] = virtual(state1)(cas.list())
                const hashesBeforeSet = new Set(hashesBefore.map(vecToCBase32))

                // 07-10: decomposed via runExecuteRunViaFixture/
                // handleRunOutcome — see the adversarial proof above for
                // why a direct fjsRunTool.handle call can no longer succeed
                // under virtual.
                const [state1b, outcome] = runExecuteRunViaFixture(home)(taxParamsFixture)(cas)(e)(programHash)(programSource)(trivialReport)([])(undefined)(state1)
                const [state2, callResult] = virtual(state1b)(handleRunOutcome(cas)(programHash)([])(false)({})({ taxYear: 2025, paramSetHash: 'sha256-paramset1' })(outcome))
                assertEq(callResult.isError, undefined)
                const first = callResult.content[0]
                if (first === undefined || first.type !== 'text') {
                    throw ['expected a text content item', callResult]
                }
                const parsed = /** @type {{ readonly resultHash: string, readonly runHash: string, readonly preview: string, readonly truncated: boolean }} */ (JSON.parse(first.text))

                const [, hashesAfter] = virtual(state2)(cas.list())
                const hashesAfterSet = new Set(hashesAfter.map(vecToCBase32))
                const newHashes = [...hashesAfterSet].filter(h => !hashesBeforeSet.has(h))
                assertEq(newHashes.length, 2)
                assert(newHashes.includes(parsed.resultHash), ['expected resultHash among the new hashes', newHashes])
                assert(newHashes.includes(parsed.runHash), ['expected runHash among the new hashes', newHashes])

                const resultHashVec = cBase32ToVec(parsed.resultHash)
                assert(resultHashVec !== null, 'expected a decodable resultHash')
                const [, resultRead] = virtual(state2)(collectRead(cas.read(/** @type {Vec} */ (resultHashVec))))
                assert(resultRead[0] === 'ok', ['expected the result to read back', resultRead])
                assertEq(utf8ToString(resultRead[1]), 'answer-42')

                const runHashVec = cBase32ToVec(parsed.runHash)
                assert(runHashVec !== null, 'expected a decodable runHash')
                const [, runRead] = virtual(state2)(collectRead(cas.read(/** @type {Vec} */ (runHashVec))))
                assert(runRead[0] === 'ok', ['expected the run record to read back', runRead])
                const [vt] = validateRun(JSON.parse(utf8ToString(runRead[1])))
                assertEq(vt, 'ok')
            },
            // The ABI is `Report<T>` with `T` unconstrained, so a report may
            // return a structured value — and one asked to compute a total
            // will. `String(value)` used to reduce every such value to
            // '[object Object]', which was then hashed, stored, and named by
            // the run record's `resultHash`: the answer destroyed, and the
            // provenance record attesting to the destruction, with nothing
            // reporting an error. The stored bytes must be the value.
            objectResultIsSerializedNotStringified: () => {
                const home = '/objectresult'
                const cas = fileCas(sha256)(home)
                const [state0, cacheKey] = virtual(emptyState)(initEvo(cas))
                const e = evo(cas)(cacheKey)
                const programSource = 'export const report = ctx => args => ctx.step(ctx.evoList("false"), () => ctx.pure({ total: "1234.56" }))'
                const [state1, programHash] = virtual(state0)(seedText(cas)(programSource))
                // One dispatched read, so the zero-read gate (09-03) lets the
                // outcome through as 'ok' — this leaf is about serialization,
                // not about that gate.
                /** @type {Report<unknown>} */
                const objectReport = ctx => () => ctx.step(ctx.evoList('false'), () => ctx.pure({ total: '1234.56' }))

                const [state1b, outcome] = runExecuteRunViaFixture(home)(taxParamsFixture)(cas)(e)(programHash)(programSource)(objectReport)([])(undefined)(state1)
                const [state2, callResult] = virtual(state1b)(handleRunOutcome(cas)(programHash)([])(false)({})({ taxYear: 2025, paramSetHash: 'sha256-paramset1' })(outcome))
                assertEq(callResult.isError, undefined)
                const first = callResult.content[0]
                if (first === undefined || first.type !== 'text') {
                    throw ['expected a text content item', callResult]
                }
                const parsed = /** @type {{ readonly resultHash: string }} */ (JSON.parse(first.text))
                const resultHashVec = cBase32ToVec(parsed.resultHash)
                assert(resultHashVec !== null, 'expected a decodable resultHash')
                const [, resultRead] = virtual(state2)(collectRead(cas.read(/** @type {Vec} */ (resultHashVec))))
                assert(resultRead[0] === 'ok', ['expected the result to read back', resultRead])
                // Not '[object Object]', and not merely "different" — the exact
                // bytes, which parse back to the value the program computed.
                const stored = utf8ToString(resultRead[1])
                assertEq(stored, '{"total":"1234.56"}')
                assertEq(JSON.parse(stored).total, '1234.56')
            },
            // Merge regression. `withResultText` swaps `value` for `text` and
            // carries the rest of the outcome through. When phase 9 added
            // `literalCount` to `RunOutcome`, an earlier spelling that rebuilt
            // the object field-by-field dropped it — the response envelope
            // would have reported `literalCount: undefined`, disabling the
            // anti-hardcoding audit without failing anything. The field has to
            // survive the serialization step, so assert it on the envelope
            // that step feeds.
            literalCountSurvivesResultSerialization: () => {
                const home = '/literalcount'
                const cas = fileCas(sha256)(home)
                const [state0, cacheKey] = virtual(emptyState)(initEvo(cas))
                const e = evo(cas)(cacheKey)
                // Three numeric literals in the source, and a structured
                // result — so the value goes through `stringify`, the path
                // that rebuilds the outcome.
                const programSource = 'export const report = ctx => args => ctx.step(ctx.evoList("false"), () => ctx.pure({ a: 1, b: 2, c: 3 }))'
                const [state1, programHash] = virtual(state0)(seedText(cas)(programSource))
                /** @type {Report<unknown>} */
                const countedReport = ctx => () => ctx.step(ctx.evoList('false'), () => ctx.pure({ a: 1, b: 2, c: 3 }))

                const [state1b, outcome] = runExecuteRunViaFixture(home)(taxParamsFixture)(cas)(e)(programHash)(programSource)(countedReport)([])(undefined)(state1)
                assert(outcome.kind === 'ok', ['expected an ok outcome', outcome])
                const expected = outcome.literalCount
                assert(expected > 0, ['the fixture must have numeric literals to count', expected])

                const [, callResult] = virtual(state1b)(handleRunOutcome(cas)(programHash)([])(false)({})({ taxYear: 2025, paramSetHash: 'sha256-paramset1' })(outcome))
                const first = callResult.content[0]
                if (first === undefined || first.type !== 'text') {
                    throw ['expected a text content item', callResult]
                }
                const parsed = /** @type {{ readonly literalCount: number }} */ (JSON.parse(first.text))
                assertEq(parsed.literalCount, expected)
            },
            // A string result is passed through byte-for-byte, never quoted.
            // Serializing it would change the result hash of every program
            // written so far, for a value that was already the answer.
            stringResultIsUnquoted: () => {
                const home = '/stringresult'
                const cas = fileCas(sha256)(home)
                const [state0, cacheKey] = virtual(emptyState)(initEvo(cas))
                const e = evo(cas)(cacheKey)
                const programSource = 'export const report = ctx => args => ctx.step(ctx.evoList("false"), () => ctx.pure("0.00"))'
                const [state1, programHash] = virtual(state0)(seedText(cas)(programSource))
                /** @type {Report<unknown>} */
                const stringReport = ctx => () => ctx.step(ctx.evoList('false'), () => ctx.pure('0.00'))

                const [state1b, outcome] = runExecuteRunViaFixture(home)(taxParamsFixture)(cas)(e)(programHash)(programSource)(stringReport)([])(undefined)(state1)
                const [state2, callResult] = virtual(state1b)(handleRunOutcome(cas)(programHash)([])(false)({})({ taxYear: 2025, paramSetHash: 'sha256-paramset1' })(outcome))
                const first = callResult.content[0]
                if (first === undefined || first.type !== 'text') {
                    throw ['expected a text content item', callResult]
                }
                const parsed = /** @type {{ readonly resultHash: string }} */ (JSON.parse(first.text))
                const [, resultRead] = virtual(state2)(collectRead(cas.read(/** @type {Vec} */ (assertNotNullish(cBase32ToVec(parsed.resultHash), 'decodable resultHash')))))
                assert(resultRead[0] === 'ok', ['expected the result to read back', resultRead])
                assertEq(utf8ToString(resultRead[1]), '0.00')
            },
            // A value JSON cannot represent is a broken report, and saying so
            // is the only answer that does not silently corrupt the result. It
            // still gets a run record — provenance that covers only successes
            // is not provenance.
            nonJsonResultBecomesAnErrorRecord: () => {
                const home = '/bigintresult'
                const cas = fileCas(sha256)(home)
                const [state0, cacheKey] = virtual(emptyState)(initEvo(cas))
                const e = evo(cas)(cacheKey)
                const programSource = 'export const report = ctx => args => ctx.step(ctx.evoList("false"), () => ctx.pure(1n))'
                const [state1, programHash] = virtual(state0)(seedText(cas)(programSource))
                /** @type {Report<unknown>} */
                const bigintReport = ctx => () => ctx.step(ctx.evoList('false'), () => ctx.pure(1n))

                const [state1b, outcome] = runExecuteRunViaFixture(home)(taxParamsFixture)(cas)(e)(programHash)(programSource)(bigintReport)([])(undefined)(state1)
                const [state2, callResult] = virtual(state1b)(handleRunOutcome(cas)(programHash)([])(false)({})({ taxYear: 2025, paramSetHash: 'sha256-paramset1' })(outcome))
                assertEq(callResult.isError, true)
                const first = callResult.content[0]
                if (first === undefined || first.type !== 'text') {
                    throw ['expected a text content item', callResult]
                }
                assert(first.text.includes('not representable as JSON'), first.text)
                // The record exists, says `error`, and validates.
                const runHash = assertNotNullish(
                    /^.*\(run record: (.*)\)$/.exec(first.text)?.[1], ['expected a run record hash in the message', first.text])
                const [, runRead] = virtual(state2)(collectRead(cas.read(/** @type {Vec} */ (assertNotNullish(cBase32ToVec(runHash), 'decodable runHash')))))
                assert(runRead[0] === 'ok', ['expected the run record to read back', runRead])
                const record = /** @type {{ readonly status: string }} */ (JSON.parse(utf8ToString(runRead[1])))
                assertEq(record.status, 'error')
                assertEq(validateRun(record)[0], 'ok')
            },
        },
        // A successful run's response has exactly the six uniform keys
        // (PROV-07 added readCount/literalCount beside the original four;
        // PROV-04 added taxYear/paramSetHash/programHash/
        // reviewedEstimateFraming beside those), and the result is written
        // to CAS even for a trivially small value (truncated === false, but
        // resultHash still resolves).
        responseShape: {
            tenKeysExactlyAndResultAlwaysResolvable: () => {
                const home = '/shape'
                const cas = fileCas(sha256)(home)
                const [state0, cacheKey] = virtual(emptyState)(initEvo(cas))
                const e = evo(cas)(cacheKey)
                const programSource = 'export const report = ctx => args => ctx.pure("tiny")'
                const [state1, programHash] = virtual(state0)(seedText(cas)(programSource))
                // PROV-07: one harmless evoList dispatch gives
                // reads.length === 1, required now that a zero-read outcome
                // is refused as an error instead of returned as 'ok'.
                /** @type {Report<string>} */
                const tinyReport = ctx => () => ctx.step(ctx.evoList('false'), () => ctx.pure('tiny'))

                // 07-10: decomposed via runExecuteRunViaFixture/
                // handleRunOutcome — see the adversarial proof above for
                // why a direct fjsRunTool.handle call can no longer succeed
                // under virtual.
                const [state1b, outcome] = runExecuteRunViaFixture(home)(taxParamsFixture)(cas)(e)(programHash)(programSource)(tinyReport)([])(undefined)(state1)
                const [state2, callResult] = virtual(state1b)(handleRunOutcome(cas)(programHash)([])(false)({})({ taxYear: 2025, paramSetHash: 'sha256-paramset1' })(outcome))
                assertEq(callResult.isError, undefined)
                const first = callResult.content[0]
                if (first === undefined || first.type !== 'text') {
                    throw ['expected a text content item', callResult]
                }
                const parsed = /** @type {Record<string, unknown>} */ (JSON.parse(first.text))
                assertEq(
                    JSON.stringify(Object.keys(parsed).sort()),
                    JSON.stringify([
                        'literalCount', 'paramSetHash', 'preview', 'programHash', 'readCount',
                        'resultHash', 'reviewedEstimateFraming', 'runHash', 'taxYear', 'truncated',
                    ]))
                assertEq(parsed['truncated'], false)
                // PROV-07: tinyReport (repaired in Task 1) dispatches
                // exactly one evoList read; readCount derives from the SAME
                // inputs[] the run record persists. literalCount is
                // countNumericLiterals of this report's own stored source
                // text (programSource, above) — 0, since it contains no
                // numeric literal.
                assertEq(parsed['readCount'], 1)
                assertEq(parsed['literalCount'], countNumericLiterals(programSource))
                // PROV-04: the provenance header alongside the existing keys.
                assertEq(parsed['taxYear'], 2025)
                assertEq(parsed['paramSetHash'], 'sha256-paramset1')
                assertEq(parsed['programHash'], programHash)
                assertEq(parsed['reviewedEstimateFraming'], reviewedEstimateFraming)

                const resultHashValue = parsed['resultHash']
                assert(typeof resultHashValue === 'string', ['expected resultHash to be a string', parsed])
                const resultHashVec = cBase32ToVec(resultHashValue)
                assert(resultHashVec !== null, 'expected resultHash to be resolvable even for a tiny value')
                const [, resultRead] = virtual(state2)(collectRead(cas.read(/** @type {Vec} */ (resultHashVec))))
                assert(resultRead[0] === 'ok', ['expected the tiny result to read back', resultRead])
                assertEq(utf8ToString(resultRead[1]), 'tiny')
            },
        },
        // A failed run still gets a run record (07-CONTEXT.md): status
        // 'error', the error message present, no resultHash.
        errorPath: {
            failedRunStillGetsARunRecord: () => {
                const home = '/error-path'
                const cas = fileCas(sha256)(home)
                const [state0, cacheKey] = virtual(emptyState)(initEvo(cas))
                const e = evo(cas)(cacheKey)
                const [state1, callResult] = virtual(state0)(
                    fjsRunTool(home)(cas)(e).handle({ hash: 'not-a-real-hash', taxYear: 2025 }))
                assertEq(callResult.isError, true)
                const first = callResult.content[0]
                if (first === undefined || first.type !== 'text') {
                    throw ['expected a text content item', callResult]
                }
                const match = /run record: (\S+)\)/.exec(first.text)
                assert(match !== null, ['expected the error text to name a run record hash', first.text])
                const runHash = assertNotNullish(match[1], 'expected the run record hash capture group to be present')
                const runHashVec = cBase32ToVec(runHash)
                assert(runHashVec !== null, 'expected a decodable runHash')
                const [, runRead] = virtual(state1)(collectRead(cas.read(/** @type {Vec} */ (runHashVec))))
                assert(runRead[0] === 'ok', ['expected the error run record to read back', runRead])
                const [vt, record] = validateRun(JSON.parse(utf8ToString(runRead[1])))
                assert(vt === 'ok', ['expected the error record to validate', vt, record])
                if (vt === 'ok') {
                    assertEq(record.status, 'error')
                    assert(record.error !== undefined && record.error.includes('not-a-real-hash'), record.error)
                    assertEq(record.resultHash, undefined)
                }
            },
        },
        // 09-07: the pin path through fjsRunTool's OWN handler logic —
        // E1 (`pinned`'s `&&` mutated to `||`) and E11 (the ok arm's
        // `pinned` hardcoded to `false`) both survived because no proof
        // in this file called `fjsRunTool.handle` with `subject`/`parents`
        // at all; every pin proof drove `runExecuteRunViaFixture` (a
        // decomposed replay of executeRun's OWN steps) directly instead.
        // See the module header, and this plan's own SUMMARY, for why the
        // THIRD mutation this task names (E2, dropping `...pinFields` from
        // `fjsRunTool`'s own `executeRun(...)` call) needs an 'ok' outcome
        // through `fjsRunTool.handle` itself — something `virtual` cannot
        // produce in one call (07-10) — and is therefore proven in
        // `fjs-run-integration.test.js` against a real, separate process
        // instead.
        pinIntegrity: {
            // E1: a `subject`-only call (no `parents`) reaches
            // `fjsRunTool.handle` itself — not `handleRunOutcome` in
            // isolation — so `pinned`'s own `&&`-vs-`||` computation is
            // exercised at its actual call site. A missing hash short-
            // circuits `executeRun` before pin resolution ever runs, so
            // this needs no materialize/import round trip: `pinned`/
            // `pinFields` are computed from `args` before `executeRun` is
            // even called.
            subjectOnlyWithoutParentsPersistsPinnedFalse: () => {
                const home = '/pin-subject-only'
                const cas = fileCas(sha256)(home)
                const [state0, cacheKey] = virtual(emptyState)(initEvo(cas))
                const e = evo(cas)(cacheKey)
                const [state1, callResult] = virtual(state0)(
                    fjsRunTool(home)(cas)(e).handle({ hash: 'not-a-real-hash', taxYear: 2025, subject: 'someSubject' }))
                assertEq(callResult.isError, true)
                const first = callResult.content[0]
                if (first === undefined || first.type !== 'text') {
                    throw ['expected a text content item', callResult]
                }
                const match = /run record: (\S+)\)/.exec(first.text)
                assert(match !== null, ['expected the error text to name a run record hash', first.text])
                const runHash = assertNotNullish(match[1], 'expected the run record hash capture group to be present')
                const runHashVec = cBase32ToVec(runHash)
                assert(runHashVec !== null, 'expected a decodable runHash')
                const [, runRead] = virtual(state1)(collectRead(cas.read(/** @type {Vec} */ (runHashVec))))
                assert(runRead[0] === 'ok', ['expected the run record to read back', runRead])
                const [vt, record] = validateRun(JSON.parse(utf8ToString(runRead[1])))
                assert(vt === 'ok', ['expected the record to validate', vt, record])
                if (vt === 'ok') {
                    // E1's own site: `args.subject !== undefined &&
                    // args.parents !== undefined` must stay `false` when
                    // only `subject` is supplied — an `||` mutation would
                    // make this `true` instead, since `subject` alone is
                    // truthy for its own half of the condition.
                    assertEq(record.pinned, false)
                    // `subject` is deliberately NOT persisted here. A
                    // half-supplied pin is an ordinary unpinned run, and a
                    // record that says `pinned: false` while naming a
                    // `subject` would name a subject the run was never pinned
                    // to — the review finding PR #38 closed. This assertion
                    // was written against the pre-#38 behaviour and now pins
                    // the corrected one; it also still kills the `||`
                    // mutation independently of the `pinned` check above,
                    // because under `||` the whole pin snapshot would be
                    // written and `subject` would come back set.
                    assertEq(record.subject, undefined)
                    assertEq(record.parents, undefined)
                }
            },
            // E11: the ok arm's `pinned` field, read back from a
            // PERSISTED record produced by a genuine `kind:'ok'` outcome.
            // `handleRunOutcome` is `fjsRunTool.handle`'s OWN post-outcome
            // logic (07-10's header: "unchanged, it now just delegates
            // here"), so calling it directly with a real ok outcome and a
            // `pinned: true` argument exercises the SAME record-assembly
            // code a real pinned success would run through — it just
            // reaches that code without the materialize/import round trip
            // an 'ok' outcome through `fjsRunTool.handle` itself cannot
            // complete under `virtual` (07-10).
            successfulRunRecordsPinnedTrueWhenTheCallActuallyPinned: () => {
                const home = '/pin-ok-arm'
                const cas = fileCas(sha256)(home)
                const [state0, cacheKey] = virtual(emptyState)(initEvo(cas))
                const e = evo(cas)(cacheKey)
                const programSource = 'export const report = ctx => args => ctx.pure("unused")'
                const [state1, programHash] = virtual(state0)(seedText(cas)(programSource))
                /** @type {Report<string>} */
                const trivialReport = ctx => () => ctx.step(ctx.evoList('false'), () => ctx.pure('pinned-ok-value'))
                const [state1b, outcome] = runExecuteRunViaFixture(home)(taxParamsFixture)(cas)(e)(programHash)(programSource)(trivialReport)([])(undefined)(state1)
                assert(outcome.kind === 'ok', ['expected an ok outcome', outcome])
                const pinFields = /** @type {{ readonly subject?: string, readonly parents?: readonly string[] }} */ ({ subject: 'pinnedSubject', parents: ['pinnedParent'] })
                const [state2, callResult] = virtual(state1b)(handleRunOutcome(cas)(programHash)([])(true)(pinFields)({ taxYear: 2025, paramSetHash: 'sha256-paramset1' })(outcome))
                assertEq(callResult.isError, undefined)
                const first = callResult.content[0]
                if (first === undefined || first.type !== 'text') {
                    throw ['expected a text content item', callResult]
                }
                const parsed = /** @type {{ readonly runHash: string }} */ (JSON.parse(first.text))
                const runHashVec = cBase32ToVec(parsed.runHash)
                assert(runHashVec !== null, 'expected a decodable runHash')
                const [, runRead] = virtual(state2)(collectRead(cas.read(/** @type {Vec} */ (runHashVec))))
                assert(runRead[0] === 'ok', ['expected the run record to read back', runRead])
                const [vt, record] = validateRun(JSON.parse(utf8ToString(runRead[1])))
                assert(vt === 'ok', ['expected the record to validate', vt, record])
                if (vt === 'ok') {
                    // E11's own site: the ok arm's `pinned` field must be
                    // the ACTUAL `pinned` argument (`true`, here) — a
                    // hardcoded `false` would flip this assertion.
                    assertEq(record.pinned, true)
                    assertEq(record.subject, 'pinnedSubject')
                    const parents = record.parents
                    assert(parents !== undefined, 'expected parents to be present on a pinned record')
                    if (parents !== undefined) {
                        assertEq(parents[0], 'pinnedParent')
                    }
                }
            },
        },
        // 09-07: what a run record claims about itself (E12, E14) —
        // `handleRunOutcome`'s own `inputs`/`args` fields, read back from a
        // PERSISTED record rather than trusted from the in-process value.
        recordIntegrity: {
            // E12: the error arm's `inputs` was hardcoded to `[]`. A
            // `RunOutcome`'s `kind:'error'` arm structurally permits a
            // non-empty `reads` (see `fjs/report/guard/module.f.js`'s own
            // typedef) even though every PRODUCTION error path in this
            // file's own `executeRun` currently discards it — this proof
            // constructs that outcome directly and asserts
            // `handleRunOutcome` still persists whatever `reads` it was
            // actually given, never a hardcoded empty array. The module's
            // own comment states the guarantee: "provenance that covers
            // only successes is not provenance."
            errorArmPersistsReadsObservedBeforeTheFailure: () => {
                const home = '/error-arm-inputs'
                const cas = fileCas(sha256)(home)
                /** @type {RunOutcome<unknown>} */
                const outcome = { kind: 'error', message: 'refused: fetch', reads: [['casRead', ['observed-before-failure-hash']]] }
                const [state1, callResult] = virtual(emptyState)(
                    handleRunOutcome(cas)('program-hash-error-arm-inputs')([])(false)({})({ taxYear: 2025, paramSetHash: 'sha256-paramset1' })(outcome))
                assertEq(callResult.isError, true)
                const first = callResult.content[0]
                if (first === undefined || first.type !== 'text') {
                    throw ['expected a text content item', callResult]
                }
                const match = /run record: (\S+)\)/.exec(first.text)
                assert(match !== null, ['expected the error text to name a run record hash', first.text])
                const runHash = assertNotNullish(match[1], 'expected the run record hash capture group to be present')
                const runHashVec = cBase32ToVec(runHash)
                assert(runHashVec !== null, 'expected a decodable runHash')
                const [, runRead] = virtual(state1)(collectRead(cas.read(/** @type {Vec} */ (runHashVec))))
                assert(runRead[0] === 'ok', ['expected the error run record to read back', runRead])
                const [vt, record] = validateRun(JSON.parse(utf8ToString(runRead[1])))
                assert(vt === 'ok', ['expected the error record to validate', vt, record])
                if (vt === 'ok') {
                    assert(
                        record.inputs.some(i => i.command === 'casRead' && i.payload[0] === 'observed-before-failure-hash'),
                        ['expected the error record to carry the read observed before the failure', record.inputs])
                }
            },
            // E14: the ok arm's `args` was hardcoded to `[]`. A
            // non-empty, distinctive args array so an empty-vs-populated
            // confusion cannot pass.
            okArmPersistsTheArgsActuallyPassedIn: () => {
                const home = '/ok-arm-args'
                const cas = fileCas(sha256)(home)
                const [state0, cacheKey] = virtual(emptyState)(initEvo(cas))
                const e = evo(cas)(cacheKey)
                const programSource = 'export const report = ctx => args => ctx.pure("unused")'
                const [state1, programHash] = virtual(state0)(seedText(cas)(programSource))
                /** @type {Report<string>} */
                const trivialReport = ctx => () => ctx.step(ctx.evoList('false'), () => ctx.pure('args-proof-value'))
                const [state1b, outcome] = runExecuteRunViaFixture(home)(taxParamsFixture)(cas)(e)(programHash)(programSource)(trivialReport)([])(undefined)(state1)
                assert(outcome.kind === 'ok', ['expected an ok outcome', outcome])
                const distinctiveArgs = ['distinctive-arg-alpha', 'distinctive-arg-beta']
                const [state2, callResult] = virtual(state1b)(handleRunOutcome(cas)(programHash)(distinctiveArgs)(false)({})({ taxYear: 2025, paramSetHash: 'sha256-paramset1' })(outcome))
                assertEq(callResult.isError, undefined)
                const first = callResult.content[0]
                if (first === undefined || first.type !== 'text') {
                    throw ['expected a text content item', callResult]
                }
                const parsed = /** @type {{ readonly runHash: string }} */ (JSON.parse(first.text))
                const runHashVec = cBase32ToVec(parsed.runHash)
                assert(runHashVec !== null, 'expected a decodable runHash')
                const [, runRead] = virtual(state2)(collectRead(cas.read(/** @type {Vec} */ (runHashVec))))
                assert(runRead[0] === 'ok', ['expected the run record to read back', runRead])
                const [vt, record] = validateRun(JSON.parse(utf8ToString(runRead[1])))
                assert(vt === 'ok', ['expected the record to validate', vt, record])
                if (vt === 'ok') {
                    assertEq(JSON.stringify(record.args), JSON.stringify(distinctiveArgs))
                }
            },
        },
        // EXEC-12, Success Criterion 4: three named failure classes, each
        // its own leaf so a regression localizes — a combined loop cannot
        // say WHICH class broke. Each leaf drives the FULL fjsRunTool.handle
        // (never executeRun/loadProgram in isolation — those are already
        // proven at their own layer, Plan 06 Task 1 and Phase 6
        // respectively) and asserts the returned ToolsCallResult's OWN
        // isError:true, plus that a status:'error' run record was
        // persisted and reads back (PROV-03: provenance that covers only
        // successes is not provenance).
        errorTaxonomy: {
            // Failure class 1: a guest program that refuses via a
            // non-`Error`, non-`CasOp` command. `interpret`'s own refusal
            // path (fjs/exec/module.f.js) reads the caught bare value
            // directly, never `instanceof Error` — this leaf proves that
            // refusal surfaces as fjsRunTool.handle's OWN isError:true.
            nonErrorThrowBecomesErrorResult: () => {
                const home = '/error-taxonomy-non-error-throw'
                const cas = fileCas(sha256)(home)
                const [state0, cacheKey] = virtual(emptyState)(initEvo(cas))
                const e = evo(cas)(cacheKey)
                const [state1, goodHash] = seedGoodProgram(cas)(state0)

                // The stored SOURCE is a clean, zero-import stand-in — the
                // JsModule fixture below is what actually runs, per the
                // module header's documented materialize-write/JsModule-at-
                // full-path split every proof in this file uses.
                const programSource = 'export const report = ctx => args => ctx.pure("unused")'
                const [state2, escapingHash] = virtual(state1)(seedText(cas)(programSource))
                /** @type {Report<string>} */
                const escapingReport = () => () => unsafeDo('fetch')('https://evil')

                // 07-10: decomposed via runExecuteRunViaFixture/
                // handleRunOutcome — a pre-placed fixture would otherwise
                // collide with executeRun's OWN real materialize-write at
                // the SAME path (see the module header), masking the
                // refusal this leaf exists to prove.
                const [state2b, outcome] = runExecuteRunViaFixture(home)(taxParamsFixture)(cas)(e)(escapingHash)(programSource)(escapingReport)([])(undefined)(state2)
                const [state3, callResult] = virtual(state2b)(handleRunOutcome(cas)(escapingHash)([])(false)({})({ taxYear: 2025, paramSetHash: 'sha256-paramset1' })(outcome))
                assertEq(callResult.isError, true)
                const first = callResult.content[0]
                if (first === undefined || first.type !== 'text') {
                    throw ['expected a text content item', callResult]
                }
                assert(first.text.includes('fetch'), ['expected the refused operation to be named', first.text])
                assertPersistedErrorRunRecord(cas)(state3)(first.text)

                // Session survives: a FOLLOWING call against the SAME
                // threaded state still succeeds — never a dropped
                // connection, not merely never a crash.
                assertSessionSurvivesAFollowingCall(home)(cas)(e)(state3)(goodHash)
            },
            // Failure class 2: a syntactically valid cBase32 hash that was
            // never written to THIS store — the genuine CAS-miss branch
            // (`collectRead(cas.read(...))` failing), distinct from
            // executeRun's own already-proven malformed-hash branch
            // (07-06's missingHashShortCircuitsBeforeMaterializeOrInterpret,
            // which never even reaches cas.read).
            missingHashBecomesErrorResult: () => {
                const home = '/error-taxonomy-missing-hash'
                const cas = fileCas(sha256)(home)
                const [state0, cacheKey] = virtual(emptyState)(initEvo(cas))
                const e = evo(cas)(cacheKey)
                const [state1, goodHash] = seedGoodProgram(cas)(state0)
                const missingHash = vecToCBase32(vec8(0xabn))

                const [state2, callResult] = virtual(state1)(
                    fjsRunTool(home)(cas)(e).handle({ hash: missingHash, taxYear: 2025 }))
                assertEq(callResult.isError, true)
                const first = callResult.content[0]
                if (first === undefined || first.type !== 'text') {
                    throw ['expected a text content item', callResult]
                }
                assert(first.text.includes(missingHash), ['expected the missing hash to be named', first.text])
                assertPersistedErrorRunRecord(cas)(state2)(first.text)

                // Materialization was never attempted: a real behavioral
                // check against the SAME virtual Fs materializeProgram
                // itself writes through (readUtf8File at the exact path
                // materializeProgram would have used), not an inference
                // from the returned message text alone.
                const [, readAttempt] = virtual(state2)(
                    readUtf8File(programPath(materializeHome(home))(missingHash)))
                assertEq(readAttempt[0], 'error')

                // Session survives: a FOLLOWING call against the SAME
                // threaded state still succeeds.
                assertSessionSurvivesAFollowingCall(home)(cas)(e)(state2)(goodHash)
            },
            // Failure class 3: a program whose stored SOURCE is clean (zero
            // imports, so checkSpecifiers passes) and whose bytes ARE
            // materialized for real by executeRun — but with NO JsModule
            // fixture placed at its full materialize path, reusing Phase
            // 6's own `underVirtual.missingModuleIsAnErrorValue` technique
            // (fjs/guest/materialize/module.f.js) at the fjsRunTool layer.
            // This exercises loadProgram's OWN `import_` effect actually
            // failing — a genuinely different failure than the dirty-
            // specifier leaf 07-06 already proves at the executeRun layer
            // (that one fails checkSpecifiers before import_ ever runs).
            importFailureBecomesErrorResult: () => {
                const home = '/error-taxonomy-import-failure'
                const cas = fileCas(sha256)(home)
                const [state0, cacheKey] = virtual(emptyState)(initEvo(cas))
                const e = evo(cas)(cacheKey)
                const [state1, goodHash] = seedGoodProgram(cas)(state0)

                const [state2, unimportableHash] = virtual(state1)(
                    seedText(cas)('export const report = ctx => args => ctx.pure("unused")'))
                // Deliberately no fixture placed at
                // `programPath(materializeHome(home))(unimportableHash)` —
                // the whole point of this leaf.

                const [state3, callResult] = virtual(state2)(
                    fjsRunTool(home)(cas)(e).handle({ hash: unimportableHash, taxYear: 2025 }))
                assertEq(callResult.isError, true)
                const first = callResult.content[0]
                if (first === undefined || first.type !== 'text') {
                    throw ['expected a text content item', callResult]
                }
                assert(first.text.includes('import failed'), ['expected an import failure to be named', first.text])
                assertPersistedErrorRunRecord(cas)(state3)(first.text)

                // Session survives: a FOLLOWING call against the SAME
                // threaded state still succeeds.
                assertSessionSurvivesAFollowingCall(home)(cas)(e)(state3)(goodHash)
            },
        },
    },

    // ── PROV-04: taxYear is required and validated ────────────────────────
    taxYearHandling: {
        // `toolEntry`'s own RTTI check refuses a call missing `taxYear`
        // before the handler ever runs — the handler's own unknown-year
        // lookup never executes.
        missingTaxYearRejectedByToolEntry: () => {
            const home = '/tax-year-missing'
            const cas = fileCas(sha256)(home)
            const [state0, cacheKey] = virtual(emptyState)(initEvo(cas))
            const e = evo(cas)(cacheKey)
            const [, callResult] = virtual(state0)(
                fjsRunTool(home)(cas)(e).handle({ hash: 'not-a-real-hash' }))
            assertEq(callResult.isError, true)
            const first = callResult.content[0]
            if (first === undefined || first.type !== 'text') {
                throw ['expected a text content item', callResult]
            }
            assert(first.text.includes('invalid arguments'), ['expected toolEntry\'s own RTTI refusal', first.text])
        },
        // An unknown `taxYear` is refused by name, before executeRun is
        // ever called — never a throw, mirroring finance_tax_params's own
        // unknown-year refusal shape.
        unknownTaxYearRefused: () => {
            const home = '/tax-year-unknown'
            const cas = fileCas(sha256)(home)
            const [state0, cacheKey] = virtual(emptyState)(initEvo(cas))
            const e = evo(cas)(cacheKey)
            const [, callResult] = virtual(state0)(
                fjsRunTool(home)(cas)(e).handle({ hash: 'not-a-real-hash', taxYear: 1999 }))
            assertEq(callResult.isError, true)
            const first = callResult.content[0]
            if (first === undefined || first.type !== 'text') {
                throw ['expected a text content item', callResult]
            }
            assert(first.text.includes('1999'), ['expected the offending year to be named', first.text])
            assert(first.text.includes('2025'), ['expected the known set to be named', first.text])
        },
    },

    // ── PROV-07's decisive proof: zero observed reads becomes an error ───
    zeroReadGate: {
        // A purpose-built zero-read report — distinct from Plan 09-04's own
        // verbatim `() => pure({ line16: 9137 })` adversary fixture — proves
        // the gate itself: a report that dispatches NO CAS/Evo read is
        // refused as an error result, never returned as a silent 'ok'.
        zeroReadOutcomeBecomesAnErrorResult: () => {
            const home = '/zero-read-gate'
            const cas = fileCas(sha256)(home)
            const [state0, cacheKey] = virtual(emptyState)(initEvo(cas))
            const e = evo(cas)(cacheKey)
            const programSource = 'export const report = ctx => args => ctx.pure("unused")'
            const [state1, programHash] = virtual(state0)(seedText(cas)(programSource))
            /** @type {Report<string>} */
            const zeroReadReport = ctx => () => ctx.pure('unused')

            const [state1b, outcome] = runExecuteRunViaFixture(home)(taxParamsFixture)(cas)(e)(programHash)(programSource)(zeroReadReport)([])(undefined)(state1)
            assertEq(outcome.kind, 'error')

            const [state2, callResult] = virtual(state1b)(handleRunOutcome(cas)(programHash)([])(false)({})({ taxYear: 2025, paramSetHash: 'sha256-paramset1' })(outcome))
            assertEq(callResult.isError, true)
            const first = callResult.content[0]
            if (first === undefined || first.type !== 'text') {
                throw ['expected a text content item', callResult]
            }
            assert(first.text.includes('zero observed reads'), ['expected the zero-read refusal named', first.text])
            assertPersistedErrorRunRecord(cas)(state2)(first.text)
        },
    },

    // ── PROV-07's size-guard proof: the two new fields stay well clear ───
    sizeGuard: {
        // A maximal-length preview (previewBytes bytes of a repeated
        // single-byte character) plus the two new integer fields, measured
        // via the SAME tryUtf8 + bit_vec length sizeGuard itself uses (never
        // content.length), stays strictly under guardBytes (64 KiB) — proof
        // that readCount/literalCount cannot push a maximal-preview response
        // anywhere near the guard.
        newFieldsStayWellClearOfTheGuard: () => {
            const preview = 'x'.repeat(previewBytes)
            const envelope = JSON.stringify({
                resultHash: 'a'.repeat(64),
                runHash: 'b'.repeat(64),
                preview,
                truncated: true,
                readCount: 999999,
                literalCount: 999999,
                taxYear: 999999,
                paramSetHash: 'c'.repeat(64),
                programHash: 'd'.repeat(64),
                reviewedEstimateFraming,
            })
            const encoded = tryUtf8(envelope)
            assert(encoded !== null, ['expected the envelope to encode as UTF-8', envelope])
            const bytes = bitLength(encoded) / 8n
            assert(
                bytes < BigInt(guardBytes),
                ['expected the ten-key envelope to stay well clear of guardBytes', bytes, guardBytes])
        },
    },

    // ── PROV-07/Plan 09-04: the perturbation gate, and the verbatim
    // adversary ROADMAP criterion 4 names ───────────────────────────────────
    //
    // A gate built against an adversary it is never actually run against is a
    // claim, not a proof (09-CONTEXT.md). This section runs the decisive
    // comparison both ways: a real, minimal ReportLine-shaped program whose
    // output MOVES when a stored document changes (the leaf above), and the
    // exact adversary `() => pure({ line16: 9137 })`, written verbatim, whose
    // failure does NOT move under the identical perturbation (the leaf
    // below, `hardcodedAdversaryFailsAndIsInvariantToInputChange`) — the
    // control that makes the assertion about the gate itself rather than
    // about a fixture that would have moved regardless (STATE.md's Phase-6
    // lesson).
    antiHardcodingGate: {
        // The real leg: seed one document, run a minimal program that reads
        // it and returns a ReportLine-shaped value, change the document,
        // run again, and assert the output moved.
        realProgramOutputMovesWhenTheInputDocumentChanges: () => {
            const home = '/perturbation'
            const cas = fileCas(sha256)(home)
            const [state0, cacheKey] = virtual(emptyState)(initEvo(cas))
            const e = evo(cas)(cacheKey)
            const subject = 'perturbation-subject'

            const [state1, docHash1] = virtual(state0)(seedText(cas)('{"box1InterestIncome":"10.00"}'))
            const [state2, addResult1] = virtual(state1)(e.add({ parents: [], subject, snapshot: docHash1 }))
            assert(addResult1[0] === 'ok', ['expected the first revision add to succeed', addResult1])
            const rev1 = addResult1[1]

            // The program's OWN stored source: zero imports, so
            // checkSpecifiers passes. Its actual text is otherwise
            // irrelevant to this proof — the loaded module comes from the
            // JsModule fixture below, not from parsing this text.
            const programSource = 'export const report = ctx => args => ctx.pure("unused")'
            const [state3, programHash] = virtual(state2)(seedText(cas)(programSource))

            // The smallest possible demonstration reading one real stored
            // document: subject's head -> revision -> snapshot ->
            // box1InterestIncome, the SAME chain
            // multiDocumentSumAcrossTwoStoredDocuments (above) already
            // establishes — then a value type-annotated against Plan
            // 09-01's own ReportLine, projected to its JSON-safe wire form
            // (never JSON.stringify on a bare bigint, EXACT-05).
            /** @type {Report<string>} */
            const demoReport = ctx => () => ctx.step(ctx.evoHead(subject), headsJson => {
                const heads = /** @type {readonly string[]} */ (JSON.parse(headsJson))
                const headHash = assertNotNullish(heads[0], ['expected at least one head for the perturbation subject', subject])
                return ctx.step(ctx.evoRevision(headHash), revJson => {
                    const rev = /** @type {{ readonly snapshot: string }} */ (JSON.parse(revJson))
                    return ctx.step(ctx.casRead(rev.snapshot), docJson => {
                        const doc = /** @type {{ readonly box1InterestIncome: string }} */ (JSON.parse(docJson))
                        const raw = doc.box1InterestIncome
                        /** @type {ReportLine} */
                        const line = {
                            value: ctx.centsFromString(raw),
                            sources: [{ documentHash: rev.snapshot, boxPath: 'box1InterestIncome', value: raw }],
                            rule: '1040 line 2b',
                        }
                        return ctx.pure(JSON.stringify({ value: ctx.centsToString(line.value), sources: line.sources, rule: line.rule }))
                    })
                })
            })

            const [state4, outcome1] = runExecuteRunViaFixture(home)(taxParamsFixture)(cas)(e)(programHash)(programSource)(demoReport)([])(undefined)(state3)
            assert(outcome1.kind === 'ok', ['expected the first run to succeed', outcome1])
            if (outcome1.kind === 'ok') {
                const parsed1 = /** @type {{ readonly value: string, readonly sources: readonly [{ readonly documentHash: string, readonly boxPath: string, readonly value: string }], readonly rule: string }} */ (JSON.parse(String(outcome1.value)))
                assertEq(parsed1.value, '10.00')
                assertEq(parsed1.sources[0].boxPath, 'box1InterestIncome')
                assertEq(parsed1.sources[0].documentHash, docHash1)
                assertEq(parsed1.rule, '1040 line 2b')
            }

            // Perturb: a second revision naming rev1 as its parent becomes
            // the subject's SOLE live head (headsOf's own rule, fjs/cas/evo/
            // module.f.js: a hash filtered out of `hashes` once it appears
            // in another revision's `parents`).
            const [state5, docHash2] = virtual(state4)(seedText(cas)('{"box1InterestIncome":"20.00"}'))
            const [state6, addResult2] = virtual(state5)(e.add({ parents: [rev1], subject, snapshot: docHash2 }))
            assert(addResult2[0] === 'ok', ['expected the second revision add to succeed', addResult2])

            // A second, functionally-identical program hash for the SECOND
            // run: the SAME demoReport JsModule fixture is what actually
            // executes either time (07-10's established materialize-write/
            // JsModule-at-full-path split — the loaded module comes from the
            // fixture, never from parsing this stored text). The stored
            // source only needs one harmless extra byte to hash differently,
            // because the first run's real materialize write already
            // swapped the FIRST hash's path from raw bytes to a JsModule
            // function — a second real write to that SAME path would
            // collide (writeFile refuses a target that already holds
            // anything other than an array,
            // fjs/effects/node/virtual/module.f.js) — so the second run
            // targets its own, fresh path instead.
            const [state6b, programHash2] = virtual(state6)(seedText(cas)(programSource + '\n'))

            const [, outcome2] = runExecuteRunViaFixture(home)(taxParamsFixture)(cas)(e)(programHash2)(programSource + '\n')(demoReport)([])(undefined)(state6b)
            assert(outcome2.kind === 'ok', ['expected the second run to succeed', outcome2])
            if (outcome2.kind === 'ok') {
                const parsed2 = /** @type {{ readonly value: string, readonly sources: readonly [{ readonly documentHash: string, readonly boxPath: string, readonly value: string }], readonly rule: string }} */ (JSON.parse(String(outcome2.value)))
                // "The output moved" — a real input changed and the
                // program's own returned value strictly differs.
                assertEq(parsed2.value, '20.00')
                assert(parsed2.value !== '10.00', ['expected the output to move when the input document changed', parsed2])
                assertEq(parsed2.sources[0].documentHash, docHash2)
            }
        },

        // The control leg: the exact adversary ROADMAP criterion 4 names,
        // written verbatim, run against the state BEFORE and AFTER the
        // identical perturbation the real leg above applies — proven to
        // fail both times, with an IDENTICAL message, because it never
        // reads the document at all.
        hardcodedAdversaryFailsAndIsInvariantToInputChange: () => {
            const home = '/adversary-perturbation'
            const cas = fileCas(sha256)(home)
            const [state0, cacheKey] = virtual(emptyState)(initEvo(cas))
            const e = evo(cas)(cacheKey)
            const subject = 'adversary-subject'

            // Even though the adversary never reads it, the control needs a
            // real document to perturb — the SAME perturbation the real leg
            // above applies.
            const [state1, docHash1] = virtual(state0)(seedText(cas)('{"box1InterestIncome":"10.00"}'))
            const [state2, addResult1] = virtual(state1)(e.add({ parents: [], subject, snapshot: docHash1 }))
            assert(addResult1[0] === 'ok', ['expected the first revision add to succeed', addResult1])
            const rev1 = addResult1[1]

            // The adversary's stored source text, written VERBATIM —
            // 09-CONTEXT.md's own quoted phrase, adapted only by the
            // unavoidable `ctx.` prefix (a stored program has zero imports,
            // EXEC-07, and cannot reach a bare `pure` any other way).
            const adversarySource = 'export const report = ctx => () => ctx.pure({ line16: 9137 })'
            const [state3, adversaryHash] = virtual(state2)(seedText(cas)(adversarySource))
            /** @type {Report<{ readonly line16: number }>} */
            const adversaryReport = ctx => () => ctx.pure({ line16: 9137 })

            const [state4, outcome1] = runExecuteRunViaFixture(home)(taxParamsFixture)(cas)(e)(adversaryHash)(adversarySource)(adversaryReport)([])(undefined)(state3)
            assert(outcome1.kind === 'error', ['expected the verbatim adversary to be refused', outcome1])
            // The literal count is computed by calling countNumericLiterals
            // directly on this exact adversary source — never hand-computed
            // — so the assertion cannot silently drift from the audit's own
            // logic.
            const expectedLiteralCount = countNumericLiterals(adversarySource)
            if (outcome1.kind === 'error') {
                assert(outcome1.message.includes('zero observed reads'), ['expected the zero-read refusal', outcome1.message])
                assert(
                    outcome1.message.includes(`${expectedLiteralCount} numeric literal`),
                    ['expected the literal count named in the refusal', outcome1.message, expectedLiteralCount])
            }

            // Perturb the SAME document exactly as the real leg does.
            const [state5, docHash2] = virtual(state4)(seedText(cas)('{"box1InterestIncome":"20.00"}'))
            const [state6, addResult2] = virtual(state5)(e.add({ parents: [rev1], subject, snapshot: docHash2 }))
            assert(addResult2[0] === 'ok', ['expected the second revision add to succeed', addResult2])

            // A second, functionally-identical adversary hash for the
            // SECOND run — same reasoning as the real leg above: the first
            // run's real materialize write already swapped the FIRST hash's
            // path from raw bytes to a JsModule function, so a second real
            // write to that SAME path would collide. One harmless extra
            // byte on the stored source (never on `adversarySource` itself,
            // which stays exactly verbatim) gives the second run its own
            // fresh path; `countNumericLiterals` still counts the SAME one
            // literal either way, so the control's identical-message
            // assertion below is unaffected.
            const [state6b, adversaryHash2] = virtual(state6)(seedText(cas)(adversarySource + '\n'))

            const [state7, outcome2] = runExecuteRunViaFixture(home)(taxParamsFixture)(cas)(e)(adversaryHash2)(adversarySource + '\n')(adversaryReport)([])(undefined)(state6b)
            assert(outcome2.kind === 'error', ['expected the verbatim adversary to be refused again', outcome2])
            // The control: the document changed; the adversary's outcome
            // did not, character for character, because it never read the
            // document at all. This is what makes the assertion about the
            // gate rather than about a fixture that would have moved
            // anyway.
            if (outcome1.kind === 'error' && outcome2.kind === 'error') {
                assertEq(outcome2.message, outcome1.message)
            }

            // PROV-03: provenance that covers only successes is not
            // provenance — a status:'error' run record is still persisted
            // for a zero-read refusal.
            const [state8, callResult] = virtual(state7)(handleRunOutcome(cas)(adversaryHash)([])(false)({})({ taxYear: 2025, paramSetHash: 'sha256-paramset1' })(outcome2))
            assertEq(callResult.isError, true)
            const first = callResult.content[0]
            if (first === undefined || first.type !== 'text') {
                throw ['expected a text content item', callResult]
            }
            assertPersistedErrorRunRecord(cas)(state8)(first.text)
        },
    },
}
