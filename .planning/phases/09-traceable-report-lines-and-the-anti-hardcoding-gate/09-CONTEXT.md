# Phase 9: Traceable Report Lines and the Anti-Hardcoding Gate - Context

**Gathered:** 2026-08-05
**Status:** Ready for planning

<domain>
## Phase Boundary

A report line cannot exist without the sources it came from, and a program that **contains** the
answer instead of **computing** it is caught mechanically.

**In scope:** the report-line type whose traceability is enforced by `tsc` rather than by authoring
convention (PROV-01), the `(documentHash, boxPath, value)` source tuples plus the rule each line
implements (PROV-02), and the anti-hardcoding gate — CAS-read count, numeric-literal audit, and a
perturbation proof (PROV-07).

**Out of scope:** any Form 1040 semantics. Phase 10 owns the 1040 core, line-16 dispatch, and the
scope guard. This phase delivers the type, the audit, and the gate, demonstrated on a minimal
program that computes something trivial from real stored documents.

**The adversary this phase is built against, stated exactly:** `() => pure({ line16: 9137 })`.
It typechecks. It returns a plausible figure. It satisfies every other criterion in the project.
And it reads nothing, computes nothing, and defeats the entire thesis. If this phase ships and that
program still passes, the phase failed regardless of what the suite says.

</domain>

<decisions>
## Implementation Decisions

### The Report Line Type

- **The negative type property is asserted as a conditional type inside the passing build** — never
  a second tsconfig, never a `@ts-nocheck` harness. Phase 6 established this precedent for exactly
  this situation and verified it the right way: it widened `CasOp` to include `Fetch` and confirmed
  TS2322 fired at the assertion plus TS2741 on the host map. Criterion 1's phrase "a test file
  asserting the compile failure exists" is satisfied by that assertion living in a real file that
  `tsc` checks on every build — and unlike a separate harness, it cannot silently stop running.

- **Source tuples are `(documentHash, boxPath, value)` with `boxPath` a dotted string** matching the
  dialect's own field names (`box1InterestIncome`). Greppable, round-trips through JSON without
  needing a schema for paths, and it reads the same in a run record as in source.

- **The rule reference is a required string naming the form line implemented** (e.g. `'1040 line
  2b'`). Required, not optional — a line that cannot say which rule it implements is exactly the
  untraceable line this phase exists to make unrepresentable.

- **Value is cents as `bigint`**, matching every other money value in the engine. No generic
  parameter: this is a money line, and a type variable here would only invite a `number` to appear
  somewhere downstream.

### The Anti-Hardcoding Audit

- **The numeric-literal audit runs on the program source text, in the same place SEC-02's specifier
  gate already runs.** The source text is already in hand at that point, and the two checks are the
  same kind of static reading of the same string. Adding a second pass elsewhere would mean two
  places that must agree about what the program's source is.

- **The literal audit is REPORTED, never refused.** Legitimate programs contain numeric literals —
  a bracket index, a zero, a scale. Criterion 3 asks only that the count be *visible to the user*.
  Criterion 4's *failure* is a different mechanism with a different job. Conflating them would
  either refuse honest programs or weaken the gate to a threshold nobody trusts.

- **The CAS-read count derives from the run record's existing `inputs[]`** — that field already is
  the observed read set, recorded by the handler from `interpret`'s actual reads. Introducing a
  second counter would create two sources of truth that can disagree, and the one that disagrees
  silently is the one a hardcoded program would exploit.

- **Zero observed CAS reads is an error result.** This is what actually kills
  `() => pure({ line16: 9137 })`. A report over stored documents that read nothing did not compute
  anything from them. It is the cheapest and most direct expression of the thesis, and it needs no
  heuristic and no threshold.
  **Noted risk, accepted:** this rejects any program that legitimately computes without reading a
  document. No such program exists in this project's scope — `fjs_run` executes report programs over
  stored documents, and a report with no sources is precisely what PROV-01 makes unrepresentable at
  the type level. If a legitimate zero-read use case ever appears, this rule is the thing to revisit,
  and it should be revisited deliberately rather than loosened under pressure from a failing test.

### The Perturbation Gate

- **It runs in proofs only, never on every `fjs_run` call.** Running every program twice doubles the
  cost of every report, and perturbing a stored taxpayer document in production to test the program
  that reads it is not acceptable at any price.

- **The perturbation is built by seeding documents, running, changing one box, and running again**,
  asserting the output moved — paired with a control asserting the hardcoded program's output does
  **not** move. The control is what makes the assertion about the gate rather than about a fixture
  that would have moved anyway.

