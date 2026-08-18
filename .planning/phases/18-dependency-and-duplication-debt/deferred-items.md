# Phase 18 — deferred items

**All clear as of 2026-08-17. The one item below is CLOSED.** Kept rather than deleted, because
how it was found is worth more than the fix.

- ~~**Stale comment in `fjs/server/module.f.js` lines 324-326.**~~ **FIXED 2026-08-17.**
  It said `fjs/media/json`'s `parse` is "literally `export const parse = JSON.parse` — the same
  function under another name". That was true at 0.41.0 and **false at the installed 0.43.1**,
  where `parse` is `parseTokens(tokenize(stringToList(text)))` and returns a `Result`. Found
  2026-08-17 while re-checking `upstream-json-parse-split.md` (retired in this phase), correctly
  deferred to Phase 17 because Phase 18 must not change behaviour.

  **The deferral pointed BACKWARDS, which is why nothing collected it.** This was first
  written as "Phase 17 never ran"; that is wrong, and the timestamps say so. Phase 17 shipped as
  PR #84 at 03:26 PDT on 2026-08-17 (`948a61b`), Phase 18 merged as PR #87 at 14:10 PDT, and
  **this file was written at 21:10 PDT** — seven hours after the phase it defers to had already
  completed. A deferral to a finished phase is not a deferral; it is a deletion with a
  forwarding address. The comment was rediscovered later the same evening by a truth pass that
  was not looking for it. It was worse than recorded here:
  the comment also cited `fjs/todo/upstream-json-parse-split.md`, deleted in `c1441e1`, and
  line 85 of the same file already imported the total `parse` — so the paragraph asserted the
  **opposite** of the import fourteen lines above it.

  Fixed as a comment-only change. **The whole suite was green with the comment inverted**, before
  and after; no proof can see a docstring. The check that catches this class is reading the import
  beside the claim, which is why the replacement text names `jsonParse` explicitly.
