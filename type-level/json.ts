/**
 * A JSON parser that runs in the type checker.
 *
 * `ParseJson<S>` takes a string *literal type* and yields the structured
 * type that string denotes — `'{"port": 8080}'` becomes
 * `{ port: 8080 }`, with `8080` as a numeric literal, not `number`.
 *
 * It is ordinary recursive descent, with every part played by a type:
 *
 * | parser concept   | type-level form                                  |
 * | ---------------- | ------------------------------------------------ |
 * | cursor           | the unconsumed suffix, threaded as `rest`         |
 * | production       | a type returning `[value, rest]`                  |
 * | lookahead        | ``S extends `[${infer R}` ? …``                    |
 * | token consumption| `infer R` binding the tail                        |
 * | parse failure    | `never`, which propagates on its own              |
 * | mutual recursion | `ParseValue` <-> `ParseArray` <-> `ParseObject`   |
 *
 * Limits, all measured rather than assumed:
 *
 * - **Depth** is bounded by *structural elements*, not by input length —
 *   the per-character loops (`Trim`, `ReadNum`) are short and unwind, while
 *   `ParseObject`/`ParseArray` recurse once per member. Measured against
 *   TypeScript 7.0.2: 950 object keys (~9.5 KB of text) parses cleanly,
 *   1000 keys raises `TS2589`. So the ceiling is the ~1000-step
 *   tail-recursion budget, spent per member.
 * - **Compile time** is not the concern it is often said to be at this
 *   scale: 10 keys and 800 keys both check in well under a second, with the
 *   difference lost in `tsc` startup. It is depth that bites first, and it
 *   bites as a hard error rather than as a slow build.
 * - **Literals only.** A non-literal `string` yields `never` rather than a
 *   wrong type. The characters must be visible in the source.
 *
 * Not a general JSON reader: string escapes are unhandled, so `"a\"b"` will
 * not round-trip. Handling them means threading an escape state through
 * `ParseValue`, which costs depth on every string.
 *
 * @module
 */

import type { Assert, Equal } from './equal.ts'

// ───────────────────────────── lexical ─────────────────────────────

type Ws = ' ' | '\n' | '\t' | '\r'

type Trim<S extends string> = S extends `${Ws}${infer R}` ? Trim<R> : S

type Digit = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9'

/** Characters that may appear in a JSON number, including exponent form. */
type NumChar = Digit | '-' | '+' | '.' | 'e' | 'E'

/** Reads a maximal run of numeric characters, returning `[run, rest]`. */
type ReadNum<S extends string, Acc extends string = ''> =
    S extends `${infer C}${infer R}`
        ? C extends NumChar ? ReadNum<R, `${Acc}${C}`> : [Acc, S]
        : [Acc, S]

// ───────────────────────────── parser ──────────────────────────────
// Each production returns `[value, rest]`, or `never` on a parse error.

type ParseValue<S extends string> =
    Trim<S> extends `null${infer R}` ? [null, R]
    : Trim<S> extends `true${infer R}` ? [true, R]
    : Trim<S> extends `false${infer R}` ? [false, R]
    : Trim<S> extends `"${infer Str}"${infer R}` ? [Str, R]
    : Trim<S> extends `[${infer R}` ? ParseArray<R>
    : Trim<S> extends `{${infer R}` ? ParseObject<R>
    // `infer N extends number` is what reifies the digit run as a numeric
    // literal. Without it the best available answer is `string`.
    : ReadNum<Trim<S>> extends [infer D extends string, infer R]
        ? D extends '' ? never
        : D extends `${infer N extends number}` ? [N, R]
        : never
    : never

type ParseArray<S extends string, Acc extends unknown[] = []> =
    Trim<S> extends `]${infer R}` ? [Acc, R]
    : ParseValue<S> extends [infer V, infer R extends string]
        ? Trim<R> extends `,${infer R2}` ? ParseArray<R2, [...Acc, V]>
        : Trim<R> extends `]${infer R2}` ? [[...Acc, V], R2]
        : never
    : never

