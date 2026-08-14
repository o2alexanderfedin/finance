/**
 * `vnd.fjs.run` — PROV-03: the persisted record of one `fjs_run` invocation.
 *
 * **This is a dialect, not a bespoke record shape.** 07-CONTEXT.md's decision
 * is explicit: follow `fjs/media/revision` / `fjs/document/1099int`'s
 * precedent exactly — tag `vnd.fjs.run`, media type
 * `application/vnd.fjs.run+json` derived mechanically, the dialect spread
 * first via `base` (so structural validation reports it as the first
 * failing field on a mismatched blob, same as every other document dialect),
 * and validation split structural (RTTI) / semantic (`checkReferences`). A
 * run record sits in the same CAS as every other stored document and reads
 * back through the same `finance_schema`/dialect-detection machinery — giving
 * it a parallel, one-off shape outside that system would mean two things to
 * maintain where one already exists.
 *
 * **`inputs[]` is populated exclusively from `interpret`'s OBSERVED reads,
 * never from a program's own declared citation list.** `fjs/exec`'s
 * `interpret` returns `Result<[T, readonly Read[]], string>` where
 * `Read = readonly [string, readonly unknown[]]` is the command and payload
 * *actually dispatched*, appended only after a dispatch succeeds (EXEC-05).
 * This module's schema shapes `inputs[]` entries as exactly
 * `{ command, payload }` and nothing else — no `cited` flag, no free-form
 * metadata — so there is no field for a program's own citation list to reach.
 * This is an invariant for whoever calls this module's `validate`/writes a
 * record later (Plan 06's handler): populate `inputs[]` from the `Read[]`
 * `interpret` returns, never from anything the guest program itself claims
 * to have read. `checkReferences` below narrows `inputs[].command` to the
 * frozen four (`casOpNames`, from `fjs/guest`) as the read-back-time backstop
 * — a hand-crafted or corrupted record naming a command outside that set is
 * rejected on read-back, closing T-07-02-01.
 *
 * **`status` is exactly `'ok' | 'error'`, mirroring `Result`'s two arms.** A
 * richer enum (`refused`/`crashed`/`budget`) was rejected in 07-CONTEXT.md:
 * the distinguishing detail belongs in the `error` message, and a two-arm
 * status keeps the record aligned with the `Result` the interpreter actually
 * returns. A failed run still gets a record (`status: 'error'`) — provenance
 * that covers only successes is not provenance, and `checkReferences` below
 * enforces the cross-field consistency this implies: an `ok` record always
 * has a `resultHash` and never an `error`; an `error` record always has an
 * `error` message and never a `resultHash` (T-07-02-02) — a record cannot
 * claim both an answer and a failure.
 *
 * **No field here stores a computed monetary figure as anything but a
 * hash/string.** `resultHash` names where the actual result lives in CAS;
 * EXACT-05's decimal-string wire rule is not re-litigated in this file
 * because this record carries no numeric value directly — the money lives in
 * the document dialects (`1099int`, `w2`, …) and in the CAS-stored result
 * blob `resultHash` points at, not here.
 *
 * @module
 */
import { array, boolean, number, option, or, string } from 'functionalscript/fjs/types/rtti/module.f.js'
import { validate as rttiValidate } from 'functionalscript/fjs/types/rtti/validate/module.f.js'
import { error, ok } from 'functionalscript/fjs/types/result/module.f.js'
import { assert, assertEq } from 'functionalscript/fjs/asserts/module.f.js'
import { base, mediaTypeOf } from '../document/base/module.f.js'
import { casOpNames } from '../guest/module.f.js'

/** @import { Result } from 'functionalscript/fjs/types/result/module.f.js' */
/** @import { Ts, Unknown } from 'functionalscript/fjs/types/rtti/ts/module.f.js' */
/** @import { ValidationError } from 'functionalscript/fjs/types/rtti/validate/module.f.js' */

/**
 * Format tag: names the dialect of this BLOB. The media type it is served
 * with is derived mechanically: `application/` + `dialect` + `+json`.
 */
export const dialect = 'vnd.fjs.run'
/** The media type derived from {@link dialect}: `application/vnd.fjs.run+json`. */
export const mediaType = mediaTypeOf(dialect)

