---
phase: 07-fjs-run-run-records-and-the-week-1-convergence
plan: 08
subsystem: api
tags: [fjs-run, finance-schema, mcp, integration, week-1, functionalscript]

# Dependency graph
requires:
  - phase: 07-03
    provides: financeSchemaTool (MCP-06) — read the dialect's own field names before authoring a program
  - phase: 07-06
    provides: fjsRunTool/executeRun — the assembled handler this plan drives, never bypasses
  - phase: 07-07
    provides: fjsRunTool's error taxonomy — session-survival and error-record proof support this plan reuses conceptually
provides:
  - "financeMcpHandlers concatenates financeSchemaTool and fjsRunTool into its existing fromRegistry([...]) array, alongside casToolRegistry/evoToolRegistry/casRefreshTool"
  - "proof.weekOneConvergence: the Week 1 finish line proven end to end through the REAL financeMcpServer/mcpStep/stdioTransport stack — finance_schema -> stored program -> fjs_run -> correct total with resultHash/runHash both resolvable"
  - "tools/list enumerates all five tool families (cas_add/cas_get/cas_list, evo_*, cas_refresh, finance_schema, fjs_run)"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Registry composition stays a flat array concatenation: financeSchemaTool/fjsRunTool are additional elements in the same fromRegistry([...]) array casRefreshTool already established, no new composition mechanism"
    - "weekOneConvergence extends casRefresh.seedInvisibleUntilRefreshed's own runBatch/state-threading pattern: seed everything (documents, revisions, program) into ONE virtual State BEFORE building the Evo cache (unlike casRefresh's own proof, which deliberately builds the cache before its seed to demonstrate invisibility), then drive initialize -> tools/call finance_schema -> tools/call fjs_run as successive NDJSON batches against the same threaded state"
    - "Revisions are seeded directly via cas.write (bypassing evo_add), mirroring casRefresh's own raw vnd.fjs.revision-blob technique, for three distinct subjects behind three documents"
    - "The guest program's source is written for real via cas.write (the same write mechanism Plan 05 already proved), while its EXECUTION comes from a JsModule fixture placed at the bare hash-derived materialize path in the virtual root — the documented composition fjs/guest/materialize/module.f.js's own header names for why virtual cannot execute freshly-written bytes as code in one session"
    - "The proof's expected total is computed independently via centsFromString/centsToString on the same two present seeded literals used to seed the store, never as a bare literal"

key-files:
  created: []
  modified:
    - fjs/server/module.f.js

key-decisions:
  - "financeSchemaTool and fjsRunTool both unified into financeMcpHandlers's FileCasOperation | MemOp | Mkdir | WriteFile | Import return type with zero casts and zero widening beyond adding fjsRunTool's own already-declared Mkdir | WriteFile | Import members — confirming the plan's stated expectation that the two tools' operation types unify cleanly."
  - "The Week 1 proof seeds all three 1099-INT revisions directly into the store (bypassing evo_add) BEFORE calling initEvo, so the cache picks them up from the start — a deliberate divergence from casRefresh.seedInvisibleUntilRefreshed's own ordering (which builds the cache BEFORE its seed specifically to demonstrate invisibility). Both proofs reuse the same seeding TECHNIQUE; only the ordering relative to cache-build differs, because this proof's goal is an ordinary already-populated store, not the refresh-lever scenario."
  - "isError is asserted via a second rtti schema (callResultWithIsErrorSchema, adding option(true) alongside the existing callResultSchema's content array) rather than widening the existing callResultSchema used by every other tools/call leaf in this file — narrowest-possible schema per leaf, not a shared schema drifting to fit every caller's needs."

patterns-established:
  - "Pattern (07-08): an end-to-end integration proof namespace (weekOneConvergence) composes every previously-independent building block (finance_schema, fjs_run, casRefresh's runBatch technique, the guest ctx money/step vocabulary) through the one real transport stack, as the final proof a phase's individual plans converge correctly — a template for any future 'full stack' proof in this codebase."

requirements-completed: [EXEC-08, EXEC-10, EXEC-11, EXEC-12, PROV-03, MCP-06]

# Metrics
duration: ~50min
completed: 2026-08-05
---

# Phase 7 Plan 08: Wiring and the Week 1 Convergence Summary

