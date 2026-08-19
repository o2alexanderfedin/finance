# Form 3903 — Moving Expenses (TY2025)

Status: **module written, NOT wired.** `fjs/form3903/module.f.js` computes the five printed
lines; nothing calls it yet. Wiring Schedule 1 line 14 is a separate change (see
"What a caller must supply", below).

Sources, fetched 2026-08-18 and read directly, not from recall:

- `https://www.irs.gov/pub/irs-pdf/f3903.pdf` — the 2025 form (Cat. No. 12490K, "Created
  4/29/25").
- `https://www.irs.gov/pub/irs-pdf/i3903.pdf` — the 2025 instructions (Catalog Number
  64324D, Aug 18, 2025).

## Who may file at all

The form's own pre-line caption:

> **Before you begin:** You can deduct moving expenses only if you are a Member of the Armed
> Forces on active duty and, due to a military order, you, your spouse, or your dependents move
> because of a permanent change of station. **Check here to certify that you meet these
> requirements.**

`i3903.pdf`, *Reminders*: *"For tax years beginning after 2017, you can no longer deduct moving
expenses unless you are a member of the Armed Forces on active duty and, due to a military order,
you move because of a permanent change of station."* — §217(g), as left standing when TCJA
§11049 suspended §217 for everyone else.

**The eligibility certification is a checkbox, not an amount, and this module does not model it.**
It is a taxpayer attestation with no document behind it: no dialect in this engine carries "active
duty" or "permanent change of station". A caller that computes this form for a civilian would
produce a deduction the law does not allow, so the *caller* must gate on the taxpayer's own
declaration before calling. That gate belongs with `fjs/return/profile`'s
`movingExpensesArmedForces` kind, which is where a taxpayer fact of exactly this shape already
lives — not in the arithmetic.

## The printed lines, transcribed

| Line | Printed caption (`f3903.pdf`, 2025) |
|---|---|
| 1 | *"Transportation and storage of household goods and personal effects (see instructions)"* |
| 2 | *"Travel (including lodging) from your old home to your new home (see instructions). **Do not include the cost of meals**"* |
| 3 | *"Add lines 1 and 2"* |
| 4 | *"Enter the total amount the government paid you for the expenses listed on lines 1 and 2 that is not included in box 1 of your Form W-2 (wages). This amount should be shown in **box 12 of your Form W-2 with code P**"* |
| 5 | *"Is line 3 more than line 4?"* — see below |

Line 5's printed body, in full, because the whole of this specification turns on it:

> **No.** You cannot deduct your moving expenses. If line 3 is less than line 4, subtract line 3
> from line 4 and include the result on Form 1040, 1040-SR, or 1040-NR, **line 1h**.
>
> **Yes.** Subtract line 4 from line 3. Enter the result here and on Schedule 1 (Form 1040),
> line 14. This is your moving expense deduction.

And `i3903.pdf`, *Line 5*, which says the same thing with the equality case spelled out:

> If line 3 is more than line 4, subtract line 4 from line 3, and enter the result on line 5 and
> on Schedule 1 (Form 1040), line 14. This is your moving expense deduction. **If line 3 is equal
> to or less than line 4, you don't have a moving expense deduction. Subtract line 3 from line 4
> and, if the result is more than zero, enter it on Form 1040, 1040-SR, or 1040-NR, line 1h.**

### Line 2 excludes meals, and that exclusion is the caller's

`i3903.pdf`, *Travel*: *"You can deduct the expenses of traveling (including lodging within
certain limitations, **but not meals**) from your old home to your new home"*, and again under
*Which Moving Expenses Are Deductible*: *"You can't deduct any expenses for meals."*

This module takes line 2 as an already-net `bigint`. It has no meals input and **must not grow
one**: a line-2 figure that arrived with meals in it is indistinguishable, inside this module,
from one that did not. The exclusion is enforced where the figure is assembled — by the person or
document that produces `travelAndLodgingCents` — exactly as line 1's own long list of
non-deductibles (purchase price of the new home, car tags, lease-breaking, security deposits,
real-estate taxes, …) is. `movingExpensesMealsAreExcluded` in the module's proof pins the
*contract*: the module names one travel figure, and whatever is handed to it is the whole of
line 2.

### Line 4 is the GOVERNMENT's payment, not an employer's

The form says *"the total amount the **government** paid you"*, and the instructions' *Line 4*
says *"the total reimbursements and allowances you received from the government"*. That follows
from the eligibility rule: the only filers left after TCJA are on active duty, so the payer is
the armed service. It excludes the value of in-kind moving or storage services, and excludes
dislocation, temporary-lodging and move-in housing allowances, all of which are non-includible.
What remains *"should be identified on Form W-2, box 12, with code P."*

**Code P is the box, and it is the only box.** W-2 box 12 code P is defined as *excludable moving
expense reimbursements paid directly to a member of the Armed Forces*. `vnd.fjs.w2` stores
`box12` as coded rows, so a caller has the figure already.

## THE TRAP: line 4 > line 3 is TAXABLE INCOME, not a zero deduction

If the government reimbursed more than the move cost, the excess is **gross income**. From
`i3903.pdf`'s *Services or reimbursements provided by government*:

> However, if any reimbursements or allowances (other than dislocation allowances, temporary
> lodging expenses, temporary lodging allowances, or move-in housing allowances) exceed the cost
> of moving and the excess isn't included in your wages on Form W-2, **the excess still must be
> included in gross income on Form 1040, 1040-SR, or 1040-NR, line 1h.**

