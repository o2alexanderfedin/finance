# Phase 7: `fjs_run`, Run Records, and the Week 1 Convergence - Research

**Researched:** 2026-08-04
**Domain:** In-repo composition — no external/domain research per ROADMAP ("Research: Not needed"). This document maps the exact existing code this phase must compose, verified by reading it, and surfaces three load-bearing gaps found during that reading.
**Confidence:** HIGH for all in-repo signatures (all `[VERIFIED: read source]`); MEDIUM/LOW flagged explicitly for architecture decisions this phase must newly make.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### `fjs_run` input contract and pinning

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

#### The `vnd.fjs.run` record

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

#### Result envelope and the size check

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

#### Error taxonomy and `finance_schema`

- **Never branch on `instanceof Error`.** fjs's `assert` and `unwrap` throw the **bare
  value** — `typeof e === 'string'`, `e instanceof Error === false`, `e.message`
  undefined. STATE.md records this as a live constraint that already bit this project once.
  Caught values are read directly and rendered with `String(v)`.
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

### Claude's Discretion

- Module placement and file naming within `fjs/` for the new handler and dialect, following
  the existing `fjs/document/<dialect>/module.f.js` and `fjs/server/module.f.js` conventions.
- The exact numeric values of the preview/guard constants may move if a proof shows the
  envelope overhead differs materially from the estimate — the *named constant* and the
  *explicit pre-write check* are the locked parts, not the specific byte counts.
- Internal decomposition: whether the run-record writer, the size check, and the error
  mapper are separate exported functions or one handler, provided each is independently
  proof-tested.

### Deferred Ideas (OUT OF SCOPE)

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
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| EXEC-08 | An `fjs_run` MCP tool taking `{ hash, args?, subject?, parents? }` — pinned inputs, not just a program hash. | Existing Code Map (`fjs/guest/materialize`'s hash→blob→specifier→import path, unchanged); Critical Finding covers what's still missing (materialization write, synchronous host map) to make this actually runnable end to end. |
| EXEC-10 | The tool handler writes the result and run record to CAS — not the program; `casWrite`/`evoAdd` never in the guest whitelist. | Existing Code Map confirms the grep half already passes today (verified, zero hits); `fjs/cas/module.f.js`'s single-chunk `cas.write` pattern (from `casRefreshTool`'s proof) is the reuse target for both writes; Validation Architecture's criterion-3 section gives the behavioral proof design. |
| EXEC-11 | `fjs_run` returns result and run-record hashes plus a bounded inline preview, with an explicit size check before writing the response. | Upstream Surfaces Verified traces the real 128 KiB cap to `fjs/types/bigint`'s `maxLength`; Pattern 2 (parameterized size-guard) and Validation Architecture's criterion-5 section give the concrete, cheap-to-test design, including the STATE.md-precedented ordering proof. |
| EXEC-12 | Total error capture — non-`Error` throws, missing hashes, import failures — surfaced as a tool-level `errorResult`, never a process crash. | `errorResult` already exists upstream (`fjs/protocol/mcp/module.f.js:141`) — Don't Hand-Roll table; `assert`/`unwrap`'s bare-throw semantics verified in Upstream Surfaces; Validation Architecture's criterion-4 section gives three separate proof-leaf designs reusing Phase 3/6's own escape-hatch and missing-module techniques. |
| PROV-03 | A `vnd.fjs.run` record — program hash, observed inputs, result hash, status, pinned flag — written by the tool handler on every run. | `fjs/document/1099int/module.f.js` + `fjs/document/base/module.f.js` give the exact dialect template to mirror; `fjs/exec`'s `Read`/`Interpreted` types are the only legitimate source for `inputs[]`; Validation Architecture's criterion-2 section gives the adversarial (observed-vs-declared) proof design. |
| MCP-06 | `finance_schema(dialect)` returns the RTTI schema for a document dialect. | `toJsonSchema` already exists upstream (`fjs/media/json/schema/module.f.js`) and is already used by `fromRegistry` for the identical purpose — Don't Hand-Roll table and Upstream Surfaces Verified; Assumption A4 covers the dialect→schema lookup mechanism. |
</phase_requirements>

## Summary

