/**
 * `fjs/document/unread_registry` — the standing gate for the defect this repo
 * has now paid for seven times: **a money box a dialect STORES, validates for
 * exactness, and no computation ever reads.**
 *
 * ## Why a gate rather than another sweep
 *
 * Four instances were found by accident, each while doing something else —
 * `box2EarlyWithdrawalPenalty` and `box6ForeignTaxPaid` on `vnd.fjs.1099int`,
 * `box10DependentCareBenefits` and `box11NonqualifiedPlans` on `vnd.fjs.w2`.
 * A deliberate sweep (`fjs/todo/stored-but-unread-field-sweep.md`) then found
 * three more that were wirable outright: `vnd.fjs.1099div` boxes 12 and 13 and
 * `vnd.fjs.ssa1099` box 6. Seven instances, none of them found by a check.
 *
 * The reason the shape is invisible is precise and worth stating, because it
 * is what this module is built against: **the box IS mentioned in code, by the
 * loop that validates it.** Every dialect walks a hand-typed `moneyBoxFields`
 * tuple through `centsFromString` so a comma-grouped amount is refused at
 * storage. A grep for the box name therefore hits, and the hit is in the
 * dialect's own module, and it means nothing about whether any figure ever
 * reaches a printed line. Three further blind spots close the case:
 *
 * - **A read through a rename.** `vnd.fjs.asset_register`'s
 *   `section179ElectedCost` has NO external mention of that name, because
 *   `depreciableAssets` renames it to `section179ElectedCostCents` before
 *   `fjs/form4562` reads it.
 * - **A name declared on two dialects and read on one.** `stateTaxWithheld` is
 *   declared on `vnd.fjs.1099b`, `vnd.fjs.1099div` AND `vnd.fjs.1099r`, and
 *   `fjs/schedule/a`'s SALT floor reads it off the 1099-R alone.
 * - **A mention inside a refusal's remedy string.** `fjs/return/scope`'s
 *   `nonqualifiedDeferredCompensationPension` row names
 *   `box11NonqualifiedPlans` in prose that ships as a string literal.
 *
 * None of those is greppable. All of them are expressible as a hand-typed
 * partition, which is what this module is.
 *
 * ## The shape, and why it is the shape
 *
 * {@link moneyFieldDisposition} names EVERY money field of EVERY dialect that
 * has one, exactly once, with a disposition and a note. {@link proof} then
 * checks that set against the tuples the dialects themselves walk. The check
 * bites in both directions:
 *
 * - A money box ADDED to a dialect and forgotten appears in that dialect's own
 *   tuple and in no row here, so the partition fails and the proof NAMES it.
 *   That is the defect this module exists for.
 * - A money box REMOVED from a dialect leaves a row here with nothing to
 *   match, so the partition fails the other way — the same guard
 *   `expectedMoneyBoxFieldCount` gives each dialect individually, across all
 *   of them at once.
 * - A row DELETED from this table shrinks the registry, which
 *   {@link expectedMoneyFieldCount} — hand-typed, deliberately not
 *   `moneyFieldDisposition.length` — refuses.
 *
 * **The loop iterates over {@link dialectMoneyFields}, whose dialect list is
 * hand-typed here.** AGENTS.md names the trap directly: a proof that builds
 * its iteration set from the code under test can never notice that set
 * shrinking. So the dialect names are written out below and counted, and only
 * the per-dialect FIELD tuples are imported.
 *
 * ## The three dispositions
 *
 * - `'read'` — a computation reads the amount and it can reach a printed line.
 *   `fjs/form1040/core` and `fjs/report/tax_return` are where each such claim
 *   is actually proven; this table only records that the claim exists.
 * - `'refused'` — the ONLY reader is a refusal predicate, and that is correct.
 *   A K-1's `unmodeledMoneyBoxes` row refusing a non-zero amount by name is
 *   the archetype: the taxpayer is told which printed line this engine cannot
 *   fill for them, rather than having the amount dropped in silence.
 * - `'dropped'` — nothing reads it, and the note says why that is acceptable
 *   (or, where it is not yet acceptable, what blocks it and which direction
 *   the resulting error runs). **A `'dropped'` row is a liability, not a
 *   dismissal.** It is here so the next reader can price it.
 *
 * ## What this gate does NOT do
 *
 * It cannot verify that a `'read'` row is telling the truth — that is what the
 * wiring proofs are for, and a row flipped from `'dropped'` to `'read'` to
 * silence a failure would pass here. {@link proof.theSevenKnownDefectsAreRead}
 * pins the seven boxes this project has already paid for, by name, against
 * exactly that.
 *
 * It also covers MONEY fields only. Dates, checkboxes, identity labels and
 * free text are outside it, for the reason the sweep gives: every one of the
 * seven defects was money, and a partition that included `payerName` would be
 * mostly noise.
 *
 * @module
 */
