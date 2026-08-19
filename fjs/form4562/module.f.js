/**
 * **Form 4562 (TY2025) — Depreciation and Amortization.** Every printed line
 * that is a summand of line 22, named and computed, plus the six refusals the
 * printed page makes unavoidable.
 *
 * Sources, fetched and read directly (2026-08-18), not from recall:
 * - `https://www.irs.gov/pub/irs-pdf/f4562.pdf` — the 2025 form, Cat. No.
 *   12906N, "Created 10/9/25".
 * - `https://www.irs.gov/pub/irs-pdf/i4562.pdf` — the 2025 instructions.
 * - `https://www.irs.gov/pub/irs-pdf/p946.pdf` — Publication 946 (2025).
 *
 * See `fjs/form4562/todo/depreciation-and-the-asset-register.md` for the full
 * argument and every printed caption transcribed. The claims that decide this
 * module's SHAPE are repeated here, because they decide every line of it.
 *
 * This module reads NO documents — it takes extracted `bigint` facts and
 * returns per-line records, the shape every form module in this engine has.
 * `fjs/schedule/c` is the reader.
 *
 * ## WHAT COMPUTES AND WHAT REFUSES, in one table
 *
 * | Printed | Computes? | From / why not |
 * |---|---|---|
 * | Part I lines 1-11, 13 | NOT MODELED | see "Part I is one number" below |
 * | 12 §179 expense deduction | documented zero, and REFUSES if elected | Part I |
 * | 14 special depreciation allowance | documented zero, and REFUSES if claimed this year | Part II |
 * | 15 §168(f)(1) election | documented zero | not representable |
 * | 16 other depreciation (incl. ACRS) | documented zero | pre-1987 property refuses at the dialect |
 * | 17 MACRS on prior-year assets | ✔ | `fjs/form4562/macrs`, at the recovery year the placed-in-service date implies |
 * | 18 general asset accounts | not elected | an election with no representation |
 * | 19a-19f, 19i, 19j column (g) | ✔ | `fjs/form4562/macrs`, per classification |
 * | 19g, 19h | structural zeros | 25-year and 50-year property cannot be spelled — Publication 946 prints no table |
 * | 20a-20e (ADS) | structural zeros | ADS is not representable; see the spec |
 * | 21 listed property | documented zero, and REFUSES if any asset is listed | Part V |
 * | 22 total | ✔ | *"Add amounts from line 12, lines 14 through 17, lines 19 and 20 in column (g), and line 21"* |
 * | 23a, 23b (§263A) | documented zeros, never summands | informational |
 *
 * ## Part I is ONE number, and it is zero — which is an argument, not a gap
 *
 * Line 12 is *"Section 179 expense deduction. Add lines 9 and 10, but don't
 * enter more than line 11."* This module refuses any elected §179 cost
 * (line 6/line 8), so line 9 — *"Tentative deduction. Enter the smaller of
 * line 5 or line 8"* — is zero. It refuses a register that does not certify
 * line 10's *"Carryover of disallowed deduction from line 13 of your 2024 Form
 * 4562"* is zero, so line 10 is zero. `0 + 0 = 0`, and line 11 is the business
 * income limitation *"(not less than zero)"*, so `min(0, line11) = 0`
 * whatever line 11 is.
 *
 * **That is why lines 1 through 5 and line 11 are not fields here.** They
 * cannot bind. Modelling them would mean storing the $2,500,000 maximum and
 * the $4,000,000 phase-down threshold as tax-year parameters no line reads —
 * the argument `fjs/schedule/c` already makes for taking no `TaxParamSet` at
 * all, and the reason this module takes none either: not one figure it
 * computes is indexed, statutory or a rate.
 *
 * The two refusals are real, not defensive. Line 11 is *"the smaller of line 5
 * or the total taxable income from any trade or business you actively
 * conducted"* plus wages, computed without regard to the §179 deduction
 * itself; line 13 carries the disallowed part into a year this engine cannot
 * store. Both are the prior-year/cross-schedule blockers this project has
 * documented since Phase 26.
 *
 * ## Part II refuses a CURRENT-year allowance and accepts a PRIOR-year one,
 * and the asymmetry is the whole point
 *
 * A prior-year asset's `specialDepreciationAllowanceClaimed` is a figure the
 * taxpayer transcribes off their own earlier Form 4562 line 14. It is read
 * ONLY to reduce the basis for depreciation, exactly as
 * `vnd.fjs.prior_year_ira_basis` transcribes Form 8606 line 14.
 *
 * A CURRENT-year allowance would be a deduction on THIS return, and this
 * engine will not deduct a figure whose limit it did not apply — Schedule C
 * line 24b's stated principle. The applicable percentage turns on the
 * ACQUISITION date rather than the placed-in-service date (100% after 19
 * January 2025; 40%, or 60% for a long production period or certain aircraft,
 * for property acquired after 27 September 2017 and before 20 January 2025),
 * on six exclusions, and on a class-wide election-out statement. So a
 * current-year `allowanceClaimed` REFUSES, and `electedOut` computes.
 *
 * ## The AMT adjustment, and the two printed cautions that switch it off
 *
 * §56(a)(1)(A)(ii), as amended by TRA'97 §1120 for property placed in service
 * after 1998: property on the 200% declining balance method for the regular
 * tax is on the **150% declining balance method over the same recovery
 * period** for the alternative minimum tax. So the adjustment is the same
 * schedule computed twice, and `fjs/form4562/macrs` needs no second rule for
 * it.
 *
 * **It is not floored.** 200 DB front-loads, so in the later years of an
 * asset's life the AMT schedule is the LARGER of the two and the adjustment is
 * negative — `fjs/form6251` line 2j is already documented as un-floored for
 * the identical reason, and flooring this one would overstate alternative
 * minimum taxable income for every business past the halfway point of its
 * equipment's life.
 *
 * i4562 p7 switches the adjustment off entirely in two cases, and states each
 * in its own sentence:
 *
 * > *"Caution: If you take the special depreciation allowance, you must reduce
 * > the amount on which you figure your regular depreciation or amortization
 * > deduction by the amount deducted. Also, you will not have any AMT
 * > adjustment for depreciation for the qualified property."*
 *
 * > *"Note: If you elect to not have any special depreciation allowance apply,
 * > the property placed in service during the tax year will not be subject to
 * > an AMT adjustment for depreciation."*
 *
 * That is why `section168kStatus` is a stored three-value vocabulary: neither
 * caution is derivable from a basis and a date, and reading either wrongly
 * moves real tax.
 *
 * Because §56(a)(1) used the ADS class life rather than the GDS recovery
 * period before 1999, a 200 DB asset that old is REFUSED rather than adjusted
 * — but only while it still has a deduction to adjust, so a long-since
 * exhausted asset does not refuse a return it cannot affect.
 *
 * @module
 */
import { assert, assertEq } from 'functionalscript/fjs/asserts/module.f.mjs'
import { of, multiply, ofInt, halfUp } from '../types/rational/module.f.js'
import { centsToString } from '../exact/module.f.js'
import {
    macrsClassifications, macrsDeductionCents, macrsDisposalDeductionCents,
} from './macrs/module.f.js'

/** @import { MacrsConvention, MacrsMethod } from './macrs/module.f.js' */

