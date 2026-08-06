---
phase: 07-fjs-run-run-records-and-the-week-1-convergence
plan: 09
subsystem: testing
tags: [integration, e2e, real-process, stdio, mcp, fjs-run, week-1]

# Dependency graph
requires:
  - phase: 07-08
    provides: financeMcpHandlers wired with financeSchemaTool/fjsRunTool; the Week 1 convergence proven under fjs/effects/node/virtual
provides:
  - "fjs-run-integration.test.js: a real-process JSON-RPC integration test proving fjs_run's write-then-import seam against a real filesystem — the one assertion no virtual proof can make"
  - "Full tool-surface coverage (TEST-02), self-enforcing: every fjs/server tool discovered at runtime from tools/list is called at least once, and a tool added later without coverage fails this test"
  - "MCP-05's stdout-is-always-JSON-RPC invariant, proven against a real process for the first time"
  - "package.json test:integration script separating the real-process layer from the fast tsc && node --test loop"
  - "Discovery and fix of the real 'working directory' gap 07-06-SUMMARY.md deferred to this plan: executeRun's bare hash-derived filename resolves against process.cwd() in real Node, not against home; the real server must be spawned with cwd = materializeHome(home)"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Root-level impure .test.js with @ts-nocheck, following cas-refresh-cross-process.test.js's precedent exactly: spawn/handshake/framing/teardown plumbing reused, subject matter (fjs_run, not cas_refresh) is new"
    - "Readiness proven by matching the initialize response's own JSON-RPC id via a poll loop, never by a fixed sleep — the setTimeout in the poll loop is a delay between checks, not the readiness signal itself"
    - "Seeding done through the REAL cas_add MCP tool over the real session (not a separate CLI subprocess or direct filesystem write) — cas_add's own handler folds a recognized vnd.fjs.revision blob into the live Evo cache via syncRevision as it is written, so revisions are visible to evo_head/evo_list without a restart or an explicit cas_refresh"
    - "The guest report program is authored as literal, real ESM source text (zero imports, per SEC-02's checkSpecifiers gate) rather than a JsModule fixture — because this test's whole point is that the bytes are really written to disk and really import()ed, which a JsModule fixture cannot exercise"
    - "Tool coverage is self-enforcing: the tool set is read from the real tools/list response at runtime and compared by equality against the set of tools actually called in the same session, so a tool added in a later phase without integration coverage fails this test rather than passing unnoticed"

key-files:
  created:
    - fjs-run-integration.test.js
  modified:
    - package.json

key-decisions:
  - "Fixed the real working directory gap at the TEST-HARNESS level (spawn's cwd option), not by modifying fjs_run/module.f.js's executeRun. Changing executeRun to pass loadProgram the full programPath instead of the bare filename would break every existing virtual proof of executeRun/fjsRunTool structurally: fjs/effects/node/virtual's import_ rejects any path with more than one segment outright (verified in fjs/guest/materialize/module.f.js's own header), so a full path would fail under virtual regardless of which key a JsModule fixture is placed at — that is out of this plan's file scope (fjs/server/fjs_run/module.f.js is not in files_modified) and would require reworking Plan 05-08's own proof suites. The in-scope, correct fix is the wiring 07-06-SUMMARY.md explicitly named as 'Plan 09's own territory': the real server process's cwd is set to materializeHome(home), created via mkdirSync before spawn (spawn's cwd option requires the directory to already exist, mirroring materializeProgram's own unconditional mkdir(..., { recursive: true }))."
  - "Seeded all CAS content (three 1099-INT documents, three raw vnd.fjs.revision blobs, the program source) through the real cas_add MCP tool over the live session, rather than a separate `npx functionalscript cas add` subprocess (the technique cas-refresh-cross-process.test.js uses for its own, larger-than-128KiB fixture). cas_add's own handler already folds a recognized revision blob into the live Evo cache via syncRevision, so no cas_refresh call was needed to make the seeded documents visible — cas_refresh is still called once, later, purely for TEST-02's tool-coverage requirement."
  - "The program source's summing logic is written as a literal JS string (not composed from guestCtx fixture functions) because it is materialized to a REAL file and REALLY import()ed by the real server — a JsModule fixture (used by every prior virtual proof) has no bytes to write."

patterns-established:
  - "Pattern (07-09): a real-process integration test discovers wiring gaps invisible to any virtual proof (here: the import_ working-directory dependency) and fixes them at the harness/deployment-wiring layer, not by reworking the module under test — preserving every existing virtual proof suite while still closing the real gap for real usage."

