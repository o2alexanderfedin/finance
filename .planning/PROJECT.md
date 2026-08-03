# Finance

## What This Is

An MCP server over content-addressable storage that lets an AI agent store financial
documents, parse them, and compute US personal income tax for a specified year. The
output is a full line-by-line 1040 (plus relevant schedules) where every number traces
back to the source document that produced it. Built entirely in
[FunctionalScript](https://github.com/functionalscript/functionalscript) on top of the
`fjs` CAS, Evo, and MCP modules.

Built for personal use — the authors' own taxes — while proving out fjs + CAS + Evo on a
demanding real-world workload.

## Core Value

The tax engine is a **pure function of `(documents, tax-year parameters) → 1040`**.
Reproducibility, traceability, and cost-free re-runs over hypothetical inputs all follow
from that one property.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] MCP server exposing finance tools over stdio, following the `fjs/cas/mcp`
      `casMcpServer` pattern
- [ ] Store financial documents in CAS as Evo objects (subject + revision + snapshot)
- [ ] Store raw PDF statement bytes without parsing them
- [ ] Parse structured exports (CSV / OFX / QFX)
- [ ] Parse tax forms (1099, W-2, K-1) from structured input
- [ ] Accept agent-supplied JSON as an extracted-document input
- [ ] Tax-year parameters (brackets, standard deduction, thresholds) stored as data,
      keyed by year — never hardcoded in the engine
- [ ] Compute a full line-by-line 1040 plus relevant schedules for a specified year
- [ ] Every computed line traceable to the CAS hash of its source document
- [ ] Support corrected source documents (e.g. amended 1099) as new revisions
- [ ] Support amended returns (1040-X) as a versioned revision chain
- [ ] Support user corrections to their own entries, preserving history
- [ ] Multi-year support — compute any year for which parameters and documents exist

### Out of Scope

- **PDF text extraction** — deferred to a later milestone. v1 stores raw PDF bytes in
  CAS; nothing parses them. There is no PDF library in fjs, and writing one (xref
  tables, object streams, FlateDecode, font encodings) is a project in its own right
  that would dominate v1.
- **"What if" scenario modeling** — deferred to v2. v1 must be *architected* for it
  (pure engine, parameters as data, scenarios as Evo branches) so it is additive rather
  than a rewrite, but no scenario feature ships in v1.
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
.github/workflows/node.js.yml — CI: npm ci && npm test on Node 26
```

`npm test` passes (1 test, exit 0), `tsc` is clean, and both `npm start` and
`npm run fjs-start` print `hello world!`.

**The goal statement.** The `## Goal` section of README.md is the authoritative statement
of intent that this document is built from (commit `a03b454`). It reads:

> The main target is an MCP server that interacts with CAS. The agent that uses the MCP
> server should be able to: store financial documents in CAS (using Evo objects, see
> FunctionalScript repo), parse documents, compute taxes for specified year.

**What fjs already provides.** `functionalscript@0.39.0` ships most of the
infrastructure, so the finance-specific work is domain logic, not plumbing:

| Module | What it gives us |
|---|---|
| `fjs/mcp` | MCP session state machine (`mcpStep`), RTTI-validated tool registry (`toolEntry`, `fromRegistry`), JSON-RPC responses |
| `fjs/mcp/stdio` | `stdioTransport` — read→parse→dispatch→write loop, testable against mock stdin/stdout with no real process |
| `fjs/cas` | `FileCas` — streaming SHA-2 content store, 128 KiB chunks, lock-free staging writes |
| `fjs/cas/evo` | Evo — subjects and revision heads (a DAG) cached over the CAS |
| `fjs/cas/mcp` | `casMcpServer(home)` — a complete working seven-tool CAS+Evo MCP server (`cas_add`, `cas_get`, `cas_list`, `evo_list`, `evo_head`, `evo_revision`, `evo_add`). **This is the template to follow.** |
| `fjs/media/revision` | The `vnd.fjs.revision` blob format and its validation |

