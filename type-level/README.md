# type-level

A study of what TypeScript's type system can compute during type checking.

This is **not** application code and nothing here has a runtime form. It is
kept in the repo because it answers a question that keeps coming up when
typing `.f.js` with JSDoc — how much of a correctness argument can be pushed
into the checker — and because the answer is easier to trust when it
compiles than when it is asserted in prose.

## Why it is not under `fjs/`

[AGENTS.md](../AGENTS.md) reserves `fjs/` for FunctionalScript `.f.js`
sources. These are `.ts` files containing only type declarations, so they
belong outside that tree. They are still checked: the root `tsconfig.json`
covers everything except `functionalscript/` and `node_modules/`, so
`npm test` (`tsc && node --test`) type-checks this directory on every run.

Every claim in these files is an assertion the compiler enforces. If one
stops being true, the build fails — which is the point.

## Files

| file | what it shows |
| --- | --- |
| [equal.ts](./equal.ts) | `Assert` and `Equal` — the `static_assert` of the type level |
| [json.ts](./json.ts) | a JSON parser: string literal → the type it denotes |
| [regex.ts](./regex.ts) | a regex engine, including backtracking |

## What this establishes

TypeScript's type system is Turing-complete, and the correspondence to C++
template metaprogramming is close: conditional types are specialization,
`infer` is pattern matching, recursive conditionals are recursive
instantiation, variadic tuples are parameter packs, and `Assert<T extends
true>` is `static_assert`.

Two differences matter more than the similarities.

**It is stronger on strings.** Template literal types give real string
computation, which C++ templates cannot do without dropping to `constexpr`.
That is what makes [json.ts](./json.ts) and [regex.ts](./regex.ts) possible
at all.

**It generates nothing.** C++ instantiation emits functions and classes into
the binary; `constexpr` computes values that exist at runtime. Types here
are erased before any JavaScript is produced. So this is a pure, lazy
functional language whose values are types and whose only output is "does it
compile" — it can *describe* a runtime artifact, never produce one.

That last point is why [json.ts](./json.ts) declares `parseJson` without a
body. The type level states what the result type must be; someone still has
to write the parser.

## Measured limits

Numbers from TypeScript 7.0.2, not from folklore:

- **Recursion depth** is the binding constraint, and it counts *structural
  elements* rather than characters. A 950-key JSON object (~9.5 KB) parses
  cleanly; 1000 keys raises `TS2589`. Non-tail-recursive forms exhaust the
  budget much sooner.
- **Compile time** is not the problem it is reputed to be at these sizes —
  10 keys and 800 keys both check in under a second, the difference lost in
  `tsc` startup. Depth fails loudly and early; it does not degrade quietly.
- **Literal types only.** Given a non-literal `string`, `ParseJson` yields
  `never` and `Match` yields `false`. Both degrade to a useless answer
  rather than a wrong one, which is the property you want.

## Where this is worth using

When a string the developer writes *literally* should drive types elsewhere:
route patterns (`'/users/:id'` → `{ id: string }`), SQL result shapes,
format strings, environment schemas.

Notably, FunctionalScript itself declines to work this way. Its `Ts<S>`
derives types from schema **values** (`[number, option(string)]`) rather than
by parsing strings, so recursion is bounded by the schema's arity instead of
its text length. For a library that is the more robust trade. String parsing
earns its place only where the string genuinely *is* the interface.
