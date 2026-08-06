---
phase: 10-form-1040-core-line-16-dispatch-and-the-scope-guard
plan: 02
subsystem: report
tags: [whole-dollar-election, rounding, criterion-5, phase-10, tax-05, exact-04]

requires:
  - phase: 09
    provides: "fjs/report/line/module.f.js — Source and ReportLine, the non-empty-sources tuple and the PROV-01 compile-time assertion this plan extends without touching"
  - phase: 04
    provides: "fjs/types/rational/module.f.js — of and halfUp, exact Rational arithmetic with ties away from zero at both signs"
provides:
  - "fjs/report/line/module.f.js — applyWholeDollarElection(elected)(lines), i1040gi p23's whole-dollar election as one all-or-nothing projection over a whole ReportLine[]"
  - "A private wholeDollarCentsFromCents with no exported per-line variant — the all-or-nothing property enforced by the exported surface, not by review"
  - "roundSumIsFourteenDollarsWhileSumRoundIsTenOnTenIrsExampleAmounts — ROADMAP criterion 5 made non-vacuous at $14 vs $10 with four hand-typed expectations"
  - "Observed RED transcripts for five mutations (and one deliberately-GREEN control) showing the rounding direction, the cents convention and the all-or-nothing property are each load-bearing"
affects: [10-04, 10-09]

tech-stack:
  added: []
  patterns:
    - "An IRS *election* is modelled by the SHAPE of its signature: taking the whole report and exporting no per-line variant makes 'round all amounts' unrepresentable-to-violate rather than merely documented."
    - "Two rules that compute identical numbers today are kept as two functions when their justifications differ (a printing convention vs a taxpayer election), with the reason recorded at the site so a later DRY pass has to argue with it."
    - "A criterion that is a tautology in the ambient representation (round over bigint cents) is proven by first introducing the regime where it bites (whole dollars), not by asserting the tautology."

key-files:
  created: []
  modified: [fjs/report/line/module.f.js]

key-decisions:
  - "wholeDollarCentsFromCents is deliberately NOT shared with fjs/tax/table's private roundToNearestDollarThenBackToCents. That one is Publication 1040's printing convention (the printed table has no cents column, and it applies whether or not the taxpayer elected anything); this one is the taxpayer's own p23 election, which the taxpayer may decline. Merging them would make declining the election unable to stop the Tax Table rounding, or let a change to the printed convention silently rewrite the election."
  - "applyWholeDollarElection(false) returns the SAME array, not a rebuilt copy, and the proof asserts reference identity — 'we did not elect' can never quietly cost cents."
  - "The election value's provenance is fixed in the docstring as the return profile document's own wholeDollarElection box (Plan 10-04), never a host-side flag."
  - "The third assertion of the divergence leaf compares the two COMPUTED sides (roundOfSum - sumOfRounds === 400n) rather than the plan's literal 1400n - 1000n === 400n, which cannot fail. See Deviations."

patterns-established:
  - "Every mutation is checked with `diff -u <pristine> <file> | grep '^[+-][^+-]'` before the suite is run, so a mutation that also edited the hand-typed expectation is caught rather than confirming nothing."

requirements-completed: [TAX-05, EXACT-04]

metrics:
  duration: ~45min
  tasks: 2
  files: 1
  proof-leaves-added: 7
---

# Phase 10 Plan 02: The IRS Whole-Dollar Election Summary

`applyWholeDollarElection` ships i1040gi p23's election as a single all-or-nothing projection over a
whole `ReportLine[]`, and turns ROADMAP criterion 5 from a tautology into a $4 divergence: ten
`'1.39'` amounts give **$14** the IRS's way and **$10** the forbidden way.

## Proof-leaf counts

The branch is shared with a concurrent executor running Plan 10-01, so the project-wide total moved
underneath this plan. The number attributable to this plan is the delta on its own file.

