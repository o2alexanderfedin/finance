---
phase: 10-form-1040-core-line-16-dispatch-and-the-scope-guard
plan: 09
subsystem: form-1040-core-lines
tags: [form-1040, report-lines, provenance, criterion-1, criterion-5, whole-dollar-election, phase-10]

requires:
  - phase: 10-02
    provides: "applyWholeDollarElection — the IRS p23 all-or-nothing election, and the ReportLine/Source types whose non-empty sources tuple is enforced by tsc"
  - phase: 10-04
    provides: "vnd.fjs.return_profile — filingStatus, the four 12d checkboxes, the 12a-12c exception boxes, earnedIncome, declaredKinds, and validate/checkReferences"
  - phase: 10-05
    provides: "standardDeductionCents — six inputs: status, box count, and the four exception fields"
  - phase: 10-07
    provides: "classifyScope / scopeRefusal — the guarantee that a DECLARED but unmodeled kind never reaches this module"
provides:
  - "form1040IncomeLines — Form 1040 lines 1a through 15 as a record of ReportLines keyed by the printed line label"
  - "unionSources — the deduplicated, provably non-empty union of a set of lines' sources; how line 16 will transitively cite every document that fed it (PROV-02)"
  - "Form1040Inputs / Form1040IncomeLines / Stored<T> — the input and output shapes lines 16-37 build on"
  - "The criterion-5 artefact: line 2b over ten real 1099-INT documents, round(sum) = $14 against sum(round) = $10"
affects: [10-10, 11, 12, 13]

tech-stack:
  added: []
  patterns:
    - "A legitimately zero line cites the return profile's own declaredKinds box, so 'declared absent' and 'silently omitted' are distinguishable by inspection rather than by trust"
    - "An intermediate BoxSum (value + possibly-EMPTY source array) sits between reading boxes and building a ReportLine, because PROV-01 forbids a sourceless line and a zero-reading box has no source to give"
    - "Deduplication on (documentHash, boxPath) with a space separator that is safe by construction — a hex hash and an identifier can neither contain one"
    - "A narrowing that RETURNS THE STORED MEMBER (individualFilingStatuses.find) rather than asserting a type predicate over the incoming string: the value that flows onward came from fjs/tax/params, not from the blob"
    - "An exception flag proven END TO END through the profile, because the unit-level proofs of the callee stay green under any wiring bug at the call site"

key-files:
  created:
    - fjs/form1040/core/module.f.js
  modified: []

key-decisions:
  - "sumBoxOverDocuments returns a BoxSum intermediate, not a ReportLine, and takes no rule string: line 2b must ADD two box sums before a line exists, and a box read over zero documents has no source, so it cannot be a ReportLine at all (plan defect 2)"
  - "Task 1's binding is spelled _taxParamSet: no line up to 11b reads a tax parameter, and the plan's stated Task-1 signature fails tsc with TS6133 under noUnusedParameters (plan defect 1, verified). Renamed in Task 2, where line 12e reads it"
  - "The filing status is recovered by finding it in individualFilingStatuses rather than by a type predicate: a `@type`-annotated predicate whose body is `.includes(...)` is rejected by tsc (TS2322, 'must be a type predicate'), and `find` is the stronger construction anyway"
  - "Line 12e's sources are the filingStatus box plus one per CHECKED 12d box, exactly as specified — 12a-12c and earnedIncome also determine the value and are cited only at DOCUMENT granularity. Flagged below rather than widened unilaterally, because 10-10 may pin the count"
  - "'Line 1i is not in 1z' is stated as a comment and NOT as a proof leaf, because it is currently unobservable at runtime — every 1b-1i line is a profile-declared zero citing the same box, so including 1i changes neither the value nor the deduplicated source set"

patterns-established:
  - "Pattern: when only a source COUNT can observe a defect (an absent box defaulted to '0.00' sums identically), the count IS the assertion — a value-only leaf is decoration there"
  - "Pattern: a mutation that returns the first input's value unchanged is ABSORBED by every leaf that passes a single input; the green set is the single-input leaves and that is worth writing down, not explaining away"

