# AGENTS.md

## Project

`finance` — a [FunctionalScript](https://github.com/functionalscript/functionalscript) (fjs) project.

## Requirements

- All source files live under [./fjs/](./fjs/) and are [FunctionalScript](https://github.com/functionalscript/functionalscript) files with an extension `.f.js`. The only exceptions are root-level entry points that are plain (impure) JS by necessity — keep this set as small as possible, currently:
  - [./index.js](./index.js), used to start the app,
  - [./all.test.js](./all.test.js), used to initialize FunctionalScript Emergent Testing Framework,
  - the root-level `*.test.js` gate and integration suites, which `npm test`'s `node --test *.test.js`
    glob is what discovers. `ls *.js` is the live list; it is **ten** files today, not two, and this
    bullet named only the first two until 2026-08-17 — long enough for an audit to read the set as
    stray impure JS. Each states in its own header why it cannot be a `.f.js` proof: it reads the
    filesystem, or spawns a real process, neither of which a pure module may do.
- The files can be used as normal ESM files.
- JSDoc comments are used for strong typing.
- TypeScript is used to validate the typing without emitting.
- We use FunctionalScript to run tests.
- Use FunctionalScript itself as much as possible instead of writing new plain-JS/TS logic.
- **We are contributors and owners of FunctionalScript.** Treat it as an open-source part of this project, not a third-party dependency: we can update it and release a new version at any time — for example, if we need a new Node effect. This is why a missing generic capability is a reason to release a new fjs version, never a reason to add a third-party dependency or write app-specific glue here.
- If FunctionalScript is missing something generic (a reusable helper, not app-specific logic), add it into this repo as a separate file/directory, so it can be moved into FunctionalScript later.
- If you find a bug or a gap in FunctionalScript, tell the user so they can fix it and release a new FJS version. A local workaround is fine — it should not block progress — but it must never be *silent*: whenever you work around an FJS bug or gap, also write a todo file recording it, named `fjs/todo/upstream-<short-name>.md`. State what is missing or broken, the workaround in place here, and what the upstream fix should look like. These are the candidates to upstream and delete once a new FJS version ships (see [./todo/plan.md](./todo/plan.md) Week 5).
- **A gap may be taken upstream directly** — standing authority granted 2026-08-27, written here 2026-08-31 (MAINT-13). This EXTENDS the rule above, it does not replace it: the `fjs/todo/upstream-*.md` record is still written first, nothing goes silent, and that record is what the upstream request is written *from*. `functionalscript#1645`, filed during the 0.46 migration, is the precedent for the shape.
- **Re-read your own `fjs/todo/upstream-*.md` notes when a new FJS version ships.** A note records that a gap exists; nothing re-reads it when the gap closes. 0.47.0 retired the MCP protocol-version gap and this repository went on asserting it was open for four days, in a docstring that told readers not to work around it and in three citations of a note deleted two milestones earlier — while the proof that should have caught it could not fail. See [`.planning/reports/fjs-0.48.0-migration.md`](./.planning/reports/fjs-0.48.0-migration.md) §5.1.
- **No third-party tools or libraries without approval from all owners.** Nothing may be added to `dependencies` or `devDependencies` until every repo owner has approved it. This is a hard stop, not a preference — propose it and wait. Do not add it, do not add it "temporarily", and do not vendor the code to sidestep the rule. What is already in [./package.json](./package.json) is the approved set, by definition; adding to it is the thing that needs approval.

  **One approved exception exists, and its shape is the point.** Browser automation for the
  hand-entry page needs a driver, and no fjs capability substitutes for a real browser — a
  hand-written DOM shim tests the shim. Approved by the owner on 2026-08-20 *"as a separate npm
  package"*, and that is how it lives: [`ui-tests/`](./ui-tests) is its own `package.json` with
  its own `devDependencies`, and the shipped `finance` package gains nothing. Nothing under
  `fjs/` may import from it, `npm test` does not run it, and deleting the directory leaves the
  engine untouched. A dependency the product does not ship is a different question from one it
  does, and this is the form an answer of "yes" should take.

  This rarely binds in practice, because the rules above already point elsewhere: a missing generic capability is a reason to release a new fjs version, and a missing app-specific one is a reason to write it here. Adding a third-party parser or helper would also break the purity model. If a dependency still looks necessary, that is a signal worth raising explicitly rather than resolving in a commit.

## Design discipline

religiously adhere to SOLID/KISS/DRY/YAGNI/TRIZ/TDD/Code-by-Intent, use rival agents,
facilitate Emergent Design sessions

## File conventions

- `tsconfig.json` is configured maximally strict (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noUnusedLocals/Parameters`, etc.). Keep new code passing under it; don't relax flags to silence errors.
- The entry point's pure logic lives in `index.f.js` and exports a `main` typed as `NodeProgram`.
- Specifications, issues, bug reports, and feature requests are MarkDown files in a `todo/` directory next to the code they concern — e.g. [./fjs/todo/](./fjs/todo/). Project-level planning lives in [./todo/](./todo/). Write the spec there before implementing; don't open a tracker.

  **This file points at `todo/`; it never restates what a `todo/` file says.** Design decisions and their rationale live in those files and are read from there. A rule copied into AGENTS.md is a second copy that will drift from the one that gets edited.
- New file formats follow the [Revision](https://github.com/functionalscript/functionalscript/blob/main/fjs/media/revision/README.md) precedent: JSON plus a dialect tag. Name the dialect `vnd.fjs.<name>`, which yields the media type `application/vnd.fjs.<name>+json`.

## Code style

- Never use `l` as an identifier — it's too easily misread as `1` or `I`.
- Import types with `@import { Name } from '...'` (a top-level JSDoc comment), not inline `@type {import('...').Name}`. A FunctionalScript type comes from the sibling `types.js`, never from `module.f.mjs`: since 0.46.0 upstream declares every type in a `types.ts` beside the module, and `types.js` is the specifier that resolves to the shipped `types.d.ts` without `allowImportingTsExtensions`, which this project deliberately does not enable. Example:

  ```js
  /** @import { NodeProgram } from 'functionalscript/fjs/effects/node/types.js' */

  /** @type {NodeProgram} */
  export const main = () => /* ... */;
  ```

## Testing — FunctionalScript Emergent Testing

- Any `.f.js` module may export a `proof` object: a tree of zero-argument functions (nested via plain objects/arrays). A leaf passes if it doesn't throw; leaves nested under a `throw` key must throw to pass.
- `all.test.js` (root) registers every discovered `proof` with Node's test runner, so `node --test` (and thus `npm test`) picks it up automatically via Node's default `*.test.js` convention — no manual test registration or explicit path needed.
- Add tests by adding/extending a `proof` export in the relevant `.f.js` file (see `node_modules/functionalscript/fjs/dev/proof.f.mjs` or `.../emergent_testing/example.f.mjs` for the pattern).
- **Only run proofs through root discovery — `npm test`, or `node --test all.test.js`.** Emergent Testing registration happens when `all.test.js` is imported; it walks the project via `loadModuleMap` and registers every discovered `proof`. Any invocation that bypasses that reports a *fake pass*, not a failure, which is the dangerous direction:
  - `node --test fjs` — errors with `Cannot find module`, because there is no `fjs/index.js` (the entry point is `fjs/index.f.js`). A hard failure is the safe direction; this bullet described a fake pass that the layout no longer permits.
  - `node --test fjs/some/module.f.js` — targeting a source file by explicit path is **also** a fake pass. Node executes it as a plain script; no `proof` leaf runs. Verified by injecting a leaf that throws unconditionally: `npm test` reported `tests 8, pass 7, fail 1`, while `node --test fjs/server/module.f.js` reported `tests 1, pass 1, fail 0` on the identical file.

## Hard rules

These are cited by name throughout the source. They are stated here so the citations resolve.

- **Money in a stored JSON document is a `string`, never a JSON number.** Documents, tax-year
  parameters, intermediates and reports alike. A JSON number is an IEEE 754 double by the time
  `media/json`'s `Unknown` sees it, so exactness dies at the boundary. The rtti field is `string`;
  exactness is enforced in the semantic check, mirroring how `vnd.fjs.revision` types `hash` as
  `string` and defers to `isHash`. In computation, money is integer cents as `bigint`.
- **No type cast over an indexed access, no `any`, no non-null assertion.** `tsconfig.json` sets
  `noUncheckedIndexedAccess`, so indexing yields `T | undefined` — that `undefined` is the
  compiler telling you something true. Bind the lookup to a local and narrow it with `assert` /
  `assertNotNullish`, as `fjs/server/finance_schema/module.f.js` does. A cast silences the check
  rather than satisfying it. (`/** @type {const} */` annotations and casts over a `JSON.parse`
  result are a different thing — they type an `any`, they do not discard a `| undefined`.)
- **`assert`, `assertNotNullish`, `unwrap` and `match` throw BARE values, not `Error`s.**
  `typeof e === 'string'` or an array; `e instanceof Error` is `false` and `e.message` is
  `undefined`. Never branch on `instanceof Error` — such a branch misses every refusal this
  codebase raises.
- **No `try` in a `.f.js`, with exactly one carve-out: [`fjs/refuses`](./fjs/refuses/module.f.js).**
  `throw` is reserved for panics, so a recoverable failure belongs in a `Result` or in an
  effect's error channel and is READ, never caught. The carve-out exists because this project's
  refusals throw BARE values, and a proof that a refusal fired must assert **what** it said —
  a leaf nested under a `throw` key passes for any throw, which is precisely how the `<`/`<=`
  mutation in `fjs/tax/table` stayed green. Catching is the only way to read a value that
  arrives by `throw`.

  The condition is narrow and checkable: **`grep -rn 'try {' fjs --include='*.f.js'` must return
  exactly one code hit, in `fjs/refuses/module.f.js`.** Scope it to `fjs/**.f.js`, which is what
  the rule is about. A first version of this line said `fjs demo` and "exactly one", and it was
  wrong on a healthy tree: `demo/demo.js` has opened a `try` since the showcase was built
  (`33c6ed1`), catching a step's render failure so a broken step shows on screen instead of
  leaving a blank page. `demo/` is the browser shell, not FunctionalScript, and the no-`try` rule
  never applied to it. **A check that fails when everything is well is worse than no check** — it
  teaches the next reader that its complaint is normal. A proof that needs to observe a refusal calls
  `refuses(call)(check)`; nothing else may open a `try`. Production code may not, at all —
  a caller that must handle a refusal wants the check to RETURN it (`fjs/schedule/a`'s
  `saltIncomeTaxDriftMessage`, with the throwing form as a two-line wrapper over it, is the
  pattern), and an effect's failure wants `catchStep`.

  This rule is written down because eight `try`s accumulated while it was not. Six were the
  same idiom copied into four modules — two of them private `refuses` helpers whose own
  docstrings said they were reimplemented because the other was not exported. One
  (`fjs/exec`) was a genuine workaround that 0.46.0 retired. One
  (`fjs/server/fjs_run/snapshot`) had outlived its subject: the code it caught had stopped
  throwing, so the `assert(false, …)` inside the `try` fired instead and the `catch` caught
  *that*, leaving the leaf asserting against its own failure message.
- **No new dependency, including a devDependency, without every repo owner's approval.**
- **A missing generic capability is written here in this project, shaped so it could be lifted
  upstream unchanged** — no locale or domain assumptions baked into a generic module. See
  `fjs/types/decimal` (scale as a parameter, zero finance-specific content) versus `fjs/exact`
  (integer cents, `centsFromString`/`centsToString`, a money convention kept one layer out).

  This example was `fjs/document/ocr_amount` until MAINT-01 deleted it as an orphan, which is
  the second-order cost of dead code worth naming: **a rule illustrated by an unreachable module
  is a rule nobody can check.** Pick live code for an example, or the example outlives the thing
  it describes.

## A proof is not known to work until you have watched it fail

A green suite proves nothing on its own. **Break the code on purpose and confirm the suite goes
red.** If it stays green, the proof is decoration and the code is unproven.

This is not a style preference. This project has shipped the same defect four times — a proof whose
expected side was not independent of the code under test — and each time the suite was fully green:

| Phase | The defect | Suite when the shipped code was mutated |
|---|---|---|
| 7 | Every fixture was keyed at the same wrong path the buggy code asked for, so the proof mirrored the bug | 185 proofs, all green |
| 9 | The zero-read rule existed twice; every proof exercised the copy that did not ship | 258 green |
| 8 | `finance_tax_params` compared its output against the very object that produced it | 262 green |
| 10 | `unknownDialectRefused` built its iteration set from `Object.keys(dialectSchemas)` — the code under test — so unregistering a dialect removed it from the proof's own loop in the same instant | caught by an executor's mutation before it shipped |

Nothing was found by reading. Every one was found by mutating.

**The fourth is the subtlest, and the shape to watch for: a proof that iterates over a collection
derived from the thing it is testing can never notice that collection shrinking.** `Object.keys`,
`Object.entries`, `.map` over an exported list — each silently makes the test's coverage a function
of the code's own contents. The fix is the same idiom already used by `expectedMoneyBoxFieldCount`
and `expectedThresholdCount`: a **hand-typed count**, asserted alongside, so deleting an entry
fails the count even when the loop happily iterates one item fewer.

**The rules that follow from it:**

- A proof's **expected** value must not be produced by the code under test. Hand-type it, or derive
  it from an independent source. The duplication is the mechanism, not a smell — do not "simplify"
  it away. (`fjs/tax/table`'s Publication 1040 rows and `fjs/server/finance_tax_params`'s per-field
  literals are the pattern to copy.)
- **A mutation must still typecheck.** `npm test` is `tsc && node --test`, so a mutation that fails
  to compile never reaches the tests and measures the compiler instead of the suite.
- **One rule, one place.** If a check appears in both a production path and a test helper, the
  proofs will bind to whichever the tests call, and the other can rot silently. Share it.
- **Assert the effect, not the error message.** Two different orderings can return the same message;
  only observing the side effect distinguishes them (Phase 6 learned this).
- **A gate needs a control.** A proof that something is refused must be paired with one showing the
  legitimate case is not — otherwise a gate that refuses everything passes.
- **Never gate a phase on `npm test`'s total.** The rule stands; the reason given here was itself
  stale. The total counts everything discovered outside `fjs/` — today ~30 root gate and
  integration leaves — and historically moved with submodule state, which is where the "~2,100
  vendored submodule proofs" figure came from. That figure was the pre-2026-08-17 double-run
  inflation this file diagnoses below; the submodule is de-initialised and contributes zero now.
  A Phase 7 gate of "total > 134" was already satisfied before that phase's first line was written.
  Use **`npm test`**, never bare `node --test`, and count project-local leaves:
  `npm test 2>&1 | grep -c '^✔ import("./fjs/'`. This line recommended the bare form until
  2026-08-17, contradicting this file's own warning below and skipping the `tsc` gate `npm test`
  runs first — so a count could be taken over a tree that does not typecheck.

**Sweep for untested code rather than guessing at it.** Copy the repo (`cp -a . /tmp/sweep` — `node_modules`
is a real directory here, not a symlink, so the copy includes the whole dependency tree and is
heavier than it looks), then mutate values, comparisons and
returned shapes one at a time, reverting each. Every mutation that leaves the suite green is
uncovered code. Two cautions learned by doing it: a copy shares the real repo's git directory, so
never run a *writing* git command from inside one (`git checkout --` to revert is safe and operates
on the copy; a `git commit` would record the copy's state — including files it lacks — into the real
repo). And once a proof hand-types an expected value, that literal exists twice: mutate by line
number and check `git diff --numstat` shows exactly `1` insertion and `1` deletion, or you will edit
the expectation alongside the code and confirm nothing.

The first such sweep ran 95 mutations across the project. **24 survived** — each one code that could
have gone wrong in production with the suite fully green. All are now covered. What it found is a
better guide to where risk actually lives than intuition was:

- The security-shaped code was **solid**. The import-specifier check, its ordering relative to the
  import, the template-literal refusal, the frozen operation vocabulary, `fjs/run`'s cross-field
  validation and `money_field`'s safe-integer boundary were all caught, several by a dozen or more
  failing leaves at once.
- The gaps were in **data-shaping code that ships real financial values**: a 1099-INT box mapping
  that could be transposed silently, money boxes droppable from a dialect's exactness loop, bracket
  data above $100,000 with no verification at all, `formSubject`'s encoding unpinned (a refactor
  could have forked every stored document's history), and `fjs_run`'s pin — which could be
  disconnected entirely while the run record still claimed the run was pinned.
- Several assertions checked the wrong thing: that a refusal *threw*, rather than what it threw.

Nothing on that list was found by reading the code.

### A clean merge with a green suite can still have dropped coverage

Merging the PR stack silently replaced a refusal proof in `fjs/server/fjs_run/snapshot` with a
weaker one. **There was no conflict** — git took one side, the suite stayed green, and nothing
flagged it. Two proofs had been rewritten from content assertions into bare `throw: { ... }` leaves
on the stated grounds that "reading a thrown value means catching it, and a `.f.js` module may
not". That premise is false: `fjs/exec/module.f.js` catches in shipped production code. The
`throw:` form passes for *any* throw — mutating `fjs/tax/table`'s refusal from `<` to `<=` still
throws at exactly $100,000.00, just via the unrelated "outside every stored band region" path.

So after any non-trivial merge, verify coverage rather than trusting the exit code:

```
# 1. both parents' proof-leaf sets must be subsets of the result
npm test 2>&1 | grep -o '^✔ import("\./fjs/[^ ]*' | sort -u      # run in each parent and in the result
comm -23 parent.txt result.txt      # must be empty, or every line individually explained

# 2. a name-set diff is NOT sufficient — a leaf can keep its name and lose its assertions
grep -cE '\bassert(Eq|NotNullish)?\(' <changed file>   # before vs after; a drop is a regression
```

**Use `npm test`, not bare `node --test`, and the difference is not cosmetic.** Until 2026-08-17
`npm test` *was* bare `node --test`, whose default discovery matches `*.test.ts` as well as
`*.test.js`. That picked up `functionalscript/fjs/emergent_testing/all.test.ts` — the vendored
submodule's own entry point — and **ran the entire proof suite a second time**, doubling both the
reported count and roughly 53 seconds of wall clock. `npm test` is now pinned to
`node --test *.test.js`, which is why root-level `*.test.js` files are the documented exception
and a test placed anywhere else will simply not run.

The `sort -u` above is therefore no longer load-bearing; keep it as a cheap assertion that raw and
unique counts still agree. **The reason this survived for months is worth more than the fix:** the
inflation was recorded as a fact about the *reporter* and never tested as a fact about the
*runner*, so the documented `sort -u` workaround removed all pressure to look again. A workaround
that works is the most expensive kind of bug.

Step 1 caught the dropped leaf; step 2 is what catches the case step 1 cannot see. Where a merge
deliberately replaces a proof with a stronger one, say so in a `MERGE NOTE` comment at the site, so
the next feedback pass does not revert it back.

**`npm test --prefix <dir>` does not run that directory's tests.** It sets the package location but
runs the script in the current working directory, so it will happily report a different tree green.
Use `( cd <dir> && npm test )` — in a subshell, because a bare `cd` persists across later commands.

**`git add` on the uninitialized `functionalscript` submodule silently discards a staged gitlink.**
That path's working tree is empty — the submodule is deliberately never checked out — so `git add`
re-reads nothing and restores HEAD's value over whatever you staged. No error, no warning:

```sh
git update-index --cacheinfo 160000,cc93a3ca,functionalscript   # staged: cc93a3ca
git add functionalscript                                        # staged: 5c5da3ac  <- back to HEAD
```

To move the pin: `git update-index --cacheinfo 160000,<sha>,functionalscript`, and **do not `git add`
that path afterwards**. Two further cautions, both learned by getting them wrong in one commit:

- **Verify with `git ls-tree HEAD functionalscript` AFTER committing**, never `git diff --cached`
  before. The staged value is correct right up until the commit that drops it, so the pre-commit
  check passes and the change is simply absent — visible only in `git show --stat`.
- **`git update-index --cacheinfo` accepts a SHA that does not exist**, without complaint. The value
  it stages is not evidence of anything; check it against upstream
  (`gh api repos/functionalscript/functionalscript/commits/<sha>`).

**Two references to one dependency drift apart.** `package.json`/`package-lock.json` name an npm
version and the submodule names a commit. Nothing keeps them in step, and only the npm one is what
actually runs. Move both in the same commit, and state which upstream release the submodule SHA
corresponds to.

**Each worktree has its OWN `node_modules`, and they drift.** `npm ci` in one does nothing for the
others, and nothing announces the difference. Two of this repo's three checkouts were found running
`functionalscript@0.41.0` against a lockfile pinning `0.43.0`, at the same commit as a checkout that
was green.

What that looks like is the trap: **sixteen `tsc` errors inside `fjs/**` that are not defects in
`fjs/**`** — `TS2314 Generic type 'StringMap' requires 2 type argument(s)`, `Type 'undefined' is not
assignable to type 'Unknown'` — plus a project-local proof count ten short (482, not 492), because
modules that fail to import never register their proofs. Every symptom points at your code. None of
it is your code.

So before believing a red result, and always before comparing two checkouts:

```sh
node -p "require('./node_modules/functionalscript/package.json').version"   # installed
node -p "require('./package-lock.json').packages['node_modules/functionalscript'].version"
```

`demo/serve.sh` performs exactly this comparison and refuses to start on a mismatch, which is the
cheapest place to catch it. Note also that the vendored-proof total differs between checkouts for
the same reason (2717 in one, 494 in another, both correct) — a second reason the project-local
`grep -c` count is the only comparable number.

### A worktree nested inside the checkout makes `tsc` typecheck the PARENT's dependency

Worse than drift, because it reports **zero errors** rather than sixteen. Worktrees live at
`<repo>/.claude/worktrees/agent-*/`, i.e. *inside* the parent checkout. TypeScript resolves a bare
specifier by walking every ancestor `node_modules` in a first pass that prefers TypeScript and
Declaration extensions. FunctionalScript 0.46.0 ships only `.d.mts`, so a legacy
`functionalscript/**.f.js` specifier finds no `.d.ts` in the worktree's own `node_modules`, keeps
walking up, and binds to `<repo>/node_modules/functionalscript` — a different, older version.

Measured 2026-08-18 during the 0.46.0 migration: `npx tsc --noEmit` in the worktree reported **0
errors** against 0.46.0-with-old-specifiers, a state whose true count is **1526**. `--traceResolution`
names the culprit in one line (`... was successfully resolved to <repo>/node_modules/... @0.43.1`).
Node's own runtime resolution is *not* affected — it takes the nearest `node_modules` — so only the
typecheck lies, and it lies green.

Measure from outside the parent checkout, which has no ancestor `node_modules` to find:

```sh
rsync -a --delete --exclude .git "$PWD/" /tmp/measure/

> **Do not add `--exclude .planning` here.** It was excluded until 2026-08-19, and it broke the
> suite it exists to measure: `planning-truth-gate.test.js` reads `.planning/REQUIREMENTS.md` and
> dies `ENOENT`, five failures, in a copy of a perfectly green tree. The exclusion predated that
> gate — the gate was added later by someone (me) who did not re-run this recipe afterwards. It is
> the third verification command this week that failed on a healthy tree, so: **after changing any
> check or any recipe, run it once against a tree you know is green.** A command that complains
> when nothing is wrong trains the next reader to ignore it.
( cd /tmp/measure && npx tsc --noEmit ) | grep -cE 'error TS'
```

Sanity-check any surprisingly clean `tsc` with
`npx tsc --noEmit --traceResolution | grep -c "$PWD/node_modules"` — a zero there means nothing
resolved to your own dependencies.

### The mutation that deletes the last use of a binding does not compile

By far the most common way a written-down mutation turns out to be unrunnable. `tsconfig` sets
`noUnusedLocals` and `noUnusedParameters`, so a mutation that removes an expression can orphan the
import or `const` that fed it, and `tsc` stops at `TS6133`/`TS6192` — the tests never run and you
have measured the compiler. It has happened repeatedly: replacing `halfUp(of(cents / 100n)(1n))`
with `(cents / 100n)` orphaned two imports; dropping a `&&` term from a condition orphaned its
destructured binding three separate times in one plan.

**When specifying a mutation, check what stops being referenced.** When executing one that fails
this way, do not abandon it and do not silently substitute — re-run the *semantically identical*
edit in a form that keeps the binding live, and record both the compile error and the real result:

```
(cents / 100n) * 100n          ->  halfUp(of(cents / 100n)(1n)) * 100n   // keeps `of`/`halfUp` used
delete the `spouseItemizes` term  ->  (spouseItemizes && false)          // keeps the binding used
```

**`&& false` does NOT work inside an `if` condition.** `tsconfig.json` sets
`allowUnreachableCode: false`, so `if (x && false) { ... }` makes the whole block unreachable and
`tsc` reports **TS7027** — no `ℹ tests` line, nothing runs, and the gate proves nothing while
looking performed. The recipe above is sound only where the value is *consumed* rather than
*branched on*. Inside a condition, keep the binding live with a comparison that is false for the
fixture but not statically dead:

```
if (printed !== undefined)        ->  if (printed !== undefined && printed.length > 1000)
if (cents !== 0n)                 ->  if (cents !== 0n && cents > 10n ** 12n)
```

Found on 2026-08-15 during Phase 20's verification, running this file's own recipe.

**Erasing a string interpolation is a mutation worth running, and almost nobody runs it.** The
same verification found `${destination}` -> `${destination.slice(0, 0)}` survived the entire
suite: five refusal proofs asserted the box name and the phrase "cannot compute", and not one
asserted *where the amount would have gone* — the only part of the message a reader can act on. If
a message is part of the contract, assert the part that carries the information, not the part that
is easy to assert.

### The equivalent mutant: a mutation a neighbouring operation absorbs

The second way a written-down mutation turns out not to bite. It compiles, it applies cleanly, it
changes the source — and it cannot turn red at **any** input, because an adjacent operation already
enforces what the mutated token enforced.

Found in QDCGT line 3, written as `s15 <= 0 || s16 <= 0 ? 0n : min(s15, s16)`. Weakening `<= 0n` to
`< 0n` is a no-op: the `min` two tokens later already returns `0` when either amount is `0`, so the
whole guard is just `max(min(s15, s16), 0n)` and the printed page's "blank or a loss" clause is
absorbed by an operation the plan never considered.

So when a mutation comes back green, **do not assume you mis-ran it.** Ask whether a neighbour makes
it unobservable — and if so, say so at the site, because you have discovered a property of the code
nobody had written down. Then re-run the same intent in a form that does bite (`(x <= 0n && false)`)
to confirm the leaf is load-bearing after all.

Three failure modes now, in the order they occur: the mutation does not compile (orphaned binding),
the mutation compiles but is absorbed (equivalent mutant), or the mutation bites but on a different
set of leaves than predicted.

### A mutation's predicted red set is itself a claim, and it is often wrong

Predictions have been wrong in both directions, and each error was informative rather than
cosmetic:

- `standardDeduction[status]` → `.single` was predicted to redden every non-single row (14) and
  reddened **11**. Married-filing-separately stayed green — because MFS genuinely shares single's
  `15,750` base. The failed prediction re-proved the trap the plan existed to guard.
- Deleting `min(line23, line24)` was predicted to redden three worked cases and reddens **two**;
  in the other three, line 23 is already the smaller, so the deletion is a no-op.

So **record the leaves that stayed green, with the arithmetic that made them green.** A mutation
turning everything red proves less than one turning exactly the predicted set red, and a surprise
in either direction usually means the code has a property nobody had written down.

### Concurrent work invalidates a mutation observation

`npm test` is `tsc && node --test`, and **`tsc` is repo-wide**. So when two agents work in the same
checkout, one agent's half-finished file fails the typecheck, `node --test` never runs, and the
other agent's `npm test` goes red for a reason that has nothing to do with the mutation it is
measuring. Observed: a wave-1 executor saw `TS6133: 'assertNotNullish' is declared but never read`
from a sibling's in-flight file while mutating a module it did not share a single line with.

**A red you did not cause confirms a mutation that never worked** — which is worse than a missed
failure, because it gets written down as evidence.

If you must measure while someone else is mid-edit, run the *gated command only* against a
snapshot, and keep the mutation edit and every `git diff --numstat` on the real tracked file:

```
tar --exclude=.git -cf - . | (mkdir -p /tmp/snap && tar -xf - -C /tmp/snap)
( cd /tmp/snap && npm test )
```

`--exclude=.git` matters. The `cp -a` recipe above shares the real repo's git directory, so a git
command run inside that copy writes to the real repo; a `tar` snapshot has no git directory at all
and cannot. Confirm the result in the real tree once the other agent commits.

## Verifying a claim before you record it

Three rules from the project-initialization session, each earned by a failure there. They were
written into a planning handoff that no longer sits on any branch, which is why they are here
instead: a rule nobody reads while editing code prevents nothing.

- **Chase a security finding to code execution — never stop at "the value returned looks
  harmless".** The `match` prototype hazard was first assessed as *moderate, not critical*,
  because only dispatch was tested. Chaining turned it into a working arbitrary-code escape:
  against a whitelist holding exactly one operation, dispatching `__defineGetter__` installs an
  attacker-controlled getter **on the whitelist object itself**, and reading that property runs
  arbitrary code — no `import()` anywhere. The guard comparison is worth memorising, since two of
  the three obvious checks are wrong: for `constructor`, `'in'` → `true`, `!== undefined` →
  `true`, `Object.hasOwn` → **`false`**. Only `Object.hasOwn` is correct. (Closed upstream in fjs
  0.41.0 by an `at`/`getOwnPropertyDescriptor` lookup — functionalscript#1419 — so no local guard
  is required today. `fjs/exec`'s `refusals.*` proofs pin it.)
- **Reproduce a subagent's finding before recording it.** Research agents return high-confidence
  claims, and several were load-bearing and wrong. Re-execute anything that will change a
  decision. This generalises the testing rule above: a report is not evidence, and neither is a
  green suite you did not watch fail.
- **Never assume the branch you were on is the branch you are on.** During project
  initialization, git HEAD moved **four times** from outside the session — twice mid-command-block
  — and `.planning/config.json` and `.planning/research/` vanished from disk between two
  consecutive tool calls. **The cause was never identified**, so this is a live hazard, not
  history. Check `git branch --show-current` at the start of a block, and run any multi-step git
  sequence (checkout → merge → verify → push) inside **one** invocation rather than chaining it
  across separate tool calls. The related trap: a bare `cd` persists across later commands in some
  harnesses — `cd ./functionalscript` silently redirects everything after it into the submodule.
  Use `git -C` and absolute paths, and put any `cd` inside a subshell.

## Commands

- `npm test` — `tsc` (typecheck) then `node --test *.test.js`. **The glob is the pin, not a detail:** bare `node --test` also discovers the vendored submodule's own entry point and runs every proof twice (see the warning above).
- `npm run test:proofs` — `tsc` then `node --test all.test.js`: the proof leaves alone.
- `npm run test:integration` — the real-process subset (`fjs-run-integration.test.js`), also included in `npm test`.
- `npm start` — runs the app via plain Node (`node index.js`).
- `npm run fjs-start` — runs the app via the `fjs` CLI directly (`fjs r ./fjs/index.f.js`).
