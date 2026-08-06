---
phase: 09-traceable-report-lines-and-the-anti-hardcoding-gate
plan: 06
subsystem: api
tags: [functionalscript, refactor, anti-hardcoding, mutation-testing, user-directed]

# Dependency graph
requires:
  - phase: 09-traceable-report-lines-and-the-anti-hardcoding-gate
    provides: "classifyRunOutcome as the single shared zero-read classifier (Plan 09-05), the binding this refactor must not undo"
provides:
  - "fjs/report/guard/module.f.js — classifyRunOutcome and the RunOutcome type, in their own module with their own unit proofs"
  - "fjs/report/ now holds all three PROV-07 mechanisms together: line, audit, guard"
  - "Mutation evidence that the move preserved the binding between the proofs and the shipped code"
affects: [09-VERIFICATION.md, Phase 15's PROV-08 (a second, non-tax report over the same documents, which will reuse this guard)]

# Tech tracking
tech-stack:
  added: []
  patterns: ["a policy with a single, narrow type dependency gets its own module rather than living as a buried detail of the orchestration module that happens to call it"]

key-files:
  created:
    - fjs/report/guard/module.f.js
  modified:
    - fjs/server/fjs_run/module.f.js
    - fjs/report/audit/module.f.js

key-decisions:
  - "Split the move (Task 1) and the new unit proofs (Task 2) into two separate commits, even though both were drafted together, so Task 1's own acceptance criterion (npm test stays at exactly 258 pass) could be verified in isolation before the proof-adding commit could raise it — verifying the two claims (pure move; new coverage) independently rather than conflating them"
  - "The four new guard unit leaves are named distinctly from fjs_run's existing zeroReadGate/antiHardcodingGate proof leaves (emptyReadsProducesAnErrorOutcome, not zeroReadOutcomeBecomesAnErrorResult) so the two kinds of coverage — unit proof of the rule itself vs. integration proof of the rule as reached through a real run — stay visually distinct in test output"
  - "The module header's full PROV-07 narrative moved verbatim into fjs/report/guard/module.f.js, with 'the failure this file already had' subsection reworded from fjs_run's own first-person account into a factual history naming fjs/server/fjs_run/module.f.js as where the duplicate defect lived — the history is still true and worth keeping as a warning even though the code that once carried it has moved"

patterns-established:
  - "A policy function whose only type dependency is unrelated to its host module's actual concern (CAS, MCP, orchestration) is a signal the function does not belong there, independent of line count"

requirements-completed: [PROV-07]

# Metrics
duration: ~25min
completed: 2026-08-05
---

# Phase 9 Plan 06: The Anti-Hardcoding Guard as Its Own Module Summary

**Moved `classifyRunOutcome` and `RunOutcome` out of the 1400+-line `fjs/server/fjs_run/module.f.js` into a new `fjs/report/guard/module.f.js`, gave the rule four direct unit proofs it never had while buried mid-file, and re-proved by mutation from the new home that the binding Plan 09-05 established between the proofs and the shipped code survived the move.**

## Performance

- **Duration:** ~25 min
- **Tasks:** 3 completed
- **Files modified:** 3 (`fjs/report/guard/module.f.js` created, `fjs/server/fjs_run/module.f.js`, `fjs/report/audit/module.f.js`)

## Accomplishments

- `fjs/report/` now holds all three PROV-07 mechanisms together: `line` (the traceability type), `audit` (the literal count), and `guard` (the kill condition) — no longer scattered between `fjs/report/` and a server orchestration module.
- The rule moved with zero behavior change: same message text (byte-identical, grepped), same `RunOutcome` shape, both existing call sites (`executeRun`, `runExecuteRunViaFixture`) untouched apart from the import. `npm test` stayed at exactly 258 pass immediately after the move, before any new proof was added.
- The guard got four unit proofs of its own — impossible to write while it was a private mid-file helper — each an independently falsifiable leaf: empty reads produces `'error'`, non-empty reads produces `'ok'` carrying value/reads/literalCount, the refusal message names the exact literalCount it was built with, and the `'ok'` arm's literalCount passes through unchanged.
- Re-ran the exact mutation from Plan 09-05 (`reads.length === 0` -> `reads.length === -1`) from the rule's NEW home and confirmed it still turns the two `fjs_run` gate proofs, the real-process integration test, AND two of the new guard unit leaves red — five failures total, proving the move did not quietly break the binding the previous plan established at some cost.

## Task Commits

1. **Task 09-06-01: Move the guard into its own module** - `b1037e2` (refactor) — pure move, 258 pass/0 fail immediately after
2. **Task 09-06-02: Add unit proofs** - `111a9a4` (test) — 262 pass/0 fail (258 + 4 new leaves)
3. **Task 09-06-03: Re-prove the binding by mutation** - no commit (mutate -> test -> revert; `git diff HEAD` empty afterward, as Plan 09-05's own Task 2 established this pattern)

## Files Created/Modified

- `fjs/report/guard/module.f.js` (created) - `RunOutcome` typedef and `export const classifyRunOutcome`, moved unchanged from `fjs/server/fjs_run/module.f.js`, plus the full "PROV-07's anti-hardcoding design, in plain words" narrative (moved from `fjs_run`'s header, since this is now the module that actually refuses a program) and four new `proof` leaves.
- `fjs/server/fjs_run/module.f.js` - Deleted the local `RunOutcome` typedef and `classifyRunOutcome` definition; imports both from `../../report/guard/module.f.js` instead. Its own module header now carries a short pointer to the new module rather than the full narrative. Two inline comments near the two call sites (`executeRun`, `runExecuteRunViaFixture`) were reworded from "shares executeRun's OWN classifyRunOutcome" to name the import explicitly, since the function is no longer this file's own.
- `fjs/report/audit/module.f.js` - Its existing pointer ("the plain-language account... lives in `fjs/server/fjs_run/module.f.js`'s module header") updated to name `fjs/report/guard/module.f.js` instead.

## Decisions Made

- Committing the move and the new proofs as two separate atomic commits (rather than one combined commit) was necessary to honestly verify Task 1's own acceptance criterion in isolation: "npm test exits 0 with 258 pass, 0 fail — a pure move must not change the count." Drafting both together and then splitting for verification, rather than writing them already split, was faster and produced the identical end state.
- The four new guard proof leaf names were chosen to read as unit-level claims about `classifyRunOutcome` in isolation (`emptyReadsProducesAnErrorOutcome`, etc.) rather than reusing `fjs_run`'s own gate names (`zeroReadOutcomeBecomesAnErrorResult`), so the mutation's failing output cleanly shows two independent kinds of coverage going red for the same reason, rather than reading as one test renamed.

## Deviations from Plan

None — plan executed exactly as written. The only refinement beyond the plan's literal text was splitting the drafted Task 1 + Task 2 content into two verified, separately-committed states (see Decisions Made above); this is a verification-ordering detail, not a scope change — both tasks' own acceptance criteria are met by the respective commit.

## Issues Encountered

None. The mutation behaved exactly as Plan 09-05's own precedent predicted: the identical `reads.length === 0` -> `reads.length === -1` mutation, now applied at the guard's new home, turns the same tests red it turned red immediately after Plan 09-05 fixed the duplication, plus the two new guard unit leaves that directly exercise the mutated line.

## Verification Evidence

### 1-4. Grep counts and import wiring (Task 1 acceptance criteria)

```
$ grep -c "reads.length === 0" fjs/report/guard/module.f.js
1
$ grep -c "reads.length === 0" fjs/server/fjs_run/module.f.js
0
$ grep -c "report produced zero observed reads" fjs/server/fjs_run/module.f.js
0
$ grep -c "report produced zero observed reads" fjs/report/guard/module.f.js
1
$ grep -n "report/guard/module.f.js" fjs/server/fjs_run/module.f.js
131:import { classifyRunOutcome } from '../../report/guard/module.f.js'
152:/** @import { RunOutcome } from '../../report/guard/module.f.js' */
(plus header-comment mentions of the same path)
```

### Task 1: pure move, 258 pass immediately after

```
$ npx tsc
(exit 0, no output)
$ npm test (tail)
ℹ tests 258
ℹ pass 258
ℹ fail 0
```

### Task 2: unit proofs added, 262 pass (258 + 4)

```
$ npx tsc
(exit 0, no output)
$ npm test (tail)
ℹ tests 262
ℹ pass 262
ℹ fail 0
$ npm run test:integration (tail)
✔ TEST-01/TEST-02: fjs_run end to end through a real separate node index.js process and a real filesystem, with full tool coverage
ℹ tests 1
ℹ pass 1
ℹ fail 0
$ node --test 2>&1 | grep -c '^✔ import("./fjs/'
260
```

260 = 256 (pre-existing honest metric, unchanged by the pure move) + 4 (the new guard unit leaves) — exactly the required rise.

### Task 3: mutation from the guard's NEW home — ACTUAL failing output

Mutated `fjs/report/guard/module.f.js`:
```
export const classifyRunOutcome = literalCount => (value, reads) => reads.length === 0
```
to:
```
export const classifyRunOutcome = literalCount => (value, reads) => reads.length === -1
```

`npx tsc` exit 0 (mutation still typechecks — a genuine behavioral mutation, not a compile error).

`npm test` output (tail + failing tests):

```
ℹ tests 262
ℹ suites 0
ℹ pass 257
ℹ fail 5
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 2084.878084

✖ failing tests:

test at ../../../node_modules/functionalscript/fjs/effects/node/module.js:269:31
✖ import("./fjs/report/guard/module.f.js").proof.emptyReadsProducesAnErrorOutcome() ... (0.183625ms)
  [ 'ok', 'error' ]

test at ../../../node_modules/functionalscript/fjs/effects/node/module.js:269:31
✖ import("./fjs/report/guard/module.f.js").proof.refusalMessageNamesTheLiteralCountItWasConstructedWith() ... (0.068333ms)
  [ 'ok', 'error' ]

test at ../../../node_modules/functionalscript/fjs/effects/node/module.js:269:31
✖ import("./fjs/server/fjs_run/module.f.js").proof.zeroReadGate.zeroReadOutcomeBecomesAnErrorResult() ... (1.211167ms)
  [ 'ok', 'error' ]

test at ../../../node_modules/functionalscript/fjs/effects/node/module.js:269:31
✖ import("./fjs/server/fjs_run/module.f.js").proof.antiHardcodingGate.hardcodedAdversaryFailsAndIsInvariantToInputChange() ... (4.024458ms)
  [ 'expected the verbatim adversary to be refused', { kind: 'ok', value: { line16: 9137 }, reads: [], literalCount: 1 } ]

test at fjs-run-integration.test.js:121:1
✖ TEST-01/TEST-02: fjs_run end to end through a real separate node index.js process and a real filesystem, with full tool coverage (737.824166ms)
  AssertionError [ERR_ASSERTION]: expected the zero-read adversary to be refused: {"id":16,"jsonrpc":"2.0","result":{"content":[{"text":"{\"resultHash\":\"pa699cgsbj7d4pfgpgatnvhz76rb54ga8mvp254sz824jnmhf8gr\",\"runHash\":\"5m5aw4gb0t1h93nz5qcd5bk03nvwqn1gc76we98x3h7hp0jpxqb8\",\"preview\":\"[object Object]\",\"truncated\":false,\"readCount\":0,\"literalCount\":1}","type":"text"}]}}
  + actual - expected

  + undefined
  - true

      at TestContext.<anonymous> (file:///Volumes/ProjectsSSD/Projects/jobs4alex/sergey-shandar/finance/.claude/worktrees/finance-phase7/fjs-run-integration.test.js:353:20)
```

All five failures are exactly the ones the plan required: both `fjs_run` gate leaves (`zeroReadGate.zeroReadOutcomeBecomesAnErrorResult`, `antiHardcodingGate.hardcodedAdversaryFailsAndIsInvariantToInputChange`), the real-process integration test (`TEST-01/TEST-02`), and two of the four new guard unit leaves (the two whose fixture supplies an empty `reads` array, which is exactly what the mutation changes the trigger condition for). The other two guard leaves (`nonEmptyReadsProducesAnOkOutcomeCarryingValueReadsAndLiteralCount`, `okArmCarriesLiteralCountThroughUnchanged`) correctly stayed green, since they exercise a non-empty `reads` array — a case the mutated condition (`reads.length === -1`) still evaluates to `false` for, same as the unmutated one.

Reverted via `git checkout -- fjs/report/guard/module.f.js`. Post-revert:

```
$ git diff HEAD
(empty)
$ npx tsc
(exit 0, no output)
$ npm test (tail)
ℹ tests 262
ℹ pass 262
ℹ fail 0
```

### Final full verification pass (post-revert)

```
$ git status --porcelain
(empty)
$ npm run test:integration (tail)
✔ TEST-01/TEST-02: fjs_run end to end through a real separate node index.js process and a real filesystem, with full tool coverage
ℹ tests 1
ℹ pass 1
ℹ fail 0
$ node --test 2>&1 | grep -c '^✔ import("./fjs/'
260
$ git log --oneline -2
111a9a4 test(09-06): add unit proofs for classifyRunOutcome in its own module
b1037e2 refactor(09-06): move the anti-hardcoding guard into its own module
```

## Known Stubs

None.

## Threat Flags

None. This plan moves existing code and adds unit test coverage; it introduces no new endpoint, auth path, effect, or schema. `fjs/report/guard/module.f.js`'s only import beyond `assert`/`assertEq` is the `Read` type from `fjs/exec` — no CAS, no MCP, no effects, matching the plan's own pre-verified claim.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Phase 15's PROV-08 ("a second, non-tax report over the same documents") will need this same zero-read guard. It is now a standalone module with its own unit proofs and no dependency on `fjs_run`'s own MCP/CAS concerns, so a future report path can import `classifyRunOutcome` directly from `fjs/report/guard/module.f.js` without importing anything about run orchestration or the `fjs_run` tool.

## Self-Check: PASSED

- FOUND: fjs/report/guard/module.f.js
- FOUND: fjs/server/fjs_run/module.f.js
- FOUND: fjs/report/audit/module.f.js
- FOUND: .planning/phases/09-traceable-report-lines-and-the-anti-hardcoding-gate/09-06-SUMMARY.md
- FOUND: commit b1037e2
- FOUND: commit 111a9a4

---
*Phase: 09-traceable-report-lines-and-the-anti-hardcoding-gate*
*Completed: 2026-08-05*
