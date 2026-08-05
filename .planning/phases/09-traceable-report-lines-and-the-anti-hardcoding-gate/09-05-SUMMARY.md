---
phase: 09-traceable-report-lines-and-the-anti-hardcoding-gate
plan: 05
subsystem: api
tags: [functionalscript, mcp, anti-hardcoding, mutation-testing, integration-test]

# Dependency graph
requires:
  - phase: 09-traceable-report-lines-and-the-anti-hardcoding-gate
    provides: "PROV-07's zero-read gate (09-02/03/04) — the mechanism this plan binds to the shipped code path"
provides:
  - "classifyRunOutcome — the single, exported zero-read classifier called by both executeRun (production) and runExecuteRunViaFixture (test helper)"
  - "Mutation evidence that the antiHardcodingGate and zeroReadGate proofs are bound to classifyRunOutcome, not to a parallel copy"
  - "A real-process integration assertion refusing the verbatim () => pure({ line16: 9137 }) adversary through an actual node index.js session, with EXEC-12 session-survival proven for the refused call"
affects: [09-VERIFICATION.md, future fjs_run/executeRun refactors]

# Tech tracking
tech-stack:
  added: []
  patterns: ["single shared classifier function instead of duplicated inline gates across a production path and its test-only decomposition helper"]

key-files:
  created: []
  modified:
    - fjs/server/fjs_run/module.f.js
    - fjs-run-integration.test.js

key-decisions:
  - "classifyRunOutcome takes (literalCount) curried, then (value, reads) — matching the shape both call sites already had in hand at the call point, no restructuring of executeRun's or runExecuteRunViaFixture's own control flow"
  - "Mutation task (09-05-02) produces no committed code change — the mutate/test/revert cycle is the deliverable, verified by a clean `git diff HEAD` after revert, not by a commit"
  - "Task 3's survival call uses cas_list rather than re-using evo_list (already exercised later in the file) to keep the two assertions visually distinct in the test output"

patterns-established:
  - "A rule duplicated across a production path and a documented test-only workaround is a coverage gap, not just a DRY violation — extraction must be followed by an actual mutation-and-revert proof, not just a grep count"

requirements-completed: [PROV-07]

# Metrics
duration: ~35min
completed: 2026-08-05
---

# Phase 9 Plan 05: Closing the Zero-Read Gate's Duplicate-Implementation Gap Summary

**Extracted the zero-read kill condition into one exported `classifyRunOutcome`, proved by actual mutation that the `antiHardcodingGate`/`zeroReadGate` proofs are now bound to it, and added a real-process integration assertion refusing the verbatim `() => pure({ line16: 9137 })` adversary through a genuinely separate `node index.js` session.**

## Performance

- **Duration:** ~35 min
- **Tasks:** 3 completed
- **Files modified:** 2 (`fjs/server/fjs_run/module.f.js`, `fjs-run-integration.test.js`)

## Accomplishments

- The zero-read rule — `reads.length === 0` and the message it builds — now exists in exactly ONE place in `fjs/server/fjs_run/module.f.js`: the exported `classifyRunOutcome`. Both `executeRun` (the production path `fjsRunTool` actually calls) and `runExecuteRunViaFixture` (the test-only decomposition helper) call it directly.
- Proved by mutation, not by inspection: changing `classifyRunOutcome`'s `reads.length === 0` to `reads.length === -1` (still typechecks) turned `proof.zeroReadGate.zeroReadOutcomeBecomesAnErrorResult` and `proof.antiHardcodingGate.hardcodedAdversaryFailsAndIsInvariantToInputChange` RED (`pass 256, fail 2`) — the exact opposite of 09-VERIFICATION.md's finding, where the identical mutation against the (then-duplicated) production copy left the suite at 258/258 green.
- `fjs-run-integration.test.js` now stores and runs the verbatim adversary through a real, separately-spawned server process, asserts the call is refused naming "zero observed reads", and asserts the SAME live session still answers a following `cas_list` call — the assertion no virtual-harness proof can make.

## Task Commits

Each code-producing task was committed atomically. Task 2 (the mutation proof) produced no commit — the deliverable is the mutate/test/revert transcript below, and the working tree returned to byte-identical with task 1's commit.

1. **Task 09-05-01: Extract `classifyRunOutcome`** - `300ed75` (refactor)
2. **Task 09-05-02: Prove the extraction by mutation** - no commit (mutate → test → revert; `git diff HEAD` empty afterward)
3. **Task 09-05-03: Refuse the adversary through the real server** - `d409059` (test)

## Files Created/Modified

- `fjs/server/fjs_run/module.f.js` - Extracted `export const classifyRunOutcome = literalCount => (value, reads) => ...` (the zero-read rule and its message, built once); `executeRun` and `runExecuteRunViaFixture` now both call `classifyRunOutcome(literalCount)(value, reads)` in place of their former identical inline `if (reads.length === 0) {...}` blocks. Two unrelated comments that happened to contain the literal substring `reads.length === 0` were reworded so the grep-based acceptance check (`grep -c "reads.length === 0"` == 1) unambiguously identifies the one real check.
- `fjs-run-integration.test.js` - Added a block after the existing decisive `fjs_run` success call: stores `'export const report = ctx => () => ctx.pure({ line16: 9137 })'` via the SAME live session's `cas_add`, calls `fjs_run` on it, asserts `isError: true` with the response text naming `zero observed reads`, then calls `cas_list` and asserts it still succeeds (EXEC-12 session survival for the refused call specifically, not only for the earlier successful one).

## Decisions Made

