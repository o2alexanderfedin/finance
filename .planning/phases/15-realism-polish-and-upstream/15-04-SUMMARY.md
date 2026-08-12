---
phase: 15-realism-polish-and-upstream
plan: 04
subsystem: reporting
tags: [functionalscript, fjs_run, provenance, amendment, form-1040x, rtti, mutation-testing]

# Dependency graph
requires:
  - phase: 07
    provides: "vnd.fjs.run's schema/validate and the CAS-read-back-by-hash sequence (fjs/server/fjs_run/module.f.js's assertPersistedErrorRunRecord)"
  - phase: 09
    provides: "ReportLine/Source's traceability shape and applyWholeDollarElection (fjs/report/line/module.f.js)"
provides:
  - "fjs/report/amend/module.f.js — amendmentDiff: reads two vnd.fjs.run records by hash, refuses loudly on programHash/args mismatch or a non-ok status, otherwise diffs the two stored results into Form 1040-X's Columns A/B/C per line"
  - "The whole-dollar election applied host-side, independently per side, before the subtraction that produces Column B, so B = C - A holds exactly in the printed dollars"
affects: [phase-16]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Host-side CAS-read-and-guard module with NO cas.write in production code — only fixture seeding in the Tests section, explicitly marked and grep-scoped"
    - "Named intermediate effect typedef (DiffEffect) plus explicit @type casts on every pure(error(...))/pure(ok(...)) branch, to work around tsc's known deeply-nested-step-callback inference collapse (contextual typing narrows to the first-seen return branch without it)"

key-files:
  created:
    - fjs/report/amend/module.f.js
  modified: []

key-decisions:
  - "Corrected the plan's own literal behavior-block wire values ('100000'/'150000') to '1000.00'/'1500.00' — verified directly against fjs/types/decimal/module.f.js's own parse: centsFromString('100000') is $100,000.00 (a plain decimal-string parse with no implied cents-integer scaling), not the $1,000.00 the plan's own expected columnA names. The corrected literals are the genuine wire-projection convention (fjs/report/line's own wireProjectionRoundTripsThroughJson: value: centsToString(line.value)) and produce exactly the plan's own stated columnA/columnB/columnC."
  - "readRunRecord's error channel is RunError (ValidationError | string), not plain string as the plan's own interfaces-block JSDoc literally types it — validateRun's structural-failure arm returns a ValidationError object. Added a small runErrorMessage flattening helper so this module's error channel stays a plain string throughout, as the exported amendmentDiff signature requires."
  - "No parameterSetHash or any new vnd.fjs.run field added — programHash equality (defensively paired with args equality) is the complete parameter-set guard, per 15-RESEARCH.md Pitfall 1 and this phase's locked decision."
  - "elected is an explicit caller argument; the projection is applied host-side, independently to each side's reconstructed ReportLine[], before the subtraction that produces columnB — never re-derived from stored CAS content."

requirements-completed: [PROV-06]

# Metrics
duration: 50min
completed: 2026-08-11
---

# Phase 15 Plan 04: Form 1040-X From a Report Diff (PROV-06) Summary

**`amendmentDiff` reads two `vnd.fjs.run` records by CAS hash and produces Form 1040-X's Columns A/B/C mechanically per 1040 line — refusing loudly on a mismatched program, mismatched args, or a failed run, and applying the whole-dollar election itself, host-side, before the subtraction that makes B = C - A hold exactly — with no new stored artifact and no new `vnd.fjs.run` field.**

## Performance

- **Duration:** ~50 min
- **Tasks:** 2 completed (Task 2 is a mutation sweep with no persisted change — see below)
- **Files modified:** 1 created, 0 modified

## Accomplishments

