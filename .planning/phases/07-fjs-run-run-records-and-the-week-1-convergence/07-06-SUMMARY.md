---
phase: 07-fjs-run-run-records-and-the-week-1-convergence
plan: 06
subsystem: api
tags: [fjs-run, mcp-tool, provenance, functionalscript]

# Dependency graph
requires:
  - phase: 07-02
    provides: the vnd.fjs.run dialect (validate, checkReferences, casOpNames-restricted inputs[])
  - phase: 07-04
    provides: sizeGuard/previewBytes/guardBytes, the size-guarded response envelope
  - phase: 07-05
    provides: materializeProgram, buildRunSnapshot/buildHostMap (the synchronous, pinnable host map)
provides:
  - executeRun — pure orchestration (hash -> CAS blob -> materialize -> load -> snapshot -> interpret), never writes to CAS
  - fjsRunTool — the fjs_run MCP tool; the handler (never the guest) performs both CAS writes and assembles the run record
  - adversarial proof that inputs[] is observed, not declared, surviving into the PERSISTED record read back by its own runHash
affects: [07-09]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Handler-performed CAS writes: the guest's Report never receives a write-capable ctx; the tool handler writes the result and the run record after executeRun returns, using the established single-chunk cas.write(pure({first,tail})) pattern"
    - "JsModule-at-hash-path proof technique for full-executeRun proofs: since fjs/effects/node/virtual cannot execute freshly-written bytes as a module, every proof that needs a running guest program pre-places a JsModule fixture at the bare hash-derived filename while materializeProgram's own write still runs for real, at a different (nested) path — the two established techniques exercised side by side, never combined at one path"
    - "Concrete FileCasOperation instead of a generic <O extends Operation> for any curried function whose first parameter does not itself mention O"

key-files:
  created:
    - fjs/server/fjs_run/module.f.js
  modified: []

key-decisions:
  - "loadProgram is called with the BARE programFileName(hash), not the full materialize path — deliberate, matching fjs/guest/materialize/module.f.js's own documented virtual-harness limitation (a real write and a real import can never target the SAME path in one virtual session); production wiring of fjs_run into a real running server is this plan's own documented follow-up (Plan 09), not silently dropped"
  - "executeRun/fjsRunTool are typed against the concrete FileCasOperation, not a generic <O extends Operation> — TypeScript resolves a curried generic's type parameter at the first application, and the plan's own curry order puts materializeHomeRoot (unrelated to O) before cas, which empirically defeats inference (reproduced and confirmed in isolation); since fileCas is this codebase's only Cas implementation, this costs nothing"
  - "A CAS write's own failure (inside writeTextToCas) is asserted, not branched into an errorResult — this plan's error taxonomy is about GUEST failures (missing hash, dirty specifier, non-Error throws), not CAS infrastructure failures, mirroring how a run-record validation failure is treated as this module's own bug"

patterns-established:
  - "Pattern (07-06): JsModule-at-hash-path + real materialize-write, exercised side by side rather than combined, for any future proof needing a full executeRun success/pin-override path under fjs/effects/node/virtual"

requirements-completed: [EXEC-08, EXEC-10, EXEC-11, PROV-03]

# Metrics
duration: ~55min
completed: 2026-08-05
---

# Phase 7 Plan 06: fjs_run — the run handler, handler-performed writes, and the adversarial observed-reads proof Summary

**`executeRun`/`fjsRunTool` assembled: the handler — never the guest — performs both CAS writes, and a persisted `vnd.fjs.run` record decoded back out of CAS by its own returned `runHash` is proven, adversarially, to contain a read its program tried to hide.**

## Performance

- **Completed:** 2026-08-05T05:20:34Z
- **Tasks:** 2 completed
- **Files modified:** 1 (created)

## Accomplishments

- `executeRun` composes Plan 05's `materializeProgram`/`buildRunSnapshot`/
  `buildHostMap`, Phase 6's `programFileName`/`loadProgram`, and Phase 3's
  `interpret`, unchanged, into one five-step orchestration that never
  writes to CAS. Proven through the FULL path: a program that loops over
  `ctx.evoList`/`ctx.evoHead`/`ctx.evoRevision`/`ctx.casRead` via `ctx.step`
  to sum a field across two stored documents; a missing-hash short-circuit
  before materialize or interpret ever run (the virtual filesystem's own
  empty root is the spy/counter); a dirty-specifier refusal naming the
  offending specifier; and the `subject`/`parents` pin actually changing
  what a *running* program's `ctx.evoHead` resolves to.
