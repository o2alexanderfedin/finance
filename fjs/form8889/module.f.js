/**
 * Form 8889, *Health Savings Accounts (HSAs)* — **Part I only**, lines 1
 * through 13, whose line 13 is Schedule 1 line 13 (TAX-24, Phase 24).
 *
 * Source: the printed `f8889.pdf` (2025) Part I, line by line. This is a
 * STANDALONE, independently callable pure function over already-extracted
 * facts — the same relationship `fjs/form8959`, `fjs/form8960` and
 * `fjs/schedule/1a` have to their own inputs. It reads no stored documents,
 * and it is not wired into `fjs/form1040/core` or `fjs/return/scope` here.
 *
 * ## What this module COMPUTES and what it REFUSES — read this first
 *
 * Form 8889 is a substantial form and this phase does not model all of it.
 * The boundary is drawn where the printed page stops being self-contained,
 * and every case on the far side of it produces a NAMED REFUSAL rather than
 * a number:
 *
 * | Printed line | Status |
 * |---|---|
 * | 1 coverage type | computed — `selfOnly` or `family`, the taxpayer's own assertion |
 * | 2 contributions you made | computed — `vnd.fjs.adjustments` entries tagged `hsaContribution` |
 * | 3 limitation | computed **only** for a full-year eligible individual; **refused otherwise** |
 * | 4 Archer MSA contributions | documented zero — see below |
 * | 5 line 3 − line 4 | computed |
 * | 6 spouse allocation | computed **only** when no spouse split is possible; **refused otherwise** |
 * | 7 additional contribution | structurally zero here — see "Where the catch-up lands" |
 * | 8 line 6 + line 7 | computed |
 * | 9 employer contributions | computed — Form W-2 box 12 code W |
 * | 10 qualified HSA funding distribution | **refused** when declared |
 * | 11 line 9 + line 10 | computed |
 * | 12 line 8 − line 11 | computed; **refused when it would be negative** |
 * | 13 HSA deduction | computed — the smaller of line 2 and line 12 |
 *
 * **Parts II and III are not modeled at all, and neither reaches Schedule 1
 * line 13.** Part II (distributions) lands on Schedule 1 line 8f and Schedule
 * 2 line 17c; Part III (failure to maintain coverage during a testing period)
 * lands on Schedule 2 line 17c as well. Both destinations are inside
 * lettered blocks that the 2026-08-18 split took apart: the income half is
 * `healthSavingsAccountIncome` (Schedule 1 line 8f) and the additional-tax
 * halves are `hsaDistributionAdditionalTax` (Schedule 2 line 17c) and
 * `hsaIneligibleIndividualAdditionalTax` (line 17d) — three kinds where two
 * coarse ones stood, each refusing in `fjs/return/scope` by its own printed
 * line, so a taxpayer with HSA distributions is refused by the scope guard
 * rather than silently given a deduction with no matching income. That is why this module models Part I alone and says so
 * rather than pretending the form is finished.
 *
 * ## Line 3, and the one refusal that carries the most weight
 *
 * The printed line 3 reads *"If you were under age 55 at the end of 2025
 * and, on the first day of every month during 2025, you were, or were
 * considered, an eligible individual with the same coverage, enter $4,300
 * ($8,550 for family coverage). **All others, see the instructions for the
 * amount to enter.**"*
 *
 * That final sentence is a whole worksheet — the Line 3 Limitation Chart and
 * Worksheet — covering the month-by-month proration for partial-year
 * eligibility, a coverage type that changed mid-year, and §223(b)(8)'s
 * last-month rule with its own testing period and its own recapture. None of
 * that is modeled. So {@link form8889PartI} REFUSES when
 * `fullYearSameCoverageEligible` is false, naming the line and the worksheet,
 * rather than quietly applying the full-year figure to a filer who is not
 * entitled to it. That refusal is the single most valuable thing in this
 * module: the full-year figure applied to a six-month-eligible taxpayer
 * overstates the deduction by up to half of it, and nothing downstream could
 * ever notice.
 *
 * ## Where the catch-up lands, and why line 7 is structurally zero here
 *
 * §223(b)(3) gives an eligible individual who has attained age 55 before the
 * close of the year an additional $1,000. The printed FORM splits that
 * across two places, which is the part most likely to be got wrong:
 *
 * - Line 3's own instruction folds it into the limitation for the ordinary
 *   case — a full-year eligible 55-or-older individual enters $5,300
 *   ($9,550 for family coverage), i.e. the stored limit plus the stored
 *   catch-up, which is why this module adds them there.
 * - Line 7 exists for the narrower case its printed text describes: *"If you
 *   were age 55 or older at the end of 2025, **married**, and you or your
 *   spouse had family coverage under an HDHP at any time during 2025."* Its
 *   whole purpose is to restore a personal catch-up that line 6's SPOUSE
 *   ALLOCATION would otherwise have divided away — and this module refuses
 *   every return in which that allocation is possible (see line 6, below).
 *
 * So line 7 is `0n` here **because the only case that could make it non-zero
 * is refused one line earlier**, not because the catch-up is being dropped.
 * `theCatchUpIsInLineThreeAndLineSevenIsUnreachable` pins both halves: a
 * 55-or-older filer's line 3 is exactly $1,000 higher, and line 7 is zero.
 *
 * ## Line 4 (Archer MSA) is a documented zero, and the reason is a kind
 *
 * No dialect models an Archer MSA contribution, and `archerMsaDeduction`
 * (Schedule 1 line 23) is an `fjs/return/scope` refusal in its own right
 * after this phase's kind split. A taxpayer who has one and declares it is
 * refused at the scope layer before this function runs; a taxpayer who has
 * one and does not declare it has an undeclared kind, which is the failure
 * mode the whole declared-set design already accepts and which
 * `fjs/return/tripwire` is the complementary guard for. Modeling line 4 as a
 * documented zero is therefore the same treatment every collapsed Schedule 1
 * line already gets, not a new gap.
 *
 * ## Rounding: none, and that is a property rather than an omission
 *
 * Every line here is a sum, a difference or a `min` over exact cents. No
 * percentage, no proration and no ratio appears anywhere in Part I as this
 * module models it — the one place a fraction WOULD have appeared is line
 * 3's monthly proration, which is refused. So unlike `fjs/schedule/1a` and
 * `fjs/tax/ssb`, this module imports nothing from `fjs/types/rational` and
 * rounds nothing; `nothingHereRoundsBecauseNothingHereDivides` states it.
 *
 * @module
 */
