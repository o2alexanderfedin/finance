/**
 * Schedule 1 (Form 1040) — TAX-14: Part I (Additional Income, lines 1-10)
 * and Part II (Adjustments to Income, lines 11-26), every printed line
 * named and computed.
 *
 * Source, transcribed directly (13-RESEARCH.md §5), not from recall:
 * `f1040s1.pdf` (2025), "Created" 2025.
 *
 * This is a STANDALONE, independently callable pure function over the
 * declared return profile and stored documents alone — the same relationship
 * `fjs/schedule/b`, `fjs/schedule/a` and `fjs/schedule/1a` have to their own
 * inputs. It is NOT wired into Form 1040's own line 8/line 10 aggregation
 * here, and it does not consult the return-scope guard's own classification
 * function. It imports NOTHING at runtime from `fjs/return/scope` or
 * `fjs/form1040/`.
 *
 * ## The correction history of this header, which is the point of reading it
 *
 * Until 2026-08-15 this file's header said *"none of Schedule 1's Part I
 * income items and none of Part II's adjustments are populated by any kind
 * this engine models"*. Phase 20 made that false for line 7 and the sentence
 * was corrected then, with a note that **a finding is true of the moment it
 * was made, and a docstring that quotes one inherits its expiry.**
 *
 * Phase 24 makes it false again, and by much more. Three of Part II's
 * sixteen printed lines now compute from real documents:
 *
 * | Line | What it reads | Requirement |
 * |---|---|---|
 * | 11 educator expenses | `vnd.fjs.adjustments` entries tagged `educatorExpenses` | TAX-24 |
 * | 13 HSA deduction | `vnd.fjs.adjustments` HSA entries and coverage, plus Form W-2 box 12 code W, through `fjs/form8889` | TAX-24 |
 * | 21 student loan interest | `vnd.fjs.1098e` box 1 **and** `vnd.fjs.adjustments` entries tagged `studentLoanInterest` | TAX-23 |
 *
 * **The hard zeros on those three lines are REPLACED, not supplemented.**
 * `noZeroLineHelperRemainsOnALineThisPhaseClaims` asserts that mechanically:
 * each of the three carries a `rule` naming its own source and, on a return
 * with real documents, a `sources` array that does not cite `declaredKinds`.
 * Every OTHER Part II line is still a `profileDeclaredZeroLine`, and
 * `fjs/return/scope` still refuses each of them by its own name.
 *
 * ## The ordering that breaks a genuine circularity — read before editing
 *
 * Part II cannot be computed in one pass, and the reason is a real fixed
 * point rather than an implementation detail:
 *
 * - Line 21's own printed worksheet takes **Form 1040 line 9** (total income)
 *   as its line 2.
 * - Form 1040 line 9 includes line 6b, taxable Social Security benefits.
 * - The Social Security Benefits Worksheet's line 6 subtracts *"the total of
 *   the amounts from Schedule 1, lines 11 through 20, and 23 and 25"*.
 *
 * If line 6 of that worksheet included line 21, the cycle would close and
 * nothing could be computed. **It does not** — the printed range is *11
 * through 20*, and 21 sits just outside it, as does the reserved line 22.
 * That exclusion is not an accident of drafting; it is what makes the two
 * worksheets composable in one direction, and it is why this module exposes
 * Part II in two stages:
 *
 * 1. {@link scheduleOnePartIIExceptStudentLoanInterest} — every adjustment
 *    that does not depend on income. Its two named totals,
 *    {@link socialSecurityWorksheetAdjustmentsTotal} and
 *    {@link studentLoanInterestWorksheetOtherAdjustments}, are what the two
 *    printed worksheets ask for.
 * 2. {@link scheduleOnePartII} — the same lines plus line 21 and the line 26
 *    total, given a total income the caller has by then computed.
 *
 * {@link scheduleOne} composes the two for any caller that does not need to
 * interleave, and `stagedAndComposedFormsAgreeOnLineTwentySix` pins that the
 * staged path and the composed path cannot drift apart.
 *
 * **The two named totals are DIFFERENT RULES that currently agree.** The
 * Social Security worksheet asks for lines 11-20, 23 and 25; the student loan
 * worksheet asks for lines 11-20 plus write-in adjustments on the dotted line
 * beside line 24z. Line 23 (Archer MSA) is in one and not the other. Both are
 * `line11 + line13` today only because every other summand is a documented
 * zero, and that coincidence is contingent on what remains unmodeled rather
 * than on the rules being one rule — the identical position `fjs/schedule/1a`
 * takes about its own income measure (13-CONTEXT.md Decision 5.6, TAX-15).
 * `theTwoAdjustmentTotalsAreSeparateRulesThatHappenToAgree` says so out loud.
 *
 * ## Line 7 (Phase 20), line 3 (Phase 27) and what remains a documented zero
 *
 * Line 7, unemployment compensation, is summed from `vnd.fjs.1099g` box 1.
 *
 * **Line 3, business income or loss, is Phase 27's** (TAX-30): it is
 * `fjs/schedule/c`'s own line 31, restated under this schedule's printed
 * number and never recomputed here. That is the first line on PART I to read
 * anything but a single box, and it changes this function's shape — see
 * {@link scheduleOnePartI}, which now takes an input object and returns an
 * OUTCOME, because Schedule C can refuse.
 *
 * Every remaining line on this schedule is a `profileDeclaredZeroLine`,
 * citing the profile's own `declaredKinds` box — `fjs/schedule/b`'s Form 8815
 * boundary treatment, copied verbatim in shape.
 *
 * **Line 15, the deductible part of self-employment tax, is REAL as of Phase
 * 28 (TAX-31), and it is the largest single change this schedule has had.**
 * The paragraph that stood here said it was "STILL a documented zero, and
 * Phase 27 deliberately leaves it one"; that is now false, and what replaces
 * it matters more than the line itself:
 *
 * **Line 15 reduces adjusted gross income.** AGI drives the 7.5% medical
 * floor, Schedule 1-A's senior-deduction phase-out, Form 8960's §1411
 * threshold, the Social Security Benefits Worksheet and every credit Phases
 * 24 and 25 wired — so this one line moves six figures downstream of it.
 * Nothing about a return WITHOUT self-employment moves, and that is asserted
 * rather than assumed: with no business record both of line 15's cited
 * inputs are `profileDeclaredZeroLine`s, their union deduplicates to the
 * single `declaredKinds` citation the hard zero always carried, and the value
 * is still $0.00.
 *
 * **Schedule SE runs HERE, in stage 1, and travels out on the result.** This
 * schedule is the first consumer — `fjs/schedule/2` needs the same
 * execution's line 12 for its line 4 and line 6 for Form 8959 Part II, and a
 * second execution would be pricing a return this one had already changed
 * through AGI. `scheduleSelfEmploymentPartI` is called once,
 * {@link ScheduleOnePartIIExceptStudentLoanInterest} carries the whole
 * `SelfEmploymentOutcome`, and `fjs/form1040/core` threads it onward.
 *
 * **The Social Security Benefits Worksheet subtracts line 15**, because its
 * own line 6 asks for "lines 11 through 20", and 15 is inside that range.
 * That was true before and cost nothing while the line was zero; it is a live
 * dependency now, and {@link socialSecurityWorksheetAdjustmentsTotal} is
 * where it is stated.
 *
 * ## The 26/11 sub-line collapses (lines 8/9 and 24/25)
 *
 * The printed form's own line 8 ("Other income") and line 24 ("Other
 * adjustments") are themselves headers over lettered sub-lines (8a-8z,
 * 24a-24z) with no individual dollar box of their own — only the following
 * line (9, 25 respectively) is a genuine printed total box. This module
 * models `line8`/`line24` as ONE collapsed documented zero standing in for
 * the whole lettered group, then `line9`/`line25` restate that same total as
 * their own line, exactly mirroring `fjs/schedule/b`'s `line4 = { ...line2,
 * rule: 'Schedule B line 4' }` copy-line idiom.
 *
 * ## Line 22 ("Reserved for future use")
 *
 * Not a modeling gap — the printed form itself reserves this line number with
 * no box to fill. Modeled as a documented zero for line-number completeness,
 * never contributing anything but `0` to line 26.
 *
 * ## The refusals this module raises, and why they are here rather than in a
 * dialect
 *
 * Part II returns an OUTCOME, not a record: `{ kind: 'ok', … }` or
 * `{ kind: 'error', message }`. Every refusal below is a
 * document-data-sufficiency refusal (12.1-CONTEXT.md Decision 2.6's
 * category), never an `fjs/return/scope` kind, so `fjs/form1040/core` threads
 * it exactly as it already threads Schedule A's and Schedule D's:
 *
 * - **An unrecognized `lineTag`.** `vnd.fjs.adjustments` keeps `lineTag` a
 *   free string on purpose (deciding which line a payment belongs on is
 *   deduction logic), so this is the layer that owns the vocabulary — and it
 *   refuses rather than dropping an amount it does not understand.
 *   `fjs/schedule/a` already does exactly this with its own itemized tags.
 * - **A following-year `datePaid` on anything but an HSA contribution.** That
 *   dialect accepts `taxYear + 1` because an HSA contribution may be
 *   designated for the prior year; a classroom supply bought in March 2026 is
 *   a 2026 deduction, and nothing downstream could notice.
 * - **A spouse-attributed entry on a return with no spouse filing on it.**
 *   §62(a)(2)(D)'s second $300 belongs to a spouse who is filing jointly; on
 *   any other status that entry is a deduction on somebody else's return.
 * - **A 1098-E with box 2 checked.** Box 1 then excludes loan origination
 *   fees and capitalized interest, which are deductible and appear on no
 *   form. See `fjs/document/1098e`'s own header for why the refusal is here
 *   and not at that dialect's ingest.
 * - **An HSA contribution with no coverage record**, and **employer
 *   contributions with no coverage record or with two** — the second is an
 *   attribution gap rather than a form gap: Form W-2 box 12 code W says how
 *   much an employer contributed but nothing this engine models says WHICH
 *   spouse's W-2 it was, so with two account holders the amount cannot be
 *   attributed. Two holders with no employer contributions at all compute
 *   normally, which is what keeps this from being a blanket refusal.
 * - **Everything `fjs/form8889` itself refuses**, threaded up unchanged.
 *
 * The four box-sum/document-line helpers below (`totalLine`, `unionSources`,
 * `profileDeclaredZeroLine`) are reimplemented locally, private and NOT
 * imported from `fjs/form1040/core` — that module does not export them, and
 * this is the same "reimplement an idiom you cannot import" pattern
 * `fjs/schedule/b`/`fjs/schedule/a`/`fjs/schedule/1a` already use.
 *
 * @module
 */
import { assert, assertEq } from 'functionalscript/fjs/asserts/module.f.js'
import { of, halfUp } from '../../types/rational/module.f.js'
import { centsFromString } from '../../exact/module.f.js'
import { form8889PartI } from '../../form8889/module.f.js'
import { scheduleC } from '../c/module.f.js'
import { scheduleE } from '../e/module.f.js'
import {
    scheduleSelfEmploymentPartI,
    socialSecurityWagesAlreadyTaxed,
    twoSelfEmployedPeopleRefusal,
    wagesAttributionRefusal,
} from '../se/module.f.js'
import { taxParamsByYear } from '../../tax/params/module.f.js'

/** @import { ReturnProfile } from '../../return/profile/module.f.js' */
/** @import { OneZeroNineNineG } from '../../document/1099g/module.f.js' */
/** @import { OneZeroNineEightE } from '../../document/1098e/module.f.js' */
/** @import { Adjustments } from '../../document/adjustments/module.f.js' */
/** @import { BusinessExpenses } from '../../document/business_expenses/module.f.js' */
/** @import { OneZeroNineNineNec } from '../../document/1099nec/module.f.js' */
/** @import { ScheduleC } from '../c/module.f.js' */
/** @import { ScheduleE } from '../e/module.f.js' */
/** @import { K1Partnership } from '../../document/k1_1065/module.f.js' */
/** @import { K1SCorporation } from '../../document/k1_1120s/module.f.js' */
/** @import { SelfEmploymentOutcome } from '../se/module.f.js' */
/** @import { W2 } from '../../document/w2/module.f.js' */
/** @import { ReportLine, Source } from '../../report/line/module.f.js' */
/** @import { TaxParamSet, IndividualFilingStatus } from '../../tax/params/module.f.js' */
/** @import { HsaCoverageType } from '../../form8889/module.f.js' */

// ── Inputs ───────────────────────────────────────────────────────────────────

/**
 * A stored document as this module sees it — mirrors `fjs/schedule/b`'s
 * own `Stored<T>`; nothing here re-validates.
 * @template T
 * @typedef {{ readonly documentHash: string, readonly value: T }} Stored
 */

/**
 * The `lineTag` values this module understands, each naming the printed Part
 * II line it feeds. **The whole vocabulary, in one place**, so a tag that is
 * not on it is refused by name rather than silently contributing nothing —
 * see this module's own docstring on why the vocabulary lives here and not in
 * the dialect.
 */
export const adjustmentLineTags = /** @type {const} */ ([
    ['educatorExpenses', 'Schedule 1 line 11'],
    ['hsaContribution', 'Schedule 1 line 13'],
    ['studentLoanInterest', 'Schedule 1 line 21'],
])

/** {@link adjustmentLineTags}' tags alone, widened to plain strings so the
 * membership question can be asked of the `string` a JSON blob's field is —
 * an ordinary widening ASSIGNMENT, never a cast.
 * @type {readonly string[]}
 */
const adjustmentLineTagNames = adjustmentLineTags.map(([tag]) => tag)

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
 * @type {(rule: string) => (lines: readonly ReportLine[]) => ReportLine}
 */
const totalLine = rule => lines => ({
    value: lines.reduce((total, line) => total + line.value, 0n),
    sources: unionSources(lines),
    rule,
})

/**
 * A line built from real document readings, falling back to
 * {@link profileDeclaredZeroLine} when NO document supplied one — mirrors
 * `fjs/form1040/core`'s own private `documentLine`. This is the helper that
 * makes "the hard zero is replaced, not supplemented" true: a line that reads
 * documents never carries a `zero(...)` call at its construction site, and on
 * a return with documents its sources do not mention `declaredKinds` at all.
 * @type {(profile: Stored<ReturnProfile>) => (rule: string) => (value: bigint) => (sources: readonly Source[]) => ReportLine}
 */
const documentLine = profile => rule => value => sources => {
    const [first, ...rest] = sources
    return first === undefined
        ? profileDeclaredZeroLine(profile)(rule)
        : { value, sources: [first, ...rest], rule }
}

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
 * @type {(profile: Stored<ReturnProfile>) => (forms: readonly Stored<OneZeroNineNineG>[]) => ReportLine}
 */
const unemploymentCompensationLine = profile => forms => {
    const rule = 'Schedule 1 line 7 (unemployment compensation)'
    const withBox1 = forms.filter(form => form.value.box1UnemploymentCompensation !== undefined)
    const sources = withBox1.map(form => {
        const printed = form.value.box1UnemploymentCompensation
        assert(printed !== undefined, ['filtered to present box 1', form.documentHash])
        return { documentHash: form.documentHash, boxPath: 'box1UnemploymentCompensation', value: printed }
    })
    const value = sources.reduce((total, source) => total + centsFromString(source.value), 0n)
    return documentLine(profile)(rule)(value)(sources)
}

// ── Part I ───────────────────────────────────────────────────────────────────

/**
 * Part I's ten printed fields (lines 1 through 10, `line8`/`line9` being the
 * 26-sub-line collapse), plus the Schedule C that produced line 3.
 *
 * `scheduleC` is carried out rather than discarded so a caller that wants to
 * report Schedule C's own printed lines can, and so nothing has to run
 * `fjs/schedule/c` a second time to get them — the same reason
 * {@link ScheduleOnePartII} carries its `studentLoanInterestWorksheet`.
 * @typedef {{
 *   readonly kind: 'ok',
 *   readonly line1: ReportLine, readonly line2a: ReportLine, readonly line3: ReportLine,
 *   readonly line4: ReportLine, readonly line5: ReportLine, readonly line6: ReportLine,
 *   readonly line7: ReportLine, readonly line8: ReportLine, readonly line9: ReportLine,
 *   readonly line10: ReportLine,
 *   readonly scheduleC: ScheduleC,
 *   readonly scheduleE: ScheduleE,
 * }} ScheduleOnePartI
 */

/** @typedef {ScheduleOnePartI | ScheduleOneRefusal} ScheduleOnePartIOutcome */

