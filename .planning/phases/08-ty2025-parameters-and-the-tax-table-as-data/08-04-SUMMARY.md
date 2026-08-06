---
phase: 08-ty2025-parameters-and-the-tax-table-as-data
plan: 04
subsystem: mcp
tags: [mcp-tool, finance_tax_params, tax-params, tax-table, integration]

# Dependency graph
requires:
  - phase: 08-01
    provides: taxParamsByYear (TY2025 parameter set, per-parameter citations)
  - phase: 08-02
    provides: taxTableBandStructure (the Tax Table's 5-region band structure)
provides:
  - "finance_tax_params(year) MCP tool, registered in financeMcpHandlers"
  - "Real-process stdio reachability proof for finance_tax_params (fjs-run-integration.test.js)"
affects: [phase-09, phase-10, phase-11, phase-12, phase-13]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Open numeric-keyed lookup map (taxParamsResponses) mirroring finance_schema's open-string-keyed dialectSchemas lesson, applied to a numeric year key"
    - "Registry + integration-test call landed in one commit — the ordering rule 08-VALIDATION.md documents for any future MCP tool addition"

key-files:
  created:
    - fjs/server/finance_tax_params/module.f.js
  modified:
    - fjs/server/module.f.js
    - fjs-run-integration.test.js

key-decisions:
  - "The response carries parameters plus the Tax Table's band structure, never the generated rows — keeps the response well under the 64KB MCP size guard (08-CONTEXT.md decision)"
  - "taxParamsByYear[2025] narrowed exactly once at module scope via assert (never a cast or non-null assertion), and the resulting response2025 constant is what both the tool and its proof read from"

requirements-completed: [MCP-07]

# Metrics
duration: 25min
completed: 2026-08-05
---

# Phase 8 Plan 4: finance_tax_params MCP Tool Summary

**`finance_tax_params(year)` MCP tool serving TY2025's cited parameter set plus the Tax Table's band structure, registered in `financeMcpHandlers` and proven reachable through a real stdio session in the same commit.**

## Performance

- **Duration:** ~25 min
- **Tasks:** 2 completed
- **Files modified:** 3 (1 created, 2 modified)

## Accomplishments

- Built `fjs/server/finance_tax_params/module.f.js`, mirroring `finance_schema`'s shape exactly: an open numeric-keyed lookup map (`taxParamsResponses`), a `toolEntry`-built tool (`financeTaxParamsTool`), and an `errorResult` refusal for an unknown year naming both the offending year and the known set.
- The response (`response2025`) carries the standard deduction, aged/blind additional amounts, the dependent standard-deduction cap, ordinary rate brackets, capital-gains breakpoints, and `taxTableBandStructure` — explicitly never the generated Tax Table rows, keeping the response comfortably under the 64KB size guard (measured and proven, not just designed).
- Registered `financeTaxParamsTool` in `fjs/server/module.f.js`'s `financeMcpHandlers`, extended the existing `toolsListEnumeratesComposedRegistry` virtual-session proof leaf, and added a real-process `call('finance_tax_params', { year: 2025 })` to `fjs-run-integration.test.js` in the SAME commit as the registry edit — satisfying 08-VALIDATION.md's ordering constraint (T-08-04).
- MCP-07 is now satisfied; every one of Phase 8's four requirements (TAX-01, TAX-02, TAX-04, MCP-07) is covered across this phase's four plans.

## Task Commits

Each task was committed atomically:

1. **Task 1: finance_tax_params tool, mirroring finance_schema exactly** - `99cfc49` (feat)
2. **Task 2: Unit proof, registry wiring, and the integration-test call** - `ea2f45b` (test)

**Plan metadata:** committed alongside this SUMMARY (see below)

## Files Created/Modified

- `fjs/server/finance_tax_params/module.f.js` - New MCP tool: `response2025` (the narrowed, exported response constant), `taxParamsResponses` (open numeric-keyed lookup map), `knownYears`, `financeTaxParamsTool` (the `toolEntry`), and a `proof` export with three leaves (`year2025Resolves`, `responseStaysUnderSizeGuard`, `unknownYearRefused`).
- `fjs/server/module.f.js` - Imports and registers `financeTaxParamsTool` in `financeMcpHandlers`'s `fromRegistry([...])` array; extends `toolsListEnumeratesComposedRegistry` to assert `finance_tax_params` is advertised.
- `fjs-run-integration.test.js` - Adds a real-process `call('finance_tax_params', { year: 2025 })`, asserting the response is not an error and its text includes `'31500.00'` (MFJ standard deduction) and `'2025-32'` (its citation).

## Decisions Made

- Narrowed `taxParamsByYear[2025]` exactly once at module scope via `assert` (never a non-null assertion or cast, both banned by AGENTS.md), and built the exported `response2025` constant from that single narrowed value — both the tool's `taxParamsResponses` map and the proof's `year2025Resolves` leaf read from this one constant, never a second hand-typed literal or a fresh index into the map.
- Kept the two edits (registry entry + `fjs-run-integration.test.js` call) in one commit per 08-VALIDATION.md's explicit ordering note: `fjs-run-integration.test.js` derives its advertised/called tool sets from a live `tools/list` response at runtime, so a registry-only commit would have broken `npm test` immediately.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

`finance_tax_params(2025)` is registered, callable through the real stdio session, refuses an unsupported year actionably, and stays comfortably inside the response size guard. Phase 8 is complete: TAX-01 (08-01), TAX-02 (08-02), TAX-04 (08-03), and MCP-07 (08-04) are all satisfied. No blockers for subsequent phases that consume `finance_tax_params` or the underlying `fjs/tax/params`/`fjs/tax/table` modules.

## Verification Output

```
$ npm test
...
ℹ tests 242
ℹ suites 0
ℹ pass 242
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0

$ npm run test:integration
✔ TEST-01/TEST-02: fjs_run end to end through a real separate node index.js process and a real filesystem, with full tool coverage (805.618625ms)
ℹ tests 1
ℹ pass 1
ℹ fail 0

$ node --test 2>&1 | grep -c '^✔ import("./fjs/'
240   # (pre-phase baseline was 185; prior plans in this phase already raised it to 237 before this plan)

$ git status --porcelain
(empty)

$ git log --oneline -2
ea2f45b test(08-04): unit proof, registry wiring, and the integration-test call
99cfc49 feat(08-04): finance_tax_params tool, mirroring finance_schema exactly

$ git show --stat ea2f45b
 fjs-run-integration.test.js               | 13 +++++++
 fjs/server/finance_tax_params/module.f.js | 65 ++++++++++++++++++++++++++++++-
 fjs/server/module.f.js                    | 18 +++++----
 3 files changed, 87 insertions(+), 9 deletions(-)
```

## Self-Check: PASSED

- FOUND: fjs/server/finance_tax_params/module.f.js
- FOUND: commit 99cfc49
- FOUND: commit ea2f45b

---
*Phase: 08-ty2025-parameters-and-the-tax-table-as-data*
*Completed: 2026-08-05*
