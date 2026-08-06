# Phase 10: Form 1040 Core, Line-16 Dispatch, and the Scope Guard - Research

**Researched:** 2026-08-06
**Domain:** Form 1040 (2025) lines 1a–37; the line-16 four-way method dispatch; the Qualified
Dividends and Capital Gain Tax Worksheet; the Schedule D Tax Worksheet; the age/blindness standard
deduction; IRS line-boundary rounding; and the TAX-16 scope guard.
**Confidence:** HIGH — every load-bearing figure below was read **this session** out of the IRS PDFs
in `scratchpad/irs/` with `pdftotext -layout -f N -l N`, and every worked arithmetic example was
cross-checked against the **printed Tax Table rows**, not only against bracket arithmetic. Where a
claim rests on training knowledge or on my own algebra rather than on an IRS sentence, it is tagged
`[ASSUMED]` or `[DERIVED]` and listed in the Assumptions Log.

**No CONTEXT.md exists for this phase yet** (`.planning/phases/10-.../` was empty when this ran), so
there are no locked user decisions to honour. Every "Recommendation" below is a proposal for
`/gsd-discuss-phase` to lock or overrule, not a decision already taken.

<phase_requirements>
## Phase Requirements

| ID | Description (verbatim from `.planning/REQUIREMENTS.md`) | Research Support |
|----|-------------|------------------|
| TAX-03 *(T1)* | "Explicit line-16 method dispatch across all branches — Tax Table, Tax Computation Worksheet, QDCGT worksheet, Schedule D Tax Worksheet — with a proof per branch. Line 16 is not bracket arithmetic." | §"The Line-16 Dispatch Decision Tree" gives the tree exactly as the instructions state it, with the tested order and the inputs each arm needs; §"The Tax Computation Worksheet" proves the TCW is already implemented; §"Worked Numeric Examples" supplies one input per branch. |
| TAX-05 *(T1)* | "Form 1040 core lines 1a–37." | §"Form 1040 Lines 1a–37" enumerates every line on the 2025 face, marks each computable / declared / refused, and names the phase that unblocks each refusal. |
| TAX-06 *(T1)* | "Standard deduction with age and blindness increments." | §"Standard Deduction, Age and Blindness" transcribes the Standard Deduction Chart and the Dependents worksheet, cross-checks both against `fjs/tax/params`, and enumerates every reachable box-count combination per filing status. |
| TAX-16 *(T1)* | "A **scope guard** — unmodeled input causes a loud refusal, never a silently omitted line. This is what makes a partial 1040 honest instead of quietly wrong, and it is how REQ TAX-05's 'full line-by-line' claim stays truthful." | §"The TAX-16 Scope Guard" establishes the structural finding that the guard cannot be driven by store contents, names the missing artefact (a taxpayer-declared return profile), and specifies the refusal shape. |
</phase_requirements>

---

## Summary

**The single most valuable artefact this research produces is a pair of adjacent inputs, one dollar
apart in taxable income, that bracket the entire $1–$12 line-16 symptom range.** For a married-filing-jointly
TY2025 return with **taxable income $97,000 and qualified dividends $300**, the correct line 16 is
**$11,174**; an engine that reports QDCGT line 23 instead of line 25 reports **$11,175** — off by
**$1**. Change taxable income to **$96,999** and qualified dividends to **$299** and the correct
answer becomes **$11,163** while the same broken engine still reports **$11,175** — off by
**$11.85 ≈ $12**. Both correct values were read off the printed Tax Table
(`i1040gi.pdf` p79: MFJ `96,950–97,000 → 11,163`, `97,000–97,050 → 11,174`,
`96,700–96,750 → 11,130`) and independently reproduced by midpoint bracket arithmetic. Every line
1a through 15 is identical in the two returns and in the broken and correct engines; only line 16
moves. That is the signature symptom Success Criterion 2 names, reproduced exactly, from primary
sources.

**Why the discrepancy exists, precisely.** QDCGT line 25 is `min(line 23, line 24)`. Line 24 is the
tax on *all* taxable income at ordinary rates; line 23 is the tax on the ordinary slice plus 15%/20%
on the preferential slice. Two independent mechanisms can make line 23 exceed line 24, and both are
live only inside a narrow window:

1. **Bracket inversion.** The 0%-capital-gain ceiling sits *below* the top of the 12% ordinary
   bracket — `$96,700 < $96,950` (MFJ), `$48,350 < $48,475` (single/MFS), `$64,750 < $64,850` (HoH).
   In that gap the preferential rate (15%) is *higher* than the ordinary rate (12%). Line 23 charges
   3% more than line 24 on every dollar of the gap: at most `3% × $250 = $7.50` (MFJ).
2. **Tax Table midpoint quantisation.** Lines 22 and 24 are *Tax Table lookups*, and every row prints
   the tax on the row's **midpoint**, dollar-rounded (Phase 8's finding, re-confirmed here). Line 22
   looks up the ordinary income, line 24 looks up the full taxable income — different rows, each
   quantised independently. Line 22's row can overstate by up to `$25 × rate` while line 24's row
   understates by up to `$25 × rate`. In the $97,000 MFJ example that contributes `+$3.00` and
   `−$5.50` respectively, i.e. `+$8.50` in favour of line 23 exceeding line 24.

`min()` exists to clamp exactly this. **An engine that computes lines 1–24 perfectly and drops line
25's `min()` produces a wrong figure that is off by single-digit dollars and looks entirely
plausible.** Nothing above line 16 disagrees, so no other line-by-line check catches it.

**Three further structural findings the planner must act on:**

- **The Tax Computation Worksheet is already implemented.** Its twenty printed rows are exactly
  `rate × income − subtraction`, and every one of the twenty subtraction constants reproduces
  `fjs/tax/table`'s existing `cumulativeBracketTaxCents` to the cent (verified on 4 of 20 rows by
  hand here, including HoH's top row at $626,350 → $187,031.50 exactly). The TCW branch of TAX-03
  needs a `≥ $100,000` gate and a hand-transcribed 20-row diff proof — no new arithmetic.
- **PROV-01's `ReportLine` cannot express the standard deduction today.** `sources` is a *non-empty
  tuple* of `{ documentHash, boxPath, value }`. Line 12e derives from the taxpayer's filing status
  and age/blindness checkboxes — which no dialect models. There are four dialects
  (`vnd.fjs.ocr`, `vnd.fjs.1099int`, `vnd.fjs.w2`, `vnd.fjs.medical_expenses`) and none of them is a
  return profile. **Phase 10 must introduce one**, and it is also the only thing that can drive the
  TAX-16 scope guard (see next point).
- **The scope guard cannot be driven by store contents.** "No `1099-DIV` in the store" cannot
  distinguish "the taxpayer had no dividends" from "the taxpayer had dividends and this engine
  cannot read the form." A guard that only refuses when it *sees* an unmodeled document is exactly
  the silent omission TAX-16 exists to prevent. The guard must compare a **taxpayer-declared** set
  of income/deduction kinds against the engine's **declared modeled set**.

