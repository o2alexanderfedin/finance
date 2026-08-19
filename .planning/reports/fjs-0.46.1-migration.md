# Migration report: FunctionalScript 0.46.0 → 0.46.1

For Sergey Shandar, who asked for this in `todo/update-fjs-0.46.0` (PR #96): *"an extensive,
structured report on the migration to 0.46.0 once it's done. In particular, I'm interested in
whether you learned anything new and how you adapted to the project, as well as what the main
challenges were."*

This is the consumer's side of the release. It does not restate what 0.46 does — you wrote it. It
records what happened downstream: what the release deleted from this codebase, two live defects it
exposed, one gap that went back upstream as #1645, and the traps a consumer hits that are invisible
from where the library is authored.

Scope: `fjs-dev/finance`, a Form 1040 engine written entirely in FunctionalScript. ~2,500 proof
leaves, everything under `fjs/` pure, values stored as JSON in a content-addressed store, run
records pinned by program hash. Migration done 2026-08-18 in five stages on `develop`.

**Final state, re-measured for this report from an rsync'd copy outside the parent checkout:**
`tsc` **0**; `npm test` **2505 tests, 2505 pass, 0 fail**; **2472** project-local proof leaves
(`npm test 2>&1 | grep -c '^✔ import("./fjs/'`).

---

## 1. The numbers

Every count below was taken from a copy of the tree outside the parent checkout — see §6.1 for why
that qualification is not pedantry. Each row is also recorded in the commit that produced it.

| Stage | `tsc` | `npm test` | project-local leaves | what closed the gap |
|---|---|---|---|---|
| 0.43.1, before anything | 0 | 2500 / 2500 pass / 0 fail | 2467 | baseline, established rather than assumed |
| 0.46.0 installed, specifiers untouched | **1526** | gated, never ran | — | — |
| 1 — specifiers | **629** | — | — | every `functionalscript/**` specifier ending `.js` → `.f.mjs` / `.mjs` |
| 2 — the two relocation classes | **513** | 2500 / 2375 pass / 123 fail | 2467 | `rtti/validate` → `rtti/parse` (32 modules); 226 type names → sibling `types.ts` |
| 3 — the Effect system | **288** | — | — | `Operation`'s `Result` return declared at the two *vocabulary* declarations: `TestOp` in `fjs/exec` (513→472), then `CasOp` in `fjs/guest` (472→288, seven modules at once) |
| 3 (cont.) | **282** | 2500 / — / 113 leaves failing | — | `runPure` now yields `Option<Result<T,E>>` (288→287); `resultStep` at the two sites whose continuation genuinely branches (287→282) |
| 4 — the payload's `Result` moves to the channel | **0** | 2505 / 2478 pass / 27 fail | 2472 | this project's own fallible helpers, one at a time with all callers in the same pass, six passes |
| 5 — 0.46.1's restored `validate` | **0** | 2505 / **2505 pass / 0 fail** | **2472** | an import-line-only diff across 32 modules |

Two columns matter more than the `tsc` one.

**The leaf count is the column that had to not move.** A suite made green by a module that quietly
stopped importing shows up there and nowhere else. It is 2467 before, 2467 through stage 3, and
2472 from stage 4 — the five new ones being `fjs/refuses`'s own proofs, added by this work.

**A smaller error count can be the worse one.** We measured 0.45.0 the day before and refused it:

| | 0.45.0 (2026-08-17) | 0.46.0 (2026-08-18) |
|---|---|---|
| `tsc` before touching anything | 1287 | 1526 |
| after the mechanical specifier rename | 288 | 630 |
| what the residue *was* | shipped declarations imported core types without re-exporting them, so every fix was a cast, an `any`, or a redeclared type — all three forbidden here | real API changes with real new APIs to adopt |
| verdict | unconsumable | consumable; ordinary migration work |

288 unfixable errors are worse than 630 fixable ones, and a count alone cannot tell you which you
have. That is the single most useful thing this project learned about *evaluating* a release, and
it is the reason 0.46 was taken within a day of shipping while 0.45 was not taken at all.

---

## 2. The headline: 0.46 deleted code here

The interesting output of this migration is negative. Three things went away and nothing replaced
them.

### 2.1 A `try` carried since 0.41.0

`fjs/exec` is this project's sandbox interpreter: it dispatches a stored, content-addressed guest
program against a four-command whitelist, and it exists to refuse a command name that bypassed
`tsc` (a stored program is a CAS blob; nothing typechecked it). At 0.43.1 a missing handler was an
`assert` throw, so the only way to *observe* the refusal was to catch it:

```js
try {
    const result = match(map)(e)
    ...
} catch (thrown) {
    assert(typeof thrown === 'string')
    return error(refusalMessage(thrown, map))
}
```

That `try` was introduced on 2026-08-03 against `^0.41.0` (`4e3d51a`) and was still there on
2026-08-17 when the notes were re-checked against 0.45.0. It was the only `try` in this codebase
forced by a *dependency* refusing in the wrong shape — which is what made it the one we could not
remove ourselves.

0.46 removed it, and not by letting us catch differently: by making the refusal a value we never
have to reach for. `fjs/exec` now calls `at(command)(map)` before dispatch and refuses a `null`
lookup as an ordinary `Result`; every command that survives is one `match` is guaranteed to find,
so the documented throw is unreachable from that call site. `fjs/todo/upstream-total-match-dispatch.md`
was deleted with it.

### 2.2 Eight `try` sites resolve to one

Removing that one forced an audit of the rest, and the split is the finding:

| Site | Verdict |
|---|---|
| `fjs/exec` | retired by 0.46's error channel (§2.1) |
| `fjs/server/fjs_run/snapshot` | stale — see §3.2 |
| `fjs/schedule/a:578` (production) | illegitimate. It caught its own `assert` and turned it back into `{ kind: 'error' }`. The rule now lives in `saltIncomeTaxDriftMessage`, which *returns* `string \| null`; the throwing form is a two-line wrapper over it |
| `fjs/schedule/a:656`, `fjs/tax/deduction:427`, `fjs/tax/table:672` and `:800`, `fjs/return/scope:3115` and `:3227` | legitimate, but six copies of one idiom in four modules — two of them private `refuses` helpers whose own docstrings said they were reimplemented because the other was not exported. Consolidated into a single exported `fjs/refuses` |

`fjs/refuses` is the one carve-out now, stated in AGENTS.md with a checkable condition
(`grep -rn 'try {' fjs --include='*.f.js'` returns exactly one code hit). It exists because this
project's refusals throw **bare** values, and a proof nested under a `throw:` key passes for *any*
throw — which is exactly how a `<` → `<=` mutation in `fjs/tax/table` once stayed green. Catching
is the only way to read what was thrown, and reading it is what makes the leaf load-bearing.

It is finance-free and shaped to be lifted upstream beside `fjs/asserts`, whose `assert` produces
the values it reads. Offered, not pushed.

### 2.3 Three `any`s

All three were the same shape and all three were sayable in 0.46 without adding anything.

Stage 3 recorded `fjs/exec`'s `unsafeDo` as out of scope, with a precise and wrong reason:
*"removing it needs `interpret`'s signature to admit an effect whose op-set is WIDER than its
map's, which is true and currently unsayable."* Nothing has to admit a wider op-set — the map and
the effect can both live at a wider **vocabulary**, because `Operation` is
`readonly [string, (…) => Result<…>]` and a command name that is not statically known is therefore
an ordinary operation type rather than a hole. Each site gained a `ProbeOp` (same handler signature,
`string` in place of the four literals) and `probeDo` is an annotated binding of `do_` rather than
an assertion of it.

`fjs/server/fjs_run`'s third one had no such route: a `Report` is typed at `CasOp` and
`_CasOpIsExactlyTheFourCommands` is a security claim, not a convenience. The adversarial fixture is
placed as a `JsModule` instead, so it crosses `import_` exactly where a real stored program does
and a `Module` is `StringMap<unknown>` on the far side. The lie lands at the untyped boundary,
which is where reality puts it.

Both were watched to fail, per this project's rules: weakening the `at` guard reddens exactly 8
`fjs/exec` refusal leaves, and repointing the escaping module's probe reddens exactly
`nonErrorThrowBecomesErrorResult`.

---

## 3. Two latent defects the migration exposed

Neither was found by reading. Both are the kind of thing a release surfaces in a consumer and
nobody upstream can see.

### 3.1 A missing blob reached MCP clients as a policy refusal

`fjs/server/fjs_run/snapshot`'s `buildHostMap` builds the synchronous handler map that the sandbox
dispatches through. At 0.43.1 its `casRead` and `evoRevision` reported a hash the snapshot does not
hold by throwing a bare string:

```js
casRead: hash => {
    const blob = snapshot.blobs[hash]
    if (blob === undefined) { throw `blob not found: ${hash}` }
    return blob
},
```

That throw crossed `fjs/exec`'s `try` — the one from §2.1 — and came back out **relabelled**. The
catch's only job was to turn a missing-handler `assert` into a refusal message, so a
data-availability failure was reported as:

```
operation not permitted: blob not found: <hash>; permitted: casRead, evoList, evoHead, evoRevision
```

A missing blob presented as a *policy* verdict, in the run record and in the `fjs_run` MCP error
response. It was live in shipped behaviour and nothing asserted the label, so nothing caught it.

The fix was not a fix — it was a consequence. 0.46's `Operation` requires a handler to return a
`Result`, so the channel these two handlers always had became a thing they had to *declare*. Typing
it is what makes the failure travel under its own name, and it is now recoverable by the guest,
which a throw never was.

### 3.2 A `try` whose subject had stopped throwing, and a proof that could not tell

The same commit that gave `buildHostMap` its `Result` made this leaf's `try` stale:

```js
casReadOnAbsentHashThrowsAPlainString: () => {
    const map = buildHostMap(twoBlobSnapshot)
    try {
        map.casRead('absent-hash')
        assert(false, 'expected casRead to throw for an absent hash')
    } catch (thrown) {
        assertEq(typeof thrown, 'string')
        assert(!(thrown instanceof Error), 'must never throw an Error')
        assert(String(thrown).includes('absent-hash'), String(thrown))
    }
},
```

`map.casRead` no longer threw, so the inner `assert(false, …)` fired, and the `catch` caught *that*.
All three assertions then ran against the leaf's own failure message — and **two of them passed**:
`'expected casRead to throw for an absent hash'` is a string, and it is not an `Error`. Only the
third, the one that reads the *content* of the refusal, noticed anything was wrong.

That is the pre-existing part, and it is the part worth reporting. The staleness was created by the
migration and caught within it; what was invisible before is that two thirds of this leaf's
assertions were satisfied by the proof's own scaffolding and would have been satisfied by any bare
throw from anywhere. It is now:

```js
casReadOnAbsentHashAnswersAPlainStringError: () => {
    const map = buildHostMap(twoBlobSnapshot)
    const [t, v] = map.casRead('absent-hash')
    assertEq(t, 'error')
    assertEq(typeof v, 'string')
    assert(v.includes('absent-hash'), v)
},
```

The `instanceof Error` assertion is gone because the refusal's type is now `string` — the compiler
makes it unfalsifiable, which is strictly stronger than the runtime check was.

---

## 4. The `parse` / `validate` episode

This is the one part of the migration that could not be finished inside this repository, and it is
worth telling in full because the shape recurs.

### 4.1 What the split did here

0.46.0 restructured `fjs/types/rtti/validate` into `parse`, `common` and `data`. `parse` has the
signature old `validate` had (`<T extends Type>(rtti: T) => Parse<T>`, `Parse<T> = Validate<T>`),
so all 32 modules that call it migrated by changing one import, and `tsc` went to 0 across all of them.

`parse` rebuilds. This project's values are JSON already sitting in a content-addressed store, so
two properties are load-bearing:

- **Absent is not present-and-`undefined`.** An absent box means the payer did not report that
  figure. `{ b: undefined }` says something else and serializes differently. Proof leaves assert
  this by name — *"absent is absent, never a materialized undefined"*.
- **Byte identity.** Rebuilding changes the bytes, so it changes the hash. The document that comes
  out of a check is not the document that went in, and a run record pinned by hash stops resolving.

The measured cost: **27 proof leaves in 13 modules, all of which typecheck cleanly**. A behavioural
regression under a green `tsc` — the dangerous direction. It was found by running the suite with
the `tsc` gate bypassed while stage 3 was still red, which is the whole argument for doing that.

There is a second half that is quieter and possibly worse. `fjs/server`'s JSON-RPC decoder had this
comment sitting above it the entire time:

> rtti permits properties a schema does not mention — verified — so each schema below names only
> what its own leaf reads, and a full JSON-RPC envelope validates against a partial one.

Under `parse` that partial schema was not only a filter, it was a **projection**: the envelope came
back truncated to the fields the leaf happened to name. The comment describes `validate`'s contract
exactly, and nobody read it that way for a day.

### 4.2 Why nothing was worked around locally

AGENTS.md forbids casts over indexed access, `any`, and non-null assertions, and treats an
unchecked soundness claim as the same act as a cast. Every escape hatch lands on one of them:

| Workaround | What it costs |
|---|---|
| keep `parse` for the check, pass the original value onward | the original is `Unknown`; narrowing to `Ts<T>` is a cast |
| `rtti/data`'s `validate(toData(rtti))` | preserves the value, but `ResultE` erases the payload — the same cast at every call site |
| hand-write a `(value: Unknown) => value is Ts<T>` predicate | a soundness claim the compiler cannot check, asserted at every call site. Not `as`, but the same act |
| strip the materialized `undefined`s back out | reintroduces the undeclared-key loss, cannot recover the dropped keys at all, and puts a generic rtti concern in app code |

So the work **stopped and recorded** instead — twice. Once at stage 2, when the regression was found
(`05311ed`, a commit that fixes nothing and exists only to write the gap down), and again at stage 4,
when `tsc` reached 0 and this was the only thing left. Both times a cast would have been quicker,
and both times it would have left the same 27 leaves behaviourally red under a green typecheck.

### 4.3 Upstream, and being fair about it

It went up as **functionalscript#1645**, restoring `fjs/types/rtti/validate` as the verbatim reader,
and shipped in 0.46.1 (`2e9ad76f`). It reverses **#1624**, which was two days old.

Two things should be said plainly, because the outcome makes it easy to say only one.

**`retire-validate.md` was sound for the case it addressed.** It read the objection to deleting
`validate` as a *cost* objection — two traversals, a discarded intermediate — and answered it with
the one-pass JSON reader in `media/json/todo/rtti-parse.md`. For text coming in off the wire, that
answer is strictly better and we are not arguing with it. The gap is a case the reasoning did not
reach: a value already in memory whose *identity* is load-bearing. The closing line — *"neither has
a reason to return its input unchanged"* — is the sentence a content-addressed consumer contradicts,
and it is the only sentence we contradicted.

**The precedent was already inside #1624.** Its one non-drop-in site, `dev/package_json`, ended up
doing "parse for the check, return the value it was given, with the cast the successful parse
justifies" — this function, hand-rolled at one call site, with a cast. (#1625 then removed the
module for having no consumers, not because the shape was wrong.) So the need was demonstrated by
the retiring PR itself; what a consumer under this project's rules adds is that it cannot write
that line at all.

