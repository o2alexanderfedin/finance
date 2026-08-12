---
phase: 15
slug: realism-polish-and-upstream
verified: 2026-08-12T02:19:01Z
status: passed
score: 5/5 must-haves verified
overrides_applied: 0
must_haves:
  truths:
    - "A second, non-tax report runs over the same documents with no engine change"
    - "A corrected document produces Form 1040-X Columns A/B/C mechanically from a diff of two stored reports, with per-line source hashes attached and no new mechanism"
    - "A prior-year capital loss carries over into the current year's Schedule D, and any year with parameters and documents computes"
    - "fjs_check(hash) smoke-checks a stored program without running it to completion, and is documented as having zero security value"
    - "fjs/media's detect recognises our dialects through a registry — local adoption of the already-shipped upstream registry, not local glue"
human_verification: []
---

# Phase 15: Realism Polish and Upstream Verification Report

**Phase Goal:** The claims that "reports are programs" and "amendments are a diff" are
demonstrated rather than asserted, and what stabilized goes upstream.
**Verified:** 2026-08-12T02:19:01Z
**Status:** passed
**Re-verification:** No — initial verification

This verification is CODE-FIRST: every claim below was independently re-derived, re-run, or
re-mutated by the verifier, not read off SUMMARY.md/REVIEW.md text. Where a figure came from an
external cited source (the IRS Schedule D instructions), the source PDF was fetched live and read
directly rather than trusted from a transcription.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A second, non-tax report runs through the real, unmodified `fjs_run` path, no engine change | ✓ VERIFIED | `fjs/report/payer/module.f.js` (payer summary, zero `fjs/tax/*` imports); real separate-process proof in `payer-report-integration.test.js`; engine files (`fjs/server/fjs_run/module.f.js`, `fjs/guest/module.f.js`, `fjs/guest/materialize/module.f.js`, `fjs/exec/module.f.js`) confirmed byte-unchanged since before Phase 15 (`git diff --stat 8721efd~1 HEAD` on those four paths: empty) |
| 2 | 1040-X Columns A/B/C from a diff of two stored reports, per-line source hashes attached, no new storage mechanism | ✓ VERIFIED | `fjs/report/amend/module.f.js:349` `amendmentDiff`; CR-01 malformed-input crash independently reproduced against the CURRENT code as a live `Result`, not a throw (see below); module only reads existing `vnd.fjs.run`/CAS content, never writes |
| 3 | Prior-year capital loss carries into Schedule D; any year with parameters and documents computes | ✓ VERIFIED | `fjs/tax/carryover/module.f.js` (worksheet), `fjs/schedule/d/module.f.js:245,290` (line 6/14 wiring); both halves (absent→legitimate `0n`, present→derived) independently mutation-tested by the verifier; arithmetic re-derived by hand against the fetched IRS `i1040sd.pdf`; genericity proven structurally, no TY2024 transcription, synthetic param set never added to `taxParamsByYear` |
| 4 | `fjs_check(hash)` smoke-checks without executing, documented as zero security value | ✓ VERIFIED | `fjs/guest/check/module.f.js:68` `fjsCheck`; the never-executes claim independently re-mutated by the verifier: production-body mutation left the unit suite green (3143/3143) but crashed the real-process integration test with the exact predicted stack trace; "no security value" stated in tool description (`fjs/server/module.f.js:179,191-195`), module docstring (`fjs/guest/check/module.f.js:5`), and `README.md:19` |
| 5 | `fjs/media`'s `detect` recognizes finance dialects via the already-shipped upstream registry, reachable from a real running path | ✓ VERIFIED | `fjs/media/dialects/module.f.js:119,141` (`financeDialects`/`detectFinance`, 13 entries incl. `revisionDialect` reused unchanged); wired into `cas_refresh` (`fjs/server/module.f.js:165,172`); reachability independently mutation-tested by the verifier against a real cross-process `cas-refresh-cross-process.test.js` run (see below) |

**Score:** 5/5 truths verified

