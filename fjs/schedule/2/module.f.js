/**
 * Schedule 2 (Form 1040) — TAX-14: Part I (Tax, lines 1a-3) and Part II
 * (Other Taxes, lines 4-21), every printed line named and computed.
 *
 * Source, transcribed directly (13-RESEARCH.md §5), not from recall:
 * `f1040s2.pdf` (2025), "Created" 2025.
 *
 * Lines 11 and 12 carry real Form 8959 and Form 8960 figures as of Phase 23
 * (TAX-20/TAX-21); every other line is still a documented zero. See "Lines 11
 * and 12 compute; the other nineteen are still declared zeros" below.
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
import { taxParamsByYear } from '../../tax/params/module.f.js'

/** @import { ReturnProfile } from '../../return/profile/module.f.js' */
/** @import { ReportLine, Source } from '../../report/line/module.f.js' */
/** @import { IndividualFilingStatus, TaxParamSet } from '../../tax/params/module.f.js' */
/** @import { Form8959 } from '../../form8959/module.f.js' */
/** @import { Form8960 } from '../../form8960/module.f.js' */

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
 * @typedef {{
 *   readonly profile: Stored<ReturnProfile>,
 *   readonly status: IndividualFilingStatus,
 *   readonly medicareWages: ReportLine,
 *   readonly medicareTaxWithheld: ReportLine,
 *   readonly taxableInterest: ReportLine,
 *   readonly ordinaryDividends: ReportLine,
 *   readonly netCapitalGainOrLoss: ReportLine,
 *   readonly adjustedGrossIncome: ReportLine,
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
 * @typedef {{
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
 * }} ScheduleTwo
 */

/**
 * Computes Schedule 2 for one return.
 *
 * Lines 11 and 12 are real Form 8959 and Form 8960 figures; every other line
 * is `value: 0n` citing the profile's own `declaredKinds` box, because this
 * engine models none of the twelve remaining Schedule 2 kinds — see this
 * module's own docstring for why that is the honest, complete answer.
 * @type {(taxParamSet: TaxParamSet) => (input: ScheduleTwoInput) => ScheduleTwo}
 */
export const scheduleTwo = taxParamSet => input => {
    const {
        profile, status,
        medicareWages, medicareTaxWithheld,
        taxableInterest, ordinaryDividends, netCapitalGainOrLoss, adjustedGrossIncome,
    } = input
    const zero = profileDeclaredZeroLine(profile)

    // ── Part I: Tax ───────────────────────────────────────────────────────
    // 1a-1z. Excess advance premium tax credit repayment, clean-vehicle-
    // credit repayments, EPE recapture -- a collapsed stand-in; see this
    // module's own docstring.
    const line1 = zero('Schedule 2 line 1 (excess APTC repayment/clean-vehicle-credit repayments/EPE recapture, 1a-1z collapsed)')
    // 1z. "Total. Add lines 1a through 1z" -- the SAME total, restated.
    const line1z = { ...line1, rule: 'Schedule 2 line 1z (total)' }
    const line2 = zero('Schedule 2 line 2 (alternative minimum tax, Form 6251)')
    // 3. "Add lines 1z and 2." -> 1040 line 17.
    const line3 = totalLine('Schedule 2 line 3 (total tax -> 1040 line 17)')([line1z, line2])

    // ── Part II: Other Taxes ─────────────────────────────────────────────
    const line4 = zero('Schedule 2 line 4 (self-employment tax)')
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
    })
    const line11 = {
        value: form8959Result.line18,
        // Box 6 is cited even though it feeds only Part V, which does NOT
        // reach this line: an auditor reading line 11 has to be able to see
        // that the same execution produced 1040 line 25c's credit, since the
        // two are meaningless apart.
        sources: unionSources([medicareWages, medicareTaxWithheld]),
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
        line1, line1z, line2, line3,
        line4, line5, line6, line7, line8, line9, line10, line11, line12, line13,
        line14, line15, line16, line17, line18, line19, line20, line21,
        form8959: form8959Result,
        form8960: form8960Result,
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
}

/** Runs Schedule 2 against TY2025's real parameter set.
 * @type {(input: ScheduleTwoInput) => ScheduleTwo}
 */
const run = input => scheduleTwo(taxParams2025)(input)

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
    // Three of the twenty-two printed lines are absent from this list. Lines
    // 11 and 12 now cite the boxes their forms read. Line 21 is the Part II
    // TOTAL, so its `sources` union necessarily includes theirs — it is
    // asserted separately, immediately below, because "still $0.00" and
    // "still cites only the profile" have come apart for it and only the
    // first is still true.
    nineteenLinesAreStillDeclaredZerosCitingOnlyTheProfile: () => {
        const result = run(noAmounts)
        /** @type {readonly ReportLine[]} */
        const declaredZeroLines = [
            result.line1, result.line1z, result.line2, result.line3,
            result.line4, result.line5, result.line6, result.line7,
            result.line8, result.line9, result.line10,
            result.line13, result.line14, result.line15, result.line16,
            result.line17, result.line18, result.line19, result.line20,
        ]
        assertEq(declaredZeroLines.length, 19, 'twenty-two printed lines, less lines 11, 12 and the line 21 total')
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
        const expectedFieldCount = 24
        assertEq(
            Object.keys(result).length,
            expectedFieldCount,
            'expected exactly 22 named Schedule 2 lines plus the two forms\' own records',
        )
    },
    dialectIndependence: () => {
        const result = run(noAmounts)
        assert(!('dialect' in result), 'scheduleTwo output must not carry a dialect tag')
        assert(!('mediaType' in result), 'scheduleTwo output must not carry a mediaType')
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
    },
    line12: {
        // A single filer with $300,000 of AGI and $40,000 of investment
        // income: the excess over §1411's $200,000 is $100,000, the
        // investment income is the smaller, and 3.8% of $40,000 = $1,520.00.
        // Hand-computed; it reaches line 21 rather than stopping at line 12.
        investmentIncomeAboveTheThresholdReachesLineTwentyOne: () => {
            const result = run({
                ...noAmounts,
                taxableInterest: inputLine('line2b')(500000n),
                ordinaryDividends: inputLine('line3b')(1000000n),
                netCapitalGainOrLoss: inputLine('line7a')(2500000n),
                adjustedGrossIncome: inputLine('line11b')(30000000n),
            })
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
        })
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