- Built `fjs/report/amend/module.f.js`: `amendmentDiff(cas)(elected)(runHashA)(runHashB)` — reads both run records via the exact `cBase32ToVec`/`collectRead` sequence `fjs/server/fjs_run/module.f.js`'s own test helper already proves against real CAS content, refuses loudly on `programHash`/`args` mismatch or a non-`'ok'` status (naming both hashes/the failing side), then reads both result blobs, validates them as a record of wire-projected `ReportLine`s via rtti's `record(...)`, reconstructs each side's `ReportLine[]`, applies `applyWholeDollarElection(elected)` to each side INDEPENDENTLY, and diffs the union of line names into `{ columnA, columnB, columnC, sourcesA, sourcesC }` per line, with `columnB` computed as `centsToString(centsC - centsA)` so `B = C - A` holds by construction, never by a separately-computed value that merely happens to agree.
- Proved all six of the plan's own behavior-block cases: same-program/same-args diff with exact `B = C - A` identity; `programHash` mismatch refused (+ positive control); `args` mismatch refused (+ positive control); either side's run status `'error'` refused, naming the failing side; the whole-dollar election applied host-side using the IRS's own `$1.39`→`$1`/`$2.50`→`$3` examples (reused from `fjs/report/line`'s own proof, not re-derived); a line present only on the "after" side reads `columnA: '0.00'`/`sourcesA: []` with `columnC`/`sourcesC` populated normally.
- No `cas.write`/`evoAdd` call anywhere in production code — the single `cas.write` call site (inside a test-fixture-only `seedText` helper) lives below the file's own `// ── Tests ──` marker, verified by scoping the grep to exclude that section.
- Mutation-swept the three highest-risk logic points (Task 2): the `programHash` inequality, `columnB`'s subtraction order, and the election's call-order — all three predictions confirmed, with one informative surprise (see Decisions/Deviations below), and the working tree left clean (`git status --porcelain` empty) after every mutation was reverted.

## Task Commits

Each task was committed atomically:

1. **Task 1: amendmentDiff — read two runs, guard, diff, project** - `fc3c2c7` (feat)
2. **Task 2: Mutation sweep on the diff's guard and projection logic** - no commit (every mutation was reverted; `git status --porcelain fjs/report/amend/module.f.js` was empty both before and after this task, so there is nothing to commit — see Mutation Sweep below for the full record)

## Files Created/Modified

- `fjs/report/amend/module.f.js` - `amendmentDiff` (the exported diff), `readRunRecord`/`readResultRecord` (CAS read-back), `namedLinesFromRecord`/`projectedLinesByName`/`diffWireRecords` (reconstruction, host-side projection, and the diff itself), plus the full behavior-block proof suite

## Decisions Made

