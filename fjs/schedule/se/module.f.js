/**
 * Schedule SE (Form 1040) — TAX-31: *Self-Employment Tax*, Part I transcribed
 * line for line, one named pure function per printed line group (TAX-15).
 *
 * Source, transcribed from the printed 2025 `f1040sse.pdf` face: Part I
 * (Self-Employment Tax, lines 1a-13) and Part II (Optional Methods To Figure
 * Net Earnings, lines 14-17).
 *
 * **This is the form Phase 27 refused for.** `fjs/schedule/c`'s
 * `selfEmploymentTaxReachIsUnmodeled` refused every Schedule C net profit at
 * or above §1402(b)(2)'s $400, because self-employment tax is not elective
 * and a filer would otherwise have received a complete-looking 1040 with
 * Schedule 2 line 4 at zero — about $7,000 short on a $50,000 profit. That
 * refusal is deleted in the same commit that wires this module, and Phase
 * 27's leaf for it is re-pointed rather than removed: the band it named,
 * $400.00 to $433.12 of net profit, is now the band this form COMPUTES a
 * $0.00 tax for, and the boundary between owing and not owing has moved to
 * the exact cent §1402(a)(12) puts it at. See
 * {@link proof.theFourHundredDollarFloorIsAppliedToNetEARNINGS}.
 *
 * ## Part I is arithmetic; the two things it reads are handed in
 *
 * Pure over `bigint` cents plus one document read, keyed by the printed line
 * numbers — the shape `fjs/form8959`, `fjs/tax/ssb` and `fjs/tax/line16/qdcgt`
 * already have. {@link scheduleSelfEmploymentPartI} builds NO
 * {@link ReportLine}s: provenance is `fjs/schedule/1`'s job, exactly as
 * Form 8959's is `fjs/schedule/2`'s, and for the same reason — only the
 * figures that reach a printed 1040 or schedule line carry sources.
 *
 * The one document read this module DOES own is line 8a's, and it is here
 * rather than at the wiring site because it is a RULE rather than a sum: see
 * "The wage base is shared, and whose wages share it" below.
 *
 * ## The two figures this form produces, and where each lands
 *
 * - **Line 12 → Schedule 2 line 4 → 1040 line 23.** The tax itself.
 * - **Line 13 → Schedule 1 line 15 → 1040 line 10.** §164(f)'s deductible
 *   half, which REDUCES adjusted gross income and therefore moves the medical
 *   floor, the senior-deduction phase-out, Form 8960's threshold, the Social
 *   Security Benefits Worksheet and every Phase 24/25 credit with it.
 *
 * Both come out of ONE execution, and `fjs/schedule/1` carries the whole
 * record out so `fjs/schedule/2` reads that same execution rather than
 * running a second one — the discipline Schedule 2 already follows for Form
 * 8959's line 18 and line 24 (13-CONTEXT.md Decision 4.3).
 *
 * ## The 92.35% factor is DERIVED, not stored
 *
 * Printed line 4a reads *"multiply line 3 by 92.35% (0.9235)"*, and
 * `fjs/tax/params` stores no 9235. §1402(a)(12) is why: the deduction it
 * allows is *"the product of the taxpayer's net earnings from self-employment
 * … and one-half of the sum of the rates imposed by subsections (a) and (b)
 * of section 1401"* — half of 12.4% + 2.9% is 7.65%, and the factor is
 * 100% − 7.65%. {@link netEarningsFactorBasisPoints} performs exactly that
 * arithmetic on the two stored rates, so the printed 0.9235 has ONE source of
 * truth and a rate change moves the factor with it.
 * `theNinetyTwoPointThreeFiveFactorIsDerivedFromTheTwoRatesRatherThanStored`
 * is the leaf that compares the derivation against the printed page.
 *
 * ## Where the rounding happens, and the fixture that observes it
 *
 * Line 4a rounds to the cent, half-up, and **that rounding point is
 * observable at the $400 floor rather than only in the last digit of the
 * tax.** Phase 24 shipped a phase-out whose rounding point no fixture
 * constrained and which survived a mutation; this one is constrained by a
 * one-cent pair:
 *
 * - Net profit **$433.12** → 43312 × 9235 ÷ 10000 = 39,998.632 cents → half-up
 *   **$399.99**, which is below §1402(b)(2)'s floor, so line 4c stops the form
 *   and the tax is **$0.00**.
 * - Net profit **$433.13** → 43313 × 9235 ÷ 10000 = 39,999.5555 cents →
 *   half-up **$400.00**, which is NOT below the floor, so the form continues
 *   and a real tax is owed.
 *
 * Truncating instead of rounding half-up gives $399.99 at BOTH inputs, so the
 * pair distinguishes the two rules — not by a cent of tax, but by whether any
 * tax is owed at all.
 *
 * ## The wage base is shared, and whose wages share it
 *
 * §1402(b)(1) caps the amount subject to the Social Security portion at *"the
 * contribution and benefit base"*, and printed lines 7 through 9 are how the
 * form shares that one cap between W-2 wages and self-employment earnings:
 * line 8a takes the wages ALREADY subject to Social Security tax, line 9
 * subtracts them from the base, and line 10 taxes only *"the smaller of line 6
 * or line 9"*. **Wages consume the base first.** Two jobs plus a business is
 * the case that gets this wrong, and
 * {@link proof.twoJobsPlusABusinessShareOneWageBaseWagesFirst} prices it
 * against the naive answer.
 *
 * **Box 3, not box 5.** Box 3 is Social Security wages and stops AT the wage
 * base by construction; box 5 is Medicare wages and is uncapped. Reading box 5
 * here would over-consume the base for anyone above it and understate the
 * Social Security portion of their self-employment tax. Box 7 (Social Security
 * tips) is added because the printed line says *"total of boxes 3 and 7"*.
 *
 * **The base is PER PERSON, so whose W-2 it is matters.** A joint return
 * carries both spouses' Forms W-2 but only ONE Schedule C (this engine refuses
 * a second), so a spouse's $176,100 of wages must NOT consume the proprietor's
 * base — that would shelter the proprietor's earnings behind somebody else's
 * ceiling and understate the tax. {@link socialSecurityWagesAlreadyTaxed}
 * therefore matches on `recipientTin`, which `vnd.fjs.w2` and
 * `vnd.fjs.business_expenses` both carry, rather than summing every stored
 * W-2. On a return with no business record there is no proprietor at all, so
 * the total is $0.00 — and the self-employment tax is $0.00 with it, so
 * nothing depends on the choice.
 *
 * **A mismatch on a NON-joint return refuses**, by
 * {@link wagesAttributionRefusal}: a single filer's documents all belong to
 * the same person, so a W-2 issued to somebody else is either a typo in one of
 * the two records or a document that does not belong on this return, and the
 * two possibilities move the tax in opposite directions.
 *
 * ## What this form REFUSES by name
 *
 * | Printed | Why it cannot be computed |
 * |---|---|
 * | 1a, 1b farm income | Schedule F, which this engine does not model — `farmIncomeOrLoss` is an `fjs/return/scope` refusal |
 * | 4b, and Part II (14-17) | the farm and non-farm OPTIONAL METHODS — see {@link optionalMethodsPartII} |
 * | 5a, 5b church employee income | see {@link churchEmployeeIncomeLine5a} |
 * | 8b Form 4137 tips | `unreportedTips` is an `fjs/return/scope` refusal |
 * | 8c Form 8919 wages | `form8919Wages` is an `fjs/return/scope` refusal |
 *
 * Each of the first three is reachable as a DECLARATION: Phase 28 adds
 * `selfEmploymentOptionalMethods` and `churchEmployeeIncome` to the frozen
 * kind vocabulary precisely so a taxpayer with either can be told why their
 * return cannot be computed, rather than receiving one computed as though
 * they had neither. That is the same mechanism `farmIncomeOrLoss`,
 * `unreportedTips` and `form8919Wages` already use for the other two rows.
 *
 * @module
 */
import { assert, assertEq } from 'functionalscript/fjs/asserts/module.f.js'
import { of, multiply, halfUp } from '../../types/rational/module.f.js'
import { centsFromString } from '../../exact/module.f.js'
import { taxParamsByYear } from '../../tax/params/module.f.js'

/** @import { W2 } from '../../document/w2/module.f.js' */
/** @import { ReportLine, Source } from '../../report/line/module.f.js' */
/** @import { TaxParamSet, IndividualFilingStatus } from '../../tax/params/module.f.js' */

/**
 * A stored document as this module sees it — mirrors `fjs/schedule/1`'s own
 * `Stored<T>`; nothing here re-validates.
 * @template T
 * @typedef {{ readonly documentHash: string, readonly value: T }} Stored
 */

