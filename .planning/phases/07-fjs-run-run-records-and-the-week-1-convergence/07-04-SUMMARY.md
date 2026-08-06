---
phase: 07-fjs-run-run-records-and-the-week-1-convergence
plan: 04
subsystem: mcp-server
tags: [fjs-run, size-guard, functionalscript, mcp, stdio]

requires:
  - phase: 07 (prior plans in this phase)
    provides: fjs/server/module.f.js's toolEntry/fromRegistry/mcpStep/stdioTransport composition pattern
provides:
  - "sizeGuard(guardBytes)(previewBytes)(content, hash): inline / truncated-preview / result-too-large decision, measured on UTF-8 byte length"
  - "previewBytes (8192) / guardBytes (65536) named constants, pinned by their own proof"
  - "tooLargeMessage(hash): the single-source-of-truth 'result too large; stored at <hash>' string"
  - "Proof that sizeGuard's decision runs before a response ever reaches stdio, demonstrated by the absence of the raw oversized content in stdout, not merely by the returned message text"
  - "Contrast proof reproducing the transport's own generic -32603 fallback directly, for a result that skips sizeGuard entirely"
affects: [fjs_run handler (Plan 06), any future tool whose result may be arbitrarily large]

tech-stack:
  added: []
  patterns:
    - "Parameterized size-check functions (curried on their own thresholds) so boundary conditions are provable with tiny values, with the shipped constants pinned separately"
    - "Ordering proofs via absent side effect (stdout never contains the raw payload), not via the returned message text alone"

key-files:
  created: [fjs/server/response/module.f.js]
  modified: []

key-decisions:
  - "sizeGuard measures byte length via fjs/text's tryUtf8 + bit_vec's length/8, matching how writeResponse itself measures the 128 KiB cap — never content.length (UTF-16 code units)"
  - "tryUtf8 returning null (content itself over the 128 KiB transport cap) is treated as 'too large' rather than a distinct failure mode, since it is a fortiori over any guardBytes"
  - "The ordering proof and the parameterized logic proof both use tiny thresholds (8/4 bytes, 16/8/4/2 bytes) — no real 64 KiB or 128 KiB string is allocated except in the contrast leaf, which must reproduce the transport's actual 128 KiB overflow to demonstrate the real failure mode (matching functionalscript's own stdio/proof.f.js technique)"

patterns-established:
  - "A module-local proof harness (McpConfig + toolEntry + fromRegistry + virtual + stdioTransport) scaled down from fjs/server/module.f.js's own session proof, for testing a pure function's interaction with the transport without pulling in the whole server"

requirements-completed: [EXEC-11]

duration: 13min
completed: 2026-08-05
---

# Phase 7 Plan 04: The Size-Guarded Response Envelope Summary

**`sizeGuard(guardBytes)(previewBytes)(content, hash)` — a pure, curried decision function (inline / truncated preview / "result too large; stored at `<hash>`") plus an ordering proof showing it runs strictly before a result ever reaches the stdio transport, proven by the absence of the raw oversized payload from stdout rather than by the returned text alone.**

## Performance

- **Duration:** ~13 min
- **Tasks:** 2/2 completed
- **Files modified:** 1 (created)
- **Project-local proof count:** 155 (baseline) -> 164 (`node --test 2>&1 | grep -c '^✔ import("./fjs/'`)

## Accomplishments

