---
phase: 19-reproducibility-and-report-provenance
verified: 2026-08-12T16:56:54Z
status: passed
score: 4/4 must-haves verified
overrides_applied: 0
---

# Phase 19: Reproducibility and Report Provenance Verification Report

**Phase Goal:** A report says which tax year, which parameters and which program produced it, and
a pinned program run twice over a store that changed underneath it produces byte-identical output.
**Verified:** 2026-08-12
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP's four Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Run records carry `pinned: true\|false`, set meaningfully and read — not just present | ✓ VERIFIED | `fjs/run/module.f.js`'s `checkReferences` (lines 160-165) enforces the both-or-neither invariant. `fjs/report/provenance/module.f.js`'s `countsTowardReproducibilityAcceptance` reads `run.pinned`. **Mutation Gate M2 independently re-run by this verifier**: `&&` → `\|\|` at `fjs/server/fjs_run/module.f.js:475` reddened `fjsRunTool.pinIntegrity.subjectOnlyWithoutParentsPersistsPinnedFalse` via an uncaught `assert` inside `handleRunOutcome`'s record assembly — exactly the mechanism the SUMMARY described. Restored byte-identical (`git status --porcelain` empty), suite re-confirmed green (6314/6314). |
| 2 | Report output states the tax year, the parameter-set hash, and the program hash alongside the figures, framed as a reviewed estimate | ✓ VERIFIED | `fjs/server/fjs_run/module.f.js`'s response envelope and persisted `vnd.fjs.run` record carry `taxYear`, `paramSetHash`, `programHash`, `reviewedEstimateFraming` (lines 364-404). Unit proof `responseShape.tenKeysExactlyAndResultAlwaysResolvable` hand-counts all ten keys including all four provenance fields (lines 1090-1133). **Real-process assertion confirmed**: `fjs-run-integration.test.js:342-344` asserts `parsed.taxYear === 2025`, a non-empty `parsed.paramSetHash`, and `parsed.programHash === programHash` against a genuine `fjs_run` response over a live MCP session. |
| 3 | Re-running a pinned program over the same inputs reproduces byte-identically, verified adversarially (amended revision between two runs; mutation makes it drift, watched red) | ✓ VERIFIED | `fjs-run-integration.test.js` lines 489-620: the unpinned **control** leg is built and observed to move (`assert.notEqual(controlBytes1, controlBytes2)`, line 552) strictly **before** the pinned leg's stability is asserted (`resultHash` equality line 619, fetched-byte equality line 620) — satisfying the "control leaf is not optional" rule literally. **Mutation Gate M1 independently re-run by this verifier**: mutated `buildRunSnapshot`'s pinned branch in `fjs/server/fjs_run/snapshot/module.f.js` to resolve the live head instead of `pin.parents`; `npm test` reddened to exactly **6309/6314** (5 failures), matching the SUMMARY's reported red set verbatim, including the masking behavior (the whole-integration-test failure surfaced the pre-existing pin proof at line 461, not the new PROV-05 line, because it's one `test()` block). Built a throwaway diagnostic copy with only the pre-existing pin assertions disabled and confirmed the new PROV-05 assertion (`pinnedRun1.resultHash === pinnedRun2.resultHash`, line 619) independently reddens with its own distinct actual/expected hash pair. Restored the mutation byte-identical (`git diff`/`git status --porcelain` empty), full suite re-confirmed green (6314/6314). |
| 4 | `paramSetHash` is derived, never hand-written, and does not contradict or duplicate Phase 15's `programHash`-implies-parameter-equality finding | ✓ VERIFIED | `fjs/report/provenance/module.f.js:67-71`: `paramSetHash` derives via `tryUtf8(jsonText(taxParamSet))` → `computeSync(sha256)` → `vecToCBase32` — no hand-written literal. Docstring (lines 21-37) states the guest-path/host-path distinction explicitly and crisply: `programHash` covers the guest-program path (parameters baked in as literals, unreachable by import), `paramSetHash` covers the host-engine path (`form1040Report`'s parameter-set argument) — the exact distinction the phase's own CONTEXT.md demanded, without contradicting `fjs/report/amend/module.f.js`'s Phase 15 finding. Four proof leaves (determinism, content-sensitivity, decodability, cross-check against `fileCas`'s own hash of identical bytes) all present and passing. |

**Score:** 4/4 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `fjs/report/provenance/module.f.js` | `paramSetHash`, `reviewedEstimateFraming`, `countsTowardReproducibilityAcceptance`, each proof-covered | ✓ VERIFIED | Exists, substantive (7 proof leaves), imported and used by both `fjs/server/fjs_run/module.f.js` and `fjs-run-integration.test.js` |
| `fjs/run/module.f.js` (`runSchema`) | `taxYear`/`paramSetHash` as REQUIRED fields | ✓ VERIFIED | Lines 108-122; `checkReferences` unchanged both-or-neither invariant preserved |
| `fjs/server/fjs_run/module.f.js` | `taxYear` on tool schema, envelope widened to ten keys, unknown-year refusal | ✓ VERIFIED | `fjsRunInputSchema` REQUIRED `taxYear`; `unknownTaxYearRefused`/`missingTaxYearRejectedByToolEntry` leaves present (lines 1493-1520-ish); envelope confirmed ten keys |
| `fjs-run-integration.test.js` | PROV-05 control-then-pinned proof, PROV-04 real-response assertions | ✓ VERIFIED | Present, control precedes pinned assertion, both hash-string and fetched-byte checks present |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `fjsRunTool` handler | `paramSetHash`/`reviewedEstimateFraming` | import + call at response/record assembly | WIRED | `fjs/server/fjs_run/module.f.js:140,364-404` |
| `fjs-run-integration.test.js` | `countsTowardReproducibilityAcceptance` | import + call against two real CAS-fetched run records | WIRED | Lines 62, 627-640 |
| `buildRunSnapshot` (pinned branch) | pinned reproduction proof | `pin.parents` override | WIRED, mutation-confirmed | M1 re-run above |
| `handleRunOutcome`'s `pinned` derivation | `subjectOnlyWithoutParentsPersistsPinnedFalse` | `&&` boundary | WIRED, mutation-confirmed | M2 re-run above |

### Behavioral Spot-Checks / Suite State

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full suite green | `npm test` | tests 6314, pass 6314, fail 0, exit 0 | ✓ PASS |
| De-duplicated project-local proof count | `node --test 2>&1 \| grep '^✔ import("./fjs/' \| sed 's/ ([0-9.]*ms)$//' \| sort -u \| wc -l` | 916 (baseline 907, +9: 7 from `fjs/report/provenance` + 2 from `taxYearHandling`) | ✓ MATCHES REPORTED |
| `tsc --noEmit` | `npx tsc --noEmit` | exit 0 | ✓ PASS |
| Mutation Gate M1 re-run | mutate `buildRunSnapshot`, run `npm test`, isolate, restore | 6309/6314 red set matches SUMMARY exactly; PROV-05 leaf independently confirmed reddening; restored byte-identical, suite green | ✓ PASS |
| Mutation Gate M2 re-run | `&&` → `\|\|` in `fjs_run`'s `pinned` derivation, run `npm test`, restore | `subjectOnlyWithoutParentsPersistsPinnedFalse` reddened via uncaught assert exactly as reported; restored byte-identical, suite green | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| EXEC-13 | 19-01, 19-03 | `pinned` flag set meaningfully and read; "only pinned runs count toward reproducibility acceptance" | ✓ SATISFIED (with caveat — see below) | `checkReferences` invariant, mutation-confirmed derivation, `countsTowardReproducibilityAcceptance` exercised against two real CAS-fetched run records in 19-03 |
| PROV-04 | 19-01, 19-02, 19-03 | Report states tax year, parameter-set hash, program hash | ✓ SATISFIED | Envelope + record widened; real-process assertion present |
| PROV-05 | 19-01, 19-03 | Pinned reproduction byte-identical, verified adversarially | ✓ SATISFIED | Control-then-pinned proof; both mutation gates independently re-run and confirmed |

No orphaned requirements — REQUIREMENTS.md maps exactly these three to Phase 19, and all three appear in the plans' `requirements-completed` frontmatter.

**Caveat on EXEC-13's second sentence, examined rather than glossed over (per the verification brief's explicit instruction):**
`countsTowardReproducibilityAcceptance` is a correctly-implemented, mutation-tested pure predicate that reads `run.pinned`. A repo-wide grep (`grep -rn "\.pinned\b" fjs --include="*.f.js"`) confirms its only call sites are: its own proof (hand-typed fixtures), and `fjs-run-integration.test.js` (two real, CAS-fetched run records, added in 19-03). **There is no production code path anywhere in this codebase that branches behavior on this predicate's output** — no gate, no filter, no refusal. The commit history shows this was noticed and taken seriously: EXEC-13 was marked complete after 19-01, explicitly reverted as premature (`14942a9`, "An available function is not an enforced property"), and re-marked complete only after 19-03 added a real, non-fixture caller. That re-closure is a defensible reading of the requirement given that the actual "reproducibility acceptance" activity (Phase 14) is owner-skipped and needs the taxpayer's filed return — there is genuinely no production consumer for this predicate to gate *within this project's current scope*, and 19-CONTEXT.md recorded that scoping decision in writing before execution, not after the fact. The second sentence is TRUE in the sense that the correct eligibility criterion is codified, proven, and now exercised against real data; it is NOT true in the sense that some production pipeline enforces it as a gate — none exists. This is a scope boundary, not a hidden defect, and is surfaced here for the record rather than silently accepted.

