---
phase: 11-wage-retirement-and-benefit-documents
verified: 2026-08-08T00:00:00Z
status: passed
score: 4/4 must-haves verified
overrides_applied: 0
---

# Phase 11: Wage, Retirement, and Benefit Documents Verification Report

**Phase Goal:** Every non-brokerage document the declared profile produces can be stored, listed,
and retracted.
**Verified:** 2026-08-08
**Status:** passed
**Re-verification:** No — initial verification

## Method

This is goal-backward, code-first verification. Every claim below was checked against the actual
source files in `fjs/`, not against SUMMARY.md prose. Both BLOCKING mutation gates (M1, M2) were
independently re-run by this verifier (not merely re-read from the SUMMARYs) with a full mutate →
observe-red → restore → re-confirm-green cycle, and both behaved exactly as claimed. `npx tsc
--noEmit` (exit 0), the full suite (`node --test`: 2782/2782, 0 fail), and the project-local proof
count (`grep -c '^✔ import("./fjs/'`: 544, up from a 492 baseline) were all independently
re-measured, not read from a SUMMARY.

## Goal Achievement

### The Four Roadmap Success Criteria

| # | Success Criterion | Status | Evidence |
|---|---|---|---|
| 1 | `vnd.fjs.w2` (delivered Phase 5) — boxes 15-20 remain a repeating array no computation reads | ✓ VERIFIED (not re-done) | `git diff --stat` against the pre-phase-11 base shows Phase 11 touched no `fjs/document/w2/*` file. `git diff --stat <base> HEAD -- fjs/tax fjs/return` is empty — no computation was added anywhere that could read W-2 boxes 15-20. The constraint survives unspent. |
| 2 | `vnd.fjs.ssa1099`/`vnd.fjs.1099r` round-trip with every box explicitly absent-able, box lists read from source | ✓ VERIFIED | Read both dialect files in full (`fjs/document/1099r/module.f.js`, `fjs/document/ssa1099/module.f.js`). Every box field is `option(...)`; only the five identity/subject-key fields (`payerTin`, `recipientTin`, `accountNumber`, `taxYear`, `formRevision`) are required, matching the established family convention (`fjs/document/1099int`, `fjs/document/w2` do the same — DOC-01's subject-key precedent, not a new deviation). No `"0"` stand-in for "not printed" found. Module docstrings name exact source URLs (`irs-pdf/f1099r.pdf`, `irs-prior/f1099r--2025.pdf`, `irs-pdf/p915.pdf`) and the SSA-1099 docstring explicitly states it is NOT an IRS form and that Pub 915's illustration is a labeled SAMPLE — the honesty requirement this phase's brief specifically worried about is met, not silently skipped. |
| 3 | `finance_documents_list` enumerates stored documents with dialect, tax year, subject | ✓ VERIFIED | `fjs/server/finance_documents_list/module.f.js` exists, exports `financeDocumentsListTool`, returns `{subject, dialect, taxYear?, hash}`. Registered into `financeMcpHandlers` (`fjs/server/module.f.js:149`) and exercised in the same commit by a real, separate-process integration test (`fjs-run-integration.test.js:312-321`) that asserts (post-review-fix) ALL three seeded subjects appear, not merely one. |
| 4 | A wrongly ingested document can be `archived`; the filter decision is enforced by a `proof` | ✓ VERIFIED | `fjs/server/fjs_run/snapshot/module.f.js`'s `buildRunSnapshot` excludes archived-flagged revisions from `heads`/`revisions`; the module docstring documents the exact `evo_add` retraction call; `proof.archivedRevisionUnreachable.adversarialAndControl` (adversarial + control) and `.undecodableHeadStaysObservable` (WR-01's post-review refinement) both exist and pass. Both BLOCKING mutation gates were independently re-run by this verifier (see below) and behaved exactly as claimed. |

**Score:** 4/4.

### Independent Mutation Gate Re-Verification (not merely re-read from SUMMARY)

