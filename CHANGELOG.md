# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

**Through `0.12.0` the minor position tracked the roadmap phase.** `0.10.0` was cut when Phase 10
completed. **`0.11.0` was never cut** — Phases 11 and 12 both landed before anyone tagged, so
`0.12.0` covers the pair. **From `1.0.0` the project follows plain SemVer.**

`1.0.0` was reserved for "the release in which Phase 14 (Acceptance) lands and a real server path
produces a Form 1040 end to end". **Phase 14 was skipped, and the condition was met anyway** —
Phase 21 joined the engine to the server through `guestCtx`, and `fjs-run-integration.test.js`
proves a stored guest program computing a real 1040 through a separate `fjs_run` process with a
pinned rerun reproducing it byte for byte. That is what `1.0.0` names.

## Unreleased

### Form 461 — Limitation on Business Losses (§461(l))

**A farm loss computes.** `fjs/form461` is the printed form, all sixteen lines, wired into
`fjs/schedule/1` Part I where printed line 8p belongs. Spec, written first, in
[`fjs/form461/todo/`](./fjs/form461/todo/limitation-on-business-losses.md).

- **The threshold is $313,000 ($626,000 on a joint return)**, read at **Rev. Proc. 2024-40
  §2.32** rather than taken from the form, and cross-checked against printed line 15 and i461's
  *Threshold amount*. **Only `marriedFilingJointly` takes the doubled figure.** Married filing
  separately takes the FULL $313,000 — §461(l) has no halving clause, unlike §1211(b)'s capital
  loss allowance twenty lines away in `fjs/schedule/d` — and a qualifying surviving spouse takes
  $313,000 too, because both the printed line and §461(l)(3)(A)(ii)(II) name the joint RETURN.
- **Wages are not on this form.** i461: excess losses are figured *"without regard to any
  deductions, gross income, or gains attributable to any trade or business of performing services
  of an employee"* — §461(l)(6) — which is why printed line 1 reads *"Reserved for future use"*
  where the 2018-2020 revisions put Form 1040 line 1 and then removed it again on line 11. The
  brief this work was written against said the opposite. Nothing in the module reads a Form W-2.
- **A loss fully allowed computes; a BINDING limitation refuses**, which is `fjs/form8829`'s
  asymmetry reached the same way. The disallowed amount is a §172 net operating loss carryover,
  and `netOperatingLossDeduction` is itself an `fjs/return/scope` refusal with no dialect behind
  it. `fjs/schedule/d`'s uncapped capital loss looks like a counter-precedent and is not: every
  other outbound carryforward this engine creates has a modeled INBOUND counterpart, and this one
  alone does not.
- **Printed Schedule F line 34 now computes a LOSS at printed box 36a.** i1040sf p10 disposes of
  §465 and §469 in one sentence on the taxpayer's own two answers; §461(l) is figured on Form 461
  over the aggregate, which is where i461's *Ordering Rules* put it. Box 36b still refuses, on
  §465 and Form 6198 alone. **`fjs/schedule/c`'s loss does not move**, and the reason is a
  dialect rather than a statute: `vnd.fjs.business_expenses` carries no field for printed line
  32's at-risk box and none for material participation, so neither §465 nor §469 can even be
  asked of a Schedule C business. `fjs/schedule/e/part_i`'s two loss refusals do not move either.
- **§199A(c)(2)'s outbound carryforward acquired a home**, which Schedule F's own docstring had
  said it did not have. Form 8995 printed line 16 always computed it and nothing read it; the
  zero floor sat on printed line 2 where the paper floors line 4, and the figure reached no report
  field. Both are fixed, so a farmer can transcribe it into next year's
  `priorYearQualifiedBusinessLossCarryforward` — the inbound field that has existed since Phase
  28. Above §199A(e)(2)'s threshold `fjs/form8995a` refuses instead, having no such printed line.
- **No kind was reclassified.** `excessBusinessLossAdjustment` stays refused: an excess business
  loss still cannot be produced, and what changed is the REASON, which its remedy now states.
  Three remedies were corrected for naming a form or a reason that had ceased to be true, and a
  hand-typed leaf looks each row up by kind and asserts both what it must say and what it must no
  longer say.
