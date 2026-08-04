# Plan

## Settled Decisions

These constrain everything below.

| Area | Decision |
|---|---|
| Transport / audience | stdio only, single local user. No HTTP, no auth, no hosting. Confirmed by the answer to open question 7 — several people each run their own personal CAS and server; one deployment serving several users is a separate design effort, not this project. |
| Execution engine | Unrestricted Node via `import()`. The *runner* interprets a whitelisted operation set (CAS/EVO); non-whitelisted ops are refused. |
| Import-time safety | Accepted limitation. A blob's top-level module body runs with full Node privileges before any effect is interpreted. Tolerable only because the sole user is trusted and local. |
| OCR | The agent's own vision. It reads the document and emits structured JSON, which is stored back through CAS/Evo. No OCR engine, no third-party service. |
| Server location | Our own MCP server in this repo, composing FunctionalScript's exported registries. No fork, no FJS release needed to iterate. |
| Why programs, not answers | Correctness and auditability. LLM arithmetic is unreliable; a stored program is deterministic, reviewable, and re-runnable. |
| Deadline | Five weeks, externally driven ([#16](https://github.com/fjs-dev/finance/issues/16#issuecomment-5171851184)). This is what makes the scope questions below real rather than academic. |
| Definition of done | Users add raw documents to CAS via their AI agent and ask for reports. A report already held for a given year and user is **updated as a new Evo revision**, not rewritten — so reports are versioned exactly like documents. Each tax year may carry different rules and forms. |
| Scope discipline | Deliberately a small subset of reports and documents, narrowed *during* development rather than fixed up front, with a running list of what is covered and what is not. Coverage grows incrementally as real situations appear. |
| Not in these five weeks | A dynamic system where the AI itself adds new document types. The aim, but explicitly beyond this project. |
| Domain facts go to a specialist | Where a tax rule is unverified — worksheet line ordering, Tax Table band widths, 1099-R / SSA-1099 box lists, MAGI add-back lists — the answer is a **list of questions for our tax specialist and advisor**, not our own reading of IRS PDFs ([#16](https://github.com/fjs-dev/finance/issues/16) B1–B4). |
| Vetted script utilities in CAS | Report programs draw on a shared library of utilities published into CAS, rather than each agent authoring tax logic from scratch — the answer to "determinism makes a wrong *method* reproducible too" ([#16](https://github.com/fjs-dev/finance/issues/16) D1). Publishing predefined scripts across CAS systems is its own task. |

Consequence worth designing for deliberately: the program *and* its inputs are both content-addressed, so every report can cite `programHash` + input hashes and be exactly reproducible. Auditability being the driver, this should be part of `fjs_run`'s contract rather than an accident.

## Week 1 (First Working Prototype)

We should find a critical path and implement it. Some elements:

- Running the MCP (local, stdio).
- Parsing documents and storing parsed information in the MCP.
  - OCR format
  - Specific document type. For example, `vnd.fjs.1099`.
- MCP should be able to run FunctionalScript with the access to CAS/EVO implemented as effects.

### Critical path

Two independent tracks. The execution spine carries nearly all the technical risk; ingestion is mostly format design and can proceed in parallel.

**Track A — execution spine** (spec: [fjs/todo/implement-mcp-server.md](../fjs/todo/implement-mcp-server.md))

1. **Our MCP server entry point.** Compose `casToolRegistry` + `evoToolRegistry` + our new registry via the exported `fromRegistry` / `mcpStep` / `stdioTransport`. Registers with `claude mcp add`.
2. **CAS/EVO effects.** Define the *semantic* vocabulary a stored program may express — `casRead`, `casList`, `evoHead`, … — **not** `FileCasOperation`, which is `Rm | WriteBytes | Rename | Mkdir | …` and would hand the program raw filesystem mutation. `Cas<O>` is generic in its underlying operation set exactly so the filesystem stays server-side inside the handlers. This step is the sandbox; step 3 only enforces it.
3. **The restricted runner.** A **total** `ToAsyncOperationMap` over that vocabulary, driven by `asyncRun` — total over a narrow set, not a wide set with entries removed. Detection of an out-of-vocabulary command is fjs's since 0.41.0 (`match` does an own-property lookup and throws the command name), so our part is catching it at the `fjs_run` boundary and reporting `operation not permitted: <command>`. Note the throw is a bare **string**, not an `Error`. See [`fjs/todo/restricted-runner-operation-map.md`](../fjs/todo/restricted-runner-operation-map.md).
4. **The `fjs_run` tool.** `{ hash }` → read blob → `import()` → call its entry point → interpret its effect under the restricted runner → return the result.

Step 3 is the real work; 1 and 4 are assembly over existing FunctionalScript exports.

**Track B — document ingestion**

5. **The document base format**, as a `vnd.fjs.*` JSON dialect following the [Revision](https://github.com/functionalscript/functionalscript/blob/main/fjs/media/revision/README.md) precedent. Every document type shares one base — `{ "dialect": "vnd.fjs.<name>", … }` — with `dialect` as the type discriminant, exactly as `vnd.fjs.revision` does it. Week 1 implements one concrete type on that base (e.g. `vnd.fjs.1099`); designing the base for the family up front is what lets Week 3 add types without reopening it.

   Each type's fields beyond `dialect` are an **fjs RTTI schema**, mirroring `revisionSchema` in `fjs/media/revision`: schema first, TypeScript type derived from it as `Ts<typeof schema>`, and a separate semantic check for the refinements RTTI cannot express structurally (as `checkReferences` sits beside `revisionSchema`). Since an RTTI `Struct` is just a string map of types, the base is spread into each type — `{ ...base('vnd.fjs.1099'), ...fields }` — rather than needing schema inheritance the type system doesn't have.

   **Money fields are strings, never JSON numbers.** fjs's JSON value model types a number as rtti `Number`, i.e. a JS double, so `"1234.56"` written as a JSON number is already lossy before any arithmetic happens. Every currency, percentage, and interest-rate field is therefore rtti `string`, decoded to an exact value by the semantic check — the same split `vnd.fjs.revision` uses for `hash`. Settling this in the Week 1 base is what keeps it from becoming a migration later: it is a wire-format decision, and stored documents are immutable.

   Note that fjs's JSON *tokenizer* is not the problem — its `NumberToken` carries both the literal text and an exact `BigFloat` mantissa/exponent. Exactness is lost one layer up, where `media/json`'s `Unknown` flattens a number to a JS double. Worth knowing before anyone proposes "just parse the number more carefully."

6. **An exact-decimal module**, since step 5 is unimplementable without one. Parse from string, compare, add, subtract, multiply by a rate, and round explicitly where a form demands it. fjs has no decimal or rational type — `types/bigfloat` is `[bigint, number]` with only `multiply`/`decToBin`, and `prime_field` is modular arithmetic for crypto — but `types/bigint` is well stocked, so bigint-backed minor units with rates as explicit numerator/denominator pairs needs nothing new from fjs. Per the AGENTS.md staging rule, write it as a self-contained module under `fjs/` so it can move upstream later; it is generic, not finance-specific.
7. **The OCR format** — the intermediate the agent's vision pass emits, before it is narrowed into a specific document type. Open question: whether this is a distinct stored artifact or just a transient step.
8. **Ingestion loop.** Agent reads the document by vision → emits the dialect → stores via `evo_add` under the agreed subject model (see open question 2).

**Convergence:** a program run through `fjs_run` reads documents stored by Track B and returns a computed figure — e.g. total interest across every stored 1099-INT. That is the Week 1 finish line.

If the week runs short, Track A is what must land: without it the project has no thesis, whereas parsed documents with no way to compute over them are just JSON in a store.

## Week 2

Goal: **a report program produces a correct figure over real parsed documents.**

Scope depends on the tax question below. The shape does not: the agent authors a FunctionalScript program, it runs under the restricted runner, and the output is reproducible from stored hashes.

Start with a single unambiguous aggregate before anything involving brackets, deductions, or filing status.

## Week 3

Goal: **breadth in documents.** Additional `vnd.fjs.*` types on the Week 1 base (W-2, 1099-DIV, …), and the multi-document, multi-form aggregation the real question requires. Whatever the tax scope decision demands. If a new type forces a change to the base, that is a signal the base was under-designed in Week 1 — worth noting rather than absorbing silently.

## Week 4

Goal: **the full path works on the user's own documents.**

- Upload → parse → store → ask a question → program authored, stored, run → answer, with citing hashes.
- Reproducibility check: re-running a stored program against the same input hashes yields the same figure.
- Error paths: malformed documents, refused operations, programs that throw, missing hashes.

## Week 5 (Technical Debt)

- Upstream whatever has stabilized into FunctionalScript (per AGENTS.md staging rule) — most likely the CAS effects, and `fjs_run` if its shape has settled.
- **Work the `fjs/todo/upstream-*.md` queue.** Every FJS bug or gap worked around locally has a file there stating the gap, the workaround, and the intended upstream fix; this is where they get fixed upstream, released, and the local workarounds deleted. Open at the start of Week 1: [`upstream-media-dialect-registry.md`](../fjs/todo/upstream-media-dialect-registry.md) (blocks `fjs/media` detection of our document types; may be wanted as early as Week 3). Closed: [functionalscript#1419](https://github.com/functionalscript/functionalscript/pull/1419), `match` dispatching through the prototype chain — **fixed in 0.41.0**, which this repo now uses, so no local guard is needed.
- Revisit execution safety: validating source as genuine FunctionalScript before `import()`, and/or Worker isolation with hard limits. Week 1 deliberately defers both.
- Whatever the first four weeks accumulated.

## Open Questions

Proposed defaults below are suggestions, not decisions.

Related: [issue #16](https://github.com/fjs-dev/finance/issues/16) is the register of open
questions and unverified assumptions from the research pass behind #14 — scope/schedule
tension, unverified domain facts, and thin-evidence assumptions. It is a different list
from this one (that one is *research* assumptions, this one is *design* decisions), and
answering question 4 there answered it here.

1. **Tax scope.** Jurisdiction, tax year, and which forms? Is the output authoritative, or an estimate the user reviews? The only genuinely unbounded item in the plan, and it drives Weeks 2–3 entirely. *Proposed default: US federal, TY2025, W-2 and 1099-INT/DIV only, explicitly a reviewed estimate — narrow enough to finish, real enough to be useful.*
2. **Evo subject model.** Is each uploaded document its own subject, with parsed representations as successive revisions? What is the naming scheme — user-facing (`doc/2025/1099-int/chase`), content-derived, or otherwise? Blocks Week 1 Track B, and is annoying to change once documents exist.
3. **OCR format.** Is the raw vision output a stored artifact in its own right (auditable: what the model actually saw, before interpretation), or a transient step that only the narrowed `vnd.fjs.*` document persists from? The auditability rationale argues for storing it.
4. ~~**Deadline and definition of done.**~~ **Answered** in [issue #16](https://github.com/fjs-dev/finance/issues/16#issuecomment-5171851184): the deadline is **five weeks**, externally driven. Minimal definition of done — users add raw documents to CAS through their AI agent, then ask for reports; when CAS already holds a report for that year and user, the agent **updates** it as a new Evo revision rather than writing a fresh one; each tax year may carry different rules and forms. Scope is deliberately a small subset of reports and documents, narrowed during development rather than fixed up front, with a running list of what is covered and what still needs implementing. A dynamic system where the AI adds new document types is the eventual aim but **out of scope for these five weeks**. See the Settled Decisions table above; the "multiple users" part of it is resolved in question 7.
5. **`fjs_run` result disposition.** Return the result inline, or write it back to CAS (possibly as an Evo revision) and return its hash? Writing it back gives a permanent audit trail and suits the stated rationale; returning inline is simpler and lets `fjs_run` stay read-only over CAS.
6. **`fjs_run` entry point convention.** What does a stored report program export, and with what signature? FunctionalScript names entry points by role — `proof` for tests, `main` for Node CLI programs (`(options) => Effect<NodeOp, number>`) — so a report program is a third role. Reusing `main` buys CLI runnability for debugging, but its signature returns an exit code, takes CLI options we have no use for, and is typed over `NodeOp`, which includes `Fetch`/`Http`/`Fs`/`Forever` — the very operations the restricted runner denies. *Proposed default: a distinct name with a signature shaped `(args) => Effect<CasOp, T>`, so the whitelist is expressed in the type rather than only enforced at runtime.* Downstream of question 5, which fixes `T` and whether writes are in `CasOp`. Expensive to change later: every program already stored in CAS follows whatever convention was current when it was written. Detail in [fjs/todo/implement-mcp-server.md](../fjs/todo/implement-mcp-server.md).
7. ~~**Single user, or multiple?**~~ **Answered: target a single user.** A design for multiple users is being worked on separately and is not part of this project. This is the cheap reading of the two below, so the Settled Decisions above are confirmed rather than contradicted: *Transport / audience* stays "stdio only, single local user", per-user isolation and auth stay out of v1, and the `import()` limitation stays a Week 5 revisit rather than becoming a v1 blocker. The "that year **and user**" phrasing in [issue #16](https://github.com/fjs-dev/finance/issues/16#issuecomment-5171851184) is therefore a subject-naming detail, feeding question 2 — not multi-tenancy.

   The two readings, kept because the distinction is what makes the answer load-bearing:
   - **Several users, each with their own personal CAS and their own stdio server.** ← *this one.* "Personal CAS" already implies one per person. Nothing changes.
   - **One deployment serving several users.** Would have pulled per-user isolation, authentication, and a real answer to import-time execution into v1 scope.

   **Does not settle the `import()` justification.** "Single local user" answers *who may connect*; it does not establish that unrestricted `import()` is safe, because the untrusted party in this system is the **document**, not the user (see `.planning/research/PITFALLS.md` Pitfall 1). The deferral still needs re-grounding on schedule grounds with explicit compensating controls — tracked separately in `.planning/ROADMAP.md`. Do not read this answer as closing that.

   Since multi-user is an active design effort rather than a rejected idea, v1 should avoid foreclosing it — the same posture as scenario modeling: no multi-user *feature*, but no decision that would have to be undone.
