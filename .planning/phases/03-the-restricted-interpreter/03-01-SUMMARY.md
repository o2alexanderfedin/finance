---
phase: 03-the-restricted-interpreter
plan: 01
subsystem: exec
tags: [interpret, effects, refusal, security, tdd]

# Dependency graph
requires:
  - phase: 01-planning-document-corrections-and-the-upstream-report
    provides: "EXEC-02 correction — fjs 0.41.0's own-property dispatch guard verified, no local guard to rebuild"
provides:
  - "fjs/exec/module.f.js exporting interpret(map)(effect) — dispatch through fjs 0.41.0's match, with the bare-string refusal throw caught exactly once and reported as a Result naming the operation and the permitted set"
  - "A proof suite pinning the exact refusal text for the six prototype-inherited/network names (constructor, toString, valueOf, hasOwnProperty, __defineGetter__, fetch) and the two-step __defineGetter__ escalation chased to 'no getter installed, following dispatch still refused'"
affects: [phase-03-plan-02-step-budget-and-read-set, phase-06-guest-abi-freeze, phase-07-fjs-run-and-run-records]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Refusal is a value (Result['error', string]), never a throw — interpret catches match's bare-string throw exactly once and reports it, callers never see the raw throw"
    - "Object.setPrototypeOf(map, null) after a typed object literal, because tsc's excess-property checking rejects { __proto__: null, ... } as a literal — same defence-in-depth result, forced by strict tsc rather than a style choice"
    - "unsafeDo: an any-cast of do_ used only for non-permitted-name probes, documented as simulating a stored program whose command string bypassed tsc — the real guest ABI (Phase 6) cannot construct these"

key-files:
  created:
    - "fjs/exec/module.f.js"
  modified: []

key-decisions:
  - "EXEC-02 (own-property dispatch guard) is not reimplemented — verified directly against the installed fjs 0.41.0's match/at (getOwnPropertyDescriptor-based) rather than assumed; this plan only adds the reporting half fjs deliberately left to the caller."
  - "The catch reads the caught value directly and asserts typeof thrown === 'string' rather than checking thrown instanceof Error or reading thrown.message — match's assert throws the bare command string, not an Error, so .message is undefined and an instanceof-Error branch would miss every refusal."
  - "Refusal message text is asserted via assertEq against hardcoded literals in each proof leaf, not derived from the same refusalMessage helper the implementation calls — keeps the check non-tautological."

requirements-completed: [EXEC-01, EXEC-03, EXEC-04]

# Metrics
duration: ~10min
completed: 2026-08-03
---

# Phase 3 Plan 1: interpret's Dispatch and Refusal Reporting Summary

**`fjs/exec/module.f.js` created, exporting `interpret(map)(effect)`: permitted operations dispatch through fjs 0.41.0's `match` and return their computed value; `constructor`, `toString`, `valueOf`, `hasOwnProperty`, `__defineGetter__`, and `fetch` are each refused with the exact text `operation not permitted: <name>; permitted: casRead, evoList, evoHead, evoRevision`; the two-step `__defineGetter__` escalation is refused before any getter installs and the target command remains refused afterward. TDD, genuine RED (8 failing leaves against a stub) then GREEN (8/8, plus all pre-existing proofs) confirmed by two independent mutation breaks.**

## Performance

- **Duration:** ~10 min
- **Completed:** 2026-08-03T20:12:25-07:00 (commit `4e3d51a`)
- **Tasks:** 2/2 completed (Task 1 RED, Task 2 GREEN)
- **Files modified:** 1 created (`fjs/exec/module.f.js`, 185 lines)

## Accomplishments

