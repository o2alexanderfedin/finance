---
phase: 19-reproducibility-and-report-provenance
plan: 02
subsystem: server/fjs_run, run-record dialect
tags: [functionalscript, provenance, taxYear, mcp-tool, mutation-gate]

requires:
  - phase: 19-01
    provides: "fjs/report/provenance/module.f.js: paramSetHash, reviewedEstimateFraming"
provides:
  - "runSchema/Run widened with REQUIRED taxYear/paramSetHash"
  - "fjsRunInputSchema widened with REQUIRED taxYear; toolEntry's own RTTI check refuses a missing/wrong-typed taxYear before the handler ever runs"
  - "fjs_run's response envelope and persisted vnd.fjs.run record both carry taxYear/paramSetHash/programHash/reviewedEstimateFraming"
  - "An unknown taxYear is refused by errorResult, naming the offending year and the known set, before executeRun ever runs"
  - "Mutation Gate M2 performed and confirmed against 19-VALIDATION.md's corrected red set"
affects: [19-03]

tech-stack:
  added: []
  patterns:
    - "taxParamsByYear[args.taxYear] lookup + errorResult refusal, copied verbatim in shape from fjs/server/finance_tax_params/module.f.js's own unknown-year precedent"
    - "handleRunOutcome's curried signature widened by inserting ONE new parameter (provenance) rather than adding two new curry levels"

key-files:
  created: []
  modified:
    - fjs/run/module.f.js
    - fjs/report/amend/module.f.js
    - fjs/report/provenance/module.f.js
    - fjs/media/dialects/module.f.js
    - fjs/server/fjs_run/module.f.js
    - fjs/server/module.f.js
    - fjs-run-integration.test.js
    - payer-report-integration.test.js

key-decisions:
  - "A FIFTH Run-literal-construction population was found and fixed in the same atomic commit: fjs/report/provenance/module.f.js's own unpinnedRun TEST-FIXTURE (shipped by Wave 1/19-01), typed @type {Run} directly (visible to tsc, unlike population 4's Record<string, unknown>-typed fixture). Neither the plan's checklist nor the prior plan-check pass's four-file enumeration accounted for it, because 19-01 shipped after both were written. Found by re-deriving the population via the exact grep the execution context specified, rather than trusting either enumeration."
  - "responseShape's sixKeysExactlyAndResultAlwaysResolvable and sizeGuard's newFieldsStayWellClearOfTheGuard both hand-count fjs_run's envelope keys; both were rewritten for the new ten-key shape (renamed to tenKeysExactlyAndResultAlwaysResolvable) in this same commit rather than left silently under-covering the widened envelope."
  - "Mutation Gate M2 required no code change to survive it — it is an observation, not a fix. Recorded here rather than folded into Task 1's commit."

patterns-established:
  - "Widening a curried handler's signature by inserting one new parameter at a specific position (never appending two new curry levels) keeps every unaffected call site's arity change to exactly one insertion."

requirements-completed: [PROV-04]

duration: ~70min
completed: 2026-08-12
---

# Phase 19 Plan 02: Wire taxYear/paramSetHash Through fjs_run Summary

**`runSchema`/`fjsRunInputSchema` widened with required `taxYear`/`paramSetHash`; `fjs_run`'s response envelope and persisted `vnd.fjs.run` record now carry `taxYear`/`paramSetHash`/`programHash`/`reviewedEstimateFraming` alongside the existing keys; an unknown `taxYear` is refused by name before `executeRun` ever runs; four planned populations plus one unplanned fifth population of Run-literal construction sites all updated in one atomic commit; Mutation Gate M2 performed and confirmed against the corrected red set.**

## Performance

- **Duration:** ~70 min
- **Completed:** 2026-08-12
- **Tasks:** 2 (Task 1: one atomic commit across 8 files; Task 2: mutation gate, observation only, no commit)
- **Files modified:** 8

## Accomplishments

