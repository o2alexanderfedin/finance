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
- **The diff is taken over the projected lines**, after the whole-dollar election is applied, so
  that `B = C − A` holds exactly in the printed dollars a filer would copy onto the form.

### Multi-Year and Capital Loss Carryover (TAX-17)

- **A minimal but genuinely cited TY2024 subset**, covering only what the carryover path needs —
  not a full TY2024 parameter set. Every unmodeled TY2024 area must refuse loudly, consistent
  with TAX-16's standing rule that an honest refusal beats a confident zero. A complete TY2024
  set was rejected for this phase: it is large, and it re-opens the same IRS-figure transcription
  problem Phase 13 already left open and unowned.
- **The prior-year carryover arrives as a new document dialect** carrying the prior-year
  Schedule D figures. A carryover is a transcribed fact from a filed return, and documents are
  this engine's input; `vnd.fjs.return_profile` is for taxpayer *declarations* and would be the
  wrong home for a transcribed figure.
- **The carryover is derived, not asserted** — computed through the Capital Loss Carryover
  Worksheet from the prior-year figures, refusing when the inputs are absent. Accepting an
  asserted carryover amount would let an unchecked number into the chain.
- **"Any year with parameters and documents computes" is enforced mechanically** — a gate in the
  style of `magi-gate.test.js`, asserting no bare `2025` literal survives in the computation
  modules. Phase 13's experience is that a mechanical gate is the only version of this that
  stays true; inspection does not.

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
