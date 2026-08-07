---
phase: 11-wage-retirement-and-benefit-documents
plan: 03
subsystem: api
tags: [mcp, rtti, evo, cas, fjs-server, document-listing]

# Dependency graph
requires:
  - phase: 07-mcp-server-and-schema-tools
    provides: finance_schema/finance_tax_params's toolEntry construction pattern (host-side lookup-map tool)
  - phase: 11-02
    provides: buildRunSnapshot's DOC-15 archived-revision filtering (the sibling, guest-side half of retraction)
provides:
  - financeDocumentsListTool — a host-side MCP toolEntry over Evo<O>/Cas<O> enumerating stored documents
  - a local documentIdentitySchema identity-peek pattern for classifying a document's dialect without importing every dialect's schema
affects: [11-05 (registers financeDocumentsListTool into financeMcpHandlers + fjs-run-integration.test.js, same commit)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Host-side toolEntry closed directly over Evo<O>/Cas<O>, never routed through fjs_run/interpret"
    - "Local, loose identity-peek rtti schema (documentIdentitySchema) instead of validating against a dialect registry"
    - "Nested step/foldStep accumulator fold over an effectful loop, mirroring buildRunSnapshot's own idiom"

key-files:
  created:
    - fjs/server/finance_documents_list/module.f.js
  modified: []

key-decisions:
  - "One row per (subject, head) pair, not one row per subject — a subject with N concurrent heads yields N rows sharing the same subject but different hash"
  - "The literal string 'unknown' is the sentinel for a well-formed document with no dialect field at all (RESEARCH.md Assumption A2 — CONTEXT does not name one)"
  - "Dialect classification never validates against finance_schema's own lookup map — an unregistered dialect tag is listed verbatim, never treated as structurally invalid"
  - "financeDocumentsListTool is not registered into financeMcpHandlers in this plan — that lands in Plan 11-05, same commit as fjs-run-integration.test.js's new call, per the same-commit ordering constraint"

patterns-established:
  - "Pattern: a host-side MCP tool that needs to classify arbitrary stored JSON content without a throw uses a local, loose rtti identity-peek schema plus the [t, v] validate-then-narrow idiom — never the project's dialect registry, never JSON.parse + direct property access"

requirements-completed: [MCP-08]

# Metrics
duration: 30min
completed: 2026-08-07
---

# Phase 11 Plan 03: finance_documents_list Summary

**A host-side `finance_documents_list` MCP tool enumerating stored documents as `{subject, dialect, taxYear, hash}` JSON, active by default with `archived: true` opt-in, listing unknown-dialect documents under their real tag and skipping unparseable snapshots without crashing.**

## Performance

- **Duration:** 30 min
- **Started:** 2026-08-07T16:33:50-07:00
- **Completed:** 2026-08-07T16:51:05-07:00
- **Tasks:** 2
- **Files modified:** 1 (new file)

## Accomplishments
- `financeDocumentsListTool` — a host-side `toolEntry` over `Evo<O>`/`Cas<O>`, typed `<O extends Operation>(evo: Evo<O>) => (cas: Cas<O>) => ToolEntry<O | MemOp>`, mirroring `finance_schema`/`finance_tax_params`'s construction rather than `fjs_run`'s guest-program indirection.
- A local, deliberately loose `documentIdentitySchema` (`{ dialect: option(string), taxYear: option(number) }`) that classifies a document's dialect without importing or validating against `finance_schema`'s own dialect-to-schema lookup map — so an unregistered dialect tag is listed verbatim rather than rejected as "invalid."
- A nested `step`/`foldStep` accumulator fold (`evo.list` → per-subject `evo.head` → per-head `evo.revision`/`cas.read`/`parse`/`rttiValidate`) copying `buildRunSnapshot`'s own idiom, yielding one response row per (subject, head) pair.
- Seven independent proof leaves seeding a real `FileCas`+`Evo` store under `virtual`, covering: active-by-default, archived opt-in, an unregistered dialect listed with its real tag, a missing-dialect-field document using the `'unknown'` sentinel, a non-JSON snapshot blob skipped without a crash, the response entry shape (including the `taxYear` absent-vs-number discipline), and two concurrent heads yielding two distinct rows.
- Verified two of those leaves are load-bearing by mutation (collapsing the dialect branch to a constant reddened only `unknownDialectListedWithRealTag`; ignoring the `archived` argument reddened only `archivedOptIn`), then reverted.

## Task Commits

Each task was committed atomically:

1. **Task 1: `financeDocumentsListTool` — schema, fold, and toolEntry construction** - `7c47fa0` (feat)
2. **Task 2: Proof suite for `finance_documents_list`** - `63bab7d` (test)

**Plan metadata:** (this commit)

## Files Created/Modified
- `fjs/server/finance_documents_list/module.f.js` - `financeDocumentsListTool` (the MCP-08 tool), `documentIdentitySchema`, `DocumentListEntry`, and a seven-leaf proof suite

## Decisions Made
- **One row per (subject, head) pair** (RESEARCH.md Open Question 2's recommended reading): a subject with concurrent unmerged heads yields multiple rows sharing the same `subject`. Verified behaviorally by `oneRowPerSubjectHeadPair`, not just documented in prose.
- **`'unknown'` sentinel for a missing `dialect` field** — an arbitrary, recorded pick per RESEARCH.md Assumption A2; CONTEXT does not name a sentinel and any documented choice satisfies the stated success criteria.
- **No dialect-registry validation** — `documentIdentitySchema` is local to this file and never imports `finance_schema`'s lookup map, per CONTEXT/RESEARCH's explicit rejection of that approach (it would conflate "not one of ours" with "structurally invalid" and force importing every dialect just to reject unknown ones).
- **Registration deferred to Plan 11-05** — per the plan's own scope boundary and the same-commit ordering constraint (`fjs/server/module.f.js`'s `financeMcpHandlers` and `fjs-run-integration.test.js`'s new `call('finance_documents_list', ...)` must land together, since the integration test derives its advertised/called tool sets from a live `tools/list` response at runtime). Verified untouched: `git diff 84365af..HEAD --stat -- fjs/server/module.f.js fjs-run-integration.test.js` is empty.

## Deviations from Plan

None - plan executed exactly as written. One adjustment made during writing, not a deviation from the plan's intent: the docstring's prose initially named `finance_schema`'s `dialectSchemas` identifier literally, which collided with the plan's own acceptance-criterion grep (`grep -n "dialectSchemas" ... returns nothing`); reworded to describe it without repeating the identifier, so the grep-based acceptance check and the human-readable intent both hold.

## Issues Encountered

Two TypeScript typing issues surfaced while composing the nested `step`/`foldStep` chain, both resolved without changing the design:
- The inner `entryFor` helper's parameters needed explicit JSDoc parameter types (`(/** @type {string} */ subject) => ...`) rather than a `@type` annotation referencing the enclosing generic `O`, which JSDoc does not resolve at that nested position.
- The proof's `listThrough`/`writeDoc` helpers needed explicit `FileCas`/`Evo<FileCasOperation>`/`State` JSDoc types; without them TypeScript left the tool's generic `O` unresolved, which then failed to unify against `virtual`'s `NodeOp` constraint.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `financeDocumentsListTool` is fully implemented, type-checked, and proof-covered, ready for Plan 11-05 to import and register into `financeMcpHandlers` alongside the matching `fjs-run-integration.test.js` update in one commit.
- Project-local proof count: 532 → 539 (+7), full `npm test` green (2777/2777).
- `fjs/server/module.f.js` and `fjs-run-integration.test.js` remain untouched, exactly as this plan required.

---
*Phase: 11-wage-retirement-and-benefit-documents*
*Completed: 2026-08-07*

## Self-Check: PASSED

- FOUND: fjs/server/finance_documents_list/module.f.js
- FOUND: .planning/phases/11-wage-retirement-and-benefit-documents/11-03-SUMMARY.md
- FOUND: 7c47fa0 (Task 1 commit)
- FOUND: 63bab7d (Task 2 commit)
