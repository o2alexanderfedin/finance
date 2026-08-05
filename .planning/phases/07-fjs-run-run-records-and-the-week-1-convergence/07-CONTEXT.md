# Phase 7: `fjs_run`, Run Records, and the Week 1 Convergence - Context

**Gathered:** 2026-08-04
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous) — 4 areas proposed, all accepted as recommended

<domain>
## Phase Boundary

This phase closes `todo/plan.md`'s Week 1 finish line: an agent reads a dialect's field
names, authors a program against them, stores it, runs it, and gets back a figure computed
from real stored documents — with a permanent record of what was actually read.

It delivers exactly two new MCP tools and one new document dialect:

| Deliverable | Requirement |
|---|---|
| `finance_schema(dialect)` | MCP-06 |
| `fjs_run { hash, args?, subject?, parents? }` | EXEC-08 |
| `vnd.fjs.run` record, written by the **handler** | EXEC-10, PROV-03 |
| Bounded result envelope with an explicit size check | EXEC-11 |
| Total error capture as tool-level `errorResult` | EXEC-12 |

**Out of scope, and named so planning does not drift into them:** tax parameters
(MCP-07, Phase 8), traceable report lines (PROV-02, Phase 9), `finance_documents_list`
(MCP-08, T2), `fjs_check` (MCP-09, T3), and the `pinned`-only reproducibility acceptance
(EXEC-13/PROV-05, T2). This phase writes the `pinned` flag; it does not yet gate on it.

The three components this phase composes already exist and are proven:
`fjs/exec`'s `interpret` (Phase 3, observed read set + step budget),
`fjs/guest`'s frozen `CasOp` ABI (Phase 6), and
`fjs/guest/materialize`'s specifier gate + hash-derived filename + `import_` effect (Phase 6).
Phase 7 is the composition and the handler around them — not a re-litigation of any of the three.

</domain>

<decisions>
## Implementation Decisions

### `fjs_run` input contract and pinning

- **Pinning is a snapshot taken by the handler, once, at call time.** `subject` and
  `parents` resolve to concrete revision hashes before the program runs; the guest's
  `evoHead` reads that snapshot rather than live Evo. This is the direct reading of
  EXEC-08 — "Evo heads resolve at read time, so a program that resolves its own heads is
  not reproducible." The alternative (forbidding `evoHead` in pinned runs) was rejected:
  it would make the pinned and unpinned vocabularies differ, and the frozen ABI from
  Phase 6 must stay one vocabulary.
- **`args` is `readonly string[]`.** This is not a new choice — `fjs/guest`'s `Report`
  typedef already froze it as `(ctx: GuestCtx) => (args: readonly string[]) => Effect<CasOp, T>`.
  Widening to arbitrary JSON here would contradict a Phase 6 decision.
- **Unpinned runs are allowed and are recorded as `pinned: false`.** PROV-03 (T1) requires
  the flag on every record; EXEC-13 (T2) is what later makes only pinned runs count toward
  reproducibility. Refusing unpinned runs now would implement a T2 requirement early and
  block the ordinary "just run it" path an agent needs during authoring.
- **The program is loaded through the Phase 6 path, unchanged:** `hash` → CAS blob →
  `checkSpecifiers` → `programFileName` → `loadProgram` via the `import_` effect. Inline
  source is not accepted — a program that was never stored has no hash to record, which
  would make PROV-03 unsatisfiable for that run.

### The `vnd.fjs.run` record

- **It is a dialect, following the Phase 5 precedent exactly:** tag `vnd.fjs.run`, media
  type `application/vnd.fjs.run+json` derived mechanically, the dialect as an exact literal
  in the schema, validation split structural (RTTI) / semantic. It is not a bespoke record
  shape sitting outside the dialect system.
- **`inputs[]` carries `{ command, payload }` entries taken straight from `interpret`'s
  observed reads** (`Read = readonly [string, readonly unknown[]]`). Success criterion 2 is
  the whole point: the record must be provably *observed*, not declared, which means the
  only legitimate source is the interpreter's accumulated read set. A program's own
  citation list must never reach this field.
- **`status` is `'ok' | 'error'`**, mirroring `Result`'s two arms. A richer enum
  (`refused`/`crashed`/`budget`) was rejected as premature: the distinguishing detail
  belongs in the error message, and a two-arm status keeps the record aligned with the
  `Result` the interpreter actually returns.
- **Every numeric value in the record is a decimal string, never a JSON number.** This is
  the EXACT-05 wire rule from Phase 4 — fjs's JSON `Primitive` has no `bigint`, and a JSON
  number is an IEEE 754 double before any arithmetic happens.

### Result envelope and the size check

- **Two named constants, both well clear of the 128 KiB stdio line cap:** an 8 KiB inline
  preview inside a 64 KiB total response guard. A single threshold set at the cap itself
  was rejected — it leaves no headroom for the JSON-RPC envelope around the payload, which
  is exactly how the silent `-32603` gets reached.
- **The response always carries `{ resultHash, runHash, preview, truncated }`.** Uniform
  shape regardless of size, so an agent parses one thing.
