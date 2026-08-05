---
phase: 09-traceable-report-lines-and-the-anti-hardcoding-gate
plan: 03
subsystem: report
tags: [zero-read-gate, response-envelope, prov-07, phase-9]

requires:
  - phase: 09
    provides: "fjs/report/audit/module.f.js's countNumericLiterals (Plan 09-02) — the numeric-literal count this plan surfaces beside the read count"
provides:
  - "The zero-observed-CAS-reads kill condition, wired into executeRun and its test-mirror runExecuteRunViaFixture: a program whose interpret run dispatched zero reads is refused as an error result, never returned as an ok result"
  - "The six-key fjs_run response envelope: resultHash, runHash, preview, truncated, readCount, literalCount"
  - "A decisive proof (zeroReadGate.zeroReadOutcomeBecomesAnErrorResult) that a zero-read program is actually refused, plus a proof that the two new fields stay well clear of the 64 KiB size guard"
affects: [09-04]

tech-stack:
  added: []
  patterns:
    - "The zero-read gate branches on reads.length === 0 at the exact point interpret succeeds, in both executeRun and its test-mirror runExecuteRunViaFixture — never a second, drifting implementation of the same check."
    - "readCount is always inputs.length (the same observed-read array the run record persists), never a second counter — the same single-source-of-truth discipline PROV-03 already established for inputs[] itself."

key-files:
  created: []
  modified: [fjs/server/fjs_run/module.f.js]

key-decisions:
  - "The zero-read gate lives in BOTH executeRun and runExecuteRunViaFixture (its test-mirror), computed at the same point sourceText/source is already in hand — matching the plan's explicit instruction to thread literalCount forward with no new parameter rather than recomputing it deeper in the call chain."
  - "The three existing zero-read plumbing fixtures (goodProgramSource/goodReport, trivialReport, tinyReport) were each repaired with one harmless ctx.step(ctx.evoList('false'), ...) dispatch, per the plan's exact prescription — proof that the new rule bites even against this repo's own pre-existing fixtures, not routed around."
  - "goodProgramSource's stored TEXT was updated to match goodReport's actual repaired body, per the plan's explicit 'keeping the two in sync avoids a misleading stored-source comment' instruction — even though the stored text is never actually parsed as running code (the JsModule fixture is what really executes)."
  - "The responseShape proof leaf was renamed from fourKeysExactlyAndResultAlwaysResolvable to sixKeysExactlyAndResultAlwaysResolvable to reflect the widened envelope, per the plan's explicit 'rename the leaf (or add a comment)' instruction. 09-04-PLAN.md's own read_first section still names the old leaf by its old name — Plan 09-04's own execution will need to pick up the renamed leaf."
  - "vnd.fjs.run gained NO new fields (09-CONTEXT.md, re-verified): readCount/literalCount are envelope-only, computed at response-construction time from data that already exists (inputs.length, outcome.literalCount)."

patterns-established:
  - "A response envelope's new integer fields are proven safe against the size guard using the SAME byte-length measurement (tryUtf8 + bit_vec's length) the guard itself uses, never content.length or an assumption that small integers cannot matter."

requirements-completed: [PROV-07]

duration: ~35min
completed: 2026-08-05
---

# Phase 09 Plan 03: The Zero-Read Gate and the Six-Key Response Envelope Summary

**`executeRun` (and its test-mirror) now refuses a program that dispatched zero observed CAS/Evo reads as an error result instead of returning it as a silent 'ok', and `fjs_run`'s response envelope surfaces `readCount`/`literalCount` beside `resultHash`/`runHash` — proven, for the first time, to actually kill a zero-read program and to stay well clear of the 64 KiB size guard.**

## Performance

- **Duration:** ~35 min
- **Completed:** 2026-08-05
- **Tasks:** 2 completed
- **Files modified:** 1 (`fjs/server/fjs_run/module.f.js`)

## Accomplishments

