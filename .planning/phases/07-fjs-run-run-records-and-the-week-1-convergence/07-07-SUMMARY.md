---
phase: 07-fjs-run-run-records-and-the-week-1-convergence
plan: 07
subsystem: api
tags: [fjs-run, error-taxonomy, mcp-tool, functionalscript]

# Dependency graph
requires:
  - phase: 07-06
    provides: executeRun/fjsRunTool (the assembled handler this plan drives, never bypasses)
provides:
  - "Three independent proof leaves under fjsRunTool.errorTaxonomy, each proving one of EXEC-12's named failure classes surfaces as fjsRunTool.handle's OWN isError:true"
  - "A persisted status:'error' vnd.fjs.run record assertion, shared via assertPersistedErrorRunRecord, satisfied by all three leaves (PROV-03)"
  - "A session-survival assertion (assertSessionSurvivesAFollowingCall) on all three leaves, proving a following fjsRunTool.handle call against the SAME threaded virtual State still succeeds"
affects: [07-09]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Local unsafeDo escape hatch: fjs/exec's own any-cast test-fixture pattern reproduced locally in fjs_run/module.f.js rather than imported across a module boundary reserved for that module's own fixtures"
    - "seedGoodProgram + assertSessionSurvivesAFollowingCall: a known-good program seeded alongside the failing one in the SAME store/root, driven a second time through fjsRunTool.handle against the SAME threaded State after the failing call — the documented smaller-scoped equivalent to a full financeMcpServer tools/list session, since fjsRunTool is not yet wired into that server (Plan 09)"
    - "Genuine CAS-miss vs malformed-hash: missingHashBecomesErrorResult uses a syntactically valid cBase32 hash (vecToCBase32(vec8(0xabn))) never written to the store, distinct from 07-06's executeRun-level malformed-hash proof, to exercise the collectRead(cas.read(...)) failure branch specifically"
    - "Genuine import failure vs specifier refusal: importFailureBecomesErrorResult materializes a clean (zero-import) source for real but omits the JsModule fixture at its bare hash-derived name, reusing fjs/guest/materialize's own missingModuleIsAnErrorValue technique at the fjsRunTool layer to exercise loadProgram's import_ effect itself failing, never checkSpecifiers"

key-files:
  created: []
  modified:
    - fjs/server/fjs_run/module.f.js

key-decisions:
  - "Session survival is proven by driving fjsRunTool.handle a SECOND time against the SAME threaded virtual State, not by assembling a full financeMcpServer/mcpStep session. fjsRunTool is not yet wired into financeMcpServer's registry (07-06-SUMMARY.md's own 'Next Phase Readiness' note defers that wiring to Plan 09), so there is no assembled tools/list-capable transport to drive yet. The plan's own Task 2 action text explicitly permits this smaller-scoped equivalent provided it is documented, which assertSessionSurvivesAFollowingCall's own doc comment does."
  - "The missing-hash leaf uses a syntactically VALID cBase32 hash that was never written to the store (vecToCBase32(vec8(0xabn))), not a malformed string like 07-06's own 'not-a-real-hash'. This exercises a genuinely different branch inside executeRun (the collectRead(cas.read(hashVec)) miss, not the cBase32ToVec(...) === null short-circuit), so this plan's proof is not a duplicate of Plan 06's own missingHashShortCircuitsBeforeMaterializeOrInterpret at a different layer."
  - "The import-failure leaf reuses fjs/guest/materialize's missingModuleIsAnErrorValue technique (an absent JsModule fixture at the materialized path) rather than constructing a genuinely broken import_ effect or reusing 07-06's dirty-specifier proof, per the plan's own stated preference for whichever construction is easier — and because a dirty specifier fails at checkSpecifiers, before import_ ever runs, which would not exercise the 'import failure' branch distinctly from 07-06's own proof at the executeRun layer."

patterns-established:
  - "Pattern (07-07): shared proof-support helpers (assertPersistedErrorRunRecord, seedGoodProgram, assertSessionSurvivesAFollowingCall) factored once above proof leaves that repeat the identical assertion three times, rather than duplicated inline in each leaf."

requirements-completed: [EXEC-12]

# Metrics
duration: ~40min
completed: 2026-08-05
---

# Phase 7 Plan 07: The error taxonomy Summary

**Three independent proof leaves — a non-`Error` guest throw, a genuine missing-hash CAS miss, and a genuine import failure — each proven through the FULL `fjsRunTool.handle`, never `executeRun`/`loadProgram` in isolation, each asserting the handler's own `isError:true`, a persisted `status:'error'` run record, and that a following call in the same session still succeeds.**

## Performance

- **Completed:** 2026-08-05
- **Tasks:** 2 completed
- **Files modified:** 1

## Accomplishments

- `proof.fjsRunTool.errorTaxonomy.nonErrorThrowBecomesErrorResult`: a guest
  `Report` whose body calls a local `unsafeDo('fetch')('https://evil')` — the
  same test-fixture escape hatch `fjs/exec/module.f.js` uses, reproduced
  locally rather than imported across that module's own boundary — refuses
  through `interpret`'s bare-string catch, and the refusal surfaces as
  `fjsRunTool.handle`'s own `ToolsCallResult.isError === true`, with the
  refused operation (`fetch`) named in the text.
- `proof.fjsRunTool.errorTaxonomy.missingHashBecomesErrorResult`: a
  syntactically valid cBase32 hash that was never written to the store
  (`vecToCBase32(vec8(0xabn))`) exercises the genuine CAS-miss branch
  (`collectRead(cas.read(...))` failing) — distinct from 07-06's own
  malformed-hash proof at the `executeRun` layer, which never reaches
  `cas.read` at all. "Materialization never attempted" is asserted
  behaviorally: `readUtf8File` at the exact path `materializeProgram` would
  have written to returns an error, not an inference from the message text.
