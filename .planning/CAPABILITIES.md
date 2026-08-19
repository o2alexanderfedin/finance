# What This System Can Actually Do

**Measured 2026-08-17 on `develop` @ `fd6702c`** (the v1.0.0 release point) for the server surface,
**re-measured at `0ecec40`** for the suite figures, by starting the server and asking it. Supersedes every earlier version, all of which predate the release.

> **Every number below came from a running server or a full suite run, not from reading source.**
> That rule exists because the first version of this file got the tool count wrong three times,
> and the version before this one survived the release with pre-release figures in it.
> To re-derive: `node index.js`, then `initialize` → `notifications/initialized` → `tools/list`
> over stdio. To learn a valid argument set, call a tool with a deliberately wrong one; the refusal
> names the valid values — that is how the dialect list below was obtained.

---

## The short version

**The two halves are joined.** A stored program, written by the agent and executed by the server in
a sandbox, reads your documents and produces a complete Form 1040 — every figure citing the exact
document box it came from, the whole run recorded so it can be replayed and proven byte-identical.

That was not true until 2026-08-16. Phase 21 connected them **without** adding a
"calculate my taxes" tool, which the project forbids: the engine reaches guest programs as a pure
value on their context, so the agent still authors the program.

**All four reference taxpayers compute.** A milestone ago, one did.

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

| Person | At the start of milestone v2 | Now |
|---|---|---|
| **Retired** | yes | **yes** — plus charitable IRA distributions and after-tax IRA basis |
| **Non-profit worker** | computed, but **overstated the tax** | **yes** — student loan interest, educator expenses, HSA, and the Earned Income Credit |
| **FAANG engineer** | **refused** | **yes** — Forms 8959, 8960, the full AMT including Part III, and equity-comp basis correction |
| **Startup founder** | **refused** | **yes** — Schedule C, Schedule SE, QBI both below and above the threshold, K-1s, Schedule E |

Two figures worth knowing, both computed by the engine on real fixtures:

- **$49,467.75** of income was being taxed twice for anyone with vested equity, because brokers
  correctly report $0 basis on stock already taxed through payroll. Now corrected.
- **$10,049.64** separates a general partner from an S-corp shareholder on identical income — the
  entity type alone. When the documents do not say which you are, the engine refuses.

---

## What it refuses, and why that is the point

The engine **refuses rather than guessing** wherever it cannot compute honestly. Each refusal names
the form or the facts that would supply it.

**The refusal surface is a partition, checked at `tsc`:** every one of **114 income, deduction,
credit and payment kinds** is either modeled or carries a refusal naming what is missing —
**38 modeled, 76 refused**, and `_EveryKindIsEitherModeledOrRefused` fails the build if a kind
falls in neither. Re-derive with `modeledKinds.length` / `unmodeledKindRefusals.length` in
`fjs/return/scope`.

The conditional refusals — the ones that fire on a taxpayer whose kinds are all modeled:

| Refused | Because |
|---|---|
| A nonqualified Roth distribution (1099-R box 7a code `J` or `T`) | Form 8606 Part III is unbuilt. Part I and **Part II compute**, so a backdoor Roth works. |
| Qualified disaster distributions (Form 8606 line 15b) | Form 8915-F is unbuilt |
| A business **loss** | the at-risk determination (Form 6198) needs a multi-year basis history |
| A mixed-tax-year document store | 2024 and 2025 W-2s together would silently mis-total |
| Two businesses, or two K-1s from one entity | netting them is the arithmetic §704(d) exists to stop |
| Two Schedules SE (both spouses self-employed) | one Schedule SE is computed; two are a phase of their own |

**Four refusals listed here before the release have since been built and are gone:** the Earned
Income Credit (Phase 32, `fjs/schedule/eic` → 1040 line 27a), QBI above the income threshold
(Phase 31, `fjs/form8995a` with Schedule A's SSTB percentage and Part III's wage/UBIA phase-in),
AMT with capital gains or qualified dividends (Phase 29, `fjs/form6251/part3`), and Form 8606
Part II.

**There is also a complementary guard.** Some taxes trigger on a threshold from data already held,
on a taxpayer who has never heard of the form — so **8 tripwires** refuse when the documents prove
an obligation was not declared. Without them, a $300,000 W-2 understated tax by ~$900, silently.
A tripwire that always fires is not a tripwire; each one is proven to stay quiet on a return that
does not owe the thing.