#1645 is additive: `parse` is untouched in behaviour, signature and exports; no importer moves back;
the data form is untouched; `sizeOk` does not come back. Three proof leaves are the whole reason the
function exists — `absentOptionalStaysAbsent` (`!('b' in out)`, beside the `parse` call showing
`'b' in out`), `undeclaredMemberSurvives`, and `referenceIdentity` (`Object.is(result, input)`).

Consuming it here was an import-line-only diff. **All 32 modules took `validate`; none kept `parse`.**
Judged one at a time against your own framing — `parse` deserializes a foreign value, `validate`
asserts that a value this system already owns has the shape it claims — this project has no site of
the first kind. Verified by execution against the published 0.46.1 rather than read off a docstring:

```
validate: ok=true  same-object=true   absent-optional-stays-absent=true   undeclared-survives=true
parse   : ok=true  same-object=false  absent-optional-stays-absent=false  undeclared-survives=false
```

**The mechanism is the part we would repeat.** A refused cast bought a fix in the dependency that
every consumer gets, arriving here as an import-line change. The cast would have been quicker on the
day and would have left the defect in place, silently, forever.

---

## 5. What we learned

### 5.1 Effects are isomorphic to LLM tool-calling, and that reframed this project's thesis

`Operation` is a command **name** paired with the signature a runner implements it at. A runner may
decline a command it was not given a handler for; the answer is `error(notImplemented(command))`,
and the program receives control back and decides what an incompatible runner means for it. Even the
reason the refusal carries only the name — the payload may hold functions, so carrying it would
break serializability — has an exact counterpart in a tool-call schema.

