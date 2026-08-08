---
phase: 11-wage-retirement-and-benefit-documents
reviewed: 2026-08-07T00:00:00Z
depth: standard
files_reviewed: 7
files_reviewed_list:
  - fjs/document/1099r/module.f.js
  - fjs/document/ssa1099/module.f.js
  - fjs/server/finance_documents_list/module.f.js
  - fjs/server/fjs_run/snapshot/module.f.js
  - fjs/server/finance_schema/module.f.js
  - fjs/server/module.f.js
  - fjs-run-integration.test.js
findings:
  critical: 0
  warning: 3
  info: 1
  total: 4
status: issues_found
---

# Phase 11: Code Review Report

**Reviewed:** 2026-08-07
**Depth:** standard
**Files Reviewed:** 7
**Status:** issues_found

## Summary

Reviewed the two new dialects (`vnd.fjs.1099r`, `vnd.fjs.ssa1099`), the new
`finance_documents_list` MCP tool, the DOC-15 retraction-filtering logic in
`fjs_run/snapshot`, the dialect registry, the server composition root, and the
real-process integration test, against AGENTS.md's conventions and
11-CONTEXT.md's locked decisions.

The box-shape work is careful and internally consistent: every box is
`option(...)`, `corrected`/checkbox fields use `option(true)` with no `false`
member, percentages/dates/years are correctly excluded from the money-exactness
loop, the state/local repeating array mirrors W-2's precedent, hand-typed count
constants are present and correctly bumped (7 dialects, 10 scalar money boxes,
4 state/local money fields, 4 SSA-1099 money boxes), and the conditional-spread
discipline is followed correctly at the one site (`finance_documents_list`)
that builds an object with a genuinely optional field. No hardcoded secrets,
`eval`, non-null assertions, `any`, or debug artifacts were found in the
reviewed files.

I traced the DOC-15 `heads`/`revisions` filtering in
`fjs/server/fjs_run/snapshot/module.f.js` specifically for the failure mode
named in the review brief — a revision that fails to decode for a reason other
than being archived, and whose head is therefore dropped even though the
document is active. Under the store's normal invariants (every head hash was
itself produced by a successful `evo.add`, so it must decode) this path
requires an already-inconsistent store to trigger, and the two filters cannot
literally "disagree" because `heads` is derived from the exact same
`state.revisions` map `revisions` itself builds. But the map's exclusion
reason is genuinely overloaded — see WR-01 below — and nothing in the code
distinguishes "archived" from "failed to decode/read" once a hash is missing
from that map, unlike the careful defensive comments elsewhere in the same
file for parallel "should not happen" branches.

Two further gaps: an invariant stated as load-bearing in `ssa1099`'s module
docstring (`payerTin` is ALWAYS `''`) is not actually enforced anywhere the
schema or `checkReferences` could catch a violation, and one assertion in the
real-process integration test is weaker than its own comment claims.

## Warnings

### WR-01: DOC-15's `heads` filter cannot distinguish "archived" from "failed to decode/read"

**File:** `fjs/server/fjs_run/snapshot/module.f.js:162-233`
**Issue:** `withBlobsAndRevisions` (lines 162-200) populates `state.revisions[hashStr]`
only when BOTH `cas.read(hash)` succeeds AND `evoApi.revision(hashStr)` decodes
successfully AND `revResult[1].archived !== true`. Absence from `revisions` is
therefore used for two semantically different reasons: (a) the hash names a
deliberately archived revision (the intended DOC-15 exclusion), and (b) the
hash's blob could not be read, or its bytes did not decode as a valid
`RevisionData` at all (an internal inconsistency — a "should not happen" per
this project's own convention for similar branches elsewhere in this file).

`withHeads` (lines 211-233) then computes `activeHeadHashes = headHashes.filter(h
=> state.revisions[h] !== undefined)` — reusing that same map without any way
to tell which of the two reasons applied. If a head hash for a genuinely
ACTIVE, non-archived document ever fails to decode/read (e.g. store
corruption, or a future decode-format mismatch between what `evo.add` wrote
and what `evoApi.revision` now expects), its head is silently dropped from
`heads`, making the subject indistinguishable from an unknown or fully
archived one to every guest report program — exactly the failure mode the
review brief warned is worse than the bug DOC-15 fixes, and it produces no
diagnostic anywhere.

This does not fire under the store's current normal operation (a head hash is
only ever produced by a prior successful `evo.add`, so it should always
decode), so this is not a reachable defect today — it is a latent one: the
"archived" case and the "corrupt/undecodable" case share one representation
with no way to recover which occurred, and the file's own docstring for this
section ("Reuse that SAME filtered map...") only documents the intended
archived case, not this overload.
**Fix:** Track the exclusion reason explicitly rather than collapsing both into
one map, e.g. keep `revisions` as today (successfully-decoded, non-archived)
but also build a `resolvableHashes: ReadonlySet<string>` of every hash that at
least decoded (regardless of `archived`), and filter `heads` as
`headHashes.filter(h => resolvableHashes.has(h) === false ? /* log/refuse: store inconsistency */ : state.revisions[h] !== undefined)`,
or simply add a code comment plus a proof pinning that an undecodable-but-not-archived
head hash is a distinguishable, loudly-surfaced condition rather than a silent
drop. At minimum, document this overload explicitly next to the "honest
boundary" section that already exists for `blobs`.