/**
 * One depreciable asset, as extracted `bigint` facts. Every field is a printed
 * Form 4562 column; `vnd.fjs.asset_register` is where each one's citation
 * lives, and where the vocabularies are validated.
 * @typedef {{
 *   readonly description: string,
 *   readonly placedInServiceYear: number,
 *   readonly placedInServiceMonth: number,
 *   readonly costOrOtherBasisCents: bigint,
 *   readonly businessUseHundredthsOfPercent: bigint,
 *   readonly classification: string,
 *   readonly method: MacrsMethod,
 *   readonly convention: MacrsConvention,
 *   readonly section168kStatus: string,
 *   readonly specialDepreciationAllowanceClaimedCents: bigint,
 *   readonly section179ElectedCostCents: bigint,
 *   readonly listedProperty: boolean,
 *   readonly disposal: AssetDisposal | undefined,
 * }} DepreciableAsset
 */

/**
 * The end of one asset's history, as extracted `bigint` and `number` facts.
 * `vnd.fjs.asset_register`'s `assetDisposal` is where each field's printed
 * citation lives.
 *
 * The two full dates stay STRINGS because the only thing anything does with
 * them is compare them, and a zero-padded `YYYY-MM-DD` compares correctly as
 * text — see `fjs/form4797`'s `heldMoreThanOneYear`, which is one string
 * comparison and no calendar.
 *
 * **Required, not optional (`| undefined` rather than `?:`)**, so that every
 * construction site has to say what it does about a disposal. The alternative
 * lets a fixture omit the key and read as "not disposed of" by accident, which
 * is the shape of absence this repository refuses everywhere else.
 * @typedef {{
 *   readonly acquiredDate: string,
 *   readonly soldDate: string,
 *   readonly soldYear: number,
 *   readonly soldMonth: number,
 *   readonly grossSalesPriceCents: bigint,
 *   readonly expenseOfSaleCents: bigint,
 * }} AssetDisposal
 */

/**
 * Everything Form 4562 needs that is not an asset: the year it is computed
 * for, the printed header's business or activity, and the three certifications
 * `vnd.fjs.asset_register` carries.
 * @typedef {{
 *   readonly taxYear: number,
 *   readonly businessOrActivity: string,
 *   readonly everyDepreciableAssetIsListed: boolean,
 *   readonly noDepreciablePropertyDisposedOfDuringTheYear: boolean,
 *   readonly priorYearSection179CarryoverIsZero: boolean,
 *   readonly assets: readonly DepreciableAsset[],
 * }} Form4562Input
 */

/**
 * The graceful, tagged refusal — the shape every form module in this engine
 * returns and no module throws.
 * @typedef {{ readonly kind: 'error', readonly message: string }} Form4562Error
 */

/**
 * Form 4562's lines, each under its printed number, plus the one figure the
 * printed page does not carry.
 *
 * `alternativeMinimumTaxAdjustmentCents` is Form 6251 line 2l — *"Depreciation
 * on assets placed in service after 1986"*. It is a separate field rather than
 * a line because it is not a Form 4562 line at all: it is the difference
 * between this form and the one §56(a)(1) would have produced, and only this
 * module holds both.
 *
 * `line19` is a record keyed by the printed sub-line letter, not an array: a
 * caller reading `line19.c` wants 7-year property, and a positional read of
 * Form 4562's Section B has no meaning.
 * @typedef {{
 *   readonly kind: 'ok',
 *   readonly line12: bigint,
 *   readonly line14: bigint,
 *   readonly line15: bigint,
 *   readonly line16: bigint,
 *   readonly line17: bigint,
 *   readonly line19: {
 *     readonly a: bigint, readonly b: bigint, readonly c: bigint, readonly d: bigint,
 *     readonly e: bigint, readonly f: bigint, readonly g: bigint, readonly h: bigint,
 *     readonly i: bigint, readonly j: bigint,
 *   },
 *   readonly line20: bigint,
 *   readonly line21: bigint,
 *   readonly line22: bigint,
 *   readonly line23a: bigint,
 *   readonly line23b: bigint,
 *   readonly alternativeMinimumTaxAdjustmentCents: bigint,
 *   readonly midQuarterConventionApplies: boolean,
 * }} Form4562Lines
 */

/** @typedef {Form4562Lines | Form4562Error} Form4562Outcome */

/**
 * The first tax year §56(a)(1)(A)(ii) computes the AMT deduction over the
 * SAME recovery period as the regular tax. Before it, the alternative system
 * used the ADS class life, which is a Publication 946 table this engine does
 * not carry.
 *
 * A named constant rather than a literal in the comparison, so
 * `year-genericity-gate.test.js`'s hardcoded-year-branch pattern is not
 * tripped by a comparison that is statutory rather than year-specific.
 * @type {number}
 */
export const firstYearOfTheSameRecoveryPeriodAmtRule = 1999

/**
 * The share of a tax year's MACRS additions that, if placed in service in the
 * last three months, forces the mid-quarter convention. i4562 p11: *"exceed
 * 40% of the total depreciable bases"*. Strictly exceed — at exactly 40% the
 * half-year convention still applies.
 * @type {bigint}
 */
export const midQuarterThresholdPercent = 40n

/** 100.00% in hundredths of a percent, the denominator a business-use share divides by. @type {bigint} */
const fullBusinessUseHundredths = 10000n

/**
 * i4562 p10, column (c): *"To find the basis for depreciation, multiply the
 * cost or other basis of the property by the percentage of business/investment
 * use. From that result, subtract any credits and deductions allocable to the
 * property"* — of which this engine can produce exactly two, the §179 expense
 * deduction and *"Any special depreciation allowance included on line 14"*.
 *
 * Rounded ONCE, at the multiplication, never per subtrahend.
 * @type {(asset: DepreciableAsset) => bigint}
 */
export const basisForDepreciationCents = asset =>
    businessUseShareCents(asset)
    - asset.section179ElectedCostCents
    - asset.specialDepreciationAllowanceClaimedCents

/**
 * The business-use share of the cost alone — the *"total depreciable bases
 * (before any special depreciation allowance)"* the mid-quarter test in i4562
 * p11 compares, which is a DIFFERENT figure from
 * {@link basisForDepreciationCents} and must not be confused with it: using
 * the post-allowance basis in the 40% test would let a bonus election change
 * everyone else's convention.
 * @type {(asset: DepreciableAsset) => bigint}
 */
export const businessUseShareCents = asset => halfUp(multiply(ofInt(asset.costOrOtherBasisCents))(
    of(asset.businessUseHundredthsOfPercent)(fullBusinessUseHundredths)))

/**
 * The convention the law forces on ONE current-year asset, given whether the
 * mid-quarter test tripped for the year as a whole.
 *
 * i4562 p11: the mid-month convention *"applies only to residential rental
 * property (line 19i), nonresidential real property (line 19j), and railroad
 * gradings and tunnel bores"*; the half-year convention *"applies to all
 * property reported on lines 19a through 19h, unless the mid-quarter
 * convention applies"*.
 * @type {(classification: string) => (midQuarter: boolean) => MacrsConvention}
 */
export const applicableConvention = classification => midQuarter => {
    const spec = macrsClassifications[classification]
    assert(spec !== undefined, ['unknown MACRS classification', classification])
    if (spec === undefined) { throw ['unknown MACRS classification', classification] }
    return spec.midMonth ? 'MM' : midQuarter ? 'MQ' : 'HY'
}

