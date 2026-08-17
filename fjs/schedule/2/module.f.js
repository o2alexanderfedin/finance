/**
 * Schedule 2 (Form 1040) — TAX-14: Part I (Tax, lines 1a-3) and Part II
 * (Other Taxes, lines 4-21), every printed line named and computed.
 *
 * Source, transcribed directly (13-RESEARCH.md §5), not from recall:
 * `f1040s2.pdf` (2025), "Created" 2025.
 *
 * Lines 11 and 12 carry real Form 8959 and Form 8960 figures as of Phase 23
 * (TAX-20/TAX-21), **line 4 carries a real Schedule SE figure as of Phase 28**
 * (TAX-31), and **line 2 carries a real Form 6251 figure as of Phase 29**
 * (TAX-33); every other line is still a documented zero. See "Lines 11 and 12
 * compute; the other nineteen are still declared zeros" below.
 *
 * ## Line 2, and the two things about it that differ from every other line
 *
 * **First: it is the only line on this schedule that can make the whole
 * schedule REFUSE.** Form 6251 has three refusals of its own — the same-year
 * incentive stock option disposition, a Form 3921 missing a box, and Part III
 * when the upper bound does not settle the tax at zero — and each stops this
 * function before any later line is built. That is why {@link scheduleTwo}
 * returns a {@link ScheduleTwoOutcome} rather than a {@link ScheduleTwo}, and
 * why {@link ScheduleTwo} grew a `kind` discriminant.
 *
 * **Second: its provenance does NOT dedup back to the profile.** Line 4 has
 * the property that a return with no business cites only `declaredKinds`,
 * because both of its inputs are then `profileDeclaredZeroLine`s. Line 2
 * cannot: Form 6251 reads the adjusted gross income, the deduction total and
 * the regular tax on EVERY return, so line 2 cites all three even when the AMT
 * is $0.00, and line 3 — its total with line 1z — therefore does too. Phase 29
 * moves the citation lists of Schedule 2 lines 2 and 3, and thus of 1040 line
 * 17, on every return this engine computes; the VALUES are untouched, and
 * `lineTwoIsAComputedZeroThatCitesWhatTheComparisonRead` is where both halves
 * of that are pinned.
 *
 * ## Line 4, and the one thing about it that differs from lines 11 and 12
 *
 * Schedule SE is not run here. `fjs/schedule/1` runs it, because that
 * schedule needs the SAME execution's line 13 for its own line 15 — the
 * deductible half, which reduces adjusted gross income. So the whole
 * `SelfEmploymentOutcome` arrives as an INPUT, where Form 8959's and Form
 * 8960's arrive as calls. That asymmetry is deliberate and is argued at
 * {@link ScheduleTwoInput}: a form whose output lands on two schedules must
 * be executed by whichever of them needs it first, or the second execution
 * runs against a return the first one has already changed.
 *
 * **Line 4 stays a single profile citation for a return with no business**,
 * because both of the facts it unions are then `profileDeclaredZeroLine`s and
 * the union deduplicates them to one. That is not a coincidence to be relied
 * on quietly — `lineFourIsAComputedZeroThatStillCitesOnlyTheProfile` is the
 * leaf that pins it, and it is the property that makes Phase 28 move nothing
 * for a return without self-employment.
 *
 * This is a STANDALONE, independently callable pure function over its own
 * input — the same relationship `fjs/schedule/1` has to its own (read that
 * module's docstring first; this one follows its shape and reasoning without
 * repeating it). It does not consult the return-scope guard's own
 * classification function and it imports NOTHING at runtime from
 * `fjs/return/scope` or `fjs/form1040/`.
 *
 * **What it DOES import as of Phase 23 is `fjs/form8959` and `fjs/form8960`,
 * and it takes a `TaxParamSet`.** That is a real change to the boundary this
 * docstring used to claim ("imports NOTHING at runtime from `fjs/tax/`"), and
 * it is the smaller of the two available shapes: the alternative was for
 * `fjs/form1040/core` to call the two forms itself and hand this module two
 * finished cents figures, which would put two of Schedule 2's own printed
 * lines outside Schedule 2. The parameter set arrives as an ARGUMENT, exactly
 * as `fjs/schedule/1a` and `fjs/form8812` take theirs, so the tax year in
 * force stays the caller's decision and is never an implicit default.
 *
 * ## Lines 11 and 12 compute; the other nineteen are still declared zeros
 *
 * The frozen `kindVocabulary` carried exactly ONE kind for the whole of this
 * schedule, `scheduleTwoTaxes`, covering both Part I (AMT, excess advance
 * premium tax credit repayment, and the clean-vehicle-credit/EPE-recapture
 * sub-lines) and Part II (self-employment tax, the Additional Medicare Tax,
 * NIIT, household employment taxes, and seventeen more sub-lines at line
 * 17a-17z alone). Its own docstring recorded the consequence:
 *
 * > A taxpayer who genuinely owes, say, the Additional Medicare Tax and
 * > declares `scheduleTwoTaxes` cannot have that real dollar figure
 * > represented here — this module could only ever return `$0` for it.
 * > Reclassifying the kind would let that real, undeclared amount compute
 * > silently as `$0` — exactly TAX-16's failure mode.
 *
 * **Phase 23 removes the premise rather than the conclusion.** The coarse
 * kind is gone: it is fourteen per-printed-line kinds (`fjs/return/profile`'s
 * own vocabulary comment lists them, and `fjs/return/scope`'s refusal table
 * names each one's form). Two of the fourteen —
 * `additionalMedicareTax` (line 11) and `netInvestmentIncomeTax` (line 12) —
 * now have a real dollar figure to carry, so they are reclassified to
 * `modeledKinds` in the SAME commit as this wiring. The other twelve are
 * still refused, by name, and the argument quoted above still holds for each
 * of them word for word.
 *
 * **Lines 11 and 12 are read UNCONDITIONALLY, not gated on the declaration**
 * — the discipline every wired line in this engine follows (`fjs/form1040/
 * core`'s own line 19/28 comment states it: "a MODELED line reports what the
 * facts say; `declaredKinds` gates the WHOLE-RETURN refusal, never these
 * individual lines"). For line 11 that is observationally identical to
 * gating it, and the reason is worth writing down: Phase 22's tripwire
 * refuses any UNDECLARED return whose W-2 box 5 is above the threshold, so
 * an undeclared return that reaches this function is below the threshold and
 * Form 8959 line 18 is $0.00 for it anyway. For line 12 it is NOT identical,
 * and that is the point: no tripwire watches §1411, because its threshold is
 * on modified adjusted gross income rather than on any single stored box,
 * so computing Form 8960 unconditionally is the ONLY thing standing between
 * an undeclared high-income investor and a silently understated return.
 *
 * ## Provenance: lines 11 and 12 cite the boxes their forms actually read
 *
 * Both lines arrive as {@link ReportLine}s built from the UNION of their
 * inputs' own sources — line 11 from the W-2 box 5 and box 6 totals, line 12
 * from 1040 lines 2b, 3b, 7a and 11b. That is `fjs/form1040/core`'s own line
 * 12e precedent ("citing every fact a comparison actually reads"), and it is
 * why this module takes `ReportLine`s rather than bare cents for those
 * inputs: a `bigint` cannot carry where it came from, and PROV-01 makes a
 * line without sources unrepresentable.
 *
 * ## The 1a-1z and 17a-17z sub-line collapses
 *
 * Mirrors `fjs/schedule/1`'s line8/line9 and line24/line25 idiom exactly:
 * `line1`/`line17` are each ONE collapsed documented zero standing in for
 * a lettered sub-line group (never enumerating every sub-line, since none
 * is separately reachable), and `line1z`/`line18` restate that same total
 * as their own printed line, the way the form itself does.
 *
 * ## Line 10 ("Reserved for future use")
 *
 * Not a modeling gap — the printed form itself reserves this line number.
 * Modeled as a documented zero for line-number completeness, mirroring
 * `fjs/schedule/1`'s own line 22 treatment.
 *
 * The `totalLine`/`unionSources`/`profileDeclaredZeroLine` helpers below
 * are reimplemented locally, private and NOT imported from
 * `fjs/form1040/core` or `fjs/schedule/1` — this project's established
 * "reimplement an idiom you cannot import" pattern.
 *
 * @module
 */
import { assert, assertEq } from 'functionalscript/fjs/asserts/module.f.js'
import { form8959 } from '../../form8959/module.f.js'
import { form8960 } from '../../form8960/module.f.js'
import { form6251 } from '../../form6251/module.f.js'
// PROOF-ONLY at run time, and deliberately the ONLY thing this module reads
// from `fjs/return/scope`: `theForeignTaxCreditCycleIsResolvedByARefusal`
// needs to check that the foreign tax credit is still refused, because Form
// 6251 line 10 is handed a $0.00 for it. Production code below reads nothing
// from the scope guard, exactly as this module's own docstring says.
import { modeledKinds } from '../../return/scope/module.f.js'
import { scheduleSelfEmploymentPartI } from '../se/module.f.js'
import { taxParamsByYear } from '../../tax/params/module.f.js'

