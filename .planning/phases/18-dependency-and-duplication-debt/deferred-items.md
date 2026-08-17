# Phase 18 — deferred items

- **Stale comment in `fjs/server/module.f.js` lines 324-326.** It says `fjs/media/json`'s
  `parse` is "literally `export const parse = JSON.parse` — the same function under another
  name". That was true at 0.41.0 and is **false at the installed 0.43.1**, where `parse` is
  `parseTokens(tokenize(stringToList(text)))` and returns a `Result`. Found 2026-08-17 while
  re-checking `upstream-json-parse-split.md` (which was retired in this phase). The site is
  proof-only and the behaviour is deliberate; only the stated reason is stale. Phase 17
  (Documentation Truth Pass) work, not Phase 18's — this phase must not change behaviour.