---

## The measured surface

**13 tools** · protocol `2025-11-25` · server `finance-mcp 1.0.0` · **27 document dialects**

| Group | Tools |
|---|---|
| Content store | `cas_add`, `cas_get`, `cas_list`, `cas_refresh` |
| Versioning | `evo_add`, `evo_list`, `evo_head`, `evo_revision` |
| Tax reference | `finance_schema`, `finance_tax_params`, `finance_documents_list` |
| Program execution | `fjs_run`, `fjs_check` |

**The tool count has not moved through twelve phases, deliberately.** A `finance_compute_1040` tool
would let the agent stop authoring programs, which is the one thing the architecture exists to
prevent. `tools/list` returning 13 is the check.

`finance_tax_params` takes **`year`**, not `taxYear` — `fjs_run` uses `taxYear` for the same
concept. The tool's own description says so; renaming it would be a breaking change to a live
surface. **Only 2025 exists** — `finance_tax_params` with any other year refuses and names it.

---

## Health

- `npm test`: **2253 / 2253**, exit 0 (`tsc` runs first and is clean). **Wall clock is 5-31s and
  is not a stable figure** — measured 31s, 4.9s, 12.5s and 11.9s across four runs on 2026-08-17
  with no code change between them. It is dominated by three tests that spawn real `node`
  subprocesses (`EXEC-14/PROV-09` alone ranged 3.5s-29.3s), so it tracks machine load, not the
  suite. The 2220 proof leaves are milliseconds each. Was 2242
  before the two standing gates below were added.
- **2220 project-local proof leaves** — the only stable count:
  `npm test 2>&1 | grep -c '^✔ import("./fjs/'`
- Requirements: **120 defined, 120 complete, 0 open**

**Two standing gates now compare the documents to the code**, because this file had been wrong
about the version, the dialect count, the test total and four separate refusals at once:
`planning-truth-gate.test.js` checks REQUIREMENTS.md's checkboxes against its traceability tables
and every tool/dialect count claimed in `.planning/*.md` and the root `*.md`, and
`fjs/server`'s `toolsListIsExactlyTheHandTypedToolSet` pins the served tool set by name in both
directions — the invariant that forbids a `finance_compute_1040` tool had nothing behind it until
2026-08-17.

**Never gate on `npm test`'s total** (AGENTS.md line 127). It includes ~2,100 vendored
`functionalscript` submodule proofs and moves with submodule state; the submodule is deliberately
de-initialised. Until 2026-08-17 the suite silently ran the entire proof set **twice** — bare
`node --test` was discovering the submodule's own `.ts` entry point — which is why `npm test` is
pinned to `node --test *.test.js` and why earlier versions of this file reported 8533 and 4273.

---

## Known gaps

Nothing here is an open requirement. **Six** `fjs/todo/` notes remain, each carrying a **tested**
reason and a recipe. (`fjs/todo/` holds nine files; the other three are satisfied specs kept in
their original present tense, each with a corrected status line at the top. An earlier version of
this list said "four" by counting table rows rather than notes.)

1. **`upstream-mjs-migration.md`** — `functionalscript` is pinned at 0.43.1 because 0.44/0.45
   dropped the `.js` emit. Migrating all 396 files was *measured* on a throwaway snapshot and still
   left **288 errors**, each fixable only by a cast, an `any`, or a redeclared type — all forbidden.
2. **`tax-return-report-source-k1-routes-unexercised.md`** — three route lines in the stored
   program's hand-authored text are executed by no fixture, and the cheap fixture is a fake pass.
3. **`schedule-b-omits-k1-interest-and-dividends.md`** — K-1 interest can push 1040 line 2b past
   Schedule B's $1,500 threshold while Schedule B's own line 4 stays below it.
4. Three upstream `fjs` notes, re-verified still open against 0.45.0.

**Phase 16 was RESOLVED BY REMOVAL** in Phase 31 (MAINT-01): `fjs/document/1099int/from_ocr` and
`fjs/document/ocr_amount` are deleted, and the `vnd.fjs.ocr` dialect itself stays live. This line
said the phase "remains deferred by owner decision" until 2026-08-17 — the deferral was real, and
then the decision was taken.
