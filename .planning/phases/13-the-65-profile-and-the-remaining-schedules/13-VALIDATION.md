---
phase: 13
slug: the-65-profile-and-the-remaining-schedules
status: draft
nyquist_compliant: false
wave_0_complete: true
created: 2026-08-10
---

# Phase 13 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `13-RESEARCH.md` § Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | FunctionalScript Emergent Testing — `proof` exports discovered by `all.test.js` |
| **Config file** | none — `all.test.js` walks the module map (see `AGENTS.md` § Testing) |
| **Quick run command** | `node --test 2>&1 \| grep -c '^✔ import("./fjs/'` |
| **Full suite command** | `npm test` (`tsc && node --test`) |
| **Estimated runtime** | ~60 seconds full suite |

**Counting rule (load-bearing).** The quick command counts **project-local** proofs only.
Never gate on the raw `npm test` total — it includes ~2,100 vendored submodule proofs, and a
project-local regression is invisible inside that number. Baseline entering this phase: **665**.

---

## Sampling Rate

- **After every task commit:** `node --test 2>&1 | grep -c '^✔ import("./fjs/'` — the count must rise or hold, never fall
- **After every plan wave:** `npm test` (full `tsc && node --test`)
- **Before `/gsd-verify-work`:** full suite green AND `grep -rn "magi" fjs/` empty
- **Max feedback latency:** ~60 seconds

---

## Per-Task Verification Map

Task IDs are assigned by the planner; this map is keyed by requirement and wave so the
planner can attach each row to the task it creates.