**On success criterion 5's "upstream" wording:** confirmed per the verification brief — the
registry (`dialectEntry`/`detect`) already ships in the pinned `functionalscript@0.43.1`
(`node -p "require('./node_modules/functionalscript/package.json').version"` → `0.43.1`,
matching `package-lock.json` and the submodule pin `cc93a3ca`). This phase's scope was local
adoption (`fjs/media/dialects/module.f.js`), by owner decision recorded in `15-CONTEXT.md`. Not
scored as a shortfall.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `fjs/report/payer/module.f.js` | Non-tax report, string/function twin | ✓ VERIFIED | Zero `fjs/tax/*` imports (mechanically gated); real-process run confirmed |
| `payer-report-gate.test.js` | Import-graph gate + positive control | ✓ VERIFIED | Ran directly, green; positive control confirmed non-vacuous |
| `payer-report-integration.test.js` | Real separate-process `fjs_run` proof | ✓ VERIFIED | Spawns `node index.js`, no `npx`; passed in full suite run |
| `fjs/report/amend/module.f.js` | PROV-06 diff module | ✓ VERIFIED (post-fix) | CR-01 fix present (`namedReportLineFromWire`, lines 180-201) and independently re-confirmed live |
| `fjs/document/prior_year_capital_loss/module.f.js` | New dialect, 4 required money fields | ✓ VERIFIED | `checkReferences` refuses by name; absence handled entirely by caller (no field is `option`) |
| `fjs/tax/carryover/module.f.js` | 13-line worksheet | ✓ VERIFIED | Arithmetic independently re-derived by hand for Worked Examples B and C, matches exactly |
| `fjs/guest/check/module.f.js` | `fjsCheck`, never executes | ✓ VERIFIED | Live mutation reproduced the documented unit-green/real-process-crash split |
| `fjs/media/dialects/module.f.js` | Local dialect registry, `detectFinance` | ✓ VERIFIED | 13 entries; reachability from `cas_refresh` mutation-confirmed |
| `year-genericity-gate.test.js` | Scoped no-bare-year gate | ✓ VERIFIED | Corrected regex (optional leading-identifier group) confirmed non-vacuous; ran directly, green, zero real offenses |
| `payer-report-gate.test.js` / `payer-report-integration.test.js` | see above | ✓ VERIFIED | — |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `payer-report-integration.test.js` | `fjs_run` MCP tool (real process) | `spawn('node', [index.js])` + `tools/call fjs_run` | WIRED | Confirmed in full `npm test` run (`✔ PROV-08: ... real, separate fjs_run process ...`) |
| `fjs/report/amend/module.f.js` `amendmentDiff` | CAS-stored `vnd.fjs.run` records | `readRunRecord`/`readResultRecord` | WIRED | Live repro against exported `amendmentDiff`: two malformed-input shapes both return `["error", "..."]`, never throw |
| `fjs/schedule/d/module.f.js` | `fjs/tax/carryover/module.f.js` | `capitalLossCarryoverWorksheet` call at line ~209 | WIRED | Mutation of `line6`'s absent-branch literal (`0n`→`1n`) reddened `absentCarryoverWithBrokerageSalesPresentComputesLegitimateZeroNotRefusal` and 3 other leaves |
| `fjs/form1040/core/module.f.js` `form1040IncomeLines` | `fjs/schedule/d/module.f.js` `scheduleD` | `capitalLossCarryoverForms` threaded through `inputsOf` | WIRED (per SUMMARY's own mutation record; consistent with the verifier's own schedule/d-level mutation) | `carryoverReachesScheduleDThroughTheFullIncomeLinesEntryPoint` compares `outcome.scheduleD16Cents` against an independently-called `scheduleD(...)` |
| `fjs/server/module.f.js` `casRefreshTool` | `fjs/media/dialects/module.f.js` `detectFinance` | direct call at line 165 | WIRED | Verifier mutated `detectFinance` to `detect([])`; `cas-refresh-cross-process.test.js` (real separate-process test) failed with the exact predicted assertion diff; reverted, suite green again |
| `fjs/server/module.f.js` `fjsCheckTool` | `fjs/guest/check/module.f.js` `fjsCheck` | direct call | WIRED | Confirmed via `fjs-run-integration.test.js`'s real MCP `tools/call fjs_check` in the full suite run |

### Live Mutations Performed By The Verifier (not trusted from SUMMARY/REVIEW)

