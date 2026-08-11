---
phase: 15-realism-polish-and-upstream
plan: 02
subsystem: tax-computation
tags: [functionalscript, capital-loss-carryover, schedule-d, document-dialect, mechanical-gate, tdd]

# Dependency graph
requires:
  - phase: 12.1
    provides: "fjs/schedule/d/module.f.js's documented-zero seam at lines 6/14, naming the Capital Loss Carryover Worksheet as the missing piece"
  - phase: 05
    provides: "fjs/document/base and fjs/document/money_field — the document-dialect base helper and the shared negative-accepting money-field exactness check"
provides:
  - "fjs/document/prior_year_capital_loss/module.f.js — the vnd.fjs.prior_year_capital_loss dialect: four required signed-decimal-string prior-year figures, no stored carryover total"
  - "fjs/tax/carryover/module.f.js — capitalLossCarryoverWorksheet, the 13-line IRS worksheet in pure bigint arithmetic, plus carryoverWorksheetInputsFromDocument bridging the dialect to the worksheet via centsFromString"
  - "year-genericity-gate.test.js — a mechanical, scoped gate proving no bare hardcoded-year comparison branch survives in fjs/, with four negative controls and a mutation-checkable positive control"
affects: [15-05, phase-16]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Document dialect with no formRevision and no payer/account (mirrors vnd.fjs.medical_expenses): a taxpayer's own transcription of prior-year facts, not an information return"
    - "Absent-document-is-zero vs. present-but-broken-refuses, applied at the WHOLE-DOCUMENT layer rather than the per-field layer: every one of the four money fields is required, and the caller simply never constructs the document when there is nothing to carry"
    - "Scoped mechanical grep-gate targeting a defect SHAPE (identifier-vs-4-digit-literal comparison) rather than a bare text scan, mirroring magi-gate.test.js"

key-files:
  created:
    - fjs/document/prior_year_capital_loss/module.f.js
    - fjs/tax/carryover/module.f.js
    - year-genericity-gate.test.js
  modified: []

key-decisions:
  - "Corrected the plan's own literal year-genericity regex, which fails its own positive control: /[A-Za-z_$][\\w$]*[Yy]ear.../ requires a MANDATORY leading identifier-prefix character in addition to the 4-letter year/Year suffix, so the bare 4-letter identifier `year` (used in the plan's own second positive-control example, `year !== 2025`) can never match. Made the leading identifier-prefix group optional instead; re-verified all four negative controls, both positive controls, zero real-tree offenses, and mutation-checkability of the operator alternation."
  - "Added carryoverWorksheetInputsFromDocument, a bridge function not spelled out in Task 3's <action> text but required by the plan's own frontmatter must_haves.key_links entry (fjs/tax/carryover -> fjs/document/prior_year_capital_loss via centsFromString) — connects the dialect's four decimal-string fields to the worksheet's four signed-bigint-cents inputs, proven end-to-end against Worked Example B's own literals as decimal strings."
  - "All four money fields in the new dialect are REQUIRED, never option — the absent-document-is-zero case is handled entirely by the caller never constructing the document (Schedule D lines 6/14, a later plan's wiring), never by an optional field inside this dialect, per 15-CONTEXT.md's REVISED Area 3 resolution."

requirements-completed: []

# Metrics
duration: 40min
completed: 2026-08-11
---

# Phase 15 Plan 02: Prior-Year Capital Loss Carryover Foundation (TAX-17) Summary

**The Capital Loss Carryover Worksheet's 13 printed lines computed as pure bigint arithmetic over a new taxpayer-transcribed document dialect (four prior-year figures, no stored total), plus a mechanical gate proving no hardcoded-year branch survives anywhere in `fjs/` — with the gate's own regex corrected against a failing positive control before being trusted.**

## Performance

- **Duration:** ~40 min
- **Tasks:** 3 completed (plus one plan-required addition to Task 3)
- **Files modified:** 3 created, 0 modified

## Accomplishments