/**
 * One command `interpret` actually dispatched while running the program,
 * carried straight from `fjs/exec`'s `Read` tuple (`readonly [string,
 * readonly unknown[]]`) into a named struct. `payload` is modelled as
 * `array(string)` (not `array(unknown)`) because every one of the frozen
 * four commands (`fjs/guest`'s `CasOp`) takes a single string argument —
 * matching the actual shape observed reads carry, not a wider placeholder.
 */
const inputEntry = /** @type {const} */ ({
    command: string,
    payload: array(string),
})

/**
 * rtti schema for a `run` BLOB. `dialect` is spread first (via `base`) so
 * structural validation reports it as the first failing field on a
 * mismatched blob (DOC-00's discriminant, same guarantee every other
 * document dialect gets).
 *
 * - `programHash`/`args` — the program identity and invocation the record
 *   is *about*; non-empty `programHash` is a semantic check (below), since
 *   RTTI's `string` alone accepts `''`.
 * - `taxYear`/`paramSetHash` — PROV-04's provenance header: which tax year's
 *   parameters, and a content hash of that exact parameter set
 *   (`fjs/report/provenance/module.f.js`'s `paramSetHash`), were in effect
 *   for this run. Both REQUIRED — every run, pinned or not, ok or error,
 *   carries this header, mirroring `pinned`'s own "every run gets a record"
 *   rule immediately below.
 * - `pinned` — EXEC-08/07-CONTEXT.md: every run, pinned or not, gets a
 *   record with this flag; refusing unpinned runs would implement a later
 *   (T2) requirement early.
 * - `subject`/`parents` — `option`, since an unpinned or subject-less run
 *   has neither a resolved subject nor a parent-revision snapshot to record.
 * - `status` — exactly the two-arm union described in the module docstring.
 * - `inputs` — the observed read set; see the module docstring for the
 *   observed-not-declared invariant this field exists to carry.
 * - `resultHash`/`error` — `option`, cross-field-constrained by `status` in
 *   `checkReferences` below (RTTI alone cannot express "present iff X").
 */
export const runSchema = /** @type {const} */ ({
    ...base(dialect),
    programHash: string,
    args: array(string),
    taxYear: number,
    paramSetHash: string,
    pinned: boolean,
    subject: option(string),
    parents: option(array(string)),
    status: or('ok', 'error'),
    inputs: array(inputEntry),
    resultHash: option(string),
    error: option(string),
})

/** @typedef {Ts<typeof runSchema>} Run */

/** Structural-only validator: checks the shape, not the semantic refinements below. */
const validateShape = rttiValidate(runSchema)

/**
 * Either a structural validation error or a semantic (string) error message.
 * @typedef {ValidationError | string} RunError
 */

/**
 * Checks the semantic refinements the structural schema can't express on an
 * already shape-valid `run` value:
 * - `programHash` (trimmed) must not be empty — a run record with nothing to
 *   identify the program is not a usable record.
 * - Every `inputs[].command` must be one of `casOpNames` (`fjs/guest`'s
 *   frozen four) — T-07-02-01: an unrecognized command name means this
 *   record was hand-crafted or corrupted, since a genuine run can never have
 *   observed a command outside that set.
 * - `pinned` must agree with `subject`/`parents`: both present when it is
 *   `true`, both absent when it is `false`. `runSchema`'s own docstring
 *   already states this ("an unpinned or subject-less run has neither a
 *   resolved subject nor a parent-revision snapshot to record"), and without
 *   the check a record could name the subject a run was *about* while
 *   recording that the run was never pinned to it — a reader cannot tell such
 *   a record from a genuinely pinned one by looking at `subject` alone. The
 *   `status` rule below is the same kind of check; this one was missing.
 * - If `status === 'ok'`: `resultHash` must be present (non-empty) and
 *   `error` must be absent.
 * - If `status === 'error'`: `error` must be present (non-empty) and
 *   `resultHash` must be absent.
 *   (T-07-02-02: a record cannot claim both an answer and a failure.)
 * @type {(r: Run) => Result<Run, RunError>}
 */
