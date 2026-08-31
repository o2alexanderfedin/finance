---
gsd_state_version: 1.0
milestone: v6
milestone_name: A Current Engine, Actually Current
status: planning
stopped_at: "Milestone v6 is open — MAINT-14 is coined and the five carried-forward v5 IDs keep their phase numbers (39, 40, 41). Execution order is 42 -> 39 -> 40 -> 41; 34, 35 and 36 remain blocked on the owner. Nothing is planned yet: run /gsd-plan-phase 42 next."
last_updated: "2026-08-31T06:51:35.086Z"
last_activity: 2026-08-31
progress:
  total_phases: 7
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-08-03)

**Core value:** The report is a program, not an answer — the agent emits FunctionalScript;
the server executes it as a pure function of `(documents, tax-year parameters) → report`.
**Current focus:** **The accountant demo** — give a working accountant a page they can feed real
documents to and get tax output back. That accountant has many clients, which is the route to real
data at volume. Filing the owner's own return is LATER, not the driver; Sergey is a partner, not an
audience — he authors FunctionalScript, the language this code is written in, and separately wants
to do his own taxes with this software.

Milestone v4's three roadmap phases remain blocked on the owner — 34 wants the taxpayer's documents
and a second filer, 35 wants one dependency approval, 36 wants a real client session. **But the
demo work below is not one of them, and is not in the roadmap at all** (see "Shipped outside the
ledger"). Nothing is in flight.

*(This line read "Phase 15 shipped, Phase 16 awaiting an owner decision" until 2026-08-20 — two
milestones stale, while `last_updated` said 2026-08-17 and the `stopped_at` field directly above it
narrated events of 2026-08-19. A timestamp older than the text it stamps is the cheapest possible
tell, and nothing was watching for it. It then read "Milestone v4, all three phases blocked on the
owner … nothing is in flight" until 2026-08-23 — technically true of the ROADMAP and materially
false about the project, because five PRs of product work had shipped in the meantime and no
planning file mentioned any of it. **"Nothing is in flight" is the most dangerous sentence in this
file: it is what a stale document says whether or not it is true.**)*

## Session

Status: planning — milestone v5 is open and Phase 38 is the only phase unblocked
Stopped at: Milestone v5 is open — requirements MAINT-09..13 and DOC-25 are defined and its seven-phase roadmap is written. Only Phase 38 is unblocked; 39 and 40 both need 0.47.0 in place and unlock when 38 lands, 41 follows both; 34, 35 and 36 carry forward from v4 still blocked on the owner.
Progress: [░░░░░░░░░░] 0%
Last activity: 2026-08-27

*(0% is 0 of milestone v5's 7 phases. The `89%` this line carried was v4's 34 of 38, and the
`100%` that briefly replaced it was written by `state.sync` — see "GSD milestone scoping is inert
here" in Recurring Patterns — whose hand-correction fixed the frontmatter to `7 / 0 / 0%` and
missed this line. **The body line is not what the header is built from**: `buildStateFrontmatter`
reads `Progress:` only as a fallback, `if (progressPercent === null && progressRaw)`, and
`computeProgressPercent` returns null only when there is neither phase nor plan data. It is
corrected here because a line reading 100% beside a milestone with nothing started is false to a
reader, which is the failure this file exists to catch.)*

**These four lines are written for the tool, and they must stay the first of their kind in this
file.** `gsd-sdk` rebuilds the frontmatter above out of *this body* on every write —
`buildStateFrontmatter` takes the **first** `Status:`, `Stopped at:`, `Progress:` and
`Last activity:` line it can find, and until 2026-08-25 the first of each lived in the archival
block 150 lines below. So every `gsd-*` command quietly restamped the header with Phase 18's state
from 2026-08-19: `status: verifying` (from the word *VERIFICATION* in a 2026-08-14 sentence),
`stopped_at: Phase 18 planned, zero plans executed`, and `last_activity` walking **backwards**. It
was caught and hand-reverted twice before anyone went looking for the cause; the cause was never a
hook — hooks only read this file. Put another `Status:`, `Stopped at:`, `Progress:` or
`Last activity:` line above these and the damage resumes.

**The tool was repaired on 2026-08-25 and this section is now a record, not a warning.** Five
defects in `~/.claude/get-shit-done/bin/lib/` were reproduced and fixed, with 17 regression tests
at `~/.claude/tests/gsd-state.test.cjs` and the diffs kept under
`~/.claude/gsd-local-patches/state-md-corruption/`. Two of the five were silent data loss: a body
write matched the frontmatter key of the same name case-insensitively — `Progress` hit `progress:`,
the parent of a nested block, and **deleted `total_phases` by consuming the following line** —
while `Status` edited the header and left the body stale so the next resync copied the stale body
back. Run the tests after any GSD update; a reapplied patch that lost a hunk is the expected way
this returns.

**`completed_phases` used to be a different quantity than its name suggests, and now is not.**
`v4-MILESTONE-AUDIT.md` F-02 (2026-08-20) ruled that the divergence "should not be reconciled",
because the field counted phase directories holding a SUMMARY and phases 1-33 largely shipped
without a directory at all — 16 of 38 against a measured 34. **That ruling is discharged.** The
field now reads the roadmap's checkbox ledger, which is what the audit said the truth was, so
there is no longer a second number to refuse to reconcile.

**Two of this file's own figures were wrong, and the repaired tool is what found them.**

| | said | is | why |
|---|---|---|---|
| `total_phases` | 37 | **38** | `12` and `12.1` are two phases, not one — `12.1` has its own roadmap row *and* its own phase directory |
| `percent` | 92 | **89** | 34 of 38, not 34 of 37 |

The claim "Phase 12 is listed twice" that produced the 37 was an artifact of the command used to
check it: `grep -oE 'Phase [0-9]+'` reads `Phase 12.1` as `12`, so a distinct phase looked like a
duplicate row. Counted with the decimal, there are **no duplicate rows at all**:

```sh
ID='\*\*Phase [0-9]+(\.[0-9]+)?'
grep -oE "^- \[x\] $ID" .planning/ROADMAP.md | grep -oE '[0-9.]+$' | sort -uV | wc -l   # 34 complete
grep -oE "^- \[ \] $ID" .planning/ROADMAP.md | grep -oE '[0-9.]+$' | sort -uV | wc -l   # 3 open — 34, 35, 36
grep -oE "^- \[.\] $ID" .planning/ROADMAP.md | grep -oE '[0-9.]+$' | sort -uV | wc -l   # 38 total, incl. moved Phase 14
find .planning/phases -name '*-PLAN.md' | wc -l                                       # 88 — here the tool was always right
```

The plan counts were the reverse case and were corrected on 2026-08-25: the header claimed `89`
planned and `85` done against **88 and 88** on disk, and disk is checkable.

## Current Position

Phase: Not started (defining requirements)
Plan: —
Status: Defining requirements
Last activity: 2026-08-31 — Milestone v6 started

## Shipped outside the ledger — the accountant demo, 2026-08-21

**This section exists because nothing else records this work.** Five PRs merged on 2026-08-21 and
none of them has a requirement ID, a roadmap row, or a phase directory. The check that found it:

```sh
grep -rl 'entry.html\|IndexedDB\|ui-tests\|form_model\|subjectKey\|FORM-KEY' .planning/   # was empty
```

| PR | What shipped |
|---|---|
| #124 | Hand-enter documents in the browser. The form is **generated from each dialect's own rtti schema**, so form and validator cannot drift; `fjs/document/form_model` derives the field list, `fjs/document/registry` carries the 30 dialects. Storage is IndexedDB used as CAS + Evo (`demo/lib/store.js`); the engine runs client-side and **no network call exists on the path**. `fjs/guest/store_view` serves the four guest operations, so the browser runs the same guest program `fjs_run` executes. |
| #125 | Browser automation as a **separate npm package** (`ui-tests/`) — the owner's approval on 2026-08-20 was explicitly "as a separate npm package", so the shipped `finance` package carries no browser driver. 31 tests, plus a coverage floor asserted on the two files no proof can reach. |
| #126 | The root `tsc` was type-checking `ui-tests/`, which made the local build falsely green and CI red. |
| #127 | A **measured** colour-blind-safe palette — Okabe–Ito, WCAG 1.4.3 and 1.4.11 read from `getComputedStyle` on the live page in both schemes, and a test that strips colour entirely and asserts success and refusal still differ by their text. |
| #128 | **FORM-KEY-01/02.** Each dialect declares its own `subjectKey`, so `formSubject` no longer assumes every form spells its identity fields identically; eleven of them then renamed those fields to what the printed form actually calls them (W-2 box b is `employerEIN`, not `payerTin`). Subject strings are byte-identical: the declaration moved, the values did not. |

**Eleven were renamed, not twenty-two.** The workflow's own summary claimed twenty-two; measuring
every `subjectKey` in the tree gives eleven (`w2`, `1095a`, `1098e`, `1098t`, `farm`, `form3921`,
`form3922`, `k1_1041`, `k1_1065`, `k1_1120s`, `ssa1099`). The other eleven in its list are the 1099s — whose
printed face really does say PAYER'S TIN and RECIPIENT'S TIN — and internal dialects that transcribe
no form at all and so have no caption to defer to. **The outcome was right and the report was
wrong**, which is the more dangerous of the two failures: merging on the strength of that summary
would have recorded eleven renames that never happened.

One residual is filed honestly at `fjs/document/todo/subject-key-roles-are-unpinned.md`: a
`subjectKey` is pinned to fields that EXIST, never to the RIGHT ones, so a role naming a real-but-wrong
field passes every check. Found by mutation during the branch's own verification.

**Upstream: `functionalscript#1649` was approved and merged by sergey-shandar on 2026-08-21**, after
six review rounds and 15 findings — every one verified against the source before being accepted, and
three answered with a remedy *different* from the one proposed (the `childReadAny` EOF rule, the
loser-preservation rule that needed no cancellable waiter, and the listener unsubscribe that had to
cover the winner's sibling as well as the loser's pair). The Deno `--allow-run` question was handed
back as a spec obligation rather than a unilateral change to his CI posture, and he merged it in
that form.

**What this costs, stated plainly:** the ledger describes the engine; the accountant-facing
product it has acquired is largely invisible to it.

**Closed on 2026-08-25, in part.** `FORM-KEY-01` and `FORM-KEY-02` are registered — the two IDs
the code had actually coined, cited 65 times across 36 files while `REQUIREMENTS.md` had never
heard of them. The reason nobody noticed is now itself a check: the citation gate scanned ten
hand-typed prefixes and the test guarding that list compared it against `REQUIREMENTS.md`, where
the prefix was equally absent, so **both sides agreed and both were wrong**. A prefix living only
in the code was invisible to a check that asks the code and the document whether they match.
`planning-truth-gate.test.js` now classifies every ID-shaped prefix in the tree as a requirement
or as a declared non-requirement, and the count is 129/129.

**Still open, and it is a scope question rather than a bookkeeping one.** The rest of the demo —
browser hand entry, generated forms, the client-side store, the `ui-tests` package, the measured
palette, demo mode — coined no IDs at all, so there is nothing to retrofit and something to
*decide*: whether these become a requirement category of their own (a `UI-*` block) or stay
product work the requirement set deliberately does not cover. That is the owner's call, not an
agent's, and it is the same call `v4-MILESTONE-AUDIT.md` F-01 left open for phases 34-36.

## Earlier milestones

All ten v2 phases shipped 2026-08-16/17 as PRs #71–#82, plus post-milestone gap-closure work
committed under `31-*` and `32-*` prefixes. **All four personas from
`.planning/PERSONA-COVERAGE.md` compute**: retiree, non-profit worker, FAANG engineer, startup
founder.

> **Phases 31 and 32 are now IN ROADMAP.md** — added 2026-08-17. They had been absent from it
> entirely while being cited by name in REQUIREMENTS.md, CAPABILITIES.md and in code docstrings:
> gap-closure work that closed TAX-32 (Form 8995-A), TAX-29 (Form 8606 Part II), MAINT-01 (the
> OCR island) and TAX-27 (the Earned Income Credit), all run after the milestone was declared
> closed, which is exactly when a phase is least likely to be written down. Derive the count
> rather than reading one: `grep -cE '^- \[[ x]\] \*\*Phase ' .planning/ROADMAP.md` — 33 entries
> (1-30, the inserted 12.1, and 31-32).

> **Every tax requirement is closed, including the ones that stayed open longest.** TAX-27 was
> open for seven phases because the Schedule 8812 dependent model really did carry almost none of
> §32(c)(3); the spec in `fjs/todo/tax-27-earned-income-credit.md` really was the honest output
> until the facts it asked for existed. Phase 32 added them — ten checked vocabularies on
> `vnd.fjs.return_profile` — and `fjs/schedule/eic` computes the credit to 1040 line 27a.
> TAX-29's Form 8606 Part II computes, so a backdoor Roth works; Part III's nonqualified
> distributions still refuse by name. TAX-35's routing shipped: sixteen K-1 boxes across three
> faces, each with a fixture where the destination moves by exactly the K-1's contribution.
>
> **A tick that needs a paragraph of caveats is a tick that should not be there.** Phase 25 once
> checked TAX-27 while its own prose said the credit was not computed; that was corrected, and
> every phase after it held the line until the credit actually computed.

**The v1 maintenance debt is closed, and an earlier version of this paragraph got that wrong.**
It read that Phase 17 "never started" and that Phase 18's plans were unexecuted. Both are false,
and `git log` says so: **Phase 16** was resolved by REMOVAL (MAINT-01 — `from_ocr` and
`ocr_amount` deleted, the `vnd.fjs.ocr` dialect kept); **Phase 17** shipped as PR #84 (`948a61b`,
03:26 PDT 2026-08-17); **Phase 18** shipped as PR #87 (`0fecdfb`, 14:10 PDT), with MAINT-07 and
MAINT-08 verified in code and only MAINT-06's *intent* blocked upstream. ROADMAP.md's checkboxes
for 16, 17 and 18 were simply never ticked, which is the whole reason they read as outstanding.