### Anti-Patterns Found

None. Scanned every file this phase touched (`fjs/report/provenance/module.f.js`, `fjs/run/module.f.js`, `fjs/report/amend/module.f.js`, `fjs/media/dialects/module.f.js`, `fjs/server/fjs_run/module.f.js`, `fjs/server/module.f.js`, `fjs-run-integration.test.js`, `payer-report-integration.test.js`, `fjs/server/fjs_run/snapshot/module.f.js`) for `TBD|FIXME|XXX|TODO|HACK|PLACEHOLDER` and prose stubs (`placeholder|coming soon|will be here|not yet implemented|not available`) — zero matches across all nine files.

### Verified Adversarial Claims (from the verification brief)

1. **"The unpinned control moved."** CONFIRMED. `assert.notEqual(controlBytes1, controlBytes2)` at `fjs-run-integration.test.js:552` genuinely asserts inequality (not merely observes it via a comment), and it is ordered strictly before the pinned assertions at lines 619-620.
2. **"Mutation Gate M1 reddened the new PROV-05 assertion, masked by the pre-existing pin proof."** CONFIRMED by independent re-run — same 6309/6314 red set, same masking mechanism, same isolation result (PROV-05's own assertion reddens independently with its own distinct hash pair once the pre-existing pin block's assertions are disabled in a throwaway, uncommitted copy). Restore verified byte-identical.
3. **"Mutation Gate M2 reddened `subjectOnlyWithoutParentsPersistsPinnedFalse`."** CONFIRMED by independent re-run — identical failure mechanism (uncaught record-assembly `assert`, not an `isError` mismatch). Restore verified byte-identical.
4. **EXEC-13's completion judgment.** Examined explicitly above — judged SATISFIED as a scope-bounded closure (predicate correct, proven, and now exercised against real data; no production gate exists because none is in scope while Phase 14 is skipped), not silently accepted.
5. **ROADMAP criterion 4's guest-path/host-path distinction.** CONFIRMED present verbatim in the module docstring (lines 21-37 of `fjs/report/provenance/module.f.js`), stating the distinction crisply without contradicting Phase 15's finding.

