---
phase: 12-brokerage-documents-and-the-capital-gain-chain
plan: 01
subsystem: document
tags: [fjs, rtti, dialect, 1099-div, dividends, qdcgt, provenance]

# Dependency graph
requires:
  - phase: 11
    provides: the 1099-R dialect (fjs/document/1099r/module.f.js) as the six-stage template this plan copies verbatim
  - phase: 10
    provides: fjs/tax/line16/qdcgt/module.f.js (QDCGT worksheet, QdcgtInput shape) — read only, never modified or called at runtime
provides:
  - vnd.fjs.1099div document dialect (DOC-06): full printed 1099-DIV box list, structural + semantic validation, own proof suite
  - sourceArtifactHash provenance field (DOC-13 precursor) on a new dialect, required and isHash-validated, without widening the shared base() helper
  - A compile-time + runtime shape proof that box 1b's converted cents value matches QdcgtInput['line2Cents'] exactly, with zero runtime coupling to fjs/tax/, fjs/return/, or fjs/form1040/
affects: [12-02, 12-1-brokerage-capital-gain-chain]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Six-stage dialect template (dialect -> mediaType -> schema -> structural validate -> semantic checkReferences -> composed validate), copied verbatim from fjs/document/1099r/module.f.js"
    - "Generated-proof-from-list + independently-hand-typed-count idiom, applied to a 17-field moneyBoxFields list and a 1-field stateLocalMoneyFields list"
    - "Type-only JSDoc @import of a non-exported bare @typedef across module boundaries (verified live: tsc resolves QdcgtInput from fjs/tax/line16/qdcgt/module.f.js even though it carries no `export` keyword)"

key-files:
  created:
    - fjs/document/1099div/module.f.js
  modified: []

key-decisions:
  - "sourceArtifactHash is a required (non-option) plain string field on this dialect only, not a widening of fjs/document/base's shared base() helper — per 12-RESEARCH.md's Alternatives Considered, to avoid forcing the field onto every already-shipped dialect."
  - "Box 8 (foreign country/possession) is modeled as free text and explicitly excluded from moneyFieldError and moneyBoxFields, with a dedicated proof of the exemption (mirroring 1099-R's percentage-box exemption leaf)."
  - "The DOC-06 shape proof uses a JSDoc @import type-only reference to QdcgtInput (compiles to nothing at runtime) plus a runtime assertEq on the converted cents value — no runtime import of the QDCGT worksheet, dispatch function, scope-classification function, or income-line aggregator. This plan does no wiring; that is Phase 12.1's job per 12-CONTEXT.md's AMENDED 2026-08-07 resolution."
  - "stateEntry (boxes 14-16) is a smaller shape than 1099-R's stateLocalEntry — state-only, no locality fields — because 1099-DIV genuinely has no locality boxes on the printed form."

requirements-completed: [DOC-06]

# Metrics
duration: ~20min
completed: 2026-08-08
---

# Phase 12 Plan 01: vnd.fjs.1099div dialect Summary

**New `vnd.fjs.1099div` document dialect storing the full printed 1099-DIV box list plus a required `sourceArtifactHash` provenance field, with a compile-time-and-runtime proof that box 1b's converted value has exactly the shape the already-shipped QDCGT worksheet expects — no wiring, no runtime coupling to `fjs/tax/`, `fjs/return/`, or `fjs/form1040/`.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-08-08T02:04:00Z (approx.)
- **Completed:** 2026-08-08T02:24:02Z
- **Tasks:** 2 completed (Task 1: build the dialect; Task 2: Mutation Gate M1)
- **Files modified:** 1 (created)

## Accomplishments
- `fjs/document/1099div/module.f.js` created: full printed box inventory (boxes 1a-13, plus state-only 14-16), following `fjs/document/1099r/module.f.js`'s exact six-stage template.
- `sourceArtifactHash` (DOC-13) added as a required, `isHash`-validated field — the first field of its kind in this codebase, deliberately not generalized into the shared `base()` helper this phase.
- DOC-06's stated shape requirement proven: box 1b's converted cents value has exactly the type `QdcgtInput['line2Cents']` expects, via a `tsc`-enforced JSDoc `@import` type-only reference plus a runtime `assertEq`.
- Mutation Gate M1 run and watched RED, then GREEN again, with the file restored byte-for-byte to its committed state.
- Project-local proof count rose from 544 (baseline) to 576 (+32), `npx tsc --noEmit` exits 0, full `npm test` green (2814 pass, 0 fail).

## Task Commits

Each task was committed atomically:

1. **Task 1: `vnd.fjs.1099div` — the full printed box inventory plus sourceArtifactHash (DOC-06)** - `b8823db` (feat)
2. **Task 2: Mutation Gate M1 — prove the hand-typed money-box count is load-bearing (BLOCKING)** - no separate commit; the mutation was applied and then restored to a byte-identical state (`git diff fjs/document/1099div/module.f.js` against `b8823db` is empty), so there is no net change to commit. Full evidence recorded below.

