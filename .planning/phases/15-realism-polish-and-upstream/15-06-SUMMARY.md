---
phase: 15-realism-polish-and-upstream
plan: 06
subsystem: mcp-server
tags: [functionalscript, dialect-registry, media-detection, cas-refresh, real-process, requirements-correction]

# Dependency graph
requires:
  - phase: 15-02
    provides: "fjs/document/prior_year_capital_loss/module.f.js — the vnd.fjs.prior_year_capital_loss dialect, the twelfth local dialect this registry wraps"
  - phase: 15-03
    provides: "fjs/server/module.f.js already edited to register fjs_check — this plan lands its casRefreshTool edit on top of that same file"
provides:
  - "fjs/media/dialects/module.f.js — financeDialects (thirteen entries: twelve local dialects wrapped via upstream dialectEntry, plus revisionDialect reused unchanged) and detectFinance = detect(financeDialects)"
  - "cas_refresh's response widened to { status, dialectCounts }, wiring detectFinance into a real, reachable running path"
  - "cas-refresh-cross-process.test.js proving detectFinance reachable from a genuinely separate real process's tools/call"
  - "REQUIREMENTS.md's DOC-16 entry corrected from a stale single-check description to the actual registry-based detect/dialectEntry, marked Complete in both the checkbox and the traceability table"
