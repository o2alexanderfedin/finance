---
phase: 07-fjs-run-run-records-and-the-week-1-convergence
plan: 05
subsystem: api
tags: [fjs-run, materialize, snapshot, cas, evo, functionalscript]

# Dependency graph
requires:
  - phase: 07-01
    provides: guestCtx widened with step/pure combinators and money helpers; CasOp frozen at four commands
provides:
  - materializeProgram/materializeDir/materializeHome — the first real CAS-blob-to-disk write in this repo, into a dedicated gitignored subdirectory
  - buildRunSnapshot/buildHostMap — a synchronous OperationMap<CasOp, string> closed over a pre-resolved CAS/Evo snapshot, with a subject/parents pin override
affects: [07-06, 07-09]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Effect-then-synchronous-interpret split: resolve the whole reachable CAS/Evo store into plain data via step/foldStep BEFORE calling interpret, since interpret's OperationMap requires plain synchronous handlers, never Effect-returning ones"
    - "One snapshot serves two requirements at once: the synchronous-host-map constraint and the pin-once-at-call-time requirement, built by the same buildRunSnapshot call"

key-files:
  created:
    - fjs/server/fjs_run/snapshot/module.f.js
  modified:
    - fjs/guest/materialize/module.f.js
    - .gitignore

key-decisions:
  - "Materialized programs write to a dedicated .fjs-run subdirectory under home (sibling of .cas), not home's root — programPath's (home)(hash) contract is reused unchanged by passing materializeHome(home) as its home argument"
  - "mkdir(recursive:true) runs unconditionally on every materializeProgram call, and the write itself is an unconditional overwrite — no check-then-write race, mirroring this module's existing hash-derived-filename convention"
  - "buildRunSnapshot resolves every hash cas.list() returns (Open Question 2's whole-store recommendation), not something narrower keyed off subject/parents reachability — simplest-correct at this project's declared scale"
  - "evoList's single string argument selects archived subjects only when it is exactly 'true'; any other string selects active, mirroring Evo.list(archived?: true)'s default-is-active convention"
  - "casRead/evoRevision throw a plain string (never Error) for a hash absent from the snapshot, matching interpret's own bare-throw discipline"

patterns-established:
  - "Pattern 1 (07-RESEARCH.md): Effect-then-synchronous-interpret split for any OperationMap-typed consumer"

requirements-completed: [EXEC-08]

# Metrics
duration: ~45min
completed: 2026-08-05
---

# Phase 7 Plan 05: materializeProgram + the synchronous snapshot host map, with pinning Summary

**A real CAS-blob-to-disk write (`materializeProgram`, into a new gitignored `.fjs-run` subdirectory) plus a synchronous `OperationMap<CasOp, string>` (`buildRunSnapshot`/`buildHostMap`) built by pre-resolving the whole CAS/Evo store before `interpret` runs, with a pin override for reproducible reads.**

## Performance

- **Completed:** 2026-08-05T04:48:39Z
- **Tasks:** 2 completed
- **Files modified:** 3 (2 modified, 1 created)
- **Project-local proof count:** 164 → 173 (before → after; strictly greater, as required)

## Accomplishments

- `materializeProgram` writes a stored program's bytes to
  `programPath(materializeHome(home))(hash)` — the write step `loadProgram`
  has always assumed already happened, and that nothing in this repo
  performed before this plan (07-RESEARCH.md Pitfall 1). Proven
  write-then-readback equal under `fjs/effects/node/virtual`'s real `Fs`
  operation set (not a `JsModule` fixture).
- `.fjs-run` is a dedicated, `.gitignore`d sibling of `.cas`, so materialized
  files never land untracked in the repo root (07-RESEARCH.md Pitfall 2,
  07-CONTEXT.md Decision 2).
- `buildRunSnapshot`/`buildHostMap` resolve the whole reachable CAS/Evo store
  into plain data via ordinary `step`/`foldStep` effects, then hand
  `interpret` a plain synchronous `OperationMap<CasOp, string>` — satisfying
  `interpret`'s `OperationMap<O, Return<O>>` constraint that Pitfall 3 named
  as unsatisfiable by a thin `Cas`/`Evo` wrapper.
