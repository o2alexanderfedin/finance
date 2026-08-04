---
phase: 02-server-skeleton-safe-registration-project-local-store
verified: 2026-08-03T18:35:00Z
status: passed
score: 11/11 must-haves verified
overrides_applied: 0
---

# Phase 2: Server Skeleton, Safe Registration, Project-Local Store Verification Report

**Phase Goal:** A registered, protocol-correct, permission-scoped MCP server exists and talks to a
real client, with none of our logic in it yet.
**Verified:** 2026-08-03T18:35:00Z
**Status:** passed
**Re-verification:** No — initial verification

All checks below were re-run live against the current worktree state
(`/Volumes/ProjectsSSD/Projects/jobs4alex/sergey-shandar/finance/.claude/worktrees/finance-phases`,
branch `feature/phase-1-planning-document-corrections`, clean working tree) — nothing here is
taken from SUMMARY.md claims alone.

## Goal Achievement

### Must-Have Verification Table

| # | Must-Have | Status | Evidence |
|---|-----------|--------|----------|
| 1 | MCP-01 — composition over fjs exports, no fork | ✓ VERIFIED | `fjs/server/module.f.js` imports `casToolRegistry`, `evoToolRegistry`, `mcpStep`, `fromRegistry`, `stdioTransport` directly from `functionalscript/...`; `financeMcpHandlers` = `fromRegistry([...casToolRegistry(...), ...evoToolRegistry(...)])`, identical shape to fjs's own `casMcpHandlers`. `git diff cdfced7..42b5df2 -- package.json package-lock.json` is empty — no new dependency. |
| 2 | MCP-03 — our own identity and version | ✓ VERIFIED | `financeConfig = { serverInfo: { name: 'finance-mcp', version: '0.0.0' }, protocolVersion: '2025-11-25', ... }`. `grep -c "'2025-11-25'" fjs/server/module.f.js` = 3; `grep -c "functionalscript-cas" fjs/server/module.f.js` = 0 (the only "2024-11-05" hit is a doc-comment explaining why *not* to reuse `casConfig`). |
| 3 | MCP-04 — thin launcher | ✓ VERIFIED | `index.js` is exactly `import { run } ...; import { main } ...; await run(main)` (4 lines). `git diff cdfced7~1..HEAD -- index.js` is empty — unchanged across every phase-2 commit. All logic lives in `fjs/index.f.js` (15 lines) and `fjs/server/module.f.js` (217 lines). |
| 4 | MCP-05 — stdout is JSON-RPC only, full session | ✓ VERIFIED | `npm test` run live: `tests 7, pass 7, fail 0`, including `proof.session.stdoutIsPureJsonRpc` (parses every stdout line as JSON-RPC across the whole `initialize → notifications/initialized → tools/list → tools/call` session, asserts `jsonrpc === '2.0'` on each of 3 responses) and `proof.session.stderrIsEmpty` (asserts `state.stderr === ''`). |
| 5 | MCP-02 / Criterion 1 — a real `tools/call` arrived | ✓ VERIFIED | `claude mcp get finance-mcp` (run live): `Status: ✔ Connected`. `/tmp/finance-mcp-live.jsonl` still exists on disk (35533 bytes) and independently re-inspected: contains `{"type":"tool_use",...,"name":"mcp__finance-mcp__evo_list","input":{}}` immediately followed by `{"type":"tool_result","tool_use_id":"toolu_...","content":[{"type":"text","text":"[]"}]}` — a real external `claude` client, not a virtual harness, reached a real handler and got a non-error result. This matches 02-03-SUMMARY.md's transcript excerpt exactly. |
| 6 | SEC-01 / Criterion 3 — real `ERR_ACCESS_DENIED` | ✓ VERIFIED | Re-ran the exact negative test myself: `node --permission --allow-fs-read="$ROOT" --allow-fs-write="$ROOT/.cas" -e '...fs.rmSync($HOME/probe-x)...'` → output `code: ERR_ACCESS_DENIED`. `claude mcp list` (run live) shows the registered command line: `node --permission --allow-fs-read=<repo-root> --allow-fs-write=<repo-root>/.cas <repo-root>/index.js <repo-root> - ✔ Connected`. |
| 7 | DOC-02 / Criterion 5 — project-local, gitignored store | ✓ VERIFIED | `git check-ignore -v .cas` → `.gitignore:4:/.cas	.cas`, exit 0. `ls -la ~/.cas` → `No such file or directory` (untouched). `git ls-files \| grep '^\.cas'` → empty (nothing committed). |
| 8 | Scope discipline — none of our logic yet | ✓ VERIFIED | `find fjs -maxdepth 2 -type d` → only `fjs/server` and `fjs/todo` exist; no interpreter, no document-format module, no third tool registry. `grep -n "fjs_run" fjs/server/module.f.js` hits only inside doc-comments naming it as the Phase 6/7 seam ("that seam is left as this comment, not as code"). |
| 9 | AGENTS.md compliance | ✓ VERIFIED | (a) `fjs/server/module.f.js` and `fjs/index.f.js` are pure ESM `.f.js`; only `index.js`/`all.test.js`/launcher are impure. (b) No dependency added (see #1). (c) `fjs/todo/upstream-mcp-protocol-version-negotiation.md` exists, names the exact defect (`mcpStep`'s `initialize` handler discards `pr.protocolVersion`), and frames the fix as belonging in `fjs/protocol/mcp/module.f.js` itself, explicitly stating "no local workaround exists or is planned" and "not something `fjs/server/module.f.js` should implement locally." `grep -n "mcpStep" fjs/server/module.f.js` shows only a direct call (`mcpStep(financeConfig)(...)`), no wrapper. (d) `grep -nE "\bl\b"` on both files: no match. (e) `@import { ... } from '...'` JSDoc form used throughout (6 instances), no inline `@type {import(...)...}`. |
| 10 | Nothing broke | ✓ VERIFIED | `npx tsc --noEmit` → exit 0, no output. `npm test` → `tests 7, pass 7, fail 0`. `echo -n \| node index.js "$(mktemp -d)"` → exit 0 (real process boot + clean EOF shutdown). `git status --short` → empty. |
| 11 | Testing-method integrity | ✓ VERIFIED | `AGENTS.md` (lines 51-53) contains the corrected text: "Only run proofs through root discovery — `npm test`, or `node --test all.test.js`... Any invocation that bypasses that reports a *fake pass*," with the documented `tests 8/pass 7/fail 1` vs `tests 1/pass 1/fail 0` proof. This verifier used `npm test` (root discovery) exclusively for all test runs above — never `node --test fjs/server/module.f.js` or similar file-targeted invocations. |

**Score:** 11/11 must-haves verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `fjs/server/module.f.js` | financeConfig/financeMcpHandlers/financeMcpServer/proof, composing casToolRegistry+evoToolRegistry | ✓ VERIFIED | 217 lines; all four exports present; `proof.financeMcpServer` (construction-only) and `proof.session.*` (5 full-session leaves) both pass under `npm test`. |
| `fjs/index.f.js` | main wires financeMcpServer into NodeProgram | ✓ VERIFIED | 15 lines; `main = options => step(financeMcpServer(options.args[0] ?? '.'), () => pure(0))`. |
| `index.js` | unchanged thin launcher | ✓ VERIFIED | 4 lines, no diff since before phase 2. |
| `.gitignore` | `.cas` excluded, commented | ✓ VERIFIED | Line 4: `/.cas`, with a 3-line comment explaining why (CAS has no delete, DOC-02). |
| `fjs/todo/upstream-mcp-protocol-version-negotiation.md` | records the non-negotiation gap as an fjs-owned capability | ✓ VERIFIED | 117 lines; names exact defect location, no wrapper proposed. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `fjs/index.f.js` | `fjs/server/module.f.js` | `import { financeMcpServer } from './server/module.f.js'` | ✓ WIRED | Confirmed by direct read; also exercised at runtime by `node index.js` booting successfully. |
| `fjs/server/module.f.js` | `protocol/mcp/module.f.js` `mcpStep` | `mcpStep(financeConfig)(...)` | ✓ WIRED | Direct call, our config, not `casConfig`. |
| `claude mcp add ... node --permission ...` | `index.js → fjs/index.f.js main → financeMcpServer` | registered launcher command line | ✓ WIRED | `claude mcp get finance-mcp` confirms the exact command line, live, currently connected. |
| `claude -p` (real client) | `financeMcpServer`'s `tools/call` handler (`evo_list`) | live stdio JSON-RPC session | ✓ WIRED | `/tmp/finance-mcp-live.jsonl` re-inspected directly; contains matching `tool_use`/`tool_result` pair. |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full test suite passes via root discovery | `npm test` | `tests 7, pass 7, fail 0` | ✓ PASS |
| Typecheck clean | `npx tsc --noEmit` | exit 0 | ✓ PASS |
| Real server boots and shuts down cleanly | `echo -n \| node index.js "$(mktemp -d)"` | exit 0 | ✓ PASS |
| CAS store is git-ignored | `git check-ignore -v .cas` | `.gitignore:4:/.cas`, exit 0 | ✓ PASS |
| Negative permission test (re-run independently) | `node --permission --allow-fs-read=... --allow-fs-write=... -e 'fs.rmSync($HOME/probe-x)'` | `code: ERR_ACCESS_DENIED` | ✓ PASS |
| Live MCP registration health | `claude mcp get finance-mcp` | `Status: ✔ Connected` | ✓ PASS |
| Live MCP registration flags | `claude mcp list` | `--permission --allow-fs-read=... --allow-fs-write=... - ✔ Connected` | ✓ PASS |
| Root launcher untouched | `git diff -- index.js` | empty | ✓ PASS |
| No new dependency | `git diff cdfced7..42b5df2 -- package.json package-lock.json` | empty | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|--------------|--------|----------|
| MCP-01 | 02-01 | Stdio MCP server composing casToolRegistry+evoToolRegistry | ✓ SATISFIED | `financeMcpHandlers` composition, see #1 above. |
| MCP-02 | 02-03 | Server registers with `claude mcp add`; real client tools/call arrives | ✓ SATISFIED | Live registration + transcript, see #5. |
| MCP-03 | 02-01 | Own McpConfig, protocol version 2025-11-25 | ✓ SATISFIED | See #2. |
| MCP-04 | 02-01 | Thin root-level launcher | ✓ SATISFIED | See #3. |
| MCP-05 | 02-02 | stdout carries JSON-RPC only, asserted in CI across full session | ✓ SATISFIED | See #4. |
| SEC-01 | 02-03 | `node --permission` scoped from first registration, ERR_ACCESS_DENIED proven | ✓ SATISFIED | See #6. |
| DOC-02 | 02-01 | Project-local, gitignored CAS home | ✓ SATISFIED | See #7. |

No orphaned requirements — all 7 requirements mapped to Phase 2 in ROADMAP.md's Coverage table
appear in one of the three plans' `requirements:` frontmatter, and all are satisfied.

**Note (non-blocking, documentation bookkeeping only):** `.planning/ROADMAP.md`'s Progress table
still lists Phase 2 as "Not started" / "0/3" plans complete, and `.planning/REQUIREMENTS.md`'s
checkboxes for MCP-01..05/SEC-01/DOC-02 are still unchecked with traceability status "Pending."
This is a documentation-sync gap, not a code gap — every one of those requirements is verified
working in the live codebase above. Flagged for whoever runs the next roadmap-sync step, not a
phase-goal blocker.

### Anti-Patterns Found

None. `grep -n "TBD\|FIXME\|XXX\|TODO\|HACK\|PLACEHOLDER"` across `fjs/server/module.f.js`,
`fjs/index.f.js`, `index.js` returns no matches. No `l` identifier. No empty handlers, no
hardcoded stub returns, no console.log-only implementations.

### Human Verification Required

None. Every must-have was either directly re-executed (tsc, npm test, node index.js, git
check-ignore, node --permission negative test, claude mcp get/list) or confirmed against
persistent on-disk evidence (`/tmp/finance-mcp-live.jsonl`) independent of SUMMARY.md's narrative.

### Gaps Summary

No gaps. All 11 must-haves verified with live, reproduced evidence. The only finding is the
non-blocking ROADMAP/REQUIREMENTS bookkeeping lag noted above.

---

**Plain statement:** The Phase 2 goal — "A registered, protocol-correct, permission-scoped MCP
server exists and talks to a real client, with none of our logic in it yet" — is TRUE. The server
is registered (`claude mcp get finance-mcp` → `✔ Connected`), protocol-correct (own
`McpConfig` pinned `2025-11-25`, proven non-negotiating via both a virtual-harness proof and a
real client), permission-scoped (`ERR_ACCESS_DENIED` independently reproduced), talks to a real
client (a genuine `claude -p` transcript with a `tool_use`/`tool_result` pair, re-inspected
directly from disk), and contains none of Phase 3/5/7's logic (no interpreter, no document
format, no `fjs_run` — the seam is a comment).

---

*Verified: 2026-08-03T18:35:00Z*
*Verifier: Claude (gsd-verifier)*
