---
phase: 01-planning-document-corrections-and-the-upstream-report
verified: 2026-08-03T00:00:00Z
status: passed
score: 11/11 must-haves verified
overrides_applied: 0
---

# Phase 1: Planning-Document Corrections and the Upstream Report Verification Report

**Phase Goal:** Every planning document states only things that are true, so no later phase is planned against text that dissolves on contact.
**Verified:** 2026-08-03
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths / Must-Haves

| # | Must-Have | Status | Evidence |
|---|-----------|--------|----------|
| 1 | `djs/parser` nowhere proposed as a validation remedy | ✓ VERIFIED | `grep -rn "djs/parser" .planning todo fjs README.md` — every hit in `.planning/PROJECT.md:321,360`, `todo/plan.md:87`, `fjs/todo/implement-mcp-server.md:169` is a correction ("`djs/parser` cannot validate a program — it is a data-only language with no function node"). `README.md` has zero hits. `.planning/research/*` and `REQUIREMENTS.md`/`ROADMAP.md` criterion-text hits are the documented exemption (research findings / criteria quoting the claim to describe fixing it). |
| 2 | No document asserts "cannot happen" without stating the `Object.hasOwn` + null-prototype guard | ✓ VERIFIED | `grep -rn "cannot happen"` — the only live prose hits are `REQUIREMENTS.md:65` (DOCC-02 requirement text, exempted) and `ROADMAP.md:165` (criterion text, exempted). `PROJECT.md:303-311` states "provided the lookup guard is `Object.hasOwn` against a null-prototype map"; `PROJECT.md:359` Key Decisions row states the same condition; `fjs/todo/implement-mcp-server.md:126-135` states "true only if the lookup guard is Object.hasOwn..."; `fjs/todo/upstream-match-partial-operation-map.md` states "That design is sound **only if** the lookup guard is `Object.hasOwn(map, command)` against a null-prototype map" and warns the `in`-guard workaround. No unqualified "cannot happen"/"simply cannot happen" remains live anywhere. |
| 3 | README `## Goal`/intro + PROJECT.md Success Criterion 2 name Claude Code/Claude Desktop; remote transport is v2; historical blockquote untouched | ✓ VERIFIED | `README.md:3-6`: "uses Claude Code or Claude Desktop (or any other MCP client that supports local stdio servers)... Remote transport (HTTPS + OAuth)... is a v2 milestone." `PROJECT.md:5-8` ("What This Is") and `PROJECT.md:385` (Success Criterion 2: "Point Claude Code or Claude Desktop at the MCP server") both match. `PROJECT.md:136-152` verbatim blockquote of the original README goal (commit `c7a9cce`, mentioning ChatGPT) is present and unedited — correctly preserved as historical record. |
| 4 | `import()` deferral rests on schedule grounds with named compensating controls (SEC-01/02/03), not "trusted and local" | ✓ VERIFIED | `grep -rn "sole user is trusted and local\|the only user is trusted and local" .planning todo fjs README.md` returns zero live hits (only in `research/PITFALLS.md`, `research/SUMMARY.md`, and the plan file itself — all exempted/historical). `PROJECT.md:317-321` and `:360`: "Accepted for v1 on schedule grounds — the untrusted party is the document, not the user; compensating controls are `--permission` (SEC-01), an import-specifier allow-list (SEC-02), and content-hash-derived filenames (SEC-03)." |
| 5 | `fjs/todo/implement-mcp-server.md` scopes the "cannot be proof-tested" claim to the stdio server process; `fjs_run` described as proof-testable via `import_`/`fjs/effects/node/virtual` | ✓ VERIFIED | `fjs/todo/implement-mcp-server.md:176-186`: "The stdio server *process* itself cannot be proof-tested directly... This does not extend to `fjs_run`: `import()` is reached through the `import_` effect, which `fjs/effects/node/virtual` interprets in-memory, so the whole materialize-and-run path is fully proof-testable with no real filesystem." |
| 6 | Upstream issue exists; URL recorded in repo | ✓ VERIFIED | `gh issue view 1420 --repo functionalscript/functionalscript --json title,state,url` → `{"state":"OPEN","title":"\`match\` in \`fjs/effects/module.f.js\` does plain bracket lookup, so a plain-object \`OperationMap\` is not a safe whitelist","url":"https://github.com/functionalscript/functionalscript/issues/1420"}`. `fjs/todo/upstream-match-partial-operation-map.md:4`: `[functionalscript/functionalscript#1420](https://github.com/functionalscript/functionalscript/issues/1420)`. Issue body contains the `__defineGetter__` reproduction, `Object.hasOwn` guard, and `ARBITRARY CODE RAN` evidence. |
| 7 | TY2025 parameter-sourcing rule names Rev. Proc. 2024-40 as modified by Rev. Proc. 2025-32, and the original 2025 inflation release as wrong | ✓ VERIFIED | `PROJECT.md:81-84`: "TY2025 values come from Rev. Proc. 2024-40 as modified by Rev. Proc. 2025-32, not the original 2025 inflation-adjustment release." `todo/plan.md:62-65`: same rule, Week 2 section. Also present in `REQUIREMENTS.md:78,265` and `ROADMAP.md:169,279` (Phase 8 read points). |
| 8 | DOCC-07: storage boundary is a decimal string, never integer-cents-as-JSON-number, in REQUIREMENTS.md (EXACT-05) and ROADMAP.md (Phase 4 criterion 4, Phase 5 depends-on); rationals-in-computation and strings-on-MCP-wire unchanged | ✓ VERIFIED | `REQUIREMENTS.md:255-258` (EXACT-05): "money as a decimal **string** in JSON at the storage boundary (never a JSON number — decoded to exact cents by the semantic check, per AGENTS.md), rationals inside computation, decimal **strings** on the MCP wire." `ROADMAP.md:217` (Phase 4 SC4): "a decimal **string** in JSON at the storage boundary (never a JSON number...), exact rationals inside computation, decimal **strings** on the MCP wire." `ROADMAP.md:224` (Phase 5 depends-on): "Phase 4 (money as a string at the storage boundary)". `grep -n "integer cents in JSON at the storage boundary"` and `"cents at the storage boundary"` both return nothing. Regression check: "rationals inside computation" and "MCP wire" phrases both still present and unchanged in both files. DOCC-07 entry present as requirement bullet (`REQUIREMENTS.md:80`), traceability row (`:415`), coverage-by-phase count 8 (`:494`), and ROADMAP requirements line + Coverage table count 7 (`ROADMAP.md:162,423`). |
| 9 | Locked decision: three numbered fix sketches in `fjs/todo/upstream-match-partial-operation-map.md` byte-identical to pre-phase state | ✓ VERIFIED | `git show 43d9c05~1:...` vs current, sliced from "What the upstream fix should look like" to "value domain" — `diff` produced zero output (exit 0, identical). |
| 10 | MVP discipline: no CI gates/lint/scripts/tooling added | ✓ VERIFIED | `git diff --stat 43d9c05~3..HEAD` shows 11 files changed, all Markdown (`.planning/PROJECT.md`, `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md`, three `*-PLAN.md`, `01-UPSTREAM-ISSUE.md`, `README.md`, `fjs/todo/implement-mcp-server.md`, `fjs/todo/upstream-match-partial-operation-map.md`, `todo/plan.md`). `guard-check.mjs` was added in an earlier context commit (`13e840c`, which is exactly `43d9c05~3`) and is outside this diff range — the one pre-existing reproduction script, unchanged by the phase's execution commits. |
| 11 | Nothing broke: `npm test` 1 pass/0 fail; `npx tsc --noEmit` clean | ✓ VERIFIED | `npm test` → `tsc && node --test` → "tests 1, pass 1, fail 0". `npx tsc --noEmit` → exit 0, no output. |

