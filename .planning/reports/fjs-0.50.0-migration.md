# Taking `functionalscript` 0.50.0

**Executed:** 2026-09-22 · **From:** 0.49.0 · **Phase:** 44 · **Requirements:** MAINT-17, MAINT-18
**PRs:** [#173](https://github.com/fjs-dev/finance/pull/173) (the bump), [#174](https://github.com/fjs-dev/finance/pull/174) (MCP-10, in the same milestone)

---

## 1. What changed, in one line

Reading a JSON text and writing it back out no longer reorders its keys — unless one of them
looks like a number.

That is the whole consumer-visible surface of this release for us. One proof reddened; nothing
else in 3,457 did.

## 2. The change, measured on both sides

`parse` used to sort every key. It now returns ECMAScript's own property order: integer-like
keys first in ascending numeric order, then the rest in insertion order.

| input | 0.49.0 | 0.50.0 |
|---|---|---|
| `{"b":1,"a":2}` | `{"a":2,"b":1}` | `{"b":1,"a":2}` |
| `{"b":1,"2":2,"1":3}` | `{"1":3,"2":2,"b":1}` | `{"1":3,"2":2,"b":1}` |

Both rows were run, on both versions, through this repository's own `fjs/json` binding
(`stringify` curried on `identity`, so the writer preserves whatever order it is handed and the
only variable is `parse`). The second row is the control: integer-like hoisting is unchanged, so
what moved is exactly the sorting of ordinary keys and nothing else.

## 3. Why a JSON key order is a migration finding here

This is a content-addressed store. A different key order is a different hash, so
`fjs/json/module.f.js` carries a rule in its own docstring — **hash the bytes that were written,
never a re-serialization of the parsed value** — and two proofs that pin the asymmetry the rule
exists for.

**The rule did not change. Its reason narrowed.** Through 0.49.0 no text with two unordered keys
round-tripped, so the trap was constant and loud. Now it springs only on a text carrying an
integer-like key, and a trap that springs rarely is the kind people stop believing in. The
docstring says so in as many words, because that is the part a reader would otherwise infer
backwards.

**No call site needed changing.** Four modules import `parse` (`fjs/server`, `write_validation`,
`response`, `finance_documents_list`) and none re-serializes a parsed value to take a hash — the
rule was already being followed, which is why a semantic change to key order moved nothing but
the proof that watches it.

## 4. Acceptance — Phase 42's criteria, unchanged

| # | Criterion | Result |
|---|---|---|
| 1 | `package.json` names 0.50.0 explicitly; `tsc` 0 | ✅ `^0.50.0`, 0.50.0 installed |
| 2 | `toJsonSchema` over all 30 dialect schemas **byte-identical** | ✅ `f2f79e40a957e7a6` both sides |
| 3 | Full battery green | ✅ 3458/0 · 13/13 · 47/47 · 100/100/100 |

**Criterion 2 is the one that decides**, for the reason 0.49.0's report gives and this release
does not weaken: the served schemas are built from upstream's `rtti` combinators, so they are a
function of the dependency and not of our source. A release that changes `parse` could have
changed them. It did not, and that was run rather than assumed.

**The sha differs from 0.49.0's `6062f5b85f01160b`** because the served surface grew between the
two milestones. The criterion is that both sides of *this* comparison agree, and they do.

## 5. The two notes the re-read rule named

`AGENTS.md` requires re-reading `fjs/todo/upstream-*.md` when a version ships. Both were.

**`upstream-evo-list-raw-typeerror.md` is deleted.** 0.50.0 carries `functionalscript#1899`, so
the virtual interpreter refuses a never-allocated slot instead of answering `ok(undefined)`.
Verified by running the note's own reproduction rather than by reading dates:

```
memory key not found: 0
```

Its closing rule said it would be deleted rather than annotated at exactly this point, and it was.

**`upstream-web-vec-size-limit.md` stays.** Both greps it prescribes still answer no:
`ServerResponse.body` is one `Vec`, and there is no file-handle effect. So `fjs web` still answers
`413` above 131,072 bytes, `demo/serve.sh` stays on `python3 -m http.server`, and **MAINT-11's
`fjs web` half stays PARTIAL**.

`readChunks` landed in this release — our own [functionalscript#2079](https://github.com/functionalscript/functionalscript/pull/2079),
merged 2026-09-17 — and it is worth being precise about what that did and did not do. It is the
chunk *reader*. What blocks a large response is the response *type*. Reading was never the part
that could not be done.

## 6. What we learned

**A proof written to pin an asymmetry is what caught a change in it.** The finding did not come
from a changelog — there is no changelog entry for it — and it did not come from reading
upstream's diff. It came from running the suite against the new version in a throwaway worktree,
where exactly one leaf failed and named the behavior in its own title. Sizing a migration from a
probe rather than from release notes is the practice v7 adopted; this is the release that shows
why.

**A correct proof can be a false witness about which direction is safe.** The reddened proof said
the round trip canonicalizes. The safe reading was "upstream broke something"; the true reading
was "upstream became more faithful, and our warning got narrower." Splitting the proof in two —
one leaf per direction — makes the next reader see both without inferring either.

**Watched to fail, both of them.** Reverting the first proof's expectation to the 0.49.0 sorted
answer reddened it alone; expecting integer-like keys to stay in source order reddened the other
alone; both reverted. A green suite nobody watched fail is not evidence.

## 7. Reproducing every number above

```sh
npm i functionalscript@0.50.0

npx tsc --noEmit                                     # §4 criterion 1

node .planning/reports/fjs-0.48.0-migration-harness/schema-dump.mjs > after.txt
diff before.txt after.txt                            # §4 criterion 2; sha f2f79e40a957e7a6

npm test && npm run test:integration && npm run test:ui && npm run cov   # §4 criterion 3

# §2, both rows, against whichever version is installed
node -e "import('functionalscript/fjs/media/json/module.f.mjs').then(async m=>{
  const {unwrap}=await import('functionalscript/fjs/types/result/module.f.mjs')
  const {identity}=await import('functionalscript/fjs/types/function/module.f.mjs')
  const s=m.stringify(identity)
  console.log(s(unwrap(m.parse('{\"b\":1,\"a\":2}'))))
  console.log(s(unwrap(m.parse('{\"b\":1,\"2\":2,\"1\":3}'))))})"

# §5, the deleted note's own reproduction
grep -n 'memory key not found' node_modules/functionalscript/fjs/effects/node/virtual/module.f.mjs

# §5, the surviving note's two checks
grep -n -A5 'ServerResponse = {' node_modules/functionalscript/fjs/effects/node/types.d.ts
grep -nE "'(open|fstat|close)'" node_modules/functionalscript/fjs/effects/node/types.d.ts
```
