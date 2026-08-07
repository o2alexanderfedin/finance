# Phase 11: Wage, Retirement, and Benefit Documents - Context

**Gathered:** 2026-08-07
**Status:** Ready for planning

<domain>
## Phase Boundary

Every non-brokerage document the declared profile produces can be **stored, listed, and
retracted**.

Concretely, this phase delivers four things and nothing else:

1. `vnd.fjs.ssa1099` — a new dialect (DOC-08).
2. `vnd.fjs.1099r` — a new dialect (DOC-09).
3. `finance_documents_list` — a new MCP tool (MCP-08).
4. The retraction story (DOC-15): a wrongly ingested document can be marked `archived`, and
   the decision on whether report programs filter archived revisions is **recorded and
   enforced by a `proof`**.

**Explicitly NOT in this phase:**

- Any *computation* over the new dialects. 1099-R feeds Phase 13 (TAX-09/TAX-10, the
  taxable-amount and Social Security Benefits Worksheet work); SSA-1099 likewise. This
  phase stores and reads. It does not compute, and it does not touch `fjs/return/` or
  `fjs/tax/`.
- Brokerage documents. `vnd.fjs.1099div` / `vnd.fjs.1099b` are Phase 12, which runs
  concurrently with this one.
- `from_ocr` converters for the new dialects (see Decision 4.4).
- RRB-1099 (railroad retirement). Not in the declared profile — noted as deferred.

**Criterion 1 is already delivered.** `vnd.fjs.w2` shipped in Phase 5 with box 12 as a list
of `(code, amount)` pairs and boxes 15–20 as a faithful repeating array. Its surviving half
— "no computation reads boxes 15–20" — is a live constraint on the phases that compute, not
work for this phase. Do not re-implement W-2.

</domain>

<decisions>
## Implementation Decisions

### Box Coverage and Fidelity

- **1099-R models the FULL printed box list**, not an MVP subset. Success criterion 2 names
  the PDF as the source of truth ("read from the current IRS PDF rather than from recall"),
  and Phase 13 reads these boxes for the taxable-amount work. `vnd.fjs.1099int`'s
  documented subset precedent is deliberately NOT followed here: a subset would force
  reopening the file in Phase 13, which is the cost DOC-00's base/spread design exists to
  let us avoid but not a cost worth paying twice.
- **1099-R state and local boxes are a repeating array, faithfully stored and never
  computed on** — mirroring `vnd.fjs.w2`'s boxes 15–20 exactly (Phase 05-05, user-directed).
  A payer can report more than one state on one form; fixed slot fields cannot express that,
  and the slot carries no meaning.
- **1099-R box 7 is a LIST of distribution codes plus a SEPARATE IRA/SEP/SIMPLE checkbox.**
  The printed box can carry two codes, and the checkbox beside it is a distinct datum. This
  is the W-2 box-12 lesson applied verbatim: the slot carries no meaning, the code does, and
  a code can legitimately repeat.
- **SSA-1099's "Description of Amount in Box 3" (and the Box 4 equivalent) are stored as
  optional free text, never computed on.** They are printed on the form, and Phase 13 may
  need them to explain a figure to the taxpayer. Storing them costs nothing; re-deriving
  them later is impossible.

### The Retraction Decision (DOC-15)

This is the decision DOC-15 asks to be **recorded**, and success criterion 4 asks to be
**enforced by a `proof`**. It is the load-bearing decision of the phase.

- **Report programs see ACTIVE revisions only, by construction.** Archived revisions are
  invisible to a report program; the guest cannot silently include them. This is consistent
  with two things that already exist and were not invented here:
  - upstream `evo_list`'s own convention — active is the default, `archived: true` opts in;
  - `fjs/server/fjs_run/snapshot`'s existing `activeSubjects` / `archivedSubjects` split.

  The rejected alternatives, and why: *"programs see everything and filter themselves"* puts
  the retraction guarantee in guest code we do not control, which makes it not a guarantee.
  *"a report refuses loudly when a head is archived"* conflates retraction with the scope
  guard — archiving a superseded W-2 is a normal correction, not an out-of-scope input, and
  refusing the whole return for it would make the feature unusable.

