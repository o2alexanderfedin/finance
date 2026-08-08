# Phase 12: Brokerage Documents - Context

**Gathered:** 2026-08-07
**Status:** Ready for planning

<domain>
## Phase Boundary

Every brokerage document the declared profile produces can be **stored and read**, and the
dividend half of the capital-gain story reaches the worksheet that **already exists**.

Four things, and nothing else:

1. `vnd.fjs.1099div` — a new dialect (DOC-06).
2. `vnd.fjs.1099b` — a new dialect, including the blank-box-1e distinction (DOC-07).
3. The consolidated-1099 document model: one PDF yields *N* typed documents with *N* subjects
   sharing one artifact hash as provenance (DOC-13).
4. Schedule B — the $1,500 threshold and the foreign-account questions (TAX-07).

**Explicitly NOT in this phase — it is Phase 12.1:**

- Form 8949, Schedule D, and the Schedule D Tax Worksheet.
- Replacing `dispatchLine16`'s `scheduleDTaxWorksheet` refusal. That branch keeps refusing until
  12.1 lands, and that is correct: a boxes-2b/2c/2d return is genuinely unmodeled until the chain
  exists, and TAX-16's scope guard exists to say so loudly rather than compute something wrong.

## AMENDED 2026-08-07, after research — criterion 1 was self-contradictory

Research found, and the orchestrator verified against source, that this document as first written
could not be satisfied. Recorded rather than quietly corrected:

- `fjs/return/scope/module.f.js:135-136` classifies `qualifiedDividends` and `ordinaryDividends` as
  **unmodeled**, refusing any return that declares them — with remedy text pointing at "Phase 12".
- `fjs/form1040/core/module.f.js:386-387` sets lines 3a/3b to `declaredZero`, and `:755` hardcodes
  `qualifiedDividendsCents: 0n` at the `dispatchLine16` call site.

So "a box 1b > 0 case **reaches** the QDCGT worksheet" required editing `fjs/return/` — which this
same document forbids two sections below. The error is in the criterion, not in the code: *reaching*
a worksheet is computation, and this phase's own declared boundary is "stores and reads."

**Resolution — all wiring moves to Phase 12.1**, which is the split the phase owner already chose
(12 = documents, 12.1 = chain):

- **Phase 12 (here):** `vnd.fjs.1099div` stores the full box list including 1b, and a proof
  demonstrates the stored value has exactly the shape `qdcgt` consumes. **No wiring.** The scope
  guard goes on refusing declared dividends, which is CORRECT until the wiring exists — Phase 10's
  own docstring says it: *"an engine that can compute a worksheet is not thereby an engine that can
  read the form feeding it."*
- **Phase 12.1:** reclassify `qualifiedDividends`/`ordinaryDividends` as modeled (the paired edit
  `fjs/return/scope` explicitly demands — growing the modeled list must be paired with a deletion
  from `unmodeledKindRefusals`), wire lines 3a/3b, delete the hardcoded `0n`, and build the
  8949 → Schedule D → Schedule D Tax Worksheet chain.

**Why this ordering is safe and the reverse is not.** Reclassifying scope WITHOUT wiring lines 3a/3b
would produce silent-zero dividend income — a return that computes a confident, wrong number instead
of refusing. That is the precise failure TAX-16's scope guard exists to prevent, and it is worse
than the refusal it would replace.

**One exception to "do not touch `fjs/return/`", deliberately granted:** Schedule B (TAX-07) needs
taxpayer-declared foreign-account answers, and research confirmed those fields do **not** yet exist
on `vnd.fjs.return_profile`. Adding them is an ADDITIVE dialect change — modeling what the taxpayer
declares, which is document work. It must NOT touch the modeled/unmodeled partition in
`fjs/return/scope/module.f.js`. That partition is Phase 12.1's to change, atomically, with its
paired deletion.

---

**TAX-08 IS ALREADY DELIVERED. DO NOT REBUILD IT.**

`fjs/tax/line16/qdcgt/module.f.js` is a complete 634-line Qualified Dividends and Capital Gain Tax
Worksheet, shipped in Phase 10. It already imports `baseTaxForAmount` from `fjs/tax/table` and its
proofs already assert `method22 === 'taxTable'`. The original roadmap text scheduled building it in
this phase; that text was stale and has been corrected. This phase's job is to make
`vnd.fjs.1099div` **reach** it, and to verify the path end to end — not to write a second one.

</domain>

<decisions>
## Implementation Decisions

### What Phase 10 already delivered
*(orchestrator recommendations, presented to the phase owner alongside the split decision and not
overridden)*

- **TAX-08 is verified and closed, never rebuilt.** Already marked complete in `REQUIREMENTS.md`
  with the evidence recorded.
- **The violated "ship the worksheet WITH the dialect" constraint is recorded, not silently
  dropped.** QDCGT shipped in Phase 10 without `vnd.fjs.1099div`. The constraint existed to prevent
  the *opposite* failure — a dialect whose forcing worksheet does not exist — so what actually
  happened is the harmless ordering. The ROADMAP sentence has been corrected rather than left to
  mislead the next reader.
- **Box 1b flows through the EXISTING dispatch.** `dispatchLine16` already selects `qdcgt` when
  qualified dividends exceed zero; `vnd.fjs.1099div` populates that input. Do not add a second
  selection path — the four-way dispatch and its per-branch proofs are Phase 10's verified work.
- **Both new dialects model the FULL printed box list**, following Phase 11's 1099-R precedent
  rather than 1099-INT's documented MVP subset. Phase 12.1 and Phase 13 both read these boxes; a
  subset would force reopening.

### The documents