/**
 * i4562 p11's mid-quarter test, run over the assets placed in service in the
 * computed year.
 *
 * *"If the total depreciable bases (before any special depreciation allowance)
 * of MACRS property placed in service during the last 3 months of your tax
 * year exceed 40% of the total depreciable bases of MACRS property placed in
 * service during the entire tax year, the mid-quarter … convention generally
 * applies. In determining whether the mid-quarter convention applies, do not
 * take into account … Any residential rental property, nonresidential real
 * property, or railroad gradings and tunnel bores."*
 *
 * Compared by cross multiplication rather than by dividing, so no rounding
 * decides a convention. Strictly greater, because the printed word is
 * *"exceed"*.
 * @type {(taxYear: number) => (assets: readonly DepreciableAsset[]) => boolean}
 */
export const midQuarterConventionApplies = taxYear => assets => {
    // The exclusion list has a third bullet this function does NOT implement —
    // *"Property that is placed in service and disposed of within the same tax
    // year"* — because {@link formFortyFiveSixtyTwo} refuses such an asset
    // outright, so no computable return can reach here holding one. Writing
    // the filter anyway would be a branch no proof could redden, which is
    // AGENTS.md's "a rule illustrated by an unreachable module is a rule
    // nobody can check". The refusal names the bullet.
    const counted = assets.filter(asset => {
        const spec = macrsClassifications[asset.classification]
        return asset.placedInServiceYear === taxYear && spec !== undefined && !spec.midMonth
    })
    const total = counted.reduce((sum, asset) => sum + businessUseShareCents(asset), 0n)
    const lastQuarter = counted
        .filter(asset => asset.placedInServiceMonth > 9)
        .reduce((sum, asset) => sum + businessUseShareCents(asset), 0n)
    return lastQuarter * 100n > midQuarterThresholdPercent * total
}

/**
 * The regular-tax and alternative-minimum-tax deductions for ONE asset in the
 * computed year, from the one schedule `fjs/form4562/macrs` derives.
 *
 * The AMT deduction equals the regular one — no adjustment — in three cases,
 * and every one of them is a printed rule rather than a simplification: the
 * asset took the special depreciation allowance (i4562 p7's Caution), it
 * elected out of the allowance (i4562 p7's Note), or it is not on the 200%
 * declining balance method at all, which is what §56(a)(1)(A)(ii) replaces.
 * @type {(taxYear: number) => (asset: DepreciableAsset) => { readonly regularCents: bigint, readonly alternativeCents: bigint }}
 */
export const assetDeductionCents = taxYear => asset => {
    const basis = basisForDepreciationCents(asset)
    const recoveryYear = taxYear - asset.placedInServiceYear + 1
    // i4562 p11, column (g): *"If you disposed of the property during the
    // current tax year, multiply the result by the applicable decimal amount
    // from the tables in Step 3."* The AMT column takes the same fraction —
    // §56(a)(1) changes the METHOD, never the convention — so both arms read
    // the one `deduct` below and a disposal cannot make them diverge.
    const disposal = asset.disposal
    const soldThisYear = disposal !== undefined && disposal.soldYear === taxYear
    /** @type {(method: MacrsMethod) => bigint} */
    const deduct = method => soldThisYear && disposal !== undefined
        ? macrsDisposalDeductionCents(basis)(asset.classification)(method)(
            asset.placedInServiceMonth)(asset.convention)(recoveryYear)(disposal.soldMonth)
        : macrsDeductionCents(basis)(asset.classification)(method)(
            asset.placedInServiceMonth)(asset.convention)(recoveryYear)
    const regularCents = deduct(asset.method)
    const adjusted = asset.method === '200DB' && asset.section168kStatus === 'notQualifiedProperty'
    return {
        regularCents,
        alternativeCents: adjusted ? deduct('150DB') : regularCents,
    }
}

/**
 * **Depreciation allowed OR ALLOWABLE**, cumulatively, from recovery year 1
 * through the year of sale — Form 4797 line 22, and the figure §1245(a)(2)
 * recaptures.
 *
 * i4797 p9's line 22 Step 1: *"Deductions allowed **or allowable** for
 * depreciation (including any special depreciation allowance …)"*, plus *"The
 * section 179 expense deduction"*. A taxpayer who under-claimed still
 * recaptures, so this is never a transcribed "what I actually deducted".
 *
 * It is derivable here for the same reason `vnd.fjs.asset_register` carries no
 * accumulated depreciation at all: Publication 946 Table A-1's own header is
 * *"Multiply your property's unadjusted basis each year by the percentage"*,
 * so year `n`'s deduction is a function of the unadjusted basis and the
 * elapsed years and never of what was deducted — which is the definition of
 * *allowable*. `fjs/form4562/macrs`'s `macrsColumn` already derives the whole
 * column; this walks it.
 *
 * **Each year is rounded at its own line, and the rounded years are summed.**
 * That is the cumulative amount that was allowable, year by year, on the Forms
 * 4562 those years would have carried. Applying a cumulative percentage and
 * rounding once would produce a figure no year's form ever showed.
 *
 * The §179 term is always `0n` in a computable return, because a non-zero
 * `section179ElectedCost` refuses the whole Form 4562 — it is written anyway,
 * with this note, so that lifting that refusal cannot silently drop §179 from
 * the recapture base.
 * The computed tax year is NOT a parameter: the disposal carries its own
 * `soldYear`, and the register refuses a `dateSold` outside its own `taxYear`,
 * so a second copy of the year here could only ever disagree with the one the
 * document already carries.
 * @type {(asset: DepreciableAsset) => bigint}
 */
export const depreciationAllowedOrAllowableCents = asset => {
    const disposal = asset.disposal
    assert(disposal !== undefined, ['only a disposed asset has a cumulative figure', asset.description])
    if (disposal === undefined) {
        throw ['only a disposed asset has a cumulative figure', asset.description]
    }
    const basis = basisForDepreciationCents(asset)
    const finalRecoveryYear = disposal.soldYear - asset.placedInServiceYear + 1
    let total = asset.specialDepreciationAllowanceClaimedCents + asset.section179ElectedCostCents
    for (let recoveryYear = 1; recoveryYear < finalRecoveryYear; recoveryYear += 1) {
        total += macrsDeductionCents(basis)(asset.classification)(asset.method)(
            asset.placedInServiceMonth)(asset.convention)(recoveryYear)
    }
    return total + macrsDisposalDeductionCents(basis)(asset.classification)(asset.method)(
        asset.placedInServiceMonth)(asset.convention)(finalRecoveryYear)(disposal.soldMonth)
}

/**
 * Form 4562, or the refusal the register forces.
 *
 * **Every refusal is checked BEFORE any line is built**, so a return carrying
 * one never produces a partial Form 4562 whose line 22 is short by the refused
 * amount — the discipline `fjs/schedule/c`'s Part II already follows. The
 * order below is the order they must run in, and each is explained where it
 * stands.
 * @type {(input: Form4562Input) => Form4562Outcome}
 */