**Plan metadata:** (this commit, following this SUMMARY)

## Files Created/Modified
- `fjs/document/1099div/module.f.js` - the `vnd.fjs.1099div` dialect: schema, `checkReferences`, `validate`, and its own `proof` suite (32 proof leaves).

## Mutation Gate M1 — full recorded evidence (BLOCKING, Task 2)

**Step 1 — mutate.** Removed the single array entry `'box6InvestmentExpenses',` from `moneyBoxFields` (leaving the independently hand-typed `expectedMoneyBoxFieldCount = 17` UNCHANGED, per the plan's explicit instruction — changing both would make the counts agree again and prove nothing).

**Step 2 — confirm RED.** Ran the full commands specified in the plan's `<verify>` block:

```
$ npx tsc --noEmit
(exit 0 — the mutation still typechecks, as required by AGENTS.md's mutation discipline)

$ node --test 2>&1 | grep -c '^✔ import("./fjs/'
574
```

Count dropped from the post-Task-1 baseline of **576** to **574** — a drop of 2: the removed field's own generated leaf (`checkReferences.moneyBoxExactness.box6InvestmentExpenses`) disappeared silently (proving the danger AGENTS.md names — a proof that iterates a shrunken list stays green over the shrinkage itself), and the independently-hand-typed-count leaf went RED, which is the gate actually firing.

The specific failing leaf, captured via `node --test --test-reporter=tap`:

```
# Subtest: import("./fjs/document/1099div/module.f.js").proof.checkReferences.moneyBoxExactness.everyMoneyBoxIsCovered() ...
not ok 25 - import("./fjs/document/1099div/module.f.js").proof.checkReferences.moneyBoxExactness.everyMoneyBoxIsCovered() ...
  ---
  duration_ms: 0.228333
  type: 'test'
  failureType: 'testCodeFailure'
  error: |-
    [
      16,
      17,
      [
        'expected exactly the independently-stated money box count',
        16,
        17
      ]
    ]
  code: 'ERR_TEST_FAILURE'
  ...
```

`moneyBoxFields.length` (16, after removal) !== `expectedMoneyBoxFieldCount` (17, hand-typed and untouched) — exactly the assertion the plan predicted would fire, firing.

**Step 3 — restore exactly.** Re-inserted `'box6InvestmentExpenses',` at its original array position (between `'box5Section199ADividends',` and `'box7ForeignTaxPaid',`) — verified against the committed Task 1 state via `git diff fjs/document/1099div/module.f.js`, which returned **empty** (byte-identical restoration, not a retype from memory). Re-ran:

```
$ npx tsc --noEmit
(exit 0)

$ node --test 2>&1 | grep -c '^✔ import("./fjs/'
576
```

576 — equal to the count recorded at the end of Task 1, confirming full restoration.

**Step 4 — confirm clean tree.**

```
$ git diff fjs/document/1099div/module.f.js
(empty — no output)

$ grep -n "expectedMoneyBoxFieldCount = 17" fjs/document/1099div/module.f.js
194:const expectedMoneyBoxFieldCount = 17
```

`git status --porcelain` at this point showed only the pre-existing `M .planning/STATE.md` modification, present before this plan's execution began (STATE.md is updated separately as part of this plan's own state-update step, not a stray leftover from the mutation/restore cycle) — no residue from the mutation gate on the touched dialect file.

**Step 5 — this section is that record.**

## Decisions Made

- `sourceArtifactHash` declared as a required plain `string` (not `option(string)`) — every real 1099-DIV instance is extracted from some artifact, and this is a brand-new dialect with no legacy stored instances to preserve compatibility with. Validated via `isHash` from `functionalscript/fjs/media/revision/module.f.js`, the same function `fjs/cas/evo` already trusts for hash-shaped strings.
- Deliberately did NOT widen `fjs/document/base`'s shared `base()` helper to add this field — per 12-RESEARCH.md's Alternatives Considered, that would force a required field onto every already-shipped dialect (1099-INT, W-2, 1099-R, SSA-1099, medical expenses, return profile).
- `stateEntry` (boxes 14-16) intentionally has no locality fields, unlike 1099-R's `stateLocalEntry` — 1099-DIV's printed form genuinely has no locality boxes; documented explicitly in the module docstring as a real form difference, not an omission.
- The DOC-06 shape proof (`proof.qdcgtInputShape`) is the ENTIRE discharge of DOC-06's "exactly the shape" requirement, per the plan's explicit instruction not to add a second proof calling into the QDCGT worksheet or its dispatcher — that would re-prove Phase 10's already-shipped arithmetic, not this phase's new claim, and would encroach on Phase 12.1's wiring work.
- The plan's own acceptance-criteria greps are LITERAL string matches, not just intent checks. Two fixture/docstring passages initially collided with them (see Deviations below) and were reworded to preserve identical meaning without the literal forbidden substrings.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixture string for box 8 collided with the plan's literal acceptance-criteria grep**
- **Found during:** Task 1, self-verification against the plan's stated acceptance criteria
- **Issue:** The plan requires `grep -n "box8ForeignCountryOrUsPossession" ... | grep "moneyFieldError"` to return nothing (box 8 must never appear on the same source line as `moneyFieldError`). The `box8AcceptsNonNumericTextWithoutExactnessCheck` proof's fixture string literally contained the word "moneyFieldError" as documentation text, on the same line as the `box8ForeignCountryOrUsPossession:` key, tripping the literal grep even though no actual coupling existed.
- **Fix:** Reworded the fixture string to `'not a number at all: 1,234.567 (would fail the money-exactness check)'`, preserving the intended meaning (a non-numeric value with a comma-grouped-looking substring) without the literal substring `moneyFieldError`.
- **Files modified:** fjs/document/1099div/module.f.js
- **Verification:** `grep -n "box8ForeignCountryOrUsPossession" fjs/document/1099div/module.f.js | grep "moneyFieldError"` now returns nothing; the proof still passes.
- **Committed in:** b8823db (Task 1 commit)