**`finance_schema` and `fjs_run` concatenated into `financeMcpHandlers`'s registry with zero type casts, then the phase's own finish line proven end to end through the real `financeMcpServer`/`mcpStep`/`stdioTransport` stack: an agent reads `vnd.fjs.1099int`'s field names, a stored program sums `box1InterestIncome` across three seeded documents (skipping the one with the field absent), and the returned total (`1244.56`) is independently computed inside the proof and both `resultHash`/`runHash` resolve back out of CAS.**

## Performance

- **Completed:** 2026-08-05
- **Tasks:** 2 completed
- **Files modified:** 1

## Accomplishments

- `financeMcpHandlers` now composes all five tool families in one flat
  `fromRegistry([...])` array: `casToolRegistry`, `evoToolRegistry`,
  `casRefreshTool`, `financeSchemaTool` (MCP-06), and `fjsRunTool`
  (EXEC-08/EXEC-10/EXEC-11/PROV-03). No cast and no widened
  `financeMcpHandlers`/`financeMcpServer` signature beyond adding the
  `Mkdir | WriteFile | Import` members `fjsRunTool` itself already declares —
  the two tools' operation types unified cleanly, confirming the plan's own
  expectation.
- The module header's reserved-seam comment (previously describing `fjs_run`
  as future work) now states the composition is wired.
- `toolsListEnumeratesComposedRegistry` extended to assert `finance_schema`
  and `fjs_run` both appear in `tools/list` alongside `evo_list`/`cas_refresh`.
- A new `proof.weekOneConvergence` namespace proves the phase's own finish
  line (`todo/plan.md`'s Week 1 criterion, Success Criterion 1) through the
  REAL `financeMcpServer`/`mcpStep`/`stdioTransport` stack — never a bespoke
  harness:
  - Three `vnd.fjs.1099int` revisions are seeded directly into the virtual
    CAS store (bypassing `evo_add`, mirroring `casRefresh`'s own raw
    revision-blob technique), one with `box1InterestIncome` absent entirely
    (never `'0.00'`).
  - A guest program's source is stored for real via `cas.write` (the write
    mechanism Plan 05 already proved); its execution comes from a `JsModule`
    fixture at the bare hash-derived materialize path, per Plan 05's own
    documented "virtual cannot execute freshly-written bytes as code" scope
    note. The program enumerates every stored subject via
    `ctx.step`/`ctx.evoList`/`evoHead`/`evoRevision`/`casRead` and sums every
    PRESENT `box1InterestIncome`.
  - The session drives `initialize` -> `notifications/initialized` ->
    `tools/call finance_schema('vnd.fjs.1099int')` (asserts the response names
    `box1InterestIncome`) -> `tools/call fjs_run` (asserts `isError` is
    absent, and both `resultHash`/`runHash` decode successfully back out of
    CAS).
  - The persisted run record's `inputs[]` is asserted to contain an
    `evoHead` read of the absent-field document's own subject — proving the
    program actively visited and skipped it, not that the proof simply never
    presented it.
  - The expected total (`1244.56`) is computed independently inside the proof
    via `centsFromString`/`centsToString` on the two present seeded literals
    (`'1234.56'` + `'10.00'`), never as a bare literal.
  - Load-bearing verification performed before committing: temporarily
    removed the absent-field skip (calling `centsFromString` directly on
    `undefined`), confirmed the leaf failed with `isError: true` (proving the
    skip logic — not merely the sum — is what the leaf actually checks), then
    reverted to the passing implementation.

## Task Commits

1. **Task 1: Wire financeSchemaTool and fjsRunTool into financeMcpHandlers** - `a339e3c` (feat)
2. **Task 2: The Week-1 finish line, end to end** - `11c52dd` (feat)

_No TDD RED/GREEN split was used for Task 2 — both `financeSchemaTool` and `fjsRunTool` already exist and are proven at their own layers (Plans 03 and 05-07); this plan's own `tdd="true"` marking means "write the integration proof alongside no changes to either tool's implementation," per the plan's own action text, verified green before committing (with the load-bearing mutation check documented above)._

## Files Created/Modified

- `fjs/server/module.f.js` - `financeMcpHandlers`/`financeMcpServer` widened
  to `FileCasOperation | MemOp | Mkdir | WriteFile | Import`; two new tool
  entries concatenated into the registry; module header updated; imports
  added for `financeSchemaTool`, `fjsRunTool`, `guestCtx`, `programFileName`,
  the `vnd.fjs.1099int` dialect/validator, `centsFromString`/`centsToString`,
  `cBase32ToVec`, `collectRead`, `utf8ToString`, and rtti's `option`; a new
  `callResultWithIsErrorSchema`/`asCallResultWithIsError` pair; the
  `toolsListEnumeratesComposedRegistry` assertion extended; a new
  `proof.weekOneConvergence` namespace with one full end-to-end leaf.

