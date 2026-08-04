# `match` in `fjs/effects/module.f.js` does plain bracket lookup, so a plain-object `OperationMap` is not a safe whitelist

**Target:** `fjs/effects/module.f.js:282`, `functionalscript` `0.40.0`

## Summary

`match` dispatches an operation by indexing the map with an attacker/agent-supplied string
and calling the result:

```js
export const match = map => e => {
    if (typeof e === 'function') { return ['done', e()] }
    const { command, payload, continuation } = e
    return ['cont', map[command](...payload), continuation]
}
```

`map[command]` is a plain bracket lookup on whatever object `map` is. If `map` is an
ordinary object (`{ casRead: ... }`), `command` is not restricted to the keys the caller
intended to whitelist — it also resolves anything reachable via the prototype chain
(`constructor`, `toString`, `valueOf`, `__defineGetter__`, etc.), and any *guard* a caller
writes in front of `match` to restrict `command` to "known" values needs to account for
that, or it is not actually a restriction.

Concretely: a caller who builds `map` as a whitelist of permitted operations and guards
dispatch with `command in map` or `map[command] !== undefined` has not built a whitelist.
Both checks return `true` for prototype properties that were never whitelisted.

## Reproduction

Against a plain-object whitelist holding exactly one permitted operation:

```js
// The whitelist as a runner would build it: a plain object with one permitted op.
const map = { casRead: (h) => `bytes:${h}` }

const probes = ['casRead', 'fetch', 'constructor', '__defineGetter__', 'toString', 'valueOf']
console.log('guard behaviour on a PLAIN-OBJECT whitelist')
console.log('command            | in    | !==undef | hasOwn')
for (const c of probes) {
  const a = c in map
  const b = map[c] !== undefined
  const d = Object.hasOwn(map, c)
  console.log(`${c.padEnd(18)} | ${String(a).padEnd(5)} | ${String(b).padEnd(8)} | ${d}`)
}

// Does the `in` guard actually let a non-whitelisted op dispatch?
const guardedIn = (m) => (cmd, ...args) => {
  if (!(cmd in m)) return ['refused', cmd]
  return ['cont', m[cmd](...args)]
}
console.log('\n--- `in` guard vs __defineGetter__ ---')
try {
  const r = guardedIn(map)('__defineGetter__', 'pwned', () => { throw new Error('ARBITRARY CODE RAN') })
  console.log('guard verdict:', r[0], '(expected "refused" if the guard were correct)')
  console.log('getter installed on the whitelist object:', Object.hasOwn(map, 'pwned'))
  try { map.pwned } catch (e) { console.log('reading it →', e.message) }
} catch (e) { console.log('threw:', e.message) }

console.log('\n--- Object.hasOwn guard, same attack ---')
const guardedOwn = (m) => (cmd, ...args) => {
  if (!Object.hasOwn(m, cmd)) return ['refused', cmd]
  return ['cont', m[cmd](...args)]
}
const map2 = { casRead: (h) => `bytes:${h}` }
console.log('verdict:', guardedOwn(map2)('__defineGetter__', 'pwned', () => {})[0])
console.log('polluted:', Object.hasOwn(map2, 'pwned'))
```

The script is standalone — it imports nothing, and demonstrates the property-lookup
semantics `match` relies on rather than calling `match` itself. `match` has no guard at
all (`map[command](...payload)` dispatches directly), so `__defineGetter__` reaches it
unconditionally; the `in` / `!== undefined` arms below are what a caller would plausibly
add in front of `match` to build a whitelist, and they do not close it. Actual output on
Node:

```
guard behaviour on a PLAIN-OBJECT whitelist
command            | in    | !==undef | hasOwn
casRead            | true  | true     | true
fetch              | false | false    | false
constructor        | true  | true     | false
__defineGetter__   | true  | true     | false
toString           | true  | true     | false
valueOf            | true  | true     | false

--- `in` guard vs __defineGetter__ ---
guard verdict: cont (expected "refused" if the guard were correct)
getter installed on the whitelist object: true
reading it → ARBITRARY CODE RAN

--- Object.hasOwn guard, same attack ---
verdict: refused
polluted: false
```

## Impact

`fetch` (not a real property of `Object.prototype`) is correctly refused by every guard —
that's the case the naive guard was written for, and it's why the hole is easy to miss.
But `constructor`, `toString`, `valueOf`, and `__defineGetter__` are all inherited from
`Object.prototype`, so `command in map` and `map[command] !== undefined` both return `true`
for them even though they were never added to `map`.

Dispatching `__defineGetter__` under an `in`-based guard calls
`map.__defineGetter__('pwned', <attacker-controlled function>)`, which installs a getter
**on the whitelist object itself**. The next time anything reads `map.pwned` (or any other
code that later probes the map), the attacker-controlled function runs. In the
reproduction above, that function throws `Error: ARBITRARY CODE RAN` — in place of a
throw, it can run anything the caller has scope to do.

`Object.hasOwn(map, command)` refuses every one of these probes correctly and leaves the
map unpolluted (`polluted: false` above), because it does not consult the prototype
chain.

## Fix

Two independent, additive changes, both named because either alone is only half the
mitigation:

1. **`Object.hasOwn(map, command)` instead of bracket lookup / `in` / `!== undefined`.**
   `Object.hasOwn` only reports own, non-inherited properties, so prototype members like
   `constructor` and `__defineGetter__` are correctly refused regardless of what `map`
   is.
2. **A null-prototype map** — build `map` as `{ __proto__: null, casRead: ... }` (or
   `Object.create(null)` plus assignment) wherever `match` is used as a restricted
   dispatcher. This is belt-and-braces: it removes the inherited properties entirely,
   so even a caller who still writes `command in map` is safe.

Whether the fix lands inside `match` itself (e.g. `match` internally uses
`Object.hasOwn` and treats a miss as a `['refused', command]` return instead of an
uncaught `TypeError`, addressing both this soundness gap and the unrelated raw-throw
ergonomics issue in the same change) or is left to callers with a documented convention,
either resolves this report. We would favor `match` enforcing `Object.hasOwn` internally,
since that removes the failure mode for every caller rather than relying on each call
site to remember it.
