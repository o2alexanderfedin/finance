# Upstream: `fjs/media/json`'s `parse` is being split into a total parser and a deprecated `parseNative`

Status: **tracked upstream, no action needed here yet.** Recorded per AGENTS.md's rule that a
dependency on upstream behaviour must never be implicit.

Target: `functionalscript` `fjs/media/json/module.f.ts`. Checked against the version pinned in
this repo's `package.json` (`functionalscript ^0.41.0`) and against upstream `origin/main`.

## What is actually true at 0.41.0

`fjs/media/json`'s `parse` is not a parser. It is one line:

```js
export const parse = JSON.parse;
```

So at the version we compile against, importing `parse` from `fjs/media/json` instead of calling
`JSON.parse` directly is a **rename with no behavioural change** — same function, same
`SyntaxError` on malformed input, same `any` return. Verified by execution, not by reading the
type: `parse('not json')` throws `SyntaxError`, exactly as the host does.

That is why `fjs/server/module.f.js`'s `responsesOf` still calls `JSON.parse` directly. Switching
to the fjs export today would look like an improvement while changing nothing, which is worse than
leaving it visible.

## What upstream is changing

`functionalscript#1430` (Sergey, open) proposes:

- a real `parse`, tokenizer-backed and **total**, returning `Result<Unknown, string>`;
- `parseNative` as the name for today's `JSON.parse` re-export, then deleted.

On upstream `origin/main` both already exist — `parse` returns a `Result` and `parseNative` is the
native one — so the split has landed there and only the removal is pending.

The stated rationale worth remembering: nothing in `fjs/` defines `JSON` and NaNVM has no `JSON`
object, so a `.f.ts`/`.f.js` module reaching for it depends on the JS host rather than on
FunctionalScript.

## What we do when we bump

One line changes, `fjs/server/module.f.js`'s `responsesOf`:

```js
.map(line => JSON.parse(line))          // today
.map(line => unwrap(parse(line)))       // after the bump
```

Two things to check at that point, neither of which is a blocker:

1. **`unwrap` throws too.** `fjs/types/result`'s `unwrap` is `if (kind === 'error') { throw v }`,
   and it throws the raw error **value** — a bare string here, not an `Error`. So `e.message` is
   `undefined` and `e instanceof Error` is `false`, the same trap `assert` has and the same one
   that already bit this project once. The gain is a described parse failure instead of a
   `SyntaxError` about a byte offset; it is not the removal of a panic. This was raised on
   `functionalscript#1430`.
2. **`responsesOf` is proof-only.** It decodes JSON-RPC envelopes in the Tests section of
   `fjs/server/module.f.js`. Nothing in production parses JSON in this repo, so the bump cannot
   affect served behaviour.

The `any` that used to sit on this helper is already gone: responses are typed `Unknown` and
narrowed through rtti schemas (`asEnvelope`, `asInitResult`, `asToolsListResult`, `asCallResult`),
which is the same schema-over-casts pattern `#1430` proposes for `fjs/mcp/proof.f.ts`'s 17 casts.
That part did not need to wait for the upstream change.
