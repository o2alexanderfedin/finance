---
phase: 07-fjs-run-run-records-and-the-week-1-convergence
plan: 01
subsystem: fjs-guest-abi
tags: [fjs-run, guest-abi, functionalscript, effects, exact-arithmetic]

# Dependency graph
requires:
  - phase: 06-guest-abi-freeze-and-safe-materialization
    provides: "The frozen four-command guestCtx/CasOp/casOpNames and interpret's real dispatch loop"
provides:
  - "guestCtx widened with step, pure, centsFromString, centsToString — the composition and money vocabulary EXEC-07 always specified but Phase 6 never delivered"
  - "A guest program can now sequence more than one dispatched CasOp command (ctx.step), which Success Criterion 1 (summing a field across every stored document) requires"
  - "Two revised runtime proofs (vocabularyIsFrozenAtFour, everyConstructorDispatches) that distinguish the frozen command set from the additive combinator/helper set"
  - "Two new proof leaves (combinatorsAreNeverOperations, stepComposesTwoDispatchedCommands) closing the regression gap and proving composition end to end"
affects: [07-05, 07-06, 07-08]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "guestCtx grows by re-exporting existing fjs primitives directly (step/pure from functionalscript/fjs/effects, centsFromString/centsToString from fjs/exact) rather than wrapping or reimplementing them"
    - "A command-subset lookup table (commandConstructorsByName) used only inside a proof to give a per-name dispatch loop one uniform call shape, instead of iterating a mixed-type ctx object literal"

key-files:
  created: []
  modified:
    - "fjs/guest/module.f.js — guestCtx widened to 8 members; two proofs revised; two proof leaves added"

key-decisions:
  - "CasOp and casOpNames are untouched — the widening is additive to ctx only, never to the operation vocabulary match dispatches on"
  - "vocabularyIsFrozenAtFour's single Object.keys(guestCtx) === casOpNames equality is split into three independently falsifiable assertion groups (live command-name equality, per-name own-property check, per-combinator typeof check) rather than weakened to a subset/superset check"
  - "everyConstructorDispatches iterates casOpNames (not Object.entries(guestCtx)) because step/pure no longer share a single unary string->Effect call shape with the four commands — tsc rejected the old form directly once ctx widened"

requirements-completed: [EXEC-08]

# Metrics
duration: 20min
completed: 2026-08-05
---

# Phase 7 Plan 1: Widen the frozen guest ABI with composition combinators and money helpers Summary

**`guestCtx` now re-exports `step`/`pure` from `functionalscript/fjs/effects` and `centsFromString`/`centsToString` from `fjs/exact` alongside the frozen four `CasOp` commands, closing the Phase 6 under-delivery that made multi-document composition impossible with zero imports.**

## Performance

- **Duration:** ~20 min
- **Tasks:** 2
- **Files modified:** 1 (`fjs/guest/module.f.js`)

## Accomplishments

