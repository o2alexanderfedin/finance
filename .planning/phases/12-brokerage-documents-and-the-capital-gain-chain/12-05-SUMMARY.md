---
phase: 12-brokerage-documents-and-the-capital-gain-chain
plan: 05
subsystem: api
tags: [rtti, mcp, finance-schema, dialect-registry, evo, provenance]

# Dependency graph
requires:
  - phase: 12-01
    provides: "vnd.fjs.1099div dialect module (oneZeroNineNineDivSchema), sourceArtifactHash field"
  - phase: 12-02
    provides: "vnd.fjs.1099b dialect module (oneZeroNineNineBSchema), sourceArtifactHash field"
provides:
  - "fjs/document/consolidated_provenance/module.f.js — proof-only module demonstrating DOC-13's N-subjects-one-provenance property against the two real new dialects"
  - "finance_schema MCP tool resolves vnd.fjs.1099div and vnd.fjs.1099b, returning each dialect's own toJsonSchema output"
  - "expectedKnownDialectCount raised to 9, still an independently hand-typed literal"
affects: [12-06, 12-07]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Atomic three-part dialect registration: map entry + hand-typed count + per-dialect *Resolves proof leaf, all in one commit (Phase 11 pattern repeated one register-count higher)"
    - "Proof-only module with zero exports besides `proof` — used when a cross-cutting property (DOC-13) needs a home that is neither a dialect module nor a production mechanism"

key-files:
  created:
    - fjs/document/consolidated_provenance/module.f.js
  modified:
    - fjs/server/finance_schema/module.f.js

key-decisions:
  - "DOC-13's provenance proof lives in a new proof-only module (fjs/document/consolidated_provenance/module.f.js), not inside either dialect's own file, because the property being proven spans BOTH dialects plus formSubject — putting it in one dialect's file would misattribute a cross-cutting fact to a single dialect"
  - "expectedKnownDialectCount bumped directly 7 -> 9 in one commit (both new dialects registered together), mirroring Phase 11's 11-04 precedent of treating 'eighth and ninth' as one atomic step, not two separate +1 bumps"

patterns-established: []

requirements-completed: [DOC-13]

# Metrics
duration: ~35min
completed: 2026-08-08
---

# Phase 12 Plan 05: DOC-13 Consolidated-Document Provenance + finance_schema 7->9 Registration Summary

**A proof-only module demonstrates that one consolidated brokerage artifact's 1099-DIV and 1099-B sections resolve to two distinct Evo subjects while sharing one recorded `sourceArtifactHash`, and `finance_schema` now serves both new dialects by name with `expectedKnownDialectCount` raised 7 -> 9 in one atomic, mutation-gate-verified commit.**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-08-08T02:44:00Z (approx, session start)
- **Completed:** 2026-08-08T03:19:37Z
- **Tasks:** 3 (Task 3 is a verification-only Mutation Gate — no net file change)
- **Files modified:** 2 (1 created, 1 modified)

## Accomplishments

- Created `fjs/document/consolidated_provenance/module.f.js` — a proof-only module (exports `proof` and nothing else) that imports the real `formSubject` and the real `vnd.fjs.1099div`/`vnd.fjs.1099b` dialects and proves, with zero new production code, that:
  - one consolidated artifact's two extracted forms resolve to two DISTINCT Evo subjects (`formSubject`'s existing key, unchanged, already does this because `formType` is part of the key), and
  - those same two forms can carry one shared, recorded `sourceArtifactHash`.
  - A control leaf (`differentArtifactsDoNotShareProvenance`) proves the equality assertion is non-vacuous by exhibiting an unrelated instance whose hash genuinely differs.
- Registered both `vnd.fjs.1099div` and `vnd.fjs.1099b` into `finance_schema`'s `dialectSchemas` in the SAME atomic edit as bumping `expectedKnownDialectCount` from 7 to 9 and adding both `*Resolves` proof leaves — the three-part edit the phase's non-negotiable constraint requires, mirroring Phase 11's 11-04 precedent exactly.
- Ran Mutation Gate M2: watched `everyRegisteredDialectIsCounted` go RED (and specifically confirmed `unknownDialectRefused` stayed GREEN at the same moment) when the hand-typed count was wrong, then restored the correct value and confirmed the suite returned to green with a clean `git status`.