import { assert, assertEq } from 'functionalscript/fjs/asserts/module.f.mjs'
import {
    dialect as oneZeroNineFiveADialect,
    moneyBoxFields as oneZeroNineFiveAMoneyBoxFields,
    monthlyMoneyFields as oneZeroNineFiveAMonthlyMoneyFields,
} from '../1095a/module.f.js'
import {
    dialect as oneZeroNineEightEDialect,
    moneyBoxFields as oneZeroNineEightEMoneyBoxFields,
} from '../1098e/module.f.js'
import {
    dialect as oneZeroNineEightTDialect,
    moneyBoxFields as oneZeroNineEightTMoneyBoxFields,
} from '../1098t/module.f.js'
import {
    dialect as oneZeroNineNineBDialect,
    moneyBoxFields as oneZeroNineNineBMoneyBoxFields,
    stateLocalMoneyFields as oneZeroNineNineBStateLocalMoneyFields,
} from '../1099b/module.f.js'
import {
    dialect as oneZeroNineNineDivDialect,
    moneyBoxFields as oneZeroNineNineDivMoneyBoxFields,
    stateLocalMoneyFields as oneZeroNineNineDivStateLocalMoneyFields,
} from '../1099div/module.f.js'
import {
    dialect as oneZeroNineNineGDialect,
    moneyBoxFields as oneZeroNineNineGMoneyBoxFields,
    stateMoneyFields as oneZeroNineNineGStateMoneyFields,
} from '../1099g/module.f.js'
import {
    dialect as oneZeroNineNineIntDialect,
    moneyBoxFields as oneZeroNineNineIntMoneyBoxFields,
} from '../1099int/module.f.js'
import {
    dialect as oneZeroNineNineNecDialect,
    moneyBoxFields as oneZeroNineNineNecMoneyBoxFields,
    stateMoneyFields as oneZeroNineNineNecStateMoneyFields,
} from '../1099nec/module.f.js'
import {
    dialect as oneZeroNineNineRDialect,
    moneyBoxFields as oneZeroNineNineRMoneyBoxFields,
    stateLocalMoneyFields as oneZeroNineNineRStateLocalMoneyFields,
} from '../1099r/module.f.js'
import {
    dialect as formThirtyNineTwentyOneDialect,
    moneyBoxFields as formThirtyNineTwentyOneMoneyBoxFields,
} from '../form3921/module.f.js'
import {
    dialect as formThirtyNineTwentyTwoDialect,
    moneyBoxFields as formThirtyNineTwentyTwoMoneyBoxFields,
} from '../form3922/module.f.js'
import {
    dialect as k1EstateTrustDialect,
    moneyBoxFields as k1EstateTrustMoneyBoxFields,
} from '../k1_1041/module.f.js'
import {
    dialect as k1PartnershipDialect,
    moneyBoxFields as k1PartnershipMoneyBoxFields,
} from '../k1_1065/module.f.js'
import {
    dialect as k1SCorporationDialect,
    moneyBoxFields as k1SCorporationMoneyBoxFields,
} from '../k1_1120s/module.f.js'
import {
    dialect as ssa1099Dialect,
    moneyBoxFields as ssa1099MoneyBoxFields,
} from '../ssa1099/module.f.js'
import {
    dialect as w2Dialect,
    moneyBoxFields as w2MoneyBoxFields,
    stateLocalMoneyFields as w2StateLocalMoneyFields,
} from '../w2/module.f.js'

/**
 * What is known about one money field.
 *
 * - `'read'` — a computation reads the amount; it can reach a printed line.
 * - `'refused'` — the only reader is a refusal predicate, which is correct.
 * - `'dropped'` — nothing reads it. The note prices it.
 * @typedef {'read' | 'refused' | 'dropped'} Disposition
 */

/**
 * One row: the dialect tag, the field name, its disposition, and a note that
 * is a printed destination for `'read'`, the refusal for `'refused'`, and the
 * reason plus the error direction for `'dropped'`.
 * @typedef {readonly [string, string, Disposition, string]} MoneyFieldRow
 */

/**
 * **Every money field of every dialect that has one, exactly once.**
 *
 * The order is the dialects' own tuple order, so a row can be checked against
 * the printed form by reading down the page. Sorting it would make the table
 * easier to search and harder to audit, which is the wrong trade for a table
 * whose whole purpose is being audited against paper.
 * @type {readonly MoneyFieldRow[]}
 */