- **Archiving is a NEW head revision flagged `archived: true` — append-only, never a
  mutation.** CAS has no delete; that is a documented accepted risk in REQUIREMENTS.md, and
  retraction has to live inside it rather than pretend otherwise. The bytes of the retracted
  document remain in the store. `archived` means "no longer current", never "gone".

- **No new MCP tool for archiving.** Upstream `evo_add` already takes the revision shape and
  is already registered in the composed registry. MCP-08 names exactly one new tool
  (`finance_documents_list`); a `finance_document_archive` convenience wrapper is scope
  growth. Document the exact `evo_add` call that retracts a document instead — the
  "documented answer to 'I uploaded the wrong document'" that criterion 4 requires is
  **documentation plus a proof**, not necessarily a new tool.

- **Un-archive / restore is DEFERRED.** Append-only means restoring is just another revision
  without the flag. Record that it works this way; do not build a path for it.

### `finance_documents_list` (MCP-08)

- **Returns a JSON array of `{ subject, dialect, taxYear, hash }`.** The criterion names
  dialect, tax year, and subject; the head hash is added because without it the agent has
  enumerated documents it cannot then read.
- **Active by default; `archived: true` opts in** — mirroring `evo_list`'s documented
  convention rather than inventing a second one.
- **No dialect or tax-year filter arguments.** YAGNI: the response is a JSON array and the
  agent can filter it. Filters can be added non-breakingly later if a real need appears.
- **A document whose head is NOT one of the known finance dialects is still listed, carrying
  its actual dialect tag.** A document that cannot be listed is exactly how "I uploaded the
  wrong thing" stays invisible — which would defeat the phase's own retraction story. Only
  non-revision blobs are skipped.

### Research Sourcing and Proof Strategy

- **Box lists are transcribed from the current PDFs, box by box, recording the revision
  string printed on the form** (DOC-10: box semantics drift between revisions, so the
  revision travels with the instance and is never derived from the tax year). No IRS PDFs
  are vendored in this repository today.
- **SSA-1099 is NOT an IRS form and must not be sourced as though it were.** It is issued by
  the Social Security Administration; there is no `irs.gov/pub/irs-pdf/` blank for it the way
  there is for 1099-R. Source it from IRS Pub 915 and/or ssa.gov, and **say which, with the
  URL, in the module docstring.** Assuming symmetry with 1099-R is precisely how this phase's
  central discipline ("from the PDF, not from recall") fails silently.
- **Absent-ability is proven from the schema itself, plus an independently hand-typed
  expected box count** — the `fjs/document/w2` / Phase 09-08 `moneyBoxFields` idiom. Generating
  from the schema means a box added later is covered automatically; the hand-typed count means
  a box *removed* is still caught. Neither alone is sufficient.
- **No `from_ocr` converters for the new dialects.** `fjs/document/1099int/from_ocr` is already
  orphaned — unwired into the server, and booked as Phase 16, "The Orphan Ingestion Island".
  Adding two more orphans grows the island that phase exists to resolve.

### Claude's Discretion

All four grey areas were accepted as recommended; no answers were delegated back. Within
those decisions, the following remain open to the planner and executor:

- Exact field naming within each dialect (follow `vnd.fjs.1099int` / `vnd.fjs.w2` conventions).
- Plan/wave decomposition.
- Whether `finance_documents_list` reads through the Evo cache or a CAS scan — prefer the
  Evo cache for consistency with `evo_list`, but the planner may justify otherwise.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets

- `fjs/document/base/module.f.js` — `base(dialect)` spreads the dialect discriminant first,
  and `mediaTypeOf(dialect)` derives `application/<dialect>+json`. Both new dialects use it.
- `fjs/document/money_field/module.f.js` — `moneyFieldError`, the shared per-box exact-decimal
  semantic check. Both new dialects use it for every money box.
- `fjs/document/subject/module.f.js` — subject derivation keyed on
  `(payerTin, recipientTin, accountNumber, taxYear, formType)`.
