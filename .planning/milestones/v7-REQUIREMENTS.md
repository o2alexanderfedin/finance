# Milestone v7 — Requirements at close

**Archived:** 2026-09-10 · **Milestone:** v7 *The Drop-In*
**Verdicts:** 2 COVERED, **0 PARTIAL**, 0 MISSING — the first milestone here with no PARTIAL.
Each verdict was re-derived on the merged tree `133f25a`; see
[`v7-MILESTONE-AUDIT.md`](./v7-MILESTONE-AUDIT.md).

`.planning/REQUIREMENTS.md` is **not** deleted at this close, for the same two reasons as v6:
`planning-truth-gate.test.js:666` asserts the file is in the citing set on every `npm test`, and
this repository's requirement document is one cumulative file whose IDs are cited from code. The
full argument is in [`v6-REQUIREMENTS.md`](./v6-REQUIREMENTS.md) and is not restated.

---

## Traceability at close

| ID | Tier | Statement | Verdict | Where it is proven |
|---|---|---|---|---|
| **MAINT-15** | T3 | Take `functionalscript` 0.49.0. `^0.48.0` does not admit it — a caret on a `0.x` pins the minor — so an explicit bump | ✅ **COVERED** | `package.json` declares `^0.49.0`, 0.49.0 installed, `tsc` **0**. All four Phase-42 criteria met: 30 schemas byte-identical (`6062f5b85f01160b`); leaf set **3388 → 3388** with `comm -23` empty and no assertion count moved across 123 files; `npm test` 3457/3457, `test:integration` 13/13, `test:ui` 46/46, `cov` 100/100/100. **Source diff empty.** Phase 43, PR #163 |
| **MAINT-16** | T3 | A consumer-side migration report, in the shape of `fjs-0.48.0-migration.md` | ✅ **COVERED** | `.planning/reports/fjs-0.49.0-migration.md`, 318 lines, with §9 reproducing every number in it from two tarballs. Phase 43, PR #163 |

**Count at close:** 136 requirements in `.planning/REQUIREMENTS.md`, all checked. Derive rather
than quote — this project has had that number go stale twice in a single day:

```sh
grep -cE '^- \[[ x]\] \*\*[A-Z]+-[0-9]+' .planning/REQUIREMENTS.md   # total
grep -cE '^- \[ \] \*\*[A-Z]+-[0-9]+' .planning/REQUIREMENTS.md      # outstanding
```

---

## Requirements adjusted during the milestone

**None.** Both IDs were written on 2026-09-10 and executed the same day; neither had time to
drift, and neither was re-pointed. This is the first milestone here where that line is empty —
worth noting precisely because the previous two both had entries under it.

**MAINT-15's version-naming rule was exercised rather than merely stated.** Before the phase
ran, `npm view functionalscript version` was checked again: still 0.49.0. Had 0.50.0 published
in the hours between writing the requirement and executing it, the requirement's own text says
that would have been **a new decision**, not a silent substitution.

---

## What v7 did not do, and it was verified rather than assumed

Both notes below were named by path in the requirement and in the roadmap as things the phase
must **not** delete. Both survive, and each now records the re-read:

- **`fjs/todo/upstream-evo-list-raw-typeerror.md`** — 0.49.0 does not carry
  `functionalscript#1899` (merged 2026-09-08, six days after the cut). Verified by `grep` over
  the tarball, not inferred from dates.
- **`fjs/todo/upstream-web-vec-size-limit.md`** — `fjs/web/module.f.mjs` byte-identical across
  the bump, so **MAINT-11 remains PARTIAL from v6** and `functionalscript#1819` stays open.

**`fixed` and `released` are different states, and only the second retires a note.** That is
v7's one genuinely new lesson.

---

## Phases 34 and 36 still map no requirement, and still do

Carried from v4 through v5, v6 and now v7 at their original numbers. No release changes what
they are blocked on.