export const moneyFieldDisposition = [
    // ── vnd.fjs.1095a ───────────────────────────────────────────────────
    [oneZeroNineFiveADialect, 'line33AnnualEnrollmentPremiums', 'refused', 'checked against the exact cents sum of Part III column A; a disagreement refuses the document by name. Form 8962 computes MONTHLY, so the annual total carries no figure of its own'],
    [oneZeroNineFiveADialect, 'line33AnnualSlcspPremium', 'refused', 'the same cross-check against column B'],
    [oneZeroNineFiveADialect, 'line33AnnualAdvancePaymentOfPtc', 'refused', 'the same cross-check against column C'],
    [oneZeroNineFiveADialect, 'columnAEnrollmentPremiums', 'read', 'Form 8962 line 11 column (a) / lines 12-23 column (a)'],
    [oneZeroNineFiveADialect, 'columnBSlcspPremium', 'read', 'Form 8962 column (b)'],
    [oneZeroNineFiveADialect, 'columnCAdvancePaymentOfPtc', 'read', 'Form 8962 column (f)'],
    // ── vnd.fjs.1098e ───────────────────────────────────────────────────
    [oneZeroNineEightEDialect, 'box1StudentLoanInterestReceived', 'read', 'Schedule 1 line 21 -> 1040 line 10'],
    // ── vnd.fjs.1098t ───────────────────────────────────────────────────
    [oneZeroNineEightTDialect, 'box1PaymentsReceivedForQualifiedTuition', 'read', 'Form 8863 -> Schedule 3 line 3 and 1040 line 29'],
    [oneZeroNineEightTDialect, 'box4AdjustmentsForAPriorYear', 'refused', 'PRESENCE only: a prior-year adjustment refuses the education credit at Form 8863, because §25A recapture needs the prior-year return this engine does not hold. The AMOUNT is not read'],
    [oneZeroNineEightTDialect, 'box5ScholarshipsOrGrants', 'read', 'Form 8863 — it reduces the qualified expenses'],
    [oneZeroNineEightTDialect, 'box6AdjustmentsToScholarshipsForAPriorYear', 'refused', 'PRESENCE only, the same refusal as box 4'],
    [oneZeroNineEightTDialect, 'box10InsuranceContractReimbursementOrRefund', 'refused', 'PRESENCE only: a tuition insurance reimbursement refuses the education credit at Form 8863'],
    // ── vnd.fjs.1099b ───────────────────────────────────────────────────
    [oneZeroNineNineBDialect, 'box1dProceeds', 'read', 'Form 8949 column (d) -> Schedule D -> 1040 line 7a'],
    [oneZeroNineNineBDialect, 'box1eCostOrOtherBasis', 'read', 'Form 8949 column (e)'],
    [oneZeroNineNineBDialect, 'box1fAccruedMarketDiscount', 'refused', 'requires Form 8949 column (f) code D, which this engine does not emit; the refusal names the box and the code'],
    [oneZeroNineNineBDialect, 'box1gWashSaleLossDisallowed', 'refused', 'requires column (f) code W, likewise refused by name'],
    [oneZeroNineNineBDialect, 'box4FederalIncomeTaxWithheld', 'read', '1040 line 25b'],
    [oneZeroNineNineBDialect, 'box8ProfitOrLossRealized', 'refused', 'the only reader is `fjs/form6781`\'s cross-check: box 8 minus box 9 plus box 10 must equal box 11, and a disagreement refuses the document by name. Box 8 carries no figure of its own — Form 6781 line 1 takes box 11 (its own line 1 instruction, the 1099-B\'s box 11 instruction, and Pub 550 p.58 all say so). The same shape as `vnd.fjs.1095a`\'s line 33 totals'],
    [oneZeroNineNineBDialect, 'box9UnrealizedProfitOrLossPriorYearEnd', 'refused', 'the same cross-check. NOT a prior-year blocker: the box is printed on THIS year\'s 1099-B ("Unrealized profit or (loss) on open contracts—12/31/2024"), so it is transcribed, never remembered. An ABSENT box 9 is read as the hypothesis zero INSIDE the check only, which is what distinguishes a first-year trader\'s genuinely empty box from one a transcription lost'],
    [oneZeroNineNineBDialect, 'box10UnrealizedProfitOrLossCurrentYearEnd', 'refused', 'the same cross-check, this year\'s mark to market under §1256(a)(1)'],
    [oneZeroNineNineBDialect, 'box11AggregateProfitOrLoss', 'read', 'Form 6781 Part I line 1 -> line 7 -> line 8 (40% short-term) and line 9 (60% long-term) under §1256(a)(3) -> Schedule D lines 4 and 11 -> 1040 line 7a. Wired by TAX-38'],
    [oneZeroNineNineBDialect, 'box13Bartering', 'dropped', 'BLOCKED: Schedule C or Schedule 1 line 8z, and nothing stored says which. Direction: UNDERSTATEMENT of tax'],
    [oneZeroNineNineBDialect, 'stateTaxWithheld', 'dropped', 'STATE: REQUIREMENTS.md puts state returns out of scope — store faithfully, compute nothing. NOTE it is not in `fjs/schedule/a`\'s SALT floor either, which reads only the W-2\'s and the 1099-R\'s'],
    // ── vnd.fjs.1099div ─────────────────────────────────────────────────
    [oneZeroNineNineDivDialect, 'box1aTotalOrdinaryDividends', 'read', '1040 line 3b'],
    [oneZeroNineNineDivDialect, 'box1bQualifiedDividends', 'read', '1040 line 3a'],
    [oneZeroNineNineDivDialect, 'box2aTotalCapitalGainDistr', 'read', 'Schedule D line 13 -> 1040 line 7a'],
    [oneZeroNineNineDivDialect, 'box2bUnrecapSec1250Gain', 'read', 'Schedule D line 19'],
    [oneZeroNineNineDivDialect, 'box2cSection1202Gain', 'dropped', 'BLOCKED: the taxable part of a §1202 gain belongs on the 28% Rate Gain Worksheet line 4. It is already INSIDE box 2a, which Schedule D line 13 sums, so no income is missing — but the rate is wrong. `fjs/schedule/d` says so at the site: "Box 2c (§1202 gain) is never read at all, anywhere in this module." `section1202Gain` is a refused scope kind, so a taxpayer who DECLARES it is refused; one who does not is not. Direction: UNDERSTATEMENT of tax'],
    [oneZeroNineNineDivDialect, 'box2dCollectibles28PercentGain', 'read', 'Schedule D line 18'],
    [oneZeroNineNineDivDialect, 'box2eSection897OrdinaryDividends', 'dropped', 'INFORMATIONAL for a Form 1040 filer. The printed Note: "Boxes 2e and 2f apply only to foreign persons and entities whose income maintains its character when passed through or distributed to its direct or indirect foreign owners or beneficiaries."'],
    [oneZeroNineNineDivDialect, 'box2fSection897CapitalGain', 'dropped', 'INFORMATIONAL, the same printed Note'],
    [oneZeroNineNineDivDialect, 'box3NondividendDistributions', 'dropped', 'BLOCKED on BASIS, which no dialect stores. Printed: "To the extent of your cost (or other basis) in the stock, the distribution reduces your basis and is not taxable. Any amount received in excess of your basis is taxable to you as capital gain." Direction: UNDERSTATEMENT, in the excess case only'],
    [oneZeroNineNineDivDialect, 'box4FederalIncomeTaxWithheld', 'read', '1040 line 25b'],
    [oneZeroNineNineDivDialect, 'box5Section199ADividends', 'read', 'Form 8995 line 6 -> 1040 line 13a'],
    [oneZeroNineNineDivDialect, 'box6InvestmentExpenses', 'dropped', 'INFORMATIONAL. Printed: "Shows your share of expenses of a nonpublicly offered RIC ... This amount is included in box 1a." It is already inside a box line 3b sums, and §67(g) suspends the deduction it used to support'],
    [oneZeroNineNineDivDialect, 'box7ForeignTaxPaid', 'read', 'Schedule 3 line 1 (§904(j)) -> 1040 line 20'],
    [oneZeroNineNineDivDialect, 'box9CashLiquidationDistributions', 'dropped', 'BLOCKED on BASIS: a liquidation distribution is sale proceeds, and Schedule D needs the basis nothing stores. Direction: UNDERSTATEMENT'],
    [oneZeroNineNineDivDialect, 'box10NoncashLiquidationDistributions', 'dropped', 'BLOCKED on BASIS, the same as box 9'],
    [oneZeroNineNineDivDialect, 'box12ExemptInterestDividends', 'read', '1040 line 2a — wired by the unread-field sweep. i1040 (2025) p.25 names the box outright'],
    [oneZeroNineNineDivDialect, 'box13SpecifiedPrivateActivityBondInterestDividends', 'read', 'Form 6251 line 2g -> Schedule 2 line 2 -> 1040 line 17 — wired by the unread-field sweep. A SUBSET of box 12, so it joins NO regular-tax line'],
    [oneZeroNineNineDivDialect, 'stateTaxWithheld', 'dropped', 'STATE: out of scope, and not in the SALT floor either'],
    // ── vnd.fjs.1099g ───────────────────────────────────────────────────
    [oneZeroNineNineGDialect, 'box1UnemploymentCompensation', 'read', 'Schedule 1 line 7 -> 1040 line 8'],
    [oneZeroNineNineGDialect, 'box2StateOrLocalIncomeTaxRefunds', 'refused', 'a non-zero amount refuses the document by name: §111\'s tax-benefit rule needs the PRIOR year\'s return, and this engine models one tax year'],
    [oneZeroNineNineGDialect, 'box4FederalIncomeTaxWithheld', 'read', '1040 line 25b'],
    [oneZeroNineNineGDialect, 'box5RtaaPayments', 'refused', 'refused by name, naming Schedule 1 line 8z'],
    [oneZeroNineNineGDialect, 'box6TaxableGrants', 'refused', 'refused by name, naming Schedule 1 line 8z'],
    [oneZeroNineNineGDialect, 'box7AgriculturePayments', 'read', 'Schedule F line 4a -> line 4b -> line 9 -> line 34 -> Schedule 1 line 6 (i1040sf p3\'s own routing table). An orphan box with no vnd.fjs.farm stored still REFUSES, at fjs/schedule/f rather than at the dialect'],
    [oneZeroNineNineGDialect, 'box9MarketGain', 'read', 'Schedule F line 4a, and OUT again at line 4b under the §77 election (i1040sf p4). An orphan box with no vnd.fjs.farm stored still REFUSES, at fjs/schedule/f rather than at the dialect'],
    [oneZeroNineNineGDialect, 'stateIncomeTaxWithheld', 'dropped', 'STATE: out of scope, and this dialect\'s own header says so'],
    // ── vnd.fjs.1099int ─────────────────────────────────────────────────
    [oneZeroNineNineIntDialect, 'box1InterestIncome', 'read', '1040 line 2b'],
    [oneZeroNineNineIntDialect, 'box2EarlyWithdrawalPenalty', 'read', 'Schedule 1 line 18 -> 1040 line 10. The FIRST of the seven stored-but-unread boxes, found by accident'],
    [oneZeroNineNineIntDialect, 'box3UsSavingsBondsAndTreasuryInterest', 'read', '1040 line 2b, a second summand'],
    [oneZeroNineNineIntDialect, 'box4FederalIncomeTaxWithheld', 'read', '1040 line 25b'],
    [oneZeroNineNineIntDialect, 'box6ForeignTaxPaid', 'read', 'Schedule 3 line 1 -> 1040 line 20. The SECOND of the seven'],
    [oneZeroNineNineIntDialect, 'box8TaxExemptInterest', 'read', '1040 line 2a'],
    [oneZeroNineNineIntDialect, 'box9SpecifiedPrivateActivityBondInterest', 'read', 'Form 6251 line 2g -> 1040 line 17'],
    // ── vnd.fjs.1099nec ─────────────────────────────────────────────────
    [oneZeroNineNineNecDialect, 'box1NonemployeeCompensation', 'read', 'Schedule C line 1 -> Schedule 1 line 3 -> 1040 line 8'],
    [oneZeroNineNineNecDialect, 'box3ReservedForFutureUse', 'refused', 'refused by name: the printed box is RESERVED with no caption, so an amount in it belongs to a form revision this engine has not read'],
    [oneZeroNineNineNecDialect, 'box4FederalIncomeTaxWithheld', 'read', '1040 line 25b (§3406 backup withholding)'],
    [oneZeroNineNineNecDialect, 'box5StateTaxWithheld', 'dropped', 'STATE: out of scope'],
    [oneZeroNineNineNecDialect, 'box7StateIncome', 'dropped', 'STATE: out of scope'],
    // ── vnd.fjs.1099r ───────────────────────────────────────────────────
    [oneZeroNineNineRDialect, 'box1GrossDistribution', 'read', '1040 line 4a or 5a, routed by box 7b'],
    [oneZeroNineNineRDialect, 'box2aTaxableAmount', 'read', '1040 line 4b or 5b'],
    [oneZeroNineNineRDialect, 'box3CapitalGain', 'refused', 'a non-zero amount trips `fjs/return/tripwire`, which refuses the return naming Form 4972'],
    [oneZeroNineNineRDialect, 'box4FederalIncomeTaxWithheld', 'read', '1040 line 25b'],
    [oneZeroNineNineRDialect, 'box5EmployeeContribOrInsurancePremiums', 'dropped', 'BLOCKED: a Simplified Method input, needed only when box 2a is absent or box 2b "taxable amount not determined" is ticked — a case this engine does not compute. Direction: UNDERSTATEMENT'],
    [oneZeroNineNineRDialect, 'box6NuaInEmployerSecurities', 'dropped', 'BLOCKED: §402(e)(4) net unrealized appreciation is excluded until the securities are sold, and this engine holds no basis history'],
    [oneZeroNineNineRDialect, 'box7dEarningsOnExcessContrib', 'dropped', 'BLOCKED: §402(g) corrective distributions, which this engine does not compute'],
    [oneZeroNineNineRDialect, 'box8aOther', 'dropped', 'BLOCKED: the "other" box has no single destination; the printed instruction sends it to several depending on the distribution'],
    [oneZeroNineNineRDialect, 'box9bTotalEmployeeContrib', 'dropped', 'BLOCKED: a Simplified Method input, the same case as box 5'],
    [oneZeroNineNineRDialect, 'box10AmountAllocableToIrrWithin5Years', 'dropped', 'BLOCKED: the five-year clock on an in-plan Roth rollover, which needs a prior-year record this engine does not hold'],
    [oneZeroNineNineRDialect, 'stateTaxWithheld', 'refused', 'read by `fjs/schedule/a`\'s SALT floor ONLY — it gates a refusal when asserted line 5a is below the withholding the taxpayer demonstrably paid, and never feeds a computed line'],
    [oneZeroNineNineRDialect, 'stateDistribution', 'dropped', 'STATE: out of scope'],
    [oneZeroNineNineRDialect, 'localTaxWithheld', 'dropped', 'LOCAL: out of scope. NOTE it is a Schedule A line 5a item and is NOT in the SALT floor, which reads only the state boxes'],
    [oneZeroNineNineRDialect, 'localDistribution', 'dropped', 'LOCAL: out of scope'],
    // ── vnd.fjs.form3921 ────────────────────────────────────────────────
    [formThirtyNineTwentyOneDialect, 'box3ExercisePricePerShare', 'read', 'Form 6251 line 2i, the §56(b)(3) ISO spread -> 1040 line 17'],
    [formThirtyNineTwentyOneDialect, 'box4FairMarketValuePerShareOnExerciseDate', 'read', 'Form 6251 line 2i, the other half of the spread'],
    // ── vnd.fjs.form3922 ────────────────────────────────────────────────
    // Every box of this dialect is dropped, and that is correct: the ONLY
    // reader is `fjs/form8949`'s employee-stock-purchase refusal, and it reads
    // the document's PRESENCE, not any box. There is nothing a box could be
    // routed to until the three gaps that refusal names are closed.
    [formThirtyNineTwentyTwoDialect, 'box3FairMarketValuePerShareOnGrantDate', 'dropped', 'the dialect\'s only reader is a PRESENCE-based refusal in `fjs/form8949`; no box is read, and none could be until the three gaps that refusal names are closed'],
    [formThirtyNineTwentyTwoDialect, 'box4FairMarketValuePerShareOnExerciseDate', 'dropped', 'the same presence-based refusal'],
    [formThirtyNineTwentyTwoDialect, 'box5ExercisePricePaidPerShare', 'dropped', 'the same presence-based refusal'],
    [formThirtyNineTwentyTwoDialect, 'box8ExercisePricePerShareAsIfExercisedOnGrantDate', 'dropped', 'the same presence-based refusal'],
    // ── vnd.fjs.k1_1041 ─────────────────────────────────────────────────
    [k1EstateTrustDialect, 'box1InterestIncome', 'read', '1040 line 2b'],
    [k1EstateTrustDialect, 'box2aOrdinaryDividends', 'read', '1040 line 3b'],
    [k1EstateTrustDialect, 'box2bQualifiedDividends', 'read', '1040 line 3a'],
    [k1EstateTrustDialect, 'box3NetShortTermCapitalGain', 'read', 'Schedule D line 5'],
    [k1EstateTrustDialect, 'box4aNetLongTermCapitalGain', 'read', 'Schedule D line 12'],
    [k1EstateTrustDialect, 'box4bTwentyEightPercentRateGain', 'refused', 'this dialect\'s `unmodeledMoneyBoxes` refuses a non-zero amount by name'],
    [k1EstateTrustDialect, 'box4cUnrecapturedSection1250Gain', 'refused', 'the same table'],
    [k1EstateTrustDialect, 'box5OtherPortfolioAndNonbusinessIncome', 'refused', 'the same table'],
    [k1EstateTrustDialect, 'box6OrdinaryBusinessIncome', 'read', 'Schedule E Part III -> Schedule 1 line 5 -> 1040 line 8'],
    [k1EstateTrustDialect, 'box7NetRentalRealEstateIncome', 'refused', 'the same table'],
    [k1EstateTrustDialect, 'box8OtherRentalIncome', 'refused', 'the same table'],
    [k1EstateTrustDialect, 'box10EstateTaxDeduction', 'refused', 'the same table'],
    // ── vnd.fjs.k1_1065 ─────────────────────────────────────────────────
    [k1PartnershipDialect, 'box1OrdinaryBusinessIncome', 'read', 'Schedule E Part II -> Schedule 1 line 5 -> 1040 line 8'],
    [k1PartnershipDialect, 'box2NetRentalRealEstateIncome', 'refused', 'this dialect\'s `unmodeledMoneyBoxes` refuses a non-zero amount by name'],
    [k1PartnershipDialect, 'box3OtherNetRentalIncome', 'refused', 'the same table'],
    [k1PartnershipDialect, 'box4aGuaranteedPaymentsForServices', 'refused', 'the same table'],
    [k1PartnershipDialect, 'box4bGuaranteedPaymentsForCapital', 'refused', 'the same table'],
    [k1PartnershipDialect, 'box4cTotalGuaranteedPayments', 'refused', 'the same table'],
    [k1PartnershipDialect, 'box5InterestIncome', 'read', '1040 line 2b (§702(a)(8))'],
    [k1PartnershipDialect, 'box6aOrdinaryDividends', 'read', '1040 line 3b'],
    [k1PartnershipDialect, 'box6bQualifiedDividends', 'read', '1040 line 3a'],
    [k1PartnershipDialect, 'box6cDividendEquivalents', 'read', '1040 line 3b (§871(m))'],
    [k1PartnershipDialect, 'box7Royalties', 'refused', 'the same table'],
    [k1PartnershipDialect, 'box8NetShortTermCapitalGain', 'read', 'Schedule D line 5'],
    [k1PartnershipDialect, 'box9aNetLongTermCapitalGain', 'read', 'Schedule D line 12'],
    [k1PartnershipDialect, 'box9bCollectiblesTwentyEightPercentGain', 'refused', 'the same table'],
    [k1PartnershipDialect, 'box9cUnrecapturedSection1250Gain', 'refused', 'the same table'],
    [k1PartnershipDialect, 'box10NetSection1231Gain', 'refused', 'the same table'],
    [k1PartnershipDialect, 'box12Section179Deduction', 'refused', 'the same table'],
    [k1PartnershipDialect, 'box21ForeignTaxesPaidOrAccrued', 'refused', 'the same table'],
    // ── vnd.fjs.k1_1120s ────────────────────────────────────────────────
    [k1SCorporationDialect, 'box1OrdinaryBusinessIncome', 'read', 'Schedule E Part II -> Schedule 1 line 5 -> 1040 line 8'],
    [k1SCorporationDialect, 'box2NetRentalRealEstateIncome', 'refused', 'this dialect\'s `unmodeledMoneyBoxes` refuses a non-zero amount by name'],
    [k1SCorporationDialect, 'box3OtherNetRentalIncome', 'refused', 'the same table'],
    [k1SCorporationDialect, 'box4InterestIncome', 'read', '1040 line 2b (§1366(a)(1)(A)) — box FOUR on this face'],
    [k1SCorporationDialect, 'box5aOrdinaryDividends', 'read', '1040 line 3b'],
    [k1SCorporationDialect, 'box5bQualifiedDividends', 'read', '1040 line 3a'],
    [k1SCorporationDialect, 'box6Royalties', 'refused', 'the same table'],
    [k1SCorporationDialect, 'box7NetShortTermCapitalGain', 'read', 'Schedule D line 5'],
    [k1SCorporationDialect, 'box8aNetLongTermCapitalGain', 'read', 'Schedule D line 12'],
    [k1SCorporationDialect, 'box8bCollectiblesTwentyEightPercentGain', 'refused', 'the same table'],
    [k1SCorporationDialect, 'box8cUnrecapturedSection1250Gain', 'refused', 'the same table'],
    [k1SCorporationDialect, 'box9NetSection1231Gain', 'refused', 'the same table'],
    [k1SCorporationDialect, 'box11Section179Deduction', 'refused', 'the same table'],
    // ── vnd.fjs.ssa1099 ─────────────────────────────────────────────────
    [ssa1099Dialect, 'box3BenefitsPaid', 'dropped', 'a COMPONENT of box 5, which is box 3 minus box 4 and is what line 6a reads. No separate destination'],
    [ssa1099Dialect, 'box4BenefitsRepaid', 'dropped', 'the other component of box 5. A repayment EXCEEDING benefits has its own §1341 treatment this engine does not compute'],
    [ssa1099Dialect, 'box5NetBenefits', 'read', '1040 line 6a, and the §86 worksheet behind line 6b'],
    [ssa1099Dialect, 'box6VoluntaryFederalIncomeTaxWithheld', 'read', '1040 line 25b — wired by the unread-field sweep. i1040 (2025) p.39 names the box outright'],
    // ── vnd.fjs.w2 ──────────────────────────────────────────────────────
    [w2Dialect, 'box1WagesTipsOtherCompensation', 'read', '1040 line 1a'],
    [w2Dialect, 'box2FederalIncomeTaxWithheld', 'read', '1040 line 25a'],
    [w2Dialect, 'box3SocialSecurityWages', 'read', 'Schedule 3 line 11, the excess social security withheld'],
    [w2Dialect, 'box4SocialSecurityTaxWithheld', 'read', 'Schedule 3 line 11 -> 1040 line 31'],
    [w2Dialect, 'box5MedicareWagesAndTips', 'read', 'Form 8959 -> Schedule 2 line 11 -> 1040 line 23'],
    [w2Dialect, 'box6MedicareTaxWithheld', 'read', 'Form 8959 Part V line 24 -> 1040 line 25c'],
    [w2Dialect, 'box7SocialSecurityTips', 'read', 'Schedule SE'],
    [w2Dialect, 'box8AllocatedTips', 'refused', 'a non-zero amount trips `fjs/return/tripwire`, which refuses the return naming the `unreportedTips` kind and Form 4137'],
    [w2Dialect, 'box10DependentCareBenefits', 'read', 'Form 2441 Part III -> 1040 line 1e. The THIRD of the seven stored-but-unread boxes; the zero it printed was an UNDERSTATEMENT of tax'],
    [w2Dialect, 'box11NonqualifiedPlans', 'dropped', 'BLOCKED on a DECISION, not a figure: box 11 amounts are already inside box 1, which 1040 line 1a carries in full, so moving one to Schedule 1 line 8t without removing it there double-counts it — and removing it changes earned income and with it the EIC. `fjs/return/scope`\'s `nonqualifiedDeferredCompensationPension` refusal names the box, but it is DECLARATION-gated rather than document-gated, so a filer who does not declare the kind is not refused. The FOURTH of the seven'],
    [w2Dialect, 'stateWagesTipsEtc', 'dropped', 'STATE: out of scope'],
    [w2Dialect, 'stateIncomeTax', 'refused', 'read by `fjs/schedule/a`\'s SALT floor ONLY — it gates a refusal when asserted line 5a is below the withholding the taxpayer demonstrably paid, and never feeds a computed line'],
    [w2Dialect, 'localWagesTipsEtc', 'dropped', 'LOCAL: out of scope'],
    [w2Dialect, 'localIncomeTax', 'dropped', 'LOCAL: out of scope. NOTE it IS a Schedule A line 5a item and is NOT in the SALT floor, which reads only the state box'],
]

