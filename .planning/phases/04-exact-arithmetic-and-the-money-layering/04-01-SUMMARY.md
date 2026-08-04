---
phase: 04-exact-arithmetic-and-the-money-layering
plan: 01
subsystem: arithmetic
tags: [bigint, rational, rounding, functionalscript, jsdoc-strict]

requires: []
provides:
  - "fjs/types/rational — exact Rational type ([numerator, denominator] bigint pair), exact of/ofInt/negate/add/multiply/sum, and the halfUp named rounding mode (IRS half-up, ties away from zero at both signs)"
affects: [phase-04-plan-02-decimal-and-exact-composition, phase-08-tax-parameters, phase-10-1040-lines]

tech-stack:
  added: []
  patterns:
    - "Exact rational arithmetic via unreduced bigint numerator/denominator pairs — never gcd-reduced, so a rounding constructor cannot exist"
    - "sum composed from the upstream monoid-fold idiom (functionalscript/fjs/common/monoid) rather than a hand-rolled reduce"
    - "halfUp rounding derived from bigint truncating division/remainder semantics (q = n/d, r = n%d, r carries n's sign) rather than any floating-point rounding function"
    - "Explicit divergence proof: assert both exact values (ours and the built-in) and the inequality between them, not merely an implied difference"

key-files:
  created:
    - fjs/types/rational/module.f.js
  modified: []

key-decisions:
  - "Rational is never reduced/simplified at construction or through arithmetic — of(7n)(3n) stays [7n,3n] forever; this is what makes the round(sum(x)) vs sum(round(x)) counterexample representable at all"
  - "of is a pure sign-normalizing pass-through (moves a negative sign off the denominator onto the numerator) and refuses (via assert) a zero denominator — never Infinity/NaN"
  - "halfUp is the only rounding operation exposed, and no per-item-rounding convenience (roundEach/mapRound) is exported, so round(sum(x)) is the natural composition and sum(round(x)) is an extra step nobody is invited to take"
  - "halfUp ties break away from zero at both signs (matches Java's BigDecimal.ROUND_HALF_UP), explicitly not Math.round, whose tie-break is biased toward +Infinity (Math.round(-2.5) === -2, a systematic bias in the taxpayer's favor on every loss)"
  - "The one legitimate Math.round reference in the whole fjs/ tree lives in exactly one line (module.f.js:168, const builtIn = BigInt(Math.round(-2.5))), keeping the criterion-2 grep gate at exactly one match, not zero — a bare zero-match gate would be wrong here since this proof legitimately needs the comparison"
  - "fjs/types/rational kept free of finance-specific types (no Money/Cents wrapper) per AGENTS.md's staging rule, so it can be lifted into FunctionalScript unchanged; the project's cents-scale instantiation lives in Plan 02's fjs/exact/module.f.js"

patterns-established:
  - "TDD RED/GREEN stub pattern: each of the module's 7 functions declared as an independent typed stub (throw 'not implemented'), none calling another, so no stub can be indirectly broken by another's stub during Task 1's RED state"
  - "Local JSON.stringify-with-bigint-replacer (show) test helper for exact structural comparison of Rational tuples, since bigint is not natively JSON-serializable and tuples are not ===-comparable"

requirements-completed: [EXACT-01, EXACT-02, EXACT-03, EXACT-04]

duration: 9min
completed: 2026-08-04
---

# Phase 4 Plan 01: Exact Rational Arithmetic and IRS Half-Up Rounding Summary

**Built `fjs/types/rational/module.f.js` — an exact, unreduced `[numerator, denominator]` bigint rational type with exact `add`/`multiply`/`sum` and one named rounding mode, `halfUp` (IRS half-up, ties away from zero at both signs), proving it differs from `Math.round` at the `-2.5` tie and exhibiting a concrete case where `round(sum(x)) ≠ sum(round(x))`.**

## Performance

- **Duration:** ~9 min
- **Tasks:** 2 (RED, GREEN)
- **Files created:** 1

## Accomplishments
- `fjs/types/rational/module.f.js`: exact, generic, liftable rational arithmetic (`of`, `ofInt`, `negate`, `add`, `multiply`, `sum`) that never divides, reduces, or approximates at construction or through any operation.
- `halfUp`: IRS half-up rounding, ties away from zero at both signs, proven to diverge from `Math.round` at the `-2.5` tie via an explicit comparison of both exact values plus the inequality between them (not an implication).
- `lineRoundingVsPerItemRounding`: the exhibited counterexample for ROADMAP.md Phase 4 success criterion 3 — three exact one-half rationals sum to `3/2`, which `halfUp(sum(items))` rounds to `2n`, while summing each item's individually-rounded value (`items.map(halfUp).reduce(+)`) gives `3n` — both concrete values asserted, then asserted to differ.
- Whole-`fjs/`-tree grep for `toFixed`/`parseFloat`/`Math.round` returns exactly one line at this point in the phase: `fjs/types/rational/module.f.js:168`'s `const builtIn = BigInt(Math.round(-2.5))` — the documented, required divergence-proof comparison, not a regression.

