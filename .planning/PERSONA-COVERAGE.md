# Persona Coverage — Can this engine file a return for these four people?

**Measured 2026-08-15** against `feature/1099g-unemployment` @ `d05d5ce`. Every claim below was
derived by reading the code, not from the roadmap. The inventory command is at the bottom; re-run
it rather than trusting this document's counts.

---

## Verdict

| Persona | Can the engine produce a return? | Decisive blocker |
|---|---|---|
| **Retired person** | **Yes**, for the mainstream case | None. Four named gaps, all narrow — see below. |
| **Non-profit employee** | **Yes, but the return is likely wrong in their favour's opposite** — it overstates tax | Every Schedule 1 adjustment is a hard zero, including student-loan interest and educator expenses. Not a refusal — a silent zero. |
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

The scope guard partitions a frozen vocabulary of **51 income/deduction/credit kinds** into
modeled and refused. **21 are modeled; 30 refuse.**

**Input dialects (11 that compute):** `w2`, `1099int`, `1099div`, `1099b`, `1099r`, `ssa1099`,
`1099g`, `itemized_deductions`, `medical_expenses`, `prior_year_capital_loss`, `return_profile`.

**Output forms (10 that compute):** Form 1040 (all 56 printed lines), Schedules 1, 1-A, 2, 3, A,
B, D, Form 8949, Schedule 8812.

**A caution about that output list.** Schedules 2 and 3 are *structurally* complete — every
printed line is named and wired into 1040 lines 17/23 and 20/31 — but **every line on both is a
documented zero**, because no dialect feeds either one. The same is true of all sixteen Schedule 1
Part II adjustments (lines 11–26) and all of Part I except line 7. Counting these as "supported
forms" is the difference between a form that is *present* and a form that is *populated*. This
document counts populated.

---

## Retired person — supported

This is the persona the project was actually built for; Phase 13 is literally titled "The 65+
Profile". Everything the mainstream retiree needs computes:

- **SSA-1099** → 1040 line 6a, with the full 18-line Social Security Benefits Worksheet at 6b.
- **1099-R** → lines 4a/4b (IRA) and 5a/5b (pensions), routed by each document's own
  `box7bIraSepSimple` checkbox. All 21 boxes modeled, including TY2025's new box 7c.
- **Senior deduction** (OBBBA, Schedule 1-A) → line 13b, including the continuous 6% phase-out.
- Interest, dividends, brokerage sales, capital-loss carryover, Schedule A with the 7.5%-of-AGI
  medical floor, estimated tax payments. All real.

**Four named gaps, none of which blocks a return:**

1. **Qualified Charitable Distributions.** A QCD is a taxpayer *election*, not a 1099-R box — the
   custodian reports the full distribution and the taxpayer writes "QCD" beside line 4b. This
   engine has no such election, so it will treat a QCD'd RMD as **fully taxable and overstate the
   tax**. For a retiree giving $20k/yr from an IRA that is a material error, and — critically —
   **it is silent.** It does not refuse, because nothing in the data says a QCD happened.
2. **Form 8606** — nondeductible IRA basis. Absent entirely. Anyone with after-tax IRA money is
   taxed twice on it.
3. **Form 5329** — the RMD-shortfall excise tax. Falls under the refused `scheduleTwoTaxes`.
4. **Schedule R** (Credit for the Elderly) — refused, but its income limits are so low it almost
   never applies.

Gaps 1 and 2 share a shape worth noting: both are cases where the *document is complete and the
engine reads it correctly*, and the missing thing is a taxpayer election the document cannot carry.

---

## Non-profit employee — computes, but overstates the tax

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
