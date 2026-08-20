/**
 * Compile-time assertion primitives.
 *
 * Mirrors the upstream FunctionalScript spelling: `Assert` is
 * `fjs/asserts/types.ts`, `Equal` is `fjs/types/ts/types.ts`. They are
 * restated here so this directory stands alone as a study, and so the
 * examples read the same as the ones in the fjs tree.
 *
 * @module
 */

/**
 * Resolves only when `T` is exactly `true`; anything else is a compile
 * error (`TS2344: Type 'false' does not satisfy the constraint 'true'`).
 *
 * The type-level counterpart of C++'s `static_assert`.
 */
export type Assert<T extends true> = T

/**
 * Strict type identity.
 *
 * Both sides are wrapped in a generic function type whose return is a
 * *deferred* conditional. Because `T` is unresolved the checker cannot
 * evaluate either branch, so comparing the two function types falls back to
 * an identity comparison of `A` and `B` rather than ordinary structural
 * assignability.
 *
 * That strictness is the point. The naive mutual-extends form
 * (`A extends B ? B extends A ? true : false : false`) treats these as
 * equal, and `Equal` does not:
 *
 * - `{ a: number }` vs `{ readonly a: number }`
 * - `{ a: number }` vs `{ a?: number }`
 * - `any` vs `string`, `unknown` vs `any`
 *
 * Losing a `readonly` is exactly the kind of regression worth catching, so
 * the naive form is not a usable substitute.
 */
export type Equal<A, B> =
    (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2)
        ? true
        : false
