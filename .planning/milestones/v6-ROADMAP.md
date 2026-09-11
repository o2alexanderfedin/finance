# Milestone v6: A Current Engine, Actually Current

**Status:** ✅ SHIPPED 2026-09-10
**Phases owned:** 39, 40, 41, 42 — executed `42 → 39 → 40 → 41`
**Plans:** 0. No `PLAN.md` was written for any phase in this milestone; it was executed
direct-to-PR, which is itself recorded below as the milestone's largest process finding.
**Opened:** 2026-08-31 (PR #143) · **Closed:** 2026-09-10 (this archive)
**Audit:** [`v6-MILESTONE-AUDIT.md`](./v6-MILESTONE-AUDIT.md) — five COVERED, one PARTIAL
and blocked upstream, none MISSING.

## Overview

0.47.0 was taken on 2026-08-27 and 0.48.0 published three days later. Rather than let
Phase 41 adopt capabilities from a release that was already superseded, the milestone
re-bumped the engine first and then ran the three carried-forward phases against what was
actually current. The name is the thesis: *actually* current, not current-as-of-the-plan.

**Requirements delivered:** MAINT-09, MAINT-10, MAINT-11 *(partial)*, MAINT-12, MAINT-13,
MAINT-14, DOC-25. Full bodies stay in `.planning/REQUIREMENTS.md`, which is **not** deleted
at milestone close here — see the note in `v6-REQUIREMENTS.md`.

---

## Phases

**Requirements**: MAINT-10 · **Tier**: T3 · **Status**: complete — milestone v6, 2026-08-31

### Phase 40: Validation on the Write Path
**Requirements**: DOC-25 · **Tier**: T3 · **Status**: complete — milestone v6, 2026-08-31. Option 1 (the write boundary), not the note's preferred Option 2; the reason is in `fjs/todo/no-dialect-validation-on-the-write-path.md` under "How it was closed".

### Phase 41: New Capabilities and the Migration Report
**Requirements**: MAINT-11, MAINT-12, MAINT-13 · **Tier**: T3 · **Status**: complete except MAINT-11's `fjs web` item, blocked upstream — milestone v6, 2026-08-31. The report is `fjs-0.48.0-migration.md`, not `-0.47.0-`: v6 superseded 0.47.0 before this phase ran, and 0.47.0's own unreported migration is folded in as §5.1. `fjs web` cannot serve a file over 131072 bytes and eleven of the demo's do; see `fjs/todo/upstream-web-vec-size-limit.md`, filed upstream as `functionalscript#1819`.

### Phase 42: Take FunctionalScript 0.48.0
**Requirements**: MAINT-14 · **Tier**: T3 · **Status**: complete — milestone v6, shipped in PR #144 (merge `80b5e1e`)

---

## The milestone section as ROADMAP.md carried it

## Milestone v6: A Current Engine, Actually Current

**Why a second bump three days after the first.** 0.47.0 was taken on 2026-08-27 and
0.48.0 published 2026-08-30T19:06:59Z. Staying put was considered and rejected on two
grounds: the two breaking changes below are mechanical, and their cost grows with this
repository rather than shrinking; and Phase 41 adopts new capabilities, which written
against 0.47.0 would be written against a release already superseded before the phase
started. **Phases 39, 40 and 41 carry forward from v5 at their original numbers**, exactly
as 34–36 carried forward from v4, and for the same reason: the citations that address them
by number outnumber the tidiness gained by renumbering.

**Execution order: `42 → 39 → 40 → 41`.** Not numeric, and deliberately so — this file has
run a non-numeric order before (`19 → 18 → 17`) and records why each time. 42 comes first
because 39, 40 and 41 all read the release's behaviour before acting, and reading 0.47.0's
would mean reading it twice. 39 no longer needs anything from 42 on the negotiation itself —
0.47.0 already shipped `_negotiateVersion` and this repository simply never noticed — but its
proof is rewritten against whatever 0.48.0's `mcp` surface is, so it follows.

- [x] **Phase 42: Take FunctionalScript 0.48.0** - MAINT-14. `^0.47.0` does not admit 0.48.0
      — a caret on a `0.x` pins the minor — so this is an explicit bump. **Measured against
      `0fcb088` on 2026-08-30, before this phase was written**; the numbers are observations
      mainline must reproduce, not targets. 235 changed files upstream, 15 added, 7 removed;
      of the 50 upstream modules imported here, 28 changed and 5 moved. Two changes reach
      this code:

      1. **`rtti` relocated**, `fjs/types/rtti/…` → `fjs/rtti/…`, at **140 import sites**.
         The public constructor surface is unchanged — the only additions are two
         `_`-prefixed internals — so this is a path rewrite and must be nothing else.
      2. **`option` stopped being a function.** 0.47.0: `option = t => or(t, undefined)`,
         called `option(string)`. 0.48.0: `option = type0('option')`, used
         `or(option, string)`. **459 call sites across 34 files.** Upstream's own
         `revisionSchema` now reads `archived: or(option, true)`.

         **This section first said "596 across 59", and that figure counted prose.**
         `grep` matches `option(` in a docstring and in a `todo/*.md` as readily as in
         code. Measured on the pre-transform tree: **562** occurrences in `.js` — 459
         calls, 102 docstring mentions, and one that is not rtti at all (`demo/steps/
         02-line16.js` builds an HTML `<option>` from `demo/lib/dom.js`, and the first
         sweep rewrote it before the import was checked) — plus **36** in markdown.
         Code is rewritten; the 138 prose mentions are corrected as documentation,
         because a docstring spelling the old form is wrong in a different way than a
         call site is.

      **The acceptance criteria are v5 Phase 38's, because Phase 38 is where this repository
      learned that compiling is not evidence.** The call-site `open()` experiment typechecked,
      passed the suite, and silently moved 47 served containers while presenting the smaller
      diff as proof. So:

      1. `package.json` names 0.48.0 explicitly and `tsc` reports **0** errors.
      2. **`toJsonSchema` over all 30 dialect schemas is byte-identical** to 0.47.0's output.
         This is the criterion that decides the phase. A rewrite of 459 `option(…)` sites is
         exactly the shape of change that can alter every served schema while looking
         mechanical — `option` is a *union member* now, not a wrapper, and getting the
         nesting wrong changes what the union admits.
      3. **The proof-leaf set may only grow.** Compare leaf-name SETS, not totals, with the
         recipe AGENTS.md documents; `comm -23 baseline-leaves.txt result-leaves.txt` must be
         empty. No touched module's assertion count may fall — `grep -cE '\bassert(Eq|NotNullish)?\(' <file>`
         before and after.
      4. The full battery holds at its current figures: `npm test` green, `test:integration`
         **13/13**, `test:ui` **46/46**, and **no file falls below 95%** on any of the three
         coverage metrics (the v5 close-out left 0 of 121 below).

**What v6 does NOT do.** It does not renumber 39–41, it does not touch phases 34–36 (still
T1, still blocked on the owner being in the room, still unscheduled against the engineering
work), and it does not advertise a second MCP protocol revision — see MAINT-10, where that
open sub-question is now answered: the software is unpublished, so there are no older
clients and backward compatibility buys nothing.

---

## Progress at close

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 39. Retire the Protocol-Version Gap | **v6** | 0/0 — no plans written | Complete (MAINT-10); three dangling citations removed, and the proof that could not have failed replaced by one that watches the negotiation | 2026-08-31 · PR #145 |
| 40. Validation on the Write Path | **v6** | 0/0 — no plans written | Complete (DOC-25); `cas_add` now refuses content that declares a finance dialect and does not satisfy it | 2026-08-31 · PR #146 |
| 41. New Capabilities and the Migration Report | **v6** | 0/0 — no plans written | Complete (MAINT-11 partial / MAINT-12 / MAINT-13); the `fjs web` half of MAINT-11 is blocked upstream on a 131072-byte ceiling, filed in `fjs/todo/` | 2026-08-31 · PR #147 |
| 42. Take FunctionalScript 0.48.0 | **v6** | 0/0 — no plans written | Complete; 140 rtti sites and 459 `option` calls rewritten, all 30 served schemas byte-identical | 2026-08-31 · PR #144 |

Reordered to execution order — `42 → 39 → 40 → 41` — the table above is numeric because
ROADMAP.md's is.

**Carried forward and advanced inside v6's window, but owned by v5.** The milestone section
above says in so many words that v6 "does not touch phases 34–36". The calendar disagreed:
all three ran on 2026-09-07/08, once the dependency gate on 35 cleared and once 34 and 36
were reframed around what is achievable without the owner in the room.

| Phase | Outcome | Landed |
|---|---|---|
| 34. Second-Implementation Cross-Check | **Still open.** 8,371 comparisons, 0 disagreements with Pub 17 and a TY2025 commercial engine, 4 with the IRS's own ATS scenarios that resolve against the source. No document read end to end; the owner-facing diff harness is written and waiting | 2026-09-08 · PR #155 |
| 35. A Filable Artifact | **Complete.** The engine's own lines fill the IRS's `f1040.pdf`; the header identity block is named as deliberately unfilled, so a filer completes and signs before mailing | 2026-09-08 · PR #156 |
| 36. The Conversational Path | **Still open.** The answer is reached against a real server and 144 of 144 citations resolve, but the guest vocabulary is named nowhere on the MCP surface. The crash a wrong guess used to cause was fixed (PR #157); the vocabulary gap is not | 2026-09-08 · PR #154 |

---

## Milestone Summary

**Decimal phases:** none.

### Key decisions

- **Bump twice in four days rather than adopt into a superseded release.** 0.47.0 landed
  2026-08-27, 0.48.0 published 2026-08-30. Phase 41 adopts new capabilities; written against
  0.47.0 it would have been written against something already replaced. The cost of a
  mechanical migration grows with the repository, so it was paid early rather than deferred.
- **Execution order `42 → 39 → 40 → 41`, not numeric.** 39, 40 and 41 all read the release's
  behaviour before acting; reading 0.47.0's would have meant reading it twice. The file has
  run a non-numeric order before (`19 → 18 → 17`) and records why each time.
- **Byte-identity of all 30 served schemas is the criterion that decides Phase 42**, not a
  green suite. Phase 38 is where this repository learned that compiling is not evidence: an
  experiment there typechecked, passed, and silently moved 47 served containers.
- **DOC-25 closed at the write boundary (Option 1), not the note's preferred Option 2.**
  Reason recorded in `fjs/todo/no-dialect-validation-on-the-write-path.md`.
- **The standing upstream authority was written as an extension of the gap rule, not a
  replacement.** A gap still gets its `fjs/todo/upstream-*.md` record; that record is what the
  upstream request is written from. Both requests filed under it — `functionalscript#1893`
  and `#1900` — were written that way.

### Issues resolved

- The MCP protocol-version gap, and with it **a proof that could not have failed**: the old
  fixture requested a revision the server did not support, so negotiation and pinning returned
  the same value. Replaced by one that asks for a supported non-latest revision.
- Three dangling `fjs/todo/` citations pointing at files that had been deleted.
- **A malformed finance document could be stored, routed and computed from.** `cas_add` now
  refuses content that declares a finance dialect and does not satisfy it — proven by reading
  the store back and asserting the listing is empty, so a refusal *after* the write fails.
- `okResult`/`errorResult` hand-wiring replaced by `toolResultStep` at four sites.

### Issues deferred

- **Phases 34 and 36 stay open**, as they have since v4. Both are blocked on the same thing:
  a person at a real client, with real documents. Everything reachable without that person was
  executed on 2026-09-08 and is recorded above.
- **Whether the demo work becomes a requirement category of its own** — browser hand entry,
  generated forms, the client-side store, the `ui-tests` package, the measured palette. It
  coined no IDs, so there is nothing to retrofit and something to decide. Open since
  `v4-MILESTONE-AUDIT.md` F-01.

### Technical debt incurred

- **MAINT-11's `fjs web` half is unfinished and blocked upstream.** `fjs web` answers 413 for
  any file over one `Vec` (131072 bytes) and eleven of the demo's modules exceed it, the
  largest by 7.6×. `demo/serve.sh` therefore still runs `python3 -m http.server`, which is the
  functionalscript-only dependency rule not yet reaching its last place. Recorded in
  `fjs/todo/upstream-web-vec-size-limit.md`, filed as `functionalscript#1819` — **still open**,
  and correctly so: it closes when a consumer can serve a large file, not when a document
  describes how.
- **The milestone was executed direct-to-PR.** No `CONTEXT.md`, `PLAN.md`, `SUMMARY.md` or
  `VERIFICATION.md` exists for phases 39–42, and `STATE.md` was hand-marked `complete` before
  any gate ran. The audit was run afterwards rather than not at all, and ratifies the status —
  but *record ahead of verification* is the failure this repository keeps correcting, and it
  recurred here.
- **`paramSetHash` is a digest, not an address.** Statutory figures are traceable to a name
  where document-derived ones are traceable to bytes. `sourceArtifactHash` exists on only two
  of the thirty dialects.

---

_For current project status, see `.planning/ROADMAP.md` and `.planning/STATE.md`._
