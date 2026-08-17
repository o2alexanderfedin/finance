# Implement the MCP server

Status: **IMPLEMENTED AND SHIPPED.** Corrected 2026-08-17 (MAINT-04); this line read
*"spec, not implemented"* for the whole of the project's life, including the ten phases of
milestone v2 that were built on top of the thing it said did not exist.

The server ships as `finance-mcp 0.12.0` on MCP protocol `2025-11-25` with **13 tools** —
`cas_add`/`cas_get`/`cas_list`/`cas_refresh`, `evo_add`/`evo_list`/`evo_head`/`evo_revision`,
`finance_schema`/`finance_tax_params`/`finance_documents_list`, and `fjs_run`/`fjs_check`. Verify
by starting it rather than by reading this file: `node index.js`, then `initialize` →
`notifications/initialized` → `tools/list` over stdio.

**Read the rest of this document as a historical spec, not as a description of the present.**
Where a passage below says a thing is unbuilt or undecided, check the code first — several such
passages were already false when this status line was corrected. Week 1 Track A of
[../../todo/plan.md](../../todo/plan.md).

## Goal

An MCP server, run over stdio by a single local user, that exposes everything
FunctionalScript's own `fjs mcp` exposes (CAS + Evo) *plus* the ability to
execute a FunctionalScript program stored in CAS — with the program's access to
the outside world limited to a whitelisted operation set.

The thesis: an agent should not compute a financial figure itself. It should
author a program, store it, and run it. The figure is then deterministic,
reviewable, and re-derivable from content hashes.

## Non-goals

