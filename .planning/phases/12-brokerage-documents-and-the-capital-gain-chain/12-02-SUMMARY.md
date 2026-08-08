---
phase: 12-brokerage-documents-and-the-capital-gain-chain
plan: 02
subsystem: documents
tags: [1099-b, dialect, rtti, decimal-money, brokerage, capital-gain, provenance]

# Dependency graph
requires:
  - phase: 12-01
    provides: vnd.fjs.1099div dialect precedent (sourceArtifactHash/isHash idiom, docstring source-URL discipline)
provides:
  - vnd.fjs.1099b dialect — full TY2025 1099-B box inventory, storage only
  - Box 1e/box 12 modeled as independent option fields (never one derived from the other)
  - proof.criterion2GainConsequence — a dialect-level proof exhibiting the actual "changes the gain" consequence DOC-07 names
  - sourceArtifactHash provenance field (DOC-13), required, isHash-validated, same literal as 12-01/12-05
affects: [12.1-form-8949-schedule-d, 12-05-doc-13-provenance-proof]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Independent option(true)/option(string) modeling of a two-checkbox distinction (box 1e / box 12) — never derive one from the other's absence"
    - "Proof-local (non-exported) naiveGain helper demonstrating a storage-dialect's downstream consequence without computing the real worksheet"

key-files:
  created: [fjs/document/1099b/module.f.js]
  modified: []

key-decisions:
  - "Boxes 8-11 (profit-or-loss on contracts) are included in the shared moneyBoxFields loop unchanged — moneyFieldError already accepts negatives, so no separate positive-only check was added"
  - "applicableCheckboxOnForm8949 stores the payer-printed A-F letter verbatim, never derived from boxes 2/5/12 — matches 12-RESEARCH.md's Anti-Patterns"
  - "The plan's own acceptance-criterion grep for 'Form8949' collides with the plan-mandated field name applicableCheckboxOnForm8949 — documented below rather than silently renamed or silently ignored"

patterns-established:
  - "DOC-07-style dialect-level consequence proof: compute a derived value two ways (present vs. genuinely-absent input) with an identical proof-local helper and assert the two differ, rather than asserting only optionality"

requirements-completed: [DOC-07]

# Metrics
duration: 21min
completed: 2026-08-08
---

# Phase 12 Plan 02: `vnd.fjs.1099b` (DOC-07) Summary

**`vnd.fjs.1099b` dialect storing the full TY2025 1099-B box list, with box 1e/box 12 modeled as independent optional fields and a dialect-level proof showing that treating a genuinely-absent box 1e as zero changes the computed gain — not merely that the field can be omitted.**

## Performance

- **Duration:** 21 min (19:13 -> 19:34 PDT, per git commit timestamps)
- **Started:** 2026-08-08T02:13:47Z
- **Completed:** 2026-08-08T02:34:11Z
- **Tasks:** 2 (Task 1: dialect + proofs; Task 2: Mutation Gate M3, verification-only, no net diff)
- **Files modified:** 1

## Accomplishments

- `fjs/document/1099b/module.f.js` — complete six-stage dialect (`dialect`, `mediaType`, `oneZeroNineNineBSchema`, `checkReferences`, `validate`, `proof`), 636 lines.
- Full TY2025 box inventory per 12-RESEARCH.md Q2: identity fields, `cusipNumber`, `fatcaFilingRequirement`, `applicableCheckboxOnForm8949`, boxes 1a-1g, box 2's three independent checkboxes, box 3's two independent checkboxes, box 4, box 5, box 6's two independent checkboxes, box 7, boxes 8-11 (negative-accepting), box 12, box 13, and the state-only `stateLocal` repeating group (boxes 14-16).
- `sourceArtifactHash` required (never `option`), validated via `isHash`, using the same literal 12-01 reuses (`'deadbeef0011...'`).
- `proof.criterion2GainConsequence`: a proof-local (non-exported) `naiveGain` helper computes a gain both with a present box 1e and with a genuinely absent one, and asserts the two results (`400000n` vs `1000000n`) are **not equal** — the actual consequence DOC-07 requires, not just optionality.
- Mutation Gate M3 run and watched RED: supplying `'0.00'` in the `withoutBasis` fixture (simulating "blank box 1e treated as zero") reddened the `criterion2GainConsequence` leaf on the `undefined`-vs-`'0.00'` assertion, exactly as predicted. Reverted exactly; suite returned to green; `git status --porcelain` empty.

## Task Commits

