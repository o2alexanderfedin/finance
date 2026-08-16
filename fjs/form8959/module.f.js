/**
 * Form 8959 (TY2025) — TAX-20: Additional Medicare Tax, all five printed
 * parts, every printed line named and computed.
 *
 * Source: the printed `f8959.pdf` line captions, transcribed as line numbers
 * and captions in the comments below. IRC §3101(b)(2) is the statute; its
 * thresholds and both of its rates live in `fjs/tax/params`, never as
 * literals here.
 *
 * The 0.9% applies to Medicare wages (Form W-2 box 5) **in excess of** a
 * per-status threshold that is statutory and NOT inflation-indexed. Box 5 is
 * the right box because it is UNCAPPED — box 3 stops at the Social Security
 * wage base, box 1 is net of pre-tax deferrals, and neither is what
 * §3101(b)(2) taxes.
 *
 * ## What this module is, and what it is not
 *
 * Pure arithmetic over `bigint` cents, keyed by the printed line numbers —
 * the same shape and boundary `fjs/tax/ssb`, `fjs/tax/line16/qdcgt` and
 * `fjs/schedule/1a` already have. It reads NO stored document: its caller
 * (`fjs/schedule/2`) hands it a box-5 total and a box-6 total that
 * `fjs/form1040/core` summed across every W-2, so DOC-11's absent-is-absent
 * rule is applied once, where the documents are, rather than a second time
 * here. It also does not build {@link ReportLine}s — provenance is
 * `fjs/schedule/2`'s job, for the same reason `fjs/schedule/1a`'s Part V
 * returns bare `bigint`s.
 *
 * ## The threshold is ONE figure read three times
 *
 * Lines 5, 9 and 15 are the same per-status amount on the printed page —
 * §3101(b)(2) states one threshold and applies it to wages, to
 * self-employment income and to RRTA compensation in turn. It is looked up
 * once here ({@link additionalMedicareTaxThresholdCents}) and read by all
 * three parts, so the three printed lines cannot drift apart.
 *
 * ## Parts II and III are structurally zero, and are modelled rather than
 * omitted
 *
 * The tax reaches three separate bases, each with its own part of the form
 * and a SHARED threshold. This engine has neither of the other two, and the
 * reasons differ:
 *
 * - **Part II (self-employment income, lines 8-13.) NO LONGER ZERO as of
 *   Phase 28 (TAX-31).** Line 8 reads Schedule SE Part I line 6, and
 *   `fjs/schedule/se` now computes it: `fjs/schedule/2` hands this module the
 *   figure off the SAME Schedule SE execution that produced Schedule 2 line 4
 *   and Schedule 1 line 15. The paragraph that stood here said "two
 *   independent things keep it zero today", and Phase 28 removed both — Form
 *   1099-NEC and Schedule C arrived in Phase 27, and `selfEmploymentTax` is a
 *   MODELED kind now.
 * - **Part III (RRTA compensation, lines 14-17.)** Railroad Retirement Tax
 *   Act compensation is reported in Form W-2 **box 14**, and
 *   `fjs/document/w2`'s schema has no box-14 field — a stored W-2 cannot
 *   carry it, so this part is not merely unmodelled but unreachable. It is
 *   written out as documented zeros carrying its own line numbers rather than
 *   dropped, because a form whose lines silently disappear is exactly
 *   TAX-16's failure mode one layer down: a reader comparing this output
 *   against the printed page must be able to find every line.
 *
 * **Part II's line 11 was computed for real BEFORE line 8 had anything to
 * subtract it from, and that is the whole reason this phase needed no
 * rethinking here.** Line 11 subtracts the wages already counted in Part I
 * (line 10, which restates line 4) from the threshold, so the threshold is
 * consumed by wages FIRST and self-employment income is taxed only on what is
 * left of it. Phase 23 wrote that coordination with a proof that watched it
 * bite ({@link proof.partII.theThresholdIsConsumedByWagesBeforeSelfEmploymentIncome})
 * precisely so this phase would not have to discover it; a Part II written
 * now against a full threshold would have double-counted $200,000 of
 * head-room for anyone with both wages and a Schedule C. **Phase 28's whole
 * change to this file is one input field and line 8 reading it.**
 *
 * Note what line 11 does NOT coordinate: §3101(b)(2)'s threshold is a
 * DIFFERENT ceiling from §1402(b)(1)'s Social Security wage base, shared by a
 * different rule. Schedule SE lines 7-9 share the wage base between W-2 box 3
 * and self-employment earnings; Form 8959 lines 9-11 share this threshold
 * between W-2 box 5 and self-employment income. Two ceilings, two boxes, two
 * orders of consumption that happen to agree on "wages first" — and
 * `fjs/schedule/se`'s own docstring is where the other one is argued.
 *
 * ## Part V, and how the printed form splits one box 6 in two
 *
 * Box 6 (Medicare tax withheld) carries BOTH taxes at once. An employer must
 * withhold the extra 0.9% on every dollar it pays an employee above
 * **$200,000 — per employer, and regardless of the employee's filing
 * status** (IRC §3102(f)(1)); it has no way to know about a second job or a
 * spouse's wages. That withheld Additional Medicare Tax is added into the
 * same box 6 as the ordinary 1.45%, and nothing on the W-2 separates them.
 *
 * **The form does not ask the taxpayer to know the split. It derives it, by
 * subtraction.** Line 20 restates line 1 (the box-5 total), line 21
 * multiplies that by the ORDINARY 1.45% rate, and line 22 subtracts line 21
 * from line 19 (the box-6 total), flooring at zero. What is left is, by
 * construction, the Additional Medicare Tax the employers withheld — the two
 * rates are different, so one subtraction recovers the split from two
 * figures the W-2 already prints. No dialect field, no election and no
 * taxpayer assertion is required, and this module invents nothing.
 *
 * Two consequences of following the form rather than an invented split, both
 * worth stating because they are visible in real returns:
 *
 * - **The floor at zero is load-bearing.** Employers round Medicare tax per
 *   pay period, so box 6 can land a few cents either side of exactly 1.45%
 *   of box 5. Below it, `line19 - line21` is NEGATIVE, and an unfloored line
 *   22 would put a negative payment on 1040 line 25c. The printed form says
 *   "If zero or less, enter -0-"; {@link proof.partV.roundingBelowTheOrdinaryRateFloorsAtZero}
 *   is what watches it.
 * - **A few cents ABOVE 1.45% become a few cents of credit**, because the
 *   form cannot tell rounding noise from a genuine withholding. That is what
 *   the printed page computes, and departing from it would be this module
 *   inventing the split it exists not to invent.
 *
 * ## A mutation finding worth keeping: Part V's floor is the widest-reach
 * line on this form
 *
 * Deleting the `line19 > line21 ? ... : 0n` guard on line 22 — the single
 * token that makes the floor a floor — was predicted to redden the two Part V
 * leaves written for it. It reddened **seventeen project proof leaves across
 * four modules**, including every Part I, II and III leaf on this form and
 * Phase 22's own `controlTheSameReturnBelowTheThresholdComputesSilently`.
 *
 * The reason is a property of this code nobody had written down. **No W-2
 * fixture in this repository carries box 6 except the ones Phase 23 added**,
 * while several carry box 5 — so for most fixtures line 19 is `0` and line 21
 * is a real 1.45% of a real wage, and an unfloored line 22 is a large
 * NEGATIVE number. {@link form8959}'s `assert(partV.line24 >= 0n)` then throws
 * before any leaf can read a figure, which is why leaves that never look at
 * Part V go red too. `theFaangReturnComputesInsteadOfRefusing` was the leaf
 * that stayed GREEN, and correctly: its box 6 of $5,250.00 genuinely exceeds
 * 1.45% of $300,000, so the floor never fires for it.
 *
 * Two things follow. The floor is not defensive — without it, a routine
 * return would carry a negative payment to 1040 line 25c — and the
 * module-level invariant assert is what turns a wrong number into a loud
 * failure rather than a quiet one.
 *
 * The reconciliation is why a high-wage return usually owes far less than
 * line 18 suggests: a single filer with one $300,000 employer owes $900 on
 * line 18 and has already had exactly $900 withheld, so the two cancel. It
 * is a joint filer whose two employers each stayed under $200,000 who
 * actually writes a cheque — {@link proof.wholeForm} prices both.
 *
 * @module
 */
