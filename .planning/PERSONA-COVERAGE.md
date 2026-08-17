# Persona Coverage — Can this engine file a return for these four people?

**Measured 2026-08-15** against `feature/1099g-unemployment` @ `d05d5ce`. Every claim below was
derived by reading the code, not from the roadmap. The inventory command is at the bottom; re-run
it rather than trusting this document's counts.

> **SUPERSEDED IN PART, and deliberately not rewritten.** This is a dated measurement, and
> rewriting it in place would destroy the record of what was true when the survey was run. Three
> of its four verdicts have since moved, and each was moved by the phase the survey pointed at:
> **FAANG employee** by Phase 23 (Forms 8959 and 8960), **startup founder** by Phases 27 and 28
> (Schedule C, Schedule SE, Form 8995), and the retiree's remaining gaps by Phase 26. The
> founder section below reads *"Nothing about self-employment or pass-through business exists"*;
> as of **2026-08-16** the first four rows of its table are Schedule C ✔, Schedule SE ✔, the
> 1099-NEC dialect ✔, and Schedule E / K-1 still absent (Phase 30). Form 8995 computes the
> simplified case and refuses Form 8995-A by name. ROADMAP.md's phase entries carry the detail;
> re-run the survey rather than editing this one.

---

## Verdict

| Persona | Can the engine produce a return? | Decisive blocker |
|---|---|---|
| **Retired person** | **Yes**, and as of Phase 26 without the silent overstatement | None. **Two of the four named gaps are closed**; what remains refuses by name. See below. |
| **Non-profit employee** | **Yes** — Phase 24 (TAX-23/TAX-24/DOC-19) closed the silent overstatement | Student loan interest, educator expenses and the HSA deduction all compute. The remaining gaps (Saver's Credit, EIC, education credits) are REFUSALS, not silent zeros. |
| **FAANG employee** | **No** | Form 8959 (Additional Medicare Tax) is mandatory above $200k of wages and is unmodeled. Also Form 8960 (NIIT). |
| **Startup founder / early employee** | **No, and not close** | No Schedule C, no Schedule SE, no Schedule E, no K-1, no 1099-NEC dialect, no QBI deduction, no Form 6251 (AMT on ISO exercise). |

**"Non-profit owner" is not a thing on a Form 1040.** A non-profit has no owners — no equity, no
distributions, no capital account. Whoever runs it is a W-2 employee of it and files an ordinary
individual return; the *organization* files **Form 990**, an entirely separate return this engine
does not model and is not architected to model (it computes one taxpayer's 1040, not an entity's
information return). So that persona reduces to "non-profit employee", plus Form 990 as an
out-of-scope adjacent product. The one case where it does *not* reduce cleanly is a founder who
also consults for the org or others on a 1099-NEC — and that lands on the startup founder's
blockers, below.

---

## What is actually modeled

The scope guard partitions a frozen vocabulary of **76 income/deduction/credit kinds** into
modeled and refused. **26 are modeled; 50 refuse.** (Phase 23 split the coarse `scheduleTwoTaxes`
into fourteen per-printed-line kinds and Phase 24 split `scheduleOneAdjustments` into thirteen, so
the vocabulary grew without the engine's claims growing: what changed is that a refusal on either
schedule can now name the line and the form it needs.)

> **`76` is stale and is left standing deliberately, flagged rather than guessed at.**
> `fjs/return/profile`'s own asserted `expectedKindCount` is **86** — Phase 25 removed two coarse
> Schedule 3 kinds and added twelve per-printed-line ones. The modeled/refused SPLIT beneath it
> is not asserted anywhere, so correcting `76` without recounting the split would replace one
> stale number with a matched pair of them. Phase 26 added no kind at all (a QCD is not income
> and Form 8606 is not a credit), so nothing here moved this phase. Re-derive with the command
> at the bottom of this document before quoting either figure.

**Input dialects (17 that compute):** `w2`, `1099int`, `1099div`, `1099b`, `1099r`, `ssa1099`,
`1099g`, `1098e`, `1098t`, `itemized_deductions`, `medical_expenses`, `adjustments`,
`credits`, `ira`, `prior_year_capital_loss`, `prior_year_ira_basis`, `return_profile`.

> **That figure read 13 until Phase 26, and it was already wrong by two before this phase
> touched it** — `vnd.fjs.1098t` and `vnd.fjs.credits` landed in Phase 25 and were never added
> here. Corrected to 17 by counting the list rather than by adding this phase's two to the
> stale total. The number in this document is checked against nothing;
> `fjs/server/finance_schema`'s `expectedKnownDialectCount` and `fjs/media/dialects`'
> `expectedDialectCount` are the two that are, and they count a wider set (they include
> `vnd.fjs.ocr` and `vnd.fjs.run`, which compute no line).

**Output forms (16 that compute):** Form 1040 (all 56 printed lines), Schedules 1, 1-A, 2, 3, A,
B, D, Form 8949, Schedule 8812, Form 8959, Form 8960, Form 8889 (Part I only), Form 8880,
Form 8863, Form 8606 (Part I only).

**A caution about that output list.** Schedule 3 is *structurally* complete — every printed line
is named and wired into 1040 lines 20/31 — but **every line on it is a documented zero**, because
no dialect feeds it. Schedule 2 lines 11 and 12 compute (Phase 23); its other twelve lines do not.
Schedule 1 Part II lines 11, 13 and 21 compute (Phase 24); its other thirteen do not, nor does any
of Part I except line 7. Counting a form as "supported" because it is *present* rather than
*populated* is the distinction this document exists to keep; this document counts populated.

---

## Retired person — supported

**Rewritten 2026-08-16, after Phase 26.** This is the persona the project was actually built
for; Phase 13 is literally titled "The 65+ Profile". Everything the mainstream retiree needs
computes — and the two SILENT gaps this section used to list are gone, which matters more than
the count: both were cases where the engine produced a confident, fully-cited, wrong number.

- **SSA-1099** → 1040 line 6a, with the full 18-line Social Security Benefits Worksheet at 6b.
- **1099-R** → lines 4a/4b (IRA) and 5a/5b (pensions), routed by each document's own
  `box7bIraSepSimple` checkbox. All 21 boxes modeled, including TY2025's new box 7c.
- **Senior deduction** (OBBBA, Schedule 1-A) → line 13b, including the continuous 6% phase-out.
- Interest, dividends, brokerage sales, capital-loss carryover, Schedule A with the 7.5%-of-AGI
  medical floor, estimated tax payments. All real.

**Closed by Phase 26 — the two that were SILENT:**

- **Qualified Charitable Distributions** (TAX-28) → the taxpayer's `vnd.fjs.ira` election
  reduces 1040 line 4b while line 4a stays gross, capped at §408(d)(8)(A)'s $108,000 per
  INDIVIDUAL. Each gift names the distribution it came out of, so a QCD from a 401(k), or one
  larger than the distribution it claims, is refused rather than silently allowed.
- **Form 8606 Part I** (TAX-29) → nondeductible IRA basis and §408(d)(2)'s pro-rata rule, over
  the AGGREGATED year-end value of every traditional/SEP/SIMPLE IRA the person owns — not per
  account, which is the mistake that understates tax for anyone with two IRAs.

**What that was worth, in dollars.** On a hand-derived retiree — a $50,000 IRA distribution,
$20,000 of it given straight to a food bank, $20,000 of prior-year nondeductible basis, and
$150,000 of aggregated IRAs left at 31 December — this engine charged **$2,915.00 where the law
charges $291.00**. And because line 4b feeds the Social Security Benefits Worksheet, a second
fixture shows a $20,000 gift taking **$17,000 off taxable Social Security on top of the
$20,000** it takes off the distribution itself.

**Two named gaps remain, and neither is silent:**

1. **Form 5329** — the RMD-shortfall excise tax. Falls under the refused
   `additionalTaxOnTaxFavoredAccounts` kind (Phase 23 split the coarse `scheduleTwoTaxes` this
   line used to name).
2. **Schedule R** (Credit for the Elderly) — refused, but its income limits are so low it almost
   never applies.

**And four things INSIDE what now computes refuse by name rather than compute** — the honest
failure rather than the silent one: §408(d)(8)(F)'s one-time split-interest QCD election; Form
8606 Parts II and III (Roth conversions and Roth distributions, which is why a **backdoor Roth
is still not computable** and why TAX-29 stays unticked); an aggregated year-end IRA value the
taxpayer has not asserted; and — the one worth reading twice — **a QCD whose 70½ eligibility
the engine cannot determine.** §408(d)(8)(B)(ii) tests age at the DATE OF THE DISTRIBUTION, and
this repository stores **no birth date at all**: the nearest fact is 1040 line 12d's
*born-before-2-January-1961* checkbox, which is a **65** test, four and a half years short. The
fact is asserted by the taxpayer and refused when absent, never approximated from the 65 box.

The two closed gaps shared a shape worth keeping on record: both were cases where the *document
is complete and the engine reads it correctly*, and the missing thing was a taxpayer election
or assertion the document cannot carry. **That shape is what makes a gap silent**, and it is
the one to go looking for in the remaining three personas.

---

## Non-profit employee — computes, and no longer overstates the tax

**Rewritten 2026-08-16, after Phase 24.** The section below described a return that computed
completely and confidently while overstating the tax, because every Schedule 1 adjustment was a
hard zero rather than a refusal — the most dangerous shape in this project, since nothing in the
output said anything was missing. Three of those hard zeros are gone: **student loan interest
(Schedule 1 line 21, with its $85,000/$100,000 phase-out), educator expenses (line 11, capped per
eligible educator), and the HSA deduction (line 13, through Form 8889 Part I)** all read real
documents and reach 1040 line 10.

What is left is genuinely different in kind. The Saver's Credit, the Earned Income Credit and the
education credits are all *refused* kinds — a taxpayer who declares one gets no return at all,
with a message naming the form. That is the honest failure, not the silent one.

Two named gaps remain inside what now computes, and neither is silent:

1. **Interest paid to a lender who files no Form 1098-E** — §6050S's duty starts at $600 and
   reaches only persons in the trade or business of lending. `vnd.fjs.adjustments` carries a
   `studentLoanInterest` tag for exactly this, so the amount is *expressible*; what is missing is
   any substantiation for it, which is a product question rather than an engine one.
2. **Form 8889 beyond Part I.** Partial-year HDHP eligibility, the last-month rule, the spouse
   allocation of a family limit, qualified HSA funding distributions, and an excess employer
   contribution are each **refused by name** rather than computed. Parts II and III (distributions)
   are unmodeled and land inside collapsed lettered blocks whose kinds already refuse.

### The original section, kept for the record

A 403(b)/457(b) salary reduction already reduces W-2 box 1, and box 12 is modeled as code/amount
pairs, so the wage side is fine. The problem is everything a modestly paid public-service worker
actually claims:

| What they'd claim | Where it goes | Status |
|---|---|---|
| Student loan interest (up to $2,500) | Schedule 1 line 21 | **Hard zero** |
| Educator expenses (up to $300) | Schedule 1 line 11 | **Hard zero** |
| HSA deduction | Schedule 1 line 13 | **Hard zero** |
| Saver's Credit (Form 8880) | Schedule 3 line 4 | **Zero** (refused kind) |
| Earned Income Credit | 1040 line 27 | Refused kind |
| Education credits (8863) | Schedule 3 line 3 | **Zero** (refused kind) |

**This is the most dangerous of the four personas, and it is worth being blunt about why.** The
FAANG and startup cases *refuse* — they produce no return, which is loud and safe. This one
produces a complete, confident, fully-cited Form 1040 that is **wrong**, because a missing
adjustment is modeled as a legitimate zero rather than as an unmodeled kind. The taxpayer with
$1,800 of student loan interest gets a return that silently omits it and overpays.

The scope guard would catch this *if* the taxpayer declared `scheduleOneAdjustments`. Whether they
do is the whole question — see the structural finding below.

**Clergy housing allowance** is a separate hard block: it is excluded from box 1 but still subject
to self-employment tax, which needs Schedule SE. Not modeled.

---

## FAANG employee — refuses

RSUs are the easy part: vesting income is already inside W-2 box 1, and the sale is an ordinary
1099-B the engine reads. What blocks the return is that **high wages mandatorily trigger taxes
this engine does not compute**:

- **Form 8959, Additional Medicare Tax** — 0.9% on wages above **$200,000** single / $250,000 MFJ
  / $125,000 MFS. These thresholds are statutory and **not inflation-indexed**, so they bite ever
  harder each year. Employers withhold it automatically above $200k, so it appears on the W-2 —
  but computing the *liability* needs Form 8959 → Schedule 2 line 11 → 1040 line 23. Unmodeled.
- **Form 8960, Net Investment Income Tax** — 3.8% on the lesser of net investment income or MAGI
  over the same unindexed thresholds. Any FAANG engineer with a brokerage account hits this.
- **Form 6251, AMT** — matters if there are ISOs, which is less common at public FAANG than at
  startups but not rare.

All three route through `scheduleTwoTaxes`, a single coarse refused kind. Its own remedy string
concedes the situation: *"this coarse kind covers AMT, self-employment tax and other Schedule 2
items this engine has no dialect for (no phase yet)."*

Two softer gaps that would bite even after Schedule 2 lands:

- **Form 3922 (ESPP) and Form 3921 (ISO)** do not exist as dialects. Neither is filed with the
  return, but both carry the numbers needed to fix cost basis.
- **RSU and ESPP cost-basis correction.** Brokers routinely report $0 or unadjusted basis on
  1099-B for equity comp, and the taxpayer must adjust on Form 8949 — otherwise the vested value
  is taxed *twice*. Form 8949 exists here; the adjustment codes and the workflow do not.

---

## Startup founder / early employee — refuses, and the gap is structural

Nothing about self-employment or pass-through business exists. Not stubbed — absent:

| Needed | Present? |
|---|---|
| **Schedule C** (business income) | No module, no dialect |
| **Schedule SE** (self-employment tax, 15.3%) | No |
| **1099-NEC** dialect | No — zero occurrences in the tree |
| **Schedule E** / **Schedule K-1** (partnership, S-corp) | No |
| **Form 8995/8995-A** (QBI, the 20% deduction) | Refused kind |
| **Form 6251** (AMT — the ISO-exercise trap) | Refused kind |
| **§1202 QSBS exclusion** | Refused **deliberately, with a good reason** |

The §1202 refusal deserves singling out as the system working exactly as intended. 1099-DIV box 2c
reports the §1202 dollar amount but **not the exclusion percentage** (50/60/75/100%), which depends
on when the fund acquired the stock. The code refuses rather than guess, and its docstring says
why: *"Computing it without that percentage would overstate tax for anyone entitled to the
exclusion — a confident wrong answer, the exact failure TAX-16 exists to prevent."* For a founder
with a QSBS exit, that refusal is worth more than a number.

---

## The structural finding: declaration-driven scoping fails for mandatory taxes

This is the most important result of the survey, and it is not a missing form.

The scope guard compares what the **taxpayer declares** against what the engine models. That
design was chosen deliberately and for a sound reason, recorded in `fjs/return/scope`: a
store-driven guard cannot work, because *"the engine never sees the documents it cannot read"* —
a taxpayer with a 1099-DIV in a drawer produces the same empty line as one with no dividends.

**But declaration-driven scoping has a failure mode of its own, and nothing currently covers it.**
Some tax items are not elective and not knowledge-dependent — they trigger on a threshold, from
data the engine *already holds*:

> A single filer with $300,000 in W-2 box 5 owes Additional Medicare Tax. Full stop. If they do
> not know Form 8959 exists — and most people don't — they will not declare `scheduleTwoTaxes`,
> the guard will stay silent, and the engine will confidently emit a return understating tax by
> roughly **$900**.

The guard's soundness rests on the taxpayer knowing what they owe, which is the thing they came
to a tax engine not to have to know. **This is not an argument against the design; it is an
argument that the design needs a second, complementary guard**: a small set of computable
tripwires that assert a kind *must* have been declared given the documents. Box 5 over $200k
implies `scheduleTwoTaxes`. Any 1099-NEC implies self-employment. Non-zero box 3 on a 1099-R
implies capital-gain treatment.

That is a genuinely small piece of work — a table of (predicate over documents) → (kind that must
be declared) — and it converts the entire class of "silent understatement" into the refusals this
project already handles well. **It would also close the non-profit employee's silent-overstatement
case from the other direction.**

---

## If you wanted all four personas, in dependency order

1. **Computable tripwires** (above). Small, and it makes every existing refusal trustworthy.
   Nothing else on this list is safe to ship before it.
2. **Schedule 2 Part I/II populated** — Forms 8959 and 8960 first; both are short, purely
   arithmetic, and depend on data already in hand. **This alone unblocks the FAANG employee.**
3. **Schedule 1 Part II adjustments** — student loan interest, educator expenses, HSA. Short
   worksheets, no new documents needed beyond taxpayer-asserted records (the
   `medical_expenses` dialect is the precedent for that shape). **Unblocks the non-profit employee.**
4. **Schedule C + Schedule SE + a 1099-NEC dialect** — the big one, and the gateway to the startup
   persona. Schedule SE feeds Schedule 2, so it depends on step 2.
5. **Form 8995 (QBI)** — depends on Schedule C.
6. **Form 6251 (AMT)** — the hardest, and it needs Form 3921 to be useful for ISO exercises.
7. **Schedule E and K-1** — a founder with a partnership stake needs this; it is a large surface.

Steps 1–3 are the good trade: they are the smallest work on the list, they take coverage from one
persona to three, and step 1 is what makes the other two safe to trust.

---

## Re-derive rather than trust

```sh
# modeled kinds (21 today)
awk '/^export const modeledKinds/,/^\]/' fjs/return/scope/module.f.js | grep -cE "^\s+'"
# full vocabulary (51 today) -- refused = the difference
awk '/kindVocabulary = /,/^\]/' fjs/return/profile/module.f.js | grep -cE "^\s+'"
# input dialects
ls -1 fjs/document/
# is a form present at all?
grep -rl 8959 fjs/   # 1 file = a prose mention in a refusal remedy, not a module
```

That last command is the point: **every form number in this document's "missing" column appears
somewhere in the tree**, in a docstring or a refusal string. Grepping for a form number tells you
whether someone has *thought* about it, not whether it computes.
