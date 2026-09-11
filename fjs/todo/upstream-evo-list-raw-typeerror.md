# `evo(cas)(key)` throws a raw `TypeError` when the memory slot was never allocated

**Priority:** P3 — a diagnostics gap, not a live fault here. Nothing in this repository can reach it.
**Status:** FIXED upstream (`functionalscript#1899`, merged 2026-09-08); not in a published release yet
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

## This note named the wrong module, and the PR says so

`evo` is where the crash surfaced, not where it lives. The hole is in the virtual interpreter's
`memRead` (`fjs/effects/node/virtual/module.f.mjs`), which reads the slot table by index and
answers `ok(undefined)` for a key that was never allocated — the plausible wrong value upstream's
own DESIGN.md §10 forbids. The `TypeError` then fired wherever that `undefined` was first
dereferenced, which in our reproduction was `cache.bySubject`; any other slot consumer would have
produced a different message from the same hole.

That also settles the shape question this note posed as a choice. It is not one: the **real Node
interpreter already panics** for this condition — `fjs/effects/node/memory/module.mjs` throws
`memory key not found: ${id}` from both `memRead` and `memWrite`. The virtual runner was the
outlier, so `functionalscript#1899` closes a divergence rather than setting policy. Shape 1
(widening `list`/`head` to `EvoChannel`) would have been wrong twice: a breaking API change
describing something that is not a runtime failure of `evo`, and dead against the real runner.

The correction was posted to the issue as well, so the record upstream is not left pointing at
the wrong file.

## Fixed upstream, and not yet in a release

`functionalscript#1899` was **merged on 2026-09-08**. The `ok(undefined)` for a never-allocated
slot is gone: the virtual interpreter now refuses, matching what the real Node interpreter
already did, and the mirror hole in `memWrite` closed with it.

**No published version carries it.** `0.49.0` shipped 2026-09-02, six days before the merge.
This note therefore stays until the version that contains the fix is installed here — at which
point it is deleted rather than annotated, per AGENTS.md's rule for a gap that upstream has
closed. Issue `#1893` remains open upstream; closing it is the maintainer's call, not ours.

## 0.49.0 was taken, and this note survived it — verified against the tarball

**Phase 43 installed `functionalscript@0.49.0` on 2026-09-10. It does not carry the fix**, and
that was checked rather than inferred from the dates:

```sh
grep -rn 'memory key not found' v49/
# only fjs/effects/node/memory/{module,proof}.mjs — the REAL runner, which already
# carried it at 0.48.0. The virtual runner's matching asserts are absent.
```

`functionalscript#1899` merged 2026-09-08, six days after 0.49.0 was cut on 2026-09-02, so no
published version carries it yet. **This note therefore stays**, under its own rule above: it is
deleted when the version that contains the fix is installed here, and 0.49.0 is not that
version.

**It was specifically at risk during this migration.** "Take the new version" is exactly the
task during which a stale-looking upstream note gets tidied away, and this one *looks* stale —
it says FIXED in its own status line. It is fixed **upstream**, on `main`, and not in anything
installable. `fixed` and `released` are different states, and only the second one retires a
note. Phase 43's roadmap entry, its requirement (MAINT-15) and the milestone's `STATE.md` all
name this note by path as something the phase must **not** delete, for that reason.

The next release after 0.49.0 is the first one worth re-reading this note against.
