---
phase: 19-reproducibility-and-report-provenance
plan: 03
subsystem: testing
tags: [fjs, mcp, real-process, reproducibility, mutation-testing, provenance]

# Dependency graph
requires:
  - phase: 19-01
    provides: "fjs/report/provenance/module.f.js — paramSetHash, reviewedEstimateFraming, countsTowardReproducibilityAcceptance"
  - phase: 19-02
    provides: "taxYear/paramSetHash/programHash wired through fjs_run's schema, record, and response envelope"
provides:
  - "PROV-04's header assertions proven against a real fjs_run response over a live MCP session (already landed in 19-02's own commit; re-confirmed here)"
  - "PROV-05's adversarial, control-first, byte-identical reproduction proof in fjs-run-integration.test.js"
  - "EXEC-13's acceptance predicate consumed against two REAL, CAS-fetched persisted run records"
  - "Mutation Gate M1 performed, its true red set recorded, code restored byte-identical"
affects: [phase-18-dependency-and-duplication-debt, phase-17-documentation-truth-pass]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Control-before-pinned ordering: build and OBSERVE the unpinned control leg move before writing or trusting the pinned leg's stability assertion (19-VALIDATION.md's 'control leaf is not optional')"
    - "Two-form reproduction check: resultHash STRING equality AND fetched-byte equality, never hash equality alone (close to a content-addressing tautology)"
    - "Isolating a mutation's true target inside a single node:test test() block: when an earlier assertion in the same async function also reddens under the mutation and aborts execution before the assertion under test runs, neutralize the earlier assertions in a throwaway diagnostic copy to observe the target assertion redden independently"

key-files:
  created: []
  modified:
    - fjs-run-integration.test.js
    - fjs/server/fjs_run/snapshot/module.f.js (mutated then restored byte-identical — no net diff)
    - .planning/REQUIREMENTS.md
    - .planning/ROADMAP.md
    - .planning/STATE.md

key-decisions:
  - "EXEC-13 marked complete: countsTowardReproducibilityAcceptance has no other consumption point to gate in this codebase (grepped for zero production call sites of .pinned beyond fjs_run's own record assembly and the predicate's own module); its docstring frames it as consumer-side by design, and this plan is the first caller to exercise it against real persisted data rather than hand-typed fixtures"
  - "Task 2 (Mutation Gate M1) produced zero net file diff — the mutation was applied, observed, then restored byte-identical, so there is nothing to commit for that task beyond the SUMMARY's own record of the observation. No git commit was made for Task 2 alone; its evidence lives here and in Task 1's commit body is not modified after the fact"
  - "STATE.md's total_plans/completed_plans frontmatter counters left frozen at 82/82, following 19-01/19-02's own established precedent (gsd-sdk's state.advance-plan verb corrupted this file in Wave 1 and was reverted). completed_phases was bumped 15->16 since Phase 19 genuinely completed and that counter carries no known corruption history"

requirements-completed: [PROV-05, PROV-04, EXEC-13]

# Metrics
duration: 70min
completed: 2026-08-12
---

# Phase 19 Plan 03: PROV-05 Adversarial Reproduction Proof and Mutation Gate M1 Summary

**Added the phase's central deliverable — a control-first, byte-identical pinned-reproduction proof over a real separate MCP process — and performed Mutation Gate M1, watching the proof it protects actually go red before restoring the code byte-identical. This closes Phase 19: EXEC-13, PROV-04, and PROV-05 are all complete.**

## Performance

- **Duration:** ~70 min
- **Tasks:** 2 completed
- **Files modified:** 1 net (fjs-run-integration.test.js); 1 mutated-then-restored with zero net diff (fjs/server/fjs_run/snapshot/module.f.js)

## Accomplishments

- PROV-05's adversarial reproduction proof: an unpinned control leg is built and its output is
  observed to MOVE after an amendment, ordered strictly before the pinned leg's code — matching
  19-VALIDATION.md's "the control leaf is not optional" requirement literally, not just in spirit.
- The pinned leg reproduces byte-identically across the identical amendment, checked BOTH by
  `resultHash` string equality and by the actual fetched CAS bytes.
