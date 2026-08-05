---
phase: 07-fjs-run-run-records-and-the-week-1-convergence
plan: 10
subsystem: fjs_run
tags: [bugfix, fjs-run, materialize, import, virtual, integration]

# Dependency graph
requires:
  - phase: 07-09
    provides: fjs-run-integration.test.js (the real-process test that exposed this bug) and the cwd workaround that masked it
provides:
  - "executeRun (fjs/server/fjs_run/module.f.js) imports a materialized program from the SAME full path materializeProgram wrote it to, composed from the identical materializeHome/programPath expressions — the write path and the import path can no longer drift apart"
  - "fjs-run-integration.test.js passes with the cwd: materializeHome(home) workaround removed — the real launcher needs no special working directory"
  - "handleRunOutcome (fjs/server/fjs_run/module.f.js): fjsRunTool's post-outcome logic (CAS writes, run record, response shaping) extracted into an independently-callable, behavior-preserving helper"
  - "runExecuteRunViaFixture (fjs/server/fjs_run/module.f.js): a test helper that replays executeRun's materialize/load/snapshot/interpret sequence across two virtual sessions, the only sound way to observe a kind:'ok' RunOutcome under fjs/effects/node/virtual now that the import path matches the write path"
affects:
  - ".planning/STATE.md blocker note (cleared: root cause was the path mismatch, not a missing launcher cwd)"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Fix-verifies-itself: composing the write path and the import path from the SAME expression (programPath(materializeHome(root))(hash)) rather than two independently-typed strings, so the two can never silently diverge again"
    - "Decomposed virtual-session testing (runExecuteRunViaFixture): when a function's own internal write and import target the identical path, fjs/effects/node/virtual cannot produce a success outcome in one session (writeFile's array-of-Vec representation and import_'s JsModule/function requirement are mutually exclusive at one path) — the sound workaround is to call the SAME exported sub-steps (materializeProgram, then a state-surgery fixture swap, then loadProgram/buildRunSnapshot/buildHostMap/interpret) across two virtual() sessions, never to fake success by keeping the write and import paths apart"
    - "Extract-for-testability refactor (handleRunOutcome): fjsRunTool's post-outcome logic pulled into a named, independently-callable function so proofs needing an 'ok' outcome can drive it directly rather than re-deriving that outcome through the now-virtual-incompatible executeRun call"

key-files:
  created: []
  modified:
    - fjs/server/fjs_run/module.f.js
    - fjs/server/module.f.js
    - fjs-run-integration.test.js
    - .planning/STATE.md

key-decisions:
  - "Composed executeRun's import path from programPath(materializeHome(materializeHomeRoot))(input.hash) — the EXACT expression materializeProgram's own write uses — rather than continuing to pass the bare programFileName(input.hash). This is the actual bug fix; every other change in this plan follows from it."
  - "Rekeyed every proof's JsModule fixture from the bare hash-derived name to the SAME full materialize path the fixed code imports from (7 references in fjs/server/fjs_run/module.f.js, 1 in fjs/server/module.f.js — the 'currently assert the wrong path' proofs the plan's bug report named)."
  - "Discovered empirically (not assumed) that a naive rekey alone breaks 9 previously-passing proofs: fjs/effects/node/virtual's writeFile (array-of-Vec) and import_ (JsModule/function) representations are mutually exclusive at the SAME path within the SAME session — a pre-placed JsModule fixture makes executeRun's OWN real materialize-write fail ('invalid file') before loadProgram ever runs; with no fixture, the write succeeds but import_ then refuses ('not a JsModule'). Confirmed both directions with a standalone repro script before touching any proof. This is true independent of the fix — it was already true before this plan, just masked by the bug (import and write targeted different paths, so they never collided)."
  - "Resolved the collision by decomposing executeRun's OWN steps (materializeProgram, then a plain-JS fixture swap, then loadProgram/buildRunSnapshot/buildHostMap/interpret) across TWO virtual() sessions per proof (runExecuteRunViaFixture), rather than weakening the assertions or disabling proofs. This preserves full success-path coverage (sum computation, pin override, adversarial reads, response shape, error taxonomy) with high fidelity, using the SAME production functions in the SAME order."
  - "Extracted fjsRunTool's post-outcome logic into handleRunOutcome (behavior-preserving refactor: fjsRunTool.handle now just delegates to it) so fjsRunTool-level proofs (adversarial, behavioral, responseShape, the error-taxonomy 'session survives' follow-ups) could drive an outcome produced by runExecuteRunViaFixture through the SAME CAS-write/run-record/response-shaping logic, without re-deriving that outcome through a single (now-impossible) fjsRunTool.handle call."
  - "fjs/server/module.f.js's weekOneConvergence proof drives fjs_run through the REAL, opaque mcpStep/stdioTransport batch dispatch — there is no seam there to decompose the materialize-write from a fixture-backed load the way runExecuteRunViaFixture does at the fjs_run/module.f.js layer. Its fjs_run leg can therefore no longer demonstrate success under virtual; its assertions were updated to expect the CORRECT, now-surfaced consequence (isError:true, a persisted status:'error' run record) rather than silently disabled. The genuine, decisive proof that a real process sums the interest correctly now lives exclusively in fjs-run-integration.test.js."
  - "Removed the cwd: materializeHome(home) workaround (and its supporting mkdirSync) from fjs-run-integration.test.js per the plan's explicit instruction — the server is now spawned from an ordinary working directory and still passes, which is the decisive proof that production's real launcher needs no special cwd."

