---
phase: 7
slug: fjs-run-run-records-and-the-week-1-convergence
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-04
---

# Phase 7 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `07-RESEARCH.md` § Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | FunctionalScript Emergent Testing (`proof` exports) via Node's built-in test runner |
| **Config file** | none — discovery is `all.test.js` at repo root, walking the project via `loadModuleMap` |
| **Quick run command** | `node --test all.test.js` |
| **Full suite command** | `npm test` (`tsc && node --test`) |
| **Estimated runtime** | ~2 seconds (no real I/O, no real process spawn) |

**Discovery hazard — the one that already bit this project.** A proof file that exists but is
never imported by anything `all.test.js` walks registers **zero tests and passes silently**.
`node --test <some/other/file>` is a documented **fake pass** (AGENTS.md, STATE.md). Every proof
added in this phase must be reachable from root discovery, and each plan's verification step must
confirm the phase's total test count actually *rose* — not merely that the suite is green.

---

## Sampling Rate

- **After every task commit:** `npm test`
- **After every plan wave:** `npm test` (there is no separate fuller suite — `tsc && node --test`
  already runs everything)
- **Before `/gsd-verify-work`:** full suite green **and** total test count strictly greater than
  the 134 that pass on `main` today
- **Max feedback latency:** ~15 seconds including `tsc`

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 07-01-xx | 01 | 1 | EXEC-07 (ctx combinators) | — | `CasOp` stays exactly 4 commands; combinators never become a `command` and never reach `match` | unit | `npm test` | ❌ W0 | ⬜ pending |
| 07-01-xx | 01 | 1 | PROV-03 | — | `vnd.fjs.run` validates structurally; numbers are decimal strings, never JSON numbers | unit | `npm test` | ❌ W0 | ⬜ pending |
| 07-02-xx | 02 | 2 | MCP-06 | T-07-01 | `finance_schema` serializes the dialect's own exported schema const — no hand-written field list to drift | unit | `npm test` | ❌ W0 | ⬜ pending |
| 07-02-xx | 02 | 2 | EXEC-08 | T-07-02 | Evo heads pinned once at call time; guest `evoHead` reads the snapshot, never live Evo | unit | `npm test` | ❌ W0 | ⬜ pending |
| 07-03-xx | 03 | 2 | EXEC-10 | T-07-03 | Handler performs both writes; guest whitelist has no `casWrite`/`evoAdd` | unit + static | `npm test` + `grep -n "casWrite\|evoAdd" fjs/guest/module.f.js fjs/guest/materialize/module.f.js` (expect no output) | ❌ W0 (proof) / ✅ (grep) | ⬜ pending |
| 07-03-xx | 03 | 2 | PROV-03 (adversarial) | T-07-04 | Persisted `inputs[]` contains a read the program never cited | unit | `npm test` | ❌ W0 | ⬜ pending |
| 07-04-xx | 04 | 3 | EXEC-12 (non-`Error` throw) | T-07-05 | Bare-string throw becomes `errorResult`; session survives | unit | `npm test` | ❌ W0 | ⬜ pending |
| 07-04-xx | 04 | 3 | EXEC-12 (missing hash) | T-07-05 | Absent hash becomes `errorResult` before materialization | unit | `npm test` | ❌ W0 | ⬜ pending |
| 07-04-xx | 04 | 3 | EXEC-12 (import failure) | T-07-05 | Import failure becomes `errorResult` through the full handler | unit | `npm test` | ❌ W0 | ⬜ pending |
| 07-05-xx | 05 | 3 | EXEC-11 | T-07-06 | Oversized content never reaches `state.stdout`; only the short refusal does | unit | `npm test` | ❌ W0 | ⬜ pending |
| 07-06-xx | 06 | 4 | EXEC-08/10/11/12 + PROV-03 + MCP-06 | — | Week-1 finish line end to end | integration (proof) | `npm test` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

**No 3 consecutive tasks lack an automated verify** — every row above runs `npm test`.

---

## Wave 0 Requirements

Existing infrastructure covers the framework itself — `all.test.js`, `tsc`, and the emergent
testing runner are all in place and green at 134 tests. Wave 0 for this phase is therefore not a
framework install but the **fixture** work every later proof depends on:

- [ ] A virtual-filesystem session helper that threads one `State` across multiple
      `tools/call` requests, following `cas-refresh-cross-process.test.js`'s
      `memoryValues`/`memoryNext` carry-forward pattern
- [ ] Seeded `vnd.fjs.1099int` documents with varying `box1InterestIncome`, **including one
      where the field is absent** — absent must be proven to be skipped, not coerced to zero
- [ ] A materialize-write fixture that writes real bytes to `programPath(home)(hash)` in the
      virtual `root`, rather than the `JsModule` shortcut Phase 6's proofs used

That third item is the one with no precedent in the repo — it is the new write step this phase
introduces, and no existing proof exercises it.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `grep` confirms `casWrite`/`evoAdd` absent from the guest whitelist | EXEC-10 | Success criterion 3 names `grep` explicitly as the check, so it stays an explicit documented step even though `Assert<Equal<CasOp[0], …>>` already subsumes it at compile time | `grep -n "casWrite\|evoAdd" fjs/guest/module.f.js fjs/guest/materialize/module.f.js` — expect no output |

All other phase behaviors have automated verification. Phase 6 established that the whole
materialize → import → execute path is proof-testable under `fjs/effects/node/virtual` with no
real filesystem, so nothing here needs a live server.

---

## Validation Sign-Off

- [ ] All tasks have an automated verify or a Wave 0 dependency
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (session helper, seeded docs, materialize-write fixture)
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] Total test count strictly greater than 134 (guards against the silent-zero-tests discovery hazard)
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
