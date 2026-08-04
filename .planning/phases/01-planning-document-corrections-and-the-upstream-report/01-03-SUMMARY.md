---
phase: 01-planning-document-corrections-and-the-upstream-report
plan: 03
subsystem: docs
tags: [upstream-disclosure, prototype-pollution, github-issue, human-verify-checkpoint]

# Dependency graph
requires: []
provides:
  - "fjs/todo/upstream-match-partial-operation-map.md's soundness claim corrected to state the Object.hasOwn + null-prototype guard condition"
  - "Its Local workaround section warns that a command in map guard is unsafe, with the __defineGetter__ reproduction as evidence"
  - "Its three numbered upstream fix sketches left byte-identical (verified by diff)"
  - "A public FunctionalScript issue (#1420) filed with the full __defineGetter__ reproduction attached, reviewed via a human-verify checkpoint before posting, and its URL recorded in the repo"
affects: [phase-3-restricted-interpreter]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Disclosure of a working exploit against a shipped upstream dependency is human-gated (checkpoint:human-verify) even when autonomous:true would otherwise apply to the surrounding plan — publication is irreversible."

key-files:
  created:
    - .planning/phases/01-planning-document-corrections-and-the-upstream-report/01-UPSTREAM-ISSUE.md
  modified:
    - fjs/todo/upstream-match-partial-operation-map.md

key-decisions:
  - "The three numbered upstream fix sketches in 'What the upstream fix should look like' were left byte-identical to their pre-edit text, confirmed by diff (zero output) — Sergey's API design in that section was out of scope for this correction."
  - "Before posting, a factual imprecision in the issue draft was corrected: the draft claimed its output was 'run on functionalscript@0.40.0', but the reproduction script imports nothing — it demonstrates the property-lookup semantics match relies on, not match itself. Fixed prior to publication (commit 1156a1b) rather than publishing an imprecise public claim."
  - "Filing was gated behind a checkpoint:human-verify task (autonomous:false on this plan) because publishing a working __defineGetter__ escape against shipped functionalscript@0.40.0 before a fix exists is irreversible; the human reviewed and approved the exact issue text before it was posted."

requirements-completed: [DOCC-02, SEC-04]

# Metrics
duration: ~16min across the wave-1 draft (43d9c05), a pre-checkpoint correction (1156a1b), and the post-checkpoint filing (454090f)
completed: 2026-08-03
---

# Phase 1 Plan 3: Upstream Soundness-Claim Correction and Public Issue Filing Summary

**`fjs/todo/upstream-match-partial-operation-map.md`'s false "genuinely cannot happen" claim corrected and its unsafe `command in map` workaround warned; the three upstream fix sketches left byte-identical; a public FunctionalScript issue filed and reviewed by a human before posting, with its URL recorded in the repo. The issue later turned out to be a duplicate of Sergey's own functionalscript#1419, which fixed the defect in 0.41.0 — #1420 is now closed, and the corrected file it lived in has since been deleted as no longer needed.**

## Performance

- **Completed:** 2026-08-03 (draft `43d9c05` at 17:17:14, correction `1156a1b` at 17:17:46, filing `454090f` at 17:33:47 -07:00 — the gap between the correction and the filing is the human-verify checkpoint pause)
- **Tasks:** 2/2 auto tasks completed, plus 1 blocking checkpoint (human-verify) between them
- **Files modified:** 1 at the time (`fjs/todo/upstream-match-partial-operation-map.md`); 1 file created (`01-UPSTREAM-ISSUE.md`)

## Accomplishments

- `fjs/todo/upstream-match-partial-operation-map.md`'s "Why it matters here" section was corrected from "That design is sound — an operation not in the map genuinely cannot happen" to state the actual condition: sound only if the lookup guard is `Object.hasOwn` against a null-prototype map. A naive `in` or `!== undefined` guard admits `constructor`/`toString`/`valueOf`/`__defineGetter__`, and `__defineGetter__` against such a guard installs an attacker-controlled getter on the whitelist object itself — a reproduced full escape.
- The "Local workaround" section was given a warning, before its prior "*None yet.*" text: a `command in map` guard is not safe; the correct guard is `Object.hasOwn(map, command)` against a null-prototype map.
- The "What the upstream fix should look like" section's three numbered fix sketches were left untouched — verified byte-identical via `diff` against the pre-edit text (zero output).
- `01-UPSTREAM-ISSUE.md` was drafted with the `guard-check.mjs` reproduction verbatim, the probed-commands table (`in` / `!== undefined` / `Object.hasOwn` against six commands including `__defineGetter__`), the concrete impact (a getter installed on the whitelist object that runs arbitrary code when read, verified output `ARBITRARY CODE RAN`), and `Object.hasOwn(map, command)` against a null-prototype map named as the fix.
- Before the checkpoint, a factual imprecision in the draft was caught and corrected (`1156a1b`): the draft claimed its output was "run on `functionalscript@0.40.0`", but the reproduction script imports nothing and demonstrates the property-lookup semantics `match` relies on, not `match` itself — corrected in place rather than publishing an imprecise claim.
- The `checkpoint:human-verify` task stopped execution and required a human to read `01-UPSTREAM-ISSUE.md` in full and approve the exact text before it went public — this is the point where the disclosure became irreversible, so it was gated rather than auto-approved.
- After approval, the issue was filed via `gh issue create --repo functionalscript/functionalscript`, and its URL was recorded in `fjs/todo/upstream-match-partial-operation-map.md`'s Status line (commit `454090f`) — filed as `functionalscript/functionalscript#1420`.

