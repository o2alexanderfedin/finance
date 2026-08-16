/**
 * Form 8606, *Nondeductible IRAs* — **Part I only** (TAX-29) — together with
 * §408(d)(8)'s qualified charitable distribution exclusion (TAX-28), which
 * shares this module because the two interact arithmetically. Phase 26.
 *
 * Sources, fetched and read directly rather than recalled: `f8606.pdf` and
 * `i8606.pdf` (2025 revisions, "Created 5/7/25"), and `i1040gi.pdf`'s own
 * Line 4a/4b "Exception 3" paragraph.
 *
 * ## What this module COMPUTES and what it REFUSES — read this first
 *
 * | Printed line | Status |
 * |---|---|
 * | Part I 1 nondeductible contributions for 2025 | computed — `vnd.fjs.ira`, asserted |
 * | Part I 2 total basis in traditional IRAs | computed — `vnd.fjs.prior_year_ira_basis`, asserted |
 * | Part I 3 lines 1 + 2 | computed |
 * | Part I "did you take a distribution?" branch | computed — the No branch enters line 3 on line 14 |
 * | Part I 4 contributions made 1 Jan - 15 Apr | computed — asserted, and a subset of line 1 by storage rule |
 * | Part I 5 line 3 − line 4 | computed |
 * | Part I 6 value of ALL traditional/SEP/SIMPLE IRAs at 31 Dec | computed — asserted; **refused when absent and needed** |
 * | Part I 7 distributions, QCDs excluded | computed — 1099-R box 1, less the QCD |
 * | Part I 8 net converted to Roth | **refused** when non-zero (that is Part II) |
 * | Part I 9 lines 6 + 7 + 8 | computed |
 * | Part I 10 line 5 ÷ line 9 | computed — three decimal places, clamped at 1.000 |
 * | Part I 11 line 8 × line 10 | structurally zero — line 8 is refused when non-zero |
 * | Part I 12 line 7 × line 10 | computed — the nontaxable portion |
 * | Part I 13 lines 11 + 12 | computed |
 * | Part I 14 line 3 − line 13 | computed — next year's line 2 |
 * | Part I 15a line 7 − line 12 | computed |
 * | Part I 15b qualified disaster distributions (Form 8915-F) | **refused** when declared |
 * | Part I 15c taxable amount → 1040 line 4b | computed |
 * | **Part II** conversions to Roth IRAs | **NOT MODELLED — refused by name** |
 * | **Part III** distributions from Roth IRAs | **NOT MODELLED — refused by name** |
 *
 * **Parts II and III are refused, not computed, and they are refused
 * differently from each other** — which is the detail worth stating, because
 * a uniform treatment would have missed one of them entirely:
 *
 * - **Part II arrives as an ASSERTION.** A Roth conversion is a taxpayer act
 *   the engine cannot see on any document, so `vnd.fjs.ira` carries
 *   `netAmountConvertedToRothIras` for it and {@link iraTaxableAmount}
 *   refuses on a non-zero value. What Part II would additionally require is
 *   real work rather than plumbing: the conversion's own nontaxable portion
 *   (line 11) feeds line 17, line 18 is a SECOND amount landing on 1040 line
 *   4b beside line 15c, and §408A(d)(3) has a recapture regime this engine
 *   models nothing of.
 * - **Part III arrives as a DOCUMENT.** A Roth IRA distribution is reported
 *   on a Form 1099-R with box 7b (IRA/SEP/SIMPLE) deliberately UNCHECKED and
 *   a Roth distribution code in box 7a, so there is nothing for a taxpayer to
 *   assert and no assertion field would ever be filled in. {@link
 *   iraTaxableAmount} therefore detects it off {@link rothDistributionCodes}
 *   and refuses by name. This is the half a fields-only design would have
 *   silently ignored.
 *
 * ## §408(d)(8): what a QCD is, and the four refusals that guard it
 *
 * *"There is no special code for a QCD."* The custodian reports the full
 * distribution in box 1, typically repeats it in box 2a, and checks box 2b
 * "taxable amount not determined". The filer writes "QCD" beside 1040 line 4b
 * and reduces the taxable amount. So the engine's whole knowledge of a QCD is
 * the taxpayer's `vnd.fjs.ira` assertion, and every guard has to come from
 * cross-checking that assertion against documents:
 *
 * 1. **Age.** §408(d)(8)(B)(ii) requires the individual to have attained 70½
 *    **at the time of the distribution**. This engine cannot determine that —
 *    see "The 70½ finding" below — so the fact is asserted and its absence
 *    REFUSES.
 * 2. **The source must be an IRA.** §408(d)(8)(B) reaches an individual
 *    retirement account, not a 401(k) and not a pension. Each QCD names its
 *    distribution by `(payerTin, accountNumber)`; a QCD resolving to a
 *    document whose `box7bIraSepSimple` is unchecked is refused by name.
 * 3. **The QCD cannot exceed what would otherwise be taxed.** *"The amount of
 *    the QCD is limited to the amount that would otherwise be included in
 *    your income."* So the per-distribution ceiling is box 2a, not box 1, and
 *    a QCD naming a distribution with no box 2a at all is refused rather than
 *    measured against a guess.
 * 4. **The §408(d)(8)(A) cap.** $108,000 for TY2025, **per individual** —
 *    `fjs/tax/params` owns the figure and its indexing history. The excess is
 *    includible, which the statute states plainly, so this one is CAPPED
 *    rather than refused; see "Cap or refuse" below.
 *
 * The **one-time split-interest election** (§408(d)(8)(F), up to $54,000
 * inside the $108,000) is REFUSED BY NAME rather than computed. Three
 * separate things would be needed and none exists here: it is once per
 * LIFETIME, a fact spanning every year this engine cannot see; it has its own
 * smaller cap inside the annual one; and it requires a statement attached to
 * the return, which this engine has no way to produce.
 *
 * ## The 70½ finding, stated once, here
 *
 * **This engine cannot determine whether the taxpayer had attained age 70½,
 * and two independent facts make that true — either alone would be enough.**
 *
 * 1. **No birth date is stored anywhere in this repository.** The nearest
 *    thing is `vnd.fjs.return_profile`'s `taxpayerBornBeforeJan2_1961`, which
 *    is 1040 line 12d's own checkbox and a test for having reached **65** by
 *    the close of TY2025 — four and a half years short of this one. Reading
 *    it as a 70½ test is the approximation this phase exists to refuse.
 * 2. **The test is at the DATE OF THE DISTRIBUTION.** Someone who turns 70½
 *    on 1 October has a September distribution that is not a QCD and a
 *    November one that is. The only date available is Form 1099-R box 13,
 *    which this repository deliberately stores as free text because it has no
 *    date primitive (`fjs/document/1099r`'s own header).
 *
 * So the fact is ASSERTED, and its absence refuses by name. There is exactly
 * one direction the engine CAN check, and {@link iraTaxableAmount} checks it:
 * attaining 70½ during 2025 means being born on or before roughly 1 July
 * 1955, which certainly means born before 2 January 1961 — so the line-12d
 * box is a **NECESSARY** condition. If NEITHER the taxpayer's nor the
 * spouse's box is checked, nobody on the return can have attained 70½, and
 * the assertion is refused as contradicted by the profile.
 *
 * **The residual gap, named rather than hidden**: the check uses the union of
 * the two boxes, because `vnd.fjs.return_profile` carries no TIN at all and
 * this module therefore cannot map a recipient TIN to "taxpayer" or "spouse".
 * On a joint return where one spouse is 66 and the other is 60, a QCD
 * asserted by the younger passes this check on the elder's box. Closing that
 * needs a per-person identity on the profile, which is a phase of its own.
 *
 * ## The ordering: a QCD comes off the PRE-TAX portion first
 *
 * §408(d)(8)(D), and the printed instruction restating it: *"If your IRA
 * includes nondeductible contributions, the distribution is first considered
 * to be paid out of otherwise taxable income."* The printed Form 8606 then
 * implements that in one place — **line 7 excludes QCDs**:
 *
 * > *"Enter your distributions from traditional IRAs in 2025. … do not
 * > include qualified charitable distributions"*
 *
 * That single exclusion is the whole ordering rule, and it has two
 * consequences a reader should be able to check:
 *
 * - **A QCD does not absorb basis.** Line 14 (basis carried into next year)
 *   is line 3 − line 13, and line 13 comes from line 12 = line 7 × line 10.
 *   The QCD is out of line 7, so it never multiplies the pro-rata fraction
 *   and never reduces line 14.
 * - **A QCD makes the REMAINING distributions MORE nontaxable, not less.**
 *   The same basis is spread over a smaller line 7 relative to a line 9 that
 *   also shrank by the QCD — so line 10 rises. Both halves are pinned by
 *   {@link proof.orderingOfQcdAgainstProRata}, with the arithmetic written
 *   out.
 *
 * The one place the ordering can go wrong in the other direction is a QCD
 * LARGER than the pre-tax portion of the whole aggregated IRA — at which
 * point "first out of income" runs out of income, and the split between the
 * excludable and non-excludable parts feeds back into line 7's own exclusion.
 * {@link iraTaxableAmount} REFUSES that case by name rather than modelling
 * the feedback.
 *
 * ## Cap or refuse: the two limits are treated differently, on purpose
 *
 * §408(d)(8)(A)'s $108,000 is **capped**: *"so much of the aggregate amount
 * … as does not exceed \\$108,000 shall not be includible"* says in terms
 * that the excess IS includible, so `min` is the statute's own arithmetic and
 * the excess simply lands on line 4b. A taxpayer who wants the excess as a
 * charitable deduction can assert it through `vnd.fjs.itemized_deductions`
 * like any other gift, so nothing is silently lost.
 *
 * §408(d)(8)(D)'s pre-tax ceiling is **refused**, because there the excess is
 * not merely a number that lands somewhere else: which part of the
 * distribution stays a QCD changes what line 7 excludes, which changes line
 * 10, which changes the taxable amount of everything else. That is a fixed
 * point this engine does not model, and the honest output is a sentence.
 *
 * ## §408(d)(2) aggregates, and that is where the money is
 *
 * Line 6 is *"the value of **all** your traditional IRAs as of December 31,
 * 2025"* — every traditional, SEP and SIMPLE IRA the individual owns, treated
 * as one contract under §72(e)(8). Not per account. Nobody reports the figure
 * (Form 5498 is furnished by 31 May, after the return is due), so it is
 * asserted, and this module REFUSES when a Part I computation needs it and no
 * assertion exists. {@link proof.aggregationIsAcrossAllIrasNotPerAccount}
 * proves a two-IRA case distinct from a one-IRA case at the same total, which
 * is the property the requirement singles out.
 *
 * **Per INDIVIDUAL, and that is why everything here is keyed on a TIN.** Form
 * 8606's own header: *"If married, file a separate form for each spouse
 * required to file 2025 Form 8606."* A joint return carries two independent
 * pro-rata fractions and two independent $108,000 caps, and pooling them
 * would be wrong in both directions at once. So a `vnd.fjs.ira` record is
 * scoped to the Forms 1099-R carrying its own `recipientTin`, and two records
 * for one TIN are refused.
 *
 * ## Rounding: the ratio, to three places, exactly as Schedule 1 line 21 does
 *
 * Line 10 reads *"Enter the result as a decimal rounded to at least 3 places.
 * If the result is 1.000 or more, enter '1.000'."* That is word for word the
 * instruction on the student loan interest worksheet's own line 7, and
 * `fjs/schedule/1` already recorded this repository's position on it: *"
 * 'Rounded to AT LEAST three places' permits more precision; exactly three is
 * what the printed line's own boxes hold, so exactly three is what is
 * implemented."* The same reading is applied here, deliberately and for the
 * same reason — two readings of one sentence in one codebase would be worse
 * than either.
 *
 * So there are exactly two rounding points, both `halfUp`: the ratio to
 * thousandths, and the product to the cent.
 *
 * @module
 */
import { assert, assertEq } from 'functionalscript/fjs/asserts/module.f.js'
import { of, halfUp } from '../types/rational/module.f.js'
import { centsFromString, centsToString } from '../exact/module.f.js'
import { taxParamsByYear } from '../tax/params/module.f.js'

/** @import { TaxParamSet } from '../tax/params/module.f.js' */
/** @import { Source } from '../report/line/module.f.js' */
/** @import { Ira } from '../document/ira/module.f.js' */
/** @import { PriorYearIraBasis } from '../document/prior_year_ira_basis/module.f.js' */
/** @import { OneZeroNineNineR } from '../document/1099r/module.f.js' */

/**
 * A stored document as this module sees it — `fjs/schedule/a`'s own local
 * typedef, restated here for that module's own stated reason rather than
 * imported from `fjs/form1040/core`: this module must be readable, and
 * callable, on its own.
 * @template T
 * @typedef {{ readonly documentHash: string, readonly value: T }} Stored
 */

/**
 * The exact cents value of a 1040 line together with the citations it was
 * read from — `fjs/form1040/core`'s own `BoxSum`, restated for the same
 * reason as {@link Stored}. `sources` is a PLAIN, possibly-empty array; the
 * non-empty `ReportLine` tuple is the caller's concern.
 * @typedef {{ readonly value: bigint, readonly sources: readonly Source[] }} BoxSum
 */