That is a tool call, a tool the client does not have, and a caller deciding what to do about it.

This matters here for a specific reason. `.planning/REQUIREMENTS.md` permanently forbids a
`finance_compute_1040` tool, on the grounds that the agent must **author a program** rather than
call one. The obvious objection to that rule is that it is a distinction without a difference — the
same computation runs either way. If effects are isomorphic to tool calls, that objection is
correct about the mechanism and wrong about the thing being protected. The difference was never
*what executes*:

| | an LLM's tool calls | this engine's effects |
|---|---|---|
| who picks the next call | the model, at every step | the program, written once in advance |
| reproducibility | none | byte-identical, from the same program hash |
| a failed call | the model improvises | `Result<T, E>`, discharged by type |

The same mechanism, with the decision made once and stored in CAS instead of re-made on every step.
That is the clearest statement of the thesis this project has produced, and we got it by reading
your type declarations. It is recorded in `fjs/todo/upstream-mjs-migration.md`, and it is the reason
that note calls the analogy a finding rather than a metaphor.

### 5.2 `partialMatch` is the wrong eliminator for a whitelist

0.46 offers a runner two eliminators and choosing between them *is* the design decision in
`fjs/exec`. `partialMatch` hands `error(notImplemented(command))` to the **guest's own
continuation**. For a runner that merely lacks a capability that is exactly right. For a whitelist
it is wrong in a way that matters: a malicious stored program could catch its own refusal, return a
plausible value, and leave the denial nowhere in the run record.

