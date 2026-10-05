# `fjs web` serves the showcase 26 times slower than `python3 -m http.server`

**Priority:** P2 — it blocks one adoption here; nothing shipped depends on it.
**Status:** open — measured 2026-10-02 against `functionalscript@0.53.0`
**Replaces:** `upstream-web-vec-size-limit.md`, deleted in the same change. That note's
subject — a `413` above one `Vec` — is genuinely closed, and the two are different defects.

## What a person sees

The showcase page takes **4.4 seconds** to load from `fjs web` and **0.17 seconds** from
`python3 -m http.server`. Pressing reload costs the full 4.4 seconds again, where python3
answers in 37 ms. The page is the same page, the files are the same files on the same disk.

## The two causes, in the order they matter

**1. Throughput.** Measured on 2026-10-02, Darwin 25.5.0, Node 23.11.0, same file, best of five:

| server | `fjs/form1040/core/module.f.js` (1,022,499 B) | `fjs/tax/params/module.f.js` (342,370 B) |
|---|---|---|
| `fjs web` 0.53.0 | 565 ms — **1.73 MB/s** | 201 ms — **1.62 MB/s** |
| `python3 -m http.server` | 1 ms | 1 ms |

The page imports about 3.2 MB of engine, which is where the 4.4 seconds comes from.

**It is not the staging directory.** `demo/serve.sh` stages three symlinks, so the obvious
suspicion is that the server is resolving them per request. It is not: `fjs web` pointed
straight at the repository root, no symlink anywhere in the path, answers the same file in
503 ms — **1.94 MB/s**.

**It is not the file read either, and this is the part worth carrying upstream.** Reading
those 1,022,499 bytes with `readFileSync` takes under a millisecond. Converting them into
`Vec` chunks of 131,072 bytes — eight of them — takes **195 ms**, and converting those chunks
back into bytes for the socket takes **322 ms**. That is 517 ms, which is the whole of the
565 ms the response takes:

```sh
# from the repository root, with 0.53.0 installed
node -e "
  const { readFileSync } = require('fs')
  Promise.all([
    import('functionalscript/fjs/types/uint8array/module.f.mjs'),
    import('functionalscript/fjs/types/bit_vec/module.f.mjs'),
  ]).then(([u8, bv]) => {
    const bytes = readFileSync('fjs/form1040/core/module.f.js')
    const n = Number(bv.maxLengthBytes)
    const slices = []
    for (let at = 0; at < bytes.length; at += n) {
      slices.push(new Uint8Array(bytes.subarray(at, Math.min(at + n, bytes.length))))
    }
    let t = Date.now(); const vecs = slices.map(u8.toVec); const to = Date.now() - t
    t = Date.now(); vecs.map(u8.fromVec); const from = Date.now() - t
    console.log(slices.length, 'chunks: bytes->Vec', to + 'ms, Vec->bytes', from + 'ms')
  })"
# 8 chunks: bytes->Vec 195ms, Vec->bytes 322ms
```

A `Vec` is a bigint carrying its length, so a 131,072-byte chunk is a million-bit integer and
**every byte crosses that boundary twice per response.** `functionalscript#1819` capped how
big one of those integers may be; `functionalscript#2298` lifted the cap by chunking. Neither
touched the cost per byte, and nothing in the streaming design asked it to — the design's
subject was the ceiling.

**2. No cache validator.** `fjs web` sends `content-type`, `content-length`,
`x-content-type-options` and `date`. No `Last-Modified`, no `ETag`, so a browser has nothing
to revalidate with and a reload re-downloads the whole engine. python3 sends `Last-Modified`
and answers `304`, which is why its reload is 37 ms against the same 3.2 MB.

**Validators alone would not unblock the adoption.** A cold load is still 4.4 seconds, and a
cold load is what a person gets the first time they open the page. The order above is the
order the fixes are worth in.

## Why it blocks MAINT-11

MAINT-11 adopts capabilities that *delete* code here, and `fjs web` would delete the last
invocation of anything outside `functionalscript` — `python3 -m http.server` in
`demo/serve.sh`. The swap was made on 2026-10-02 and reverted, for the second time and for a
different reason.

**The UI suite caught it, again.** 7 of 47 Playwright cases failed and the run took 4.0
minutes where python3 takes 17.4 seconds. Every one of the seven is a `page.reload()` that ran
past the suite's 30-second per-test budget; the suite runs four workers against one server, so
each load pays for the others. Worth recording that the *first* attempt, in milestone v6,
failed 44 of 46 — a page that never loaded at all. This time the page loads correctly and
slowly, which is the harder failure to notice: a smoke test that waits long enough passes.

`demo/serve.sh` keeps `python3 -m http.server`, with a comment naming this note and the exact
line it would become.

## What the upstream fix should look like

In preference order:

1. **A byte path that does not go through a bigint.** The runner already holds a
   `Uint8Array` from the descriptor and already hands a `Uint8Array` to `res.write`; the `Vec`
   in between is the only reason either conversion happens. A body whose cells carried the
   runner's own bytes would cost nothing per byte. This is a type question in
   `ServerResponse.body` — the same field `functionalscript#2298` just changed — so it is worth
   asking before that shape sets.
2. **`Last-Modified` from the `fstat` the response already performs**, and `If-Modified-Since`
   answered with `304`. The size for `content-length` comes from that same `fstat`, so the
   modification time is already in hand; this is the cheap half.
3. **Faster `toVec`/`fromVec`**, if the representation has to stay. 1.7 MB/s is slow enough
   that a static server reads as broken rather than as careful, and the module's own docstring
   makes no claim a reader could check against.

Either way the `fjs/web` docstring's response table should say what a consumer needs before
adopting the server. The old `413` row is gone, correctly — but nothing replaced it with the
speed, and the command's one-line description (`Serve a directory over HTTP`) does not hint at
it. The v6 lesson repeats exactly: what a consumer needs to read is the thing that makes the
adoption fail, and it is never in the signature.

## What is NOT wrong, verified rather than assumed

Each of these was a suspicion that measurement removed, and each would have been a plausible
report:

- **Correctness.** `fjs/form1040/core/module.f.js` arrives whole and byte-identical —
  1,022,499 bytes, `content-length` matching, `Buffer.compare` zero. That is
  `fjs-web-size-ceiling.test.js`, kept in the suite precisely so the deleted note's
  reproduction goes on running.
- **Keep-alive.** A pool of six kept-alive sockets reuses every one of them; 50 sequential
  requests over the pool take 122 ms.
- **Small-file cost.** 2.5 ms each, 50 of them in 124 ms sequentially and 97 ms six at a time.
  The per-request overhead is not the problem; the per-byte cost is.
- **Concurrency.** The four largest modules requested at once answer in 1,038 ms, all four
  `200` and all four complete.

## Where the ceiling note's history went

`upstream-web-vec-size-limit.md` is deleted, per the convention its own closing rule stated
and `upstream-evo-list-raw-typeerror.md` set: a note goes when its reproduction passes, not
when its issue is marked closed. The reproduction was run on every version between:

| version | the note's own request | |
|---|---|---|
| 0.50.0 | `413` — *file is 1022499 bytes; this server cannot answer with more than 131072* | |
| 0.51.0 | `413`, same text | |
| 0.52.0 | `200`, 1,022,499 bytes, byte-identical | ← the release that lifted it |
| 0.53.0 | `200`, 1,022,499 bytes, byte-identical | |

So `functionalscript#1819` closed in **0.52.0** (2026-09-28), not in the release this
repository took it in. What that note recorded is in
`.planning/reports/fjs-0.53.0-migration.md` and in the history of this file's predecessor.
