# `taxReturnReportSource`'s route lines are covered by `String.includes` and one fixture

Status: **PARTLY CLOSED.** Eight of the twenty-eight route lines are now EXECUTED against the real
stored bytes; twenty remain. Renamed from `tax-return-report-source-k1-routes-unexercised.md`,
because the three Schedule K-1 lines that file named are among the ones now closed and the
subject of this file is what is left. Everything below was checked by reading or running the named
thing, not carried over.

## The gap

`fjs/report/tax_return/module.f.js` holds two parallel implementations of the same dispatch: the
stored program **source text** (`taxReturnReportSource`, an array of string literals) and a live
**function twin**. The twin's routing is covered leaf by leaf by `proof.routingSweep`. The TEXT is
executed only through `tax-return-integration.test.js`'s `casAdd(taxReturnReportSource)` harness,
in a real `fjs_run` process, so a route line that harness's store never exercises is dead text in
every run the suite performs — and `String.includes` of the dialect tag, which is all
`sourceAndTwinDispatchOnTheSameElevenDialects` performs, cannot see a line that is present and
wrong.

## What is closed

The harness's main fixture is a return profile, two W-2s and a 1099-G, so three route lines were
exercised. A leg added between the PROV-05 pinned runs and the mixed-year refusal seeds five more
subjects and reruns the stored bytes, taking that to **eight of twenty-eight**:

| Route line | Document | Reaches |
|---|---|---|
| `vnd.fjs.k1_1065` | box 5, `$700.00` | 1040 line 2b |
| `vnd.fjs.k1_1120s` | box 4, `$30.00` | 1040 line 2b |
| `vnd.fjs.k1_1041` | box 1, `$400.00` | 1040 line 2b |
| `vnd.fjs.1099int` | box 1, `$9.00` | 1040 line 2b |
| `vnd.fjs.1099div` | boxes 1a `$250.00` / 1b `$100.00` | 1040 lines 3b and 3a |

**The cheap version really is a fake pass, and this leg is not it.** The reducer's fallthrough
returns `acc` unchanged for an unrouted document — correct behaviour, and exactly what makes
presence unobservable — so only an amount that MOVES proves a line executed. Three design choices
carry that:

- **Distinct amounts whose every subset sums differently.** `700 + 30 + 400 + 9 = 1,139` on line
  2b; dropping any one leaves `439`, `1,109`, `739` or `1,130`. A failure therefore names WHICH
  route line broke, which four separate legs would also have done, at four times the cost.
- **Dialect-qualified `boxPath` assertions per source, not only the total.** Four amounts land on
  one printed line, so a document routed into the wrong bucket can leave the total untouched.
  `k1_1041`'s interest box is literally `box1InterestIncome`, the same name the 1099-INT uses, so
  misrouting a beneficiary's K-1 into `interestForms` still contributes its $400.00. That mutation
  was run: every amount assertion stayed green and only the `boxPath` assertion caught it.
- **A second printed line.** The 1099-DIV lands on 3a/3b rather than 2b, so the leg is evidence
  that the recipe generalizes past one line — and box 1b is the qualified SUBSET of box 1a, which
  the two separate assertions pin against a transposition that a single total would absorb.

Mutations run, each reverted (`npm test` is 2865 proofs, green, with the leg in place). Every one
moves a route line to a NEIGHBOURING bucket rather than deleting it, because deleting the line
removes the tag and is caught by the static `includes` check — which would measure the wrong
thing:

| Mutation | Result |
|---|---|
| `k1_1041` -> `partnershipK1Forms` | line 2b `$730.00`, red |
| `k1_1065` -> `sCorporationK1Forms` | line 2b `$430.00`, red |
| `k1_1120s` -> `estateTrustK1Forms` | line 2b `$1,100.00`, red |
| `k1_1041` -> `interestForms` | **every total unchanged**; only the `boxPath` assertion red |
| `1099int` -> `dividendForms` | line 2b `$1,130.00`, red |
| `1099div` -> `brokerageForms` | line 3a `$0.00`, red |

Each reddened **only** `tax-return-integration.test.js` out of 2,865 proofs plus ten root gates.

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
16 for the four-subject fixture; the routing leg asserts lines 1a, 2b, 3a, 3b, 8, 9 and 15 and
says at the site why it stops there.

## The general shape, which is the part worth keeping

**A second implementation held as data is only as good as the fixtures that execute it**, and a
dispatch table whose fallthrough is "silently ignore" cannot be tested by presence — only by an
amount that moves, and only by a `boxPath` when several amounts share a printed line. Every route
line added to `taxReturnReportSource` inherits this. The recipe is now written down and run:
distinct subset-summing amounts, dialect-qualified source assertions, seeded after the assertions
that depend on the smaller store and before the mixed-year leg that poisons it, and every route
line mutated to a neighbouring bucket rather than deleted.
