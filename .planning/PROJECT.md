# Finance

## What This Is

A user uploads their financial documents to a personal CAS, then uses ChatGPT (or any
other MCP client) to compute tax and other financial reports over them.

The agent does **not** produce the numbers itself. It writes a FunctionalScript program
that computes the report, and the MCP server executes that program in content-addressable
space. The first acceptance target is a full line-by-line US 1040 (plus relevant
schedules) where every number traces back to the source document that produced it. Built
entirely in [FunctionalScript](https://github.com/functionalscript/functionalscript) on
top of the `fjs` CAS, Evo, and MCP modules.

Built for personal use — the authors' own taxes — while proving out fjs + CAS + Evo on a
demanding real-world workload.

## Core Value

**The report is a program, not an answer.** The agent emits FunctionalScript; the server
executes it as a pure function of `(documents, tax-year parameters) → report`.

This is what makes an LLM safe to put in front of tax math. A generated number is opaque
and unverifiable; a generated program is reviewable, re-runnable, diffable, and storable
in CAS alongside the result it produced. Reproducibility, traceability, cost-free re-runs
over hypothetical inputs, and reports beyond the 1040 all follow from that one property —
a new report is a new program, not new engine code.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] MCP server exposing finance tools over stdio, following the `fjs/mcp`
      `casMcpServer` pattern
- [ ] Store financial documents in CAS as Evo objects (subject + revision + snapshot)
- [ ] Store raw PDF statement bytes without parsing them
- [ ] Accept agent-supplied JSON as an extracted-document input — the settled v1
      ingestion path (agent vision reads the document → emits a `vnd.fjs.*` dialect →
      stored via `evo_add`)
- [ ] One common document base shared by every document type — `{ "dialect":
      "vnd.fjs.<name>", … }`, with `dialect` as the type discriminant, matched as an exact
      literal so structural validation alone rejects another type's blob (the
      `vnd.fjs.revision` precedent)
- [ ] One concrete type implemented first (e.g. `vnd.fjs.1099`) — a scheduling choice, not
      a format constraint. The base is designed for a family from the start; further types
      (W-2, 1099-DIV, …) land per `todo/plan.md` Week 3 without reopening it
- [ ] An OCR format — the intermediate the vision pass emits before it is narrowed into a
      specific document type (open question 3: stored artifact or transient step)
- [ ] Parse structured exports (CSV / OFX / QFX) — *not in the five-week plan*; retained
      as a requirement but unscheduled, since vision-to-dialect covers v1 ingestion
- [ ] Execute agent-authored FunctionalScript programs in content-addressable space —
      the MCP server runs the program, the agent does not compute reports directly
- [ ] Define Effects for CAS — the effect vocabulary an executed program may express
- [ ] Restricted runner: an `OperationMap` holding only whitelisted CAS/Evo operations,
      driven by `asyncRun` — a program requesting `fetch`/`readFile` finds no entry
- [ ] Unknown operations fail as a clean, reported error (`operation not permitted:
      fetch`), not the raw `TypeError` that `match` produces today
- [ ] An `fjs_run` MCP tool: `{ hash }` → read blob → `import()` → call entry point →
      interpret under the restricted runner → return the result
- [ ] Node (or another JavaScript engine) as the first script runner, replaceable by
      `fjs` later without changing the programs it runs
- [ ] Tax-year parameters (brackets, standard deduction, thresholds) stored as data,
      keyed by year — never hardcoded in the engine
- [ ] Compute a full line-by-line 1040 plus relevant schedules for a specified year
- [ ] Financial reports beyond the 1040, expressed as programs over the same documents
- [ ] Every computed line traceable to the CAS hash of its source document
- [ ] Support corrected source documents (e.g. amended 1099) as new revisions
- [ ] Support amended returns (1040-X) as a versioned revision chain
- [ ] Support user corrections to their own entries, preserving history
- [ ] Multi-year support — compute any year for which parameters and documents exist

### Out of Scope