**2. [Rule 1 - Bug] Module docstring literally named the three forbidden runtime imports**
- **Found during:** Task 1, self-verification against the plan's stated acceptance criteria
- **Issue:** The plan requires `grep -n "dispatchLine16\|fjs/return/scope\|fjs/form1040/core" fjs/document/1099div/module.f.js` to return NOTHING. The module docstring, in the course of explaining what this file does NOT import, spelled out the literal names `dispatchLine16`, `classifyScope`, and `form1040IncomeLines` — true and accurate prose, but it tripped the literal grep meant to catch an actual coupling.
- **Fix:** Reworded the docstring to describe the same three functions by role ("no worksheet-selection function, no scope-classification function, no income-line aggregator") instead of by literal name, and added a sentence explaining why the names are deliberately not repeated in this file's own text.
- **Files modified:** fjs/document/1099div/module.f.js
- **Verification:** `grep -n "dispatchLine16\|fjs/return/scope\|fjs/form1040/core" fjs/document/1099div/module.f.js` now returns nothing; `grep -n "QdcgtInput"` still matches (the type-only shape assertion is unaffected).
- **Committed in:** b8823db (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1 — bugs in this plan's own draft text colliding with its own literal verification commands, not defects in the dialect's actual behavior).
**Impact on plan:** Both fixes are wording-only; no schema, validation, or proof-logic changes. No scope creep.

## Issues Encountered

None beyond the two deviations above. The type-only `@import { QdcgtInput } from '../../tax/line16/qdcgt/module.f.js'` was independently verified live before writing the module: a scratch file confirmed `tsc --noEmit` resolves a bare (non-`export`-marked) `@typedef` across a module boundary via `@import`, with zero runtime coupling — this generalizes a pattern not previously used elsewhere in this codebase.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `vnd.fjs.1099div` exists, validates, and is provably shape-compatible with the QDCGT worksheet's input — ready for Phase 12.1 to wire `qualifiedDividends`/`ordinaryDividends` into the return-scope guard and Form 1040 lines 3a/3b atomically, per 12-CONTEXT.md's AMENDED resolution.
- The `sourceArtifactHash` field and the `'deadbeef00112233445566778899aabbccddeeff0011223344556677889900'` fixture literal are in place for 12-02's DOC-13 cross-dialect provenance proof to reuse directly.
- This dialect is NOT YET registered in `fjs/server/finance_schema/module.f.js`'s `dialectSchemas` registry — that atomic 7->9 registration (per 12-CONTEXT.md's Standing Constraints) is out of this plan's stated scope (`files_modified: [fjs/document/1099div/module.f.js]` only) and belongs to whichever later plan in this phase performs that registration alongside `vnd.fjs.1099b`.
- `fjs/return/scope`, `fjs/form1040/core`, and everything under `fjs/tax/**` are verified untouched (`git diff --stat HEAD~1 HEAD -- fjs/return/scope fjs/form1040/core fjs/tax` is empty).

## Self-Check: PASSED

- `fjs/document/1099div/module.f.js` — FOUND (verified via `git ls-tree HEAD fjs/document/1099div/`, blob `6be5a19ae8e558cd8e354d117bf9b4a913d07d59`)
- Commit `b8823db` — FOUND (`git log --oneline --all | grep b8823db` matches)
- `npx tsc --noEmit` — exit 0, verified live
- `node --test 2>&1 | grep -c '^✔ import("./fjs/'` — 576, verified live (baseline 544, risen)
- `npm test` full suite — 2814 pass, 0 fail, verified live
- `git status --porcelain` — clean for the touched file; only the pre-existing STATE.md modification remains, addressed by this plan's own state-update step

---
*Phase: 12-brokerage-documents-and-the-capital-gain-chain*
*Completed: 2026-08-08*
