---
phase: 13-the-65-profile-and-the-remaining-schedules
reviewed: 2026-08-11T07:04:23Z
depth: deep
files_reviewed: 21
files_reviewed_list:
  - demo/lib/fixtures.js
  - demo/steps/04-refusal.js
  - demo/steps/05-exactness.js
  - demo/steps/06-parameters.js
  - fjs/document/1099r/module.f.js
  - fjs/document/itemized_deductions/module.f.js
  - fjs/document/w2/module.f.js
  - fjs/form1040/core/module.f.js
  - fjs/form8812/module.f.js
  - fjs/return/profile/module.f.js
  - fjs/return/scope/module.f.js
  - fjs/schedule/1/module.f.js
  - fjs/schedule/1a/module.f.js
  - fjs/schedule/2/module.f.js
  - fjs/schedule/3/module.f.js
  - fjs/schedule/a/module.f.js
  - fjs/tax/boundary/module.f.js
  - fjs/tax/deduction/module.f.js
  - fjs/tax/params/module.f.js
  - fjs/tax/ssb/module.f.js
  - magi-gate.test.js
findings:
  critical: 1
  warning: 5
  info: 2
  total: 8
status: partially_resolved
resolved: 2026-08-20 — 7 of 8 closed; IN-01 stays open as a genuine open question
---

# Phase 13: Code Review Report

