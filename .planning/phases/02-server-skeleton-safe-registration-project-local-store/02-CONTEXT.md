# Phase 2: Server Skeleton, Safe Registration, Project-Local Store - Context

**Gathered:** 2026-08-03
**Status:** Ready for planning

<domain>
## Phase Boundary

A registered, protocol-correct, permission-scoped MCP server exists and talks to a real
client, with **none of our logic in it yet**.

In scope: the launcher, the server assembly over fjs's exported registries, our own
`McpConfig`, `node --permission` scoping, the project-local CAS home, and a CI assertion
that stdout carries only JSON-RPC.

Out of scope, deliberately: the restricted interpreter (Phase 3), `fjs_run` (Phase 7), any
document format (Phase 5), any tax logic. If a task starts describing what a tool *does*
beyond CAS/Evo passthrough, it belongs to a later phase.

Requirements: MCP-01, MCP-02, MCP-03, MCP-04, MCP-05, SEC-01, DOC-02.
</domain>

<decisions>
## Implementation Decisions

### Protocol Version — the one real risk in this phase

- **Pin `2025-11-25`**, as MCP-03 specifies. Settle it with the empirical check the roadmap
  already budgets ("a 10-minute empirical protocol-version diff") against a real Claude Code
  client. Escalate only if that check fails — not on speculation.
- **Why this is a risk at all:** fjs's `mcpStep` **does not negotiate**. Its `initialize`
  handler validates the client's params and then discards the client's `protocolVersion`,
  returning the configured string unconditionally
  (`node_modules/functionalscript/fjs/protocol/mcp/module.f.js`). `McpConfig.protocolVersion`
  is a bare, unvalidated `string`. Whatever we pin is what every client is told, whatever it
  asked for.
- This is precisely the failure mode success criterion 1 was written to catch: a successful
  `tools/list` followed by **no `tools/call` at all**. Criterion 1 is not satisfied by a
  green `tools/list`.
- **`2026-07-28` is now the current spec revision** (shipped July 2026). MCP-03 predates it.
  Noted, not adopted — revisit only if the empirical check on `2025-11-25` fails.
- **Upstream obligation:** the missing negotiation is an fjs gap. Per AGENTS.md, record it in
  `fjs/todo/upstream-*.md` rather than working around it silently. Recording costs nothing and
  is not a workaround; **writing a wrapper around `mcpStep` is out of scope for this phase.**

### Server Identity

- Our own `McpConfig` with our own `serverInfo` — explicitly **not** `casConfig`, which pins
  `2024-11-05` and identifies as `functionalscript-cas`. Reusing it fails criteria 1 and 2
  together.

### Store

- CAS home is **project-local and gitignored**. `~/.cas` must be untouched.
- The reason is not tidiness: there is no delete in CAS. A real SSN written into a shared
  store cannot be taken back.

### Launcher

- A thin root-level `.js` containing nothing but the launcher line, consistent with the
  existing `index.js`. All logic in `.f.js` modules it calls.
- `node --permission` with scoped `--allow-fs-*` from the **first** registration. Registering
  without it first means the unsafe configuration is the one already in everyone's config.

### Claude's Discretion

- Exact CAS home path, server name string, and the specific `--allow-fs-*` path list.
- File and module layout under `fjs/`.
- How the stdout-purity assertion is expressed in CI, provided it covers a **full session**
  rather than a single message.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets — everything needed is already exported; no fjs fork

| Need | Reuse |
|---|---|
| Protocol state machine | `mcpStep(config)(handlers)(stateKey)` — `fjs/protocol/mcp/module.f.js` |
| stdio loop | `stdioTransport(handler)` — `fjs/protocol/mcp/stdio/module.f.js` |
| Registry → handlers | `fromRegistry(registry)` — `fjs/protocol/mcp/module.f.js` |
| CAS tools | `casToolRegistry(home)(cacheKey)` — `fjs/mcp/cas/module.f.js` |
| Evo tools | `evoToolRegistry(evo(cas)(cacheKey))` — `fjs/mcp/evo/module.f.js` |
| Store / cache setup | `fileCas(sha256)(home)`, `initEvo(cas)` |

fjs's own assembly, for reference — `casMcpHandlers` in `fjs/mcp/module.f.js`:

```js
export const casMcpHandlers = home => cacheKey => fromRegistry([
    ...casToolRegistry(home)(cacheKey),
    ...evoToolRegistry(evo(fileCas(sha256)(home))(cacheKey)),
])
```

Ours is that array, with our own `McpConfig` instead of `casConfig`. In this phase, **no
third registry is concatenated** — that is Phase 7's `fjs_run`.

### Established Patterns

- All source is `.f.js` under `fjs/`, pure, ESM. Only `index.js` and `all.test.js` are impure
  exceptions (AGENTS.md).
- Tests are `proof` exports discovered by the root `all.test.js`. Per the (now-corrected)
  `fjs/todo/implement-mcp-server.md`, the stdio server *process* cannot be proof-tested
  directly — `casMcpServer` has the same limitation and fjs's own proof only checks that it
  constructs. Test the pieces.
- Typing is JSDoc validated by TypeScript with `noEmit`, maximally strict. Do not relax flags
  to silence errors.
- Never use `l` as an identifier.

### Integration Points

- `fjs/todo/implement-mcp-server.md` is this phase's spec — Week 1 Track A. Read it first.
- Phase 3 (restricted interpreter) and Phase 7 (`fjs_run`) attach to this skeleton. Leave the
  seam where the third registry will be concatenated, but do not build it.

</code_context>

<specifics>
## Specific Ideas

**Criterion 1 is the whole phase, and it is easy to fake.** A successful `tools/list` proves
almost nothing — the documented silent-failure mode is exactly `tools/list` succeeding and
then no `tools/call` arriving. Verification must observe an actual `tools/call` reaching a
handler.

**Criterion 3 needs a negative test, not a flag check.** Asserting the launcher command line
contains `--permission` is not the same as proving it works. A test blob whose module body
calls `fs.rmSync` outside the allowed paths must produce `ERR_ACCESS_DENIED`.

**Criterion 5 needs `git check-ignore`**, not a `.gitignore` grep — the question is whether
git actually ignores the path, not whether a pattern was typed.

</specifics>

<deferred>
## Deferred Ideas

- **Wrapping `mcpStep` to echo the client's version.** Only if the empirical check fails. It
  is a local workaround around an upstream gap and adds our logic to a phase whose goal is
  explicitly "none of our logic in it yet".
- **Adopting `2026-07-28`.** Same trigger.
- **The third tool registry (`fjs_run`).** Phase 7.
- **Import-specifier allow-list (SEC-02) and content-hash-derived filenames (SEC-03).**
  Phase 6 — named here only because Phase 1 recorded them as the compensating controls behind
  the `import()` deferral.

</deferred>
