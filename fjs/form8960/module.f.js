/**
 * Form 8960 (TY2025) — TAX-21: Net Investment Income Tax, Parts I, II and
 * III's individual branch, every printed line named and computed.
 *
 * Source: the printed `f8960.pdf` line captions, transcribed as line numbers
 * and captions in the comments below. IRC §1411 is the statute; its
 * thresholds and its rate live in `fjs/tax/params`, never as literals here.
 *
 * 3.8% of the **lesser of** net investment income (Part III line 12) and the
 * excess of §1411's own modified adjusted gross income over a per-status
 * threshold (line 15). Both halves matter: a filer with enormous investment
 * income but income below the threshold owes nothing, and a filer far above
 * the threshold with no investment income owes nothing either. Only the
 * smaller of the two is taxed, which is why line 16 is a `min` and not a
 * product.
 *
 * ## TAX-15, and the variable this module is forbidden to name
 *
 * §1411(d)'s modified adjusted gross income is **its own measure with its
 * own add-back list** — AGI increased by the §911(a)(1) foreign earned
 * income exclusion, net of the deductions and exclusions §911(d)(6)
 * disallows — and it is not the IRA deduction's, not the Premium Tax
 * Credit's, not IRMAA's and not the student-loan-interest deduction's. That
 * is exactly what TAX-15's naming rule exists to keep true: the acronym for
 * this measure may appear in prose, in capitals, and may NEVER be a variable
 * name — a repo-wide gate at the project root fails the build on any
 * lowercase-or-mixed-case identifier spelling it, so this docstring cannot
 * even quote the forbidden spelling. The measure is therefore
 * named for what it is: {@link netInvestmentIncomeTaxThresholdIncome}, one
 * more of TAX-15's separately-named income functions beside
 * `fjs/schedule/1a`'s `seniorDeductionPhaseoutIncome`. The two are equal
 * today, and that is a coincidence of what remains unmodelled rather than a
 * shared rule — the same caution Schedule 1-A's own docstring records.
 *
 * ## A mutation finding worth keeping: three of the five statuses cannot see
 * this module read the wrong statute
 *
 * Replacing this module's `netInvestmentIncomeTaxThreshold` lookup with
 * `additionalMedicareTaxThreshold` — copying Form 8959's answer, the exact
 * error `fjs/tax/params` warns about at length — reddens **four** proof
 * leaves, not the whole Part III group. Every leaf built on a SINGLE filer
 * stays green, and correctly: §1411(b)(3) and §3101(b)(2)(C) both say
 * $200,000, so for single, head of household and married filing separately
 * the two statutes are indistinguishable by output.
 *
 * **A qualifying surviving spouse is the only filer whose return can tell
 * them apart** ($250,000 here, $200,000 there), which is why the QSS pair in
 * `proof.partIII` is not one boundary case among several — it is the entire
 * observable difference between reading the right statute and the wrong one.
 * A phase that had tested this module with single filers alone would have
 * shipped the wrong lookup with a fully green suite.
 *
 * ## What counts as net investment income here, and what deliberately does not
 *
 * Of the documents this engine models, exactly three feed Part I:
 *
 * - **Taxable interest** (line 1) — 1040 line 2b, from 1099-INT boxes 1 and 3.
 * - **Ordinary dividends** (line 2) — 1040 line 3b, from 1099-DIV box 1a.
 * - **Net gain from the disposition of property** (line 5a) — 1040 line 7a,
 *   which is Schedule D's routed result or, for a filer not filing Schedule
 *   D, 1099-DIV box 2a's capital gain distributions. It arrives already
 *   capped by §1211(b) at a $3,000 net loss ($1,500 if married filing
 *   separately), because 1040 line 7a is where that cap is applied.
 *
 * **The exclusions are where a wrong answer would be silent, so each is
 * stated with the provision that excludes it:**
 *
 * - **Tax-exempt interest is NOT net investment income.** §1411(c)(1)(A)(i)
 *   reaches interest *includible in gross income*, and §103(a) excludes
 *   municipal interest from gross income entirely. Line 1 therefore reads
 *   1040 line **2b**, never 2a. Including 2a would overstate the tax for
 *   every municipal-bond holder, and nothing in the return would say so.
 * - **Distributions from qualified retirement plans are NOT net investment
 *   income.** §1411(c)(5) excludes any distribution from a plan or
 *   arrangement described in §401(a), §403(a), §403(b), §408, §408A or
 *   §457(b) — which is every 1099-R this engine reads, whether it lands on
 *   1040 lines 4a/4b (IRA) or 5a/5b (pensions and annuities). Line 3
 *   ("Annuities") is a documented zero for that reason, not an omission.
 * - **Social Security benefits are NOT net investment income.** They are
 *   none of §1411(c)(1)'s three categories, and 1040 line 6b never reaches
 *   Part I.
 * - **Wages are NOT net investment income** either — they are what §3101(b)(2)
 *   taxes, on Form 8959, one module over. They still raise line 13, which is
 *   the only way a wage earner can owe this tax at all.
 *
 * **The one exclusion this engine may get wrong, stated rather than hidden:**
 * a NON-qualified commercial annuity IS net investment income (§1411(c)(1)(A)(i)
 * reaches annuities, and §1411(c)(5)'s exclusion list does not cover them).
 * Such a payment arrives on a Form 1099-R carrying distribution code **D** in
 * box 7a — a code the IRS added for precisely this purpose. Nothing in `fjs/`
 * reads `box7aDistributionCodes`, so this engine's line 3 stays zero for such
 * a return and **understates** the tax. That is a real gap, recorded here
 * rather than in a report nobody reads; closing it is a matter of reading one
 * box, and it belongs with whichever phase next touches `fjs/document/1099r`.
 *
 * ## Part II is zero, and one of its three lines is a gap rather than a fact
 *
 * - **Line 9a (investment interest expense) is genuinely zero.** The amount
 *   would come from Form 4952, and `investmentInterestForm4952` is a REFUSED
 *   kind — a return electing it is refused whole, before any line computes.
 * - **Line 9c (miscellaneous investment expenses) is genuinely zero.**
 *   Reg. §1.1411-4(f)(2)(ii) allows only amounts actually deductible, and
 *   §67(g) suspends every miscellaneous itemized deduction for taxable years
 *   2018 through 2025. For TY2025 the right answer really is nothing.
 * - **Line 9b (state, local and foreign income tax) is a GAP, and it makes
 *   this module OVERSTATE the tax for one kind of filer.** State income tax
 *   properly allocable to net investment income is deductible here
 *   (Reg. §1.1411-4(f)(3)(i)), capped by §164(b)(6). This engine holds a
 *   Schedule A SALT figure but has no allocation of it between investment and
 *   other income, and the regulation requires a *reasonable method* rather
 *   than a formula that could be written down here. An itemizer with both
 *   state income tax and investment income will therefore see a slightly
 *   larger figure on Schedule 2 line 12 than their preparer computes. The
 *   direction is stated because it is the direction that costs the taxpayer
 *   money, and a zero that overstates is not the same kind of zero as the
 *   two above it.
 *
 * ## Part III's estates-and-trusts branch (lines 18a-21) is not modelled
 *
 * The printed page splits Part III in two: *"Individuals, complete lines
 * 13-17. Estates and trusts, complete lines 18a-21."* Those eight lines
 * belong to a Form 1041 filer, not to a Form 1040 one, and this engine files
 * no Form 1041 — {@link Form8960Input}'s `status` is an
 * {@link IndividualFilingStatus}, so the branch is unreachable at the type
 * level rather than merely unused. That is the same boundary, drawn the same
 * way and for the same reason, that `fjs/tax/params`'
 * `netInvestmentIncomeTaxThreshold` draws when it carries no
 * `estatesAndTrusts` entry: a type says it once, where eight zeros would only
 * imply it. Lines 13-17 are the individual branch, and they are all of Part
 * III this engine has any business computing.
 *
 * ## What this module is, and what it is not
 *
 * Pure arithmetic over `bigint` cents keyed by the printed line numbers —
 * `fjs/form8959`'s own shape and boundary, and `fjs/tax/ssb`'s before it. It
 * reads NO stored document and builds no {@link ReportLine}: its caller
 * (`fjs/schedule/2`) supplies already-computed 1040 line figures, and
 * provenance is that module's job.
 *
 * @module
 */