- `countsTowardReproducibilityAcceptance` (EXEC-13's predicate, shipped in 19-01) is now called
  against two real, CAS-fetched `vnd.fjs.run` records from this same real process — `true` for
  the pinned run, `false` for the control — rather than only against 19-01's own hand-typed
  fixtures.
- Mutation Gate M1 performed: `buildRunSnapshot`'s pinned branch was changed to resolve the live
  head instead of `pin.parents`. The full suite went red (6309/6314). A diagnostic isolation run
  confirmed the NEW PROV-05 pinned-reproduction assertion reddens independently of the
  pre-existing pin proof that shares the same test() block. Restored byte-identical; `git status`
  clean; suite green again (6314/6314).

## Task Commits

1. **Task 1: PROV-04 header assertions and PROV-05's control-then-pinned reproducibility proof** —
   `0315577` (feat) — PROV-04's header assertions were already present from Plan 19-02's own
   commit (verified live against the file before adding anything), so this task's diff is
   entirely the new PROV-05 proof plus its EXEC-13 consumption.
2. **Task 2: Mutation Gate M1** — no commit. The mutation was applied, the full observed red set
   recorded (below), and the file restored to its exact prior content (`git diff` empty,
   `git status --porcelain` empty). There is nothing to stage for a task whose net effect on
   tracked files is zero; its evidence is recorded here and in STATE.md.

**Plan metadata:** recorded in this SUMMARY and the accompanying STATE.md/ROADMAP.md/
REQUIREMENTS.md commit.

## The Control-Leg Observation (required by the plan's `<output>` contract)

Both `controlBytes1` and `controlBytes2` are the JSON-stringified single-element array
`ctx.evoHead(args[0])` returns — i.e. the head revision hash of the control subject at the
moment each run executed.

- **Before the amendment** (`controlBytes1`):
  `["ww82kfbsgqhetqf8nwc43y024hpaf66m43yctrbn3nf0km856b4r"]`
- **After the amendment** (`controlBytes2`):
  `["n4dpdrp5heanysrze1g5dh6nb5rpvz29x9gwxvm13n0qyq9wrag8"]`

The two values are wholly different hashes — the unpinned run's output moved by the full amount
an `evo_add` amendment moves a subject's head: from the first revision to the second. This
confirms the amendment was genuinely visible to an unpinned run before the pinned leg's stability
claim is trusted. `assert.notEqual(controlBytes1, controlBytes2)` passed, and — per
19-VALIDATION.md's explicit instruction — the pinned leg was only written and trusted after this
observation held.

(These two values were captured via a temporary `console.error` instrumentation, run once, then
reverted — confirmed via `git diff` showing no residual change to the committed test file.)

## Mutation Gate M1 — Full Record

**Mutation applied** (`fjs/server/fjs_run/snapshot/module.f.js`, `buildRunSnapshot`'s final
`mapStep` return):

```diff
             return pin === undefined
                 ? publicState
-                : { ...publicState, heads: { ...publicState.heads, [pin.subject]: pin.parents } }
+                : { ...publicState, heads: { ...publicState.heads, [pin.subject]: publicState.heads[pin.subject] ?? [] } }
```

This drops the override's effect (the pinned subject now resolves to whatever the live store
already computed) while keeping `pin` referenced via `pin.subject`, so the mutation compiles
under `noUnusedParameters`/`noUnusedLocals`.

**Observed full red set** (`npm test` with the mutation applied): **6309 pass, 5 fail** (down
from 6314/6314):

1. `fjs/server/fjs_run/module.f.js` — `executeRun.pinOverridesTheLiveHeadThroughFullExecuteRun`
   (reddened, as 19-VALIDATION.md predicted)
2. `fjs/server/fjs_run/snapshot/module.f.js` —
   `buildRunSnapshotResolvesTheStore.pinOverridesTheResolvedHead` (reddened, as predicted)
3. `fjs-run-integration.test.js` — the WHOLE integration test (reddened, as expected), but the
   thrown assertion Node's test runner reported was the **pre-existing** real-process pin proof
   (`assert.equal(pinResultMeta.text, JSON.stringify(pinnedParents))`, line ~461) — NOT this
   plan's new PROV-05 assertion, because the entire test is one `test()` block executed as a
   single async function: the first thrown assertion aborts everything sequenced after it in
   source order, and the pre-existing pin block runs before the new PROV-05 block.