affects: [phase-16]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Local adoption of an already-shipped upstream capability (functionalscript@0.43.1's dialectEntry/detect) rather than reimplementation — no PR filed or needed"
    - "Hand-typed dialect count (13), independent of financeDialects.length, mirroring fjs/document/1099b's expectedMoneyBoxFieldCount idiom"
    - "cas_refresh's second full-store re-list-and-classify pass, accepted (T-15-12) as consistent with buildCache's own already-full-rescan contract"

key-files:
  created:
    - fjs/media/dialects/module.f.js
  modified:
    - fjs/server/module.f.js
    - cas-refresh-cross-process.test.js
    - .planning/REQUIREMENTS.md

key-decisions:
  - "financeDialects carries thirteen entries, not twelve: verified the real fjs/document/*, fjs/run, fjs/return/profile tree directly via grep for '^export const dialect = ' rather than trusting the plan's own table count, since 15-02 added prior_year_capital_loss after the plan's interface block was written. Confirmed exactly twelve local dialect= exports plus upstream's own revisionDialect = 13."
  - "The unregistered-dialect blob's behavior in cas_refresh's dialectCounts is: present, counted under its own detectVec fallback mime type ('text/plain'), never absent and never silently merged into a registered dialect's count. Chosen because that is what detectFinance actually returns (a well-formed JSON blob with no matching dialect falls through to the ordinary text/plain verdict), documented at casRefreshTool's own module header per the plan's explicit instruction to pick one behavior and state it."
  - "Every dialectEntry's extraValidate is written inline (v => checkX(v)[0] === 'ok') per dialect rather than factored into one shared generic helper, to avoid a generic-typing/any tradeoff under this project's strict tsconfig: dialectEntry's own extraValidate parameter type is contextual per schema (Ts<T>), and a shared helper would need either a generic signature TypeScript cannot cleanly express without widening, or a cast the project's own hard rules forbid. Twelve near-identical one-liners typecheck cleanly with no any; the module docstring quotes the upstream isValidRevision precedent this mirrors."

requirements-completed: [DOC-16]

# Metrics
duration: 55min
completed: 2026-08-11
---

# Phase 15 Plan 06: The Dialect Registry (DOC-16) Summary

**`fjs/media`'s already-shipped `dialectEntry`/`detect` registry (functionalscript 0.43.1) adopted locally for all thirteen of this repo's own dialects and wired into `cas_refresh`'s real running path — proven reachable from a genuinely separate real process, not merely registered under a virtual harness — with REQUIREMENTS.md's stale single-check DOC-16 description corrected to match.**

## Performance

- **Duration:** ~55 min
- **Tasks:** 3 completed
- **Files modified:** 1 created, 3 modified

## Accomplishments

- Built `fjs/media/dialects/module.f.js`: `financeDialects` wraps all twelve local finance dialects (1099b, 1099div, 1099int, 1099r, itemized_deductions, medical_expenses, ocr, ssa1099, w2, run, return_profile, prior_year_capital_loss) via upstream's `dialectEntry`, plus `revisionDialect` reused unchanged from `functionalscript/fjs/media/revision`, for thirteen registered entries — `detectFinance = detect(financeDialects)`
- Wired `detectFinance` into `casRefreshTool`'s handler: after the existing cache rebuild/write, it now re-lists and re-reads every stored CAS blob, classifies each, and reports a `{ [mimeType]: count }` map — `cas_refresh`'s response widened from the bare string `'refreshed'` to `{ status: 'refreshed', dialectCounts }`
- Extended `cas-refresh-cross-process.test.js` (a real `node index.js` server process, seeded by a real, separate `fjs cas add` process) with a new assertion that the returned `dialectCounts` genuinely reflects the externally-written `vnd.fjs.revision` blob — `detect` reachable end to end, not just under a virtual harness
- Corrected REQUIREMENTS.md's DOC-16 entry, which described an older `fjs/media` recognizing only `vnd.fjs.revision` via one hardcoded check ("its own docstring says 'currently just vnd.fjs.revision'"); replaced with text stating the registry already ships upstream at the pinned version, adopted locally here, wired into a real path — checkbox and traceability-table Status column both flipped to Complete

## Task Commits

Each task was committed atomically:

1. **Task 1: The local dialect registry — financeDialects and detectFinance** - `894c822` (feat)
2. **Task 2: Wire detectFinance into cas_refresh's response** - `625af0e` (feat)
3. **Task 3: Real-process reachability, and correcting REQUIREMENTS.md's stale DOC-16 text** - `4d0daa7` (feat)

## Files Created/Modified

- `fjs/media/dialects/module.f.js` - `financeDialects` (13 entries) + `detectFinance`, with a hand-typed count guard and one generated detection proof per dialect plus an unregistered-dialect fall-through leaf
- `fjs/server/module.f.js` - `casRefreshTool` widened to fold `cas.list()`/`collectRead(cas.read(hash))` through `detectFinance`, reporting `dialectCounts`; updated `seedInvisibleUntilRefreshed`'s assertion for the new JSON body; added `dialectCountsReportsPerDialectClassification`
- `cas-refresh-cross-process.test.js` - one new assertion: the real, separate-process `cas_refresh` response's `dialectCounts` includes the externally-written `vnd.fjs.revision` blob
- `.planning/REQUIREMENTS.md` - DOC-16 entry text corrected; checkbox and traceability-table Status both marked Complete

## Decisions Made

- **Verified the real dialect count directly rather than trusting the plan's own table.** The plan's interface block warned that 15-02 added a dialect since the plan text was written. Ran `grep -rn "^export const dialect = " fjs/` against the real tree: exactly twelve `vnd.fjs.*` local exports (matching the interface table's twelve rows, prior_year_capital_loss included) plus upstream's `revisionDialect` = 13. `fjs/document/consolidated_provenance` was checked and confirmed to have no `dialect` export of its own (it composes two OTHER dialects' tags, not a fourteenth one).
- **Picked and documented the unregistered-dialect fallback behavior for `dialectCounts`.** The plan explicitly required choosing one of two options (absent from the map, or present under a fallback entry) and stating the choice. Chose "present, under `text/plain`" — the literal, unmodified behavior `detectFinance`'s own `detectVec` fallback already produces — documented at `casRefreshTool`'s module header and pinned by a hand-typed-count-of-1 assertion in the new proof leaf.
- **Inlined each dialect's `extraValidate` rather than factoring a shared generic helper.** `dialectEntry`'s second-argument type is `(_: Ts<T>) => boolean`, contextual per schema `T`; a shared helper taking `checkReferences` generically would need either a wider generic signature or a type assertion this project's hard rules forbid (no cast over an indexed access, no `any`). Twelve near-identical one-line arrow functions typecheck cleanly with full contextual inference — the same tradeoff upstream's own `fjs/media/revision` makes by writing its one `isValidRevision` inline rather than through a shared abstraction.

## Deviations from Plan

None — plan executed as written. All three tasks' acceptance criteria were met without needing an architectural change, a scope addition, or a auto-fixed bug beyond the plan's own explicit instructions (e.g., verifying the real dialect count and picking the unregistered-dialect fallback behavior were both plan-mandated decisions, not deviations).

## Issues Encountered

None. `tsc --noEmit` was clean on every task's first attempt after implementation; no `TS6133`/`TS2xxx` orphaned-binding or type-mismatch errors were hit.

**Mutation verification performed (AGENTS.md discipline: "a proof is not known to work until you have watched it fail"):**

- Task 1: removed `revisionDialect` from the `financeDialects` array (a silent-removal mutation). Both `proof.financeDialects.expectedCount` (the hand-typed-13 guard) and `proof.detectFinance["vnd.fjs.revision"]` (its own generated leaf) correctly went red. Reverted; `diff` against the pre-mutation file was byte-identical.
- Task 2: mutated the dialect-count increment from `(acc[mimeType] ?? 0) + 1` to `(acc[mimeType] ?? 0) + 0` (a no-op that keeps every binding referenced, avoiding the "mutation does not compile" trap AGENTS.md warns about — an earlier attempt that deleted the whole classify branch orphaned the `detectFinance`/`readResult` bindings and failed to compile, exactly as predicted). The mutated build correctly reddened `proof.casRefresh.dialectCountsReportsPerDialectClassification` while `proof.casRefresh.seedInvisibleUntilRefreshed` (which only checks `status`, not counts) correctly stayed green — confirming the new leaf, not the old one, is what actually pins the counts. Reverted; `diff` byte-identical.
- Task 3: mutated the new real-process assertion to check `dialectCounts['application/vnd.fjs.1099int+json']` (a dialect never seeded in this scenario) instead of `vnd.fjs.revision`. The real, separate-process test correctly failed, and the assertion's own failure message printed the ACTUAL server response — `{"status":"refreshed","dialectCounts":{"application/vnd.fjs.revision+json":1}}` — decisive evidence that `detectFinance` genuinely classified the externally-written blob through a real process, not a stub. Reverted; `diff` byte-identical.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- DOC-16 is fully delivered: the registry is adopted locally (not reimplemented), wired into `cas_refresh`'s real running path, proven at three levels — a virtual per-dialect proof (Task 1), a virtual `cas_refresh` proof with seeded blobs (Task 2), and a genuinely separate real process writing content another genuinely separate real process then classifies (Task 3) — and REQUIREMENTS.md matches the shipped implementation.
- `fjs/media/dialects/module.f.js` is a pure, standalone registry module with no dependents beyond `fjs/server/module.f.js`'s single import — nothing else in this phase or a later one needs to touch it to build on this work.
- This is the last plan of Phase 15 (Realism Polish and Upstream). All five ROADMAP success criteria for the phase — PROV-08, PROV-06, TAX-17, MCP-09, DOC-16 — are now complete across Plans 15-01 through 15-06.
- De-duplicated project-local proof count moved from 889 (end of Plan 15-05, per this plan's own `<verification>` block) to **905** (16 new leaves: 15 in `fjs/media/dialects/module.f.js` — 1 count guard, 13 per-dialect detections, 1 unregistered-dialect fall-through — plus 1 new leaf in `fjs/server/module.f.js`), confirmed via `node --test 2>&1 | grep '^✔ import("./fjs/' | sed 's/ ([0-9.]*ms)$//' | sort -u | wc -l`.
- `npm test` (the full `tsc && node --test` gate, including both real-process integration tests): **6292/6292 passing, 0 failures, 0 cancelled**, `tsc` clean.

---
*Phase: 15-realism-polish-and-upstream*
*Completed: 2026-08-11*