import { assert, assertEq } from 'functionalscript/fjs/asserts/module.f.js'
import { of, multiply, halfUp } from '../types/rational/module.f.js'
import { centsFromString } from '../exact/module.f.js'
import { taxParamsByYear } from '../tax/params/module.f.js'

/** @import { TaxParamSet, IndividualFilingStatus } from '../tax/params/module.f.js' */

/**
 * Rounds `cents * (basisPoints / 10000)` to the nearest cent, ties away from
 * zero (the IRS half-up convention) — every rate multiplication on this form.
 *
 * Basis points rather than percent because neither of this form's two rates
 * is a whole number of percent; `fjs/tax/params`'
 * {@link additionalMedicareTaxRates} records why the parameter is stored that
 * way. `fjs/schedule/1a`'s own `percentOfCents` is the same idiom one
 * denominator over, reimplemented here rather than imported for the reason
 * that module states in turn: it is private there, and this project
 * reimplements an idiom it cannot import.
 * @type {(cents: bigint) => (basisPoints: number) => bigint}
 */
const basisPointsOfCents = cents => basisPoints =>
    halfUp(multiply(of(cents)(1n))(of(BigInt(basisPoints))(10000n)))

/**
 * §3101(b)(2)'s single per-status threshold, in cents — the ONE figure lines
 * 5, 9 and 15 each restate. Read from `fjs/tax/params`, never written here.
 * @type {(taxParamSet: TaxParamSet) => (status: IndividualFilingStatus) => bigint}
 */
export const additionalMedicareTaxThresholdCents = taxParamSet => status =>
    centsFromString(taxParamSet.additionalMedicareTaxThreshold[status].amount)

// ── Part I: Additional Medicare Tax on Medicare Wages (lines 1-7) ────────────

/**
 * @typedef {{
 *   readonly line1: bigint, readonly line2: bigint, readonly line3: bigint,
 *   readonly line4: bigint, readonly line5: bigint, readonly line6: bigint,
 *   readonly line7: bigint,
 * }} Form8959PartI
 */

/**
 * Form 8959 Part I, lines 1-7 — the wages arm, and the only one this engine
 * can reach a non-zero figure on.
 * @type {(taxParamSet: TaxParamSet) => (input: { readonly status: IndividualFilingStatus, readonly medicareWagesCents: bigint }) => Form8959PartI}
 */
