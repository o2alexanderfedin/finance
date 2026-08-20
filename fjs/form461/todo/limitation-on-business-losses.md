# Form 461 — Limitation on Business Losses (§461(l))

Written before `fjs/form461/module.f.js`. Every citation is to the printed 2025
`f461.pdf` face (Cat. No. 16654I, "Created 2/26/25") or to the 2025 `i461.pdf`
instructions (Cat. No. 71453Z, "Dec 10, 2025"), both fetched 2026-08-19, or to
Rev. Proc. 2024-40 as published (`rp-24-40.pdf`), read at §2.32.

`excessBusinessLossAdjustment` is an `fjs/return/scope` refusal today, reading
`{ line: 'Schedule 1 line 8p -> 1040 line 8', label: 'the section 461(l) excess
business loss adjustment', remedy: 'requires Form 461 line 16, which limits an
aggregate trade-or-business loss across every business the taxpayer has — this
engine models one Schedule C and does not aggregate (no phase yet)' }`. That
remedy is **stale in two ways**: this engine has modeled Schedule F since the
farm phase, so "one Schedule C" is wrong, and the reason a taxpayer would
declare the kind is not that Form 461 is unmodeled but that the disallowed
amount becomes a §172 net operating loss carryover. This phase supplies the
form and corrects the remedy.

---

## 0. The five questions this phase had to answer, and where the paper answered them

| # | Question | Answer | Citation |
|---|---|---|---|
| 1 | Where does §461(l) sit, and can this engine reach it? | **After §465 and after §469.** Reachable today from **Schedule F alone**, and only at printed box 36a. NOT from Schedule C, which cannot reach it at all. | i461 *Ordering Rules*; i1040sf p10 *Line 36*; §3 below |
| 2 | What are the inputs, and are wages among them? | Schedule 1 lines 3, 4, 5 and 6 and 1040 line 7a — and **wages are NOT trade-or-business income here.** Printed line 1 is *"Reserved for future use"*. | f461 lines 1-8; i461 *Definitions*, *Excess business loss*; §461(l)(6) |
| 3 | Where does the disallowed amount go? | Schedule 1 line 8p this year, and an **NOL carryover** to next year on Form 172. The carryover OUT is why a BINDING limitation refuses. | f461 line 16; i461 *Purpose of Form*, *Line 16* |
| 4 | Which schedule's loss becomes computable? | **Schedule F's, at box 36a with line E "Yes", and no other.** Schedule C's and Schedule E Part I's blockers are untouched. | §4 below |
| 5 | Does Form 461 change §199A(c)(2)? | **No — they are independent.** But §199A(c)(2) turns out to be removable on its own terms, and this phase removes it. | §6 below |
| 6 | Does any KIND reclassify? | **No.** `excessBusinessLossAdjustment` stays refused, because an excess business loss still cannot be produced. | §7 below |

---

## 1. The threshold, verified at the source rather than taken from the form

Printed line 15: *"Enter $313,000 (or $626,000 if married filing jointly)."*

i461, *Definitions*, **Threshold amount**:

> For 2025, the threshold amount is $313,000 ($626,000 for taxpayers filing a joint
> return). See Rev. Proc. 2024-40, Sec. 2.32.

Rev. Proc. 2024-40 §2.32, read directly:

> **.32 Threshold for Excess Business Loss.** For taxable years beginning in 2025, in
> determining a taxpayer's excess business loss, the amount under § 461(l)(3)(A)(ii)(II)
> is $313,000 ($626,000 for joint returns).

**Two traps live in the per-status table, and both point the same way — the
non-joint statuses all get the FULL amount.**