/**
 * A case this module will not compute — the same shape `fjs/schedule/c`,
 * `fjs/schedule/1` and `fjs/form8889` already return, so `fjs/form1040/core`
 * threads it through the error arm it already has. No `unmodeled` field:
 * these are document-data-sufficiency refusals (12.1-CONTEXT.md Decision
 * 2.6's category), never an `fjs/return/scope` kind.
 * @typedef {{ readonly kind: 'error', readonly message: string }} ScheduleSeRefusal
 */

// ── Local rate helpers (reimplemented, not imported) ─────────────────────────

/**
 * Rounds `cents * (basisPoints / 10000)` to the nearest cent, ties away from
 * zero (the IRS half-up convention) — printed lines 4a, 5b, 10 and 11.
 *
 * Basis points because neither §1401 rate is a whole number of percent, for
 * the exactness reason `fjs/tax/params`' own {@link selfEmploymentTax}
 * records. `fjs/form8959`'s identical private helper is reimplemented here
 * rather than imported, per this project's "reimplement an idiom you cannot
 * import" precedent (it is private there).
 * @type {(cents: bigint) => (basisPoints: bigint) => bigint}
 */
const basisPointsOfCents = cents => basisPoints =>
    halfUp(multiply(of(cents)(1n))(of(basisPoints)(10000n)))

/**
 * Rounds `cents * (percent / 100)` to the nearest cent, half-up — printed
 * line 13's §164(f)(1) half. A WHOLE percent, so a separate helper from
 * {@link basisPointsOfCents} rather than one with the basis points scaled:
 * `fjs/tax/params` stores this rate as `ratePercent` precisely because 50 is
 * exact as a percent, and multiplying by `5000/10000` here would hide that.
 * @type {(cents: bigint) => (percent: bigint) => bigint}
 */
const percentOfCents = cents => percent =>
    halfUp(multiply(of(cents)(1n))(of(percent)(100n)))

// ── §1402(a)(12)'s factor, derived from §1401's two rates ────────────────────

/**
 * **Printed line 4a's 92.35%, in basis points, DERIVED rather than stored.**
 *
 * §1402(a)(12) allows a deduction of *"the product of the taxpayer's net
 * earnings from self-employment (determined without regard to this paragraph)
 * and one-half of the sum of the rates imposed by subsections (a) and (b) of
 * section 1401"*. Half of 12.4% + 2.9% is 7.65%, so what remains subject to
 * tax is 100% − 7.65% = 92.35%.
 *
 * Writing `9235` in `fjs/tax/params` instead would be a SECOND copy of a rule
 * the two stored rates already fix, and the copies could disagree — the
 * "one rule, one place" failure AGENTS.md records. The `assert` below is not
 * defensive padding: `10000 − (a + b) / 2` is only exact when `a + b` is even,
 * and a future year's rates need not be.
 * @type {(taxParamSet: TaxParamSet) => bigint}
 */
export const netEarningsFactorBasisPoints = taxParamSet => {
    const { rates } = taxParamSet.selfEmploymentTax
    const combined = BigInt(rates.oldAgeSurvivorsAndDisabilityInsuranceBasisPoints)
        + BigInt(rates.hospitalInsuranceBasisPoints)
    assert(
        combined % 2n === 0n,
        ['§1402(a)(12) halves the combined §1401 rate; it must be a whole number of basis points', combined],
    )
    return 10000n - combined / 2n
}

// ── Line 8a: the wages that already consumed the wage base ───────────────────

/**
 * **Printed line 8a**: *"Total social security wages and tips (total of boxes
 * 3 and 7 on Form(s) W-2) and railroad retirement (tier 1) compensation."*
 *
 * Box 3 and box 7, and only from Forms W-2 issued to the PROPRIETOR — see
 * this module's own docstring, "The wage base is shared, and whose wages
 * share it", for why box 5 would be wrong and why `recipientTin` is the
 * filter. Railroad retirement (tier 1) compensation is not summed because
 * `vnd.fjs.w2` has no box-14 field for it: structurally unreachable rather
 * than merely unmodelled, the identical position `fjs/form8959`'s Part III
 * takes about the same missing box.
 *
 * `proprietorTin` is `undefined` when the return carries no business record.
 * There is then no proprietor whose base could be consumed, and the
 * self-employment tax is zero anyway, so the answer is $0.00 citing nothing —
 * which is what makes a return with no self-employment compute exactly what
 * it computed before this phase.
 * @type {(w2Forms: readonly Stored<W2>[]) => (proprietorTin: string | undefined) => { readonly cents: bigint, readonly sources: readonly Source[] }}
 */
export const socialSecurityWagesAlreadyTaxed = w2Forms => proprietorTin => {
    if (proprietorTin === undefined) {
        return { cents: 0n, sources: [] }
    }
    const own = w2Forms.filter(form => form.value.recipientTin === proprietorTin)
    /** @type {readonly Source[]} */
    const sources = own.flatMap(form => [
        ...(form.value.box3SocialSecurityWages === undefined
            ? []
            : [{
                documentHash: form.documentHash,
                boxPath: 'box3SocialSecurityWages',
                value: form.value.box3SocialSecurityWages,
            }]),
        ...(form.value.box7SocialSecurityTips === undefined
            ? []
            : [{
                documentHash: form.documentHash,
                boxPath: 'box7SocialSecurityTips',
                value: form.value.box7SocialSecurityTips,
            }]),
    ])
    return {
        cents: sources.reduce((total, source) => total + centsFromString(source.value), 0n),
        sources,
    }
}

/**
 * **The attribution guard behind line 8a**, and the reason it is a refusal
 * rather than a silent choice.
 *
 * The Social Security wage base is per PERSON. On a joint return two people's
 * Forms W-2 legitimately sit beside one Schedule C, and matching on
 * `recipientTin` is exactly right. On any other status every document belongs
 * to the same filer, so a W-2 issued to a different TIN is one of two things,
 * and they move the tax in OPPOSITE directions:
 *
 * - the business record's `recipientTin` is wrong, in which case those wages
 *   SHOULD consume the base and this engine is overstating the tax; or
 * - the W-2 does not belong on this return at all, in which case 1040 line 1a
 *   is overstated by the whole of its box 1.
 *
 * Neither is a guess worth making, and the second is not a self-employment
 * problem at all. It refuses only when the mismatch could MATTER — a W-2 with
 * Social Security wages on it — so a mismatching W-2 with no box 3 (a
 * household-employee or clergy W-2, say) does not stop a return whose answer
 * it cannot change.
 * @type {(status: IndividualFilingStatus) => (w2Forms: readonly Stored<W2>[]) => (proprietorTin: string) => ScheduleSeRefusal | { readonly kind: 'ok' }}
 */
export const wagesAttributionRefusal = status => w2Forms => proprietorTin => {
    if (status === 'marriedFilingJointly') {
        return { kind: 'ok' }
    }
    const foreign = w2Forms.find(form =>
        form.value.recipientTin !== proprietorTin
        && form.value.box3SocialSecurityWages !== undefined
        && centsFromString(form.value.box3SocialSecurityWages) > 0n)
    if (foreign === undefined) {
        return { kind: 'ok' }
    }
    return {
        kind: 'error',
        message: `Schedule SE line 8a: a stored Form W-2 reports `
            + `${foreign.value.box3SocialSecurityWages} of Social Security wages for recipient `
            + `'${foreign.value.recipientTin}', while the business expenses record names `
            + `'${proprietorTin}' as the proprietor, and this return is not a joint one. `
            + `§1402(b)(1)'s contribution and benefit base is shared between W-2 wages and `
            + `self-employment earnings PER PERSON, so this engine has to know whose wages these `
            + `are: if the business record's recipient is wrong, those wages consume the `
            + `proprietor's base and this return overstates the tax; if the Form W-2 belongs to `
            + `somebody else, 1040 line 1a is overstated by the whole of its box 1. Correct the `
            + `recipient on whichever record is wrong; refusing rather than choosing between two `
            + `errors that move the tax in opposite directions`,
    }
}

/**
 * **Two DIFFERENT people with self-employment income on one return.**
 *
 * Schedule SE is filed **per person** — the printed form says so at the top of
 * Part I: *"If you had more than one source of self-employment income, ...
 * file a separate Schedule SE for each spouse with self-employment income."*
 * This engine computes ONE.
 *
 * Before Phase 30 the case could not arise, because the only source of
 * self-employment income was a `vnd.fjs.business_expenses` record and
 * `fjs/schedule/c` refuses a second one. A partnership Schedule K-1 is a
 * SECOND source, and it carries its own `recipientTin` — so a joint return may
 * now legitimately hold one spouse's Schedule C and the other spouse's K-1.
 *
 * **Merging them is not an approximation.** §1402(b)(1)'s contribution and
 * benefit base is per person, so one combined line 6 would shelter the second
 * person's earnings behind the first person's already-consumed base and
 * UNDERSTATE the tax; and §1402(b)(2)'s $400 floor is per person too, so a
 * combined figure can cross it where neither person's does. The two errors run
 * in opposite directions.
 * @type {(proprietorTin: string) => (partnerTin: string) => ScheduleSeRefusal}
 */