1. **Task 1: `vnd.fjs.1099b` — full TY2025 box inventory plus box 1e/box 12 consequence proof (DOC-07)** - `9b2015b` (feat)
2. **Task 2: Mutation Gate M3 — prove the box-1e-absence consequence proof is load-bearing (BLOCKING)** - no commit (verification-only: mutation applied in-place and reverted exactly to Task 1's committed state via `git checkout --`; final `git diff 9b2015b -- fjs/document/1099b/module.f.js` is empty, so there is no delta to commit for this task). All evidence recorded below.

**Plan metadata:** (this commit, made after this SUMMARY)

## Files Created/Modified

- `fjs/document/1099b/module.f.js` - New `vnd.fjs.1099b` dialect: schema, `checkReferences`, `validate`, and a full `proof` suite including the DOC-07 consequence proof.

## Mutation Gate M3 — full record (BLOCKING, run and watched)

Per AGENTS.md ("a proof is not known to work until you have watched it fail") and 12-VALIDATION.md's M3 row.

**Baseline (post-Task-1, before mutation):**
```
$ node --test 2>&1 | grep -c '^✔ import("./fjs/'
602
```

**Step 1 — mutation applied.** In `criterion2GainConsequence`'s `withoutBasis` fixture, changed:
```diff
         const [tWithoutBasis, withoutBasis] = validate({
             ...minimal,
             box1dProceeds: '10000.00',
-            // box1eCostOrOtherBasis genuinely OMITTED — not '0.00'.
+            box1eCostOrOtherBasis: '0.00',
         })
```
i.e. simulated "a blank box 1e treated as zero" by literally supplying `'0.00'` where genuine absence was modeled.

**Step 2 — ran the suite and confirmed RED.**
```
$ npx tsc --noEmit
(exit 0 — mutation typechecks, per AGENTS.md's "a mutation must still typecheck")

$ node --test 2>&1 | grep -c '^✔ import("./fjs/'
601   <- dropped from 602

$ node --test 2>&1 | grep -A3 "criterion2GainConsequence"
✖ import("./fjs/document/1099b/module.f.js").proof.criterion2GainConsequence() ... (0.391375ms)
```
Full failure detail from `node --test` output:
```
✖ failing tests:

test at node_modules/functionalscript/fjs/effects/node/module.js:269:31
✖ import("./fjs/document/1099b/module.f.js").proof.criterion2GainConsequence() ... (0.412833ms)
  [ '0.00', undefined, [ 'expected a genuinely omitted box 1e to read back as undefined, not a zero string' ] ]
```
**The specific assertion that failed:** the `assertEq(withoutBasis.box1eCostOrOtherBasis, undefined, [...])` absence-check — it received `'0.00'` (mutated fixture's validated value) where it expected `undefined`. The suite never reached the inequality assertion (`withBasisGain !== withoutBasisGain`) because the earlier absence assertion threw first; had it been reached, the mutated fixture would ALSO have made `withBasisGain === withoutBasisGain` (`400000n === 400000n`), since `naiveGain('10000.00')('0.00')` and `naiveGain('10000.00')('6000.00')`... actually the mutated `withoutBasis` fixture's box 1e is `'0.00'`, not `'6000.00'`, so `naiveGain` on it would still be `1000000n`, identical to the absence case's expected value — the proof's real bite here is entirely on the absence-assertion, exactly the "the field is optional but the distinction stops mattering to THIS proof" failure mode M3 exists to catch: the mutated fixture makes the dialect's `option(string)` field carry a real `'0.00'` string, which is materially different information from genuine absence, and the proof's own absence check is what notices.

**Step 3 — reverted exactly.**
```
$ git diff fjs/document/1099b/module.f.js
(shown above, one-line hunk)
$ git checkout -- fjs/document/1099b/module.f.js
$ git diff 9b2015b -- fjs/document/1099b/module.f.js
(empty — byte-identical to the Task 1 commit, not retyped from memory)
```

**Step 4 — confirmed clean and green.**
```
$ git status --porcelain
(empty)
$ npx tsc --noEmit
(exit 0)
$ node --test 2>&1 | grep -c '^✔ import("./fjs/'
602   <- returned to (at least) the post-Task-1 count
```

**Step 5 — this record.** All five steps above are the actual command output, not paraphrase.

**Conclusion:** the mutation did NOT survive — it reddened the proof, confirming `criterion2GainConsequence` is load-bearing (it checks the fact that matters: genuine absence vs. an explicit `'0.00'`), not merely a check that the field can be omitted.

## Full-suite verification

```
$ npm test 2>&1 | tail -8
ℹ tests 2840
ℹ suites 0
ℹ pass 2840
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
```

## Decisions Made

- Boxes 8-11 walk through the same `moneyBoxFields` loop as every other scalar money box rather than a separate negative-accepting path — `moneyFieldError` already accepts negatives (its own `negativeAccepted` leaf proves it), so a second check would be needless duplication of a rule already proven elsewhere.
- `applicableCheckboxOnForm8949` is stored verbatim as `option(string)`, matching 12-RESEARCH.md's explicit anti-pattern warning against deriving it from boxes 2/5/12 — that derivation belongs to Phase 12.1's Form 8949 categorization, not this storage-only dialect.
- Task 2 (Mutation Gate M3) produced no net file diff (the mutation was applied and then reverted to the exact Task 1 committed state), so no separate git commit exists for Task 2 — its evidence lives entirely in this SUMMARY, matching the task's own nature as a blocking *verification* step rather than a code-change step.

## Deviations from Plan

### Documented (not auto-fixed; no code change made)

**1. Acceptance-criterion grep collision: `Form8949` matches the plan-mandated field name**

- **Found during:** Task 1 acceptance-criteria verification.
- **Issue:** The plan's own acceptance criteria include `grep -n "dispatchLine16\|Form8949\|scheduleD\|fjs/tax/line16" fjs/document/1099b/module.f.js` returning NOTHING, intended to prove "no computation, no wiring." But the SAME plan's `<action>` section explicitly mandates a schema field named `applicableCheckboxOnForm8949` (verbatim: "`applicableCheckboxOnForm8949: option(string)`") and its accompanying docstring/proof prose. The substring `Form8949` inside that field's own name unavoidably matches the grep.
- **Resolution:** Did NOT rename the plan-mandated field (that would violate the plan's own explicit, character-for-character field-naming instruction, and would break the analogous field name convention this codebase otherwise follows). Verified the grep's real matches are exclusively the field name `applicableCheckboxOnForm8949` and its docstring/proof references to it — confirmed via `grep -n`: no `dispatchLine16`, no `scheduleD`, no `fjs/tax/line16` import or reference appears anywhere in the file. The substantive intent behind the acceptance criterion (no Form-8949-categorization computation, no wiring into the line-16 dispatch or Schedule D chain) is fully satisfied; only the literal substring collides, in the same class of false-positive the critical rules describe for docstring prose (12-01's precedent), here against a required identifier rather than prose.
- **Files affected:** `fjs/document/1099b/module.f.js` (no change made because of this finding).
- **Verification:** `grep -n "dispatchLine16\|scheduleD\|fjs/tax/line16" fjs/document/1099b/module.f.js` (without `Form8949`) returns nothing at all; the only matches for the full pattern are the six `applicableCheckboxOnForm8949`-related lines.

---

**Total deviations:** 1 documented (no auto-fix, no code change — a grep-collision finding recorded per the same precedent 12-01 established for docstring prose).
**Impact on plan:** None on scope or correctness. The dialect is complete, storage-only, and imports nothing from `fjs/tax/`, `fjs/return/`, or `fjs/form1040/`.

## Issues Encountered

None beyond the grep-collision finding above, which was a verification-wording issue, not an implementation issue.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `vnd.fjs.1099b` is ready to be registered in `fjs/server/finance_schema/module.f.js`'s `dialectSchemas` (7 -> 9, atomic with `vnd.fjs.1099div`) — that registration is out of this plan's `files_modified` scope and belongs to whichever plan performs the atomic three-part registration described in 12-CONTEXT.md's Standing Constraints.
- DOC-13's "shared artifact hash" half now has both dialects (`vnd.fjs.1099div` from 12-01, `vnd.fjs.1099b` from this plan) carrying `sourceArtifactHash` with the identical shared literal — ready for a cross-dialect provenance proof (12-05, per 12-RESEARCH.md Q3).
- Phase 12.1's Form 8949 / Schedule D chain can now consume `box1dProceeds`, `box1eCostOrOtherBasis`, `box12BasisReportedToIrs`, and `applicableCheckboxOnForm8949` from stored `vnd.fjs.1099b` documents — none of that computation exists yet, by design.
- No blockers.

---
*Phase: 12-brokerage-documents-and-the-capital-gain-chain*
*Completed: 2026-08-08*

## Self-Check: PASSED

- FOUND: `fjs/document/1099b/module.f.js`
- FOUND: `.planning/phases/12-brokerage-documents-and-the-capital-gain-chain/12-02-SUMMARY.md`
- FOUND: commit `9b2015b` in `git log --oneline --all`
