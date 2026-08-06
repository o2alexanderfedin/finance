# Phase 8: TY2025 Parameters and the Tax Table as Data - Context

**Gathered:** 2026-08-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Every number the engine consults becomes **data carrying its own citation**, and the IRS Tax Table
becomes the *published* table rather than something derived from bracket arithmetic.

**In scope:** the TY2025 parameter set (standard deduction incl. aged/blind additional amounts,
ordinary rate brackets for all five statuses, capital-gains breakpoints, the Tax Table's band
structure), the Tax Table itself as row data with a row-by-row proof against the published source,
cent-level boundary proofs at every threshold, and the `finance_tax_params` MCP tool that hands the
parameter set to an agent so it reads parameters instead of recalling them.

**Out of scope:** applying any of it. The Tax Computation Worksheet ($100,000+), the QDCGT and
Schedule D worksheets, Schedule 1-A's senior deduction, MAGI add-backs, and any use of a parameter
to compute a 1040 line all belong to Phases 10-13. This phase stores and serves; it does not
compute a return.

**The specific failure this phase exists to prevent:** the model recalling a tax figure instead of
reading it, and bracket arithmetic being substituted for a table lookup. MFJ taxable income of
$18,000 is **$1,803** by the table and **$1,800** by brackets — the second is the exact mistake the
training data teaches, and criterion 3 exists to catch it.

</domain>

<decisions>
## Implementation Decisions

### Parameter Data — Shape, Home, and Citations

- **Citations are per-parameter**, each an object carrying `revProc`, `section`, and
  `effectiveDate` — never one document-level citation string. Research established the reason:
  "Rev. Proc. 2024-40 **as modified by** Rev. Proc. 2025-32" applies to exactly one thing, the
  **basic standard deduction** (2025-32 §3.01, removing 2024-40 §2.15(1)). The aged/blind
  additional amounts ($1,600 / $2,000), the ordinary rate brackets, and the capital-gains
  breakpoints are **unmodified** and cite Rev. Proc. 2024-40 alone. A single citation string
  applied to the whole set would be factually wrong on most entries — and TAX-01's own text
  ("each carrying its Rev. Proc. number, section, and effective date") already demands per-entry.

- **The parameter set lives in a compiled-in fjs data module, not a CAS document.** The decisive
  reason is testable rather than aesthetic: `fjs-run-integration.test.js` spawns the real server
  against a fresh `mkdtemp` CAS home with nothing seeded. Parameters stored as a CAS document
  would make `finance_tax_params` fail on that home — and on every new install — until someone
  remembered to seed them. Tax-year parameters are code-versioned reference data shipped with the
  server, not taxpayer documents, and the document base exists for the latter.

- **Every dollar amount is a decimal string**, never a JSON number, validated the same way every
  existing dialect's money boxes already are. This is AGENTS.md's absolute rule and it applies to
  parameters exactly as it applies to documents.

- **An unsupported year returns an `errorResult` that names the supported years**, mirroring
  `finance_schema`'s unknown-dialect refusal. Never a null, an empty set, or a silent fallback to
  the nearest year.

### The Tax Table's Representation

- **Rows are generated, not stored literally.** The stored data is the five-row band structure plus
  the rate brackets; rows come from exact rational midpoint arithmetic over them. A literal table to
  $100,000 is roughly 2,700 rows — unmaintainable and unreviewable as source, and it would make the
  "diff against the published table" proof a diff of a transcription against itself.

- **One row with four tax columns**, mirroring the printed page, rather than four separate
  per-status tables. Band boundaries are identical across all four statuses (verified from the
  source); only the printed amount differs. Keeping the printed row shape makes criterion 2's
  comparison literal and unreshuffled, which is the most defensible reading of "diffed row by row
  against the published Publication 1040."