export const twoSelfEmployedPeopleRefusal = proprietorTin => partnerTin => ({
    kind: 'error',
    message: `Schedule SE: this return carries self-employment income for TWO different people — `
        + `a business expenses record for '${proprietorTin}' and a Schedule K-1 (Form 1065) with `
        + `box 14 code A net earnings for '${partnerTin}'. The printed form is filed PER PERSON `
        + `("file a separate Schedule SE for each spouse with self-employment income") and this `
        + `engine computes one. Merging them is not an approximation: §1402(b)(1)'s contribution `
        + `and benefit base is per person, so a combined line 6 would shelter the second person's `
        + `earnings behind the first person's already-consumed base and understate the tax, while `
        + `§1402(b)(2)'s $400 floor is also per person and a combined figure can cross it where `
        + `neither person's does. If the two records name the same person, correct whichever `
        + `recipient is wrong (two Schedules SE, no phase yet)`,
})

// ── Part II and line 5a: the two printed parts that exist here only to refuse ─

/**
 * **Part II, Optional Methods To Figure Net Earnings (lines 14-17).** A real
 * named function for a real printed part, returning the only honest answer
 * this engine has for it — the same shape, and for the same reason, as
 * `fjs/schedule/c`'s own `atRiskDeterminationLine32`.
 *
 * The farm optional method (lines 15-16) and the non-farm optional method
 * (line 17) let a proprietor with low or negative earnings ELECT to report a
 * fixed fraction of gross income instead, so as to earn Social Security
 * credits. Three separate things make it uncomputable here, and each would
 * block it alone:
 *
 * - It is an **election**, and no document this engine holds records one. An
 *   election taken by default is not an election.
 * - The non-farm method needs **GROSS income** (Schedule C line 7) and the
 *   farm method needs Schedule F's, plus a **prior-year test** — *"you were
 *   self-employed at least 2 of the 3 prior years"* — which is a multi-year
 *   history this engine does not hold.
 * - Line 14's own maximum is an **indexed dollar figure** this project has not
 *   sourced, and storing one for a method that cannot be elected would be a
 *   parameter with no reader.
 *
 * It is reached through the `selfEmploymentOptionalMethods` declared kind,
 * which `fjs/return/scope` refuses by name, rather than through stored data —
 * there being nothing stored that could trigger it.
 * @type {() => ScheduleSeRefusal}
 */
export const optionalMethodsPartII = () => ({
    kind: 'error',
    message: 'Schedule SE Part II (lines 14-17), the farm and non-farm optional methods: these '
        + 'are ELECTIONS a taxpayer makes to report a fixed fraction of gross farm or non-farm '
        + 'income as net earnings, and no document this engine holds records an election. The '
        + 'non-farm method additionally needs Schedule C line 7 gross income together with the '
        + 'printed test that you "were self-employed at least 2 of the 3 prior years", which is '
        + 'a multi-year history this engine does not hold, and the farm method needs Schedule F '
        + 'in the first place. So line 4b is a documented zero and Part II is not computed; '
        + 'refusing rather than making an election on a taxpayer\'s behalf (no phase yet)',
})

/**
 * **Printed line 5a, church employee income.** *"Enter your church employee
 * income from Form W-2."*
 *
 * Church employee income is wages of $108.28 or more from a church or
 * qualified church-controlled organization that elected exemption from
 * employer Social Security and Medicare taxes under §3121(w) — so the
 * EMPLOYEE pays self-employment tax on them, on this line, even though they
 * are W-2 wages. **Nothing on a Form W-2 marks it**, and `vnd.fjs.w2` has no
 * field for it, so this engine cannot tell such a W-2 from any other. Reading
 * every W-2's box 1 onto this line would double-tax ordinary wages; reading
 * none — which is what this engine does — understates the tax of the small
 * number of filers who have it.
 *
 * §1402(g)'s own exemption sits behind the same gap in the other direction: a
 * member of a recognised religious sect who filed **Form 4029**, or a minister
 * or member of a religious order who filed **Form 4361**, owes NO
 * self-employment tax on the covered earnings at all — and the printed form's
 * box A at the top of Part I is where that is declared. This engine has no
 * field for either approval, so it cannot exempt the earnings it would
 * otherwise tax.
 *
 * Both directions are reached through the `churchEmployeeIncome` declared
 * kind, which `fjs/return/scope` refuses by name.
 * @type {() => ScheduleSeRefusal}
 */
export const churchEmployeeIncomeLine5a = () => ({
    kind: 'error',
    message: 'Schedule SE line 5a (church employee income) and the printed box A above Part I: '
        + 'church employee income is W-2 wages from an organization that elected exemption from '
        + 'employer Social Security and Medicare tax under §3121(w), on which the EMPLOYEE owes '
        + 'self-employment tax — and nothing on a Form W-2 marks it, so `vnd.fjs.w2` cannot '
        + 'carry it and this engine cannot tell such a W-2 from any other. The same gap runs the '
        + 'other way for §1402(g): an approved Form 4029, or a Form 4361 for a minister or '
        + 'member of a religious order, exempts the earnings entirely, and no field records '
        + 'either approval. Refusing rather than taxing exempt earnings or exempting taxable '
        + 'ones (no phase yet)',
})

// ── Part I: lines 1a through 13 ──────────────────────────────────────────────

/**
 * Part I's twenty printed fields, lines 1a through 13.
 * @typedef {{
 *   readonly line1a: bigint, readonly line1b: bigint, readonly line2: bigint,
 *   readonly line3: bigint, readonly line4a: bigint, readonly line4b: bigint,
 *   readonly line4c: bigint, readonly line5a: bigint, readonly line5b: bigint,
 *   readonly line6: bigint, readonly line7: bigint, readonly line8a: bigint,
 *   readonly line8b: bigint, readonly line8c: bigint, readonly line8d: bigint,
 *   readonly line9: bigint, readonly line10: bigint, readonly line11: bigint,
 *   readonly line12: bigint, readonly line13: bigint,
 * }} ScheduleSelfEmploymentPartI
 */

/**
 * `partnershipSelfEmploymentEarningsCents` is the sum of **Schedule K-1 (Form
 * 1065) box 14 code A** across every stored partnership K-1, which printed
 * line 2 names in its own caption beside Schedule C line 31. It is `0n` for
 * every return with no partnership stake, and `0n` for every S-corporation
 * shareholder no matter how large their share — see {@link
 * scheduleSelfEmploymentPartI}'s own line 2 comment.
 * @typedef {{
 *   readonly netProfitCents: bigint,
 *   readonly partnershipSelfEmploymentEarningsCents: bigint,
 *   readonly socialSecurityWagesCents: bigint,
 * }} ScheduleSelfEmploymentPartIInput
 */

/**
 * Schedule SE Part I, lines 1a through 13 — the whole of the tax this engine
 * can compute. Every `const` below is one printed line, in printed order,
 * with the printed instruction quoted above it.
 * @type {(taxParamSet: TaxParamSet) => (input: ScheduleSelfEmploymentPartIInput) => ScheduleSelfEmploymentPartI}
 */
