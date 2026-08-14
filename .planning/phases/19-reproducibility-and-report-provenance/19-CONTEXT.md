# Phase 19: Reproducibility and Report Provenance - Context

**Gathered:** 2026-08-12
**Status:** Ready for planning

<domain>
## Phase Boundary

A report says **which tax year, which parameters and which program** produced it, and a pinned
program run twice over a store that changed underneath it produces **byte-identical** output.

This phase carries the three requirements — **EXEC-13, PROV-04, PROV-05** — that were stranded
when Phase 14 was skipped by owner decision on 2026-08-11. Phase 14 bundled an acceptance run
against the owner's real filed TY2025 return together with three engineering properties that
make such a run *meaningful*. **None of the three needs the taxpayer's return.** Phase 14 keeps
only its criteria 1 and 2 and stays skipped; this phase takes 3, 4 and 5.

**Explicitly out of scope:** anything requiring the owner's filed return, any line-by-line
acceptance comparison, and TaxCalcBench. Those remain Phase 14's.

</domain>

<decisions>
## Implementation Decisions

### The Provenance Header (PROV-04)

- **The header is produced host-side**, in `fjs_run`'s response envelope and its `vnd.fjs.run`
  record — **never** in the guest program's returned report object. A guest program could lie
  about its own provenance; the host knows the truth. This follows Phase 15's ruling that the
  whole-dollar election is applied host-side as an explicit caller argument and never
  re-derived from stored CAS content.
- **The parameter set is identified by a new `paramSetHash`** — a content hash over the
  canonical JSON serialization of `taxParamsByYear[taxYear]`, computed host-side. PROV-04 names
  three distinct things (tax year, parameter-set hash, program hash); collapsing the second
  into the third would make the field redundant. **See the constraint below** on not
  contradicting Phase 15's `programHash` finding.
- **`taxYear` is an explicit caller argument** on `fjs_run`, not inferred. This is the same
  ruling the owner made in Phase 15 for `elected`: inferring from stored content is only sound
  if both runs pin the same return-profile revision, which can silently be false.
- **A new module, `fjs/report/provenance/module.f.js`**, joining `line`, `audit`, `guard`,
  `amend` and `payer` under `fjs/report/`. Phase 9's precedent for a report-level mechanism.
- The "reviewed estimate — check against the source documents before filing" framing is a
  single exported constant in that module, carried in the envelope rather than duplicated in
  prose.

### EXEC-13's Remaining Scope

- **Verify and close; do not rebuild.** EXEC-13 is *already largely shipped* — see Existing
  Code Insights. The only genuine gap is the consumer-side half of the requirement's second
  sentence ("Only pinned runs count toward reproducibility acceptance"): a **named predicate**
  saying whether a given run counts toward reproducibility acceptance, consumed by PROV-05's
  proof.
- **Prove the already-shipped half with a mutation gate** rather than assuming it. A
  requirement inherited as "done" from another phase is exactly the kind of claim this project
  has repeatedly found to be false on inspection.
- **`amendmentDiff` keeps accepting unpinned runs.** Making it refuse is out of scope and would
  change Phase 15's shipped behavior. Recorded as a deferred idea.

### The Adversarial Reproduction Proof (PROV-05)

- **The decisive proof is a real-process integration test**, not a virtual proof. TEST-03's
  standing rule, reinforced by 15-03's lesson: a virtual proof could not exercise the composed
  export and shipped **vacuous** — green and permanently unable to fail — because of it.
- **What changes between the two runs:** an amended revision is added to the **pinned subject**
  via the live `evo_add` tool, between run 1 and run 2. This is the requirement's own wording,
  and it is the whole point — a reproducibility check that passes only because nothing changed
  is not a check.
- **"Byte-identical" is checked two ways:** `resultHash` string equality **and** the actual
  bytes of the result blob fetched back from CAS. Hash equality alone is close to a
  content-addressing tautology.
- **A mutation gate is required before this phase can close:** make run 2 read the live head
  instead of the pinned parents, watch the integration test go red, then restore byte-identical.

### Claude's Discretion

- Naming of the acceptance predicate, the exact canonical-JSON serialization strategy for
  `paramSetHash`, envelope field names, and plan/wave decomposition.

</decisions>

<code_context>
## Existing Code Insights

Measured 2026-08-12 against `develop` @ `654b8f1`, before any planning.

### EXEC-13 is already implemented — confirm before building

`fjs/run/module.f.js` (the `vnd.fjs.run` dialect) already declares `pinned: boolean` as a
**required** field (line 108) and enforces the both-or-neither invariant in `checkReferences`
(lines 160-165): a pinned record must have both `subject` and `parents`; an unpinned record must
have neither. Four proof leaves already cover the rejection cases
(`unpinnedWithSubjectRejected`, `unpinnedWithParentsRejected`, `pinnedWithoutSubjectRejected`,
`pinnedWithoutParentsRejected`) plus `pinnedWithBothAccepted`.

