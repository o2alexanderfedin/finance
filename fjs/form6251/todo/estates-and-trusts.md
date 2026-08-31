# Form 6251 line 2j — the alternative minimum tax adjustment from an estate or trust

**Status:** specified, implemented on `feature/tier-a-refused-kinds`
**Kind:** `amtEstatesAndTrusts`
**Printed line:** Form 6251 line 2j -> Schedule 2 line 2 -> 1040 line 17

## Sources, fetched and read (2026-08-18), not from recall

- `https://www.irs.gov/pub/irs-pdf/f6251.pdf` — the 2025 form. Line 2j's printed
  caption, transcribed from the page:

  > **j** Estates and trusts (amount from Schedule K-1 (Form 1041), box 12, code A)

- `https://www.irs.gov/pub/irs-pdf/i6251.pdf` — the 2025 instructions, *Beneficiaries
  of estates or trusts* (Part III, lines 13, 14 and 15) — the table reproduced below.
- `https://www.irs.gov/pub/irs-pdf/i1041sk1.pdf` — the 2025 Instructions for Schedule
  K-1 (Form 1041), *Box 12—Alternative Minimum Tax Items*:

  > The information reported in box 12, codes A through I, is used to prepare your
  > Form 6251. **Code A, Adjustment for minimum tax purposes, is the total amount
  > reported on Form 6251, line 2j. Codes B through F represent the portion, if any,
  > of the amount included in code A.**

## What was missing

Form 6251 line 2j was a documented zero (`fjs/form6251/module.f.js:601-603`), naming
the `amtEstatesAndTrusts` kind. A beneficiary of an estate or trust holding a Schedule
K-1 (Form 1041) with box 12 code A received a return whose **alternative minimum
taxable income was understated by the whole of that adjustment** whenever the
adjustment was positive. That is TAX-16's direction: not a missed deduction the filer
would notice as a smaller refund, but a tax the return failed to charge.

## The remedy string was STALE, and false

`fjs/return/scope/module.f.js:781` says:

> `remedy: 'requires Schedule K-1 (Form 1041) box 12 code A, and this engine models no
> Form 1041 K-1 at all — DOC-24 (Phase 30) brings the partnership and S-corporation
> K-1s, not the fiduciary one (no phase yet)'`

**"this engine models no Form 1041 K-1 at all" has been false since Phase 30.**
`vnd.fjs.k1_1041` shipped with that phase and carries
`box12AlternativeMinimumTaxItems` as `or(option, array(codedEntry))` —
`{ code, amount }` rows — at `fjs/document/k1_1041/module.f.js:179`, inside the
dialect's own `codedBoxError` money-exactness loop (`:184` `codedBoxFields`), so every
stored amount in that box is already validated to the cent.

Had the line stayed refused, the honest remedy would have been:

> requires Schedule K-1 (Form 1041) box 12 code A. `vnd.fjs.k1_1041` has stored that
> box as coded `{code, amount}` rows since Phase 30 and **no computation reads them**;
> `fjs/schedule/e`'s coded sweep refuses the box outright (no phase yet)

— which is the `box13StatutoryEmployee` shape this repository has now paid for three
times: a transcribed, validated, stored field that no computation reads, so nothing
can ever notice it being wrong. Since this work wires the line, the row leaves
`unmodeledKindRefusals` entirely and the string goes away.

## Which box 12 codes are let through, and which still refuse

Box 12 carries ten codes. **Exactly one of them is line 2j**, and the printed caption
says which: *"amount from Schedule K-1 (Form 1041), box 12, **code A**"*.

| code | what it is | destination | here |
|---|---|---|---|
| `A` | Adjustment for minimum tax purposes | **Form 6251 line 2j** | **computed** |
| `B` | AMT adjustment attributable to qualified dividends | AMT Qualified Dividends and Capital Gain Tax Worksheet line 2, or AMT Schedule D Tax Worksheet | refuses |
| `C` | AMT adjustment attributable to net short-term capital gain | AMT Schedule D line 5 | refuses |
| `D` | AMT adjustment attributable to net long-term capital gain | AMT Schedule D line 12 | refuses |
| `E` | AMT adjustment attributable to unrecaptured §1250 gain | AMT Unrecaptured Section 1250 Gain Worksheet line 11 | refuses |
| `F` | AMT adjustment attributable to 28% rate gain | AMT 28% Rate Gain Worksheet line 4 | refuses |
| `G` | Accelerated depreciation | the applicable Form 6251 line (2l) | refuses |
| `H` | Depletion | the applicable Form 6251 line (2d) | refuses |
| `I` | Amortization | the applicable Form 6251 line | refuses |
| `J` | Exclusion items | **2026** Form 8801, not Form 6251 at all | refuses |