Phase 7 is pure composition of five already-built pieces (`fjs/exec`'s `interpret`, `fjs/guest`'s frozen `CasOp`/`guestCtx`, `fjs/guest/materialize`'s specifier gate, `fjs/server`'s registry assembly, and upstream fjs 0.41.0's MCP protocol layer) plus one new dialect (`vnd.fjs.run`). Reading every one of those files line-by-line surfaced three things the CONTEXT.md/ROADMAP text does not make explicit and that materially change what the plan must build:

1. **`errorResult` already exists upstream** (`functionalscript/fjs/protocol/mcp/module.f.js:141`) — criterion 4 does NOT require writing a new error-result helper, only using the existing one consistently and mapping every failure class into it.
2. **There is no existing step that writes a CAS blob's bytes to a real file on disk.** `fjs/guest/materialize`'s `loadProgram` takes `source` only to run `checkSpecifiers` against it — it assumes the file is *already* materialized at `path` before `import_` runs. Phase 6's own proofs never exercise this against a real filesystem (only `fjs/effects/node/virtual`, where a `JsModule` fixture stands in for the file). Phase 7 must add this write step, and it writes directly into `home` (the CAS home passed to `financeMcpServer`) as `<hash>.mjs` — which is *not* covered by the existing `.gitignore` (only `/.cas` is ignored).
3. **`interpret`'s `OperationMap<O, Return<O>>` requires plain, synchronous handler functions** (`(a: string) => string`, never `(a: string) => Effect<...>`) — verified from the type signature. This means the real (non-test-fixture) `casRead`/`evoList`/`evoHead`/`evoRevision` host implementations the tool handler builds for a live run **cannot** be thin wrappers around `Cas<O>.read`/`Evo<O>.revision`, which are themselves `Effect`-returning. They must be closures over data already resolved via a prior, ordinary effect step (`step`/`pure`) before `interpret` is ever called. This is a real design decision Phase 7 must make, not a detail Phase 6 settled.

There is also a fourth finding, arguably the most consequential for authoring a working Week-1 program at all: **the shipped `guestCtx` (`fjs/guest/module.f.js:96-101`) contains only the four `CasOp` constructors — no `step`/`pure` combinator and no money helper — even though REQUIREMENTS.md's own EXEC-07 text says ctx should carry "combinators… money helpers."** A zero-import program that must loop over an unknown number of stored 1099-INTs and sum their interest cannot idiomatically compose more than one dispatched command without *some* sequencing primitive. See "Critical Finding" below.

**Primary recommendation:** Treat this phase as five compositions plus three genuinely new mechanisms (disk materialization write, a synchronous-snapshot host map, and — pending confirmation — a ctx combinator addition), not as pure glue. Confirm the ctx-combinator gap with the user/discuss-phase before locking task granularity, since it revises a Phase 6 proof that is currently marked Complete.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|---|---|---|---|
| Program authoring (agent writes FJS source) | — (external, the LLM client) | — | Not this server's concern; only the wire contract (hash in, hash out) matters here |
| Program storage | API / Backend (CAS) | — | `cas_add`/`evo_add` tools already exist (Phase 2/5); `fjs_run` only *reads* the stored hash |
| Program materialization (CAS blob → real file) | API / Backend | Database/Storage (filesystem) | New in this phase — see Finding 2 above; must happen server-side, never in the guest |
| Program execution (`import()` + interpret) | API / Backend | — | `loadProgram` + `interpret`, both existing, both server-side; guest never gets FS/network access |
| Guest read-only data access (`casRead`/`evoList`/`evoHead`/`evoRevision`) | API / Backend (synchronous snapshot) | Database/Storage (source of the snapshot) | `interpret` requires synchronous handlers (Finding 3); the actual store I/O to build that snapshot is a Backend-tier effect step run *before* interpretation |
| Result + run-record persistence | API / Backend | Database/Storage (CAS) | EXEC-10/PROV-03: **the tool handler**, never the guest — `CasOp` has no write op |
| Response size bounding | API / Backend | — | Must run before the MCP/stdio transport layer ever sees the payload (EXEC-11) |
| Schema introspection (`finance_schema`) | API / Backend | — | Reads an existing in-process schema const; no separate tier involved |

## Existing Code Map (verified by reading)

### `fjs/exec/module.f.js` — `interpret` [VERIFIED]

- `export const stepBudget = 10_000` (line 107).
- `export const interpret = map => effect => …` (line 137), typed `<O extends Operation, T>(map: OperationMap<O, Return<O>>) => (effect: Effect<O, T>) => Interpreted<T>`.
- `Interpreted<T> = Result<readonly [T, readonly Read[]], string>` where `Read = readonly [string, readonly unknown[]]` (lines 87-96).
- The loop (lines 137-158): on a `Pure` node (`typeof e === 'function'`) it forces `e()` and returns `ok([value, reads])`. On a `Do` node it calls `match(map)(e)`, `assert`s `result[0] === 'cont'`, appends `[command, payload]` to `reads` **after** the dispatch succeeds (a refused op is never recorded as read), then continues with `e = result[2](result[1])`. A caught throw is `assert`ed to be a `string` and converted to `error(refusalMessage(...))` — **never re-thrown, never wrapped in `Error`**.
- `refusalMessage(command, map) = \`operation not permitted: ${command}; permitted: ${Object.keys(map).join(', ')}\`` (line 81) — this exact wording is already the actionable-refusal text; Phase 7 doesn't need a new one, it needs to route this string into `errorResult`.
- **Criterion 2's exact mechanism**: `reads` is populated purely by what `interpret` actually dispatches through `match`, independent of anything the effect chain "declares." This is already proven in isolation by `proof.readSetReflectsActualDispatch` (line 184) — Phase 7's own adversarial proof (see Validation Architecture) must repeat this shape against a *materialized, imported* program and the *persisted* `vnd.fjs.run` record, not just the in-process `Read[]`.
- `OperationMap<O, Return<O>>` (imported type) pins every handler's return type to the operation's own declared return (`Return<O> = F<O>[1]`, a plain value type, e.g. `string`) — **not** `Effect<…, string>`. This is Finding 3 above; see "Critical Finding" section.

### `fjs/guest/module.f.js` — the frozen ABI [VERIFIED]

- `CasOp = CasRead | EvoList | EvoHead | EvoRevision` (line 65), all `string -> string`, JSON-carrying.
- `guestCtx = { casRead, evoList, evoHead, evoRevision }` (lines 96-101) — **exactly these four keys, nothing else.** `casOpNames = ['casRead', 'evoList', 'evoHead', 'evoRevision']` (line 111).
- `Report<T> = (ctx: GuestCtx) => (args: readonly string[]) => Effect<CasOp, T>` (line 119) — confirms `args` is a separate curried parameter, not a ctx member.
- The type-level pin: `Assert<Equal<CasOp[0], 'casRead' | 'evoList' | 'evoHead' | 'evoRevision'>>` (line 144) — this only constrains the **operation name union**, not `guestCtx`'s own key set.
- The **runtime** pin that *does* constrain `guestCtx`'s key set is `proof.vocabularyIsFrozenAtFour` (line 171-174): `assertEq(Object.keys(guestCtx).join(','), casOpNames.join(','))`. This is an exact-equality assertion. **If Phase 7 adds a non-operation member to `guestCtx` (e.g. `step`, `pure`, a money helper), this existing proof breaks** and must be deliberately revised (e.g., to a subset check) — this is not a hypothetical, it is the direct consequence of the Critical Finding below.
- Criterion 3's `grep` target: `grep -n "casWrite\|evoAdd" fjs/guest/module.f.js fjs/guest/materialize/module.f.js` returns nothing today — verified by reading both files in full. No new code is needed to make criterion 3's grep pass; it already passes. What Phase 7 adds is the *proof* that the handler (not the guest) performed the writes — see Validation Architecture.

### `fjs/guest/materialize/module.f.js` — specifier gate, filename, load [VERIFIED]

- `checkSpecifiers: (allowed: readonly string[]) => (source: string) => Result<string, string>` (line 94) — regex-based, refuses any specifier not in `allowed` and refuses *all* backtick/template specifiers unconditionally (lines 61-106). For a stored report program, `allowed` is `[]` (empty) — Success Criterion 2's "zero imports."
- `programFileName: (hash: string) => string` = `` `${hash}.mjs` `` (line 123).
- `programPath: (home: string) => (hash: string) => string` = `join(home, programFileName(hash))` (line 134) — **a direct child of `home`, not of `home/.cas`.** In production, `home` is the same path passed to `financeMcpServer`/`index.f.js`'s launcher (the repo root, per `fjs/index.f.js` line 8's comment). This means every real `fjs_run` call would materialize a `<hash>.mjs` file **directly in the project root**.
- `loadProgram: (allowed) => (path) => (source) => Effect<Import, Result<Module, string>>` (line 152). Its body (lines 152-161): runs `checkSpecifiers(allowed)(source)` and, if clean, does `step(import_(path), imported => …)`. **It never writes `source` to `path`.** It assumes the file at `path` already exists. This is Finding 2 — confirmed by reading the entire file (353 lines); no `writeFile`/`writeBytes` call appears anywhere in it, and a repo-wide grep (`grep -rn "writeFile\|writeBytes" fjs/ --include=*.f.js`) returns zero hits outside `fileCas`'s own internal staging logic.
- The Phase 6 proof (`underVirtual.cleanProgramImportsAndRuns`, line 275) works because `fjs/effects/node/virtual`'s `import_` doesn't read bytes from a real file at all — it invokes a `JsModule` (a plain closure) already sitting in the virtual `root` at that path (`fjs/effects/node/virtual/module.f.d.ts` lines 12-16). **No proof anywhere in this codebase exercises a real disk write + real `import()` round trip** — that mechanism does not exist yet.

### `fjs/server/module.f.js` — registry assembly, worked example [VERIFIED]

