---
phase: 13
slug: the-65-profile-and-the-remaining-schedules
verified: 2026-08-11T00:00:00Z
status: human_needed
score: 5/5 must-haves verified (code-level); 1 manual-only item outstanding
overrides_applied: 0
must_haves:
  truths:
    - "Schedule 1-A Parts I/V/VI compute the senior deduction with the 6% continuous phase-out over $75k/$150k, feeding 1040 line 13b"
    - "The 18-line Social Security Benefits Worksheet matches the printed worksheet on a case that exercises its near-circular dependency (85% tier + tax-exempt-interest add-back)"
    - "Schedule A computes and is compared against the standard deduction, with proofs in both directions, including a case above $15,750/$31,500 where itemizing still loses"
    - "Schedule 8812 computes for the declared dependents (both halves), and Schedules 1/2/3 carry every line the declared profile actually reaches"
    - "grep -rn \"magi\" fjs/ returns nothing, mechanically gated case-insensitively, with four independently-named income functions"
human_verification:
  - test: "Spot-check each new TY2025 parameter (senior deduction $6,000/6%/$75k-$150k; SSB base amounts $25k/$32k/$9k/$12k; SALT cap $40,000/30%/$500k-$250k/$10,000 floor; CTC $2,200/ODC $500/ACTC cap $1,700/phase-out $400k-$200k at 5% per $1,000; medical floor 7.5%) against the cited 2025 IRS PDF page"
    expected: "Each figure and its line label match the printed page cited in 13-RESEARCH.md's [VERIFIED: ...] annotations"
    why_human: "No local copy of the cited IRS PDFs (f1040s1a.pdf, i1040gi.pdf, f1040sa.pdf, f1040s8.pdf, rp-25-32.pdf) exists in this repository or was reachable to this verifier. A green suite proves the engine agrees with the constants it was given, never that a constant was transcribed correctly from the source PDF -- this is 13-VALIDATION.md's own named 'Manual-Only Verification' row, and it is the fooled-but-passing failure mode for the whole phase."
---

# Phase 13: The 65+ Profile and the Remaining Schedules — Verification Report

**Phase Goal:** The declared taxpayer profile is structurally complete — a 65+ TY2025 return with
dependents that itemizes is no longer missing anything it is required to have.

**Verified:** 2026-08-11
**Status:** human_needed
**Re-verification:** No — initial verification

**Note on ROADMAP `mode: mvp`.** Phase 13's ROADMAP goal text is not written as an "As a ...,
I want ..., so that ..." user story — it is a structural-completeness goal with five explicit,
independently-testable success criteria supplied directly in this verification's task brief.
Per this task's own `<phase_goal>`/`<what_to_scrutinize>` instructions, verification proceeded
against those five success criteria directly (goal-backward, code-first) rather than blocking on
user-story format. This is recorded here for transparency, not treated as a gap.

## Goal Achievement

