# Upstream: migrating to FunctionalScript 0.46.0, and then 0.46.1

Status: **CODE COMPLETE ON 0.46.1, 2026-08-18.** `tsc` is **0** and `npm test` is
2505 tests / **2505 pass / 0 fail**, with **2472** project-local proof leaves. The `parse`
regression that held the last 27 leaves red was fixed upstream, not worked around here — see
"Stage 5" at the end. **What remains before this note is deleted is the report the upstream
author asked for, and nothing else.**

Previous status, kept because the gap it describes is the argument for how it was closed:
*DONE except for the `parse` regression* — `tsc` 0, 2505 tests / 2478 pass / **27 fail**, those
27 blocked on an upstream fix.

Original status: **UNBLOCKED AND MEASURED, 2026-08-18.** This note read *"blocking the dependency bump"*
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

**Two of the three are met as of stage 5:** `package.json` declares `^0.46.1` (which satisfies
`^0.46.0`, and the extra patch is *this project's own* upstream fix), and `npm test` is green on
it — 2505/2505. **The report is the only thing outstanding**, which is why this note is still
here and the sentence above says what it says.

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

**Superseded by stage 5: on 0.46.1 the successor is `rtti/validate` again, and every one of these
call sites took it.** The reasoning below is what was true of 0.46.0, and it is the reasoning that
produced the upstream fix — kept because "the same signature" is exactly the observation that made
a green `tsc` no evidence at all.

- `rtti/parse/module.f.d.mts` declares `parse: <T extends Type>(rtti: T) => Parse<T>` and
  `parse/types.d.ts` declares `Parse<T> = Validate<T>` — **the same signature** old `validate`
  had. All 31 of our call sites pass a thunk/const schema and want the typed result, so `parse`
  is the successor for every one of them.
- `rtti/data`'s `validate` is NOT the successor despite the name: it takes a `Data` (from
  `toData`), not a `Type`, and returns the erased `ResultE`. Adopting it would have cost a cast
  at every call site — forbidden here, and the exact failure mode that made 0.45 unconsumable.
- `rtti/common` is the shared kernel. `ValidationError` lives in `common/types.d.ts` and is
  re-exported by `parse/types.d.ts`; we import it from `parse/types.js`, beside the function
  whose error channel it is. (Stage 5 moved that import to `common/types.js`: 0.46.1's `validate`
  directory ships no `types.d.ts` at all, so `common` is where the name actually lives.)

**One semantic difference, and it is NOT benign — see "Stage 5" below, which is where it was
fixed.** Old `validate` returned the value it was given; `parse` returns a freshly constructed value that
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

## Stage 3 — the Effect system: what landed

`tsc` **513 -> 282**. Failing proof leaves **112 -> 113**, of which **27 are the `parse`
regression** (unchanged set, verified byte-identical) and **86 were Effect work**.
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

Rule 4 was the right move for stage 3 and the WRONG one to stop at. Stage 4 undid most of its
sites: a `resultStep` whose continuation immediately branches on `r[0]` is a hand-written
short-circuit, and moving the failure into the channel deletes the branch instead of typing it.
`resultStep` is for a site where **both** branches genuinely matter.

## Stage 4 — the payload's `Result` moves to the channel, and `tsc` reaches 0

`tsc` **282 -> 0**. Failing proof leaves **113 -> 27**, and those 27 are the `parse` regression,
byte-identical to the set stage 2 recorded. Project-local proof leaves **2467 -> 2472**, the five
new ones being `fjs/refuses`'s own.

Per-pass, measured from outside the checkout each time:

| Pass | `tsc` | leaves failing |
|---|---|---|
| `fjs/report/amend` — `readRunRecord`, `readResultRecord` | 282 -> 263 | 113 -> 100 |
| `fjs/guest/materialize` + `check` + `fjs_run` seams — `materializeProgram`, `loadProgram`, `fjsCheck` | 263 -> 241 | — |
| `fjs/server/fjs_run/snapshot` — the fold's two skips, and a stale `try` | 241 -> 201 | — |
| `fjs/server/fjs_run` — the proof spine | 201 -> 58 | 100 -> 63 |
| `fjs/server`, `finance_documents_list`, `response`, `report/*`, `index.f.js` | 58 -> 19 | 63 -> 28 |
| `demo/steps/07-sandbox`, and the `fjs` CLI's renamed entry point | 19 -> **0** | 28 -> **27** |

