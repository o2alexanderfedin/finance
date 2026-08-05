---
phase: 09-traceable-report-lines-and-the-anti-hardcoding-gate
plan: 01
subsystem: report
tags: [report-line, negative-type-property, phase-9, prov-01, prov-02]

requires:
  - phase: 06
    provides: "fjs/guest/module.f.js — the widen/observe/revert methodology for a negative type property inside the passing build"
  - phase: 08
    provides: "fjs/tax/* module-grouping convention this plan follows for fjs/report/*"
provides:
  - "fjs/report/line/module.f.js — Source and ReportLine types, the locally-defined Extends<A,B> helper, and the PROV-01 compile-time assertion _ValueAndRuleWithoutSourcesDoesNotSatisfyReportLine"
  - "Runtime proofs: construction with all three ReportLine fields, the non-empty-sources witness, and a JSON round-trip through centsToString"
  - "Observed evidence (RED/GREEN tsc transcripts) that the PROV-01 assertion is load-bearing, not decorative"
affects: [09-02, 09-03, 09-04]

tech-stack:
  added: []
  patterns:
    - "A negative TYPE property is asserted as a conditional type inside the passing build (Phase 6's precedent) and verified by deliberately widening the guarded field, observing the real tsc error, then reverting — never assumed to hold."
    - "A locally-defined Extends<A, B> = [A] extends [B] ? true : false helper for structural-satisfies checks, tuple-wrapped so a union LHS is tested as a whole rather than distributed member-by-member — the same wrapping fjs/guest/module.f.js's own (different) assertion needs."
    - "A non-empty tuple type (readonly [T, ...(readonly T[])]) rejects an empty array literal at the type level, not just an omitted key."

key-files:
  created: [fjs/report/line/module.f.js]
  modified: []

key-decisions:
  - "ReportLine.value is bigint with no generic type parameter — a money line never invites a number to appear downstream (09-CONTEXT.md)."
  - "ReportLine.sources is a non-empty TUPLE, not a plain array — sources: [] also fails to typecheck, satisfying PROV-02's plural 'tuples', not merely guarding against an omitted key."
  - "ReportLine.rule is a required (non-optional) string — a line that cannot name the rule it implements is exactly the untraceable line PROV-01 exists to make unrepresentable."
  - "Extends<A, B> is defined locally in this module (not upstream in fjs) because it tests structural assignability, which fjs's own Equal cannot express; fjs/guest/module.f.js's precedent needed only exact union equality, a different check."

patterns-established:
  - "Widen-the-guarded-field / observe-the-real-tsc-error / revert-and-confirm-clean is the standing verification method for every negative type property in this project, following Phase 6."

requirements-completed: [PROV-01, PROV-02]

duration: ~20min
completed: 2026-08-05
---

# Phase 09 Plan 01: Traceable Report Lines Summary

**`ReportLine` makes an untraceable monetary figure unrepresentable in TypeScript: `sources` is a non-empty tuple and `rule` is required, and the compile-time assertion guarding that was watched to actually fail (TS2344) when widened, then reverted to a clean build.**

## Performance

- **Duration:** ~20 min
- **Completed:** 2026-08-05
- **Tasks:** 2 completed
- **Files modified:** 1 created (`fjs/report/line/module.f.js`)

## Accomplishments