| # | Mutation | File:Line | Predicted | Observed | Reverted Clean? |
|---|----------|-----------|-----------|----------|------------------|
| 1 | `fjsCheck` invokes `loaded.report(...)` before returning | `fjs/guest/check/module.f.js:91-93` | Unit suite stays green (documented limitation); real-process test crashes | Unit: 3143/3143 pass. Real-process (`fjs-run-integration.test.js`): failed, `Error: fjs_check must never invoke report`, exact predicted stack | Yes — `git diff --numstat` empty |
| 2 | `line6` absent-carryover branch: `0n` → `1n` | `fjs/schedule/d/module.f.js:245` | Named absent-is-zero proof reddens | 4 leaves reddened incl. `absentCarryoverWithBrokerageSalesPresentComputesLegitimateZeroNotRefusal` | Yes — clean |
| 3 | `detectFinance = detect(financeDialects)` → `detect([])` | `fjs/media/dialects/module.f.js:141` | Real cross-process reachability test catches it (registered-but-unreachable would not) | `cas-refresh-cross-process.test.js` failed: `dialectCounts` had only `text/plain`, missing `vnd.fjs.revision` | Yes — clean |
| 4 | Live repro of CR-01's two malformed-input shapes against current `amendmentDiff` (empty `sources`, non-decimal `value`) | `fjs/report/amend/module.f.js` | Named `error(...)` `Result`, never a throw | `["error","stored line \"interest\" has no sources"]` and `["error","stored line \"interest\" has a malformed value: ...")]` — no throw | N/A (read-only repro, no source edit) |

### Data-Flow / Independent Re-Derivation

| Item | Method | Result |
|------|--------|--------|
| Capital Loss Carryover Worksheet, Worked Example B | Hand re-derived from the 13 printed lines against the module's own inputs | shortTermCarryoverCents = 600000n, longTermCarryoverCents = 0n — matches shipped code exactly |
| Capital Loss Carryover Worksheet, Worked Example C | Hand re-derived independently | shortTermCarryoverCents = 0n, longTermCarryoverCents = 400000n — matches shipped code exactly |
| The four transcribed prior-year line citations (2024 Form 1040 line 15; 2024 Sch. D lines 7, 15, 21) | **Fetched the live IRS source** `https://www.irs.gov/pub/irs-pdf/i1040sd.pdf` and read the "Capital Loss Carryover Worksheet—Lines 6 and 14" (printed page 10) directly | All 13 printed lines match the module's transcription verbatim, including all four source-line citations. **This closes 15-VALIDATION.md's manual-only item** — see note below. |

**Closing 15-VALIDATION.md's manual-only item.** That document named exactly one item no green
suite could close: whether the four transcribed prior-year figures map to the right printed lines.
The verifier fetched `i1040sd.pdf` directly from irs.gov (not from memory, not from a secondary
source) and read the worksheet's own printed text. Line 1 cites "2024 Form 1040, 1040-SR, or
1040-NR, line 15"; line 2 cites "2024 Schedule D, line 21"; line 5 cites "2024 Schedule D, line 7";
line 6/9 cite "2024 Schedule D, line 15" — all four exactly matching `priorYearFormLine15`,
`priorYearScheduleDLine21`, `priorYearScheduleDLine7`, `priorYearScheduleDLine15` respectively.
Minor citation-format note (not a code defect): `15-CONTEXT.md` and `15-VALIDATION.md` cite this
page as "p9"; the shipped code's own docstrings (`fjs/tax/carryover/module.f.js`,
`fjs/document/prior_year_capital_loss/module.f.js`) correctly cite "p.10" — the fetched PDF's own
footer reads "10" on the page carrying the worksheet, so the CODE's citation is the accurate one;
only the two planning documents are off by one page.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|---|---|---|---|---|
| PROV-08 | 15-01 | Second, non-tax report, no engine change | ✓ SATISFIED | See Truth #1 |
| PROV-06 | 15-04 | 1040-X A/B/C from a report diff | ✓ SATISFIED | See Truth #2; CR-01 fix confirmed live |
| TAX-17 | 15-02, 15-05 | Multi-year + carryover | ✓ SATISFIED | See Truth #3 |
| MCP-09 | 15-03 | `fjs_check`, never executes, no security value | ✓ SATISFIED | See Truth #4; WR-01 text fix confirmed at `fjs/server/module.f.js:191-195` and `.planning/REQUIREMENTS.md:109-118` |
| DOC-16 | 15-06 | Local dialect registry adoption | ✓ SATISFIED | See Truth #5; `.planning/REQUIREMENTS.md:249-257` correction confirmed |

