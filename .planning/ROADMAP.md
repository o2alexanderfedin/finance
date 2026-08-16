# Roadmap: Finance

**Milestone:** v1
**Granularity:** fine (**16** phases on the critical path — 1-15 plus the inserted 12.1 — plus 3 backlog phases, **19 total**. See "Granularity Note" below.)
**Coverage:** **93** requirements total in REQUIREMENTS.md, of which **8** are MAINT backlog (Phases 16-18); the remaining 85 map across Phases 1-15 and 12.1.
**Count note:** these two lines were themselves stale until 2026-08-07 — they said "15 phases" and
"85 v1 requirements" after Phase 12 was split into 12 and 12.1, which is exactly the drift this note
warns about. Older totals of 79 and 83 also survive further down this file and in the coverage table;
they predate TEST-01..04 and the MAINT set. MAINT-03 owns reconciling those.
**Recompute rather than trust any prose in this file, including this line:**
```
grep -oE '\*\*[A-Z]+-[0-9]+\*\*' .planning/REQUIREMENTS.md | sort -u | wc -l   # requirements
grep -cE '^- \[[ x]\] \*\*Phase ' .planning/ROADMAP.md                          # phases
```
**Created:** 2026-08-03

## Overview

The project builds an execution substrate — content-addressed storage, an effect
whitelist, and a program runner — whose first workload is a Form 1040. The journey runs
from *correcting the planning documents* (twelve recorded claims that research proved
false), through a server skeleton that retires the integration risk in an hour, to the
riskiest component built first because it depends on nothing, to exact-cent arithmetic and
document dialects built in parallel with it, converging on a stored program that reads
real documents and returns a real figure. From there the tax surface widens one forcing
relation at a time until the declared taxpayer profile — 65+, brokerage sales, dependents,
itemizing — is complete, and the acceptance test is a line-by-line match against a filed
TY2025 return where every number carries the CAS hash it came from.

**Structure.** `todo/plan.md`'s Weeks 1–5 are the milestones and keep their names and
goals — that document is the project's own sequencing authority. Phases are sliced
underneath them. Research's Phase 0 is added in front as **Week 0**, because every phase
after it would otherwise be planned against text that dissolves on contact.

---

## Scope Honesty and the Cut Line

**The five-week plan is not achievable at the selected scope.** This is stated here rather
than discovered in week four.

The taxpayer profile (65+, brokerage sales, dependents, itemizes) was chosen deliberately
for realism, and it is a legitimate choice. It is also roughly **4–5× the v1 research
recommended** (1040 core + Schedule B + three dialects). Phases 11–13 alone contain nine
IRS forms/schedules and five document dialects, including the two hardest single
computations in the domain (the Schedule D Tax Worksheet and the 18-line Social Security
Benefits Worksheet), neither of which has been read line by line yet. `todo/plan.md`
allots one week — Week 3 — to what is here three phases.

**Where the cut line falls naturally: after Phase 10.**

| Phases | What you have | Honest? |
|---|---|---|
| **1–10** | The full execution thesis proven end to end, exact arithmetic, two dialects, TY2025 parameters, the Tax Table as data, Form 1040 lines 1a–37, and a **scope guard that refuses loudly** on anything unmodeled | **Yes.** TAX-16 is what makes a partial 1040 honest instead of quietly wrong. This is a shippable, defensible v1. |
| **11–13** | The declared taxpayer profile completed | Required before Phase 14 can pass |
| **14** | Acceptance against the user's own filed return | **Cannot pass without 11–13.** A 65+ TY2025 return omitting Schedule 1-A is structurally wrong, not merely incomplete. |
| **15** | Realism polish, multi-year, 1040-X, second report, upstream | v1.1 / v2 |

**Consequence to accept explicitly:** Phase 14 (Success Criterion 1 — "matches a real filed
return") is gated on Phases 11–13. If an external date drives the five weeks (open question
4, still unanswered), the choice is between shipping Phases 1–10 with an honest refusal
surface, or extending the schedule. Compressing Phases 11–13 to fit produces the one
failure mode this architecture exists to prevent: a plausible number for an input the
engine does not model.

### Granularity Note

`config.json` sets `granularity: fine` (target 8–12 phases). This roadmap has **19** — 16 on the
critical path (1-15 plus the inserted 12.1) and 3 in the backlog. The
work was derived first and the granularity applied as compression guidance second;
compressing to 12 would mean merging phases that have genuinely distinct verification
gates — for example folding the guest ABI freeze (widest blast radius of any interface
here; every stored program is frozen against it) into the `fjs_run` tool that consumes it.
At 93 requirements over 19 phases that is 4.9 requirements per phase, which is within the spirit of
`fine`.

The drift is worth naming rather than silently correcting: this paragraph said "**15**" and "79
requirements" until 2026-08-07, having gone stale twice — once when TEST-01..04 and the MAINT set
were added, and again when Phase 12 was split. Both times the prose was left behind by the work.
That is the whole argument for the recompute commands in this file's header: **a hand-maintained
count in prose is a second source of truth, and the second source is always the one that rots.**

---

## Parallelism

`config.json` sets `parallelization: true`. Three genuine concurrency opportunities, all
established by verified dependency facts rather than optimism:

| Concurrent set | Why it is safe |
|---|---|
| **Phase 1 ∥ Phase 2** | Corrections are documentation; the skeleton is assembly over verified fjs exports. Neither reads the other's output. |
| **Phase 3 ∥ (Phase 4 → Phase 5)** | **The execution spine and the format work are the genuine two-track split.** `interpret` depends on `fjs/effects` only — not CAS, not Evo, not MCP. Formats depend on nothing (not even on the subject model, which blocks only ingestion). This is `todo/plan.md`'s Track A / Track B, verified. |
| **Phase 8 ∥ Phase 9** | Parameter data and the report-line type share no code. Both gate Phase 10. |
| **Phase 11 ∥ Phase 12** | Wage/benefit dialects and the brokerage chain are independent form surfaces. Phase 13 depends on Phase 11 (SSA-1099 and 1099-R feed the Social Security Benefits Worksheet). |

Everything else is strictly sequential. In particular Phase 6 cannot start before both
Phase 3 and Phase 4 land — the ABI carries both the operation constructors and the money
helpers.

---

## Sequencing Constraints (verified — do not re-litigate)

These were established by execution, not inference. Any replan must preserve them.

1. **`interpret` first.** It depends on `fjs/effects` ONLY. It is the riskiest component
   and it has zero dependencies, so building it later carries the largest unknown for
   longer, for nothing. → Phase 3.
2. **Open question 5 blocks the guest ABI, not `fjs_run`** — one step earlier than the
   Week 1 spec places it, because it decides whether `casWrite` is in the guest vocabulary.
   Answered: the *tool handler* writes; the guest whitelist stays read-only. → Phase 6.
3. **Document formats have zero dependencies** and are genuinely parallel with the
   execution spine. → Phase 5 ∥ Phase 3.
4. **The 1099-DIV dialect FORCES the QDCGT worksheet** (box 1b > 0) **and the Schedule D
   Tax Worksheet** (boxes **2b, 2c and 2d** — i1040gi p31 Exception 1 names all three; earlier
   revisions of this line said "2b/2d" and were wrong. Corrected 2026-08-07).
   **AMENDED 2026-08-07 — this constraint is now historical.** It read "→ Phase 12 holds DOC-06,
   TAX-08, and TAX-11 in one phase," which no longer describes reality on two counts. TAX-08's
   QDCGT worksheet **already shipped in Phase 10** (`fjs/tax/line16/qdcgt/module.f.js`), and the
   remainder was split on 2026-08-07 into Phase 12 (documents: DOC-06, DOC-07, DOC-13, TAX-07) and
   Phase 12.1 (the chain: TAX-11, TAX-15).
   **The constraint's INTENT survives and is still binding**: never ship a dialect whose forcing
   worksheet does not exist. What actually happened is the harmless inverse — the worksheet shipped
   first, alone — and Phase 12.1 closes the gap by reclassifying dividends as modeled and wiring
   Form 1040 lines 3a/3b in the same atomic change. Doing either half without the other yields a
   confident zero where a refusal belongs.
5. **Money before any report program.** Retrofitting `Cents` after report programs exist
   means rewriting every one of them. → Phase 4, before Phase 9 and Phase 10.
6. **The Evo subject model before any real document is stored.** CAS has no delete;
   recovery is permanent, not merely expensive. → Phase 5 (DOC-01), and the project-local
   store lands even earlier, in Phase 2 (DOC-02).
7. ~~**The `Object.hasOwn` guard IS the "clean refusal" work.**~~ **Superseded by fjs
   0.41.0**, which delivers the guard upstream (`at` + `assert` in `match`). EXEC-02 is
   closed; EXEC-03 remains, but is now only the *reporting* half — catching the refusal and
   naming the permitted set. Smaller than planned, and no longer coupled to a security fix.
   → Phase 3.

---

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): planned milestone work
- Decimal phases (2.1, 2.2): urgent insertions (marked INSERTED)

### Week 0 — Corrections and Integration Smoke Test *(research addition, in front of the plan)*

- [x] **Phase 1: Planning-Document Corrections and the Upstream Report** - Delete every claim research proved false, and file the fjs soundness hole (completed 2026-08-03)
- [x] **Phase 2: Server Skeleton, Safe Registration, Project-Local Store** - A registered, protocol-correct, permission-scoped server with no logic of ours in it (completed 2026-08-03)

### Week 1 — First Working Prototype

- [x] **Phase 3: The Restricted Interpreter** - The whitelist that is actually a whitelist, with observed reads and a step budget (completed 2026-08-03)
- [x] **Phase 4: Exact Arithmetic and the Money Layering** - Integer cents, exact rationals, IRS half-up rounding at line boundaries (completed 2026-08-04)
- [x] **Phase 5: Document Base, Subject Model, and the First Two Dialects** - `vnd.fjs.ocr` and `vnd.fjs.1099int` on one base, rooted at permanent subjects (completed 2026-08-04)
- [x] **Phase 6: Guest ABI Freeze and Safe Materialization** - The whitelist expressed in the type, and a blob that becomes a module safely (completed 2026-08-04)
- [x] **Phase 7: `fjs_run`, Run Records, and the Week 1 Convergence** - A stored program reads real documents and returns a real figure (completed 2026-08-05)

### Week 2 — A Report Program Produces a Correct Figure

- [x] **Phase 8: TY2025 Parameters and the Tax Table as Data** - Cited parameters and a row-by-row-verified Tax Table (completed 2026-08-05)
- [x] **Phase 9: Traceable Report Lines and the Anti-Hardcoding Gate** - A line without sources does not typecheck; a constant answer fails the gate (completed 2026-08-05)
- [x] **Phase 10: Form 1040 Core, Line-16 Dispatch, and the Scope Guard** - Lines 1a–37, four-way line-16 branch, loud refusal outside scope (completed 2026-08-06; 10-10 Task 3's five-site mutation sweep verified and approved by the phase owner, who independently reproduced the mutation-3 type hole and site 2's differential)