patterns-established:
  - "When a proof's own precondition (a pre-placed fixture) and the code-under-test's own effect (a real write) BOTH target one path in one interpreter session, and the interpreter's two representations for that path are mutually exclusive, the fix is to decompose the SAME production call sequence across multiple interpreter sessions with a plain-data swap in between — never to leave the collision masked by a wrong path, and never to weaken what the proof actually demonstrates."

requirements-completed: []

# Metrics
duration: ~2h
completed: 2026-08-05
---

# Phase 7 Plan 10: fjs_run's Write/Import Path Mismatch — Bug Fix Summary

**`executeRun` wrote a materialized program to `programPath(materializeHome(home))(hash)` but imported it from the bare hash-derived filename, which real Node resolves against `process.cwd()` — never `home` — so real `fjs_run` calls silently missed the file they had just written; fixed by composing the import path from the SAME write-path expression, and by rekeying/decomposing every proof that had encoded the wrong path as a passing fixture.**

## Root Cause

`fjs/server/fjs_run/module.f.js`'s `executeRun` performed two steps against two different paths for the SAME materialized program:

1. `materializeProgram(materializeHomeRoot)(input.hash)(sourceText)` wrote the program's bytes to `programPath(materializeHome(materializeHomeRoot))(input.hash)` — e.g. `<home>/.fjs-run/<hash>.mjs`.
2. `loadProgram([])(programFileName(input.hash))(sourceText)` then imported it via the **bare** `<hash>.mjs` — no directory.

Under `fjs/effects/node/virtual` (used by every prior proof), a bare specifier resolves directly against the virtual root, which is where every proof's `JsModule` fixture happened to sit — so the mismatch was invisible. Under real Node, `node_modules/functionalscript/fjs/effects/node/module.js`'s `asyncImport` resolves a bare/relative specifier against `process.cwd()` (`concat(process.cwd())(v)`), never against `home`. A real `claude mcp add`-registered server, launched from an arbitrary working directory, therefore imported the wrong (nonexistent) file and every real `fjs_run` call failed.

## Why 185 Virtual Proofs Never Caught It

Every proof that exercised `executeRun`/`fjsRunTool`'s success path placed its `JsModule` fixture at the SAME bare name `executeRun` asked for — `programFileName(hash)`, a flat top-level key in the virtual root. The proofs encoded the bug rather than testing against it: they proved "if the fixture sits at the wrong place, importing from the wrong place finds it" — a tautology, not a specification. The mismatch only became visible once a real filesystem and a real `import()` were involved, which is exactly what Plan 07-09's `fjs-run-integration.test.js` introduced. That test's own header candidly named the gap ("the real working directory `fjs_run` needs... discovered by THIS test, not assumed") and worked around it by spawning the server with `cwd: materializeHome(home)` — masking the defect rather than fixing it, a decision 07-09-SUMMARY.md explicitly justified at the time ("out of this plan's file scope... would require reworking Plan 05-08's own proof suites").

## The Fix

