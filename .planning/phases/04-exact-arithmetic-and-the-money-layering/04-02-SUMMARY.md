---
phase: 04-exact-arithmetic-and-the-money-layering
plan: 02
subsystem: arithmetic
tags: [bigint, decimal, exact-arithmetic, functionalscript, jsdoc-strict]

requires:
  - phase: 04-exact-arithmetic-and-the-money-layering (Plan 01)
    provides: "fjs/types/rational — exact Rational type, add/multiply/sum, halfUp IRS rounding"
provides:
  - "fjs/types/decimal — generic fixed-scale decimal string <-> bigint conversion (parse, format)"
  - "fjs/exact — composed cents representation (centsScale, centsFromString, centsToString) plus the EXACT-05 three-layer demonstration proof"
affects: [phase-05-document-format, phase-08-tax-parameters, phase-10-1040-lines]

tech-stack:
  added: []
  patterns:
    - "Fixed-scale decimal string <-> bigint conversion via anchored regex + BigInt(), never Number()/parseFloat"
    - "Partial application to specialize a generic fjs/types module at a project-specific constant (centsFromString = parse(centsScale))"
    - "Local JSON.stringify replacer (show) for bigint-bearing test assertions, since bigint is not natively JSON-serializable"

key-files:
  created:
    - fjs/types/decimal/module.f.js
    - fjs/exact/module.f.js
  modified: []

key-decisions:
  - "decimal module kept fully generic (scale as parameter, zero finance-specific content) so it is liftable into FunctionalScript unchanged, per AGENTS.md's staging rule; cents-specific scale-2 instantiation lives only in fjs/exact"
  - "over-precision and non-numeric input are refused via assert, never rounded/truncated/coerced — parse's anchored regex plus a fractional-digit-count guard is the sole gate"
  - "sign is read from the regex's captured leading '-', never inferred from the parsed integer magnitude, so zero/near-zero negative values (e.g. '-0.05') keep their sign"
  - "no Money/Cents wrapper type: cents are exactly what centsFromString returns (a plain bigint) with no construction path that could round"

patterns-established:
  - "TDD stub pattern for currying stubs under noUnusedParameters: void each unused parameter/module-level dependency inside the stub body, then throw 'not implemented', so tsc stays clean until the real implementation lands"

requirements-completed: [EXACT-01, EXACT-02, EXACT-05]

duration: 25min
completed: 2026-08-04
---

# Phase 4 Plan 02: Fixed-Scale Decimal and the Three-Layer Money Composition Summary

**Generic bigint<->decimal-string conversion (`fjs/types/decimal`) composed with Plan 01's exact rationals into `fjs/exact`, demonstrating storage-string -> bigint-cents -> non-terminating-rational-share -> rounded-line-cents -> wire-string on one concrete value (`'1234.56'` -> `123456n` -> `[123456n,7n]` -> `17637n` -> `'176.37'`).**

## Performance

- **Duration:** ~25 min
- **Tasks:** 3 (RED, GREEN, compose+demonstrate)
- **Files created:** 2

## Accomplishments
- `fjs/types/decimal/module.f.js`: exact, generic, liftable fixed-scale decimal string <-> bigint conversion (`parse`/`format`), refusing over-precision and non-numeric input via `assert` rather than rounding or truncating.
- `fjs/exact/module.f.js`: composes decimal and rational into this project's cents representation and proves all three EXACT-05 layers on one value with a per-stage assertion.
- Whole-`fjs/`-tree grep for `toFixed`/`parseFloat`/`Math.round` still returns exactly the one line Plan 01 documented — no new floating-point-rounding surface introduced.

## Task Commits

Each task was committed atomically (TDD RED/GREEN split for Tasks 1-2):

1. **Task 1 (RED): failing proof suite and decimal's typed stubs** - `2bcd6ed` (test)
2. **Task 2 (GREEN): implement decimal's exact parse and format** - `674147f` (feat)
3. **Task 3: compose fjs/exact and demonstrate the three EXACT-05 layers** - `d2ffc49` (feat)

_TDD note: Tasks 1-2 are the mandatory RED->GREEN split for `fjs/types/decimal/module.f.js`; Task 3 is a single `feat` commit (not `tdd="true"` in the plan) that adds the composition module with its own proof already passing._