4-5. The same two proofs (2) and (list variant) reported twice under `functionalscript/fjs/effects/node/module.ts` vs `.js` compiled variants — same underlying leaves, not additional failures.

**Isolating whether the NEW PROV-05 assertion is independently load-bearing.** Because the
integration test's single `test()` block means an earlier failing assertion masks everything
after it, the naive full-suite run above does not, by itself, prove the new PROV-05 assertion
would fail on its own. A diagnostic copy of `fjs-run-integration.test.js` was made with ONLY the
pre-existing pin block's assertions commented out (its setup/network calls left intact, so
`pinRunRecord`/`pinResultMeta` still resolve, just unchecked), and run against the SAME mutated
`buildRunSnapshot`:

```
AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:
+ actual   '9byfxfr8snkab3vb57znhc1fgg9r7czvwcx2h7df2z92gfeq8xj8'
- expected '5m5hsmgffwp5rq4pwnrxpwvccvdj7w5e2dr6kz5e18nqa8yk7jw8'
    at fjs-run-integration.test.js:619 (the PROV-05 pinnedRun1.resultHash === pinnedRun2.resultHash assertion)
```

This confirms the new PROV-05 pinned-reproduction assertion is independently reddened by the
mutation, isolated from the pre-existing proof that happens to fail first in the un-isolated
run. The diagnostic copy was never committed; the real, tracked `fjs-run-integration.test.js`
was untouched throughout (confirmed via `git status --short` showing no changes to it during
this step).

**Restoration.** The mutation was reverted to the exact original line
(`{ ...publicState, heads: { ...publicState.heads, [pin.subject]: pin.parents } }`).
`git diff -- fjs/server/fjs_run/snapshot/module.f.js` is empty; `git status --porcelain --
fjs/server/fjs_run/snapshot/module.f.js` reports nothing. `npm test` afterward: **6314 pass, 0
fail, exit 0**.

## Files Created/Modified

- `fjs-run-integration.test.js` — added the `countsTowardReproducibilityAcceptance` import and
  the entire PROV-05 control-then-pinned proof section (control leg, pinned leg, EXEC-13
  consumption), inserted between the existing pin-setup block and the zero-read adversary block.
- `fjs/server/fjs_run/snapshot/module.f.js` — mutated for Mutation Gate M1, then restored
  byte-identical. Net diff: none.
- `.planning/REQUIREMENTS.md` — EXEC-13 and PROV-05 checkboxes flipped to `[x]`; both
  traceability-table rows flipped from `Pending` to `Complete`.
- `.planning/ROADMAP.md` — Phase 19's checkbox, its 19-03-PLAN.md checkbox, and its progress
  table row (`2/3 In Progress` → `3/3 Complete`, dated 2026-08-12).
- `.planning/STATE.md` — hand-edited, scoped to Phase 19: `completed_phases` 15→16, `percent`
  79→80 (following the established precedent of leaving `total_plans`/`completed_plans` frozen
  at 82/82 rather than risking the corrupting `state.advance-plan` verb); the Phase 19 narrative
  in "Next" extended to record Plan 19-03's completion and the phase's closure; three new
  Decisions entries; the "Resume file" line updated; a new de-duplicated-proof-count landmark row
  (916, end of Phase 19) added to the Test Metrics table.

## Decisions Made

- **EXEC-13 marked complete.** The task instructions required independently judging whether
  `countsTowardReproducibilityAcceptance` "actually gates something observable," not merely
  trusting the plan's own claim. A grep across `fjs/**/*.f.js` for `.pinned` usage found exactly
  three files: `fjs/run/module.f.js` (the type/validator), `fjs/server/fjs_run/module.f.js`
  (where the field is derived and persisted), and `fjs/report/provenance/module.f.js` (the
  predicate itself plus its own proof fixtures) — no fourth, production consumption point exists
  anywhere in this codebase for the predicate to branch behavior on. Its own docstring frames it
  as "the consumer-side acceptance predicate" — i.e., something EXTERNAL callers query, not
  something `fjs_run` itself must gate internally. This plan is the first such external caller,
  and it exercises the predicate against two REAL, CAS-fetched persisted run records (never
  hand-built fixtures), correctly discriminating pinned (`true`) from unpinned (`false`). Given
  there is no other "acceptance pipeline" in this codebase's architecture to hook into, this is
  judged the strongest form of "consumption" the requirement's text can be satisfied by here.
