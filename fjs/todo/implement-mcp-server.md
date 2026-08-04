# Implement the MCP server

Status: **spec, not implemented.** Week 1 Track A of [../../todo/plan.md](../../todo/plan.md).

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

`functionalscript@0.40.0`. Note the split: the generic protocol helpers are at
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
// fjs/effects/module.f.js:282
export const match = map => e => {
    if (typeof e === 'function') { return ['done', e()] }
    const { command, payload, continuation } = e
    return ['cont', map[command](...payload), continuation]
}
```

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
   locked down. `Cas<O>` is generic in its underlying operation set precisely so
   the filesystem can stay server-side, inside the handlers. Whether `casWrite`
   is in the vocabulary at all depends on open question 5.
2. **Guard the boundary.** A stored blob is arbitrary JS and can emit any
   `command` string regardless of its declared type, since the type system does
   not reach across CAS. Guard dispatch with `Object.hasOwn` (or build the map
   with a `null` prototype) and turn a miss into
   `operation not permitted: <command>` as an `errorResult`.

Neither needs anything from FunctionalScript. Rationale and the corrected
analysis — including why "partial `OperationMap`" was a false requirement — are
in [restricted-runner-operation-map.md](./restricted-runner-operation-map.md).

Requirement 2 also closes, locally, the one real fjs bug here: `map[command]`
resolves inherited `Object.prototype` members and invokes them with the payload.
Filed upstream as
[functionalscript#1419](https://github.com/functionalscript/functionalscript/pull/1419).

### Known limitation: import-time execution

The whitelist governs the *effect* layer. It does not govern `import()`, which
executes the module's top-level body with full Node privileges before any effect
is interpreted. A blob that runs `fs.rmSync` at module scope is not stopped by
an empty operation map.

Genuine FunctionalScript modules are side-effect-free by construction, but
nothing verifies that for an arbitrary blob pulled out of CAS. Accepted for
Week 1 because the only user is trusted and local. Week 5 revisits it — most
plausibly by parsing the source with FunctionalScript's own `djs/parser` before
importing, which would enforce the language subset rather than assume it.

This must not silently become the permanent design. If the audience ever widens
beyond one local user, it is a blocker.

## Testing

Per AGENTS.md, tests are `proof` exports discovered by the root
[../../all.test.js](../../all.test.js). The server itself cannot be proof-tested
directly — `casMcpServer` has the same problem, and FunctionalScript's own proof
for it only checks that it constructs. Test the pieces instead:

- the restricted runner, against a hand-built operation map — including the
  refusal path for an operation outside the whitelist;
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