import { assert, assertEq } from 'functionalscript/fjs/asserts/module.f.mjs'
import { of, multiply, halfUp } from '../types/rational/module.f.js'
import { centsFromString } from '../exact/module.f.js'
import { taxParamsByYear } from '../tax/params/module.f.js'

/** @import { TaxParamSet, IndividualFilingStatus } from '../tax/params/module.f.js' */

/**
 * Rounds `cents * (basisPoints / 10000)` to the nearest cent, ties away from
 * zero (the IRS half-up convention) — line 17's own 3.8% multiplication.
 *
 * Reimplemented here rather than imported from `fjs/form8959`, where it is
 * private, per this project's established "reimplement an idiom you cannot
 * import" precedent (`fjs/schedule/1a`, `fjs/schedule/b`). Basis points
 * because 3.8 is not a whole number of percent; see `fjs/tax/params`'
 * {@link netInvestmentIncomeTaxRateBasisPoints} for why that matters.
 * @type {(cents: bigint) => (basisPoints: number) => bigint}
 */
const basisPointsOfCents = cents => basisPoints =>
    halfUp(multiply(of(cents)(1n))(of(BigInt(basisPoints))(10000n)))

/**
 * TAX-15's named income function for **§1411(d)'s** modified adjusted gross
 * income — Form 8960 Part III line 13. Its own add-back list, per the
 * statute:
 *
 * - The §911(a)(1) foreign earned income exclusion, **net of** the deductions
 *   and exclusions §911(d)(6) disallows. `foreignEarnedIncomeForm2555` is a
 *   REFUSED kind (`fjs/return/scope`), so a return claiming it is refused
 *   whole and this add-back is zero for every return this engine can compute.
 *
 * That single add-back is the entire difference between §1411's measure and
 * bare AGI — which is why this function currently returns its argument, and
 * why it exists anyway. Naming it is what keeps §1411's list distinct from
 * the IRA deduction's, the Premium Tax Credit's and IRMAA's, none of which
 * this engine may assume are the same measure (TAX-15). See this module's own
 * docstring for the naming rule that forbids the obvious alternative.
 *
 * Reads the ALREADY-COMPUTED AGI as its input rather than re-deriving it from
 * stored documents — `fjs/schedule/1a`'s `seniorDeductionPhaseoutIncome`
 * precedent exactly.
 * @type {(agiCents: bigint) => bigint}
 */
export const netInvestmentIncomeTaxThresholdIncome = agiCents => {
    // The one add-back, per §1411(d)(1)/(2) -- always zero here; see this
    // function's own docstring.
    const section911ForeignEarnedIncomeExclusionNetOfDisallowedDeductions = 0n
    return agiCents + section911ForeignEarnedIncomeExclusionNetOfDisallowedDeductions
}

// ── Part I: Investment Income (lines 1-8) ───────────────────────────────────

/**
 * @typedef {{
 *   readonly line1: bigint, readonly line2: bigint, readonly line3: bigint,
 *   readonly line4a: bigint, readonly line4b: bigint, readonly line4c: bigint,
 *   readonly line5a: bigint, readonly line5b: bigint, readonly line5c: bigint,
 *   readonly line5d: bigint, readonly line6: bigint, readonly line7: bigint,
 *   readonly line8: bigint,
 * }} Form8960PartI
 */

/**
 * `rentalRealEstateAndRoyaltyIncomeCents` is printed Schedule E line 26 — the
 * Part I total this engine computes — and it is a REQUIRED parameter rather
 * than an optional one for the reason every other required list on this
 * project is: a caller that cannot supply it is a caller that would emit a
 * Form 8960 silently short by a landlord's whole rental income, and printed
 * line 4a's own text is *"Rental real estate, royalties, partnerships, S
 * corporations, trusts, etc."*
 * @typedef {{
 *   readonly taxableInterestCents: bigint,
 *   readonly ordinaryDividendsCents: bigint,
 *   readonly netCapitalGainOrLossCents: bigint,
 *   readonly rentalRealEstateAndRoyaltyIncomeCents: bigint,
 * }} Form8960PartIInput
 */

/**
 * Form 8960 Part I, lines 1-8 — total investment income. See this module's
 * own docstring for what each documented zero excludes and by which
 * provision.
 * @type {(input: Form8960PartIInput) => Form8960PartI}
 */