| Req | Wave | Behavior | Test Type | Automated Command | File Exists | Status |
|-----|------|----------|-----------|-------------------|-------------|--------|
| TAX-09 | 2 | Schedule 1-A Part V: $6,000 base, **continuous** 6% phase-out over $75k/$150k, floors at 0, totals through Part VI line 38 to 1040 line 13b | unit | `node --test` | ❌ new `fjs/schedule/1a` | ⬜ pending |
| TAX-09 | 2 | Boundary probes at $75k/$150k and at the zero point ($175k/$250k), each at `−1¢ / exact / +1¢` per TAX-04 | unit (boundary) | `node --test` | ❌ same module | ⬜ pending |
| TAX-09 | 2 | **MFS short-circuits to $0 at any income** — before the phase-out arithmetic runs, not through it (Decision 5.4) | unit (gate + control) | `node --test` | ❌ same module | ⬜ pending |
| TAX-09 | 2 | Senior deduction is available to an **itemizing** filer (it is not standard-deduction-only) | unit (control) | `node --test` | ❌ same module | ⬜ pending |
| TAX-10 | 2 | **18** named line functions matching the printed worksheet, plus a count-guard proof asserting 18 (Decision 5.3) | unit | `node --test` | ❌ new SSB module | ⬜ pending |
| TAX-10 | 2 | Criterion 2 case: 85% tier **with the tax-exempt-interest (1040 line 2a) add-back** — the near-circular case, not merely a case that produces a number | unit | `node --test` | ❌ same module | ⬜ pending |
| TAX-10 | 3 | `iraDeductionDeclared` refuses loudly with a named remedy; an HSA-only Schedule 1 adjustment still computes (Decision 5.1) | unit (refusal + control) | `node --test` | ❌ `fjs/return/scope` + profile | ⬜ pending |
| TAX-13 | 2 | `deductionChoice` compares in **both directions**, including a case above $15,750 / $31,500 where itemizing still **loses** (criterion 3) | unit | `node --test` | ❌ `fjs/tax/deduction` | ⬜ pending |
| TAX-13 | 2 | SALT cap phase-down, including the MFS mechanic where only the **final** line halves (Research Pitfall 2) | unit (boundary) | `node --test` | ❌ new `fjs/schedule/a` | ⬜ pending |
| TAX-13 | 2 | 7.5% medical floor applied against AGI; `vnd.fjs.medical_expenses` entries feed it | unit | `node --test` | ❌ same module | ⬜ pending |
| TAX-13 | 2 | Asserted SALT line 5a is **≥** summed W-2 box 17 + 1099-R box 14 when the income-tax election is in force (Decision 2.2) | unit (proof over stored docs) | `node --test` | ❌ same module | ⬜ pending |
| TAX-13 | 2 | Neither TY2026 OBBBA change is implemented — no 0.5% charitable floor, no 2/37ths haircut (Decision 5.8) | unit (negative) | `node --test` | ❌ same module | ⬜ pending |
| TAX-12 | 2 | Schedule 8812 Part I → 1040 line 19 **and** Part II-A ACTC → 1040 line 28, both for the declared `dependents` array | unit | `node --test` | ❌ new `fjs/form8812` | ⬜ pending |
| TAX-12 | 2 | CTC/ODC phase-out is **stepped** — 5% per $1,000 rounded up, a true cliff at $400k MFJ / $200k other (contrast TAX-09's continuous curve) | unit (boundary) | `node --test` | ❌ same module | ⬜ pending |
| TAX-12 | 1 | `dependents` array length equals `dependentCount` (Decision 4.1) | unit | `node --test` | ❌ `fjs/return/profile` | ⬜ pending |
| TAX-14 | 2 | Schedules 1, 2, 3 model every printed line; unpopulatable lines are documented zeros with the boundary in each docstring | unit | `node --test` | ❌ three new modules | ⬜ pending |
| TAX-14 | 3 | 1040 lines 8, 10, 17, 19, 20, 23, 28, 31 read their schedules instead of `declaredZero` | unit | `node --test` | ❌ `fjs/form1040/core` | ⬜ pending |
| TAX-15 | 2 | **Four** separately named income functions, each stating its own add-back list (Decision 5.6) | unit | `node --test` | ❌ across modules | ⬜ pending |
| criterion 5 | 3 | Mechanical gate: tree walk fails on a lowercase `magi` token (Decision 3.6) | build-time gate | `grep -rn "magi" fjs/` → empty | ❌ new gate proof | ⬜ pending |
| Decision 1.5 | 3 | `modeledKinds` + `unmodeledKindRefusals` = 50, enforced by `_EveryKindIsEitherModeledOrRefused` at `tsc` | type-level | `tsc` | ✅ exists | ⬜ pending |
| Decision 1.4 | 3 | Five stale remedy strings no longer name Phase 13 | unit (source assertion) | `node --test` | ✅ `fjs/return/scope` | ⬜ pending |
| Decision 5.2 | 1 | `Citation` discriminated union; every pre-existing entry becomes `kind: 'revProc'` with **no value change** | unit | `node --test` | ✅ `fjs/tax/params` | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

**None.** Existing infrastructure covers every requirement shape this phase needs — each new
module adds its own `proof` export and `all.test.js` discovers it, per the
`fjs/schedule/b` / `fjs/tax/line16/qdcgt` precedent. No framework install, no shared fixture,
no config change.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Transcribed figures match the printed 2025 IRS PDFs | TAX-09, TAX-10, TAX-12, TAX-13, TAX-14 | A proof can only assert the engine agrees with the constants the engine was given. It cannot detect that a constant was transcribed wrong — that is `13-RESEARCH.md`'s `[VERIFIED: …]` citations, spot-checked by a human against the named PDF and page | For each new parameter, open the cited PDF at the cited page and confirm the figure and its line label |

**Why this row exists.** It is the fooled-but-passing failure mode for this entire phase: a
fully green suite proves internal consistency, not correctness against the IRS. The citation
discipline (Decision 5.2's widened `Citation`) is what makes this check possible at all.

---

## Validation Sign-Off

- [ ] All tasks have an automated verify or a stated Wave 0 dependency
- [ ] Sampling continuity: no 3 consecutive tasks without an automated verify
- [ ] Wave 0 covers all MISSING references (N/A — none)
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] Project-local proof count rose from the 665 baseline
- [ ] `grep -rn "magi" fjs/` empty
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
