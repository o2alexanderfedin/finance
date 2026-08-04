---
phase: 02-server-skeleton-safe-registration-project-local-store
plan: 01
subsystem: mcp-server
tags: [mcp, functionalscript, fjs, stdio, cas, evo, server-assembly]

# Dependency graph
requires: []
provides:
  - "financeMcpHandlers/financeConfig/financeMcpServer in fjs/server/module.f.js — our own MCP server assembled over fjs's own casToolRegistry + evoToolRegistry, no fork"
  - "fjs/index.f.js wired so main runs financeMcpServer(options.args[0] ?? '.') instead of the prior hello-world body"
  - "A project-local, gitignored CAS/Evo store path (<repo-root>/.cas), replacing the shared ~/.cas default"
affects: [02-02-full-session-proof, 02-03-real-registration, phase-3-restricted-interpreter, phase-6-and-7-fjs-run-seam]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "financeMcpHandlers composes exactly casToolRegistry + evoToolRegistry via fromRegistry, identical in shape to fjs's own casMcpHandlers — no third registry concatenated; the fjs_run seam for Phase 6/7 exists as a comment, not code."
    - "The CAS home path arrives as an explicit CLI arg (options.args[0]), never from NodeProgramOptions.home (the OS home dir) or process.cwd() (unavailable to a pure .f.js module) — the invoking launcher (Plan 03's claude mcp add registration) supplies the absolute repo-root path."

key-files:
  created:
    - fjs/server/module.f.js
  modified:
    - fjs/index.f.js
    - .gitignore

key-decisions:
  - "financeConfig pins protocolVersion '2025-11-25' and serverInfo.name 'finance-mcp' — a distinct McpConfig from fjs's own casConfig ('2024-11-05' / 'functionalscript-cas') — so a client can never mistake this server for FunctionalScript's own CAS server (MCP-03)."
  - "The CAS home cannot come from process.cwd() (a .f.js module is pure and cannot call it) or from NodeProgramOptions.home (verified against fjs/effects/node/module.js:277-279 to be the OS home directory, not a project path) — it must be an explicit CLI argument supplied by whatever launches the process."
  - ".gitignore's new entry is '/.cas' (no leading-slash-less pattern, no trailing slash) so that 'git check-ignore -v .cas' resolves it exactly; the comment above it states why: CAS has no delete, so a secret written into a tracked store can never be taken back."
  - "index.js (the root launcher) and package.json were both left untouched — index.js stays exactly the launcher line required by the phase's Success Criterion 5, and no new dependency was introduced."

requirements-completed: [MCP-01, MCP-03, MCP-04, DOC-02]

# Metrics
duration: single commit, TDD task 1 (module.f.js + proof) then task 2 (wiring + gitignore)
completed: 2026-08-03
---

# Phase 2 Plan 1: Server Skeleton Over fjs's Own Registries Summary

**`fjs/server/module.f.js` assembles our own MCP server (financeConfig/financeMcpHandlers/financeMcpServer) by composing exactly fjs's own `casToolRegistry` + `evoToolRegistry` under a distinct `McpConfig` (protocol `2025-11-25`, identity `finance-mcp`) — no fork; `fjs/index.f.js` now wires `main` to boot it against a caller-supplied CAS home path; the CAS/Evo store moved to a project-local, gitignored `<repo-root>/.cas` directory. First source code in this project.**

## Performance

- **Duration:** commit `cd71939` at 2026-08-03T18:20:56-07:00, following on from the plan's context-setting commits earlier the same session (`677dc91`, `cdfced7`)
- **Completed:** 2026-08-03
- **Tasks:** 2/2 completed (Task 1 was TDD: construction-only proof written and passing before the composition logic was extended further in Plan 02)
- **Files modified:** 3 (`fjs/server/module.f.js` created, `fjs/index.f.js` rewired, `.gitignore` updated)

## Accomplishments