requirements-completed: [TAX-06]
requirements-advanced: [TAX-05]
requirements-note: "TAX-05 is 'Form 1040 core lines 1a-37'. This plan ships 1a-15; lines 16-37 are Plan 10-10's, so TAX-05 is deliberately NOT checked off here. TAX-06 (standard deduction with age and blindness increments) is complete: 10-05 wrote the computation, and this plan wires it through the return profile and proves both Dependents-worksheet arms end to end."

duration: ~75min
completed: 2026-08-06
---

# Phase 10 Plan 09: Form 1040 Lines 1a–15, and the Criterion-5 Rounding Proof Summary

**Form 1040 lines 1a through 15 now compute as `ReportLine`s that cite the documents they derived
from — including the lines that are legitimately zero, which cite the return profile's own
declaration — and criterion 5 is demonstrated on a real line aggregating ten real 1099-INT
documents, where `round(sum)` is $14 and `sum(round)` is $10.**

## Performance

- **Duration:** ~75 min
- **Tasks:** 2 of 2
- **Files modified:** 1 (created)
- **Commits:** 2 task commits + this metadata commit

## What Was Built

`fjs/form1040/core/module.f.js`, in two commits:

| Commit | Task | What |
|---|---|---|
| `8f0c743` | 1 | `Stored<T>`, `Form1040Inputs`, `BoxSum`, `unionSources`, `sumBoxOverDocuments`, `addBoxSums`, `documentLine`, `profileDeclaredZeroLine`, `totalLine`, lines 1a–11b, 12 leaves |
| `373f69e` | 2 | `agedOrBlindBoxNames`, `storedFilingStatusNamed`, lines 12e/13a/13b/14/15, the ten-document criterion-5 fixture, 10 leaves |

**Leaf count for this module: 0 before → 12 after Task 1 → 22 after Task 2.**

**Project-local leaves: 449 before → 461 after Task 1 → 471 after Task 2** (+22; the plan's
`<verification>` asked for at least 14). Repo-wide at the end: `npm test` **473 / 473, 0 fail,
`tsc` clean**, working tree clean.

## The property this plan exists to establish

A zero on a tax return is ambiguous, and the ambiguity is the dangerous kind. `line3b = 0n` can
mean *the taxpayer had no ordinary dividends* or *this engine cannot read a 1099-DIV and said
nothing*. Both print the same character in the same box.

The two are separated here by **provenance, not by a flag**: every zero line carries the return
profile's `declaredKinds` box as its single source, with the declared list quoted verbatim as the
source's value. A reader can check for themselves that the kind really is absent. And the other
case never arrives — `fjs/return/scope` (Plan 10-07) refuses the whole report before this function
runs, so "declared but unmodeled" is not a state lines 1a–15 can be in.

Mutation 4 of Task 1 is the one-line demonstration. Emptying `profileDeclaredZeroLine`'s `boxPath`:

```
✖ …proof.line1a.noWTwoIsZeroCitingTheProfilesDeclaredKindsBox()
ℹ tests 463  ℹ pass 462  ℹ fail 1
```

The **value is `0n` either way**. Only the citation moved.

## Criterion 5, made non-vacuous — and proven where the defect would be introduced

Over `bigint` cents `round(sum)` and `sum(round)` are both the identity, so a proof of their
equality tests nothing (10-CONTEXT.md Decision 5). `criterionFiveRoundSumOverTenInterestDocuments`
therefore runs **ten stored `vnd.fjs.1099int` documents with ten distinct hashes**, each carrying
the IRS's own printed example `box1InterestIncome: '1.39'`, through the real line assembly:

| Quantity | Value | Where it comes from |
|---|---|---|
| `line2b.value` | `1390n` | the exact cents sum, computed once |
| `line2b.sources.length` | `10` | one citation per document |
| `round(sum)` — the election applied to the finished line | `1400n` ($14) | what the IRS instructs the taxpayer to enter |
| `sum(round)` — each document assembled into its own line 2b, rounded, then added | `1000n` ($10) | thirty-nine cents lost ten times over |
| the divergence | `400n` ($4) | asserted as a size, not as one side |

`1390n`, `1400n`, `1000n`, `400n` and the count `10` are **all hand-typed**. None is computed from
`139n`, none from another, and none by calling the election.

