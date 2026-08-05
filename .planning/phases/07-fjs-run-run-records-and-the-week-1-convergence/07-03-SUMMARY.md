---
phase: 07-fjs-run-run-records-and-the-week-1-convergence
plan: 03
subsystem: mcp-tool
tags: [fjs-run, mcp-tool, functionalscript, rtti, json-schema]

# Dependency graph
requires:
  - phase: 05-document-dialects-and-form-subjects
    provides: "The four document dialects (vnd.fjs.1099int, vnd.fjs.ocr, vnd.fjs.w2, vnd.fjs.medical_expenses), each exporting its own dialect tag and RTTI schema const"
provides:
  - "financeSchemaTool: a ToolEntry serializing a document dialect's own RTTI schema via toJsonSchema, ready to be concatenated into financeMcpHandlers"
affects: [07-08]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "finance_schema(dialect) looks a dialect tag up in a local map that names WHICH schema const to serialize, then calls fjs's own toJsonSchema on it directly — never a hand-maintained field list"
    - "A zero-operation toolEntry handler (ToolEntry<never>) resolves entirely via pure(...); proofs call financeSchemaTool.handle directly and unwrap the result with runPure, mirroring fjs/server/module.f.js's casRefreshTool worked example"

key-files:
  created:
    - "fjs/server/finance_schema/module.f.js - financeSchemaTool, dialectSchemas lookup map, proof (5 leaves)"
  modified: []

key-decisions:
  - "dialectSchemas is typed as an open string-keyed map ({ readonly [dialect: string]: Type }) rather than letting TypeScript infer the narrower literal-key object from the computed-property literal — indexing the narrower inferred type by an arbitrary request-supplied string produced the lossy '{} | null' type (an unknown-cast lookup hits the same trap), which toJsonSchema's Type parameter rejects. The explicit open-map annotation gives a clean Type | undefined instead."
  - "A textOf(result) helper narrows ToolsCallResult's content[0] (a TextContent | EmbeddedResource union) to its text field via assert's type-narrowing 'asserts v' signature, since financeSchemaTool only ever returns textContent items via okResult/errorResult."
  - "The tool's operation type parameter is never (ToolEntry<never>) - no CAS/Evo operation is needed since the handler only looks up an already-in-memory schema const and returns pure(...)."

requirements-completed: [MCP-06]

# Metrics
duration: ~20min
completed: 2026-08-05
---

# Phase 7 Plan 3: The `finance_schema` MCP tool Summary

**`fjs/server/finance_schema/module.f.js` — `financeSchemaTool`, a zero-operation `ToolEntry` that looks a dialect tag up in a local map naming its own schema const and serializes that schema via fjs's `toJsonSchema`, refusing an unknown dialect with an `errorResult` naming both the offending tag and the known set.**

## Performance

- **Duration:** ~20 min
- **Tasks:** 2
- **Files modified:** 1 (`fjs/server/finance_schema/module.f.js`, new)

## Accomplishments