- `fjs/server/module.f.js` exports `financeConfig` (a `McpConfig` value: `protocolVersion: '2025-11-25'`, `serverInfo: { name: 'finance-mcp', version: '0.0.0' }` — never `casConfig`'s `functionalscript-cas` / `2024-11-05`), `financeMcpHandlers(home)(cacheKey)` (`fromRegistry([...casToolRegistry(home)(cacheKey), ...evoToolRegistry(evo(fileCas(sha256)(home))(cacheKey))])`, identical composition to fjs's own `casMcpHandlers`), `financeMcpServer(home)` (mirrors `casMcpServer(home)` exactly, substituting our config/handlers), and `proof.financeMcpServer` (the construction-only proof leaf, matching the pattern fjs's own `casMcpServer` proof uses since the stdio server process cannot be proof-tested more deeply — that deeper proof is Plan 02's job).
- A code comment on `financeMcpHandlers` states explicitly that no third registry is concatenated here — the seam for Phase 6/7's `fjs_run` tool exists only as a comment, not as code.
- `fjs/index.f.js` was rewritten: the prior `mapStep(log('hello world!'), () => 0)` body was replaced with `main = options => step(financeMcpServer(options.args[0] ?? '.'), () => pure(0))`, importing `financeMcpServer` from `./server/module.f.js`; the now-unused `log`/`mapStep` imports were removed so `noUnusedLocals` stays clean.
- `index.js` (the root launcher) was verified untouched — still exactly `import { run } ...; import { main } ...; await run(main)` — and `package.json` was verified untouched — no new dependency introduced.
- `.gitignore` gained a commented `/.cas` entry near the top, explaining that CAS has no delete so a secret written into a tracked store could never be taken back; `git check-ignore -v .cas` resolves against this line.
- `fileCas`'s internal behavior was confirmed via its type declarations: it appends `.cas` to the supplied path itself, so passing the repo root as `home` stores content under `<repo-root>/.cas/`, project-local instead of the shared `~/.cas`.
- `NodeProgramOptions.home` was verified against `fjs/effects/node/module.js:277-279` to be the OS home directory (`os.homedir()`), not a project path — confirming the CAS home must arrive as an explicit CLI arg (`options.args[0]`) rather than being derived from `options.home`, since a `.f.js` module cannot call `process.cwd()` (impure).

## Task Commits

1. **Task 1: Write fjs/server/module.f.js — our McpConfig and server assembly** (TDD) - `cd71939` (feat)
2. **Task 2: Wire the launcher's main to financeMcpServer; gitignore the project-local store** - `cd71939` (feat, same commit)

## Files Created/Modified

- `fjs/server/module.f.js` - New file (105 lines at this commit). Exports `financeConfig`, `financeMcpHandlers`, `financeMcpServer`, `proof`.
- `fjs/index.f.js` - Rewired `main` to boot `financeMcpServer` against a caller-supplied CAS home; removed unused `log`/`mapStep` imports.
- `.gitignore` - Added `/.cas` with an explanatory comment (CAS has no delete, DOC-02).

## Decisions Made

- The CAS home path arrives as `options.args[0]` (falling back to `'.'` only for an ad hoc invocation with no argument) rather than `options.home`, because `NodeProgramOptions.home` is the OS home directory, not a project path — verified directly against fjs's own source rather than assumed from the type declaration alone.
- `financeConfig`'s protocol version and identity were pinned as distinct values from `casConfig`'s, satisfying MCP-03's requirement that a client never mistake this server for FunctionalScript's own CAS server.

## Deviations from Plan

None — plan executed exactly as written. Both tasks' acceptance criteria (typecheck clean, `node --test fjs/server/module.f.js` passing with the proof leaf, `2025-11-25` present and `functionalscript-cas` absent, `npm test` passing, real process boot with clean EOF shutdown, `.gitignore` match, `index.js` untouched) were met.

## Issues Encountered

None.

## Next Phase Readiness

- Plan 02 (full-session virtual-harness proof) builds directly on `financeMcpServer`, extending the `proof` export with a `session` key that drives a complete `initialize -> notifications/initialized -> tools/list -> tools/call` session against it.
- Plan 03 (real registration) registers this exact assembled server with `claude mcp add`, permission-scoped, against a real client.
- Independently re-verified: `02-VERIFICATION.md` (2026-08-03T18:35:00Z, must-haves #1, #2, #3, #7, #8) confirms the composition, identity, thin-launcher, and gitignored-store facts directly against the live repository, not inferred from this summary.

---
*Phase: 02-server-skeleton-safe-registration-project-local-store*
*Completed: 2026-08-03*