export const formFortyFiveSixtyTwo = input => {
    const { taxYear, businessOrActivity, assets } = input
    const where = `Form 4562 for ${JSON.stringify(businessOrActivity)}`

    // 1. Listed property — Part V, before anything else, because it refuses
    //    whatever else the register says. §274(d) substantiation is a question
    //    the printed form asks the taxpayer (line 24a/24b), and §280F caps a
    //    passenger automobile at a per-year dollar table this engine does not
    //    carry.
    const listed = assets.find(asset => asset.listedProperty)
    if (listed !== undefined) {
        return {
            kind: 'error',
            message: `${where}: ${JSON.stringify(listed.description)} is LISTED PROPERTY, which `
                + `Part V governs and this engine does not compute. Line 24a asks "Do you have `
                + `evidence to support the business/investment use claimed?" and line 24b "If `
                + `'Yes,' is the evidence written?" — §274(d) substantiation no document here `
                + `carries — and §280F caps a passenger automobile's depreciation at a per-year `
                + `dollar table and forces the straight line method under ADS once qualified `
                + `business use falls to 50% or less. Line 21 would carry the answer and this `
                + `engine cannot produce it, so the whole form refuses rather than reporting a `
                + `line 22 that silently omits the vehicle (no phase yet)`,
        }
    }

    // 2. A §179 election — Part I. See this module's docstring: line 11's
    //    business income limitation and line 13's carryover to next year are
    //    the two blockers, and both are structural.
    const elected = assets.find(asset => asset.section179ElectedCostCents > 0n)
    if (elected !== undefined) {
        return {
            kind: 'error',
            message: `${where}: ${JSON.stringify(elected.description)} elects `
                + `$${centsToString(elected.section179ElectedCostCents)} of §179 expense, and Part `
                + `I cannot be completed. Line 11 limits the deduction to "the smaller of line 5 `
                + `or the total taxable income from any trade or business you actively `
                + `conducted", computed without regard to the §179 deduction itself and including `
                + `wages from Form 1040 line 1a — a cross-schedule figure this form is not given `
                + `— and line 13 carries whatever line 11 disallows into the NEXT tax year, which `
                + `this engine cannot store. Deducting the elected cost without the limitation `
                + `would OVERSTATE the deduction for exactly the proprietor whose business `
                + `income is small, which is who the limitation exists for (no phase yet)`,
        }
    }

    // 3. Line 10's prior-year carryover. Checked even for an empty register:
    //    a carryover is released against THIS year's business income whether
    //    or not anything was bought this year.
    if (!input.priorYearSection179CarryoverIsZero) {
        return {
            kind: 'error',
            message: `${where}: the register does not certify `
                + `priorYearSection179CarryoverIsZero. Form 4562 line 10 is "Carryover of `
                + `disallowed deduction from line 13 of your 2024 Form 4562" — a prior-year `
                + `figure this engine holds one tax year and cannot know. Reading it as zero `
                + `would UNDERSTATE the deduction for a proprietor whose §179 election was `
                + `disallowed last year by the business income limitation, and releasing it `
                + `needs that same limitation on line 11. Add the certification if last year's `
                + `Form 4562 line 13 was zero`,
        }
    }

    // 4. Disposals. **NARROWED**, from a blanket precondition to the shape
    //    `everyDepreciableAssetIsListed` already has: the certification is
    //    required exactly when nothing in the register makes it unnecessary.
    //    Step 3's disposal decimal is `fjs/form4562/macrs`'s
    //    `disposalTwentyFourths` and the recapture is `fjs/form4797`, so a
    //    register that RECORDS its disposals now computes. One that records
    //    none and certifies nothing still refuses: a register lists what is
    //    held, so silence about a sale is indistinguishable from there having
    //    been none, and the part-year deduction and the recapture income would
    //    both vanish without a trace.
    const disposed = assets.filter(asset => asset.disposal !== undefined)
    if (disposed.length === 0 && !input.noDepreciablePropertyDisposedOfDuringTheYear) {
        return {
            kind: 'error',
            message: `${where}: the register records no disposal and does not certify `
                + `noDepreciablePropertyDisposedOfDuringTheYear. A disposal takes a PART-year `
                + `deduction — i4562's Step 3 gives a second decimal column for exactly that — `
                + `and it also triggers §1245 or §1250 recapture on Form 4797. A register lists `
                + `what is still held, so a disposed asset that is neither recorded in a `
                + `disposal block nor certified away leaves no trace at all: the deduction it `
                + `was owed would silently vanish and the recapture income with it. Add the `
                + `certification, or record the disposal`,
        }
    }

    // 4b. An asset placed in service AND disposed of in the same tax year.
    //     i4562 p11 says two things about it, and this engine will not guess
    //     at either across the conventions the page does not cover: it is
    //     struck from the mid-quarter aggregate (*"In determining whether the
    //     mid-quarter convention applies, do not take into account … Property
    //     that is placed in service and disposed of within the same tax
    //     year"*), and under that convention *"no depreciation is allowed"* —
    //     a sentence the printed page states for the MID-QUARTER convention
    //     and for no other. Publication 946 chapter 4 gives the disposal-year
    //     fraction for all three conventions and never repeats the same-year
    //     rule, so whether a half-year or mid-month asset bought and sold in
    //     one year gets half a year or nothing is not settled by anything this
    //     engine has read. Refusing rather than picking one.
    const sameYear = disposed.find(
        asset => asset.placedInServiceYear === taxYear
            && asset.disposal !== undefined && asset.disposal.soldYear === taxYear)
    if (sameYear !== undefined) {
        return {
            kind: 'error',
            message: `${where}: ${JSON.stringify(sameYear.description)} was placed in service in `
                + `${taxYear} and disposed of in ${taxYear}. i4562 excludes such property from `
                + `the mid-quarter test — "In determining whether the mid-quarter convention `
                + `applies, do not take into account … Property that is placed in service and `
                + `disposed of within the same tax year" — and says that under that convention `
                + `"no depreciation is allowed" for it. The printed page states the second rule `
                + `for the mid-quarter convention ONLY, and Publication 946 chapter 4 gives the `
                + `year-of-disposition fraction for all three conventions without repeating it, `
                + `so whether a half-year or mid-month asset bought and sold inside one year `
                + `takes half a year of depreciation or none is not settled by the paper this `
                + `engine reads. Refusing rather than choosing: the wrong choice OVERSTATES the `
                + `deduction and UNDERSTATES the §1245 recapture at the same time, in the one `
                + `year both are decided (no phase yet)`,
        }
    }

    // 5. The completeness certification, required exactly when the mid-quarter
    //    test can bite — i.e. when anything was placed in service this year.
    //    See this module's docstring and the spec, §5.
    const placedInServiceThisYear = assets.filter(asset => asset.placedInServiceYear === taxYear)
    if (placedInServiceThisYear.length !== 0 && !input.everyDepreciableAssetIsListed) {
        return {
            kind: 'error',
            message: `${where}: ${placedInServiceThisYear.length} asset(s) were placed in service `
                + `in ${taxYear} and the register does not certify everyDepreciableAssetIsListed. `
                + `The applicable convention is decided by an AGGREGATE: the mid-quarter `
                + `convention applies when "the total depreciable bases … of MACRS property `
                + `placed in service during the last 3 months of your tax year exceed 40% of the `
                + `total … during the entire tax year". One asset missing from this register `
                + `flips that test for every OTHER asset in it, in either direction, and nothing `
                + `in the data says so. This engine will not pick a convention from a partial `
                + `register`,
        }
    }

    // 6. A current-year special depreciation allowance — Part II. See this
    //    module's docstring for why a PRIOR-year one is accepted and this one
    //    is not.
    const claimedThisYear = placedInServiceThisYear.find(
        asset => asset.section168kStatus === 'allowanceClaimed')
    if (claimedThisYear !== undefined) {
        return {
            kind: 'error',
            message: `${where}: ${JSON.stringify(claimedThisYear.description)} was placed in `
                + `service in ${taxYear} and claims a §168(k) special depreciation allowance of `
                + `$${centsToString(claimedThisYear.specialDepreciationAllowanceClaimedCents)}. `
                + `That is a deduction on THIS return, and this engine will not deduct a figure `
                + `whose limit it did not apply. The applicable percentage turns on the `
                + `ACQUISITION date rather than the placed-in-service date — 100% for qualified `
                + `property acquired after January 19, 2025, 40% (60% for a long production `
                + `period and certain aircraft) for property acquired after September 27, 2017 `
                + `and before January 20, 2025, 50% for qualified reuse and recycling property — `
                + `and on six exclusions and a class-wide election-out statement, none of which `
                + `this register carries. Record section168kStatus as electedOut, or as `
                + `notQualifiedProperty, to compute without it (no phase yet)`,
        }
    }

    // 7. The convention cross-check, for current-year assets only. The stored
    //    value is never the source of the answer -- it is a second copy of a
    //    derivable fact, and the only role such a copy may have is to
    //    disagree loudly. For a PRIOR-year asset the stored convention IS the
    //    source, because the aggregate that decided it was an aggregate over a
    //    year whose asset population this register cannot reconstruct.
    const midQuarter = midQuarterConventionApplies(taxYear)(assets)
    for (const asset of placedInServiceThisYear) {
        const expected = applicableConvention(asset.classification)(midQuarter)
        if (asset.convention !== expected) {
            return {
                kind: 'error',
                message: `${where}: ${JSON.stringify(asset.description)} records the `
                    + `${asset.convention} convention, but ${expected} is what applies to `
                    + `${asset.classification} property placed in service in ${taxYear} in this `
                    + `register. ${midQuarter
                        ? 'More than 40% of this year\'s depreciable bases were placed in service '
                        + 'in the last three months, so the mid-quarter convention applies to '
                        + 'every non-real asset added this year'
                        : 'Not more than 40% of this year\'s depreciable bases were placed in '
                        + 'service in the last three months, so the half-year convention applies '
                        + 'to every non-real asset added this year'}. The convention decides what `
                    + `fraction of the first year is deductible, so the wrong one is wrong in the `
                    + `year the deduction is largest`,
            }
        }
    }

    // 8. Pre-1999 200 DB property, whose AMT recovery period was the ADS class
    //    life rather than the GDS one -- but only while it still has a
    //    deduction to adjust, so a long-exhausted asset does not refuse a
    //    return it cannot affect.
    for (const asset of assets) {
        if (asset.method !== '200DB'
            || asset.placedInServiceYear >= firstYearOfTheSameRecoveryPeriodAmtRule) {
            continue
        }
        const { regularCents, alternativeCents } = assetDeductionCents(taxYear)(asset)
        if (regularCents !== 0n || alternativeCents !== 0n) {
            return {
                kind: 'error',
                message: `${where}: ${JSON.stringify(asset.description)} was placed in service in `
                    + `${asset.placedInServiceYear} on the 200 DB method and still has `
                    + `$${centsToString(regularCents)} of depreciation to take. §56(a)(1)(A)(ii) `
                    + `computed the alternative minimum tax deduction over the ADS CLASS LIFE for `
                    + `property placed in service before `
                    + `${firstYearOfTheSameRecoveryPeriodAmtRule}, not over the same recovery `
                    + `period the regular tax uses, and the class life comes from Publication `
                    + `946's Table of Class Lives and Recovery Periods, which this engine does `
                    + `not carry. Computing the adjustment over the regular recovery period would `
                    + `report a Form 6251 line 2l figure §56 does not produce (no phase yet)`,
            }
        }
    }

    // ── The lines ────────────────────────────────────────────────────────────

    /** @type {(predicate: (asset: DepreciableAsset) => boolean) => bigint} */
    const sumRegular = predicate => assets
        .filter(predicate)
        .reduce((total, asset) => total + assetDeductionCents(taxYear)(asset).regularCents, 0n)

    // 12. "Section 179 expense deduction." Zero, and it is an argument rather
    //     than a placeholder -- see this module's docstring.
    const line12 = 0n
    // 14. "Special depreciation allowance for qualified property … placed in
    //     service during the tax year." Zero: a current-year allowance
    //     refuses above, so nothing can reach this line.
    const line14 = 0n
    // 15. "Property subject to section 168(f)(1) election." Not representable.
    const line15 = 0n
    // 16. "Other depreciation (including ACRS)." Not representable: property
    //     placed in service before 1987 refuses at the dialect.
    const line16 = 0n
    // 17. "MACRS deductions for assets placed in service in tax years
    //     beginning before 2025." i4562 p9 sends this line to the line 19
    //     column (g) instructions, so it is the SAME schedule at a later row.
    const line17 = sumRegular(asset => asset.placedInServiceYear !== taxYear)
    /** @type {(classification: string) => bigint} */
    const currentYearClass = classification => sumRegular(
        asset => asset.placedInServiceYear === taxYear && asset.classification === classification)
    // 19a-19j column (g). 19g (25-year) and 19h (50-year) are structural
    //     zeros: neither classification can be spelled, because Publication
    //     946 prints no percentage table for either.
    const line19 = {
        a: currentYearClass('threeYear'),
        b: currentYearClass('fiveYear'),
        c: currentYearClass('sevenYear'),
        d: currentYearClass('tenYear'),
        e: currentYearClass('fifteenYear'),
        f: currentYearClass('twentyYear'),
        g: 0n,
        h: 0n,
        i: currentYearClass('residentialRental'),
        j: currentYearClass('nonresidentialReal'),
    }
    // 20a-20e (ADS). Structural zero: ADS is not representable -- its recovery
    //     periods come from Publication 946's Table of Class Lives and
    //     Recovery Periods and every mandatory trigger is a fact no dialect
    //     here carries.
    const line20 = 0n
    // 21. "Listed property. Enter amount from line 28." Zero: a listed asset
    //     refuses above.
    const line21 = 0n
    // 22. "Total. Add amounts from line 12, lines 14 through 17, lines 19 and
    //     20 in column (g), and line 21."
    const line22 = line12 + line14 + line15 + line16 + line17
        + line19.a + line19.b + line19.c + line19.d + line19.e
        + line19.f + line19.g + line19.h + line19.i + line19.j
        + line20 + line21
    // 23a/23b. §263A capitalized costs. Informational -- the printed page does
    //     NOT add them into line 22 -- and this register carries no
    //     capitalized-cost facts.
    const line23a = 0n
    const line23b = 0n

    // Form 6251 line 2l. Not floored; see this module's docstring.
    const alternativeMinimumTaxAdjustmentCents = assets.reduce((total, asset) => {
        const { regularCents, alternativeCents } = assetDeductionCents(taxYear)(asset)
        return total + regularCents - alternativeCents
    }, 0n)

    return {
        kind: 'ok',
        line12, line14, line15, line16, line17, line19, line20, line21, line22,
        line23a, line23b,
        alternativeMinimumTaxAdjustmentCents,
        midQuarterConventionApplies: midQuarter,
    }
}