### What the error channel changed about how the code reads

The decision stage 3 left open was taken as written: this project's own fallible helpers moved
their `Result` from the payload to the channel, one helper at a time with all callers in the same
pass. The effect is not that the code got shorter — it is that **the success path became the only
path a reader has to follow**, and the places that handle failure became the places that decided
something.

`fjs/report/amend` is the clearest single site. Before:

```js
const compareRunsAndDiff = cas => elected => runHashA => runHashB => resultA => resultB => {
    if (resultA[0] === 'error') {
        return pure(error(`could not read run A (${runHashA}): ${resultA[1]}`))
    }
    if (resultB[0] === 'error') {
        return pure(error(`could not read run B (${runHashB}): ${resultB[1]}`))
    }
    const runA = resultA[1]
    const runB = resultB[1]
    if (runA.programHash !== runB.programHash) { /* the real comparison */ }
```

After — the two arms are gone from the callee entirely, and the context they added moved to the
two call sites that know which side is which:

```js
export const amendmentDiff = cas => elected => runHashA => runHashB => {
    const runA = catchStep(readRunRecord(cas)(runHashA), e => pureError(`could not read run A (${runHashA}): ${e}`))
    const runB = catchStep(readRunRecord(cas)(runHashB), e => pureError(`could not read run B (${runHashB}): ${e}`))
    const both = historyStep(history(runA), () => runB)
    return step(both, ([b, a]) => compareRunsAndDiff(cas)(elected)(runHashA)(runHashB)(a)(b))
}

const compareRunsAndDiff = cas => elected => runHashA => runHashB => runA => runB => {
    if (runA.programHash !== runB.programHash) { /* the real comparison */ }
```

`compareRunsAndDiff`'s signature is the part that matters: it takes two `Run`s, so the compiler —
not a comment, and not a reader's care — is what guarantees the comparison below it never sees an
unread record.

The same shape repeats at every scale. `fjs/guest/check`'s `fjsCheck` lost three nested
`if (r[0] === 'error')` arms and became five straight-line bindings. `fjs/server/fjs_run`'s
`executeRun` lost four `pureOk({ kind: 'error', … })` arms to a single named combinator,
`asRunOutcome`, applied on the last line — which is also where the decision now lives, visibly:
*this* is the layer that says an infrastructure failure and a guest failure are the same thing to
a caller, because both end as a `status: 'error'` run record.

Three more things the channel made sayable rather than merely shorter:

- **`Effect<O, T, never>` is a claim.** `fjsRunTool`'s handler and `handleRunOutcome` declare it,
  and `toolEntry` requires it: an MCP handler turns every failure into a JSON-RPC error response.
  That was always true and was previously unwritten.
- **`unwrapStep(e, summary)` is a greppable panic with a scope.** It replaced
  `assert(writeResult[0] === 'ok', …)` in `writeTextToCas`. Same bare-value panic, but the
  `summary` argument means a widening error channel becomes a compile error at the site that
  chose to crash, instead of quietly enlarging what it crashes on.
- **`exitStep`.** `fjs/index.f.js` was `step(financeMcpServer(…), () => pureOk(0))`, which
  reported a server that never started as a clean exit 0 — `step` discarded a failure it could not
  see, because there was nothing to see it in.

### `foldStep` / `forEachStep` short-circuit now, and the skips had to be rewritten

Stage 3 flagged this and stage 4 acted on it. Three folds contained a deliberate SKIP that the
`Result`-blind fold expressed by simply carrying on:

- `fjs/server/fjs_run/snapshot`'s `buildRunSnapshot` — **two** skips, and they must stay two.
  A hash `cas.list()` reported but that will not read is skipped; a blob that reads but is not a
  revision is skipped **while still contributing its bytes to `blobs`**. One outer `catchStep`
  would have discarded the bytes in the second case, and
  `undecodableHeadStaysObservable` (subject `subjectUndecodableHead`) is the leaf that measures
  exactly that difference. Each skip is a `catchStep` around precisely the effect whose failure it
  forgives.