- **Two defects the work uncovered, each found by mutation rather than by reading.** Moving the
  §199A floor exposed a §199A(c)(1) wiring bug: a general partner with Schedule K-1 box 14 code A
  and no Schedule C had the whole of Schedule SE line 13 subtracted from a zero qualified-business
  -income base. And the guest program's SOURCE text was unproven for any field the function twin
  renders correctly — hardcoding `'0.00'` there left the whole suite green.

### Schedule F — Profit or Loss From Farming

**A farmer computes.** `farmIncomeOrLoss` was an `fjs/return/scope` refusal whose whole remedy
read *"requires Schedule F (no phase yet)"*. Printed Schedule F lines A through 34 now compute
for a cash-method farm, and printed line 34 reaches **all four** of its destinations: Schedule 1
line 6, Schedule SE line 1a, Form 8995 line 1(i), and — through Schedule SE line 3 — the earned
income credit's Worksheet B. Spec, written first, in
[`fjs/schedule/f/todo/`](./fjs/schedule/f/todo/schedule-f-profit-or-loss-from-farming.md).

- **`vnd.fjs.farm`**, one document per farming business. `vnd.fjs.business_expenses` is the right
  MODEL and the wrong CONTAINER, for a reason sharper than Schedule E Part I's: `fjs/schedule/c`
  consumes *every* record of that dialect, so a farm stored in it would be computed onto the wrong
  printed form and reach Schedule 1 line **3** instead of line **6**. `f1040sf` Part IV polices
  that boundary on its own printed face.
- **Form 1099-G box 7 and box 9 became readable**, and they had refused at the document since the
  dialect shipped. `i1040sf` p3 routes a Form 1099-G or CCC-1099-G to printed line 4a; p4 puts the
  Commodity Credit Corporation market gain in the same line's list, and takes it out again on line
  4b under the §77 election. **The refusal MOVED rather than being deleted**: a 1099-G carrying
  either box with no farm stored still refuses, at `fjs/schedule/f`, because dropping it would
  understate income in silence.
- **A profit and a break-even zero compute; a LOSS refuses at printed line 34** — Schedule C line
  31's and Schedule E Part I line 21's decision, from a page that says the same thing. The
  refusal names **§461(l)**, and the brief this work was written against named §461(j): the excess
  FARM loss is the provision a farm-shaped reading reaches for, and §461(l)(1) disapplies it for a
  noncorporate taxpayer in any year §461(l) applies, which 2025 is. Printed box 36b adds §465 and
  Form 6198; box 36a does not, because `i1040sf` p10 says so out loud.
- **Printed line E answering "No" refuses, on a PROFIT as well as a loss**, and the ground is
  §1411 rather than §469: a passive farm's income is net investment income under
  §1411(c)(1)(A)(ii), and `fjs/form8960` computes line 4a from Schedule E line 26 alone. Admitting
  it would let the income escape the 3.8% tax entirely.
- **Part III (the accrual method) refuses at printed line 45**, naming the beginning-of-year
  inventory — a prior-year figure — and, independently, the unit-livestock-price and farm-price
  valuation methods that the printed footnote to line 49 makes the SIGN of lines 47 through 50
  turn on.
- **`vnd.fjs.asset_register` serves farm property with no change**, and the §168(b)(2)(B)
  150%-declining-balance premise this work started from is stale: TCJA §13203 struck it, and
  `i4562` p11 says the method *"is no longer required"* for 3-, 5-, 7- and 10-year farm property.
  The surviving half — 15- and 20-year — is already enforced. Two farm-specific gaps are reported
  rather than built: **ADS is not representable at all** (the §163(j)(7)(C) electing-farming-business
  and §263A(d)(3) election-out cases both mandate it, and both would make line 14 too large), and
  §179 refuses, which is the commonest farm depreciation election there is.

Registries: 31 → 32 classifiable, 29 → 30 served, 28 → 29 dispatched. Refusal partition:
**55 modeled, 142 refused** (197 unchanged — one kind crossed), **11 tripwires**. The refused
figure composes with Form 6781's, which added two §1256 rows to the same table on a branch cut
from the same commit: `141 + 2 - 1`, and the vocabulary keeps Form 6781's 197 rather than
returning to the 195 this line read while the two were apart.
`netFarmRentalIncomeForm4835` and `farmIncomeAveragingScheduleJ` stay refused; the first has its
remedy corrected, because the clause saying Schedule F was unmodeled too stopped being true.