- `RunOutcome`'s `'ok'` arm widened with `readonly literalCount: number`; `executeRun` computes it via `countNumericLiterals(sourceText)` at the exact point `checkSpecifiers` will read the same string moments later — no second reading of the source.
- **The zero-read kill condition**: at `interpret`'s success point, `reads.length === 0` now returns `{ kind: 'error', message: '...zero observed reads over any stored document (source contains N numeric literal(s))...' }` instead of a silent `'ok'` — implemented identically in `executeRun` and its test-mirror `runExecuteRunViaFixture` (the SAME two changes, applied to both, per the plan's explicit instruction).
- The three EXISTING zero-read plumbing fixtures this file already defined — `goodProgramSource`/`goodReport` (session-survival proofs), `trivialReport`, and `tinyReport` — were repaired with one harmless `ctx.step(ctx.evoList('false'), () => ctx.pure(...))` dispatch each, giving `reads.length === 1` with no seeded document required. These fixtures broke under the new gate exactly as the plan predicted — proof the rule bites, not incidental test breakage routed around.
- `handleRunOutcome`'s ok-branch response envelope widened from four to six keys: `{ resultHash, runHash, preview, truncated, readCount: inputs.length, literalCount: outcome.literalCount }` — `readCount` derives from the SAME `inputs[]` array the run record persists, never a second counter.
- The `responseShape` proof leaf (renamed `sixKeysExactlyAndResultAlwaysResolvable`) now asserts the exact six-key sorted set plus explicit `readCount === 1` and `literalCount === countNumericLiterals(programSource)` values, not just the key set.
- New decisive proof `zeroReadGate.zeroReadOutcomeBecomesAnErrorResult`: a purpose-built zero-read report (`ctx => () => ctx.pure('unused')`, distinct from Plan 09-04's own verbatim adversary fixture) run through `runExecuteRunViaFixture` then `handleRunOutcome` — asserts `callResult.isError === true`, the returned text includes `'zero observed reads'`, and (reusing `assertPersistedErrorRunRecord`) the persisted run record has `status: 'error'`.
- New proof `sizeGuard.newFieldsStayWellClearOfTheGuard`: a full six-key JSON envelope with `preview` at `previewBytes` (8192 characters), measured via the SAME `tryUtf8`/`bit_vec` `length` `sizeGuard` itself uses, asserted strictly under `guardBytes` (65536) — proving the two new integer fields cannot push a maximal-preview response anywhere near the guard.

## Task Commits

Each task was committed atomically:

1. **Task 1: literalCount + the zero-read gate in executeRun and its test-mirror** - `e4e8941` (feat)
2. **Task 2: The six-key response envelope, the size-guard proof, and the decisive zero-read proof** - `98dff7c` (feat)

**Plan metadata:** (this commit, once made) `docs(09-03): complete The Zero-Read Gate and the Six-Key Response Envelope plan`

## Files Created/Modified

- `fjs/server/fjs_run/module.f.js` - `RunOutcome`'s widened `'ok'` arm, the zero-read gate in `executeRun`/`runExecuteRunViaFixture`, the repaired `goodProgramSource`/`goodReport`/`trivialReport`/`tinyReport` fixtures, `handleRunOutcome`'s six-key envelope, the renamed `sixKeysExactlyAndResultAlwaysResolvable` proof leaf, and the two new proof sections `zeroReadGate`/`sizeGuard`.

## Decisions Made

- The zero-read gate's error message names both the zero-read fact and the (REPORTED, never-refusing) `literalCount` in the same sentence — giving a caller who hits this refusal an immediate clue about whether the program looks like it has any real logic at all, without conflating the two mechanisms (09-CONTEXT.md keeps them distinct: the read-count gate refuses, the literal count only reports).
- `bitLength` (the `bit_vec` module's `length`, aliased to avoid shadowing) was imported alongside the file's existing `vec8` import specifically for the size-guard proof, reusing the exact measurement `fjs/server/response/module.f.js`'s own `sizeGuard` uses — never `content.length`, which undercounts non-BMP characters.
- The `responseShape` proof leaf was renamed (not merely commented) to `sixKeysExactlyAndResultAlwaysResolvable`, since the plan explicitly permitted either option and a stale name claiming "four keys" while the code returns six would itself be a small, self-inflicted trust gap in the same file this whole plan exists to make trustworthy.

## Deviations from Plan

None - plan executed exactly as written. Both tasks' acceptance criteria were met without any auto-fix, blocking issue, or architectural question.

One cross-plan note (not a deviation from THIS plan, but worth flagging for the next executor): `.planning/phases/09-traceable-report-lines-and-the-anti-hardcoding-gate/09-04-PLAN.md`'s own `read_first` section still names the pre-rename leaf `responseShape.fourKeysExactlyAndResultAlwaysResolvable`. That leaf is now `sixKeysExactlyAndResultAlwaysResolvable` in `fjs/server/fjs_run/module.f.js`. Plan 09-04's own execution will need to use the new name.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Verification Output

**1. `npm test` (final, after both tasks):**
```
ℹ tests 256
ℹ suites 0
ℹ pass 256
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 2530.234584
```
Exit 0, `tsc` clean, `fail 0`.

**2. `node --test 2>&1 | grep -c '^✔ import("./fjs/'` (final):**
```
254
```
Strictly greater than the 252 recorded after Plan 09-02 (two new proof leaves added in `fjs/server/fjs_run/module.f.js`: `zeroReadGate.zeroReadOutcomeBecomesAnErrorResult` and `sizeGuard.newFieldsStayWellClearOfTheGuard`; 254 - 252 = 2 confirms exactly).

**3. `npm run test:integration`:**
```
> finance@0.0.0 test:integration
> node --test fjs-run-integration.test.js

✔ TEST-01/TEST-02: fjs_run end to end through a real separate node index.js process and a real filesystem, with full tool coverage (742.359125ms)
ℹ tests 1
ℹ suites 0
ℹ pass 1
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 832.803458
```
Exit 0 — the real-process session still passes with the widened envelope (this test only checks `resultHash`/`runHash` presence, not an exact key set, so it needed no change; extending it with `readCount`/`literalCount` assertions is explicitly Plan 09-04's own scope per `09-04-PLAN.md`'s `files_modified`).

**4. Acceptance-criteria greps (Task 1):**
```
$ grep -n "literalCount = countNumericLiterals" fjs/server/fjs_run/module.f.js
178:        const literalCount = countNumericLiterals(sourceText)
444:    const literalCount = countNumericLiterals(source)

$ grep -c "reads.length === 0" fjs/server/fjs_run/module.f.js
3

$ grep -c "ctx.evoList('false')" fjs/server/fjs_run/module.f.js
4
```

**Acceptance-criteria greps (Task 2):**
```
$ grep -n "readCount: inputs.length" fjs/server/fjs_run/module.f.js
305:                    readCount: inputs.length,

$ grep -c "'literalCount', 'preview', 'readCount', 'resultHash', 'runHash', 'truncated'" fjs/server/fjs_run/module.f.js
1

$ grep -n "zeroReadOutcomeBecomesAnErrorResult" fjs/server/fjs_run/module.f.js
1060:        zeroReadOutcomeBecomesAnErrorResult: () => {
```

**5. `git status --porcelain`:** empty.

**6. `git log --oneline -5`:**
```
98dff7c feat(09-03): six-key response envelope, size-guard and zero-read proofs
e4e8941 feat(09-03): zero-read gate and literalCount in executeRun
07f0889 docs(09-02): complete Numeric-Literal Audit plan
09b82e4 test(09-02): prove the tokenizer honest, including the verbatim adversary
dc41d76 feat(09-02): countNumericLiterals — strip strings/comments, then count
```

## Next Phase Readiness

- PROV-07's runtime mechanism (short of the perturbation gate and the verbatim adversary, Plan 09-04) is complete: a zero-observed-read program is proven refused, and the read/literal counts are visible in the response envelope.
- Plan 09-04 (the perturbation gate, the verbatim `() => pure({ line16: 9137 })` adversary, and extending `fjs-run-integration.test.js`) can build on this directly. It should use the renamed `sixKeysExactlyAndResultAlwaysResolvable` leaf name (see the cross-plan note above under Deviations) rather than the stale name still in its own plan text.
- No blockers.

---
*Phase: 09-traceable-report-lines-and-the-anti-hardcoding-gate*
*Completed: 2026-08-05*

## Self-Check: PASSED

- FOUND: `fjs/server/fjs_run/module.f.js`
- FOUND: commit `e4e8941`
- FOUND: commit `98dff7c`
- FOUND: `.planning/phases/09-traceable-report-lines-and-the-anti-hardcoding-gate/09-03-SUMMARY.md`