/**
 * Independently hand-typed: the number of rows {@link moneyFieldDisposition}
 * is expected to carry today. Deliberately NOT
 * `moneyFieldDisposition.length` — if it were, deleting a row would shrink
 * both sides together and this check could never fail. The same idiom
 * `expectedMoneyBoxFieldCount` and `expectedThresholdCount` already use.
 * @type {number}
 */
export const expectedMoneyFieldCount = 142

/**
 * Independently hand-typed: how many of the rows are `'dropped'` — a money
 * field nothing reads at all. **This number going UP is the thing to notice.**
 * It is stated separately from the total so that flipping a row from `'read'`
 * to `'dropped'` fails a check rather than passing quietly under an unchanged
 * total.
 *
 * **`36 -> 32` is TAX-38's**, and it is the largest single fall this figure
 * has taken: `vnd.fjs.1099b`'s whole §1256 block. Box 11 becomes `'read'` —
 * Form 6781 Part I line 1 takes it, splits it 60/40 and reaches Schedule D
 * lines 4 and 11 — and boxes 8, 9 and 10 become `'refused'`, because their
 * only reader is that form's cross-check, which is precisely the disposition
 * `'refused'` names. Four rows changed disposition and none was added or
 * removed, so {@link expectedMoneyFieldCount} does not move.
 * @type {number}
 */
