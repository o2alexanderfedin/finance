---
phase: 19-reproducibility-and-report-provenance
plan: 01
subsystem: reporting/provenance
tags: [functionalscript, sha256, content-addressing, cbase32, provenance, reproducibility]

requires:
  - phase: 15-realism-polish-and-upstream
    provides: "fjs/report/amend's programHash comparability finding (the Q2 precedent this module's docstring restates without contradicting)"
provides:
  - "fjs/report/provenance/module.f.js: paramSetHash (content hash over a TaxParamSet), reviewedEstimateFraming (the framing constant), countsTowardReproducibilityAcceptance (EXEC-13's predicate)"
affects: [19-02, 19-03]

tech-stack:
  added: []
  patterns:
    - "computeSync(sha256) — the one-shot SHA-2 primitive, first use anywhere in this repo's fjs/ (every prior sha256 call site went through fileCas's streaming write)"
    - "jsonText(domainValue) called directly on a specific, non-generic typed object (TaxParamSet), no JsonUnknown cast — confirmed against fjs/server/finance_tax_params/module.f.js:157's existing precedent"

key-files:
  created:
    - fjs/report/provenance/module.f.js
  modified: []

key-decisions:
  - "No cast needed for jsonText(taxParamSet): PATTERNS.md's own excerpt showed a /** @type {JsonUnknown} */ cast, but fjs/server/finance_tax_params/module.f.js:157 already calls jsonText(response) directly on a TaxParamSet-shaped value (including the `ceiling: string | undefined` required-field case) with no cast, under the same tsconfig. Verified empirically with tsc before writing the final version; the cast was dropped."
  - "taxParamsByYear is imported after the '── Tests ──' banner, not at the top-level import block — production code above the banner never references it, keeping paramSetHash generic over any TaxParamSet."
  - "grep -c \"computeSync\" is 2, not the plan's stated 1: an import line and a call line are two distinct lines, so 1 is unreachable while satisfying the acceptance criterion's own parenthetical ('imported once, called once'). Removed an incidental docstring mention that had pushed the count to 3; 2 is the correct value for the stated intent."

patterns-established:
  - "Pattern: paramSetHash's exact chain (tryUtf8 -> computeSync(sha256) -> vecToCBase32, no cas.write) is the reusable model for any future one-shot content fingerprint that does not need to be retrievable."

requirements-completed: [EXEC-13, PROV-04]

duration: ~35min
completed: 2026-08-12
---

# Phase 19 Plan 01: Report Provenance Primitives Summary

