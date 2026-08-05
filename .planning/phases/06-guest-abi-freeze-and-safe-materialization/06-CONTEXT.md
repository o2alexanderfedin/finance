# Phase 6: Guest ABI Freeze and Safe Materialization - Context

**Gathered:** 2026-08-04
**Status:** Ready for planning

<domain>
## Phase Boundary

The vocabulary every stored program is written against is fixed, expressed in the type system, and
a blob becomes an executable module without inheriting the ways that go wrong.

In scope: the guest ABI module (the `CasOp` vocabulary and the entry-point type), the
import-specifier allow-list, content-hash-derived materialization filenames, and the
materialize-and-run path reached through the `import_` effect. Requirements EXEC-07, EXEC-09,
SEC-02, SEC-03.

Out of scope: `fjs_run` itself as an MCP tool, run records, and the tool handler's CAS writes
(all Phase 7, EXEC-08/10/11/12). This phase makes a blob safely *runnable*; it does not expose
running it over the wire.
</domain>

<decisions>
## Implementation Decisions

### `CasOp` does not exist upstream. We define it — verified, not assumed

The roadmap and REQUIREMENTS both write `Effect<CasOp, T>` as though `CasOp` were an fjs type.
It is not. What fjs has is:

| fjs type | what it actually is |
|---|---|
| `FileCasOperation` | the **filesystem** effects the CAS performs internally — `ReadBytes`, `Mkdir`, `WriteBytes`, `Rename`, `Rm`, `Stat`, … |
| `Cas<O>` | `read`/`write`/`list` over those |
| `NodeOp` | `Access │ All │ Await │ Fetch │ Fs │ Http │ Forever │ Import │ MemOp │ Now │ RandomInt │ Read │ Sandbox │ Write │ Test` |

`FileCasOperation` is emphatically **not** the guest vocabulary — it contains `WriteBytes`, `Rm`
and `Rename`. Handing it to a guest would hand it the store. `CasOp` is a name this project must
define, and defining it is most of EXEC-07.

### The vocabulary already exists — as a test fixture, and that is the thing to promote

`fjs/exec/module.f.js` lines 23–46 sit under a header that reads **`── Test fixtures ──`**:

```js
/** @typedef {readonly ['casRead', (a: string) => string]} CasRead */
/** @typedef {readonly ['evoList', (a: string) => string]} EvoList */
/** @typedef {readonly ['evoHead', (a: string) => string]} EvoHead */
/** @typedef {readonly ['evoRevision', (a: string) => string]} EvoRevision */
/** @typedef {CasRead │ EvoList │ EvoHead │ EvoRevision} TestOp */
```

Four read-only commands, `string -> string`, with a null-prototyped map. Phase 3 built them to
have something to refuse; Phase 6's job is to promote them into the real, frozen vocabulary in
their own module and let `fjs/exec`'s proof keep its fixtures. STATE.md's locked decision holds:
**the guest whitelist stays read-only — `casWrite`/`evoAdd` are never in it**, because the tool
handler writes the result and run record (Phase 7, EXEC-10).

The payload/return types are the open part. Phase 3's fixtures are `string -> string` for
convenience; a real `casRead` returns bytes or a decoded document. Getting this wrong is cheap to
fix now and expensive after programs exist — nothing has been stored yet.

### `any` in `fjs/exec` is legitimate and must stay

`const unsafeDo = /** @type {any} */ (do_)` (line 56) is the **only** `any` under `fjs/` and it is
confined to the test-fixture section. Its documented purpose is to construct probes a real
`CasOp`-typed program could not construct — exactly the programs whose refusal EXEC-03 proves.
Removing it would delete the ability to test the runtime backstop. Do not "fix" it.

### Criterion 1 needs a negative-compile harness, and that is a real design task

"One reaching for `Fetch`, `Fs`, `Http`, or `Forever` **fails `tsc`**" cannot be proven by a
passing test — the artifact is a compilation that must *fail*. The suite's whole discipline is
that a green run means something, so a fixture that fails to compile cannot live in the main
`tsc` pass.

The precedent is in this repo: Plan 05-01's executor proved the generic `base` helper by
compiling a deliberately wrong literal and capturing `TS2322`. Same shape here — fixtures outside
the main `include`, compiled on demand, asserting a **non-zero exit and the expected error code**.
An assertion that merely checks "exit != 0" would pass on a typo in the fixture, so the error code
and the offending symbol both have to be pinned.

### Criterion 2 forces the `ctx` question, and EXEC-07's wording under-specifies it

EXEC-07 says the entry point is typed `(args) => Effect<CasOp, T>`. Criterion 2 says a stored
program "uses only the **injected** `ctx`" with **zero `import` statements**, because a CAS blob
cannot resolve bare specifiers. Those two only reconcile if `ctx` arrives as a parameter — there
is nowhere else for it to come from.

**Decision: the entry point is `report`, curried — `ctx => args => Effect<CasOp, T>`.** The
host supplies `ctx` (the vocabulary); the caller supplies `args`. The inner arrow is literally
`(args) => Effect<CasOp, T>`, so EXEC-07's signature is satisfied rather than reinterpreted. The
name follows fjs's convention of naming entry points by role — `proof` for tests, `main` for Node
CLI programs, and a report program is the third role, which is the reasoning EXEC-07 itself gives.

`main` is wrong in both directions and the requirement says why: `Program<O> = (options:
NodeProgramOptions) => Effect<O, number>` — verified at `fjs/effects/node/module.f.d.ts:299` — so
it returns an exit code, not a report, and `NodeProgram = Program<NodeOp>` *declares* the right to
reach the network.

