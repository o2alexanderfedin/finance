# Form 6781 — Section 1256 Contracts Marked to Market, and the two Schedule D lines it reaches

Sources, fetched and read directly rather than recalled:

- `https://www.irs.gov/pub/irs-pdf/f6781.pdf` — Form 6781 (2025), "Created 11/12/25". Pages 2-4
  of that same PDF **are** the instructions; `https://www.irs.gov/pub/irs-pdf/i6781.pdf` returns
  an HTML page, not a PDF, so there is no separate instructions document to cite. Recorded
  plainly rather than silently worked around, the same way `fjs/document/1099b` records that
  `f1099b.pdf` 404s and only the year-suffixed URL serves.
- `https://www.irs.gov/pub/irs-pdf/f1099b--2025.pdf` — Form 1099-B (2025), for the printed
  captions of boxes 8 through 11 and the recipient instructions on the back.
- `https://www.irs.gov/pub/irs-prior/i1099b--2026.pdf` — Instructions for Form 1099-B, for the
  filer's own instruction on box 11.
- `https://www.irs.gov/pub/irs-pdf/p550.pdf` — Publication 550 (2025), chapter 4, p.58
  ("How To Report") and p.56 (the 60/40 rule).
- `https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section1256` — IRC §1256,
  read for subsection (a) in full.

---

## Q1. The 60/40 split, and whether this engine's Schedule D can take it

**The statute.** §1256(a)(3), quoted in full from the U.S. Code:

> any gain or loss with respect to a section 1256 contract shall be treated as—
> (A) short-term capital gain or loss, to the extent of 40 percent of such gain or loss, and
> (B) long-term capital gain or loss, to the extent of 60 percent of such gain or loss

Pub 550 (2025) p.56 restates it: *"gains or losses on section 1256 contracts open at the end of
the year, or terminated during the year, are treated as 60% long term and 40% short term,
regardless of how long the contracts were held."*

**The printed lines that carry each — and the order is a trap.** On the 2025 face:

| Form 6781 line | text | destination |
|---|---|---|
| 8 | "Short-term capital gain or (loss). Multiply line 7 by 40% (0.40)." | **Schedule D line 4** |
| 9 | "Long-term capital gain or (loss). Multiply line 7 by 60% (0.60)." | **Schedule D line 11** |

The **smaller-numbered** printed line carries the **larger** fraction's opposite: line 8 is 40%
and short-term, line 9 is 60% and long-term. Instructions for line 8 confirm the destination —
*"include this amount on Schedule D (Form 1040), line 4"* — and for line 9 — *"include this
amount on Schedule D (Form 1040), line 11"*. Pub 550 p.58 says the same, one level up: *"enter
the net amount of these gains and losses on Schedule D (Form 1040), line 4 or line 11, as
appropriate."*

**Can this engine's Schedule D accept them? Yes, and the attachment points already exist**, as
two single-token constants that name Form 6781 in their own comments:

```js
    // 4. ST gain from Form 6252 and Forms 4684/6781/8824 — no dialect for
    //    any of the four, documented 0.
    const line4 = 0n
```
```js
    // 11. Gain from Form 4797 Part I; LT gain from Forms 2439/6252; LT
    //     gain/loss from Forms 4684/6781/8824 — no dialect for any,
    //     documented 0.
    const line11 = 0n
```

Both are already threaded into `line7`/`line15` **and** into the TAX-34 `unadjustedLine7`/
`unadjustedLine15` totals, so a real feed flows through the netting, the $3,000/$1,500 loss cap
and `line7aCapitalGainOrLoss` with no further plumbing. `fjs/schedule/d`'s own
`documentedZeroLinesStayZeroEvenWithRealActivity` asserts both are `0n`, so it reddens by design
when the feed lands — and its comment convention for a line that stops being a documented zero
is already demonstrated there for lines 5 and 12.

