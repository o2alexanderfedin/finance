# Splitting the last six coarse kinds

Six kinds in `fjs/return/scope/module.f.js` each name a printed line that collapses many
unrelated taxpayer facts. This file specifies the split, the rule that produced it, the
instruction pages every fact was read off, and the arithmetic.

**Nothing is reclassified.** Every new kind lands in `unmodeledKindRefusals`.
`expectedModeledKindCount` does not move.

## The six, verified against the tree on 2026-08-18

| kind | printed line | what its remedy said |
|---|---|---|
| `otherIncome` | Schedule 1 line 8a-8z | "collapses twenty-six lettered sub-lines … models none of them (no phase yet)" |
| `otherAdjustments` | Schedule 1 line 24a-24z | "collapses eleven lettered sub-lines … models none of them (no phase yet)" |
| `otherAdditionalTaxes` | Schedule 2 line 17a-17z | "collapses more than twenty lettered sub-lines … (no phase yet)" |
| `otherNonrefundableCredits` | Schedule 3 line 6a-6z | "collapses thirteen lettered sub-lines … (no phase yet)" |
| `otherPaymentsAndRefundableCredits` | Schedule 3 line 13a-13z | "collapses five lettered sub-lines … (no phase yet)" |
| `amtOtherAdjustments` | Form 6251 line 3 | "collapses every remaining §56/§57 item plus the 'related adjustments' …" |

All six were still present and still coarse. **Three of the six counts were wrong**, which is
the first thing reading the printed form rather than the remedy turns up:

- Schedule 1 line 8 prints **23** lettered sub-lines (8a-8v and 8z), not twenty-six.
- Schedule 1 line 24 prints **12** (24a-24k and 24z), not eleven.
- Schedule 2 line 17 prints **18** (17a-17q and 17z), not "more than twenty".

Schedule 3 line 6 prints fourteen, of which 6e is *Reserved for future use*, so "thirteen" was
right; Schedule 3 line 13 prints five, so "five" was right.

## Sources

Read directly (2026-08-18), never from recall:

- `f1040s1.pdf` (2025, "Created 7/25/25") — both pages, the printed sub-line captions.
- `f1040s2.pdf` (2025, "Created 5/8/25"), `f1040s3.pdf` (2025, "Created 11/17/25"), `f6251.pdf` (2025).
- `i1040gi.pdf` (2025) — printed pages 90-93 (Schedule 1 lines 8a-8z), 99-100 (lines 24a-24z),
  113-114 (Schedule 2 lines 17a-17z), 116 (Schedule 3 lines 6a-6z), 117 (lines 13a-13z).
- `i6251.pdf` (2025) — printed pages 8-9 (line 3, *Other Adjustments*, and *Related Adjustments*).

## The rule

**One kind per fact a taxpayer can truthfully declare having** — Phase 30's own words, applied
one layer down. Operationally, in the order the clauses bite:

1. **Default: one kind per printed lettered sub-line.** Each has its own caption, its own source
   form and its own blocker, so each can carry a remedy a taxpayer can act on.
2. **No kind where the printed line carries no fact.** Schedule 3 line 6e is *Reserved for future
   use*; the instructions for Schedule 1 line 24z and Schedule 3 line 6z both say, in full,
   "Leave line 24z blank" / "Leave line 6z blank" (i1040gi pp. 100, 116). A kind for any of the
   three would be a declaration nobody could truthfully make — the reasoning this vocabulary
   already applies to every total line.
3. **A write-in line gets one kind per example the instructions NAME, plus one residual.** Lines
   8z, 17z and 13z are defined as open ("any taxable income not reported elsewhere", "any taxes
   not reported elsewhere"), so splitting them into their examples alone would assert a closed
   list the form itself refuses to close. Splitting them into nothing but a residual would keep
   the coarse kind under a new name. Both, then: the named examples become kinds, and one
   residual kind stays, saying in its remedy that it is the residual and that no single form
   closes it.
4. **One kind for two printed lines where one FORM this engine does not have feeds both and a
   taxpayer cannot declare one without the other.** This is the project's own
   `section1202Gain` / `investmentInterestForm4952` / `amtNetOperatingLossDeduction` precedent,
   and it is why five existing kinds absorb seven of the sub-lines below instead of seven new
   kinds being invented for facts already declarable.

### Where the rule was deviated from, and why

**Once**, at Form 6251 line 3's *Related Adjustments* (i6251 p9). The instructions list seven
affected items — the §179 deduction, business or rental use of a home, conservation expenses,
taxable IRA distributions where prior-year IRA deductions differed for the AMT, the
self-employed health insurance deduction, the self-employed SEP/SIMPLE/qualified plans
deduction, and the IRA deduction under §219(b)(1)(B)'s earned income limitation. Clause 1 would
make that seven kinds. It is **one**, `amtRelatedAdjustments`, for three reasons that hold
together:

- All seven share ONE blocker exactly — each is a limit recomputed on an AMT income base, and
  this engine computes no AMT income base for any limit. Seven remedies would be seven copies of
  one sentence, which is the coarse-kind failure wearing a new costume.
- The printed form takes them **combined**: "Combine the amounts for all your related
  adjustments and include the total on line 3." There is no per-item printed line to name.
- The list is explicitly open — "Affected items **include** the following" — so seven kinds
  would assert a closed set, the same error clause 3 exists to avoid.

The other three headings under line 3 that this rule might have merged — *Tax Shelter Farm
Activities*, *Business Interest Limitation*, *Mortgage Interest* — are separate kinds, because
each has its own document and its own determination, not a shared one.

## Facts absorbed by kinds that already exist (no new kind)

Applying clause 4. Each of these gets its `line` extended to name the printed line it also
reaches, exactly as `section1202Gain` names Form 1099-DIV box 2c and Form 6251 line 2h today.

| printed line | absorbed by | why one fact |
|---|---|---|
| Schedule 1 line 8d, line 24j | `foreignEarnedIncomeForm2555` | one Form 2555: the exclusion, the housing deduction and the 1040 line 16 worksheet all follow from filing it |
| Schedule 1 line 8s | `medicaidWaiverPayments` | the same nontaxable payments the 1040 line 1d kind already names |
| Schedule 2 lines 17p, 17q | `form8621` | one Form 8621: line 16e's tax and lines 16f/24's interest are the same PFIC holding |
| Schedule 2 line 17z (Form 8978 ADJ), Schedule 3 line 6l | `form8978` | one Form 8978 from one partnership audit, positive to 1040 line 16 and negative to the other two |
| Form 6251 line 3 (*Net Qualified Disaster Loss*) | `netQualifiedDisasterLoss` | the same increased standard deduction the 1040 line 12e kind already names, added back for the AMT |

## The new kinds

84 in total. Every one refuses; none is reclassified.

- **Schedule 1 line 8 → 28.** 8a, 8b, 8c, 8e, 8f, 8g, 8h, 8i, 8j, 8k, 8l, 8m, 8n, 8o, 8p, 8q,
  8r, 8t, 8u, 8v — twenty — plus 8z's seven named examples (recoveries, RTAA payments, a loss on
  a corrective distribution of excess deferrals, insurance policy dividends above premiums,
  charitable-deduction recapture, disaster relief payments, ESA/QTP distributions) and one
  residual. 8d and 8s are absorbed above.