/** @import { ReturnProfile } from '../../return/profile/module.f.js' */
/** @import { ReportLine, Source } from '../../report/line/module.f.js' */
/** @import { IndividualFilingStatus, TaxParamSet } from '../../tax/params/module.f.js' */
/** @import { Form8959 } from '../../form8959/module.f.js' */
/** @import { Form8960 } from '../../form8960/module.f.js' */
/** @import { Form6251Ok } from '../../form6251/module.f.js' */
/** @import { FormThirtyNineTwentyOne } from '../../document/form3921/module.f.js' */
/** @import { SelfEmploymentOutcome } from '../se/module.f.js' */

// ── Inputs ───────────────────────────────────────────────────────────────────

/**
 * A stored document as this module sees it — mirrors `fjs/schedule/1`'s
 * own `Stored<T>`; nothing here re-validates.
 * @template T
 * @typedef {{ readonly documentHash: string, readonly value: T }} Stored
 */

// ── Local helpers (reimplemented, not imported from `fjs/form1040/core`) ──────

/**
 * A line that is zero because the taxpayer declared no such tax, citing
 * the return profile's own `declaredKinds` box — mirrors
 * `fjs/schedule/1`'s own `profileDeclaredZeroLine`.
 * @type {(profile: Stored<ReturnProfile>) => (rule: string) => ReportLine}
 */
const profileDeclaredZeroLine = profile => rule => ({
    value: 0n,
    sources: [{
        documentHash: profile.documentHash,
        boxPath: 'declaredKinds',
        value: JSON.stringify(profile.value.declaredKinds),
    }],
    rule,
})

/**
 * One `(documentHash, boxPath)` pair as a dedup key — mirrors
 * `fjs/schedule/1`'s own private `sourceKey`.
 * @type {(source: Source) => string}
 */
const sourceKey = source => `${source.documentHash} ${source.boxPath}`

/**
 * The union of every input line's sources, deduplicated, first-seen order,
 * still a non-empty tuple — mirrors `fjs/schedule/1`'s own private
 * `unionSources`.
 * @type {(lines: readonly ReportLine[]) => readonly [Source, ...(readonly Source[])]}
 */
const unionSources = lines => {
    const concatenated = lines.flatMap(line => line.sources)
    const deduplicated = concatenated.filter((source, index) =>
        concatenated.findIndex(seen => sourceKey(seen) === sourceKey(source)) === index)
    const [first, ...rest] = deduplicated
    assert(
        first !== undefined,
        ['a union of non-empty source tuples cannot be empty', lines.length],
    )
    return [first, ...rest]
}

/**
 * Sums a set of {@link ReportLine}s into one, with a unioned `sources` and
 * its own `rule` — mirrors `fjs/schedule/1`'s own private `totalLine`.
 * @type {(rule: string) => (lines: readonly ReportLine[]) => ReportLine}
 */
const totalLine = rule => lines => ({
    value: lines.reduce((total, line) => total + line.value, 0n),
    sources: unionSources(lines),
    rule,
})

// ── Schedule 2 itself ───────────────────────────────────────────────────────

/**
 * Everything `fjs/schedule/2` needs, and nothing more.
 *
 * The four document-derived amounts arrive as {@link ReportLine}s rather than
 * bare cents so lines 11 and 12 can cite the boxes their forms actually read;
 * see this module's own docstring, "Provenance". `medicareWages` and
 * `medicareTaxWithheld` are the W-2 box 5 and box 6 totals, which no 1040
 * line carries — Form 8959 is the only reader either box has.
 * `selfEmployment` is the WHOLE Schedule SE result, already executed by
 * `fjs/schedule/1` — never a bare tax figure and never a set of inputs this
 * module could run Schedule SE from itself. Two of that form's lines land in
 * two different places (line 12 here on line 4, line 13 on Schedule 1 line 15
 * where it reduces adjusted gross income), and a third, line 6, feeds Form
 * 8959 Part II from this module's own call below. Running Schedule SE twice —
 * once for the deduction and once for the tax — is the drift Schedule 8812's
 * single `form8812Outcome` and Form 8959's own line 18/line 24 pairing
 * already exist to prevent (13-CONTEXT.md Decision 4.3), and here it would be
 * worse than drift: the deduction changes AGI, so the second execution would
 * be running against a return the first one had already altered.
 * ## Phase 29's own additions, and why there are so many of them
 *
 * Twelve fields arrive with TAX-33, which is more than any earlier phase added
 * at once, and the reason is what Form 6251 is: a **parallel tax system**. It
 * does not read one figure off the 1040 and adjust it — it recomputes taxable
 * income from adjusted gross income, the deduction total, the deduction's
 * COMPOSITION (Schedule A line 7 versus line 12e, which decide the
 * standard-deduction add-back), Schedule 1-A line 37, and the stored Forms
 * 3921; then it compares the result against the regular tax, which needs 1040
 * line 16 and Schedule 3 line 1. A form that recomputes a return needs a
 * return's worth of inputs.
 *
 * Three of the twelve are not amounts at all — `itemizing`,
 * `aStoredNineteenNineBReportsASale` and `filingScheduleD` — and each answers
 * a yes/no question the printed form asks: which line feeds line 2a, whether
 * the same-year ISO disposition rule makes the spread unknowable, and whether
 * capital gain distributions reached 1040 line 7 directly.
 *
 * **`scheduleThreeLine1Cents` is deliberately NOT among them, and there is a
 * cycle behind that.** Form 6251 line 10 subtracts Schedule 3 line 1, the
 * foreign tax credit; `fjs/schedule/3` runs AFTER this module in
 * `fjs/form1040/core`, because its own Credit Limit Worksheet reads 1040 line
 * 18, which is line 16 plus THIS schedule's line 3. The printed forms are
 * genuinely circular there. It is resolvable today only because
 * `foreignTaxCredit` is a refused `fjs/return/scope` kind, so Schedule 3 line
 * 1 is a documented zero for every return this engine computes — and
 * `theForeignTaxCreditCycleIsResolvedByARefusal` is the leaf that says so as a
 * checked claim rather than a comment, so the day that kind is modeled this
 * module fails and somebody has to break the cycle properly.
 * @typedef {{
 *   readonly profile: Stored<ReturnProfile>,
 *   readonly status: IndividualFilingStatus,
 *   readonly medicareWages: ReportLine,
 *   readonly medicareTaxWithheld: ReportLine,
 *   readonly taxableInterest: ReportLine,
 *   readonly ordinaryDividends: ReportLine,
 *   readonly netCapitalGainOrLoss: ReportLine,
 *   readonly adjustedGrossIncome: ReportLine,
 *   readonly selfEmployment: SelfEmploymentOutcome,
 *   readonly qualifiedDividends: ReportLine,
 *   readonly totalDeductions: ReportLine,
 *   readonly regularTax: ReportLine,
 *   readonly itemizing: boolean,
 *   readonly scheduleALine7Cents: bigint,
 *   readonly scheduleOneALine37Cents: bigint,
 *   readonly standardDeductionCents: bigint,
 *   readonly isoExerciseForms: readonly Stored<FormThirtyNineTwentyOne>[],
 *   readonly aStoredNineteenNineBReportsASale: boolean,
 *   readonly filingScheduleD: boolean,
 *   readonly scheduleD15Cents: bigint,
 *   readonly scheduleD16Cents: bigint,
 * }} ScheduleTwoInput
 */

/**
 * All four Part I fields (`line1`/`line1z` being the 1a-1z collapse) and
 * eighteen Part II fields (lines 4 through 21, `line17`/`line18` being the
 * 17a-17z collapse). Every field is a {@link ReportLine}.
 *
 * `form8959` and `form8960` are the two forms' OWN line records, carried out
 * alongside the schedule's lines rather than recomputed by anyone else.
 * `fjs/form1040/core` reads `form8959.line24` off this result for 1040 line
 * 25c, so the tax on line 11 and the withholding credited against it can
 * never come from two different executions — the same reason Schedule 8812's
 * lines 14 and 27 come out of one `form8812Outcome` (13-CONTEXT.md Decision
 * 4.3). They are NOT `ReportLine`s: they are the printed forms' own
 * intermediate lines, and only the figures that reach a 1040 or Schedule 2
 * line carry provenance.
 * `form6251` joins them as of Phase 29, and it is the one that can also make
 * this whole schedule REFUSE — see {@link ScheduleTwoOutcome}.
 * @typedef {{
 *   readonly kind: 'ok',
 *   readonly line1: ReportLine, readonly line1z: ReportLine, readonly line2: ReportLine,
 *   readonly line3: ReportLine,
 *   readonly line4: ReportLine, readonly line5: ReportLine, readonly line6: ReportLine,
 *   readonly line7: ReportLine, readonly line8: ReportLine, readonly line9: ReportLine,
 *   readonly line10: ReportLine, readonly line11: ReportLine, readonly line12: ReportLine,
 *   readonly line13: ReportLine, readonly line14: ReportLine, readonly line15: ReportLine,
 *   readonly line16: ReportLine, readonly line17: ReportLine, readonly line18: ReportLine,
 *   readonly line19: ReportLine, readonly line20: ReportLine, readonly line21: ReportLine,
 *   readonly form8959: Form8959,
 *   readonly form8960: Form8960,
 *   readonly form6251: Form6251Ok,
 * }} ScheduleTwo
 */