### WR-02: `ssa1099`'s "`payerTin` is always `''`" invariant is documented but not enforced

**File:** `fjs/document/ssa1099/module.f.js:22-28, 123-138`
**Issue:** The module docstring states as a hard rule: "`payerTin` is ALWAYS
stored as `''`... do not invent a fake SSA EIN to fill this field." The schema
(line 74) types `payerTin: string` — any non-empty string is structurally
legal — and `checkReferences` (lines 123-138) never checks `r.payerTin`. So
`validate({ ...minimal, payerTin: '99-9999999' })` validates `ok`, silently
violating the one invariant the module singles out as deliberate and
load-bearing. Every other checkbox-style invariant in this dialect family
(`corrected`, the six 1099-R checkboxes) is enforced structurally via
`option(true)`; this one is enforced only by a comment and by the fact that no
ingestion code exists yet to write anything else. When a `from_ocr` converter
for `vnd.fjs.ssa1099` is eventually built (currently deferred per
11-CONTEXT.md), nothing here would catch it writing a real-looking TIN into
this field.
**Fix:** Enforce it in `checkReferences`, mirroring the existing
`formRevision.trim() === ''` check:
```js
if (r.payerTin !== '') {
    return error(`payerTin must be the empty string for vnd.fjs.ssa1099 (SSA-1099 prints no payer TIN)`)
}
```
and add a proof leaf that a non-empty `payerTin` is refused (the existing
`payerTinEmptyStringRoundTrips` leaf only proves the accepted case, never the
rejected one — "a gate needs a control", AGENTS.md).

### WR-03: Integration test's `finance_documents_list` assertion is weaker than the reachability claim it's cited for

**File:** `fjs-run-integration.test.js:306-320`
**Issue:** The comment above this call states this is "the decisive
reachability proof this SAME-commit ordering constraint exists to require",
exercising the three subjects (`subjectA`/`B`/`C`) seeded earlier in the same
real session. But the assertion at line 318-320 is:
```js
assert.ok(
    documentsListed.some(entry => entry.subject === subjectA || entry.subject === subjectB || entry.subject === subjectC),
    ...)
```
`.some(...)` passes if only ONE of the three subjects appears. A real-process
regression that drops two of the three subjects from the listing (e.g. a bug
that only follows the first head returned by `evo.list()`, or that stops after
the first `foldStep` iteration) would still pass this test, because the
unit-level proofs in `finance_documents_list/module.f.js` run under `virtual`
against a synthetic store, not against this real-process seeded data.
**Fix:** Assert all three are present, matching the strength already used
elsewhere in this same test file for other tools:
```js
assert.ok(
    [subjectA, subjectB, subjectC].every(
        s => documentsListed.some(entry => entry.subject === s)),
    `expected finance_documents_list to include all three seeded subjects: ${JSON.stringify(documentsListed)}`)
```

## Info

### IN-01: `documentIdentitySchema`'s `'unknown'` sentinel also fires on a present-but-mistyped `dialect`, not only a missing one

**File:** `fjs/server/finance_documents_list/module.f.js:174-177`
**Issue:** The module header documents the `'unknown'` sentinel specifically
for "a parsed snapshot that is well-formed JSON but carries NO `dialect` field
at all." In the actual code, `t === 'error'` (from
`rttiValidate(documentIdentitySchema)(parsed)`) also occurs when `dialect` IS
present but is the wrong JSON type (e.g. `dialect: 123`), and that case is
folded into the same `'unknown'` sentinel by `dialect = t === 'ok' && identity.dialect
!== undefined ? identity.dialect : 'unknown'`. Behaviorally this is a
reasonable, defensive superset of the documented case (never crashes, never
lies about the tag), but the docstring's narrower framing could mislead a
future reader auditing exactly what `'unknown'` means.
**Fix:** Either broaden the docstring's wording to say "no dialect field, or a
dialect field of the wrong type," or add a short proof leaf (a document with
`dialect: 123`) pinning that this case is intentionally covered by the same
sentinel.

---

_Reviewed: 2026-08-07_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
