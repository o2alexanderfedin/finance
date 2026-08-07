---
phase: 10-form-1040-core-line-16-dispatch-and-the-scope-guard
plan: 01
subsystem: tax
tags: [filing-status, qss, ty2025-parameters, phase-10, tax-06]

requires:
  - phase: 08
    provides: "fjs/tax/params/module.f.js — IndividualFilingStatus/FilingStatus, the three Record<FilingStatus, …> parameter exports and their per-parameter Rev. Proc. citations"
  - phase: 08
    provides: "fjs/tax/boundary/module.f.js — allThresholds generated from allFilingStatuses, and the hand-typed expectedThresholdCount that is deliberately not allThresholds.length"
  - phase: 08
    provides: "fjs/server/finance_tax_params/module.f.js — the served TY parameter response and year2025Resolves' hand-typed expectations"
provides:
  - "fjs/tax/params/module.f.js — qualifyingSurvivingSpouse as a real IndividualFilingStatus member, with its own standardDeduction, ordinaryBrackets and capitalGainsBreakpoints rows, each hand-typed from the governing Rev. Proc. table"
  - "qssParametersEqualMfjAndAreStoredIndependently — a field-by-field QSS/MFJ equality leaf layered on top of the primary-source expectations, catching an edit that updates one status and forgets the other"
  - "fjs/tax/boundary/module.f.js — expectedThresholdCount 42 -> 50, with eight new boundary-triple leaves GENERATED, not written"
  - "fjs/server/finance_tax_params/module.f.js — QSS served, named in expectedStandardDeduction, and spot-checked at capitalGainsBreakpoints.qualifyingSurvivingSpouse.zeroRateMax off the response the tool actually serves"
affects: [10-03, 10-04, 10-05, 10-07, 10-09]

tech-stack:
  added: []
  patterns:
    - "Two statuses that read the SAME Rev. Proc. row are still stored twice, hand-typed twice, and expected twice. A spread would make a mutation to one silently move the other, so the drift the architecture exists to detect would be unrepresentable."
    - "A stored-vs-stored equality leaf is legitimate ONLY when layered on top of a primary-source expectation: it pins the relationship the source states, while the values stay pinned independently. The layering is what keeps it from being the tautology AGENTS.md warns about."
    - "A count assertion, not an expectation loop keyed by its own expectations, is what makes an OMITTED map entry visible. Mutation 2a below is the demonstration."

key-files:
  created: []
  modified:
    - fjs/tax/params/module.f.js
    - fjs/tax/boundary/module.f.js
    - fjs/server/finance_tax_params/module.f.js

key-decisions:
  - "QSS's parameters are transcribed independently rather than spread from MFJ, per the plan's own reasoning and the existing single/marriedFilingSeparately precedent in the same module."
  - "The 'Publication 1040 prints four columns' docstrings were corrected rather than deleted: the QSS -> MFJ Tax Table column mapping is named as taxTableColumnFor in fjs/tax/table (Plan 10-03), so the assumption has an owner instead of being implicit."
  - "The stale '42 manually authored keys' phrase in fjs/tax/boundary's generatedThresholdProof docstring was updated to 50 — one comment beyond the plan's explicit list, because leaving it would have shipped a false count statement."

metrics:
  duration: "~25 min"
  completed: 2026-08-06
  tasks_completed: 2
  mutations_run: 5
  proof_leaves_before: 318
  proof_leaves_after: 327
---

# Phase 10 Plan 01: qualifyingSurvivingSpouse as a Stored Filing Status Summary

`qualifyingSurvivingSpouse` is now a first-class `IndividualFilingStatus` with three
independently hand-typed TY2025 parameter rows, and the `Record<FilingStatus, …>` fan-out it
forces has been absorbed across `fjs/tax/boundary` (42 -> 50 thresholds, all eight new leaves
generated) and `fjs/server/finance_tax_params` — with all five mutations run and observed.

## Measured proof-leaf counts

`node --test 2>&1 | grep -c '^✔ import("./fjs/'`, never `npm test`'s total (AGENTS.md).

| Point | Project-local ✔ leaves | `npm test` |
|---|---|---|
| Baseline (before this plan) | **318** | 320/320, exit 0 |
| After Task 1 | 325 | 327/329, **2 fail** — see "Plan defects found" |
| After Task 2 (this plan, in isolation) | **327** | 329/329, exit 0 |
| Real shared worktree, after Plan 10-02 also landed | 334 | 336/336, exit 0 |

318 -> 327 is +9, exactly the plan's own `<verification>` figure: 8 generated threshold leaves
plus 1 new params leaf.

The eight generated leaves, none of them hand-written, all green:

