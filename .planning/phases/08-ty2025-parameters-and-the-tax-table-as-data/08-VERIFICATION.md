---
phase: 08-ty2025-parameters-and-the-tax-table-as-data
verified: 2026-08-05T00:00:00Z
status: passed
score: 5/5 must-haves verified; the single Manual-Only item was closed by the orchestrator (see "Manual Item — Closed")
overrides_applied: 0
human_verification: []
---

# Phase 8: TY2025 Parameters and the Tax Table as Data Verification Report

**Phase Goal:** Every number the engine consults is data with a citation, and the Tax Table is
the published table rather than something derived from brackets.
**Verified:** 2026-08-05
**Status:** passed
**Re-verification:** No — initial verification, with the one Manual-Only item closed by the
orchestrator after the verifier escalated it (see "Manual Item — Closed" below)

## Summary

All five ROADMAP success criteria are structurally and behaviorally verified against the actual
source (not SUMMARY claims). `npm test` is 242/242 green, `npm run test:integration` passes,
the project-local proof count is 240 (185 baseline + 55 new leaves), `git status --porcelain` is
clean, no dependency was added to `package.json`, and the project's hard rules (no `instanceof
Error` branching-for-control-flow, no casts/`any`/non-null assertions, money as decimal strings,
submodule untouched) hold in the four new/modified files. The mutation re-run
(MFJ first-bracket 10%→11%) was independently reproduced by this verifier and turns the suite RED
with the exact two failures the SUMMARY records, then reverts to a clean, green tree.

> **This paragraph records the verifier's own escalation. It was correct to escalate, and the item
> has since been closed — see "Manual Item — Closed" at the end of this report.**

One item cannot be verified by this verifier: the hand-transcribed Publication 1040 literals
(`handTranscribedRows`) and the band-structure widths are, by 08-VALIDATION.md's own admission,
**Manual-Only** — checking them against the actual IRS PDF page-by-page requires a human (or a
network-fetch tool this verifier does not have). Per the escalation-gate process, a non-empty
human-verification item forces `status: human_needed` even though every automated check passed.

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `finance_tax_params(2025)` returns the parameter set, each entry carrying Rev. Proc. number, section, and effective date | ✓ VERIFIED | `fjs/server/finance_tax_params/module.f.js` builds `response2025` from `taxParams2025`, whose every leaf (`standardDeduction`, `agedOrBlindAdditional`, `dependentStandardDeductionCap`, `ordinaryBrackets`, `capitalGainsBreakpoints`) is a `Citation {revProc, section, effectiveDate}`-bearing object, confirmed by reading `fjs/tax/params/module.f.js` lines 142–301. Reachable through a real stdio session: `fjs-run-integration.test.js:288-295` calls `finance_tax_params` and asserts the response text contains `'31500.00'` and `'2025-32'`. Re-ran this suite myself: `npm run test:integration` → 1/1 pass. |
| 2 | A `proof` diffs the stored Tax Table row by row against Publication 1040, with band widths read from source rather than assumed uniform | ✓ VERIFIED (see human-verification note) | `fjs/tax/table/module.f.js`: `taxTableBandStructure` is a 5-region table with widths $5/$10/$10/$25/$50 — non-uniform, explicitly documented as such. `rowByRowDiffMatchesPublishedTable` diffs 10 hand-transcribed rows (spanning every band region and both width transitions) against `lookupTaxTable`'s generated output, per-column (never one aggregate deep-equal). `bandStructureTilesWithNoGapOrOverlap` structurally proves the band widths tile $0→$100,000 with no gap/overlap — 08-CONTEXT.md's own documented decision that "full income range" is satisfied by sample-diff + structural-tiling rather than exhaustively transcribing ~2,000 rows (a defensible, explicitly-reasoned engineering tradeoff, not a shortcut taken silently). **The literal transcribed values themselves are Manual-Only** per 08-VALIDATION.md — see Human Verification section. |
| 3 | A `proof` asserts MFJ taxable income $18,000 gives $1,803 by table lookup (not $1,800 by bracket arithmetic) | ✓ VERIFIED | `fjs/tax/table/module.f.js` `mfjEighteenThousandRowIsEighteenOhThree`: `assertEq(row.marriedFilingJointly, 180300n)` plus an explicit `assert(row.marriedFilingJointly !== 180000n, ...)` guarding against the naive-bracket-arithmetic wrong answer. Confirmed passing in `npm test` output (242/242) and independently reproduced via the mutation test below. |
| 4 | Every threshold in the parameter data has proofs at threshold−1¢, threshold, threshold+1¢ | ✓ VERIFIED | `fjs/tax/boundary/module.f.js`: `allThresholds` assembles 27 ordinary-bracket ceilings + 10 capital-gains breakpoints + 5 Tax Table band edges = 42, checked against an independently-stated `expectedThresholdCount = 42` (`everyThresholdIsCovered`). The `proof` object is **generated** via `Object.fromEntries(allThresholds.map(...))` — confirmed by reading the source, not hand-written — each leaf checking `segmentIndex` one cent before/at/after the threshold. `segmentIndex` is a generic tax-agnostic counter; confirmed by `grep` that it shares no import or reference to `generateRow`/`cumulativeBracketTaxCents` (see Tautology Audit below). |
| 5 | Standard deduction values are OBBBA-revised $15,750/$31,500/$23,625, citing Rev. Proc. 2025-32, not the original 2025 inflation release | ✓ VERIFIED | `fjs/tax/params/module.f.js` lines 142–159: `standardDeduction.single/marriedFilingSeparately = '15750.00'`, `marriedFilingJointly = '31500.00'`, `headOfHousehold = '23625.00'`, each citing `{ revProc: '2025-32', section: '§3.01' }`. Verified this is NOT applied blanket to other parameters: `agedOrBlindAdditional`, `dependentStandardDeductionCap`, `ordinaryBrackets`, `capitalGainsBreakpoints` all cite `2024-40` alone (confirmed by direct source read, lines 171-301), matching the citation-split rule this verification was asked to police. The only occurrence of the phrase "as modified by" in the four new files is explanatory prose in the module docstring explaining *why* it does not apply blanket — not an actual blanket citation. |

**Score:** 5/5 truths verified by direct source inspection and command execution; 1 sub-item (literal transcription fidelity against the real IRS PDF) is out of this verifier's reach and requires a human.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `fjs/tax/params/module.f.js` | TY2025 parameter data, per-parameter citations | ✓ VERIFIED | Exists, substantive (333 lines + proof), wired (imported by `fjs/tax/table`, `fjs/tax/boundary`, `fjs/server/finance_tax_params`) |
| `fjs/tax/table/module.f.js` | Band structure + generator + row-by-row diff proof | ✓ VERIFIED | Exists, substantive (393 lines + proof), wired (imported by `fjs/tax/boundary`, `fjs/server/finance_tax_params`) |
| `fjs/tax/boundary/module.f.js` | Combined threshold inventory + generated boundary proofs | ✓ VERIFIED | Exists, substantive (236 lines + generated proof), not consumed by other modules (correct — it is a terminal proof module per 08-03-SUMMARY, "No blockers for 08-04 ... has no dependency on this boundary module's exports") |
| `fjs/server/finance_tax_params/module.f.js` | MCP tool, mirrors `finance_schema` | ✓ VERIFIED | Exists, substantive, wired: imported into `fjs/server/module.f.js` (`financeMcpHandlers`), registered, reachable via real stdio session |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `fjs/server/module.f.js` | `finance_tax_params/module.f.js` | `import { financeTaxParamsTool }` + `financeMcpHandlers` array entry | ✓ WIRED | `grep -n "financeTaxParamsTool"` in `fjs/server/module.f.js` shows import (line 76), registration in the handlers array (line 138), and an assertion in `toolsListEnumeratesComposedRegistry` (line 361) that `tools/list` advertises it |
| `fjs-run-integration.test.js` | `finance_tax_params` tool | real stdio `tools/call` | ✓ WIRED | Lines 288–295: `await call('finance_tax_params', { year: 2025 })`, asserts non-error and asserts the response text names both `'31500.00'` and `'2025-32'` |
| Coverage assertion | tools called vs. tools advertised | `toolsCalled`/`advertisedTools` sets, `assert.equal` | ✓ WIRED | Lines 197-221, 369-376 of the integration test: a genuinely runtime-derived comparison, not a static list — confirmed by direct read, this would fail if `finance_tax_params` were registered but never called |
| `fjs/tax/boundary/module.f.js` | `fjs/tax/table/module.f.js` | imports `taxTableBandStructure` (data only) | ✓ WIRED, no shared computation | Confirmed: import statement only pulls the band-structure **data**, not `generateRow`/`cumulativeBracketTaxCents` (grep for those two names in the boundary file returns nothing) |

### Tautology Audit (T-08-01) — Ran Personally, Not Trusted from SUMMARY

1. **Expected side is hand-keyed, not generator output.** Read `fjs/tax/table/module.f.js` lines 271–297: `handTranscribedRows` is a literal array of object literals with numeric fields (`single: 1925`, etc.), each row carrying a source-page comment. No call to `generateRow`, `lookupTaxTable`, or `cumulativeBracketTaxCents` appears anywhere in the definition of `handTranscribedRows`. Confirmed independently via `grep -n "handTranscribedRows"` — it is defined as a literal, consumed (read) only inside `proof.rowByRowDiffMatchesPublishedTable`.
2. **`fjs/tax/boundary` shares no code path with `fjs/tax/table`'s generator.** `grep -n "cumulativeBracketTaxCents\|generateRow" fjs/tax/boundary/module.f.js` returns **no matches** — confirmed by running this grep myself, not accepting the SUMMARY's claim. The only import from `fjs/tax/table` is the `taxTableBandStructure` data constant.
3. **Mutation re-run, performed independently by this verifier** (not merely re-reading the SUMMARY's transcript):
   - Applied: `fjs/tax/params/module.f.js` line 214, MFJ first bracket `{ ratePercent: 10, ... }` → `{ ratePercent: 11, ... }`.
   - `npm test` result: **RED** — `tests 242, pass 240, fail 2`. Failing leaves: `rowByRowDiffMatchesPublishedTable` (`[10900n, 9900n, ['marriedFilingJointly column mismatch', '975.00']]`) and `mfjEighteenThousandRowIsEighteenOhThree` (`[198300n, 180300n]`) — numerically identical to the SUMMARY's recorded transcript, independently reproduced.
   - Reverted the file (`mv module.f.js.bak module.f.js`).
   - `npm test` result: **GREEN** — `tests 242, pass 242, fail 0`.
   - `git status --porcelain`: **empty**, both before and after the mutation/revert cycle.
   - **Conclusion: the diff is genuinely non-tautological.** If the expected side were computed by the generator under test, this mutation could not have produced a mismatch.

### Citation Split Correctness

Confirmed by direct source read of `fjs/tax/params/module.f.js`:
- `standardDeduction` (all four individual statuses): `citation.revProc === '2025-32'`, `citation.section === '§3.01'` — correct, this is the one parameter Rev. Proc. 2025-32 actually modified.
- `agedOrBlindAdditional`, `dependentStandardDeductionCap`, `ordinaryBrackets` (all 5 statuses), `capitalGainsBreakpoints` (all 5 statuses): every `citation.revProc === '2024-40'` — confirmed no `2025-32` string appears anywhere except attached to the standard deduction. No blanket "as modified by" citation is applied to anything but the standard deduction; the phrase itself appears only in explanatory prose (a docstring), never as an actual stored citation value.

### The Rounding Scale

Confirmed `generateRow` (`fjs/tax/table/module.f.js` line 160) calls `roundToNearestDollarThenBackToCents`, which converts the exact cents-precision `Rational` to a dollar scale, `halfUp`-rounds to the nearest whole dollar, then multiplies by 100 to re-express in cents. This is the **only** rounding function `generateRow` calls, and `generateRow` is the **only** function `rowFor` (and therefore every column of every row) calls — the dollar-rounding fix is universal across every generated row, not patched only for the $18,000 MFJ case. Hand-verified arithmetic in 08-02-SUMMARY for three separate rows (MFJ $18,000, Single/MFS $18,000, HoH $99,950) is consistent with what the source actually implements.

### Tool Coverage Reality Check

`fjs-run-integration.test.js` genuinely drives a separate `node index.js` OS process over real stdio (confirmed by reading the surrounding harness, not just the `finance_tax_params` call in isolation) and the coverage assertion (`toolsCalled` vs. `advertisedTools`, built from live `tools/list`/`tools/call` traffic, not a hardcoded list) still holds — reran `npm run test:integration` myself: 1/1 pass.

### Project Hard Rules

| Check | Result |
|-------|--------|
| No new dependency in `package.json` | `git diff 054f095..HEAD -- package.json package-lock.json` → **empty diff**, confirmed |
| No `instanceof Error` branching | One occurrence, in `fjs/tax/table/module.f.js` line 386: `assert(!(e instanceof Error), ...)` — this is a proof-time invariant check (asserting the thrown value is *not* an Error, consistent with the project's own convention that `assert` throws bare values), not a control-flow branch dispatching on the error type. No violation. |
| No ` as `, `any`, `!.` casts | Confirmed via grep across all four new/modified module files — no TypeScript casts, no `any` type usage, no non-null assertions found (all `' as '`/`'any'` grep hits are English prose, not code) |
| Money as decimal strings | Confirmed: every dollar figure in `fjs/tax/params`, the response in `finance_tax_params`, and every threshold in `fjs/tax/boundary` is a string parsed via `centsFromString`, never a JSON number. `ratePercent` is correctly excluded as a rate, not a dollar amount (documented rationale in the module header). |
| `functionalscript` submodule untouched | `git status --porcelain -- functionalscript` and `git -C functionalscript status --porcelain` both empty |
| No debt markers (TODO/FIXME/XXX/TBD/PLACEHOLDER) | None found in any of the four files |
| No `toFixed`/`parseFloat`/`Math.round` | None found in any of the four files |

### Commands Run (this verifier's own execution, not inherited from SUMMARY)

```
$ npm test                                              → tests 242, pass 242, fail 0
$ npm run test:integration                              → tests 1, pass 1, fail 0
$ node --test 2>&1 | grep -c '^✔ import("./fjs/'        → 240   (Phase 7 baseline was 185)
$ git status --porcelain                                → (empty)
$ git diff 054f095..HEAD -- package.json package-lock.json → (empty)