**The rounding.** Line 8 and line 9 are computed independently from line 7, so the first question
is whether they can fail to re-sum to line 7. They cannot, and the reason is arithmetic rather
than luck: `0.4x` and `0.6x` in cents have fractional parts in `{0, .2, .4, .6, .8}` — a tie at
`.5` is unreachable, so `halfUp` never engages its tie rule — and the two fractional parts sum to
exactly `0` or exactly `1`. When they sum to `1`, exactly one of the two rounds up. So
`line8 + line9 === line7` at every input, positive or negative. This is proven over a swept range
rather than asserted in production, because it is a theorem about the code, not a guard.

**Where the split lives.** `fjs/tax/params`, as `sectionTwelveFiftySixCharacterSplit`, with two
separate `'code'` citations (`§1256(a)(3)(A)` and `§1256(a)(3)(B)`) — never one citation shared
by both halves, which is this module's stated convention. It is a `ratePercent`, so it joins
neither `everyDollarStringField` nor `fjs/tax/boundary`'s threshold set, exactly as
`medicalExpenseFloor` does not.

---

## Q2. Which box is the input — box 11, and the engine cross-checks it

**Box 11 is the input, and three separate printed sources say so.**

- Form 6781 line 1 instruction: *"If you received a Form 1099-B, Proceeds From Broker and Barter
  Exchange Transactions, or substitute statement, include on line 1 the amount from **box 11** of
  each form. In column (a), enter 'Form 1099-B' and the broker's name."*
- Form 1099-B (2025) recipient instructions, box 11: *"Boxes 8, 9, and 10 are all used to figure
  the aggregate profit or (loss) ... **Include this amount on your 2025 Form 6781.**"*
- Pub 550 (2025) p.58: *"Use Part I of Form 6781 to report your gains and losses from all section
  1256 contracts ... **This includes the amount shown in box 11 of Form 1099-B.**"*

**The identity is `box 8 − box 9 + box 10 = box 11`**, and the sign on box 9 is the part worth
deriving rather than remembering. Under §1256(a)(1) every open contract is marked to market at
year end and that gain is taxed *in that year*; §1256(a)(2) then requires *"proper adjustment
shall be made in the amount of any gain or loss subsequently realized for gain or loss taken into
account by reason of paragraph (1)."* Box 9 is last year's mark, already taxed last year, so it
is **backed out**; box 10 is this year's mark, so it is **added**. The 1099-B's own recipient
instruction for box 9 uses the word: *"Shows any year-end **adjustment** to the profit or (loss)
shown in box 8 due to open contracts on December 31, 2024."*

Independent confirmation from inside this repo: `fjs/document/1099b`'s own fixture, written by
somebody reading the paper and not by anyone thinking about this identity, carries
`box8 = -500.00`, `box9 = -1200.00`, `box10 = -1200.00`, `box11 = -500.00`. `-500 − (-1200) +
(-1200) = -500`. The fixture satisfies the identity exactly.

**So line 1 takes box 11 directly — and the engine computes the aggregate as well and refuses on
disagreement.** Never a silent preference for either side. The Form 8962 work set the precedent
one layer down, in `fjs/document/1095a`, where a stored line 33 annual total that misses the sum
of its own twelve Part III rows refuses the document by name.

`R2` below is that refusal. The blank-box rule is stated in Q3.

---

## Q3. The prior-year problem — box 9 is **transcribed, not remembered**

Box 9's printed caption is *"Unrealized profit or (loss) on open contracts—12/31/2024"*, and it
is printed **on this year's own Form 1099-B**. It is therefore not an instance of this repo's
prior-year architectural blocker at all: the engine is not being asked to recall what it computed
last year, only to read a box that a third party printed on a document the taxpayer holds now.
That is exactly the same act as reading box 8.

It is also **never an input to a printed line**. Line 1 takes box 11. Box 9's only reader is the
cross-check. Its registry disposition is therefore `'refused'`, not `'read'` — the disposition
whose definition is "the ONLY reader is a refusal predicate, and that is correct."

**A legitimately-absent box 9 versus a missing one.** A first-year §1256 trader has no open
contracts on 12/31/2024, so the broker prints nothing in box 9. A transcriber who simply skipped
the box also leaves it absent. Inside this year's document alone, the two look identical — but
the identity settles it:

