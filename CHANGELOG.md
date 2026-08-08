# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

**While the project is pre-1.0, the minor position tracks the roadmap phase.**
`0.10.0` is the release cut when Phase 10 completed. **`0.11.0` was never cut** —
Phases 11 and 12 both landed before anyone tagged, so `0.12.0` covers the pair
and the minor position continues to name the highest completed phase.
`1.0.0` is reserved for the release in which Phase 14
(Acceptance) lands and a real server path produces a Form 1040 end to end —
until then the major position stays at zero deliberately, because the engine
cannot yet be reached from the server.

## Unreleased

## 0.12.0

Phases 11 and 12: the documents a real return actually arrives as. Four new
dialects, a tool to list what has been filed, Schedule B, and a retraction hole
closed in the code that hands a guest program its view of the store.

Project-local proofs: **492 → 629**.

### What is here

- **Four new document dialects**, each with its own structural schema and
  semantic validator: `vnd.fjs.1099r` (retirement distributions),
  `vnd.fjs.ssa1099` (Social Security benefits), `vnd.fjs.1099div` (dividends)
  and `vnd.fjs.1099b` (broker proceeds). **Nine dialects are now registered**,
  a count `finance_schema` asserts against a hand-typed constant so that
  registering a dialect without registering its schema fails the build.
- **`finance_documents_list`**, a twelfth MCP tool: what has been filed, by
  dialect, read through Evo rather than by walking the store.
- **Schedule B** (`fjs/schedule/b`) — the interest and ordinary-dividend
  thresholds as two independent tests, each at $1,500, proved against a return
  that is over the combined figure while under both individual ones and so
  triggers neither.
- **Foreign-account fields on `vnd.fjs.return_profile`.** Additive, and the one
  deliberate exception to Phase 12's "do not touch `fjs/return/`" boundary: no
  IRS information return reports whether a taxpayer holds a foreign account, so
  it can only be declared.
- **Absence stays absent** (DOC-11/DOC-12). Every money box is optional; a blank
  box is not a zero, and a `"0"` standing in for "not printed" is a defect. A
  correction is `corrected: option(true)` — `false` is structurally invalid,
  because absence is the only way to say "not corrected".

### Fixed

- **A retracted document was still reachable** (DOC-15). `buildRunSnapshot`
  resolved archived subjects' heads and every blob from `cas.list()`, so a guest
  could walk `evo_list('true') → evo_head → evo_revision → cas_read` into a
  document that had been withdrawn. Archived revisions are now tracked by hash
  and excluded. The first fix conflated *archived* with *failed to decode* and
  would have silently hidden an **active** document; the two cases are now
  distinct, and a head that fails to decode still reports loudly.
  **The honest boundary, unchanged:** `blobs` stays unfiltered, so this does not
  — and cannot — make retracted bytes unreadable to a party already holding
  their exact hash.

### What is NOT here

- **No production caller for `form1040Report`.** No server path produces a 1040
  today; Phase 14 owns that, and it is why this is `0.12.0` and not `1.0.0`.
- **Dividends are read but not used.** The 1099-DIV dialect can parse the form,
  and the engine still **refuses** a return that declares dividend income —
  `qualifiedDividends` and `ordinaryDividends` remain unmodeled in
  `fjs/return/scope`. Reclassifying them without simultaneously wiring Form 1040
  lines 3a/3b would make the engine report a confident zero where it currently
  refuses honestly, which is strictly worse. Phase 12.1 does both as one change.
- **The Schedule D Tax Worksheet branch still refuses**, naming unrecaptured
  §1250 gain and 28%-rate gain as unmodeled. It is *selected* correctly; that
  selection is proven.
- **The sandbox claim is unchanged and still narrower than "it cannot reach the
  network."** A guest requesting `fetch` through the effect system is refused by
  name, and a disallowed import specifier is refused before the module body
  executes. A guest body calling `globalThis.fetch(...)` directly runs with host
  privileges — a recorded accepted risk, stated in `fjs/guest/materialize`'s own
  header.

## 0.10.0

The first tagged release. Phases 1-10 of an 18-phase roadmap: a working MCP
server, a content-addressed document store, exact money, and Form 1040 lines
1a-37 with a four-way line-16 dispatch and a scope guard that refuses what it
does not model.

### What is here

