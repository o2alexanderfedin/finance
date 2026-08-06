---
phase: 07-fjs-run-run-records-and-the-week-1-convergence
plan: 02
subsystem: document-dialect
tags: [fjs-run, document-dialect, functionalscript, rtti, provenance]

# Dependency graph
requires:
  - phase: 06-guest-abi-freeze-and-safe-materialization
    provides: "casOpNames (fjs/guest's frozen four command names), reused here to constrain inputs[].command semantically"
  - phase: 05-document-dialects-and-form-subjects
    provides: "The base()/dialect/mediaType/checkReferences/validate four-stage document dialect template this plan mirrors exactly"
provides:
  - "vnd.fjs.run document dialect: dialect tag, mediaType, runSchema, Run type, checkReferences, validate — the schema Plan 06's handler will populate and Plan 07/08's proofs will decode"
  - "A structural/semantic split that enforces T-07-02-01 (inputs[].command restricted to the frozen four) and T-07-02-02 (status/resultHash/error cross-field consistency) at read-back time"
affects: [07-05, 07-06, 07-07, 07-08]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "vnd.fjs.run follows the same base()-spread / structural-then-semantic validate() template as every other fjs/document dialect (1099int, w2, ocr) — no bespoke record shape"
    - "inputs[] entries are a narrow {command, payload} struct with no room for a program's own citation list to reach it; checkReferences narrows command to casOpNames as the read-back backstop"

key-files:
  created:
    - "fjs/run/module.f.js — vnd.fjs.run dialect: dialect, mediaType, runSchema, Run, checkReferences, validate, proof"
  modified: []

key-decisions:
  - "status is exactly or('ok', 'error') — a two-arm union mirroring Result, not a richer enum, per 07-CONTEXT.md"
  - "inputs[].payload is modelled as array(string), not array(unknown), because every one of the frozen four CasOp commands takes a single string argument — matches the actual shape observed reads carry"
  - "checkReferences enforces ok-record cross-field rules symmetrically in both directions: an ok record must have resultHash and must not have error; an error record must have error and must not have resultHash — proven with a bonus okWithErrorFieldRejected leaf alongside the plan's named cases"
  - "Two-commit split mirrors the plan's two tasks: Task 1 lands the schema/checkReferences/validate with a minimal proof set covering exactly its 6 acceptance criteria (7 leaves); Task 2 expands proof coverage to the full per-case leaf structure plus the crossDialect leaf"

requirements-completed: [PROV-03]

# Metrics
duration: 25min
completed: 2026-08-05
---

# Phase 7 Plan 2: The `vnd.fjs.run` document dialect Summary

**`fjs/run/module.f.js` — the `vnd.fjs.run` dialect (programHash, args, pinned, subject, parents, status, inputs[], resultHash, error), built on the same `base()`-spread / structural-then-semantic-validate template as every other document dialect, with `checkReferences` enforcing the frozen-four command whitelist on `inputs[]` and the ok/error cross-field consistency rule.**

## Performance

- **Duration:** ~25 min
- **Tasks:** 2
- **Files modified:** 1 (`fjs/run/module.f.js`, new)

## Accomplishments