export const checkReferences = r => {
    if (r.programHash.trim() === '') {
        return error('programHash must not be empty or whitespace-only')
    }
    for (const input of r.inputs) {
        if (!casOpNames.includes(input.command)) {
            return error(`inputs[].command is not one of the frozen four: ${input.command}`)
        }
    }
    if (r.pinned) {
        if (r.subject === undefined || r.parents === undefined) {
            return error('a pinned run record must have both subject and parents')
        }
    } else if (r.subject !== undefined || r.parents !== undefined) {
        return error('an unpinned run record must have neither subject nor parents')
    }
    if (r.status === 'ok') {
        if (r.resultHash === undefined || r.resultHash.trim() === '') {
            return error('an ok run record must have a non-empty resultHash')
        }
        if (r.error !== undefined) {
            return error('an ok run record must not have an error field')
        }
    } else {
        if (r.error === undefined || r.error.trim() === '') {
            return error('an error run record must have a non-empty error message')
        }
        if (r.resultHash !== undefined) {
            return error('an error run record must not have a resultHash')
        }
    }
    return ok(r)
}

/**
 * Validates an already-parsed JSON value as a `run` BLOB: structural (rtti)
 * validation followed by the semantic checks in {@link checkReferences}.
 * Same composed shape as every other document dialect's `validate`.
 * @type {(value: Unknown) => Result<Run, RunError>}
 */
export const validate = value => {
    const [t, v] = validateShape(value)
    if (t === 'error') {
        return error(v)
    }
    return checkReferences(v)
}

// ── Tests ────────────────────────────────────────────────────────────────────

/** @type {Run} */
const minimalOk = {
    dialect,
    programHash: 'sha256-program1',
    args: [],
    taxYear: 2025,
    paramSetHash: 'sha256-paramset1',
    pinned: false,
    status: 'ok',
    inputs: [],
    resultHash: 'sha256-result1',
}

/** @type {Run} */
const minimalError = {
    dialect,
    programHash: 'sha256-program1',
    args: [],
    taxYear: 2025,
    paramSetHash: 'sha256-paramset1',
    pinned: false,
    status: 'error',
    inputs: [],
    error: 'refused: operation not permitted: fetch',
}