export const scheduleSelfEmploymentPartI = taxParamSet => input => {
    const {
        netProfitCents, partnershipSelfEmploymentEarningsCents, socialSecurityWagesCents,
    } = input
    const { selfEmploymentTax } = taxParamSet
    const factor = netEarningsFactorBasisPoints(taxParamSet)
    // 1a. "Net farm profit or (loss) from Schedule F, line 34, and farm
    //     partnerships, Schedule K-1 (Form 1065), box 14, code A." A
    //     documented zero: `farmIncomeOrLoss` is an `fjs/return/scope`
    //     refusal, so a taxpayer with farm income is refused whole before
    //     this line is reached, and Schedule K-1 is Phase 30's.
    const line1a = 0n
    // 1b. "...enter the amount of Conservation Reserve Program payments
    //     included on Schedule F, line 4b." A SUBTRACTION on the printed
    //     page (the box is parenthesised), and zero for the same reason 1a
    //     is: there is no Schedule F to exclude anything from.
    const line1b = 0n
    // 2. "Net profit or (loss) from Schedule C, line 31; and Schedule K-1
    //    (Form 1065), box 14, code A (other than farming)." TWO printed
    //    sources as of Phase 30, and the caption names both by form and box.
    //
    //    **Schedule K-1 (Form 1120-S) is deliberately absent from that
    //    caption, and its absence is the rule.** An S-corporation
    //    shareholder's pro rata share is never net earnings from
    //    self-employment (Rev. Rul. 59-221), which is why the printed line
    //    names one Schedule K-1 and not the other, and why
    //    `fjs/schedule/e` returns a structural zero for every 1120-S row.
    //
    //    **"(other than farming)" is where a farm partnership's code A goes
    //    instead**: printed line 1a takes it, and this engine cannot tell a
    //    farm partnership's code A from any other. It does not have to --
    //    `farmIncomeOrLoss` is an `fjs/return/scope` refusal, so a partner
    //    with farm income is refused whole before this form is reached, and
    //    line 1a stays a documented zero.
    const line2 = netProfitCents + partnershipSelfEmploymentEarningsCents
    // 3. "Combine lines 1a, 1b, and 2."
    const line3 = line1a + line1b + line2
    // 4a. "If line 3 is more than zero, multiply line 3 by 92.35% (0.9235).
    //     Otherwise, enter amount from line 3." §1402(a)(12), through the
    //     DERIVED factor -- see this module's own docstring. The rounding is
    //     half-up to the cent, and the pair at $433.12/$433.13 is what
    //     observes it.
    const line4a = line3 > 0n ? basisPointsOfCents(line3)(factor) : line3
    // 4b. "If you elect one or both of the optional methods, enter the total
    //     of lines 15 and 17 here." Always zero: see
    //     {@link optionalMethodsPartII}.
    const line4b = 0n
    // 4c. "Combine lines 4a and 4b. If less than $400, stop; you don't owe
    //     self-employment tax."
    const line4c = line4a + line4b
    // 5a. "Enter your church employee income from Form W-2." Always zero:
    //     see {@link churchEmployeeIncomeLine5a}.
    const line5a = 0n
    // 5b. "Multiply line 5a by 92.35% (0.9235). If less than $100, enter -0-."
    //     Structurally zero, because line 5a is. The printed $100 floor is
    //     therefore unreachable and is NOT stored as a parameter -- a
    //     parameter with no reader, which is the YAGNI position
    //     `fjs/tax/params` takes throughout.
    const line5b = 0n
    // 6. "Add lines 4c and 5b."
    //
    //    **This is where line 4c's "stop" is implemented.** The printed page
    //    stops the form below $400 rather than carrying a small figure
    //    through, and with line 5a structurally zero the printed exception
    //    ("if less than $400 and you had church employee income, enter -0-
    //    and continue") cannot apply. Zeroing line 6 rather than returning
    //    early keeps lines 7 through 9 -- which are facts about the wage
    //    base, not about this taxpayer's earnings -- honestly filled in,
    //    while lines 10 through 13 fall out at zero on their own arithmetic.
    const minimumNetEarnings = centsFromString(selfEmploymentTax.minimumNetEarnings.amount)
    const line6 = line4c < minimumNetEarnings ? 0n : line4c + line5b
    // 7. "Maximum amount of combined wages and self-employment earnings
    //    subject to social security tax or the 6.2% portion of the 7.65%
    //    railroad retirement (tier 1) tax for 2025." §1402(b)(1)'s
    //    contribution and benefit base, read from `fjs/tax/params`.
    const line7 = centsFromString(selfEmploymentTax.socialSecurityWageBase.amount)
    // 8a. "Total social security wages and tips (total of boxes 3 and 7 on
    //     Form(s) W-2)..." Summed by {@link socialSecurityWagesAlreadyTaxed},
    //     which is where the box-3-not-box-5 and whose-wages rules live.
    const line8a = socialSecurityWagesCents
    // 8b. "Unreported tips subject to social security tax from Form 4137,
    //     line 10." Zero: `unreportedTips` is an `fjs/return/scope` refusal,
    //     and Phase 22's W-2 box-8 tripwire refuses an UNDECLARED return
    //     whose W-2 carries allocated tips -- both paths refuse before this
    //     form is computed.
    const line8b = 0n
    // 8c. "Wages subject to social security tax from Form 8919, line 10."
    //     Zero: `form8919Wages` is an `fjs/return/scope` refusal.
    const line8c = 0n
    // 8d. "Add lines 8a, 8b, and 8c."
    const line8d = line8a + line8b + line8c
    // 9. "Subtract line 8d from line 7. If zero or less, enter -0- here and
    //    on line 10 and go to line 11." THE SHARING: what is left of the one
    //    wage base after the wages have taken their part of it.
    const line9 = line7 > line8d ? line7 - line8d : 0n
    // 10. "Multiply the smaller of line 6 or line 9 by 12.4% (0.124)."
    const smallerOfSixOrNine = line6 < line9 ? line6 : line9
    const line10 = basisPointsOfCents(smallerOfSixOrNine)(
        BigInt(selfEmploymentTax.rates.oldAgeSurvivorsAndDisabilityInsuranceBasisPoints))
    // 11. "Multiply line 6 by 2.9% (0.029)." UNCAPPED -- line 6 itself, never
    //     the `min` line 10 takes, because there is no wage base for the
    //     Medicare portion.
    const line11 = basisPointsOfCents(line6)(
        BigInt(selfEmploymentTax.rates.hospitalInsuranceBasisPoints))
    // 12. "Self-employment tax. Add lines 10 and 11. Enter here and on
    //     Schedule 2 (Form 1040), line 4."
    const line12 = line10 + line11
    // 13. "Deduction for one-half of self-employment tax. Multiply line 12 by
    //     50% (0.50). Enter here and on Schedule 1 (Form 1040), line 15."
    //
    //     **Half of LINE 12, which is half of this form's own tax and NOT
    //     half of everything a self-employed filer pays on those earnings.**
    //     Form 8959's Additional Medicare Tax on the same self-employment
    //     income is a Part II figure on THAT form, reaching Schedule 2 line
    //     11 rather than line 4, and §164(f)(1) allows a deduction for
    //     one-half of "the taxes imposed by section 1401" alone -- §3101's
    //     0.9% is not among them. `theDeductibleHalfExcludesTheAdditional\
    //     MedicareTax` is the leaf that prices the difference.
    const line13 = percentOfCents(line12)(BigInt(selfEmploymentTax.deductibleHalf.ratePercent))
    assert(line12 >= 0n, ['Schedule SE line 12 must never be negative', line12])
    assert(line13 >= 0n, ['Schedule SE line 13 must never be negative', line13])
    return {
        line1a, line1b, line2, line3, line4a, line4b, line4c, line5a, line5b, line6,
        line7, line8a, line8b, line8c, line8d, line9, line10, line11, line12, line13,
    }
}

/**
 * **The whole Schedule SE execution as it TRAVELS**, which is a different
 * thing from the printed lines alone.
 *
 * `fjs/schedule/1` builds one of these — it is the schedule that needs line
 * 13 first, for its own line 15 — and `fjs/schedule/2` reads line 12 and line
 * 6 off the SAME object rather than running this form a second time. The two
 * {@link ReportLine}s are the sourced facts the form read, carried so that
 * whichever schedule prints a figure can cite them; this module builds
 * neither, and does not need to know which lines its consumers will print.
 *
 * **Running Schedule SE twice would be worse than ordinary drift.** Line 13
 * reduces adjusted gross income, so a second execution performed after the
 * first had been applied would be pricing a return the first one had already
 * changed. That is why the whole record travels and no consumer is handed the
 * inputs.
 * @typedef {{
 *   readonly lines: ScheduleSelfEmploymentPartI,
 *   readonly netProfit: ReportLine,
 *   readonly socialSecurityWages: ReportLine,
 * }} SelfEmploymentOutcome
 */

// ── Tests ────────────────────────────────────────────────────────────────────

/** TY2025's parameter set, narrowed exactly ONCE at module scope. */
const taxParams2025 = taxParamsByYear[2025]
assert(taxParams2025 !== undefined, 'expected TY2025 parameters to be present in taxParamsByYear')

/** Runs Part I against TY2025's real parameter set.
 * @type {(netProfitCents: bigint) => (socialSecurityWagesCents: bigint) => ScheduleSelfEmploymentPartI}
 */
const run = netProfitCents => socialSecurityWagesCents =>
    scheduleSelfEmploymentPartI(taxParams2025)({
        netProfitCents, partnershipSelfEmploymentEarningsCents: 0n, socialSecurityWagesCents,
    })

/**
 * Runs Part I with the net profit and the partnership share supplied
 * SEPARATELY, so a leaf can tell which of printed line 2's two sources a
 * figure came from. {@link run} above holds the second at zero, which is what
 * every pre-Phase-30 leaf below assumes.
 * @type {(netProfitCents: bigint) => (partnershipSelfEmploymentEarningsCents: bigint) => ScheduleSelfEmploymentPartI}
 */
const runWithPartnershipShare = netProfitCents => partnershipSelfEmploymentEarningsCents =>
    scheduleSelfEmploymentPartI(taxParams2025)({
        netProfitCents, partnershipSelfEmploymentEarningsCents, socialSecurityWagesCents: 0n,
    })

/** @type {W2} */
const bareW2Value = {
    dialect: 'vnd.fjs.w2',
    payerTin: '11-1111111', recipientTin: '222-22-2222', accountNumber: '',
    taxYear: 2025, formRevision: '2025',
}