requirements-completed: [TEST-01, TEST-02, TEST-04]

# Metrics
duration: ~20min
completed: 2026-08-04
---

# Phase 7 Plan 09: The Real-Process Integration Test Summary

**A genuinely separate `node index.js <home>` OS process, driven over real stdin/stdout, proves `fjs_run`'s write-then-import seam against a real filesystem for the first time — and in doing so discovers and fixes the "real working directory" gap 07-06-SUMMARY.md explicitly deferred to this plan: `executeRun`'s bare hash-derived filename resolves against `process.cwd()` in real Node, not against `home`.**

## Performance

- **Completed:** 2026-08-04
- **Tasks:** 2 completed
- **Files modified:** 2 (1 created, 1 modified)

## Accomplishments

- `fjs-run-integration.test.js` (repo root, `@ts-nocheck`, following
  `cas-refresh-cross-process.test.js`'s precedent for the spawn/handshake/
  framing/teardown plumbing): spawns `node index.js <home>` as a genuinely
  separate OS process against a fresh `mkdtemp` CAS home under
  `os.tmpdir()`, drives `initialize` -> `notifications/initialized` ->
  `tools/list` -> `tools/call` over real stdin/stdout, with readiness
  proven by matching each response's own JSON-RPC `id` (never a sleep).
- Seeds three `vnd.fjs.1099int` documents through the REAL `cas_add` tool
  (one with `box1InterestIncome` present at `'1234.56'`, one at `'10.00'`,
  one with the field ABSENT entirely), three raw `vnd.fjs.revision` blobs
  (bypassing `evo_add`, auto-synced into the live cache by `cas_add`'s own
  `syncRevision` call), and a real guest report program's source (literal
  JS text, zero imports, summing every present `box1InterestIncome` via
  `evoList`/`evoHead`/`evoRevision`/`casRead`).
- Calls `finance_schema` (asserts the response names `box1InterestIncome`)
  then the decisive `fjs_run` call: asserts `resultHash`/`runHash` are both
  present, reads both back out of the REAL CAS via `cas_get`, and asserts
  the result equals `1244.56` — computed independently in the test via
  `centsFromString`/`centsToString` on the two present seeded values, never
  a bare literal. The persisted run record's `inputs[]` is asserted to
  contain an `evoHead` read of the absent-field document's own subject,
  proving the program actively visited and skipped it.
- **The decisive, non-mockable assertion:** `existsSync` is true for the
  materialized program `.mjs` at `programPath(materializeHome(home))(programHash)`
  on the REAL filesystem — the assertion no virtual proof can make, because
  `virtual`'s `writeFile`/`import_` are representationally incompatible.
- Full tool coverage (TEST-02): the tool set is read from the real
  `tools/list` response at runtime; every one of the ten advertised tools
  (`cas_add`, `cas_get`, `cas_list`, `cas_refresh`, `evo_add`, `evo_head`,
  `evo_list`, `evo_revision`, `finance_schema`, `fjs_run`) is called at
  least once in the same session; the set actually called is asserted
  equal to the set advertised — self-enforcing against future drift.
- MCP-05's stdout invariant proven against a real process for the first
  time: every line the server wrote to stdout across the whole session is
  asserted to parse as JSON-RPC.
- `package.json` gains a `test:integration` script
  (`node --test fjs-run-integration.test.js`); `npm test`'s own script text
  is unchanged (`tsc && node --test`).

## Task Commits

1. **Task 1: Real-process fjs_run integration test (decisive assertion)** - `ff75c6a` (test)
2. **Task 2: Full tool coverage, MCP-05 invariant, test:integration script** - `ecd7bf5` (test)

## Files Created/Modified

- `fjs-run-integration.test.js` - new root-level impure JS integration
  test; spawns a real `node index.js <home>` process, drives a full MCP
  session, seeds real CAS content via `cas_add`, proves `fjs_run` end to
  end including the real materialize-then-import seam, and proves full
  tool coverage plus MCP-05's stdout invariant against the real process.
- `package.json` - adds the `test:integration` script; no dependency
  added; `test` script text unchanged.

## Decisions Made