/**
 * Form 6251's own graceful refusal, threaded through VERBATIM — this module
 * does not build its own refusal shape and computes no line once Form 6251
 * refuses. The same treatment `fjs/schedule/d` gives `fjs/form8949`'s.
 *
 * **This schedule could not refuse at all before Phase 29**, which is why the
 * `kind` discriminant is new on {@link ScheduleTwo} too. Two of its three
 * refusals are the AMT's own (the same-year incentive stock option disposition
 * and Form 6251 Part III) and the third is a Form 3921 missing a box; all
 * three are document-data-sufficiency problems, so none names an
 * `fjs/return/scope` kind and `fjs/form1040/core` threads them with
 * `unmodeled: []`.
 * @typedef {{ readonly kind: 'error', readonly message: string }} ScheduleTwoError
 */

/** @typedef {ScheduleTwo | ScheduleTwoError} ScheduleTwoOutcome */

/**
 * Computes Schedule 2 for one return.
 *
 * Lines 11 and 12 are real Form 8959 and Form 8960 figures; every other line
 * is `value: 0n` citing the profile's own `declaredKinds` box, because this
 * engine models none of the twelve remaining Schedule 2 kinds — see this
 * module's own docstring for why that is the honest, complete answer.
 * @type {(taxParamSet: TaxParamSet) => (input: ScheduleTwoInput) => ScheduleTwoOutcome}
 */
export const scheduleTwo = taxParamSet => input => {
    const {
        profile, status,
        medicareWages, medicareTaxWithheld,
        taxableInterest, ordinaryDividends, netCapitalGainOrLoss, adjustedGrossIncome,
        selfEmployment,
        qualifiedDividends, totalDeductions, regularTax,
        itemizing, scheduleALine7Cents, scheduleOneALine37Cents, standardDeductionCents,
        isoExerciseForms, aStoredNineteenNineBReportsASale,
        filingScheduleD, scheduleD15Cents, scheduleD16Cents,
    } = input
    const zero = profileDeclaredZeroLine(profile)
    // The two facts Schedule SE actually read, unioned wherever a line on
    // this schedule depends on that form -- lines 4 and 11 both do.
    const selfEmploymentSources = [selfEmployment.netProfit, selfEmployment.socialSecurityWages]

    // ── Part I: Tax ───────────────────────────────────────────────────────
    // 1a-1z. Excess advance premium tax credit repayment, clean-vehicle-
    // credit repayments, EPE recapture -- a collapsed stand-in; see this
    // module's own docstring.
    const line1 = zero('Schedule 2 line 1 (excess APTC repayment/clean-vehicle-credit repayments/EPE recapture, 1a-1z collapsed)')
    // 1z. "Total. Add lines 1a through 1z" -- the SAME total, restated.
    const line1z = { ...line1, rule: 'Schedule 2 line 1z (total)' }
    // 2. "Alternative minimum tax. Attach Form 6251." Part II line 11 -- the
    //    EXCESS of the tentative minimum tax over the regular tax, and only
    //    the excess. Computed UNCONDITIONALLY, exactly as lines 4, 11 and 12
    //    are: the AMT is not elective, and a declaration gate here would let a
    //    truthful filer who never heard of Form 6251 receive a return with
    //    this line at zero -- which is the understatement `fjs/return/tripwire`
    //    now also watches for, from the other side, on a stored Form 3921.
    //
    //    Line 1z is passed to Form 6251 line 10, and the ORDER above is why:
    //    the printed Form 6251 adds Schedule 2 line 1z to the regular tax
    //    before comparing, so line 1z has to exist before line 2 is computed.
    //    This is not circular -- line 2 is not an input to line 1z -- but it
    //    is the reason the AMT sits on line 2 rather than line 1 on the TY2025
    //    form, and `fjs/form6251`'s own docstring records the check.
    const form6251Result = form6251(taxParamSet)({
        status,
        adjustedGrossIncomeCents: adjustedGrossIncome.value,
        totalDeductionsCents: totalDeductions.value,
        scheduleOneALine37Cents,
        itemizing,
        scheduleALine7Cents,
        standardDeductionCents,
        isoExerciseForms,
        aStoredNineteenNineBReportsASale,
        regularTaxCents: regularTax.value,
        scheduleTwoLine1zCents: line1z.value,
        // The foreign tax credit, and the cycle this module's own
        // `ScheduleTwoInput` docstring argues: `fjs/schedule/3` runs after
        // this module because its Credit Limit Worksheet reads 1040 line 18,
        // which is line 16 plus this schedule's line 3. A documented zero,
        // correct only because `foreignTaxCredit` is a refused kind.
        scheduleThreeLine1Cents: 0n,
        qualifiedDividendsCents: qualifiedDividends.value,
        // 1040 line 7a, which IS the capital gain distributions when no
        // Schedule D was filed -- the same field `fjs/tax/line16`'s dispatcher
        // is handed for the identical printed condition.
        capitalGainDistributionsCents: netCapitalGainOrLoss.value,
        filingScheduleD,
        scheduleD15Cents,
        scheduleD16Cents,
    })
    if (form6251Result.kind === 'error') {
        // Threaded VERBATIM -- the SAME shaped refusal, no new
        // `fjs/return/scope` kind, no line below this point computed.
        return { kind: 'error', message: form6251Result.message }
    }
    /** @type {readonly Source[]} */
    const isoSources = isoExerciseForms.flatMap(form => {
        const fairMarketValue = form.value.box4FairMarketValuePerShareOnExerciseDate
        return fairMarketValue === undefined
            ? []
            : [{
                documentHash: form.documentHash,
                boxPath: 'box4FairMarketValuePerShareOnExerciseDate',
                value: fairMarketValue,
            }]
    })
    // Every fact the comparison actually reads: the profile (so a return with
    // no AMT still names the declaration the way every other zero line on this
    // schedule does), the adjusted gross income and deduction total that make
    // up alternative minimum taxable income, the regular tax it is measured
    // against, and one citation per Form 3921 whose spread reached line 2i.
    //
    // The Form 3921 citations are APPENDED rather than unioned, because
    // `unionSources` takes `ReportLine`s and a Form 3921 box is not a report
    // line -- and no deduplication is lost: a `(documentHash, boxPath)` pair
    // naming a Form 3921 cannot collide with one naming a 1040 line.
    const line2LineSources = unionSources([
        zero('Schedule 2 line 2 (alternative minimum tax, Form 6251 line 11)'),
        adjustedGrossIncome, totalDeductions, regularTax,
    ])
    /** @type {readonly [Source, ...(readonly Source[])]} */
    const line2Sources = [line2LineSources[0], ...line2LineSources.slice(1), ...isoSources]
    const line2 = {
        value: form6251Result.line11,
        sources: line2Sources,
        rule: 'Schedule 2 line 2 (alternative minimum tax, Form 6251 line 11)',
    }
    // 3. "Add lines 1z and 2." -> 1040 line 17.
    const line3 = totalLine('Schedule 2 line 3 (total tax -> 1040 line 17)')([line1z, line2])

    // ── Part II: Other Taxes ─────────────────────────────────────────────
    // 4. "Self-employment tax. Attach Schedule SE." Schedule SE Part I line
    //    12, off the execution `fjs/schedule/1` already performed -- see this
    //    module's own `ScheduleTwoInput` docstring for why the whole result
    //    travels rather than a bare figure. Read UNCONDITIONALLY, exactly as
    //    lines 11 and 12 are: self-employment tax is NOT elective, so gating
    //    it on a declaration would let a truthful filer who declared only
    //    `businessIncomeOrLoss` receive a return with this line at zero --
    //    which is precisely the ~$7,000 understatement `fjs/schedule/c`'s
    //    Phase 27 refusal existed to prevent, reintroduced at a different
    //    layer.
    //
    //    On a return with no business the sources dedup to the profile's own
    //    `declaredKinds` box, because BOTH inputs are then
    //    `profileDeclaredZeroLine`s -- which is what keeps this line
    //    byte-identical to the documented zero it was before this phase.
    const line4 = {
        value: selfEmployment.lines.line12,
        sources: unionSources(selfEmploymentSources),
        rule: 'Schedule 2 line 4 (self-employment tax, Schedule SE line 12)',
    }
    const line5 = zero('Schedule 2 line 5 (Social Security/Medicare tax on unreported tips)')
    const line6 = zero('Schedule 2 line 6 (uncollected Social Security/Medicare tax on wages)')
    // 7. "Add lines 5 and 6."
    const line7 = totalLine('Schedule 2 line 7')([line5, line6])
    const line8 = zero('Schedule 2 line 8 (additional tax on IRAs/other tax-favored accounts)')
    const line9 = zero('Schedule 2 line 9 (household employment taxes, Schedule H)')
    // 10. "Reserved for future use" -- the form's own inert line; see this
    //     module's own docstring.
    const line10 = zero('Schedule 2 line 10 (reserved for future use)')
    // 11. "Additional Medicare Tax. Attach Form 8959." Part IV's line 18 --
    //     the WHOLE form's total, so a future non-zero Part II or III
    //     reaches this line without another edit here. Computed
    //     UNCONDITIONALLY; see this module's own docstring for why that is
    //     observationally identical to gating it on the declaration, and for
    //     the tripwire that makes it so.
    const form8959Result = form8959(taxParamSet)({
        status,
        medicareWagesCents: medicareWages.value,
        medicareTaxWithheldCents: medicareTaxWithheld.value,
        // Part II line 8 -- Schedule SE Part I line 6, net earnings from
        // self-employment. Phase 23 wrote Part II's threshold coordination
        // against a permanent zero here and said so; this is the argument
        // that makes it bite.
        selfEmploymentIncomeCents: selfEmployment.lines.line6,
    })
    const line11 = {
        value: form8959Result.line18,
        // Box 6 is cited even though it feeds only Part V, which does NOT
        // reach this line: an auditor reading line 11 has to be able to see
        // that the same execution produced 1040 line 25c's credit, since the
        // two are meaningless apart. The two Schedule SE facts are cited as
        // of Phase 28, because Part II line 8 now reads that form.
        sources: unionSources([medicareWages, medicareTaxWithheld, ...selfEmploymentSources]),
        rule: 'Schedule 2 line 11 (Additional Medicare Tax, Form 8959 line 18)',
    }
    // 12. "Net investment income tax. Attach Form 8960." Part III line 17.
    //     Also unconditional -- and here that is NOT merely equivalent to
    //     gating it, because no tripwire watches §1411's threshold.
    const form8960Result = form8960(taxParamSet)({
        status,
        agiCents: adjustedGrossIncome.value,
        taxableInterestCents: taxableInterest.value,
        ordinaryDividendsCents: ordinaryDividends.value,
        netCapitalGainOrLossCents: netCapitalGainOrLoss.value,
    })
    const line12 = {
        value: form8960Result.line17,
        // Every fact the "lesser of" comparison reads: the three investment
        // incomes that make up Part I line 8, and the AGI that makes up Part
        // III line 13. 1040 line 2a is deliberately NOT among them -- see
        // `fjs/form8960`'s own docstring on why tax-exempt interest is
        // excluded, and `theExclusionsAreWired` below, which pins it.
        sources: unionSources([taxableInterest, ordinaryDividends, netCapitalGainOrLoss, adjustedGrossIncome]),
        rule: 'Schedule 2 line 12 (net investment income tax, Form 8960 line 17)',
    }
    const line13 = zero('Schedule 2 line 13 (uncollected Social Security/Medicare/RRTA tax on tips or group-term life insurance)')
    const line14 = zero('Schedule 2 line 14 (interest on tax due on installment income from certain residential lots and timeshares)')
    const line15 = zero('Schedule 2 line 15 (interest on the deferred tax on certain installment sales over $150,000)')
    const line16 = zero('Schedule 2 line 16 (recapture of low-income housing credit)')
    // 17a-17z. "Other additional taxes" -- a collapsed stand-in; see this
    // module's own docstring.
    const line17 = zero('Schedule 2 line 17 (other additional taxes, 17a-17z collapsed)')
    // 18. "Total additional taxes. Add lines 17a through 17z." -- the SAME
    //     total, restated.
    const line18 = { ...line17, rule: 'Schedule 2 line 18 (total additional taxes)' }
    const line19 = zero('Schedule 2 line 19 (reconciliation of premium tax credit / excess advance payment recapture)')
    const line20 = zero('Schedule 2 line 20 (section 965 net tax liability installment from Form 965-A)')
    // 21. "Add lines 4, 7 through 16, and 18 and 19." -> 1040 line 23.
    // Per 13-RESEARCH.md §5's own transcription, line 20 (the section 965
    // installment) is NOT summed into line 21 -- it is a memo entry on the
    // printed face, not an addend.
    const line21 = totalLine('Schedule 2 line 21 (total other taxes -> 1040 line 23)')([
        line4, line7, line8, line9, line10, line11, line12, line13, line14, line15, line16, line18, line19,
    ])

    return {
        kind: 'ok',
        line1, line1z, line2, line3,
        line4, line5, line6, line7, line8, line9, line10, line11, line12, line13,
        line14, line15, line16, line17, line18, line19, line20, line21,
        form8959: form8959Result,
        form8960: form8960Result,
        form6251: form6251Result,
    }
}