**Primary recommendation:** build Phase 10 as four modules — `fjs/return/profile` (the declared
return-profile dialect and the scope-guard vocabulary), `fjs/tax/deduction` (line 12e), `fjs/tax/line16`
(the dispatch + QDCGT + TCW, with the Schedule D Tax Worksheet arm present as a *named refusal* until
Phase 12 supplies Schedule D), and `fjs/form1040/core` (lines 1a–37 as `ReportLine`s). Transcribe both
worksheets line-for-line with the printed line numbers as function/field names (TAX-15's rule), and
add the `min()` regression proof pair above as the first thing written.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Taxpayer-declared facts (filing status, birthdates, blindness, dependents, "I have income of kind X") | Stored document (CAS, a new `vnd.fjs.*` dialect) | — | It is taxpayer-supplied data with provenance, exactly like a W-2; it must be hashable so `ReportLine.sources` can cite it, and it must be perturbable so PROV-07's perturbation gate can move the answer. |
| Reference constants (brackets, breakpoints, standard deduction, aged/blind increments) | `fjs/tax/params` (compiled-in, code-versioned) | — | Already settled in Phase 8 (`08-CONTEXT.md`): parameters ship with the server, are not CAS documents, so `fjs-run-integration.test.js` works against a fresh store. **Every constant this phase needs is already there except the 24%-bracket ceiling used by Schedule D TW line 19 — which is also already there, as `ordinaryBrackets[status].brackets[3].ceiling`.** |
| Tax Table lookup (< $100,000) | `fjs/tax/table` (existing) | — | Shipped and row-diffed in Phase 8. Refuses at ≥ $100,000 naming the TCW. Reuse unchanged. |
| Tax Computation Worksheet (≥ $100,000) | `fjs/tax/table` (extend) | — | It is `cumulativeBracketTaxCents` + a dollar round + a `≥ $100,000` gate. Putting it anywhere else duplicates the bracket walk. |
| QDCGT / Schedule D Tax Worksheet arithmetic | `fjs/tax/line16` (new, pure) | `fjs/tax/table` for lines 22/24 (QDCGT) and 44/46 (Sch D TW) | Both worksheets *call back into* the Tax Table / TCW dispatch. That callback is the whole reason line 16 is not bracket arithmetic. |
| Method dispatch (which of the four) | `fjs/tax/line16` (new, pure) | — | Must be one named function returning a *tagged* method, so a proof can assert **which** method was chosen, not merely that the number is right. |
| Scope guard | `fjs/return/scope` (new, pure) | `fjs/report/guard` precedent | Same shape as `classifyRunOutcome`: one function, one place, throwing a bare value. Its inputs are the declared profile and the modeled-capability set — never the CAS store. |
| Line assembly + provenance | `fjs/form1040/core` (new) | `fjs/report/line` | Each 1040 line becomes a `ReportLine` whose `sources` is the union of its inputs' sources and whose `rule` names the printed line. |
| Rounding | `fjs/types/rational.halfUp` at each line boundary | `fjs/exact` for the cents scale | EXACT-03/04, already shipped. No new rounding primitive. |

---

## Standard Stack

**No new dependency of any kind is required or proposed for this phase.** AGENTS.md makes adding one
a hard stop requiring every owner's approval; nothing here comes close to justifying it.

### Core (all existing, in-repo)

| Module | Purpose | Why it is the right home |
|--------|---------|--------------------------|
| `fjs/tax/params/module.f.js` | Brackets, capital-gain breakpoints, standard deduction, aged/blind increments — each with its own `{revProc, section, effectiveDate}` | Every constant QDCGT and Sch D TW need is already stored and citation-proofed. See §"Where TY2025 Parameters Already Supply the Breakpoints". |
| `fjs/tax/table/module.f.js` | `lookupTaxTable`, `generateRow`, `cumulativeBracketTaxCents`, `taxTableBandStructure`, `handTranscribedRows`, `tableUpperBoundCents` | The Tax Table branch, the TCW branch, and the `< $100,000` gate all live here already. `cumulativeBracketTaxCents` **is** the TCW. |
| `fjs/tax/boundary/module.f.js` | `segmentIndex` + 42 generated threshold triples | New thresholds this phase introduces (none — see §"Threshold Inventory Delta") would be picked up automatically by `allThresholds` if they were added to params. |
| `fjs/types/rational/module.f.js` | `of/add/multiply/sum/halfUp` | `halfUp` is IRS half-up (`$2.50 → $3`), which the IRS's own p23 example states verbatim. `sum` + a single `halfUp` at the line boundary is `round(sum)` by construction; the module deliberately offers no `roundEach`. |
| `fjs/exact/module.f.js` | `centsFromString`, `centsToString`, `tryCentsFromString` | The money boundary. |
| `fjs/report/line/module.f.js` | `ReportLine`, `Source` | PROV-01/02. See §"Open Question 1" — it needs either a widening or a profile document to express line 12e. |
| `fjs/report/guard/module.f.js` | `classifyRunOutcome` | The zero-read kill condition. The scope guard is a *sibling*, not a replacement: the zero-read rule catches "computed nothing"; the scope guard catches "computed only part and said nothing." |
| `fjs/document/base`, `.../money_field`, `.../subject` | Dialect scaffolding | The new return-profile dialect must be built on these and registered in `fjs/server/finance_schema`'s `dialectSchemas`. |

### Supporting

| Module | When to use |
|--------|-------------|
| `fjs/document/w2` | Line 1a (`box1WagesTipsOtherCompensation`), line 25a (`box2FederalIncomeTaxWithheld`). |
| `fjs/document/1099int` | Line 2a (`box8TaxExemptInterest`), line 2b (`box1InterestIncome` + `box3UsSavingsBondsAndTreasuryInterest`), line 25b (`box4FederalIncomeTaxWithheld`). |
| `fjs/document/medical_expenses` | Substantiation behind Schedule A line 1 — **Schedule A itself is Phase 13**, so this dialect is not consumable by a 1040 line in this phase. |
| `fjs/report/audit` | `countNumericLiterals` — unchanged; this phase adds many legitimate literals (worksheet line numbers), which is exactly why PROV-07 reports rather than refuses. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Transcribing QDCGT/Sch D TW line by line | Deriving the tax directly from the rate schedule (`0% up to Z, 15% to F, 20% above`) | **Rejected.** The `min(line 23, line 24)` clamp and the Tax Table quantisation are not expressible in a rate-schedule model, and they are precisely where the $1–$12 error lives. TAX-15 also mandates one named function per worksheet carrying the printed line numbers. |
| A new module for the TCW | Extending `fjs/tax/table` | Extending is right — the TCW shares `cumulativeBracketTaxCents` with the table generator, and splitting them would create two bracket-walk implementations that must agree. |
| Storing the QDCGT breakpoints as new constants | Reading `capitalGainsBreakpoints[status].{zeroRateMax,fifteenRateMax}` | Reading is right and **verified**: the QDCGT's printed line 6 and line 13 figures are character-for-character the stored `zeroRateMax`/`fifteenRateMax`. New constants would be a second source of truth. |
| Driving the scope guard off CAS store contents | A taxpayer-declared return profile | See §"The TAX-16 Scope Guard" — store contents cannot express absence, so a store-driven guard is silently unsound. |

**Installation:** none. `package.json` is unchanged.

---

## The Line-16 Dispatch Decision Tree

`[VERIFIED: i1040gi.pdf p36 (printed "36"), extracted this session with pdftotext -layout -f 36 -l 36]`
`[VERIFIED: f1040sd.pdf page 2, Schedule D Part III lines 17/20/22]`
`[VERIFIED: i1040sd.pdf p15, Schedule D Tax Worksheet header + Exception]`

### What the instructions actually say, in printed order

The instruction page states one **default** and then a list of overrides:

> "**Tax Table or Tax Computation Worksheet.** If your taxable income is less than $100,000, you must
> use the Tax Table, later in these instructions, to figure your tax. Be sure you use the correct
> column. If your taxable income is $100,000 or more, use the Tax Computation Worksheet right after
> the Tax Table.
>
> **However, don't use the Tax Table or Tax Computation Worksheet to figure your tax if any of the
> following applies.**"

and then, in this printed order: **Form 8615**, **Schedule D Tax Worksheet**, **Qualified Dividends
and Capital Gain Tax Worksheet**, **Schedule J**, **Foreign Earned Income Tax Worksheet**.

The exact override conditions, verbatim:

> **Schedule D Tax Worksheet.** Use the Schedule D Tax Worksheet in the Instructions for Schedule D
> to figure the amount to enter on Form 1040 or 1040-SR, line 16, if:
> • You have to file Schedule D, line 18 or 19 of Schedule D is more than zero, and lines 15 and 16
>   of Schedule D are gains; or
> • You have to file Form 4952 and you have an amount on line 4g, even if you don't need to file
>   Schedule D.
> But if you are filing Form 2555, you must use the Foreign Earned Income Tax Worksheet instead.

> **Qualified Dividends and Capital Gain Tax Worksheet.** Use the Qualified Dividends and Capital
> Gain Tax Worksheet, later, to figure your tax **if you don't have to use the Schedule D Tax
> Worksheet** and if any of the following applies.
> • You reported qualified dividends on Form 1040 or 1040-SR, line 3a.
> • You don't have to file Schedule D and you reported capital gain distributions on Form 1040 or
>   1040-SR, line 7a.
> • You are filing Schedule D, and Schedule D, lines 15 and 16, are both more than zero.
> But if you are filing Form 2555, you must use the Foreign Earned Income Tax Worksheet instead.

### The order the conditions must be tested in — and why order is load-bearing

The printed order is *not* the whole story. Three ordering constraints are stated explicitly in the
text, and a fourth comes from the Schedule D Tax Worksheet's own header.

```
LEVEL 0 — WRAPPERS (outermost; each RE-ENTERS levels 1–3 on a modified base)
  0a. Form 2555 filed (foreign earned income / housing exclusion or deduction)
        → Foreign Earned Income Tax Worksheet (i1040gi p37, 6 lines)
        Its line 4 says: "Figure the tax on the amount on line 3. Use the Tax Table, Tax
        Computation Worksheet, Qualified Dividends and Capital Gain Tax Worksheet, Schedule D
        Tax Worksheet, or Form 8615, whichever applies."  ← re-entry, not a peer branch
  0b. Form 8615 conditions met (child's unearned income over $2,700; under 18, or 18 without
        earned income > half of support, or full-time student 19–23 likewise)
        → Form 8615, which internally re-enters
  0c. Schedule J ELECTED (farming/fishing income averaging) — an election, never mandatory:
        "your tax MAY be less if you choose to figure it using income averaging"

LEVEL 1 — PREFERENTIAL-RATE GATE (from the Sch D TW header's own "Exception")
  1a. Form 1040 line 15 <= 0                                   → neither worksheet; tax is $0
  1b. (Sch D line 15 <= 0 OR Sch D line 16 <= 0) AND line 3a = 0 → neither worksheet

LEVEL 2 — WHICH PREFERENTIAL WORKSHEET (Sch D TW is tested STRICTLY BEFORE QDCGT)
  2a. filing Sch D AND lines 15 and 16 are both gains AND (line 18 > 0 OR line 19 > 0)
                                                              → SCHEDULE D TAX WORKSHEET
  2b. filing Form 4952 with an amount on line 4g (even without Sch D)
                                                              → SCHEDULE D TAX WORKSHEET
  2c. line 3a (qualified dividends) > 0                       → QDCGT
  2d. Sch D not required AND line 7a (capital gain distributions) > 0
                                                              → QDCGT
  2e. filing Sch D AND lines 15 and 16 both > 0               → QDCGT

LEVEL 3 — BASE TAX LOOKUP (used standalone, AND called back into from levels 0 and 2)
  3a. amount <  $100,000  → TAX TABLE
  3b. amount >= $100,000  → TAX COMPUTATION WORKSHEET
```

**Schedule D's own form face states level 2 more decidably than the prose does** — and it is worth
implementing *from the form face*, because it is a decision procedure rather than a description
(`f1040sd.pdf` page 2):

- Line 17: "Are lines 15 and 16 both gains? **Yes** → go to line 18. **No** → skip 18–21, go to 22."
- Line 20: "Are lines 18 and 19 both zero or blank and you are not filing Form 4952?
  **Yes** → Complete the Qualified Dividends and Capital Gain Tax Worksheet.
  **No** → Complete the Schedule D Tax Worksheet."
- Line 22 (reached only when 15/16 are not both gains): "Do you have qualified dividends on line 3a?
  **Yes** → QDCGT. **No** → Complete the rest of Form 1040."

`[FINDING — the two statements disagree slightly]` Schedule D line 20 says "and you are **not filing
Form 4952**"; the line-16 instructions and the Schedule D Tax Worksheet header both say "you file
Form 4952 **and you have an amount on line 4g**". The form face's version is looser — it would route
a Form 4952 filer with `line 4g = 0` to the Schedule D Tax Worksheet, which the instructions do not
require. **Recommendation: implement the instructions' stricter condition (`4952 filed AND 4g > 0`)
and record the discrepancy in a comment**, because the Sch D TW header itself (the worksheet you'd be
entering) states the stricter form. Form 4952 is out of Phase 10 scope either way; this matters for
Phase 12.

### Why a wrong order is not detectable by testing only the common path

**This is the specific trap the phase brief warns about, and it has an exact algebraic explanation.**

Swap 2a and 2c — i.e. test "does the taxpayer have qualified dividends?" *before* "does the taxpayer
have 28%-rate gain or unrecaptured §1250 gain?" — and a taxpayer with **both** gets routed to the
QDCGT instead of the Schedule D Tax Worksheet. The QDCGT taxes the whole preferential slice at
0/15/20%; the Schedule D Tax Worksheet taxes unrecaptured §1250 gain at up to **25%** (its lines
35–40) and collectibles gain at **28%** (its lines 41–43). The answer is wrong, and it is wrong in
the taxpayer's favour, so nothing screams.

The reason the common path cannot see it: **when Schedule D lines 18 and 19 are both zero and Form
4952 is not filed, the Schedule D Tax Worksheet is algebraically identical to the QDCGT.** I derived
this line by line from both printed worksheets this session `[DERIVED — see the mapping table in
§"The Schedule D Tax Worksheet"]`. So every test case that lacks §1250 or collectibles gain — which
is every ordinary brokerage return — produces the *same number* under both orderings. A green suite
of such cases proves nothing about the ordering.

**The proof that does catch it** must assert the **tagged method**, not the number:

```
dispatchLine16(profile) -> { method: 'taxTable' | 'taxComputationWorksheet'
                                   | 'qdcgt' | 'scheduleDTaxWorksheet'
                                   | refusal, ... }
```

…and then, separately, a *differential* proof asserting that on inputs where Sch D lines 18 and 19
are zero, `scheduleDTaxWorksheet` and `qdcgt` return the **same cents**. That second proof is
self-checking in a useful way: if either transcription is wrong, it goes red, and it goes red for a
reason that names both worksheets.

### Inputs each arm needs

| Arm | Inputs |
|-----|--------|
| Tax Table | filing status; taxable income (line 15) |
| Tax Computation Worksheet | filing status; taxable income (line 15) |
| QDCGT | filing status; line 15; line 3a (qualified dividends); **either** Sch D lines 15 and 16 **or** line 7a (capital gain distributions); the `zeroRateMax`/`fifteenRateMax` breakpoints; and a **Tax Table/TCW callback** for lines 22 and 24 |
| Schedule D Tax Worksheet | everything QDCGT needs, **plus** Sch D lines 18 and 19, Form 4952 lines 4e and 4g, the **24%-bracket ceiling**, and a Tax Table/TCW callback for lines 44 and 46 |

---

## The QDCGT Worksheet as an Algorithm over Integer Cents

`[VERIFIED: i1040gi.pdf p38 (printed "38"), "Qualified Dividends and Capital Gain Tax Worksheet—Line 16",
transcribed character-by-character this session]`

All 25 lines. `C` = cents as `bigint`; `min`/`max` are exact integer comparisons; `Z` = zero-rate
ceiling; `F` = fifteen-rate ceiling; `T(x)` = the level-3 base lookup (Tax Table below $100,000,
Tax Computation Worksheet at or above). **The brief's stated anchors are all confirmed exactly.**

| # | Printed instruction | Algorithm |
|---|---------------------|-----------|
| 1 | "Enter the amount from Form 1040 or 1040-SR, line 15. However, if you are filing Form 2555 …, enter the amount from line 3 of the Foreign Earned Income Tax Worksheet" | `L1 = taxableIncome` (or the FEITW line 3 — **out of scope, refuse**) |
| 2 | "Enter the amount from Form 1040 or 1040-SR, line 3a" | `L2 = qualifiedDividends` |
| 3 | "Are you filing Schedule D? **Yes.** Enter the smaller of line 15 or line 16 of Schedule D. **If either line 15 or line 16 is blank or a loss, enter -0-.** **No.** Enter the amount from Form 1040 or 1040-SR, line 7a." | `L3 = filingScheduleD ? (schedD15 <= 0n \|\| schedD16 <= 0n ? 0n : min(schedD15, schedD16)) : line7a` |
| 4 | "Add lines 2 and 3" | `L4 = L2 + L3` |
| 5 | "Subtract line 4 from line 1. **If zero or less, enter -0-**" | `L5 = max(L1 - L4, 0n)` |
| 6 | "Enter: $48,350 if single or MFS, $96,700 if MFJ or QSS, $64,750 if HoH" | `L6 = Z` — **exactly `capitalGainsBreakpoints[status].zeroRateMax`** |
| 7 | "Enter the smaller of line 1 or line 6" | `L7 = min(L1, L6)` |
| 8 | "Enter the smaller of line 5 or line 7" | `L8 = min(L5, L7)` |
| 9 | "Subtract line 8 from line 7. **This amount is taxed at 0%**" | `L9 = L7 - L8` |
| 10 | "Enter the smaller of line 1 or line 4" | `L10 = min(L1, L4)` |
| 11 | "Enter the amount from line 9" | `L11 = L9` |
| 12 | "Subtract line 11 from line 10" | `L12 = L10 - L11` |
| 13 | "Enter: $533,400 if single, $300,000 if MFS, $600,050 if MFJ or QSS, $566,700 if HoH" | `L13 = F` — **exactly `capitalGainsBreakpoints[status].fifteenRateMax`** |
| 14 | "Enter the smaller of line 1 or line 13" | `L14 = min(L1, L13)` |
| 15 | "Add lines 5 and 9" | `L15 = L5 + L9` |
| 16 | "Subtract line 15 from line 14. **If zero or less, enter -0-**" | `L16 = max(L14 - L15, 0n)` |
| 17 | "Enter the smaller of line 12 or line 16" | `L17 = min(L12, L16)` |
| 18 | "**Multiply line 17 by 15% (0.15)**" | `L18 = halfUp(L17 × 15/100)` — see §"Rounding" |
| 19 | "Add lines 9 and 17" | `L19 = L9 + L17` |
| 20 | "Subtract line 19 from line 10" | `L20 = L10 - L19` |
| 21 | "**Multiply line 20 by 20% (0.20)**" | `L21 = halfUp(L20 × 20/100)` |
| 22 | "Figure the tax on the amount on line 5. **If the amount on line 5 is less than $100,000, use the Tax Table** to figure the tax. **If the amount on line 5 is $100,000 or more, use the Tax Computation Worksheet**" | `L22 = T(L5)` |
| 23 | "Add lines 18, 21, and 22" | `L23 = L18 + L21 + L22` |
| 24 | "Figure the tax on the amount on line 1. If the amount on line 1 is less than $100,000, use the Tax Table … If $100,000 or more, use the Tax Computation Worksheet" | `L24 = T(L1)` |
| 25 | "**Tax on all taxable income. Enter the smaller of line 23 or line 24.** Also include this amount on the entry space on Form 1040 or 1040-SR, line 16. If you are filing Form 2555, don't enter this amount on line 16. Instead, enter it on line 4 of the Foreign Earned Income Tax Worksheet" | `L25 = min(L23, L24)` ← **the clamp** |

### Three easily-missed properties

1. **Lines 22 and 24 dispatch independently.** `L5 ≤ L1`, so `L5` can be below $100,000 while `L1` is
   at or above it. **A single QDCGT execution can use the Tax Table for line 22 and the Tax
   Computation Worksheet for line 24.** Worked example below. An implementation that decides "table
   or worksheet" once, from line 15, is wrong for every return with more than $100,000 of taxable
   income and a preferential slice large enough to pull line 5 under it.
2. **Only lines 5 and 16 have a "-0-" floor.** Lines 9, 12, and 20 have no floor in the printed text
   and cannot go negative given the `min`s above them — but writing them with a floor anyway would
   mask a transcription error rather than prevent one. **Recommendation: implement lines 9/12/20
   without a floor and add an `assert` that each is `>= 0n`**, so a bad transcription throws instead
   of silently clamping.
3. **Line 11 is a pure copy of line 9.** It exists on paper so a human doesn't have to look up the
   page. Keep it as a named field anyway (TAX-15: "one named pure function per worksheet carrying the
   printed form's line numbers"), because a diff against the printed worksheet must be a
   line-for-line diff.

### Where TY2025 parameters already supply the breakpoints

| Worksheet line | Printed constants | Source in `fjs/tax/params` | Match? |
|---|---|---|---|
| QDCGT 6 | 48,350 / 96,700 / 64,750 (S,MFS / MFJ,QSS / HoH) | `capitalGainsBreakpoints[status].zeroRateMax` = `'48350.00'` (single **and** MFS) / `'96700.00'` (MFJ) / `'64750.00'` (HoH) | **exact** |
| QDCGT 13 | 533,400 (S) / 300,000 (MFS) / 600,050 (MFJ,QSS) / 566,700 (HoH) | `capitalGainsBreakpoints[status].fifteenRateMax` = `'533400.00'` / `'300000.00'` / `'600050.00'` / `'566700.00'` | **exact** |
| Sch D TW 15 | same as QDCGT 6 | same | **exact** |
| Sch D TW 26 | same as QDCGT 13 | same | **exact** |
| Sch D TW 19 | 197,300 (S, MFS, **and HoH**) / 394,600 (MFJ, QSS) | `ordinaryBrackets[status].brackets[3].ceiling` (the 24% ceiling) = `'197300.00'` for single/MFS/HoH, `'394600.00'` for MFJ | **exact** |
| QDCGT 22/24, Sch D TW 44/46 | "$100,000" | `tableUpperBoundCents` in `fjs/tax/table` | **exact** |

**No new constant is required by either worksheet.** The only *rates* introduced are 15%, 20%, 25%,
28% — small integer percentages, structurally the same as `Bracket.ratePercent`, which
`fjs/tax/params`' own header already justifies storing as plain `number`.

**Recommendation:** add the preferential rates to `fjs/tax/params` as a cited group
(`preferentialRates: { fifteen: 15, twenty: 20, unrecaptured1250: 25, collectibles28: 28 }` with the
IRC §1(h) citation) rather than as bare literals inside `fjs/tax/line16`. `[ASSUMED]` — I did not
verify an IRC §1(h) subsection number this session; the Rev. Proc. gives breakpoints, not rates.

---

## The Schedule D Tax Worksheet as an Algorithm

`[VERIFIED: i1040sd.pdf pp15–16, "Schedule D Tax Worksheet" and "Schedule D Tax Worksheet—Continued",
transcribed this session]`

**It has 47 lines, not 45.** `.planning/REQUIREMENTS.md` TAX-11 does not state a count, so nothing is
contradicted, but plans should not guess.

### When it is required instead of QDCGT

The worksheet's own header is the authority, and it is stricter and more complete than the line-16
instruction prose:

> "Complete this worksheet **only if line 18 or line 19 of Schedule D is more than zero and lines 15
> and 16 of Schedule D are gains** or if you file Form 4952 and you have an amount on line 4g, even
> if you don't need to file Schedule D. Otherwise, complete the Qualified Dividends and Capital Gain
> Tax Worksheet …
>
> **Exception: Don't use the Qualified Dividends and Capital Gain Tax Worksheet or this worksheet to
> figure your tax if:**
> • Line 15 or line 16 of Schedule D is zero or less and you have no qualified dividends on Form
>   1040 … line 3a; **or**
> • **Form 1040 … line 15, is zero or less.**"

That second Exception bullet — **taxable income ≤ 0 means neither worksheet runs** — is stated only
here. It is easy to miss and it is a real gate.

**What makes Schedule D lines 18 and 19 non-zero** (this is what the harder branch actually depends
on) `[VERIFIED: f1040sd.pdf p2; i1040sd.pdf p12 "Unrecaptured Section 1250 Gain Worksheet—Line 19";
i1040sd.txt line 904 "28% Rate Gain Worksheet—Line 18"]`:

- **Schedule D line 18 — 28% rate gain**, from the 7-line *28% Rate Gain Worksheet*: collectibles
  gain/loss from Form 8949 Part II; §1202 exclusions (50%/60%/75% partial forms) reported with code
  "Q"; collectibles from Forms 4684/6252/6781/8824; **Form 1099-DIV box 2d (collectibles (28%)
  gain)**; Form 2439 box 1d; K-1s; less long-term capital loss carryovers and any Sch D line 7 loss.
- **Schedule D line 19 — unrecaptured §1250 gain**, from the 18-line *Unrecaptured Section 1250 Gain
  Worksheet*: Form 4797 §1250 property; installment sales via Form 6252; K-1 pass-throughs;
  partnership-interest sales; and amounts "reported to you as 'unrecaptured section 1250 gain' on a
  Schedule K-1, **Form 1099-DIV**, or Form 2439."

`[VERIFIED: i1040gi.pdf p31, Line 7a, Exception 1]` — the crisp statement of what forces Schedule D
at all:

> "**Exception 1.** You don't have to file Form 8949 or Schedule D if you aren't deferring any
> capital gain by investing in a qualified opportunity fund and both of the following apply.
> 1. You have no capital losses, and your only capital gains are capital gain distributions from
>    Form(s) 1099-DIV, box 2a …; and
> 2. **None of the Form(s) 1099-DIV … have an amount in box 2b (unrecaptured section 1250 gain), box
>    2c (section 1202 gain), or box 2d (collectibles (28%) gain).**"

This **confirms** `ROADMAP.md`'s Sequencing Constraint 4 ("The 1099-DIV dialect FORCES the QDCGT
worksheet (box 1b > 0) and the Schedule D Tax Worksheet (boxes 2b/2d)") — and **extends** it: **box
2c (§1202 gain) also forces Schedule D**, which the ROADMAP omits.

### The 47 lines

`P` = preferential, `O` = ordinary, `C24` = the 24%-bracket ceiling, `T(x)` = the level-3 lookup.
Form 4952 lines 3/4 are the investment-interest election; when 4952 is not filed they are zero.

| # | Algorithm | Note |
|---|---|---|
| 1 | `L1 = taxableIncome` (or FEITW line 3) | |
| 2 | `L2 = qualifiedDividends` | |
| 3 | `L3 = form4952Line4g` | |
| 4 | `L4 = form4952Line4e` | footnote: "if applicable, enter instead the smaller amount you entered on the dotted line next to line 4e" |
| 5 | `L5 = max(L3 - L4, 0n)` | |
| 6 | `L6 = max(L2 - L5, 0n)` | |
| 7 | `L7 = min(schedD15, schedD16)` | |
| 8 | `L8 = min(L3, L4)` | |
| 9 | `L9 = max(L7 - L8, 0n)` | |
| 10 | `L10 = L6 + L9` | total preferential |
| 11 | `L11 = schedD18 + schedD19` | 28% + unrecaptured §1250 |
| 12 | `L12 = min(L9, L11)` | |
| 13 | `L13 = L10 - L12` | |
| 14 | `L14 = max(L1 - L13, 0n)` | |
| 15 | `L15 = Z` | `zeroRateMax` |
| 16 | `L16 = min(L1, L15)` | |
| 17 | `L17 = min(L14, L16)` | |
| 18 | `L18 = max(L1 - L10, 0n)` | pure ordinary income |
| 19 | `L19 = min(L1, C24)` | **the 24%-bracket ceiling** — the cap that makes §1250 gain "up to 25%" |
| 20 | `L20 = min(L14, L19)` | |
| 21 | `L21 = max(L18, L20)` | **this is what gets looked up at line 44 — it can exceed pure ordinary income** |
| 22 | `L22 = L16 - L17` | taxed at 0% |
| — | **"If lines 1 and 16 are the same, skip lines 23 through 43 and go to line 44."** | everything is in the 0% zone |
| 23 | `L23 = min(L1, L13)` | |
| 24 | `L24 = L22` — "(If line 22 is blank, enter -0-.)" | |
| 25 | `L25 = max(L23 - L24, 0n)` | |
| 26 | `L26 = F` | `fifteenRateMax` |
| 27 | `L27 = min(L1, L26)` | |
| 28 | `L28 = L21 + L22` | |
| 29 | `L29 = max(L27 - L28, 0n)` | |
| 30 | `L30 = min(L25, L29)` | |
| 31 | `L31 = halfUp(L30 × 15/100)` | |
| 32 | `L32 = L24 + L30` | |
| — | **"If lines 1 and 32 are the same, skip lines 33 through 43 and go to line 44."** | |
| 33 | `L33 = L23 - L32` | |
| 34 | `L34 = halfUp(L33 × 20/100)` | |
| — | **"If Schedule D, line 19, is zero or blank, skip lines 35 through 40 and go to line 41."** | |
| 35 | `L35 = min(L9, schedD19)` | |
| 36 | `L36 = L10 + L21` | |
| 37 | `L37 = L1` | |
| 38 | `L38 = max(L36 - L37, 0n)` | |
| 39 | `L39 = max(L35 - L38, 0n)` | |
| 40 | `L40 = halfUp(L39 × 25/100)` | **unrecaptured §1250 at 25%** |
| — | **"If Schedule D, line 18, is zero or blank, skip lines 41 through 43 and go to line 44."** | |
| 41 | `L41 = L21 + L22 + L30 + L33 + L39` | |
| 42 | `L42 = L1 - L41` | |
| 43 | `L43 = halfUp(L42 × 28/100)` | **collectibles at 28%** |
| 44 | `L44 = T(L21)` — Tax Table if `< $100,000`, else TCW | |
| 45 | `L45 = L31 + L34 + L40 + L43 + L44` | |
| 46 | `L46 = T(L1)` — same dispatch | |
| 47 | `L47 = min(L45, L46)` → Form 1040 line 16 | **the same clamp as QDCGT line 25** |

### The four "skip" gates are the sharpest pitfall in this worksheet

Skipped lines are **blank**, not zero — but lines 41 and 45 *add* them. `L45 = L31 + L34 + L40 + L43
+ L44` where `L34`, `L40`, `L43` may all be blank; `L41 = L21 + L22 + L30 + L33 + L39` where `L33`
and `L39` may be blank. **Model a skipped line as `0n` at the summation site and prove each skip
condition separately**, rather than modelling "blank" as a distinct value that the summations must
then handle. A single `undefined` leaking into a `bigint` sum is a `TypeError`, not a wrong number —
which is the good failure — but `noUncheckedIndexedAccess` will surface it at compile time only if
the lines are stored in a record rather than an array.

### The degenerate-equivalence identity (the differential proof)

`[DERIVED — mapped line-by-line from both printed worksheets this session]`

When `schedD18 = 0`, `schedD19 = 0`, and Form 4952 is not filed (`L3 = L4 = 0`), the Schedule D Tax
Worksheet reduces **exactly** to the QDCGT:

| Sch D TW | QDCGT | Both equal |
|---|---|---|
| 22 | 9 | `min(T,Z) − min(O, min(T,Z))` (the 0% amount) |
| 23 | 10 | `min(T, P)` |
| 24 | 11 | the 0% amount |
| 25 | 12 | |
| 27 | 14 | `min(T, F)` |
| 28 | 15 | `O + zeroAmount` |
| 29 | 16 | |
| 30 | 17 | |
| 31 | 18 | 15% slice |
| 32 | 19 | |
| 33 | 20 | |
| 34 | 21 | 20% slice |
| 21 → 44 | 5 → 22 | `T(ordinary income)` — because `L20 = min(L14, L19) ≤ L18` forces `L21 = L18 = O` |
| 45 | 23 | |
| 46 | 24 | |
| **47** | **25** | `min(...)` |

**Recommendation:** write this as a generated proof over a table of inputs. It is the only check that
can catch a transcription error in *either* worksheet without hand-typing 47 more expected values,
and it is the check that makes the dispatch-order proof meaningful (see §"Why a wrong order is not
detectable").

---

## The Tax Computation Worksheet — It Is Already Implemented

`[VERIFIED: i1040gi.pdf p80 (printed "80"), "2025 Tax Computation Worksheet—Line 16", all four
sections, 20 rows, transcribed this session]`

The brief said "p124 Tax Computation Worksheet" — **that is wrong**: PDF page 124 is the index. The
worksheet is on **PDF/printed page 80**, which the index itself points at ("Tax computation worksheet
80"). The Tax Table occupies printed pages 68–79.

Each row is `Tax = (a) × (b) − (d)`, i.e. `rate × taxableIncome − subtraction`:

| Section | Taxable income row | Rate | Subtraction |
|---|---|---|---|
| A (Single) | 100,000–103,350 / 103,350–197,300 / 197,300–250,525 / 250,525–626,350 / over 626,350 | 22/24/32/35/37 | 5,086.00 / 7,153.00 / 22,937.00 / 30,452.75 / 42,979.75 |
| B (MFJ or QSS) | 100,000–206,700 / 206,700–394,600 / 394,600–501,050 / 501,050–751,600 / over 751,600 | 22/24/32/35/37 | 10,172.00 / 14,306.00 / 45,874.00 / 60,905.50 / 75,937.50 |
| C (MFS) | 100,000–103,350 / 103,350–197,300 / 197,300–250,525 / 250,525–375,800 / over 375,800 | 22/24/32/35/37 | 5,086.00 / 7,153.00 / 22,937.00 / 30,452.75 / 37,968.75 |
| D (HoH) | 100,000–103,350 / 103,350–197,300 / 197,300–250,500 / 250,500–626,350 / over 626,350 | 22/24/32/35/37 | 6,825.00 / 8,892.00 / 24,676.00 / 32,191.00 / 44,718.00 |

**The TCW is exactly `cumulativeBracketTaxCents` — verified, not assumed.** For a bracket with rate
`r` and lower bound `b`, the printed subtraction is `r × b − taxAt(b)`. Four spot checks, computed by
hand this session against `fjs/tax/params`' stored brackets:

| Check | TCW | `cumulativeBracketTaxCents` | Agree? |
|---|---|---|---|
| Single @ $100,000 | `0.22 × 100,000 − 5,086 = 16,914.00` | `1,192.50 + 4,386.00 + 11,335.50 = 16,914.00` | **exact** |
| MFJ @ $100,000 | `0.22 × 100,000 − 10,172 = 11,828.00` | `2,385.00 + 8,772.00 + 671.00 = 11,828.00` | **exact** |
| HoH @ $100,000 | `0.22 × 100,000 − 6,825 = 15,175.00` | `1,700.00 + 5,742.00 + 7,733.00 = 15,175.00` | **exact** |
| HoH @ $626,350 | `0.37 × 626,350 − 44,718 = 187,031.50` | `1,700 + 5,742 + 8,470 + 22,548 + 17,024 + 131,547.50 = 187,031.50` | **exact** |
| MFS @ $375,800 | `0.37 × 375,800 − 37,968.75 = 101,077.25` | `1,192.50 + 4,386 + 12,072.50 + 22,548 + 17,032 + 43,846.25 = 101,077.25` | **exact** |

**Consequence for planning:** the TCW branch of TAX-03 is *not* a new computation. It is
`cumulativeBracketTaxCents` plus (a) an `assert(income >= tableUpperBoundCents)` gate mirroring
`lookupTaxTable`'s existing refusal in the opposite direction, and (b) a proof that hand-transcribes
the **20 printed subtraction constants** and diffs the derived value against them — the same
non-tautological pattern `handTranscribedRows` already uses for the Tax Table. That proof is the
whole of the branch's risk.

### The $5 discontinuity at $100,000 is real and should be pinned

The Tax Table quantises to band midpoints; the TCW does not. At the seam:

- `lookupTaxTable(single, $99,999.99)` → row `99,950–100,000` → **$16,909** `[VERIFIED: printed table,
  i1040gi.pdf p79; already in `handTranscribedRows`]`
- `taxComputationWorksheet(single, $100,000.00)` → `0.22 × 100,000 − 5,086` = **$16,914**

A **$5 jump for one cent of income.** Both are correct. A boundary proof at
`{ $99,999.99, $100,000.00 }` asserting *both* values and the *method tag* is the right shape — it
pins the seam and it pins that the dispatch actually switched.

---

## Worked Numeric Examples (Success Criterion 2's regression proofs)

**Every "correct" value below was read off the printed Tax Table in `i1040gi.pdf` AND independently
reproduced by midpoint bracket arithmetic against `fjs/tax/params`' stored brackets.** The two agree
on every value. Printed rows used:

| Status | Row | Printed tax | Source |
|---|---|---|---|
| MFJ | 50,000–50,050 | 5,526 | p74 |
| MFJ | 80,000–80,050 | 9,126 | p77 |
| MFJ | 90,000–90,050 | 10,326 | p77 |
| MFJ | 96,700–96,750 | 11,130 | p79 |
| MFJ | 96,900–96,950 | 11,154 | p79 |
| MFJ | 96,950–97,000 | 11,163 | p79 |
| MFJ | 97,000–97,050 | 11,174 | p79 |
| Single | 48,350–48,400 | 5,567 | p74 |
| Single | 48,450–48,500 | 5,579 | p74 |
| Single | 50,000–50,050 | 5,920 | p74 |
| Single | 99,950–100,000 | 16,909 | p79 |

### ★ THE REGRESSION PAIR — one dollar apart, $1 and $12 of error

Both are **MFJ, TY2025, no Schedule D, capital gain distributions = 0**. Both take the QDCGT branch
via condition 2c (qualified dividends on line 3a).

**Case A — error $1.** Form 1040 line 15 = **$97,000.00**, line 3a = **$300.00**.

```
 1  97,000.00     6  96,700.00    11       0.00    16     300.00    21       0.00
 2     300.00     7  96,700.00    12     300.00    17     300.00    22  11,130.00  <- Tax Table, row 96,700-96,750
 3       0.00     8  96,700.00    13 600,050.00    18      45.00    23  11,175.00
 4     300.00     9       0.00    14  97,000.00    19     300.00    24  11,174.00  <- Tax Table, row 97,000-97,050
 5  96,700.00    10     300.00    15  96,700.00    20       0.00    25  11,174.00  <- min(23, 24)
```

- **Correct Form 1040 line 16 = $11,174**
- **Broken engine (reports line 23) = $11,175 — off by +$1**

**Case B — error $12.** Form 1040 line 15 = **$96,999.00**, line 3a = **$299.00**.

```
 1  96,999.00     6  96,700.00    11       0.00    16     299.00    21       0.00
 2     299.00     7  96,700.00    12     299.00    17     299.00    22  11,130.00  <- Tax Table, row 96,700-96,750
 3       0.00     8  96,700.00    13 600,050.00    18      44.85    23  11,174.85
 4     299.00     9       0.00    14  96,999.00    19     299.00    24  11,163.00  <- Tax Table, row 96,950-97,000
 5  96,700.00    10     299.00    15  96,700.00    20       0.00    25  11,163.00  <- min(23, 24)
```

- **Correct Form 1040 line 16 = $11,163**
- **Broken engine (reports line 23) = $11,175 (11,174.85) — off by +$11.85, i.e. $12 at whole dollars**

**Why this pair is the right regression proof.** The two returns differ by **one dollar** of taxable
income and one dollar of qualified dividends. Lines 1a through 15 differ by exactly that dollar. The
broken engine returns the *same* $11,175 for both. The correct engine returns $11,174 and $11,163 —
an $11 swing. **A proof pinning both cases catches any weakening of the clamp, and catches a
mis-transcribed Tax Table band edge at the same time**, because case A's line 24 and case B's line 24
land in adjacent rows.

**Decomposition of case B's $11.85** (so a failure can be diagnosed rather than merely observed):

| Component | Amount |
|---|---|
| Line 22's row overstates the ordinary tax: the table charges tax on the band midpoint `$96,725`, not on `$96,700` (`$25` at 12%) | `+$3.00` |
| Line 24's row understates the total tax: the table charges tax on the band midpoint `$96,975`, not on `$96,999`. Exact `T(96,999) = $11,167.78`; the table prints `$11,163` | `+$4.78` |
| Bracket inversion: `$250` of the preferential slice sits between the 0% ceiling (`$96,700`) and the 12% ceiling (`$96,950`), charged 15% instead of 12% | `+$7.50` |
| Bracket alignment: the remaining `$49` sits above the 12% ceiling, charged 15% instead of 22% | `−$3.43` |
| **Total** | **`+$11.85`** |

Check: line 23 `= 11,130.00 + 44.85 = 11,174.85`; line 24 `= 11,163.00`; difference `= 11.85`. The
four components sum to `3.00 + 4.78 + 7.50 − 3.43 = 11.85` exactly — no residual rounding term,
because `0.15 × 299 = 44.85` is already an exact number of cents.

### `[CORRECTION]` The true maximum is about $13–$14, not $12

`ROADMAP.md` and `REQUIREMENTS.md` describe the symptom as "$1–$12". That is a good description of
what people notice, but it is **not a bound**. MFJ, line 15 = **$96,949.00**, line 3a = **$249.00**:

- line 5 = 96,700 → line 22 = **11,130**; line 18 = `0.15 × 249` = **37.35**; line 23 = **11,167.35**
- line 24 = table(96,949) → row `96,900–96,950` → **11,154**
- **error = $13.35** (`$13` at whole dollars; `$13.50` if you push line 15 to `96,949.99`)

**This is not a reason to change the roadmap wording** — it is a reason for the proof suite to pin
*specific* worked cases rather than assert "the error is between $1 and $12." Any range assertion
would be wrong.

### Control leg — the case where `min()` does NOT bind

AGENTS.md: "A gate needs a control. A proof that something is refused must be paired with one showing
the legitimate case is not." Here, a proof that `min()` clamps must be paired with one showing it
does not clamp when it shouldn't.

**MFJ, line 15 = $90,000.00, line 3a = $10,000.00.**

```
 1  90,000.00     6  96,700.00    11  10,000.00    16       0.00    21       0.00
 2  10,000.00     7  90,000.00    12       0.00    17       0.00    22   9,126.00  <- Tax Table, row 80,000-80,050
 3       0.00     8  80,000.00    13 600,050.00    18       0.00    23   9,126.00
 4  10,000.00     9  10,000.00    14  90,000.00    19  10,000.00    24  10,326.00  <- Tax Table, row 90,000-90,050
 5  80,000.00    10  10,000.00    15  90,000.00    20       0.00    25   9,126.00  <- min picks 23
```

**Line 16 = $9,126.** The saving is exactly `12% × $10,000 = $1,200` — the whole $10,000 of qualified
dividends is inside the 0% zone. `min()` picks line 23 here; an engine that *always* took line 24
would over-tax by $1,200, which is the opposite failure and equally worth a proof.

### Branch coverage cases (one per TAX-03 branch)

**(i) Tax Table alone** — no qualified dividends, no capital gain: MFJ line 15 = `$25,300.00` →
`$2,562`. **This is the IRS's own printed Example** on the Tax Table's first page
`[VERIFIED: i1040gi.pdf p68]`, which makes it the ideal smoke test: the expected value is printed by
the IRS, not derived by us.

**(ii) Tax Computation Worksheet alone** — single, line 15 = `$100,000.00` → `0.22 × 100,000 − 5,086`
= **`$16,914`**. Pair with `$99,999.99 → $16,909` (Tax Table) to pin the seam.

**(iii) QDCGT with a split dispatch inside one worksheet** — MFJ, line 15 = `$120,000.00`,
line 3a = `$30,000.00`:

```
 5  90,000.00   ->  line 22 = Tax Table (90,000 < 100,000), row 90,000-90,050 = 10,326
 9   6,700.00       line 17 = 23,300.00   line 18 = 3,495.00   line 21 = 0.00
 1 120,000.00   ->  line 24 = Tax Computation Worksheet (120,000 >= 100,000)
                             = 0.22 x 120,000 - 10,172 = 16,228.00
23  13,821.00       24  16,228.00       25  13,821.00
```

**Line 16 = $13,821.** This one case proves that lines 22 and 24 dispatch **independently**. It is
the case an implementation that decides the method once from line 15 gets wrong.

**(iv) All three preferential rates plus both lookups** — MFJ, line 15 = `$700,000.00`,
line 3a = `$0`, line 7a (net long-term capital gain) = `$650,000.00`:

```
 5  50,000.00    9  46,700.00 (0%)   17 503,350.00   18  75,502.50 (15%)
10 650,000.00   14 600,050.00        20  99,950.00   21  19,990.00 (20%)
22   5,526.00  <- Tax Table, MFJ row 50,000-50,050
23 101,018.50
24 184,094.50  <- TCW, MFJ "over 501,050 not over 751,600": 0.35 x 700,000 - 60,905.50
25 101,018.50
```

**Line 16 = $101,018.50 (→ $101,019 at whole dollars).** Exercises 0% + 15% + 20% + Tax Table +
Tax Computation Worksheet in a single execution.

**(v) Schedule D Tax Worksheet** — **cannot be exercised end to end in Phase 10**, because Schedule D
lines 15/16/18/19 require Schedule D, which is Phase 12 (TAX-11). See §"Open Question 3" for the two
viable options.

---

## Standard Deduction, Age and Blindness (Success Criterion 3)

### The Standard Deduction Chart, transcribed

`[VERIFIED: i1040gi.pdf p35 (printed "35"), "Standard Deduction Chart for People Who Were Born Before
January 2, 1961, or Were Blind"]`

| Filing status | Boxes checked | Standard deduction |
|---|---|---|
| Single | 1 / 2 | $17,750 / $19,750 |
| Married filing jointly | 1 / 2 / 3 / 4 | $33,100 / $34,700 / $36,300 / $37,900 |
| Qualifying surviving spouse | 1 / 2 | $33,100 / $34,700 |
| Married filing separately | 1 / 2 / 3 / 4 | $17,350 / $18,950 / $20,550 / $22,150 |
| Head of household | 1 / 2 | $25,625 / $27,625 |

The per-increment amount is given by the *Standard Deduction Worksheet for Dependents*, line 4b
`[VERIFIED: i1040gi.pdf p35]`:

> "If born before January 2, 1961, or blind, multiply the number on line 1 by **$1,600 ($2,000 if
> single or head of household)**"

### Cross-check against `fjs/tax/params` — **NO DISAGREEMENT FOUND**

Phase 8 stored `15750.00 / 31500.00 / 15750.00 / 23625.00` citing Rev. Proc. 2025-32 §3.01, and
`agedOrBlindAdditional = { married: '1600.00', unmarried: '2000.00' }` citing Rev. Proc. 2024-40
§2.15(3). Every chart row reproduces exactly:

| Status | Base (params) | Increment (params) | 1 box | 2 | 3 | 4 | Chart | Match |
|---|---|---|---|---|---|---|---|---|
| Single | 15,750 | 2,000 | 17,750 | 19,750 | — | — | 17,750 / 19,750 | **exact** |
| MFJ | 31,500 | 1,600 | 33,100 | 34,700 | 36,300 | 37,900 | 33,100 / 34,700 / 36,300 / 37,900 | **exact** |
| QSS | 31,500 | 1,600 | 33,100 | 34,700 | — | — | 33,100 / 34,700 | **exact** |
| MFS | 15,750 | 1,600 | 17,350 | 18,950 | 20,550 | 22,150 | 17,350 / 18,950 / 20,550 / 22,150 | **exact** |
| HoH | 23,625 | 2,000 | 25,625 | 27,625 | — | — | 25,625 / 27,625 | **exact** |

**Three additional independent confirmations of the base amounts found this session:**

1. The **Form 1040 (2025) face itself** prints them in the left margin beside line 12e: "• Single or
   Married filing separately, $15,750 • Married filing jointly or Qualifying surviving spouse,
   $31,500 • Head of household, $23,625" `[VERIFIED: f1040.txt / f1040.pdf page 2]`.
2. The Standard Deduction Worksheet for Dependents, line 3 `[VERIFIED: i1040gi.pdf p35]`.
3. The chart above, by subtraction.

**Phase 8's figures and citations are correct. Nothing to report as a disagreement.**

### ★ The trap: MFS takes the $1,600 increment while sharing single's $15,750 base

This is the one place a plausible implementation goes wrong. `single` and `marriedFilingSeparately`
have the **same base** (`$15,750`) but **different increments** (`$2,000` vs `$1,600`). Any
implementation that derives the increment from the base amount, or that partitions statuses as
"unmarried = not MFJ", gets MFS wrong by **$400 per box** — up to $1,600 on a return with four boxes.

The governing rule is Rev. Proc. 2024-40 §2.15(3)'s wording, which `fjs/tax/params`' field names
compress: the $2,000 amount applies to an individual who is **"unmarried and not a surviving
spouse."** So:

- `$2,000` — single, head of household
- `$1,600` — married filing jointly, married filing separately, **and qualifying surviving spouse**

`[MINOR DOC ISSUE]` `fjs/tax/params`' names `agedOrBlindAdditional.unmarried` / `.married` are a
lossy compression of that rule: a QSS filer is not married, yet takes the `married` amount.
**Recommendation: leave the field names (renaming stored data mid-project is not worth it) and add a
sentence to the docstring** stating the rule as "unmarried and not a surviving spouse → $2,000;
otherwise $1,600," with the chart values as the witness.

### Every combination the declared profile can produce

The profile is **65+, brokerage sales, dependents, itemizing**. Criterion 3 asks for "a proof at each
combination the taxpayer profile can produce."

**Box-count maxima, from the instructions** `[VERIFIED: i1040gi.pdf p33–p35]`:

- **Boxes are on line 12d**: "You: Were born before January 2, 1961 / Are blind. Spouse: Was born
  before January 2, 1961 / Is blind."
- "**Don't check any boxes for your spouse if your filing status is head of household.**" → HoH max 2.
- Single max 2 (no spouse). QSS max 2 (chart stops at 2).
- MFS may check spouse boxes "if your spouse had no income, isn't filing a return, and can't be
  claimed as a dependent on another person's return." → MFS max 4.
- MFJ max 4.

**The full enumeration (17 leaves) the proof must cover:**

| Status | Boxes | Expected 12e |
|---|---|---|
| single | 0 / 1 / 2 | 15,750 / 17,750 / 19,750 |
| marriedFilingJointly | 0 / 1 / 2 / 3 / 4 | 31,500 / 33,100 / 34,700 / 36,300 / 37,900 |
| marriedFilingSeparately | 0 / 1 / 2 / 3 / 4 | 15,750 / 17,350 / 18,950 / 20,550 / 22,150 |
| headOfHousehold | 0 / 1 / 2 | 23,625 / 25,625 / 27,625 |
| qualifyingSurvivingSpouse | 0 / 1 / 2 | 31,500 / 33,100 / 34,700 |

**`fjs/tax/params` has no `qualifyingSurvivingSpouse` status.** `IndividualFilingStatus` is
`single | marriedFilingJointly | marriedFilingSeparately | headOfHousehold`, plus
`estatesAndTrusts`. QSS is a distinct filing status on the 1040 face and every worksheet names it
separately, even though every *amount* it uses equals MFJ's. **Modelling QSS as an alias of MFJ is
correct for amounts but wrong for the box-count maximum** (MFJ allows 4, QSS allows 2). See
§"Open Question 4".

**Hand-type the 17 expected values.** AGENTS.md: "A proof's expected value must not be produced by
the code under test." Computing `base + n × increment` in the proof would be the code under test.

### The five exceptions that override the chart

`[VERIFIED: i1040gi.pdf p34, "Line 12e Standard Deduction or Itemized Deductions"]` — all five must be
handled or refused:

| # | Trigger | Effect |
|---|---|---|
| 1 | Line 12a checked (someone can claim you or your spouse as a dependent) | Use the **Standard Deduction Worksheet for Dependents**, not the chart |
| 2 | Line 12b checked (MFS and your spouse itemizes) | **Standard deduction is zero**, even if born before Jan 2 1961 or blind |
| 3 | Line 12c checked (dual-status alien) | **Standard deduction is zero**, likewise |
| 4 | Line 12d checked (age/blindness) | Use the chart |
| 5 | Net qualified disaster loss elected | Use Schedule A to figure the standard deduction |

Exceptions 2 and 3 are **hard zeros that survive age and blindness** — that combination is exactly
the kind of thing an increment-first implementation gets wrong. Exception 5 requires Schedule A →
**refuse in Phase 10**.

### The Standard Deduction Worksheet for Dependents (Exception 1)

`[VERIFIED: i1040gi.pdf p35]` — 4 lines, and the profile *does* include dependents (though it is the
taxpayer's own dependency status that triggers this, not having dependents):

```
1. total boxes checked on 12d
2. earnedIncome > $900 ? earnedIncome + $450 : $1,350
3. $15,750 (S/MFS) | $31,500 (MFJ) | $23,625 (HoH)
4a. min(line 2, line 3)   -- if born after Jan 1 1961 and not blind, STOP here
4b. line 1 x $1,600  ($2,000 if single or head of household)
4c. 4a + 4b  -> Form 1040 line 12e
```

`$1,350` and `$450` are already stored as `dependentStandardDeductionCap.{minimum,earnedIncomeAddOn}`
citing Rev. Proc. 2024-40 §2.15(2) — **verified identical to the printed worksheet.** The `$900`
threshold on line 2 is `2 × $450` and is **not** stored; it is the worksheet's own restatement.
`[Recommendation: derive it as `earnedIncomeAddOn × 2` with a comment, or store it with its own
citation — do not hand-type `900` as a bare literal.]`

Note the worksheet's line 3 does **not** list QSS. `[ASSUMED]` QSS uses $31,500 there, by parity with
the Form 1040 margin and the chart.

---

## Form 1040 Lines 1a–37: What Is In Scope, and What TAX-16 Must Refuse

`[VERIFIED: f1040.pdf / f1040.txt, both pages, read in full this session]`

**The 2025 form face runs 1a … 38.** Line 37 is "amount you owe"; line 38 is "estimated tax penalty."
So "lines 1a–37" is the whole face except the penalty line. Note the 2025 form has lines the 2024
form did not: **11a and 11b** (AGI stated on page 1 and restated on page 2) and **13b** (Additional
deductions from Schedule 1-A, line 38 — the OBBBA tips/overtime/car-loan-interest/senior deductions).

Modeled document dialects today: `vnd.fjs.w2`, `vnd.fjs.1099int`, `vnd.fjs.medical_expenses`,
`vnd.fjs.ocr`.

| Line | Content | Phase 10 status | Blocked by |
|---|---|---|---|
| 1a | Total from Form(s) W-2 box 1 | **COMPUTE** — `w2.box1WagesTipsOtherCompensation` | — |
| 1b–1h | Household employee wages; unreported tips; Medicaid waiver; dependent-care benefits (Form 2441); adoption benefits (Form 8839); Form 8919 wages; other earned income | **REFUSE** per declared kind | no dialect / Forms 2441, 8839, 8919 |
| 1i | Nontaxable combat pay election | **REFUSE** | no dialect |
| 1z | `1a + … + 1h` | **COMPUTE** if every contributing kind is in scope | — |
| 2a | Tax-exempt interest | **COMPUTE** — `1099int.box8TaxExemptInterest` | — |
| 2b | Taxable interest | **COMPUTE** — `1099int.box1InterestIncome` + `box3UsSavingsBondsAndTreasuryInterest` | — |
| 3a / 3b | Qualified dividends / ordinary dividends | **REFUSE** | `vnd.fjs.1099div` — Phase 12 (DOC-06) |
| 4a / 4b | IRA distributions / taxable amount | **REFUSE** | `vnd.fjs.1099r` — Phase 11 |
| 5a / 5b | Pensions and annuities / taxable amount | **REFUSE** | `vnd.fjs.1099r` — Phase 11 |
| 6a / 6b | Social security benefits / taxable amount | **REFUSE** | `vnd.fjs.ssa1099` + Social Security Benefits Worksheet — TAX-10, Phase 13 |
| 7a / 7b | Capital gain or (loss); "Schedule D not required" checkbox | **REFUSE** | Schedule D / Form 8949 — TAX-11, Phase 12 |
| 8 | Additional income from Schedule 1 line 10 | **REFUSE** | Schedule 1 — TAX-14, Phase 13 |
| 9 | Total income = `1z + 2b + 3b + 4b + 5b + 6b + 7a + 8` | **COMPUTE** only if every summand is in scope | — |
| 10 | Adjustments from Schedule 1 line 26 | **REFUSE** | Schedule 1 — Phase 13 |
| 11a / 11b | AGI = `9 − 10`; restated on page 2 | **COMPUTE** | — |
| 12a–12d | Dependency, spouse-itemizes, dual-status, age/blindness checkboxes | **DECLARED** — from the new return profile | — |
| 12e | Standard deduction **or** itemized deductions from Schedule A | **COMPUTE** the standard deduction; **REFUSE** if itemizing is declared | Schedule A — TAX-13, Phase 13 |
| 13a | QBI deduction from Form 8995 / 8995-A | **REFUSE** | Form 8995 — not in any phase yet |
| 13b | Additional deductions from Schedule 1-A line 38 | **REFUSE — and this is mandatory for the declared profile** | Schedule 1-A — TAX-09, Phase 13 |
| 14 | `12e + 13a + 13b` | **COMPUTE** if all three in scope | — |
| 15 | Taxable income = `max(11b − 14, 0)` | **COMPUTE** | — |
| 16 | Tax — the four-way dispatch | **COMPUTE** for the Tax Table / TCW / QDCGT arms; **REFUSE** for Sch D TW, Form 8615, Schedule J, Form 2555 | Phase 12 for Sch D TW; the rest out of profile |
| 17 | Amount from Schedule 2 line 3 (AMT, excess PTC) | **REFUSE** | Schedule 2 — Phase 13 |
| 18 | `16 + 17` | **COMPUTE** if both in scope | — |
| 19 | Child tax credit / credit for other dependents from Schedule 8812 | **REFUSE — mandatory given the profile's dependents** | Schedule 8812 — TAX-12, Phase 13 |
| 20 | Amount from Schedule 3 line 8 | **REFUSE** | Schedule 3 — Phase 13 |
| 21 | `19 + 20` | **COMPUTE** if both in scope | — |
| 22 | `max(18 − 21, 0)` | **COMPUTE** | — |
| 23 | Other taxes from Schedule 2 line 21 (incl. self-employment) | **REFUSE** | Schedule 2 — Phase 13 |
| 24 | Total tax = `22 + 23` | **COMPUTE** if both in scope | — |
| 25a | Federal income tax withheld from Form(s) W-2 | **COMPUTE** — `w2.box2FederalIncomeTaxWithheld` | — |
| 25b | Withheld from Form(s) 1099 | **PARTIAL** — `1099int.box4FederalIncomeTaxWithheld` is in scope; 1099-R/1099-DIV/1099-B withholding is not → **refuse if declared** | Phases 11/12 |
| 25c | Other forms | **REFUSE** | no dialect |
| 25d | `25a + 25b + 25c` | **COMPUTE** if all in scope | — |
| 26 | 2025 estimated tax payments and amount applied from 2024 | **DECLARED** — taxpayer-supplied, no document | — |
| 27a | Earned income credit | **REFUSE** | Schedule EIC |
| 28 | Additional child tax credit from Schedule 8812 | **REFUSE** | Phase 13 |
| 29 | American opportunity credit (Form 8863) | **REFUSE** | no dialect |
| 30 | Refundable adoption credit (Form 8839) | **REFUSE** | no dialect |
| 31 | Amount from Schedule 3 line 15 | **REFUSE** | Phase 13 |
| 32 | `27a + 28 + 29 + 30 + 31` | **COMPUTE** if all in scope | — |
| 33 | Total payments = `25d + 26 + 32` | **COMPUTE** if all in scope | — |
| 34 | Overpayment: `33 > 24 ? 33 − 24 : —` | **COMPUTE** | — |
| 35a | Amount of 34 refunded | **DECLARED** (taxpayer election) | — |
| 36 | Amount of 34 applied to 2026 estimated tax | **DECLARED** | — |
| 37 | Amount you owe = `24 − 33` | **COMPUTE** | — |
| *(38)* | Estimated tax penalty | **out of "1a–37"** | — |

### Line 16 carries more than the tax on taxable income

`[VERIFIED: i1040gi.pdf p34, "Line 16 Tax"]` — line 16 is a *sum*, and the form face has three
checkboxes next to it:

> "Include in the total on the entry space on line 16 all of the following taxes that apply.
> • Tax on your taxable income … • Tax from Form(s) 8814 … • Tax from Form 4972 (lump-sum
> distributions) … • Tax with respect to a section 962 election … • Recapture of an education credit
> … • Any tax from Form 8621, line 16e … • Tax from Form 8978, line 14 …"

**All six add-ons are out of scope and must be named refusals.** An engine that models line 16 as
"the dispatch result" and silently omits the add-ons is exactly TAX-16's failure mode.

### The 65+ profile makes two refusals unavoidable

The declared profile is 65+ with dependents. That forces:

- **Line 13b (Schedule 1-A, enhanced deduction for seniors)** — `[VERIFIED: i1040gi.pdf p110–111]`
  "$6,000 per person … If you are married filing jointly, and both you and your spouse were born
  before January 2, 1961 … $12,000 … reduced if your MAGI is more than $150,000 (MFJ) / $75,000
  (single, HoH, QSS)."
- **Line 19 (Schedule 8812)** — dependents.

`ROADMAP.md` already accepts this: "A 65+ TY2025 return omitting Schedule 1-A is structurally wrong,
not merely incomplete." **Phase 10's acceptance is that these produce loud, named refusals — not
that the return computes.**

---

## The TAX-16 Scope Guard

### The structural finding: a store-driven guard is unsound

TAX-16 says an unmodeled input must cause a loud refusal. The obvious implementation — "when
`fjs_run` encounters a document whose dialect we don't model, refuse" — **cannot work**, for a reason
that is easy to state and easy to miss:

> The engine never sees the documents it cannot read.

A taxpayer with a 1099-DIV in a drawer and none in CAS produces an empty dividend line. So does a
taxpayer with no dividends at all. **An absent document is indistinguishable from an absent
income kind.** A guard driven by store contents refuses only when the user happened to store an
unreadable document, and stays silent in exactly the case that matters.

This is the same discipline `fjs/tax/params` already names — DOC-11's "absent is not zero," applied
one level up: **an absent line is not zero either, unless something says it is.**

### The design

Three pieces, none of which exists today:

**1. A declared return profile (a new dialect).** Something like `vnd.fjs.return_profile`, built on
`fjs/document/base` and registered in `fjs/server/finance_schema`'s `dialectSchemas`, carrying:

- `taxYear`, `filingStatus`
- the line 12a/12b/12c/12d checkbox facts (dependency, spouse itemizes, dual-status, born-before-
  Jan-2-1961 and blind, for taxpayer and spouse)
- dependents
- **a declared set of income and deduction kinds the taxpayer has** — a frozen vocabulary, e.g.
  `'wages' | 'interest' | 'taxExemptInterest' | 'ordinaryDividends' | 'qualifiedDividends' |
  'iraDistributions' | 'pensions' | 'socialSecurity' | 'capitalGainDistributions' | 'capitalGains' |
  'unrecaptured1250Gain' | 'collectiblesGain' | 'itemizedDeductions' | 'qbi' | 'seniorDeduction' | …`
- taxpayer-supplied non-document amounts (line 26 estimated payments, line 36 election)

This artefact is not optional bookkeeping. It is **simultaneously** the only source for line 12a–12d,
the only source `ReportLine.sources` can cite for line 12e (see §"Open Question 1"), and the only
thing the scope guard can compare against.

**2. A declared modeled-capability set.** A frozen list, in code, of the kinds this engine models —
the mirror image of `fjs/guest`'s frozen four-command vocabulary. `fjs/guest`'s
`_CasOpIsExactlyTheFourCommands` conditional-type assertion is the precedent: make the set's
completeness a `tsc` property, so adding a `Kind` to the vocabulary without adding it to either the
modeled set or the refusal table fails to compile.

**3. `classifyScope` — one function, one place.** Modelled directly on `classifyRunOutcome`
(`fjs/report/guard`): one exported function that is the **only** place the comparison happens, so
mutating its body is the only way to change the rule either call site enforces. That module's own
header records what happened last time the rule existed twice: 258 green tests over a decorative
gate.

### The refusal shape

AGENTS.md: `assert`/`unwrap`/`match` throw **bare values**, never `Error`s, and
`fjs/tax/table`'s `lookupTaxTable` sets the in-repo precedent — it throws an array naming both the
offending value and the remedy, and its proof asserts the **content**, not merely that it threw:

```
assert(threw, ...)
assert(message.includes('100,000'), ...)
assert(message.includes('Tax Computation Worksheet'), ...)
```

**Recommendation: the scope refusal is a bare array with four elements**, so a proof can assert each
independently rather than string-matching one sentence:

```
[
  'unmodeled input',
  '1040 line 6b',                                     // the line that cannot be computed
  'taxable social security benefits',                 // the declared kind that is unmodeled
  'requires vnd.fjs.ssa1099 and the Social Security Benefits Worksheet (TAX-10, Phase 13)',
]
```

**And the proof for it must be paired with a control** (AGENTS.md: "A gate needs a control"): the
same profile with the social-security kind removed must compute lines 1a–37 successfully. A guard
that refuses everything otherwise passes.

**Deliberate omission is not the same as a refusal.** If a line is *legitimately* zero — the taxpayer
declared no interest income and no 1099-INT exists — that is not a refusal, it is `0n` with the
profile document as its source. The distinction is entirely carried by the declared kind set, which
is why the profile is load-bearing rather than convenient.

### Interaction with the existing zero-read kill condition

`classifyRunOutcome` refuses a run with zero observed CAS reads. A profile-only return (no income
documents) still reads the profile document, so it passes the read gate and then either computes
(all lines legitimately zero) or refuses on scope. The two gates are orthogonal and both should
have proofs; neither subsumes the other.

---

## Rounding

### What the IRS actually says

`[VERIFIED: i1040gi.pdf p23, "Rounding Off to Whole Dollars" — quoted verbatim]`

> "You can round off cents to whole dollars on your return and schedules. **If you do round to whole
> dollars, you must round all amounts.** To round, drop amounts under 50 cents and increase amounts
> from 50 to 99 cents to the next dollar. For example, $1.39 becomes $1 and **$2.50 becomes $3**.
>
> **If you have to add two or more amounts to figure the amount to enter on a line, include cents
> when adding the amounts and round off only the total.**
>
> If you are entering amounts that include cents, make sure to include the decimal point. There is no
> cents column on the form."

**This is `round(sum)`, never `sum(round)`, stated by the IRS in one sentence** — EXACT-04's rule,
from the governing document rather than from our own notes. Three further facts fall out of it:

1. **Whole-dollar rounding is an election, and it is all-or-nothing.** "You *can* round … *if you do*
   … you must round *all* amounts."
2. **The tie-break is away from zero.** "$2.50 becomes $3" — exactly
   `fjs/types/rational`'s `halfUp`, and exactly not `Math.round`.
3. **The rounding unit is the *line*, not the value.** Which is why `fjs/types/rational` deliberately
   ships no `roundEach`/`mapRound`.

### Where the IRS actually rounds

| Site | Rounds? | Evidence |
|---|---|---|
| Every 1040 / schedule / worksheet line | Optionally, to whole dollars, all-or-nothing | p23 |
| Tax Table rows | **Always, to whole DOLLARS** — the printed table has no cents | Phase 8's finding, re-confirmed: MFJ `$18,000–$18,050` midpoint `$18,025.00` → exact `$1,802.50` → printed **`1,803`** |
| Tax Computation Worksheet | Not stated | `[ASSUMED]` follows the general p23 rule; the printed columns show `$` with no cents column on the form |
| QDCGT lines 18 / 21, Sch D TW 31 / 34 / 40 / 43 | Not stated; these are the only lines that *create* fractional cents | see below |

### The one real decision

`0.15 × $299.99 = $44.9985` — **fractional cents.** The engine must decide, once and explicitly:

- **(a) Cents regime.** Carry exact `bigint` cents everywhere; `halfUp` to cents at each worksheet
  line boundary; take whole dollars only where the Tax Table itself forces them (lines 22/24, 44/46).
- **(b) Whole-dollar regime.** `halfUp` to whole dollars at every line boundary, matching a return
  where the taxpayer elected whole dollars.

**Recommendation: (a), with the whole-dollar election as a separate, explicit projection applied at
report time.** Reasons: exact cents is what `fjs/exact` already provides; the whole-dollar election is
a *presentation* decision that Phase 14's acceptance against a real filed return will need to match;
and rounding twice (to cents, then to dollars) is not the same as rounding once, so the projection
must apply to the **unrounded** line value, not to the cents-rounded one.

**A worksheet line IS a line boundary for EXACT-04 purposes.** `[Recommendation — needs locking in
discuss]` The IRS worksheets have printed entry spaces per line, which is what "line" means in the
p23 rule. Treating the whole QDCGT as one boundary and carrying exact rationals through to line 25
would produce different pennies than the IRS's own procedure.

### `[FINDING]` Success Criterion 5 is not demonstrable without the whole-dollar election

Criterion 5 asks for `round(sum)` vs `sum(round)` "verified on a line aggregating ten or more
documents with real cents." **In the cents regime this is vacuous**: ten `1099int.box1InterestIncome`
values parse to exact `bigint` cents, and summing `bigint`s involves no rounding at all, so
`round(sum) === sum(round)` trivially. The counterexample only exists at the whole-dollar boundary.

**Recommendation:** demonstrate criterion 5 on line 2b with **ten 1099-INT documents at `'1.39'`
each**, using the IRS's own printed example value:

- `round(sum)` = `halfUp($13.90)` = **$14** ← correct, and what the IRS instructs
- `sum(round)` = `10 × halfUp($1.39)` = `10 × $1` = **$10** ← wrong by $4

`fjs/types/rational`'s existing `proof.lineRoundingVsPerItemRounding` already exhibits the
mathematical fact abstractly; this makes it concrete on a real 1040 line with real document sources.
**This means Phase 10 must implement the whole-dollar election** — the ROADMAP does not say so
explicitly, and a plan that omits it cannot satisfy criterion 5.

---

## Architecture Patterns

### System architecture

```
 [ vnd.fjs.return_profile ]  [ vnd.fjs.w2 ]  [ vnd.fjs.1099int ]     <- CAS documents
              |                    |                |
              |                    +--------+-------+
              |                             |
              v                             v
   +----------------------+       +-------------------------+
   | fjs/return/scope     |       | fjs/form1040/core       |
   | classifyScope        |       | lines 1a..15 as         |
   | declaredKinds        |------>| ReportLine (value+       |
   |   vs modeledKinds    | THROW | sources+rule)            |
   +----------------------+ bare  +-------------------------+
              |            array               |
              |                            line 15 (taxable income)
              |                                |
              |                                v
              |                    +-------------------------+
              |                    | fjs/tax/line16          |
              |                    | dispatchLine16 ---------+---> { method, cents }
              |                    +-------------------------+
              |                       |        |         |        \
              |                       v        v         v         v
              |                  taxTable   TCW      qdcgt     scheduleDTaxWorksheet
              |                       |        |         |         (REFUSAL until Phase 12)
              |                       |        |         | lines 22 & 24 dispatch
              |                       |        |         | INDEPENDENTLY back into
              |                       +--------+<--------+  taxTable / TCW
              |                                |
              v                                v
   +----------------------+        +-------------------------+
   | fjs/tax/deduction    |------->| fjs/form1040/core       |
   | line 12e (chart /    |        | lines 16..37            |
   |  dependents wksht /  |        +-------------------------+
   |  exceptions 2,3 = 0) |                    |
   +----------------------+                    v
                                     report: ReportLine[] + RunOutcome
                                     (fjs/report/guard: zero-read kill)
```

### Recommended project structure

```
fjs/
├── return/
│   ├── profile/module.f.js     # vnd.fjs.return_profile dialect (12a-12d, filing status,
│   │                           #   declared income/deduction kinds, taxpayer-supplied amounts)
│   └── scope/module.f.js       # classifyScope: declaredKinds x modeledKinds -> ok | bare-array throw
├── tax/
│   ├── params/module.f.js      # EXISTING - add preferentialRates {15,20,25,28} with citations
│   ├── table/module.f.js       # EXISTING - add taxComputationWorksheet + its 20-row diff proof
│   ├── boundary/module.f.js    # EXISTING - unchanged
│   ├── deduction/module.f.js   # line 12e: chart, dependents worksheet, exceptions 1-5
│   └── line16/
│       ├── module.f.js         # dispatchLine16 -> tagged method; the seam proofs
│       ├── qdcgt/module.f.js   # 25 named lines
│       └── scheduled/module.f.js # 47 named lines (may land as a refusal stub in Phase 10)
└── form1040/
    └── core/module.f.js        # lines 1a-37 as ReportLine, with source union
```

### Pattern 1: one named field per printed worksheet line

TAX-15 mandates it; the diff against the printed page depends on it.

```js
/**
 * QDCGT (2025 Form 1040 instructions, p38). Every field is the printed line
 * number. Never collapse two printed lines into one expression, even when
 * one is a pure copy of another (line 11 copies line 9) -- a line-for-line
 * diff against the printed page is the only check that catches a
 * transcription error, and it can only be line-for-line if the lines exist.
 * @typedef {{
 *   readonly line1: bigint, readonly line2: bigint,  ... readonly line25: bigint,
 * }} Qdcgt
 */
```

### Pattern 2: the dispatch returns a TAG, not just a number

```js
/** @typedef {'taxTable' | 'taxComputationWorksheet' | 'qdcgt' | 'scheduleDTaxWorksheet'} Line16Method */
/** @typedef {{ readonly method: Line16Method, readonly cents: bigint }} Line16Result */
```

A proof asserting only `cents` cannot distinguish "chose QDCGT and got the right answer" from "chose
the Tax Table and got the right answer because the taxpayer had no preferential income." The method
tag is what makes TAX-03's "explicit dispatch" testable.

### Pattern 3: `ReportLine.sources` is the union of its inputs' sources

```js
// line 9 = 1z + 2b + 3b + 4b + 5b + 6b + 7a + 8
// sources = concat of every contributing line's sources, deduplicated by
// (documentHash, boxPath). Line 16 therefore transitively cites every
// document that fed line 15 -- which is what PROV-02 asks for.
```

The non-empty-tuple type makes the union safe: concatenating non-empty tuples is non-empty.

### Anti-patterns to avoid

- **Deciding "table or worksheet" once from line 15.** QDCGT lines 22 and 24 dispatch independently.
- **Returning `0n` for a line whose inputs are unmodeled.** That is the silent omission TAX-16 exists
  to prevent, and it is indistinguishable from a legitimate zero at the type level unless the guard
  runs first.
- **Deriving the aged/blind increment from the base amount.** MFS and single share `$15,750` and take
  different increments.
- **Branching on `instanceof Error` anywhere near the scope guard.** AGENTS.md: refusals are bare
  values; `e instanceof Error` is `false` for every one of them.
- **Modelling the Schedule D Tax Worksheet's skipped lines as `undefined`.** Lines 41 and 45 sum
  them. Use `0n` at the summation and prove the skip conditions separately.
- **Asserting the QDCGT total instead of per-line values.** A 25-line worksheet with two compensating
  transcription errors totals correctly. `fjs/tax/table`'s `rowByRowDiffMatchesPublishedTable` already
  established the per-field-assertion pattern for exactly this reason.

---

## Don't Hand-Roll

| Problem | Don't build | Use instead | Why |
|---|---|---|---|
| Tax on an amount below $100,000 | Bracket arithmetic | `lookupTaxTable` | The table quantises to band midpoints; bracket arithmetic disagrees, and that disagreement is half of the $1–$12 error. `$18,000` MFJ is `$1,803` by table, `$1,800` by brackets. |
| Tax on an amount at or above $100,000 | A new bracket walk | `cumulativeBracketTaxCents` | Verified to reproduce all four TCW sections exactly. A second walk is a second thing that can disagree. |
| The $100,000 boundary | A fresh comparison | `tableUpperBoundCents` + `lookupTaxTable`'s existing refusal | The refusal already names the Tax Computation Worksheet verbatim and its proof asserts the message content. |
| Capital-gain breakpoints | New constants for QDCGT lines 6/13 | `capitalGainsBreakpoints[status]` | Verified character-identical to the printed worksheet. |
| The Sch D TW line 19 cap | A new "$197,300 / $394,600" constant | `ordinaryBrackets[status].brackets[3].ceiling` | It **is** the 24%-bracket ceiling, already stored and boundary-proofed. |
| Half-up rounding | `Math.round` | `halfUp` | `Math.round(-2.5) === -2`; the IRS's own example is `$2.50 → $3`. `fjs/types/rational`'s proof pins the divergence. |
| Per-item rounding | `values.map(halfUp).reduce(...)` | `halfUp(sum(values))` | The IRS instructs `round(sum)` in one sentence (p23). |
| The zero-read kill condition | A second read counter | `classifyRunOutcome` | It already exists once, in one place, after having existed twice with no coverage. |
| Boundary triples | Hand-written leaves | `fjs/tax/boundary`'s generated proof over `allThresholds` | It is generated from the stored data, so a new threshold is covered without anyone remembering. |

**Key insight:** every constant, every rate schedule, every rounding mode, and every boundary this
phase needs already exists in the repo, verified against a primary source, with a proof. **The novel
code in Phase 10 is the two worksheets' control flow, the dispatch, and the scope guard — nothing
numeric.** A plan that introduces a numeric literal outside a hand-transcription proof is almost
certainly duplicating something.

---

## Common Pitfalls

### Pitfall 1: dropping QDCGT line 25's `min()` — the phase's signature defect

**What goes wrong:** line 16 is off by $1–$13 while every line above it matches.
**Why:** line 23 is the "obvious" answer (0% + 15% + 20% + ordinary), and it is right most of the
time. The clamp only bites in a narrow window.
**Prevention:** the regression pair in §"Worked Numeric Examples". Then **mutate** — change `min` to
`max`, or delete line 25 and return line 23 — and confirm the suite goes red on both cases.
**Warning sign:** a QDCGT implementation whose last line is `line18 + line21 + line22`.

### Pitfall 2: testing dispatch order only on the common path

**What goes wrong:** Sch D TW and QDCGT are tested in the wrong order; every test passes.
**Why:** with Schedule D lines 18 and 19 zero, the two worksheets are algebraically identical.
**Prevention:** assert the **method tag**, not the number. Plus the degenerate-equivalence
differential proof, which makes the equivalence explicit instead of accidental.
**Warning sign:** no test in the suite has a non-zero Schedule D line 18 or 19.

### Pitfall 3: deciding the Tax Table / TCW method once, from line 15

**What goes wrong:** every return with taxable income over $100,000 and a preferential slice large
enough to pull line 5 under $100,000 gets the wrong line 22.
**Prevention:** case (iii) in §"Worked Numeric Examples" — MFJ `$120,000` / `$30,000` → line 22 uses
the Tax Table, line 24 uses the TCW, in one execution.

### Pitfall 4: MFS's $1,600 increment

**What goes wrong:** MFS returns are off by $400 per checked box.
**Why:** MFS shares single's `$15,750` base but takes the married `$1,600` increment.
**Prevention:** all 17 combinations in §"Standard Deduction", with hand-typed expected values.

### Pitfall 5: standard-deduction exceptions 2 and 3 are hard zeros

**What goes wrong:** a blind 70-year-old MFS filer whose spouse itemizes gets `$18,950` instead of
`$0`.
**Prevention:** proof leaves for exceptions 2 and 3 *with* age and blindness boxes checked. The
instructions say it twice: "your standard deduction is zero, **even if** you were born before January
2, 1961, or were blind."

### Pitfall 6: a proof whose expected side comes from the code under test

**What goes wrong:** the suite is green and proves nothing. This project has shipped it **three
times** (AGENTS.md's table: Phases 7, 8, 9 — 185, 262, 258 green).
**Prevention here specifically:** the printed Tax Table rows in §"Worked Numeric Examples" are the
independent side. Hand-type them. Do **not** compute expected line 16 by calling `qdcgt()`. Do **not**
compute the expected standard deduction as `base + n × increment`. Do **not** derive the TCW's twenty
subtraction constants — transcribe them from p80 and diff.

### Pitfall 7: `noUncheckedIndexedAccess` on a 47-element worksheet

**What goes wrong:** the Schedule D Tax Worksheet stored as an array yields `bigint | undefined` at
every index, and the temptation is a cast or a `!`. Both are banned.
**Prevention:** store worksheet lines as a **record with named `line1`…`line47` fields**, which is
what TAX-15 asks for anyway. Records index without the `| undefined`.

### Pitfall 8: assuming Phase 10 can exercise the Schedule D Tax Worksheet

**What goes wrong:** the plan schedules a Sch D TW proof and discovers mid-phase that Schedule D
lines 15/16/18/19 have no source. Schedule D is Phase 12 (TAX-11).
**Prevention:** decide up front — see §"Open Question 3".

### Pitfall 9: line 16 modelled as "the dispatch result"

**What goes wrong:** the six line-16 add-ons (Forms 8814, 4972, §962, education-credit recapture,
8621, 8978) are silently omitted.
**Prevention:** they are declared kinds in the profile, and each one is a named refusal.

---

## Code Examples

### The line-16 dispatch, as a tagged decision

```js
/**
 * Form 1040 (2025) line 16 method dispatch, in the order the instructions
 * state it (i1040gi p36) -- NOT the printed order, which omits two
 * precedence facts the prose states explicitly:
 *   - QDCGT is guarded by "if you don't have to use the Schedule D Tax
 *     Worksheet", so the Sch D TW test comes strictly first;
 *   - Form 2555 outranks both, but the Foreign Earned Income Tax Worksheet
 *     RE-ENTERS this same dispatch at its own line 4, so it is a wrapper,
 *     never a fifth peer branch.
 * Returns a TAG plus the cents, so a proof can assert WHICH method ran --
 * a proof on the cents alone passes under a wrong ordering whenever
 * Schedule D lines 18 and 19 are zero, because the two worksheets are then
 * algebraically identical (10-RESEARCH.md).
 * @type {(params: TaxParamSet) => (r: Line16Inputs) => Line16Result}
 */
```

### The `min()` that is the whole point

```js
// QDCGT line 25 (2025 Form 1040 instructions, p38): "Tax on all taxable
// income. Enter the SMALLER of line 23 or line 24."
//
// Line 23 can exceed line 24 by $1-$13 for two independent reasons, both
// live only just above the 0% capital-gain ceiling:
//   1. the 0% ceiling ($96,700 MFJ) sits BELOW the top of the 12% ordinary
//      bracket ($96,950), so 15% is charged where 12% would apply;
//   2. lines 22 and 24 are Tax Table lookups quantised to different band
//      MIDPOINTS.
// Regression: MFJ line 15 = 97,000.00 / line 3a = 300.00  -> 11,174 (23 gives 11,175)
//             MFJ line 15 = 96,999.00 / line 3a = 299.00  -> 11,163 (23 gives 11,174.85)
const line25 = line23 < line24 ? line23 : line24
```

### The Tax Computation Worksheet, from the brackets already stored

```js
/**
 * 2025 Tax Computation Worksheet (i1040gi p80) -- the method line 16 uses
 * at or above $100,000. Its twenty printed rows are `rate x income -
 * subtraction`, and every subtraction constant is exactly
 * `rate x bracketLowerBound - taxAt(bracketLowerBound)`, i.e. the printed
 * worksheet IS `cumulativeBracketTaxCents`. Verified this session on
 * Single/MFJ/HoH at $100,000, HoH at $626,350, and MFS at $375,800 -- all
 * exact to the cent.
 *
 * This function therefore adds no arithmetic: only the boundary refusal
 * (mirroring `lookupTaxTable`'s in the opposite direction) and the
 * whole-dollar round. Its proof hand-transcribes the twenty printed
 * subtraction constants and diffs -- never derives them, which would be
 * the same tautology `handTranscribedRows` exists to avoid.
 * @type {(brackets: readonly Bracket[]) => (incomeCents: bigint) => bigint}
 */
```

### The scope refusal, as a bare array

```js
// AGENTS.md: `assert` throws a BARE value, never an Error. `fjs/tax/table`'s
// own refusal is the in-repo precedent -- and its proof asserts the message
// CONTENT, because a proof that only checks "did it throw" passes when an
// unrelated path throws instead (the exact gap the Phase 9 mutation sweep found).
assert(modeledKinds.includes(kind), [
    'unmodeled input',
    line,          // '1040 line 6b'
    kindLabel,     // 'taxable social security benefits'
    remedy,        // 'requires vnd.fjs.ssa1099 and the Social Security Benefits Worksheet (TAX-10, Phase 13)'
])
```

---

## Claims in the Existing Planning Documents That This Research Proves FALSE

Phase 1's precedent — say so explicitly.

| # | Claim | Where | Verdict |
|---|---|---|---|
| 1 | "p124 Tax Computation Worksheet" | this phase's brief | **FALSE.** PDF page 124 is the alphabetical index. The Tax Computation Worksheet is on printed/PDF page **80**; the Tax Table is pages **68–79**. |
| 2 | "the signature symptom … line 16 off by **$1–$12**" | `ROADMAP.md` Phase 10 SC-2, `REQUIREMENTS.md` | **NOT A BOUND.** MFJ line 15 = `$96,949` / line 3a = `$249` produces `$13.35`. The phrase is a fair description of what people notice; it must not become a range assertion in a proof. |
| 3 | "Social Security Benefits Worksheet — a **19-line** near-circular computation" | `REQUIREMENTS.md` TAX-10 | **FALSE.** The printed worksheet (i1040gi p32) has **18** numbered lines. Phase 13's concern, recorded here because it was verified here. |
| 4 | "The 1099-DIV dialect FORCES … the Schedule D Tax Worksheet (boxes **2b/2d**)" | `ROADMAP.md` Sequencing Constraint 4 | **INCOMPLETE.** Line 7a Exception 1 (i1040gi p31) names boxes **2b, 2c, and 2d**. Box 2c (§1202 gain) also forces Schedule D. |
| 5 | "Qualified Dividends and Capital Gain Tax Worksheet (**~25 lines**)" | `REQUIREMENTS.md` TAX-08 | **TRUE** — exactly 25. |
| 6 | Phase 8's standard deduction `15750.00 / 31500.00 / 23625.00` citing Rev. Proc. 2025-32 §3.01 | `fjs/tax/params` | **CONFIRMED**, three independent ways: the Form 1040 (2025) face margin, the Standard Deduction Worksheet for Dependents line 3, and the Standard Deduction Chart by subtraction. **No disagreement.** |
| 7 | Phase 8's "the Tax Table rounds to whole DOLLARS, not cents" | `08-RESEARCH.md`, `fjs/tax/table` header | **CONFIRMED** and now given its governing sentence: i1040gi p23, "$2.50 becomes $3", plus "There is no cents column on the form." |
| 8 | `fjs/tax/params` covers "every filing status this project's TY2025 parameters cover" | `fjs/tax/params` header | **INCOMPLETE.** `qualifyingSurvivingSpouse` is absent. Every QDCGT/Sch D TW/standard-deduction table names it as its own status. Amounts equal MFJ's; the **box-count maximum does not** (QSS 2, MFJ 4). |
| 9 | Schedule D line 20's Form 4952 test | `f1040sd.pdf` p2 | **LOOSER than the instructions.** The form face says "you are not filing Form 4952"; the instructions and the Sch D TW header both require "an amount on line 4g". Implement the stricter form. |

---

## Assumptions Log

| # | Claim | Section | Risk if wrong |
|---|---|---|---|
| A1 | The preferential rates (15/20/25/28) are governed by IRC §1(h); I did not verify a subsection number this session | Standard Stack / QDCGT | Low — the rates are printed on both worksheets; only the *citation* would be wrong. |
| A2 | The Tax Computation Worksheet result rounds to whole dollars; the IRS states no TCW-specific rule | Rounding | Low–medium — pennies on line 16 above $100,000. Resolve by checking the user's own filed return in Phase 14. |
| A3 | The Standard Deduction Worksheet for Dependents line 3 uses `$31,500` for QSS; the printed line lists only S/MFS, MFJ, HoH | Standard Deduction | Low — parity with the chart and the Form 1040 margin. |
| A4 | The degenerate-equivalence identity (Sch D TW ≡ QDCGT when Sch D 18/19 = 0 and no Form 4952) is my own line-by-line derivation, not an IRS statement | Schedule D Tax Worksheet | Medium — it is *load-bearing for the dispatch-order argument*. Mitigation: implement it as a proof; if it fails, one of the two transcriptions is wrong, which is exactly what you want to learn. |
| A5 | The `$900` threshold on the Dependents worksheet line 2 equals `2 × $450` | Standard Deduction | Low — arithmetically true for TY2025; may not be the IRS's own derivation. |
| A6 | The `$1–$13.35` maximum is the true extremum; I searched the MFJ and single windows but did not prove a bound | Worked Examples | Low — the recommendation is to pin specific cases, never a range. |
| A7 | Form 1040-SR uses identical line numbering to Form 1040 (relevant because a 65+ taxpayer likely filed 1040-SR) | Form 1040 Lines | Low — every worksheet in the instructions says "Form 1040 or 1040-SR, line N" throughout, which is strong evidence. |

---

## Open Questions

**All six were resolved by `10-CONTEXT.md` on 2026-08-06 and are recorded here so a later reader does
not re-open them.** Two of the six were resolved AGAINST this document's own recommendation; those
are flagged at the question. Where a plan implements the resolution, it is named.

### 1. `ReportLine.sources` cannot express a parameter-derived line — **(RESOLVED: Decision 4)**

**Resolution: option (a)**, as recommended. The return profile becomes a real CAS document and line
12e cites its `filingStatus` and 12d checkbox boxes. Phase 9's type and its `tsc` guarantee are
untouched. Implemented by Plan 10-04 (the dialect) and Plan 10-09 (line 12e's sources).

- **What we know:** `sources` is `readonly [Source, ...Source[]]` where `Source =
  { documentHash, boxPath, value }`. Empty or omitted `sources` fails `tsc` — deliberately, and a
  conditional-type assertion pins it.
- **What's unclear:** line 12e (standard deduction) derives from filing status, age, and blindness —
  none of which is a document box today. Line 16 derives from the Tax Table and the parameter set.
- **Options:** (a) the return profile becomes a real CAS document, and 12e cites its
  `filingStatus`/`bornBeforeJan2_1961`/`isBlind` boxes — **no type change needed**; (b) widen `Source`
  to a discriminated union of document-source and parameter-source; (c) mint a synthetic
  `documentHash` for the parameter set (PROV-04 already wants a parameter-set hash).
- **Recommendation: (a).** It needs the profile document, which the scope guard needs anyway, and it
  leaves the Phase 9 type — and its `tsc`-level guarantee — untouched.

### 2. Does Phase 10 introduce the return-profile dialect? — **(RESOLVED: Decision 4)**

**Resolution: Phase 10 introduces it**, as recommended, in Plan 10-04, registered in
`finance_schema`'s `dialectSchemas`.

- **What we know:** four dialects exist; none is a profile. Lines 12a–12d, the filing status, line 26,
  and the entire scope-guard input have no home.
- **What's unclear:** whether this belongs to Phase 10 or should be a decimal insertion.
- **Recommendation:** Phase 10, first plan. Three of the four success criteria depend on it. It also
  needs registering in `fjs/server/finance_schema`'s `dialectSchemas`, which is a small, well-precedented change.

### 3. How is the Schedule D Tax Worksheet branch satisfied in Phase 10? — **(RESOLVED: Decision 1 — AGAINST this document's recommendation)**

**Resolution: option (b)**, the named refusal — NOT option (a), which this section recommended. The
branch is SELECTED by `dispatchLine16` (Plan 10-08) and then dispatches to a TAX-16 scope refusal
naming unrecaptured §1250 gain and 28%-rate gain; the 47-line computation moves to Phase 12 with the
brokerage documents that feed it. **Consequence for anyone reading further:** the
degenerate-equivalence differential proof this document proposes (assumption A4) cannot be written
in Phase 10 — there is no second transcription to differ against. It is Phase 12's proof. Plan 10-08
records that at the site.

- **What we know:** TAX-03 says "a proof per branch", including Sch D TW. Its inputs (Schedule D lines
  15/16/18/19) require Schedule D, which is Phase 12 (TAX-11).
- **Options:** (a) implement all 47 lines now, proved against **synthetic** Schedule D line values
  rather than a real Schedule D, and wire it to a real Schedule D in Phase 12 — the differential
  identity in §"The Schedule D Tax Worksheet" gives it real coverage immediately; (b) ship the branch
  as a **named refusal** in Phase 10 ("Schedule D Tax Worksheet — requires Schedule D, TAX-11,
  Phase 12") and move the arithmetic to Phase 12.
- **Recommendation: (a).** The worksheet is the hardest thing in v1, the transcription is done (it is
  in this document), and the degenerate-equivalence proof makes it self-checking on day one. (b)
  defers the hardest work to a phase already carrying 1099-DIV, 1099-B, 8949, and Schedule D.

### 4. How is `qualifyingSurvivingSpouse` modelled? — **(RESOLVED: Decision 6 — AGAINST this document's recommendation)**

**Resolution: option (a)**, a real member of `IndividualFilingStatus` with its own stored parameter
rows — NOT option (b), the call-site mapping this section recommended. The deciding fact is the one
this section itself surfaced: QSS's maximum box count is 2 where MFJ's is 4, so a mapping would
silently permit a four-box standard deduction no QSS filer can claim. Implemented by Plan 10-01;
the Tax Table's missing QSS column is handled once, by `taxTableColumnFor` in Plan 10-03.

- **What we know:** amounts equal MFJ's everywhere; the box-count maximum does not (2 vs 4); Pub. 1040's
  Tax Table prints no QSS column (QSS reads the MFJ column).
- **Options:** (a) add `'qualifyingSurvivingSpouse'` to `FilingStatus` and duplicate MFJ's values;
  (b) keep it out of `fjs/tax/params` and map QSS → MFJ at the return-profile layer, with the
  box-count maximum enforced there.
- **Recommendation: (b)**, since the parameter data would otherwise carry a duplicate row that must be
  kept in sync — but this is a genuine judgement call and belongs in discuss.

### 5. Cents regime or whole-dollar regime — and does the election live in the profile? — **(RESOLVED: Decision 5)**

**Resolution: the cents regime**, as recommended, with the whole-dollar election as a separate,
explicit all-or-nothing projection applied at report time to the unrounded line values — and the
election lives in the return profile (`wholeDollarElection`). Implemented by Plan 10-02
(`applyWholeDollarElection`) and applied once, over the whole line list, by Plan 10-10. This is what
makes criterion 5 non-vacuous; see Decision 5's own reasoning.

See §"Rounding". Criterion 5 cannot be satisfied without the whole-dollar election existing somewhere.
Phase 14's acceptance against a real filed return needs to match whatever the taxpayer actually
elected, which argues for putting the election in the return profile.

### 6. Do lines 26, 35a, and 36 need a source? — **(RESOLVED: Decision 4)**

**Resolution: they live in the return profile**, so `ReportLine.sources` is satisfied for free and
this is not a second instance of Open Question 1. The profile carries
`line26EstimatedTaxPayments`, `line35aRefundRequested` and `line36AppliedToNextYear` (Plan 10-04),
consumed by Plan 10-10.

Line 26 (estimated tax payments) and lines 35a/36 (refund elections) are taxpayer-supplied with no
document. If they live in the return profile, `ReportLine.sources` is satisfied for free. If not, they
are a second instance of Open Question 1.

---

## Environment Availability

| Dependency | Required by | Available | Version | Fallback |
|---|---|---|---|---|
| Node.js + `node --test` | `npm test` | ✓ | as installed | — |
| TypeScript (`tsc`) | `npm test`'s typecheck half | ✓ | from `package.json` | — |
| `functionalscript` (npm) | every module | ✓ | from `package.json` | — |
| `./functionalscript` submodule | vendored proofs | **not checked out** (dir empty) | — | Irrelevant: `npm test` reports 320 total / 318 project leaves without it. **Do not gate on `npm test`'s total** (AGENTS.md); use `node --test 2>&1 \| grep -c '^✔ import("./fjs/'`. |
| IRS PDFs | this research only | ✓ in `scratchpad/irs/` | 2025 revisions | Not needed at build time; every figure is transcribed into proofs. |
| `pdftotext` (poppler) | re-verifying a page | ✓ `/opt/homebrew/bin/pdftotext` | — | — |

**No new runtime or build dependency. `package.json` is unchanged by this phase.**

---

## Validation Architecture

`workflow.nyquist_validation` is `true` in `.planning/config.json`.

### Test framework

| Property | Value |
|---|---|
| Framework | FunctionalScript Emergent Testing, registered by root `all.test.js`, run by Node's test runner |
| Config file | `package.json` (`"test": "tsc && node --test"`), `tsconfig.json` |
| Quick run | `npm test` |
| Full suite | `npm test` (identical — there is no split) |
| **Never** | `node --test fjs/tax/line16/module.f.js` — a documented **FAKE PASS**; no `proof` leaf runs |
| Leaf count command | `node --test 2>&1 \| grep -c '^✔ import("./fjs/'` |
| **Baseline measured this session** | **318** project proof leaves; **320** tests total; **0 fail** |

### Phase requirements → test map

| Req | Behavior | Type | Command | Exists? |
|---|---|---|---|---|
| TAX-03 | Dispatch returns the correct **tagged method** for each of the four arms + the wrapper refusals | unit | `npm test` | ❌ Wave 0 |
| TAX-03 | QDCGT line 25 `min()` — the `$1` and `$12` regression pair | unit | `npm test` | ❌ Wave 0 |
| TAX-03 | Control: `min()` picks line 23 on the `$90,000/$10,000` MFJ case | unit | `npm test` | ❌ Wave 0 |
| TAX-03 | QDCGT lines 22 and 24 dispatch independently (`$120,000/$30,000` MFJ) | unit | `npm test` | ❌ Wave 0 |
| TAX-03 | 0% + 15% + 20% + both lookups in one execution (`$700,000` MFJ) | unit | `npm test` | ❌ Wave 0 |
| TAX-03 | TCW's 20 subtraction constants diffed against p80 | unit | `npm test` | ❌ Wave 0 |
| TAX-03 | The `$99,999.99 → $16,909` / `$100,000.00 → $16,914` seam, with method tags | unit | `npm test` | ❌ Wave 0 |
| TAX-03 | Sch D TW ≡ QDCGT when Sch D 18/19 = 0 (differential) | unit | `npm test` | ❌ Wave 0 |
| TAX-03 | IRS's own printed example: MFJ `$25,300 → $2,562` | unit | `npm test` | ❌ Wave 0 |
| TAX-05 | Lines 1a–37 over ≥ 10 real documents, each line a `ReportLine` with sources | integration | `npm test` | ❌ Wave 0 |
| TAX-06 | All 17 (status, box-count) combinations, hand-typed expectations | unit | `npm test` | ❌ Wave 0 |
| TAX-06 | Exceptions 2 and 3 = `$0` **with** age/blindness boxes checked | unit | `npm test` | ❌ Wave 0 |
| TAX-06 | Dependents worksheet, both arms of its line 2 | unit | `npm test` | ❌ Wave 0 |
| TAX-16 | Refusal names the line, the unmodeled kind, and the remedy — **content asserted**, bare value, never an `Error` | unit | `npm test` | ❌ Wave 0 |
| TAX-16 | **Control:** the same profile minus the unmodeled kind computes cleanly | unit | `npm test` | ❌ Wave 0 |
| TAX-16 | The 65+ profile forces refusals on lines 13b and 19 | unit | `npm test` | ❌ Wave 0 |
| SC-5 | `round(sum)` ≠ `sum(round)` on line 2b over 10 × `'1.39'` 1099-INTs | unit | `npm test` | ❌ Wave 0 |

### Sampling rate

- **Per task commit:** `npm test`, then `node --test 2>&1 | grep -c '^✔ import("./fjs/'` — the count
  must be **≥ 318 + the leaves that task added**.
- **Per wave merge:** `npm test`, plus AGENTS.md's post-merge coverage check —
  `node --test 2>&1 | grep -o '^✔ import("\./fjs/[^ ]*' | sort -u` in both parents and the result,
  `comm -23` must be empty; and `grep -cE '\bassert(Eq|NotNullish)?\(' <changed file>` must not drop.
- **Phase gate:** full suite green, **plus a mutation sweep** on the five specific sites this research
  identifies as highest-risk:
  1. QDCGT line 25 `min` → `max` (must break both regression cases)
  2. QDCGT line 6 `min(L1, L6)` → `L6` (must break the control case)
  3. the aged/blind increment for `marriedFilingSeparately` `1600` → `2000` (must break 4 leaves)
  4. the dispatch order — swap the Sch D TW and QDCGT tests (must break the method-tag proofs, and
     must **not** break the numeric proofs — confirming the tag proofs are what carry it)
  5. `classifyScope`'s comparison inverted (must break the refusal proof **and** leave the control green)

  Per AGENTS.md: `cp -a . /tmp/sweep`, mutate by line number, `git diff --numstat` must show exactly
  `1` insertion and `1` deletion, and **never run a writing git command from inside the copy.**

### Wave 0 gaps

- [ ] `fjs/return/profile/module.f.js` — the return-profile dialect (blocks TAX-05, TAX-06, TAX-16)
- [ ] Register it in `fjs/server/finance_schema`'s `dialectSchemas` (and update that module's proofs)
- [ ] `fjs/return/scope/module.f.js` — `classifyScope`
- [ ] `fjs/tax/deduction/module.f.js` — line 12e
- [ ] `fjs/tax/table/module.f.js` — add `taxComputationWorksheet` + the 20-row transcription
- [ ] `fjs/tax/line16/qdcgt/module.f.js` — 25 lines
- [ ] `fjs/tax/line16/scheduled/module.f.js` — 47 lines (per Open Question 3)
- [ ] `fjs/tax/line16/module.f.js` — the tagged dispatch
- [ ] `fjs/form1040/core/module.f.js` — lines 1a–37 as `ReportLine`
- [ ] A ≥ 10-document fixture with real cents for SC-5 and SC-1

*(No framework install needed — `npm test` already runs everything.)*

---

## Security Domain

`security_enforcement` is not set in `.planning/config.json`, so it is treated as enabled.

### Applicable ASVS categories

| Category | Applies | Control |
|---|---|---|
| V2 Authentication | no | The MCP server is project-local stdio; no auth surface is added. |
| V3 Session management | no | Unchanged from Phase 2/7. |
| V4 Access control | no | Unchanged. The guest whitelist stays read-only (Phase 6). |
| **V5 Input validation** | **yes** | The new return-profile dialect must validate through `fjs/document/base` + `fjs/document/money_field` exactly as the four existing dialects do — money as a decimal **string**, exactness enforced in the semantic check. Its declared-kind vocabulary must be a **frozen** set validated on ingest, mirroring `fjs/guest`'s frozen-four precedent; an unrecognised kind is a refusal, never a pass-through. |
| V6 Cryptography | no | No crypto is introduced. Document hashes come from the existing CAS. |
| V7 Error handling / logging | **yes** | Refusals must be **bare values**, never `Error`s, and never `instanceof Error`-branched. The refusal message names an IRS line and a form — no taxpayer PII (SSN, name, address) may appear in it. |

### Known threat patterns for this stack

| Pattern | STRIDE | Mitigation |
|---|---|---|
| A report program that recites a figure instead of computing it (`() => pure({ line16: 9137 })`) | Spoofing / Repudiation | `classifyRunOutcome`'s zero-read kill condition (shipped). Unchanged by this phase; must keep passing. |
| **A report that computes only part of the return and says nothing** | **Repudiation** | **This phase's whole point.** `classifyScope`, driven by declared kinds, not store contents. |
| Prototype-pollution style dispatch through a whitelist (`__defineGetter__`) | Elevation of privilege | Closed upstream in fjs 0.41.0 (`at` + `assert` in `match`, functionalscript#1419); `fjs/exec`'s `refusals.*` proofs pin it. **If the dispatch is implemented with `match` over a method name, that pin is what keeps it safe** — do not hand-roll a `whitelist[name]` lookup. |
| A new dialect widening the ingest surface | Tampering | The profile dialect must go through the same `validate` + RTTI path as the other four; `finance_schema`'s unknown-dialect refusal already covers the negative case. |
| PII in a refusal or a run record | Information disclosure | Refusals name lines and forms, never values or identities. |

---

## Sources

### Primary (HIGH confidence — fetched, extracted, and read directly this session)

- `scratchpad/irs/i1040gi.pdf` — **2025 Instructions for Form 1040**, extracted with
  `pdftotext -layout -f N -l N`:
  - **p23** — "Rounding Off to Whole Dollars" (the `round(sum)` sentence; `$2.50 → $3`)
  - **p31** — Line 7a "Capital Gain or (Loss)", **Exception 1** (boxes 2b/2c/2d force Schedule D)
  - **p32** — Social Security Benefits Worksheet (18 lines)
  - **p33** — Lines 12a/12b/12c/12d; "Don't check any boxes for your spouse if HoH"; blindness definition
  - **p34** — Line 12e Standard Deduction, Exceptions 1–5; Line 13a/13b; **Line 16 Tax** and its six add-ons
  - **p35** — Standard Deduction Worksheet for Dependents; **Standard Deduction Chart** (all five statuses)
  - **p36** — **The line-16 dispatch decision tree** (Tax Table/TCW default; Form 8615; Schedule D Tax Worksheet; QDCGT; Schedule J; FEITW)
  - **p37** — Foreign Earned Income Tax Worksheet (6 lines + capital-gain-excess footnotes)
  - **p38** — **Qualified Dividends and Capital Gain Tax Worksheet** (25 lines, transcribed in full)
  - **p68** — Tax Table header + the IRS's own printed Example (MFJ `$25,300 → $2,562`)
  - **p74, p77, p79** — the printed Tax Table rows used in every worked example
  - **p80** — **2025 Tax Computation Worksheet** (four sections, 20 rows, all constants)
  - **p110–111** — Schedule 1-A Part V, Enhanced Deduction for Seniors
  - **p124** — the alphabetical index (**not** the Tax Computation Worksheet)
- `scratchpad/irs/i1040sd.pdf` — **2025 Instructions for Schedule D**:
  - **p12** — Unrecaptured Section 1250 Gain Worksheet (Line 19), 18 lines
  - **p14** — 28% Rate Gain Worksheet (Line 18), 7 lines
  - **pp15–16** — **Schedule D Tax Worksheet** (47 lines + its header and Exception), transcribed in full
- `scratchpad/irs/f1040.pdf` / `.txt` — **Form 1040 (2025)**, both pages, lines 1a–38 and the
  standard-deduction margin
- `scratchpad/irs/f1040sd.pdf` — **Schedule D (Form 1040) 2025**, Part III lines 16–22 (the dispatch on the form face)

### In-repo (HIGH confidence — read in full this session)

- `AGENTS.md` — hard rules, the mutation discipline, the fake-pass warnings, the merge-coverage check
- `fjs/tax/params/module.f.js`, `fjs/tax/table/module.f.js`, `fjs/tax/boundary/module.f.js`
- `fjs/report/line/module.f.js`, `fjs/report/guard/module.f.js`, `fjs/report/audit/module.f.js`
- `fjs/types/rational/module.f.js`, `fjs/exact/module.f.js`
- `fjs/document/w2`, `fjs/document/1099int`, `fjs/server/finance_schema`, `fjs/run`
- `.planning/REQUIREMENTS.md` (TAX-01…TAX-17, PROV-01…PROV-04, EXACT-03…EXACT-05)
- `.planning/ROADMAP.md` (Phase 10 and the sequencing constraints)
- `.planning/phases/08-.../08-RESEARCH.md`, `08-CONTEXT.md`, `.../09-CONTEXT.md`
- Suite baseline measured this session: `npm test` → 320 tests, 320 pass, 0 fail; 318 project leaves

### Secondary (MEDIUM confidence)

- Rev. Proc. 2024-40 §2.15(3)'s "unmarried and not a surviving spouse" wording — recalled, **but
  independently confirmed** by the Standard Deduction Chart's arithmetic (QSS takes $1,600) and by
  the Dependents worksheet's "$1,600 ($2,000 if single or head of household)".

### Tertiary (LOW confidence — flagged, not relied on)

- IRC §1(h) as the citation for the 15/20/25/28% preferential rates — see Assumption A1.

---

## Metadata

**Confidence breakdown:**

| Area | Level | Reason |
|---|---|---|
| Line-16 dispatch tree | **HIGH** | Read from i1040gi p36 *and* cross-checked against Schedule D's own Part III decision procedure; the one disagreement between them is documented. |
| QDCGT transcription | **HIGH** | All 25 lines transcribed from p38 this session; every constant matched against `fjs/tax/params`. |
| Schedule D Tax Worksheet transcription | **HIGH** | All 47 lines from i1040sd pp15–16 this session. The degenerate-equivalence *derivation* is MEDIUM (A4) and is proposed as a proof precisely because of that. |
| The `$1` / `$12` regression pair | **HIGH** | Every expected value read off the printed Tax Table **and** independently reproduced by midpoint bracket arithmetic; the two agree. |
| Tax Computation Worksheet | **HIGH** | 20 rows transcribed; 5 spot checks against `cumulativeBracketTaxCents`, all exact to the cent. |
| Standard deduction / age / blindness | **HIGH** | Chart + Dependents worksheet + Form 1040 margin, three independent confirmations; all 17 combinations reconcile with the stored params. |
| Rounding | **HIGH** for what the IRS says; **MEDIUM** for the TCW's own rounding (A2) |
| Scope-guard design | **MEDIUM** | The *structural finding* (store contents cannot express absence) is HIGH and is a logical necessity. The specific dialect shape is a proposal for discuss, not a verified fact. |
| Lines 1a–37 in/out of scope | **HIGH** | Read off the 2025 form face directly; each refusal mapped to a requirement ID and phase from `ROADMAP.md`. |

**Research date:** 2026-08-06
**Valid until:** the TY2025 forms are final (2025 revisions, "Created 9/5/25" on the 1040 and
"Created 10/6/25" on Schedule D), so the figures do not move. Re-verify only if the IRS reissues a
2025 revision, or when TY2026 parameters land (Phase 15's multi-year work).