`fjs/effects/types.ts` states the rule itself — *"a capability the runner merely lacks is answered
with this error; a refusal to continue is an interruption, never dressed up as `NotImplemented`"* —
so this is not a divergence from upstream, it is upstream's own distinction applied. `interpret`
calls `at(command)(map)` before dispatch, keeps a refusal as its **own** error, and ends the run.
`Interpreted<T>` became `Interpreted<T, E>` with an `E | string` channel: `string` is an
interruption by the sandbox, `E` the guest's own failure passed through untouched.

Worth noting for the docs: the rule is in the `NotImplemented` docstring, which is the right place
for a reader who is already looking there, and the wrong place for a consumer choosing a
combinator. It took a security review to find it. A sentence in `partialMatch`'s own docstring
saying "not for a whitelist; see `NotImplemented`" would have saved that.

### 5.3 The error channel changed how the code reads

The measurable effect of stage 4 is not that the code got shorter. It is that **the success path
became the only path a reader has to follow**, and the places that still handle failure became the
places that decided something.

`fjs/report/amend` is the clearest single site. Before — the callee opened with two arms whose only
job was to add context to a message and stop:

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

After — the arms are gone from the callee entirely, and the context they added moved to the two call
sites that know which side is which:

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

`compareRunsAndDiff`'s signature is the part that matters: it takes two `Run`s, so the **compiler** —
not a comment, and not a reader's care — is what guarantees the comparison below it never sees an
unread record.