/**
 * @typedef {{
 *   readonly profile: Stored<ReturnProfile>,
 *   readonly unemploymentForms: readonly Stored<OneZeroNineNineG>[],
 *   readonly nonemployeeCompensationForms: readonly Stored<OneZeroNineNineNec>[],
 *   readonly businessExpenseForms: readonly Stored<BusinessExpenses>[],
 *   readonly w2Forms: readonly Stored<W2>[],
 *   readonly partnershipK1Forms: readonly Stored<K1Partnership>[],
 *   readonly sCorporationK1Forms: readonly Stored<K1SCorporation>[],
 * }} ScheduleOnePartIInput
 */

/**
 * Schedule 1 Part I — Additional Income, lines 1 through 10. Line 10 feeds
 * 1040 line 8.
 *
 * **TWO lines now compute from documents**, and this function's shape changed
 * with the second:
 *
 * | Line | What it reads | Requirement |
 * |---|---|---|
 * | 3 business income or loss | `fjs/schedule/c` line 31, from `vnd.fjs.1099nec` and `vnd.fjs.business_expenses` | TAX-30 |
 * | 7 unemployment compensation | `vnd.fjs.1099g` box 1 | Phase 20 |
 *
 * It takes an INPUT OBJECT and returns an OUTCOME rather than a bare record,
 * because Schedule C can refuse — a net loss, a second business, an
 * unrecognized expense category, an unmodeled printed line. Those are
 * document-data-sufficiency refusals in exactly the sense Part II's already
 * are, so `fjs/form1040/core` threads them through the arm it already has.
 *
 * **Line 3 is a `profileDeclaredZeroLine` for a return with no business**, not
 * a refusal and not an absent line: `fjs/schedule/c` returns `filed: false`
 * with a schedule of documented zeros, so PROV-01 holds and a return with no
 * self-employment computes byte for byte what it computed before Phase 27.
 * `theEmptyReturnComputesExactlyWhatItComputedBeforeThisPhase` is where that
 * is asserted.
 * **This function takes no `TaxParamSet` as of Phase 28.** It threaded one
 * through to `fjs/schedule/c` for that module's single parameter read, the
 * §1402(b)(2) floor it compared net profit against; Phase 28 moved that
 * comparison to printed Schedule SE line 4c, Schedule C was left with no
 * tax-year parameter at all, and so is this. See `fjs/schedule/c`'s own
 * {@link scheduleC} docstring for why keeping an unread argument "for
 * symmetry" is the thing not to do.
 * @type {(input: ScheduleOnePartIInput) => ScheduleOnePartIOutcome}
 */
export const scheduleOnePartI = input => {
    const {
        profile, unemploymentForms, nonemployeeCompensationForms, businessExpenseForms, w2Forms,
        partnershipK1Forms, sCorporationK1Forms,
    } = input
    const zero = profileDeclaredZeroLine(profile)
    const scheduleCOutcome = scheduleC({
        profile, nonemployeeCompensationForms, businessExpenseForms, w2Forms,
    })
    if (scheduleCOutcome.kind === 'error') {
        return scheduleCOutcome
    }
    const scheduleEOutcome = scheduleE({ profile, partnershipK1Forms, sCorporationK1Forms })
    if (scheduleEOutcome.kind === 'error') {
        return scheduleEOutcome
    }
    const line1 = zero('Schedule 1 line 1 (taxable state/local income tax refunds)')
    const line2a = zero('Schedule 1 line 2a (alimony received)')
    // 3. "Business income or (loss). Attach Schedule C." -- Schedule C's own
    //    line 31, restated under this schedule's printed number, never
    //    recomputed here. TAX-30.
    const line3 = {
        ...scheduleCOutcome.partII.line31,
        rule: 'Schedule 1 line 3 (business income/loss, Schedule C line 31)',
    }
    const line4 = zero('Schedule 1 line 4 (other gains/losses, Form 4797/4684)')
    // 5. "Rental real estate, royalties, partnerships, S corporations,
    //    trusts, etc. Attach Schedule E." -- Schedule E's own line 41,
    //    restated under this schedule's printed number and never recomputed
    //    here, exactly as line 3 restates Schedule C line 31. TAX-35.
    //
    //    Four of line 41's five summands are documented zeros, because four
    //    of Schedule E's five parts refuse; the fifth is Part II's line 32.
    const line5 = {
        ...scheduleEOutcome.parts.line41,
        rule: 'Schedule 1 line 5 (rental real estate, royalties, partnerships, S corporations, Schedule E line 41)',
    }
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
    return {
        kind: 'ok',
        line1, line2a, line3, line4, line5, line6, line7, line8, line9, line10,
        scheduleC: scheduleCOutcome,
        scheduleE: scheduleEOutcome,
    }
}

// ── Part II, stage 1: every adjustment that does not depend on income ────────

/**
 * A case this module will not compute — the same shape `fjs/form8889`,
 * `fjs/schedule/a` and `fjs/schedule/d` already return, so
 * `fjs/form1040/core` threads it through its existing error arm with no new
 * mechanism. No `unmodeled` field: this is document-data sufficiency, not an
 * `fjs/return/scope` kind.
 * @typedef {{ readonly kind: 'error', readonly message: string }} ScheduleOneRefusal
 */

/**
 * @typedef {{
 *   readonly kind: 'ok',
 *   readonly line11: ReportLine, readonly line12: ReportLine, readonly line13: ReportLine,
 *   readonly line14: ReportLine, readonly line15: ReportLine, readonly line16: ReportLine,
 *   readonly line17: ReportLine, readonly line18: ReportLine, readonly line19a: ReportLine,
 *   readonly line20: ReportLine, readonly line22: ReportLine, readonly line23: ReportLine,
 *   readonly line24: ReportLine, readonly line25: ReportLine,
 *   readonly selfEmployment: SelfEmploymentOutcome,
 * }} ScheduleOnePartIIExceptStudentLoanInterest
 */

/** @typedef {ScheduleOnePartIIExceptStudentLoanInterest | ScheduleOneRefusal} ScheduleOnePartIIStageOneOutcome */

/**
 * `businessNetProfit` is **Schedule C's own line 31**, which printed Schedule
 * SE line 2 asks for by that name — passed in from Part I's already-computed
 * result rather than recomputed, so line 3 and line 15 can never disagree
 * about the same profit. `businessExpenseForms` is here for exactly ONE
 * field, the proprietor's `recipientTin`, which decides whose Forms W-2
 * consume the §1402(b)(1) wage base; `fjs/schedule/se`'s own docstring
 * carries that argument.
 * @typedef {{
 *   readonly profile: Stored<ReturnProfile>,
 *   readonly status: IndividualFilingStatus,
 *   readonly adjustmentForms: readonly Stored<Adjustments>[],
 *   readonly w2Forms: readonly Stored<W2>[],
 *   readonly businessNetProfit: ReportLine,
 *   readonly businessExpenseForms: readonly Stored<BusinessExpenses>[],
 *   readonly passThrough: PassThroughSelfEmployment,
 * }} ScheduleOnePartIIStageOneInput
 */

/**
 * Schedule E's two contributions to Schedule SE, carried together so the
 * earnings and the person they belong to cannot be threaded separately and
 * come apart.
 *
 * `earningsCents` is the sum of Schedule K-1 (Form 1065) box 14 code A, which
 * printed Schedule SE line 2 names; `recipientTin` is whose it is, for
 * §1402(b)(1)'s per-person wage base. `undefined` means no row carried any
 * earnings at all — every S-corporation-only return and every limited-partner
 * one — which is a DIFFERENT state from a TIN with zero earnings and is why
 * this is not simply a string.
 * @typedef {{
 *   readonly earningsCents: bigint,
 *   readonly recipientTin: string | undefined,
 * }} PassThroughSelfEmployment
 */

/**
 * Schedule E's own execution, reduced to what Schedule SE needs — written once
 * so the two call sites that stage Part II (`scheduleOne` here, and
 * `fjs/form1040/core`) cannot pick the fields apart differently.
 *
 * It reads the ALREADY-COMPUTED Schedule E rather than re-running it, for the
 * reason `fjs/schedule/se`'s `SelfEmploymentOutcome` gives about its own
 * record: Schedule SE line 13 reduces adjusted gross income, so a second
 * execution would be pricing a return the first one had already changed.
 * @type {(schedule: ScheduleE) => PassThroughSelfEmployment}
 */
export const passThroughOf = schedule => ({
    earningsCents: schedule.selfEmploymentEarningsCents,
    recipientTin: schedule.selfEmployedRecipientTin,
})

/**
 * One `vnd.fjs.adjustments` entry, paired with the hash of the document it
 * came from — `fjs/schedule/a`'s own flattening shape, applied one schedule
 * over.
 * @typedef {{ readonly documentHash: string, readonly value: Adjustments['entries'][number] }} StoredEntry
 */

/** One `hsaCoverage` record with its document hash.
 * @typedef {{ readonly documentHash: string, readonly value: NonNullable<Adjustments['hsaCoverage']>[number] }} StoredCoverage
 */

/**
 * Narrows an already-validated `coverageType` string to {@link HsaCoverageType}
 * by FINDING it in the list rather than asserting a predicate over the
 * incoming string — the identical device, for the identical reason, as
 * `fjs/form1040/core`'s `storedFilingStatusNamed`: the value that flows
 * onward is the one from this module's own list, not the one off the blob,
 * and AGENTS.md bans the cast that would otherwise be needed.
 *
 * `undefined` is unreachable for a validated document —
 * `fjs/document/adjustments`' own `checkReferences` already refuses anything
 * else — and the caller turns it into a refusal rather than a throw.
 * @type {(coverageType: string) => HsaCoverageType | undefined}
 */
const hsaCoverageTypeNamed = coverageType =>
    coverageType === 'selfOnly' ? 'selfOnly'
        : coverageType === 'family' ? 'family'
            : undefined

/**
 * Form W-2 box 12 code W — "Employer contributions to your health savings
 * account", including anything the employee routed through a cafeteria plan.
 * Form 8889 line 9.
 *
 * The code is matched case-insensitively after trimming, because
 * `fjs/document/w2` stores box 12's code "as printed" and never interprets
 * it. A code that arrives as `'w'` or `' W'` is the same box; a code that
 * arrives as `'WW'` is not, so the comparison is on the whole trimmed string
 * rather than a prefix.
 * @type {(w2s: readonly Stored<W2>[]) => readonly Source[]}
 */
const employerHsaContributionSources = w2s => w2s.flatMap(form =>
    (form.value.box12 ?? [])
        .filter(entry => entry.code.trim().toUpperCase() === 'W')
        .map(entry => ({
            documentHash: form.documentHash,
            boxPath: 'box12[code=W]',
            value: entry.amount,
        })))

/**
 * Schedule 1 Part II, stage 1 — lines 11 through 20, 22, 23, 24 and 25:
 * every adjustment that does NOT depend on income. Line 21 and the line 26
 * total are {@link scheduleOnePartII}'s, one stage later; see this module's
 * own docstring, "The ordering that breaks a genuine circularity".
 * @type {(taxParamSet: TaxParamSet) => (input: ScheduleOnePartIIStageOneInput) => ScheduleOnePartIIStageOneOutcome}
 */