- `interpret(map)(effect)` dispatches a `Pure` effect directly (`e()`) and a `Do` node through `match(map)(e)`, recursing on the continuation for a successful dispatch.
- All six of `constructor`, `toString`, `valueOf`, `hasOwnProperty`, `__defineGetter__`, and `fetch` are refused with the exact permitted-set text, each pinned by its own `assertEq` against a hardcoded literal (EXEC-03, ROADMAP.md Phase 3 success criterion 1).
- The two-step `__defineGetter__` escalation is chased to its logical end, not a single-hop probe: the install attempt is refused, `Object.hasOwn(map, 'fetch')` stays `false` (the getter function never ran), and a following `fetch` dispatch on the same `map` is still refused with its own message (EXEC-04).
- The catch reads `match`'s bare-string throw directly — `assert(typeof thrown === 'string')`, never `.message`, never `instanceof Error` — matching `match`'s documented contract (verified against the installed fjs 0.41.0 in this same session; the throw is `assert`'s `msg` argument, thrown unmodified).
- Module docstring and inline comments record that EXEC-02 (the own-property dispatch guard) is delivered upstream in fjs 0.41.0's `match`/`at` and is not reimplemented here; `Object.setPrototypeOf(map, null)` on the test fixture is documented as cheap defence in depth, not the security mechanism.
- 8 new proof leaves (`dispatch`, `refusals.constructor/.toString/.valueOf/.hasOwnProperty/.defineGetter/.fetch`, `twoStepDefineGetterEscalation`) went genuinely RED against a stub `interpret` that unconditionally threw `'not implemented'` (`npm test`: 15 total, 8 failing), then GREEN after the real implementation (15/15), with no regression to the 7 pre-existing proofs.

## Task Commits

- Task 1 (RED) and Task 2 (GREEN) landed together in a single commit, `4e3d51a` — `feat(03): interpret — dispatch and actionable refusal (EXEC-01/03/04)` — the commit message documents both the RED (`tests 15, pass 7, fail 8`) and GREEN (`tests 15, pass 15, fail 0`) states explicitly.

## Files Created/Modified

- `fjs/exec/module.f.js` (created, 185 lines) — `interpret`, the test `OperationMap<TestOp, string>` fixture, `unsafeDo`, `refusalMessage`, and the `proof` tree covering successful dispatch, all six named refusals, and the two-step escalation.

## Exact Commands and Observed Output

### RED (Task 1)

`npm test` against the stub `interpret = map => effect => { throw 'not implemented' }`: 8 of the 8 new leaves under `fjs/exec/module.f.js` reported failing, 7 pre-existing proofs still passed. `npx tsc --noEmit` exited 0 — the stub's unconditional throw typechecks against `Result<T, string>`.

### GREEN (Task 2)

`npm test`: 15 total, 15 pass, 0 fail. `npx tsc --noEmit`: exit 0.

### Mutation testing (recorded in the commit message, re-verified during Phase 3 verification)

- Altering the refusal text in `refusalMessage` (implementation only, not the hardcoded test-string literals) → 8 of the module's proof leaves fail.
- Rewriting the catch to read `thrown.message` instead of the caught value directly → the same 8 leaves fail, each reporting `operation not permitted: undefined; ...` — confirming `.message` is genuinely `undefined` on `match`'s bare-string throw and that a handler written the "obvious" way would have passed every refusal proof vacuously had it not been caught.

## Decisions Made

- Verified `match`'s throw contract directly against the installed `node_modules/functionalscript` (0.41.0) rather than trusting 03-CONTEXT.md's description: `assert = (v, msg = 'assertion failed') => { if (!v) throw msg }` — the throw is genuinely the bare `msg` argument (here, the command string), never wrapped in an `Error`.
- Kept `refusalMessage`'s permitted-set ordering as `Object.keys(map).join(', ')` with no `.sort()` — `map`'s declaration order (`casRead, evoList, evoHead, evoRevision`) is what the exact-text success criterion requires verbatim.

## Deviations from Plan

- `{ __proto__: null, ... }` as an object-literal prototype-setting expression was rejected by strict `tsc`'s excess-property checking on the typed `OperationMap<TestOp, string>` literal; used `Object.setPrototypeOf(map, null)` immediately after the typed literal instead. Same result (a null-prototype map, cheap defence in depth per 03-CONTEXT.md, not load-bearing) — forced by the maximally-strict `tsc` config (AGENTS.md: "don't relax flags to silence errors"), not a design change.

## Issues Encountered

None beyond the `tsc` excess-property deviation above, which was resolved without relaxing any compiler flag.

## User Setup Required

None.

## Next Phase Readiness

- `interpret`'s dispatch-and-refusal half (EXEC-01, EXEC-03, EXEC-04) is complete and green. Plan 02 (wave 2, same file) builds the step-budget and observed-read-set half (EXEC-05, EXEC-06) directly on top of this implementation, converting the recursive body to an iterative, budget-bounded, read-accumulating loop.
- The import boundary (`functionalscript/fjs/effects`, `.../types/result`, `.../asserts` only) already holds after this plan; Plan 02 adds the automated grep check for it as part of its own acceptance criteria (ROADMAP.md Phase 3 success criterion 4).

---
*Phase: 03-the-restricted-interpreter*
*Completed: 2026-08-03*