- `fjs/run/module.f.js` created, exporting `dialect = 'vnd.fjs.run'`, `mediaType = 'application/vnd.fjs.run+json'`, `runSchema`, `Run` (derived via `Ts<typeof runSchema>`), `checkReferences`, and `validate` — the exact four-stage shape (`dialect -> mediaType -> schema -> structural validate -> semantic checkReferences -> composed validate`) `fjs/document/1099int/module.f.js` established.
- `runSchema` spreads `base(dialect)` first (so a mismatched blob's `dialect` field fails structural validation first, same DOC-00 guarantee every other dialect gets), then declares `programHash: string`, `args: array(string)`, `pinned: boolean`, `subject: option(string)`, `parents: option(array(string))`, `status: or('ok', 'error')`, `inputs: array({ command: string, payload: array(string) })`, `resultHash: option(string)`, `error: option(string)`.
- `checkReferences` enforces what RTTI cannot express structurally: `programHash` non-empty (trimmed); every `inputs[].command` is one of `casOpNames` (imported from `../guest/module.f.js`) — an unrecognized command name (e.g. `'fetch'`) is rejected, closing T-07-02-01; and the `status`-conditioned cross-field rule (T-07-02-02) — an `ok` record must have a non-empty `resultHash` and must not carry `error`; an `error` record must have a non-empty `error` message and must not carry `resultHash`.
- Module header documents why this is a dialect (not a bespoke shape), states the `inputs[]` observed-not-declared invariant as a contract for Plan 06's handler (the field must be populated from `interpret`'s returned `Read[]`, never from a program's own citation list), and notes EXACT-05 is not re-litigated here since this record carries no numeric value directly.
- Full proof coverage: dialect/mediaType literals, spread-order, both status arms validating when fully populated (with `subject`/`parents`/populated `inputs[]`), five distinct `checkReferences` rejection leaves (one assertion each), two canonical-accept leaves, a wrong-dialect structural-rejection leaf, and a `crossDialect` leaf proving a fully-valid `vnd.fjs.1099int` value (a parsed JS object, not a JSON string) fails `vnd.fjs.run`'s `validate` with `path[0] === 'dialect'`.

## Task Commits

1. **Task 1: Define the vnd.fjs.run schema, checkReferences, and validate** - `31b77f2` (feat)
2. **Task 2: Structural and cross-dialect proof coverage** - `295b7b1` (feat)

_Both tasks are executed as a single `feat` commit each, per this project's established style of proofs living alongside the code they test in the same module — Task 1's commit lands the implementation with a minimal proof set covering exactly its own six acceptance criteria (7 leaves), and Task 2's commit expands proof coverage to the full per-rejection-case leaf structure plus the cross-dialect leaf, matching the plan's own two-task split._

## Files Created/Modified

- `fjs/run/module.f.js` - New. Exports `dialect`, `mediaType`, `runSchema`, `Run`, `checkReferences`, `validate`, and a `proof` object with 14 leaves (`dialectAndMediaType`, `runSchemaSpreadsDialectFirst`, `validate.fullyPopulatedOkValidates`, `validate.fullyPopulatedErrorValidates`, `validate.wrongDialectRejected`, `checkReferences.emptyProgramHashRejected`, `checkReferences.unrecognizedInputsCommandRejected`, `checkReferences.okWithoutResultHashRejected`, `checkReferences.errorWithResultHashRejected`, `checkReferences.errorWithoutErrorMessageRejected`, `checkReferences.okWithErrorFieldRejected`, `checkReferences.canonicalOkAccepted`, `checkReferences.canonicalErrorAccepted`, `crossDialect.oneZeroNineNineIntShapeRejectedByRun`).

## Decisions Made

- Kept `status` as a strict two-arm `or('ok', 'error')` union, per the locked CONTEXT.md decision — no richer enum, the distinguishing detail belongs in the `error` message.
- Modelled `inputs[].payload` as `array(string)` rather than `array(unknown)`: every one of the frozen four `CasOp` commands (`casRead`, `evoList`, `evoHead`, `evoRevision`) takes a single string argument, so this matches the actual shape `interpret`'s `Read` tuples carry rather than introducing a wider, less precise placeholder.
- Added a bonus `okWithErrorFieldRejected` proof leaf beyond the plan's five named `checkReferences` cases, mirroring `1099int`'s own precedent of adding a symmetric "bonus, not required by the roadmap" leaf — proves the ok/error cross-field rule holds in both directions (an ok record with an `error` field present is rejected, not just an error record with `resultHash` present).
- Split the single implementation file into two commits along the plan's own task boundary rather than landing everything in one commit: Task 1's commit contains exactly the 7 proof leaves needed to satisfy its 6 named acceptance criteria; Task 2's commit adds the remaining 7 leaves (wrong-dialect rejection, the two additional `checkReferences` cases, the bonus leaf, the two canonical-accept leaves, and the cross-dialect leaf).

## Deviations from Plan

None — plan executed exactly as written. Both tasks' acceptance criteria are met verbatim; no architectural changes, no missing dependencies, no auto-fixes required.

## Known Stubs

None. `fjs/run/module.f.js` is a complete, self-contained schema/validator module with no placeholder values, no unwired data paths, and no deferred functionality — it has no runtime consumer yet (Plan 06 writes the first real record), which is expected and explicitly scoped as this plan's boundary, not a stub.

## Threat Flags

None beyond what 07-02-PLAN.md's own `<threat_model>` already names (T-07-02-01, T-07-02-02) — both are the mitigations this plan's `checkReferences` implements, not new surface.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Verification

- `npx tsc` — exits 0, no output.
- `npm test` — `tests 2328`, `pass 2328`, `fail 0`.
- Project-local proof count gate (`node --test 2>&1 | grep -c '^✔ import("./fjs/'`): **136 → 150** (baseline measured before any change in this worktree by temporarily moving the new file aside and re-running the gate; +14 net new project-local proof leaves, all under `fjs/run/module.f.js`). Strictly greater than 136, per the verification gate.
- All 14 `fjs/run/module.f.js` proof leaves pass under root discovery (`node --test`), individually verified by name.

## Next Phase Readiness

`fjs/run/module.f.js`'s `dialect`, `mediaType`, `runSchema`, `Run`, `checkReferences`, and `validate` are ready for Plan 06's handler to populate (writing `inputs[]` from `interpret`'s returned `Read[]`, never from a program's declared citations) and for Plan 07/08's proofs to decode via `finance_schema`. No blockers for Wave 1's remaining independent plans.

---
*Phase: 07-fjs-run-run-records-and-the-week-1-convergence*
*Completed: 2026-08-05*

## Self-Check: PASSED

- FOUND: fjs/run/module.f.js
- FOUND: .planning/phases/07-fjs-run-run-records-and-the-week-1-convergence/07-02-SUMMARY.md
- FOUND: 31b77f2 (Task 1 commit)
- FOUND: 295b7b1 (Task 2 commit)