- **The size check is explicit and happens before `writeResponse`**, producing
  `result too large; stored at <hash>` — criterion 5's wording, verbatim. Inheriting the
  transport's silent `-32603` is the specific failure this requirement exists to prevent.
- **The result is always written to CAS, even when it is small enough to inline.** The hash
  is then always citable, and the run record's `result hash` field is never conditional.

### Error taxonomy and `finance_schema`

- **Never branch on `instanceof Error`.** fjs's `assert` and `unwrap` throw the **bare
  value** — `typeof e === 'string'`, `e instanceof Error === false`, `e.message` undefined.
  STATE.md records this as a live constraint that already bit this project once. Caught
  values are read directly and rendered with `String(v)`.
- **Every failure class becomes a tool-level `errorResult`:** a non-`Error` throw from the
  guest, a missing hash, an import failure, a specifier refusal, a step-budget exhaustion.
  The process never crashes and the connection never drops (EXEC-12, criterion 4).
- **A failed run still gets a run record, with `status: 'error'`.** Provenance that covers
  only successes is not provenance — the failed run read documents too, and that read set
  is exactly what a later investigation needs.
- **`finance_schema(dialect)` serializes the dialect module's own exported schema const**
  (e.g. `oneZeroNineNineIntSchema`), never a hand-maintained field list. A hand-written list
  is a second source of truth that drifts from the schema the validator actually uses, which
  would defeat MCP-06's purpose of letting the agent stop guessing.

### Two gaps research surfaced, resolved with the user before planning

Research (`07-RESEARCH.md`) found three architecture gaps that Phase 6 left open. Two needed a
decision because they revise or extend work already marked complete; both were verified against
the code before being put to the user, and both are now locked.

**1. `guestCtx` gains combinators. `CasOp` does not.**

Phase 6 shipped `guestCtx` with exactly four operation constructors. EXEC-07's own requirement
text specifies more than that — *"A `ctx` object carries the vocabulary — **combinators**,
read-only operation constructors, money helpers, `args`."* The combinators and money helpers were
never delivered. That is a Phase 6 under-delivery, not Phase 7 scope creep, and it blocks
success criterion 1: a program that sums interest across *every* stored 1099-INT must sequence
one read per document, and with zero imports and no combinator it has nothing to sequence with.

**The security property is untouched, and this is the reason the decision is safe.** `match`
gates on `CasOp` — the *operation* union. `step` and `pure` are pure composition; they never
become a `command` and never reach `match`. `CasOp[0]` stays exactly
`'casRead' | 'evoList' | 'evoHead' | 'evoRevision'`, so the type-level pin
`Assert<Equal<CasOp[0], …>>` still holds unchanged, and `casWrite`/`evoAdd` remain absent
(criterion 3).

What must change is narrower than it first appears — two runtime proofs in `fjs/guest`:

| Proof | Why it breaks | Required revision |
|---|---|---|
| `vocabularyIsFrozenAtFour` | asserts `Object.keys(guestCtx)` equals `casOpNames` | Assert the **command** subset equals `casOpNames`, and assert the combinator set separately. The four-command freeze must remain a live assertion, not be weakened into "at least four". |
| `everyConstructorDispatches` | iterates every ctx entry calling `construct('x')`; `step` is not unary and is not an operation | Iterate the command subset only. |

The rejected alternative — leaving ctx at four and letting each guest hand-roll its own `step`
from `Effect`'s raw shape — is *possible* (an `Effect` is a `Pure` thunk or a plain
`{command, payload, continuation}` object, both constructible without imports) but was rejected:
it couples every stored program to `Effect`'s internals, which is exactly what a frozen ABI
exists to hide, and stored programs are frozen against the convention in force when they were
written.

Scope note: add the combinators EXEC-07 names and the money helpers it names. Do not add
anything else to `ctx` opportunistically — every addition is frozen for every future program.

**2. Materialized programs go in a dedicated, gitignored subdirectory.**

Research found that **nothing in the repo has ever written a CAS blob's bytes to a real file**.
`loadProgram` assumes the file already exists at `programPath(home)(hash)`, and every Phase 6
proof exercised it under `fjs/effects/node/virtual` with a `JsModule` fixture. The write step is
new work in this phase, and in production `home` is the project root — so hash-named `.mjs` files
would land in the repo, untracked by `.gitignore`.

Decision: materialize into a dedicated subdirectory under the project-local CAS home, and add an
explicit `.gitignore` entry for it. The repo root stays clean and the ignore rule is deliberate
rather than incidental. The OS temp directory was rejected because it discards the project-local
store property Phase 2 established on purpose.

**3. The host `OperationMap` must be synchronous — no decision needed, but it constrains design.**

`interpret`'s `OperationMap<O, Return<O>>` requires plain synchronous handlers, never
`Effect`-returning ones. The host map for the four commands therefore cannot be thin wrappers
around `Cas`/`Evo`'s effect-returning methods. It must be closures over data already resolved by
ordinary `step`/`pure` effects **before** `interpret` runs — which is the same snapshot the
pinning decision above already requires. The two constraints agree; build one snapshot and use it
for both.

### Claude's Discretion

