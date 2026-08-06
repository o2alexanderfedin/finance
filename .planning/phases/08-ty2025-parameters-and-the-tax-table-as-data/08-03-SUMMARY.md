---
phase: 08-ty2025-parameters-and-the-tax-table-as-data
plan: 03
subsystem: data
tags: [boundary-proofs, thresholds, generated, phase-8]

# Dependency graph
requires: ["08-01", "08-02"]
provides:
  - "fjs/tax/boundary/module.f.js: segmentIndex (generic, tax-agnostic boundary counter), allThresholds (the 42-entry combined threshold inventory across ordinary-bracket ceilings, capital-gains breakpoints, and Tax Table band edges), expectedThresholdCount, and a generated threshold-1cent/threshold/threshold+1cent proof triple over every stored threshold"
affects: ["08-04"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Data-driven proof generation via Object.fromEntries over a data array, so a threshold added to the parameter data later is covered automatically without a hand-written leaf -- mirrors the vocabularyIsFrozenAtFour-style self-enforcing pattern this phase's own context calls out"
    - "A generic, tax-agnostic segmentIndex counting function that shares no code path with the Tax Table module's own tax-computation/row-generation functions, so the boundary check cannot inherit a bug from the code it independently verifies (T-08-01's non-shared-code-path discipline, extended to this module)"
    - "An independently-stated expected count (expectedThresholdCount) checked against the assembled list's actual length, so a threshold silently dropped during assembly fails explicitly rather than passing by omission"

key-files:
  created: [fjs/tax/boundary/module.f.js]
  modified: []

key-decisions:
  - "Both tasks (the classifier/inventory and the generated proof) were drafted together in one file-write session and landed in a single commit (6c5533e) rather than two separate task commits -- documented under Deviations below."
  - "The docstring narrating the noUncheckedIndexedAccess narrowing rationale intentionally avoids repeating the literal substring `taxParamsByYear[2025]` a second time (mirroring fjs/tax/table/module.f.js's own phrasing), so the acceptance criterion `grep -c \"taxParamsByYear\\[2025\\]\"` equals exactly 1 -- the single narrowing site -- rather than counting a second, merely descriptive occurrence in prose."
  - "hasDefinedCeiling (the type-predicate filter over Bracket.ceiling) is declared via `@param`/`@returns {x is T}` JSDoc tags directly on the function, not via a `@type {(x) => x is T}` annotation -- TypeScript rejects assigning a plain boolean-returning arrow function to a variable typed with a predicate signature (`TS2322: ... must be a type predicate`), so the predicate must be declared on the function itself. Caught immediately by `npx tsc` and fixed before any test run (Rule 3 -- blocking compile error)."

requirements-completed: [TAX-04]

# Metrics
duration: ~25min
completed: 2026-08-05
---

# Phase 8 Plan 3: TY2025 Parameters and the Tax Table as Data Summary

**A generic, tax-agnostic boundary counter and a data-driven, generated threshold-1cent/threshold/threshold+1cent proof over all 42 stored thresholds (27 ordinary-bracket ceilings, 10 capital-gains breakpoints, 5 Tax Table band edges) -- built to share no code path with the Tax Table's own tax-computation functions, so a bug in that generator cannot silently pass its own boundary check**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-08-05 (session start)
- **Completed:** 2026-08-05T20:01:02Z
- **Tasks:** 2 completed (both landed in one commit -- see Deviations)
- **Files created:** 1 (`fjs/tax/boundary/module.f.js`)

## Accomplishments

- `segmentIndex`: a pure, generic, tax-agnostic boundary counter -- `(boundariesAscendingCents) => (valueCents) => number` -- counting how many stored boundaries a value has reached or passed. Documented explicitly as encoding no tax rate, no money computation, and no rounding, and as deliberately independent of the Tax Table module's own tax-computation and row-generation functions.
- `allThresholds`: the combined 42-entry threshold inventory --
  - 27 ordinary-bracket ceilings (6 each for single/marriedFilingJointly/marriedFilingSeparately/headOfHousehold, 3 for estatesAndTrusts, which has only four brackets),
  - 10 capital-gains breakpoints (`zeroRateMax`/`fifteenRateMax` x 5 statuses),
  - 5 Tax Table band edges (every region's `atLeast` except the table's own `0.00` starting edge, plus the final region's `lessThan`, `100000.00`) --
  each entry's `cents` value parsed via `centsFromString` from the exact string already stored in `fjs/tax/params/module.f.js`/`fjs/tax/table/module.f.js`, never re-typed as a new literal.
- `expectedThresholdCount = 42`, an independently-stated expectation Task 2's proof checks the assembled list against.
- `taxParams2025`: TY2025 parameters narrowed exactly once at module scope via `assert`, never a cast or non-null assertion.
- A **generated** `proof` object -- one leaf per threshold, built via `Object.fromEntries` over `allThresholds` (never 42 hand-written leaves) -- asserting the boundary is crossed at exactly the threshold's own cent (one cent before: strictly fewer boundaries reached; the threshold itself and one cent after: the same count). Plus `everyThresholdIsCovered`, asserting the assembled list's length against `expectedThresholdCount` and the generated proof's own key count against the list's length, so a silently dropped threshold fails explicitly.
- Verified independently (see below) that `allThresholds` breaks down exactly as expected: 27 ordinary-bracket / 10 capital-gains / 5 Tax Table band entries.

## Task Commits

1. **Task 1 + Task 2 (combined): Generic segment classifier, combined threshold inventory, and the generated boundary-triple proof** - `6c5533e` (feat) -- see Deviations for why both tasks landed in one commit

## Files Created/Modified

- `fjs/tax/boundary/module.f.js` - the generic boundary classifier (`segmentIndex`), the combined threshold inventory (`allThresholds`, `expectedThresholdCount`), and the generated boundary-triple `proof`

## Decisions Made

- **`hasDefinedCeiling`'s type predicate is declared via `@param`/`@returns {bracket is {...}}` JSDoc tags on the function itself, not via a `@type {(bracket) => bracket is {...}}` annotation.** The first draft used the same `@type` style as `fjs/tax/params/module.f.js`'s own `isDefinedString` predicate, but TypeScript rejected it: `TS2322: Type '(bracket: Bracket) => boolean' is not assignable to type '(bracket: Bracket) => bracket is {...}'. Signature ... must be a type predicate.` A plain boolean-returning arrow function cannot be assigned to a variable annotated with a predicate signature -- the predicate must be declared directly on the function's own `@param`/`@returns` tags for TypeScript's checked-JS mode to recognize it as a genuine type guard. Fixed immediately, confirmed by a clean `npx tsc` run before any test was executed (Rule 3 -- a blocking compile error, not a design change).
- **The docstring documenting the `noUncheckedIndexedAccess` narrowing rationale does not repeat the literal text `taxParamsByYear[2025]` a second time.** `fjs/tax/table/module.f.js`'s own docstring already established this phrasing precedent ("indexing the lookup map below by the literal year"); mirroring it here keeps `grep -c "taxParamsByYear\[2025\]"` at exactly 1 -- the single narrowing site -- rather than counting a second, merely descriptive occurrence in prose.
- **The independence discipline is documented by file path and by description, never by the literal identifier names `generateRow`/`cumulativeBracketTaxCents`.** The plan's action text names both functions explicitly when describing what NOT to share a code path with, but this module's own acceptance criteria require `grep -n "cumulativeBracketTaxCents\|generateRow" fjs/tax/boundary/module.f.js` to return no output -- including in comments. The module's docstring and `segmentIndex`'s own comment describe the discipline by reference to `fjs/tax/table/module.f.js`'s "own tax-computation and row-generation functions" rather than by naming the two functions verbatim, satisfying both the plan's intent (explicit, load-bearing documentation of the independence property) and the hard verification grep.

## Deviations from Plan

### Process Deviation (not a Rule 1-4 code deviation)

**Both tasks landed in a single commit (`6c5533e`) instead of two.**
- **What happened:** Task 1 (the classifier and inventory) and Task 2 (the generated proof) are two tightly-coupled halves of one 236-line module -- the proof's own correctness depends on `allThresholds`/`segmentIndex` being right, so both were drafted and verified together (`npx tsc`, then `npm test`) before the first commit was made, rather than committing Task 1 alone (verified only by `npx tsc`, per its own `<verify>` block) and then adding Task 2 in a second commit.
- **Impact:** None on correctness or verifiability -- `git log` shows one commit containing both tasks' code, `npx tsc` and `npm test` both pass, and every acceptance-criteria grep for both tasks was run and confirmed (see Verification Output below) against the final state. The only difference from the plan's literal expectation is that Task 1's own `<verify>npx tsc</verify>` step was satisfied by the same commit that also contains Task 2's proof, rather than by an intermediate commit containing only Task 1's code.
- **Files affected:** `fjs/tax/boundary/module.f.js`
- **Commit:** `6c5533e`

### Auto-fixed Issues

**1. [Rule 3 - Blocking issue] `hasDefinedCeiling`'s type predicate needed to be declared via `@param`/`@returns`, not `@type`**
- **Found during:** first `npx tsc` run after drafting Task 1
- **Issue:** `TS2322: Type '(bracket: Bracket) => boolean' is not assignable to type '(bracket: Bracket) => bracket is {...}'. Signature ... must be a type predicate.` -- a `@type`-annotated arrow function cannot satisfy a type-predicate signature; TypeScript requires the predicate declared directly on the function.
- **Fix:** Rewrote the JSDoc as `@param {Bracket} bracket` / `@returns {bracket is {...}}` directly above the function, which TypeScript's checked-JS mode recognizes as a genuine type guard.
- **Files modified:** `fjs/tax/boundary/module.f.js`
- **Commit:** `6c5533e`

## Issues Encountered

None beyond the one auto-fixed compile error above, caught immediately by `npx tsc` before any test run.

## User Setup Required

None -- no external service configuration required.

## Verification Output

```
$ npx tsc
(no output, exit 0)

$ npm test
...
ℹ tests 239
ℹ pass 239
ℹ fail 0

$ node --test 2>&1 | grep -c '^✔ import("./fjs/'
237   # 194 (baseline after Plan 08-02) + 43 (42 generated threshold leaves + everyThresholdIsCovered)

$ git status --porcelain
(empty)

$ git log --oneline -3
6c5533e feat(08-03): generic boundary classifier and combined threshold inventory
6f4492c docs(08-02): complete Tax Table generator and mutation-verified diff plan
3cfd1cf test(08-02): row-by-row diff, tiling proof, and the $100,000 refusal boundary

$ grep -n "cumulativeBracketTaxCents\|generateRow" fjs/tax/boundary/module.f.js
(empty -- confirms the boundary module shares no code path with the table's own tax computation)
```

Acceptance-criteria greps on the final module:
- `grep -c "export const allThresholds"` -> 1
- `grep -c "export const segmentIndex"` -> 1
- `grep -n "const taxParams2025 = taxParamsByYear\[2025\]"` -> line 68, present
- `grep -c "taxParamsByYear\[2025\]"` -> 1 (exactly 1 -- the single narrowing site)
- `grep -n "Object.fromEntries\|\.reduce("` -> shows the proof object is generated (`Object.fromEntries` at line 186), not hand-written
- Manual count of `allThresholds` by label prefix (via `node -e "import(...)"`, since the labels are template literals and do not appear as literal quoted text for a static grep): `{ ordinaryBracket: 27, capitalGainsBreakpoint: 10, taxTableBand: 5 }`, total 42 -- matches `expectedThresholdCount` exactly. (The plan's suggested `grep -c "'ordinaryBracket:\|\"ordinaryBracket:"` returns 0 against this file because labels are built with template-literal backticks, not single/double-quoted string concatenation -- the plan's own example action text uses backtick template literals for these labels, so the quote-character grep it also suggests cannot match; the programmatic count above is the actual confirmation.)

## Next Phase Readiness

`fjs/tax/boundary/module.f.js` exports `segmentIndex`, `allThresholds`, and `expectedThresholdCount`, plus the generated `proof` satisfying TAX-04. No blockers for 08-04 (the `finance_tax_params` MCP tool), which consumes `fjs/tax/params`/`fjs/tax/table` directly and has no dependency on this boundary module's exports.

---
*Phase: 08-ty2025-parameters-and-the-tax-table-as-data*
*Completed: 2026-08-05*

## Self-Check: PASSED

- FOUND: fjs/tax/boundary/module.f.js
- FOUND: commit 6c5533e (feat(08-03): generic boundary classifier and combined threshold inventory)