The `B`-through-`F` destinations are quoted from `i6251.pdf`'s own table (*"IF the
code in box 12 is... THEN include that adjustment in figuring the amount on..."*), not
inferred here.

**Two facts decide the whole table, and both cut against a wider gate:**

1. **B through F are a PORTION OF code A** (`i1041sk1.pdf`, quoted above). Adding any
   of them to line 2j would count the same adjustment twice. They are not a second
   summand; they are a decomposition of the first, and their job is to modify the
   AMT versions of the capital-gain worksheets in **Part III**, which this engine
   does not refigure. A return carrying one of them therefore needs a Part III this
   module cannot build, and it refuses — the same posture
   `noRegularPreferentialWorksheetRefusal` already takes for the other Part III
   corner it cannot transcribe.
2. **G, H and I go to OTHER Form 6251 lines** — 2l, 2d and the amortization line —
   every one of which is a documented zero with its own live `fjs/return/scope` kind
   (`amtDepreciation`, `amtDepletion`, `amtOtherAdjustments`). Routing them to line 2j
   would put a depreciation preference on the estates-and-trusts line: the right total
   by the wrong line, on a form whose Part III reads individual lines.

**Code J is not a Form 6251 item at all.** Exclusion items feed the *following* year's
Form 8801 minimum tax credit, which `fjs/return/scope`'s `priorYearMinimumTaxCredit`
row already refuses by name. It is the cleanest control this work has: a gate that
"lets AMT codes through" and cannot tell J from A is letting through a number that
belongs on a different year's return.

## The computation

No floor, no threshold, no phase-out, no worksheet. The box IS the computation:

    line 2j = Σ amount  over every box 12 entry, on every stored Schedule K-1
                        (Form 1041), whose trimmed, upper-cased code is exactly `A`