- `financeMcpHandlers = home => cacheKey => fromRegistry([...casToolRegistry(...), ...evoToolRegistry(...), casRefreshTool(...)])` (line 116) — the seam Phase 7 concatenates into (module header at lines 26-33 explicitly reserves it).
- `casRefreshTool` (line 98) is the exact worked example of a locally-defined `toolEntry(name, description, inputRtti, handle)` with `okResult`. Note its `handle` is `() => step(buildCache(cas), newCache => step(write(cacheKey, newCache), () => pure(okResult('refreshed'))))` — a plain `step`/`pure` chain, no error path modeled (it can't fail in a user-visible way). `fjs_run`'s handler needs the same shape but with an `errorResult` branch at every failure point.
- `financeConfig`: `{ serverInfo: { name: 'finance-mcp', version: '0.0.0' }, capabilities: { tools: {} }, protocolVersion: '2025-11-25' }` (line 129) — unchanged by this phase.
- Proof pattern worth copying directly: `casRefresh.seedInvisibleUntilRefreshed` (lines 354-417) shows exactly how to seed CAS content bypassing the tool layer, then drive multiple `tools/call` batches against the *same* threaded `virtual` `State`, carrying `memoryValues`/`memoryNext` forward across batches while resetting `stdout`/`stderr` per batch. This is the template for Phase 7's own multi-step proofs (store program → store documents → call `fjs_run` → read back the run record).

### `fjs/document/1099int/module.f.js`, `fjs/document/base/module.f.js` — dialect shape [VERIFIED]

- `base: <D extends string>(dialect: D) => { readonly dialect: D }` (base/module.f.js line 45) — spread first into every dialect schema so RTTI reports `dialect` as the first failing field on a mismatch.
- `oneZeroNineNineIntSchema` (1099int/module.f.js line 65): `{ ...base('vnd.fjs.1099int'), payerTin: string, recipientTin: string, accountNumber: string, taxYear: number, formRevision: string, corrected: option(true), box1InterestIncome: option(string), box2EarlyWithdrawalPenalty: option(string), box3UsSavingsBondsAndTreasuryInterest: option(string), box4FederalIncomeTaxWithheld: option(string), box6ForeignTaxPaid: option(string), box8TaxExemptInterest: option(string), payerName: option(string), recipientName: option(string) }`. **This is the exact field name the Week-1 program sums: `box1InterestIncome`, a decimal-string, absent-able (blank ≠ zero).**
- `dialect = 'vnd.fjs.1099int'`, `mediaType = 'application/vnd.fjs.1099int+json'` — mechanical derivation to copy for `vnd.fjs.run`.
- `checkReferences` (line 122) is the template for `vnd.fjs.run`'s own semantic checks (e.g., non-empty `programHash`, every money-shaped field re-parseable via `fjs/exact`).
- Other dialects with the same shape, for `finance_schema`'s lookup table: `fjs/document/ocr/module.f.js` exports `ocrSchema`; `fjs/document/w2/module.f.js` exports `w2Schema` (line 89); `fjs/document/medical_expenses/module.f.js` exports `medicalExpensesSchema` (line 77). All four confirmed by grep.

### `fjs/exact/module.f.js` — decimal-string boundary [VERIFIED]

- `centsFromString: (s: string) => bigint` = `parse(centsScale)` where `centsScale = 2` (lines 24-32).
- `centsToString: (n: bigint) => string` = `format(centsScale)` (line 45).
- No new logic needed; a Week-1 report sums `centsFromString` outputs as bigints and formats the total via `centsToString` for the decimal-string wire rule (EXACT-05).

## Upstream fjs 0.41.0 Surfaces Verified

All read directly from `node_modules/functionalscript` (version confirmed `0.41.0` via `package.json`).

### `fjs/protocol/mcp/module.f.js` [VERIFIED]

- **`errorResult` already exists** (line 141): `export const errorResult = (text) => ({ ...okResult(text), isError: true })`. `okResult` (line 134): `text => ({ content: [{ type: 'text', text }] })`. **Do not write a local error-result helper — this is the exact tool-level `errorResult` criterion 4 asks for.** It is already used internally by `toolEntry`'s own argument-validation branch (line 124: `pure(errorResult(\`invalid arguments: ${r.message}\`))`).
- `toolEntry: <T extends Type, O extends Operation>(name, description, inputRtti: T, handle: (args: Ts<T>) => Effect<O, ToolsCallResult>) => ToolEntry<O>` (module.f.d.ts line 168) — validates `args` against `inputRtti` before calling `handle`, so `fjs_run`'s own `{ hash, args?, subject?, parents? }` input schema gets free structural validation (a malformed call never reaches the handler body).
- `fromRegistry: <O extends Operation>(registry: readonly ToolEntry<O>[]) => McpHandlers<O>` (line 194) — unchanged usage.
- `McpHandlers<O>`, `ToolEntry<O>`, `ToolsCallResult` types confirmed (module.f.d.ts lines 139-154).

### `fjs/protocol/mcp/stdio/module.f.js` — where the 128 KiB cap actually lives [VERIFIED]

- `stdioTransport`/`writeResponse` (lines 48-81) contain **no size constant themselves**. `writeResponse` calls `tryUtf8(stringifyJson(resp) + '\n')`; if that returns `null` (overflow), it falls back to `internalErrorResponse(resp.id)` (a `-32603` JSON-RPC error with the *original request's* `id`), and if even that overflows (pathological `id`), a final fallback with `id: null`.
- The actual cap traces to: `fjs/text/module.f.js`'s `tryUtf8` (line 29) → `fjs/types/bit_vec/module.f.js`'s `tryU8ListToVec` (line 296) → `fjs/types/bigint/module.f.js`'s `export const maxLength = 0x100000n` (line 183) — **`0x100000n` bits = 131,072 bytes = exactly 128 KiB.** This is a bit-length cap on constructing any single `Vec`, not something specific to stdio; it is the same constant `fileCas`'s `chunkBytes`/`collectRead` respect (`fjs/cas/module.f.js` lines 30-33, 46-47, 54-55).
- **Confirms the criterion 5 rationale exactly**: an oversized `ToolsCallResult`'s JSON-RPC envelope, once it exceeds 128 KiB encoded, silently becomes a generic `-32603 Internal error` at the *transport* layer, carrying none of the "too large" information. Phase 7's own size check must happen inside the tool handler, strictly before the handler's return value is ever handed to `mcpStep`/`stdioTransport`, so that the `ToolsCallResult` text it returns is already small.

### `fjs/cas/module.f.js` / `fjs/cas/evo/module.f.js` [VERIFIED]

- `Cas<O>.write: <O1>(payload: List<O1, IoResult<Vec>>) => Effect<O | O1, IoResult<Vec>>` (module.f.d.ts line 32) returns the content hash as a `Vec` inside an `IoResult`. The `fjs/server/module.f.js` proof (`casRefresh.seedInvisibleUntilRefreshed`, lines 363-379) shows the exact pattern for writing a small in-memory blob directly: `cas.write(pure({ first: ok(bytes), tail: pure(undefined) }))` — a single-chunk `List` built via `pure` rather than `fjs/effects/list`'s `nonEmpty`/`empty` (documented there as a targeted inference-widening workaround). **Reuse this exact pattern for writing the result blob and the run-record blob** — no new chunking logic needed since both are small.
- `Cas<O>.read`/`collectRead` (module.f.d.ts lines 27, 45) is how the handler fetches a program's or document's full text by hash — `collectRead(cas.read(hashVec))` yields `Effect<O, IoResult<Vec>>`, then decode via `fjs/text`'s `utf8ToString` (or fjs's own `fromVec`/`tryUtf8` pairing, already used in `fjs/server/module.f.js`).
- `Evo<O>.head: (subject) => Effect<MemOp, readonly Hash[]>` and `Evo<O>.list: (archived?) => Effect<MemOp, readonly Subject[]>` (module.f.d.ts lines 206, 208) are **pure in-memory cache reads — no real I/O**, since `Cache.bySubject` (built once by `buildCache`/`initEvo`) already holds every subject's hash/parent bookkeeping. `Evo<O>.revision: (hash) => Effect<O | MemOp, Result<RevisionData, string>>` (line 219) *does* need real store I/O for the decoded revision content.
- `RevisionData` (lines 95-101): `{ parents: readonly Hash[], snapshot?, subject?, archived?, generation? }` — this is what a program would get back (as JSON, per the frozen ABI's `evoRevision` docstring) after resolving a document's head.
- No `evoAdd`/`casWrite`-shaped operation exists in `FileCasOperation` or `CasOp` — the actual write surface fjs exposes is `addRevision`/`cas.write`, both explicitly excluded from the guest vocabulary (confirmed by the grep above).

### `fjs/media/json/schema/module.f.js` — `toJsonSchema` [VERIFIED]

- `export const toJsonSchema: (rtti: RttiType) => Unknown` — **already exists and is already used** by `fromRegistry`'s own `toolsList` handler (`fjs/protocol/mcp/module.f.js` line 158: `inputSchema: toJsonSchema(entry.inputRtti)`) to turn an RTTI schema into JSON Schema (draft 2020-12). A struct field's exact-literal `Const` (e.g. `dialect: 'vnd.fjs.1099int'`, produced by `base()`) renders as `{ "const": "vnd.fjs.1099int" }` (see the struct/const mapping table in the file's own docstring). **`finance_schema(dialect)` should call `toJsonSchema` directly on the looked-up schema const — this is MCP-06's serializer, already built, not something to invent.**

### `fjs/asserts/module.f.js`, `fjs/types/result/module.f.js` — the bare-throw discipline [VERIFIED]

- `assert: (v: boolean, msg?: unknown) => asserts v` — throws `msg` **directly**, never wrapped. `unwrap: <T,E>([kind,v]: Result<T,E>) => T` — throws the bare `error` value `v` directly on the `'error'` arm. Both confirm STATE.md's constraint: any `try`/`catch` around fjs's own assertion/unwrap machinery must read the caught value directly (`typeof e === 'string'`), never branch on `e instanceof Error` or read `e.message`.

## Critical Finding: `guestCtx` Currently Has No Composition Combinator

REQUIREMENTS.md's EXEC-07 text (line 159) states the ctx object should carry "combinators, read-only operation constructors, money helpers, `args`." The **shipped** `guestCtx` (`fjs/guest/module.f.js` lines 96-101, verified) is `{ casRead, evoList, evoHead, evoRevision }` — four operation constructors and nothing else. `args` is confirmed to be a separate curried parameter (the `Report` typedef), not a ctx member, so that part of the original text was already deliberately narrowed. But **no combinator (`step`/`pure`) and no money helper made it into `guestCtx` either.**

Why this matters concretely: `do_(command)(...payload)` (`fjs/effects/module.f.js` line 202) returns `{ command, payload, continuation: pure }` where `pure = v => () => v`. Composing a *second* dispatched operation after the first requires either (a) importing `step`/`pure` from `functionalscript/fjs/effects/module.f.js` — impossible, since a stored report program has **zero** imports by construction (Success Criterion 2, SEC-02's empty allow-list) — or (b) hand-constructing the next `Do`/`Pure` node as a raw object literal with a `continuation` function, replicating `step`'s reduction by hand. Verified by reading `step`'s own implementation (`fjs/effects/module.f.js` lines 128-130): `step(e, f) = typeof e === 'function' ? f(e()) : { ...e, continuation: x => step(e.continuation(x), f) }`. Path (b) is mechanically possible but is exactly the kind of low-level plumbing a report-program author (LLM or human) should not have to hand-roll for a loop over an unknown number of stored 1099-INTs.

**The Week-1 finish line requires exactly this kind of composition**: enumerate subjects (`evoList`), resolve each one's head (`evoHead`), read its revision (`evoRevision`), read its snapshot (`casRead`), parse and sum `box1InterestIncome` across all of them. That is a minimum of one loop over a dynamically-sized list plus four sequenced reads per iteration — effectively impossible to author cleanly without *some* sequencing primitive available with zero imports.

**This is not resolved anywhere in CONTEXT.md, REQUIREMENTS.md's traceability table, or the existing code.** It is a genuine gap between the aspirational EXEC-07 text and the delivered Phase 6 artifact, and it directly blocks authoring a working Week-1 program. Two live constraints collide if the obvious fix (`guestCtx.step = step; guestCtx.pure = pure`) is taken: it satisfies the composition need, but it **breaks the existing, currently-passing Phase 6 proof** `fjs/guest/module.f.js`'s `proof.vocabularyIsFrozenAtFour` (`assertEq(Object.keys(guestCtx).join(','), casOpNames.join(','))`, exact-equality on the ctx's *own* key set, not just `CasOp`'s operation-name union). Widening that assertion to a subset check (`casOpNames.every(n => Object.hasOwn(guestCtx, n))`) is a small, well-precedented revision (this codebase has revisited "Complete" phase proofs before when a later phase's requirement demanded it — see STATE.md's Phase 5/6 entries) but it is a genuine, deliberate change to already-shipped, already-marked-Complete code, not a pure addition.

**Recommendation for the planner:** surface this to the user before locking task granularity — it is exactly the kind of decision CONTEXT.md's "Claude's Discretion" section does not cover (it only mentions module placement/file naming and the preview/guard byte counts), and it revises a locked EXEC-07 decision rather than extending it. If confirmed, the safest framing is additive: `guestCtx` gains `step`/`pure` (and, per the original EXEC-07 text, `centsFromString`/`centsToString` as the promised "money helpers") as non-operation members, `casOpNames`/`CasOp` stay untouched (the frozen four-operation vocabulary is not widened), and `vocabularyIsFrozenAtFour` is rewritten to assert the four command names are *present* in ctx rather than that ctx has *only* those four keys.

## Standard Stack

No third-party libraries — none needed, and AGENTS.md forbids adding any without owner approval. Everything below is either already in `node_modules/functionalscript@0.41.0` or already written locally in this repo.

| Module | Path | Purpose | Status |
|---|---|---|---|
| `interpret` | `fjs/exec/module.f.js` | restricted, observed-read-set effect interpreter | Existing, unchanged |
| `guestCtx`/`CasOp` | `fjs/guest/module.f.js` | frozen guest vocabulary | Existing; see Critical Finding for a possible additive change |
| `checkSpecifiers`/`programFileName`/`programPath`/`loadProgram` | `fjs/guest/materialize/module.f.js` | specifier gate + hash-derived materialization + import | Existing; needs a new disk-write step composed in front of it |
| `toolEntry`/`okResult`/`errorResult`/`fromRegistry` | `functionalscript/fjs/protocol/mcp/module.f.js` | tool registry primitives | Existing upstream, reuse directly |
| `stdioTransport`/`writeResponse` | `functionalscript/fjs/protocol/mcp/stdio/module.f.js` | transport loop, 128 KiB fallback | Existing upstream, unchanged |
| `fileCas`/`collectRead` | `functionalscript/fjs/cas/module.f.js` | content-addressed read/write | Existing upstream, reuse directly |
| `evo`/`initEvo`/`buildCache` | `functionalscript/fjs/cas/evo/module.f.js` | subject/head cache | Existing upstream, reuse directly |
| `toJsonSchema` | `functionalscript/fjs/media/json/schema/module.f.js` | RTTI → JSON Schema | Existing upstream, reuse directly for `finance_schema` |
| `centsFromString`/`centsToString` | `fjs/exact/module.f.js` | decimal-string ⟷ bigint cents | Existing, unchanged |
| `base` | `fjs/document/base/module.f.js` | dialect base spread | Existing, reuse for `vnd.fjs.run` |

**Installation:** none — `functionalscript@0.41.0` is already the pinned `dependencies` version in `package.json`; `npm test` (135 pass / 0 fail per STATE.md) already exercises it.

## Architecture Patterns

### System Architecture Diagram

```
 Agent (LLM client)
   │  tools/call fjs_run { hash, args?, subject?, parents? }
   ▼
 stdioTransport ── mcpStep ── fromRegistry ── fjs_run ToolEntry.handle
   │                                                 │
   │                                    ┌────────────┴─────────────────┐
   │                                    │ 1. Resolve hash → CAS blob   │  (cas.read + collectRead)
   │                                    │    (missing hash → errorResult)
   │                                    │ 2. Materialize: write blob   │  NEW — writeFile/writeBytes
   │                                    │    bytes to programPath(home)(hash)
   │                                    │ 3. checkSpecifiers (existing)│  (dirty specifier → errorResult)
   │                                    │ 4. loadProgram → import_     │  (import failure → errorResult)
   │                                    │ 5. Snapshot Evo cache + read │  NEW — build synchronous hostMap
   │                                    │    every reachable CAS blob  │  (see Critical Finding + Open Q)
   │                                    │ 6. interpret(hostMap)(       │  (existing — fjs/exec)
   │                                    │      program.report(ctx)(args))
   │                                    │    (non-Error throw → errorResult)
   │                                    │ 7. Write result blob to CAS  │  (existing pattern, fjs/cas write)
   │                                    │ 8. Assemble vnd.fjs.run      │  NEW dialect + validate
   │                                    │    { programHash, inputs[],  │
   │                                    │      resultHash, status,     │
   │                                    │      pinned, args, ... }
   │                                    │ 9. Write run record to CAS   │
   │                                    │ 10. Size-check preview       │  NEW — explicit, before return
   │                                    │     (oversized → "result too │
   │                                    │      large; stored at <hash>")
   │                                    └────────────┬─────────────────┘
   │                                                 │ okResult / errorResult
   ▼                                                 ▼
 stdout (JSON-RPC)  ◄─────────────────── ToolsCallResult { resultHash, runHash, preview, truncated }
```

### Recommended Project Structure

Following the existing `fjs/<area>/module.f.js` convention (module placement is explicitly Claude's Discretion per CONTEXT.md):

```
fjs/
├── run/
│   ├── module.f.js          # vnd.fjs.run dialect (base/schema/validate), mirrors fjs/document/1099int
│   └── ...
├── guest/
│   └── materialize/
│       └── module.f.js      # extend: add the disk-materialization write step here, next to loadProgram
├── server/
│   ├── module.f.js          # concatenate fjsRunTool + financeSchemaTool into financeMcpHandlers
│   └── fjs_run/
│       └── module.f.js      # the new tool handler: hash resolution, hostMap snapshot, interpret call,
│                             #   result+run-record writes, size-guarded response
```

### Pattern 1: Effect-then-synchronous-interpret split

**What:** Resolve every piece of store state the guest program could possibly touch via ordinary `step`/`pure` effects *first*, producing plain in-memory data; only then call `interpret(hostMap)(...)` where `hostMap`'s closures read that already-resolved data synchronously.
**When to use:** Any time `interpret` (or anything typed `OperationMap<O, Return<O>>`) needs to be driven — its handler signatures are plain functions, never `Effect`-returning ones.
**Example (illustrative, not yet written anywhere in the repo — composes only existing primitives):**
```js
// Source: fjs/cas/evo/module.f.js (Evo.list/head/revision), fjs/cas/module.f.js (collectRead) — types verified
const snapshot = step(evoApi.list(), subjects => /* ...resolve heads/revisions/blobs via further steps... */)
// once `snapshot` (plain data) is in hand:
const hostMap = {
  casRead: hash => snapshot.blobs[hash] ?? (() => { throw `blob not found: ${hash}` })(),
  evoList: archivedFlag => JSON.stringify(snapshot.subjects(archivedFlag)),
  evoHead: subject => JSON.stringify(snapshot.heads[subject] ?? []),
  evoRevision: hash => JSON.stringify(snapshot.revisions[hash]),
}
const [t, v] = interpret(hostMap)(program.report(guestCtx)(args))
```

### Pattern 2: Size-guarded preview, parameterized for testability

**What:** Structure the size check as `(guardBytes) => (previewBytes) => (content) => { resultHash, preview, truncated }` rather than hardcoding the 8 KiB/64 KiB constants inline.
**When to use:** So the logic can be proof-tested against tiny thresholds without ever allocating a literal >64 KiB string (see Validation Architecture, criterion 5).

### Anti-Patterns to Avoid

- **Re-deriving `errorResult`, `okResult`, `toJsonSchema`, or the canonical-JSON `stringify(sort)` pattern locally.** All four already exist upstream and are already used elsewhere in this exact codebase (`fjs/protocol/mcp/stdio/module.f.js` line 42 for the `stringify(sort)` pattern).
- **Branching on `instanceof Error` anywhere in the error-mapping path.** Every fjs throw relevant to this phase (`assert`, `unwrap`, `interpret`'s refusal) is a bare value.
- **Giving the guest `Cas<O>`/`Evo<O>` objects directly**, even read-only ones. Their methods return `Effect`s, which `interpret`'s `OperationMap` cannot accept (Finding 3) — and handing them over at all would blur the "guest touches nothing but `ctx`" boundary EXEC-07 exists to enforce.
- **Writing the materialized program file with a check-then-write (`access` then conditionally `writeFile`) race.** Since the filename is content-hash-derived, the same hash always produces the same bytes — an unconditional overwrite is simpler and cannot corrupt anything; prefer that over a check that races against a concurrent call for the same hash.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---|---|---|---|
| Tool-level error surfacing | A local `errorResult`-shaped helper | `errorResult` from `functionalscript/fjs/protocol/mcp/module.f.js` | Already exists, already used by `toolEntry` itself |
| RTTI → agent-readable JSON | A hand-written field-list serializer for `finance_schema` | `toJsonSchema` from `functionalscript/fjs/media/json/schema/module.f.js` | Already exists, already used by `fromRegistry`'s `toolsList` for the exact same purpose |
| Canonical/stable JSON encoding (for hashing the run record deterministically) | A custom sorted-stringify | `stringify(sort)` — `fjs/media/json/module.f.js` + `fjs/types/object/module.f.js`'s `sort`, exactly as `fjs/protocol/mcp/stdio/module.f.js` line 42 already does | One canonical encoder avoids two dialects disagreeing on key order and therefore on hash |
| Content hashing | Manual SHA-256 + cBase32 | `fileCas(sha256)(home).write(...)` (returns the hash) + `vecToCBase32` | Both already exported and already used in `fjs/server/module.f.js` |
| Draining a chunked CAS read into one string | A manual accumulation loop | `collectRead` — `fjs/cas/module.f.js` | Already handles the `maxLength` overflow-as-error case |
| 128 KiB transport cap detection | A hardcoded `131072` literal duplicated locally | Reference `maxLength`/`maxLengthBytes` from `fjs/types/bigint`/`fjs/types/bit_vec` **only if the plan needs to relate its own guard to the transport cap in code**; otherwise just keep the guard constants independent per CONTEXT.md's discretion note | The transport's cap is already enforced elsewhere; duplicating the raw number invites drift if fjs ever changes it |

**Key insight:** every serialization/hashing/error-shaping primitive this phase needs already exists somewhere in this repo or in fjs 0.41.0. The genuinely new work is orchestration (the three findings above), not primitives.

## Common Pitfalls

### Pitfall 1: Assuming `loadProgram` materializes the file

**What goes wrong:** A plan task that says "call `loadProgram` to run the stored program" silently omits the disk-write step, and `import_` fails with a generic "no such file" in production while passing every existing (virtual-only) proof.
**Why it happens:** Phase 6's own proofs never touch a real filesystem; the gap is invisible under `fjs/effects/node/virtual`.
**How to avoid:** Add an explicit task/step: read the CAS blob's bytes, `writeFile`/`writeBytes` them to `programPath(home)(hash)`, *then* call `checkSpecifiers`+`loadProgram`. Proof this against `fjs/effects/node/virtual`'s real `Fs` operation set (not just a `JsModule` fixture) so the write step itself is exercised, not merely assumed.
**Warning signs:** A proof that only ever seeds `root[name]` as a `JsModule` function and never as a `Vec` (bytes) plus a real write step.

### Pitfall 2: Materialized program files pollute the repo root and are never cleaned up

**What goes wrong:** Every distinct `hash` run creates a permanent `<hash>.mjs` file directly in `home` (the repo root in production). `.gitignore` currently only excludes `/.cas`.
**Why it happens:** `programPath(home)(hash) = join(home, programFileName(hash))` — verified, not a guess — places the file as a sibling of `.cas`, not inside it.
**How to avoid:** Either add a `.gitignore` pattern for materialized program files (e.g. a dedicated ignored subdirectory the plan chooses, with `programPath` still composing the same way but with a different `home`-equivalent root), or explicitly accept root-level `.mjs` accumulation as a known, documented tradeoff (mirroring how SEC-03's docstring already accepts "the same program deliberately reuses its name" — never-evicting is by design). Flag this as a decision for the plan, not something to silently work around.
**Warning signs:** `git status` showing untracked `<hash>.mjs` files after running `fjs_run` once.

### Pitfall 3: Treating `interpret`'s `map` parameter as if it could perform real I/O per dispatch

**What goes wrong:** Writing `hostMap.casRead = hash => unwrap(virtualDriveOfCasRead(hash))` or similar — attempting to synchronously "unwrap" an `Effect` inside a handler. This either doesn't typecheck (an `Effect` is not awaited/unwrapped that way) or, if forced through with an `any`, silently breaks purity by performing I/O inside what `tsc` believes is a plain synchronous function.
**Why it happens:** Every other CAS/Evo access pattern in this codebase (`casToolRegistry`, `evoToolRegistry`, `casRefreshTool`) is `Effect`-returning; it's natural to assume the guest's host map should be too, but `OperationMap<O, Return<O>>`'s `Return<O>` is pinned to the operation's own plain return type.
**How to avoid:** See Pattern 1 (Effect-then-synchronous-interpret split) and the Critical Finding above — resolve everything via `step`/`pure` *before* calling `interpret`, and build `hostMap` as closures over the resolved plain data.
**Warning signs:** A `tsc` error assigning an `Effect<...>`-typed function where `OperationMap<CasOp, string>` is expected — this is the compiler catching exactly this mistake, which is good, but it's easy to "fix" by wrapping in `any` instead of restructuring.

### Pitfall 4: Proving criterion 5's ordering by the returned message alone

**What goes wrong:** A proof that asserts the tool's returned text equals `result too large; stored at <hash>` without also asserting that the raw oversized content was never written to `stdout` proves the *message*, not the *ordering* ("explicit size check before `writeResponse`"). STATE.md already recorded this exact class of mistake once (Phase 6: "a 'which error message' assertion cannot prove an ORDERING" — both orderings can produce the same-looking message).
**Why it happens:** The two possible implementations (check-then-return-small-message vs. return-large-message-and-let-transport-truncate) can be made to emit textually similar strings if not careful.
**How to avoid:** Assert on `state.stdout` (under `fjs/effects/node/virtual`) directly: the oversized raw content must never appear in `stdout` at all, only the small "too large" message — this is the same "observe the side effect the ordering prevents" technique STATE.md recorded as the fix last time.
**Warning signs:** A proof that only calls `asCallResult(...)` and reads `.text`, never inspecting the raw response line length or content.

### Pitfall 5: Widening `guestCtx` without revising `vocabularyIsFrozenAtFour`

**What goes wrong:** Adding `step`/`pure`/money helpers to `guestCtx` (see Critical Finding) without updating `fjs/guest/module.f.js`'s existing `proof.vocabularyIsFrozenAtFour` breaks `npm test` immediately (`assertEq(Object.keys(guestCtx).join(','), casOpNames.join(','))` fails on an exact-equality mismatch).
**Why it happens:** The exact-equality assertion was correct under Phase 6's narrower (four-key) `guestCtx`; it becomes over-strict the moment ctx grows a legitimate non-operation member.
**How to avoid:** If this addition is confirmed, revise the assertion to a subset check in the same commit, with a comment explaining why (mirroring this codebase's convention of explaining every module-header "why," including rejected alternatives).

## Code Examples

### Criterion 3's grep, verified to already pass

```bash
# Source: read fjs/guest/module.f.js and fjs/guest/materialize/module.f.js in full
grep -n "casWrite\|evoAdd" fjs/guest/module.f.js fjs/guest/materialize/module.f.js
# (no output — confirmed by reading both files; nothing new required for this half of criterion 3)
```

### The already-existing `errorResult`/`okResult` pair (reuse, don't rewrite)

```js
// Source: functionalscript/fjs/protocol/mcp/module.f.js, lines 134 & 141
export const okResult = (text) => ({ content: [{ type: 'text', text }] });
export const errorResult = (text) => ({ ...okResult(text), isError: true });
```

### The exact 128 KiB constant chain (for documentation/citation only — do not import across these layers casually)

```js
// Source: functionalscript/fjs/types/bigint/module.f.js, line 183
export const maxLength = 0x100000n // bits == 131072 bytes == 128 KiB
```

### The single-chunk CAS write pattern to reuse for the result blob and the run record

```js
// Source: fjs/server/module.f.js, lines 376-379 (casRefresh.seedInvisibleUntilRefreshed)
const bytes = tryUtf8(text) // assert bytes !== null first
const [, w] = virtual(state)(cas.write(pure({ first: ok(bytes), tail: pure(undefined) })))
const hash = vecToCBase32(w[1]) // w[0] === 'ok'
```

## State of the Art

Not applicable in the external sense (no third-party ecosystem here), but one internal "old vs current" pair is worth recording:

| Old assumption | Current reality | When found | Impact |
|---|---|---|---|
| "`fjs_run` cannot be proof-tested" (`fjs/todo/implement-mcp-server.md`, corrected by DOCC-04) | It can — `import_` is already an effect with a virtual interpreter (Phase 6 proves this for `loadProgram`) | Phase 1 (DOCC-04) | The Validation Architecture below assumes full proof coverage under `fjs/effects/node/virtual`, no real process needed |
| "Result disposition" and "entry point convention" were open questions in `fjs/todo/implement-mcp-server.md` | Both resolved: handler writes results (EXEC-10), entry point is `report: (ctx) => (args) => Effect<CasOp, T>` (EXEC-07, Phase 6) | Phase 6 | Confirms Phase 7 only composes, doesn't re-decide these |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|---|---|---|
| A1 | The synchronous-snapshot host-map design (pre-resolve the whole reachable store into memory before calling `interpret`) is the intended way to reconcile `interpret`'s synchronous `OperationMap` with real CAS/Evo I/O. | Critical Finding / Pattern 1 / Pitfall 3 | If the intended design is instead a deeper change to `fjs/exec`'s `interpret` (e.g., an effect-yielding variant), the plan would build the wrong shape entirely. This is `[ASSUMED]` — no code or doc anywhere states this design; it is derived from the type constraints. Confirm before locking the handler's task breakdown. |
| A2 | `guestCtx` should be additively widened with `step`/`pure` (and possibly money helpers) to make Week-1 program authoring tractable, with `vocabularyIsFrozenAtFour` revised to a subset check. | Critical Finding / Pitfall 5 | If the user instead wants guest programs to compose effects by hand (raw continuation object literals) or wants a different mechanism entirely (e.g., a tiny local combinator library exposed some other way), the plan's ctx design is wrong. `[ASSUMED]` — flag for discuss-phase or explicit user confirmation given it revises a "Complete" Phase 6 proof. |
| A3 | Materialized program files should land in a new, gitignored location rather than bare `home` root, OR the team accepts root-level `.mjs` accumulation as-is. | Pitfall 2 | Low risk either way for correctness, but affects repo hygiene and whether a `.gitignore` edit is in scope for this phase. `[ASSUMED]` — no CONTEXT.md text addresses this. |
| A4 | `finance_schema`'s dialect→schema lookup is a small local object map (`{ 'vnd.fjs.1099int': oneZeroNineNineIntSchema, ... }`), not a dependency on the deferred `fjs/media` dialect registry (`fjs/todo/upstream-media-dialect-registry.md`). | Existing Code Map / Don't Hand-Roll | Low risk — CONTEXT.md explicitly defers the registry resolution as optional/non-blocking, and a lookup map over already-exported schema consts introduces no second source of truth. `[ASSUMED]` but low-consequence. |

## Open Questions

1. **Does the guest ABI need `step`/`pure` (and money helpers) to make a real Week-1 program authorable?**
   - What we know: `guestCtx` today has exactly four operation constructors and nothing else (verified). Composing more than one dispatched operation with zero imports requires *some* sequencing primitive.
   - What's unclear: whether the user/team wants this solved by widening `guestCtx` (revising a Complete Phase 6 proof), by accepting hand-rolled continuation object literals in guest programs, or by some other mechanism not yet considered.
   - Recommendation: raise this explicitly before planning task breakdown — it changes whether Phase 7 touches `fjs/guest/module.f.js` at all.

2. **What exact data does the tool handler need to pre-resolve into the synchronous snapshot, and how expensive is "the whole store" at this project's actual scale?**
   - What we know: `evoList`/`evoHead` are cheap (in-memory cache only). `evoRevision`/`casRead` need real blob bytes, and a program's read pattern is data-dependent, so the safe approach is to resolve *every* reachable blob before interpreting.
   - What's unclear: whether "every reachable blob" means every hash `cas.list()` returns (unbounded, correct but maybe wasteful) or something narrower keyed off the resolved Evo heads/snapshots reachable from `subject`/`parents` (tighter, but risks missing a document the program legitimately reads via an unpinned path).
   - Recommendation: given the declared project scale (single local user, a handful of documents in v1), starting with "resolve every hash in `cas.list()`" is simplest and correct; revisit only if it becomes a real performance problem.

3. **Where does the materialized program file live, and does `.gitignore` need an update?**
   - What we know: `programPath(home)(hash)` writes directly under `home`, unchanged from Phase 6.
   - What's unclear: whether this phase is in scope to relocate it or just to gitignore it.
   - Recommendation: gitignore it in this phase (cheap, avoids repo pollution) without relocating `programPath`'s existing contract, unless the user prefers otherwise.

## Environment Availability

No external dependencies beyond what is already installed and verified working: `functionalscript@0.41.0` present in `node_modules` (confirmed via `package.json`), `npm test` currently green (135 pass / 0 fail per STATE.md, before this phase's changes). No new tool, service, or runtime is required.

## Validation Architecture

### Test Framework

| Property | Value |
|---|---|
| Framework | FunctionalScript Emergent Testing (`proof` exports) run via Node's built-in test runner |
| Config file | none — discovery is `all.test.js` at repo root walking the project via `loadModuleMap` |
| Quick run command | `node --test all.test.js` (only valid entry point — `node --test <file>` on any other path is a documented **fake pass**, per AGENTS.md and STATE.md) |
| Full suite command | `npm test` (`tsc && node --test`) |

**Critical constraint, verified in STATE.md and AGENTS.md:** every proof for this phase must be reachable only via root discovery. A proof file that exists but is never imported by anything `all.test.js` walks registers zero tests and passes silently — this bit the project once already (a leaf that throws unconditionally still reported `pass` when run directly against its own file).

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|---|---|---|---|---|
| EXEC-08 | `fjs_run` accepts `{hash, args?, subject?, parents?}`, pins Evo heads once at call time | unit (proof) | `npm test` (new `proof` in the `fjs_run` handler module) | ❌ Wave 0 |
| EXEC-10 | Tool handler (not guest) writes result + run record; `casWrite`/`evoAdd` absent from whitelist | unit (proof) + static (grep) | `npm test` + `grep -n "casWrite\|evoAdd" fjs/guest/module.f.js fjs/guest/materialize/module.f.js` (expect no output) | ❌ Wave 0 (proof); ✅ (grep already passes today) |
| EXEC-11 | Explicit size check before `writeResponse`; `result too large; stored at <hash>` | unit (proof), parameterized guard | `npm test` | ❌ Wave 0 |
| EXEC-12 | Three failure classes each become tool-level `errorResult`, never a crash | unit (proof), three separate leaves | `npm test` | ❌ Wave 0 |
| PROV-03 | `vnd.fjs.run` record: program hash, observed inputs, result hash, status, pinned flag | unit (proof) — dialect validate + adversarial read-set proof | `npm test` | ❌ Wave 0 |
| MCP-06 | `finance_schema(dialect)` serializes the dialect's own exported schema const | unit (proof) | `npm test` | ❌ Wave 0 |

All six requirements are `T1`, all satisfied purely by `proof` exports under `fjs/effects/node/virtual` — no manual-only test is needed since Phase 6 already established the whole materialize→import→execute path is proof-testable with no real filesystem (DOCC-04's correction).

### Sampling Rate

- **Per task commit:** `npm test` (fast — 135 pre-existing proofs plus new ones, no real I/O, no real process)
- **Per wave merge:** `npm test` (same command; there is no separate "full suite" here — `tsc && node --test` already runs everything)
- **Phase gate:** `npm test` green, plus a manual `grep` confirmation for criterion 3's textual requirement (the criterion names `grep` explicitly, so keep it as an explicit, documented step even though the stronger type-level `Assert<Equal<...>>` already exists)

### How to prove each of the 5 success criteria

**Criterion 1 (Week-1 finish line, end-to-end).** Under `fjs/effects/node/virtual`, in one threaded `State` (following the `casRefresh.seedInvisibleUntilRefreshed` pattern of carrying `memoryValues`/`memoryNext` forward across steps): (a) seed several `vnd.fjs.1099int` documents into CAS with varying `box1InterestIncome` values (including at least one with the field *absent*, to prove absent-is-skipped-not-zero is respected by the summing program), wired into Evo as revisions of distinct subjects; (b) write a guest program's source to CAS via `cas.write`, then seed the *same* content as a `Vec` at `programPath(home)(hash)` in the virtual `root` (exercising the real materialize-write step, not a `JsModule` shortcut); (c) drive a `tools/call fjs_run` request through the full `financeMcpServer`/`mcpStep` stack; (d) assert the returned `resultHash`/`runHash` are present, decode the result blob from the virtual CAS store and assert it equals the expected decimal-string sum (computed independently in the proof via `centsFromString`/`centsToString`, never via a hardcoded literal — this doubles as a PROV-07-style perturbation check even though PROV-07 itself is a later phase).

**Criterion 2 (adversarial observed-vs-declared reads).** Construct a guest program whose *returned value* (or embedded self-description) names only hash `A` as its input, but whose actual `report` body also calls `ctx.casRead('B')` (a second, real, seeded document) and discards or only partially uses the result. Run it through the full handler. Assert the **persisted, decoded `vnd.fjs.run` record's `inputs[]`** (read back from CAS by hash, not the in-process `Read[]` fjs/exec already proves in isolation) contains an entry for `B`'s `casRead` dispatch even though nothing the program returned mentioned it. This is the adversarial shape the CONTEXT.md/ROADMAP text asks for explicitly — the proof must show the record cannot be starved of a read the program tried to hide, not merely that `interpret`'s in-memory `Read[]` (already proven in `fjs/exec/module.f.js`) behaves this way.

**Criterion 3 (guest whitelist absence + handler-performed writes).** Two independent checks, both required by the criterion's own wording:
- Static: `grep -n "casWrite\|evoAdd" fjs/guest/module.f.js fjs/guest/materialize/module.f.js` returns nothing (already true; re-verify unchanged after this phase's edits). Keep alongside the existing, stronger `Assert<Equal<CasOp[0], ...>>` type-level pin (`fjs/guest/module.f.js` line 144) — the criterion names `grep` explicitly, so don't drop it even though the type check subsumes it.
- Behavioral: under `virtual`, snapshot the CAS store's set of hashes *before* calling the `fjs_run` handler and *after*. Assert exactly two new hashes appear (the result blob, the run record) and that both correspond to content the *handler's own code* constructed (assert their bytes match handler-computed values), never anything the guest's `hostMap` could have produced — reinforced by the fact that `hostMap`'s four closures are typed to return plain strings, structurally incapable of performing a `cas.write`.

**Criterion 4 (three failure classes, three separate proof leaves).**
- *Non-`Error` throw from the guest*: reuse the exact `unsafeDo`/`any`-escape-hatch pattern `fjs/exec/module.f.js`'s own test fixtures already use (lines 56-57) to construct a guest effect requesting an operation outside `CasOp` (e.g. `unsafeDo('fetch')(...)`), which `interpret` refuses via its bare-string throw path. Assert the **tool handler's** returned `ToolsCallResult` is `errorResult(...)` with `isError: true`, not merely that `interpret` internally returned an `error(...)` `Result` (that half is already proven in Phase 3).
- *Missing hash*: call the handler with a `hash` absent from the virtual CAS root. Assert `cas.read`/`collectRead` surfaces an `IoResult` error and the handler converts it to `errorResult(...)` before ever attempting materialization or `interpret`.
- *Import failure*: reuse Phase 6's own `missingModuleIsAnErrorValue` technique (`fjs/guest/materialize/module.f.js` lines 347-351) but drive it through the **full tool handler**, not `loadProgram` directly — assert the handler's own `errorResult`, not `loadProgram`'s internal `Result`.

All three leaves must additionally assert the *session itself survives* — i.e., a subsequent `ping` or `tools/list` call in the same virtual session still succeeds — to satisfy "never a dropped connection," not just "never a process crash."

**Criterion 5 (explicit size check before `writeResponse`, without needing a real >128 KiB payload).** Structure the size-check function as `(guardBytes: number) => (previewBytes: number) => (content: string) => {...}` (Pattern 2). Two proof leaves:
- *Logic proof, parameterized*: call the size-check function with tiny thresholds (e.g. `guardBytes = 16`) against an ordinary short string that exceeds them, asserting the `result too large; stored at <hash>` shape triggers correctly — this exercises the exact boundary condition at negligible cost, with no large string ever allocated.
- *Constants proof*: a trivial, separate `assertEq` pinning the *shipped* constants to 8 KiB (preview) / 64 KiB (guard) — cheap, and keeps the parameterized logic proof from silently drifting away from the real deployed values.
- *Ordering proof (the STATE.md lesson, reapplied)*: under `virtual`, assert that when the guard trips, the raw oversized content **never appears in `state.stdout`** at all — only the small "too large" message does. This is the only way to distinguish "checked before constructing the response" from "constructed the response and got lucky that it still fit," per the exact lesson STATE.md already recorded once for a different ordering guarantee (Phase 6, SEC-02-before-`import_`). Do not rely on the returned message text alone.
- *Contrast leaf (optional but valuable)*: separately, feed an oversized `okResult(...)` text directly through `stdioTransport`/`writeResponse` **without** the new guard, and confirm it independently reproduces the transport's generic `-32603` fallback — this is the failure mode criterion 5 exists to prevent, and demonstrating it directly (rather than asserting it by argument) makes the regression test meaningful.

## Security Domain

`security_enforcement` is not present in `.planning/config.json`; per the workflow rule, absence means enabled.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---|---|---|
| V2 Authentication | No | Single local user, stdio transport, no auth in v1 (accepted risk, REQUIREMENTS.md "Accepted Risks") |
| V3 Session Management | Partial | `mcpStep`'s own session state machine (upstream, unchanged by this phase) |
| V4 Access Control | Yes | The `CasOp` whitelist *is* the access-control boundary for guest code; this phase must not widen it with any write operation (criterion 3) |
| V5 Input Validation | Yes | `toolEntry`'s RTTI-based argument validation (upstream, already wired) validates `{hash, args?, subject?, parents?}` before the handler body runs; the new `vnd.fjs.run` dialect's `validate`/`checkReferences` (mirroring `1099int`'s pattern) validates the record on the way in if it is ever re-read |
| V6 Cryptography | Yes (narrow) | Content hashing is `sha256` via `fileCas`, never hand-rolled; no other crypto surface in this phase |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---|---|---|
| A stored program's module body executes with full Node privileges at `import()` time, before any effect is interpreted | Elevation of Privilege | **Accepted, unmitigated in-process** per REQUIREMENTS.md's Accepted Risks table — SEC-01 (`node --permission`)/SEC-02 (specifier allow-list) are the only compensating controls, both already delivered in Phase 6. Phase 7 does not change this risk profile; it must not be described as newly solving it. |
| A malicious guest effect requests a non-whitelisted operation (`fetch`, `casWrite`, `evoAdd`) | Tampering / Information Disclosure | Already refused by `interpret`'s own-property dispatch (fjs 0.41.0) plus the `Assert<Equal<...>>` type pin; Phase 7's job is only to convert the resulting bare-string refusal into a tool-level `errorResult` rather than letting it propagate as an uncaught throw |
| A malformed or oversized `tools/call` response destabilizes the transport | Denial of Service (soft — silent failure, not a crash) | EXEC-11's explicit pre-write size check, this phase's own new mechanism |
| A program lies about what it read (citation vs. actual reads) | Repudiation | EXEC-05's already-existing observed read-set accumulator, surfaced into a persisted, hash-addressed `vnd.fjs.run` record (PROV-03) — this phase's dialect design must never let a program supply its own `inputs[]` |

## Sources

### Primary (HIGH confidence — all read directly in this session)

- `fjs/exec/module.f.js` (this repo) — `interpret`, `stepBudget`, `Read`/`Interpreted` types, full proof suite
- `fjs/guest/module.f.js` (this repo) — `CasOp`, `guestCtx`, `casOpNames`, `Report` typedef, `Assert<Equal<...>>`, `proof.vocabularyIsFrozenAtFour`
- `fjs/guest/materialize/module.f.js` (this repo) — `checkSpecifiers`, `programFileName`, `programPath`, `loadProgram`, full proof suite (confirmed no disk-write step exists)
- `fjs/server/module.f.js` (this repo) — `financeMcpHandlers`, `casRefreshTool`, `financeConfig`, `financeMcpServer`, full session/refresh proof suite
- `fjs/document/1099int/module.f.js`, `fjs/document/base/module.f.js` (this repo) — dialect schema shape, `base()`
- `fjs/exact/module.f.js` (this repo) — `centsFromString`/`centsToString`
- `node_modules/functionalscript/fjs/protocol/mcp/module.f.js` + `.d.ts` (upstream 0.41.0) — `toolEntry`, `okResult`, `errorResult`, `fromRegistry`, `mcpStep`, `McpConfig`
- `node_modules/functionalscript/fjs/protocol/mcp/stdio/module.f.js` (upstream 0.41.0) — `stdioTransport`, `writeResponse`
- `node_modules/functionalscript/fjs/text/module.f.js`, `fjs/types/bit_vec/module.f.js`, `fjs/types/bigint/module.f.js` (upstream 0.41.0) — traced the 128 KiB cap to `maxLength = 0x100000n`
- `node_modules/functionalscript/fjs/cas/module.f.js` + `.d.ts`, `fjs/cas/evo/module.f.js` + `.d.ts` (upstream 0.41.0) — `Cas<O>`, `fileCas`, `collectRead`, `Evo<O>`, `RevisionData`, `Cache`
- `node_modules/functionalscript/fjs/media/json/schema/module.f.js` + `.d.ts` (upstream 0.41.0) — `toJsonSchema`
- `node_modules/functionalscript/fjs/asserts/module.f.d.ts`, `fjs/types/result/module.f.d.ts` (upstream 0.41.0) — bare-throw semantics of `assert`/`unwrap`
- `node_modules/functionalscript/fjs/effects/module.f.js` + `.d.ts` (upstream 0.41.0) — `do_`, `step`, `pure`, `Do`/`Pure`/`Effect` shapes, `OperationMap<O,R>`/`Return<O>` typing (basis for the Critical Finding)
- `node_modules/functionalscript/fjs/effects/node/module.f.d.ts`, `fjs/effects/node/virtual/module.f.d.ts` (upstream 0.41.0) — `Import`, `Module`, `NodeOp`, `State`, `virtual`
- `.planning/phases/07-.../07-CONTEXT.md`, `.planning/REQUIREMENTS.md`, `.planning/STATE.md`, `.planning/ROADMAP.md`, `AGENTS.md`, `CLAUDE.md`, `.planning/config.json` (this repo) — locked decisions, requirement IDs, house rules, workflow flags

### Secondary / Tertiary

None — every claim above traces to a file read directly in this session; nothing relies on unverified web search or training-data recall (per the phase's explicit "Research: Not needed" instruction, no external search was performed).

## Metadata

**Confidence breakdown:**
- Existing-code map (interpret, guestCtx, materialize, server, dialects, exact): HIGH — every signature quoted was read directly, with line numbers
- Upstream fjs surfaces (mcp, stdio, cas, evo, rtti/toJsonSchema, asserts/result, effects): HIGH — same, read from `node_modules/functionalscript@0.41.0` directly
- The three "Critical Finding" architecture gaps (disk materialization, synchronous host map, ctx combinator gap): MEDIUM confidence that they are real gaps (derived from direct reading of type signatures and full-file greps, not assumption), LOW confidence on the *correct resolution* for each (marked `[ASSUMED]` in the Assumptions Log) — these need explicit planner/user confirmation before task breakdown
- Validation Architecture: HIGH — built directly on this repo's own established proof patterns (`fjs/effects/node/virtual`, the `casRefresh` multi-step session pattern, the STATE.md-recorded "prove ordering by the prevented side effect" lesson)

**Research date:** 2026-08-04
**Valid until:** Should be re-checked if `functionalscript` is upgraded past 0.41.0 before this phase is planned/executed (the 128 KiB constant, `errorResult`, and `toJsonSchema` locations are all upstream and could move); otherwise stable — no external ecosystem to go stale.
