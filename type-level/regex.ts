/**
 * A regular-expression engine that runs in the type checker.
 *
 * `Match<Pattern, Input>` compiles the pattern *and* runs it, entirely
 * during type checking. Both arguments are string literal types.
 *
 * ```ts
 * type T = Match<'a+b?c', 'aaac'>   // true
 * type F = Match<'a+b?c', 'bc'>     // false
 * ```
 *
 * The interesting difference from {@link ./json.ts}: JSON is LL(1), so a
 * single left-to-right pass with one token of lookahead suffices. A regex
 * is not — `a*ab` against `'aab'` requires `a*` to give a character back.
 * So this needs **backtracking**, and the type level has no mutable state
 * to unwind. The standard trick is continuation passing: every matcher
 * takes the rest of the pattern as a continuation and returns the set of
 * all ways it could succeed, so "backtracking" becomes a union of
 * alternatives that the checker explores by distributing over it.
 *
 * That union *is* the engine's nondeterminism, which is why this reads more
 * like a Thompson NFA simulation than like a backtracking matcher.
 *
 * Supported: literals, `.`, character classes `[abc]` and `[^abc]`,
 * `*`, `+`, `?`, alternation `|`, groups `(...)`, anchors `^` and `$`.
 * Not supported: capture extraction, backreferences, `{n,m}`, lazy
 * quantifiers, lookaround. Each would cost depth; see the note at the end.
 *
 * @module
 */

import type { Assert, Equal } from './equal.ts'

// ───────────────────────── pattern → AST ──────────────────────────
// Parsed once into a tree, rather than re-scanned during matching. A
// character-by-character matcher would re-parse the pattern for every
// input position and exhaust the instantiation budget immediately.

type Node =
    | { readonly k: 'char', readonly c: string }
    | { readonly k: 'any' }
    | { readonly k: 'class', readonly neg: boolean, readonly cs: string }
    | { readonly k: 'star', readonly n: Node }
    | { readonly k: 'plus', readonly n: Node }
    | { readonly k: 'opt', readonly n: Node }
    | { readonly k: 'seq', readonly ns: readonly Node[] }
    | { readonly k: 'alt', readonly a: Node, readonly b: Node }
    | { readonly k: 'start' }
    | { readonly k: 'end' }

/** Reads the body of a `[...]` class, returning `[chars, negated, rest]`. */
type ReadClass<S extends string, Acc extends string = ''> =
    S extends `]${infer R}` ? [Acc, R]
    : S extends `${infer C}${infer R}` ? ReadClass<R, `${Acc}${C}`>
    : never

/**
 * Parses one postfix-quantified atom.
 *
 * Returns `[node, rest]`. Quantifiers bind tighter than concatenation, so
 * they are applied here rather than in {@link ParseSeq}.
 */
type ParseAtom<S extends string> =
    S extends `(${infer R}`
        ? ParseAlt<R> extends [infer N extends Node, infer R2 extends string]
            ? R2 extends `)${infer R3}` ? ApplyQuant<N, R3> : never
            : never
    : S extends `[^${infer R}`
        ? ReadClass<R> extends [infer Cs extends string, infer R2 extends string]
            ? ApplyQuant<{ k: 'class', neg: true, cs: Cs }, R2>
            : never
    : S extends `[${infer R}`
        ? ReadClass<R> extends [infer Cs extends string, infer R2 extends string]
            ? ApplyQuant<{ k: 'class', neg: false, cs: Cs }, R2>
            : never
    : S extends `.${infer R}` ? ApplyQuant<{ k: 'any' }, R>
    : S extends `^${infer R}` ? [{ k: 'start' }, R]
    : S extends `$${infer R}` ? [{ k: 'end' }, R]
    // Escapes are one level deep: `\.` is a literal dot. Classes like `\d`
    // are deliberately absent — `[0-9]` ranges would need expansion, and
    // expanding a range at the type level costs depth per character.
    : S extends `\\${infer C}${infer R}` ? ApplyQuant<{ k: 'char', c: C }, R>
    : S extends `${infer C}${infer R}` ? ApplyQuant<{ k: 'char', c: C }, R>
    : never

type ApplyQuant<N extends Node, S extends string> =
    S extends `*${infer R}` ? [{ k: 'star', n: N }, R]
    : S extends `+${infer R}` ? [{ k: 'plus', n: N }, R]
    : S extends `?${infer R}` ? [{ k: 'opt', n: N }, R]
    : [N, S]