- The same snapshot construction implements the pinning decision: a
  `{ subject, parents }` pin overrides only that one subject's `heads`
  entry, proven both against a hand-built snapshot and against a real
  virtual `FileCas`/`Evo` store (the live head differs from the pin, and the
  pinned value — not the live one — is what a guest's `evoHead` reads).

## Task Commits

1. **Task 1: materializeProgram — write CAS bytes to a dedicated, gitignored subdirectory** - `238d1c4` (feat)
2. **Task 2: buildRunSnapshot and buildHostMap — the synchronous snapshot host map, with pinning** - `0ea7b3b` (feat)

_No TDD RED/GREEN split was used — `tdd="true"` here meant "write the proof alongside the implementation in the same commit," which both task commits do; each commit's diff includes both the implementation and its exhaustive `proof` leaves, verified green before committing._

## Files Created/Modified

- `fjs/guest/materialize/module.f.js` - adds `materializeDir` (`.fjs-run`), `materializeHome`, and `materializeProgram` (the fourth separable concern, alongside `checkSpecifiers`/`programFileName`+`programPath`/`loadProgram`); adds a `materialize` proof group (write-then-readback, dedicated-subdirectory path shape, idempotency)
- `.gitignore` - adds `/.fjs-run`, mirroring the existing `/.cas` entry's style and comment convention
- `fjs/server/fjs_run/snapshot/module.f.js` - new module: `RunSnapshot` typedef, `buildRunSnapshot` (resolves `cas.list()`'s blobs + revision decodes, `evo.list()`/`evo.list(true)`'s subjects, and every subject's `evo.head`, with an optional pin override), `buildHostMap` (the plain synchronous four-key `OperationMap<CasOp, string>`); a `hostMap` proof group (type-check, multi-read composition via `guestCtx.step`, pin override, absent-hash bare-string throw) and a `buildRunSnapshotResolvesTheStore` proof group exercising the real `fileCas`/`evo` shapes under `virtual`

## Decisions Made

- `evoList`'s guest-facing argument convention (`'true'` selects archived, anything else selects active) was Claude's discretion per 07-CONTEXT.md — no prior code fixed this string format, since `CasOp`'s `evoList` is a bare `string -> string` op and this is the first real host-map implementation for it. Documented in the module's JSDoc for whoever writes the first Week-1 report program against it (Plan 06/09).
- `buildRunSnapshot`'s declared operation set is `Effect<O | MemOp, RunSnapshot>`, not `Effect<O, RunSnapshot>` — `Evo<O>.revision` itself is typed `Effect<O | MemOp, Result<RevisionData, string>>` upstream, so the snapshot builder's own type had to widen to match, caught immediately by `tsc` rather than needing a cast.
- A hash `cas.list()` reports that fails its own `collectRead` (a bad/oversized blob) is skipped from the snapshot rather than failing the whole build — mirrors `buildCache`'s own "ignore what doesn't decode" precedent for revisions, applied here to the read step itself.

## Deviations from Plan

None - plan executed as written. Task 2's test suite goes beyond the plan's four listed acceptance criteria by also proving `buildRunSnapshot` itself against a real virtual `FileCas`/`Evo` store (blobs, subjects, heads, revisions, and the pin override one layer up from the hand-built-snapshot proofs) — this is additional coverage of the same artifact the plan already requires as an export, not a scope change.

## Issues Encountered

- Two rounds of `tsc` errors during Task 2, both style/strictness catches rather than logic bugs: (1) `buildRunSnapshot`'s declared `Effect<O, RunSnapshot>` needed widening to `Effect<O | MemOp, RunSnapshot>` to match `Evo<O>.revision`'s own upstream type; (2) `tsconfig.json`'s `noPropertyAccessFromIndexSignature` rejected `snapshot.heads.subjectS`-style dot access on the `Record<string, ...>`-typed `heads`/`revisions` fields, fixed by switching every such read to bracket notation (`snapshot.heads['subjectS']`) in the proof leaves. Both fixed inline before committing; no behavior changed.

## Next Phase Readiness

- Plan 06 (the `fjs_run` MCP tool handler) can now compose: resolve `hash` → CAS blob (existing), `materializeProgram` (this plan) → `checkSpecifiers`/`loadProgram` (existing, Phase 6) → `buildRunSnapshot`/`buildHostMap` (this plan) → `interpret` (existing, Phase 3) → write result + `vnd.fjs.run` record (existing dialect, Plan 07-02) → size-guarded response (existing, Plan 07-04).
- No blockers. The one thing Plan 06 will need to decide and this plan deliberately left open: which concrete revision hashes `subject`/`parents` resolve to before being handed to `buildRunSnapshot` as `pin` — that resolution (reading the store to turn a `subject` name into `parents` hashes) is Plan 06's own first step, not this plan's.

---
*Phase: 07-fjs-run-run-records-and-the-week-1-convergence*
*Completed: 2026-08-05*

## Self-Check: PASSED

- FOUND: fjs/guest/materialize/module.f.js
- FOUND: fjs/server/fjs_run/snapshot/module.f.js
- FOUND: .gitignore
- FOUND commit: 238d1c4
- FOUND commit: 0ea7b3b
- `npx tsc` exits 0, no output
- `npm test`: 174/174 pass
- Project-local proof count (`node --test 2>&1 | grep -c '^✔ import("./fjs/'`): 164 before → 173 after
- `git status --porcelain` clean after final commit (checked prior to writing this SUMMARY; SUMMARY itself and STATE.md updates follow in the metadata commit)