import { assert, assertEq } from 'functionalscript/fjs/asserts/module.f.mjs'
import { centsFromString } from '../exact/module.f.js'
import { taxParamsByYear } from '../tax/params/module.f.js'

/** @import { TaxParamSet } from '../tax/params/module.f.js' */

/**
 * Form 8889 line 1's own two checkboxes, as this module receives them. The
 * string values are `fjs/document/adjustments`' own `hsaCoverageTypes`, which
 * that dialect validates at the storage boundary — this module takes the
 * narrowed union and never re-checks it (AGENTS.md: one rule, one place).
 * @typedef {'selfOnly' | 'family'} HsaCoverageType
 */

/**
 * Everything Part I needs, as facts rather than documents.
 *
 * `fullYearSameCoverageEligible` and `qualifiedHsaFundingDistributionDeclared`
 * are the two that decide whether this function returns a number at all — see
 * this module's own docstring. `spouseCouldSplitTheFamilyLimit` is the third:
 * it is TRUE when the return carries a second HSA holder alongside family
 * coverage, which is exactly the line 6 case the printed page hands to its
 * instructions.
 * @typedef {{
 *   readonly coverageType: HsaCoverageType,
 *   readonly fullYearSameCoverageEligible: boolean,
 *   readonly catchUpEligible: boolean,
 *   readonly qualifiedHsaFundingDistributionDeclared: boolean,
 *   readonly spouseCouldSplitTheFamilyLimit: boolean,
 *   readonly personalContributionCents: bigint,
 *   readonly employerContributionCents: bigint,
 * }} Form8889PartIInput
 */