Task 2's mutation 4 introduces per-document rounding **inside `sumBoxOverDocuments`** — the place
the defect would actually be written, not in the leaf — and the leaf catches it with line 2b
collapsing to `1000n`. **This leaf cannot pass in the cents regime alone**: with the election
declined, `round` is the identity and both sides are `1390n`, so the divergence exists only because
Plan 10-02 modelled the whole-dollar election. That is exactly why Decision 5 exists.

## Line 12e's exception wiring, proven END TO END through the profile

`standardDeductionCents` takes six fields, and Plan 10-05's 35 leaves all call it directly with a
correct input record. **A wiring bug at this call site is therefore invisible to every one of
them.** Task 2's mutation 3b hardcodes `claimedAsDependent: false`:

```
✖ …proof.line12e.dependentBelowTheEarnedIncomeThresholdIsThirteenFiftyThroughTheProfile()
✖ …proof.line12e.dependentAboveTheEarnedIncomeThresholdIsTwentyFourFiftyThroughTheProfile()
ℹ tests 473  ℹ pass 471  ℹ fail 2
```

**Exactly two leaves — and not one leaf in `fjs/tax/deduction` moved.** A dependent entitled to
$1,350 would have been handed the $15,750 chart amount with the entire rest of the suite green.
The two leaves reach the Dependents worksheet's *both* arms (the $1,350 minimum arm and the
$2,450 earned-income arm) through a real `ReturnProfile`, which is the only thing that can see it.

## Mutations — every one run, one at a time, reverted, transcripts real

All nine mutations were run against a **committed** baseline, each verified with
`git diff --numstat` before measuring, each reverted with `git checkout --` before the next.

### Task 1

**Mutation 1 — `unionSources` returns only the FIRST input line's sources** (`numstat`: `1 1`;
written in the binding-live form `lines[0].sources.length > 0 ? lines[0].sources : [first, ...rest]`,
because dropping the tail outright orphans `sourceKey`, `concatenated` and `deduplicated`):

```
✖ …proof.unionSources.deduplicatesTheSamePairAndPreservesFirstSeenOrder()
✖ …proof.line9.sumsTheEightSummandsAndUnionsTheirSourcesDeduplicated()
ℹ tests 463  ℹ pass 461  ℹ fail 2
```

The plan required RED on the line-9 source-union leaf specifically, so that the leaf is asserting
**provenance and not merely a value**. It is: line 9's value is untouched by this mutation and only
`sources.length` (5 → 3) noticed.

**The GREEN half is informative and is the equivalent-mutant shape AGENTS.md names.** Three
`unionSources` leaves stayed green:

| Stayed GREEN | Why |
|---|---|
| `twoBoxesOfOneDocumentAreTwoCitations` | passes a SINGLE line, so "return the first line's sources" is the identity |
| `oneBoxOfTwoDocumentsAreTwoCitations` | same — one input line |
| `completelyOverlappingSourcesStillLeaveANonEmptyTuple` | two lines carrying the *same* source, so the deduplicated union and the first line's sources are the same one-element tuple |
| `line11.elevenBRestatesElevenAWithTheSameSources` | line 10's only source is already in line 9's set, so the union and line 9's own sources coincide |

Those three exist to pin the **key** (that it is the pair, not the hash alone, and not the box path
alone), which a single-line input is the right shape to test. The union across lines is pinned by
`deduplicatesTheSamePairAndPreservesFirstSeenOrder` and by line 9.

**Mutation 2 — line 2b drops the `box3UsSavingsBondsAndTreasuryInterest` term** (`numstat`: `1 1`;
written as `() => undefined` for the box-3 reader rather than deleting the term, because deleting
it orphans `addBoxSums`, whose only call site it is):

```
✖ …proof.line2b.boxOneAndBoxThreeOfOneFormAreTwoCitations()
✖ …proof.line9.sumsTheEightSummandsAndUnionsTheirSourcesDeduplicated()
ℹ tests 463  ℹ pass 461  ℹ fail 2
```

The two-box leaf as predicted, plus line 9 — which is correct and was not predicted: line 9's value
is $75,125.00 and $25.00 of it is box 3.

**Mutation 3 — an absent box defaulted to `'0.00'` WITH a source emitted for it** (`numstat`: `1 1`):

```
✖ …proof.line2b.absentBoxIsSkippedNeverDefaultedToZero()
ℹ tests 463  ℹ pass 462  ℹ fail 1
```

