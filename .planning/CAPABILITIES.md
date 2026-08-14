# What This System Can Actually Do

**Re-measured on `e7837a3`** (branch `feature/phase-18-dependency-and-duplication-debt`), 2026-08-14.
Supersedes the versions pinned to `449846a` and `6053db9`.

> **Nothing in the capability set changed since the `6053db9` measurement, and that was checked
> rather than assumed.** Phase 19 has since merged to `develop` (PR #66) and Phase 18 has been
> planned — 4 plans, 3 waves, plan-checked twice, 3 blockers fixed — but **Phase 18 has executed
> zero plans**, so no shipped behavior moved. The live probe was re-run anyway and returned an
> identical surface: 13 tools, `fjs_run` requiring `[hash, taxYear]`, 9 document dialects, 1 tax
> year. "It shouldn't have changed" is a prediction; this line records a measurement.

> **Every number in this document was measured, not inferred.** That rule exists because the
> first version of this file got the tool count wrong **three times** (7, then 8, then 12; the
> answer was 13) by grepping for `toolEntry(` declarations — which miss the upstream
> `casToolRegistry`/`evoToolRegistry` spread into `financeMcpHandlers`. That error produced a
> false headline claim: *"no document-write tool is registered."* `evo_add` had been there all
> along.
>
> **To re-derive any figure below: start the server and ask it.** Send `initialize` →
> `notifications/initialized` → `tools/list` over stdio NDJSON. For the dialect and tax-year
> sets, call a tool with a deliberately invalid argument — the refusal names the valid set.
> `cas-refresh-cross-process.test.js` has the spawn-and-speak pattern to copy.

---

## The one-sentence version

An MCP server that stores tax documents as content-addressed, versioned JSON, and **runs a
report as a program** — the agent writes FunctionalScript, the server executes it as a pure
function of `(documents, tax-year parameters) → report`, and records exactly what it read.

---

## The tool surface — 13 tools

Measured from a live `tools/list` on `6053db9`.

| Tool | Required args | All args | What it does |
|---|---|---|---|
| `cas_add` | `content` | `content`, `type` | Write a blob; returns its content hash |
| `cas_get` | `hash` | `hash`, `content` | Read a blob back |
| `cas_list` | — | — | Every hash in the store |
| `evo_add` | `parents` | `parents`, `subject`, `snapshot`, `archived` | **Write a document revision.** This is the ingestion path |
| `evo_head` | `subject` | `subject` | Current revision(s) of a subject |
| `evo_list` | — | `archived` | All subjects, active or archived |
| `evo_revision` | `hash` | `hash` | One revision's metadata |
| `cas_refresh` | — | — | Re-scan the store for out-of-band writes; returns `{status, dialectCounts}` |
| `finance_schema` | `dialect` | `dialect` | JSON Schema for a document dialect |
| `finance_tax_params` | `year` | `year` | TY parameters with citations |
| `finance_documents_list` | — | `archived` | `{subject, dialect, taxYear, hash}` per stored document |
| **`fjs_run`** | **`hash`, `taxYear`** | `hash`, `taxYear`, `args`, `subject`, `parents` | **Run a stored program.** Returns the result, a run record, and a provenance header |
| `fjs_check` | `hash` | `hash` | Validate a program's export shape **without executing it** |

`serverInfo`: `{"name":"finance-mcp","version":"0.12.0"}` · protocol `2025-11-25` · stdio transport.

> **`fjs_run`'s contract changed in Phase 19.** `taxYear` is now **required**. An older client
> sending only `hash` is refused by the tool's own RTTI check before the handler runs. An
> unknown year returns a tool-level `errorResult` naming the known years — never a throw, never
> a server crash.

---

## What it knows

**9 document dialects** (`finance_schema`'s own refusal message is the source):

`vnd.fjs.1099int` · `vnd.fjs.1099div` · `vnd.fjs.1099b` · `vnd.fjs.1099r` · `vnd.fjs.ssa1099` ·
`vnd.fjs.w2` · `vnd.fjs.medical_expenses` · `vnd.fjs.return_profile` · `vnd.fjs.ocr`

**15 `detect`-registry entries** — a *different, larger* population than the 9 above.
`fjs/media/dialects` additionally registers `vnd.fjs.run`, `vnd.fjs.revision`,
`vnd.fjs.prior_year_capital_loss` and `vnd.fjs.itemized_deductions`, which are not
`finance_schema` document types. Do not conflate the two counts — they answer different
questions.

**1 tax year: 2025.** `finance_tax_params` with `year: 1999` returns *"unknown tax year: 1999;
known: 2025"*. Multi-year support is structural (proven year-generic in Phase 15) but only
TY2025's figures are transcribed.

---

## Scenarios that run start to end today

### 1. Store documents and compute a full Form 1040 ✅

The system's headline path, and it works end to end in one MCP session.

1. `evo_add` each document as a typed dialect JSON revision — W-2s, 1099-INT/DIV/B/R,
   SSA-1099, a `return_profile`, medical expenses
2. `finance_documents_list` to confirm what landed
3. `cas_add` a FunctionalScript report program
4. `fjs_check` it — export shape validated **without executing**
5. `fjs_run` it with `taxYear: 2025`

Computes, against real stored documents: Form 1040 lines 1a–37, Schedules 1, 1-A, 2, 3, A, B, D,
Forms 8949 and 8812, the SSB worksheet, the QDCGT and Schedule D Tax Worksheets, the Tax
Computation Worksheet, and the Capital Loss Carryover Worksheet. The maximal declared profile —
65+, dependents, brokerage sales, itemizing — computes fully.

**Money is exact.** `bigint` cents throughout; decimal strings at every storage and wire
boundary; never an IEEE 754 double.

### 2. Get provenance with the answer ✅ *(new in Phase 19)*

Every `fjs_run` response carries **ten keys**, not six: alongside `resultHash`, `runHash`,
`preview`, `truncated`, `readCount` and `literalCount`, it now states `taxYear`, `paramSetHash`,
`programHash`, and a verbatim "reviewed estimate — check against the source documents before
filing" framing. The same provenance is persisted into the `vnd.fjs.run` record.

### 3. Reproduce a pinned run byte-for-byte, adversarially ✅ *(new in Phase 19)*

Pin a run to `subject` + `parents`, run it, **land an amended revision on that subject**, run it
again — the output is byte-identical, verified on both the `resultHash` string and the fetched
blob's actual bytes.

This is proven the only way that counts: the **unpinned control moves** (head hash
`ww82kfbs…` → `n4dpdrp5…`) and is asserted to move *before* the pinned assertion is trusted. A
reproducibility check that passes because nothing changed is not a check.

### 4. Mechanical Form 1040-X columns ✅

`amendmentDiff` produces columns A/B/C from two stored run records, with `B = C − A`. Refuses
loudly when the two runs have different `programHash` values — you cannot diff two different
programs and call it an amendment.

### 5. A second, non-tax report over the same documents ✅

`fjs/report/payer` produces per-payer interest/dividend totals through the **unmodified**
`fjs_run` engine, importing nothing from `fjs/tax/*`. This is the evidence for "the report is a
program, not a hardcoded answer" — a genuinely different report, no engine change.

### 6. Refuse honestly when out of scope ✅

50 return "kinds" are classified: 20 modeled, 30 refused by name. An unmodeled situation
produces a **named refusal**, never a silently wrong number.

### 7. Notice out-of-band store writes without restarting ✅

A second OS process writes to the store; `cas_refresh` makes the running server see it. Proven
with a genuinely separate process, not an in-process simulation.

### 8. Retract a document ✅

Archived revisions become unreachable through the guest vocabulary
(`evoList → evoHead → evoRevision → casRead`).

---

## What does NOT work end to end

| Gap | Reality |
|---|---|
| **PDF/image → typed document** | **No OCR ingestion tool is registered.** The agent must author the typed dialect JSON itself and store it via `evo_add`. `fjs/document/1099int/from_ocr` exists, is tested, and is reachable from nothing — Phase 16's deferred wire-or-delete decision. |
| **Any tax year but 2025** | Structurally year-generic and proven so, but only TY2025's figures are transcribed. |
| **Acceptance against a real filed return** | Phase 14, skipped by owner decision. **Nothing here has been checked line-by-line against a real return.** |
| **TY2025 figures verified against printed IRS PDFs** | Phase 13's constants were never checked by a human against the source forms. A green suite proves the engine agrees with the constants it was handed — never that a constant was transcribed correctly. |
| **Remote transport / OAuth** | Explicit v2 milestone. stdio only. |
| **e-filing** | Never in scope. |

---

## Honest limits on the trust you can place in this

- **It is not a filing tool.** Output is framed as a reviewed estimate to check against source
  documents. That framing is now a code constant, not just prose.
- **Phase 13's TY2025 constants are unverified against the printed forms**, and Phase 10's Tax
  Computation Worksheet cent-exactness is an open question. Both were to be settled by Phase 14's
  acceptance run, which is skipped, so **neither has a scheduled owner.**
- **`import()` runs a stored program's body with full Node privileges.** Node has no network
  permission, so exfiltration by a malicious stored program is unmitigated in-process. An
  accepted, documented risk — and the reason `fjs_check` exists and is documented as having
  **zero** security value: it validates shape without executing, which is a convenience, not a
  sandbox.
- **`paramSetHash` uses source-order JSON, not canonical.** Reordering fields in a `TaxParamSet`
  literal — changing no dollar figure — would silently change every provenance header.
  Documented at the function; worth knowing before you rely on the hash across refactors.

---

## Measured state

| | |
|---|---|
| Suite | `npm test` **6314/6314**, 0 fail, exit 0 (re-run on `27ba2c2`, `duration_ms 25337`) |
| Project-local proofs | **916** (de-duplicated) |
| Full-suite runtime | **~25–140s**, varying ~5× with load (eight runs, 2026-08-12/14) |
| Requirements | **85 of 93** complete (91.4%) |
| Phases | **16 of 20** complete |
| Plans | **85 of 89** (Phase 18's 4 are written but unexecuted) |
| MCP tools | **13** |
| `functionalscript` | **0.43.1** — Phase 18 Wave 1 will take it to 0.44.0 |

**Re-derive, don't quote.** Tools: probe the server. Proofs:
`node --test 2>&1 | grep '^✔ import("./fjs/' | sed 's/ ([0-9.]*ms)$//' | sort -u | wc -l`
(the bare `grep -c` form double-counts 2× when the submodule is initialized). Requirements:
`grep -c '^- \[x\] \*\*' .planning/REQUIREMENTS.md`.

---

## Still open

- **Phase 18** — dependency and duplication debt. **Planned, zero plans executed.** 4 plans in 3
  waves: bump `functionalscript` to 0.44.0 alone; share the six-way `formRevision` duplication;
  share `executeRun`'s tail and delete `artifactSubject`; split the integration test into 12
  subtests. None of it changes a computed figure — it is all refactor and dependency work.
- **Phase 17** — documentation truth pass (not started). Its criterion 5 is the requirement count,
  which this project has stated wrongly in three places.
- **Phase 16** — the orphan ingestion island (deferred by owner decision, 2026-08-12). This is why
  there is still no OCR ingestion tool.
- **Phase 14** — acceptance against the filed return (skipped; needs the owner's own documents).
- **Release** — `develop` is >110 commits ahead of `main`. Phase 19 **is** merged (PR #66); the
  release itself remains a separate deliberate act.
