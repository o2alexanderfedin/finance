# Finance

A user uploads their financial documents to a personal CAS, then uses Claude Code or
Claude Desktop (or any other MCP client that supports local stdio servers) to compute tax
and other financial reports over them. Remote transport (HTTPS + OAuth) — required for a
browser-hosted client such as ChatGPT — is **deferred**; see `.planning/REQUIREMENTS.md` § v2
(Deferred). Milestone v2 came and went without it: it delivered the product path and the four
reference taxpayers instead.

The agent does **not** produce the numbers itself. It writes a
[FunctionalScript](https://github.com/functionalscript/functionalscript) program that
computes the report, and the MCP server executes that program in content-addressable
space — so every figure is reproducible, reviewable, and traceable to the hash of the
document it came from.

Built for personal use, on top of the `fjs` CAS, Evo, and MCP modules.

**Shipped as `finance-mcp 1.0.0`** on MCP protocol `2025-11-25`: **13 tools**, **26 document
dialects** with readable schemas, tax year **2025**, and all four reference taxpayers computing a
full Form 1040 — a retiree, a non-profit worker, a FAANG engineer and a startup founder.

```sh
npm install          # once
npm start            # run the server over stdio (node index.js)
npm test             # tsc, then the full suite
```

Point an MCP client at `node index.js`. Where the engine cannot compute honestly it **refuses and
names the form or the fact that would supply it**, rather than guessing — that behaviour is the
product, not a limitation of it.

The `fjs_check` tool smoke-checks a stored program — confirming it imports cleanly and
exports something that looks like a report — before an agent spends a real `fjs_run` call
on it. **`fjs_check` has no security value.** It is a productivity convenience, never a
validation, sandboxing, or trust control: the program's top-level code has already run (via
`import()`) by the time `fjs_check` has an answer, exactly the same exposure a real `fjs_run`
call carries.

## Documentation

| Document | What it covers |
|---|---|
| [AGENTS.md](./AGENTS.md) | Conventions, file layout, code style, testing, and commands — start here to work in the repo |
| [.planning/PROJECT.md](./.planning/PROJECT.md) | *Why* and *what* — intent, requirements, constraints, decisions, success criteria |
| [.planning/ROADMAP.md](./.planning/ROADMAP.md) | *When* — the live phase tracker |
| [.planning/CAPABILITIES.md](./.planning/CAPABILITIES.md) | *What it can actually do* — measured from a running server, not asserted |
| [todo/plan.md](./todo/plan.md) | *When (historical)* — the pre-v1 five-week plan; done, and superseded by ROADMAP.md |
| [fjs/todo/implement-mcp-server.md](./fjs/todo/implement-mcp-server.md) | *How it was designed (historical)* — the MCP server spec; implemented and shipped, see its own status line |