// ── Tests ────────────────────────────────────────────────────────────────────

/**
 * TY2025's parameter set, narrowed exactly once at module scope — the same
 * `assert` path every other consumer uses.
 */
const taxParams2025 = taxParamsByYear[2025]
assert(taxParams2025 !== undefined, 'expected TY2025 parameters to be present in taxParamsByYear')

/** @type {ReturnProfile} */
const minimalProfileValue = {
    dialect: 'vnd.fjs.return_profile',
    taxYear: 2025,
    filingStatus: 'single',
    dependentCount: 0,
    declaredKinds: [],
}

/** @type {Stored<ReturnProfile>} */
const profileNoDeclaredKinds = { documentHash: 'profile-hash-0001', value: minimalProfileValue }

/**
 * A {@link ReportLine} standing in for one already-computed 1040 line, with
 * a source naming the box it came off. Test-only: builds INPUTS, never an
 * expected value.
 * @type {(boxPath: string) => (cents: bigint) => ReportLine}
 */
const inputLine = boxPath => cents => ({
    value: cents,
    sources: [{ documentHash: `sha256-${boxPath}`, boxPath, value: 'see the box' }],
    rule: `input: ${boxPath}`,
})

/**
 * A {@link ReportLine} citing the profile's own `declaredKinds` box — which
 * is what a return with NO business really hands this module for both of
 * Schedule SE's inputs, since `fjs/schedule/c` and `fjs/schedule/se` both
 * fall back to `profileDeclaredZeroLine` when no document supplied a figure.
 * Using `inputLine` here instead would invent a document source that no such
 * return has, and `lineFourIsAComputedZeroThatStillCitesOnlyTheProfile` would
 * then be checking a fiction. Test-only: builds an INPUT.
 * @type {(rule: string) => ReportLine}
 */
const profileZeroInput = rule => ({
    value: 0n,
    sources: [{
        documentHash: profileNoDeclaredKinds.documentHash,
        boxPath: 'declaredKinds',
        value: '[]',
    }],
    rule,
})

/**
 * Schedule SE, run for REAL against TY2025's parameters, paired with the two
 * sourced facts it read — the shape `fjs/schedule/1` hands this module.
 *
 * The Schedule SE arithmetic is an INPUT here, never an expected value: every
 * assertion below states its own hand-computed cents.
 * @type {(netProfit: ReportLine) => (socialSecurityWages: ReportLine) => SelfEmploymentOutcome}
 */
const selfEmploymentInput = netProfit => socialSecurityWages => ({
    lines: scheduleSelfEmploymentPartI(taxParams2025)({
        netProfitCents: netProfit.value,
        socialSecurityWagesCents: socialSecurityWages.value,
    }),
    netProfit,
    socialSecurityWages,
})

/** A return with no business at all — both facts profile-cited zeros. */
const noSelfEmployment = selfEmploymentInput(
    profileZeroInput('Schedule C line 31'))(profileZeroInput('Schedule SE line 8a'))

/**
 * Every input zero, each still citing its own box — the base every fixture
 * below widens. Written out rather than defaulted, so a fixture that forgets
 * an input gets a zero with provenance rather than a `undefined`.
 * @type {ScheduleTwoInput}
 */
const noAmounts = {
    profile: profileNoDeclaredKinds,
    status: 'single',
    medicareWages: inputLine('box5MedicareWagesAndTips')(0n),
    medicareTaxWithheld: inputLine('box6MedicareTaxWithheld')(0n),
    taxableInterest: inputLine('line2b')(0n),
    ordinaryDividends: inputLine('line3b')(0n),
    netCapitalGainOrLoss: inputLine('line7a')(0n),
    adjustedGrossIncome: inputLine('line11b')(0n),
    selfEmployment: noSelfEmployment,
    qualifiedDividends: inputLine('line3a')(0n),
    totalDeductions: inputLine('line14')(0n),
    regularTax: inputLine('line16')(0n),
    itemizing: false,
    scheduleALine7Cents: 0n,
    scheduleOneALine37Cents: 0n,
    standardDeductionCents: 0n,
    isoExerciseForms: [],
    aStoredNineteenNineBReportsASale: false,
    filingScheduleD: false,
    scheduleD15Cents: 0n,
    scheduleD16Cents: 0n,
}

