---
phase: 05-document-base-subject-model-and-the-first-two-dialects
plan: 04
subsystem: server
tags: [doc-14, mcp-tool, cross-process, evo-cache, upstream-gap]

# Dependency graph
requires:
  - phase: 02
    provides: "fjs/server/module.f.js — financeMcpHandlers, casToolRegistry, evoToolRegistry, the stdio transport and the real launcher index.js"
provides:
  - "fjs/server/module.f.js — casRefreshTool(cas)(cacheKey): the cas_refresh MCP tool, a third registry entry alongside casToolRegistry and evoToolRegistry"
  - "cas-refresh-cross-process.test.js — a genuinely separate-process integration test (2 spawn() calls, no in-process harness)"
  - "fjs/todo/upstream-node-spawn-effect.md — the recorded fjs capability gap the local workaround exists because of"
affects: [06, 07]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Refresh is an explicit, callable MCP tool, never an automatic side effect of every read — a full buildCache rescan on each evo_head would make every query O(store)."
    - "@ts-nocheck confined to one root-level cross-process harness; zero occurrences under fjs/. Typing node:child_process needs @types/node, which AGENTS.md forbids as a hard stop."

key-files:
  created:
    - cas-refresh-cross-process.test.js
    - fjs/todo/upstream-node-spawn-effect.md
  modified:
    - fjs/server/module.f.js

key-decisions:
  - "buildCache (full rescan) over syncRevision (targeted): syncRevision needs the hash and bytes handed to it, which an external `npx functionalscript cas add` does not provide. A tool that requires the caller to already know what changed cannot answer 'what did another process write?'."
  - "The proof uses two real OS processes, not an in-process simulation. Criterion 5's own wording — 'an in-process simulation does not test the thing that breaks' — makes the separate process the point of the test rather than an implementation detail of it."

patterns-established:
  - "An upstream-gap record is narrowed to what is actually missing. The executor found mid-task that fjs/effects/node DOES have an Exec effect and corrected its own claim: the real gap is the absence of a long-lived STREAMING spawn effect for driving a persistent server across many stdin/stdout round trips, not the absence of subprocess support altogether."

requirements-completed: [DOC-14]

# Metrics
duration: ~40min
completed: 2026-08-04
---

# Phase 05 Plan 04: `cas_refresh` and the Cross-Process Proof Summary

**The running `finance-mcp` server can be told to notice content another process wrote directly into its CAS store — proven by two genuinely independent OS processes, not a simulation.**

> **Bookkeeping note:** this summary was written after the fact, on 2026-08-04, from `05-04-PLAN.md` and commit `f25ca2d`. Its absence is why `roadmap.analyze` reported Phase 5 as `partial` while all four plans were in fact executed. The work itself landed with plan 05-01 in `f25ca2d` (Wave 1, two plans in parallel over disjoint files).

## Performance

- **Duration:** ~40 min
- **Completed:** 2026-08-04 (commit `f25ca2d`)
- **Files created:** 2 — **modified:** 1
- **Tests at the time:** 40 → 52 pass, 0 fail; `tsc --noEmit` clean

## Accomplishments

- **`casRefreshTool`** in `fjs/server/module.f.js` — rescans the store via `buildCache` and writes the new cache over the existing key, wired in as the third entry of `financeMcpHandlers` alongside `casToolRegistry` and `evoToolRegistry`.
- **`cas-refresh-cross-process.test.js`** — starts a real `node index.js <home>` server against a fresh CAS home (one OS process), has a real `npx functionalscript cas add` write a `vnd.fjs.revision` blob directly into that same store while the server is already running (a second, independent OS process, bypassing `evo_add` entirely), then drives `evo_head` → `cas_refresh` → `evo_head` over real stdio. **2 `spawn()` calls, 0 in-process harness**, clean exit, no stray processes.
- **`fjs/todo/upstream-node-spawn-effect.md`** — the recorded gap, per AGENTS.md's rule that a workaround for an fjs gap must never be silent.

## The `@ts-nocheck` carve-out, and why it is one file

`node:child_process` cannot be typed without `@types/node`. AGENTS.md forbids adding *any* dependency — devDependencies included — without every repo owner's approval, and calls it a hard stop rather than a preference. The alternatives were: seek approval to typecheck one test harness, abandon Criterion 5's separate-process requirement, or confine `@ts-nocheck` to that single root-level file.

The third was chosen. `package.json` is untouched and there are **zero** `@ts-nocheck` occurrences under `fjs/` — the file sits with `index.js` and `all.test.js` in AGENTS.md's existing carve-out for root-level impure JS.

## Requirements Completed

- **DOC-14** — the >128 KiB CLI ingestion route and its cache-refresh path (Success Criterion 5).