// ── Part I, as a pure function over facts ────────────────────────────────────

/**
 * Everything Part I needs, as exact cents rather than as documents. Named by
 * PRINTED LINE NUMBER (TAX-15), so the call site can be diffed against the
 * form face.
 *
 * There is deliberately no `line8` input: a non-zero Roth conversion is Part
 * II and is refused by {@link iraTaxableAmount} before this function is ever
 * called, so line 8 is structurally zero here and {@link
 * proof.lineElevenIsUnreachableBecauseLineEightIsRefused} says so.
 * @typedef {{
 *   readonly line1NondeductibleContributionsCents: bigint,
 *   readonly line2PriorYearBasisCents: bigint,
 *   readonly line4ContributionsMadeAfterYearEndCents: bigint,
 *   readonly line6YearEndValueOfAllIrasCents: bigint,
 *   readonly line7DistributionsExcludingQcdCents: bigint,
 * }} Form8606PartIInput
 */

/**
 * The filled-in Part I: every printed line under its own printed number,
 * plus `line10Thousandths` — the printed line 10's own three-decimal ratio,
 * kept as an exact integer count of thousandths rather than as a float,
 * exactly as `fjs/schedule/1`'s `w7Thousandths` is.
 *
 * The same record-not-array reasoning as `fjs/form8889` and `fjs/tax/ssb`:
 * `noUncheckedIndexedAccess` makes an array index `bigint | undefined`, and a
 * record indexes cleanly with the printed line numbers carried in the field
 * names.
 * @typedef {{
 *   readonly line1: bigint, readonly line2: bigint, readonly line3: bigint,
 *   readonly line4: bigint, readonly line5: bigint, readonly line6: bigint,
 *   readonly line7: bigint, readonly line8: bigint, readonly line9: bigint,
 *   readonly line10Thousandths: bigint,
 *   readonly line11: bigint, readonly line12: bigint, readonly line13: bigint,
 *   readonly line14: bigint,
 *   readonly line15a: bigint, readonly line15b: bigint, readonly line15c: bigint,
 * }} Form8606PartI
 */

/**
 * Computes Form 8606 Part I from already-extracted facts.
 *
 * **Total, never refusing.** Every case this function cannot handle is
 * refused by {@link iraTaxableAmount} before it is called, which is what lets
 * this one be a plain arrow over `bigint`s rather than an outcome union — the
 * same division of labour `fjs/schedule/1a` and `fjs/schedule/1` already use.
 *
 * The printed page's own mid-Part-I branch is implemented as a branch:
 *
 * > *"In 2025, did you take a distribution from a traditional IRA, or make a
 * > Roth IRA conversion? **No** — Enter the amount from line 3 on line 14. Do
 * > not complete the rest of Part I."*
 *
 * Writing it out matters for one reason beyond fidelity: without it, line 9
 * can be zero (no distributions AND no year-end value — a taxpayer who
 * contributed nondeductibly in January 2026 for 2025 and holds nothing else)
 * and line 10 would divide by zero. The branch is also, for line 14 alone,
 * ARITHMETICALLY EQUIVALENT to falling through — line 12 is `line7 × ratio`
 * and line 7 is zero, so line 13 is zero and line 14 is line 3 either way.
 * That equivalence is stated here so nobody "simplifies" the branch away on
 * the strength of a line-14 test and silently reintroduces the division.
 * @type {(input: Form8606PartIInput) => Form8606PartI}
 */
export const form8606PartI = input => {
    const {
        line1NondeductibleContributionsCents,
        line2PriorYearBasisCents,
        line4ContributionsMadeAfterYearEndCents,
        line6YearEndValueOfAllIrasCents,
        line7DistributionsExcludingQcdCents,
    } = input
    // 1. "Enter your nondeductible contributions to traditional IRAs for
    //    2025, including those made for 2025 from January 1, 2026, through
    //    April 15, 2026."
    const line1 = line1NondeductibleContributionsCents
    // 2. "Enter your total basis in traditional IRAs." -- last year's line 14.
    const line2 = line2PriorYearBasisCents
    // 3. "Add lines 1 and 2."
    const line3 = line1 + line2
    // 8. "Enter the net amount you converted from traditional IRAs to Roth
    //    IRAs in 2025." Structurally zero -- Part II is refused upstream.
    const line8 = 0n
    // 7. "Enter your distributions from traditional IRAs in 2025 ... do not
    //    include qualified charitable distributions." The caller has already
    //    subtracted the QCD; see this module's own docstring for why that
    //    single exclusion IS §408(d)(8)(D)'s ordering rule.
    const line7 = line7DistributionsExcludingQcdCents
    // The printed mid-part branch -- see this function's own docstring.
    if (line7 === 0n && line8 === 0n) {
        return {
            line1, line2, line3,
            line4: 0n, line5: 0n, line6: 0n, line7: 0n, line8: 0n, line9: 0n,
            line10Thousandths: 0n,
            line11: 0n, line12: 0n, line13: 0n,
            line14: line3,
            line15a: 0n, line15b: 0n, line15c: 0n,
        }
    }
    // 4. "Enter those contributions included on line 1 that were made from
    //    January 1, 2026, through April 15, 2026." A subset of line 1, which
    //    `vnd.fjs.ira`'s own `checkReferences` enforces at the boundary.
    const line4 = line4ContributionsMadeAfterYearEndCents
    // 5. "Subtract line 4 from line 3."
    const line5 = line3 - line4
    // 6. "Enter the value of all your traditional IRAs as of December 31,
    //    2025." ALL of them, aggregated -- §408(d)(2)/§72(e)(8).
    const line6 = line6YearEndValueOfAllIrasCents
    // 9. "Add lines 6, 7, and 8."
    const line9 = line6 + line7 + line8
    // 10. "Divide line 5 by line 9. Enter the result as a decimal rounded to
    //     at least 3 places. If the result is 1.000 or more, enter '1.000'."
    //     Three places exactly, `halfUp` -- `fjs/schedule/1`'s own recorded
    //     reading of the identical sentence.
    //
    //     `[EQUIVALENT MUTANT, recorded rather than tidied away]` Weakening
    //     the clamp's `< 1000n` to `<= 1000n` cannot turn red at any input:
    //     at exactly `1000n` both arms of the conditional return `1000n`, so
    //     the token carries no information and the whole expression is
    //     `min(ratio, 1000)`. Re-run as the removal of the clamp entirely —
    //     `const line10Thousandths = ratioThousandths` — it reddens
    //     `aRatioAtOrAboveOneIsClamped…` and
    //     `aBasisLargerThanTheWholeAggregatedIra…`, so the clamp IS
    //     load-bearing and only that one token is not. AGENTS.md's second
    //     failure mode, met here exactly as described.
    assert(line9 > 0n, ['line 9 cannot be zero once the No branch is taken', line9])
    const ratioThousandths = halfUp(of(line5 * 1000n)(line9))
    const line10Thousandths = ratioThousandths < 1000n ? ratioThousandths : 1000n
    // 11. "Multiply line 8 by line 10." Zero, because line 8 is.
    const line11 = halfUp(of(line8 * line10Thousandths)(1000n))
    // 12. "Multiply line 7 by line 10. This is the nontaxable portion of your
    //     distributions that you did not convert to a Roth IRA." The second
    //     and last rounding point on the printed page.
    const line12 = halfUp(of(line7 * line10Thousandths)(1000n))
    // 13. "Add lines 11 and 12."
    const line13 = line11 + line12
    // 14. "Subtract line 13 from line 3. This is your total basis in
    //     traditional IRAs for 2025 and earlier years." Next year's line 2.
    const line14 = line3 - line13
    // 15a. "Subtract line 12 from line 7."
    const line15a = line7 - line12
    // 15b. The Form 8915-F qualified disaster portion -- refused upstream
    //      when declared, so zero for every return that reaches here.
    const line15b = 0n
    // 15c. "Taxable amount. ... If more than zero, also include this amount
    //      on 2025 Form 1040 ... line 4b."
    const line15c = line15a - line15b
    assert(line15c >= 0n, ['Form 8606 line 15c must never be negative', line15c])
    assert(line14 >= 0n, ['Form 8606 line 14 must never be negative', line14])
    return {
        line1, line2, line3, line4, line5, line6, line7, line8, line9,
        line10Thousandths, line11, line12, line13, line14, line15a, line15b, line15c,
    }
}

// ── The document layer: QCDs, per-person scoping, and every refusal ──────────

/**
 * Form 1099-R box 7a codes that report a distribution from a **Roth IRA** —
 * the trigger for Form 8606 **Part III**, which this module does not model.
 *
 * Read off the printed 2025 Form 1099-R's own "Distribution codes" box:
 * `J` (early distribution from a Roth IRA), `T` (Roth IRA distribution,
 * exception applies) and `Q` (qualified distribution from a Roth IRA). Code
 * `B` is deliberately NOT here — it is a designated Roth account inside an
 * employer plan, which is a Form 1040 line 5b pension and has nothing to do
 * with Form 8606.
 *
 * Detection is off the CODE rather than off `box7bIraSepSimple`, because that
 * checkbox is deliberately UNCHECKED for a Roth IRA — so the absence of the
 * IRA flag cannot distinguish a Roth IRA from an ordinary pension.
 */
export const rothDistributionCodes = /** @type {const} */ (['J', 'T', 'Q'])

/**
 * Everything the document layer reads. `line4bBeforeIraRecords` is the caller's
 * OWN already-computed line 4b — the box-2a sum over IRA Forms 1099-R that
 * `fjs/form1040/core` has always produced — passed in rather than recomputed
 * here, so the no-record path can return it UNCHANGED and the "a retiree with
 * neither a QCD nor basis computes exactly what they compute today" property
 * is structural rather than a coincidence of two implementations agreeing.
 *
 * `iraRetirementForms` is the same set that sum was taken over;
 * `allRetirementForms` is every Form 1099-R including pensions, needed
 * because a QCD claimed against a 401(k) must be refused BY NAME rather than
 * merely failing to match anything.
 *
 * `anyFilerBornBeforeJan2_1961` is the union of the profile's two line-12d
 * age boxes — see this module's docstring, "The 70½ finding", for why the
 * union and for the residual gap that leaves.
 * @typedef {{
 *   readonly iraRecords: readonly Stored<Ira>[],
 *   readonly priorYearBasisForms: readonly Stored<PriorYearIraBasis>[],
 *   readonly iraRetirementForms: readonly Stored<OneZeroNineNineR>[],
 *   readonly allRetirementForms: readonly Stored<OneZeroNineNineR>[],
 *   readonly anyFilerBornBeforeJan2_1961: boolean,
 *   readonly line4bBeforeIraRecords: BoxSum,
 * }} IraTaxableAmountInput
 */

/**
 * A case this module will not compute. A VALUE, never a throw — the same
 * shape `fjs/form8889`'s and `fjs/schedule/d`'s refusals already use, so
 * `fjs/form1040/core` threads it into its existing error arm without a new
 * mechanism. No `unmodeled` field: this is a document-data-sufficiency
 * refusal, not an `fjs/return/scope` kind refusal.
 * @typedef {{ readonly kind: 'error', readonly message: string }} IraRefusal
 */

/**
 * The computed 1040 line 4b, plus what a reader needs to check it.
 * @typedef {{
 *   readonly kind: 'ok',
 *   readonly line4b: BoxSum,
 *   readonly qcdExclusionCents: bigint,
 *   readonly partIByRecipientTin: { readonly [tin: string]: Form8606PartI },
 * }} IraTaxableAmount
 */

/** @typedef {IraTaxableAmount | IraRefusal} IraTaxableAmountOutcome */

/**
 * The empty result — line 4b exactly as the caller computed it, nothing
 * excluded, no Form 8606. Written once so the "no records" path and the type
 * both read the same.
 * @type {(line4b: BoxSum) => IraTaxableAmount}
 */
const unchanged = line4b => ({
    kind: 'ok', line4b, qcdExclusionCents: 0n, partIByRecipientTin: {},
})

/**
 * `centsFromString` on an absent-able printed amount, DOC-11's way: absent is
 * absent, and the caller decides what that means. Returns `0n` only where the
 * printed form's own blank means zero.
 * @type {(printed: string | undefined) => bigint}
 */
const centsOrZero = printed => printed === undefined ? 0n : centsFromString(printed)

/**
 * Computes 1040 line 4b for a return carrying `vnd.fjs.ira` records — the
 * QCD exclusion, Form 8606 Part I, and every refusal listed in this module's
 * docstring.
 *
 * **The no-record path returns the caller's own line 4b object**, so a return
 * with no `vnd.fjs.ira` document computes byte for byte what it computed
 * before this phase. That is criterion 4, expressed as an identity rather
 * than as a test.
 * @type {(taxParamSet: TaxParamSet) => (input: IraTaxableAmountInput) => IraTaxableAmountOutcome}
 */