- **Corrected the plan's own literal test values, verified directly rather than trusted.** The plan's Task 1 `<behavior>` text hand-types `{ interest: { value: '100000', ... } }` (before) / `'150000'` (after) and expects `columnA: '1000.00'`/`columnC: '1500.00'`. Running `fjs/types/decimal/module.f.js`'s own `parse(2)('100000')` directly returns `10000000n` (i.e. `$100,000.00`), not `100000n` (`$1,000.00`) — `centsFromString` is a plain decimal-string parser with no implied "this string is already cents" convention, so the plan's own literal would not produce its own stated expected output. Corrected to `'1000.00'`/`'1500.00'` — the genuine wire-projection convention this module's own docstring (and `fjs/report/line`'s own `wireProjectionRoundTripsThroughJson` proof) documents — which reproduces the plan's own stated `columnA`/`columnB`/`columnC` exactly. This mirrors the established pattern in this phase's own wave 1 (15-02's regex correction): the plan's own suggested literal was checked against the actual code before being trusted, not copied as-is.
- **Flattened `RunError` to a plain string at the CAS-read boundary.** The interfaces block's own JSDoc types `readRunRecord` as returning `Effect<O, Result<Run, string>>`, but `validateRun`'s structural-failure arm actually returns a `ValidationError` object (`{ path, message }`), not a string — confirmed directly by reading `fjs/run/module.f.js`'s own `RunError` typedef (`ValidationError | string`). Added a small `runErrorMessage` helper so this module's error channel is a plain string throughout, matching the exported `amendmentDiff` signature the plan itself specifies (`Result<..., string>`).
- **Named the effect type and cast every branch's `pure(...)` argument explicitly**, to work around a `tsc` inference limitation: without it, a deeply-nested `step` callback with multiple `return` statements (several early `pure(error(...))` guards followed by a later `pure(ok(...))`) gets its parameter type inferred from only the FIRST branch encountered, rejecting the later branch as a type mismatch. This is the same class of issue `fjs/server/fjs_run/module.f.js`'s own `RunOutcome` casts already work around at every one of its `pure(/** @type {RunOutcome<unknown>} */ (...))` call sites — the same technique, applied here.
- **`programHash` equality (defensively paired with `args` equality) is the complete parameter-set guard** — no `parameterSetHash` or any other new `vnd.fjs.run` field was added, per 15-RESEARCH.md's Pitfall 1 and this phase's locked decision: guest programs cannot `import`, and `guestCtx` exposes no tax-parameter lookup, so every parameter a stored program uses is a literal in its own source, already covered by `programHash`.
- **`elected` is an explicit caller argument, and the projection runs host-side, independently per side**, before the subtraction that produces `columnB` — never re-derived from stored CAS content (which would only be sound if both runs pinned the same return-profile revision).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected the plan's own hand-typed behavior-block wire values, which do not produce the plan's own stated expected output**
- **Found during:** Task 1, while translating the plan's `<behavior>` block into the first proof leaf.
- **Issue:** The plan's own literal `{ interest: { value: '100000', ... } }` (before) / `'150000'` (after) does not parse, via `centsFromString`, into the plan's own stated `columnA: '1000.00'`/`columnC: '1500.00'` — verified directly: `parse(2)('100000') === 10000000n` ($100,000.00), not `100000n` ($1,000.00).
- **Fix:** Used `'1000.00'`/`'1500.00'` instead — the genuine decimal-dollar wire-projection convention (`fjs/report/line`'s own `wireProjectionRoundTripsThroughJson` proof: `value: centsToString(line.value)`), which reproduces the plan's own stated `columnA`/`columnB`/`columnC` exactly (`'1000.00'`/`'500.00'`/`'1500.00'`).
- **Files modified:** fjs/report/amend/module.f.js (test-fixture literal only; no production-code change)
- **Verification:** Ran `fjs/types/decimal/module.f.js`'s own `parse` directly against both the plan's literal and the corrected one before writing the proof leaf; the corrected leaf then passed (verified again after the full mutation sweep left it green).
- **Committed in:** fc3c2c7 (Task 1 — the corrected literal was written directly into the initial commit; no separate fix commit needed since the defect was caught before the file was ever written to disk uncorrected)

**2. [Rule 1 - Bug] Corrected the interfaces block's own JSDoc type for the CAS-read helper's error channel**
- **Found during:** Task 1, while typing `readRunRecord` against the interfaces block's literal `@type` annotation.
- **Issue:** The interfaces block types `readRunRecord` as `Effect<O, Result<Run, string>>`, but `validateRun`'s structural-failure arm returns a `ValidationError` object (`fjs/run/module.f.js`'s own `RunError = ValidationError | string`), not a plain string. Typing the helper as the interfaces block literally states fails `tsc` under this project's strict config.
- **Fix:** Added `runErrorMessage: (e: RunError) => string`, flattening both arms to a plain string once, at the boundary, rather than narrowing `RunError`'s shape at every call site.
- **Files modified:** fjs/report/amend/module.f.js
- **Verification:** `npx tsc --noEmit` reports zero errors with this fix in place (and reported the exact mismatch described above without it, confirmed by temporarily reverting the fix).
- **Committed in:** fc3c2c7

---

**Total deviations:** 2 auto-fixed (1 bug in the plan's own suggested test literal, caught before it was ever committed uncorrected; 1 bug in the plan's own suggested JSDoc type, caught by `tsc` itself).
**Impact on plan:** Both were necessary for the plan's own stated success criteria (a correct, hand-typed positive control; `npx tsc --noEmit` reporting zero errors). No scope creep — neither touches any other plan's files.

## Mutation Sweep (Task 2)

Per AGENTS.md's "a proof is not known to work until you have watched it fail" and this phase's own gate mandate (the diff is one of the two highest-risk new computations), three mutations were applied one at a time, measured, and reverted. **Note on mutation form:** the plan's own phrasing ("mutate ... to always-false") does not compile as a literal `if (false && ...)` under this project's strict `tsc` config — `noUnreachableCode`-shaped analysis statically folds `X && false` (and even `X && (const-zero === 1)`) to unreachable, so `tsc` fails before `node --test` ever runs. Used `Boolean(0)` instead (a non-literal-typed always-`false` at runtime, opaque to `tsc`'s constant-folding) — the same class of fix AGENTS.md's own "the mutation that deletes the last use of a binding does not compile" section documents, applied to unreachable-code folding instead of an orphaned binding.

- **(a) `programHash !== ` inequality → always-false** (`runA.programHash !== runB.programHash && Boolean(0)`): `tsc` clean; `node --test` reddened exactly the predicted leaf, `guards.programHashMismatchRefused` (1 of 11), and no other leaf. `git diff --numstat` showed exactly `1 1` (one line changed). Reverted; `git status --porcelain` empty.
- **(b) `columnB`'s subtraction order swapped** (`centsA - centsC` instead of `centsC - centsA`): `tsc` clean; `node --test` reddened TWO leaves, not one. `sameProgramSameArgsDiffsToColumnsWithExactIdentity` reddened with the SIGN flipped exactly as predicted (`'-500.00'` instead of `'500.00'`, not merely a different magnitude). **A genuine surprise beyond the plan's own prediction:** `newLineIntroducedByTheCorrectionAppearsWithZeroColumnA` also reddened — caught not by that leaf's own hand-typed literals (which don't assert `columnB` at all) but by this module's own `assertColumnBEqualsColumnCMinusColumnA` helper, called at the end of every diff-producing leaf, which independently re-derives the identity from `columnA`/`columnB`/`columnC` rather than trusting the implementation. **A separate, informative non-finding:** all three `election` leaves stayed green under this same mutation — an equivalent mutant (AGENTS.md's own named phenomenon), because every `election` leaf self-diffs the identical wire value on both sides, so `centsA === centsC` and `centsA − centsC === centsC − centsA === 0n` regardless of subtraction order; the sign-flip is only observable when the two sides genuinely differ, which is exactly what the OTHER two reddened leaves do and the `election` leaves, by design, do not. `git diff --numstat` showed `1 1`. Reverted; `git status --porcelain` empty.
- **(c) The whole-dollar election's call-order — skip applying it to the raw cents** (calling `applyWholeDollarElection(elected)(lines)` but discarding its result and using the raw `lines` instead, keeping the import referenced so `tsc`'s `noUnusedLocals` does not itself block the mutation from compiling): `tsc` clean; `node --test` reddened exactly the two predicted `elected: true` leaves (`election.electedProjectsHostSideBeforeDiffing`, showing `'1.39'` instead of `'1.00'`; `election.electedRoundsTheIrsTwoFiftyTieUpToThreeDollars`, showing `'2.50'` instead of `'3.00'`) and no other leaf — `election.notElectedLeavesTheLineUnprojected` correctly stayed green, since `elected: false` never invoked the projection in the first place. `git diff --numstat` showed `2 1`. Reverted; `git status --porcelain` empty.