**One gate found a real defect before the mutation campaign started.** `fjs/schedule/c`'s
orphan-asset-register refusal — *"NOTHING on this return claims it"* — fired on a farmer's
register and refused the whole return, because its message enumerated two printed lines and there
were now three.


## 1.0.0 — 2026-08-17

**The two halves are joined, and all four reference taxpayers compute.** Milestone v2 — "The
Product Path and Four Personas" — shipped as PRs #71–#82 plus the gap-closure work that followed,
closing all 120 requirements.

- **The product path.** A stored program, authored by the agent and executed by the server in a
  sandbox, produces a complete Form 1040 with every figure citing the document box it came from,
  and a pinned rerun reproduces it byte for byte. Reached through `guestCtx` rather than a
  `finance_compute_1040` tool, which the architecture permanently forbids: **13 tools, unchanged
  through twelve phases.**
- **All four personas.** The retiree and non-profit worker compute correctly (the latter had been
  overstating the tax); the FAANG engineer and startup founder no longer refuse. Forms 8959, 8960,
  6251 including Part III, 8606 including Part II, 8880, 8889, 8995 and 8995-A, 3921, 3922, and
  Schedules C, SE, E and EIC.
- **Two silent wrong answers closed.** $49,467.75 of equity income was being taxed twice, because
  brokers correctly report $0 basis on stock already taxed through payroll. And a $300,000 W-2
  understated tax by ~$900 with no refusal, until eight computable tripwires began refusing when
  the documents prove an obligation was never declared.
- **The suite runs once.** The entire proof set had been executing twice under bare `node --test`
  for months, recorded the whole time as a double-counted *metric*. It was double-*run*.

**Everything below this line was released as part of `1.0.0`** — it sat under `## Unreleased`
inside the `v1.0.0` tag itself, which is the defect this section fixes.

### TAX-33 closed: Form 6251 Part III, the AMT's capital-gains worksheet

Phase 29 shipped Form 6251 Parts I and II and **refused** every return with
capital gains or qualified dividends, because Part III — the twenty-nine-line
worksheet reconciling the AMT's 26/28% schedule with §1(h)'s preferential rates
— was unbuilt. That refusal hit the FAANG persona's most likely combination: a
large incentive stock option spread beside qualified dividends. It now computes.

- **`fjs/form6251/part3`** — lines 12-40, transcribed from `f6251.pdf` page 2,
  one named `const` per printed line. All four preferential bands: 0% (line 23),
  15% (line 31), 20% (line 34) and the 25% unrecaptured-§1250 band (lines 35-37).
  Both printed skips kept as skips; both printed floors floored; the four lines
  with no printed floor asserted instead, per `fjs/tax/line16/qdcgt`'s stated
  rule. Every dollar figure is a `fjs/tax/params` lookup — lines 19 and 25 read
  the same `capitalGainsBreakpoints` rows the QDCGT's lines 6 and 13 read,
  because §55(b)(3) applies §1(h) unchanged inside the AMT.
- **`fjs/form6251/rate`** — §55(b)(1)(A)'s two-bracket schedule, which this form
  prints THREE times (lines 7, 18 and 39), written once. The breakpoint's halving
  for married filing separately is a stored parameter row, never arithmetic.
- **The regular tax's own worksheet is threaded, never re-executed.** `Line16Ok`
  now carries the QDCGT or Schedule D Tax Worksheet that produced 1040 line 16,
  because Part III's lines 13/15/20/27 read four of its lines and lines 20 and 27
  say *"as figured for the regular tax"* on the printed page.
- **The FAANG return, end to end through `form1040Report`**: a single filer with
  $250,000.00 of salary, $20,000.00 of qualified dividends and a $1,000,000.00
  ISO spread pays **$55,023.00** of regular tax and **$293,195.00** of AMT,
  **$348,218.00** in all. Part III is worth $2,600.00 of it — the qualified
  dividends taking 15% rather than the AMT's flat 28%.