export const iraTaxableAmount = taxParamSet => input => {
    const {
        iraRecords, priorYearBasisForms, iraRetirementForms, allRetirementForms,
        anyFilerBornBeforeJan2_1961, line4bBeforeIraRecords,
    } = input
    if (iraRecords.length === 0) {
        // A basis carry-forward with no `vnd.fjs.ira` record beside it cannot
        // be used: Form 8606's pro-rata fraction needs line 6, and line 6
        // lives on the record. Refusing here rather than ignoring the
        // document is the whole point — a stored basis silently dropped is
        // the double-taxation this requirement exists to close, arriving by a
        // different route.
        const orphan = priorYearBasisForms[0]
        if (orphan !== undefined) {
            return {
                kind: 'error',
                message: `a prior-year IRA basis of ${orphan.value.priorYearForm8606Line14} is `
                    + `stored for ${orphan.value.recipientTin}, but no vnd.fjs.ira record supplies `
                    + `Form 8606 line 6 (the value of ALL that person's traditional, SEP and `
                    + `SIMPLE IRAs at December 31) — §408(d)(2)'s pro-rata fraction cannot be `
                    + `computed without it, and ignoring the basis would tax after-tax money a `
                    + `second time`,
            }
        }
        return unchanged(line4bBeforeIraRecords)
    }
    // One Form 8606 per person (the printed form's own header). Two records
    // for one TIN would make the applicable basis depend on which one a
    // reader looked at first -- `vnd.fjs.credits`' own duplicate-record
    // reasoning, one dialect over.
    for (const record of iraRecords) {
        const tin = record.value.recipientTin
        if (iraRecords.filter(other => other.value.recipientTin === tin).length > 1) {
            return {
                kind: 'error',
                message: `two vnd.fjs.ira records are stored for ${tin} — Form 8606 is one form `
                    + `per person per year ("if married, file a separate form for each spouse"), `
                    + `and two would give one person two bases and two §408(d)(8)(A) caps`,
            }
        }
        if (priorYearBasisForms.filter(other => other.value.recipientTin === tin).length > 1) {
            return {
                kind: 'error',
                message: `two vnd.fjs.prior_year_ira_basis records are stored for ${tin} — Form `
                    + `8606's line 2 is one figure, and two would make it depend on which record `
                    + `a reader looked at first`,
            }
        }
    }
    // Every basis document must belong to a record, for the same reason the
    // no-record case above refuses.
    for (const basis of priorYearBasisForms) {
        const tin = basis.value.recipientTin
        if (!iraRecords.some(record => record.value.recipientTin === tin)) {
            return {
                kind: 'error',
                message: `a prior-year IRA basis of ${basis.value.priorYearForm8606Line14} is `
                    + `stored for ${tin}, but no vnd.fjs.ira record for that person supplies Form `
                    + `8606 line 6 — §408(d)(2)'s pro-rata fraction cannot be computed without it`,
            }
        }
    }
    /** @type {Source[]} */
    const extraSources = []
    /** @type {{ [tin: string]: Form8606PartI }} */
    const partIByRecipientTin = {}
    let deltaCents = 0n
    let qcdExclusionCents = 0n
    for (const record of iraRecords) {
        const outcome = oneRecord(taxParamSet)({
            record, priorYearBasisForms, iraRetirementForms, allRetirementForms,
            anyFilerBornBeforeJan2_1961,
        })
        if (outcome.kind === 'error') {
            return outcome
        }
        deltaCents += outcome.deltaCents
        qcdExclusionCents += outcome.qcdExclusionCents
        for (const source of outcome.sources) {
            extraSources.push(source)
        }
        const partI = outcome.partI
        if (partI !== undefined) {
            partIByRecipientTin[record.value.recipientTin] = partI
        }
    }
    return {
        kind: 'ok',
        line4b: {
            value: line4bBeforeIraRecords.value + deltaCents,
            sources: [...line4bBeforeIraRecords.sources, ...extraSources],
        },
        qcdExclusionCents,
        partIByRecipientTin,
    }
}

/**
 * One person's contribution to line 4b, expressed as a DELTA against the
 * box-2a sum the caller already took over that person's IRA Forms 1099-R.
 *
 * A delta rather than an absolute figure, deliberately: the caller's line 4b
 * covers every IRA distribution on the return, including those belonging to a
 * person with no `vnd.fjs.ira` record at all, and a design that rebuilt the
 * whole line here would have to reproduce that reading and could disagree
 * with it.
 * @typedef {{
 *   readonly kind: 'ok',
 *   readonly deltaCents: bigint,
 *   readonly qcdExclusionCents: bigint,
 *   readonly sources: readonly Source[],
 *   readonly partI: Form8606PartI | undefined,
 * }} OneRecordOutcome
 */

/**
 * @typedef {{
 *   readonly record: Stored<Ira>,
 *   readonly priorYearBasisForms: readonly Stored<PriorYearIraBasis>[],
 *   readonly iraRetirementForms: readonly Stored<OneZeroNineNineR>[],
 *   readonly allRetirementForms: readonly Stored<OneZeroNineNineR>[],
 *   readonly anyFilerBornBeforeJan2_1961: boolean,
 * }} OneRecordInput
 */

/**
 * Everything one `vnd.fjs.ira` record does, in the order the refusals must
 * run: the three unmodelled-fact gates first, then the QCD's own four gates,
 * then Form 8606 Part I. A gate is a gate and never a consequence of
 * arithmetic that happened to come out a certain way — `fjs/form8889`'s own
 * ordering discipline.
 * @type {(taxParamSet: TaxParamSet) => (input: OneRecordInput) => OneRecordOutcome | IraRefusal}
 */