## Task Commits

Each task was committed atomically:

1. **Task 1: DOC-13 provenance proof — one artifact, two dialects, two subjects, one shared hash** - `dfa5115` (feat)
2. **Task 2: `finance_schema` atomic registration — 7 to 9 dialects, ONE commit** - `93ddb33` (feat)
3. **Task 3: Mutation Gate M2 (BLOCKING verification)** - no commit (transient mutation, restored to the exact byte-identical committed state from Task 2 — `git diff HEAD` empty after restore)

**Plan metadata:** (pending — this SUMMARY commit)

## Files Created/Modified

- `fjs/document/consolidated_provenance/module.f.js` (new) — proof-only module (154 lines), exports `proof` exclusively. Imports `formSubject` from `../subject/module.f.js` and `dialect`/`validate` from both `../1099div/module.f.js` and `../1099b/module.f.js`. Two proof leaves: `oneArtifactYieldsTwoSubjectsSharingProvenance` (the core DOC-13 property) and `differentArtifactsDoNotShareProvenance` (the non-vacuity control).
- `fjs/server/finance_schema/module.f.js` (modified) — added two imports (`oneZeroNineNineDivDialect`/`oneZeroNineNineDivSchema`, `oneZeroNineNineBDialect`/`oneZeroNineNineBSchema`), two new `dialectSchemas` entries, bumped `expectedKnownDialectCount` 7 -> 9 (with docstring's worked example updated from "SIXTH AND SEVENTH... 5 to 7" to "EIGHTH AND NINTH... 7 to 9"), added `oneZeroNineNineDivResolves` and `oneZeroNineNineBResolves` proof leaves, updated the leaf-count comment (nine -> eleven leaves).

## Decisions Made

- The DOC-13 proof was placed in a brand-new proof-only module rather than appended to either `1099div` or `1099b`'s own file, because the property spans both dialects plus `formSubject` — attributing it to one dialect's file would misrepresent it as that dialect's own concern.
- `expectedKnownDialectCount` was bumped directly from 7 to 9 in the same commit that registers both dialects (not two separate +1 commits), following the exact same precedent Phase 11's 11-04-SUMMARY.md documents for its own 5 -> 7 bump.

## Deviations from Plan

None — plan executed exactly as written. `fjs/document/subject/module.f.js` (`formSubject`) required zero changes, as 12-RESEARCH.md Q3 predicted.

## Guard-Is-Load-Bearing Verification — Mutation Gate M2 (required, BLOCKING)

Per Task 3, `expectedKnownDialectCount` was temporarily set to `8` (wrong — `dialectSchemas` genuinely has 9 entries after Task 2) to confirm the count guard fails independently of `unknownDialectRefused`.

**Step 1 — mutate:** `expectedKnownDialectCount` set to `8` in `fjs/server/finance_schema/module.f.js`.

**Step 2 — run and record (RED):**

Command: `npx tsc --noEmit && node --test > mutation_gate_m2_output.txt 2>&1; echo exit:$?`

Real output:
```
TSC OK
exit:1
```

Command: `grep -c '^✔ import("./fjs/' mutation_gate_m2_output.txt`

Real output: `628` (down from the post-Task-2 baseline of `629` by exactly 1 — the one leaf that flipped from pass to fail).

Command: `grep -A3 "finance_schema.*everyRegisteredDialectIsCounted\|finance_schema.*unknownDialectRefused" mutation_gate_m2_output.txt`

Real output:
```
✔ import("./fjs/server/finance_schema/module.f.js").proof.unknownDialectRefused() ... (0.162625ms)
✖ import("./fjs/server/finance_schema/module.f.js").proof.everyRegisteredDialectIsCounted() ... (0.215ms)
  [ 9, 8, [ 'expected exactly the independently-stated dialect count', 9, 8 ] ]
```

`everyRegisteredDialectIsCounted` FAILED (actual `knownDialects.length` = 9, since `dialectSchemas` itself still had all 9 entries, against the wrongly-set expectation 8), while `unknownDialectRefused` PASSED simultaneously — exactly the documented asymmetry (AGENTS.md's case study and Phase 11's 11-04-SUMMARY.md precedent), re-confirmed at count 9.

**Step 3 — restore:** `expectedKnownDialectCount` set back to `9` exactly.

Command: `npx tsc --noEmit && echo "TSC OK" && node --test 2>&1 | grep -c '^✔ import("./fjs/'`

Real output:
```
TSC OK
629
```

Count returned to (at least) the post-Task-2 count of 629.

**Step 4 — clean status:**

Command: `git status --porcelain`

Real output: *(empty)*

**Step 5 — this section is that record**, per the plan's instruction to record every command's actual output in this SUMMARY, not paraphrase.

## Verification Results

- `npx tsc --noEmit` exits 0 (confirmed after every task, including after the M2 restore).
- `node --test 2>&1 | grep -c '^✔ import("./fjs/'` — baseline entering this plan: **625**. After Task 1: **627** (+2: the two `consolidated_provenance` proof leaves). After Task 2: **629** (+2: the two `finance_schema` `*Resolves` leaves). After Task 3's restore: **629** (unchanged from Task 2, confirming the mutation left no residue). Strictly RISEN over the 625 baseline, as required.
- `fjs/document/consolidated_provenance/module.f.js`'s own proof set: both leaves pass — `oneArtifactYieldsTwoSubjectsSharingProvenance`, `differentArtifactsDoNotShareProvenance`.
- `fjs/server/finance_schema/module.f.js`'s own proof set: all 11 leaves pass — `oneZeroNineNineIntResolves`, `ocrResolves`, `w2Resolves`, `medicalExpensesResolves`, `returnProfileResolves`, `oneZeroNineNineRResolves`, `ssa1099Resolves`, `oneZeroNineNineDivResolves`, `oneZeroNineNineBResolves`, `unknownDialectRefused`, `everyRegisteredDialectIsCounted`.
- `git diff -- fjs/return/scope/module.f.js fjs/form1040/core/module.f.js` returns EMPTY (confirmed after each task) — the scope line was not crossed. `fjs/tax/**` was not touched at all in this plan.
- Full `npm test` (`tsc && node --test`, includes ~2,238 vendored submodule proofs): `tests 2867, pass 2867, fail 0` — all green.
- `git status --porcelain` empty at the end.
- Both commits verified with `git ls-tree HEAD` AFTER committing (per the critical project rule), not `git diff --cached` before:
  - `dfa5115` -> `git ls-tree HEAD -- fjs/document/consolidated_provenance/` shows the blob present.
  - `93ddb33` -> `git ls-tree HEAD -- fjs/server/finance_schema/module.f.js` shows the updated blob present.

## Issues Encountered

- First `tsc --noEmit` pass on the new proof module failed with `TS2367: This comparison appears to be unintentional because the types '"deadbeef...900"' and '"0000...eeff"' have no overlap` — TypeScript had narrowed both hash literals to their exact string-literal types, making the inequality check in the control leaf a compile-time-provable `false` rather than a runtime comparison. Fixed by adding an explicit `@type {string}` JSDoc annotation to both `sharedSourceArtifactHash` and `differentSourceArtifactHash` (the same widening technique `1099div`/`1099b`'s own `sharedSourceArtifactHash` constants already use), which restores a genuine runtime `===`/`!==` check. Recorded here as a Rule 1 (auto-fix bug) deviation, resolved inline before proceeding — no architectural change, no scope change.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

`vnd.fjs.1099div` and `vnd.fjs.1099b` are now discoverable through `finance_schema` exactly like every other dialect, and DOC-13's N-subjects/one-provenance property is proven against the real dialects. This plan performs NO wiring into `fjs/return/scope`, `fjs/form1040/core`, or `fjs/tax/**` (confirmed empty diff) — that reclassification/wiring work remains a later plan's job, per 12-CONTEXT.md's AMENDED 2026-08-07 section. No blockers.

## Self-Check: PASSED

- FOUND: `fjs/document/consolidated_provenance/module.f.js` (created, present on disk)
- FOUND: `fjs/server/finance_schema/module.f.js` (modified, present on disk)
- FOUND: commit `dfa5115` in `git log --oneline --all`
- FOUND: commit `93ddb33` in `git log --oneline --all`
- FOUND: `.planning/phases/12-brokerage-documents-and-the-capital-gain-chain/12-05-SUMMARY.md` (this file)

---
*Phase: 12-brokerage-documents-and-the-capital-gain-chain*
*Completed: 2026-08-08*
