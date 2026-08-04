---
phase: 03-the-restricted-interpreter
plan: 02
subsystem: exec
tags: [interpret, effects, step-budget, read-set, tdd]

# Dependency graph
requires:
  - phase: 03-the-restricted-interpreter
    provides: "interpret(map)(effect)'s dispatch and refusal reporting (Plan 01) — this plan replaces its recursive body with an iterative, budget-bounded, read-accumulating one"
provides:
  - "fjs/exec/module.f.js finished for Phase 3: interpret(map)(effect) bounded by an exported stepBudget = 10_000, returning the accumulated read set alongside the result"
  - "Automated grep confirmation that fjs/exec/module.f.js imports only functionalscript/fjs/effects, .../types/result, and .../asserts (ROADMAP.md Phase 3 success criterion 4)"
affects: [phase-06-guest-abi-freeze, phase-07-fjs-run-and-run-records]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "interpret's dispatch loop is iterative (for (let count = 0; count < stepBudget; count++)), not recursive — Plan 01's recursive body could not express a step budget without unbounded stack growth"
    - "reads accumulated via reads = [...reads, [command, payload]], appended only after a command actually, successfully dispatches inside the loop — never before the try/catch succeeds, so a refused attempt is never recorded as read"
    - "Budget-exceeded is a refusal-shaped Result value (error('step budget exceeded: 10000')), the same outcome shape as a denied operation — never a thrown error, never an unbounded hang"

key-files:
  created: []
  modified:
    - "fjs/exec/module.f.js"

key-decisions:
  - "stepBudget is a named, exported constant (10_000) rather than an inline literal — a runaway guard, not a tuned limit, changeable without hunting a magic number, per 03-CONTEXT.md's locked decision."
  - "The read-append ordering (after a successful dispatch, never before) is documented as an implementation invariant, not a witnessed property: the refusal path returns error(message) and discards reads entirely, so both orderings pass every proof in this file. Verified directly during Phase 3 verification by moving the append before the dispatch and re-running the full suite — still 18/18 green, confirming the ordering is genuinely unobservable from outside with the current API shape."
  - "Loop counter named count, not step, to avoid colliding with the imported step combinator used inside the proof tree's non-terminating-chain and multi-command test fixtures."

requirements-completed: [EXEC-05, EXEC-06]

# Metrics
duration: ~9min
completed: 2026-08-03
---

# Phase 3 Plan 2: interpret's Step Budget and Observed Read Set Summary

**`fjs/exec/module.f.js` completed: `interpret`'s recursive dispatch loop replaced with an iterative one bounded by exported `stepBudget = 10_000`; a non-terminating effect chain now returns `['error', 'step budget exceeded: 10000']` instead of hanging; `interpret`'s successful result carries the accumulated read set (`[command, payload]` pairs, in dispatch order) alongside the value. Import-boundary grep confirms the module imports only `functionalscript/fjs/effects`, `.../types/result`, and `.../asserts`. `npm test`: 18/18 green (11 in this module, 7 pre-existing, no regression); `npx tsc --noEmit`: clean.**

## Performance

- **Duration:** ~9 min
- **Completed:** 2026-08-03T20:21:13-07:00 (commit `2754ef0`)
- **Tasks:** 2/2 completed (Task 1 RED via a type-level contradiction, Task 2 GREEN)
- **Files modified:** 1 (`fjs/exec/module.f.js`, +114/-23 lines)

## Accomplishments

