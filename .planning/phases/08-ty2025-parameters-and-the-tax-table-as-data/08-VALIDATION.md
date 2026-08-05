---
phase: 8
slug: ty2025-parameters-and-the-tax-table-as-data
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-08-05
---

# Phase 8 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `08-RESEARCH.md` § Validation Architecture, with two facts re-measured in this
> worktree rather than inherited.

---

## Two Numbers Re-Measured Before This Document Was Written

Research left both as "verify during planning." Both were verified at HEAD `054f095`:

1. **`npm test` already runs the integration test.** Root `node --test` discovers
   `fjs-run-integration.test.js` alongside `all.test.js`; the run at `054f095` reported
   `tests 187, pass 187, fail 0` and its output included the leaf
   `TEST-01/TEST-02: fjs_run end to end through a real separate node index.js process…`.
   `npm run test:integration` is therefore a **convenience subset**, not a second required
   command. It is still worth running alone when iterating on the integration file, because it
   finishes in under a second instead of two.

2. **The project-local proof baseline in this worktree is 185**, via
   `node --test 2>&1 | grep -c '^✔ import("./fjs/'`. STATE.md records both 185 and 136 from two
   different checkouts; **185 is the correct baseline here.** The 136 figure came from a checkout
   with the `functionalscript` submodule in a different state and must not be used for comparison.

> **A note on `node --test <file>`.** AGENTS.md documents it as a *fake pass*, and that is true for
> `.f.js` **source modules** — Emergent Testing only registers proofs reachable from root
> `all.test.js`, so pointing the runner at a proof module reports `pass 1` regardless of what the
> proofs say. It is **not** true for `fjs-run-integration.test.js`, which is an ordinary
> `node:test` file with its own `test()` calls. The distinction matters this phase because every
> new `proof` written here falls on the fake-pass side of it.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | FunctionalScript Emergent Testing (`proof` exports) discovered via root `all.test.js`, run by Node's built-in test runner |
| **Config file** | none — discovery is `all.test.js`'s `loadModuleMap` walk |
| **Quick run command** | `npm test` (`tsc && node --test`) — there is no faster trustworthy subset for `proof` modules |
| **Full suite command** | `npm test` (already includes the real-process integration test) |
| **Estimated runtime** | ~2.2 seconds total; ~0.8s of that is the real-process integration test |

---

## Sampling Rate

- **After every task commit:** `npm test` — it is two seconds, there is no reason to run less
- **After every plan wave:** `npm test`, plus `node --test 2>&1 | grep -c '^✔ import("./fjs/'` to
  confirm the project-local count rose by the number of `proof` leaves the wave added
- **Before `/gsd-verify-work`:** `npm test` green **and** project-local count strictly greater
  than **185**
- **Max feedback latency:** ~3 seconds

**Do not gate on `npm test`'s total.** It includes ~2,100 vendored submodule proofs and reads
differently depending on whether the submodule is initialized. Phase 7 shipped a gate of
"total > 134" that was already satisfied before a single line of phase code existed. The
project-local grep is the only honest metric.

---

## Per-Task Verification Map

Task IDs are assigned by the planner; rows below are requirement-level and must be renumbered
against the actual `08-NN` plan IDs once plans exist.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | 1 | TAX-01 | — | Every parameter carries its own `revProc` / `section` / `effectiveDate`; the standard deduction cites Rev. Proc. 2025-32 §3.01 while brackets and cap-gains cite 2024-40 alone | unit (`proof`) | `npm test` | ❌ W0 — new module | ⬜ pending |
| TBD | TBD | 1 | TAX-01 | T-08-02 | Every dollar figure is a decimal **string**, never a JSON number | unit (`proof`) | `npm test` | ❌ W0 — new module | ⬜ pending |
| TBD | TBD | 2 | TAX-02 | T-08-01 | Generated rows match hand-transcribed Pub. 1040 literals across every band region and both width transitions | unit (`proof`) | `npm test` | ❌ W0 — new module | ⬜ pending |
| TBD | TBD | 2 | TAX-02 | T-08-01 | MFJ $18,000 → **$1,803** by table lookup, not $1,800 by bracket arithmetic | unit (`proof`) | `npm test` | ❌ W0 — new module | ⬜ pending |
| TBD | TBD | 2 | TAX-02 | — | Band widths tile $0 → $100,000 with no gap and no overlap | unit (`proof`) | `npm test` | ❌ W0 — new module | ⬜ pending |
| TBD | TBD | 2 | TAX-02 | T-08-03 | A lookup at $100,000.00 or above is refused; $99,999.99 resolves to the `99,950–100,000` row | unit (`proof`) | `npm test` | ❌ W0 — new module | ⬜ pending |
| TBD | TBD | 2 | TAX-04 | — | Every stored threshold has `−1¢` / `threshold` / `+1¢` leaves, generated from the threshold list rather than hand-written | unit (`proof`) | `npm test` | ❌ W0 — new module | ⬜ pending |
| TBD | TBD | 3 | MCP-07 | — | `finance_tax_params(2025)` returns the parameter set; an unsupported year returns an `errorResult` naming supported years | unit (`proof`) | `npm test` | ❌ W0 — new module | ⬜ pending |
| TBD | TBD | 3 | MCP-07 | T-08-04 | The tool is reachable through a **real** stdio JSON-RPC session and its response stays inside the 64KB size guard | real-process | `npm test` (or `npm run test:integration`) | ⚠️ exists — needs one new call | ⬜ pending |