- Module placement and file naming within `fjs/` for the new handler and dialect, following
  the existing `fjs/document/<dialect>/module.f.js` and `fjs/server/module.f.js` conventions.
- The exact numeric values of the preview/guard constants may move if a proof shows the
  envelope overhead differs materially from the estimate — the *named constant* and the
  *explicit pre-write check* are the locked parts, not the specific byte counts.
- Internal decomposition: whether the run-record writer, the size check, and the error
  mapper are separate exported functions or one handler, provided each is independently
  proof-tested.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets

- `fjs/exec/module.f.js` — `interpret(map)(effect)` returns
  `Result<[T, readonly Read[]], string>`. The `Read[]` accumulator is already the observed
  read set criterion 2 requires; nothing new is needed to satisfy it. `stepBudget` is
  `10_000` and non-termination already returns a value rather than hanging.
- `fjs/guest/module.f.js` — the frozen ABI: `CasOp` (four read-only commands), `guestCtx`,
  `casOpNames`, and the `Report` typedef. `Assert<Equal<CasOp[0], …>>` pins the vocabulary
  at type level, so criterion 3 (`casWrite`/`evoAdd` absent) is already enforced by `tsc`,
  not only by `grep`.
- `fjs/guest/materialize/module.f.js` — `checkSpecifiers`, `programFileName`,
  `loadProgram`. All three are proof-tested under `fjs/effects/node/virtual` with no
  filesystem. The specifier gate now also refuses backtick/template-literal specifiers.
- `fjs/server/module.f.js` — `financeMcpHandlers` composes registries as a flat array via
  `fromRegistry([...casToolRegistry, ...evoToolRegistry, casRefreshTool])`. `casRefreshTool`
  is the worked example of a locally-defined `toolEntry` with an `okResult`. The module
  header already reserves the `fjs_run` seam as a comment.
- `fjs/document/1099int/module.f.js` — exports `dialect`, `mediaType`,
  `oneZeroNineNineIntSchema`, `checkReferences`, `validate`. This is the shape
  `finance_schema` reads from, and the template the `vnd.fjs.run` dialect should follow.
- `fjs/document/base/module.f.js` — `base(dialect)` for the common document envelope.
- `fjs/exact/module.f.js` — `centsFromString` / `centsToString` for the decimal-string wire
  boundary the run record needs.

### Established Patterns

- Errors as values: `Result` from `fjs/types/result`, never exceptions across a module
  boundary. `interpret` already converts `match`'s bare-string throw into an `error(...)`.
- Effects, not raw calls: `import_`, `read`/`write` from `fjs/effects/memory`, `step`/`pure`
  composition — this is what keeps the whole path proof-testable with no filesystem.
- Proofs live in the same file as an exported `proof` object; sub-tests may be returned as
  a closure from a leaf and are registered by the emergent-testing framework.
- Every module header states *why*, including rejected alternatives — this is the house
  style across all six completed phases.

### Integration Points

- `financeMcpHandlers` — the new `fjs_run` and `finance_schema` entries concatenate into
  the existing registry array. The header comment already anticipates this.
- `financeConfig` — server identity and protocol version, unchanged by this phase.
- The `fileCas(sha256)(home)` / `evo(...)(cacheKey)` pair — the handler's write path for
  the result blob and the run record.
- `fjs/media` dialect detection — `vnd.fjs.run` becomes another dialect; note the upstream
  dialect-registry parameterization landed in functionalscript#1428, so the local
  `fjs/todo/upstream-media-dialect-registry.md` may be resolvable during this phase.

</code_context>

<specifics>
## Specific Ideas

- Criterion 2's proof must be **adversarial**, not incidental: run a program that reads a
  document it does **not** cite, then assert the read still appears in `inputs[]`. A proof
  where the program's citations happen to match its reads proves nothing about observation.
- Criterion 5 asks for the exact string `result too large; stored at <hash>`. Treat it as a
  contract, not a paraphrase.
- Criterion 3 says `grep` confirms the absence of `casWrite`/`evoAdd`. The `Assert<Equal<…>>`
  from Phase 6 is the stronger check and already exists — keep both, since the criterion
  names `grep` explicitly.
- Criterion 4 enumerates three failure classes (non-`Error` throw, missing hash, import
  failure). Each deserves its own proof leaf rather than one combined loop, so a failure
  localizes.

</specifics>

<deferred>
## Deferred Ideas

- **`fjs_check(hash)`** (MCP-09, T3) — a smoke check that imports a program and confirms it
  exports `main` without running it. Explicitly an agent-productivity feature with no
  security value; must not be described as a security control when it lands.
- **`finance_documents_list`** (MCP-08, T2) — enumeration with dialect/year/subject.
- **Reproducibility acceptance on pinned runs** (PROV-05, EXEC-13, T2) — including the
  adversarial "insert an amended revision between two runs" check. This phase writes the
  `pinned` flag that later work reads.
- **Resolving `fjs/todo/upstream-media-dialect-registry.md`** now that functionalscript#1428
  has parameterized the dialect set upstream — a cleanup that is not required for any Phase 7
  criterion.

</deferred>
