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

To sweep for untested code rather than guess at it: copy the repo (`cp -a . /tmp/sweep` — the
`node_modules` symlink is absolute, so it still resolves), then mutate values, comparisons and
returned shapes one at a time, reverting each. Every mutation that leaves the suite green is
uncovered code.

## Commands

- `npm test` — `tsc` (typecheck) then `node --test` (runs all FunctionalScript proofs via root `all.test.js`).
- `npm start` — runs the app via plain Node (`node index.js`).
- `npm run fjs-start` — runs the app via the `fjs` CLI directly (`fjs r ./fjs/index.f.js`).