### Human Verification Required

None. Per 19-VALIDATION.md's own standard ("this phase must add zero `human_needed` items... every property is mechanically checkable"), every claim in the verification brief was independently re-run or grepped rather than deferred, including both mutation gates.

### Cross-Reference: Parallel Code Review Findings

A parallel `19-REVIEW.md` (deep code review, distinct from this goal-backward verification) was
found alongside this report at completion time. Its `WR-01` independently reaches the same
conclusion this report's EXEC-13 caveat reaches (an available function is not, by itself, an
enforced property). Its `WR-02` is a genuine, independently-confirmed documentation-accuracy
finding worth carrying forward even though it does not invalidate any of the four ROADMAP success
criteria:

- **`paramSetHash`'s docstring calls its serialization "canonical"; the underlying `fjs/json`
  primitive is explicitly documented as the opposite** — `fjs/json/module.f.js`'s own docstring
  states `stringify` writes keys in **source order**, not sorted, and warns "never hash a
  re-serialization of a parsed value and expect the original address." Confirmed by direct read
  (`fjs/json/module.f.js:28`). Today this is harmless because `paramSetHash` is only ever called
  on the single `taxParamsByYear[year]` object reference, so key order never varies for a given
  year across the current codebase — none of the 7 proof leaves tests order-independence. This
  does not fail ROADMAP criterion 4 (`paramSetHash` is still derived, not hand-written, and does
  not contradict Phase 15's finding) but the docstring's word "canonical" overclaims what
  `jsonText` actually guarantees, and a future refactor that reorders `taxParamsByYear`'s object
  literal (e.g. a `{ ...base, ...override }` merge) would silently change `paramSetHash` for a
  tax year whose dollar figures never moved — a false "the parameter set changed" signal.
  **Recommendation, not a blocker:** either sort keys before hashing, or correct the docstring's
  wording to state the true, narrower guarantee.

This does not change the status of this verification — none of the four ROADMAP success criteria
depend on serialization being genuinely canonical, only on `paramSetHash` being derived rather
than hand-written, which it is.

### Gaps Summary

No gaps. All four ROADMAP success criteria hold under independent re-verification, including two independently re-executed mutation gates that reproduced the exact reported red sets and were restored byte-identical. The one item requiring judgment (EXEC-13's "gates something" framing) was examined rather than assumed, and is recorded as a scope caveat rather than a defect — the predicate is correct and now exercised against real data, and no production consumer exists for it to gate because the actual acceptance activity (Phase 14) remains owner-skipped.

---

_Verified: 2026-08-12T16:56:54Z_
_Verifier: Claude (gsd-verifier)_
