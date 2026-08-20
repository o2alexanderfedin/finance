# `taxReturnReportSource`'s route lines are covered by `String.includes` and one fixture

Status: **PARTLY CLOSED.** Eight of the twenty-eight route lines are now EXECUTED against the real
stored bytes; twenty remain. Renamed from `tax-return-report-source-k1-routes-unexercised.md`,
because the three Schedule K-1 lines that file named are among the ones now closed and the
subject of this file is what is left. Everything below was checked by reading or running the named
thing, not carried over.

**Re-measured 2026-08-19**, when this branch met `develop`. The three Schedule K-1 lines were
closed TWICE and independently — by `develop`'s PR #106, which seeded the three faces into the
harness's MAIN fixture at `$1,200.00` / `$2,500.00` / `$3,700.00`, and by this branch's own leg at
`$700.00` / `$30.00` / `$400.00`, under the same three subject names. Only the first seeding is
visible to a run, so the merge kept it and this leg now carries the two faces `develop` does not:
the 1099-INT and the 1099-DIV. Every figure and every mutation result below was re-run against the
merged fixture, not carried over from either side.

## The gap

`fjs/report/tax_return/module.f.js` holds two parallel implementations of the same dispatch: the
stored program **source text** (`taxReturnReportSource`, an array of string literals) and a live
**function twin**. The twin's routing is covered leaf by leaf by `proof.routingSweep`. The TEXT is
executed only through `tax-return-integration.test.js`'s `casAdd(taxReturnReportSource)` harness,
in a real `fjs_run` process, so a route line that harness's store never exercises is dead text in
every run the suite performs — and `String.includes` of the dialect tag, which is all
`sourceAndTwinDispatchOnTheSameTwentyNineDialects` performs, cannot see a line that is present and
wrong.

## What is closed

The harness's main fixture is a return profile, two W-2s, a 1099-G and one Schedule K-1 of each of
the three faces, so **six** route lines are exercised by the main run alone. A leg added between
the PROV-05 pinned runs and the mixed-year refusal seeds two more subjects and reruns the stored
bytes, taking that to **eight of twenty-eight**:

| Route line | Document | Seeded by | Reaches |
|---|---|---|---|
| `vnd.fjs.return_profile` | the filer | main fixture | every gated line |
| `vnd.fjs.w2` | two employers | main fixture | 1040 line 1a |
| `vnd.fjs.1099g` | box 1, `$4,554.00` | main fixture | 1040 line 8 |
| `vnd.fjs.k1_1065` | box 5, `$1,200.00` | main fixture | 1040 line 2b |
| `vnd.fjs.k1_1120s` | box 4, `$2,500.00` | main fixture | 1040 line 2b |
| `vnd.fjs.k1_1041` | box 1, `$3,700.00` | main fixture | 1040 line 2b |
| `vnd.fjs.1099int` | box 1, `$9.00` | route-line leg | 1040 line 2b |
| `vnd.fjs.1099div` | boxes 1a `$250.00` / 1b `$100.00` | route-line leg | 1040 lines 3b and 3a |

**The cheap version really is a fake pass, and this leg is not it.** The reducer's fallthrough
returns `acc` unchanged for an unrouted document — correct behaviour, and exactly what makes
presence unobservable — so only an amount that MOVES proves a line executed. Three design choices
carry that:

- **Distinct amounts whose every subset sums differently.** `1,200 + 2,500 + 3,700 + 9 = 7,409` on
  line 2b; dropping any one leaves `6,209`, `4,909`, `3,709` or `7,400`. A failure therefore names
  WHICH route line broke, which four separate legs would also have done, at four times the cost.
- **Dialect-qualified `boxPath` assertions per source, not only the total.** Four amounts land on
  one printed line, so a document routed into the wrong bucket can leave the total untouched.
  `k1_1041`'s interest box is literally `box1InterestIncome`, the same name the 1099-INT uses, so
  misrouting a beneficiary's K-1 into `interestForms` still contributes its $3,700.00. That
  mutation was run: every amount assertion stayed green and only the `boxPath` assertion caught it.
  **It needs the 1099-INT to be there** — the main fixture's own citation assertions run in a store
  with no 1099-INT in it, so they could not have distinguished the two `box1InterestIncome`es.