```
✔ …/tax/boundary/module.f.js").proof["ordinaryBracket:qualifyingSurvivingSpouse:23850.00"]()
✔ …/tax/boundary/module.f.js").proof["ordinaryBracket:qualifyingSurvivingSpouse:96950.00"]()
✔ …/tax/boundary/module.f.js").proof["ordinaryBracket:qualifyingSurvivingSpouse:206700.00"]()
✔ …/tax/boundary/module.f.js").proof["ordinaryBracket:qualifyingSurvivingSpouse:394600.00"]()
✔ …/tax/boundary/module.f.js").proof["ordinaryBracket:qualifyingSurvivingSpouse:501050.00"]()
✔ …/tax/boundary/module.f.js").proof["ordinaryBracket:qualifyingSurvivingSpouse:751600.00"]()
✔ …/tax/boundary/module.f.js").proof["capitalGainsBreakpoint:qualifyingSurvivingSpouse:zeroRateMax"]()
✔ …/tax/boundary/module.f.js").proof["capitalGainsBreakpoint:qualifyingSurvivingSpouse:fifteenRateMax"]()
```

## Tasks

| Task | Commit | Files |
|---|---|---|
| 1 — qualifyingSurvivingSpouse becomes a stored filing status | `c531b27` | `fjs/tax/params/module.f.js` |
| 2 — absorb the fan-out: boundary thresholds and the served response | `cabb4a2` | `fjs/tax/boundary/module.f.js`, `fjs/server/finance_tax_params/module.f.js` |

Task 1 acceptance greps: `grep -c "qualifyingSurvivingSpouse" fjs/tax/params/module.f.js` = **13**
(>= 8 required); the no-spread grep = **0**.
Task 2 acceptance grep: `grep -v '^ *[*/]' fjs/tax/boundary/module.f.js | grep -c
"expectedThresholdCount = 50"` = **1**.

## Mutation transcripts

Every mutation was applied one at a time, `tsc`-verified, run, and reverted. `git diff --numstat`
is shown for each, because once a proof hand-types an expected value that literal exists twice in
the file and a careless edit changes both.

### Task 1, mutation 1 — QSS `zeroRateMax` `'96700.00'` -> `'96750.00'` — RED, as predicted

```
=== numstat: 1	1	fjs/tax/params/module.f.js
-        zeroRateMax: '96700.00',
+        zeroRateMax: '96750.00',
TSC CLEAN
✖ …/tax/params/module.f.js").proof.everyCapitalGainsBreakpointMatchesRevProc202440Section203()
  [ '96750.00', '96700.00', [ 'zero-rate max mismatch', 'qualifyingSurvivingSpouse' ] ]
✖ …/tax/params/module.f.js").proof.qssParametersEqualMfjAndAreStoredIndependently()
  [ '96750.00', '96700.00', 'QSS/MFJ zero-rate max drift' ]
```

