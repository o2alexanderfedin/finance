# Milestone v7: The Drop-In

**Status:** ✅ SHIPPED 2026-09-10
**Phases owned:** 43 — one phase
**Plans:** 0. None written; executed direct-to-PR, as v6 was.
**Opened:** 2026-09-10 (PR #161) · **Closed:** 2026-09-10 (this archive)
**Audit:** [`v7-MILESTONE-AUDIT.md`](./v7-MILESTONE-AUDIT.md) — two COVERED, **none PARTIAL**,
none MISSING. The first milestone in this project's history with no PARTIAL verdict.

## Overview

Opened and closed the same day v6 closed, and the reason it is that small is that **the
migration was performed before the milestone was written**. 0.49.0 was installed in a
throwaway git worktree off `fe16839` and the repository was run against it unchanged;
everything passed. The milestone was then scoped to what the measurement said — one phase —
instead of the four a changelog-driven reading of "140 upstream files changed" would have
produced.

**Requirements delivered:** MAINT-15 (take 0.49.0), MAINT-16 (the consumer-side report). Full
bodies stay in `.planning/REQUIREMENTS.md`, which is not deleted at milestone close here — the
reason is in [`v6-REQUIREMENTS.md`](./v6-REQUIREMENTS.md) and unchanged.

---

## Phase

### Phase 43: Take FunctionalScript 0.49.0

**Requirements**: MAINT-15, MAINT-16 · **Tier**: T3 · **Status**: complete 2026-09-10, PR #163.

**The entire migration:**

```diff
-    "functionalscript": "^0.48.0"
+    "functionalscript": "^0.49.0"
```

**Acceptance — Phase 42's four criteria, unchanged:**

| # | Criterion | Result |
|---|---|---|
| 1 | `package.json` names 0.49.0 explicitly; `tsc` | **0 errors** |
| 2 | `toJsonSchema` over all 30 served dialect schemas byte-identical | ✅ `6062f5b85f01160b` both sides |
| 3 | proof-leaf **set** may only grow; no assertion count falls | ✅ 3388 → 3388, `comm -23` empty; 123 files, not one moved |
| 4 | full battery | ✅ 3457/3457 · 13/13 · 46/46 · cov 100/100/100 |

---

## Progress at close

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 43. Take FunctionalScript 0.49.0 | **v7** | 0/0 — no plans written | Complete (MAINT-15, MAINT-16); zero source lines changed | 2026-09-10 |

---

## Milestone Summary

**Decimal phases:** none.

### Key decisions

- **Size the milestone by performing the migration, not by reading the changelog.** A
  throwaway worktree, an `npm install` and ten minutes produced evidence where planning would
  have produced an estimate. **It is strictly cheaper than the planning it replaces.**
- **The probe is not the phase.** It deliberately skipped `test:ui` and `npm run cov`, and both
  were written into the acceptance criteria as the phase's to run. A probe that quietly becomes
  the verification is a proof that stopped watching.
- **Name the requirement by version, never as "the latest".** MAINT-09 says "take 0.47.0" and
  0.47.0 was superseded four days later; the ID was not re-pointed, because a requirement that
  silently re-aims makes the record of what was actually taken unrecoverable. 0.49.0 was still
  latest when the phase ran, and that was re-checked at execution time rather than assumed.
- **Run the byte-identity check even when the source diff is empty.** The served schemas are
  built from upstream's `rtti` combinators, so they are a function of the dependency and not of
  our source. Five seconds; skipping it is how 47 containers moved unnoticed in Phase 38.
- **Decline a capability that only adds.** v6's MAINT-11 admitted each 0.47.0 capability because
  it *deleted* something here. 0.49.0's additions do not — `allOk`, `both` and `And` are used at
  zero sites, `errorMessage` is forbidden by this repository's own SEC convention, and
  `readdir`'s new `isDirectory` has no caller. No adoption phase was written.

### Issues resolved

- The repository is current with the published `functionalscript` again, eight days after
  0.49.0 shipped. `AGENTS.md`'s re-read rule is what surfaced it — without that rule this would
  have been a second, longer repeat of 0.47.0 going unnoticed for four days.

### Issues deferred

- **Phases 34 and 36**, open since v4, untouched and untouchable by any release: they are
  blocked on a person at a real client with real documents.
- **Whether the accountant-facing demo becomes a requirement category of its own.** Open since
  `v4-MILESTONE-AUDIT.md` F-01.

### Technical debt incurred

**None by this milestone.** Nothing was shortcut, no `try` was added (the count under
`fjs/**.f.js` is still one), no dependency was added, no proof was lost, and no schema moved.

**Carried, not incurred:** MAINT-11's `fjs web` half stays PARTIAL — `fjs/web/module.f.mjs` is
byte-identical across the bump, so the 413 ceiling stands and `functionalscript#1819` is still
open.

**One documentation sharpness worth carrying forward:** `AGENTS.md`'s own
`grep -rn 'try {' fjs --include='*.f.js'` recipe **counts its own citation** in
`fjs/refuses/module.f.js:64`, returning 2 where the invariant is 1. The docstring there says so
in advance; a reader running the grep cold will still pause. Recorded in the audit, not fixed.

---

_For current project status, see `.planning/ROADMAP.md` and `.planning/STATE.md`._