- `runSchema` (`fjs/run/module.f.js`) gained `taxYear: number` and `paramSetHash: string`, both REQUIRED, positioned after `args`/before `pinned`. Module docstring updated to describe the new fields alongside the existing ones.
- `fjsRunInputSchema` (`fjs/server/fjs_run/module.f.js`) gained a REQUIRED `taxYear: number`. `toolEntry`'s own RTTI check now refuses a call missing it, or supplying a non-number, before the handler ever runs — proven by the new `missingTaxYearRejectedByToolEntry` leaf.
- `fjsRunTool`'s handler looks up `taxParamsByYear[args.taxYear]` and refuses an unknown year via `errorResult` (naming the offending year and the known set), before `executeRun` is ever called — proven by the new `unknownTaxYearRefused` leaf, mirroring `finance_tax_params`'s own precedent.
- `handleRunOutcome`'s curried signature widened by inserting one new `provenance` parameter (`{ taxYear, paramSetHash }`) between the existing `pinFields` and `outcome` parameters. Both the ok-arm and error-arm `Run` record literals, and the ok-arm response envelope, now carry `taxYear`/`paramSetHash`; the envelope additionally carries `programHash` (already in scope as the function's own parameter) and `reviewedEstimateFraming` (imported from Plan 19-01's module).
- All four planned Run-literal-construction/call-site populations updated in the same commit:
  1. **9 runtime `fjs_run` call sites** — `fjs/server/fjs_run/module.f.js`'s own 4 `fjsRunTool(...).handle(...)` proof calls, `fjs/server/module.f.js`'s `weekOneConvergence` call, 3 calls in `fjs-run-integration.test.js`, 1 call in `payer-report-integration.test.js` — all gained `taxYear: 2025`.
  2. **`Run`-literal type-level construction** — `fjs/run/module.f.js`'s `minimalOk`/`minimalError` fixtures, `fjs/report/amend/module.f.js`'s `okRun`/`errorRun` fixtures — both gained `taxYear: 2025, paramSetHash: 'sha256-paramset1'`.
  3. **15 `handleRunOutcome(...)` call sites** (1 production + 14 proof-section) — all gained the new `({ taxYear: 2025, paramSetHash: 'sha256-paramset1' })` curried argument (the production call site at `fjsRunTool` uses the real `args.taxYear`/`resolvedParamSetHash` instead of the constant).
  4. **`fjs/media/dialects/module.f.js`'s runtime-validated `[runDialect]` fixture** — invisible to `tsc` (typed `Record<string, unknown>`), checked only by the `detectFinance['vnd.fjs.run']` leaf's `mime_type` assertion, which stays green.
- **A fifth, unplanned population found and fixed in the same commit**: `fjs/report/provenance/module.f.js`'s own `unpinnedRun` TEST-FIXTURE (shipped by Wave 1/19-01), typed `@type {Run}` directly — visible to `tsc`, unlike population 4's `Record<string, unknown>`-typed fixture. `pinnedRun` spreads `unpinnedRun`, so it needed no separate edit.
- Two new proof leaves under a new `taxYearHandling` group: `missingTaxYearRejectedByToolEntry`, `unknownTaxYearRefused`.
- `responseShape.sixKeysExactlyAndResultAlwaysResolvable` renamed to `tenKeysExactlyAndResultAlwaysResolvable` and its hand-counted key list updated; `sizeGuard.newFieldsStayWellClearOfTheGuard`'s synthetic envelope widened to include the four new fields.
- `fjs-run-integration.test.js`'s decisive-call block extended with `taxYear`/`paramSetHash`/`programHash` assertions against the real, parsed `fjs_run` response.

## Task Commits

1. **Task 1: wire taxYear/paramSetHash through every schema, record, response and Run-literal construction site (8 files, 1 atomic commit)** — `7a58c76` (feat)
2. **Task 2: Mutation Gate M2** — observation only; no code survives the mutation (restored byte-identical), so nothing to commit. Recorded below.

## Files Created/Modified

- `fjs/run/module.f.js` — `runSchema` widened, docstring updated, `minimalOk`/`minimalError` fixtures updated.
- `fjs/report/amend/module.f.js` — `okRun`/`errorRun` fixtures updated.
- `fjs/report/provenance/module.f.js` — `unpinnedRun` fixture updated (the unplanned fifth population).
- `fjs/media/dialects/module.f.js` — `[runDialect]` fixture updated.
- `fjs/server/fjs_run/module.f.js` — `fjsRunInputSchema`, `handleRunOutcome`, `fjsRunTool`'s handler, response envelope, docstrings, 4+14 proof-section call sites, 2 new proof leaves, `responseShape`/`sizeGuard` proofs updated.
- `fjs/server/module.f.js` — `weekOneConvergence`'s `fjs_run` call updated.
- `fjs-run-integration.test.js` — 3 `fjs_run` calls updated; decisive-call block extended with new assertions.
- `payer-report-integration.test.js` — 1 `fjs_run` call updated.

## Decisions Made

- **The fifth population (`fjs/report/provenance/module.f.js`) is a genuine gap in the plan, not a misreading of it.** The plan's own population-2 grep (`grep -rln "@import.*\bRun\b" fjs *.js`) was run and documented as returning "exactly these three files" — `fjs/run`, `fjs/report/amend`, `fjs/server/fjs_run` — during planning, *before* Wave 1 (19-01) existed. Re-running that same grep now returns a fourth file, `fjs/report/provenance/module.f.js`, because Wave 1 shipped after the plan's checklist was frozen. Fixed as a Rule 3 (auto-fix blocking issue) deviation: `pinnedRun` spreads `unpinnedRun`, so only `unpinnedRun` needed the two new fields.
- **Kept the response envelope's field order as `taxYear, paramSetHash, programHash, reviewedEstimateFraming`, appended after the existing six keys** rather than interleaved, so every existing consumer's positional expectations (none read by position — all by key — but for readability) stay stable.
- **`responseShape`/`sizeGuard` proof updates were treated as in-scope, not deferred**, because both hand-count the envelope's keys and would otherwise silently under-cover the four new fields — exactly the kind of "proof whose expected side was not independent of the code under test" AGENTS.md's own history warns against, here inverted: a stale hand-count that no longer matches the shipped shape.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — blocking issue] Fifth Run-literal-construction population found: `fjs/report/provenance/module.f.js`'s `unpinnedRun` fixture**
- **Found during:** Task 1, re-deriving the population per the execution context's explicit instruction to re-run the `pinned:` grep before declaring the task done.
- **Issue:** `fjs/report/provenance/module.f.js` (created by Wave 1/19-01, after this plan's checklist was frozen) declares a TEST-FIXTURE `unpinnedRun` typed `@type {Run}` directly. Once `runSchema` requires `taxYear`/`paramSetHash`, this literal fails `tsc` (missing required properties) — a genuine compile blocker the plan's checklist did not name.
- **Fix:** Added `taxYear: 2025, paramSetHash: 'sha256-paramset1'` to `unpinnedRun`. `pinnedRun` spreads `unpinnedRun` and needed no separate edit.
- **Files modified:** `fjs/report/provenance/module.f.js`.
- **Verification:** `npx tsc --noEmit` clean; `npm test` 6314/6314.
- **Committed in:** `7a58c76` (same atomic commit as every other population).

**2. [Rule 1 — stale proof] `responseShape`/`sizeGuard` proofs hand-count the envelope's keys and would silently under-cover the widened envelope**
- **Found during:** Task 1, after widening the response envelope from six to ten keys.
- **Issue:** `sixKeysExactlyAndResultAlwaysResolvable` asserted the parsed response's key set equals exactly six named keys — this assertion would fail (correctly) the moment the envelope widened, but leaving the leaf's OLD name/assertion in place after fixing it to pass would have meant either a silently-wrong name or (if left broken) a red suite. `newFieldsStayWellClearOfTheGuard`'s synthetic envelope also no longer represented the real shape.
- **Fix:** Renamed the leaf to `tenKeysExactlyAndResultAlwaysResolvable`, updated its hand-counted key list to the ten real keys, and added assertions for the four new fields' actual values. Widened the size-guard proof's synthetic envelope to include maximal-length placeholders for the four new fields.
- **Files modified:** `fjs/server/fjs_run/module.f.js`.
- **Verification:** `npm test` 6314/6314.
- **Committed in:** `7a58c76`.

---

**Total deviations:** 2 (one genuine planning gap fixed as a blocking issue, one stale-proof correction)
**Impact on plan:** None negative. Both are corrections that keep the suite's coverage honest about the shipped shape; neither changes the plan's intended behavior.

## Issues Encountered

None blocking. The plan's acceptance criterion `grep -c "taxYear: 2025" fjs/media/dialects/module.f.js` reports 1 was based on an assumption of isolation; the real count is 9 because eight OTHER dialect fixtures in that same file already contain the literal `taxYear: 2025` for unrelated reasons (1099b, 1099div, 1099r, itemizedDeductions, medicalExpenses, ssa1099, w2, returnProfileDialect). Confirmed the `[runDialect]` entry itself is correct by direct inspection and by the `detectFinance['vnd.fjs.run']` leaf passing.

## Mutation Gate M2 (AGENTS.md: "a proof is not known to work until you have watched it fail")

**Mutated:** `fjs/server/fjs_run/module.f.js`'s `const pinned = args.subject !== undefined && args.parents !== undefined` → `||`.

**What actually reddened:** `fjsRunTool.pinIntegrity.subjectOnlyWithoutParentsPersistsPinnedFalse` — but not via an `isError`/assertion mismatch. It reddened via an **uncaught thrown assertion**: `handleRunOutcome`'s own record-assembly `assert(vt === 'ok', ['fjs_run assembled an invalid error run record - executor bug', vv])` fired with `'a pinned run record must have both subject and parents'`, because the mixed-pin case (`subject` supplied, `parents` not) now computes `pinned: true` while `pinFields` still carries only `{ subject }` — a shape `fjs/run/module.f.js`'s `checkReferences` (lines 160-163) rejects outright. This is exactly the "structurally unreachable at the acceptance predicate's input" mechanism 19-VALIDATION.md's correction note describes: the assert fires before any `Run` value is ever built.

**Confirmed to stay green under the identical mutation:** `fjs/report/provenance/module.f.js`'s `countsTowardReproducibilityAcceptance.rejectsAnUnpinnedRun` and `.acceptsAPinnedRun` — both observed passing (via a direct `node --test` run against the mutated tree, filtered for those two leaf names), a positive confirmation that the predicate's input space genuinely cannot express the mixed-pin case, not merely an absence of observed failure.

**Restored:** `||` reverted to `&&`, byte-identical. `git status --porcelain -- fjs/server/fjs_run/module.f.js` confirmed empty. `npm test` re-run: 6314/6314, exit 0.

This required no code change and produced no commit — Task 2 is an observation, recorded here per the plan's own instruction that the gate may be "recorded in the SUMMARY if it only observes."

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- `fjs_run`'s response and persisted record now carry the full PROV-04 provenance header (`taxYear`, `paramSetHash`, `programHash`, `reviewedEstimateFraming`) — Plan 19-03 can build PROV-05's real-process reproducibility proof against this shape with no further wiring.
- `countsTowardReproducibilityAcceptance` (Plan 19-01) is still unconsumed by any production code path — Plan 19-03's job, per this phase's own plan decomposition. EXEC-13's second sentence stays Pending until then.
- No fifth-population sweep beyond `fjs/report/provenance/module.f.js` was needed: the re-derivation grep (`grep -rn "pinned:" fjs *.js | grep -v '^\s*\*'`, cross-checked against a `pinned,$` shorthand grep for `fjs/server/fjs_run/module.f.js`'s own two record-assembly sites) confirms exactly five real construction sites now exist, all updated.

## Self-Check: PASSED

- `fjs/run/module.f.js` — FOUND, contains `taxYear: number`
- `fjs/server/fjs_run/module.f.js` — FOUND, contains `paramSetHash(taxParamSet)`
- `.planning/phases/19-reproducibility-and-report-provenance/19-02-SUMMARY.md` — FOUND
- Commit `7a58c76` — FOUND in `git log --oneline --all`

## Final Verification

- `npm test`: **6314 tests, 6314 pass, 0 fail, exit 0** (measured after Task 1's commit and again after Task 2's restore).
- De-duplicated project-local proofs (`node --test 2>&1 | grep '^✔ import("./fjs/' | sed 's/ ([0-9.]*ms)$//' | sort -u | wc -l`): **916** (baseline entering this wave: 914; +2 for `taxYearHandling`'s two new leaves).
- Population re-derivation (`grep -rn "pinned:" fjs *.js | grep -v '^\s*\*'`, filtered for actual object-literal lines rather than JSDoc/comment mentions of the same substring): exactly **four** files with real `pinned:`-colon `Run`-literal construction — `fjs/run/module.f.js`, `fjs/report/amend/module.f.js`, `fjs/report/provenance/module.f.js`, `fjs/media/dialects/module.f.js` — plus `fjs/server/fjs_run/module.f.js` confirmed via a `pinned,$` shorthand grep to hold exactly the two record-assembly sites the execution context's own note anticipated. Five real construction sites total, all updated.
- Mutation Gate M2: mutated `&&` → `||`; required leaf `subjectOnlyWithoutParentsPersistsPinnedFalse` reddened (via an uncaught record-assembly assert, not an `isError` mismatch); `countsTowardReproducibilityAcceptance`'s both leaves confirmed green under the same mutation; restored byte-identical, `git status --porcelain` empty, suite green.

---
*Phase: 19-reproducibility-and-report-provenance*
*Completed: 2026-08-12*