- **Schedule 1 line 24 → 10.** 24a, 24b, 24c, 24d, 24e, 24f, 24g, 24h, 24i, 24k. 24j is
  absorbed; 24z is blank by instruction.
- **Schedule 2 line 17 → 20.** 17a's four separate recaptures (investment credit via Form
  4255/3468, new markets, employer-provided childcare, §6418 transfer), then 17b-17o — fourteen
  — then 17z's prevailing-wage-and-apprenticeship penalties and one residual. 17p/17q and the
  Form 8978 write-in are absorbed.
- **Schedule 3 line 6 → 11.** 6a, 6b, 6c, 6d, 6f, 6g, 6h, 6i, 6j, 6k, 6m. 6e is reserved, 6l is
  absorbed, 6z is blank by instruction.
- **Schedule 3 line 13 → 8.** 13a, 13b, 13c, 13d, then 13z's three named credits (§960(c),
  Form 8689, Form 1062) and one residual.
- **Form 6251 line 3 → 7.** Six of the seven printed headings, plus `amtRelatedAdjustments`.
  The seventh heading is absorbed by `netQualifiedDisasterLoss`.

## Arithmetic

```
modeled     52 -> 52     (unchanged: nothing is reclassified)
refused     65 -> 143    65 - 6 + 84
vocabulary 117 -> 195    117 - 6 + 84,  and 52 + 143 = 195
amt* kinds  15 -> 21     15 - 1 (amtOtherAdjustments) + 7 (Form 6251 line 3's block)
```

Hand-typed counts that move: `expectedUnmodeledKindCount` (scope), `expectedKindCount`
(profile), the `amt*` filter count, and the per-schedule block leaves' `expected.length`
assertions. `expectedModeledKindCount` and `everyModeledKindHandTyped` must NOT move — that they
do not is the evidence nothing was reclassified. Two leaf names spell counts out and are
renamed: `kindVocabularyIsExactlyOneHundredAndSeventeen`, `unmodeledRefusalsIsExactlySixtyFive`.

## What this split found that is worth more than the split

**`vnd.fjs.w2`'s `box11NonqualifiedPlans` is stored, validated for exactness, and read by no
computation.** It is the fourth ingest-and-drop after `box2EarlyWithdrawalPenalty`,
`box6ForeignTaxPaid` and `box10DependentCareBenefits` — and it is the box Schedule 1 line 8t's
instructions point at ("This may be shown in box 11 of Form W-2", i1040gi p92).

It is **reported, not wired**, and the reason is the interesting half: unlike the other three,
the figure alone is not enough. Box 11 amounts are already inside box 1, which
`fjs/form1040/core` puts on 1040 line 1a in full. Moving one to Schedule 1 line 8t without
removing it from line 1a double-counts it; removing it changes earned income, and therefore the
earned income credit. The blocker is a decision, and `nonqualifiedDeferredCompensationPension`'s
remedy says exactly that rather than "no phase yet".

Two smaller notes, recorded so the next reader does not re-derive them:

- `vnd.fjs.1099g`'s `box5RtaaPayments`, `box6TaxableGrants` and `box9MarketGain` are NOT dropped
  — the dialect refuses a non-zero value at storage. Their refusal text names "Schedule 1 line
  8's collapsed other-income block, which no dialect can attribute an amount to", which this
  split makes false. Corrected to name the specific kind and printed line.
- i1040gi p113 tells a taxpayer with an excess parachute payment on a Form 1099-NEC to read
  **box 3**, while the 2025 Form 1099-NEC face labels box 3 *Reserved for future use* — which is
  what `vnd.fjs.1099nec` transcribes as `box3ReservedForFutureUse`. `goldenParachutePaymentsTax`'s
  remedy therefore names Form W-2 box 12 code K, which both sources agree on.
