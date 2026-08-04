# Upstream: `mcpStep`'s `initialize` handler does not negotiate protocol version

Status: **not filed upstream yet.** File the actual GitHub issue only if/when Plan 03's
empirical check against a real client surfaces an actual incompatibility with `2025-11-25` —
not speculatively. See [Upstreaming](#upstreaming).

Target: `functionalscript` `fjs/protocol/mcp/module.f.js`, the `mcpStep` state-machine step's
`initialize` handler. Present in the version pinned in this repo's `package.json`
(`functionalscript ^0.41.0`) — 0.41.0 changed `match`, not `mcpStep`, so this gap is
unaffected by that release and remains open.

## The gap

`mcpStep`'s `initialize` branch:

```js
if (method === 'initialize') {
    return step(read(stateKey), ([t]) => {
        if (t !== 'uninitialized') {
            return pure(_errResponse(id)(invalidRequest));
        }
        const [pr] = validate(initializeParams)(params);
        if (pr === 'error') {
            return pure(_errResponse(id)(invalidParams));
        }
        const result = {
            protocolVersion,
            capabilities,
            serverInfo,
        };
        return step(write(stateKey, ['initializing']), () => pure(_okResponse(id)(result)));
    });
}
```

`initializeParams` requires `params.protocolVersion` to be present and a `string` — so the
client's requested version **is validated as a shape**, and `pr.protocolVersion` is bound in
scope after that `validate` call — but it is then **discarded**. The `result` object always
uses the closed-over `protocolVersion` from the handler's own `McpConfig`, never
`pr.protocolVersion`. There is no comparison between what the client asked for and what the
server supports, and no negotiation, error, or fallback path for a mismatch: every client is
told the server's configured version, unconditionally, regardless of what it requested.

## Why it matters here

`financeConfig.protocolVersion` (`fjs/server/module.f.js`) pins `'2025-11-25'` per this
project's MCP-03 requirement. Because `mcpStep` never inspects the client's request, this pin
is silently "correct" for every client, real or misbehaving — there is no way for a genuine
version mismatch between the `finance` server and a connecting client to surface as a
same-request error. If a real client refuses to proceed past `initialize` because it does not
recognize `2025-11-25`, the *observable* symptom is not an `initialize` error at all: it is a
**successful `tools/list`** (or no traffic past `initialize`) **followed by no `tools/call`
ever arriving** — a silent stall, not a loud failure. That is exactly the risk this phase's
Plan 02 CONTEXT.md and success criteria call out, and precisely why success criterion 1 is not
satisfied by a green `tools/list` alone.

This gap is now demonstrated empirically, not just by source inspection:
`fjs/server/module.f.js`'s `proof.session.initializeIgnoresRequestedProtocolVersion` drives a
full `initialize` → `notifications/initialized` → `tools/list` → `tools/call` session against
the real assembled `financeMcpServer` over the virtual Node interpreter, with the simulated
client requesting `protocolVersion: '2025-06-18'` — a value deliberately different from the
pin — and asserts the `initialize` response still carries `2025-11-25` and `serverInfo.name:
'finance-mcp'`. That proof is necessary but not sufficient: a virtual harness can prove the
pieces answer correctly, but it cannot prove a *real* external client accepts that answer and
proceeds to call a tool. Plan 03 covers that gap with a live check against a real `claude -p`
client.

`2026-07-28` is the current MCP spec revision (shipped July 2026); this phase's MCP-03
requirement predates it and pins `2025-11-25` regardless. Noted, not adopted — revisit only if
Plan 03's empirical check against `2025-11-25` fails.

## What the upstream fix should look like

Per `AGENTS.md`: **we are contributors and owners of FunctionalScript**, not consumers of a
third-party dependency, so a missing generic protocol capability belongs in fjs itself and
ships as a new fjs release — never as app-specific glue layered on top of `mcpStep` in this
repo. Protocol-version negotiation is exactly such a generic capability: every MCP server built
on `mcpStep`, not just `finance`, needs it, and the MCP specification itself requires
`initialize` to negotiate rather than to unconditionally echo a fixed string.

The fix belongs in `fjs/protocol/mcp/module.f.js`'s `initialize` branch itself, roughly:

- `McpConfig` grows a notion of the version(s) the server actually supports — either a single
  `protocolVersion` (current shape, reinterpreted as "the only version we support") or an
  explicit list/set of supported versions.
- The `initialize` handler compares the now-already-validated `pr.protocolVersion` (the
  client's request) against that supported set, and either:
  - echoes back a mutually acceptable version (the client's requested version, if supported;
    otherwise the server's preferred/latest supported version, per the MCP spec's negotiation
    rule), or
  - returns a version-mismatch error (a JSON-RPC error result, not a silently "successful"
    `initialize` that then breaks downstream) when no acceptable overlap exists.
- The state transition to `'initializing'` should presumably still happen only on a successful
  negotiation, mirroring the existing `t !== 'uninitialized'` / `pr === 'error'` early-return
  shape.

This is a change to `mcpStep` itself — a generic MCP protocol capability — not app-specific
glue layered on top of it, and not something `fjs/server/module.f.js` should implement locally.

## Local workaround

**None exists, and none is planned.** We pin `'2025-11-25'` in `financeConfig`
(`fjs/server/module.f.js`) and accept that every client is told that version regardless of what
it requested. Intercepting `mcpStep`'s call site locally to negotiate the version ourselves is
explicitly out of scope for this phase (see `02-CONTEXT.md`'s Implementation Decisions): doing
so would put app-specific glue around a generic protocol defect instead of fixing the defect
where it lives. If Plan 03's empirical check against a real client reveals an actual
incompatibility, the answer is a new fjs release implementing negotiation in `mcpStep`, not a
local patch here.

## Upstreaming

Unscheduled. File the GitHub issue against `functionalscript/functionalscript` only if/when
Plan 03's empirical check surfaces a real incompatibility with `2025-11-25` — not
speculatively, since the pin has not yet been shown to cause a problem with any real client.
Delete this file once a released FJS version implements negotiation and this repo upgrades to
it (or once Plan 03 confirms no real client is affected and this gap is downgraded to
"theoretical, tracked, not urgent").
