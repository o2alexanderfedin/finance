---
phase: 11-wage-retirement-and-benefit-documents
fixed_at: 2026-08-08T00:00:00Z
review_path: .planning/phases/11-wage-retirement-and-benefit-documents/11-REVIEW.md
iteration: 1
findings_in_scope: 4
fixed: 4
skipped: 0
status: all_fixed
---

# Phase 11: Code Review Fix Report

**Fixed at:** 2026-08-08
**Source review:** .planning/phases/11-wage-retirement-and-benefit-documents/11-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 4 (0 critical, 3 warning, 1 info)
- Fixed: 4
- Skipped: 0

## Fixed Issues

### WR-01: DOC-15's `heads` filter cannot distinguish "archived" from "failed to decode/read"

**Files modified:** `fjs/server/fjs_run/snapshot/module.f.js`
**Commit:** `1aeaf48`
**Applied fix:** Implemented the design decision rather than merely documenting it. Added an
internal `FoldState` type (`RunSnapshot & { archivedHashes: Readonly<Record<string, true>> }`)
carried through `buildRunSnapshot`'s fold, populated in the SAME fold step that already decodes
each hash (no second pass). `revisions` keeps excluding archived hashes exactly as before.
`withHeads` now filters on `archivedHashes` instead of on absence-from-`revisions`, so a head hash
that fails to decode/read stays in `heads` and `ctx.evoRevision` on it throws the actionable
`revision not found` refusal again (the pre-11-02 behaviour, restored) — only hashes KNOWN
archived are dropped. The fold-internal `archivedHashes` field is stripped back off before
`buildRunSnapshot` returns, so it never appears on the public `RunSnapshot`. Updated the module
header's DOC-15 section and the `RunSnapshot`/`heads` docstring to state the distinction
explicitly.

Added proof leaf `archivedRevisionUnreachable.undecodableHeadStaysObservable`, seeded via the
already-exported `syncRevision` primitive (the same one `cas_add`'s own handler uses to fold a
raw-written revision into the cache) with a deliberately mismatched hash/value pair — reproducing
the store inconsistency `evo.add` cannot produce by construction (every hash it assigns as a head
is the hash of bytes it itself just wrote as a valid revision, so it can never be undecodable).
This was seedable without contorting the test; no honest "not seedable" disclaimer was needed.

**Mutation Gate M1, re-run and both properties confirmed:**
1. Reverting the archived filtering (forcing `decodedArchived` to `false`) reddened
   `proof.archivedRevisionUnreachable.adversarialAndControl` — confirmed via `node --test`, exactly
   one project-local proof turned red (541 → 540 passing), with the actual failure output:
   `[ '["c22zzfvy88et32fjr9fbtjw1dbe0sve7d03d2yyaat6a1nasvb7r"]', '[]' ]` (expected `[]`, a live head
   hash leaked through).
2. The control leaf `buildRunSnapshotResolvesTheStore.blobsSubjectsHeadsAndRevisions` (an ACTIVE
   subject resolving end to end) stayed green throughout.
3. As an additional check specific to the new proof leaf: reverting `withHeads`'s filter back to
   the OLD `state.revisions[h] !== undefined` check reddened exactly the new
   `undecodableHeadStaysObservable` leaf (and only that one), confirming the new leaf is
   load-bearing and independently catches a regression to the pre-fix behavior.
4. Both mutations restored exactly; `git status --porcelain` empty after each restore, confirmed
   by re-running `npx tsc --noEmit` (clean) and `node --test` (0 fail) before committing.

### WR-02: `ssa1099`'s "`payerTin` is always `''`" invariant is documented but not enforced

**Files modified:** `fjs/document/ssa1099/module.f.js`
**Commit:** `42fc918`
**Applied fix:** Added `if (r.payerTin !== '') { return error(...) }` to `checkReferences`,
mirroring the existing `formRevision.trim() === ''` idiom, exactly as the review's fix suggestion
specified. Added `checkReferences.nonEmptyPayerTinRejected` as the control leaf to the existing
`validate.payerTinEmptyStringRoundTrips` (which only proved the accepted case).