export const proof = {
    dialectAndMediaType: () => {
        assertEq(dialect, 'vnd.fjs.run')
        assertEq(mediaType, 'application/vnd.fjs.run+json')
    },
    // Spread-order proof, mirroring `base`'s own `spreadOrder` proof: `dialect`
    // is `runSchema`'s first key, the property `checkReferences.wrongDialectRejected`-
    // style proofs across every other dialect depend on.
    runSchemaSpreadsDialectFirst: () => {
        assertEq(Object.keys(runSchema)[0], 'dialect')
    },
    validate: {
        fullyPopulatedOkValidates: () => {
            /** @type {Run} */
            const r = {
                ...minimalOk,
                args: ['2024'],
                pinned: true,
                subject: 'form:1099int:11-1111111:222-22-2222:ACC-0001:2024',
                parents: ['sha256-parent1'],
                inputs: [
                    { command: 'casRead', payload: ['doc-a'] },
                    { command: 'evoHead', payload: ['subject-b'] },
                ],
            }
            const [t, v] = validate(r)
            assert(t === 'ok', ['expected ok', t, v])
        },
        fullyPopulatedErrorValidates: () => {
            /** @type {Run} */
            const r = {
                ...minimalError,
                args: ['2024'],
                pinned: true,
                subject: 'form:1099int:11-1111111:222-22-2222:ACC-0001:2024',
                parents: ['sha256-parent1'],
                inputs: [{ command: 'evoList', payload: ['active'] }],
            }
            const [t, v] = validate(r)
            assert(t === 'ok', ['expected ok', t, v])
        },
        // Wrong dialect: structural rejection, `dialect` first — same
        // guarantee every other document dialect gets from `base`.
        wrongDialectRejected: () => {
            const [t, v] = validate({ ...minimalOk, dialect: 'vnd.fjs.wrong' })
            assertEq(t, 'error')
            if (t !== 'error') {
                throw ['expected error', t, v]
            }
            if (typeof v === 'string') {
                throw ['expected a structural ValidationError, got a checkReferences string', v]
            }
            assertEq(v.path[0], 'dialect')
        },
    },
    checkReferences: {
        // Task 1 acceptance criterion: empty `programHash` (the identity of
        // the record) is rejected — a record naming no program is unusable.
        emptyProgramHashRejected: () => {
            const [t] = validate({ ...minimalOk, programHash: '' })
            assertEq(t, 'error')
        },
        // Task 1 acceptance criterion: `inputs[0].command === 'fetch'` is not
        // one of the frozen four and is rejected — T-07-02-01's read-back
        // backstop.
        unrecognizedInputsCommandRejected: () => {
            const [t] = validate({ ...minimalOk, inputs: [{ command: 'fetch', payload: ['https://evil'] }] })
            assertEq(t, 'error')
        },
        // Task 1 acceptance criterion: `status: 'ok'` with NO `resultHash`
        // is rejected — an ok record must point at an answer.
        okWithoutResultHashRejected: () => {
            const { resultHash: _resultHash, ...withoutResultHash } = minimalOk
            const [t] = validate(withoutResultHash)
            assertEq(t, 'error')
        },
        // Task 1 acceptance criterion: `status: 'error'` with `resultHash`
        // present is rejected — a failed run cannot also point at an answer
        // (T-07-02-02).
        errorWithResultHashRejected: () => {
            const [t] = validate({ ...minimalError, resultHash: 'sha256-result1' })
            assertEq(t, 'error')
        },
        // Behavior spec (symmetric to the previous case): `status: 'error'`
        // with NO `error` message is rejected — a failed run must say why.
        errorWithoutErrorMessageRejected: () => {
            const { error: _errorField, ...withoutError } = minimalError
            const [t] = validate(withoutError)
            assertEq(t, 'error')
        },
        // Bonus (belt-and-suspenders, not separately named in Task 1's
        // acceptance criteria, but implied by the same cross-field rule): an
        // `ok` record carrying an `error` field is also rejected — a record
        // cannot claim both an answer and a failure, in either direction.
        okWithErrorFieldRejected: () => {
            const [t] = validate({ ...minimalOk, error: 'should not be here' })
            assertEq(t, 'error')
        },
        // `pinned` and `subject`/`parents` must agree, in both directions —
        // the same kind of cross-field rule `status` already had. Without it a
        // record could name the subject a run was *about* while recording that
        // the run was never pinned to it, and no reader could tell that record
        // from a genuinely pinned one.
        unpinnedWithSubjectRejected: () => {
            const [t] = validate({ ...minimalOk, pinned: false, subject: 'form:1099int:11-1111111:222-22-2222:ACC-0001:2024' })
            assertEq(t, 'error')
        },
        unpinnedWithParentsRejected: () => {
            const [t] = validate({ ...minimalOk, pinned: false, parents: ['sha256-parent1'] })
            assertEq(t, 'error')
        },
        pinnedWithoutSubjectRejected: () => {
            const [t] = validate({ ...minimalOk, pinned: true, parents: ['sha256-parent1'] })
            assertEq(t, 'error')
        },
        pinnedWithoutParentsRejected: () => {
            const [t] = validate({ ...minimalOk, pinned: true, subject: 'form:1099int:11-1111111:222-22-2222:ACC-0001:2024' })
            assertEq(t, 'error')
        },
        // The two consistent shapes still pass, so the rule above is a
        // constraint and not a blanket refusal.
        pinnedWithBothAccepted: () => {
            const [t] = validate({
                ...minimalOk,
                pinned: true,
                subject: 'form:1099int:11-1111111:222-22-2222:ACC-0001:2024',
                parents: ['sha256-parent1'],
            })
            assertEq(t, 'ok')
        },
        canonicalOkAccepted: () => {
            const [t] = validate(minimalOk)
            assertEq(t, 'ok')
        },
        canonicalErrorAccepted: () => {
            const [t] = validate(minimalError)
            assertEq(t, 'ok')
        },
    },
    // Cross-dialect proof, mirroring `1099int`'s own `crossDialect` leaves —
    // reuses the same discriminant-first guarantee DOC-00 established.
    crossDialect: {
        // A fully-valid `vnd.fjs.1099int` value, constructed as a parsed JS
        // object (never a JSON string — proves rejection is structural, not
        // text/prefix-based), fails `vnd.fjs.run`'s `validate`, and the
        // failure's `path` is exactly `['dialect']`.
        oneZeroNineNineIntShapeRejectedByRun: () => {
            const oneZeroNineNineIntValue = {
                dialect: 'vnd.fjs.1099int',
                payerTin: '11-1111111',
                recipientTin: '222-22-2222',
                accountNumber: 'ACC-0001',
                taxYear: 2024,
                formRevision: '2024',
            }
            const [t, v] = validate(oneZeroNineNineIntValue)
            assertEq(t, 'error')
            if (t !== 'error') {
                throw ['expected error', t, v]
            }
            if (typeof v === 'string') {
                throw ['expected a structural ValidationError, got a checkReferences string', v]
            }
            assertEq(v.path.length, 1)
            assertEq(v.path[0], 'dialect')
        },
    },
}
