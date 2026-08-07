---
phase: 11
slug: wage-retirement-and-benefit-documents
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-07
---

# Phase 11 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `11-RESEARCH.md` § Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | FunctionalScript Emergent Testing — `export const proof = {...}`, discovered ONLY via root `all.test.js`, run through Node's built-in `node --test` |
| **Config file** | none — registration is automatic via `all.test.js`'s `loadModuleMap` walk (see `AGENTS.md`) |
| **Quick run command** | `node --test 2>&1 \| grep -c '^✔ import("./fjs/'` |
| **Full suite command** | `npm test` (`tsc && node --test`) |
| **Estimated runtime** | ~15–40 s for the full suite |

### Two counting hazards that have already bitten this project

1. **NEVER gate on `npm test`'s raw total.** It includes ~2,100 vendored `functionalscript`
   submodule proofs and moves with submodule checkout state — the SAME commit reports 494 in a
   worktree without the submodule and 2730 in one with it, both correct. A Phase 7 gate
   ("total > 134") was satisfied before a line of that phase's code was written. The
   project-local grep above is the only honest metric.
2. **`node --test <some .f.js file>` is a documented FAKE PASS.** It reports `1 pass` on a file
   whose proofs never ran. Only root discovery registers proofs.

---

## Sampling Rate

- **After every task commit:** `node --test 2>&1 | grep -c '^✔ import("./fjs/'` — project-local count must not decrease
- **After every plan wave:** `npm test` (full suite, includes the real-process integration test)
- **Before `/gsd-verify-work`:** full suite green
- **Phase gate, additional:** a **mutation check on the DOC-15 fix specifically** — see Mutation Gate below
- **Max feedback latency:** ~40 s

---

## Per-Task Verification Map

Task IDs are assigned when plans are written; this map is by requirement until then and is
refined by the planner.

| Req | Behavior to prove | Threat Ref | Test Type | Automated Command | File Exists | Status |
|-----|-------------------|-----------|-----------|-------------------|-------------|--------|
| DOC-09 | `vnd.fjs.1099r` round-trips; box 7a is a LIST of codes; box 2b's two checkboxes are independent; state/local group repeats faithfully **including two entries for the same state**; every money box refuses a non-exact or comma-grouped value | — | unit (`proof` in dialect file) | `npm test` | ❌ W0 | ⬜ pending |
| DOC-09 | A `vnd.fjs.ocr` blob fails `vnd.fjs.1099r` validation on **structure alone** (exact-literal `dialect` discriminant), and vice versa | — | unit | `npm test` | ❌ W0 | ⬜ pending |
| DOC-08 | `vnd.fjs.ssa1099` round-trips; every box `option`-absent-able; `payerTin` is always `''`; the Box 3/Box 4 description free-text blocks store verbatim | — | unit | `npm test` | ❌ W0 | ⬜ pending |
| DOC-11 | Per-box absent-ability generated **from the schema itself**, paired with an **independently hand-typed expected box count** — generation alone misses a box removed, a hand count alone misses a box added | — | unit, generated | `npm test` | ❌ W0 | ⬜ pending |
| DOC-15 | An archived revision's head is unreachable: `ctx.evoHead(archivedSubject)` yields `[]` | T-11-01 | unit, adversarial | `npm test` | ❌ W0 | ⬜ pending |
| DOC-15 | An archived revision is unreachable **even when its exact hash is supplied directly** as `fjs_run` args — `ctx.evoRevision(hash)` throws `revision not found` | T-11-01 | unit, adversarial | `npm test` | ❌ W0 | ⬜ pending |
| DOC-15 | A CONTROL leaf: the same walk over an **active** subject still resolves end to end — proving the filter is selective, not a blanket break | T-11-01 | unit, control | `npm test` | ❌ W0 | ⬜ pending |
| DOC-15 | Retraction is append-only: archiving writes a NEW head revision; the prior revision's bytes are untouched | — | unit | `npm test` | ❌ W0 | ⬜ pending |
| MCP-08 | `finance_documents_list` returns `{subject, dialect, taxYear, hash}`; active by default; `archived: true` opts in | — | unit + real-process integration | `npm test` **and** a `finance_documents_list` call added to `fjs-run-integration.test.js` **in the same commit** | ❌ W0 | ⬜ pending |
| MCP-08 | An unknown-dialect document is **listed with its real dialect tag**, not hidden; a non-revision blob is skipped without crashing | — | unit | `npm test` | ❌ W0 | ⬜ pending |
| MCP-08 | `finance_schema` registers 7 dialects; the **hand-typed count constant** is bumped AND a `*Resolves` proof leaf added per new dialect | — | unit | `npm test` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Mutation Gate (phase-specific, BLOCKING)

