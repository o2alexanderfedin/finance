---
phase: 02-server-skeleton-safe-registration-project-local-store
plan: 03
subsystem: infra
tags: [mcp, claude-cli, node-permission-model, stdio, empirical-verification]

# Dependency graph
requires:
  - phase: 02-server-skeleton-safe-registration-project-local-store
    provides: "financeMcpServer/financeConfig/financeMcpHandlers (Plan 01), full-session virtual-harness proof (Plan 02)"
provides:
  - "Empirical proof (not a flag check) that node --permission denies fs.rmSync outside --allow-fs-read/--allow-fs-write scopes with ERR_ACCESS_DENIED"
  - "Empirical proof (not a virtual-harness proxy) that a real claude -p client completes initialize -> tools/list -> an actual tools/call against the registered finance-mcp server"
  - "A local (non-committed, -s local) claude mcp registration of finance-mcp, scoped to this worktree, left in place per the plan's reversal instructions"
affects: [phase-03-restricted-interpreter, any-future-re-registration-against-the-merged-main-checkout]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "node --permission negative test via `node --permission ... -e '<inline rmSync call>'` avoids the confound of the permission model also gating read access to a script file located outside --allow-fs-read"

key-files:
  created: []
  modified: []

key-decisions:
  - "Used node's -e inline eval for the negative permission test instead of a file-based script, after the file-based attempt (script in scratchpad, outside --allow-fs-read) produced a real but confounded ERR_ACCESS_DENIED from the module loader itself rather than from the fs.rmSync call under test — both results are recorded, but -e is the clean evidence for the plan's acceptance criteria."
  - "Registration made against the worktree path (this plan's REPO_ROOT), not the main checkout — required by the worktree's absolute-path nature; must be redone after merge (see Next Phase Readiness)."

requirements-completed: [MCP-02, SEC-01]

# Metrics
duration: ~15min
completed: 2026-08-04
---

# Phase 2 Plan 3: Real Registration and Empirical Risk Retirement Summary

**`finance-mcp` registered locally with `node --permission` scoping via `claude mcp add -s local`; a real headless `claude -p` client observed issuing an actual `tools/call` (`mcp__finance-mcp__evo_list`) and receiving a non-error result; a real `ERR_ACCESS_DENIED` observed from an out-of-scope `fs.rmSync` under the identical registered permission flags; `.cas` confirmed git-ignored, `~/.cas` confirmed untouched, `index.js` confirmed unmodified.**

## Performance

- **Duration:** ~15 min
- **Completed:** 2026-08-04T01:31:07Z
- **Tasks:** 2/2 completed
- **Files modified:** 0 (plan is registration + empirical verification only, as scoped)

## Accomplishments

- Registered `finance-mcp` with `claude mcp add -s local`, carrying `node --permission --allow-fs-read=<worktree-root> --allow-fs-write=<worktree-root>/.cas` from the very first registration (SEC-01) — verified healthy/`✔ Connected` via both `claude mcp get finance-mcp` and `claude mcp list`.
- Observed a real `ERR_ACCESS_DENIED` (exit code 1) from `fs.rmSync` targeting a path outside both allowed scopes, run under the exact same `--permission` flags used in registration (Success Criterion 3, SEC-01).
- Drove a real `claude -p` headless client through a full session and observed an actual `tool_use` event named `mcp__finance-mcp__evo_list` followed by a non-error `tool_result` (`[]`) — the empirical proof that Criterion 1's documented silent-failure mode (`tools/list` succeeding, `tools/call` never arriving) did not occur (Success Criterion 1, MCP-02).
- Confirmed `git check-ignore -v .cas` exits 0 (matches `.gitignore:4:/.cas`), `~/.cas` does not exist (untouched), `.cas` was never created in the worktree either (no writes occurred — `evo_list` is read-only and the CAS home only scans on `initEvo`), `index.js` has zero diff, and `git status --short` is fully clean (Success Criterion 5).
- Confirmed `npm test` still reports 7/7 passing and `tsc --noEmit` remains clean — nothing in this plan touched source.

