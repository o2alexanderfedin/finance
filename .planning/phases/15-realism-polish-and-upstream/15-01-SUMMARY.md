---
phase: 15-realism-polish-and-upstream
plan: 01
subsystem: reporting
tags: [functionalscript, fjs_run, mcp, guest-abi, provenance, real-process-testing]

# Dependency graph
requires:
  - phase: 09
    provides: "ReportLine's traceability shape (value/sources/rule) and the guest ABI (fjs/guest/module.f.js)"
  - phase: 07
    provides: "fjs_run's real, separate-process MCP execution path and the fjs-run-integration.test.js harness"
provides:
  - "fjs/report/payer/module.f.js — a second, genuinely non-tax report (income received per payer) over vnd.fjs.1099int/1099div documents"
  - "A mechanical import-graph gate proving fjs/report/payer never imports fjs/tax/*"
  - "A real-process proof that the stored payer-report program runs through the unmodified fjs_run MCP path"
affects: [15-02, 15-03, 15-04, 15-05, 15-06, phase-16]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "String/function-twin pair for a guest program (payerReportSource/payerReport), kept in sync by hand, each exercised by a different test tier — the established 07-08/07-09 precedent applied to a second report"
    - "Root-level *.test.js mechanical import-graph gate with a positive control (magi-gate.test.js's shape), scoped to one directory"

key-files:
  created:
    - fjs/report/payer/module.f.js
    - payer-report-gate.test.js
    - payer-report-integration.test.js
  modified: []

key-decisions:
  - "The payer report's DIV-present payer also holds the absent-box 1099-INT (rather than three fully distinct payers), so both the unit proof and the real-process test demonstrate that an absent in-scope box neither blocks nor corrupts a payer's total derived from a different document/dialect"
  - "payerReportSource and payerReport are two independently hand-authored artifacts, never one derived from the other (not .toString()); kept in sync by construction across two different test tiers rather than a runtime cross-check, mirroring 07-08/07-09's established split"
  - "The two-dialect scope boundary (1099-INT box1, 1099-DIV box1a only) is documented as deliberate and mechanically additive to widen, not a defect — Schedule D's Decision-2.5 boundary-comment style"

requirements-completed: [PROV-08]

# Metrics
duration: 35min
completed: 2026-08-11
---

# Phase 15 Plan 01: Payer Report (PROV-08) Summary

**A second, genuinely non-tax report — income received per payer, aggregated across stored 1099-INT/1099-DIV documents — runs through the real, unmodified `fjs_run` MCP path in a separate OS process, with a mechanical gate proving it never touches `fjs/tax/*`.**

## Performance

- **Duration:** ~35 min
- **Tasks:** 3 completed
- **Files modified:** 3 created, 0 modified

## Accomplishments

- Built `fjs/report/payer/module.f.js`: the payer report's reference/spec module, a sibling of `fjs/form1040` (never nested under it), carrying the guest program's literal zero-import source text (`payerReportSource`) side by side with a real JS function twin (`payerReport`), exercised via `interpret(hostMap)` against a hand-built three-document fixture
- Proved the two-dialect scope boundary (1099-INT box1, 1099-DIV box1a) mechanically: a payer with only an absent box never appears in the result at all — never as a zero-valued entry — while a payer present across both dialects accumulates correctly into one traced total
- Added `payer-report-gate.test.js`: a mechanical, `magi-gate.test.js`-shaped import scan proving `fjs/report/payer` imports nothing from `fjs/tax/*`, paired with a positive control
- Added `payer-report-integration.test.js`: a real, separate `node index.js` process proof (the `fjs-run-integration.test.js` harness) that stores the payer report's literal bytes, runs them through the real `fjs_run` tool, and checks the result against an independently hand-computed expected object

## Task Commits

Each task was committed atomically:

1. **Task 1: The payer-report reference module — guest source, host twin, and a hand-computed unit proof** - `8721efd` (feat)
2. **Task 2: Mechanical import-graph gate — fjs/report/payer imports nothing from fjs/tax/\*** - `b17d932` (test)
3. **Task 3: Real-process proof — the payer report runs through fjs_run in a genuinely separate process** - `5294df2` (test)

## Files Created/Modified