export const form8959PartI = taxParamSet => input => {
    const { status, medicareWagesCents } = input
    // 1. "Medicare wages and tips from Form W-2, box 5. If you have more than
    //    one Form W-2, enter the total of the amounts from box 5." Summed
    //    across every W-2 by the caller.
    const line1 = medicareWagesCents
    // 2. "Unreported tips from Form 4137, line 6." Always zero here:
    //    `unreportedTips` is a REFUSED kind, and Phase 22's own W-2 box-8
    //    tripwire refuses an UNDECLARED return whose W-2 carries allocated
    //    tips -- so both the declared and the undeclared path refuse before
    //    this form is ever computed.
    const line2 = 0n
    // 3. "Wages from Form 8919, line 6." Always zero here: `form8919Wages`
    //    is a REFUSED kind, and no dialect models Form 8919.
    const line3 = 0n
    // 4. "Add lines 1 through 3." Part II line 10 restates this total.
    const line4 = line1 + line2 + line3
    // 5. "Enter the following amount for your filing status" -- §3101(b)(2)'s
    //    threshold; the SAME figure lines 9 and 15 read.
    const line5 = additionalMedicareTaxThresholdCents(taxParamSet)(status)
    // 6. "Subtract line 5 from line 4. If zero or less, enter -0-." The
    //    statute taxes wages "in excess of" the threshold, so exactly AT it
    //    is not in excess of it -- a STRICT comparison, priced at one cent by
    //    `proof.partI.boundaryTrio`.
    const line6 = line4 > line5 ? line4 - line5 : 0n
    // 7. "Additional Medicare Tax on Medicare wages. Multiply line 6 by 0.9%
    //    (0.009)."
    const line7 = basisPointsOfCents(line6)(taxParamSet.additionalMedicareTaxRates.additionalRateBasisPoints)
    return { line1, line2, line3, line4, line5, line6, line7 }
}

// ── Part II: Additional Medicare Tax on Self-Employment Income (8-13) ────────

/**
 * @typedef {{
 *   readonly line8: bigint, readonly line9: bigint, readonly line10: bigint,
 *   readonly line11: bigint, readonly line12: bigint, readonly line13: bigint,
 * }} Form8959PartII
 */

/**
 * Form 8959 Part II, lines 8-13 — the self-employment arm, real as of Phase
 * 28. Line 8 is Schedule SE Part I line 6, handed in by `fjs/schedule/2` off
 * the one Schedule SE execution; line 11 is where the threshold's head-room
 * is consumed by wages before any of it shelters self-employment income.
 * @type {(taxParamSet: TaxParamSet) => (input: { readonly status: IndividualFilingStatus, readonly partILine4: bigint, readonly selfEmploymentIncomeCents: bigint }) => Form8959PartII}
 */
export const form8959PartII = taxParamSet => input => {
    const { status, partILine4, selfEmploymentIncomeCents } = input
    // 8. "Self-employment income from Schedule SE, Part I, line 6. If zero or
    //    less, enter -0-." Schedule SE line 6 is net earnings from
    //    self-employment AFTER §1402(a)(12)'s 92.35% factor, so this line is
    //    already reduced -- `fjs/schedule/se` owns that arithmetic and this
    //    module never re-applies it. The printed floor is applied here rather
    //    than assumed of the caller.
    const line8 = selfEmploymentIncomeCents > 0n ? selfEmploymentIncomeCents : 0n
    // 9. The SAME per-status threshold as line 5.
    const line9 = additionalMedicareTaxThresholdCents(taxParamSet)(status)
    // 10. "Enter the amount from line 4" -- the wages already counted.
    const line10 = partILine4
    // 11. "Subtract line 10 from line 9. If zero or less, enter -0-." This is
    //     the coordination: wages consume the threshold FIRST, and only what
    //     is left of it shelters self-employment income.
    const line11 = line9 > line10 ? line9 - line10 : 0n
    // 12. "Subtract line 11 from line 8. If zero or less, enter -0-."
    const line12 = line8 > line11 ? line8 - line11 : 0n
    // 13. "Additional Medicare Tax on self-employment income. Multiply line
    //     12 by 0.9% (0.009)."
    const line13 = basisPointsOfCents(line12)(taxParamSet.additionalMedicareTaxRates.additionalRateBasisPoints)
    return { line8, line9, line10, line11, line12, line13 }
}

// ── Part III: Additional Medicare Tax on RRTA Compensation (14-17) ───────────

/**
 * @typedef {{
 *   readonly line14: bigint, readonly line15: bigint,
 *   readonly line16: bigint, readonly line17: bigint,
 * }} Form8959PartIII
 */

/**
 * Form 8959 Part III, lines 14-17 — the railroad-retirement arm. Structurally
 * UNREACHABLE rather than merely unmodelled: line 14 reads Form W-2 box 14,
 * and `fjs/document/w2`'s schema has no box-14 field, so no stored W-2 can
 * carry the amount this part would tax.
 * @type {(taxParamSet: TaxParamSet) => (input: { readonly status: IndividualFilingStatus }) => Form8959PartIII}
 */
export const form8959PartIII = taxParamSet => input => {
    const { status } = input
    // 14. "Railroad retirement (RRTA) compensation and tips from Form(s) W-2,
    //     box 14." See this function's own docstring: unreachable, not
    //     merely unmodelled.
    const line14 = 0n
    // 15. The SAME per-status threshold as lines 5 and 9.
    const line15 = additionalMedicareTaxThresholdCents(taxParamSet)(status)
    // 16. "Subtract line 15 from line 14. If zero or less, enter -0-."
    const line16 = line14 > line15 ? line14 - line15 : 0n
    // 17. "Additional Medicare Tax on railroad retirement (RRTA)
    //     compensation. Multiply line 16 by 0.9% (0.009)."
    const line17 = basisPointsOfCents(line16)(taxParamSet.additionalMedicareTaxRates.additionalRateBasisPoints)
    return { line14, line15, line16, line17 }
}

// ── Part V: Withholding Reconciliation (19-24) ───────────────────────────────

/**
 * @typedef {{
 *   readonly line19: bigint, readonly line20: bigint, readonly line21: bigint,
 *   readonly line22: bigint, readonly line23: bigint, readonly line24: bigint,
 * }} Form8959PartV
 */

/**
 * Form 8959 Part V, lines 19-24 — the withholding reconciliation. See this
 * module's own docstring for how the printed form separates the two taxes
 * inside one Form W-2 box 6, and why that subtraction is the whole mechanism.
 * @type {(taxParamSet: TaxParamSet) => (input: { readonly medicareTaxWithheldCents: bigint, readonly partILine1: bigint }) => Form8959PartV}
 */
