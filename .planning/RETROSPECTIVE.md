# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

> **Starts at v6.** v1–v5 have no retrospective section and none is being written from a git
> log months later — see the same note in `MILESTONES.md` for why. Newest first.

---

## Milestone: v7 — The Drop-In

**Shipped:** 2026-09-10 (opened the same day)
**Phases:** 1 (43) · **Plans:** 0 · **PRs:** 3 (#161, #162, #163)

### What Was Built

- `functionalscript` 0.49.0 taken. One line in `package.json`; **zero source lines changed.**
- `.planning/reports/fjs-0.49.0-migration.md` — the consumer's side of a release that cost
  nothing, with a §9 that reproduces every number in it from two tarballs.

### What Worked

- **Sizing the milestone by performing the migration.** A throwaway worktree, an `npm install`
  and ten minutes produced *evidence* where planning would have produced an *estimate*. The
  changelog said "140 upstream files changed", which reads like four phases; the probe said
  zero sites reached, which is one. **This is strictly cheaper than the planning it replaces,
  and it is deletable by construction.**
- **Keeping the probe and the proof separate.** The probe skipped `test:ui` and `npm run cov`
  on purpose, and both were written into the acceptance criteria as the phase's to run. Naming
  what a shortcut did *not* check is what stops it from silently becoming the check.
- **Running the byte-identity criterion on an empty source diff.** It is the check that looks
  most skippable here and is not: served schemas are a function of the dependency, not of our
  source.
- **Naming the requirement by version rather than "the latest"** — and then re-checking
  `npm view functionalscript version` at execution time rather than trusting the note from
  hours earlier.
- **Writing the two "do not delete this" notes into the requirement, the roadmap and
  `STATE.md` by path.** One of them *looks* stale — its own status line says FIXED — and "take
  the new version" is exactly the task during which it would have been tidied away.

### What Was Inefficient

- **The same stale-figure defect was planted twice in one day, in prose written to warn about
  it.** v6's close corrected three hardcoded counts and explained the mechanism; opening v7
  made three more stale within hours (PR #162), and executing Phase 43 made the *fix* stale
  within an hour. The third rewrite carries no load-bearing figure at all. **The lesson is not
  "be careful" — it is that a number beside the command that computes it is the second
  statement, and the second statement is the one that diverges.**
- **`gsd-sdk query state.milestone-switch` re-armed the `STATE.md` stomp**, leaving the
  `## Session` block on v6 while rewriting the header for v7. Caught by diffing its output —
  which is now the standing rule for any `gsd-*` write to that file.

### Patterns Established

- **Probe before scoping.** For any dependency migration: install it in a throwaway worktree,
  run the suite, then write the milestone to what was measured. Record what the probe did *not*
  run.
- **`fixed` ≠ `released`.** A gap filed upstream can be merged and still absent from every
  published version. Retire a note when the fix is *installed here*, verified against the
  artifact, never when the PR merges.
- **Prefer a derive command with no number beside it** to a number with a derive command beside
  it.

### Key Lessons

1. **Measure the migration before scoping the milestone.** Ten minutes of probe beats an hour
   of reading a changelog, and the output is evidence rather than an estimate.
2. **A shortcut is safe exactly as long as what it skipped is written down.** The probe was
   trustworthy because its two gaps were named in the acceptance criteria.
3. **Check the thing that is a function of the dependency, not of your diff.** An empty source
   diff says nothing about what your application serves.
4. **`merged` is not `released`,** and a consumer tracking the first deletes its notes too
   early.
5. **Correcting a stale number by writing a fresher number schedules the next correction.**

### Cost Observations

- Not instrumented; nothing is reconstructed here rather than guessed.
- Measurable: 3 PRs in one day, of which one executed the milestone and one fixed figures the
  previous day's work had made stale.

---

## Milestone: v6 — A Current Engine, Actually Current

**Shipped:** 2026-09-10
**Phases:** 4 owned (39, 40, 41, 42), plus 3 carried-forward advanced (34, 35, 36)
**Plans:** 0 · **PRs:** 17 (#143 → #159)

### What Was Built

- FunctionalScript 0.48.0 taken across 140 `rtti` import sites and 459 `option(…)` calls, with
  all 30 served dialect schemas byte-identical before and after.
- MCP protocol-version negotiation retired as a gap, and the proof replaced with one that can
  actually fail.
- Dialect validation on the `cas_add` write path, proven to refuse *before* the store.
- A consumer-side migration report; the standing upstream authority written into `AGENTS.md`.
- Coverage to 100/100/100 across 122 files, with thresholds raised to match.
- The IRS's own `f1040.pdf` filled from the engine's lines (Phase 35).

### What Worked

- **Byte-identity as the acceptance criterion for a mechanical migration.** "The suite is
  green" would have passed a rewrite that moved every served schema. Comparing 30 schemas byte
  for byte is a cheap check that watches the thing the change could actually break.
- **Coverage used as a search strategy rather than a number.** Requiring that every new leaf
  *assert what the covered path produced* — no ignore comments, no weakened thresholds — turned
  a bookkeeping exercise into six real defect findings.
- **Verifying every reported finding against the source before accepting it.** Roughly a third
  of findings across this project's review rounds were wrong until the cited code was read. In
  this milestone that discipline stopped a fix from shipping for a **non-defect**: an
  `evoSummary` change to `finance_documents_list` was reverted once `tsc` and the type
  declarations showed `list`/`head` are typed `NotImplemented`-only, so no `EvoError` can reach
  the renderer at all.
- **Reframing an owner-blocked phase around what is achievable without the owner.** 34, 35 and
  36 had been "blocked" for two milestones. Asking what each could prove *today* produced 8,371
  cross-checked comparisons, a filled PDF, and a real end-to-end conversational run — and left
  the genuinely blocked remainder visibly open rather than silently deferred.

### What Was Inefficient

- **The milestone was executed direct-to-PR and marked `complete` in `STATE.md` before any
  gate ran.** The audit was then run afterwards and ratified it — but the record preceded the
  verification, which is the failure this repository spends most of its planning discipline on.
  It recurred anyway.
- **A truncated coverage report was read as if it were the whole thing.** The same `tail`
  mistake was made twice; the fix that stuck was not vigilance but an assertion that the parsed
  table has more than 100 rows, so a truncated read *fails* instead of passing vacuously.
- **A pinned toolchain was declared unavailable after checking one source.** typescript-go
  7.0.2 was reported as unobtainable on the strength of an npm check; it exists at tag
  `typescript/v7.0.2` with prebuilt binaries. Two PR descriptions had to be corrected.
- **`STATE.md` was overwritten three times by the GSD hook with a stale pre-v6 snapshot**, and
  each time it was hand-reverted rather than fixed at the source. The source is documented
  inside the file itself: the frontmatter is rebuilt from the *first* `Status:` / `Stopped at:`
  / `Progress:` / `Last activity:` lines in the body, and those still read v5. Fixed at close.
- **A "flaky" UI test was reported as load-dependent before it was run alone.** It failed 8/8
  in isolation: load changed which way the coin landed, not whether one was being flipped.

### Patterns Established

- **A guard that cannot be covered gets fixed in a fixed order:** prove it → narrow it with
  `assertNotNullish` → delete it only when provably dead. Never a coverage-ignore comment.
- **A vacuous check must be made to fail.** Any parsed-artifact check carries an assertion on
  the *size* of what it parsed, so an empty or truncated parse is a failure rather than a pass.
- **An authorization that lives in a chat log is an authorization the next reader cannot
  check.** The `@cantoo/pdf-lib` approval was written into the roadmap entry, with its scope
  (`devDependency` only) stated, because `AGENTS.md` makes owner approval a hard stop.
- **One `try` under `fjs/**.f.js`, and a fix that needs error handling extends `fjs/refuses`
  rather than adding a second.** The guest-throw crash fix added `attempt` there and kept the
  count at one.

### Key Lessons

1. **Compiling is not evidence, and a green suite is not evidence either.** Name the specific
   observable the change could break, and compare it directly.
2. **A proof that passes whether or not the feature exists is worse than no proof**, because it
   is counted. Build the fixture so the un-featured implementation gives a *different* answer.
3. **"Blocked on the owner" is usually a claim about the whole phase when it is true of a
   part.** Split it and ship the part.
4. **Check the primary source before declaring something unavailable.** One registry is not the
   internet.
5. **Fix a recurring corruption at its mechanism, not by reverting it again.** Three reverts of
   the same `STATE.md` stomp cost more than reading the ten lines that explained it.

### Cost Observations

- Not instrumented. This project records no per-session model mix or token accounting, and none
  is reconstructed here rather than guessed.
- What *is* measurable: 79 commits and 17 PRs in 11 days, of which 4 PRs carried the milestone's
  own phases and 13 carried work with no requirement ID.

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Phases | Plans | Key change |
|-----------|--------|-------|------------|
| v6 | 4 owned | 0 | First milestone archived to `milestones/`; first with a retrospective; direct-to-PR execution with the audit run after the fact |
| v7 | 1 | 0 | **First milestone scoped from a probe rather than a changelog**, and the first whose audit ran BEFORE the close rather than to ratify it |

### Cumulative Quality

| Milestone | Suite | Coverage | Dependencies added |
|-----------|-------|----------|--------------------|
| v6 | 3457 proofs · 13 integration · 46 UI | 100.00 / 100.00 / 100.00 across 122 files (thresholds raised 90 → 100) | 1, approved by both owners: `@cantoo/pdf-lib` as a **devDependency**. The shipped package's `dependencies` are unchanged |
| v7 | 3457 proofs · 13 integration · 46 UI — **leaf set 3388 → 3388, none lost** | 100.00 / 100.00 / 100.00, unchanged | **0** |

### Top Lessons (Verified Across Milestones)

1. **Two statements of one fact with no check between them will diverge.** Every count in this
   project that turned out wrong was true of the part someone examined. The fix is always a
   derivation command beside the number, never a more careful transcription.
2. **A record written before its verification will be ratified or contradicted later, and
   nobody can tell which from the record itself.** v6 repeated v4's version of this.