- **PDF text extraction *in code*** — still out, and now permanently rather than
  "deferred." There is no PDF library in fjs and writing one (xref tables, object
  streams, FlateDecode, font encodings) would dominate v1. **Superseded in effect:**
  `todo/plan.md` settles OCR as *the agent's own vision* — it reads the document and
  emits structured JSON, which is stored back through CAS/Evo. So v1 does extract
  document content; no code we write parses a PDF to get it. This is what makes the
  "accept agent-supplied JSON as an extracted-document input" requirement central rather
  than a fallback.
- **"What if" scenario modeling as a named feature** — deferred to v2. Note that program
  execution largely dissolves this: a scenario is just another agent-authored program
  over branched inputs, so there may be nothing left to "build." v1 ships no scenario
  *feature*, but must not foreclose it (pure programs, parameters as data, scenarios as
  Evo branches).
- **Non-US tax jurisdictions** — one jurisdiction's rules are enough scope for v1.
- **Business / self-employment tax** (Schedule C, depreciation, quarterly estimates) —
  personal income tax only.
- **Multi-user / multi-client operation** — personal use, so no auth, tenancy isolation,
  or liability surface.
- **Filing or transmission** — the output is numbers to transcribe, not an e-filed
  return.

## Context

**Existing code.** The repo is a working FunctionalScript hello-world skeleton at commit
`89e1128`. All FunctionalScript source lives under `fjs/`; only two impure files sit at
the root:

```
index.js          — impure launcher: run(main) from functionalscript/fjs/effects/node/module.js
all.test.js       — Emergent Testing bootstrap for node --test
fjs/index.f.js    — pure main, typed as NodeProgram
fjs/proof.f.js    — a passing proof: assert(2 + 2 === 4)
todo/plan.md      — settled decisions, five-week critical path, open questions
fjs/todo/implement-mcp-server.md — Week 1 Track A spec (not implemented)
.github/workflows/node.js.yml — CI: npm ci && npm test on Node 26
```

`npm test` passes (1 test, exit 0), `tsc` is clean, and both `npm start` and
`npm run fjs-start` print `hello world!`.

**The goal statement.** The `## Goal` section of README.md is the authoritative statement
of intent that this document is built from. It was rewritten in PR #1 "Update the MVP."
(commit `c7a9cce`) and now reads:

> The main target is that a user was able to upload their documents to a personal CAS and
> then using ChatGPT (or other clients) to compute tax and other financial reports.
>
> MVP:
> - store financial documents in CAS (using Evo objects, see FunctionalScript repo).
> - parse documents
> - compute taxes for specified year.
> - ChatGPT (or other agent) shouldn't form financial reports directly, it should create a
>   FunctionalScript program that computes the report. It means the MCP server should
>   support execution of FunctionalScript in content-addressable space. As the first
>   implementation, the MCP server will use Node (or other JavaScript engine) to execute
>   the scripts. Later, `fjs` should replace it. We should also define Effects for CAS

The prior goal (commit `a03b454`) framed the deliverable as an MCP server that stores,
parses, and computes. The rewrite keeps all of that and adds the load-bearing constraint
that the agent authors *programs* rather than answers — which is why "execute
FunctionalScript in CAS" is now a first-class MVP requirement above, and why "other
financial reports" became reachable without new engine code.

The same PR added the conventions section to README.md — since renamed
`## Conventions And Technical Principles`; those conventions are folded into Constraints
below and into AGENTS.md, which is what agents actually load.

**Where the planning lives.** Three documents, deliberately not overlapping — keep each
fact in exactly one of them:

| Document | Owns |
|---|---|
| `.planning/PROJECT.md` (this file) | *Why* and *what* — intent, requirements, constraints, decisions, success criteria |
| [`todo/plan.md`](../todo/plan.md) | *When* — settled decisions, the five-week critical path, and the project-level open questions |
| [`fjs/todo/implement-mcp-server.md`](../fjs/todo/implement-mcp-server.md) | *How*, for Week 1 Track A — server assembly, `fjs_run`, the restricted runner, what to reuse from fjs |