### Observable Truths (5 ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Schedule 1-A Parts I/V/VI compute the senior deduction, continuous 6% phase-out over $75k/$150k, feeding 1040 line 13b | ✓ VERIFIED | `fjs/schedule/1a/module.f.js` (541 lines): `scheduleOneAPartV` implements the MFS short-circuit BEFORE arithmetic (line 202-203), continuous cent-exact 6% phase-out (`percentOfCents`), floor-at-zero. Boundary proofs at `$75,000.00`/`$150,000.00` exact/±1¢ and at the zero point `$175,000.00`/`$250,000.00` exact/±1¢ (`phaseoutStartBoundaryTrioSingle`, `phaseoutStartBoundaryTrioMfj`, `phaseoutFloorOneCentBelow/AboveTheZeroPointStillRoundsToZero`). MFS control pair (`mfsAtZero...NotDecisiveAlone` + `mfsAtTenThousand...DecisiveShortCircuitProof`) proves the short-circuit is a real gate, not incidental. Wired into 1040 line 13b in `fjs/form1040/core/module.f.js` (`scheduleOneAResult.partVI.line38` at line 823), with an end-to-end proof (`sixtyFivePlusSingleFilerComputesRealLine13bFromScheduleOneA`, line ~3393) plus a hand-computed real-number cross-check (`standardStillWinsAboveTheBaseThresholdTheLoadBearingCase`-adjacent fixtures, line ~3747). |
| 2 | 18-line SSB worksheet matches the printed worksheet on a case exercising the near-circular dependency | ✓ VERIFIED | `fjs/tax/ssb/module.f.js` (523 lines): all 18 printed lines present as named bindings in printed order with printed-instruction comments; `expectedWorksheetLineCount = 18` is an independently hand-typed count-guard, cross-checked against `Object.keys(result).filter(...)` (`exactlyEighteenNamedLineFields`, line 304). Criterion-2 case (`withInterestResult`, line ~331): single 65+ filer, 85% tier (`line11 > 0`), WITH tax-exempt-interest add-back vs. a control WITHOUT it — `line18` differs by exactly $3,200.00, proven non-equal. Wired into 1040 lines 6a/6b (`fjs/form1040/core/module.f.js` lines 614-658), with an independent cross-check call to `socialSecurityBenefitsWorksheet(...)` matching the wired value (lines 3648-3677, 4250-4260). |
| 3 | Schedule A computes and is compared against the standard deduction, both directions, itemizing does not automatically win above $15,750/$31,500 | ✓ VERIFIED | `fjs/tax/deduction/module.f.js`: `deductionChoice` (line 317) returns `{chosen, standard, itemized}`, strict `>` comparison (no tie-goes-to-itemized), election override. The load-bearing case `singleTwoBoxesStandardWinsAboveTheBaseThreshold` (line ~505): itemized $18,000 > base $15,750 but standard wins because the filer's real standard deduction is $19,750 (two age/blindness boxes) — the exact scenario the scrutiny brief called out as "the one that can fail." Reproduced end-to-end at the full 1040 level in `fjs/form1040/core/module.f.js`'s `standardStillWinsAboveTheBaseThresholdTheLoadBearingCase` (line 3890): `line12e.value === 1975000n` (not the $18,000 itemized figure, not the bare $15,750 base), and line12e still cites the itemized document even though it lost (Decision 2.4's "what was compared, not only what won"). SALT MFS mechanic (Research Pitfall 2) verified: `w1`/`w9` flat, only `w10` halves (`mfsHalvesOnlyTheFinalLine`, `fjs/schedule/a/module.f.js` line 631). Neither TY2026 OBBBA change (0.5% charitable floor, 2/37ths haircut) implemented (Decision 5.8, negative proof present). Withholding-drift proof (Decision 2.2) present and gated on the income-tax election. |
| 4 | Schedule 8812 computes for declared dependents; Schedules 1/2/3 carry every line the profile reaches | ✓ VERIFIED (with a stated, reasoned scope note) | `fjs/form8812/module.f.js` (608 lines): Part I (line 19) and Part II-A (line 28, ACTC) computed from one function execution (Decision 4.3). Phase-out is genuinely STEPPED (5% of excess rounded UP to next $1,000, a true $50 cliff at $400k MFJ/$200k other) — contrast-tested against Schedule 1-A's continuous curve, with `−1¢/exact/+1¢` boundary proofs (`steppedCliff.mfjOneCentOverThresholdCostsTheFullFiftyDollarStep`, `otherStatusThresholdBoundaryTrio`). `dependents` array wired with a length-equals-`dependentCount` cross-field proof (`fjs/return/profile`). Both halves wired to 1040 lines 19/28 with a real, non-zero end-to-end proof (`dependentsBeforeTheScopeReclassificationLands`, `wave5FullProfile`). Schedules 1/2/3 exist as standalone, printed-line-complete modules and are wired to 1040 lines 8/10/17/20/23/31. **Scope note**: 5 coarse kinds (`scheduleOneAdditionalIncome`, `scheduleOneAdjustments`, `scheduleTwoTaxes`, `scheduleThreeNonrefundableCredits`, `scheduleThreeRefundableCredits`) remain in `unmodeledKindRefusals` rather than `modeledKinds` (final split 20/30, not the 25/25 a literal CONTEXT.md table reading would suggest). This is verified as the CORRECT choice, not a shortfall: each covers many distinct unattributable line items with no per-line dialect, so reclassifying them would produce a confident `$0` standing in for an honest refusal — exactly TAX-16's forbidden failure mode. For the phase's own declared profile (65+, dependents, itemizing), none of these five kinds is reached, so criterion 4 ("every line the profile actually reaches") is satisfied for the actual declared profile; a taxpayer who DOES declare one of the five still gets a loud, correctly-labeled refusal rather than a silent zero. |
| 5 | `grep -rn "magi" fjs/` returns nothing; each rule's MAGI is a separately named function with its own add-back list | ✓ VERIFIED | Literal command confirmed empty (exit 1, no matches). Four separately-named, independently-defined income functions confirmed by direct source read: `seniorDeductionPhaseoutIncome` (`fjs/schedule/1a`), `saltCapPhasedownIncome` (`fjs/schedule/a`), `socialSecurityCombinedIncome` (`fjs/tax/ssb`), `childTaxCreditPhaseoutIncome` (`fjs/form8812`) — each with its own docstring stating its own add-back list, each explicitly NOT importing/calling the others despite all four (three of them) currently equaling bare AGI. Mechanical gate (`magi-gate.test.js`, root-level `*.test.js` per AGENTS.md's discovery convention) is CASE-INSENSITIVE on the `M`/`m` + literal lowercase `agi` pattern (`/[a-zA-Z]*[Mm]agi[a-zA-Z]*/`), strictly stronger than the literal criterion text, with a positive control proving uppercase `MAGI` prose still passes. Both leaves ran and passed inside `npm test`'s 3070-test run (`✔ MAGI gate: ...`, `✔ MAGI gate positive control: ...`). Carried finding C-1 (camelCase `Magi` hole) is genuinely closed: `grep -rno "[a-zA-Z]*[Mm]agi[a-zA-Z]*" fjs/` returns zero matches. |

