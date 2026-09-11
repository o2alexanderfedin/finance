# `fjs/cas/evo` does not export the `generation` rule, so a second host must transcribe it

**Priority:** P2 — it has already cost one real defect here, in `demo/lib/store.js`.
**Status:** open, found 2026-09-10 against `functionalscript@0.49.0`
**Found:** while asking where this repository could use effects to improve; the answer for the
browser store turned out to be "it should have been running upstream's code, and could not."

## What is true today

`fjs/cas/evo/module.f.mjs:420` holds the authoritative rule:

```js
const computeGeneration = parents =>
    parents.length === 0 ? 0 : 1 + parents.reduce((max, p) => Math.max(max, p.generation), 0)
```

Its own docstring calls it *"The authoritative `generation` of a new revision"* and says it is
*"Computed here from the already-decoded parents, **never taken from input**."*

**It is `const`, not `export const`.** The module's export surface is `evoError`, `evoSummary`,
`emptyCache`, `decodeRevisionVec`, `decodeRevisionBlob`, `buildCache`, `initEvo`,
`syncRevision`, `addRevision`, `readRevision`, `evo` — and nothing that answers "what generation
should this revision carry?"

So a host that assembles a `Revision` without going through `addRevision` has **no way to ask**,
and its only options are to transcribe the rule or to get it wrong.

## What it cost here

`demo/lib/store.js` is the browser's CAS+Evo over IndexedDB. It wrote:

```js
generation: previous.length,
```

which agrees with the rule for a root (`0` parents → `0`) and for a first amendment (one parent
at generation 0 → `1`), and then **stops agreeing**: a second amendment has one parent at
generation 1, so the rule gives `2` and the count gave `1`. Every amendment after the first
wrote `1`.

**Nothing rejected it.** `fjs/media/revision`'s `validateShape` is documented as checking *"the
shape, not the hash / generation semantics"* and `checkReferences` requires only a non-negative
safe integer. Worse, upstream's own evo docstring says a deviation from the formula is *"a
readable epoch-reset signal rather than an invalid blob"* — so a wrong generation is not
rejected, it **means something else**. The browser was writing unintended epoch markers.

Fixed locally on 2026-09-10 by transcribing the rule into `nextGeneration` in that file, with a
docstring pointing here. **The transcription is the workaround, not the fix.**

## Why `addRevision` is not simply the answer

`addRevision` *does* compute it correctly, and it is generic over its host — `@template
{Operation} O`, `Cas<O>`. Running it from the browser is the right long-term shape and is
recorded as such in `.planning/reports/effects-opportunity-analysis.md`. But it is a larger
change than a wrong stored value should wait behind: it needs an `IndexedDbOp` operation set, a
`Cas<IndexedDbOp>`, an evo cache key, and the whole store rewritten onto `asyncRun`. A host that
has not made that investment yet still has to write a correct `generation` today.

That is the gap: **the rule is useful to more callers than the one function that uses it.**

## The ask

Export it. One word:

```diff
-const computeGeneration = parents =>
+export const computeGeneration = parents =>
```

It is a pure function of already-decoded parents, it adds no surface area beyond a name, and its
docstring already reads as public API — it defines the semantics rather than describing an
implementation detail.

**A smaller alternative that would also close it:** export the whole of `buildRevision`, which
is already documented as *"The pure half of `addRevision`… Separate from `addRevision` because
none of it touches the store."* A second host wants exactly that half. `computeGeneration` alone
is the minimal version and the one this note asks for.

## Related, and worth reading together

`fjs/cas/evo/module.f.mjs:411` cites `fjs/media/revision/README.md` for the `generation`
semantics. **That README is not in the published package.** `npm pack` ships `fjs/`, `todo/`,
`README.md`, `LICENSE` and `package.json`, and `fjs/media/revision/` contains only `.mjs` and
`.d.ts`. A consumer following the citation to understand the rule it cannot call finds nothing —
the same shape as the missing-CHANGELOG observation in
[`.planning/reports/fjs-0.49.0-migration.md`](../../.planning/reports/fjs-0.49.0-migration.md)
§8.2.

## Filed

Taken upstream on 2026-09-10 under the standing authority in AGENTS.md §7, as
[`functionalscript#1984`](https://github.com/functionalscript/functionalscript/issues/1984),
carrying the reproduction, the one-word ask, the `buildRevision` alternative, and the
not-in-the-package README observation.