const oneRecord = taxParamSet => input => {
    const {
        record, priorYearBasisForms, iraRetirementForms, allRetirementForms,
        anyFilerBornBeforeJan2_1961,
    } = input
    const ira = record.value
    const tin = ira.recipientTin
    // ── The three facts stored only so they can be refused by name ──────────
    if (centsOrZero(ira.netAmountConvertedToRothIras) > 0n) {
        return {
            kind: 'error',
            message: `Form 8606 line 8 (net amount converted from traditional IRAs to Roth IRAs) `
                + `is ${ira.netAmountConvertedToRothIras} for ${tin}, and this engine does not `
                + `model Part II: the conversion's own nontaxable portion feeds line 17, line 18 `
                + `is a second amount landing on 1040 line 4b beside line 15c, and §408A(d)(3)'s `
                + `recapture regime is unmodelled. Refusing rather than dropping the conversion `
                + `out of line 9's denominator and understating the tax (no phase yet)`,
        }
    }
    if (ira.hadOutstandingRolloverOrRecharacterization !== undefined) {
        return {
            kind: 'error',
            message: `an outstanding rollover or a recharacterization is declared for ${tin}. `
                + `Form 8606's printed line 6 adds outstanding rollovers to the year-end value `
                + `and takes recharacterizations into account, and line 7 excludes rolled-over `
                + `distributions — none of which this engine models. Refusing rather than `
                + `computing §408(d)(2)'s fraction over a denominator known to be wrong `
                + `(no phase yet)`,
        }
    }
    if (ira.hadQualifiedDisasterDistributionOrPlanRepayment !== undefined) {
        return {
            kind: 'error',
            message: `a qualified disaster distribution or a retirement plan distribution `
                + `repayment is declared for ${tin}. Form 8606's line 15b comes off Form 8915-F `
                + `and line 15c is further reduced by repayments treated as rollovers through the `
                + `Line 15c Worksheet — neither of which this engine models. Refusing rather than `
                + `entering zero on line 15b and overstating line 4b (no phase yet)`,
        }
    }
    // ── The QCD ─────────────────────────────────────────────────────────────
    const qcdEntries = ira.qualifiedCharitableDistributions ?? []
    /** @type {Source[]} */
    const sources = []
    let qcdBeforeCapCents = 0n
    if (qcdEntries.length > 0) {
        for (const entry of qcdEntries) {
            if (entry.oneTimeSplitInterestElection !== undefined) {
                return {
                    kind: 'error',
                    message: `the QCD to ${entry.charity} claims §408(d)(8)(F)'s ONE-TIME `
                        + `split-interest entity election (up to `
                        + `$${taxParamSet.qualifiedCharitableDistribution.splitInterestOneTimeLimit.amount} `
                        + `for ${taxParamSet.taxYear}, inside the `
                        + `$${taxParamSet.qualifiedCharitableDistribution.annualLimitPerIndividual.amount} `
                        + `annual limit). This engine does not model it: the election is once per `
                        + `LIFETIME, which spans years this engine cannot see, and it requires a `
                        + `statement attached to the return that this engine cannot produce. `
                        + `Refusing rather than treating it as an ordinary QCD (no phase yet)`,
                }
            }
        }
        // §408(d)(8)(B)(ii)'s age test -- ASSERTED, because it is not
        // derivable. See this module's own docstring, "The 70½ finding".
        if (ira.attainedAgeSeventyAndAHalfAtEveryDistributionBelow === undefined) {
            return {
                kind: 'error',
                message: `${tin} claims a qualified charitable distribution without asserting `
                    + `attainedAgeSeventyAndAHalfAtEveryDistributionBelow. §408(d)(8)(B)(ii) `
                    + `requires having attained age 70½ AT THE TIME OF THE DISTRIBUTION, and this `
                    + `engine cannot determine that: no birth date is stored anywhere, the `
                    + `nearest fact is 1040 line 12d's taxpayerBornBeforeJan2_1961 (a test for `
                    + `reaching 65, four and a half years short), and the distribution's own date `
                    + `is Form 1099-R box 13, stored as free text. Refusing rather than reading `
                    + `the 65 checkbox as a 70½ test`,
            }
        }
        // The ONE direction that IS derivable, and its contradiction. See the
        // module docstring for the residual gap the union leaves.
        if (!anyFilerBornBeforeJan2_1961) {
            return {
                kind: 'error',
                message: `${tin} asserts having attained age 70½ during ${taxParamSet.taxYear}, `
                    + `but the return profile checks NEITHER line-12d age box — so nobody on this `
                    + `return was born before January 2, 1961 and nobody reached even 65 by the `
                    + `close of the year. Attaining 70½ in ${taxParamSet.taxYear} requires having `
                    + `been born around July 1, 1955 or earlier, which the profile contradicts`,
            }
        }
        for (const entry of qcdEntries) {
            const matches = allRetirementForms.filter(form =>
                form.value.recipientTin === tin
                && form.value.payerTin === entry.payerTin
                && form.value.accountNumber === entry.accountNumber)
            const [matched, ...extraMatches] = matches
            if (matched === undefined) {
                return {
                    kind: 'error',
                    message: `the QCD of ${entry.amount} to ${entry.charity} names payer `
                        + `${entry.payerTin} account ${entry.accountNumber} for ${tin}, and no `
                        + `stored Form 1099-R matches — a QCD is part of a distribution that was `
                        + `actually made, so refusing rather than reducing 1040 line 4b by an `
                        + `amount no document reports`,
                }
            }
            if (extraMatches.length > 0) {
                return {
                    kind: 'error',
                    message: `the QCD of ${entry.amount} to ${entry.charity} names payer `
                        + `${entry.payerTin} account ${entry.accountNumber} for ${tin}, and `
                        + `${matches.length} stored Forms 1099-R match — which distribution the `
                        + `gift came out of decides whether it is an IRA at all and what it may `
                        + `not exceed, so refusing rather than taking the first`,
                }
            }
            if (matched.value.box7bIraSepSimple !== true) {
                return {
                    kind: 'error',
                    message: `the QCD of ${entry.amount} to ${entry.charity} comes from payer `
                        + `${entry.payerTin} account ${entry.accountNumber}, whose Form 1099-R `
                        + `does NOT check box 7b (IRA/SEP/SIMPLE) — that distribution is a `
                        + `pension or an employer plan, and §408(d)(8)(B) reaches an individual `
                        + `retirement account only. It also lands on 1040 line 5b, not line 4b`,
                }
            }
            const printedTaxable = matched.value.box2aTaxableAmount
            if (printedTaxable === undefined) {
                return {
                    kind: 'error',
                    message: `the QCD of ${entry.amount} to ${entry.charity} comes from payer `
                        + `${entry.payerTin} account ${entry.accountNumber}, whose Form 1099-R `
                        + `leaves box 2a (taxable amount) blank. §408(d)(8)(D) limits a QCD to `
                        + `"the amount that would otherwise be included in your income", and `
                        + `there is no such amount on that document to limit it against`,
                }
            }
            const entryCents = centsFromString(entry.amount)
            if (entryCents > centsFromString(printedTaxable)) {
                return {
                    kind: 'error',
                    message: `the QCD of ${entry.amount} to ${entry.charity} exceeds box 2a `
                        + `(${printedTaxable}) of the Form 1099-R it claims to come from (payer `
                        + `${entry.payerTin} account ${entry.accountNumber}). §408(d)(8)(D) `
                        + `limits a QCD to the amount that would otherwise be included in income`,
                }
            }
            qcdBeforeCapCents += entryCents
            sources.push({
                documentHash: record.documentHash,
                boxPath: `qualifiedCharitableDistributions[charity=${entry.charity}]`,
                value: entry.amount,
            })
        }
        // Several gifts may come out of ONE distribution, so the per-entry
        // ceiling above is not enough: their TOTAL must also fit inside that
        // document's box 2a. Without this, three $20,000 gifts out of one
        // $20,000 distribution would each pass and 1040 line 4b would go
        // $40,000 negative.
        for (const form of iraRetirementForms) {
            if (form.value.recipientTin !== tin) {
                continue
            }
            const againstThisForm = qcdEntries
                .filter(entry => entry.payerTin === form.value.payerTin
                    && entry.accountNumber === form.value.accountNumber)
                .reduce((total, entry) => total + centsFromString(entry.amount), 0n)
            if (againstThisForm === 0n) {
                continue
            }
            const printedTaxable = form.value.box2aTaxableAmount
            if (printedTaxable !== undefined && againstThisForm > centsFromString(printedTaxable)) {
                return {
                    kind: 'error',
                    message: `${centsToString(againstThisForm)} of qualified charitable `
                        + `distributions are claimed against payer ${form.value.payerTin} account `
                        + `${form.value.accountNumber} for ${tin}, whose Form 1099-R box 2a is `
                        + `only ${printedTaxable} — §408(d)(8)(D) limits the total, not merely `
                        + `each gift`,
                }
            }
        }
    }
    // §408(d)(8)(A)'s per-INDIVIDUAL cap. CAPPED, not refused: the statute
    // says the excess IS includible, so `min` is its own arithmetic. See this
    // module's docstring, "Cap or refuse".
    const annualCapCents = centsFromString(
        taxParamSet.qualifiedCharitableDistribution.annualLimitPerIndividual.amount)
    const qcdExclusionCents = qcdBeforeCapCents < annualCapCents
        ? qcdBeforeCapCents
        : annualCapCents
    // ── Form 8606 Part I ────────────────────────────────────────────────────
    const basisDocument = priorYearBasisForms.find(form => form.value.recipientTin === tin)
    const line2Cents = basisDocument === undefined
        ? 0n
        : centsFromString(basisDocument.value.priorYearForm8606Line14)
    const line1Cents = centsOrZero(ira.nondeductibleContributionsThisYear)
    // The printed Part I's own "complete this part only if" test, in the two
    // forms that can reach this engine: a nondeductible contribution made for
    // this year, or a distribution taken while an earlier year's basis is
    // still outstanding.
    const partIApplies = line1Cents > 0n || line2Cents > 0n
    const myIraForms = iraRetirementForms.filter(form => form.value.recipientTin === tin)
    const grossDistributionCents = myIraForms.reduce(
        (total, form) => total + centsOrZero(form.value.box1GrossDistribution), 0n)
    const printedTaxableCents = myIraForms.reduce(
        (total, form) => total + centsOrZero(form.value.box2aTaxableAmount), 0n)
    if (!partIApplies) {
        // A QCD with no basis anywhere: 1040 line 4b is the box-2a sum less
        // the exclusion, exactly as the printed instruction says — "if only
        // part of the distribution is a QCD, enter the part that is not a QCD
        // on line 4b". Line 4a is untouched and stays gross.
        assert(
            qcdExclusionCents <= printedTaxableCents,
            ['a QCD cannot exceed the taxable amounts it came out of', tin],
        )
        return {
            kind: 'ok',
            deltaCents: -qcdExclusionCents,
            qcdExclusionCents,
            sources,
            partI: undefined,
        }
    }
    // Part II and Part III, refused by name -- Part III off the DOCUMENT,
    // since a Roth IRA distribution is never an assertion. Gated on Part I
    // applying, because a Roth distribution changes nothing about a QCD.
    for (const form of allRetirementForms) {
        if (form.value.recipientTin !== tin) {
            continue
        }
        const rothCode = (form.value.box7aDistributionCodes ?? [])
            .find(code => rothDistributionCodes.some(known => known === code))
        if (rothCode !== undefined) {
            return {
                kind: 'error',
                message: `a Form 1099-R for ${tin} carries box 7a distribution code ${rothCode}, `
                    + `a distribution from a Roth IRA, and this return also files Form 8606 Part `
                    + `I. Part III (distributions from Roth IRAs) is not modelled by this engine `
                    + `— it needs an ordering of contributions, conversions and earnings across `
                    + `every prior year, and a §408A(d)(2) five-year clock. Refusing rather than `
                    + `filing a Form 8606 that is missing a part the return requires (no phase `
                    + `yet)`,
            }
        }
    }
    const line7Cents = grossDistributionCents - qcdExclusionCents
    assert(line7Cents >= 0n, ['Form 8606 line 7 must never be negative', tin, line7Cents])
    const line4Cents = centsOrZero(ira.contributionsMadeAfterYearEnd)
    const printedYearEndValue = ira.yearEndValueOfAllTraditionalSepSimpleIras
    if (line7Cents > 0n && printedYearEndValue === undefined) {
        return {
            kind: 'error',
            message: `${tin} has ${centsToString(line7Cents)} of traditional IRA distributions `
                + `and a Form 8606 basis of ${centsToString(line1Cents + line2Cents)}, but no `
                + `yearEndValueOfAllTraditionalSepSimpleIras is asserted. Form 8606's printed `
                + `line 6 is the value of ALL that person's traditional, SEP and SIMPLE IRAs at `
                + `December 31 — §408(d)(2) aggregates them as one contract — and it is the `
                + `denominator of the pro-rata fraction. No Form 1099-R reports it and Form 5498 `
                + `is not furnished until May 31, after the return is due, so there is nothing to `
                + `derive it from and no defensible default: treating it as zero would make every `
                + `distribution nontaxable up to the basis`,
        }
    }
    const line6Cents = centsOrZero(printedYearEndValue)
    // §408(d)(8)(D)'s pre-tax ceiling, REFUSED rather than capped -- see this
    // module's docstring, "Cap or refuse", for why this one is different.
    // The basis compared against is line 5, not line 3: a contribution made
    // after 31 December is not in the year-end value, and the printed form
    // subtracts it at line 5 for exactly that reason.
    const line5Cents = line1Cents + line2Cents - line4Cents
    const preTaxCents = line6Cents + grossDistributionCents - line5Cents
    // `[FOUND BY A PROOF]` The `qcdExclusionCents > 0n` term is load-bearing
    // and was missing in the first draft. `preTaxCents` is routinely NEGATIVE
    // for a perfectly ordinary return — a basis larger than what the IRAs are
    // now worth, which is what a market loss after nondeductible
    // contributions looks like — and without this term `0 > -10,000` refused
    // every such return, including two of this file's own Form 8606 leaves.
    // There is nothing for §408(d)(8)(D) to constrain when no QCD was
    // claimed; a basis exceeding the aggregate is handled by line 10's own
    // clamp at 1.000, not by a refusal.
    if (qcdExclusionCents > 0n && qcdExclusionCents > preTaxCents) {
        return {
            kind: 'error',
            message: `${centsToString(qcdExclusionCents)} of qualified charitable distributions `
                + `are claimed for ${tin}, but the pre-tax portion of that person's aggregated `
                + `traditional IRAs is only ${centsToString(preTaxCents)} `
                + `(Form 8606 line 6 ${centsToString(line6Cents)} plus `
                + `${centsToString(grossDistributionCents)} distributed, less a basis of `
                + `${centsToString(line5Cents)}). §408(d)(8)(D) makes a QCD come first out of `
                + `otherwise taxable income, and here it runs out: how the gift splits between `
                + `its excludable and includible parts changes what line 7 excludes, which `
                + `changes line 10, which changes the taxable amount of every other `
                + `distribution. This engine does not model that fixed point (no phase yet)`,
        }
    }
    const partI = form8606PartI({
        line1NondeductibleContributionsCents: line1Cents,
        line2PriorYearBasisCents: line2Cents,
        line4ContributionsMadeAfterYearEndCents: line4Cents,
        line6YearEndValueOfAllIrasCents: line6Cents,
        line7DistributionsExcludingQcdCents: line7Cents,
    })
    if (ira.nondeductibleContributionsThisYear !== undefined) {
        sources.push({
            documentHash: record.documentHash,
            boxPath: 'nondeductibleContributionsThisYear',
            value: ira.nondeductibleContributionsThisYear,
        })
    }
    if (printedYearEndValue !== undefined) {
        sources.push({
            documentHash: record.documentHash,
            boxPath: 'yearEndValueOfAllTraditionalSepSimpleIras',
            value: printedYearEndValue,
        })
    }
    if (basisDocument !== undefined) {
        sources.push({
            documentHash: basisDocument.documentHash,
            boxPath: 'priorYearForm8606Line14',
            value: basisDocument.value.priorYearForm8606Line14,
        })
    }
    return {
        kind: 'ok',
        // Form 8606 line 15c REPLACES this person's box-2a sum on line 4b —
        // which is the printed form's own instruction ("see Form 8606 and its
        // instructions to figure the amount to enter on line 4b"), and is why
        // the delta is a replacement rather than a subtraction. Box 2a is
        // exactly the figure Form 8606 exists to correct.
        deltaCents: partI.line15c - printedTaxableCents,
        qcdExclusionCents,
        sources,
        partI,
    }
}

// ── Tests ────────────────────────────────────────────────────────────────────

/**
 * TY2025's parameter set, narrowed exactly ONCE at module scope, mirroring
 * `fjs/form8889`'s and `fjs/tax/ssb`'s own precedent.
 */
const taxParams2025 = taxParamsByYear[2025]
assert(taxParams2025 !== undefined, 'expected TY2025 parameters to be present in taxParamsByYear')

/** @type {TaxParamSet} */
const params = taxParams2025

const recipient = '222-22-2222'
const spouseTin = '333-33-3333'
const recordHash = 'sha256-ira-record'
const basisHash = 'sha256-prior-year-basis'

/**
 * One IRA Form 1099-R. `box2a` defaults to `box1`, which is what a custodian
 * actually prints for a traditional IRA (with box 2b "taxable amount not
 * determined" checked beside it).
 * @type {(hash: string) => (payerTin: string) => (accountNumber: string) => (box1: string) => Stored<OneZeroNineNineR>}
 */
const iraForm = hash => payerTin => accountNumber => box1 => ({
    documentHash: hash,
    value: {
        dialect: 'vnd.fjs.1099r',
        payerTin,
        recipientTin: recipient,
        accountNumber,
        taxYear: 2025,
        formRevision: '2025',
        box1GrossDistribution: box1,
        box2aTaxableAmount: box1,
        box2bTaxableAmountNotDetermined: true,
        box7bIraSepSimple: true,
    },
})

/** The same, without box 7b — a pension, which lands on 1040 line 5b.
 * @type {(hash: string) => (payerTin: string) => (accountNumber: string) => (box1: string) => Stored<OneZeroNineNineR>}
 */
const pensionForm = hash => payerTin => accountNumber => box1 => ({
    documentHash: hash,
    value: {
        dialect: 'vnd.fjs.1099r',
        payerTin,
        recipientTin: recipient,
        accountNumber,
        taxYear: 2025,
        formRevision: '2025',
        box1GrossDistribution: box1,
        box2aTaxableAmount: box1,
    },
})

/** @type {(value: Ira) => Stored<Ira>} */
const storedRecord = value => ({ documentHash: recordHash, value })

/** @type {(tin: string) => (amount: string) => Stored<PriorYearIraBasis>} */
const storedBasis = tin => amount => ({
    documentHash: basisHash,
    value: {
        dialect: 'vnd.fjs.prior_year_ira_basis',
        recipientTin: tin,
        taxYear: 2024,
        priorYearForm8606Line14: amount,
    },
})

/**
 * The line 4b a caller would have computed before this phase: the box-2a sum
 * over the given IRA forms, with one source each. Written out here rather
 * than imported from `fjs/form1040/core` (which does not export it) — and
 * `fjs/form1040/core`'s own proofs are what check the two agree, by running
 * the real one.
 * @type {(forms: readonly Stored<OneZeroNineNineR>[]) => BoxSum}
 */
const boxTwoASum = forms => {
    const sources = forms.flatMap(form => {
        const printed = form.value.box2aTaxableAmount
        return printed === undefined
            ? []
            : [{ documentHash: form.documentHash, boxPath: 'box2aTaxableAmount', value: printed }]
    })
    return {
        value: sources.reduce((total, source) => total + centsFromString(source.value), 0n),
        sources,
    }
}

/**
 * Runs {@link iraTaxableAmount} over a fixture, defaulting every field that a
 * given leaf does not care about. `anyFilerBornBeforeJan2_1961` defaults to
 * TRUE, so the age-contradiction gate is out of the way except in the leaf
 * that tests it.
 * @type {(input: {
 *   readonly iraRecords?: readonly Stored<Ira>[],
 *   readonly priorYearBasisForms?: readonly Stored<PriorYearIraBasis>[],
 *   readonly iraRetirementForms?: readonly Stored<OneZeroNineNineR>[],
 *   readonly allRetirementForms?: readonly Stored<OneZeroNineNineR>[],
 *   readonly anyFilerBornBeforeJan2_1961?: boolean,
 * }) => IraTaxableAmountOutcome}
 */
const run = input => {
    const iraRetirementForms = input.iraRetirementForms ?? []
    return iraTaxableAmount(params)({
        iraRecords: input.iraRecords ?? [],
        priorYearBasisForms: input.priorYearBasisForms ?? [],
        iraRetirementForms,
        allRetirementForms: input.allRetirementForms ?? iraRetirementForms,
        anyFilerBornBeforeJan2_1961: input.anyFilerBornBeforeJan2_1961 ?? true,
        line4bBeforeIraRecords: boxTwoASum(iraRetirementForms),
    })
}

/** Narrows an outcome to its refusal arm, throwing rather than casting.
 * @type {(outcome: IraTaxableAmountOutcome) => string}
 */