### Week 3 — Breadth in Documents

- [x] **Phase 11: Wage, Retirement, and Benefit Documents** - W-2, SSA-1099, 1099-R, the document library, and the retraction story (completed 2026-08-07)
- [x] **Phase 12: Brokerage Documents** - 1099-DIV, 1099-B, the consolidated-1099 document model, and Schedule B *(SPLIT from the original Phase 12, 2026-08-07)* (completed 2026-08-08)
- [x] **Phase 12.1: The Capital-Gain Chain** - Form 8949, Schedule D, the Schedule D Tax Worksheet, and replacing the live line-16 refusal *(SPLIT from the original Phase 12, 2026-08-07)* (completed 2026-08-09)
- [x] **Phase 13: The 65+ Profile and the Remaining Schedules** - Schedule 1-A, the Social Security Benefits Worksheet, 8812, Schedule A, Schedules 1/2/3 (completed 2026-08-11)

**Why Phase 12 was split (2026-08-07).** Two findings made the original single phase wrong:

1. **TAX-08 was already delivered in Phase 10**, not pending. `fjs/tax/line16/qdcgt/module.f.js`
   is a complete 634-line Qualified Dividends and Capital Gain Tax Worksheet that already calls
   back into the Tax Table via `baseTaxForAmount`, with proofs asserting `method22 === 'taxTable'`.
   The original phase text scheduled building it. It must be verified and closed, never rebuilt.
2. **The remaining work is two separable bodies.** The document half (dialects, the consolidated-1099
   model, Schedule B) has no dependency on the worksheet half (8949 → Schedule D → the Schedule D
   Tax Worksheet, which must replace the `scheduleDTaxWorksheet` refusal that
   `fjs/tax/line16/module.f.js` returns today). Together they exceeded the size of Phase 10, the
   largest phase shipped so far. Splitting means a failure in the chain does not strand the dialects.

**Constraint 4's "ship the worksheet WITH the dialect" was already violated, in the safe direction.**
QDCGT shipped in Phase 10 without `vnd.fjs.1099div`. The constraint existed to prevent the opposite —
a dialect whose forcing worksheet does not exist — so the ordering that actually occurred is the
harmless one. Phase 12 wires the dialect into the worksheet that is already there.

### Week 4 — The Full Path Works on the User's Own Documents

- [ ] **Phase 14: Acceptance — Reproducible, Cited, End-to-End** - Line-by-line match against the filed return, adversarially verified
      **⚠ NOT AUTONOMOUS-EXECUTABLE.** This phase requires the taxpayer's real filed return and real
      source documents to compare against. No agent can produce them. Explicitly skipped by the phase
      owner on 2026-08-07 for the autonomous run; it needs a working session with the documents present.

### Week 5 — Technical Debt

- [x] **Phase 15: Realism Polish and Upstream** - Multi-year, mechanical 1040-X, a second report, and the fjs contributions (completed 2026-08-12)

### Backlog — Deferred Judgments

Not on the critical path. Each is a maintainer's decision that surfaced during Phases 7-9 and was
deliberately left untaken, so that discovering it did not become a reason to stop.

- [ ] **Phase 16: The Orphan Ingestion Island** - Wire the OCR conversion pipeline into the server, or remove it — **DEFERRED by owner decision 2026-08-12**, see the phase entry
- [ ] **Phase 17: Documentation Truth Pass** - Every claim a reader would act on is true, or is deleted
- [ ] **Phase 18: Dependency and Duplication Debt** - fjs 0.43.0, the duplicated step sequence, two copy-pasted checks

### Carved out of Phase 14 — Reproducibility Without the Filed Return

- [x] **Phase 19: Reproducibility and Report Provenance** - The three engineering requirements that were stranded when Phase 14 was skipped (added 2026-08-12, completed 2026-08-12)

### Written after the fact — work that shipped outside this roadmap

- [x] **Phase 20: Unemployment Compensation** - `vnd.fjs.1099g` and Schedule 1 line 7, built on 2026-08-14 in response to a real document the scope guard refused; **this entry was written on 2026-08-15, after the code was already committed** (see the phase entry)

### Milestone v2 — The Product Path and Four Personas (opened 2026-08-15)

- [ ] **Phase 21: The Last Mile** - The 1040 engine reachable from a stored guest program via `guestCtx`, and a real return produced through `evo_add` → `fjs_run` → `vnd.fjs.run`
- [ ] **Phase 22: Computable Tripwires** - Documents that imply a kind must have been declared; closes the silent-understatement hole
- [ ] **Phase 23: Schedule 2 Populated** - Forms 8959 and 8960 — **unblocks the FAANG employee**
- [ ] **Phase 24: Schedule 1 Adjustments** - Student loan interest, educator expenses, HSA — **unblocks the non-profit worker**
- [ ] **Phase 25: Schedule 3 Credits** - Saver's Credit, education credits, EITC
- [ ] **Phase 26: Retiree Completion** - Qualified Charitable Distributions and Form 8606
- [ ] **Phase 27: 1099-NEC and Schedule C** - Reversed from Out of Scope on 2026-08-15
- [ ] **Phase 28: Schedule SE and QBI** - **unblocks the startup founder**
- [ ] **Phase 29: Equity Compensation and AMT** - Forms 3921/3922, Form 6251, Form 8949 basis adjustment codes
- [ ] **Phase 30: Pass-Through Income** - Schedule K-1 and Schedule E

---

## Phase Details

**── Milestone: Week 0 — Corrections and Integration Smoke Test ──**