- **PROV-05 marked complete.** Its adversarial reproduction property (control moves, pinned run
  does not) is proven with both a hash-string check and a fetched-byte check, and Mutation Gate
  M1 confirms the pinned-reproduction assertion is genuinely load-bearing against the exact
  mechanism the requirement depends on.
- **No commit for Task 2 alone.** The mutation-and-restore cycle leaves zero net diff on tracked
  files, so there is nothing to stage. Its full record lives in this SUMMARY and in STATE.md's
  new Decision bullets, per the task's own acceptance criteria (record the red set, confirm
  byte-identical restore and clean `git status`) rather than in a git commit body.

## Deviations from Plan

### Auto-fixed / Investigated Issues

**1. [Rule 4-adjacent verification, not a deviation from written text] Isolating M1's true red
set required a diagnostic step the plan's action text did not spell out.**
- **Found during:** Task 2.
- **Issue:** The plan's acceptance criteria required "Task 1's PROV-05 pinned-reproduction
  assertion is among the failures" when the mutation is applied. Because
  `fjs-run-integration.test.js` is a single `test()` block, the naive `npm test` run under the
  mutation reported the WHOLE integration test as one failure, and the specific error message
  Node surfaced was the PRE-EXISTING pin proof (which runs earlier in source order and also
  reddens under the same mutation) — not literally the new PROV-05 line. Per AGENTS.md's "a
  mutation's predicted red set is itself a claim, and it is often wrong" and "the equivalent
  mutant" sections, this ambiguity was not accepted at face value.
- **Fix:** Made a throwaway diagnostic copy of the test file with only the pre-existing pin
  block's THREE assertions commented out (its setup calls untouched), ran it against the same
  mutated `buildRunSnapshot`, and confirmed the new PROV-05 assertion
  (`pinnedRun1.resultHash === pinnedRun2.resultHash`) reddens independently, with its own distinct
  actual/expected hash values. The diagnostic file was never committed and the real tracked file
  was never touched during this step (`git status --short` confirmed clean throughout).
- **Files modified:** None (diagnostic copy lived outside the tracked tree at all times).
- **Verification:** `git status --porcelain` before and after the diagnostic step, showing only
  the intentional `fjs/server/fjs_run/snapshot/module.f.js` mutation and no changes to
  `fjs-run-integration.test.js`.

No other deviations. PROV-04's header assertions, which this plan's own text described adding,
were found already present (landed in Plan 19-02's commit `7a58c76`) — verified live against the
file rather than trusted from the plan text, and Task 1's diff was scoped down to only the new
PROV-05 material as a result.

## Known Stubs

None. No hardcoded empty values, placeholder text, or unwired data sources were introduced.

## Threat Flags

None. This plan added no new network endpoint, auth path, file-access pattern, or schema change
— only new test assertions over the same already-established real-process MCP channel (see the
plan's own `<threat_model>` table), plus a mutation that was fully reverted.

## Final Verification

- `node --test fjs-run-integration.test.js 2>&1 | tail -30` — **1/1 pass**.
- `npm test` (final, after Mutation Gate M1's restoration) — **tests 6314, pass 6314, fail 0,
  cancelled 0, skipped 0, todo 0, exit 0**, duration ~90s (within the documented ~45-140s range).
- De-duplicated project-local proof count: **916** (unchanged from the 19-02 baseline — this
  plan's new assertions live in the root-level `fjs-run-integration.test.js`, not under `fjs/`).

## Self-Check

- `fjs-run-integration.test.js` — FOUND, modified, contains `countsTowardReproducibilityAcceptance` import and the PROV-05 proof block.
- `fjs/server/fjs_run/snapshot/module.f.js` — FOUND, byte-identical to its pre-mutation state (`git diff` empty).
- Commit `0315577` — FOUND in `git log --oneline`.
- `.planning/REQUIREMENTS.md` — FOUND, EXEC-13 and PROV-05 both `[x]` and `Complete` in the traceability table.
- `.planning/ROADMAP.md` — FOUND, Phase 19 row reads `3/3 | Complete | 2026-08-12`.
- `.planning/STATE.md` — FOUND, `completed_phases: 16`, Decisions section carries the three new 19-03 entries.

## Self-Check: PASSED