const refusalMessage = outcome => {
    assert(outcome.kind === 'error', ['expected a refusal', outcome])
    if (outcome.kind !== 'error') {
        return ''
    }
    return outcome.message
}

/** Narrows an outcome to its ok arm, throwing rather than casting.
 * @type {(outcome: IraTaxableAmountOutcome) => IraTaxableAmount}
 */
const computed = outcome => {
    assert(outcome.kind === 'ok', ['expected a computed line 4b', outcome])
    if (outcome.kind !== 'ok') {
        throw ['unreachable', outcome]
    }
    return outcome
}

/** The ONE IRA in most fixtures: $50,000 distributed by payer 11-1111111. */
const singleIra = iraForm('sha256-1099r-a')('11-1111111')('IRA-0001')('50000.00')

/** @type {Ira} */
const bareRecord = {
    dialect: 'vnd.fjs.ira',
    recipientTin: recipient,
    taxYear: 2025,
}

/** A $20,000 gift out of {@link singleIra}. */
const twentyThousandGift = {
    payerTin: '11-1111111',
    accountNumber: 'IRA-0001',
    charity: 'Riverside Food Bank',
    amount: '20000.00',
}

export const proof = {
    // ── Criterion 4, expressed as an identity ───────────────────────────────
    //
    // A retiree with neither a QCD nor a basis gets the CALLER'S OWN line 4b
    // object back — not an equal one, the same one. `assertEq` on the object
    // identity is what makes that structural rather than a coincidence of two
    // implementations agreeing today.
    aReturnWithNoIraRecordGetsItsOwnLineFourBObjectBack: () => {
        const base = boxTwoASum([singleIra])
        const outcome = iraTaxableAmount(params)({
            iraRecords: [],
            priorYearBasisForms: [],
            iraRetirementForms: [singleIra],
            allRetirementForms: [singleIra],
            anyFilerBornBeforeJan2_1961: false,
            line4bBeforeIraRecords: base,
        })
        const ok = computed(outcome)
        assertEq(ok.line4b, base, 'the very same object, not merely an equal one')
        assertEq(ok.line4b.value, 5000000n, '$50,000.00, exactly as before this phase')
        assertEq(ok.qcdExclusionCents, 0n)
        assertEq(Object.keys(ok.partIByRecipientTin).length, 0)
    },
    // A record that carries NEITHER half is a real, valid state and must also
    // change nothing. Without this leaf, "no record" and "an empty record"
    // could diverge and only one of them would be tested.
    anEmptyIraRecordChangesNothing: () => {
        const ok = computed(run({
            iraRecords: [storedRecord(bareRecord)],
            iraRetirementForms: [singleIra],
        }))
        assertEq(ok.line4b.value, 5000000n)
        assertEq(ok.qcdExclusionCents, 0n)
        assertEq(ok.line4b.sources.length, 1, 'one citation, the 1099-R box 2a it always had')
    },
    // ── TAX-28: the QCD reduces line 4b ─────────────────────────────────────
    qcd: {
        // The headline case, hand-derived: a $50,000 IRA distribution of
        // which $20,000 went straight to a food bank. Line 4a is the caller's
        // and stays $50,000 (`fjs/form1040/core` proves that half); line 4b is
        // $50,000.00 - $20,000.00 = $30,000.00.
        aTwentyThousandGiftOutOfAFiftyThousandDistribution: () => {
            const ok = computed(run({
                iraRecords: [storedRecord({
                    ...bareRecord,
                    attainedAgeSeventyAndAHalfAtEveryDistributionBelow: true,
                    qualifiedCharitableDistributions: [twentyThousandGift],
                })],
                iraRetirementForms: [singleIra],
            }))
            assertEq(ok.qcdExclusionCents, 2000000n, '$20,000.00 excluded')
            assertEq(ok.line4b.value, 3000000n, '$50,000.00 - $20,000.00')
            // PROV-02: the exclusion cites the assertion it came from, by
            // charity, so an auditor can find the gift rather than a total.
            assert(
                ok.line4b.sources.some(source =>
                    source.documentHash === recordHash
                    && source.boxPath === 'qualifiedCharitableDistributions[charity=Riverside Food Bank]'
                    && source.value === '20000.00'),
                ['the QCD must cite the entry it came from', ok.line4b.sources],
            )
        },
        // The whole distribution given away: line 4b is exactly zero, which
        // is the printed instruction's own first case ("If the total amount
        // distributed is a QCD, enter -0- on line 4b"). ±1¢ at the boundary:
        // one cent less leaves one cent taxable.
        theWholeDistributionGivenAwayLeavesZeroAndOneCentLessLeavesOneCent: () => {
            const whole = computed(run({
                iraRecords: [storedRecord({
                    ...bareRecord,
                    attainedAgeSeventyAndAHalfAtEveryDistributionBelow: true,
                    qualifiedCharitableDistributions: [{ ...twentyThousandGift, amount: '50000.00' }],
                })],
                iraRetirementForms: [singleIra],
            }))
            assertEq(whole.line4b.value, 0n, '-0- on line 4b')
            const oneCentLess = computed(run({
                iraRecords: [storedRecord({
                    ...bareRecord,
                    attainedAgeSeventyAndAHalfAtEveryDistributionBelow: true,
                    qualifiedCharitableDistributions: [{ ...twentyThousandGift, amount: '49999.99' }],
                })],
                iraRetirementForms: [singleIra],
            }))
            assertEq(oneCentLess.line4b.value, 1n, 'one cent taxable')
        },
        // Two gifts out of two DIFFERENT accounts, both excluded, summed
        // across accounts. $50,000 + $30,000 distributed, $20,000 + $5,000
        // given: line 4b = $80,000.00 - $25,000.00 = $55,000.00.
        twoGiftsOutOfTwoAccounts: () => {
            const second = iraForm('sha256-1099r-b')('44-4444444')('IRA-0002')('30000.00')
            const ok = computed(run({
                iraRecords: [storedRecord({
                    ...bareRecord,
                    attainedAgeSeventyAndAHalfAtEveryDistributionBelow: true,
                    qualifiedCharitableDistributions: [
                        twentyThousandGift,
                        {
                            payerTin: '44-4444444',
                            accountNumber: 'IRA-0002',
                            charity: 'Town Library',
                            amount: '5000.00',
                        },
                    ],
                })],
                iraRetirementForms: [singleIra, second],
            }))
            assertEq(ok.qcdExclusionCents, 2500000n)
            assertEq(ok.line4b.value, 5500000n, '$80,000.00 - $25,000.00')
        },
        // §408(d)(8)(A)'s cap, CAPPED rather than refused, at both boundaries
        // ±1¢. A $200,000 distribution with $200,000 given away excludes
        // exactly $108,000: line 4b = $200,000.00 - $108,000.00 = $92,000.00.
        theAnnualCapIsAppliedAtItsExactBoundary: () => {
            const big = iraForm('sha256-1099r-big')('11-1111111')('IRA-BIG')('200000.00')
            /** @type {(amount: string) => bigint} */
            const excludedFor = amount => computed(run({
                iraRecords: [storedRecord({
                    ...bareRecord,
                    attainedAgeSeventyAndAHalfAtEveryDistributionBelow: true,
                    qualifiedCharitableDistributions: [{
                        payerTin: '11-1111111',
                        accountNumber: 'IRA-BIG',
                        charity: 'Riverside Food Bank',
                        amount,
                    }],
                })],
                iraRetirementForms: [big],
            })).qcdExclusionCents
            // One cent under the cap is excluded in full.
            assertEq(excludedFor('107999.99'), 10799999n)
            // Exactly the cap is excluded in full.
            assertEq(excludedFor('108000.00'), 10800000n)
            // One cent over is capped BACK to the cap — the excess is
            // includible, which is what §408(d)(8)(A) says in terms.
            assertEq(excludedFor('108000.01'), 10800000n)
            assertEq(excludedFor('200000.00'), 10800000n)
        },
        // The cap is per INDIVIDUAL. Two people, two records, two IRAs, each
        // giving $108,000: $216,000 is excluded, not $108,000. A design that
        // pooled the two would fail here and nowhere else.
        twoPeopleGetTwoSeparateCaps: () => {
            const hers = iraForm('sha256-1099r-h')('11-1111111')('IRA-H')('150000.00')
            /** @type {Stored<OneZeroNineNineR>} */
            const his = {
                documentHash: 'sha256-1099r-i',
                value: { ...hers.value, recipientTin: spouseTin, accountNumber: 'IRA-I' },
            }
            /** @type {(tin: string) => (account: string) => Stored<Ira>} */
            const recordFor = tin => account => ({
                documentHash: `sha256-ira-${tin}`,
                value: {
                    ...bareRecord,
                    recipientTin: tin,
                    attainedAgeSeventyAndAHalfAtEveryDistributionBelow: true,
                    qualifiedCharitableDistributions: [{
                        payerTin: '11-1111111',
                        accountNumber: account,
                        charity: 'Riverside Food Bank',
                        amount: '108000.00',
                    }],
                },
            })
            const ok = computed(run({
                iraRecords: [recordFor(recipient)('IRA-H'), recordFor(spouseTin)('IRA-I')],
                iraRetirementForms: [hers, his],
            }))
            assertEq(ok.qcdExclusionCents, 21600000n, 'two $108,000 caps, not one')
            assertEq(ok.line4b.value, 8400000n, '$300,000.00 - $216,000.00')
        },
    },
    // ── TAX-28's refusals, each with its control ────────────────────────────
    qcdRefusals: {
        // THE 70½ FINDING, as a proof. The assertion is absent, so the whole
        // return refuses — never silently granting the exclusion on the
        // strength of the 65 checkbox, and never silently denying it.
        anAbsentAgeAssertionRefusesNamingTheProvisionAndTheReason: () => {
            const message = refusalMessage(run({
                iraRecords: [storedRecord({
                    ...bareRecord,
                    qualifiedCharitableDistributions: [twentyThousandGift],
                })],
                iraRetirementForms: [singleIra],
            }))
            assert(message.includes('§408(d)(8)(B)(ii)'), ['name the provision', message])
            assert(message.includes('70½'), ['name the age', message])
            assert(
                message.includes('attainedAgeSeventyAndAHalfAtEveryDistributionBelow'),
                ['name the field the taxpayer must supply', message])
            // The informative half, which AGENTS.md records a phase shipping
            // without: WHY the engine cannot determine it. Both reasons are
            // separately erasable at the site, so erasing either reddens this.
            assert(
                message.includes('taxpayerBornBeforeJan2_1961'),
                ['name the nearest fact and why it is not this one', message])
            assert(message.includes('box 13'), ['name the missing date', message])
        },
        // The CONTROL: the identical return WITH the assertion computes. A
        // gate that refused every QCD would pass the leaf above.
        theSameReturnWithTheAssertionComputes: () => {
            const ok = computed(run({
                iraRecords: [storedRecord({
                    ...bareRecord,
                    attainedAgeSeventyAndAHalfAtEveryDistributionBelow: true,
                    qualifiedCharitableDistributions: [twentyThousandGift],
                })],
                iraRetirementForms: [singleIra],
            }))
            assertEq(ok.line4b.value, 3000000n)
        },
        // The ONE direction that IS derivable: nobody who reached 70½ in 2025
        // can have been born after 1 January 1961, so an unchecked line-12d
        // box CONTRADICTS the assertion. Necessary, not sufficient — which is
        // why the leaf above exists as well as this one.
        anAssertionContradictedByTheProfileRefuses: () => {
            const message = refusalMessage(run({
                iraRecords: [storedRecord({
                    ...bareRecord,
                    attainedAgeSeventyAndAHalfAtEveryDistributionBelow: true,
                    qualifiedCharitableDistributions: [twentyThousandGift],
                })],
                iraRetirementForms: [singleIra],
                anyFilerBornBeforeJan2_1961: false,
            }))
            assert(message.includes('line-12d'), ['name the box that contradicts', message])
            assert(message.includes('1955'), ['show the arithmetic', message])
        },
        // §408(d)(8)(B): an IRA, never a 401(k) or a pension. The gift names a
        // real stored document whose box 7b is unchecked.
        aGiftFromAPensionRatherThanAnIraRefuses: () => {
            const pension = pensionForm('sha256-1099r-p')('99-9999999')('PENSION-1')('40000.00')
            const message = refusalMessage(run({
                iraRecords: [storedRecord({
                    ...bareRecord,
                    attainedAgeSeventyAndAHalfAtEveryDistributionBelow: true,
                    qualifiedCharitableDistributions: [{
                        payerTin: '99-9999999',
                        accountNumber: 'PENSION-1',
                        charity: 'Riverside Food Bank',
                        amount: '10000.00',
                    }],
                })],
                iraRetirementForms: [singleIra],
                allRetirementForms: [singleIra, pension],
            }))
            assert(message.includes('box 7b'), ['name the box that decides', message])
            assert(message.includes('§408(d)(8)(B)'), ['name the provision', message])
            assert(message.includes('line 5b'), ['name where that distribution DOES land', message])
        },
        // A gift larger than the distribution it claims to come from. The
        // ceiling is box 2a — the amount that would otherwise be included in
        // income — not box 1, and ±1¢ around it.
        aGiftLargerThanItsOwnDistributionRefusesAndOneCentLessDoesNot: () => {
            /** @type {(amount: string) => IraTaxableAmountOutcome} */
            const forAmount = amount => run({
                iraRecords: [storedRecord({
                    ...bareRecord,
                    attainedAgeSeventyAndAHalfAtEveryDistributionBelow: true,
                    qualifiedCharitableDistributions: [{ ...twentyThousandGift, amount }],
                })],
                iraRetirementForms: [singleIra],
            })
            const message = refusalMessage(forAmount('50000.01'))
            assert(message.includes('50000.01'), ['quote the gift', message])
            assert(message.includes('50000.00'), ['quote the box 2a it exceeds', message])
            assert(message.includes('§408(d)(8)(D)'), ['name the provision', message])
            assertEq(computed(forAmount('50000.00')).line4b.value, 0n, 'exactly equal is fine')
        },
        // Several gifts out of ONE distribution: each fits, the total does
        // not. Without the aggregate check this would drive line 4b negative,
        // so this leaf and its control are the pair that matter.
        threeGiftsFittingIndividuallyButNotTogetherRefuse: () => {
            /** @type {(each: string) => IraTaxableAmountOutcome} */
            const forEach = each => run({
                iraRecords: [storedRecord({
                    ...bareRecord,
                    attainedAgeSeventyAndAHalfAtEveryDistributionBelow: true,
                    qualifiedCharitableDistributions: [
                        { ...twentyThousandGift, charity: 'A', amount: each },
                        { ...twentyThousandGift, charity: 'B', amount: each },
                        { ...twentyThousandGift, charity: 'C', amount: each },
                    ],
                })],
                iraRetirementForms: [singleIra],
            })
            // 3 x $20,000 = $60,000 out of a $50,000 distribution.
            const message = refusalMessage(forEach('20000.00'))
            assert(message.includes('60000.00'), ['quote the total claimed', message])
            assert(message.includes('50000.00'), ['quote the box 2a it exceeds', message])
            assert(message.includes('not merely'), ['say that the TOTAL is what is limited', message])
            // The control, ±1¢ apart: 3 x $16,666.66 = $49,999.98 fits.
            const ok = computed(forEach('16666.66'))
            assertEq(ok.qcdExclusionCents, 4999998n)
            assertEq(ok.line4b.value, 2n, 'two cents left taxable')
        },
        // A gift naming a distribution that is not in the store at all.
        aGiftNamingNoStoredDistributionRefuses: () => {
            const message = refusalMessage(run({
                iraRecords: [storedRecord({
                    ...bareRecord,
                    attainedAgeSeventyAndAHalfAtEveryDistributionBelow: true,
                    qualifiedCharitableDistributions: [
                        { ...twentyThousandGift, accountNumber: 'IRA-NOWHERE' },
                    ],
                })],
                iraRetirementForms: [singleIra],
            }))
            assert(message.includes('IRA-NOWHERE'), ['name the account', message])
            assert(message.includes('no stored Form 1099-R'), ['say what is missing', message])
        },
        // …and one naming TWO. Which distribution the gift came out of
        // decides whether it is an IRA at all and what it may not exceed, so
        // taking the first is exactly the silent-resolution failure this
        // repository is organized against.
        aGiftNamingTwoStoredDistributionsRefuses: () => {
            const duplicate = iraForm('sha256-1099r-dup')('11-1111111')('IRA-0001')('10000.00')
            const message = refusalMessage(run({
                iraRecords: [storedRecord({
                    ...bareRecord,
                    attainedAgeSeventyAndAHalfAtEveryDistributionBelow: true,
                    qualifiedCharitableDistributions: [twentyThousandGift],
                })],
                iraRetirementForms: [singleIra, duplicate],
            }))
            assert(message.includes('2 stored Forms 1099-R'), ['say how many matched', message])
        },
        // A gift from a distribution whose box 2a is blank: there is no
        // "amount that would otherwise be included in your income" to limit
        // it against, so it is refused rather than measured against box 1.
        aGiftFromADistributionWithNoBoxTwoARefuses: () => {
            /** @type {Stored<OneZeroNineNineR>} */
            const noBox2a = {
                documentHash: 'sha256-1099r-nb',
                value: {
                    dialect: 'vnd.fjs.1099r',
                    payerTin: '11-1111111',
                    recipientTin: recipient,
                    accountNumber: 'IRA-0001',
                    taxYear: 2025,
                    formRevision: '2025',
                    box1GrossDistribution: '50000.00',
                    box2bTaxableAmountNotDetermined: true,
                    box7bIraSepSimple: true,
                },
            }
            const message = refusalMessage(run({
                iraRecords: [storedRecord({
                    ...bareRecord,
                    attainedAgeSeventyAndAHalfAtEveryDistributionBelow: true,
                    qualifiedCharitableDistributions: [twentyThousandGift],
                })],
                iraRetirementForms: [noBox2a],
            }))
            assert(message.includes('box 2a'), ['name the blank box', message])
            assert(message.includes('§408(d)(8)(D)'), ['name the provision', message])
        },
        // §408(d)(8)(F)'s one-time split-interest election, REFUSED BY NAME
        // rather than treated as an ordinary QCD — and the refusal quotes
        // BOTH stored limits, so a reader learns the sub-cap exists.
        theSplitInterestElectionIsRefusedByName: () => {
            const message = refusalMessage(run({
                iraRecords: [storedRecord({
                    ...bareRecord,
                    attainedAgeSeventyAndAHalfAtEveryDistributionBelow: true,
                    qualifiedCharitableDistributions: [
                        { ...twentyThousandGift, oneTimeSplitInterestElection: true },
                    ],
                })],
                iraRetirementForms: [singleIra],
            }))
            assert(message.includes('§408(d)(8)(F)'), ['name the provision', message])
            assert(message.includes('54000.00'), ['quote the sub-cap', message])
            assert(message.includes('108000.00'), ['quote the annual limit it sits inside', message])
            assert(message.includes('LIFETIME'), ['say why it cannot be modelled', message])
            assert(message.includes('statement'), ['name the second reason', message])
        },
    },
    // ── TAX-29: Form 8606 Part I ────────────────────────────────────────────
    form8606: {
        // The worked example, hand-derived line by line and independent of
        // this module's arithmetic.
        //
        //   line 1  nondeductible contributions for 2025      $0.00
        //   line 2  prior-year basis (2024 Form 8606 line 14) $20,000.00
        //   line 3  1 + 2                                     $20,000.00
        //   line 4  contributions made after year end         $0.00
        //   line 5  3 - 4                                     $20,000.00
        //   line 6  value of ALL IRAs at 31 Dec               $150,000.00
        //   line 7  distributions (no QCD here)               $50,000.00
        //   line 8  converted to Roth                         $0.00
        //   line 9  6 + 7 + 8                                 $200,000.00
        //   line 10 5 / 9 = 20,000 / 200,000 = 0.100          0.100
        //   line 12 7 x 10 = 50,000 x 0.100                   $5,000.00
        //   line 13 11 + 12                                   $5,000.00
        //   line 14 3 - 13 = 20,000 - 5,000                   $15,000.00
        //   line 15a 7 - 12 = 50,000 - 5,000                  $45,000.00
        //   line 15c                                          $45,000.00
        //
        // So 1040 line 4b is $45,000.00 rather than the $50,000.00 box 2a
        // reports — the $5,000 difference being after-tax money that would
        // otherwise have been taxed a second time.
        aBasisMakesPartOfTheDistributionNontaxable: () => {
            const ok = computed(run({
                iraRecords: [storedRecord({
                    ...bareRecord,
                    yearEndValueOfAllTraditionalSepSimpleIras: '150000.00',
                })],
                priorYearBasisForms: [storedBasis(recipient)('20000.00')],
                iraRetirementForms: [singleIra],
            }))
            assertEq(ok.line4b.value, 4500000n, '$45,000.00, not the $50,000.00 box 2a reports')
            const partI = ok.partIByRecipientTin[recipient]
            assert(partI !== undefined, ['expected a Part I for the recipient', ok])
            assertEq(partI.line3, 2000000n, '$20,000.00')
            assertEq(partI.line5, 2000000n)
            assertEq(partI.line9, 20000000n, '$200,000.00')
            assertEq(partI.line10Thousandths, 100n, '0.100')
            assertEq(partI.line12, 500000n, '$5,000.00 nontaxable')
            assertEq(partI.line14, 1500000n, '$15,000.00 of basis carried into next year')
            assertEq(partI.line15c, 4500000n)
            // PROV-02: line 4b cites the two assertions it read.
            assert(
                ok.line4b.sources.some(source =>
                    source.documentHash === basisHash
                    && source.boxPath === 'priorYearForm8606Line14'),
                ['line 4b must cite the prior-year basis it used', ok.line4b.sources])
            assert(
                ok.line4b.sources.some(source =>
                    source.boxPath === 'yearEndValueOfAllTraditionalSepSimpleIras'),
                ['line 4b must cite the year-end value it divided by', ok.line4b.sources])
        },
        // **The property the requirement singles out.** §408(d)(2) aggregates
        // ALL of a person's traditional/SEP/SIMPLE IRAs into one contract, so
        // holding the same money in two accounts must give the same answer as
        // holding it in one — and holding a SECOND account the distribution
        // did not come from must change the answer, because it enlarges the
        // denominator.
        //
        // Case A — ONE IRA, $150,000 left at year end, $50,000 distributed,
        // $20,000 basis: line 9 = 150,000 + 50,000 = 200,000, ratio 0.100,
        // nontaxable $5,000, line 4b $45,000.00.
        //
        // Case B — TWO IRAs at the SAME total: $50,000 distributed out of the
        // first, and the year-end value is $60,000 + $90,000 = $150,000
        // asserted as ONE aggregated figure. Identical, by construction.
        //
        // Case C — the distinguishing case: the SAME distribution and the
        // SAME basis, but a SECOND untouched IRA holding another $150,000, so
        // the aggregated year-end value is $300,000. Line 9 = 350,000, ratio
        // 20,000 / 350,000 = 0.0571..., which the printed line 10 rounds to
        // 0.057; nontaxable = 50,000 x 0.057 = $2,850.00; line 4b =
        // $47,150.00. A per-ACCOUNT implementation would answer $45,000.00
        // here — the same as case A — and that is the understatement this
        // leaf exists to catch.
        aggregationIsAcrossAllIrasNotPerAccount: () => {
            /** @type {(yearEndValue: string) => IraTaxableAmount} */
            const withYearEndValue = yearEndValue => computed(run({
                iraRecords: [storedRecord({
                    ...bareRecord,
                    yearEndValueOfAllTraditionalSepSimpleIras: yearEndValue,
                })],
                priorYearBasisForms: [storedBasis(recipient)('20000.00')],
                iraRetirementForms: [singleIra],
            }))
            const caseA = withYearEndValue('150000.00')
            assertEq(caseA.line4b.value, 4500000n, 'case A: $45,000.00')
            // Case B is case A's figure reached by adding two accounts by
            // hand, exactly as the taxpayer would: $60,000 + $90,000.
            const caseB = withYearEndValue('150000.00')
            assertEq(caseB.line4b.value, caseA.line4b.value, 'same total, same answer')
            const caseC = withYearEndValue('300000.00')
            const partIC = caseC.partIByRecipientTin[recipient]
            assert(partIC !== undefined, ['expected a Part I', caseC])
            assertEq(partIC.line9, 35000000n, '$350,000.00')
            assertEq(partIC.line10Thousandths, 57n, '20,000 / 350,000 = 0.0571 -> 0.057')
            assertEq(partIC.line12, 285000n, '$2,850.00')
            assertEq(caseC.line4b.value, 4715000n, 'case C: $47,150.00')
            // The whole point, stated as an inequality: the second IRA moves
            // the answer. A per-account implementation could not tell these
            // two apart.
            assert(
                caseC.line4b.value !== caseA.line4b.value,
                ['a second, untouched IRA must change the pro-rata fraction',
                    caseA.line4b.value, caseC.line4b.value],
            )
        },
        // Printed line 10's clamp: "If the result is 1.000 or more, enter
        // '1.000'." A basis at least as large as the whole aggregated IRA
        // makes the entire distribution nontaxable, and line 4b is zero —
        // never negative, and never more than 1.000 of it.
        aRatioAtOrAboveOneIsClampedAndTheDistributionIsWhollyNontaxable: () => {
            const ok = computed(run({
                iraRecords: [storedRecord({
                    ...bareRecord,
                    yearEndValueOfAllTraditionalSepSimpleIras: '0.00',
                })],
                priorYearBasisForms: [storedBasis(recipient)('60000.00')],
                iraRetirementForms: [singleIra],
            }))
            const partI = ok.partIByRecipientTin[recipient]
            assert(partI !== undefined, ['expected a Part I', ok])
            assertEq(partI.line9, 5000000n, 'only the $50,000 distributed')
            assertEq(partI.line10Thousandths, 1000n, 'clamped from 1.200')
            assertEq(partI.line12, 5000000n, 'the whole distribution')
            assertEq(ok.line4b.value, 0n)
            assertEq(partI.line14, 1000000n, '$60,000 - $50,000 = $10,000 of basis remains')
        },
        // `[FOUND BY A PROOF, then pinned here on purpose]` A basis LARGER
        // than what the IRAs are now worth is an ordinary return — it is what
        // a market loss after nondeductible contributions looks like — so the
        // pre-tax portion of the aggregate is NEGATIVE and §408(d)(8)(D) has
        // nothing to say about it, because no QCD was claimed. The first
        // draft of that gate omitted its `qcd > 0` term and refused every
        // such return; two leaves above caught it, and this one is the
        // control that says so by name rather than as a side effect.
        //
        // $50,000 distributed, nothing left at year end, $60,000 of basis:
        // line 9 = 50,000, line 5 = 60,000, ratio 1.200 clamped to 1.000, so
        // the whole distribution is nontaxable and line 4b is $0.00.
        aBasisLargerThanTheWholeAggregatedIraComputesWhenNoQcdIsClaimed: () => {
            const outcome = run({
                iraRecords: [storedRecord({
                    ...bareRecord,
                    yearEndValueOfAllTraditionalSepSimpleIras: '0.00',
                })],
                priorYearBasisForms: [storedBasis(recipient)('60000.00')],
                iraRetirementForms: [singleIra],
            })
            assertEq(outcome.kind, 'ok', 'a negative pre-tax portion is not a refusal on its own')
            assertEq(computed(outcome).line4b.value, 0n)
            // …and the SAME return with a $1.00 gift DOES refuse, which is
            // what makes the term above a gate rather than dead code.
            assertEq(run({
                iraRecords: [storedRecord({
                    ...bareRecord,
                    attainedAgeSeventyAndAHalfAtEveryDistributionBelow: true,
                    qualifiedCharitableDistributions: [{ ...twentyThousandGift, amount: '1.00' }],
                    yearEndValueOfAllTraditionalSepSimpleIras: '0.00',
                })],
                priorYearBasisForms: [storedBasis(recipient)('60000.00')],
                iraRetirementForms: [singleIra],
            }).kind, 'error')
        },
        // **`[FOUND BY MUTATION, and this leaf is the whole reason it exists]`**
        // Dropping the `recipientTin === tin` filter from the Forms 1099-R a
        // Part I computes over — pooling a married couple's two IRAs into one
        // pro-rata fraction each — left the ENTIRE suite green. Every other
        // two-person leaf in this file has no basis, so Part I never runs on
        // more than one person's documents, and `twoPeopleGetTwoSeparateCaps`
        // could not see it because the QCD cap is applied before Part I.
        //
        // Form 8606's own header is the rule: *"If married, file a separate
        // form for each spouse required to file 2025 Form 8606."* Two people,
        // two bases, two aggregated year-end values, two fractions.
        //
        //   HER  $50,000 distributed, $20,000 basis, $150,000 left at 31 Dec
        //        line 9 = 150,000 + 50,000 = 200,000
        //        line 10 = 20,000 / 200,000 = 0.100
        //        line 12 = 50,000 x 0.100 = 5,000; line 15c = 45,000
        //   HIS  $10,000 distributed, $10,000 basis, $30,000 left at 31 Dec
        //        line 9 = 30,000 + 10,000 = 40,000
        //        line 10 = 10,000 / 40,000 = 0.250
        //        line 12 = 10,000 x 0.250 = 2,500; line 15c = 7,500
        //
        //   1040 line 4b = 45,000 + 7,500 = $52,500.00
        //
        // Pooled — the mutation's answer — every Part I would see $60,000 of
        // distributions: hers 20,000/210,000 = 0.095 giving 15c = 54,300, his
        // 10,000/90,000 = 0.111 giving 15c = 53,340, and line 4b would be
        // 60,000 - 5,700 - 6,660 = $47,640.00. Nearly five thousand dollars
        // of income missing, with the suite fully green.
        twoPeoplesFormsAreTwoIndependentProRataFractions: () => {
            /** @type {(tin: string) => (account: string) => (amount: string) => Stored<OneZeroNineNineR> } */
            const formFor = tin => account => amount => ({
                documentHash: `sha256-1099r-${account}`,
                value: {
                    dialect: 'vnd.fjs.1099r',
                    payerTin: '11-1111111',
                    recipientTin: tin,
                    accountNumber: account,
                    taxYear: 2025,
                    formRevision: '2025',
                    box1GrossDistribution: amount,
                    box2aTaxableAmount: amount,
                    box7bIraSepSimple: true,
                },
            })
            /** @type {(tin: string) => (yearEndValue: string) => Stored<Ira>} */
            const recordFor = tin => yearEndValue => ({
                documentHash: `sha256-ira-${tin}`,
                value: {
                    ...bareRecord,
                    recipientTin: tin,
                    yearEndValueOfAllTraditionalSepSimpleIras: yearEndValue,
                },
            })
            const ok = computed(run({
                iraRecords: [
                    recordFor(recipient)('150000.00'),
                    recordFor(spouseTin)('30000.00'),
                ],
                priorYearBasisForms: [
                    storedBasis(recipient)('20000.00'),
                    storedBasis(spouseTin)('10000.00'),
                ],
                iraRetirementForms: [
                    formFor(recipient)('IRA-HERS')('50000.00'),
                    formFor(spouseTin)('IRA-HIS')('10000.00'),
                ],
            }))
            const hers = ok.partIByRecipientTin[recipient]
            const his = ok.partIByRecipientTin[spouseTin]
            assert(hers !== undefined && his !== undefined, ['expected two Part Is', ok])
            if (hers === undefined || his === undefined) {
                return
            }
            assertEq(hers.line7, 5000000n, 'HER distributions only')
            assertEq(hers.line9, 20000000n)
            assertEq(hers.line10Thousandths, 100n, '0.100')
            assertEq(hers.line15c, 4500000n, '$45,000.00')
            assertEq(his.line7, 1000000n, 'HIS distributions only')
            assertEq(his.line9, 4000000n)
            assertEq(his.line10Thousandths, 250n, '0.250')
            assertEq(his.line15c, 750000n, '$7,500.00')
            assertEq(ok.line4b.value, 5250000n, '$52,500.00')
            // The two fractions really are different, so a pooled
            // implementation could not produce both.
            assert(
                hers.line10Thousandths !== his.line10Thousandths,
                ['the two fractions must differ', hers.line10Thousandths, his.line10Thousandths],
            )
        },
        // The printed mid-Part-I branch: no distribution and no conversion
        // means line 3 goes straight to line 14 and the rest of Part I stays
        // blank. This is also the only path on which line 9 would be zero, so
        // it is the branch that keeps line 10 from dividing by zero.
        theNoDistributionBranchCarriesTheWholeBasisForward: () => {
            const ok = computed(run({
                iraRecords: [storedRecord({
                    ...bareRecord,
                    nondeductibleContributionsThisYear: '7000.00',
                    contributionsMadeAfterYearEnd: '7000.00',
                })],
                priorYearBasisForms: [storedBasis(recipient)('20000.00')],
                iraRetirementForms: [],
            }))
            const partI = ok.partIByRecipientTin[recipient]
            assert(partI !== undefined, ['expected a Part I', ok])
            assertEq(partI.line3, 2700000n, '$7,000 + $20,000')
            assertEq(partI.line14, 2700000n, 'line 3 straight onto line 14')
            assertEq(partI.line9, 0n, 'the rest of Part I stays blank')
            assertEq(partI.line10Thousandths, 0n)
            assertEq(ok.line4b.value, 0n)
        },
        // Line 8 is structurally zero because a non-zero one is refused, so
        // line 11 can never be non-zero. Asserted rather than described —
        // `fjs/form8889`'s own `theCatchUpIsInLineThreeAndLineSevenIsUnreachable`
        // idiom.
        lineElevenIsUnreachableBecauseLineEightIsRefused: () => {
            const partI = form8606PartI({
                line1NondeductibleContributionsCents: 0n,
                line2PriorYearBasisCents: 2000000n,
                line4ContributionsMadeAfterYearEndCents: 0n,
                line6YearEndValueOfAllIrasCents: 15000000n,
                line7DistributionsExcludingQcdCents: 5000000n,
            })
            assertEq(partI.line8, 0n)
            assertEq(partI.line11, 0n)
            // …and the refusal that makes it so.
            const message = refusalMessage(run({
                iraRecords: [storedRecord({
                    ...bareRecord,
                    netAmountConvertedToRothIras: '10000.00',
                    yearEndValueOfAllTraditionalSepSimpleIras: '150000.00',
                })],
                priorYearBasisForms: [storedBasis(recipient)('20000.00')],
                iraRetirementForms: [singleIra],
            }))
            assert(message.includes('Part II'), ['name the part', message])
            assert(message.includes('line 18'), ['name what would also land on 1040 line 4b', message])
            assert(message.includes('§408A(d)(3)'), ['name the unmodelled regime', message])
            // A conversion of exactly zero is a real assertion and is NOT
            // refused — the control that keeps the gate from firing on
            // everything.
            assertEq(run({
                iraRecords: [storedRecord({
                    ...bareRecord,
                    netAmountConvertedToRothIras: '0.00',
                    yearEndValueOfAllTraditionalSepSimpleIras: '150000.00',
                })],
                priorYearBasisForms: [storedBasis(recipient)('20000.00')],
                iraRetirementForms: [singleIra],
            }).kind, 'ok')
        },
    },
    // ── TAX-29's refusals ───────────────────────────────────────────────────
    form8606Refusals: {
        // **The crux refusal.** A basis exists, distributions exist, and the
        // aggregated year-end value does not — so the pro-rata denominator is
        // missing and there is no defensible default.
        anAbsentYearEndValueRefusesRatherThanDefaultingToZero: () => {
            const message = refusalMessage(run({
                iraRecords: [storedRecord(bareRecord)],
                priorYearBasisForms: [storedBasis(recipient)('20000.00')],
                iraRetirementForms: [singleIra],
            }))
            assert(
                message.includes('yearEndValueOfAllTraditionalSepSimpleIras'),
                ['name the field the taxpayer must supply', message])
            assert(message.includes('§408(d)(2)'), ['name the aggregation rule', message])
            assert(message.includes('ALL'), ['say that it is every account', message])
            assert(message.includes('May 31'), ['say why no document supplies it', message])
            assert(
                message.includes('every distribution nontaxable'),
                ['say what treating it as zero would do', message])
            // The control: supply it and the identical return computes.
            assertEq(run({
                iraRecords: [storedRecord({
                    ...bareRecord,
                    yearEndValueOfAllTraditionalSepSimpleIras: '150000.00',
                })],
                priorYearBasisForms: [storedBasis(recipient)('20000.00')],
                iraRetirementForms: [singleIra],
            }).kind, 'ok')
        },
        // A stored basis with no `vnd.fjs.ira` record beside it is REFUSED,
        // not ignored. Ignoring it is the double-taxation this requirement
        // exists to close, arriving by a different route.
        aBasisWithNoIraRecordRefusesRatherThanBeingIgnored: () => {
            const message = refusalMessage(run({
                priorYearBasisForms: [storedBasis(recipient)('20000.00')],
                iraRetirementForms: [singleIra],
            }))
            assert(message.includes('20000.00'), ['quote the basis being dropped', message])
            assert(message.includes('vnd.fjs.ira'), ['name the missing document', message])
            assert(message.includes('second time'), ['say what ignoring it would cost', message])
        },
        // …and the same, for a basis belonging to a person who has a record
        // under a DIFFERENT TIN. A per-return design would have matched these
        // two up; a per-person one must not.
        aBasisForOnePersonBesideARecordForAnotherRefuses: () => {
            const message = refusalMessage(run({
                iraRecords: [storedRecord({
                    ...bareRecord,
                    yearEndValueOfAllTraditionalSepSimpleIras: '150000.00',
                })],
                priorYearBasisForms: [storedBasis(spouseTin)('20000.00')],
                iraRetirementForms: [singleIra],
            }))
            assert(message.includes(spouseTin), ['name whose basis is orphaned', message])
        },
        twoRecordsForOnePersonRefuse: () => {
            const message = refusalMessage(run({
                iraRecords: [storedRecord(bareRecord), storedRecord(bareRecord)],
                iraRetirementForms: [singleIra],
            }))
            assert(message.includes('one form per person'), ['say the rule', message])
            assert(message.includes(recipient), ['name the person', message])
        },
        twoBasisDocumentsForOnePersonRefuse: () => {
            const message = refusalMessage(run({
                iraRecords: [storedRecord({
                    ...bareRecord,
                    yearEndValueOfAllTraditionalSepSimpleIras: '150000.00',
                })],
                priorYearBasisForms: [
                    storedBasis(recipient)('20000.00'),
                    storedBasis(recipient)('30000.00'),
                ],
                iraRetirementForms: [singleIra],
            }))
            assert(message.includes('one figure'), ['say the rule', message])
        },
        // Part III, detected off the DOCUMENT rather than off an assertion —
        // the half a fields-only design would have missed. One leaf per Roth
        // code, generated from the list, plus the hand-typed count beside it.
        everyRothDistributionCodeRefusesPartThree: () => {
            assertEq(rothDistributionCodes.length, 3, 'hand-counted: J, T and Q')
            assertEq(rothDistributionCodes[0], 'J')
            assertEq(rothDistributionCodes[1], 'T')
            assertEq(rothDistributionCodes[2], 'Q')
            for (const code of rothDistributionCodes) {
                /** @type {Stored<OneZeroNineNineR>} */
                const roth = {
                    documentHash: `sha256-1099r-roth-${code}`,
                    value: {
                        dialect: 'vnd.fjs.1099r',
                        payerTin: '77-7777777',
                        recipientTin: recipient,
                        accountNumber: 'ROTH-1',
                        taxYear: 2025,
                        formRevision: '2025',
                        box1GrossDistribution: '9000.00',
                        box7aDistributionCodes: [code],
                    },
                }
                const message = refusalMessage(run({
                    iraRecords: [storedRecord({
                        ...bareRecord,
                        yearEndValueOfAllTraditionalSepSimpleIras: '150000.00',
                    })],
                    priorYearBasisForms: [storedBasis(recipient)('20000.00')],
                    iraRetirementForms: [singleIra],
                    allRetirementForms: [singleIra, roth],
                }))
                assert(message.includes(`code ${code}`), ['quote the code', code, message])
                assert(message.includes('Part III'), ['name the part', code, message])
                assert(message.includes('§408A(d)(2)'), ['name the five-year clock', code, message])
            }
            // The CONTROL, and the one that stops this gate from firing on
            // every retiree: code `B` is a designated Roth account inside an
            // employer plan — a 1040 line 5b pension with nothing to do with
            // Form 8606 — and must NOT refuse. A list written as "anything
            // Roth-shaped" would fail here.
            /** @type {Stored<OneZeroNineNineR>} */
            const designatedRoth = {
                documentHash: 'sha256-1099r-b',
                value: {
                    dialect: 'vnd.fjs.1099r',
                    payerTin: '88-8888888',
                    recipientTin: recipient,
                    accountNumber: 'PLAN-1',
                    taxYear: 2025,
                    formRevision: '2025',
                    box1GrossDistribution: '9000.00',
                    box7aDistributionCodes: ['B'],
                },
            }
            assertEq(run({
                iraRecords: [storedRecord({
                    ...bareRecord,
                    yearEndValueOfAllTraditionalSepSimpleIras: '150000.00',
                })],
                priorYearBasisForms: [storedBasis(recipient)('20000.00')],
                iraRetirementForms: [singleIra],
                allRetirementForms: [singleIra, designatedRoth],
            }).kind, 'ok', 'code B is a designated Roth account, not a Roth IRA')
        },
        // The two flags that exist only to be refused by name.
        theTwoUnmodelledFactFlagsRefuseByName: () => {
            const rollover = refusalMessage(run({
                iraRecords: [storedRecord({
                    ...bareRecord,
                    hadOutstandingRolloverOrRecharacterization: true,
                })],
                iraRetirementForms: [singleIra],
            }))
            assert(rollover.includes('line 6'), ['name the line it changes', rollover])
            assert(rollover.includes('line 7'), ['name the other line', rollover])
            assert(rollover.includes('recharacterization'), ['name the fact', rollover])
            const disaster = refusalMessage(run({
                iraRecords: [storedRecord({
                    ...bareRecord,
                    hadQualifiedDisasterDistributionOrPlanRepayment: true,
                })],
                iraRetirementForms: [singleIra],
            }))
            assert(disaster.includes('8915-F'), ['name the form', disaster])
            assert(disaster.includes('Line 15c Worksheet'), ['name the worksheet', disaster])
            // The control: the same return without either flag computes.
            assertEq(run({
                iraRecords: [storedRecord(bareRecord)],
                iraRetirementForms: [singleIra],
            }).kind, 'ok')
        },
    },
    // ── The interaction the two requirements share ──────────────────────────
    orderingOfQcdAgainstProRata: {
        // §408(d)(8)(D): a QCD comes FIRST out of otherwise taxable income,
        // and Form 8606's line 7 implements that by excluding it. Both
        // consequences are hand-derived here against the SAME taxpayer with
        // and without the gift, so the difference is attributable to the gift
        // alone.
        //
        // Common facts: $50,000 distributed, $20,000 prior-year basis,
        // $150,000 of aggregated IRAs left at 31 December.
        //
        // WITHOUT the gift (the `form8606` worked example above):
        //   line 7 = 50,000; line 9 = 150,000 + 50,000 = 200,000
        //   line 10 = 20,000 / 200,000 = 0.100
        //   line 12 = 50,000 x 0.100 = 5,000; line 14 = 20,000 - 5,000 = 15,000
        //   line 15c = 50,000 - 5,000 = 45,000
        //
        // WITH a $20,000 QCD:
        //   line 7 = 50,000 - 20,000 = 30,000   <- the exclusion, and the
        //                                          ONLY place the gift enters
        //   line 9 = 150,000 + 30,000 = 180,000
        //   line 10 = 20,000 / 180,000 = 0.1111 -> 0.111
        //   line 12 = 30,000 x 0.111 = 3,330; line 14 = 20,000 - 3,330 = 16,670
        //   line 15c = 30,000 - 3,330 = 26,670
        //
        // Two things to read off that: the RATIO went UP (0.100 -> 0.111),
        // because the same basis is spread over a smaller line 9; and the
        // basis carried forward went UP too (15,000 -> 16,670), because the
        // gift did not absorb any of it. Both are §408(d)(8)(D) working.
        theQcdComesOffThePreTaxPortionAndDoesNotAbsorbBasis: () => {
            /** @type {(qcd: readonly { readonly payerTin: string, readonly accountNumber: string, readonly charity: string, readonly amount: string }[]) => IraTaxableAmount} */
            const withGifts = qcd => computed(run({
                iraRecords: [storedRecord({
                    ...bareRecord,
                    attainedAgeSeventyAndAHalfAtEveryDistributionBelow: true,
                    qualifiedCharitableDistributions: qcd,
                    yearEndValueOfAllTraditionalSepSimpleIras: '150000.00',
                })],
                priorYearBasisForms: [storedBasis(recipient)('20000.00')],
                iraRetirementForms: [singleIra],
            }))
            const without = withGifts([])
            const withGift = withGifts([twentyThousandGift])
            const partIWithout = without.partIByRecipientTin[recipient]
            const partIWith = withGift.partIByRecipientTin[recipient]
            assert(partIWithout !== undefined && partIWith !== undefined, ['expected both'])
            if (partIWithout === undefined || partIWith === undefined) {
                return
            }
            assertEq(partIWithout.line7, 5000000n, '$50,000.00')
            assertEq(partIWithout.line10Thousandths, 100n, '0.100')
            assertEq(partIWithout.line14, 1500000n, '$15,000.00')
            assertEq(without.line4b.value, 4500000n, '$45,000.00')
            assertEq(partIWith.line7, 3000000n, '$30,000.00 — the gift is OUT of line 7')
            assertEq(partIWith.line9, 18000000n, '$180,000.00')
            assertEq(partIWith.line10Thousandths, 111n, '20,000 / 180,000 = 0.1111 -> 0.111')
            assertEq(partIWith.line12, 333000n, '$3,330.00')
            assertEq(partIWith.line14, 1667000n, '$16,670.00 of basis carried forward')
            assertEq(withGift.line4b.value, 2667000n, '$26,670.00 on 1040 line 4b')
            // The gift did NOT absorb basis: next year's line 2 is LARGER
            // with the gift than without it.
            assert(
                partIWith.line14 > partIWithout.line14,
                ['a QCD must not absorb basis', partIWith.line14, partIWithout.line14],
            )
            // And the ratio rose rather than fell.
            assert(
                partIWith.line10Thousandths > partIWithout.line10Thousandths,
                ['the pro-rata fraction must rise', partIWith.line10Thousandths],
            )
        },
        // §408(d)(8)(D)'s pre-tax ceiling, REFUSED rather than capped. The
        // aggregated IRA is $50,000 distributed plus $10,000 left, against a
        // $45,000 basis — so only $15,000 of it is pre-tax, and a $20,000
        // gift runs "first out of income" out of income.
        aQcdLargerThanThePreTaxPortionRefusesNamingTheArithmetic: () => {
            const message = refusalMessage(run({
                iraRecords: [storedRecord({
                    ...bareRecord,
                    attainedAgeSeventyAndAHalfAtEveryDistributionBelow: true,
                    qualifiedCharitableDistributions: [twentyThousandGift],
                    yearEndValueOfAllTraditionalSepSimpleIras: '10000.00',
                })],
                priorYearBasisForms: [storedBasis(recipient)('45000.00')],
                iraRetirementForms: [singleIra],
            }))
            assert(message.includes('20000.00'), ['quote the gift', message])
            assert(message.includes('15000.00'), ['quote the pre-tax portion', message])
            assert(message.includes('45000.00'), ['quote the basis', message])
            assert(message.includes('§408(d)(8)(D)'), ['name the provision', message])
            assert(message.includes('fixed point'), ['say why it is refused rather than capped', message])
            // ±1¢ at the ceiling: exactly the pre-tax portion is fine.
            // $15,000 given away out of $50,000 leaves line 7 = $35,000;
            // line 9 = 35,000 + 10,000 = 45,000; line 5 = 45,000; ratio =
            // 45,000 / 45,000 = 1.000 (clamped); line 12 = 35,000; line 15c =
            // $0.00 — the whole remainder is basis, which is exactly what
            // "the pre-tax portion has been given away" means.
            const atTheCeiling = computed(run({
                iraRecords: [storedRecord({
                    ...bareRecord,
                    attainedAgeSeventyAndAHalfAtEveryDistributionBelow: true,
                    qualifiedCharitableDistributions: [
                        { ...twentyThousandGift, amount: '15000.00' },
                    ],
                    yearEndValueOfAllTraditionalSepSimpleIras: '10000.00',
                })],
                priorYearBasisForms: [storedBasis(recipient)('45000.00')],
                iraRetirementForms: [singleIra],
            }))
            const partI = atTheCeiling.partIByRecipientTin[recipient]
            assert(partI !== undefined, ['expected a Part I', atTheCeiling])
            assertEq(partI.line7, 3500000n, '$35,000.00')
            assertEq(partI.line10Thousandths, 1000n, 'clamped at 1.000')
            assertEq(atTheCeiling.line4b.value, 0n)
            // …and one cent more refuses.
            assertEq(run({
                iraRecords: [storedRecord({
                    ...bareRecord,
                    attainedAgeSeventyAndAHalfAtEveryDistributionBelow: true,
                    qualifiedCharitableDistributions: [
                        { ...twentyThousandGift, amount: '15000.01' },
                    ],
                    yearEndValueOfAllTraditionalSepSimpleIras: '10000.00',
                })],
                priorYearBasisForms: [storedBasis(recipient)('45000.00')],
                iraRetirementForms: [singleIra],
            }).kind, 'error')
        },
    },
    // The rounding point is the RATIO, to three places, and then the product
    // to the cent — `fjs/schedule/1`'s own recorded reading of the identical
    // printed sentence. This leaf is what constrains the ORDER: at a line 5
    // of $20,000 over a line 9 of $350,000 the exact ratio is 0.0571428…,
    // which the printed line 10 rounds to 0.057 and the alternative (one
    // rounding at the end) would not.
    //
    //   printed:     50,000 x 0.057                     = $2,850.00
    //   alternative: round(50,000 x 20,000 / 350,000)    = $2,857.14
    //
    // Twenty-eight dollars and fourteen cents apart on one distribution, and
    // nothing else in this file would notice the difference.
    theRoundingPointIsTheRatioNotTheProduct: () => {
        const partI = form8606PartI({
            line1NondeductibleContributionsCents: 0n,
            line2PriorYearBasisCents: 2000000n,
            line4ContributionsMadeAfterYearEndCents: 0n,
            line6YearEndValueOfAllIrasCents: 30000000n,
            line7DistributionsExcludingQcdCents: 5000000n,
        })
        assertEq(partI.line9, 35000000n)
        assertEq(partI.line10Thousandths, 57n)
        assertEq(partI.line12, 285000n, 'the printed order: $2,850.00')
        // The alternative, computed here independently so the two figures are
        // genuinely different numbers rather than a claim about them.
        assertEq(halfUp(of(5000000n * 2000000n)(35000000n)), 285714n, 'one rounding: $2,857.14')
        assert(partI.line12 !== 285714n, 'the two orders must genuinely differ here')
    },
    // Nothing on this module's own output is a rounded-then-summed figure:
    // there are exactly two rounding points, and both are inside line 10 and
    // line 12. Stated as a leaf so a third one added later has to argue.
    thereAreExactlyTwoRoundingPoints: () => {
        // Every other line is a sum, a difference or a comparison over exact
        // cents, so doubling every input doubles every line EXCEPT where a
        // ratio rounds. line 10's ratio is scale-invariant, so doubling the
        // inputs must double lines 12, 13, 15a and 15c exactly.
        /** @type {(scale: bigint) => Form8606PartI} */
        const at = scale => form8606PartI({
            line1NondeductibleContributionsCents: 0n,
            line2PriorYearBasisCents: 2000000n * scale,
            line4ContributionsMadeAfterYearEndCents: 0n,
            line6YearEndValueOfAllIrasCents: 15000000n * scale,
            line7DistributionsExcludingQcdCents: 5000000n * scale,
        })
        const single = at(1n)
        const doubled = at(2n)
        assertEq(doubled.line10Thousandths, single.line10Thousandths, 'the ratio is scale-free')
        assertEq(doubled.line12, single.line12 * 2n)
        assertEq(doubled.line15c, single.line15c * 2n)
        assertEq(doubled.line14, single.line14 * 2n)
    },
}
