# Phase 15: Realism Polish and Upstream - Context

**Gathered:** 2026-08-11
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous) — 16 decisions across 4 areas, all accepted as proposed

<domain>
## Phase Boundary

The claims that "reports are programs" and "amendments are a diff" stop being assertions and
become demonstrations, and what stabilised locally goes upstream.

Five deliverables, one per ROADMAP success criterion:

1. **PROV-08** — a second, genuinely non-tax report over the same documents, no engine change.
2. **PROV-06** — Form 1040-X Columns A/B/C produced mechanically from a diff of two stored reports.
3. **TAX-17** — multi-year support, including the prior-year capital loss carryover that the
   brokerage profile promotes from optional to required.
4. **MCP-09** — `fjs_check(hash)` smoke-checks a stored program without running it, documented
   as having **zero** security value.
5. **DOC-16** — `fjs/media`'s `detect` recognises our dialects through the dialect registry,
   as a list of decoders that falls through when none match, not local glue.

**Out of scope:** Phase 14's acceptance run (skipped by owner decision — see STATE.md's
"CARRIED, NOW UNOWNED" block). Phase 15's ROADMAP entry declares `Depends on: Phase 14`; that
dependency is waived by decision, not satisfied.

</domain>

<decisions>
## Implementation Decisions

### The Second, Non-Tax Report (PROV-08)

- **What it computes: an income-by-payer summary** — money received per payer, aggregated across
  all stored documents. It consults zero tax parameters and produces no 1040 line. A provenance
  or document-inventory report was rejected as too meta to prove the point: the criterion exists
  to show this is not "a tax engine wearing a disguise", and a report *about* the store does not
  demonstrate that the way a report about the taxpayer's money does.
- **It runs through the real `fjs_run` path** — authored as a guest program, stored, executed,
  producing a run record. "With no engine change" is the criterion; calling the module directly
  from a proof would not test the claim.
- **It reuses `ReportLine`** — PROV-01 makes a line carrying `{ value }` without `{ sources }`
  fail to typecheck, and a non-tax report earns the same traceability rather than an exemption.
- **It lives in `fjs/report/payer/`** — a sibling of `fjs/form1040`, not underneath it. Placing
  it under the 1040 tree would quietly re-assert that the report layer is 1040-shaped, which is
  the very thing this criterion denies.

### Form 1040-X From a Report Diff (PROV-06)

- **Inputs are two stored report outputs identified by run-record hash** — the amendment story
  end to end (corrected document → new revision → re-run → diff), not two in-memory values.
- **Output is a generic mechanical A/B/C per 1040 line.** PROV-06 states "No new mechanism
  required"; the demonstrable claim is the diff itself. Modelling Form 1040-X's own ~23 printed
  lines was considered and deferred — it is a second form face, which is exactly the new
  mechanism the requirement says is unnecessary.
- **Mismatched program hash or parameter set is refused loudly.** Two reports from different
  programs or different parameter sets are a different computation, not an amendment. Silently
  diffing them would produce a confident, wrong Column B.
  > **Research resolution:** this costs nothing extra and needs no new run-record field. Guest
  > programs cannot `import`, and `guestCtx` exposes no tax-parameter lookup, so every parameter
  > a stored program uses is a literal baked into its own source — **`programHash` equality
  > already implies parameter-set equality.** PROV-04's parameter-set-hash field (Phase 14,
  > waived) is therefore not a prerequisite (`15-RESEARCH.md` Pitfall 1).
- **The diff is taken over the projected lines**, after the whole-dollar election is applied, so
  that `B = C − A` holds exactly in the printed dollars a filer would copy onto the form.
  > **Research resolution:** `applyWholeDollarElection` is **not** in `guestCtx`, so a guest
  > program cannot have applied it and the stored line values are raw cents. The diff module
  > therefore applies the projection itself, host-side, and takes **`elected` as an explicit
  > caller argument** (confirmed by the phase owner 2026-08-11). Re-deriving the flag from stored
  > CAS content was rejected: it is only valid if both runs pinned the same return-profile
  > revision, an assumption that can silently be false.

