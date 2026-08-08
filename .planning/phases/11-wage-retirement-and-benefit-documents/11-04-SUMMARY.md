---
phase: 11-wage-retirement-and-benefit-documents
plan: 04
subsystem: api
tags: [rtti, mcp, finance-schema, dialect-registry]

# Dependency graph
requires:
  - phase: 11-01
    provides: "vnd.fjs.1099r (oneZeroNineNineRSchema) and vnd.fjs.ssa1099 (ssa1099Schema) dialect modules"
provides:
  - "finance_schema MCP tool resolves vnd.fjs.1099r and vnd.fjs.ssa1099, returning each dialect's own toJsonSchema output"
  - "expectedKnownDialectCount raised to 7, still an independently hand-typed literal"
affects: [11-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Atomic three-part dialect registration: map entry + hand-typed count + per-dialect *Resolves proof leaf, all in one commit"

key-files:
  created: []
  modified:
    - fjs/server/finance_schema/module.f.js

key-decisions:
  - "expectedKnownDialectCount bumped 5 -> 7 in one commit (both new dialects registered together), not two separate +1 bumps, since both dialect modules already existed from Plan 11-01"

patterns-established: []

requirements-completed: [DOC-08, DOC-09]

# Metrics
duration: ~20min
completed: 2026-08-08
---

# Phase 11 Plan 04: Register 1099-R and SSA-1099 into finance_schema Summary

**`dialectSchemas` grows from 5 to 7 entries (registering `vnd.fjs.1099r` and `vnd.fjs.ssa1099`), with `expectedKnownDialectCount` bumped to 7 and a `*Resolves` proof leaf added for each new dialect, all in one atomic commit.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-08-07 (session start)
- **Completed:** 2026-08-08T00:01:31Z
- **Tasks:** 1 (single atomic task, as specified by the plan)
- **Files modified:** 1

## Accomplishments
- `fjs/server/finance_schema/module.f.js` now imports `dialect as oneZeroNineNineRDialect, oneZeroNineNineRSchema` from `fjs/document/1099r/module.f.js` and `dialect as ssa1099Dialect, ssa1099Schema` from `fjs/document/ssa1099/module.f.js`, and registers both as new `dialectSchemas` entries.
- `expectedKnownDialectCount` raised from `5` to `7` (still hand-typed, not derived from `knownDialects.length` — the docstring's own worked example was updated to describe registering the sixth AND seventh dialect in one commit, per the plan's explicit instruction).
- Added `oneZeroNineNineRResolves` and `ssa1099Resolves` proof leaves, each calling the tool with the dialect's real tag and comparing the JSON-parsed response against `toJsonSchema` called directly on the imported schema const (`oneZeroNineNineRSchema` / `ssa1099Schema`) — never a hand-written JSON literal.
- Confirmed `unknownDialectRefused` needed no change — it already iterates `knownDialects` (`Object.keys(dialectSchemas)`), so the two new tags are picked up automatically.

## Task Commits

Each task was committed atomically:

1. **Task 1: The atomic three-part `dialectSchemas` bump (register + count + resolve proofs)** - `36438a1` (feat)

**Plan metadata:** (pending — this SUMMARY commit)

## Files Created/Modified
- `fjs/server/finance_schema/module.f.js` - Added two dialect imports, two `dialectSchemas` entries, bumped `expectedKnownDialectCount` 5→7 (with docstring update), added `oneZeroNineNineRResolves` and `ssa1099Resolves` proof leaves, updated the leaf-count comment (seven → nine leaves)

## Decisions Made
- Bumped `expectedKnownDialectCount` directly from 5 to 7 in a single commit (rather than treating "sixth" and "seventh" as separate increments), since both dialect modules already existed from Plan 11-01 and the plan explicitly frames this as one atomic three-part edit registering both dialects together.

## Deviations from Plan

None - plan executed exactly as written.

## Guard-Is-Load-Bearing Verification (required by the task)

Per the plan's `<verify_the_guard_is_load_bearing>` instruction, `expectedKnownDialectCount` was temporarily set to `6` (wrong) to confirm the count guard actually fails independently of the `*Resolves`/`unknownDialectRefused` leaves:

**Command:** `node --test 2>&1 | grep -A2 "everyRegisteredDialectIsCounted"`

**Real output observed (count = 6, RED):**
```
✖ import("./fjs/server/finance_schema/module.f.js").proof.everyRegisteredDialectIsCounted() ... (0.179166ms)
  [ 7, 6, [ 'expected exactly the independently-stated dialect count', 7, 6 ] ]
```

The leaf name that went red is `everyRegisteredDialectIsCounted`, failing with actual `knownDialects.length` (7, since `dialectSchemas` itself still had 7 entries) against the wrongly-set expectation (6) — exactly the independent-mismatch signature the guard exists to catch. All other leaves (`oneZeroNineNineRResolves`, `ssa1099Resolves`, `unknownDialectRefused`, etc.) stayed green throughout, since the guard's whole point is to be the ONLY thing that notices a count drift.

The constant was then restored to `7`:
- `npx tsc --noEmit` → exit 0
- `node --test 2>&1 | grep -c '^✔ import("./fjs/'` → `541` (green, up from the 539 baseline by exactly 2 — the two new `*Resolves` leaves)
- `git status --porcelain` → empty (only the restore-to-7 state remained, matching the committed file)

## Verification Results

- `npx tsc --noEmit` exits 0.
- `node --test 2>&1 | grep -c '^✔ import("./fjs/'` — baseline 539, now **541** (risen by exactly 2, matching the two new `*Resolves` leaves).
- Full `node --test` (via `npm test`'s test half): `tests 2779, pass 2779, fail 0` — all green, including the vendored `functionalscript` submodule proofs.
- `fjs/server/finance_schema/module.f.js`'s own proof set: all 9 leaves pass — `oneZeroNineNineIntResolves`, `ocrResolves`, `w2Resolves`, `medicalExpensesResolves`, `returnProfileResolves`, `oneZeroNineNineRResolves`, `ssa1099Resolves`, `unknownDialectRefused` (unchanged), `everyRegisteredDialectIsCounted`.
- `git status --porcelain` empty at the end.
- `fjs/server/module.f.js` and `fjs-run-integration.test.js` are UNTOUCHED (confirmed via `git diff --stat`, which shows only `fjs/server/finance_schema/module.f.js`) — that composition-root registration is Plan 11-05's job.
- Commit verified with `git ls-tree HEAD` AFTER committing (per the critical project rule), not `git diff --cached` before.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

`vnd.fjs.1099r` and `vnd.fjs.ssa1099` are now discoverable through the `finance_schema` MCP tool exactly like every other dialect. Plan 11-05 can now compose `financeMcpHandlers`/`fjs-run-integration.test.js` (the `finance_documents_list` tool and its same-commit registry+integration-test pairing) without touching this file again. No blockers.

## Self-Check: PASSED

- FOUND: `fjs/server/finance_schema/module.f.js` (modified, present on disk)
- FOUND: commit `36438a1` in `git log --oneline --all`
- FOUND: `.planning/phases/11-wage-retirement-and-benefit-documents/11-04-SUMMARY.md` (this file)

---
*Phase: 11-wage-retirement-and-benefit-documents*
*Completed: 2026-08-08*
