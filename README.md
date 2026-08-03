# Finance

A user uploads their financial documents to a personal CAS, then uses ChatGPT (or any
other MCP client) to compute tax and other financial reports over them.

The agent does **not** produce the numbers itself. It writes a
[FunctionalScript](https://github.com/functionalscript/functionalscript) program that
computes the report, and the MCP server executes that program in content-addressable
space — so every figure is reproducible, reviewable, and traceable to the hash of the
document it came from.

Built for personal use, on top of the `fjs` CAS, Evo, and MCP modules. Early — see the
documents below for what is settled, what is planned, and what is still open.

## Documentation

| Document | What it covers |
|---|---|
| [AGENTS.md](./AGENTS.md) | Conventions, file layout, code style, testing, and commands — start here to work in the repo |
| [.planning/PROJECT.md](./.planning/PROJECT.md) | *Why* and *what* — intent, requirements, constraints, decisions, success criteria |
| [todo/plan.md](./todo/plan.md) | *When* — settled decisions, the five-week critical path, and the open questions |
| [fjs/todo/implement-mcp-server.md](./fjs/todo/implement-mcp-server.md) | *How* — the MCP server spec: assembly, `fjs_run`, and the restricted runner |
