# `fjs web` cannot serve a file larger than one `Vec` (131072 bytes)

**Priority:** P2 — it blocks one adoption here; it does not affect anything shipped.
**Status:** open
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

**This is a candidate to take upstream directly**, under the standing authority recorded in
AGENTS.md. `functionalscript#1645` is the precedent for the shape of that request.