export const form8960PartI = input => {
    const {
        taxableInterestCents, ordinaryDividendsCents, netCapitalGainOrLossCents,
        rentalRealEstateAndRoyaltyIncomeCents,
    } = input
    // 1. "Taxable interest" -- 1040 line 2b. NOT line 2a: §103(a) keeps
    //    tax-exempt interest out of gross income, so §1411(c)(1)(A)(i) never
    //    reaches it.
    const line1 = taxableInterestCents
    // 2. "Ordinary dividends" -- 1040 line 3b.
    const line2 = ordinaryDividendsCents
    // 3. "Annuities." Zero: §1411(c)(5) excludes distributions from §401(a)/
    //    403(a)/403(b)/408/408A/457(b) plans, which is every 1099-R this
    //    engine reads. A NON-qualified annuity (1099-R box 7a code D) would
    //    belong here and is the one exclusion this engine may get wrong --
    //    see this module's own docstring.
    const line3 = 0n
    // 4a. "Rental real estate, royalties, partnerships, S corporations,
    //     trusts, etc." Zero, and as of Phase 30 it is zero for a REASON
    //     rather than for want of a Schedule E.
    //
    //     `fjs/schedule/e` exists and computes Part II, so a Schedule K-1's
    //     box 1 now reaches Schedule 1 line 5. It cannot reach THIS line,
    //     because §1411(c)(2)(A) makes only a PASSIVE trade or business's
    //     income net investment income and §1411(c)(6) then removes whatever
    //     was taken into account in determining self-employment income. That
    //     leaves exactly one shape of amount for line 4a — passive
    //     pass-through income not covered by self-employment tax — and
    //     `fjs/schedule/e`'s `passiveIncomeOutsideSelfEmploymentRefusal`
    //     REFUSES it by name, naming this line. So every return this engine
    //     computes has an honest $0.00 here, and every return that would not
    //     has been stopped.
    //
    //     Of Schedule E's other four parts, TWO are still their own REFUSED
    //     `fjs/return/scope` kind — `remicResidualInterest` (Part IV) and
    //     `netFarmRentalIncomeForm4835` (Part V line 40) — and two are NOT:
    //     `rentalRealEstateAndRoyalties` (Part I) and `estateAndTrustIncome`
    //     (Part III) both became modeled kinds, which is what put a real
    //     figure on line 4a below and what makes Part III the gap recorded
    //     there. This paragraph said all four refused until printed Part I
    //     shipped; it had been wrong about Part III since TAX-35.
    //
    //     **Phase 27's Schedule C does NOT reach this line**, and that is
    //     worth stating where it could be assumed otherwise: §1411(c)(2)(A)
    //     excludes income from a trade or business the taxpayer materially
    //     participates in, and Schedule 1 line 3 is not one of the §1411
    //     categories at all. A sole proprietor's net profit is subject to
    //     self-employment tax (Phase 28), not to the net investment income
    //     tax. What business income CAN reach line 4a is a passive activity
    //     or a §1411(c)(2)(B) trading business, and both arrive on Schedule E
    //     rather than Schedule C.
    //
    //     **Schedule E PART I is no longer among the refused kinds, and this
    //     line is the reason that wiring could not be shipped without touching
    //     Form 8960.** `fjs/form8960` is computed UNCONDITIONALLY (see
    //     `fjs/schedule/2` line 12: "no tripwire watches §1411's threshold"),
    //     so a landlord's rent would have entered line 13's modified adjusted
    //     gross income while leaving line 8's investment income short — and
    //     line 17 takes the LESSER of the two, so the tax would have been
    //     silently understated for every filer above the threshold. Rents and
    //     royalties are named in §1411(c)(1)(A)(i) itself, and §469(c)(2)
    //     makes a rental activity passive whatever the taxpayer's
    //     involvement, so the printed line's own words — "Rental real estate,
    //     royalties, partnerships, S corporations, trusts, etc." — are the
    //     rule and Schedule E line 26 is the figure.
    //
    //     **PART III WAS RECORDED HERE AS A KNOWN GAP, AND IT IS NOT ONE.**
    //     That note said a beneficiary's box 6 share "does NOT reach this line
    //     because §1411(c)(1)(A)(ii) turns on whether the ESTATE OR TRUST's
    //     activity was passive to the beneficiary, which is
    //     `beneficiaryRow`'s material-participation determination and is not
    //     carried out of Schedule E today". **The conclusion was right and the
    //     reason was wrong** — and the reason is the half a later phase would
    //     have acted on, by carrying the determination out and wiring line 37
    //     here. Doing that would have taxed income §1411 does not reach.
    //
    //     The determination does not need to leave Schedule E, because every
    //     row for which it would matter is REFUSED before Schedule E
    //     finishes. Printed line 33's four columns, one at a time:
    //
    //     - **(c) and (e)**, the deduction and loss columns, are structural
    //       zeros: a negative box 6 refuses at `beneficiaryLossRefusal`, and
    //       box 9's directly apportioned deductions refuse at
    //       `estateTrustCodedBoxes`. Nothing can put a figure in either, so
    //       printed line 36 is zero and line 37 restates line 35.
    //     - **(d)**, PASSIVE income, is the column §1411(c)(2)(A) taxes — and
    //       a beneficiary's self-employment term is structurally `0n`
    //       (§1402(a) reaches a trade or business carried on BY the taxpayer),
    //       so `passiveIncomeOutsideSelfEmploymentRefusal` fires for any
    //       positive box 6 in it and the return stops. The column can only
    //       ever total $0.00. That is a REFUSAL, not an assumption, which is
    //       this project's preferred answer to an input it cannot place.
    //     - **(f)**, other income, carries real money and is not net
    //       investment income: §1411(c)(2) reaches only a passive activity or
    //       a trading business, and a beneficiary in column (f) is in neither.
    //
    //     **The one channel that remains is the fiduciary's own figure, and
    //     it does not arrive on this line at all.** i8960 (2025) p.13, *Line
    //     7 — Other Modifications to Investment Income*: *"Distributions from
    //     estates and trusts. Enter the amount from box 14, code H, of
    //     Schedule K-1 (Form 1041)"* — with p.8's own Note under line 4b
    //     saying expressly that Part III adjustments go to line 7 and *"Don't
    //     report those adjustments on line 4b."* `estateTrustCodedBoxes`
    //     refuses ANY box 14 content by name, so a K-1 carrying code H stops
    //     the return rather than leaving line 7 quietly at zero.
    //
    //     All three are now PROVED end to end rather than argued here, in
    //     `fjs/form1040/core` where a wiring can be proved at all:
    //     `aBeneficiarysNonpassiveShareRaisesAgiAndIsNotNetInvestmentIncome`
    //     (the same $258,050.00 AGI as the rental leaf, and $0.00 of tax),
    //     `aPassiveBeneficiarysShareRefusesRatherThanLeavingLineFourAAZero`
    //     and
    //     `aBeneficiarysBoxFourteenRefusesSoFormEightNineSixtyLineSevenCannotBeMissed`.
    //     Before them, rewiring this line to Schedule E line 41 — exactly what
    //     the stale note invited — reddened NOTHING in a 2,861-proof suite.
    //
    //     ## What the printed instruction says this line is, and why line 26
    //     ## is nonetheless the right figure here
    //
    //     i8960 p.8 does not say "Schedule E line 26". It says *"Enter the
    //     following amount from your properly completed return: Schedule 1
    //     (Form 1040), line 3 … line 5 … line 6"* — the WHOLE of Schedules C,
    //     E and F — and then removes what §1411 does not reach on line 4b
    //     (*"Net income or loss from a section 162 trade or business that's
    //     not a passive activity"*; *"…that's taken into account in
    //     determining self-employment income"*) and, for Part III, on line 7.
    //     This module's line 4a and the paper's therefore differ in
    //     PRESENTATION, and agree to the cent in the only figure that leaves
    //     the form:
    //
    //     - Schedule 1 line 3 (Schedule C) enters 4a and leaves again on 4b —
    //       it is nonpassive and self-employment-taxed, both 4b bullets.
    //     - Schedule 1 line 5's other summands: line 32 is Part II, where the
    //       same `passiveIncomeOutsideSelfEmploymentRefusal` bites; line 37 is
    //       Part III, above; lines 39 and 40 are `remicResidualInterest` and
    //       `netFarmRentalIncomeForm4835`, both REFUSED kinds.
    //     - Schedule 1 line 6 is `farmIncomeOrLoss`, a REFUSED kind.
    //
    //     So every summand the paper adds on 4a, this engine either subtracts
    //     again on 4b/line 7 or refuses outright, and printed Schedule E line
    //     26 is what is left. Writing the paper's fuller form would move no
    //     figure and would add two computed subtractions whose value is
    //     provably zero; it is recorded here because the NEXT reader should
    //     know 4a's printed source is Schedule 1 rather than Schedule E, and
    //     because the day any of those refusals is lifted this paragraph is
    //     the checklist.
    const line4a = rentalRealEstateAndRoyaltyIncomeCents
    // 4b. "Adjustment for net income or loss derived in the ordinary course
    //     of a non-section 1411 trade or business." Zero, and it is a
    //     STRUCTURAL zero rather than an assumption: the one Schedule E Part I
    //     column whose income Reg. §1.1411-4(g)(6) removes from net investment
    //     income is a SELF-RENTAL (printed type code 7), and
    //     `fjs/schedule/e/part_i` refuses one by name — so no amount that
    //     belongs on this line can reach line 4a in the first place.
    const line4b = 0n
    // 4c. "Combine lines 4a and 4b."
    const line4c = line4a + line4b
    // 5a. "Net gain or loss from disposition of property" -- 1040 line 7a,
    //     already capped by §1211(b) where it was computed.
    const line5a = netCapitalGainOrLossCents
    // 5b. "Net gain or loss from disposition of property that is not subject
    //     to net investment income tax." Zero: every disposition this engine
    //     sees arrives on a 1099-B or as a 1099-DIV capital gain
    //     distribution, and both are dispositions of investment property by
    //     construction. There is no active-business interest and no §121 home
    //     sale to back out.
    const line5b = 0n
    // 5c. "Adjustment from disposition of partnership interest or S
    //     corporation stock." Zero: no Schedule K-1 dialect (Phase 30).
    const line5c = 0n
    // 5d. "Combine lines 5a through 5c."
    const line5d = line5a + line5b + line5c
    // 6. "Adjustments to investment income for certain CFCs and PFICs." Zero:
    //    no dialect models a controlled foreign corporation or a passive
    //    foreign investment company.
    const line6 = 0n
    // 7. "Other modifications to investment income." Zero, and ONE of the
    //    items i8960 p.13 lists for it is reachable enough to name: *"Distributions
    //    from estates and trusts. Enter the amount from box 14, code H, of
    //    Schedule K-1 (Form 1041)"* — the fiduciary's own statement of how
    //    much of a beneficiary's share is net investment income, and (per
    //    p.8's Note under line 4b) the ONLY prescribed way to adjust for
    //    Schedule E Part III. `fjs/schedule/e`'s `estateTrustCodedBoxes`
    //    refuses any box 14 content, so a K-1 that would fill this line stops
    //    the return instead. Everything else p.13 lists — a §1411 net
    //    operating loss, Form 8814, self-charged interest, §404(k) dividends,
    //    deduction recoveries — arrives on a document or an election no
    //    dialect models.
    const line7 = 0n
    // 8. "Total investment income. Combine lines 1, 2, 3, 4c, 5d, 6, and 7."
    //    Every term is added, including the documented zeros, so a future
    //    non-zero line cannot be silently dropped on the way to the total.
    const line8 = line1 + line2 + line3 + line4c + line5d + line6 + line7
    return { line1, line2, line3, line4a, line4b, line4c, line5a, line5b, line5c, line5d, line6, line7, line8 }
}

