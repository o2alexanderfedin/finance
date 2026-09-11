# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

> **Starts at v6.** v1–v5 have no retrospective section and none is being written from a git
> log months later — see the same note in `MILESTONES.md` for why.

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

### Cumulative Quality

| Milestone | Suite | Coverage | Dependencies added |
|-----------|-------|----------|--------------------|
| v6 | 3457 proofs · 13 integration · 46 UI | 100.00 / 100.00 / 100.00 across 122 files (thresholds raised 90 → 100) | 1, approved by both owners: `@cantoo/pdf-lib` as a **devDependency**. The shipped package's `dependencies` are unchanged |

### Top Lessons (Verified Across Milestones)

1. **Two statements of one fact with no check between them will diverge.** Every count in this
   project that turned out wrong was true of the part someone examined. The fix is always a
   derivation command beside the number, never a more careful transcription.
2. **A record written before its verification will be ratified or contradicted later, and
   nobody can tell which from the record itself.** v6 repeated v4's version of this.