- **The diff's expected side is hand-transcribed literals keyed directly from Pub. 1040**, sharing
  no code path with the generator. This is the phase's central proof-honesty decision and it comes
  straight from Phase 7's recorded lesson: 185 virtual proofs missed a shipped bug because the
  fixture mirrored the code's own mistake. If the expected side is computed by the code under test,
  the diff cannot fail no matter how wrong the code is. The transcribed sample must span every band
  region, **both** width transitions ($25→$50 at $3,000, and the low-end narrowing), the
  `18,000–18,050` row that criterion 3 names, and the final `99,950–100,000` row.

- **"Across the full income range" is satisfied by two proofs, not one**: the row-level diff above,
  *plus* a structural proof that the band widths tile $0 → $100,000 with no gap and no overlap.
  Neither alone is honest — the sample proves rows right where checked, the structural proof proves
  nothing was skipped between the checks.

### Boundaries, Rounding, and Refusals

- **A lookup at $100,000 or above is refused explicitly.** The table genuinely ends there; Pub. 1040
  prints "$100,000 or over, use the Tax Computation Worksheet" immediately after the last row.
  Returning the last row, or nothing, would hand Phase 10 a silent hole where the worksheet belongs.
  The boundary is sharp: $99,999.99 is a table lookup, $100,000.00 is not.

- **TAX-04's boundary triples are generated data-driven over the stored threshold list**, so every
  threshold gets `−1¢` / `threshold` / `+1¢` automatically and a threshold added later is covered
  without anyone remembering to add proofs. This mirrors the self-enforcing pattern Phase 7 already
  established with the runtime tool-coverage check. Hand-written named leaves would drift.

- **Rounding reuses the existing `halfUp` in `fjs/types/rational`** (ties away from zero, already
  proven). It is what reproduces the criterion-3 case: midpoint $18,025 × 10% = $1,802.50 → $1,803.
  No new rounding helper.

- **The aged/blind additional amounts are stored with their own citations, but no eligibility date
  logic lands this phase.** Eligibility is a birthdate comparison ("born before January 2, 1961",
  printed on Form 1040 line 12d), not a cent threshold, so it is outside TAX-04's boundary-proof
  scope and belongs where filing status and age are actually computed.

### The MCP Tool and Its Coverage

- **`finance_tax_params` mirrors `fjs/server/finance_schema/module.f.js` exactly** — same
  `toolEntry` construction, same lookup-map shape, same `errorResult` refusal. It is the most
  recently shipped tool and the near-mechanical precedent; deviating would introduce a second
  pattern for no gain.

- **The response carries the parameters and the band structure, not the generated rows.** Thousands
  of rows would exceed the 64KB size guard on every call. The band structure plus brackets is
  precisely what a guest program needs to derive any row it wants.

- **A `finance_tax_params` call is added to `fjs-run-integration.test.js` in this phase** — a
  required task, not a follow-up. That test derives the tool list from a live `tools/list` response
  at runtime and asserts the set of tools called equals the set advertised, so registering the tool
  without adding the call **will fail the integration suite immediately**. This is the mechanism
  working as designed, not an obstacle.

- **`parameterSetHash` is deferred to Phase 14.** No Phase 8 requirement names it; PROV-04 does, and
  that is Phase 14's job. Adding speculative fields ahead of a real need is what DOC-00's precedent
  says to hold back.

### Claude's Discretion

- Final module paths and field names. Research's illustrative schema (`standardDeduction`,
  `ordinaryBrackets`, `taxTableBandStructure`) is explicitly marked non-binding (Assumptions Log A2).
- Whether the parameter module and the Tax Table module are one module or two.
- Whether the generator operates in dollars-as-rationals or cents-as-rationals internally — but the
  scale discipline must be verified against `fjs/exact`'s `centsScale`, not assumed (Assumptions
  Log A3).
- Exactly which rows beyond the mandatory ones are hand-transcribed, provided every band region and
  both width transitions are represented.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets

