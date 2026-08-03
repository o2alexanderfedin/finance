# Upstream: `match` has no notion of a partial `OperationMap`

Status: **reported, not fixed upstream.** No local workaround yet — there is no runner
code. Update the [Local workaround](#local-workaround) section as soon as there is one.

Target: `functionalscript` `fjs/effects/module.f.js`. Present in 0.40.0.

## The gap

`match` dispatches an operation by indexing the map and calling the result:

```js
export const match = map => e => {
    if (typeof e === 'function') { return ['done', e()] }
    const { command, payload, continuation } = e
    return ['cont', map[command](...payload), continuation]
}
```

For an operation absent from the map, `map[command]` is `undefined` and the call throws
`TypeError: map[command] is not a function`. There is no way to distinguish "this
operation is not permitted" from "the map is malformed", and nothing names the operation
that was refused.

## Why it matters here

The restricted runner ([implement-mcp-server.md](./implement-mcp-server.md)) is built on
exactly this behavior: an `OperationMap` holding only whitelisted CAS/Evo operations is
what stops an agent-authored program from reaching the network. That design is sound — an
operation not in the map genuinely cannot happen — but its *failure mode* is a raw
`TypeError`.

So the single most likely thing to go wrong (an agent writes a program that calls `fetch`)
produces an error that tells the agent nothing about what it did wrong or how to fix it.
Refusal is a normal, expected outcome here, not a crash, and it needs to read as one.

## What the upstream fix should look like

A partial map has to be expressible, and a refusal has to carry the operation name.
Sketches, in rough order of preference:

1. **`match` returns a result rather than throwing** — a `['refused', command]` arm
   alongside `['done', …]` / `['cont', …]`. Callers that want a throw can add one; callers
   that want to report a refusal (us) get the command name. Most expressive, but widens
   the return type for every existing caller.
2. **A partial-map variant** — e.g. `matchPartial(map)(onRefused)(e)`, leaving `match`
   untouched. Additive and non-breaking; slightly redundant.
3. **A better throw** — keep the shape, but check for the missing entry and throw an error
   naming the command. Smallest change, still conflates refusal with failure, and forces a
   `try`/`catch` in the runner.

Option 1 or 2 keeps refusal in the value domain, which is the point.

## Local workaround

*None yet.* When the runner is written, it will most likely wrap or replace `match` with a
version that checks `command in map` before dispatching and returns an `errorResult` like
`operation not permitted: fetch`. Record here what was actually done, so Week 5 knows what
to lift.

## Upstreaming

Week 5, per [../../todo/plan.md](../../todo/plan.md). Delete this file when a released FJS
version makes the workaround unnecessary.