Exactly the predicted single leaf, and exactly the predicted **reason**: the failure is on the
source count, not on the value. `centsFromString('0.00')` is `0n`, so every value in the suite is
unchanged — DOC-11 at the report layer is a claim only a count can make.

**Mutation 4 — `profileDeclaredZeroLine`'s `boxPath` `'declaredKinds'` → `''`** (`numstat`: `1 1`):

```
✖ …proof.line1a.noWTwoIsZeroCitingTheProfilesDeclaredKindsBox()
ℹ tests 463  ℹ pass 462  ℹ fail 1
```

Exactly as predicted. `everyLineCitesAtLeastOneDocument` stayed green, correctly — a line with an
empty box path still has a citation; it just does not say which box.

### Task 2

**Mutation 1 — line 15's floor removed** (`numstat`: `1 1`):

```
✖ …proof.line15.deductionExceedingAdjustedGrossIncomeIsZeroNotNegative()
ℹ tests 473  ℹ pass 472  ℹ fail 1
```

`taxableIncomeIsElevenBMinusFourteen` stayed green, which is the control: where the subtraction is
positive the floor is a no-op, so this is a floor rather than a function that returns zero.

**Mutation 2 — `spouseIsBlind` dropped from `agedOrBlindBoxNames`** (`numstat`: `0 1`, a pure
deletion; nothing is orphaned because `checkedAgedOrBlindBoxes` still feeds the count):

```
✖ …proof.line12e.marriedFilingJointlyWithFourBoxesIsThirtySevenNineCitingFiveBoxes()
ℹ tests 473  ℹ pass 472  ℹ fail 1
```

Exactly one leaf, and it is the one the plan told me to add if it did not exist. The QSS and single
leaves stayed green because neither checks a spouse box — the four-box MFJ profile is the **only**
shape in which a dropped box is visible.

**Mutation 3 — line 12e's `sources` reduced to the `filingStatus` box alone.** AGENTS.md failure
mode 1, on the plan's literal form (`numstat`: `1 1`):

```
fjs/form1040/core/module.f.js(430,11): error TS6133: 'twelveDBoxSources' is declared but its value is never read.
```

Re-run as the semantically identical edit that keeps the binding live —
`[filingStatusSource, ...twelveDBoxSources.slice(0, 0)]` (`numstat`: `1 1`):

```
✖ …proof.line12e.qualifyingSurvivingSpouseWithTwoBoxesIsThirtyFourSevenCitingThreeBoxes()
✖ …proof.line12e.marriedFilingJointlyWithFourBoxesIsThirtySevenNineCitingFiveBoxes()
✖ …proof.line12e.qualifyingSurvivingSpouseCanNeverExceedTwoBoxes()
ℹ tests 473  ℹ pass 470  ℹ fail 3
```

Three leaves — one more than the two the plan implies, because
`qualifyingSurvivingSpouseCanNeverExceedTwoBoxes` asserts the same count as part of its **control**
leg. `singleWithNoCheckedBoxesIsFifteenSevenFiftyCitingFilingStatusAlone` stayed green and is
absorbed: with no box checked, the spread contributes nothing either way.

**Mutation 3b — `claimedAsDependent` hardcoded to `false`** (`numstat`: `1 1`): see the section
above. Two leaves RED, and `fjs/tax/deduction`'s entire suite green.

