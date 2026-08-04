---
phase: 02-server-skeleton-safe-registration-project-local-store
plan: 02
subsystem: mcp-server
tags: [mcp, functionalscript, fjs, virtual-harness, protocol-negotiation, testing-integrity]

# Dependency graph
requires:
  - phase: 02-server-skeleton-safe-registration-project-local-store
    provides: "financeMcpServer/financeConfig/financeMcpHandlers (Plan 01)"
provides:
  - "proof.session in fjs/server/module.f.js — a full initialize -> notifications/initialized -> tools/list -> tools/call session driven against the real financeMcpServer through fjs/effects/node/virtual, synchronous, no real process or filesystem"
  - "Empirical, assertion-backed proof that mcpStep discards the client's requested protocolVersion and always returns financeConfig's pinned 2025-11-25"
  - "fjs/todo/upstream-mcp-protocol-version-negotiation.md — the recorded fjs-owned capability gap, framed as a release, not local glue"
  - "A corrected AGENTS.md testing-method rule: file-targeted node --test invocations (even by explicit path) report a fake pass, proven by an injected failing proof leaf"
affects: [02-03-real-registration, phase-3-restricted-interpreter, all-future-fjs-proof-authoring]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "virtual(state)(effect) from fjs/effects/node/virtual is synchronous — a proof leaf can call it directly and assert on the returned [finalState, result] tuple, no Promise/awaitIfPromise needed."
    - "Splitting state.stdout on newlines and JSON.parse-ing every non-empty line is the stdout-purity assertion pattern (MCP-05): if anything non-JSON-RPC were ever written to stdout, the parse throws and the proof fails."
    - "Only npm test / node --test all.test.js perform real Emergent Testing registration via all.test.js's loadModuleMap walk; any file-targeted node --test invocation (bare directory or explicit .f.js path) reports a fake pass — proven, not assumed, by injecting a leaf that throws unconditionally."

key-files:
  created:
    - fjs/todo/upstream-mcp-protocol-version-negotiation.md
  modified:
    - fjs/server/module.f.js
    - AGENTS.md

key-decisions:
  - "The mcpStep non-negotiation gap is recorded as an fjs-owned upstream capability (a change to mcpStep's initialize handler itself, in fjs/protocol/mcp/module.f.js), not as a local wrapper — per AGENTS.md's ownership model, since we are FunctionalScript contributors/owners, a missing generic MCP capability is released as a new fjs version, never patched around locally."
  - "No local workaround was written or planned for the non-negotiation gap: financeConfig pins 2025-11-25 and every client is told that version regardless of what it requested; the file states explicitly that a fix, if ever needed, is a new fjs release."
  - "AGENTS.md's testing-method guidance was corrected: the file previously advised targeting a .f.js file by explicit path as an alternative to a bare directory argument, but both are fake passes — verified by injecting a proof leaf that throws unconditionally and observing npm test correctly report 'tests 8, pass 7, fail 1' while node --test fjs/server/module.f.js reported 'tests 1, pass 1, fail 0' (a false green) on the identical file."

requirements-completed: [MCP-05]

# Metrics
duration: single commit, ~8min after Plan 01's commit (cd71939 at 18:20:56 -> c2230e2 at 18:28:35)
completed: 2026-08-03
---

# Phase 2 Plan 2: Full-Session Virtual-Harness Proof and Upstream Negotiation Gap Summary

**`proof.session` drives a complete `initialize -> notifications/initialized -> tools/list -> tools/call` session against the real `financeMcpServer` through `fjs/effects/node/virtual`, synchronously and with no real process or filesystem. One leaf empirically proves `mcpStep` discards the client's requested protocol version (client asks for `2025-06-18`, server still answers `2025-11-25`). The gap is recorded as an fjs-owned upstream capability in a new todo file. Along the way, a real testing-method defect in AGENTS.md was caught and corrected: file-targeted `node --test` invocations report a fake pass, proven by injecting a deliberately failing proof leaf.**

## Performance