- **MCP server** over stdio with six tools — `finance_schema`,
  `finance_tax_params`, `fjs_run`, `cas_refresh`, `evo_list`, `evo_head`.
- **Five document dialects**, each with its own structural schema and semantic
  validator: `vnd.fjs.w2`, `vnd.fjs.1099int`, `vnd.fjs.medical_expenses`,
  `vnd.fjs.ocr`, `vnd.fjs.return_profile`.
- **Money is never floating point.** A decimal `string` on the wire and in
  storage, integer cents as `bigint` in computation, rounded once at the end
  and only if the taxpayer elected whole dollars (i1040gi p23).
- **Traceability enforced by the type system.** A report line carries a
  non-empty tuple of `(documentHash, boxPath, value)` sources and the printed
  rule it implements; a line without its sources does not compile, asserted as
  a conditional type inside the passing build.
- **Form 1040 lines 1a-37** (`fjs/form1040/core`), 56 printed money lines.
- **Line 16's four-way dispatch** (`fjs/tax/line16`) in the printed order, each
  outcome tagged with the method that produced it — Tax Table, Tax Computation
  Worksheet, the Qualified Dividends and Capital Gain Tax Worksheet, and the
  Schedule D Tax Worksheet, which is selected correctly and then refuses.
- **The scope guard** (`fjs/return/scope`): 6 modeled kinds, 44 refused by
  name, each naming the 1040 line and the form that would supply it. An
  unmodeled declared input refuses the WHOLE return — the error outcome carries
  no line list at all, so a partial 1040 is not representable.
- **TY2025 parameters as data** (`fjs/tax/params`), every figure citing its
  Revenue Procedure and section.
- **A restricted interpreter** (`fjs/exec`): a frozen four-command vocabulary,
  refusals naming the command and the permitted set, and a bounded step budget.
- **492 project-local proofs**, in the modules they test.
- **A browser showcase** (`demo/`) that imports the shipped engine as ES
  modules with zero dependencies and no build step. Run `./demo/serve.sh`.

### What is NOT here

Stated as plainly as the above, because the gap is the point:

- **`form1040Report` has no production caller.** No server path produces a 1040
  today. Phase 14 owns that, and it is why this is `0.10.0` and not `1.0.0`.
- **The Schedule D Tax Worksheet is selected, then refuses**, naming
  unrecaptured section 1250 gain and 28%-rate gain as unmodeled. Phase 12.
- **Wage, retirement and benefit documents beyond the W-2** — SSA-1099,
  1099-R, 1099-DIV, 1099-B — are not modeled. They appear only in the refusal
  table, as remedies. Phases 11-13.
- **Guest bodies run with host privileges.** A stored program requesting
  network access *through the effect system* is refused by name, and a
  disallowed import specifier is refused *before the module body executes*. A
  guest calling `globalThis.fetch(...)` directly is not defended against. This
  is a recorded, accepted risk, stated in `fjs/guest/materialize`'s own header.
- 8 of 18 roadmap phases remain, including the three backlog phases.

### Known documentation defects

Found and recorded:

- `REQUIREMENTS.md` TAX-10 calls the Social Security Benefits Worksheet 19
  lines; it is 18. **Still open** — deliberately left for Phase 13, which builds
  that worksheet and will read it line by line against the printed form. Fixing
  the count now, from the same recall that produced it, would swap one
  unverified number for another.
- ~~`ROADMAP.md` constraint 4 names 1099-DIV boxes 2b/2d as forcing Schedule D;
  i1040gi p31 Exception 1 names 2b, 2c **and** 2d.~~ **Fixed 2026-08-07** while
  scoping Phase 12, along with the same constraint's now-historical claim that
  "Phase 12 holds DOC-06, TAX-08, and TAX-11 in one phase" — TAX-08 shipped in
  Phase 10 and the remainder was split into Phases 12 and 12.1.

### Unverified against paper

Three figures nobody has checked against the printed forms: the 2025 Form 1040
face's 56-line inventory, the 19 standard-deduction chart amounts against
`f1040s.pdf` p4, and whether the Tax Computation Worksheet is cent-exact rather
than whole-dollar (exactly one value moves if it is not — the QDCGT worked
case's line 24, `$184,094.50` vs `$184,095.00`).

### Dependencies

`functionalscript` 0.43.1. It is the only runtime dependency, and it is our own
project rather than a third party.
