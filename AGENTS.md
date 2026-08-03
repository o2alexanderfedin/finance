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
- If FunctionalScript is missing something generic (a reusable helper, not app-specific logic), add it into this repo as a separate file/directory, so it can be moved into FunctionalScript later.
- If you find a bug in FunctionalScript, tell the user so they can fix it and release a new FJS version — don't just work around it silently in this repo.

## File conventions

- `tsconfig.json` is configured maximally strict (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noUnusedLocals/Parameters`, etc.). Keep new code passing under it; don't relax flags to silence errors.
- The entry point's pure logic lives in `index.f.js` and exports a `main` typed as `NodeProgram`.
- Specifications, issues, bug reports, and feature requests are MarkDown files in a `todo/` directory next to the code they concern — e.g. [./fjs/todo/implement-mcp-server.md](./fjs/todo/implement-mcp-server.md). Project-level planning lives in [./todo/plan.md](./todo/plan.md). Write the spec there before implementing; don't open a tracker.
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
- If a `.f.js` source file ever needs to run as a standalone test file rather than a root-discovered directory, target it by explicit file path — Node resolves a bare directory argument (e.g. `node --test fjs`) to `fjs/index.js` and silently runs the whole app as a single fake "test" instead of discovering real ones.

## Commands

- `npm test` — `tsc` (typecheck) then `node --test` (runs all FunctionalScript proofs via root `all.test.js`).
- `npm start` — runs the app via plain Node (`node index.js`).
- `npm run fjs-start` — runs the app via the `fjs` CLI directly (`fjs r ./fjs/index.f.js`).
