---
phase: 11-wage-retirement-and-benefit-documents
plan: 02
subsystem: execution-spine
tags: [fjs_run, buildRunSnapshot, evo, archived, retraction, DOC-15, mutation-testing]

# Dependency graph
requires:
  - phase: 07
    provides: buildRunSnapshot/buildHostMap (the synchronous RunSnapshot host map fjs_run's guest report programs read through)
provides:
  - buildRunSnapshot excludes archived-flagged revisions from `heads` and `revisions`, closing the guest-vocabulary path to a retracted document's head/revision/bytes
  - A documented, proof-enforced `evo_add` retraction recipe (parents, subject, archived:true, snapshot omitted)
  - An adversarial + control proof pair (archivedRevisionUnreachable) exercising the real ctx.evoList('true') -> evoHead -> evoRevision attack path
  - A recorded, watched Mutation Gate M1 confirming the proof is load-bearing
affects: [12-brokerage-documents, 13-tax-computation-for-wage-retirement-benefit-income, 14-acceptance-against-filed-return]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Fold an access-control filter into the SAME accumulator step that already has the decoded value in scope, rather than a separate pass afterward"
    - "Reuse an already-filtered map (state.revisions) to derive a second filtered set (activeHeadHashes) rather than re-deriving the same boolean a second way"

key-files:
  created: []
  modified:
    - fjs/server/fjs_run/snapshot/module.f.js

key-decisions:
  - "buildRunSnapshot's withBlobsAndRevisions excludes any hash whose decoded RevisionData carries archived:true from `revisions`, at the exact accumulator step that already holds revResult[1]"
  - "buildRunSnapshot's withHeads filters each subject's head hashes to only those surviving that same revisions filter (state.revisions[h] !== undefined) — one rule, one place, per AGENTS.md"
  - "blobs and buildHostMap are left completely untouched; the honest boundary (a party holding the exact SNAPSHOT hash can still casRead it) is documented in the module docstring rather than papered over"
  - "The adversarial proof asserts on interpret()'s Result error arm, not a JS throw — interpret (fjs/exec/module.f.js) catches the handler's raw throw internally and converts it into Result's error arm via refusalMessage, verified empirically; PLAN.md's phrasing ('throws') is honored in spirit (assert type + content of the refusal, never merely that something failed) rather than literally, since interpret never re-throws to its caller"

patterns-established:
  - "Mutation Gate protocol: revert the two functional conditions (keep the docstring), confirm the exact predicted leaf reddens with the exact predicted assertion failure, restore verbatim, confirm git diff against HEAD is empty of stray edits"

requirements-completed: [DOC-15]

# Metrics
duration: 20min
completed: 2026-08-07
---

# Phase 11 Plan 02: Close the buildRunSnapshot archived-visibility gap (DOC-15) Summary

**`buildRunSnapshot` now excludes archived-flagged revisions from `heads`/`revisions`, closing the gap RESEARCH.md's Q3 found by reading the shipped Phase 7 code directly: a guest report program could previously call `ctx.evoList('true')` and walk `evoHead -> evoRevision -> casRead` straight into a retracted document's bytes.**

## Performance

- **Duration:** ~20 min (16:13:49 -> 16:29:14, per commit timestamps)
- **Started:** 2026-08-07T23:13:49Z
- **Completed:** 2026-08-07T23:29:14Z
- **Tasks:** 2 completed
- **Files modified:** 1 (`fjs/server/fjs_run/snapshot/module.f.js`)

## Accomplishments

- Closed the load-bearing DOC-15 gap RESEARCH.md found: `11-CONTEXT.md`'s claim that "archived
  revisions are invisible to a report program, by construction" is now actually true of the
  shipped code, not merely true by convention.
- `buildRunSnapshot`'s `heads`/`revisions` folds now exclude anything an `archived: true`
  revision touches, reusing the SAME already-decoded `revResult[1].archived` flag already in
  scope at each accumulator step — no separate pass, no second way of deriving "is this
  archived".
- Documented the exact `evo_add` retraction call (`parents`, `subject`, `archived: true`,
  `snapshot` omitted) in the module's own header docstring, describing the SAME mechanism the
  new proof seeds — Success Criterion 4's "documentation plus a proof", not two independently
  maintained accounts of one guarantee.
- Added `archivedRevisionUnreachable.adversarialAndControl`: an adversarial proof that walks the
  documented attack path end to end (`ctx.evoList('true')` first, confirming the archived
  subject's NAME is still discoverable, THEN `ctx.evoHead`/`ctx.evoRevision`), paired with a
  control leaf on a second, wholly active subject in the same store proving the filter is
  selective, not a blanket break.
- Ran Mutation Gate M1 (BLOCKING): reverted the fix, watched the exact predicted leaf go RED
  with the exact predicted failure content, restored the fix verbatim, confirmed `git status`
  clean and the suite green again.
- Every pre-existing proof in the file (`hostMap.*`, `buildRunSnapshotResolvesTheStore.*`)
  still passes unchanged.

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix `buildRunSnapshot` to exclude archived-flagged revisions from `heads`/`revisions`** - `30c765c` (fix)
2. **Task 2: Adversarial + control proof, and Mutation Gate M1** - `4f34e42` (test)

**Plan metadata:** (this commit, docs: complete plan)

## Files Created/Modified

- `fjs/server/fjs_run/snapshot/module.f.js` - `withBlobsAndRevisions` now excludes any hash
  whose decoded `RevisionData` carries `archived: true` from `revisions`; `withHeads` filters
  each subject's head hashes to only those surviving that same filter; module docstring gained
  a "Retraction (DOC-15)" section documenting the exact `evo_add` call and the guarantee's
  honest boundary; new `proof.archivedRevisionUnreachable.adversarialAndControl` leaf.

## Decisions Made

- **The adversarial proof asserts against `interpret`'s `Result` error arm, not a caught JS
  `throw`.** PLAN.md's action text says "assert `interpret(buildHostMap(snapshot))
  (guestCtx.evoRevision(archivedHead))` throws". Empirically (verified by direct execution,
  not assumed — see Mutation Gate section below and the scratch reproduction run), `interpret`
  (`fjs/exec/module.f.js` lines 158-179) wraps `match(map)(e)` in its own `try`/`catch` and
  converts ANY throw from the dispatched handler — including `buildHostMap`'s own
  `revision not found: ${hash}` bare-string throw — into `error(refusalMessage(thrown, map))`,
  i.e. it returns a `Result`, never re-throws to its own caller. This is consistent with how
  every other proof in this file that goes through `interpret` (`typeChecksAgainstOperationMap`,
  `pinOverridesTheLiveHead`) reads a `[t, v]` tuple rather than using `try`/`catch` — only
  `casReadOnAbsentHashThrowsAPlainString`, which calls `buildHostMap(...).casRead` DIRECTLY
  (bypassing `interpret`), observes a real JS throw. The new proof honors the INTENT behind
  PLAN.md's phrasing (assert the refusal's type and content, never merely that "something"
  failed — the exact discipline `casReadOnAbsentHashThrowsAPlainString`'s own MERGE NOTE
  documents) by asserting `revResult[0] === 'error'`, `typeof thrown === 'string'`,
  `!(thrown instanceof Error)`, and `thrown.includes(archivedHead)` against the Result's error
  arm — the layer at which `interpret` actually surfaces the refusal to a caller that goes
  through it (as a real guest report program always does).
- **`heads[subject]` for an archived-only subject resolves to `[]`, not to a shorter but
  non-empty list.** Confirmed exactly as RESEARCH.md's fix design predicted: after the
  archiving `evo_add`, the previously-active head is superseded (named as the archiving
  revision's parent) and the archiving revision itself is filtered out of `revisions`, so
  neither hash survives `activeHeadHashes`'s filter — the subject is indistinguishable from an
  unknown one, to a report program.

## Deviations from Plan

None - plan executed exactly as written, with one clarification (documented above under
"Decisions Made") on how PLAN.md's "throws" language maps onto `interpret`'s actual, verified
runtime behavior (a Result error arm, not a re-thrown value) — the assertion strength and
discipline PLAN.md required (type + content, never a bare pass) is preserved unchanged.

## Mutation Gate M1 (BLOCKING) — full record

Per `11-02-PLAN.md` Task 2 and `11-VALIDATION.md`, this is the phase's single BLOCKING gate.
All five steps were actually run, not paraphrased.

**Step 1 — Revert Task 1's fix.** Reverted the two functional conditions to their pre-fix form
(kept the module docstring; only the two `revisions`/`activeHeadHashes` computations were
reverted), keeping the local binding used (per AGENTS.md's "a mutation that orphans a binding
does not compile" lesson) so the mutation would actually typecheck and run:

```diff
-                            revisions: revResult[0] === 'ok' && revResult[1].archived !== true
+                            revisions: revResult[0] === 'ok'
                                 ? { ...state.revisions, [hashStr]: jsonText(revResult[1]) }
                                 : state.revisions,
...
-                    const activeHeadHashes = headHashes.filter(h => state.revisions[h] !== undefined)
+                    const activeHeadHashes = headHashes
                     return pure({ ...s, heads: { ...s.heads, [subject]: activeHeadHashes } })
```

`npx tsc --noEmit` still exited 0 under this mutation (confirmed before running the suite —
the mutation is real, not a compile-time no-op).

**Step 2 — Run and confirm RED.** Actual command output:

```
$ node --test 2>&1 | grep -c '^✔ import("./fjs/'
531
```

(Down from 532 at the end of Task 2, before the revert — exactly one leaf lost.)

```
✖ failing tests:

test at node_modules/functionalscript/fjs/effects/node/module.js:269:31
✖ import("./fjs/server/fjs_run/snapshot/module.f.js").proof.archivedRevisionUnreachable.adversarialAndControl() ... (6.442333ms)
  [ '["c22zzfvy88et32fjr9fbtjw1dbe0sve7d03d2yyaat6a1nasvb7r"]', '[]' ]
```

The failing assertion is `assertEq(JSON.stringify(snapshot.heads['subjectS']), JSON.stringify([]))`
— the actual value `["c22zzfvy88..."]` is the archived revision's own hash, exactly the predicted
failure: with the fix reverted, the archived-only subject's demoted-but-unfiltered head
resurfaces in `heads['subjectS']` instead of resolving to `[]`. No other leaf in the file
reddened — the pre-existing `buildRunSnapshotResolvesTheStore.*`/`hostMap.*` proofs seed only
active subjects, so they are unaffected by this specific mutation, confirming the new proof
is the ONLY thing in this file that actually exercises the archived path.

**Step 3 — Restore the fix exactly.** Re-applied the exact inverse of the Step 1 diff (not
retyped from memory — the same two lines, restored to Task 1's committed form):

```diff
-                            revisions: revResult[0] === 'ok'
+                            revisions: revResult[0] === 'ok' && revResult[1].archived !== true
                                 ? { ...state.revisions, [hashStr]: jsonText(revResult[1]) }
                                 : state.revisions,
...
-                    const activeHeadHashes = headHashes
+                    const activeHeadHashes = headHashes.filter(h => state.revisions[h] !== undefined)
                     return pure({ ...s, heads: { ...s.heads, [subject]: activeHeadHashes } })
```

**Step 4 — Confirm `git status` clean relative to the intended (fix-present) state.**

```
$ git diff fjs/server/fjs_run/snapshot/module.f.js   # against the Task 1 commit, before Task 2's proof was staged
```

showed ONLY Task 2's new `archivedRevisionUnreachable` proof-group addition — no residue from
the revert/restore cycle. `git status --porcelain` at that point showed exactly
`M fjs/server/fjs_run/snapshot/module.f.js` (the not-yet-committed Task 2 addition), with no
extra hunks anywhere else in the file.

**Step 5 — Re-run and confirm restored GREEN, at or above the post-Task-2 count.**

```
$ npx tsc --noEmit && echo TSC_OK
TSC_OK
$ node --test 2>&1 | grep -c '^✔ import("./fjs/'
532
$ node --test 2>&1 | grep -E "archivedRevisionUnreachable|✖"
✔ import("./fjs/server/fjs_run/snapshot/module.f.js").proof.archivedRevisionUnreachable.adversarialAndControl() ... (6.030708ms)
```

No `✖` lines — the mutation gate is closed. `npm test` (full suite, `tsc && node --test`) was
also re-run afterward and reported `tests 2770, pass 2770, fail 0`.

**Conclusion:** the proof is load-bearing, not decoration (AGENTS.md's "a proof is not known to
work until you have watched it fail"). Reverting the fix reddens exactly the predicted leaf with
exactly the predicted failure value; restoring it returns the suite to green with a clean git
tree, and Task 2's commit (`4f34e42`) contains only the new proof, with the fix itself already
committed separately in Task 1 (`30c765c`).

## Verification Against Plan's must_haves

- **"A guest report program's `ctx.evoHead` on an archived-only subject returns `[]`"** —
  proven directly (`headT === 'ok'`, `headV[0] === JSON.stringify([])`).
- **"A guest report program's `ctx.evoRevision` on an archived revision's exact hash throws
  'revision not found', even when that hash is supplied directly as `fjs_run` args"** — proven
  at the layer `interpret` surfaces it (`Result`'s error arm), asserting the message includes
  the archived hash — the archiving revision's hash is `archiveAddResult[1]`, passed DIRECTLY
  to `guestCtx.evoRevision(...)` exactly as a smuggled-hash attacker would via `fjs_run`'s
  `args`, not derived from `evoHead`'s own (now-empty) result.
- **"An active subject's head/revision/snapshot remain reachable exactly as before the fix
  (control case)"** — proven: `subjectActive`'s head/revision resolve unchanged through the
  identical `buildHostMap` call, and the pre-existing `buildRunSnapshotResolvesTheStore` proofs
  (which seed only active subjects) still pass unchanged.
- **"Reverting the fix (Mutation Gate M1) turns the new adversarial proof RED; restoring it
  turns the suite green again, with `git status` clean afterward"** — recorded in full above.
- **"The module docstring documents the exact `evo_add` call that retracts a document ...
  alongside the proof"** — see the "Retraction (DOC-15)" section added to the module header,
  which names the exact same mechanism (`parents`, `subject`, `archived: true`, `snapshot`
  omitted) the proof seeds.

## Threat Model Disposition (from 11-02-PLAN.md)

- **T-11-02-01 (mitigate)** — closed by this plan's fix; proven adversarially and confirmed by
  the watched-red Mutation Gate M1 above, not merely by convention.
- **T-11-02-02 (accept, residual)** — `blobs` stays unfiltered; stated explicitly in the module
  docstring's "honest boundary" paragraph so a future reader does not mistake the guarantee for
  something stronger than it is. No code change required or made for this disposition.

## Issues Encountered

None blocking. One clarification required reconciling PLAN.md's literal phrasing against
`interpret`'s actual runtime behavior (see "Decisions Made" above) — resolved by direct
empirical verification (a throwaway reproduction script run against the real, already-fixed
module, then deleted) before writing the final assertion, per AGENTS.md's "reproduce a claim
before recording it."

## Next Phase Readiness

- DOC-15 is now fully closed: recorded (module docstring) AND enforced (proof), with the
  enforcement half proven load-bearing by a watched mutation.
- Phase 11's remaining plans (03-05, per STATE.md) can proceed; this plan touched only
  `fjs/server/fjs_run/snapshot/module.f.js` and did not touch `fjs/tax/` or `fjs/return/`.
- Project-local proof count: 531 -> 532 (RISEN, per the phase's verification requirement).

---
*Phase: 11-wage-retirement-and-benefit-documents*
*Plan: 02*
*Completed: 2026-08-07*

## Self-Check: PASSED

- FOUND: `fjs/server/fjs_run/snapshot/module.f.js`
- FOUND: `.planning/phases/11-wage-retirement-and-benefit-documents/11-02-SUMMARY.md`
- FOUND commit `30c765c` (Task 1: fix)
- FOUND commit `4f34e42` (Task 2: test)
- `grep -c "archivedRevisionUnreachable" fjs/server/fjs_run/snapshot/module.f.js` = 2 (docstring reference + proof group)
