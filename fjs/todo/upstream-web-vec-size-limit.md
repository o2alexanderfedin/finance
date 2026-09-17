# `fjs web` cannot serve a file larger than one `Vec` (131072 bytes)

**Priority:** P2 — it blocks one adoption here; it does not affect anything shipped.
**Status:** open — design MERGED upstream (`functionalscript#1900`, 2026-09-10); the ceiling stands until an implementation lands
**Found:** 2026-08-31, executing MAINT-11 (Phase 41, milestone v6), against `functionalscript@0.48.0`

## What is true today

`fjs web [root] [port]` answers **413** for any file whose size exceeds one `Vec`:

```
fjs/web/module.f.mjs:461
    return BigInt(size) > maxLengthBytes ? pureError(tooLarge(size)) : readFile(path)
```

`maxLengthBytes` is imported from `fjs/types/bit_vec` and is **131072** (128 KiB). The response
body says so plainly, which is how this was diagnosed in about a minute:

```
$ curl -s http://localhost:8140/fjs/form1040/core/module.f.js
file is 995159 bytes; this server cannot answer with more than 131072
```

## Why it blocks MAINT-11

MAINT-11 adopts capabilities that *delete* code here, and `fjs web` would have deleted the last
invocation of anything outside `functionalscript` — `python3 -m http.server` in `demo/serve.sh`.

**Eleven files the demo loads are over the ceiling.** The largest is
`fjs/form1040/core/module.f.js`, the largest — **995159 bytes, 7.6x the limit, measured 2026-08-31**, and past 1022000 bytes by 2026-09-14, so this multiple is a dated observation and not a current fact (derive it with the recipe at the end of this note); `fjs/schedule/1`,
`fjs/return/scope` and `fjs/tax/params` are each over 340 KB. These are not assets that could be
trimmed: they are the engine the page imports, and the demo runs the same modules the proofs do.

The swap was made and reverted. **The UI suite caught it** — 44 of 46 Playwright tests failed with
an empty `#dialect` and an empty `#step`, because the modules never arrived. Worth noting that the
page itself did not obviously break: `entry.html`, `entry.js` and every small module returned 200,
so a smoke test that only loaded the page would have passed.

## The workaround in place here

`demo/serve.sh` keeps `python3 -m http.server`, with a comment naming this note and the exact line
it would become. Nothing else in the repository is affected — this is a development-time static
server for the demo, not part of the engine or the MCP surface.

## What the upstream fix should look like

`respond` reads the file into a single `Vec` and frames the whole body at once. A file larger than
a `Vec` is not a client error, so **413 is arguably the wrong answer** for it in the first place —
413 says the *request* was too large.

Two shapes, in preference order:

1. **Stream the body.** Read in `Vec`-sized chunks and write them as they arrive, which also drops
   peak memory from "the whole file" to "one chunk". This is the fix that makes the ceiling go away
   rather than raising it.
2. **Raise the ceiling explicitly**, with the maximum a served-file size rather than a `Vec` size,
   and say so in the module docstring's response table.

Either way the docstring's table row — *"a file larger than one `Vec` → 413"* — is the thing a
consumer needs to read *before* adopting the server, and it is currently accurate but easy to pass
over: 128 KiB is a low ceiling for a static server, and nothing in the command's one-line
description (`Serve a directory over HTTP`) hints at it.

