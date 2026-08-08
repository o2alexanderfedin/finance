---
phase: 12
slug: brokerage-documents-and-the-capital-gain-chain
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-07
---

# Phase 12 — Validation Strategy

> Derived from `12-RESEARCH.md` § Validation Architecture. Phase 12 is the DOCUMENTS half of the
> original Phase 12; the capital-gain chain and all wiring are Phase 12.1.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | FunctionalScript Emergent Testing — `export const proof = {...}`, discovered ONLY via root `all.test.js` |
| **Quick run** | `node --test 2>&1 \| grep -c '^✔ import("./fjs/'` |
| **Full suite** | `npm test` (`tsc && node --test`) |
| **Baseline entering this phase** | **544** project-local proofs; full suite 2782 pass / 0 fail |

**Never gate on `npm test`'s raw total** — it includes ~2,100 vendored submodule proofs and moves
with submodule checkout state. **`node --test <file>` is a documented FAKE PASS.**

---

## Sampling Rate

- After every task commit: the project-local grep above; it must not decrease
- After every wave: `npm test`
- Phase gate: full suite green **plus** the mutation gates below, each watched RED

---

## Per-Requirement Verification Map

| Req | Behavior to prove | Test Type | File Exists | Status |
|-----|-------------------|-----------|-------------|--------|
| DOC-06 | `vnd.fjs.1099div` round-trips; every box `option`-absent-able; box 1b present and exact | unit | ❌ W0 | ⬜ |
| DOC-06 | A proof demonstrates the stored box 1b value has **exactly the shape `qdcgt` consumes** — a shape assertion, NOT a wiring test. Wiring is Phase 12.1. | unit | ❌ W0 | ⬜ |
| DOC-07 | `vnd.fjs.1099b` round-trips; full box list | unit | ❌ W0 | ⬜ |
| DOC-07 | **A blank box 1e CHANGES THE GAIN** versus treating it as zero. The requirement names the consequence, so the proof must exhibit the consequence — a proof that merely shows the field is optional does NOT discharge DOC-07. | unit | ❌ W0 | ⬜ |
| DOC-13 | One artifact hash yields N subjects via the existing `formSubject` key; each new-dialect document records the shared `sourceArtifactHash` as provenance | unit | ❌ W0 | ⬜ |
| TAX-07 | Schedule B applies the $1,500 threshold **separately to interest and to dividends** — two independent tests, not one combined test. Research resolved this from the form's own two Notes; getting it combined is the common error. | unit | ❌ W0 | ⬜ |
| TAX-07 | Foreign-account answers are read from `vnd.fjs.return_profile` (taxpayer-declared), never inferred from any document | unit | ❌ W0 | ⬜ |
| DOC-11 | Per-box absent-ability generated **from the schema itself**, paired with an **independently hand-typed** expected count | unit, generated | ❌ W0 | ⬜ |
| — | `finance_schema` registers 9 dialects; hand-typed count bumped 7 → 9; a `*Resolves` leaf per new dialect — **one atomic commit** | unit | ❌ W0 | ⬜ |

---

## Mutation Gate (BLOCKING)

AGENTS.md: **a proof is not known to work until you have watched it fail.** Phase 11 ran seven such
gates and every one of them mattered. Three are required here:

| # | Mutation | Expected | Why this one |
|---|----------|----------|--------------|
| M1 | Remove one entry from a new dialect's `moneyBoxFields`, leaving the hand-typed count unchanged | The coverage leaf goes **RED** | Schema-generated coverage grows automatically when a box is ADDED, so it structurally cannot detect a box REMOVED. Only the independent hand count can. The mutation must therefore be a removal. |
| M2 | Set `expectedKnownDialectCount` to 8 (wrong) after registering both dialects | The dialect-count leaf goes **RED** | That file's own docstring records that a newly registered dialect is NOT covered for free by `unknownDialectRefused`. Phase 11 confirmed this: the count leaf reddened while `unknownDialectRefused` stayed green. |
| M3 | Treat a blank box 1e as `"0"` instead of absent | The DOC-07 gain proof goes **RED** | This is the whole of DOC-07. If the proof survives the mutation, it proves the field is optional but not that the distinction MATTERS — and the requirement is about the consequence. |

---

## Wave 0 Requirements

New:
- [ ] `fjs/document/1099div/module.f.js` — DOC-06
- [ ] `fjs/document/1099b/module.f.js` — DOC-07
- [ ] Schedule B module — TAX-07 (location at planner's discretion; follow existing layout)

Modified (each carries a trap):
- [ ] `fjs/server/finance_schema/module.f.js` — 7 → 9 dialects, hand-typed count, `*Resolves` per
      dialect, **all in one commit**
- [ ] `fjs/return/profile/module.f.js` — **additive only**: foreign-account fields for Schedule B.
      Must NOT touch the modeled/unmodeled partition in `fjs/return/scope/module.f.js`; that is
      Phase 12.1's atomic change.

**Out of scope, do not touch:** `fjs/return/scope/module.f.js`'s partition,
`fjs/form1040/core/module.f.js`'s lines 3a/3b, `fjs/tax/line16/**` (read only).

---

## Manual-Only Verifications

| Behavior | Why Manual | Instructions |
|----------|-----------|--------------|
| 1099-DIV box inventory | No in-repo oracle | Re-read the source PDF recorded in the module docstring |
| 1099-B box inventory | Same; and research found the un-suffixed canonical URL now **404s**, so the TY2025-specific URL is the only source | Re-read `f1099b--2025.pdf` |
| Schedule B line structure | Same | Re-read `f1040sb.pdf` (2025 revision) |

Recorded so they do not silently join this project's three existing never-checked-against-paper
claims. Each module docstring must name its exact source URL.

---

## Validation Sign-Off

- [ ] Every task has an automated verify or a declared Wave 0 dependency
- [ ] M1, M2, M3 each watched RED, then reverted, `git status` clean after
- [ ] Project-local proof count risen from 544
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
