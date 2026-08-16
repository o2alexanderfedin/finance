/**
 * Schedule 1 (Form 1040) — TAX-14: Part I (Additional Income, lines 1-10)
 * and Part II (Adjustments to Income, lines 11-26), every printed line
 * named and computed.
 *
 * Source, transcribed directly (13-RESEARCH.md §5), not from recall:
 * `f1040s1.pdf` (2025), "Created" 2025.
 *
 * This is a STANDALONE, independently callable pure function over the
 * declared return profile alone — the same relationship `fjs/schedule/b`,
 * `fjs/schedule/a` and `fjs/schedule/1a` have to their own inputs. It is
 * NOT wired into Form 1040's own line 8/line 10 aggregation (13-12's job),
 * and it does not consult the return-scope guard's own classification
 * function. It imports NOTHING at runtime from `fjs/tax/`, `fjs/return/scope`,
 * or `fjs/form1040/`.
 *
 * ## Read this before Schedule 2 or Schedule 3 — the shape is identical
 *
 * Every printed line on this schedule is modeled — no line is silently
 * omitted. **Exactly one line computes from a document: line 7,
 * unemployment compensation, summed from `vnd.fjs.1099g` box 1 (Phase 20).**
 * Every other line is a `profileDeclaredZeroLine`, citing the profile's own
 * `declaredKinds` box — `fjs/schedule/b`'s Form 8815 boundary treatment,
 * copied verbatim in shape, applied to almost an entire schedule rather
 * than one line.
 *
 * The paragraph above read *"none of Schedule 1's Part I income items and
 * none of Part II's adjustments are populated by any kind this engine
 * models"* until 2026-08-15, which stopped being true the day before, when
 * line 7 began computing. Corrected after Phase 20's verification pass found
 * it. Research (13-RESEARCH.md §5) established that claim honestly for the
 * declared 65+/dependents/itemizing profile; **a finding is true of the
 * moment it was made, and a docstring that quotes one inherits its expiry.**
 *
 * ## Why the whole schedule collapses to documented zero, and why that is
 * honest rather than a shortcut
 *
 * The frozen 51-kind `kindVocabulary` (`fjs/return/scope`) carries exactly
 * two COARSE kinds for this schedule: `scheduleOneAdditionalIncome` (all of
 * Part I *except* line 7) and `scheduleOneAdjustments` (all of Part II,
 * lines 11-26) — plus `unemploymentCompensation`, the one fine-grained kind
 * that carved line 7 out of the first of those in Phase 20. Each covers many distinct line items — Part I's line 8
 * alone has 26 sub-lines (8a-8z: NOL, gambling, cancellation of debt, the
 * foreign earned income exclusion, Alaska PFD, jury duty, digital assets,
 * and nineteen more), and Part II's line 24 has 11 (24a-24z). This engine
 * has no per-line dialect for ANY of them — no Schedule C, no Form 4797,
 * no Schedule E, no Schedule F, no Form 8853/8889, no Form 2441, and so on.
 *
 * A taxpayer who genuinely has, say, business income and declares
 * `scheduleOneAdditionalIncome` cannot have that real dollar figure
 * represented here at all — this module could only ever return `$0` for
 * it. Reclassifying either coarse kind to `fjs/return/scope`'s
 * `modeledKinds` would let that real, undeclared amount compute silently
 * as `$0` — exactly TAX-16's failure mode, a confident zero standing in
 * for an honest refusal. So **both `scheduleOneAdditionalIncome` and
 * `scheduleOneAdjustments` stay in `unmodeledKindRefusals` for the whole
 * of this phase** (13-RESEARCH.md Open Questions 1-2; this plan's own
 * objective records the same finding). Declaring either refuses the WHOLE
 * return at the scope layer — a decision this module never makes and never
 * needs to: it is correct for every return the engine can otherwise
 * compute, where neither kind is declared and the true amount is
 * genuinely zero.
 *
 * ## The 26/11 sub-line collapses (lines 8/9 and 24/25)
 *
 * The printed form's own line 8 ("Other income") and line 24 ("Other
 * adjustments") are themselves headers over lettered sub-lines (8a-8z,
 * 24a-24z) with no individual dollar box of their own — only the
 * following line (9, 25 respectively) is a genuine printed total box. This
 * module models `line8`/`line24` as ONE collapsed documented zero standing
 * in for the whole lettered group (never enumerating all 26 or 11
 * sub-lines individually, since none is separately reachable), then
 * `line9`/`line25` restate that same total as their own line, exactly
 * mirroring `fjs/schedule/b`'s `line4 = { ...line2, rule: 'Schedule B line
 * 4' }` copy-line idiom.
 *
 * ## Line 22 ("Reserved for future use")
 *
 * Not a modeling gap — the printed form itself reserves this line number
 * with no box to fill. Modeled as a documented zero for line-number
 * completeness (this module names every printed line, including a
 * currently-inert one), never contributing anything but `0` to line 26.
 *
 * The four box-sum/document-line helpers below (`totalLine`,
 * `unionSources`, `profileDeclaredZeroLine`) are reimplemented locally,
 * private and NOT imported from `fjs/form1040/core` — that module does not
 * export them, and this is the same "reimplement an idiom you cannot
 * import" pattern `fjs/schedule/b`/`fjs/schedule/a`/`fjs/schedule/1a`
 * already use.
 *
 * @module
 */