- **Married filing separately gets $313,000, not $156,500.** §461(l) has no
  halving provision. §1211(b)'s capital loss allowance does have one, and
  `fjs/schedule/d`'s `lossCapCents` reads `status === 'marriedFilingSeparately'
  ? 150000n : 300000n` — the shape a reader might copy. Copying it here would
  halve the threshold and so **overstate** the disallowance.
- **A qualifying surviving spouse gets $313,000, not $626,000.** Most per-status
  parameters in `fjs/tax/params` give QSS the joint figure (10-CONTEXT.md
  Decision 6: the two statuses read the same Rev. Proc. rows). This one does not,
  and the printed line is why: it says *"if married filing jointly"*, not *"on a
  joint return or as a qualifying surviving spouse"*. §461(l)(3)(A)(ii)(II)
  doubles the amount *"in the case of a joint return"* and a QSS return is not a
  joint return. `additionalMedicareTaxThreshold` is the existing precedent for a
  parameter where QSS does NOT take the joint figure, and it carries the same
  warning in its own comment.

So the stored table is `$313,000` for four statuses and `$626,000` for
`marriedFilingJointly` alone, with the Rev. Proc. citation on each entry.

**The $156,500 in i461 is a FILING test, not a limitation.** *Who Must File*:
*"either (i) your net losses from all of your trades or businesses are more than
$313,000 ($626,000 for taxpayers filing a joint return), or (ii) you would report
a loss of more than $156,500 on any one of Form 461, lines 1 through 8."* Test
(ii) is half the single threshold and is **not** doubled for a joint return —
the instructions state one figure for every status. It decides `filed`, and
nothing else; the arithmetic of Part III never reads it.

---

## 2. What the printed form actually aggregates, and what this engine holds

Printed Part I, with i461's line-by-line instructions:

| Printed | Instruction | This engine |
|---|---|---|
| 1 | *"Leave line 1 blank."* — the face says *"Reserved for future use"* | structural zero |
| 2 | Schedule 1 line 3 | `fjs/schedule/c` line 31, restated |
| 3 | 1040 line 7a | `fjs/schedule/d` line 21 / line 16, restated |
| 4 | Schedule 1 line 4 | documented zero — Form 4797 is unmodeled and `otherGainsOrLosses` is a scope refusal |
| 5 | Schedule 1 line 5 | `fjs/schedule/e` line 41, restated |
| 6 | Schedule 1 line 6 | `fjs/schedule/f` line 34, restated |
| 7 | *"Leave line 7 blank."* | structural zero |
| 8 | other trade-or-business income not on 1-7 | structural zero — every Schedule 1 line 8 sub-line is a scope refusal, so nothing can reach it |
| 9 | *"Combine lines 1 through 8."* | arithmetic |

**Wages are not on this form at all, and that is the single most load-bearing
fact in it.** i461, *Definitions*:

> Such excess losses should be determined without regard to any deductions, gross
> income, or gains attributable to any trade or business of performing services of
> an employee.

That sentence is §461(l)(6). It is why printed line 1 is *"Reserved for future
use"*: earlier revisions of this form (2018-2020) put Form 1040 line 1 — wages —
on line 1 and then backed the whole of it out again on line 11, and the current
revision simply omits the round trip. A reading in which wages are
trade-or-business income for §461(l) would make line 14 larger by the whole of
box 1 and so make the limitation essentially never bind for a wage earner with a
side business, which is exactly the taxpayer §461(l) was written for. **Nothing
in this module reads a W-2.**

Printed Part II is the trade-or-business character adjustment:

| Printed | Instruction |
|---|---|
| 10 | income or gain on lines 1-8 that is **not** attributable to a trade or business |
| 11 | losses or deductions on lines 1-8 that are **not** attributable to a trade or business — *"enter them as a positive figure on this line"* |
| 12 | *"Subtract line 11 from line 10."* |

and Part III applies the threshold:

| Printed | Instruction |
|---|---|
| 13 | sign flip of line 12 |
| 14 | *"Add lines 9 and 13."* — the trade-or-business net |
| 15 | the threshold, entered as a POSITIVE amount |
| 16 | *"Add lines 14 and 15. If less than zero, enter the amount from line 16 as a positive number on Schedule 1 (Form 1040), line 8p."* |

So line 16 is `line14 + threshold`, and an excess business loss exists exactly
when that sum is **strictly** negative. At `line14 = -threshold` exactly, line 16
is zero and there is no excess business loss — the boundary is `< 0`, not `<= 0`,
and a fixture sits exactly on it.

### 2.1 The two Part II classifications this engine makes, and why each is safe

**Capital gains and losses are removed in full.** i461 is explicit in both
directions: *"Losses from sales or exchanges of capital assets are not included in
the calculation of the total deductions from your trades or businesses. So any
such amounts included here in line 3 should be added back on line 11"*, and
*"any capital gains not attributable to your trade or business that are included
here in line 3 should be added back on line 10."* Every capital transaction this
engine can hold arrives on a `vnd.fjs.1099b`, a `vnd.fjs.1099div` box 2a, or a
Schedule K-1 slice; the §1231 slice that could be a trade-or-business gain is
refused whole by `fjs/schedule/e`'s own K-1 guard, and Form 4797 is unmodeled. So
line 7a is investment capital in its entirety, and lines 10 and 11 remove it in
its entirety: a positive line 7a goes to line 10, a negative one goes to line 11
as its magnitude.

**Schedule 1 line 5 is removed in full, and the reason is an admission rather
than a determination.** i461's *Trade or business* note says the determination for
a partnership or S corporation interest *"is made at that entity's level"*, and
nothing on a Schedule K-1 this engine reads records it. A rental that rises to a
trade or business and one that does not print on the same Schedule E line. So this
module does not attempt the classification: it treats the whole of Schedule 1
line 5 as **not** attributable to a trade or business.

That is one-directional, and the direction is what makes it safe. Schedule 1
line 5 can only be non-negative at this point — `fjs/schedule/e/part_i` refuses
every rental and royalty loss and `fjs/schedule/e` refuses every Part II and
Part III loss — so removing it can only make line 14 **smaller**, hence line 16
smaller, hence the limitation **more** likely to bind. A return whose line 16 is
non-negative under this reading is non-negative under every reading, so a return
that **computes** here computes under either classification and the admission
changes no answer this module gives. A return whose line 16 is negative refuses
(§5), so the admission never reaches a filer as a number either.

---

## 3. The ordering, and which loss sources can reach this form

i461, *Ordering Rules*:

> First, apply the at-risk rules; next, apply the passive activity loss rules; and
> then apply the excess business loss rules.

That is the order the engine already implements by refusing: §465 and §469 are
asked on each schedule's own printed page, and §461(l) is asked once, here, over
the aggregate. Mechanically Form 461 sits **inside** `fjs/schedule/1` Part I,
after lines 1-7 are formed and before line 8 is, because printed line 8p is a
Schedule 1 line and printed line 3 of Form 461 is 1040 line 7a — which
`fjs/form1040/core` computes before it calls Part I. There is no circularity:
unlike Form 8582's modified adjusted gross income, nothing on Form 461 depends on
adjusted gross income.

**Which losses can reach it, one schedule at a time.**

- **Schedule C: not at all.** `atRiskDeterminationLine32` refuses every net loss
  on line 31, and its ground is §465 — printed line 32's at-risk box. That box is
  not merely uncomputable; `vnd.fjs.business_expenses` carries **no field for it**
  and no field for material participation either, so neither §465 nor §469 can
  even be asked of a Schedule C business. Form 461 removes neither. A framing in
  which this phase makes "Schedule C and Schedule F" reachable is wrong about
  Schedule C by two whole statutes.
- **Schedule E Part I: not at all.** A rental loss refuses on §469 and Form 8582,
  whose §469(i) exception needs a modified adjusted gross income figured without
  the very loss being limited. A royalty loss refuses on §465 and Form 6198. §461(l)
  is third in the ordering and neither of the first two is answerable.
- **Schedule E Part II: not at all.** §704(d)/§1366(d) basis.
- **Schedule F: yes, at printed box 36a with printed line E answered "Yes", and
  only there.** i1040sf p10, *Line 36*: *"If all your investment amounts are at risk
  in this activity, check box 36a. If you also checked the 'Yes' box on line E, your
  remaining loss is your loss. The at-risk rules and the passive activity loss rules
  don't apply."* Both of the first two ordering steps are disposed of by the printed
  page, in one sentence, on the taxpayer's own two answers — which `vnd.fjs.farm`
  stores as `investmentAtRisk` and `materiallyParticipated`. Box 36b keeps its
  §465/Form 6198 refusal; line E "No" is already refused earlier on §1411.

**So Form 461 is reachable with a loss from exactly one place, and this phase
opens it.** Building the form without opening it would leave printed Part III
unreachable at every input — a limitation that can never bind is decoration, and
this repository has a rule about that.

---

## 4. What this phase does to each of the three refusing schedules

| Schedule | Blocker removed? | What happens |
|---|---|---|
| `fjs/schedule/c` line 31 | **Not at all** | The refusal stands. Its text is corrected: it named §461(l) and Form 461 as one of two limitations "behind" §465, which now exists — so the message must say Form 461 is modeled and is not what stops this loss. |
| `fjs/schedule/e/part_i` line 21 | **Not at all** | Both refusals stand unchanged. Neither ever named Form 461; the rental one names Form 8582 and the royalty one Form 6198, and both are still true. |
| `fjs/schedule/f` line 34 | **Partly — and the remainder is removed by §6** | At box 36a the loss COMPUTES. At box 36b the refusal stands, on §465 alone. |

`fjs/schedule/e`'s `beneficiaryLossRefusal` and Part II's loss refusal are not
touched either.

---

## 5. A BINDING limitation refuses; a loss fully allowed computes

This is `fjs/form8829`'s asymmetry, reached the same way and for the same reason.

i461, *Purpose of Form*:

> Taxpayers can't deduct an excess business loss (see Definitions, later) in the
> current year. However, the excess business loss is treated as a net operating loss
> (NOL) carryover for subsequent years. See Form 172 […]

and *Line 16*:

> You'll need to keep a record of your excess business loss from each tax year
> because it's treated as an NOL carryover for subsequent taxable years.

So a binding §461(l) creates a carryforward OUT, and this engine holds one tax
year. `fjs/form8829` refuses a non-zero line 43 or 44 on exactly that ground:
*"this engine holds ONE tax year and has no way to hand a figure to the next one,
so a return that computed this would deduct the allowed part and silently destroy
the deferred part."*

**`fjs/schedule/d` looks like a counter-precedent and is not.** A $10,000 net
capital loss ships: line 21 caps it at $3,000 and $7,000 carries out, with no
refusal anywhere. The difference is the INBOUND side. Schedule D's carryover comes
back next year through `vnd.fjs.prior_year_capital_loss` and
`fjs/tax/carryover`'s worksheet; Form 8829's comes back through printed lines 25
and 31; Form 8995's comes back through
`priorYearQualifiedBusinessLossCarryforward`. **§461(l)'s does not come back at
all**: it returns as a §172 net operating loss deduction on Schedule 1 line 8a,
and `netOperatingLossDeduction` is an `fjs/return/scope` refusal with no dialect
behind it. An outbound carryforward whose inbound counterpart this engine models
may ship; one whose counterpart it refuses may not, because the figure would be
created here and could never be used anywhere.

So:

- **line 16 ≥ 0 — no excess business loss.** The whole loss is allowed. Printed
  line 8p is a documented zero and nothing is deferred. **COMPUTES.**
- **line 16 < 0 — an excess business loss.** **REFUSES**, quoting line 14, the
  threshold, the excess, Schedule 1 line 8p and Form 172.

The boundary is exact and a fixture sits on it: at `line 14 = -threshold` line 16
is zero and the return computes; one cent more of loss and it refuses.

---

## 6. §199A(c)(2) is independent of Form 461, and is removable on its own terms

`fjs/schedule/f`'s docstring names it as a third blocker holding even at box 36a:

> §199A(c)(2) makes a negative qualified business income amount *"a loss from a
> qualified trade or business in the succeeding taxable year"* […] the outbound
> direction has no home at all.

Form 461 does not touch it — §461(l) and §199A(c)(2) read the same loss for
different purposes and neither feeds the other. i461's own definition of an excess
business loss is computed *"without regard to any deduction allowed under section
172 or 199A"*, which says so from the other side.

But *"no home at all"* is not right, and the correction is small. **Form 8995
printed line 16 IS the home**: *"Total qualified business (loss) carryforward. Add
lines 2 and 3. If greater than zero, enter -0-."* `fjs/form8995` already computes
it and its comment already says what it is — *"What THIS year hands the next one,
which this engine records rather than uses."* And the inbound counterpart already
exists on both business dialects as
`priorYearQualifiedBusinessLossCarryforward`, whose absence
`priorYearCarryforwardIsUnstated` already refuses. So by §5's own test — an
outbound carryforward may ship where the inbound counterpart is modeled — this one
may ship.

Two things were actually missing, and this phase supplies both:

1. **The floor sits on printed line 2, where the printed form floors line 4.**
   `qualifiedBusinessIncome` returns `max(0, …)`, and its own comment says the
   floor is *"the printed line 4's rule rather than a live case"* because
   `fjs/schedule/c` refuses a loss before it is reached. The moment a Schedule F
   loss reaches it, that floor would swallow the carryforward and print line 16 as
   zero — destroying exactly the figure §199A(c)(2) creates. Printed line 2 is
   *"Total qualified business income or (loss)"* and can be negative; printed
   line 4 is *"Combine lines 2 and 3. If zero or less, enter -0-."* The floor moves
   to line 4, which is where the paper puts it.
2. **Line 16 reaches no report field.** `qualifiedBusinessIncomeDeduction` returns
   `simplified: Form8995 | undefined`, so the figure exists and nothing reads it.
   The report gains a field for it, so the carryforward is a printed number the
   filer transcribes into next year's assertion.

Above §199A(e)(2)'s threshold the return uses Form 8995-A, whose own carryforward
line this engine does not model. A qualified business LOSS above the threshold
therefore **refuses** by name, which is a narrower refusal than the one it
replaces.

---

## 7. Kinds — and NO kind is reclassified

This section said, while it was being written, that
`excessBusinessLossAdjustment` would move from `unmodeledKindRefusals` to
`modeledKindDeclarationRemedies` and that the counts would go 55 -> 56 and
142 -> 141. **That was wrong, and §5 is what makes it wrong.**

The kind names the *adjustment on printed line 8p*, which exists only when there
IS an excess business loss — and §5 refuses exactly that case. A taxpayer who
declares the kind is a taxpayer with a binding §461(l), and this engine still
cannot finish their return. Reclassifying it would tell them the opposite. *Only
reclassify a kind whose every blocker is gone*, and this one's blocker is the
§172 carryover, which is untouched.

So:

- `excessBusinessLossAdjustment` **stays refused**, with a corrected remedy. The
  old one was stale on both halves — it said Form 461 was required (it is
  modeled) and that *"this engine models one Schedule C and does not
  aggregate"* (Schedule F had been modeled for a phase, and Part I forms the
  aggregate). The new one states what is actually missing: Form 172.
- `farmIncomeOrLoss`'s remedy is corrected. It said a net LOSS on printed line 34
  *"refuses under §461(l) and Form 461"*; a loss at printed box 36a computes now,
  and box 36b is what still refuses.
- `netOperatingLossDeduction` stays refused, and its remedy now records that it
  is load-bearing on §5 — the outbound carryforward whose inbound counterpart
  this engine alone does not model.

**Every count is unchanged: modeled 55, refused 142, `kindVocabulary` 197,
tripwires 11, dialects 30 known / 32 dropped.** Each was read live and mutated to
confirm the assertion behind it is alive.

---

## 8. What this phase does NOT do

- No Form 4797. Printed line 4 stays a documented zero and `otherGainsOrLosses`
  stays refused, so the aggregate is formed from what this engine actually holds
  rather than from a zero standing in for something a taxpayer might have.
- No Form 172, no NOL in either direction.
- No §461(l) for an estate or trust, and no Form 1041 line references — this
  engine files Form 1040 only.
- No allocation of the threshold between farming and non-farming losses (i461,
  *Farming and nonfarming losses*). That allocation only matters once an excess
  business loss EXISTS, and one that exists refuses.