// ── Tests ────────────────────────────────────────────────────────────────────

/** Unwraps a computed form, throwing the refusal if there was one. @type {(outcome: Form4562Outcome) => Form4562Lines} */
const expectLines = outcome => {
    assert(outcome.kind === 'ok', ['expected Form 4562 to compute', outcome])
    if (outcome.kind !== 'ok') { throw ['expected Form 4562 to compute', outcome] }
    return outcome
}

/** Unwraps a refusal, throwing the computed form if there was not one. @type {(outcome: Form4562Outcome) => string} */
const expectRefusal = outcome => {
    assert(outcome.kind === 'error', ['expected a refusal', outcome])
    if (outcome.kind !== 'error') { throw ['expected a refusal', outcome] }
    return outcome.message
}

/** A fully certified, empty register for TY2025. @type {Form4562Input} */
const emptyRegister = {
    taxYear: 2025,
    businessOrActivity: 'software consulting',
    everyDepreciableAssetIsListed: true,
    noDepreciablePropertyDisposedOfDuringTheYear: true,
    priorYearSection179CarryoverIsZero: true,
    assets: [],
}

/** The zero-valued asset every fixture below overrides. @type {DepreciableAsset} */
const bareAsset = {
    description: 'asset',
    placedInServiceYear: 2025,
    placedInServiceMonth: 6,
    costOrOtherBasisCents: 0n,
    businessUseHundredthsOfPercent: 10000n,
    classification: 'sevenYear',
    method: '200DB',
    convention: 'HY',
    section168kStatus: 'electedOut',
    specialDepreciationAllowanceClaimedCents: 0n,
    section179ElectedCostCents: 0n,
    listedProperty: false,
    disposal: undefined,
}