/**
 * The filled-in Part I: every printed line under its own printed number,
 * plus `line1` as the coverage type it actually is rather than as a number
 * (the printed line 1 is a pair of checkboxes, and rendering it as `0n` would
 * be the one line on this form that lies about what it holds).
 *
 * The same record-not-array reasoning as `fjs/tax/ssb` and
 * `fjs/tax/line16/qdcgt`: `noUncheckedIndexedAccess` makes an array index
 * `bigint | undefined`, and a record indexes cleanly with the printed line
 * numbers carried in the field names (TAX-15).
 * @typedef {{
 *   readonly kind: 'ok',
 *   readonly line1: HsaCoverageType,
 *   readonly line2: bigint, readonly line3: bigint, readonly line4: bigint,
 *   readonly line5: bigint, readonly line6: bigint, readonly line7: bigint,
 *   readonly line8: bigint, readonly line9: bigint, readonly line10: bigint,
 *   readonly line11: bigint, readonly line12: bigint, readonly line13: bigint,
 * }} Form8889PartI
 */

/**
 * A case this module will not compute. A VALUE, never a throw — the same
 * shape `fjs/schedule/d`'s absent-basis outcome and `fjs/schedule/a`'s
 * data-sufficiency outcome already use, so `fjs/schedule/1` can thread it
 * into `fjs/form1040/core`'s existing error arm without a new mechanism.
 *
 * There is deliberately no `unmodeled` field: this is a
 * document-data-sufficiency refusal, not an `fjs/return/scope` kind refusal,
 * and the two are different questions (12.1-CONTEXT.md Decision 2.6).
 * @typedef {{ readonly kind: 'error', readonly message: string }} Form8889Refusal
 */

/** @typedef {Form8889PartI | Form8889Refusal} Form8889Outcome */

/**
 * Computes Form 8889 Part I, or refuses by name. See this module's own
 * docstring for the full table of what is computed and what is not.
 * @type {(taxParamSet: TaxParamSet) => (input: Form8889PartIInput) => Form8889Outcome}
 */