- `fjs/document/1099int/module.f.js` — **the template to follow.** Four-stage
  `fjs/media/revision` pattern: dialect → mediaType → schema → structural `validate` →
  semantic `checkReferences` → composed `validate`.
- `fjs/document/w2/module.f.js` — the precedent for a repeating array (boxes 15–20) and for
  a `(code, amount)` pair list (box 12). 1099-R needs both shapes.
- `fjs/server/fjs_run/snapshot/module.f.js` — already carries `activeSubjects` /
  `archivedSubjects` and an `evoList` guest command whose `'true'` argument selects archived.
  The retraction decision is consistent with this and should reuse it, not parallel it.

### Established Patterns

- **Every box is `option(...)`** — DOC-11, blank is not zero. A `"0"` standing in for "not
  printed" is a defect.
- **`corrected: option(true)`** — DOC-12; `corrected: false` is rejected *structurally*.
  Absence is the only way to say "not corrected". Same shape as upstream's `archived`.
- **Conditional spread discipline** — `...(x === undefined ? {} : { k: x })`. A plain
  `...{ k: possiblyUndefined }` passes `tsc` cleanly under `exactOptionalPropertyTypes` and is
  caught only at runtime. This bit Phase 5 and the compiler will not warn.
- **Money is a decimal `string` in stored JSON, never a JSON number.** Absolute rule.
- **`Ts<typeof schema>`** derives the TypeScript type; the type is declared nowhere twice.
- **Proofs are `export const proof = {...}`**, discovered only through root `all.test.js`.

### Integration Points

- `fjs/server/finance_schema/module.f.js` — `dialectSchemas` registers 5 dialects today and
  must register 7. It carries a **deliberately hand-typed count constant** (NOT
  `knownDialects.length`) with a docstring explaining that a newly registered dialect is *not*
  covered for free. That constant must be bumped, and its proof re-read rather than assumed.
- `fjs/server/module.f.js` — `financeMcpHandlers` composes the registry; `finance_documents_list`
  is added there, alongside `financeSchemaTool` / `financeTaxParamsTool` / `fjsRunTool`.
- `fjs-run-integration.test.js` — derives advertised/called tool sets from a live `tools/list`
  response at runtime. Per Phase 08-04's ordering note, a registry-only commit breaks
  `npm test` immediately: the registry entry and the integration-test update must land in the
  **same commit**.

</code_context>

<specifics>
## Specific Ideas

- The SSA-1099 sourcing asymmetry (Area 4, Q2) is the specific trap flagged for this phase.
  The module docstring must name the actual source document and URL, so a later reader can
  check it rather than trust it.
- Three claims elsewhere in this project remain unverified against paper (the 1040 face's
  56-line inventory, the 19 chart amounts, and research assumption A2). This phase must not
  add a fourth: the box lists are verified against the source at research time and the source
  is recorded.

</specifics>

<deferred>
## Deferred Ideas

- **Un-archive / restore** — append-only makes it a revision without the flag; recorded, not built.
- **`from_ocr` converters** for `vnd.fjs.ssa1099` and `vnd.fjs.1099r` — would grow the Phase 16
  "Orphan Ingestion Island".
- **RRB-1099** (railroad retirement, the SSA-1099 analogue) — not in the declared taxpayer profile.
- **Dialect / tax-year filter arguments on `finance_documents_list`** — YAGNI; addable non-breakingly.
- **`finance_document_archive` convenience tool** — `evo_add` already does it; MCP-08 names one tool.
- Two known documentation errors, to fix during this phase's or Phase 13's planning:
  `REQUIREMENTS.md` TAX-10 says the Social Security Benefits Worksheet is 19 lines (it is **18**),
  and `ROADMAP.md` constraint 4 names 1099-DIV boxes 2b/2d as forcing Schedule D where i1040gi p31
  Exception 1 names **2b, 2c and 2d**. Both also appear in `CHANGELOG.md`'s "Known documentation
  defects", so each fix touches two files.

</deferred>