## Task Commits

This plan is registration-and-verification only; `files_modified: []` in the plan frontmatter, and no repository files were created or modified. No task commits were made. `git status --short` is empty at completion (verified below).

## Files Created/Modified

None. This plan's product is observed evidence, recorded here, not repository files.

## Exact Commands and Observed Output

### Registration (SEC-01, Task 1)

```
REPO_ROOT="/Volumes/ProjectsSSD/Projects/jobs4alex/sergey-shandar/finance/.claude/worktrees/finance-phases"
claude mcp add finance-mcp -s local -- node --permission \
  --allow-fs-read="$REPO_ROOT" \
  --allow-fs-write="$REPO_ROOT/.cas" \
  "$REPO_ROOT/index.js" "$REPO_ROOT"
```

Output:
```
Added stdio MCP server finance-mcp with command: node --permission --allow-fs-read=<REPO_ROOT> --allow-fs-write=<REPO_ROOT>/.cas <REPO_ROOT>/index.js <REPO_ROOT> to local config
File modified: /Users/alexanderfedin/.claude.json [project: <REPO_ROOT>]
```

`claude mcp get finance-mcp`:
```
finance-mcp:
  Scope: Local config (private to you in this project)
  Status: ✔ Connected
  Type: stdio
  Command: node
  Args: --permission --allow-fs-read=<REPO_ROOT> --allow-fs-write=<REPO_ROOT>/.cas <REPO_ROOT>/index.js <REPO_ROOT>
  Environment:
```

`claude mcp list` confirms the same line with `✔ Connected` and the literal substrings `--permission`, `--allow-fs-read=`, `--allow-fs-write=` present, satisfying the plan's `<verify>` for Task 1.

### Negative permission test (SEC-01, Task 1)

Two variants were run; both produced real `ERR_ACCESS_DENIED`, but for a subtly different reason each — both are recorded because the first is a genuine (if confounding) discovery.