Both `todo/` documents arrived in PR #1 (`f57fd50`). Where this file and `todo/plan.md`
disagreed on execution safety, `todo/plan.md` won — it is the more concrete and more
honest account, and Constraints below were corrected to match it.

**Known upstream fjs gap.** `match` has no notion of a partial `OperationMap`:
`map[command]` is `undefined` for an absent operation, so it throws
`TypeError: map[command] is not a function` rather than reporting a refusal. That makes
the single most likely failure mode — an agent writing a program that reaches for the
network — undebuggable. Per AGENTS.md this is reported upstream rather than worked around
locally, once the shape is known.

**What fjs already provides.** `functionalscript@0.40.0` ships most of the
infrastructure, so the finance-specific work is domain logic, not plumbing:

| Module | What it gives us |
|---|---|
| `fjs/protocol/mcp` | MCP session state machine (`mcpStep`), RTTI-validated tool registry (`toolEntry`, `fromRegistry`), JSON-RPC responses |
| `fjs/protocol/mcp/stdio` | `stdioTransport` — read→parse→dispatch→write loop, testable against mock stdin/stdout with no real process |
| `fjs/cas` | `FileCas` — streaming SHA-2 content store, 128 KiB chunks, lock-free staging writes |
| `fjs/cas/evo` | Evo — subjects and revision heads (a DAG) cached over the CAS |
| `fjs/mcp` | `casMcpServer(home)` — a complete working seven-tool CAS+Evo MCP server (`cas_add`, `cas_get`, `cas_list`, `evo_list`, `evo_head`, `evo_revision`, `evo_add`), with its tool registries at `fjs/mcp/cas` and `fjs/mcp/evo`. **This is the template to follow.** |
| `fjs/media/revision` | The `vnd.fjs.revision` blob format and its validation |
| `fjs/effects` | `Effect<O,T>` as data plus the runners that interpret it — `effects/node` (real process), `effects/mock` (`run(o)`, honoring only the effects handler `o` implements) |

**What is genuinely net-new:** document parsers (as of 0.40.0 fjs `media` carries `json`,
`html`, `revision`, `nix`, and `type` — no financial formats exist), the report/tax
computation programs, per-year tax parameter data, the finance-specific MCP tools and
RTTI schemas, and the script execution path.

**`fjs/media/type` is worth a look before building ingestion** — it arrived in 0.40.0 and
nothing in the plan accounts for it yet. It does magic-byte MIME detection: `detect` is a
pure table lookup over a `Vec`'s leading bytes returning a MIME type or `null`, with
`detectStream` as the byte-accepting streaming counterpart. The ingestion path currently
assumes the agent asserts what an uploaded document is; this would let the server derive
it from the bytes instead — relevant to storing raw PDF bytes and to deciding which
`vnd.fjs.*` dialect a document should narrow into. Being a pure table lookup, it also
costs nothing to adopt. (`fjs/media/nix`, the other 0.40.0 addition, is a Nix expression
eDSL and is irrelevant here.)

**Program execution is half-built already.** There is no "evaluate this FunctionalScript
source" module in fjs — `fjs/fsc` covers compile workflows and `fjs/djs` transpiles data,
so loading agent-authored source is net-new work. But the *interpretation* half exists:
`fjs/effects/mock`'s `run(o)` walks an effect chain and honors only what the handler `o`
implements. A CAS-only runner is that same shape with a CAS handler — which is why the
sandbox constraint below is structural rather than something to bolt on.

**How Evo models the domain.** A subject is the identity of a mutable thing; a revision
is an immutable blob `{dialect, subject, parents[], snapshot, generation, archived?}`
whose `snapshot` is a CAS hash pointing at actual content. Heads are revisions not
referenced as anyone's parent, computed as `hashes − parents` at read time. So a document
becomes: content → CAS → revision naming that hash as `snapshot`. Corrections become new
revisions with the old as parent. Versioned, deduplicated, tamper-evident document
history comes for free — the right shape for tax records, where an amended 1099 should
supersede rather than overwrite.

