# Milestone v8 — Requirements at close

**Archived:** 2026-09-22 · **Milestone:** v8 *The Narrower Trap*
**Verdicts:** 3 COVERED, 0 PARTIAL, 0 MISSING.

`.planning/REQUIREMENTS.md` is **not** deleted at this close, for the reasons v6 and v7 give:
`planning-truth-gate.test.js` asserts the file is in the citing set on every `npm test`, and this
repository's requirement document is one cumulative file whose IDs are cited from code.

---

## Traceability at close

| ID | Tier | Statement | Verdict | Where it is proven |
|---|---|---|---|---|
| **MAINT-17** | T3 | Take `functionalscript` 0.50.0. `^0.49.0` does not admit it, so an explicit bump | ✅ **COVERED** | `package.json` declares `^0.50.0`, 0.50.0 installed, `tsc` **0**. 30 schemas byte-identical (`f2f79e40a957e7a6`); `npm test` 3458/3458 at the bump, `test:integration` 13/13, `test:ui` 47/47, `cov` 100/100/100. Phase 44, PR #173 |
| **MAINT-18** | T3 | A consumer-side migration report for 0.50.0 | ✅ **COVERED** | `.planning/reports/fjs-0.50.0-migration.md`, with §7 reproducing every number from the installed package. Phase 44, PR #173 |
| **MCP-10** | T2 | The MCP surface names the vocabulary a stored program is written in | ✅ **COVERED** | `fjs_run`'s description publishes the entry-point spelling and all ten `ctx.` members, derived from `taxGuestCtx`. The integration leaf that pinned the gap is inverted; `abiNamesAreTheContextsOwnKeys` and `publishedEntryPointSpellingMatchesThisProgramsOwn` guard the halves that could drift. `npm test` 3460/3460. Phase 45, PR #174 |

**Count at close:** 139 requirements, all checked. Derive rather than quote:

```sh
grep -cE '^- \[[ x]\] \*\*[A-Z]+-[0-9]+' .planning/REQUIREMENTS.md   # total
grep -cE '^- \[ \] \*\*[A-Z]+-[0-9]+' .planning/REQUIREMENTS.md      # outstanding
```

---

## What this milestone did not close

**MAINT-11's `fjs web` half stays PARTIAL.** 0.50.0 carries `readChunks` — this project's own
[functionalscript#2079](https://github.com/functionalscript/functionalscript/pull/2079) — but that
is the chunk *reader*, and what blocks a large response is the response *type*:
`ServerResponse.body` is one `Vec`, and there is no file-handle effect. `demo/serve.sh` stays on
`python3 -m http.server`.

The upstream design that owns it was corrected in the same window
([functionalscript#2203](https://github.com/functionalscript/functionalscript/pull/2203)): it was
written before `ReadWhole` existed and recorded `fjs/web` as *blocked*, when in fact there is now a
choice — `ReadChunks` is lazy but resolves the path per chunk, `ReadWhole` is one inode but
materializes the file, and only the handle effect is both.

**Phases 34 and 36 remain open and remain outside any milestone.** Phase 36's code half closed
here as MCP-10; what is left of both needs a person at a real client with real documents.