export const scheduleOnePartIIExceptStudentLoanInterest = taxParamSet => input => {
    const {
        profile, status, adjustmentForms, w2Forms, businessNetProfit, businessExpenseForms,
        passThrough,
    } = input
    const zero = profileDeclaredZeroLine(profile)
    /** @type {readonly StoredEntry[]} */
    const entries = adjustmentForms.flatMap(form =>
        form.value.entries.map(entry => ({ documentHash: form.documentHash, value: entry })))
    /** @type {readonly StoredCoverage[]} */
    const coverages = adjustmentForms.flatMap(form =>
        (form.value.hsaCoverage ?? []).map(value => ({ documentHash: form.documentHash, value })))

    // ── The entry-level refusals, all of them BEFORE any line is built ──────
    for (const entry of entries) {
        if (!adjustmentLineTagNames.includes(entry.value.lineTag)) {
            return {
                kind: 'error',
                message: `Schedule 1 Part II: the adjustments document carries an entry tagged `
                    + `'${entry.value.lineTag}' (${entry.value.description}, `
                    + `${entry.value.amount}), which is not one of the ${adjustmentLineTags.length} `
                    + `Part II lines this engine computes `
                    + `(${adjustmentLineTagNames.join(', ')}). Refusing rather than dropping an `
                    + `adjustment from line 26 and overstating the tax`,
            }
        }
        const paidInFollowingYear = entry.value.datePaid.startsWith(`${profile.value.taxYear + 1}-`)
        if (paidInFollowingYear && entry.value.lineTag !== 'hsaContribution') {
            return {
                kind: 'error',
                message: `Schedule 1 Part II: '${entry.value.description}' is tagged `
                    + `'${entry.value.lineTag}' and was paid on ${entry.value.datePaid}, in the year `
                    + `AFTER tax year ${profile.value.taxYear}. Only a health savings account `
                    + `contribution may be designated for the prior year; every other adjustment is `
                    + `deducted in the year it was paid, so this belongs on the following year's `
                    + `return`,
            }
        }
        if (entry.value.individual === 'spouse' && status !== 'marriedFilingJointly') {
            return {
                kind: 'error',
                message: `Schedule 1 Part II: '${entry.value.description}' is attributed to the `
                    + `spouse, but this return's filing status is ${status}. A spouse's adjustment `
                    + `reaches a joint return only; on any other status it belongs on the spouse's `
                    + `own return`,
            }
        }
    }

    // ── Line 11: educator expenses, capped PER ELIGIBLE EDUCATOR ────────────
    //
    // §62(a)(2)(D)'s $300 is each eligible educator's own cap, so the sum is
    // capped once per `individual` and the two capped figures are then added
    // -- never capped once on the combined total, which would silently halve
    // a two-educator couple's deduction, and never left uncapped per person,
    // which would let one spouse's $600 pass as if it were two people's.
    const educatorCapCents = centsFromString(
        taxParamSet.educatorExpenses.maximumPerEligibleEducator.amount)
    const educatorEntries = entries.filter(entry => entry.value.lineTag === 'educatorExpenses')
    /** @type {readonly ('taxpayer' | 'spouse')[]} */
    const bothIndividuals = ['taxpayer', 'spouse']
    const line11Value = bothIndividuals.reduce((total, who) => {
        const paid = educatorEntries
            .filter(entry => entry.value.individual === who)
            .reduce((sum, entry) => sum + centsFromString(entry.value.amount), 0n)
        return total + (paid < educatorCapCents ? paid : educatorCapCents)
    }, 0n)
    const line11 = documentLine(profile)('Schedule 1 line 11 (educator expenses)')(line11Value)(
        educatorEntries.map(entry => ({
            documentHash: entry.documentHash,
            boxPath: `entries[lineTag=educatorExpenses,individual=${entry.value.individual}]`,
            value: entry.value.amount,
        })))

    const line12 = zero('Schedule 1 line 12 (certain business expenses of reservists/performing artists/fee-basis officials)')

    // ── Line 13: the HSA deduction, through Form 8889 Part I ────────────────
    const hsaEntries = entries.filter(entry => entry.value.lineTag === 'hsaContribution')
    const employerSources = employerHsaContributionSources(w2Forms)
    const employerContributionCents = employerSources.reduce(
        (total, source) => total + centsFromString(source.value), 0n)
    if (employerContributionCents !== 0n && coverages.length === 0) {
        return {
            kind: 'error',
            message: 'Schedule 1 line 13: a Form W-2 reports employer contributions to a health '
                + 'savings account in box 12 code W, but no adjustments document records the '
                + 'coverage type behind them. Without Form 8889 line 1 this engine cannot tell '
                + 'whether those contributions exceed the §223(b) limit, which would be an excess '
                + 'contribution taxable on Form 5329; refusing rather than reporting a $0 deduction '
                + 'beside a tax it did not check for',
        }
    }
    if (employerContributionCents !== 0n && coverages.length > 1) {
        return {
            kind: 'error',
            message: 'Schedule 1 line 13: this return carries two health savings account holders '
                + 'and a Form W-2 reporting employer contributions in box 12 code W, and no '
                + "document this engine models says WHICH spouse's W-2 it is. Attributing the "
                + "contributions to the wrong holder would move both holders' limits; refusing "
                + 'rather than guessing (no phase yet)',
        }
    }
    const familyCoverageWithTwoHolders =
        coverages.length > 1 && coverages.some(c => c.value.coverageType === 'family')
    /** @type {bigint} */
    let line13Value = 0n
    /** @type {Source[]} */
    const line13Sources = []
    for (const coverage of coverages) {
        const coverageType = hsaCoverageTypeNamed(coverage.value.coverageType)
        if (coverageType === undefined) {
            return {
                kind: 'error',
                message: `Schedule 1 line 13: the adjustments document records an HSA coverage type `
                    + `'${coverage.value.coverageType}' this engine has no §223(b) limit for`,
            }
        }
        const ownEntries = hsaEntries.filter(
            entry => entry.value.individual === coverage.value.individual)
        const outcome = form8889PartI(taxParamSet)({
            coverageType,
            fullYearSameCoverageEligible: coverage.value.hadHighDeductibleCoverageAllYear === true,
            catchUpEligible: coverage.value.eligibleForCatchUpContribution === true,
            qualifiedHsaFundingDistributionDeclared:
                coverage.value.madeQualifiedHsaFundingDistribution === true,
            spouseCouldSplitTheFamilyLimit: familyCoverageWithTwoHolders,
            personalContributionCents: ownEntries.reduce(
                (sum, entry) => sum + centsFromString(entry.value.amount), 0n),
            // Every employer contribution belongs to the single holder when
            // there is one; with two holders the refusal above has already
            // guaranteed this total is zero, so no branch is needed and none
            // is written (one rule, one place).
            employerContributionCents,
        })
        if (outcome.kind === 'error') {
            return outcome
        }
        line13Value += outcome.line13
        line13Sources.push(
            {
                documentHash: coverage.documentHash,
                boxPath: `hsaCoverage[individual=${coverage.value.individual}].coverageType`,
                value: coverage.value.coverageType,
            },
            ...ownEntries.map(entry => ({
                documentHash: entry.documentHash,
                boxPath: `entries[lineTag=hsaContribution,individual=${entry.value.individual}]`,
                value: entry.value.amount,
            })),
        )
    }
    // An HSA contribution attributed to somebody with no coverage record is
    // an amount no §223(b) limit can be applied to. Checked AFTER the loop,
    // by counting what the loop actually consumed, so the check cannot drift
    // from the attribution the loop performed.
    const hsaEntriesConsumed = hsaEntries.filter(entry =>
        coverages.some(coverage => coverage.value.individual === entry.value.individual))
    if (hsaEntriesConsumed.length !== hsaEntries.length) {
        return {
            kind: 'error',
            message: 'Schedule 1 line 13: the adjustments document records a health savings account '
                + 'contribution for a person it records no coverage type for. Form 8889 line 1 '
                + 'decides which §223(b) limit applies, and there is no safe default between '
                + '$4,300 and $8,550; refusing rather than choosing one',
        }
    }
    // Employer contributions with a coverage record but no HSA holder to
    // attach them to cannot happen -- `coverages.length === 0` is refused
    // above -- so `line13Sources` carries the W-2 boxes only when a holder
    // consumed them, which is what keeps the citation honest.
    if (coverages.length === 1) {
        line13Sources.push(...employerSources)
    }
    const line13 = documentLine(profile)('Schedule 1 line 13 (HSA deduction, Form 8889 line 13)')(
        line13Value)(line13Sources)

    const line14 = zero('Schedule 1 line 14 (moving expenses for Armed Forces members)')

    // ── Line 15: the deductible half of self-employment tax (TAX-31) ────────
    //
    // **Schedule SE is executed HERE, once, and travels out on the result.**
    // This schedule needs its line 13 for the line below; `fjs/schedule/2`
    // needs its line 12 for that schedule's line 4 and its line 6 for Form
    // 8959 Part II. Running it twice would not merely risk drift: line 13
    // reduces adjusted gross income, so a second execution would be pricing a
    // return the first one had already changed. `fjs/schedule/se`'s own
    // `SelfEmploymentOutcome` carries the argument in full.
    const [firstBusiness] = businessExpenseForms
    const businessRecipientTin = firstBusiness === undefined
        ? undefined
        : firstBusiness.value.recipientTin
    // **Whose self-employment income this is, with TWO possible sources as of
    // Phase 30.** Before it, the only one was the business expenses record and
    // `fjs/schedule/c` refuses a second; a partnership Schedule K-1 is a
    // second source with its own `recipientTin`, so a joint return may now
    // legitimately hold one spouse's Schedule C and the other's K-1. Schedule
    // SE is filed PER PERSON and this engine computes one, so the two naming
    // different people refuses -- see `fjs/schedule/se`'s own
    // {@link twoSelfEmployedPeopleRefusal} for why merging them is not an
    // approximation.
    if (
        businessRecipientTin !== undefined
        && passThrough.recipientTin !== undefined
        && businessRecipientTin !== passThrough.recipientTin
    ) {
        return twoSelfEmployedPeopleRefusal(businessRecipientTin)(passThrough.recipientTin)
    }
    const proprietorTin = businessRecipientTin ?? passThrough.recipientTin
    // Whose Forms W-2 consume the wage base is decidable on a joint return
    // and not on any other; the refusal is `fjs/schedule/se`'s, threaded
    // exactly like Form 8889's below.
    if (proprietorTin !== undefined) {
        const attribution = wagesAttributionRefusal(status)(w2Forms)(proprietorTin)
        if (attribution.kind === 'error') {
            return attribution
        }
    }
    const wages = socialSecurityWagesAlreadyTaxed(w2Forms)(proprietorTin)
    const socialSecurityWages = documentLine(profile)(
        'Schedule SE line 8a (social security wages and tips already subject to tax)')(
        wages.cents)(wages.sources)
    const selfEmploymentLines = scheduleSelfEmploymentPartI(taxParamSet)({
        netProfitCents: businessNetProfit.value,
        partnershipSelfEmploymentEarningsCents: passThrough.earningsCents,
        socialSecurityWagesCents: wages.cents,
    })
    // 15. "Deductible part of self-employment tax. Attach Schedule SE."
    //     Schedule SE line 13, restated under this schedule's printed number
    //     and never recomputed here -- the same copy-line discipline line 3
    //     follows for Schedule C's line 31.
    //
    //     **On a return with no business both cited lines are
    //     `profileDeclaredZeroLine`s, so the union deduplicates to the single
    //     `declaredKinds` citation this line has always carried.** That is
    //     what keeps a return without self-employment byte-identical, and
    //     `lineFifteenIsAComputedZeroCitingOnlyTheProfileWhenThereIsNoBusiness`
    //     is the leaf that pins it rather than leaving it to be noticed.
    const line15 = {
        value: selfEmploymentLines.line13,
        sources: unionSources([businessNetProfit, socialSecurityWages]),
        rule: 'Schedule 1 line 15 (deductible part of self-employment tax, Schedule SE line 13)',
    }
    const line16 = zero('Schedule 1 line 16 (SEP/SIMPLE/qualified plans)')
    const line17 = zero('Schedule 1 line 17 (self-employed health insurance deduction)')
    const line18 = zero('Schedule 1 line 18 (penalty on early withdrawal of savings)')
    const line19a = zero('Schedule 1 line 19a (alimony paid)')
    const line20 = zero('Schedule 1 line 20 (IRA deduction)')
    // 22. "Reserved for future use" -- the form's own inert line.
    const line22 = zero('Schedule 1 line 22 (reserved for future use)')
    const line23 = zero('Schedule 1 line 23 (Archer MSA deduction)')
    // 24. "Other adjustments" -- a collapsed stand-in for 24a-24z (11
    //     sub-lines); see this module's own docstring.
    const line24 = zero('Schedule 1 line 24 (other adjustments, 24a-24z collapsed -- none separately reachable)')
    // 25. "Total other adjustments. Add lines 24a through 24z" -- the SAME
    //     total, restated as its own printed line.
    const line25 = { ...line24, rule: 'Schedule 1 line 25 (total other adjustments)' }
    return {
        kind: 'ok',
        line11, line12, line13, line14, line15, line16, line17, line18, line19a,
        line20, line22, line23, line24, line25,
        selfEmployment: {
            lines: selfEmploymentLines,
            netProfit: businessNetProfit,
            socialSecurityWages,
        },
    }
}

// ── The two named adjustment totals ──────────────────────────────────────────

/**
 * **The Social Security Benefits Worksheet's own line 6**: *"Enter the total
 * of the amounts from Schedule 1, lines 11 through 20, and 23 and 25."*
 *
 * Lines 21 and 22 are OUTSIDE that range, and that exclusion is what makes
 * the whole computation orderable — see this module's own docstring, "The
 * ordering that breaks a genuine circularity". Written as its own named
 * function, never inlined at the call site, so the range this worksheet asks
 * for is stated once and can be compared against the printed page.
 * @type {(partII: ScheduleOnePartIIExceptStudentLoanInterest) => bigint}
 */
export const socialSecurityWorksheetAdjustmentsTotal = partII =>
    partII.line11.value + partII.line12.value + partII.line13.value + partII.line14.value
    + partII.line15.value + partII.line16.value + partII.line17.value + partII.line18.value
    + partII.line19a.value + partII.line20.value
    + partII.line23.value + partII.line25.value

/**
 * **The Student Loan Interest Deduction Worksheet's own line 3**: *"Enter the
 * total of the amounts from Schedule 1, lines 11 through 20, plus any
 * write-in adjustments you entered on the dotted line next to Schedule 1,
 * line 24z."*
 *
 * A DIFFERENT range from {@link socialSecurityWorksheetAdjustmentsTotal}'s:
 * line 23 (Archer MSA) is in that one and not in this one, and this one takes
 * only the WRITE-IN part of the 24a-24z block rather than the whole of line
 * 25. The two agree today at `line11 + line13` because every other summand is
 * a documented zero, and that agreement is contingent on what remains
 * unmodeled rather than on the rules being one rule — TAX-15's own position,
 * pinned by `theTwoAdjustmentTotalsAreSeparateRulesThatHappenToAgree`.
 * @type {(partII: ScheduleOnePartIIExceptStudentLoanInterest) => bigint}
 */
export const studentLoanInterestWorksheetOtherAdjustments = partII => {
    // The write-in portion of line 24z. This engine models no write-in
    // adjustment at all, so it is a permanent, documented zero — named
    // rather than omitted, because "lines 11 through 20" and "lines 11
    // through 20 plus write-ins" are different sentences and a reader must
    // be able to see which one is implemented.
    const writeInAdjustmentsOnLine24z = 0n
    return partII.line11.value + partII.line12.value + partII.line13.value + partII.line14.value
        + partII.line15.value + partII.line16.value + partII.line17.value + partII.line18.value
        + partII.line19a.value + partII.line20.value
        + writeInAdjustmentsOnLine24z
}

/**
 * **TAX-15's named income function for the student loan interest phase-out**
 * — the printed worksheet's own line 4, *"Subtract line 3 from line 2"*,
 * where line 2 is Form 1040 line 9 and line 3 is
 * {@link studentLoanInterestWorksheetOtherAdjustments}.
 *
 * Its own add-back list, which is NOT §1411's (Phase 23), NOT Schedule 1-A's
 * senior-deduction measure, and NOT the IRA deduction's: it starts from TOTAL
 * INCOME rather than from AGI, and subtracts back exactly the adjustments
 * that are neither this deduction itself nor the reserved line beside it.
 * §221(b)(2)(C) also excludes §911/§931/§933 foreign and possessions income
 * from the subtraction, every one of which is either unmodeled or a refused
 * kind in this engine and therefore permanently zero — named below rather
 * than omitted, mirroring `fjs/schedule/1a`'s own four zero add-backs.
 *
 * **It is deliberately not named for the acronym the instructions use**
 * (TAX-15's rule, which the repo-wide gate in the root test directory
 * enforces by refusing that acronym as a lowercase identifier anywhere under
 * `fjs/`): three different modified adjusted gross incomes now exist in this
 * engine with three different add-back lists, and a shared name would make
 * them look like one quantity. This one is not even shaped like the others —
 * it starts from TOTAL INCOME, where §1411's and Schedule 1-A's both start
 * from AGI.
 * @type {(totalIncomeCents: bigint) => (otherAdjustmentsCents: bigint) => bigint}
 */
export const studentLoanInterestPhaseoutIncome = totalIncomeCents => otherAdjustmentsCents => {
    // §221(b)(2)(C)'s own exclusions, every term permanently zero here.
    const section911ForeignEarnedIncomeExclusion = 0n
    const section931GuamAmericanSamoaNorthernMarianaExclusion = 0n
    const section933PuertoRicoExclusion = 0n
    return totalIncomeCents - otherAdjustmentsCents
        + section911ForeignEarnedIncomeExclusion
        + section931GuamAmericanSamoaNorthernMarianaExclusion
        + section933PuertoRicoExclusion
}

// ── Line 21's printed worksheet ──────────────────────────────────────────────

/**
 * The Student Loan Interest Deduction Worksheet (Schedule 1 line 21), all
 * nine printed lines under their own printed numbers. `w` prefixes them so a
 * reader cannot confuse worksheet line 3 with Schedule 1 line 3.
 * @typedef {{
 *   readonly w1: bigint, readonly w2: bigint, readonly w3: bigint,
 *   readonly w4: bigint, readonly w5: bigint, readonly w6: bigint,
 *   readonly w7Thousandths: bigint, readonly w8: bigint, readonly w9: bigint,
 * }} StudentLoanInterestWorksheet
 */

/**
 * @typedef {{
 *   readonly status: IndividualFilingStatus,
 *   readonly interestPaidCents: bigint,
 *   readonly totalIncomeCents: bigint,
 *   readonly otherAdjustmentsCents: bigint,
 * }} StudentLoanInterestWorksheetInput
 */

/**
 * The Student Loan Interest Deduction Worksheet, transcribed line for line.
 *
 * ## The married-filing-separately short-circuit runs BEFORE line 1
 *
 * §221(e)(2): *"if the taxpayer is married at the close of the taxable year,
 * the deduction shall be allowed … only if the taxpayer and the taxpayer's
 * spouse file a joint return."* So a married-filing-separately filer gets $0
 * at ANY income, and the gate runs as this function's FIRST statement, before
 * `w1` is even assigned — the identical ordering discipline
 * `fjs/schedule/1a`'s own MFS short-circuit follows, and for the identical
 * reason: MFS has no stored threshold at all, so leaving it to fall out of
 * the arithmetic is not merely untidy, it is unrepresentable.
 *
 * ## The phase-out is a RATIO, and the rounding point is the printed line 7
 *
 * Line 7 reads *"Divide line 6 by $15,000 ($30,000 if married filing
 * jointly). Enter the result as a decimal (rounded to at least three
 * places). If the result is 1.000 or more, enter 1.000."* So the printed page
 * rounds ONCE, at the ratio, to three decimal places — and only then
 * multiplies. `w7Thousandths` is that ratio in thousandths, an exact integer,
 * and `w8` rounds the product to the cent.
 *
 * ## Where that rounding point is observable, and where it is NOT
 *
 * **This section was rewritten after a mutation.** It first claimed that the
 * one-cent-over-the-threshold case distinguishes the printed order from the
 * obvious alternative (`round(w1 × w6 ÷ range)`, one rounding at the end). It
 * does not, and the mutation proved it: at $0.01 over the threshold the
 * printed order gives `w1 × 0.000 = $0.00` and the alternative gives
 * `round($0.0012) = $0.00`. Both are zero. Every other fixture in this file
 * agreed too, and the whole suite stayed green with the rounding point moved
 * — the "equivalent mutant" AGENTS.md describes, except that this one is not
 * equivalent at all; the fixtures simply never reached an input where the two
 * differ.
 *
 * They differ **only when the exact ratio is close to a half-thousandth**,
 * where the printed three-decimal rounding moves the multiplier by up to
 * 0.0005 and so moves the deduction by up to `w1 × 0.0005`. At a phase-out
 * income of $92,507.50 the exact ratio is 7,507.50 ÷ 15,000 = 0.5005, which
 * the printed line 7 rounds UP to 0.501: line 8 is $923.16 by the printed
 * order and $922.24 by the alternative, and line 9 is $919.47 or $920.39 —
 * ninety-two cents apart. `theRoundingPointIsTheRatioNotTheProduct` is that
 * fixture, and it is the ONLY leaf in this file that constrains the order.
 *
 * The one-cent case is still worth pinning, for a different property: **one
 * cent over the threshold produces the FULL deduction**, because 0.01 ÷
 * 15,000 rounds to 0.000. That is a real and surprising consequence of the
 * printed page, and `theOneCentOverTheThresholdCase` records it — but it is
 * evidence about the THRESHOLD comparison, not about the rounding point, and
 * this paragraph exists so nobody reads it as the latter again.
 *
 * "Rounded to AT LEAST three places" permits more precision; exactly three is
 * what the printed line's own `. _ _ _` boxes hold, so exactly three is what
 * is implemented, and this sentence is the record of that choice.
 * @type {(taxParamSet: TaxParamSet) => (input: StudentLoanInterestWorksheetInput) => StudentLoanInterestWorksheet}
 */