## Constraints

- **Layout**: All FunctionalScript source lives under `fjs/`. The only exceptions are
  root-level entry points that must be plain impure JS — `index.js` and `all.test.js`
  today, plus the MCP server launcher that `claude mcp add` will invoke
  (`fjs/todo/implement-mcp-server.md`). Keep that set as small as possible: anything
  beyond a launcher belongs in a `.f.js` module the launcher calls.
- **Language**: All source is FunctionalScript (`.f.js`) — pure, no side effects, ESM.
  Effects are data (`Effect<O,T>` descriptions interpreted by a runner), never direct
  actions.
- **Upstream-first** (from AGENTS.md, and load-bearing for how this project is built):
  - Use FunctionalScript itself as much as possible rather than writing new plain-JS/TS
    logic.
  - If fjs is missing something *generic* — a reusable helper, not app-specific logic —
    add it to this repo as a separate file/directory so it can be moved upstream into
    FunctionalScript later. This directly shapes where parsers and numeric helpers live.
  - If you find a bug in FunctionalScript, **tell the user** so it can be fixed and a new
    fjs version released. Do not silently work around it here.
- **Typing**: JSDoc comments only, validated by TypeScript 7 with `noEmit`. No `.ts`
  source files. `tsconfig.json` is maximally strict (`strict`,
  `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noUnusedLocals`,
  `noUnusedParameters`, `noPropertyAccessFromIndexSignature`, `verbatimModuleSyntax`).
  Per AGENTS.md: do not relax flags to silence errors.
- **Testing**: fjs Emergent Testing. Any `.f.js` may export a `proof` — a tree of
  zero-argument functions; a leaf passes if it doesn't throw, and leaves under a `throw`
  key must throw. `all.test.js` auto-discovers them, so `node --test` picks up new tests
  with no registration. Helpers in `functionalscript/fjs/asserts`: `assert`, `assertEq`,
  `assertNotNullish`, `todo` — upstream, not a directory in our own `fjs/`.
- **Style**: Never use `l` as an identifier. Import types with a top-level
  `@import { Name } from '...'` JSDoc, not inline `@type {import('...')...}`. Never nest
  steps — bind each link to its own name so chains read top-to-bottom; use `historyStep`
  when a later link needs an earlier link's value.
- **Execution boundary** — governs the *effect layer only*. A FunctionalScript program
  returns a description of its effects; `match` dispatches each one through an
  `OperationMap` (`fjs/effects/module.f.js:282`). Restricting a program is therefore
  exactly "build a map holding only the permitted operations" — a program asking for
  `fetch` or `readFile` finds no entry, so nothing needs intercepting or patching. The
  v1 map holds CAS/Evo operations only.
- **`import()` is outside that boundary — a known, accepted v1 hole.** `todo/plan.md`
  settles on unrestricted Node via `import()`, which executes a blob's top-level module
  body with full Node privileges *before* any effect is interpreted. An empty operation
  map does not stop a module that calls `fs.rmSync` at module scope. Genuine
  FunctionalScript modules are side-effect-free by construction, but nothing verifies
  that for an arbitrary blob out of CAS. Accepted for Week 1 **only** because the sole
  user is trusted and local; `todo/plan.md` Week 5 revisits it, most plausibly by parsing
  the source with `djs/parser` before importing. This must not silently become the
  permanent design — the input chain is *untrusted document → LLM → generated program →
  execution*, so if the audience ever widens past one local user, it is a blocker, not a
  cleanup task.
- **Specs and issues live in `todo/` directories** (from README `## Conventions And Technical Principles`):
  specifications, issues, bug reports, and feature requests are MarkDown files under
  `**/todo/`, next to the code they concern — e.g. `./fjs/todo/implement-mcp-server.md`.