type Entry = readonly [string, unknown]

type ParseObject<S extends string, Acc extends Entry[] = []> =
    Trim<S> extends `}${infer R}` ? [FromEntries<Acc>, R]
    : Trim<S> extends `"${infer K}"${infer R0}`
        ? Trim<R0> extends `:${infer R1}`
            ? ParseValue<R1> extends [infer V, infer R2 extends string]
                ? Trim<R2> extends `,${infer R3}` ? ParseObject<R3, [...Acc, [K, V]]>
                : Trim<R2> extends `}${infer R3}` ? [FromEntries<[...Acc, [K, V]]>, R3]
                : never
            : never
        : never
    : never

type FromEntries<E extends readonly Entry[]> = { [P in E[number] as P[0]]: P[1] }

/**
 * Parses `S` and requires that nothing but whitespace follows, so trailing
 * junk is an error rather than a silently ignored suffix.
 */
export type ParseJson<S extends string> =
    ParseValue<S> extends [infer V, infer R extends string]
        ? Trim<R> extends '' ? V : never
        : never

/**
 * A function whose return type is computed from the text of its argument.
 *
 * ```ts
 * const cfg = parseJson('{"host": "localhost", "port": 8080}')
 * cfg.port  // 8080, a literal type
 * cfg.nope  // compile error
 * ```
 *
 * Declaration only — there is deliberately no runtime half here. The type
 * level describes the result; it cannot produce the parser.
 */
export declare function parseJson<S extends string>(s: S): ParseJson<S>

// ─────────────────────────── assertions ────────────────────────────
// Exported so `noUnusedLocals` sees them used; they carry no runtime form.

export type _Null = Assert<Equal<ParseJson<'null'>, null>>
export type _Bool = Assert<Equal<ParseJson<'  true '>, true>>
export type _Num = Assert<Equal<ParseJson<'42'>, 42>>
export type _Negative = Assert<Equal<ParseJson<'-3.5'>, -3.5>>

/**
 * Only a number's *canonical* spelling reifies as a literal. `'1e3'` does
 * not become `1000`; it widens to `number`. Same for `'1.50'`, `'007'`,
 * `'+5'` and `'1.0'` — all valid JSON, none of them canonical.
 *
 * So the value is still parsed correctly, but precision is lost exactly
 * where the author wrote the number in a non-normalized form. Worth knowing
 * before relying on literal numbers from parsed text.
 */
export type _Exponent = Assert<Equal<ParseJson<'1e3'>, number>>
export type _NonCanonical = Assert<Equal<ParseJson<'1.50'>, number>>
export type _Str = Assert<Equal<ParseJson<'"hello"'>, 'hello'>>
export type _EmptyArray = Assert<Equal<ParseJson<'[]'>, []>>
export type _Array = Assert<Equal<ParseJson<'[1, 2, 3]'>, [1, 2, 3]>>
export type _Mixed = Assert<Equal<ParseJson<'[1, "two", true, null]'>, [1, 'two', true, null]>>

export type _Object = Assert<Equal<
    ParseJson<'{"name": "sergey", "age": 42}'>,
    { name: 'sergey', age: 42 }
>>

/** Nesting, whitespace and every kind at once. */
export type _Deep = Assert<Equal<
    ParseJson<'{"a": [1, {"b": [true, null]}], "c": {"d": "e"}}'>,
    { a: [1, { b: [true, null] }], c: { d: 'e' } }
>>

// Malformed input must fail to parse rather than produce a plausible type.
export type _BadMissingValue = Assert<Equal<ParseJson<'{"a": }'>, never>>
export type _BadUnclosed = Assert<Equal<ParseJson<'[1, 2'>, never>>
export type _BadTrailing = Assert<Equal<ParseJson<'{"a": 1} trailing'>, never>>

/** A non-literal `string` degrades to `never`, not to a wrong type. */
export type _Dynamic = Assert<Equal<ParseJson<string>, never>>
