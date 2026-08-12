/**
 * Schedule 3 (Form 1040) — TAX-14: Part I (Nonrefundable Credits, lines
 * 1-8) and Part II (Other Payments and Refundable Credits, lines 9-15),
 * every printed line named and computed.
 *
 * Source, transcribed directly (13-RESEARCH.md §5), not from recall:
 * `f1040s3.pdf` (2025), "Created" 2025.
 *
 * This is a STANDALONE, independently callable pure function over the
 * declared return profile alone — the same relationship `fjs/schedule/1`
 * and `fjs/schedule/2` have to their own input (read `fjs/schedule/1`'s
 * docstring first; this one follows its shape and reasoning without
 * repeating it). It is NOT wired into Form 1040's own line 20/line 31
 * aggregation (13-12's job), and it does not consult the return-scope
 * guard's own classification function. It imports NOTHING at runtime from
 * `fjs/tax/`, `fjs/return/scope`, or `fjs/form1040/`.
 *
 * ## Every line is modeled; for this profile every line is zero
 *
 * The frozen 50-kind `kindVocabulary` carries exactly TWO kinds for the
 * whole of this schedule: `scheduleThreeNonrefundableCredits` (Part I —
 * the foreign tax credit, the dependent care credit, education credits,
 * the retirement savings contributions credit, residential clean energy,
 * energy-efficient home improvements, and thirteen more sub-lines at line
 * 6a-6z alone) and `scheduleThreeRefundableCredits` (Part II — net premium
 * tax credit, the extension payment, excess Social Security withholding,
 * the fuel tax credit, and five more sub-lines at line 13a-13z). This
 * engine has no per-line dialect for ANY of Part I's credits — no Form
 * 1116 (foreign tax credit), no Form 2441 (dependent care), no Form 8863
 * (education credits), no Form 8880 (retirement savings), no Form 5695
 * (residential energy). For the declared 65+/dependents/itemizing profile
 * this project targets, research (13-RESEARCH.md §5) confirms **none of
 * Schedule 3's lines are reachable by any input this engine models**, with
 * one partial exception addressed below (line 11).
 *
 * A taxpayer who genuinely claims, say, the foreign tax credit and
 * declares `scheduleThreeNonrefundableCredits` cannot have that real
 * dollar figure represented here — this module could only ever return
 * `$0` for it. Reclassifying either coarse kind would let that real,
 * undeclared amount compute silently as `$0` — exactly TAX-16's failure
 * mode. So **both `scheduleThreeNonrefundableCredits` and
 * `scheduleThreeRefundableCredits` stay in `unmodeledKindRefusals` for the
 * whole of this phase** (13-RESEARCH.md Open Question 2). Declaring either
 * refuses the WHOLE return at the scope layer — a decision this module
 * never makes; it is correct for every return the engine can otherwise
 * compute, where neither kind is declared and every one of these credits
 * is genuinely zero.
 *
 * ## Schedule 3 line 6d — NOT this phase's senior deduction
 *
 * Line 6d, "credit for the elderly or disabled" (Schedule R), is a
 * DIFFERENT, older credit than the new OBBBA senior deduction
 * `fjs/schedule/1a` computes at 1040 line 13b. Both concern taxpayers
 * 65-or-older, but one is a Schedule R nonrefundable CREDIT (this line,
 * out of scope) and the other is a Schedule 1-A DEDUCTION (in scope,
 * shipped in Wave 2 of this phase). Collapsed into `line6`'s 6a-6z
 * documented zero below along with the other twelve Part I sub-line
 * credits — never separately modeled, never conflated with Schedule 1-A.
 *
 * ## Line 11 (excess Social Security/tier-1 RRTA tax withheld) — a
 * DIFFERENT boundary from every other line on this schedule
 *
 * Every other line above is zero because no dialect or profile field
 * exists to populate it at all. Line 11 is different: 13-RESEARCH.md §5
 * flags it as **theoretically computable from stored `vnd.fjs.w2` data
 * alone** — a taxpayer with multiple W-2 employers whose combined Social
 * Security withholding (box 4) exceeds the annual maximum is legally
 * entitled to the excess back, and the data to compute it already exists
 * in this engine's own dialects. It is nonetheless **explicitly out of
 * THIS phase's scope** (13-RESEARCH.md Open Question 2's resolution;
 * ROADMAP.md's Wave 5 finding paragraph) — no kind in the frozen
 * vocabulary expresses it, and it is not named in 13-CONTEXT.md's scope
 * for this phase. `line11` below is a `profileDeclaredZeroLine` exactly
 * like every other line on this module, not a document-derived
 * computation — a documented boundary, not a silent omission, mirroring
 * `fjs/schedule/b`'s Form 8815 treatment (money the underlying documents
 * could support, deliberately not computed this phase, with the reason
 * recorded here for whichever future phase reaches it).
 *
 * The `totalLine`/`unionSources`/`profileDeclaredZeroLine` helpers below
 * are reimplemented locally, private and NOT imported from
 * `fjs/form1040/core`, `fjs/schedule/1`, or `fjs/schedule/2` — this
 * project's established "reimplement an idiom you cannot import" pattern.
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
 * A line that is zero because the taxpayer declared no such credit,
 * citing the return profile's own `declaredKinds` box — mirrors
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

// ── Schedule 3 itself ───────────────────────────────────────────────────────

/**
 * All nine Part I fields (`line6` being the 6a-6z collapse) and seven
 * Part II fields (`line13` being the 13a-13z collapse). Every field is a
 * {@link ReportLine}.
 * @typedef {{
 *   readonly line1: ReportLine, readonly line2: ReportLine, readonly line3: ReportLine,
 *   readonly line4: ReportLine, readonly line5a: ReportLine, readonly line5b: ReportLine,
 *   readonly line6: ReportLine, readonly line7: ReportLine, readonly line8: ReportLine,
 *   readonly line9: ReportLine, readonly line10: ReportLine, readonly line11: ReportLine,
 *   readonly line12: ReportLine, readonly line13: ReportLine, readonly line14: ReportLine,
 *   readonly line15: ReportLine,
 * }} ScheduleThree
 */

