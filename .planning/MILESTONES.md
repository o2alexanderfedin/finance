# Project Milestones: Finance

Entries newest first.

> **This ledger is born at v6 and v1–v5 predate it.** Do not read the entries below as
> evidence that v6 was the first milestone — it is the first one *archived this way*. The
> earlier five are recorded in `.planning/ROADMAP.md` (phases 1–38, milestone headings in
> place), in `.planning/STATE.md`'s "Earlier milestones" section, in
> `.planning/v4-MILESTONE-AUDIT.md`, and in the tags `v0.10.0`, `v0.12.0` and `v1.0.0`.
> Retro-filling them was considered and rejected: a milestone entry written months late from
> a git log is a reconstruction presented as a record, which is the failure this project
> spends most of its planning discipline avoiding.

---

## v7 The Drop-In (Shipped: 2026-09-10)

**Delivered:** `functionalscript` 0.49.0 taken in one line, with every acceptance criterion met
and an empty source diff — and the consumer-side report that says so with evidence.

**Phases completed:** 43 (1 phase, 0 plans). Opened and closed the same day v6 closed.

**Key accomplishments:**

- **Sized the milestone by performing the migration.** Before a requirement was written, 0.49.0
  was installed in a throwaway git worktree and the repository run against it unchanged.
  Everything passed, so the milestone was scoped to one phase instead of the four a
  changelog-driven reading of "140 upstream files changed" would have produced. **The probe cost
  ten minutes and is strictly cheaper than the planning it replaces** — and unlike planning, its
  output is evidence.
- **Kept the probe and the proof separate.** It deliberately skipped `test:ui` and `npm run cov`,
  both written into the acceptance criteria as the phase's to run. A probe that quietly becomes
  the verification is a proof that stopped watching.
- **Ran the byte-identity check on a migration with an empty source diff** — the check that
  looks most skippable and is not: the served schemas are built from upstream's `rtti`
  combinators, so they are a function of the dependency, not of our source. All 30 identical,
  sha `6062f5b85f01160b`.
- **Protected two upstream notes from being tidied away**, and taught each to record the re-read
  rather than merely survive it. `fixed` and `released` are different states.
- **Declined every new capability, on the rule v6 established** — admitted only if it *deletes*
  something here. None of 0.49.0's does.

**Stats:**
- 8 files changed: `package.json`, `package-lock.json`, 2 `fjs/todo/` notes (additions only),
  4 planning files, plus the new report
