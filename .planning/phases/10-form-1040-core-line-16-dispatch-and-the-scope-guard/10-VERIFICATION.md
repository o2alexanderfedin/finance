---
phase: 10-form-1040-core-line-16-dispatch-and-the-scope-guard
verified: 2026-08-07T01:03:21Z
status: passed
score: 5/5 must-haves verified
verdict: PASS — with one coverage WARNING and one open human-verification item (F-01 and F-02 closed 2026-08-09)
overrides_applied: 0
method: goal-backward + independent mutation sweep (28 mutations executed by the verifier in an
  isolated copy, each reverted; every expected value re-derived from the stored brackets by hand
  rather than read from a SUMMARY)
measurements:
  npm_test: "492 tests, 492 pass, 0 fail, tsc clean"
  fjs_proof_leaves: 490   # node --test 2>&1 | grep -c '^✔ import("./fjs/'
  mutations_run: 28
  mutations_killed: 20
  mutations_survived_equivalent: 5
  mutations_survived_real_gap: 2
  mutations_survived_unreachable_by_design: 1
warnings:
  - truth: "Criterion 3 — the standard deduction applies age and blindness increments, with a proof at each combination the profile can produce"
    status: verified_with_coverage_gap
    reason: >
      The shipped wiring is CORRECT, but two of line 12e's three exception inputs are not watched
      by any proof. Hardcoding `spouseItemizes` or `dualStatusAlien` to `false` at the caller
      (fjs/form1040/core/module.f.js:465 and :466) leaves the suite fully green — 492/492, tsc
      clean — while an MFS filer whose spouse itemizes is handed $22,150.00 of standard deduction
      instead of $0.00. Verified by executing the mutation and pricing the result.
    artifacts:
      - path: "fjs/form1040/core/module.f.js"
        issue: "lines 465-466: `spouseItemizes` / `dualStatusAlien` reach `standardDeductionCents` with no proof that observes them; all 33 fjs/tax/deduction leaves stay green because that module is called correctly there and only miswired here"
    missing:
      - "A leaf in fjs/form1040/core's `proof.line12e` that builds a marriedFilingSeparately profile with `spouseItemizes: true` (and `spouseHadNoIncomeIsNotFilingAndIsNotADependent: true` plus checked 12d boxes) and asserts line 12e is `0n` — the exact shape of the two existing `dependent*ThroughTheProfile` leaves that already close `claimedAsDependent`"
      - "Its sibling for `dualStatusAlien: true`"
      - "Both need the existing chart leaf as their control (the same profile without the flag takes the chart amount), which `marriedFilingJointlyWithFourBoxesIsThirtySevenNineCitingFiveBoxes` and `singleWithNoCheckedBoxesIsFifteenSevenFifty...` already supply"
    closes_in: "a single ~20-line addition to fjs/form1040/core/module.f.js; no production code change"
resolved_human_verification:
  - id: F-01
    test: "Read the 2025 Form 1040 face (f1040.pdf, both pages) and confirm the printed money-line inventory 1a-37 is exactly the 56 lines `orderedLines` enumerates, and that the printed labels are 7a / 11a / 11b / 12e / 25a-d / 27a / 35a as this module names them (TAX-15)."
    expected: "56 printed money lines, 1a through 37; 12a-12d and 7b are checkboxes; line 38 is out of range."
    resolved: 2026-08-09
    source_url: "https://www.irs.gov/pub/irs-pdf/f1040.pdf"
    confirmed_revision: "pdfinfo Title \"2025 Form 1040\", Subject \"U.S. Individual Income Tax Return\", 2 pages, CreationDate 2026-01-02 (PST); page-1 footer text \"Form 1040 (2025) Created 9/5/25\"; page-2 header \"Form 1040 (2025)\""
    result: "AGREE — 56 printed money lines enumerated 1a through 37, in the exact printed order `orderedLines` uses. 12a, 12b, 12c and 12d are checkboxes (no dollar box). 7b is a checkbox (\"Schedule D not required\" / \"Includes child's capital gain or (loss)\"). Line 38 (\"Estimated tax penalty\") is printed but out of the 1a-37 range. The seven named labels — 7a, 11a, 11b, 12e, 25a/25b/25c/25d, 27a, 35a — are printed on the form face exactly as the module names them."
    evidence: "`pdftotext -layout` extraction of both pages, cross-read against fjs/form1040/core/module.f.js's orderedLines (lines 994-1019) and expectedWholeReportLineCount = 56 (line 1227)."
  - id: F-02
    test: "Confirm the 19 hand-typed Standard Deduction Chart amounts in fjs/tax/deduction against f1040s.pdf p4, particularly the four non-zero marriedFilingSeparately rows ($17,350 / $18,950 / $20,550 / $22,150) and the QSS chart stopping at two boxes."
    expected: "Every row matches; MFS reaches four rows, QSS two."
    resolved: 2026-08-09
    source_url: "https://www.irs.gov/pub/irs-pdf/f1040s.pdf"
    confirmed_revision: "pdfinfo Title \"2025 Form 1040-SR\", Subject \"U.S. Income Tax Return for Seniors\", 4 pages, CreationDate 2026-01-02 (PST); page-1 form header \"1040-SR U.S. Income Tax Return for Seniors 2025\"; page-4 footer/header \"Form 1040-SR (2025)\""
    result: "AGREE — all 19 chart amounts match, including the four non-zero MFS rows ($17,350/$18,950/$20,550/$22,150) and the QSS chart stopping at two boxes ($33,100/$34,700, no third or fourth row printed)."
    evidence: "`pdftotext -layout` extraction of page 4, transcribed box-by-box before comparison against fjs/tax/deduction/module.f.js's chartCombinations (lines 299-326) and maxAgedOrBlindBoxes (lines 97-118)."
