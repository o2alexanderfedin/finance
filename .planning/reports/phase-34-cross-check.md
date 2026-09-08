# Phase 34 — Second-Implementation Cross-Check, Without the Owner's Documents

**Tax Year 2025, against three published sources. 2026-09-08.**

> The roadmap asks for the owner's own documents run through a free commercial
> filer and through this engine, diffed line by line, because *"two independent
> implementations agreeing is what a prior-year return was standing in for."*
> The owner's documents do not exist yet and this agent has no account at a
> filer. **The phase is therefore only partly satisfiable, and §7 says exactly
> which part is missing.** What follows is the part that can be done now.

---

## 0. Headline

| | |
|---|---|
| Comparisons against a published money figure | **8,371** |
| Disagreements found | **4** |
| Of those, this engine wrong | **0** |
| Of those, the published source wrong or superseded | **4** |
| New proof leaves, all mutation-verified | **9** |

The 8,371 breaks down as 8,248 printed Tax Table cells, 70 rate-schedule
figures (a ceiling and a cumulative tax for each of 35 rows), 40 Tax
Computation Worksheet probes, 9 lines off the ten commercial-filer returns, and
4 off the two Internal Revenue Service test scenarios.

The four disagreements are all with the **Internal Revenue Service's own Tax
Year 2025 Assurance Testing System scenarios**, they are all in the two
scenarios that carry a completed Form 1040, and each has a root cause (§4):
two of them enter the pre-OBBBA standard deduction on a form whose own printed
margin gives the OBBBA one, and one computes line 16 by applying ten percent to
the exact taxable income rather than to the Tax Table band's midpoint. The
fourth is the second scenario's copy of the same standard-deduction error. The
same scenario that gets line 16 wrong at $1,620 is matched by the other, which
agrees to the dollar at $107,445 — that control is what makes these findings
rather than a misreading of the source.

**The engine's Tax Year 2025 parameters now have an outside witness**, which is
the thing Phase 33 could not give them: that run priced fifty-one Tax Year 2024
returns against a parameter set its own report calls *"the standing suspect in
every number"*, and nothing in it touched a figure this engine ships.

---

## 1. What the phase asked for, and what stands in for it

Phase 34's premise is that comparing an engine to a printed page finds
transcription errors, and only comparing it to a **second implementation** finds
the rest. Everything in this repository's `fjs/tax/**` is the first kind. So the
substitute has to be somebody else's answer, not another IRS table.

Three sources were used and two were rejected. What each one is, and what it is
worth, matters more than the count:

| source | what it is | is it a second *implementation*? |
|---|---|---|
| **TaxCalcBench tax year 2025** | Ten complete federal Forms 1040 with every line, produced by Column Tax — a commercial filer — from its own production engine | **Yes.** Different people, same statute, no shared code |
| **IRS Assurance Testing System, tax year 2025** | Eight Form 1040 scenarios for e-file software developers; two carry a completed return | **Yes**, and by the Service itself — though see §4 for what they are actually for |
| **IRS Publication 17 (2025)** | The printed 2025 Tax Table, Tax Rate Schedules and Tax Computation Worksheet | **No** — a second *printing*. Included because it is a complete published OUTPUT over the whole domain, which no worked example is |
| IRS Publication 4491-W and 4491 (VITA/TCE problems) | withdrawn | — |
| IRS Direct File (the Service's own open-source engine) | tax year 2024 only | — |

### 1.1 Why an IRS worked example is not a second implementation

This is the reason the obvious source is the wrong one. Every worked example in
a form instruction is written by the same office that wrote the instruction this
engine transcribes, and this repository already reads them systematically —
`fjs/form2441`, `fjs/form6251`, `fjs/form8962`, `fjs/form4562/macrs` and a dozen
others each carry the printed example as a fixture. Adding more would deepen the
check on our transcription. It cannot produce a disagreement about a rule both
sides read the same way.

Publication 17 is in the table above anyway, and the reason is worth separating
from the reason for the other two: the printed Tax Table is not an *example*, it
is 2,062 rows of finished output covering every taxable income below $100,000 in
four filing statuses at once. Whoever computed it did so independently of this
engine, so a full-page diff is a real check even though it is not a rival
implementation. It is the only place in this phase where the comparison is
exhaustive rather than sampled.

### 1.2 Publication 4491-W, and Direct File

Both were pursued and both are dead ends, recorded so the next reader does not
repeat the search:

- **`https://www.irs.gov/pub/irs-pdf/p4491w.pdf` returns 404**, as does
  `https://www.irs.gov/forms-pubs/about-publication-4491`. The VITA/TCE problems
  and exercises workbook — historically the best public set of fully worked
  returns with answer keys — is no longer published at its own catalogue number.
- **IRS Direct File** is open source (`IRS-Public/direct-file`, last pushed
  2026-06-11) and is a genuine second implementation written by the Service.
  It is **tax year 2024**: a code search of the repository finds `14600` — the
  tax year 2024 single standard deduction — 115 times and `15750` **zero**
  times. Against a tax year 2024 engine, this phase would have had to
  hand-transcribe a tax year 2024 parameter set exactly as Phase 33 did, and
  would have inherited that transcription as its own largest uncertainty. Not
  used, and that is the reason.

---

## 2. Publication 17 (2025): the whole printed table, row by row

The engine generates the Tax Table from stored brackets rather than storing
2,700 rows (`fjs/tax/table`'s own design decision). Until this phase, **ten
rows** of the printed table had ever been checked against it.

Every row was checked here:

| | compared | disagreements |
|---|---|---|
| 2025 Tax Table rows | 2,062 | 0 |
| — money cells within them (four columns each) | 8,248 | 0 |
| 2025 Tax Rate Schedule rows (5 statuses x 7 brackets: rate, ceiling, and cumulative tax at the boundary) | 35 | 0 |
| 2025 Tax Computation Worksheet probes (20 rows x 2 incomes) | 40 | 0 |

The table extraction is `extract-p17.mjs` and refuses on a gap, on two
conflicting readings of one row, or on a table that does not run contiguously
from `$0` to `$100,000` — so a silently dropped row cannot shrink the diff.
The result is vendored as `p17-tax-table.json` because the whole value of this
leg is that its side of the comparison did not come from `fjs/`.

### 2.1 Four mutations, and the two that are the point

| mutation | disagreements | which leg caught it |
|---|---|---|
| single 12% ceiling `$48,475` → `$48,470` | 16 | **rate schedules and worksheet only — the Tax Table saw nothing** |
| single 12% rate 12 → 13 | 1,776 | table, overwhelmingly |
| head of household 10% ceiling `$17,000` → `$16,950` | 1,677 | table |
| qualifying surviving spouse 12% ceiling `$96,950` → `$96,900` | 6 | **rate schedules only — the Tax Table has no such column** |

The first and last are the informative ones and neither was predicted.

**A $5 shift in a bracket ceiling is invisible to the entire printed Tax
Table.** At the $48,450–$48,500 row the midpoint is exactly $48,475: with the
ceiling moved down five dollars the tax becomes
`$1,192.50 + 12% x $36,545 + 22% x $5 = $5,579.00`, and the correct figure is
`$5,578.50`, which the table's whole-dollar rounding turns into $5,579 as well.
Every other row above the boundary shifts by less than fifty cents and rounds
back. The rate schedules and the worksheet, which carry cents, catch it at once.

**The qualifying surviving spouse's brackets are unreachable from the Tax
Table**, because the table has four columns and a surviving spouse reads the
married-filing-jointly one. Above $100,000 that status uses its own separately
stored schedule, and only the rate-schedule leg looks at it.

---

## 3. TaxCalcBench tax year 2025: ten returns from a commercial filer

The benchmark (<https://github.com/column-tax/tax-calc-bench>, paper
<https://arxiv.org/abs/2507.16126>) is the same one Phase 33 used, and that is a
weakness worth stating first: **it is the same second implementation, so this
phase adds a year and ten cases but no vendor diversity.** Phase 33 also found
the benchmark itself wrong once (its §5.2), so "the source is wrong" stays a
live verdict here.

What is new is the year. These ten are priced with `taxParamsByYear[2025]` — the
shipped set, no overrides — where Phase 33 had to build a tax year 2024 set by
hand and then treat it as the prime suspect in every divergence.

### 3.1 What was compared, and what was not

The benchmark's tax year 2025 inputs are scanned document PDFs plus a
proprietary interview schema, and nine of the ten returns carry a form this
engine does not model: Form 4952, Form 4684, Form 8283, Form 8582, Schedule R,
a Form W-2G, Form 8995-A Schedule C. **Reconstructing those inputs by hand would
put the reconstruction on trial, not the engine** — which is precisely what
Phase 33's own §5.4 records happening four times in one run. So the comparison
takes only lines whose INPUT the published return itself states:

| case | filing status | line 12e | line 16 |
|---|---|---|---|
| `ty25-us-001` | head of household | itemized | not reachable: $5,000,000 long-term gain, and a Form 4952 election of $75,000 as investment income |
| `ty25-us-002` | head of household | itemized | **agrees**, $753, Tax Table |
| `ty25-us-003` | married filing jointly | **agrees**, $33,100 | **agrees**, $2,754, Tax Table |
| `ty25-us-004` | married filing jointly | itemized | not reachable: $4,870 qualified dividends, $37,109 net gain |
| `ty25-us-005` | married filing jointly | **agrees**, $31,500 | not reachable: $1,500 qualified dividends |
| `ty25-us-006` | married filing separately | **agrees**, $15,750 | not reachable: $12,000 qualified dividends |
| `ty25-us-007` | married filing separately | **agrees**, $15,750 | not reachable: $7 qualified dividends, $18,458 net gain |
| `ty25-us-008` | married filing separately | itemized | **agrees**, $22,173, Tax Computation Worksheet |
| `ty25-us-009` | married filing separately | **agrees**, $17,350 | not reachable: $1,500 qualified dividends |
| `ty25-us-010` | qualifying surviving spouse | itemized | **agrees**, $758, Tax Table |

Five line 12e comparisons, four line 16 comparisons, **nine agreements and zero
disagreements**. Two lines out of the nineteen the benchmark's own evaluator
grades is a narrow diff and this report does not pretend otherwise.

### 3.2 The four that carry weight

- **`ty25-us-009`'s $17,350** is $15,750 plus **$1,600**, not plus $2,000. A
  married-filing-separately filer aged 65 takes the *married* aged increment
  even though the basic deduction it is added to is single's. A second
  implementation agreeing on $17,350 is what says this engine reads the right
  one of two figures that sit beside each other in Rev. Proc. 2024-40 §2.15(3).
- **`ty25-us-003`'s $33,100** is $31,500 plus one $1,600 box — the OBBBA
  standard deduction, in a real return, from outside. Its full stack is worth
  noting even where this report does not check it: its line 15 of $26,905 is
  $66,005 less $33,100 less a **$6,000 Schedule 1-A enhanced senior deduction**,
  and its Schedule 1-A prints the OBBBA threshold figures this engine also
  stores ($150,000 for the senior deduction at joint filing status, $300,000 for
  tips and for overtime, $200,000 for car loan interest). Phase 33 could not
  test any of that: it had to zero `seniorDeduction` outright to run at all.
- **`ty25-us-008`'s $22,173** is the Tax Computation Worksheet, and it is the
  one row where the whole-dollar rounding is not a no-op: the exact answer is
  `24% x $122,193.00 - $7,153.00 = $22,173.32`.
- **`ty25-us-002` and `ty25-us-010`** both land on an exact half dollar before
  rounding — $752.50 and $757.50 — so the Tax Table's midpoint rule and its
  tie-breaking direction are both being priced by a second implementation.

### 3.3 Two things about the benchmark that Phase 33's report gets slightly wrong

Recorded because the next reader will compare the two reports:

- **Nineteen graded lines, not twenty.** Phase 33's report says the evaluator
  grades *"20 Form 1040 lines"* and then lists nineteen. `LINES_TO_XPATH_VALUES`
  in `tax_return_evaluator.py` has nineteen entries, and `ty25_scoring.py`'s
  federal tuple has nineteen. The list itself was right both times; only the
  count was wrong.
- **The forty state cases carry no federal return.** Their `output.xml` is a
  `ReturnState`, not a `Return`: `ty25-ny-001`'s contains the string `IRS1040`
  zero times. The federal tax year 2025 ground truth is exactly the ten
  `ty25-us-*` cases, and there is no larger set to grow into.

---

## 4. The disagreements: the Service's own test scenarios

The task that opened this phase asked whether the IRS's Assurance Testing System
scenarios are public and whether they carry expected outputs. **They are public,
and the answer to the second question is "mostly no, and where it is yes they
are not arithmetic ground truth."** That is a finding, and it cost the only four
disagreements in this report.

`https://www.irs.gov/e-file-providers/tax-year-2025-form-1040-series-and-extensions-modernized-e-file-mef-assurance-testing-system-ats-information`
publishes eight Form 1040 scenarios for tax year 2025 (numbers 1–5, 8, 12, 13;
the set also has one Form 1040-SS and one Form 4868). All eight were downloaded
and opened. **Six print the taxpayer's documents — Forms W-2, 1099-R, Schedule C
detail — and leave every computed 1040 line blank.** That is what the scenarios
are for: a developer computes the return and the Service validates the resulting
XML against its schema and its business rules, none of which recompute line 16.
Publication 1436, the ATS guidelines, says as much in two consecutive
sentences: *"The test return scenarios provide information necessary to prepare
selected forms and schedules... IRS processing consists of two steps – schema
validation and business rule validation."* Neither step is arithmetic.

Two do carry a completed return, and both disagree with this engine.

### 4.1 Line 12e, both scenarios — the pre-OBBBA standard deduction

| | scenario 12 (single) | scenario 13 (married filing jointly) |
|---|---|---|
| scenario enters | **$15,000** | **$30,000** |
| this engine | $15,750 | $31,500 |

$15,000 and $30,000 are Rev. Proc. 2024-40 §2.15's original tax year 2025
figures. P.L. 119-21 §70102 raised them, and Rev. Proc. 2025-32 §3.01 restates
them as $15,750 and $31,500 — which is what this engine stores, what Publication
17 (2025) prints on its page 1 *"Standard deduction amount increased"* notice
and in its filing-requirement chart, and, decisively, **what the scenario's own
form face prints in the left margin two lines above the entry**: *"• Single or
Married filing separately, $15,750"*, *"• Married filing jointly or Qualifying
surviving spouse, $31,500"*.

**Verdict: the scenario is internally inconsistent and superseded; this engine
is right.** The scenario is not wrong for its purpose — an e-file business rule
does not check the standard deduction — but it cannot be used as an arithmetic
expectation.

### 4.2 Line 16, scenario 13 — the Tax Table was not used

Taxable income **$1,620**, married filing jointly, and the scenario enters
**$162**. That is ten percent of $1,620 exactly.

The printed 2025 Tax Table's `$1,600`–`$1,625` row says **161** in all four
columns, because a row prices its own midpoint of $1,612.50 and
`10% x $1,612.50 = $161.25`. Below $100,000 the Tax Table is not optional. This
engine answers $161.

**Verdict: the scenario applied the rate to the income instead of reading the
table; this engine is right.** The third possible answer is worth naming because
it is the mistake `fjs/tax/table` was built to avoid and it is a *different*
number again: ten percent of the band's lower bound $1,600 is $160.

### 4.3 Line 16, scenario 12 — agreement, and why it matters most

Taxable income **$107,445**, single, and the scenario enters **$18,634**. Above
$100,000 the Tax Computation Worksheet applies:
`24% x $107,445.00 - $7,153.00 = $18,633.80`, which rounds to $18,634. This
engine answers the same, to the dollar, on the harder of the two arithmetics.

This is the control (AGENTS.md: *"a gate needs a control"*). Without it, "this
engine disagrees with an IRS test scenario" would be a claim with nothing behind
it. Note also that the agreement is with the scenario's own line 15 — stale
deduction and all — so the two results are cleanly separated: the disagreements
are about which figures go in, and this is about the arithmetic that follows.

---

## 5. What shipped, and what watching it fail showed

Nine new proof leaves, all under `npm test`:

- **`fjs/tax/crosscheck/module.f.js`** (new) — the ten published tax year 2025
  returns, the two test scenarios, the census of what is not compared and why.
- **`fjs/tax/table/module.f.js`** — twelve rows added to `handTranscribedRows`,
  read from Publication 17, straddling the six bracket boundaries below
  $100,000; plus the hand-typed row count the list never had.

Every leaf was watched to fail. Beyond the four parameter mutations in §2.1:

| mutation | result |
|---|---|
| `agedOrBlindIncrementFor.marriedFilingSeparately` `'married'` → `'unmarried'` | 6 red, two of them the new ones |
| `standardDeduction.single` `$15,750` → `$15,000` (adopting the scenario's own stale figure) | 78 red, including `theTwoTestScenariosWithACompletedReturn` |
| `generateRow`'s midpoint → the band's lower bound | 65 red, four of them new |
| `taxTableColumnFor.qualifyingSurvivingSpouse` → `'single'` | 1 red — **and not the new one** |
| `toWholeDollarCents` → truncation | **0 red when first run, 1 red after §4 was added** |

### 5.1 Three things the mutations corrected, two of them in prose already written

**The qualifying-surviving-spouse row does not pin the column, and a draft of
its docstring said it did.** `ty25-us-010`'s $7,574 of taxable income is inside
the ten percent bracket for every filing status, so the single and
married-filing-jointly columns print the same $758 there. Pointing the mapping
at `single` leaves the new leaf green and reddens only `fjs/tax/table`'s own
$25,300 leaf, which was written for exactly this. The claim was written down
before it was run, and running it is what corrected it. The docstring now says
so.

**A recorded mutation result went stale within the same phase, and that is the
more useful half of the finding.** Replacing `toWholeDollarCents` with
`cents / 100n * 100n` left the whole suite green when it was first run — three
of the four commercial-filer rows carry no cents and the fourth carries
thirty-two, so none reaches a half dollar. The observation was written into the
module's docstring as *"no published row here can tell them apart"*. Adding §4's
test scenarios a few hours later made it false: scenario 12's $18,633.80
truncates to $18,633 against a published $18,634, and re-running the same
mutation now reddens exactly that leaf. Both the docstring and this table were
corrected by re-running, not by re-reading. The property of the commercial
filer's four rows is still true and is now an assertion of its own —
`everyPublishedRowRoundsDownwardSoTruncationWouldAlsoAgree` — so it is recorded
rather than assumed.

**The twelve new Tax Table rows add no mutation coverage the original ten did
not have.** Measured, not assumed: moving single's twelve-percent ceiling from
$48,475 to $48,375 reddens `rowByRowDiffMatchesPublishedTable` identically with
the twelve present and with only the original ten. The reason is a property of
the ten nobody had written down — **the last of them, at $99,950, sits above
every bracket boundary below $100,000**, so its cumulative tax moves in all four
columns whenever any ceiling moves. The twelve are kept for what they do buy:
twenty-two rows of the 2,062 the page prints instead of ten, a second document
behind them, and four figures that land on an exact half dollar at a rate
change. The comment at the site says all of this, including that they caught
nothing.

---

## 6. Numbers

Measured in the worktree after `npm ci`, with `npx tsc --noEmit --traceResolution
| grep -c "$PWD/node_modules"` reporting **8,041** resolutions into the
worktree's own dependencies — so this is not the falsely-green typecheck
AGENTS.md warns about.

| | before | after |
|---|---|---|
| `npx tsc --noEmit` | 0 errors | **0 errors** |
| `node --test all.test.js` | 3,344 / 3,344 | **3,353 / 3,353** |
| `npm test` | 3,393 / 3,393 | **3,402 / 3,402** |
| project-local proof leaves | 3,344 | **3,353** |
| `npm run cov` at 100/100/100 | exit 0 | **exit 0**, and every one of the 124 rows the report gives a percentage to — 123 files plus the `all files` total — reads 100.00 / 100.00 / 100.00 |
| `node --test planning-truth-gate.test.js` | 24 / 24 | **24 / 24** |

---

## 7. What this does NOT cover, and cannot

**Stated plainly, because the phase is only partly satisfiable without the owner
and a report that implied otherwise would be worse than no report.**

1. **No document was read end to end.** Every comparison in §2 and §3 starts
   from a figure the published source already computed — a taxable income, a box
   count. Nothing here exercises the path from a Form W-2 to line 1a, from a
   Form 1099-B through Schedule D to line 7, or from a Form 1095-A through Form
   8962 to line 24. That is the whole middle of the engine, and it is where
   Phase 33 found its one real defect. **This phase could not have found that
   defect.**
2. **Two lines out of nineteen.** Lines 1a, 9, 10, 11, 15, 19, 24, 25d, 26, 27,
   28, 29, 32, 33, 34, 35a and 37 were compared against nothing. The engine's
   own report arithmetic — its `round(sum)` convention, its refusal logic, its
   provenance — is untouched here.
3. **The refusals are untested.** Phase 33's most interesting result was that
   twenty of fifty-one returns produced a NAMED refusal rather than a plausible
   wrong number. Nothing in this phase runs `form1040Report` at all, so nothing
   here says whether the engine still refuses well.
4. **No qualified dividends, no capital gains, no preferential rates.** Six of
   the ten published returns were skipped for exactly this reason, so the
   Qualified Dividends and Capital Gain Tax Worksheet — the single most
   error-prone piece of line 16 — has no second implementation behind it.
5. **One vendor, twice.** Phase 33 and this phase both compare against Column
   Tax. A systematic error the two years share would be invisible to both.
6. **A free commercial filer would have given all of the above, on the owner's
   real facts.** FreeTaxUSA or an IRS Free File partner takes the actual
   documents, produces all nineteen lines, and produces them for a return whose
   facts nobody chose to be convenient. That is the comparison the roadmap
   asked for, and none of the substitutes above is it. The specific things it
   would add: the document-to-line path, every line, the refusal behaviour on
   real inputs, and a second vendor.

**`diff-return.mjs` in the harness directory is that comparison, already
written.** It takes a `Form1040Inputs` and the filer's Modernized e-File export
and prints all nineteen lines side by side, exiting non-zero on any
disagreement. It was smoke-tested both ways — with a deliberately wrong `TaxAmt`
it reported three disagreements and exited 1; with the right one, zero and 0.
The only missing input is the documents.

---

## 8. Reproducing this

```sh
cd .planning/reports/phase-34-cross-check-harness
FINANCE_ROOT=../../.. node sweep-p17.mjs        # 2,062 rows, 35 schedule rows, 40 worksheet probes
FINANCE_ROOT=../../.. node crosscheck-ty25.mjs  # the ten published tax year 2025 returns
```

Both exit non-zero on a disagreement and print their comparison counts first,
because a run that compared nothing also disagrees about nothing. See that
directory's [README](./phase-34-cross-check-harness/README.md) for what each
file is, how `p17-tax-table.json` is rebuilt from the printed page, and the
checksum of the Publication 17 revision it was built from.

The sources themselves:

- Publication 17 (2025) — `https://www.irs.gov/pub/irs-pdf/p17.pdf`
- The tax year 2025 Form 1040 Assurance Testing System scenarios —
  `https://www.irs.gov/e-file-providers/tax-year-2025-form-1040-series-and-extensions-modernized-e-file-mef-assurance-testing-system-ats-information`
- TaxCalcBench — `https://github.com/column-tax/tax-calc-bench`, directory
  `tax_calc_bench/ty25/test_data/`