- `fjs/server`'s `casRefreshTool` — one unreadable blob must not abandon the dialect count.
- `fjs/server/finance_documents_list`'s `entryFor` — an undecodable revision and a broken snapshot
  blob mean the same thing (this (subject, head) pair yields no row), so they are ONE recovery;
  but it stays per-pair, or one bad document would drop every remaining row.

A failure of `cas.list()` itself is deliberately NOT skipped in any of them and travels the
channel: a snapshot of a store that cannot be listed is not a smaller snapshot, it is no snapshot.

### The `any`s are gone, and 0.46.0 is what made them sayable

Stage 3 recorded `fjs/exec`'s `unsafeDo` as out of scope because *"removing it needs `interpret`'s
signature to admit an effect whose op-set is WIDER than its map's, which is true and currently
unsayable."* That is right about `match` and wrong about what was needed: nothing has to admit a
wider op-set, because the map and the effect can both live at a wider **vocabulary**. `Operation`
is `readonly [string, (…) => Result<…>]`, so a command name that is not statically known is an
ordinary operation type. Each site gained a `ProbeOp` and `probeDo` is an annotated binding of
`do_`, not an assertion of it.

`fjs/server/fjs_run`'s was different and is worth recording separately: widening was not available
there, because a `Report` is typed at `CasOp` and `_CasOpIsExactlyTheFourCommands` is a security
claim. The fixture is placed as a **`JsModule`** instead — `runExecuteRunViaFixture` is a one-line
adapter over `runExecuteRunViaModuleFixture` — so the adversarial program crosses `import_` exactly
where a real stored program does, and a `Module` is `StringMap<unknown>` on the far side. The lie
lands at the untyped boundary, which is where reality puts it.

Both were watched to fail: weakening `interpret`'s guard reddens 8 `fjs/exec` refusal leaves, and
changing the escaping module's `fetch` to `evoList` reddens exactly
`nonErrorThrowBecomesErrorResult`.

### Two findings that were not Effect work

- **The `fjs` CLI moved.** `cas-refresh-cross-process.test.js` spawned
  `node_modules/functionalscript/fjs/module.js` by a hard-coded literal; 0.46.0 renamed it
  `module.mjs`, so the child died with `MODULE_NOT_FOUND` before its first assertion — which reads
  in a report as "the cross-process refresh broke". It reads `bin.fjs` from the dependency's own
  manifest now.
- **`fjs_run`'s error response forwards the host's IO message to the client.** Pre-existing, and
  0.46.0 is what made it legible, because upstream now ships `errorMessage` (operator) and
  `errorSummary` (remote) and says which is for whom. Written up in
  [`mcp-error-text-forwards-host-messages.md`](./mcp-error-text-forwards-host-messages.md) rather
  than changed inside the migration.

### What was left after stage 4 (closed by stage 5)

**Only the 27 `parse` leaves**, and they are blocked on upstream re-exposing the 0.43.1 verbatim
validator beside `parse`. Every workaround available here needs a cast or a hand-asserted type
predicate. When that lands, consume it and this note's retirement condition is met but for the
report.

## Stage 5 — 0.46.1 restores `validate`, and the suite is green

`tsc` **0 -> 0**. Failing proof leaves **27 -> 0**. `npm test` **2478 pass / 27 fail ->
2505 pass / 0 fail**. Project-local proof leaves **2472 -> 2472** — unchanged, which is the
number that matters: a green suite bought by a module that quietly stopped importing would show
up here and nowhere else.

The whole migration, end to end, measured every time from a copy outside the parent checkout:

| Stage | `tsc` | `npm test` | project-local leaves |
|---|---|---|---|
| 0.43.1, before anything | 0 | 2500 / 2500 pass / 0 fail | 2467 |
| 0.46.0, specifiers untouched | 1526 | (gated: never ran) | — |
| 1 — specifiers to `.f.mjs` | 629 | — | — |
| 2 — the two relocation classes | 513 | 2500 / 2375 pass / 123 fail | 2467 |
| 3 — the Effect system | 282 | 113 leaves failing | — |
| 4 — the `Result` moves to the channel | **0** | 2505 / 2478 pass / **27 fail** | 2472 |
| 5 — **0.46.1's `validate`** | **0** | 2505 / **2505 pass / 0 fail** | **2472** |