All three predictions were confirmed to redden the suite (mutation (b) additionally reddened a leaf the plan's own prediction did not name, caught by this module's own explicit identity-assertion helper rather than by accident). The working tree is clean (`git status --porcelain fjs/report/amend/module.f.js` reports nothing) after all three mutations were reverted — Task 2's own acceptance criterion.

## Issues Encountered

None beyond the two deviations and the one mutation-form adjustment documented above. `npx tsc --noEmit` reported zero errors on the first attempt after the two fixes above; `node --test all.test.js` passed all 11 new leaves on the first real run against the fixtures as designed (each was still mutation-verified per AGENTS.md discipline — see above).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- PROV-06 is fully delivered: `amendmentDiff` reads two `vnd.fjs.run` records by hash, refuses loudly on every non-comparable pairing the plan's `<behavior>` block names, applies the whole-dollar election host-side, and diffs to Form 1040-X's Columns A/B/C with `B = C - A` holding exactly — proven by explicit assertion in every diff-producing proof leaf, not merely trusted from the implementation.
- No new storage mechanism and no new `vnd.fjs.run` field were added — this module only ever reads existing records; `grep -c "cas.write\|evoAdd"` against the production-code section (above the file's own `// ── Tests ──` marker) reports 0.
- `npx tsc --noEmit`: zero errors, repo-wide. `npm test`: 6252/6252 passing, 0 failures, 0 cancelled. De-duplicated project-local proof count moved from 874 (end of Plan 15-03) to **885** (11 new leaves in `fjs/report/amend/module.f.js`), confirmed via `node --test 2>&1 | grep '^✔ import("./fjs/' | sed 's/ ([0-9.]*ms)$//' | sort -u | wc -l`.
- Plans 15-01, 15-02, 15-03, 15-05, 15-06 (PROV-08, TAX-17, MCP-09, DOC-16) are unaffected by and independent of this plan's files — no shared module was touched.
- This module's own `AmendmentDiffResult`/wire-record rtti schema is a self-contained, private validation of the `ReportLine` wire projection — a future plan that wants to CITE a diff's own output (e.g. wiring PROV-06 into a real amendment workflow end to end) would run this module's output through the SAME `fjs_run`-shaped path per this module's own docstring, not a bespoke write from here.

---
*Phase: 15-realism-polish-and-upstream*
*Completed: 2026-08-11*

## Self-Check: PASSED

All claimed files exist on disk and the task commit is present in `git log --oneline --all`:

- `fjs/report/amend/module.f.js` — FOUND
- `.planning/phases/15-realism-polish-and-upstream/15-04-SUMMARY.md` — FOUND
- `fc3c2c7` (Task 1) — FOUND

`npx tsc --noEmit`: 0 errors. `npm test`: 6252/6252 passing, 0 failures. De-duplicated project-local proof count: 885 (up from 874 at end of Plan 15-03, +11 matching this plan's own new leaves). `git status --porcelain fjs/report/amend/module.f.js`: empty (Task 2's own acceptance criterion).