**Reviewed:** 2026-08-11T07:04:23Z
**Depth:** deep (cross-file, arithmetic traced against 13-RESEARCH.md's `[VERIFIED: ...]` transcriptions)
**Files Reviewed:** 21
**Status:** partially_resolved — 7 of 8 closed, re-verified 2026-08-20 (see the end of this report)

## Summary

The bulk of this phase is excellent: every dollar figure and formula I spot-checked in
`fjs/tax/ssb`, `fjs/schedule/1a`, `fjs/schedule/a` (including the SALT worksheet's
flat-then-halved w1/w9/w10 mechanic), `fjs/form8812` (including
`roundUpToNextThousandDollars`'s boundary behavior), and `fjs/tax/params` traces exactly to a
`[VERIFIED: ...]` line in 13-RESEARCH.md, and the continuous-vs-stepped phase-out distinction
(item 2 of the review brief) is implemented correctly in both directions. The `modeledKinds`
(20) / `unmodeledKindRefusals` (30) partition sums to the frozen 50-kind vocabulary, the six
parallel structures in `fjs/form1040/core` stay mutually consistent (hand-typed counts of 31
income lines / 56 whole-report lines both check out), and the MAGI gate in `magi-gate.test.js`
correctly closes the case-sensitivity hole it documents.

Against that strong baseline, I found one silent-wrong-number defect (CRITICAL) in Schedule A's
SALT line 5a, two HIGH findings where a feature the phase's own documentation claims is active
turns out not to be wired into any real computation path, and several MEDIUM/LOW
quality/traceability gaps. None of the arithmetic I checked against 13-RESEARCH.md's
transcriptions is wrong; every finding below is either a missing guard on an input the
arithmetic itself never questions, or a documented safeguard that never actually runs against a
real return.

## Critical Issues

### CR-01: Schedule A line 5a silently sums BOTH the income-tax and general-sales-tax SALT elections instead of enforcing the printed form's either/or

**File:** `fjs/schedule/a/module.f.js:388-390`
**Issue:** The 2025 Schedule A line 5a is a single figure the taxpayer computes from *one*
election — state/local income tax paid, **or** general sales tax, never both (`f1040sa.pdf`
line 5a's own checkbox, 13-RESEARCH.md §3). The implementation reads:

```js
const line5a = fromEntries('Schedule A line 5a')(
    addBoxSums(byTag('saltIncomeTax'))(byTag('saltGeneralSalesTax')))
```

`addBoxSums` unconditionally **adds** whatever is tagged `saltIncomeTax` to whatever is tagged
`saltGeneralSalesTax`. Nothing in `vnd.fjs.itemized_deductions`'s `checkReferences`
(`fjs/document/itemized_deductions/module.f.js`) or in `fjs/schedule/a` itself checks that at
most one of the two tags is present. If a stored `vnd.fjs.itemized_deductions` document ever
carries entries under both tags — a data-entry mistake, a buggy importer, or a taxpayer who
changes their election mid-year and both records survive — the engine computes a **SALT
deduction inflated by the sum of both**, silently, with no refusal and no warning. For any
return whose combined total stays under the $40,000 cap, this directly overstates the itemized
deduction and understates tax owed: a confidently wrong number, not a crash — exactly the
failure mode this project's own `AGENTS.md`/TAX-16 discipline exists to prevent.

The module's own docstring acknowledges the assumption but not the risk: "`addBoxSums`... summing
across both tags collapses to 'whichever one is present' without an explicit branch" — this is
only true when the mutual-exclusivity is guaranteed elsewhere, and it is not guaranteed
anywhere in the code.

**Fix:** Add a semantic check — either in `vnd.fjs.itemized_deductions`'s `checkReferences` (a
document may not carry entries under both `saltIncomeTax` and `saltGeneralSalesTax`) or in
`fjs/schedule/a` itself (refuse, or take only one, if both are present):

```js
const incomeTaxPresent = byTag('saltIncomeTax').sources.length > 0
const salesTaxPresent = byTag('saltGeneralSalesTax').sources.length > 0
assert(
    !(incomeTaxPresent && salesTaxPresent),
    ['Schedule A line 5a: saltIncomeTax and saltGeneralSalesTax are mutually exclusive elections', ...],
)
```

Add a proof pinning that a document declaring both refuses (or is otherwise handled), paired
with the existing single-tag cases as controls.

## Warnings

### WR-01 (HIGH): Schedule 8812's stored `childTaxCredit.phaseoutRatePercent` is never read — the 5% rate, the $2,500 earned-income floor, and the 15% ACTC rate are all hardcoded, uncited literals

**File:** `fjs/form8812/module.f.js:264, 316-318`; `fjs/tax/params/module.f.js:670-674`
**Issue:** `fjs/tax/params` stores `childTaxCredit.phaseoutRatePercent = 5` specifically so the
phase-out rate is "data with a citation" like every other figure in this phase (the module's own
docstring: "`phaseoutRatePercent` (5) is a plain rate, mirroring every other `*RatePercent`
field in this module"). But `fjs/form8812`'s actual computation never reads it:

```js
const line11 = halfUp(of(line10 * 5n)(100n))          // hardcoded 5n, not childTaxCredit.phaseoutRatePercent
...
const line19 = line18a > 250000n ? line18a - 250000n : 0n   // $2,500, not in fjs/tax/params at all
const line20 = halfUp(of(line19 * 15n)(100n))                // 15%, not in fjs/tax/params at all
```

Contrast with `fjs/schedule/1a` (`percentOfCents(line33)(BigInt(seniorDeduction.phaseoutRatePercent))`)
and `fjs/schedule/a` (`centsAtRatePercent(w6)(saltCap.phasedownRatePercent)`), both of which
correctly read their rate from the stored, cited parameter set. `childTaxCredit.phaseoutRatePercent`
is consequently decorative: the params proof `childTaxCreditOdcActcCapAndPhaseoutCiteIrc24hOnly`
asserts `childTaxCredit.phaseoutRatePercent === 5`, which reads as though this figure is
load-bearing, but nothing in the computation ever consults it. Separately, the $2,500 threshold
and 15% rate (IRC §24(d), Schedule 8812 Part II-A lines 19-20) have **no** `fjs/tax/params` entry
and **no** `Citation` at all — every other dollar figure and rate this phase introduces got one.
Today's values are correct (13-RESEARCH.md §4 confirms $2,500/15%/5%), so this is not a
currently-wrong number, but it is a silent, untested divergence risk: a future tax-year update
to `phaseoutRatePercent` (or a correction to it) would have **zero effect** on the computed
credit, and no test would catch the mismatch, because `form8812`'s own boundary proofs
(`roundUpToNextThousandDollars.fiftyDollarCliffAtOneCentOverAThreshold`) also hardcode `5n`
rather than reading the stored parameter.
**Fix:** Read `taxParamSet.childTaxCredit.phaseoutRatePercent` in `line11`'s computation instead
of the literal `5n`. Add `actcEarnedIncomeThreshold` and `actcEarnedIncomeRatePercent` (or
similar) to `childTaxCredit` in `fjs/tax/params`, each with a `Citation`, and read them in
`line19`/`line20` instead of the bare `250000n`/`15n` literals.

### WR-02 (HIGH): Decision 2.2's SALT withholding "drift" check never runs against a real return — it is only exercised by its own hand-written test fixtures

**File:** `fjs/schedule/a/module.f.js:440-516, 867-928`
**Issue:** `assertAssertedSaltIncomeTaxIsAtLeastStoredWithholding` implements 13-CONTEXT.md
Decision 2.2 ("A proof asserts that the asserted line 5a is at least the sum of W-2 box 17 and
1099-R box 14 across stored documents") — but it is a **private, module-local function called
only from `fjs/schedule/a`'s own `proof.withholdingDriftProof` leaves**, never from `scheduleA`
itself, and never from `fjs/form1040/core`'s wiring. `grep` confirms it has exactly one caller
site: the proof block below its own definition. A real return processed through
`form1040Report(...)` — with a genuinely too-low asserted `saltIncomeTax` entry sitting next to
a W-2 whose `stateIncomeTax` box shows more was withheld — computes normally with no refusal, no
warning, and no citation of the discrepancy anywhere in the report. The comment directly above
it is candid about this ("A PROOF, never production logic"), but that reads as in tension with
Decision 2.2's own language and with the amended docstrings in `fjs/document/w2` and
`fjs/document/1099r`, both of which now say "a PROOF in `fjs/schedule/a` now READS
`stateIncomeTax`/`stateTaxWithheld` from this array" — worded as an active safeguard a reader
would reasonably expect to run over every processed return, not merely over four hand-written
fixtures.
**Fix:** Either (a) wire the check into `scheduleA`'s own computation (called with the real
`w2Forms`/`oneZeroNineNineRForms` `fjs/form1040/core` already has in scope, refusing or flagging
the return when it fires), or (b) if the "proof-only" design is intentional, say so explicitly
and consistently in 13-CONTEXT.md Decision 2.2's own text and in both documents' docstrings,
rather than describing it in language that reads as an active runtime guard.

### WR-03: New lines 13b, 19, and 28 in `fjs/form1040/core` do not cite the profile facts that actually determine their value

**File:** `fjs/form1040/core/module.f.js:823-827` (line13b), `1208-1212` (line19),
`1275-1279` (line28) — contrast with `695-793` (line12e)
**Issue:** `line13b.sources`, `line19.sources`, and `line28.sources` are each built from
`unionSources([income.line11b])` (plus `line18` for line28) — i.e., AGI's provenance only.
But:
- `line13b`'s value (Schedule 1-A Part V) also depends on `status` (which threshold applies,
  and the MFS short-circuit) and on `taxpayerBornBeforeJan2_1961`/`spouseBornBeforeJan2_1961`
  (which of `line36a`/`line36b` is nonzero) — none of which appear in `line13b.sources`.
- `line19`/`line28`'s value (Schedule 8812) is primarily determined by the profile's
  `dependents` array (ages and SSN-validity, which drive the CTC-vs-ODC counts) — the array
  never appears in either line's `sources`.

This is inconsistent with `line12e`, computed a few dozen lines earlier in the same function,
which carefully builds `twelveESources` from `filingStatusSource` plus every checked
age/blindness box plus every itemized entry specifically so the comparison's own inputs are
traceable. An auditor inspecting `line19.sources` after a dependent's age changes the computed
credit would see only AGI's citation chain, with no indication the `dependents` array was ever
consulted — a real gap against this project's own stated PROV-01/02 discipline
(`fjs/report/line/module.f.js`: "a computed monetary figure that cannot exist... without the
sources it came from").
**Fix:** Extend each line's `sources` to include a `Source` for the profile facts it actually
reads — e.g. `{ documentHash: profile.documentHash, boxPath: 'dependents', value:
JSON.stringify(profile.value.dependents ?? []) }` for line19/28, and the filing-status/age-box
sources (mirroring `twelveDBoxSources`) for line13b.

### WR-04: `vnd.fjs.itemized_deductions`'s free-string `lineTag` lets a misspelled or unrecognized tag silently drop money from Schedule A with no citation or refusal

**File:** `fjs/document/itemized_deductions/module.f.js` (schema); `fjs/schedule/a/module.f.js`
(`sumEntriesByLineTag`, lines 396-420-ish)
**Issue:** `lineTag` is deliberately unconstrained (Decision 2.1: "a free string, not an enum").
`fjs/schedule/a` recognizes exactly eleven tags (`saltIncomeTax`, `saltGeneralSalesTax`,
`realEstateTax`, `personalPropertyTax`, `otherTaxes`, `mortgageInterest1098`,
`mortgageInterestNo1098`, `pointsNo1098`, `charitableCash`, `charitableNonCash`,
`charitableCarryover`, `otherItemized`). An entry stored under any other string — a typo, a
stale tag name after a future rename, a case mismatch — is picked up by **none** of the
`byTag(...)` calls and therefore contributes to **no** line and to the grand total (`line17`) not
at all. Unlike the module's genuine documented zeros (lines 9/15, which cite
`profile.declaredKinds` explicitly so a reader knows why the line is zero), a mistagged entry
produces no citation anywhere: the dollar amount the taxpayer entered simply vanishes with no
trace in the computed report.
**Fix:** At minimum, add a `checkReferences` semantic check in
`fjs/document/itemized_deductions` (or a companion check in `fjs/schedule/a`) that every
`entries[].lineTag` is one of the known set `fjs/schedule/a` actually reads, refusing the
document otherwise — mirroring how `fjs/return/profile`'s `declaredKinds` validation names the
offending value and the known vocabulary.

### WR-05: `seniorDeductionPhaseoutIncome` and `childTaxCreditPhaseoutIncome` are exported but never called by their own module's real computation

**File:** `fjs/schedule/1a/module.f.js:125-137` (function) vs. `152-168`
(`scheduleOneAPartI`, the actual duplicate); `fjs/form8812/module.f.js:156-166` (function) vs.
`234-243` (line1-line3, the actual duplicate)
**Issue:** TAX-15/Decision 3.5 asks for one named income function per rule; three of the four
(`seniorDeductionPhaseoutIncome`, `saltCapPhasedownIncome`, `childTaxCreditPhaseoutIncome`)
currently equal bare AGI. `fjs/schedule/a`'s `saltCapPhasedownIncome` is correctly wired into
its own module's computation (`saltCapWorksheet`'s `w4 = saltCapPhasedownIncome(agiCents)`).
`fjs/schedule/1a`'s `scheduleOneAPartI` and `fjs/form8812`'s `line1`-`line3`, however, each
**re-implement the identical add-back arithmetic inline** rather than calling their own
module's exported named function, which is instead invoked only from a same-module equality
proof (`partILine3EqualsSeniorDeductionPhaseoutIncomeForEveryFixture`,
`linkedIncomeFunction.lineThreeEqualsChildTaxCreditPhaseoutIncomeForEveryFixture`). The
equality proofs currently keep the two copies from silently diverging, but the duplication
itself is avoidable — unlike the deliberate CROSS-module duplication TAX-15 asks for (which is
about not sharing a name/import *across rules*), this is the SAME rule's logic written twice
inside one file.
**Fix:** Have `scheduleOneAPartI`'s `line3` and `form8812`'s `line3` call
`seniorDeductionPhaseoutIncome(agiCents)`/`childTaxCreditPhaseoutIncome(agiCents)` directly,
the same way `fjs/schedule/a` already does — removing the duplicate arithmetic rather than
merely proving it equal.

## Info

### IN-01: `magi-gate.test.js`'s pattern will false-positive on any future identifier merely containing "magi" as a substring

**File:** `magi-gate.test.js:67`
**Issue:** `magiIdentifierPattern = /[a-zA-Z]*[Mm]agi[a-zA-Z]*/` matches any run of letters
containing `[Mm]agi` — which also matches unrelated words like `magic`, `Magistrate`, or
`imaginary` (an `M`/`m` is not required to start the token; `imagi` inside "imaginary" still
matches `[Mm]agi` preceded by `ima`, and the leading `[a-zA-Z]*` absorbs it). No such word
appears anywhere under `fjs/` today, so the gate currently passes, but this is a latent
nuisance-failure: an unrelated future identifier or comment word containing "magi" would trip
the gate for a reason that has nothing to do with a shared-MAGI regression.
**Fix:** Not urgent, but consider anchoring the pattern to identifier boundaries (e.g. requiring
a preceding word boundary before the `[Mm]`) if this ever produces a false positive in practice.

### IN-02: `roundUpToNextThousandDollars` re-checks a zero case its only caller already checked

**File:** `fjs/form8812/module.f.js:182-183, 262`
**Issue:** The caller already guards `excess === 0n ? 0n : roundUpToNextThousandDollars(excess)`,
and the function itself repeats `cents === 0n ? 0n : ...`. Harmless (the function is also
exercised directly by its own standalone proofs, which is presumably why the internal guard
exists), but it is redundant given the one production call site already excludes zero.
**Fix:** None required; noting for awareness only.

---

_Reviewed: 2026-08-11T07:04:23Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_

---

## Re-verified 2026-08-20 — every finding checked against the code, not against a later document

This report kept `issues_found` long after the code stopped matching it. Each finding below was
re-checked by reading the current source; a planning document claiming a fix was never accepted as
evidence for one.

| ID | Disposition | Evidence |
|---|---|---|
| CR-01 | **CLOSED** | `fjs/schedule/a/module.f.js:585` refuses when both SALT elections carry sources, naming both tags, before `line5a` is built; `fjs/form1040/core/module.f.js:1694` propagates it. |
| WR-01 | **CLOSED** | `fjs/form8812/module.f.js:311` reads the stored `childTaxCredit.phaseoutRatePercent`; `:402-406` read the stored ACTC threshold and rate, both cited to §24(d) at `fjs/tax/params/module.f.js:718-724`. |
| WR-02 | **CLOSED** | `fjs/schedule/a/module.f.js:599` runs the drift check inside the real computation, and `fjs/form1040/core/module.f.js:1684` feeds it the return's actual documents. |
| WR-03 | **CLOSED** | `fjs/form1040/core/module.f.js:3125` / `:3344` cite `dependentsSource`; `:1795`'s line 13b cites the filing status and the age/blindness boxes. |
| WR-04 | **CLOSED** | `fjs/schedule/a/module.f.js:558-564` refuses an unrecognized `lineTag`, naming the tag and the known vocabulary, policed against the hand-typed list at `:218-222`. |
| WR-05 | **CLOSED** | `fjs/schedule/1a/module.f.js:177` and `fjs/form8812/module.f.js:286` now CALL the named income functions; the inline duplicates are gone. |
| IN-02 | **FIXED 2026-08-20** | `fjs/form8812/module.f.js` — the caller's `excess === 0n ? 0n :` guard is gone; `roundUpToNextThousandDollars` handles zero in its own first branch and its proof pins it. **Mutated after the edit** (`line10 = excess`) → three leaves red, including `steppedCliff.mfjOneCentOverThresholdCostsTheFullFiftyDollarStep`; restored byte-identically. This report had marked it "no fix required". |
| IN-01 | **STILL OPEN — manual** | `magi-gate.test.js:67`'s `/[a-zA-Z]*[Mm]agi[a-zA-Z]*/` is unchanged, and **this report's own suggested fix is wrong in both directions**: a leading `\b` would still match `magic`/`Magistrate` (both START at a boundary) while losing camelCase `sharedMagi` (no boundary before `M`). What distinguishes an offending identifier from an English word has to be decided before anything is changed. A note whose remedy is wrong — the pattern this repository already records. |