export const form8889PartI = taxParamSet => input => {
    const {
        coverageType, fullYearSameCoverageEligible, catchUpEligible,
        qualifiedHsaFundingDistributionDeclared, spouseCouldSplitTheFamilyLimit,
        personalContributionCents, employerContributionCents,
    } = input
    // The three refusals run BEFORE any line is assigned, mirroring
    // `fjs/schedule/1a`'s own MFS short-circuit ordering discipline: a gate
    // is a gate, never a consequence of arithmetic that happened to come out
    // a certain way.
    if (!fullYearSameCoverageEligible) {
        return {
            kind: 'error',
            message: 'Form 8889 line 3 (HSA contribution limitation) cannot be computed: this return '
                + 'does not assert high-deductible health plan coverage with the SAME coverage type on '
                + "the first day of every month, so the printed line's own \"All others, see the "
                + 'instructions\" branch applies — the Line 3 Limitation Chart and Worksheet\'s '
                + "month-by-month proration and §223(b)(8)'s last-month rule, neither of which this "
                + 'engine models (no phase yet)',
        }
    }
    if (qualifiedHsaFundingDistributionDeclared) {
        return {
            kind: 'error',
            message: 'Form 8889 line 10 (qualified HSA funding distribution) is declared on this '
                + 'return, and this engine does not model the once-in-a-lifetime IRA-to-HSA transfer '
                + 'or its testing period; refusing rather than omitting it from line 11 and '
                + 'overstating the line 13 deduction (no phase yet)',
        }
    }
    if (spouseCouldSplitTheFamilyLimit) {
        return {
            kind: 'error',
            message: 'Form 8889 line 6 (allocation of the family limit between spouses) cannot be '
                + 'computed: this return carries two health savings account holders and family '
                + "coverage, so the printed line's own \"see the instructions\" branch applies — the "
                + 'limit is divided by agreement between the spouses, which no document this engine '
                + 'models records (no phase yet)',
        }
    }
    const { healthSavingsAccount } = taxParamSet
    // 1. The coverage-type checkbox itself.
    const line1 = coverageType
    // 2. "HSA contributions you made for 2025", employer contributions
    //    excluded -- the caller has already excluded them, because they
    //    arrive on a different document entirely (Form W-2 box 12 code W,
    //    line 9 below).
    const line2 = personalContributionCents
    // 3. The limitation. The stored per-coverage-type limit, PLUS §223(b)(3)'s
    //    catch-up where the individual has attained 55 -- see this module's
    //    own docstring, "Where the catch-up lands", for why the catch-up is
    //    here rather than on line 7.
    const annualLimitCents = centsFromString(healthSavingsAccount.annualLimit[coverageType].amount)
    const catchUpCents = catchUpEligible
        ? centsFromString(healthSavingsAccount.catchUpContribution.amount)
        : 0n
    const line3 = annualLimitCents + catchUpCents
    // 4. Archer MSA contributions -- a documented zero; see this module's own
    //    docstring, "Line 4 (Archer MSA) is a documented zero".
    const line4 = 0n
    // 5. "Subtract line 4 from line 3. If zero or less, enter -0-."
    const line5 = line3 > line4 ? line3 - line4 : 0n
    // 6. "Enter the amount from line 5." The spouse-allocation branch is
    //    refused above, so this line is the copy the printed page's first
    //    sentence describes.
    const line6 = line5
    // 7. The additional contribution amount -- structurally zero here,
    //    because the only case that makes it non-zero is the spouse split
    //    refused above. See this module's own docstring.
    const line7 = 0n
    // 8. "Add lines 6 and 7."
    const line8 = line6 + line7
    // 9. "Employer contributions made to your HSAs for 2025" -- Form W-2 box
    //    12 code W, summed by the caller.
    const line9 = employerContributionCents
    // 10. Qualified HSA funding distributions -- refused above when declared,
    //     so zero for every return that reaches here.
    const line10 = 0n
    // 11. "Add lines 9 and 10."
    const line11 = line9 + line10
    // 12. "Subtract line 11 from line 8. If zero or less, enter -0-."
    //
    //     The printed floor is NOT applied blindly. Reaching it means the
    //     employer already contributed more than the whole limit, which is an
    //     EXCESS CONTRIBUTION -- includible in income and subject to a 6%
    //     excise tax on Form 5329. Entering -0- and moving on would give a
    //     correct $0 deduction beside a silently missing tax, which is the
    //     TAX-16 failure mode in its purest form, so this engine refuses.
    if (line11 > line8) {
        return {
            kind: 'error',
            message: 'Form 8889 line 12 would be negative: employer contributions (Form W-2 box 12 '
                + 'code W) exceed the §223(b) contribution limit, which is an excess contribution '
                + 'includible in income and subject to the 6% excise tax on Form 5329 — a form this '
                + 'engine does not model. Refusing rather than entering -0- on line 12 and omitting '
                + 'the tax (no phase yet)',
        }
    }
    const line12 = line8 - line11
    // 13. "HSA deduction. Enter the smaller of line 2 or line 12 here and on
    //     Schedule 1 (Form 1040), Part II, line 13."
    const line13 = line2 < line12 ? line2 : line12
    assert(line13 >= 0n, ['Form 8889 line 13 must never be negative', line13])
    return {
        kind: 'ok',
        line1, line2, line3, line4, line5, line6, line7,
        line8, line9, line10, line11, line12, line13,
    }
}

// ── Tests ────────────────────────────────────────────────────────────────────

/**
 * TY2025's parameter set, narrowed exactly ONCE at module scope, mirroring
 * `fjs/tax/ssb`'s and `fjs/schedule/1a`'s own precedent.
 */