/** @type {(hash: string) => (recipientTin: string) => (box3: string | undefined) => Stored<W2>} */
const w2Doc = hash => recipientTin => box3 => ({
    documentHash: hash,
    value: {
        ...bareW2Value,
        recipientTin,
        ...(box3 === undefined ? {} : { box3SocialSecurityWages: box3 }),
    },
})

/**
 * Narrows one entry of a plain `readonly Source[]` — which
 * {@link socialSecurityWagesAlreadyTaxed} returns, since it may legitimately
 * be empty — by binding and asserting rather than by a cast over an indexed
 * access, which AGENTS.md bans.
 * @type {(sources: readonly Source[]) => (index: number) => Source}
 */
const sourceAt = sources => index => {
    const found = sources[index]
    assert(found !== undefined, ['expected a source at this position', index, sources.length])
    return found
}

/**
 * Hand-typed off the printed 2025 Schedule SE face: the wage base, the two
 * rates as decimals, the §1402(b)(2) floor and the derived factor — all
 * stated here in the units the PAGE prints them in, so a parameter that
 * changed value would have to change here too.
 */
const printedWageBaseCents = 17610000n
/** Printed line 4a: "92.35% (0.9235)" — 9235 basis points. */
const printedNetEarningsFactorBasisPoints = 9235n
/** Printed line 4c: "if less than $400". */
const printedMinimumNetEarningsCents = 40000n

