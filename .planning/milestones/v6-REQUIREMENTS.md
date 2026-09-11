# Milestone v6 — Requirements at close

**Archived:** 2026-09-10 · **Milestone:** v6 *A Current Engine, Actually Current*
**Verdicts:** 6 COVERED, 1 PARTIAL (blocked upstream), 0 MISSING.
Every verdict was reached by opening the cited file and reading it — see
[`v6-MILESTONE-AUDIT.md`](./v6-MILESTONE-AUDIT.md), which re-derives each one from source.

---

## `.planning/REQUIREMENTS.md` is NOT deleted at this milestone close, and that is deliberate

The GSD close workflow ends with `git rm .planning/REQUIREMENTS.md`, on the model that each
milestone gets a fresh requirement set. **That step is skipped here, and skipping it is the
correct call rather than an omission.** Two reasons, both checkable:

1. **`planning-truth-gate.test.js` reads the file on every `npm test`.** Its final leaf
   asserts `names.includes('.planning/REQUIREMENTS.md') === true` (line 666), and the gate
   classifies all 134 requirement IDs cited across the tree against their bodies there.
   Deleting the file turns the suite red — which would mean merging a milestone close over a
   failing gate, the exact inversion this project keeps correcting.
2. **This repository's REQUIREMENTS.md was never milestone-scoped.** It is one cumulative
   177 KB document carrying all 134 requirements from v1 through v6, and requirement IDs are
   cited from code — the FORM-KEY episode found 65 citations across 36 files for two IDs the
   document had never heard of. A per-milestone reset would strand every one of those
   citations.

So this file is a **milestone-scoped index into the live document**, not a copy of it. The
full bodies stay where the gate can read them.

---

## Traceability at close

| ID | Tier | Statement | Verdict | Where it is proven |
|---|---|---|---|---|
| **MAINT-09** | T3 | Take `functionalscript` 0.47.0 — two of its 15 breaking changes reach this repository (`#1732` closed schemas, `#1654` `protocolVersions`) | ✅ **COVERED** | Superseded in-milestone by MAINT-14; `package.json` declares `^0.48.0`, installed 0.48.0. Zero live `.js` import the retired `fjs/types/rtti` path. Phase 38, PR #139 |
| **MAINT-10** | T3 | Retire the MCP protocol-version negotiation gap | ✅ **COVERED** | `fjs/server/module.f.js:664` `negotiatesTheProtocolRevision` over `twoRevisionConfig` (`:522`). Non-vacuous: a request for the supported **non-latest** `2025-06-18` is answered with `2025-06-18`; a pinning server would answer `2025-11-25` and the assertion would fail. Phase 39, PR #145 |
| **DOC-25** | T3 | A finance document is validated against its dialect on the **write** path | ✅ **COVERED** | `fjs/server/write_validation/module.f.js`, wired at `fjs/server/module.f.js:239`, proven end to end at `:608` with a positive control at `:638`. The refusal is proven to precede the store by reading `cas_list` back and asserting it is **empty**. Closed at the write boundary (Option 1); reason in `fjs/todo/no-dialect-validation-on-the-write-path.md`. Phase 40, PR #146 |
| **MAINT-11** | T3 | Adopt the 0.48.0 capabilities that **remove** code here — `toolResultStep`, `memoryRun`, `path.escapes`, `fjs web` | ⚠️ **PARTIAL — blocked upstream** | `toolResultStep` adopted at 4 sites in `fjs/server/module.f.js`; `okResult`/`errorResult` no longer appear at all. **The `fjs web` half is not done:** it answers 413 above 131072 bytes and eleven demo modules exceed it, so `demo/serve.sh:74-86` still runs `python3`. `fjs/todo/upstream-web-vec-size-limit.md` → [`functionalscript#1819`](https://github.com/functionalscript/functionalscript/issues/1819), **still open**. Phase 41, PR #147 |
| **MAINT-12** | T3 | A consumer-side migration report, in the shape Sergey asked for in `todo/update-fjs-0.46.0` | ✅ **COVERED** | `.planning/reports/fjs-0.48.0-migration.md`, 232 lines. Named for 0.48.0, not 0.47.0 — v6 superseded 0.47.0 before the phase ran, and 0.47.0's own unreported migration is folded in as §5.1, which carries the headline finding. Phase 41, PR #147 |
| **MAINT-13** | T3 | An fjs gap may be taken upstream directly — standing authority granted 2026-08-27 | ✅ **COVERED** | `AGENTS.md:25`, written as an **extension** of the existing gap rule at `:24`, with the re-read rule at `:26`. Exercised three times since: `#1819`, `#1893` → `#1899` (merged), `#1900` (merged). Phase 41, PR #147 |
| **MAINT-14** | T3 | Take `functionalscript` 0.48.0 — `rtti` relocated (140 sites), `option` stopped being a function (459 calls / 34 files) | ✅ **COVERED** | `toJsonSchema` over **all 30** served dialect schemas byte-identical across the bump (sha `f2f79e40a957e7a6`) — the criterion that decides the phase, because a 459-site `option` rewrite is exactly the shape of change that alters every served schema while looking mechanical. Phase 42, PR #144 |

**Count at close:** 134 requirements in `.planning/REQUIREMENTS.md`, **134 checked, 0 unchecked.**
Derive rather than quote:

```sh
grep -cE '^- \[[ x]\] \*\*[A-Z]+-[0-9]+' .planning/REQUIREMENTS.md   # 134
grep -cE '^- \[ \] \*\*[A-Z]+-[0-9]+' .planning/REQUIREMENTS.md      # 0
```

---

## Requirements adjusted during the milestone

**MAINT-09's subject changed under it and the ID was kept.** It says "take 0.47.0"; 0.47.0 was
taken in v5's Phase 38 and superseded by 0.48.0 four days later, inside this milestone. The ID
was not rewritten to say 0.48.0 — MAINT-14 was coined for that — because a requirement that
silently re-points at a different release makes the record of what was actually taken, and when,
unrecoverable.

**MAINT-12's deliverable is named for a different version than its own text.** The requirement
asks for a 0.47.0 report; the file is `fjs-0.48.0-migration.md`. Folding 0.47.0's unreported
migration in as §5.1 was preferred to writing a report about a release nobody is running.

**MAINT-11 is the only requirement in this project's history closed as PARTIAL with a live
upstream blocker.** It is recorded that way rather than split into a satisfied half and a new
ID, because the half that is blocked is the half that carries the requirement's stated point:
the functionalscript-only dependency rule reaching the one place it had not.

---

## Phases 34, 35 and 36 map no requirement, and still do

Carried forward from v4 at their original numbers. The v2 Tier-B ruling in
`.planning/REQUIREMENTS.md` is why: a phase without an ID is preferable to an ID invented to
give it one. 35 completed on 2026-09-08; 34 and 36 remain open, blocked on the same person at
the same real client they have been blocked on since v4.