const taxParams2025 = taxParamsByYear[2025]
assert(taxParams2025 !== undefined, 'expected TY2025 parameters to be present in taxParamsByYear')

/**
 * The ordinary case: one full-year-eligible individual under 55, self-only
 * coverage, no employer contribution, contributing less than the limit.
 * @type {Form8889PartIInput}
 */
const ordinary = {
    coverageType: 'selfOnly',
    fullYearSameCoverageEligible: true,
    catchUpEligible: false,
    qualifiedHsaFundingDistributionDeclared: false,
    spouseCouldSplitTheFamilyLimit: false,
    personalContributionCents: 200000n,   // $2,000.00
    employerContributionCents: 0n,
}

/** Narrows an outcome to its OK arm, throwing (never casting) if it is not.
 * @type {(outcome: Form8889Outcome) => Form8889PartI}
 */
const okPartI = outcome => {
    assert(outcome.kind === 'ok', ['expected a computed Part I', outcome])
    return outcome
}

/** Narrows an outcome to its refusal arm, throwing (never casting) if it is not.
 * @type {(outcome: Form8889Outcome) => Form8889Refusal}
 */
const refusal = outcome => {
    assert(outcome.kind === 'error', ['expected a refusal', outcome])
    return outcome
}

/** @type {(input: Form8889PartIInput) => Form8889Outcome} */
const compute = form8889PartI(taxParams2025)