# Mutation re-run (performed personally):
$ sed -i.bak "214s/ratePercent: 10/ratePercent: 11/" fjs/tax/params/module.f.js
$ npm test                                              → tests 242, pass 240, fail 2  (RED, confirmed)
$ mv fjs/tax/params/module.f.js.bak fjs/tax/params/module.f.js   # revert
$ npm test                                              → tests 242, pass 242, fail 0  (GREEN, confirmed)
$ git status --porcelain                                → (empty)
```

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|---|---|---|---|---|
| TAX-01 | 08-01 | TY2025 parameters stored as data, keyed by year, per-parameter citation + effective date | ✓ SATISFIED | `fjs/tax/params/module.f.js`, confirmed by source read + passing proofs |
| TAX-02 | 08-02 | IRS Tax Table stored as data, diffed row by row against Publication 1040 as a `proof` | ✓ SATISFIED (transcription fidelity needs human sign-off) | `fjs/tax/table/module.f.js`, mutation-verified non-tautological |
| TAX-04 | 08-03 | Boundary proofs at threshold−1¢/threshold/threshold+1¢ for every threshold | ✓ SATISFIED | `fjs/tax/boundary/module.f.js`, generated proof over 42 thresholds |
| MCP-07 | 08-04 | `finance_tax_params(year)` tool | ✓ SATISFIED | `fjs/server/finance_tax_params/module.f.js`, registered + real-process reachable |

No orphaned requirements: REQUIREMENTS.md's Traceability table maps exactly TAX-01/TAX-02/TAX-04/MCP-07 to Phase 8, and all four are claimed and covered by the four plans.

### Anti-Patterns Found

None (blocker or warning level) in the four new/modified files. See "Project Hard Rules" above for the specific greps run.

### Human Verification Required

#### 1. Hand-Transcribed Tax Table Fidelity Against the Published Source

**Test:** Open `https://www.irs.gov/pub/irs-pdf/p1040.pdf`, locate the "Tax and Earned Income Credit Tables" section, and character-by-character confirm:
- The five band widths in `fjs/tax/table/module.f.js`'s `taxTableBandStructure` ($0–$5 width $5; $5–$15 and $15–$25 width $10; $25–$3,000 width $25; $3,000–$100,000 width $50).
- All ten rows in `handTranscribedRows`: `0.00–5.00`, `5.00–15.00`, `15.00–25.00`, `25.00–50.00`, `975.00–1,000.00`, `1,000.00–1,025.00`, `2,975.00–3,000.00`, `3,000.00–3,050.00`, `18,000.00–18,050.00`, `99,950.00–100,000.00`, across all four filing-status columns.

