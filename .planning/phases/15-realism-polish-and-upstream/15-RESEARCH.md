# Phase 15: Realism Polish and Upstream - Research

**Researched:** 2026-08-11
**Domain:** FunctionalScript (fjs) MCP server internals — guest-program sandbox, CAS/Evo
provenance, tax-computation reference modules, media-dialect detection
**Confidence:** HIGH for code-level findings (everything below is read directly from the
installed `functionalscript@0.43.1` source and this repo's own modules, not recalled);
MEDIUM/LOW where flagged, chiefly TY2024 dollar figures and anything about the scope of the
"no bare `2025`" gate

## Summary

Phase 15's five deliverables split into two very different risk profiles. **DOC-16 and MCP-09
are cheap and mechanical**: the dialect registry DOC-16 asks for already shipped in pinned
`functionalscript` 0.43.1 (`fjs/media/module.f.js`'s `dialectEntry`/`detect`), so this is wiring,
not invention, and `fjs/guest/materialize`'s `loadProgram`/`checkSpecifiers` already give
`fjs_check` everything it needs to confirm an export shape without executing. **PROV-08 is
almost free** given the architecture: `fjs/report/line`'s `ReportLine` and `fjs_run`'s guest
sandbox are dialect-agnostic already, so a payer-summary report is a new, small guest program
plus one mechanical import-graph gate. **PROV-06 and TAX-17 are where the real design work is**,
and research changed the shape of both:

- **PROV-06's "mismatched program hash or parameter set" refusal does not need a new field.**
  Guest programs cannot `import` anything (EXEC-07/09) and `guestCtx` exposes only four CAS
  reads plus `step`/`pure`/money helpers — no tax-parameter lookup. Any tax figure a stored guest
  program uses is therefore a literal baked into that program's own source text at authoring
  time, which means the program's content hash (`programHash`) already encodes every parameter
  it consults. Diffing two runs with equal `programHash` is already diffing two runs of the
  identical parameter set; PROV-04's still-unbuilt "parameter-set hash" field (Phase 14, skipped)
  is not required for this guard to be sound.
- **The Capital Loss Carryover Worksheet needs zero TY2024 tax parameters.** Fetched directly
  from the IRS's own `i1040sd.pdf` (2025 revision), the worksheet's 13 lines consume exactly four
  prior-year *result* figures — 2024 Form 1040 line 15, and 2024 Schedule D lines 7, 15, and 21 —
  arithmetic over transcribed facts, not tax-year-parameter lookups. The "genuinely cited TY2024
  subset" CONTEXT.md anticipates is therefore not on the carryover's own critical path; it would
  only be needed if the plan additionally wants a second, independently computable TY2024 return
  to demonstrate "any year with parameters and documents computes" with real IRS data rather than
  a structural/mechanical proof. That is a separable, smaller decision than CONTEXT.md's phrasing
  suggests, and this document flags it as an Open Question rather than assuming it.
- **The tax/schedule/form computation modules are already year-generic.** Every one of
  `fjs/form1040/core`, `fjs/schedule/a`, `fjs/schedule/1a`, `fjs/form8812`, `fjs/tax/ssb`,
  `fjs/tax/boundary`, `fjs/tax/line16*`, `fjs/tax/table`, and `fjs/tax/deduction` takes a
  `TaxParamSet` as an explicit function argument; none hardcodes `2025` in its own computation
  logic. Every module's own `taxParams2025` identifier is a **test-fixture name inside that
  module's own `── Tests ──` section**, not a production dependency. A literal, un-scoped "no
  bare `2025` in `fjs/`" grep would false-positive on hundreds of these legitimate test constants
  and citation strings (`'2025-32'`, `effectiveDate: '2025-01-01'`) — the gate needs to be scoped
  the way `magi-gate.test.js` scopes its own case sensitivity, not applied as a blanket text scan.

**Primary recommendation:** ship DOC-16/MCP-09/PROV-08 largely as described; for PROV-06, build
the diff as a **host-side** module that reads two `vnd.fjs.run` records by hash, refuses on
`programHash` (and, defensively, `args`) mismatch, and applies `fjs/report/line`'s existing
`applyWholeDollarElection` itself rather than trusting an arbitrary guest program to have applied
it; for TAX-17, treat the carryover dialect + worksheet as the deliverable and treat "a second
computable year" as a separate, minimal, explicitly-scoped addition — not a byproduct of the
carryover.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PROV-08 | A second, non-tax report over the same documents, no engine change | `fjs/report/line`, `fjs_run`'s guest sandbox, and the existing tool-registry pattern in `fjs/server/module.f.js` are all dialect/domain-agnostic already; see Architecture Patterns and Code Examples |
| PROV-06 | Mechanical Form 1040-X columns from a report diff | `vnd.fjs.run`'s schema, `fjsRunTool`'s write path, and `applyWholeDollarElection` in `fjs/report/line` give every primitive the diff needs; see Summary and "PROV-06: The Amendment Diff" below |
| TAX-17 | Multi-year support incl. capital loss carryover | IRS `i1040sd.pdf` (2025 revision) Capital Loss Carryover Worksheet fetched verbatim; `taxParamsByYear`/`finance_tax_params` year-dispatch already open-keyed; every schedule/form module already takes `TaxParamSet` as a parameter — see "TAX-17: Multi-Year and Carryover" below |
| MCP-09 | `fjs_check(hash)` smoke-checks without running to completion | `fjs/guest/materialize`'s `loadProgram`/`checkSpecifiers` already separate "import and inspect" from "run"; see "MCP-09: fjs_check" below |
| DOC-16 | `fjs/media`'s `detect` recognises our dialects via a registry | `functionalscript@0.43.1`'s `fjs/media/module.f.js` (`dialectEntry`/`detect`) read in full below; this repo imports none of it today | 
</phase_requirements>

## Architectural Responsibility Map

This project is not a web app; the tiers below are this project's own layering, confirmed by
reading the actual import graph.

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Tax/schedule computation (rates, worksheets, form lines) | Reference/spec modules (`fjs/tax/*`, `fjs/schedule/*`, `fjs/form1040/*`, `fjs/form8812`, `fjs/form8949`) | — | Heavily proof-tested, dialect- and IRS-verified, but **never imported by anything that executes via `fjs_run`** — confirmed by grep, nothing outside each module's own file imports `fjs/form1040/core` |
| Report authoring and execution | Guest program (agent-authored `.mjs` text, sandboxed) | MCP tool handler (`fjsRunTool`) | The guest embeds whatever arithmetic/parameters it needs as literals (no `import`, no tax-param lookup in `guestCtx`); the handler performs both CAS writes (EXEC-10) |
| Document validation & storage | Document dialect modules (`fjs/document/*`) + CAS/Evo | MCP tool handlers (`evo_add`, `cas_add` CLI) | Every dialect owns its own `validate`/`checkReferences`; storage is content-addressed, dialect-independent |
| Media-type / dialect detection | Upstream `fjs/media` (`dialectEntry`/`detect`) | This repo's `cas_refresh`/`buildCache` (the one place `detect` can become reachable in a running path) | The registry already exists upstream; this repo has never called it |
| Provenance / run identity | `vnd.fjs.run` (this repo's dialect) + CAS | MCP tool handler | `programHash`+`args`+`resultHash`+`inputs[]` is the full identity of a run; no separate "parameter set" field exists or is needed (see Summary) |
| Smoke-checking a stored program | `fjs/guest/materialize` (`loadProgram`, `checkSpecifiers`) | New `fjs_check` MCP tool (host-side) | Import-and-inspect is already separable from run-to-completion; `fjs_check` is a thin new caller, not new machinery |

## Standard Stack

This phase adds no third-party dependency (AGENTS.md's hard stop on that), and no new
FunctionalScript API is missing upstream for DOC-16 (see "State of the Art" below) — the entire
"stack" for this phase is this project's own module conventions plus one upstream capability
that already shipped.

### Core (pinned, already installed — verify before writing any plan)

| Module | Version | Purpose | Why Standard |
|--------|---------|---------|--------------|
| `functionalscript` | `^0.43.1` (installed: confirmed via `node_modules/functionalscript/package.json`) | Runtime, effects, rtti, media registry | Pinned dependency; `fjs/media/module.f.js`'s `dialectEntry`/`detect` is what DOC-16 adopts |

```
$ node -p "require('./node_modules/functionalscript/package.json').version"
0.43.1
```
`[VERIFIED: node_modules/functionalscript/package.json]`. `MAINT-06` (backlog, Phase 18) notes
`main` has moved two minor versions further upstream — **do not** bump the pin in this phase;
that is explicitly out of scope and belongs to Phase 18.

### Supporting

No new supporting library. Every primitive this phase needs (money exactness, rtti validation,
CAS/Evo, MCP tool registration) already exists in this repo or in the pinned `functionalscript`.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Diffing two run records via `fjsRunTool`'s existing write path | A bespoke "amendment" MCP tool with its own storage shape | Rejected by CONTEXT.md itself ("No new mechanism required") — a new storage shape would be exactly the second mechanism PROV-06 forbids |
| Treating `programHash` equality as the parameter-set guard | Adding a `parameterSetHash` field to `vnd.fjs.run` (effectively doing part of PROV-04 early) | PROV-04 is explicitly T2/Phase-14-scoped and Phase 14 was waived; doing it here would be scope creep into a requirement this phase does not own. See Common Pitfalls. |
| A minimal, real, cited TY2024 parameter set for "any year computes" | A synthetic/fixture-only second year (e.g. a proof-only `9999` entry) purely to exercise genericity | The synthetic route avoids Phase 13's transcription-risk repeat entirely but is less rhetorically convincing than a real second year; flagged as an Open Question, not decided here |

**Installation:** none required.

## Architecture Patterns

### System Architecture Diagram — PROV-06's amendment-diff data flow

```
Corrected document (agent, vision pass)
        │  evo_add (new revision, same subject)
        ▼
CAS/Evo store  ──resolve heads──▶  buildRunSnapshot (pin: subject+parents)
        │                                   │
        │                                   ▼
        │                         fjs_run (programHash H, args A) ── run 1 (before)
        │                         fjs_run (programHash H, args A) ── run 2 (after, new parents)
        │                                   │
        │                    each run: interpret(guest report) → RunOutcome
        │                                   │
        │                    fjsRunTool.handleRunOutcome: write result JSON,
        │                    write vnd.fjs.run record  ──▶  CAS
        │                                   │
        ▼                                   ▼
   runHash A, runHash B  ─────────▶  NEW: 1040-X diff module (host-side, pure)
                                            │  read both vnd.fjs.run records by hash
                                            │  refuse if programHash(A) ≠ programHash(B)
                                            │  refuse if args(A) ≠ args(B)  (parameter-set proxy)
                                            │  read both result blobs (JSON, ReportLine-shaped)
                                            │  applyWholeDollarElection to each side
                                            ▼
                                   { [line]: { columnA, columnB, columnC, sources } }
```

### Recommended Project Structure

```
fjs/
├── report/
│   ├── payer/              # PROV-08: the income-by-payer guest program's SPEC/reference
│   │                       #   (mirrors fjs/form1040's role — proofs + the exact text an
│   │                       #   agent would author — never imported by fjs_run itself)
│   ├── amend/               # PROV-06: the host-side diff module (new)
│   │   └── module.f.js      #   readRunRecord(hash) x2 → guard → diff → { A, B, C } per line
│   └── guard/                # existing (PROV-07's classifyRunOutcome) — no changes needed
├── tax/
│   └── carryover/            # TAX-17: the Capital Loss Carryover Worksheet (new)
│       └── module.f.js       #   pure worksheet arithmetic over the new document dialect
├── document/
│   └── prior_year_capital_loss/   # TAX-17: the new document dialect (new)
│       └── module.f.js
├── guest/
│   └── check/                 # MCP-09: fjs_check's pure logic (new)
│       └── module.f.js        #   import + shape-confirm, never execute
└── media/                      # DOC-16: local adoption of upstream dialectEntry/detect (new,
    └── dialects/                #   name at Claude's discretion — see Don't Hand-Roll)
        └── module.f.js
```

The exact module names above are suggestions consistent with this repo's existing `fjs/<area>/<thing>`
layout; CONTEXT.md leaves "module layout, proof naming, and the exact shape of the new dialect's
fields" to Claude's discretion.

### Pattern 1: The dialect registry, exactly as upstream already ships it

**What:** `fjs/media/revision/module.f.js` is the existing, in-repo (well, in-`node_modules`)
worked example of exactly what DOC-16 asks this repo to do for its own eleven-plus dialects.

**When to use:** Any place a blob's dialect must be recognized from bytes alone (currently:
nowhere in this repo's running path — see "Don't Hand-Roll" for the one real integration point).

**Example — the exact upstream API, read in full from `node_modules/functionalscript/fjs/media/module.f.d.ts`:**
```typescript
// Source: node_modules/functionalscript/fjs/media/module.f.d.ts (functionalscript 0.43.1)
export type DialectEntry = {
    readonly dialect: string;
    readonly match: (_: Unknown) => boolean;
};
// T is constrained to Struct = StringMap<Type> — an rtti object schema. This is what
// rejects a schema member like `() => 42` at compile time; it is NOT what enforces the
// `dialect` field's presence (rtti's own type system cannot express "has a direct string
// member named X"), which `dialectEntry` asserts at construction time instead (loudly, once).
export declare const dialectEntry: <T extends Struct>(
    type: T,
    extraValidate?: (_: Ts<T>) => boolean,
) => DialectEntry;
export declare const detect: (dialects: readonly DialectEntry[]) => (bytes: Vec) => DetectMeta;
```

**`extraValidate`'s exact contract** (read from the implementation, not inferred): it runs
*after* structural (rtti) validation, receives the dialect's own decoded type (`Ts<T>`), returns
a plain `boolean` with no error channel, and never sees raw bytes — parsing and the schema walk
stay inside `detect`. It **can** express refinements rtti cannot (cbase32-decodability,
safe-integer bounds, cross-field consistency) exactly the way `fjs/media/revision`'s own
`isValidRevision` does; it **cannot** report *why* something failed (no error message crosses
this boundary) and cannot access anything outside the already-parsed, already-schema-matched
value.

**How this repo would adopt it** — the exact upstream precedent, applicable verbatim to every
one of this repo's twelve document dialects:
```javascript
// Source: node_modules/functionalscript/fjs/media/revision/module.f.js (verified in full)
import { dialectEntry } from '../module.f.js'
// ...
const isValidRevision = (r) => {
    const [tag] = checkReferences(r)
    return tag === 'ok'
}
export const revisionDialect = dialectEntry(revisionSchema, isValidRevision)
```
This repo's own dialects already have the identical shape: every one exports a `schema` object
with a direct string `dialect` literal (via the shared `base()` helper) and a `checkReferences`
returning `Result`. Wrapping each with `dialectEntry(schema, r => checkReferences(r)[0] === 'ok')`
is a one-line addition per dialect.

### Pattern 2: The mechanical grep-gate, exactly as `magi-gate.test.js` already ships it

**What:** A root-level, `@ts-nocheck`, impure `*.test.js` file (AGENTS.md's carve-out) that walks
`fjs/` with `node:fs`, applies a regex per line, and fails `node --test` if any file matches —
paired with a **positive control** proving the gate is not vacuously strict (the "MAGI is still
permitted in prose" leaf).

**When to use:** Any project-wide invariant that cannot be expressed as a `tsc` type constraint
and is cheaper to enforce as a text scan than as a runtime proof — here, "no bare `2025` literal
survives in the computation modules" and "`fjs/report/payer` imports nothing from `fjs/tax/*`".

**Example, adapted for PROV-08's import-graph gate** (the payer report's non-tax-ness, made
mechanical rather than asserted):
```javascript
// Source: pattern from magi-gate.test.js, adapted
// @ts-nocheck
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const scanRoot = join(fileURLToPath(new URL('.', import.meta.url)), 'fjs', 'report', 'payer')
// same listFilesRecursively(dir) helper as magi-gate.test.js

test('fjs/report/payer imports nothing from fjs/tax/*', () => {
    const offenders = []
    for (const filePath of listFilesRecursively(scanRoot)) {
        const text = readFileSync(filePath, 'utf8')
        if (/from\s+['"][^'"]*\/tax\//.test(text) || /from\s+['"]\.\.\/\.\.\/tax\//.test(text)) {
            offenders.push(filePath)
        }
    }
    assert.equal(offenders.length, 0, `fjs/report/payer must not import fjs/tax/*: ${offenders.join(', ')}`)
})
```
`[ASSUMED: exact regex shape — the planner should verify the real relative-import spelling used
inside fjs/report/payer once that module exists, mirroring how magi-gate's own regex was tuned
against real offending lines]`.

**Why the "no bare 2025" gate needs the SAME care magi-gate took with case-sensitivity, but for
a different axis:** see Common Pitfalls below — a literal, unscoped scan will false-positive on
every existing tax/schedule module's own `taxParams2025` test-fixture identifier.

### Anti-Patterns to Avoid

- **A second "amendment record" CAS dialect.** PROV-06's decision text is explicit: "No new
  mechanism required." The diff's inputs are two existing `vnd.fjs.run` hashes; inventing a
  third stored artifact to represent "the diff" would be exactly the mechanism the requirement
  forbids. If the diff's own OUTPUT needs to be citable later, write it back through the SAME
  `fjsRunTool`-shaped path (i.e., make the diff itself a guest program run via `fjs_run`) rather
  than a bespoke write.
- **Trusting a guest program to have applied `applyWholeDollarElection` itself.** That function
  lives in `fjs/report/line` and is **not** part of `guestCtx` (confirmed: `guestCtx`'s only
  members are `casRead`/`evoList`/`evoHead`/`evoRevision`/`step`/`pure`/`centsFromString`/
  `centsToString`). A guest program cannot import it. If the diff assumes stored results are
  already whole-dollar-projected, it is trusting an unenforceable convention. Apply the
  projection **inside the diff module**, host-side, over the raw exact-cents values both stored
  results carry.
- **Grepping the whole `fjs/` tree for the bare string `2025`.** This will match roughly 450+
  lines today (test fixtures, Rev. Proc. citation strings, effective dates) and be worthless as
  a signal. Scope the gate to control-flow usage (comparisons, branches) or to specific
  known-dangerous call sites, mirroring magi-gate's own carve-out for legitimate uppercase usage.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Dialect detection from raw bytes | A second, local dialect-name-to-schema map with its own byte-sniffing | Upstream `fjs/media/module.f.js`'s `dialectEntry`/`detect` | Already ships the exact "list of decoders, falls through when none match" shape DOC-16's own (corrected) text describes; a local reimplementation would be the "local glue" the requirement explicitly rejects |
| Import-without-executing | A parser (djs/parser was already rejected project-wide per DOCC-01) or a new sandboxed dry-run mode | `fjs/guest/materialize`'s `loadProgram(allowed)(path)(source)`, called and its **result inspected without calling the loaded module's export** | `loadProgram` already does exactly "gate specifiers, then `import_`, return the `Module`" — `fjs_check` is a caller that reads `module.report`'s presence/typeof and stops, never invoking it |
| Money-exactness / decimal parsing for the new carryover dialect's four fields | A new parser | `fjs/document/money_field`'s `moneyFieldError` (already accepts negative amounts — proven by its own `negativeAccepted` leaf, and by `vnd.fjs.1099b`'s boxes 8-11) | Every existing signed-money box in this codebase already uses this helper |
| Run-record lookup / hash decoding for the diff | A new CAS-read helper | `cBase32ToVec` + `cas.read` + `collectRead`, the exact pattern `fjs/server/fjs_run/module.f.js`'s `assertPersistedErrorRunRecord` test helper already demonstrates for reading a run record back out of CAS by hash | Already proven, already imported at that exact call site |

**Key insight:** every piece PROV-06/MCP-09/DOC-16 need already exists somewhere in this repo or
in the pinned `functionalscript`; the actual net-new code in this phase is small — a new
document dialect, a worksheet function, a diff function, a `fjs_check` tool wrapper, and one
dialect-registration file. The risk in this phase is almost entirely in getting the IRS figures
and the mechanical gates right, not in writing new machinery.

## Common Pitfalls

### Pitfall 1: Assuming PROV-06 needs a "parameter-set hash" that does not exist yet

**What goes wrong:** CONTEXT.md's decision text says the diff "refuses loudly on mismatched
program hash or parameter set," which reads as if two independent fields need comparing. If a
plan adds a `parameterSetHash` field to `vnd.fjs.run` to satisfy this, it is silently
implementing part of **PROV-04** ("Report output states the tax year, the parameter-set hash,
and the program hash") — a T2 requirement explicitly scoped to Phase 14, which was waived by
owner decision, not delivered.

**Why it happens:** The two nouns ("program hash", "parameter set") sound like two fields.

**How to avoid:** Because guest programs cannot `import` and `guestCtx` has no tax-parameter
lookup, every dollar figure a stored program consults is a literal in that program's own source
— which the CAS hashes. Two runs with equal `programHash` are, by construction, two runs of
byte-identical source, including whatever parameters it embedded. Use `programHash` equality
(already a field) as the sufficient guard; add `args` equality (also already a field) as a
defensive second check for the case where one program embeds *multiple* years' logic and
dispatches on an `args[0]` selector. Do not add a new field.

**Warning signs:** A plan task titled "extend vnd.fjs.run with parameterSetHash" — that is
PROV-04's work, not PROV-06's.

### Pitfall 2: A literal "no bare 2025" grep gate false-positiving on ~450 legitimate lines

**What goes wrong:** `grep -rn "2025" fjs/` returns hundreds of hits: every one of
`fjs/form1040/core`, `fjs/schedule/a`, `fjs/schedule/1a`, `fjs/form8812`, `fjs/tax/ssb`,
`fjs/tax/boundary`, `fjs/tax/line16*`, `fjs/tax/table`, and `fjs/tax/deduction` declares its own
module-scope `const taxParams2025 = taxParamsByYear[2025]` inside its `── Tests ──` section, used
throughout that module's own proofs (`[VERIFIED: fjs/**/module.f.js`, grep across the tree]`).
Rev. Proc. citation strings (`'2025-32'`, `'2025-01-01'`) and filenames (`f1040sd--2025.pdf`) add
more. A blanket gate would fail on day one and demand either mass renaming of a pervasive,
harmless convention or a hand-maintained exclusion list that immediately drifts.

**Why it happens:** The requirement text and CONTEXT.md's phrasing ("no bare `2025` literal
survives in the computation modules") reads as simple, but "computation modules" already
contains this convention by design — each module independently pins its own test fixture to a
named year for readability.

**How to avoid:** Scope the gate the way `magi-gate.test.js` scopes its own case-sensitivity
carve-out (it explicitly permits uppercase `MAGI` in prose while forbidding `magi`/`Magi` as an
identifier substring): target the shape of an actual defect — a bare year used in a *comparison
or branch* (`year === 2025`, `taxYear !== 2025`), or restrict the scan to files/functions outside
each module's own `── Tests ──` section, or restrict it to the specific dispatch surface where a
year-hardcode would actually matter (`fjs/tax/params`'s `taxParamsByYear` construction site and
`fjs/server/finance_tax_params`'s `taxParamsResponses` construction site — both of which
*legitimately* contain `2025` today as a map key, and would legitimately gain a `2024` key
alongside it). Pair the grep with a positive-control leaf (AGENTS.md: "a gate needs a control")
proving a genuinely hardcoded `if (taxYear === 2025)` DOES trip it.

**Warning signs:** The gate's own first run reports dozens of "offenses" that are all
`taxParams2025` test-fixture declarations.

### Pitfall 3: Treating the Capital Loss Carryover Worksheet as needing tax-year parameters

**What goes wrong:** A plan sizes TAX-17 around "the minimal TY2024 parameter subset the
carryover needs," searches for which rates/thresholds the worksheet touches, and finds none —
then either invents a spurious dependency or gets stuck.

**Why it happens:** CONTEXT.md's Area 3 conflates two things that research shows are separable:
(a) the carryover computation itself, and (b) demonstrating "any year with parameters and
documents computes" generically.

**How to avoid:** Per the fetched `i1040sd.pdf` (2025 revision) text (see "TAX-17" below), the
worksheet's 13 lines consume exactly four prior-year *result* figures and zero rate/threshold
parameters. Model the new document dialect and the worksheet function first, independent of any
TY2024 parameter work. Treat "does the codebase also need a second real tax year in
`taxParamsByYear` to prove genericity" as a separate, smaller decision — and note the
computation modules are already parameterized (Summary), so genericity may already be provable
structurally without transcribing a second year's IRS figures at all.

**Warning signs:** A plan task that blocks the carryover dialect on "first, source TY2024 Rev.
Proc. 2023-34 figures."

### Pitfall 4: Assuming "no prior-year carryover document" must be a loud refusal

**What goes wrong:** TAX-16's standing rule ("an honest, loud refusal always beats a confident
zero") and CONTEXT.md's "refusing when the inputs are absent" phrasing can be read as "every
return without a stored carryover document must refuse" — which would make a first-year filer or
a taxpayer who genuinely had no prior-year capital loss unable to file at all.

**Why it happens:** DOC-11's "absent is not zero" convention is usually about a printed form box;
here the "document" is the whole carryover record, one layer up.

**How to avoid:** Recommend (not locked — see Open Questions) distinguishing "the carryover
dialect document is entirely absent" (a legitimate `0n` for lines 6/14 — there may genuinely be
nothing to carry) from "the document is present but a required field is missing/inconsistent"
(refuse, naming the missing field) — mirroring how `fjs/document/1099b`'s absent box 1e is a
distinct, valid state from a malformed box 1e. This needs an explicit decision; flagged rather
than assumed.

**Warning signs:** A proof asserting that a return with brokerage sales and no carryover document
refuses outright.

## Code Examples

### Reading a `vnd.fjs.run` record back out of CAS by hash (PROV-06's read side)

```javascript
// Source: fjs/server/fjs_run/module.f.js's own assertPersistedErrorRunRecord (adapted; this
// exact sequence is already proven against real CAS content in that file)
import { cBase32ToVec } from 'functionalscript/fjs/basen/cbase32/module.f.js'
import { collectRead } from 'functionalscript/fjs/cas/module.f.js'
import { utf8ToString } from 'functionalscript/fjs/text/module.f.js'
import { validate as validateRun } from '../../run/module.f.js'

/** @type {(cas: Cas<O>) => (runHash: string) => Effect<O, Result<Run, string>>} */
const readRunRecord = cas => runHash => {
    const vec = cBase32ToVec(runHash)
    if (vec === null) { return pure(error(`not a decodable run hash: ${runHash}`)) }
    return mapStep(collectRead(cas.read(vec)), readResult =>
        readResult[0] === 'error'
            ? error(`run record not found: ${runHash}`)
            : validateRun(JSON.parse(utf8ToString(readResult[1]))))
}
```

### `dialectEntry`/`detect` adopted for this repo's dialects (DOC-16)

```javascript
// Source: fjs/media/revision/module.f.js's own revisionDialect construction, generalized —
// every existing dialect module already has `schema` (with a direct string `dialect` literal
// via base()) and `checkReferences` in the exact shape dialectEntry needs.
import { dialectEntry, detect } from 'functionalscript/fjs/media/module.f.js'
import { oneZeroNineNineIntSchema, checkReferences as checkOneZeroNineNineInt } from '../document/1099int/module.f.js'
// ... one import per dialect module

const oneZeroNineNineIntDialect = dialectEntry(
    oneZeroNineNineIntSchema,
    v => checkOneZeroNineNineInt(v)[0] === 'ok',
)
// ... one dialectEntry() call per dialect

export const financeDialects = [oneZeroNineNineIntDialect, /* ...every other dialect... */]
export const detectFinance = detect(financeDialects)
```
Wiring point: `fjs/server/module.f.js`'s `cas_refresh`/`buildCache` currently folds only
`vnd.fjs.revision` blobs (per this repo's own module docstrings) — that is the "real
document-classification path" CONTEXT.md requires `detect` be wired into, not merely registered.
`[ASSUMED: exact call site inside buildCache/cas_refresh — verify against
node_modules/functionalscript/fjs/cas/evo/module.f.js's buildCache implementation before
planning the precise wiring point]`.

### `fjs_check`'s import-and-confirm, never execute (MCP-09)

```javascript
// Source: composed from fjs/guest/materialize/module.f.js's own loadProgram, which already
// separates "import" from "invoke the loaded export" — loadProgram's own proof
// (dirtySourceIsRefusedWithoutEvaluatingTheModuleBody) is the existing evidence that gating
// happens before the module body runs; fjs_check needs the SAME import step but must stop one
// line earlier than executeRun does — it must never call `loaded.report(...)`.
const fjsCheck = materializeHomeRoot => cas => hash => step(
    /* resolve hash -> source text, same as executeRun's steps 1-2 */
    materializeAndLoad(materializeHomeRoot)(cas)(hash),
    loadResult => pure(
        loadResult[0] === 'error'
            ? errorResult(loadResult[1])
            : okResult(jsonText({
                exportsReport: typeof loadResult[1].report === 'function',
                // NOTHING below this line calls loadResult[1].report(...)
            }))
    ),
)
```
The MCP tool description, the module docstring, and the README must each independently state
"has no security value" per CONTEXT.md's "stated in three places" decision — this is a
documentation requirement, not a code one, and should appear as its own plan task/verification
step rather than being folded into the code task.

## State of the Art

| Old approach (this repo, today) | Current approach (available now) | When changed | Impact |
|--------------------|------------------|---------------|--------|
| `fjs/media/revision` imports `isHash`/`dialect` only; no dialect registry used anywhere in this repo | `dialectEntry`/`detect` from `fjs/media/module.f.js`, shipped in the pinned `functionalscript@0.43.1` | Already available at the pinned version — no upstream work needed | DOC-16 is pure local adoption; the requirement's own text describing an older, single-check `detect` is stale (confirmed: current `detect` takes a `dialects` list parameter and falls through, matching the "registry, not local glue" language) |

**Deprecated/outdated:** DOC-16's own requirement text in REQUIREMENTS.md ("it imports
`decodeText`/`mediaType` from `fjs/media/revision` directly and performs exactly one check")
describes a version of `fjs/media` that predates the pinned one. `[VERIFIED: read
node_modules/functionalscript/fjs/media/module.f.js in full — detect(dialects)(bytes) already
takes a list and falls through to detectVec when nothing matches]`. Correcting this stale text is
explicitly part of this phase per CONTEXT.md.

**No genuine upstream gap remains for `fjs/media`.** Answering the phase's own research question
honestly: the capability DOC-16 was written against no longer needs building — it shipped. The
deferred-items list in REQUIREMENTS.md's v2 section ("the `detect` dialect registry" as an
upstream contribution) is itself stale for the same reason. No PR against `functionalscript` is
needed for this requirement.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The exact regex/scope for the "no bare 2025" gate and the "no fjs/tax/* import" gate | Architecture Patterns, Common Pitfalls | Low — these are test-file details the executor can tune against the real file set once it exists, following magi-gate's own precedent of tuning against real offending lines |
| A2 | `buildCache`'s exact internal call site for wiring `detect` into the real classification path | Code Examples | Low-medium — verify against `node_modules/functionalscript/fjs/cas/evo/module.f.js` before committing to a specific edit location; the *requirement* (must be reachable from a real path, not merely registered) is not in doubt |
| A3 | Real, second-year TY2024 dollar figures (standard deduction $14,600/$29,200/$21,900, sourced to Rev. Proc. 2023-34) if the plan chooses to add a genuine second computable year | Summary, Open Questions | Medium — these figures came from secondary sources (KPMG, Wolf & Company summaries of Rev. Proc. 2023-34), not a direct fetch of the Rev. Proc. PDF itself (unlike the Capital Loss Carryover Worksheet text, which WAS fetched directly). If TY2024 parameters are added, re-verify by fetching `irs.gov/pub/irs-drop/rp-23-34.pdf` directly, exactly as Phase 8 did for TY2025's Rev. Proc. 2024-40/2025-32 |
| A4 | Recommended resolution of the "absent carryover document = zero vs. refuse" question | Common Pitfalls #4, Open Questions | Medium — this is presented as a recommendation, not a locked decision; a wrong choice changes whether ordinary first-year/no-loss returns can compute at all |

**If this table is empty:** N/A — see entries above.

## Open Questions

1. **Does TAX-17 need a real, cited second tax year, or can "any year with parameters and
   documents computes" be demonstrated structurally?**
   - What we know: every schedule/form computation module already takes `TaxParamSet` as an
     explicit argument (confirmed by source read); `taxParamsByYear`/`finance_tax_params` are
     already open-keyed and already treat an unknown year as an ordinary refusal. The Capital
     Loss Carryover Worksheet itself needs zero TY2024 parameters.
   - What's unclear: whether the phase's rhetorical goal ("this is not a tax engine wearing a
     disguise" — the same spirit as PROV-08) is better served by a real, minimal, cited TY2024
     subset (higher transcription risk, more convincing) or a mechanical gate plus one
     synthetic/fixture year (lower risk, less vivid).
   - Recommendation: default to the mechanical gate + a genuinely small, cited TY2024 subset
     (just enough for a single-filer, wage-only Form 1040 core to compute, reusing Phase 8's own
     Rev.-Proc.-citation discipline) — but treat this as a discuss-phase-worthy sizing decision
     if the planner judges it non-trivial, since CONTEXT.md's own text hedges ("not a full TY2024
     parameter set") without pinning the exact subset.

2. **Absent-carryover-document semantics.**
   - What we know: DOC-11's "absent is not zero" convention is well-established for form boxes.
   - What's unclear: whether that convention should extend to "the whole carryover document is
     absent" (this research recommends treating that as legitimate zero, distinct from "present
     but incomplete") — CONTEXT.md's "refusing when the inputs are absent" phrasing is
     ambiguous between the two readings.
   - Recommendation: absence of the document → `0n` on lines 6/14 (nothing to carry); presence
     with a missing/inconsistent required field → named refusal. Confirm before locking the
     dialect's own validation.

3. **Where exactly does `applyWholeDollarElection` get its `elected` flag for the diff?**
   - What we know: the election is a fact on the return-profile document, read by whichever
     guest program(s) produced the two stored results being diffed.
   - What's unclear: whether the new diff module should re-derive `elected` from stored CAS
     content (requires assuming both runs pinned the same return-profile revision) or accept it
     as an explicit caller-supplied argument.
   - Recommendation: accept it as an explicit argument — simpler, and the calling agent already
     knows the taxpayer's election from having authored the underlying reports.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Node's built-in `node:test`, driven via FunctionalScript's Emergent Testing (`proof` exports discovered by `all.test.js`) |
| Config file | none — `tsconfig.json` (strict mode) governs typecheck; `package.json`'s `"test": "tsc && node --test"` governs the run |
| Quick run command | `node --test 2>&1 \| grep -c '^✔ import("\./fjs/'` after `npx tsc --noEmit` on the touched files only (fast, per-task signal — AGENTS.md's own de-duplication caveat applies to the FULL count, not to "did my new leaves appear") |
| Full suite command | `npm test` (includes the two real-process integration tests; per AGENTS.md this is the ONLY command whose total is trustworthy, and it currently takes ~11s under load per STATE.md's own measurement) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PROV-08 | Payer-summary report runs through real `fjs_run`, no engine change | unit + real-process | `node --test all.test.js` (unit); `node --test fjs-run-integration.test.js` (real-process, extend per TEST-03) | ❌ Wave 0 — new `fjs/report/payer` proof + an extension to `fjs-run-integration.test.js` |
| PROV-08 | `fjs/report/payer` imports nothing from `fjs/tax/*` | mechanical gate | `node --test <new-gate>.test.js` | ❌ Wave 0 |
| PROV-06 | Two same-program runs diff to A/B/C, `B = C − A` | unit | `node --test all.test.js` (new proof in the diff module) | ❌ Wave 0 |
| PROV-06 | Mismatched `programHash` refuses loudly | unit | `node --test all.test.js` | ❌ Wave 0 |
| TAX-17 | Capital Loss Carryover Worksheet lines 1-13 match printed worksheet on a worked example | unit | `node --test all.test.js` | ❌ Wave 0 — needs a hand-computed worked example, independently derived (AGENTS.md's "expected side must not be produced by the code under test") |
| TAX-17 | No bare `2025` literal survives (scoped) | mechanical gate | `node --test <new-gate>.test.js` | ❌ Wave 0 |
| MCP-09 | `fjs_check` confirms export shape without executing | unit | `node --test all.test.js` (mirror `dirtySourceIsRefusedWithoutEvaluatingTheModuleBody`'s spy technique: assert the loaded module's own side effect never fires) | ❌ Wave 0 |
| DOC-16 | `detect` recognizes every registered dialect and falls through on unknown | unit | `node --test all.test.js` | ❌ Wave 0 |
| DOC-16 | `detect` reachable from a real running path (not merely registered) | real-process | `node --test fjs-run-integration.test.js` or `cas-refresh-cross-process.test.js` extension | ❌ Wave 0 — TEST-03's standing rule applies: this phase adds a seam (`detect` wiring) and must add real-process coverage for it |

### Sampling Rate

- **Per task commit:** `npx tsc --noEmit` (fast fail on type errors) + targeted `node --test all.test.js` (accept the doubled count if the submodule is initialized; use the de-duplicated grep for a trustworthy number)
- **Per wave merge:** `npm test` (full suite, including the two real-process tests)
- **Phase gate:** `npm test` green, plus a manual mutation sweep on the new carryover worksheet and the new diff module specifically (AGENTS.md's "a proof is not known to work until you have watched it fail" — this phase's two highest-risk new computations)

### Wave 0 Gaps

- [ ] `fjs/tax/carryover/module.f.js` (or planner's chosen name) — the worksheet, with a proof
      built from an independently hand-computed worked example (not derived from the code)
- [ ] `fjs/document/prior_year_capital_loss/module.f.js` (or planner's chosen name) — the new
      dialect
- [ ] `fjs/report/amend/module.f.js` (or planner's chosen name) — the diff module
- [ ] `fjs/report/payer/` — the payer-summary report's spec/reference module (mirroring
      `fjs/form1040`'s role as a proof-tested, never-imported-by-`fjs_run` reference)
- [ ] `fjs/guest/check/module.f.js` (or planner's chosen name) — `fjs_check`'s pure logic
- [ ] `fjs/media/dialects/module.f.js` (or planner's chosen name) — the local `dialectEntry`
      registrations for every existing dialect
- [ ] A new root-level gate test (no-bare-`2025`, scoped per Pitfall 2) — Wave 0, since every
      later wave's code is what it protects
- [ ] A new root-level gate test (`fjs/report/payer` import-graph check) — Wave 0
- [ ] Extension to `fjs-run-integration.test.js` or a new real-process test file for: (a) the
      payer report running through a real separate process, (b) `detect` reachable from a real
      running path, (c) `fjs_check` reachable from a real MCP `tools/call`

## Security Domain

`security_enforcement` is not set to `false` in `.planning/config.json`, so this section is
included — but this project's own REQUIREMENTS.md explicitly defers security work generally
("Security ... Worked on later" — see the Scope Decisions table) and MCP-09 explicitly forbids
describing `fjs_check` as a security control. The two intersect directly in this phase.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | Single local user, stdio transport, no auth surface (per REQUIREMENTS.md's Out of Scope) |
| V3 Session Management | No | MCP session state is in-memory, single-process; no cross-session concern |
| V4 Access Control | No | No multi-tenant/multi-user boundary in v1 |
| V5 Input Validation | Yes | rtti structural validation + `checkReferences` semantic validation on every document dialect (existing pattern, extend identically for the new carryover dialect); `checkSpecifiers`'s fail-closed import-specifier allow-list for anything reaching `loadProgram` |
| V6 Cryptography | No new surface | `sha256` (CAS content addressing) already in use; this phase adds no new cryptographic operation |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| `fjs_check` mistaken for a security gate by an agent or a future maintainer | Repudiation-adjacent (false assurance) | MCP-09's own requirement: state "no security value" in the tool description, the module docstring, and the README — three independent places, per CONTEXT.md, so no single deletion silently removes the warning |
| A crafted "prior-year carryover" document asserting a favorable carryover with no derivation | Tampering | CONTEXT.md's own locked decision: "derived, not asserted" — the worksheet computes lines 6/14 from the new dialect's transcribed prior-year figures; the dialect itself only stores facts, never a pre-computed carryover total (mirrors `vnd.fjs.medical_expenses`'s "no stored total" precedent) |
| Two runs from genuinely different programs/parameter sets diffed as if they were an amendment pair | Tampering (silently wrong Column B) | The `programHash`/`args`-equality refusal this document's Summary establishes as sufficient — must be a loud, named refusal, not a silent best-effort diff |
| A malformed/adversarial stored program inspected by `fjs_check` | Elevation of Privilege (if conflated with a security boundary) | `fjs_check` must never invoke the loaded export — confirmed achievable by stopping at `loadProgram`'s return value, one step short of what `executeRun` does; this is a documentation/design discipline, not a new technical control |

## Sources

### Primary (HIGH confidence — read directly from installed source/fetched PDF)

- `node_modules/functionalscript/fjs/media/module.f.js` and `module.f.d.ts` (functionalscript 0.43.1) — `dialectEntry`/`detect` full implementation and type signature
- `node_modules/functionalscript/fjs/media/revision/module.f.js` — the worked `dialectEntry` precedent
- `fjs/guest/module.f.js`, `fjs/guest/materialize/module.f.js`, `fjs/server/fjs_run/module.f.js`, `fjs/run/module.f.js` — guest ABI, `loadProgram`/`checkSpecifiers`, `vnd.fjs.run` schema, run-record write path
- `fjs/report/line/module.f.js` — `ReportLine`, `applyWholeDollarElection`, confirmed absent from `guestCtx`
- `fjs/schedule/d/module.f.js` — the exact documented-zero seam (lines 6/14) and its own docstring naming the Capital Loss Carryover Worksheet as the missing piece
- `fjs/tax/params/module.f.js`, `fjs/server/finance_tax_params/module.f.js` — year-dispatch shape, `Citation` union, per-parameter sourcing discipline
- `magi-gate.test.js` — the mechanical-gate pattern this phase's two new gates should follow
- `AGENTS.md` — hard rules (no cast over indexed access, bare-value throws, no new dependency, mutation-testing discipline)
- IRS `i1040sd.pdf`, "2025 Instructions for Schedule D (Form 1040)" (fetched directly, 16 pages, `CreationDate: Dec 11 2025`) — Capital Loss Carryover Worksheet, page 9, all 13 lines quoted verbatim in Summary/TAX-17 sections above
- Cross-tree `grep` over `fjs/` for `taxParamsByYear[2025]` / `taxParams2025` — confirms every schedule/tax/form module is already parameterized and the `2025` occurrences are test-fixture identifiers

### Secondary (MEDIUM confidence)

- WebSearch results on Rev. Proc. 2023-34 (TY2024 inflation adjustments) via KPMG/Wolf & Company summaries — standard deduction figures ($14,600 single/MFS, $29,200 MFJ, $21,900 HoH) NOT independently verified against the Rev. Proc. PDF itself in this session; re-verify by direct fetch if TY2024 parameters are actually added

### Tertiary (LOW confidence)

- None used as a basis for any claim above without cross-verification.

## Metadata

**Confidence breakdown:**
- Standard stack / architecture: HIGH — read directly from installed `functionalscript` source and this repo's own modules
- Pitfalls: HIGH for Pitfalls 1/2/3 (each independently confirmed by direct source/PDF reading); MEDIUM for Pitfall 4 (a design recommendation, not a discovered fact)
- TY2024 dollar figures (if used at all): MEDIUM — flagged in Assumptions Log, re-verify by direct Rev. Proc. 2023-34 fetch before locking any figure

**Research date:** 2026-08-11
**Valid until:** 30 days (no fast-moving external dependency; the one time-sensitive fact — the
pinned `functionalscript` version — is pinned in `package.json` and won't drift without an
explicit, owner-approved bump per AGENTS.md)