## Task Commits

Both tasks (RED then GREEN) were committed as a single atomic feature commit, not split test/feat commits:

1. **Task 1 (RED) + Task 2 (GREEN): failing proof suite, typed stubs, then full implementation** - `35a3f78` (feat)

_TDD note: unlike Plan 02's Tasks 1-2 (separate `test`/`feat` commits), this plan's executor committed the RED stub-plus-proof-tree state and the GREEN real-implementation state together as one `feat` commit. The commit message documents both states explicitly: "TDD: RED 30 tests / 11 fail against the stub -> GREEN 30/30," matching Task 1's acceptance criterion (11 genuine failures out of 12 new leaves, `throw.zeroDenominator` coincidentally passing against the stub) and Task 2's (all 12 new leaves passing, 18 pre-existing leaves unaffected, for 30 total)._

## Files Created/Modified
- `fjs/types/rational/module.f.js` - Exact `Rational` type (`[numerator, denominator]`, denominator always positive, never reduced), exact `of`/`ofInt`/`negate`/`add`/`multiply`/`sum` (the last via the upstream `fold`-based monoid idiom), and `halfUp` IRS half-up rounding — plus a 12-leaf proof tree covering construction (2), arithmetic (3), rounding including both-signs ties and the explicit `Math.round` divergence (5), the exhibited `round(sum(x)) ≠ sum(round(x))` counterexample (1), and the zero-denominator refusal (1, nested under `throw`).

## Decisions Made
- No gcd reduction anywhere, ever — `of`, `add`, `multiply`, and `sum` all leave results unreduced (e.g. `add(of(1n)(3n))(of(1n)(6n))` is `[9n, 18n]`, not `[1n, 2n]`), which is what keeps a money-type-that-rounds-on-construction structurally impossible rather than merely avoided by convention.
- `sum` composed via `fold({ identity: ofInt(0n), operation: add })` from `functionalscript/fjs/common/monoid`, the upstream idiom, rather than a hand-rolled `reduce` — and its Task 1 stub deliberately stayed a bare `throw 'not implemented'` rather than the real `fold(...)` expression, because `fold(...)` would evaluate `ofInt(0n)` eagerly at module-load time against a still-throwing `ofInt` stub and crash the whole module before any test could run.
- `halfUp`'s formula (`q = n/d`, `r = n%d`, nudge `q` one step further from zero when `2|r| >= d`) relies on bigint `/`/`%` truncating toward zero with `%` carrying the dividend's sign — verified against this Node and documented in a doc comment above the function so the reasoning doesn't need re-deriving from bigint truncation semantics later.
- Exactly one `Math.round` reference is permitted and required in the whole `fjs/` tree (the divergence-proof comparison); the plan's action text is explicit that the literal substring must not appear a second time anywhere in this file, including comments, which the mutation-testing/grep evidence below confirms held.

## Deviations from Plan

None. Both tasks were implemented as specified: seven independent typed stubs in Task 1 (RED), then each stub body replaced with the real implementation in Task 2 (GREEN), with the module docstring, typedef, imports, and `proof` tree left as written in Task 1.

## Issues Encountered
- None beyond the ordinary RED-state stub/typecheck mechanics already documented in Task 1's acceptance criteria (12 new leaves, 11 genuine RED failures, 1 coincidental pass on `throw.zeroDenominator`).

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `fjs/types/rational` is ready for Plan 02 to compose against: `of`, `ofInt`, `multiply`, `halfUp` are the exact interface Plan 02's `fjs/exact/module.f.js` imports to build the cents representation and the three-layer (EXACT-05) demonstration.
- EXACT-01 (upstreamable exact-arithmetic module), EXACT-02 (no floating point in this file), EXACT-03 (IRS half-up including negatives), and EXACT-04 (rounding is a line property, not a value property; no money type rounds on construction) are satisfied by this plan; EXACT-05 (the three-layer demonstration) is Plan 02's scope.
- No blockers.

---
*Phase: 04-exact-arithmetic-and-the-money-layering*
*Completed: 2026-08-04*

## Self-Check: PASSED

- FOUND: fjs/types/rational/module.f.js
- FOUND: 35a3f78 (feat(04): exact rationals and IRS half-up rounding (EXACT-01/02/03/04))
