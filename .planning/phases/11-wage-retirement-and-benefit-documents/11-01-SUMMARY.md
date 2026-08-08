---
phase: 11-wage-retirement-and-benefit-documents
plan: 01
subsystem: documents
tags: [fjs, rtti, document-dialect, 1099-r, ssa-1099, irs, ssa]

# Dependency graph
requires:
  - phase: 05-document-dialects
    provides: "fjs/document/base, fjs/document/money_field, the fjs/media/revision four-stage dialect template (fjs/document/1099int), the repeating-array + option(true) checkbox idioms (fjs/document/w2)"
provides:
  - "vnd.fjs.1099r document dialect (DOC-09) — full TY2026 box inventory, TY2025-diffed"
  - "vnd.fjs.ssa1099 document dialect (DOC-08) — sourced from IRS Pub 915, not an IRS blank form"
  - "a watched-red mutation proving expectedMoneyBoxFieldCount is load-bearing (Mutation Gate M2)"
affects: [11-02, 11-03, 13-tax-computation]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "generated-per-field proof + independently hand-typed count, applied to a fifth and sixth dialect"
    - "list-of-code-strings (option(array(string))) as distinct from a (code, amount) pair-list"

key-files:
  created:
    - fjs/document/1099r/module.f.js
    - fjs/document/ssa1099/module.f.js
  modified: []

key-decisions:
  - "1099-R modeled against the fuller TY2026 box set (a strict superset of TY2025); box 7c/7d and the 8a/8b split are documented as 2026-only additions, harmless because option-typed"
  - "formRevision is never derived from taxYear in code; the docstring records that a recipient's actual copy carries no distinguishable 'Created' date, so formRevision and taxYear will usually collapse to the same printed text in practice"
  - "SSA-1099's payerTin is always stored as '' (no printed payer TIN exists), and accountNumber maps to Box 8's Claim Number — both are proven by a round-trip leaf, not just documented"

patterns-established:
  - "Mutation Gate M2: removing one entry from a hand-typed-count-guarded array while leaving the count constant untouched is the correct mutation shape to prove the count is load-bearing — a schema-generated coverage leaf cannot detect a removal on its own"

requirements-completed: [DOC-08, DOC-09]

# Metrics
duration: 30min
completed: 2026-08-07
---

# Phase 11 Plan 01: Wage, Retirement, and Benefit Documents — 1099-R and SSA-1099 dialects Summary

**Added `vnd.fjs.1099r` (full TY2026 box set, box 7a as a code list, boxes 14-19 as a repeating array) and `vnd.fjs.ssa1099` (sourced from IRS Pub 915, `payerTin: ''` deliberate deviation), each with generated + hand-typed exactness proofs; Mutation Gate M2 watched RED then restored GREEN.**

## Performance

- **Duration:** ~30 min
- **Started:** 2026-08-07T22:35:00Z (approx.)
- **Completed:** 2026-08-07T23:05:00Z
- **Tasks:** 3 (2 feature tasks + 1 blocking mutation gate)
- **Files modified:** 2 created, 0 modified (net)

## Accomplishments

- `vnd.fjs.1099r` (DOC-09): full printed box inventory transcribed from both the fetched TY2026 (`f1099r.pdf`) and TY2025 (`f1099r--2025.pdf`) IRS PDF revisions, diffed; box 7a modeled as `option(array(string))` (a list of distribution codes, never a `(code, amount)` pair like W-2 box 12); boxes 14-19 modeled as a faithful `stateLocal` repeating array; percentage boxes (8b, 9a) explicitly excluded from `moneyFieldError`.
- `vnd.fjs.ssa1099` (DOC-08): full box inventory transcribed from IRS Publication 915 (2025) Appendix pp.20-22 — explicitly documented as SSA-issued, not an IRS form, and as an illustrated SAMPLE rather than a guaranteed-current blank form; `payerTin: ''` and `accountNumber` → Box 8 Claim Number both documented as deliberate deviations and pinned by a round-trip proof.
- Mutation Gate M2 run and recorded (see below): confirmed the independently hand-typed `expectedMoneyBoxFieldCount` constant is the only thing that catches a box silently removed from `moneyBoxFields` — the schema-generated per-field leaves cannot, because a removed box's own generated leaf disappears with it.

## Task Commits

Each task was committed atomically:

1. **Task 1: `vnd.fjs.1099r` — the full printed box inventory (DOC-09)** - `0909950` (feat)
2. **Task 2: `vnd.fjs.ssa1099` — sourced from Pub 915, not an IRS form (DOC-08)** - `7e46b81` (feat)
3. **Task 3: Mutation Gate M2 — prove the hand-typed box-count constants are load-bearing (BLOCKING)** - verification-only; the mutation was fully reverted (`git diff` on `fjs/document/1099r/module.f.js` is empty after restoration), so there is no new commit for this task. Its record lives entirely in this SUMMARY (see "Mutation Gate M2" below).

**Plan metadata:** (this commit, see below)

## Files Created/Modified

- `fjs/document/1099r/module.f.js` - `vnd.fjs.1099r` dialect: schema, `checkReferences`, `validate`, `proof` (DOC-09)
- `fjs/document/ssa1099/module.f.js` - `vnd.fjs.ssa1099` dialect: schema, `checkReferences`, `validate`, `proof` (DOC-08)

## Decisions Made

- Modeled 1099-R against the TY2026 (fuller) box set rather than a TY2025-only subset, per the plan's own instruction and RESEARCH.md's recommendation — 7c/7d and the 8a/8b split are `option`-typed and therefore harmless on a TY2025 document that never populates them.
- Did not derive `formRevision` from `taxYear` anywhere in code (DOC-10) — the module docstring records the "Created date is Copy-A-only" finding as the reason the two fields will often carry the same text on a real recipient's copy, without collapsing them structurally.
- Followed the plan's exact field lists, `moneyBoxFields`/`stateLocalMoneyFields` contents and counts, and proof-suite shape verbatim — no naming or shape deviation from the plan.