The same shape repeats at every scale. `fjs/guest/check`'s `fjsCheck` lost three nested
`if (r[0] === 'error')` arms and two casts, and became five straight-line bindings.
`fjs/server/fjs_run`'s `executeRun` lost four `pureOk({ kind: 'error', … })` arms to a single named
combinator, `asRunOutcome`, applied on the last line — which is also where the policy now lives,
visibly: *this* is the layer that says an infrastructure failure and a guest failure are the same
thing to a caller.

Three things the channel made **sayable** rather than merely shorter:

- **`Effect<O, T, never>` is a claim.** `fjsRunTool`'s handler and `handleRunOutcome` declare it and
  `toolEntry` requires it: an MCP handler turns every failure into a JSON-RPC error response. That
  was always true here and was previously unwritten.
- **`unwrapStep(e, summary)` is a greppable panic with a scope.** It replaced
  `assert(writeResult[0] === 'ok', …)`. Same bare-value panic, but the `summary` argument means a
  *widening* error channel becomes a compile error at the site that chose to crash, rather than
  quietly enlarging what it crashes on.
- **`exitStep` caught a real bug in five characters.** `fjs/index.f.js` was
  `step(financeMcpServer(…), () => pureOk(0))`, which reported a server that never started as a
  clean exit 0. `step` discarded a failure it could not see, because before 0.46 there was nothing
  to see it in.