### Phase 1: Planning-Document Corrections and the Upstream Report
**Milestone**: Week 0 — Corrections and Integration Smoke Test
**Goal**: Every planning document states only things that are true, so no later phase is planned against text that dissolves on contact.
**Depends on**: Nothing (first phase) — runs concurrently with Phase 2
**Requirements**: DOCC-01, DOCC-02, DOCC-03, DOCC-04, DOCC-05, DOCC-06, DOCC-07, SEC-04
**Tier**: T0
**Success Criteria** (what must be TRUE):
  1. The two false mechanism claims are gone: `grep -rn "djs/parser" .planning todo fjs README.md` returns no proposal of it as a validation remedy, and no document still says an operation not in the map "simply cannot happen" without stating the guard condition that makes it true — now satisfied by fjs 0.41.0's own-property lookup rather than by a local guard.
  2. README `## Goal` and PROJECT.md Success Criterion 2 name Claude Code / Claude Desktop as the demonstration client, and remote HTTPS + OAuth transport is recorded as a v2 milestone.
  3. PROJECT.md's `import()` deferral rests on schedule grounds with named compensating controls, and no longer on "the sole user is trusted and local" — and `fjs/todo/implement-mcp-server.md` no longer claims `fjs_run` cannot be proof-tested.
  4. ~~A FunctionalScript issue exists for the `match` prototype-dispatch soundness hole~~ — **done**: [functionalscript#1419](https://github.com/functionalscript/functionalscript/pull/1419), fixed in 0.41.0, with the URL recorded in `PROJECT.md` and `todo/plan.md`.
  5. The TY2025 parameter-sourcing rule (Rev. Proc. 2024-40 **as modified by Rev. Proc. 2025-32**) is written where Phase 8 will read it, with the original 2025 inflation release named as the wrong source.
**Research**: Not needed — every correction is already established.
**Plans**: 3 plans
- [ ] 01-01-PLAN.md — Correct false mechanism/trust/audience claims (PROJECT.md, README.md, todo/plan.md, fjs/todo/implement-mcp-server.md)
- [ ] 01-02-PLAN.md — Reconcile storage-boundary money representation (REQUIREMENTS.md, ROADMAP.md)
- [ ] 01-03-PLAN.md — Correct Sergey's upstream file, file the FunctionalScript issue, record its URL

### Phase 2: Server Skeleton, Safe Registration, Project-Local Store
**Milestone**: Week 0 — Corrections and Integration Smoke Test
**Goal**: A registered, protocol-correct, permission-scoped MCP server exists and talks to a real client, with none of our logic in it yet.
**Depends on**: Nothing — runs concurrently with Phase 1
**Requirements**: MCP-01, MCP-02, MCP-03, MCP-04, MCP-05, SEC-01, DOC-02
**Tier**: T0
**Success Criteria** (what must be TRUE):
  1. `claude mcp add` registers the server and a real client completes `initialize` → `notifications/initialized` → `tools/list` → **and an actual `tools/call` arrives** — the silent-failure mode is a successful `tools/list` followed by no call at all.
  2. `initialize` responds with our own `McpConfig` at protocol version `2025-11-25` and our own server identity — not `casConfig`'s `2024-11-05` / `functionalscript-cas`.
  3. The registered launcher command line carries `node --permission` with scoped `--allow-fs-*` from this first registration, and a test blob whose module body calls `fs.rmSync` outside the allowed paths gets `ERR_ACCESS_DENIED`.
  4. A CI assertion confirms stdout carries only JSON-RPC across a full session; all diagnostics go to stderr.
  5. The CAS home is project-local and `git check-ignore` confirms it is ignored; `~/.cas` is untouched, and the root launcher `.js` contains nothing but the launcher line.
**Research**: Not needed — assembly over verified fjs exports, plus a 10-minute empirical protocol-version diff.
**Plans**: 3 plans
- [ ] 02-01-PLAN.md — Assemble financeConfig/financeMcpServer over casToolRegistry+evoToolRegistry; wire the launcher; gitignore the project-local store
- [ ] 02-02-PLAN.md — Full-session virtual-harness proof (protocol conformance, non-negotiation, stdout purity); record the mcpStep upstream gap
- [ ] 02-03-PLAN.md — Register with node --permission scoping, prove ERR_ACCESS_DENIED, and drive a real client to an observed tools/call

**── Milestone: Week 1 — First Working Prototype ──**

### Phase 3: The Restricted Interpreter
**Milestone**: Week 1 — First Working Prototype
**Goal**: A guest program can reach exactly the operations it is permitted, is refused actionably when it reaches further, cannot run forever, and cannot misreport what it read.
**Depends on**: Phase 1 (the corrected mechanism claim) — **runs concurrently with Phases 4 and 5**
**Requirements**: EXEC-01, EXEC-02, EXEC-03, EXEC-04, EXEC-05, EXEC-06
**Tier**: T0
**Success Criteria** (what must be TRUE):
  1. `node --test` passes a proof in which `constructor`, `toString`, `valueOf`, `hasOwnProperty`, `__defineGetter__`, and `fetch` **all** yield `operation not permitted: <name>; permitted: casRead, evoList, evoHead, evoRevision` — the prototype-inherited names are the ones a naive `in` or `!== undefined` guard admits.
  2. A non-terminating effect chain returns a bounded step-budget error instead of hanging the process — verified by a proof, not by observation.
  3. The interpreter returns the accumulated read set alongside the result; a proof asserts the observed reads are what the program actually requested, independent of anything the program declares.
  4. Every proof in this phase runs under `fjs/effects/mock` with no CAS, no Evo, no MCP, and no filesystem — the module imports `fjs/effects` and nothing else.
**Research**: Not needed — a working prototype of `interpret` under `mock` already exists, and the dispatch guard now comes from fjs 0.41.0 (verified against it).
**Plans**: 2 plans
- [ ] 03-01-PLAN.md — interpret's dispatch and refusal reporting (EXEC-01/03/04): the six prototype-inherited names plus the two-step `__defineGetter__` escalation, refused as a Result with the exact permitted-set text
- [ ] 03-02-PLAN.md — interpret's step budget and observed read set (EXEC-05/06): a bounded dispatch loop and the accumulated reads returned alongside the result, plus the import-boundary check

### Phase 4: Exact Arithmetic and the Money Layering
**Milestone**: Week 1 — First Working Prototype
**Goal**: Tax math is exact by construction, and rounding is a property of a 1040 line rather than of a value.
**Depends on**: Nothing — **runs concurrently with Phase 3**; gates Phase 5
**Requirements**: EXACT-01, EXACT-02, EXACT-03, EXACT-04, EXACT-05
**Tier**: T0 (EXACT-05 is T1)
**Success Criteria** (what must be TRUE):
  1. Proofs cover integer cents, exact rationals, and IRS half-up rounding **including negatives**; a proof asserts the chosen rule differs from `Math.round`, which returns `-2` for `-2.5` on a form full of losses.
  2. `grep -rn "toFixed\|parseFloat\|Math.round" fjs/` returns nothing inside arithmetic or tax code.
  3. A proof exhibits a case where `round(sum(x)) ≠ sum(round(x))`, and the module exposes only the former as the line-level operation — a money type that rounds on construction does not exist here.
  4. A proof demonstrates all three layers on one value: a decimal **string** in JSON at the storage boundary (never a JSON number — a JSON number is an IEEE 754 double before any arithmetic happens), exact rationals inside computation, decimal **strings** on the MCP wire (fjs's JSON `Primitive` has no `bigint`).
**Research**: Not needed.
**Plans**: 2 plans
- [x] 04-01-PLAN.md — Exact rational arithmetic and IRS half-up rounding (fjs/types/rational/module.f.js)
- [x] 04-02-PLAN.md — Fixed-scale decimal string <-> bigint layer, composed cents module, and the three-layer demonstration (fjs/types/decimal, fjs/exact)

### Phase 5: Document Base, Subject Model, and the First Two Dialects
**Milestone**: Week 1 — First Working Prototype
**Goal**: A document can be stored, versioned, and read back under an identity that can never be wrong, with the vision transcription preserved as its own artifact.
**Depends on**: Phase 2 (project-local store), Phase 4 (money as a string at the storage boundary) — **runs concurrently with Phase 3**
**Requirements**: DOC-00, DOC-01, DOC-03, DOC-04, DOC-05, DOC-10, DOC-11, DOC-12, DOC-14, DOC-17
**Tier**: T0 → T1
**Success Criteria** (what must be TRUE):
  1. A `vnd.fjs.ocr` blob fails `vnd.fjs.1099int` validation on **structure alone** — the exact-literal `dialect` discriminant does the work, proven, with no `{"dialect":` prefix shortcut.
  2. Each dialect's TypeScript type is derived via `Ts<typeof schema>`; `tsc --noEmit` is clean and the type is declared nowhere a second time. Refinements RTTI cannot express (currency exactness, date forms, cbase32 hashes) live in a separate semantic check beside the schema.
  3. A round-trip proof carries `"1,234.56"` from the OCR revision into `123456` cents in the typed revision, with the conversion on **exactly one** revision boundary.
  4. Re-adding the same artifact resolves to the same subject rather than creating a parallel history; a proof shows a blank box decodes as **absent, not zero**, that each dialect carries the form *revision* and not merely the tax year, and that `CORRECTED` is readable data.
  5. A >128 KiB PDF added via `npx functionalscript cas add` from another process becomes visible to `evo_head` in the running server **without a restart**.
**Research**: Not needed — `fjs/media/revision` is a literal 123-line template and every payload field was read from a current IRS PDF.
**Plans**: 4 plans
- [x] 05-01-PLAN.md — Document base spread helper (DOC-00) and Evo subject derivation (DOC-01)
- [x] 05-02-PLAN.md — vnd.fjs.ocr and vnd.fjs.1099int dialects (DOC-03/10/11/12), Success Criteria 1 and 2
- [x] 05-03-PLAN.md — OCR-to-cents conversion boundary and full-instance conversion, Success Criteria 3 and 4
- [x] 05-04-PLAN.md — cas_refresh tool and cross-process CLI ingestion proof, Success Criterion 5 (DOC-14)
- [x] 05-05 (no PLAN — user-directed scope addition, mid-phase) — `vnd.fjs.w2` (DOC-05, pulled
      forward from Phase 11) and `vnd.fjs.medical_expenses` (DOC-17, new), plus the shared
      `fjs/document/money_field` check the third dialect made worth extracting. See
      05-05-SUMMARY.md.

**Scope note:** the two dialects above were added on user instruction after the phase's four
planned plans were complete. The base was designed for the family (05-CONTEXT deferred W-2
saying "the base is designed for the family now so those land without reopening it"), and that
held — neither dialect required reopening `fjs/document/base` or the subject convention.

### Phase 6: Guest ABI Freeze and Safe Materialization
**Milestone**: Week 1 — First Working Prototype
**Goal**: The vocabulary every stored program is written against is fixed, expressed in the type system, and a blob becomes an executable module without inheriting the ways that go wrong.
**Depends on**: Phase 3 (operation constructors), Phase 4 (money helpers)
**Requirements**: EXEC-07, EXEC-09, SEC-02, SEC-03
**Tier**: T0 → T1
**Success Criteria** (what must be TRUE):
  1. A guest program typed `(args) => Effect<CasOp, T>` compiles; one reaching for `Fetch`, `Fs`, `Http`, or `Forever` **fails `tsc`** — the whitelist is in the type and EXEC-02's runtime refusal is the backstop, not the sole defense. The entry point is a distinct export, not `main`.
  2. A stored program that uses only the injected `ctx` runs with **zero** `import` statements in the blob — a CAS blob cannot resolve bare specifiers, so `ctx` is the only vocabulary there is.
  3. `import('https://attacker/x.js')` and `import('node:fs')` are rejected by the specifier allow-list **before** materialization, proven.
  4. Two distinct programs materialize under distinct content-hash-derived filenames; re-running the same hash reuses the cached module rather than silently re-running a different first program under a reused temp name.
  5. The whole materialize-and-run path is proof-tested under `fjs/effects/node/virtual` with a `JsModule` at the CAS path and **no real filesystem** — `import` is reached through the `import_` effect, never a raw expression.
**Research**: Not needed — the `import()` mechanics (extensionless, `data:`, bare specifiers, never-evicting URL-keyed ESM cache) were all executed.
**Plans**: 2 plans
- [x] 06-01-PLAN.md — the frozen guest ABI: CasOp, guestCtx, `report`, and the compile-time whitelist (EXEC-07), Success Criteria 1 and 2
- [x] 06-02-PLAN.md — specifier gate, hash-derived filenames, import via effect (SEC-02/03, EXEC-09), Success Criteria 3, 4 and 5

### Phase 7: `fjs_run`, Run Records, and the Week 1 Convergence
**Milestone**: Week 1 — First Working Prototype
**Goal**: An agent authors a program, stores it, runs it, and gets back a figure computed from real stored documents with a permanent record of what was read.
**Depends on**: Phase 5, Phase 6
**Requirements**: EXEC-08, EXEC-10, EXEC-11, EXEC-12, PROV-03, MCP-06
**Tier**: T1
**Success Criteria** (what must be TRUE):
  1. `todo/plan.md`'s Week 1 finish line: an agent calls `finance_schema('vnd.fjs.1099int')` to read the field names, authors a program, stores it, calls `fjs_run { hash, args?, subject?, parents? }`, and gets **total interest across every stored 1099-INT** back with its result and run-record hashes.
  2. The `vnd.fjs.run` record's `inputs[]` was **observed by the interpreter**, not declared by the program — proven by running a program that reads a document it does not cite and asserting the read still appears.
  3. `casWrite` and `evoAdd` are absent from the guest whitelist; `grep` confirms it, and the **tool handler** performed the result and run-record writes.
  4. A program throwing a non-`Error` value, a missing hash, and an import failure each return a tool-level `errorResult` — never a process crash, never a dropped connection.
  5. An oversized result returns `result too large; stored at <hash>` from an **explicit size check before `writeResponse`**, rather than inheriting the silent `-32603` the 128 KiB stdio line cap produces.
**Research**: Not needed.
**Plans**: 8 plans
- [x] 07-01-PLAN.md — Guest ctx combinators (step/pure) and money helpers; revise the two Phase 6 proofs distinguishing commands from combinators (EXEC-08 precursor, per 07-CONTEXT.md Decision 1)
- [x] 07-02-PLAN.md — vnd.fjs.run document dialect: schema, checkReferences, validate (PROV-03)
- [x] 07-03-PLAN.md — finance_schema MCP tool: dialect lookup + toJsonSchema serialization (MCP-06)
- [x] 07-04-PLAN.md — Size-guarded response envelope: sizeGuard, constants, ordering proof (EXEC-11)
- [x] 07-05-PLAN.md — materializeProgram (disk write, gitignored subdir) + synchronous snapshot/host-map with pinning (EXEC-08)
- [x] 07-06-PLAN.md — fjs_run handler: executeRun orchestration, handler-performed CAS writes, the run record, adversarial proof (EXEC-08, EXEC-10, EXEC-11, PROV-03)
- [x] 07-07-PLAN.md — EXEC-12 error taxonomy: non-Error throw, missing hash, import failure, each through the full handler with session-survival proof
- [x] 07-08-PLAN.md — Wire finance_schema/fjs_run into financeMcpHandlers; the Week-1 finish line end to end (all six requirements converge)
- [x] 07-09-PLAN.md — Real-process integration test: separate `node index.js` OS process, full JSON-RPC session over real stdio, real filesystem (TEST-01, TEST-02, TEST-04)

**Plan 07-09 was added mid-phase at the user's direction.** An audit found this project had 133
project-local proofs and exactly **one** real-process test; everything else runs under
`fjs/effects/node/virtual` — mocked filesystem, mocked stdio, no separate OS process. The forcing
finding: the product's central seam is untestable in that harness *by construction*. `virtual`'s
`writeFile` stores `[Vec]` chunks while its `import_` requires a `JsModule` function, so
write-then-import cannot compose in a virtual session — which is why Plan 07-08, despite being
titled "end to end", substitutes a `JsModule` stand-in for materialization. `fjs_run` would have
shipped with its central seam evidenced only by a mock.

Plan 07-09 proves it for real and asserts the materialized `.mjs` actually reached disk — the one
assertion no virtual proof can make. Per **TEST-03** this becomes a standing obligation: each
later phase adds real-process coverage for the tools and seams it ships, rather than deferring all
of it to Phase 14, whose criteria are about tax correctness rather than the execution seam.

**── Milestone: Week 2 — A Report Program Produces a Correct Figure ──**

### Phase 8: TY2025 Parameters and the Tax Table as Data
**Milestone**: Week 2 — A Report Program Produces a Correct Figure
**Goal**: Every number the engine consults is data with a citation, and the Tax Table is the published table rather than something derived from brackets.
**Depends on**: Phase 1 (the parameter-sourcing rule), Phase 4 — **runs concurrently with Phase 9**
**Requirements**: TAX-01, TAX-02, TAX-04, MCP-07
**Tier**: T1
**Success Criteria** (what must be TRUE):
  1. `finance_tax_params(2025)` returns the parameter set, each entry carrying its Rev. Proc. number, section, and effective date — so the agent reads parameters instead of recalling them.
  2. A `proof` diffs the stored Tax Table **row by row** against the published Publication 1040 across the full income range. Band widths are read from the source, not assumed uniform.
  3. A `proof` asserts MFJ taxable income $18,000 gives **$1,803** by table lookup — rows print tax on the interval midpoint, so bracket arithmetic's $1,800 is wrong and is the exact mistake the training data teaches.
  4. Every threshold in the parameter data has proofs at `threshold − 1¢`, `threshold`, and `threshold + 1¢`.
  5. The standard deduction values are the OBBBA-revised ones ($15,750 / $31,500 / $23,625), traceable to Rev. Proc. 2025-32 and not to the original 2025 inflation release.
**Research**: **YES** — the Tax Table's low-end band structure was not read line by line by any researcher, and two research files disagree ($50 uniform vs $5/$10/$25/$50). Highest-value research in the project.
**Plans**: 4 plans
- [x] 08-01-PLAN.md — TY2025 parameter data module with per-parameter citations (TAX-01)
- [x] 08-02-PLAN.md — Tax Table band structure, exact cumulative-bracket generator, row-by-row diff against hand-transcribed literals, tiling proof, $100,000 refusal, and mutation-verification of the diff (TAX-02)
- [x] 08-03-PLAN.md — Combined threshold inventory and generated threshold−1¢/threshold/threshold+1¢ boundary proofs (TAX-04)
- [x] 08-04-PLAN.md — finance_tax_params MCP tool, registry wiring, and the real-process integration-test call (MCP-07)

### Phase 9: Traceable Report Lines and the Anti-Hardcoding Gate
**Milestone**: Week 2 — A Report Program Produces a Correct Figure
**Goal**: A report line cannot exist without the sources it came from, and a program that contains the answer instead of computing it is caught mechanically.
**Depends on**: Phase 4, Phase 7 — **runs concurrently with Phase 8**
**Requirements**: PROV-01, PROV-02, PROV-07
**Tier**: T1 → T2
**Success Criteria** (what must be TRUE):
  1. `{ value }` without `{ sources }` **fails `tsc`** — traceability is enforced by the type system, not by authoring convention. A test file asserting the compile failure exists.
  2. Every computed line carries `(documentHash, boxPath, value)` tuples plus the rule or worksheet line it implements.
  3. Every run reports a CAS-read count and a numeric-literal audit alongside its result, both visible to the user.
  4. A perturbation gate: changing one input document moves the output, and a program shaped `() => pure({ line16: 9137 })` — which satisfies every other stated criterion — **fails**.
**Research**: Not needed.
**Plans**: 4 plans
- [x] 09-01-PLAN.md — Report-line type: Source/ReportLine, the PROV-01 compile-time assertion, verified by widen/revert (PROV-01, PROV-02)
- [x] 09-02-PLAN.md — Numeric-literal audit: countNumericLiterals, proven immune to digits in identifiers/strings/comments (PROV-07)
- [x] 09-03-PLAN.md — Zero-observed-reads kill condition and the six-key fjs_run response envelope (PROV-07)
- [x] 09-04-PLAN.md — Perturbation gate real leg, the verbatim `() => pure({ line16: 9137 })` adversary with its control leaf, integration-test envelope assertions (PROV-07)

### Phase 10: Form 1040 Core, Line-16 Dispatch, and the Scope Guard
**Milestone**: Week 2 — A Report Program Produces a Correct Figure
**Goal**: A real 1040 computes for a return inside the declared scope, and anything outside it is refused loudly rather than silently omitted.
**Depends on**: Phase 8, Phase 9
**Requirements**: TAX-03, TAX-05, TAX-06, TAX-16
**Tier**: T1
**Success Criteria** (what must be TRUE):
  1. Form 1040 lines 1a–37 compute for a return within the declared scope, each line citing the documents it derived from.
  2. Line 16 dispatches **explicitly** across Tax Table / Tax Computation Worksheet / QDCGT worksheet / Schedule D Tax Worksheet, with a `proof` per branch. The signature symptom of getting this wrong — line 16 off by $1–$12 while every line above it matches — is covered by a regression proof.
  3. The standard deduction applies age and blindness increments, with a proof at each combination the profile can produce.
  4. An unmodeled input produces a **loud refusal naming what is unmodeled**, never a silently omitted line — this is what makes REQ TAX-05's "full line-by-line" claim truthful for a partial engine.
  5. Rounding happens at line boundaries only (`round(sum)`, never `sum(round)`), verified on a line aggregating ten or more documents with real cents.
**Research**: **YES** — the QDCGT worksheet (~25 lines, the largest single computation in v1) was not read line by line and lives inside `i1040gi` rather than as a standalone PDF. Done: `10-RESEARCH.md`.
**Plans**: 10 plans in 6 waves
- [x] 10-01-PLAN.md — `qualifyingSurvivingSpouse` as a real filing status, with its stored TY2025 parameters and the threshold-inventory fan-out 42 → 50 (TAX-06) *(wave 1)*
- [x] 10-02-PLAN.md — The IRS whole-dollar election as an all-or-nothing report projection; `round(sum)` $14 vs `sum(round)` $10 (TAX-05, EXACT-04) *(wave 1)*
- [x] 10-03-PLAN.md — Tax Computation Worksheet, diffed against all twenty printed rows, plus the tagged level-3 base lookup and the $100,000 seam (TAX-03) *(wave 2, needs 10-01)*
- [x] 10-04-PLAN.md — `vnd.fjs.return_profile`: the declared return profile dialect, its frozen 50-kind vocabulary, and its `finance_schema` registration (TAX-16, TAX-05, TAX-06) *(wave 2, needs 10-01)*
- [x] 10-05-PLAN.md — Line 12e: all 19 chart combinations, the Dependents worksheet, and the two hard-zero exceptions (TAX-06) *(wave 2, needs 10-01)*
- [x] 10-06-PLAN.md — QDCGT's 25 lines and criterion 2's regression pair — $11,174 / $11,163 against a broken engine's $11,175 (TAX-03) *(wave 3, needs 10-03)*
- [x] 10-07-PLAN.md — `classifyScope`: the 6/44 modeled partition as a `tsc` property, and `scopeRefusal` as the one place a refusal is built (TAX-16) *(wave 3, needs 10-04)*
- [x] 10-08-PLAN.md — `dispatchLine16`: four branches plus three wrappers, tagged on both arms, with the Schedule D Tax Worksheet refusal (TAX-03, TAX-16) *(wave 4, needs 10-03, 10-06, 10-07)*
- [x] 10-09-PLAN.md — Form 1040 lines 1a–15 as `ReportLine`s with source union, and criterion 5 over ten real 1099-INT documents (TAX-05, TAX-06) *(wave 5, needs 10-02, 10-04, 10-05, 10-07)*
- [x] 10-10-PLAN.md — Lines 16–37, the whole-report scope refusal, and the phase mutation sweep checkpoint (TAX-05, TAX-16, TAX-03) *(wave 6, needs 10-08, 10-09)*

**── Milestone: Week 3 — Breadth in Documents ──**

### Phase 11: Wage, Retirement, and Benefit Documents
**Milestone**: Week 3 — Breadth in Documents
**Goal**: Every non-brokerage document the declared profile produces can be stored, listed, and retracted.
**Depends on**: Phase 5 — **runs concurrently with Phase 12**
**Requirements**: DOC-08, DOC-09, DOC-15, MCP-08 *(DOC-05 delivered early, in Phase 5)*
**Tier**: T2
**Success Criteria** (what must be TRUE):
  1. ~~`vnd.fjs.w2` stores box 12 as a list of `(code, amount)` pairs — box-12 confusion is a documented model failure — and boxes 15–20 faithfully as a repeating array that no computation reads.~~ **Delivered in Phase 5.** The "no computation reads them" half remains a live constraint on the phases that compute.
  2. `vnd.fjs.ssa1099` and `vnd.fjs.1099r` round-trip with every box explicitly absent-able, each box list read from the current IRS PDF rather than from recall.
  3. `finance_documents_list` enumerates stored documents with dialect, tax year, and subject.
  4. A wrongly ingested document can be marked `archived`, and the recorded decision on whether report programs filter archived revisions is enforced by a `proof` — there is a documented answer to "I uploaded the wrong document."
**Research**: **YES** — box lists for 1099-R and SSA-1099 are unverified and must be read from the IRS PDFs.
**Plans**: 5 plans in 2 waves
Plans:
**Wave 1**
- [x] 11-01-PLAN.md — `vnd.fjs.1099r` and `vnd.fjs.ssa1099` document dialects (DOC-09, DOC-08) *(wave 1)*
- [x] 11-02-PLAN.md — `buildRunSnapshot` archived-revision filtering fix, adversarial+control proof, Mutation Gate M1 (DOC-15) *(wave 1)*
- [x] 11-03-PLAN.md — `finance_documents_list` MCP tool (MCP-08) *(wave 1)*

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 11-04-PLAN.md — `finance_schema`'s atomic `dialectSchemas` bump to 7 (DOC-08, DOC-09) *(wave 2, needs 11-01)*
- [x] 11-05-PLAN.md — Register `finance_documents_list` + same-commit integration test coverage (MCP-08, TEST-03) *(wave 2, needs 11-03)*

### Phase 12: Brokerage Documents
**Milestone**: Week 3 — Breadth in Documents
**Goal**: Every brokerage document the declared profile produces can be stored and read, and the dividend half of the capital-gain story reaches the worksheet that already exists.
**Depends on**: Phase 10 (the QDCGT worksheet and line-16 dispatch), Phase 11 (the dialect and document-listing precedents)
**Requirements**: DOC-06, DOC-07, DOC-13, TAX-07
**Tier**: T2
**Success Criteria** (what must be TRUE):
  1. `vnd.fjs.1099div` stores the full printed box list, and a proof demonstrates its box 1b value has exactly the shape the **already-shipped** QDCGT worksheet consumes. TAX-08 is verified and closed here, **never rebuilt**: `fjs/tax/line16/qdcgt/module.f.js` already exists. **No wiring in this phase** — `fjs/return/scope` goes on refusing declared dividends, correctly, until Phase 12.1 reclassifies them AND wires Form 1040 lines 3a/3b in the same act. Reclassifying without wiring would yield silent-zero dividend income, which is worse than the refusal it replaces.
  2. `vnd.fjs.1099b` distinguishes a blank box 1e — "basis not reported" — from zero, proven by a case where treating it as zero **changes the gain**.
  3. One consolidated brokerage PDF yields *N* typed documents with *N* subjects, each recording the same artifact hash as provenance. One uploaded file is not one document. Modeling and subject derivation only — no new ingestion wiring (that is Phase 16's orphan island).
  4. Schedule B applies the $1,500 threshold and the foreign-account questions, reading stored 1099-INT and 1099-DIV documents. The foreign-account answers are taxpayer-DECLARED (they live on `vnd.fjs.return_profile`), never inferred from documents.
**Research**: **YES** — the 1099-DIV and 1099-B printed box lists must be read from the current IRS PDFs, not from recall, per Phase 11's precedent. Note 1099-B box numbering is a known drift risk.
**Plans**: 5 plans in 2 waves

**Wave 1**
- [x] 12-01-PLAN.md — `vnd.fjs.1099div` dialect, sourceArtifactHash, box 1b QDCGT-shape proof, Mutation Gate M1 (DOC-06) *(wave 1)*
- [x] 12-02-PLAN.md — `vnd.fjs.1099b` dialect, sourceArtifactHash, box 1e/box 12 consequence proof, Mutation Gate M3 (DOC-07) *(wave 1)*
- [x] 12-03-PLAN.md — Additive foreign-account fields on `vnd.fjs.return_profile` (TAX-07) *(wave 1)*

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 12-04-PLAN.md — Schedule B: Part I/II totals, the two independent $1,500 tests, Part III echo (TAX-07) *(wave 2, needs 12-01, 12-03)*
- [x] 12-05-PLAN.md — DOC-13 provenance proof, `finance_schema` atomic 7→9 registration, Mutation Gate M2 (DOC-13) *(wave 2, needs 12-01, 12-02)*

### Phase 12.1: The Capital-Gain Chain
**Milestone**: Week 3 — Breadth in Documents
**Goal**: A brokerage sale flows all the way to line 16 — replacing the refusal that stands there today.
**Depends on**: Phase 12 (`vnd.fjs.1099b` supplies the sales this chain computes over)
**Requirements**: TAX-11, TAX-15
**Tier**: T2
**Success Criteria** (what must be TRUE):
  1. A boxes 2b/2c/2d case routes through Form 8949 → Schedule D → the **Schedule D Tax Worksheet** and matches the printed forms line by line.
  2. `dispatchLine16`'s `scheduleDTaxWorksheet` branch **computes instead of refusing**. It returns a refusal today (`fjs/tax/line16/module.f.js`); after this phase that branch produces a figure. The refusal path must remain reachable for genuinely unmodeled input — the scope guard (TAX-16) is not weakened.
  2a. **The dividend wiring, moved here from Phase 12 on 2026-08-07.** `qualifiedDividends` and `ordinaryDividends` are reclassified from unmodeled to modeled in `fjs/return/scope/module.f.js` — paired with their deletion from `unmodeledKindRefusals`, which that module structurally requires — **in the same change** that wires Form 1040 lines 3a/3b in `fjs/form1040/core/module.f.js` and deletes the hardcoded `qualifiedDividendsCents: 0n` at the `dispatchLine16` call site. Doing the reclassification without the wiring produces a return that confidently reports zero dividend income instead of refusing: the exact failure TAX-16 exists to prevent, and strictly worse than the refusal it replaces.
  3. Form 8949's categories are driven by the box-1e distinction Phase 12 delivered: basis-reported vs. basis-not-reported, short-term vs. long-term.
  3a. **DOC-07's consequence must be RE-PROVEN here against real gain computation.** Phase 12 discharged it as far as a document phase can: `fjs/document/1099b`'s `criterion2GainConsequence` shows a proof-local `naiveGain` yields $10,000 for an absent box 1e versus $4,000 for a present one. But that helper is proof-local, so **no production mutation can redden it** — there was no production gain computation in Phase 12 to mutate. Once 8949/Schedule D compute real gains, a mutation that conflates absent-basis with zero-basis must turn a REAL proof red. Until then DOC-07 is demonstrated, not mutation-guarded.
  4. Each worksheet is one named pure function carrying the printed form's line numbers, in IRS order (TAX-15). **No variable named `magi`** — the MAGI for the IRA deduction, Roth eligibility, the Premium Tax Credit, IRMAA, and the student-loan-interest deduction have different add-back lists, and one name for five quantities is how they get confused.
**Research**: **YES** — the Schedule D Tax Worksheet's own line structure, and whether it is cent-exact or whole-dollar (the same open assumption A2 that the Tax Computation Worksheet carries; exactly one recorded value moves if it is wrong).
**Plans**: 4 plans in 3 waves

**Wave 1**
- [x] 12.1-01-PLAN.md — Form 8949 category derivation, aggregation, absent-basis/box-1f/1g refusal, Mutation Gate M1 (TAX-11) *(wave 1)*
- [x] 12.1-02-PLAN.md — The 47-line Schedule D Tax Worksheet, both worked examples, degenerate QDCGT equivalence (TAX-11, TAX-15) *(wave 1)*

**Wave 2** *(blocked on Wave 1)*
- [x] 12.1-03-PLAN.md — Schedule D lines 1a-21, the loss-cap three-way branch, the two bounded sub-worksheets, Mutation Gate M2 (TAX-11) *(wave 2, needs 12.1-01)*

**Wave 3** *(blocked on Wave 2)*
- [x] 12.1-04-PLAN.md — Form 1040 lines 3a/3b/7a wiring (Task 1, lands first — safe while the scope guard still refuses), THEN the six-kind scope reclassification + branch-2a computation + the demo fix (Task 2, the atomic transition point), THEN Mutation Gates M3/M4/M5 (Task 3) (TAX-11, TAX-15) *(wave 3, needs 12.1-01, 12.1-02, 12.1-03)*

### Phase 13: The 65+ Profile and the Remaining Schedules
**Milestone**: Week 3 — Breadth in Documents
**Mode:** mvp
**Goal**: The declared taxpayer profile is structurally complete — a 65+ TY2025 return with dependents that itemizes is no longer missing anything it is required to have.
**Depends on**: Phase 11, Phase 12
**Requirements**: TAX-09, TAX-10, TAX-12, TAX-13, TAX-14
**Tier**: T2
**Success Criteria** (what must be TRUE):
  1. Schedule 1-A Parts I/V/VI compute the senior deduction with the 6% phase-out over $75k/$150k, feeding Form 1040 line 13b — a 65+ TY2025 return without it is structurally wrong, not merely incomplete.
  2. The 18-line Social Security Benefits Worksheet matches the printed worksheet on a case that exercises its near-circular dependency.
  3. Schedule A computes and is **compared against** the standard deduction, with proofs in both directions — itemizing does not automatically win above $15,750 / $31,500.
  4. Schedule 8812 computes for the declared dependents, and Schedules 1, 2, and 3 carry every line the profile actually reaches.
  5. `grep -rn "magi" fjs/` returns nothing — each rule's MAGI is a separately named function stating its own add-back list, because the IRA deduction, Roth eligibility, the Premium Tax Credit, IRMAA, and the student-loan-interest deduction do not share one.
**Research**: **YES** — MAGI add-back lists per rule, phase-out cliff mechanics, and Schedule 1-A limitation mechanics.
**Plans**: 13 plans in 5 waves (one wave per vertical slice, CONTEXT.md Decision 6.1 — supersedes the original three-wave shape)

**Wave 1** (TAX-10 — retirement and Social Security income)
- [x] 13-01-PLAN.md — Citation discriminated union, SSB base-amount parameters, the 18-line Social Security Benefits Worksheet
- [x] 13-02-PLAN.md — 1099-R/SSA-1099 wiring into 1040 lines 4a-6b/25b, the iraDeductionDeclared refusal, four-kind reclassification, end-to-end proof *(needs 13-01)*

**Wave 2** (TAX-09 — the senior deduction)
- [x] 13-03-PLAN.md — Senior deduction parameters, Schedule 1-A Parts I/V/VI *(needs 13-02)*
- [x] 13-04-PLAN.md — Wire 1040 line 13b, reclassify seniorAndOtherScheduleOneADeductions, end-to-end proof *(needs 13-03)*

**Wave 3** (TAX-13 — itemizing)
- [x] 13-05-PLAN.md — vnd.fjs.itemized_deductions dialect, SALT cap/medical floor parameters, Schedule A line 18 election *(needs 13-04)*
- [x] 13-06-PLAN.md — Schedule A (all 18 lines), the withholding-drift proof, w2/1099r docstring amendments *(needs 13-05)*
- [x] 13-07-PLAN.md — deductionChoice, wire 1040 line 12e, reclassify itemizedDeductions, end-to-end proof both directions *(needs 13-06)*

**Wave 4** (TAX-12 — dependents and Schedule 8812)
- [x] 13-08-PLAN.md — return_profile dependents array, CTC/ODC/ACTC/phase-out parameters *(needs 13-07)*
- [x] 13-09-PLAN.md — Schedule 8812 Parts I/II-A, roundUpToNextThousandDollars, dependent classification *(needs 13-08)*
- [x] 13-10-PLAN.md — Wire 1040 lines 19/28, reclassify childTaxCreditOrOtherDependents/additionalChildTaxCredit, end-to-end proof *(needs 13-09)*

**Wave 5** (TAX-14 — remaining schedules and the sweep)
- [x] 13-11-PLAN.md — Schedules 1/2/3 as standalone, printed-line-complete, documented-zero modules *(needs 13-10)*
- [x] 13-12-PLAN.md — Wire 1040 lines 8/10/17/20/23/31, the first full-profile end-to-end proof combining all five slices *(needs 13-11)*
- [x] 13-13-PLAN.md — The mechanical MAGI gate, ten corrected remedy strings, the 18-line REQUIREMENTS.md/ROADMAP.md correction *(needs 13-12)*

**A finding from planning, worth the phase owner's attention**: `scheduleOneAdditionalIncome`, `scheduleOneAdjustments`, `scheduleTwoTaxes`, `scheduleThreeNonrefundableCredits` and `scheduleThreeRefundableCredits` are NOT reclassified to `modeledKinds` in this plan set, unlike CONTEXT.md Decision 6.1's table implies. 13-RESEARCH.md's own Open Questions 1 and 2 found that each is one coarse kind covering many distinct Schedule 1/2/3 line items with no per-line dialect to attribute a real dollar figure to — reclassifying them while the module can only ever return `$0` would be a confident zero replacing an honest refusal, exactly TAX-16's failure mode. Research's own recommendation ("No action needed for Phase 13's target profile") is followed. Final `modeledKinds`/`unmodeledKindRefusals` split after this phase: 20/30 (not the 25/25 a literal reading of the table would suggest).

**── Milestone: Week 4 — The Full Path Works on the User's Own Documents ──**

### Phase 14: Acceptance — Reproducible, Cited, End-to-End
**Milestone**: Week 4 — The Full Path Works on the User's Own Documents
**Goal**: All four of PROJECT.md's success criteria hold simultaneously against the user's own filed return, verified adversarially rather than optimistically.
**Depends on**: Phase 13
**Requirements**: *(none — all three moved to Phase 19 on 2026-08-12)*
**Tier**: T2
**Status**: **SKIPPED by owner decision 2026-08-11.** Criteria 1 and 2 below cannot be met
without the user's own filed TY2025 return in a working session, which is the part that
genuinely required the owner. Criteria 3, 4 and 5 did not — they were pure engineering, and
carrying three requirements against a phase nobody had scheduled left them homeless. They are
now **Phase 19**, and this phase keeps only what actually needs the taxpayer.
**Success Criteria** (what must be TRUE):
  1. Upload → vision → store → ask "what do I owe for 2025?" → program authored, stored, run → answer with citing hashes, in one Claude Code / Claude Desktop session touching no code.
  2. **Every line** of the user's filed TY2025 return matches — line by line, not just totals.
  3. ~~Adding an amended revision to a subject **between** two runs of a pinned program leaves the output byte-identical.~~ → **moved to Phase 19** (PROV-05)
  4. ~~Run records carry `pinned: true|false`.~~ → **moved to Phase 19** (EXEC-13)
  5. ~~Report output states the tax year, the parameter-set hash, and the program hash alongside the figures.~~ → **moved to Phase 19** (PROV-04)
**Research**: Partial — 30 minutes to confirm whether TaxCalcBench's 51-case input format is directly consumable or needs a shim into `vnd.fjs.*`.
**Plans**: TBD

**── Milestone: Week 5 — Technical Debt ──**

### Phase 15: Realism Polish and Upstream
**Milestone**: Week 5 — Technical Debt
**Goal**: The claims that "reports are programs" and "amendments are a diff" are demonstrated rather than asserted, and what stabilized goes upstream.
**Depends on**: Phase 14
**Requirements**: MCP-09, DOC-16, TAX-17, PROV-06, PROV-08
**Tier**: T3
**Success Criteria** (what must be TRUE):
  1. A second, **non-tax** report runs over the same documents with no engine change — the cheapest possible proof that this is not a tax engine wearing a disguise.
  2. A corrected document produces Form 1040-X Columns A / B / C mechanically from a diff of two stored reports, with per-line source hashes already attached and no new mechanism built.
  3. A prior-year capital loss carries over into the current year's Schedule D, and any year with parameters and documents computes.
  4. `fjs_check(hash)` smoke-checks a stored program without running it to completion, and is documented in the repo as having **zero** security value.
  5. `fjs/media`'s `detect` recognises our dialects through a registry contributed **upstream** to FunctionalScript — a list of dialect decoders that falls through when none match, not local glue.
**Research**: **YES** — child-process isolation design, the wall-clock kill path, and the upstream API shapes (see v2 in REQUIREMENTS.md).
**Plans**: 6 plans across 2 waves
- [x] 15-01-PLAN.md — PROV-08: income-by-payer report, import-graph gate, real fjs_run proof
- [x] 15-02-PLAN.md — TAX-17 foundations: no-bare-2025 gate, prior-year capital-loss dialect, Capital Loss Carryover Worksheet
- [x] 15-03-PLAN.md — MCP-09: fjs_check pure logic, registration, zero-security-value documentation
- [x] 15-04-PLAN.md — PROV-06: the amendment-diff module (Columns A/B/C from two run hashes)
- [x] 15-05-PLAN.md — TAX-17 wiring: carryover into Schedule D and Form 1040, year-genericity proof
- [x] 15-06-PLAN.md — DOC-16: local dialect registry, wired into cas_refresh, REQUIREMENTS.md correction

---

**── Backlog: Deferred Judgments ──**

These three phases exist because a decision was found, not because work was scheduled. Each was
surfaced by an audit during Phases 7-9 and each is a maintainer's call. None blocks the v1 tax
result; all are T3. They are written down so they are decided deliberately rather than rediscovered.

### Phase 16: The Orphan Ingestion Island
**Milestone**: Backlog
**Goal**: The OCR-conversion pipeline is either reachable from the running server or is gone. Tested code that nothing can execute is worse than either.
**Depends on**: Nothing
**Requirements**: MAINT-01
**Tier**: T3
**Status**: **DEFERRED by owner decision 2026-08-12.** Not skipped and not cancelled — the
decision was postponed, not made. MAINT-01 stays open and this phase stays in the milestone.

> **Criterion 1 below is factually wrong and must be corrected before this phase is planned.**
> Measured 2026-08-12: `fjs/document/subject` is **not** an orphan —
> `fjs/document/consolidated_provenance/module.f.js:41` imports `formSubject` and calls it
> twice (lines 117-118), which is Phase 12's shipped DOC-13 provenance proof. Deleting it as
> written would break verified work. The two words are also inverted: `ocr_amount` and
> `subject` are `from_ocr`'s **dependencies**, not its dependants.
>
> The real orphan is **396 lines across two modules**, not 576 across three:
> `fjs/document/1099int/from_ocr` (296 lines, imported by nothing) and
> `fjs/document/ocr_amount` (100 lines, imported only by `from_ocr`). Verified by grepping
> for real `import` statements rather than bare name mentions — the name `subject` appears in
> four docstrings that are not imports, which is how the original criterion went wrong.

**Success Criteria** (what must be TRUE):
  1. An import graph from `index.js` either reaches `fjs/document/1099int/from_ocr`, or that module and **its one exclusive dependency `fjs/document/ocr_amount`** no longer exist. **`fjs/document/subject` is out of scope either way** — it has a live importer.
  2. If wired: a real-process integration call exercises the conversion, per TEST-03's standing rule — the tool a client would call has actually been called.
  3. If removed: `todo/plan.md`'s Track B is amended to state plainly that the agent authors the typed dialect JSON itself and stores it via the already-registered `evo_add`, so the next reader does not rebuild what was just deleted.
**Research**: No — the decision needs the author's intent, not investigation.
**Plans**: TBD

### Phase 17: Documentation Truth Pass
**Milestone**: Backlog
**Goal**: Every claim a reader would act on is true, or it is deleted. A wrong remedy is worse than no remedy.
**Depends on**: Nothing
**Requirements**: MAINT-02, MAINT-03, MAINT-04, MAINT-05
**Tier**: T3
**Success Criteria** (what must be TRUE):
  1. No requirement marked `[x]` is contradicted by a live file. Specifically DOCC-01, whose own verification document asserts a grep is clean while `fjs/todo/implement-mcp-server.md` still carries the `djs/parser` remedy verbatim.
  2. `fjs/todo/upstream-mcp-protocol-version-negotiation.md`'s proposed fix works when applied. It currently compares `pr.protocolVersion` where `pr` is the destructured result *tag*, so the comparison is against `undefined`.
  3. TEST-04 either holds or has been amended: `npm test` runs both real-process tests today, so there is no fast proofs-only loop for the requirement's stated rationale to protect.
  4. TAX-02's wording matches what is proven — ten hand-transcribed Publication 1040 rows plus a structural tiling proof, not a row-by-row diff of ~2,000 generated rows.
  5. One requirement count is stated, and it is right. The document currently says 79 in one place and 83 in another; the real figure moves whenever requirements are added, so state it where it can be recomputed rather than in prose.
  6. `fjs/todo/implement-mcp-server.md` no longer reads "Status: spec, not implemented", and its two "blocking, resolve before implementing" questions are marked resolved with the answers that shipped.
**Research**: No.
**Plans**: TBD

### Phase 18: Dependency and Duplication Debt
**Milestone**: Backlog
**Goal**: The vendored dependency is current, and the remaining duplications are shared rather than copied.
**Depends on**: Nothing
**Requirements**: MAINT-06, MAINT-07, MAINT-08
**Tier**: T3
**Success Criteria** (what must be TRUE):
  1. `package.json` takes `functionalscript` **0.44.0**, the suite is green on it, and each of the four `fjs/todo/upstream-*.md` notes has been re-checked against the new version.

     > **Corrected 2026-08-13, by owner decision.** This criterion said **0.43.0**, which
     > `package.json` had already exceeded — it has declared `^0.43.1` since Phase 15, and
     > 0.43.1 is what is installed. Satisfying the literal text would have meant doing nothing.
     > The registry's current release is **0.44.0**, so the criterion's *intent* — "the vendored
     > dependency is current" — now means 0.44.0, and the owner chose to honour the intent.
     >
     > The "one such note was already retired" clause is **`upstream-json-parse-split.md`**,
     > which has read *"landed upstream and adopted here — `parse` is total as of 0.42.0"*
     > since before this phase was written. Its own text says to delete it once adopted; that
     > has not happened. The other three (`mcp-protocol-version-negotiation`,
     > `node-spawn-effect`, `total-match-dispatch`) all read "not filed upstream yet" and must
     > each be re-checked against 0.44.0 — a note claiming a gap that upstream has since closed
     > is exactly the wrong-remedy defect Phase 17 exists to eliminate.
  2. `executeRun`'s step sequence is shared with `runExecuteRunViaFixture` rather than written twice. Proven the only way that counts: reorder or insert a step, and both the virtual proofs and the integration test go red. The helper itself stays — `fjs/effects/node/virtual` cannot compose a write with an import in one session.
  3. The `formRevision must not be empty` check exists once, shared the way `moneyFieldError` already is, rather than byte-identically in **six** dialect files.

     > **Corrected 2026-08-13 from measurement.** This criterion said **two** dialect files. It
     > is six: `1099int` (line 130), `1099r` (232), `w2` (196), `ssa1099` (130), `1099div` (234)
     > and `1099b` (264), each carrying the identical
     > `` error(`formRevision must not be empty or whitespace-only`) ``.
     >
     > **The undercount is the point, not a typo.** Phase 19 shipped after four separate
     > blockers of exactly this shape — a claim about a population that was true of the part
     > someone looked at and false of the whole. This criterion was written when four of the six
     > dialects did not yet exist, and nothing re-derived it as Phases 11 and 12 added them.
     > **Re-derive before fixing:** `grep -rn "formRevision must not be empty" fjs`. If it
     > returns more than six, a dialect was added after this note and the count is stale again.
  4. `artifactSubject` is either called by something or deleted. *(Confirmed 2026-08-12: `fjs/document/subject/module.f.js:48` exports it and nothing outside that file references it. Note this is a different question from Phase 16's — `formSubject`, from the same file, IS live.)*
**Research**: No.
**Plans**: 4 plans
- [ ] 18-01-PLAN.md — Bump functionalscript to ^0.44.0 alone, then re-check the four upstream-*.md notes against it
- [ ] 18-02-PLAN.md — Share the formRevision check across all six dialects (formRevisionError), Mutation Gates M1+M2
- [ ] 18-04-PLAN.md — Split fjs-run-integration.test.js into node:test subtests (WR-03), Mutation Gate M4
- [ ] 18-03-PLAN.md — Share executeRun/runExecuteRunViaFixture's tail (Mutation Gate M3) and delete artifactSubject

**── Carved out of Phase 14: Reproducibility Without the Filed Return ──**

### Phase 19: Reproducibility and Report Provenance
**Milestone**: Week 4 — The Full Path Works on the User's Own Documents
**Goal**: A report says which tax year, which parameters and which program produced it, and a pinned program run twice over a store that changed underneath it produces byte-identical output.
**Depends on**: Phase 13 (inherited from Phase 14). **Not** Phase 14 itself — the acceptance run is a consumer of these three properties, not a prerequisite for them.
**Requirements**: EXEC-13, PROV-04, PROV-05
**Tier**: T2
**Created**: 2026-08-12, by owner decision, carved out of skipped Phase 14.

> **Why this phase exists.** Phase 14 bundled two separable things: an acceptance run against
> the owner's real filed TY2025 return, and three engineering properties that make such a run
> *meaningful*. Skipping Phase 14 on 2026-08-11 stranded all five criteria together, leaving
> EXEC-13, PROV-04 and PROV-05 as the milestone's only homeless requirements. **None of the
> three needs the taxpayer's return.** They are ordinary engineering against machinery that
> already ships: `vnd.fjs.run` already records a `pinned` flag field (PROV-03, complete), and
> `programHash` is already load-bearing in Phase 15's amendment diff.

**Success Criteria** (what must be TRUE):
  1. Run records carry `pinned: true|false`, and an unpinned run is marked as such. `vnd.fjs.run` already declares the field under PROV-03 — this criterion is about the flag being *set meaningfully and read*, not about the field existing. Check what is already true before planning work to add it.
  2. Report output states the tax year, the parameter-set hash, and the program hash alongside the figures, framed as a reviewed estimate to check against the source documents before filing.
  3. Re-running a pinned program over the same inputs reproduces the report **byte-identically**, verified **adversarially**: add an amended revision to a subject *between* the two runs and assert the output does not move. A reproducibility check that passes only because nothing changed is not a check, and a proof that cannot fail is worse than no proof — mutate the pinning so the second run *does* drift, and watch this go red.
  4. The parameter-set hash in criterion 2 is derived, never hand-written. Phase 15 established that `programHash` equality already implies parameter-set equality because guest programs cannot import and bake every parameter in as a literal; whatever this phase adds must not contradict that finding or duplicate it.
**Research**: No — the mechanisms (`vnd.fjs.run`, `programHash`, Evo revisions, `fjs/report/line`) all exist and are proven. This is wiring and proof work, not investigation.
**Plans**: 3 plans across 3 waves
- [x] 19-01-PLAN.md — EXEC-13/PROV-04 foundations: fjs/report/provenance/module.f.js (paramSetHash, reviewedEstimateFraming, the acceptance predicate)
- [x] 19-02-PLAN.md — PROV-04/EXEC-13 wiring: taxYear on fjs_run's schema/record/response across every existing call site, plus Mutation Gate M2
- [x] 19-03-PLAN.md — PROV-05: the real-process control-then-pinned byte-identical reproduction proof, plus Mutation Gate M1

---

### Phase 20: Unemployment Compensation
**Milestone**: Week 5 — Realism
**Goal**: A 1099-G's unemployment compensation reaches Form 1040 line 8 and its withholding reaches line 25b, and every box this engine cannot compute is refused by name rather than silently dropped.
**Depends on**: Phase 10 (the scope guard), Phase 13 (Schedule 1).
**Requirements**: DOC-18, TAX-18
**Tier**: T2
**Code committed**: 2026-08-14 (`8d00990`). **This entry written**: 2026-08-15.

> **⚠ THIS PHASE IS WRITTEN AFTER THE FACT, AND THAT IS THE MOST USEFUL THING ABOUT IT.**
>
> The work did not come from this roadmap. It came from a real IRS Wage and Income Transcript
> the owner handed to the engine mid-session, which the engine **refused** — correctly, on the
> first real document it had ever seen. Unemployment compensation reaches 1040 line 8 through
> Schedule 1 line 7, and line 7 was a declared zero whose only scope kind was a coarse
> catch-all. TAX-16's guard fired exactly as designed and named what it could not compute.
>
> The feature was then built, proven and committed **entirely outside the GSD structure**: no
> CONTEXT, no VALIDATION, no PATTERNS, no PLAN, no plan-check, no code review, no verification.
> It is recorded here as an exception rather than dressed up as a phase that was planned,
> because a roadmap whose entries are all tidy is not evidence that the process was followed —
> it is evidence that the record was tidied.
>
> **What that bypass cost, concretely:** every defect class caught during the surrounding
> sessions — vacuous proofs, mutation gates that could not compile, required-red leaves that
> could not redden, four separate population undercounts — was caught *by* the artifacts this
> work skipped. The retrofit's verification pass (`20-VERIFICATION.md`) is the one gate applied
> after the fact; the others cannot be recovered.

**Success Criteria** (what must be TRUE — written after the fact, then verified against the shipped code, not assumed from it):
  1. A `vnd.fjs.1099g` dialect exists, is registered in `kindVocabulary`, `modeledKinds`, `finance_schema` and `fjs/media/dialects`, and a live server reports it among its document dialects.
  2. Box 1 summed across every supplied 1099-G is Schedule 1 line 7, and reaches 1040 line 8 through Schedule 1's Part I total — not by a side channel.
  3. Box 4 joins 1040 line 25b alongside the existing 1099 withholding terms.
  4. Boxes 2, 5, 6, 7 and 9 are **refused by name, naming the destination line**, when present and non-zero; accepted silently when zero. Box 11 is deliberately **not** refused, because state withholding never reaches a federal return.
  5. `Form1040Inputs.unemploymentForms` is required, so `tsc` — not a convention — enforces it on every production caller.
  6. Each of the three behaviours above was **watched to fail**: a mutation gate per behaviour, production restored byte-identical.
**Research**: No — it was reactive work against machinery that already shipped.
**Plans**: **0. None were written.** The `0/0` in the progress table is literal.

---

**── Milestone v2: The Product Path and Four Personas ──**

Opened 2026-08-15 by owner decision after `.planning/PERSONA-COVERAGE.md` measured the engine
against four taxpayers. One of the four is supported; one computes a **wrong** return; two refuse.
Requirements and per-phase mapping live in REQUIREMENTS.md's "v2 Requirements" section — 25 IDs,
counted separately from v1's 95.

> **Phase 22 is a hard prerequisite for 23 through 30 and must not be reordered.** Every phase
> after it adds a form the engine will compute; each one landing before the tripwires widens the
> window in which the engine answers confidently and wrongly. This is not a style preference —
> today a $300,000 W-2 produces a return understating tax by roughly $900, silently, because the
> scope guard cannot see a threshold-triggered tax the taxpayer did not know to declare.

### Phase 21: The Last Mile
**Goal**: A guest program calls the 1040 engine and produces a real return through the product path.
**Depends on**: Phases 6, 7, 19 — all complete.
**Requirements**: EXEC-14, PROV-09
**Tier**: T0

> **This phase exists because the project's two proven halves have never been joined.**
> `form1040Report` has no production caller; `demo/steps/00-about.js:140` says so on the demo's
> own first page. Phase 19's provenance header and PROV-05's pinned reproduction have therefore
> never run against an actual 1040.
>
> **The obvious implementation is forbidden, and that is the whole design content of this phase.**
> A server tool that reads documents, assembles `Form1040Inputs` and calls the engine is exactly
> the `finance_compute_1040` tool REQUIREMENTS.md rules out — *"would destroy the thesis
> permanently. The agent would call it and never author a program again."* The 2026-08-15 handoff
> described the last mile in precisely those forbidden terms, and it would have been built that
> way had the persona survey not re-read the Out of Scope list.
>
> **The route that preserves the thesis:** `guestCtx` already carries pure non-effect helpers
> (`step`, `pure`, `centsFromString`, `centsToString`) beside the four frozen CAS commands, and
> `_CasOpIsExactlyTheFourCommands` pins the **effect** vocabulary, not the context. The engine
> joins that pure list. The agent still authors the program.

**Success Criteria** (what must be TRUE):
  1. A stored guest program, with zero `import` statements, reads documents through `casRead`/`evoHead` and calls the 1040 engine from `ctx`, returning a report.
  2. `_CasOpIsExactlyTheFourCommands` still compiles **unchanged** — the effect whitelist does not widen by one entry. Verify by mutation: add a fifth effect and watch `tsc` stop the build.
  3. A real return runs end to end: documents in via `evo_add`, program in CAS, executed by `fjs_run`, result written as `vnd.fjs.run` with Phase 19's provenance header populated.
  4. PROV-05's pinned reproduction is exercised **against that real 1040** — amend a subject between two runs and assert byte-identical output. Today it has only ever run against a fixture.
  5. No `finance_compute_1040`-shaped tool is added. A reviewer must be able to check this by reading `tools/list`.
**Research**: No — every mechanism exists and is proven. This is wiring.

### Phase 22: Computable Tripwires
**Goal**: A document that implies a tax obligation forces the declaration, so the engine refuses instead of silently understating.
**Depends on**: Phase 21.
**Requirements**: TAX-19
**Tier**: T0
**Success Criteria**:
  1. A table of (predicate over stored documents) → (kind that must be declared), evaluated before any line computes.
  2. W-2 box 5 above the Additional Medicare Tax threshold, with `scheduleTwoTaxes` undeclared, **refuses** — naming the form and the line.
  3. The refusal reuses `fjs/return/scope`'s existing `scopeRefusal` shape. One place builds a scope refusal; this does not become a second.
  4. A legitimately-zero case still computes: below threshold and undeclared is silence, not a refusal. A tripwire that always fires is not a tripwire.
  5. Watched to fail: invert each predicate, watch the matching leaf redden, restore byte-identical.
**Research**: No.

### Phase 23: Schedule 2 Populated — unblocks the FAANG employee
**Requirements**: TAX-20 (Form 8959), TAX-21 (Form 8960), TAX-22 (split the coarse kind) · **Tier**: T1
**Success Criteria**: 8959's 0.9% above the unindexed $200k/$250k/$125k thresholds reaches Schedule 2 line 11 → 1040 line 23; 8960's 3.8% on the lesser of NII or excess MAGI reaches Schedule 2 line 12; `scheduleTwoTaxes` splits into per-line kinds with **only the wired lines reclassified, in the same commit**; and TAX-15's "no variable named `magi`" rule is honoured — 8960's MAGI has its own add-back list.

### Phase 24: Schedule 1 Adjustments — unblocks the non-profit worker
**Requirements**: TAX-23, TAX-24, DOC-19 · **Tier**: T2
**Success Criteria**: student loan interest with its phase-out at line 21, educator expenses at line 11, HSA at line 13, each reading a `vnd.fjs.adjustments` taxpayer-asserted document that follows `vnd.fjs.medical_expenses` exactly; and **the hard zeros are replaced, not supplemented** — a reviewer must be able to confirm no `zero(...)` remains on a line this phase claims.

### Phase 25: Schedule 3 Credits
**Requirements**: TAX-25 (Form 8880), TAX-26 (Form 8863), TAX-27 (EITC) · **Tier**: T2

### Phase 26: Retiree Completion
**Requirements**: TAX-28 (QCD election, $108,000 TY2025 cap), TAX-29 (Form 8606 pro-rata) · **Tier**: T2
**Note**: TAX-28 closes a **silent overstatement** — today a QCD'd RMD is taxed in full. It is the mirror image of Phase 22's understatement, and neither is visible to the taxpayer.

### Phase 27: 1099-NEC and Schedule C
**Requirements**: DOC-20, DOC-21, TAX-30 · **Tier**: T3
**Note**: This phase reverses an Out-of-Scope decision made 2026-08-03 and struck through on 2026-08-15. The original rationale — *"the three-box simplicity is a trap; the downstream is Schedule C / SE / QBI"* — is preserved in REQUIREMENTS.md as a warning, because it was correct.

### Phase 28: Schedule SE and QBI — unblocks the startup founder
**Requirements**: TAX-31 (Schedule SE), TAX-32 (Form 8995/8995-A) · **Tier**: T3
**Depends on**: Phase 23 — Schedule SE feeds Schedule 2 line 4, so it cannot land before Schedule 2 computes. **Also note the wage-base coordination**: the Social Security ceiling is shared with W-2 box 3 wages already counted, so this is not a standalone computation.

### Phase 29: Equity Compensation and AMT
**Requirements**: DOC-22 (3921), DOC-23 (3922), TAX-33 (Form 6251), TAX-34 (Form 8949 basis codes) · **Tier**: T3
**Note**: TAX-34 closes a **double-taxation** bug for anyone with RSUs — brokers report $0 or unadjusted basis and the filer must adjust. Form 8949 already exists; this is its adjustment column.

### Phase 30: Pass-Through Income
**Requirements**: DOC-24 (K-1, two dialects — 1065 and 1120-S box numbering differs), TAX-35 (Schedule E) · **Tier**: T3

---

## Progress

**Execution Order:** Phases execute in numeric order, with the concurrency sets in
"Parallelism" above run together: 1 ∥ 2 → 3 ∥ (4 → 5) → 6 → 7 → 8 ∥ 9 → 10 → 11 ∥ 12 → 13 → 14 → 15
Phases 16-18 are backlog: unordered, independent of each other and of the critical path.

**Remaining order is deliberately NOT numeric: 19 → 18 → 17.** Phase 14 is skipped and Phase 16
is deferred, so three phases remain, and two reasons override the numeric default:
> - **19 before 18.** Both touch `executeRun` — Phase 18's criterion 2 shares its step sequence
>   with `runExecuteRunViaFixture`. Sharing the sequence *after* Phase 19 has finished changing
>   it means the shared version is the final one, instead of being refactored twice.
> - **17 last.** It is the documentation truth pass. Running it before 18 and 19 change code
>   would re-stale the very claims it exists to make true — the failure mode this project has
>   hit three times in STATE.md alone.

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Planning-Document Corrections | Week 0 | 3/3 | Complete | verified 11/11 |
| 2. Server Skeleton and Registration | Week 0 | 3/3 | Complete | verified 11/11 |
| 3. The Restricted Interpreter | Week 1 | 2/2 | Complete | verified 11/11 |
| 4. Exact Arithmetic | Week 1 | 2/2 | Complete | verified 10/10 |
| 5. Document Base and First Dialects | Week 1 | 5/5 | Complete | 2026-08-04 (no verification pass) |
| 6. Guest ABI and Materialization | Week 1 | 2/2 | Complete | 2026-08-04 (no verification pass) |
| 7. `fjs_run` and Run Records | Week 1 | 9/9 | Complete | 2026-08-05 (no verification pass) |
| 8. TY2025 Parameters and Tax Table | Week 2 | 5/5 | Complete | verified 2026-08-05 |
| 9. Traceable Report Lines | Week 2 | 8/8 | Complete   | verified 2026-08-06 |
| 10. 1040 Core and Scope Guard | Week 2 | 10/10 | Complete   | verified 2026-08-06 5/5 |
| 11. Wage, Retirement, Benefit Documents | Week 3 | 5/5 | Complete   | 2026-08-08 |
| 12. Brokerage and Capital-Gain Chain | Week 3 | 5/5 | Complete   | 2026-08-08 |
| 12.1 The Capital-Gain Chain | Week 3 | 4/4 | Complete   | 2026-08-09 |
| 13. The 65+ Profile and Schedules | Week 3 | 13/13 | Complete   | 2026-08-11 |
| 14. Acceptance | Week 4 | 0/TBD | **Skipped** (owner, 2026-08-11) — needs the filed return | - |
| 15. Realism Polish and Upstream | Week 5 | 6/6 | Complete   | 2026-08-12 |
| 16. The Orphan Ingestion Island | Backlog | 0/TBD | **Deferred** (owner, 2026-08-12) | - |
| 17. Documentation Truth Pass | Backlog | 0/TBD | Not started | - |
| 18. Dependency and Duplication Debt | Backlog | 0/TBD | Not started | - |
| 19. Reproducibility and Report Provenance | Week 4 | 3/3 | Complete | 2026-08-12 |
| 20. Unemployment Compensation *(retrofitted)* | Week 5 | 0/0 — no plans were written | Complete (code 2026-08-14, recorded 2026-08-15) | 2026-08-14 |
| **── Milestone v2 ──** | | | | |
| 21. The Last Mile | v2 | 0/TBD | Not started | - |
| 22. Computable Tripwires | v2 | 0/TBD | Not started | - |
| 23. Schedule 2 Populated | v2 | 0/TBD | Not started | - |
| 24. Schedule 1 Adjustments | v2 | 0/TBD | Not started | - |
| 25. Schedule 3 Credits | v2 | 0/TBD | Not started | - |
| 26. Retiree Completion | v2 | 0/TBD | Not started | - |
| 27. 1099-NEC and Schedule C | v2 | 0/TBD | Not started | - |
| 28. Schedule SE and QBI | v2 | 0/TBD | Not started | - |
| 29. Equity Compensation and AMT | v2 | 0/TBD | Not started | - |
| 30. Pass-Through Income | v2 | 0/TBD | Not started | - |

> **Phase 12.1 was missing from this table** until 2026-08-12, which is why plan totals
> computed from it came out four short. Added from measurement.
>
> **Phase 20's `0/0` is literal, not a placeholder.** The work shipped with no PLAN files
> because it never went through planning. Counting it as `1/1` or `2/2` would make the plan
> totals lie in order to make the table look regular.

---

## Coverage

| Category | Count | Phases |
|---|---|---|
| DOCC (documentation corrections) | 7 | 1 |
| MCP (server and tools) | 9 | 2, 7, 8, 11, 15 |
| EXEC (execution spine) | 13 | 3, 6, 7, **19** |
| DOC (formats and ingestion) | 19 | 2, 5, 11, 12, 15, **20** |
| EXACT (exact arithmetic) | 5 | 4 |
| TAX (tax computation) | 18 | 8, 10, 12, 13, 15, **20** |
| PROV (provenance and reporting) | 8 | 7, 9, 15, **19** |
| SEC (security) | 4 | 1, 2, 6 |
| TEST (testing discipline) | 4 | 7, and standing across 8-15 |
| MAINT (maintenance debt) | 8 | 16, 17, 18 |
| **Total** | **95** | **19 phases** |

**All 95 requirements map to a phase. No orphans. No duplicates.** TEST-03 maps to a *range*
(Phases 8-15, standing), so the older "exactly one phase" wording was false for that one row.

> **This table said 79 until 2026-08-12 and was wrong twice over.** It omitted the MAINT
> category entirely (8 requirements across Phases 16-18), and its own category counts summed to
> 90, not 79. REQUIREMENTS.md separately said 83. The real figure is **93** — measured, not
> transcribed: `grep -c '^- \[[ x]\] \*\*' .planning/REQUIREMENTS.md` (82 complete, 11 open).
> **Phase 17's success criterion 5 exists precisely because of this defect**, so if you are
> reading this while planning Phase 17: the count is stated here, it is now right, and the
> criterion asks you to state it *where it can be recomputed* rather than in prose. Re-measure
> before trusting the number above.
>
> EXEC-13, PROV-04 and PROV-05 moved from skipped Phase 14 to new Phase 19 on 2026-08-12,
> which is why Phase 14 no longer appears in this table.
>
> **93 → 95 on 2026-08-15** with the DOC-18/TAX-18 retrofit. Note what this table got right
> that its counterpart did not: REQUIREMENTS.md's own "Coverage by phase" table was found the
> same day summing to **81** against a declared 93, omitting Phases 16-18 entirely and three
> TEST requirements from Phase 7. Two coverage tables over one requirement set disagreed by
> twelve, and neither had a check. Both now reconcile at 95 by command, not by transcription.

---
*Roadmap created 2026-08-03 from PROJECT.md, REQUIREMENTS.md, todo/plan.md,
fjs/todo/implement-mcp-server.md, and the research corpus. Milestones are `todo/plan.md`'s
weeks and keep its names; Week 0 is research's addition.*