### The fix was upstream, and that is the point of the stage

`upstream-rtti-parse-materializes-absent-members.md` — now deleted, and findable from any later
state with `git log --diff-filter=D --oneline --
fjs/todo/upstream-rtti-parse-materializes-absent-members.md`, which a pinned `HEAD~1` would not
survive the next commit on this branch — argued that every local escape hatch —
carrying the original value past a `parse` check, `rtti/data`'s erased `ResultE`, a hand-written
`value is Ts<T>` predicate, stripping the materialized `undefined`s back out — lands on a cast, an
`any`, or an unchecked soundness claim, all three forbidden by AGENTS.md. It asked upstream to
re-expose the 0.43.1 reader instead. **That is what shipped**: PR functionalscript#1645, released
as 0.46.1 (`2e9ad76f`, "0.46.1 (#1646)"). The note is deleted with this stage — its retirement
condition ("a released FunctionalScript exposes a typed structural validator that returns its
input unchanged, this project's call sites take it, and those 27 leaves are green again") is met
in all three parts.

The refused cast is worth naming as the mechanism, not just the outcome: it was refused twice, and
what the second refusal bought was a fix in the dependency that every consumer gets, arriving as
an **import-line-only diff here**. A cast would have been quicker and would have left the same
27 leaves red in behaviour with a green `tsc` — the dangerous direction this note has flagged
twice already.

### The API, and the one thing that is not where you would guess

`fjs/types/rtti/validate/module.f.mjs` exports
`validate: <T extends Type>(rtti: T) => Validate<T>` — the same signature `parse` has, so no call
site's shape changed. Verified by execution against the published 0.46.1, not read off a docstring:

```
validate: ok=true  same-object=true   absent-optional-stays-absent=true   undeclared-survives=true
parse   : ok=true  same-object=false  absent-optional-stays-absent=false  undeclared-survives=false
```

**`ValidationError` comes from `rtti/common/types.js`, not from a sibling of `validate`.** The
`validate` directory ships four files and none is a `types.d.ts`; `common/types.d.ts` is where
`Path`, `ValidationError`, `Validate` and `Result` are declared, and `parse/types.d.ts` only
re-exports them. Stage 2's rule ("a type comes from the sibling, a value from the module") has an
exception here, and the exception is visible only by listing the shipped directory — which is the
reason to list it rather than to pattern-match the path.

### Every one of the 32 sites took `validate`; none kept `parse`

Upstream's own framing is that the two are genuinely different operations and both are wanted:
`parse` deserializes a foreign value into a known shape, `validate` asserts that a value this
system already owns has the shape it claims. Judged one at a time against that line, **this
project has no site of the first kind.** Every one was `validate` on 0.43.1, every one is aliased
`rttiValidate`, and every one reads something the system already holds — a stored CAS document
(the 26 `fjs/document/*` dialects, `fjs/return/profile`, `fjs/run`), a stored result record
(`fjs/report/amend`), a stored snapshot (`fjs/server/finance_documents_list`), a JSON value being
checked for being one (`fjs/server/fjs_run`).

`fjs/server`'s decoder is the site that makes the difference legible, and it had been arguing
against `parse` in a comment the whole time without anyone reading it that way:

> rtti permits properties a schema does not mention — verified — so each schema below names only
> what its own leaf reads, and a full JSON-RPC envelope validates against a partial one.

Under `parse` that partial schema was not only a filter, it was also a **projection**: the
envelope came back truncated to the fields the leaf happened to name. The comment describes
`validate`'s contract exactly, and `parse` satisfied half of it.

### What is left

**The report the upstream author asked for** (`todo/update-fjs-0.46.0`, PR #96) — an extensive,
structured account of what the migration taught, how it adapted to this project, and the main
challenges. Nothing in the code is outstanding. The strongest material for that report is already
in this note: the 0.45-vs-0.46 table (why a smaller error count can be the worse one), the
effects-are-tool-calls section (and what it says about REQUIREMENTS.md's refusal of a
`finance_compute_1040` tool), stage 4's account of what an error channel changed about how the
code *reads*, and this stage — a constraint held until the dependency changed rather than the
constraint.