### 5.4 Order the work by vocabulary, not by error count

The order taken was `exec` → `guest` → `fjs_run`, not `exec` → `fjs_run`, even though `fjs_run` held
202 of the 513 errors and `guest` held 17. `CasOp` — the operation vocabulary the entire run spine
is typed against — is declared in `fjs/guest`, and until its four handlers returned a `Result`
nothing downstream could satisfy `Operation`'s constraint. Fixing 17 errors at the declaration took
472 → 288 across seven modules at once. Going by count first would have meant fixing the same
constraint error roughly 150 times.

The generalisation, for anyone migrating: `TS2344 … does not satisfy the constraint 'Operation'`
is never a local error. Find the type declaration it names and fix that.

---

## 6. The main challenges

### 6.1 The measurement trap — the first result this migration produced was a false green

This deserves its own section because it is a trap for any consumer of these releases, not a
peculiarity of our setup.

Our agents work in git worktrees, which live at `<repo>/.claude/worktrees/agent-*/` — i.e. *inside*
the parent checkout. TypeScript resolves a bare specifier by walking every ancestor `node_modules`
in a first pass that **prefers TypeScript and Declaration extensions**. 0.46.0 ships only `.d.mts`
and no `.d.ts`, so a legacy `functionalscript/**.f.js` specifier finds nothing in the worktree's own
`node_modules`, keeps walking up, and binds to the parent's `functionalscript@0.43.1`.

Measured: `npx tsc --noEmit` in the worktree reported **0 errors** against a tree whose true count
was **1526**.

Three properties make this worse than ordinary dependency drift:

1. **It lies green.** Version drift between two checkouts produces sixteen confusing errors — bad,
   but it makes you look. This produces zero.
2. **Only the typecheck lies.** Node's own runtime resolution takes the nearest `node_modules` and
   is unaffected, so the tests run against the right version and the typecheck does not. Nothing
   disagrees loudly enough to notice.
3. **The condition that triggers it is the shipping change itself.** A package that ships `.d.ts`
   alongside would bind locally and never reach the parent. It is the `.d.mts`-only layout, plus a
   not-yet-rewritten specifier, that opens the hole — precisely the state every consumer is in on
   the first day of this migration.

The rig, now written into AGENTS.md and used for every number in §1:

```sh
rsync -a --delete --exclude .git "$PWD/" /tmp/measure/
( cd /tmp/measure && npx tsc --noEmit ) | grep -cE 'error TS'
```

and, to sanity-check any surprisingly clean result,
`npx tsc --noEmit --traceResolution | grep -c "$PWD/node_modules"` — a zero there means nothing
resolved to your own dependencies. Stage 5 was verified this way: 6585 resolutions into the copy's
own `node_modules`, 0 into the parent's.

### 6.2 Fourteen specifiers hiding in JSDoc `@import` comments

This project types with JSDoc, so most of its dependency specifiers are not in `import` statements
at all. The stage-1 rewrite touched 158 JSDoc `@import` lines, 3 inline `import('…')` type
annotations, 1 side-effect import, and the prose paths in comments that name upstream files. **A
first pass missed 14 of them**, all inside `@import` comments — a grep for `from '` finds none of
these.

