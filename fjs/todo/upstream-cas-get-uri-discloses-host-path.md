# Upstream: `cas_get`'s `uri` field discloses the server's absolute host path

Status: **FILED UPSTREAM** as [functionalscript#1650](https://github.com/functionalscript/functionalscript/pull/1650)
— `fjs/mcp/todo/cas-get-uri-discloses-host-path.md`, **P2** (raised from P3 on 2026-08-19 by review;
see below). Upstream tracks issues in `todo/` files,
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

It is not a URI in the `scheme:` sense at all. **A `cas_get` that FINDS a blob tells a client the
home directory, the account name, and the store layout.**

*Corrected 2026-08-20, second review round on #1650. This line read "one `cas_get` call" and that
was too broad:* an invalid cBase32 hash is rejected before `uri` is computed
(`fjs/mcp/cas/module.f.mjs:219-220`), and a well-formed hash with no blob behind it answers
`no such hash` (`:226-227`) — both path-free. The path rides a successful lookup (`:231`, `:271`)
and the oversized-blob refusal (`:257`).

**The wording narrows; the exposure does not, and P2 stands.** `cas_list` answers *"All stored
content hashes (cBase32), one per line"* (`:295-303`) to the same client, and `cas_add` returns the
hash of whatever it just stored — a hash that yields the path is one call away, needing no prior
knowledge of the store. Worth stating rather than quietly softening: an overstatement that a
reviewer can puncture is how a real finding gets dismissed.

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

## Exposure is LIVE, not latent — this section said the opposite and was wrong

**Corrected 2026-08-19 after review on #1650.** The claim was: stdio is the only transport, so the
client is a local process that could call `os.homedir()` itself. **Stdio does not mean same machine,
same user.** `ssh host npx functionalscript mcp`, a container, and a wrapper running the server under
a different UID are all ordinary stdio launches in which the client cannot read the server account's
home directory — and `cas_get` hands it over. Same-user local is the *only* launch where the field
discloses nothing new, and it is one launch out of several, not the definition of the transport.

Remote transport (on `.planning/REQUIREMENTS.md`'s deferred list) is where even that one harmless
case disappears — so the argument for deciding BEFORE `remote-url.md` lands stands, but it no longer
rests on "harmless until then". Priority upstream is now P2.

**The lesson worth keeping:** the false premise was a generalisation from the single launch in front
of me — one server, started locally, by the same user. A transport is not its most common
configuration.

## What review changed upstream, besides the priority

`README.md`'s "`uri` is present only when the server was started with a `toUrl` resolver" is **not**
aspiration — it documents an API that shipped in functionalscript#1102 and was removed by `deb4f122`
(functionalscript#1159), whose own commit line reads *"remove toUrl"*; no changelog entry records the
removal, which is why the sentence outlived it by two file moves. So #1650's option 3 is a
*restoration*, and `deb4f122` created `remote-url.md` in the same commit that removed the resolver —
superseded pending a design, not judged wrong. Anyone reading that option here should read
`deb4f122` first.

## Retirement condition

Deleted when a released `functionalscript` no longer puts an absolute host path in that field, and
the `SEC:` case can assert on the whole envelope instead of parsing a field out of it.
