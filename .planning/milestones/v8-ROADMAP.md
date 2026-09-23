# Milestone v8 — The Narrower Trap

**Opened and closed:** 2026-09-22 · **Phases:** 44, 45 · **Requirements:** MAINT-17, MAINT-18, MCP-10

A release made this repository's JSON round trip *more* faithful, and the proof that pinned the
old behavior reddened. The milestone is named for what that turned out to mean: the warning the
code carries survived, and the set of inputs that trip it got smaller.

---

## Phase 44: Take FunctionalScript 0.50.0
**Requirements:** MAINT-17, MAINT-18 · **Tier:** T3 · **Status:** complete 2026-09-22 · PR #173

`parse` stopped sorting string keys, answering ECMAScript's own property order instead —
integer-like keys first, ascending, then source order. One proof of 3,457 reddened, and it was
the one written to pin exactly that asymmetry. It is now two leaves, one per direction.

Sized from a probe in a throwaway worktree rather than from release notes; there is no changelog
entry for the change. Record: `.planning/reports/fjs-0.50.0-migration.md`.

`fjs/todo/upstream-evo-list-raw-typeerror.md` deleted — the release carries its fix, verified by
running the note's own reproduction. `fjs/todo/upstream-web-vec-size-limit.md` survives.

## Phase 45: Publish the guest vocabulary
**Requirements:** MCP-10 · **Tier:** T2 · **Status:** complete 2026-09-22 · PR #174

An agent holding only the MCP surface could not write a program `fjs_run` would run. `fjs_run`'s
description now publishes the entry-point spelling and all ten `ctx.` members, derived from
`taxGuestCtx` so the list cannot drift from the context a guest is handed.

This is the half of Phase 36's gap that never needed a person at a client. Phase 36 stays open
for the half that does.

---

## What the milestone leaves open

**MAINT-11's `fjs web` half, PARTIAL since v6.** See `v8-REQUIREMENTS.md`.

**Phases 34 and 36**, blocked on a person at a real client since v4 and v5 respectively.