/** Concatenation: atoms up to `|` or `)`. */
type ParseSeq<S extends string, Acc extends Node[] = []> =
    S extends '' ? [{ k: 'seq', ns: Acc }, '']
    : S extends `|${string}` ? [{ k: 'seq', ns: Acc }, S]
    : S extends `)${string}` ? [{ k: 'seq', ns: Acc }, S]
    : ParseAtom<S> extends [infer N extends Node, infer R extends string]
        ? ParseSeq<R, [...Acc, N]>
        : never

/** Alternation, the lowest-precedence operator. */
type ParseAlt<S extends string> =
    ParseSeq<S> extends [infer A extends Node, infer R extends string]
        ? R extends `|${infer R2}`
            ? ParseAlt<R2> extends [infer B extends Node, infer R3 extends string]
                ? [{ k: 'alt', a: A, b: B }, R3]
                : never
            : [A, R]
        : never

// ─────────────────────────── the matcher ──────────────────────────
// `M<N, S>` returns a UNION of every suffix reachable by matching `N` at
// the start of `S`, or `never` if it cannot match. Returning the whole set
// rather than one answer is what makes backtracking work: a later matcher
// distributes over the union and simply ignores branches that dead-end.

type InClass<C extends string, Cs extends string> =
    Cs extends `${infer H}${infer T}` ? C extends H ? true : InClass<C, T> : false

type M<N extends Node, S extends string> =
    N extends { k: 'char', c: infer C extends string }
        ? S extends `${C}${infer R}` ? R : never
    : N extends { k: 'any' }
        ? S extends `${string}${infer R}` ? R : never
    : N extends { k: 'class', neg: infer Neg, cs: infer Cs extends string }
        ? S extends `${infer C}${infer R}`
            ? InClass<C, Cs> extends (Neg extends true ? false : true) ? R : never
            : never
    : N extends { k: 'start' }
        // Only meaningful at position 0. `MatchAt` starts there, and the
        // unanchored search is a separate loop, so `^` is a no-op here and
        // its restrictive power comes from `Match` refusing to slide.
        ? S
    : N extends { k: 'end' }
        ? S extends '' ? '' : never
    : N extends { k: 'opt', n: infer X extends Node }
        ? S | M<X, S>
    : N extends { k: 'star', n: infer X extends Node }
        ? Star<X, S>
    : N extends { k: 'plus', n: infer X extends Node }
        ? Star2<X, M<X, S>>
    : N extends { k: 'seq', ns: infer Ns extends readonly Node[] }
        ? Seq<Ns, S>
    : N extends { k: 'alt', a: infer A extends Node, b: infer B extends Node }
        ? M<A, S> | M<B, S>
    : never

/** Zero or more: the current position plus everything one more match reaches. */
type Star<X extends Node, S extends string> =
    S extends string ? S | Star2<X, M<X, S>> : never

/**
 * Distributes over the union of positions reached so far.
 *
 * Termination rests on every iteration consuming at least one character,
 * so `S` strictly shrinks. A pattern whose body can match empty — `(a?)*`
 * — would not terminate; TypeScript stops it with `TS2589` rather than
 * hanging, but the pattern is still outside what this supports.
 */
type Star2<X extends Node, S> =
    S extends string ? S | Star2<X, M<X, S>> : never

type Seq<Ns extends readonly Node[], S> =
    Ns extends readonly [infer H extends Node, ...infer T extends Node[]]
        ? S extends string ? Seq<T, M<H, S>> : never
        : S

/**
 * Did `N` match at all at the head of `S`?
 *
 * `M` returns the union of reachable suffixes, so "matched" is exactly
 * "that union is not `never`". Note this asks only whether a match *began*
 * here — reaching the end of the input is the separate job of `$`. Testing
 * `'' extends M<N, S>` instead would silently make every pattern behave as
 * if it were `$`-anchored, so `'bc'` would not be found inside `'abcd'`.
 *
 * The tuple wrapper `[M<N, S>] extends [never]` suppresses distribution;
 * a bare `M<N, S> extends never` would distribute over the union and
 * answer per-member rather than about the union as a whole.
 */
type Matches<N extends Node, S extends string> =
    [M<N, S>] extends [never] ? false : true

/** Anchored at position 0; `$` is what additionally demands the end. */
type MatchAt<P extends string, S extends string> =
    ParseAlt<P> extends [infer N extends Node, string] ? Matches<N, S> : false

