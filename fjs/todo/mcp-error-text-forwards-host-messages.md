# `fjs_run`'s error response forwards the host's own IO message to the client

Status: **OPEN, found 2026-08-18 during the 0.46.0 migration.** Pre-existing —
this is not something the migration introduced — but 0.46.0 is what made it
legible, because upstream now ships two renderers and says in as many words
which is for whom.

## The finding

`fjs/effects/node/module.f.mjs` exports two ways to turn an `IoChannel` into a
string, and its own docstring draws the line:

- `errorMessage` — *"for the operator of the program, who is entitled to the
  host's own words — including the path that failed."*
- `errorSummary` — *"for a **remote** caller: the command name for a
  `NotImplemented`, the OS error code for an `IoError`, and nothing else … 
  `payload.message` is where the host puts the absolute path it could not read,
  so answering an MCP tool call with it publishes the server's filesystem
  layout to whoever is on the other end."*

`fjs/guest/materialize`'s `materializeProgram` renders with `errorMessage`, and
that string travels:

```
materializeProgram  →  executeRun's error channel
                    →  asRunOutcome  →  RunOutcome.message
                    →  handleRunOutcome  →  the stored run record's `error` field   (local, fine)
                                        →  errorResult(`fjs_run failed: ${message}`) (REMOTE)
```

So an MCP client that asks `fjs_run` to run a hash whose materialize write fails
on a real filesystem receives the host's message — which for `ENOENT`/`EACCES`
is the absolute path under the server's CAS home.

## Why it was left as it is

Changing it inside the migration would have been a silent behaviour change
dressed as plumbing. At 0.43.1 an `IoError` *was* the message and `String(e)`
produced it, so `errorMessage` is the faithful successor and keeps
`fjs/server`'s `weekOneConvergence` leaf reading `invalid file` out of the
surfaced text. Swapping to `errorSummary` right now would turn that leaf red for
a reason unrelated to the Effect system and would weaken the only proof that the
materialize-write collision is surfaced at all.

Two *new* error paths this migration added — `cas_refresh`'s and
`finance_documents_list`'s handler-level `catchStep`s — already use
`errorSummary`, because they had no prior text to preserve. The codebase
therefore currently has both conventions, which is the second reason to settle
this deliberately rather than by drift.

## The fix, when it is taken

**Redact at the boundary, not at the source.** `materializeProgram` is a guest
helper and has no idea who will read its message; `fjsRunTool` is the one place
that knows it is answering a protocol client. The obstacle is that
`RunOutcome.message` is a `string` by the time it reaches the tool, so the
structured `IoChannel` is already gone.

Two shapes, in order of preference:

1. **Carry the channel further.** Let `executeRun` fail with
   `IoChannel | string` rather than flattening to `string` at each helper, and
   have `handleRunOutcome` render twice — `errorMessage` into the stored run
   record (local, operator-facing, and the more useful provenance record for
   it), `errorSummary` into the `errorResult` that leaves the process. This is
   what the error channel makes possible and is the reason to prefer it: the
   *value* survives to the place that can decide.
2. **Render once, at the source, with `errorSummary`,** and accept that the run
   record loses the diagnostic. Cheaper, strictly worse provenance.

## Retirement condition

Deleted when a stored run record and the `fjs_run` error response are rendered
from the same `IoChannel` by two different renderers, with a proof that the
remote-facing one contains no path separator that the local one does contain.