**Not floored at zero, and that is load-bearing.** An AMT adjustment can be negative —
in later years an AMT depreciation schedule allows *more* than the regular one, and
the fiduciary reports the difference as a negative code A. The printed page prints no
"if zero or less, enter -0-" on line 2j and no parentheses box demanding a positive
entry (contrast lines 2b and 2f, which print `(     )`, and line 2e, which says *"Enter
as a positive amount"*). `i6251.pdf`'s own *Who Must File* item 4 — *"The total of Form
6251, lines 2c through 3, is negative"* — states outright that this block of lines can
sum below zero. Flooring a negative code A at zero would **overstate** alternative
minimum taxable income, which is a confident wrong answer in the direction this project
refuses to accept as "safe".

**Summed across every stored form without scoping by `recipientTin`**, exactly as line
2i is: a joint return computes ONE Form 6251 over ONE alternative minimum taxable
income, and §56 makes no per-spouse distinction.

**A code A row whose `amount` is ABSENT refuses.** A coded row may print `STMT` instead
of a figure, and `codedEntry.amount` is `or(option, string)` for that reason. Here the
absence is not a zero: it says a real adjustment exists on an attached statement that
this engine has not been given. Skipping it would silently drop a preference item the
fiduciary reported to the IRS — DOC-11's absent-is-absent rule at the point where it
changes an answer, the same call `isoSpreadTotal` makes for a Form 3921 missing box 3,
4 or 5.

## Matching the code

Copied in shape from `employerHsaContributionSources`
(`fjs/schedule/1/module.f.js:617-624`), because `fjs/document/k1_1041` stores a coded
row's `code` **as printed** and never interprets it:

- matched after **trimming** and **upper-casing** — `' a '` is the same box as `'A'`;
- matched on the **whole trimmed string**, never a prefix — a row coded `'AA'` is not
  code `A` and contributes nothing;
- the code list is **hand-typed once** (`line2jCodes`), never derived from anything the
  code under test owns.

### The gate and the reader normalize differently, deliberately

`fjs/schedule/e`'s `codedBoxSweep` compares `passThroughCodes.includes(row.code)` on
the **raw** string, and it is shared by all three K-1 dialects. It is left alone:
loosening it would also loosen the 1065 box 14 code A read, where a lower-cased `'a'`
would pass the sweep and then be missed by `selfEmploymentEarningsForRow`, dropping
self-employment earnings to zero — an understatement.

So the gate is the STRICTER of the two, and the asymmetry is safe in exactly one
direction: every code the sweep lets through (`'A'` precisely) the reader also sums, so
nothing can be silently dropped; and a document coded `' a '` **refuses the whole
return at Schedule E** before Form 6251 computes anything. `aLowerCaseCodeStillRefusesAtTheGate`
is the leaf that keeps that true rather than assumed.

## Citation contract

**One `Source` per contributing box 12 entry**, never one per document: a single K-1
can carry several coded rows, and a per-document citation would not say which row put
the number there.

    { documentHash, boxPath: `k1_1041.box12[code=A]`, value: amount }

**The box path is dialect-qualified, and that is not decoration.** `box12` exists on
TWO forms this engine reads, and **both have a code A**: Form W-2 box 12 code A is
uncollected social security tax on tips (Schedule 2 line 13, shipped in `15c30af`), and
Schedule K-1 (Form 1041) box 12 code A is this AMT adjustment. A bare
`box12[code=A]` could not tell them apart, and `fjs/form1040/core` already
dialect-qualifies every K-1 box path (`k1_1041.box1InterestIncome`) for the same
reason at 1040 line 2b. The normalized code is what reaches the path, so a citation
reads `k1_1041.box12[code=A]` whatever the stored spelling was.

The sources are **appended** to Schedule 2 line 2's existing source tuple, exactly as
`isoSources` already are and for the identical reason: `unionSources` takes
`ReportLine`s, and a K-1 box is not a report line. No deduplication is lost — a
`(documentHash, boxPath)` pair naming a K-1 cannot collide with one naming a 1040 line.

## Wiring

`fjs/form6251` takes the **documents**, not a pre-summed figure, and the reason is the
one its own `Form6251Input` docstring gives for the difference between lines 2i and
2g: line 2g is a plain sum of a fixed box that `fjs/form1040/core` already sums for the
regular tax (box 8), so a second reader there would be a second rule for one box; box
12 has **no** reader anywhere else in the engine, its rows need per-code filtering, and
its citation contract is per-entry. Putting the reader in one place — a small
`fjs/form6251/estate_trust` module — is what lets `fjs/schedule/e`'s gate and Form
6251's own sum share one hand-typed code list, so the gate can never open wider than
the computation (AGENTS.md, "one rule, one place").

The documents reach it the way `isoExerciseForms` already do:
`fjs/form1040/core` -> `fjs/schedule/2` -> `fjs/form6251`. `estateTrustK1Forms` was
already in `fjs/form1040/core`'s scope, feeding 1040 lines 2b/3a/3b and Schedule E
Part III, so the call site passes what it holds.

**`fjs/schedule/2/module.f.js` is edited, and it was not on this work's allowed list.**
It is unavoidable and reported to the caller rather than worked around: `fjs/schedule/2`
is the only caller of `fjs/form6251`, so an input it does not carry cannot reach the
form, and it is also where line 2's provenance is assembled. The edit is the same
three-part shape `15c30af` made for `w2Forms`: one field on `ScheduleTwoInput`, one
argument at the `form6251` call, one `flatMap` appended to line 2's sources.

## The gate at `fjs/schedule/e`

`estateTrustCodedBoxes` (`fjs/schedule/e/module.f.js:970-978`) refused every code in
every one of the five coded boxes. Box 12's entry now carries `line2jCodes` — the
**same exported array** the sum reads — so:

- code `A` passes the sweep and is computed on line 2j;
- codes `B` through `J` still refuse by name, citing §652(b)/§662(b), naming the
  printed box and the code;
- opening the gate to every code and forgetting to compute one is impossible by
  construction, because the list is not duplicated.

The existing `allFiveCodedBoxesRefuseByNameCitingSection652b` leaf drove every one of
the five boxes with a row coded `'A'`. Box 12 now needs a code the engine genuinely
does not route, so that leaf drives box 12 with `'G'` (accelerated depreciation, a
Form 6251 line 2l item) and states why.

## Proofs

Hand-typed expected values in integer cents, the dollar figure in the assertion
message, never derived from the sum under test. **Value and citation in separate
leaves.**

At `fjs/form6251/estate_trust` (the rule):

- one K-1 with one code A row -> the hand-typed amount; separately, one cited source
  under that document's hash with `k1_1041.box12[code=A]`
- two K-1s each with a code A row -> the hand-typed total; two sources, one per
  document
- one K-1 whose box 12 carries A **and** a code the engine does not route -> only A
  contributes (this is the sum's own control; the return-level control is the gate)
- a NEGATIVE code A -> the negative total, unfloored, and the source's `value` keeps
  its printed sign
- a positive and a negative code A on two documents -> they net
- `' a '` and `'A'` are the same code; `'AA'` is **not** and contributes nothing
- no `box12` key at all, and an empty `box12` array -> zero, no sources
- a code A row with no `amount` -> a refusal naming the document and the box

At `fjs/form6251` (the line):

- line 2j equals the adjustment, and it moves line 4, line 6 and line 11
- a negative adjustment REDUCES alternative minimum taxable income
- the refusal threads out of `form6251` as a `Form6251Error`

At `fjs/schedule/e` (the gate):

- box 12 code A no longer refuses; the beneficiary's row still computes
- box 12 codes B, C, D, E, F, G, H, I and J each still refuse by name — a hand-typed
  list of NINE, so a code silently added to `line2jCodes` reddens here
- `' a '` refuses at the gate (the asymmetry above, pinned)

At `fjs/schedule/2` (the provenance):

- line 2 cites the K-1 box 12 entry by hash and by dialect-qualified box path

At `fjs/form1040/core` (**the wiring**, which no form-level leaf can prove):

- an exercise-and-hold return **plus** a beneficiary K-1 with box 12 code A -> 1040
  line 17 is the hand-typed larger figure, and a differential against the identical
  return without the K-1 prices the adjustment exactly
- the same return with a NEGATIVE code A -> 1040 line 17 is the hand-typed smaller
  figure
- 1040 line 17 cites the K-1 by hash and by `k1_1041.box12[code=A]`
- the same return carrying box 12 code **J** instead -> the return REFUSES (the
  control: a gate that let everything through would compute here instead)

## Mutations to run before claiming the proofs work

- line 2j forced to `0n`
- a negative adjustment floored at zero (`max(total)(0n)`)
- the code match loosened to a prefix (`startsWith`)
- the trim/upper-case normalization removed
- the gate opened to every code (`passThroughCodes` ignored for box 12)
- code `A` removed from `line2jCodes`
- line 2j dropped from the Part I total on line 4
- the absent-amount refusal turned into a skip
- **`estateTrustK1Forms: []` handed to `fjs/schedule/2` from `fjs/form1040/core`** —
  the wiring mutation `15c30af` learned to run, which every form-level leaf is blind to
- the citation's `boxPath` de-qualified / the `value` replaced by the summed total

## What the mutations actually found

Fifteen mutations were run. A second agent was editing `fjs/form8995`,
`fjs/form8995a` and parts of `fjs/form1040/core` in the same checkout, so
AGENTS.md's *"concurrent work invalidates a mutation observation"* applies in
full: a first snapshot taken with `tar` captured that agent mid-write and came
back red in `fjs/form8995a` before any mutation existed. The snapshot was
rebuilt from **`git archive HEAD` plus this work's files only**, with this
work's `fjs/form1040/core` hunks re-applied onto HEAD's copy — a tree in which a
red result can only be this work's.

Baseline in that snapshot: **2,323 pass, 0 fail** (HEAD's 2,298 plus this work's
25 leaves). Every mutation was a `+1 -1` edit except M8's `+3 -0`, and after each
the file was restored from a pristine copy; the final restore was verified with
`diff -r` and re-ran green at 2,323.

| # | mutation | fail |
|---|---|---|
| M1 | line 2j forced to zero (`* 0n`) | 9 |
| M2 | the sum floored at zero | 3 |
| M3 | the code match loosened to a prefix (`startsWith`) | 1 |
| M4 | the trim/upper-case normalization removed | 1 |
| M5 | the gate opened to every box 12 code | 3 |
| M6 | `line2jCodes` emptied — gate AND sum together | 23 |
| M7 | line 2j dropped from line 4's Part I sum | 7 |
| M8 | the absent-amount refusal turned into a `continue` | 2 |
| M9 | **`fjs/form1040/core` hands `fjs/schedule/2` an empty K-1 list** | 3 |
| M10 | the citation's `boxPath` de-qualified (`k1_1041.` dropped) | 4 |
| M11 | the citations dropped from Schedule 2 line 2's sources | 2 |
| M12 | the citation's `value` emptied | 3 |
| M13 | the gate closed again for code A alone | 6 |
| M14 | the sum reads box 13 instead of box 12 | 19 |
| M15 | `fjs/schedule/2` hands `fjs/form6251` an empty K-1 list | 3 |

**None survived, and no leaf had to be added afterwards — because the wiring
leaves were written first, from `15c30af`'s lesson rather than after paying for
it again.** M9 is that lesson: its three red leaves are ALL of the end-to-end
ones and NONE of the twenty-one form-level ones. Without
`fjs/form1040/core`'s four leaves the entire suite would have stayed green while
a beneficiary's return understated the alternative minimum tax by 28% of their
whole adjustment.

Three predictions were wrong in an informative direction:

- **M9 and M15 leave both CITATION leaves green.** `fjs/schedule/2` builds line
  2's sources from its own `estateTrustK1Forms`, so cutting the list handed to
  `fjs/form6251` breaks the VALUE while the citations still name the K-1. The
  pair is only caught because value and citation are asserted in separate
  leaves and the value leaves are end-to-end.
- **M1 leaves every citation leaf green too**, for the same structural reason,
  which is the intended shape rather than a gap: a citation leaf that moved with
  the value would be asserting the value twice.
- **M3 and M4 redden exactly ONE leaf each**, and it is the same leaf. No
  printed box 12 code is two letters, so a prefix match is unobservable on every
  fixture except the deliberately transcribed `'AA'` — which is precisely why
  that fixture exists.

## Reclassification — NOT done here

`fjs/return/scope/module.f.js` is out of scope for this work by instruction. The kind
stays in `unmodeledKindRefusals`; the exact edits it needs are reported to the caller:

1. delete the `amtEstatesAndTrusts` row from `unmodeledKindRefusals` (`:781`);
2. add `'amtEstatesAndTrusts'` to `modeledKinds`;
3. `expectedModeledKindCount` 41 -> 42, `expectedUnmodeledKindCount` 73 -> 72;
4. drop `['amtEstatesAndTrusts', 'Form 6251 line 2j']` from
   `theFormSixTwoFiveOneLinesAreNameableByKind`'s unmodeled table (`:1919`) — that
   leaf's own hand-typed count moves with it.

Until then a taxpayer who *declares* `amtEstatesAndTrusts` is still refused by scope,
while the same taxpayer who merely *stores the K-1* gets the computed line — the
established "wire before reclassify" ordering, and the reason a declared kind and a
stored document are not the same assertion.

## Not in scope

- **Part III's AMT capital-gain worksheets** (box 12 codes B-F). They need AMT
  versions of the Qualified Dividends and Capital Gain Tax Worksheet, Schedule D, the
  Unrecaptured Section 1250 Gain Worksheet and the 28% Rate Gain Worksheet — four
  worksheets refigured, not one line.
- **Form 8801** (box 12 code J), which is next year's return.
- **A tripwire** for a stored K-1 carrying box 12 code A on a return that never
  declares `alternativeMinimumTax`. `fjs/return/tripwire` watches a stored Form 3921
  for exactly that shape and the K-1 deserves the same watch; it is a separate file
  and a separate change.