// ── Part II: Investment Expenses and Modifications (lines 9a-11) ─────────────

/**
 * @typedef {{
 *   readonly line9a: bigint, readonly line9b: bigint, readonly line9c: bigint,
 *   readonly line9d: bigint, readonly line10: bigint, readonly line11: bigint,
 * }} Form8960PartII
 */

/**
 * Form 8960 Part II, lines 9a-11 — deductions and modifications. All zero
 * today, but for THREE different reasons, one of which is a gap that
 * overstates the tax; see this module's own docstring, "Part II is zero, and
 * one of its three lines is a gap rather than a fact."
 * @type {() => Form8960PartII}
 */
export const form8960PartII = () => {
    // 9a. "Investment interest expenses." Zero: the amount comes from Form
    //     4952, and `investmentInterestForm4952` is a REFUSED kind.
    const line9a = 0n
    // 9b. "State, local, and foreign income tax." Zero -- and this is the GAP
    //     that OVERSTATES the tax for an itemizer with state income tax and
    //     investment income. Reg. §1.1411-4(f)(3)(i) allows the portion
    //     properly allocable to net investment income, by a reasonable
    //     method; this engine has a Schedule A SALT figure but no allocation.
    const line9b = 0n
    // 9c. "Miscellaneous investment expenses." GENUINELY zero for TY2025:
    //     §67(g) suspends every miscellaneous itemized deduction for taxable
    //     years 2018 through 2025, and Reg. §1.1411-4(f)(2)(ii) allows only
    //     amounts actually deductible.
    const line9c = 0n
    // 9d. "Add lines 9a, 9b, and 9c."
    const line9d = line9a + line9b + line9c
    // 10. "Additional modifications." Zero.
    const line10 = 0n
    // 11. "Total deductions and modifications. Add lines 9d and 10."
    const line11 = line9d + line10
    return { line9a, line9b, line9c, line9d, line10, line11 }
}