Two related notes for anyone doing the same rewrite. 0.46.0 ships **no `.js` at all** (254 `.f.mjs`
plus declarations, zero `.f.js`), so the rule is every `functionalscript/**` specifier ending in
`.js`, not only `.f.js` — `fjs/effects/node/module.js` and `emergent_testing/all.test.js` (the one
line this project's entire proof suite hangs on) move too. And the rewrite must be anchored on the
`functionalscript/` prefix, because this project's own files stay `.f.js`.

### 6.3 `ValidationError` is not beside `validate`

Stage 2 derived a clean rule from the `types.ts` convention — *a type comes from the sibling
`types.js`, a value from the module* — and it held for all 226 relocated names in stage 2. Stage 5
found the exception, and it cost real time: the shipped `validate/` directory contains four files
and **none of them is a `types.d.ts`**. `Path`, `ValidationError`, `Validate` and `Result` are declared in
`common/types.d.ts`, and `parse/types.d.ts` merely re-exports them.

The exception is visible only by listing the shipped directory, which is the argument for listing it
rather than pattern-matching the path. See §7.2.

One further note on the specifier we write: it is `types.js`, not `types.ts`. Upstream can write
`.ts` because it sets `allowImportingTsExtensions`; this project deliberately does not. Under
`nodenext`, `types.js` strips to `types.ts` / `types.d.ts` and binds to the shipped declaration.
Every such specifier here sits in a JSDoc `@import`, so it is erased before runtime and no
`types.js` is ever fetched — verified: no `import` statement in the project names one.

### 6.4 `foldStep` / `forEachStep` gained short-circuit semantics, and three deliberate skips broke

The `Result`-blind fold that these replaced ran every item; the new ones stop at the first `error`.
Three folds here contained a deliberate **skip** that the old fold expressed by simply carrying on,
and under the new one each would have abandoned the whole traversal:

- `fjs/server/fjs_run/snapshot`'s `buildRunSnapshot` — **two** skips, and they must stay two. A hash
  `cas.list()` reported but that will not read is skipped; a blob that reads but is not a revision is
  skipped **while still contributing its bytes to `blobs`**. One outer `catchStep` would have
  discarded the bytes in the second case, and `undecodableHeadStaysObservable` is the leaf that
  measures exactly that difference.
- `fjs/server`'s `casRefreshTool` — one unreadable blob must not abandon the dialect count.
- `fjs/server/finance_documents_list`'s `entryFor` — an undecodable revision and a broken snapshot
  blob mean the same thing, so they are one recovery; but it stays per-pair, or one bad document
  would drop every remaining row.

The resolution is a `catchStep` around **precisely the effect whose failure it forgives** — not one
outer recovery. And a failure of `cas.list()` itself is deliberately *not* skipped in any of them and
travels the channel: a snapshot of a store that cannot be listed is not a smaller snapshot, it is no
snapshot.

This is the change that a `tsc`-clean consumer is most likely to get wrong, because a fold whose
body now short-circuits still typechecks perfectly. See §7.2.

### 6.5 A renamed CLI entry point that read as a broken feature

`cas-refresh-cross-process.test.js` spawned `node_modules/functionalscript/fjs/module.js` by a
hard-coded literal. 0.46.0 renamed it `module.mjs`, so the child died with `MODULE_NOT_FOUND` before
its first assertion — and what that produces in a test report is "the cross-process refresh broke",
pointing at a feature that is fine. It reads `bin.fjs` from the dependency's own manifest now, which
is the value npm links and therefore cannot drift from what `fjs` actually runs.

### 6.6 One runtime failure that `tsc` pointed away from

Worth recording as a class. 0.46 moved `collectRead`'s failure out of the effect's payload and into
its channel and made `step` short-circuit on it, so a continuation that used to receive
`Result<Vec, IoError>` now receives the `Vec`. Lines written against the old shape then do this:

```js
if (readResult[0] === 'error') { … }
utf8ToString(readResult[1])
```

`readResult[1]` is `undefined`, `utf8ToString` walks it into `types/bigint`'s `log2`, and a `bigint`
shift mixed with a `number` throws three frames below anything this repo wrote. The typecheck's
complaint is `Property '1' does not exist on type 'Symbol & { bit_vec … }'` — true, and it reads as
a bit-vector problem rather than an effect-composition one.

The fix is not to reach around the `Result`, it is `resultStep`, which *is* the Result-blind `step`
those lines were written against — your own header in `fjs/effects/module.f.mjs` says so, and that
sentence is what resolved it. Two sites.

A caution for other consumers, since we got this wrong in the other direction too: `resultStep` was
the right move for stage 3 and the wrong place to stop. A `resultStep` whose continuation
immediately branches on `r[0]` is a hand-written short-circuit; moving the failure into the channel
deletes the branch instead of typing it. Stage 4 undid most of stage 3's `resultStep` sites.
`resultStep` is for a site where **both** branches genuinely matter.

---

## 7. Suggestions upstream

Only where there is evidence from this migration.

### 7.1 The `types.ts` convention: consumed, not yet adopted

Your PR #96 suggests this project adopt `types.ts` for its own type definitions. We have **consumed**
it completely and have **not adopted** it for our own types, and that remains the owner's call
rather than something a migration should decide.

What the migration can report is that consuming it was the cheapest of the three relocation classes,
for one reason: **the move is total, not partial.** 226 type-import names across our sources, and not
one is still exported from a `module.f.mjs`; no import line mixes a moved name with a staying one. So
the rewrite is a single rule with no case analysis. Had it been partial, it would have been the
expensive class instead of the cheap one. If the convention rolls out further, keeping each move
total per module is worth more to a consumer than doing it quickly.

The one thing we would ask for is consistency of the *sibling* rule, or a note where it does not
hold — §6.3.

### 7.2 Two things a consumer would want documented

- **`foldStep` / `forEachStep` short-circuit.** The signature change is visible; the semantic change
  is not, and code that relied on "the fold keeps going" continues to typecheck. A line in those
  docstrings saying the fold stops at the first `error`, and that a per-item recovery is spelled
  `catchStep` **around the item's own effect**, would have saved us the three sites in §6.4 — one of
  which we would have got subtly wrong (the two skips that must stay two) if a leaf had not measured
  the difference.
- **A pointer from `partialMatch` to the interruption rule** (§5.2). The rule is stated in
  `NotImplemented`'s docstring and it is correct there; a consumer picking an eliminator for a
  sandbox is reading `partialMatch`.

### 7.3 `errorMessage` vs `errorSummary` — a pre-existing leak that 0.46 made legible

Still open here, written up in `fjs/todo/mcp-error-text-forwards-host-messages.md`.

0.46 ships two renderers and says in as many words which is for whom: `errorMessage` for the
operator, *"who is entitled to the host's own words — including the path that failed"*, and
`errorSummary` for a remote caller, because *"`payload.message` is where the host puts the absolute
path it could not read, so answering an MCP tool call with it publishes the server's filesystem
layout"*.

Having both is what made our own defect readable. `materializeProgram` renders with `errorMessage`,
and that string travels: `executeRun`'s channel → `asRunOutcome` → the stored run record (local,
correct) **and** → `errorResult('fjs_run failed: …')`, which goes to the MCP client. An `ENOENT` there
publishes an absolute path under the server's CAS home.

