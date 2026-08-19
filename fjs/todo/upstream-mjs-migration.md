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

**This retired `upstream-total-match-dispatch.md`, and the note is now deleted.** At 0.43.1 `match` refuses by throwing, which
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

## Stages 1 and 2, done and measured (2026-08-18)

`tsc`: **0** on 0.43.1 -> **1526** on 0.46.0 untouched -> **629** after the specifier rewrite ->
**513** after the two relocation classes. The 1526 and the 630/629 both reproduce the measurement
above, and so does its distribution, to the error: 170 / 73 / 49 / 29.

**Every measurement above was taken from OUTSIDE the checkout**, for a reason now written into
AGENTS.md: a worktree lives inside its parent checkout, TypeScript searches ancestor
`node_modules` preferring `.d.ts`, 0.46.0 ships only `.d.mts` — so an in-worktree `npx tsc`
silently typechecks the PARENT's 0.43.1 and reports **0 errors** on a tree whose real count is
1526. A green typecheck was the first result this migration produced, and it was false.

### `rtti/validate` -> `rtti/parse`, confirmed against the shipped declarations

- `rtti/parse/module.f.d.mts` declares `parse: <T extends Type>(rtti: T) => Parse<T>` and
  `parse/types.d.ts` declares `Parse<T> = Validate<T>` — **the same signature** old `validate`
  had. All 31 of our call sites pass a thunk/const schema and want the typed result, so `parse`
  is the successor for every one of them.
- `rtti/data`'s `validate` is NOT the successor despite the name: it takes a `Data` (from
  `toData`), not a `Type`, and returns the erased `ResultE`. Adopting it would have cost a cast
  at every call site — forbidden here, and the exact failure mode that made 0.45 unconsumable.
- `rtti/common` is the shared kernel. `ValidationError` lives in `common/types.d.ts` and is
  re-exported by `parse/types.d.ts`; we import it from `parse/types.js`, beside the function
  whose error channel it is.

**One semantic difference, and it is NOT benign — see
[`upstream-rtti-parse-materializes-absent-members.md`](./upstream-rtti-parse-materializes-absent-members.md).**
Old `validate` returned the value it was given; `parse` returns a freshly constructed value that
has **every declared key present**, an absent optional filled with `undefined`, and every
undeclared key dropped. This project's documents distinguish absent from present-and-undefined by
hard rule, so **27 proof leaves across 13 typecheck-clean modules go red** — a behavioural
regression under a green `tsc`, which is the dangerous direction. Every workaround available here
needs a cast or a hand-asserted type predicate, so the fix is upstream: re-expose the 0.43.1
validator beside `parse`. It was predicted as a risk when `parse` was chosen and then found by the
suite, not by reading — which is the whole argument for running the suite even when the typecheck
is still red.

### The `types.ts` convention, consumed but not adopted

226 type-import names across our sources, and **not one of them is still exported from a
`module.f.mjs`** — the relocation is total, not partial, and no import line mixes a moved name
with a staying one. So the rewrite is one rule: a type comes from the sibling, a value from the
module.

The specifier we write is **`types.js`, not `types.ts`**. Upstream's own sources say `./types.ts`
because their tsconfig sets `allowImportingTsExtensions`; ours deliberately does not (see the
`tsconfig.json` comment). Under `nodenext`, `types.js` strips to `types.ts` / `types.d.ts` and
binds to the shipped `types.d.ts`. Every such specifier here sits in a JSDoc `@import`, so it is
erased before runtime and no `types.js` is ever fetched — verified: no `import` statement in the
project names one.

A third, smaller relocation turned up in the residue: the rtti schema VALUES `primitive`,
`unknown`, `object` and `array` left `media/json/module.f.mjs` for `media/json/rtti/module.f.mjs`.
One call site, `fjs/server/fjs_run`.

**We consume the convention; we have not adopted it for our own types.** That is the owner's
call, and the upstream author's suggestion is recorded here rather than acted on.

### What is left is the Effect system, and only that

513 errors, and every sampled one is `Effect<O, T, E>`, the `Result<T, E>` an effect now returns,
the tightened `Operation` constraint, or `NotImplemented` / `IoChannel` reaching a place that used
to hold a bare value:

| Module | Errors |
|---|---|
| `fjs/server/fjs_run` | 202 |
| `fjs/server/fjs_run/snapshot` | 90 |
| `fjs/exec` | 42 |
| `fjs/server` | 30 |
| `fjs/server/finance_documents_list` | 24 |
| `fjs/report/amend` | 21 |
| `demo/steps` | 18 |
| `fjs/guest` + `check` + `materialize` + `tax` | 44 |
| `fjs/report/payer` / `tax_return` / `provenance` | 27 |
| `fjs/server/response` / `finance_schema` / `finance_tax_params` | 13 |
| `fjs/index.f.js` | 2 |

`fjs/exec` rose from 13 to 42 and `fjs_run` from 170 to 202 across stage 2. That is the right
direction: while the type imports were broken those positions were `any`-shaped and the compiler
had nothing to complain about. Fixing the imports is what made the Effect mismatches visible.

`fjs/exec`'s `try` is gone as of stage 3 — see the module header there for why the refusal is an
INTERRUPTION rather than a `NotImplemented`, and why that makes `partialMatch` the wrong
eliminator for a whitelist.

### The runtime suite, with the `tsc` gate bypassed

`npm test` is `tsc && node --test *.test.js`, so it stops at 513 errors and runs nothing. Run the
second half alone — `node --test '*.test.js'`, the pinned glob, never bare `node --test` — and it
reports **2500 tests, 2375 pass, 123 fail, 2 cancelled**. The same tree at the commit before this
work, on 0.43.1, reports **2500 tests, 2500 pass, 0 fail** — so every one of the 123 is ours, and
the discovered project-local proof leaves are **2467 before and 2467 after**: none was lost to a
module that failed to import, which is the failure mode a leaf count exists to catch.

