# Migration report: FunctionalScript 0.48.0 → 0.49.0

**Written 2026-09-10, for Sergey**, in the shape of
[`fjs-0.48.0-migration.md`](./fjs-0.48.0-migration.md) and
[`fjs-0.46.1-migration.md`](./fjs-0.46.1-migration.md), the latter asked for by name in
`todo/update-fjs-0.46.0` (PR #96).

**This is a report about a release that cost nothing, and that is why it is worth writing.**
Two consecutive reports have now described breakage; a third describing none is the only way
the first two mean anything. **The absence of breakage is invisible from where the library is
authored** — upstream cannot see that a downstream consumer changed zero lines unless the
consumer measures it and says so. This is that measurement.

The whole migration is one line:

```diff
-    "functionalscript": "^0.48.0"
+    "functionalscript": "^0.49.0"
```

Nothing under `fjs/`, `demo/`, `ui-tests/` or any `*.test.js` was touched. `package-lock.json`
moved with the dependency, and that is the entire diff.

---

## 1. The numbers

| | 0.48.0 → 0.49.0 |
|---|---|
| published | 2026-09-02, three days after 0.48.0 |
| upstream files changed / added / removed | **140 / 13 / 8** |
| upstream paths this repo imports | **60**, of which **13 changed, 0 moved, 0 removed** |
| breaking changes reaching this code | **0** |
| source lines changed here | **0** |
| `tsc --noEmit` | **0 errors** |
| `npm test` | **3457 / 3457** |
| `test:integration` | **13 / 13** |
| `test:ui` | **46 / 46** |
| `npm run cov` | **100.00 / 100.00 / 100.00** at thresholds that fail the build |
| `toJsonSchema` over all 30 served dialect schemas | **byte-identical**, sha `6062f5b85f01160b` both sides |
| proof-leaf set | **3388 → 3388**, `comm -23` empty, **0 lost, 0 gained** |
| per-file assertion counts | **unchanged in all 123 `.f.js` files**, 11,573 total |

`^0.48.0` does not admit 0.49.0 — a caret on a `0.x` pins the minor — so this was an explicit
bump, as MAINT-09 and MAINT-14 were.

**The contrast with the previous two releases is the finding.** 0.48.0 moved `rtti` across 140
import sites and turned `option` from a function into a tag at 459 call sites. 0.49.0 changed
*more upstream files relative to its own size* and reached this code at **zero sites**.

---

## 2. The thirteen imported paths that changed, and what each did

Read rather than inferred from the file list. None required a change here; four are worth
knowing about anyway.

### 2.1 `errorMessage` relocated — a name moved, a rule did not

`fjs/effects/module.f.mjs` now declares `errorMessage`, and `fjs/effects/node` re-exports it
from there. The function already existed in `fjs/effects/node` at 0.48.0; this is a relocation
to sit beside the `IoChannel` it renders, on the stated ground that *"every host has the same
two things to say about a failure."*

**It matters here because this repository forbids that function by name.** The convention at
`fjs/guest/materialize/module.f.js:314` reads *`errorSummary`, never `errorMessage`*, and its
enforcement instruction is `grep -rn errorMessage fjs`. Both survive the move untouched: the
grep is over our tree, not upstream's, and the reason the rule exists is upstream's own
docstring, which the relocation carried along verbatim — `errorMessage` is *"for the operator
of the program, who is entitled to the host's own words — including the path that failed."*

**We have no operator-facing sink for that string.** Every rendering here reaches a remote MCP
client, directly as an `errorResult` or indirectly through a run record the same server serves
over `cas_get`.

### 2.2 The oversized-file error now names the path — and it is structurally contained

`fjs/effects/node/module.mjs`:

```diff
-    throw new Error(`File size ${n} exceeds maximum allowed size of ${m} bytes`)
+    throw new Error(`File size ${n} exceeds maximum allowed size of ${m} bytes: '${path}'`)
```

**This is exactly the shape of change that could have broken SEC**, whose integration proof
asserts that a materialize failure surfaces no host filesystem path in the response *or* in the
run record it names. It does not, and the reason is structural rather than lucky:

```js
export const errorSummary = ([tag, payload]) =>
    tag === 'notImplemented'
        ? `operation not implemented: ${payload}`
        : payload.code === undefined ? 'io error' : `io error: ${payload.code}`
```

`errorSummary` reads `payload.code` and **never** `payload.message`, and answers the bare
`io error` when a host attached no code. A host may put whatever it likes in the message; the
renderer does not forward it. The SEC proof was run against 0.49.0 and passes.

**The general point, and it is upstream's design rather than our luck:** a redaction that works
by *choosing which fields to forward* survives a change to the fields it does not forward. One
that worked by pattern-matching paths out of free text would have broken here. Upstream's own
docstring says as much — *"guessing which part of a free-text message is path-free is exactly
the mistake this exists to prevent."*

### 2.3 `all` / `allOk` / `both` / `import_` moved to `fjs/effects/common`

Re-exported from `fjs/effects/node`, so every existing import site keeps working. The stated
reason is a sharpening of the layering rule: `Sandbox`, `Catch` and `Import` have a second
implementer (a browser), and `All` is there *"because nothing about them is Node's — fan-out
belongs to whichever interpreter has concurrency."*

This repository uses `import_` at 35 sites and **none** of `all`, `allOk` or `both`. All 35
continue to resolve through node.

### 2.4 The virtual interpreter's file resolution was reworked

`fjs/effects/node/virtual/module.f.mjs` gained `resolveFile`, `jsModuleUnsupported` and
`jsModuleNotAFile`, unifying what `readFile`, `readBytes` and `writeBytes` each used to
open-code. The asymmetry is deliberate and documented: the two reads **panic** on a `JsModule`
(their contract is to produce bytes and there are none), while `writeBytes` returns an
`IoResult` error, because a caller's branch for that failure can only be proven against this
runner if the runner returns it.

**Our proofs exercise this module heavily** — it is the interpreter behind most of the server
suite — and all pass unchanged.

### 2.5 The remaining nine — additive or type-identical

| Path | Change | Effect here |
|---|---|---|
| `fjs/effects/node/module.mjs` | `readdir` entries gain `isDirectory` | none — no caller |
| `fjs/cas/types` | `FileCas.url` becomes `readonly` | none — never assigned |
| `fjs/types/object/types` | `RequiredMap` re-expressed through a new `AbstractRequiredMap` | none — same resolved shape |
| `fjs/types/ts/types` | `And` switches `[A] extends [B]` → `readonly [A] extends readonly [B]` | none — **`And` used at 0 sites here** |
| `fjs/rtti/ts/types` | three internals and `TupleRestTs` make the same switch | none — `tsc` reports 0 |
| `fjs/effects/node/types` | re-export list widened for the moves in §2.3 | none |
| `fjs/effects/module.f.mjs` | gains `errorMessage` (§2.1) | none |
| `fjs/types/bit_vec`, `fjs/types/list`, `fjs/types/uint8array` | docstrings re-point `DESIGN.md` → `doc/DESIGN.md` | none — prose |

---

## 3. What decided the migration

**The same four criteria as Phase 42, and for the same reason: Phase 38 is where this
repository learned that compiling is not evidence.** Its call-site `open()` experiment
typechecked, passed the suite, and silently moved 47 served containers while presenting the
smaller diff as proof.

| # | Criterion | Result |
|---|---|---|
| 1 | `package.json` names 0.49.0 explicitly; `tsc` 0 | ✅ |
| 2 | `toJsonSchema` over all 30 dialect schemas **byte-identical** | ✅ `6062f5b85f01160b` both sides |
| 3 | Proof-leaf **set** may only grow; no touched module's assertion count falls | ✅ 3388 → 3388, `comm -23` empty; 123 files, not one count moved |
| 4 | Full battery green | ✅ 3457/3457 · 13/13 · 46/46 · cov 100/100/100 |

**Criterion 2 is the one that decides, and on a zero-diff migration it is also the one people
would skip.** That is backwards. A release that changes nothing *here* can still change what
`toJsonSchema` emits, because the schemas are built from upstream's `rtti` combinators — the
served surface is a function of the dependency, not of our source. Running it is five seconds;
assuming it is how 47 containers moved unnoticed once already.

---

## 4. What we learned

### 4.1 A release can be large and reach nothing, and `git diff --stat` still predicts neither

The 0.48.0 report's §5.2 said a diffstat predicts almost nothing about blast radius. 0.49.0 is
the **other** half of that proof. 140 upstream files changed — comparable to 0.47.0's 143,
which cost a phase — and the blast radius here was zero.

What actually predicts it is the intersection: of the **60** upstream paths this repository
imports, how many changed, and of those, how many changed their *public* surface. For 0.48.0
that was 28 changed and 5 **moved**, and the moves were the cost. For 0.49.0 it is 13 changed
and **none moved**. **Relocation is what hurts a consumer; internal rework is not.** 0.49.0
relocated four names — and re-exported every one of them from where it used to live, which is
the difference between §2.3 costing nothing and §2.1 of the previous report costing 140 edits.

### 4.2 Measure the migration before scoping the milestone, not after

**This milestone was sized by performing it.** Before a requirement was written, 0.49.0 was
installed in a throwaway git worktree off `fe16839` and the repository was run against it
unchanged. Everything passed. The milestone was then written as one phase — instead of the four
a changelog-driven reading of "140 files changed" would have produced.

The probe cost about ten minutes and is deletable by construction: a worktree, an
`npm install`, and `git worktree remove --force`. **It is strictly cheaper than the planning it
replaces**, and unlike planning its output is evidence.

The one discipline it needs: **the probe is not the phase.** It deliberately did not run
`test:ui` or `npm run cov`, and both were named in the acceptance criteria as the phase's to
run. A probe that quietly becomes the verification is a proof that stopped watching.

### 4.3 A gap filed upstream can be fixed and still not ship

**Neither of the two upstream changes this project contributed is in 0.49.0**, and both were
*merged*:

| PR | Merged | In 0.49.0? |
|---|---|---|
| [`#1899`](https://github.com/functionalscript/functionalscript/pull/1899) — virtual `memRead`/`memWrite` refuse a never-allocated slot | 2026-09-08 | **No** — six days after the cut |
| [`#1900`](https://github.com/functionalscript/functionalscript/pull/1900) — streaming HTTP bodies, as a design in `fjs/effects/node/todo/` | 2026-09-10 | **No** — eight days after |

Verified against the tarball, not inferred from dates: `grep -rn 'memory key not found'` over
0.49.0 finds it only in `fjs/effects/node/memory/` — the **real** runner, which already carried
it at 0.48.0 — and the virtual runner's matching asserts are absent.
`fjs/effects/node/todo/` does not exist in the package at all.

**So `fjs/todo/upstream-evo-list-raw-typeerror.md` survives this migration and was deliberately
not deleted.** Its own closing rule retires it "when the version that contains the fix is
installed here", and 0.49.0 is not that version. A note tidied away during a bump is a live
record destroyed on a technicality.

**This sharpens §5.1 of the previous report, which asked for a way to learn that a filed gap had
closed.** The answer needs a second field: not just *which release closes this issue*, but
*whether that release exists yet*. `merged` and `released` are different states, and a consumer
tracking the first will delete its notes too early.

### 4.4 The re-read rule paid for itself

`AGENTS.md` gained a rule during v6: re-read the upstream gap notes when a new release ships.
**It fired on 2026-09-10 and that is the only reason 0.49.0 was noticed at all** — it had been
out for eight days. 0.47.0 once closed a gap here and went unnoticed for four days, which is
where the rule came from; without it, this would have been the second occurrence and a longer
one.

---

## 5. What cost nothing, stated explicitly

- **No source edits.** 0 lines under `fjs/`, `demo/`, `ui-tests/` or any test file.
- **No new `try`.** The count under `fjs/**.f.js` stays at **1**, in `fjs/refuses`.
- **No dependency change.** `@cantoo/pdf-lib` untouched; no new package, so no owner approval
  was needed and none was sought.
- **No schema change.** All 30 byte-identical.
- **No proof lost.** 3388 leaves in, 3388 out, same names.

---

## 6. Capabilities NOT adopted, and why that is a decision rather than an oversight

v6's MAINT-11 admitted each 0.47.0 capability on the ground that it **deleted** something here.
0.49.0's additions do not, and were declined on that same rule:

| Addition | Why not |
|---|---|
| `errorMessage` in `fjs/effects` | **Forbidden here.** It renders `payload.message`, which is where a host puts the absolute path; every rendering in this process reaches a remote MCP client. `fjs/guest/materialize/module.f.js:314` is the rule and `grep -rn errorMessage fjs` is its enforcement. |
| `allOk` / `both` / `all` | **0 call sites.** Nothing here fans out effects concurrently; adopting them would add code, not remove it. |
| `And` from `fjs/types/ts` | **0 call sites.** This repository's type-level assertions use a local `Extends` and `Assert<Equal<…>>`. |
| `readdir`'s `isDirectory` | **No caller.** Every `readdir` here filters on `isFile`. |

**A phase admitted on "it is new" rather than "it removes something" is the one v6 refused to
write, and this one does not write it either.**

---

## 7. What is still owed upstream, unchanged by this release

- **[`functionalscript#1819`](https://github.com/functionalscript/functionalscript/issues/1819)
  — the `fjs web` size ceiling. Still open, and the file is byte-identical across the bump.**
  `fjs/web/module.f.mjs` answers `413` for anything over one `Vec` (131,072 bytes) and eleven of
  this demo's modules exceed it, the largest by 7.6×. `demo/serve.sh` therefore still runs
  `python3 -m http.server`, which is the functionalscript-only dependency rule not yet reaching
  its last place. **MAINT-11 stays PARTIAL.**
- **[`functionalscript#1893`](https://github.com/functionalscript/functionalscript/issues/1893)**
  — open, though `#1899` closed its substance. Closing it is the maintainer's call; the PR
  referenced it without a closing keyword.

---

## 8. For the next release

1. **`merged` is not `released`.** §4.3: when a changelog entry names the issue it closes,
   naming the *version* alongside it lets a consumer `grep` its own open notes in five seconds
   and, critically, tells it when **not** to delete one yet. The 0.48.0 report asked for the
   first half of this; 0.49.0 is what showed the second half was missing.
2. **A shipped package carries no changelog at all.** Neither 0.48.0's nor 0.49.0's tarball has
   a `CHANGELOG` file — `npm pack` ships `fjs/`, `todo/`, `README.md`, `LICENSE` and
   `package.json`. A consumer reading only what npm gives it has no release notes; everything in
   this report came from diffing two tarballs and reading the source. That is a fine way to
   write a migration report and a poor way to *decide whether to migrate*.
3. **Upstream dropped `typescript` from its own `devDependencies` in 0.49.0.** Consumers who
   inherited it now do not. This repository pins `^7.0.2` of its own and is unaffected — but the
   change is invisible until something fails to compile, and it is the kind of thing a release
   note exists for.

---

## 9. Reproducing every number in this report

```sh
# the tarball diff (§1, §2)
npm pack functionalscript@0.48.0 && npm pack functionalscript@0.49.0
mkdir v48 v49
tar xzf functionalscript-0.48.0.tgz -C v48 --strip-components=1
tar xzf functionalscript-0.49.0.tgz -C v49 --strip-components=1
diff -rq v48 v49 | grep -c '^Files'          # 140 changed
diff -rq v48 v49 | grep '^Only'              # 13 added / 8 removed

# our import surface, and the intersection (§1)
grep -rhoE "functionalscript/[A-Za-z0-9_/.-]+" --include='*.js' --include='*.mjs' \
    --include='*.ts' . | grep -v node_modules | sed 's|^functionalscript/||' | sort -u | wc -l   # 60

# criterion 2 — the one that decides (§3)
node .planning/reports/fjs-0.48.0-migration-harness/schema-dump.mjs > after.txt
diff before.txt after.txt                    # empty; sha 6062f5b85f01160b

# criterion 3 (§3)
npm test 2>&1 | grep -o '^✔ import("\./fjs/[^ ]*' | sort -u > result.txt
comm -23 baseline.txt result.txt             # empty
find fjs -name '*.f.js' | sort | while read f; do
    printf '%s\t%s\n' "$(grep -cE '\bassert(Eq|NotNullish)?\(' "$f")" "$f"; done   # no count falls

# §4.3 — the two fixes that are merged and not released
grep -rn 'memory key not found' v49/          # only fjs/effects/node/memory/, the REAL runner
ls v49/fjs/effects/node/todo/                 # does not exist
```
