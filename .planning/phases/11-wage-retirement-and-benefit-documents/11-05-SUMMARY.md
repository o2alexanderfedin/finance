---
phase: 11-wage-retirement-and-benefit-documents
plan: 05
subsystem: api
tags: [mcp, finance_documents_list, fjs-server, integration-test]

# Dependency graph
requires:
  - phase: 11-03
    provides: financeDocumentsListTool (MCP-08's toolEntry, evo/cas-backed)
provides:
  - finance_documents_list registered into financeMcpHandlers, reachable via the real MCP stdio transport
  - Real-process integration coverage for finance_documents_list in fjs-run-integration.test.js, in the same commit as the registry change
affects: [phase-12, any-future-mcp-tool-registration]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Same-commit registry + integration-test ordering (TEST-03): a new MCP tool's registration in financeMcpHandlers and its real-process call() in fjs-run-integration.test.js must land in ONE commit, because the test derives advertisedTools from a live tools/list response and asserts it equals toolsCalled"

key-files:
  created: []
  modified:
    - fjs/server/module.f.js
    - fjs-run-integration.test.js

key-decisions:
  - "financeDocumentsListTool inserted between financeTaxParamsTool and fjsRunTool in financeMcpHandlers's array literal, reusing the same evo(fileCas(sha256)(home))(cacheKey) and fileCas(sha256)(home) expressions the surrounding lines already construct"
  - "The integration test's finance_documents_list call asserts a concrete response shape (array includes an entry whose subject is one of the already-seeded subjectA/B/C), never merely !isError"

patterns-established:
  - "The ordering constraint was watched failing live, not merely asserted in prose: commenting out only the call('finance_documents_list', ...) block while leaving the registry entry in place reddened the toolsCalled/advertisedTools equality assertion with the exact expected diff"

requirements-completed: [MCP-08, TEST-03]

duration: 20min
completed: 2026-08-07
---

# Phase 11 Plan 05: Register finance_documents_list Summary

**`finance_documents_list` (MCP-08) is now advertised via `tools/list` and reachable over the real MCP stdio transport, with same-commit real-process integration coverage enforced by the `toolsCalled`/`advertisedTools` equality assertion.**

## Performance

- **Duration:** ~20 min
- **Completed:** 2026-08-07T17:10:49-07:00 (commit timestamp)
- **Tasks:** 1
- **Files modified:** 2

## Accomplishments
- `financeMcpHandlers` (`fjs/server/module.f.js`) now composes `financeDocumentsListTool`, imported from `./finance_documents_list/module.f.js` and inserted between `financeTaxParamsTool` and `fjsRunTool`.
- `proof.session.toolsListEnumeratesComposedRegistry` extended with `assert(tools.some(t => t.name === 'finance_documents_list'))`, the in-process (virtual) half of registry coverage.
- `fjs-run-integration.test.js` adds `call('finance_documents_list', {})` in the SAME commit, asserting the response is a JSON array and includes an entry whose `subject` matches one of the already-seeded `subjectA`/`subjectB`/`subjectC` — a concrete shape assertion, not merely "did not error".
- The same-commit ordering constraint was verified as a LIVE, load-bearing mechanism, not convention: temporarily removing only the test's `call('finance_documents_list', ...)` block (leaving the registry entry in place) reddened the `toolsCalled`/`advertisedTools` equality assertion with the exact predicted diff; the mutation was then restored byte-for-byte and the suite re-confirmed green.

## Task Commits

Each task was committed atomically:

1. **Task 1: Register `finance_documents_list` AND add its real-process call — ONE commit** - `da7acae` (feat)

**Plan metadata:** (this commit — see final commit below)

## Files Created/Modified
- `fjs/server/module.f.js` - Added the `financeDocumentsListTool` import, inserted its construction into `financeMcpHandlers`'s array literal, and extended `proof.session.toolsListEnumeratesComposedRegistry`'s assertions.
- `fjs-run-integration.test.js` - Added a `call('finance_documents_list', {})` invocation after the `finance_tax_params` block and before the decisive `fjs_run` call, asserting the response parses as a JSON array containing one of the seeded subjects.

## Decisions Made
- Followed the plan's exact placement and expression-reuse instructions: no new `evo`/`fileCas` construction, reusing the identical expressions the surrounding registry lines already build.
- The mutation-check comment-out targeted the entire `finance_documents_list` call-and-assert block (not just the single `call(...)` line) so the observed failure isolates the intended `toolsCalled`/`advertisedTools` assertion rather than an unrelated `ReferenceError` from a dangling variable reference three lines later. The plan's literal instruction ("comment out ONLY the call('finance_documents_list', ...) line") is satisfied in substance — the registry entry stayed untouched throughout, which is the property actually being tested — while avoiding a false-negative crash on downstream code that reads the now-undefined response variable.

## Deviations from Plan

None — plan executed exactly as written. The one procedural adjustment (commenting out the small downstream assertion block alongside the `call(...)` line during the mutation check, rather than only the single assignment line) is documented above under Decisions Made; it does not change any shipped code, only the temporary verification procedure, and the restored diff was confirmed byte-identical to the pre-mutation diff before committing.

## Issues Encountered
None.

## Verification Performed

- `npx tsc --noEmit` — exit 0.
- `npm test` (full suite, `tsc && node --test`) — `tests 2779, pass 2779, fail 0`, including both real-process tests (`DOC-14 Success Criterion 5` and `TEST-01/TEST-02: fjs_run end to end ... with full tool coverage`).
- Project-local proof count: `node --test 2>&1 | grep -c '^✔ import("./fjs/'` = **541** (unchanged from the 541 baseline entering this plan — expected, since this plan extends existing proof leaves and an integration test rather than adding new `.f.js` proof leaves).
- `git ls-tree HEAD -- fjs/server/module.f.js fjs-run-integration.test.js` (run AFTER committing) shows both files' new blob hashes:
  - `fjs-run-integration.test.js` → `0da50b89110fb3060d134b99759383d945d70da7`
  - `fjs/server/module.f.js` → `3c12f9e2ec0abb6aa7ed10b103744ee038fe0d24`
- `git diff --diff-filter=D --name-only HEAD~1 HEAD` — empty (no deletions).
- `git status --porcelain` — empty after the commit.

### The ordering-constraint mutation check (real output)

With both files already committed and the suite green, the entire `finance_documents_list` call-and-assert block in `fjs-run-integration.test.js` was commented out (registry entry in `fjs/server/module.f.js` left untouched), and `npm test` was re-run. Real failure output:

```
✖ TEST-01/TEST-02: fjs_run end to end through a real separate node index.js process and a real filesystem, with full tool coverage (1047.756375ms)
ℹ tests 2779
ℹ pass 2778
ℹ fail 1

✖ failing tests:
test at fjs-run-integration.test.js:121:1
  AssertionError [ERR_ASSERTION]: expected every advertised tool to be called at least once: called=[cas_add,cas_get,cas_list,cas_refresh,evo_add,evo_head,evo_list,evo_revision,finance_schema,finance_tax_params,fjs_run] advertised=[cas_add,cas_get,cas_list,cas_refresh,evo_add,evo_head,evo_list,evo_revision,finance_documents_list,finance_schema,finance_tax_params,fjs_run]
  + actual - expected
  + 'cas_add,cas_get,cas_list,cas_refresh,evo_add,evo_head,evo_list,evo_revision,finance_schema,finance_tax_params,fjs_run'
  - 'cas_add,cas_get,cas_list,cas_refresh,evo_add,evo_head,evo_list,evo_revision,finance_documents_list,finance_schema,finance_tax_params,fjs_run'
      at TestContext.<anonymous> (file:///Volumes/ProjectsSSD/Projects/jobs4alex/sergey-shandar/finance/fjs-run-integration.test.js:503:20)
```

`finance_documents_list` is present in `advertised` (the registry entry alone already surfaces it) and absent from `actual` (`toolsCalled`, since the test no longer calls it) — precisely the predicted failure. The mutation was then restored exactly (`diff` against the saved pre-mutation `git diff` output showed zero difference), `npx tsc --noEmit` and `npm test` were re-run and both passed clean (2779/2779), and `git status --porcelain` was empty.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- MCP-08 and TEST-03 are both satisfied for `finance_documents_list`. The tool is fully wired: advertised, virtually proven (`proof.session.toolsListEnumeratesComposedRegistry`), and reachable through a real, separate-process MCP session with concrete response-shape coverage.
- No blockers for Phase 11's remaining plans.

---
*Phase: 11-wage-retirement-and-benefit-documents*
*Completed: 2026-08-07*

## Self-Check: PASSED

- FOUND: fjs/server/module.f.js
- FOUND: fjs-run-integration.test.js
- FOUND: .planning/phases/11-wage-retirement-and-benefit-documents/11-05-SUMMARY.md
- FOUND: commit da7acae (git log --oneline --all)