**Verification:** Removing the check reddened exactly `nonEmptyPayerTinRejected` (confirmed via
`node --test`, with the actual failure showing `validate({...payerTin: '99-9999999'})` returning
`'ok'` instead of `'error'`); restored exactly, `tsc` clean, 543/543 project-local proofs green.

### WR-03: Integration test's `finance_documents_list` assertion is weaker than the reachability claim it's cited for

**Files modified:** `fjs-run-integration.test.js`
**Commit:** `333366d`
**Applied fix:** Replaced the `.some(A || B || C)` assertion (passes if only one of three seeded
subjects appears) with `[subjectA, subjectB, subjectC].every(s => documentsListed.some(entry =>
entry.subject === s))`, exactly as the review's fix suggestion specified, so the assertion now
proves what its own comment ("the decisive reachability proof") claims.

**Verification:** Temporarily commented out `subjectC`'s seeding call and re-ran the real-process
integration test (`node --test fjs-run-integration.test.js`); the strengthened assertion failed
with `AssertionError: expected finance_documents_list to include all three seeded subjects: [...]`
naming the two subjects that DID appear and omitting the dropped one — confirming the assertion
now actually catches a dropped subject, which the original `.some()` form would have passed
silently. Restored the seeding line exactly; `tsc` clean, 543/543 project-local proofs green, full
integration test green.

### IN-01: `documentIdentitySchema`'s `'unknown'` sentinel also fires on a present-but-mistyped `dialect`, not only a missing one

**Files modified:** `fjs/server/finance_documents_list/module.f.js`
**Commit:** `3ab9717`
**Applied fix:** Broadened the module header's "The `'unknown'` sentinel" docstring to state
explicitly that the sentinel fires both when `dialect` is absent AND when it is present with the
wrong JSON type, since both fail `documentIdentitySchema`'s structural validation the same way.
Also added a new seeded fixture case (3b: a well-formed document with `dialect: 123`) and a new
proof leaf `wrongTypeDialectFieldUsesSentinel`, pinning that this case is intentionally covered by
the same `'unknown'` sentinel rather than merely assumed — per the review's fix suggestion's second
option (docstring broaden AND proof leaf, both applied rather than choosing only one, since the
combination was low-risk and self-contained within the same file).

**Verification:** `tsc` clean; the new leaf passes (544/544 project-local proofs green, up from
543 after WR-02/WR-03). No mutation gate was run for this leaf specifically — IN-01 is a
docstring/coverage gap, not a behavior defect (the review's own summary confirms: "behaviorally
this is a reasonable, defensive superset... never crashes, never lies about the tag"), so the
existing code path was already correct; the new leaf pins already-correct behavior under test
rather than fixing a bug.

## Skipped Issues

None — all four findings (0 critical, 3 warning, 1 info) were fixed.

## Final Verification

- `npx tsc --noEmit`: clean (exit 0) after every commit and at the end.
- `node --test`: 546 total tests, 546 pass, 0 fail.
- Honest project-local metric (`node --test 2>&1 | grep -c '^✔ import("./fjs/'`): **544**, up from
  the stated baseline of 541 by the three new proof leaves added (WR-01's
  `undecodableHeadStaysObservable`, WR-02's `nonEmptyPayerTinRejected`, IN-01's
  `wrongTypeDialectFieldUsesSentinel`) — no decrease, per the gate requirement.
- `git status --porcelain`: empty.
- Each of the four commits verified individually via `git ls-tree HEAD -- <file>` after
  committing, per this project's own convention (never `git diff --cached` before committing).
- No finding was judged a false positive; all four were real, applicable defects/gaps and were
  fixed as specified (WR-01 with the design decision actually implemented, not merely documented,
  per the review's explicit instruction).

---

_Fixed: 2026-08-08_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