- `fjs/report/payer/module.f.js` - `payerReportSource` (guest literal text) + `payerReport` (function twin) + unit proof against a hand-built three-document fixture
- `payer-report-gate.test.js` - mechanical scan: no `fjs/tax/*` import under `fjs/report/payer`, plus a positive control
- `payer-report-integration.test.js` - real, separate-process `fjs_run` proof against two payers' worth of seeded 1099-INT/1099-DIV documents

## Decisions Made

- **Cross-document/cross-dialect fixtures, stronger than the plan's literal minimum in each test tier.** Task 1's unit proof gives one payer BOTH a present 1099-INT and a present 1099-DIV, proving accumulation across two documents and two dialects into one traced total (`sources.length === 2`), while a second payer's only document has the box absent and never appears at all. Task 3's real-process test gives one payer an absent-box 1099-INT AND a present 1099-DIV, proving the absent document neither blocks nor corrupts that same payer's total derived from the other document/dialect. Both are strictly stronger than the plan's literal three-distinct-payers minimum.
- **`payerReport` declared with a zero-argument inner function** (`ctx => () => ...`) rather than `ctx => args => ...`, since this report takes no arguments — the same pattern `fjs/server/fjs_run/module.f.js`'s own `sumReport`/`demoReport` fixtures use against `Report`'s one-argument declared type (TypeScript admits fewer parameters than declared).
- **No document-dialect-schema import in the function twin.** `PayerScopedDocument` is a minimally-shaped local type, not `Ts<typeof oneZeroNineNineIntSchema>` — the guest program's own stored text cannot import either schema, and the function twin is written against the identical literal field names for exactly that reason (documented in the module header).

## Deviations from Plan

None — plan executed exactly as written. No Rule 1/2/3 auto-fixes were needed; no architectural questions arose.

## Issues Encountered

None. Both the unit proof (Task 1) and the real-process integration test (Task 3) passed on the first real attempt against the fixtures as designed; each was still mutation-verified per AGENTS.md's "a proof is not known to work until you have watched it fail" — see below.

**Mutation verification performed (AGENTS.md discipline, not a defect found):**

- Task 1: dropped the `existingValue +` term from `payerReport`'s cents accumulation — the aggregation leaf's hand-typed `'150.00'` total turned red (reported `'50.00'` instead of the correct cross-document sum), confirming the leaf actually exercises accumulation rather than merely re-stating a single read. Reverted; `git status` clean.
- Task 2: added a scratch file under `fjs/report/payer/` importing `fjs/tax/params/module.f.js` — the gate correctly turned red, naming the offending file and line. Deleted the scratch file; `git status` clean.
- Task 3: mutated the literal `payerReportSource` guest text (the DIV box-path detection branch) to return `undefined` — the real, separate-process run's result correctly dropped the affected payer's entire entry, and the assertion against the independently hand-computed expected object caught it. Reverted; confirmed byte-identical via `git diff --numstat` (no output).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- PROV-08 is fully delivered: `npm test` is green at 6173/6173, `tsc` is clean, and the de-duplicated project-local proof count moved from 845 (end of Phase 13) to **847** (Task 1's two new leaves; the two root-level `*.test.js` files are counted separately by `npm test`'s total, not by the `import("./fjs/...")`-scoped de-duplication convention).
- Plans 15-02 through 15-06 (PROV-06, TAX-17, MCP-09, DOC-16) are unaffected by and independent of this plan's files — no shared module was touched.
- `fjs/report/payer/module.f.js` is available as a second worked example of the string/function-twin pattern if a future report (e.g. a 1040-X diff's own guest-side needs, though PROV-06 is host-side per 15-RESEARCH.md) needs the same split.

---
*Phase: 15-realism-polish-and-upstream*
*Completed: 2026-08-11*

## Self-Check: PASSED

All claimed files exist on disk and all three task commits are present in `git log --oneline --all`:

- `fjs/report/payer/module.f.js` — FOUND
- `payer-report-gate.test.js` — FOUND
- `payer-report-integration.test.js` — FOUND
- `.planning/phases/15-realism-polish-and-upstream/15-01-SUMMARY.md` — FOUND
- `8721efd` (Task 1) — FOUND
- `b17d932` (Task 2) — FOUND
- `5294df2` (Task 3) — FOUND