## Files Created/Modified
- `fjs/types/decimal/module.f.js` - Generic fixed-scale decimal string <-> bigint conversion: `parse`, `format`, plus a 9-leaf proof (round-trip positive/negative, whole-dollar, padded-fraction, zero, negative-small sign handling, and three `throw` leaves for over-precision/garbage/empty input).
- `fjs/exact/module.f.js` - Composition: `centsScale`, `centsFromString`, `centsToString`, plus the `threeLayersOnOneValue` proof demonstrating storage string -> bigint cents -> exact 1/7 rational share -> `halfUp`-rounded line cents -> wire string, each stage asserted.

## Decisions Made
- Kept `fjs/types/decimal` free of any finance-specific concept (no "cents", no currency) — `scale` is always a parameter, matching Plan 01's precedent for `fjs/types/rational` and the AGENTS.md line-18 staging rule.
- Used a local `show` JSON-with-bigint-replacer test helper in `fjs/exact/module.f.js`, mirroring the one already established in `fjs/types/rational/module.f.js`, because a raw `JSON.stringify` call on an array containing `bigint` throws `TypeError: Do not know how to serialize a BigInt` — the plan's literal `JSON.stringify(share)` wording is only correct with this replacer in place (see Deviations).
- Sign captured from the regex's leading `-` group, never inferred from the parsed magnitude, so `'-0.05'` (whose integer part parses to the sign-less `0n`) still parses to `-5n`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `assertEq(JSON.stringify(share), JSON.stringify([123456n, 7n]))` would throw before ever comparing**
- **Found during:** Task 3 (writing `threeLayersOnOneValue`)
- **Issue:** The plan's action text calls plain `JSON.stringify` directly on a `Rational` (a bigint tuple). `JSON.stringify` cannot serialize `bigint` at all — it throws `TypeError: Do not know how to serialize a BigInt` — so a literal implementation of that line would fail with an unrelated exception rather than asserting the intended equality. `fjs/types/rational/module.f.js`'s own proof suite (Plan 01) already solved exactly this with a local `show` helper that supplies a `bigint -> string` JSON replacer.
- **Fix:** Added the same `show` helper (test-only, not exported) to `fjs/exact/module.f.js` and used `assertEq(show(share), show([123456n, 7n]))` in its place. Behavior and intent are unchanged — still an exact structural comparison of the `Rational` tuple — just serializable.
- **Files modified:** `fjs/exact/module.f.js`
- **Verification:** `threeLayersOnOneValue` passes; `npm test` 40/40.
- **Committed in:** `d2ffc49` (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 bug fix, no scope change)
**Impact on plan:** The fix is a straight bug correction using a pattern the codebase had already established one file over (Plan 01's `show`); no new capability, no scope creep, no test weakened.

## Issues Encountered
- `noUnusedParameters`/`noUnusedLocals` under this project's maximally strict `tsconfig.json` flagged the Task 1 stubs' unused `scale`/`s`/`n` parameters and the not-yet-used `decimalPattern` constant and `assertNotNullish` import. Resolved per AGENTS.md's "fix the code, never relax a flag" and the project's documented pattern (`void` statements on stubs) — each unused binding is referenced via a `void` statement inside the stub body before the unconditional `throw`, keeping `npx tsc --noEmit` clean through the RED state without touching `tsconfig.json`.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All five EXACT requirements (EXACT-01 through EXACT-05) are now satisfied end to end: exact rationals and IRS half-up rounding (Plan 01) plus fixed-scale decimal conversion and the three-layer money composition (this plan).
- Phase 5 (document format) can now source money values as decimal strings at the storage boundary and hand them to `fjs/exact`'s `centsFromString`/`centsToString` without any floating-point intermediary.
- No blockers.

---
*Phase: 04-exact-arithmetic-and-the-money-layering*
*Completed: 2026-08-04*

## Self-Check: PASSED

- FOUND: fjs/types/decimal/module.f.js
- FOUND: fjs/exact/module.f.js
- FOUND: 2bcd6ed (test(04-02): failing proof suite for fjs/types/decimal)
- FOUND: 674147f (feat(04-02): implement exact fixed-scale decimal parse/format)
- FOUND: d2ffc49 (feat(04-02): compose fjs/exact — cents + rate demonstrates EXACT-05 layers)