Both predicted leaves failed, each naming the offending status by name rather than merely
throwing. (Two further failures in that run — `everyThresholdIsCovered` `[50, 42]` and
`year2025Resolves` `[6, 5]` — are the Task-2-pending count mismatches described under "Plan
defects found", not mutation effects.)

### Task 1, mutation 2 — QSS `brackets[1].ceiling` `'96950.00'` -> `'96900.00'` — RED, as predicted

```
=== numstat: 1	1	fjs/tax/params/module.f.js
-            { ratePercent: 12, ceiling: '96950.00' },
+            { ratePercent: 12, ceiling: '96900.00' },
TSC CLEAN
✖ …/tax/params/module.f.js").proof.everyOrdinaryBracketMatchesRevProc202440Tables1Through5()
  [ '96900.00', '96950.00', [ 'bracket ceiling mismatch', 'qualifyingSurvivingSpouse', 1 ] ]
✖ …/tax/params/module.f.js").proof.qssParametersEqualMfjAndAreStoredIndependently()
  [ '96900.00', '96950.00', [ 'QSS/MFJ bracket ceiling drift', 1 ] ]
```

The plan predicted only the first leaf. The second is a bonus, and it is the point of the new
leaf: an edit that moved QSS's ceiling would be caught twice over, once against the published
table and once against MFJ.

The `sed` targeted line 292 (QSS's stored data). The same `'96950.00'` literal also appears at
lines 238 (MFJ data), 500 and 536 (the two hand-typed expectations) — the `1 1` numstat is what
proves only one of those four was touched.

### Task 2, mutation 1 — `allFilingStatuses` drops a status — RED, as predicted

```
=== numstat: 1	1	fjs/tax/params/module.f.js
-export const allFilingStatuses = [...individualFilingStatuses, 'estatesAndTrusts']
+export const allFilingStatuses = [...individualFilingStatuses.slice(1), 'estatesAndTrusts']
TSC CLEAN
✖ …/tax/boundary/module.f.js").proof.everyThresholdIsCovered()
  [ 42, 50, [ 'expected exactly the independently-stated threshold count', 42, 50 ] ]
ℹ tests 321  ℹ pass 320  ℹ fail 1
```

Exactly 8 thresholds dropped (`single`'s six ceilings plus its two capital-gains breakpoints),
and the project-local leaf count fell 327 -> 318. This is T-10-01-02's mitigation observed
working: `expectedThresholdCount` is hand-typed and deliberately not `allThresholds.length`, so a
status silently dropped during assembly fails an explicit assertion rather than passing by
omission.

### Task 2, mutation 2a — delete the QSS `expectedStandardDeduction` entry — GREEN, as predicted

```
=== numstat: 0	1	fjs/server/finance_tax_params/module.f.js
-            qualifyingSurvivingSpouse: '31500.00',
TSC CLEAN
✔ …/server/finance_tax_params/module.f.js").proof.year2025Resolves()
ℹ tests 329  ℹ pass 329  ℹ fail 0     (project-local leaves unchanged at 327)
```

Deliberate evidence, not a failure. `year2025Resolves` iterates `Object.keys(expectedStandardDeduction)`,
so a status removed from the expectations disappears from the check itself. This is the exact gap
shape the length assertions exist to close.

(numstat is `0 1` rather than `1 1` because this mutation is a pure line deletion, not a
single-line replacement.)

### Task 2, mutation 2b — `Object.keys(ordinaryBrackets).length` `6` -> `5` — RED, as predicted

```
=== numstat: 1	1	fjs/server/finance_tax_params/module.f.js
-        assertEq(Object.keys(ordinaryBrackets).length, 6)
+        assertEq(Object.keys(ordinaryBrackets).length, 5)
TSC CLEAN
✖ …/server/finance_tax_params/module.f.js").proof.year2025Resolves()
  [ 6, 5 ]
ℹ tests 329  ℹ pass 328  ℹ fail 1
```

Run in isolation with 2a already reverted, so the two observations stand separately. **The
conclusion the plan asked to be recorded: the `Object.keys(...).length` assertions are what make
an omitted status visible, not the expectation loop.** A comment saying so now sits beside the
assertion in the source, citing this mutation.

## Plan defects found

Two, both in acceptance criteria rather than in the work itself. Neither required a design change;
both are recorded because the plan has already been through two adversarial review rounds and a
third pass should know about them.

**1. Task 1's acceptance criterion "`npm test` exits 0, `tsc` clean, 0 fail" is unsatisfiable at
Task 1.** Adding QSS to `IndividualFilingStatus` necessarily breaks two hand-typed counts that the
plan assigns to Task 2:

```
✖ …/tax/boundary/module.f.js").proof.everyThresholdIsCovered()   [ 50, 42, … ]
✖ …/server/finance_tax_params/module.f.js").proof.year2025Resolves()   [ 6, 5 ]
```

`tsc` was clean and all of Task 1's own new and extended leaves were green; the two failures are
Task 2's repairs, pending. The plan's phase-level `<verification>` block (green only at the end)
is the one that holds. Task 1's line should read "`tsc` clean; the only failures are
`everyThresholdIsCovered` and `year2025Resolves`, both repaired in Task 2".

**2. Task 2's leaf-count criterion attributes the +8 to the wrong task.** It says: record Task 1's
post-task count, then assert the count is `>= that + 8`, "the 8 generated threshold leaves must
appear without anyone having written them". But `allThresholds` is derived from `allFilingStatuses`,
which Task 1 changes — so **all eight generated leaves already appear at Task 1** (measured: 325,
with the eight `qualifyingSurvivingSpouse:*` leaves green and named above). Task 2 only restores
the two leaves Task 1's count mismatch had turned red, giving 325 -> **327**, not `>= 333`.

The criterion as written is unsatisfiable. The property it was reaching for is real and was
verified directly instead: the eight leaves exist, are green, and appear nowhere in the source as
hand-written keys. The plan's own phase-level `<verification>` ("risen by at least 9 from the 318
baseline") is correct and is met exactly, at 327.

## Deviations from Plan

### Auto-fixed issues

**1. [Rule 2 — correctness] Updated one docstring beyond the plan's explicit list**
- **Found during:** Task 2
- **Issue:** the plan said to update `fjs/tax/boundary`'s "27 total" and "10 total" comments and
  "change nothing else in this file", but a third comment on `generatedThresholdProof` read
  "never as a hand-written literal with 42 manually authored keys" — a count statement that the
  same change makes false.
- **Fix:** 42 -> 50 in that comment. Comment-only; no behavioural change.
- **Files modified:** `fjs/tax/boundary/module.f.js`
- **Commit:** `cabb4a2`

**2. [Rule 2 — correctness] Corrected two more stale "five filing statuses" docstrings**
- **Found during:** Task 1
- **Issue:** beyond the two docstrings the plan named, the module header ("ordinary rate brackets
  for all five filing statuses") and the two proof comments ("for all five filing statuses") each
  became false at six.
- **Fix:** five -> six in each; added a sentence recording that Rev. Proc. 2024-40 §2.01 Table 1
  covers both MFJ and QSS and that the two are transcribed from it independently.
- **Files modified:** `fjs/tax/params/module.f.js`
- **Commit:** `c531b27`

### Execution-environment deviation — verification was run in an isolated snapshot

**This is the one thing about this execution a reviewer should know.** A sibling wave-1 executor
(**Plan 10-02**, `wave: 1`, `depends_on: []`) was running **concurrently in this same worktree**
throughout, editing `fjs/report/line/module.f.js`. Confirmed by mtime (the file changed 4 seconds
before one of my probes and again 30 seconds later) and by 10-02's own frontmatter.

Our `files_modified` sets are disjoint, so the *work* never conflicted. But `npm test` is
`tsc && node --test` over the whole repo, and mid-edit their file did not compile:

```
fjs/report/line/module.f.js(17,28): error TS6133: 'assertNotNullish' is declared but never read.
fjs/report/line/module.f.js(19,1):  error TS6192: All imports in import declaration are unused.
fjs/report/line/module.f.js(98,7): error TS6133: 'electionTestLine' is declared but never read.
```

`tsc` failing means `node --test` never runs, so every mutation observation would have measured
their in-flight state rather than my proofs — exactly the unreliable evidence the mutation
discipline exists to prevent, and it would also have corrupted the leaf-count arithmetic.

**Mitigation:** every gated run (`npm test`, `npx tsc`, leaf counts, all five mutations) was
executed against an isolated snapshot of the worktree in the scratchpad, holding
`fjs/report/line/module.f.js` at `HEAD` and carrying only my three files' changes. The snapshot
was created with `tar` **excluding `.git`** — a stronger precaution than AGENTS.md's `cp -a`
sweep recipe, which shares the real repo's git directory; with no `.git` present, no git command
run inside the snapshot could reach the real repository at all. The command run was `npm test`
verbatim, per the plan's `<verify><automated>`; only the directory differed.

Every mutation *edit* and every `git diff --numstat` was performed on the real worktree file, so
the 1-insertion/1-deletion evidence is against the real tracked file; only the *test run* used
the snapshot. All edits were reverted, and `git diff --numstat` against `HEAD` for all three of my
files is empty.

**Confirmation in the real tree:** after both executors' commits landed,
`npm test` in the real worktree exits 0 at **336/336**, 334 project-local leaves — 327 of mine
plus 7 of 10-02's. So the isolation did not paper over a real-tree failure.

**Not done, deliberately:** `.planning/STATE.md` and `.planning/ROADMAP.md` were **not** updated.
Two executors advancing the same plan counter concurrently is a corruption risk with no upside;
the sibling left its own `10-02-SUMMARY.md` untracked at the same moment. The orchestrator should
reconcile phase state once the wave completes.

## Threat model outcomes

| Threat ID | Disposition | Evidence |
|---|---|---|
| T-10-01-01 (tampering with QSS's three stored rows) | mitigated | Task 1 mutations 1 and 2: each stored figure is pinned by a hand-typed expectation that is not derived from it, and a one-cent-scale change to either fails by name. |
| T-10-01-02 (a threshold silently dropped from `allThresholds`) | mitigated | Task 2 mutation 1: dropping a status from `allFilingStatuses` still typechecks and still returns a `readonly FilingStatus[]`, and `everyThresholdIsCovered` turned RED at `[42, 50]`. |
| T-10-01-03 (response size past the 64KB guard) | accepted | `responseStaysUnderSizeGuard` green on every run, including with the sixth status served. |

## Self-Check: PASSED

- `fjs/tax/params/module.f.js` — FOUND, modified, committed in `c531b27`
- `fjs/tax/boundary/module.f.js` — FOUND, modified, committed in `cabb4a2`
- `fjs/server/finance_tax_params/module.f.js` — FOUND, modified, committed in `cabb4a2`
- commit `c531b27` — FOUND in `git log`
- commit `cabb4a2` — FOUND in `git log`
- working tree clean for all three files (`git diff --numstat HEAD` empty): every mutation reverted