export const expectedDroppedCount = 32

/**
 * Every dialect that has money fields, paired with the tuples that dialect
 * itself walks through `centsFromString`.
 *
 * **The dialect names are hand-typed here; only the FIELD tuples are
 * imported.** AGENTS.md's fourth defect is exactly this: a proof whose
 * iteration set comes from the code under test cannot notice that set
 * shrinking. Losing a dialect from this list is what
 * {@link expectedDialectCount} catches.
 * @type {readonly (readonly [string, readonly (readonly string[])[]])[]}
 */
const dialectMoneyFields = [
    [oneZeroNineFiveADialect, [oneZeroNineFiveAMoneyBoxFields, oneZeroNineFiveAMonthlyMoneyFields]],
    [oneZeroNineEightEDialect, [oneZeroNineEightEMoneyBoxFields]],
    [oneZeroNineEightTDialect, [oneZeroNineEightTMoneyBoxFields]],
    [oneZeroNineNineBDialect, [oneZeroNineNineBMoneyBoxFields, oneZeroNineNineBStateLocalMoneyFields]],
    [oneZeroNineNineDivDialect, [oneZeroNineNineDivMoneyBoxFields, oneZeroNineNineDivStateLocalMoneyFields]],
    [oneZeroNineNineGDialect, [oneZeroNineNineGMoneyBoxFields, oneZeroNineNineGStateMoneyFields]],
    [oneZeroNineNineIntDialect, [oneZeroNineNineIntMoneyBoxFields]],
    [oneZeroNineNineNecDialect, [oneZeroNineNineNecMoneyBoxFields, oneZeroNineNineNecStateMoneyFields]],
    [oneZeroNineNineRDialect, [oneZeroNineNineRMoneyBoxFields, oneZeroNineNineRStateLocalMoneyFields]],
    [formThirtyNineTwentyOneDialect, [formThirtyNineTwentyOneMoneyBoxFields]],
    [formThirtyNineTwentyTwoDialect, [formThirtyNineTwentyTwoMoneyBoxFields]],
    [k1EstateTrustDialect, [k1EstateTrustMoneyBoxFields]],
    [k1PartnershipDialect, [k1PartnershipMoneyBoxFields]],
    [k1SCorporationDialect, [k1SCorporationMoneyBoxFields]],
    [ssa1099Dialect, [ssa1099MoneyBoxFields]],
    [w2Dialect, [w2MoneyBoxFields, w2StateLocalMoneyFields]],
]