**Score:** 5/5 success criteria verified at the code level.

### Carried Findings (13-VALIDATION.md)

| Finding | Status | Evidence |
|---|---|---|
| C-1 — case-sensitive gate misses camelCase `Magi` | ✓ RESOLVED | `magi-gate.test.js` built with the case-insensitive pattern; six identifiers renamed (`9a7d061 refactor(13-13): rename camelCase Magi proof-fixture identifiers`); `grep -rno "[a-zA-Z]*[Mm]agi[a-zA-Z]*" fjs/` returns nothing. |
| C-2 — TAX-10 marked complete while text says "19-line" | ✓ RESOLVED | `REQUIREMENTS.md` TAX-10 and `ROADMAP.md` criterion 2 both now read "18-line" / "18-line Social Security Benefits Worksheet." No stray "19-line" text remains anywhere in either file. Code implements exactly 18 lines with the count-guard proof. |
| C-3 — `$1,700` ACTC cap citation names `§24(h)` which doesn't literally contain it | ✓ RESOLVED (via documented-precision route, option b) | `fjs/tax/params/module.f.js`'s `childTaxCredit` docstring explicitly records the C-3 resolution: `§24(h)` is retained as the honest governing-provision citation, with a docstring paragraph stating the dollar figures are read directly off the printed form (`[VERIFIED: f1040s8.pdf p2 line16b]`) rather than found literally in the cited code section. Not a computed-number defect; a citation-precision note, resolved as designed. |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `fjs/schedule/1a/module.f.js` | Schedule 1-A Parts I/V/VI | ✓ VERIFIED | 541 lines, exported, wired, proofs green |
| `fjs/tax/ssb/module.f.js` | 18-line SSB worksheet | ✓ VERIFIED | 523 lines, exported, wired, proofs green |
| `fjs/schedule/a/module.f.js` | Schedule A, all 18 lines + SALT worksheet | ✓ VERIFIED | 940 lines, exported, wired, proofs green |
| `fjs/tax/deduction/module.f.js` (deductionChoice) | Standard-vs-itemized comparison | ✓ VERIFIED | `deductionChoice` at line 317, both-direction proofs |
| `fjs/form8812/module.f.js` | Schedule 8812 Parts I/II-A | ✓ VERIFIED | 608 lines, both halves, stepped phase-out |
| `fjs/schedule/1/module.f.js`, `fjs/schedule/2/module.f.js`, `fjs/schedule/3/module.f.js` | Schedules 1/2/3, every printed line | ✓ VERIFIED | 310/266/291 lines, documented zeros cite profile, wired |
| `fjs/document/itemized_deductions/module.f.js` | `vnd.fjs.itemized_deductions` dialect | ✓ VERIFIED | 234 lines, follows medical_expenses precedent, no formRevision/stored total |
| `fjs/return/profile/module.f.js` | `dependents` array + `iraDeductionDeclared` + line-18 election | ✓ VERIFIED | Cross-field validation present (`checkReferences`) |
| `fjs/return/scope/module.f.js` | 20/30 partition, corrected remedy strings | ✓ VERIFIED | `modeledKinds.length === 20`, `unmodeledKindRefusals.length === 30` (confirmed by direct import), no stale "Phase 13" remedy text |
| `fjs/tax/params/module.f.js` | Citation union widened, OBBBA + Rev Proc 2024-40 parameters | ✓ VERIFIED | 1198 lines, `Citation` discriminated union (`revProc`/`publicLaw`/`code`), sibling proofs for each provenance |
| `fjs/tax/boundary/module.f.js` | TAX-04 boundary registries for the two new phase-outs | ✓ VERIFIED | `seniorDeductionThresholds`, `saltCapThresholds`, `childTaxCreditThresholds` all present |
| `fjs/form1040/core/module.f.js` | Lines 4a/4b,5a/5b,6a/6b,8,10,12e,13b,17,19,20,23,25b,28,31 wired | ✓ VERIFIED | 4366 lines, all named lines confirmed reading real computed values, not `declaredZero` |
| `magi-gate.test.js` | Mechanical criterion-5 gate | ✓ VERIFIED | Root-level, discovered by `node --test`'s default convention, both leaves passed |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `scheduleOneA(...)` | 1040 line 13b | `scheduleOneAResult.partVI.line38` | ✓ WIRED | Real cross-check + end-to-end proof |
| `socialSecurityBenefitsWorksheet(...)` | 1040 lines 6a/6b | `ssbResult.line18` | ✓ WIRED | Real cross-check + end-to-end proof |
| `deductionChoice(...)` / `scheduleA(...)` | 1040 line 12e | `deductionChoiceResult.{standard,itemized}` per `chosen` | ✓ WIRED | Both-direction end-to-end proof, both figures cited in sources |
| `form8812(...)` | 1040 lines 19/28 | `form8812Outcome.{line14,line27}` | ✓ WIRED | Real, non-zero end-to-end proof |
| `scheduleOne/Two/Three(...)` | 1040 lines 8/10/17/20/23/31 | direct totals | ✓ WIRED | All six lines confirmed reading schedule totals |
| `vnd.fjs.1099r` | 1040 lines 4a/4b/5a/5b | `fromDocuments` | ✓ WIRED | Confirmed via `iraDistributions`/`pensionsAndAnnuities` in `modeledKinds` and end-to-end proofs |
| `vnd.fjs.1099r`/`1099div`/`1099b` | 1040 line 25b | `federalTaxWithheldOnOther1099` | ✓ WIRED | `line25b.sources.length === 4` proof across all four document types |
| kind reclassification | scope guard | `modeledKinds` array membership | ✓ WIRED — WIRE-BEFORE-RECLASSIFY CONFIRMED | Git history shows, per slice: a "wire, kind still refused" commit strictly precedes its "reclassify" commit (e.g. `65ef9f1` wire → `89d0fbd` reclassify; `cca1c1d` wire → `9ec4a4e` reclassify; `6becc96` wire → `f0b3b06` reclassify) |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| 1040 line 13b | `scheduleOneAResult.partVI.line38` | Real AGI (post-slice-1) fed to `scheduleOneA(...)` | Yes — nonzero hand-computed figures in end-to-end proofs ($4,500.00, $5,700.00, $12,000.00 fixtures) | ✓ FLOWING |
| 1040 line 6b | `ssbResult.line18` | Real box-5 SSA-1099 totals + other income lines | Yes — $25,325.00/$25,500.00/$2,550,000-cent fixtures, cross-checked independently | ✓ FLOWING |
| 1040 line 12e | `deductionChoiceResult.{standard,itemized}` | Real stored `vnd.fjs.itemized_deductions` entries + AGI | Yes — both directions produce distinct nonzero totals ($19,750.00 standard-wins case, $20,000.00+ itemized-wins case) | ✓ FLOWING |
| 1040 lines 19/28 | `form8812Outcome.{line14,line27}` | Real declared `dependents` array | Yes — $4,400.00 (two qualifying children × $2,200) nonzero fixture | ✓ FLOWING |