/**
 * A stored Form 3921 with the three boxes the §56(b)(3) spread reads.
 * @type {(hash: string) => (exercisePrice: string) => (fairMarketValue: string) => (shares: string) => Stored<FormThirtyNineTwentyOne>}
 */
const isoForm = hash => exercisePrice => fairMarketValue => shares => ({
    documentHash: hash,
    value: {
        dialect: 'vnd.fjs.form3921',
        payerTin: '11-1111111',
        recipientTin: '222-22-2222',
        accountNumber: 'ACC-0001',
        taxYear: 2025,
        formRevision: 'April 2025',
        sourceArtifactHash: 'deadbeef00112233445566778899aabbccddeeff0011223344556677889900',
        box3ExercisePricePerShare: exercisePrice,
        box4FairMarketValuePerShareOnExerciseDate: fairMarketValue,
        box5NumberOfSharesTransferred: shares,
    },
})

/** Runs Schedule 2 against TY2025's real parameter set.
 * @type {(input: ScheduleTwoInput) => ScheduleTwo}
 */
const run = input => {
    const outcome = scheduleTwo(taxParams2025)(input)
    assert(outcome.kind === 'ok', ['expected ok', outcome])
    if (outcome.kind !== 'ok') {
        throw ['expected ok', outcome]
    }
    return outcome
}

/** Runs Schedule 2 and returns the whole outcome, refusals included.
 * @type {(input: ScheduleTwoInput) => ScheduleTwoOutcome}
 */
const runOutcome = input => scheduleTwo(taxParams2025)(input)