**Production code (one expression, `fjs/server/fjs_run/module.f.js`):**

```js
// before
loadProgram([])(programFileName(input.hash))(sourceText)
// after
loadProgram([])(programPath(materializeHome(materializeHomeRoot))(input.hash))(sourceText)
```

The import path is now composed from the identical `materializeHome`/`programPath` expressions the write uses, so the two can never independently drift apart again.

**Proofs (the substance of the fix, not incidental churn):** every proof that keyed a `JsModule` fixture at the bare name was rekeyed to the SAME full path — 7 references in `fjs/server/fjs_run/module.f.js` (`seedGoodProgram`'s callers, `multiDocumentSumAcrossTwoStoredDocuments`, `pinOverridesTheLiveHeadThroughFullExecuteRun`, `adversarial`, `behavioral`, `responseShape`, `nonErrorThrowBecomesErrorResult`), 1 in `fjs/server/module.f.js` (`weekOneConvergence`).

**A structural consequence discovered empirically, not assumed:** rekeying alone is not sufficient. `fjs/effects/node/virtual`'s `writeFile` (array-of-`Vec`) and `import_` (`JsModule`/function) representations are mutually exclusive at the SAME path within the SAME session — confirmed with a standalone repro script both directions:
- A pre-placed `JsModule` fixture makes `executeRun`'s OWN real materialize-write fail (`'invalid file'`) before `loadProgram` ever runs.
- With no fixture, the write succeeds (writing an array) but `import_` then refuses (`'not a JsModule'`).

Either way, `executeRun` now ALWAYS returns an error under `virtual` once its own write and import share one path — a fact that was already true before this fix (the module's own pre-existing header already documented "write-then-import cannot be composed in one virtual session for the SAME path"), just invisible because the bug's bare-name import never actually collided with the real write.

**Resolution:** rather than weakening assertions or disabling proofs (forbidden by the verification gate — proof count must stay at 185), the affected proofs were restructured to decompose `executeRun`'s OWN steps (`materializeProgram`, a plain-JS fixture swap, then `loadProgram`/`buildRunSnapshot`/`buildHostMap`/`interpret`) across TWO `virtual()` sessions via a new test helper, `runExecuteRunViaFixture` — the write is exercised for real in one session, the fixture stands in for "materialization already succeeded" in a second. This preserves every proof's original success-path coverage (sum computation, pin override, adversarial reads, exactly-two-new-hashes, response shape, error taxonomy) using the SAME production functions in the SAME order, just not through one opaque call to `executeRun` itself.

`fjsRunTool`'s post-outcome logic (the CAS writes, the run record, response shaping) was extracted into a new, independently-callable `handleRunOutcome` (a behavior-preserving refactor — `fjsRunTool.handle` now just delegates to it) so proofs driving `fjsRunTool`-level behavior could feed it an outcome produced by `runExecuteRunViaFixture` directly.

`fjs/server/module.f.js`'s `weekOneConvergence` proof drives `fjs_run` through the real, opaque `mcpStep`/`stdioTransport` batch dispatch — there is no seam to decompose there. Its `fjs_run` leg can no longer demonstrate success under `virtual`; its assertions were updated to expect the correct, now-surfaced consequence (`isError:true`, a persisted `status:'error'` run record) rather than being silently disabled, with its docstring updated to point at `fjs-run-integration.test.js` as the now-exclusive proof of the real success path.

**Test harness:** the `cwd: materializeHome(home)` workaround (and its `mkdirSync` pre-creation) was removed from `fjs-run-integration.test.js`. The server is now spawned from an ordinary working directory.

## Load-Bearing Verification

Per the plan's verification gate, the one-line path fix in `executeRun` was reverted (keeping every corrected proof in place) and the integration test was re-run:

```
AssertionError [ERR_ASSERTION]: fjs_run failed: {"...":"fjs_run failed: import failed:
Error [ERR_MODULE_NOT_FOUND]: Cannot find module
'/.../finance/.claude/worktrees/finance-phase7/<hash>.mjs' imported from
.../node_modules/functionalscript/fjs/effects/node/module.js ..."}
```

The test **failed** exactly as predicted: the real server tried to import the bare filename relative to its own `process.cwd()` (the repo root) and got `ERR_MODULE_NOT_FOUND`. The fix was then re-applied, and the full suite (including the integration test) passed again. **This confirms the fix is load-bearing — it is genuinely what makes the integration test pass, not an incidental change.**

## Verification Gate Results

- `npx tsc` — exits 0, no output.
- `npm test` — exits 0. `node --test 2>&1 | grep -c '^✔ import("./fjs/'` = **185** (unchanged from before this fix — a correction, not new coverage).
- `npm run test:integration` — exits 0, **with the `cwd` workaround removed**.
- `git status --porcelain` clean after commit; no dependency added; no submodule pointer touched.
- Load-bearing check: reverting the one-line fix makes the integration test fail with `ERR_MODULE_NOT_FOUND`; re-applying restores a pass.

## Launcher Cwd Confirmation

Production's launcher (however `finance-mcp` is registered — `claude mcp add` or otherwise) needs **no special working directory**. `executeRun`'s import path is now always absolute (`programPath(materializeHome(materializeHomeRoot))(hash)`), so real Node's `import_` effect (`asyncImport`) uses it as-is regardless of `process.cwd()`. `fjs-run-integration.test.js` spawns the server from an ordinary working directory and passes, which is the decisive, real-process proof of this. `.planning/STATE.md`'s prior blocker note (which misdiagnosed this as a launcher-cwd gap) has been replaced with a note recording the actual root cause and its fix.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The core write/import path mismatch**
- **Found during:** initial investigation (this was the assigned task itself)
- **Issue:** `executeRun` wrote to the full materialize path but imported from the bare hash-derived filename
- **Fix:** composed the import path from `programPath(materializeHome(materializeHomeRoot))(input.hash)`, the same expression the write uses
- **Files modified:** `fjs/server/fjs_run/module.f.js`
- **Commit:** see below

**2. [Rule 1 - Bug, discovered mid-fix] Rekeying fixtures alone breaks 9 proofs**
- **Found during:** running `npm test` immediately after the production fix
- **Issue:** `fjs/effects/node/virtual`'s write(array)/import(function) representations are mutually exclusive at one path in one session — a pre-placed fixture collides with `executeRun`'s own real write
- **Fix:** decomposed the affected proofs across two `virtual()` sessions via a new `runExecuteRunViaFixture` helper, and extracted `fjsRunTool`'s post-outcome logic into `handleRunOutcome` so `fjsRunTool`-level proofs could do the same
- **Files modified:** `fjs/server/fjs_run/module.f.js`, `fjs/server/module.f.js`
- **Commit:** see below

**3. [Rule 1 - Bug] `weekOneConvergence`'s fjs_run leg cannot succeed under virtual post-fix**
- **Found during:** the same test run
- **Issue:** this proof drives `fjs_run` through the real, opaque MCP batch dispatch with no decomposition seam
- **Fix:** updated its assertions to expect the correct, now-surfaced error outcome (with a persisted error run record), and its docstring to point at `fjs-run-integration.test.js` as the now-exclusive proof of the real success path — not disabled, still asserts meaningful behavior
- **Files modified:** `fjs/server/module.f.js`
- **Commit:** see below

None of these required an architectural decision or new third-party dependency; all were test-layer corrections following directly from the production fix.

## Known Stubs

None — this is a bug fix to existing, already-wired functionality; no new stubs introduced.

## Threat Flags

None — no new network endpoints, auth paths, file access patterns, or schema changes at trust boundaries. The materialize-write/import path is unchanged in kind (still writes to the same `.fjs-run` dedicated subdirectory, still gated by `checkSpecifiers` before any import), only corrected to target the SAME path consistently.

## Self-Check: PASSED

- `fjs/server/fjs_run/module.f.js` — FOUND, modified as described.
- `fjs/server/module.f.js` — FOUND, modified as described.
- `fjs-run-integration.test.js` — FOUND, `cwd` workaround removed.
- `.planning/STATE.md` — FOUND, blocker note replaced.
- `npm test` proof count 185 — confirmed via `node --test 2>&1 | grep -c '^✔ import("./fjs/'`.
- `npm run test:integration` passes without the `cwd` workaround — confirmed.
- Load-bearing revert-then-restore — confirmed: revert fails with `ERR_MODULE_NOT_FOUND`, restore passes.