- `fjs/server/finance_schema/module.f.js` created, exporting `financeSchemaTool` (built via `toolEntry('finance_schema', ..., { dialect: string }, handle)`) and a `dialectSchemas` lookup map keying each of the four known dialect tags (`vnd.fjs.1099int`, `vnd.fjs.ocr`, `vnd.fjs.w2`, `vnd.fjs.medical_expenses`) to that dialect's own exported schema const.
- `finance_schema('vnd.fjs.1099int')` (and the other three known dialects) returns `okResult(JSON.stringify(toJsonSchema(<that dialect's own schema const>)))` — the map only ever names WHICH schema to serialize; `toJsonSchema` does the actual field-by-field walk, so no hand-written field list exists anywhere in this file (the precondition MCP-06 exists to satisfy).
- An unknown dialect (e.g. `vnd.fjs.does-not-exist`) returns `errorResult('unknown dialect: vnd.fjs.does-not-exist; known: vnd.fjs.1099int, vnd.fjs.ocr, vnd.fjs.w2, vnd.fjs.medical_expenses')` — a tool-level error, never a throw, satisfying T-07-03-02.
- Full proof coverage: one round-trip leaf per known dialect (each asserting the returned text, JSON-parsed, deep-equals `toJsonSchema` called directly on that dialect's own schema const — proven against the real function, never a hand-written JSON literal) plus one leaf for the unknown-dialect refusal. Five leaves total, all reached and green under root discovery (`node --test`).
- Module header documents both design points as "why", per house style: the lookup map names which schema, never re-describes it; and the unknown-dialect path is a tool-level `errorResult`, never a crash.

## Task Commits

1. **Task 1: financeSchemaTool — dialect lookup and toJsonSchema serialization** - `75d262b` (feat) — landed concurrently by a second author working in this same checkout, before this execution reached the commit step; this executor's independently-generated implementation matched that commit byte-for-byte (see Deviations below), so no separate commit was created for it.
2. **Task 2: Proof coverage for every known dialect and the unknown-dialect refusal** - `1262294` (feat)

_Note: the plan's two-task split is preserved in the commit history even though Task 1's commit was authored by a concurrent session, matching Plan 07-02's own precedent of one commit per task boundary._

## Files Created/Modified

- `fjs/server/finance_schema/module.f.js` - New. Exports `financeSchemaTool` (a `ToolEntry<never>`), the internal `dialectSchemas` lookup map and `knownDialects` list, and a `proof` object with 5 leaves (`oneZeroNineNineIntResolves`, `ocrResolves`, `w2Resolves`, `medicalExpensesResolves`, `unknownDialectRefused`).

## Decisions Made

- Typed `dialectSchemas` explicitly as `{ readonly [dialect: string]: Type }` rather than letting TypeScript infer the schema map's type from the computed-property object literal. The inferred literal-key type, indexed by an arbitrary request-supplied `dialect: string`, and an `unknown`-cast alternative both produced TypeScript's narrowed `'{} | null'` type after the `undefined`-check, which `toJsonSchema`'s `Type` parameter rejects (`tsc` caught this — see Deviations).
- Added a `textOf(result)` helper narrowing `ToolsCallResult`'s `content[0]` (a `TextContent | EmbeddedResource` union) to its `text` field, using `assert`'s `asserts v` type-narrowing signature — `financeSchemaTool` only ever returns `textContent` items via `okResult`/`errorResult`, so this is a proof-time sanity check, not a cast.
- Kept the tool's operation type parameter as `never` (`ToolEntry<never>`) per the plan's own note that this tool needs no CAS/Evo operation — the handler only reads an already-imported, in-memory schema const and returns `pure(...)`.
- Split the implementation into the plan's own two-task boundary for the commit history: Task 1's minimal proof (round-trip for 1099int, a loop confirming all four known dialects resolve without error, and the unknown-dialect refusal — 3 leaves, exactly Task 1's own acceptance criteria) versus Task 2's full per-dialect expansion (5 leaves, each dialect's own round-trip assertion) — mirroring Plan 07-02's precedent of landing a minimal proof set in the first commit and expanding it in the second.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `dialectSchemas` lookup produced TypeScript's narrowed `'{} | null'` type, rejected by `toJsonSchema`**
- **Found during:** Task 1, first `tsc` run
- **Issue:** An object literal built with computed dialect-tag property keys (`[oneZeroNineNineIntDialect]: oneZeroNineNineIntSchema, ...`) infers a narrow literal-key type. Indexing it by an arbitrary request-supplied `dialect: string` (or casting the lookup to `Record<string, unknown>` and narrowing away `undefined`) both produced TypeScript's `'{} | null'` type, which `toJsonSchema`'s `Type` parameter does not accept. Also, `result.content[0]?.text` failed to typecheck because `content[0]` is a `TextContent | EmbeddedResource` union and only the former has `.text`.
- **Fix:** Typed `dialectSchemas` explicitly as `{ readonly [dialect: string]: Type }` (an open string-keyed map), giving a clean `Type | undefined` on lookup. Added a `textOf(result)` helper that narrows the content union via `assert`'s type-narrowing signature before reading `.text`.
- **Files modified:** `fjs/server/finance_schema/module.f.js`
- **Commit:** `1262294` (the fix was applied before any commit landed, since Task 1's commit was pre-empted by the concurrent author's identical-content commit `75d262b` — see the non-standard item below)

### Non-standard: concurrent-author collision, not a deviation from scope

This execution generated `fjs/server/finance_schema/module.f.js` independently from the plan, context, and interface documentation exactly as instructed, verified it with `tsc`/`node --test`, and then discovered — only at the `git add`/`git status` step immediately before committing Task 1 — that a second author working in this same checkout had already committed byte-for-byte identical content as `75d262b feat(07-03): finance_schema tool module (not yet registered)`, roughly 20 minutes before this execution reached its own commit step. No merge conflict, no divergent implementation, and no scope change resulted: this execution's Task 1 work is indistinguishable from what is already on the branch. Rather than force an empty/duplicate commit, this execution recorded `75d262b` as satisfying Task 1 and proceeded straight to Task 2's proof expansion, committed as `1262294`. `git branch --show-current` and `git status --short` were re-checked immediately before this commit, per the house rule for shared-checkout concurrency.

## Known Stubs

None. `financeSchemaTool` is complete and independently proof-tested. It is not yet imported into `fjs/server/module.f.js`'s `financeMcpHandlers` registry — this is expected and explicitly out of this plan's scope (07-CONTEXT.md and the plan's own objective both name Plan 08 as the wiring step), not a stub.

## Threat Flags

None beyond what 07-03-PLAN.md's own `<threat_model>` already names (T-07-03-01, T-07-03-02) — both are addressed as designed: the lookup map only ever serializes already-public schema shapes (T-07-03-01, accepted), and the unknown-dialect path is a tool-level `errorResult`, never a throw (T-07-03-02, mitigated).

## Issues Encountered

- The `tsc` type errors described above under Deviations were caught and fixed before any test run; no runtime bugs were found.
- The concurrent-author collision (see Deviations) required re-verifying `git branch --show-current`, `git status --short`, and a byte-for-byte `diff` against the already-committed blob before deciding not to duplicate the commit.

## User Setup Required

None - no external service configuration required.

## Verification

- `npx tsc` — exits 0, no output.
- `npm test` — `tests 2333`, `pass 2333`, `fail 0`.
- Project-local proof count gate (`node --test 2>&1 | grep -c '^✔ import("./fjs/'`): **150 → 155** (measured before this execution's changes were on disk, and again after Task 2's commit). Strictly greater than 150, per the verification gate. (An intermediate measurement at the end of Task 1's proof set, before the concurrent-commit discovery, read 153; the final committed state after Task 2 is 155.)
- All 5 `fjs/server/finance_schema/module.f.js` proof leaves (`oneZeroNineNineIntResolves`, `ocrResolves`, `w2Resolves`, `medicalExpensesResolves`, `unknownDialectRefused`) pass under root discovery (`node --test`), individually verified by name.

## Next Phase Readiness

`financeSchemaTool` is ready to be concatenated into `financeMcpHandlers`'s registry array in Plan 08, alongside `fjs_run`. No blockers for the remaining Wave 1 plans.

---
*Phase: 07-fjs-run-run-records-and-the-week-1-convergence*
*Completed: 2026-08-05*

## Self-Check: PASSED

- FOUND: fjs/server/finance_schema/module.f.js
- FOUND: 75d262b (Task 1 commit, landed by concurrent author)
- FOUND: 1262294 (Task 2 commit)
- FOUND: .planning/phases/07-fjs-run-run-records-and-the-week-1-convergence/07-03-SUMMARY.md
