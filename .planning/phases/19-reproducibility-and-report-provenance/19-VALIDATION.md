---
phase: 19
slug: reproducibility-and-report-provenance
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-12
---

# Phase 19 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> **Written by hand, not derived from RESEARCH.md** — ROADMAP marks this phase `Research: No`
> because every mechanism it needs already ships and is proven. The validation contract is
> still required: this phase's central deliverable (PROV-05) *is* a proof, and Phase 15 shipped
> two proofs that were green and permanently unable to fail.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node's built-in `node:test`, driven via FunctionalScript's Emergent Testing (`proof` exports discovered by `all.test.js`) |
| **Config file** | none — `tsconfig.json` (strict) governs typecheck; `package.json`'s `"test": "tsc && node --test"` governs the run |
| **Quick run command** | `npx tsc --noEmit && node --test all.test.js 2>&1 \| tail -20` |
| **Targeted real-process** | `node --test fjs-run-integration.test.js 2>&1 \| tail -20` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~8 min full suite (~6300 tests); typecheck alone ~30s; `fjs-run-integration.test.js` alone ~15s |

> **`node --test <source-file>` reports a FAKE PASS.** Emergent Testing only registers when root
> `all.test.js` is imported. Only ever trust `npm test` or `node --test all.test.js`. The
> root-level `*.test.js` files are the exception — they are plain impure Node tests and can be
> run individually.

> **De-duplicate the proof count.** The bare `grep -c` form double-counts 2× whenever the
> `functionalscript` submodule is initialized. Use:
> `node --test 2>&1 | grep '^✔ import("./fjs/' | sed 's/ ([0-9.]*ms)$//' | sort -u | wc -l`
> Baseline entering this phase: **907**.

---

## Sampling Rate

- **After every task commit:** `npx tsc --noEmit` + targeted `node --test` (fast fail, ~45s)
- **After every plan wave:** `npm test` (full suite, including both real-process tests)
- **Before `/gsd-verify-work`:** Full suite green
- **Phase gate:** `npm test` green **plus** the two mutation gates below, both watched failing
- **Max feedback latency:** ~45s per task, ~8 min per wave

---

## Per-Task Verification Map

| Req ID | Behavior | Test Type | Automated Command | File Exists | Status |
|--------|----------|-----------|-------------------|-------------|--------|
| EXEC-13 | `pinned` is `true` iff both `subject` and `parents` are supplied; the record round-trips | unit | `node --test all.test.js` | ✅ shipped (PROV-03) | ⬜ verify-only |
| EXEC-13 | A named predicate reports whether a run counts toward reproducibility acceptance | unit | `node --test all.test.js` | ❌ W0 | ⬜ pending |
| EXEC-13 | The predicate rejects an unpinned run and accepts a pinned one — **both arms** | unit | `node --test all.test.js` | ❌ W0 | ⬜ pending |
| PROV-04 | `paramSetHash` is derived from `taxParamsByYear[taxYear]`, not hand-written | unit | `node --test all.test.js` | ❌ W0 | ⬜ pending |
| PROV-04 | Two different tax years produce two different `paramSetHash` values | unit | `node --test all.test.js` | ❌ W0 | ⬜ pending |
| PROV-04 | The header carries `taxYear`, `paramSetHash` and `programHash` together | unit | `node --test all.test.js` | ❌ W0 | ⬜ pending |
| PROV-04 | The header reaches a **real** `fjs_run` response over a live MCP session | real-process | `node --test fjs-run-integration.test.js` | ❌ W0 | ⬜ pending |
| PROV-05 | Two runs of a pinned program with an amended revision added between them produce an identical `resultHash` **and** identical fetched blob bytes | real-process | `node --test fjs-run-integration.test.js` | ❌ W0 | ⬜ pending |
| PROV-05 | The control: the **same** scenario **unpinned** DOES move | real-process | `node --test fjs-run-integration.test.js` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

### The control leaf is not optional