- The real working-directory gap (see "Issues Encountered" below) was
  fixed by setting the spawned server's `cwd` to `materializeHome(home)`
  (created via `mkdirSync` before spawn), not by modifying
  `fjs/server/fjs_run/module.f.js`'s `executeRun`. Rationale: `executeRun`
  deliberately passes `loadProgram` the BARE hash-derived filename because
  `fjs/effects/node/virtual`'s `import_` only accepts a single-segment
  path (verified in `fjs/guest/materialize/module.f.js`'s own header) —
  changing this to the full `programPath` would break every existing
  virtual proof of `executeRun`/`fjsRunTool` in Plans 05-08 structurally
  (a full path fails `virtual`'s own path-length check regardless of the
  `JsModule` fixture's key), which is out of this plan's file scope
  (`files_modified` names only `fjs-run-integration.test.js`,
  `package.json`, and this SUMMARY). This is exactly the wiring
  07-06-SUMMARY.md named as "Plan 09's own territory": resolving the
  bare-vs-full materialize path question "for a real running server with a
  real working directory."
- Seeded CAS content through the real `cas_add` MCP tool (over the live
  session) rather than a separate `npx functionalscript cas add`
  subprocess — simpler, and it doubles as coverage for `cas_add` itself.
  `cas_add`'s own handler auto-syncs a recognized `vnd.fjs.revision` blob
  into the live Evo cache, so no `cas_refresh` was needed to seed the
  three documents; `cas_refresh` is still exercised once, afterward, for
  TEST-02's own tool-coverage requirement.
- The `evo_add` tool-coverage call runs AFTER the decisive `fjs_run`
  call, using an already-stored snapshot (`docAHash`) as its `snapshot`,
  so the new subject it creates can never perturb the already-made
  `fjs_run`/total assertions.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Discovered and fixed the real "working directory" gap for `fjs_run`'s materialize-then-import path**

- **Found during:** Task 1, first real run of the decisive `fjs_run` call.
- **Issue:** `executeRun` (`fjs/server/fjs_run/module.f.js`) calls
  `loadProgram([])(programFileName(input.hash))(sourceText)` — the bare
  hash-derived filename. Under `fjs/effects/node/virtual` this works
  because a `JsModule` fixture sits at that bare key in the virtual root.
  Under REAL Node, `import_`'s effect implementation
  (`node_modules/functionalscript/fjs/effects/node/module.js`'s
  `asyncImport`) resolves any specifier that is neither absolute nor a URL
  via `concat(process.cwd())(v)` — i.e., relative to the process's current
  working directory, never relative to `home`. Spawning the server with
  `cwd: repoRoot` (the natural first attempt, matching
  `cas-refresh-cross-process.test.js`'s own convention) produced a real
  `ERR_MODULE_NOT_FOUND` for a path at the repo root, while the file
  `materializeProgram` had actually written sat at
  `home/.fjs-run/<hash>.mjs`. This had never been observed before because
  every prior proof of `fjs_run` (Plans 05-08) ran entirely under
  `virtual`. `07-06-SUMMARY.md` had already anticipated this exact
  question and explicitly deferred it: *"resolving the bare-vs-full
  materialize path question for a real running server with a real working
  directory... is explicitly left for whichever plan performs that
  integration... this is Plan 09's territory."*
- **Fix:** The server is spawned with `cwd: materializeHome(home)`
  (`<home>/.fjs-run`), created via `mkdirSync(materializeHome(home), {
  recursive: true })` immediately before `spawn` (spawn's `cwd` option
  requires the directory to already exist). With this, `executeRun`'s bare
  filename resolves via `process.cwd()` to exactly the path
  `materializeProgram` wrote to, and the real `fjs_run` call succeeds.
- **Files modified:** `fjs-run-integration.test.js` (test-harness spawn
  options only — `fjs/server/fjs_run/module.f.js` was NOT modified).
- **Verification:** Reproduced the failure first (`cwd: repoRoot`),
  confirmed the exact `ERR_MODULE_NOT_FOUND` path mismatch, applied the
  `cwd` fix, confirmed the decisive `fjs_run` call then succeeds and the
  materialized `.mjs` exists at the expected real path.
- **Committed in:** `ff75c6a` (Task 1 commit).
- **Note for follow-up (not fixed here, out of scope):** production's
  actual `claude mcp add` registration (a live local Claude Code
  configuration, not a file tracked in this repo) does not currently set
  this working directory, and would currently fail the same way on any
  real `fjs_run` call. This is a genuine, previously-invisible production
  gap this plan's own real-process testing was designed to catch
  (threat-model entry T-07-09-01) — flagging it here as a concrete
  follow-up for whichever plan next touches server registration/wiring,
  rather than silently working around it only in this test.

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Necessary for the decisive assertion to be reachable
at all — without it, `fjs_run` could never succeed against a real
process, which would have made this entire integration test impossible to
write honestly. No scope creep: the fix lives entirely in the test
harness's own spawn options; `fjs/server/fjs_run/module.f.js` is
untouched.

## Issues Encountered

See "Auto-fixed Issues" above — the working-directory gap was the only
issue encountered, and it was both discovered and resolved within Task 1.

## Non-Vacuousness Check (required by the plan's verification gate)

Performed before each commit, each time reverted after confirming failure:

1. **Materialize assertion:** appended `.never-written` to the asserted
   `materializedPath`. Result: `AssertionError: expected the materialized
   program to exist at .../.never-written` — FAILED as expected. Reverted.
2. **Expected-total computation:** changed the second addend from
   `centsFromString('10.00')` to `centsFromString('999.00')`. Result:
   `AssertionError: expected '2233.56', got '1244.56'` — FAILED as
   expected (and incidentally confirms the real total really is
   `1244.56`, computed by the real interpreter against the real store).
   Reverted.
3. **Tool-coverage self-enforcement:** removed the `cas_refresh`
   tool-coverage call. Result: `AssertionError: expected every advertised
   tool to be called at least once: called=[...9 tools, missing
   cas_refresh...] advertised=[...10 tools...]` — FAILED as expected,
   naming the missing tool exactly. Restored.
4. **MCP-05 stdout invariant:** pushed a synthetic `'not-json-rpc'` line
   into the captured stdout-lines array before the parse loop. Result:
   `AssertionError: Got unwanted exception: expected every stdout line to
   parse as JSON-RPC, got: not-json-rpc` — FAILED as expected. Reverted.

None of these four perturbations were vacuous; the test can genuinely
fail, and does, when any of its own decisive assertions are broken.

## Before/After Project-Local Proof Counts

- **Before (measured at the start of this plan, matching 07-08's own
  "after" count):** 185 (`node --test 2>&1 | grep -c '^✔ import("./fjs/'`)
- **After this plan's two commits:** 185 (unchanged)
- This is correct and expected: this plan adds ROOT-LEVEL integration
  tests (`fjs-run-integration.test.js`), not `fjs/`-imported proofs. A
  rise in this count would have indicated something was misplaced
  (07-09-PLAN.md's own verification note). The two new task commits raise
  `node --test`'s TOTAL test count from 186 (185 `fjs/` proofs +
  `cas-refresh-cross-process.test.js`) to 187 (the same 185, plus
  `cas-refresh-cross-process.test.js`, plus `fjs-run-integration.test.js`)
  — confirmed via `npm test`'s own summary (`tests 187`, `pass 187`).

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- `fjs_run`'s central seam (write a program's bytes to a real file, then
  really `import()` it) is now proven end to end against a real
  filesystem and a real separate OS process — the gap this phase's own
  audit exposed (185 project-local proofs, exactly one prior real-process
  test) is closed for `fjs_run` specifically.
- Full MCP tool-surface coverage is now self-enforcing at the integration
  layer: any future phase that adds a tool to `financeMcpHandlers` without
  extending this test's coverage will see `npm run test:integration` fail
  with the missing tool named explicitly.
- **Blocker/follow-up for a later phase:** the real `claude mcp add`
  registration (live local Claude Code config, not a tracked file) does
  not currently set the working directory `fjs_run` needs
  (`materializeHome(home)`), and would currently fail on any real
  `fjs_run` call in that registered session. This is not a blocker for
  THIS plan's own success criteria (which concern the test file itself),
  but it is a concrete, previously-invisible production gap that whichever
  plan next touches server registration or deployment wiring should
  address — for example, by having `index.js`/`fjs/index.f.js`'s launcher
  itself establish this working directory before starting
  `financeMcpServer`, or by updating the registered command line to `cd`
  into `<home>/.fjs-run` first.

---
*Phase: 07-fjs-run-run-records-and-the-week-1-convergence*
*Completed: 2026-08-04*

## Self-Check: PASSED

- FOUND: fjs-run-integration.test.js
- FOUND: .planning/phases/07-fjs-run-run-records-and-the-week-1-convergence/07-09-SUMMARY.md
- FOUND commit: ff75c6a
- FOUND commit: ecd7bf5
- `package.json` contains `test:integration`
- `npm run test:integration`: 1/1 pass
- `npm test`: 187/187 pass, `tsc` clean
- Project-local proof count (`node --test 2>&1 | grep -c '^✔ import("./fjs/'`): 185 before -> 185 after (unchanged, as required)
- `git status --porcelain` clean after both task commits