// ── Part III: Tax Computation, individual branch (lines 12-17) ──────────────

/**
 * @typedef {{
 *   readonly line12: bigint, readonly line13: bigint, readonly line14: bigint,
 *   readonly line15: bigint, readonly line16: bigint, readonly line17: bigint,
 * }} Form8960PartIII
 */

/**
 * @typedef {{
 *   readonly status: IndividualFilingStatus,
 *   readonly agiCents: bigint,
 *   readonly partILine8: bigint,
 *   readonly partIILine11: bigint,
 * }} Form8960PartIIIInput
 */

/**
 * Form 8960 Part III lines 12-17 — the INDIVIDUAL branch of the tax
 * computation. Lines 18a-21 are the estates-and-trusts branch and are not
 * modelled; see this module's own docstring for why the type, not a zero,
 * is what draws that boundary.
 * @type {(taxParamSet: TaxParamSet) => (input: Form8960PartIIIInput) => Form8960PartIII}
 */
export const form8960PartIII = taxParamSet => input => {
    const { status, agiCents, partILine8, partIILine11 } = input
    // 12. "Net investment income. Subtract Part II, line 11 from Part I, line
    //     8. ... If zero or less, enter -0-." The floor is NOT absorbed by
    //     line 16's `min` below: line 15 is never negative, so a negative
    //     line 12 would win the `min` and produce a NEGATIVE tax. A net
    //     capital loss is exactly the input that reaches it -- see
    //     `proof.partIII.aNetCapitalLossFloorsNetInvestmentIncomeAtZero`.
    const line12 = partILine8 > partIILine11 ? partILine8 - partIILine11 : 0n
    // 13. "Modified adjusted gross income" -- §1411(d)'s own measure, through
    //     its own named function (TAX-15).
    const line13 = netInvestmentIncomeTaxThresholdIncome(agiCents)
    // 14. "Threshold based on filing status" -- §1411(b). A DIFFERENT statute
    //     from Form 8959's, and a different answer for a qualifying surviving
    //     spouse; `fjs/tax/params` records the disagreement in full.
    const line14 = centsFromString(taxParamSet.netInvestmentIncomeTaxThreshold[status].amount)
    // 15. "Subtract line 14 from line 13. If zero or less, enter -0-."
    const line15 = line13 > line14 ? line13 - line14 : 0n
    // 16. "Enter the smaller of line 12 or line 15." THE lesser-of rule --
    //     the whole shape of this tax.
    const line16 = line12 < line15 ? line12 : line15
    // 17. "Net investment income tax for individuals. Multiply line 16 by
    //     3.8% (0.038)." -> Schedule 2 line 12 -> 1040 line 23.
    const line17 = basisPointsOfCents(line16)(taxParamSet.netInvestmentIncomeTaxRateBasisPoints)
    return { line12, line13, line14, line15, line16, line17 }
}

// ── The whole form ──────────────────────────────────────────────────────────

/**
 * @typedef {{
 *   readonly status: IndividualFilingStatus,
 *   readonly agiCents: bigint,
 *   readonly taxableInterestCents: bigint,
 *   readonly ordinaryDividendsCents: bigint,
 *   readonly netCapitalGainOrLossCents: bigint,
 *   readonly rentalRealEstateAndRoyaltyIncomeCents: bigint,
 * }} Form8960Input
 */

/**
 * Every printed line of Form 8960's individual path, flat, keyed by its own
 * number — `fjs/form8959`'s own shape, for the reason recorded there.
 * @typedef {Form8960PartI & Form8960PartII & Form8960PartIII} Form8960
 */

/**
 * Computes Form 8960 for one individual return. Line 17 is the figure that
 * reaches **Schedule 2 line 12 -> 1040 line 23**.
 * @type {(taxParamSet: TaxParamSet) => (input: Form8960Input) => Form8960}
 */
export const form8960 = taxParamSet => input => {
    const {
        status, agiCents, taxableInterestCents, ordinaryDividendsCents, netCapitalGainOrLossCents,
        rentalRealEstateAndRoyaltyIncomeCents,
    } = input
    const partI = form8960PartI({
        taxableInterestCents, ordinaryDividendsCents, netCapitalGainOrLossCents,
        rentalRealEstateAndRoyaltyIncomeCents,
    })
    const partII = form8960PartII()
    const partIII = form8960PartIII(taxParamSet)({
        status, agiCents, partILine8: partI.line8, partIILine11: partII.line11,
    })
    assert(partIII.line17 >= 0n, ['Form 8960 line 17 must never be negative', partIII.line17])
    return { ...partI, ...partII, ...partIII }
}

// ── Tests ────────────────────────────────────────────────────────────────────

/**
 * TY2025's parameter set, narrowed exactly once at module scope — the same
 * `assert` path every other consumer uses.
 */
const taxParams2025 = taxParamsByYear[2025]
assert(taxParams2025 !== undefined, 'expected TY2025 parameters to be present in taxParamsByYear')

/**
 * Runs the whole form against TY2025's real parameter set.
 * @type {(status: IndividualFilingStatus) => (agiCents: bigint) => (income: { readonly taxableInterestCents?: bigint, readonly ordinaryDividendsCents?: bigint, readonly netCapitalGainOrLossCents?: bigint, readonly rentalRealEstateAndRoyaltyIncomeCents?: bigint }) => Form8960}
 */
const run = status => agiCents => income => form8960(taxParams2025)({
    status,
    agiCents,
    taxableInterestCents: income.taxableInterestCents ?? 0n,
    ordinaryDividendsCents: income.ordinaryDividendsCents ?? 0n,
    netCapitalGainOrLossCents: income.netCapitalGainOrLossCents ?? 0n,
    rentalRealEstateAndRoyaltyIncomeCents: income.rentalRealEstateAndRoyaltyIncomeCents ?? 0n,
})

/** Every individual filing status, hand-typed so a status dropped from
 * `fjs/tax/params`' own exported list still fails the loops below.
 * @type {readonly IndividualFilingStatus[]}
 */
const everyStatus = [
    'single',
    'marriedFilingJointly',
    'marriedFilingSeparately',
    'headOfHousehold',
    'qualifyingSurvivingSpouse',
]