- `fjs/types/rational/module.f.js` — `of`, `ofInt`, `add`, `multiply`, `sum`, and **`halfUp`**
  (line 122), IRS half-up with ties away from zero. The midpoint arithmetic and the rounding this
  phase needs both already exist and are proven.
- `fjs/types/decimal/module.f.js` — `parse(scale)` / `format(scale)`, generic in scale, refusing
  over-precision rather than rounding.
- `fjs/exact/module.f.js` — `centsScale = 2`, `centsFromString`, `centsToString`. The money boundary
  every stored decimal string crosses.
- `fjs/server/finance_schema/module.f.js` — the precedent to mirror. Imports `toolEntry`,
  `okResult`, `errorResult` from `functionalscript/fjs/protocol/mcp/module.f.js`; builds
  `financeSchemaTool` via `toolEntry` (line 71); carries a five-leaf `proof` (line 116). Note its
  recorded typing lesson: the lookup map is typed as an open string-keyed map, not the narrower
  literal-key type TS infers from computed properties.

### Established Patterns

- Proofs are exported `proof` objects discovered by root `all.test.js`. **`node --test <file>` is a
  documented fake pass** — only `npm test` / `node --test all.test.js` is trustworthy.
- fjs's `assert` / `unwrap` / `match` throw **bare values, not `Error`s**. Never branch on
  `instanceof Error` anywhere in this repo.
- The phase gate counts **project-local** proofs via
  `node --test 2>&1 | grep -c '^✔ import("./fjs/'` — currently **185** in this worktree. Never gate
  on `npm test`'s total, which includes ~2,100 vendored submodule proofs and changes with submodule
  initialization.
- A mutation that fails to *compile* proves nothing: `npm test` is `tsc && node --test`, so a
  mutation must typecheck but not fire to actually measure the suite.

### Integration Points

- `fjs/server/module.f.js` — `financeMcpHandlers`, the flat registry. One new entry makes the tool
  reachable and makes it enumerable by the integration test's coverage assertion.
- `fjs-run-integration.test.js` — one new `call('finance_tax_params', …)` plus assertions, in the
  same real session the existing calls run in.

### Working-Directory Hazard

This repo vendors FunctionalScript as a submodule at `./functionalscript`. A `cd` into it persists
across subsequent commands and silently redirects everything after it into the wrong repository —
this already cost a false "the build is broken" report once. Use absolute paths or `git -C`. Never
`git add` the submodule path.

</code_context>

<specifics>
## Specific Ideas

- **The band structure, verified from `p1040.pdf` and not to be re-derived:** `$0–$5` width $5;
  `$5–$15` and `$15–$25` width $10; `$25–$3,000` width $25; `$3,000–$100,000` width $50; table ends
  at $100,000. Identical across all four filing statuses.
- **Criterion 3's arithmetic, confirmed at source:** the `18,000–18,050` MFJ cell prints `1,803`.
  Midpoint $18,025 × 10% (MFJ's first bracket runs to $23,850) = $1,802.50, half-up → $1,803.
- **The standard deduction figures are the OBBBA-revised ones** — $15,750 / $31,500 / $23,625 —
  traceable to Rev. Proc. 2025-32 §3.01. Citing the original 2025 inflation release is the specific
  sourcing error this phase must not make.
- Two rows worth transcribing because they are the easiest to get wrong: `2,975–3,000` /
  `3,000–3,050` (the $25→$50 width transition) and `99,950–100,000` (the last row, MFJ `11,823`).

</specifics>

<deferred>
## Deferred Ideas

- `parameterSetHash` in the tool response — Phase 14 (PROV-04).
- The Tax Computation Worksheet for $100,000+ — Phase 10 (TAX-03).
- Aged/blind eligibility date logic ("born before January 2, 1961") — wherever filing status and age
  are computed.
- Schedule 1-A senior deduction figures — Phase 13, and research's Assumptions Log A1 explicitly
  flags them as secondary-source only, to be re-verified against a primary IRS source there rather
  than inherited from this session.

</deferred>
