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

## 2. Use `StringMap` from FunctionalScript

Instead of

```ts
/**
 * @typedef {{ readonly [K in BoxKey]?: string }} MoneyBoxes
 */
```

write this

```ts
/**
 * @typedef {StringMap<BoxKey, string | undefined>} MoneyBoxes
 */
```

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

## 10. More declarative definitions, less imperative

## 11. One source of truth

Similar to DRY, but more about grouping definitions

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
            () => okResult('refreshed')))
    },
```