---

## Wave 0 Requirements

- [ ] Parameter data module with its own `proof` export — covers TAX-01, TAX-04
- [ ] Tax Table module: band structure + row generator + row-by-row diff `proof` — covers TAX-02
- [ ] `fjs/server/finance_tax_params/module.f.js`, mirroring `fjs/server/finance_schema/module.f.js`
      — covers MCP-07
- [ ] One new entry in `financeMcpHandlers` (`fjs/server/module.f.js`) — without it the tool is
      unreachable *and* invisible to the integration test's coverage assertion
- [ ] One new `finance_tax_params` call in `fjs-run-integration.test.js`, in the same real session
      the existing calls run in — **required, not optional**

**Ordering note the executor must not get wrong:** registering the tool in `financeMcpHandlers`
*without* adding the integration call breaks `npm test` immediately, because the coverage
assertion compares tools called against tools `tools/list` advertises at runtime. Those two edits
belong in the **same commit**.

---

## Threat Model References

| ID | Threat | Severity | How this phase's validation catches it |
|---|---|---|---|
| T-08-01 | The row-by-row diff is a tautology — the expected side computed by the code under test, so it cannot fail | **high** | The expected side is hand-keyed literals transcribed from Pub. 1040, sharing no code path with the generator. Mutate a bracket ceiling and the diff must go red; if it stays green the proof is worthless. |
| T-08-02 | A money value stored as a JSON number, silently losing exactness through IEEE 754 | high | Every parameter's amount asserted to be a `string`, and round-tripped through `centsFromString`/`centsToString`. |
| T-08-03 | The Tax Table silently answers a $100,000+ lookup, handing Phase 10 a hole where the Tax Computation Worksheet belongs | medium | Explicit refusal proven at exactly $100,000.00, with $99,999.99 proven to still resolve. |
| T-08-04 | `finance_tax_params` registered but never exercised through a real process, repeating the Phase 7 defect where a mocked seam hid a shipped bug | high | The integration test derives the tool list at runtime; an uncovered tool fails the suite by construction. |
| T-08-05 | Parameters sourced from the original 2025 inflation release rather than the OBBBA revision | **high** | Standard deduction values asserted to be $15,750 / $31,500 / $23,625 with the citation asserted to name Rev. Proc. 2025-32 — the wrong source produces different numbers *and* a different citation. |

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| The hand-transcribed Pub. 1040 rows are faithfully transcribed | TAX-02 | Irreducibly manual — a machine check against a machine-read source would reintroduce the tautology the transcription exists to break | Open `https://www.irs.gov/pub/irs-pdf/p1040.pdf`, locate each transcribed row, and confirm the four printed tax amounts character by character. Record the page number in the proof's source comment. |

Every other phase behavior has automated verification.

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies — confirmed against the four
      08-0N-PLAN.md files (every task carries `<verify><automated>...</automated></verify>`)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify — confirmed, every
      single task has one
- [x] Wave 0 covers all MISSING references — all five Wave 0 gaps listed above are each covered
      by a plan (08-01 through 08-04)
- [x] No watch-mode flags — confirmed, every automated command is a one-shot `npx tsc`/`npm test`/
      `npm run test:integration`
- [x] Feedback latency < 5s — confirmed, unchanged from the ~2.2s baseline measured above
- [ ] Project-local proof count strictly greater than **185** — execution-time only, proven when
      the plans actually run, not during planning
- [ ] T-08-01 mutation-tested: breaking the generator turns the diff red — execution-time only,
      proven by 08-02-PLAN.md's Task 3 during execution, not during planning
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** plan set approved for execution; the two unticked items above are proven during
execution, not planning.