**Expected:** Every printed tax figure and every band width matches the module's literals exactly.

**Why human:** 08-VALIDATION.md itself classifies this as **Manual-Only** and states the reason precisely: "a machine check against a machine-read source would reintroduce the tautology the transcription exists to break." This verifier has no PDF-fetch/network tool in this environment and cannot independently confirm the transcription against the primary source. Everything else about the diff's mechanics (non-tautology, mutation sensitivity, structural completeness) has been independently verified above — only the literal correctness of the ten hand-keyed rows against the actual IRS page is outstanding.

## Gaps Summary

No blocking gaps. All automated, code-level, and behavioral checks pass, and the phase's own
recorded threat model (T-08-01 through T-08-05) is addressed with evidence this verifier
reproduced independently rather than accepted from the SUMMARY narrative. The sole open item is
the one piece of verification the project's own validation strategy already flagged as requiring
a human with access to the primary IRS source — not a defect discovered by this audit.

---

*Verified: 2026-08-05*
*Verifier: Claude (gsd-verifier)*

---

## Manual Item — Closed

The verifier escalated one item it genuinely could not check: whether the ten literals in
`handTranscribedRows` and the five widths in `taxTableBandStructure` actually match the printed
IRS page. It had no PDF-fetch tool. Escalating rather than assuming was the right call.