`fjs/server/fjs_run/module.f.js` already threads it end to end: the tool's arg schema carries
`subject: option(string)` / `parents: option(array(string))` (lines 416-417); `pinned` is derived
as `args.subject !== undefined && args.parents !== undefined` (line 441); `pinFields` is `{}` when
unpinned (lines 448-449); and `handleRunOutcome` writes `pinned` into the record on both the `ok`
and `error` arms (lines 364, 395).

`fjs/server/fjs_run/snapshot/module.f.js` resolves pinned-vs-live heads (`buildRunSnapshot`,
lines 147-168) and already has a proof contrasting a pinned snapshot against a live one
(lines 502-504).

**The planner must check what is already true before writing tasks to add it.** ROADMAP
criterion 1 says so explicitly.

### PROV-04 is genuinely absent

Nothing under `fjs/report/` carries `taxYear` or any parameter-set hash. The only `programHash`
uses are in `fjs/report/amend/` (Phase 15's diff), where it is a comparability guard, not a
reported field. `fjs_run`'s response envelope is currently the six keys
`{ resultHash, runHash, preview, truncated, readCount, literalCount }`
(`fjs/server/fjs_run/module.f.js:424-425`).

### Reusable Assets

- `fjs/report/line` — `ReportLine`, whose `sources` is a non-empty **tuple** type, so a line
  cannot exist without provenance. The type-level precedent for this phase.
- `fjs/report/guard` — `classifyRunOutcome`, `RunOutcome`. Where the acceptance predicate most
  plausibly belongs beside.
- `fjs/report/amend` — Phase 15's diff, including the `programHash` comparability refusal.
- `fjs/form1040/core` — `form1040Report = taxParamSet => inputs => …` (line 1549). The engine
  already receives the parameter set, which is what `paramSetHash` must hash.
- `fjs-run-integration.test.js` — the real-process harness. Spawns the server, speaks NDJSON
  JSON-RPC, and already seeds CAS through the live `cas_add` tool. **Copy its spawn-and-speak
  pattern**; `cas-refresh-cross-process.test.js` has the second-process variant.

### Established Patterns

- Money is `bigint` cents; a stored JSON document's money is a decimal **string**, never a
  number.
- Pure `.f.js` modules with a co-located `export const proof`, discovered by `all.test.js`.
  **`node --test <source-file>` reports a FAKE PASS** — only ever trust `npm test` or
  `node --test all.test.js`.
- Every new dialect/registry addition and its `finance_schema` registration land in **one
  commit** — Phase 8's 08-VALIDATION ordering note, re-confirmed in 11-04 and 12-05.
- A mutation that fails to **compile** proves nothing: `npm test` is `tsc && node --test`.

### Integration Points

- `fjs/server/module.f.js:216-225` — `financeMcpHandlers`. Note this spreads
  `casToolRegistry`/`evoToolRegistry`, so the live tool surface is **13 tools**, not what a grep
  for local `toolEntry(` finds. If this phase changes the advertised surface, **start the server
  and ask it** rather than counting declarations.
- `fjs/server/fjs_run/module.f.js` — the envelope PROV-04's header joins.
- `fjs-run-integration.test.js` — derives advertised/called tool sets from a live `tools/list`
  at runtime, so a registry change and its integration-test call must land together.

</code_context>

<specifics>
## Specific Ideas

- **ROADMAP criterion 4 is a hard constraint on Q2's `paramSetHash`.** Phase 15 established
  that `programHash` equality *already* implies parameter-set equality, because guest programs
  cannot import and therefore bake every parameter in as a literal. `paramSetHash` must not
  contradict or silently duplicate that. The honest framing: `programHash` covers the
  **guest-program** path, where parameters are literals; `paramSetHash` names the parameter set
  the **host engine** was handed. If the planner cannot state that distinction crisply in the
  module docstring, that is a signal to re-open Q2 rather than ship a redundant field.

- **The two vacuous proofs Phase 15 shipped are the failure mode to design against here.**
  PROV-05's whole value is a proof that *can* fail. Its mutation gate is not optional
  paperwork — it is the only evidence the proof works.

</specifics>

<deferred>
## Deferred Ideas

- **`amendmentDiff` refusing unpinned runs.** Arguably a diff of two unpinned runs is not
  meaningful, but changing it now would alter Phase 15's shipped, verified behavior for a
  benefit this phase does not need. Revisit if a real caller is misled.
- **A `pinned`-aware filter on `finance_documents_list`.** Not required by any requirement.
- **Wiring `paramSetHash` into `amendmentDiff`'s comparability guard.** Phase 15 deliberately
  chose `programHash` alone and documented why; revisiting belongs with that decision, not here.

</deferred>
