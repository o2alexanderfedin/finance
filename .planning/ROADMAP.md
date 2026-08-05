# Roadmap: Finance

**Milestone:** v1
**Granularity:** fine (15 phases — see "Granularity Note" below)
**Coverage:** 83 / 83 v1 requirements mapped (79 original + TEST-01..04 added mid-Phase-7)
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
computations in the domain (the Schedule D Tax Worksheet and the 19-line Social Security
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

`config.json` sets `granularity: fine` (target 8–12 phases). This roadmap has **15**. The
work was derived first and the granularity applied as compression guidance second;
compressing to 12 would mean merging phases that have genuinely distinct verification
gates — for example folding the guest ABI freeze (widest blast radius of any interface
here; every stored program is frozen against it) into the `fjs_run` tool that consumes it.
At 79 requirements, 15 phases is 5.3 requirements per phase, which is within the spirit of
`fine`.

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
   Tax Worksheet** (boxes 2b/2d). They are scheduled *together*, never sequentially.
   → Phase 12 holds DOC-06, TAX-08, and TAX-11 in one phase.
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

- [ ] **Phase 1: Planning-Document Corrections and the Upstream Report** - Delete every claim research proved false, and file the fjs soundness hole
- [ ] **Phase 2: Server Skeleton, Safe Registration, Project-Local Store** - A registered, protocol-correct, permission-scoped server with no logic of ours in it

### Week 1 — First Working Prototype

- [ ] **Phase 3: The Restricted Interpreter** - The whitelist that is actually a whitelist, with observed reads and a step budget
- [ ] **Phase 4: Exact Arithmetic and the Money Layering** - Integer cents, exact rationals, IRS half-up rounding at line boundaries
- [ ] **Phase 5: Document Base, Subject Model, and the First Two Dialects** - `vnd.fjs.ocr` and `vnd.fjs.1099int` on one base, rooted at permanent subjects
- [ ] **Phase 6: Guest ABI Freeze and Safe Materialization** - The whitelist expressed in the type, and a blob that becomes a module safely
- [ ] **Phase 7: `fjs_run`, Run Records, and the Week 1 Convergence** - A stored program reads real documents and returns a real figure

### Week 2 — A Report Program Produces a Correct Figure

- [ ] **Phase 8: TY2025 Parameters and the Tax Table as Data** - Cited parameters and a row-by-row-verified Tax Table
- [ ] **Phase 9: Traceable Report Lines and the Anti-Hardcoding Gate** - A line without sources does not typecheck; a constant answer fails the gate
- [ ] **Phase 10: Form 1040 Core, Line-16 Dispatch, and the Scope Guard** - Lines 1a–37, four-way line-16 branch, loud refusal outside scope

### Week 3 — Breadth in Documents

- [ ] **Phase 11: Wage, Retirement, and Benefit Documents** - W-2, SSA-1099, 1099-R, the document library, and the retraction story
- [ ] **Phase 12: Brokerage Documents and the Capital-Gain Chain** - 1099-DIV *with* QDCGT, 1099-B, Schedule B/8949/D and the Schedule D Tax Worksheet
- [ ] **Phase 13: The 65+ Profile and the Remaining Schedules** - Schedule 1-A, the Social Security Benefits Worksheet, 8812, Schedule A, Schedules 1/2/3

### Week 4 — The Full Path Works on the User's Own Documents

- [ ] **Phase 14: Acceptance — Reproducible, Cited, End-to-End** - Line-by-line match against the filed return, adversarially verified

### Week 5 — Technical Debt

- [ ] **Phase 15: Realism Polish and Upstream** - Multi-year, mechanical 1040-X, a second report, and the fjs contributions

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
- [ ] 07-03-PLAN.md — finance_schema MCP tool: dialect lookup + toJsonSchema serialization (MCP-06)
- [ ] 07-04-PLAN.md — Size-guarded response envelope: sizeGuard, constants, ordering proof (EXEC-11)
- [ ] 07-05-PLAN.md — materializeProgram (disk write, gitignored subdir) + synchronous snapshot/host-map with pinning (EXEC-08)
- [ ] 07-06-PLAN.md — fjs_run handler: executeRun orchestration, handler-performed CAS writes, the run record, adversarial proof (EXEC-08, EXEC-10, EXEC-11, PROV-03)
- [ ] 07-07-PLAN.md — EXEC-12 error taxonomy: non-Error throw, missing hash, import failure, each through the full handler with session-survival proof
- [ ] 07-08-PLAN.md — Wire finance_schema/fjs_run into financeMcpHandlers; the Week-1 finish line end to end (all six requirements converge)
- [ ] 07-09-PLAN.md — Real-process integration test: separate `node index.js` OS process, full JSON-RPC session over real stdio, real filesystem (TEST-01, TEST-02, TEST-04)

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
**Plans**: TBD

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
**Plans**: TBD

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
**Research**: **YES** — the QDCGT worksheet (~25 lines, the largest single computation in v1) was not read line by line and lives inside `i1040gi` rather than as a standalone PDF.
**Plans**: TBD

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
**Plans**: TBD

### Phase 12: Brokerage Documents and the Capital-Gain Chain
**Milestone**: Week 3 — Breadth in Documents
**Goal**: The brokerage half of the profile computes correctly — and the dialects land together with the worksheets they force, not before them.
**Depends on**: Phase 10 — **runs concurrently with Phase 11**
**Requirements**: DOC-06, DOC-07, DOC-13, TAX-07, TAX-08, TAX-11, TAX-15
**Tier**: T2
**Success Criteria** (what must be TRUE):
  1. `vnd.fjs.1099div` and the QDCGT worksheet ship **in the same phase**: a box 1b > 0 case matches the printed worksheet line by line, including its call **back into the Tax Table** for the ordinary-income component.
  2. A boxes 2b/2d case routes through Form 8949 → Schedule D → the **Schedule D Tax Worksheet** and matches line by line.
  3. `vnd.fjs.1099b` distinguishes a blank box 1e — "basis not reported" — from zero, proven by a case where treating it as zero changes the gain.
  4. One consolidated brokerage PDF yields *N* typed documents with *N* subjects, each recording the same artifact hash as provenance. One uploaded file is not one document.
  5. Schedule B applies the $1,500 threshold and the foreign-account questions; each worksheet is one named pure function carrying the printed form's line numbers, in IRS order.
**Research**: **YES** — the QDCGT and Schedule D Tax Worksheets, and phase-out cliff behaviour.
**Plans**: TBD

### Phase 13: The 65+ Profile and the Remaining Schedules
**Milestone**: Week 3 — Breadth in Documents
**Goal**: The declared taxpayer profile is structurally complete — a 65+ TY2025 return with dependents that itemizes is no longer missing anything it is required to have.
**Depends on**: Phase 11, Phase 12
**Requirements**: TAX-09, TAX-10, TAX-12, TAX-13, TAX-14
**Tier**: T2
**Success Criteria** (what must be TRUE):
  1. Schedule 1-A Parts I/V/VI compute the senior deduction with the 6% phase-out over $75k/$150k, feeding Form 1040 line 13b — a 65+ TY2025 return without it is structurally wrong, not merely incomplete.
  2. The 19-line Social Security Benefits Worksheet matches the printed worksheet on a case that exercises its near-circular dependency.
  3. Schedule A computes and is **compared against** the standard deduction, with proofs in both directions — itemizing does not automatically win above $15,750 / $31,500.
  4. Schedule 8812 computes for the declared dependents, and Schedules 1, 2, and 3 carry every line the profile actually reaches.
  5. `grep -rn "magi" fjs/` returns nothing — each rule's MAGI is a separately named function stating its own add-back list, because the IRA deduction, Roth eligibility, the Premium Tax Credit, IRMAA, and the student-loan-interest deduction do not share one.
**Research**: **YES** — MAGI add-back lists per rule, phase-out cliff mechanics, and Schedule 1-A limitation mechanics.
**Plans**: TBD

**── Milestone: Week 4 — The Full Path Works on the User's Own Documents ──**

### Phase 14: Acceptance — Reproducible, Cited, End-to-End
**Milestone**: Week 4 — The Full Path Works on the User's Own Documents
**Goal**: All four of PROJECT.md's success criteria hold simultaneously against the user's own filed return, verified adversarially rather than optimistically.
**Depends on**: Phase 13
**Requirements**: EXEC-13, PROV-04, PROV-05
**Tier**: T2
**Success Criteria** (what must be TRUE):
  1. Upload → vision → store → ask "what do I owe for 2025?" → program authored, stored, run → answer with citing hashes, in one Claude Code / Claude Desktop session touching no code.
  2. **Every line** of the user's filed TY2025 return matches — line by line, not just totals.
  3. Adding an amended revision to a subject **between** two runs of a pinned program leaves the output byte-identical. A reproducibility check that passes only because nothing changed is not a check.
  4. Run records carry `pinned: true|false`; an unpinned run is marked as such and does not count toward acceptance.
  5. Report output states the tax year, the parameter-set hash, and the program hash alongside the figures, framed as a reviewed estimate to check against the source documents before filing.
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
**Plans**: TBD

---

## Progress

**Execution Order:** Phases execute in numeric order, with the concurrency sets in
"Parallelism" above run together: 1 ∥ 2 → 3 ∥ (4 → 5) → 6 → 7 → 8 ∥ 9 → 10 → 11 ∥ 12 → 13 → 14 → 15

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Planning-Document Corrections | Week 0 | 3/3 | Complete | verified 11/11 |
| 2. Server Skeleton and Registration | Week 0 | 3/3 | Complete | verified 11/11 |
| 3. The Restricted Interpreter | Week 1 | 2/2 | Complete | verified 11/11 |
| 4. Exact Arithmetic | Week 1 | 2/2 | Complete | verified 10/10 |
| 5. Document Base and First Dialects | Week 1 | 0/TBD | Not started | - |
| 6. Guest ABI and Materialization | Week 1 | 0/TBD | Not started | - |
| 7. `fjs_run` and Run Records | Week 1 | 0/8 | Planned | - |
| 8. TY2025 Parameters and Tax Table | Week 2 | 0/TBD | Not started | - |
| 9. Traceable Report Lines | Week 2 | 0/TBD | Not started | - |
| 10. 1040 Core and Scope Guard | Week 2 | 0/TBD | Not started | - |
| 11. Wage, Retirement, Benefit Documents | Week 3 | 0/TBD | Not started | - |
| 12. Brokerage and Capital-Gain Chain | Week 3 | 0/TBD | Not started | - |
| 13. The 65+ Profile and Schedules | Week 3 | 0/TBD | Not started | - |
| 14. Acceptance | Week 4 | 0/TBD | Not started | - |
| 15. Realism Polish and Upstream | Week 5 | 0/TBD | Not started | - |

---

## Coverage

| Category | Count | Phases |
|---|---|---|
| DOCC (documentation corrections) | 7 | 1 |
| MCP (server and tools) | 9 | 2, 7, 8, 11, 15 |
| EXEC (execution spine) | 13 | 3, 6, 7, 14 |
| DOC (formats and ingestion) | 17 | 2, 5, 11, 12, 15 |
| EXACT (exact arithmetic) | 5 | 4 |
| TAX (tax computation) | 17 | 8, 10, 12, 13, 15 |
| PROV (provenance and reporting) | 8 | 7, 9, 14, 15 |
| SEC (security) | 4 | 1, 2, 6 |
| **Total** | **79** | **15 phases** |

**All 79 v1 requirements map to exactly one phase. No orphans. No duplicates.**
Verified mechanically against REQUIREMENTS.md; full mapping is in that file's Traceability table.

---
*Roadmap created 2026-08-03 from PROJECT.md, REQUIREMENTS.md, todo/plan.md,
fjs/todo/implement-mcp-server.md, and the research corpus. Milestones are `todo/plan.md`'s
weeks and keep its names; Week 0 is research's addition.*