- `guestCtx` grew from 4 keys to 8: `casRead, evoList, evoHead, evoRevision, step, pure, centsFromString, centsToString` — the four commands unchanged in position and identity, plus the composition combinators and money helpers EXEC-07's requirement text always named.
- `CasOp` and `casOpNames` are byte-for-byte unchanged; the `Assert<Equal<CasOp[0], 'casRead'|'evoList'|'evoHead'|'evoRevision'>>` type pin still compiles unmodified, and `grep -n "casWrite\|evoAdd" fjs/guest/module.f.js fjs/guest/materialize/module.f.js` still returns no matches.
- `vocabularyIsFrozenAtFour` revised from one collapsed `Object.keys(...) === casOpNames` equality into three independently falsifiable groups: a live, unchanged `casOpNames.join(',')` string-equality (still fails the moment a fifth *command* name is added), a per-name `Object.hasOwn(guestCtx, name)` check for the four commands, and a `typeof === 'function'` check for the four new members.
- `everyConstructorDispatches` re-scoped from `Object.entries(guestCtx)` to the `casOpNames` command subset — `step`/`pure` are not unary command constructors and calling them the old way no longer typechecks.
- New leaf `combinatorsAreNeverOperations`: asserts `casOpNames` never contains `'step'`, `'pure'`, `'centsFromString'`, or `'centsToString'` — the regression guard against a future edit silently promoting a combinator into the dispatched-operation set.
- New leaf `stepComposesTwoDispatchedCommands`: builds `guestCtx.step(guestCtx.casRead('doc-a'), value => guestCtx.evoHead(value))`, interprets it through the real interpreter, and asserts both the final value (`'evoHead:casRead:doc-a'`) and that `reads.length === 2` with both command names present in dispatch order — proof that composition actually works end to end, not just that `step`/`pure` exist as values.
- New leaf `guestCtxReExportsCombinatorsAndMoneyHelpers` (Task 1): `Object.is` checks that `guestCtx.step`/`guestCtx.pure`/`guestCtx.centsFromString`/`guestCtx.centsToString` are the *same function objects* as the originals (not wrappers), plus `guestCtx.centsFromString('1234.56') === 123456n`.

## Task Commits

1. **Task 1: Widen guestCtx with step, pure, and the money helpers** - `e46c273` (feat)
2. **Task 2: Revise the two Phase 6 proofs and add combinator-composition coverage** - `a23ef5b` (feat)

_Both tasks are `tdd="true"`; each commit is a single feat commit adding both the behavior and its proof coverage together, per this file's established style of proofs living alongside the code they test in the same module._

## Files Created/Modified

- `fjs/guest/module.f.js` - `guestCtx` widened to 8 members (imports added: `step`, `pure` from `functionalscript/fjs/effects/module.f.js`; `centsFromString`, `centsToString` from `../exact/module.f.js`); JSDoc above `guestCtx` explains the widening is additive-to-ctx-only, never to the operation vocabulary; two Phase 6 proofs revised; three new proof leaves added (`guestCtxReExportsCombinatorsAndMoneyHelpers`, `combinatorsAreNeverOperations`, `stepComposesTwoDispatchedCommands`); a small internal `commandConstructorsByName` lookup table added purely to give `everyConstructorDispatches`'s per-name loop one uniform, type-checkable call shape.

## Decisions Made

- Kept `casOpNames.join(',')`'s live equality assertion completely unchanged inside `vocabularyIsFrozenAtFour` rather than replacing it with a weaker "subset" or "at least four" check — a fifth command name added anywhere still fails this exact line, which is the property 07-RESEARCH.md's Pitfall 5 named as the one not to lose.
- Added `commandConstructorsByName` (an internal, test-only `Record<string, (a: string) => Effect<CasOp, string>>` built from the same four command consts already assigned into `guestCtx`) instead of indexing `guestCtx` directly by a generic string or introducing an `any` cast. `guestCtx`'s own value type is now a union of eight incompatible call shapes (commands + `step` + `pure` + money helpers), and `tsc` rejects calling that union directly (confirmed by observation below). Introducing an `any` cast would have added a second `any` under `fjs/`, contradicting this file's own comment that `fjs/exec`'s `unsafeDo` is "the only `any` under `fjs/`." The lookup table sidesteps both problems with zero `any`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - blocking issue] `everyConstructorDispatches`'s original `Object.entries(guestCtx)` loop does not typecheck against widened `guestCtx`**