- Built `fjs/document/prior_year_capital_loss/module.f.js`: the `vnd.fjs.prior_year_capital_loss` dialect carrying exactly the four prior-year result figures the worksheet needs (2024 Form 1040 line 15, and 2024 Schedule D lines 7/15/21) — all four REQUIRED, never `option`, no `total`/`carryover` field anywhere (mechanically proven), no `formRevision` (mirrors `vnd.fjs.medical_expenses`'s taxpayer-transcribed-record precedent)
- Built `fjs/tax/carryover/module.f.js`: `capitalLossCarryoverWorksheet`, all 13 printed lines (i1040sd.pdf, 2025 revision, p.10) as pure bigint arithmetic, TDD'd against three independently hand-computed worked examples plus an edge case, and `carryoverWorksheetInputsFromDocument` bridging the two files via `centsFromString`
- Added `year-genericity-gate.test.js`: a mechanical scan for a bare hardcoded-year comparison branch (an identifier ending in `year`/`Year`, or bare `year`, compared against a 4-digit literal in either operand order), zero real offenses against the current `fjs/` tree, four negative controls (index access, test-fixture identifier, citation string, `assertEq` call), and a mutation-checkable positive control
- **Caught and corrected a defect in the plan's own suggested regex before trusting it**: the literal text in 15-02-PLAN.md's Task 1 does not satisfy its own required positive control (`year !== 2025`) — verified directly (`/[A-Za-z_$][\w$]*[Yy]ear/.test('year')` is `false`), fixed by making the leading identifier-prefix group optional, then re-verified every control

## Task Commits

Each task was committed atomically:

1. **Task 1: The no-bare-2025 gate — scoped to a real branch shape, with a positive control** - `c1266c1` (test)
2. **Task 2: The prior-year capital-loss document dialect** - `19fec17` (feat)
3. **Task 3: The Capital Loss Carryover Worksheet — 13 lines, pure bigint arithmetic** - `c1f9bd1` (feat)
4. **Task 3 (plan-required addition): the carryover-to-document key link** - `e05ee82` (feat)

## Files Created/Modified

- `year-genericity-gate.test.js` - mechanical scan: no bare hardcoded-year comparison branch under `fjs/`, four negative controls, mutation-checkable positive control
- `fjs/document/prior_year_capital_loss/module.f.js` - `vnd.fjs.prior_year_capital_loss` dialect: four required signed-decimal figures, no stored total
- `fjs/tax/carryover/module.f.js` - `capitalLossCarryoverWorksheet` (13-line worksheet) + `carryoverWorksheetInputsFromDocument` (the dialect-to-worksheet bridge)

## Decisions Made

- **Corrected the plan's own literal regex, verified by direct testing rather than trusted on the page.** 15-02-PLAN.md's Task 1 spells out `/[A-Za-z_$][\w$]*[Yy]ear\s*(?:===|...)\s*\d{4}|.../` and separately requires a positive-control leaf proving the SAME pattern matches `'return year !== 2025 ? undefined : x'`. Direct testing showed it does not: the mandatory leading identifier-prefix character plus the 4-letter `[Yy]ear` suffix requires a minimum 5-character identifier, and the bare 4-letter identifier `year` can never satisfy that. Fixed by making the leading identifier-prefix group optional (`(?:[A-Za-z_$][\w$]*)?[Yy]ear...`), which preserves precision (all four negative controls still correctly fail to match) while now matching both of the plan's own literal positive-control examples. This is exactly the class of "tune the scope against real code rather than asserting a regex and hoping" this plan's own risk section warns about — applied to the plan's OWN suggested pattern, not just the eventual real-tree scan.
- **Added the document-to-worksheet bridge function** (`carryoverWorksheetInputsFromDocument`) that Task 3's `<action>` text does not spell out but the plan's frontmatter `must_haves.key_links` entry requires (`fjs/tax/carryover/module.f.js` -> `fjs/document/prior_year_capital_loss/module.f.js` via `centsFromString`). Without it, the two foundational pieces this plan builds would have no code connecting them at all — only a documentation-level relationship. Proven end-to-end against Worked Example B's own literals, expressed as decimal strings (the dialect's storage shape) rather than bigints, so the SAME worked example is independently re-verified through the actual document-shaped path.
- **All four money fields required, never `option`, in the new dialect** — the absent-document-is-zero case (a first-year filer, or anyone with no prior-year capital loss) is handled entirely by the CALLER never constructing this document; nothing inside the dialect's own schema can express "document exists but this one fact is missing," because the printed worksheet has no instruction for treating one line as blank. This is 15-CONTEXT.md's REVISED Area 3 resolution, applied literally.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected the year-genericity gate's own suggested regex, which failed its own required positive control**
- **Found during:** Task 1
- **Issue:** The plan's literal `yearBranchPattern` text requires a mandatory leading identifier-prefix character before the 4-letter `[Yy]ear` suffix (minimum 5-character match), so the bare 4-letter identifier `year` — used in the plan's own second positive-control example, `'return year !== 2025 ? undefined : x'` — can never match. Verified directly: `/[A-Za-z_$][\w$]*[Yy]ear/.test('year')` is `false`.
- **Fix:** Made the leading identifier-prefix group optional: `(?:[A-Za-z_$][\w$]*)?[Yy]ear\s*(?:===|!==|==|!=|<=|>=|<|>)\s*\d{4}|...`. Re-verified all four negative controls still correctly fail to match, both positive-control examples now match, the real `fjs/` tree still scans clean (zero offenses), and the operator alternation stays mutation-checkable (narrowing to `===` only stops matching the `!==` control).
- **Files modified:** year-genericity-gate.test.js
- **Verification:** Ran the corrected pattern against the real tree (0 offenses) and all six control assertions (4 negative, 2 positive) before writing the final test file; then mutation-verified the real-tree scan test itself by injecting a scratch file with a genuine `taxYear === 2025` branch and confirming it went red, naming the exact file/line, then reverted.
- **Committed in:** c1266c1 (Task 1 commit — the corrected regex was written directly into the initial commit; no separate fix commit needed since the defect was caught before the file was ever written to disk uncorrected)