**Orphaned requirements:** none found — `.planning/REQUIREMENTS.md`'s Phase 15 row set
(MCP-09, DOC-16, TAX-17, PROV-06, PROV-08) matches exactly the five plans' declared
`requirements:` fields.

**Documentation inconsistency found (non-blocking, WARNING):** `.planning/REQUIREMENTS.md`'s
own requirement-by-requirement checkbox list (lines 109, 249, 333, 350, 358) correctly marks
MCP-09/DOC-16/TAX-17/PROV-06/PROV-08 as `[x]` complete, and the traceability table correctly
shows MCP-09 (line 580), DOC-16 (line 622), and TAX-17 (line 645) as "Complete" — but the SAME
traceability table's rows for **PROV-06 (line 651)** and **PROV-08 (line 653)** still read
"Pending", contradicting both their own checkbox entries and the verified code. This is a
bookkeeping staleness in a redundant summary table, not a functional gap — every one of the five
requirements is genuinely implemented and proven (see truths #1-#5 above) — but it should be
corrected so the document is internally consistent. Suggested fix: flip those two rows to
"Complete".

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `.planning/REQUIREMENTS.md` | 651, 653 | Stale "Pending" status contradicting the same file's own `[x]` checkbox entries for PROV-06/PROV-08 | ℹ️ Info/Warning | Documentation-only; no code impact; recommend one-line fix |

No `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER` markers, no "not yet implemented"/"coming soon"
strings, found in any of the 17 files this phase created or modified (checked via `grep` across
the full file set from `8721efd~1` to `HEAD`, excluding `.planning/` and the vendored
`functionalscript` submodule).

### Behavioral Spot-Checks / Suite Measurement

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full suite green | `npm test` | `tests 6296 / pass 6296 / fail 0`, exit 0 | ✓ PASS |
| De-duplicated project-local proof count | `node --test 2>&1 \| grep '^✔ import("./fjs/' \| sed 's/ ([0-9.]*ms)$//' \| sort -u \| wc -l` | `907` | ✓ PASS (matches the last independently-verified figure exactly) |
| `functionalscript` version consistency | `node -p .../package.json` vs `package-lock.json` vs `git ls-tree HEAD functionalscript` | all three: `0.43.1` / `cc93a3ca` | ✓ PASS |
| Real-process `cas_refresh` reachability | `node --test cas-refresh-cross-process.test.js` | 1/1 pass | ✓ PASS |
| Real-process `fjs_run`/`fjs_check` coverage | (part of full `npm test` run) | passed within the 6296 | ✓ PASS |
| Working tree clean after all verifier mutations | `git status --short` | empty | ✓ PASS |

### Probe Execution

No `scripts/*/tests/probe-*.sh` convention exists in this repository (this project's root-level
`*.test.js` mechanical gates — `magi-gate.test.js`, `payer-report-gate.test.js`,
`year-genericity-gate.test.js` — serve the equivalent role and were run directly, see above).
Step 7c: SKIPPED (no `scripts/*/tests/probe-*.sh` convention in this project).

### Human Verification Required

None. The single manual-only item 15-VALIDATION.md named (the four transcribed prior-year line
citations) was closed in this verification pass by fetching and reading the primary IRS source
directly — see "Data-Flow / Independent Re-Derivation" above.

### Gaps Summary

No gaps block phase closure. All five ROADMAP success criteria are independently verified against
running code, not SUMMARY/REVIEW claims: two were re-proven by the verifier's own production-code
mutations (the `fjs_check` never-executes split, and `detectFinance` reachability from
`cas_refresh`), one was re-proven by disconnecting the absent-carryover zero path, and CR-01's fix
(the amendment-diff throw-vs-Result defect the code reviewer found) was independently reproduced
live against the current code and confirmed fixed. The worksheet's arithmetic and its four source
citations were independently re-derived/re-checked against the live-fetched IRS PDF, closing the
phase's one previously-open manual-only item.

The one non-blocking finding — `.planning/REQUIREMENTS.md`'s traceability table still listing
PROV-06/PROV-08 as "Pending" against its own "Complete" checkboxes for the same two items — is
recorded as a WARNING for a follow-up documentation fix, not a reason to withhold phase closure.

---
_Verified: 2026-08-12T02:19:01Z_
_Verifier: Claude (gsd-verifier)_