**One deferral did cost something, and its mechanism is worth keeping.** Phase 18 deferred a
stale comment in `fjs/server/module.f.js` to Phase 17 — writing that note at 21:10 PDT, seven
hours AFTER Phase 17 had already completed. A deferral aimed at a finished phase is collected by
nobody. The comment survived until a truth pass found it independently that evening, by which
point it also cited a deleted file and contradicted an import fourteen lines above it.

### The previous position, kept because it is still the shape of the work

Phase: 20 (unemployment-compensation) — **COMPLETE, VERIFIED AND MERGED**
  0 plans; none were written. The `vnd.fjs.1099g` dialect and the Schedule 1 line 7 wiring were
  built on 2026-08-14 outside the GSD structure, in response to a real IRS transcript the scope
  guard **correctly refused**, and retrofitted into the record on 2026-08-15 as `DOC-18`/`TAX-18`
  and Phase 20 — labelled RETROFITTED, not presented as planned.
Plan: n/a — the `0/0` in ROADMAP's progress table is literal, not a placeholder.
Status: **Shipped.** `20-VERIFICATION.md` scores **5/6 criteria MET, 1 PARTIAL**, and the PARTIAL
  was a **surviving mutant**: erasing the destination from a refusal message left the whole suite
  green, because five proofs asserted the box name and none asserted where the amount would have
  gone. Fixed, watched to redden, restored byte-identical. Both `human_needed` items were closed
  the same day — the real transcript re-fed through the full `form1040Report` entry point (line 8
  = $4,554.00, line 25b = $454.00, both **citing** the 1099-G's boxes), and boxes 10a/10b modelled
  so box 11's "a state return would want it" justification finally holds.
  Merged to `develop` via **PR #68** on 2026-08-16, carrying Phase 18's planning commits with it.

Next phase: **21 — The Last Mile** (milestone v2). `form1040Report` has **no production caller**;
  the proven engine and the proven execution spine have never been joined. **The obvious
  implementation is forbidden** — a server tool that assembles inputs and calls the engine is the
  `finance_compute_1040` tool REQUIREMENTS.md rules out. The route that preserves the thesis is
  `guestCtx`, which already carries pure non-effect helpers beside the four frozen CAS commands.
  **Phase 22 (computable tripwires) is a hard prerequisite for 23-30 and must not be reordered.**
  Phases 16 (deferred), 17 and 18 (planned, zero executed) remain open from v1.

Progress: [████████░░] 80% — **16 of 20 phases**, v1. Milestone v2 adds 10 more (21-30), 0 done.
  Phase-based, never plan-based. Requirements are **95 in v1 (87 complete)** plus **29 in v2**,
  124 in the document, counted separately so v2 does not move v1's figure. Every one of those
  counts is derived by a command recorded beside it in REQUIREMENTS.md, not transcribed.
  (Note 14 is skipped and 16 deferred by owner decision, so 16 of the 18 *achievable* v1 phases
  = 89%; the 80% figure is kept because 20 is what ROADMAP declares.)
Last activity: 2026-08-19

> **This block has now been wrong FOUR times, always in the same direction: stale text left
> under a newer heading.** The fourth was found on 2026-08-16 during a post-merge sweep: it still
> carried **Phase 15's** text — PR #63, "6 plans across 2 waves", "Next phase: 16" — while the
> frontmatter directly above it read `completed_phases: 16` and three further phases had shipped.
> **The frontmatter and the prose disagreed for four days and nothing compared them.** That is the
> same defect as every count in this project that was true of the part someone examined: two
> statements of one fact, no check between them. It carried Phase 10's text under a 12.1 heading until 2026-08-09;
> it carried Phase 12.1's wave breakdown under a Phase 13 heading until 2026-08-11; and on
> 2026-08-12 it was found carrying **Phase 13's** text (`13-VERIFICATION.md`, PR #62, "13 plans
> across 5 waves") under a **Phase 15** heading, reading EXECUTING for a phase that was
> complete, reviewed, verified and merged.
>
> **The third recurrence has a known mechanism, which the first two did not.** `git log` shows
> the last writer was `f59b6a3` — the `15-06` plan executor. A correction made earlier in the
> same session was overwritten by the next agent to touch this file, because the per-plan
> state update rewrites the header without reading what it replaces. Correcting the text again
> without recording that will simply schedule a fourth occurrence.
>
> **Do not read this block and believe it. Measure:**
> ```
> ls .planning/phases/*/*-PLAN.md | wc -l                          # plans written
> ls .planning/phases/*/*-SUMMARY.md | grep -v FIX | wc -l         # plans executed
> git log --oneline -1 -- .planning/STATE.md                       # who wrote this last
> ```
> A mismatch between the last writer and the phase named above means the block is stale again.

> **Known artifact gap (not a work gap):** `05-05-SUMMARY.md` exists with no `05-05-PLAN.md`
> beside it — the only such mismatch in the project. The work shipped (ROADMAP records Phase 5
> as 5/5); the plan file is simply absent. This is why "plans executed" reads 82 against 81
> `*-PLAN.md` files on disk.

### Test metrics — MEASURE, do not read

**Do not quote a test count from this file.** Run the commands:

```
npm test                                        # tsc && node --test
npm run test:integration                        # real-process subset (also included in npm test)

# project-local proofs — the ONLY honest metric. MUST be de-duplicated:

node --test 2>&1 | grep '^✔ import("./fjs/' | sed 's/ ([0-9.]*ms)$//' | sort -u | wc -l
```

**The `grep -c` form of that last command double-counts and was wrong from the day it was
written here.** Corrected 2026-08-11 from measurement. When the `functionalscript` submodule is
initialized, `node --test` discovers *its* `all.test.js` as well as this repo's, and the
submodule's emergent-testing entry re-scans the same working directory — so every finance proof
is executed and printed **twice**. Measured on `e36ef1a`: `grep -c` reports **1690**, the
de-duplicated count is **845**, and CI (which never checks out the submodule) reports **845**.
The full local run is 6166 = 845 + 845 + 4472 submodule proofs + 4 root-level tests.

Anything quoting the `grep -c` figure — including this file's own history — overstated
project-local proofs by exactly 2x.

Pasted counts were kept here through Phases 7-9 and went stale every single time, including once
*after* a note was added saying they go stale. The note did not help; removing the numbers does.
Only landmark figures are worth recording, because they are historical facts rather than current
state:

| Landmark | Project-local proofs | How measured |
|---|---|---|
| End of Phase 7 | 185 | `grep -c` — **suspect**, see below |
| End of Phase 9 | 260 | `grep -c` — **suspect**, see below |
| End of Phase 13 | 845 | de-duplicated; independently confirmed by CI |
| End of Phase 19 | 916 | de-duplicated; `node --test 2>&1 \| grep '^✔ import("./fjs/' \| sed 's/ ([0-9.]*ms)$//' \| sort -u \| wc -l` |

The two older figures were taken with the double-counting `grep -c` command. Whether they are
inflated depends on whether the submodule was initialized in that session, which is not
recorded — so treat them as an upper bound, not a fact. They were not re-derived here because
doing so means checking out old commits, which is a task of its own, not a resume-time aside.

**Never gate on `npm test`'s total.** It includes ~2,100 vendored `functionalscript` submodule
proofs and moves with submodule initialization state — which is exactly how a Phase 7 gate
("total > 134") came to be satisfied before a single line of that phase's code was written.

## Performance Metrics

**Velocity:**

- Total plans completed: 65 (see the per-plan table below; this line read 0 until 2026-08-09 while the table listed 40+ entries)
- Average duration: —
- Total execution time: 0.0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

**Recent Trend:**

- Last 5 plans: —
- Trend: —

*Updated after each plan completion*
| Phase 04 P02 | 25min | 3 tasks | 2 files |
| Phase 07 P01 | 20min | 2 tasks | 1 files |
| Phase 07 P02 | 25min | 2 tasks | 1 files |
| Phase 07 P03 | 20min | 2 tasks | 1 files |
| Phase 07 P04 | 13min | 2 tasks | 1 files |
| Phase 07 P05 | 45min | 2 tasks | 3 files |
| Phase 07 P06 | 55min | 2 tasks | 1 files |
| Phase 07 P07 | 40min | 2 tasks | 1 files |
| Phase 07 P08 | 50min | 2 tasks | 1 files |
| Phase 07 P09 | 20min | 2 tasks | 2 files |
| Phase 08 P01 | 25min | 2 tasks | 1 files |
| Phase 08 P02 | 45min | 3 tasks | 1 files |
| Phase 8 P03 | 25min | 2 tasks | 1 files |
| Phase 08 P04 | 25min | 2 tasks | 3 files |
| Phase 09 P01 | 20min | 2 tasks | 1 files |
| Phase 09 P02 | 15min | 2 tasks | 1 files |
| Phase 09 P03 | 35min | 2 tasks | 1 files |
| Phase 09 P04 | 50min | 3 tasks | 3 files |
| Phase 09 P05 | 35min | 3 tasks | 2 files |
| Phase 09 P06 | 25min | 3 tasks | 3 files |
| Phase 09 P07 | 65min | 3 tasks | 4 files |
| Phase 08 P06 | 65min | 3 tasks | 3 files |
| Phase 09 P08 | 45min | 3 tasks | 5 files |
| Phase 10 P07 | 35min | 2 tasks | 1 files |
| Phase 10 P08 | 55min | 2 tasks | 1 files |
| Phase 10 P09 | 75min | 2 tasks | 1 files |
| Phase 10 P10 | 95min | 3 tasks | 1 files |
| Phase 11 P01 | 30min | 3 tasks | 2 files |
| Phase 11 P02 | 20min | 2 tasks | 1 files |
| Phase 11 P03 | 30min | 2 tasks | 1 files |
| Phase 11 P04 | 20min | 1 tasks | 1 files |
| Phase 11 P05 | 20min | 1 tasks | 2 files |
| Phase 12 P01 | 20min | 2 tasks | 1 files |
| Phase 12 P02 | 21min | 2 tasks | 1 files |
| Phase 12 P03 | 20min | 1 tasks | 1 files |
| Phase 12 P04 | 35min | 1 tasks | 1 files |
| Phase 12 P05 | 35min | 3 tasks | 2 files |
| Phase 12.1 P01 | 35min | 2 tasks | 1 files |
| Phase 12.1 P02 | 55min | 2 tasks | 1 files |
| Phase 12.1 P03 | 35min | 2 tasks | 1 files |
| Phase 12.1 P04 | 70min | 3 tasks | 9 files |
| Phase 13 P01 | 35min | 2 tasks | 3 files |
| Phase 13 P02 | 100min | 3 tasks | 6 files |
| Phase 13 P03 | 35min | 2 tasks | 3 files |
| Phase 13 P04 | 25min | 3 tasks | 2 files |
| Phase 13 P05 | 25min | 2 tasks | 3 files |
| Phase 13 P06 | 35min | 2 tasks | 4 files |
| Phase 13 P07 | 70min | 3 tasks | 6 files |
| Phase 13 P08 | 30min | 2 tasks | 2 files |
| Phase 13 P09 | 55min | 1 tasks | 2 files |
| Phase 13-the-65-profile-and-the-remaining-schedules P10 | 11min | 3 tasks | 3 files |
| Phase 13-the-65-profile-and-the-remaining-schedules P11 | 30min | 2 tasks | 3 files |
| Phase 13 P12 | 35min | 2 tasks | 1 files |
| Phase 13 P13 | 20min | 3 tasks | 8 files |
| Phase 15 P01 | 35min | 3 tasks | 3 files |
| Phase 15 P02 | 40min | 3 tasks | 3 files |
| Phase 15 P03 | 45min | 2 tasks | 4 files |
| Phase 15 P04 | 50min | 2 tasks | 1 files |
| Phase 15 P05 | 55min | 2 tasks | 5 files |
| Phase 15 P06 | 55min | 3 tasks | 4 files |

## Accumulated Context

### Decisions

Full log in PROJECT.md Key Decisions. Recent decisions affecting current work:

- [Scoping]: TY2025, stdio → Claude Code/Desktop, maximal taxpayer profile (65+, brokerage
  sales, dependents, itemizes). Remote transport is an explicit v2 milestone.

- [Scoping]: Entry point is a distinct export typed `(args) => Effect<CasOp, T>`, not
  `main` — answers open question 6, puts the whitelist in the type.

- [Research/OQ5]: The **tool handler** writes result + run record to CAS; the guest
  whitelist stays read-only. `casWrite`/`evoAdd` are never in it.

- [Research/OQ2]: Subjects are content-derived — artifact chain rooted at the cBase32 hash
  of the original artifact; each extracted form instance keyed on
  `(payerTin, recipientTin, accountNumber, taxYear, formType)`.

- [Research/OQ3]: The OCR artifact is stored, not transient.
- [Roadmap]: `todo/plan.md`'s Weeks 1–5 are milestones; phases are sliced under them.
  Week 0 (corrections + integration smoke test) is added in front.

- [PR #17, Sergey]: **Money in a stored JSON document is a `string`, never a JSON number.**
  Now an absolute rule in AGENTS.md, covering documents, tax-year parameters, intermediates
  and reports. Rationale: a JSON number is an IEEE 754 double by the time `media/json`'s
  `Unknown` sees it. The rtti field is `string`; exactness is enforced in the semantic
  check, mirroring how `vnd.fjs.revision` types `hash` as `string` and defers to `isHash`.
  Note the tokenizer is *not* the lossy layer — `NumberToken` carries an exact `BigFloat`
  mantissa/exponent; precision dies one layer up.

- [PR #17, Sergey]: The exact-decimal module is now `todo/plan.md` **Week 1 step 6**
  (bigint-backed minor units, rates as explicit numerator/denominator pairs), gating the
  document base at step 5. OCR renumbered 6→7, ingestion 7→8. This matches ROADMAP Phase 4
  gating Phase 5 — convergent, no new phase and no schedule change.

- [Phase 04-02]: decimal module kept fully generic (scale as parameter, zero finance-specific content) so it is liftable into FunctionalScript unchanged
- [Phase 04-02]: parse refuses over-precision and non-numeric input via assert, never rounds/truncates/coerces
- [Phase 04-02]: no Money/Cents wrapper type: cents are exactly what centsFromString returns, a plain bigint with no construction path that could round

- [Phase 05-01]: `base` is generic (`<D extends string>`) so the dialect **literal** survives into
  the derived type. The non-generic `(dialect: string)` form let a deliberately wrong literal pass
  `tsc` — without the generic form, criterion 1's structural rejection is unprovable.

- [Phase 05-02]: `corrected: option(true)` mirrors revision's `archived`. A `corrected: false` blob
  is rejected structurally; absence is the only way to say "not corrected". One representation.

- [Phase 05-03]: comma degrouping lives in `fjs/document/ocr_amount`, one step OUTSIDE
  `fjs/types/decimal`, which keeps refusing `"1,234.56"`. That module is generic and staged for
  upstreaming; comma grouping is a US printed-form presentation convention. Teaching the generic
  parser about it would ship a locale convention upstream.

- [Phase 05-03]: identity fields come from the caller's `meta`, never re-parsed from `ocr.fields`.
  Deriving a TIN or tax year from unstructured OCR text is inference; this phase stores and reads.

- [Phase 05-05, user-directed]: W-2 box 12 is a list of `(code, amount)` pairs, never four slot
  fields — the slot carries no meaning, the code does, and a code can legitimately repeat.
  Boxes 15-20 are a repeating array stored faithfully and never computed on; the "never computed
  on" half is a live constraint on every phase that computes, enforceable only there.

- [Phase 05-05, user-directed]: `vnd.fjs.medical_expenses` is taxpayer-asserted, not transcribed
  — no IRS form reports out-of-pocket medical spend. It therefore has NO `formRevision`, and
  DOC-10's text was narrowed to "every dialect that transcribes a printed IRS form" rather than
  the requirement being silently violated. No stored total, no 7.5% floor: both need an AGI the
  document cannot see.

- [Phase 06-01]: `CasOp` is OURS, not fjs's. The roadmap and REQUIREMENTS both write
  `Effect<CasOp, T>` as though it were upstream; it is not. fjs has `FileCasOperation`, which
  contains `WriteBytes`/`Rename`/`Rm` — handing it to a guest hands it the store.

- [Phase 06-01]: the entry point is `report`, curried `ctx => args => Effect<CasOp, T>`. EXEC-07's
  `(args) => …` and criterion 2's "injected ctx, zero imports" reconcile only if ctx is a
  parameter — a CAS blob cannot resolve bare specifiers.

- [Phase 06-01]: a negative TYPE property is asserted as a conditional type inside the passing
  build, never as a negative-compile harness. Verified by widening `CasOp` to include `Fetch`:
  TS2322 at the assertion, plus TS2741 on the host map. No second tsconfig, no `@ts-nocheck`.

- [Phase 06-02]: an ORDERING guarantee is proven by observing the side effect the ordering
  prevents, never by which error message came back. See the blocker note below.

- [Phase 07-01]: guestCtx widened with step/pure/centsFromString/centsToString per 07-CONTEXT.md Decision 1; CasOp and casOpNames stay byte-for-byte unchanged — The widening is additive to ctx only, never to the operation vocabulary match dispatches on; step/pure are pure data composition and never become a command.
- [Phase 07-01]: vocabularyIsFrozenAtFour split into three independently falsifiable assertion groups instead of one collapsed equality — A single Object.keys(guestCtx) === casOpNames check would fail forever once ctx grew; the fix keeps casOpNames.join(',') a live, unchanged equality (a fifth command name still fails it) while separately asserting per-name presence and per-combinator typeof.
- [Phase 07]: vnd.fjs.run's status is exactly or('ok','error'), mirroring Result's two arms, per 07-CONTEXT.md
- [Phase 07]: inputs[].payload modelled as array(string) since every frozen CasOp command takes a single string argument
- [Phase 07]: finance_schema's dialectSchemas map is typed as an open string-keyed map ({ readonly [dialect: string]: Type }), not the narrower literal-key type TS infers from computed properties — indexing the inferred/unknown-cast lookup by a request-supplied string produced TS's lossy '{} | null' type, which toJsonSchema rejects
- [Phase 07]: sizeGuard measures byte length via tryUtf8 + bit_vec length/8 (matching writeResponse's own byte-cap measurement), never content.length
- [Phase 07]: Ordering proof asserts absence of raw oversized content in stdout, not just presence of the too-large message (SEC-02-before-import_ lesson)
- [Phase 07-05]: evoList's guest argument is 'true' selects archived, else active (mirroring Evo.list default)
- [Phase 07-05]: buildRunSnapshot resolves every hash cas.list() returns (whole-store), not a narrower reachability subset
- [Phase 07-06]: loadProgram is called with the bare programFileName(hash), not the full materialize path — matches fjs/guest/materialize's documented virtual-harness limitation; production wiring is Plan 09's follow-up
- [Phase 07-06]: executeRun/fjsRunTool typed against concrete FileCasOperation, not a generic <O extends Operation> — curried generics resolve O at the first application; the plan's curry order puts a non-O parameter first, which empirically defeats inference
- [Phase 07-07]: Session survival for EXEC-12 is proven via a second fjsRunTool.handle call against the SAME threaded virtual State, not a full financeMcpServer session -- fjsRunTool is not yet wired into that server (Plan 09's follow-up)
- [Phase 07-07]: missingHashBecomesErrorResult uses a syntactically valid but unwritten cBase32 hash, distinct from 07-06's own malformed-hash proof, to exercise the genuine CAS-miss branch rather than duplicate the null-hashVec short-circuit
- [Phase 07]: 07-08: Flat registry concatenation — financeSchemaTool/fjsRunTool unify into financeMcpHandlers's operation union with zero casts — Confirms the plan's own expectation that the two tools' operation types unify cleanly; no widened signature beyond fjsRunTool's own declared Mkdir|WriteFile|Import
- [Phase 07]: 07-08: weekOneConvergence seeds all three 1099-INT revisions before building the Evo cache — Opposite ordering from casRefresh's own proof (which builds the cache before its seed to demonstrate invisibility) — this proof's goal is an ordinary already-populated store, not the refresh-lever scenario
- [Phase 07]: 07-08: Verified the absent-vs-coerced-to-zero distinction is load-bearing — Temporarily forced centsFromString(undefined) by removing the skip check, confirmed the leaf fails with isError:true, then reverted — proves the leaf checks skip logic, not merely the final sum
- [Phase 07-09]: Fixed fjs_run's real working-directory gap at the test-harness spawn level (cwd = materializeHome(home)), not in executeRun, to avoid breaking every existing virtual proof of executeRun/fjsRunTool
- [Phase 07-09]: Seeded CAS content through the real cas_add MCP tool over the live session rather than a separate CLI subprocess; cas_add auto-syncs recognized vnd.fjs.revision blobs into the live Evo cache
- [Phase 08-01]: Standard deduction cites Rev. Proc. 2025-32 §3.01 (OBBBA revision); aged/blind additional, dependent cap, ordinary brackets, and capital-gains breakpoints cite Rev. Proc. 2024-40 alone, unmodified
- [Phase 08-01]: ratePercent stored as a plain number, not a decimal string — it is a rate, not a dollar amount crossing the money boundary
- [Phase 08]: generateRow rounds to the nearest whole dollar (Publication 1040's own printing convention), not nearest cent, before re-expressing in cents — The plan's literal formula would round at cents precision, reproducing $1,802.50 instead of the required $1,803.00 for the MFJ $18,000 row -- verified by hand against all ten transcribed rows before trusting it
- [Phase 08]: T-08-01 mutation-verified: breaking the MFJ first bracket's rate (10 -> 11) turns the row-by-row diff red — Confirms the diff's expected side (hand-transcribed Pub. 1040 literals) is independent of the generator, not a tautology; reverted cleanly with an empty git status
- [Phase ?]: TAX-04 boundary proofs are generated data-driven over a 42-entry threshold inventory (allThresholds), never hand-written per-threshold, via a generic segmentIndex counter sharing no code path with the Tax Table's own tax-computation functions
- [Phase 08-04]: taxParamsByYear[2025] narrowed exactly once at module scope via assert; both the tool's taxParamsResponses map and the year2025Resolves proof leaf read from the single exported response2025 constant — Never a non-null assertion or cast; keeps the response as the single source of truth for both the handler and its proof. **Correction (Phase 09):** an earlier version of this line attributed the no-cast rule to AGENTS.md. It is NOT in AGENTS.md — that file mentions `@type` only to prefer `@import` over inline `@type {import(...)}`. The rule is a standing engineering directive for this work and it stands on its own merits (a cast over an indexed access discards the `| undefined` that `noUncheckedIndexedAccess` exists to compute), but citing AGENTS.md for it sends the next reader hunting for text that is not there
- [Phase 08-04]: Registry entry and fjs-run-integration.test.js call landed in one commit — 08-VALIDATION.md's ordering note: that test derives advertised/called tool sets from a live tools/list response at runtime, so a registry-only commit breaks npm test immediately
- [Phase 09]: [Phase 09-01]: ReportLine.sources is a non-empty TUPLE type, never a plain array — sources: [] also fails tsc, satisfying PROV-02's plural 'tuples' at the type level
- [Phase 09]: [Phase 09-01]: Extends<A, B> is defined locally in fjs/report/line/module.f.js, not reused from fjs/guest/module.f.js — that module's assertion tests exact union equality via Equal alone; this module's PROV-01 assertion tests structural assignability, which needs the tuple-wrapped [A] extends [B] conditional
- [Phase 09]: countNumericLiterals is REPORTED, never refused - always returns a plain number, never a Result, never throws on a program's own account
- [Phase 09]: A numeric literal inside a template literal's ${...} expression is undercounted (accepted risk) - harmless because this audit is reported-only, not the anti-hardcoding kill condition
- [Phase 09]: Each honesty case (identifier/string/template/comment/adversary) is its own proof leaf, never one aggregate assertion
- [Phase 09-03]: Zero-read gate implemented identically in executeRun and its test-mirror runExecuteRunViaFixture, computed at the point sourceText/source is already in hand
- [Phase 09-03]: vnd.fjs.run gained no new fields; readCount/literalCount are envelope-only fields in fjs_run's response, derived from data that already exists
- [Phase 09-04]: [Phase 09-04] Running the SAME JsModule fixture twice against evolving CAS state needs a second, functionally-identical program hash: runExecuteRunViaFixture always performs a real materialize write, which collides with the prior run's already-swapped-in JsModule function at the SAME path
- [Phase 09-04]: [Phase 09-04] The adversary () => pure({ line16: 9137 }) is stored VERBATIM as the perturbation gate's control fixture, proven to fail and to fail identically whether or not the document changes
- [Phase 09-05]: classifyRunOutcome extracted as one exported function (literalCount => (value, reads) => RunOutcome); executeRun and runExecuteRunViaFixture both call it — mutating it to reads.length === -1 turns antiHardcodingGate/zeroReadGate proofs RED (pass 256, fail 2), closing 09-VERIFICATION.md's BLOCKER
- [Phase 09-06]: classifyRunOutcome and RunOutcome moved to fjs/report/guard/module.f.js, joining line and audit as the three PROV-07 mechanisms fjs/report/ now holds together — the rule's only type dependency (Read from fjs/exec) had nothing to do with fjs_run's own CAS/MCP/orchestration concerns; mutation from the new home re-proved the antiHardcodingGate/zeroReadGate/integration-test binding survived the move
- [Phase 09-07]: E2's decisive pin-through-the-shipped-tool proof lives in fjs-run-integration.test.js, not the virtual proof file — fjsRunTool.handle cannot reach an 'ok' RunOutcome under fjs/effects/node/virtual in one call (the write/import representational split), so only a real separate process can exercise the shipped executeRun(...) call with subject+parents end to end
- [Phase 09-07]: E12's proof constructs a synthetic RunOutcome with a non-empty error-arm reads array rather than reproducing a real mid-chain refusal — no current production path retains reads on refusal (fjs/exec discards them), but handleRunOutcome's own contract to persist whatever reads it is given is independent of that fact
- [Phase 08]: Closed 9 mutation-sweep coverage gaps in fjs/tax/params, fjs/tax/table, and fjs/types/rational (08-06); all figures confirmed correct against Rev. Proc. 2024-40, no stored values changed
- [Phase 09-08]: Per-box exactness proofs generated from moneyBoxFields/stateLocalMoneyFields themselves (so a box added later is auto-covered), paired with an independently hand-typed expected count (so a box removed is still caught) -- mirrors fjs/tax/boundary's allThresholds/expectedThresholdCount idiom
- [Phase 09-08]: interpret's step-budget boundary measured empirically before writing the proof: chainOfLength(stepBudget-1) completes, chainOfLength(stepBudget) is refused, because completing it needs one more loop iteration than the budget allows to notice the chain went Pure
- [Phase 10]: 10-07: the modeled/unmodeled partition is a tsc property — Assert<Equal<Kind, ModeledKind | UnmodeledKind>>, so a declared kind classified nowhere fails to compile — verified by adding a 51st kind and by deleting a refusal entry; both stop at TS2344 on that assertion
- [Phase 10]: 10-07: scopeRefusal returns ScopeError, not the ScopeOutcome union — Plan 10-08 spreads it into its own error arm; the union would force a cast or a non-null assertion, both banned
- [Phase 10]: 10-08: Line16Outcome carries `method` on BOTH arms, and `tsc` enforces it (TS2322 when the tag is dropped) — the Schedule D branch refuses rather than computes, so without a tag on the error arm TAX-03's "a proof per branch" would be unprovable for one of its four branches
- [Phase 10]: 10-08: Line16Error is `ScopeError & { method }`, an intersection with fjs/return/scope's own refusal type rather than a re-spelled object literal, so a second declaration of "what a refusal is" cannot appear beside the one place it is built
- [Phase 10]: 10-08: level 2's three QDCGT bullets stay THREE separate `if` blocks sharing one closure — fusing them into one disjunction makes the dispatch-order mutation unrunnable, because 2e cannot be moved past 2a without reddening the very leaf that documents the swap's invisibility
- [Phase 10]: 10-09: sumBoxOverDocuments returns a BoxSum intermediate, not a ReportLine — line 2b must add two box sums before a line exists, and a box read over zero documents has no source, so PROV-01 forbids it being a line at all
- [Phase 10]: 10-09: the filing status is recovered by finding it in individualFilingStatuses rather than by a type predicate — a @type-annotated predicate over .includes is rejected by tsc (TS2322), and find returns the STORED member rather than the blob's string
- [Phase 10]: 10-09: line 12e cites filingStatus plus one box per checked 12d checkbox, exactly as planned; 12a-12c and earnedIncome determine the value but are cited only at document granularity — flagged for the phase owner, not widened, because 10-10 may pin the counts
- [Phase 10]: 10-10: Form1040Outcome's error arm declares readonly lines?: undefined — omitting the field does NOT make adding it a tsc error, because TypeScript's excess-property check against a union admits any property declared in any constituent
- [Phase 10]: 10-10: line 22's zero floor lives in its own named function: lines 19/20 are always profile-declared zeros in Phase 10, so the floor is unreachable through a whole report and would otherwise be an equivalent mutant
- [Phase 11-01]: 1099-R modeled against the fuller TY2026 box set (strict superset of TY2025); box 7c/7d and the 8a/8b split are documented as 2026-only, option-typed additions, harmless on a TY2025 document
- [Phase 11-01]: SSA-1099's payerTin is always stored as '' (no printed payer TIN exists) and accountNumber maps to Box 8's Claim Number; both proven by a round-trip leaf, not just documented
- [Phase 11-01]: Mutation Gate M2 confirmed: removing one entry from moneyBoxFields while leaving expectedMoneyBoxFieldCount unchanged is the correct mutation shape -- schema-generated coverage leaves cannot detect a removal on their own
- [Phase 11-02]: buildRunSnapshot's withBlobsAndRevisions/withHeads now exclude archived-flagged revisions from heads/revisions, closing the guest-vocabulary path (evoList('true') -> evoHead -> evoRevision -> casRead) to a retracted document; blobs and buildHostMap stay untouched (the honest, documented boundary)
- [Phase 11-02]: Mutation Gate M1 confirmed load-bearing: reverting the two filtering conditions reddens archivedRevisionUnreachable.adversarialAndControl with the predicted failure (archived hash resurfacing in heads); restored verbatim, suite green, git status clean
- [Phase 11]: MCP-08: one row per (subject, head) pair, not one per subject -- concurrent heads yield multiple rows sharing a subject
- [Phase 11]: MCP-08: 'unknown' is the sentinel dialect for a well-formed document with no dialect field (arbitrary, recorded pick per RESEARCH.md A2)
- [Phase 11]: MCP-08: finance_documents_list never validates against finance_schema's dialect registry -- an unregistered dialect tag is listed verbatim
- [Phase 11-04]: expectedKnownDialectCount bumped 5 -> 7 in one commit registering both vnd.fjs.1099r and vnd.fjs.ssa1099 together (both dialect modules already existed from Plan 11-01); guard verified load-bearing by mutating to 6 and watching everyRegisteredDialectIsCounted fail with [7, 6, ...], then restored
- [Phase 11-05]: financeDocumentsListTool inserted between financeTaxParamsTool and fjsRunTool in financeMcpHandlers, reusing the same evo/fileCas expressions the surrounding lines already construct
- [Phase 11-05]: Same-commit ordering constraint (finance_documents_list registry entry + integration test call) verified live by mutation: commenting out only the call/assert block reddened toolsCalled/advertisedTools with the predicted diff, then restored byte-identical
- [Phase 12]: vnd.fjs.1099div: sourceArtifactHash required (not option), validated via isHash, kept off the shared base() helper
- [Phase 12]: DOC-06 shape proof uses a JSDoc @import type-only reference to QdcgtInput plus a runtime assertEq -- no runtime import of the QDCGT worksheet, dispatch, scope, or form1040 aggregation
- [Phase 12]: Boxes 8-11 (profit-or-loss) reuse the shared negative-accepting moneyFieldError loop rather than a separate check
- [Phase 12]: applicableCheckboxOnForm8949 stores the payer-printed A-F letter verbatim, never derived from boxes 2/5/12 (Phase 12.1's job)
- [Phase 12-03]: No checkReferences cross-field rule links the four new foreign-account fields to each other or to declaredKinds -- Schedule B (Plan 12-04) decides what to do with the combination
- [Phase 12-04]: Schedule B's $1,500 threshold is two INDEPENDENT strict comparisons, never a combined line4+line6 sum
- [Phase 12-04]: Schedule B Part III foreign-account fields are read verbatim from vnd.fjs.return_profile, proven with zero stored 1099s so the read cannot be mistaken for document-derived inference
- [Phase 12]: DOC-13's provenance proof lives in a new proof-only module (fjs/document/consolidated_provenance/module.f.js), not inside either dialect's own file, since the property spans both dialects plus formSubject
- [Phase 12]: expectedKnownDialectCount bumped directly 7 -> 9 in one commit (both new dialects registered together), mirroring Phase 11's 11-04 precedent
- [Phase 12.1-01]: Form 8949's category-derivation refusal check order is fixed and documented (box1f/box1g, then absent-basis, then undecided category) so Mutation Gate M1 has an unambiguous target line
- [Phase 12.1-01]: TAX-11/TAX-15 are NOT marked complete after this plan, despite being named in its frontmatter -- the requirement spans all four plans of Phase 12.1 and REQUIREMENTS.md has no partial-completion representation. Deferred to 12.1-04.
- [Phase 12.1-02]: SDTW lines 22/32's printed skip instructions are left unimplemented as special cases -- surrounding mins/floors already make the shortcut and straight-through arithmetic agree, mirroring qdcgt's own precedent; neither worked example directly observes this, flagged for a future mutation sweep
- [Phase 12.1-02]: SDTW lines 35-40/41-43 are explicitly gated to 0n when their controlling Schedule D line (19/18) is zero, rather than relying on natural arithmetic -- necessary because line 42 carries no printed floor and would otherwise leak a spurious 28% charge
- [Phase 12.1-02]: the split-dispatch fixture (method44 !== method46) and the degenerate-equivalence fixture (sdtw.line47 === qdcgt.line25) share one underlying input rather than two separate constructions
- [Phase 12.1-03]: Schedule D's line-21 loss cap built as a three-way branch (gain/zero/capped-loss) rather than a pass-through of line16, per CONTEXT.md Decision 1.5 -- Form 1040 line 7a is wrong on every net-loss year without the $3,000/$1,500 MFS cap
- [Phase 12.1-03]: Mutation Gate M2's short/long-term equivalent-mutant trap defeated by asserting Schedule D lines 7 and 15 separately -- swapping short-term/long-term categorization leaves line16's total unchanged ($400,000 net gain both before and after), so a total-only proof cannot see the swap
- [Phase 12.1-03]: TAX-11 is NOT marked complete after this plan, despite being named in its frontmatter -- the requirement spans all four plans of Phase 12.1. Deferred to 12.1-04.
- [Phase ?]: [Phase 12.1-04]: Task order REVERSED (1040 wiring first, scope reclassification last) as a git-history atomicity guarantee -- the six kinds stay refused throughout Task 1 so the new line3a/3b/7a/dispatch code is unreachable-or-correct, and Task 2's single commit is the only atomic transition point
- [Phase ?]: [Phase 12.1-04]: filingScheduleD derives verbatim from declaredKinds.includes('capitalGainsOrLosses'), never document presence (Decision 1.6) -- status is now computed once near the top of form1040IncomeLines since Schedule D's loss-cap threshold needs it too
- [Phase ?]: [Phase 12.1-04]: Mutation Gate M4's literal instruction (remove one modeledKinds entry, leave the count) does not compile -- it trips _EveryKindIsEitherModeledOrRefused (TS2344), a stronger correctly-caught defect. Ran the semantically-equivalent compiling form instead: migrate the kind into unmodeledKindRefusals without updating expectedModeledKindCount
- [Phase ?]: [Phase 12.1-04]: TAX-11 and TAX-15 marked complete -- this plan is where Form 8949/Schedule D/the Schedule D Tax Worksheet actually get wired into a computing Form 1040, closing both requirements that spanned all four plans of Phase 12.1
- [Phase 13]: 13-01: Citation widening pulled forward from Slice 2 into this plan, since socialSecurityBenefitsWorksheetBaseAmounts needed the 'code' arm immediately
- [Phase 13]: 13-01: MFS-lived-with-spouse SSB worksheet branch computes line16 as 85% of line7 (not line1 as the plan text said), corrected against 13-RESEARCH.md's verified transcription
- [Phase 13]: 13-01: TAX-10 NOT marked complete -- this plan builds Slice 1's foundation only; wiring into Form 1040 is Plan 13-02's job
- [Phase 13]: 13-02: The IRA-deduction circularity refuses via a document-data-sufficiency error-arm on a new profile field (iraDeductionDeclared), never a fjs/return/scope kind -- the 50-kind vocabulary cannot distinguish an IRA deduction from any other Schedule 1 adjustment
- [Phase 13]: 13-02: retirementForms/socialSecurityForms appended at the END of Form1040Inputs's curried parameter list, mirroring 12.1-04's own dividendForms/brokerageForms widening -- every existing call site needed only two trailing empty-array arguments
- [Phase 13]: 13-02: TAX-10 marked COMPLETE -- vertical slice 1 closes here; a 65+ return with SSA-1099 and 1099-R income computes real lines 4a-6b/25b and a correct AGI through the full form1040Report entry point
- [Phase 13]: 13-03: The plan's own $174,999.99 -> $0.06 boundary example was wrong under correct half-up cent rounding; corrected against independently verified arithmetic -- the 6% rate is coarser than one cent of MAGI, so the floor/start boundary trios are legitimately flat at both points
- [Phase 13]: 13-03: magiCents renamed to phaseoutIncomeCents before commit -- caught the forbidden lowercase 'magi' substring (Decision 3.6) during the plan's own verification sweep
- [Phase 13]: 13-04: scheduleOneA's actual return shape is { partI, partV, partVI }, not the flat record the plan's own interfaces sketch described -- line13b reads scheduleOneAResult.partVI.line38, and the call also passes the required profile field the plan's four-field list omitted
- [Phase 13]: 13-04: line13b's wiring is unconditional, not gated on declaredKinds -- the same design Plan 13-02 established for lines 3a/3b/4a-6b: a modeled line reports the facts, declaredKinds governs only whole-return refusal
- [Phase 13]: 13-04: TAX-09 marked COMPLETE -- vertical slice 2 closes here, a 65+ TY2025 return's line 13b is a real Schedule 1-A figure through the full form1040Report entry point, mirroring slice 1's (TAX-10) precedent
- [Phase 13]: 13-05: saltCap stores only the worksheet's flat, non-MFS dollar figures -- only the SALT worksheet's final line (w10) halves the result for MFS (13-RESEARCH.md Pitfall 2)
- [Phase 13]: 13-05: medicalExpenseFloor and saltCap.phasedownRatePercent are plain number rates, not AmountWithCitation, excluded from the dollar-string round-trip proof
- [Phase 13]: SALT worksheet w1/w9 computed flat for every filing status; the ONE halving step for MFS applies to w9 only when constructing w10 (13-06)
- [Phase 13]: Mortgage-interest and charitable Schedule A entries pass through at face value with no Pub. 936/526 limitation arithmetic (13-06)
- [Phase 13]: Decision 2.2's withholding-drift proof gates on presence of a saltIncomeTax-tagged entry, never a separate election flag (13-06)
- [Phase 13]: deductionChoice lives in fjs/tax/deduction beside standardDeductionCents, comparing against Schedule A's already-computed total; the comparison is a strict > with the line 18 election overriding outright
- [Phase 13]: itemizedDeductions reclassified to modeledKinds in kindVocabulary order (before seniorAndOtherScheduleOneADeductions); netQualifiedDisasterLoss stays refused per Decision 1.4 -- TAX-13 closed
- [Phase 13]: 13-08: dependentEntrySchema's boolean-shaped facts (ssnValidForEmployment, livedWithTaxpayer) use option(true), extending DOC-12's checkbox convention to a taxpayer-asserted credit-eligibility fact rather than a printed checkbox
- [Phase 13]: 13-08: citizenship/resident-alien status is deliberately NOT a fifth dependents field (Decision 5.7) -- documented as an accepted trust boundary in the profile module's own docstring, mirroring fjs/schedule/b's Form 8815 boundary
- [Phase 13]: 13-08: childTaxCredit.odcAmount/actcCap/phaseoutThreshold all cite kind:'code' section §24(h), never kind:'revProc' -- Rev. Proc. 2025-32 backs only the CTC figure among this phase's new numbers (Pitfall 5); first fjs/tax/params group with mixed citation kinds among sibling figures
- [Phase 13]: roundUpToNextThousandDollars kept module-local (13-09) -- fjs/tax/boundary only needs the phase-out's crossing point, not the $1,000-step rounding shape
- [Phase 13]: childTaxCreditPhaseoutIncome (13-09) written independently of seniorDeductionPhaseoutIncome/saltCapPhasedownIncome with its own docstring and a dedicated equality proof, TAX-15's fourth named income function
- [Phase 13]: fjs/tax/boundary registers only the CTC/ODC phase-out's START threshold (2 entries) -- no floor entry, since line12's own STOP is the effective floor rather than a fixed income ceiling
- [Phase 13-the-65-profile-and-the-remaining-schedules]: TAX-12: Schedule 8812 wired into 1040 lines 19/28 from one form8812() call sharing Part I and Part II-A state (Decision 4.3); childTaxCreditOrOtherDependents/additionalChildTaxCredit reclassified atomically (modeledKinds 20/unmodeledKindRefusals 30); sixtyFivePlusProfile -- the fixture this whole phase was written for -- now computes end to end, closing all four vertical slices
- [Phase 13-11]: The five coarse kinds (scheduleOneAdditionalIncome, scheduleOneAdjustments, scheduleTwoTaxes, scheduleThreeNonrefundableCredits, scheduleThreeRefundableCredits) stay refused, not reclassified -- modeledKinds/unmodeledKindRefusals stay at 20/30
- [Phase 13-11]: Schedule 3 line 11 (excess Social Security/tier-1 RRTA withheld) is a documented zero, not a W-2-derived computation, even though the underlying data exists in stored W-2s -- explicitly out of this phase's scope
- [Phase 13]: No typedef/orderedLines/count-constant change: all six lines (8/10/17/20/23/31) already existed as declaredZero placeholders since Phase 10
- [Phase 13]: No scope reclassification in 13-12: the five coarse Schedule 1/2/3 kinds stay in unmodeledKindRefusals -- modeledKinds/unmodeledKindRefusals stay 20/30
- [Phase ?]: MAGI gate regex: [a-zA-Z]*[Mm]agi[a-zA-Z]* (case-insensitive on M/m, fixed lowercase agi), stronger than criterion 5's literal grep, matching 13-VALIDATION.md C-1's own verify command — criterion 5 is case-sensitive and misses camelCase Magi (carried finding C-1); the gate must catch identifier-level mixed-case while still permitting all-uppercase MAGI in prose
- [Phase ?]: C-3 resolved via childTaxCredit docstring precision (verified-against-printed-form + governing-provision language), not a guessed Rev. Proc. number — research only confirmed Rev. Proc. 2025-32 section 2.03 for ctcAmount by full-document grep; odcAmount/actcCap/phaseoutThreshold have no confirmed Rev. Proc. citation, so guessing one would repeat the exact sourcing error Pitfall 5 names
- [Phase 15]: 15-01: payerReportSource and payerReport are two independently hand-authored artifacts, kept in sync across two test tiers rather than a runtime cross-check (07-08/07-09 precedent)
- [Phase 15]: 15-01: fjs/report/payer's two-dialect scope boundary (1099-INT box1, 1099-DIV box1a only) is deliberate and mechanically additive to widen, documented in Schedule D's Decision-2.5 boundary-comment style
- [Phase 15]: 15-02: Corrected the year-genericity gate's own suggested regex, which failed its own required positive control (bare 4-letter 'year' identifier); made the leading identifier-prefix group optional and re-verified all controls
- [Phase 15]: 15-02: Added carryoverWorksheetInputsFromDocument bridging fjs/tax/carryover to fjs/document/prior_year_capital_loss via centsFromString, required by the plan's own frontmatter must_haves.key_links but not spelled out in Task 3's action text
- [Phase 15]: 15-02: All four money fields in vnd.fjs.prior_year_capital_loss are required, never option -- absent-document-is-zero is handled by the caller never constructing the document, not by an optional field
- [Phase 15]: [Phase 15]: 15-03: The unit-level never-executes proof for fjs_check cannot call the composed export itself under fjs/effects/node/virtual (writeFile/import_ representational split, same limitation as fjs_run's executeRun) -- discovered by mutation (a real report invocation left the unit suite green); the decisive proof against the shipped tool is fjs-run-integration.test.js's real-process call, using a program whose report would throw if invoked paired with a following-call session-survival assertion
- [Phase 15]: programHash equality (defensively paired with args) is the complete parameter-set guard for the amendment diff — no new vnd.fjs.run field added — Guest programs cannot import and guestCtx exposes no tax-parameter lookup, so every parameter a stored program uses is a literal baked into its own source, already covered by programHash (15-RESEARCH.md Pitfall 1).
- [Phase 15]: The whole-dollar election is applied host-side, independently per side, as an explicit elected argument to amendmentDiff — never re-derived from stored CAS content — applyWholeDollarElection is not part of guestCtx, so a guest program cannot have applied it; re-deriving elected from stored CAS content would only be sound if both runs pinned the same return-profile revision, which can silently be false.
- [Phase 15]: 15-05: priorYearCapitalLossCarryover is OPTIONAL on ScheduleDInputs, not option()-wrapped inside a document -- absence-is-zero lives at the caller's cardinality, mirroring 15-02's own caller-never-constructs-the-document decision one layer up
- [Phase 15]: 15-05: The full-return reachability proof compares against an independent scheduleD(...) call fed the SAME carryover document, checking line16 (the only Schedule D total form1040IncomeLines exposes) rather than a nonexistent scheduleD6Cents field -- a dropped capitalLossCarryoverForms argument makes the two sides differ by exactly $6,000.00
- [Phase 15]: 15-05: TAX-17 marked complete -- absence-is-zero, presence-drives-the-worksheet through the full form1040IncomeLines entry point, and year-genericity via a synthetic second TaxParamSet are all delivered and mutation-verified
- [Phase 15]: DOC-16 verified the real dialect count directly (grep against fjs/) rather than trusting the plan's own table -- 12 local dialects + upstream revisionDialect = 13
- [Phase 15]: DOC-16: cas_refresh's dialectCounts counts an unregistered-dialect blob under its detectVec text/plain fallback -- present, never absorbed into a registered dialect's count
- [Phase 15]: DOC-16: each dialect's extraValidate written inline rather than factored into a shared generic helper, avoiding an any/cast under dialectEntry's contextual Ts<T> typing
- [Phase 19-01]: paramSetHash's jsonText(taxParamSet) call needs NO JsonUnknown cast, contradicting 19-PATTERNS.md's own excerpt -- verified against the live fjs/server/finance_tax_params/module.f.js:157 precedent (jsonText(response), a TaxParamSet-shaped value including the ceiling: string | undefined required-field case) and confirmed empirically with npx tsc --noEmit before finalizing
- [Phase 19-01]: countsTowardReproducibilityAcceptance reads run.pinned alone and deliberately does not re-derive fjs/run/module.f.js's checkReferences both-or-neither invariant -- verified independently load-bearing per arm by mutation (run.pinned || true reddens only rejectsAnUnpinnedRun)
- [Phase 19-01]: matchesFileCassOwnHashOfTheIdenticalBytes is the ONLY leaf that catches paramSetHash's derivation drifting from the exact primitive fileCas uses on identical bytes -- confirmed by a computeSync(sha256)([bytes, bytes]) mutation that reddened that one leaf alone, none of the other three
- [Phase 19-02]: fjs/report/provenance/module.f.js's own unpinnedRun TEST-FIXTURE (shipped by 19-01, typed @type {Run} directly) is a FIFTH Run-literal-construction population, missed by the plan's and the earlier plan-check's four-file enumeration because it postdates both -- found by re-deriving the population via `grep -rn "pinned:" fjs *.js` rather than trusting either the plan's checklist or the prior plan-check's grep, and fixed in the same atomic commit as a Rule 3 blocking-issue auto-fix
- [Phase 19-02]: Mutation Gate M2 (&& -> ||) reddens exactly the one leaf 19-VALIDATION.md's corrected gate table names (fjsRunTool.pinIntegrity.subjectOnlyWithoutParentsPersistsPinnedFalse) via handleRunOutcome's own record-assembly assert firing on the mixed-pin case, before any Run value is built -- countsTowardReproducibilityAcceptance's own two proof leaves independently confirmed to stay green under the identical mutation, positively confirming the structurally-unreachable-input claim rather than merely observing an absence of failure
- [Phase 19-02]: The responseShape and sizeGuard proofs both hand-count fjs_run's envelope keys (six -> ten); both updated in this plan's own commit rather than left to silently under-cover the widened envelope
- [Phase 19-03]: The unpinned control leg's movement was verified as a genuinely independent observation, not inferred from the pinned leg passing: controlBytes1/controlBytes2 differed (two distinct revision-hash-array JSON strings) after the SAME amendment shape landed between two unpinned runs, confirmed BEFORE the pinned leg's code was trusted, per 19-VALIDATION.md's "the control leaf is not optional"
- [Phase 19-03]: Mutation Gate M1's naive full-suite run showed only the PRE-EXISTING real-process pin proof failing (the whole integration test is one node:test `test()` block, so the first thrown assertion aborts everything after it in source order) -- confirmed the NEW PROV-05 pinned-reproduction assertion is independently load-bearing by a diagnostic run with the earlier pin block's assertions neutralized: `pinnedRun1.resultHash !== pinnedRun2.resultHash` then reddened on its own line, isolated from the earlier assertion. The two `buildRunSnapshot`-level unit proofs (`buildRunSnapshotResolvesTheStore.pinOverridesTheResolvedHead`, `executeRun.pinOverridesTheLiveHeadThroughFullExecuteRun`) also reddened, both predicted by 19-VALIDATION.md/the plan
- [Phase 19-03]: EXEC-13 marked complete on the reasoning that `countsTowardReproducibilityAcceptance` has no other consumption point to gate in this codebase (grepped: zero production call sites of `.pinned` beyond `fjs_run`'s own record-assembly and this predicate's own module) -- its docstring frames it as consumer-side by design, and this plan is the first caller to exercise it against two REAL, CAS-fetched persisted run records rather than hand-typed fixtures, correctly discriminating pinned (true) from unpinned (false)

### Pending Todos

None yet.

### Blockers/Concerns

- **RESOLVED (Phase 1): the AGENTS.md / roadmap money contradiction.** Corrected as DOCC-07.
  Storage boundary is now a decimal string in both REQUIREMENTS.md and ROADMAP.md;
  rationals-in-computation and strings-on-the-MCP-wire verified unchanged.

- **RESOLVED: what moves HEAD.** Not a daemon and not corruption — **a second author works
  in this same checkout**. `feature/link-issue-16` appeared mid-session and became PR #19.
  Still a live hazard for uncommitted edits: commit early, keep multi-step git in one atomic
  invocation, and re-verify `git branch --show-current` at the start of every command block.
  The guard has caught it every time; nothing has been lost.

- **RESOLVED upstream: the prototype-dispatch escape is closed in fjs 0.41.0.** `match` now does
  `at(command)(map)` + `assert(handler !== null, command)`; `at` is `getOwnPropertyDescriptor`-based,
  so inherited names never resolve. Verified by execution against the installed 0.41.0, not assumed:
  `casRead` dispatches; `fetch`, `constructor`, `toString`, `valueOf` and `__defineGetter__` are all
  refused; re-running the 0.40.0 escape leaves the whitelist unpolluted with no getter installed.
  The real fix was Sergey's functionalscript#1419. The issue filed from this branch, #1420, was a
  duplicate and is closed.

- **The ergonomics half SURVIVES and is still ours (EXEC-03).** `assert` throws the **bare command
  string**, not an `Error` — `typeof e === 'string'`, `e instanceof Error === false`, `e.message`
  `undefined`. A refusal handler must use the caught value directly; an `instanceof Error` branch
  misses every refusal. 0.41.0 knows the command name but nothing of the permitted set.

- **Phase 3 is smaller than planned.** EXEC-02 is delivered upstream. What remains is EXEC-01
  (`interpret`), EXEC-03 (actionable refusal naming the permitted set), EXEC-04 (regression proofs —
  now pinning behaviour we depend on rather than hoping for it), EXEC-05 (observed read set), and
  EXEC-06 (step budget).

- **The `functionalscript` submodule is initialized in the MAIN checkout but not in this
  worktree**, and that changes the test count: `npm test` reports **118** here and **2295** on
  main (2177 of them upstream's own, all passing). Neither number is wrong; know which tree you
  are measuring before comparing runs. `tsconfig.json` excludes the submodule either way.

- **Leftover remote branches, not ours to delete.** `origin/wtf` and
  `origin/revert-14-feature/planning-requirements-roadmap` are Sergey's and each carry one
  commit not in main. `origin/ok` is fully merged (0 unmerged) and is safe to drop.
  `origin/feature/planning-requirements-roadmap` holds one superseded WIP commit
  ("paused at 8/15 — Phase 1 not started") — obsolete, but deleting unmerged work is the
  user's call.

- **RESOLVED (Phase 2): the protocol-version pin works.** A real `claude -p` client issued an
  actual `tools/call` (`mcp__finance-mcp__evo_list` -> non-error `tool_result`) against the
  registered server, so the documented silent-failure mode did not occur and `2026-07-28` stays a
  recorded fallback rather than a needed change. **Superseded (Phase 39, 2026-08-31):** the gap
  closed upstream in fjs 0.47.0 — `_negotiateVersion` echoes a supported revision and
  counter-proposes the latest otherwise — and the note it was filed in was deleted in `7244f81`.

- **NEW: `node --test <source-file>` reports a FAKE PASS.** Emergent Testing only registers when
  root `all.test.js` is imported. Verified by injecting a proof leaf that throws: `npm test` gave
  `tests 8, pass 7, fail 1`; `node --test fjs/server/module.f.js` gave `tests 1, pass 1, fail 0` on
  the identical file. AGENTS.md line 51 said the opposite and is corrected. **Only ever trust
  `npm test` / `node --test all.test.js`.**

- **NEW (Phase 6): a "which error message" assertion cannot prove an ORDERING.** SEC-02's gate
  must run before `import_`, and the first proof asserted that a dirty source returned a specifier
  message rather than an import error. Both orderings return that message when the module loads,
  so moving the gate after `import_` left the suite green at 134 pass. Only observing whether the
  module BODY was evaluated distinguishes them — which is also the actual security property,
  since `import()` runs the body immediately with full Node privileges. A `JsModule` fixture under
  `virtual` recording its own invocation is the mechanism; pair it with a control leaf so the
  assertion is about the gate and not about a spy that never fires.

- **NEW (Phase 5): a mutation that fails to COMPILE proves nothing.** `npm test` is
  `tsc && node --test`, so `allowUnreachableCode: false` rejected an `if (false)` mutation
  before a single test ran. Mutations must be rewritten into forms that typecheck but never
  fire, or the run is measuring the compiler rather than the suite.

- **NEW (Phase 5): `exactOptionalPropertyTypes` does NOT catch a spread carrying `undefined`.**
  Mutating `convert` to `...{ corrected: meta.corrected }` (where `meta.corrected` is
  `true | undefined`) passed `npx tsc --noEmit` cleanly and was caught only by a runtime proof —
  the key was present holding `undefined`, which `'corrected' in result` sees. Every `option(...)`
  field in every future dialect conversion depends on the conditional-spread discipline
  (`...(x === undefined ? {} : { k: x })`), and **the compiler will not tell you when it slips.**
  DOC-11's absent-vs-zero rule rests on this.

- **RESOLVED: PR #20 merged** (2026-08-04, merge commit `2c4eb2e`) — 41 commits, +10386/-131,
  Phases 1-5. Merged unreviewed at the user's explicit direction after a long wait for review.
  Its title said "Phases 1-2" while carrying five phases; corrected before merging.

- **RESOLVED: the `finance-mcp` registration** now points at the main checkout
  (`/Volumes/.../sergey-shandar/finance`), re-registered post-merge and verified Connected.

- **Superseded (Phase 2): fjs's `mcpStep` does not negotiate the protocol version.** The
  `initialize` handler validates the client's params then discards the client's
  `protocolVersion`, returning the configured string unconditionally
  (`fjs/protocol/mcp/module.f.js`). `McpConfig.protocolVersion` is an unvalidated `string`.
  Whatever we pin is what every client is told. Decision: pin `2025-11-25` per MCP-03 and
  settle it with the roadmap's budgeted empirical check against a real client, escalating
  only if that fails. Note `2026-07-28` is now the current spec revision. This is an
  upstream gap AGENTS.md requires reporting rather than silently working around.

- **Scope vs schedule (open, deliberate).** The selected taxpayer profile makes v1 roughly
  4–5× research's recommended scope. The five-week plan realistically delivers Phases 1–10.
  Phase 14 (acceptance against the filed return) is gated on Phases 11–13 and cannot pass
  without them. Cut line documented in ROADMAP.md "Scope Honesty and the Cut Line".

- **Open question 4 unanswered** — is an external date driving the five weeks? Decides
  whether Phases 11–13 are compressed (they must not be) or the schedule extends.

- **Accepted, not solved:** `import()` runs a blob's module body with full Node privileges;
  Node's permission model has no network permission, so exfiltration is unmitigated
  in-process. See REQUIREMENTS.md "Accepted Risks".

- **Research required before planning** Phases 8, 10, 11, 12, 13, 15 — Tax Table band
  widths, QDCGT and Schedule D Tax Worksheets, 1099-R/SSA-1099 box lists, MAGI add-back
  lists, Schedule 1-A mechanics, child-process isolation.

- **RESOLVED (07-10):** the prior note here ("production's real `claude mcp add` registration does
  not set the working directory `fjs_run` needs") was a misdiagnosis of the actual root cause.
  `executeRun` (`fjs/server/fjs_run/module.f.js`) wrote the materialized program to
  `programPath(materializeHome(home))(hash)` but imported it via the BARE hash-derived filename —
  a real Node `import()` of a bare specifier resolves against `process.cwd()`, not `home`, so the
  import missed the file `materializeProgram` had just written. The fix composes the import path
  from the SAME `materializeHome`/`programPath` expressions the write uses, so the two paths can
  never drift apart again. The launcher needs NO special working directory: proven by
  `fjs-run-integration.test.js`, which now spawns the real server from an ordinary working
  directory (the `cwd: materializeHome(home)` workaround has been removed) and still passes. See
  `07-10-FIX-SUMMARY.md` for the full account, including why 185 virtual proofs never caught this
  (they keyed their `JsModule` fixtures at the same bare name the buggy code asked for).

- **RESOLVED (resume, 2026-08-05): the two Phase 7 branches were never divergent.**
  The pause-work handoff flagged a blocking human merge decision between
  `feature/phase-7-exec` (this worktree) and `feature/phase-7-fjs-run-and-run-records`
  (where a second Claude session was committing). Measured on resume:
  `git rev-list --count feature/phase-7-fjs-run-and-run-records ^feature/phase-7-exec` = **0**,
  and the same count against `origin/feature/phase-7-fjs-run-and-run-records` and `origin/main`
  is also **0**. `feature/phase-7-exec` is a strict superset — 22 commits ahead of the other
  branch, 90 ahead of `develop`. Nothing to reconcile; any merge is a fast-forward. The branch
  is **not yet pushed** to origin, which is the only remaining action.

## Anti-Patterns — every row is an actual failure, not a prediction

Folded in from `.planning/.continue-here.md` on 2026-08-12 when that one-shot handoff was
consumed. These are session-independent lessons; they belong somewhere permanent.

| Pattern | What happened | Severity | Prevention |
|---------|---------------|----------|------------|
| **GSD milestone scoping is inert here** — found 2026-08-27 | `gsd-sdk query state.sync`, run right after milestone v5 opened, wrote **`total_phases: 18, completed_phases: 16, percent: 100`** for a milestone with **7 phases and none started**. `getMilestonePhaseFilter` calls `extractCurrentMilestone`, whose `hasVersionedMilestones` test is `/^#{1,3}\s+.*v\d+\.\d+/mi` — it requires a **minor version**. This project has named milestones `v1`…`v5` with no minor since the first one, so no heading ever matches, the scope silently falls back to the entire 129,456-byte file, and every milestone-relative figure computed from it is meaningless. Same root cause as the `roadmap.analyze` blindness recorded in ROADMAP.md's phase-list note. | **blocking** | **Do not run `state.sync` in this repo** until either GSD accepts `vN` or the headings gain a minor. It fails *upward* — 100% for a milestone at 0% — which is the direction nobody checks. The progress block was corrected by hand to 7/0/0%. Note GSD accepts bare `v5` in `state.milestone-switch` and rejects it for scoping: the inconsistency is inside one tool. |
| **Vacuous proof** | A proof that is green and *permanently unable to fail*. Happened **twice in Phase 15**: 15-02's year-genericity gate regex could not match its own required positive control (`[A-Za-z_$][\w$]*[Yy]ear` needs ≥5 chars, so a bare `year` never matched); 15-03's never-executes proof called a decomposed helper instead of the composed export, so mutating `fjsCheck` to *actually run the guest program* left the unit suite green at 3110/3110. | **blocking** | Mutate the **production body** the proof guards and watch that specific leaf go red, then restore byte-identical. Mutating the fixture is not the same test. AGENTS.md already requires this; both failures came from skipping it. |
| **Trusting a plan's own literals** | Plan text contained values that could not produce their own stated expectations. 15-04's plan used `'100000'`/`'150000'` where `centsFromString` has no implied cents scaling, so its own expected columns were unreachable. 15-06's hand-typed dialect count predated 15-02 adding a dialect. | **blocking** | Verify each literal against the function that will consume it *before* implementing. **Every one of Phase 15's six plans contained at least one real defect.** |
| **Grepping for a runtime surface** | The MCP tool count was reported wrong three times (7, then 8, then 12; the answer is **13**) because finance-local `toolEntry(` declarations miss the upstream `casToolRegistry`/`evoToolRegistry` spread into `financeMcpHandlers`. This produced a *false headline claim* — "no document-write tool is registered" — when `evo_add` has always been there. | **blocking** | Start `node index.js` and ask it (`initialize` → `notifications/initialized` → `tools/list`). `cas-refresh-cross-process.test.js` has the spawn-and-speak pattern to copy. Never derive an advertised surface from source. |
| **Two sources of truth drifting** | `REQUIREMENTS.md`'s traceability table read `Pending` for PROV-06/PROV-08 while their own checkboxes read `[x]` — the **identical defect Phase 13 closed out with**, recurring one phase later. STATE.md's Current Position block is the same disease (three occurrences, see above). | advisory | When marking a requirement complete, update the checkbox **and** the table row, then sweep *all* complete requirements rather than only the ones you noticed. |
| **Double-counted proof metric** — **ROOT CAUSE FOUND AND FIXED 2026-08-17** | The observation was right and the diagnosis it implied was wrong. `node --test` did not merely *count* the proofs twice, it **ran them twice**: bare discovery matched `functionalscript/fjs/emergent_testing/all.test.ts` — the vendored submodule's own entry point, a **`.ts`** file, which Node 25 executes natively — and that re-walked the entire proof set. 4273 (the eight root files) + 4260 (the duplicate walk) = 8533. Cost: **~53 seconds on every run**, for years, described the whole time as a display artifact. Fixed by pinning `npm test` to `node --test *.test.js`: 8533 tests → **4273**, wall clock ~60s → **~30s**, and raw proof lines now equal unique ones (2024 = 2024, zero duplicates). | **fixed** | The `sort -u` is no longer load-bearing and is kept only as a cheap assertion that it stays that way. **The lesson is not about globs:** "the number is inflated" was treated as a fact about the *reporter* and never tested as a fact about the *runner*, so a real 2× cost hid behind a documented workaround. A workaround that works is the most expensive kind of bug, because nothing pushes anyone to look again. |
| **`npx` in a real-process test** | `npx functionalscript` can never resolve (the package's bin is named `fjs`), so it fell through to npm's registry-touching path: 84% of one test's wall clock, and the reason `npm test` went red under parallel load. Pre-existing since Phase 5. | advisory | Spawn `node` against an absolute path into `node_modules`. See `fjsCliPath` in `cas-refresh-cross-process.test.js`. Fixed in `e36ef1a`; do not reintroduce. |

**The through-line:** nine real defects surfaced in Phase 15 and **not one was caught by reading
code.** They were caught by mutating production and watching a specific test go red, by
re-deriving a plan's literals against the function that consumes them, and by starting the
server and asking it instead of grepping. Green does not mean verified.

## Deferred Items

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| Doc truth (→ Phase 17) | **The "~8 min / 481s full suite" figure is wrong, but so was my first correction.** Two measurements on 2026-08-12: `0038eed` → `duration_ms 44707` (**44.7s**, 6296 tests); `20f5459` → `duration_ms 136059` (**136s**, 6314 tests). Both exit 0. So the honest figure is a **range of roughly 45-140s that varies ~3x with machine load**, not the single 44.7s I first recorded, and not the 481s in STATE.md's Infrastructure notes / `19-VALIDATION.md` / `15-VALIDATION.md`. **Note the shape of my own error: I measured once and reported a point value as if it were the property.** That is the same defect as reporting one grep's population as the whole — which this phase hit four times. Phase 17 should record a range with the measurement conditions, and correct every copy. Consequence is not cosmetic: plans avoided per-task full-suite runs on the strength of the 481s figure, trading real feedback for imagined cost. | Open | 2026-08-12 |
| Doc truth (→ Phase 17) | `amendmentDiff` refusing unpinned runs — deferred from Phase 19 Area 2 by owner decision. Revisit only if a real caller is misled. | Open | 2026-08-12 |
| Structure (→ Phase 18) | **`fjs-run-integration.test.js` is one giant `test()` block, and the masking is not hypothetical.** Phase 19's code review raised it as WR-03 after it cost real work: under Mutation Gate M1, Node reported the failure as the *pre-existing* pin proof, which shares the block and runs first — the new PROV-05 assertion's independent redness could only be established with a throwaway diagnostic copy. **Two separate agents hit this.** The consequence beyond mutation testing: a future regression in any later assertion of that block is invisible while an earlier one fails, so the file reports one failure no matter how many things break. Splitting it into per-concern `test()` blocks belongs with Phase 18's structural work; doing it inside a phase close would have been unreviewed churn. | Open | 2026-08-12 |
| Verification (→ Phase 21+) | **A proof that asserts a message must assert the part that carries information.** Phase 20's verification erased a refusal's `${destination}` interpolation and the entire suite stayed green: five leaves asserted the box name and the phrase "cannot compute", none asserted *where the amount would have gone* — the only actionable part. Fixed in `1697896` and folded into AGENTS.md, but the general form is unswept: **no other dialect's refusal messages have had this mutation run against them.** Five dialects carry refusal or error strings. | Open | 2026-08-16 |
| Verification (→ Phase 21+) | **`&& false` does not work inside an `if`.** `allowUnreachableCode: false` makes the block unreachable, `tsc` reports TS7027, no `ℹ tests` line appears, and the gate proves nothing while looking performed. AGENTS.md's own recipe recommended it; corrected in `1697896` with working forms. Any plan written before 2026-08-16 that specifies an `&& false` mutation inside a condition **will not run** — reshape it rather than recording the result. | Open | 2026-08-16 |
| Process (→ any phase) | **Never run a code reviewer concurrently with a verifier that re-runs mutation gates.** My error in Phase 19: I parallelized them to save wall-clock, but the verifier mutates and restores production files while the reviewer reads them. The reviewer caught a target line changing under it mid-review (IN-02) — it detected the interference rather than being fooled, which was diligence, not design. Mutation-running agents need exclusive access to the tree. | Open | 2026-08-12 |

## Session Continuity

Last session: 2026-08-14
Stopped at: **Phase 18 planned, zero plans executed.** 4 plans across 3 waves, plan-checked
twice, 3 blockers fixed. Phase 19 is complete and MERGED to `develop` (PR #66), as are the
Phase 18 criteria corrections (PR #67).

> **This block was corrupted for the FOURTH time on 2026-08-14, the third time by an SDK
> write.** It arrived reading `status: verifying`, `stopped_at: context exhaustion at 75%`,
> `completed_plans: 87` against `total_plans: 88` — claiming plans complete that had not been
> executed — and with the sentence below truncated mid-clause, leaving a dangling
> "owner decision." fragment whose subject had been clobbered. Rewritten from measurement.
>
> **The mechanism is now confirmed rather than suspected.** Phase 19's Wave 1 executor reported
> `gsd-sdk query state.advance-plan` corrupting this same file the same way (inflating
> `completed_plans` past `total_plans`, truncating a status sentence), and reverted to a manual
> edit. Waves 2 and 3 were instructed not to call it. **Do not run `state.advance-plan` against
> this file.** Hand-edit, scoped to the phase you are in.

Suite measured on `27ba2c2`: **exit 0, 6314/6314, 916 de-duplicated project-local proofs**,
`duration_ms 25337`. Nothing is mid-edit apart from this file's own correction; there are no
open PRs and `develop` is in sync.

**HANDOFF.json and `.continue-here.md` were consumed and deleted on resume** — they are
one-shot artifacts, and this file's own history records stale phase-09/phase-10 handoffs having
to be deleted because a handoff left lying around reads as unfinished work. Everything durable
in them was folded into this file first: the anti-pattern table above, and the pending human
decisions below. Nothing was lost; both remain in git history at `4c8e6f9`.

### What the resume found

STATE.md's Current Position block had **drifted for the third time**, describing Phase 15 as
EXECUTING while carrying Phase 13's text. Corrected from measurement, with the mechanism
recorded this time — see the margin note under "Current Position". No other artifact was stale:
82 plans, 82 summaries, no PLAN-without-SUMMARY, no interrupted agents, no pending todos, and
the ROADMAP progress table was already accurate.

### What the previous session did

1. **Resumed and found Phase 13 already complete** — 13 plans, 13 summaries, CONTEXT /
   PATTERNS / RESEARCH / VALIDATION / REVIEW / VERIFICATION all present, all six code-review
   remedies (CR-01, WR-01..WR-05) committed. No `HANDOFF.json`, no `.continue-here`, no
   PLAN-without-SUMMARY, no interrupted agents.

2. **Found `npm test` RED and fixed the cause** (`e36ef1a`).
   `cas-refresh-cross-process.test.js` timed out against its 30s budget under the full
   suite's parallel, process-isolated load, while passing in isolation at 20.16s.
   Root cause: `functionalscript` declares its bin as `fjs`, not `functionalscript`, so no
   `node_modules/.bin/functionalscript` exists; `npx functionalscript` could never resolve
   locally and fell through to npm's registry-touching resolution path. The child leaked
   npm's own "New minor version of npm available!" notice, proving the network call. The two
   `cas add` invocations were 84% of wall clock. Now spawns `node` against an absolute path
   into the pinned `node_modules/functionalscript/fjs/module.js` — the convention this same
   file already used for its long-lived server and that `fjs-run-integration.test.js:149`
   uses throughout. Byte-identical content hash verified before the change, so the
   separate-OS-process proof is unweakened. Isolated 20.16s -> 5.84s; under full suite load
   >30s (timeout) -> 11.2s; on CI's Linux runner, 1.01s.
   **Pre-existing since Phase 5 (`f25ca2d`) — not a Phase 13 regression.**
   It also closed a provenance hole: `npx` was free to hand the test a *registry* build
   rather than the pinned one, in a project whose thesis is content-addressed provenance.

3. **Corrected this file's own proof-counting instruction** — see "Test metrics" above. The
   documented `grep -c` command double-counts by exactly 2x whenever the submodule is
   initialized. 845 is the real number, and CI agrees.

4. **Shipped Phase 13.** Branch `feature/phase-13-the-65-profile-and-schedules` pushed (it
   had been 70 commits ahead of `origin/main` and entirely unpushed — the largest standing
   risk in the project). **PR #62** open against `develop`, 71 commits, MERGEABLE, CI green.

Measured on `e36ef1a`: `tsc` clean, **6166/6166 passing, 0 failures, 0 cancelled**;
**845** de-duplicated project-local proofs.

### Decisions taken this session (phase owner, 2026-08-11)

- **Phase 13 ships now** as PR #62 rather than waiting for self-review.
- **Phase 14 is skipped; Phase 15 is next.** This re-affirms the 2026-08-07 autonomous run
  (12.1 -> 13 -> 15 -> 16 -> 17 -> 18, 14 skipped) over Phase 13's close-out note, which had
  proposed deferring the IRS-figure transcription check *into* Phase 14.

> **CARRIED, NOW UNOWNED — read before closing v1.** Skipping Phase 14 leaves two
> `human_needed` items with no scheduled owner, because Phase 14's acceptance run against the
> user's real filed return was the thing that would have resolved both:
>
> 1. **Phase 13** — the TY2025 figures (senior deduction $6,000/6%/$75k-$150k; SSB base
>    amounts $25k/$32k; SALT cap $40,000/30%/$500k-$250k/$10,000 floor; CTC $2,200 / ODC $500
>    / ACTC cap $1,700 / phase-out $400k-$200k at 5% per $1,000; medical floor 7.5%) have
>    never been checked by a human against the printed IRS PDFs. A green suite proves the
>    engine agrees with the constants it was given, never that a constant was transcribed
>    correctly. See `13-VERIFICATION.md` and `deferred-items.md`.
> 2. **Phase 10** — whether the Tax Computation Worksheet is cent-exact or whole-dollar,
>    pinned at $184,094.50 for MFJ at $700,000 taxable.
>
> Note also that **Phase 15's ROADMAP entry declares `Depends on: Phase 14`.** That
> dependency is being waived by decision, not satisfied.

### Decisions taken 2026-08-12 (phase owner, autonomous run)

- **Phase 16 is DEFERRED, not skipped and not cancelled.** The wire-or-delete decision was
  postponed rather than made; MAINT-01 stays open and the phase stays in the milestone.
  **Its ROADMAP criterion 1 was found factually wrong and has been corrected in place:**
  `fjs/document/subject` is NOT an orphan — `fjs/document/consolidated_provenance/module.f.js:41`
  imports `formSubject` and calls it at lines 117-118 (Phase 12's shipped DOC-13 proof).
  Deleting the three modules as the criterion instructed would have broken verified work. The
  real orphan is **396 lines across two** modules (`from_ocr`, `ocr_amount`), not 576 across
  three. The error came from grepping bare names — `subject` appears in four docstrings that
  are not imports. **Grep for `import` statements, not for names.**

- **EXEC-13 / PROV-04 / PROV-05 re-homed into new Phase 19** — *Reproducibility and Report
  Provenance*. None of the three needs the taxpayer's filed return: they are the pinned-run
  flag, the tax-year/parameter-set/program-hash header on report output, and adversarial
  byte-identical reproduction. Phase 14 had bundled them with an acceptance run that genuinely
  did need the owner; skipping the phase stranded all five criteria together. Phase 14 keeps
  only criteria 1 and 2 and stays skipped. The milestone now has **no homeless requirements**.

- **Remaining execution order is deliberately non-numeric: 19 → 18 → 17.** Phases 19 and 18
  both touch `executeRun`, so 18's step-sequence sharing should happen after 19 stops changing
  it; and 17 is the documentation truth pass, which must run last or the code changes in 18/19
  re-stale the claims it exists to make true.

### Human decisions still pending

1. **Phase 16 — wire it or delete it.** Deferred above, not answered. When it is taken:
   *if wired*, TEST-03 requires a real-process integration call; *if removed*, `todo/plan.md`'s
   Track B must be amended so the next reader does not rebuild it, and **`fjs/document/subject`
   is out of scope either way.**

2. **Release timing.** `develop` is **110 commits ahead of `main`**. A release means bumping
   `package.json` from `0.12.0`, writing CHANGELOG entries for Phases 13 and 15, merging to
   `main`, and tagging. Note an existing test asserts `serverInfo.version` equals
   `package.json`'s version, so the bump is a code change, not just metadata. Owner chose on
   2026-08-12 to stop at `develop`.

4. **Standing verification debt** — see the CARRIED, NOW UNOWNED block above. Phases **05, 06,
   07** have no VERIFICATION.md under any name; Phase 10's Tax Computation Worksheet
   cent-exactness and Phase 13's TY2025 IRS figures remain `human_needed`.

### Next

Autonomous run in progress, executing **19 → 18 → 17** (see the ordering rationale above).
**Phase 19 is now COMPLETE** — all three plans executed, all three requirements closed. Next
up is **Phase 18**.

- **Phase 19 — Reproducibility and Report Provenance — COMPLETE (2026-08-12).**
  (Week 4, T2, EXEC-13/PROV-04/PROV-05). CONTEXT/PATTERNS/VALIDATION and Plans
  19-01/19-02/19-03 written and executed 2026-08-12. ROADMAP marks it **Research: No** —
  every mechanism it needs already ships and is proven.
  **Plan 19-01 executed and committed** (`d42cc2d`): `fjs/report/provenance/module.f.js` —
  `paramSetHash`, `reviewedEstimateFraming`, `countsTowardReproducibilityAcceptance`, all 7
  proof leaves mutation-gate-verified. See `19-01-SUMMARY.md`.
  **Plan 19-02 executed and committed** (`7a58c76`): `runSchema`/`fjsRunInputSchema` widened
  with required `taxYear`/`paramSetHash`; `fjs_run`'s response envelope and persisted
  `vnd.fjs.run` record both now carry `taxYear`/`paramSetHash`/`programHash`/
  `reviewedEstimateFraming` alongside the existing six/eight keys; an unknown `taxYear` is
  refused by name before `executeRun` ever runs. All four independent Run-shaped-literal/
  call-site populations updated in the one commit, plus a fifth population
  (`fjs/report/provenance/module.f.js`'s own `unpinnedRun` fixture, shipped by 19-01 after
  the plan's population enumeration was frozen) found and fixed the same way. Mutation Gate
  M2 performed and confirmed against 19-VALIDATION.md's corrected red set (observation only,
  no code change survives it — `&&`/`||` restored byte-identical). See `19-02-SUMMARY.md`.
  PROV-04 marked complete; EXEC-13 stays Pending (its second sentence needs 19-03's gate).
  **Plan 19-03 executed and committed** (`0315577`): PROV-05's control-then-pinned
  byte-identical reproduction proof added to `fjs-run-integration.test.js`. The unpinned
  control leg was built and OBSERVED to move (two distinct fetched-byte values, one head
  hash before the amendment, a different one after) before the pinned leg's stability was
  trusted, per 19-VALIDATION.md. The pinned leg then reproduced byte-identically across the
  same amendment, both by `resultHash` string equality AND by fetched-byte equality.
  `countsTowardReproducibilityAcceptance` was called against two REAL, CAS-fetched persisted
  run records (never hand-built fixtures): `true` for the pinned run, `false` for the
  control. **Mutation Gate M1** (pinned branch resolves the live head instead of
  `pin.parents`) reddened the new PROV-05 assertion — confirmed independently load-bearing
  via a diagnostic run isolating it from the pre-existing pin proof that also reddens in the
  same mutated pass — plus both `buildRunSnapshot`-level unit proofs 19-VALIDATION.md
  predicted; restored byte-identical, `git status` clean, suite green again. **EXEC-13 and
  PROV-05 both marked complete** (checkbox + traceability row). `npm test` 6314/6314;
  de-duplicated project-local proofs unchanged at **916** (this plan's new assertions live in
  the root-level integration test, not under `fjs/`). See `19-03-SUMMARY.md`. **This closes
  Phase 19.**

- **Phase 18 — Dependency and Duplication Debt** (Backlog, T3, MAINT-06…08). Now next.
- **Phase 17 — Documentation Truth Pass** (Backlog, T3, MAINT-02…05). Its criterion 5 is the
  requirement count, which read **79** in ROADMAP's Coverage table and **83** in
  REQUIREMENTS.md while the real figure is **93** (82 complete, 11 open). The Coverage table
  was corrected on 2026-08-12 — it had also omitted the entire MAINT category and its own rows
  summed to 90, not the 79 it declared. REQUIREMENTS.md's prose claim is still uncorrected and
  is Phase 17's to fix.

**Phase 16** is deferred and **Phase 14** is skipped; neither is part of this run.

Resume file: None
all closed); next is Phase 18 (Dependency and Duplication Debt)