import { assert, assertEq } from 'functionalscript/fjs/asserts/module.f.js'
import { centsFromString } from '../../exact/module.f.js'

/** @import { ReturnProfile } from '../../return/profile/module.f.js' */
/** @import { OneZeroNineNineG } from '../../document/1099g/module.f.js' */
/** @import { ReportLine, Source } from '../../report/line/module.f.js' */

// ── Inputs ───────────────────────────────────────────────────────────────────

/**
 * A stored document as this module sees it — mirrors `fjs/schedule/b`'s
 * own `Stored<T>`; nothing here re-validates.
 * @template T
 * @typedef {{ readonly documentHash: string, readonly value: T }} Stored
 */

// ── Local helpers (reimplemented, not imported from `fjs/form1040/core`) ──────

/**
 * A line that is zero because the taxpayer declared no such income/
 * adjustment, citing the return profile's own `declaredKinds` box as its
 * provenance — mirrors `fjs/schedule/b`'s own `profileDeclaredZeroLine`.
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
 * `fjs/form1040/core`'s own private `sourceKey`.
 * @type {(source: Source) => string}
 */
const sourceKey = source => `${source.documentHash} ${source.boxPath}`

/**
 * The union of every input line's sources: concatenated, deduplicated on
 * {@link sourceKey}, first-seen order, still a non-empty tuple — mirrors
 * `fjs/form1040/core`'s own private `unionSources`, reimplemented locally
 * per this module's own "reimplement, do not import" precedent.
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
 * its own `rule` — mirrors `fjs/form1040/core`'s own private `totalLine`.
 * Every constituent line on this schedule cites the SAME profile source
 * (`declaredKinds`), so the union always dedupes to exactly one source.
 * @type {(rule: string) => (lines: readonly ReportLine[]) => ReportLine}
 */
const totalLine = rule => lines => ({
    value: lines.reduce((total, line) => total + line.value, 0n),
    sources: unionSources(lines),
    rule,
})

/**
 * Line 7, unemployment compensation: the sum of box 1 across every stored
 * `vnd.fjs.1099g`, citing ONE source per document.
 *
 * **Absence is a legitimate zero, not a refusal** — the same cardinality
 * decision Phase 15 made for the prior-year capital-loss carryover
 * (15-05): a taxpayer with no 1099-G has no unemployment, and the caller
 * simply passes no documents. A document that EXISTS with an unparseable or
 * unmodeled box is refused, but that refusal lives in the dialect's own
 * `checkReferences`, not here.
 *
 * When there are no forms the line falls back to
 * {@link profileDeclaredZeroLine} so it still carries provenance — a
 * `ReportLine` may never exist without sources (PROV-01).
 * @type {(profile: Stored<ReturnProfile>) => (forms: readonly Stored<OneZeroNineNineG>[]) => ReportLine}
 */
const unemploymentCompensationLine = profile => forms => {
    const rule = 'Schedule 1 line 7 (unemployment compensation)'
    const withBox1 = forms.filter(form => form.value.box1UnemploymentCompensation !== undefined)
    const [first, ...rest] = withBox1.map(form => {
        const printed = form.value.box1UnemploymentCompensation
        assert(printed !== undefined, ['filtered to present box 1', form.documentHash])
        return { documentHash: form.documentHash, boxPath: 'box1UnemploymentCompensation', value: printed }
    })
    if (first === undefined) {
        return profileDeclaredZeroLine(profile)(rule)
    }
    return {
        value: [first, ...rest].reduce((total, source) => total + centsFromString(source.value), 0n),
        sources: [first, ...rest],
        rule,
    }
}

