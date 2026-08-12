---
phase: 15-realism-polish-and-upstream
plan: 03
subsystem: mcp-server
tags: [functionalscript, fjs_check, mcp, guest-abi, security-documentation, mutation-testing]

# Dependency graph
requires:
  - phase: 06
    provides: "fjs/guest/materialize's loadProgram/checkSpecifiers — import-and-inspect, already separate from invoke"
  - phase: 07
    provides: "fjs/server/fjs_run's executeRun five-step sequence (hash -> CAS -> materialize -> load -> interpret) and the fjs-run-integration.test.js real-process harness"
provides:
  - "fjs/guest/check/module.f.js — fjsCheck: import a stored program, confirm it exports a callable report, never invoke it"
  - "The fjs_check MCP tool, registered in financeMcpHandlers alongside fjs_run"
  - "A real-process proof that fjs_check is reachable from a genuine MCP tools/call and never invokes the loaded report, decisive against a report that would throw if called"
affects: [15-06, phase-16]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Decomposed materialize/load test helper (mirrors fjs_run's runExecuteRunViaFixture) for a virtual-level proof of an 'ok' outcome, given fjs/effects/node/virtual's writeFile/import_ representational incompatibility at the same path"
    - "Real-process 'would-throw-if-invoked' program paired with a following-call session-survival assertion, as the decisive proof of non-invocation against the shipped, composed function — the virtual-level proof structurally cannot exercise it"

key-files:
  created:
    - fjs/guest/check/module.f.js
  modified:
    - fjs/server/module.f.js
    - fjs-run-integration.test.js
    - README.md

key-decisions:
  - "The unit-level never-executes proof calls a decomposed test helper (runFjsCheckViaFixture), not the composed fjsCheck export itself, because fjs/effects/node/virtual cannot produce an 'ok' outcome from a single call through materializeProgram+loadProgram at the same path (the identical, already-documented limitation fjs_run's own executeRun has). This was discovered by mutation, not assumed: adding a real report invocation to fjsCheck's own body left the unit suite green. Documented explicitly in the helper's own docstring, with the decisive proof against the REAL composed export deferred to the real-process integration test."
  - "The real-process fjs_check proof (Task 2) uses a program whose report would THROW if invoked, paired with a following-call session-survival assertion, as the decisive evidence against the shipped tool. A spy flag cannot cross a real process boundary; a throw during a step's synchronous continuation is uncaught anywhere in fjs/protocol/mcp/module.f.js's dispatch path, so invocation would crash the connection or the whole server — confirmed by mutation (see below)."
  - "Corrected the module docstring's 'no security value' phrase from 'NO security value' (uppercase) to lowercase mid-plan, since Task 2's own acceptance criteria greps case-sensitively for the exact lowercase phrase across all three required places."

requirements-completed: [MCP-09]

# Metrics
duration: 45min
completed: 2026-08-11
---

# Phase 15 Plan 03: fjs_check (MCP-09) Summary

**`fjs_check(hash)` imports a stored program and confirms it exports a callable `report` without ever invoking it — proven not by a fast return but by a spy the program itself would trip if run (unit level) and by a program that would crash the server if invoked (real-process level) — registered as an MCP tool and documented, in three independent places, as having zero security value.**

## Performance

- **Duration:** ~45 min
- **Tasks:** 2 completed
- **Files modified:** 1 created, 3 modified

## Accomplishments

- Built `fjs/guest/check/module.f.js`: `fjsCheck` reuses `executeRun`'s own steps 1-3 (resolve hash, read source, materialize) then `loadProgram`, and stops — the `typeof loaded.report === 'function'` check is the last line that ever touches the loaded module
- Proved the never-executes property with a spy-based leaf (mirroring `dirtySourceIsRefusedWithoutEvaluatingTheModuleBody`'s technique, spying on the *returned* `report` function rather than the module body), paired with a control leaf proving the same spy DOES flip under direct invocation
- Proved `exportsReport: false` is a successful smoke check (never an error) for a program with no `report` export at all, and separately for one whose `report` is not a function
- Registered `fjs_check` as an MCP tool (`fjsCheckTool`) in `financeMcpHandlers`, joining `fjsRunTool`
- Fixed the mandatory real-process reachability requirement: `fjs-run-integration.test.js`'s self-enforcing `toolsCalled`/`advertisedTools` equality assertion now passes because `fjs_check` is called in the same live session, and the call itself is paired with a decisive proof of non-invocation against a program whose `report` would throw if called
- Stated `fjs_check`'s zero security value in all three required places: the module docstring, the MCP tool description, and README.md

## Task Commits

Each task was committed atomically:

1. **Task 1: fjsCheck's pure logic — import and confirm, never execute — plus its never-executes proof** - `14a9881` (feat)
2. **Task 2: Register fjs_check, state its zero security value twice more, and fix the mandatory real-process coverage check** - `9a4dcdd` (feat)

## Files Created/Modified

- `fjs/guest/check/module.f.js` - `fjsCheck` (the pure import-and-confirm logic) plus its never-executes proof, control leaf, and `exportsReport: false` leaf
- `fjs/server/module.f.js` - `fjsCheckTool` (the MCP tool wrapper), added to `financeMcpHandlers` after `fjsRunTool`
- `fjs-run-integration.test.js` - `fjs_check` called against the already-materialized `programHash`, plus a second call against a would-throw-if-invoked program with a following-call session-survival check
- `README.md` - one paragraph stating `fjs_check` has no security value

## Decisions Made

- **The unit-level proof cannot call `fjsCheck` itself for the success path — discovered by mutation, not assumed.** `fjs/effects/node/virtual`'s `writeFile` (array-of-`Vec`) and `import_` (`JsModule` function) representations are incompatible at the SAME path within the SAME session — the exact, already-documented limitation `fjs/server/fjs_run/module.f.js`'s own `executeRun` has, which is why that file's own success-path proofs use a decomposed helper (`runExecuteRunViaFixture`) rather than calling `executeRun` directly. I initially assumed I could call the composed `fjsCheck` export directly for the never-executes leaf; adding a real `loaded.report(...)` invocation to `fjsCheck`'s own body and re-running the unit suite left it fully green — proving the leaf, as first written, exercised a copy of the logic, not the shipped function. Fixed by writing `runFjsCheckViaFixture`, the same decomposition technique, and documenting the gap explicitly in its own docstring rather than silently shipping a decorative proof.
- **The decisive proof against the shipped, composed `fjsCheck` lives in the real-process integration test, not the unit suite** — mirroring exactly why `fjs-run-integration.test.js` is `executeRun`'s own decisive success proof. A program whose `report` would throw if invoked, paired with a following-call session-survival assertion, is the real-process equivalent of a spy: a throw during a `step` continuation is uncaught anywhere in `fjs/protocol/mcp/module.f.js`'s dispatch path, so invocation crashes the connection. Verified by mutation (see below): adding the SAME real invocation to `fjsCheck`'s production body made the real-process test hang and time out, naming the thrown error and its stack, exactly the crash the design predicts.
- **Corrected the module docstring's security-value phrase to lowercase mid-plan.** Task 2's acceptance criteria greps case-sensitively for `"no security value"` across all three required files; the module docstring originally read "This has **NO** security value" (emphasis via uppercase), which the grep missed. Caught while verifying Task 2's own acceptance criteria, fixed, re-verified across all three files.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The never-executes proof, as first written, did not exercise the composed `fjsCheck` export for its decisive assertion**

- **Found during:** Task 1, while performing AGENTS.md's mandatory "watch it fail" mutation check.
- **Issue:** The leaf called a test helper that duplicated `fjsCheck`'s materialize/load tail rather than calling `fjsCheck` itself (unavoidable under `virtual`'s representational split — see Decisions above). Verified concretely: adding `loaded.report(guestCtx)([])` to `fjsCheck`'s own production body and re-running `node --test all.test.js` left the suite green, 3110/3110.
- **Fix:** Documented the gap explicitly in `runFjsCheckViaFixture`'s own docstring (this is the SAME, already-accepted relationship `runExecuteRunViaFixture` has to `executeRun` in this exact codebase) and moved the decisive proof of the real composed function to Task 2's real-process integration test.
- **Files modified:** fjs/guest/check/module.f.js (docstring only; no logic change — the unit-level leaves are still correct proofs of the underlying mechanism, just not of the single-call composition)
- **Verification:** Re-ran the mutation after adding the real-process proof (Task 2): the same production-body mutation now causes `fjs-run-integration.test.js` to time out waiting for a response, naming the thrown error at the exact production call site. Reverted; `git diff` against the committed file is empty.
- **Committed in:** 14a9881 (the docstring's honest account of the limitation was written into the initial commit; the decisive real-process proof landed with Task 2, 9a4dcdd)

**2. [Rule 1 - Bug] "No security value" phrase was uppercase, missing the case-sensitive grep**

- **Found during:** Task 2, while verifying the acceptance criteria's `grep -c "no security value" fjs/server/module.f.js README.md fjs/guest/check/module.f.js` command.
- **Issue:** `fjs/guest/check/module.f.js`'s docstring read "This has **NO** security value" — semantically identical, but the required exact-phrase grep is case-sensitive and reported 0 for this file.
- **Fix:** Changed "NO" to lowercase "no", matching the phrase used in `fjs/server/module.f.js` and README.md.
- **Files modified:** fjs/guest/check/module.f.js
- **Verification:** Re-ran the grep across all three files; each now reports 1.
- **Committed in:** 9a4dcdd

---

**Total deviations:** 2 auto-fixed (1 bug in the proof's own rigor, caught by AGENTS.md's mandatory mutation-watch discipline; 1 wording bug caught by the plan's own acceptance-criteria grep).
**Impact on plan:** Both were necessary for the plan's own stated success criteria (a decisive non-execution proof against the shipped tool; the three-place documentation requirement). No scope creep — neither touches the fjs_run/DOC-16/PROV-06/PROV-08/TAX-17 work of sibling plans.

## Issues Encountered

None beyond the two deviations above.

**Mutation verification performed (AGENTS.md discipline: "a proof is not known to work until you have watched it fail"):**

- Task 1: added `if (typeof loaded.report === 'function') { loaded.report(guestCtx)([]) }` to `fjsCheck`'s production body (a would-be regression that invokes the report). `node --test all.test.js` stayed green, 3110/3110 — revealing the unit-level proof's gap (see Decisions/Deviations above). Reverted; `git diff` empty.
- Task 1 (positive control): mutated the dirty-import-specifier leaf's own `loadProgram([])` call to `loadProgram(['node:fs'])` (widening the allow-list) — the leaf correctly turned red, reporting `"... is not a JsModule"` instead of the expected `node:fs` refusal message, confirming the leaf is load-bearing. Reverted; `git diff` empty.
- Task 2 (the decisive proof): re-applied the SAME production-body mutation from Task 1 after Task 2's real-process proof existed. `node --test fjs-run-integration.test.js` failed with `Error: timed out waiting for response id 18`, naming the thrown `Error: fjs_check must never invoke report` and its exact stack trace through `fjs/guest/check/module.f.js:92` — the real server process crashed mid-request, exactly the decisive evidence the design predicts. Reverted; `git diff --stat` against the committed file showed no changes.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- MCP-09 is fully delivered: `fjs_check(hash)` is registered, reachable from a real MCP `tools/call` in the same live session `fjs_run` uses, proven never to execute the loaded report at both the unit level (spy + control) and the real-process level (would-throw program + session survival), and its zero security value is stated in the module docstring, the MCP tool description, and README.md.
- `fjs/server/module.f.js` was edited minimally and additively (one import, one `fjsCheckTool` export, one array entry) — Plan 15-06, which also edits this file in wave 2, should land cleanly on top. The existing `toolsCalled`/`advertisedTools` equality assertion is satisfied, not weakened.
- `npm test`: **6230/6230 passing, 0 failures, 0 cancelled**, `tsc` clean.
- De-duplicated project-local proof count moved from 868 (end of Plan 15-02) to **874** (6 new leaves in `fjs/guest/check/module.f.js`), confirmed via `node --test 2>&1 | grep '^✔ import("./fjs/' | sed 's/ ([0-9.]*ms)$//' | sort -u | wc -l`.
- Plans 15-01, 15-02, 15-04, 15-05, 15-06 (PROV-08, TAX-17, PROV-06, DOC-16) are unaffected by and independent of this plan's files.

---
*Phase: 15-realism-polish-and-upstream*
*Completed: 2026-08-11*

## Self-Check: PASSED

All claimed files exist on disk and both task commits are present in `git log --oneline --all`:

- `fjs/guest/check/module.f.js` — FOUND
- `.planning/phases/15-realism-polish-and-upstream/15-03-SUMMARY.md` — FOUND
- `14a9881` (Task 1) — FOUND
- `9a4dcdd` (Task 2) — FOUND
