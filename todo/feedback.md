# Feedback

## 1. Inconsistent JSDocs

```ts
/** The six schema field names {@link boxLabels} maps onto. */
/** @typedef {(typeof boxLabels)[number][1]} BoxKey */

/**
 * The money-box half of a converted document. Every key optional, in the
 * `exactOptionalPropertyTypes` sense — an absent box is an absent key, not
 * a key holding `undefined`.
 * @typedef {{ readonly [K in BoxKey]?: string }} MoneyBoxes
 */
```

It should be

```ts
/**
 * The six schema field names {@link boxLabels} maps onto.
 * @typedef {(typeof boxLabels)[number][1]} BoxKey
 */

/**
 * The money-box half of a converted document. Every key optional, in the
 * `exactOptionalPropertyTypes` sense — an absent box is an absent key, not
 * a key holding `undefined`.
 * @typedef {{ readonly [K in BoxKey]?: string }} MoneyBoxes
 */
```

## 2. Use `StringMap` / `OptionalMap` / `RequiredMap` from FunctionalScript

Never hand-write a record type. Since `0.43.0`
(`functionalscript/fjs/types/object/module.f.js`) the three shapes are separate
types, so the one you pick *is* the statement about the key set:

```ts
/** A record over the keys of `K`, each value possibly missing at runtime. */
export type OptionalMap<K extends string, T> = { readonly[k in K]?: T }

/** A record over the keys of `K`, each value required. `never` when `K` is `string`. */
export type RequiredMap<K extends string, T> =
    string extends K ? never : { readonly[k in K]: T }

/** A record with an open key set. Every value can be missing at runtime. */
export type StringMap<T> = OptionalMap<string, T>
```

Which to reach for:

- **Open key set** — an arbitrary string keys the map: `StringMap<T>`. It is now
  **one parameter**; the old two-parameter `StringMap<K, T>` is gone.

  ```ts
  /** @typedef {{ readonly [k: string]: Module | undefined }} ModuleMap */  // don't
  /** @typedef {StringMap<string, Module>} ModuleMap */                     // stale — 0.42.0 spelling
  /** @typedef {StringMap<Module>} ModuleMap */                             // do
  ```

- **Closed set, keys optional**: `OptionalMap<K, T>`. This is what `MoneyBoxes`
  in `fjs/document/1099int/from_ocr/module.f.js` is, and it should now say so
  rather than spelling the mapped type by hand:

  ```ts
  /** @typedef {{ readonly [K in BoxKey]?: string }} MoneyBoxes */  // don't
  /** @typedef {OptionalMap<BoxKey, string>} MoneyBoxes */          // do
  ```

  This is the upstream change the `0.42.0` version of this note asked for — the
  optional-literal-key form now exists, so the local mapped type is the
  workaround to delete. The meaning is unchanged: an absent box is an absent
  key, and under `tsconfig.json`'s `exactOptionalPropertyTypes`
  `{ interestIncome: undefined }` stays rejected.

- **Closed set, keys required**: `RequiredMap<K, T>`. Keep `K` a finite union of
  string literals. `RequiredMap<string, T>` is `never` by design — no object can
  carry every string as a key — but that guard is only an approximation: a
  template literal such as `` `x-${string}` `` slips through as a template index
  signature whose reads are typed `T` while the runtime value is `undefined`.

## 3. External Proofs

Use `proof.f.js` files for black-box unit tests.

## 4. Use `@import`

Use `@import` and then `@typedef` instead of `@typedef {import(`.

## 5. Avoid using RegEx

## 6. Avoid using `try` in `.f.js` files

## 7. DRY

For example:

```ts
export const dialect = 'vnd.fjs.w2'
/** The media type derived from {@link dialect}: `application/vnd.fjs.w2+json`. */
export const mediaType = `application/${dialect}+json`
```

And then

```
export const dialect = 'vnd.fjs.ocr'
/** The media type derived from {@link dialect}: `application/vnd.fjs.ocr+json`. */
export const mediaType = `application/${dialect}+json`
```

