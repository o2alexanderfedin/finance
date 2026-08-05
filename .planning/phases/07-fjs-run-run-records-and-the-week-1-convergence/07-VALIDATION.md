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

## Planner Divergence Note (added during /gsd-plan-phase)

The 6-plan/4-wave shape this document originally sketched is superseded by an **8-plan/5-wave**
structure. Reasons, both discovered during planning against the actual source:

1. **The ctx-combinator gap (RESEARCH.md's Critical Finding) and the `vnd.fjs.run` dialect are
   each their own plan (07-01, 07-02)**, plus `finance_schema` (07-03) and the size guard
   (07-04) are ALSO fully independent, zero-dependency work — all four now run in **Wave 1**
   together, rather than being folded pairwise into two wave-1/wave-2 plans. This is a genuine
   parallelism gain, not scope inflation.
2. **The materialize-write step and the synchronous snapshot/host-map are substantial enough,
   individually, to warrant their own plan (07-05)** separate from the handler that composes
   them (07-06) — each is independently proof-tested, and 07-06 composes rather than
   re-implements.
3. **EXEC-12's error taxonomy is its own plan (07-07)**, sequenced after the handler (07-06)
   since its proofs drive the FULLY assembled `fjsRunTool`, not an earlier internal helper.

**A structural finding not previously documented anywhere:** `fjs/effects/node/virtual/module.f.js`'s
`writeFile` stores a file as an array of `Vec` chunks, while its `import_` requires the entry at
a path to be a `JsModule` (a plain function) — verified by reading the source directly. `virtual`
has no JS parser, so writing real bytes and then importing them **cannot be composed in one
virtual session** — this is a structural property of the test double, not a gap in this phase's
design. Plan 07-05's materialize proof therefore verifies the write mechanism on its own terms
(write, then read the same bytes back), while execution proofs (07-06, 07-08) continue to use
Phase 6's established `JsModule`-at-hash-path stand-in for "materialization already succeeded."
Production code still performs both steps for real, since real Node's `import()` reads whatever
`writeFile` actually wrote to disk. This affects HOW several proofs below are worded but not
WHETHER the underlying requirements (EXEC-08, Pitfall 1) are satisfied.

Per-task table below is renumbered against the actual 07-01..07-08 plan IDs.

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
| 07-01-01/02 | 01 | 1 | EXEC-08 precursor (ctx combinators, revises EXEC-07) | T-07-01-01/02 | `CasOp` stays exactly 4 commands; combinators never become a `command` and never reach `match`; the two Phase 6 proofs are explicitly revised, not incidentally edited | unit | `npm test` | ❌ W0 | ⬜ pending |
| 07-02-01/02 | 02 | 1 | PROV-03 (schema half) | T-07-02-01/02 | `vnd.fjs.run` validates structurally; status/resultHash/error cross-field rules enforced; inputs[].command restricted to the frozen four | unit | `npm test` | ❌ W0 | ⬜ pending |
| 07-03-01/02 | 03 | 1 | MCP-06 | T-07-03-01/02 | `finance_schema` serializes the dialect's own exported schema const via `toJsonSchema` — no hand-written field list to drift | unit | `npm test` | ❌ W0 | ⬜ pending |
| 07-04-01/02 | 04 | 1 | EXEC-11 (logic + ordering) | T-07-04-01 | Oversized content never reaches `state.stdout`; only the short refusal does; constants pinned; contrast leaf reproduces the prevented `-32603` | unit | `npm test` | ❌ W0 | ⬜ pending |
| 07-05-01 | 05 | 2 | EXEC-08 (materialize) | T-07-05-01 | Real bytes written to a dedicated, gitignored subdirectory; write-then-readback proven under virtual (NOT composed with import — see scope note) | unit | `npm test` | ❌ W0 | ⬜ pending |
| 07-05-02 | 05 | 2 | EXEC-08 (synchronous snapshot host map + pin) | T-07-05-02/03 | Every host-map handler is plain `string -> string`, closed over a pre-resolved snapshot; pin overrides one subject's head only | unit | `npm test` | ❌ W0 | ⬜ pending |
| 07-06-01 | 06 | 3 | EXEC-08 (orchestration) | — | Multi-document composition via Plan 01's `ctx.step`; missing-hash and dirty-specifier short-circuits proven | unit | `npm test` | ❌ W0 | ⬜ pending |
| 07-06-02 | 06 | 3 | EXEC-10, EXEC-11, PROV-03 (adversarial) | T-07-06-01/02 | Handler performs both writes; guest whitelist has no `casWrite`/`evoAdd`; persisted `inputs[]` contains a read the program never cited | unit + static | `npm test` + `grep -n "casWrite\|evoAdd" fjs/guest/module.f.js fjs/guest/materialize/module.f.js` (expect no output) | ❌ W0 (proof) / ✅ (grep) | ⬜ pending |
| 07-07-01 | 07 | 4 | EXEC-12 (non-`Error` throw, missing hash) | T-07-07-01 | Bare-string throw and missing hash both become `errorResult` through the FULL handler; each persists a `status:'error'` run record | unit | `npm test` | ❌ W0 | ⬜ pending |
| 07-07-02 | 07 | 4 | EXEC-12 (import failure, session survival) | T-07-07-01 | Import failure becomes `errorResult`; all three failure classes leave the session able to answer a following call | unit | `npm test` | ❌ W0 | ⬜ pending |
| 07-08-01/02 | 08 | 5 | EXEC-08/10/11/12 + PROV-03 + MCP-06 | T-07-08-01 | Week-1 finish line end to end through the real financeMcpServer stack; absent-vs-zero distinction proven | integration (proof) | `npm test` | ❌ W0 | ⬜ pending |

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