### SEC-02: the allow-list is empty for guests, and that is not a cop-out

Criterion 2 requires zero imports in a stored program. So the allow-list a guest program is
checked against contains nothing, and every specifier is rejected — which is exactly what
criterion 3 demands for `https://attacker/x.js` and `node:fs`.

Write it as `allowed => source => Result`, defaulting to empty, rather than hardcoding "reject
all". The parameter costs one line, and the alternative — a function named for an allow-list that
cannot express one — is the kind of name that stops being true later. It stays ~20 lines either
way, as the requirement estimates.

The check runs **before** materialization. After materialization it is worthless: `import()`
executes the module body immediately, and REQUIREMENTS' own accepted-risks section records that
this happens with full Node privileges.

### SEC-03: the hash is the filename, because the ESM cache never evicts

Node's ESM cache is keyed by URL and never evicts. A reused temp filename therefore silently
re-runs the **first** program — the second program's bytes are never executed and nothing
reports an error. Criterion 4 is stated as two halves and both are needed: distinct programs get
distinct filenames, **and** re-running the same hash reuses the cache. Proving only the first
would pass for a scheme that appended a counter.

### Claude's Discretion

- Module layout for the ABI (`fjs/guest/`), the specifier check, and materialization.
- The concrete payload/return types of the four operations.
- Where the negative-compile fixtures live and how the harness invokes `tsc`.
- The materialization path convention, provided the filename is hash-derived.

</decisions>

<code_context>
## Existing Code Insights

### Verified fjs mechanics — all executed against 0.41.0, none assumed

| Fact | Where |
|---|---|
| `import_` **is** an effect: `type Import = ['import', (path: string) => IoResult<Module>]`, `export declare const import_: Func<Import>` | `fjs/effects/node/module.f.d.ts:133-134` |
| `virtual` implements `import` | `fjs/effects/node/virtual/module.f.js:88, 382` |
| `JsModule = () => Module`, and `Entity = readonly Vec[] │ Dir │ JsModule` — a module can sit at a virtual path | `fjs/effects/node/virtual/module.f.d.ts:12-13` |
| The idiom for placing one: `const root = { 'a.f.ts': (() => ({})) }` | `fjs/effects/node/virtual/proof.f.js:80-84` |
| `Program<O> = (options: NodeProgramOptions) => Effect<O, number>` | `fjs/effects/node/module.f.d.ts:299` |

So EXEC-09 and criterion 5 are both buildable today with no upstream change. This was the phase's
largest unknown and it is closed.

### What this phase builds on

| From | What |
|---|---|
| Phase 3 | `fjs/exec` — `interpret`, `stepBudget`, the refusal message, and the four fixture ops to promote |
| Phase 4 | `fjs/exact` — money helpers a report program will need in `ctx` |
| Phase 5 | `fjs/document/*` — the dialects a `casRead` result decodes into |

### Established patterns

- All source `.f.js` under `fjs/`, pure, ESM. Only `index.js`, `all.test.js` and the two
  root-level harnesses are impure.
- Tests are `proof` exports discovered by root `all.test.js`. **`node --test <source-file>` is a
  fake pass** — only `npm test` / `node --test all.test.js` run them.
- **`npm test` is `tsc && node --test`.** A mutation that fails to compile never reaches a test
  and proves nothing about the proofs — Phase 5 lost three mutations that way before noticing.
- Maximally strict `tsc`; never relax a flag. `exactOptionalPropertyTypes` does **not** catch a
  spread carrying `undefined` — Phase 5's proof caught what the compiler did not.
- Suite is green: 118 pass / 0 fail in this worktree (2295 on the main checkout, which has the
  `functionalscript` submodule initialized — 2177 of those are upstream's).

</code_context>

<specifics>
## Specific Ideas

**Criterion 1 is the one that can be faked.** A negative-compile harness that asserts only a
non-zero exit passes when the fixture has a typo. Pin the TS error code and the offending symbol.

**Criterion 4 needs both halves proven separately.** Distinct-hash-distinct-filename, and
same-hash-reuses-cache. A counter-suffix scheme satisfies the first and silently breaks the
second, which is the bug SEC-03 exists to prevent.

**Mutation-test the specifier check.** Phases 3, 4 and 5 were all validated by breaking them.
The one that matters here: make the check run *after* materialization instead of before and
confirm a proof fails. If nothing fails, SEC-02 is decorative — the module body has already run.

**Do not let the vocabulary leak write access.** `FileCasOperation` contains `WriteBytes`, `Rm`
and `Rename`. A proof should assert the guest op union does not include them, so a later widening
is caught rather than reviewed.

</specifics>

<deferred>
## Deferred Ideas

- **`fjs_run` as an MCP tool, run records, the tool handler's CAS writes** — Phase 7
  (EXEC-08/10/11/12). This phase stops at "a blob can be safely materialized and run".
- **Child-process isolation** — Phase 15, and it needs research. REQUIREMENTS' accepted-risks
  section records that `import()` runs the module body with full Node privileges in-process, and
  that Node's permission model has no network permission, so exfiltration is unmitigated
  in-process. Nothing in this phase changes that; the specifier allow-list narrows the *reachable*
  code, not the privileges it runs with.
- **Widening the guest vocabulary beyond the four read-only commands.** Adding one is cheap; the
  point of freezing is that it stops being cheap once programs exist.

</deferred>
