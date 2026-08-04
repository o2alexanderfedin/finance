# Phase 3: The Restricted Interpreter - Context

**Gathered:** 2026-08-03
**Status:** Ready for planning

<domain>
## Phase Boundary

A guest program can reach exactly the operations it is permitted, is refused actionably when it
reaches further, cannot run forever, and cannot misreport what it read.

In scope: `interpret(map)(effect)` and its proofs. Requirements EXEC-01, EXEC-03, EXEC-04,
EXEC-05, EXEC-06.

**Out of scope, and the boundary is load-bearing:** this module imports `fjs/effects` and nothing
else. No CAS, no Evo, no MCP, no filesystem. That constraint is what makes it fully proof-testable
in isolation, and success criterion 4 asserts it. If a task reaches for `fjs/cas` or
`fjs/server/module.f.js`, it is in the wrong phase.

Also out of scope: the guest ABI (`EXEC-07`, Phase 6), `fjs_run` (Phase 7), and the CAS-backed
operation implementations. This phase defines the *mechanism*, not the operations.
</domain>

<decisions>
## Implementation Decisions

### EXEC-02 is already delivered — do not rebuild it

fjs 0.41.0 fixed the prototype-dispatch hole upstream (`functionalscript#1419`). `match` now does:

```js
const handler = at(command)(map)      // getOwnPropertyDescriptor-based
assert(handler !== null, command)
```

Verified against the installed 0.41.0, not assumed: `casRead` dispatches; `fetch`, `constructor`,
`toString`, `valueOf` and `__defineGetter__` are all refused; re-running the 0.40.0 escape leaves
the whitelist unpolluted with no getter installed.

**No local guard is required.** A null-prototype map (`{ __proto__: null, … }`) stays as cheap
defence in depth, but it is not load-bearing and must not be presented as the security mechanism.

### Refusal is a value, not a throw

`interpret` returns a `Result`-shaped refusal rather than propagating a throw. Three reasons, in
order of weight:

1. **It is the recorded intent.** The original upstream request said it plainly: *"Option 1 or 2
   keeps refusal in the value domain, which is the point."* 0.41.0 delivered the soundness half and
   left this half to us.
2. **A refusal is a normal outcome here, not a crash.** The single most likely thing to go wrong is
   an agent writing a program that reaches for the network. That must read as a routine answer the
   agent can correct from.
3. **The throw is a trap.** `assert` throws the **bare command string**, not an `Error` —
   `typeof e === 'string'`, `e instanceof Error === false`, `e.message === undefined`. Any handler
   written the obvious way misses every refusal. Catching this correctly, once, in `interpret` is
   exactly what stops that mistake recurring at every call site.

### Step budget: 10,000, as a named constant

`asyncRun` is an unbounded `while (true)`. A generated loop with a wrong termination condition
otherwise hangs the single-process server silently — no response, no way to cancel.

10,000 is a runaway guard, **not a tuned limit**. It should be a named exported constant so it can
be changed without hunting a literal, and the budget-exceeded outcome is a refusal-shaped value like
any other, not a throw.

### The read set is observed, never declared

`interpret` accumulates reads as it dispatches. A program cannot forget to cite, or misreport, what
it read, because it is not the thing doing the reporting. This is what makes a run record's
`inputs[]` trustworthy in Phase 7.

### Claude's Discretion

- The concrete `Result` shape and refusal-message construction, provided the message names both the
  operation and the permitted set.
- Read-set representation (ordered vs set, dedup policy).
- Module path under `fjs/`.

</decisions>

<code_context>
## Existing Code Insights

### What exists

- `fjs/server/module.f.js` — Phase 2's MCP server. **Not imported here.** Phase 7 wires `interpret`
  into a tool; this phase does not.
- `fjs/index.f.js`, `index.js` — launcher, untouched by this phase.
- `npm test` → 7 pass, 0 fail; `npx tsc --noEmit` clean, on fjs 0.41.0.

### Reusable from fjs

| Need | Reuse |
|---|---|
| Operation dispatch | `match(map)(effect)` — `fjs/effects/module.f.js` |
| Effect combinators | `step`, `mapStep`, `historyStep`, `foldStep` — same module |
| In-memory interpretation for proofs | `fjs/effects/mock` |
| Assertions | `assert`, `assertEq` — `fjs/asserts` |

### Established patterns

- All source `.f.js` under `fjs/`, pure, ESM. Only `index.js`, `all.test.js` and the launcher are
  impure.
- **House style on effects: never nest steps.** Bind each link to its own name so chains read
  top-to-bottom; use `historyStep` when a later link needs an earlier link's value.
- Tests are `proof` exports discovered by root `all.test.js`.
- JSDoc typing, `@import { Name } from '...'` form. Maximally strict `tsc`; never relax a flag.
- Never use `l` as an identifier.

</code_context>

<specifics>
## Specific Ideas

**Success criterion 1 names the exact message format.** All of `constructor`, `toString`, `valueOf`,
`hasOwnProperty`, `__defineGetter__` and `fetch` must yield:

```
operation not permitted: <name>; permitted: casRead, evoList, evoHead, evoRevision
```

Assert on **the reported text**, not on the raw throw. The raw throw is fjs's behaviour; the reported
text is ours, and it is the part an agent reads.

**EXEC-04 wants the two-step escalation specifically** — install a getter for a denied command, then
call it. A single-dispatch probe is what made this hole look survivable the first time it was
assessed in this project. It was not. Test the chain to code execution, not just the first hop.

**Criterion 2 says "verified by a proof, not by observation."** A non-terminating chain must return a
bounded budget error. A test that hangs and gets killed proves nothing.

**Testing method:** only `npm test` / `node --test all.test.js` run proofs. `node --test <file>`
reports a **fake pass** — Node executes the file as a script and no leaf runs. Verified by injecting
a throwing leaf. See AGENTS.md.

</specifics>

<deferred>
## Deferred Ideas

- **The guest ABI** (`EXEC-07`) — Phase 6. `interpret` here is generic over its operation map.
- **`fjs_run` and run records** (`EXEC-08`/`EXEC-10`/`PROV-03`) — Phase 7, which consumes this
  phase's read set.
- **The real CAS/Evo operation implementations.** This phase's proofs run against a hand-built map
  under `fjs/effects/mock`; wiring the operations to a real store is Phase 7.
- **Upstreaming refusal-as-a-value into `match` itself.** Worth doing, but it is an fjs release, and
  this phase must not block on one. Record it in `fjs/todo/upstream-*.md` if the local shape turns
  out to be generic.

</deferred>
