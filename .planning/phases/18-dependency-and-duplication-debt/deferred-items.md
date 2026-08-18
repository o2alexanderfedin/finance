# Phase 18 — deferred items

**All clear as of 2026-08-17. The one item below is CLOSED.** Kept rather than deleted, because
how it was found is worth more than the fix.

- ~~**Stale comment in `fjs/server/module.f.js` lines 324-326.**~~ **FIXED 2026-08-17.**
  It said `fjs/media/json`'s `parse` is "literally `export const parse = JSON.parse` — the same
  function under another name". That was true at 0.41.0 and **false at the installed 0.43.1**,
  where `parse` is `parseTokens(tokenize(stringToList(text)))` and returns a `Result`. Found
  2026-08-17 while re-checking `upstream-json-parse-split.md` (retired in this phase), correctly
  deferred to Phase 17 because Phase 18 must not change behaviour.

  **Phase 17 never ran, so the deferral had no floor.** The comment was found again on
  2026-08-17 during a post-release truth pass — the second independent discovery of the same
  defect, which is what a deferral without an owner produces. It was worse than recorded here:
  the comment also cited `fjs/todo/upstream-json-parse-split.md`, deleted in `c1441e1`, and
  line 85 of the same file already imported the total `parse` — so the paragraph asserted the
  **opposite** of the import fourteen lines above it.

  Fixed as a comment-only change. **The whole suite was green with the comment inverted**, before
  and after; no proof can see a docstring. The check that catches this class is reading the import
  beside the claim, which is why the replacement text names `jsonParse` explicitly.