- `fjsRunTool` wraps `executeRun`: on success it writes `String(value)` to
  CAS unconditionally (never conditional on size), assembles a
  `vnd.fjs.run` record from `executeRun`'s own observed `Read[]`,
  validates it defensively, writes it too, applies Plan 04's size guard,
  and returns the four uniform keys. On failure it still writes a record
  (`status: 'error'`) and returns an `errorResult` naming both the failure
  and where its record lives — never an `instanceof Error` branch anywhere.
- **The adversarial proof (Success Criterion 2):** a guest program reads a
  CITED document (whose content becomes the return value) and an UNCITED
  one (read via `ctx.casRead`, then discarded). The test decodes the
  *persisted* `vnd.fjs.run` record back OUT of CAS by the `runHash`
  `fjsRunTool.handle` returned — not the in-process `Read[]` — and asserts
  `inputs[]` still names the uncited read. This is the specific, harder
  claim the plan called out: that observation survives into persisted
  provenance, not merely that `interpret` observes it in-process (already
  proven in Phase 3).
- **The behavioral proof (Success Criterion 3):** snapshots the CAS
  store's hash set before and after one `fjsRunTool.handle` call, asserts
  exactly two new hashes appear, and that both decode to content the
  handler itself constructed (the result equals the program's own returned
  value; the run record round-trips through `fjs/run`'s own `validate`).
  Reinforced by the unchanged static check: `grep -n "casWrite|evoAdd"
  fjs/guest/module.f.js fjs/guest/materialize/module.f.js` returns nothing.

## Task Commits

1. **Task 1: executeRun — hash resolution, materialize, pin, interpret** - `7ad4add` (feat)
2. **Task 2: fjsRunTool — handler-performed writes, the run record, and the adversarial proof** - `ca21f0f` (feat)

_No TDD RED/GREEN split was used — `tdd="true"` here meant "write the proof alongside the implementation in the same commit," matching Plan 05's own precedent; each commit's diff includes both the implementation and its exhaustive `proof` leaves, verified green before committing._

## Files Created/Modified

- `fjs/server/fjs_run/module.f.js` - new module: `RunOutcome<T>` typedef, `executeRun` (orchestration), `writeTextToCas` (the single-chunk CAS-write helper reused for both the result and the run record), `fjsRunInputSchema`, `fjsRunTool` (the MCP `ToolEntry`); an `executeRun` proof group (multi-document sum, missing-hash short-circuit, dirty-specifier refusal, pin override — all through the full path) and an `fjsRunTool` proof group (the adversarial observed-reads proof, the behavioral two-new-hashes proof, the four-key response shape, the always-written-even-when-tiny result, and the failed-run-still-gets-a-record error path)

## Decisions Made

- `loadProgram` is invoked with the bare `programFileName(input.hash)`, not the full `programPath(materializeHome(...))(...)`. This is Plan 05's own documented virtual-harness scope note applied: `fjs/effects/node/virtual` cannot execute freshly-written bytes as a module, so a real materialize-write and a real import can never both succeed at the SAME path in one virtual session (verified: `virtual`'s own `writeFile` operation errors — does not overwrite — when a `JsModule` already occupies the target leaf). Every proof that needs a running guest therefore exercises the write for real (a fresh, unwritten leaf under `.fjs-run`) and the load via a `JsModule` fixture at the bare name — the same stand-in `fjs/guest/materialize/module.f.js`'s own `underVirtual.cleanProgramImportsAndRuns` proof uses — composed side by side, never combined. Wiring `fjs_run` into a real running server with a real working directory (where the bare-filename choice would need re-examining against real Node's `import()` resolution) is this plan's own documented follow-up, not silently dropped; Plan 06 does not modify `fjs/server/module.f.js`.
- `executeRun`/`fjsRunTool` are typed against the concrete `FileCasOperation`, not a generic `<O extends Operation>`. Empirically reproduced in isolation: TypeScript resolves a curried generic function's type parameter at the point of the FIRST application, and since the plan's own curry order is `(materializeHomeRoot) => (cas) => ...` — with `materializeHomeRoot: string` mentioning nothing about `O` — `tsc` commits `O` to its bare constraint before `cas`/`evoApi` are ever seen, then every later application fails to unify against a concrete `Cas<FileCasOperation>` argument. `buildRunSnapshot`/`buildHostMap`/`casRefreshTool` avoid this because their FIRST parameter already mentions `O`. Since this codebase has exactly one `Cas` implementation (`fileCas`; `financeMcpHandlers`'s own signature is concrete for the same reason), fixing the type costs nothing in practice and keeps the plan's curry order intact.
- A CAS write's own failure inside `writeTextToCas` is asserted defensively rather than turned into an `errorResult` branch — this plan's error taxonomy (missing hash, dirty specifier, a non-`Error` throw) is about GUEST failures, not CAS infrastructure failures, mirroring how a run-record validation failure is treated as this module's own bug rather than a normal control-flow branch.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Typed `executeRun`/`fjsRunTool` against concrete `FileCasOperation` instead of the plan-implied generic `<O extends Operation>`**
- **Found during:** Task 1 (`executeRun`'s own `tsc` check)
- **Issue:** The plan's interfaces section writes `executeRun` generically (mirroring `buildRunSnapshot`'s own `<O extends Operation>(cas) => (evoApi) => ...`), but `executeRun`'s curry order puts `materializeHomeRoot` (a plain string, unrelated to `O`) BEFORE `cas`. Reproduced in an isolated scratch file: `tsc` resolves a curried generic's type parameter at the first application with no witness of `O` yet available, defaulting to the bare constraint, so every later application (`cas`, `evoApi`) then fails to unify against the real `Cas<FileCasOperation>`/`Evo<FileCasOperation>` arguments every proof and any real caller would actually pass.
- **Fix:** Declared both exports against the concrete `FileCasOperation` (this codebase's only `Cas` implementation) instead of a generic `O`, keeping the plan's exact curry order (`materializeHomeRoot => cas => evoApi => ...`).
- **Files modified:** `fjs/server/fjs_run/module.f.js`
- **Verification:** `npx tsc` exits 0 with no output; all 10 new proof leaves green.
- **Committed in:** `7ad4add` (Task 1), `ca21f0f` (Task 2)

---

**Total deviations:** 1 auto-fixed (1 bug/type-inference fix)
**Impact on plan:** Necessary for `tsc` to pass at all under strict mode; the plan's own curry order, external call shape, and every named acceptance-criteria proof are all preserved unchanged. No scope creep.

## Issues Encountered

- The plan's Task 1 acceptance criteria ask for a "multi-document sum" and "pin override" proof through the FULL `executeRun` path, using "the established JsModule-at-hash-path technique." Working through this precisely required confirming — empirically, by reading `fjs/effects/node/virtual/module.f.js`'s own `writeFile`/`import_` operation implementations — that a real materialize-write and a real module-import can never target the SAME leaf in one virtual session (the write's own guard errors rather than overwrites when a `JsModule` already sits there). This confirmed `loadProgram` must be called with the bare hash-derived filename (as the plan's own text already specifies literally), with materialize's real write landing at a DIFFERENT (nested, nowhere-else-referenced) path — resolved with no code change beyond following the plan's literal wording, but required deliberate verification before trusting it, since a full materialize path would have made an `'ok'` proof mathematically impossible to construct.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `fjs_run`'s two exports (`executeRun`, `fjsRunTool`) are complete and independently proof-tested. `fjs/server/module.f.js` is NOT modified by this plan — wiring `fjsRunTool` into `financeMcpHandlers` (and resolving the bare-vs-full materialize path question for a real running server with a real working directory) is explicitly left for whichever plan performs that integration (per `07-05-SUMMARY.md`'s own "Next Phase Readiness" note, this is Plan 09's territory).
- No blockers. `finance_schema` (MCP-06, a separate deliverable already present at `fjs/server/finance_schema/module.f.js`) and this plan's `fjs_run` are now both ready for the Week 1 convergence wiring.

---
*Phase: 07-fjs-run-run-records-and-the-week-1-convergence*
*Completed: 2026-08-05*

## Self-Check: PASSED

- FOUND: fjs/server/fjs_run/module.f.js
- FOUND commit: 7ad4add
- FOUND commit: ca21f0f
- `npx tsc` exits 0, no output
- `npm test`: 182/182 pass
- Project-local proof count (`node --test 2>&1 | grep -c '^✔ import("./fjs/'`): 173 before -> 181 after (strictly greater, as required)
- `grep -n "casWrite|evoAdd" fjs/guest/module.f.js fjs/guest/materialize/module.f.js`: no output
- `git status --porcelain` clean after both task commits (checked prior to writing this SUMMARY; SUMMARY itself and STATE.md updates follow in the metadata commit)