/**
 * Computes Schedule 3 for one return from the declared return profile
 * alone. Every line is `value: 0n` for any profile that does not declare
 * `scheduleThreeNonrefundableCredits`/`scheduleThreeRefundableCredits` —
 * see this module's own docstring for why that is the honest, complete
 * answer for this phase.
 * @type {(profile: Stored<ReturnProfile>) => ScheduleThree}
 */
export const scheduleThree = profile => {
    const zero = profileDeclaredZeroLine(profile)

    // ── Part I: Nonrefundable Credits ────────────────────────────────────
    const line1 = zero('Schedule 3 line 1 (foreign tax credit, Form 1116)')
    const line2 = zero('Schedule 3 line 2 (credit for child and dependent care expenses, Form 2441)')
    const line3 = zero('Schedule 3 line 3 (education credits, Form 8863)')
    const line4 = zero('Schedule 3 line 4 (retirement savings contributions credit, Form 8880)')
    const line5a = zero('Schedule 3 line 5a (residential clean energy credit, Form 5695)')
    const line5b = zero('Schedule 3 line 5b (energy-efficient home improvement credit, Form 5695)')
    // 6a-6z. "Other nonrefundable credits" -- a collapsed stand-in for
    // thirteen sub-lines, including 6d (credit for the elderly or
    // disabled, Schedule R) -- see this module's own docstring, "Schedule
    // 3 line 6d".
    const line6 = zero('Schedule 3 line 6 (other nonrefundable credits, 6a-6z collapsed, including Schedule R line 6d)')
    // 7. "Total other nonrefundable credits. Add lines 6a through 6z" --
    //    the SAME total, restated.
    const line7 = { ...line6, rule: 'Schedule 3 line 7 (total other nonrefundable credits)' }
    // 8. "Add lines 1 through 4, 5a, 5b, and 7." -> 1040 line 20.
    const line8 = totalLine('Schedule 3 line 8 (total nonrefundable credits -> 1040 line 20)')([
        line1, line2, line3, line4, line5a, line5b, line7,
    ])

    // ── Part II: Other Payments and Refundable Credits ──────────────────
    const line9 = zero('Schedule 3 line 9 (net premium tax credit, Form 8962)')
    const line10 = zero('Schedule 3 line 10 (amount paid with request for extension to file)')
    // 11. Excess Social Security/tier-1 RRTA tax withheld -- see this
    //     module's own docstring, "Line 11 ... a DIFFERENT boundary".
    const line11 = zero('Schedule 3 line 11 (excess Social Security/tier-1 RRTA tax withheld -- theoretically W-2-derivable, out of this phase\'s scope)')
    const line12 = zero('Schedule 3 line 12 (federal fuel tax credit, Form 4136)')
    // 13a-13z. "Other payments or refundable credits" -- a collapsed
    // stand-in for five sub-lines.
    const line13 = zero('Schedule 3 line 13 (other payments or refundable credits, 13a-13z collapsed)')
    // 14. "Total other payments or refundable credits. Add lines 13a
    //     through 13z" -- the SAME total, restated.
    const line14 = { ...line13, rule: 'Schedule 3 line 14 (total other payments or refundable credits)' }
    // 15. "Add lines 9, 10, 11, 12, and 14." -> 1040 line 31.
    const line15 = totalLine('Schedule 3 line 15 (total other payments/refundable credits -> 1040 line 31)')([
        line9, line10, line11, line12, line14,
    ])

    return {
        line1, line2, line3, line4, line5a, line5b, line6, line7, line8,
        line9, line10, line11, line12, line13, line14, line15,
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
        const result = scheduleThree(profileNoDeclaredKinds)
        assertEq(result.line8.value, 0n, 'line 8 = $0.00 -> 1040 line 20')
        assertEq(result.line15.value, 0n, 'line 15 = $0.00 -> 1040 line 31')
        assertEq(result.line8.sources[0].boxPath, 'declaredKinds')
        assertEq(result.line15.sources[0].boxPath, 'declaredKinds')
    },
    // Zero declared kinds still produce valid ReportLines for every field,
    // each citing the profile's declaredKinds box -- including line 11,
    // this module's own documented (not silent) boundary.
    zeroStoredDocumentsStillProduceValidReportLinesCitingProfile: () => {
        const result = scheduleThree(profileNoDeclaredKinds)
        for (const line of Object.values(result)) {
            assertEq(line.value, 0n)
            assertEq(line.sources.length, 1)
            assertEq(line.sources[0].documentHash, profileNoDeclaredKinds.documentHash)
            assertEq(line.sources[0].boxPath, 'declaredKinds')
        }
    },
    // Line 11's own boundary: a documented zero exactly like every other
    // line here, not a document-derived computation over stored W-2s,
    // even though the underlying data theoretically supports one.
    line11IsADocumentedZeroNotAW2Computation: () => {
        const result = scheduleThree(profileNoDeclaredKinds)
        assertEq(result.line11.value, 0n)
        assertEq(result.line11.sources.length, 1, 'line 11 cites exactly the profile, never a W-2 box')
        assertEq(result.line11.sources[0].boxPath, 'declaredKinds')
    },
    // The 6/7 and 13/14 collapse-and-restate idiom.
    line7RestatesLine6AndLine14RestatesLine13: () => {
        const result = scheduleThree(profileNoDeclaredKinds)
        assertEq(result.line7.value, result.line6.value)
        assertEq(result.line7.sources[0].boxPath, result.line6.sources[0].boxPath)
        assert(result.line7.rule !== result.line6.rule, 'line7 and line6 must carry DIFFERENT rule strings')
        assertEq(result.line14.value, result.line13.value)
        assertEq(result.line14.sources[0].boxPath, result.line13.sources[0].boxPath)
        assert(result.line14.rule !== result.line13.rule, 'line14 and line13 must carry DIFFERENT rule strings')
    },
    // Hand-typed line-count guard, per this project's mutation-gate idiom.
    everyPrintedLineIsNamed: () => {
        const result = scheduleThree(profileNoDeclaredKinds)
        const expectedFieldCount = 16
        assertEq(Object.keys(result).length, expectedFieldCount, 'expected exactly 16 named Schedule 3 fields')
    },
    dialectIndependence: () => {
        const result = scheduleThree(profileNoDeclaredKinds)
        assert(!('dialect' in result), 'scheduleThree output must not carry a dialect tag')
        assert(!('mediaType' in result), 'scheduleThree output must not carry a mediaType')
    },
}
