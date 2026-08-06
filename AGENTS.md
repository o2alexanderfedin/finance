# AGENTS.md

## Project

`finance` — a [FunctionalScript](https://github.com/functionalscript/functionalscript) (fjs) project.

## Requirements

- All source files live under [./fjs/](./fjs/) and are [FunctionalScript](https://github.com/functionalscript/functionalscript) files with an extension `.f.js`. The only exceptions are root-level entry points that are plain (impure) JS by necessity — keep this set as small as possible, currently:
  - [./index.js](./index.js), used to start the app,
  - [./all.test.js](./all.test.js), used to initialize FunctionalScript Emergent Testing Framework.
- The files can be used as normal ESM files.
- JSDoc comments are used for strong typing.
- TypeScript is used to validate the typing without emitting.
- We use FunctionalScript to run tests.
- Use FunctionalScript itself as much as possible instead of writing new plain-JS/TS logic.
- **We are contributors and owners of FunctionalScript.** Treat it as an open-source part of this project, not a third-party dependency: we can update it and release a new version at any time — for example, if we need a new Node effect. This is why a missing generic capability is a reason to release a new fjs version, never a reason to add a third-party dependency or write app-specific glue here.
- If FunctionalScript is missing something generic (a reusable helper, not app-specific logic), add it into this repo as a separate file/directory, so it can be moved into FunctionalScript later.
- If you find a bug or a gap in FunctionalScript, tell the user so they can fix it and release a new FJS version. A local workaround is fine — it should not block progress — but it must never be *silent*: whenever you work around an FJS bug or gap, also write a todo file recording it, named `fjs/todo/upstream-<short-name>.md`. State what is missing or broken, the workaround in place here, and what the upstream fix should look like. These are the candidates to upstream and delete once a new FJS version ships (see [./todo/plan.md](./todo/plan.md) Week 5).
- **No third-party tools or libraries without approval from all owners.** Nothing may be added to `dependencies` or `devDependencies` until every repo owner has approved it. This is a hard stop, not a preference — propose it and wait. Do not add it, do not add it "temporarily", and do not vendor the code to sidestep the rule. What is already in [./package.json](./package.json) is the approved set, by definition; adding to it is the thing that needs approval.

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
- Import types with `@import { Name } from '...'` (a top-level JSDoc comment), not inline `@type {import('...').Name}`. Example:

  ```js
  /** @import { NodeProgram } from 'functionalscript/fjs/effects/node/module.f.js' */

  /** @type {NodeProgram} */
  export const main = () => /* ... */;
  ```

## Testing — FunctionalScript Emergent Testing

- Any `.f.js` module may export a `proof` object: a tree of zero-argument functions (nested via plain objects/arrays). A leaf passes if it doesn't throw; leaves nested under a `throw` key must throw to pass.
- `all.test.js` (root) registers every discovered `proof` with Node's test runner, so `node --test` (and thus `npm test`) picks it up automatically via Node's default `*.test.js` convention — no manual test registration or explicit path needed.
- Add tests by adding/extending a `proof` export in the relevant `.f.js` file (see `node_modules/functionalscript/fjs/dev/proof.f.js` or `.../emergent_testing/example.f.js` for the pattern).
- **Only run proofs through root discovery — `npm test`, or `node --test all.test.js`.** Emergent Testing registration happens when `all.test.js` is imported; it walks the project via `loadModuleMap` and registers every discovered `proof`. Any invocation that bypasses that reports a *fake pass*, not a failure, which is the dangerous direction:
  - `node --test fjs` — Node resolves the bare directory to `fjs/index.js` and runs the whole app as one fake "test".
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
- **No new dependency, including a devDependency, without every repo owner's approval.**
- **A missing generic capability is written here in this project, shaped so it could be lifted
  upstream unchanged** — no locale or domain assumptions baked into a generic module. See
  `fjs/types/decimal` (scale as a parameter, zero finance-specific content) versus
  `fjs/document/ocr_amount` (comma degrouping, a US printed-form convention, kept one layer out).

## A proof is not known to work until you have watched it fail

A green suite proves nothing on its own. **Break the code on purpose and confirm the suite goes
red.** If it stays green, the proof is decoration and the code is unproven.

This is not a style preference. This project has shipped the same defect three times — a proof whose
expected side was not independent of the code under test — and each time the suite was fully green:

| Phase | The defect | Suite when the shipped code was mutated |
|---|---|---|
| 7 | Every fixture was keyed at the same wrong path the buggy code asked for, so the proof mirrored the bug | 185 proofs, all green |
| 9 | The zero-read rule existed twice; every proof exercised the copy that did not ship | 258 green |
| 8 | `finance_tax_params` compared its output against the very object that produced it | 262 green |

Nothing was found by reading. All three were found by mutating.

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
- **Never gate a phase on `npm test`'s total.** It includes ~2,100 vendored submodule proofs and
  moves with submodule state. Use `node --test 2>&1 | grep -c '^✔ import("./fjs/'`. A Phase 7 gate
  of "total > 134" was already satisfied before that phase's first line was written.

**Sweep for untested code rather than guessing at it.** Copy the repo (`cp -a . /tmp/sweep` — the
`node_modules` symlink is absolute, so it still resolves), then mutate values, comparisons and
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
node --test 2>&1 | grep -o '^✔ import("\./fjs/[^ ]*' | sort -u   # run in each parent and in the result
comm -23 parent.txt result.txt      # must be empty, or every line individually explained

# 2. a name-set diff is NOT sufficient — a leaf can keep its name and lose its assertions
grep -cE '\bassert(Eq|NotNullish)?\(' <changed file>   # before vs after; a drop is a regression
```

Step 1 caught the dropped leaf; step 2 is what catches the case step 1 cannot see. Where a merge
deliberately replaces a proof with a stronger one, say so in a `MERGE NOTE` comment at the site, so
the next feedback pass does not revert it back.

**`npm test --prefix <dir>` does not run that directory's tests.** It sets the package location but
runs the script in the current working directory, so it will happily report a different tree green.
Use `( cd <dir> && npm test )` — in a subshell, because a bare `cd` persists across later commands.

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

- `npm test` — `tsc` (typecheck) then `node --test` (runs all FunctionalScript proofs via root `all.test.js`).
- `npm start` — runs the app via plain Node (`node index.js`).
- `npm run fjs-start` — runs the app via the `fjs` CLI directly (`fjs r ./fjs/index.f.js`).