- **A blank box 1e is modeled by ABSENCE** (`option(string)`), per DOC-11 — never a sentinel, never
  a zero. "Basis not reported" and "basis reported as zero" are different facts and a real return
  can contain either.
- **Criterion 2 requires a proof where treating a blank box 1e as zero CHANGES THE GAIN.** A proof
  that merely shows the field is optional does not discharge DOC-07 — the requirement names the
  consequence, so the proof must exhibit the consequence.
- **DOC-13 is modeling and subject derivation ONLY.** N subjects, each recording the same artifact
  hash as provenance. No new ingestion wiring: `fjs/document/1099int/from_ocr` is already orphaned
  and booked as Phase 16, "The Orphan Ingestion Island". Adding an ingestion path here grows the
  island that phase exists to resolve.
- **Schedule B's foreign-account answers are taxpayer-DECLARED, never inferred.** They live on
  `vnd.fjs.return_profile` (the Phase 10 dialect for what the taxpayer asserts), not on any
  transcribed document. No IRS information return reports "do you have a foreign account" — deriving
  it from documents would be inference, and this project stores and reads.

### Standing constraints inherited from earlier phases

- Every box `option(...)` (DOC-11); `corrected: option(true)` with no `false` member (DOC-12).
- `formRevision` REQUIRED and NEVER derived from `taxYear` (DOC-10). Phase 11 found the "Created
  MM/DD/YY" string is often Copy-A-only; record the real source in the docstring, do not encode a
  derivation.
- Money is a decimal `string` in stored JSON, never a JSON number.
- Conditional spread discipline: `...(x === undefined ? {} : { k: x })`. The plain form typechecks
  cleanly under `exactOptionalPropertyTypes` and fails only at runtime.
- Generated proofs paired with an **independently hand-typed** expected count. Generation alone
  misses a box removed; a hand count alone misses a box added.
- `finance_schema`'s `dialectSchemas` must grow 7 → 9 **atomically**: register, bump the hand-typed
  `expectedKnownDialectCount`, and add a `*Resolves` leaf per dialect. Two of the three ships a
  false green — that file's own docstring says so.
- No new dependencies. No `any`, no cast over an indexed access, no non-null assertions.
- This phase STORES AND READS. It does not compute a return. It must not touch `fjs/return/`, and
  it touches `fjs/tax/` only to verify the existing QDCGT path, never to modify it.

### Claude's Discretion

- Exact field naming within each dialect (follow `1099r`/`1099int` conventions).
- Plan and wave decomposition.
- Whether Schedule B lives under `fjs/tax/` or a new `fjs/schedule/` root — the planner should
  follow whatever the existing layout most naturally extends.

</decisions>

<code_context>
## Existing Code Insights

### Reusable assets
- `fjs/document/1099r/module.f.js` — **the closest analog**, and the most recent. Carries both a
  repeating group and a code list, and its docstring shows the source-URL discipline this project
  now expects.
- `fjs/document/base/`, `money_field/`, `subject/`, `ocr_amount/` — unchanged, reused verbatim.
- `fjs/tax/line16/qdcgt/module.f.js` — **already exists.** Read it; do not write another.
- `fjs/tax/line16/module.f.js` — the four-way dispatch. `scheduleDTaxWorksheet` refuses at lines
  ~271 and ~288; that refusal is Phase 12.1's to replace, not this phase's.
- `fjs/server/finance_documents_list/module.f.js` — Phase 11's tool; the new dialects appear in its
  output for free once registered, which is worth a proof.

### Established patterns
- The six-stage dialect template: dialect → mediaType → `base(dialect)`-spread schema → structural
  `validateShape` → semantic `checkReferences` → composed `validate`.
- Proofs are `export const proof = {...}`, discovered ONLY through root `all.test.js`.
  `node --test <file>` is a documented FAKE PASS.

### Integration points
- `fjs/server/finance_schema/module.f.js` — the atomic three-part registration described above.
- `fjs-run-integration.test.js` — derives the advertised tool set from a live `tools/list` at
  runtime. No new tool is planned in this phase, so no same-commit constraint applies unless one is
  added.

</code_context>

<specifics>
## Specific Ideas

- **1099-B box numbering is a known drift risk**, the same class of problem Phase 11 found on
  1099-R (where boxes 7c/7d exist only on the 2026 revision). Research must fetch the actual PDFs
  for the relevant revision(s) and record the exact URLs, as Phase 11 did.
- The project carries three claims never verified against paper. Phase 11 deliberately avoided
  adding a fourth. Phase 12 must do the same: every box list names the document and URL it came
  from, and an honest "COULD NOT FETCH — unverified" beats a confident list with no provenance.

</specifics>

<deferred>
## Deferred Ideas

- **Form 8949, Schedule D, the Schedule D Tax Worksheet, and the `scheduleDTaxWorksheet` refusal
  replacement** — Phase 12.1, deliberately split out on 2026-08-07.
- **`from_ocr` converters** for the new dialects — would grow Phase 16's orphan island.
- **Ingestion wiring for consolidated PDFs** — DOC-13 is modeled here; wiring is Phase 16.
- Two known documentation errors still open: `REQUIREMENTS.md` TAX-10's worksheet line count (says
  19, is 18) and `ROADMAP.md` constraint 4's 1099-DIV boxes (says 2b/2d, i1040gi p31 Exception 1
  says 2b, 2c AND 2d). Both also appear in `CHANGELOG.md`. **Constraint 4's error is directly
  relevant to Phase 12.1's criterion 1**, which is why that criterion already says 2b/2c/2d — fix
  the source text during 12.1 planning.

</deferred>