- `Source` — the `(documentHash, boxPath, value)` tuple as a named object, `boxPath` matching the dialect's own dotted field-name convention (`box1InterestIncome`, per `fjs/document/1099int`).
- `ReportLine` — `value: bigint` (no generic), `sources: readonly [Source, ...(readonly Source[])]` (non-empty tuple, never a plain array), `rule: string` (required).
- `Extends<A, B>` — a locally-defined, tuple-wrapped structural-satisfies helper (`[A] extends [B] ? true : false`), needed because this module's assertion tests structural assignability, which `Equal` alone cannot express.
- `_ValueAndRuleWithoutSourcesDoesNotSatisfyReportLine` — the PROV-01 compile-time assertion, living inside the passing build (Phase 6's precedent), never a second tsconfig or `@ts-nocheck`.
- Three `proof` leaves: full construction of all three fields, the non-empty-`sources` runtime witness, and a JSON round-trip through `centsToString` (never `JSON.stringify` on a bare `bigint`, per EXACT-05).
- **The assertion was watched to actually fail**, not assumed: widening `sources` to optional produced a real `TS2344` at the exact assertion line, then reverting produced a clean, silent `tsc` exit 0.

## Task Commits

Each task was committed atomically:

1. **Task 1: Source/ReportLine types and the PROV-01 compile-time assertion** - `bac0d69` (feat)
2. **Task 2: Verify the compile-time assertion actually fires (RED/GREEN)** - no new commit; this task is a verification-only task that widens the file, observes the failure, and reverts to byte-identical content already committed in Task 1's commit (`git status --porcelain` is empty and `git diff --stat HEAD` is empty after the task). Its evidence is captured below and in this SUMMARY, not in a separate commit.

**Plan metadata:** (this commit, once made) `docs(09-01): complete Traceable Report Lines plan`

## Files Created/Modified

- `fjs/report/line/module.f.js` - `Source`, `ReportLine`, the locally-defined `Extends<A, B>` helper, the PROV-01 compile-time assertion, and three `proof` leaves (construction, non-empty-sources witness, JSON round-trip).

## Task 2 Evidence — RED/GREEN `tsc` Transcripts

### RED — `sources` temporarily widened to optional (`sources?:` instead of `sources:`)

Command: `npx tsc`

```
fjs/report/line/module.f.js(76,21): error TS2344: Type 'false' does not satisfy the constraint 'true'.
fjs/report/line/module.f.js(98,18): error TS18048: 'line.sources' is possibly 'undefined'.
fjs/report/line/module.f.js(99,15): error TS2488: Type 'readonly [Source, ...Source[]] | undefined' must have a '[Symbol.iterator]()' method that returns an iterator.
fjs/report/line/module.f.js(117,16): error TS18048: 'line.sources' is possibly 'undefined'.
EXIT: 1
```

Line 76 is confirmed (via `grep -n`) to be exactly:
```
76: * @typedef {Assert<Equal<Extends<{ readonly value: bigint, readonly rule: string }, ReportLine>, false>>} _ValueAndRuleWithoutSourcesDoesNotSatisfyReportLine
```

`TS2344: Type 'false' does not satisfy the constraint 'true'` fires exactly at the PROV-01 assertion's own line — not a different, unrelated error code paraphrased from Phase 6 (which observed `TS2322`/`TS2741` for its own, different, conditional-type shape). This is the real, observed error for THIS module's shape, as the plan required. The three follow-on `TS18048`/`TS2488` errors are expected side effects of the same widening rippling into the `proof` leaves that consume `line.sources` (now possibly `undefined`) — they corroborate that the widening is real and load-bearing throughout the file, not just at the assertion.

### GREEN — `sources` reverted to required (`sources:`), exactly as Task 1 left it

Command: `npx tsc`

```
(no output)
EXIT: 0
```

`git diff --stat HEAD` after the revert: empty (no diff — the file is byte-identical to the Task 1 commit). `git status --porcelain`: empty.

## Decisions Made

- `ReportLine.value` stays a plain `bigint` (no generic parameter) — a money line inviting a `number` downstream is exactly the hazard 09-CONTEXT.md calls out.
- `sources` is a non-empty tuple type, not a plain array with a length check elsewhere — `sources: []` fails `tsc`, not just an omitted `sources` key, satisfying PROV-02's plural "tuples" at the type level rather than by runtime convention.
- `rule` is required, not optional — a line unable to name its rule is precisely the untraceable line this phase makes unrepresentable.
- `Extends<A, B>` is defined locally in this new module rather than reused from `fjs/guest/module.f.js`, because that module's own assertion tested exact union equality (`CasOp[0]` against a literal union) via `Equal` alone; this module's assertion tests structural assignability (does a two-field object satisfy the three-field `ReportLine`?), which needs the `[A] extends [B] ? true : false` conditional `Equal` cannot express by itself. No upstream fjs equivalent exists, per the interfaces note in 09-01-PLAN.md.

## Deviations from Plan

None - plan executed exactly as written. Both tasks' acceptance criteria were met without any auto-fix, blocking issue, or architectural question.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Verification Output

**1. `npm test`:**
```
ℹ tests 245
ℹ suites 0
ℹ pass 245
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
```
Exit 0, `tsc` clean, `fail 0`.

**2. `node --test 2>&1 | grep -c '^✔ import("./fjs/'`:**
```
243
```
Strictly greater than the Phase 9 baseline of 240 (three new `proof` leaves in `fjs/report/line/module.f.js`).

**3. Acceptance-criteria greps:**
```
$ grep -n "readonly \[Source, \.\.\.(readonly Source\[\])\]" fjs/report/line/module.f.js
51: *   readonly sources: readonly [Source, ...(readonly Source[])],

$ grep -c "Assert<Equal<Extends<" fjs/report/line/module.f.js
1

$ grep -c "value: bigint" fjs/report/line/module.f.js
2
```

**4. `git status --porcelain`:** empty (after Task 1's commit and Task 2's widen/revert cycle, which left the file byte-identical to the committed state).

**5. `git log --oneline`:**
```
bac0d69 feat(09-01): define Source/ReportLine types and the PROV-01 compile-time assertion
```

## Next Phase Readiness

- `ReportLine`/`Source` exist and are proven both at the type level (PROV-01, watched to actually fail when the guard is removed) and at runtime (construction, non-empty-sources witness, JSON round-trip).
- Plans 09-03/09-04 (the zero-observed-reads kill condition and the perturbation gate — the runtime half of the anti-hardcoding gate) can now build on this type without redefining it.
- No blockers.

---
*Phase: 09-traceable-report-lines-and-the-anti-hardcoding-gate*
*Completed: 2026-08-05*

## Self-Check: PASSED

- FOUND: `fjs/report/line/module.f.js`
- FOUND: commit `bac0d69`