- `classifyRunOutcome`'s curried shape (`literalCount => (value, reads) => RunOutcome<unknown>`) was chosen to match exactly what both call sites already had in hand at the point of the former inline check — no restructuring of either function's control flow, satisfying the "pure extraction" constraint (Task 1's acceptance criteria: same 258 tests, same message text, same `RunOutcome` shape).
- Task 2 intentionally produced no commit. The plan's own acceptance criteria for that task are a transcript (mutate, observe RED, revert, observe clean `git diff HEAD`) — not a code artifact. Committing an already-reverted no-op would misrepresent the task as a code change.
- The session-survival call in Task 3 uses `cas_list` rather than reusing `evo_list` (called later in the same test for TEST-02 tool coverage) purely so the two distinct claims — "the refused call didn't crash the process" vs. "every advertised tool was exercised" — read as separate assertions in the test body, though functionally either tool would have proven the same EXEC-12 property.

## Deviations from Plan

None - plan executed exactly as written. Two documentation-comment tweaks (rewording two unrelated mentions of the literal substring `reads.length === 0` elsewhere in the file, and updating the `RunOutcome` typedef's own doc comment to point at `{@link classifyRunOutcome}` instead of the two functions that used to carry the duplicate) were necessary for the plan's own acceptance criterion #1 (`grep -c "reads.length === 0"` == exactly 1) to hold, and are covered by Task 1's "pure extraction" scope — not scope creep, since they touch no behavior, only prose.

## Issues Encountered

None. The mutation in Task 2 behaved exactly as the plan predicted: the identical mutation that left the suite green in 09-VERIFICATION.md (against the then-duplicated production copy) now turns the two decisive proofs red, because there is only one copy left for it to hit.

## Verification Evidence

### 1/2. Grep counts (Task 1 acceptance criteria)

```
$ grep -c "reads.length === 0" fjs/server/fjs_run/module.f.js
1
$ grep -c "report produced zero observed reads" fjs/server/fjs_run/module.f.js
1
```

### 3. Mutation run — ACTUAL failing output (Task 2, the point of this plan)

Mutated `fjs/server/fjs_run/module.f.js` line 172, changing:
```
export const classifyRunOutcome = literalCount => (value, reads) => reads.length === 0
```
to:
```
export const classifyRunOutcome = literalCount => (value, reads) => reads.length === -1
```

`npx tsc` exit 0 (the mutation still typechecks, exactly as the plan predicted). `npm test` output (tail):

```
ℹ tests 258
ℹ suites 0
ℹ pass 256
ℹ fail 2
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 2424.176875

✖ failing tests:

test at ../../../node_modules/functionalscript/fjs/effects/node/module.js:269:31
✖ import("./fjs/server/fjs_run/module.f.js").proof.zeroReadGate.zeroReadOutcomeBecomesAnErrorResult() ... (2.670041ms)
  [ 'ok', 'error' ]

test at ../../../node_modules/functionalscript/fjs/effects/node/module.js:269:31
✖ import("./fjs/server/fjs_run/module.f.js").proof.antiHardcodingGate.hardcodedAdversaryFailsAndIsInvariantToInputChange() ... (7.301584ms)
  [ 'expected the verbatim adversary to be refused', { kind: 'ok', value: { line16: 9137 }, reads: [], literalCount: 1 } ]
```

Both named leaves failed exactly as predicted: `zeroReadOutcomeBecomesAnErrorResult` expected `'error'`, got `'ok'`; `hardcodedAdversaryFailsAndIsInvariantToInputChange` expected the verbatim adversary refused, got `{ kind: 'ok', value: { line16: 9137 }, reads: [], literalCount: 1 }` — the exact bypass the ROADMAP's anti-hardcoding criterion exists to catch, now demonstrably caught by mutating the ONE place the rule lives.

Reverted via `git checkout -- fjs/server/fjs_run/module.f.js`. Post-revert:

```
$ git diff HEAD
(empty)
$ npm test  (tail)
ℹ tests 258
ℹ pass 258
ℹ fail 0
```

### 4. `npm test` (final, post-Task-3)

```
ℹ tests 258
ℹ suites 0
ℹ pass 258
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
```

### 5. `npm run test:integration` (final)

```
✔ TEST-01/TEST-02: fjs_run end to end through a real separate node index.js process and a real filesystem, with full tool coverage (878.712208ms)
ℹ tests 1
ℹ pass 1
ℹ fail 0
```

### 6. Honest metric (unchanged, as required)

```
$ node --test 2>&1 | grep -c '^✔ import("./fjs/'
256
```

### 7. `git status --porcelain` (final)

```
(empty)
```

### 8. `git log --oneline -3`

```
d409059 test(09-05): refuse the verbatim zero-read adversary through the real server
300ed75 refactor(09-05): extract classifyRunOutcome, the shared zero-read gate
41b4e8b docs(09): verification found a real gap — plan 09-05 to close it
```

## Known Stubs

None.

## Threat Flags

None. Task 3 adds test-only surface (a new stored program hash and an additional `fjs_run`/`cas_list` call within the existing spawned-process integration test); it introduces no new endpoint, auth path, or schema.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Phase 9's fourth ROADMAP success criterion — "the verbatim adversary fails" — is now proven against the code that actually ships, closing 09-VERIFICATION.md's sole BLOCKER. All four success criteria are now fully verified; Phase 9 has no open gaps.

## Self-Check: PASSED

- FOUND: fjs/server/fjs_run/module.f.js
- FOUND: fjs-run-integration.test.js
- FOUND: .planning/phases/09-traceable-report-lines-and-the-anti-hardcoding-gate/09-05-SUMMARY.md
- FOUND: commit 300ed75
- FOUND: commit d409059

---
*Phase: 09-traceable-report-lines-and-the-anti-hardcoding-gate*
*Completed: 2026-08-05*