**The destination is Form 1040 line 1h — "other earned income" — not Schedule 1 line 8z.** Both
the form's own line 5 and the instructions' *Line 5* and *Services or reimbursements provided by
government* paragraphs say line 1h, three times, and none of them mentions Schedule 1 line 8. The
distinction is not cosmetic: line 1h is inside 1040 line 1z, so the excess is **earned income** —
it feeds the earned income credit, the additional child tax credit, and the standard deduction
floor for a dependent — whereas Schedule 1 line 8z lands on 1040 line 8 and is not earned income
at all. Routing it to 8z would produce the right total taxable income by the wrong path and the
wrong credits.

`fjs/return/scope` already has that line, and it is **refused**:

```
{ kind: 'otherEarnedIncome', line: '1040 line 1h', label: 'other earned income',
  remedy: 'no dialect models it (no phase yet)' }
```

and `fjs/form1040/core` sets `const line1h = declaredZero('1040 line 1h')`.

So a return in which line 4 exceeds line 3 carries taxable income **this engine has nowhere to
put**. Three candidate behaviours, and only one is honest:

1. **Return a zero deduction** (what the printed page tells a human to enter on line 5). The
   engine would then compute a complete-looking Form 1040 whose line 1h is a `declaredZero` while
   real gross income exists — **understating the tax**, silently, with no refusal anywhere. This
   is the failure this module exists to prevent.
2. **Return the negative as a deduction.** Worse: it understates tax by twice the excess, once by
   omitting income and again by deducting it.
3. **Refuse.** The engine says what it cannot compute and where the amount would have gone.

**(3).** The refusal message must name the excess *amount*, name **Form 1040 line 1h**, and say
which way the error would run — per AGENTS.md, *"if a message is part of the contract, assert the
part that carries the information"*: the destination is the only part a reader can act on.

### The equality case is NOT a refusal

`i3903.pdf`'s *Line 5* handles `line 3 == line 4` explicitly: no deduction, and the line-1h
subtraction produces zero, which is not *"more than zero"*, so nothing is reported anywhere.
A perfectly-reimbursed move is a complete, computable return with a zero deduction. The refusal
is therefore gated on `line4 > line3` **strictly**, and the boundary is proven at ±1 cent:
`line4 === line3` computes zero, `line4 === line3 + 1n` refuses with a one-cent excess.

## A negative input refuses too

Lines 1, 2 and 4 are an expense, an expense and a reimbursement. **None of them can be negative on
the printed page**, and there is no "-0-" or parentheses box anywhere on this form. A negative
arriving here is a transcription or wiring error, and each direction of it is expensive: a
negative line 4 *inflates* the deduction (`line3 - (-x)` is larger than line 3), and a negative
line 1 or 2 shrinks a real one. Refusing costs one branch and removes both. Zero is legitimate and
is proven not to refuse, at the -1/0 boundary pair.

## Out of scope, deliberately

- **The eligibility checkbox** — see above; a taxpayer attestation, not arithmetic.
- **Two moves.** *"If you qualify to deduct expenses for more than one move, use a separate Form
  3903 for each move."* This module is one form; a caller with two moves calls it twice and adds
  the line 5s. It does not take an array, for the same reason `fjs/form8959` does not.
- **Form 2555 filers.** *"Report the part of your moving expenses that is not allowed as a
  deduction because it is allocable to the excluded income on the appropriate line of Form 2555."*
  This engine models no Form 2555; a return with foreign earned income is refused elsewhere before
  this line is reached.
- **The storage-fees shortcut.** A return claiming only storage fees for a prior year's move
  during an absence from the United States *"Do[es] not file Form 3903"* and enters the fees
  directly on Schedule 1 line 14 with a box checked. That is a Schedule 1 path with no Form 3903
  behind it, so it is not this module's business — but a caller wiring line 14 must not assume
  line 14 is always this module's line 5.
- **The 21-cents-a-mile standard mileage rate.** It converts miles into a line-2 dollar figure,
  and this module takes line 2 in dollars. If a mileage input is ever added, the rate is a
  tax-year parameter and belongs in `fjs/tax/params`, never as a literal.

## What a caller must supply, to wire Schedule 1 line 14

`movingExpenses({ transportationAndStorageCents, travelAndLodgingCents,
governmentPaymentsNotInBox1Cents })`:

- `transportationAndStorageCents` — line 1. No dialect in this engine carries it; it is a
  taxpayer-supplied figure.
- `travelAndLodgingCents` — line 2, **net of meals**, likewise taxpayer-supplied.
- `governmentPaymentsNotInBox1Cents` — line 4: the sum of **W-2 box 12 code P** across every
  stored W-2 for the taxpayer. `movingExpensesLine4W2Box12Codes` is exported so the caller's
  code match and this specification cannot drift apart.

On `{ kind: 'ok', … }`, Schedule 1 line 14 takes `line5`. On `{ kind: 'error', message }`, the
caller threads the message out verbatim — it is never thrown.

## Traceability

- Kind: `movingExpensesArmedForces` (`fjs/return/scope`, `Schedule 1 line 14 -> 1040 line 10`,
  remedy *"requires Form 3903 (no phase yet)"*). **This module does not reclassify it** — the
  project's "wire before reclassify" rule means the kind moves in the commit that wires line 14,
  not in the commit that writes the arithmetic.
- The refusal above depends on `otherEarnedIncome` (`1040 line 1h`) staying refused. **When that
  kind is ever modeled, this module's refusal becomes wrong** and line 5's "No" branch should
  compute the line-1h inclusion instead. The refusal message says so.