**2. [Rule 2 - Missing Critical] Added the document-to-worksheet key link the plan's frontmatter requires but Task 3's action text omits**
- **Found during:** Task 3
- **Issue:** The plan's frontmatter `must_haves.key_links` names a required connection from `fjs/tax/carryover/module.f.js` to `fjs/document/prior_year_capital_loss/module.f.js` via `centsFromString`, but Task 3's `<action>` text only specifies the worksheet function over an already-cents `CarryoverWorksheetInputs` — no function bridging the dialect's decimal-string fields to that input shape was described.
- **Fix:** Added `carryoverWorksheetInputsFromDocument: (document: PriorYearCapitalLoss) => CarryoverWorksheetInputs`, using `centsFromString` on each of the four fields (the document is already validated by the time it reaches here, so the throwing form is correct, mirroring `fjs/schedule/d`'s own already-validated-box reads).
- **Files modified:** fjs/tax/carryover/module.f.js
- **Verification:** New proof leaf derives Worked Example B's cents inputs from a document-shaped literal (decimal strings) and re-verifies the same `$6,000.00` short-term carryover result. Mutation-verified: swapping the `priorYearScheduleDLine7`/`priorYearScheduleDLine15` field mapping turns exactly this leaf red; reverted byte-identical (diff empty).
- **Committed in:** e05ee82

---

**Total deviations:** 2 auto-fixed (1 bug fix in a test artifact before it was ever committed uncorrected, 1 missing critical functionality named by the plan's own frontmatter)
**Impact on plan:** Both were necessary for the plan's own stated success criteria (a working positive control; the two foundational pieces actually being connected). No scope creep — neither touches Schedule D wiring, which stays Plan 15-05's job.

## Issues Encountered

None beyond the two deviations above. Both worked-example computations (the document dialect's own fixtures and the worksheet's three IRS worked examples) were independently hand-computed against the plan's `<interfaces>`/`<behavior>` text before any implementation existed, per AGENTS.md's expected-side-independence rule — all three matched on the first attempt, and the edge case (no prior-year loss) matched as well.

**Mutation verification performed (AGENTS.md discipline):**

- Task 1: injected a scratch file (`fjs/_scratch_mutation_probe.js`) containing a real `taxYear === 2025` branch — the real-tree scan test correctly went red, naming the exact file and line; deleted the scratch file, `git status` clean.
- Task 3 (worksheet): RED first — wrote the three worked-example proofs against a stub returning `{0n, 0n}` unconditionally; Worked Examples B and C (both expect non-zero) correctly turned red, Worked Example A and the edge case (both expect all-zero) stayed green (as expected, since they're vacuously satisfied by the stub). Implemented the real 13-line arithmetic; all four turned green.
- Task 3 (worksheet, acceptance-criteria mutation): mutated `line4 = min(line2, line3)` to `line4 = line3`, as the plan's own acceptance criteria specify. Predicted (per the plan text) that only Worked Example B would redden. **The actual result reddened BOTH Worked Example B's `shortTermCarryoverCents` AND Worked Example C's `longTermCarryoverCents`** — a genuine surprise, not a mis-run: in Example C, `line5 = 0` (Schedule D line 7 is a gain, not a loss), so `line11 = max(0, line4 - line5)` reduces to `line4` directly, and the mutation's effect on `line4` propagates straight through to `line12`/`longTermCarryoverCents`. Recorded per AGENTS.md's "a mutation's predicted red set is itself a claim, and it is often wrong" — the surprise reveals a genuine dependency (`line4` feeds BOTH the short-term and long-term branches whenever line5 is zero) that the plan's own prediction did not account for. Reverted; diff against the pre-mutation snapshot was byte-identical.
- Task 3 (document link): swapped the `priorYearScheduleDLine7`/`priorYearScheduleDLine15` field mapping inside `carryoverWorksheetInputsFromDocument` — the new bridge leaf correctly went red; reverted byte-identical.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- TAX-17's two foundational, independently-verifiable pieces are laid: the document dialect and the worksheet function, both proof-tested against independently hand-computed expectations, connected by a proven bridge function. Neither is wired into Schedule D — that remains Plan 15-05's job per this plan's own objective ("prove the carryover computation is correct BEFORE it is wired into Schedule D").
- `requirements-completed` is deliberately empty in this summary's frontmatter: TAX-17 spans multiple plans in this phase (mirroring Phase 12.1's/13's own "requirement not marked complete until the wiring plan lands" precedent) — this plan's own frontmatter also declares `requirements: [TAX-17]` but the requirement is not fully delivered until Plan 15-05 wires the worksheet into Schedule D lines 6/14.
- The year-genericity gate now protects every later wave's carryover-wiring code (Plan 15-05 and beyond) from a hardcoded-year regression, from the moment this plan lands — as intended.
- De-duplicated project-local proof count moved from 847 (end of Plan 15-01) to **868** (21 new leaves: 16 in the document dialect, 5 in the worksheet module — including the document-link proof), confirmed via `node --test 2>&1 | grep '^✔ import("./fjs/' | sed 's/ ([0-9.]*ms)$//' | sort -u | wc -l`.
- `npm test` (the full `tsc && node --test` gate, including the two real-process integration tests) was run at the end of this plan: **6218/6218 passing, 0 failures, 0 cancelled** — `tsc` clean (a `tsc` failure would have stopped the script before `node --test` ran at all).

---
*Phase: 15-realism-polish-and-upstream*
*Completed: 2026-08-11*

## Self-Check: PASSED

All claimed files exist on disk and all four task commits are present in `git log --oneline --all`:

- `year-genericity-gate.test.js` — FOUND
- `fjs/document/prior_year_capital_loss/module.f.js` — FOUND
- `fjs/tax/carryover/module.f.js` — FOUND
- `.planning/phases/15-realism-polish-and-upstream/15-02-SUMMARY.md` — FOUND
- `c1266c1` (Task 1) — FOUND
- `19fec17` (Task 2) — FOUND
- `c1f9bd1` (Task 3) — FOUND
- `e05ee82` (Task 3 addition) — FOUND

`npm test`: 6218/6218 passing, 0 failures. De-duplicated project-local proof count: 868 (up from 847 at end of Plan 15-01, +21 matching this plan's own new leaves).