### Multi-Year and Capital Loss Carryover (TAX-17)

> **REVISED 2026-08-11 after research falsified this area's central premise.** The original
> decision was sized around "the minimal TY2024 parameter subset the carryover path needs."
> `15-RESEARCH.md` fetched the IRS `i1040sd.pdf` (2025 revision, p9) and transcribed all 13
> worksheet lines: the Capital Loss Carryover Worksheet consumes **exactly four prior-year
> *result* figures and zero rate or threshold parameters.** That subset does not exist. The
> three decisions below replace the original four, confirmed by the phase owner the same day.

- **No TY2024 parameter transcription at all.** The carryover computation needs none, and
  "any year with parameters and documents computes" is proven **structurally** instead: every
  schedule/form module already takes `TaxParamSet` as an explicit argument, and
  `taxParamsByYear` / `finance_tax_params` are already open-keyed with unknown-year handled as
  an ordinary refusal. Adding hand-transcribed TY2024 figures was rejected because it would
  create a second batch of unverified IRS constants stacked on top of the Phase 13 batch that is
  already open and unowned. A synthetic fixture year was rejected because a fake year sitting in
  a shipped parameter table invites a later reader to mistake it for real.
- **The prior-year carryover arrives as a new document dialect** carrying the four figures the
  worksheet actually consumes — 2024 Form 1040 line 15, and 2024 Schedule D lines 7, 15 and 21.
  A carryover is a transcribed fact from a filed return, and documents are this engine's input;
  `vnd.fjs.return_profile` is for taxpayer *declarations* and would be the wrong home.
- **The carryover is derived, not asserted** — computed through the worksheet from those four
  figures rather than accepting a supplied carryover amount.
- **Absent document means zero; present-but-broken refuses.** A missing carryover document is a
  legitimate `0n` on Schedule D lines 6 and 14 — a first-year filer, or anyone who genuinely had
  no prior-year capital loss, has nothing to carry, and refusing there would make them unable to
  file at all. A document that *exists* but has a missing or inconsistent required field refuses,
  naming the field. This mirrors `fjs/document/1099b`, where an absent box 1e is a distinct valid
  state from a malformed one. (The original text said only "refusing when the inputs are absent",
  which read ambiguously across these two cases — `15-RESEARCH.md` Pitfall 4.)
- **The mechanical year-genericity gate must be narrowly scoped.** A literal `no bare 2025` grep
  over `fjs/` false-positives on roughly 450 lines: every module's own proof section names its
  test fixtures `taxParams2025`. The gate targets computation paths, not fixture identifiers, and
  its exact scope is to be tuned against real offending code rather than asserted up front
  (`15-RESEARCH.md` Pitfall 2).

### `fjs_check` and the Dialect Registry (MCP-09, DOC-16)

- **DOC-16 is local adoption only — no upstream contribution.** The registry DOC-16 asks for
  already exists in the pinned `functionalscript` 0.43.1: `fjs/media/module.f.js` exports
  `dialectEntry(type, extraValidate)` and `detect(dialects)(bytes)`, where "the first entry whose
  `match` accepts the parsed value wins" and unmatched blobs fall through to `detectVec`. That is
  the criterion's "list of dialect decoders that falls through when none match" verbatim.
  DOC-16's own requirement text — "it imports `decodeText`/`mediaType` from `fjs/media/revision`
  directly and performs exactly one check" — describes an older version and is **stale**;
  correcting it is part of this phase.
- **`fjs_check` imports and confirms the export shape, and never executes** — exactly MCP-09's
  wording ("without running it to completion"). A stub-effect-map dry run was rejected: it starts
  executing guest code, which is the line this tool must not cross.
- **Its zero security value is stated in three places** — the MCP tool description an agent
  actually reads, the module docstring, and the README. MCP-09 says it "must not be described as
  a security control", and one buried disclaimer is how that promise erodes.
- **`detect` is wired into the real document-classification path**, not merely registered and
  proved. Registered-but-unreachable code is precisely the defect Phase 16 exists to clean up;
  this phase must not create a second orphan island while the first is still open.