| Measurement | Before | After |
|---|---|---|
| `fjs/report/line` leaves (this plan's only file) | **3** | **10** (+7) |
| project-local total, `grep -c '^✔ import("./fjs/'` | **318** (clean tree, matches the stated baseline) | **334** |

The project-wide `318 → 334` is `+7` from this plan and `+9` from 10-01's commit `c531b27`, which
landed between this plan's two commits. Final state: `npm test` **336 tests, 336 pass, 0 fail**,
`tsc` clean.

## Tasks completed

| Task | Name | Commit | Leaves added |
|---|---|---|---|
| 1 | `applyWholeDollarElection` — one projection over a whole report | `6956c63` | 6 |
| 2 | `round(sum)` vs `sum(round)` — the IRS's own $1.39 example | `f4fff1c` | 1 |

Each commit touched **only** `fjs/report/line/module.f.js` (`git show --numstat`: `203/1` and
`80/2`), staged by explicit path. No deletions in either commit.

### What shipped

- private `wholeDollarCentsFromCents = cents => halfUp(of(cents)(100n)) * 100n` — no floating point
  on the path; `of` builds an exact `Rational` over `bigint`s and `halfUp` breaks ties away from
  zero at both signs. Its docstring carries the p23 paragraph verbatim (including "$1.39 becomes $1
  and $2.50 becomes $3") and the recorded reason it is not shared with `fjs/tax/table`.
- exported `applyWholeDollarElection = elected => lines => elected ? lines.map(…) : lines`.
- seven proof leaves, every expected value hand-typed.

### Acceptance gates

| Gate | Result |
|---|---|
| `grep -c "Math.round\|toFixed\|parseFloat\|Number("` | **0** |
| `grep -c "export const wholeDollarCentsFromCents"` | **0** (private — no per-line variant exported) |
| `grep -n "export const applyWholeDollarElection"` | line 162 |
| `grep -c "1400n"` / `grep -c "1000n"` | 4 / 2 |
| `grep -c "139n \* 10n\|139n\*10n"` | **0** (after a fix — see Deviations) |
| non-null assertions (`!`), casts over indexed access, `any` | none; the one-element projection index is narrowed with `assertNotNullish` |
| `npx tsc --noEmit` | clean |

## TDD gates

Task 1 ran a genuine RED before any implementation existed: the six leaves were written against a
typechecking identity stub (`elected => lines => elected ? lines : lines`).

```
✔ …proof.electionNotMadeReturnsEveryLineValueUnchanged()                              ← correctly GREEN
✖ …proof.electedThirteenNinetyBecomesFourteenDollars()
✖ …proof.electedTwoFiftyTieBecomesThreeDollars()
✖ …proof.electedNegativeTwoFiftyTieBecomesMinusThreeDollarsAwayFromZero()
✖ …proof.electedOneThirtyNineBecomesOneDollar()
✖ …proof.electedProjectionRoundsEveryLineAndPreservesSourcesAndRule()
```

Five of six RED; the `false` leaf green, because declining the election is the one behaviour an
identity stub gets right. That asymmetry is itself evidence the leaves are testing the projection
and not the plumbing.

## Mutations

Every mutation was run one at a time, its edit verified with
`diff -u <pristine> <file> | grep '^[+-][^+-]'` to show **exactly one removed and one added line**
(so no hand-typed expectation was edited alongside the code), then reverted and confirmed identical
to pristine.

### Task 1, mutation 1 — truncating division

The plan's literal form, `halfUp(of(cents)(100n)) * 100n` → `(cents / 100n) * 100n`, **does not
typecheck**, so it measures the compiler rather than the suite (see Deviations):

```
fjs/report/line/module.f.js(19,1): error TS6192: All imports in import declaration are unused.
```

Re-run in the equivalent truncating form that keeps `of`/`halfUp` used:

```
-const wholeDollarCentsFromCents = cents => halfUp(of(cents)(100n)) * 100n
+const wholeDollarCentsFromCents = cents => halfUp(of(cents / 100n)(1n)) * 100n

✖ …electedThirteenNinetyBecomesFourteenDollars()                       RED  ($13.90 → $13)
✖ …electedTwoFiftyTieBecomesThreeDollars()                             RED  ($2.50 → $2)
✖ …electedNegativeTwoFiftyTieBecomesMinusThreeDollarsAwayFromZero()    RED
✖ …electedProjectionRoundsEveryLineAndPreservesSourcesAndRule()        RED
✔ …electedOneThirtyNineBecomesOneDollar()                              GREEN
✔ …electionNotMadeReturnsEveryLineValueUnchanged()                     GREEN
```

Both leaves the plan predicted went RED. `electedOneThirtyNineBecomesOneDollar` staying GREEN is
correct and is deliberate evidence: truncation and half-up agree at $1.39, which is exactly why a
single $1.39 leaf could never have caught this on its own.

### Task 1, mutation 2 — rounding-direction sensitivity

**2a (predicted GREEN, and green):** an explicit sign-split that is still away-from-zero.

```
-const wholeDollarCentsFromCents = cents => halfUp(of(cents)(100n)) * 100n
+const wholeDollarCentsFromCents = cents => halfUp(of(cents < 0n ? -cents : cents)(100n)) * 100n * (cents < 0n ? -1n : 1n)
```

All 9 leaves GREEN — including `electedNegativeTwoFiftyTieBecomesMinusThreeDollarsAwayFromZero`,
`electedThirteenNinetyBecomesFourteenDollars`, `electedTwoFiftyTieBecomesThreeDollars`,
`electedOneThirtyNineBecomesOneDollar`, `electedProjectionRoundsEveryLineAndPreservesSourcesAndRule`
and `electionNotMadeReturnsEveryLineValueUnchanged`. **Why it did not move the suite:** it is not a
behaviour change at all. It computes `sign(x) · halfUp(|x|/100) · 100`, and `halfUp` is already
symmetric about zero, so the rewrite is extensionally the same function. The leaves are asserting a
*rule* (ties away from zero), not an *implementation*, which is the property that makes this
control meaningful rather than a gap.

**2b (predicted RED, and red):** an off-by-one-cent nudge.

```
-const wholeDollarCentsFromCents = cents => halfUp(of(cents)(100n)) * 100n
+const wholeDollarCentsFromCents = cents => halfUp(of(cents + 1n)(100n)) * 100n

✖ …electedNegativeTwoFiftyTieBecomesMinusThreeDollarsAwayFromZero()   RED   [ -200n, -300n ]
✔  (all five other election leaves GREEN)
```

**Which mutation moved the suite, and why the other did not:** only 2b did, and it moved *exactly
one* leaf — the negative tie. That is the sharpest possible result. Adding a cent leaves $13.90,
$2.50 and $1.39 on the same side of their nearest dollar, but it pushes `-$2.50` off the tie to
`-$2.49`, which rounds toward zero to `-$2`. So the `-250n → -300n` leaf is the only thing in this
suite standing between the codebase and a tie-break that quietly favours the taxpayer on every
loss. 2a did not move it because, as above, it is the same function written differently.

### Task 1, mutation 3 — all-or-nothing

```
-    ? lines.map(line => ({ ...line, value: wholeDollarCentsFromCents(line.value) }))
+    ? lines.map((line, index) => index === 0 ? { ...line, value: wholeDollarCentsFromCents(line.value) } : line)

✖ …electedProjectionRoundsEveryLineAndPreservesSourcesAndRule()   RED   [ 250n, 300n ]
✔  (all other leaves GREEN)
```

RED on the multi-line leaf, at line **1** of the report rather than line 0 — confirming the leaf
checks every line, not merely the first, so it did not need strengthening.

### Task 2, mutation 1 — invert the election flag

A single logical swap; because the ternary is formatted across two lines the diff is 2 removed / 2
added, which is the whole of the change and nothing else:

```
-    ? lines.map(line => ({ ...line, value: wholeDollarCentsFromCents(line.value) }))
-    : lines
+    ? lines
+    : lines.map(line => ({ ...line, value: wholeDollarCentsFromCents(line.value) }))

✖ …roundSumIsFourteenDollarsWhileSumRoundIsTenOnTenIrsExampleAmounts()   RED  [ 1390n, 1400n ]
✖ …electionNotMadeReturnsEveryLineValueUnchanged()                       RED
       'an unelected projection must return its input unchanged'
✖ …electedThirteenNinetyBecomesFourteenDollars()                         RED
✖ …electedTwoFiftyTieBecomesThreeDollars()                               RED
✖ …electedNegativeTwoFiftyTieBecomesMinusThreeDollarsAwayFromZero()      RED
✖ …electedOneThirtyNineBecomesOneDollar()                                RED
✖ …electedProjectionRoundsEveryLineAndPreservesSourcesAndRule()          RED
```

Both leaves the plan predicted went RED. The unelected leaf fails on the *reference-identity*
assertion first, which is the strongest available witness that a declined election returns its input
rather than a rebuilt copy.

### Task 2, mutation 2 — drop the cents re-expression

```
-const wholeDollarCentsFromCents = cents => halfUp(of(cents)(100n)) * 100n
+const wholeDollarCentsFromCents = cents => halfUp(of(cents)(100n)) * 1n

✖ …roundSumIsFourteenDollarsWhileSumRoundIsTenOnTenIrsExampleAmounts()   RED  [ 14n, 1400n ]
✖ …electedThirteenNinetyBecomesFourteenDollars()                         RED
✖ …electedTwoFiftyTieBecomesThreeDollars()                               RED
✖ …electedNegativeTwoFiftyTieBecomesMinusThreeDollarsAwayFromZero()      RED
✖ …electedOneThirtyNineBecomesOneDollar()                                RED
✖ …electedProjectionRoundsEveryLineAndPreservesSourcesAndRule()          RED
✔ …electionNotMadeReturnsEveryLineValueUnchanged()                       GREEN
```

`[ 14n, 1400n ]` is precisely the confirmation the plan asked for: the leaf is asserting a value in
the project's cents convention, not merely that "some number changed". A `14n` here would be $0.14,
not $14.

## Deviations from Plan

### Auto-fixed issues

**1. [Rule 3 — Blocking] Task 1 mutation 1 as written does not compile.**
- **Found during:** Task 1 mutation run.
- **Issue:** the plan asserts `halfUp(of(cents)(100n)) * 100n → (cents / 100n) * 100n` "Typechecks —
  both sides are `bigint`". Both sides *are* `bigint`, but the replacement removes the only uses of
  `of` and `halfUp`, and the import then trips `noUnusedLocals`: `TS6192: All imports in import
  declaration are unused`. `npm test` is `tsc && node --test`, so it never reaches the tests — the
  exact failure AGENTS.md warns about ("a mutation must still typecheck", or it measures the
  compiler).
- **Fix:** re-ran the same *semantic* mutation in a form that keeps both imports used:
  `halfUp(of(cents / 100n)(1n)) * 100n`. `cents / 100n` is bigint truncating division and `halfUp`
  of an integer `Rational` is exact, so this is numerically identical to the plan's intent. Both
  transcripts are recorded above.
- **Files modified:** none (mutation reverted).

**2. [Rule 1 — Bug in the plan's own gate] The `139n * 10n` gate tripped on prose describing the
   forbidden form.**
- **Found during:** Task 2 acceptance check.
- **Issue:** the acceptance criterion `grep -c "139n \* 10n\|139n\*10n"` must be `0`. The leaf's
  comment explaining *why* the sum is hand-typed literally quoted the forbidden expression, so the
  gate read `1` — a false positive against the very discipline it enforces.
- **Fix:** reworded to "none is written as a product of the per-item amount and the item count". The
  gate now reads `0` and the comment still says the same thing.
- **Files modified:** `fjs/report/line/module.f.js` (folded into commit `f4fff1c`).

### Deliberate readings, not fixes

**3. Task 2's third assertion.** The plan says "Assert `1400n - 1000n === 400n` explicitly … so the
failure message names the size of the divergence". Taken literally that is an assertion about two
literals and can never fail. Implemented instead as `assertEq(roundOfSum - sumOfRounds, 400n)`,
where both operands are the *computed* sides and `400n` is hand-typed — which is what actually
delivers the stated purpose. A fourth assertion (`roundOfSum !== sumOfRounds`) names the divergence
qualitatively. All four expected values (`1390n`, `1400n`, `1000n`, `400n`) remain hand-typed and
independent.

**4. One green commit per task, not a separate RED commit.** The standard TDD flow commits the
failing test first. This branch is shared with a concurrently-running executor (Plan 10-01), and a
deliberately-red commit on a shared branch corrupts the other executor's baseline measurements and
any bisect over it. The RED was run and its transcript is recorded above; only green states were
committed.

## Concurrency notes (Plan 10-01 running on the same branch)

Both `npm test` failures observed mid-execution —
`fjs/server/finance_tax_params/module.f.js proof.year2025Resolves` `[6, 5]` and
`fjs/tax/boundary/module.f.js proof.everyThresholdIsCovered` `[50, 42, …]`, later joined by two
`fjs/tax/params` leaves — came from 10-01's *uncommitted* working-tree edits to
`fjs/tax/params/module.f.js`, a file outside this plan's `files_modified`. They were not touched,
not "fixed", and cleared on their own when 10-01 committed `c531b27`. This is why the "`npm test`
exits 0" gate could not be met at the moment each task finished; it is met now (336/336). Every
per-task judgement was made on `grep '^✔ import("./fjs/report/line'`, which is immune to the other
executor's tree.

## Threat model

| Threat ID | Disposition | Evidence |
|---|---|---|
| T-10-02-01 (per-item rounding creeping in) | mitigated | Only `applyWholeDollarElection` is exported and it takes the whole `ReportLine[]`; `grep -c "export const wholeDollarCentsFromCents"` is 0. Mutation 3 (project only index 0) turns the multi-line leaf RED at `[250n, 300n]`, and the $14-vs-$10 leaf prices the confusion at $4. |
| T-10-02-02 (rounding an already-rounded value) | mitigated | The projection runs once, at report time, over the exact cents value; stated in the docstring and exercised end-to-end by 10-09. |
| T-10-02-03 (`Math.round` asymmetry on negatives) | mitigated | `halfUp` only; the float/round grep gate is 0; the `-250n → -300n` leaf pins the direction and mutation 2b shows it is the sole leaf holding that line. |

No new security surface: this module has no I/O, no network path, no schema at a trust boundary.
No **Threat Flags**.

## Known stubs

None. Nothing in this plan is a placeholder; `applyWholeDollarElection` is complete and independently
proven. Plan 10-04 supplies the `wholeDollarElection` box that will feed `elected`, and Plan 10-09
applies the projection over ten real 1099-INT documents — both are the plan's stated consumers, not
gaps in it.

## Anything in the plan found to be wrong

1. **Task 1 mutation 1 does not typecheck** (Deviation 1). The plan asserted it does. Corrected form
   run and recorded.
2. **The `139n * 10n` acceptance grep is prose-sensitive** (Deviation 2) — it forbids a string that a
   good explanatory comment naturally wants to quote.
3. **Task 2's `1400n - 1000n === 400n` is a tautology as literally written** (Deviation 3), and does
   not achieve the purpose the plan states for it.

Nothing else. The plan's numeric claims all held: `1390n → 1400n`, `250n → 300n`, `-250n → -300n`,
`139n → 100n`, and $14 against $10 with a $4 spread.

## Self-Check: PASSED

- `fjs/report/line/module.f.js` — FOUND
- commit `6956c63` — FOUND
- commit `f4fff1c` — FOUND
- `npm test` — 336 tests, 336 pass, 0 fail, `tsc` clean
- `fjs/report/line` proof leaves — 10 (was 3)