**Mutation 4 — per-document rounding introduced inside `sumBoxOverDocuments`** (`numstat`: `7 1` —
the replacement spans seven lines because the per-document projection is written through
`applyWholeDollarElection` itself, which is the honest "`applyWholeDollarElection`-equivalent per
document" the plan asks for; no expectation literal is on any of the touched lines):

```
✖ …proof.criterionFiveRoundSumOverTenInterestDocuments()
  [ 1000n, 1390n ]
ℹ tests 473  ℹ pass 472  ℹ fail 1
```

Exactly the predicted single leaf and exactly the predicted value: line 2b became `1000n`.

**The GREEN set is the reason this mutation had to be measured on the ten-document fixture.** Every
other money leaf in this module stayed green, because every other fixture amount is already a whole
number of dollars: `'50000.00'`, `'25000.00'`, `'100.00'`, `'25.00'`, `'7.00'`, `'5000.00'`. A
suite built only from round test amounts cannot see per-item rounding at all. Ten `$1.39` amounts
are the sharpest available demonstration precisely because each loses 39 cents and every loss falls
the same way.

## Deviations from Plan

### Auto-fixed issues

**1. [Rule 3 — Blocking] Task 1's stated signature does not compile.**

- **Found during:** Task 1
- **Issue:** The plan's action block specifies
  `form1040IncomeLines: (taxParamSet: TaxParamSet) => (inputs: Form1040Inputs) => Form1040IncomeLines`
  for Task 1, but no line from 1a to 11b reads a tax parameter — the standard deduction is the first
  one that does, and it is line 12e, which Task 2 adds. `tsconfig` sets `noUnusedParameters`.
  Verified rather than assumed: `fjs/form1040/core/module.f.js(284,36): error TS6133: 'taxParamSet'
  is declared but its value is never read.`
- **Fix:** The Task-1 binding is spelled `_taxParamSet` — TypeScript's own documented exemption,
  not a suppression — with the reason stated at the site. The **type annotation keeps the public
  name** `taxParamSet`, so the exported signature is exactly the plan's. Task 2 renames the binding
  when line 12e starts reading it.
- **Files modified:** `fjs/form1040/core/module.f.js`
- **Commits:** `8f0c743`, `373f69e`

**2. [Rule 3 — Blocking] `sumBoxOverDocuments` cannot take a rule string.**

- **Found during:** Task 1
- **Issue:** The plan's action block says `sumBoxOverDocuments` is "given the documents, a box name,
  **and a rule string**". It cannot be. Two independent reasons: (a) line 2b is box 1 **plus** box 3,
  so two box sums must be added *before* a line exists; (b) a box read over zero documents yields
  zero sources, and a `ReportLine` with no sources does not typecheck (PROV-01) — which is precisely
  the "no W-2 at all" case the plan's own `<behavior>` block requires. A `rule` parameter would
  therefore be unused and fail `tsc` with TS6133.
- **Fix:** `sumBoxOverDocuments` returns a `BoxSum` — a value plus a possibly-EMPTY plain source
  array — and the `rule` moves to `documentLine`, which is also the one place that has the profile
  in hand and can fall back to `profileDeclaredZeroLine`. The emptiness is handled once, at the one
  place that can handle it. Every name the plan's mutations grep for is preserved.
- **Files modified:** `fjs/form1040/core/module.f.js`
- **Commit:** `8f0c743`

**3. [Rule 3 — Blocking] Task 1's `grep -cE '\bas [A-Z]|!\.'` gate matched English prose.**

- **Found during:** Task 1
- **Issue:** The gate must be exactly `0`. It returned `1`, on the docstring phrase "renders the
  declared kind list **as J**SON text" — ordinary prose, not a type cast. The gate is sensitive to
  any sentence containing "as " followed by a capitalised word, which in a file that documents its
  own reasoning is not a rare event.
- **Fix:** Reworded to "renders the declared kind list **into** JSON text". The gate now reads `0`
  and still means what it was written to mean. Recorded because the next plan that reuses this gate
  will hit it again.
- **Files modified:** `fjs/form1040/core/module.f.js`
- **Commit:** `8f0c743`

**4. [Rule 3 — Blocking] A `@type`-annotated type predicate is rejected by `tsc`.**

- **Found during:** Task 2
- **Issue:** The profile stores `filingStatus` as a `string`; `standardDeductionCents` needs an
  `IndividualFilingStatus`. The obvious narrowing —
  `/** @type {(status: string) => status is IndividualFilingStatus} */ const f = s => names.includes(s)` —
  fails: `TS2322: Type '(status: string) => boolean' is not assignable … Signature must be a type
  predicate.` TypeScript only infers a predicate from a narrow set of body forms, and `.includes` is
  not one of them.
- **Fix:** `storedFilingStatusNamed` returns
  `individualFilingStatuses.find(candidate => candidate === status)`, i.e.
  `IndividualFilingStatus | undefined`, narrowed at the call site by `assert`. This is **stronger**
  than a predicate would have been: the value that flows onward is the member of `fjs/tax/params`'
  own list that matched, not the string that came out of the blob. No cast, no `!`, no `any`.
- **Files modified:** `fjs/form1040/core/module.f.js`
- **Commit:** `373f69e`

### Deliberate non-deviations

**Line 12e's source set was NOT widened.** The plan specifies `sources` as the profile's
`filingStatus` box plus one per checked 12d box, and that is what shipped. But three other profile
boxes materially determine this line's value and are cited only at **document** granularity (the
same `documentHash`, via `filingStatus`): `claimedAsDependent`, `spouseItemizes`, `dualStatusAlien`
— and `earnedIncome`, which the Dependents worksheet reads. A dependent's line 12e can differ from
the chart amount by $14,400 with nothing in `sources` naming the box responsible.