- `fjs/server/response/module.f.js` created, exporting `sizeGuard`, `previewBytes` (8192), `guardBytes` (65536), and `tooLargeMessage`.
- All three size bands (inline, truncated preview, "too large") proven with tiny thresholds (e.g. a 4-byte guard against a 28-byte literal) — no large-string allocation anywhere in the parameterized logic proof.
- A separate, trivial proof pins the shipped constants (8192 / 65536) and confirms both stay well clear of the 128 KiB stdio line cap (`maxLengthBytes === 131072n`), so the parameterized proof can never silently drift from what is actually deployed.
- An ordering proof drives one `tools/call` through a minimal registry over `virtual` + `stdioTransport`, applying `sizeGuard` (an 8-byte guard, 4-byte preview) to a ~52-byte marker string, and asserts `state.stdout` contains the "too large" message but never contains the raw marker substring — the STATE.md-precedented technique of observing the prevented side effect.
- A contrast leaf feeds an oversized `okResult` (built with **no** `sizeGuard`, a real 131,073-byte string — the transport's own 128 KiB+1 overflow point) directly through the same transport and confirms it reproduces `writeResponse`'s generic `-32603`/`"Internal error"` fallback with no size-specific text, demonstrating directly the failure mode this module exists to prevent.

## Task Commits

1. **Task 1: sizeGuard — parameterized logic, pinned constants** - `8133293` (feat)
2. **Task 2: Ordering proof and the transport-fallback contrast leaf** - `0b60573` (feat)

_No plan-metadata commit was requested as part of this executor run; STATE.md/ROADMAP.md updates below are separate from the task commits above._

## Files Created/Modified

- `fjs/server/response/module.f.js` - `sizeGuard`, `previewBytes`, `guardBytes`, `tooLargeMessage`, plus the parameterized logic proof, the shipped-constants pin, the ordering proof, and the transport-fallback contrast leaf.

## Decisions Made

- Byte length measured via `fjs/text`'s `tryUtf8` + `fjs/types/bit_vec`'s `length` (divided by 8), matching `writeResponse`'s own measurement convention — never `content.length` (UTF-16 code units), per the plan's explicit instruction.
- `tryUtf8` returning `null` (content already over the transport's 128 KiB cap) is folded into the "too large" branch rather than treated as a distinct case — it is *a fortiori* over any `guardBytes` this function would be configured with.
- `tooLargeMessage` extracted as its own exported function (single source of truth for the contract string), used both by `sizeGuard` internally and directly asserted against in its own proof leaf, so a future edit to the wording cannot drift between the two call sites.
- The ordering proof uses small thresholds (8/4 bytes) and a ~52-byte marker string rather than the shipped 65536/8192 constants — this keeps the proof cheap while still exercising the real code path (`sizeGuard` invoked exactly as a handler would call it), consistent with 07-CONTEXT.md's "no real 128 KiB payload in a proof" guidance for the parameterized logic. The contrast leaf is the one deliberate exception: reproducing the transport's *actual* `-32603` fallback requires actually exceeding its real 128 KiB cap, matching the technique already used in `functionalscript/fjs/protocol/mcp/stdio/proof.f.js`'s own `oversizedResponseWritesInternalError` leaf.

## Deviations from Plan

None - plan executed exactly as written. Both tasks' acceptance criteria are met verbatim (including the exact `'result too large; stored at HASH'` string in the Task 1 proof), and no auto-fixes, blockers, or architectural questions arose.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `sizeGuard`/`previewBytes`/`guardBytes` are ready to be imported unchanged by Plan 06's `fjs_run` handler, per the plan's own objective ("fully self-contained... reused unchanged by Plan 06").
- The response envelope's uniform shape (`{ resultHash, runHash, preview, truncated }`, per 07-CONTEXT.md) is Plan 06's responsibility to assemble around `sizeGuard`'s `{ preview, truncated }` output plus the CAS-written result hash — this plan deliberately did not build that wrapping, staying self-contained (no CAS, no interpreter, no materialization) as scoped.
- No blockers for the remaining Phase 7 plans.

---
*Phase: 07-fjs-run-run-records-and-the-week-1-convergence*
*Completed: 2026-08-05*

## Self-Check: PASSED

- FOUND: `fjs/server/response/module.f.js`
- FOUND: `.planning/phases/07-fjs-run-run-records-and-the-week-1-convergence/07-04-SUMMARY.md`
- FOUND commit: `8133293` (Task 1)
- FOUND commit: `0b60573` (Task 2)
