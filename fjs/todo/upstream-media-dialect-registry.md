# Upstream: `fjs/media` `detect` has no dialect registry

Status: **reported, not fixed upstream.** No local workaround needed yet — see
[Local workaround](#local-workaround).

Target: `functionalscript` `fjs/media/module.f.js`. Present in 0.40.0.

## The gap

The root `fjs/media` `detect` adds dialect-tagged JSON recognition on top of
`fjs/media/type`'s byte-signature classifier: when a blob is whole-blob-valid UTF-8, it
JSON-parses it and validates against a known dialect's rtti schema, reporting that
dialect's media type on a match.

"A known dialect" is exactly one dialect, hardcoded:

```js
import { decodeText as decodeRevisionText, mediaType as revisionMediaType } from './revision/module.f.js';
// …
const [tag] = decodeRevisionText(text);
return tag === 'ok' ? { ...base, mime_type: revisionMediaType } : base;
```

`vnd.fjs.revision` is the only dialect `detect` can ever recognize, and nothing lets a
downstream package contribute another. The module's own docstring says "currently just
`vnd.fjs.revision`", so growth was anticipated — it just was not built.

## Why it matters here

Every finance document type is a `vnd.fjs.*` JSON dialect on a shared base (see
[../../todo/plan.md](../../todo/plan.md) Week 1 step 5). Under 0.40.0, none of them can
participate in media detection: a stored `vnd.fjs.1099` blob classifies as `text/plain`.

The severity is limited, and worth being precise about. Our ingestion path validates a
document whose type we already know, by calling that type's own `validate` directly —
which needs nothing from `detect`. `detect` matters only for classifying a blob of
*unknown* provenance. So this is not Week 1 blocking. It becomes awkward in Week 3, when
several document types exist and a one-dialect detector starts to look actively wrong.

## What the upstream fix should look like

`detect` should take the dialects to try, rather than importing one:

- a list of `(text) => Result<unknown, …>` decoders paired with their media types, or a
  list of `{ decodeText, mediaType }` modules — `fjs/media/revision` already exports
  exactly that pair, so its shape is the natural interface;
- try each in order, report the first match, fall through to the `fjs/media/type` verdict
  when none match — preserving current behavior when the list holds only `revision`;
- keep the existing default export wired to `[revision]` so no caller breaks.

Two properties to preserve, both deliberate in the current design and easy to lose:

- **Detection stays semantic, not syntactic.** Any JSON satisfying a dialect's schema is
  recognized regardless of key order or whitespace. No `{"dialect":` prefix shortcut, even
  though a registry makes one tempting as an optimization.
- **Dialect detection stays bounded.** It runs only on a single already-buffered `Vec`
  (capped at 128 KiB), because validation needs the whole parsed value. The unbounded
  `detectStream` must remain dialect-unaware.

## Local workaround

*None, and probably none needed.* We call our own schemas' `validate` directly. If
content-sniffing is ever wanted before Week 5, the local version is a small function that
tries our decoders and falls back to `fjs/media` `detect` — which is also the prototype of
the upstream fix. Record it here if written.

## Upstreaming

Week 5, per [../../todo/plan.md](../../todo/plan.md), or earlier if Week 3 needs it.
Delete this file once a released FJS version carries the registry.
