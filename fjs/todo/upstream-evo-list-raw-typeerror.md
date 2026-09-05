# `evo(cas)(key)` throws a raw `TypeError` when the memory slot was never allocated

**Priority:** P3 — a diagnostics gap, not a live fault here. Nothing in this repository can reach it.
**Status:** open — filed upstream as `functionalscript#1893` on 2026-09-05
**Found:** 2026-09-05, sweeping error-rendering sites after MAINT-11, against `functionalscript@0.48.0`

## What is true today

Handing `evo` a cache key whose `memory` slot was never allocated does not produce a
channel error. It throws:

```
TypeError: Cannot read properties of undefined (reading 'bySubject')
```

Minimal reproduction, no filesystem:

```js
import { virtual, emptyState } from 'functionalscript/fjs/effects/node/virtual/module.f.mjs'
import { evo } from 'functionalscript/fjs/cas/evo/module.f.mjs'
import { fileCas } from 'functionalscript/fjs/cas/module.f.mjs'
import { sha256 } from 'functionalscript/fjs/crypto/sha2/module.f.mjs'

const cas = fileCas(sha256)('/home')
virtual({ ...emptyState, memory: [] })(evo(cas)(0).list('false'))
// TypeError: Cannot read properties of undefined (reading 'bySubject')
```

`0` is a well-formed key shape; what is missing is the `initEvo` that would have allocated
the slot behind it.

## Why this repository does not need a workaround

`financeMcpServer` (`fjs/server/module.f.js:281`) is the only production construction path, and
it allocates first:

```js
export const financeMcpServer = home => step(
    initEvo(fileCas(sha256)(home)),
    cacheKey => step(create(uninitializedState), sessionKey => ...))
```

Every `evo(cas)(cacheKey)` downstream receives that key. **No workaround is in place because
none is needed** — this note exists so the gap is not silent, per AGENTS.md, not because
anything here is broken.

## The ask, framed as a choice rather than a demand

Whether a never-allocated slot is *programmer error* or a *runtime condition* is upstream's
call, and both answers are defensible. What is hard to defend either way is the current
message: `Cannot read properties of undefined (reading 'bySubject')` is V8's sentence, not
anyone's design. It names an internal field of the cache record and gives a caller nothing to
act on — no mention of `evo`, of the key, or of `initEvo`.

Two shapes, either of which would close it:

1. **Return `evoError`.** Treat it as a runtime condition: `evoError('evo cache slot <key> was
   never allocated; call initEvo first')`. This costs a branch on every operation, and it widens
   `list`/`head` from `NotImplemented` to the full `EvoChannel` — worth weighing, since that
   distinction is currently load-bearing for consumers (it is what tells a caller that only a
   dispatch failure can come out of `list`).
2. **Panic by name.** Keep it programmer error, but throw the project's own sentence rather
   than V8's. No type changes, no per-operation cost, and the message becomes actionable.

Shape 2 looks like the better trade to me — it preserves the `NotImplemented`-only typing of
`list`/`head`, which is more useful than catching a mistake that a correctly-ordered program
cannot make. But that is a judgement about upstream's intent, so it is stated as a preference
and not as the request.

## Related

Found while verifying two *reported* rendering defects that turned out not to be defects: an
`EvoError` cannot reach any renderer in this repository, because `list` and `head` are typed
`NotImplemented`-only and the one production `revision` call absorbs its failure into a skipped
entry. Recorded at `fjs/server/finance_documents_list/module.f.js`'s fixture docstring so the
next reader does not re-file it. The one real defect in that sweep was local and is fixed:
`loadProgram` rendered with `String(e)`.

## Filed

Taken upstream under the standing authority in AGENTS.md §7, as
[`functionalscript#1893`](https://github.com/functionalscript/functionalscript/issues/1893),
with the reproduction above and both fix shapes offered. `functionalscript#1819` (the `fjs web`
size ceiling) is the sibling filed one milestone earlier.