- **0 source lines changed** under `fjs/`, `demo/`, `ui-tests/` or any `*.test.js`
- 1 phase, 0 plans, 3 pull requests (#161 opened the milestone, #162 fixed three figures, #163 executed it)
- Same day, open to close
- Suite at close: `npm test` **3457/3457**, `test:integration` **13/13**, `test:ui` **46/46**,
  `cov` **100.00/100.00/100.00**, `tsc` **0**, proof leaves **3388 → 3388**

**Git range:** `f2a63d1` (PR #161, milestone opened) → `133f25a` (PR #163)

*(This read `d0cdd22` until it was checked: that is PR #162, the figure fix, not the milestone opening. The v6 row two entries down names its opening merge and set the convention.)*

### Known gaps at close

- **MAINT-11 stays PARTIAL, carried from v6.** `fjs/web/module.f.mjs` is byte-identical across
  the bump, so the 413 ceiling stands, `demo/serve.sh` still runs `python3`, and
  [`functionalscript#1819`](https://github.com/functionalscript/functionalscript/issues/1819)
  is still open.
- **Neither upstream fix this project landed is in any published release.** `#1899` merged
  2026-09-08 and `#1900` on 2026-09-10, both after 0.49.0 was cut on 2026-09-02. Verified
  against the tarball, not inferred from dates.
- **Phases 34 and 36 remain open**, as they have since v4.

### A documentation sharpness, recorded rather than fixed

`AGENTS.md`'s own `grep -rn 'try {' fjs --include='*.f.js'` recipe **counts its own citation**
in `fjs/refuses/module.f.js:64`, returning 2 where the invariant is 1. The docstring there says
"still returns exactly one CODE hit", so it anticipated the confusion — but a reader running the
grep cold will pause, as this milestone's audit did.

**What's next:** undecided. The oldest open question is still whether the accountant-facing demo
becomes a requirement category of its own — open since `v4-MILESTONE-AUDIT.md` F-01.

---

## v6 A Current Engine, Actually Current (Shipped: 2026-09-10)

**Delivered:** The engine runs on a FunctionalScript that is actually current rather than
current-as-of-the-plan — two releases taken eleven days apart, a protocol gap and a proof that
could not fail both retired, and a malformed document can no longer be stored.

**Phases completed:** 39, 40, 41, 42 — executed `42 → 39 → 40 → 41`. **0 plans**: the
milestone was run direct-to-PR and no `PLAN.md` was written, which is recorded as a finding
rather than a footnote.

**Key accomplishments:**

- **Took 0.48.0 without moving a single served byte.** 140 `rtti` import sites relocated and
  459 `option(…)` calls rewritten from a wrapper into a union member — and `toJsonSchema` over
  **all 30** dialect schemas came out byte-identical. That equality, not the green suite, is
  what decided the phase; Phase 38 is where this repository learned that compiling is not
  evidence.
- **Retired the protocol-version gap, and the proof that could not have failed.** The old
  fixture asked for a revision the server did not support, so negotiating and pinning returned
  the same answer and the assertion passed either way. The replacement asks for a supported
  *non-latest* revision, which only a negotiating server can echo back.
- **Closed the write-path hole: a malformed `vnd.fjs.w2` used to be stored, routed and
  computed from.** `cas_add` now refuses it — and the refusal is proven to happen *before* the
  store by reading the listing back and asserting it is empty.
- **Wrote the consumer's side of a release the library author cannot see**, folding 0.47.0's
  unreported migration in as §5.1, and put the standing upstream authority in `AGENTS.md` as an
  extension of the gap rule rather than a replacement for it.
- **Drove coverage to 100.00 / 100.00 / 100.00 across all 122 files and found six real defects
  behind the gaps**, then raised the thresholds from 90 to 100 and proved they bite.
- **Ran all three owner-blocked phases as far as they go without the owner.** 35 completed —
  the engine's lines fill the IRS's own `f1040.pdf`. 34 and 36 executed to their real boundary
  and left honestly open.

**Stats:**
- 142 files changed, +14,509 / −1,439 across the milestone window
- 79 commits, 17 pull requests (#143 → #159)
- 4 phases owned, 0 plans, 0 tasks recorded
- 11 days (2026-08-31 → 2026-09-10)
- Suite at close: `npm test` **3457/3457**, `test:integration` **13/13**, `test:ui` **46/46**,
  coverage **100.00 / 100.00 / 100.00** at thresholds that fail the build, `tsc` **0**

**Git range:** `1e4e27b` (PR #143, milestone opened) → `8a45d2b` (PR #159)

### Known gaps at close

- **MAINT-11 is PARTIAL.** `fjs web` answers 413 above 131072 bytes and eleven demo modules
  exceed it, so `demo/serve.sh` still runs `python3 -m http.server`. Filed as
  [`functionalscript#1819`](https://github.com/functionalscript/functionalscript/issues/1819),
  **still open** — and correctly so: it closes when a consumer can serve a large file, not when
  a document describes how.
- **Phases 34 and 36 remain open**, blocked since v4 on a person at a real client with real
  documents. Phase 36's crash half was fixed (PR #157); its vocabulary half — the guest ABI is
  named by no tool description, no served schema and no refusal — is not.
- **FunctionalScript 0.49.0 shipped 2026-09-02 and this repository is still on 0.48.0.**
  `AGENTS.md`'s re-read rule fires on exactly that event. Taking it is a milestone-sized
  decision and is surfaced, not started.

### Shipped inside this window, outside the ledger

Recorded because the alternative is that it goes unrecorded, which this project has already
done once — see `STATE.md`, "Shipped outside the ledger". These carry no requirement ID and no
roadmap row:

| PR | What shipped |
|---|---|
| #150 | The `fjs web` ceiling taken upstream, and v6 audited against the source |
| #151 | Coverage to 100% across all 122 files, and the defects that hid behind the gaps |
| #152 | `loadProgram` rendered its failure with `String(e)`; the other two reports were not defects |
| #153, #159 | The two upstream notes linked to their PRs, then updated when both merged |
| #157 | A guest program's throw is an error result, not the end of the session |
| #158 | `ui-tests`' `store` helper must mean *stored*, not *clicked* |

Upstream in the same window: `functionalscript#1899` (merged 2026-09-08) closed a virtual/real
interpreter divergence; `#1900` (merged 2026-09-10) landed the streaming-HTTP-bodies design in
upstream's own `todo/`. Neither is in a published release — 0.49.0 shipped before both merges.

**What's next:** undecided. The live candidate is FunctionalScript 0.49.0; the open question
older than it is whether the accountant-facing demo becomes a requirement category of its own.
Both are the owner's call.

---