// ── Schedule 1 itself ───────────────────────────────────────────────────────

/**
 * All sixteen Part I fields (lines 1 through 10, `line8`/`line9` being the
 * 26-sub-line collapse) and sixteen Part II fields (lines 11 through 26,
 * `line24`/`line25` being the 11-sub-line collapse). Every field is a
 * {@link ReportLine} — including the two totals (`line10`, `line26`) — so
 * a caller can always read `.value`/`.sources` uniformly, mirroring this
 * module's own docstring's "every line cites `declaredKinds`" claim at the
 * type level.
 * @typedef {{
 *   readonly line1: ReportLine, readonly line2a: ReportLine, readonly line3: ReportLine,
 *   readonly line4: ReportLine, readonly line5: ReportLine, readonly line6: ReportLine,
 *   readonly line7: ReportLine, readonly line8: ReportLine, readonly line9: ReportLine,
 *   readonly line10: ReportLine,
 *   readonly line11: ReportLine, readonly line12: ReportLine, readonly line13: ReportLine,
 *   readonly line14: ReportLine, readonly line15: ReportLine, readonly line16: ReportLine,
 *   readonly line17: ReportLine, readonly line18: ReportLine, readonly line19a: ReportLine,
 *   readonly line20: ReportLine, readonly line21: ReportLine, readonly line22: ReportLine,
 *   readonly line23: ReportLine, readonly line24: ReportLine, readonly line25: ReportLine,
 *   readonly line26: ReportLine,
 * }} ScheduleOne
 */

/**
 * Computes Schedule 1 for one return from the declared return profile
 * alone. Every line is `value: 0n` for any profile that does not declare
 * `scheduleOneAdditionalIncome`/`scheduleOneAdjustments` — see this
 * module's own docstring for why that is the honest, complete answer for
 * this phase, not a shortcut.
 * @type {(profile: Stored<ReturnProfile>) => (unemploymentForms: readonly Stored<OneZeroNineNineG>[]) => ScheduleOne}
 */