- **New formats follow the `revision` pattern** (from README `## Conventions And Technical Principles`): JSON
  encoding plus a dialect tag. Name the dialect `vnd.fjs.<name>`; the media type derives
  from it as `application/vnd.fjs.<name>+json` (see `fjs/media/revision/module.f.js`,
  where `dialect = 'vnd.fjs.revision'` yields `application/vnd.fjs.revision+json`).
- **Dependencies**: `functionalscript` only. Adding a third-party parser would break the
  purity model and the FunctionalScript constraint. Corollary from README `## Conventions And Technical Principles`:
  we own fjs, so a missing generic capability is a reason to release a new fjs version —
  not a reason to add a dependency or write app-specific glue here.
- **Correctness**: Tax math must be exact. Beware floating-point on currency and the
  `Number.isSafeInteger` bound that `fjs/media/revision` already enforces on generations.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| The agent emits a program, not an answer | A generated number is opaque and unverifiable; a generated program is reviewable, re-runnable, diffable, and storable in CAS next to its result. This is what makes an LLM acceptable in front of tax math (PR #1) | — Pending |
| MCP server executes FunctionalScript in content-addressable space | Follows from the above — something must run the emitted program, and running it over CAS keeps inputs, program, and output in one addressable space (PR #1) | — Pending |
| Node first as the script runner, `fjs` later | Ships the capability without waiting on `fjs` to become self-hosting; the runner is swappable because the programs it runs are unchanged either way (PR #1) | — Pending |
| Executed programs get CAS/Evo effects only | fjs effects are data interpreted by a runner, so the runner *is* the sandbox — an effects-only whitelist costs nothing to build because `match` already dispatches through an `OperationMap` | — Pending |
| Unrestricted Node `import()` accepted for v1, despite the above | `import()` runs a blob's module body before any effect is interpreted, so the whitelist does not cover it. Taken knowingly: sole user is trusted and local, and closing it properly (source validation or Worker isolation) would dominate Week 1 (`todo/plan.md`) | — Pending, revisit Week 5 |
| stdio only, single local user | No HTTP, no auth, no hosting, no per-user isolation — the deployment model that makes the `import()` limitation tolerable (`todo/plan.md`) | — Pending |
| OCR is the agent's own vision, not an engine | The agent reads the document and emits structured JSON, stored back through CAS/Evo. No OCR library, no third-party service — consistent with the functionalscript-only dependency rule (`todo/plan.md`) | — Pending |
| Our own MCP server composing fjs registries | `casToolRegistry` + `evoToolRegistry` + ours, via exported `fromRegistry`/`mcpStep`/`stdioTransport`. Everything needed is already exported, so no fork and no fjs release is required to iterate | — Pending |
| Tax engine is a pure function of documents + year parameters | Makes what-if additive rather than a rewrite; makes every computation reproducible and testable as a `proof` | — Pending |
| Tax-year parameters stored as data, not code | Adding a future year costs no engine changes; supports multi-year out of the box | — Pending |
| Scenarios modeled as Evo branches (v2), designed for in v1 | A what-if is a revision branched off a head that never merges; multiple heads *are* competing scenarios, with provenance for free — nothing new to build later if v1 models documents this way | — Pending |
| All three amendment kinds use one mechanism | Corrected source docs, 1040-X returns, and user corrections are all "new revision, old as parent" — one model, not three | — Pending |
| Traceability is a storage-layer property | If every extracted value carries the CAS hash it came from, line-by-line provenance is structural, not a reporting feature bolted on afterward | — Pending |
| Follow `fjs/mcp` `casMcpServer` as the server template | A complete working CAS+Evo MCP server already exists in the dependency; the finance server is that pattern plus domain tools | — Pending |
| Specs/issues as MarkDown in `**/todo/` | Keeps the specification next to the code it describes, versioned with it, readable by both humans and agents with no tracker to sync (README `## Conventions And Technical Principles`) | — Pending |
| New formats use the `vnd.fjs.<name>` dialect convention | One naming rule for every format we add, matching `vnd.fjs.revision`, so media types derive mechanically as `application/vnd.fjs.<name>+json` (README `## Conventions And Technical Principles`) | — Pending |
| Defer PDF parsing; store raw bytes in v1 | No PDF library in fjs; writing one would dominate v1 and blocks nothing else — storage and versioning can be proven end-to-end without it | — Pending |
| Defer what-if to v2 | v1 must first compute one real 1040 correctly; scenarios are worthless on top of an unverified engine. Revisited after PR #1: with agent-authored programs, a scenario may need no feature work at all — the deferral now covers only shipping it as a named, tested capability | — Pending |
| Generic helpers written to be upstreamable into fjs | AGENTS.md policy: anything reusable and non-app-specific belongs in its own file/directory so it can move into FunctionalScript later. Affects where parsers and numeric utilities live from day one | — Pending |
| git-flow with `main`/`develop`, protected by a pre-commit hook | Direct commits to `main` and `develop` are blocked; all work goes through `feature/*`, `release/*`, `hotfix/*`, `bugfix/*` | — Pending |

## Success Criteria

All four must hold:

1. **Matches a real filed return.** Feed it a year already filed; every 1040 line
   matches. This is the acceptance test.
2. **Works conversationally.** Point an agent at the MCP server, hand it documents in
   chat, ask "what do I owe for 2025?" — it works end to end without touching code.
3. **Every number traces to a source.** Any 1040 line walks back to the exact document
   and field it came from, via CAS hashes.
4. **The answer came from a program.** The agent produced FunctionalScript, the server
   executed it, and re-running that stored program over the same documents reproduces
   the same report exactly. No line of the report is an LLM-authored number.

## Open Questions

Owned by [`todo/plan.md`](../todo/plan.md) — listed here only where they affect this
document's claims. Do not answer them here; answer them there and update this file.

**Numbering is `todo/plan.md`'s and must stay that way.** Both that file and
`fjs/todo/implement-mcp-server.md` cite questions by number ("see open question 2",
"plan open question 5"), so renumbering here silently breaks references in documents this
file does not own.

1. **Tax scope** — jurisdiction, year, forms, and whether the output is authoritative or a
   reviewed estimate. The only genuinely unbounded item; it drives Weeks 2–3 and decides
   how much of the "Compute a full line-by-line 1040" requirement is really v1.
2. **Evo subject model** — one subject per uploaded document with parsed representations
   as revisions, and what the naming scheme is. Annoying to change once documents exist,
   so it wants deciding before Track B ships. Cited by `todo/plan.md` Week 1 step 7.
3. **OCR format** — is the raw vision output a stored artifact in its own right, or a
   transient step? The auditability rationale in Core Value argues for storing it: it is
   the record of what the model actually saw, before interpretation.
4. **Deadline and definition of done** — whether an external date drives the five weeks.
5. **`fjs_run` result disposition** — returned inline, or written back to CAS and answered
   with a hash? **Blocking for the execution boundary above:** it decides whether the
   whitelist includes CAS *writes*. Writing results back is what would make Success
   Criterion 3 (every number traces to a source) structural rather than best-effort.
   Cited three times by `fjs/todo/implement-mcp-server.md` — the most referenced open
   question in the corpus, and the one to answer first.

Additionally, owned by [`fjs/todo/implement-mcp-server.md`](../fjs/todo/implement-mcp-server.md)
and decidable during implementation — recorded here so they are not lost, not to be
answered here:

- Does `fjs_run` take arguments for the program beyond the hash?
- Reuse `casConfig`, or declare our own server identity?
- Is the program's entry point `main` (matching `fjs run`), or something narrower that
  cannot express a long-running effect like `forever`?

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-08-03 — reconciled with `todo/plan.md` and
`fjs/todo/implement-mcp-server.md` after PR #1 merged (`78f8f55`). Corrected the execution
boundary: the `OperationMap` whitelist governs effects only, and `import()` runs outside
it. Recorded OCR-by-vision, which supersedes the PDF-parsing deferral in practice.*
