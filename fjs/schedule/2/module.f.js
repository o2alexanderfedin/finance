/**
 * Schedule 2 (Form 1040) — TAX-14: Part I (Tax, lines 1a-3) and Part II
 * (Other Taxes, lines 4-21), every printed line named and computed.
 *
 * Source, transcribed directly (13-RESEARCH.md §5), not from recall:
 * `f1040s2.pdf` (2025), "Created" 2025.
 *
 * This is a STANDALONE, independently callable pure function over the
 * declared return profile alone — the same relationship `fjs/schedule/1`
 * has to its own input (read that module's docstring first; this one
 * follows its shape and reasoning without repeating it). It is NOT wired
 * into Form 1040's own line 17/line 23 aggregation (13-12's job), and it
 * does not consult the return-scope guard's own classification function.
 * It imports NOTHING at runtime from `fjs/tax/`, `fjs/return/scope`, or
 * `fjs/form1040/`.
 *
 * ## Every line is modeled; for this profile every line is zero
 *
 * **Superseded in part by Phase 23 (TAX-22); read the note at the end of
 * this section.** The frozen 50-kind `kindVocabulary` carried exactly ONE
 * kind for the
 * whole of this schedule, `scheduleTwoTaxes`, covering both Part I (AMT,
 * excess advance premium tax credit repayment, and the clean-vehicle-
 * credit/EPE-recapture sub-lines) and Part II (self-employment tax, the
 * Additional Medicare Tax, NIIT, household employment taxes, and
 * seventeen more sub-lines at line 17a-17z alone). This engine has no
 * per-line dialect for ANY of them — no Form 6251 (AMT), no Schedule SE,
 * no Form 8959 (Additional Medicare Tax), no Form 8960 (NIIT), no Schedule
 * H (household employment). For the declared 65+/dependents/itemizing
 * profile this project targets, research (13-RESEARCH.md §5) confirms
 * **none of Schedule 2's lines are reachable by any input this engine
 * models.**
 *
 * A taxpayer who genuinely owes, say, the Additional Medicare Tax and
 * declares `scheduleTwoTaxes` cannot have that real dollar figure
 * represented here — this module could only ever return `$0` for it.
 * Reclassifying the kind would let that real, undeclared amount compute
 * silently as `$0` — exactly TAX-16's failure mode. So **`scheduleTwoTaxes`
 * stays in `unmodeledKindRefusals` for the whole of this phase**
 * (13-RESEARCH.md Open Question 2). Declaring it refuses the WHOLE return
 * at the scope layer — a decision this module never makes; it is correct
 * for every return the engine can otherwise compute, where the kind is
 * undeclared and every one of these taxes is genuinely zero.
 *
 * **PHASE 23 (TAX-22): the coarse kind is gone, and the argument above is
 * what removed it.** `scheduleTwoTaxes` no longer exists in
 * `kindVocabulary`; it is fourteen per-printed-line kinds, one for each of
 * this schedule's line groups (`fjs/return/profile`'s own vocabulary
 * comment lists them, and `fjs/return/scope`'s refusal table names each
 * one's form). Every one of the fourteen is still refused as of THIS
 * commit, so every line below is still a documented zero and nothing about
 * this module's arithmetic has changed. Lines 11 and 12 are wired to real
 * Form 8959 and Form 8960 figures in the NEXT commit, in the same change
 * that reclassifies their two kinds — wire before reclassify, the
 * discipline every prior phase followed.
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

/** @import { ReturnProfile } from '../../return/profile/module.f.js' */
/** @import { ReportLine, Source } from '../../report/line/module.f.js' */

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
 * All four Part I fields (`line1`/`line1z` being the 1a-1z collapse) and
 * eighteen Part II fields (lines 4 through 21, `line17`/`line18` being the
 * 17a-17z collapse). Every field is a {@link ReportLine}.
 * @typedef {{
 *   readonly line1: ReportLine, readonly line1z: ReportLine, readonly line2: ReportLine,
 *   readonly line3: ReportLine,
 *   readonly line4: ReportLine, readonly line5: ReportLine, readonly line6: ReportLine,
 *   readonly line7: ReportLine, readonly line8: ReportLine, readonly line9: ReportLine,
 *   readonly line10: ReportLine, readonly line11: ReportLine, readonly line12: ReportLine,
 *   readonly line13: ReportLine, readonly line14: ReportLine, readonly line15: ReportLine,
 *   readonly line16: ReportLine, readonly line17: ReportLine, readonly line18: ReportLine,
 *   readonly line19: ReportLine, readonly line20: ReportLine, readonly line21: ReportLine,
 * }} ScheduleTwo
 */