**Variant A — file-based, as the plan literally describes** (script written to the scratchpad directory, which sits outside `--allow-fs-read`'s scope, the worktree root):
```
node --permission --allow-fs-read="$REPO_ROOT" --allow-fs-write="$REPO_ROOT/.cas" \
  "$SCRATCH/permission-probe.js"
```
Result: `ERR_ACCESS_DENIED`, `permission: 'FileSystemRead'`, `resource: '<scratch>/permission-probe.js'`, exit code 1 — Node's permission model denied the **loader's own read** of the script file before the `fs.rmSync` line inside it ever ran. Real evidence of the permission model working, but it demonstrates read-scoping of the entry script, not the `fs.rmSync` call the task intends to probe.

**Variant B — inline eval, isolating the intended call:**
```
node --permission --allow-fs-read="$REPO_ROOT" --allow-fs-write="$REPO_ROOT/.cas" \
  -e "require('fs').rmSync(require('os').homedir() + '/.finance-mcp-permission-probe', { force: true })"
```
Result:
```
node:internal/errors:540
      throw error;
      ^

Error [ERR_ACCESS_DENIED]: Access to this API has been restricted
    at Object.rmSync (node:fs:1247:16)
    ...
  code: 'ERR_ACCESS_DENIED',
  permission: 'FileSystemRead',
  resource: '/Users/alexanderfedin/.finance-mcp-permission-probe'
}
EXIT_CODE=1
```
This is the clean evidence for the acceptance criteria: the exact `fs.rmSync` call targeting `~/.finance-mcp-permission-probe` (outside both `--allow-fs-read=<REPO_ROOT>` and `--allow-fs-write=<REPO_ROOT>/.cas`) was denied, with a non-zero exit code and the literal string `ERR_ACCESS_DENIED` in stderr.

The throwaway `permission-probe.js` file (used for Variant A) was written to and deleted from the scratchpad directory (never inside the repo, never committed) — confirmed absent afterward.

### Real client round trip (MCP-02, Task 2)

```
claude -p "Call the evo_list tool from the finance-mcp MCP server exactly once, then stop." \
  --allowedTools "mcp__finance-mcp__evo_list" \
  --dangerously-skip-permissions \
  --output-format stream-json --verbose \
  > /tmp/finance-mcp-live.jsonl
```

Exit code 0, 21 lines of stream-json output, empty stderr. Relevant transcript lines from `/tmp/finance-mcp-live.jsonl`:

- The registered server's tool namespace, confirmed empirically from the `system`/`init` event's `tools` array: `mcp__finance-mcp__cas_add`, `mcp__finance-mcp__cas_get`, `mcp__finance-mcp__cas_list`, `mcp__finance-mcp__evo_add`, `mcp__finance-mcp__evo_head`, `mcp__finance-mcp__evo_list`, `mcp__finance-mcp__evo_revision` — confirming the documented `mcp__<server>__<tool>` convention held exactly as assumed, no `--allowedTools` adjustment needed.
- `assistant` event: `{"type":"tool_use","id":"toolu_01Q26RRgRyQpoHk8X5DyasdD","name":"mcp__finance-mcp__evo_list","input":{}}` with `tool_use_meta: [{"id":"toolu_01Q26RRgRyQpoHk8X5DyasdD","display_name":"Evo List","server_display_name":"finance-mcp"}]` — the actual `tools/call` request.
- `user` event immediately after: `{"tool_use_id":"toolu_01Q26RRgRyQpoHk8X5DyasdD","type":"tool_result","content":[{"type":"text","text":"[]"}]}` — the `tools/call` response, non-error, reaching a real registered handler (`evoToolRegistry`'s `evo_list`), returning an empty list (correct: no revisions have been written to this CAS home).
- Final assistant text: `"evo_list" returned "[]" — no subjects have stored revisions yet.` — the client's own confirmation it received and understood the result.

This is the observed `initialize -> notifications/initialized -> tools/list -> tools/call` completion through a real external client, not the Plan 02 virtual harness — the specific evidence Success Criterion 1 requires and the specific failure mode (`tools/list` succeeding, no `tools/call` ever arriving, caused by fjs's `mcpStep` not negotiating protocol version) that this task exists to rule out empirically. It did not occur: `2025-11-25` (financeConfig's pin) worked with the real `claude` client without incident.

### Remaining Criterion 5 checks (Task 2)

```
git check-ignore -v .cas
```
Output: `.gitignore:4:/.cas	.cas` — exit code 0.

```
git diff --quiet -- index.js; echo "index.js diff exit:$?"
```
Output: `index.js diff exit:0` — no diff.

```
ls -la ~/.cas
```
Output: `ls: /Users/alexanderfedin/.cas: No such file or directory` — confirmed untouched (it never existed, so there is nothing this phase could have modified).

```
ls -la .cas   # from the worktree root
```
Output: `ls: .cas: No such file or directory` — the project-local CAS home was never created in the worktree either, because the only operation exercised (`evo_list`) is read-only and `initEvo` only scans an existing home; it does not create one.

```
git status --short
```
Output: empty — confirms no repository files changed for this plan (registration and verification are entirely outside the repo, matching the plan's `<reversal>`).

```
npm test
```
Output: `tests 7`, `pass 7`, `fail 0`; `tsc` completed with no errors — prior plans' state (Wave 1/2 work) confirmed undisturbed.

## Decisions Made

- Ran the negative permission test two ways (file-based per the plan's literal wording, and inline `-e` for a clean isolate) because the file-based version's `ERR_ACCESS_DENIED` came from the module loader denying read access to the script itself (since the scratchpad lives outside `--allow-fs-read`'s scope), not from the `fs.rmSync` call under test. Both are genuine `ERR_ACCESS_DENIED` observations and both are recorded, but the `-e` variant is the one that isolates the intended assertion (an out-of-scope `fs.rmSync` is denied) and is the evidence cited against the plan's acceptance criteria.
- No escalation needed for the protocol-version risk: `2025-11-25` worked with a real `claude` client with no observed friction, so the deferred items in `02-CONTEXT.md` (wrapping `mcpStep`, adopting `2026-07-28`) remain correctly deferred — their trigger condition (the empirical check failing) did not occur.

## Deviations from Plan

None — plan executed exactly as written. The Variant A / Variant B split on the negative permission test is not a deviation from the plan's steps; both variants follow the plan's instruction to run the throwaway script "with the exact same `--allow-fs-read`/`--allow-fs-write` values," and Variant A's file-loader-denial result is documented rather than discarded, since it is itself real evidence of the permission model, just not the specific assertion under test. Variant B was added to give the clean, unconfounded evidence the acceptance criteria call for.

## Issues Encountered

None beyond the Variant A/B nuance above, which is not a blocker — both variants exited non-zero with `ERR_ACCESS_DENIED` in stderr.

## User Setup Required

None — no external service configuration required. See the worktree-path caveat below for a manual step required later, after merge.

## IMPORTANT: Worktree-Path Registration Caveat

**The `finance-mcp` registration made by this plan points at the worktree path**
(`/Volumes/ProjectsSSD/Projects/jobs4alex/sergey-shandar/finance/.claude/worktrees/finance-phases`),
**not the main checkout.** This was required — the worktree is where this phase's code
(`fjs/server/module.f.js`, `fjs/index.f.js`) actually lives; registering against the main
checkout would point at a branch without this code.

**This registration is therefore temporary and must be redone after this branch merges:**

1. Remove the stale worktree-path entry first, so it does not accumulate as a duplicate:
   ```
   claude mcp remove finance-mcp -s local
   ```
2. Re-register against the merged main checkout, using the same command shape as this plan's
   Task 1, with `REPO_ROOT` recomputed from the main checkout's path (not the worktree's):
   ```
   REPO_ROOT="$(pwd)"   # run from the main checkout after merge
   claude mcp add finance-mcp -s local -- node --permission \
     --allow-fs-read="$REPO_ROOT" \
     --allow-fs-write="$REPO_ROOT/.cas" \
     "$REPO_ROOT/index.js" "$REPO_ROOT"
   ```
3. Re-verify health with `claude mcp get finance-mcp` / `claude mcp list`. The empirical
   `tools/call` and `ERR_ACCESS_DENIED` checks performed in this plan do not need to be redone
   in full (the code and permission model are unchanged) but a quick `claude mcp get` health
   check is worth confirming.

Per the plan's `<reversal>` instructions, this worktree-path entry is being **left registered**
now (not removed) — MCP-02's deliverable is a working registration, not a test fixture — but
whoever performs the merge must not forget the remove-then-re-register step above, or a stale
duplicate accumulates in local Claude Code config.

## Next Phase Readiness

- Phase 2's full requirement set (MCP-01 through MCP-05, SEC-01, DOC-02) is now empirically
  retired: MCP-01/03/04/DOC-02 by Wave 1, MCP-05 by Wave 2's virtual-harness proof, and MCP-02 +
  SEC-01 by this plan's real registration and real-client observation.
- Phase 3 (restricted interpreter) can build on `financeMcpHandlers`'/`financeConfig`'s
  established composition-root pattern with confidence that the underlying MCP transport,
  permission scoping, and registration path are proven against a real client, not just a virtual
  one.
- Outstanding non-blocking item: `fjs/todo/upstream-mcp-protocol-version-negotiation.md` (from
  Wave 1/2) remains open as an upstream fjs gap — recorded, not escalated, since this plan's
  empirical check did not trigger escalation.
- Action item for whoever merges this branch: perform the worktree-path re-registration described
  above.

---
*Phase: 02-server-skeleton-safe-registration-project-local-store*
*Completed: 2026-08-04*
