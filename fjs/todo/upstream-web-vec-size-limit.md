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
`fjs/form1040/core/module.f.js` at **995159 bytes — 7.6x** the limit; `fjs/schedule/1`,
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