**What is genuinely net-new:** document parsers (fjs `media` knows only `json`, `html`,
and `revision` — no financial formats exist), the tax computation engine, per-year tax
parameter data, and the finance-specific MCP tools and RTTI schemas.

**How Evo models the domain.** A subject is the identity of a mutable thing; a revision
is an immutable blob `{dialect, subject, parents[], snapshot, generation, archived?}`
whose `snapshot` is a CAS hash pointing at actual content. Heads are revisions not
referenced as anyone's parent, computed as `hashes − parents` at read time. So a document
becomes: content → CAS → revision naming that hash as `snapshot`. Corrections become new
revisions with the old as parent. Versioned, deduplicated, tamper-evident document
history comes for free — the right shape for tax records, where an amended 1099 should
supersede rather than overwrite.

## Constraints

- **Layout**: All FunctionalScript source lives under `fjs/`. Only `index.js` and
  `all.test.js` stay at the root, and they are the only impure files.
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
  with no registration. Helpers in `fjs/asserts`: `assert`, `assertEq`,
  `assertNotNullish`, `todo`.
- **Style**: Never use `l` as an identifier. Import types with a top-level
  `@import { Name } from '...'` JSDoc, not inline `@type {import('...')...}`. Never nest
  steps — bind each link to its own name so chains read top-to-bottom; use `historyStep`
  when a later link needs an earlier link's value.
- **Dependencies**: `functionalscript` only. Adding a third-party parser would break the
  purity model and the FunctionalScript constraint.
- **Correctness**: Tax math must be exact. Beware floating-point on currency and the
  `Number.isSafeInteger` bound that `fjs/media/revision` already enforces on generations.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Tax engine is a pure function of documents + year parameters | Makes what-if additive rather than a rewrite; makes every computation reproducible and testable as a `proof` | — Pending |
| Tax-year parameters stored as data, not code | Adding a future year costs no engine changes; supports multi-year out of the box | — Pending |
| Scenarios modeled as Evo branches (v2), designed for in v1 | A what-if is a revision branched off a head that never merges; multiple heads *are* competing scenarios, with provenance for free — nothing new to build later if v1 models documents this way | — Pending |
| All three amendment kinds use one mechanism | Corrected source docs, 1040-X returns, and user corrections are all "new revision, old as parent" — one model, not three | — Pending |
| Traceability is a storage-layer property | If every extracted value carries the CAS hash it came from, line-by-line provenance is structural, not a reporting feature bolted on afterward | — Pending |
| Follow `fjs/cas/mcp` `casMcpServer` as the server template | A complete working CAS+Evo MCP server already exists in the dependency; the finance server is that pattern plus domain tools | — Pending |
| Defer PDF parsing; store raw bytes in v1 | No PDF library in fjs; writing one would dominate v1 and blocks nothing else — storage and versioning can be proven end-to-end without it | — Pending |
| Defer what-if to v2 | v1 must first compute one real 1040 correctly; scenarios are worthless on top of an unverified engine | — Pending |
| Generic helpers written to be upstreamable into fjs | AGENTS.md policy: anything reusable and non-app-specific belongs in its own file/directory so it can move into FunctionalScript later. Affects where parsers and numeric utilities live from day one | — Pending |
| git-flow with `main`/`develop`, protected by a pre-commit hook | Direct commits to `main` and `develop` are blocked; all work goes through `feature/*`, `release/*`, `hotfix/*`, `bugfix/*` | — Pending |

## Success Criteria

All three must hold:

1. **Matches a real filed return.** Feed it a year already filed; every 1040 line
   matches. This is the acceptance test.
2. **Works conversationally.** Point Claude at the MCP server, hand it documents in chat,
   ask "what do I owe for 2025?" — it works end to end without touching code.
3. **Every number traces to a source.** Any 1040 line walks back to the exact document
   and field it came from, via CAS hashes.

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
*Last updated: 2026-08-03 after initialization*
