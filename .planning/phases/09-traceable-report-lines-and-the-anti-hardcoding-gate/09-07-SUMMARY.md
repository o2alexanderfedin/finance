---
phase: 09-traceable-report-lines-and-the-anti-hardcoding-gate
plan: 07
subsystem: testing
tags: [gap-closure, mutation-sweep, coverage, pinning, fjs_run, size-guard, audit]

# Dependency graph
requires:
  - phase: 09-traceable-report-lines-and-the-anti-hardcoding-gate
    provides: fjs_run's pinning (EXEC-08), the vnd.fjs.run record (PROV-03), and PROV-07's
      anti-hardcoding mechanisms (zero-read gate, audit, perturbation gate)
provides:
  - An end-to-end proof, against a real separate process, that fjs_run's pin actually
    overrides the live head — the assertion that catches dropping `...pinFields` from
    fjsRunTool's own executeRun(...) call (E2)
  - Two proofs on fjsRunTool.handle itself covering the `pinned` computation and its
    threading into a persisted record (E1, E11)
  - Two proofs that a persisted run record cannot misreport its own `inputs`/`args`
    fields on either the error or ok arm (E12, E14)
  - Exact-byte-boundary proofs for sizeGuard's two thresholds (R1, R2)
  - A proof that the audit's string-before-comment stripping order is load-bearing (A1)
affects: [gap-closure, mutation-sweep-follow-ups]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "When a shipped handler cannot reach the outcome a proof needs under
      fjs/effects/node/virtual (the write/import split), put the decisive assertion in
      fjs-run-integration.test.js against a real separate process instead of substituting
      a fixture-level proof that bypasses the handler."
    - "A RunOutcome's error arm structurally permits a non-empty `reads` even though no
      current production path produces one — construct that outcome directly to prove
      handleRunOutcome's own record-assembly logic, independent of whether the interpreter
      ever exercises it that way today."
    - "Measure sizeGuard's boundary the same way sizeGuard measures it (tryUtf8 + bit_vec
      length/8n), never .length, and land content exactly on the threshold rather than
      comfortably either side of it."

key-files:
  created: []
  modified:
    - fjs/server/fjs_run/module.f.js
    - fjs/server/response/module.f.js
    - fjs/report/audit/module.f.js
    - fjs-run-integration.test.js