- **Phase 29's upper bound is unchanged and still runs first.** A return whose
  flat 26/28% figure already loses to the regular tax still gets an exact
  `$0.00` without Part III running at all, and `line7IsAnUpperBound` still says
  which path produced the answer. `fjs/form6251/part3` proves the stronger
  statement the mechanism rests on: **line 38 never exceeds line 39 at any
  input**, because every preferential rate the page charges is strictly below the
  AMT's own 26% — so the printed `min` on line 40 is a clause that never binds.
- **What still refuses, by name**: Part III required while the regular tax
  completed *neither* preferential worksheet, reachable only when 1040 line 15 is
  zero or less. Every Form 2555 clause on the page is structurally unreachable.
  There is no 28% collectibles band on this page and its absence is the printed
  form's own decision, not an omission — documented with a proof leaf.
- Three proof leaves that asserted the removed refusal are **rewritten as
  computing leaves** with hand-derived figures, not weakened to bare `throw:`
  shapes. Two mutations found coverage gaps in the new wiring and both are now
  pinned at the module that produces the value rather than two modules away.

### Phase 26: Retiree Completion — the retiree stops being overcharged

Two new dialects, one new form module, and one figure worth stating up front: on a
hand-derived retiree with a $50,000 IRA distribution, $20,000 of it given straight to
charity and $20,000 of prior-year nondeductible basis, **this engine charged $2,915.00
where the law charges $291.00** — silently, with full citations and no warning.

Project-local proofs: **1,347 → 1,434**.

#### What is here

- **Qualified Charitable Distributions (TAX-28).** A QCD is a taxpayer ELECTION, not a
  1099-R box: the custodian reports the full distribution and there is no distribution
  code for it. The new `vnd.fjs.ira` dialect carries the election, and 1040 line 4b falls
  while **line 4a stays gross**, exactly as the printed instruction requires. Capped at
  §408(d)(8)(A)'s **$108,000 per individual** for TY2025 — a figure `fjs/tax/params` now
  stores with its indexing history, because it was $100,000 through 2023 and $105,000 for
  2024.
- **Form 8606 Part I (TAX-29, in part).** §408(d)(2)'s pro-rata rule over the
  **aggregated** year-end value of every traditional, SEP and SIMPLE IRA one person owns —
  never per account, which is the mistake that understates tax for anyone with two IRAs.
  Basis carries forward from the prior year's line 14 through a second new dialect,
  `vnd.fjs.prior_year_ira_basis`, which becomes the **second exemption** from Phase 21's
  mixed-year refusal.