/** True when the pattern matches at any position in the input. */
type Search<N extends Node, S extends string> =
    Matches<N, S> extends true ? true
    : S extends `${string}${infer R}` ? Search<N, R>
    : false

/**
 * Full-input match, honouring `^` and `$`.
 *
 * A leading `^` pins the match to position 0; otherwise the pattern is
 * searched at every position, as an unanchored regex would be.
 */
export type Match<P extends string, S extends string> =
    P extends `^${string}`
        ? MatchAt<P, S>
        : ParseAlt<P> extends [infer N extends Node, string] ? Search<N, S> : false

// ─────────────────────────── assertions ───────────────────────────

// literals
export type _Lit = Assert<Equal<Match<'^abc$', 'abc'>, true>>
export type _LitNo = Assert<Equal<Match<'^abc$', 'abd'>, false>>

// `.` and classes
export type _Any = Assert<Equal<Match<'^a.c$', 'axc'>, true>>
export type _Class = Assert<Equal<Match<'^a[xyz]c$', 'ayc'>, true>>
export type _ClassNo = Assert<Equal<Match<'^a[xyz]c$', 'awc'>, false>>
export type _NegClass = Assert<Equal<Match<'^a[^xyz]c$', 'awc'>, true>>
export type _NegClassNo = Assert<Equal<Match<'^a[^xyz]c$', 'ayc'>, false>>

// quantifiers
export type _Star = Assert<Equal<Match<'^a*b$', 'aaab'>, true>>
export type _StarZero = Assert<Equal<Match<'^a*b$', 'b'>, true>>
export type _Plus = Assert<Equal<Match<'^a+b$', 'aaab'>, true>>
export type _PlusZero = Assert<Equal<Match<'^a+b$', 'b'>, false>>
export type _Opt = Assert<Equal<Match<'^ab?c$', 'ac'>, true>>
export type _OptTaken = Assert<Equal<Match<'^ab?c$', 'abc'>, true>>

/**
 * The backtracking case: greedy `a*` must give a character back so the
 * literal `a` that follows can match. A single-pass matcher fails here.
 */
export type _Backtrack = Assert<Equal<Match<'^a*ab$', 'aab'>, true>>
export type _Backtrack2 = Assert<Equal<Match<'^a*ab$', 'ab'>, true>>
export type _Backtrack3 = Assert<Equal<Match<'^a*ab$', 'b'>, false>>

// alternation and grouping
export type _Alt = Assert<Equal<Match<'^cat|dog$', 'dog'>, true>>
export type _AltNo = Assert<Equal<Match<'^cat|dog$', 'cow'>, false>>
export type _Group = Assert<Equal<Match<'^(ab)+c$', 'ababc'>, true>>
export type _GroupNo = Assert<Equal<Match<'^(ab)+c$', 'abac'>, false>>
export type _GroupAlt = Assert<Equal<Match<'^(a|b)+c$', 'abbac'>, true>>

// anchoring: unanchored searches, `^` pins to the start
export type _Unanchored = Assert<Equal<Match<'bc', 'abcd'>, true>>
export type _Anchored = Assert<Equal<Match<'^bc', 'abcd'>, false>>

/**
 * An anchored pattern without `$` matches a *prefix* — it need not consume
 * the input. This is the case that separates "matched here" from "matched
 * to the end", and the pair below pins both halves.
 */
export type _AnchoredPrefix = Assert<Equal<Match<'^ab', 'abcd'>, true>>
export type _End = Assert<Equal<Match<'^ab$', 'abc'>, false>>
export type _UnanchoredEnd = Assert<Equal<Match<'bc$', 'abcd'>, false>>
export type _UnanchoredEndOk = Assert<Equal<Match<'cd$', 'abcd'>, true>>

// escapes
export type _Escape = Assert<Equal<Match<'^a\\.c$', 'a.c'>, true>>
export type _EscapeNo = Assert<Equal<Match<'^a\\.c$', 'axc'>, false>>

/** A small realistic pattern, exercising several features together. */
export type _Ident = Assert<Equal<Match<'^[abc][abc0]*$', 'ab0a'>, true>>
export type _IdentNo = Assert<Equal<Match<'^[abc][abc0]*$', '0ab'>, false>>

/** Non-literal input degrades to `false`, never to a wrong answer. */
export type _Dynamic = Assert<Equal<Match<'^a$', string>, false>>
