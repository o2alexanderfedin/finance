# Schedule 1 line 18 — penalty on early withdrawal of savings

**Status:** specified, not yet implemented
**Kind:** `penaltyOnEarlyWithdrawalOfSavings`
**Printed line:** Schedule 1 line 18 -> 1040 line 10

## What is missing, and why it is only wiring

`vnd.fjs.1099int` has carried `box2EarlyWithdrawalPenalty` since the dialect
shipped (`fjs/document/1099int/module.f.js:107`), and the field is inside that
dialect's money-exactness loop (`:131`), so every stored value is already
validated to the cent.

**No computation reads it.** `grep box2EarlyWithdrawalPenalty fjs/` outside the
dialect returns nothing. The engine validates the box at storage and then drops
it, which is the `box13StatutoryEmployee` shape this repository has already paid
for once and names in four places.

Schedule 1 line 18 is a `profileDeclaredZeroLine` today
(`fjs/schedule/1/module.f.js:844`).

## The computation

Line 18 is a sum, with no threshold, no phase-out and no eligibility test:

    line18 = Σ box2EarlyWithdrawalPenalty over every stored Form 1099-INT

§62(a)(9) makes it an above-the-line deduction with no floor — a bank reports
the forfeited interest it charged, and the whole of it is deductible. There is
no worksheet and no form to attach.

## Why this is not a new form module

`fjs/form*/` exists for a *printed form*. There is no Form for this line; the
1099-INT box is the whole computation. The work is therefore:

1. Thread `interestForms` into `scheduleOnePartIIExceptStudentLoanInterest`'s
   input, exactly as `studentLoanInterestForms` is threaded today
   (`fjs/schedule/1/module.f.js:1093, 1115, 1255`).
2. Replace the `zero(...)` at `:844` with a `documentLine` summing the box,
   citing `box2EarlyWithdrawalPenalty` per contributing document.
3. Reclassify `penaltyOnEarlyWithdrawalOfSavings` from
   `unmodeledKindRefusals` to `modeledKinds` **in the same commit as the
   wiring** — "wire before reclassify", `fjs/return/scope/module.f.js:137-139`.

## Citations

Each contributing Form 1099-INT emits one `Source`:

    { documentHash, boxPath: 'box2EarlyWithdrawalPenalty', value }

A return with no Form 1099-INT, or one where every box 2 is absent, keeps a
computed zero citing the profile — the `profileDeclaredZeroLine` shape line 15
already uses when there is no business.

## Proofs

Hand-typed expected values in integer cents, per AGENTS.md — never derived from
the code under test.

- one 1099-INT with a box 2 penalty -> line 18 equals it, one cited source
- two 1099-INTs -> the sum, two cited sources, both box paths
- box 2 absent -> computed zero, profile citation only, no document source
- box 2 present and `'0.00'` -> zero **with** the document cited, since the
  document did report the box (distinguishes "no box" from "a zero box")
- a 1099-INT alongside an unrelated dialect -> only the 1099-INT contributes
- the kind is modeled: `penaltyOnEarlyWithdrawalOfSavingsIsInScopeAlone`
- control: a *different* still-refused 1099-INT-adjacent kind still refuses,
  so the reclassification did not open the gate for everything

**Mutation to run before claiming the proofs work** (AGENTS.md: "a proof is not
known to work until you have watched it fail"):

- return `0n` from the sum -> the value leaves must go red
- drop the `Source` push -> the citation leaves must go red
- leave the kind in `unmodeledKindRefusals` -> `expectedModeledKindCount` and
  `everyModeledKindHandTyped` must go red

## Not in scope

`box6ForeignTaxPaid` on the same dialect was also stored and unread when this spec was
written, and is now read: it is `foreignTaxCredit` (Schedule 3 line 1), a different kind
with an election this engine did not then carry. It carries it now —
`section904jElectionAllForeignIncomeIsQualifiedPassiveIncome` on `vnd.fjs.return_profile`
— and the spec is `fjs/schedule/3/todo/foreign-tax-credit.md`.