- `proof.fjsRunTool.errorTaxonomy.importFailureBecomesErrorResult`: a clean
  (zero-import) source is materialized for real by `executeRun`'s own write
  step, but no `JsModule` fixture is placed at its bare hash-derived name —
  reusing `fjs/guest/materialize/module.f.js`'s own
  `missingModuleIsAnErrorValue` technique at the `fjsRunTool` layer. This
  exercises `loadProgram`'s own `import_` effect actually failing, never
  `checkSpecifiers` (which 07-06's dirty-specifier proof already covers at
  the `executeRun` layer).
- All three leaves assert a persisted `vnd.fjs.run` record with
  `status: 'error'` decoded back out of CAS via the error text's own embedded
  `runHash` — factored once into `assertPersistedErrorRunRecord` rather than
  repeated three times (PROV-03: a failed run still gets a run record).
- All three leaves additionally assert session survival: a known-good
  program (`seedGoodProgram`) is seeded into the SAME store/root alongside
  the failing one, and after the failing call, a second
  `fjsRunTool.handle` call against the SAME threaded virtual `State`
  succeeds (`assertSessionSurvivesAFollowingCall`) — proving "never a
  dropped connection," not merely "never a process crash."

## Task Commits

1. **Task 1: Non-Error-throw and missing-hash proof leaves** - `220916a` (feat)
2. **Task 2: Import-failure leaf and session-survival assertions for all three** - `0db89ce` (feat)

_No TDD RED/GREEN split was used — as with Plan 06, `tdd="true"` here meant "write the proof alongside no implementation changes in the same commit" (this plan is purely additive proof coverage over Plan 06's already-shipped code, per the plan's own objective text), each commit's diff verified green before committing._

## Files Created/Modified

- `fjs/server/fjs_run/module.f.js` - added imports (`do_`, `readUtf8File`,
  `vec8`, `materializeHome`, `programPath`, plus `CasOp`/`State` type
  imports); a local `unsafeDo` escape hatch; three proof-support helpers
  (`assertPersistedErrorRunRecord`, `seedGoodProgram`,
  `assertSessionSurvivesAFollowingCall`); and a new
  `proof.fjsRunTool.errorTaxonomy` group with the three leaves described
  above.

## Decisions Made

- Session survival is proven via a second `fjsRunTool.handle` call against
  the same threaded `State`, not a full `financeMcpServer`/`mcpStep` session,
  because `fjsRunTool` is not yet wired into `financeMcpServer`'s registry
  (deferred to Plan 09 per 07-06-SUMMARY.md). The plan's own Task 2 action
  text explicitly names this as an acceptable, smaller-scoped equivalent
  provided it is documented — which it is, in
  `assertSessionSurvivesAFollowingCall`'s own doc comment.
- The missing-hash leaf deliberately uses a well-formed-but-unwritten hash
  (not a malformed string) so its proof exercises a different branch inside
  `executeRun` than 07-06's own `missingHashShortCircuitsBeforeMaterializeOrInterpret`,
  avoiding a duplicate proof of the same code path at a different layer.
- The import-failure leaf reuses the "absent `JsModule` fixture" technique
  rather than constructing a new kind of broken `import_` effect, since the
  plan's own text names this as the easier, already-established construction
  and it exercises a branch (`import_` itself failing) distinct from the
  dirty-specifier proof already covering `checkSpecifiers`.

## Deviations from Plan

None — plan executed exactly as written. Both tasks' acceptance criteria are
met: each leaf drives the full `fjsRunTool.handle` (never an internal
helper), asserts the handler's own `isError`, asserts a persisted
`status:'error'` run record, and asserts session survival via a following
call. The missing-hash leaf's "materialization never attempted" claim is a
real behavioral check (`readUtf8File` against the real materialize path),
not an inference from the returned text.

## Issues Encountered

- An early draft duplicated the `Report` type import (already present in the
  module via `/** @import { Report } from '../../run/module.f.js' */`... —
  actually via `../../guest/module.f.js`), which `tsc` reported as
  `TS2300: Duplicate identifier 'Report'`. Fixed by importing only `CasOp`
  in the new `@import` line and relying on the module's pre-existing
  `Report` import.
- Verified the new leaves are not vacuously passing: temporarily inverted
  `assertEq(callResult.isError, true)` to `assertEq(callResult.isError,
  undefined)` across the file and re-ran `npm test` — all three new
  `errorTaxonomy` leaves (and the pre-existing `errorPath` leaf) failed as
  expected, confirming the assertions are load-bearing. Reverted immediately
  after, confirmed green again (185/185).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- EXEC-12's full taxonomy (non-`Error` throw, missing hash, import failure)
  is now proven end-to-end through the fully-assembled `fjsRunTool`, each
  with provenance and session-survival coverage. No blockers.
- Wiring `fjsRunTool` into `financeMcpServer`'s registry (and, at that point,
  re-proving session survival through a real `tools/list`/`ping` over the
  full `mcpStep` transport rather than a second bare `handle()` call) remains
  Plan 09's own documented follow-up, unchanged from 07-06-SUMMARY.md.

---
*Phase: 07-fjs-run-run-records-and-the-week-1-convergence*
*Completed: 2026-08-05*

## Self-Check: PASSED

- FOUND: fjs/server/fjs_run/module.f.js
- FOUND commit: 220916a
- FOUND commit: 0db89ce
- `npx tsc` exits 0, no output
- `npm test`: 185/185 pass
- Project-local proof count (`node --test 2>&1 | grep -c '^✔ import("./fjs/'`): 181 before -> 184 after (strictly greater, as required)
- `git status --porcelain` clean after both task commits