export const proof = {
    // THE REGRESSION CONTROL, and it is the first leaf on purpose. A return
    // with no amounts anywhere still produces $0.00 on BOTH totals, citing
    // the profile — which is what every fixture that existed before Phase 23
    // relies on. Plan 13-12's own acceptance criterion, unchanged.
    noAmountsGivesZeroOnBothTotals: () => {
        const result = run(noAmounts)
        assertEq(result.line3.value, 0n, 'line 3 = $0.00 -> 1040 line 17')
        assertEq(result.line21.value, 0n, 'line 21 = $0.00 -> 1040 line 23')
        assertEq(result.line3.sources[0].boxPath, 'declaredKinds')
    },
    // Every line that is STILL a documented zero is one, and each still cites
    // the profile's `declaredKinds` box and NOTHING else. Hand-typed, in
    // printed order, rather than derived by excluding lines 11 and 12 from
    // `Object.keys(result)`: a list computed from the thing under test could
    // never notice a twentieth line quietly acquiring a document source.
    //
    // SIX of the twenty-two printed lines are absent from this list. Lines
    // 11 and 12 cite the boxes their forms read. Line 4 is Phase 28's own
    // removal — it is a COMPUTED zero for this fixture rather than a declared
    // one, and it gets its own leaf immediately below because "cites only the
    // profile" is still true of it for a different and more fragile reason.
    // **Lines 2 and 3 are Phase 29's own removal**, and unlike line 4 they do
    // NOT dedup back to one citation: Form 6251 reads the adjusted gross
    // income, the deduction total and the regular tax on every return, so line
    // 2 cites all three even when the AMT is $0.00, and line 3 (its total with
    // line 1z) therefore does too. Both keep their own leaves below.
    // Line 21 is the Part II TOTAL, so its `sources` union necessarily
    // includes theirs — it is asserted separately too, because "still $0.00"
    // and "still cites only the profile" have come apart for it and only the
    // first is still true.
    sixteenLinesAreStillDeclaredZerosCitingOnlyTheProfile: () => {
        const result = run(noAmounts)
        /** @type {readonly ReportLine[]} */
        const declaredZeroLines = [
            result.line1, result.line1z,
            result.line5, result.line6, result.line7,
            result.line8, result.line9, result.line10,
            result.line13, result.line14, result.line15, result.line16,
            result.line17, result.line18, result.line19, result.line20,
        ]
        assertEq(
            declaredZeroLines.length, 16,
            'twenty-two printed lines, less lines 2, 3, 4, 11, 12 and the line 21 total')
        for (const line of declaredZeroLines) {
            assertEq(line.value, 0n, ['expected a declared zero', line.rule])
            assertEq(line.sources.length, 1, ['expected exactly one citation', line.rule])
            assertEq(line.sources[0].documentHash, profileNoDeclaredKinds.documentHash, line.rule)
            assertEq(line.sources[0].boxPath, 'declaredKinds', line.rule)
        }
        // Line 21: still $0.00, still citing the profile FIRST -- and now
        // also citing the four facts Form 8960 read and the two Form 8959
        // read, because it genuinely depends on them.
        assertEq(result.line21.value, 0n, 'line 21 = $0.00')
        assertEq(result.line21.sources[0].boxPath, 'declaredKinds', 'line 21 still cites the profile first')
        const line21Boxes = result.line21.sources.map(source => source.boxPath)
        for (const box of ['box5MedicareWagesAndTips', 'line2b', 'line11b']) {
            assert(
                line21Boxes.includes(box),
                ['the Part II total must cite the facts lines 11 and 12 read', box, line21Boxes],
            )
        }
    },
    // The 1a-1z/1z and 17a-17z/18 collapse-and-restate idiom.
    line1zRestatesLine1AndLine18RestatesLine17: () => {
        const result = run(noAmounts)
        assertEq(result.line1z.value, result.line1.value)
        assertEq(result.line1z.sources[0].boxPath, result.line1.sources[0].boxPath)
        assert(result.line1z.rule !== result.line1.rule, 'line1z and line1 must carry DIFFERENT rule strings')
        assertEq(result.line18.value, result.line17.value)
        assertEq(result.line18.sources[0].boxPath, result.line17.sources[0].boxPath)
        assert(result.line18.rule !== result.line17.rule, 'line18 and line17 must carry DIFFERENT rule strings')
    },
    // Hand-typed field-count guard, per this project's mutation-gate idiom.
    // `22 -> 24` is Phase 23's own two additions: the two forms' own line
    // records travel out beside the twenty-two printed lines, so 1040 line
    // 25c reads the SAME Form 8959 execution line 11 did.
    everyPrintedLineIsNamed: () => {
        const result = run(noAmounts)
        // 22 printed lines, plus the THREE forms' own records (8959, 8960,
        // 6251), plus the `kind` discriminant Phase 29 added when this
        // schedule became able to refuse.
        const expectedFieldCount = 26
        assertEq(
            Object.keys(result).length,
            expectedFieldCount,
            'expected exactly 22 named Schedule 2 lines, three form records and the discriminant',
        )
    },
    dialectIndependence: () => {
        const result = run(noAmounts)
        assert(!('dialect' in result), 'scheduleTwo output must not carry a dialect tag')
        assert(!('mediaType' in result), 'scheduleTwo output must not carry a mediaType')
    },
    line4: {
        // THE REGRESSION PROPERTY PHASE 28 RESTS ON. A return with no
        // business hands this module two `profileDeclaredZeroLine`s, their
        // union deduplicates to ONE source, and line 4 is therefore
        // indistinguishable from the documented zero it was before this
        // phase — same value, same single citation, same box path. Only the
        // `rule` string changed, and that is asserted too so the change is
        // visible rather than silent.
        lineFourIsAComputedZeroThatStillCitesOnlyTheProfile: () => {
            const result = run(noAmounts)
            assertEq(result.line4.value, 0n, 'line 4 = $0.00')
            assertEq(result.line4.sources.length, 1, 'the two profile zeros dedup to one citation')
            assertEq(result.line4.sources[0].documentHash, profileNoDeclaredKinds.documentHash)
            assertEq(result.line4.sources[0].boxPath, 'declaredKinds')
            assert(
                result.line4.rule.includes('Schedule SE line 12'),
                ['the rule must name the form line it implements', result.line4.rule])
            assertEq(result.line21.value, 0n, 'and nothing reaches 1040 line 23')
        },
        // THE FOUNDER'S RETURN, at the schedule. A $50,000.00 Schedule C net
        // profit and no wages: Schedule SE line 12 is $7,064.78 (92.35% of
        // $50,000 is $46,175.00; 12.4% of it is $5,725.70 and 2.9% is
        // $1,339.08), and it reaches line 21 -> 1040 line 23 rather than
        // stopping at line 4. Hand-computed; the Schedule SE arithmetic is an
        // input here, never the expected value.
        aFiftyThousandDollarProfitReachesLineTwentyOne: () => {
            const result = run({
                ...noAmounts,
                selfEmployment: selfEmploymentInput(
                    inputLine('entries[Schedule C line 31]')(5000000n))(
                    profileZeroInput('Schedule SE line 8a')),
            })
            assertEq(result.line4.value, 706478n, 'line 4 = $7,064.78')
            assertEq(result.line21.value, 706478n, 'line 21 = $7,064.78 -> 1040 line 23')
            // …and NOT through Part I: self-employment tax is a Part II tax.
            assertEq(result.line3.value, 0n, 'line 3 = $0.00 -- 1040 line 17 is untouched')
            // Provenance: the two facts Schedule SE read, and the Schedule C
            // one is the one an auditor needs first.
            const boxes = result.line4.sources.map(source => source.boxPath)
            assert(
                boxes.includes('entries[Schedule C line 31]'),
                ['line 4 must cite the net profit it taxed', boxes])
        },
        // Line 4 is Schedule SE line 12, asserted as an identity against the
        // record that produced it -- so a wiring that read line 10, line 11
        // or the deductible half instead would name itself. Each of those
        // three is a real number on the same record, and each is WRONG here.
        lineFourIsScheduleSeLineTwelveAndNoNeighbouringLine: () => {
            const selfEmployment = selfEmploymentInput(
                inputLine('entries[Schedule C line 31]')(5000000n))(
                profileZeroInput('Schedule SE line 8a'))
            const result = run({ ...noAmounts, selfEmployment })
            assertEq(result.line4.value, selfEmployment.lines.line12, 'line 4 is Schedule SE line 12')
            assert(
                result.line4.value !== selfEmployment.lines.line10,
                ['line 4 is not the Social Security portion alone', selfEmployment.lines.line10])
            assert(
                result.line4.value !== selfEmployment.lines.line11,
                ['line 4 is not the Medicare portion alone', selfEmployment.lines.line11])
            assert(
                result.line4.value !== selfEmployment.lines.line13,
                ['line 4 is the TAX, not the deductible half', selfEmployment.lines.line13])
        },
        // Self-employment tax is read UNCONDITIONALLY, exactly as lines 11
        // and 12 are. The profile below declares NOTHING at all -- not even
        // `businessIncomeOrLoss` -- and the tax still lands, because
        // self-employment tax is not elective and a declaration gate here
        // would reintroduce the ~$7,000 understatement `fjs/schedule/c`'s
        // Phase 27 refusal existed to prevent.
        theTaxIsNotGatedOnADeclaration: () => {
            const result = run({
                ...noAmounts,
                profile: { documentHash: 'profile-hash-0003', value: { ...minimalProfileValue, declaredKinds: [] } },
                selfEmployment: selfEmploymentInput(
                    inputLine('entries[Schedule C line 31]')(5000000n))(
                    profileZeroInput('Schedule SE line 8a')),
            })
            assertEq(result.line4.value, 706478n, 'the tax lands on an undeclared return too')
        },
    },
    line2: {
        // A return with NO preference items: line 2 is $0.00 and 1040 line 17
        // is untouched. Criterion 5, at the schedule.
        //
        // What DID change is the provenance, and it changed for a reason
        // rather than by accident: Form 6251 reads the adjusted gross income,
        // the deduction total and the regular tax on EVERY return, so line 2
        // cites all three even at $0.00. Line 4's own dedup-to-one property
        // (below) does not carry over here, and pretending it did would mean
        // asserting a citation list that is not what an auditor would find.
        lineTwoIsAComputedZeroThatCitesWhatTheComparisonRead: () => {
            const result = run(noAmounts)
            assertEq(result.line2.value, 0n, 'line 2 = $0.00')
            assertEq(result.line3.value, 0n, 'line 3 = $0.00 -> 1040 line 17')
            const boxes = result.line2.sources.map(source => source.boxPath)
            assertEq(boxes[0], 'declaredKinds', 'the profile is still cited first')
            for (const box of ['line11b', 'line14', 'line16']) {
                assert(
                    boxes.includes(box),
                    ['line 2 must cite every fact the comparison read', box, boxes])
            }
            assert(
                result.line2.rule.includes('Form 6251 line 11'),
                ['the rule must name the form line it implements', result.line2.rule])
        },
        // THE FAANG RETURN, at the schedule, and the whole vertical slice in
        // one leaf: a stored Form 3921 reaches Form 6251 line 2i, which
        // reaches Schedule 2 line 2, which reaches line 3 and thence 1040 line
        // 17 -- and NOT line 21, because the AMT is a Part I tax.
        //
        // 10,000 shares, a $5.00 strike, a $105.00 fair market value, a
        // $250,000.00 salary and a $55,000.00 regular tax. Every figure
        // hand-computed in `fjs/form6251`'s own leaf of the same name; the
        // arithmetic is an INPUT here and only the routing is the claim.
        aStoredFormThreeNineTwoOneReachesLineTwoAndThenceLineThree: () => {
            const result = run({
                ...noAmounts,
                adjustedGrossIncome: inputLine('line11b')(25000000n),
                totalDeductions: inputLine('line14')(1575000n),
                standardDeductionCents: 1575000n,
                regularTax: inputLine('line16')(5500000n),
                isoExerciseForms: [isoForm('doc-iso-sched-2')('5.00')('105.00')('10000')],
            })
            assertEq(result.form6251.line2i, 100000000n, 'the spread reached Form 6251 line 2i')
            assertEq(result.line2.value, 29021800n, 'line 2 = $290,218.00')
            assertEq(result.line3.value, 29021800n, 'line 3 = $290,218.00 -> 1040 line 17')
            // …and NOT through Part II: the AMT is a Part I tax, so 1040 line
            // 23 must be untouched.
            assertEq(result.line21.value, 0n, 'line 21 = $0.00 -- the AMT is not an "other tax"')
            // Provenance: the Form 3921 itself is cited, so an auditor reading
            // line 2 can see which document put the tax there.
            const boxes = result.line2.sources.map(source => source.boxPath)
            assert(
                boxes.includes('box4FairMarketValuePerShareOnExerciseDate'),
                ['line 2 must cite the Form 3921 whose spread it taxed', boxes])
            const hashes = result.line2.sources.map(source => source.documentHash)
            assert(hashes.includes('doc-iso-sched-2'), ['by hash, too', hashes])
        },
        // Line 2 is Form 6251 line 11, asserted as an identity against the
        // record that produced it -- so a wiring that read line 7 (the
        // tentative minimum tax) or line 9 instead would name itself. Each of
        // those is a real, LARGER number on the same record.
        lineTwoIsFormSixTwoFiveOneLineElevenAndNoNeighbouringLine: () => {
            const result = run({
                ...noAmounts,
                adjustedGrossIncome: inputLine('line11b')(25000000n),
                totalDeductions: inputLine('line14')(1575000n),
                standardDeductionCents: 1575000n,
                regularTax: inputLine('line16')(5500000n),
                isoExerciseForms: [isoForm('doc-iso-identity')('5.00')('105.00')('10000')],
            })
            assertEq(result.line2.value, result.form6251.line11, 'line 2 is Form 6251 line 11')
            assert(
                result.line2.value !== result.form6251.line7,
                ['line 2 is the AMT, not the tentative minimum tax', result.form6251.line7])
            assert(
                result.line2.value !== result.form6251.line9,
                ['nor line 9, which is the same figure less a zero credit', result.form6251.line9])
            assert(
                result.line2.value !== result.form6251.line4,
                ['nor alternative minimum taxable income itself', result.form6251.line4])
        },
        // Form 6251 line 10 reads THIS schedule's line 1z, which is why the
        // AMT sits on line 2 rather than line 1 on the TY2025 form. Line 1z is
        // a documented zero for every return this engine computes, so the
        // wiring is exercised by asserting the FIELD rather than a non-zero
        // figure -- and the day line 1a-1z computes, this leaf is where the
        // dependency is already written down.
        formSixTwoFiveOneLineTenReadsThisSchedulesOwnLineOneZ: () => {
            const result = run({
                ...noAmounts,
                regularTax: inputLine('line16')(5500000n),
            })
            assertEq(result.line1z.value, 0n, 'line 1z is a documented zero today')
            assertEq(
                result.form6251.line10, 5500000n + result.line1z.value,
                'Form 6251 line 10 = 1040 line 16 plus Schedule 2 line 1z')
        },
        // The AMT is read UNCONDITIONALLY, exactly as lines 4, 11 and 12 are.
        // The profile below declares NOTHING at all, and the tax still lands:
        // the alternative minimum tax is not elective, and a declaration gate
        // here would let a truthful filer who never heard of Form 6251 receive
        // a return understating their tax by six figures.
        theTaxIsNotGatedOnADeclaration: () => {
            const result = run({
                ...noAmounts,
                profile: { documentHash: 'profile-hash-0029', value: { ...minimalProfileValue, declaredKinds: [] } },
                adjustedGrossIncome: inputLine('line11b')(25000000n),
                totalDeductions: inputLine('line14')(1575000n),
                standardDeductionCents: 1575000n,
                regularTax: inputLine('line16')(5500000n),
                isoExerciseForms: [isoForm('doc-iso-undeclared')('5.00')('105.00')('10000')],
            })
            assertEq(result.line2.value, 29021800n, 'the tax lands on an undeclared return too')
        },
        // Form 6251's refusals thread through this schedule VERBATIM, and the
        // whole schedule refuses rather than computing part of itself.
        aFormSixTwoFiveOneRefusalPropagatesVerbatim: () => {
            const outcome = runOutcome({
                ...noAmounts,
                adjustedGrossIncome: inputLine('line11b')(25000000n),
                totalDeductions: inputLine('line14')(1575000n),
                standardDeductionCents: 1575000n,
                regularTax: inputLine('line16')(5500000n),
                isoExerciseForms: [isoForm('doc-iso-sold-2')('5.00')('105.00')('10000')],
                aStoredNineteenNineBReportsASale: true,
            })
            assertEq(outcome.kind, 'error', ['expected the refusal to propagate', outcome])
            if (outcome.kind !== 'error') {
                throw ['expected error', outcome]
            }
            assert(
                outcome.message.includes('doc-iso-sold-2'),
                ['the propagated refusal must still name the document', outcome.message])
            assert(
                outcome.message.includes('Form 6251 line 2i'),
                ['and still name the line it could not compute', outcome.message])
        },
        // THE CYCLE, as a checked claim rather than a comment. Form 6251 line
        // 10 subtracts Schedule 3 line 1, and `fjs/schedule/3` runs AFTER this
        // module because its Credit Limit Worksheet reads 1040 line 18 = line
        // 16 + this schedule's line 3. Passing $0.00 is correct only because
        // `foreignTaxCredit` is a refused scope kind; the day it is modeled,
        // this leaf reddens and the cycle has to be broken properly.
        theForeignTaxCreditCycleIsResolvedByARefusal: () => {
            const result = run({ ...noAmounts, regularTax: inputLine('line16')(5500000n) })
            assertEq(
                result.form6251.line10, 5500000n,
                'line 10 is the regular tax alone: nothing was subtracted for a foreign tax credit')
            // Widened to `readonly string[]` by an ordinary ASSIGNMENT, not a
            // cast: `modeledKinds` is a literal tuple, so asking it directly
            // whether it contains 'foreignTaxCredit' is a question `tsc`
            // answers at compile time (TS2367, "no overlap") rather than one
            // this leaf can ask at run time. Same device, same reason, as
            // `fjs/return/scope`'s own `modeledKindNames`.
            /** @type {readonly string[]} */
            const modeledKindNames = modeledKinds
            assert(
                !modeledKindNames.includes('foreignTaxCredit'),
                'Schedule 3 line 1 may be passed as zero only while the foreign tax credit is refused')
        },
    },
    line11: {
        // THE PHASE'S MOTIVATING FIGURE, at the schedule. A single filer with
        // $300,000 in box 5: $100,000 of excess wages at 0.9% = $900.00,
        // hand-computed, and it reaches line 21 (-> 1040 line 23) rather than
        // stopping at line 11.
        threeHundredThousandOfMedicareWagesReachesLineTwentyOne: () => {
            const result = run({ ...noAmounts, medicareWages: inputLine('box5MedicareWagesAndTips')(30000000n) })
            assertEq(result.line11.value, 90000n, 'line 11 = $900.00 = 0.9% of $100,000.00')
            assertEq(result.line21.value, 90000n, 'line 21 = $900.00 -> 1040 line 23')
            // …and NOT through Part I: the Additional Medicare Tax is a Part
            // II tax, so 1040 line 17 must be untouched.
            assertEq(result.line3.value, 0n, 'line 3 = $0.00 -- line 11 is a Part II tax, not a Part I one')
        },
        // Line 11 carries Part IV's line 18, not Part I's line 7 -- so a
        // future non-zero self-employment or RRTA part reaches Schedule 2
        // without another edit here. Asserted as an identity against the
        // form's own record, which travels out beside the lines.
        lineElevenIsFormEightNineFiveNinesPartFourTotal: () => {
            const result = run({ ...noAmounts, medicareWages: inputLine('box5MedicareWagesAndTips')(30000000n) })
            assertEq(result.line11.value, result.form8959.line18, 'line 11 is Form 8959 line 18')
            assert(
                result.line11.rule.includes('Form 8959 line 18'),
                ['the rule must name the form line it implements', result.line11.rule],
            )
        },
        // Provenance: line 11 cites BOTH W-2 boxes the one Form 8959
        // execution read -- box 5 because it is the tax base, and box 6
        // because the same execution produced 1040 line 25c's credit and the
        // two are meaningless apart.
        lineElevenCitesBothMedicareBoxes: () => {
            const result = run({
                ...noAmounts,
                medicareWages: inputLine('box5MedicareWagesAndTips')(30000000n),
                medicareTaxWithheld: inputLine('box6MedicareTaxWithheld')(525000n),
            })
            const boxes = result.line11.sources.map(source => source.boxPath)
            assert(boxes.includes('box5MedicareWagesAndTips'), ['line 11 must cite box 5', boxes])
            assert(boxes.includes('box6MedicareTaxWithheld'), ['line 11 must cite box 6', boxes])
            // …and the withholding really did come out of the SAME execution.
            assertEq(result.form8959.line24, 90000n, 'Form 8959 line 24 = $900.00 -> 1040 line 25c')
        },
        // FORM 8959 PART II, WIRED — the leaf no proof inside `fjs/form8959`
        // can write, because that module only sees the figure it is handed.
        // This is what pins that Part II line 8 is Schedule SE line 6 rather
        // than line 12, line 4a, or Schedule C's own line 31.
        //
        // A single filer with a $300,000.00 Schedule C net profit and no
        // wages, every figure hand-computed:
        //
        //   Sch SE 4a  30,000,000 x 9235 / 10,000            $277,050.00
        //   Sch SE 6   = line 4a                             $277,050.00
        //   Sch SE 9   base 176,100.00 - 0.00                $176,100.00
        //   Sch SE 10  12.4% of $176,100.00 (the CAP binds)   $21,836.40
        //   Sch SE 11  2.9% of $277,050.00                     $8,034.45
        //   Sch SE 12  -> Schedule 2 line 4                   $29,870.85
        //   8959 8     = Sch SE line 6                       $277,050.00
        //   8959 11    threshold $200,000 - $0 of wages      $200,000.00
        //   8959 12    277,050.00 - 200,000.00                $77,050.00
        //   8959 13    0.9% of $77,050.00                        $693.45
        //   line 21    29,870.85 + 693.45                     $30,564.30
        partTwoOfFormEightNineFiveNineReadsScheduleSeLineSix: () => {
            const selfEmployment = selfEmploymentInput(
                inputLine('entries[Schedule C line 31]')(30000000n))(
                profileZeroInput('Schedule SE line 8a'))
            const result = run({ ...noAmounts, selfEmployment })
            assertEq(selfEmployment.lines.line6, 27705000n, 'Schedule SE line 6 = $277,050.00')
            assertEq(result.form8959.line8, 27705000n, 'Form 8959 line 8 IS Schedule SE line 6')
            assertEq(result.form8959.line11, 20000000n, 'line 11 = the whole $200,000 threshold')
            assertEq(result.form8959.line12, 7705000n, 'line 12 = $77,050.00')
            assertEq(result.form8959.line13, 69345n, 'line 13 = $693.45')
            assertEq(result.line11.value, 69345n, 'Schedule 2 line 11 = $693.45, all of it Part II')
            assertEq(result.form8959.line7, 0n, 'Part I charges nothing -- there are no wages')
            assertEq(result.line4.value, 2987085n, 'Schedule 2 line 4 = $29,870.85')
            assertEq(result.line21.value, 3056430n, 'line 21 = $30,564.30 = $29,870.85 + $693.45')
            // …and line 8 is Schedule SE line 6, NOT one of the neighbouring
            // figures a miswiring would plausibly reach for. Each of these is
            // a real number on the same record.
            assert(
                result.form8959.line8 !== selfEmployment.lines.line12,
                'line 8 is net EARNINGS, not the self-employment tax')
            assert(
                result.form8959.line8 !== selfEmployment.lines.line2,
                'line 8 is net earnings, not Schedule C line 31 before the 92.35% factor')
        },
        // THE TWO CEILINGS ARE DIFFERENT CEILINGS, shared by two different
        // rules — the thing most likely to be conflated by anyone reading
        // these two forms together. Wages of $150,000.00 and a $50,000.00 net
        // profit:
        //
        //   §1402(b)(1)'s wage base is $176,100 and box 3's $150,000 leaves
        //   $26,100 of it, so Schedule SE line 10 taxes $26,100 rather than
        //   the whole $46,175 of net earnings.
        //   §3101(b)(2)'s threshold is $200,000 and box 5's $150,000 leaves
        //   $50,000 of it, so Form 8959 line 12 taxes nothing at all —
        //   $46,175 of net earnings is under the $50,000 of head-room.
        //
        // Two ceilings, two boxes, two answers, one return.
        theWageBaseAndTheMedicareThresholdAreDifferentCeilings: () => {
            const result = run({
                ...noAmounts,
                medicareWages: inputLine('box5MedicareWagesAndTips')(15000000n),
                selfEmployment: selfEmploymentInput(
                    inputLine('entries[Schedule C line 31]')(5000000n))(
                    inputLine('box3SocialSecurityWages')(15000000n)),
            })
            assertEq(result.form8959.line11, 5000000n, '$50,000.00 of §3101(b)(2) head-room left')
            assertEq(result.form8959.line12, 0n, '$46,175.00 of net earnings fits inside it')
            assertEq(result.line11.value, 0n, 'Schedule 2 line 11 = $0.00')
            // …while the OTHER ceiling has already bitten: 12.4% of the
            // $26,100.00 of wage base left, plus 2.9% of the whole
            // $46,175.00, is $3,236.40 + $1,339.08 = $4,575.48.
            assertEq(result.line4.value, 457548n, 'Schedule 2 line 4 = $4,575.48')
            assertEq(result.line21.value, 457548n, 'line 21 = $4,575.48')
        },
    },
    line12: {
        // A single filer with $300,000 of AGI and $40,000 of investment
        // income: the excess over §1411's $200,000 is $100,000, the
        // investment income is the smaller, and 3.8% of $40,000 = $1,520.00.
        // Hand-computed; it reaches line 21 rather than stopping at line 12.
        //
        // **The $70,000.00 regular tax is Phase 29's own addition to this
        // fixture, and it is a correction rather than an accommodation.** A
        // $300,000.00 adjusted gross income with a $0.00 regular tax was
        // always fiction; nothing read line 16 until Form 6251 did, so nothing
        // noticed. With it, alternative minimum taxable income is $300,000.00,
        // the exemption leaves line 6 at $211,900.00, 26% of that is
        // $55,094.00, and the Part III upper bound settles the AMT at exactly
        // $0.00 — which is what a $300,000.00 filer with capital gain
        // distributions and no preference items actually owes. Without a
        // regular tax the bound cannot settle it and Form 6251 refuses, which
        // is how this fixture's fiction surfaced.
        investmentIncomeAboveTheThresholdReachesLineTwentyOne: () => {
            const result = run({
                ...noAmounts,
                taxableInterest: inputLine('line2b')(500000n),
                ordinaryDividends: inputLine('line3b')(1000000n),
                netCapitalGainOrLoss: inputLine('line7a')(2500000n),
                adjustedGrossIncome: inputLine('line11b')(30000000n),
                regularTax: inputLine('line16')(7000000n),
            })
            assertEq(result.line2.value, 0n, 'the Part III bound settles the AMT at zero')
            assertEq(result.form6251.line7IsAnUpperBound, true, 'and says line 7 is a bound')
            assertEq(result.line12.value, 152000n, 'line 12 = $1,520.00 = 3.8% of $40,000.00')
            assertEq(result.line21.value, 152000n, 'line 21 = $1,520.00 -> 1040 line 23')
            assertEq(result.line3.value, 0n, 'line 3 = $0.00 -- line 12 is a Part II tax too')
        },
        // THE EXCLUSIONS, WIRED. This is the leaf that pins WHICH 1040 lines
        // feed Form 8960, which no proof inside `fjs/form8960` can: that
        // module only sees the three amounts it is handed. A filer with
        // $300,000 of AGI, no taxable interest, no dividends and no capital
        // gain owes NOTHING -- and the point is that the AGI can be made
        // entirely of tax-exempt interest, IRA distributions, Social Security
        // and wages, none of which is net investment income, and line 12
        // stays $0.00 because none of them is plumbed into this call.
        //
        // The control is the leaf above: change the AGI's composition to
        // include $40,000 of the three that DO count and line 12 becomes
        // $1,520.00. Together they say the wiring reads exactly three lines.
        theExclusionsAreWired: () => {
            const result = run({ ...noAmounts, adjustedGrossIncome: inputLine('line11b')(30000000n) })
            assertEq(result.form8960.line8, 0n, 'no net investment income, however the AGI arose')
            assertEq(result.form8960.line15, 10000000n, 'the AGI really is $100,000 above the threshold')
            assertEq(result.line12.value, 0n, 'line 12 = $0.00 -- excess income alone is not a tax')
        },
        // Provenance: line 12 cites all four facts the "lesser of" reads, and
        // deliberately NOT 1040 line 2a. A sources list that lost the AGI
        // would leave a reader unable to see why the tax was capped.
        lineTwelveCitesAllFourFactsTheComparisonReads: () => {
            const result = run({
                ...noAmounts,
                taxableInterest: inputLine('line2b')(500000n),
                ordinaryDividends: inputLine('line3b')(1000000n),
                netCapitalGainOrLoss: inputLine('line7a')(2500000n),
                adjustedGrossIncome: inputLine('line11b')(30000000n),
                // See the leaf above: a $300,000.00 AGI needs a regular tax,
                // and this fixture had none because nothing read line 16.
                regularTax: inputLine('line16')(7000000n),
            })
            const boxes = result.line12.sources.map(source => source.boxPath)
            for (const box of ['line2b', 'line3b', 'line7a', 'line11b']) {
                assert(boxes.includes(box), ['line 12 must cite this fact', box, boxes])
            }
            assert(!boxes.includes('line2a'), ['tax-exempt interest must not be cited by line 12', boxes])
        },
    },
    // BOTH taxes on ONE return, added into line 21 rather than one silently
    // replacing the other. $900.00 + $1,520.00 = $2,420.00, hand-added.
    bothNewTaxesSumIntoLineTwentyOne: () => {
        const result = run({
            ...noAmounts,
            medicareWages: inputLine('box5MedicareWagesAndTips')(30000000n),
            taxableInterest: inputLine('line2b')(500000n),
            ordinaryDividends: inputLine('line3b')(1000000n),
            netCapitalGainOrLoss: inputLine('line7a')(2500000n),
            adjustedGrossIncome: inputLine('line11b')(30000000n),
            // See `line12`'s own first leaf: a $300,000.00 AGI needs a regular
            // tax, and this fixture had none because nothing read line 16.
            regularTax: inputLine('line16')(7000000n),
        })
        assertEq(result.line3.value, 0n, 'and the AMT adds nothing to 1040 line 17')
        assertEq(result.line11.value, 90000n, 'line 11 = $900.00')
        assertEq(result.line12.value, 152000n, 'line 12 = $1,520.00')
        assertEq(result.line21.value, 242000n, 'line 21 = $2,420.00 = $900.00 + $1,520.00')
    },
    // THE BOUNDARY PAIR AT THE SCHEDULE, on the wired path rather than inside
    // the form: exactly AT each status's own §3101(b)(2) threshold, line 21
    // is $0.00; one cent above, line 11's `>` has fired even though 0.9% of a
    // cent still rounds to nothing. Hand-typed thresholds, per status.
    theBoundaryPairAtEveryStatus: () => {
        /** @type {Record<IndividualFilingStatus, bigint>} */
        const medicareThresholdCents = {
            single: 20000000n,
            marriedFilingJointly: 25000000n,
            marriedFilingSeparately: 12500000n,
            headOfHousehold: 20000000n,
            qualifyingSurvivingSpouse: 20000000n,
        }
        /** @type {readonly IndividualFilingStatus[]} */
        const everyStatus = [
            'single', 'marriedFilingJointly', 'marriedFilingSeparately',
            'headOfHousehold', 'qualifyingSurvivingSpouse',
        ]
        for (const status of everyStatus) {
            const threshold = medicareThresholdCents[status]
            const at = run({ ...noAmounts, status, medicareWages: inputLine('box5MedicareWagesAndTips')(threshold) })
            assertEq(at.form8959.line6, 0n, ['exactly at the threshold is not "in excess of" it', status])
            assertEq(at.line11.value, 0n, ['exactly at the threshold: no tax', status])
            assertEq(at.line21.value, 0n, ['exactly at the threshold: line 21 untouched', status])

            const above = run({
                ...noAmounts, status, medicareWages: inputLine('box5MedicareWagesAndTips')(threshold + 1n),
            })
            assertEq(above.form8959.line6, 1n, ['one cent above: the strict comparison fires', status])
            assertEq(above.line11.value, 0n, ['one cent above: 0.9% of a cent still rounds to $0.00', status])
        }
    },
}