> The cross-check reads an absent box among 8, 9, 10 as the *hypothesis* zero, and requires
> `(box8 ?? 0) − (box9 ?? 0) + (box10 ?? 0) === box11`. A blank consistent with zero passes; a
> blank the identity says was non-zero refuses.

This is not DOC-11 defaulting. The hypothesised zero is used **only inside a check whose failure
is a refusal**, never to compute a printed line — line 1 is box 11 and nothing else. Worked:

| case | box 8 | box 9 | box 10 | box 11 | computed | verdict |
|---|---|---|---|---|---|---|
| first year, everything closed | 5,000.00 | — | — | 5,000.00 | 5,000.00 | computes |
| first year, contracts still open | 3,000.00 | — | 2,000.00 | 5,000.00 | 5,000.00 | computes |
| second year | 3,000.00 | 2,000.00 | 1,000.00 | 2,000.00 | 2,000.00 | computes |
| second year, box 9 dropped in transcription | 3,000.00 | — | 1,000.00 | 2,000.00 | 4,000.00 | **R2** |

The last row is the one this rule exists for, and it is the one an engine that simply trusted
box 11 would have taken silently.

---

## Q4. Parts II and III — honestly, they cannot compute, and Part I alone is complete

Part II Section A (losses from straddles) needs, per position: description of property, date
entered into or acquired, date closed out or sold, gross sales price, cost or other basis plus
expense of sale, **and the unrecognized gain on offsetting positions** (column (g)). Part II
Section B needs five of those six for gains. Part III needs description, date acquired, fair
market value on the last business day of the tax year, and cost or other basis as adjusted.

**No information return carries any of that for a §1256 contract.** The 1099-B's boxes 8-11 are
an *aggregate* — the form's own recipient instruction for box 1c says so outright: *"For
aggregate reporting in boxes 8 through 11, no entry will be present."* There is no per-position
record anywhere in this engine's thirty dialects, and column (g) in particular ("unrecognized
gain on offsetting positions") is a figure that exists only in the taxpayer's own records of
positions they still hold.

So Parts II and III **refuse at the printed line**, by way of a new refused kind
(`straddleGainsAndLosses`) whose `line` is `Form 6781 Parts II and III -> Schedule D lines 4 and
11` and whose remedy names the six per-position columns that are missing.

**Part I alone is a complete, honest deliverable, and this is worth stating rather than
apologising for.** The taxpayer Part I serves without any Part II involvement is the ordinary
futures or index-option trader: someone whose broker sends a 1099-B with boxes 8-11 filled and
who holds no offsetting positions. For that taxpayer Form 6781 is *four printed lines of
arithmetic on one number*, and everything on the form after line 9 is blank. Part I is not a
fragment of Form 6781; for the population this engine serves it **is** Form 6781.

The residual risk is named rather than hidden: a taxpayer who *does* hold a straddle and does not
declare `straddleGainsAndLosses` gets a Part I computed as if line 4 were zero. **Nothing in any
document proves a straddle**, so no tripwire can catch it — `fjs/return/tripwire`'s own rule is
that absence is never evidence. This is a declaration-gated gap, stated here and in the module
header, and it is the same shape as every other kind in the vocabulary.

---

## Q5. The elections — refusal, not certification, and the reason is the direction of the gap

Boxes A, B and C are the mixed-straddle elections; box D is the net section 1256 contracts loss
election. The choice the brief poses is profile certification (the `or(option, true)` DOC-12 pattern
that Form 8962's `noDependentIsRequiredToFileAnIncomeTaxReturn`, Form 7206's
`notEligibleForAnySubsidizedEmployerHealthPlanInAnyMonth`, and the §217(g)
`movingExpensesArmedForcesPermanentChangeOfStation` all use) versus a refused kind.

**A certification is the wrong instrument here, and the test is what the certification would
say.** Every existing certification in this repo has the shape *"the taxpayer states a fact that
makes a computation the engine already performs correct."* A negative certification here would
read "I am making none of the Form 6781 box A through D elections" — and a taxpayer who can
truthfully say that needs nothing: the printed default for a filer who checks no box is line 4 =
blank and line 6 = -0-, which is exactly what this engine computes. The certification would gate
the ordinary case on a declaration that changes nothing. Meanwhile it would not help the taxpayer
who *is* electing, because the engine still could not compute their return.