AGENTS.md standing rule: **a proof is not known to work until you have watched it fail.** Phase
10's own lesson was that verification machinery fails silently and in the direction of looking
successful. Two mutations must be run and reverted, with the result recorded:

| # | Mutation | Expected | Why this one |
|---|----------|----------|--------------|
| M1 | Revert `buildRunSnapshot`'s archived filtering | The DOC-15 adversarial proofs turn **RED** | Without this, a proof that merely never calls `evoList('true')` would pass against the *unfixed* code and prove nothing. This is the whole phase's load-bearing assertion. |
| M2 | Remove one box from a new dialect's schema | The hand-typed count assertion turns **RED** | Schema-generated coverage grows automatically with a box added, so it cannot detect a box *removed*. Only the independent hand count can. |

A phase gate that has not watched both of these go red has not verified DOC-15 or DOC-11.

---

## Wave 0 Requirements

New files:
- [ ] `fjs/document/1099r/module.f.js` — DOC-09
- [ ] `fjs/document/ssa1099/module.f.js` — DOC-08
- [ ] `fjs/server/finance_documents_list/module.f.js` — MCP-08

Modified files (each carries a trap, listed):
- [ ] `fjs/server/fjs_run/snapshot/module.f.js` — the DOC-15 fix + adversarial proofs. **Shipped
      Phase 7 code with existing proofs** — those must stay green; the change must be selective.
- [ ] `fjs/server/finance_schema/module.f.js` — `dialectSchemas` 5 → 7, **plus** the hand-typed
      `expectedKnownDialectCount`, **plus** a `*Resolves` proof leaf per new dialect. That file's
      own docstring documents that a newly registered dialect is *not* covered for free.
- [ ] `fjs/server/module.f.js` — registers the new tool.
- [ ] `fjs-run-integration.test.js` — adds the `finance_documents_list` call. **Must land in the
      SAME commit as the registry change** (Phase 08-04's ordering note: this test derives the
      advertised/called tool set from a live `tools/list` response at runtime, so a registry-only
      commit breaks `npm test` immediately).

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| The 1099-R box inventory matches the printed form | DOC-09 | Requires reading a PDF; no automated oracle exists in-repo | Re-read `irs.gov/pub/irs-prior/f1099r--2025.pdf` (TY2025) and `irs.gov/pub/irs-pdf/f1099r.pdf` (TY2026) against the schema's box list |
| The SSA-1099 box inventory matches Pub 915's sample | DOC-08 | Same; and SSA-1099 has **no blank IRS form** — the source is a sample in Pub 915 pp. 20–22 | Re-read `irs.gov/pub/irs-pdf/p915.pdf` Appendix against the schema |

Both are recorded so they do not silently join this project's existing list of three claims never
checked against paper. The docstring must name the exact source URL for each.

---

## Validation Sign-Off

- [ ] Every task has an automated verify or a declared Wave 0 dependency
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Mutation gate M1 and M2 both watched RED, then reverted, with `git status` clean after
- [ ] Project-local proof count did not decrease
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