/** @type {(assets: readonly DepreciableAsset[]) => Form4562Input} */
const registerOf = assets => ({ ...emptyRegister, assets })

export const proof = {
    emptyRegisterComputesZero: () => {
        const lines = expectLines(formFortyFiveSixtyTwo(emptyRegister))
        assertEq(lines.line22, 0n)
        assertEq(lines.line17, 0n)
        assertEq(lines.alternativeMinimumTaxAdjustmentCents, 0n)
        assertEq(lines.midQuarterConventionApplies, false)
    },
    basisForDepreciation: {
        /**
         * i4562 p10, column (c), on one worked case: $30,000 of equipment used
         * 60% for business is $18,000 of business-use share, and a $12,000
         * special depreciation allowance leaves $6,000 of basis for
         * depreciation. Every figure hand-computed.
         *
         * The two are DIFFERENT numbers and both are used: the mid-quarter
         * test compares the $18,000, and the MACRS schedule multiplies the
         * $6,000.
         */
        theBusinessUseShareAndTheBasisAreDifferentFigures: () => {
            /** @type {DepreciableAsset} */
            const asset = {
                ...bareAsset,
                costOrOtherBasisCents: 3000000n,
                businessUseHundredthsOfPercent: 6000n,
                section168kStatus: 'allowanceClaimed',
                specialDepreciationAllowanceClaimedCents: 1200000n,
            }
            assertEq(businessUseShareCents(asset), 1800000n, '60% of $30,000.00')
            assertEq(basisForDepreciationCents(asset), 600000n, 'less the $12,000.00 allowance')
        },
        /**
         * The business-use share rounds half-up ONCE: 33.33% of $1,000.01 is
         * $333.3333… and rounds to $333.33, not to $333.34 and not through a
         * float.
         */
        theShareRoundsHalfUpOnce: () => {
            assertEq(businessUseShareCents({
                ...bareAsset, costOrOtherBasisCents: 100001n, businessUseHundredthsOfPercent: 3333n,
            }), 33330n)
            // A genuine half: 50.00% of $0.01 is half a cent, which rounds AWAY
            // from zero to one cent.
            assertEq(businessUseShareCents({
                ...bareAsset, costOrOtherBasisCents: 1n, businessUseHundredthsOfPercent: 5000n,
            }), 1n)
        },
    },
    midQuarterConvention: {
        /**
         * The 40% test, both sides of the boundary, with the arithmetic
         * hand-worked.
         *
         * $60,000 in June and $40,000 in October is EXACTLY 40%, and the
         * printed word is "exceed" — so the half-year convention still
         * applies. One dollar more in October is $40,001 of $100,001, which
         * exceeds 40%, and the mid-quarter convention takes over for BOTH
         * assets.
         */
        theBoundaryIsExclusive: () => {
            /** @type {(octoberCents: bigint) => readonly DepreciableAsset[]} */
            const pair = octoberCents => [
                { ...bareAsset, description: 'june', placedInServiceMonth: 6, costOrOtherBasisCents: 6000000n },
                { ...bareAsset, description: 'october', placedInServiceMonth: 10, costOrOtherBasisCents: octoberCents },
            ]
            assertEq(midQuarterConventionApplies(2025)(pair(4000000n)), false, 'exactly 40% is not "exceed"')
            assertEq(midQuarterConventionApplies(2025)(pair(4000100n)), true, 'one dollar more does exceed it')
        },
        /**
         * Real property is EXCLUDED from the test in both the numerator and
         * the denominator — i4562 p11: *"do not take into account … Any
         * residential rental property, nonresidential real property, or
         * railroad gradings and tunnel bores."*
         *
         * A $1,000,000 December building beside a $10,000 December machine
         * would be 99% of the last quarter if it counted. Excluded, the
         * machine is 100% of a $10,000 total, which still exceeds 40% — so
         * the leaf below pins the exclusion on the DENOMINATOR instead, where
         * including the building would drop the machine's share to 1% and
         * turn the answer off.
         */
        realPropertyIsExcludedFromBothSides: () => {
            /** @type {readonly DepreciableAsset[]} */
            const assets = [
                { ...bareAsset, description: 'january machine', placedInServiceMonth: 1, costOrOtherBasisCents: 9000000n },
                { ...bareAsset, description: 'december machine', placedInServiceMonth: 12, costOrOtherBasisCents: 1000000n },
                {
                    ...bareAsset, description: 'december building', placedInServiceMonth: 12,
                    costOrOtherBasisCents: 100000000n,
                    classification: 'nonresidentialReal', method: 'SL', convention: 'MM',
                },
            ]
            // $10,000 of $100,000 is 10%: the half-year convention applies.
            // Counting the building would make it $1,010,000 of $1,100,000, or
            // 92%, and force the mid-quarter convention on both machines.
            assertEq(midQuarterConventionApplies(2025)(assets), false)
        },
        /**
         * PRIOR-year assets are excluded too: the test is about "property
         * placed in service during the entire tax year", not about everything
         * held. A big prior-year asset in the denominator would suppress the
         * convention for a year that genuinely tripped it.
         */
        priorYearAssetsAreExcluded: () => {
            /** @type {readonly DepreciableAsset[]} */
            const assets = [
                { ...bareAsset, description: 'prior', placedInServiceYear: 2020, placedInServiceMonth: 1, costOrOtherBasisCents: 100000000n },
                { ...bareAsset, description: 'december', placedInServiceMonth: 12, costOrOtherBasisCents: 1000000n },
            ]
            assertEq(midQuarterConventionApplies(2025)(assets), true)
        },
        /**
         * The convention cross-check refuses a register whose stored
         * convention disagrees with the aggregate, quoting BOTH — and it
         * refuses in the direction that matters: an October-heavy year stored
         * as half-year would deduct four times too much in the first year.
         */
        aStoredConventionThatDisagreesRefuses: () => {
            const message = expectRefusal(formFortyFiveSixtyTwo(registerOf([
                { ...bareAsset, description: 'december machine', placedInServiceMonth: 12, costOrOtherBasisCents: 1000000n, convention: 'HY' },
            ])))
            assert(message.includes('HY'), ['the refusal must quote the stored convention', message])
            assert(message.includes('MQ'), ['the refusal must quote the applicable one', message])
            assert(message.includes('40%'), ['the refusal must name the rule', message])
        },
        /**
         * The CONTROL: the same asset with the RIGHT convention computes, and
         * the figure is hand-worked. $10,000 of 7-year property placed in
         * service in December with the mid-quarter convention is Table A-5's
         * 3.57% = $357.00.
         */
        theRightConventionComputes: () => {
            const lines = expectLines(formFortyFiveSixtyTwo(registerOf([
                { ...bareAsset, description: 'december machine', placedInServiceMonth: 12, costOrOtherBasisCents: 1000000n, convention: 'MQ' },
            ])))
            assertEq(lines.midQuarterConventionApplies, true)
            assertEq(lines.line19.c, 35700n)
            assertEq(lines.line22, 35700n)
        },
    },
    lines: {
        /**
         * A whole small register, every figure hand-computed from Publication
         * 946's printed tables:
         *
         * - $10,000 of 7-year office furniture, June 2025, half-year, 200 DB.
         *   Table A-1 year 1 is 14.29% → **$1,429.00** on line 19c.
         * - $30,000 of 5-year equipment, March 2023, half-year, 200 DB, which
         *   took a $30,000 100% bonus allowance in 2023. Its basis for
         *   depreciation is therefore **zero**, and its 2025 deduction is
         *   **$0.00** — the case that would silently deduct $5,760 if the
         *   claimed allowance were not read.
         * - $275,000 of residential rental property, March 2020, mid-month,
         *   straight line. 2025 is recovery year 6, and Table A-6 month 3
         *   gives 3.636% → **$9,999.00** on line 17.
         *
         * Line 22 is $1,429.00 + $0.00 + $9,999.00 = **$11,428.00**.
         */
        aWholeRegisterOnPrintedTableFigures: () => {
            const lines = expectLines(formFortyFiveSixtyTwo(registerOf([
                { ...bareAsset, description: 'office furniture', costOrOtherBasisCents: 1000000n },
                {
                    ...bareAsset, description: 'equipment', placedInServiceYear: 2023,
                    placedInServiceMonth: 3, costOrOtherBasisCents: 3000000n,
                    classification: 'fiveYear', section168kStatus: 'allowanceClaimed',
                    specialDepreciationAllowanceClaimedCents: 3000000n,
                },
                {
                    ...bareAsset, description: 'duplex', placedInServiceYear: 2020,
                    placedInServiceMonth: 3, costOrOtherBasisCents: 27500000n,
                    classification: 'residentialRental', method: 'SL', convention: 'MM',
                },
            ])))
            assertEq(lines.line19.c, 142900n, 'line 19c, 7-year property')
            assertEq(lines.line17, 999900n, 'line 17, the prior-year assets')
            assertEq(lines.line22, 1142800n, 'line 22')
            // The bonus-exhausted asset contributes nothing, and that is the
            // whole reason its claimed allowance is stored.
            assertEq(lines.line19.b, 0n, 'nothing 5-year was placed in service this year')
        },
        /**
         * Line 22 is the printed addition and nothing else: every summand's
         * own line is asserted alongside the total, so a summand dropped from
         * the addition shows up as a total that no longer equals its parts.
         */
        lineTwentyTwoIsThePrintedAddition: () => {
            const lines = expectLines(formFortyFiveSixtyTwo(registerOf([
                { ...bareAsset, description: 'furniture', costOrOtherBasisCents: 1000000n },
                { ...bareAsset, description: 'truckless machine', classification: 'threeYear', costOrOtherBasisCents: 900000n },
                { ...bareAsset, description: 'prior server', placedInServiceYear: 2022, classification: 'fiveYear', costOrOtherBasisCents: 500000n },
            ])))
            // 3-year, June 2025, half-year, 200 DB: Table A-1 year 1 is 33.33%
            // of $9,000.00 = $2,999.70.
            assertEq(lines.line19.a, 299970n)
            // 7-year year 1: 14.29% of $10,000.00 = $1,429.00.
            assertEq(lines.line19.c, 142900n)
            // 5-year placed in service 2022 is recovery year 4: Table A-1's
            // 11.52% of $5,000.00 = $576.00.
            assertEq(lines.line17, 57600n)
            assertEq(lines.line12 + lines.line14 + lines.line15 + lines.line16, 0n)
            assertEq(lines.line20 + lines.line21, 0n)
            assertEq(lines.line22, 299970n + 142900n + 57600n)
            assertEq(lines.line22, 500470n, 'hand-added: $2,999.70 + $1,429.00 + $576.00')
        },
    },
    alternativeMinimumTaxAdjustment: {
        /**
         * §56(a)(1)(A)(ii) on one asset: $10,000 of 5-year property that was
         * never §168(k) qualified property, June 2025, half-year. The regular
         * deduction is Table A-1's 20.00% = $2,000.00; the AMT deduction is
         * the 150 DB column's 15.00% = $1,500.00; the adjustment is
         * **$500.00**.
         */
        twoHundredDecliningBalancePropertyIsAdjusted: () => {
            const lines = expectLines(formFortyFiveSixtyTwo(registerOf([
                {
                    ...bareAsset, description: 'machine', classification: 'fiveYear',
                    costOrOtherBasisCents: 1000000n, section168kStatus: 'notQualifiedProperty',
                },
            ])))
            assertEq(lines.line19.b, 200000n)
            assertEq(lines.alternativeMinimumTaxAdjustmentCents, 50000n)
        },
        /**
         * i4562 p7's two cautions, one leaf each, on the SAME asset: electing
         * out of the allowance and claiming it both leave NO adjustment. The
         * regular deduction differs between the two (the claimed allowance
         * reduces the basis), which is what makes this a real pair rather than
         * two spellings of one case.
         */
        electingOutAndClaimingBothSwitchTheAdjustmentOff: () => {
            /** @type {DepreciableAsset} */
            const machine = {
                ...bareAsset, description: 'machine', classification: 'fiveYear',
                costOrOtherBasisCents: 1000000n,
            }
            const electedOut = expectLines(formFortyFiveSixtyTwo(registerOf([machine])))
            assertEq(electedOut.line19.b, 200000n, '20.00% of the whole $10,000.00')
            assertEq(electedOut.alternativeMinimumTaxAdjustmentCents, 0n)
            const claimed = expectLines(formFortyFiveSixtyTwo(registerOf([{
                ...machine, placedInServiceYear: 2024, section168kStatus: 'allowanceClaimed',
                specialDepreciationAllowanceClaimedCents: 600000n,
            }])))
            // $4,000.00 of basis left, recovery year 2: 32.00% = $1,280.00.
            assertEq(claimed.line17, 128000n)
            assertEq(claimed.alternativeMinimumTaxAdjustmentCents, 0n)
        },
        /**
         * The adjustment REVERSES and is NOT floored. The same $10,000 of
         * 5-year non-qualified property in its FIFTH recovery year: regular
         * 11.52% = $1,152.00, AMT 16.66% = $1,666.00, adjustment
         * **-$514.00**.
         *
         * Flooring it at zero would overstate alternative minimum taxable
         * income for every business past the halfway point of its equipment's
         * life, which is most of them.
         */
        theAdjustmentGoesNegativeAndIsNotFloored: () => {
            const lines = expectLines(formFortyFiveSixtyTwo(registerOf([
                {
                    ...bareAsset, description: 'machine', classification: 'fiveYear',
                    placedInServiceYear: 2021, costOrOtherBasisCents: 1000000n,
                    section168kStatus: 'notQualifiedProperty',
                },
            ])))
            assertEq(lines.line17, 115200n)
            assertEq(lines.alternativeMinimumTaxAdjustmentCents, -51400n)
        },
        /**
         * Straight-line property has no adjustment at all: §56(a)(1)(A)(ii)
         * replaces the 200% declining balance method and nothing else. A
         * building is the case that matters, because it is the largest single
         * deduction most registers carry.
         */
        straightLinePropertyIsNotAdjusted: () => {
            const lines = expectLines(formFortyFiveSixtyTwo(registerOf([
                {
                    ...bareAsset, description: 'duplex', placedInServiceYear: 2020,
                    placedInServiceMonth: 3, costOrOtherBasisCents: 27500000n,
                    classification: 'residentialRental', method: 'SL', convention: 'MM',
                    section168kStatus: 'notQualifiedProperty',
                },
            ])))
            assertEq(lines.line17, 999900n)
            assertEq(lines.alternativeMinimumTaxAdjustmentCents, 0n)
        },
    },
    refusals: {
        listedPropertyRefusesTheWholeForm: () => {
            const message = expectRefusal(formFortyFiveSixtyTwo(registerOf([
                { ...bareAsset, description: 'delivery van', costOrOtherBasisCents: 4000000n, listedProperty: true },
            ])))
            assert(message.includes('delivery van'), ['the refusal must name the asset', message])
            assert(message.includes('§280F'), ['the refusal must name the cap it cannot apply', message])
            assert(message.includes('Line 21'), ['the refusal must name where the amount would have gone', message])
        },
        sectionOneSeventyNineRefuses: () => {
            const message = expectRefusal(formFortyFiveSixtyTwo(registerOf([
                { ...bareAsset, description: 'lathe', costOrOtherBasisCents: 5000000n, section179ElectedCostCents: 5000000n },
            ])))
            assert(message.includes('$50000.00'), ['the refusal must quote the elected amount', message])
            assert(message.includes('line 11'), ['the refusal must name the limitation it cannot apply', message])
            assert(message.includes('line 13'), ['the refusal must name the carryover it cannot store', message])
        },
        // The CONTROL: a zero elected cost is not an election, and computes.
        aZeroElectedCostIsNotAnElection: () => {
            const lines = expectLines(formFortyFiveSixtyTwo(registerOf([
                { ...bareAsset, description: 'lathe', costOrOtherBasisCents: 5000000n },
            ])))
            assertEq(lines.line22, 714500n, '14.29% of $50,000.00')
        },
        theThreeCertificationsEachRefuseByName: () => {
            const carryover = expectRefusal(formFortyFiveSixtyTwo(
                { ...emptyRegister, priorYearSection179CarryoverIsZero: false }))
            assert(carryover.includes('line 10'), carryover)
            assert(carryover.includes('UNDERSTATE'), ['the refusal must name the direction', carryover])
            const disposal = expectRefusal(formFortyFiveSixtyTwo(
                { ...emptyRegister, noDepreciablePropertyDisposedOfDuringTheYear: false }))
            assert(disposal.includes('Form 4797'), disposal)
            const completeness = expectRefusal(formFortyFiveSixtyTwo({
                ...registerOf([{ ...bareAsset, costOrOtherBasisCents: 1000000n }]),
                everyDepreciableAssetIsListed: false,
            }))
            assert(completeness.includes('40%'), completeness)
        },
        /**
         * The completeness certification is required only when something was
         * placed in service THIS year — the mid-quarter test's own scope. A
         * register of prior-year assets computes without it, which is the
         * control that keeps the gate from being "refuse everything".
         */
        completenessIsNotRequiredForAPriorYearOnlyRegister: () => {
            const lines = expectLines(formFortyFiveSixtyTwo({
                ...registerOf([{
                    ...bareAsset, description: 'prior server', placedInServiceYear: 2022,
                    classification: 'fiveYear', costOrOtherBasisCents: 500000n,
                }]),
                everyDepreciableAssetIsListed: false,
            }))
            assertEq(lines.line17, 57600n)
        },
        aCurrentYearSpecialDepreciationAllowanceRefuses: () => {
            const message = expectRefusal(formFortyFiveSixtyTwo(registerOf([{
                ...bareAsset, description: 'machine', costOrOtherBasisCents: 1000000n,
                section168kStatus: 'allowanceClaimed',
                specialDepreciationAllowanceClaimedCents: 1000000n,
            }])))
            assert(message.includes('ACQUISITION date'), ['the refusal must name what it cannot see', message])
            assert(message.includes('electedOut'), ['the refusal must name what would compute', message])
        },
        // The CONTROL: the SAME allowance on a PRIOR-year asset computes,
        // because there it is a transcribed historical figure that only
        // reduces basis. The pair is what makes the asymmetry a decision
        // rather than an accident.
        aPriorYearSpecialDepreciationAllowanceComputes: () => {
            const lines = expectLines(formFortyFiveSixtyTwo(registerOf([{
                ...bareAsset, description: 'machine', placedInServiceYear: 2024,
                costOrOtherBasisCents: 1000000n, section168kStatus: 'allowanceClaimed',
                specialDepreciationAllowanceClaimedCents: 1000000n,
            }])))
            assertEq(lines.line17, 0n, 'a fully bonused asset has no basis left to depreciate')
            assertEq(lines.line22, 0n)
        },
        preNineteenNinetyNineTwoHundredDecliningBalanceRefuses: () => {
            const message = expectRefusal(formFortyFiveSixtyTwo({
                ...registerOf([{
                    ...bareAsset, description: 'old press', placedInServiceYear: 1997,
                    classification: 'twentyYear', method: '150DB', costOrOtherBasisCents: 10000000n,
                }, {
                    ...bareAsset, description: 'older press', placedInServiceYear: 1998,
                    classification: 'twentyYear', method: '150DB', costOrOtherBasisCents: 10000000n,
                }, {
                    ...bareAsset, description: 'ancient lathe', placedInServiceYear: 1998,
                    classification: 'tenYear', method: '200DB', costOrOtherBasisCents: 10000000n,
                }]),
                taxYear: 2005,
            }))
            // The 10-year 200 DB asset from 1998 is in recovery year 8 in 2005
            // and still has a deduction, so it refuses. The two 150 DB presses
            // do not: §56(a)(1)(A)(ii) replaces the 200% method only.
            assert(message.includes('ancient lathe'), ['the refusal must name the asset', message])
            assert(message.includes('ADS CLASS LIFE'), ['the refusal must name what it cannot look up', message])
        },
        /**
         * The CONTROL, and it is the case that matters: the same 1998 asset in
         * 2025 is long past the end of its recovery period, has nothing left
         * to deduct, and therefore does NOT refuse a return it cannot affect.
         * Without this leaf the check above would be indistinguishable from
         * "refuse every old asset".
         */
        anExhaustedPre1999AssetDoesNotRefuse: () => {
            const lines = expectLines(formFortyFiveSixtyTwo(registerOf([{
                ...bareAsset, description: 'ancient lathe', placedInServiceYear: 1998,
                classification: 'tenYear', method: '200DB', costOrOtherBasisCents: 10000000n,
            }])))
            assertEq(lines.line17, 0n)
            assertEq(lines.line22, 0n)
        },
    },
}
