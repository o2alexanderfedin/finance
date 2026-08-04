# AGENTS.md

## Project

`finance` — a [FunctionalScript](https://github.com/functionalscript/functionalscript) (fjs) project.

## Requirements

- All source files live under [./fjs/](./fjs/) and are [FunctionalScript](https://github.com/functionalscript/functionalscript) files with an extension `.f.js`. The only exceptions are root-level entry points that are plain (impure) JS by necessity — keep this set as small as possible, currently:
  - [./index.js](./index.js), used to start the app,
  - [./all.test.js](./all.test.js), used to initialize FunctionalScript Emergent Testing Framework.

  [./fjs/todo/implement-mcp-server.md](./fjs/todo/implement-mcp-server.md) plans one more: the impure entry point that `claude mcp add` launches. Anything beyond a launcher belongs in a `.f.js` module that the launcher calls.
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

Adhere **religiously** to **SOLID**, **KISS**, **DRY**, **YAGNI**, **TRIZ**, **TDD**, and
**Code-by-Intent**. Use **rival agents**. Facilitate **Emergent Design sessions**.

These are not aspirations to cite after the fact — they are how work is done here.

- **SOLID** — one reason to change per module; depend on the narrow interface you need,
  never the wide one you were handed. In a language where effects are data, this mostly
  shows up as: take the operation set you actually use as a parameter, the way `Cas<O>` is
  generic in `O` rather than hardwiring the filesystem.
- **KISS** — the simplest thing that could possibly work, then stop. Complexity must be
  argued for in a `todo/` file, not introduced quietly in a commit.
- **DRY** — one fact, one home. Everything else links to it. A second copy is a future
  contradiction: state, file layout, commands, conventions, dependency lists all live in
  exactly one document and are referenced from the rest.
- **YAGNI** — build what a settled requirement demands. Speculative generality is a defect,
  not foresight. Where a decision is genuinely open, record it as an open question in
  [./todo/plan.md](./todo/plan.md) rather than building for every branch of it.
- **TRIZ** — resolve the contradiction instead of trading off against it, and prefer the
  *ideal final result*: the best module is the one that does not need to exist. That is
  already this repo's strongest habit — the answer to a missing capability is upstream fjs,
  not new code here. When two goals appear to conflict, look for the reframing that
  dissolves the conflict before you split the difference.
- **TDD** — write the failing `proof` first, make it pass, then refactor. Never the reverse.
  A `proof` written after the implementation tests what you built, not what was required.
- **Code-by-Intent** — code states *what* it means, never *how* the machine achieves it.
  Name for the domain (`qualifiedDividends`, not `calc2`), and if a reader must trace the
  body to learn the intent, rename or decompose until they don't.
- **Rival agents** — for any consequential design, run independent agents *against* each
  other: one proposes, another tries to refute, a third reviews without seeing the first
  two. Adversarial review, not confirmation. This applies hardest to security boundaries
  and tax correctness, where a plausible-and-wrong answer is the failure mode and a single
  agent agreeing with itself proves nothing.
- **Emergent Design sessions** — let the design fall out of the constraints and the tests
  rather than being drawn up front. Facilitate them deliberately: state the forces, try the
  smallest thing, let the shape appear, and record what emerged in a `todo/` file so the
  next session inherits the reasoning rather than the conclusion alone. Big design up front
  is how YAGNI violations get institutionalized.

## File conventions

- `tsconfig.json` is configured maximally strict (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noUnusedLocals/Parameters`, etc.). Keep new code passing under it; don't relax flags to silence errors.
- The entry point's pure logic lives in `index.f.js` and exports a `main` typed as `NodeProgram`.
- Specifications, issues, bug reports, and feature requests are MarkDown files in a `todo/` directory next to the code they concern — e.g. [./fjs/todo/implement-mcp-server.md](./fjs/todo/implement-mcp-server.md). Project-level planning lives in [./todo/plan.md](./todo/plan.md). Write the spec there before implementing; don't open a tracker.
- New file formats follow the [Revision](https://github.com/functionalscript/functionalscript/blob/main/fjs/media/revision/README.md) precedent: JSON plus a dialect tag. Name the dialect `vnd.fjs.<name>`, which yields the media type `application/vnd.fjs.<name>+json`.
- **Never use floating point for money, percentages, or interest rates.** No JS `number` for an exact quantity — anywhere, at any stage: parsed documents, tax-year parameters, intermediates, reports. In a JSON document these are **strings**, because a JSON number is an IEEE 754 double by the time it is parsed; type the field as rtti `string` and decode it in the semantic check, the way `vnd.fjs.revision` types a hash as `string` and enforces the rest in `isHash`. Use the repo's exact-decimal module (bigint-backed) for arithmetic, and round only where a form explicitly requires it.

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
- If a `.f.js` source file ever needs to run as a standalone test file rather than a root-discovered directory, target it by explicit file path — Node resolves a bare directory argument (e.g. `node --test fjs`) to `fjs/index.js` and silently runs the whole app as a single fake "test" instead of discovering real ones.

## Commands

- `npm test` — `tsc` (typecheck) then `node --test` (runs all FunctionalScript proofs via root `all.test.js`).
- `npm start` — runs the app via plain Node (`node index.js`).
- `npm run fjs-start` — runs the app via the `fjs` CLI directly (`fjs r ./fjs/index.f.js`).
