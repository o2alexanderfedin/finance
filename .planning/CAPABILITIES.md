# What This System Can Actually Do

**Measured 2026-08-17 on `develop` @ `3954484`** by starting the server and asking it. Supersedes
every earlier version, all of which predate milestone v2.

> **Every number below came from a running server or a full suite run, not from reading source.**
> That rule exists because the first version of this file got the tool count wrong three times.
> To re-derive: `node index.js`, then `initialize` → `notifications/initialized` → `tools/list`
> over stdio. To learn a valid argument set, call a tool with a deliberately wrong one; the refusal
> names the valid values.

---

## The short version

**The two halves are joined.** A stored program, written by the agent and executed by the server in
a sandbox, reads your documents and produces a complete Form 1040 — every figure citing the exact
document box it came from, the whole run recorded so it can be replayed and proven byte-identical.

That was not true until 2026-08-16. The previous version of this file opened by saying the engine
and the server had never been connected. Phase 21 connected them **without** adding a
"calculate my taxes" tool, which the project forbids: the engine reaches guest programs as a pure
value on their context, so the agent still authors the program.

**All four reference taxpayers now compute.** A year ago-equivalent state served one.

---

## What runs end to end

| Scenario | Status |
|---|---|
| Store a tax document, amend it, read any revision | **works** |
| Look up a document's schema, or a year's tax parameters | **works** |
| Write a program, have the server run it in a sandbox, get a reproducible run record | **works** |
| **Produce a complete Form 1040 from stored documents** | **works** — Phase 21 |

The last one is verified by a real-process test: documents in via `evo_add`, program in CAS,
executed by `fjs_run`, result written as a `vnd.fjs.run` record, and a **pinned rerun across an
intervening amendment reproduces it byte for byte**.

---

## Who it can do taxes for

Measured against `.planning/PERSONA-COVERAGE.md`'s four reference taxpayers.

| Person | Then | Now |
|---|---|---|
| **Retired** | yes | **yes** — plus charitable IRA distributions and after-tax IRA basis |
| **Non-profit worker** | computed, but **overstated the tax** | **yes** — student loan interest, educator expenses, HSA |
| **FAANG engineer** | **refused** | **yes** — Forms 8959, 8960, AMT, and equity-comp basis correction |
| **Startup founder** | **refused** | **yes** — Schedule C, Schedule SE, QBI, K-1s, Schedule E |

Two figures worth knowing, both computed by the engine on real fixtures:

- **$49,467.75** of income was being taxed twice for anyone with vested equity, because brokers
  correctly report $0 basis on stock already taxed through payroll. Now corrected.
- **$10,049.64** separates a general partner from an S-corp shareholder on identical income — the
  entity type alone. When the documents do not say which you are, the engine refuses.

---

## What it refuses, and why that is the point

The engine **refuses rather than guessing** wherever it cannot compute honestly. Each refusal names
the form or the facts that would supply it. The significant ones:

| Refused | Because |
|---|---|
| Earned Income Credit | the dependent model carries almost none of §32(c)(3)'s tests |
| Roth conversions (Form 8606 Parts II/III) | so no backdoor Roth |
| QBI above the income threshold | Form 8995-A, the SSTB phase-in and wage/UBIA limits are unbuilt |
| AMT with capital gains **or** qualified dividends | Form 6251 Part III is unbuilt |
| A business **loss** | the at-risk determination needs a multi-year basis history |
| A mixed-tax-year document store | 2024 and 2025 W-2s together would silently mis-total |
| Two businesses, or two K-1s from one entity | netting them is the arithmetic §704(d) exists to stop |

**There is also a complementary guard.** Some taxes trigger on a threshold from data already held,
on a taxpayer who has never heard of the form — so six *tripwires* refuse when the documents prove
an obligation was not declared. Without them, a $300,000 W-2 understated tax by ~$900, silently.

---

## The measured surface

**13 tools** · protocol `2025-11-25` · server `finance-mcp 0.12.0` · **25 document dialects**
(was 10)

| Group | Tools |
|---|---|
| Content store | `cas_add`, `cas_get`, `cas_list`, `cas_refresh` |
| Versioning | `evo_add`, `evo_list`, `evo_head`, `evo_revision` |
| Tax reference | `finance_schema`, `finance_tax_params`, `finance_documents_list` |
| Program execution | `fjs_run`, `fjs_check` |

**The tool count has not moved through ten phases, deliberately.** A `finance_compute_1040` tool
would let the agent stop authoring programs, which is the one thing the architecture exists to
prevent.

`finance_tax_params` takes **`year`**, not `taxYear` — `fjs_run` uses `taxYear` for the same
concept. The tool's own description now says so; renaming it would be a breaking change to a live
surface. Only 2025 exists.

---

## Health

- `npm test`: **4273 / 4273**, exit 0, **~30 seconds**
- `npm run test:proofs`: 4260 · `npm run test:integration`: 1
- `tsc --noEmit`: clean
- **2024 distinct proofs** (was 953 before milestone v2)
- Requirements: **120 defined, 111 complete, 9 open**

The suite ran **8533 tests in ~60s** until 2026-08-17, when the entire proof set was found to be
executing twice — bare `node --test` was discovering the vendored submodule's own `.ts` entry
point. Nothing is skipped now; everything runs once.

---

## Known gaps, in rough order of what they cost

1. **AMT with capital gains refuses** — the FAANG persona's most likely combination.
2. **The Earned Income Credit does not compute** — spec in `fjs/todo/`.
3. **Three v1 maintenance items are unexecuted** (Phase 18): a dependency bump, a duplicated step
   sequence, and a giant single-block integration test whose structure has already cost two agents
   real work by masking which assertion failed.
4. **Phase 16 is deferred by owner decision** — an OCR conversion path that nothing calls.
5. **No release** — `develop` is 260+ commits ahead of `main`, entirely undecided.