This was **not** auto-fixed, for two reasons: the plan's own leaf expectations pin the counts
("an all-boxes-clear return cites exactly one box, and a two-box return cites three"), and Plan
10-10 assembles the full report and may assert on them. It is flagged here as a decision for the
phase owner rather than resolved in a commit. Note that criterion 1's requirement — each line citing
the *documents* it derived from — **is** satisfied today; the gap is box granularity, not document
provenance.

## Discovered Properties

**"Line 1i is not in 1z" is currently unobservable at runtime.** The printed form stops line 1z's
addition at 1h, and the plan asks for that to be noted in a comment. It is — but no proof leaf
claims to test it, deliberately. Every one of lines 1b–1i is a `profileDeclaredZeroLine` valued
`0n` and citing the *same* `(profileHash, 'declaredKinds')` pair, so adding 1i to 1z changes
neither the value (`0n + 0n`) nor the deduplicated source set. The mutation is an **equivalent
mutant by construction**, absorbed by the deduplication two operations away. It becomes observable
the moment any of 1b–1i gains a document dialect of its own, and the comment at the site is what
will make that reviewable then. Writing a leaf for it today would have been decoration.

**A one-input leaf cannot see a "return the first input" mutation.** Recorded above under Task 1
mutation 1. Three `unionSources` leaves stayed green and are still worth their place — they pin the
composition of the dedup *key*, which is a different property from the union across lines, and it
is the one-line shape that tests it cleanly.

## Threat Register Outcomes

| Threat ID | Disposition | Evidence |
|---|---|---|
| T-10-09-01 | mitigated | Every zero line cites `declaredKinds` with the list quoted; Task 1 mutation 4 reddens when the box path is emptied, with the value unchanged at `0n` |
| T-10-09-02 | mitigated | `sumBoxOverDocuments` skips absent boxes; Task 1 mutation 3 reddens on the source COUNT, which is the only observer |
| T-10-09-03 | mitigated | `unionSources` deduplicates on the pair and returns a non-empty tuple; Task 1 mutation 1 reddens the line-9 provenance assertion while its value is untouched |
| T-10-09-04 | mitigated | Ten-document criterion-5 leaf; Task 2 mutation 4 introduces per-document rounding at the summation site and is caught at `1000n` vs `1390n` |

No new security-relevant surface: this module opens no network path, reads no filesystem, mints no
hash, and re-validates nothing. No threat flags.

## Known Stubs

None. Every line 1a–15 the plan names is computed or is a profile-declared zero with its provenance
attached; no line returns a placeholder, and no data source is left unwired.

## Verification

- `npm test` — **473 tests, 473 pass, 0 fail**, `tsc` clean
- Project-local proof leaves: `node --test 2>&1 | grep -c '^✔ import("./fjs/'` → **471** (449 at the
  plan's start; +22, against a required +14)
- `grep -c "line1a\|line1z\|line11b"` → 26
- `grep -cE "\|\| *'0\.00'|\?\? *'0\.00'"` → **0** (no absent box is defaulted)
- `grep -cE '\bas [A-Z]|!\.'` → **0** (no cast, no non-null assertion)
- `grep -c "1390n"` → 2, `grep -c "1400n"` → 2, `grep -c "1000n"` → 2, `grep -c "sha256-int-10"` → 1
- Working tree clean; every mutation reverted and re-verified green

## Self-Check: PASSED

- `fjs/form1040/core/module.f.js` — FOUND
- `.planning/phases/10-form-1040-core-line-16-dispatch-and-the-scope-guard/10-09-SUMMARY.md` — FOUND
- Commit `8f0c743` — FOUND
- Commit `373f69e` — FOUND