export const proof = {
    partnershipShare: {
        /**
         * **Printed line 2 has TWO sources and line 3 adds them**, and the two
         * are asserted separately rather than only through their total —
         * because a wiring that read the partnership share and dropped the
         * Schedule C profit (or the reverse) produces the same line 3 whenever
         * one of them is zero, which is every fixture that carries only one.
         *
         * $50,000.00 of Schedule C net profit and $80,000.00 of Schedule K-1
         * box 14 code A. Line 2 = $130,000.00, hand-added; line 4a =
         * 13,000,000 × 9235 ÷ 10,000 = 120,055,000 ÷ 10,000... written out:
         * 13,000,000 × 9235 = 120,055,000,000, ÷ 10,000 = 12,005,500 cents =
         * $120,055.00 exactly, no rounding involved.
         */
        printedLineTwoAddsScheduleCAndTheKOneShare: () => {
            const both = runWithPartnershipShare(5000000n)(8000000n)
            assertEq(both.line2, 13000000n, '$50,000.00 + $80,000.00 = $130,000.00')
            assertEq(both.line3, 13000000n, 'line 3 combines lines 1a, 1b and 2')
            assertEq(both.line4a, 12005500n, '13,000,000 x 0.9235 = $120,055.00')
            // Each source ALONE, so neither can be the one that is actually
            // being read while the other is ignored.
            assertEq(runWithPartnershipShare(5000000n)(0n).line2, 5000000n, 'Schedule C alone')
            assertEq(runWithPartnershipShare(0n)(8000000n).line2, 8000000n, 'the K-1 share alone')
        },

        /**
         * **CRITERION 3's arithmetic, on this form.** An $80,000.00 general
         * partner's share, with no wages and no Schedule C, hand-derived cent
         * by cent:
         *
         * - line 2 = line 3 = **8,000,000** cents
         * - line 4a = 8,000,000 × 9235 ÷ 10,000 = **7,388,000** = $73,880.00
         *   (exact; 8,000,000 × 9,235 = 73,880,000,000)
         * - line 4c = 7,388,000, which is not below §1402(b)(2)'s 40,000, so
         *   line 6 = **7,388,000**
         * - line 9 = 17,610,000 − 0 = 17,610,000, so line 10 multiplies
         *   line 6: 7,388,000 × 1240 ÷ 10,000 = **916,112** = $9,161.12
         * - line 11 = 7,388,000 × 290 ÷ 10,000 = **214,252** = $2,142.52
         * - line 12 = 916,112 + 214,252 = **1,130,364** = **$11,303.64**
         * - line 13 = 50% of 1,130,364 = **565,182** = $5,651.82 (exact)
         *
         * An S-corporation shareholder with the same $80,000.00 supplies
         * NOTHING to line 2, so every figure above is $0.00 — which is the
         * second half of the pair, asserted here on the form that charges the
         * tax rather than only on the schedule that sources it.
         */
        theGeneralPartnersTaxIsElevenThousandThreeHundredAndThreeSixtyFour: () => {
            const partner = runWithPartnershipShare(0n)(8000000n)
            assertEq(partner.line2, 8000000n)
            assertEq(partner.line4a, 7388000n, '$73,880.00')
            assertEq(partner.line6, 7388000n)
            assertEq(partner.line10, 916112n, '$9,161.12 at 12.4%')
            assertEq(partner.line11, 214252n, '$2,142.52 at 2.9%')
            assertEq(partner.line12, 1130364n, '$11,303.64 of self-employment tax')
            assertEq(partner.line13, 565182n, '$5,651.82 deductible half')
            // The S-corporation shareholder supplies nothing at all.
            const shareholder = runWithPartnershipShare(0n)(0n)
            assertEq(shareholder.line2, 0n)
            assertEq(shareholder.line12, 0n, '$0.00 — Rev. Rul. 59-221')
            assertEq(shareholder.line13, 0n)
        },

        /**
         * The partnership share goes through §1402(a)(12)'s 92.35% and
         * §1402(b)(2)'s $400 floor exactly as a Schedule C profit does — the
         * two are ONE line 2, not two paths. Phase 28's $433.12/$433.13 pair,
         * re-run with the amount arriving from a Schedule K-1 instead.
         */
        theKOneShareCrossesTheSameFourHundredDollarBoundary: () => {
            assertEq(runWithPartnershipShare(0n)(43312n).line4a, 39999n, 'half-up to $399.99')
            assertEq(runWithPartnershipShare(0n)(43312n).line6, 0n, 'below the floor: no tax')
            assertEq(runWithPartnershipShare(0n)(43312n).line12, 0n)
            assertEq(runWithPartnershipShare(0n)(43313n).line4a, 40000n, 'half-up to $400.00')
            assertEq(runWithPartnershipShare(0n)(43313n).line6, 40000n, 'not below the floor')
            assert(runWithPartnershipShare(0n)(43313n).line12 > 0n, 'a real tax is owed one cent later')
        },
    },

    // THE DERIVATION, compared against the printed page. `fjs/tax/params`
    // deliberately stores no 9235; this is the leaf that says the derivation
    // still lands on the figure the form prints. Mutating either §1401 rate
    // reddens here as well as in `fjs/tax/params`' own leaves — which is the
    // point: the two are one number in this engine.
    theNinetyTwoPointThreeFiveFactorIsDerivedFromTheTwoRatesRatherThanStored: () => {
        assertEq(
            netEarningsFactorBasisPoints(taxParams2025),
            printedNetEarningsFactorBasisPoints,
            'Schedule SE line 4a prints "92.35% (0.9235)"',
        )
        // …and the derivation really is §1402(a)(12)'s, not a coincidence:
        // one-half of the sum of the two rates is 7.65%, hand-computed here
        // from the printed 12.4 and 2.9 rather than from the stored fields.
        assertEq(10000n - (1240n + 290n) / 2n, printedNetEarningsFactorBasisPoints)
    },

    // **THE HAND-TYPED CONSTANTS ABOVE MUST BE THE FIGURES `fjs/tax/params`
    // STORES.** Its own leaf, so a disagreement names itself rather than
    // surfacing as a confusing set of boundary failures — `fjs/return/
    // tripwire`'s `theHandTypedBoundariesAgreeWithTheStoredParameters` idiom,
    // one form over.
    //
    // This leaf INHERITS `fjs/schedule/c`'s own
    // `theHandTypedFloorAgreesWithTheStoredParameter`, which Phase 27 wrote
    // for the $400 floor when that module was the parameter's only reader.
    // Phase 28 moved the reader here, so the check moved with it — and gained
    // the wage base, which is the one figure in this group that is INDEXED
    // and therefore the one most likely to be stale a tax year from now.
    theHandTypedFiguresAgreeWithTheStoredParameters: () => {
        const { selfEmploymentTax } = taxParams2025
        assertEq(centsFromString(selfEmploymentTax.minimumNetEarnings.amount),
            printedMinimumNetEarningsCents, 'Schedule SE line 4c\'s $400.00')
        assertEq(selfEmploymentTax.minimumNetEarnings.citation.section, '§1402(b)(2)')
        assertEq(centsFromString(selfEmploymentTax.socialSecurityWageBase.amount),
            printedWageBaseCents, 'Schedule SE line 7\'s $176,100.00')
        assertEq(selfEmploymentTax.socialSecurityWageBase.citation.section, '§1402(b)(1)')
        // …and the derived factor against the printed page's own 0.9235,
        // which is the third hand-typed constant in this file.
        assertEq(netEarningsFactorBasisPoints(taxParams2025), printedNetEarningsFactorBasisPoints)
    },

    partI: {
        // THE WORKED FOUNDER RETURN, hand-derived end to end. A single filer
        // with a $50,000.00 Schedule C net profit and no wages at all.
        //
        //   line 2   net profit                                 $50,000.00
        //   line 3   = line 2                                   $50,000.00
        //   line 4a  5,000,000 x 9235 / 10,000 = 4,617,500      $46,175.00
        //   line 4c  = line 4a                                  $46,175.00
        //   line 6   $46,175.00 is not below $400               $46,175.00
        //   line 7   wage base                                 $176,100.00
        //   line 8d  no wages                                        $0.00
        //   line 9   176,100.00 - 0.00                         $176,100.00
        //   line 10  min(46,175.00, 176,100.00) = 46,175.00
        //            4,617,500 x 1240 / 10,000 = 572,570         $5,725.70
        //   line 11  4,617,500 x 290 / 10,000  = 133,907.5
        //            -> half-up 133,908                          $1,339.08
        //   line 12  5,725.70 + 1,339.08                         $7,064.78
        //   line 13  706,478 x 50 / 100 = 353,239                $3,532.39
        //
        // $7,064.78 is the figure Phase 27's refusal called "about $7,000 on
        // a $50,000 profit". It is now computed.
        aFiftyThousandDollarProfitWithNoWages: () => {
            const result = run(5000000n)(0n)
            assertEq(result.line2, 5000000n, 'line 2 = $50,000.00, Schedule C line 31')
            assertEq(result.line3, 5000000n, 'line 3 = $50,000.00')
            assertEq(result.line4a, 4617500n, 'line 4a = $46,175.00 = 92.35% of $50,000.00')
            assertEq(result.line4c, 4617500n, 'line 4c = $46,175.00')
            assertEq(result.line6, 4617500n, 'line 6 = $46,175.00')
            assertEq(result.line7, printedWageBaseCents, 'line 7 = $176,100.00')
            assertEq(result.line8d, 0n, 'line 8d = $0.00, no wages')
            assertEq(result.line9, 17610000n, 'line 9 = $176,100.00 of unused base')
            assertEq(result.line10, 572570n, 'line 10 = $5,725.70 = 12.4% of $46,175.00')
            assertEq(result.line11, 133908n, 'line 11 = $1,339.08 = 2.9% of $46,175.00, half-up from 133,907.5')
            assertEq(result.line12, 706478n, 'line 12 = $7,064.78 -> Schedule 2 line 4')
            assertEq(result.line13, 353239n, 'line 13 = $3,532.39 -> Schedule 1 line 15')
        },
        // Line 11's half-cent, isolated. 2.9% of $46,175.00 is exactly
        // 133,907.5 cents, the one rounding tie in the worked case above, and
        // half-up takes it UP. A truncating implementation gives $1,339.07
        // and a whole dollar less of tax over a year of such returns; a
        // half-even implementation gives $1,339.08 too, so this leaf pins
        // "not truncation" rather than "half-up specifically" — the pair at
        // the $400 floor below is what pins half-up itself.
        lineElevenRoundsAHalfCentAwayFromZero: () => {
            assertEq(4617500n * 290n, 1339075000n, '2.9% of $46,175.00 is 133,907.5 cents exactly')
            assertEq(run(5000000n)(0n).line11, 133908n, 'half-up, never 133,907')
        },
        // THE ROUNDING POINT, pinned by the pair one cent apart that decides
        // whether ANY tax is owed. See this module's own docstring: at
        // $433.12 of net profit, 92.35% is 39,998.632 cents and rounds to
        // $399.99; at $433.13 it is 39,999.5555 and rounds to $400.00. Under
        // truncation BOTH are $399.99 and neither owes tax.
        //
        // **This is the leaf Phase 27's `theBandThisOverRefusesIsNamedRather\
        // ThanHidden` becomes.** That leaf refused $433.12 while recording
        // that it owed nothing; this one computes $0.00 for it, and finds the
        // real boundary one cent higher.
        theFourHundredDollarFloorIsAppliedToNetEARNINGS: () => {
            // Hand-computed, from the printed factor rather than the code:
            assertEq(43312n * 9235n, 399986320n, '$433.12 x 0.9235 = 39,998.632 cents')
            assertEq(43313n * 9235n, 399995555n, '$433.13 x 0.9235 = 39,999.5555 cents')

            const below = run(43312n)(0n)
            assertEq(below.line4a, 39999n, 'line 4a = $399.99, half-up from 39,998.632')
            assert(
                below.line4c < printedMinimumNetEarningsCents,
                ['line 4c is below §1402(b)(2)\'s $400', below.line4c])
            assertEq(below.line6, 0n, 'line 6 = $0.00 -- the printed "stop"')
            assertEq(below.line12, 0n, 'no self-employment tax at all')
            assertEq(below.line13, 0n, 'and therefore no deduction')
            // …and lines 7 through 9 are still filled in, because they are
            // facts about the wage base rather than about this taxpayer.
            assertEq(below.line7, printedWageBaseCents, 'line 7 is still the wage base')
            assertEq(below.line9, printedWageBaseCents, 'line 9 is still the unused base')

            const at = run(43313n)(0n)
            assertEq(at.line4a, 40000n, 'line 4a = $400.00, half-up from 39,999.5555')
            assertEq(at.line6, 40000n, 'line 6 = $400.00 -- the form continues')
            // 12.4% of 40,000 = 4,960 cents; 2.9% of 40,000 = 1,160 cents.
            assertEq(at.line10, 4960n, 'line 10 = $49.60')
            assertEq(at.line11, 1160n, 'line 11 = $11.60')
            assertEq(at.line12, 6120n, 'line 12 = $61.20 of tax on $433.13 of profit')
            assertEq(at.line13, 3060n, 'line 13 = $30.60')
        },
        // Below the floor by a mile, and exactly AT $400 of NET EARNINGS by
        // the other route: a net profit of $433.14 is also above. The pair
        // above catches `<` silently becoming `<=`; this catches the floor
        // being compared against the wrong LINE -- against net profit (line
        // 3) rather than net earnings (line 4c), which is precisely what
        // Phase 27's `fjs/schedule/c` did on purpose and this phase undoes.
        theFloorIsComparedAgainstLineFourCNotLineThree: () => {
            // $410.00 of net profit: line 3 is ABOVE $400 and line 4c is
            // BELOW it ($378.64), so a floor applied to line 3 would charge
            // tax and a floor applied to line 4c charges none.
            const result = run(41000n)(0n)
            assert(result.line3 > printedMinimumNetEarningsCents, 'line 3 is above $400.00')
            assertEq(result.line4a, 37864n, '$410.00 x 0.9235 = 37,863.5 -> $378.64, half-up')
            assert(result.line4c < printedMinimumNetEarningsCents, 'line 4c is below $400.00')
            assertEq(result.line12, 0n, 'no tax: the floor is §1402(a)(12) net earnings, not net profit')
        },
        // A LOSS passes through line 4a unmultiplied -- "if line 3 is more
        // than zero, multiply ... otherwise, enter amount from line 3" -- and
        // then stops at line 4c. `fjs/schedule/c` refuses a loss before this
        // form is ever reached, so this is the printed rule implemented
        // rather than a case the product path produces; it is here because
        // multiplying a negative by 0.9235 would make the loss SMALLER, and a
        // reader diffing this function against the page must be able to see
        // that it does not.
        aLossIsNotMultipliedByTheFactor: () => {
            const result = run(-100000n)(0n)
            assertEq(result.line4a, -100000n, 'line 4a = -$1,000.00, entered rather than multiplied')
            assertEq(result.line12, 0n, 'and the form stops at line 4c')
        },
    },

    wageBase: {
        // THE PHASE'S HEADLINE COORDINATION, priced against the naive answer.
        // A single filer with two jobs totalling $150,000.00 of box 3 wages
        // and a $50,000.00 Schedule C net profit.
        //
        //   line 6   92.35% of $50,000.00                        $46,175.00
        //   line 7   wage base                                  $176,100.00
        //   line 8d  two W-2s, boxes 3                          $150,000.00
        //   line 9   176,100.00 - 150,000.00                     $26,100.00
        //   line 10  min(46,175.00, 26,100.00) = 26,100.00
        //            2,610,000 x 1240 / 10,000 = 323,640          $3,236.40
        //   line 11  4,617,500 x 290 / 10,000 = 133,907.5         $1,339.08
        //   line 12  3,236.40 + 1,339.08                          $4,575.48
        //
        // THE NAIVE ANSWER -- no sharing, the full base available to the
        // business -- would take 12.4% of the whole $46,175.00 and give
        // $5,725.70 on line 10 and $7,064.78 on line 12, which is
        // $2,489.30 more tax than is owed. Both figures are asserted, so a
        // wiring that dropped line 8a would land on the second and say so.
        twoJobsPlusABusinessShareOneWageBaseWagesFirst: () => {
            const result = run(5000000n)(15000000n)
            assertEq(result.line6, 4617500n, 'line 6 = $46,175.00')
            assertEq(result.line8a, 15000000n, 'line 8a = $150,000.00 of box 3 wages')
            assertEq(result.line9, 2610000n, 'line 9 = $26,100.00 = $176,100.00 - $150,000.00')
            assertEq(result.line10, 323640n, 'line 10 = $3,236.40 = 12.4% of the REMAINING base')
            assertEq(result.line11, 133908n, 'line 11 = $1,339.08 -- the Medicare portion is uncapped')
            assertEq(result.line12, 457548n, 'line 12 = $4,575.48')
            // THE NAIVE ANSWER, hand-computed and asserted to DIFFER. Without
            // this half the leaf above would pass for an implementation that
            // ignored wages entirely at any input where the base happened not
            // to bind.
            const naive = run(5000000n)(0n)
            assertEq(naive.line10, 572570n, 'no sharing would give $5,725.70')
            assertEq(naive.line12, 706478n, 'no sharing would give $7,064.78 of tax')
            assertEq(naive.line12 - result.line12, 248930n, '$2,489.30 of tax the sharing removes')
        },
        // WAGES AT OR ABOVE THE BASE consume all of it: line 9 floors at
        // zero, line 10 is zero, and ONLY the uncapped 2.9% Medicare portion
        // is owed. The printed page says so twice -- line 8a's "if $176,100
        // or more, skip lines 8b through 10" and line 9's "if zero or less,
        // enter -0- here and on line 10".
        wagesAtTheBaseLeaveOnlyTheUncappedMedicarePortion: () => {
            const exactly = run(5000000n)(printedWageBaseCents)
            assertEq(exactly.line9, 0n, 'line 9 = $0.00, the base is exhausted')
            assertEq(exactly.line10, 0n, 'line 10 = $0.00, no Social Security portion left to tax')
            assertEq(exactly.line11, 133908n, 'line 11 = $1,339.08, still owed -- 2.9% is uncapped')
            assertEq(exactly.line12, 133908n, 'line 12 = $1,339.08')

            const above = run(5000000n)(printedWageBaseCents + 100n)
            assertEq(above.line9, 0n, 'a dollar over the base floors at zero, never negative')
            assertEq(above.line12, 133908n, 'and the tax is the same')
        },
        // ONE CENT of remaining base still produces a Social Security
        // portion, so the floor above is a floor rather than a comparison
        // that swallowed the boundary. 12.4% of one cent is 0.0124 cents,
        // which rounds to $0.00 -- so the probe that proves the rate BITES is
        // at 41 cents (12.4% of 41 = 5.084 -> 5 cents), the same
        // boundary-trio shape `fjs/form8959` uses.
        oneCentBelowTheBaseIsStillTaxed: () => {
            const oneCent = run(5000000n)(printedWageBaseCents - 1n)
            assertEq(oneCent.line9, 1n, 'line 9 = $0.01 of base left')
            assertEq(oneCent.line10, 0n, '12.4% of one cent rounds to $0.00')
            const fortyOne = run(5000000n)(printedWageBaseCents - 41n)
            assertEq(fortyOne.line9, 41n, 'line 9 = $0.41 of base left')
            assertEq(fortyOne.line10, 5n, 'line 10 = $0.05 -- 12.4% of 41 cents is 5.084')
        },
        // The Medicare portion is computed on line 6, NOT on the capped
        // `min` line 10 takes. Asserted at wages that exhaust the base, where
        // the two differ by the whole of the tax: if line 11 read the `min`,
        // it would be $0.00 here instead of $1,339.08.
        theMedicarePortionReadsLineSixRatherThanTheCappedMinimum: () => {
            const result = run(5000000n)(printedWageBaseCents)
            assertEq(result.line10, 0n, 'the capped portion is zero')
            assert(result.line11 > 0n, ['the uncapped portion is not', result.line11])
            assertEq(result.line11, 133908n, '2.9% of the WHOLE $46,175.00')
        },
    },

    // Line 8a's document read: box 3 and box 7, from the PROPRIETOR's Forms
    // W-2 only.
    lineEightA: {
        // Two jobs, both the proprietor's, both cited. A single-document
        // fixture could not tell a sum from a "read the first one" bug.
        // $85,000.00 + $65,000.00 = $150,000.00, hand-added.
        bothJobsAreSummedAndEachIsCited: () => {
            const result = socialSecurityWagesAlreadyTaxed([
                w2Doc('sha256-w2-a')('222-22-2222')('85000.00'),
                w2Doc('sha256-w2-b')('222-22-2222')('65000.00'),
            ])('222-22-2222')
            assertEq(result.cents, 15000000n, '$85,000.00 + $65,000.00 = $150,000.00')
            assertEq(result.sources.length, 2)
            assertEq(sourceAt(result.sources)(0).documentHash, 'sha256-w2-a')
            assertEq(sourceAt(result.sources)(0).boxPath, 'box3SocialSecurityWages')
            assertEq(sourceAt(result.sources)(1).documentHash, 'sha256-w2-b')
        },
        // BOX 3, NOT BOX 5, and the fixture makes them differ: a filer with a
        // 401(k) deferral and wages above the base has box 3 capped at
        // $176,100 while box 5 keeps going. Reading box 5 would over-consume
        // the base — here by $23,900, which is $2,963.60 of Social Security
        // tax at 12.4%.
        boxThreeIsReadAndBoxFiveIsNot: () => {
            /** @type {Stored<W2>} */
            const highEarner = {
                documentHash: 'sha256-w2-high',
                value: {
                    ...bareW2Value,
                    box3SocialSecurityWages: '176100.00',
                    box5MedicareWagesAndTips: '200000.00',
                },
            }
            const result = socialSecurityWagesAlreadyTaxed([highEarner])('222-22-2222')
            assertEq(result.cents, printedWageBaseCents, 'box 3 stops at the base by construction')
            assertEq(result.sources.length, 1, 'exactly one box is read')
            assert(
                sourceAt(result.sources)(0).boxPath === 'box3SocialSecurityWages',
                ['line 8a reads box 3', sourceAt(result.sources)(0).boxPath])
            for (const source of result.sources) {
                assert(
                    source.boxPath !== 'box5MedicareWagesAndTips',
                    ['box 5 is Medicare wages and is uncapped; it must never reach line 8a', source])
            }
        },
        // Box 7, Social Security TIPS, is added: the printed line says "total
        // of boxes 3 and 7". A waiter with a business is the case, and
        // dropping box 7 would leave part of the base unconsumed.
        // $30,000.00 + $12,000.00 = $42,000.00, hand-added.
        boxSevenTipsAreAddedToBoxThree: () => {
            /** @type {Stored<W2>} */
            const tipped = {
                documentHash: 'sha256-w2-tips',
                value: {
                    ...bareW2Value,
                    box3SocialSecurityWages: '30000.00',
                    box7SocialSecurityTips: '12000.00',
                },
            }
            const result = socialSecurityWagesAlreadyTaxed([tipped])('222-22-2222')
            assertEq(result.cents, 4200000n, '$30,000.00 + $12,000.00 = $42,000.00')
            assertEq(result.sources.length, 2, 'both boxes cited')
            assertEq(sourceAt(result.sources)(1).boxPath, 'box7SocialSecurityTips')
        },
        // A SPOUSE'S W-2 does not consume the proprietor's base. The base is
        // per person, a joint return carries two people's W-2s and one
        // Schedule C, and letting the spouse's wages count would shelter the
        // proprietor's earnings behind somebody else's ceiling.
        aSpousesWagesDoNotConsumeTheProprietorsBase: () => {
            const result = socialSecurityWagesAlreadyTaxed([
                w2Doc('sha256-w2-taxpayer')('222-22-2222')('20000.00'),
                w2Doc('sha256-w2-spouse')('333-33-3333')('170000.00'),
            ])('222-22-2222')
            assertEq(result.cents, 2000000n, 'only the proprietor\'s own $20,000.00')
            assertEq(result.sources.length, 1, 'the spouse\'s W-2 is not cited')
            assertEq(sourceAt(result.sources)(0).documentHash, 'sha256-w2-taxpayer')
        },
        // THE CONTROL for the filter: the SAME two W-2s with the spouse as
        // proprietor give the other answer. A filter written against the
        // wrong side, or one that always matched, would pass the leaf above
        // and fail here.
        theFilterReallyReadsTheProprietorsTin: () => {
            const forms = [
                w2Doc('sha256-w2-taxpayer')('222-22-2222')('20000.00'),
                w2Doc('sha256-w2-spouse')('333-33-3333')('170000.00'),
            ]
            assertEq(socialSecurityWagesAlreadyTaxed(forms)('333-33-3333').cents, 17000000n)
            assertEq(socialSecurityWagesAlreadyTaxed(forms)('222-22-2222').cents, 2000000n)
        },
        // No business record at all: no proprietor, so nothing consumes
        // anything and nothing is cited. This is the case that keeps a return
        // with no self-employment computing exactly what it computed before
        // this phase — the wages are real, and they are simply not this
        // form's business.
        noProprietorMeansNoWagesAndNoCitations: () => {
            const result = socialSecurityWagesAlreadyTaxed([
                w2Doc('sha256-w2-a')('222-22-2222')('85000.00'),
            ])(undefined)
            assertEq(result.cents, 0n)
            assertEq(result.sources.length, 0, 'a line nothing read cites nothing')
        },
        // An absent box 3 contributes nothing and is not cited — DOC-11's
        // absent-is-not-zero rule, applied to the one box that decides how
        // much of the wage base is left.
        anAbsentBoxThreeContributesNoSource: () => {
            const result = socialSecurityWagesAlreadyTaxed([
                w2Doc('sha256-w2-a')('222-22-2222')(undefined),
            ])('222-22-2222')
            assertEq(result.cents, 0n)
            assertEq(result.sources.length, 0)
        },
    },

    attribution: {
        // A NON-JOINT return with a W-2 issued to somebody else refuses,
        // naming both TINs and both directions the error could run.
        aForeignW2OnANonJointReturnRefusesNamingBothTins: () => {
            const outcome = wagesAttributionRefusal('single')([
                w2Doc('sha256-w2-other')('333-33-3333')('170000.00'),
            ])('222-22-2222')
            assert(outcome.kind === 'error', ['expected a refusal', outcome])
            assert(outcome.message.includes('333-33-3333'), ['must name the W-2 recipient', outcome.message])
            assert(outcome.message.includes('222-22-2222'), ['must name the proprietor', outcome.message])
            assert(outcome.message.includes('170000.00'), ['must quote the wages', outcome.message])
            assert(outcome.message.includes('§1402(b)(1)'), ['must name the sharing rule', outcome.message])
            assert(
                outcome.message.includes('overstates the tax')
                    && outcome.message.includes('1040 line 1a'),
                ['must name BOTH directions the error could run', outcome.message])
        },
        // THE CONTROL, and it is the important one: a JOINT return with the
        // identical documents computes. A guard that refused every
        // mismatching W-2 would break every two-earner couple with a
        // business, which is the commonest founder household there is.
        theSameDocumentsOnAJointReturnCompute: () => {
            assertEq(
                wagesAttributionRefusal('marriedFilingJointly')([
                    w2Doc('sha256-w2-other')('333-33-3333')('170000.00'),
                ])('222-22-2222').kind,
                'ok',
            )
        },
        // A SECOND control: matching TINs compute on every status, so the
        // refusal is about attribution rather than about having a W-2 at all.
        theProprietorsOwnW2NeverRefuses: () => {
            /** @type {readonly IndividualFilingStatus[]} */
            const everyStatus = [
                'single', 'marriedFilingJointly', 'marriedFilingSeparately',
                'headOfHousehold', 'qualifyingSurvivingSpouse',
            ]
            for (const status of everyStatus) {
                assertEq(
                    wagesAttributionRefusal(status)([
                        w2Doc('sha256-w2-a')('222-22-2222')('85000.00'),
                    ])('222-22-2222').kind,
                    'ok',
                    ['the proprietor\'s own W-2 is never a refusal', status],
                )
            }
        },
        // A THIRD control, and the one that keeps the guard narrow: a
        // mismatching W-2 with NO box 3 cannot change the answer, so it does
        // not stop the return. Clergy and household-employee W-2s are the
        // real shapes of this.
        aForeignW2WithNoSocialSecurityWagesDoesNotRefuse: () => {
            assertEq(
                wagesAttributionRefusal('single')([
                    w2Doc('sha256-w2-other')('333-33-3333')(undefined),
                ])('222-22-2222').kind,
                'ok',
            )
            assertEq(
                wagesAttributionRefusal('single')([
                    w2Doc('sha256-w2-other')('333-33-3333')('0.00'),
                ])('222-22-2222').kind,
                'ok',
                'a zero box 3 consumes none of the base either',
            )
        },
    },

    refusals: {
        // Part II is a real named function for a real printed part, and it
        // always refuses -- naming the election, the gross-income input, the
        // prior-year test and the unsourced line-14 maximum. A refusal naming
        // only one of the four would leave a reader thinking one fix suffices.
        optionalMethodsRefuseNamingAllFourObstacles: () => {
            const outcome = optionalMethodsPartII()
            assertEq(outcome.kind, 'error')
            assert(outcome.message.includes('Part II'), ['must name the printed part', outcome.message])
            assert(outcome.message.includes('lines 14-17'), ['must name the printed lines', outcome.message])
            assert(outcome.message.includes('ELECTION'), ['must say it is elective', outcome.message])
            assert(outcome.message.includes('line 7'), ['must name the gross-income input', outcome.message])
            assert(
                outcome.message.includes('2 of the 3 prior years'),
                ['must name the prior-year test', outcome.message])
            assert(outcome.message.includes('line 4b'), ['must say where it would have landed', outcome.message])
        },
        // Line 5a refuses in BOTH directions, and the second is the one a
        // reader is unlikely to think of: §1402(g) can make the tax ZERO for
        // an approved Form 4029 or Form 4361 filer, so this gap is not only
        // an understatement risk.
        churchEmployeeIncomeRefusesInBothDirections: () => {
            const outcome = churchEmployeeIncomeLine5a()
            assertEq(outcome.kind, 'error')
            assert(outcome.message.includes('line 5a'), ['must name the printed line', outcome.message])
            assert(outcome.message.includes('§3121(w)'), ['must name the employer election', outcome.message])
            assert(outcome.message.includes('§1402(g)'), ['must name the exemption', outcome.message])
            assert(outcome.message.includes('Form 4029'), ['must name the sect exemption form', outcome.message])
            assert(outcome.message.includes('Form 4361'), ['must name the minister exemption form', outcome.message])
            assert(
                outcome.message.includes('vnd.fjs.w2'),
                ['must name the dialect that cannot carry it', outcome.message])
        },
        // The five printed lines this engine cannot fill are structurally
        // zero at EVERY input, and this is the leaf that says so at a
        // realistic one rather than at zero -- where "zero because the input
        // was zero" and "zero because the line is unreachable" are
        // indistinguishable.
        theFiveUnreachableLinesAreZeroAtARealisticInput: () => {
            const result = run(5000000n)(15000000n)
            assertEq(result.line1a, 0n, 'line 1a = $0.00 -- no Schedule F')
            assertEq(result.line1b, 0n, 'line 1b = $0.00 -- no Schedule F')
            assertEq(result.line4b, 0n, 'line 4b = $0.00 -- no optional method')
            assertEq(result.line5a, 0n, 'line 5a = $0.00 -- no church employee income')
            assertEq(result.line5b, 0n, 'line 5b = $0.00')
            assertEq(result.line8b, 0n, 'line 8b = $0.00 -- Form 4137 refuses')
            assertEq(result.line8c, 0n, 'line 8c = $0.00 -- Form 8919 refuses')
            // …and the totals still ADD them, so a future non-zero line
            // reaches the tax without another edit here.
            assertEq(result.line3, result.line1a + result.line1b + result.line2, 'line 3 adds all three')
            assertEq(result.line4c, result.line4a + result.line4b, 'line 4c adds both')
            assertEq(result.line8d, result.line8a + result.line8b + result.line8c, 'line 8d adds all three')
        },
    },

    // Hand-typed line-count guard, this project's mutation-gate idiom: a line
    // dropped from the returned record fails here even though every leaf
    // above reads only the lines it names. Lines 1a, 1b, 2, 3, 4a, 4b, 4c,
    // 5a, 5b, 6, 7, 8a, 8b, 8c, 8d, 9, 10, 11, 12, 13 -- twenty, which is
    // exactly Part I with none missing. Part II's four are NOT here: they are
    // {@link optionalMethodsPartII}'s refusal, not a set of zeros.
    everyPrintedPartOneLineIsNamed: () => {
        const result = run(5000000n)(0n)
        const expectedFieldCount = 20
        assertEq(
            Object.keys(result).length,
            expectedFieldCount,
            ['expected exactly 20 named Schedule SE Part I fields', Object.keys(result)],
        )
    },

    // A return with no self-employment at all: every line zero except the
    // wage-base facts, which are the form's own constants rather than
    // anything about this taxpayer. The degenerate input, and the strongest
    // statement that this form cannot invent a tax out of nothing.
    noSelfEmploymentIsZeroTax: () => {
        const result = run(0n)(0n)
        assertEq(result.line12, 0n, 'no tax')
        assertEq(result.line13, 0n, 'no deduction')
        assertEq(result.line7, printedWageBaseCents, 'the base is still the base')
    },
}