Certifications also cost the ordinary filer something: `noDependentIsRequiredToFile...` refuses
every family with a dependent until it is set. Spending that cost to change nothing is the wrong
trade.

**So both are refused kinds**, which is the instrument the repo already has for "this taxpayer
has a thing the engine does not compute":

| new kind | printed line | why it cannot compute |
|---|---|---|
| `straddleGainsAndLosses` | Form 6781 Parts II and III (and boxes A/B/C) -> Schedule D lines 4 and 11 | needs the six per-position columns of Part II line 10 and Part III line 14, which no information return carries; and the boxes A/B/C elections all presuppose a straddle, so they cannot arise without it |
| `netSectionTwelveFiftySixContractsLossCarryback` | Form 6781 box D and line 6 -> Forms 1045/1040-X for three prior years | §1212(c) carries the loss back **three years**, and requires an amended Form 6781 and an amended Schedule D for each; this engine models one tax year and holds no prior-year return |

Boxes A, B and C do **not** get a kind of their own. A mixed straddle is a straddle by
definition ("any straddle in which at least one but not all of the positions is a section 1256
contract"), so `straddleGainsAndLosses` already covers every filer who could check one, and its
remedy names all three boxes. Box D is genuinely independent — a filer with no straddle at all
can have a net §1256 loss and want the carryback — so it gets its own kind.

Vocabulary moves 195 -> 197; refused moves 141 -> 143; modeled stays 54.

**The direction of the box-D omission is the safe one for the current year, and that is not an
excuse for silence.** Not checking box D leaves the whole loss in the current year, where it
flows 60/40 to Schedule D and meets the $3,000/$1,500 cap and the carryforward. Electing would
*reduce* the current year's Schedule D. So a return computed with line 6 = 0 is correct as filed;
what the taxpayer loses is an election they may have wanted, which is precisely what a named
refusal is for.

---

## Q6. Interaction with the rest of the 1099-B — disjoint by the form's own construction

The paper settles this outright. Form 1099-B (2025), recipient instructions, box 1d:

> Shows the cash proceeds, reduced by any commissions or transfer taxes related to the sale, for
> transactions involving stocks, debt, commodities, forward contracts, non-Section 1256 option
> contracts, or securities futures contracts. ... **This box does not include proceeds from
> regulated futures contracts or Section 1256 option contracts.**

and box 1c:

> For aggregate reporting in boxes 8 through 11, no entry will be present.

So the §1256 block and the box-1 capital-gain block are **disjoint amounts on the same face**.
Reading boxes 8-11 cannot double-count anything box 1d already carried, because box 1d is defined
to exclude exactly what boxes 8-11 report.

The code agrees, and by construction rather than by coincidence. `fjs/form8949`'s per-document
loop reads `box1dProceeds` first and `continue`s when it is absent:

```js
        if (proceeds === undefined) {
            if (correction !== undefined) { /* the one refusal that survives the skip */ }
            continue
        }
```

Every one of `fjs/form8949`'s nine refusals — box 1f, box 1g, absent basis, box 12 without a
printed basis, undecided category — sits **after** that `continue`. A 1099-B carrying only boxes
8-11 therefore reaches none of them today, and will reach none of them after this work either,
because nothing in this change touches that loop. Two proofs pin it in both directions:

- a §1256-only 1099-B produces zero Form 8949 rows, no refusal, and a non-zero Form 6781 line 1;
- a **consolidated** 1099-B carrying box 1d *and* boxes 8-11 produces both a Form 8949 row and a
  Form 6781 contribution, with the two amounts independently observable.

The second is the control that stops this work from having *narrowed* the existing path, and the
first is the control that stops it from having *widened* it.

---

## The Part I lines this module computes

| line | printed text | this engine |
|---|---|---|
| 1 | identification of account; (b) (Loss); (c) Gain | one row per 1099-B carrying box 11; column (b) if negative, column (c) if positive |
| 2 | "Add the amounts on line 1 in columns (b) and (c)" | two independently observable sums — `line2LossColumnCents` (a **negative** bigint, printed in parentheses on the face) and `line2GainColumnCents` |
| 3 | "Net gain or (loss). Combine line 2, columns (b) and (c)" | `line2GainColumnCents + line2LossColumnCents` |
| 4 | "Form 1099-B adjustments. See instructions and attach statement" | documented `0n` — the adjustments listed in the line 4 instruction are all straddle/hedging items, and `straddleGainsAndLosses` is the kind that refuses them |
| 5 | "Combine lines 3 and 4" | `line3 + line4` |
| 6 | net §1256 contracts loss carried back, box D | documented `0n` — the printed instruction for a filer who did not check box D is "enter -0-", and `netSectionTwelveFiftySixContractsLossCarryback` is the kind that refuses the election |
| 7 | "Combine lines 5 and 6" | `line5 + line6` |
| 8 | line 7 x 40%, short-term | `halfUp` at 40 percent -> Schedule D line 4 |
| 9 | line 7 x 60%, long-term | `halfUp` at 60 percent -> Schedule D line 11 |

Line 2 is kept as two sums rather than one net for the same reason `fjs/schedule/d` keeps lines 7
and 15 independently observable: a sign error inside one document is invisible in a single net
and visible in the pair.

---

## Every refusal this slice adds

| # | condition | why it cannot be computed |
|---|---|---|
| R1 | a 1099-B carries at least one of boxes 8, 9, 10 but **no box 11** | box 11 is what all three printed sources send to line 1, and the engine will not reconstruct the aggregate from an incomplete set — a broker that reported §1256 activity without printing its aggregate, or a transcription that lost it, is a document this engine reads as incomplete rather than as a zero |
| R2 | box 11 is present and `(box8 ?? 0) − (box9 ?? 0) + (box10 ?? 0) !== box11` | the identity §1256(a)(1)-(2) requires does not hold, so either the stored aggregate or one of its three components is wrong and nothing in the document says which. The message names the document, both figures, and which of boxes 8/9/10 were blank — because a blank is the likeliest explanation and the reader needs to see it |
| R3 | the return declares `straddleGainsAndLosses` | Form 6781 Parts II and III need six per-position columns no information return carries (`fjs/return/scope`, not this module) |
| R4 | the return declares `netSectionTwelveFiftySixContractsLossCarryback` | §1212(c)'s three-year carryback needs three prior years' returns (`fjs/return/scope`, not this module) |

R1 and R2 are `{ kind: 'error', message }` values returned by `form6781`, threaded through
`fjs/schedule/d`'s existing error arm — never thrown, and never a new refusal type.

## The tripwire

`fjs/form1040/core`'s `filingScheduleD` reads the declared kind `capitalGainsOrLosses` verbatim
and never document presence (Decision 1.6). A filer holding a §1256 1099-B who does not declare
that kind would run no Schedule D at all, so the box-11 amount would be **silently dropped** —
trading one silent drop for another, which is exactly what TAX-16 exists to prevent and what the
K-1 capital-gain routing had to solve in the same commit as its own wiring.

So `fjs/return/tripwire`'s existing `capitalGainsOrLosses` row gains a second disjunct: a stored
1099-B with a non-zero box 11. It is **the same row**, not a new one — `classifyTripwires`'
`theTableIsExactlyTenDistinctTripwires` requires the kinds to be distinct, and one kind's evidence
belongs in one place. The count stays 10; the evidence string grows to name both.

`SuppliedDocuments` gains `brokerageForms` for the predicate to read, threaded from
`fjs/form1040/core`'s existing `Form1040Inputs.brokerageForms`.

## What is deliberately NOT modeled

- **Parts II and III** — Q4.
- **Boxes A, B, C, D** — Q5.
- **The QOF deferral** the line 8 and line 9 instructions describe. It routes through Form 8949
  with box B/C/E/F checked and Form 8997, neither of which exists here; a filer deferring §1256
  gain into a Qualified Opportunity Fund is already outside this engine at Form 8997.
- **Partnership and S corporation filers.** The line 5 instruction sends them to Form 1065
  Schedule K line 11 / Form 1120-S Schedule K line 10 and says lines 6 through 9 "don't apply to
  partnerships or S corporations and are left blank." This engine computes Form 1040 only.
- **The hedging-transaction exception** (§1256(e)) and **the limited partner / limited
  entrepreneur exception** to the 60/40 rule (Pub 550 p.56: those gains "are treated as
  short-term"). Both are properties of the taxpayer, not of any stored document; both fall under
  the same declaration-gated boundary as the straddle case.

## What moved in the registry

| dialect | field | before | after |
|---|---|---|---|
| `vnd.fjs.1099b` | `box11AggregateProfitOrLoss` | `dropped` | **`read`** — Form 6781 line 1 -> line 7 -> lines 8/9 -> Schedule D lines 4 and 11 -> 1040 line 7a |
| `vnd.fjs.1099b` | `box8ProfitOrLossRealized` | `dropped` | **`refused`** — the only reader is R2's cross-check |
| `vnd.fjs.1099b` | `box9UnrealizedProfitOrLossPriorYearEnd` | `dropped` | **`refused`** — the same |
| `vnd.fjs.1099b` | `box10UnrealizedProfitOrLossCurrentYearEnd` | `dropped` | **`refused`** — the same |

`expectedDroppedCount` 36 -> 32. `expectedMoneyFieldCount` stays 142 — no field was added or
removed, four changed disposition.

---

## The mutation log

Baseline before this work: **2,902 pass / 0 fail**, `tsc` clean. After: **2,938 pass / 0 fail**.
Every mutation below compiled, was applied by line number with `git diff --numstat` confirming one
insertion and one deletion per edited line, and was reverted with `git checkout --` before the
next. The work was committed before the first mutation, per AGENTS.md.

| # | mutation | compiled | red leaves |
|---|---|---|---|
| M1 | box 9's sign `-1n` -> `1n` (the identity becomes `8 + 9 + 10`) | yes | **12** — 7 in `fjs/form6781`, 3 in `fjs/form1040/core`, 2 in `fjs/report/tax_return` |
| M2 | swap the 40/60 rates between Form 6781 lines 8 and 9 | yes | **11** — 8 in `fjs/form6781`, 3 in `fjs/form1040/core` |
| M3 | Schedule D takes the LONG half on line 4 and the SHORT half on line 11 | yes | **6** — 3 in `fjs/schedule/d`, 3 in `fjs/form1040/core` |
| M4 | the R2 cross-check never fires (`&& computed > 10n ** 12n`) | yes | **4** |
| M5 | truncate toward zero instead of `halfUp`, in a form that keeps `of`/`halfUp` live | yes | **3** |
| M6 | box 11 flipped back to `'dropped'` in the registry | yes | **2** — the count gate and the pin |
| M6b | the FULL silencing: flipped AND `expectedDroppedCount` lowered to match | yes | **1** — `theKnownDefectsKeepTheirDisposition` alone |
| M7 | the box 11 tripwire disjunct never fires (`&& false` inside `.some`) | yes | **4** |
| M8 | the core computes Form 6781 and never hands it to Schedule D | yes | **6** |
| M9 | line 1 takes `computed` instead of the stored box 11 | yes | **0 — EQUIVALENT MUTANT** |
| M9b | the same intent in a form that bites: `computed` **and** the guard disabled | yes | **4** |
| M10 | erase `${destination}` from both refusal messages | yes | **3** |
| M11 | the short-term rate parameter `40 -> 41` | yes | **14** |
| M13 | R1 never fires (`presentBoxes.length >= 0`) | yes | **1** |
| M13b | R1 fires on every box-11-less document (`presentBoxes.length > 0`) | yes | **17** |
| M14 | the straddle row's printed line degraded to a vague `'Schedule D'` | yes | **2** |
| M15 | line 2 columns (b) and (c) swapped | yes | **3** |
| M16 | line 3 SUBTRACTS the loss column instead of combining it | yes | **4** |
| M17 | the citation names box 8 instead of box 11 (the VALUE is untouched) | yes | **2** |
| M19 | Schedule D drops the Form 6781 citations while keeping its figures | yes | **5** |
| M20 | the core never threads Form 6781's refusal | yes | **1** |

### The one survivor, and what it taught

**M9 is an equivalent mutant, and it is recorded at the site in `fjs/form6781/module.f.js`.**
Replacing `aggregateCents: stored` with `aggregateCents: computed` cannot turn red at any input,
because the `computed !== stored` guard three lines above makes the two equal. This is the shape
AGENTS.md names — *"a mutation a neighbouring operation absorbs"* — and the instruction it gives
was followed: M9b re-ran the same intent in a form that bites (disable the guard as well) and four
leaves reddened. The choice of token is still not arbitrary, and the site now says why: the pair
encodes that this engine files the BROKER'S reported aggregate and refuses when its own arithmetic
disagrees, never the reverse, which is what R1's own message promises a reader.

### Predictions that were wrong, and what the surprise was worth

- **M2 was predicted to redden the two `fjs/report/tax_return` leaves. It did not.** Those leaves
  assert 1040 line 7a, which is the SUM of the two halves — and `17,200 + 25,800` equals
  `25,800 + 17,200`. This is exactly the transposition trap `fjs/schedule/d`'s Mutation Gate M2
  exists for, reproduced one form up. It confirms that the load-bearing assertion for the split is
  `income.scheduleD15Cents` inside `fjs/form1040/core`, not the line 7a total anywhere; a
  return-level proof asserting only line 7a would have been decoration.
- **M13b was predicted to redden three or four leaves. It reddened 17**, ten of them **pre-existing**
  proofs in `fjs/form1040/core` and `fjs/report/tax_return` that have nothing to do with §1256 —
  the basis-correction group, the Form 3922 refusal, the §1250 end-to-end chain. That is the
  strongest available evidence for Q6's claim that this work neither widened nor narrowed the
  existing 1099-B path: the moment Form 6781 starts refusing an ordinary brokerage document, a
  third of the capital-gains suite says so.
- **M19 was predicted to redden one citation assertion. It reddened five**, because
  `fjs/report/line`'s `ReportLine.sources` is a NON-EMPTY tuple: a 1040 line 7a whose only
  contributor lost its citation cannot be constructed at all. A property of the report layer this
  work did not know it was relying on.
- **M1 left four `fjs/form6781` leaves green, and each is explainable**: the two rounding leaves
  and `aFirstYearTradersGenuinelyEmptyBoxNineComputes` all have box 9 at zero or absent, where
  `-0 === +0`; and `componentsWithoutTheirAggregateAreRefused` hits R1 before the identity is ever
  evaluated.

### What M6b proves about the registry gate

Flipping box 11 back to `'dropped'` alone reddens two leaves — but **both are mechanical**, and an
agent trying to quiet a Form 6781 regression would fix them by lowering `expectedDroppedCount`,
which M6b does. With the count lowered to match, the whole suite passes **except**
`theKnownDefectsKeepTheirDisposition`. That leaf is the only thing standing between a future
regression and a silent reclassification, which is why the four §1256 boxes were added to its
pinned set in the same commit as the wiring.

## One caveat about the `TAX-38` tag

`TAX-38` is used throughout this work as a stable handle, following the precedent of `TAX-37`
(Form 8962) and `TAX-39` (Form 7206). **Neither of those two has an entry in
`.planning/REQUIREMENTS.md` either** — checked, not assumed: a grep for `TAX-36` through `TAX-39`
across every markdown file in the repo finds exactly one hit, a prose mention in
`fjs/schedule/1/todo/self-employed-health-insurance.md`. The highest TAX identifier that document
actually traces is `TAX-35`. So three code-cited requirement IDs now have no requirement behind
them. Recorded rather than quietly extended: `planning-truth-gate.test.js` checks that every
requirement in REQUIREMENTS.md is traced and that every traced ID has a body, but nothing checks
the reverse direction — that an ID cited in `fjs/**` exists at all — and this is the gap that lets
it happen.
