# Upstream: migrating to FunctionalScript 0.46.0

Status: **UNBLOCKED AND MEASURED, 2026-08-18.** This note read *"blocking the dependency bump"*
from 2026-08-17 until 0.46.0 shipped. The blocking claim was true of 0.44/0.45 and is **no longer
true**. Superseded rather than deleted, because the reason 0.45 was refused is the reason 0.46 can
be taken, and a reader needs both halves.

**Requested by the upstream author.** `todo/update-fjs-0.46.0` (PR #96, Sergey Shandar, main
author of FunctionalScript) asks for the migration and for *"an extensive, structured report on
the migration once it's done"* — what was learned, how it adapted to the project, and the main
challenges. That report is a deliverable of this work, not a courtesy.

## Why 0.45 was refused and 0.46 is not — measured both times, never estimated

| | 0.45.0 (2026-08-17) | 0.46.0 (2026-08-18) |
|---|---|---|
| `tsc` before touching anything | 1287 | **1526** |
| after the mechanical specifier rename | 288 | **630** |
| what the residue WAS | shipped declarations imported core types without re-exporting them, so **every fix was a cast, an `any`, or a redeclared type — all three forbidden here** | **real API changes with real new APIs to adopt** |
| verdict | unconsumable | **consumable; this is ordinary migration work** |

The residual count is larger and the work is smaller. That is the whole point: 288 unfixable
errors are worse than 630 fixable ones, and a count alone cannot tell you which you have.

## The residue, categorised from the measurement

Reproduce with: copy the repo, `npm i functionalscript@0.46.0`, rewrite every
`functionalscript/**.f.js` specifier to `.f.mjs` (**including the ones inside JSDoc `@import`
comments** — 14 hid there and a first pass missed them), then `npx tsc --noEmit`.

**Concentration matters more than the total.** 243 of 630 sit in two files:

| Module | Errors |
|---|---|
| `fjs/server/fjs_run` | 170 |
| `fjs/server/fjs_run/snapshot` | 73 |
| `fjs/server` | 49 |
| `fjs/server/finance_documents_list` | 29 |
| everything else | ≤ 19 each |

Three distinct causes, in rising order of effort:

1. **`fjs/types/rtti/validate` no longer exists** (60 errors). It was not moved — it was
   **restructured** into `fjs/types/rtti/parse`, `.../common` and `.../data`. Each call site needs
   reading against the new split, not a path rewrite.
2. **Types moved into `types.d.ts`** (59 + 34 errors). `fjs/types/result/module.f.mjs` exports the
   VALUES (`ok`, `error`, `unwrap`, `mapOk`, …) and declares `Result` locally without exporting
   it; the TYPE now lives in the sibling `types.d.ts`. This is exactly the convention the upstream
   author suggests this project adopt, and adopting it is a separate decision from consuming it.
3. **The new Effect system** (the rest, and the reason the two `fjs_run` files dominate). Every
   Effect now carries an error channel: `Effect<O, T, E>`, returning `Result<T, E>`. The visible
   symptom is `Type 'Error<any>' is not assignable to type 'string'` and
   `Argument of type 'Result<Key<Cache>, IoChannel>' is not assignable to …`. **This is a
   semantic migration, not a mechanical one** — the interpreter and the run spine have to decide
   what an error channel means where they previously had none.

## The new Effect system is LLM tool-calling, and upstream says so in those words

Observed by the owner on 2026-08-18 and then checked against `fjs/effects/types.d.ts` rather than
agreed with. The type is `Operation = readonly [string, (..._) => Result<unknown, unknown>]` — a
command NAME paired with the signature a runner implements it at — and upstream's own docstring
describes the missing-handler path as: *"A runner may decline any command it was not given a
handler for — `partialMatch` answers `error(notImplemented(command))`"*, after which *"the program
receives control back and decides what an incompatible runner means for it."* That is a tool call,
a tool that the client does not have, and a caller deciding what to do about it. Even the reason
the refusal carries only the NAME is the same: the payload may hold functions, so carrying it
would break serializability.

**This retires `upstream-total-match-dispatch.md`.** At 0.43.1 `match` refuses by throwing, which
is why `fjs/exec` carries a `try` that AGENTS.md's no-`try` rule otherwise forbids; that note was
re-checked against 0.45.0 on 2026-08-17 and found still open. At 0.46.0 the refusal is
`error(notImplemented)` and `throw` is reserved for panics. **The migration therefore DELETES a
workaround rather than adding a version** — check `fjs/exec`'s `try` for removal as part of this
work, and delete that note when it goes.

**And it sharpens this project's own thesis.** REQUIREMENTS.md permanently forbids a
`finance_compute_1040` tool so that the agent AUTHORS a program instead of calling one. If effects
are isomorphic to tool calls, the difference was never *what executes* — it is **who decides, and
when**:

| | an LLM's tool calls | this engine's effects |
|---|---|---|
| who picks the next call | the model, at every step | the program, written once in advance |
| reproducibility | none | byte-identical, from the same program hash |
| a failed call | the model improvises | `Result<T, E>`, discharged by type |

The same mechanism, with the decision made once and stored in CAS instead of re-made on every
step. That is the clearest statement of the thesis this project has produced, and it belongs in
the report the upstream author asked for.

## Retirement condition

This note is deleted when `package.json` declares `^0.46.0`, `npm test` is green on it, and the
report the upstream author asked for is written. Nothing here is retired by a passing suite alone.
