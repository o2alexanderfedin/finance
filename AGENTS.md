# AGENTS.md

## Project

`finance` — a [FunctionalScript](https://github.com/functionalscript/functionalscript) (fjs) project.

## File conventions

- All source files are FunctionalScript: extension `.f.js`, no side effects, ESM.
- Exceptions (impure, plain JS):
  - [index.js](./index.js) — starts the app via `run` from `functionalscript/fjs/effects/node/module.js`.
  - [all.test.js](./all.test.js) — bootstraps FunctionalScript's Emergent Testing into Node's `--test` runner via `register`.
- Types come from JSDoc comments, not `.ts` files. TypeScript (`tsc`) only validates types (`noEmit: true` in [tsconfig.json](./tsconfig.json)) — it never emits code.
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
- `all.test.js` registers every discovered `proof` with Node's test runner, so `node --test` (and thus `npm test`) picks them up automatically — no manual test registration needed.
- Add tests by adding/extending a `proof` export in the relevant `.f.js` file (see `node_modules/functionalscript/fjs/dev/proof.f.js` or `.../emergent_testing/example.f.js` for the pattern).

## Commands

- `npm test` — `tsc` (typecheck) then `node --test` (runs all FunctionalScript proofs).
- `npm start` — runs the app via plain Node (`node index.js`).
- `npm run fjs-start` — runs the app via the `fjs` CLI directly (`fjs r ./index.f.js`).
