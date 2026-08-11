# Phase 13: The 65+ Profile and the Remaining Schedules - Research

**Researched:** 2026-08-10
**Domain:** TY2025 individual income tax forms — Schedule 1-A (new, OBBBA), the Social
Security Benefits Worksheet, Schedule A, Schedule 8812, and Schedules 1/2/3.
**Confidence:** HIGH on every numeric/structural claim below — every dollar figure, line
number, and arithmetic rule was read directly from the published 2025 IRS PDF, not recalled.
LOW only on the exact codified U.S. Code section numbers for the newest OBBBA provisions
(flagged individually) and on two profile-design questions the frozen `kindVocabulary` cannot
currently resolve (flagged in Open Questions).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**1. Phase Shape and Scope Boundary**
- 1.1 — One phase, wave-decomposed. No 13.1 split. Estimated 9–11 plans.
- 1.2 — Form 1040 lines 4a/4b and 5a/5b are wired from `vnd.fjs.1099r` in this phase.
  `iraDistributions` and `pensionsAndAnnuities` move from `unmodeledKindRefusals` to
  `modeledKinds`.
- 1.3 — Form 1040 line 25b is wired (from 1099-R / 1099-DIV / 1099-B withholding boxes).
- 1.4 — Five kinds KEEP REFUSING, remedy strings CORRECTED: `householdEmployeeWages` (1b),
  `medicaidWaiverPayments` (1d), `otherEarnedIncome` (1h), `federalTaxWithheldOnOtherForms`
  (25c) → "no dialect models it (no phase yet)"; `netQualifiedDisasterLoss` (12e exception) →
  "requires Form 4684 (no phase yet)".
- 1.5 — Kind arithmetic must balance and be stated: `modeledKinds` 12 → new total,
  `unmodeledKindRefusals` 38 → complement, `kindVocabulary` stays 50.

**2. Schedule A — Where the Itemized Numbers Come From**
- 2.1 — ONE new taxpayer-asserted dialect, `vnd.fjs.itemized_deductions`, following
  `vnd.fjs.medical_expenses` verbatim: no `formRevision`, no stored totals, free-string
  categories. Medical expenses stay in their own existing dialect.
- 2.2 — Schedule A line 5a stays TAXPAYER-ASSERTED; stored withholding becomes a PROOF
  (never an input) that asserted line 5a ≥ W-2 box 17 + 1099-R box 14, only when the
  income-tax election is in force. `fjs/document/w2` and `fjs/document/1099r` docstrings must
  be amended (they currently claim nothing reads the state/local rows).
- 2.3 — Every printed Schedule A line is modeled. Unpopulatable lines are documented zeros
  with the boundary stated in the module's own docstring.
- 2.4 — The comparison lives in `fjs/tax/deduction` as a named `deductionChoice`, returning
  `{ chosen: 'standard' | 'itemized', standard, itemized }`. 1040 line 12 cites BOTH figures.
  Criterion 3 requires proofs in BOTH directions, including a case above $15,750/$31,500 where
  itemizing still loses.
- 2.5 — The Schedule A line 18 election joins `vnd.fjs.return_profile`, like
  `hadForeignFinancialAccount`.

**3. Schedule 1-A, the SSB Worksheet, and the MAGI Rule**
- 3.1 — New TY2025 numbers extend `fjs/tax/params`, each with its own citation. The existing
  `unmodifiedParametersCite2024_40Only` proof is not loosened — it gets a sibling proof for
  the OBBBA-sourced set.
- 3.2 — Schedule 1-A parts the profile does not reach are DOCUMENTED ZEROS, not refusals (the
  50-kind vocabulary carries exactly one kind, `seniorAndOtherScheduleOneADeductions`, for the
  whole of Schedule 1-A). "The exact part numbering comes from research against the printed
  form; the criterion names Parts I/V/VI and research confirms or corrects that."
- 3.3 — The SSB worksheet computes in printed IRS order, one pass; the one true cycle REFUSES
  loudly. Ordering: other income → the worksheet → line 6b → AGI → the Schedule 1-A phase-out.
  The genuine circularity is the IRA-deduction ↔ taxable-SS pair (Pub 590-A Worksheet 1-1),
  out of this phase. When the profile declares an IRA deduction on Schedule 1, the return
  refuses with a named remedy.
- 3.4 — Criterion 2's case must land taxable SS in the 85% tier and include tax-exempt
  interest (1040 line 2a), which the worksheet adds back.
- 3.5 — TAX-15/criterion 5: one named income function per rule, in the module that owns the
  rule, each stating its own add-back list. Indicative names given: `socialSecurityCombinedIncome`,
  `seniorDeductionPhaseoutIncome`, `saltCapPhasedownIncome`. No shared "MAGI" anything.
- 3.6 — The criterion is enforced MECHANICALLY: a gate proof walks `fjs/` and fails on a
  lowercase `magi` token. Uppercase `MAGI` in prose stays permitted.

**4. Dependents, Schedule 8812, and Schedules 1/2/3**
- 4.1 — `vnd.fjs.return_profile` grows a `dependents` array (relationship, SSN valid for
  employment, age at year end, lived-with-taxpayer); `dependentCount` is KEPT with a proof
  that the array length equals it.
- 4.2 — Schedules 1, 2, and 3 model every printed line. Populatable lines compute; the rest
  are documented zeros with the boundary in each module's docstring. Documented zero and
  scope refusal stay strictly distinct.
- 4.3 — Schedule 8812 is modeled in FULL, both halves (line 19 and line 28).
- 4.4 — Three waves: Wave 1 (leaves, parallel) — params, `vnd.fjs.itemized_deductions`,
  `return_profile` extension. Wave 2 (schedules, parallel) — Schedule 1-A; SSB worksheet;
  Schedule A + `deductionChoice`; Schedule 8812; Schedules 1/2/3. Wave 3 (atomic) — 1040
  wiring first, then scope reclassification, then the MAGI gate proof.

### Claude's Discretion
- Module paths for the new schedules (`fjs/schedule/a`, `fjs/schedule/1a` or similar,
  `fjs/form8812`).
- Exact function names for the per-rule income definitions and worksheet lines — research
  against the printed forms decides these, subject to TAX-15's rule that each carries the
  printed line numbers in IRS order.
- Plan-to-wave assignment within the three-wave structure, and whether Wave 2's five schedules
  are five plans or fewer.
- The precise field list of `vnd.fjs.itemized_deductions`, subject to 2.1's constraints.

### Deferred Ideas (OUT OF SCOPE)
- Pub 590-A Worksheet 1-1 (the IRA-deduction ↔ taxable-social-security fixed point). Refused
  loudly in this phase; a future phase can model it.
- Form 4684 and the net qualified disaster loss.
- The §1202 exclusion percentage.
- Form 4952 and the investment interest election.
- Form 1098/1098-E as transcribed dialects.
- State returns.
- Capital loss carryover (TAX-17) — Phase 15, T3.
- Household employee wages, Medicaid waiver payments, other earned income, other-form
  withholding.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TAX-09 | Schedule 1-A Parts I/V/VI, senior deduction, 6% phase-out $75k/$150k, feeds 1040 line 13b | §1 below — full line-by-line transcription of the actual 2025 form, confirms Parts I/V/VI, corrects one CONTEXT.md-adjacent assumption (MFJ-only filing requirement, continuous not stepped phase-out) |
| TAX-10 | Social Security Benefits Worksheet, 19-line near-circular computation | §2 below — full 2025 worksheet transcription; **corrects the line count to 18, not 19** (Contradiction §A); resolves the circularity precisely |
| TAX-12 | Schedule 8812, both halves | §4 below — full 2025 form transcription, CTC $2,200/ODC $500/ACTC $1,700 cap, phase-out mechanics, Credit Limit Worksheet A |
| TAX-13 | Schedule A, compared against standard deduction | §3 below — full 2025 form + instructions transcription: medical 7.5% floor, SALT $40k cap + phase-down worksheet, mortgage interest limits, charitable AGI limits (deferred to Pub 526, not on the form face), confirms no TY2025 OBBBA itemized-deduction haircut |
| TAX-14 | Schedule 1, 2, 3 to the extent the profile reaches them | §5 below — full 2025 form transcriptions of all three; for THIS profile almost every line is a documented zero |
| TAX-15 (already complete, extended by this phase) | One named income function per rule, no shared `magi` | §6 below — the per-rule MAGI inventory; **this phase needs FOUR named functions, not the three CONTEXT.md names as indicative examples** |
| TAX-16 (scope guard, already complete, extended by this phase) | Loud refusal on unmodeled input | §9 (ordering) and Open Questions — flags where the frozen `kindVocabulary`'s coarse kinds (`scheduleOneAdjustments`, `scheduleTwoTaxes`, `scheduleThreeNonrefundableCredits`) cannot distinguish an IRA deduction from other Schedule 1 adjustments |
</phase_requirements>

## Summary

All five forms this phase needs (Schedule 1-A, the Social Security Benefits Worksheet inside
the Form 1040 instructions, Schedule A, Schedule 8812, and Schedules 1/2/3) are **published,
final, 2025-revision PDFs**, fetched and read directly from irs.gov — not drafts. Every
number, line label, and arithmetic rule in this document was transcribed from those PDFs, not
recalled from training data, and is tagged `[VERIFIED: <file> p<N>]` below.

**Primary recommendation:** the criterion-1 claim "Schedule 1-A Parts I/V/VI" is **exactly
correct** — confirmed against the printed form, not merely plausible. Part I computes a MAGI
(AGI + Puerto Rico/Form 2555/Form 4563 add-backs) shared by all four of Schedule 1-A's own
sub-deductions; Part V is the $6,000-per-qualifying-taxpayer senior deduction with a
**continuous** (not $1,000-stepped) 6% phase-out over $75,000/$150,000; Part VI sums Parts
II/III/IV/V (13+21+30+37) to line 38, which feeds 1040 line 13b. The senior deduction is
available to itemizers and standard-deduction filers alike, but is **categorically unavailable
to married-filing-separately filers regardless of income** — a fact not on the CONTEXT.md
radar and load-bearing for the boundary proofs.

The Social Security Benefits Worksheet the Form 1040 instructions print has **18 lines, not
19** — a correction to TAX-10's and criterion 2's stated line count (§Contradictions). Its
near-circularity is confirmed exactly as CONTEXT.md Decision 3.3 describes: worksheet line 6
adds back Schedule 1 lines 11–20, 23, and 25 (i.e., every Part II adjustment **except** the
student loan interest deduction, line 21), which includes the IRA deduction (line 20) — the
one adjustment whose own amount depends, per Pub 590-A Worksheet 1-1, on a MAGI that itself
includes taxable Social Security. No other Schedule 1 adjustment creates this cycle.