### Claude's Discretion

No areas were delegated wholesale — all 16 questions were answered. Within these decisions,
module layout, proof naming, and the exact shape of the new dialect's fields are at Claude's
discretion, following existing conventions in `fjs/document/*` and `AGENTS.md`.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets

- **`fjs/media`'s dialect registry already exists upstream** (`functionalscript` 0.43.1):
  `dialectEntry(type, extraValidate = always)` reads the dialect name out of the schema's own
  `dialect` member and derives `application/${dialect}+json`; `detect(dialects)(bytes)` returns
  `detectVec`'s `{ length, mime_type, type }` shape with dialect-tagged JSON recognised ahead of
  the `text/plain` fallback. Finance imports **none** of this today — only `isHash` and `dialect`
  from `fjs/media/revision`.
- **`taxParamsByYear`** already exists in `fjs/tax/params/module.f.js`, and
  `fjs/server/finance_tax_params` already takes a `year` argument and returns
  `TaxParamSet | undefined`, treating an unknown year as an ordinary `errorResult` rather than a
  throw. The multi-year seam is cut; it currently has one year in it.
- **`ReportLine` + `applyWholeDollarElection`** (`fjs/report/line`) give both the traced line type
  and the projection the 1040-X diff must run over.
- **`fjs/guest/materialize`** already has `loadProgram(allowed)(path)(source)` and
  `checkSpecifiers` — the import-without-running machinery `fjs_check` needs.
- **Twelve document dialects** in `fjs/document/*`, each an rtti schema with a direct string
  `dialect: 'vnd.fjs.x'` member — the exact shape `dialectEntry` requires.

### Established Patterns

- Every dialect module exports its schema plus `validate` / `checkReferences`, with proofs
  co-located in the same `module.f.js` under `export const proof`.
- Refusals are loud and named: `unmodeledKindRefusals` in `fjs/return/scope` is the model for
  "this is not modeled, and here is what to do about it".
- Mechanical gates live as root-level `*.test.js` (`magi-gate.test.js`), outside `tsc`, per
  AGENTS.md's carve-out for impure root-level files.
- Real-process integration proofs spawn `node` against an absolute path
  (`fjs-run-integration.test.js`, `cas-refresh-cross-process.test.js`) — never `npx`.

### Integration Points

- **Schedule D lines 6 and 14** are already documented zeros carrying explicit
  `multi-year, TAX-17/Phase 15` comments (`fjs/schedule/d/module.f.js` lines ~213, ~246, ~279,
  ~330). The module docstring's "No prior-year carryover" section states the seam directly.
- **`fjs/server/module.f.js`** registers the tool table (`cas_refresh`, `evo_head`, `evo_list`,
  `finance_schema`, `fjs_run`) — where `fjs_check` joins.
- **`cas_refresh` / `buildCache`** currently fold only `vnd.fjs.revision` blobs — the natural
  place for `detect` to become reachable.

</code_context>

<specifics>
## Specific Ideas

- The non-tax report's whole purpose is rhetorical: it must be obvious to a reader that no tax
  parameter was consulted. Plan it so the module imports nothing from `fjs/tax/*`, and prove that
  with a mechanical check rather than a claim.
- The 1040-X diff should be demonstrated on the amendment story the requirement describes —
  a corrected document producing a new revision — not on two unrelated reports.

</specifics>

<deferred>
## Deferred Ideas

- **Form 1040-X's own printed-line face** (~23 lines mapped from the 1040). Considered in Area 2
  and deferred as the "new mechanism" PROV-06 explicitly says is unnecessary.
- **A complete, fully cited TY2024 parameter set.** Considered in Area 3 and reduced to the
  minimal subset the carryover path needs.
- **An upstream contribution to `fjs/media`.** Retired rather than deferred — the capability
  already shipped in 0.43.1. If a genuine gap surfaces during planning, it returns as its own
  decision, and no PR is opened against another repository without the owner's approval.

</deferred>