- **Found during:** Task 1 (surfaced immediately by `npx tsc` after widening `guestCtx`, before Task 2 began)
- **Issue:** `tsc` reported `TS2349: This expression is not callable` on `construct('x')` inside the old `everyConstructorDispatches` body — `Object.entries(guestCtx)`'s value type became a union of eight mutually incompatible call signatures (four commands + `step` + `pure` + two money helpers) the moment `guestCtx` grew past the four commands, and TypeScript will not call an arbitrary union of dissimilar function signatures.
- **Fix:** This is exactly Task 2's own named scope (per the plan's critical constraint: revise the two proofs explicitly, as their own task, not incidentally). Task 1's commit therefore intentionally lands with `everyConstructorDispatches` (and `vocabularyIsFrozenAtFour`, which also asserted the now-broken `Object.keys(guestCtx) === casOpNames` equality) failing — `npx tsc` fails at that commit, and `node --test` alone (bypassing `tsc`) shows exactly those two pre-existing proofs red, nothing else. Task 2, committed immediately after with no checkpoint in between, replaces both proof bodies and restores a fully green `npm test`. This sequencing is inherent to the plan's own two-task split (07-01-PLAN.md's critical constraint explicitly assigns the proof revision to Task 2) and is not a silent or incidental fix — it is exactly the task the plan named for it.
- **Files modified:** `fjs/guest/module.f.js`
- **Commit:** `a23ef5b` (Task 2)

---

**Total deviations:** 1 auto-fixed (Rule 3 - blocking issue, resolved by the plan's own Task 2, not worked around ahead of it)
**Impact on plan:** No scope creep. The plan's own task boundary anticipated exactly this dependency (its critical constraints explicitly require the proof revision to be Task 2's own named work, not folded into Task 1), and both tasks executed back-to-back with no checkpoint between them, so the intermediate red state never reached a final, reported-as-done commit.

## Issues Encountered

None beyond the expected inter-task compile dependency documented above.

## User Setup Required

None - no external service configuration required.

## Verification

- `npx tsc` — exits 0, no output.
- `npm test` — `tests 2314`, `pass 2314`, `fail 0`.
- Project-local proof count gate (`node --test 2>&1 | grep -c '^✔ import("./fjs/'`): **133 → 136** (baseline confirmed in this worktree before any change; +3 net new project-local proof leaves: `guestCtxReExportsCombinatorsAndMoneyHelpers`, `combinatorsAreNeverOperations`, `stepComposesTwoDispatchedCommands`). Strictly greater than 133, per 07-VALIDATION.md's gate.
- `grep -n "casWrite\|evoAdd" fjs/guest/module.f.js fjs/guest/materialize/module.f.js` — no output (both still absent from the guest whitelist).
- All six `fjs/guest/module.f.js` proofs pass under root discovery (`node --test`): `guestCtxReExportsCombinatorsAndMoneyHelpers`, `vocabularyIsFrozenAtFour`, `combinatorsAreNeverOperations`, `everyConstructorDispatches`, `stepComposesTwoDispatchedCommands`, `reportShapedProgramRuns`.

## Requirements Bookkeeping

This plan's frontmatter lists `requirements: [EXEC-08]`, but 07-VALIDATION.md's own
Per-Task Verification Map labels this plan's work "EXEC-08 precursor (ctx combinators,
revises EXEC-07)" — the actual `fjs_run` MCP tool does not exist yet and is built across
Plans 07-05/07-06/07-08. Marking `REQUIREMENTS.md`'s `EXEC-08` checkbox complete now would
misrepresent status (the tool it describes cannot be called yet), so it is intentionally
left unchecked here. It should be marked complete when Plan 07-08's end-to-end proof lands.

## Next Phase Readiness

`guestCtx.step`/`guestCtx.pure` are now available for Plan 07-05 (materialize write step, synchronous host-map snapshot) and Plan 07-06 (the `fjs_run` handler orchestration), both of which need to sequence more than one dispatched command to satisfy Success Criterion 1 (summing `box1InterestIncome` across every stored 1099-INT). No blockers for Wave 1's remaining independent plans (07-02, 07-03, 07-04), which do not depend on this plan.

---
*Phase: 07-fjs-run-run-records-and-the-week-1-convergence*
*Completed: 2026-08-05*

## Self-Check: PASSED

- FOUND: fjs/guest/module.f.js
- FOUND: .planning/phases/07-fjs-run-run-records-and-the-week-1-convergence/07-01-SUMMARY.md
- FOUND: e46c273 (Task 1 commit)
- FOUND: a23ef5b (Task 2 commit)
