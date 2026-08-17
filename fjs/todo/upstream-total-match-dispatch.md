# Upstream: `fjs/effects`'s `match` refuses by throwing, so `interpret` needs a `try`

Status: **not filed upstream yet.** Recorded per AGENTS.md's rule that a workaround for an
FJS gap must never be silent.

Target: `functionalscript` `fjs/effects/module.f.ts`, `match`. Present in the version pinned
in this repo's `package.json`.

**Re-checked 2026-08-17 against 0.45.0** (release commit `8804e783`, the current npm release),
reading `fjs/effects/module.f.mjs` at that SHA. **Still open, unchanged.** `match` still ends its
lookup with `assert(handler !== null, command)` — it refuses by throwing rather than widening
`MatchResult`, so `fjs/exec`'s `try` is still load-bearing. (The bump itself did not land: 0.44.0+
is not consumable here — see [upstream-mjs-migration.md](./upstream-mjs-migration.md).)

## The gap

`match(map)(effect)` looks the effect's `command` up in `map` through `at` — an
own-property-only read, which is the right lookup — and then **asserts** when the result is
`null`:

> A `null` handler is an invariant violation, not an outcome: every `O1 extends O` the
> signature admits has its command in `map`, so reaching it means the node's `command` was
> never the `O1[0]` it claimed to be. It therefore throws (`assert`) rather than widening
> `MatchResult` with a variant no type-correct caller could ever observe.

That reasoning holds for a type-correct caller. `fjs/exec`'s `interpret` is not one, on
purpose: it exists to be the runtime backstop for a command string that *did* bypass `tsc` —
a stored program is a CAS blob, and nothing type-checked it. EXEC-07 is precisely the
requirement that such a command is refused at runtime rather than trusted.

So `interpret` has to observe the very outcome `match`'s signature says is unobservable, and
the only way to observe a throw is to catch it.

## The workaround in place here

`fjs/exec/module.f.js` wraps its dispatch step in `try`/`catch`, converting the bare thrown
string into this project's `Result` refusal:

```js
try {
    const result = match(map)(e)
    ...
} catch (thrown) {
    assert(typeof thrown === 'string')
    return error(refusalMessage(thrown, map))
}
```

**This is the only `try` left in any `.f.js` file in the repository**, and it is there
because a dependency refuses in the wrong shape. AGENTS.md §6.5 forbids `try`/`catch` in
`.f.js` files — FunctionalScript itself has none — so this is a standing violation that
cannot be removed locally.

## What the upstream fix should look like

Either would close it:

- **A total sibling.** `tryMatch(map)(effect): Result<MatchResult<…>, string>` — the same
  lookup, refusing with a value. `match` stays as the asserting wrapper for type-correct
  callers, exactly the shape `fjs/types/decimal`'s `parse`/`tryParse` pair takes in this
  repo after the same problem showed up there.
- **A third `MatchResult` variant.** `readonly ['unknown', string]`, carrying the offending
  command. This changes an existing type and every caller's exhaustiveness check, so the
  sibling is likely the cheaper landing.

The first is preferred: it adds a name rather than changing one, and a caller that genuinely
cannot observe the failure keeps the signature that says so.

## Related

- [`fjs/exec/module.f.js`](../exec/module.f.js) — the `try` this file exists to record.
- [`fjs/types/decimal/module.f.js`](../types/decimal/module.f.js) — the `parse`/`tryParse`
  pair, the local precedent for the shape being asked for.
- AGENTS.md §6.5 — the rule this workaround stands against.