### Proof-Fixture Coverage Continuity (Scrutiny Point 5)

Both re-pointed proof fixtures were confirmed to retain their original property, not merely their name:

- **Two-kind form-order fixture** (`twoUnmodeledKindsRefuseNamingBothInFormOrder`, `fjs/return/scope/module.f.js`): re-pointed from `seniorAndOtherScheduleOneADeductions`+`childTaxCreditOrOtherDependents` (both since reclassified) to `householdEmployeeWages`+`unreportedTips` (both still refused for the rest of the phase). Still asserts exactly 2 unmodeled kinds, still asserts 1040 FORM order (line 1b before line 1c), not declaration order — confirmed by direct read, property intact.
- **Message-pinning fixture** (`unreportedTipsRefusesNamingItsLineLabelAndRemedy`, using `expectedUnreportedTipsRefusalMessage`): confirmed present and still pins a whole hand-typed refusal sentence, deliberately kept separate from the two-kind fixture (which stopped pinning the whole message on purpose, since Plan 13-13 rewrites the remedy suffix) — the split is documented in-line as intentional, and the whole-message-pinning property survives in its own dedicated leaf.
- `fjs/form1040/core/module.f.js`'s `sixtyFivePlusProfile` fixture (the flagship 65+/MFJ/2-dependents declaration) was adapted three separate times across Waves 2 and 4 as its own declared kinds were reclassified, each time re-narrated as "what the profile now computes" rather than deleted — confirmed present and green.

