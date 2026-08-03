# AGENTS.md

## Project

`finance` — a [FunctionalScript](https://github.com/functionalscript/functionalscript) (fjs) project.

## Requirements

- All source files live under [./.fjs/](./.fjs/) and are [FunctionalScript](https://github.com/functionalscript/functionalscript) files with an extension `.f.js`. Except these two files:
  - [./.fjs/index.js](./.fjs/index.js), used to start the app,
  - [./.fjs/all.test.js](./.fjs/all.test.js), used to initialize FunctionalScript Emergent Testing Framework.
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
- `all.test.js` registers every discovered `proof` with Node's test runner, so `node --test .fjs/all.test.js` (and thus `npm test`) picks them up automatically — no manual test registration needed.
- Add tests by adding/extending a `proof` export in the relevant `.f.js` file (see `node_modules/functionalscript/fjs/dev/proof.f.js` or `.../emergent_testing/example.f.js` for the pattern).
- `.fjs/` is a dot-directory, and both `tsc`'s default `include` and FunctionalScript's own proof-discovery walker (and Node's directory-as-module resolution) silently skip/misbehave on dot-directories. Two workarounds are already in place — don't remove them:
  - [tsconfig.json](./tsconfig.json) has an explicit `"include": [".fjs/**/*"]`.
  - [.fjs/all.test.js](./.fjs/all.test.js) `chdir`s into its own directory and clears `INIT_CWD` before importing FunctionalScript's registration, so proof-discovery starts from inside `.fjs/` instead of skipping it from the repo root.
  - Always run tests as `node --test .fjs/all.test.js` (an explicit file), never `node --test .fjs` (the directory) — Node resolves a bare directory argument to `.fjs/index.js` and silently runs the whole app as a single fake "test" instead of discovering real ones.

## Commands

- `npm test` — `tsc` (typecheck) then `node --test .fjs/all.test.js` (runs all FunctionalScript proofs).
- `npm start` — runs the app via plain Node (`node .fjs/index.js`).
- `npm run fjs-start` — runs the app via the `fjs` CLI directly (`fjs r ./.fjs/index.f.js`).