We deliberately did not change it inside the migration: at 0.43.1 an `IoError` *was* the message, so
`errorMessage` is the faithful successor, and swapping renderers would have been a silent behaviour
change dressed as plumbing. The fix, when taken, is to **redact at the boundary, not at the source** —
let the channel carry `IoChannel` further and render twice, `errorMessage` into the run record and
`errorSummary` into the response. That is only possible *because* of the error channel; it is a
small, concrete example of the value being kept alive to the place that can decide about it.

Nothing is asked of upstream here beyond the observation that shipping the two renderers with that
docstring is what caused a consumer to find a live leak in its own code. It is the most direct
example in this migration of documentation doing work.

---

## 8. Summary

- 0.46 is the first FunctionalScript release this project has taken that made it **delete** code
  rather than accommodate: one `try` carried since 0.41.0, seven more it forced an audit of, three
  `any`s, four hand-written error arms in one function, and a whole class of `if (r[0] === 'error')`
  guards.
- Two live defects surfaced, both invisible to a typecheck and both to do with a failure travelling
  in the wrong shape: a data-availability failure reported as a policy refusal, and a proof whose
  assertions could not tell a refusal from its own scaffolding.
- The one thing that could not be fixed here went upstream as #1645 and shipped in 0.46.1. The
  refusal to write a cast is what bought that, and the fix arrived as an import-line-only diff.
- The largest single hazard for any consumer of this release is not in the API. It is that a
  `.d.mts`-only package plus a legacy specifier makes `tsc` bind to an ancestor `node_modules` and
  report a **falsely green 0**.

`fjs/todo/upstream-mjs-migration.md` holds the full running record — six stages, per-pass counts,
and the reasoning as it was made rather than as it reads afterwards. This report is the summary it
retires on.
