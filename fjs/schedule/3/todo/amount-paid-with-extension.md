# Schedule 3 line 10 — the amount paid with a request for an extension to file

`amountPaidWithExtensionRequest`, until this slice an `fjs/return/scope` refusal whose
own remedy row said the thing that makes it easy: *"no dialect models it — there is no
information return for a payment made with Form 4868"*.

## Why this is the smallest possible slice

**No information return reports it.** A taxpayer who files Form 4868 (Application for
Automatic Extension of Time To File) and sends money with it holds a cheque stub, not a
1099. The IRS knows the payment; nothing furnishes the taxpayer a statement of it. So
there is no box to read, no payer to attribute it to, no exactness loop on a document
dialect to join — only the taxpayer's own declaration.

The engine has done exactly this three times already, on `vnd.fjs.return_profile`:

| Field | Printed line | Why it is not a document |
|---|---|---|
| `line26EstimatedTaxPayments` | 1040 line 26 | there is no IRS document for "I sent four cheques" |
| `line35aRefundRequested` | 1040 line 35a | it is a request, not a report |
| `line36AppliedToNextYear` | 1040 line 36 | likewise |

`line26EstimatedTaxPayments` is the exact precedent, down to the shape of its guard, and
this line copies it rather than inventing anything:

1. `option(string)` on `returnProfileSchema` — money as a decimal `string`, never a JSON
   number (AGENTS.md's first hard rule).
2. The field name joins `moneyBoxFields`, so `checkReferences`' step 6 re-parses it
   through `moneyFieldError` and a comma-grouped or otherwise inexact amount is refused
   by name. `expectedMoneyBoxFieldCount` moves 4 -> 5 in the same edit — the hand-typed
   counterweight that makes a box's silent removal fail even though its own generated
   leaf would vanish with it.
3. A cross-field check pairing the amount with its declared kind: an amount present
   while `declaredKinds` does not name `amountPaidWithExtensionRequest` is refused. This
   is check 7's own rule — *"an amount with no declared kind is an input the scope guard
   never sees"* — applied to the second field that needs it.
4. `fjs/schedule/3` reads it into printed line 10, citing the PROFILE at that field's own
   `boxPath` with the raw stored string, exactly as `fjs/form1040/core`'s
   `profileMoneyBox` cites line 26.

## The field name states its schedule

`scheduleThreeLine10AmountPaidWithExtensionRequest`, not `line10...`. The three fields
already on this dialect are named for **1040** lines, so a bare `line10` would read as
1040 line 10 (the adjustments total) — a different line on a different form carrying a
different figure. The one place a reader will look for this name is Schedule 3's own
printed line 10, and the name says so.

## Absent is absent

DOC-11 governs the missing case: an absent box is skipped, never defaulted to a stored
`'0.00'`. A profile that never requested an extension leaves the field out, and line 10
stays the `profileDeclaredZeroLine` it has always been — citing `declaredKinds`, the
honest box, rather than quoting a `'0.00'` no document contains. A profile that stored
`'0.00'` cites the field, because the taxpayer did state it.

## Where it goes, and the total it must reach

Schedule 3 line 10 -> **line 15** (*"Add lines 9, 10, 11, 12, and 14"*) -> **1040 line
31** -> line 33 (total payments). One line, one total, and the mutation that matters is
dropping `line10` from `line15`'s summand list: the line computes correctly and the money
never arrives. `fjs/form1040/core`'s own end-to-end leaves are what can see that, because
a schedule-level proof handed the schedule directly cannot.

## Not §6651, and not a penalty

Line 10 is a PAYMENT, not a credit and not a penalty computation. Nothing here decides
whether the extension was valid, whether the payment was timely, or whether §6651(a)(2)'s
failure-to-pay addition applies — those are 1040 line 38 territory (`estimatedTaxPenalty`,
still refused) and none of them changes what the taxpayer paid.

## Reclassification

The kind moves from `unmodeledKindRefusals` to `modeledKinds` in the SAME commit as the
wiring, per "wire before reclassify". Its refusal row's remedy — *"no dialect models it"*
— becomes false the instant the profile carries the field, so the row goes and the block
comment above it records what it taught: **a remedy that names a missing DIALECT rather
than a missing FORM is a remedy this project can close itself.**