export const proof = {
    // The ordinary case, every line hand-typed from the printed form's own
    // arithmetic rather than read back from the result: line 3 = $4,300.00
    // (TY2025 self-only), line 4 = $0.00, line 5 = $4,300.00, line 6 =
    // $4,300.00, line 7 = $0.00, line 8 = $4,300.00, line 9 = $0.00, line 10
    // = $0.00, line 11 = $0.00, line 12 = $4,300.00 - $0.00 = $4,300.00,
    // line 13 = min($2,000.00, $4,300.00) = $2,000.00.
    theOrdinaryFullYearSelfOnlyCase: () => {
        const result = okPartI(compute(ordinary))
        assertEq(result.line1, 'selfOnly')
        assertEq(result.line2, 200000n, '$2,000.00 contributed')
        assertEq(result.line3, 430000n, '$4,300.00 — §223(b)(2)(A), TY2025')
        assertEq(result.line4, 0n)
        assertEq(result.line5, 430000n)
        assertEq(result.line6, 430000n)
        assertEq(result.line7, 0n)
        assertEq(result.line8, 430000n)
        assertEq(result.line9, 0n)
        assertEq(result.line10, 0n)
        assertEq(result.line11, 0n)
        assertEq(result.line12, 430000n)
        assertEq(result.line13, 200000n, 'the smaller of line 2 and line 12')
    },
    // Family coverage reads the OTHER stored limit. $8,550.00, not twice
    // $4,300.00 -- the asymmetry `fjs/tax/params` asserts on the data side,
    // asserted here on the consumption side so a consumer that read the
    // self-only limit for both coverage types is caught too.
    familyCoverageReadsTheFamilyLimit: () => {
        const result = okPartI(compute({ ...ordinary, coverageType: 'family' }))
        assertEq(result.line1, 'family')
        assertEq(result.line3, 855000n, '$8,550.00 — §223(b)(2)(B), TY2025')
        assert(
            result.line3 !== 860000n,
            ['the family limit is not twice the self-only limit', result.line3],
        )
    },
    // Line 13 is a MINIMUM, and this is the direction that proves it: a
    // taxpayer who contributed MORE than the limit deducts the limit, not
    // what they put in. Without this leaf, `line13 = line2` would pass every
    // other case in this file.
    contributingMoreThanTheLimitDeductsTheLimit: () => {
        const result = okPartI(compute({ ...ordinary, personalContributionCents: 500000n }))
        assertEq(result.line2, 500000n, '$5,000.00 contributed')
        assertEq(result.line12, 430000n)
        assertEq(result.line13, 430000n, 'capped at the $4,300.00 limit, not the $5,000.00 paid')
    },
    // Employer contributions REDUCE the deductible room without themselves
    // being deductible: $1,000.00 of box 12 code W leaves $3,300.00, and a
    // $4,000.00 personal contribution is deducted only to $3,300.00.
    employerContributionsReduceTheRoomWithoutBeingDeducted: () => {
        const result = okPartI(compute({
            ...ordinary,
            personalContributionCents: 400000n,
            employerContributionCents: 100000n,
        }))
        assertEq(result.line9, 100000n, '$1,000.00 — Form W-2 box 12 code W')
        assertEq(result.line11, 100000n)
        assertEq(result.line12, 330000n, '$4,300.00 - $1,000.00 = $3,300.00')
        assertEq(result.line13, 330000n, 'min($4,000.00, $3,300.00)')
        // The employer money is not in line 13. If it were, this figure would
        // be $4,000.00 or $4,300.00.
        assert(
            result.line13 !== 400000n && result.line13 !== 430000n,
            ['employer contributions are not the taxpayer\'s deduction', result.line13],
        )
    },
    catchUp: {
        // §223(b)(3)'s $1,000, and BOTH halves of where the printed form puts
        // it: line 3 is exactly $1,000.00 higher, and line 7 stays zero
        // because the only case that makes it non-zero is refused one line
        // earlier. See this module's own docstring, "Where the catch-up
        // lands".
        theCatchUpIsInLineThreeAndLineSevenIsUnreachable: () => {
            const without = okPartI(compute(ordinary))
            const with55 = okPartI(compute({ ...ordinary, catchUpEligible: true }))
            assertEq(with55.line3, 530000n, '$4,300.00 + $1,000.00 = $5,300.00')
            assertEq(with55.line3 - without.line3, 100000n, 'exactly §223(b)(3)(B)\'s $1,000.00')
            assertEq(with55.line7, 0n, 'the printed line 7 case is refused, never silently dropped')
            assertEq(without.line7, 0n)
        },
        // The catch-up rides on top of the FAMILY limit too, which a
        // hardcoded self-only base would get wrong: $8,550.00 + $1,000.00.
        theCatchUpAppliesToFamilyCoverageToo: () => {
            const result = okPartI(compute({
                ...ordinary, coverageType: 'family', catchUpEligible: true,
            }))
            assertEq(result.line3, 955000n, '$8,550.00 + $1,000.00 = $9,550.00')
        },
        // The catch-up must reach line 13, not merely line 3: a taxpayer who
        // contributed $5,000.00 with self-only coverage deducts $4,300.00
        // without the catch-up and the whole $5,000.00 with it.
        theCatchUpReachesTheDeductionItself: () => {
            const without = okPartI(compute({ ...ordinary, personalContributionCents: 500000n }))
            const with55 = okPartI(compute({
                ...ordinary, personalContributionCents: 500000n, catchUpEligible: true,
            }))
            assertEq(without.line13, 430000n)
            assertEq(with55.line13, 500000n, 'the whole $5,000.00 now fits under $5,300.00')
        },
    },
    refusals: {
        // THE refusal that carries the most weight (see this module's own
        // docstring): the full-year figure applied to a partly-eligible
        // taxpayer overstates the deduction by up to half of it. The message
        // must name the LINE and the WORKSHEET, which is the part a reader
        // can act on -- not merely say "cannot compute".
        partialYearEligibilityIsRefusedNamingTheLineAndTheWorksheet: () => {
            const result = refusal(compute({ ...ordinary, fullYearSameCoverageEligible: false }))
            assert(result.message.includes('line 3'), ['must name the printed line', result.message])
            assert(
                result.message.includes('Line 3 Limitation Chart and Worksheet'),
                ['must name the worksheet a reader would have to fill in', result.message],
            )
            assert(
                result.message.includes('last-month rule'),
                ['must name the other rule folded into that branch', result.message],
            )
        },
        // The CONTROL for the leaf above: a gate that refused everything
        // would pass it. The ordinary case must still compute.
        fullYearEligibilityIsNotRefused: () => {
            assertEq(compute(ordinary).kind, 'ok')
        },
        qualifiedHsaFundingDistributionIsRefusedNamingLineTen: () => {
            const result = refusal(compute({
                ...ordinary, qualifiedHsaFundingDistributionDeclared: true,
            }))
            assert(result.message.includes('line 10'), ['must name the printed line', result.message])
            assert(
                result.message.includes('IRA-to-HSA'),
                ['must name what the transfer actually is', result.message],
            )
        },
        spouseSplitOfTheFamilyLimitIsRefusedNamingLineSix: () => {
            const result = refusal(compute({
                ...ordinary, coverageType: 'family', spouseCouldSplitTheFamilyLimit: true,
            }))
            assert(result.message.includes('line 6'), ['must name the printed line', result.message])
            assert(
                result.message.includes('agreement'),
                ['must name why it cannot be computed: the split is by agreement', result.message],
            )
        },
        // An EXCESS employer contribution is refused rather than floored to
        // -0-. This is the leaf that distinguishes an engine that reads the
        // printed "if zero or less, enter -0-" as permission to move on from
        // one that notices a missing Form 5329. $5,000.00 of employer money
        // against a $4,300.00 limit.
        employerContributionsAboveTheLimitAreRefusedNamingForm5329: () => {
            const result = refusal(compute({ ...ordinary, employerContributionCents: 500000n }))
            assert(result.message.includes('line 12'), ['must name the printed line', result.message])
            assert(result.message.includes('Form 5329'), ['must name the missing form', result.message])
            assert(
                result.message.includes('excess contribution'),
                ['must name what the condition is', result.message],
            )
        },
        // The CONTROL for the leaf above, at the exact boundary: employer
        // contributions EQUAL to the limit are line 12 = $0.00, which is a
        // legitimate computed zero, not a refusal. One cent more is the
        // refusal; this is one cent less than that.
        employerContributionsExactlyAtTheLimitStillCompute: () => {
            const result = okPartI(compute({ ...ordinary, employerContributionCents: 430000n }))
            assertEq(result.line11, 430000n)
            assertEq(result.line12, 0n, 'exactly at the limit: no room left, and no excess either')
            assertEq(result.line13, 0n)
            const oneCentMore = compute({ ...ordinary, employerContributionCents: 430001n })
            assertEq(oneCentMore.kind, 'error', 'one cent over the limit is an excess contribution')
        },
    },
    // Nothing in Part I as this module models it divides, so nothing rounds:
    // every stored figure is a whole number of dollars and every operation is
    // a sum, a difference or a `min`, so no result can ever carry a fraction
    // of a cent. The one place a ratio WOULD appear -- line 3's monthly
    // proration -- is refused. Stated as a leaf rather than a comment so a
    // future proration added without rounding discipline is visible.
    nothingHereRoundsBecauseNothingHereDivides: () => {
        const result = okPartI(compute({
            ...ordinary,
            personalContributionCents: 123457n,   // $1,234.57, deliberately odd cents
            employerContributionCents: 76543n,    // $765.43
        }))
        // $4,300.00 - $765.43 = $3,534.57, and the odd cents survive intact.
        assertEq(result.line12, 353457n)
        assertEq(result.line13, 123457n, 'the smaller of $1,234.57 and $3,534.57')
    },
    // Every printed Part I line is named. A hand-typed count, so a line
    // silently dropped from the returned record is caught even though every
    // value happens to be checkable elsewhere (AGENTS.md's hand-typed-count
    // idiom). Thirteen printed lines plus the `kind` discriminant.
    everyPrintedPartOneLineIsNamed: () => {
        const result = okPartI(compute(ordinary))
        assertEq(Object.keys(result).length, 14, 'expected 13 printed lines plus the kind tag')
    },
}
