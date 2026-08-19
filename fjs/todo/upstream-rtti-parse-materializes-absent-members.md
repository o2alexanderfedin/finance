# Upstream: 0.46.0 leaves no typed structural validator, and `parse` is not a drop-in

Status: **OPEN, and it is the one thing in the 0.46.0 migration that this project cannot fix on
its own.** Found 2026-08-18 during stage 2, by the suite — not by reading. `tsc` is entirely
happy with the thirteen modules this breaks.

## What is missing

0.43.1 shipped `fjs/types/rtti/validate`:

```ts
validate: <T extends Type>(rtti: T) => Validate<T>   // Validate<T> = (value: Unknown) => Result<Ts<T>, ValidationError>
```

It **checked** a value and, on success, returned **the value it was given** — `ok(value)`,
verbatim, in every branch of the 0.43.1 source. 0.46.0 restructures that directory into `parse`,
`common` and `data`, and neither survivor does the same job:

| | signature | on success it returns | typed? |
|---|---|---|---|
| 0.43.1 `rtti/validate`'s `validate` | `(rtti: T) => (v: Unknown) => Result<Ts<T>, ValidationError>` | **the input value** | yes |
| 0.46.0 `rtti/parse`'s `parse` | same shape (`Parse<T> = Validate<T>`) | **a freshly built value** | yes |
| 0.46.0 `rtti/data`'s `validate` | `(data: Data) => (v: Unknown) => ResultE` | the input value | **no** — `ResultE` erases the payload to `Unknown` |

There is no fourth. `grep -rl 'export declare const validate' node_modules/functionalscript/fjs`
returns `rtti/data`, `media/note`, `media/lock` and `media/revision`; the last three are
document-specific.

## Why `parse` cannot stand in

`parse` rebuilds the struct with **every declared key present**, filling an absent optional
member with `undefined`:

```js
import { parse } from 'functionalscript/fjs/types/rtti/parse/module.f.mjs'
import { option, string } from 'functionalscript/fjs/types/rtti/module.f.mjs'

const r = parse({ a: string, b: option(string) })({ a: 'x', extra: 'e' })
// r[0]                        -> 'ok'
// Object.keys(r[1])           -> ['a', 'b']      <- 'b' was not in the input
// Object.hasOwn(r[1], 'b')    -> true            <- 0.43.1: false
// Object.hasOwn(r[1], 'extra')-> false           <- 0.43.1: true
```

This project distinguishes **absent** from **present-and-undefined** as a hard rule, and proves
it by name across the document dialects: *"absent is absent, never a materialized undefined"*,
*"an absent assertion must stay absent, not materialize as false"*, *"absent box must stay
absent"*. The distinction is not decorative. A stored document is JSON in CAS, and a box that is
absent means *the payer did not report it*, which is a different fact from *the payer reported
nothing*. The second half is as bad: an undeclared key present in a stored document is **dropped
from the returned value**, so anything forwarding a validated document forwards a lossy copy.

**Measured cost: 54 proof leaves, in 13 modules, all of which typecheck cleanly** —
`fjs/document/{1098e,1098t,1099g,1099nec,business_expenses,credits,form3921,form3922,ira,k1_1041,k1_1065,k1_1120s}`
and `fjs/return/profile`. Every one of them is a *behavioural* failure with a green typecheck,
which is the dangerous direction.

## Why there is no local workaround here

Each escape hatch lands on something AGENTS.md forbids:

- Keep `parse` for the check and pass the ORIGINAL value onward — the original is typed
  `Unknown`, so narrowing it to `Ts<T>` needs a cast.
- Use `rtti/data`'s `validate(toData(rtti))` — preserves the value, but `ResultE` erases the
  payload, so the same cast reappears at all 31 call sites.
- Hand-write a `(value: Unknown) => value is Ts<T>` predicate over `parse` — a soundness claim
  the compiler cannot check, asserted 31 times. Not `as`, but the same act.
- Strip the materialized `undefined`s back out after `parse` — reintroduces the undeclared keys
  problem, cannot recover the dropped ones at all, and puts a generic rtti concern in app code.

Rewriting the proofs to accept materialized keys is not on the list, because the rule they
encode is about stored financial documents, not about the proofs.

## What the upstream fix should look like

Re-expose the 0.43.1 behaviour beside `parse`, under whatever name distinguishes the two —
`check`, or `validate` restored in `rtti/common`:

```ts
validate: <T extends Type>(rtti: T) => Validate<T>   // ok(value), verbatim; no reconstruction
```

The implementation already exists: it is 0.43.1's `rtti/validate/module.f.js`, which is built
from the same `visit`/`eachEntry`/`orVisit` kernel `common` now exports, and whose container
branches differ from `parse`'s only in returning `ok(value)` instead of a rebuilt one. It needs
no new machinery.

The two operations are genuinely different and both are wanted: **`parse` is for deserializing a
foreign value into a known shape** (openness plus reconstruction is exactly right there), and
**`validate` is for asserting that a value this system already owns has the shape it claims**,
where reconstruction is not merely unnecessary but lossy. Collapsing them loses the second.

## Retirement condition

Deleted when a released FunctionalScript exposes a typed structural validator that returns its
input unchanged, this project's 31 `rttiValidate` call sites take it, and those 54 leaves are
green again.
