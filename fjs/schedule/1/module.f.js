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
 * ## Line 17, the self-employed health insurance deduction (TAX-39)
 *
 * `fjs/form7206` line 14, restated under this schedule's printed number. The
 * fourth Part II line to stop being a documented zero, and the one whose
 * arrival changed the least about this file: **it needed no ordering change at
 * all.** Every figure Form 7206 reads — the premiums off `vnd.fjs.adjustments`,
 * Schedule C line 31, Schedule SE line 13 and line 16 — is already bound at
 * the statement where the hard zero stood. What it needed was six `lineTag`s
 * and one `vnd.fjs.return_profile` certification.
 *
 * That is worth stating because the row's `fjs/return/scope` remedy had said
 * for two phases that its blocker was net self-employment earnings, and that
 * had been false since Phase 28 computed them. See
 * `fjs/schedule/1/todo/self-employed-health-insurance.md`, which also records
 * why this line does NOT share a root cause with `fjs/form2441`'s
 * self-employment refusal — that one IS an ordering problem and is not
 * retired here.
 *
 * **Line 17 is inside the Social Security worksheet's "lines 11 through 20"
 * range**, so it moves taxable benefits exactly as line 15 does, and it
 * reduces §199A qualified business income through `fjs/form8995`. Five
 * refusals guard it; the todo file lists each and what would retire it.
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
import { assert, assertEq } from 'functionalscript/fjs/asserts/module.f.mjs'
import { of, halfUp } from '../../types/rational/module.f.js'
import { centsFromString, centsToString } from '../../exact/module.f.js'
import { form8889PartI } from '../../form8889/module.f.js'
import { movingExpenses, movingExpensesLine4W2Box12Codes } from '../../form3903/module.f.js'
import { scheduleC } from '../c/module.f.js'
import { form7206, longTermCareCapCents } from '../../form7206/module.f.js'
import { scheduleE } from '../e/module.f.js'
import { scheduleF } from '../f/module.f.js'
import { form461 } from '../../form461/module.f.js'
import {
    scheduleSelfEmploymentPartI,
    socialSecurityWagesAlreadyTaxed,
    twoSelfEmployedPeopleRefusal,
    wagesAttributionRefusal,
} from '../se/module.f.js'
import { socialSecurityBenefitsWorksheet } from '../../tax/ssb/module.f.js'
import { taxParamsByYear } from '../../tax/params/module.f.js'

/** @import { ReturnProfile } from '../../return/profile/module.f.js' */
/** @import { OneZeroNineNineG } from '../../document/1099g/module.f.js' */
/** @import { OneZeroNineNineInt } from '../../document/1099int/module.f.js' */
/** @import { OneZeroNineEightE } from '../../document/1098e/module.f.js' */
/** @import { Adjustments } from '../../document/adjustments/module.f.js' */
/** @import { BusinessExpenses } from '../../document/business_expenses/module.f.js' */
/** @import { AssetRegister } from '../../document/asset_register/module.f.js' */
/** @import { RentalProperty } from '../../document/rental_property/module.f.js' */
/** @import { Farm } from '../../document/farm/module.f.js' */
/** @import { OneZeroNineNineNec } from '../../document/1099nec/module.f.js' */
/** @import { ScheduleC } from '../c/module.f.js' */
/** @import { ScheduleE } from '../e/module.f.js' */
/** @import { ScheduleF } from '../f/module.f.js' */
/** @import { Form461 } from '../../form461/module.f.js' */
/** @import { K1Partnership } from '../../document/k1_1065/module.f.js' */
/** @import { K1SCorporation } from '../../document/k1_1120s/module.f.js' */
/** @import { K1EstateTrust } from '../../document/k1_1041/module.f.js' */
/** @import { SelfEmploymentOutcome } from '../se/module.f.js' */
/** @import { W2 } from '../../document/w2/module.f.js' */
/** @import { ReportLine, Source } from '../../report/line/module.f.js' */
/** @import { TaxParamSet, IndividualFilingStatus, LongTermCareAgeBand } from '../../tax/params/module.f.js' */
/** @import { LongTermCareCoveredPerson } from '../../form7206/module.f.js' */
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
    // ── Line 14's TWO tags: Form 3903's printed lines 1 and 2 ──────────────
    //
    // Two tags for one printed line, the `traditionalIraContribution` /
    // `…AgeFiftyOrOver` precedent one block down, and for the same reason:
    // Form 3903 keeps them apart on its own face, line 3 adds them, and
    // nothing downstream could recover the split from a single figure. NO
    // dialect in this engine carries either amount — there is no information
    // return for what a household move cost — so they arrive the way an
    // educator expense does, on `vnd.fjs.adjustments`.
    //
    // **`…ExcludingMeals` is part of the tag, not a comment.** Line 2's
    // printed caption ends *"Do not include the cost of meals"* and
    // `i3903.pdf` says it twice more, while `fjs/form3903` takes line 2 as an
    // ALREADY-NET figure and has no meals input, deliberately: a line-2
    // figure that arrived with meals in it is indistinguishable, there, from
    // one that did not. The exclusion can therefore only be enforced where
    // the figure is named, which is here. A taxpayer tagging a meals-inclusive
    // amount with this tag is making a false statement, exactly as one tagging
    // a Roth contribution `traditionalIraContribution` would be.
    ['movingExpensesTransportationAndStorage', 'Schedule 1 line 14'],
    ['movingExpensesTravelAndLodgingExcludingMeals', 'Schedule 1 line 14'],
    // **`traditionalIraContribution`, never `iraContribution`.** A Roth
    // contribution is not deductible at ALL (§408A(c)(1)) and belongs on no
    // Schedule 1 line; because this vocabulary is CLOSED, an entry tagged
    // `rothIraContribution` is refused BY NAME rather than silently deducted.
    // A tag called `iraContribution` would invite exactly that mistake, and
    // the mistake is worth up to $8,000 of deduction that does not exist.
    ['traditionalIraContribution', 'Schedule 1 line 20'],
    // **TWO tags for one printed line, and the second one is an ASSERTION.**
    // §219(b)(5)(B)(ii) raises the deductible amount by $1,000 for an
    // individual who attained age 50 before the close of the year, and NO
    // DOCUMENT IN THIS REPOSITORY CARRIES A BIRTH DATE
    // (`.planning/PERSONA-COVERAGE.md`, and the reason
    // `form4972LumpSumDistribution` is refused). The fact is the taxpayer's
    // to state, exactly as `vnd.fjs.adjustments`' own
    // `eligibleForCatchUpContribution` lets them state §223(b)(3)'s age-55
    // health-savings-account catch-up — the same kind of fact, one line up
    // this same schedule, already carried by the same document.
    //
    // Untagged is NOT "under 50": it is UNKNOWN, and
    // {@link scheduleOnePartIIExceptStudentLoanInterest} refuses whenever the
    // unknown could change the answer rather than assuming either age.
    ['traditionalIraContributionAgeFiftyOrOver', 'Schedule 1 line 20'],
    ['studentLoanInterest', 'Schedule 1 line 21'],
    // ── Line 17's SIX tags: Form 7206's printed lines 1 and 2 (TAX-39) ──────
    //
    // **Six tags for one printed line, and the split is the printed form's
    // own.** Form 7206 line 1 is uncapped and line 2 is capped PER COVERED
    // PERSON by §213(d)(10)'s age-banded limit, so a single "health insurance
    // premiums" tag could not be capped at all: the two halves are added on
    // line 3 only after the second has been capped, and nothing downstream
    // could recover the split from one figure. This is the
    // `movingExpensesTransportationAndStorage`/`…TravelAndLodging` shape one
    // block up, at five bands instead of two.
    //
    // **`MedicalDentalVision` names what line 1 admits and what it does NOT.**
    // The caption is "the total amount paid in 2025 for health insurance
    // coverage established under your business … for you, your spouse, and
    // your dependents", and the 2025 Instructions for Form 7206 gloss it as
    // "medical, dental, and vision insurance and qualified long-term care
    // insurance" — the long-term-care half being line 2's, never this tag's.
    //
    // **MEDICARE PREMIUMS BELONG UNDER THIS TAG.** CCA 201228037
    // (POSTU-109706-12, UILC 162.07-31): "All Medicare Parts are insurance
    // that constitutes medical care under section 162(l)", and so "all
    // Medicare premiums are similar to other health insurance premiums and can
    // be used to compute the deduction under section 162(l)". Restated on the
    // 2025 Instructions for Form 7206, p. 1: "Medicare premiums you
    // voluntarily pay to obtain insurance in your name that is similar to
    // qualifying private health insurance can be used to figure the
    // deduction." The CCA is not precedential on its face and is the only IRS
    // authority on point; the current instructions are what this engine
    // actually follows, and they say the same thing for the taxpayer's own
    // premiums. This is stated HERE rather than left to a reader's memory
    // because a self-employed retiree who omits Medicare is the single most
    // common way this deduction is understated.
    //
    // **Three amounts the taxpayer must NOT tag with any of these six**, all
    // three printed as exclusions on line 1's own face:
    //
    // - amounts for any month of employer-subsidized eligibility — §162(l)(2)(B),
    //   which `vnd.fjs.return_profile`'s
    //   `notEligibleForAnySubsidizedEmployerHealthPlanInAnyMonth` certifies
    //   away for the WHOLE year and which
    //   {@link scheduleOnePartIIExceptStudentLoanInterest} refuses without;
    // - "any amounts paid, not to exceed $3,000, from retirement plan
    //   distributions that were nontaxable because you are a retired public
    //   safety officer" (§402(l)) — a fact about a Form 1099-R distribution
    //   that no dialect here records, so like this vocabulary's own
    //   `…ExcludingMeals` it can only be enforced where the figure is NAMED,
    //   which is here;
    // - payments for qualified long-term care insurance, which are line 2's
    //   and belong on one of the five band tags below.
    ['selfEmployedHealthInsuranceMedicalDentalVision', 'Schedule 1 line 17'],
    // **FIVE tags, one per §213(d)(10) band, and each is an ASSERTION about
    // the covered person's "age at the end of the tax year"** (Form 7206 line
    // 2(b)). NO DOCUMENT IN THIS REPOSITORY CARRIES A BIRTH DATE — the same
    // fact `traditionalIraContributionAgeFiftyOrOver` records above, and the
    // reason `form4972LumpSumDistribution` is refused — so the band is the
    // taxpayer's to state, on the same document and by the same mechanism.
    //
    // The band names are `fjs/tax/params`' own `LongTermCareAgeBand` values,
    // suffixed onto one stem, and
    // `theLongTermCareTagsCoverEveryStoredAgeBandExactlyOnce` pins the two
    // lists against each other: a band added to the parameter table with no
    // tag here would be a cap no taxpayer could ever reach, and a tag with no
    // band would panic inside `fjs/form7206` instead of refusing at ingest.
    ['selfEmployedLongTermCareAgeFortyOrYounger', 'Schedule 1 line 17'],
    ['selfEmployedLongTermCareAgeFortyOneToFifty', 'Schedule 1 line 17'],
    ['selfEmployedLongTermCareAgeFiftyOneToSixty', 'Schedule 1 line 17'],
    ['selfEmployedLongTermCareAgeSixtyOneToSeventy', 'Schedule 1 line 17'],
    ['selfEmployedLongTermCareAgeSeventyOneOrOlder', 'Schedule 1 line 17'],
])

/**
 * The one {@link adjustmentLineTags} entry that feeds Form 7206 line 1 — the
 * uncapped half of the §162(l) premium. Named once so the filter and the
 * citation cannot come apart from the tag.
 * @type {string}
 */
const medicalDentalVisionTag = 'selfEmployedHealthInsuranceMedicalDentalVision'

/**
 * The five {@link adjustmentLineTags} entries that feed Form 7206 line 2,
 * paired with the {@link LongTermCareAgeBand} each one asserts.
 *
 * A hand-written pairing rather than a name derived by string concatenation:
 * a derived name would make the tag vocabulary a function of the parameter
 * table, and neither list could then notice the other losing an entry —
 * AGENTS.md's fourth shipped defect, in its "iterate a collection derived from
 * the thing under test" form.
 * @type {readonly (readonly [string, LongTermCareAgeBand])[]}
 */
const longTermCareTagBands = [
    ['selfEmployedLongTermCareAgeFortyOrYounger', 'ageFortyOrYounger'],
    ['selfEmployedLongTermCareAgeFortyOneToFifty', 'ageFortyOneToFifty'],
    ['selfEmployedLongTermCareAgeFiftyOneToSixty', 'ageFiftyOneToSixty'],
    ['selfEmployedLongTermCareAgeSixtyOneToSeventy', 'ageSixtyOneToSeventy'],
    ['selfEmployedLongTermCareAgeSeventyOneOrOlder', 'ageSeventyOneOrOlder'],
]

/**
 * Where a Schedule 1 line 17 refusal says the amount would have gone.
 *
 * Written once and interpolated into all five of that line's refusals, for
 * AGENTS.md's recorded reason: Phase 20's `${destination}` mutation survived
 * five refusal proofs because every one of them asserted the box name and the
 * phrase "cannot compute", and not one asserted WHERE the amount would have
 * landed -- the only part of the message a reader can act on.
 * @type {string}
 */
const line17Destination = 'Schedule 1 line 17 -> line 26 -> 1040 line 10 (and so adjusted gross '
    + 'income), nor Form 8995 line 1c through §199A(c)(1)'

/** Every tag that feeds Schedule 1 line 17, line 1's and line 2's alike.
 * @type {readonly string[]}
 */
const selfEmployedHealthInsuranceTags = [
    medicalDentalVisionTag,
    ...longTermCareTagBands.map(([tag]) => tag),
]

/**
 * The two {@link adjustmentLineTags} entries that feed Schedule 1 line 20 —
 * the contribution and the same contribution with §219(b)(5)(B)(ii)'s age-50
 * catch-up asserted beside it. Named once so the filter, the following-year
 * rule and the citation cannot come apart.
 * @type {readonly string[]}
 */
const iraContributionTags = ['traditionalIraContribution', 'traditionalIraContributionAgeFiftyOrOver']

/** The one of {@link iraContributionTags} that asserts the age.
 * @type {string}
 */
const catchUpAssertedTag = 'traditionalIraContributionAgeFiftyOrOver'

/**
 * The tags whose payment may legitimately be made in the FOLLOWING calendar
 * year and still be designated for this return's tax year.
 *
 * §223(h)/§223(b) allows it for a health savings account contribution and
 * **§219(f)(3) allows it for a traditional IRA contribution** — *"a taxpayer
 * shall be deemed to have made a contribution on the last day of the
 * preceding taxable year if the contribution is made on account of such
 * taxable year and is made not later than the time prescribed by law for
 * filing the return for such taxable year"*. That is how a large share of
 * real IRA contributions are made, and a rule that refused them would refuse
 * the ordinary case.
 *
 * Everything else on this schedule is deducted in the year it was paid, so a
 * following-year `datePaid` on any other tag is refused: a classroom supply
 * bought in March 2026 is a 2026 deduction and nothing downstream could
 * notice. Written as its own named list rather than an inline `!==`, because
 * it now has two members and a second `||` term in a condition is exactly
 * where a third one gets forgotten.
 * @type {readonly string[]}
 */
const followingYearContributionTags = ['hsaContribution', ...iraContributionTags]

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

/**
 * Line 18, penalty on early withdrawal of savings: the sum of box 2 across
 * every stored `vnd.fjs.1099int`, citing ONE source per document.
 *
 * **§62(a)(9) has no floor, no threshold and no phase-out**, which is why
 * this line is a sum and not a form. A bank that charges forfeited interest
 * for breaking a term deposit reports the whole charge in box 2, and the
 * whole of it is an above-the-line deduction. There is no worksheet and no
 * form to attach — the box IS the computation, which is what separates this
 * line from every other still-refused adjustment on this schedule.
 *
 * **A box that is present and `'0.00'` still cites its document.** The
 * filter is on presence, never on value: a Form 1099-INT that reported a
 * zero penalty said something, and a return that never received one said
 * nothing. Collapsing the two would make the citation claim a document the
 * taxpayer does not hold. This is the same presence-not-value rule
 * {@link unemploymentCompensationLine} follows one line above.
 * @type {(profile: Stored<ReturnProfile>) => (forms: readonly Stored<OneZeroNineNineInt>[]) => ReportLine}
 */