/**
 * The hand-typed §1411(b) threshold, in CENTS, per status — written out here
 * rather than read from `fjs/tax/params`, so a boundary proof whose boundary
 * came from the code under test cannot exist.
 *
 * The qualifying-surviving-spouse row is **$250,000**, the JOINT figure,
 * because §1411(b)(1) reads "a joint return under section 6013 **or a
 * surviving spouse (as defined in section 2(a))**". Form 8959's own
 * threshold, one module over, gives the same filer $200,000 — the two
 * statutes genuinely disagree, and this is the row that says so.
 * @type {Record<IndividualFilingStatus, bigint>}
 */
const thresholdCents = {
    single: 20000000n,
    marriedFilingJointly: 25000000n,
    marriedFilingSeparately: 12500000n,
    headOfHousehold: 20000000n,
    qualifyingSurvivingSpouse: 25000000n,
}

export const proof = {
    partI: {
        // The three real inputs, summed into line 8 with every documented
        // zero in between. $5,000 of taxable interest + $10,000 of ordinary
        // dividends + $25,000 of capital gain = $40,000 of investment income,
        // hand-added.
        theThreeModelledIncomesSumIntoLineEight: () => {
            const result = run('single')(30000000n)({
                taxableInterestCents: 500000n,
                ordinaryDividendsCents: 1000000n,
                netCapitalGainOrLossCents: 2500000n,
            })
            assertEq(result.line1, 500000n, 'line 1 = $5,000.00 of taxable interest (1040 line 2b)')
            assertEq(result.line2, 1000000n, 'line 2 = $10,000.00 of ordinary dividends (1040 line 3b)')
            assertEq(result.line5a, 2500000n, 'line 5a = $25,000.00 of capital gain (1040 line 7a)')
            assertEq(result.line8, 4000000n, 'line 8 = $40,000.00 = $5,000 + $10,000 + $25,000')
        },
        /**
         * ★ **PRINTED LINE 4A IS NOT A ZERO ONCE SCHEDULE E PART I COMPUTES.**
         * §1411(c)(1)(A)(i) names *"rents"* and *"royalties"* outright, and
         * §469(c)(2) makes a rental activity passive whatever the taxpayer's
         * involvement, so printed Schedule E line 26 is what printed line 4a's
         * own text — *"Rental real estate, royalties, partnerships, S
         * corporations, trusts, etc."* — asks for.
         *
         * Hand-computed, single filer, no other investment income:
         *
         * ```
         *   4a  Schedule E line 26                     50,000.00
         *    8  total investment income                50,000.00
         *   12  less line 11 (zero)                    50,000.00
         *   13  modified adjusted gross income        300,000.00
         *   14  §1411(b) threshold, single            200,000.00
         *   15  300,000.00 - 200,000.00               100,000.00
         *   16  the SMALLER of line 12 and line 15     50,000.00
         *   17  3.8% of 50,000.00                       1,900.00
         * ```
         *
         * The last row is the point: without line 4a, line 12 would be zero,
         * line 16 would be zero and line 17 would be **$0.00** — a landlord
         * above the threshold paying no net investment income tax at all,
         * silently, because Form 8960 runs unconditionally and no tripwire
         * watches §1411.
         */
        rentalAndRoyaltyIncomeReachesLineFourAAndTheTax: () => {
            const result = run('single')(30000000n)({
                rentalRealEstateAndRoyaltyIncomeCents: 5000000n,
            })
            assertEq(result.line4a, 5000000n, 'line 4a = $50,000.00 of Schedule E line 26')
            assertEq(result.line4b, 0n, 'line 4b = $0.00 -- a self-rental refuses at fjs/schedule/e/part_i')
            assertEq(result.line4c, 5000000n, 'line 4c = $50,000.00')
            assertEq(result.line8, 5000000n, 'line 8 = $50,000.00')
            assertEq(result.line15, 10000000n, 'line 15 = $100,000.00 above the $200,000.00 threshold')
            assertEq(result.line16, 5000000n, 'line 16 = the SMALLER of $50,000.00 and $100,000.00')
            assertEq(result.line17, 190000n, 'line 17 = 3.8% of $50,000.00 = $1,900.00')
            // THE CONTROL: the identical filer with no rental at all owes
            // nothing, so the leaf above is evidence about line 4a rather than
            // about the threshold arithmetic.
            const without = run('single')(30000000n)({})
            assertEq(without.line4a, 0n)
            assertEq(without.line17, 0n, 'no investment income of any kind, so no tax')
        },
        // Every documented zero, asserted individually so erasing the reason
        // for any one of them names itself -- and line 8 asserted to be the
        // sum of ALL seven addends the printed form lists, so a future
        // non-zero line cannot be dropped on the way to the total.
        everyUnmodelledPartOneLineIsZeroAndLineEightStillAddsThemAll: () => {
            const result = run('single')(30000000n)({
                taxableInterestCents: 500000n,
                ordinaryDividendsCents: 1000000n,
                netCapitalGainOrLossCents: 2500000n,
            })
            assertEq(result.line3, 0n, 'line 3 = $0.00 -- §1411(c)(5) excludes qualified-plan distributions')
            assertEq(
                result.line4a,
                0n,
                'line 4a = $0.00 for a filer with NO Schedule E Part I -- §1411(c)(6) excludes '
                + 'self-employment income and fjs/schedule/e refuses passive pass-through income '
                + 'that it does not cover')
            assertEq(result.line4b, 0n, 'line 4b = $0.00')
            assertEq(result.line4c, 0n, 'line 4c = $0.00')
            assertEq(result.line5b, 0n, 'line 5b = $0.00 -- every disposition here is investment property')
            assertEq(result.line5c, 0n, 'line 5c = $0.00 -- no partnership or S corporation interest')
            assertEq(result.line5d, result.line5a, 'line 5d restates line 5a when 5b and 5c are zero')
            assertEq(result.line6, 0n, 'line 6 = $0.00 -- no CFC or PFIC')
            assertEq(result.line7, 0n, 'line 7 = $0.00')
            assertEq(
                result.line8,
                result.line1 + result.line2 + result.line3 + result.line4c + result.line5d + result.line6 + result.line7,
                'line 8 must combine all seven addends the printed form names',
            )
        },
    },
    partII: {
        // All six lines zero, for the three different reasons this module's
        // docstring separates -- and line 11 asserted to be the sum, so a
        // future non-zero deduction reaches line 12 rather than vanishing.
        everyDeductionLineIsZeroAndLineElevenStillAddsThem: () => {
            const result = run('single')(30000000n)({ taxableInterestCents: 500000n })
            assertEq(result.line9a, 0n, 'line 9a = $0.00 -- `investmentInterestForm4952` refuses')
            assertEq(result.line9b, 0n, 'line 9b = $0.00 -- the SALT-allocation gap, which OVERSTATES the tax')
            assertEq(result.line9c, 0n, 'line 9c = $0.00 -- §67(g) suspends it through 2025')
            assertEq(result.line9d, result.line9a + result.line9b + result.line9c, 'line 9d adds all three')
            assertEq(result.line10, 0n, 'line 10 = $0.00')
            assertEq(result.line11, result.line9d + result.line10, 'line 11 = 9d + 10')
            assertEq(result.line11, 0n, 'line 11 = $0.00 today')
        },
    },
    partIII: {
        // THE EXCESS-INCOME BRANCH OF THE `min`. A single filer with
        // $300,000 of AGI and $40,000 of investment income: the excess over
        // the threshold is $100,000, the investment income is $40,000, and
        // the smaller of the two is taxed.
        //   3.8% of $40,000.00 = 4,000,000 * 380 / 10,000 = 152,000 cents
        theSmallerIsTheInvestmentIncome: () => {
            const result = run('single')(30000000n)({
                taxableInterestCents: 500000n,
                ordinaryDividendsCents: 1000000n,
                netCapitalGainOrLossCents: 2500000n,
            })
            assertEq(result.line12, 4000000n, 'line 12 = $40,000.00 of net investment income')
            assertEq(result.line13, 30000000n, 'line 13 = $300,000.00 (§1411(d) adds nothing back here)')
            assertEq(result.line14, 20000000n, 'line 14 = $200,000.00, single\'s §1411(b)(3) threshold')
            assertEq(result.line15, 10000000n, 'line 15 = $100,000.00 of excess income')
            assertEq(result.line16, 4000000n, 'line 16 = $40,000.00 -- the investment income is the smaller')
            assertEq(result.line17, 152000n, 'line 17 = $1,520.00 = 3.8% of $40,000.00 -> Schedule 2 line 12')
        },
        // THE OTHER BRANCH, and it must be a separate leaf: the SAME $40,000
        // of investment income at $210,000 of AGI is taxed on only the
        // $10,000 of excess income. A `min` written as a `max`, or dropped
        // altogether, passes one of these two leaves and fails the other.
        //   3.8% of $10,000.00 = 1,000,000 * 380 / 10,000 = 38,000 cents
        theSmallerIsTheExcessIncome: () => {
            const result = run('single')(21000000n)({
                taxableInterestCents: 500000n,
                ordinaryDividendsCents: 1000000n,
                netCapitalGainOrLossCents: 2500000n,
            })
            assertEq(result.line12, 4000000n, 'line 12 = $40,000.00, unchanged')
            assertEq(result.line15, 1000000n, 'line 15 = $10,000.00 = $210,000.00 - $200,000.00')
            assertEq(result.line16, 1000000n, 'line 16 = $10,000.00 -- the excess income is now the smaller')
            assertEq(result.line17, 38000n, 'line 17 = $380.00 = 3.8% of $10,000.00')
        },
        // THE REGRESSION CONTROL, and it matters more than either gate above:
        // a filer with real investment income whose income is BELOW the
        // threshold owes nothing at all. Every return this engine could
        // already compute is in this case, so wiring this form must not move
        // a single existing figure. One dollar below each hand-typed
        // threshold, for every status.
        oneDollarBelowEveryStatusThresholdIsZero: () => {
            for (const status of everyStatus) {
                const result = run(status)(thresholdCents[status] - 100n)({
                    taxableInterestCents: 500000n,
                    ordinaryDividendsCents: 1000000n,
                    netCapitalGainOrLossCents: 2500000n,
                })
                assertEq(result.line12, 4000000n, ['line 12 still reports the real investment income', status])
                assertEq(result.line15, 0n, ['one dollar below the threshold: no excess income', status])
                assertEq(result.line16, 0n, ['one dollar below the threshold: nothing to tax', status])
                assertEq(result.line17, 0n, ['one dollar below the threshold: no tax', status])
            }
        },
        // THE OTHER HALF OF THE `min`, as its own control: income far above
        // the threshold with NO investment income owes nothing either. Both
        // halves of "the lesser of" have to be able to produce the zero, and
        // a proof of only one of them would pass an implementation that
        // taxed excess income outright.
        incomeFarAboveTheThresholdWithNoInvestmentIncomeIsZero: () => {
            const result = run('single')(50000000n)({})
            assertEq(result.line12, 0n, 'line 12 = $0.00 -- no investment income at all')
            assertEq(result.line15, 30000000n, 'line 15 = $300,000.00 of excess income')
            assertEq(result.line16, 0n, 'line 16 = $0.00 -- the investment income is the smaller')
            assertEq(result.line17, 0n, 'line 17 = $0.00 -- a wage earner with no investments owes nothing')
        },
        // THE FLOOR ON LINE 12, and it is NOT absorbed by line 16's `min`.
        // A filer with a net capital loss has NEGATIVE Part I income; line 15
        // is never negative, so an unfloored line 12 would WIN the `min` and
        // yield a negative tax. $3,000.00 is the §1211(b) cap 1040 line 7a
        // already applies, so this is the largest loss that can arrive here.
        //   without the floor: 3.8% of -$3,000.00 = -11,400 cents = -$114.00
        aNetCapitalLossFloorsNetInvestmentIncomeAtZero: () => {
            const result = run('single')(30000000n)({ netCapitalGainOrLossCents: -300000n })
            assertEq(result.line5a, -300000n, 'line 5a = -$3,000.00, the §1211(b)-capped net loss')
            assertEq(result.line8, -300000n, 'line 8 = -$3,000.00 -- Part I really does go negative')
            assertEq(result.line12, 0n, 'line 12 = $0.00, floored -- never -$3,000.00')
            assertEq(result.line15, 10000000n, 'line 15 = $100,000.00, which an unfloored line 12 would beat')
            assertEq(result.line16, 0n, 'line 16 = $0.00')
            assertEq(result.line17, 0n, 'line 17 = $0.00, never -$114.00')
        },
        // A LOSS THAT ONLY PARTLY OFFSETS: $10,000 of dividends against a
        // $3,000 loss is $7,000 of net investment income, not zero and not
        // $10,000. The floor must not swallow a real figure, which is what
        // this leaf and the one above prove between them.
        //   3.8% of $7,000.00 = 700,000 * 380 / 10,000 = 26,600 cents
        aLossOffsetsOtherInvestmentIncomeWithoutFlooringIt: () => {
            const result = run('single')(30000000n)({
                ordinaryDividendsCents: 1000000n,
                netCapitalGainOrLossCents: -300000n,
            })
            assertEq(result.line8, 700000n, 'line 8 = $7,000.00 = $10,000.00 - $3,000.00')
            assertEq(result.line12, 700000n, 'line 12 = $7,000.00 -- the floor does not fire')
            assertEq(result.line17, 26600n, 'line 17 = $266.00 = 3.8% of $7,000.00')
        },
        // THE §1411 STATUS TRAP, and the pair that tells the two statutes
        // apart. At $240,000 of income with $50,000 of investment income:
        //   - a QUALIFYING SURVIVING SPOUSE is below §1411(b)(1)'s $250,000
        //     and owes NOTHING -- the joint figure, because the statute names
        //     "a surviving spouse (as defined in section 2(a))" beside the
        //     joint return;
        //   - a HEAD OF HOUSEHOLD, at the identical figures, is $40,000 above
        //     §1411(b)(3)'s $200,000 and owes 3.8% of $40,000 = $1,520.00.
        // Had this module read Form 8959's §3101(b)(2) threshold for a QSS
        // filer ($200,000), the first half would compute $1,520.00 too. That
        // is the exact copy-the-neighbouring-statute error this leaf refuses.
        aQualifyingSurvivingSpouseGetsTheJointThresholdUnlikeFormEightNineFiveNine: () => {
            /** @type {{ readonly taxableInterestCents: bigint }} */
            const investmentIncome = { taxableInterestCents: 5000000n }
            const qss = run('qualifyingSurvivingSpouse')(24000000n)(investmentIncome)
            const hoh = run('headOfHousehold')(24000000n)(investmentIncome)
            const mfj = run('marriedFilingJointly')(24000000n)(investmentIncome)
            assertEq(qss.line14, 25000000n, 'QSS threshold = $250,000.00 (§1411(b)(1), the surviving-spouse clause)')
            assertEq(qss.line15, 0n, 'QSS: $240,000.00 is below $250,000.00')
            assertEq(qss.line17, 0n, 'QSS: no tax')
            assertEq(hoh.line14, 20000000n, 'HoH threshold = $200,000.00 (§1411(b)(3), "any other case")')
            assertEq(hoh.line15, 4000000n, 'HoH: $40,000.00 of excess income')
            assertEq(hoh.line17, 152000n, 'HoH: $1,520.00 = 3.8% of $40,000.00')
            assertEq(qss.line14, mfj.line14, 'a surviving spouse really does get the JOINT threshold here')
        },
        // THE BOUNDARY TRIO on line 15, the same shape Form 8959's Part I
        // uses. "Subtract line 14 from line 13. If zero or less, enter -0-",
        // so exactly AT the threshold there is no excess. One cent above,
        // line 15 moves to $0.01 -- but 3.8% of a cent is 0.038 cents, below
        // the half-cent rounding threshold, so line 17 is still $0.00.
        // Fourteen cents of excess is the first amount whose tax rounds to a
        // cent (3.8% of 14 cents = 0.532 cents, which half-up rounds to 1).
        boundaryTrio: () => {
            /** @type {{ readonly ordinaryDividendsCents: bigint }} */
            const dividends = { ordinaryDividendsCents: 1000000n }
            const at = run('single')(20000000n)(dividends)
            assertEq(at.line15, 0n, 'exactly at $200,000.00: line 15 = $0.00')
            assertEq(at.line16, 0n, 'exactly at the threshold: nothing to tax')
            assertEq(at.line17, 0n, 'exactly at the threshold: no tax')

            const oneCentAbove = run('single')(20000001n)(dividends)
            assertEq(oneCentAbove.line15, 1n, 'one cent above: line 15 = $0.01')
            assertEq(oneCentAbove.line16, 1n, 'line 16 = $0.01 -- the excess is now the smaller')
            assertEq(oneCentAbove.line17, 0n, '3.8% of one cent is 0.038 cents, which rounds to $0.00')

            const fourteenCentsAbove = run('single')(20000014n)(dividends)
            assertEq(fourteenCentsAbove.line16, 14n, 'line 16 = $0.14')
            assertEq(
                fourteenCentsAbove.line17, 1n,
                'line 17 = $0.01 -- 3.8% of 14 cents is 0.532 cents, the first excess whose tax rounds up to a cent',
            )
        },
        // §1411(d)'s own measure equals bare AGI TODAY, and this leaf says so
        // explicitly rather than leaving it implicit in every figure above --
        // so the day an add-back becomes reachable, exactly one leaf changes
        // and it is the one that names the rule.
        thresholdIncomeEqualsBareAgiToday: () => {
            assertEq(netInvestmentIncomeTaxThresholdIncome(0n), 0n)
            assertEq(netInvestmentIncomeTaxThresholdIncome(30000000n), 30000000n)
            const result = run('single')(30000000n)({ taxableInterestCents: 500000n })
            assertEq(result.line13, netInvestmentIncomeTaxThresholdIncome(30000000n), 'line 13 is that function')
        },
        // Every status reads its OWN §1411(b) threshold, against hand-typed
        // cents -- so a lookup that read one status's figure for another, or
        // read `additionalMedicareTaxThreshold` instead, cannot pass.
        everyStatusReadsItsOwnThreshold: () => {
            for (const status of everyStatus) {
                const result = run(status)(0n)({})
                assertEq(
                    result.line14,
                    thresholdCents[status],
                    ['line 14 must be this status\'s own §1411(b) threshold', status, result.line14],
                )
            }
        },
    },
    // Hand-typed line-count guard, this project's mutation-gate idiom: Part
    // I's 13 (lines 1, 2, 3, 4a-4c, 5a-5d, 6, 7, 8) + Part II's 6 (9a-9d, 10,
    // 11) + Part III's individual branch, 6 (12-17) = 25. Lines 18a-21 are
    // deliberately absent, and this count is where that decision is pinned
    // rather than only described: adding them without revisiting this number
    // fails here.
    everyPrintedLineOfTheIndividualPathIsNamed: () => {
        const result = run('single')(30000000n)({ taxableInterestCents: 500000n })
        const expectedFieldCount = 25
        assertEq(
            Object.keys(result).length,
            expectedFieldCount,
            ['expected exactly 25 named Form 8960 fields', Object.keys(result)],
        )
    },
    // Nothing at all: every line zero, for every status. The degenerate
    // input, and the strongest statement that this form cannot invent a tax
    // out of nothing.
    noIncomeAtAllIsZeroEverywhere: () => {
        for (const status of everyStatus) {
            const result = run(status)(0n)({})
            assertEq(result.line8, 0n, ['no income: no investment income', status])
            assertEq(result.line17, 0n, ['no income: no tax', status])
        }
    },
}
