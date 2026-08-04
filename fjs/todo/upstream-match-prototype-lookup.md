# Upstream: `match` resolves commands through the prototype chain

Status: **reported, not fixed upstream.** No local workaround yet — there is no runner
code. Update [Local workaround](#local-workaround) as soon as there is one.

Target: `functionalscript` `fjs/effects/module.f.js`. Present in 0.40.0.

> **Supersedes** an earlier version of this file that framed the problem as "`match` has
> no notion of a partial `OperationMap`" and treated the raw `TypeError` on an absent
> operation as the gap. That framing was wrong on both counts; see
> [Not the issue](#not-the-issue-partial-maps-and-thrown-refusals) below. The real defect
> is narrower and more serious.

## The gap

`match` dispatches by indexing the map directly:

```js
export const match = (map) => (e) => {
    if (typeof e === 'function') { return ['done', e()] }
    const { command, payload, continuation } = e
    return ['cont', map[command](...payload), continuation]
}
```

`map[command]` is an ordinary property lookup, so it **walks the prototype chain**. For a
plain object map, every `Object.prototype` member is reachable and callable:

```
fetch              undefined
__defineGetter__   function
constructor        function
toString           function
valueOf            function
```

So an operation named `__defineGetter__`, `constructor`, `toString`, or `valueOf` does not
miss the map — it resolves to a real function and gets **invoked with the effect's
payload**. In a module whose documented purpose is to bound what an effect may do, the
bound is escapable by naming an inherited property. `Object.hasOwn(map, command)` is the
fix.

## Why it matters here

The restricted runner ([implement-mcp-server.md](./implement-mcp-server.md)) is built on
exactly this dispatch: an `OperationMap` holding only whitelisted CAS/Evo operations is
what stops an agent-authored program from reaching outside. That argument is sound for
`fetch` — genuinely absent — and unsound for anything inherited from `Object.prototype`,
which is reachable no matter what the map contains.

The inputs are untrusted (a stored blob, authored by an LLM that read a document it was
handed), so this is a live path, not a theoretical one.

## Not the issue: partial maps and thrown refusals

Two things that look like defects and are not, recorded so they are not "fixed" again:

**`OperationMap` is total by construction.** It is a mapped type over the operation union:

```ts
export type OperationMap<O extends Operation, R> = {
    readonly [K in O[0]]: (...payload: Pr<O, K>[0]) => R
}
```

and `match` is `<O1 extends O, T>(e: Effect<O1, T>)` — the effect's operation set must be a
*subset* of the map's. In well-typed code a missing entry cannot occur. There is no
"partial map" concept missing from fjs; the design deliberately has no such thing. The
`TypeError` we would hit arises only because *we* feed untyped, untrusted effects from CAS
into a typed API — that is our problem to solve, not a hole in `match`.

**A refusal is a value, not an exception.** fjs already settles this: every fallible node
operation returns `IoResult<T> = Result<T, unknown>`.

```ts
export type Fetch    = ['fetch',    (url: string) => IoResult<Vec>]
export type ReadFile = ['readFile', (path: string) => IoResult<Vec>]
export type Exec     = ['exec',     (command: string, stdin?: string) => IoResult<ExecResult>]
```

A refused `fetch` should therefore **return an error `IoResult`**, exactly as a failed
`fetch` does — not throw, and not need a new `match` arm to report itself. The map entry
for a non-whitelisted operation returns `error('operation not permitted: fetch')`, which
is a well-typed `IoResult<Vec>`. Nothing upstream has to change for this to work, and it
keeps refusal in the same channel as every other IO failure, so a program can observe and
report it the ordinary way.

This is why the runner should build a map that is **total over the operation set it is
willing to decode**, with refusal entries rather than omissions — see below.

## What the upstream fix should look like

One line, plus a test:

```js
return ['cont', Object.hasOwn(map, command) ? map[command](...payload) : /* … */, continuation]
```

The open part is what the `else` does, and it is a genuine API decision for FJS to make:
throwing keeps `match`'s current shape; returning a `['refused', command]` arm keeps
refusal in the value domain but widens `MatchResult` for every caller. Our own need is met
either way, because our map is total (above), so the guard only ever triggers on a command
outside the declared operation set entirely.

Worth stating plainly upstream: this is a security fix in a module documented as an
isolation mechanism, not a cosmetic one.

## Local workaround

*None yet.* When the runner is written it should do both:

1. Build the operation map **total** over the operations it decodes — whitelisted commands
   do the real work, every other declared command returns an error `IoResult`. This is the
   clean-refusal requirement, and it needs nothing from fjs.
2. Guard dispatch with `Object.hasOwn` before delegating, so an inherited name is refused
   rather than invoked. Defense in depth if a future runner path bypasses (1).

A `null`-prototype map (`Object.create(null)`, or `{ __proto__: null, … }`) also closes the
inherited-name path and is worth doing regardless, since it costs nothing.

Record what was actually built here, so Week 5 knows what to lift.

## Testing

The refusal proof must name the prototype members explicitly — `constructor`, `toString`,
`valueOf`, `hasOwnProperty`, `__defineGetter__` — and not just `fetch`/`readFile`/`exec`.
A suite that tests only genuinely-absent commands passes while the escape is wide open.

## Upstreaming

Week 5, per [../../todo/plan.md](../../todo/plan.md) — though the `Object.hasOwn` guard is
small enough to land upstream sooner. Delete this file once a released FJS version carries
it.