- **Duration:** ~8 min (commit `c2230e2` at 2026-08-03T18:28:35-07:00, following Plan 01's commit `cd71939` at 18:20:56-07:00)
- **Completed:** 2026-08-03
- **Tasks:** 2/2 completed (Task 1 was TDD: proof leaves written and confirmed to fail when their assertions are falsified, then confirmed to pass on the real behavior)
- **Files modified:** 3 (`fjs/server/module.f.js` extended, `fjs/todo/upstream-mcp-protocol-version-negotiation.md` created, `AGENTS.md` corrected)

## Accomplishments

- `fjs/server/module.f.js`'s `proof` export gained a `session` key, additive to the existing construction-only `proof.financeMcpServer` leaf, implementing: building stdin bytes for four newline-terminated JSON-RPC lines (`initialize` with `id: 1` requesting protocol version `2025-06-18` — deliberately not the pinned `2025-11-25` — `notifications/initialized`, `tools/list` with `id: 2`, `tools/call` with `id: 3` targeting `evo_list`); running `virtual({ ...emptyState, stdin: toBytes(session) })(financeMcpServer('/'))`; and asserting against the resulting state.
- `proof.session.stdoutIsPureJsonRpc` splits `state.stdout` on newlines and `JSON.parse`s every non-empty line, asserting `jsonrpc === '2.0'` on each — proving MCP-05's stdout-purity requirement empirically: any non-JSON-RPC write to stdout would throw and fail the proof.
- `proof.session.stderrIsEmpty` asserts `state.stderr === ''` across the whole session.
- `proof.session.initializeIgnoresRequestedProtocolVersion` asserts the `initialize` response's `result.protocolVersion === '2025-11-25'` and `result.serverInfo.name === 'finance-mcp'` even though the simulated client requested `2025-06-18` — the empirical, assertion-backed demonstration (not an inspection-only claim) that `mcpStep` does not negotiate. Confirmed load-bearing per the plan's acceptance criteria: temporarily asserting the wrong protocol version made the leaf fail, then the mutation was reverted before completion.
- `proof.session.toolsListEnumeratesComposedRegistry` asserts the `tools/list` response includes an `evo_list` entry, proving both `casToolRegistry` and `evoToolRegistry` composed correctly.
- `proof.session.toolsCallReachesRealHandler` asserts the `tools/call` response has no `error` key and `result.content[0].type === 'text'` — a real registered handler executed and returned a real result, the proof-level analogue of "an actual tools/call arrives," reused as one input into Plan 03's Success Criterion 1 (the other input being a real external client).
- `fjs/todo/upstream-mcp-protocol-version-negotiation.md` (117 lines) was created, following the structure of the (then-still-present) `upstream-match-partial-operation-map.md`: it names the exact defect location (`mcpStep`'s `initialize` handler in `fjs/protocol/mcp/module.f.js`, which validates but discards `params.protocolVersion`), cross-references `proof.session` as the empirical evidence, states the `2025-11-25` pin, and frames "What the upstream fix should look like" as a generic MCP capability belonging in `mcpStep` itself — never a per-app wrapper — since AGENTS.md's ownership model holds fjs as something this project owns and releases, not merely depends on. It states explicitly that no local workaround exists or is planned, and that upstreaming is unscheduled — filed only if Plan 03's empirical real-client check surfaces an actual incompatibility.
- While building this proof, a real defect in `AGENTS.md`'s own testing-method guidance was caught and corrected (Rule 1, auto-fixed within scope): the file warned that a bare directory argument to `node --test` gives a fake pass and advised targeting a file by explicit path instead — but the explicit-path form is *also* a fake pass, since Emergent Testing registration only happens when `all.test.js` is imported. Verified by injecting a proof leaf that throws unconditionally: `npm test` correctly reported `tests 8, pass 7, fail 1`, while `node --test fjs/server/module.f.js` reported `tests 1, pass 1, fail 0` — a false green — on the identical file. The plan's own `<verify>` block had used the false form; it would have passed a broken proof undetected.

## Task Commits

1. **Task 1: Full-session virtual-harness proof on financeMcpServer** (TDD) - `c2230e2` (test)
2. **Task 2: Record the mcpStep non-negotiation gap as an fjs upstream capability, not local glue** - `c2230e2` (test, same commit — includes the AGENTS.md testing-method correction discovered while verifying Task 1)

## Files Created/Modified

- `fjs/server/module.f.js` - Extended `proof` with a `session` key (5 leaves: stdout purity, stderr emptiness, non-negotiation, tools/list composition, tools/call handler reachability); construction-only `proof.financeMcpServer` left untouched.
- `fjs/todo/upstream-mcp-protocol-version-negotiation.md` - New file recording the fjs-owned non-negotiation gap.
- `AGENTS.md` - Corrected the testing-method rule: explicit-file-path `node --test` invocations are also a fake pass, with the injected-failure evidence recorded inline.

## Decisions Made

- The non-negotiation gap is recorded as an upstream fjs capability, not local glue, per AGENTS.md's ownership model — this project is a FunctionalScript contributor/owner, so a missing generic protocol-negotiation capability belongs in a released fjs version, never a wrapper around `mcpStep`.
- No local workaround was written: `financeConfig` continues to pin `2025-11-25` unconditionally; the recorded plan is to revisit only if Plan 03's live-client check reveals an actual incompatibility, and to file the real GitHub issue only at that point, not speculatively.
- The AGENTS.md testing-method correction was made in-scope for this plan (discovered directly while verifying Task 1's proof leaves), rather than deferred, since a wrong testing instruction would silently produce fake passes for every future `.f.js` proof in the project.

## Deviations from Plan

**1. [Rule 1 - Bug] Corrected AGENTS.md's testing-method guidance.**
- **Found during:** Task 1/Task 2, while verifying the new `proof.session` leaves actually fail on falsified assertions.
- **Issue:** AGENTS.md advised that targeting a `.f.js` file by explicit path with `node --test` was a safe alternative to a bare directory argument; it is not — both report a fake pass because Emergent Testing registration only happens through `all.test.js`'s `loadModuleMap` walk.
- **Fix:** Corrected the guidance and recorded the injected-failure evidence (`npm test` -> `tests 8, pass 7, fail 1`; `node --test fjs/server/module.f.js` -> `tests 1, pass 1, fail 0`) directly in AGENTS.md.
- **Files modified:** `AGENTS.md`
- **Commit:** `c2230e2`

## Issues Encountered

None beyond the AGENTS.md defect documented above, which is not a blocker.

## Next Phase Readiness

- Plan 03 (real registration) can proceed with confidence that the protocol shape is correct and the non-negotiation behavior is understood and recorded, not merely hoped to be harmless — its own empirical check against a real `claude` client (registering with `2025-11-25`) either confirms no real-world friction (as it did) or would have triggered escalation of the upstream gap.
- Independently re-verified: `02-VERIFICATION.md` (2026-08-03T18:35:00Z, must-haves #4, #9, #11) confirms `npm test` reports `tests 7, pass 7, fail 0` including `proof.session.stdoutIsPureJsonRpc` and `proof.session.stderrIsEmpty`, confirms `fjs/todo/upstream-mcp-protocol-version-negotiation.md`'s exact framing (no wrapper proposed), and independently confirms the AGENTS.md fake-pass correction's wording and evidence, using `npm test` exclusively for its own checks.

---
*Phase: 02-server-skeleton-safe-registration-project-local-store*
*Completed: 2026-08-03*