- **`() => pure({ line16: 9137 })` is written verbatim as a proof fixture.** The requirement names
  this program specifically. A gate built for an adversary that is never actually run against it is
  a claim, not a proof — and this project has already shipped one bug that 185 proofs missed for
  exactly that reason.

- **The read count and literal count surface in `fjs_run`'s response envelope**, beside `resultHash`
  and `runHash`. Criterion 3 requires them visible to the user, and the envelope is where the user
  already looks.

### Scope and Wiring

- **`vnd.fjs.run` gains no new fields.** The read count is computable from `inputs[]`, which the
  record already carries. Widening a dialect that other phases depend on, for a value derivable from
  what it already stores, is what DOC-00's precedent says to defer until a real present need forces
  it.

- **Modules live at `fjs/report/line` and `fjs/report/audit`**, following the `fjs/tax/*` grouping
  Phase 8 established.

- **The existing `fjs_run` call in `fjs-run-integration.test.js` is extended to assert the new
  envelope fields.** No new MCP tool means no new entry for the runtime tool-coverage assertion —
  but the new fields are user-visible output and belong under real-process coverage.

### Claude's Discretion

- Final type and field names, and whether `fjs/report/line` and `fjs/report/audit` are one module or
  two.
- How the numeric-literal scan tokenizes (it need not be a full parser; it must not be fooled by a
  digit inside an identifier or a string).
- Which trivial computation the demonstration program performs, provided it reads at least one real
  stored document and its output moves when that document changes.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets

- `fjs/run/module.f.js` — the `vnd.fjs.run` dialect. `inputs[]` is already documented as populated
  **exclusively from `interpret`'s observed reads**, never from what the program declared. That
  invariant is what makes the read count trustworthy; read the module docstring before relying on it.
- `fjs/server/fjs_run/module.f.js` — `executeRun`, where the run record is written and the response
  envelope is built.
- `fjs/guest/materialize/module.f.js` — SEC-02's specifier gate, the established place where program
  source text is read and statically checked before `import()`. The literal audit belongs alongside it.
- `fjs/server/response/module.f.js` — `sizeGuard`, `previewBytes`, `guardBytes`. New envelope fields
  must not push a response past the 64KB guard.
- `fjs/tax/params`, `fjs/tax/table`, `fjs/tax/boundary` (Phase 8) — the module grouping convention
  this phase follows.

### Established Patterns

- A negative TYPE property is asserted as a conditional type **inside the passing build** and
  verified by deliberately widening the type to watch the error fire (Phase 6).
- Proofs are exported `proof` objects discovered by root `all.test.js`. **`node --test <file>` on a
  `.f.js` module is a documented fake pass** — only `npm test` is trustworthy.
- The phase gate counts **project-local** proofs via
  `node --test 2>&1 | grep -c '^✔ import("./fjs/'`. Baseline entering Phase 9: **240**.
- fjs's `assert`/`unwrap`/`match` throw **bare values, not `Error`s**. Never branch on
  `instanceof Error`.
- Under strict `tsc` with `noUncheckedIndexedAccess`, indexing an open map yields `T | undefined` —
  narrow once with a local + `assert`, never with `!` or a cast. Phase 8's plan-checker caught
  exactly this and it cost a revision round.

### Integration Points

- `fjs/server/fjs_run/module.f.js` — where the envelope gains the two counts.
- `fjs-run-integration.test.js` — the existing `fjs_run` call gains assertions on those fields.

### Working-Directory Hazard

`./functionalscript` is a git submodule. A `cd` into it **persists across later commands** and
silently redirects everything after it into the wrong repository — this already produced a false
"the build is broken" report once. Use absolute paths or `git -C`. Never `git add` that path.

</code_context>

<specifics>
## Specific Ideas

- The adversary program is written verbatim: `() => pure({ line16: 9137 })`. Not paraphrased, not
  described — written, run, and asserted to fail.
- The perturbation proof needs a control leaf. Without one, a green result cannot distinguish
  "the gate works" from "the fixture would have moved regardless."
- Zero reads is the kill condition. Not a literal-count threshold, not a heuristic — a program that
  read nothing computed nothing.

</specifics>

<deferred>
## Deferred Ideas

- Form 1040 semantics, line-16 dispatch, the scope guard — Phase 10 (TAX-03, TAX-05, TAX-06, TAX-16).
- `parameterSetHash` and program hash in the report output — Phase 14 (PROV-04).
- Re-running a pinned program reproducing the result byte-for-byte — Phase 14 (PROV-05).
- A second, non-tax report over the same documents — Phase 15 (PROV-08).

</deferred>
