---
phase: 01-planning-document-corrections-and-the-upstream-report
plan: 01
subsystem: docs
tags: [planning-corpus, false-claim-correction, mcp-client-scope, import-safety]

# Dependency graph
requires: []
provides:
  - "PROJECT.md, README.md, todo/plan.md, fjs/todo/implement-mcp-server.md corrected: no document proposes djs/parser as a validation remedy"
  - "The import() deferral rationale rests on schedule grounds with named compensating controls (SEC-01/02/03), not user trust"
  - "Claude Code / Claude Desktop named as the demonstration client in PROJECT.md and README.md; remote transport recorded as a v2 milestone"
  - "fjs_run's proof-testability claim scoped correctly to the stdio server process, not the whole execution path"
  - "TY2025 parameter-sourcing rule (Rev. Proc. 2024-40 as modified by Rev. Proc. 2025-32) recorded in PROJECT.md and todo/plan.md"
affects: [phase-3-restricted-interpreter, phase-4-exact-arithmetic, phase-8-tax-computation]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Historical blockquotes (e.g. PROJECT.md's verbatim quote of the original README goal, PR #1 c7a9cce) are left unedited even when they contain a claim corrected elsewhere in the same file — editing them would falsify the historical record."

key-files:
  created: []
  modified:
    - .planning/PROJECT.md
    - README.md
    - todo/plan.md
    - fjs/todo/implement-mcp-server.md

key-decisions:
  - "The ChatGPT mentions inside PROJECT.md's verbatim blockquote of the original README goal (PR #1, commit c7a9cce) were deliberately left unedited — they are a quoted historical record, not a live claim; only the live prose (opening paragraph, Success Criterion 2) was corrected to name Claude Code / Claude Desktop."
  - "djs/parser was removed as a proposed import() validation remedy everywhere, replacing it with the correct reasoning: djs is a data-only language with no function node, so it cannot validate a program."

requirements-completed: [DOCC-01, DOCC-02, DOCC-03, DOCC-04, DOCC-05, DOCC-06]

# Metrics
duration: part of combined wave-1 commit (parallel with 01-02 and 01-03 Task 1)
completed: 2026-08-03
---

# Phase 1 Plan 1: PROJECT.md, README.md, todo/plan.md, fjs/todo/implement-mcp-server.md Corrections Summary

**Six false or misleading claims deleted across four planning documents — the djs/parser validation remedy, the ChatGPT-as-demonstration-client claim, the "sole user is trusted and local" import() rationale, the unscoped "cannot be proof-tested" claim, and the missing TY2025 parameter-sourcing citation — all corrected in place with no code or behavior change.**

## Performance

- **Completed:** 2026-08-03 (commit `43d9c05`, part of Phase 1's three-plan parallel wave 1)
- **Tasks:** 3/3 completed
- **Files modified:** 4 (`.planning/PROJECT.md`, `README.md`, `todo/plan.md`, `fjs/todo/implement-mcp-server.md`)

## Accomplishments

- `.planning/PROJECT.md`'s execution-boundary claim and its Key Decisions row now state the `Object.hasOwn` + null-prototype guard condition that makes "an operation not in the map cannot happen" true, instead of asserting it unconditionally.
- The `import()` deferral in `PROJECT.md`, `todo/plan.md`, and `fjs/todo/implement-mcp-server.md` now rests on schedule grounds — the untrusted party is the document, not the user — with `--permission` (SEC-01), an import-specifier allow-list (SEC-02), and content-hash-derived filenames (SEC-03) named as the compensating controls, replacing the "sole user is trusted and local" rationale everywhere it appeared.
- `djs/parser` no longer appears anywhere as a proposed validation remedy; every remaining mention states plainly that it cannot validate a program because it is a data-only language with no function node.
- `PROJECT.md`'s "What This Is" opening paragraph and Success Criterion 2, and `README.md`'s equivalent line, now name Claude Code / Claude Desktop as the demonstration client, with remote transport (HTTPS + OAuth, required for a browser-hosted client such as ChatGPT) recorded as a v2 milestone. The historical blockquote later in `PROJECT.md` (a verbatim quote of the original README goal, PR #1, `c7a9cce`) was deliberately left untouched, since editing a quoted historical record would falsify it.
- `fjs/todo/implement-mcp-server.md`'s "cannot be proof-tested" claim is now scoped to the stdio server *process*; the same section adds that this does not extend to `fjs_run`, because `import()` runs through the `import_` effect, which `fjs/effects/node/virtual` interprets in-memory, making the whole materialize-and-run path proof-testable with no real filesystem.
- `PROJECT.md` and `todo/plan.md` both now state that TY2025 parameters (brackets, standard deduction, thresholds) must be sourced from Rev. Proc. 2024-40 as modified by Rev. Proc. 2025-32, not the original 2025 inflation-adjustment release.

## Task Commits

All three tasks in this plan (PROJECT.md/README.md, todo/plan.md, fjs/todo/implement-mcp-server.md) landed in a single combined commit alongside plan 01-02's edits and plan 01-03's Task 1 draft, as Phase 1's wave-1 parallel batch:

1. **Tasks 1-3: PROJECT.md, README.md, todo/plan.md, fjs/todo/implement-mcp-server.md corrections** - `43d9c05` (docs)

## Files Created/Modified

- `.planning/PROJECT.md` - Execution-boundary guard condition stated; import() deferral rewritten to schedule grounds with named compensating controls; Claude Code/Desktop named as client, remote transport recorded as v2; TY2025 parameter-sourcing rule added.
- `README.md` - ChatGPT-as-client wording replaced with Claude Code/Desktop, plus the v2 remote-transport sentence.
- `todo/plan.md` - Import-time safety rationale corrected to schedule grounds; Week 5 bullet corrected to state djs/parser cannot validate a program; Week 2 goal updated with the TY2025 parameter-sourcing rule.
- `fjs/todo/implement-mcp-server.md` - "Simply cannot happen" claim qualified with the guard condition; import-time execution rationale corrected; proof-testability claim scoped to the stdio server process, with fjs_run's proof-testability via the virtual interpreter stated explicitly.

## Decisions Made

- The ChatGPT mentions inside `PROJECT.md`'s verbatim historical blockquote (quoting the original README goal from PR #1, `c7a9cce`) were left unedited on purpose — they document what the README said at the time, not a current claim, and editing them would falsify the historical record. Only the live prose surrounding the blockquote was corrected.

## Deviations from Plan

None — plan executed exactly as written; all six targeted false claims were corrected, and the historical blockquote was correctly left untouched per the plan's own instruction.

## Issues Encountered

None.

## Next Phase Readiness

- These four files no longer contain the false claims that would have misled later phases planned against them (Phase 3's restricted interpreter reads `fjs/todo/implement-mcp-server.md`'s guard/proof-testability claims; Phase 8's tax computation reads `PROJECT.md`/`todo/plan.md`'s TY2025 parameter-sourcing rule).
- Independently re-verified: `01-VERIFICATION.md` (2026-08-03) confirms all six corrections live in the repository via direct grep/read, not inferred from this summary.

---
*Phase: 01-planning-document-corrections-and-the-upstream-report*
*Completed: 2026-08-03*
