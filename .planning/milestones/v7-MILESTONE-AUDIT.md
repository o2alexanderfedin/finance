# Milestone v7 — audit against the source

**Ran:** 2026-09-10 on `133f25a` (`main` = `develop`, Phase 43 merged as PR #163).
**Why it exists:** v6 was marked `complete` in `STATE.md` before any gate ran, and the audit
was written afterwards to ratify it. **That is the record-ahead-of-verification failure this
repository keeps correcting**, and v6's own audit said so. This one runs *before* the milestone
is marked closed, which is the only difference that matters.

Every verdict below was reached by running the command beside it on the merged tree, not by
reading what the phase claimed. Where the phase asserted something, the assertion was treated
as a claim to check.

## Verdicts

| Requirement | Verdict | Evidence, re-derived on `133f25a` |
|---|---|---|
| **MAINT-15** — take `functionalscript` 0.49.0 | ✅ **COVERED** | `package.json` declares `^0.49.0`; `node -p "require('functionalscript/package.json').version"` reports **0.49.0**; `tsc --noEmit` **0 errors** |
| **MAINT-16** — a consumer-side migration report | ✅ **COVERED** | `.planning/reports/fjs-0.49.0-migration.md`, 318 lines, with a §9 that reproduces every number in it from two tarballs |

**Two of two COVERED, none PARTIAL, none MISSING.** This is the first milestone in this
project's history with no PARTIAL verdict.

## The four acceptance criteria, re-run rather than re-read

| # | Criterion | Measured |
|---|---|---|
| 1 | explicit version + `tsc` 0 | ✅ `^0.49.0` / 0.49.0 / **0 errors** |
| 2 | all 30 served schemas byte-identical | ✅ sha **`6062f5b85f01160b`**, and `diff` against the pre-bump dump is empty |
| 3 | proof-leaf **set** may only grow | ✅ **3388 → 3388**, `comm -23` empty, 0 lost / 0 gained |
| 3 | no assertion count falls | ✅ **123 files, not one count moved**; 11,573 total |
| 4 | full battery | ✅ `npm test` **3457/3457** · `test:integration` **13/13** · `test:ui` **46/46** · `cov` **100.00/100.00/100.00** |

**The source diff is empty.** `git diff --stat` over the phase shows `package.json`,
`package-lock.json`, two `fjs/todo/` notes that *gained* paragraphs, and the planning files.
Nothing under `fjs/`, `demo/`, `ui-tests/` or any `*.test.js`.

## What the audit found that the phase did not already know

**A raw `grep -rn 'try {' fjs --include='*.f.js'` returns TWO lines, and the invariant is still
intact.** `AGENTS.md:94` states "No `try` in a `.f.js`, with exactly one carve-out:
`fjs/refuses`", and a first reading of the count looked like a violation. It is not:

- `fjs/refuses/module.f.js:101` — the one actual `try`.
- `fjs/refuses/module.f.js:64` — a **docstring quoting the grep recipe itself**, whose text
  reads "still returns exactly one CODE hit".

The docstring anticipated this exact confusion and said so in advance. **No change made** — but
the grep as written in `AGENTS.md` counts its own citation, and a future reader running it
cold will pause here too. Worth knowing before it is reported as a regression.

## What this milestone deliberately did not do, verified on the merged tree

Both were named by path in the roadmap, in MAINT-15 and in `STATE.md` as things the phase must
**not** delete — because "take the new version" is the task during which a stale-looking
upstream note gets tidied away.

| Note | Still present | Records the re-read | Why it survives |
|---|---|---|---|
| `fjs/todo/upstream-evo-list-raw-typeerror.md` | ✅ | ✅ | 0.49.0 does not carry `functionalscript#1899`. `grep -rn 'memory key not found'` over the tarball finds it only in `fjs/effects/node/memory/` — the **real** runner, which already had it at 0.48.0 — and the virtual runner's asserts are absent. The note's own status line says FIXED, which is true **upstream on `main`** and false of anything installable |
| `fjs/todo/upstream-web-vec-size-limit.md` | ✅ | ✅ | `fjs/web/module.f.mjs` is **byte-identical** across the bump. `demo/serve.sh` still names `python3` (2 occurrences), so **MAINT-11 stays PARTIAL** and `functionalscript#1819` stays open |

**`fixed` and `released` are different states, and only the second retires a note.** This is
v7's one genuinely new lesson and it is recorded in the report's §4.3 and §8.1.

## Measured on the audited tree

- `npm test` — **3457 / 3457**, 0 fail (`tsc` clean; the suite refuses to run otherwise)
- `test:integration` — **13 / 13**, including the SEC host-path proof
- `test:ui` — **46 / 46**
- `npm run cov` — **100.00 / 100.00 / 100.00**, at thresholds that fail the build
- `functionalscript` **0.49.0** installed against `^0.49.0` declared

## Standing after the audit

Two requirements COVERED, none PARTIAL, none MISSING — and the milestone is marked closed
**after** this document, not before it.