- HTTP/SSE transport. stdio only.
- Multi-user, auth, per-user store isolation.
- Sandboxing or isolation of the executed program (see [Known limitation](#known-limitation-import-time-execution)).
- Validating that a stored blob is genuine FunctionalScript before importing it.

The last two are deliberate Week 1 deferrals, revisited in Week 5.

## What already exists

`functionalscript@0.41.0`. Note the split: the generic protocol helpers are at
`fjs/protocol/mcp/`, while `fjs/mcp/` is the *CAS server* built on top of them.

| Need | Reuse |
|---|---|
| Tool declaration + arg schema | `toolEntry(name, description, inputRtti, handle)` — `fjs/protocol/mcp/module.f.js` |
| Tool results | `okResult(text)` / `errorResult(text)` — same module |
| Registry → handlers | `fromRegistry(registry)` — same module |
| Protocol state machine | `mcpStep(config)(handlers)(stateKey)` — same module |
| stdio loop | `stdioTransport(handler)` — `fjs/protocol/mcp/stdio/module.f.js` |
| CAS tools | `casToolRegistry(home)(cacheKey)` — `fjs/mcp/cas/module.f.js` |
| Evo tools | `evoToolRegistry(evo(cas)(cacheKey))` — `fjs/mcp/evo/module.f.js` |
| Store / cache setup | `fileCas(sha256)(home)`, `initEvo(cas)` |
| Server config | `casConfig` — `fjs/mcp/module.f.js` (exported; reuse or replace) |
| Arg types | `string`, `option`, `array` — `fjs/types/rtti/module.f.js` |
| Effect runner | `asyncRun(operationMap)` — `fjs/effects/module.js` |

FunctionalScript's own assembly, for reference —
`casMcpHandlers` in [`fjs/mcp/module.f.js`](https://github.com/functionalscript/functionalscript/blob/main/fjs/mcp/module.f.js):

```js
export const casMcpHandlers = home => cacheKey => fromRegistry([
    ...casToolRegistry(home)(cacheKey),
    ...evoToolRegistry(evo(fileCas(sha256)(home))(cacheKey)),
])
```

Ours is that array with one more registry concatenated on. Everything needed is
exported, so no fork and no FJS release is required to iterate.

## Design

### Server assembly

Mirror `casMcpServer`: initialize the Evo cache, create the session state slot,
then drive `stdioTransport` with `mcpStep`. The only difference is the extra
registry. Keep the impure entry point (the thing `claude mcp add` launches) in a
plain `.js` file at the repo root, consistent with [../../index.js](../../index.js);
everything else stays `.f.js`.

### `fjs_run`

| | |
|---|---|
| args | `{ hash: string }` — the cBase32 hash of the program blob |
| action | read blob → `import()` → call entry point → interpret under the restricted runner |
| result | the program's return value, rendered as text |

Open: whether the result is returned inline or written back to CAS and answered
with its hash (plan open question 5). This changes whether `fjs_run` needs CAS
*write* access at all, so resolve it before implementing.

### Entry point convention — open

**Open, and it is not just a naming choice** (plan open question 6). FunctionalScript
names an entry point after its *role*, one signature per role:

| Role | Export | Shape |
|---|---|---|
| Test | `proof` | a value tree of thunks, walked by Emergent Testing; throws to fail |
| Node CLI program | `main` | `(options: NodeProgramOptions) => Effect<NodeOp, number>` |

Report programs are a third role, so on that precedent they get a third name rather than
borrowing one. `fjs r` resolves `main` literally — `step(import_(file), x =>
unwrap(x).main({ ...options, args }))` in `fjs/module.f.js:46` — so reusing the name
buys CLI runnability for debugging, which is the one real argument for it.

Against it, `main`'s signature is wrong for us in both directions:

- **It returns an exit code.** `Program<O> = (options) => Effect<O, number>`. We want the
  computed report back, not a `number`.
- **`NodeProgram` is `Program<NodeOp>`, and `NodeOp` includes `Fetch | Http | Fs |
  Sandbox | Forever | Import`** — precisely what the restricted runner exists to deny. A
  program typed `NodeProgram` *declares* it may reach the network.
- **`NodeProgramOptions` is CLI furniture** — `args`, `env`, `home`, `std`,
  `testContext`, `engine`. None of it applies.

The useful half is that `Program<O>` is already generic in exactly the dimension we care
about — the operation set. An entry point shaped `(args) => Effect<CasOp, T>`, with
`CasOp` the whitelist, **puts the sandbox in the type**: `tsc` rejects a program reaching
for `fetch` before it is ever stored, and the runner's runtime refusal becomes a backstop
rather than the only defense. It also settles the `forever` sub-question structurally,
since `Forever` is a `NodeOp` and simply would not be in `CasOp`.

Deciding this needs open question 5 resolved first (result disposition fixes `T`, and
whether writes are in `CasOp`).

### The restricted runner

This is the core of the work and the only genuinely new mechanism.

A FunctionalScript program does not perform effects — it *returns a description*
of them. `match` dispatches each requested operation through an `OperationMap`:

```js
// fjs/effects/module.f.js — as of 0.41.0
export const match = map => e => {
    if (typeof e === 'function') { return ['done', e()] }
    const { command, payload, continuation } = e
    const handler = at(command)(map)
    assert(handler !== null, command)
    return ['cont', handler(...payload), continuation]
}
```

`at` is `getOwnPropertyDescriptor`-based, so inherited names never resolve, and
`assert` throws the command string when there is no handler. Before 0.41.0 this
was a bare `map[command](...payload)`, which reached `Object.prototype`.

So restricting what a program can do is exactly: **define the operation
vocabulary it may express, and implement that vocabulary totally.** A program
requesting `fetch`, `readFile`, or `exec` finds no entry. Nothing needs to be
intercepted or patched — an operation outside the vocabulary cannot happen.

Note the emphasis: the map is *total over a narrow vocabulary*, not a wide map
with entries removed. Security by construction fails closed; security by
subtraction fails open on whatever was forgotten.

Two requirements:

1. **Define the vocabulary** — a *semantic* CAS/Evo operation set (`casRead`,
   `casList`, `evoHead`, …). **Not `FileCasOperation`**, which is `ReadBytes |
   Mkdir | Readdir | Access | Rename | Rm | RandomInt | Now | CreateExclusive |
   WriteBytes | Stat` — raw filesystem mutation. Whitelisting "the operations
   CAS needs" would hand a program `rm` on any path while the map still looks
   locked down: nothing in it is named `fetch` or `exec`, so the mistake
   survives review. Whether `casWrite` is in the vocabulary at all depends on
   open question 5.

   `Cas<O>` is generic in its underlying operation set precisely so this is
   possible — the interface is three semantic methods, and the filesystem is one
   *implementation* choice behind them:

   ```ts
   export type Cas<O extends Operation> = {
       readonly read:  (hash: Vec) => List<O, IoResult<Vec>>
       readonly write: <O1 extends Operation>(payload: List<O1, IoResult<Vec>>) => Effect<O | O1, IoResult<Vec>>
       readonly list:  () => Effect<O, readonly Vec[]>
   }
   ```

   `FileCas` is merely `Cas<FileCasOperation>`. So the filesystem operations stay
   server-side inside the handlers and never enter the program's operation set.
2. **Report the refusal at the boundary.** A stored blob is arbitrary JS and can
   emit any `command` string regardless of its declared type, since the type
   system does not reach across CAS. Since 0.41.0 fjs *detects* this for us, so
   what remains is catching it in `fjs_run` and rendering
   `operation not permitted: <command>` as an `errorResult`. **The thrown value
   is a bare string, not an `Error`** — `assert` is `(v, msg) => { if (!v) throw
   msg }` — so use the caught value directly; `e.message` is `undefined`, and an
   `e instanceof Error` branch misses every refusal.

Neither needs anything further from FunctionalScript, and in particular **no
"partial `OperationMap`" is required** — an earlier draft of this spec claimed
one was. `OperationMap`, `ToAsyncOperationMap`, and `MemOperationMap` are all
mapped types over their operation union (`{ readonly [K in O[0]]: … }`), hence
total by construction, and every runner constrains the effect to a *subset* of
the map (`<O1 extends O, T>(e: Effect<O1, T>)`). The map defines the operation
universe; effects must fit inside it. Noted so it is not re-derived.

The one real fjs bug here — `map[command]` resolving inherited `Object.prototype`
members and invoking them with the payload — was reported as
[functionalscript#1419](https://github.com/functionalscript/functionalscript/pull/1419)
and is **fixed in 0.41.0**, which this repo now uses.

### Known limitation: import-time execution

The whitelist governs the *effect* layer. It does not govern `import()`, which
executes the module's top-level body with full Node privileges before any effect
is interpreted. A blob that runs `fs.rmSync` at module scope is not stopped by
an empty operation map.

Genuine FunctionalScript modules are side-effect-free by construction, but
nothing verifies that for an arbitrary blob pulled out of CAS.

**Corrected 2026-08-17 (MAINT-04).** This paragraph carried two things DOCC-05 was raised to
remove, and they survived DOCC-01 being checked and its own verification document asserting a grep
was clean:

- *"Accepted for Week 1 because the only user is trusted and local."* That rationale was
  **deliberately struck** from the project's accepted-risk record. It is not the reason the hole is
  open. The reason is recorded in REQUIREMENTS.md's Accepted Risks and in the runner's own header:
  the risk is **accepted and deferred**, named, with a v2 milestone entry for child-process
  isolation — not excused by who is holding the keyboard.
- *"most plausibly by parsing the source with FunctionalScript's own `djs/parser`."* That remedy
  names a module this project does not use and would not reach for. A real FunctionalScript source
  validator built on `fjs/js/tokenizer` + `fjs/bnf` is the recorded v2 item, and REQUIREMENTS.md
  qualifies it *"if it is ever wanted — for portability, not security"*, which is close to the
  opposite of what this sentence implied.

**What is actually true today**, and it is narrower than either the old text or the obvious reading:
a stored program asking for network access **through the effect system** is refused by name, and a
disallowed import is refused before the module body runs — both proven, including against the
inherited-property escape routes (`constructor`, `__defineGetter__`, `valueOf`, `hasOwnProperty`,
`toString`), each with its own leaf. What is **not** defended is a program body calling
`globalThis.fetch` directly, which runs with host privileges. The demo says so on its own first page.

This must not silently become the permanent design.

## Testing

Per AGENTS.md, tests are `proof` exports discovered by the root
[../../all.test.js](../../all.test.js). The server itself cannot be proof-tested
directly — `casMcpServer` has the same problem, and FunctionalScript's own proof
for it only checks that it constructs. Test the pieces instead:

- the restricted runner, against a hand-built operation map — including the
  refusal path. Name the **inherited** commands explicitly (`constructor`,
  `toString`, `valueOf`, `hasOwnProperty`, `__defineGetter__`), not just
  `fetch`/`readFile`/`exec`: a suite testing only genuinely-absent commands would
  have passed against 0.40.0 while the prototype path was wide open. Add the
  two-step escalation as its own case — a `__defineGetter__` installing a getter
  for a denied command, then calling it — and assert on the *reported text*
  (`operation not permitted: fetch`) rather than the raw throw, since the
  string-not-`Error` handling is ours and the likeliest thing to regress;
- `fjs_run`'s tool handler, over a mock CAS rather than `~/.cas/`;
- format encode/decode round-trips once document types exist.

`fjs/effects/mock` and `fjs/effects/node/virtual` provide in-memory interpreters
for exactly this, so no test needs to touch the real filesystem.

## Open questions

Blocking:

- **Result disposition** (plan open question 5) — determines whether the
  whitelist includes CAS writes.
- **Entry point convention** (plan open question 6) — its name and its
  signature, per [the section above](#entry-point-convention--open). Downstream
  of question 5, and expensive to change once programs are stored in CAS, since
  every stored blob follows whatever convention was current when it was written.

Non-blocking, decide during implementation:

- Does `fjs_run` take arguments for the program beyond the hash? (Overlaps the
  entry point question — the argument shape *is* half of that signature.)
- Reuse `casConfig`, or declare our own server identity? Our own is probably
  right, since this is not FunctionalScript's server, but it costs nothing to
  start with `casConfig`.