- **The ordering between them, pinned with arithmetic.** §408(d)(8)(D) makes a QCD come
  first out of the pre-tax portion, which the printed Form 8606 implements in exactly one
  place: line 7 excludes QCDs. Two consequences are proven rather than described — a QCD
  does not absorb basis (next year's line 2 is *larger* with the gift than without it),
  and it makes the remaining distributions *more* nontaxable, not less.
- **A second-order effect that was looked for on purpose.** Line 4b is the Social Security
  Benefits Worksheet's own line 3, so a $20,000 gift takes **$17,000 off taxable Social
  Security on top of the $20,000** it takes off the distribution. Phase 24 shipped a
  newly-real read in that worksheet that no fixture exercised; this phase went looking for
  the same shape and found it.

#### What refuses, by name

Every one of these is a sentence a taxpayer can act on rather than a number quietly
missing: the **70½ eligibility test** when unasserted (see below) or when contradicted by
the profile's own age boxes; §408(d)(8)(F)'s **one-time split-interest election**; a QCD
from a 401(k) rather than an IRA, from no stored 1099-R, from two of them, or larger than
the distribution it claims; an **unasserted aggregated year-end IRA value**; a stored
basis with no IRA record beside it; **Form 8606 Part II** (Roth conversions) and **Part
III** (Roth distributions, detected off box 7a codes J/T/Q rather than off an assertion).

#### The 70½ finding

§408(d)(8)(B)(ii) requires age 70½ **at the time of the distribution**, and **this engine
cannot determine that**. Two independent reasons, either fatal on its own: no birth date
is stored anywhere in this repository — the nearest fact is 1040 line 12d's
*born-before-2-January-1961* checkbox, a **65** test — and the statute tests age at a
DATE, which only Form 1099-R box 13 carries and only as free text. The fact is therefore
asserted by the taxpayer and refused when absent, never approximated from the 65 box. The
one derivable direction (that box is NECESSARY) is checked, so an unchecked box
contradicts the assertion.

#### What is NOT here

**A backdoor Roth is still not computable**, so TAX-29's checkbox stays empty. A backdoor
Roth is a nondeductible contribution plus a *conversion*, the conversion is Form 8606 Part
II, and Part II refuses. The requirement's first sentence ships and its second does not.

## 0.12.0

Phases 11 and 12: the documents a real return actually arrives as. Four new
dialects, a tool to list what has been filed, Schedule B, and a retraction hole
closed in the code that hands a guest program its view of the store.

Project-local proofs: **492 → 629**.

### What is here

- **Four new document dialects**, each with its own structural schema and
  semantic validator: `vnd.fjs.1099r` (retirement distributions),
  `vnd.fjs.ssa1099` (Social Security benefits), `vnd.fjs.1099div` (dividends)
  and `vnd.fjs.1099b` (broker proceeds). **Nine dialects are now registered**,
  a count `finance_schema` asserts against a hand-typed constant so that
  registering a dialect without registering its schema fails the build.
- **`finance_documents_list`**, a twelfth MCP tool: what has been filed, by
  dialect, read through Evo rather than by walking the store.
- **Schedule B** (`fjs/schedule/b`) — the interest and ordinary-dividend
  thresholds as two independent tests, each at $1,500, proved against a return
  that is over the combined figure while under both individual ones and so
  triggers neither.
- **Foreign-account fields on `vnd.fjs.return_profile`.** Additive, and the one
  deliberate exception to Phase 12's "do not touch `fjs/return/`" boundary: no
  IRS information return reports whether a taxpayer holds a foreign account, so
  it can only be declared.
- **Absence stays absent** (DOC-11/DOC-12). Every money box is optional; a blank
  box is not a zero, and a `"0"` standing in for "not printed" is a defect. A
  correction is `corrected: option(true)` — `false` is structurally invalid,
  because absence is the only way to say "not corrected".

### Fixed

- **A retracted document was still reachable** (DOC-15). `buildRunSnapshot`
  resolved archived subjects' heads and every blob from `cas.list()`, so a guest
  could walk `evo_list('true') → evo_head → evo_revision → cas_read` into a
  document that had been withdrawn. Archived revisions are now tracked by hash
  and excluded. The first fix conflated *archived* with *failed to decode* and
  would have silently hidden an **active** document; the two cases are now
  distinct, and a head that fails to decode still reports loudly.
  **The honest boundary, unchanged:** `blobs` stays unfiltered, so this does not
  — and cannot — make retracted bytes unreadable to a party already holding
  their exact hash.

### What is NOT here

- **No production caller for `form1040Report`.** No server path produces a 1040
  today; Phase 14 owns that, and it is why this is `0.12.0` and not `1.0.0`.
- **Dividends are read but not used.** The 1099-DIV dialect can parse the form,
  and the engine still **refuses** a return that declares dividend income —
  `qualifiedDividends` and `ordinaryDividends` remain unmodeled in
  `fjs/return/scope`. Reclassifying them without simultaneously wiring Form 1040
  lines 3a/3b would make the engine report a confident zero where it currently
  refuses honestly, which is strictly worse. Phase 12.1 does both as one change.
- **The Schedule D Tax Worksheet branch still refuses**, naming unrecaptured
  §1250 gain and 28%-rate gain as unmodeled. It is *selected* correctly; that
  selection is proven.
- **The sandbox claim is unchanged and still narrower than "it cannot reach the
  network."** A guest requesting `fetch` through the effect system is refused by
  name, and a disallowed import specifier is refused before the module body
  executes. A guest body calling `globalThis.fetch(...)` directly runs with host
  privileges — a recorded accepted risk, stated in `fjs/guest/materialize`'s own
  header.

## 0.10.0

The first tagged release. Phases 1-10 of an 18-phase roadmap: a working MCP
server, a content-addressed document store, exact money, and Form 1040 lines
1a-37 with a four-way line-16 dispatch and a scope guard that refuses what it
does not model.

### What is here

- **MCP server** over stdio with six tools — `finance_schema`,
  `finance_tax_params`, `fjs_run`, `cas_refresh`, `evo_list`, `evo_head`.
- **Five document dialects**, each with its own structural schema and semantic
  validator: `vnd.fjs.w2`, `vnd.fjs.1099int`, `vnd.fjs.medical_expenses`,
  `vnd.fjs.ocr`, `vnd.fjs.return_profile`.
- **Money is never floating point.** A decimal `string` on the wire and in
  storage, integer cents as `bigint` in computation, rounded once at the end
  and only if the taxpayer elected whole dollars (i1040gi p23).
- **Traceability enforced by the type system.** A report line carries a
  non-empty tuple of `(documentHash, boxPath, value)` sources and the printed
  rule it implements; a line without its sources does not compile, asserted as
  a conditional type inside the passing build.
- **Form 1040 lines 1a-37** (`fjs/form1040/core`), 56 printed money lines.
- **Line 16's four-way dispatch** (`fjs/tax/line16`) in the printed order, each
  outcome tagged with the method that produced it — Tax Table, Tax Computation
  Worksheet, the Qualified Dividends and Capital Gain Tax Worksheet, and the
  Schedule D Tax Worksheet, which is selected correctly and then refuses.
- **The scope guard** (`fjs/return/scope`): 6 modeled kinds, 44 refused by
  name, each naming the 1040 line and the form that would supply it. An
  unmodeled declared input refuses the WHOLE return — the error outcome carries
  no line list at all, so a partial 1040 is not representable.
- **TY2025 parameters as data** (`fjs/tax/params`), every figure citing its
  Revenue Procedure and section.
- **A restricted interpreter** (`fjs/exec`): a frozen four-command vocabulary,
  refusals naming the command and the permitted set, and a bounded step budget.
- **492 project-local proofs**, in the modules they test.
- **A browser showcase** (`demo/`) that imports the shipped engine as ES
  modules with zero dependencies and no build step. Run `./demo/serve.sh`.

### What is NOT here

Stated as plainly as the above, because the gap is the point:

- **`form1040Report` has no production caller.** No server path produces a 1040
  today. Phase 14 owns that, and it is why this is `0.10.0` and not `1.0.0`.
- **The Schedule D Tax Worksheet is selected, then refuses**, naming
  unrecaptured section 1250 gain and 28%-rate gain as unmodeled. Phase 12.
- **Wage, retirement and benefit documents beyond the W-2** — SSA-1099,
  1099-R, 1099-DIV, 1099-B — are not modeled. They appear only in the refusal
  table, as remedies. Phases 11-13.
- **Guest bodies run with host privileges.** A stored program requesting
  network access *through the effect system* is refused by name, and a
  disallowed import specifier is refused *before the module body executes*. A
  guest calling `globalThis.fetch(...)` directly is not defended against. This
  is a recorded, accepted risk, stated in `fjs/guest/materialize`'s own header.
- 8 of 18 roadmap phases remain, including the three backlog phases.

### Known documentation defects

Found and recorded:

- `REQUIREMENTS.md` TAX-10 calls the Social Security Benefits Worksheet 19
  lines; it is 18. **Still open** — deliberately left for Phase 13, which builds
  that worksheet and will read it line by line against the printed form. Fixing
  the count now, from the same recall that produced it, would swap one
  unverified number for another.
- ~~`ROADMAP.md` constraint 4 names 1099-DIV boxes 2b/2d as forcing Schedule D;
  i1040gi p31 Exception 1 names 2b, 2c **and** 2d.~~ **Fixed 2026-08-07** while
  scoping Phase 12, along with the same constraint's now-historical claim that
  "Phase 12 holds DOC-06, TAX-08, and TAX-11 in one phase" — TAX-08 shipped in
  Phase 10 and the remainder was split into Phases 12 and 12.1.

### Unverified against paper

Three figures nobody has checked against the printed forms: the 2025 Form 1040
face's 56-line inventory, the 19 standard-deduction chart amounts against
`f1040s.pdf` p4, and whether the Tax Computation Worksheet is cent-exact rather
than whole-dollar (exactly one value moves if it is not — the QDCGT worked
case's line 24, `$184,094.50` vs `$184,095.00`).

### Dependencies

`functionalscript` 0.43.1. It is the only runtime dependency, and it is our own
project rather than a third party.