- **A second printed line.** The 1099-DIV lands on 3a/3b rather than 2b, so the leg is evidence
  that the recipe generalizes past one line — and box 1b is the qualified SUBSET of box 1a, which
  the two separate assertions pin against a transposition that a single total would absorb.

Mutations re-run against the merged fixture on 2026-08-19, each reverted (`npm test` is 2902
tests, green, with the leg in place). Every one moves a route line to a NEIGHBOURING bucket rather
than deleting it, because deleting the line removes the tag and is caught by the static `includes`
check — which would measure the wrong thing:

| Mutation | Result |
|---|---|
| `k1_1065` -> `sCorporationK1Forms` | line 2b `$7,400.00` -> `$6,200.00`, red |
| `k1_1041` -> `interestForms` | **every total unchanged**; only the `boxPath` assertion red |
| `1099int` -> `dividendForms` | line 2b `$7,409.00` -> `$7,400.00`, red |
| `1099div` -> `brokerageForms` | line 3a `$100.00` -> `$0.00`, red |

Each reddened **only** `tax-return-integration.test.js` out of 2902 tests.

## What remains, and what it actually costs

Twenty route lines are still executed by nothing: `1099b`, `1099r`, `ssa1099`,
`itemized_deductions`, `medical_expenses`, `prior_year_capital_loss`, `1099nec`,
`business_expenses`, `asset_register`, `rental_property`, `adjustments`, `1098e`, `1098t`,
`credits`, `ira`, `prior_year_ira_basis`, `form3921`, `form3922`, `basis_correction`, `1095a`.

**The blocker is NOT the single-profile rule, and an earlier draft of this file was wrong to say
so.** The program refuses *"more than one active vnd.fjs.return_profile document"*, but the
profile is a SUBJECT like any other: `evo_add` with the existing revision as its parent amends it
in place, so a leg needing `capitalGainsOrLosses` or `businessIncomeOrLoss` declared can amend the
one profile rather than spawn a second server against a second store. That is cheap and was
checked by reading `evoAdd`'s use for `subjectW2A` two legs above.

The real cost is **hand-derived arithmetic**, and it divides the twenty in two:

- **Documents that add income to a line the current profile already carries** (`1099r`, `ssa1099`,
  `itemized_deductions`, `medical_expenses`, `adjustments`, `1098e`, `1098t`, `credits`, `ira`,
  `prior_year_ira_basis`) ride in the leg above for the price of one subject and two or three more
  hand-typed cents figures each. `ssa1099` costs more than its neighbours because §86's taxable
  portion is its own worksheet; the rest are additions.
- **Documents that bring a whole schedule** (`1099b`/`prior_year_capital_loss`/`basis_correction`
  -> Schedule D; `1099nec`/`business_expenses`/`asset_register` -> Schedule C, Schedule SE and
  Form 8995; `rental_property` -> Schedule E Part I and Form 4562; `1095a` -> Form 8962;
  `form3921`/`form3922` -> Form 6251 and the ESPP basis) need every intermediate figure derived
  from the printed forms rather than recomputed with the engine, which is the rule that makes them
  expensive rather than the wiring.

**Line 16 is the one figure the leg above deliberately does not assert, and any future leg
inherits the reason.** It is a Tax Table band lookup, a step function, so its expected value has
to be hand-derived from Publication 1040's own rows and never recomputed. The main run pins line
16 for the seven-subject fixture; the routing leg asserts lines 1a, 2b, 3a, 3b, 8, 9 and 15 and
says at the site why it stops there.

## The general shape, which is the part worth keeping

**A second implementation held as data is only as good as the fixtures that execute it**, and a
dispatch table whose fallthrough is "silently ignore" cannot be tested by presence — only by an
amount that moves, and only by a `boxPath` when several amounts share a printed line. Every route
line added to `taxReturnReportSource` inherits this. The recipe is now written down and run:
distinct subset-summing amounts, dialect-qualified source assertions, seeded after the assertions
that depend on the smaller store and before the mixed-year leg that poisons it, and every route
line mutated to a neighbouring bucket rather than deleted.