**`fjs/report/provenance/module.f.js` — a content-hash fingerprint over a `TaxParamSet` reusing `computeSync(sha256)` (functionalscript's one-shot hash, zero prior call sites in this repo), the verbatim "reviewed estimate" framing constant, and EXEC-13's `run.pinned`-reading acceptance predicate — all proof-covered and mutation-gate-verified, zero consumers yet.**

## Performance

- **Duration:** ~35 min
- **Completed:** 2026-08-12
- **Tasks:** 2 (both landed in one file, one commit)
- **Files modified:** 1 (new file)

## Accomplishments

- `paramSetHash(taxParamSet: TaxParamSet) => string` — `tryUtf8(jsonText(taxParamSet))` through `computeSync(sha256)` then `vecToCBase32`, cross-checked against `fileCas`'s own hash of the identical bytes (not a hand-typed literal).
- `reviewedEstimateFraming` — the exact PROV-04 framing string, carried verbatim including the em dash.
- `countsTowardReproducibilityAcceptance(run: Run) => boolean` — EXEC-13's consumer-side predicate, reading `run.pinned` alone, deliberately not re-deriving `fjs/run/module.f.js`'s `checkReferences` both-or-neither invariant.
- Module docstring restates the Q2 `programHash`-vs-`paramSetHash` distinction (guest-program literals vs. host-engine parameter set) in the module's own words, without contradicting `fjs/report/amend/module.f.js`.
- All 7 proof leaves (4 for `paramSetHash`, 1 for `reviewedEstimateFraming`, 2 for `countsTowardReproducibilityAcceptance`) individually mutated and watched red, then restored byte-identical.

## Task Commits

Both tasks (paramSetHash/reviewedEstimateFraming, and the EXEC-13 predicate) landed as edits to the same single new file, so they were committed together as one atomic commit — splitting it would have meant committing a half-written module with an unused type import:

1. **Tasks 1+2: `fjs/report/provenance/module.f.js`** — `d42cc2d` (feat)

**Plan metadata:** captured in this SUMMARY; STATE.md/ROADMAP.md updates follow.

## Files Created/Modified

- `fjs/report/provenance/module.f.js` — `paramSetHash`, `reviewedEstimateFraming`, `countsTowardReproducibilityAcceptance`, plus 7 proof leaves.

## Decisions Made

- **Dropped the `/** @type {JsonUnknown} */` cast that 19-PATTERNS.md's own excerpt showed.** `jsonText(taxParamSet)` typechecks directly with no cast. Verified against the live precedent at `fjs/server/finance_tax_params/module.f.js:157` (`jsonText(response)`, where `response: TaxParamsResponse` structurally nests the same `ceiling: string | undefined` required-field shape `TaxParamSet` has), then confirmed empirically with `npx tsc --noEmit` before finalizing. This satisfies AGENTS.md's no-cast rule more directly than the plan's own suggested snippet.
- **`grep -c "computeSync"` is 2, not the plan's stated 1.** The acceptance criterion's own parenthetical ("imported once, called once inside `paramSetHash`") describes two distinct lines (an `import` statement and a call site), which `grep -c`'s line-counting can never collapse to 1. Removed an incidental third mention from the module docstring so the count sits at the true minimum (2) rather than 3. Documented here rather than silently reinterpreting the plan's acceptance number.
- **`taxParamsByYear` imported after the Tests banner**, not at the top import block, per the plan's explicit instruction — keeps `paramSetHash` visibly generic over any `TaxParamSet` in the production code above the banner.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — style/consistency, not a defect] Dropped the `JsonUnknown` cast the plan's interfaces section modeled**
- **Found during:** Task 1 (writing `paramSetHash`)
- **Issue:** 19-PATTERNS.md's own code excerpt and the plan's action text both showed `jsonText(/** @type {JsonUnknown} */ (taxParamSet))`. AGENTS.md and this plan's own non-negotiables forbid a cast unless no cast-free route exists, and instruct to stop and report if one seems needed — but a cast-free route did exist.
- **Fix:** Called `jsonText(taxParamSet)` directly with no cast, verified clean under `npx tsc --noEmit`, and cross-checked against the existing `fjs/server/finance_tax_params/module.f.js:157` precedent which does the identical thing today.
- **Files modified:** `fjs/report/provenance/module.f.js` (production body only; no `Unknown as JsonUnknown` type import was ever added, so there was nothing to remove).
- **Verification:** `npx tsc --noEmit` exit 0; `npm test` 6310/6310.
- **Committed in:** `d42cc2d`

---

**Total deviations:** 1 (a simplification found safe by direct empirical check, not a defect or missing feature)
**Impact on plan:** None negative — the shipped code is simpler and has one fewer type import than the plan's own sketch, with no cast anywhere in the file.

## Issues Encountered

None blocking. The `grep -c "computeSync"` acceptance number in the plan (`1`) is unreachable given both an import line and a call line must exist; resolved by reasoning through the acceptance criterion's own stated intent (see Decisions above) rather than treating it as a blocker.

## Mutation-Gate Verification (AGENTS.md: "a proof is not known to work until you have watched it fail")

Every one of the 7 proof leaves was independently mutated, watched red under `npm test`/`node --test all.test.js`, then restored byte-identical (confirmed via `git status --short` showing only the untracked-then-committed file, no diff noise).

| Leaf | Mutation | Result |
|---|---|---|
| `reviewedEstimateFraming` | em dash `—` → hyphen `-` | Only `reviewedEstimateFraming` reddened |
| `countsTowardReproducibilityAcceptance.{rejectsAnUnpinnedRun,acceptsAPinnedRun}` | `run.pinned` → `!run.pinned` | Both arms reddened (predicted) |
| `countsTowardReproducibilityAcceptance.{rejectsAnUnpinnedRun,acceptsAPinnedRun}` | `run.pinned` → `run.pinned \|\| true` | Only `rejectsAnUnpinnedRun` reddened — confirms the two arms are independently load-bearing, not one leaf silently covering both |
| `paramSetHash.{sensitiveToTheParameterSetsContent,matchesFileCassOwnHashOfTheIdenticalBytes}` | dropped `standardDeduction` from the hashed object (`{ ...taxParamSet, standardDeduction: undefined }`) | Reddened exactly those two leaves; `deterministicForTheSameInput`/`producesADecodableHash` stayed green (predicted) |
| `paramSetHash.{producesADecodableHash,matchesFileCassOwnHashOfTheIdenticalBytes}` | appended `'!'` (outside the cBase32 alphabet) to the returned hash | Reddened exactly those two leaves; determinism/sensitivity stayed green (predicted) |
| `paramSetHash.matchesFileCassOwnHashOfTheIdenticalBytes` | `computeSync(sha256)([bytes, bytes])` — double-hashing, diverging from the exact primitive `fileCas` uses on identical bytes | Reddened **only** this one leaf — direct proof that T-19-01-01's independent CAS cross-check is the sole leaf that would catch a derivation drifting away from the primitive CAS itself uses; no other leaf could have caught it |
| `paramSetHash.deterministicForTheSameInput` | appended `String(Math.random())` to the return | Reddened `deterministicForTheSameInput` as predicted, **plus** `producesADecodableHash` (the random decimal's `.` breaks cBase32 decoding) and `matchesFileCassOwnHashOfTheIdenticalBytes` — a wider actual red set than predicted, recorded per AGENTS.md's own note that a mutation's predicted red set is itself a claim and is sometimes wrong |

After each mutation, `npx tsc --noEmit` was confirmed clean (every mutation compiled) and the exact line was restored, re-verified with a fresh `grep`/`python3 -c` read of the em-dash line and a final `npm test` (6310/6310) plus `git status --short` (only the file itself, no diff).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `fjs/report/provenance/module.f.js` is ready for Plan 19-02 to wire `paramSetHash`/`taxYear`/`programHash` into `fjs_run`'s response envelope, and for Plan 19-03 to consume `countsTowardReproducibilityAcceptance` in the real-process reproducibility proof.
- No existing proof, tool surface, or file outside `fjs/report/provenance/module.f.js` was touched — `npm test` is unaffected apart from the 7 new leaves (907 → 914 de-duplicated project-local proofs).
- The `Unknown as JsonUnknown` type import the plan anticipated needing was never added — Plan 19-02/19-03 authors should not assume this module casts anything; it doesn't.

## Self-Check: PASSED

- `fjs/report/provenance/module.f.js` — FOUND
- `.planning/phases/19-reproducibility-and-report-provenance/19-01-SUMMARY.md` — FOUND
- Commit `d42cc2d` — FOUND in `git log --oneline --all`

---
*Phase: 19-reproducibility-and-report-provenance*
*Completed: 2026-08-12*
