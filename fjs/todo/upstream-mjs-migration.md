# Upstream: 0.44.0+ ships only `.f.mjs` + `.d.mts`, and relocates types out of the module files

Status: **blocking the dependency bump.** Recorded 2026-08-17 during Phase 18 (MAINT-06), whose
whole content was "take the current `functionalscript`". The current release cannot be taken
without a project-wide consumer migration, so the bump did not land and this repo stays on
`^0.43.1`. Per AGENTS.md, an fjs gap that changes what we can do here is written down rather than
left as a surprise for the next agent to re-discover.

Target: the published `functionalscript` npm package's file layout and its shipped type
declarations. **We are owners of fjs**, so the remedy below is a release decision, not a bug report
to a stranger.

## What is actually true, measured

Installed and green here: **0.43.1** (`package.json` `^0.43.1`, `package-lock.json` 0.43.1,
submodule gitlink `cc93a3ca` = the 0.43.1 release commit). Baseline on that version:
`npm test` **4273/4273**, exit 0, **2024** project-local proof leaves.

npm has moved two further minors:

| version | release commit | consumable here? |
|---|---|---|
| 0.43.1 | `cc93a3ca` | yes — this is what ships today |
| 0.44.0 | `37db36c0` | **no** — 1287 `tsc` errors |
| 0.45.0 | `8804e783` | **no** — 1288 `tsc` errors |

There are **no git tags** in the upstream repo; the release commits above are the `0.44.0 (#1513)`
and `0.45.0 (#1555)` commits on `main`, each verified by reading `package.json` at that SHA.

### Cause 1 — the `.js` emit is gone (mechanical, and not the hard part)

Upstream migrated its sources from `.f.js`/`.f.ts` to `.f.mjs` (`#1451`, `#1491`, `#1503`), and
then `#1520` — *"Ship declarations only: drop the JS emit pass from prepack"* — stopped emitting
the `.js` twins. So from 0.44.0 the package contains `fjs/**/module.f.mjs` and
`fjs/**/module.f.d.mts` and **no** `fjs/**/module.f.js`. Every specifier in this repo of the form
`'functionalscript/…/module.f.js'` becomes `TS2307 Cannot find module`.

Scope of the rename, measured on this tree: **396 files, 1900 specifier occurrences**, plus two
other shapes — `'functionalscript/fjs/effects/node/module.js'` (now `module.mjs`) and
`'functionalscript/fjs/emergent_testing/all.test.js'` (now `all.test.mjs`, and its absence is a
distinct `TS2882` on our `all.test.js`).

### Cause 2 — types moved to per-module `types.ts`, and this is the blocker

The rename alone is **not sufficient**. Applied to a throwaway `tar` snapshot (all 1900
occurrences rewritten to `.mjs`, verified zero `.js` specifiers left) and run against installed
0.45.0, `tsc` still reports **288 errors across 60 files**:

```
 95  TS2305  has no exported member
 90  TS2459  declares 'X' locally, but it is not exported
 50  TS7006  parameter implicitly has an 'any' type   (fallout of the above)
 34  TS2724  no exported member named …
  8  TS2345 / 8 TS2322 / 3 TS2694
```

The reason is visible in the shipped declaration: `fjs/media/json/module.f.d.mts` now begins

```ts
import type { _MapEntries, Unknown } from './types.ts';
```

— it **imports** the JSON value types and does not re-export them. At 0.43.1 the same names were
importable from `module.f.js`, which is what all ~90 of this repo's `@import` comments do. The
types affected are the core vocabulary of this project, not an obscure corner:

`Cache`, `Cas`, `Effect`, `FileCasOperation`, `Key`, `List`, `McpConfig`, `McpHandlers`,
`Operation`, `OperationMap`, `Result`, `Return`, `State`, `StringMap`, `Type`, `Unknown`.

**Unresolved, deliberately not guessed:** whether a consumer's `@import` should name `types.ts`,
`types.d.ts`, or something else, and whether every one of those types has a stable published
location at all. Recording the question is honest; asserting a remedy we have not compiled would
be the wrong-remedy defect that Phase 17 exists to remove.

## Why no workaround was applied here

1. It is not local. A workaround touching 396 files is a project-wide migration, and this repo's
   own sources are `.f.js` by AGENTS.md's first requirement — so adopting `.f.mjs` specifiers
   leaves the tree mixed, and "should our own sources migrate too?" is an owner decision.
2. Every mechanically available shortcut for cause 2 is forbidden here: `any`, an `as`-cast or a
   re-declared local type are exactly what the hard rules rule out.
3. Phase 18's defining constraint is that **not a single computed figure moves**. A 0.43.1 → 0.45.0
   jump plus a 60-file type-import rewrite in one commit is the opposite of the bisectable,
   isolated bump the phase's own ordering constraint demands.

## What the upstream fix looks like

Any one of these unblocks the bump, in descending order of preference:

1. **Re-export the types from the module files.** `module.f.d.mts` does `import type { Unknown }
   from './types.ts'` — adding `export type { Unknown }` beside it restores the consumer contract
   without undoing the `.mjs` migration, and costs one line per relocated type.
2. **Document the type-import surface** — state, per module, where a consumer names its types, so
   the migration becomes mechanical instead of exploratory.
3. **Keep shipping `.js`/`.d.ts` aliases** for one deprecation cycle, so the extension change and
   the type relocation are not one cliff.

Option 1 alone probably reduces this from a phase-sized migration to the 396-file `perl -pi`
one-liner that is already known to work:

```sh
perl -pi -e "s{(functionalscript/[A-Za-z0-9_/.\-]*?)\.js(?=['\"])}{\$1.mjs}g" <files>
```

## Retire this note when

`npm install functionalscript@latest` followed by that one-liner leaves `tsc` clean and
`npm test` green with **no fewer than 2024** project-local proof leaves. Then bump, alone, in its
own commit, and delete this file.
