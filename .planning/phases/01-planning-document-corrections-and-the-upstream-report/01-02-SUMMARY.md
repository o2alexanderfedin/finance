---
phase: 01-planning-document-corrections-and-the-upstream-report
plan: 02
subsystem: docs
tags: [planning-corpus, requirements-traceability, storage-boundary, money-representation]

# Dependency graph
requires:
  - phase: 01-planning-document-corrections-and-the-upstream-report
    provides: "AGENTS.md's absolute rule (PR #17, Sergey) that money in a stored JSON document is a string, never a JSON number"
provides:
  - "REQUIREMENTS.md's EXACT-05 corrected to specify a decimal string, not integer cents as a JSON number, at the storage boundary"
  - "ROADMAP.md's Phase 4 success criterion 4 and Phase 5 depends-on line corrected to the same string-at-storage-boundary wording"
  - "DOCC-07 registered in REQUIREMENTS.md as a requirement bullet, a traceability row, and an updated Phase 1 coverage count (7 -> 8)"
  - "ROADMAP.md's Phase 1 requirements line and Coverage table DOCC count updated to include DOCC-07 (6 -> 7), agreeing with REQUIREMENTS.md"
affects: [phase-4-exact-arithmetic, phase-5-project-local-store]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Storage-boundary money representation is a decimal string; rationals inside computation and decimal strings on the MCP wire are unaffected by the storage-layer correction — only one of the three layers changed."

key-files:
  created: []
  modified:
    - .planning/REQUIREMENTS.md
    - .planning/ROADMAP.md

key-decisions:
  - "Only the storage layer's representation changed (integer cents as a JSON number -> decimal string); the computation layer (exact rationals) and the MCP-wire layer (decimal strings) were verified unchanged in both REQUIREMENTS.md and ROADMAP.md, matching AGENTS.md's absolute rule that money in a stored JSON document is a string, never a JSON number."
  - "DOCC-07 was registered as a requirement in both REQUIREMENTS.md and ROADMAP.md independently, since the two files carry the same bookkeeping facts (requirement list, coverage counts) separately and would otherwise disagree."

requirements-completed: [DOCC-07]

# Metrics
duration: part of combined wave-1 commit (parallel with 01-01 and 01-03 Task 1)
completed: 2026-08-03
---

# Phase 1 Plan 2: REQUIREMENTS.md and ROADMAP.md Storage-Boundary Correction Summary

**EXACT-05 and ROADMAP.md's Phase 4/5 text reconciled with AGENTS.md's absolute rule that money in a stored JSON document is a decimal string, never a JSON number — the storage layer flips, while exact rationals in computation and decimal strings on the MCP wire are confirmed unchanged; DOCC-07 registered as a new requirement in both files.**

## Performance

- **Completed:** 2026-08-03 (commit `43d9c05`, part of Phase 1's three-plan parallel wave 1)
- **Tasks:** 3/3 completed
- **Files modified:** 2 (`.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md`)

## Accomplishments

- `REQUIREMENTS.md`'s EXACT-05 bullet now reads "money as a decimal **string** in JSON at the storage boundary (never a JSON number — decoded to exact cents by the semantic check, per AGENTS.md)", replacing the prior "integer cents in JSON at the storage boundary (`isSafeInteger`-guarded)" text; "rationals inside computation, decimal strings on the MCP wire" was left unchanged, as only the storage layer was wrong.
- A new **DOCC-07** requirement bullet was added to REQUIREMENTS.md's Documentation Corrections section, describing the reconciliation itself and naming exactly which files and lines it touches.
- DOCC-07 was added to REQUIREMENTS.md's Traceability table (a new row alongside DOCC-06) and to the Coverage-by-phase table, changing Phase 1's requirement count from 7 to 8 (`DOCC-01, ..., DOCC-06, DOCC-07, SEC-04`).
- `ROADMAP.md`'s Phase 4 success criterion 4 was corrected from "`isSafeInteger`-guarded integer cents in JSON at the storage boundary" to "a decimal **string** in JSON at the storage boundary (never a JSON number — a JSON number is an IEEE 754 double before any arithmetic happens)"; Phase 5's "Depends on" line was corrected from "(cents at the storage boundary)" to "(money as a string at the storage boundary)".
- `ROADMAP.md`'s own Phase 1 requirements line and its Coverage table's DOCC row were independently updated to include DOCC-07, changing the DOCC coverage count from 6 to 7, so ROADMAP.md agrees with REQUIREMENTS.md rather than silently disagreeing with it.

## Task Commits

All three tasks in this plan (EXACT-05/DOCC-07 in REQUIREMENTS.md, Phase 4/5 text in ROADMAP.md, ROADMAP.md's own bookkeeping lines) landed in the same combined commit as plan 01-01's edits and plan 01-03's Task 1 draft, as Phase 1's wave-1 parallel batch:

1. **Tasks 1-3: EXACT-05 correction, DOCC-07 registration, ROADMAP.md Phase 4/5 and bookkeeping updates** - `43d9c05` (docs)

## Files Created/Modified

- `.planning/REQUIREMENTS.md` - EXACT-05 corrected to a decimal string at the storage boundary; DOCC-07 added as a requirement bullet, a traceability row, and folded into Phase 1's coverage count (7 -> 8).
- `.planning/ROADMAP.md` - Phase 4 success criterion 4 and Phase 5's depends-on line corrected to a decimal string at the storage boundary; Phase 1's requirements line and Coverage table DOCC count updated to include DOCC-07 (6 -> 7).

## Decisions Made

- Verified, not merely asserted, that only the storage layer's representation changed: the "rationals inside computation" and "decimal strings on the MCP wire" phrases were checked to remain present and unchanged in both files after the edit, since a careless correction could have touched the wrong layer.

## Deviations from Plan

None — plan executed exactly as written; all three tasks' acceptance criteria (EXACT-05 text, DOCC-07 bookkeeping in REQUIREMENTS.md, and ROADMAP.md's independent DOCC-07 registration) were met.

## Issues Encountered

None.

## Next Phase Readiness

- Phase 4 (Exact Arithmetic) and Phase 5 (project-local store) now read a storage-boundary claim that agrees with AGENTS.md, instead of one that would have planned those phases against a contradicted representation.
- Independently re-verified: `01-VERIFICATION.md` (2026-08-03, must-have #8) confirms the corrected text in both files, the DOCC-07 bookkeeping entries, and the unchanged rationals/MCP-wire regression check, all read directly from the live repository.

---
*Phase: 01-planning-document-corrections-and-the-upstream-report*
*Completed: 2026-08-03*