- `export const stepBudget = 10_000` added above `interpret`, documented as a runaway guard rather than a tuned limit (EXEC-06).
- `interpret`'s body converted from unbounded recursion to `for (let count = 0; count < stepBudget; count++)`: a `Pure` node (`typeof e === 'function'`) returns `ok([e(), reads])` within budget; a `Do` node dispatches through `match(map)(e)` exactly as Plan 01 did, appends `[command, payload]` to `reads` only after the dispatch succeeds, then continues with the continuation applied to the operation's output.
- If the loop exhausts `stepBudget` without reaching a `Pure` node, `interpret` returns `error('step budget exceeded: 10000')` — a refusal-shaped value, never a thrown error or a hang (EXEC-06, ROADMAP.md Phase 3 success criterion 2).
- `interpret`'s return type changed from `Result<T, string>` to `Interpreted<T> = Result<readonly [T, readonly Read[]], string>`; the read set is observed by `interpret` itself as it dispatches, never declared or supplied by the guest effect (EXEC-05, ROADMAP.md Phase 3 success criterion 3).
- New proof leaves: `stepBudgetBoundsNonTerminatingChain` (a self-referential `forever = () => step(readDo('spin'), forever)` chain, interpreted, returns the exact step-budget refusal and the proof itself completes — not killed by a timeout); `readSetReflectsActualDispatch` (a two-command chain returns `reads` exactly matching the two dispatched commands, in order); `refusalPartwayThroughAChainReportsTheRefusedCommand` (a chain that dispatches one real command then hits a denied one still reports the denied command's own refusal text, covering a denial reached after real work — every other refusal proof denies on the first command).
- `proof.dispatch` updated to destructure `[value, reads]` from the successful result and assert both.
- Import-boundary grep run as part of Task 2's verification: `grep -n "^import" fjs/exec/module.f.js | grep -Ev "functionalscript/fjs/(effects|types/result|asserts)/module\.f\.js'$" | wc -l` → `0` — the module imports only the three permitted sources (ROADMAP.md Phase 3 success criterion 4).

## Task Commits

- Task 1 (RED) and Task 2 (GREEN) landed together in a single commit, `2754ef0` — `feat(03): step budget and observed read set (EXEC-05/06)`. The commit message documents the RED state as a genuine type-level contradiction: tightening `interpret`'s `@returns` to `Interpreted<T>` against Plan 01's unchanged recursive body produced `TS2322` (`'readonly ["ok", T]' not assignable to Ok<readonly [T, readonly Read[]]>`), so `npm test` failed at the `tsc` stage before `node --test` ever ran — the expected RED per this plan's Task 1 acceptance criteria.

## Files Created/Modified

- `fjs/exec/module.f.js` (modified, +114/-23) — `stepBudget` export; `interpret`'s body converted to the iterative, budget-bounded, read-accumulating loop; `Read` and `Interpreted<T>` typedefs added; `proof.dispatch` updated and three new proof leaves added.

## Exact Commands and Observed Output

### RED (Task 1)

`npx tsc --noEmit` failed with `TS2345`/`TS2322`-class errors against the still-recursive Plan 01 body under the tightened `@returns {Interpreted<T>}` annotation — confirming the new contract is enforced, not silently accepted, before any implementation change.

### GREEN (Task 2)

`npm test`: `tests 18`, `pass 18`, `fail 0` (11 leaves in `fjs/exec/module.f.js` — the 8 from Plan 01 plus `dispatch`'s updated assertion, `stepBudgetBoundsNonTerminatingChain`, `readSetReflectsActualDispatch`, and `refusalPartwayThroughAChainReportsTheRefusedCommand` — plus 7 pre-existing proofs in `fjs/proof.f.js` and `fjs/server/module.f.js`). `npx tsc --noEmit`: exit 0. Import-boundary grep: `0` non-matching `^import` lines.

### Mutation testing (re-verified during Phase 3 verification, after this plan's commit)

- Raising `stepBudget` from `10_000` to `20_000` (implementation only) → `stepBudgetBoundsNonTerminatingChain` fails (`'step budget exceeded: 20000'` vs. the hardcoded expected `'...10000'`), and the leaf's wall-clock duration roughly doubles (measured ~281ms → ~562ms in this session) — confirming the budget loop performs genuinely proportional real dispatches rather than short-circuiting to a fixed answer.
- Moving the `reads = [...reads, ...]` append to before the `match(map)(e)` call (making a refused attempt appear to have been "read") → all 18 leaves still pass, confirming the commit message's own documented finding: the ordering is unobservable from outside the current API because the refusal path discards `reads` entirely on the error branch.

## Decisions Made

- Recorded, in the proof's own comment (`refusalPartwayThroughAChainReportsTheRefusedCommand`), that the read-append ordering is an implementation invariant rather than a proof-witnessed property, and stated the condition under which it would become testable (a later phase returning partial reads alongside a refusal). This was independently re-verified during Phase 3 goal-backward verification by making the swap and re-running the full suite: still 18/18 green, confirming the comment does not overstate what is guaranteed.
- Kept Plan 01's catch (`assert(typeof thrown === 'string')`, reporting via `refusalMessage`) completely unchanged — the refusal path's shape does not change in this plan, only the success path gains the read-set tuple.

## Deviations from Plan

None — plan executed as written; the RED state matched the plan's predicted type-level contradiction exactly.

## Issues Encountered

None.

## User Setup Required

None.

## Next Phase Readiness

- Phase 3's full requirement set (EXEC-01, EXEC-02 [delivered upstream], EXEC-03, EXEC-04, EXEC-05, EXEC-06) is now complete: `interpret(map)(effect)` dispatches, refuses actionably, bounds its own execution, and reports only what it actually observed.
- `fjs/exec/module.f.js` imports only `functionalscript/fjs/effects`, `.../types/result`, and `.../asserts` — zero coupling to CAS, Evo, MCP, or the filesystem, exactly as ROADMAP.md Phase 3 success criterion 4 and 03-CONTEXT.md's phase boundary require. Phase 6 (guest ABI freeze) and Phase 7 (`fjs_run`) are the first consumers of `interpret` and its exported `stepBudget`.
- No file in this phase imports or is imported by `fjs/exec/module.f.js` yet — wiring `interpret` into the guest ABI and the MCP tool handler is explicitly out of scope here (03-CONTEXT.md's "Deferred Ideas") and belongs to Phases 6–7.

---
*Phase: 03-the-restricted-interpreter*
*Completed: 2026-08-03*