Of the 123: **112 are project-local proof leaves** and 11 are root gate/integration leaves. The
112 split cleanly in two, and the split is the useful part:

- **27 leaves in 13 modules that typecheck cleanly** — the `parse` reconstruction above. These are
  not Effect work and stage 3 will not fix them.
- **the rest** — modules that also carry `tsc` errors, i.e. the Effect system, plus the
  real-process integration suites that drive `fjs_run`. One of those surfaces as a runtime
  `TypeError: Cannot mix BigInt and other types` inside upstream's `types/bigint`'s `log2`,
  reached from `fjs/server/fjs_run`'s `utf8ToString(readResult[1])` — the value a `step`
  continuation receives is no longer what that line assumes, which is precisely the Effect
  migration.

Do not read the 123 as a stage-3 estimate: fixing the Effect system leaves the 54 exactly where
they are.

## Stage 3 — the Effect system: what landed, and the map for what is left

`tsc` **513 -> 282**. Failing proof leaves **112 -> 113**, of which **27 are the `parse`
regression** (unchanged set, verified byte-identical) and **86 are Effect work still open**.
`fjs/exec`'s `try` is gone and `upstream-total-match-dispatch.md` with it.

**Order taken was `exec` -> `guest` -> `fjs_run`, not `exec` -> `fjs_run`.** `CasOp` — the
operation vocabulary the whole run spine is typed against — is declared in `fjs/guest`, and until
its handlers returned a `Result` nothing downstream could satisfy 0.46.0's `Operation`
constraint. Doing `guest` second turned 472 into 288 across seven modules at once; doing
`fjs_run` first would have meant fixing the same constraint error 150 times.

### The four rules that did the work, in the order they pay off

1. **An operation's handler returns a `Result`.** Fixing the vocabulary at its declaration
   (`TestOp` in `exec`, `CasOp` in `guest`) collapses the `TS2344 does not satisfy the constraint
   'Operation'` cascade everywhere else. Declare the channel the operation actually has — `never`
   where it cannot fail, so the caller's channel collapses too.
2. **`pure(v)` -> `pureOk(v)`** for a bare value; `pure(ok(…))` / `pure(error(…))` are already
   right. 85 sites. Anchor on not-`.` so `ctx.pure(` in stored program source is never touched.
3. **`runPure` yields `Option<Result<T, E>>`.** Two questions, asked separately: the `Option` for
   "reached a value vs stopped at a command", the `Result` for success vs failure.
4. **`step` -> `resultStep`, `mapStep` -> `resultMapStep`, wherever the continuation inspects
   `r[0]`.** Those lines were written against 0.43.1's Result-BLIND `step`, and `resultStep` *is*
   that function. Getting this wrong is the worst failure mode in the whole migration: it
   typechecks as a *bit-vector* complaint (`Property '1' does not exist on type 'Symbol & {
   bit_vec … }'`) and fails at runtime three frames inside `types/bigint`.

### What is left, and the one decision it turns on

| Module | `tsc` | failing leaves |
|---|---|---|
| `fjs/server/fjs_run` | 149 | 25 |
| `fjs/server/fjs_run/snapshot` | 40 | 5 |
| `fjs/report/amend` | 19 | 13 |
| `demo/steps` | 19 | 0 (not proof-covered) |
| `fjs/server` | 16 | 3 |
| `fjs/server/finance_documents_list` | 10 | 8 |
| `fjs/guest/materialize` | 10 | 4 |
| `fjs/guest/check` | 9 | 3 |
| `fjs/report/payer` / `tax_return` / `provenance` | 8 | 23 |
| `fjs/server/response`, `fjs/index.f.js` | 2 | 2 |

**The decision: this project's OWN fallible helpers still carry their `Result` in the PAYLOAD.**
`readRunRecord`, `readResultRecord`, `materializeProgram`, `loadProgram` are all declared
`Effect<O, Result<T, string>, …>` — the pre-0.46.0 spelling, because there was no channel to put
it in. Every remaining cluster above is downstream of that one choice, and it is a design
decision rather than a mechanical edit:

- **Move them to the channel** (`Effect<O, T, string>`). Then `resultMapStep` is the natural
  combinator at the definition, every caller's hand-written `if (r[0] === 'error')` disappears
  into a plain `step`, and short-circuiting is the layer's job rather than each call site's. This
  is what the error channel is FOR, and it is what upstream did to `collectRead`.
- **Keep the payload spelling.** Cheaper per file, but it leaves two conventions in one codebase
  and every caller keeps discharging by hand — which is exactly the shape that hid the BigInt bug.

The first is right, and it should be taken deliberately in one pass per helper rather than
drifted into: changing a helper's channel changes its callers' types, so a half-converted spine
type-checks in neither spelling.

Two smaller items, both recorded rather than done:

- **`foldStep`/`forEachStep` now short-circuit on the first `error`;** the Result-blind ones ran
  every item. `snapshot` folds over revisions and has a proof
  (`subjectUndecodableHead`) that depends on skipping an undecodable one. If that fold's items
  become fallible, the skip must be written as a per-item `catchStep`, not recovered by reverting.
- **`fjs/exec`'s `unsafeDo` is still `/** @type {any} *\/ (do_)`** — pre-existing, confined to the
  test-fixture section, and the only `any` under `fjs/`. It exists to build a `Do` node whose
  command string bypassed `tsc`, which is the exact thing `interpret` is the backstop for. Left
  as found; removing it needs `interpret`'s signature to admit an effect whose op-set is WIDER
  than its map's, which is true and currently unsayable.