## Task Commits

1. **Task 1: Correct the file and draft the issue** - `43d9c05` (docs) — combined with plans 01-01 and 01-02's commits as Phase 1's wave-1 parallel batch
2. **Pre-checkpoint fix: correct a factual imprecision in the issue draft** - `1156a1b` (docs)
3. **[CHECKPOINT: human-verify]** - human read `01-UPSTREAM-ISSUE.md` in full and approved posting as-is
4. **Task 2: Post the issue and record its URL** - `454090f` (docs)

## Files Created/Modified

- `fjs/todo/upstream-match-partial-operation-map.md` - Soundness claim corrected to state its guard condition; unsafe `command in map` workaround warned; three fix sketches left byte-identical; Status line updated with the filed issue's URL.
- `.planning/phases/01-planning-document-corrections-and-the-upstream-report/01-UPSTREAM-ISSUE.md` - The exact issue body filed publicly, including the `guard-check.mjs` reproduction, the probed-commands table, and the `ARBITRARY CODE RAN` evidence.

## Decisions Made

- Publication was gated behind a `checkpoint:human-verify` task rather than proceeding autonomously, because posting a working `__defineGetter__` escape against shipped `functionalscript@0.40.0` before a fix exists is an irreversible disclosure — an explicitly accepted risk per `01-CONTEXT.md`, but one where the exact text needed review first.
- A factual imprecision was caught and fixed before the checkpoint's human review rather than after, so the human reviewed the corrected text, not the flawed draft.

## Deviations from Plan

None from the plan as written — the pre-checkpoint correction (`1156a1b`) is a Rule 1 auto-fix (a factual bug in the draft caught before it mattered) applied within Task 1's own scope, not a deviation from the plan's structure or intent.

## Issues Encountered

None during execution. One important post-execution development, recorded here for accuracy:

**#1420 is now closed as a duplicate.** The issue filed by this plan turned out to describe the same defect as Sergey's own `functionalscript#1419`, which fixed it in FunctionalScript **0.41.0**: `match` now does `at(command)(map)` + `assert(handler !== null, command)`, where `at` is `getOwnPropertyDescriptor`-based, so inherited names never resolve — the `__defineGetter__` escape this plan reported is closed upstream, verified by execution against the installed 0.41.0 (`casRead` still dispatches; `fetch`/`constructor`/`toString`/`valueOf`/`__defineGetter__` are all refused; the whitelist is left unpolluted with no getter installed). `functionalscript/functionalscript#1420` is now **closed**. `fjs/todo/upstream-match-partial-operation-map.md`, the file this plan corrected, has since been **deleted** — correctly, per AGENTS.md's rule to delete a `todo/` upstream-gap file once a released FJS version makes it unnecessary. This does not change what this plan delivered or its correctness at the time: the soundness-claim correction and the disclosure were both true and necessary against `functionalscript@0.40.0`, the version in use when this plan executed.

## Next Phase Readiness

- Phase 3 (restricted interpreter) no longer needs to build a local `Object.hasOwn` guard as a defense — the guard condition is now satisfied upstream by fjs 0.41.0 itself, reducing Phase 3's scope (recorded in `.planning/STATE.md`'s Blockers/Concerns section).
- Independently re-verified: `01-VERIFICATION.md` (2026-08-03, must-haves #2, #6, #9) confirms the corrected soundness claim, the filed issue with recorded URL (open at verification time, `state: OPEN`), and the byte-identical fix sketches via direct `diff`. The issue's later closure and the file's later deletion happened after that verification, as part of the subsequent `functionalscript` 0.41.0 merge (`3cbcaad`) and are confirmed live in the current repository (`gh issue view 1420` reports `state: CLOSED`; `fjs/todo/upstream-match-partial-operation-map.md` no longer exists on disk).

---
*Phase: 01-planning-document-corrections-and-the-upstream-report*
*Completed: 2026-08-03*