export const form8959PartV = taxParamSet => input => {
    const { medicareTaxWithheldCents, partILine1 } = input
    // 19. "Medicare tax withheld from Form W-2, box 6. If you have more than
    //     one Form W-2, enter the total of the amounts from box 6." This
    //     carries BOTH taxes; lines 20-22 are what separate them.
    const line19 = medicareTaxWithheldCents
    // 20. "Enter the amount from line 1" -- the box-5 total.
    const line20 = partILine1
    // 21. "Multiply line 20 by 1.45% (0.0145). This is your regular Medicare
    //     tax withholding on Medicare wages." The ORDINARY rate,
    //     §3101(b)(1) -- a different parameter from the 0.9% above, and the
    //     difference between the two rates is what makes one subtraction
    //     sufficient.
    const line21 = basisPointsOfCents(line20)(taxParamSet.additionalMedicareTaxRates.regularMedicareRateBasisPoints)
    // 22. "Subtract line 21 from line 19. If zero or less, enter -0-. This is
    //     your Additional Medicare Tax withholding on Medicare wages." The
    //     floor is load-bearing against per-pay-period rounding; see this
    //     module's own docstring.
    const line22 = line19 > line21 ? line19 - line21 : 0n
    // 23. "Additional Medicare Tax withholding on railroad retirement (RRTA)
    //     compensation from Form W-2, box 14." Zero for the same structural
    //     reason Part III is: no box-14 field exists to read.
    const line23 = 0n
    // 24. "Total Additional Medicare Tax withholding. Add lines 22 and 23."
    //     -> included with federal income tax withholding on 1040 line 25c.
    const line24 = line22 + line23
    return { line19, line20, line21, line22, line23, line24 }
}

// ── The whole form ──────────────────────────────────────────────────────────

/**
 * `selfEmploymentIncomeCents` is Schedule SE Part I line 6 — net earnings
 * from self-employment, already reduced by §1402(a)(12)'s 92.35% factor. It
 * arrives as an argument rather than being recomputed here for the reason
 * every other figure on this form does: `fjs/schedule/2` runs Schedule SE
 * exactly once, and the tax on line 13 must be charged against the same net
 * earnings Schedule 2 line 4's tax was.
 * @typedef {{
 *   readonly status: IndividualFilingStatus,
 *   readonly medicareWagesCents: bigint,
 *   readonly medicareTaxWithheldCents: bigint,
 *   readonly selfEmploymentIncomeCents: bigint,
 * }} Form8959Input
 */

/**
 * Every printed line of Form 8959, flat, keyed by its own number — Parts I,
 * II, III, IV (line 18) and V together.
 *
 * Flat rather than nested by part, mirroring `fjs/tax/ssb`'s own 18-line
 * record and for the same reason: the printed page numbers its lines
 * continuously, and a caller reading "line 18" should not first have to know
 * which part it lives in.
 * @typedef {Form8959PartI & Form8959PartII & Form8959PartIII & { readonly line18: bigint } & Form8959PartV} Form8959
 */

/**
 * Computes Form 8959 for one return.
 *
 * Line 18 (Part IV) is the total that reaches **Schedule 2 line 11 -> 1040
 * line 23**; line 24 (Part V) is the withholding that reaches **1040 line
 * 25c**. Both come out of ONE execution, so the tax and the credit for it can
 * never be computed against different inputs.
 * @type {(taxParamSet: TaxParamSet) => (input: Form8959Input) => Form8959}
 */
export const form8959 = taxParamSet => input => {
    const { status, medicareWagesCents, medicareTaxWithheldCents, selfEmploymentIncomeCents } = input
    const partI = form8959PartI(taxParamSet)({ status, medicareWagesCents })
    const partII = form8959PartII(taxParamSet)({
        status, partILine4: partI.line4, selfEmploymentIncomeCents,
    })
    const partIII = form8959PartIII(taxParamSet)({ status })
    // 18. "Add lines 7, 13, and 17." -- Part IV, the whole form's total, and
    //     the only line Schedule 2 reads.
    const line18 = partI.line7 + partII.line13 + partIII.line17
    const partV = form8959PartV(taxParamSet)({ medicareTaxWithheldCents, partILine1: partI.line1 })
    assert(line18 >= 0n, ['Form 8959 line 18 must never be negative', line18])
    assert(partV.line24 >= 0n, ['Form 8959 line 24 must never be negative', partV.line24])
    return { ...partI, ...partII, ...partIII, line18, ...partV }
}

// ── Tests ────────────────────────────────────────────────────────────────────

/**
 * TY2025's parameter set, narrowed exactly once at module scope — the same
 * `assert` path `fjs/schedule/1a` and `fjs/return/tripwire` use.
 */
const taxParams2025 = taxParamsByYear[2025]
assert(taxParams2025 !== undefined, 'expected TY2025 parameters to be present in taxParamsByYear')

/**
 * Runs the whole form against TY2025's real parameter set, for a return with
 * NO self-employment income — the shape every leaf written before Phase 28
 * exercises, kept three-argument so those leaves still say what they said.
 * @type {(status: IndividualFilingStatus) => (medicareWagesCents: bigint) => (medicareTaxWithheldCents: bigint) => Form8959}
 */
const run = status => medicareWagesCents => medicareTaxWithheldCents =>
    form8959(taxParams2025)({
        status, medicareWagesCents, medicareTaxWithheldCents, selfEmploymentIncomeCents: 0n,
    })