| Gate | Mutation applied by this verifier | Observed result | Restored |
|---|---|---|---|
| M1 (DOC-15) | `decodedArchived` forced to `false` in `fjs/server/fjs_run/snapshot/module.f.js` | Exactly one leaf reddened: `proof.archivedRevisionUnreachable.adversarialAndControl`. `undecodableHeadStaysObservable` (the WR-01 leaf) stayed green — confirms the orchestrator's claimed orthogonality between the two leaves under different mutations. | Yes — `git status --porcelain` clean afterward, `npx tsc --noEmit` exit 0, full suite 2782/2782 green. |
| M2 (DOC-11) | Removed `'box3BenefitsPaid'` from `moneyBoxFields` in `fjs/document/ssa1099/module.f.js`, left `expectedMoneyBoxFieldCount = 4` unchanged | `proof.checkReferences.moneyBoxExactness.everyMoneyBoxIsCovered` reddened; project-local count dropped 544 → 542 (the removed box's own generated leaf plus the count assertion). | Yes — restored byte-identical, count back to 544, suite green. |

Both gates are genuinely load-bearing, independently confirmed — not merely repeated from the
SUMMARYs' own claims.

### Code Review and Fix Cycle

`11-REVIEW.md` found 0 critical / 3 warning / 1 info issues. `11-REVIEW-FIX.md` claims all four
fixed. Verified directly against the current source, not the fix report's prose:

| Finding | Verified fix present in source |
|---|---|
| WR-01 (heads filter conflated "archived" with "failed to decode") | `FoldState`/`archivedHashes` exists in `fjs/server/fjs_run/snapshot/module.f.js`; `withHeads` filters on `state.archivedHashes[h] !== true`, not on absence from `revisions`. New leaf `undecodableHeadStaysObservable` present and green. |
| WR-02 (`payerTin` invariant undocumented-but-unenforced) | `fjs/document/ssa1099/module.f.js:126-128` — `checkReferences` now rejects `r.payerTin !== ''`. Control leaf `nonEmptyPayerTinRejected` present. |
| WR-03 (weak `.some()` integration assertion) | `fjs-run-integration.test.js:318-321` uses `[subjectA, subjectB, subjectC].every(...)`, not `.some()`. |
| IN-01 (`'unknown'` sentinel docstring too narrow) | `fjs/server/finance_documents_list/module.f.js` docstring broadened; fixture (3b) and leaf `wrongTypeDialectFieldUsesSentinel` present and green. |

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `fjs/document/1099r/module.f.js` | `vnd.fjs.1099r` dialect, full box inventory | ✓ VERIFIED | 490 lines; every box `option(...)`; box 7a is `option(array(string))` (list, not code/amount pair); `stateLocal` repeating array proven with two same-state rows; percentage boxes (8b, 9a) excluded from `moneyFieldError`, proven by a dedicated leaf. |
| `fjs/document/ssa1099/module.f.js` | `vnd.fjs.ssa1099` dialect, sourced from Pub 915 | ✓ VERIFIED | 309 lines; `payerTin` always `''`, enforced (post-WR-02) not just documented; source is Pub 915, explicitly stated as SSA-issued and a labeled SAMPLE. |
| `fjs/server/finance_documents_list/module.f.js` | `financeDocumentsListTool`, MCP-08 | ✓ VERIFIED | 449 lines; active/archived split, unknown-dialect passthrough, non-JSON skip, one-row-per-(subject,head), 8 proof leaves, all traced to real source above. |
| `fjs/server/fjs_run/snapshot/module.f.js` | DOC-15 archived-filtering fix | ✓ VERIFIED | `withBlobsAndRevisions`/`withHeads` filter on `archived`; `blobs`/`buildHostMap` left untouched (the honest, documented boundary — "raw `blobs` stay unfiltered" is stated explicitly, not overclaimed as "archived data is unreachable"). |
| `fjs/server/finance_schema/module.f.js` | `dialectSchemas` bumped 5→7 | ✓ VERIFIED | `expectedKnownDialectCount = 7`; both `oneZeroNineNineRResolves`/`ssa1099Resolves` compare against `toJsonSchema(...)` called directly on the imported schema const, never a hand-written literal. |
| `fjs/server/module.f.js` | Registers `finance_documents_list` | ✓ VERIFIED | Import + array entry + `proof.session.toolsListEnumeratesComposedRegistry` assertion, all present. |
| `fjs-run-integration.test.js` | Real-process call for the new tool, same commit as registration | ✓ VERIFIED | `call('finance_documents_list', {})` present, asserting all three seeded subjects (strengthened post-WR-03). |

### Key Link Verification

| From | To | Via | Status |
|---|---|---|---|
| `1099r`/`ssa1099` `checkReferences` | `money_field`'s `moneyFieldError` | per-box loop | ✓ WIRED — confirmed by reading both files' loops and their `moneyBoxExactness` generated-leaf proofs |
| Both new schemas | `base(dialect)` | spread first | ✓ WIRED |
| `buildRunSnapshot`'s fold | `revResult[1].archived` | same accumulator step | ✓ WIRED |
| `finance_schema`'s `dialectSchemas` | `oneZeroNineNineRSchema`/`ssa1099Schema` | import + map entry | ✓ WIRED |
| `financeMcpHandlers` | `financeDocumentsListTool` | import + array entry | ✓ WIRED |
| `fjs-run-integration.test.js`'s `toolsCalled` | `advertisedTools` equality | same-commit `call(...)` | ✓ WIRED — the ordering constraint was watched failing live per 11-05-SUMMARY.md and independently reconfirmed present in the diff |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|---|---|---|---|---|
| DOC-08 | 11-01, 11-04 | `vnd.fjs.ssa1099` | ✓ SATISFIED | Dialect file exists, registered in `finance_schema`, both marked `[x]` in REQUIREMENTS.md |
| DOC-09 | 11-01, 11-04 | `vnd.fjs.1099r` | ✓ SATISFIED | Same, plus full TY2026/TY2025-diffed box inventory |
| DOC-15 | 11-02 | Retraction story + enforced filter decision | ✓ SATISFIED | Fix + adversarial/control proof + both mutation gates independently re-confirmed |
| MCP-08 | 11-03, 11-05 | `finance_documents_list` | ✓ SATISFIED | Tool exists, registered, real-process-tested |
| TEST-03 (claimed by 11-05) | 11-05 | Real-process coverage added same-commit as new tool/dialect | ✓ SATISFIED | `fjs-run-integration.test.js` call landed in commit `da7acae` alongside the registry change; ordering constraint verified live by mutation |

**Note on `.planning/REQUIREMENTS.md`'s Traceability table:** the per-requirement checkbox list
(lines ~107, 228-241, 396) correctly marks DOC-08, DOC-09, DOC-15, MCP-08, TEST-03 as `[x]`
complete. The separate "Traceability" table further down (lines ~543-587) still shows `Pending`
for these same IDs — but this is a pre-existing staleness pattern affecting many already-verified
phases in that same table (e.g. MCP-06/MCP-07/TAX-01/TAX-02, from Phases 7-8, also show `Pending`
despite being shipped and verified). This is not a Phase 11 regression; it is exactly the kind of
gap Phase 17 ("Documentation Truth Pass", MAINT-02/03) exists to sweep. Not a Phase 11 gap.

### Scope Discipline (be-skeptical checklist)

- `fjs/tax/` and `fjs/return/`: **untouched** (`git diff --stat <base> HEAD -- fjs/tax fjs/return` empty).
- `package.json`/`package-lock.json`: **untouched** — no new dependency.
- `any`, cast over indexed access, non-null assertion: **none found** in any of the 7 files this
  phase touched (grepped for `\bany\b`, `as unknown as`, `!.`/`!;` — all hits were prose in JSDoc
  comments, not code).
- Debt markers (`TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER`): **none found** in any touched file.

### Anti-Patterns Found

None. No stub returns, no hardcoded empty data flowing to output, no placeholder text, no
unresolved debt markers in any file this phase created or modified.

### Human Verification Required

None. The phase's own "Manual-Only Verifications" table (11-VALIDATION.md) names two paper-source
checks (the 1099-R box inventory against the IRS PDF, the SSA-1099 box inventory against Pub 915) —
both were performed at research/execution time and their sources are named verbatim in the module
docstrings with exact URLs, satisfying the phase's own bar for "recorded, not silently trusted."
No further human action is needed to close this phase.

### Gaps Summary

None. All four roadmap success criteria hold under direct source inspection; both BLOCKING mutation
gates were independently re-executed by this verifier (not merely re-read) and behaved exactly as
claimed; all four code-review findings are genuinely fixed in the current source; scope stayed
within `fjs/document/*` and `fjs/server/*`, never touching `fjs/tax/`/`fjs/return/`; no forbidden
patterns (`any`, unchecked casts, non-null assertions, debt markers) were introduced.

---

_Verified: 2026-08-08_
_Verifier: Claude (gsd-verifier)_