### Requirements Coverage

| Requirement | Description | Status | Evidence |
|---|---|---|---|
| TAX-09 | Schedule 1-A Parts I/V/VI, senior deduction, 6% phase-out $75k/$150k → line 13b | ✓ SATISFIED | Criterion 1 above |
| TAX-10 | 18-line SSB worksheet, near-circular | ✓ SATISFIED | Criterion 2 above; C-2 text correction confirmed |
| TAX-12 | Schedule 8812 for dependents | ✓ SATISFIED | Criterion 4 above |
| TAX-13 | Schedule A, compared against standard deduction | ✓ SATISFIED | Criterion 3 above |
| TAX-14 | Schedule 1 and Schedule 2/3 to the extent the profile reaches them | ✓ SATISFIED | Criterion 4 above, with the reasoned 20/30 scope note |
| TAX-15 (cross-cutting, criterion 5) | One named income function per rule, no shared MAGI | ✓ SATISFIED | Criterion 5 above |

**ORPHANED requirements:** None — `.planning/REQUIREMENTS.md`'s traceability table lists exactly TAX-09/10/12/13/14 against Phase 13, matching ROADMAP.md's `Requirements:` line and every plan's declared `requirements` frontmatter.

**Known documentation lag (not a code gap):** `.planning/deferred-items.md` records that REQUIREMENTS.md's traceability-table `Status` column still reads "Pending" for TAX-09/10/12/13/14 even though each requirement's own `[x]` checkbox is set — a pre-existing cosmetic lag in an appendix table, explicitly out of 13-13's `files_modified` scope, not gating this verification.

### Anti-Patterns Found

None. Swept every phase-13-touched module (`fjs/schedule/1a`, `fjs/tax/ssb`, `fjs/schedule/a`, `fjs/schedule/1`, `fjs/schedule/2`, `fjs/schedule/3`, `fjs/form8812`, `fjs/tax/deduction`, `fjs/tax/params`, `fjs/tax/boundary`, `fjs/return/scope`, `fjs/return/profile`, `fjs/form1040/core`, `fjs/document/itemized_deductions`, `magi-gate.test.js`) for `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER` and prose stub markers — zero matches. The only "placeholder" occurrences found are prose explicitly stating something is NOT a placeholder ("real, non-placeholder value").

### Behavioral Spot-Checks / Full Suite Execution