export const scheduleOne = profile => unemploymentForms => {
    const zero = profileDeclaredZeroLine(profile)

    // ── Part I: Additional Income ────────────────────────────────────────
    const line1 = zero('Schedule 1 line 1 (taxable state/local income tax refunds)')
    const line2a = zero('Schedule 1 line 2a (alimony received)')
    const line3 = zero('Schedule 1 line 3 (business income/loss, Schedule C)')
    const line4 = zero('Schedule 1 line 4 (other gains/losses, Form 4797/4684)')
    const line5 = zero('Schedule 1 line 5 (rental real estate, royalties, Schedule E)')
    const line6 = zero('Schedule 1 line 6 (farm income/loss, Schedule F)')
    const line7 = unemploymentCompensationLine(profile)(unemploymentForms)
    // 8. "Other income" -- a collapsed stand-in for 8a-8z (26 sub-lines);
    //    see this module's own docstring, "The 26/11 sub-line collapses".
    const line8 = zero('Schedule 1 line 8 (other income, 8a-8z collapsed -- none separately reachable)')
    // 9. "Total other income. Add lines 8a through 8z" -- the SAME total,
    //    restated as its own printed line.
    const line9 = { ...line8, rule: 'Schedule 1 line 9 (total other income)' }
    // 10. "Combine lines 1 through 7 and 9." -> 1040 line 8.
    const line10 = totalLine('Schedule 1 line 10 (total additional income -> 1040 line 8)')([
        line1, line2a, line3, line4, line5, line6, line7, line9,
    ])

    // ── Part II: Adjustments to Income ───────────────────────────────────
    const line11 = zero('Schedule 1 line 11 (educator expenses)')
    const line12 = zero('Schedule 1 line 12 (certain business expenses of reservists/performing artists/fee-basis officials)')
    const line13 = zero('Schedule 1 line 13 (HSA deduction)')
    const line14 = zero('Schedule 1 line 14 (moving expenses for Armed Forces members)')
    const line15 = zero('Schedule 1 line 15 (deductible part of self-employment tax)')
    const line16 = zero('Schedule 1 line 16 (SEP/SIMPLE/qualified plans)')
    const line17 = zero('Schedule 1 line 17 (self-employed health insurance deduction)')
    const line18 = zero('Schedule 1 line 18 (penalty on early withdrawal of savings)')
    const line19a = zero('Schedule 1 line 19a (alimony paid)')
    const line20 = zero('Schedule 1 line 20 (IRA deduction)')
    const line21 = zero('Schedule 1 line 21 (student loan interest deduction)')
    // 22. "Reserved for future use" -- the form's own inert line; see this
    //     module's own docstring.
    const line22 = zero('Schedule 1 line 22 (reserved for future use)')
    const line23 = zero('Schedule 1 line 23 (Archer MSA deduction)')
    // 24. "Other adjustments" -- a collapsed stand-in for 24a-24z (11
    //     sub-lines); see this module's own docstring.
    const line24 = zero('Schedule 1 line 24 (other adjustments, 24a-24z collapsed -- none separately reachable)')
    // 25. "Total other adjustments. Add lines 24a through 24z" -- the SAME
    //     total, restated as its own printed line.
    const line25 = { ...line24, rule: 'Schedule 1 line 25 (total other adjustments)' }
    // 26. "Add lines 11 through 23 and 25." -> 1040 line 10.
    const line26 = totalLine('Schedule 1 line 26 (total adjustments to income -> 1040 line 10)')([
        line11, line12, line13, line14, line15, line16, line17, line18, line19a,
        line20, line21, line22, line23, line25,
    ])

    return {
        line1, line2a, line3, line4, line5, line6, line7, line8, line9, line10,
        line11, line12, line13, line14, line15, line16, line17, line18, line19a,
        line20, line21, line22, line23, line24, line25, line26,
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

/** @type {Stored<OneZeroNineNineG>} */
const unemploymentA = {
    documentHash: 'sha256-1099g-a',
    value: {
        dialect: 'vnd.fjs.1099g',
        payerTin: '11-1111111', recipientTin: '222-22-2222', accountNumber: 'EDD-1',
        taxYear: 2025, formRevision: '2025',
        box1UnemploymentCompensation: '4554.00',
        box4FederalIncomeTaxWithheld: '454.00',
    },
}

/** A second payer, to prove line 7 SUMS rather than reading only the first. */
/** @type {Stored<OneZeroNineNineG>} */
const unemploymentB = {
    documentHash: 'sha256-1099g-b',
    value: {
        dialect: 'vnd.fjs.1099g',
        payerTin: '33-3333333', recipientTin: '222-22-2222', accountNumber: 'EDD-2',
        taxYear: 2025, formRevision: '2025',
        box1UnemploymentCompensation: '1000.00',
    },
}

export const proof = {
    // ── Line 7: unemployment compensation (1099-G box 1) ──────────────────

    /**
     * Two 1099-Gs sum, and EACH cites its own document. A single-document
     * proof could not tell a sum from a "read the first one" bug.
     */
    line7SumsEveryUnemploymentFormCitingEach: () => {
        const result = scheduleOne(profileNoDeclaredKinds)([unemploymentA, unemploymentB])
        assertEq(result.line7.value, 555400n, '$4,554.00 + $1,000.00 = $5,554.00')
        assertEq(result.line7.sources.length, 2)
        const [firstSource, secondSource] = result.line7.sources
        assert(secondSource !== undefined, ['two forms must yield two sources', result.line7.sources])
        assertEq(firstSource.documentHash, 'sha256-1099g-a')
        assertEq(secondSource.documentHash, 'sha256-1099g-b')
        assertEq(firstSource.boxPath, 'box1UnemploymentCompensation')
    },

    /**
     * Line 10 is the Part I total that reaches 1040 line 8. Unemployment must
     * actually REACH it — a line 7 that computes correctly but never lands in
     * the total would leave the return understated with every leaf green.
     */
    line7ReachesTheLine10TotalThatFeeds1040Line8: () => {
        const withForms = scheduleOne(profileNoDeclaredKinds)([unemploymentA])
        const without = scheduleOne(profileNoDeclaredKinds)([])
        assertEq(withForms.line10.value, 455400n, 'line 10 carries the unemployment')
        assertEq(without.line10.value, 0n, 'and is zero without it')
        assertEq(withForms.line10.value - without.line10.value, withForms.line7.value)
    },

    /**
     * DOC-11 / 15-05's cardinality decision: NO 1099-G is a legitimate zero,
     * not a refusal — a taxpayer who was never unemployed simply has no
     * document. The line still carries provenance (PROV-01: no line without
     * sources), citing the profile's own `declaredKinds`.
     */
    absentUnemploymentIsZeroWithProfileProvenance: () => {
        const result = scheduleOne(profileNoDeclaredKinds)([])
        assertEq(result.line7.value, 0n)
        assertEq(result.line7.sources.length, 1)
        assertEq(result.line7.sources[0].boxPath, 'declaredKinds')
    },

    /**
     * A 1099-G with NO box 1 (withholding only — possible on a corrected
     * form) contributes nothing and is not counted as a source. Absent is not
     * zero-valued: it is not present at all.
     */
    formWithoutBox1ContributesNoSource: () => {
        const withholdingOnly = {
            documentHash: 'sha256-1099g-c',
            value: { ...unemploymentA.value, box1UnemploymentCompensation: undefined },
        }
        const result = scheduleOne(profileNoDeclaredKinds)([withholdingOnly])
        assertEq(result.line7.value, 0n)
        assertEq(result.line7.sources[0].boxPath, 'declaredKinds')
    },

    // Task 1's own acceptance criterion.
    noDeclaredScheduleOneKindGivesZeroTotals: () => {
        const result = scheduleOne(profileNoDeclaredKinds)([])
        assertEq(result.line10.value, 0n, 'line 10 = $0.00')
        assertEq(result.line26.value, 0n, 'line 26 = $0.00')
        assertEq(result.line10.sources[0].boxPath, 'declaredKinds')
        assertEq(result.line26.sources[0].boxPath, 'declaredKinds')
    },
    // Zero stored documents/nothing declared still produce valid
    // ReportLines, each citing the profile's declaredKinds box -- mirrors
    // `fjs/schedule/b`'s own `zeroStoredDocumentsStillProduceValidReportLinesCitingProfile`.
    zeroStoredDocumentsStillProduceValidReportLinesCitingProfile: () => {
        const result = scheduleOne(profileNoDeclaredKinds)([])
        for (const line of Object.values(result)) {
            assertEq(line.value, 0n)
            assertEq(line.sources.length, 1)
            assertEq(line.sources[0].documentHash, profileNoDeclaredKinds.documentHash)
            assertEq(line.sources[0].boxPath, 'declaredKinds')
        }
    },
    // The 8/9 and 24/25 collapse-and-restate idiom: line9 copies line8
    // exactly (value and sources), only the rule differs -- mirrors
    // `fjs/schedule/b`'s own line4 = { ...line2, rule: ... } pin.
    line9RestatesLine8ExactlyAndLine25RestatesLine24Exactly: () => {
        const result = scheduleOne(profileNoDeclaredKinds)([])
        assertEq(result.line9.value, result.line8.value)
        assertEq(result.line9.sources[0].boxPath, result.line8.sources[0].boxPath)
        assert(result.line9.rule !== result.line8.rule, 'line9 and line8 must carry DIFFERENT rule strings')
        assertEq(result.line25.value, result.line24.value)
        assertEq(result.line25.sources[0].boxPath, result.line24.sources[0].boxPath)
        assert(result.line25.rule !== result.line24.rule, 'line25 and line24 must carry DIFFERENT rule strings')
    },
    // Every printed line is named -- a hand-typed count-guard so a line
    // silently dropped from `scheduleOne`'s return object is caught even
    // though every value happens to be zero today (AGENTS.md's "hand-typed
    // count" mutation-gate idiom, applied to line COUNT rather than a
    // vocabulary size).
    everyPrintedLineIsNamed: () => {
        const result = scheduleOne(profileNoDeclaredKinds)([])
        const expectedFieldCount = 26
        assertEq(Object.keys(result).length, expectedFieldCount, 'expected exactly 26 named Schedule 1 fields')
    },
    // This module computes a schedule, not a stored document -- no
    // `dialect`/`mediaType`, mirroring `fjs/schedule/b`'s own
    // `dialectIndependence` leaf.
    dialectIndependence: () => {
        const result = scheduleOne(profileNoDeclaredKinds)([])
        assert(!('dialect' in result), 'scheduleOne output must not carry a dialect tag')
        assert(!('mediaType' in result), 'scheduleOne output must not carry a mediaType')
    },
}
