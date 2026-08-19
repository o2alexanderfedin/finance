# Upstream: `cas_get`'s `uri` field discloses the server's absolute host path

Status: **FILED UPSTREAM** as [functionalscript#1650](https://github.com/functionalscript/functionalscript/pull/1650)
— `fjs/mcp/todo/cas-get-uri-discloses-host-path.md`, P3. Upstream tracks issues in `todo/` files,
so that file is the issue. **It is a design decision on a public protocol surface, not a patch to
apply, and it belongs to the maintainer** — which is why nothing was changed here or there.

## What it is, verified by execution against 0.46.1

`fjs/mcp/cas/module.f.mjs:222` computes `const uri = c.url(key)` **unconditionally**, and it reaches
the metadata object on both success paths and the oversized-blob error text. `FileCas.url` is
`join(path, toPath(hash))`, `path` is `home`, and the Node runner fills `home` from `os.homedir()`.
Executed:

```
uri = /Users/<username>/.cas/g0/00/00000000000000000000000000000000000938nkrj2nwvvw
```

It is not a URI in the `scheme:` sense at all. **One `cas_get` call tells a client the home
directory, the account name, and the store layout.**

## Why this repo cares, and where it is currently mishandled

`finance` serves that registry, so a client learns where the store lives **before any of our own
code gets a say**. On 2026-08-19 we removed host paths from `fjs_run`'s error text and proved, in a
real-process test, that neither the response nor the stored run record carries one. This undercuts
that property one field over.

**And our own `SEC:` case in `fjs-run-integration.test.js` parses the run record's `error` field OUT
of the envelope precisely so it cannot redden on the `uri`.** That is deliberate — a test that
reddened on the `uri` would prove nothing about our rendering — but it means the leak is presently
"handled" in a test's parsing, which is the weakest possible place for it. Do not mistake that
parsing for a fix.

## Exposure is latent, not live

stdio is the only transport today, so the client is a local process that could call `os.homedir()`
itself. Remote transport is on `.planning/REQUIREMENTS.md`'s deferred list; that is where this stops
being harmless, and it is why #1650 argues the decision belongs BEFORE `remote-url.md` lands rather
than inside it.

## Retirement condition

Deleted when a released `functionalscript` no longer puts an absolute host path in that field, and
the `SEC:` case can assert on the whole envelope instead of parsing a field out of it.