/**
 * Computes Schedule 2 for one return from the declared return profile
 * alone. Every line is `value: 0n` for any profile that does not declare
 * any of this schedule's fourteen declared kinds — see this module's own
 * docstring for why that is the honest, complete answer for this phase.
 * @type {(profile: Stored<ReturnProfile>) => ScheduleTwo}
 */
export const scheduleTwo = profile => {
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
    const line11 = zero('Schedule 2 line 11 (Additional Medicare Tax, Form 8959)')
    const line12 = zero('Schedule 2 line 12 (net investment income tax, Form 8960)')
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
    }
}

// ── Tests ────────────────────────────────────────────────────────────────────

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

export const proof = {
    // Task 2's own acceptance criterion.
    noDeclaredKindsGivesZeroOnBothTotals: () => {
        const result = scheduleTwo(profileNoDeclaredKinds)
        assertEq(result.line3.value, 0n, 'line 3 = $0.00 -> 1040 line 17')
        assertEq(result.line21.value, 0n, 'line 21 = $0.00 -> 1040 line 23')
        assertEq(result.line3.sources[0].boxPath, 'declaredKinds')
        assertEq(result.line21.sources[0].boxPath, 'declaredKinds')
    },
    // Zero declared kinds still produce valid ReportLines for every field,
    // each citing the profile's declaredKinds box.
    zeroStoredDocumentsStillProduceValidReportLinesCitingProfile: () => {
        const result = scheduleTwo(profileNoDeclaredKinds)
        for (const line of Object.values(result)) {
            assertEq(line.value, 0n)
            assertEq(line.sources.length, 1)
            assertEq(line.sources[0].documentHash, profileNoDeclaredKinds.documentHash)
            assertEq(line.sources[0].boxPath, 'declaredKinds')
        }
    },
    // The 1a-1z/1z and 17a-17z/18 collapse-and-restate idiom.
    line1zRestatesLine1AndLine18RestatesLine17: () => {
        const result = scheduleTwo(profileNoDeclaredKinds)
        assertEq(result.line1z.value, result.line1.value)
        assertEq(result.line1z.sources[0].boxPath, result.line1.sources[0].boxPath)
        assert(result.line1z.rule !== result.line1.rule, 'line1z and line1 must carry DIFFERENT rule strings')
        assertEq(result.line18.value, result.line17.value)
        assertEq(result.line18.sources[0].boxPath, result.line17.sources[0].boxPath)
        assert(result.line18.rule !== result.line17.rule, 'line18 and line17 must carry DIFFERENT rule strings')
    },
    // Hand-typed line-count guard, per this project's mutation-gate idiom.
    everyPrintedLineIsNamed: () => {
        const result = scheduleTwo(profileNoDeclaredKinds)
        const expectedFieldCount = 22
        assertEq(Object.keys(result).length, expectedFieldCount, 'expected exactly 22 named Schedule 2 fields')
    },
    dialectIndependence: () => {
        const result = scheduleTwo(profileNoDeclaredKinds)
        assert(!('dialect' in result), 'scheduleTwo output must not carry a dialect tag')
        assert(!('mediaType' in result), 'scheduleTwo output must not carry a mediaType')
    },
}