/**
 * Independently hand-typed: the number of dialects that carry money fields.
 * Deliberately NOT `dialectMoneyFields.length`.
 *
 * Sixteen, not the registry's thirty: `vnd.fjs.adjustments`,
 * `vnd.fjs.asset_register`, `vnd.fjs.basis_correction`,
 * `vnd.fjs.business_expenses`, `vnd.fjs.credits`,
 * `vnd.fjs.itemized_deductions`, `vnd.fjs.ira`, `vnd.fjs.medical_expenses`,
 * `vnd.fjs.prior_year_capital_loss`, `vnd.fjs.prior_year_ira_basis`,
 * `vnd.fjs.rental_property`, `vnd.fjs.ocr`, `vnd.fjs.return_profile`,
 * `vnd.fjs.run` and `vnd.fjs.revision` carry no fixed-caption money BOX — they
 * are taxpayer records with per-entry amounts, or carry no money at all — so
 * there is no printed box for one of them to drop.
 * @type {number}
 */
export const expectedDialectCount = 16

/** The set of `(dialect, field)` keys the registry names. @type {readonly string[]} */
const registeredKeys = moneyFieldDisposition.map(([dialect, field]) => `${dialect} ${field}`)

export const proof = {
    /**
     * **THE GATE.** For every dialect, the money fields it walks through its
     * own exactness loop are exactly the fields this registry names — no more,
     * no fewer. A box added to a dialect and forgotten fails HERE, by name,
     * rather than being dropped in silence for however long it takes somebody
     * to trip over it while doing something else.
     */
    everyMoneyFieldIsRegistered: () => {
        for (const [dialect, tuples] of dialectMoneyFields) {
            const declared = tuples.flatMap(tuple => tuple.map(field => `${dialect} ${field}`))
            const missing = declared.filter(key => !registeredKeys.includes(key))
            assert(
                missing.length === 0,
                [
                    'a dialect walks a money field this registry does not name — it is stored, '
                    + 'validated for exactness, and nothing here says whether any computation '
                    + 'reads it. Add a row to `moneyFieldDisposition` saying which.',
                    missing,
                ],
            )
        }
    },
    /**
     * The other direction, and it is not symmetric decoration: a row here
     * naming a field no dialect walks is a registry that has drifted off the
     * dialects — the state `expectedMoneyBoxFieldCount` guards inside each
     * dialect, guarded across all of them at once.
     */
    everyRegisteredFieldIsWalkedByItsDialect: () => {
        const declaredKeys = dialectMoneyFields.flatMap(([dialect, tuples]) =>
            tuples.flatMap(tuple => tuple.map(field => `${dialect} ${field}`)))
        const orphaned = registeredKeys.filter(key => !declaredKeys.includes(key))
        assert(
            orphaned.length === 0,
            ['this registry names a money field no dialect walks', orphaned],
        )
    },
    /** No `(dialect, field)` key may appear twice — a duplicate row could give one box two dispositions. */
    noKeyIsRegisteredTwice: () => {
        const seen = /** @type {string[]} */ ([])
        for (const key of registeredKeys) {
            assert(!seen.includes(key), ['a money field is registered twice', key])
            seen.push(key)
        }
    },
    /**
     * The hand-typed counts, which are what catch a row being DELETED — the
     * set checks above compare two lists that would shrink together if the
     * dialect lost the box in the same edit.
     */
    theHandTypedCountsHold: () => {
        assertEq(
            moneyFieldDisposition.length, expectedMoneyFieldCount,
            ['expected exactly the independently-stated money field count',
                moneyFieldDisposition.length, expectedMoneyFieldCount])
        assertEq(
            dialectMoneyFields.length, expectedDialectCount,
            ['expected exactly the independently-stated dialect count',
                dialectMoneyFields.length, expectedDialectCount])
        assertEq(
            moneyFieldDisposition.filter(([, , disposition]) => disposition === 'dropped').length,
            expectedDroppedCount,
            ['expected exactly the independently-stated dropped-field count — this number going '
                + 'UP is a money box that stopped being read',
                moneyFieldDisposition.filter(([, , d]) => d === 'dropped').length,
                expectedDroppedCount])
    },
    /** Every row says something. An empty note is a row nobody can act on. */
    everyRowCarriesANote: () => {
        for (const [dialect, field, disposition, note] of moneyFieldDisposition) {
            assert(
                note.length >= 10,
                ['a registry row carries no usable note', dialect, field, disposition, note])
        }
    },
    /**
     * **The anti-silencing pin.** The seven boxes this project has already paid
     * for are named here, individually, and asserted to be `'read'`. The
     * registry cannot verify that a `'read'` row is true — but it CAN refuse
     * the specific regression of a wired box being flipped back to `'dropped'`
     * to make a failing gate go quiet, which is the realistic failure mode for
     * a table like this one.
     *
     * Seven, hand-typed and hand-counted: 1099-INT boxes 2 and 6, W-2 boxes 10
     * and 11 — box 11 is the one of the four that is still `'dropped'`, and
     * deliberately, so it is asserted to be `'dropped'` rather than `'read'` —
     * and 1099-DIV boxes 12 and 13 and SSA-1099 box 6 from the sweep.
     *
     * **An EIGHTH joins them with TAX-38, and it is a different kind of
     * entry:** `vnd.fjs.1099b` box 11. The other seven were boxes this repo
     * had already paid for by shipping them unread. Box 11 was never
     * unnoticed — the sweep classified it BLOCKED, with a named blocker
     * ("Form 6781, which does not exist here") and a stated error direction.
     * It is pinned for the same reason the other seven are and against the
     * same failure: it is now the load-bearing input to a whole form, and the
     * cheapest way to silence a future Form 6781 regression would be to flip
     * this row back to `'dropped'` and lower {@link expectedDroppedCount} by
     * one. Boxes 8, 9 and 10 are pinned as `'refused'` beside it, because the
     * same silencing works one disposition over.
     */
    theKnownDefectsKeepTheirDisposition: () => {
        /** @type {readonly (readonly [string, string, string])[]} */
        const pinned = [
            [oneZeroNineNineIntDialect, 'box2EarlyWithdrawalPenalty', 'read'],
            [oneZeroNineNineIntDialect, 'box6ForeignTaxPaid', 'read'],
            [w2Dialect, 'box10DependentCareBenefits', 'read'],
            [w2Dialect, 'box11NonqualifiedPlans', 'dropped'],
            [oneZeroNineNineDivDialect, 'box12ExemptInterestDividends', 'read'],
            [oneZeroNineNineDivDialect, 'box13SpecifiedPrivateActivityBondInterestDividends', 'read'],
            [ssa1099Dialect, 'box6VoluntaryFederalIncomeTaxWithheld', 'read'],
            [oneZeroNineNineBDialect, 'box11AggregateProfitOrLoss', 'read'],
            [oneZeroNineNineBDialect, 'box8ProfitOrLossRealized', 'refused'],
            [oneZeroNineNineBDialect, 'box9UnrealizedProfitOrLossPriorYearEnd', 'refused'],
            [oneZeroNineNineBDialect, 'box10UnrealizedProfitOrLossCurrentYearEnd', 'refused'],
        ]
        assertEq(
            pinned.length, 11,
            'seven known instances plus the four §1256 boxes TAX-38 wired, hand-counted')
        for (const [dialect, field, expected] of pinned) {
            const row = moneyFieldDisposition.find(
                ([rowDialect, rowField]) => rowDialect === dialect && rowField === field)
            assert(row !== undefined, ['a pinned money field left the registry', dialect, field])
            if (row === undefined) {
                continue
            }
            assertEq(
                row[2], expected,
                ['a money field this project has already paid for changed disposition',
                    dialect, field, row[2], expected])
        }
    },
}