**Score:** 11/11 must-haves verified

### Anti-Patterns Found

Scanned all seven touched planning/spec files for `TBD|FIXME|XXX`. Zero hits in the six files this phase actually rewrote prose in (`PROJECT.md`, `README.md`, `todo/plan.md`, `fjs/todo/implement-mcp-server.md`, `fjs/todo/upstream-match-partial-operation-map.md`, `REQUIREMENTS.md`). `ROADMAP.md` contains `**Plans**: TBD` placeholders for Phases 2–15 and a `0/TBD` progress-table convention — these are the standard "not yet planned" roadmap placeholders for phases outside this phase's scope, pre-dating this phase's edits (confirmed via `git diff 43d9c05~3..HEAD -- .planning/ROADMAP.md`, which shows Phase 1's own `Plans: TBD` line was the one replaced with the 3-plan list; the other phases' `TBD` markers are untouched, pre-existing, and not a debt marker introduced by this phase). Not a blocker.

### Requirements Coverage

| Requirement | Description | Status | Evidence |
|---|---|---|---|
| DOCC-01 | Remove `djs/parser` validation remedy | ✓ SATISFIED | Must-have 1 |
| DOCC-02 | Correct "cannot happen" soundness claim | ✓ SATISFIED | Must-have 2 |
| DOCC-03 | Correct ChatGPT-as-client claim | ✓ SATISFIED | Must-have 3 |
| DOCC-04 | Correct `fjs_run` cannot-be-proof-tested claim | ✓ SATISFIED | Must-have 5 |
| DOCC-05 | Correct "sole user trusted and local" rationale | ✓ SATISFIED | Must-have 4 |
| DOCC-06 | TY2025 parameter-sourcing rule | ✓ SATISFIED | Must-have 7 |
| DOCC-07 | Storage-boundary money representation reconciliation | ✓ SATISFIED | Must-have 8 |
| SEC-04 | File upstream issue, record URL | ✓ SATISFIED | Must-have 6 |

No orphaned requirements found for Phase 1 in `REQUIREMENTS.md`'s traceability table (all 8 map to Phase 1, matching the plans' declared `requirements:` frontmatter).

### Human Verification Required

None. All must-haves are objectively verifiable via grep, diff, `gh issue view`, `npm test`, and `tsc --noEmit`, and all were run directly against the current repository state (not inferred from SUMMARY.md).

### Gaps Summary

No gaps. All 11 must-haves — covering the mechanism claim corrections, the audience/client claim, the `import()` deferral rationale, the proof-testability scoping, the filed upstream issue with recorded URL, the TY2025 parameter-sourcing rule, the DOCC-07 storage-boundary reconciliation (with the rationals/MCP-wire regression check), the byte-identical preservation of Sergey's fix sketches, and the MVP-discipline/test-health checks — verified true against the live repository. The phase goal ("Every planning document states only things that are true, so no later phase is planned against text that dissolves on contact") is TRUE as of this verification.

---

_Verified: 2026-08-03_
_Verifier: Claude (gsd-verifier)_
