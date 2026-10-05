# Taking `functionalscript` 0.53.0

**Executed:** 2026-10-02 · **From:** 0.50.0 · **Phase:** none — outside the ledger · **Requirements:** MAINT-11 (attempted)
**PR:** [#177](https://github.com/fjs-dev/finance/pull/177)

---

## 1. What changed, in one line

A static server that could not send a file bigger than 128 KiB now can, and is still too slow
to serve this project's demo.

Three releases, 355 changed files, and **not one proof reddened**. The whole consumer-visible
surface of the bump is a docstring. The interesting half of this report is not the bump.

## 2. The bump, measured

| check | result |
|---|---|
| `package.json` names the version explicitly | `^0.53.0`, 0.53.0 installed, 0.53.0 in the lockfile |
| `tsc` | **0** — and **0** again from outside the parent checkout |
| `toJsonSchema` over all 30 served dialect schemas | **byte-identical**, sha `6062f5b85f01160b` both sides |
| proof-leaf **set** may only grow | **3391 → 3391**, `comm -23` empty, raw count equals unique |
| per-file assertion counts | 123 files, **11,578** assertions, not one count moved |
| `npm test` | **3466 / 3466** |
| `npm run test:integration` | **13 / 13** |
| `npm run test:ui` | **47 / 47** |
| `npm run cov` | **100.00 / 100.00 / 100.00** |

**The `tsc` number was measured twice on purpose.** AGENTS.md records that a worktree nested
inside the parent checkout can make `tsc` bind to the *parent's* `node_modules` and report zero
errors against a state whose true count is in the thousands. The parent here holds 0.50.0, so
that trap was armed. It did not fire: `--traceResolution` shows **13,827** resolutions into this
worktree's own `node_modules` and **0** into the parent's. The `rsync`-to-outside measurement
agrees, which is the form that cannot be fooled.

**Criterion 2 still decides**, for the reason three previous reports give: the served schemas
are built from upstream's `rtti` combinators, so they are a function of the dependency rather
than of our source. 355 files changed upstream. The schemas did not move a byte.

## 3. The import surface: 22 modules changed, nothing removed

Of the 61 `functionalscript/…` specifiers this repository names, **22 modules changed** between
the two tarballs and **not one export disappeared** from any of them. Twenty of the 61 are
`types.js` specifiers that resolve to a shipped `types.d.ts` and have no runtime file in either
version — unchanged, and worth stating because a naive existence check reports them as missing.

What changed in the modules we actually call, read rather than guessed at:

- **`fjs/text`, `fjs/types/uint8array`** — `u8List(msb)` became an exported `u8ListMsb`. Same
  function, named once instead of built per module.
- **`fjs/basen/base64`, `fjs/basen/cbase32`** — a hand-written length check before `concat`
  became `tryConcat`, which answers `null` instead. The old code computed whether the result
  would fit; the new code attempts it. That is upstream obeying its own DESIGN §6, the rule
  that forbids predicting a size to decide whether something fits.
- **`fjs/types/object`** — `definedValues` is now `definedEntries(…).map(…)` instead of
  `values(…).filter(…)`. Equivalent: both read the same property order.
- **`fjs/path`** — `isDriveLetter` gained a `c.length === 1` test and three predicates became
  exported. No call site changes behaviour: every caller already passed a single character.
- **`fjs/rtti/validate`** — `undeclaredMembers` now takes a prepared predicate rather than the
  declared list, so the test is built once per schema instead of once per value.
- **`fjs/types/result`** gained `okList`, `fjs/effects` gained `finallyStep`, `fjs/types/list`
  gained `someBy` and `none`. Zero sites here.
- **`fjs/js/tokenizer`** — `\'` is now a recognised escape inside a single-quoted string. Used
  only by a report harness here, not by the engine.
- **`fjs/effects/node` and `.../virtual`** — the large ones, and §4 is what they are about.

## 4. The one source consequence, and it was found by reading

**`fjs/server/module.f.js` had a docstring naming two fields that no longer exist.** The
virtual runner's `emptyState` carried `memoryValues` and `memoryNext` through 0.50.0;
**0.51.0** folded both into one `memory`. Nothing here broke, because **no call site rebuilds
that state by hand**: 81 uses across `fjs/**.f.js`, of which 13 spread it and the rest hand it
over whole, so a renamed field is carried either way.

```sh
grep -rn 'emptyState' fjs --include='*.f.js' | grep -v 'import' | wc -l             # 81
grep -rn 'emptyState' fjs --include='*.f.js' | grep -c '\.\.\.emptyState'           # 13
```

That is exactly why nothing complained, and why a docstring telling the next reader to look for
`memoryValues` is worse than silence. Corrected, with the version that moved it named.

**That is the whole of it.** The 0.50.0 migration found a behaviour change by watching a proof
go red; this one found nothing that way, so the sweep was done by hand: every changed module in
the import surface read for a behaviour difference, every export list diffed for a removal. The
two most promising candidates — `tryConcat` replacing a length check, and `isDriveLetter`
gaining a length test — both turn out to be unobservable at our call sites, and §3 says why for
each. **A migration where the suite says nothing is the one where the suite is least useful**,
and that is an argument for reading the diff rather than for trusting the green.

`parse`'s key order, which 0.50.0 changed and which this project's content addressing depends
on, is unchanged: `{"b":1,"a":2}` round-trips in source order and `{"b":1,"2":2,"1":3}` still
hoists the integer-like keys. Run, not assumed — it is the precedent's own check.

## 5. The ceiling is gone. Measured, on four versions.

`fjs/todo/upstream-web-vec-size-limit.md` recorded that `fjs web` answers **413** to any file
larger than one `Vec` — 131,072 bytes — while eleven of the modules the demo imports exceed it.
That blocked MAINT-11's last item from milestone v6 through v8, and was filed upstream as
[`functionalscript#1819`](https://github.com/functionalscript/functionalscript/issues/1819).

The note's own reproduction, run against each release in turn:

| version | published | the note's request for `fjs/form1040/core/module.f.js` |
|---|---|---|
| 0.50.0 | 2026-09-18 | `413` — *file is 1022499 bytes; this server cannot answer with more than 131072* |
| 0.51.0 | 2026-09-26 | `413`, same text |
| **0.52.0** | 2026-09-28 | **`200`** — 1,022,499 bytes, `content-length` matching, `Buffer.compare` zero |
| 0.53.0 | 2026-09-30 | `200`, the same |

**So the fix shipped in 0.52.0, not in the release this repository took.** `ServerResponse.body`
is now `List<O, Vec, IoChannel>` — a lazy body pulled at the socket's pace — and the handle
effect (`open`/`fstat`/`pread`/`close`) exists, so every chunk of one response comes from one
`open` rather than from the name being resolved again. Both of the two greps the note
prescribed for itself now answer yes.

**The note is deleted**, per the convention its own closing rule stated and
`upstream-evo-list-raw-typeerror.md` set in 0.50.0: a note goes when its reproduction passes.
The cost of that convention is that the reproduction stops being run, so it moved into
`fjs-web-size-ceiling.test.js` instead of being thrown away. That file asks a real `fjs web`
process for the engine's largest module over a real socket and compares every byte against the
bytes on disk.

**The reading side did not move, and AGENTS.md's claim about it stands.** `readFile` still
refuses a file over `maxLengthBytes`, so `form1040-pdf-gate.test.js` is still pinned by the
220,237-byte PDF as well as by `@cantoo/pdf-lib`. `#1819` was about the response, and only the
response changed.

## 6. MAINT-11 is still PARTIAL, and the reason is new

The swap in `demo/serve.sh` was made — `exec "$repo/node_modules/.bin/fjs" web "$site" "$port"`,
the line the comment there had been carrying since 2026-08-31 — and reverted. For the second
time, and caught by the same suite for the second time.

**The page loads, slowly.** Measured 2026-10-02, Darwin 25.5.0, Node 23.11.0:

| | `fjs web` 0.53.0 | `python3 -m http.server` |
|---|---|---|
| `fjs/form1040/core/module.f.js` (1,022,499 B), best of five | 565 ms — **1.73 MB/s** | **1 ms** |
| `fjs/tax/params/module.f.js` (342,370 B), best of five | 201 ms — **1.62 MB/s** | **1 ms** |
| the showcase page, cold load | **4,427 ms** | **170 ms** |
| the same page, reload | **4,469 ms** | **37 ms** |
| `test:ui` | **7 failed / 40 passed**, 4.0 min | **47 passed**, 17.4 s |

Every one of the seven failures is `page.reload()` exceeding the suite's 30-second per-test
budget. The suite runs four workers against one server, so each load pays for the others.

**The reload column is a second defect, not the same one twice.** `fjs web` sends
`content-type`, `content-length`, `x-content-type-options` and `date` — no `Last-Modified`, no
`ETag` — so a browser has nothing to revalidate with and re-downloads the engine. python3 sends
`Last-Modified` and answers `304`, which is the whole of the 37 ms.

**Where the time goes, because the obvious answer was wrong twice.** The staging directory is
three symlinks, so the first suspicion was per-request path resolution: `fjs web` pointed
straight at the repository root, no symlink in the path, answers the same file in 503 ms — 1.94
MB/s. The second suspicion was the file read, and it is not that either. Reading those
1,022,499 bytes takes under a millisecond. Turning them into eight `Vec` chunks takes **195
ms**; turning those chunks back into bytes for the socket takes **322 ms**. 517 ms, which is
the response. A `Vec` is a bigint that carries its length, so a 131,072-byte chunk is a
million-bit integer and **every byte crosses that boundary twice per response.**

`#1819` capped how large one of those integers may be. `#2298` lifted the cap by chunking.
Neither touched the cost per byte, and neither was asked to — the design's subject was the
ceiling, and the ceiling is genuinely gone.

Recorded in `fjs/todo/upstream-web-vec-throughput.md`, which replaces the ceiling note and
carries the reproduction for each measurement above. Taking it upstream is available under
MAINT-13's standing authority and has not been done.

**What was ruled out rather than assumed**, each of which would have been a plausible report:
keep-alive works (six pooled sockets, all reused, 50 sequential requests in 122 ms); small-file
cost is 2.5 ms each (50 in 124 ms sequentially, 97 ms six at a time); concurrency works (the
four largest modules requested at once, all four complete in 1,038 ms); and correctness is
exact (1,022,499 bytes, byte-identical).

## 7. The 0.50.0 report's schema digest does not reproduce

Phase 44 recorded `f2f79e40a957e7a6` as the sha of all 30 served schemas, "both sides", and
explained the difference from 0.49.0's `6062f5b85f01160b` as *"the served surface grew between
the two milestones."*

**The surface did not grow.** Re-running that harness against the tree at the 0.50.0 bump
commit itself — `git archive fdea96d`, 0.50.0 installed — answers `6062f5b85f01160b`, the same
digest 0.48.0 and 0.49.0 recorded and the same one both sides of this bump answer.

**What produced the other number is a redirection.** `f2f79e40a957e7a6` is the sha256 of the
dump **with the harness's `stderr` merged into the stream**:

```sh
node .planning/reports/fjs-0.48.0-migration-harness/schema-dump.mjs > after.txt
shasum -a 256 after.txt        # 6062f5b85f01160b…   the schemas
node .planning/reports/fjs-0.48.0-migration-harness/schema-dump.mjs 2>&1 | shasum -a 256
                               # f2f79e40a957e7a6…   the schemas, plus the line "dialects: 30"
```

So the digest changed because the command changed, and `2>&1 |` makes the figure a function of
the shell rather than of the dependency — the ordering of the two streams in one pipe is not
even guaranteed. The comparison that report made was still sound (both of its sides were taken
the same way, and both agreed); what was wrong was the *explanation*, and an explanation is
what the next reader acts on. This is the shape AGENTS.md names as the expensive kind:
**a plausible wrong value with a reason attached.** The historical citations in
`REQUIREMENTS.md` and `STATE.md` are left where they are; this section is the correction, and
the new records cite `6062f5b85f01160b`.

## 8. What we learned

**A note's deletion should move its reproduction, not end it.** The convention here is to
delete an `upstream-*.md` once its reproduction passes, and that convention quietly throws away
the only command anybody was running. `fjs/todo/upstream-web-vec-size-limit.md` had carried a
`curl` for four milestones; it is now two assertions in the suite, and the day upstream
regresses it is a test failure rather than a page that stops working.

**"The blocker is fixed" and "the item is unblocked" are different sentences.** `#1819` closed,
and MAINT-11 did not. The dangerous version of this session is the one that checks the two greps
the old note prescribed, finds both answering yes, and marks the requirement COVERED without
starting a server. Both greps do answer yes. The adoption still fails.

**The suite that caught it the first time caught it again, differently.** In milestone v6 the
swap failed 44 of 46 UI cases — a page that never loaded. This time it failed 7 of 47 — a page
that loads correctly and slowly. The second shape is the harder one: every request returns
`200`, every byte is right, and a smoke test that waits long enough passes. **What distinguishes
them is a budget**, and the budget is in the test configuration rather than in anything the
server says about itself.

**A clean bump is where the reading matters most.** Nothing reddened across three releases, so
the only thing standing between this repository and a silent behaviour change was reading 22
module diffs. The one finding — a docstring naming a field 0.51.0 removed — would never have
surfaced from a green suite, because a spread operator absorbed the change at all 77 call
sites. The absorption is the hazard: it is what makes the stale docstring survive.

## 9. Reproducing every number above

```sh
npm i functionalscript@0.53.0

npx tsc --noEmit                                                 # §2: 0
npx tsc --noEmit --traceResolution | grep -c "$PWD/node_modules" # §2: 13827, and 0 for the parent
rsync -a --delete --exclude .git "$PWD/" /tmp/measure/ && ( cd /tmp/measure && npx tsc --noEmit )

node .planning/reports/fjs-0.48.0-migration-harness/schema-dump.mjs > after.txt
diff before.txt after.txt                                        # §2: empty; sha 6062f5b85f01160b
shasum -a 256 after.txt

npm test && npm run test:integration && npm run test:ui && npm run cov        # §2
npm test 2>&1 | grep -o '^✔ import("\./fjs/[^ ]*' | sort -u | wc -l           # §2: 3391
find fjs -name '*.f.js' | sort | while read f; do
    printf '%s\t%s\n' "$(grep -cE '\bassert(Eq|NotNullish)?\(' "$f")" "$f"; done   # §2: 123 files, 11578

# §3 — the import surface, and what moved in it
npm pack functionalscript@0.50.0 && npm pack functionalscript@0.53.0
mkdir v50 v53
tar xzf functionalscript-0.50.0.tgz -C v50 --strip-components=1
tar xzf functionalscript-0.53.0.tgz -C v53 --strip-components=1
diff -rq v50 v53 | grep -c '^Files'                              # 355
grep -rhoE "functionalscript/[A-Za-z0-9_/.-]+" --include='*.js' --include='*.mjs' \
    --include='*.ts' . | grep -v node_modules | sed 's|^functionalscript/||' | sort -u | wc -l   # 61

# §4 — the field that moved, and when
for v in v50 v51 v52 v53; do grep -A14 "export const emptyState" \
    $v/fjs/effects/node/virtual/module.f.mjs | grep -E "memory"; done

# §4 — parse, the precedent's own two rows
node -e "import('functionalscript/fjs/media/json/module.f.mjs').then(async m=>{
  const {unwrap}=await import('functionalscript/fjs/types/result/module.f.mjs')
  const {identity}=await import('functionalscript/fjs/types/function/module.f.mjs')
  const s=m.stringify(identity)
  console.log(s(unwrap(m.parse('{\"b\":1,\"a\":2}'))))
  console.log(s(unwrap(m.parse('{\"b\":1,\"2\":2,\"1\":3}'))))})"

# §5 — the deleted note's reproduction, now a test
node --test fjs-web-size-ceiling.test.js
for v in 0.50.0 0.51.0 0.52.0 0.53.0; do
    npm i functionalscript@$v && node --test fjs-web-size-ceiling.test.js; done
npm i functionalscript@0.53.0

# §6 — throughput, the headers, and where the time goes
# (the full recipes are in fjs/todo/upstream-web-vec-throughput.md)
node_modules/.bin/fjs web . 8231 &
curl -s -o /dev/null -D - -w '%{time_total}s %{size_download}\n' \
    http://127.0.0.1:8231/fjs/form1040/core/module.f.js

# §7 — the digest that does not reproduce, and the one that does
git archive <the 0.50.0 bump commit> -o /tmp/at.tar && mkdir /tmp/at && tar -xf /tmp/at.tar -C /tmp/at
ln -s "$PWD/node_modules" /tmp/at/node_modules
node /tmp/at/.planning/reports/fjs-0.48.0-migration-harness/schema-dump.mjs 2>/dev/null | shasum -a 256
node .planning/reports/fjs-0.48.0-migration-harness/schema-dump.mjs 2>&1 | shasum -a 256
```