key-decisions:
  - "The E2 catch (pin overriding a live head through fjsRunTool.handle end to end) lives
    in fjs-run-integration.test.js, not in fjs/server/fjs_run/module.f.js's virtual proofs,
    because fjsRunTool.handle cannot reach a kind:'ok' RunOutcome under
    fjs/effects/node/virtual in a single call (the write/import representational split
    that module's own header documents) — a real separate process has no such limitation."
  - "E1 and E11 are covered at the fjsRunTool.handle/handleRunOutcome layer under virtual
    (not the integration test) because both are reachable without a materialize/import
    round trip: E1 via a short-circuiting missing-hash call, E11 by calling
    handleRunOutcome — fjsRunTool's own unchanged post-outcome logic — directly with a
    real ok outcome."
  - "E12's proof constructs a synthetic RunOutcome with kind:'error' and a non-empty
    `reads` rather than trying to reproduce a real mid-chain refusal that retains reads —
    the module's own header states no current production path does that, but
    handleRunOutcome's contract (persist whatever reads it is given) is independent of
    that fact and is what the mutation actually breaks."

requirements-completed: [EXEC-08, PROV-03, PROV-07]

# Metrics
duration: 65min
completed: 2026-08-06
---

# Phase 9 Plan 07: Gap Closure from a Systematic Mutation Sweep Summary

**Seven missing proofs closed: the pin path through the shipped `fjs_run` tool proven end-to-end against a real process, a run record's own claimed fields (`pinned`, `inputs`, `args`) proven un-fakeable on both arms, and the size guard's/audit's exact invariants pinned at their boundaries.**

## Performance

- **Duration:** ~65 min
- **Started:** 2026-08-05T20:38:00-07:00 (approx.)
- **Completed:** 2026-08-06T03:48:34Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments

- Closed the headline finding (E2): a pinned `fjs_run` call now has a decisive, real-process
  assertion that the RESULT reflects the pinned snapshot, not the live head — this is the
  assertion that fails the instant `...pinFields` is dropped from `fjsRunTool`'s own
  `executeRun(...)` call.
- Closed E1 and E11: `fjsRunTool.handle`'s `pinned` computation (`&&` vs `||`) and its
  threading into a successful run's persisted record are both proven directly against the
  shipped code paths.
- Closed E12 and E14: a persisted run record's `inputs` (error arm) and `args` (ok arm)
  are read back out of CAS and compared against what was actually observed/passed in,
  never trusted from the in-process value.
- Closed R1/R2: `sizeGuard`'s two `<=` boundaries (`previewBytes`, `guardBytes`) are now
  proven at the EXACT byte count, not just comfortably either side of it.
- Closed A1: the audit's "strings before comments" stripping order — previously asserted
  only in a comment — now has a test case (a URL literal) that fails if the order is
  reversed.

## Task Commits

Each task was committed atomically:

1. **Task 09-07-01: pin path through the shipped fjs_run tool** - `16c4fcd` (test)
2. **Task 09-07-02: run record self-report integrity (inputs/args)** - `5ca573a` (test)
3. **Task 09-07-03: size guard exact boundaries + audit stripping order** - `aafb546` (test)

**Plan metadata:** (this commit, made alongside this SUMMARY)

## Files Created/Modified

- `fjs/server/fjs_run/module.f.js` - Added `proof.fjsRunTool.pinIntegrity` (E1, E11) and
  `proof.fjsRunTool.recordIntegrity` (E12, E14).
- `fjs-run-integration.test.js` - Added the decisive pin-through-the-shipped-tool assertion
  (E2), against a real separate `node index.js` process.
- `fjs/server/response/module.f.js` - Added `proof.sizeGuard.exactBoundaries` (R1, R2).
- `fjs/report/audit/module.f.js` - Added
  `proof.stringContainingSlashSlashIsNotMisreadAsACommentStart` (A1).

## Decisions Made

See `key-decisions` in the frontmatter above. In short: E2 needed a real process because
`fjsRunTool.handle` cannot reach an `'ok'` `RunOutcome` under `fjs/effects/node/virtual` in
one call (the write/import representational split its own header documents); E1/E11/E12/E14
did not need that, and were proven directly against the shipped `fjsRunTool.handle` /
`handleRunOutcome` functions under `virtual`.

## Deviations from Plan

None - plan executed exactly as written. No production code was changed; every fix was a
new proof against already-correct, previously-unverified behavior, per the plan's own
framing ("These are missing PROOFS, not broken code").

## Issues Encountered

None. `tsc` flagged one unused-binding error (`e`/`evo`/`initEvo` left over from an earlier
draft of the E12 proof, which turned out not to need an `Evo` at all) during development;
removed before the first commit — not a deviation, just draft cleanup.

## Verification: The Seven Mutations, Before/After

Every mutation below was applied on top of this plan's own new proofs, confirmed to turn
`npm test` RED, then reverted (confirmed via `git status --porcelain` returning empty).

### 1. Delete `...pinFields` from `fjsRunTool`'s `executeRun(...)` call (E2)

Mutation:
```diff
-            executeRun(materializeHomeRoot)(cas)(evoApi)({
-                hash: args.hash,
-                args: programArgs,
-                ...pinFields,
-            }),
+            executeRun(materializeHomeRoot)(cas)(evoApi)({
+                hash: args.hash,
+                args: programArgs,
+            }),
```
Result: RED.
```
✖ TEST-01/TEST-02: fjs_run end to end through a real separate node index.js process...
  AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:
  + actual - expected
  + '["6cqdn06mdzvyxf2h20dsmrsqq91yem5axkbw39d7nq8c1wz3cgnr"]'
  - '["PINNED-INSTEAD-OF-LIVE-HEAD"]'
tests 270 / pass 269 / fail 1
```
Reverted. Confirmed clean (`git status --porcelain` empty).

### 2. `pinned`'s `&&` → `||` in `fjsRunTool.handle` (E1)

Mutation: `const pinned = args.subject !== undefined || args.parents !== undefined`
Result: RED.
```
✖ proof.fjsRunTool.pinIntegrity.subjectOnlyWithoutParentsPersistsPinnedFalse()
  [ true, false ]
tests 270 / pass 269 / fail 1
```
Reverted. Confirmed clean.

### 3. Ok-arm `pinned` hardcoded to `false` (E11)

Mutation: `pinned` field literal in the ok-arm record replaced with `pinned: false`.
Result: RED (caught by both a unit proof and the integration test).
```
✖ proof.fjsRunTool.pinIntegrity.successfulRunRecordsPinnedTrueWhenTheCallActuallyPinned()
  [ false, true ]
✖ TEST-01/TEST-02: fjs_run end to end through a real separate node index.js process...
  AssertionError: false !== true
tests 270 / pass 268 / fail 2
```
Reverted. Confirmed clean.

### 4. Error-arm `inputs` hardcoded to `[]` (E12)

Mutation: `inputs` field literal in the error-arm record replaced with `inputs: []`.
Result: RED.
```
✖ proof.fjsRunTool.recordIntegrity.errorArmPersistsReadsObservedBeforeTheFailure()
  [ 'expected the error record to carry the read observed before the failure', [] ]
tests 270 / pass 269 / fail 1
```
Reverted. Confirmed clean.

### 5. Ok-arm `args` hardcoded to `[]` (E14)

Mutation: `args` field literal in the ok-arm record replaced with `args: []`.
Result: RED.
```
✖ proof.fjsRunTool.recordIntegrity.okArmPersistsTheArgsActuallyPassedIn()
  [ '[]', '["distinctive-arg-alpha","distinctive-arg-beta"]' ]
tests 270 / pass 269 / fail 1
```
Reverted. Confirmed clean.

### 6. `sizeGuard`'s `<=` → `<` at `previewBytes` (R1)

Mutation: `if (bytes < previewBytes) {`
Result: RED.
```
✖ proof.sizeGuard.exactBoundaries.exactlyPreviewBytesInlinedInFullNotTruncated()
  [ true, false ]
tests 270 / pass 269 / fail 1
```
Reverted. Confirmed clean.

### 7a. `sizeGuard`'s `<=` → `<` at `guardBytes` (R2)

Mutation: `if (bytes < guardBytes) {`
Result: RED.
```
✖ proof.sizeGuard.exactBoundaries.exactlyGuardBytesTruncatedNotTooLarge()
  [ 'result too large; stored at HASH', 'xxxxxxxx' ]
tests 270 / pass 269 / fail 1
```
Reverted. Confirmed clean.

### 7b. Audit: comment-stripping moved before string-stripping (A1)

Mutation:
```diff
 const stripStringsAndComments = source => source
-    .replace(singleQuotedStringPattern, "''")
-    .replace(doubleQuotedStringPattern, '""')
-    .replace(templateLiteralPattern, '``')
-    .replace(lineCommentPattern, '')
-    .replace(blockCommentPattern, '')
+    .replace(lineCommentPattern, '')
+    .replace(blockCommentPattern, '')
+    .replace(singleQuotedStringPattern, "''")
+    .replace(doubleQuotedStringPattern, '""')
+    .replace(templateLiteralPattern, '``')
```
Result: RED.
```
✖ proof.stringContainingSlashSlashIsNotMisreadAsACommentStart()
  [ 0, 1 ]
tests 270 / pass 269 / fail 1
```
Reverted. Confirmed clean.

## Final Verification (unmutated)

```
npm test:              tests 270 / pass 270 / fail 0   (exit 0)
npm run test:integration: tests 1 / pass 1 / fail 0    (exit 0)
node --test 2>&1 | grep -c '^✔ import("./fjs/':  268   (> 261 baseline; +7 new leaves)
git status --porcelain: (empty)
```

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

All seven previously-undetected mutations from the systematic sweep of `fjs/server/*` and
`fjs/report/*` now turn the suite RED. No further known gaps from this sweep remain
unaddressed in this plan's scope (09-08 covers the remaining `fjs/exec`/`fjs/guest`/
`fjs/document` gaps from the same sweep, as a separate plan).

## Self-Check: PASSED

All modified files exist on disk and all three task commit hashes (`16c4fcd`, `5ca573a`,
`aafb546`) are present in `git log`.

---
*Phase: 09-traceable-report-lines-and-the-anti-hardcoding-gate*
*Completed: 2026-08-06*