## Decisions Made

- Seeded the three revisions BEFORE calling `initEvo`, not after — the
  opposite ordering from `casRefresh.seedInvisibleUntilRefreshed`'s own proof
  — because this proof's goal is an ordinary already-populated store (what a
  real server sees at startup), not the refresh-lever scenario `casRefresh`
  exists to demonstrate. Both proofs reuse the identical direct-write
  technique; only the ordering relative to the cache build differs, for
  different reasons.
- Added a second, narrower rtti schema (`callResultWithIsErrorSchema`) for the
  one leaf that needs to assert `isError`'s absence, rather than widening the
  shared `callResultSchema` every other `tools/call` leaf in this file already
  uses — narrowest-possible schema per caller, matching this file's own
  established `decoder`/schema convention.
- Verified the absent-vs-coerced-to-zero distinction is load-bearing by
  temporarily mutating the implementation to skip the `undefined` check
  entirely (rather than merely trusting that skipping and zero-coercing
  would look different) — confirmed the mutant fails with `isError: true`
  (a real crash from calling `centsFromString(undefined)`), then reverted.

## Deviations from Plan

None — plan executed exactly as written. Both tasks' acceptance criteria are
met:
- Task 1: `tsc` is clean with both tools concatenated, no widened
  `financeMcpHandlers` signature beyond the operation union, no casts;
  `tools/list` enumerates `finance_schema` and `fjs_run` alongside
  `evo_list`/`cas_refresh`.
- Task 2: the expected total is computed via `centsFromString`/`centsToString`
  inside the proof from the two present seeded values, never a literal copied
  from having run the program once; the absent-field document's subject is
  enumerated by the program and its `evoHead` read appears in the persisted
  record's `inputs[]`; `resultHash`/`runHash` both decode successfully back
  out of the virtual CAS store; the project-local proof count is strictly
  greater than the 184 baseline measured before this plan.

## Issues Encountered

- `tsc` initially rejected `runResult.isError` because the shared
  `callResultSchema`'s decoded type only carries `result.content` (rtti
  permits extra properties on input but the decoded TypeScript type reflects
  only what the schema names). Fixed by adding a second schema
  (`callResultWithIsErrorSchema`) carrying `isError: option(true)`, used only
  by the one leaf that needs it.
- Adding every import Task 2 would eventually need in the Task 1 commit broke
  `tsc`'s `noUnusedLocals` check (since Task 2's code didn't exist yet in that
  commit). Fixed by deferring those imports to the Task 2 commit, keeping
  Task 1's commit self-contained and independently green.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All six of this plan's requirements (EXEC-08, EXEC-10, EXEC-11, EXEC-12,
  PROV-03, MCP-06) are now proven end-to-end through the fully-assembled,
  really-composed `financeMcpServer` — not merely at their own individual
  handler layers.
- `todo/plan.md`'s Week 1 finish line (Success Criterion 1) is proven, not
  asserted: an agent-driven `finance_schema` -> author-a-program ->
  `fjs_run` -> correct-total path is exercised through the real transport
  stack with no bespoke harness standing in for any piece of it.
- No blockers for subsequent phases. `fjs_run`/`finance_schema` are now part
  of the server's permanent, composed public surface (`tools/list` proves
  it), so any later phase building on top of this MCP server sees both tools
  without further wiring.

---
*Phase: 07-fjs-run-run-records-and-the-week-1-convergence*
*Completed: 2026-08-05*

## Self-Check: PASSED

- FOUND: fjs/server/module.f.js
- FOUND commit: a339e3c
- FOUND commit: 11c52dd
- `npx tsc` exits 0, no output
- `npm test`: 186/186 pass
- Project-local proof count (`node --test 2>&1 | grep -c '^✔ import("./fjs/'`): 184 before -> 185 after (strictly greater, as required)
- `git status --porcelain` clean after both task commits
- Static re-check: `grep -n "casWrite|evoAdd" fjs/guest/module.f.js fjs/guest/materialize/module.f.js` returns no output
- `git check-ignore .fjs-run` confirms the Plan 05 gitignore entry holds