export const studentLoanInterestWorksheet = taxParamSet => input => {
    const { status, interestPaidCents, totalIncomeCents, otherAdjustmentsCents } = input
    // §221(e)(2), before anything else -- see this function's own docstring.
    if (status === 'marriedFilingSeparately') {
        return { w1: 0n, w2: 0n, w3: 0n, w4: 0n, w5: 0n, w6: 0n, w7Thousandths: 0n, w8: 0n, w9: 0n }
    }
    const { studentLoanInterestDeduction } = taxParamSet
    const maximumCents = centsFromString(studentLoanInterestDeduction.maximumDeduction.amount)
    // 1. "Enter the total interest you paid in 2025 on qualified student
    //    loans. Don't enter more than $2,500."
    const w1 = interestPaidCents < maximumCents ? interestPaidCents : maximumCents
    // 2. "Enter the amount from Form 1040 or 1040-SR, line 9."
    const w2 = totalIncomeCents
    // 3. "Enter the total of the amounts from Schedule 1, lines 11 through
    //    20, plus any write-in adjustments ... next to Schedule 1, line 24z."
    const w3 = otherAdjustmentsCents
    // 4. "Subtract line 3 from line 2." -- the phase-out income, through its
    //    own named function (TAX-15) rather than a bare subtraction here.
    const w4 = studentLoanInterestPhaseoutIncome(w2)(w3)
    // 5. The filing-status threshold.
    const w5 = centsFromString(studentLoanInterestDeduction.phaseoutThreshold[status].amount)
    // 6. "Is the amount on line 4 more than the amount on line 5? No -- skip
    //    lines 6 and 7, enter -0- on line 8. Yes -- subtract line 5 from line
    //    4."
    const w6 = w4 > w5 ? w4 - w5 : 0n
    // 7. "Divide line 6 by $15,000 ($30,000 if married filing jointly). Enter
    //    the result as a decimal (rounded to at least three places). If the
    //    result is 1.000 or more, enter 1.000."
    const rangeCents = centsFromString(studentLoanInterestDeduction.phaseoutRange[status].amount)
    const ratioThousandths = halfUp(of(w6 * 1000n)(rangeCents))
    const w7Thousandths = ratioThousandths < 1000n ? ratioThousandths : 1000n
    // 8. "Multiply line 1 by line 7." -- rounded to the cent, half-up, the
    //    second and last rounding point on the printed page.
    const w8 = halfUp(of(w1 * w7Thousandths)(1000n))
    // 9. "Student loan interest deduction. Subtract line 8 from line 1."
    const w9 = w1 - w8
    assert(w9 >= 0n, ['the student loan interest deduction must never be negative', w9])
    return { w1, w2, w3, w4, w5, w6, w7Thousandths, w8, w9 }
}

// ── Part II, stage 2: line 21 and the line 26 total ──────────────────────────

/**
 * @typedef {{
 *   readonly kind: 'ok',
 *   readonly line11: ReportLine, readonly line12: ReportLine, readonly line13: ReportLine,
 *   readonly line14: ReportLine, readonly line15: ReportLine, readonly line16: ReportLine,
 *   readonly line17: ReportLine, readonly line18: ReportLine, readonly line19a: ReportLine,
 *   readonly line20: ReportLine, readonly line21: ReportLine, readonly line22: ReportLine,
 *   readonly line23: ReportLine, readonly line24: ReportLine, readonly line25: ReportLine,
 *   readonly line26: ReportLine,
 *   readonly studentLoanInterestWorksheet: StudentLoanInterestWorksheet,
 * }} ScheduleOnePartII
 */

/** @typedef {ScheduleOnePartII | ScheduleOneRefusal} ScheduleOnePartIIOutcome */

/**
 * @typedef {{
 *   readonly profile: Stored<ReturnProfile>,
 *   readonly status: IndividualFilingStatus,
 *   readonly exceptStudentLoanInterest: ScheduleOnePartIIExceptStudentLoanInterest,
 *   readonly adjustmentForms: readonly Stored<Adjustments>[],
 *   readonly studentLoanInterestForms: readonly Stored<OneZeroNineEightE>[],
 *   readonly totalIncomeLine: ReportLine,
 * }} ScheduleOnePartIIInput
 */

/**
 * Schedule 1 Part II, stage 2 — line 21 and the line 26 total, given stage
 * 1's already-computed lines and the total income (Form 1040 line 9) the
 * printed worksheet's line 2 asks for.
 *
 * **Line 21 reads TWO dialects**, and that is the decision
 * `fjs/document/1098e`'s header records in full: every stored 1098-E box 1,
 * plus every `vnd.fjs.adjustments` entry tagged `studentLoanInterest`.
 * §6050S's filing duty starts at $600 and reaches only persons in the trade
 * or business of lending, so a transcription-only line 21 would silently
 * understate the deduction for anyone with a small balance or a private
 * lender.
 * @type {(taxParamSet: TaxParamSet) => (input: ScheduleOnePartIIInput) => ScheduleOnePartIIOutcome}
 */
export const scheduleOnePartII = taxParamSet => input => {
    const {
        profile, status, exceptStudentLoanInterest, adjustmentForms,
        studentLoanInterestForms, totalIncomeLine,
    } = input
    // A 1098-E whose box 2 is checked reports an INCOMPLETE box 1; see
    // `fjs/document/1098e`'s own header. Refused before line 21 is built.
    for (const form of studentLoanInterestForms) {
        if (form.value.box2ExcludesOriginationFeesAndCapitalizedInterest === true) {
            return {
                kind: 'error',
                message: `Schedule 1 line 21: Form 1098-E ${form.documentHash} has box 2 checked, so `
                    + `its box 1 does not include loan origination fees or capitalized interest on `
                    + `loans made before September 1, 2004. Those amounts are deductible student `
                    + `loan interest, they appear on no form, and this engine cannot compute them; `
                    + `refusing rather than deducting box 1 alone and understating line 21`,
            }
        }
    }
    /** @type {readonly Source[]} */
    const transcribedSources = studentLoanInterestForms.flatMap(form => {
        const printed = form.value.box1StudentLoanInterestReceived
        return printed === undefined
            ? []
            : [{
                documentHash: form.documentHash,
                boxPath: 'box1StudentLoanInterestReceived',
                value: printed,
            }]
    })
    /** @type {readonly Source[]} */
    const assertedSources = adjustmentForms.flatMap(form =>
        form.value.entries
            .filter(entry => entry.lineTag === 'studentLoanInterest')
            .map(entry => ({
                documentHash: form.documentHash,
                boxPath: 'entries[lineTag=studentLoanInterest]',
                value: entry.amount,
            })))
    const interestSources = [...transcribedSources, ...assertedSources]
    const interestPaidCents = interestSources.reduce(
        (total, source) => total + centsFromString(source.value), 0n)
    const worksheet = studentLoanInterestWorksheet(taxParamSet)({
        status,
        interestPaidCents,
        totalIncomeCents: totalIncomeLine.value,
        otherAdjustmentsCents:
            studentLoanInterestWorksheetOtherAdjustments(exceptStudentLoanInterest),
    })
    // Line 21 cites the interest documents it read, the filing status (which
    // chooses the threshold AND decides the §221(e)(2) short-circuit), and
    // every source behind the total income its phase-out ran against —
    // PROV-02, and the same three-part citation shape 1040 line 13b already
    // uses for the senior deduction's own phase-out.
    /** @type {Source} */
    const filingStatusSource = {
        documentHash: profile.documentHash,
        boxPath: 'filingStatus',
        value: status,
    }
    const line21 = documentLine(profile)('Schedule 1 line 21 (student loan interest deduction)')(
        worksheet.w9)(
        interestSources.length === 0
            ? []
            : [...interestSources, filingStatusSource, ...totalIncomeLine.sources])
    // 26. "Add lines 11 through 23 and 25." -> 1040 line 10.
    const line26 = totalLine('Schedule 1 line 26 (total adjustments to income -> 1040 line 10)')([
        exceptStudentLoanInterest.line11, exceptStudentLoanInterest.line12,
        exceptStudentLoanInterest.line13, exceptStudentLoanInterest.line14,
        exceptStudentLoanInterest.line15, exceptStudentLoanInterest.line16,
        exceptStudentLoanInterest.line17, exceptStudentLoanInterest.line18,
        exceptStudentLoanInterest.line19a, exceptStudentLoanInterest.line20,
        line21,
        exceptStudentLoanInterest.line22, exceptStudentLoanInterest.line23,
        exceptStudentLoanInterest.line25,
    ])
    return {
        kind: 'ok',
        line11: exceptStudentLoanInterest.line11, line12: exceptStudentLoanInterest.line12,
        line13: exceptStudentLoanInterest.line13, line14: exceptStudentLoanInterest.line14,
        line15: exceptStudentLoanInterest.line15, line16: exceptStudentLoanInterest.line16,
        line17: exceptStudentLoanInterest.line17, line18: exceptStudentLoanInterest.line18,
        line19a: exceptStudentLoanInterest.line19a, line20: exceptStudentLoanInterest.line20,
        line21,
        line22: exceptStudentLoanInterest.line22, line23: exceptStudentLoanInterest.line23,
        line24: exceptStudentLoanInterest.line24, line25: exceptStudentLoanInterest.line25,
        line26,
        studentLoanInterestWorksheet: worksheet,
    }
}

// ── The whole schedule ───────────────────────────────────────────────────────

/**
 * All ten Part I fields and all sixteen Part II fields. Every field is a
 * {@link ReportLine} — including the two totals (`line10`, `line26`) — so a
 * caller can always read `.value`/`.sources` uniformly.
 * @typedef {{
 *   readonly kind: 'ok',
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

/** @typedef {ScheduleOne | ScheduleOneRefusal} ScheduleOneOutcome */

/**
 * @typedef {{
 *   readonly profile: Stored<ReturnProfile>,
 *   readonly status: IndividualFilingStatus,
 *   readonly unemploymentForms: readonly Stored<OneZeroNineNineG>[],
 *   readonly nonemployeeCompensationForms: readonly Stored<OneZeroNineNineNec>[],
 *   readonly businessExpenseForms: readonly Stored<BusinessExpenses>[],
 *   readonly partnershipK1Forms: readonly Stored<K1Partnership>[],
 *   readonly sCorporationK1Forms: readonly Stored<K1SCorporation>[],
 *   readonly adjustmentForms: readonly Stored<Adjustments>[],
 *   readonly studentLoanInterestForms: readonly Stored<OneZeroNineEightE>[],
 *   readonly w2Forms: readonly Stored<W2>[],
 *   readonly totalIncomeLine: ReportLine,
 * }} ScheduleOneInput
 */

/**
 * The whole of Schedule 1, for a caller that already holds a total income and
 * does not need to interleave the Social Security Benefits Worksheet between
 * the two Part II stages. `fjs/form1040/core` DOES need to interleave, and
 * calls the three stages itself; `stagedAndComposedFormsAgreeOnLineTwentySix`
 * is what stops the two paths drifting apart.
 * @type {(taxParamSet: TaxParamSet) => (input: ScheduleOneInput) => ScheduleOneOutcome}
 */