## Deviations from Plan

None - plan executed exactly as written. Every schema field, box-list order, money-box-field list, hand-typed count, and proof leaf matches the plan's `<action>` specification.

## Mutation Gate M2 — actual recorded output (BLOCKING, Task 3)

**Step 1 — mutation applied.** Removed `'box6NuaInEmployerSecurities'` from the `moneyBoxFields` array in `fjs/document/1099r/module.f.js` (line 174 of the committed Task 1 file), leaving `expectedMoneyBoxFieldCount = 10` untouched. Confirmed the diff was exactly the one entry, nothing else:

```
$ git diff --numstat fjs/document/1099r/module.f.js
0	1	fjs/document/1099r/module.f.js

$ git diff fjs/document/1099r/module.f.js
diff --git a/fjs/document/1099r/module.f.js b/fjs/document/1099r/module.f.js
index ef6782e..fe2baec 100644
--- a/fjs/document/1099r/module.f.js
+++ b/fjs/document/1099r/module.f.js
@@ -171,7 +171,6 @@ const moneyBoxFields = /** @type {const} */ ([
     'box3CapitalGain',
     'box4FederalIncomeTaxWithheld',
     'box5EmployeeContribOrInsurancePremiums',
-    'box6NuaInEmployerSecurities',
     'box7dEarningsOnExcessContrib',
     'box8aOther',
     'box9bTotalEmployeeContrib',
```

**Step 2 — confirmed RED, real output.** `npx tsc --noEmit` still exited `0` (the mutation compiles — no orphaned binding). `node --test 2>&1 | grep -c '^✔ import("./fjs/'` dropped from **531** (post-Task-2 count) to **529**. The failing leaf, exactly as predicted:

```
✖ import("./fjs/document/1099r/module.f.js").proof.checkReferences.moneyBoxExactness.everyMoneyBoxIsCovered() ... (0.217416ms)
  [ 9, 10, [ 'expected exactly the independently-stated money box count', 9, 10 ] ]
```

Full suite tally at this point: `tests 2768`, `pass 2767`, `fail 1` — the one failure is exactly this leaf, nothing else moved. The generated leaf `checkReferences.moneyBoxExactness.box6NuaInEmployerSecurities` also disappeared from the `✔` list entirely (its own generated leaf goes with the removed array entry) — this is the exact mechanism the gate exists to demonstrate: the generated-coverage half cannot catch a removal on its own, only the independently hand-typed count can.

**Step 3 — restored exactly.** Re-added `'box6NuaInEmployerSecurities'` at its original array position (between `box5EmployeeContribOrInsurancePremiums` and `box7dEarningsOnExcessContrib`) via a targeted edit, not a retype from memory. Confirmed byte-for-byte restoration:

```
$ git diff fjs/document/1099r/module.f.js
(empty)
```

**Step 4 — clean status confirmed.**

```
$ git status --porcelain
 M .planning/STATE.md
```

(The `.planning/STATE.md` modification predates this plan's execution — it was present in `git status` before Task 1 began, from prior session/tooling activity, and is unrelated to the mutation/restoration cycle. `fjs/document/1099r/module.f.js` itself shows no diff.)

**Step 5 — re-run confirms GREEN, at or above the post-Task-2 count.**

```
$ npx tsc --noEmit; echo "tsc exit: $?"
tsc exit: 0
$ node --test 2>&1 | grep -c '^✔ import("./fjs/'
531
```

531 matches exactly the count recorded at the end of Task 2 (satisfies the "at least" requirement). `expectedMoneyBoxFieldCount = 10` was never touched by the gate — confirmed still present:

```
$ grep -n "expectedMoneyBoxFieldCount = 10" fjs/document/1099r/module.f.js
302:const expectedMoneyBoxFieldCount = 10
```

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Project-local proof count (the honest metric, per AGENTS.md)

| Point | Count |
|---|---|
| Baseline (before this plan; also verified `functionalscript` installed==locked, `0.43.1`) | 492 |
| After Task 1 (`vnd.fjs.1099r`) | 518 |
| After Task 2 (`vnd.fjs.ssa1099`) | 531 |
| Mid-mutation (Task 3, box6 removed) | 529 (RED, one failing leaf) |
| After Task 3 restoration | 531 |

## Next Phase Readiness

Both new document dialects are stored-and-validated only, as scoped — neither touches `fjs/tax/` or `fjs/return/`. Ready for:
- Plan 11-02 (the `finance_documents_list` MCP tool and the DOC-15 `buildRunSnapshot` retraction fix), which lists documents of any dialect including these two by reading `.dialect`/`.taxYear` generically, with no dependency on this plan's specific field names.
- Plan 11-03 and later Phase 13 (TAX-09/TAX-10), which will read `vnd.fjs.1099r`'s and `vnd.fjs.ssa1099`'s boxes for the taxable-amount and Social Security Benefits Worksheet computations — this plan deliberately does not compute anything itself.

No blockers.

---
*Phase: 11-wage-retirement-and-benefit-documents*
*Completed: 2026-08-07*

## Self-Check: PASSED

- FOUND: `fjs/document/1099r/module.f.js`
- FOUND: `fjs/document/ssa1099/module.f.js`
- FOUND: `.planning/phases/11-wage-retirement-and-benefit-documents/11-01-SUMMARY.md`
- FOUND commit: `0909950` (Task 1)
- FOUND commit: `7e46b81` (Task 2)
- FOUND commit: `a3e0508` (this SUMMARY)