const earlyWithdrawalPenaltyLine = profile => forms => {
    const rule = 'Schedule 1 line 18 (penalty on early withdrawal of savings)'
    const withBox2 = forms.filter(form => form.value.box2EarlyWithdrawalPenalty !== undefined)
    const sources = withBox2.map(form => {
        const printed = form.value.box2EarlyWithdrawalPenalty
        assert(printed !== undefined, ['filtered to present box 2', form.documentHash])
        return { documentHash: form.documentHash, boxPath: 'box2EarlyWithdrawalPenalty', value: printed }
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
 *   readonly line7: ReportLine, readonly line8: ReportLine, readonly line8p: ReportLine,
 *   readonly line9: ReportLine,
 *   readonly line10: ReportLine,
 *   readonly scheduleC: ScheduleC,
 *   readonly scheduleE: ScheduleE,
 *   readonly scheduleF: ScheduleF,
 *   readonly form461: Form461,
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
 *   readonly assetRegisters: readonly Stored<AssetRegister>[],
 *   readonly rentalProperties: readonly Stored<RentalProperty>[],
 *   readonly farmForms: readonly Stored<Farm>[],
 *   readonly partnershipK1Forms: readonly Stored<K1Partnership>[],
 *   readonly sCorporationK1Forms: readonly Stored<K1SCorporation>[],
 *   readonly estateTrustK1Forms: readonly Stored<K1EstateTrust>[],
 *   readonly status: IndividualFilingStatus,
 *   readonly form1040Line7aCents: bigint,
 *   readonly otherGainsOrLosses?: OtherGainsOrLosses,
 *   readonly form2555Line45Cents: bigint,
 * }} ScheduleOnePartIInput
 */

/**
 * Form 4797 line 18b, as printed Schedule 1 line 4 receives it — TAX-41.
 *
 * **A NUMBER, not a document**, the shape `fjs/schedule/d`'s
 * `SectionTwelveFiftySixEntries` set: printed Form 4797 line 18b says "Enter
 * here and on Schedule 1 (Form 1040), Part I, line 4", so this schedule copies
 * a figure another form computed rather than reading an asset register. It
 * runs in `fjs/form1040/core` because its other two answers go to Schedule D,
 * and running the form twice is the only way the three could disagree.
 *
 * `filed` distinguishes "no Form 4797" from "a Form 4797 whose line 18b came
 * to zero": the first must print as a profile-declared zero citing no
 * document, and the second as a computed zero citing the register.
 *
 * OPTIONAL, because a return with no disposals has no Form 4797 at all.
 * @typedef {{
 *   readonly filed: boolean,
 *   readonly lineEighteenBCents: bigint,
 *   readonly sources: readonly Source[],
 * }} OtherGainsOrLosses
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
 * @type {(taxParamSet: TaxParamSet) => (input: ScheduleOnePartIInput) => ScheduleOnePartIOutcome}
 */
export const scheduleOnePartI = taxParamSet => input => {
    const {
        profile, unemploymentForms, nonemployeeCompensationForms, businessExpenseForms, w2Forms,
        assetRegisters, rentalProperties, farmForms,
        partnershipK1Forms, sCorporationK1Forms, estateTrustK1Forms,
        status, form1040Line7aCents, form2555Line45Cents,
    } = input
    const zero = profileDeclaredZeroLine(profile)
    // `rentalProperties` and `farmForms` reach MORE than one schedule each, and
    // neither is a leak. Schedule C needs both only to know which asset
    // registers are NOT its own: a register whose account number names a rental
    // property is Schedule E Part I's and one whose account number names a farm
    // is Schedule F's, and Schedule C must neither depreciate them nor refuse
    // them.
    const scheduleCOutcome = scheduleC({
        profile, nonemployeeCompensationForms, businessExpenseForms, w2Forms, assetRegisters,
        rentalProperties, farmForms,
    })
    if (scheduleCOutcome.kind === 'error') {
        return scheduleCOutcome
    }
    const scheduleEOutcome = scheduleE({
        profile, rentalProperties, assetRegisters,
        partnershipK1Forms, sCorporationK1Forms, estateTrustK1Forms,
    })
    if (scheduleEOutcome.kind === 'error') {
        return scheduleEOutcome
    }
    // `businessExpenseForms` and `unemploymentForms` both reach Schedule F, and
    // neither is a leak. The first is what `fjs/schedule/f` refuses a farm
    // BESIDE a Schedule C business on -- §199A and §461(l) both aggregate
    // across trades or businesses and this engine carries one business's facts.
    // The second is where printed Schedule F line 4a comes from: Form 1099-G
    // box 7 and box 9, which `vnd.fjs.1099g` refused by name until this phase.
    const scheduleFOutcome = scheduleF({
        profile, farmForms, businessExpenseForms, unemploymentForms, assetRegisters,
    })
    if (scheduleFOutcome.kind === 'error') {
        return scheduleFOutcome
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
    // 4. "Other gains or (losses). Attach Form 4797." -- Form 4797's own line
    //    18b, restated under this schedule's printed number and never
    //    recomputed here, exactly as line 3 restates Schedule C line 31.
    //    TAX-41. Form 4684 remains unmodeled, and `otherGainsOrLosses`' remedy
    //    in `fjs/return/scope` still names it.
    //
    //    A return with no disposals leaves this a profile-declared zero, which
    //    is the SAME zero it was before this phase and is why `filed` is a
    //    field rather than a test on the amount: a Form 4797 whose line 18b
    //    nets to zero is a filed form and must cite the register.
    const otherGains = input.otherGainsOrLosses
    const line4Rule = 'Schedule 1 line 4 (other gains/losses, Form 4797 line 18b)'
    const line4 = otherGains === undefined || !otherGains.filed
        ? zero(line4Rule)
        : documentLine(profile)(line4Rule)(otherGains.lineEighteenBCents)(otherGains.sources)
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
    // 6. "Farm income or (loss). Attach Schedule F." -- Schedule F's own line
    //    34, restated under this schedule's printed number and never recomputed
    //    here, exactly as line 3 restates Schedule C line 31 and line 5
    //    Schedule E line 41. i1040sf p9: "Enter your net profit or loss on line
    //    34 and on Schedule 1 (Form 1040), line 6 and; Schedule SE (Form 1040),
    //    line 1a" -- BOTH printed destinations, and the second is
    //    `fjs/schedule/se` line 1a, wired in this same phase.
    const line6 = {
        ...scheduleFOutcome.line34,
        rule: 'Schedule 1 line 6 (farm income/loss, Schedule F line 34)',
    }
    const line7 = unemploymentCompensationLine(profile)(unemploymentForms)
    // 8. "Other income" -- twenty-three printed sub-lines, 8a through 8v and
    //    8z (the "26" this comment carried until 2026-08-18 counted letters
    //    the form does not print); see this module's own docstring, "The 26/11
    //    sub-line collapses".
    //
    //    **TWO of the twenty-three are now separately reachable**, and they
    //    arrive by different routes. Line 8d is Form 2555's foreign earned
    //    income exclusion (TAX-42), computed by the caller and handed in; line
    //    8p is Form 461's excess business loss adjustment (TAX-40), computed
    //    below out of lines this function already holds. 8d is folded into the
    //    collapse line itself, because it is the only term left in it; 8p is
    //    its own `documentLine`, and printed line 9 adds the two.
    //
    //    i2555 p7 states 8d's sign in words: "Enter the amount from line 45 on
    //    Schedule 1 (Form 1040), line 8d. Reduce the other items of additional
    //    income by the NEGATIVE amount on line 8d". So the exclusion enters
    //    here NEGATED -- an exclusion that arrived positive would ADD
    //    $130,000 to income, which is the sign error this comment exists to
    //    make visible at the site.
    //
    //    The line is a `documentLine`, not a `zero(...)` supplemented by an
    //    amount: a return with no exclusion cites `declaredKinds` exactly as
    //    it always did, and a return with one cites the profile box the
    //    figure came from and does not mention `declaredKinds` at all.
    const line8 = form2555Line45Cents === 0n
        ? zero('Schedule 1 line 8 (other income, 8a-8z; 8d and 8p are the only ones this engine '
            + 'computes)')
        : documentLine(profile)(
            'Schedule 1 line 8 (other income; 8d, the Form 2555 line 45 foreign earned income '
            + 'exclusion, entered as a negative)')(
            -form2555Line45Cents)([{
                documentHash: profile.documentHash,
                boxPath: 'foreignEarnedIncome',
                value: profile.value.foreignEarnedIncome ?? '',
            }])
    // **8p -- the §461(l) excess business loss adjustment, and the SECOND of
    // the two sub-lines that have come out of the 8a-8z collapse.** i461 line
    // 16: "enter the amount from line 16 as a positive number on Schedule 1
    // (Form 1040), line 8p."
    //
    // Form 461 is computed HERE rather than in `fjs/form1040/core`, for the
    // reason lines 3, 5 and 6 are restated here rather than reaching 1040 line
    // 8 by a side channel: printed line 8p is a Schedule 1 line, and the total
    // it belongs to is line 9's. i461's *Ordering Rules* put §461(l) after the
    // at-risk and passive rules, which is exactly where this sits -- every
    // schedule above has already produced its own line, each having asked §465
    // and §469 on its own printed page.
    //
    // `form1040Line7aCents` is the one figure this function cannot compute for
    // itself: printed Form 461 line 3 is 1040 line 7a, and Schedule D runs in
    // `fjs/form1040/core`. It arrives as a bare `bigint` because Form 461 reads
    // only its value; the `Source`s behind it are already cited on 1040 line 7a
    // itself, and citing them a second time would put a brokerage statement
    // under a Schedule 1 line that is zero.
    //
    // **It is arithmetically INERT today, and that is a property of the printed
    // form rather than of this wiring.** Discovered by mutating it to `0n` and
    // watching the whole suite stay green: printed line 3 adds it to line 9, and
    // printed lines 10/11 remove exactly it again, so printed line 14 —
    // `line9 + line13` — cancels it to the cent at every input. `fjs/form461`'s
    // Part II arm for it is unconditional (`attributableToATradeOrBusiness:
    // false`). `theCapitalGainOrLossReachesPrintedFormFourSixtyOneLineThree` is
    // what keeps the pass-through observable.
    //
    // **THE DAY THIS COMMENT PREDICTED HAS ARRIVED, and the term still
    // cancels.** It read "the day Form 4797 exists and a §1231 gain can be a
    // trade-or-business gain, that arm becomes conditional and this term stops
    // cancelling". Form 4797 exists as of TAX-41 and a net §1231 gain on its
    // printed line 7 does reach 1040 line 7a through Schedule D line 11, so the
    // premise is now false — and the arm has deliberately NOT been made
    // conditional. Making it conditional needs the §1231 SHARE of 1040 line 7a,
    // and printed Schedule D does not carry one: it nets that gain against
    // investment losses and caps the result at §1211(b)'s $3,000, so i461's "any
    // such amounts included here in line 3" is not a subtraction a caller can
    // perform from outside. Left unconditional, printed line 10 removes a
    // trade-or-business gain it should have kept, which makes printed line 14
    // SMALLER and §461(l) MORE likely to bind: an over-refusal, never a wrong
    // number, which is the same one-directional admission `fjs/form461`'s
    // docstring already makes about Schedule 1 line 5 and now makes about this.
    //
    // **Printed line 4 is the term that does NOT cancel.** Form 4797 line 18b
    // arrives on Schedule 1 line 4, no Part II arm touches it, and it moves
    // printed line 14 cent for cent.
    // {@link proof.formFourSixtyOne.formFourSevenNineSevenLineFourMovesLineFourteenAndLineThreeStillCancels}
    // is the leaf that proves the two are treated differently, and that Form 461
    // reads the COMPUTED line 4 rather than the caller's figure.
    //
    // **The value is always zero on a return that computes**, and that is not a
    // structural zero: `fjs/form461` REFUSES a binding limitation (its own
    // docstring says why), so reaching this line at all means printed Form 461
    // line 16 was at or above zero and the whole business loss is allowed. The
    // line is separate rather than folded back into the collapse because a
    // reader has to be able to tell "Form 461 was computed and allowed
    // everything" from "no sub-line of line 8 is modeled".
    const form461Outcome = form461(taxParamSet)({
        status,
        scheduleOneLine3Cents: line3.value,
        form1040Line7aCents,
        scheduleOneLine4Cents: line4.value,
        scheduleOneLine5Cents: line5.value,
        scheduleOneLine6Cents: line6.value,
    })
    if (form461Outcome.kind === 'error') {
        return form461Outcome
    }
    // **Written as the constant it can only be, with an assert in place of a
    // comparison.** `fjs/form461` returns its error arm on exactly
    // `line16 < 0n`, and that refusal returned two lines up, so by the time
    // execution is here line 16 is at or above zero and line 8p can only be
    // `0n`. This was spelled as the printed rule — i461: "enter the amount
    // from line 16 as a POSITIVE number on Schedule 1 (Form 1040), line 8p" —
    // but the printed rule's non-zero arm was unreachable by any input, and
    // `fjs/form461` itself says why that is the wrong spelling, at its own
    // clause (i): a comparison that can never be true is a claim a reader has
    // to re-derive. Mutating the old expression to `form461Outcome.line16 *
    // 0n` left the entire suite green, which is an equivalent mutant in
    // AGENTS.md's sense — a neighbouring operation (that refusal) already
    // enforced what the token enforced.
    //
    // The assert is what the comparison was really doing, and it is the
    // stronger check of the two: this guarantee crosses a MODULE boundary, so
    // if `fjs/form461` ever returns `kind: 'ok'` carrying a negative line 16,
    // it fires by name instead of silently dropping the excess business loss
    // the printed rule says belongs here. That is the day Form 172 is modeled
    // and a binding limitation may compute — and on that day the printed rule
    // comes back beside it.
    assert(
        form461Outcome.line16 >= 0n,
        ['a computed Form 461 cannot carry a negative line 16', form461Outcome.line16],
    )
    const excessBusinessLossCents = 0n
    const line8p = documentLine(profile)(
        'Schedule 1 line 8p (excess business loss adjustment, Form 461 line 16)')(
        excessBusinessLossCents)(unionSources([line3, line5, line6]))
    // 9. "Total other income. Add lines 8a through 8z" -- line 8's collapse
    //    (8d and nothing else) plus 8p.
    const line9 = totalLine('Schedule 1 line 9 (total other income)')([line8, line8p])
    // 10. "Combine lines 1 through 7 and 9." -> 1040 line 8.
    const line10 = totalLine('Schedule 1 line 10 (total additional income -> 1040 line 8)')([
        line1, line2a, line3, line4, line5, line6, line7, line9,
    ])
    return {
        kind: 'ok',
        line1, line2a, line3, line4, line5, line6, line7, line8, line8p, line9, line10,
        scheduleC: scheduleCOutcome,
        scheduleE: scheduleEOutcome,
        scheduleF: scheduleFOutcome,
        form461: form461Outcome,
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
 *
 * `farmNetProfit` is **Schedule F's own line 34**, which printed Schedule SE
 * line 1a asks for by that name — passed in the same way and for the same
 * reason. i1040sf p9 gives line 34 two printed destinations and this is the
 * second of them; the first is printed Schedule 1 line 6, up in Part I.
 * @typedef {{
 *   readonly profile: Stored<ReturnProfile>,
 *   readonly status: IndividualFilingStatus,
 *   readonly adjustmentForms: readonly Stored<Adjustments>[],
 *   readonly w2Forms: readonly Stored<W2>[],
 *   readonly businessNetProfit: ReportLine,
 *   readonly farmNetProfit: ReportLine,
 *   readonly businessExpenseForms: readonly Stored<BusinessExpenses>[],
 *   readonly passThrough: PassThroughSelfEmployment,
 *   readonly interestForms: readonly Stored<OneZeroNineNineInt>[],
 *   readonly totalIncomeExceptTaxableSocialSecurityLine: ReportLine,
 *   readonly socialSecurityBenefitsCents: bigint,
 *   readonly taxExemptInterestCents: bigint,
 *   readonly mfsLivedWithSpouseAtAnyTimeInYear: boolean,
 *   readonly iraDistributionReceived: boolean,
 *   readonly marketplaceCoverageStored: boolean,
 *   readonly form2555ExclusionCents: bigint,
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

// ── Line 14's own machinery (Form 3903) ──────────────────────────────────────

/**
 * The two {@link adjustmentLineTags} entries that feed Schedule 1 line 14 —
 * Form 3903's printed line 1 and its printed line 2. Named once so the two
 * filters below and the vocabulary above cannot come apart.
 * @type {readonly string[]}
 */
const movingExpenseTags = [
    'movingExpensesTransportationAndStorage',
    'movingExpensesTravelAndLodgingExcludingMeals',
]

/**
 * Form W-2 box 12 **code P** — "excludable moving expense reimbursements paid
 * directly to a member of the Armed Forces", which is Form 3903 line 4. The
 * form's own caption says where to find it: *"This amount should be shown in
 * box 12 of your Form W-2 with code P."*
 *
 * The match list is `fjs/form3903`'s own exported
 * {@link movingExpensesLine4W2Box12Codes}, held rather than re-typed, so the
 * specification and this sum cannot drift apart (AGENTS.md, "one rule, one
 * place"). The code is normalized the way `employerHsaContributionSources`
 * above and `fjs/form6251/estate_trust` normalize theirs — trimmed and
 * upper-cased, compared as a WHOLE string, never as a prefix, because
 * `fjs/document/w2` stores box 12's code as printed and never interprets it.
 * A code that arrives as `'p'` or `' P'` is the same box; one that arrives as
 * `'PP'` is not.
 *
 * **One `Source` per contributing box 12 entry**, never one per document: a
 * single Form W-2 can carry several coded rows, and a per-document citation
 * could not say which row put the figure on Form 3903 line 4.
 * @type {(w2s: readonly Stored<W2>[]) => readonly Source[]}
 */
const movingExpenseReimbursementSources = w2s => w2s.flatMap(form =>
    (form.value.box12 ?? [])
        .filter(entry =>
            movingExpensesLine4W2Box12Codes.includes(entry.code.trim().toUpperCase()))
        .map(entry => ({
            documentHash: form.documentHash,
            boxPath: `box12[code=${entry.code.trim().toUpperCase()}]`,
            value: entry.amount,
        })))

/**
 * The refusal a return raises when a moving expense reaches this schedule
 * without the §217(g) certification `vnd.fjs.return_profile` carries.
 *
 * **Why a refusal and not a zero.** TCJA §11049 suspended §217 for everybody
 * except the case §217(g) leaves standing, so the deduction turns entirely on
 * a fact NO document in this engine reports: active duty, and a move ordered
 * as a permanent change of station. Form W-2 box 12 code P comes closest —
 * the code exists only for service members — and it still says nothing about
 * a military order. Three behaviours were available and only one is honest:
 *
 * 1. **Compute anyway.** A civilian's move would produce a deduction the law
 *    allows nobody, silently, with every leaf green.
 * 2. **Return zero.** Correct for a civilian and WRONG for the service member
 *    the line exists for, and indistinguishable from the two of them: the
 *    engine would drop a real deduction without saying so.
 * 3. **Refuse, naming the certification.** The taxpayer is told the one fact
 *    that is missing and where to state it.
 *
 * Absence is *not certified*, never *certified false* — the same reading
 * `traditionalIraContributionAgeFiftyOrOver` gets one block below, and the
 * same rule: refuse whenever the unknown could change the answer rather than
 * assume either side of it.
 * @type {ScheduleOneRefusal}
 */
const movingExpensesNotCertifiedRefusal = {
    kind: 'error',
    message: 'Schedule 1 line 14: this return carries a moving expense or a Form W-2 box 12 code P '
        + 'moving reimbursement, but the return profile does not certify '
        + 'movingExpensesArmedForcesPermanentChangeOfStation. Form 3903 asks for that '
        + 'certification before its first line — "You can deduct moving expenses only if you are a '
        + 'Member of the Armed Forces on active duty and, due to a military order, you, your '
        + 'spouse, or your dependents move because of a permanent change of station" — because '
        + '§217 is suspended by TCJA §11049 for everyone else, and NO document this engine reads '
        + 'reports active duty or a permanent change of station (box 12 code P proves a service '
        + 'member was reimbursed, not that a military order moved them). Refusing rather than '
        + 'deducting a civilian move the law disallows, and rather than zeroing a service '
        + "member's real deduction: an absent certification is UNSTATED, not denied"
}

// ── Line 20's own machinery (§219) ───────────────────────────────────────────

/**
 * The refusal a joint return carrying a traditional IRA contribution raises.
 *
 * **Written as a constant, in the shape `fjs/schedule/se`'s
 * `twoSelfEmployedPeopleRefusal` already uses**, because it is one refusal
 * with one message and three independent reasons, and inlining it at the one
 * site would put those three reasons somewhere a reader looking for "why does
 * this engine refuse joint returns" would not find them.
 *
 * §219(f)(2): *"The maximum deduction under subsection (b) shall be computed
 * **separately for each individual**"*, and Publication 590-A repeats it —
 * *"Even though you file a joint return, you must figure their IRA deductions
 * separately."* Doing that needs three facts a joint return here cannot
 * supply:
 *
 * 1. **Which spouse is the active participant.** Coverage is Form W-2 box 13,
 *    and nothing this engine models says which spouse a Form W-2 belongs to —
 *    `vnd.fjs.return_profile` carries no taxpayer or spouse TIN. This is the
 *    same gap this schedule's own line 13 refuses for Form W-2 box 12 code W
 *    and `fjs/form8880` refuses for box 12 elective deferrals, refused here
 *    the same way and for the same reason.
 * 2. **Which range applies to which spouse.** §219(g)(7) gives a NON-covered
 *    spouse married to a covered one a $236,000 applicable dollar amount over
 *    a $10,000 range, where the covered spouse gets $126,000 over $20,000.
 *    Attributing the coverage to the wrong spouse swaps two ranges $110,000
 *    apart.
 * 3. **Whose compensation.** §219(c)'s Kay Bailey Hutchison spousal IRA
 *    computes the lower earner's limit from the HIGHER earner's compensation
 *    reduced by that spouse's own already-determined §219 deduction and Roth
 *    contributions — a per-person ordering over per-person Forms W-2.
 * @type {ScheduleOneRefusal}
 */
const iraJointReturnRefusal = {
    kind: 'error',
    message: 'Schedule 1 line 20: a traditional IRA contribution on a joint return cannot be '
        + 'attributed. §219(f)(2) computes the deduction "separately for each individual", and '
        + 'the three facts that takes are all missing here: which spouse Form W-2 box 13 '
        + '"Retirement plan" belongs to (no document this engine models says whose a Form W-2 '
        + 'is — the same gap Schedule 1 line 13 and Form 8880 already refuse), which of '
        + '§219(g)(3)(B)(i)’s $126,000 range and §219(g)(7)’s $236,000 range each spouse reads, '
        + 'and whose compensation caps whose IRA under §219(c)’s spousal rule. Refusing rather '
        + 'than guessing (no phase yet)',
}

/**
 * The four filing statuses §219's phase-out has a stored applicable dollar
 * amount for. `marriedFilingJointly` is absent because a joint return
 * carrying a traditional IRA contribution REFUSES — see
 * {@link iraJointReturnRefusal}.
 * @typedef {'single' | 'marriedFilingSeparately' | 'headOfHousehold' | 'qualifyingSurvivingSpouse'} IraPhaseoutStatus
 */

/**
 * Narrows an {@link IndividualFilingStatus} to the status whose §219(g)(3)(B)
 * applicable dollar amount actually governs, or `undefined` for a joint
 * return, which has none here.
 *
 * **§219(g)(4) is the whole reason this is a function and not an index.**
 * *"A husband and wife who— (A) file separate returns for any taxable year,
 * and (B) live apart at all times during such taxable year, shall not be
 * treated as married individuals for purposes of this subsection."* So a
 * married-filing-separately filer who lived apart for the entire year reads
 * the SINGLE row, and Publication 590-A's Table 1-2 says so in its own
 * footnote: *"If you didn't live with your spouse at any time during the
 * year, your filing status is considered Single for this purpose."* The
 * difference is a $79,000 threshold instead of a $0 one — the largest single
 * consequence of one checkbox anywhere on this schedule.
 *
 * The value that flows onward is the one from this function's own returns,
 * never the string off the profile, which is the same device
 * `hsaCoverageTypeNamed` above uses for the identical reason: AGENTS.md bans
 * the cast that would otherwise be needed.
 * @type {(status: IndividualFilingStatus) => (mfsLivedWithSpouseAtAnyTimeInYear: boolean) => IraPhaseoutStatus | undefined}
 */
const iraPhaseoutStatusOf = status => mfsLivedWithSpouseAtAnyTimeInYear =>
    status === 'single' ? 'single'
        : status === 'headOfHousehold' ? 'headOfHousehold'
            : status === 'qualifyingSurvivingSpouse' ? 'qualifyingSurvivingSpouse'
                : status === 'marriedFilingSeparately'
                    ? (mfsLivedWithSpouseAtAnyTimeInYear ? 'marriedFilingSeparately' : 'single')
                    : undefined

/**
 * **§219(g)(3)(A)'s modified adjusted gross income** — the FOURTH separately
 * named income measure in this engine, and the second one on this schedule.
 *
 * Verbatim: *"Adjusted gross income of any taxpayer shall be determined— (i)
 * after application of sections 86 and 469, and (ii) without regard to
 * sections 85(c), 135, 137, 221, and 911 or the deduction allowable under
 * this section."*
 *
 * Like {@link studentLoanInterestPhaseoutIncome} it starts from TOTAL INCOME
 * rather than from AGI, and subtracts back exactly the adjustments that are
 * neither this deduction itself nor the one §219(g)(3)(A)(ii) adds back — so
 * **line 21 is deliberately NOT in `otherAdjustmentsCents`**, and that
 * omission IS the §221 add-back. Nothing is added for §221 on top; doing both
 * would credit the same deduction twice.
 *
 * Unlike that measure it takes a THIRD term, and the third term is the whole
 * subtlety of this line: §219(g)(3)(A)(i) applies §86 FIRST, so taxable
 * Social Security benefits are inside this income — but they are the benefits
 * computed **as though there were no IRA deduction**, which is a different
 * number from the one that lands on Form 1040 line 6b. See
 * {@link scheduleOnePartIIExceptStudentLoanInterest}'s own three-pass note.
 *
 * The four exclusions §219(g)(3)(A)(ii) adds back are each permanently zero
 * in this engine and are NAMED rather than omitted, mirroring
 * {@link studentLoanInterestPhaseoutIncome}'s own three zero terms. **§85(c)
 * is on the list and §199A is not** — the list a reader is most likely to
 * mis-remember, because §199 (the repealed domestic production activities
 * deduction) was struck from it by TCJA §13305(b)(1) and §85(c) was inserted
 * by ARPA. §199A is taken from taxable income, so it could never have reached
 * AGI in the first place; §85(c)'s unemployment exclusion applied to TY2020
 * alone, so unemployment compensation reaches this measure in full.
 *
 * It is deliberately not named for the acronym the instructions use — TAX-15's
 * rule, enforced repo-wide by the root gate.
 * @type {(totalIncomeExceptTaxableSocialSecurityCents: bigint) => (otherAdjustmentsCents: bigint) => (taxableSocialSecurityBeforeThisDeductionCents: bigint) => bigint}
 */
export const iraDeductionPhaseoutIncome = totalIncomeExceptTaxableSocialSecurityCents =>
    otherAdjustmentsCents => taxableSocialSecurityBeforeThisDeductionCents => {
        // §219(g)(3)(A)(ii)'s own add-backs, every term permanently zero here.
        const section85cUnemploymentCompensationExclusion = 0n
        const section135SavingsBondInterestExclusion = 0n
        const section137AdoptionAssistanceExclusion = 0n
        const section911ForeignEarnedIncomeExclusion = 0n
        return totalIncomeExceptTaxableSocialSecurityCents - otherAdjustmentsCents
            + taxableSocialSecurityBeforeThisDeductionCents
            + section85cUnemploymentCompensationExclusion
            + section135SavingsBondInterestExclusion
            + section137AdoptionAssistanceExclusion
            + section911ForeignEarnedIncomeExclusion
    }

/**
 * Publication 590-A Worksheet 1-2 line 4, and §219(g)(2)(A)/(B)/(C) — the
 * surviving deductible limit for a taxpayer inside the phase-out range.
 *
 * **The statute and the worksheet state the same rule from opposite ends, and
 * the rounding direction flips between them.** §219(g)(2)(A) computes the
 * REDUCTION as `limit x (AGI - threshold) / range`, and §219(g)(2)(C) rounds
 * *that* to the next LOWEST $10. Subtracting a reduction rounded down leaves a
 * limit rounded UP, which is the direction the printed worksheet gives:
 * *"Multiply line 3 by the percentage below that applies to you. If the result
 * isn't a multiple of $10, round it to the next highest multiple of $10. (For
 * example, $611.40 is rounded to $620.) However, if the result is less than
 * $200, enter $200."* The worksheet's direction is what is implemented, on the
 * surviving limit, because that is the figure line 7 compares.
 *
 * The ceiling is computed on the EXACT rational `remaining x limit / range`
 * rather than on a truncated cent figure: `$620.0001` must round to `$630`,
 * and a truncation to `$620.00` first would round it to `$620`. `remaining`,
 * `dollarLimitCents` and `rangeCents` are all positive here, so the
 * add-then-divide is an exact ceiling with no sign hazard.
 *
 * The printed percentages (70%/80%, and 35%/40% for a joint or qualifying-
 * surviving-spouse filer) are NOT stored and not written here: they are
 * `dollarLimitCents / rangeCents` exactly, and a stored percentage would be a
 * figure able to disagree with the two the computation reads.
 * @type {(taxParamSet: TaxParamSet) => (remainingCents: bigint) => (dollarLimitCents: bigint) => (rangeCents: bigint) => bigint}
 */
const iraPhasedDeductibleLimit = taxParamSet => remainingCents => dollarLimitCents => rangeCents => {
    const { iraDeduction } = taxParamSet
    const incrementCents = centsFromString(iraDeduction.roundingIncrement.amount)
    const minimumCents = centsFromString(iraDeduction.minimumPhasedOutLimit.amount)
    const divisor = rangeCents * incrementCents
    const rounded = ((remainingCents * dollarLimitCents + divisor - 1n) / divisor) * incrementCents
    return rounded < minimumCents ? minimumCents : rounded
}

/**
 * Publication 590-A Worksheet 1-2 / Appendix B Worksheet 2, under their own
 * printed line numbers. `w` prefixes them so a reader cannot confuse worksheet
 * line 3 with Schedule 1 line 3 — the same convention
 * {@link StudentLoanInterestWorksheet} uses.
 *
 * The two worksheets are the same seven lines; Appendix B's differs only in
 * where line 2's modified AGI came from (its own Worksheet 1 rather than
 * Worksheet 1-1). Line 8, the nondeductible remainder that belongs on Form
 * 8606 line 1, is NOT modeled — see `fjs/schedule/1/todo/ira-deduction.md`.
 * @typedef {{
 *   readonly w1: bigint, readonly w2: bigint, readonly w3: bigint,
 *   readonly w4: bigint, readonly w5: bigint, readonly w6: bigint,
 *   readonly w7: bigint,
 * }} IraDeductionWorksheet
 */

/**
 * @typedef {{
 *   readonly status: IraPhaseoutStatus,
 *   readonly coveredByWorkplacePlan: boolean,
 *   readonly dollarLimitCents: bigint,
 *   readonly modifiedAgiCents: bigint,
 *   readonly compensationCents: bigint,
 *   readonly contributionCents: bigint,
 * }} IraDeductionWorksheetInput
 */

/**
 * The IRA Deduction Worksheet, transcribed line for line.
 *
 * **`coveredByWorkplacePlan` decides whether the phase-out exists at all.**
 * §219(g)(1) reduces the limit only if *"an individual or the individual's
 * spouse is an active participant"*, and Publication 590-A's Table 1-3 is the
 * consequence: a single, head-of-household or qualifying-surviving-spouse
 * filer who is not covered takes *"a full deduction"* at **any** modified AGI.
 * The spouse half of §219(g)(1) reaches a filer here only through
 * §219(g)(7), which requires a joint return — and a joint return refuses.
 *
 * `dollarLimitCents` is a PARAMETER rather than read from the tax parameter
 * set, because the caller runs this worksheet twice — once at §219(b)(5)(A)'s
 * $7,000 and once at $8,000 with §219(b)(5)(B)(ii)'s catch-up — and refuses
 * when the two disagree. Nothing in this repository stores a birth date;
 * {@link scheduleOnePartIIExceptStudentLoanInterest}'s own note carries the
 * argument.
 * @type {(taxParamSet: TaxParamSet) => (input: IraDeductionWorksheetInput) => IraDeductionWorksheet}
 */
export const iraDeductionWorksheet = taxParamSet => input => {
    const {
        status, coveredByWorkplacePlan, dollarLimitCents, modifiedAgiCents,
        compensationCents, contributionCents,
    } = input
    const { iraDeduction } = taxParamSet
    const thresholdCents = centsFromString(iraDeduction.phaseoutThreshold[status].amount)
    const rangeCents = centsFromString(iraDeduction.phaseoutRange[status].amount)
    // 1. "Enter applicable amount from table above" -- the completely-
    //    phased-out end point, DERIVED from the threshold and the range
    //    rather than stored a third time.
    const w1 = thresholdCents + rangeCents
    // 2. "Enter your modified AGI".
    const w2 = modifiedAgiCents
    // 3. "Subtract line 2 from line 1." The printed note on line 2 stops the
    //    worksheet when line 2 is at or above line 1 (no deduction), and the
    //    note on line 3 stops it when line 3 reaches the whole range (the
    //    full deduction) -- which is the same test as "modified AGI is at or
    //    below the threshold".
    const w3 = w1 > w2 ? w1 - w2 : 0n
    // 4. The reduced limit, or the whole limit where §219(g)(1) never
    //    applies. Both printed stopping notes are branches here rather than
    //    falling out of the arithmetic, because `marriedFilingSeparately`'s
    //    threshold is a genuine $0 and "stop, take the full deduction" at a
    //    $0 threshold is not something a formula could express.
    //
    //    **The `w3 >= rangeCents` arm is likewise unobservable, and for a
    //    reason worth writing down**: at `w3 == rangeCents` the phased
    //    formula gives `range x limit / range` = the limit exactly, and above
    //    it a number LARGER than the limit -- which line 7's `min` then
    //    discards. It is the printed page's own stopping instruction, kept
    //    because the page prints it; the leaf
    //    `oneCentOverTheThresholdStillTakesTheFullDeduction` pins the
    //    surprising consequence (one cent past the threshold STILL deducts in
    //    full, because $9,999.99 x 80% rounds up to $8,000.00) rather than
    //    pretending the branch itself is covered.
    const w4 = !coveredByWorkplacePlan ? dollarLimitCents
        : w2 >= w1 ? 0n
            : w3 >= rangeCents ? dollarLimitCents
                : iraPhasedDeductibleLimit(taxParamSet)(w3)(dollarLimitCents)(rangeCents)
    // 5. "Enter your compensation minus any deductions on Schedule 1 line 15
    //    … and line 16 …" -- §219(b)(1)(B). Supplied by the caller, which is
    //    where the refusal for a return with self-employment lives.
    const w5 = compensationCents
    // 6. "Enter contributions you made, or plan to make, to your traditional
    //    IRA for 2025, but don't enter more than $7,000 ($8,000 if you are
    //    age 50 or older)."
    //
    //    **The cap on this line is an EQUIVALENT MUTANT, verified by running
    //    it** (AGENTS.md, "a mutation a neighbouring operation absorbs").
    //    Removing it -- `w6 = contributionCents` -- leaves the whole suite
    //    green at every input, and that is a property of the arithmetic
    //    rather than a hole in the proofs: `w4` above is `dollarLimitCents`,
    //    or `0n`, or a phased limit that is strictly smaller (the product of
    //    a remainder below the range, ceiling-rounded to a $10 multiple that
    //    the dollar limit is itself a multiple of). So `w4 <= dollarLimitCents`
    //    ALWAYS, line 7's `min` already bounds the answer by the dollar
    //    limit, and this cap can never be the binding one.
    //
    //    It stays because the printed page prints it and because it stops
    //    being absorbed the moment either premise moves -- a dollar limit
    //    that is not a multiple of $10, or a `w4` branch that could exceed
    //    the limit. What DOES bite is dropping the CONTRIBUTION from this
    //    line entirely (`w6 = dollarLimitCents`), which reddens seven leaves.
    const w6 = contributionCents < dollarLimitCents ? contributionCents : dollarLimitCents
    // 7. "Compare lines 4, 5, and 6. Enter the smallest amount here … Enter
    //    this amount on your Schedule 1 (Form 1040), line 20."
    const smallerOfFourAndFive = w4 < w5 ? w4 : w5
    const w7 = smallerOfFourAndFive < w6 ? smallerOfFourAndFive : w6
    assert(w7 >= 0n, ['the IRA deduction must never be negative', w7])
    return { w1, w2, w3, w4, w5, w6, w7 }
}

/**
 * Schedule 1 Part II, stage 1 — lines 11 through 20, 22, 23, 24 and 25:
 * every adjustment that does NOT depend on income. Line 21 and the line 26
 * total are {@link scheduleOnePartII}'s, one stage later; see this module's
 * own docstring, "The ordering that breaks a genuine circularity".
 * @type {(taxParamSet: TaxParamSet) => (input: ScheduleOnePartIIStageOneInput) => ScheduleOnePartIIStageOneOutcome}
 */
export const scheduleOnePartIIExceptStudentLoanInterest = taxParamSet => input => {
    const {
        profile, status, adjustmentForms, w2Forms, businessNetProfit, farmNetProfit,
        businessExpenseForms,
        passThrough, interestForms, marketplaceCoverageStored, form2555ExclusionCents,
        totalIncomeExceptTaxableSocialSecurityLine,
        socialSecurityBenefitsCents, taxExemptInterestCents, mfsLivedWithSpouseAtAnyTimeInYear,
        iraDistributionReceived,
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
                    + `Part II adjustment tags this engine computes `
                    + `(${adjustmentLineTagNames.join(', ')}). Refusing rather than dropping an `
                    + `adjustment from line 26 and overstating the tax`,
            }
        }
        const paidInFollowingYear = entry.value.datePaid.startsWith(`${profile.value.taxYear + 1}-`)
        if (paidInFollowingYear && !followingYearContributionTags.includes(entry.value.lineTag)) {
            return {
                kind: 'error',
                message: `Schedule 1 Part II: '${entry.value.description}' is tagged `
                    + `'${entry.value.lineTag}' and was paid on ${entry.value.datePaid}, in the year `
                    + `AFTER tax year ${profile.value.taxYear}. Only a health savings account `
                    + `contribution (§223) or a traditional IRA contribution (§219(f)(3)) may be `
                    + `designated for the prior year; every other adjustment is `
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

    // ── Line 14: moving expenses for Armed Forces members, via Form 3903 ────
    //
    // The three figures `fjs/form3903` asks for, assembled HERE because this
    // is where the documents are: printed lines 1 and 2 from the two
    // {@link movingExpenseTags} adjustment entries, printed line 4 from Form
    // W-2 box 12 code P. That module reads no document on purpose, so
    // DOC-11's absent-is-absent rule is applied once, in this layer.
    //
    // **The certification is checked when EITHER an expense or a code P
    // reimbursement is present**, not only when an expense is. A W-2 carrying
    // code P with no expenses beside it is precisely the case Form 3903's
    // line 5 "No" branch exists for, and dropping it would understate the
    // tax by the whole reimbursement.
    //
    // **ONE Form 3903, from every entry on the document.** The instructions
    // say *"If you qualify to deduct expenses for more than one move, use a
    // separate Form 3903 for each move"*, and `vnd.fjs.adjustments` carries
    // nothing that distinguishes one move from another — no move identifier,
    // no origin, no date beyond `datePaid`. So this engine computes the one
    // form the stored facts describe. That is exact for the ordinary
    // single-move return; a taxpayer with two moves in one year, one of them
    // over-reimbursed, would owe more than this line reports, and has no way
    // to say so on this dialect. Recorded in
    // `fjs/form3903/todo/moving-expenses.md` rather than guessed at here.
    const movingEntries = entries.filter(entry =>
        movingExpenseTags.includes(entry.value.lineTag))
    const movingReimbursementSources = movingExpenseReimbursementSources(w2Forms)
    const movingCertified =
        profile.value.movingExpensesArmedForcesPermanentChangeOfStation === true
    if (
        (movingEntries.length !== 0 || movingReimbursementSources.length !== 0)
        && !movingCertified
    ) {
        return movingExpensesNotCertifiedRefusal
    }
    /** @type {(tag: string) => bigint} */
    const movingTotalTagged = tag => movingEntries
        .filter(entry => entry.value.lineTag === tag)
        .reduce((sum, entry) => sum + centsFromString(entry.value.amount), 0n)
    const form3903 = movingExpenses({
        transportationAndStorageCents: movingTotalTagged('movingExpensesTransportationAndStorage'),
        // Already net of meals — the tag says so, and `fjs/form3903` adds
        // nothing to whatever arrives here.
        travelAndLodgingCents: movingTotalTagged('movingExpensesTravelAndLodgingExcludingMeals'),
        governmentPaymentsNotInBox1Cents: movingReimbursementSources.reduce(
            (total, source) => total + centsFromString(source.value), 0n),
    })
    // The refusal is threaded out VERBATIM, never thrown and never turned
    // into a zero: its whole content is the amount of gross income this
    // engine has nowhere to put and the 1040 line it belonged on.
    if (form3903.kind === 'error') {
        return { kind: 'error', message: form3903.message }
    }
    const line14 = documentLine(profile)(
        'Schedule 1 line 14 (moving expenses for Armed Forces members, Form 3903 line 5)')(
        form3903.line5)([
            ...movingEntries.map(entry => ({
                documentHash: entry.documentHash,
                boxPath: `entries[lineTag=${entry.value.lineTag},individual=${entry.value.individual}]`,
                value: entry.value.amount,
            })),
            ...movingReimbursementSources,
        ])

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
        farmNetProfitCents: farmNetProfit.value,
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
        sources: unionSources([businessNetProfit, farmNetProfit, socialSecurityWages]),
        rule: 'Schedule 1 line 15 (deductible part of self-employment tax, Schedule SE line 13)',
    }
    const line16 = zero('Schedule 1 line 16 (SEP/SIMPLE/qualified plans)')

    // ── Line 17: the self-employed health insurance deduction (TAX-39) ──────
    //
    // `fjs/form7206` computes the printed form; everything here is the
    // question of whether this engine may hand it figures at all. See
    // `fjs/schedule/1/todo/self-employed-health-insurance.md` for the full
    // record of these five refusals and what each would take to retire.
    //
    // **This line needed NO ordering change, and that is the phase's finding.**
    // Every input Form 7206 reads -- the premiums, Schedule C line 31, Schedule
    // SE line 13 and Schedule 1 line 16 -- is already in scope at exactly this
    // point, three statements after line 15 was built from the same
    // `selfEmploymentLines`. The remedy this row carried for two phases said
    // its blocker was net self-employment earnings; that stopped being true at
    // Phase 28, and the real blocker was DATA (no dialect recorded a premium)
    // rather than order. Contrast `fjs/form2441`'s refusal, which IS an
    // ordering one and is NOT retired by this phase -- the two look alike
    // because both remedies named Schedule SE, and they are not alike.
    const healthInsuranceEntries = entries.filter(entry =>
        selfEmployedHealthInsuranceTags.includes(entry.value.lineTag))
    const healthInsuranceSources = healthInsuranceEntries.map(entry => ({
        documentHash: entry.documentHash,
        boxPath: `entries[lineTag=${entry.value.lineTag},individual=${entry.value.individual}]`,
        value: entry.value.amount,
    }))
    // `fjs/form8880`'s `creditCouldMatter` discipline, exactly as line 20
    // applies it below: a return claiming no premium reaches none of the five
    // refusals here. Refusing a return for an unanswerable question about a
    // deduction it is not claiming is not honesty, it is an engine that does
    // not work.
    const premiumsCouldMatter = healthInsuranceEntries.length !== 0
    // Form 7206 line 2 is figured "separately ... for each person covered", and
    // this dialect's `individual` is the only identity it has. One person has
    // ONE age at the end of the year, so two different band tags attributed to
    // the same person is a contradiction rather than two people.
    /** @type {readonly ('taxpayer' | 'spouse')[]} */
    const coveredIndividuals = ['taxpayer', 'spouse']
    /** @type {LongTermCareCoveredPerson[]} */
    const longTermCarePersons = []
    for (const who of coveredIndividuals) {
        const bandsAsserted = longTermCareTagBands.filter(([tag]) =>
            healthInsuranceEntries.some(entry =>
                entry.value.individual === who && entry.value.lineTag === tag))
        const [firstBand, ...otherBands] = bandsAsserted
        const secondBand = otherBands[0]
        if (firstBand !== undefined && secondBand !== undefined) {
            return {
                kind: 'error',
                message: `Schedule 1 line 17: the adjustments document attributes long-term care `
                    + `premiums to the ${who} under ${bandsAsserted.length} different age bands `
                    + `(${bandsAsserted.map(([tag]) => tag).join(' and ')}). Form 7206 line 2(b) `
                    + `caps each covered person by "the person's age at the end of the tax year", `
                    + `and one person has one age -- the first two bands here carry caps of `
                    + `${centsToString(longTermCareCapCents(taxParamSet)(firstBand[1]))} and `
                    + `${centsToString(longTermCareCapCents(taxParamSet)(secondBand[1]))}, so the `
                    + `choice changes the deduction. Refusing rather than picking one`,
            }
        }
        if (firstBand !== undefined) {
            longTermCarePersons.push({
                ageBand: firstBand[1],
                premiumsCents: healthInsuranceEntries
                    .filter(entry =>
                        entry.value.individual === who && entry.value.lineTag === firstBand[0])
                    .reduce((sum, entry) => sum + centsFromString(entry.value.amount), 0n),
            })
        }
    }
    // R1 -- §162(l)(2)(B). The one fact on this whole line that no information
    // return reports and that no stored amount implies. See
    // `vnd.fjs.return_profile`'s own field comment for why the certification is
    // whole-year while the statute is month-by-month.
    if (
        premiumsCouldMatter
        && profile.value.notEligibleForAnySubsidizedEmployerHealthPlanInAnyMonth !== true
    ) {
        return {
            kind: 'error',
            message: 'Schedule 1 line 17: this return stores self-employed health insurance '
                + 'premiums, and \u00a7162(l)(2)(B) denies the deduction "for any calendar month for '
                + 'which the taxpayer is eligible to participate in any subsidized health plan '
                + 'maintained by any employer of the taxpayer or of the spouse of, or any '
                + 'dependent, or individual described in subparagraph (D) of paragraph (1) with '
                + 'respect to, the taxpayer". Form 7206 line 1 restates it as an exclusion from '
                + 'the premiums themselves. Eligibility is not enrolment and appears on no '
                + 'information return: no Form W-2 box says whether an employer OFFERED a '
                + 'subsidized plan. This return profile does not carry '
                + 'notEligibleForAnySubsidizedEmployerHealthPlanInAnyMonth, so this engine cannot '
                + 'tell a fully deductible premium from one that is entirely disallowed. Refusing '
                + 'rather than assuming the answer that happens to favour the taxpayer'
                + `. Nothing reaches ${line17Destination}`,
        }
    }
    // R2 -- Rev. Proc. 2014-41 §2.05's circular relationship. See this module's
    // own todo file; the short version is that there is no convergent method
    // to implement, because the Revenue Procedure does not give one.
    if (premiumsCouldMatter && marketplaceCoverageStored) {
        return {
            kind: 'error',
            message: 'Schedule 1 line 17: this return stores BOTH self-employed health insurance '
                + 'premiums and a Form 1095-A. Rev. Proc. 2014-41 \u00a72.05: "the amount of the '
                + '\u00a7 162(l) deduction is based on the amount of the \u00a7 36B premium tax credit, and '
                + 'the amount of the credit is based on the amount of the deduction \u2013 a circular '
                + 'relationship." This engine computes Form 8962 from an adjusted gross income '
                + 'that already contains this line, which is the right ONE-WAY order and is not '
                + 'enough: \u00a75.03(2) caps the deduction at the specified premiums NOT paid through '
                + 'advance credit payments, so the credit moves the deduction back. \u00a75.01(6) gives '
                + 'the iterative method no iteration bound and an explicit escape hatch for the '
                + 'case where changes between iterations always exceed $1, so there is no '
                + 'convergent method to implement. Nothing stored says whether these premiums are '
                + 'the \u00a73 "specified premiums" of the Marketplace plan or unrelated coverage, and '
                + 'the two answers differ by the whole credit. Refusing rather than computing one '
                + 'arm and ignoring the feedback'
                + `. Nothing reaches ${line17Destination}`,
        }
    }
    // R2b -- Form 7206 line 12, §911(d)(6) (TAX-42). The printed line reads
    // "Enter any amount from Form 2555, line 45, ATTRIBUTABLE TO THE AMOUNT
    // ENTERED ON LINE 4 OR 11 ABOVE", and that attribution is the problem: it
    // is not the whole exclusion, it is the part of it that belongs to the one
    // trade or business the insurance plan is established under. Nothing
    // stored says how the exclusion divides between a foreign business, a
    // domestic one, and foreign WAGES, and the three shares reduce line 13 by
    // three different amounts.
    //
    // `fjs/form7206` keeps line 12 as a structural zero and this is the layer
    // that stops a return reaching it with a non-zero exclusion -- the same
    // division of labour line 11's S-corporation refusal already uses.
    if (premiumsCouldMatter && form2555ExclusionCents !== 0n) {
        return {
            kind: 'error',
            message: `Schedule 1 line 17: this return stores self-employed health insurance `
                + `premiums and excludes ${centsToString(form2555ExclusionCents)} of foreign `
                + `earned income under §911. Form 7206 line 12 asks for the part of Form 2555 `
                + `line 45 "attributable to the amount entered on line 4 or 11" -- the net profit `
                + `of the one trade or business the insurance plan is established under -- and `
                + `subtracts it from the ceiling on line 13. Nothing stored says how the `
                + `exclusion divides between that business, any other, and foreign wages, and `
                + `§911(d)(6) denies "any deduction ... properly allocable to or chargeable `
                + `against amounts excluded". Entering zero would claim the whole ceiling for `
                + `income this return already excluded. Refusing rather than attributing it by `
                + `guess (no phase yet). Nothing reaches ${line17Destination}`,
        }
    }
    // R3/R4 -- Form 7206 line 4 is "your net profit ... from the TRADE OR
    // BUSINESS UNDER WHICH THE INSURANCE PLAN IS ESTABLISHED", and the form's
    // own header note says "Use a separate Form 7206 for each trade or
    // business under which an insurance plan is established". Which one it is
    // is a fact `vnd.fjs.adjustments` does not carry.
    const scheduleCProfitCents = businessNetProfit.value > 0n ? businessNetProfit.value : 0n
    const partnershipProfitCents = passThrough.earningsCents > 0n ? passThrough.earningsCents : 0n
    if (premiumsCouldMatter && scheduleCProfitCents > 0n && partnershipProfitCents > 0n) {
        return {
            kind: 'error',
            message: `Schedule 1 line 17: this return carries self-employment earnings from TWO `
                + `sources -- ${centsToString(scheduleCProfitCents)} of Schedule C net profit and `
                + `${centsToString(partnershipProfitCents)} of Schedule K-1 (Form 1065) box 14 `
                + `code A -- and nothing stored says which trade or business the insurance plan is `
                + `established under. Form 7206 line 4 asks for that one business's profit, line 5 `
                + `for the total of all of them, and line 7 prorates Schedule 1 line 15 by line 4 `
                + `divided by line 5; the form's header note says "Use a separate Form 7206 for `
                + `each trade or business under which an insurance plan is established". Choosing `
                + `either source changes both the ceiling and the proration. Refusing rather than `
                + `guessing (no phase yet). Nothing reaches ${line17Destination}`,
        }
    }
    if (premiumsCouldMatter && scheduleCProfitCents === 0n && partnershipProfitCents === 0n) {
        return {
            kind: 'error',
            message: 'Schedule 1 line 17: this return stores self-employed health insurance '
                + 'premiums and no self-employment net profit at all -- no Schedule C profit and '
                + 'no Schedule K-1 (Form 1065) box 14 code A earnings. Form 7206 line 13 would '
                + 'then be zero and the deduction would be zero, which is right for a taxpayer '
                + 'with no trade or business and WRONG for the two this engine does not model: an '
                + 'S-corporation more-than-2% shareholder, whose ceiling is line 11\u2019s Medicare '
                + 'wages from box 5 of Form W-2 and whose premiums \u00a7162(l)(5) and Rev. Rul. 91-26 '
                + 'require the corporation to have paid or reimbursed and reported as wages; and a '
                + 'Schedule F farmer, whose line 34 is a farmIncomeOrLoss refusal here. Reporting '
                + 'a zero would understate the deduction and overstate the tax. Refusing rather '
                + `than reporting a zero that looks computed (no phase yet). Nothing reaches `
                + `${line17Destination}`,
        }
    }
    const line17Lines = form7206(taxParamSet)({
        // Form 7206 line 1. UNCAPPED, and separate from line 2 by
        // construction: `fjs/form7206` takes the two halves apart precisely so
        // a caller cannot put long-term care in this one.
        medicalDentalVisionPremiumsCents: healthInsuranceEntries
            .filter(entry => entry.value.lineTag === medicalDentalVisionTag)
            .reduce((sum, entry) => sum + centsFromString(entry.value.amount), 0n),
        longTermCarePersons,
        // Lines 4 and 5. Exactly one of the two sources is non-zero here -- the
        // two refusals above are what makes that true -- so line 4 equals line
        // 5 and line 6 is 1. The proration `fjs/form7206` implements is
        // therefore the identity on every return this engine computes today,
        // and it lives there rather than being assumed away here because the
        // day a second business becomes computable is the day it stops being
        // the identity.
        planBusinessNetProfitCents: scheduleCProfitCents + partnershipProfitCents,
        allBusinessNetProfitsCents: scheduleCProfitCents + partnershipProfitCents,
        // Line 7's subject: Schedule 1 line 15 IN FULL. Handing over a
        // pre-prorated figure would prorate it twice.
        deductiblePartOfSelfEmploymentTaxCents: line15.value,
        // Line 9. `selfEmployedRetirementPlans` is still a refused
        // `fjs/return/scope` kind, so line 16 is a documented zero and the part
        // of it attributable to this business is zero too. NAMED rather than
        // omitted: when Pub. 560's worksheet arrives, this is the term it
        // fills, and it is read off `line16` rather than written as `0n` so
        // that wiring is a one-line change instead of a search.
        retirementPlanDeductionForPlanBusinessCents: line16.value,
        // Line 11. Zero on every return that reaches here, because the refusal
        // above stops an S-corporation-only return before this call.
        sCorporationMedicareWagesCents: 0n,
    })
    const line17 = documentLine(profile)(
        'Schedule 1 line 17 (self-employed health insurance deduction, Form 7206 line 14)')(
        line17Lines.line14)(healthInsuranceSources)
    const line18 = earlyWithdrawalPenaltyLine(profile)(interestForms)
    const line19a = zero('Schedule 1 line 19a (alimony paid)')
    // 22. "Reserved for future use" -- the form's own inert line.
    const line22 = zero('Schedule 1 line 22 (reserved for future use)')
    const line23 = zero('Schedule 1 line 23 (Archer MSA deduction)')
    // 24. "Other adjustments" -- a collapsed stand-in for 24a-24z (12 printed
    //     sub-lines, 24a through 24k and 24z, of which the instructions say to
    //     leave 24z blank; this comment said 11 until 2026-08-18); see this
    //     module's own docstring.
    const line24 = zero('Schedule 1 line 24 (other adjustments, 24a-24z collapsed -- none separately reachable)')
    // 25. "Total other adjustments. Add lines 24a through 24z" -- the SAME
    //     total, restated as its own printed line.
    const line25 = { ...line24, rule: 'Schedule 1 line 25 (total other adjustments)' }

    // ── Line 20: the traditional IRA deduction (§219) ───────────────────────
    //
    // **Computed LAST in this stage, and that is the ordering the whole line
    // depends on.** §219(g)(3)(A) reads adjusted gross income "after
    // application of sections 86 and 469, and without regard to sections
    // 85(c), 135, 137, 221, and 911 or the deduction allowable under this
    // section", so every OTHER adjustment on this stage has to be subtracted
    // before this one's phase-out income exists.
    const iraEntries = entries.filter(entry => iraContributionTags.includes(entry.value.lineTag))
    const iraSources = iraEntries.map(entry => ({
        documentHash: entry.documentHash,
        boxPath: `entries[lineTag=${entry.value.lineTag},individual=${entry.value.individual}]`,
        value: entry.value.amount,
    }))
    // §219(b)(5)(B)(ii), asserted by the tag rather than derived from a birth
    // date nothing here stores. ANY entry carrying the assertion settles it
    // for the whole line: every entry that reaches this point belongs to the
    // same person, because a `spouse`-attributed entry on a non-joint return
    // has already been refused above and a joint return refuses below.
    const catchUpAsserted = iraEntries.some(entry => entry.value.lineTag === catchUpAssertedTag)
    const iraContributionCents = iraSources.reduce(
        (total, source) => total + centsFromString(source.value), 0n)
    // Every refusal below is gated on the deduction being able to matter at
    // all -- `fjs/form8880`'s own `creditCouldMatter` discipline, and for the
    // reason that module's docstring gives at length: refusing a return for
    // an unanswerable question about a deduction it is not claiming is not
    // honesty, it is an engine that does not work. A return with no
    // traditional IRA contribution reaches none of these.
    const deductionCouldMatter = iraContributionCents !== 0n
    // Form W-2 box 13's "Retirement plan" checkbox -- STORED by `vnd.fjs.w2`
    // since that dialect shipped and read by no computation until this line.
    // §219(g)(5) is broader than the checkbox (a SEP or a SIMPLE makes its
    // participant an active participant too), which is one of the three
    // reasons a return with self-employment refuses below.
    const workplacePlanSources = w2Forms
        .filter(form => form.value.box13RetirementPlan === true)
        .map(form => ({
            documentHash: form.documentHash,
            boxPath: 'box13RetirementPlan',
            value: 'true',
        }))
    const coveredByWorkplacePlan = workplacePlanSources.length !== 0
    const iraStatus = iraPhaseoutStatusOf(status)(mfsLivedWithSpouseAtAnyTimeInYear)
    if (deductionCouldMatter && iraStatus === undefined) {
        return iraJointReturnRefusal
    }
    if (deductionCouldMatter && iraStatus === 'marriedFilingSeparately' && !coveredByWorkplacePlan) {
        return {
            kind: 'error',
            message: 'Schedule 1 line 20: this return is married filing separately, lived with the '
                + 'spouse during the year, and reports no Form W-2 with box 13 "Retirement plan" '
                + 'checked. §219(g)(1) reduces the deduction when "an individual OR THE '
                + "INDIVIDUAL'S SPOUSE is an active participant\", and a separate return carries no "
                + "Form W-2 for the spouse, so that fact is absent rather than merely "
                + 'unattributable. It decides between a full $7,000 deduction and a phase-out that '
                + 'is complete at $10,000 of modified adjusted gross income; refusing rather than '
                + 'guessing (no phase yet)',
        }
    }
    if (deductionCouldMatter && (proprietorTin !== undefined || businessNetProfit.value !== 0n)) {
        return {
            kind: 'error',
            message: 'Schedule 1 line 20: this return carries self-employment earnings alongside a '
                + 'traditional IRA contribution, and §219(b)(1)(B) caps the deduction at the '
                + 'compensation includible in gross income. §219(f)(1) takes that from §401(c)(2) '
                + 'earned income, which counts only a trade or business in which the taxpayer’s '
                + 'personal services are a material income-producing factor — a fact no document '
                + 'this engine models records — and which the printed IRA Deduction Worksheet then '
                + 'reduces by Schedule 1 line 15 and line 16, the second of which is still an '
                + 'unmodeled adjustment here. A self-employed taxpayer is also the one case where '
                + 'a §219(g)(5) retirement plan has no Form W-2 box 13 to prove it; refusing '
                + 'rather than guessing at three facts at once (no phase yet)',
        }
    }
    if (deductionCouldMatter && iraDistributionReceived) {
        return {
            kind: 'error',
            message: 'Schedule 1 line 20: this return holds both a traditional IRA contribution and '
                + 'a Form 1099-R IRA distribution for the same year. Publication 590-A: "you must '
                + 'figure the taxable part of the traditional IRA distribution before you can '
                + 'figure your modified AGI", and Publication 590-B’s own Worksheet 1-1 recovers '
                + 'basis pro rata against the YEAR-END basis, which includes the nondeductible '
                + 'part of this year’s contribution — that is, the contribution less this very '
                + 'line. That IS a fixed point, and this engine does not model it; refusing rather '
                + 'than approximating (no phase yet)',
        }
    }
    // §219(b)(1)(B)'s compensation, and the printed worksheet's own line 5:
    // "your compensation minus any deductions on Schedule 1 line 15 … and
    // line 16". Both subtrahends are zero on every return that reaches here,
    // because a return with self-employment has already refused above.
    //
    // Form W-2 box 1 is the whole of it. Every other item in Publication
    // 590-A's Table 1-1 -- taxable alimony received, nontaxable combat pay,
    // household employee wages, a taxable non-tuition fellowship -- is a
    // refused `fjs/return/scope` kind or a documented zero on this engine's
    // own 1040 face, and is named in `fjs/schedule/1/todo/ira-deduction.md`
    // rather than silently omitted.
    const compensationSources = w2Forms.flatMap(form => {
        const printed = form.value.box1WagesTipsOtherCompensation
        return printed === undefined
            ? []
            : [{
                documentHash: form.documentHash,
                boxPath: 'box1WagesTipsOtherCompensation',
                value: printed,
            }]
    })
    const compensationCents = compensationSources.reduce(
        (total, source) => total + centsFromString(source.value), 0n)
    // **PASS 1 of Publication 590-A Appendix B: taxable Social Security
    // benefits computed as though this deduction did not exist.** This is the
    // step every prior statement in this repository called an unmodelable
    // fixed point, and it is not one -- see this function's own docstring.
    // The adjustments handed over are lines 11 through 19a, 23 and 25: the
    // Social Security worksheet's own printed range LESS line 20, which is
    // exactly what Appendix B Worksheet 1 line 1 excludes.
    //
    // **FINDING, recorded rather than fixed here.** Line 14's wiring ran this
    // file's own mutation recipe over every summand below. Dropping
    // `line14.value` left the whole suite green, and
    // `lineFourteenReachesThePublicationFiveNineZeroAWorksheetOneAdjustments`
    // is the leaf that closes it. **Dropping `line13.value` ALSO leaves the
    // suite green, and that one is still open** — a pre-existing gap on a
    // line shipped in Phase 24, not something the Form 3903 wiring
    // introduced. Closing it needs the same fixture shape: Social Security
    // benefits, an IRA contribution, a workplace plan, and an income where
    // the 85% cap does not bind.
    const adjustmentsBeforeIraDeductionCents =
        line11.value + line12.value + line13.value + line14.value + line15.value
        + line16.value + line17.value + line18.value + line19a.value
        + line23.value + line25.value
    const socialSecurityBeforeIraDeduction = socialSecurityBenefitsWorksheet(taxParamSet)({
        status,
        mfsLivedWithSpouseAtAnyTimeInYear,
        totalSsaAndRrbBox5Cents: socialSecurityBenefitsCents,
        otherIncomeLine3Cents: totalIncomeExceptTaxableSocialSecurityLine.value,
        taxExemptInterestCents,
        scheduleOneAdjustmentsTotalCents: adjustmentsBeforeIraDeductionCents,
    })
    const iraPhaseoutIncomeCents = iraDeductionPhaseoutIncome(
        totalIncomeExceptTaxableSocialSecurityLine.value)(
        adjustmentsBeforeIraDeductionCents)(
        socialSecurityBeforeIraDeduction.line18)
    // **PASS 2, twice over.** §219(b)(5)(B)(ii) adds $1,000 to the deductible
    // amount for an individual who attains age 50 before the close of the
    // year, and NO DOCUMENT IN THIS REPOSITORY CARRIES A BIRTH DATE
    // (`.planning/PERSONA-COVERAGE.md`; it is also why
    // `form4972LumpSumDistribution` is refused). So the worksheet is run at
    // BOTH candidate limits and the two answers are compared:
    //
    // - agreeing means the unknown fact cannot change this return, and the
    //   return computes. That is the ordinary case, because a contribution at
    //   or below the phased limit is bounded by the CONTRIBUTION rather than
    //   by the dollar limit.
    // - disagreeing means it can, and the return refuses, naming both
    //   candidate figures.
    //
    // Silently allowing the catch-up overstates the deduction by up to $1,000
    // for every filer under 50 -- and turns a §4973 excess contribution into a
    // deduction. Silently capping at $7,000 understates it for every filer 50
    // or over, and understates it INSIDE the phase-out range at any
    // contribution size, because the surviving limit is proportional to the
    // dollar amount. Both are undetectable downstream. This is neither.
    const iraStatusNamed = iraStatus === undefined ? 'single' : iraStatus
    const baseLimitCents = centsFromString(taxParamSet.iraDeduction.deductibleAmount.amount)
    const catchUpLimitCents = baseLimitCents
        + centsFromString(taxParamSet.iraDeduction.catchUpContribution.amount)
    /** @type {(dollarLimitCents: bigint) => IraDeductionWorksheet} */
    const iraWorksheetAt = dollarLimitCents => iraDeductionWorksheet(taxParamSet)({
        status: iraStatusNamed,
        coveredByWorkplacePlan,
        dollarLimitCents,
        modifiedAgiCents: iraPhaseoutIncomeCents,
        compensationCents,
        contributionCents: iraContributionCents,
    })
    const underFifty = iraWorksheetAt(baseLimitCents)
    const fiftyOrOver = iraWorksheetAt(catchUpLimitCents)
    const iraWorksheet = catchUpAsserted ? fiftyOrOver : underFifty
    if (deductionCouldMatter && !catchUpAsserted && underFifty.w7 !== fiftyOrOver.w7) {
        return {
            kind: 'error',
            message: `Schedule 1 line 20: the traditional IRA deduction is `
                + `$${centsToString(underFifty.w7)} if the taxpayer was under 50 at the close of `
                + `${profile.value.taxYear} and $${centsToString(fiftyOrOver.w7)} if they had `
                + `attained age 50, because `
                + `§219(b)(5)(B)(ii) raises the deductible amount by $1,000 — and no document this `
                + `engine models carries a birth date. Capping at the lower figure would understate `
                + `the deduction for a taxpayer 50 or over; taking the higher one would overstate `
                + `it for everyone else and would deduct a §4973 excess contribution. Refusing `
                + `rather than choosing (no phase yet). Tag the entry `
                + `'traditionalIraContributionAgeFiftyOrOver' to assert the age`,
        }
    }
    // Line 20 cites the contribution entries it read, the Form W-2 boxes
    // behind both the coverage test and the compensation cap, the filing
    // status (which chooses the §219(g)(3)(B) applicable dollar amount), and
    // every source behind the income its phase-out ran against — PROV-02, and
    // the same citation shape line 21 uses one stage later.
    const line20 = documentLine(profile)('Schedule 1 line 20 (IRA deduction)')(iraWorksheet.w7)(
        iraSources.length === 0
            ? []
            : [
                ...iraSources,
                ...workplacePlanSources,
                ...compensationSources,
                { documentHash: profile.documentHash, boxPath: 'filingStatus', value: status },
                ...totalIncomeExceptTaxableSocialSecurityLine.sources,
            ])
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
 *   readonly line7: ReportLine, readonly line8: ReportLine, readonly line8p: ReportLine,
 *   readonly line9: ReportLine,
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
 *   readonly assetRegisters: readonly Stored<AssetRegister>[],
 *   readonly rentalProperties: readonly Stored<RentalProperty>[],
 *   readonly farmForms: readonly Stored<Farm>[],
 *   readonly partnershipK1Forms: readonly Stored<K1Partnership>[],
 *   readonly sCorporationK1Forms: readonly Stored<K1SCorporation>[],
 *   readonly estateTrustK1Forms: readonly Stored<K1EstateTrust>[],
 *   readonly adjustmentForms: readonly Stored<Adjustments>[],
 *   readonly studentLoanInterestForms: readonly Stored<OneZeroNineEightE>[],
 *   readonly w2Forms: readonly Stored<W2>[],
 *   readonly interestForms: readonly Stored<OneZeroNineNineInt>[],
 *   readonly totalIncomeLine: ReportLine,
 *   readonly totalIncomeExceptTaxableSocialSecurityLine: ReportLine,
 *   readonly socialSecurityBenefitsCents: bigint,
 *   readonly taxExemptInterestCents: bigint,
 *   readonly mfsLivedWithSpouseAtAnyTimeInYear: boolean,
 *   readonly iraDistributionReceived: boolean,
 *   readonly marketplaceCoverageStored: boolean,
 *   readonly form1040Line7aCents: bigint,
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
        assetRegisters, rentalProperties, farmForms,
        partnershipK1Forms, sCorporationK1Forms, estateTrustK1Forms,
        adjustmentForms, studentLoanInterestForms, w2Forms, interestForms, totalIncomeLine,
        totalIncomeExceptTaxableSocialSecurityLine, socialSecurityBenefitsCents,
        taxExemptInterestCents, mfsLivedWithSpouseAtAnyTimeInYear, iraDistributionReceived,
        marketplaceCoverageStored, form1040Line7aCents,
    } = input
    const partI = scheduleOnePartI(taxParamSet)({
        form2555Line45Cents: 0n,
        profile, unemploymentForms, nonemployeeCompensationForms, businessExpenseForms, w2Forms,
        assetRegisters, rentalProperties, farmForms,
        partnershipK1Forms, sCorporationK1Forms, estateTrustK1Forms,
        // Printed Form 461 lines 15 and 3 -- see {@link scheduleOnePartI}.
        status, form1040Line7aCents,
    })
    if (partI.kind === 'error') {
        return partI
    }
    const stageOne = scheduleOnePartIIExceptStudentLoanInterest(taxParamSet)({
        form2555ExclusionCents: 0n,
        profile, status, adjustmentForms, w2Forms, interestForms, marketplaceCoverageStored,
        // Schedule 1 line 20's four income-interaction inputs, threaded
        // straight through: §219(g)(3)(A) reads adjusted gross income "after
        // application of section 86", so stage 1 runs the Social Security
        // Benefits Worksheet ITSELF, once, with this line's own $0 in its
        // line 6 -- Publication 590-A Appendix B Worksheet 1.
        totalIncomeExceptTaxableSocialSecurityLine, socialSecurityBenefitsCents,
        taxExemptInterestCents, mfsLivedWithSpouseAtAnyTimeInYear, iraDistributionReceived,
        // Printed Schedule SE line 2 asks for "Schedule C, line 31" by name,
        // so that is the line handed over -- never Part I's line 3, which is
        // the same figure under a different printed number.
        businessNetProfit: partI.scheduleC.partII.line31,
        farmNetProfit: partI.scheduleF.line34,
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
        line8p: partI.line8p, line9: partI.line9, line10: partI.line10,
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

/**
 * The SPOUSE's business record, on a joint return — the same dialect naming a
 * DIFFERENT `recipientTin`. Schedule SE is filed per person, so this beside a
 * partner's Schedule K-1 is two Schedules SE and refuses.
 * @type {Stored<BusinessExpenses>}
 */
const spouseBusinessDoc = {
    documentHash: 'sha256-business-spouse',
    value: { ...businessDoc([]).value, recipientTin: '333-33-3333', accountNumber: 'BUS-0002' },
}

/** @type {(amount: string) => Stored<OneZeroNineEightE>} */
const oneZeroNineEightEDoc = amount => ({
    documentHash: 'sha256-1098e-a',
    value: {
        dialect: 'vnd.fjs.1098e',
        lenderTin: '55-5555555', borrowerTin: '222-22-2222', accountNumber: 'LOAN-0001',
        taxYear: 2025, formRevision: '2025',
        box1StudentLoanInterestReceived: amount,
    },
})

/**
 * A stored Form 1099-INT carrying an early-withdrawal penalty in box 2, for
 * Schedule 1 line 18.
 *
 * `hash` is a parameter rather than a constant because line 18's whole
 * citation contract is ONE source per contributing document — a fixture that
 * reused a single hash could not tell "two documents summed" from "one
 * document counted twice", which is the only interesting way that line can be
 * wrong.
 *
 * `box2EarlyWithdrawalPenalty` is `undefined` for the absence case rather
 * than `'0.00'`: the two are different facts and line 18 cites them
 * differently, which {@link earlyWithdrawalPenaltyLine}'s own docstring
 * argues and the two leaves below pin.
 * @type {(hash: string) => (penalty: string | undefined) => Stored<OneZeroNineNineInt>}
 */
const oneZeroNineNineIntPenaltyDoc = hash => penalty => ({
    documentHash: hash,
    value: {
        dialect: 'vnd.fjs.1099int',
        payerTin: '66-6666666', recipientTin: '222-22-2222', accountNumber: 'CD-0001',
        taxYear: 2025, formRevision: '2025',
        box1InterestIncome: '100.00',
        ...(penalty === undefined ? {} : { box2EarlyWithdrawalPenalty: penalty }),
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
        employerEIN: '11-1111111', employeeSSN: '222-22-2222', controlNumber: '',
        taxYear: 2025, formRevision: '2025',
        box12: [{ code: 'DD', amount: '14500.00' }, { code: 'W', amount: '1000.00' }],
    },
}

// ── Line 14's own fixtures (Form 3903) ───────────────────────────────────────

/**
 * A return profile whose filer has CERTIFIED Form 3903's pre-line
 * requirement — active duty, and a move under a military order because of a
 * permanent change of station. Every legitimate line 14 leaf uses this one,
 * and {@link profileNoDeclaredKinds} is the uncertified control.
 * @type {Stored<ReturnProfile>}
 */
const profileCertifiedForMoving = {
    documentHash: 'profile-hash-3903',
    value: { ...minimalProfileValue, movingExpensesArmedForcesPermanentChangeOfStation: true },
}

/** Form 3903 line 1 — transportation and storage.
 * @type {(amount: string) => Adjustments['entries'][number]} */
const movingTransportEntry = amount => ({
    lineTag: 'movingExpensesTransportationAndStorage',
    datePaid: '2025-07-14',
    description: 'household goods shipped on PCS orders',
    amount,
    individual: 'taxpayer',
})

/** Form 3903 line 2 — travel and lodging, already net of meals.
 * @type {(amount: string) => Adjustments['entries'][number]} */
const movingTravelEntry = amount => ({
    lineTag: 'movingExpensesTravelAndLodgingExcludingMeals',
    datePaid: '2025-07-16',
    description: 'mileage, tolls and one night of lodging en route',
    amount,
    individual: 'taxpayer',
})

/**
 * The box 12 rows that are NOT Form 3903 line 4, carried beside code P on
 * every fixture below: `DD` is the cost of employer-sponsored health coverage
 * and `PP` shares code P's first letter while being a different code
 * entirely. Both are far larger than any code P amount here, so a prefix
 * match or an "any box 12 row" read produces a wildly different line 4 rather
 * than a near miss.
 *
 * **Code `W` is deliberately NOT among them, and the reason is worth
 * recording:** it was, and every leaf using this fixture went red on
 * `Schedule 1 line 13`'s own refusal — an employer HSA contribution with no
 * coverage record — long before line 14 was reached. A decoy has to be inert
 * on every OTHER line, not merely on the one under test.
 * @type {readonly NonNullable<W2['box12']>[number][]}
 */
const notMovingReimbursementBoxes = [
    { code: 'DD', amount: '14500.00' },
    { code: 'PP', amount: '9999.00' },
]

/**
 * A Form W-2 carrying box 12 **code P** beside {@link
 * notMovingReimbursementBoxes}.
 * @type {(amount: string) => Stored<W2>}
 */
const w2WithMovingReimbursement = amount => ({
    documentHash: 'sha256-w2-p',
    value: {
        dialect: 'vnd.fjs.w2',
        employerEIN: '11-1111111', employeeSSN: '222-22-2222', controlNumber: '',
        taxYear: 2025, formRevision: '2025',
        box12: [
            { code: 'DD', amount: '14500.00' },
            { code: 'P', amount },
            { code: 'PP', amount: '9999.00' },
        ],
    },
})

/** The SAME form with its code P row removed — the control that pins the
 * decoys contributing nothing rather than happening to cancel.
 * @type {Stored<W2>}
 */
const w2WithoutMovingReimbursement = {
    documentHash: 'sha256-w2-no-p',
    value: {
        dialect: 'vnd.fjs.w2',
        employerEIN: '11-1111111', employeeSSN: '222-22-2222', controlNumber: '',
        taxYear: 2025, formRevision: '2025',
        box12: notMovingReimbursementBoxes,
    },
}

/** A traditional IRA contribution entry, for the line 14 / line 20
 * interaction leaf below.
 * @type {(amount: string) => Adjustments['entries'][number]} */
const iraContributionEntry = amount => ({
    lineTag: 'traditionalIraContribution',
    datePaid: '2025-04-01',
    description: 'traditional IRA contribution',
    amount,
    individual: 'taxpayer',
})

/**
 * Stage 1 for the Publication 590-A Worksheet 1 interaction: a single filer
 * COVERED by a workplace plan with $48,000.00 of wages and $40,000.00 of
 * SSA-1099 box 5 benefits, whose adjustments the leaf varies.
 *
 * The income is chosen so the Social Security worksheet's 85% cap does NOT
 * bind — which is what makes its line 6 observable at all — and so modified
 * AGI straddles §219(g)(3)(B)'s $79,000.00 threshold depending on whether
 * Schedule 1 line 14 is subtracted.
 * @type {(entries: readonly Adjustments['entries'][number][]) => ScheduleOnePartIIStageOneOutcome}
 */
const stageOneForMovingAndIra = entries =>
    scheduleOnePartIIExceptStudentLoanInterest(taxParams2025)({
        form2555ExclusionCents: 0n,
        profile: profileCertifiedForMoving,
        status: 'single',
        adjustmentForms: [adjustmentsDoc(entries)([])],
        w2Forms: [iraW2Doc('sha256-ira-w2')('48000.00')(true)],
        interestForms: [],
        marketplaceCoverageStored: false,
        totalIncomeExceptTaxableSocialSecurityLine: totalIncomeOf(4800000n),
        socialSecurityBenefitsCents: 4000000n,
        taxExemptInterestCents: 0n,
        mfsLivedWithSpouseAtAnyTimeInYear: false,
        iraDistributionReceived: false,
        farmNetProfit: noBusinessNetProfit(profileCertifiedForMoving),
        businessNetProfit: noBusinessNetProfit(profileCertifiedForMoving),
        businessExpenseForms: [],
        passThrough: noPassThrough,
    })

/**
 * Part II for a moving-expense fixture set, at the certification and
 * documents the leaf is about. Every other input is the empty case, so a
 * non-zero line 14 can only have come from what was handed in.
 * @type {(profile: Stored<ReturnProfile>) => (entries: readonly Adjustments['entries'][number][]) => (w2Forms: readonly Stored<W2>[]) => ScheduleOnePartIIOutcome}
 */
const movingPartII = profile => entries => w2Forms =>
    partIIOf(profile)('single')(entries.length === 0 ? [] : [adjustmentsDoc(entries)([])])([])(
        w2Forms)(0n)

/**
 * Part I for one fixture set. Every leaf below that predates Phase 27 passes
 * no business documents at all, which is exactly the regression question
 * those leaves exist to answer: unemployment compensation must reach line 7
 * and line 10 identically whether or not a Schedule C exists.
 * @type {(profile: Stored<ReturnProfile>) => (unemploymentForms: readonly Stored<OneZeroNineNineG>[]) => (nonemployeeCompensationForms: readonly Stored<OneZeroNineNineNec>[]) => (businessExpenseForms: readonly Stored<BusinessExpenses>[]) => ScheduleOnePartIOutcome}
 */
const partIOf = profile => unemploymentForms => nonemployeeCompensationForms => businessExpenseForms =>
    scheduleOnePartI(taxParams2025)({
        status: 'single',
        form1040Line7aCents: 0n,
        form2555Line45Cents: 0n,
        assetRegisters: [],
        rentalProperties: [],
        farmForms: [],
        profile, unemploymentForms, nonemployeeCompensationForms, businessExpenseForms,
        w2Forms: [],
        partnershipK1Forms: [],
        sCorporationK1Forms: [],
        estateTrustK1Forms: [],
    })

/**
 * A general partner's Schedule K-1 (Form 1065) with the same amount in box 1
 * and in box 14 code A — what a partnership reports for a partner whose whole
 * distributive share is ordinary trade-or-business income.
 * @type {(box1: string) => Stored<K1Partnership>}
 */
const partnershipK1Doc = box1 => ({
    documentHash: 'sha256-k1-1065-a',
    value: {
        dialect: 'vnd.fjs.k1_1065',
        partnershipEIN: '33-3333333',
        partnerTin: '222-22-2222',
        accountNumber: 'PTR-0001',
        taxYear: 2025,
        formRevision: '2025',
        payerName: 'Northwind Ventures LP',
        boxGGeneralPartnerOrLlcMemberManager: /** @type {const} */ (true),
        materialParticipation: 'materiallyParticipated',
        box1OrdinaryBusinessIncome: box1,
        box14SelfEmploymentEarnings: [{ code: 'A', amount: box1 }],
    },
})

/**
 * No pass-through income at all — the shape every leaf that predates Phase 30
 * supplies, and the regression question those leaves exist to answer: a return
 * with no Schedule K-1 must reach Schedule SE line 2 with the Schedule C
 * figure alone.
 * @type {PassThroughSelfEmployment}
 */
const noPassThrough = { earningsCents: 0n, recipientTin: undefined }

/**
 * Stage 1's four Schedule 1 line 20 income-interaction inputs, for a fixture
 * with no Social Security benefits, no tax-exempt interest and no Form 1099-R
 * IRA distribution.
 *
 * Written as a spreadable constant rather than repeated at eight call sites,
 * and NOT given a default on the input type: `tsc` naming every site that has
 * to think about the Publication 590-A Appendix B ordering is the point, and
 * an optional field would have let a real caller forget it silently.
 */
const noSocialSecurityInteraction = {
    socialSecurityBenefitsCents: 0n,
    taxExemptInterestCents: 0n,
    mfsLivedWithSpouseAtAnyTimeInYear: false,
    iraDistributionReceived: false,
    // TAX-39: no Form 1095-A. Schedule 1 line 17 refuses a return holding both
    // §162(l) premiums and Marketplace coverage (Rev. Proc. 2014-41 §2.05's
    // circularity), and every fixture sharing this base predates that line.
    marketplaceCoverageStored: false,
}

/** A $0 "total income except taxable Social Security benefits" line, for the
 * fixtures whose leaves predate Schedule 1 line 20 and carry no income at all.
 * @type {ReportLine}
 */
const noOtherIncomeLine = totalIncomeOf(0n)

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
        assetRegisters: [],
        rentalProperties: [],
        farmForms: [],
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
        form2555ExclusionCents: 0n,
        profile, status, adjustmentForms, w2Forms, interestForms: [],
        ...noSocialSecurityInteraction,
        totalIncomeExceptTaxableSocialSecurityLine: totalIncomeOf(totalIncomeCents),
        farmNetProfit: noBusinessNetProfit(profile),
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
 * Part II stage one over a set of Forms 1099-INT and nothing else, for the
 * line 18 leaves.
 *
 * Everything other than `interestForms` is the empty/no-business case, so a
 * non-zero line 18 can only have come from the box under test — the same
 * isolation {@link emptyPartII} gives the other adjustment leaves.
 * @type {(interestForms: readonly Stored<OneZeroNineNineInt>[]) => ScheduleOnePartIIStageOneOutcome}
 */
const stageOneWithInterest = interestForms =>
    scheduleOnePartIIExceptStudentLoanInterest(taxParams2025)({
        form2555ExclusionCents: 0n,
        profile: profileNoDeclaredKinds,
        status: 'single',
        adjustmentForms: [],
        w2Forms: [],
        interestForms,
        ...noSocialSecurityInteraction,
        totalIncomeExceptTaxableSocialSecurityLine: noOtherIncomeLine,
        farmNetProfit: noBusinessNetProfit(profileNoDeclaredKinds),
        businessNetProfit: noBusinessNetProfit(profileNoDeclaredKinds),
        businessExpenseForms: [],
        passThrough: noPassThrough,
    })


// ── Schedule 1 line 20's own fixtures (§219) ─────────────────────────────────

/**
 * One `vnd.fjs.adjustments` entry feeding line 20. `tag` is a parameter
 * because the two tags are the whole of this line's age story: the plain one
 * leaves §219(b)(5)(B)(ii) UNKNOWN and the other asserts it.
 * @type {(tag: string) => (amount: string) => Adjustments['entries'][number]}
 */
const iraEntry = tag => amount => ({
    lineTag: tag,
    datePaid: '2025-11-14',
    description: 'traditional IRA contribution',
    amount,
    individual: 'taxpayer',
})

/**
 * A Form W-2 carrying box 1 wages and, optionally, box 13's "Retirement plan"
 * checkbox — the box §219(g)(5) active-participant status is read from, and
 * the box no computation in this repository read before line 20.
 *
 * `box13RetirementPlan` is ABSENT rather than `false` for the not-covered
 * case: `vnd.fjs.w2` types it `or(option, true)`, so absence is the only way the
 * printed form says "not checked", and a fixture that wrote `false` would not
 * validate.
 * @type {(documentHash: string) => (box1: string) => (coveredByWorkplacePlan: boolean) => Stored<W2>}
 */
const iraW2Doc = documentHash => box1 => coveredByWorkplacePlan => ({
    documentHash,
    value: {
        dialect: 'vnd.fjs.w2',
        employerEIN: '11-1111111', employeeSSN: '222-22-2222', controlNumber: '',
        taxYear: 2025, formRevision: '2025',
        box1WagesTipsOtherCompensation: box1,
        ...(coveredByWorkplacePlan ? { box13RetirementPlan: /** @type {true} */ (true) } : {}),
    },
})

/**
 * Everything a line 20 leaf varies. Every field is required — no defaults —
 * because each one of them can move the deduction by thousands of dollars and
 * a leaf that did not state its filing status or its coverage would be
 * unreadable.
 * @typedef {{
 *   readonly status: IndividualFilingStatus,
 *   readonly wages: string | undefined,
 *   readonly coveredByWorkplacePlan: boolean,
 *   readonly entries: readonly Adjustments['entries'][number][],
 *   readonly socialSecurityBenefits: string,
 *   readonly mfsLivedWithSpouseAtAnyTimeInYear: boolean,
 *   readonly iraDistributionReceived: boolean,
 * }} IraFixture
 */

/**
 * Stage 1 for a line 20 fixture: a Form W-2 (or none), an adjustments
 * document, and a "total income except taxable Social Security" line built
 * from the SAME wages the W-2 reports — never a figure typed to match, so a
 * leaf cannot pass by having its income and its compensation disagree.
 *
 * `profileNoDeclaredKinds` throughout: line 20 reads documents and is not
 * gated on a declaration, exactly as lines 11, 13 and 18 are not.
 * @type {(fixture: IraFixture) => ScheduleOnePartIIStageOneOutcome}
 */
const stageOneForIra = fixture => {
    const {
        status, wages, coveredByWorkplacePlan, entries, socialSecurityBenefits,
        mfsLivedWithSpouseAtAnyTimeInYear, iraDistributionReceived,
    } = fixture
    const w2Forms = wages === undefined
        ? []
        : [iraW2Doc('sha256-ira-w2')(wages)(coveredByWorkplacePlan)]
    /** @type {ReportLine} */
    const totalIncomeExceptTaxableSocialSecurityLine = wages === undefined
        ? noOtherIncomeLine
        : {
            value: centsFromString(wages),
            sources: [{
                documentHash: 'sha256-ira-w2',
                boxPath: 'box1WagesTipsOtherCompensation',
                value: wages,
            }],
            rule: '1040 line 9 less line 6b (total income except taxable Social Security benefits)',
        }
    return scheduleOnePartIIExceptStudentLoanInterest(taxParams2025)({
        form2555ExclusionCents: 0n,
        profile: profileNoDeclaredKinds,
        status,
        adjustmentForms: entries.length === 0 ? [] : [adjustmentsDoc(entries)([])],
        w2Forms,
        interestForms: [],
        marketplaceCoverageStored: false,
        totalIncomeExceptTaxableSocialSecurityLine,
        socialSecurityBenefitsCents: centsFromString(socialSecurityBenefits),
        taxExemptInterestCents: 0n,
        mfsLivedWithSpouseAtAnyTimeInYear,
        iraDistributionReceived,
        farmNetProfit: noBusinessNetProfit(profileNoDeclaredKinds),
        businessNetProfit: noBusinessNetProfit(profileNoDeclaredKinds),
        businessExpenseForms: [],
        passThrough: noPassThrough,
    })
}

/**
 * The base line 20 fixture: a single filer with $50,000.00 of wages, no
 * workplace plan, no Social Security benefits, no IRA distribution and no
 * contribution. Every leaf below spreads this and overrides the one or two
 * fields it is about, so a leaf's own text is the difference from the base
 * case rather than a wall of repeated fields.
 * @type {IraFixture}
 */
const iraBaseFixture = {
    status: 'single',
    wages: '50000.00',
    coveredByWorkplacePlan: false,
    entries: [],
    socialSecurityBenefits: '0.00',
    mfsLivedWithSpouseAtAnyTimeInYear: false,
    iraDistributionReceived: false,
}

/** Line 20's cents for one fixture, narrowed through {@link okStageOne}.
 * @type {(fixture: IraFixture) => bigint}
 */
const lineTwentyOf = fixture => okStageOne(stageOneForIra(fixture)).line20.value

/**
 * Stage 1 for a return WITH a business — Schedule C run first, exactly as
 * `scheduleOne` and `fjs/form1040/core` run it, so `businessNetProfit` is the
 * real line 31 rather than a figure typed to match. Phase 28's own fixture
 * shape.
 * @type {(profile: Stored<ReturnProfile>) => (status: IndividualFilingStatus) => (nonemployeeCompensationForms: readonly Stored<OneZeroNineNineNec>[]) => (businessExpenseForms: readonly Stored<BusinessExpenses>[]) => (w2Forms: readonly Stored<W2>[]) => ScheduleOnePartIIStageOneOutcome}
 */
const stageOneWithBusiness = profile => status => nonemployeeCompensationForms =>
    businessExpenseForms => w2Forms => {
        const partI = okPartI(scheduleOnePartI(taxParams2025)({
            status: 'single',
            form1040Line7aCents: 0n,
            form2555Line45Cents: 0n,
            assetRegisters: [],
            rentalProperties: [],
            farmForms: [],
            profile,
            unemploymentForms: [],
            nonemployeeCompensationForms,
            businessExpenseForms,
            w2Forms,
            partnershipK1Forms: [],
            sCorporationK1Forms: [],
            estateTrustK1Forms: [],
        }))
        return scheduleOnePartIIExceptStudentLoanInterest(taxParams2025)({
            form2555ExclusionCents: 0n,
            profile, status, adjustmentForms: [], w2Forms, interestForms: [],
            ...noSocialSecurityInteraction,
            totalIncomeExceptTaxableSocialSecurityLine: noOtherIncomeLine,
            businessNetProfit: partI.scheduleC.partII.line31,
            farmNetProfit: partI.scheduleF.line34,
            businessExpenseForms,
            passThrough: passThroughOf(partI.scheduleE),
        })
    }

/**
 * Stage 1 for a return whose self-employment income comes from a Schedule K-1
 * rather than a Schedule C — Schedule E run first, exactly as `scheduleOne`
 * and `fjs/form1040/core` run it.
 * @type {(profile: Stored<ReturnProfile>) => (status: IndividualFilingStatus) => (partnershipK1Forms: readonly Stored<K1Partnership>[]) => (businessExpenseForms: readonly Stored<BusinessExpenses>[]) => (w2Forms: readonly Stored<W2>[]) => ScheduleOnePartIIStageOneOutcome}
 */
const stageOneWithPassThrough = profile => status => partnershipK1Forms =>
    businessExpenseForms => w2Forms => {
        const partI = okPartI(scheduleOnePartI(taxParams2025)({
            status: 'single',
            form1040Line7aCents: 0n,
            form2555Line45Cents: 0n,
            assetRegisters: [],
            rentalProperties: [],
            farmForms: [],
            profile,
            unemploymentForms: [],
            nonemployeeCompensationForms: [],
            businessExpenseForms,
            w2Forms,
            partnershipK1Forms,
            sCorporationK1Forms: [],
            estateTrustK1Forms: [],
        }))
        return scheduleOnePartIIExceptStudentLoanInterest(taxParams2025)({
            form2555ExclusionCents: 0n,
            profile, status, adjustmentForms: [], w2Forms, interestForms: [],
            ...noSocialSecurityInteraction,
            totalIncomeExceptTaxableSocialSecurityLine: noOtherIncomeLine,
            businessNetProfit: partI.scheduleC.partII.line31,
            farmNetProfit: partI.scheduleF.line34,
            businessExpenseForms,
            passThrough: passThroughOf(partI.scheduleE),
        })
    }

/**
 * A Form W-2 carrying box 3 Social Security wages for a named recipient — the
 * box Schedule SE line 8a reads, and NOT box 5, which is Form 8959's.
 * @type {(documentHash: string) => (employeeSSN: string) => (amount: string) => Stored<W2>}
 */
const w2WithSocialSecurityWages = documentHash => employeeSSN => amount => ({
    documentHash,
    value: {
        dialect: 'vnd.fjs.w2',
        employerEIN: '11-1111111', employeeSSN, controlNumber: 'ACC-W2',
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
 *
 * **Line 14 left this list when Form 3903 was wired.** It is still a
 * documented zero on a return with no moving documents — `lineFourteenIsA`
 * `DocumentedZeroWithoutMovingDocuments` asserts exactly that, as the control
 * for the leaves that compute it — but it is no longer a line NO phase has
 * claimed, and leaving it here would make this list say something false while
 * passing.
 * **Line 17 left this list at TAX-39.** It is still a documented zero on a
 * return that stores no premium — `lineSeventeenIsADocumentedZeroWithoutAny`
 * `PremiumEntry` asserts exactly that, as the control for the leaves that
 * compute it — but a line this schedule now claims cannot also be a line no
 * phase has claimed, and leaving it here would make the list say something
 * false while passing.
 * @type {readonly string[]} */
const partIILinesStillDocumentedZero = [
    'line12', 'line16', 'line18', 'line19a',
    'line20', 'line22', 'line23', 'line24', 'line25',
]

// ── TAX-39's fixtures: Schedule 1 line 17 ────────────────────────────────────

/**
 * A profile carrying §162(l)(2)(B)'s certification — the ONE fact this line
 * needs that no information return reports. Every "computes" leaf below uses
 * it and `theUncertifiedReturnRefusesNamingTheField` is the control that
 * removes it.
 * @type {Stored<ReturnProfile>}
 */
const profileCertifiedForHealthInsurance = {
    documentHash: 'profile-hash-7206',
    value: {
        ...minimalProfileValue,
        notEligibleForAnySubsidizedEmployerHealthPlanInAnyMonth: true,
    },
}

/** @type {(lineTag: string) => (amount: string) => (individual: string) => Adjustments['entries'][number]} */
const premiumEntry = lineTag => amount => individual => ({
    lineTag,
    datePaid: '2025-07-01',
    description: 'health coverage premium',
    amount,
    individual,
})

/**
 * Stage 1 for a return with a Schedule C business AND a `vnd.fjs.adjustments`
 * record — `stageOneWithBusiness` widened by the two inputs line 17 needs.
 * Schedule C and Schedule E are run FIRST here, exactly as `scheduleOne` and
 * `fjs/form1040/core` run them, so `businessNetProfit` is a real line 31.
 * @type {(profile: Stored<ReturnProfile>) => (nonemployeeCompensationForms: readonly Stored<OneZeroNineNineNec>[]) => (partnershipK1Forms: readonly Stored<K1Partnership>[]) => (entries: readonly Adjustments['entries'][number][]) => (marketplaceCoverageStored: boolean) => (form2555ExclusionCents: bigint) => ScheduleOnePartIIStageOneOutcome}
 */
const stageOneForHealthInsurance = profile => nonemployeeCompensationForms =>
    partnershipK1Forms => entries => marketplaceCoverageStored =>
        form2555ExclusionCents => {
            // `fjs/schedule/c` refuses a Form 1099-NEC with no business
            // record, so the two travel together — supplied here rather than
            // by each leaf, since no leaf below is about that refusal.
            const businessExpenseForms = nonemployeeCompensationForms.length === 0
                ? []
                : [businessDoc([])]
            const partI = okPartI(scheduleOnePartI(taxParams2025)({
                status: 'single',
                form1040Line7aCents: 0n,
                form2555Line45Cents: 0n,
                assetRegisters: [],
                rentalProperties: [],
                farmForms: [],
                profile,
                unemploymentForms: [],
                nonemployeeCompensationForms,
                businessExpenseForms,
                w2Forms: [],
                partnershipK1Forms,
                sCorporationK1Forms: [],
                estateTrustK1Forms: [],
            }))
            // The status comes off the PROFILE, never a literal: a
            // `spouse`-attributed premium is refused on any status but
            // married-filing-jointly, and a fixture that hardcoded 'single'
            // could never reach Form 7206 line 2's second covered person.
            const status = profile.value.filingStatus === 'marriedFilingJointly'
                ? /** @type {IndividualFilingStatus} */ ('marriedFilingJointly')
                : /** @type {IndividualFilingStatus} */ ('single')
            return scheduleOnePartIIExceptStudentLoanInterest(taxParams2025)({
                form2555ExclusionCents,
                profile,
                status,
                adjustmentForms: entries.length === 0 ? [] : [adjustmentsDoc(entries)([])],
                w2Forms: [],
                interestForms: [],
                ...noSocialSecurityInteraction,
                marketplaceCoverageStored,
                totalIncomeExceptTaxableSocialSecurityLine: noOtherIncomeLine,
                businessNetProfit: partI.scheduleC.partII.line31,
                farmNetProfit: partI.scheduleF.line34,
                businessExpenseForms,
                passThrough: passThroughOf(partI.scheduleE),
            })
        }

/** The ordinary shape: a sole proprietor, no Marketplace coverage, certified.
 * @type {(netProfit: string) => (entries: readonly Adjustments['entries'][number][]) => ScheduleOnePartIIStageOneOutcome}
 */
const soleProprietorWithPremiums = netProfit => entries =>
    stageOneForHealthInsurance(profileCertifiedForHealthInsurance)(
        [nonemployeeCompensationDoc(netProfit)])([])(entries)(false)(0n)

export const proof = {
    // ── Schedule 1 line 8d: the §911 exclusion (TAX-42) ─────────────────────
    //
    // **A form-level proof cannot prove a wiring.** `fjs/form2555`'s own
    // fourteen leaves prove its arithmetic against `bigint`s and could not
    // notice this schedule entering line 45 with the wrong SIGN, at the wrong
    // printed line, or citing the wrong box. i2555 p7 states the sign in
    // words: *"Enter the amount from line 45 on Schedule 1 (Form 1040), line
    // 8d. Reduce the other items of additional income by the NEGATIVE amount
    // on line 8d."*
    lineEightD: {
        theExclusionEntersLineEightAsANegativeAndReachesLineTen: () => {
            const partI = okPartI(scheduleOnePartI(taxParams2025)({
                status: 'single',
                form1040Line7aCents: 0n,
                form2555Line45Cents: 13000000n,
                profile: profileNoDeclaredKinds,
                unemploymentForms: [],
                nonemployeeCompensationForms: [],
                businessExpenseForms: [],
                w2Forms: [],
                assetRegisters: [],
                rentalProperties: [],
                farmForms: [],
                partnershipK1Forms: [],
                sCorporationK1Forms: [],
                estateTrustK1Forms: [],
            }))
            assertEq(partI.line8.value, -13000000n, 'NEGATIVE $130,000.00, never positive')
            assertEq(partI.line9.value, -13000000n, 'line 9 adds 8d to Form 461\'s 8p, which is zero here')
            assertEq(partI.line10.value, -13000000n, 'and line 10 carries it to 1040 line 8')
            assert(
                partI.line8.rule.includes('Form 2555 line 45'),
                ['the line must name where the figure came from', partI.line8.rule])
            const [first] = partI.line8.sources
            assert(first !== undefined, 'the line must cite something')
            assertEq(first.boxPath, 'foreignEarnedIncome',
                'and cite the profile box, not declaredKinds')
        },
        // The exclusion NETS against other Part I income rather than replacing
        // it — the half a sign error would leave looking plausible. $4,554.00
        // of unemployment beside a $130,000.00 exclusion is −$125,446.00, and
        // a positive line 8d would have given +$134,554.00.
        theExclusionNetsAgainstOtherAdditionalIncome: () => {
            const partI = okPartI(scheduleOnePartI(taxParams2025)({
                status: 'single',
                form1040Line7aCents: 0n,
                form2555Line45Cents: 13000000n,
                profile: profileNoDeclaredKinds,
                unemploymentForms: [unemploymentA],
                nonemployeeCompensationForms: [],
                businessExpenseForms: [],
                w2Forms: [],
                assetRegisters: [],
                rentalProperties: [],
                farmForms: [],
                partnershipK1Forms: [],
                sCorporationK1Forms: [],
                estateTrustK1Forms: [],
            }))
            assertEq(partI.line7.value, 455400n, '$4,554.00 of unemployment')
            assertEq(partI.line10.value, -12544600n, '$4,554.00 − $130,000.00')
            assert(
                partI.line10.value !== 13455400n,
                ['a positive line 8d would have ADDED the exclusion', partI.line10.value])
        },
        // THE CONTROL: with no exclusion, line 8 is the profile-declared zero
        // it has always been, citing `declaredKinds` and naming no form.
        controlNoExclusionLeavesLineEightAProfileDeclaredZero: () => {
            const partI = partIWithoutBusiness(profileNoDeclaredKinds)([])
            assertEq(partI.line8.value, 0n)
            const [first] = partI.line8.sources
            assert(first !== undefined, 'the zero still cites the profile')
            assertEq(first.boxPath, 'declaredKinds')
            assert(
                !partI.line8.rule.includes('Form 2555'),
                ['a return with no exclusion must not name Form 2555', partI.line8.rule])
        },
    },
    // ── Schedule 1 line 17: the §162(l) deduction (TAX-39) ──────────────────
    //
    // **A form-level proof cannot prove a wiring.** `fjs/form7206`'s own
    // eighteen leaves prove its arithmetic against `bigint`s and would not
    // notice this schedule handing it an empty entry list, the wrong Schedule
    // 1 line for its line 7, or long-term care premiums routed into its
    // uncapped line 1. These leaves drive the real stage-1 entry point over
    // real stored documents, which is the only place that shows.
    //
    // Every expected figure is computed on paper from the printed captions.
    // The Schedule SE arithmetic behind Schedule 1 line 15 is worked once here
    // and reused, and it is cross-checkable against this file's own
    // independently-verified `line 13 = $3,532.39` for a $50,000.00 profit:
    //
    //   $50,000.00 profit -> SE line 4a = 0.9235 x 5,000,000 =  4,617,500
    //                        line 10 = 0.124 x 4,617,500     =    572,570
    //                        line 11 = 0.029 x 4,617,500     =    133,908  (half-up)
    //                        line 12                          =    706,478
    //                        line 13 = 50% of line 12         =    353,239  -> Sch 1 line 15
    //
    //    $5,000.00 profit -> SE line 4a = 0.9235 x   500,000 =    461,750
    //                        line 10 = 0.124 x   461,750     =     57,257
    //                        line 11 = 0.029 x   461,750     =     13,391  (half-up)
    //                        line 12                          =     70,648
    //                        line 13                          =     35,324  -> Sch 1 line 15
    selfEmployedHealthInsurance: {
        // The ordinary return. $50,000.00 of Schedule C profit, $9,600.00 of
        // medical premiums, certified.
        //
        //   Form 7206 line 3  =  9,600.00
        //   line 4 = line 5   = 50,000.00, so line 6 = 1
        //   line 7            =  3,532.39      (the whole Schedule 1 line 15)
        //   line 8 = line 13  = 46,467.61
        //   line 14 = min(9,600.00, 46,467.61) = 9,600.00
        aSoleProprietorsPremiumReachesLineSeventeenWhole: () => {
            const stageOne = okStageOne(soleProprietorWithPremiums('50000.00')([
                premiumEntry('selfEmployedHealthInsuranceMedicalDentalVision')('9600.00')(
                    'taxpayer'),
            ]))
            assertEq(stageOne.line15.value, 353239n, 'Schedule 1 line 15 = $3,532.39')
            assertEq(stageOne.line17.value, 960000n, 'Schedule 1 line 17 = $9,600.00')
            // The hard zero is REPLACED, not supplemented: on a return with a
            // real entry the sources name the entry rather than `declaredKinds`.
            const paths = stageOne.line17.sources.map(source => source.boxPath)
            assert(
                paths.includes(
                    'entries[lineTag=selfEmployedHealthInsuranceMedicalDentalVision,'
                    + 'individual=taxpayer]'),
                ['line 17 must cite the entry it read', paths])
            assert(
                !paths.includes('declaredKinds'),
                ['and must not still be citing the profile', paths])
            assert(
                stageOne.line17.rule.includes('Form 7206 line 14'),
                ['line 17 must name the form line it implements', stageOne.line17.rule])
        },
        // **THE CONTROL, and the regression property.** A return with a
        // business and NO premium entry is byte-identical to what it was before
        // this phase: a documented zero citing the profile's own
        // `declaredKinds` box, and no refusal anywhere.
        lineSeventeenIsADocumentedZeroWithoutAnyPremiumEntry: () => {
            const stageOne = okStageOne(soleProprietorWithPremiums('50000.00')([]))
            assertEq(stageOne.line17.value, 0n)
            assertEq(stageOne.line17.sources.length, 1, 'exactly the profile citation')
            const [only] = stageOne.line17.sources
            assert(only !== undefined, 'one source')
            assert(only !== undefined, 'expected a source')
            assertEq(only.boxPath, 'declaredKinds')
            assertEq(only.documentHash, profileCertifiedForHealthInsurance.documentHash)
        },
        // A return with NO business and no premium is untouched too — the
        // wider regression control, since most returns are this one.
        aReturnWithNoBusinessAndNoPremiumIsUntouched: () => {
            const stageOne = okStageOne(stageOneForHealthInsurance(profileNoDeclaredKinds)(
                [])([])([])(false)(0n))
            assertEq(stageOne.line17.value, 0n)
            assertEq(stageOne.line17.sources.length, 1)
            assertEq(stageOne.line15.value, 0n, 'and line 15 is still zero as well')
        },
        // **§162(l)(2)(A)'s ceiling BINDING, which is the whole point of lines
        // 4-13 and which the leaf above cannot see.** $5,000.00 of profit
        // against the same $9,600.00 premium: line 13 = 5,000.00 - 353.24 =
        // 4,646.76, and line 14 takes it instead of line 3.
        theEarnedIncomeCeilingCutsTheDeductionOnASmallBusiness: () => {
            const stageOne = okStageOne(soleProprietorWithPremiums('5000.00')([
                premiumEntry('selfEmployedHealthInsuranceMedicalDentalVision')('9600.00')(
                    'taxpayer'),
            ]))
            assertEq(stageOne.line15.value, 35324n, 'Schedule 1 line 15 = $353.24')
            assertEq(stageOne.line17.value, 464676n, '$5,000.00 - $353.24 = $4,646.76')
            assert(
                stageOne.line17.value < 960000n,
                ['the ceiling must actually bind here', stageOne.line17.value])
        },
        // **The §164(f) subtraction is REAL and this is what proves the right
        // figure feeds Form 7206 line 7.** Same business, same premium, and
        // the deduction is exactly Schedule 1 line 15 short of the profit.
        // Handing line 7 anything but the full line 15 changes this identity.
        theCeilingIsShortOfTheProfitByExactlyScheduleOneLineFifteen: () => {
            const stageOne = okStageOne(soleProprietorWithPremiums('5000.00')([
                premiumEntry('selfEmployedHealthInsuranceMedicalDentalVision')('9600.00')(
                    'taxpayer'),
            ]))
            assertEq(
                500000n - stageOne.line17.value, stageOne.line15.value,
                'Form 7206 line 8 is line 4 less the whole of Schedule 1 line 15')
        },
        // Long-term care: §213(d)(10)'s cap applied through the tag, and the
        // capped half ADDED to the uncapped one on Form 7206 line 3.
        //
        //   line 1 = 9,600.00 (uncapped)
        //   line 2 = min(2,400.00, 1,800.00) = 1,800.00   band 51-60
        //   line 3 = 11,400.00, and the $46,467.61 ceiling does not bind
        longTermCarePremiumsAreCappedByBandAndAddedToTheMedicalHalf: () => {
            const stageOne = okStageOne(soleProprietorWithPremiums('50000.00')([
                premiumEntry('selfEmployedHealthInsuranceMedicalDentalVision')('9600.00')(
                    'taxpayer'),
                premiumEntry('selfEmployedLongTermCareAgeFiftyOneToSixty')('2400.00')('taxpayer'),
            ]))
            assertEq(stageOne.line17.value, 1140000n, '$9,600.00 + $1,800.00 = $11,400.00')
            assert(
                stageOne.line17.value !== 1200000n,
                ['an UNCAPPED long-term care premium would have given $12,000.00',
                    stageOne.line17.value])
        },
        // The band tag decides which cap, and a different band is a different
        // answer. Without this leaf every band tag could route to the same cap.
        // **A recorded property of this code, found by a mutation that did NOT
        // bite where it was predicted to.** Rewriting Form 7206 line 2 to cap
        // the running SUM rather than each covered person leaves the
        // two-DIFFERENT-bands fixtures green: the accumulated $1,800.00 plus a
        // second $3,000.00 is $4,800.00, which is still under the 61-70 band's
        // $4,810.00 cap, so the wrong rule returns the right answer. Only two
        // people in the SAME band separate the two rules
        // (`twoPeopleInTheSameBandEachGetTheirOwnCap`, in `fjs/form7206`), and
        // that is why both leaves exist rather than one.
        adifferentBandTagSelectsADifferentCap: () => {
            const younger = okStageOne(soleProprietorWithPremiums('50000.00')([
                premiumEntry('selfEmployedLongTermCareAgeFortyOrYounger')('2400.00')('taxpayer'),
            ]))
            const older = okStageOne(soleProprietorWithPremiums('50000.00')([
                premiumEntry('selfEmployedLongTermCareAgeSeventyOneOrOlder')('2400.00')('taxpayer'),
            ]))
            assertEq(younger.line17.value, 48000n, '$480.00, the age-40-or-younger cap')
            assertEq(older.line17.value, 240000n, 'the whole $2,400.00, under a $6,020.00 cap')
        },
        // A long-term care premium tagged for the SPOUSE on a joint return is
        // a second covered person with a second cap — Form 7206 line 2's own
        // "figure separately ... for each person" through this schedule's
        // `individual` field, which is the only identity it has.
        aSpousesLongTermCarePremiumIsASecondCoveredPerson: () => {
            const joint = {
                documentHash: 'profile-hash-7206-joint',
                value: {
                    ...profileCertifiedForHealthInsurance.value,
                    filingStatus: 'marriedFilingJointly',
                },
            }
            const stageOne = okStageOne(stageOneForHealthInsurance(joint)(
                [nonemployeeCompensationDoc('50000.00')])([])([
                    premiumEntry('selfEmployedLongTermCareAgeFiftyOneToSixty')('2400.00')(
                        'taxpayer'),
                    premiumEntry('selfEmployedLongTermCareAgeFiftyOneToSixty')('2400.00')('spouse'),
                ])(false)(0n))
            assertEq(stageOne.line17.value, 360000n, 'two $1,800.00 caps, not one')
        },
        // **The wiring INSIDE this schedule.** Line 17 is inside the Social
        // Security worksheet's printed "lines 11 through 20" range and inside
        // line 26's total, and a line that computed correctly but reached
        // neither would leave every leaf above green and the return wrong.
        //
        // **The line 26 half of this leaf was added after a mutation exposed
        // the name as a promise the body did not keep.** Dropping line 17 from
        // `scheduleOnePartII`'s line 26 summands reddened only the
        // `fjs/form1040/core` and `fjs/report/tax_return` leaves — nothing at
        // THIS layer noticed, because stage 1 has no line 26 and the two
        // worksheet totals are computed by different functions. A leaf whose
        // name claims more than its assertions is the same defect as a stale
        // docstring, and it is caught the same way: by mutating.
        lineSeventeenReachesLineTwentySixAndBothWorksheetTotals: () => {
            const withPremium = okStageOne(soleProprietorWithPremiums('50000.00')([
                premiumEntry('selfEmployedHealthInsuranceMedicalDentalVision')('9600.00')(
                    'taxpayer'),
            ]))
            const without = okStageOne(soleProprietorWithPremiums('50000.00')([]))
            assertEq(
                socialSecurityWorksheetAdjustmentsTotal(withPremium)
                    - socialSecurityWorksheetAdjustmentsTotal(without),
                960000n,
                'the Social Security worksheet\u2019s line 6 must move by the whole deduction')
            assertEq(
                studentLoanInterestWorksheetOtherAdjustments(withPremium)
                    - studentLoanInterestWorksheetOtherAdjustments(without),
                960000n,
                'and so must the student loan interest worksheet\u2019s other-adjustments total')
            // …and printed line 26 itself, through stage 2, which is the line
            // 1040 line 10 actually reads.
            /** @type {(stageOne: ScheduleOnePartIIExceptStudentLoanInterest) => bigint} */
            const lineTwentySixOf = stageOne => {
                const partII = scheduleOnePartII(taxParams2025)({
                    profile: profileCertifiedForHealthInsurance,
                    status: 'single',
                    exceptStudentLoanInterest: stageOne,
                    adjustmentForms: [],
                    studentLoanInterestForms: [],
                    totalIncomeLine: totalIncomeOf(5000000n),
                })
                return okPartII(partII).line26.value
            }
            assertEq(
                lineTwentySixOf(withPremium) - lineTwentySixOf(without), 960000n,
                'and printed line 26, the figure 1040 line 10 restates')
        },
        // The tag vocabulary and the stored parameter table must name the same
        // five bands. Two independent lists, compared — a band added to
        // `fjs/tax/params` with no tag here would be a cap no taxpayer could
        // reach, and a tag with no band would panic inside `fjs/form7206`
        // instead of refusing at ingest.
        theLongTermCareTagsCoverEveryStoredAgeBandExactlyOnce: () => {
            const stored = taxParams2025.longTermCarePremiumLimits.map(limit => limit.band)
            assertEq(longTermCareTagBands.length, 5, 'five tags, hand-counted')
            assertEq(stored.length, 5, 'and five stored bands')
            for (const [tag, band] of longTermCareTagBands) {
                assert(stored.includes(band), ['a tag naming a band no parameter stores', tag, band])
                assert(
                    adjustmentLineTagNames.includes(tag),
                    ['every line 17 tag must be in the accepted vocabulary', tag])
            }
            for (const band of stored) {
                assert(
                    longTermCareTagBands.some(([, named]) => named === band),
                    ['a stored band no tag can reach', band])
            }
        },
        // ── The five refusals, each with its control ────────────────────────
        //
        // R1 — §162(l)(2)(B). The SAME return that computes above, with the
        // certification removed. The message must name the field that unlocks
        // it and where the amount would have gone; asserting only that it
        // refused would pass for any of the other four.
        theUncertifiedReturnRefusesNamingTheFieldAndTheDestination: () => {
            const result = refusal(stageOneForHealthInsurance(profileNoDeclaredKinds)(
                [nonemployeeCompensationDoc('50000.00')])([])([
                    premiumEntry('selfEmployedHealthInsuranceMedicalDentalVision')('9600.00')(
                        'taxpayer'),
                ])(false)(0n))
            assert(
                result.message.includes(
                    'notEligibleForAnySubsidizedEmployerHealthPlanInAnyMonth'),
                ['the refusal must name the field that unlocks it', result.message])
            assert(
                result.message.includes('162(l)(2)(B)'),
                ['and the provision behind it', result.message])
            assert(
                result.message.includes('Schedule 1 line 17 -> line 26 -> 1040 line 10'),
                ['and WHERE the amount would have gone', result.message])
        },
        // R2 — Rev. Proc. 2014-41's circularity. Same certified return, plus a
        // Form 1095-A.
        premiumsBesideMarketplaceCoverageRefuseNamingTheCircularity: () => {
            const result = refusal(stageOneForHealthInsurance(
                profileCertifiedForHealthInsurance)(
                [nonemployeeCompensationDoc('50000.00')])([])([
                    premiumEntry('selfEmployedHealthInsuranceMedicalDentalVision')('9600.00')(
                        'taxpayer'),
                ])(true)(0n))
            assert(
                result.message.includes('Rev. Proc. 2014-41'),
                ['the refusal must name the governing guidance', result.message])
            assert(
                result.message.includes('1095-A') && result.message.includes('circular'),
                ['and the document and the shape of the problem', result.message])
            assert(
                result.message.includes('Schedule 1 line 17 -> line 26 -> 1040 line 10'),
                ['and where the amount would have gone', result.message])
        },
        // R2b — §911(d)(6), Form 7206 line 12 (TAX-42). Same certified return,
        // plus a §911 exclusion.
        premiumsBesideAForeignEarnedIncomeExclusionRefuseNamingTheAttribution: () => {
            const result = refusal(stageOneForHealthInsurance(
                profileCertifiedForHealthInsurance)(
                [nonemployeeCompensationDoc('50000.00')])([])([
                    premiumEntry('selfEmployedHealthInsuranceMedicalDentalVision')('9600.00')(
                        'taxpayer'),
                ])(false)(6000000n))
            assert(
                result.message.includes('60000.00'),
                ['the refusal must name the exclusion', result.message])
            assert(
                result.message.includes('Form 7206 line 12'),
                ['and the printed line it cannot fill in', result.message])
            assert(
                result.message.includes('attributable to'),
                ['and the printed word that is the whole problem', result.message])
            assert(
                result.message.includes('§911(d)(6)'),
                ['and the statute behind it', result.message])
            assert(
                result.message.includes('Schedule 1 line 17 -> line 26 -> 1040 line 10'),
                ['and where the amount would have gone', result.message])
        },
        // THE CONTROL for R2b: a §911 exclusion with NO premium entry is an
        // ordinary expatriate return and must still compute — the whole point
        // of TAX-42. Without this leaf a refusal that fired on every exclusion
        // would pass the one above and take the phase's own persona with it.
        aForeignEarnedIncomeExclusionWithNoPremiumEntryStillComputes: () => {
            const stageOne = okStageOne(stageOneForHealthInsurance(
                profileCertifiedForHealthInsurance)(
                [nonemployeeCompensationDoc('50000.00')])([])([])(false)(6000000n))
            assertEq(stageOne.line17.value, 0n, 'nothing was claimed, so nothing refuses')
        },
        // THE CONTROL for R2: Marketplace coverage with NO premium entry is an
        // ordinary return and must still compute. Without this leaf a refusal
        // that fired on every Form 1095-A would pass the one above.
        marketplaceCoverageWithNoPremiumEntryStillComputes: () => {
            const stageOne = okStageOne(stageOneForHealthInsurance(
                profileCertifiedForHealthInsurance)(
                [nonemployeeCompensationDoc('50000.00')])([])([])(true)(0n))
            assertEq(stageOne.line17.value, 0n, 'nothing was claimed, so nothing refuses')
        },
        // R3 — two sources of self-employment earnings and no fact saying
        // which trade or business the plan is under. Form 7206's own header
        // note is what makes this a refusal rather than a sum.
        twoBusinessesRefuseBecauseNothingSaysWhichOneThePlanIsUnder: () => {
            const result = refusal(stageOneForHealthInsurance(
                profileCertifiedForHealthInsurance)(
                [nonemployeeCompensationDoc('50000.00')])([partnershipK1Doc('80000.00')])([
                    premiumEntry('selfEmployedHealthInsuranceMedicalDentalVision')('9600.00')(
                        'taxpayer'),
                ])(false)(0n))
            assert(
                result.message.includes('TWO sources'),
                ['the refusal must say what is ambiguous', result.message])
            assert(
                result.message.includes('Form 7206 line 4')
                && result.message.includes('line 5'),
                ['and the two printed lines that disagree', result.message])
            // The two figures must both be PRINTED, so a reader can see which
            // pair of businesses the engine could not choose between.
            assert(
                result.message.includes('50000.00') && result.message.includes('80000.00'),
                ['and both amounts', result.message])
        },
        // THE CONTROL for R3: each source ALONE computes. A partnership K-1 is
        // as good a §162(l) business as a Schedule C, and a refusal that fired
        // on either alone would pass the leaf above.
        eitherSourceOfSelfEmploymentEarningsAloneComputes: () => {
            const scheduleC = okStageOne(soleProprietorWithPremiums('50000.00')([
                premiumEntry('selfEmployedHealthInsuranceMedicalDentalVision')('900.00')(
                    'taxpayer'),
            ]))
            const k1 = okStageOne(stageOneForHealthInsurance(
                profileCertifiedForHealthInsurance)([])([partnershipK1Doc('80000.00')])([
                    premiumEntry('selfEmployedHealthInsuranceMedicalDentalVision')('900.00')(
                        'taxpayer'),
                ])(false)(0n))
            assertEq(scheduleC.line17.value, 90000n, '$900.00 off a Schedule C')
            assertEq(k1.line17.value, 90000n, 'and $900.00 off a partnership K-1')
        },
        // R4 — premiums with no self-employment net profit at all. The zero
        // this engine would otherwise report is right for a taxpayer with no
        // trade or business and wrong for the two it does not model.
        premiumsWithNoSelfEmploymentAtAllRefuseRatherThanReportingAZero: () => {
            const result = refusal(stageOneForHealthInsurance(
                profileCertifiedForHealthInsurance)([])([])([
                    premiumEntry('selfEmployedHealthInsuranceMedicalDentalVision')('9600.00')(
                        'taxpayer'),
                ])(false)(0n))
            assert(
                result.message.includes('S-corporation') && result.message.includes('line 11'),
                ['the refusal must name the path it cannot compute', result.message])
            assert(
                result.message.includes('Rev. Rul. 91-26'),
                ['and the authority behind it', result.message])
            assert(
                result.message.includes('Schedule F'),
                ['and the other unmodeled trade or business', result.message])
        },
        // R5 — one person, two age bands. Form 7206 line 2(b) caps by "the
        // person's age at the end of the tax year", and one person has one age.
        twoAgeBandsForOnePersonRefuseNamingBothCaps: () => {
            const result = refusal(soleProprietorWithPremiums('50000.00')([
                premiumEntry('selfEmployedLongTermCareAgeFiftyOneToSixty')('1000.00')('taxpayer'),
                premiumEntry('selfEmployedLongTermCareAgeSixtyOneToSeventy')('1000.00')('taxpayer'),
            ]))
            assert(
                result.message.includes('taxpayer') && result.message.includes('age bands'),
                ['the refusal must name whose bands disagree', result.message])
            // The two CAPS are what makes the ambiguity worth refusing, and
            // printing them is the part a reader can act on.
            assert(
                result.message.includes('1800.00') && result.message.includes('4810.00'),
                ['and both caps the choice would select between', result.message])
        },
        // THE CONTROL for R5: two people in two DIFFERENT bands is not a
        // contradiction, it is the ordinary married couple. Without it, a check
        // that refused any two distinct bands anywhere would pass the leaf above.
        twoPeopleInTwoDifferentBandsIsNotAContradiction: () => {
            const joint = {
                documentHash: 'profile-hash-7206-joint-b',
                value: {
                    ...profileCertifiedForHealthInsurance.value,
                    filingStatus: 'marriedFilingJointly',
                },
            }
            const stageOne = okStageOne(stageOneForHealthInsurance(joint)(
                [nonemployeeCompensationDoc('50000.00')])([])([
                    premiumEntry('selfEmployedLongTermCareAgeFiftyOneToSixty')('5000.00')(
                        'taxpayer'),
                    premiumEntry('selfEmployedLongTermCareAgeSixtyOneToSeventy')('5000.00')(
                        'spouse'),
                ])(false)(0n))
            assertEq(stageOne.line17.value, 661000n, '$1,800.00 + $4,810.00 = $6,610.00')
        },
        // The tag vocabulary is CLOSED, and a near-miss tag is refused by name
        // rather than silently contributing nothing to the deduction.
        aMisspeltPremiumTagIsRefusedByNameRatherThanDropped: () => {
            const result = refusal(soleProprietorWithPremiums('50000.00')([
                premiumEntry('selfEmployedHealthInsurance')('9600.00')('taxpayer'),
            ]))
            assert(
                result.message.includes("'selfEmployedHealthInsurance'"),
                ['the unrecognized tag must be named', result.message])
            assert(
                result.message.includes('selfEmployedHealthInsuranceMedicalDentalVision'),
                ['and the vocabulary must list the one that was meant', result.message])
        },
        // A premium paid in the FOLLOWING calendar year belongs on the
        // following year's return. §162(l) has no designation rule of the kind
        // §223 and §219(f)(3) have, so none of these six tags is on
        // `followingYearContributionTags` — asserted here rather than left to
        // be noticed, because the omission is invisible.
        aPremiumPaidInTheFollowingYearIsRefused: () => {
            const result = refusal(soleProprietorWithPremiums('50000.00')([{
                lineTag: 'selfEmployedHealthInsuranceMedicalDentalVision',
                datePaid: '2026-01-15',
                description: 'January premium',
                amount: '800.00',
                individual: 'taxpayer',
            }]))
            assert(
                result.message.includes('2026-01-15'),
                ['the refusal must name the date', result.message])
            for (const [tag] of longTermCareTagBands) {
                assert(
                    !followingYearContributionTags.includes(tag),
                    ['no §162(l) tag may be designated for the prior year', tag])
            }
            assert(!followingYearContributionTags.includes(medicalDentalVisionTag))
        },
    },

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
        const { box1UnemploymentCompensation: _dropped, ...withoutBox1 } = unemploymentA.value
        const withholdingOnly = {
            documentHash: 'sha256-1099g-c',
            value: withoutBox1,
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
        // ── Line 5: Schedule E line 41 (Phase 30, TAX-35) ────────────────
        //
        // **The regression property first.** With no Schedule K-1 at all,
        // line 5 is the documented zero it has always been, citing the
        // profile's `declaredKinds` box alone — the same value, the same
        // source count and the same box path as before this phase. That is
        // what says a return without pass-through income computes exactly
        // what it computed before Schedule E existed.
        lineFiveIsStillAProfileCitedZeroWithNoScheduleK1: () => {
            const partI = okPartI(partIOf(profileNoDeclaredKinds)([])([])([]))
            assertEq(partI.line5.value, 0n)
            assertEq(partI.line5.sources.length, 1)
            assertEq(partI.line5.sources[0].boxPath, 'declaredKinds')
            assertEq(partI.scheduleE.partII.rows.length, 0)
            assertEq(partI.line10.value, 0n, 'and the Part I total is unmoved')
        },
        // **CRITERION 2**: box 1 reaches 1040 line 8 through Schedule E line
        // 41 and Schedule 1's OWN Part I total, never by a side channel.
        //
        //   K-1 (1065) box 1                                 $80,000.00
        //   Sch E line 28(j)  nonpassive income               $80,000.00
        //   Sch E line 32     line 30 + line 31               $80,000.00
        //   Sch E line 41     lines 26+32+37+39+40            $80,000.00
        //   Sch 1 line 5                                      $80,000.00
        //   Sch 1 line 10     (nothing else on Part I)        $80,000.00
        lineFiveIsScheduleELineFortyOneAndReachesLineTen: () => {
            const withK1 = okPartI(scheduleOnePartI(taxParams2025)({
                status: 'single',
                form1040Line7aCents: 0n,
                form2555Line45Cents: 0n,
                assetRegisters: [],
                rentalProperties: [],
                farmForms: [],
                profile: profileNoDeclaredKinds,
                unemploymentForms: [],
                nonemployeeCompensationForms: [],
                businessExpenseForms: [],
                w2Forms: [],
                partnershipK1Forms: [partnershipK1Doc('80000.00')],
                sCorporationK1Forms: [],
                estateTrustK1Forms: [],
            }))
            assertEq(withK1.scheduleE.parts.line41.value, 8000000n, 'Schedule E line 41')
            assertEq(withK1.line5.value, 8000000n, 'Schedule E line 41 IS Schedule 1 line 5')
            assertEq(withK1.line10.value, 8000000n, 'and it reaches the Part I total')
            assertEq(withK1.scheduleE.partII.rows.length, 1)
            // The hard zero is REPLACED: line 5 cites the Schedule K-1 box it
            // read, and its rule names where the figure came from.
            const paths = withK1.line5.sources.map(source => source.boxPath)
            assert(
                paths.includes('box1OrdinaryBusinessIncome'),
                ['line 5 must cite the Schedule K-1 box it read', paths])
            assert(
                withK1.line5.rule.includes('Schedule E line 41'),
                ['line 5 must name where it came from', withK1.line5.rule])
        },
        // **Line 3 and line 5 are DIFFERENT lines fed by DIFFERENT documents**,
        // and line 10 is their sum. A wiring that put Schedule E's total on
        // line 3, or Schedule C's on line 5, would leave line 10 identical —
        // which is exactly why the two are asserted separately here.
        //
        //   line 3  Schedule C net profit                       $260.00
        //   line 5  Schedule E line 41                       $80,000.00
        //   line 10 260.00 + 80,000.00                       $80,260.00
        linesThreeAndFiveAreDistinctAndBothReachTheTotal: () => {
            const partI = okPartI(scheduleOnePartI(taxParams2025)({
                status: 'single',
                form1040Line7aCents: 0n,
                form2555Line45Cents: 0n,
                assetRegisters: [],
                rentalProperties: [],
                farmForms: [],
                profile: profileNoDeclaredKinds,
                unemploymentForms: [],
                nonemployeeCompensationForms: [nonemployeeCompensationDoc('350.00')],
                businessExpenseForms: [businessDoc([advertisingEntry('90.00')])],
                w2Forms: [],
                partnershipK1Forms: [partnershipK1Doc('80000.00')],
                sCorporationK1Forms: [],
                estateTrustK1Forms: [],
            }))
            assertEq(partI.line3.value, 26000n, 'Schedule C: $350.00 - $90.00 = $260.00')
            assertEq(partI.line5.value, 8000000n, 'Schedule E: $80,000.00')
            assertEq(partI.line10.value, 8026000n, '$260.00 + $80,000.00 = $80,260.00')
        },
        // A Schedule E refusal must reach a Part I caller rather than being
        // swallowed, exactly as Schedule C's does. A LOSS is the refusal most
        // likely to be met in practice.
        aScheduleERefusalPropagatesOutOfPartOne: () => {
            const result = refusal(scheduleOnePartI(taxParams2025)({
                status: 'single',
                form1040Line7aCents: 0n,
                form2555Line45Cents: 0n,
                assetRegisters: [],
                rentalProperties: [],
                farmForms: [],
                profile: profileNoDeclaredKinds,
                unemploymentForms: [],
                nonemployeeCompensationForms: [],
                businessExpenseForms: [],
                w2Forms: [],
                partnershipK1Forms: [partnershipK1Doc('-9000.00')],
                sCorporationK1Forms: [],
                estateTrustK1Forms: [],
            }))
            assert(
                result.message.includes('§704(d)'),
                ['the Schedule E loss refusal must reach Schedule 1 unchanged', result.message])
        },
    },

    // ── Line 15 for a PARTNER rather than a proprietor (Phase 30) ────────────
    passThroughSelfEmployment: {
        /**
         * **THE WAGE-BASE COORDINATION FOR A PARTNER**, and the leaf that
         * makes `selfEmployedRecipientTin` observable at all.
         *
         * Before Phase 30 the only source of a proprietor TIN was a
         * `vnd.fjs.business_expenses` record. A partner has none — their
         * self-employment income arrives on a Schedule K-1 — so without
         * carrying the K-1's own `recipientTin` through, `socialSecurity\
         * WagesAlreadyTaxed` would be handed `undefined`, no Forms W-2 would
         * consume §1402(b)(1)'s base, and the tax would be OVERSTATED.
         *
         * A general partner with an $80,000.00 share and $150,000.00 of box 3
         * wages from a day job. Every figure hand-derived:
         *
         *   Sch SE line 4a   92.35% of $80,000.00              $73,880.00
         *   Sch SE line 8a   the day job's box 3              $150,000.00
         *   Sch SE line 9    176,100.00 - 150,000.00           $26,100.00
         *   Sch SE line 10   12.4% of the SMALLER, $26,100.00   $3,236.40
         *   Sch SE line 11   2.9% of $73,880.00, uncapped       $2,142.52
         *   Sch SE line 12   -> Schedule 2 line 4               $5,378.92
         *   Sch SE line 13   50% of $5,378.92                   $2,689.46
         *
         * **The answer with no attribution is $11,303.64**, because 12.4% of
         * the whole $73,880.00 is $9,161.12 rather than $3,236.40. Both are
         * asserted, so a wiring that never carried the K-1's recipient lands
         * on the second and says so — a $5,924.72 error.
         */
        aPartnersWagesConsumeTheWageBaseToo: () => {
            const shared = okStageOne(stageOneWithPassThrough(profileNoDeclaredKinds)('single')(
                [partnershipK1Doc('80000.00')])([])([
                w2WithSocialSecurityWages('sha256-w2-day-job')('222-22-2222')('150000.00'),
            ]))
            assertEq(shared.selfEmployment.lines.line2, 8000000n, 'Sch SE line 2 = box 14 code A')
            assertEq(shared.selfEmployment.lines.line4a, 7388000n, '$73,880.00')
            assertEq(shared.selfEmployment.lines.line8a, 15000000n, '$150,000.00 of box 3')
            assertEq(shared.selfEmployment.lines.line9, 2610000n, '$26,100.00 of base left')
            assertEq(shared.selfEmployment.lines.line10, 323640n, '$3,236.40')
            assertEq(shared.selfEmployment.lines.line11, 214252n, '$2,142.52, uncapped')
            assertEq(shared.selfEmployment.lines.line12, 537892n, '$5,378.92 of tax')
            assertEq(shared.line15.value, 268946n, 'line 15 = $2,689.46')
            // THE ANSWER WITH NO ATTRIBUTION, hand-computed: 12.4% of the
            // whole $73,880.00 is $9,161.12, which with the $2,142.52
            // Medicare portion is $11,303.64 -- $5,924.72 more tax than is
            // owed.
            assertEq(7388000n * 1240n / 10000n, 916112n, 'no sharing: $9,161.12')
            assertEq(916112n + 214252n, 1130364n, 'no sharing: $11,303.64 of tax')
            // ...and line 15's sources include the W-2 box the sharing read.
            const paths = shared.line15.sources.map(source => source.boxPath)
            assert(
                paths.includes('box3SocialSecurityWages'),
                ['line 15 must cite the wages that consumed the base', paths])
        },
        /**
         * **TWO different people with self-employment income on one return.**
         * A Schedule K-1 is a SECOND source of it, so this case could not
         * arise before Phase 30 — `fjs/schedule/c` refuses a second business
         * record, and one record named one person.
         *
         * Schedule SE is filed per person and this engine computes one, so a
         * spouse's Schedule C beside a partner's K-1 refuses by name rather
         * than being merged into one line 6 that would shelter the second
         * person's earnings behind the first's already-consumed base.
         */
        aSpousesScheduleCBesideAPartnersKOneRefuses: () => {
            const outcome = stageOneWithPassThrough(profileJoint)('marriedFilingJointly')(
                [partnershipK1Doc('80000.00')])([spouseBusinessDoc])([])
            assert(outcome.kind === 'error', ['two self-employed people must refuse', outcome])
            assert(outcome.message.includes('333-33-3333'), ['the proprietor', outcome.message])
            assert(outcome.message.includes('222-22-2222'), ['the partner', outcome.message])
            assert(outcome.message.includes('§1402(b)(1)'), [outcome.message])
            assert(outcome.message.includes('$400'), [outcome.message])
        },
        /**
         * THE CONTROL: the SAME two records naming the SAME person compute.
         * A proprietor who also holds a partnership stake is ordinary, and
         * their Schedule C profit and their box 14 code A are both on printed
         * Schedule SE line 2.
         *
         *   Sch C line 31    $350.00 - $90.00                     $260.00
         *   K-1 box 14 A                                       $80,000.00
         *   Sch SE line 2    260.00 + 80,000.00                 $80,260.00
         *   Sch SE line 4a   92.35% of $80,260.00               $74,120.11
         *     8,026,000 x 9,235 = 74,120,110,000; / 10,000 = 7,412,011 exactly
         */
        oneProprietorWhoIsAlsoAPartnerAddsBothToLineTwo: () => {
            const partI = okPartI(scheduleOnePartI(taxParams2025)({
                status: 'single',
                form1040Line7aCents: 0n,
                form2555Line45Cents: 0n,
                assetRegisters: [],
                rentalProperties: [],
                farmForms: [],
                profile: profileNoDeclaredKinds,
                unemploymentForms: [],
                nonemployeeCompensationForms: [nonemployeeCompensationDoc('350.00')],
                businessExpenseForms: [businessDoc([advertisingEntry('90.00')])],
                w2Forms: [],
                partnershipK1Forms: [partnershipK1Doc('80000.00')],
                sCorporationK1Forms: [],
                estateTrustK1Forms: [],
            }))
            const stageOne = okStageOne(scheduleOnePartIIExceptStudentLoanInterest(taxParams2025)({
                form2555ExclusionCents: 0n,
                profile: profileNoDeclaredKinds,
                interestForms: [],
                ...noSocialSecurityInteraction,
                totalIncomeExceptTaxableSocialSecurityLine: noOtherIncomeLine,
                status: 'single',
                adjustmentForms: [],
                w2Forms: [],
                businessNetProfit: partI.scheduleC.partII.line31,
                farmNetProfit: partI.scheduleF.line34,
                businessExpenseForms: [businessDoc([advertisingEntry('90.00')])],
                passThrough: passThroughOf(partI.scheduleE),
            }))
            assertEq(stageOne.selfEmployment.lines.line2, 8026000n, '$260.00 + $80,000.00')
            assertEq(stageOne.selfEmployment.lines.line4a, 7412011n, '$74,120.11')
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
        // The vocabulary check `hsaCoverageTypeNamed` exists for. §223(b)
        // sets ONE limit per coverage type and this engine stores two, so a
        // third spelling has no limit to apply and the return refuses by
        // name. `vnd.fjs.adjustments`' own `checkReferences` refuses it at
        // storage too — this is the second layer, and it is written because
        // `scheduleOnePartIIExceptStudentLoanInterest` takes a
        // `Stored<Adjustments>` whose `coverageType` is a plain `string` and
        // nothing in its signature says the document was validated. Silently
        // computing no HSA deduction for a filer who has one is the outcome
        // this refusal exists to prevent.
        anUnrecognizedCoverageTypeIsRefusedNamingIt: () => {
            const result = refusal(partIIOf(profileNoDeclaredKinds)('single')(
                [adjustmentsDoc([hsaEntry('2000.00')('taxpayer')])(
                    [fullYearCoverage('taxpayer')('highDeductible')])])([])([])(0n))
            assert(
                result.message.includes("'highDeductible'"),
                ['must quote the coverage type it could not price', result.message],
            )
            assert(
                result.message.includes('§223(b)'),
                ['must name the limit it has none of', result.message],
            )
            assert(
                result.message.includes('Schedule 1 line 13'),
                ['must name the line that could not be computed', result.message],
            )
        },
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
        // Box 1 is OPTIONAL on the stored 1098-E — `fjs/document/1098e`
        // proves an absent one stays absent — and a servicer files a
        // statement for the loan, not for an amount. Such a form contributes
        // NO transcribed source and NO amount, while the servicer beside it
        // still does. Paired that way on purpose: with the box-1-less form
        // alone the citation list would be empty for two different reasons
        // and the leaf could not tell them apart.
        aFormWithNoBoxOneContributesNeitherAmountNorCitation: () => {
            const withBoxOne = oneZeroNineEightEDoc('1842.63')
            const { box1StudentLoanInterestReceived: _absent, ...withoutBoxOne } = withBoxOne.value
            const result = okPartII(partIIOf(profileNoDeclaredKinds)('single')([])([
                withBoxOne,
                { documentHash: 'sha256-1098e-b', value: withoutBoxOne },
            ])([])(1000000n))
            assertEq(result.line21.value, 184263n, '$1,842.63 — the second form adds nothing')
            const transcribed = result.line21.sources.filter(
                source => source.boxPath === 'box1StudentLoanInterestReceived')
            assertEq(transcribed.length, 1, 'one box 1 citation: the form that HAS a box 1')
            assertEq(transcribed[0]?.documentHash, 'sha256-1098e-a')
            assert(
                result.line21.sources.every(source => source.documentHash !== 'sha256-1098e-b'),
                ['an absent box is ABSENT, never a zero citation', result.line21.sources],
            )
            // The whole citation, hand-typed: that one box 1, the filing
            // status the threshold turns on, and total income's own source.
            assertEq(result.line21.sources.length, 3)
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
    // ── Line 20: the traditional IRA deduction (§219) ───────────────────────
    //
    // Every expected value below is a hand-typed cent literal with its dollar
    // figure in the assertion message, computed off Publication 590-A
    // Worksheet 1-2's printed lines and never derived from the code under
    // test. Value and citation are asserted by SEPARATE leaves.
    //
    // **The base fixture has no contribution at all**, so every leaf states
    // the entries it is about, and a leaf that stopped supplying them would
    // fall to `$0.00` rather than quietly inheriting somebody else's.
    lineTwentyIsAProfileCitedZeroWithNoContribution: () => {
        const stageOne = okStageOne(stageOneForIra(iraBaseFixture))
        assertEq(stageOne.line20.value, 0n, 'no traditional IRA contribution at all')
        assertEq(stageOne.line20.sources.length, 1, 'the profile citation only')
        assertEq(
            stageOne.line20.sources[0]?.boxPath, 'declaredKinds',
            'a computed zero cites the profile, never a document the taxpayer lacks')
    },
    // Publication 590-A Table 1-3: "single, head of household, or qualifying
    // surviving spouse … any amount … a full deduction". §219(g)(1) reduces
    // the limit only for an ACTIVE PARTICIPANT, so a filer with no Form W-2
    // box 13 takes the whole contribution at $200,000.00 of wages — an income
    // that would phase the deduction to nothing if the box were checked.
    aFilerWithNoWorkplacePlanDeductsInFullAtAnyIncome: () => {
        assertEq(
            lineTwentyOf({
                ...iraBaseFixture,
                wages: '200000.00',
                entries: [iraEntry('traditionalIraContribution')('7000.00')],
            }),
            700000n,
            '$7,000.00 — §219(g)(1) never applies to a taxpayer who is not an active participant')
    },
    // The other half of the same fact: check ONE box on the same return and
    // the deduction vanishes. $200,000.00 is far above $89,000.00.
    theSameReturnWithBoxThirteenCheckedDeductsNothing: () => {
        assertEq(
            lineTwentyOf({
                ...iraBaseFixture,
                wages: '200000.00',
                coveredByWorkplacePlan: true,
                entries: [iraEntry('traditionalIraContribution')('7000.00')],
            }),
            0n,
            '$0.00 — completely phased out above §219(g)(3)(B)(ii)’s $89,000.00')
    },
    // ── The boundary pairs, all at ±1 cent ──────────────────────────────────
    //
    // **The $79,000.00 threshold itself is NOT one of them, and that is a
    // property of the printed page rather than a gap.** At exactly the
    // threshold `w3` equals the whole range, and the phased limit is then
    // `range x limit / range` = the limit — so the "stop, take the full
    // deduction" branch and the arithmetic agree by construction, at every
    // input, for both candidate dollar limits. One cent OVER the threshold
    // still yields the full $8,000.00, because $9,999.99 x 80% = $7,999.99
    // rounds UP to the next $10. That is the same surprise
    // `theOneCentOverTheThresholdCase` records for line 21, and it is why the
    // threshold is pinned by the leaf below instead: $79,012.50 is the first
    // cent at which the limit actually falls.
    oneCentOverTheThresholdStillTakesTheFullDeduction: () => {
        /** @type {(wages: string) => bigint} */
        const at = wages => lineTwentyOf({
            ...iraBaseFixture,
            wages,
            coveredByWorkplacePlan: true,
            entries: [iraEntry('traditionalIraContributionAgeFiftyOrOver')('8000.00')],
        })
        assertEq(at('79000.00'), 800000n, '$8,000.00 at the threshold exactly')
        assertEq(at('79000.01'), 800000n,
            '$8,000.00 one cent over — $9,999.99 x 80% = $7,999.99, rounded up to the next $10')
    },
    // The threshold, pinned where it is observable. $89,000.00 - $9,987.50 =
    // $79,012.50 is the first modified AGI whose 80% product is a multiple of
    // $10 below the full limit. Shifting `phaseoutThreshold.single` by a cent
    // moves the end point and reddens both halves.
    thePhaseOutFirstBitesAtSeventyNineThousandAndTwelveFifty: () => {
        /** @type {(wages: string) => bigint} */
        const at = wages => lineTwentyOf({
            ...iraBaseFixture,
            wages,
            coveredByWorkplacePlan: true,
            entries: [iraEntry('traditionalIraContributionAgeFiftyOrOver')('8000.00')],
        })
        assertEq(at('79012.49'), 800000n, '$9,987.51 x 80% = $7,990.008, up to $8,000.00')
        assertEq(at('79012.50'), 799000n, '$9,987.50 x 80% = $7,990.00 exactly, and it stays there')
    },
    // **Added after a mutation.** Shifting `phaseoutThreshold.headOfHousehold`
    // by one cent reddened the two `fjs/tax/params` leaves and NOTHING ELSE:
    // every behavioural leaf above is a `single` filer, so head of household
    // had a stored figure no computation was observed to read. This is that
    // observation — the same $79,012.50 pair, one status over.
    theHeadOfHouseholdRowIsReadAndIsTheSameAsSingles: () => {
        /** @type {(wages: string) => bigint} */
        const at = wages => lineTwentyOf({
            ...iraBaseFixture,
            status: 'headOfHousehold',
            wages,
            coveredByWorkplacePlan: true,
            entries: [iraEntry('traditionalIraContributionAgeFiftyOrOver')('8000.00')],
        })
        assertEq(at('79012.49'), 800000n, '$9,987.51 x 80% = $7,990.008, up to $8,000.00')
        assertEq(at('79012.50'), 799000n, 'and $7,990.00 one cent later — the same row as `single`')
    },
    // **Also added after a mutation**, and for the same reason one status
    // over: shifting `phaseoutThreshold.marriedFilingSeparately` from $0.00
    // to $0.01 reddened only the parameter leaves. The fixture below is the
    // one place §219(g)(3)(B)(iii)'s $0 is load-bearing on a VALUE: at
    // $6,500.00 of modified AGI the surviving range is $3,500.00, 80% of
    // which is $2,800.00 exactly — one cent of threshold moves it to
    // $2,810.00.
    theMarriedFilingSeparatelyZeroThresholdIsReadAsAThreshold: () => {
        assertEq(
            lineTwentyOf({
                ...iraBaseFixture,
                status: 'marriedFilingSeparately',
                mfsLivedWithSpouseAtAnyTimeInYear: true,
                coveredByWorkplacePlan: true,
                wages: '6500.00',
                entries: [iraEntry('traditionalIraContributionAgeFiftyOrOver')('3000.00')],
            }),
            280000n,
            '$10,000.00 - $6,500.00 = $3,500.00 of range, x 80% = $2,800.00')
    },
    // §219(g)(2)(C) rounds the REDUCTION down, which rounds the surviving
    // limit UP — Publication 590-A Worksheet 1-2 line 4's own example is
    // "$611.40 is rounded to $620". The pair below is that rule and its
    // exact-multiple neighbour: a "next LOWEST $10" implementation gives
    // $480.00 on the first half, which the leaf names so its failure says
    // which direction went wrong.
    theRoundingIsToTheNextHighestTenDollars: () => {
        /** @type {(wages: string) => bigint} */
        const at = wages => lineTwentyOf({
            ...iraBaseFixture,
            wages,
            coveredByWorkplacePlan: true,
            entries: [iraEntry('traditionalIraContributionAgeFiftyOrOver')('8000.00')],
        })
        assertEq(at('88388.25'), 49000n, '$611.75 x 80% = $489.40, UP to $490.00')
        assert(at('88388.25') !== 48000n, 'rounding to the next LOWEST $10 would give $480.00')
        assertEq(at('88387.50'), 49000n, '$612.50 x 80% = $490.00 exactly, and a ceiling leaves it')
    },
    // §219(g)(2)(B): "No dollar limitation shall be reduced below $200 …
    // unless … reduced to zero." $88,750.00 is the exact cent where 80% of
    // the remaining range first reaches $200.00.
    theTwoHundredDollarFloorBoundary: () => {
        /** @type {(wages: string) => bigint} */
        const at = wages => lineTwentyOf({
            ...iraBaseFixture,
            wages,
            coveredByWorkplacePlan: true,
            entries: [iraEntry('traditionalIraContributionAgeFiftyOrOver')('8000.00')],
        })
        assertEq(at('88749.99'), 21000n, '$250.01 x 80% = $200.008, up to $210.00')
        assertEq(at('88750.00'), 20000n, '$250.00 x 80% = $200.00 — the floor, reached exactly')
    },
    // …and the cliff the floor creates: one cent below the end point the
    // deduction is $200.00, and at the end point it is nothing at all. A
    // phased deduction is NEVER between $1 and $199.
    theCompletePhaseOutIsACliffFromTwoHundredDollarsToZero: () => {
        /** @type {(wages: string) => bigint} */
        const at = wages => lineTwentyOf({
            ...iraBaseFixture,
            wages,
            coveredByWorkplacePlan: true,
            entries: [iraEntry('traditionalIraContributionAgeFiftyOrOver')('8000.00')],
        })
        assertEq(at('88999.99'), 20000n, '$0.01 of range left, floored to $200.00')
        assertEq(at('89000.00'), 0n, '$89,000.00 — "stop here; your contributions aren’t deductible"')
    },
    // ── §219(b)(1)(B), the compensation cap ─────────────────────────────────
    theDeductionCannotExceedCompensation: () => {
        assertEq(
            lineTwentyOf({
                ...iraBaseFixture,
                wages: '2000.00',
                entries: [iraEntry('traditionalIraContribution')('7000.00')],
            }),
            200000n,
            '$2,000.00 of Form W-2 box 1 caps a $7,000.00 contribution')
    },
    // The control, and the sharper case: a return with no compensation at all
    // deducts nothing, and it is a DOCUMENT-cited zero rather than the
    // profile-cited one, because the taxpayer really did assert a
    // contribution.
    aReturnWithNoCompensationDeductsNothingAndStillCitesTheEntry: () => {
        const stageOne = okStageOne(stageOneForIra({
            ...iraBaseFixture,
            wages: undefined,
            entries: [iraEntry('traditionalIraContribution')('5000.00')],
        }))
        assertEq(stageOne.line20.value, 0n, 'no compensation includible in gross income')
        assert(
            !stageOne.line20.sources.some(source => source.boxPath === 'declaredKinds'),
            ['the entry was read, so the entry is what is cited', stageOne.line20.sources])
    },
    // ── §219(b)(5)(B)(ii), the catch-up nobody can look up ──────────────────
    //
    // The three-way decision this line exists to get right, as three leaves:
    // the contribution at or below the base limit computes with no assertion
    // at all, the contribution above it REFUSES, and the same contribution
    // with the age asserted computes.
    aContributionWithinTheBaseLimitNeedsNoAgeAtAll: () => {
        assertEq(
            lineTwentyOf({
                ...iraBaseFixture,
                entries: [iraEntry('traditionalIraContribution')('7000.00')],
            }),
            700000n,
            '$7,000.00 — the age cannot change an answer bounded by the contribution')
    },
    aContributionAboveTheBaseLimitRefusesRatherThanGuessingTheAge: () => {
        const result = refusal(stageOneForIra({
            ...iraBaseFixture,
            entries: [iraEntry('traditionalIraContribution')('8000.00')],
        }))
        // `centsToString` emits no thousands separator, so the substring
        // asserted is the one the message really carries; the human figure
        // stays in the assertion's own message.
        assert(result.message.includes('$7000.00'),
            ['the refusal must name the under-50 figure, $7,000.00', result.message])
        assert(result.message.includes('$8000.00'),
            ['and the age-50 figure, $8,000.00', result.message])
        assert(result.message.includes('§219(b)(5)(B)(ii)'),
            ['and the subsection that creates the difference', result.message])
        assert(result.message.includes('traditionalIraContributionAgeFiftyOrOver'),
            ['and the tag that would answer it — a refusal a reader can act on', result.message])
    },
    theSameContributionWithTheAgeAssertedComputes: () => {
        assertEq(
            lineTwentyOf({
                ...iraBaseFixture,
                entries: [iraEntry('traditionalIraContributionAgeFiftyOrOver')('8000.00')],
            }),
            800000n,
            '$8,000.00 — $7,000.00 plus §219(b)(5)(B)(ii)’s $1,000.00')
    },
    // **The catch-up matters INSIDE the phase-out at any contribution size**,
    // because the surviving limit is proportional to the dollar amount: 70%
    // of the remaining range under 50, 80% at 50 or over. A "refuse only
    // above $7,000.00" rule would have shipped a silent $700.00 error here.
    thePhaseOutMakesTheAgeMatterBelowTheBaseLimitToo: () => {
        /** @type {IraFixture} */
        const covered = {
            ...iraBaseFixture, wages: '82000.00', coveredByWorkplacePlan: true,
        }
        const unasserted = refusal(stageOneForIra({
            ...covered, entries: [iraEntry('traditionalIraContribution')('7000.00')],
        }))
        assert(unasserted.message.includes('$4900.00'),
            ['$7,000.00 of range x 70% = $4,900.00, the under-50 figure', unasserted.message])
        assert(unasserted.message.includes('$5600.00'),
            ['$7,000.00 of range x 80% = $5,600.00, the age-50 figure', unasserted.message])
        assertEq(
            lineTwentyOf({
                ...covered, entries: [iraEntry('traditionalIraContributionAgeFiftyOrOver')('7000.00')],
            }),
            560000n,
            '$5,600.00, and the contribution is only $7,000.00 — well under either dollar limit')
    },
    // ── Filing status ───────────────────────────────────────────────────────
    //
    // Notice 2024-80 puts a qualifying surviving spouse on the JOINT row
    // ("filing a joint return or as a qualifying widow(er)"), which is the
    // OPPOSITE of what §3101(b)(2) does with the same status in
    // `fjs/tax/params`. The two rows are $47,000.00 apart, so the same
    // fixture under the two statuses is the sharpest possible statement of
    // it: $6,400.00 against nothing at all.
    aQualifyingSurvivingSpouseReadsTheJointRowAndASingleFilerDoesNot: () => {
        /** @type {IraFixture} */
        const fixture = {
            ...iraBaseFixture,
            wages: '130000.00',
            coveredByWorkplacePlan: true,
            entries: [iraEntry('traditionalIraContributionAgeFiftyOrOver')('8000.00')],
        }
        assertEq(
            lineTwentyOf({ ...fixture, status: 'qualifyingSurvivingSpouse' }), 640000n,
            '$16,000.00 of range x 40% ($8,000.00 / $20,000.00) = $6,400.00')
        assertEq(
            lineTwentyOf({ ...fixture, status: 'single' }), 0n,
            '$130,000.00 is past a single filer’s $89,000.00 end point entirely')
    },
    // §219(g)(4): a couple filing separately who "live apart at all times
    // during such taxable year" are "not … treated as married individuals for
    // purposes of this subsection", so the filer reads the SINGLE row. One
    // checkbox, $3,000.00 of deduction.
    marriedFilingSeparatelyLivingApartAllYearReadsTheSingleRow: () => {
        /** @type {IraFixture} */
        const fixture = {
            ...iraBaseFixture,
            status: 'marriedFilingSeparately',
            wages: '20000.00',
            coveredByWorkplacePlan: true,
            entries: [iraEntry('traditionalIraContribution')('3000.00')],
        }
        assertEq(
            lineTwentyOf({ ...fixture, mfsLivedWithSpouseAtAnyTimeInYear: true }), 0n,
            '$0.00 — §219(g)(3)(B)(iii)’s range is over by $10,000.00 of modified AGI')
        assertEq(
            lineTwentyOf({ ...fixture, mfsLivedWithSpouseAtAnyTimeInYear: false }), 300000n,
            '$3,000.00 — the whole contribution, on the $79,000.00 single row')
    },
    // ── The refusals, each with its control ─────────────────────────────────
    iraDeductionRefusals: {
        // The joint-return attribution gap — the same gap `fjs/form8880` and
        // this schedule's own line 13 already refuse, one line further up.
        aJointReturnCarryingAContributionRefuses: () => {
            const result = refusal(stageOneForIra({
                ...iraBaseFixture,
                status: 'marriedFilingJointly',
                entries: [iraEntry('traditionalIraContribution')('3000.00')],
            }))
            assert(result.message.includes('§219(f)(2)'),
                ['the refusal must name the "separately for each individual" rule', result.message])
            assert(result.message.includes('box 13'),
                ['and the box it cannot attribute', result.message])
            assert(result.message.includes('§219(g)(7)'),
                ['and the second range attributing it wrongly would swap in', result.message])
            assert(result.message.includes('Schedule 1 line 20'),
                ['and its own printed line', result.message])
        },
        // **The control that keeps the gate from refusing everything.** The
        // identical joint return with NO traditional IRA contribution
        // computes — which is the ordinary joint return, and refusing it
        // would be `fjs/form8880`'s own recorded mistake repeated.
        aJointReturnWithNoContributionComputes: () => {
            const stageOne = okStageOne(stageOneForIra({
                ...iraBaseFixture,
                status: 'marriedFilingJointly',
            }))
            assertEq(stageOne.line20.value, 0n, 'nothing to deduct, and nothing to refuse')
        },
        // A separate return carries no Form W-2 for the spouse, and
        // §219(g)(1) turns on whether "an individual OR THE INDIVIDUAL'S
        // SPOUSE is an active participant".
        marriedFilingSeparatelyLivingTogetherAndNotCoveredRefuses: () => {
            const result = refusal(stageOneForIra({
                ...iraBaseFixture,
                status: 'marriedFilingSeparately',
                mfsLivedWithSpouseAtAnyTimeInYear: true,
                coveredByWorkplacePlan: false,
                entries: [iraEntry('traditionalIraContribution')('3000.00')],
            }))
            assert(result.message.includes('§219(g)(1)'),
                ['the refusal must name the active-participant rule', result.message])
            assert(result.message.includes('$10,000'),
                ['and the range the missing fact decides', result.message])
        },
        // The control: the SAME return with the taxpayer's own box 13
        // checked computes, because §219(g)(3)(B)(iii)'s $0 applicable dollar
        // amount already applies and the spouse's status cannot make it
        // worse. So the refusal is narrow rather than "MFS is refused".
        marriedFilingSeparatelyLivingTogetherAndCoveredComputes: () => {
            assertEq(
                lineTwentyOf({
                    ...iraBaseFixture,
                    status: 'marriedFilingSeparately',
                    mfsLivedWithSpouseAtAnyTimeInYear: true,
                    coveredByWorkplacePlan: true,
                    wages: '5000.00',
                    entries: [iraEntry('traditionalIraContribution')('3000.00')],
                }),
                300000n,
                '$5,000.00 of range left x 70% = $3,500.00, and the contribution is $3,000.00')
        },
        // §219(f)(1)/§401(c)(2) earned income — three missing facts at once.
        selfEmploymentAlongsideAContributionRefuses: () => {
            const partI = okPartI(scheduleOnePartI(taxParams2025)({
                status: 'single',
                form1040Line7aCents: 0n,
                form2555Line45Cents: 0n,
                assetRegisters: [],
                rentalProperties: [],
                farmForms: [],
                profile: profileNoDeclaredKinds,
                unemploymentForms: [],
                nonemployeeCompensationForms: [nonemployeeCompensationDoc('40000.00')],
                businessExpenseForms: [businessDoc([advertisingEntry('1000.00')])],
                w2Forms: [],
                partnershipK1Forms: [],
                sCorporationK1Forms: [],
                estateTrustK1Forms: [],
            }))
            const result = refusal(scheduleOnePartIIExceptStudentLoanInterest(taxParams2025)({
                form2555ExclusionCents: 0n,
                profile: profileNoDeclaredKinds,
                status: 'single',
                adjustmentForms: [adjustmentsDoc(
                    [iraEntry('traditionalIraContribution')('3000.00')])([])],
                w2Forms: [],
                interestForms: [],
                ...noSocialSecurityInteraction,
                totalIncomeExceptTaxableSocialSecurityLine: noOtherIncomeLine,
                businessNetProfit: partI.scheduleC.partII.line31,
                farmNetProfit: partI.scheduleF.line34,
                businessExpenseForms: [businessDoc([advertisingEntry('1000.00')])],
                passThrough: noPassThrough,
            }))
            assert(result.message.includes('§401(c)(2)'),
                ['the refusal must name the earned-income definition', result.message])
            assert(result.message.includes('line 16'),
                ['and the unmodeled adjustment the worksheet subtracts', result.message])
            assert(result.message.includes('§219(b)(1)(B)'),
                ['and the cap it cannot compute', result.message])
        },
        // The control: the same self-employed return with NO contribution
        // computes exactly as it did before this line existed.
        selfEmploymentWithNoContributionComputes: () => {
            const stageOne = okStageOne(stageOneWithBusiness(profileNoDeclaredKinds)('single')(
                [nonemployeeCompensationDoc('40000.00')])(
                [businessDoc([advertisingEntry('1000.00')])])([]))
            assertEq(stageOne.line20.value, 0n, 'no contribution, so nothing to refuse')
            assert(stageOne.line15.value > 0n,
                ['and the self-employment half of the return is untouched', stageOne.line15.value])
        },
        // Publication 590-A's own named special case: a contribution AND a
        // distribution in the same year IS a fixed point, because the
        // taxable part of the distribution is recovered pro rata against a
        // year-end basis that includes this contribution's nondeductible
        // part — which is the contribution less this very line.
        aContributionAndADistributionInTheSameYearRefuses: () => {
            const result = refusal(stageOneForIra({
                ...iraBaseFixture,
                iraDistributionReceived: true,
                entries: [iraEntry('traditionalIraContribution')('3000.00')],
            }))
            assert(result.message.includes('590-B'),
                ['the refusal must name the worksheet it would need', result.message])
            assert(result.message.includes('fixed point'),
                ['and say which of the two interactions actually is one', result.message])
        },
        // The control: a distribution with no contribution computes. A
        // retiree taking required minimum distributions is the modal
        // retirement return, and refusing it would be the mistake
        // `fjs/form8880`'s docstring names.
        aDistributionWithNoContributionComputes: () => {
            const stageOne = okStageOne(stageOneForIra({
                ...iraBaseFixture,
                iraDistributionReceived: true,
            }))
            assertEq(stageOne.line20.value, 0n, 'nothing to deduct, and nothing to refuse')
        },
        // A Roth contribution is not deductible at all, and the CLOSED tag
        // vocabulary is what makes that a refusal by name rather than a
        // silent $7,000.00 deduction that does not exist.
        aRothContributionTagIsRefusedByName: () => {
            const result = refusal(stageOneForIra({
                ...iraBaseFixture,
                entries: [iraEntry('rothIraContribution')('7000.00')],
            }))
            assert(result.message.includes('rothIraContribution'),
                ['the refusal must name the tag it did not understand', result.message])
            assert(result.message.includes('traditionalIraContribution'),
                ['and list the vocabulary it does', result.message])
        },
    },
    // §219(f)(3): a contribution made after the close of the year and up to
    // the return due date counts for THIS year — how a large share of real
    // IRA contributions are made. The control is the tag beside it: an
    // educator expense paid in 2026 is a 2026 deduction and still refuses.
    aFollowingYearIraContributionIsAcceptedAndAnEducatorExpenseIsNot: () => {
        assertEq(
            lineTwentyOf({
                ...iraBaseFixture,
                entries: [{
                    ...iraEntry('traditionalIraContribution')('4000.00'),
                    datePaid: '2026-04-10',
                }],
            }),
            400000n,
            '$4,000.00 paid in April 2026 on account of tax year 2025')
        const result = refusal(stageOneForIra({
            ...iraBaseFixture,
            entries: [{ ...educatorEntry('300.00')('taxpayer'), datePaid: '2026-04-10' }],
        }))
        assert(result.message.includes('§219(f)(3)'),
            ['the refusal must name both exceptions it is NOT', result.message])
    },
    // ── The Publication 590-A Appendix B three-pass ordering ────────────────
    //
    // **This is the leaf the whole line turns on.** §219(g)(3)(A)(i)
    // determines adjusted gross income "after application of section 86", so
    // taxable Social Security benefits are inside the income the phase-out
    // runs against — computed by Appendix B Worksheet 1, which subtracts
    // Schedule 1 lines 11 through 20 EXCEPT line 20 itself.
    //
    // Single filer, covered, $60,000.00 of wages and $30,000.00 of benefits.
    // Worksheet 1, hand-computed from the printed page:
    //
    //   line 1 $30,000.00   line 2 $15,000.00 (half)
    //   line 3 $60,000.00   line 4 $0.00      line 5 $75,000.00
    //   line 6 $0.00 (no other adjustment)    line 7 $75,000.00
    //   line 8 $25,000.00 (single base)       line 9 $50,000.00
    //   line 10 $9,000.00  line 11 $41,000.00 line 12 $9,000.00
    //   line 13 $4,500.00  line 14 $4,500.00  line 15 $34,850.00 (85%)
    //   line 16 $39,350.00 line 17 $25,500.00 (85% of line 1)
    //   line 18 $25,500.00 -> taxable benefits for §219 purposes
    //
    // Modified AGI = $60,000.00 + $25,500.00 = $85,500.00, which is
    // $3,500.00 short of the $89,000.00 end point: $3,500.00 x 80% =
    // $2,800.00.
    taxableSocialSecurityBenefitsAreInsideThePhaseOutIncome: () => {
        /** @type {IraFixture} */
        const fixture = {
            ...iraBaseFixture,
            wages: '60000.00',
            coveredByWorkplacePlan: true,
            entries: [iraEntry('traditionalIraContributionAgeFiftyOrOver')('8000.00')],
        }
        assertEq(
            lineTwentyOf({ ...fixture, socialSecurityBenefits: '30000.00' }), 280000n,
            '$2,800.00 — $85,500.00 of modified AGI, $3,500.00 of range left, x 80%')
        assertEq(
            lineTwentyOf(fixture), 800000n,
            '$8,000.00 — the SAME return without the SSA-1099, at $60,000.00 of modified AGI')
    },
    // Line 20 reaches BOTH named adjustment totals — the Social Security
    // worksheet's "lines 11 through 20, and 23 and 25" and the student loan
    // worksheet's "lines 11 through 20 plus write-ins". Without this the line
    // could be computed correctly and dropped on the way to line 26.
    lineTwentyReachesBothAdjustmentTotals: () => {
        const stageOne = okStageOne(stageOneForIra({
            ...iraBaseFixture,
            entries: [iraEntry('traditionalIraContribution')('7000.00')],
        }))
        assertEq(socialSecurityWorksheetAdjustmentsTotal(stageOne), 700000n,
            'lines 11-20, 23, 25 with only line 20 non-zero')
        assertEq(studentLoanInterestWorksheetOtherAdjustments(stageOne), 700000n,
            'lines 11-20 plus write-ins on 24z, same single summand')
    },
    // PROV-02: the citation, asserted by its own leaf so a line that summed
    // correctly while citing nothing and one that cited correctly while
    // summing zero cannot be confused.
    lineTwentyCitesEveryDocumentItRead: () => {
        const stageOne = okStageOne(stageOneForIra({
            ...iraBaseFixture,
            wages: '82000.00',
            coveredByWorkplacePlan: true,
            entries: [iraEntry('traditionalIraContributionAgeFiftyOrOver')('7000.00')],
        }))
        const boxPaths = stageOne.line20.sources.map(source => source.boxPath)
        assert(
            boxPaths.includes('entries[lineTag=traditionalIraContributionAgeFiftyOrOver,individual=taxpayer]'),
            ['the contribution entry, with the tag that carried the age', boxPaths])
        assert(boxPaths.includes('box13RetirementPlan'),
            ['the Form W-2 box that made §219(g) apply at all', boxPaths])
        assert(boxPaths.includes('box1WagesTipsOtherCompensation'),
            ['the Form W-2 box that caps the deduction under §219(b)(1)(B)', boxPaths])
        assert(boxPaths.includes('filingStatus'),
            ['and the status that chose the §219(g)(3)(B) applicable dollar amount', boxPaths])
        assert(
            !boxPaths.includes('declaredKinds'),
            ['a line that read documents must not fall back to the profile', boxPaths])
    },
    // TAX-15's fourth named income measure, exercised on its own — the same
    // shape `studentLoanInterestPhaseoutIncomeIsNotBareAgi` gives the third.
    iraDeductionPhaseoutIncomeIsTotalIncomeLessTheOtherAdjustmentsPlusSection86: () => {
        assertEq(iraDeductionPhaseoutIncome(8600000n)(100000n)(0n), 8500000n)
        assertEq(iraDeductionPhaseoutIncome(6000000n)(0n)(2550000n), 8550000n)
        assertEq(iraDeductionPhaseoutIncome(0n)(0n)(0n), 0n)
        // It is NOT bare AGI: AGI would already have line 20 itself
        // subtracted, which is exactly what §219(g)(3)(A)(ii) removes.
        assert(
            iraDeductionPhaseoutIncome(8600000n)(100000n)(0n) !== 8600000n,
            'the other adjustments must actually be subtracted',
        )
        // …and it is not the student loan measure either: that one has no
        // §86 term at all.
        assert(
            iraDeductionPhaseoutIncome(6000000n)(0n)(2550000n)
                !== studentLoanInterestPhaseoutIncome(6000000n)(0n),
            'taxable Social Security benefits are inside this measure and not that one',
        )
    },
    // ── Line 18: penalty on early withdrawal of savings (§62(a)(9)) ─────────
    //
    // Every expected value below is a hand-typed cent literal with its dollar
    // figure in the assertion message, never derived from the sum under test.
    // Value and citation are asserted by SEPARATE leaves: a line that summed
    // correctly while citing nothing, and one that cited correctly while
    // summing zero, are different defects and a single leaf could not tell
    // them apart.
    lineEighteenSumsOneFormsEarlyWithdrawalPenalty: () => {
        const stageOne = okStageOne(stageOneWithInterest(
            [oneZeroNineNineIntPenaltyDoc('sha256-1099int-a')('250.00')]))
        assertEq(stageOne.line18.value, 25000n, '$250.00 forfeited interest')
    },
    lineEighteenSumsTwoFormsAndCitesEachOnce: () => {
        const stageOne = okStageOne(stageOneWithInterest([
            oneZeroNineNineIntPenaltyDoc('sha256-1099int-a')('250.00'),
            oneZeroNineNineIntPenaltyDoc('sha256-1099int-b')('75.50'),
        ]))
        assertEq(stageOne.line18.value, 32550n, '$250.00 + $75.50')
        assertEq(stageOne.line18.sources.length, 2, 'one source per contributing document')
        assertEq(
            stageOne.line18.sources.map(source => source.documentHash).join(','),
            'sha256-1099int-a,sha256-1099int-b',
            'both documents cited, in document order')
        for (const source of stageOne.line18.sources) {
            assertEq(source.boxPath, 'box2EarlyWithdrawalPenalty', 'the box that was read')
        }
    },
    // The presence-not-value rule, as two leaves. A box that is absent and a
    // box that is present and zero are the same NUMBER and different FACTS,
    // and only the citation tells them apart.
    lineEighteenWithNoFormIsAProfileCitedZero: () => {
        const stageOne = okStageOne(stageOneWithInterest([]))
        assertEq(stageOne.line18.value, 0n, 'no Form 1099-INT at all')
        assertEq(stageOne.line18.sources.length, 1, 'the profile citation only')
        assertEq(
            stageOne.line18.sources[0]?.boxPath, 'declaredKinds',
            'a computed zero cites the profile, never a document the taxpayer lacks')
    },
    lineEighteenWithAZeroBoxStillCitesTheDocument: () => {
        const stageOne = okStageOne(stageOneWithInterest(
            [oneZeroNineNineIntPenaltyDoc('sha256-1099int-a')('0.00')]))
        assertEq(stageOne.line18.value, 0n, 'a reported zero penalty')
        assertEq(stageOne.line18.sources.length, 1, 'the document, not the profile')
        assertEq(
            stageOne.line18.sources[0]?.boxPath, 'box2EarlyWithdrawalPenalty',
            'the form reported the box, so the form is what is cited')
    },
    // A Form 1099-INT that reports interest but no penalty must not be cited
    // by line 18 -- the filter is on box 2, not on the dialect.
    lineEighteenIgnoresAnInterestFormWithNoPenaltyBox: () => {
        const stageOne = okStageOne(stageOneWithInterest([
            oneZeroNineNineIntPenaltyDoc('sha256-1099int-a')(undefined),
            oneZeroNineNineIntPenaltyDoc('sha256-1099int-b')('40.00'),
        ]))
        assertEq(stageOne.line18.value, 4000n, 'only the form carrying box 2')
        assertEq(stageOne.line18.sources.length, 1, 'the other form is not cited')
        assertEq(
            stageOne.line18.sources[0]?.documentHash, 'sha256-1099int-b',
            'the form that reported a penalty')
    },
    // Line 18 reaches the adjustment totals. Without this the line could be
    // computed correctly and dropped on the way to line 26.
    lineEighteenReachesTheAdjustmentTotals: () => {
        const stageOne = okStageOne(stageOneWithInterest(
            [oneZeroNineNineIntPenaltyDoc('sha256-1099int-a')('250.00')]))
        assertEq(socialSecurityWorksheetAdjustmentsTotal(stageOne), 25000n,
            'lines 11-20, 23, 25 with only line 18 non-zero')
        assertEq(studentLoanInterestWorksheetOtherAdjustments(stageOne), 25000n,
            'lines 11-20 plus write-ins on 24z, same single summand')
    },
    theTwoAdjustmentTotalsAreSeparateRulesThatHappenToAgree: () => {
        const stageOne = okStageOne(scheduleOnePartIIExceptStudentLoanInterest(taxParams2025)({
            form2555ExclusionCents: 0n,
            profile: profileNoDeclaredKinds,
            interestForms: [],
            ...noSocialSecurityInteraction,
            totalIncomeExceptTaxableSocialSecurityLine: noOtherIncomeLine,
            status: 'single',
            passThrough: noPassThrough,
            adjustmentForms: [adjustmentsDoc([
                educatorEntry('300.00')('taxpayer'),
                hsaEntry('700.00')('taxpayer'),
            ])([fullYearCoverage('taxpayer')('selfOnly')])],
            w2Forms: [],
            farmNetProfit: noBusinessNetProfit(profileNoDeclaredKinds),
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

    // ── Line 14: moving expenses for Armed Forces members (Form 3903) ───────

    /**
     * **Form 3903 line 5 lands on Schedule 1 line 14.** A staff sergeant's
     * permanent change of station: $4,837.50 of household goods shipped,
     * $1,299.40 of driving and one night of lodging, $2,000.00 reimbursed by
     * the service and reported in Form W-2 box 12 code P.
     *
     * $4,837.50 + $1,299.40 = $6,136.90, less $2,000.00 = **$4,136.90**,
     * added and subtracted by hand from the printed page's own steps.
     */
    lineFourteenIsFormThreeNineZeroThreeLineFive: () => {
        const result = okPartII(movingPartII(profileCertifiedForMoving)(
            [movingTransportEntry('4837.50'), movingTravelEntry('1299.40')])(
            [w2WithMovingReimbursement('2000.00')]))
        assertEq(result.line14.value, 413690n, '$4,136.90 of moving expense deduction')
    },

    /**
     * The TWO tags are Form 3903's two printed expense lines, and each one
     * moves line 14 on its own. Asserted separately, at figures that cannot
     * be confused: a wiring that read one tag and dropped the other, or that
     * read one tag twice, produces a different number in every one of the
     * three cases below.
     */
    bothMovingTagsReachLineFourteenAndNeitherIsTheOther: () => {
        const shippedOnly = okPartII(movingPartII(profileCertifiedForMoving)(
            [movingTransportEntry('4837.50')])([]))
        assertEq(shippedOnly.line14.value, 483750n, '$4,837.50 shipped, nothing travelled')
        const travelledOnly = okPartII(movingPartII(profileCertifiedForMoving)(
            [movingTravelEntry('1299.40')])([]))
        assertEq(travelledOnly.line14.value, 129940n, '$1,299.40 travelled, nothing shipped')
        const both = okPartII(movingPartII(profileCertifiedForMoving)(
            [movingTransportEntry('4837.50'), movingTravelEntry('1299.40')])([]))
        assertEq(both.line14.value, 613690n, '$4,837.50 + $1,299.40 = $6,136.90, unreimbursed')
        // …and two entries under the SAME tag add, rather than the second
        // replacing the first: a move is billed in more than one invoice.
        const twoInvoices = okPartII(movingPartII(profileCertifiedForMoving)(
            [movingTransportEntry('4837.50'), movingTransportEntry('112.25')])([]))
        assertEq(twoInvoices.line14.value, 494975n, '$4,837.50 + $112.25 = $4,949.75')
    },

    /**
     * **Form 3903 line 4 is Form W-2 box 12 code P, and ONLY code P.** The
     * fixture carries `DD` and `PP` beside it, both larger than the code P
     * amount, so a prefix match (`PP`), an "any box 12 row" read or a
     * transposed code letter produces a number that is not merely wrong but
     * unmistakably wrong.
     *
     * $6,136.90 of expenses, less $2,000.00 of code P = $4,136.90. If `PP`'s
     * $9,999.00 were swallowed the form would REFUSE instead, so this leaf
     * would go red twice over.
     */
    onlyBoxTwelveCodePReducesLineFourteen: () => {
        const withDecoys = okPartII(movingPartII(profileCertifiedForMoving)(
            [movingTransportEntry('4837.50'), movingTravelEntry('1299.40')])(
            [w2WithMovingReimbursement('2000.00')]))
        assertEq(withDecoys.line14.value, 413690n, '$6,136.90 - $2,000.00 = $4,136.90')
        // The W-2 with the decoys and NO code P row at all: the same return
        // deducts the whole of line 3, which is what pins that the decoys
        // contribute nothing rather than happening to cancel.
        const noCodeP = okPartII(movingPartII(profileCertifiedForMoving)(
            [movingTransportEntry('4837.50'), movingTravelEntry('1299.40')])(
            [w2WithoutMovingReimbursement]))
        assertEq(noCodeP.line14.value, 613690n, 'codes DD and PP are not a moving reimbursement')
        // Case and whitespace: `fjs/document/w2` stores the code as printed.
        // `' p '` IS code P; `'PP'` above is not, and both halves of that
        // sentence are asserted, because a match loosened to a prefix passes
        // the first and fails the second.
        const lowerCase = okPartII(movingPartII(profileCertifiedForMoving)(
            [movingTransportEntry('4837.50'), movingTravelEntry('1299.40')])(
            [{
                documentHash: 'sha256-w2-p-lower',
                value: {
                    dialect: 'vnd.fjs.w2',
                    employerEIN: '11-1111111', employeeSSN: '222-22-2222', controlNumber: '',
                    taxYear: 2025, formRevision: '2025',
                    box12: [{ code: ' p ', amount: '2000.00' }],
                },
            }]))
        assertEq(lowerCase.line14.value, 413690n, "' p ' is the same printed box as 'P'")
        // Two Forms W-2 each carrying code P SUM — a service member with two
        // employers in the year, and the case a "read the first one" bug
        // cannot be told from a sum by any single-document fixture.
        const twoForms = okPartII(movingPartII(profileCertifiedForMoving)(
            [movingTransportEntry('4837.50'), movingTravelEntry('1299.40')])(
            [w2WithMovingReimbursement('2000.00'), {
                documentHash: 'sha256-w2-p-second',
                value: {
                    dialect: 'vnd.fjs.w2',
                    employerEIN: '33-3333333', employeeSSN: '222-22-2222', controlNumber: '',
                    taxYear: 2025, formRevision: '2025',
                    box12: [{ code: 'P', amount: '136.90' }],
                },
            }]))
        assertEq(twoForms.line14.value, 400000n, '$6,136.90 - ($2,000.00 + $136.90) = $4,000.00')
    },

    /**
     * **PROV-01/PROV-02:** line 14 cites the entries and the box 12 rows it
     * was built from, one `Source` per contributing entry, and does NOT fall
     * back to the profile's `declaredKinds` placeholder once a document
     * supplied a figure.
     */
    lineFourteenCitesEveryEntryAndEveryCodePBox: () => {
        const result = okPartII(movingPartII(profileCertifiedForMoving)(
            [movingTransportEntry('4837.50'), movingTravelEntry('1299.40')])(
            [w2WithMovingReimbursement('2000.00')]))
        const boxPaths = result.line14.sources.map(source => source.boxPath)
        assert(
            boxPaths.includes(
                'entries[lineTag=movingExpensesTransportationAndStorage,individual=taxpayer]'),
            ['line 14 must cite Form 3903 line 1', boxPaths])
        assert(
            boxPaths.includes(
                'entries[lineTag=movingExpensesTravelAndLodgingExcludingMeals,individual=taxpayer]'),
            ['line 14 must cite Form 3903 line 2', boxPaths])
        assert(boxPaths.includes('box12[code=P]'),
            ['line 14 must cite the W-2 BOX the reimbursement came from', boxPaths])
        assert(!boxPaths.includes('box12[code=DD]') && !boxPaths.includes('box12[code=PP]'),
            ['and cite no box that did not contribute', boxPaths])
        assert(!boxPaths.includes('declaredKinds'),
            ['a computed line 14 must not cite the profile placeholder', boxPaths])
        assert(
            result.line14.sources.some(source => source.documentHash === 'sha256-w2-p'),
            ['by the CAS hash a reader can look up', result.line14.sources])
        assertEq(result.line14.sources.length, 3,
            'two entries and one code P box, one Source each')
    },

    /**
     * **THE §217(g) GATE.** TCJA §11049 suspended §217 for everybody except
     * the case §217(g) leaves standing, and Form 3903's own pre-line checkbox
     * is where a filer certifies it. NO document this engine reads reports
     * active duty or a permanent change of station, so an uncertified return
     * carrying a moving expense REFUSES: computing it would deduct a civilian
     * move the law disallows, and zeroing it would silently drop a service
     * member's real deduction.
     *
     * A gate needs a control, and this one needs two — the identical
     * documents WITH the certification must compute, and a return with no
     * moving documents at all must not be refused for failing to certify
     * something it never claimed.
     */
    aMovingExpenseWithoutTheCertificationRefuses: () => {
        const uncertified = refusal(movingPartII(profileNoDeclaredKinds)(
            [movingTransportEntry('4837.50')])([]))
        assert(uncertified.message.includes('movingExpensesArmedForcesPermanentChangeOfStation'),
            ['name the field that would fix it', uncertified.message])
        assert(uncertified.message.includes('permanent change of station'),
            ['and the printed requirement it stands for', uncertified.message])
        assert(uncertified.message.includes('§217'),
            ['and the section that suspends the deduction for everyone else', uncertified.message])
        assert(uncertified.message.includes('Schedule 1 line 14'),
            ['and the line that cannot be computed', uncertified.message])

        // ── CONTROL 1: the same documents, certified, compute ──────────────
        const certified = okPartII(movingPartII(profileCertifiedForMoving)(
            [movingTransportEntry('4837.50')])([]))
        assertEq(certified.line14.value, 483750n, '$4,837.50, certified and deducted')

        // ── CONTROL 2: an ordinary return does not need to certify ─────────
        const noMove = okPartII(emptyPartII())
        assertEq(noMove.line14.value, 0n, 'no moving documents, no certification, no refusal')
    },

    /**
     * A Form W-2 box 12 code P reimbursement with NO expenses recorded beside
     * it is ALSO gated, and that is the half of the gate a naive wiring
     * misses. Code P is *excludable moving expense reimbursements paid
     * directly to a member of the Armed Forces* — it is money the return has
     * to account for whether or not the taxpayer entered what the move cost.
     */
    aCodePReimbursementAloneIsGatedToo: () => {
        const uncertified = refusal(movingPartII(profileNoDeclaredKinds)([])(
            [w2WithMovingReimbursement('2000.00')]))
        assert(uncertified.message.includes('box 12 code P'),
            ['name where the figure came from', uncertified.message])
        assert(uncertified.message.includes('movingExpensesArmedForcesPermanentChangeOfStation'),
            ['and the certification that is missing', uncertified.message])
        // CERTIFIED, it does not become a zero either: $2,000.00 reimbursed
        // against $0.00 of expenses is $2,000.00 of gross income on 1040 line
        // 1h, which this engine refuses. See the leaf below.
        const certified = refusal(movingPartII(profileCertifiedForMoving)([])(
            [w2WithMovingReimbursement('2000.00')]))
        assert(certified.message.includes('$2000.00'),
            ['the excess, named', certified.message])
        // CONTROL: the decoy-only W-2 carries no code P, so the same return
        // computes without either refusal.
        const noCodeP = okPartII(movingPartII(profileNoDeclaredKinds)([])(
            [w2WithoutMovingReimbursement]))
        assertEq(noCodeP.line14.value, 0n, 'codes DD and PP are not a moving reimbursement')
    },

    /**
     * **THE TRAP, threaded out of `fjs/form3903` VERBATIM.** When the service
     * reimbursed more than the move cost, the excess is gross income on 1040
     * **line 1h** — not a zero deduction, and not Schedule 1 line 8z. This
     * engine refuses 1040 line 1h (`otherEarnedIncome`), so the return cannot
     * be computed and says so, naming the amount and the destination.
     *
     * $2,400.00 + $600.00 = $3,000.00 of expenses against $4,500.00
     * reimbursed leaves a $1,500.00 excess, subtracted by hand.
     *
     * The assertions are about WHAT this schedule threads out, not that
     * something was refused: a wiring that caught the refusal and substituted
     * its own message, or a zero, would pass a bare `throw:` leaf.
     */
    aReimbursementExceedingTheMoveRefusesAsTaxableIncome: () => {
        const message = refusal(movingPartII(profileCertifiedForMoving)(
            [movingTransportEntry('2400.00'), movingTravelEntry('600.00')])(
            [w2WithMovingReimbursement('4500.00')])).message
        assert(message.includes('$1500.00'), ['name the excess amount', message])
        assert(message.includes('$3000.00'), ['and the line 3 it exceeded', message])
        assert(message.includes('line 1h'), ['name WHERE it would have gone', message])
        assert(message.includes('earned income'), ['and what that line is', message])
        assert(message.includes('8z'), ['and rule out the line it is not', message])
        assert(message.includes('UNDERSTATE'), ['and which way the error runs', message])
        assert(message.includes('Form 3903'), ['and the form that computed it', message])

        // ── THE CONTROL, at the printed boundary ──────────────────────────
        // $3,000.00 reimbursed against $3,000.00 of expenses is a ZERO
        // deduction and NOT a refusal: `i3903.pdf` reports the excess on line
        // 1h only "if the result is more than zero". One cent more refuses.
        const exactly = okPartII(movingPartII(profileCertifiedForMoving)(
            [movingTransportEntry('2400.00'), movingTravelEntry('600.00')])(
            [w2WithMovingReimbursement('3000.00')]))
        assertEq(exactly.line14.value, 0n, 'a perfectly reimbursed move: zero, computed')
        const oneCentOver = refusal(movingPartII(profileCertifiedForMoving)(
            [movingTransportEntry('2400.00'), movingTravelEntry('600.00')])(
            [w2WithMovingReimbursement('3000.01')]))
        assert(oneCentOver.message.includes('$0.01'),
            ['one cent of excess still has nowhere to go', oneCentOver.message])
        // …and one cent UNDER deducts one cent, which is the other side of
        // the same boundary.
        const oneCentUnder = okPartII(movingPartII(profileCertifiedForMoving)(
            [movingTransportEntry('2400.00'), movingTravelEntry('600.00')])(
            [w2WithMovingReimbursement('2999.99')]))
        assertEq(oneCentUnder.line14.value, 1n, '$3,000.00 - $2,999.99 = $0.01')
    },

    /**
     * Line 14 must actually REACH the line 26 total that becomes 1040 line
     * 10 — a line 14 that computes correctly and never lands in the total
     * would leave the return overstated with every leaf above green.
     *
     * A DIFFERENCE rather than two absolute figures, so it cannot fail for a
     * reason that has nothing to do with this line.
     */
    lineFourteenReachesTheLineTwentySixTotal: () => {
        const withMove = okPartII(movingPartII(profileCertifiedForMoving)(
            [movingTransportEntry('4837.50'), movingTravelEntry('1299.40')])(
            [w2WithMovingReimbursement('2000.00')]))
        const without = okPartII(movingPartII(profileCertifiedForMoving)([])([]))
        assertEq(withMove.line26.value - without.line26.value, 413690n,
            'the whole of line 14 must reach line 26')
        assertEq(withMove.line26.value - without.line26.value, withMove.line14.value)
        assertEq(without.line14.value, 0n, 'and the control deducts nothing')
    },

    /**
     * The CONTROL for every leaf above, and the assertion `line14` gave up
     * when it left {@link partIILinesStillDocumentedZero}: with no moving
     * documents, line 14 is still a documented zero citing the profile's own
     * `declaredKinds` box, exactly as it was before Form 3903 was wired.
     */
    lineFourteenIsADocumentedZeroWithoutMovingDocuments: () => {
        const result = okPartII(emptyPartII())
        assertEq(result.line14.value, 0n)
        assertEq(result.line14.sources.length, 1, 'only the profile')
        assertEq(result.line14.sources[0].boxPath, 'declaredKinds')
        // And the rule names Form 3903 even when nothing was claimed, so a
        // reader of the report can see what the line would have read.
        assert(result.line14.rule.includes('Form 3903'),
            ['the rule must name the form', result.line14.rule])
    },

    /**
     * The two moving tags are in the CLOSED vocabulary, so a near-miss tag is
     * refused BY NAME rather than silently contributing nothing — the
     * `rothIraContribution` property, at the tag a taxpayer is most likely to
     * invent. `movingExpenses` alone does not say which printed Form 3903
     * line it is, and the two are not interchangeable: only line 2 carries
     * the meals exclusion.
     */
    aNearMissMovingTagIsRefusedByName: () => {
        const result = refusal(movingPartII(profileCertifiedForMoving)([{
            lineTag: 'movingExpenses',
            datePaid: '2025-07-14',
            description: 'the move',
            amount: '4837.50',
            individual: 'taxpayer',
        }])([]))
        assert(result.message.includes("'movingExpenses'"),
            ['name the tag that was not understood', result.message])
        assert(result.message.includes('movingExpensesTransportationAndStorage'),
            ['and offer the vocabulary', result.message])
        assert(result.message.includes('movingExpensesTravelAndLodgingExcludingMeals'),
            ['both halves of it', result.message])
    },

    /**
     * A moving expense paid in the year AFTER the tax year is refused, like
     * every adjustment on this schedule but an HSA (§223) or IRA (§219(f)(3))
     * contribution. There is no §217 provision deeming a moving expense paid
     * in the following year to have been paid in this one, and a March 2026
     * shipment is a 2026 deduction that nothing downstream could notice.
     */
    aMovingExpensePaidInTheFollowingYearIsRefused: () => {
        const result = refusal(movingPartII(profileCertifiedForMoving)([{
            ...movingTransportEntry('4837.50'),
            datePaid: '2026-03-02',
        }])([]))
        assert(result.message.includes('2026-03-02'), ['name the date', result.message])
        assert(result.message.includes('AFTER'), ['and what is wrong with it', result.message])
        // CONTROL: the same expense inside the tax year computes.
        const inYear = okPartII(movingPartII(profileCertifiedForMoving)(
            [movingTransportEntry('4837.50')])([]))
        assertEq(inYear.line14.value, 483750n, '$4,837.50 paid in 2025')
    },

    /**
     * **Line 14 reaches the §221 student loan interest worksheet's "other
     * adjustments" line — added after a mutation.** Dropping
     * `partII.line14.value` from {@link studentLoanInterestWorksheetOtherAdjustments}
     * left the whole suite green: the worksheet's line 3 is "lines 11 through
     * 20 plus write-ins", line 14 is inside that range, and no fixture
     * anywhere carried BOTH student loan interest and a moving expense.
     *
     * $86,000.00 of income with $1,000.00 of moving expenses subtracted
     * lands the worksheet's line 4 at exactly $85,000.00 — §221(b)(2)(B)'s
     * single threshold — so line 6 is zero and the $1,842.63 of interest is
     * deducted IN FULL. Drop line 14 from line 3 and line 4 is $86,000.00,
     * line 6 is $1,000.00, and the deduction is phased. The boundary is the
     * point: a one-dollar error in line 3 is visible in line 21.
     */
    lineFourteenReachesTheStudentLoanInterestWorksheetOtherAdjustments: () => {
        const result = okPartII(partIIOf(profileCertifiedForMoving)('single')(
            [adjustmentsDoc([movingTransportEntry('1000.00')])([])])(
            [oneZeroNineEightEDoc('1842.63')])([])(8600000n))
        assertEq(result.line14.value, 100000n, '$1,000.00 of moving expenses')
        assertEq(result.studentLoanInterestWorksheet.w3, 100000n,
            'worksheet line 3 — the other adjustments, which are line 14 alone here')
        assertEq(result.studentLoanInterestWorksheet.w4, 8500000n, '$86,000.00 - $1,000.00')
        assertEq(result.studentLoanInterestWorksheet.w6, 0n, 'exactly at the threshold, nothing over')
        assertEq(result.line21.value, 184263n,
            '$1,842.63 deducted in full, because line 14 was subtracted first')
        // THE CONTROL: the identical return with NO moving expense sits one
        // thousand dollars higher and IS phased, so the leaf above cannot
        // pass by the phase-out never biting.
        const without = okPartII(partIIOf(profileCertifiedForMoving)('single')([])(
            [oneZeroNineEightEDoc('1842.63')])([])(8600000n))
        assertEq(without.studentLoanInterestWorksheet.w6, 100000n, '$86,000.00 - $85,000.00')
        assert(without.line21.value < 184263n,
            ['without line 14 the deduction is phased', without.line21.value])
    },

    /**
     * **Line 14 reaches Publication 590-A Appendix B Worksheet 1's line 6 —
     * added after a mutation.** Dropping `line14.value` from
     * `adjustmentsBeforeIraDeductionCents` left the whole suite green. That
     * figure is the "adjustments other than the IRA deduction" the worksheet
     * subtracts before computing taxable Social Security benefits, and those
     * benefits are §219(g)(3)'s modified adjusted gross income — so a moving
     * expense moves the IRA deduction TWICE, once directly and once through
     * the benefits.
     *
     * Single filer covered by a workplace plan: $48,000.00 of wages,
     * $40,000.00 of SSA-1099 box 5, a $7,000.00 traditional IRA contribution
     * and $2,000.00 of moving expenses. Hand-computed from the printed
     * worksheets:
     *
     *   Worksheet 1  line 1 $40,000.00   line 2 $20,000.00 (half)
     *                line 3 $48,000.00   line 4 $0.00   line 5 $68,000.00
     *                line 6 $2,000.00 <- Schedule 1 line 14, the figure at issue
     *                line 7 $66,000.00   line 8 $25,000.00 (single base)
     *                line 9 $41,000.00   line 10 $9,000.00
     *                line 11 $32,000.00  line 12 $9,000.00  line 13 $4,500.00
     *                line 14 $4,500.00   line 15 $27,200.00 (85% of line 11)
     *                line 16 $31,700.00  line 17 $34,000.00 (85% of line 1)
     *                line 18 $31,700.00 — the 85% cap does NOT bind here,
     *                which is exactly what makes line 6 observable
     *   §219(g)(3) modified AGI
     *                $48,000.00 + $31,700.00 - $2,000.00 = $77,700.00
     *   $77,700.00 is BELOW §219(g)(3)(B)'s $79,000.00, so there is no
     *   phase-out and the whole $7,000.00 is deductible.
     *
     * Drop line 14 from worksheet line 6 and line 18 becomes $33,400.00,
     * modified AGI becomes $79,400.00 — inside the range — and the deduction
     * is phased.
     */
    lineFourteenReachesThePublicationFiveNineZeroAWorksheetOneAdjustments: () => {
        const withMove = okStageOne(stageOneForMovingAndIra(
            [iraContributionEntry('7000.00'), movingTransportEntry('2000.00')]))
        assertEq(withMove.line14.value, 200000n, '$2,000.00 of moving expenses')
        assertEq(withMove.line20.value, 700000n,
            'the whole $7,000.00, because modified AGI is $77,700.00 — under $79,000.00')

        // ── THE CONTROL ───────────────────────────────────────────────────
        // The identical return with NO moving expense has a modified AGI of
        // $81,400.00, which IS inside §219(g)(3)(B)'s range — and there the
        // §219(b)(5)(B)(ii) age question changes the answer, so the schedule
        // refuses rather than guessing. Two facts at once: the phase-out
        // genuinely bites at this income, and the moving deduction is what
        // takes this return out of it.
        const withoutMove = refusal(stageOneForMovingAndIra([iraContributionEntry('7000.00')]))
        assert(withoutMove.message.includes('$5320.00'),
            ['$7,000.00 x 76% — the phased deduction under 50', withoutMove.message])
        assert(withoutMove.message.includes('§219(b)(5)(B)(ii)'),
            ['refused because the age changes a PHASED answer', withoutMove.message])
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
        assertEq(
            partIILinesStillDocumentedZero.length, 9,
            'sixteen Part II lines, less 11/13/14/15/17/21/26')
        /** @type {Record<string, ReportLine>} */
        const byName = {
            line12: result.line12,
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
            form1040Line7aCents: 0n,
            assetRegisters: [],
            rentalProperties: [],
            farmForms: [],
            profile: profileNoDeclaredKinds,
            interestForms: [],
            ...noSocialSecurityInteraction,
            totalIncomeExceptTaxableSocialSecurityLine: noOtherIncomeLine,
            status: 'single',
            unemploymentForms: [unemploymentA],
            nonemployeeCompensationForms: [],
            businessExpenseForms: [],
            partnershipK1Forms: [],
            sCorporationK1Forms: [],
            estateTrustK1Forms: [],
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
            form1040Line7aCents: 0n,
            assetRegisters: [],
            rentalProperties: [],
            farmForms: [],
            profile: profileNoDeclaredKinds,
            interestForms: [],
            ...noSocialSecurityInteraction,
            totalIncomeExceptTaxableSocialSecurityLine: noOtherIncomeLine,
            status: 'single',
            unemploymentForms: [],
            nonemployeeCompensationForms: [],
            businessExpenseForms: [],
            partnershipK1Forms: [],
            sCorporationK1Forms: [],
            estateTrustK1Forms: [],
            adjustmentForms: [adjustmentsDoc([educatorEntry('250.00')('spouse')])([])],
            studentLoanInterestForms: [],
            w2Forms: [],
            totalIncomeLine: totalIncomeOf(0n),
        })
        assert(
            composed.kind === 'error' && composed.message.includes('spouse')
                && composed.message.includes('single')
                && composed.message.includes('classroom supplies'),
            ['the stage-1 refusal must arrive whole, not merely as some error', composed],
        )
    },

    // ...and so must a PART I refusal, which reaches the composition through
    // a different arm: Part I runs first, so nothing downstream of it has
    // been computed when it stops. A partnership K-1 reporting a $9,000.00
    // loss is the cheapest such refusal — `fjs/schedule/e`'s three loss
    // limitations, named by §704(d).
    aPartOneRefusalPropagatesThroughTheComposedForm: () => {
        const composed = scheduleOne(taxParams2025)({
            form1040Line7aCents: 0n,
            assetRegisters: [],
            rentalProperties: [],
            farmForms: [],
            profile: profileNoDeclaredKinds,
            interestForms: [],
            ...noSocialSecurityInteraction,
            totalIncomeExceptTaxableSocialSecurityLine: noOtherIncomeLine,
            status: 'single',
            unemploymentForms: [],
            nonemployeeCompensationForms: [],
            businessExpenseForms: [],
            partnershipK1Forms: [partnershipK1Doc('-9000.00')],
            sCorporationK1Forms: [],
            estateTrustK1Forms: [],
            adjustmentForms: [],
            studentLoanInterestForms: [],
            w2Forms: [],
            totalIncomeLine: totalIncomeOf(0n),
        })
        assert(
            composed.kind === 'error' && composed.message.includes('§704(d)')
                && composed.message.includes('900000'),
            ['the Part I refusal must arrive whole, naming the section and the loss', composed],
        )
    },

    // ...and a PART II refusal, the third and last arm. A 1098-E with box 2
    // checked reports an INCOMPLETE box 1, and Part II refuses before line 21
    // is built. Three leaves rather than one because the three arms are three
    // separate `if`s in `scheduleOne`, and a composition that swallowed any
    // one of them would return a half-built schedule for a return this engine
    // has said it cannot compute.
    aPartTwoRefusalPropagatesThroughTheComposedForm: () => {
        const withBoxTwo = oneZeroNineEightEDoc('1842.63')
        const composed = scheduleOne(taxParams2025)({
            form1040Line7aCents: 0n,
            assetRegisters: [],
            rentalProperties: [],
            farmForms: [],
            profile: profileNoDeclaredKinds,
            interestForms: [],
            ...noSocialSecurityInteraction,
            totalIncomeExceptTaxableSocialSecurityLine: noOtherIncomeLine,
            status: 'single',
            unemploymentForms: [],
            nonemployeeCompensationForms: [],
            businessExpenseForms: [],
            partnershipK1Forms: [],
            sCorporationK1Forms: [],
            estateTrustK1Forms: [],
            adjustmentForms: [],
            studentLoanInterestForms: [{
                ...withBoxTwo,
                value: {
                    ...withBoxTwo.value,
                    box2ExcludesOriginationFeesAndCapitalizedInterest: true,
                },
            }],
            w2Forms: [],
            totalIncomeLine: totalIncomeOf(0n),
        })
        assert(
            composed.kind === 'error' && composed.message.includes('box 2')
                && composed.message.includes('origination fees')
                && composed.message.includes('sha256-1098e-a'),
            ['the Part II refusal must arrive whole, naming the box and the form', composed],
        )
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

    // ── Printed line 8p, and printed Form 461 behind it ────────────────────
    formFourSixtyOne: {
        /**
         * ★ **PRINTED LINE 8p IS ZERO BECAUSE FORM 461 SAID SO**, not because
         * no sub-line of line 8 is modeled. The empty return computes a whole
         * Form 461 whose line 16 is the bare threshold, and line 8p cites the
         * three Schedule 1 lines the aggregate was formed from.
         */
        anEmptyReturnComputesFormFourSixtyOneAndLineEightPIsZero: () => {
            const partI = partIWithoutBusiness(profileNoDeclaredKinds)([])
            assertEq(partI.line8p.value, 0n, 'no excess business loss')
            assert(partI.line8p.rule.includes('Form 461 line 16'),
                ['line 8p must name the form it came from', partI.line8p.rule])
            assertEq(partI.form461.line14, 0n, 'nothing on lines 1-8')
            assertEq(partI.form461.line15, 31300000n, 'the single threshold')
            assertEq(partI.form461.line16, 31300000n)
            assertEq(partI.form461.filed, false, 'and the form is not filed')
            assertEq(partI.line9.value, 0n, 'line 9 = the 8a-8z collapse plus 8p')
        },
        /**
         * ★ **1040 LINE 7a REACHES PRINTED FORM 461 LINE 3.** This is the one
         * wiring on this schedule that nothing else can observe: printed line 3
         * is added on printed line 9 and removed again on printed lines 10 and
         * 11, so it cancels to the cent in printed line 14 at every input —
         * mutating the argument to `0n` leaves the whole suite green. See the
         * comment at the call site for why it is threaded anyway.
         *
         * A $3,000.00 capital LOSS, i461: *"Losses from sales or exchanges of
         * capital assets are not included in the calculation of the total
         * deductions from your trades or businesses."*
         */
        theCapitalGainOrLossReachesPrintedFormFourSixtyOneLineThree: () => {
            const partI = okPartI(scheduleOnePartI(taxParams2025)({
                form2555Line45Cents: 0n,
                status: 'single',
                form1040Line7aCents: -300000n,
                assetRegisters: [],
                rentalProperties: [],
                farmForms: [],
                profile: profileNoDeclaredKinds,
                unemploymentForms: [],
                nonemployeeCompensationForms: [],
                businessExpenseForms: [],
                w2Forms: [],
                partnershipK1Forms: [],
                sCorporationK1Forms: [],
                estateTrustK1Forms: [],
            }))
            assertEq(partI.form461.line3, -300000n, '1040 line 7a, on printed line 3')
            assertEq(partI.form461.line9, -300000n, 'and into printed line 9')
            assertEq(partI.form461.line11, 300000n, 'removed on printed line 11, POSITIVE')
            assertEq(partI.form461.line14, 0n, 'so the trade-or-business net is untouched')
            // The joint threshold reaches printed line 15 from the STATUS this
            // schedule hands over, which is the second wiring here.
            const joint = okPartI(scheduleOnePartI(taxParams2025)({
                form2555Line45Cents: 0n,
                status: 'marriedFilingJointly',
                form1040Line7aCents: 0n,
                assetRegisters: [],
                rentalProperties: [],
                farmForms: [],
                profile: profileNoDeclaredKinds,
                unemploymentForms: [],
                nonemployeeCompensationForms: [],
                businessExpenseForms: [],
                w2Forms: [],
                partnershipK1Forms: [],
                sCorporationK1Forms: [],
                estateTrustK1Forms: [],
            }))
            assertEq(joint.form461.line15, 62600000n,
                'a JOINT return reaches printed line 15 with $626,000.00')
        },
        /**
         * ★ **THE TWO PHASES COMPOSE, AND THEY DO NOT TREAT THEIR TWO TERMS
         * THE SAME.** Form 461 (TAX-40) and Form 4797 (TAX-41) were written on
         * branches neither of which could see the other, and they meet exactly
         * here: printed Schedule 1 line 4 is Form 4797 line 18b, and printed
         * Form 461 line 4 is printed Schedule 1 line 4.
         *
         * Three claims, and each is a separate way the composition could have
         * been wrong:
         *
         * 1. **The ORDER.** Line 4 is formed before `form461` is called, and
         *    Form 461 reads the COMPUTED line rather than the caller's figure —
         *    which is why the unfiled case below is checked. A wiring that read
         *    `otherGainsOrLosses.lineEighteenBCents` directly would agree with
         *    this leaf on every other fixture and disagree on that one.
         * 2. **Line 4 survives Part II.** No `partTwoAdjustment` arm names it,
         *    because Form 4797 amounts ARE attributable to a trade or business —
         *    §1231 property is property used IN one. So it moves printed line 14
         *    cent for cent, in both directions.
         * 3. **Line 3 still cancels**, at the same magnitude. That contrast is
         *    the finding rather than a detail: see the call site's comment for
         *    why the capital arm was left unconditional even though Form 4797
         *    has made its stated premise false.
         */
        formFourSevenNineSevenLineFourMovesLineFourteenAndLineThreeStillCancels: () => {
            /** @type {Source} */
            const registerSource = {
                documentHash: 'sha256-4797-composed',
                boxPath: 'assets[0].disposal.grossSalesPrice',
                value: '50000.00',
            }
            /** @type {(filed: boolean) => (cents: bigint) => ScheduleOnePartI} */
            const withLineFour = filed => cents => okPartI(scheduleOnePartI(taxParams2025)({
                form2555Line45Cents: 0n,
                status: 'single',
                form1040Line7aCents: 0n,
                otherGainsOrLosses: {
                    filed,
                    lineEighteenBCents: cents,
                    sources: [registerSource],
                },
                assetRegisters: [],
                rentalProperties: [],
                farmForms: [],
                profile: profileNoDeclaredKinds,
                unemploymentForms: [],
                nonemployeeCompensationForms: [],
                businessExpenseForms: [],
                w2Forms: [],
                partnershipK1Forms: [],
                sCorporationK1Forms: [],
                estateTrustK1Forms: [],
            }))
            // 1. The order, and the two states `filed` distinguishes.
            const gain = withLineFour(true)(5000000n)
            assertEq(gain.line4.value, 5000000n, 'Form 4797 line 18b, on printed Schedule 1 line 4')
            assertEq(gain.form461.line4, 5000000n, 'and on printed Form 461 line 4')
            const unfiled = withLineFour(false)(5000000n)
            assertEq(unfiled.line4.value, 0n, 'no Form 4797 leaves line 4 a declared zero')
            assertEq(
                unfiled.form461.line4, 0n,
                'and Form 461 reads the COMPUTED line 4, never the caller\'s figure')
            // 2. Part II leaves it alone, so it reaches printed line 14 whole.
            assertEq(gain.form461.line9, 5000000n, 'printed line 9 combines lines 1 through 8')
            assertEq(gain.form461.line10, 0n, 'no Part II arm removes a Form 4797 amount')
            assertEq(gain.form461.line11, 0n)
            assertEq(gain.form461.line14, 5000000n, 'so it moves the trade-or-business net')
            const loss = withLineFour(true)(-5000000n)
            assertEq(loss.form461.line14, -5000000n, 'and an ORDINARY loss moves it the other way')
            assertEq(
                loss.form461.line16, 31300000n - 5000000n,
                'toward the threshold, which is what §461(l) measures')
            // 3. ★ THE CONTROL: the SAME magnitude on printed line 3 cancels.
            const capital = okPartI(scheduleOnePartI(taxParams2025)({
                form2555Line45Cents: 0n,
                status: 'single',
                form1040Line7aCents: 5000000n,
                assetRegisters: [],
                rentalProperties: [],
                farmForms: [],
                profile: profileNoDeclaredKinds,
                unemploymentForms: [],
                nonemployeeCompensationForms: [],
                businessExpenseForms: [],
                w2Forms: [],
                partnershipK1Forms: [],
                sCorporationK1Forms: [],
                estateTrustK1Forms: [],
            }))
            assertEq(capital.form461.line3, 5000000n, '1040 line 7a, on printed line 3')
            assertEq(capital.form461.line10, 5000000n, 'Part II removes the whole of it')
            assertEq(
                capital.form461.line14, 0n,
                'so the capital term cancels where the Form 4797 term did not')
            assertEq(capital.form461.line16, 31300000n, 'and the threshold is all that is left')
        },
    },

    // Every printed line is named -- a hand-typed count-guard so a line
    // silently dropped from `scheduleOne`'s return object is caught (AGENTS.md's
    // "hand-typed count" mutation-gate idiom).
    everyPrintedLineIsNamed: () => {
        const composed = scheduleOne(taxParams2025)({
            form1040Line7aCents: 0n,
            assetRegisters: [],
            rentalProperties: [],
            farmForms: [],
            profile: profileNoDeclaredKinds,
            interestForms: [],
            ...noSocialSecurityInteraction,
            totalIncomeExceptTaxableSocialSecurityLine: noOtherIncomeLine,
            status: 'single',
            unemploymentForms: [],
            nonemployeeCompensationForms: [],
            businessExpenseForms: [],
            partnershipK1Forms: [],
            sCorporationK1Forms: [],
            estateTrustK1Forms: [],
            adjustmentForms: [],
            studentLoanInterestForms: [],
            w2Forms: [],
            totalIncomeLine: totalIncomeOf(0n),
        })
        assert(composed.kind === 'ok', ['expected a computed schedule', composed])
        // 26 printed lines, plus line 8p -- the one lettered sub-line of the
        // 8a-8z group that has its own computation (Form 461 line 16, the
        // §461(l) excess business loss adjustment) -- plus the kind tag.
        const expectedFieldCount = 28
        assertEq(
            Object.keys(composed).length,
            expectedFieldCount,
            'expected exactly 26 named Schedule 1 fields, plus line 8p, plus the kind tag',
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