**Taken upstream** under the standing authority recorded in AGENTS.md, as
[`functionalscript#1819`](https://github.com/functionalscript/functionalscript/issues/1819)
— every fact above re-verified against `0.48.0` before filing: line 461 reads as quoted,
`maxLengthBytes` resolves to `131072n`, and eleven of the demo's modules are over it.
`functionalscript#1645` was the precedent for the shape of the request.

When it is answered, the swap this note blocks is one line in `demo/serve.sh`, and the
comment there already names the line it becomes.

## The design PR, and what it changed about this note

`functionalscript#1900` fills upstream's own `fjs/effects/node/todo/streaming-http-bodies.md`
— which **already existed**, at P3, with `fjs/web`'s 413 already listed among its tasks. So this
gap was known upstream before we filed it; what #1819 added was a consumer who is blocked by it.

The PR is design-only, deliberately. Streaming is not a `fjs/web` change: `ServerResponse.body`
is a bare `Vec` and `answerRequest` ends with `res.end(fromVec(outBody))`, so the fix is a
breaking public type change threaded through `RequestListener`, both runners and their proofs.
Their own ladder — an underspecified todo, then details, then an implementation — is what the PR
climbs one rung of.

One rule in it was settled by measurement rather than argument: with a declared
`Content-Length`, a producer that fails mid-body yields a truncated response Node reports as an
error; under `Transfer-Encoding: chunked` the same failure arrives as a **clean, complete**
response with `res.complete === true`. A truncated file indistinguishable from a whole one is
DESIGN §10's plausible wrong value, so the design specifies `destroy`, not `end`.

**The ceiling still stands** until an implementation lands, so `demo/serve.sh` stays on
`python3 -m http.server` and MAINT-11's `fjs web` half stays blocked.

## The design landed; the ceiling did not move

`functionalscript#1900` was **merged on 2026-09-10**. What merged is the design in
upstream's own `fjs/effects/node/todo/streaming-http-bodies.md`, not an implementation — so
`fjs web` still answers 413 above 131072 bytes, `demo/serve.sh` stays on `python3 -m
http.server`, and MAINT-11's `fjs web` half stays blocked. Issue `#1819` is still open, which
is correct: it closes when a consumer can serve a large file, not when a document describes how.

**It is not in a release either.** `0.49.0` shipped 2026-09-02, before the merge, so no
published version carries this. The next version after that is the first one worth re-reading
this note against.

## 0.49.0 was taken, and this note survived it — verified, not assumed

**Phase 43 installed `functionalscript@0.49.0` on 2026-09-10 and the ceiling did not move.**
`fjs/web/module.f.mjs` is **byte-identical** between the 0.48.0 and 0.49.0 tarballs:

```sh
diff -q v48/fjs/web/module.f.mjs v49/fjs/web/module.f.mjs   # no output
```

So the `413` above one `Vec` still stands, `demo/serve.sh` still runs `python3 -m
http.server`, **MAINT-11 stays PARTIAL**, and `#1819` is still open.

This paragraph exists because the sentence above it — *"the next version after that is the
first one worth re-reading this note against"* — was a promise, and a promise nobody records
keeping is indistinguishable from one nobody kept. 0.49.0 was that version; the note was
re-read; the answer was no. The **next** release is now the one worth re-reading it against.


## The figures here are dated, and one of them has already drifted

**The count has held and the magnitude has not.** Eleven modules exceeded the ceiling on
2026-08-31 and eleven exceed it today — but `fjs/form1040/core/module.f.js` has grown from
995,159 bytes to over 1,022,000, so `7.6x` is now `7.8x`. That is the ordinary direction of
travel: the engine only gets bigger, so the gap this note describes only widens.

**Derive rather than quote**, over the demo's own import closure:

```sh
node -e "import('functionalscript/fjs/types/bit_vec/module.f.mjs').then(m=>{
  const c=Number(m.maxLengthBytes); const fs=require('fs'),p=require('path')
  const walk=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(p.join(d,e.name)):[p.join(d,e.name)])
  walk('fjs').filter(f=>f.endsWith('.f.js')).map(f=>[fs.statSync(f).size,f])
    .filter(([s])=>s>c).sort((a,b)=>b[0]-a[0])
    .forEach(([s,f])=>console.log((s/c).toFixed(1)+'x', s, f))})"
```

That walks `fjs/**.f.js` rather than the exact closure, so it reports **twelve** — the extra is
`fjs/server/fjs_run/module.f.js`, which the browser never imports. The eleven the demo actually
loads are the rest.


## What this actually waits on — the chain, re-checked on upstream `main` 2026-09-16

**This note is not waiting on `fjs/web`.** Read against `functionalscript` `main` at `a735da3`,
the dependency path is three deep and every link is a design rather than an implementation:

```
functionalscript#1819  (fjs web answers 413 above one Vec)
  └── fjs/effects/node/todo/streaming-http-bodies.md          open   ← our #1900 landed here
        └── fjs/web/todo/stat-then-read.md                    open
              └── the file-handle effect it specifies          does not exist
```

Both intermediate designs state the edge in their own words, so this is a summary and not our
inference:

- **streaming-http-bodies**: *"the response side is buildable from what is in the tree today,
  except for the one part of it that serves a **named** file: reading a body in chunks resolves
  that name once per chunk, which is a race the current whole-file read does not have, so
  `fjs/web` waits on the handle effect **stat-then-read** designs."*
- **stat-then-read**: *"**It blocks streaming-http-bodies** … a replaced entry can be spliced
  into a response that is clean, correctly sized, and **made of two files**. The handle effect
  below is what binds every chunk of one response to one inode."*

**Why that matters for what we do here: there is nothing to implement.** The response side needs
a type change (`ServerResponse` gains an `O` parameter and a `release` field), a new file-handle
effect, a pump in each of the two runners, the chunk loop moved out of `fjs/cas`, and a settled
answer on destroying the socket rather than ending the response when a body fails after the
headers are out. Arriving with a fork built on a foundation that is still being designed would
hand the maintainer a branch he would rewrite. `functionalscript#1649` is the shape that worked
instead: the open question was handed back as a spec obligation, and he merged it in that form.

**Our contribution already did its work.** The design cites this repository's incident as the
justification for the priority, near enough verbatim: *"The cap is low enough to have cost an
adoption… Every small file answered `200`, so loading the page as a smoke test passed; what
caught it was a UI suite, where 44 of 46 cases failed on empty elements."* That is MAINT-13's
whole point — a gap taken upstream becomes a specification instead of a local workaround.

**The trigger is the next `functionalscript` release, and `AGENTS.md`'s re-read rule is what
fires on it.** At that point the check is two greps: does a handle effect exist, and does
`ServerResponse.body` take a `List`. If both, MAINT-11 closes with the one line already written
in `demo/serve.sh`'s comment.

Posted as a comment on `#1819` the same day, so the chain is visible in the issue rather than
only in these files.


## 2026-09-16: `readWhole` landed upstream, and it changes the answer above

**The section immediately above says there is nothing to implement. That is no longer true**,
and the reason is an operation that did not exist when it was written.

`ReadWhole` was added to `main` on **2026-09-14** (`11e3533f`) — two days after that section was
written, and **it is not in the published 0.49.0 we run** (`grep readWhole` over the installed
package returns 0):

```ts
// fjs/effects/node/types.ts:243, and in the Fs union at :247, so in NodeOp
export type ReadWhole = readonly['readWhole', (path: string) => IoResult<readonly Vec[]>]
```

It answers **a list of `Vec`s** — each chunk within the cap, the list itself uncapped — from
**one `open`**. It is implemented in **both** runners (`effects/node/module.mjs` walks the
descriptor's own cursor 128 KiB at a time; `effects/node/virtual/module.f.mjs` mirrors it down to
the shared `ERR_NOT_A_FILE` code), and it is already consumed by **seven** `fjs/git` modules, so
it is a proven primitive rather than a fresh sketch.

**It dissolves the blocker this note recorded.** `stat-then-read.md` blocks the streaming design
because a chunk loop over a *name* re-resolves that name per chunk, so a replaced file can be
spliced into one response. `readWhole`'s own docstring answers exactly that:

> *"The chunks are one open's, which is why this is not a fold over `readBytes`. That operation
> resolves the path per call, so reading a file in windows can straddle two files."*

and `fjs/git/store/module.f.mjs:41` states the property plainly: *"`readWhole` opens the path
once and reads it to the end, so the chunks it answers are one file's."* The race is solved by an
**operation**, not by the file-handle effect the design assumed was the only route.

**The streaming design does not know this.** `streaming-http-bodies.md` has **zero** mentions of
`readWhole`. Per upstream's own DESIGN §3 — *"When a discrepancy is found between an issue's
design and reality … correct the design document and surface the problem rather than silently
working around it"* — correcting that document is the first contribution to make, and §3 also
prefers the design change and its implementation to be **separate pull requests**.

**What still genuinely blocks a large response**, and it is now one thing rather than a chain:

```ts
// fjs/effects/node/types.ts:265 — the body is ONE Vec
export type ServerResponse = {
    readonly status: number
    readonly headers: Headers
    readonly body: Vec
}
```

So `readWhole` can *read* a 1 MB file today and `ServerResponse` still cannot *carry* it. That is
a type change with a narrow blast radius — **29 references across 8 files**, and `fjs/web` is the
only consumer outside the effects layer.

**Also worth flagging: `fjs/web`'s current guard contradicts DESIGN §6.**
`readBounded` (`fjs/web/module.f.mjs:461`) does
`BigInt(size) > maxLengthBytes ? pureError(tooLarge(size)) : readFile(path)` — a precomputed size
predicting whether something fits, which §6 forbids by name: *"Never precompute or estimate an
encoding/decoding size to predict whether it will fit a limit. Attempt the real decode/encode and
branch on its result instead."* `readWhole` is what makes obeying it possible.

**And the cap itself is correct and must stay**, which is worth recording because the obvious
"fix" is to raise it. `maxLength = 0x100000n` (`fjs/types/bigint/module.f.mjs:203`) is not a Node
limit — measured, Node handles `1n << (maxLength * 16n)` without complaint. The comments at `:196`
and `:205` say why the number is what it is: **Bun** throws. The weakest runtime sets the cap, so
chunking is the only honest route.


## 2026-09-17: the chunk loop left `fjs/cas`, which ticks the first box of that chain

**One reusable chunk reader now exists upstream where two hand-written loops used to sit.**
`readChunks` (`fjs/effects/node/module.f.mjs:408`) reads a file through a chunk source the caller
supplies, optionally bounded by a byte count, advancing by what each read actually returned rather
than by `chunkBytes`. Both `fjs/cas` loops — `read` and `streamFile` — call it and the
hand-written ones are gone. Merged 2026-09-17 as
[`functionalscript#2079`](https://github.com/functionalscript/functionalscript/pull/2079)
(`8e241993`).

It also settles the question `fjs/cas/todo/66o-read-streamfile-dedup.md` had left open for `tsc`:
**no cast is needed**, because the `List<ReadBytes, …>` a source produces widens into `read`'s
pinned `List<FileCasOperation, …>` by ordinary `Effect` widening. That note is deleted upstream
and its issue is retired.

**The ceiling has not moved.** `ServerResponse.body` is still one `Vec`
(`fjs/effects/node/types.ts:305`), `readBounded` still answers 413 above `maxLengthBytes`
(`fjs/web/module.f.mjs:461`), `demo/serve.sh` still runs `python3 -m http.server`, and
**MAINT-11's `fjs web` half stays PARTIAL**. Five tasks remain on the streaming design; three are
Stage 1, and one of those is still blocked on the file-handle effect `stat-then-read` specifies.

**And none of it is installable.** `0.49.0` is what runs here, and it shipped 2026-09-02 — two
weeks before this merge. The trigger for re-reading this note is unchanged: the next release, per
AGENTS.md, checked with the same two greps — does a handle effect exist, and does
`ServerResponse.body` take a `List`.