export const scheduleOne = taxParamSet => input => {
    const {
        profile, status, unemploymentForms, nonemployeeCompensationForms, businessExpenseForms,
        partnershipK1Forms, sCorporationK1Forms,
        adjustmentForms, studentLoanInterestForms, w2Forms, totalIncomeLine,
    } = input
    const partI = scheduleOnePartI({
        profile, unemploymentForms, nonemployeeCompensationForms, businessExpenseForms, w2Forms,
        partnershipK1Forms, sCorporationK1Forms,
    })
    if (partI.kind === 'error') {
        return partI
    }
    const stageOne = scheduleOnePartIIExceptStudentLoanInterest(taxParamSet)({
        profile, status, adjustmentForms, w2Forms,
        // Printed Schedule SE line 2 asks for "Schedule C, line 31" by name,
        // so that is the line handed over -- never Part I's line 3, which is
        // the same figure under a different printed number.
        businessNetProfit: partI.scheduleC.partII.line31,
        businessExpenseForms,
        // ...and the SAME printed line names "Schedule K-1 (Form 1065), box
        // 14, code A" beside it. Read off the Schedule E execution Part I
        // already performed, never a second one.
        passThrough: passThroughOf(partI.scheduleE),
    })
    if (stageOne.kind === 'error') {
        return stageOne
    }
    const partII = scheduleOnePartII(taxParamSet)({
        profile, status, exceptStudentLoanInterest: stageOne,
        adjustmentForms, studentLoanInterestForms, totalIncomeLine,
    })
    if (partII.kind === 'error') {
        return partII
    }
    return {
        kind: 'ok',
        line1: partI.line1, line2a: partI.line2a, line3: partI.line3, line4: partI.line4,
        line5: partI.line5, line6: partI.line6, line7: partI.line7, line8: partI.line8,
        line9: partI.line9, line10: partI.line10,
        line11: partII.line11, line12: partII.line12, line13: partII.line13,
        line14: partII.line14, line15: partII.line15, line16: partII.line16,
        line17: partII.line17, line18: partII.line18, line19a: partII.line19a,
        line20: partII.line20, line21: partII.line21, line22: partII.line22,
        line23: partII.line23, line24: partII.line24, line25: partII.line25,
        line26: partII.line26,
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

/** @type {Stored<ReturnProfile>} */
const profileJoint = {
    documentHash: 'profile-hash-0002',
    value: { ...minimalProfileValue, filingStatus: 'marriedFilingJointly' },
}

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

/** TY2025's parameter set, narrowed exactly ONCE at module scope. */
const taxParams2025 = taxParamsByYear[2025]
assert(taxParams2025 !== undefined, 'expected TY2025 parameters to be present in taxParamsByYear')

/**
 * Builds a `vnd.fjs.adjustments` document around a set of entries and
 * coverage records. A helper rather than a dozen near-identical literals —
 * every fixture below differs in exactly the field its own leaf is about.
 * @type {(entries: readonly Adjustments['entries'][number][]) => (hsaCoverage: readonly NonNullable<Adjustments['hsaCoverage']>[number][]) => Stored<Adjustments>}
 */
const adjustmentsDoc = entries => hsaCoverage => ({
    documentHash: 'sha256-adjustments-a',
    value: {
        dialect: 'vnd.fjs.adjustments',
        recipientTin: '222-22-2222',
        taxYear: 2025,
        entries,
        hsaCoverage,
    },
})

/** @type {(amount: string) => (individual: string) => Adjustments['entries'][number]} */
const educatorEntry = amount => individual => ({
    lineTag: 'educatorExpenses',
    datePaid: '2025-09-02',
    description: 'classroom supplies',
    amount,
    individual,
})

/** @type {(amount: string) => (individual: string) => Adjustments['entries'][number]} */
const hsaEntry = amount => individual => ({
    lineTag: 'hsaContribution',
    datePaid: '2025-06-30',
    description: 'HSA contribution',
    amount,
    individual,
})

/** @type {(individual: string) => (coverageType: string) => NonNullable<Adjustments['hsaCoverage']>[number]} */
const fullYearCoverage = individual => coverageType => ({
    individual,
    coverageType,
    hadHighDeductibleCoverageAllYear: true,
})

/** @type {(amount: string) => Stored<OneZeroNineNineNec>} */
const nonemployeeCompensationDoc = amount => ({
    documentHash: 'sha256-1099nec-a',
    value: {
        dialect: 'vnd.fjs.1099nec',
        payerTin: '66-6666666', recipientTin: '222-22-2222', accountNumber: 'CLIENT-1',
        taxYear: 2025, formRevision: '2025',
        box1NonemployeeCompensation: amount,
    },
})

/** @type {(amount: string) => BusinessExpenses['entries'][number]} */
const advertisingEntry = amount => ({
    category: 'advertising',
    datePaid: '2025-03-14',
    description: 'search advertising',
    amount,
})

/** @type {(entries: readonly BusinessExpenses['entries'][number][]) => Stored<BusinessExpenses>} */
const businessDoc = entries => ({
    documentHash: 'sha256-business-a',
    value: {
        dialect: 'vnd.fjs.business_expenses',
        recipientTin: '222-22-2222',
        accountNumber: 'BUS-0001',
        taxYear: 2025,
        principalBusiness: 'software consulting',
        grossReceiptsFullyReportedOnForms1099Nec: true,
        entries,
    },
})

/** @type {(amount: string) => Stored<OneZeroNineEightE>} */
const oneZeroNineEightEDoc = amount => ({
    documentHash: 'sha256-1098e-a',
    value: {
        dialect: 'vnd.fjs.1098e',
        payerTin: '55-5555555', recipientTin: '222-22-2222', accountNumber: 'LOAN-0001',
        taxYear: 2025, formRevision: '2025',
        box1StudentLoanInterestReceived: amount,
    },
})

/**
 * A Form 1040 line 9 (total income) as this schedule receives it, citing the
 * W-2 box a real return's total income would trace back to.
 *
 * **It deliberately does NOT cite the profile's `declaredKinds` box**, even
 * though that would have been the easier fixture to write. Line 21 unions
 * this line's sources into its own (PROV-02: it cites the income its
 * phase-out ran against), so a fixture citing `declaredKinds` would make
 * `noZeroLineHelperRemainsOnALineThisPhaseClaims` unable to tell "line 21 is
 * still a documented zero" from "line 21 computed, and the income it read
 * happened to be one" — which is exactly the distinction that leaf exists to
 * make. Found by writing the leaf the other way round first and watching it
 * fail against a correct line 21.
 * @type {(cents: bigint) => ReportLine}
 */
const totalIncomeOf = cents => ({
    value: cents,
    sources: [{
        documentHash: 'sha256-w2-a',
        boxPath: 'box1WagesTipsOtherCompensation',
        value: '0.00',
    }],
    rule: '1040 line 9',
})

/** @type {Stored<W2>} */
const w2WithEmployerHsa = {
    documentHash: 'sha256-w2-a',
    value: {
        dialect: 'vnd.fjs.w2',
        payerTin: '11-1111111', recipientTin: '222-22-2222', accountNumber: '',
        taxYear: 2025, formRevision: '2025',
        box12: [{ code: 'DD', amount: '14500.00' }, { code: 'W', amount: '1000.00' }],
    },
}

/**
 * Part I for one fixture set. Every leaf below that predates Phase 27 passes
 * no business documents at all, which is exactly the regression question
 * those leaves exist to answer: unemployment compensation must reach line 7
 * and line 10 identically whether or not a Schedule C exists.
 * @type {(profile: Stored<ReturnProfile>) => (unemploymentForms: readonly Stored<OneZeroNineNineG>[]) => (nonemployeeCompensationForms: readonly Stored<OneZeroNineNineNec>[]) => (businessExpenseForms: readonly Stored<BusinessExpenses>[]) => ScheduleOnePartIOutcome}
 */
const partIOf = profile => unemploymentForms => nonemployeeCompensationForms => businessExpenseForms =>
    scheduleOnePartI({
        profile, unemploymentForms, nonemployeeCompensationForms, businessExpenseForms,
        w2Forms: [],
        partnershipK1Forms: [],
        sCorporationK1Forms: [],
    })

/**
 * No pass-through income at all — the shape every leaf that predates Phase 30
 * supplies, and the regression question those leaves exist to answer: a return
 * with no Schedule K-1 must reach Schedule SE line 2 with the Schedule C
 * figure alone.
 * @type {PassThroughSelfEmployment}
 */
const noPassThrough = { earningsCents: 0n, recipientTin: undefined }

/** Narrows a Part I outcome to its OK arm, throwing (never casting).
 * @type {(outcome: ScheduleOnePartIOutcome) => ScheduleOnePartI}
 */
const okPartI = outcome => {
    assert(outcome.kind === 'ok', ['expected a computed Part I', outcome])
    return outcome
}

/** Part I with NO business documents — the pre-Phase-27 shape, which every
 * unemployment leaf below uses unchanged.
 * @type {(profile: Stored<ReturnProfile>) => (unemploymentForms: readonly Stored<OneZeroNineNineG>[]) => ScheduleOnePartI}
 */
const partIWithoutBusiness = profile => unemploymentForms =>
    okPartI(partIOf(profile)(unemploymentForms)([])([]))

/** Narrows a Part II stage-1 outcome to its OK arm, throwing (never casting).
 * @type {(outcome: ScheduleOnePartIIStageOneOutcome) => ScheduleOnePartIIExceptStudentLoanInterest}
 */
const okStageOne = outcome => {
    assert(outcome.kind === 'ok', ['expected a computed Part II stage 1', outcome])
    return outcome
}

/** Narrows a Part II outcome to its OK arm, throwing (never casting).
 * @type {(outcome: ScheduleOnePartIIOutcome) => ScheduleOnePartII}
 */
const okPartII = outcome => {
    assert(outcome.kind === 'ok', ['expected a computed Part II', outcome])
    return outcome
}

/**
 * **Schedule C line 31 for a return with NO business** — which is a
 * `profileDeclaredZeroLine` citing `declaredKinds`, not a bare zero, and the
 * distinction is the whole of why Phase 28 moved nothing for such a return.
 *
 * Built by calling the real `fjs/schedule/c` rather than hand-written here:
 * this is an INPUT, and an input hand-written to the shape the code under
 * test happens to expect is exactly the fixture that stops noticing when that
 * shape changes.
 * @type {(profile: Stored<ReturnProfile>) => ReportLine}
 */
const noBusinessNetProfit = profile => {
    const outcome = scheduleC({
        profile,
        nonemployeeCompensationForms: [],
        businessExpenseForms: [],
        w2Forms: [],
    })
    assert(outcome.kind === 'ok', ['an empty Schedule C cannot refuse', outcome])
    return outcome.partII.line31
}

/** Narrows any outcome to its refusal arm, throwing (never casting).
 * @type {(outcome: ScheduleOnePartIOutcome | ScheduleOnePartIIStageOneOutcome | ScheduleOnePartIIOutcome | ScheduleOneOutcome) => ScheduleOneRefusal}
 */
const refusal = outcome => {
    assert(outcome.kind === 'error', ['expected a refusal', outcome])
    return outcome
}

/**
 * The whole of Part II for one fixture set, staged exactly as
 * `fjs/form1040/core` stages it.
 * @type {(profile: Stored<ReturnProfile>) => (status: IndividualFilingStatus) => (adjustmentForms: readonly Stored<Adjustments>[]) => (studentLoanInterestForms: readonly Stored<OneZeroNineEightE>[]) => (w2Forms: readonly Stored<W2>[]) => (totalIncomeCents: bigint) => ScheduleOnePartIIOutcome}
 */
const partIIOf = profile => status => adjustmentForms => studentLoanInterestForms => w2Forms => totalIncomeCents => {
    const stageOne = scheduleOnePartIIExceptStudentLoanInterest(taxParams2025)({
        profile, status, adjustmentForms, w2Forms,
        businessNetProfit: noBusinessNetProfit(profile),
        businessExpenseForms: [],
        passThrough: noPassThrough,
    })
    if (stageOne.kind === 'error') {
        return stageOne
    }
    return scheduleOnePartII(taxParams2025)({
        profile, status, exceptStudentLoanInterest: stageOne,
        adjustmentForms, studentLoanInterestForms,
        totalIncomeLine: totalIncomeOf(totalIncomeCents),
    })
}

/** The empty case, reused by every regression control below. */
/** @type {() => ScheduleOnePartIIOutcome} */
const emptyPartII = () => partIIOf(profileNoDeclaredKinds)('single')([])([])([])(0n)

/**
 * Stage 1 for a return WITH a business — Schedule C run first, exactly as
 * `scheduleOne` and `fjs/form1040/core` run it, so `businessNetProfit` is the
 * real line 31 rather than a figure typed to match. Phase 28's own fixture
 * shape.
 * @type {(profile: Stored<ReturnProfile>) => (status: IndividualFilingStatus) => (nonemployeeCompensationForms: readonly Stored<OneZeroNineNineNec>[]) => (businessExpenseForms: readonly Stored<BusinessExpenses>[]) => (w2Forms: readonly Stored<W2>[]) => ScheduleOnePartIIStageOneOutcome}
 */
const stageOneWithBusiness = profile => status => nonemployeeCompensationForms =>
    businessExpenseForms => w2Forms => {
        const partI = okPartI(scheduleOnePartI({
            profile,
            unemploymentForms: [],
            nonemployeeCompensationForms,
            businessExpenseForms,
            w2Forms,
            partnershipK1Forms: [],
            sCorporationK1Forms: [],
        }))
        return scheduleOnePartIIExceptStudentLoanInterest(taxParams2025)({
            profile, status, adjustmentForms: [], w2Forms,
            businessNetProfit: partI.scheduleC.partII.line31,
            businessExpenseForms,
            passThrough: passThroughOf(partI.scheduleE),
        })
    }

/**
 * A Form W-2 carrying box 3 Social Security wages for a named recipient — the
 * box Schedule SE line 8a reads, and NOT box 5, which is Form 8959's.
 * @type {(documentHash: string) => (recipientTin: string) => (amount: string) => Stored<W2>}
 */
const w2WithSocialSecurityWages = documentHash => recipientTin => amount => ({
    documentHash,
    value: {
        dialect: 'vnd.fjs.w2',
        payerTin: '11-1111111', recipientTin, accountNumber: 'ACC-W2',
        taxYear: 2025, formRevision: '2025',
        box1WagesTipsOtherCompensation: amount,
        box3SocialSecurityWages: amount,
    },
})

/** Every Part II line NO phase has claimed — hand-typed, so a line that
 * quietly stops being a documented zero is caught by name rather than by a
 * loop derived from the code under test.
 *
 * **Line 15 left this list in Phase 28.** It is a COMPUTED zero on a return
 * with no business rather than a declared one, and the difference is exactly
 * what `lineFifteenIsAComputedZeroCitingOnlyTheProfileWhenThereIsNoBusiness`
 * exists to state: the assertions look identical and the reason does not.
 * @type {readonly string[]} */
const partIILinesStillDocumentedZero = [
    'line12', 'line14', 'line16', 'line17', 'line18', 'line19a',
    'line20', 'line22', 'line23', 'line24', 'line25',
]

export const proof = {
    // ── Part I: unemployment compensation (1099-G box 1), Phase 20 ──────────

    /**
     * Two 1099-Gs sum, and EACH cites its own document. A single-document
     * proof could not tell a sum from a "read the first one" bug.
     */
    line7SumsEveryUnemploymentFormCitingEach: () => {
        const result = partIWithoutBusiness(profileNoDeclaredKinds)([unemploymentA, unemploymentB])
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
        const withForms = partIWithoutBusiness(profileNoDeclaredKinds)([unemploymentA])
        const without = partIWithoutBusiness(profileNoDeclaredKinds)([])
        assertEq(withForms.line10.value, 455400n, 'line 10 carries the unemployment')
        assertEq(without.line10.value, 0n, 'and is zero without it')
        assertEq(withForms.line10.value - without.line10.value, withForms.line7.value)
    },

    /**
     * DOC-11 / 15-05's cardinality decision: NO 1099-G is a legitimate zero,
     * not a refusal. The line still carries provenance (PROV-01), citing the
     * profile's own `declaredKinds`.
     */
    absentUnemploymentIsZeroWithProfileProvenance: () => {
        const result = partIWithoutBusiness(profileNoDeclaredKinds)([])
        assertEq(result.line7.value, 0n)
        assertEq(result.line7.sources.length, 1)
        assertEq(result.line7.sources[0].boxPath, 'declaredKinds')
    },

    /**
     * A 1099-G with NO box 1 contributes nothing and is not counted as a
     * source. Absent is not zero-valued: it is not present at all.
     */
    formWithoutBox1ContributesNoSource: () => {
        const withholdingOnly = {
            documentHash: 'sha256-1099g-c',
            value: { ...unemploymentA.value, box1UnemploymentCompensation: undefined },
        }
        const result = partIWithoutBusiness(profileNoDeclaredKinds)([withholdingOnly])
        assertEq(result.line7.value, 0n)
        assertEq(result.line7.sources[0].boxPath, 'declaredKinds')
    },

    // ── Part I line 3: business income or loss (Schedule C, TAX-30) ─────────

    businessIncome: {
        // Schedule C's line 31 reaches Schedule 1 line 3 — and line 3 reaches
        // line 10, which is what 1040 line 8 reads. Both halves asserted, and
        // the second is the one that matters: a line 3 that computes
        // correctly but never lands in the Part I total would leave the return
        // understated with every other leaf green (the identical pairing
        // `line7ReachesTheLine10TotalThatFeeds1040Line8` already makes for
        // unemployment).
        //
        //   1099-NEC box 1                                     $350.00
        //   Schedule C line 8   advertising                     $90.00
        //   Schedule C line 31  350.00 - 90.00                 $260.00
        //   Schedule 1 line 3                                  $260.00
        //   Schedule 1 line 10  (nothing else on Part I)       $260.00
        //
        // $260.00 rather than a realistic freelance figure because
        // §1402(b)(2)'s $400 floor is the boundary above which `fjs/schedule/c`
        // refuses until Phase 28 builds Schedule SE — see that module's own
        // docstring.
        lineThreeIsScheduleCLineThirtyOneAndReachesLineTen: () => {
            const partI = okPartI(partIOf(profileNoDeclaredKinds)([])(
                [nonemployeeCompensationDoc('350.00')])([businessDoc([advertisingEntry('90.00')])]))
            assertEq(partI.scheduleC.partII.line31.value, 26000n, '$350.00 - $90.00 = $260.00')
            assertEq(partI.line3.value, 26000n, 'Schedule C line 31 IS Schedule 1 line 3')
            assertEq(partI.line10.value, 26000n, 'and it reaches the Part I total')
            // The hard zero is REPLACED, not supplemented: line 3 cites the
            // 1099-NEC box and the expense entry it actually read.
            //
            // **It ALSO cites `declaredKinds`, and that is correct rather
            // than a leak** — a discovery this leaf made by asserting the
            // opposite first and watching it fail. Line 31 is line 29 minus
            // line 30, line 30 is the home-office deduction, and it is zero
            // BECAUSE nothing was asserted for it. Citing the declaration for
            // a zero that comes from the declaration is exactly PROV-02, so
            // what this leaf checks is that the document readings are
            // PRESENT, not that the profile is absent.
            const paths = partI.line3.sources.map(source => source.boxPath)
            assert(
                paths.includes('box1NonemployeeCompensation'),
                ['line 3 must cite the Form 1099-NEC box it read', paths])
            assert(
                paths.includes('entries[category=advertising]'),
                ['line 3 must cite the expense entry it read', paths])
            assert(
                partI.line3.rule.includes('Schedule C line 31'),
                ['line 3 must name where it came from', partI.line3.rule])
        },
        // Line 3 and line 7 both carry real figures, and line 10 is their SUM.
        // A "read the last one" bug in the total would pass every single-line
        // leaf above.
        //
        //   line 3  Schedule C net profit                      $260.00
        //   line 7  1099-G box 1                             $4,554.00
        //   line 10 260.00 + 4,554.00                        $4,814.00
        theTwoComputingPartOneLinesBothReachTheTotal: () => {
            const partI = okPartI(partIOf(profileNoDeclaredKinds)([unemploymentA])(
                [nonemployeeCompensationDoc('350.00')])([businessDoc([advertisingEntry('90.00')])]))
            assertEq(partI.line3.value, 26000n, '$260.00')
            assertEq(partI.line7.value, 455400n, '$4,554.00')
            assertEq(partI.line10.value, 481400n, '$260.00 + $4,554.00 = $4,814.00')
        },
        // A Schedule C refusal must reach a Part I caller rather than being
        // swallowed. A net loss is the refusal most likely to be met in
        // practice, and it must stop the schedule, not zero the line.
        aScheduleCRefusalPropagatesOutOfPartOne: () => {
            const result = refusal(partIOf(profileNoDeclaredKinds)([])(
                [nonemployeeCompensationDoc('100.00')])([businessDoc([advertisingEntry('900.00')])]))
            assert(
                result.message.includes('line 32'),
                ['the Schedule C loss refusal must reach Schedule 1 unchanged', result.message])
        },
    },

    // ── Line 15: the deductible half of self-employment tax (Phase 28) ───────
    //
    // This group replaces Phase 27's single
    // `lineFifteenIsStillADocumentedZeroAfterScheduleCComputes`, which
    // asserted that line 15 stayed a hard zero on a return whose Schedule C
    // computed. It does not stay one, and the leaf that said so was written
    // to redden when this phase landed.
    lineFifteen: {
        // **THE REGRESSION PROPERTY.** With no business, line 15's two cited
        // inputs are both `profileDeclaredZeroLine`s and their union
        // deduplicates to the single `declaredKinds` citation the hard zero
        // always carried. Same value, same source count, same box path — so
        // a return with no self-employment computes exactly what it computed
        // before Phase 28, and 1040 line 10's own sources are unmoved with
        // it.
        lineFifteenIsAComputedZeroCitingOnlyTheProfileWhenThereIsNoBusiness: () => {
            const partII = okPartII(emptyPartII())
            assertEq(partII.line15.value, 0n)
            assertEq(partII.line15.sources.length, 1, 'the two profile zeros dedup to one citation')
            assertEq(partII.line15.sources[0].documentHash, profileNoDeclaredKinds.documentHash)
            assertEq(partII.line15.sources[0].boxPath, 'declaredKinds')
            assert(
                partII.line15.rule.includes('Schedule SE line 13'),
                ['line 15 must name the form line it implements', partII.line15.rule])
            assertEq(partII.line26.value, 0n, 'and line 26 is untouched')
        },
        // A sub-$400 business: Schedule C computes a real profit, and line 15
        // is STILL $0.00 — because §1402(b)(2)'s floor is applied to net
        // EARNINGS on Schedule SE line 4c. The citations DO change here, and
        // they should: a zero derived from real documents cites those
        // documents.
        //
        // $350.00 of receipts less $90.00 of advertising is $260.00; 92.35%
        // of it is $240.11, below $400.00.
        aSubFourHundredDollarProfitStillDeductsNothingButCitesTheDocuments: () => {
            const stageOne = okStageOne(stageOneWithBusiness(profileNoDeclaredKinds)('single')(
                [nonemployeeCompensationDoc('350.00')])([businessDoc([advertisingEntry('90.00')])])([]))
            assertEq(stageOne.selfEmployment.netProfit.value, 26000n, 'the control: Schedule C computed $260.00')
            assertEq(26000n * 9235n / 10000n, 24011n, '92.35% of $260.00 is $240.11, below the floor')
            assertEq(stageOne.line15.value, 0n, 'no self-employment tax, so no deductible half')
            const paths = stageOne.line15.sources.map(source => source.boxPath)
            assert(
                paths.includes('box1NonemployeeCompensation'),
                ['a zero derived from documents cites them', paths])
        },
        // **THE REAL FIGURE.** $48,000.00 of receipts less $90.00 of
        // advertising is $47,910.00 of net profit. Hand-derived:
        //
        //   Sch SE 4a  4,791,000 x 9235 / 10,000 = 4,424,488.5  $44,244.89
        //   Sch SE 10  4,424,489 x 1240 / 10,000 = 548,636.636   $5,486.37
        //   Sch SE 11  4,424,489 x  290 / 10,000 = 128,310.181   $1,283.10
        //   Sch SE 12  5,486.37 + 1,283.10                       $6,769.47
        //   Sch SE 13  676,947 x 50 / 100 = 338,473.5            $3,384.74
        //
        // Line 13's own rounding is a HALF-CENT here, and half-up takes it
        // up: truncation would give $3,384.73. That is not an accident of the
        // fixture — an odd number of cents on line 12 is the ordinary case,
        // since two independently-rounded portions are added.
        lineFifteenIsScheduleSeLineThirteenOnARealProfit: () => {
            const stageOne = okStageOne(stageOneWithBusiness(profileNoDeclaredKinds)('single')(
                [nonemployeeCompensationDoc('48000.00')])(
                [businessDoc([advertisingEntry('90.00')])])([]))
            assertEq(stageOne.selfEmployment.lines.line12, 676947n, 'Schedule SE line 12 = $6,769.47')
            assertEq(stageOne.line15.value, 338474n, 'line 15 = $3,384.74')
            assertEq(676947n / 2n, 338473n, 'truncation would give $3,384.73; half-up gives $3,384.74')
            // Line 15 is HALF the tax, and half of the TAX -- not of the
            // Social Security portion, not of net earnings, not of the
            // profit. Each of those is a real number on the same record and
            // each is wrong here.
            assert(stageOne.line15.value !== stageOne.selfEmployment.lines.line10, 'not half of line 10')
            assert(stageOne.line15.value !== stageOne.selfEmployment.lines.line6, 'not net earnings')
            assert(stageOne.line15.value * 2n - 1n === stageOne.selfEmployment.lines.line12,
                'twice line 15 is line 12, up to the half-cent rounded up')
            // …and it reaches line 26, the total that feeds 1040 line 10.
            const partII = okPartII(scheduleOnePartII(taxParams2025)({
                profile: profileNoDeclaredKinds,
                status: 'single',
                exceptStudentLoanInterest: stageOne,
                adjustmentForms: [],
                studentLoanInterestForms: [],
                totalIncomeLine: totalIncomeOf(4791000n),
            }))
            assertEq(partII.line26.value, 338474n, 'line 26 = $3,384.74 -> 1040 line 10')
        },
        // The Social Security Benefits Worksheet's own line 6 asks for
        // "lines 11 through 20", and line 15 is INSIDE that range. That cost
        // nothing while the line was a hard zero; it is a live dependency
        // now, and this is the leaf that says the worksheet total moved with
        // it. A retiree with a Schedule C is exactly the filer this affects.
        theSocialSecurityWorksheetTotalIncludesLineFifteen: () => {
            const stageOne = okStageOne(stageOneWithBusiness(profileNoDeclaredKinds)('single')(
                [nonemployeeCompensationDoc('48000.00')])(
                [businessDoc([advertisingEntry('90.00')])])([]))
            assertEq(
                socialSecurityWorksheetAdjustmentsTotal(stageOne), 338474n,
                'lines 11-20, 23 and 25 now carry the deductible half')
            assertEq(
                studentLoanInterestWorksheetOtherAdjustments(stageOne), 338474n,
                'lines 11-20 plus write-ins carry it too -- 15 is in both ranges')
            // THE CONTROL: with no business both totals are zero, so the
            // figure above is the deduction rather than anything else on
            // Part II.
            assertEq(socialSecurityWorksheetAdjustmentsTotal(okStageOne(
                stageOneWithBusiness(profileNoDeclaredKinds)('single')([])([])([]))), 0n)
        },
        // **THE WAGE BASE, SHARED, at the schedule that computes it.** Two
        // Forms W-2 for the proprietor totalling $150,000.00 of box 3 beside
        // a $50,000.00 net profit. Line 15 is half of $4,575.48, and the
        // naive no-sharing answer would be half of $7,064.78 -- both asserted.
        theWageBaseIsSharedBeforeTheHalfIsTaken: () => {
            const shared = okStageOne(stageOneWithBusiness(profileNoDeclaredKinds)('single')(
                [nonemployeeCompensationDoc('50000.00')])([businessDoc([])])([
                w2WithSocialSecurityWages('sha256-w2-a')('222-22-2222')('85000.00'),
                w2WithSocialSecurityWages('sha256-w2-b')('222-22-2222')('65000.00'),
            ]))
            assertEq(shared.selfEmployment.lines.line8a, 15000000n, '$150,000.00 of box 3')
            assertEq(shared.selfEmployment.lines.line12, 457548n, '$4,575.48 of tax')
            assertEq(shared.line15.value, 228774n, 'line 15 = $2,287.74')
            const naive = okStageOne(stageOneWithBusiness(profileNoDeclaredKinds)('single')(
                [nonemployeeCompensationDoc('50000.00')])([businessDoc([])])([]))
            assertEq(naive.selfEmployment.lines.line12, 706478n, 'no wages: $7,064.78 of tax')
            assertEq(naive.line15.value, 353239n, 'and a $3,532.39 deduction')
            // …and line 15's sources include the W-2 box the sharing read.
            const paths = shared.line15.sources.map(source => source.boxPath)
            assert(
                paths.includes('box3SocialSecurityWages'),
                ['line 15 must cite the wages that consumed the base', paths])
            assert(
                !paths.includes('box5MedicareWagesAndTips'),
                ['and NOT box 5, which is Form 8959\'s', paths])
        },
        // **A SPOUSE'S WAGES DO NOT SHELTER THE PROPRIETOR**, on a joint
        // return where they legitimately sit beside one Schedule C. The
        // spouse earns $170,000.00 of box 3 and the proprietor nothing, so
        // the proprietor's whole $176,100 base is intact and the tax is the
        // no-wages figure -- NOT the $1,339.08 a shared base would give.
        aSpousesWagesDoNotShelterTheProprietorsEarnings: () => {
            const joint = okStageOne(stageOneWithBusiness(profileJoint)('marriedFilingJointly')(
                [nonemployeeCompensationDoc('50000.00')])([businessDoc([])])([
                w2WithSocialSecurityWages('sha256-w2-spouse')('333-33-3333')('170000.00'),
            ]))
            assertEq(joint.selfEmployment.lines.line8a, 0n, 'the spouse\'s box 3 is not the proprietor\'s')
            assertEq(joint.selfEmployment.lines.line12, 706478n, '$7,064.78, the full-base figure')
            assertEq(joint.line15.value, 353239n, 'line 15 = $3,532.39')
            // …and the SAME wages under the proprietor's own TIN give the
            // other answer, which is what makes this a filter rather than a
            // W-2 that is simply never read.
            const own = okStageOne(stageOneWithBusiness(profileJoint)('marriedFilingJointly')(
                [nonemployeeCompensationDoc('50000.00')])([businessDoc([])])([
                w2WithSocialSecurityWages('sha256-w2-own')('222-22-2222')('170000.00'),
            ]))
            assertEq(own.selfEmployment.lines.line8a, 17000000n, '$170,000.00 of the proprietor\'s own')
            assertEq(own.selfEmployment.lines.line9, 610000n, '$6,100.00 of base left')
            // 12.4% of $6,100.00 = 75,640 cents; 2.9% of $46,175.00 =
            // 133,908 cents; total $2,095.48.
            assertEq(own.selfEmployment.lines.line12, 209548n, '$2,095.48')
        },
        // …and on a NON-joint return the same mismatch REFUSES, threaded out
        // of stage 1 exactly as Form 8889's refusals are. The control above
        // is the joint case; this is the case where the engine cannot tell
        // whose wages they are.
        aForeignW2OnANonJointReturnRefusesOutOfStageOne: () => {
            const outcome = stageOneWithBusiness(profileNoDeclaredKinds)('single')(
                [nonemployeeCompensationDoc('50000.00')])([businessDoc([])])([
                w2WithSocialSecurityWages('sha256-w2-other')('333-33-3333')('170000.00'),
            ])
            const message = refusal(outcome).message
            assert(message.includes('Schedule SE line 8a'), ['must name the printed line', message])
            assert(message.includes('333-33-3333'), ['must name the other recipient', message])
        },
    },

    // ── THE REGRESSION CONTROL ───────────────────────────────────────────────
    //
    // A return with no adjustment documents at all must compute EXACTLY what
    // it computed before this phase: both totals zero, every line citing the
    // profile's `declaredKinds` box. This matters more than any gate in this
    // file — it is the property that says Phase 24 moved nothing for the
    // millions of returns that claim none of these three adjustments.
    theEmptyReturnComputesExactlyWhatItComputedBeforeThisPhase: () => {
        const partI = partIWithoutBusiness(profileNoDeclaredKinds)([])
        const partII = okPartII(emptyPartII())
        assertEq(partI.line10.value, 0n, 'line 10 = $0.00')
        assertEq(partII.line26.value, 0n, 'line 26 = $0.00')
        assertEq(partI.line10.sources.length, 1)
        assertEq(partI.line10.sources[0].boxPath, 'declaredKinds')
        assertEq(partII.line26.sources.length, 1)
        assertEq(partII.line26.sources[0].boxPath, 'declaredKinds')
        // Every one of the three newly-computing lines is still a documented
        // zero here, citing the profile — not a document that is not there.
        for (const line of [partII.line11, partII.line13, partII.line21]) {
            assertEq(line.value, 0n)
            assertEq(line.sources.length, 1)
            assertEq(line.sources[0].documentHash, profileNoDeclaredKinds.documentHash)
            assertEq(line.sources[0].boxPath, 'declaredKinds')
        }
    },
    // Zero stored documents still produce valid ReportLines, each citing the
    // profile's declaredKinds box -- mirrors `fjs/schedule/b`'s own leaf.
    zeroStoredDocumentsStillProduceValidReportLinesCitingProfile: () => {
        const partI = partIWithoutBusiness(profileNoDeclaredKinds)([])
        const partII = okPartII(emptyPartII())
        // Part I's ten lines named ONE BY ONE rather than through
        // `Object.values(partI)`, which is how this leaf read until Phase 27.
        // That spread stopped being a list of lines the moment Part I gained a
        // `kind` discriminant and a `scheduleC` field — and naming them is the
        // better shape anyway: a line quietly dropped from the returned record
        // vanishes from a spread and is caught by an explicit list.
        for (const line of [partI.line1, partI.line2a, partI.line3, partI.line4, partI.line5,
            partI.line6, partI.line7, partI.line8, partI.line9, partI.line10,
            partII.line11, partII.line12, partII.line13,
            partII.line14, partII.line15, partII.line16, partII.line17, partII.line18,
            partII.line19a, partII.line20, partII.line21, partII.line22, partII.line23,
            partII.line24, partII.line25, partII.line26]) {
            assertEq(line.value, 0n)
            assertEq(line.sources.length, 1)
            assertEq(line.sources[0].documentHash, profileNoDeclaredKinds.documentHash)
            assertEq(line.sources[0].boxPath, 'declaredKinds')
        }
    },

    // ── Line 11: educator expenses (TAX-24) ─────────────────────────────────

    educatorExpenses: {
        // Under the cap: the whole amount, citing the entry's own document
        // and NOT the profile. $287.45.
        underTheCapIsDeductedInFullCitingTheEntry: () => {
            const result = okPartII(partIIOf(profileNoDeclaredKinds)('single')(
                [adjustmentsDoc([educatorEntry('287.45')('taxpayer')])([])])([])([])(0n))
            assertEq(result.line11.value, 28745n, '$287.45, under the $300.00 cap')
            assertEq(result.line11.sources.length, 1)
            assertEq(result.line11.sources[0].documentHash, 'sha256-adjustments-a')
            assert(
                result.line11.sources[0].boxPath !== 'declaredKinds',
                ['the hard zero must be REPLACED, not supplemented', result.line11.sources[0]],
            )
        },
        // Over the cap, from TWO entries: $200.00 + $180.00 = $380.00, capped
        // to $300.00. Two entries rather than one, so a "cap the first entry"
        // bug cannot pass.
        overTheCapIsCappedAcrossEveryEntry: () => {
            const result = okPartII(partIIOf(profileNoDeclaredKinds)('single')(
                [adjustmentsDoc([
                    educatorEntry('200.00')('taxpayer'),
                    educatorEntry('180.00')('taxpayer'),
                ])([])])([])([])(0n))
            assertEq(result.line11.value, 30000n, '$380.00 capped to §62(a)(2)(D)\'s $300.00')
            assertEq(result.line11.sources.length, 2, 'both entries are still cited')
        },
        // THE per-person case, and the one most likely to be got wrong in
        // either direction. A joint return where BOTH spouses are eligible
        // educators: the taxpayer paid $380.00 (capped to $300.00) and the
        // spouse $250.00 (uncapped), so line 11 is $550.00.
        //
        // A cap applied to the COMBINED total would give $300.00; no cap at
        // all would give $630.00; a flat "$600 if joint" would give $600.00.
        // All three wrong answers are excluded by this one figure.
        eachEligibleEducatorIsCappedSeparately: () => {
            const result = okPartII(partIIOf(profileJoint)('marriedFilingJointly')(
                [adjustmentsDoc([
                    educatorEntry('200.00')('taxpayer'),
                    educatorEntry('180.00')('taxpayer'),
                    educatorEntry('250.00')('spouse'),
                ])([])])([])([])(0n))
            assertEq(result.line11.value, 55000n, '$300.00 (capped) + $250.00 = $550.00')
            assert(result.line11.value !== 30000n, 'not one combined $300.00 cap')
            assert(result.line11.value !== 63000n, 'not uncapped')
            assert(result.line11.value !== 60000n, 'not a flat joint $600.00')
        },
        // The joint MAXIMUM the printed instruction states, reached rather
        // than stored: two educators each over $300.00 give exactly $600.00.
        // `fjs/tax/params` deliberately stores no $600 figure, and this is
        // what checks that omission was safe.
        theJointSixHundredMaximumIsTwoCapsNotAStoredFigure: () => {
            const result = okPartII(partIIOf(profileJoint)('marriedFilingJointly')(
                [adjustmentsDoc([
                    educatorEntry('400.00')('taxpayer'),
                    educatorEntry('900.00')('spouse'),
                ])([])])([])([])(0n))
            assertEq(result.line11.value, 60000n, '$300.00 + $300.00 = the printed $600.00 maximum')
        },
        // A spouse-attributed entry on a return with no spouse filing on it
        // is a deduction on somebody else's return.
        aSpouseEntryOnASingleReturnIsRefused: () => {
            const result = refusal(partIIOf(profileNoDeclaredKinds)('single')(
                [adjustmentsDoc([educatorEntry('250.00')('spouse')])([])])([])([])(0n))
            assert(result.message.includes('spouse'), ['must name the attribution', result.message])
            assert(result.message.includes('single'), ['must name the filing status', result.message])
            assert(
                result.message.includes('classroom supplies'),
                ['must name WHICH entry, so a reader can find it', result.message],
            )
        },
        // The CONTROL: the identical entry on a JOINT return computes.
        theSameSpouseEntryOnAJointReturnComputes: () => {
            const result = okPartII(partIIOf(profileJoint)('marriedFilingJointly')(
                [adjustmentsDoc([educatorEntry('250.00')('spouse')])([])])([])([])(0n))
            assertEq(result.line11.value, 25000n)
        },
    },

    // ── Line 13: the HSA deduction (TAX-24, through Form 8889) ──────────────

    hsaDeduction: {
        theOrdinaryCaseReachesLineThirteenCitingBothTheCoverageAndTheEntry: () => {
            const result = okPartII(partIIOf(profileNoDeclaredKinds)('single')(
                [adjustmentsDoc([hsaEntry('2000.00')('taxpayer')])(
                    [fullYearCoverage('taxpayer')('selfOnly')])])([])([])(0n))
            assertEq(result.line13.value, 200000n, '$2,000.00, under the $4,300.00 limit')
            assertEq(result.line13.sources.length, 2)
            assertEq(result.line13.sources[0].boxPath, 'hsaCoverage[individual=taxpayer].coverageType')
            assertEq(result.line13.sources[0].value, 'selfOnly')
            const contributionSource = result.line13.sources[1]
            assert(contributionSource !== undefined, ['expected a second source', result.line13.sources])
            assertEq(
                contributionSource.boxPath,
                'entries[lineTag=hsaContribution,individual=taxpayer]',
            )
        },
        // Form W-2 box 12 code W is REAL data, and it reduces the deductible
        // room: $1,000.00 of employer money against the $4,300.00 self-only
        // limit leaves $3,300.00, so a $4,000.00 personal contribution is
        // deducted only to $3,300.00 — and the W-2 is cited.
        employerContributionsFromBoxTwelveCodeWReduceTheDeduction: () => {
            const result = okPartII(partIIOf(profileNoDeclaredKinds)('single')(
                [adjustmentsDoc([hsaEntry('4000.00')('taxpayer')])(
                    [fullYearCoverage('taxpayer')('selfOnly')])])([])([w2WithEmployerHsa])(0n))
            assertEq(result.line13.value, 330000n, '$4,300.00 - $1,000.00 = $3,300.00')
            const w2Source = result.line13.sources.find(s => s.documentHash === 'sha256-w2-a')
            assert(w2Source !== undefined, ['the W-2 must be cited', result.line13.sources])
            assertEq(w2Source.boxPath, 'box12[code=W]')
            assertEq(w2Source.value, '1000.00')
        },
        // Only code W. The same W-2 carries a code DD amount fourteen times
        // larger; reading it would give a wildly wrong limit, and reading
        // "any box 12" would be the natural way to get there.
        onlyCodeWIsReadFromBoxTwelve: () => {
            const result = okPartII(partIIOf(profileNoDeclaredKinds)('single')(
                [adjustmentsDoc([hsaEntry('4000.00')('taxpayer')])(
                    [fullYearCoverage('taxpayer')('selfOnly')])])([])([w2WithEmployerHsa])(0n))
            const citedValues = result.line13.sources
                .filter(s => s.documentHash === 'sha256-w2-a')
                .map(s => s.value)
            assertEq(citedValues.length, 1, 'exactly one box-12 entry is code W')
            assert(!citedValues.includes('14500.00'), ['code DD must not be read', citedValues])
        },
        // Two holders, each self-only, no employer contributions: BOTH
        // compute, each against their own $4,300.00 limit. This is the
        // control that stops the two-holder refusals below from being a
        // blanket "two HSAs are refused" rule.
        twoSelfOnlyHoldersWithNoEmployerContributionsBothCompute: () => {
            const result = okPartII(partIIOf(profileJoint)('marriedFilingJointly')(
                [adjustmentsDoc([hsaEntry('4000.00')('taxpayer'), hsaEntry('3000.00')('spouse')])(
                    [fullYearCoverage('taxpayer')('selfOnly'),
                        fullYearCoverage('spouse')('selfOnly')])])([])([])(0n))
            assertEq(result.line13.value, 700000n, '$4,000.00 + $3,000.00, both under $4,300.00')
        },
        // Two holders and family coverage is Form 8889 line 6's allocation
        // "by agreement", threaded up from `fjs/form8889` unchanged.
        twoHoldersWithFamilyCoverageIsRefusedNamingLineSix: () => {
            const result = refusal(partIIOf(profileJoint)('marriedFilingJointly')(
                [adjustmentsDoc([hsaEntry('4000.00')('taxpayer')])(
                    [fullYearCoverage('taxpayer')('family'),
                        fullYearCoverage('spouse')('selfOnly')])])([])([])(0n))
            assert(result.message.includes('line 6'), ['must name the printed line', result.message])
        },
        // Two holders AND an employer contribution nobody can attribute.
        // A different refusal from the one above, with a different reason.
        twoHoldersWithEmployerContributionsIsRefusedForAttribution: () => {
            const result = refusal(partIIOf(profileJoint)('marriedFilingJointly')(
                [adjustmentsDoc([hsaEntry('1000.00')('taxpayer')])(
                    [fullYearCoverage('taxpayer')('selfOnly'),
                        fullYearCoverage('spouse')('selfOnly')])])([])([w2WithEmployerHsa])(0n))
            assert(result.message.includes('line 13'), ['must name the Schedule 1 line', result.message])
            assert(
                result.message.includes('WHICH spouse'),
                ['must name what cannot be determined', result.message],
            )
        },
        // Employer contributions with NO coverage record at all: the engine
        // cannot check them against a limit it does not know.
        employerContributionsWithNoCoverageRecordAreRefused: () => {
            const result = refusal(partIIOf(profileNoDeclaredKinds)('single')(
                [adjustmentsDoc([])([])])([])([w2WithEmployerHsa])(0n))
            assert(result.message.includes('box 12 code W'), ['must name the box', result.message])
            assert(result.message.includes('Form 5329'), ['must name the tax at risk', result.message])
        },
        // A contribution attributed to somebody with no coverage record.
        aContributionWithNoCoverageRecordIsRefused: () => {
            const result = refusal(partIIOf(profileJoint)('marriedFilingJointly')(
                [adjustmentsDoc([hsaEntry('1000.00')('spouse')])(
                    [fullYearCoverage('taxpayer')('selfOnly')])])([])([])(0n))
            assert(result.message.includes('line 13'), ['must name the line', result.message])
            assert(
                result.message.includes('$4,300') && result.message.includes('$8,550'),
                ['must name the two limits it refuses to choose between', result.message],
            )
        },
        // Form 8889's own partial-year refusal, threaded up unchanged. This
        // is the refusal that carries the most weight on this line.
        coverageWithoutTheFullYearAssertionIsRefused: () => {
            const result = refusal(partIIOf(profileNoDeclaredKinds)('single')(
                [adjustmentsDoc([hsaEntry('2000.00')('taxpayer')])(
                    [{ individual: 'taxpayer', coverageType: 'selfOnly' }])])([])([])(0n))
            assert(
                result.message.includes('Line 3 Limitation Chart and Worksheet'),
                ['Form 8889\'s own message must reach the caller unchanged', result.message],
            )
        },
    },

    // ── Line 21: student loan interest and its phase-out (TAX-23) ───────────

    studentLoanInterest: {
        // BELOW the phase-out range: the whole $1,842.63, from a 1098-E,
        // citing the lender's own box 1. Total income $60,000.00, threshold
        // $85,000.00, so worksheet line 6 is zero and nothing phases out.
        belowTheRangeDeductsTheWholeInterestCitingTheLender: () => {
            const result = okPartII(partIIOf(profileNoDeclaredKinds)('single')([])(
                [oneZeroNineEightEDoc('1842.63')])([])(6000000n))
            assertEq(result.line21.value, 184263n, '$1,842.63, no phase-out below $85,000.00')
            assertEq(result.studentLoanInterestWorksheet.w6, 0n)
            assertEq(result.studentLoanInterestWorksheet.w7Thousandths, 0n)
            const lender = result.line21.sources.find(s => s.documentHash === 'sha256-1098e-a')
            assert(lender !== undefined, ['the 1098-E must be cited', result.line21.sources])
            assertEq(lender.boxPath, 'box1StudentLoanInterestReceived')
            assert(
                !result.line21.sources.some(s => s.boxPath === 'declaredKinds'),
                ['the hard zero must be REPLACED, not supplemented', result.line21.sources],
            )
        },
        // The $2,500 statutory cap, at worksheet line 1: $3,000.00 paid
        // deducts $2,500.00 even with no phase-out at all.
        theTwoThousandFiveHundredCapAppliesAtWorksheetLineOne: () => {
            const result = okPartII(partIIOf(profileNoDeclaredKinds)('single')([])(
                [oneZeroNineEightEDoc('3000.00')])([])(6000000n))
            assertEq(result.studentLoanInterestWorksheet.w1, 250000n, '§221(b)(1)\'s $2,500.00')
            assertEq(result.line21.value, 250000n)
        },
        // EXACTLY AT the threshold. The printed line 6 asks "is line 4 MORE
        // than line 5?", so $85,000.00 exactly is still a full deduction —
        // the boundary a `>=` would get wrong by the whole phase-out.
        exactlyAtTheThresholdIsStillTheFullDeduction: () => {
            const result = okPartII(partIIOf(profileNoDeclaredKinds)('single')([])(
                [oneZeroNineEightEDoc('1842.63')])([])(8500000n))
            assertEq(result.studentLoanInterestWorksheet.w4, 8500000n)
            assertEq(result.studentLoanInterestWorksheet.w5, 8500000n)
            assertEq(result.studentLoanInterestWorksheet.w6, 0n, 'not MORE than line 5')
            assertEq(result.line21.value, 184263n)
        },
        // ONE CENT OVER the threshold, and the reason this leaf exists is
        // that the answer is surprising: the deduction is STILL the full
        // $1,842.63.
        //
        // Worksheet line 6 = $0.01. Line 7 divides it by $15,000 and rounds
        // to three decimal places: 0.01 / 15,000 = 0.00000067, which rounds
        // to 0.000. Line 8 is $1,842.63 x 0.000 = $0.00, and line 9 is the
        // whole amount.
        //
        // **This leaf does NOT constrain the rounding POINT**, and this
        // comment used to claim that it did. Verification moved the rounding
        // from the ratio to the product and the whole suite stayed green: at
        // one cent over, the alternative order gives round($0.0012) = $0.00
        // too. `theRoundingPointIsTheRatioNotTheProduct` below is the leaf
        // that actually bites; see this module's own docstring for the
        // arithmetic and for why the correction is recorded rather than
        // quietly fixed.
        theOneCentOverTheThresholdCase: () => {
            const result = okPartII(partIIOf(profileNoDeclaredKinds)('single')([])(
                [oneZeroNineEightEDoc('1842.63')])([])(8500001n))
            assertEq(result.studentLoanInterestWorksheet.w6, 1n, 'one cent over the threshold')
            assertEq(result.studentLoanInterestWorksheet.w7Thousandths, 0n, '0.000, per the printed rounding')
            assertEq(result.studentLoanInterestWorksheet.w8, 0n)
            assertEq(result.line21.value, 184263n, 'the FULL deduction, one cent over the threshold')
        },
        // INSIDE the range, at the midpoint: total income $92,500.00, so
        // line 6 = $7,500.00, line 7 = 7,500 / 15,000 = 0.500, line 8 =
        // $1,842.63 x 0.500 = $921.315, half-up to $921.32, and line 9 =
        // $1,842.63 - $921.32 = $921.31.
        //
        // The half-cent is deliberate: it is what makes the ROUNDING
        // DIRECTION observable. Truncating line 8 would give $921.31 and
        // leave line 9 at $921.32 — the two figures swap.
        insideTheRangeHalvesTheDeductionWithAHalfUpCent: () => {
            const result = okPartII(partIIOf(profileNoDeclaredKinds)('single')([])(
                [oneZeroNineEightEDoc('1842.63')])([])(9250000n))
            assertEq(result.studentLoanInterestWorksheet.w6, 750000n, '$7,500.00 over the threshold')
            assertEq(result.studentLoanInterestWorksheet.w7Thousandths, 500n, '0.500')
            assertEq(result.studentLoanInterestWorksheet.w8, 92132n, '$921.315 half-up to $921.32')
            assertEq(result.line21.value, 92131n, '$1,842.63 - $921.32 = $921.31')
        },
        // **The rounding POINT, and the only fixture in this file that
        // constrains it** — added after a mutation moved the rounding from
        // the printed line 7 ratio to the line 8 product and every existing
        // leaf stayed green.
        //
        // Total income $92,507.50, so worksheet line 6 is $7,507.50 and the
        // exact ratio is 7,507.50 / 15,000 = 0.5005 — exactly half a
        // thousandth, the worst case for the printed three-decimal rounding.
        // Line 7 rounds it half-up to 0.501, so line 8 is $1,842.63 x 0.501 =
        // $923.15763, half-up to $923.16, and line 9 is $1,842.63 - $923.16 =
        // $919.47.
        //
        // Rounding the PRODUCT instead would give $1,842.63 x 0.5005 =
        // $922.2363, half-up to $922.24, and a line 9 of $920.39 — ninety-two
        // cents higher. Both figures are hand-computed here so a reader can
        // see which order produced which.
        theRoundingPointIsTheRatioNotTheProduct: () => {
            const result = okPartII(partIIOf(profileNoDeclaredKinds)('single')([])(
                [oneZeroNineEightEDoc('1842.63')])([])(9250750n))
            assertEq(result.studentLoanInterestWorksheet.w6, 750750n, '$7,507.50 over the threshold')
            assertEq(result.studentLoanInterestWorksheet.w7Thousandths, 501n,
                '0.5005 rounded half-up to three places is 0.501, NOT 0.500')
            assertEq(result.studentLoanInterestWorksheet.w8, 92316n,
                '$1,842.63 x 0.501 = $923.15763, half-up to $923.16')
            assertEq(result.line21.value, 91947n, '$1,842.63 - $923.16 = $919.47')
            // The figure the un-printed order would have produced, named so
            // the leaf says what it is refusing rather than only what it
            // expects.
            assert(
                result.line21.value !== 92039n,
                ['rounding the product instead of the ratio would give $920.39', result.line21.value],
            )
        },
        // FULLY PHASED OUT, exactly at the top of the range: $100,000.00 is
        // $15,000.00 over the threshold, line 7 is 1.000, and line 9 is $0.00.
        exactlyAtTheTopOfTheRangeIsFullyPhasedOut: () => {
            const result = okPartII(partIIOf(profileNoDeclaredKinds)('single')([])(
                [oneZeroNineEightEDoc('1842.63')])([])(10000000n))
            assertEq(result.studentLoanInterestWorksheet.w6, 1500000n)
            assertEq(result.studentLoanInterestWorksheet.w7Thousandths, 1000n, '1.000')
            assertEq(result.line21.value, 0n)
        },
        // ONE CENT OVER the top of the range: the printed "if the result is
        // 1.000 or more, enter 1.000" cap holds, and the deduction stays
        // $0.00 rather than going negative.
        oneCentOverTheTopOfTheRangeStaysAtZero: () => {
            const result = okPartII(partIIOf(profileNoDeclaredKinds)('single')([])(
                [oneZeroNineEightEDoc('1842.63')])([])(10000001n))
            assertEq(result.studentLoanInterestWorksheet.w7Thousandths, 1000n, 'capped at 1.000')
            assertEq(result.line21.value, 0n)
        },
        // A joint return reads BOTH its own threshold ($170,000.00) AND its
        // own range ($30,000.00). $185,000.00 is $15,000.00 over the joint
        // threshold, which is HALF the joint range, so line 7 is 0.500 and
        // the answer matches the single midpoint case exactly.
        //
        // If the joint threshold were paired with the SINGLE range, line 7
        // would be 1.000 and line 21 would be $0.00 — which is why this
        // fixture is at a point where the two answers differ maximally.
        aJointReturnReadsItsOwnThresholdAndItsOwnRange: () => {
            const result = okPartII(partIIOf(profileJoint)('marriedFilingJointly')([])(
                [oneZeroNineEightEDoc('1842.63')])([])(18500000n))
            assertEq(result.studentLoanInterestWorksheet.w5, 17000000n, '$170,000.00')
            assertEq(result.studentLoanInterestWorksheet.w6, 1500000n, '$15,000.00 over')
            assertEq(result.studentLoanInterestWorksheet.w7Thousandths, 500n,
                '$15,000.00 / $30,000.00 = 0.500, NOT / $15,000.00 = 1.000')
            assertEq(result.line21.value, 92131n)
        },
        // §221(e)(2): a married-filing-separately filer gets $0.00 at ANY
        // income, and the gate runs before worksheet line 1. Total income
        // $10,000.00 — far below every threshold — so the zero can only come
        // from the filing-status gate, never from the arithmetic.
        marriedFilingSeparatelyIsZeroAtAnyIncome: () => {
            const result = okPartII(partIIOf(profileNoDeclaredKinds)('marriedFilingSeparately')([])(
                [oneZeroNineEightEDoc('1842.63')])([])(1000000n))
            assertEq(result.studentLoanInterestWorksheet.w1, 0n, 'the gate runs before line 1')
            assertEq(result.line21.value, 0n)
        },
        // The CONTROL for the gate: the identical facts on a SINGLE return
        // deduct the whole amount. Without this, a gate that zeroed every
        // status would pass the leaf above.
        theSameFactsOnASingleReturnDeductInFull: () => {
            const result = okPartII(partIIOf(profileNoDeclaredKinds)('single')([])(
                [oneZeroNineEightEDoc('1842.63')])([])(1000000n))
            assertEq(result.line21.value, 184263n)
        },
        // BOTH dialects feed line 21 — the decision `fjs/document/1098e`'s
        // header records. $1,842.63 reported by a servicer plus $200.00 of
        // interest on a private loan nobody files a 1098-E for = $2,042.63,
        // and each source cites its own document with its own box path.
        theTranscribedAndAssertedHalvesAreBothRead: () => {
            const result = okPartII(partIIOf(profileNoDeclaredKinds)('single')(
                [adjustmentsDoc([{
                    lineTag: 'studentLoanInterest',
                    datePaid: '2025-11-30',
                    description: 'interest on a family loan',
                    amount: '200.00',
                    individual: 'taxpayer',
                }])([])])([oneZeroNineEightEDoc('1842.63')])([])(6000000n))
            assertEq(result.line21.value, 204263n, '$1,842.63 + $200.00')
            const boxPaths = result.line21.sources.map(s => s.boxPath)
            assert(
                boxPaths.includes('box1StudentLoanInterestReceived'),
                ['the transcribed half must be cited', boxPaths],
            )
            assert(
                boxPaths.includes('entries[lineTag=studentLoanInterest]'),
                ['the asserted half must be cited', boxPaths],
            )
        },
        // A checked box 2 means box 1 is INCOMPLETE. Refused, naming the box
        // and what is missing from it.
        aCheckedBoxTwoIsRefusedNamingWhatIsMissing: () => {
            const withBoxTwo = oneZeroNineEightEDoc('1842.63')
            const result = refusal(partIIOf(profileNoDeclaredKinds)('single')([])([{
                ...withBoxTwo,
                value: {
                    ...withBoxTwo.value,
                    box2ExcludesOriginationFeesAndCapitalizedInterest: true,
                },
            }])([])(6000000n))
            assert(result.message.includes('box 2'), ['must name the box', result.message])
            assert(
                result.message.includes('origination fees'),
                ['must name what box 1 is missing', result.message],
            )
            assert(
                result.message.includes('sha256-1098e-a'),
                ['must name WHICH form, by the hash a reader can look up', result.message],
            )
        },
        // The phase-out runs against TOTAL INCOME MINUS the other
        // adjustments, not against total income alone. $86,000.00 of income
        // with $1,000.00 of educator-and-HSA adjustments is $85,000.00 of
        // phase-out income — exactly at the threshold, so the deduction is
        // full. Without the subtraction it would be $1,000.00 over and the
        // deduction would be reduced.
        theOtherAdjustmentsAreSubtractedBeforeThePhaseOut: () => {
            const result = okPartII(partIIOf(profileNoDeclaredKinds)('single')(
                [adjustmentsDoc([
                    educatorEntry('300.00')('taxpayer'),
                    hsaEntry('700.00')('taxpayer'),
                ])([fullYearCoverage('taxpayer')('selfOnly')])])(
                [oneZeroNineEightEDoc('1842.63')])([])(8600000n))
            assertEq(result.line11.value, 30000n)
            assertEq(result.line13.value, 70000n)
            assertEq(result.studentLoanInterestWorksheet.w3, 100000n, '$300.00 + $700.00')
            assertEq(result.studentLoanInterestWorksheet.w4, 8500000n, '$86,000.00 - $1,000.00')
            assertEq(result.studentLoanInterestWorksheet.w6, 0n)
            assertEq(result.line21.value, 184263n, 'the full deduction, because line 3 was subtracted')
        },
    },

    // ── Part II's total, and the two named adjustment totals ────────────────

    // Every one of the three lines this phase claims must REACH line 26, and
    // line 26 must be their sum plus nothing else. $300.00 + $700.00 +
    // $1,842.63 = $2,842.63.
    allThreeNewLinesReachTheLine26TotalThatFeeds1040Line10: () => {
        const result = okPartII(partIIOf(profileNoDeclaredKinds)('single')(
            [adjustmentsDoc([
                educatorEntry('300.00')('taxpayer'),
                hsaEntry('700.00')('taxpayer'),
            ])([fullYearCoverage('taxpayer')('selfOnly')])])(
            [oneZeroNineEightEDoc('1842.63')])([])(6000000n))
        assertEq(result.line11.value, 30000n)
        assertEq(result.line13.value, 70000n)
        assertEq(result.line21.value, 184263n)
        assertEq(result.line26.value, 284263n, '$300.00 + $700.00 + $1,842.63')
        assertEq(
            result.line26.value,
            result.line11.value + result.line13.value + result.line21.value,
            'line 26 is those three and nothing else',
        )
    },

    // TAX-15: the two worksheets ask for DIFFERENT ranges of Part II lines,
    // and they agree today only because every line between them is a
    // documented zero. Stated as a leaf so the coincidence is recorded rather
    // than relied on: line 23 (Archer MSA) is in the Social Security
    // worksheet's range and not in the student loan worksheet's.
    theTwoAdjustmentTotalsAreSeparateRulesThatHappenToAgree: () => {
        const stageOne = okStageOne(scheduleOnePartIIExceptStudentLoanInterest(taxParams2025)({
            profile: profileNoDeclaredKinds,
            status: 'single',
            passThrough: noPassThrough,
            adjustmentForms: [adjustmentsDoc([
                educatorEntry('300.00')('taxpayer'),
                hsaEntry('700.00')('taxpayer'),
            ])([fullYearCoverage('taxpayer')('selfOnly')])],
            w2Forms: [],
            businessNetProfit: noBusinessNetProfit(profileNoDeclaredKinds),
            businessExpenseForms: [],
        }))
        assertEq(socialSecurityWorksheetAdjustmentsTotal(stageOne), 100000n, 'lines 11-20, 23, 25')
        assertEq(studentLoanInterestWorksheetOtherAdjustments(stageOne), 100000n,
            'lines 11-20 plus write-ins on 24z')
        // The one summand that distinguishes them is line 23, which is a
        // documented zero today. When it stops being one, these two figures
        // MUST diverge, and this assertion is what will say so.
        assertEq(stageOne.line23.value, 0n,
            'the Archer MSA line is what separates the two rules; while it is zero they agree')
    },

    // TAX-15's named income function, exercised on its own so the phase-out's
    // income measure is checkable without running the whole worksheet.
    // §221(b)(2)(C)'s three exclusions are all permanently zero here.
    studentLoanInterestPhaseoutIncomeIsTotalIncomeMinusTheOtherAdjustments: () => {
        assertEq(studentLoanInterestPhaseoutIncome(8600000n)(100000n), 8500000n)
        assertEq(studentLoanInterestPhaseoutIncome(0n)(0n), 0n)
        // It is NOT bare AGI: AGI would already have line 21 itself
        // subtracted, which is exactly the circularity this measure avoids.
        assert(
            studentLoanInterestPhaseoutIncome(8600000n)(100000n) !== 8600000n,
            'the other adjustments must actually be subtracted',
        )
    },

    // ── The structural guarantees ───────────────────────────────────────────

    // The phase's own success criterion, asserted mechanically: on a return
    // that carries documents for all three lines, NONE of lines 11, 13 or 21
    // cites `declaredKinds` — the hard zero was REPLACED, not supplemented —
    // and every OTHER Part II line still does.
    noZeroLineHelperRemainsOnALineThisPhaseClaims: () => {
        const result = okPartII(partIIOf(profileNoDeclaredKinds)('single')(
            [adjustmentsDoc([
                educatorEntry('300.00')('taxpayer'),
                hsaEntry('700.00')('taxpayer'),
            ])([fullYearCoverage('taxpayer')('selfOnly')])])(
            [oneZeroNineEightEDoc('1842.63')])([])(6000000n))
        /** @type {readonly (readonly [string, ReportLine])[]} */
        const linesThisPhaseClaims = [
            ['line11', result.line11], ['line13', result.line13], ['line21', result.line21],
        ]
        assertEq(linesThisPhaseClaims.length, 3, 'this phase claims exactly three Part II lines')
        for (const [name, line] of linesThisPhaseClaims) {
            assert(
                !line.sources.some(s => s.boxPath === 'declaredKinds'),
                ['this line must cite real documents, never the profile placeholder', name],
            )
        }
        // The counterweight: a hand-typed list of the twelve lines that MUST
        // still be documented zeros, so a line quietly re-pointed at a
        // document is caught by name. Derived from the printed form, never
        // from the returned object.
        assertEq(partIILinesStillDocumentedZero.length, 11, 'sixteen Part II lines, less 11/13/15/21/26')
        /** @type {Record<string, ReportLine>} */
        const byName = {
            line12: result.line12, line14: result.line14,
            line16: result.line16, line17: result.line17, line18: result.line18,
            line19a: result.line19a, line20: result.line20, line22: result.line22,
            line23: result.line23, line24: result.line24, line25: result.line25,
        }
        for (const name of partIILinesStillDocumentedZero) {
            const line = byName[name]
            assert(line !== undefined, ['expected a line under this name', name])
            assertEq(line.value, 0n, ['this line must still be zero', name])
            assertEq(line.sources.length, 1, ['this line must still cite only the profile', name])
            assertEq(line.sources[0].boxPath, 'declaredKinds', ['still a documented zero', name])
        }
    },

    // The staged path (`fjs/form1040/core`'s, which must interleave the
    // Social Security Benefits Worksheet between the two stages) and the
    // composed path (`scheduleOne`) must produce the identical line 26. Two
    // call paths to one figure is exactly the shape that drifts silently.
    stagedAndComposedFormsAgreeOnLineTwentySix: () => {
        const adjustmentForms = [adjustmentsDoc([
            educatorEntry('300.00')('taxpayer'),
            hsaEntry('700.00')('taxpayer'),
        ])([fullYearCoverage('taxpayer')('selfOnly')])]
        const studentLoanInterestForms = [oneZeroNineEightEDoc('1842.63')]
        const staged = okPartII(partIIOf(profileNoDeclaredKinds)('single')(adjustmentForms)(
            studentLoanInterestForms)([])(9250000n))
        const composed = scheduleOne(taxParams2025)({
            profile: profileNoDeclaredKinds,
            status: 'single',
            unemploymentForms: [unemploymentA],
            nonemployeeCompensationForms: [],
            businessExpenseForms: [],
            partnershipK1Forms: [],
            sCorporationK1Forms: [],
            adjustmentForms,
            studentLoanInterestForms,
            w2Forms: [],
            totalIncomeLine: totalIncomeOf(9250000n),
        })
        assert(composed.kind === 'ok', ['expected a computed schedule', composed])
        assertEq(composed.line26.value, staged.line26.value)
        assertEq(composed.line21.value, staged.line21.value)
        assertEq(composed.line11.value, staged.line11.value)
        assertEq(composed.line13.value, staged.line13.value)
        // And the composed form carries Part I too, which the staged
        // comparison above cannot see.
        assertEq(composed.line7.value, 455400n)
        assertEq(composed.line10.value, 455400n)
    },

    // A refusal from stage 1 must reach a `scheduleOne` caller too, rather
    // than being swallowed by the composition.
    aStageOneRefusalPropagatesThroughTheComposedForm: () => {
        const composed = scheduleOne(taxParams2025)({
            profile: profileNoDeclaredKinds,
            status: 'single',
            unemploymentForms: [],
            nonemployeeCompensationForms: [],
            businessExpenseForms: [],
            partnershipK1Forms: [],
            sCorporationK1Forms: [],
            adjustmentForms: [adjustmentsDoc([educatorEntry('250.00')('spouse')])([])],
            studentLoanInterestForms: [],
            w2Forms: [],
            totalIncomeLine: totalIncomeOf(0n),
        })
        assertEq(composed.kind, 'error')
    },

    // ── The refusals `vnd.fjs.adjustments` deliberately leaves to this layer ─

    refusals: {
        // The dialect keeps `lineTag` a free string; this is the layer that
        // owns the vocabulary, and it refuses rather than dropping an amount
        // it does not understand.
        anUnrecognizedLineTagIsRefusedNamingItAndTheKnownSet: () => {
            const result = refusal(partIIOf(profileNoDeclaredKinds)('single')(
                [adjustmentsDoc([{
                    lineTag: 'alimonyPaid',
                    datePaid: '2025-03-01',
                    description: 'court-ordered alimony',
                    amount: '12000.00',
                    individual: 'taxpayer',
                }])([])])([])([])(0n))
            assert(result.message.includes('alimonyPaid'), ['must name the tag', result.message])
            assert(
                result.message.includes('court-ordered alimony'),
                ['must name the entry a reader would go and look at', result.message],
            )
            assert(
                result.message.includes('educatorExpenses')
                    && result.message.includes('hsaContribution')
                    && result.message.includes('studentLoanInterest'),
                ['must name the set it DOES compute', result.message],
            )
        },
        // A following-year `datePaid` is storable only because an HSA
        // contribution may be designated for the prior year. On any other
        // tag it is a deduction on the following year's return.
        aFollowingYearEducatorExpenseIsRefused: () => {
            const result = refusal(partIIOf(profileNoDeclaredKinds)('single')(
                [adjustmentsDoc([{
                    ...educatorEntry('287.45')('taxpayer'),
                    datePaid: '2026-03-04',
                }])([])])([])([])(0n))
            assert(result.message.includes('2026-03-04'), ['must quote the date', result.message])
            assert(result.message.includes('educatorExpenses'), ['must name the tag', result.message])
        },
        // The CONTROL: the identical date on an HSA contribution computes,
        // which is the whole reason the dialect accepts the year at all.
        aFollowingYearHsaContributionComputes: () => {
            const result = okPartII(partIIOf(profileNoDeclaredKinds)('single')(
                [adjustmentsDoc([{ ...hsaEntry('2000.00')('taxpayer'), datePaid: '2026-03-04' }])(
                    [fullYearCoverage('taxpayer')('selfOnly')])])([])([])(0n))
            assertEq(result.line13.value, 200000n)
        },
    },

    // Every printed line is named -- a hand-typed count-guard so a line
    // silently dropped from `scheduleOne`'s return object is caught (AGENTS.md's
    // "hand-typed count" mutation-gate idiom).
    everyPrintedLineIsNamed: () => {
        const composed = scheduleOne(taxParams2025)({
            profile: profileNoDeclaredKinds,
            status: 'single',
            unemploymentForms: [],
            nonemployeeCompensationForms: [],
            businessExpenseForms: [],
            partnershipK1Forms: [],
            sCorporationK1Forms: [],
            adjustmentForms: [],
            studentLoanInterestForms: [],
            w2Forms: [],
            totalIncomeLine: totalIncomeOf(0n),
        })
        assert(composed.kind === 'ok', ['expected a computed schedule', composed])
        const expectedFieldCount = 27
        assertEq(
            Object.keys(composed).length,
            expectedFieldCount,
            'expected exactly 26 named Schedule 1 fields plus the kind tag',
        )
    },
    // This module computes a schedule, not a stored document -- no
    // `dialect`/`mediaType`, mirroring `fjs/schedule/b`'s own leaf.
    dialectIndependence: () => {
        const result = partIWithoutBusiness(profileNoDeclaredKinds)([])
        assert(!('dialect' in result), 'scheduleOne output must not carry a dialect tag')
        assert(!('mediaType' in result), 'scheduleOne output must not carry a mediaType')
    },
}