The only difference is `ocr` vs `w2`.

## 8. Use JSON parse and stringify functions from FunctionalScript

## 9. Remove `Object.setPrototypeOf(map, null)`

It was load-bearing when it was written: a plain `map[command]` index read
resolves inherited names (`'constructor'`, `'toString'`) to `Object.prototype`
members, so a command arriving as runtime data could select an arbitrary
inherited function and then supply its arguments.

That is closed upstream — `match` looks the handler up through `at`, which
reads via `getOwnPropertyDescriptor` and therefore only ever sees own
properties, yielding `null` (and an `assert`) for an inherited name. It was
closed in `0.42.0` and we are on `0.43.0`, so the null-prototype calls are
redundant and can go.

Recorded here so nobody reintroduces them later, reasoning from the old hazard.

## 10. More declarative definitions, less imperative

Say *what* the answer is, not the steps that accumulate it. `checkReferences`
in `fjs/document/w2/module.f.js` is the clearest case: three nested loops with
`continue` and early `return`, all computing one thing — the first badly
formatted money field.

```js
for (const field of moneyBoxFields) {
    const printed = r[field]
    if (printed === undefined) { continue }
    const message = moneyFieldError(field)(printed)
    if (message !== undefined) { return error(message) }
}
for (const entry of r.box12 ?? []) { /* … the same shape again … */ }
for (const entry of r.box15Through20 ?? []) { /* … and again, nested twice … */ }
```

The three loops differ only in how they name their `(label, printed)` pairs. Name
that, and the traversal disappears:

```js
const stateLocalFields = /** @type {const} */ ([
    ['stateWagesTipsEtc', e => e.stateWagesTipsEtc],
    ['stateIncomeTax', e => e.stateIncomeTax],
    ['localWagesTipsEtc', e => e.localWagesTipsEtc],
    ['localIncomeTax', e => e.localIncomeTax],
])

const labelledMoney = r => [
    ...moneyBoxFields.map(f => /** @type {const} */ ([f, r[f]])),
    ...(r.box12 ?? []).map(e => /** @type {const} */ ([`box12 code ${e.code}`, e.amount])),
    ...(r.box15Through20 ?? []).flatMap(e => stateLocalFields.map(
        ([name, pick]) => /** @type {const} */ ([`${e.state} ${name}`, pick(e)]))),
]

const firstMoneyError = r => labelledMoney(r)
    .flatMap(([label, printed]) => printed === undefined ? [] : [moneyFieldError(label)(printed)])
    .find(m => m !== undefined)
```

`checkReferences` then reads as its own specification: a formRevision check, a
box12-code check, and "the first money error, if any". The gain is not brevity —
it is that "which fields hold money" becomes a value you can print, test, and
reuse, instead of control flow you can only execute.

## 11. One source of truth

Similar to DRY, but more about grouping definitions: when two things must agree,
derive one from the other and let a proof hold them together, rather than
writing both and hoping.

`fjs/guest/module.f.js` already does this with the frozen CAS vocabulary. The
four names are written **once**:

```js
export const casOpNames = ['casRead', 'evoList', 'evoHead', 'evoRevision']
```

and everything else derives from or is pinned to that list — the `guestCtx`
object's keys, and any read-back validator that has to reject a command outside
the set. A proof holds the value side to the type side:

```js
vocabularyIsFrozenAtFour: () => {
    assertEq(casOpNames.join(','), 'casRead,evoList,evoHead,evoRevision')
    assertEq(Object.keys(guestCtx).join(','), casOpNames.join(','))
},
```

The test to apply: if adding a fifth operation means editing more than one
place, the places that were not edited are the bug — and the proof above is what
turns that from a latent bug into a failing test.

## 12. No nesting step

```ts
    () => step(buildCache(cas), newCache => step(write(cacheKey, newCache), () => pure(okResult('refreshed')))),
```

should be something like this

```ts
    () => {
        const step1 = step(
            buildCache(cas),
            newCache => write(cacheKey, newCache))
        return mapStep(
            step1,
            () => okResult('refreshed'))
    },
```