PROV-05's positive assertion is "the output did not move." **A proof that asserts something did
not happen passes trivially when the mechanism under test never ran at all** — this is exactly
how 15-03's never-executes proof shipped vacuous. The unpinned control (row 9) is what makes the
pinned assertion meaningful: it proves the amended revision was genuinely visible to a run that
was not pinned against it, so the pinned run's stability is a real property rather than a
scenario where nothing changed.

**If the control does not show movement, the test is measuring nothing.** Build and observe the
control *first*, before the pinned assertion.

---

## Wave 0 Requirements

- [ ] `fjs/report/provenance/module.f.js` — the header builder, the `paramSetHash` derivation,
      the "reviewed estimate" framing constant, and the EXEC-13 acceptance predicate, each with
      proof leaves
- [ ] The `taxYear` argument on `fjs_run`'s tool schema, and the envelope widening
- [ ] `fjs-run-integration.test.js` — the PROV-05 pinned/unpinned pair and the PROV-04
      real-response assertion

Gates land in Wave 0 because every later wave's code is what they protect.

Module paths above are indicative; the planner picks final names following `fjs/` conventions.

---

## Mutation Gates — required, not advisory

AGENTS.md's standing rule: **a proof is not known to work until you have watched it fail.**
Both gates below must be performed, observed, and the code restored byte-identical.

| Gate | Mutation | Must redden | Why this target |
|------|----------|-------------|-----------------|
| **M1 (PROV-05)** | In `buildRunSnapshot`, make the pinned branch resolve the **live** head instead of `pin.parents` | The pinned reproduction leaf in `fjs-run-integration.test.js` | This is the single line the whole requirement rests on. If mutating it leaves the suite green, the test is not exercising pinning — the 15-03 failure mode exactly. |
| **M2 (EXEC-13)** | In `fjs_run`, change `pinned` derivation from `&&` to `\|\|` (half a pin now counts as pinned) | A leaf that calls `fjs_run` with **exactly one** of `subject`/`parents` supplied and asserts the persisted record has `pinned: false` | EXEC-13 is inherited as "already done" from PROV-03. A requirement inherited as done is a claim, not a fact; this gate is what converts it. |

> **Corrected 2026-08-12, before execution, by the plan-checker.** This row originally also
> required the mutation to redden *"the acceptance predicate's rejection arm."* **That is
> structurally impossible, and the impossibility is a good property rather than a gap.**
>
> `&&` and `||` diverge on exactly one input: the mixed case, where one of `subject`/`parents`
> is supplied and the other is not. Under the mutation that case yields `pinned: true` with
> `parents: undefined` — which `fjs/run/module.f.js`'s `checkReferences` (lines 160-163)
> rejects outright, so `fjs_run`'s own record-assembly `assert` fires first. The acceptance
> predicate consumes a **validated** `Run`, and a pinned-without-parents `Run` cannot exist at
> its input. Demanding that arm redden was asking a proof to observe a state the type and its
> validator jointly make unreachable.
>
> **The lesson is the one this phase is built around.** A required-red leaf that *cannot* go
> red is the mirror image of a vacuous proof: instead of a green assertion that can never fail,
> it is a red-set requirement that can never be met — and either one, left in place, turns a
> gate into paperwork. The gate is real; only its second clause was wrong.

**A mutation that fails to compile proves nothing** — `npm test` is `tsc && node --test`, and
`allowUnreachableCode: false` has already rejected one such attempt in Phase 5. If a mutation
trips `tsc`, rewrite it into a form that typechecks but behaves differently.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| *(none)* | — | — | — |

**This phase must add zero `human_needed` items.** It transcribes no IRS figures and reads no
printed form — every one of its properties is mechanically checkable. Phase 15 set this
precedent by fetching the source PDF rather than deferring; Phases 10 and 13 did not, and their
items are still unowned. **If a plan proposes a manual-only verification here, that is a signal
the plan has drifted into Phase 14's scope.**

---

## Validation Sign-Off

- [ ] All tasks have automated verification or a Wave 0 dependency
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] **M1 and M2 both performed and watched failing**, then restored byte-identical with a
      clean `git status` — against M2's **corrected** red set (see the note under the gate table;
      the original wording named a leaf that cannot redden)
- [ ] The PROV-05 unpinned control was observed to MOVE before the pinned assertion was trusted
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
