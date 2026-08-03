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
(0.39.0 had no `fjs/protocol/` at all and put both under `fjs/mcp/`.)

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

The program's entry point convention should match `fjs run`'s: a module
exporting `main`. Reusing that convention means a program is runnable both
through the MCP tool and directly from the CLI, which matters for debugging.

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

So restricting what a program can do is exactly: **build an `OperationMap`
containing only the permitted operations.** A program requesting `fetch`,
`readFile`, or `exec` finds no entry. Nothing needs to be intercepted or
patched — an operation that is not in the map simply cannot happen.

Two requirements:

1. **Decide the whitelist.** CAS reads and Evo queries at minimum. Whether
   writes are included depends on open question 5.
2. **Refuse unknown operations cleanly.** Today `map[command]` is `undefined`
   for an absent op, so `match` throws `TypeError: map[command] is not a
   function` — an opaque failure that tells the agent nothing. The runner must
   detect the missing entry and surface something like
   `operation not permitted: fetch`, returned as an `errorResult`. Without this,
   the single most common failure mode (an agent writing a program that reaches
   for the network) is undebuggable.

Requirement 2 is a genuine gap in FunctionalScript, not something to work around
locally — `match` has no notion of a partial map. Worth raising upstream once
the shape is known; the AGENTS.md rule is to report FJS gaps rather than paper
over them.

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

Non-blocking, decide during implementation:

- Does `fjs_run` take arguments for the program beyond the hash?
- Reuse `casConfig`, or declare our own server identity? Our own is probably
  right, since this is not FunctionalScript's server, but it costs nothing to
  start with `casConfig`.
- Is the program's entry point `main` (matching `fjs run`), or something
  narrower that cannot express a long-running effect like `forever`?