Schedule A's own face performs limitation arithmetic for exactly two of its six sections —
the 7.5% medical floor and the $40,000 SALT cap with its 30%-phase-down-to-a-$10,000-floor —
and defers every other limitation (mortgage-interest acquisition-debt caps, charitable AGI
percentage limits) to worksheets and publications this project does not model, confirming
Decision 2.1's "no floor or cap can be applied without an AGI the document cannot see" as the
correct scope boundary for those lines. Neither OBBBA itemized-deduction change commonly
discussed (the 0.5% charitable AGI floor, the "2/37ths" high-income haircut) applies to
TY2025 — both are confirmed effective TY2026 by the very "What's New" section of the 2025
instructions.

Schedule 8812's CTC is $2,200/child (OBBBA-increased from $2,000, confirmed in **Rev. Proc.
2025-32 §2.03** — the same document already governing this project's standard deduction
citation), ODC is $500, ACTC is capped at $1,700/child, and the phase-out is $400,000
MFJ/$200,000 other, 5% per $1,000-rounded-up-increment (a true cliff at the threshold, unlike
the senior deduction's continuous curve).

Schedules 1, 2, and 3 are fully transcribed below; for the profile this phase targets (65+,
W-2, 1099-INT, 1099-DIV/1099-B, 1099-R, SSA-1099, dependents, itemizing) **almost every line
on all three schedules is a documented zero** — none of Schedule 1's income or adjustment
items, and none of Schedule 2's or 3's credits/taxes, are populated by any kind this project's
frozen 50-kind vocabulary can express for this profile, except possibly a Schedule 1
adjustment the vocabulary cannot currently distinguish (see Open Questions).

The per-rule MAGI inventory turns up a genuine structural surprise: Schedule 1-A's senior
deduction, the SALT cap phase-down, and Schedule 8812's CTC/ODC phase-out **all read the
identical income measure** — AGI plus Puerto Rico exclusion plus Form 2555 lines 45/50 plus
Form 4563 line 15 — confirmed by transcribing all three worksheets side by side. Since Form
2555/4563/Puerto Rico exclusion are all outside this engine's modeled scope (and stay
refused), all three measures are, for every return this engine can actually compute, provably
equal to bare AGI. TAX-15/Decision 3.5 still wants three (in fact **four** — Schedule 8812
needs its own, which CONTEXT.md's three example names did not individually count) separately
named functions, each stating its own add-back list, in the style of the QSS/MFJ
independently-stored-despite-equal-values precedent already in `fjs/tax/params`.

## Detailed Findings by Research Question

### §1. Schedule 1-A (TY2025) — full transcription

`[VERIFIED: f1040s1a.pdf (2025), both pages, "Created 11/4/25"]`

**Parts, confirmed exactly as criterion 1 names them:**

| Part | Subject | Lines |
|------|---------|-------|
| I | Modified Adjusted Gross Income (MAGI) Amount | 1, 2a-2e, 3 |
| II | No Tax on Tips | 4a-4c, 5-13 |
| III | No Tax on Overtime | 14a-14c, 15-21 |
| IV | No Tax on Car Loan Interest | 22a-22b, 23-30 |
| V | Enhanced Deduction for Seniors | 31-37 |
| VI | Total Additional Deductions | 38 |

Parts II/III/IV are out of this phase's scope (Decision 3.2, documented zeros) but Part I's
MAGI is the shared input to ALL FOUR of Parts II-V, so it is fully in scope regardless.

**Part I (MAGI), lines 1-3:**
```
line1  = Form 1040/1040-SR/1040-NR line 11b                         [= AGI]
line2a = Puerto Rico excluded income                                 [always 0 — not modeled]
line2b = Form 2555 line 45                                           [always 0 — refused if declared]
line2c = Form 2555 line 50                                           [always 0 — refused if declared]
line2d = Form 4563 line 15                                           [always 0 — not modeled]
line2e = line2a + line2b + line2c + line2d
line3  = line1 + line2e                                              [Schedule 1-A's shared MAGI]
```

**Part V (Enhanced Deduction for Seniors), lines 31-37 — full arithmetic:**
```
line31 = line3 (the shared MAGI)
line32 = $75,000 ($150,000 if MFJ)
line33 = line31 - line32; if zero or less, SKIP line34 and enter $6,000 directly on line35
line34 = line33 x 6% (0.06)                       -- CONTINUOUS, no $1,000-increment stepping
line35 = $6,000 - line34; if zero or less, enter -0-
line36a = IF taxpayer has valid SSN AND was born before Jan 2, 1961: enter line35, else blank
line36b = IF MFJ AND spouse has valid SSN AND spouse was born before Jan 2, 1961: enter line35, else blank
line37 = line36a + line36b                        -- "Enhanced deduction for seniors"
```
**Eligibility gate, printed as a caution box, not as arithmetic:** "You and/or your spouse
must have a valid social security number. **If married, you must file jointly to claim this
deduction.**" MFS filers get **$0**, unconditionally — this is a filing-status gate that must
run BEFORE the arithmetic above, not a consequence of the arithmetic (Pitfall 3, Contradiction
§C).

**Part VI (Total), line 38:**
```
line38 = line13 (tips) + line21 (overtime) + line30 (car loan) + line37 (seniors)
       -> Form 1040/1040-SR line 13b (or 1040-NR line 13c)
```
This directly answers "which line of Schedule 1-A totals into Form 1040 line 13b": **line 38**.

**Available to itemizers as well as standard-deduction filers:** `[VERIFIED: i1040sca.pdf
p1, "What's New"]` — "If you are eligible, you can claim these deductions even if you itemize
on Schedule A." Confirmed independently by Schedule 1-A's own instructions being separate from
Schedule A's — Schedule 1-A deductions apply at 1040 line 13b, AFTER the standard/itemized
choice at line 12e, not as an alternative to it.

**Per-taxpayer, not per-return, for MFJ:** the phase-out (lines 31-35) is computed ONCE on the
COMBINED MAGI (line 3, which for MFJ is the couple's joint AGI), producing a single
already-reduced per-qualifying-taxpayer amount (line 35) — but that SAME reduced amount is then
granted SEPARATELY to each spouse who independently qualifies (lines 36a and 36b), up to
$12,000 combined for an MFJ couple where both spouses are 65+. It is not "one $6,000 phased out
once"; it is "one phase-out computation, applied once per qualifying spouse."

### §2. The Social Security Benefits Worksheet — full transcription

`[VERIFIED: i1040gi.pdf (2025) p32, "Social Security Benefits Worksheet—Lines 6a and 6b"]`

**It has 18 lines, not 19** (Contradiction §A). Full transcription, in printed order:
```
line1  = total of box 5 of ALL Forms SSA-1099 and RRB-1099           -> also 1040 line 6a
line2  = line1 x 50% (0.50)
line3  = 1040 lines 1z + 2b + 3b + 4b + 5b + 7a + 8 combined
line4  = 1040 line 2a (tax-exempt interest)                          [THE add-back, Decision 3.4]
line5  = line2 + line3 + line4
line6  = Schedule 1 lines 11 through 20, and 23 and 25, total        [excludes line21 student-loan
                                                                        interest and line22 reserved]
line7  = IF line6 >= line5: STOP, benefits not taxable, 1040 line6b = 0
         ELSE: line5 - line6
line8  = filing-status base amount:
           MFJ: $32,000
           single/HoH/QSS, or MFS-lived-apart-all-year: $25,000
           MFS-lived-with-spouse-at-any-time-in-2025: SKIP to line16 = line7 x 85%, then go to line17
line9  = IF line7 <= line8: STOP, benefits not taxable, 1040 line6b = 0
         ELSE: line7 - line8
line10 = second threshold: $12,000 MFJ; $9,000 single/HoH/QSS/MFS-lived-apart
line11 = line9 - line10; if zero or less, enter -0-
line12 = smaller of line9 or line10
line13 = line12 / 2
line14 = smaller of line2 or line13
line15 = line11 x 85% (0.85); if line11 is 0, enter -0-
line16 = line14 + line15
line17 = line1 x 85% (0.85)
line18 = smaller of line16 or line17              -- "Taxable social security benefits" -> 1040 line6b
```

**Base amounts, confirmed exactly ($25,000/$32,000/MFS-special-case):** matches TAX-10's
stated figures. The MFS-living-with-spouse case is a genuine THIRD branch (not merely
"$0 base"), skipping lines 8-15 entirely and computing `line16 = line7 * 85%` directly.

**Line 3's 1040 lines, confirmed against CONTEXT.md Decision 1.2's claim ("1040 lines 1z, 2b,
3b, 4b, 5b, 7 and 8"):** the worksheet literally says **"7a"**, not bare "7" — consistent with
this project's own line-naming (`fjs/form1040/core` already names it `line7a`). Confirmed
exact match, no correction needed.

**Line 4 confirms Decision 3.4's tax-exempt-interest add-back** — `1040 line 2a`, added
directly (not netted against anything), exactly as CONTEXT.md states.

**The circularity, precisely:** line6 pulls in Schedule 1 line 20 (the IRA deduction) among
its 11 summands. Per Pub 590-A Worksheet 1-1, the IRA deduction's own allowed amount depends on
a "modified AGI" that adds back, among other things, the taxable amount of social security
benefits (1040 line 6b) — which is exactly what THIS worksheet's line18 produces. So: to
compute worksheet line6 you may need the IRA deduction (Schedule 1 line 20); to compute the
IRA deduction you may need worksheet line18. **The cycle is reachable if and only if the
taxpayer both (a) has taxable social security benefits declared AND (b) makes an IRA
contribution that is subject to the deductibility phase-out** (i.e., is an active participant
in an employer plan, or MFJ with a spouse who is, per IRC §219(g) — a fact this engine has no
way to observe). A taxpayer with an IRA deduction that is NOT phase-out-limited (e.g., neither
spouse is an active plan participant) does not actually create the cycle in practice, but this
engine cannot distinguish that case from the phase-out-limited case without modeling §219(g)
itself — so Decision 3.3's blanket refusal on any declared IRA deduction is the conservative,
correct choice, not an overcautious one. **No other Schedule 1 adjustment (lines 11-19, 23,
25) creates this cycle** — none of them has an eligibility test that itself depends on taxable
social security.

**Which case exercises the worksheet hardest (criterion 2):** a case where line11 > 0 (lands
in the 85% tier via line15) AND includes nonzero tax-exempt interest (line4) — the tax-exempt
interest changes line5, which changes line7/9/11/12/13/14, so a case with $0 tax-exempt
interest cannot distinguish a correct implementation from one that silently omits the add-back
(exactly Decision 3.4's point). The two-tier arithmetic (line14 "smaller of line2 or line13"
plus line15's 85%-of-excess) is exercised whenever line11 > 0, which requires line9 > line10
(income comfortably above BOTH thresholds) — a single high-income 65+ filer with substantial
1099-R distributions plus full SSA-1099 benefits reaches this easily.

### §3. Schedule A (TY2025) — full transcription

`[VERIFIED: f1040sa.pdf (2025), both pages, "Created 11/20/25"; i1040sca.pdf, both pages]`

**All 18 printed lines, six sections:**
```
Medical and Dental Expenses:
  line1 = medical/dental expenses
  line2 = 1040 line 11b (AGI)
  line3 = line2 x 7.5% (0.075)
  line4 = line1 - line3; if line3 > line1, enter -0-

Taxes You Paid:
  line5a = state/local income OR general sales taxes (checkbox: which election)
  line5b = state/local real estate taxes
  line5c = state/local personal property taxes
  line5d = line5a + line5b + line5c
  line5e = smaller of line5d or $40,000 ($20,000 MFS) -- OR the SALT worksheet result if
           AGI > $500,000 ($250,000 MFS) or Form 2555/4563/PR-exclusion completed
  line6  = other taxes (foreign income tax, GST on certain distributions)
  line7  = line5e + line6

Interest You Paid:
  line8a = mortgage interest/points reported on Form 1098
  line8b = mortgage interest not reported on Form 1098
  line8c = points not reported on Form 1098
  line8d = reserved
  line8e = line8a + line8b + line8c
  line9  = investment interest (Form 4952) -- OUT OF SCOPE, refused kind
  line10 = line8e + line9

Gifts to Charity:
  line11 = cash or check gifts
  line12 = non-cash gifts
  line13 = prior-year carryover
  line14 = line11 + line12 + line13

Casualty and Theft Losses:
  line15 = federally-declared-disaster losses (Form 4684) -- OUT OF SCOPE

Other Itemized Deductions:
  line16 = other, from a fixed IRS-published list (gambling losses etc.)

Total Itemized Deductions:
  line17 = line4 + line7 + line10 + line14 + line15 + line16  -> 1040 line 12e
  line18 = [CHECKBOX] elect to itemize even though less than standard deduction
```

**Medical floor: 7.5%, confirmed unchanged** (long-standing IRC §213(a), not touched by
OBBBA).

**SALT cap: $40,000 ($20,000 MFS), confirmed.** The phase-down (State and Local Tax Deduction
Worksheet, `[VERIFIED: i1040sca.pdf p7]`) only engages when line5d > $10,000 ($5,000 MFS) AND
(AGI > $500,000/$250,000 OR the taxpayer completed Form 2555/4563/excluded Puerto Rico
income). Full worksheet transcription:
```
w1  = $40,000                                          [flat -- NOT $20,000 for MFS here]
w2  = 1040 line 11b (AGI)
w3a = Puerto Rico excluded income
w3b = Form 2555 line 45
w3c = Form 2555 line 50
w3d = Form 4563 line 15
w3e = w3a+w3b+w3c+w3d
w4  = w2 + w3e                                          [same MAGI shape as Schedule 1-A Part I]
w5  = $500,000 ($250,000 if MFS)
w6  = IF w4 <= w5: SKIP w7/w8, w9 = w1 ($40,000, uncapped)
      ELSE: w4 - w5
w7  = w6 x 30% (0.30)                                   -- CONTINUOUS, no $1,000 stepping
w8  = w1 - w7
w9  = larger of w8 or $10,000                           [flat -- NOT $5,000 for MFS here; the FLOOR]
w10 = smaller of w9 (HALF of w9 if MFS) or Schedule A line5d  -> Schedule A line5e
```
**Pitfall 2 confirmed exactly here**: lines w1 and w9 use the flat, non-MFS dollar figures;
only w10 halves the result for MFS filers. The "before you begin" skip-condition (line5d <=
$10,000/$5,000) IS status-aware, but the worksheet body (w1-w9) is not.

**Mortgage interest limitation:** `[VERIFIED: i1040sca.pdf p8]` — $750,000 ($375,000 MFS)
acquisition-debt limit for post-12/15/2017 debt; $1,000,000 ($500,000 MFS) for pre-12/15/2017
debt (grandfathered). This requires loan-level data (origination date, outstanding balance)
that `vnd.fjs.itemized_deductions` (a flat, line-tagged, per-category taxpayer assertion per
Decision 2.1) does not carry — **consistent with Decision 2.1's scope boundary**: the engine
trusts the taxpayer-asserted, already-limited amount on line8a/8b/8c; it does not compute the
Pub 936 limitation itself. Schedule A's own face performs NO limitation arithmetic on lines 8-10
at all — the cap is entirely in the instructions/Pub 936.

**Charitable AGI limitations:** `[VERIFIED: i1040sca.pdf p9]` — the instructions state the
LIMITS exist ("cash contributions or contributions of ordinary income property [] more than
30% of [AGI]"; "gifts of capital gain property [] more than 20% of [AGI]") but explicitly
defer the COMPUTATION to Publication 526 ("See Pub. 526 to figure the amount of your
deduction"). **Schedule A's printed lines 11-14 are pure addition — no AGI-percentage
arithmetic appears on the form face at all.** This confirms Decision 2.1's dialect design is
correct: the taxpayer-asserted amount is trusted as already Pub-526-limited; this engine does
not (and per Decision 2.1, should not) compute the percentage test itself.

**Line 18, confirmed:** the exact checkbox CONTEXT.md Decision 2.5 anticipated — "If you elect
to itemize deductions even though they are less than your standard deduction, check this box."

**No TY2025 OBBBA itemized-deduction haircut.** `[VERIFIED: i1040sca.pdf p1, "What's New" —
silent on both]`, cross-checked against multiple secondary sources confirming both the 0.5%
AGI charitable floor and the "2/37ths" high-income limitation are effective **TY2026**, not
TY2025 (State of the Art table). Neither belongs in this phase.

### §4. Schedule 8812 (TY2025) — full transcription

`[VERIFIED: f1040s8.pdf (2025), both pages, "Created 7/30/25"; i1040s8.pdf]`

```
Part I -- Child Tax Credit and Credit for Other Dependents:
  line1  = 1040 line 11a (AGI -- same value as line11b elsewhere, different page citation)
  line2a-2c = Puerto Rico / Form 2555(45,50) / Form 4563(15) add-backs  [same MAGI shape as
                                                                          Schedule 1-A Part I]
  line2d = sum of 2a-2c
  line3  = line1 + line2d                                 ["modified AGI" for CTC/ODC purposes]
  line4  = count of qualifying children under 17 with required SSN
  line5  = line4 x $2,200
  line6  = count of other dependents (not <17-with-SSN; excludes self/spouse/non-citizen-
           national-resident-alien)
  line7  = line6 x $500
  line8  = line5 + line7
  line9  = $400,000 MFJ / $200,000 all other statuses
  line10 = line3 - line9; if <=0 enter -0-; ELSE round UP to next $1,000 (a true cliff)
  line11 = line10 x 5% (0.05)
  line12 = IF line8 <= line11: STOP, no CTC/ODC/ACTC at all
           ELSE: line8 - line11
  line13 = Credit Limit Worksheet A result
  line14 = smaller of line12 or line13  -> 1040 line19

Part II-A -- Additional Child Tax Credit for All Filers:
  line15 = reserved
  line16a = line12 - line14; if 0, STOP (no ACTC)
  line16b = (count of qualifying children under 17 with SSN) x $1,700; if 0, STOP
  line17 = smaller of line16a or line16b
  line18a = earned income
  line18b = nontaxable combat pay
  line19 = IF line18a > $2,500: line18a - $2,500, ELSE -0-
  line20 = line19 x 15% (0.15)
  -- IF line16b < $5,100: skip Part II-B, ACTC (line27) = smaller of line17/line20
  -- IF line16b >= $5,100: [Part II-B, 3+ children / PR residents only]

Part II-B -- 3+ Qualifying Children / PR Residents (out of scope for most profiles):
  line21 = W-2 boxes 4+6 SS/Medicare withheld
  line22 = Sch.1 line15 + Sch.2 lines5+6+13
  line23 = line21+line22
  line24 = 1040 line27a (EIC) + Sch.3 line11 (excess SS/RRTA withheld)
  line25 = line23-line24, floor 0
  line26 = larger of line20 or line25

Part II-C:
  line27 = smaller of line17 or line26 (or line20 if Part II-B skipped)  -> 1040 line28
```

**CTC = $2,200/qualifying child** `[VERIFIED: f1040s8.pdf p1 line5, cross-confirmed
rp-25-32.pdf §2.03: "the maximum amount of child tax credit is $2,200 for any taxable year
beginning in 2025"]`. **ODC = $500** (unchanged from prior years). **ACTC cap = $1,700/child**
`[VERIFIED: f1040s8.pdf p2 line16b]`.

**Phase-out: $400,000 MFJ / $200,000 other, 5% rate, rounded UP to the next $1,000 increment
— a true cliff at the threshold** (unlike the senior deduction's continuous curve). $1 over the
threshold costs the full $50 (5% of the first $1,000 step) immediately.

**Qualifying-child vs. other-dependent classification, per the form itself:** age under 17 at
year end AND a valid (employment-eligible) SSN → line4/CTC; every other dependent (older, or
without the required SSN, but who is a U.S. citizen/national/resident alien and not the
taxpayer or spouse) → line6/ODC. Full IRS dependency tests (support, gross income, joint
return) are referenced ("Steps 1 through 3 under Who Qualifies as Your Dependent") but are
outside this engine's scope — `vnd.fjs.return_profile`'s `dependents` array (Decision 4.1)
supplies exactly the two facts Schedule 8812 itself keys the CTC/ODC split on (age, SSN
validity), plus relationship and lived-with-taxpayer for the broader dependency claim the
taxpayer is trusted to have already verified (see Open Question 3 re: citizenship).

**"Modified AGI" for CTC/ODC purposes:** `[VERIFIED: i1040s8.pdf, "Modified AGI"]` — "For
purposes of the CTC and ODC, your modified AGI is the amount on line 3 of Schedule 8812" — the
SAME AGI-plus-foreign-add-backs shape as Schedule 1-A Part I and the SALT worksheet, and for
this engine's modeled scope, provably equal to bare AGI (§6).

**Credit Limit Worksheet A** `[VERIFIED: i1040s8.pdf p3]`: line1 = 1040 line18 (tax after
Schedule 2 Part I); line2 = sum of several Schedule 3 credits this profile does not have
(foreign tax credit, dependent care, education credits, retirement savings credit, residential
clean energy, elderly/disabled credit, clean vehicle credits, Form 8978 amount); line3 =
line1-line2. For this profile, line2 collapses to $0 (none of those Schedule 3 lines are
reachable — §5), so **Credit Limit Worksheet A's result equals bare 1040 line 18** for the
target profile.

**Which 1040 lines Schedule 8812 feeds:** line14 → **1040 line 19**; line27 → **1040 line
28**. Confirmed exactly as CONTEXT.md states.

### §5. Schedules 1, 2, and 3 (TY2025) — full transcription

`[VERIFIED: f1040s1.pdf, f1040s2.pdf, f1040s3.pdf (2025), all "Created" 2025]`

**Schedule 1, Part I (Additional Income), lines 1-10:** taxable state refunds (1), alimony
received (2a), business income/Schedule C (3), other gains/Form 4797/4684 (4), rental/royalty/
Schedule E (5), farm income/Schedule F (6), unemployment compensation (7), other income (8a-8z,
26 sub-lines: NOL, gambling, COD, foreign earned income exclusion, Form 8853/8889 income,
Alaska PFD, jury duty, prizes, not-for-profit activity, stock options, personal property
rental, Olympic/Paralympic prize money, §951(a)/§951A(a) inclusions, §461(l) adjustment, ABLE
distributions, scholarships not on W-2, Medicaid waiver, nonqualified deferred comp, wages
while incarcerated, digital assets, other), line9 = total of 8a-8z, line10 = lines1-7+9 → 1040
line8.

**Schedule 1, Part II (Adjustments), lines 11-26:** educator expenses (11), reservist/artist/
fee-basis expenses (12), HSA deduction (13), moving expenses for Armed Forces (14), deductible
SE tax (15), SEP/SIMPLE/qualified plans (16), self-employed health insurance (17), early-
withdrawal penalty (18), alimony paid (19a), **IRA deduction (20)**, student loan interest
(21), reserved (22), Archer MSA (23), other adjustments (24a-24z, 11 sub-lines), line25 =
total of 24a-24z, line26 = lines11-23+25 → 1040 line10.

**For the declared profile (65+, W-2, 1099-INT, 1099-DIV/1099-B, 1099-R, SSA-1099,
dependents, itemizing): NONE of Schedule 1's Part I income items and NONE of Part II's
adjustments (with the possible exception of an IRA deduction, see Open Question 1) are
populated by any kind this engine models.** Schedule 1 for this profile is, in practice, a
documented zero on every line — line8 and line10 both `declaredZero` citing the profile
(Decision 4.2), UNLESS the taxpayer declares the generic `scheduleOneAdditionalIncome` or
`scheduleOneAdjustments` kind, in which case (per the frozen vocabulary's coarseness) the
specific line cannot be attributed and the module must either refuse or (per Decision 4.2's
"populatable lines compute; the rest are documented zeros") treat the WHOLE schedule as
unpopulatable and refuse — this is Open Question 1/2's live ambiguity.

**Schedule 2, Part I (lines 1-3) → 1040 line 17:** excess APTC repayment, clean-vehicle-credit
repayments, EPE recapture (1a-1z), AMT (Form 6251, line2), line3 = 1z+2.

**Schedule 2, Part II (lines 4-21) → 1040 line 23:** self-employment tax (4), SS/Medicare tax
on unreported tips (5), uncollected SS/Medicare on wages (6), line7=5+6, additional tax on
IRAs/tax-favored accounts (8), household employment taxes (9), reserved (10), Additional
Medicare Tax (11), NIIT (12), uncollected SS/Medicare/RRTA on tips or GTL insurance (13),
installment-sale interest (14-15), low-income housing credit recapture (16), other additional
taxes (17a-17z, 17 sub-lines), line18 = total of 17a-17z, EPE recapture (19), §965 installment
(20), line21 = 4+7through16+18+19 → 1040 line23.

**For the declared profile: NONE of Schedule 2's lines are reachable** — no AMT (Form 6251 out
of scope), no self-employment income, no NIIT (Form 8960 out of scope), no household employees
(explicitly refused, Decision 1.4). Schedule 2 is a documented zero on both line17 and line23
for this profile.

**Schedule 3, Part I (Nonrefundable Credits, lines 1-8) → 1040 line 20:** foreign tax credit
(1), dependent care credit/Form 2441 (2), education credits/Form 8863 (3), retirement savings
contributions credit (4), residential clean energy (5a), energy-efficient home improvement
(5b), other nonrefundable credits (6a-6z, 13 sub-lines including 6d "credit for the elderly or
disabled/Schedule R" — **note: this is a DIFFERENT, older credit than the new Schedule 1-A
senior deduction, and is out of this phase's scope**), line7 = total 6a-6z, line8 =
1+2+3+4+5a+5b+7 → 1040 line20.

**Schedule 3, Part II (Other Payments/Refundable Credits, lines 9-15) → 1040 line 31:** net
PTC (9), extension payment (10), excess SS/tier1 RRTA withheld (11), fuel tax credit (12),
other (13a-13z, 5 sub-lines), line14 = total 13a-13z, line15 = 9+10+11+12+14 → 1040 line31.

**For the declared profile: NONE of Schedule 3's lines are reachable either**, with one
partial exception worth flagging: **excess Social Security/tier-1 RRTA tax withheld (line11)**
is theoretically reachable by a taxpayer with multiple W-2 employers whose combined SS
withholding exceeds the annual max — but no kind in the frozen vocabulary currently expresses
this, and it is not named in CONTEXT.md's scope for this phase. Treat as a documented zero;
flag if Phase 14's acceptance test's actual W-2 data would trigger it.

### §6. The per-rule MAGI/income-measure inventory (criterion 5)

| Rule | Printed name on the form | Add-back list | Source | Arithmetically = AGI in this engine's modeled scope? |
|------|---------------------------|----------------|--------|--------|
| Schedule 1-A Part V senior deduction phase-out | "Modified Adjusted Gross Income (MAGI) Amount" (Schedule 1-A Part I, shared by Parts II-V) | AGI + Puerto Rico exclusion + Form 2555 lines 45/50 + Form 4563 line 15 | `[VERIFIED: f1040s1a.pdf p1]` | Yes — all three add-backs are always 0 (unmodeled/refused kinds) |
| SALT cap phase-down | (unnamed on the form; the worksheet's own line4) | AGI + Puerto Rico exclusion + Form 2555 lines 45/50 + Form 4563 line 15 | `[VERIFIED: i1040sca.pdf p7]` | Yes — identical add-back list to the senior deduction |
| Schedule 8812 CTC/ODC phase-out | "modified AGI" (Schedule 8812 line 3, instructions' own glossary) | AGI + Puerto Rico exclusion + Form 2555 lines 45/50 + Form 4563 line 15 | `[VERIFIED: f1040s8.pdf p1; i1040s8.pdf "Modified AGI"]` | Yes — identical add-back list again |
| Social Security combined-income test | unnamed on the worksheet (colloquially "provisional income" or "combined income," never printed as such) | 50% of SS benefits + 1z/2b/3b/4b/5b/7a/8 + tax-exempt interest (2a), minus Schedule 1 lines 11-20/23/25 | `[VERIFIED: i1040gi.pdf p32]` | **No** — a genuinely different computation, not AGI-based at all |
| IRA deduction (Pub 590-A, out of scope) | "modified AGI" (Pub 590-A's own, not fetched this session) | AGI + student loan interest deduction + foreign earned income exclusion + foreign housing exclusion/deduction + savings bond interest exclusion + adoption benefits exclusion + **taxable social security benefits added back** | Pub 590-A (not fetched — out of scope, refused) | N/A — out of scope, this is the one causing the circularity |
| Roth IRA eligibility (out of scope, no phase) | "modified AGI" (Pub 590-A) | Similar to traditional IRA MAGI but WITHOUT the Roth conversion income itself | Pub 590-A (not fetched) | N/A |
| Premium Tax Credit (out of scope, no phase) | "household income" (Form 8962) | AGI + tax-exempt interest + excluded foreign income + nontaxable SS benefits | Form 8962 instructions (not fetched) | N/A |
| IRMAA (out of scope, no phase) | "modified adjusted gross income" (SSA, not IRS) | AGI + tax-exempt interest | SSA guidance (not fetched) | N/A |
| Student loan interest deduction (out of scope this phase, Schedule 1 line21) | "modified AGI" (Schedule 1 instructions, not fetched in detail) | AGI + several exclusions, similar-but-not-identical to the IRA one | Schedule 1 instructions (not fetched in detail) | N/A |

**The takeaway (directly answering criterion 5's "how many distinct definitions"):** this
phase's IN-SCOPE arithmetic introduces **two genuinely distinct income-measure computations**:
(A) the AGI-plus-foreign-add-backs shape, used identically by three different rules (senior
deduction, SALT cap, CTC/ODC), and (B) the Social-Security-specific combined-income
computation. TAX-15/Decision 3.5 still requires **four separately-named functions** (one per
rule, not one per arithmetic shape) — `socialSecurityCombinedIncome` for (B), plus THREE
distinctly-named functions sharing shape (A): `seniorDeductionPhaseoutIncome`,
`saltCapPhasedownIncome`, and (not in CONTEXT.md's three examples, but equally required)
`childTaxCreditPhaseoutIncome` or similar for Schedule 8812. Each of the three shape-(A)
functions should take the already-computed AGI as a parameter and add its own currently-
always-zero foreign add-back terms (Pitfall 6) — mirroring the QSS/MFJ pattern in
`fjs/tax/params` (independently stored despite provably-equal values today).

### §7. Phase-out cliff mechanics

| Phase-out | Continuous or stepped? | Rate | Floor | Rounding rule |
|-----------|------------------------|------|-------|----------------|
| Schedule 1-A Part V (senior deduction) | **Continuous** | 6% | $0 (line35) | None — cent-exact, no `$1,000` stepping |
| SALT cap (Schedule A line 5e worksheet) | **Continuous** | 30% | $10,000 ($5,000 MFS, via final halving) | None — cent-exact |
| Schedule 8812 CTC/ODC (line 10-11) | **Stepped** | 5% | $0 (line12's own STOP condition) | Round the EXCESS up to the next `$1,000` before applying the rate — a true cliff |
| Schedule 1-A Part II (tips, out of scope) | Stepped | 10% (implicit: $100/$1,000) | $0 (line13) | Round DOWN to the next lower `$1,000` |
| Schedule 1-A Part III (overtime, out of scope) | Stepped | 10% (implicit) | $0 (line21) | Round DOWN, same as tips |
| Schedule 1-A Part IV (car loan, out of scope) | Stepped | 20% (implicit: $200/$1,000) | $0 (line30) | Round UP to the next `$1,000` |

**Boundary proofs needed (mirroring TAX-04's `threshold ± 1¢` convention):**
- Senior deduction: `$74,999.99/$75,000.00/$75,000.01` and `$149,999.99/$150,000.00/
  $150,000.01` (phase-out START); AND `$174,999.99/$175,000.00/$175,000.01` (single/HoH/QSS)
  / `$249,999.99/$250,000.00/$250,000.01` (MFJ) — the point where line35 floors at $0
  ($75,000 + $6,000/0.06 = $175,000; $150,000 + $100,000 = $250,000).
- SALT cap: `$499,999.99/$500,000.00/$500,000.01` (MFJ threshold start) and the floor point
  `$500,000 + ($40,000-$10,000)/0.30 = $600,000.00` (pre-MFS-halving) — boundary at
  `$599,999.99/$600,000.00/$600,000.01`.
- CTC/ODC: `$399,999.99/$400,000.00/$400,000.01` (MFJ) and `$199,999.99/$200,000.00/
  $200,000.01` (other) — because of the round-up-to-next-$1,000 rule, `$400,000.01` alone
  already produces a full `$50` reduction (5% of `$1,000`), so this boundary is the single most
  important one in this phase to get right; a naive `$400,000.00` vs `$400,000.01` test is the
  correct minimal probe.

### §8. Validation Architecture

See the dedicated `## Validation Architecture` section below (required heading location).

### §9. Ordering — the full dependency graph

See the "System Architecture Diagram" under `## Architecture Patterns` above for the visual
form. In prose, the required order is:

1. **Gross income lines excluding SS** (1z wages, 2a/2b interest, 3b dividends, 4b/5b IRA/
   pension taxable amounts [needs 1099-R box7b routing, Pitfall 4], 7a capital gain, 8 Schedule
   1 income [documented zero for this profile]).
2. **Schedule 1 Part II adjustments (line10)** — computed BEFORE the SSB worksheet, because
   the worksheet's own line6 needs this total. If an IRA deduction is declared, REFUSE HERE
   (Decision 3.3) rather than attempting the SSB worksheet at all — this is the one place the
   apparent circularity must be broken by refusal, not by ordering.
3. **The SSB Worksheet** (18 lines) — consumes step 1's non-SS income lines plus step 2's
   Schedule 1 total, produces 1040 line6b.
4. **1040 line9 (total income)** — NOW sums all eight items including line6b.
5. **1040 line11a/11b (AGI)** — line9 minus line10 (already computed in step 2).
6. **Three parallel consumers of AGI**, order-independent among themselves: Schedule 1-A
   Part I MAGI → Part V senior deduction → line13b; the SALT cap worksheet → Schedule A line5e
   → line17 → line12e (one branch of `deductionChoice`); Schedule 8812's own "modified AGI"
   (line3) — though Schedule 8812's CREDIT amount also needs line18 (tax), so Schedule 8812
   cannot fully resolve until step 8 below; only its phase-out (lines 9-12) can run this early.
7. **`deductionChoice`** — needs BOTH the standard deduction (age/blindness increments,
   already computable from filing status alone) and Schedule A's line17 total (from step 6) —
   picks the winner, 1040 line12e cites both.
8. **1040 line14/15/16** — 12e+13a+13b → taxable income → tax (four-way dispatch, unaffected
   by this phase).
9. **Schedule 2 Part I → line17 → line18** (tax after Schedule 2 Part I; for this profile,
   Schedule 2 Part I is a documented zero, so line18 = line16).
10. **Schedule 8812's credit-limit test (Credit Limit Worksheet A)** — needs line18 (step 9)
    and Schedule 3 Part I (documented zero for this profile) → produces 1040 line19.
11. **1040 lines 20-24** (Schedule 3 Part I, line21, Schedule 2 Part II, line23/24) — all
    documented zeros for this profile.
12. **Withholding/payments** (25a/25b [needs 1099-R/1099-DIV/1099-B routing], 26).
13. **Schedule 8812 Part II-A/II-B (ACTC)** — needs line12/line14 from step 10, plus line27a
    (EIC, refused if declared) and Schedule 3 line11 (documented zero) → 1040 line28.
14. **1040 line32 onward** (total payments, refund/owe) — unaffected by this phase beyond the
    lines already wired.

**Every place two rules appear to depend on each other, and how the IRS instructions resolve
it:**
- **Total income (line9) vs. taxable SS (line6b):** NOT circular — the SSB worksheet's own
  line3 sums the SEVEN OTHER income lines (excluding line6b itself), so line6b can be computed
  before line9 is finalized. Resolved by ORDER (step 3 before step 4), not by refusal.
- **SSB worksheet line6 vs. IRA deduction (Schedule 1 line20):** genuinely circular ONLY when
  the IRA deduction is itself phase-out-limited (§2's precise characterization). Resolved by
  REFUSAL (Decision 3.3), not by ordering — there is no safe order that avoids the cycle in
  that specific case.
- **AGI (line11) vs. Schedule 1-A / Schedule A / Schedule 8812's MAGI:** NOT circular —
  Schedule 1-A/SALT/8812 all read AGI as a pure INPUT, never write back to it. Resolved by
  ORDER (step 5 before step 6).
- **Schedule A's SALT cap threshold check (AGI > $500,000?) vs. Schedule A's own total feeding
  line12e which feeds taxable income:** NOT circular — the threshold check uses AGI (already
  final by step 5), and Schedule A's OUTPUT (line17) feeds line12e, a strictly later,
  DOWNSTREAM value. No cycle.


## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Schedule 1-A senior deduction computation | Tax engine (`fjs/schedule/1a` or similar) | `fjs/tax/params` (new data) | Pure computation over stored parameters, no I/O |
| SSB worksheet | Tax engine (worksheet module, `fjs/tax/line6` precedent-style) | `fjs/form1040/core` (feeds lines 6a/6b, is fed by 1z/2a/2b/3b/4b/5b/7a/8/Schedule1) | Mirrors `fjs/tax/line16/qdcgt` and `sdtw` precedent exactly |
| Schedule A + `deductionChoice` | `fjs/schedule/a` (line computation) + `fjs/tax/deduction` (comparison) | `fjs/document/itemized_deductions` (new dialect, data ingestion) | Decision 2.4 already assigns the comparison; the schedule module only sums |
| Schedule 8812 | `fjs/form8812` (or similar) | `fjs/return/profile` (new `dependents` array is the input) | Pure computation, taxpayer-declared dependents are the only input this engine can trust |
| Schedules 1/2/3 | `fjs/schedule/1`, `fjs/schedule/2`, `fjs/schedule/3` | `fjs/form1040/core` (wiring into lines 8/10/17/19/20/23/28/31) | Line-by-line modules mirroring `fjs/schedule/b`/`fjs/schedule/d` precedent |
| `vnd.fjs.itemized_deductions` dialect | `fjs/document/itemized_deductions` | — | Taxpayer-asserted, no payer, follows `medical_expenses` precedent |
| New TY2025 parameters (senior deduction, SSB thresholds, SALT cap, CTC/ODC/ACTC, medical floor) | `fjs/tax/params` | — | Data with citations, code-versioned, not a CAS document (08-CONTEXT.md precedent) |
| 1099-R → 4a/4b/5a/5b wiring | `fjs/form1040/core` | `fjs/document/1099r` (box7bIraSepSimple routes IRA vs. pension) | See §9/Pitfalls — box 7b is the IRA/pension discriminant, not currently read by anything |
| MAGI gate proof (criterion 5) | A new proof module walking `fjs/` (Decision 3.6) | — | Build-time/test-time enforcement, not runtime |

## Standard Stack

No new libraries. This phase is pure data (new `fjs/tax/params` entries) and pure computation
(new modules following the established `fjs/schedule/b`, `fjs/tax/line16/qdcgt`,
`fjs/tax/line16/sdtw`, and `fjs/document/medical_expenses` precedents). AGENTS.md's no-new-
dependency rule applies unmodified; nothing here needs anything outside the existing
FunctionalScript/TypeScript toolchain.

### Alternatives Considered

None — CONTEXT.md's decisions already fix the dialect shape (2.1), the comparison's home
(2.4), and the wave structure (4.4). Research's job here was verifying the forms these
decisions must be correct about, not choosing among architectural alternatives.

## Architecture Patterns

### System Architecture Diagram (computation order for the 65+/dependents/itemizing profile)

```
 W-2 ─┐
 1099-INT ─┤
 1099-DIV/1099-B ─┼──► gross income lines (1z, 2a, 2b, 3b, 4b*, 5b*, 7a) ──┐
 1099-R (box7b routes 4a/4b vs 5a/5b) ─┤                                   │
 SSA-1099 (box 5) ─┘  [held out of the sum above]                         │
                                                                            ▼
                                          Schedule 1 Part II (adjustments) ──► line 10
                                          [documented zero for this profile,
                                           UNLESS an IRA-deduction-shaped kind
                                           is declared → REFUSE, Decision 3.3]
                                                                            │
                                                                            ▼
              ┌───────────────────────── SSB Worksheet (18 lines) ─────────┘
              │   in: gross income lines above (minus 6b), 2a, Sch.1 line 10-ish total
              │   out: 1040 line 6b (taxable SS)
              ▼
        1040 line 9 (total income = 1z+2b+3b+4b+5b+6b+7a+8)
              │
              ▼
        1040 line 11a/11b (AGI = line9 − line10)
              │
   ┌──────────┼──────────────────────┬─────────────────────────┐
   ▼          ▼                      ▼                         ▼
Schedule    SALT cap worksheow    Schedule A vs.          Schedule 8812
1-A Part I  (needs AGI + $500k/    standard deduction      "modified AGI"
MAGI (=AGI  $250k threshold)       (deductionChoice,        (=AGI here too)
here)       feeds Sch.A line 5e    needs AGI for medical    → CTC/ODC phase-out
   │        (part of 12e)          floor too)               → line 19
   ▼                                    │
Part V senior deduction                 ▼
→ line 13b                        1040 line 12e (12e cites BOTH figures)
   │                                    │
   └────────────────┬────────────── ───┘
                     ▼
              1040 line 14 (12e+13a+13b) → line 15 (taxable income)
                     │
                     ▼
              1040 line 16 (tax, four-way dispatch — unaffected by this phase)
                     │
                     ▼
              Schedule 2 Part I → line 17 → line 18 (tax after Sch.2 Pt.I)
                     │
                     ▼
              Schedule 8812 credit-limit test (Credit Limit Wksht A, line 18
              minus Schedule 3 credits this profile mostly doesn't have)
                     │
                     ▼
              line 19 (CTC/ODC) → line 21 → Schedule 2 Part II → line 23 → line 24
                     │
                     ▼
              withholding (25a/25b) / payments (26) / EIC(27a, refused if declared)
                     │
                     ▼
              Schedule 8812 Part II-A/B → line 28 (ACTC)
                     │
                     ▼
              line 32 (total payments) → line 33/37 (refund/owe)
```

### Recommended Project Structure

```
fjs/
├── tax/
│   └── params/module.f.js          # extend: senior deduction, SSB base amounts,
│                                    #   SALT cap, CTC/ODC/ACTC, medical floor
│   └── deduction/module.f.js       # extend: deductionChoice (Decision 2.4)
│   └── line6/                      # or fjs/tax/ssb/ — the SSB worksheet, 18 named
│       └── module.f.js             #   functions, following qdcgt/sdtw precedent
├── schedule/
│   ├── a/module.f.js               # Schedule A, all 18 printed lines
│   ├── 1a/module.f.js              # Schedule 1-A, Parts I/V/VI computed,
│   │                                #   II/III/IV documented zeros
│   ├── 1/module.f.js               # Schedule 1, every line, mostly documented zero
│   ├── 2/module.f.js               # Schedule 2, every line, mostly documented zero
│   └── 3/module.f.js               # Schedule 3, every line, mostly documented zero
├── form8812/module.f.js            # Schedule 8812, both parts
└── document/
    └── itemized_deductions/module.f.js   # vnd.fjs.itemized_deductions
```

### Pattern 1: The worksheet-as-named-line-functions precedent

**What:** One pure function per printed worksheet line, named by its printed line number,
composed in printed order — `fjs/tax/line16/qdcgt` and `fjs/tax/line16/sdtw` already do this
for 25–47 lines each.
**When to use:** The SSB worksheet (18 lines) and Schedule 1-A Part V (7 lines, 31–37) both
fit this exactly.
**Example (SSB worksheet, transcribed, not yet in the codebase):**
```
// Source: i1040gi.pdf (2025) p32, "Social Security Benefits Worksheet—Lines 6a and 6b"
const line1 = totalBox5AllSsa1099AndRrb1099Cents            // -> also 1040 line 6a
const line2 = line1 / 2n                                     // 50%
const line3 = /* 1z+2b+3b+4b+5b+7a+8 */
const line4 = taxExemptInterestCents                          // 1040 line 2a
const line5 = line2 + line3 + line4
const line6 = /* Schedule 1 lines 11-20, 23, 25 total */
const line7 = line6 < line5 ? line5 - line6 : /* -0-, STOP */
// ... line8 base amount, line9..line18 exactly as printed
```

### Pattern 2: The continuous vs. stepped phase-out distinction (new in this phase)

**What:** Schedule 1-A's senior deduction (Part V) and the SALT cap phase-down both use a
**continuous** percentage of excess income with a floor — no `$1,000`-increment rounding at
all. Schedule 1-A's OWN tips/overtime/car-loan parts (II/III/IV, out of scope) and Schedule
8812's CTC/ODC phase-out DO use `$1,000`-increment rounding (down for tips/overtime, up for
car loan and for CTC/ODC).
**When to use:** Do not copy the CTC's `$1,000`-rounding pattern onto the senior deduction or
SALT cap — they are genuinely different arithmetic, confirmed line-by-line against the
printed forms (see §1, §3, §4, and §7 below).

### Anti-Patterns to Avoid
- **Assuming all four Schedule 1-A parts share the senior deduction's continuous-percentage
  mechanic.** They don't (see Pattern 2). Since Parts II/III/IV are documented zeros this
  phase, this only matters for getting the docstring's stated boundary right (Decision 3.2).
- **Treating "modified AGI" as one function reused three times.** It is arithmetically the
  same value in every case this engine can compute today, but TAX-15/Decision 3.5 requires
  four independently-named, independently-documented functions (see §6).
- **Assuming the SALT worksheet's `$40,000`/`$10,000` figures are halved for MFS on lines 1
  and 9.** They are not — only the FINAL line 9 result is halved, on line 10, for MFS (see §3
  and the exact worksheet transcription).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Dependent qualifying-child vs. other-dependent classification | A general Pub 501 dependency-test engine | The 4-field `dependents` array (Decision 4.1) plus Schedule 8812's own two tests (age <17 at year end + valid SSN → CTC; else → ODC) | The full IRS dependency test (support, gross income, joint-return tests) is out of scope; the taxpayer's own act of declaring a dependent is the trust boundary, exactly like every other taxpayer assertion in this project |
| Mortgage interest / charitable AGI limitation arithmetic | A Pub 936 / Pub 526 worksheet engine | Trust the taxpayer-asserted, already-limited amount in `vnd.fjs.itemized_deductions` | Decision 2.1 already settled this: "no floor or cap can be applied without an AGI the document cannot see" — and for charity/mortgage, the AGI-based limitation isn't even printed on Schedule A's own face; it lives in Pub 526/Pub 936, which this project doesn't model |
| The SSB worksheet's circularity | An iterative/fixed-point solver | A loud refusal when an IRA deduction is declared (Decision 3.3) | Pub 590-A Worksheet 1-1 is a whole separate worksheet with its own iteration; approximating it is exactly TAX-16's failure mode |

**Key insight:** almost everything this phase would be tempted to "build" (a general
dependency test, a general itemized-deduction-limitation engine, an iterative MAGI solver) is
explicitly out of scope by a CONTEXT.md decision already. Research's job here was confirming
those decisions are consistent with what the actual forms require — they are.

## Common Pitfalls

### Pitfall 1: Assuming the SSB worksheet has 19 lines
**What goes wrong:** A plan or proof asserts 19 named line functions and either pads with a
fake line or miscounts.
**Why it happens:** TAX-10 and criterion 2 both say "19-line" — this appears to be a stale
count that never was verified against the actual 2025 worksheet.
**How to avoid:** Transcribe against the actual worksheet (§2 below): it is **18** lines,
numbered 1 through 18, with no lettered sub-lines.
**Warning signs:** A count-guard proof (`expectedWorksheetLineCount`) asserting `19`.

### Pitfall 2: Treating the SALT worksheet's line 1/line 9 dollar figures as MFS-aware
**What goes wrong:** Coding `$40,000`/`$20,000` and `$10,000`/`$5,000` symmetrically into
lines 1 and 9, the way `standardDeduction`'s per-status table works.
**Why it happens:** Every OTHER threshold on this worksheet (line 5's $500,000/$250,000) IS
status-aware, so it's natural to assume the whole worksheet is.
**How to avoid:** The worksheet computes lines 1–9 using the flat, non-MFS figures
($40,000/$10,000) regardless of filing status, and **only line 10 halves the result** for
MFS. This is exactly what the printed worksheet says (§3, page image transcribed below).
**Warning signs:** A test with an MFS filer above the SALT-cap-reduction threshold getting a
different answer than "half of the non-MFS computation."

### Pitfall 3: Applying the senior deduction to a married-filing-separately return
**What goes wrong:** Halving the $75,000/$150,000 threshold or the $6,000 base for MFS, the
way the aged/blind standard-deduction increment behaves.
**Why it happens:** Every OTHER age-related figure in this codebase (aged/blind increments,
standard deduction chart) is filing-status-parameterized with an MFS entry.
**How to avoid:** The printed form's own caution states "If married, you must file jointly to
claim this deduction" — MFS gets **zero**, unconditionally, never a reduced amount. Confirmed
independently via secondary sources (Jackson Hewitt, TurboTax, H&R Block all state the same
rule) and structurally by the form's caution box.
**Warning signs:** A test asserting a nonzero senior deduction for an MFS 65+ filer at any
income level.

### Pitfall 4: Not distinguishing 1099-R's IRA vs. pension routing
**What goes wrong:** Wiring every 1099-R's box 1/box 2a into 1040 lines 5a/5b (pensions) or
into 4a/4b (IRA) uniformly, rather than per-document.
**Why it happens:** CONTEXT.md Decision 1.2 says "wired from `vnd.fjs.1099r`" without stating
the routing rule.
**How to avoid:** `fjs/document/1099r`'s own schema already carries the discriminant:
`box7bIraSepSimple: option(true)` — checked routes the document's box1/box2a to 4a/4b;
unchecked routes to 5a/5b. This is the IRS's own convention (Form 1099-R box 7's "IRA/
SEP/SIMPLE" checkbox), not a project invention.
**Warning signs:** A profile with both an IRA 1099-R and a pension 1099-R producing the same
total no matter which is which.

### Pitfall 5: Assuming Rev. Proc. 2025-32 is the citation for every new TY2025 figure
**What goes wrong:** Copying the standard deduction's `Citation { revProc: '2025-32', section:
'§3.01', ... }` shape onto the senior deduction, SALT cap, or medical floor.
**Why it happens:** Decision 3.1 says "the OBBBA-sourced set... gets a sibling proof," which
reads as if one Rev. Proc. governs the whole OBBBA-sourced set.
**How to avoid:** Rev. Proc. 2025-32 (fetched and grepped directly) contains **only** the CTC
figure among this phase's new numbers (§2.03: "$2,200 for any taxable year beginning in
2025"). The senior deduction, the SALT cap, and the medical floor are **not** in it — they are
direct statutory dollar amounts (OBBBA §§70103, 70120; medical floor is the long-standing IRC
§213(a) 7.5% floor, untouched by OBBBA). The existing `Citation` typedef (`{ revProc, section,
effectiveDate }`) **cannot honestly express a Public Law citation** — see Contradictions §B.
**Warning signs:** A `Citation` object with `revProc: '2025-32'` attached to the $6,000 senior
deduction figure, which that Rev. Proc. never states.

### Pitfall 6: Computing Schedule 1-A's Part I MAGI as a new, separate concept from AGI
**What goes wrong:** Building `seniorDeductionPhaseoutIncome` (etc.) as a function that reads
raw income documents and re-derives an AGI-like figure, independent of `fjs/form1040/core`'s
own line 11a/11b.
**Why it happens:** TAX-15's "no shared MAGI" principle can be over-applied to mean "no shared
COMPUTATION," when it actually means "no shared NAME/single-function reuse across genuinely
different rules."
**How to avoid:** Schedule 1-A Part I literally starts at "Enter the amount from Form 1040...
line 11b" (i.e., AGI) and adds foreign-income items this engine never computes (always zero).
Each of the three (really four, see §6) named functions should take the ALREADY-COMPUTED
AGI `ReportLine` as an input and add its own (currently-always-zero) add-back terms — not
recompute AGI from scratch.
**Warning signs:** A new module importing `fjs/document/*` modules directly instead of taking
`agiCents: bigint` as a parameter.

## Code Examples

### Schedule 1-A, Part V — the senior deduction, transcribed exactly
```
// Source: f1040s1a.pdf (2025), p2, Part V "Enhanced Deduction for Seniors"
// Part I line 3 (MAGI) is the shared input for Parts II-V; for this engine's
// modeled scope it always equals AGI (1040 line 11b) — see Contradictions §B / §6.
const line31 = scheduleOneAMagiCents           // = Part I line 3
const line32 = mfj ? 15000000n : 7500000n      // $150,000 / $75,000, in cents
const line33 = line31 > line32 ? line31 - line32 : 0n   // "if zero or less, enter $6,000 on line 35" (i.e. line34=0)
const line34 = halfUp(of(line33 * 6n)(100n))    // 6% -- CONTINUOUS, no $1,000 stepping
const line35 = line34 < 600000n ? 600000n - line34 : 0n  // $6,000 floor at zero
const line36a = taxpayerHasValidSsnAndBornBefore1961Jan2 ? line35 : 0n
const line36b = mfj && spouseHasValidSsnAndBornBefore1961Jan2 ? line35 : 0n
const line37 = line36a + line36b               // "Enhanced deduction for seniors"
```
`filingStatus === 'marriedFilingSeparately'` must short-circuit this WHOLE part to `0n` before
any of the above runs (Pitfall 3) — the printed caution is a filing-status gate, not an amount
computed and then zeroed.

### Schedule 8812, line 10's phase-out rounding — the CTC/ODC cliff
```
// Source: f1040s8.pdf (2025) p1, Part I lines 9-11
const line9 = mfj ? 40000000n : 20000000n      // $400,000 / $200,000, cents
const excess = line3 > line9 ? line3 - line9 : 0n
// "If more than zero and not a multiple of $1,000, enter the NEXT multiple of $1,000"
const line10 = excess === 0n ? 0n : roundUpToNextThousandDollars(excess)
const line11 = halfUp(of(line10 * 5n)(100n))    // 5%
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| Form 1040 line 11 (single AGI line) | Form 1040 lines 11a AND 11b (same AGI, restated on page 2) | 2025 revision | Already handled correctly in `fjs/form1040/core` (verified: `line11b = { ...line11a, rule: '1040 line 11b' }`); Schedule 1-A/Schedule A/SALT worksheet cite "11b", Schedule 8812 cites "11a" — same number |
| $10,000 flat SALT cap (TCJA, 2018-2024) | $40,000 SALT cap with 30% phase-down to a $10,000 floor above $500k/$250k MAGI | OBBBA §70120, effective TY2025 | New; not in this project's params yet |
| $2,000 CTC | $2,200 CTC (permanent, inflation-indexed after 2025) | OBBBA §70104, Rev. Proc. 2025-32 §2.03 | New; not in this project's params yet |
| No senior-specific deduction beyond the aged/blind standard-deduction add-on | A new, separate $6,000/taxpayer "enhanced deduction for seniors" via new Schedule 1-A | OBBBA §70103, effective TY2025-2028 | Entirely new form and computation |
| — | 0.5% AGI floor on itemized charitable deductions; "2/37ths" haircut on itemized deductions for 37%-bracket filers | OBBBA, **effective TY2026**, confirmed NOT applicable to TY2025 by the 2025 Schedule A instructions' own "What's New" section | Correctly out of scope for this phase — do not implement |

**Deprecated/outdated:** none relevant — every form here is new-for-2025 or a routine annual
revision.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Exact OBBBA public-law section numbers (§70103 senior deduction, §70120 SALT cap, §70104 CTC) are correctly attributed — confirmed via secondary sources (law firm/CPA summaries), not by reading the OBBBA statute text (Pub. L. 119-21) directly | §1, §3, §4, Contradictions §B | Citation object cites the wrong OBBBA section number; low practical risk since the dollar figures themselves are independently confirmed against the IRS-published forms, but the `Citation.section` field could be wrong |
| A2 | The medical-expense 7.5% floor's citation is IRC §213(a), unmodified by OBBBA | §3 | If OBBBA touched §213(a) after this research, the citation would be stale; the FIGURE (7.5%) is independently confirmed on the 2025 Schedule A face itself |
| A3 | Schedule 8812's "valid SSN" requirement and Schedule 1-A's "valid SSN" requirement for the senior deduction both mean "SSN valid for employment," excluding ITINs — confirmed for the senior deduction via secondary sources, and by direct reading of Schedule 8812's own line 4 label ("with the required social security number") | §1, §4 | If wrong, a dependent/senior with an ITIN would be incorrectly granted a credit/deduction; the `dependents` array's `ssnValidForEmployment` field name (Decision 4.1) already anticipates this correctly |
| A4 | The Schedule A charitable-contribution AGI percentage limits (30% cash/ordinary-income property, 20% capital-gain property, per the 2025 instructions' own text) are NOT computed by this engine at all — Pub 526's detailed computation is out of scope, consistent with Decision 2.1 | §3, Don't Hand-Roll | If a future phase needs to VALIDATE a taxpayer-asserted charitable amount against the AGI limit, this assumption would need revisiting; no risk to THIS phase, which trusts the taxpayer-asserted, already-limited figure |

**None of these assumptions affect a dollar figure or line-number claim** — every dollar
figure, line number, and arithmetic rule in this document was read directly from a fetched
2025 IRS PDF (`[VERIFIED: ...]`), not assumed. Only the OBBBA statute section numbers backing
those figures (rather than the figures themselves) rely on secondary-source confirmation.

## Contradictions With CONTEXT.md

### A. TAX-10 / criterion 2's "19-line" Social Security Benefits Worksheet is 18 lines

`[VERIFIED: i1040gi.pdf (2025) p32, "Social Security Benefits Worksheet—Lines 6a and 6b"]` —
the printed worksheet has lines numbered **1 through 18**, with no lettered sub-lines (unlike,
e.g., Schedule 1-A's lines 2a–2e or Schedule 8812's lines 18a/18b). REQUIREMENTS.md's TAX-10
and ROADMAP.md's criterion 2 both say "19-line." This appears to be a stale count that was
never checked against the actual worksheet (the project's own AGENTS.md warns about exactly
this failure mode: "a proof's expected side must be independent of the code under test" — the
inverse failure here is a REQUIREMENT stated without checking the primary source). The plan
should build **18** named worksheet-line functions plus a count-guard proof asserting `18`,
and REQUIREMENTS.md/ROADMAP.md's prose should be corrected in the same phase (mirroring how
`fjs/tax/deduction`'s docstring already corrected a similar "17 leaves" miscount in
10-RESEARCH.md).

### B. `fjs/tax/params`'s `Citation` typedef cannot express most of this phase's new numbers

`fjs/tax/params/module.f.js`'s `Citation` typedef is `{ revProc: string, section: string,
effectiveDate: string }`. Decision 3.1 says the OBBBA-sourced parameters "get a sibling
proof" implying the same citation SHAPE. But `[VERIFIED: rp-25-32.pdf, grepped in full]` —
Rev. Proc. 2025-32 contains **only the CTC figure** ($2,200, §2.03) among this phase's new
numbers. The senior deduction ($6,000, 6%, $75k/$150k), the SALT cap ($40,000, 30%,
$500k/$250k, $10,000 floor), and the medical floor (7.5%, IRC §213(a), long-standing and
untouched) are **not** in any Rev. Proc. at all — they are direct statutory amounts (OBBBA
Pub. L. 119-21, specific sections) or a pre-existing Code section. The existing `Citation`
shape has no field for "Public Law 119-21, §70103" that isn't a misuse of `revProc` (which
means, specifically, a Rev. Proc. number). **This is a structural decision the plan must make
explicitly**, not merely research to confirm: either (a) widen `Citation` to a discriminated
union (`{ kind: 'revProc', revProc, section, effectiveDate } | { kind: 'publicLaw', publicLaw,
section, effectiveDate } | { kind: 'code', section, effectiveDate }`), or (b) reuse `revProc`
to hold a non-Rev-Proc string with a documented convention. (a) is recommended — it keeps
`unmodifiedParametersCite2024_40Only`-style proofs honest about what kind of source backs each
figure, and is a small, additive change (existing entries all become `{ kind: 'revProc', ... }`
with no value change).

### C. The senior deduction is unavailable to MFS filers — not stated in CONTEXT.md at all

`[VERIFIED: f1040s1a.pdf (2025) p2, Part V caution: "If married, you must file jointly to
claim this deduction."]` CONTEXT.md's decisions discuss the $75k/$150k thresholds and the
6%/$6,000 mechanics but never mention filing-status eligibility. This is not a contradiction
of a stated decision, but it is information CONTEXT.md is silent on that materially changes
Part V's implementation: MFS returns must short-circuit to `$0` before line 31 is even
computed, not merely happen to compute `$0` through the ordinary phase-out arithmetic (an MFS
filer with $0 MAGI would otherwise wrongly compute a nonzero deduction under the plain
threshold/phase-out arithmetic, since $75,000/$150,000 apply per status and MFS shares the
$75,000 non-MFJ threshold on the form's face — the form's face alone under-specifies this;
only the caption states the MFS exclusion).

## Open Questions

1. **Can the frozen `kindVocabulary` distinguish a declared IRA deduction from other Schedule
   1 adjustments, for Decision 3.3's refusal to fire correctly?**
   - What we know: `kindVocabulary` has exactly one generic kind, `scheduleOneAdjustments`,
     covering ALL of Schedule 1 Part II (lines 11–26). Decision 3.3 says the return should
     refuse specifically "when the profile declares an IRA deduction on Schedule 1" — not
     when ANY Schedule 1 adjustment is declared.
   - What's unclear: with only one coarse kind, the engine cannot tell "this
     `scheduleOneAdjustments` declaration is an IRA deduction" from "this declaration is an
     HSA deduction" (which does not create the circularity). The kindVocabulary is frozen at
     50 (Decision 1.5) — a new dedicated kind cannot be added without breaking that freeze.
   - Recommendation: either (a) `scheduleOneAdjustments`, if declared at all, unconditionally
     refuses this phase (broader than Decision 3.3's literal wording, but the only option the
     frozen vocabulary permits without a new declared field), or (b) add a new BOOLEAN FIELD
     (not a new kind) to `vnd.fjs.return_profile` — e.g., `iraDeductionDeclared: option(true)`
     — mirroring how the Schedule A line 18 election (Decision 2.5) and the `dependents` array
     (Decision 4.1) both already add profile fields without touching `kindVocabulary`. (b) is
     consistent with the pattern CONTEXT.md itself uses elsewhere and lets a return with, say,
     only an HSA-deduction Schedule 1 adjustment compute normally. This should be raised with
     the user/planner explicitly rather than assumed — it changes Wave 1's `return_profile`
     scope.

2. **Do Schedule 2 and Schedule 3's coarse kinds (`scheduleTwoTaxes`,
   `scheduleThreeNonrefundableCredits`, `scheduleThreeRefundableCredits`) have the same
   line-attribution problem as Schedule 1?**
   - What we know: for the declared 65+/dependents/itemizing profile this phase targets, no
     line on Schedule 2 or Schedule 3 is reachable by any input this engine models (no AMT, no
     self-employment tax, no NIIT [Form 8960 out of scope], no foreign tax credit, no
     dependent-care credit). All three coarse kinds are therefore expected to simply never be
     declared for the profile Phase 14's acceptance test uses.
   - What's unclear: same generic-kind-can't-distinguish-lines issue as #1, if a FUTURE
     profile ever declares them.
   - Recommendation: Decision 4.2 ("populatable lines compute; the rest are documented
     zeros") already implies these coarse kinds, if never declared, drive the WHOLE schedule
     to a documented zero. No action needed for Phase 13's target profile; flag for whichever
     future phase widens the profile beyond the current five requirements.

3. **Is Schedule 8812's ODC citizenship/national/resident-alien test (line 6's caution: "do
   not include... anyone who is not a U.S. citizen, U.S. national, or U.S. resident alien")
   captured by the `dependents` array's four fields (relationship, SSN valid for employment,
   age at year end, lived-with-taxpayer)?**
   - What we know: it is not one of the four fields Decision 4.1 locks in.
   - What's unclear: whether this is an intentional trust boundary (the taxpayer's act of
     declaring someone a dependent already implies they pass this test, mirroring how this
     project trusts every other taxpayer assertion) or a gap.
   - Recommendation: treat as an accepted trust boundary consistent with the rest of this
     project's design (the taxpayer asserts dependents; Schedule 8812 classifies CTC vs. ODC
     using only the two facts the printed form itself keys the classification on — age and
     SSN validity). No new field needed; note it in the Schedule 8812 module's own docstring
     as a documented scope boundary, mirroring the Schedule A 12e docstring's treatment of its
     own out-of-scope exceptions.

## Environment Availability

Not applicable — this phase has no external tool/service dependencies beyond the existing
FunctionalScript/Node toolchain already in use. All five governing IRS documents were fetched
successfully as final, non-draft PDFs (see Sources).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | FunctionalScript Emergent Testing (`proof` exports), run via `node --test all.test.js` |
| Config file | none — see AGENTS.md's "Testing" section; `all.test.js` walks the module map |
| Quick run command | `node --test 2>&1 \| grep -c '^✔ import("./fjs/'` (project-local proof count; NEVER gate on the raw `npm test` total, which includes ~2,100 vendored submodule proofs) |
| Full suite command | `npm test` (i.e., `tsc && node --test`) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TAX-09 | Schedule 1-A Part V computes $6,000 base, 6% continuous phase-out, floors at 0, feeds 1040 line 13b | unit | `node --test` (proof in new `fjs/schedule/1a/module.f.js`) | ❌ Wave 2 |
| TAX-09 (boundary) | Threshold and floor boundary probes at $75k/$150k and $175k/$250k (senior deduction zero point) | unit (boundary, mirroring TAX-04) | `node --test` (new leaves in the same module) | ❌ Wave 2 |
| TAX-09 (MFS) | MFS filer gets $0 senior deduction unconditionally, at any income | unit (control + gate) | `node --test` | ❌ Wave 2 |
| TAX-10 | 18-line SSB worksheet matches printed arithmetic on a case exercising 85%-tier + tax-exempt-interest add-back (criterion 2) | unit | `node --test` (new `fjs/tax/line6` or similar module) | ❌ Wave 2 |
| TAX-10 (circularity) | Declaring an IRA deduction (however the profile expresses it — see Open Question 1) refuses loudly, naming the remedy | unit (refusal + control) | `node --test` | ❌ Wave 3 (scope reclassification) |
| TAX-13 | Schedule A totals compare against standard deduction in BOTH directions, including a case above $15,750/$31,500 where itemizing still loses (criterion 3) | unit | `node --test` (`fjs/tax/deduction`'s `deductionChoice`) | ❌ Wave 2 |
| TAX-13 (SALT) | SALT cap phase-down worksheet, including the MFS-halves-only-line-10 mechanic (Pitfall 2) | unit (boundary) | `node --test` | ❌ Wave 2 |
| TAX-12 | Schedule 8812 Part I (line 19) and Part II-A (line 28) both compute for declared dependents | unit | `node --test` (`fjs/form8812`) | ❌ Wave 2 |
| TAX-12 (phase-out cliff) | $1,000-rounded-up phase-out boundary at $400k/$200k | unit (boundary) | `node --test` | ❌ Wave 2 |
| TAX-14 | Schedules 1/2/3 carry every line the profile reaches; rest documented zero | unit | `node --test` (three new modules) | ❌ Wave 2 |
| Criterion 5 (MAGI gate) | `grep -rn "magi" fjs/` returns nothing | build-time gate (Decision 3.6) | `grep -rn "magi" fjs/` (or the equivalent proof walking the tree) | ❌ Wave 3 |

### Sampling Rate
- **Per task commit:** `node --test 2>&1 | grep -c '^✔ import("./fjs/'` (watch the count rise)
- **Per wave merge:** `npm test` (full `tsc && node --test`)
- **Phase gate:** full suite green, `grep -rn "magi" fjs/` empty, before `/gsd-verify-work`

### Wave 0 Gaps
None — this project's test infrastructure (FunctionalScript Emergent Testing, `proof` exports
discovered by `all.test.js`) already covers every requirement shape this phase needs; no new
framework or shared fixture is required. Every new module simply adds its own `proof` export,
per the established `fjs/schedule/b`/`fjs/tax/line16/qdcgt` precedent.

## Security Domain

`security_enforcement` is absent from `.planning/config.json` (treated as enabled), but this
phase introduces no new attack surface beyond what Phases 1–12.1 already established: no
network I/O, no auth, no new untrusted-input parsing pattern beyond the existing rtti-schema +
`checkReferences` dialect validation this phase's new `vnd.fjs.itemized_deductions` dialect
and `return_profile` extensions will follow verbatim.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | No auth surface in this project |
| V3 Session Management | No | N/A |
| V4 Access Control | No | N/A |
| V5 Input Validation | Yes | `rtti` structural schemas + `checkReferences` semantic validation (existing pattern, e.g. `fjs/document/medical_expenses`, `fjs/return/profile`) — new dialect and profile fields follow it unchanged |
| V6 Cryptography | No | No new crypto surface; CAS document hashing is pre-existing and untouched |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| A hostile blob claiming the new `vnd.fjs.itemized_deductions` dialect with malformed money fields | Tampering | `moneyFieldError` exactness check (existing, reused verbatim) |
| A crafted `dependents` array entry with an out-of-range age or malformed SSN-validity flag causing an unintended CTC/ODC classification | Tampering | `checkReferences`-style semantic validation on the new array, following `return_profile`'s existing per-field refusal pattern |
| `grep -rn "magi" fjs/` gate itself being bypassed by mixed-case obfuscation (`Magi`, `MAGI` in a variable name rather than prose) | Tampering (of the gate itself) | Decision 3.6 gates on the LOWERCASE token specifically — the plan should verify the gate proof's regex actually matches `magi` as a case-sensitive substring in identifier positions, not merely in comments, or a variable named `Magi` could evade it |

## Sources

### Primary (HIGH confidence — fetched and read directly, 2025 final revisions)
- https://www.irs.gov/pub/irs-pdf/f1040s1a.pdf — Schedule 1-A (Form 1040) 2025, "Created 11/4/25" — full 38-line, 6-part transcription
- https://www.irs.gov/pub/irs-pdf/f1040sa.pdf — Schedule A (Form 1040) 2025, "Created 11/20/25" — full 18-line transcription
- https://www.irs.gov/pub/irs-pdf/i1040sca.pdf — 2025 Instructions for Schedule A — SALT worksheet, mortgage interest limits, charitable AGI limit text, "What's New" (confirms no TY2025 0.5%-floor/2-37ths change)
- https://www.irs.gov/pub/irs-pdf/f1040s8.pdf — Schedule 8812 (Form 1040) 2025, "Created 7/30/25" — full 27-line, 3-part transcription
- https://www.irs.gov/pub/irs-pdf/i1040s8.pdf — 2025 Instructions for Schedule 8812 — Credit Limit Worksheet A, dependency-test cross-reference, modified-AGI definition (= Schedule 8812 line 3)
- https://www.irs.gov/pub/irs-pdf/f1040s1.pdf — Schedule 1 (Form 1040) 2025, "Created 7/25/25" — full 26-line, 2-part transcription
- https://www.irs.gov/pub/irs-pdf/f1040s2.pdf — Schedule 2 (Form 1040) 2025, "Created 5/8/25" — full 21-line, 2-part transcription
- https://www.irs.gov/pub/irs-pdf/f1040s3.pdf — Schedule 3 (Form 1040) 2025, "Created 11/17/25" — full 15-line, 2-part transcription
- https://www.irs.gov/pub/irs-pdf/i1040gi.pdf — 2025 Form 1040 instructions — Social Security Benefits Worksheet (p32), line 12a-13b instructions (pp33-34)
- https://www.irs.gov/pub/irs-drop/rp-25-32.pdf — Rev. Proc. 2025-32 — grepped in full; confirms CTC $2,200 (§2.03) is the ONLY one of this phase's new figures it contains
- `fjs/tax/params/module.f.js`, `fjs/tax/deduction/module.f.js`, `fjs/return/scope/module.f.js`, `fjs/return/profile/module.f.js`, `fjs/form1040/core/module.f.js`, `fjs/document/1099r/module.f.js`, `fjs/document/ssa1099/module.f.js`, `fjs/report/line/module.f.js`, `fjs/tax/line16/sdtw/module.f.js` — read directly, this session

### Secondary (MEDIUM confidence — cross-verified against a primary source or multiple credible sources)
- OBBBA §70103 (senior deduction), §70120 (SALT cap), §70104 (CTC, corroborated by Rev. Proc. 2025-32 §2.03 directly) — attributed via Nelson Mullins' OBBBA section-by-section summary and Journal of Accountancy/NATP coverage, not by reading Pub. L. 119-21's statute text directly
- MFS ineligibility for the senior deduction — corroborated by Jackson Hewitt, TurboTax, H&R Block, in addition to the form's own caution box (which is itself primary)
- 0.5% AGI charitable floor and "2/37ths" itemized-deduction haircut effective TY2026 — corroborated by Granted AI, Greenberg Traurig, PKF O'Connor Davies, Frazier & Deeter, in addition to the 2025 Schedule A instructions' own silence on both (primary, negative evidence)

### Tertiary (LOW confidence)
- None used for any numeric or structural claim in this document.

## Metadata

**Confidence breakdown:**
- Standard stack: N/A — no new libraries
- Form structure/line numbers/arithmetic: HIGH — every figure read from a fetched, final 2025
  IRS PDF
- OBBBA statutory section citations (as opposed to the dollar figures themselves): MEDIUM —
  secondary-source attribution, not direct statute text
- Pitfalls/architecture guidance: HIGH — derived directly from the transcribed forms and the
  existing codebase's own patterns

**Research date:** 2026-08-10
**Valid until:** Treat as valid through TY2025 filing season (April 2026); several of this
phase's numbers (senior deduction, SALT cap, tips/overtime/car-loan deductions) are indexed or
change starting TY2026 — do not reuse this document's dollar figures for a future tax-year
phase without re-verifying.