human_verification:
  - test: "Confirm 10-RESEARCH.md assumption A2 — that the Tax Computation Worksheet is cent-exact rather than whole-dollar — against a real filed return."
    expected: "$184,094.50 for MFJ at $700,000.00 of taxable income (the one figure in the phase sensitive to A2)."
    why_human: "The IRS states no TCW-specific rounding rule. Both fjs/tax/table and fjs/tax/line16/qdcgt pin this figure; Phase 14's acceptance is what resolves it. Recorded honestly at both sites."
    result: passed
    resolved: 2026-08-17
    resolved_by: "RESOLVED FROM THE PRINTED PAGE, and it never needed a filed return -- the question was routed to Phase 14 because 'the IRS states no TCW-specific rounding rule', but the worksheet settles it structurally rather than by rule."
    evidence:
      - "Pub. 1040 (2025) p14-15, 2025 Tax Computation Worksheet -- Line 16, Section B (Married filing jointly or Qualifying surviving spouse), row 'Over $501,050 but not over $751,600': column (b) 'x 35% (0.35)', column (d) subtraction amount '$ 60,905.50'. The SUBTRACTION AMOUNT THE FILER IS TOLD TO SUBTRACT CARRIES CENTS."
      - "Four more printed subtraction amounts carry non-zero cents, three of them a QUARTER of a dollar: Single 35% $30,452.75 and 37% $42,979.75; MFJ 37% $75,937.50; MFS 37% $37,968.75. A worksheet designed to produce whole dollars cannot print $.75 in its own constant, so cent precision is a property of the form, not an inference from the Form 1040 p23 general rounding rule."
      - "The pinned figure follows directly: 35% x $700,000.00 - $60,905.50 = $184,094.50 exactly, which is what fjs/tax/table and fjs/tax/line16/qdcgt both assert."
      - "Bonus check, same page: all TWENTY stored taxComputationWorksheetRows (4 filing statuses x 5 brackets) were compared against the printed Sections A-D -- income bounds, multiplication amounts and subtraction amounts -- with ZERO mismatches. Section B's printed heading covers 'Married filing jointly or Qualifying surviving spouse', which is exactly what taxTableColumnFor.qualifyingSurvivingSpouse mirrors, so the absence of QSS rows is correct and not a gap."
    note: "10-RESEARCH.md's A2 asked whether the worksheet rounds. The answer was on the page it already cited. Phase 14 remains genuinely required for line-by-line acceptance against a real return -- this item simply was not one of the things that needed it."
deferred:
  - truth: "The Schedule D Tax Worksheet branch computes rather than refuses"
    addressed_in: "Phase 12"
    evidence: "ROADMAP Phase 12 success criterion 2: 'A boxes 2b/2d case routes through Form 8949 -> Schedule D -> the Schedule D Tax Worksheet and matches line by line.' 10-CONTEXT.md Decision 1 defers it; fjs/tax/line16 selects the branch and refuses, tagged."
  - truth: "The QDCGT branch is reachable through `form1040Report` (not only through `dispatchLine16`)"
    addressed_in: "Phase 12"
    evidence: "ROADMAP Phase 12 success criterion 1: '`vnd.fjs.1099div` and the QDCGT worksheet ship in the same phase.' Line 3a's source is a 1099-DIV, whose dialect is DOC-06/Phase 12; until then `qualifiedDividends` is an unmodeled declared kind and the whole report refuses — fjs/return/scope's docstring states exactly this."
  - truth: "Line 12e's provenance is box-granular rather than document-granular"
    addressed_in: "logged, not a later phase"
    evidence: "deferred-items.md item 2, and 10-09-SUMMARY.md 'Deliberate non-deviations'. Criterion 1 asks for the DOCUMENTS a line derived from, which is satisfied; the gap is box granularity within the one profile document."
---

# Phase 10: Form 1040 Core, Line-16 Dispatch, and the Scope Guard — Verification Report

**Phase Goal:** A real 1040 computes for a return inside the declared scope, and anything outside it is refused loudly rather than silently omitted.
**Requirements:** TAX-03, TAX-05, TAX-06, TAX-16
**Branch:** `feature/phase-10-form-1040-core-and-scope-guard` @ `e03eb7e`
**Verified:** 2026-08-07T01:03:21Z
**Verdict:** **PASS** — all five success criteria are true in the shipped code — **with one coverage
warning that must be closed** and three human-verification items.

## How this was verified

Not by reading the ten SUMMARY files. Every number below was re-derived, and every claim was tested
by breaking the code and watching the suite:

- `npm test` → **492 tests, 492 pass, 0 fail**, `tsc` clean.
- `node --test 2>&1 | grep -c '^✔ import("./fjs/'` → **490** project-local proof leaves (the
  measurement AGENTS.md mandates; `npm test`'s total was never gated on).
- **28 mutations** executed by the verifier in an isolated `cp -a` copy with the worktree `.git`
  pointer removed (AGENTS.md's caution about a copy sharing the real gitdir is stronger in a
  worktree — no writing git command was run anywhere near it), one at a time, each reverted from
  the pristine source before the next.
- The QDCGT regression pair, the Tax Table midpoint arithmetic and the $100,000 seam were
  **recomputed by hand** from the stored TY2025 brackets before comparing against the hand-typed
  expectations in the proofs. They agree to the cent.

## Goal Achievement

### Observable Truths

| # | Truth (ROADMAP success criterion) | Status | Evidence |
|---|---|---|---|
| 1 | Lines 1a–37 compute for an in-scope return, each line citing the documents it derived from | ✓ VERIFIED | `fjs/form1040/core`'s `orderedLines` enumerates **56** printed money lines; `everyOneOfTheFiftySixLinesCitesADocumentAndNamesItsRule` asserts `sources.length > 0` and a non-empty `rule` on every one, against the **hand-typed** `expectedWholeReportLineCount = 56` and a DISTINCT-rule-count of 56. Dropping `tax.line36` from the list → **3 leaves red**. A legitimately zero line cites the profile's own `declaredKinds` box; renaming that box path → **3 red**. Disabling source deduplication → **4 red**. |
| 2 | Line 16 dispatches explicitly across the four methods, a `proof` per branch, and the signature $1–$12 error covered by a regression proof | ✓ VERIFIED | See the dedicated section below — this is the criterion most at risk of being satisfied on paper, and it is not. |
| 3 | The standard deduction applies age and blindness increments, with a proof at each combination the profile can produce | ✓ VERIFIED **⚠ with a coverage gap** | 19 generated chart leaves against a **hand-typed** `expectedChartCombinationCount = 19`; the 19 are exactly what the profile can produce (single/HoH/QSS capped at 2 boxes by `checkReferences` check 5, MFJ/MFS at 4). Increment mapping mutations killed (MFS→`unmarried`: 4 red; QSS→`unmarried`: 4 red). Caller wiring killed for the box tally, the box count and `earnedIncome`. **Gap:** `spouseItemizes` and `dualStatusAlien` are unwatched — see Warnings. |
| 4 | An unmodeled input produces a loud refusal naming what is unmodeled, never a silently omitted line | ✓ VERIFIED | Refusals name the kind, the 1040 line, a human label and the remedy; the whole message is pinned character-for-character by a **hand-typed** sentence. Reducing the message to the bare kind → **13 red**. Inverting `classifyScope` → **18 red, controls included**. Disabling the guard at the entry point → **3 red**. Migrating a kind into the modeled set → **7 red**. A refusal that names nothing is itself refused, and the thrown value's CONTENT is asserted, not merely that it threw. |
| 5 | Rounding at line boundaries only (`round(sum)`, never `sum(round)`), on a line aggregating ten or more documents with real cents | ✓ VERIFIED | Genuinely non-tautological — see the dedicated section below. |

**Score: 5/5.**

### Criterion 2 in detail — the regression proof is aimed at the right bug

The brief's specific worry: *the regression proof must pin the OMISSION OF LINE 25's `min`, because
an engine that merely looks line 1 up in the Tax Table gets both worked cases right.* That is
exactly right, and the code says so out loud (`fjs/tax/line16/qdcgt`'s docstring, "The defect this
file exists to pin"). Independently checked:

| What was checked | Verifier's own derivation | Proof's hand-typed value | Agrees |
|---|---|---|---|
| Case A line 22 (MFJ, band $96,700–96,750, midpoint 96,725) | 10%×23,850 + 12%×72,875 = **$11,130.00** | `1113000n` | ✓ |
| Case A line 24 (band $97,000–97,050, midpoint 97,025) | 11,157 + 22%×75 = 11,173.50 → **$11,174** | `1117400n` | ✓ |
| Case A line 23 = 45 + 0 + 11,130 | **$11,175.00** | `1117500n` | ✓ |
| Case A `line23 - line25` | **$1.00** | `100n` | ✓ |
| Case B line 24 (band $96,950–97,000, midpoint 96,975) | 11,157 + 22%×25 = 11,162.50 → **$11,163** | `1116300n` | ✓ |
| Case B line 23 = 44.85 + 11,130 | **$11,174.85** | `1117485n` | ✓ |
| Case B `line23 - line25` | **$11.85** | `1185n` | ✓ |
| Control (MFJ $90,000/$10,000) `line24 - line25` | 10,326 − 9,126 = **$1,200.00** | `120000n` | ✓ |

$1.00 and $11.85 sit inside the roadmap's "$1–$12" description, and the module explicitly refuses to
assert that range as a bound (it names a $13.35 counterexample). The pair is what pins the `min`:
both cases return line 24, so either alone is satisfied by a naive table lookup — but the pair, plus
the control where `min` selects line 23 instead, is not. Executed mutations:

| Mutation | Result |
|---|---|
| `line25 = line23` (omit the min) | **KILLED** — 5 red, both regression cases and two dispatcher leaves |
| `line25 = line24` (always take line 24) | **KILLED** — 4 red, led by the control leg |
| level 2a gated behind `qualifiedDividendsCents === 0n` (a swapped 2a/2c order) | **KILLED** — 5 red, **every one an assertion on the SELECTED METHOD**, not on cents |
| `baseTaxForAmount`'s seam `<` → `<=` | **KILLED** — 4 red |
| `line16MethodNames.taxComputationWorksheet` → `'Tax Table'` | **KILLED** — 1 red |
| line 16 priced on line 11b instead of line 15 | **KILLED** — 6 red |

The four TAX-03 branches are covered by a table with a **hand-typed** `expectedTaxThreeBranchCount =
4` and a distinct-method assertion, plus five refusing arms against a **hand-typed**
`expectedRefusingArmCount = 5` whose expected labels are hand-typed rather than read from
`fjs/return/scope`'s table. The ordering leaf's input is genuinely discriminating (non-zero Schedule
D line 19 **and** non-zero line 3a) and it is deliberately duplicated into the branch table so a
later "simplification" of one still leaves the other firing.

### Criterion 5 in detail — the tautology is genuinely dead

Over `bigint` cents `round(sum)` and `sum(round)` are both the identity, and the phase knows it
(10-CONTEXT.md Decision 5, restated at both proof sites). The bite comes from the IRS whole-dollar
election (i1040gi p23), and it bites:

- `criterionFiveRoundSumOverTenInterestDocuments` builds **ten separately-addressable stored
  1099-INT documents** at the IRS's own printed `'1.39'`, runs them through the **real** line
  assembly, and gets $13.90 from ten cited sources. `round(sum)` = **$14**; assembling each document
  into its own line 2b and rounding first = **$10**; the divergence **$4** is asserted as its own
  value. `1390n`, `1400n`, `1000n`, `400n` and the count `10` are each hand-typed and none is
  derived from another.
- The all-or-nothing half is asserted over **every** line of the report (`value % 100n === 0n`),
  with the un-elected control keeping its cents.

| Mutation | Result |
|---|---|
| `wholeDollarCentsFromCents` → round to the cent (identity) | **KILLED** — 8 red |
| `wholeDollarCentsFromCents` biased down by 50c | **KILLED** — 6 red |
| `applyWholeDollarElection` reads the election inverted | **KILLED** — 10 red |
| `form1040Report` passes `!== true` instead of `=== true` | **KILLED** — 2 red (leaf + its control) |

### Required Artifacts

| Artifact | Provides | Exists | Substantive | Wired | Data flows | Status |
|---|---|---|---|---|---|---|
| `fjs/form1040/core/module.f.js` (2,160 ln) | lines 1a–37, `form1040Report` | ✓ | ✓ | ⚠ see note | ✓ | ✓ VERIFIED |
| `fjs/tax/line16/module.f.js` (1,087 ln) | `dispatchLine16`, 4 branches + 3 wrappers | ✓ | ✓ | ✓ (core) | ✓ | ✓ VERIFIED |
| `fjs/tax/line16/qdcgt/module.f.js` (634 ln) | all 25 printed worksheet lines | ✓ | ✓ | ✓ (line16) | ✓ | ✓ VERIFIED |
| `fjs/return/scope/module.f.js` (649 ln) | `classifyScope`, `scopeRefusal`, 6/44 partition | ✓ | ✓ | ✓ (core, line16) | ✓ | ✓ VERIFIED |
| `fjs/return/profile/module.f.js` (648 ln) | `vnd.fjs.return_profile`, 50-kind vocabulary | ✓ | ✓ | ✓ (core, scope, finance_schema) | ✓ | ✓ VERIFIED |
| `fjs/tax/deduction/module.f.js` (617 ln) | line 12e chart + 3 exceptions | ✓ | ✓ | ✓ (core) | ✓ | ✓ VERIFIED |
| `fjs/tax/table/module.f.js` (878 ln) | TCW, `baseTaxForAmount`, $100k seam | ✓ | ✓ | ✓ (line16, qdcgt) | ✓ | ✓ VERIFIED |
| `fjs/tax/params/module.f.js` (674 ln) | QSS as a real status, TY2025 parameters | ✓ | ✓ | ✓ | ✓ | ✓ VERIFIED |
| `fjs/report/line/module.f.js` (424 ln) | `applyWholeDollarElection` | ✓ | ✓ | ✓ (core) | ✓ | ✓ VERIFIED |

**Note on `form1040Report`'s wiring.** `vnd.fjs.return_profile` **is** registered in
`fjs/server/finance_schema`'s `dialectSchemas`, so a profile can be stored and served. But
`form1040Report` itself has **no caller outside its own module** — nothing in `fjs/server`,
`fjs/run` or `fjs/exec` invokes it, so no 1040 can yet be produced through the running application.
This is **not** a criterion failure: none of the five criteria mentions tool exposure, and the
ROADMAP places end-to-end execution in Phase 14. It is recorded here so it is not later mistaken for
something this phase delivered.

### Key Link Verification

| From | To | Via | Status | Evidence |
|---|---|---|---|---|
| `form1040Report` | `classifyScope` | direct call, **before any line is computed** | ✓ WIRED | Neutering the argument (`.slice(0,0)`) → 3 red |
| `form1040TaxAndPaymentLines` | `dispatchLine16` | line 15's value as `taxableIncomeCents` | ✓ WIRED | Substituting line 11b → 6 red |
| `dispatchLine16` | `qdcgt` | level 2c/2d/2e arm | ✓ WIRED | min mutations propagate to 3 dispatcher leaves |
| `dispatchLine16` | `baseTaxForAmount` | level 3 | ✓ WIRED | seam mutation → 4 red incl. one in `core` |
| `dispatchLine16` / line 16 refusals | `scopeRefusal` | the ONE refusal builder | ✓ WIRED | reordering `scopeRefusal`'s walk → 2 red in `line16` |
| line 12e | `standardDeductionCents` — `status` | `storedFilingStatusNamed` | ✓ WIRED | QSS increment mutation reddens two `core` leaves |
| line 12e | `standardDeductionCents` — `agedOrBlindBoxes` | 12d box tally | ✓ WIRED | `length * 0` → 4 red; `.slice(0,3)` → 1 red |
| line 12e | `standardDeductionCents` — `claimedAsDependent` | profile box presence | ✓ WIRED | `&& false` → 2 red |
| line 12e | `standardDeductionCents` — `earnedIncomeCents` | profile money box | ✓ WIRED | `* 0n` → 1 red |
| line 12e | `standardDeductionCents` — `spouseItemizes` | profile box presence | ⚠ **UNWATCHED** | `&& false` → **suite green**, line 12e becomes $22,150 instead of $0 |
| line 12e | `standardDeductionCents` — `dualStatusAlien` | profile box presence | ⚠ **UNWATCHED** | `&& false` → **suite green** |
| `form1040Report` | `applyWholeDollarElection` | profile's `wholeDollarElection` box | ✓ WIRED | inverted flag → 2 red |
| `finance_schema` | `returnProfileSchema` | `dialectSchemas` registration | ✓ WIRED | present, with its own hand-typed dialect count |
| `form1040Report` | any production caller | — | ✗ NONE | see note above; Phase 14 owns it |

### The mutation sweep in full

| # | Site | Mutation | Result |
|---|---|---|---|
| 1 | `report/line:126` | round to the cent (identity) | KILLED (8) |
| 2 | `report/line:126` | bias 50c down | KILLED (6) |
| 3 | `report/line:163` | `* 1n` | survived — **equivalent** (control mutant, expected) |
| 4 | `report/line:162` | `elected` → `!elected` | KILLED (10) |
| 5 | `tax/line16:259` | 2a gated on no qualified dividends (≡ swapped 2a/2c) | KILLED (5, all method-tag) |
| 6 | `line16/qdcgt:242` | `line25 = line23` | KILLED (5) |
| 7 | `line16/qdcgt:242` | `line25 = line24` | KILLED (4) |
| 8 | `tax/table:379` | seam `<` → `<=` | KILLED (4) |
| 9 | `tax/deduction:80` | MFS increment `married` → `unmarried` | KILLED (4) |
| 10 | `tax/deduction:85` | QSS increment `married` → `unmarried` | KILLED (4) |
| 11 | `tax/deduction:117` | QSS max boxes 2 → 4 | KILLED (1) |
| 12 | `tax/deduction:101` | MFJ max boxes 4 → 5 | KILLED (1) |
| 13 | `form1040/core:464` | `claimedAsDependent && false` | KILLED (2) |
| 14 | `form1040/core:465` | `spouseItemizes && false` | **SURVIVED — real gap** |
| 15 | `form1040/core:466` | `dualStatusAlien && false` | **SURVIVED — real gap** |
| 16 | `form1040/core:469` | `earnedIncome * 0n` | KILLED (1) |
| 17 | `form1040/core:435` | 12d box list truncated to 3 | KILLED (1) |
| 18 | `form1040/core:457` | box count `* 0` | KILLED (4) |
| 19 | `form1040/core:1004` | scope guard neutered | KILLED (3) |
| 20 | `form1040/core:1014` | election flag inverted | KILLED (2) |
| 21 | `form1040/core:236` | zero line's cited box path renamed | KILLED (3) |
| 22 | `form1040/core:182` | absent box defaulted to `'0.00'` | KILLED (2) |
| 23 | `form1040/core:145` | source dedup disabled | KILLED (4) |
| 24 | `form1040/core:897` | line 36 dropped from the report | KILLED (3) |
| 25 | `form1040/core:372` | line 1i added to line 1z | survived — **equivalent by construction, documented** |
| 26 | `form1040/core:807` | line 25b reads 1099-INT box 1 | KILLED (1) |
| 27 | `form1040/core:833` | line 34 `>` → `>=` | survived — **genuinely equivalent** (at equality the difference is 0) |
| 28 | `form1040/core:483` | line 13b duplicated into line 14 | survived — **genuinely equivalent** (0n, sources dedup) |
| 29 | `form1040/core:754` | line 16 priced on AGI | KILLED (6) |
| 30 | `form1040/core:653` | TCW reported as "Tax Table" | KILLED (1) |
| 31 | `form1040/core:654` | QDCGT's printed name corrupted | survived — **unreachable through the report by design** (see below) |
| 32 | `form1040/core:400` | line 9 drops line 2b | KILLED (1) |
| 33 | `form1040/core:490` | line 15's printed floor removed | KILLED (1) |
| 34 | `return/scope:286` | refusal message reduced to the bare kind | KILLED (13) |
| 35 | `return/scope:307` | `classifyScope` comparison inverted | KILLED (18, controls included) |
| 36 | `return/scope:82` | a kind migrated into the modeled set | KILLED (7) |
| 37 | `return/scope:282` | refusal ordered by caller order, not the table walk | KILLED (2) |
| 38 | `return/profile:238` | QSS dropped from the no-spouse-box statuses | KILLED (2) |
| 39 | `tax/params:136` | a filing status duplicated | KILLED (1, by the hand-typed threshold count) |
| 40 | `tax/deduction:240` | box validation folded into the exception branch | survived — **unreachable** (the assert above already refuses) |

Several intended mutations were **unrunnable** because they orphaned a binding under
`noUnusedLocals` / narrowed a union (`TS6133`, `TS7027`, `TS2339`, `TS2551`, `TS2345`) — exactly the
hazard AGENTS.md records. Each was re-run in a semantically identical form that keeps the binding
live, and both the compile error and the real result are counted above.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|---|---|---|---|---|
| — | — | `TBD` / `FIXME` / `XXX` in any file this phase touched | — | **none found** (`grep -nE 'TBD|FIXME|XXX'` over the nine modules returns nothing) |
| `fjs/form1040/core` | 1063–1310 | large test-fixture block, `return null`/`=> {}` shapes | ℹ INFO | none — no empty implementation anywhere; every `0n` line is a profile-declared zero with a citation |
| `fjs/tax/line16` | 1066–1087 | a trailing "what this phase deliberately does NOT prove" note | ℹ INFO | honest deferral, points at Phase 12; not a debt marker |

### Requirements Coverage

| Requirement | Description | Status | Evidence |
|---|---|---|---|
| TAX-03 | Explicit line-16 method dispatch across all branches | ✓ SATISFIED | `dispatchLine16` with 4 branches + 3 wrappers, tagged on both arms; `grep -c cumulativeBracketTaxCents fjs/form1040/core/module.f.js` = **0**, i.e. the report cannot do bracket arithmetic behind the dispatcher's back |
| TAX-05 | Form 1040 core lines 1a–37 | ✓ SATISFIED | 56 printed money lines, each a `ReportLine` |
| TAX-06 | Standard deduction with age and blindness increments | ✓ SATISFIED (with the coverage warning) | 19 chart combinations + 3 exceptions |
| TAX-16 | Scope guard — loud refusal, never a silent omission | ✓ SATISFIED | 6/44 partition enforced at `tsc`; the error arm carries **no `lines` field at all**, as an assignability property rather than an excess-property one |

`REQUIREMENTS.md`'s traceability table now reads **Complete** for all four including TAX-16, so
`deferred-items.md` item 1 (the TAX-16 row disagreeing with its own checkbox) is **closed**.

### Recorded decisions — is the record honest?

| Recorded as | Verifier's finding |
|---|---|
| The Schedule D Tax Worksheet branch **refuses** rather than computing (Decision 1); Phase 12 owns it | **Honest.** The branch is genuinely *selected* and then refuses, and the tag rides on the error arm precisely so the branch is still assertable. `fjs/tax/line16`'s closing note names the differential proof Phase 12 must write and says why it cannot be written here. |
| Line 12e's provenance is document-granular, not box-granular | **Honest and complete.** Named in `deferred-items.md` item 2 and in 10-09-SUMMARY's "Deliberate non-deviations", with the $14,400 exposure priced. Criterion 1 asks for the *documents* a line derived from; that holds. |
| "Line 1i is not in 1z" is an equivalent mutant by construction, so a comment and not a leaf | **Honest — and independently confirmed.** Mutation 25 added line 1i to line 1z and the suite stayed green, exactly as 10-09-SUMMARY predicts, for exactly the reason it gives (all of 1b–1i are `0n` citing the same `(hash, 'declaredKinds')` pair, so the dedup two operations away absorbs it). |

### What the SUMMARY files claim that the code does not support

**Nothing material.** Every checkable claim was re-run and matched:

- `npm test` 492/492, tsc clean — confirmed.
- 490 project-local proof leaves — confirmed exactly.
- `grep -c cumulativeBracketTaxCents` = 0, `dispatchLine16` = 2, `instanceof Error` = 0,
  `control|CONTROL` = 24, `line37|line35a|line25d` = 23, `classifyScope(` = 1 — all confirmed exactly.
- 10-10-SUMMARY's five-site sweep (9 / 2 / 4 / 6 / 18 red) — reproduced in shape and magnitude by
  independent mutations at the same sites, including the subtle site-2 differential (line 6 is the
  constant, line 7 is the `min`) and site 4's "not one cents-only proof moved".
- 10-10-SUMMARY's admission that mutation 3's original prediction was **false** — that omitting
  `lines` from the error arm did *not* make adding it a compile error, and that `readonly lines?:
  undefined` was needed — is the opposite of a flattering claim, and the fix is present at
  `fjs/form1040/core/module.f.js` with `theErrorArmCarriesNoLinesFieldAtAll` asserting the runtime
  half via `Object.hasOwn`.

Two SUMMARY statements are **true but worth qualifying**:

1. 10-09-SUMMARY's *"Known Stubs: None. … no data source is left unwired."* — true of the shipped
   code, and it is what led to the warning below not being caught: two data sources are wired but
   **unwatched**. "Wired" and "proven wired" are different claims, and this phase's own culture is
   that only the second counts.
2. `fjs/form1040/core`'s `line16` leaf asserts `tax.line16.sources.length ===
   income.line15.sources.length` — an expected side read from the code under test. It is not
   exploitable in practice (every neighbouring line has a different source count, so a wrong
   citation changes the number), but it is the one assertion in the phase written in the shape
   AGENTS.md warns about. A hand-typed `3` would be strictly better.

## Gaps Summary

One gap, and it is a **proof** gap rather than a defect: line 12e's exception-2 and exception-3
inputs (`spouseItemizes`, `dualStatusAlien`) travel from the return profile into
`standardDeductionCents` with nothing watching them. Hardcoding either to `false` leaves 492/492
green and `tsc` clean, while a married-filing-separately filer whose spouse itemizes is handed
**$22,150.00** of standard deduction instead of **$0.00** — measured, not estimated.

This is the same shape Plan 10-09 caught for `claimedAsDependent` and closed with two leaves that go
*through the profile*; it simply was not extended to the other two flags. All 33 `fjs/tax/deduction`
leaves stay green because that module is called correctly there and could only ever be miswired
here. Closing it is a ~20-line addition to `fjs/form1040/core`'s `proof.line12e` with no production
code change, and both leaves already have their controls in the existing chart proofs.

Nothing about this gap blocks Phase 12, which depends on Phase 10 for the dispatcher and the scope
guard — both of which are proven end to end.

---

_Verified: 2026-08-07T01:03:21Z_
_Verifier: Claude (gsd-verifier) — goal-backward, 40 mutations executed independently of the SUMMARY narrative_

---

## GAP CLOSURE — line 12e's exceptions 2 and 3 are now watched

_Appended 2026-08-06. The verifier's findings above are left exactly as written; this section
records only what was added in response to the Warning and what was observed._

**Production code changed: none.** `git diff --numstat` on the one touched file is `72 0` — purely
additive, and both hunks land after the `── Tests ──` marker at line 1019. The shipped wiring was
already correct, as the report says; it was unproven.

### What was added

Two leaves in `fjs/form1040/core`'s `proof.line12e`, reaching `standardDeductionCents` **through a
return profile** rather than by calling it directly — the exact shape of the two
`dependent*ThroughTheProfile` leaves that already close `claimedAsDependent`:

| Leaf | Profile | Expected |
|---|---|---|
| `spouseItemizesIsZeroEvenWithFourBoxesCheckedThroughTheProfile` | MFS, all four 12d boxes, `spouseHadNoIncomeIsNotFilingAndIsNotADependent: true`, `spouseItemizes: true` | `0n` |
| `dualStatusAlienIsZeroEvenWithFourBoxesCheckedThroughTheProfile` | the same four-box base with `dualStatusAlien: true` instead | `0n` |

Plus three fixtures: `marriedFilingSeparatelyFourBoxProfile` and the two exception profiles spread
from it, so the pair differs in exactly one box and neither can pass on the other's account.

`0n` is **hand-typed from i1040gi p34** ("even if you were born before January 2, 1961, or were
blind"), not derived from the chart row. The four-box base is deliberate: `$22,150` is the largest
amount the printed MFS column reaches, so an exception that fails to fire is wrong by the widest
margin the status can produce, and a no-box profile could not tell "the exception fired" apart from
"an increment went missing".

**No control was added.** As the report's `missing` item 3 says, the existing chart leaves already
supply it — and this was confirmed rather than assumed (mutation 3 below).

### Observed mutation results

Each run on the real tracked file, one at a time, each reverted, each verified with
`git diff --numstat` showing `73 1` (the pre-mutation baseline being `72 0`, so exactly one tracked
line changed). Gate: `node --test 2>&1 | grep -c '^✔ import("./fjs/'`, never `npm test`'s total.

| # | Mutation at `fjs/form1040/core/module.f.js` | Predicted | **Observed** |
|---|---|---|---|
| 1 | `spouseItemizes: profile.value.spouseItemizes !== undefined && false` | red on the new `spouseItemizes` leaf | **KILLED — 1 red**, exactly that leaf, `tests 494, pass 493, fail 1`. Assertion payload `[ 2215000n, 0n ]` — the **$22,150.00 vs $0.00** the report priced, now observed as a failure rather than as a survival |
| 2 | `dualStatusAlien: profile.value.dualStatusAlien !== undefined && false` | red on the new `dualStatusAlien` leaf | **KILLED — 1 red**, exactly that leaf, `pass 493, fail 1`, payload `[ 2215000n, 0n ]` |
| 3 | `spouseItemizes: ... !== undefined \|\| true` (the gate-refuses-everything direction, written with `\|\| true` rather than a bare `true` so the binding stays live under `noUnusedLocals`) | the existing chart leaves red; the two NEW leaves green | **KILLED — 17 red**, including `marriedFilingJointlyWithFourBoxesIsThirtySevenNineCitingFiveBoxes`, both `dependent*ThroughTheProfile` leaves, `line14`, both `line15`, both `line16` and three `refundOrAmountOwed` leaves. The two new leaves stayed **green**, as predicted — which is precisely why they need a control and why the control must live elsewhere |

Mutations 1 and 2 each left the *sibling* new leaf green, so neither leaf is passing on the other's
account. None of the three hit any of AGENTS.md's three failure modes: all compiled (no orphaned
binding), none was absorbed by a neighbour, and each reddened the predicted set.

### Measurements

| | Before | After |
|---|---|---|
| `node --test 2>&1 \| grep -c '^✔ import("./fjs/'` | **490** | **492** |
| `npm test` | 492/492, tsc clean | **494/494, tsc clean** |

The Warning's `closes_in` estimate — "a single ~20-line addition, no production code change" — held.
Link-verification rows `spouseItemizes` and `dualStatusAlien` move from ⚠ **UNWATCHED** to ✓ WIRED,
on the same evidence standard as the `claimedAsDependent` row above them.

_Gap closed: 2026-08-06 — Claude (gsd-executor), 3 mutations executed on the real tracked file_

---

## F-01 — Closed: the printed 1a–37 money-line inventory matches `orderedLines` exactly

_Appended 2026-08-09. The verifier's original escalation above is left exactly as written — it was
the right call at the time: "The verifier has no access to the IRS PDF" was true when it was
written. It stopped being true earlier in this session, when a network-fetch capability became
available, which is the entire reason this item was reopened rather than left `human_needed`
forever._

### Primary source and revision confirmation

Fetched directly from `https://www.irs.gov/pub/irs-pdf/f1040.pdf` (220,237 bytes, PDF 1.7). Before
reading any content, `pdfinfo` was run to confirm this is the TY2025 revision and not a stale cache
or a TY2024 document silently answering the wrong question:

```
Title:           2025 Form 1040
Subject:         U.S. Individual Income Tax Return
Pages:           2
CreationDate:    Fri Jan  2 05:24:31 2026 PST
ModDate:         Fri Jan  2 05:24:31 2026 PST
```

The extracted text of both pages independently confirms the same revision at two more sites: the
page-1 footer prints `Form 1040 (2025) Created 9/5/25`, and the page-2 header prints `Form 1040
(2025)`. Three independent markers (`pdfinfo` title/subject, the page-1 footer, the page-2 header)
all agree on TY2025 — proceeding to read was warranted.

### Method

Both pages were extracted with `pdftotext -layout` (preserving the form's column structure) and
read in full. Every printed line 1a through 38 was classified as a money line (has a printed dollar
entry box, e.g. `1a`, `25a`) or a checkbox/non-money row (`3c`, `4c`, `6c`, `6d`, `7b`, `12a`–`12d`,
`27b`, `27c`, `35b`–`35d`) by reading the row's own printed content — not assumed from the finding's
framing.

### The full 1a–37 enumeration, in printed order

Counted directly off both pages, one dollar-entry box at a time — **56 printed money lines**, numbered
1 to 56 below purely as a position index (not a form line number):

1 `1a`, 2 `1b`, 3 `1c`, 4 `1d`, 5 `1e`, 6 `1f`, 7 `1g`, 8 `1h`, 9 `1i`, 10 `1z`,
11 `2a`, 12 `2b`,
13 `3a`, 14 `3b`,
15 `4a`, 16 `4b`,
17 `5a`, 18 `5b`,
19 `6a`, 20 `6b`,
21 `7a`,
22 `8`,
23 `9`,
24 `10`,
25 `11a`, 26 `11b`,
27 `12e`,
28 `13a`, 29 `13b`,
30 `14`,
31 `15`,
32 `16`, 33 `17`, 34 `18`, 35 `19`, 36 `20`, 37 `21`,
38 `22`, 39 `23`, 40 `24`,
41 `25a`, 42 `25b`, 43 `25c`, 44 `25d`,
45 `26`,
46 `27a`, 47 `28`, 48 `29`, 49 `30`, 50 `31`,
51 `32`, 52 `33`, 53 `34`,
54 `35a`, 55 `36`,
56 `37`.

This sequence is character-for-character the sequence `orderedLines` (`fjs/form1040/core/module.f.js`
lines 994–1019) walks, in the same order, income lines first then tax-and-payment lines, exactly as
the code's own record keys are named.

### The specific claims the finding named, each checked against the form face rather than assumed

| Claim | Printed form face | Verdict |
|---|---|---|
| 56 printed money lines, 1a through 37 | Counted directly from both pages: 56 dollar-entry boxes, none skipped, none extra | ✓ AGREE |
| 12a–12d are checkboxes | Page 2: "12a Someone can claim ☐ You as a dependent ☐ Your spouse as a dependent"; "b Spouse itemizes on a separate return ☐"; "c ☐ You were a dual-status alien"; "d You: ☐ Were born before January 2, 1961 ☐ Are blind / Spouse: ☐ Was born before January 2, 1961 ☐ Is blind" — none of the four has a dollar-entry box | ✓ AGREE |
| 7b is a checkbox | Page 1: "b ☐ Schedule D not required ☐ Includes child's capital gain or (loss)" — no dollar box | ✓ AGREE |
| Line 38 is out of range | Page 2: "38 Estimated tax penalty (see instructions) . . . 38" — printed, has its own dollar box, but is one past line 37 and is not part of `orderedLines` | ✓ AGREE (confirms the finding's framing rather than assuming it) |
| 7a / 11a / 11b / 12e / 25a-d / 27a / 35a named exactly as the module names them | Printed verbatim on the form face at those positions: "7a Capital gain or (loss)"; "11a" (page 1) / "11b Amount from line 11a" (page 2); "12e Standard deduction or itemized deductions"; "25a Form(s) W-2" / "25b Form(s) 1099" / "25c Other forms" / "25d Add lines 25a through 25c"; "27a Earned income credit (EIC)"; "35a Amount of line 34 you want refunded to you" | ✓ AGREE |

Two rows were checked but are NOT money lines, confirming they were correctly excluded from both the
form's own count and the code: `3c` ("Check if your child's dividends are included in 1 Line 3a 2
Line 3b" — a checkbox pair referencing 3a/3b, not a line of its own) and `4c`/`5c`/`6c`/`6d` (Rollover
/ QCD / PSO / lump-sum-election / MFS-lived-apart checkboxes). `35b`–`35d` (routing number, account
type, account number) are bank-routing fields printed under 35a, not additional dollar lines, and are
likewise absent from `orderedLines` — correctly.

### Result

**AGREE.** The PDF and the code match exactly: 56 printed money lines 1a–37, in the same order
`orderedLines` uses; 12a–12d and 7b are checkboxes; line 38 is printed but out of the 1a-37 range; and
every one of the seven specifically-named labels (7a, 11a, 11b, 12e, 25a-d, 27a, 35a) is printed on
the form face exactly as `fjs/form1040/core/module.f.js` names it. No discrepancy found. `F-01` is
resolved and moved from `human_verification` to `resolved_human_verification` in this report's
frontmatter.

_F-01 closed: 2026-08-09 — Claude (gsd-executor), primary source fetched and read directly, revision
confirmed via `pdfinfo` plus two independent on-page revision markers before any content was relied
upon._

---

## F-02 — Closed: the 19 hand-typed Standard Deduction Chart amounts match the printed chart exactly

_Appended 2026-08-09. Same session as F-01's closure, same reason the item is reopened rather than
left `human_needed`: "the verifier has no access to the IRS PDF" stopped being true once a
network-fetch capability became available._

### Primary source and revision confirmation

Fetched directly from `https://www.irs.gov/pub/irs-pdf/f1040s.pdf` (233,429 bytes, PDF 1.7). Before
reading page 4, `pdfinfo` was run to confirm this is the TY2025 revision:

```
Title:           2025 Form 1040-SR
Subject:         U.S. Income Tax Return for Seniors
Pages:           4
CreationDate:    Fri Jan  2 05:57:16 2026 PST
ModDate:         Fri Jan  2 05:57:16 2026 PST
```

The extracted text independently confirms the same revision at two more sites: the page-1 form
header prints `1040-SR U.S. Income Tax Return for Seniors 2025`, and the page-4 header/footer prints
`Form 1040-SR (2025)` twice (once above the chart, once in the closing line). Three independent
markers (`pdfinfo` title/subject, the page-1 header, the page-4 header/footer) all agree on TY2025 —
proceeding to read was warranted.

### Method

Page 4 was extracted with `pdftotext -layout` (preserving the chart's column structure) and
transcribed box by box, by filing status, **before** opening `fjs/tax/deduction/module.f.js` — so
the comparison below is an independent read compared against the code, not a confirmation pass
against a value already in mind.

### The chart as read off the page

```
Standard Deduction Chart *
  IF your filing status is...                AND boxes checked is...   THEN standard deduction is...
  Single                                       1                         $17,750
                                                2                          19,750
  Married filing jointly                       1                        $33,100
                                                2                          34,700
                                                3                          36,300
                                                4                          37,900
  Qualifying surviving spouse                  1                        $33,100
                                                2                          34,700
  Head of household                            1                        $25,625
                                                2                          27,625
  Married filing separately**                  1                        $17,350
                                                2                          18,950
                                                3                          20,550
                                                4                          22,150
```

Married filing jointly prints four rows (1/2/3/4). Qualifying surviving spouse prints **two** rows
only (1/2) — no third or fourth box row exists in its column, confirmed by the row immediately
following it being the unrelated "Head of household" section header. Married filing separately
prints **four** rows (1/2/3/4), the maximum any status reaches, matching its `**` footnote allowing
a spouse's boxes to be checked under the stated no-income condition.

### Comparison against `fjs/tax/deduction/module.f.js`

The chart's printed rows start at 1 box (a 0-box row is not printed — it is the base standard
deduction carried on the Form 1040 face margin, not part of this chart). Comparing every printed
row against `chartCombinations` (lines 299-326):

| Status | Boxes | Printed | Coded (`chartCombinations`) | Match |
|---|---|---|---|---|
| Single | 1 | $17,750 | `1775000n` | ✓ |
| Single | 2 | $19,750 | `1975000n` | ✓ |
| Married filing jointly | 1 | $33,100 | `3310000n` | ✓ |
| Married filing jointly | 2 | $34,700 | `3470000n` | ✓ |
| Married filing jointly | 3 | $36,300 | `3630000n` | ✓ |
| Married filing jointly | 4 | $37,900 | `3790000n` | ✓ |
| Qualifying surviving spouse | 1 | $33,100 | `3310000n` | ✓ |
| Qualifying surviving spouse | 2 | $34,700 | `3470000n` | ✓ |
| Qualifying surviving spouse | 3/4 | **not printed** | **not present** (`maxAgedOrBlindBoxes.qualifyingSurvivingSpouse = 2`) | ✓ |
| Head of household | 1 | $25,625 | `2562500n` | ✓ |
| Head of household | 2 | $27,625 | `2762500n` | ✓ |
| Married filing separately | 1 | $17,350 | `1735000n` | ✓ |
| Married filing separately | 2 | $18,950 | `1895000n` | ✓ |
| Married filing separately | 3 | $20,550 | `2055000n` | ✓ |
| Married filing separately | 4 | $22,150 | `2215000n` | ✓ |

Every printed non-zero row matches the coded cents exactly, to the cent. The box-count ceiling per
status also matches: `maxAgedOrBlindBoxes` (lines 97-118) sets `single: 2`, `marriedFilingJointly: 4`,
`marriedFilingSeparately: 4`, `headOfHousehold: 2`, `qualifyingSurvivingSpouse: 2` — exactly the
number of rows each status's column prints on the page, including the specific near-miss the finding
named: MFS reaches **four** rows (not three, as an earlier read had it per 10-CONTEXT.md), and QSS
stops at **two**.

`expectedChartCombinationCount = 19` (line 288) was independently recomputed from the transcription:
Single 3 (0/1/2, the 0-row being the base amount) + MFJ 5 (0-4) + MFS 5 (0-4) + HoH 3 (0/1/2) + QSS 3
(0/1/2) = **19**, matching both the hand-typed constant and the table's actual row count.

### Result

**AGREE.** The printed Standard Deduction Chart (f1040s.pdf p4, TY2025) and
`fjs/tax/deduction/module.f.js`'s `chartCombinations` match exactly on all 19 combinations: the four
non-zero MFS rows the finding specifically named ($17,350/$18,950/$20,550/$22,150) are correct, and
the QSS chart genuinely stops at two boxes as `maxAgedOrBlindBoxes.qualifyingSurvivingSpouse = 2`
encodes. No discrepancy found. `F-02` is resolved and moved from `human_verification` to
`resolved_human_verification` in this report's frontmatter.

_F-02 closed: 2026-08-09 — Claude (gsd-executor), primary source fetched and read directly, revision
confirmed via `pdfinfo` plus two independent on-page revision markers, chart transcribed before the
code was read._