/**
 * The same, with Schedule SE Part I line 6 supplied — Phase 28's own
 * fixtures. A SEPARATE helper rather than a fourth curried argument on
 * {@link run}, so that every pre-existing leaf keeps reading as the
 * wages-only return it was written for and the new ones are visibly the
 * self-employment ones.
 * @type {(status: IndividualFilingStatus) => (medicareWagesCents: bigint) => (selfEmploymentIncomeCents: bigint) => Form8959}
 */
const runWithSelfEmployment = status => medicareWagesCents => selfEmploymentIncomeCents =>
    form8959(taxParams2025)({
        status, medicareWagesCents, medicareTaxWithheldCents: 0n, selfEmploymentIncomeCents,
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
 * The hand-typed §3101(b)(2) threshold, in CENTS, per status — written out
 * here rather than read from `fjs/tax/params`, so a boundary proof whose
 * boundary came from the code under test cannot exist. `fjs/tax/params` pins
 * the same five figures against the statute independently, and
 * `fjs/return/tripwire` states them a third time as decimal strings; all
 * three must agree.
 *
 * The qualifying-surviving-spouse row is $200,000 — NOT married-filing-
 * jointly's $250,000, because §3101(b)(2)(A) reaches only a JOINT return.
 * Form 8960's own threshold, one module over, says the opposite for the same
 * status.
 * @type {Record<IndividualFilingStatus, bigint>}
 */
const thresholdCents = {
    single: 20000000n,
    marriedFilingJointly: 25000000n,
    marriedFilingSeparately: 12500000n,
    headOfHousehold: 20000000n,
    qualifyingSurvivingSpouse: 20000000n,
}

export const proof = {
    partI: {
        // THE PHASE'S MOTIVATING RETURN. A single filer with $300,000 in box
        // 5:  $300,000.00 - $200,000.00 = $100,000.00 of excess wages, and
        // 0.9% of $100,000.00 = $900.00. Every figure hand-computed here.
        threeHundredThousandSingle: () => {
            const result = run('single')(30000000n)(0n)
            assertEq(result.line1, 30000000n, 'line 1 = $300,000.00, the box 5 total')
            assertEq(result.line4, 30000000n, 'line 4 = $300,000.00 (lines 2 and 3 are zero)')
            assertEq(result.line5, 20000000n, 'line 5 = $200,000.00, single\'s §3101(b)(2)(C) threshold')
            assertEq(result.line6, 10000000n, 'line 6 = $100,000.00 = $300,000.00 - $200,000.00')
            // 0.9% of 10,000,000 cents = 10,000,000 * 90 / 10,000 = 90,000 cents.
            assertEq(result.line7, 90000n, 'line 7 = $900.00 = 0.9% of $100,000.00')
        },
        // Lines 2 and 3 are documented zeros, and the total on line 4 is what
        // makes their absence observable: were line 4 to read line 1 alone,
        // a future Form 4137 or Form 8919 amount would silently never reach
        // the tax.
        linesTwoAndThreeAreZeroAndLineFourStillAddsAllThree: () => {
            const result = run('single')(30000000n)(0n)
            assertEq(result.line2, 0n, 'line 2 = $0.00 (Form 4137 -- `unreportedTips` refuses)')
            assertEq(result.line3, 0n, 'line 3 = $0.00 (Form 8919 -- `form8919Wages` refuses)')
            assertEq(result.line4, result.line1 + result.line2 + result.line3, 'line 4 adds all three')
        },
        // THE BOUNDARY TRIO. The statute taxes wages "in excess of" the
        // threshold, so exactly AT it is not in excess of it. One cent above,
        // line 6 moves to $0.01 -- but 0.9% of one cent is 0.009 cents, far
        // below the half-cent rounding threshold, so line 7 is still $0.00.
        // 56 cents of excess is the first amount whose tax rounds to a cent
        // (0.9% of 56 cents = 0.504 cents, which half-up rounds to 1), so the
        // third probe is what proves the RATE bites rather than only the
        // conditional. This is `fjs/schedule/1a`'s own boundary-trio shape.
        boundaryTrio: () => {
            const at = run('single')(20000000n)(0n)
            assertEq(at.line6, 0n, 'exactly at $200,000.00: line 6 = $0.00, not "in excess of"')
            assertEq(at.line7, 0n, 'exactly at the threshold: no tax')

            const oneCentAbove = run('single')(20000001n)(0n)
            assertEq(oneCentAbove.line6, 1n, 'one cent above: line 6 = $0.01, the strict `>` fires')
            assertEq(oneCentAbove.line7, 0n, '0.9% of one cent is 0.009 cents, which rounds to $0.00')

            const fiftySixCentsAbove = run('single')(20000056n)(0n)
            assertEq(fiftySixCentsAbove.line6, 56n, 'line 6 = $0.56')
            assertEq(
                fiftySixCentsAbove.line7, 1n,
                'line 7 = $0.01 -- 0.9% of 56 cents is 0.504 cents, the first excess whose tax rounds up to a cent',
            )
        },
        // Below the threshold is $0.00 for every status, and this is the
        // REGRESSION CONTROL the whole phase rests on: every return this
        // engine could already compute is below every one of these five
        // figures, so wiring this form must not move a single existing
        // figure. One dollar below each hand-typed threshold.
        oneDollarBelowEveryStatusThresholdIsZero: () => {
            for (const status of everyStatus) {
                const result = run(status)(thresholdCents[status] - 100n)(0n)
                assertEq(result.line6, 0n, ['one dollar below the threshold: no excess', status])
                assertEq(result.line7, 0n, ['one dollar below the threshold: no tax', status])
                assertEq(result.line18, 0n, ['one dollar below the threshold: nothing reaches Schedule 2', status])
            }
        },
        // The per-status threshold really is per status, against hand-typed
        // cents. Same wages, five statuses, five different line 6s -- so a
        // lookup that read one status's figure for another cannot pass.
        // $260,000.00 is above three thresholds and below MFJ's, which is
        // what makes the row values differ rather than merely exist.
        everyStatusReadsItsOwnThreshold: () => {
            for (const status of everyStatus) {
                const result = run(status)(26000000n)(0n)
                assertEq(
                    result.line5,
                    thresholdCents[status],
                    ['line 5 must be this status\'s own §3101(b)(2) threshold', status, result.line5],
                )
                assertEq(
                    result.line6,
                    26000000n > thresholdCents[status] ? 26000000n - thresholdCents[status] : 0n,
                    ['line 6 must be the excess over this status\'s own threshold', status],
                )
            }
            // …and the joint filer really is the odd one out at $260,000:
            // $10,000 of excess against $60,000 for single. Hand-typed.
            assertEq(run('marriedFilingJointly')(26000000n)(0n).line6, 1000000n, 'MFJ: $10,000.00 of excess')
            assertEq(run('single')(26000000n)(0n).line6, 6000000n, 'single: $60,000.00 of excess')
        },
        // THE §3101 STATUS TRAP, stated against Form 8960's opposite answer:
        // a qualifying surviving spouse gets $200,000 here, so $220,000 of
        // wages is $20,000 in excess -- $180.00 of tax -- while a joint filer
        // at the identical wages owes nothing. If this form ever read the
        // joint threshold for a QSS filer, this leaf is what says so.
        aQualifyingSurvivingSpouseDoesNotGetTheJointThreshold: () => {
            const qss = run('qualifyingSurvivingSpouse')(22000000n)(0n)
            const mfj = run('marriedFilingJointly')(22000000n)(0n)
            assertEq(qss.line5, 20000000n, 'QSS threshold = $200,000.00 (§3101(b)(2)(C), "any other case")')
            assertEq(qss.line6, 2000000n, 'QSS: $20,000.00 of excess')
            // 0.9% of 2,000,000 cents = 18,000 cents.
            assertEq(qss.line7, 18000n, 'QSS: $180.00 of Additional Medicare Tax')
            assertEq(mfj.line5, 25000000n, 'MFJ threshold = $250,000.00 (§3101(b)(2)(A), "a joint return")')
            assertEq(mfj.line6, 0n, 'MFJ: $220,000.00 is below $250,000.00')
            assertEq(mfj.line7, 0n, 'MFJ: no tax at the same wages')
        },
    },
    partII: {
        // Line 8 is zero, so line 13 is zero -- but line 11 is NOT
        // decorative. At $150,000 of wages a single filer still has $50,000
        // of threshold head-room left for self-employment income; at
        // $300,000 there is none. Both hand-computed. THIS is the leaf that
        // makes Phase 28's Schedule SE land on a threshold that has already
        // been consumed by wages rather than a fresh one.
        theThresholdIsConsumedByWagesBeforeSelfEmploymentIncome: () => {
            const under = run('single')(15000000n)(0n)
            assertEq(under.line9, 20000000n, 'line 9 = $200,000.00, the same threshold as line 5')
            assertEq(under.line10, 15000000n, 'line 10 = $150,000.00, restating line 4')
            assertEq(under.line11, 5000000n, 'line 11 = $50,000.00 of unused threshold = $200,000 - $150,000')

            const over = run('single')(30000000n)(0n)
            assertEq(over.line11, 0n, 'line 11 = $0.00 -- $300,000 of wages consumed the whole threshold')
        },
        // A return with NO self-employment income is still zero on this arm,
        // at every level of wages — the regression control for Phase 28's
        // change, and the property that says wiring line 8 moved nothing for
        // the returns this engine could already compute. This leaf said
        // "Schedule SE is Phase 28" until Phase 28; the assertion is
        // unchanged and only its reason is.
        noSelfEmploymentIncomeIsStillZeroOnThisArm: () => {
            for (const wages of [0n, 15000000n, 30000000n]) {
                const result = run('single')(wages)(0n)
                assertEq(result.line8, 0n, ['line 8 = $0.00 (no Schedule SE income)', wages])
                assertEq(result.line12, 0n, ['line 12 = $0.00', wages])
                assertEq(result.line13, 0n, ['line 13 = $0.00', wages])
            }
        },
        // PHASE 28's OWN FIGURE. A single filer with NO wages and $250,000.00
        // of Schedule SE line 6 net earnings: the whole $200,000 threshold is
        // available (line 10 is zero, so line 11 is the full threshold), and
        // 0.9% of the $50,000 excess is $450.00. Hand-computed.
        selfEmploymentIncomeAloneIsTaxedAgainstTheWholeThreshold: () => {
            const result = runWithSelfEmployment('single')(0n)(25000000n)
            assertEq(result.line8, 25000000n, 'line 8 = $250,000.00, Schedule SE Part I line 6')
            assertEq(result.line10, 0n, 'line 10 = $0.00, no wages counted in Part I')
            assertEq(result.line11, 20000000n, 'line 11 = $200,000.00 of threshold, untouched')
            assertEq(result.line12, 5000000n, 'line 12 = $50,000.00 = $250,000.00 - $200,000.00')
            // 0.9% of 5,000,000 cents = 5,000,000 * 90 / 10,000 = 45,000.
            assertEq(result.line13, 45000n, 'line 13 = $450.00')
            assertEq(result.line7, 0n, 'line 7 = $0.00 -- no wages, so Part I charges nothing')
            assertEq(result.line18, 45000n, 'line 18 = $450.00 -> Schedule 2 line 11')
        },
        // THE COORDINATION, now that both sides of it carry real figures, and
        // priced against the answer a fresh threshold would give. Wages
        // $150,000.00 and self-employment income $100,000.00: NEITHER alone
        // exceeds $200,000, and together they exceed it by $50,000.
        //
        //   line 4  wages                                     $150,000.00
        //   line 6  $150,000 is below the threshold                  $0.00
        //   line 9  threshold                                  $200,000.00
        //   line 10 = line 4                                   $150,000.00
        //   line 11 200,000.00 - 150,000.00                     $50,000.00
        //   line 12 100,000.00 - 50,000.00                      $50,000.00
        //   line 13 0.9% of $50,000.00                             $450.00
        //
        // A Part II written against a FRESH $200,000 threshold would give
        // line 11 = $200,000, line 12 = $0.00 and NO tax at all — a $450.00
        // understatement for exactly the filer this phase exists to serve.
        // Both figures are asserted.
        wagesAndSelfEmploymentIncomeShareOneThreshold: () => {
            const result = runWithSelfEmployment('single')(15000000n)(10000000n)
            assertEq(result.line6, 0n, 'line 6 = $0.00 -- wages alone are below the threshold')
            assertEq(result.line7, 0n, 'line 7 = $0.00 -- Part I charges nothing')
            assertEq(result.line10, 15000000n, 'line 10 = $150,000.00, restating line 4')
            assertEq(result.line11, 5000000n, 'line 11 = $50,000.00 of head-room left')
            assertEq(result.line12, 5000000n, 'line 12 = $50,000.00 of self-employment income taxed')
            assertEq(result.line13, 45000n, 'line 13 = $450.00')
            assertEq(result.line18, 45000n, 'line 18 = $450.00 -> Schedule 2 line 11')
            // THE NAIVE ANSWER, hand-computed: a fresh threshold shelters the
            // whole $100,000 and charges nothing.
            assert(
                10000000n < 20000000n,
                'a fresh $200,000 threshold would shelter the whole $100,000 and charge $0.00')
        },
        // BOTH ARMS AT ONCE, which is the return a founder with a day job
        // actually files. Wages $300,000.00 and self-employment income
        // $50,000.00: Part I charges 0.9% on $100,000 of excess wages
        // ($900.00), the threshold is entirely consumed so line 11 is zero,
        // and Part II charges 0.9% on the WHOLE $50,000 ($450.00). Line 18
        // adds both to $1,350.00 -- hand-added.
        bothArmsChargeOnOneReturn: () => {
            const result = runWithSelfEmployment('single')(30000000n)(5000000n)
            assertEq(result.line6, 10000000n, 'line 6 = $100,000.00 of excess wages')
            assertEq(result.line7, 90000n, 'line 7 = $900.00')
            assertEq(result.line11, 0n, 'line 11 = $0.00 -- the wages consumed the whole threshold')
            assertEq(result.line12, 5000000n, 'line 12 = $50,000.00, all of it taxed')
            assertEq(result.line13, 45000n, 'line 13 = $450.00')
            assertEq(result.line18, 135000n, 'line 18 = $1,350.00 = $900.00 + $450.00')
        },
        // Line 8's own printed floor: "if zero or less, enter -0-". A
        // Schedule SE that produced a negative figure -- which
        // `fjs/schedule/se` will not, since a Schedule C loss refuses one
        // module earlier -- must not create a NEGATIVE tax here. The printed
        // rule, implemented at the printed line rather than assumed of the
        // caller.
        aNegativeSelfEmploymentIncomeEntersZero: () => {
            const result = runWithSelfEmployment('single')(0n)(-5000000n)
            assertEq(result.line8, 0n, 'line 8 = $0.00, floored')
            assertEq(result.line12, 0n, 'line 12 = $0.00')
            assertEq(result.line13, 0n, 'line 13 = $0.00')
        },
    },
    partIII: {
        // Structurally unreachable rather than merely zero: `fjs/document/w2`
        // has no box-14 field, so nothing can ever put an amount on line 14.
        // Asserted at wages far above every threshold, so the zero cannot be
        // mistaken for "below the threshold".
        rrtaCompensationIsStructurallyZero: () => {
            const result = run('single')(50000000n)(0n)
            assertEq(result.line14, 0n, 'line 14 = $0.00 -- W-2 box 14 is not a field any stored W-2 has')
            assertEq(result.line15, 20000000n, 'line 15 = $200,000.00, the same threshold again')
            assertEq(result.line16, 0n, 'line 16 = $0.00')
            assertEq(result.line17, 0n, 'line 17 = $0.00')
        },
        // The three parts really do read ONE threshold, not three lookups
        // that happen to agree today. Asserted for every status, so a lookup
        // that read a different parameter in one part names itself.
        linesFiveNineAndFifteenAreTheSameFigure: () => {
            for (const status of everyStatus) {
                const result = run(status)(0n)(0n)
                assertEq(result.line5, thresholdCents[status], ['line 5', status])
                assertEq(result.line9, result.line5, ['line 9 must restate line 5', status])
                assertEq(result.line15, result.line5, ['line 15 must restate line 5', status])
            }
        },
    },
    partV: {
        // THE WITHHOLDING SPLIT, on the phase's motivating return. One
        // employer paid $300,000, so it withheld the ordinary 1.45% on all of
        // it ($4,350.00) PLUS the extra 0.9% on the $100,000 it paid above
        // $200,000 ($900.00) -- box 6 reads $5,250.00, with nothing on the
        // W-2 saying which part is which. Line 21 recomputes the ordinary
        // half from box 5, and line 22 is what is left. Every figure
        // hand-computed:
        //   1.45% of $300,000.00 = 30,000,000 * 145 / 10,000 = 435,000 cents
        //   $5,250.00 - $4,350.00 = $900.00
        oneEmployerAboveTheThresholdWithholdsExactlyTheTaxOwed: () => {
            const result = run('single')(30000000n)(525000n)
            assertEq(result.line19, 525000n, 'line 19 = $5,250.00, the box 6 total -- BOTH taxes at once')
            assertEq(result.line20, 30000000n, 'line 20 = $300,000.00, restating line 1')
            assertEq(result.line21, 435000n, 'line 21 = $4,350.00 = 1.45% of $300,000.00, the ordinary half')
            assertEq(result.line22, 90000n, 'line 22 = $900.00 = $5,250.00 - $4,350.00, the additional half')
            assertEq(result.line23, 0n, 'line 23 = $0.00 -- no RRTA box to read')
            assertEq(result.line24, 90000n, 'line 24 = $900.00 -> 1040 line 25c')
            // …and it is EXACTLY the tax line 18 charges, which is why a
            // single filer with one large employer owes nothing extra. The
            // two are asserted equal here rather than assumed, because the
            // whole point of Part V is that they usually cancel.
            assertEq(result.line18, result.line24, 'the tax and the withholding cancel for this filer')
        },
        // THE OTHER DIRECTION, and the one that actually costs money. A joint
        // couple with two $150,000 employers: NEITHER employer paid anyone
        // above $200,000, so neither withheld a cent of Additional Medicare
        // Tax, and box 6 is the ordinary 1.45% of $300,000 exactly. The
        // couple still owes 0.9% on $300,000 - $250,000 = $50,000 = $450.00,
        // with nothing withheld against it.
        //   1.45% of $300,000.00 = 435,000 cents, the whole of box 6
        //   0.9% of $50,000.00 = 5,000,000 * 90 / 10,000 = 45,000 cents
        twoEmployersEachBelowTheThresholdWithholdNothingAndTheCoupleOwes: () => {
            const result = run('marriedFilingJointly')(30000000n)(435000n)
            assertEq(result.line6, 5000000n, 'line 6 = $50,000.00 = $300,000.00 - $250,000.00')
            assertEq(result.line18, 45000n, 'line 18 = $450.00 of tax')
            assertEq(result.line21, 435000n, 'line 21 = $4,350.00, which is the WHOLE of box 6')
            assertEq(result.line22, 0n, 'line 22 = $0.00 -- no employer withheld any Additional Medicare Tax')
            assertEq(result.line24, 0n, 'line 24 = $0.00 -> nothing reaches 1040 line 25c')
        },
        // THE FLOOR. Per-pay-period rounding can leave box 6 a few cents
        // BELOW 1.45% of box 5, and an unfloored line 22 would put a NEGATIVE
        // payment on 1040 line 25c. One cent short of the ordinary rate, so
        // the difference is unambiguously the floor rather than a zero
        // arriving some other way.
        roundingBelowTheOrdinaryRateFloorsAtZero: () => {
            const result = run('single')(10000000n)(144999n)
            assertEq(result.line21, 145000n, 'line 21 = $1,450.00 = 1.45% of $100,000.00')
            assertEq(result.line19, 144999n, 'line 19 = $1,449.99 -- one cent short, as rounding can leave it')
            assertEq(result.line22, 0n, 'line 22 = $0.00, floored -- never -$0.01')
            assertEq(result.line24, 0n, 'line 24 = $0.00')
        },
        // THE REGRESSION CONTROL FOR EVERY EXISTING FIXTURE IN THIS
        // REPOSITORY. No fixture anywhere in `fjs/`, the root integration
        // tests or `demo/` set W-2 box 6 before this phase -- verified by
        // grep -- so line 19 is zero for all of them, and the floor makes
        // line 24 zero too. Without the floor, an absent box 6 would have
        // produced a NEGATIVE $1,450.00 credit on every one of them.
        anAbsentBoxSixContributesNothingRatherThanANegativeCredit: () => {
            const result = run('single')(10000000n)(0n)
            assertEq(result.line19, 0n, 'line 19 = $0.00 -- DOC-11: an absent box contributes nothing')
            assertEq(result.line21, 145000n, 'line 21 = $1,450.00, computed all the same')
            assertEq(result.line22, 0n, 'line 22 = $0.00, floored')
            assertEq(result.line24, 0n, 'line 24 = $0.00 -> 1040 line 25c is untouched')
        },
    },
    wholeForm: {
        // Line 18 is Part IV, and it really is the sum of all three parts'
        // tax lines rather than Part I's alone -- so a future non-zero Part
        // II or III cannot be silently dropped on the way to Schedule 2.
        lineEighteenAddsAllThreeParts: () => {
            const result = run('single')(30000000n)(0n)
            assertEq(result.line18, result.line7 + result.line13 + result.line17, 'line 18 = 7 + 13 + 17')
            assertEq(result.line18, 90000n, 'line 18 = $900.00 -> Schedule 2 line 11')
        },
        // A return with no wages at all: every line zero, for every status.
        // The degenerate input, and the strongest statement that this form
        // cannot invent a tax out of nothing.
        noWagesAtAllIsZeroEverywhere: () => {
            for (const status of everyStatus) {
                const result = run(status)(0n)(0n)
                assertEq(result.line18, 0n, ['no wages: no tax', status])
                assertEq(result.line24, 0n, ['no wages: no withholding', status])
            }
        },
        // Hand-typed line-count guard, this project's mutation-gate idiom: a
        // line dropped from the returned record fails here even though every
        // leaf above reads only the lines it names. Part I's 7 (lines 1-7) +
        // Part II's 6 (8-13) + Part III's 4 (14-17) + Part IV's 1 (line 18) +
        // Part V's 6 (19-24) = 24, which is exactly lines 1 through 24 with
        // none missing.
        everyPrintedLineIsNamed: () => {
            const result = run('single')(30000000n)(525000n)
            const expectedFieldCount = 24
            assertEq(
                Object.keys(result).length,
                expectedFieldCount,
                ['expected exactly 24 named Form 8959 fields (lines 1-24)', Object.keys(result)],
            )
        },
    },
}