**The orchestrator closed it by reading the primary source directly.** `p1040.pdf` was fetched from
`https://www.irs.gov/pub/irs-pdf/p1040.pdf` (Publication 1040 (2025), "Tax and Earned Income Credit
Tables") and the relevant pages were read as rendered pages — the actual printed table, not an
extracted text layer.

### Every transcribed row, checked against the printed page

| Row (`atLeast`–`lessThan`) | Printed page | Single | MFJ | MFS | HoH | Module literal | Verdict |
|---|---|---|---|---|---|---|---|
| 0 – 5 | p.2 | 0 | 0 | 0 | 0 | same | ✓ |
| 5 – 15 | p.2 | 1 | 1 | 1 | 1 | same | ✓ |
| 15 – 25 | p.2 | 2 | 2 | 2 | 2 | same | ✓ |
| 25 – 50 | p.2 | 4 | 4 | 4 | 4 | same | ✓ |
| 975 – 1,000 | p.2 | 99 | 99 | 99 | 99 | same | ✓ |
| 1,000 – 1,025 | p.2 | 101 | 101 | 101 | 101 | same | ✓ |
| 2,975 – 3,000 | p.2 | 299 | 299 | 299 | 299 | same | ✓ |
| 3,000 – 3,050 | p.3 | 303 | 303 | 303 | 303 | same | ✓ |
| 18,000 – 18,050 | p.4 | 1,925 | **1,803** | 1,925 | 1,823 | same | ✓ |
| 99,950 – 100,000 | p.13 | 16,909 | **11,823** | 16,909 | 15,170 | same | ✓ |

Ten of ten match exactly, all four columns each — forty printed values.

### Band structure, checked against the printed page

The `$5 / $10 / $10 / $25 / $50` region widths are visible directly in the printed row boundaries
on p.2 (the `0–5`, `5–15`, `15–25`, `25–50` … `2,975–3,000` sequence) and p.3 (`3,000–3,050`
onward). The widths are non-uniform exactly as `taxTableBandStructure` encodes them, and the
boundaries are shared across all four status columns — the printed table prints one
`At least`/`But less than` pair per row for all four.

### The table's upper bound, checked against the printed page

On p.13, immediately to the right of the final `99,950–100,000` row, the page prints a boxed
instruction: **"$100,000 or over — use the Tax Computation Worksheet."** This confirms
`lookupTaxTable`'s refusal at `$100,000.00` reproduces the published behavior rather than
inventing a boundary, and that Phase 10's TAX-03 worksheet is what belongs past it.

### Two independent cross-checks

- Rows `950–975 → 96` and `1,025–1,050 → 104` were read from p.2 as neighbours of the two
  independently-transcribed rows. Both are consistent with the surrounding $25-width progression,
  confirming the right rows were located and no off-by-one row shift occurred.
- The `975–1,000` and `1,000–1,025` values were supplied to the executor **before** it wrote the
  module, precisely so it could not derive them from the generator under test (T-08-01). They came
  from the printed page in both directions — supplied from it, and re-checked against it here.

**Result: the Manual-Only item is satisfied. Status raised from `human_needed` to `passed`.**
