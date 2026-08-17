---
phase: 15
slug: realism-polish-and-upstream
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-11
---

# Phase 15 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `15-RESEARCH.md`'s "Validation Architecture" section.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node's built-in `node:test`, driven via FunctionalScript's Emergent Testing (`proof` exports discovered by `all.test.js`) |
| **Config file** | none — `tsconfig.json` (strict) governs typecheck; `package.json`'s `"test": "tsc && node --test"` governs the run |
| **Quick run command** | `npx tsc --noEmit` then `node --test 2>&1 \| grep '^✔ import("./fjs/' \| sed 's/ ([0-9.]*ms)$//' \| sort -u \| wc -l` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~8 min full suite (6166 tests); typecheck alone ~30s |

> **De-duplicate the proof count.** The bare `grep -c` form double-counts whenever the
> `functionalscript` submodule is initialized — the submodule's own `all.test.js` re-scans the
> same working directory, so every finance proof prints twice. Measured on `e36ef1a`: `grep -c`
> reports 1690, de-duplicated is 845, and CI (no submodule) independently reports 845. See
> STATE.md "Test metrics".

---

## Sampling Rate

- **After every task commit:** `npx tsc --noEmit` + de-duplicated proof count (fast fail)
- **After every plan wave:** `npm test` (full suite, including both real-process tests)
- **Before `/gsd-verify-work`:** Full suite green
- **Phase gate:** `npm test` green **plus** a manual mutation sweep on the two highest-risk new
  computations — the carryover worksheet and the amendment diff. AGENTS.md's standing rule: a
  proof is not known to work until you have watched it fail.
- **Max feedback latency:** ~30s per task (typecheck), ~8 min per wave

---

## Per-Task Verification Map

| Req ID | Behavior | Test Type | Automated Command | File Exists | Status |
|--------|----------|-----------|-------------------|-------------|--------|
| PROV-08 | Payer-summary report runs through real `fjs_run`, no engine change | unit + real-process | `node --test all.test.js`; `node --test fjs-run-integration.test.js` | ❌ W0 | ⬜ pending |
| PROV-08 | `fjs/report/payer` imports nothing from `fjs/tax/*` | mechanical gate | `node --test <new-gate>.test.js` | ❌ W0 | ⬜ pending |
| PROV-06 | Two same-program runs diff to A/B/C, with `B = C − A` | unit | `node --test all.test.js` | ❌ W0 | ⬜ pending |
| PROV-06 | Mismatched `programHash` refuses loudly | unit | `node --test all.test.js` | ❌ W0 | ⬜ pending |
| TAX-17 | Carryover Worksheet lines 1–13 match the printed worksheet on a worked example | unit | `node --test all.test.js` | ❌ W0 | ⬜ pending |
| TAX-17 | Absent carryover document → `0n` on Sch. D lines 6/14; present-but-broken → named refusal | unit | `node --test all.test.js` | ❌ W0 | ⬜ pending |
| TAX-17 | No bare `2025` literal survives in computation paths (scoped) | mechanical gate | `node --test <new-gate>.test.js` | ❌ W0 | ⬜ pending |
| MCP-09 | `fjs_check` confirms export shape **without executing** | unit | `node --test all.test.js` | ❌ W0 | ⬜ pending |
| DOC-16 | `detect` recognizes every registered dialect and falls through on unknown | unit | `node --test all.test.js` | ❌ W0 | ⬜ pending |
| DOC-16 | `detect` reachable from a real running path, not merely registered | real-process | integration-test extension | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

**On the TAX-17 worked example:** the expected side must be hand-computed independently and must
**not** be produced by the code under test (AGENTS.md). This is the phase's single most
falsifiable proof — a worksheet that agrees with itself proves nothing.

**On the MCP-09 never-executes proof:** mirror the existing
`dirtySourceIsRefusedWithoutEvaluatingTheModuleBody` spy technique — assert the loaded module's
own side effect never fires. "It returned quickly" is not evidence of non-execution.

---

## Wave 0 Requirements

- [ ] The Capital Loss Carryover Worksheet module — with a proof built from an independently
      hand-computed worked example
- [ ] The new prior-year capital-loss dialect module
- [ ] The amendment-diff module
- [ ] `fjs/report/payer/` — the payer-summary report
- [ ] `fjs_check`'s pure logic module
- [ ] The local `dialectEntry` registrations for every existing dialect
- [ ] Root-level gate: no bare `2025` in computation paths (**scoped** per RESEARCH Pitfall 2 — a
      literal grep false-positives on ~450 lines of `taxParams2025` test-fixture identifiers)
- [ ] Root-level gate: `fjs/report/payer` import-graph check
- [ ] Real-process coverage for (a) the payer report through a separate process, (b) `detect`
      reachable from a running path, (c) `fjs_check` reachable from a real MCP `tools/call`

Gates land in Wave 0 because every later wave's code is what they protect.

Module paths above are indicative; the planner picks final names following `fjs/` conventions.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| The four transcribed prior-year figures map to the right printed lines (2024 Form 1040 line 15; 2024 Sch. D lines 7, 15, 21) | TAX-17 | A green suite proves the engine agrees with the constants it was handed, never that a line reference was transcribed correctly from the printed form | Compare the dialect's field docstrings against the cited `i1040sd.pdf` (2025 rev.) p9 worksheet and the 2024 Form 1040 / Schedule D faces |

**This phase adds exactly one manual item, and it is the same *class* of item Phase 13 left open
and Phase 14 was to have closed.** Phase 14 is skipped, so nothing downstream is scheduled to
resolve it — see STATE.md's "CARRIED, NOW UNOWNED" block. Do not let this one join that list
silently.

---

## Validation Sign-Off

- [ ] All tasks have automated verification or a Wave 0 dependency
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Mutation sweep performed on the carryover worksheet and the amendment diff
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