| Behavior | Command | Result | Status |
|---|---|---|---|
| Full suite green | `npm test` (`tsc && node --test`) | `tsc` clean, `tests 3070, pass 3070, fail 0` | ✓ PASS |
| `tsc --noEmit` standalone | `npx tsc --noEmit` | exit 0, no errors | ✓ PASS |
| Project-local proof count vs. 665 baseline | `node --test 2>&1 \| grep -c '^✔ import("./fjs/'` | 830 (rose, never fell) | ✓ PASS |
| Criterion 5's literal gate | `grep -rn "magi" fjs/` | empty (exit 1) | ✓ PASS |
| Criterion 5's strengthened gate (C-1) | `grep -rno "[a-zA-Z]*[Mm]agi[a-zA-Z]*" fjs/` | empty | ✓ PASS |
| fjs/functionalscript version match | `node -p .../package.json.version` vs. lockfile | both `0.43.1` | ✓ PASS |
| No new dependency added | `git diff` `package.json`/`package-lock.json` across phase 13 commits | no diff | ✓ PASS |
| Wire-before-reclassify invariant | `git log --oneline` per slice | wire commit precedes reclassify commit in every slice (1, 2, 3, 4) | ✓ PASS |

### Probe Execution

No `scripts/*/tests/probe-*.sh` convention exists in this project; this project's own test discovery IS `npm test` (`all.test.js` walking every `proof` export plus root-level `*.test.js` files). That full-suite run is reported above under Behavioral Spot-Checks. No separate probe scripts apply. **Step 7c: SKIPPED (no probe convention in this project; full suite run and reported above instead).**

### Human Verification Required

#### 1. Transcribed IRS figures match the printed 2025 PDFs

**Test:** For each new TY2025 parameter this phase introduces — senior deduction ($6,000 base,
6% rate, $75,000/$150,000 threshold), SSB worksheet base amounts ($25,000/$32,000 first
threshold, $9,000/$12,000 second threshold), SALT cap ($40,000 flat cap, 30% phase-down rate,
$500,000/$250,000 income threshold, $10,000 floor), medical floor (7.5%), and Schedule 8812's
CTC ($2,200), ODC ($500), ACTC cap ($1,700), and phase-out ($400,000/$200,000 threshold, 5% per
$1,000 step) — open the cited 2025 IRS PDF at the page `13-RESEARCH.md`'s `[VERIFIED: ...]`
annotation names, and confirm the figure and its printed line label.

**Expected:** Every cited figure matches the printed form/instructions exactly.

**Why human:** This verifier has no local copy of `f1040s1a.pdf`, `i1040gi.pdf`, `f1040sa.pdf`,
`i1040sca.pdf`, `f1040s8.pdf`, `i1040s8.pdf`, or `rp-25-32.pdf`, and cannot fetch them. A green
suite (3070 tests, all passing) proves the engine's arithmetic agrees internally with the
constants it was given — it structurally cannot detect that a constant was transcribed
incorrectly from the source PDF. This is `13-VALIDATION.md`'s own named risk (its "Manual-Only
Verifications" table), stated as the fooled-but-passing failure mode for this entire phase, and
it remains open regardless of how thorough the code-level verification above is.

### Gaps Summary

No code-level gaps found. All five ROADMAP success criteria are genuinely, substantively met —
not nominally: the load-bearing "itemizing loses above the base threshold" case (criterion 3),
the near-circular tax-exempt-interest add-back case (criterion 2), the MFS short-circuit's
decisive proof (criterion 1), the stepped-vs-continuous phase-out distinction (criterion 4/TAX-04),
and the mechanical, strengthened MAGI gate (criterion 5, closing carried finding C-1) were each
independently confirmed by direct source read, not by trusting SUMMARY.md prose. Wire-before-
reclassify was confirmed in git history for every slice. Proof-fixture continuity across
reclassifications was confirmed for the two named at-risk fixtures. `tsc` is clean, the full
suite is green (3070/3070), the project-local proof count rose from 665 to 830, and no
dependency was added.

The five-coarse-kind non-reclassification (Schedule 1/2/3's `scheduleOneAdditionalIncome` /
`scheduleOneAdjustments` / `scheduleTwoTaxes` / `scheduleThreeNonrefundableCredits` /
`scheduleThreeRefundableCredits`) is judged CORRECT, not a gap — it is the honest application of
TAX-16's "no confident zero" discipline to lines the declared profile genuinely does not reach,
and is explicitly reasoned in both the code and ROADMAP.md's own finding note.

The one open item is the manual PDF spot-check `13-VALIDATION.md` itself names as impossible to
close by automated means, which routes this verification to `human_needed` rather than `passed`
per the standard decision tree (Step 9: any non-empty human-verification section blocks `passed`
regardless of an otherwise-clean score).

---

_Verified: 2026-08-11_
_Verifier: Claude (gsd-verifier)_
