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
 * **This section describes the state of this module up to Phase 25, and the
 * correction that follows it is the point of reading it.** Through Phase 24
 * the frozen `kindVocabulary` carried exactly TWO kinds for the whole of this
 * schedule: `scheduleThreeNonrefundableCredits` (Part I — the foreign tax
 * credit, the dependent care credit, education credits, the retirement
 * savings contributions credit, residential clean energy, energy-efficient
 * home improvements, and thirteen more sub-lines at line 6a-6z alone) and
 * `scheduleThreeRefundableCredits` (Part II — net premium tax credit, the
 * extension payment, excess Social Security withholding, the fuel tax credit,
 * and five more sub-lines at line 13a-13z). This engine had no per-line
 * dialect for ANY of Part I's credits. For the declared 65+/dependents/
 * itemizing profile Phase 13 targeted, research (13-RESEARCH.md §5) confirmed
 * **none of Schedule 3's lines were reachable by any input this engine
 * modeled**, with one partial exception addressed below (line 11).
 *
 * A taxpayer who genuinely claimed, say, the foreign tax credit and declared
 * `scheduleThreeNonrefundableCredits` could not have that real dollar figure
 * represented here — this module could only ever return `$0` for it.
 * Reclassifying either coarse kind would have let that real, undeclared
 * amount compute silently as `$0` — exactly TAX-16's failure mode. So both
 * coarse kinds stayed in `unmodeledKindRefusals` for the whole of Phase 13
 * (13-RESEARCH.md Open Question 2).
 *
 * ## Phase 25 (TAX-25/TAX-26) splits both coarse kinds
 *
 * The diagnosis above was exactly right, and the remedy for it was to stop
 * having a coarse kind rather than to keep describing one — the identical
 * move Phase 23 made on Schedule 2 and Phase 24 on Schedule 1 Part II. The
 * two coarse kinds are now TWELVE per-printed-line kinds, seven for Part I
 * and five for Part II, so what remains refused on this schedule is something
 * a taxpayer can be told rather than one sentence about coarseness.
 *
 * Two of the twelve are MODELED as of this phase, and both are on Part I:
 *
 * | Line | What it reads | Requirement |
 * |---|---|---|
 * | 3 education credits | `vnd.fjs.1098t` boxes 1/5 and `vnd.fjs.credits` students, through `fjs/form8863` | TAX-26 |
 * | 4 retirement savings contributions credit | Form W-2 box 12's nine deferral codes and `vnd.fjs.credits` contributions, through `fjs/form8880` | TAX-25 |
 *
 * **The hard zeros on those two lines are REPLACED, not supplemented** —
 * `fjs/schedule/1`'s own idiom: neither carries a `zero(...)` call at its
 * construction site, and on a return with real documents neither cites
 * `declaredKinds` at all. Every OTHER line on this schedule is still a
 * `profileDeclaredZeroLine`, and `fjs/return/scope` still refuses each of
 * them by its own name.
 *
 * ## One execution, THREE 1040 destinations — and the third is not on this
 * schedule
 *
 * `fjs/form8863` computes the refundable American Opportunity Credit (its
 * line 8) in the SAME execution that produces the nonrefundable education
 * credits (its line 19). The first reaches 1040 line 29 directly, never
 * through Schedule 3 at all; the second reaches Schedule 3 line 3 and thence
 * 1040 line 20. So this module returns the two form results BESIDE its own
 * sixteen lines, and `fjs/form1040/core` reads line 29 off THAT result rather
 * than making a second, independently stale call — exactly the arrangement
 * `fjs/schedule/2` already uses to hand `form8959.line24` up to 1040 line 25c.
 *
 * ## The ORDER of the three nonrefundable credits is a real rule, and it runs
 * through here
 *
 * §26 ranks the nonrefundable personal credits, and the printed Credit Limit
 * Worksheets are how that ranking is expressed. Three of them now interlock:
 *
 * 1. **Form 8863** is limited by 1040 line 18 less Schedule 3 lines 1 and 2
 *    (the foreign tax credit and the dependent care credit — both refused
 *    kinds, so both zero).
 * 2. **Form 8880** is limited by 1040 line 18 less Schedule 3 lines 1, 2 and
 *    **3** — so the education credits come out of the liability BEFORE the
 *    saver's credit sees it.
 * 3. **Schedule 8812's Credit Limit Worksheet A** is limited by 1040 line 18
 *    less Schedule 3 lines 1, 2, **3 and 4** — so both of this schedule's new
 *    credits come out before the child tax credit sees it.
 *
 * That third link is what made this phase touch `fjs/form8812`, whose own
 * worksheet line 2 was a hard-coded `0n` with a docstring explaining that
 * every Schedule 3 credit it could sum was unmodeled. It no longer is.
 *
 * **The chain is acyclic, and that is a fact about the printed forms rather
 * than a convenience.** Form 8880's own worksheet does NOT subtract 1040 line
 * 19; if it did, it and Schedule 8812's would be mutually defined and no
 * ordering would exist. §26 ranks each credit once, and the two printed
 * worksheets agree.
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
 * ROADMAP.md's Wave 5 finding paragraph) — and, as of Phase 25, a kind in
 * the frozen vocabulary DOES now express it: `excessSocialSecurityWithheld`,
 * whose remedy string in `fjs/return/scope` is the only one in that whole
 * table that says no form is missing. That sentence — "no kind in the frozen
 * vocabulary expresses it" — stood here until Phase 25 and is corrected
 * rather than deleted, because a docstring that quotes a finding inherits its
 * expiry (`fjs/schedule/1`'s own header records the same kind of correction).
 * What has NOT changed is the boundary itself: `line11` below is a
 * `profileDeclaredZeroLine` exactly
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
import { centsFromString } from '../../exact/module.f.js'
import { form8863 } from '../../form8863/module.f.js'
import { form8880 } from '../../form8880/module.f.js'
import { taxParamsByYear } from '../../tax/params/module.f.js'

/** @import { ReturnProfile } from '../../return/profile/module.f.js' */
/** @import { ReportLine, Source } from '../../report/line/module.f.js' */
/** @import { Credits } from '../../document/credits/module.f.js' */
/** @import { OneZeroNineEightT } from '../../document/1098t/module.f.js' */
/** @import { W2 } from '../../document/w2/module.f.js' */
/** @import { TaxParamSet, IndividualFilingStatus } from '../../tax/params/module.f.js' */
/** @import { Form8863Result, Form8863Student, EducationCreditElection } from '../../form8863/module.f.js' */
/** @import { Form8880Result, Form8880Person, Form8880Individual } from '../../form8880/module.f.js' */

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

/**
 * A line built from real document readings, falling back to
 * {@link profileDeclaredZeroLine} when NO document supplied one — mirrors
 * `fjs/schedule/1`'s own private `documentLine`. This is the helper that
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

// ── Reading the documents lines 3 and 4 need ────────────────────────────────

/**
 * **Form W-2 box 12's nine elective-deferral codes** — Form 8880 line 2's own
 * printed list: *"elective deferrals to a 401(k) or other qualified employer
 * plan, voluntary employee contributions, 501(c)(18)(D) plan contributions,
 * and contributions to an ABLE account by the designated beneficiary"*.
 *
 * | Code | Plan |
 * |---|---|
 * | D | §401(k) elective deferral |
 * | E | §403(b) elective deferral |
 * | F | §408(k)(6) salary reduction SEP |
 * | G | §457(b) deferred compensation |
 * | H | §501(c)(18)(D) plan |
 * | S | §408(p) SIMPLE retirement account |
 * | AA | designated Roth contribution under a §401(k) plan |
 * | BB | designated Roth contribution under a §403(b) plan |
 * | EE | designated Roth contribution under a governmental §457(b) plan |
 *
 * **Code W is deliberately absent**, and so are DD and every other code this
 * list does not name. W is an employer's health savings account contribution
 * — `fjs/schedule/1` reads it for a completely different line — and DD is
 * employer-sponsored health coverage, which is reportable, not taxable and
 * not deductible. A list that admitted either would credit money into a
 * retirement plan that never went near one.
 *
 * `expectedDeferralCodeCount` below is the hand-typed counterweight to every
 * loop that walks this list.
 */
export const electiveDeferralBox12Codes = /** @type {const} */ ([
    'D', 'E', 'F', 'G', 'H', 'S', 'AA', 'BB', 'EE',
])

/** {@link electiveDeferralBox12Codes} widened to plain strings, so the
 * membership question can be asked of the `string` a W-2's box-12 `code`
 * actually is — an ordinary widening ASSIGNMENT, never a cast.
 * @type {readonly string[]}
 */
const electiveDeferralCodeNames = electiveDeferralBox12Codes

/**
 * Every Form W-2 box 12 entry whose code is one of
 * {@link electiveDeferralBox12Codes}, as citable {@link Source}s.
 *
 * The code is matched case-insensitively after trimming, for
 * `fjs/schedule/1`'s own recorded reason: `fjs/document/w2` stores box 12's
 * code "as printed" and never interprets it, so `'d'` and `' D'` are the same
 * box while `'DD'` is emphatically not — which is why the comparison is on
 * the whole trimmed string rather than on a prefix.
 * @type {(w2s: readonly Stored<W2>[]) => readonly Source[]}
 */
const electiveDeferralSources = w2s => w2s.flatMap(form =>
    (form.value.box12 ?? [])
        .filter(entry => electiveDeferralCodeNames.includes(entry.code.trim().toUpperCase()))
        .map(entry => ({
            documentHash: form.documentHash,
            boxPath: `box12[code=${entry.code.trim().toUpperCase()}]`,
            value: entry.amount,
        })))

/**
 * The `contributionTag` values this module understands, each naming the
 * printed Form 8880 line it feeds. **The whole vocabulary, in one place**, so
 * a tag that is not on it is refused by name rather than silently
 * contributing nothing — `fjs/schedule/1`'s own `adjustmentLineTags`
 * precedent, and the reason `vnd.fjs.credits` keeps `contributionTag` a free
 * string.
 */
export const retirementContributionTags = /** @type {const} */ ([
    ['iraContribution', 'Form 8880 line 1'],
    ['ableAccountContribution', 'Form 8880 line 2'],
])

/** {@link retirementContributionTags}' tags alone, widened to plain strings.
 * @type {readonly string[]}
 */
const retirementContributionTagNames = retirementContributionTags.map(([tag]) => tag)

/**
 * Narrows an already-validated `individual` string to
 * {@link Form8880Individual} by FINDING it rather than asserting a predicate
 * over the incoming string — `fjs/schedule/1`'s own `hsaCoverageTypeNamed`
 * device, for the reason recorded there: the value that flows onward is the
 * one from this module's own list, not the one off the blob, and AGENTS.md
 * bans the cast that would otherwise be needed.
 * @type {(individual: string) => Form8880Individual | undefined}
 */
const individualNamed = individual =>
    individual === 'taxpayer' ? 'taxpayer'
        : individual === 'spouse' ? 'spouse'
            : undefined

/** The same device for `vnd.fjs.credits`' per-student credit ELECTION.
 * @type {(credit: string) => EducationCreditElection | undefined}
 */
const educationCreditElectionNamed = credit =>
    credit === 'americanOpportunity' ? 'americanOpportunity'
        : credit === 'lifetimeLearning' ? 'lifetimeLearning'
            : undefined

// ── Schedule 3 itself ───────────────────────────────────────────────────────

/**
 * All nine Part I fields (`line6` being the 6a-6z collapse) and seven
 * Part II fields (`line13` being the 13a-13z collapse). Every field is a
 * {@link ReportLine}.
 *
 * `form8863` and `form8880` are the two form results lines 3 and 4 came from,
 * carried out BESIDE the printed lines so a caller reads the refundable
 * American Opportunity Credit (Form 8863 line 8 -> 1040 line 29) and the
 * Credit Limit Worksheet inputs off the SAME execution — never a second,
 * independently stale one. `fjs/schedule/2` carries `form8959` out for
 * exactly this reason.
 * @typedef {{
 *   readonly kind: 'ok',
 *   readonly line1: ReportLine, readonly line2: ReportLine, readonly line3: ReportLine,
 *   readonly line4: ReportLine, readonly line5a: ReportLine, readonly line5b: ReportLine,
 *   readonly line6: ReportLine, readonly line7: ReportLine, readonly line8: ReportLine,
 *   readonly line9: ReportLine, readonly line10: ReportLine, readonly line11: ReportLine,
 *   readonly line12: ReportLine, readonly line13: ReportLine, readonly line14: ReportLine,
 *   readonly line15: ReportLine,
 *   readonly form8863: Form8863Result,
 *   readonly form8880: Form8880Result,
 * }} ScheduleThree
 */

/**
 * A case this module will not compute — everything `fjs/form8863` and
 * `fjs/form8880` refuse, threaded up unchanged, plus this module's own
 * unrecognized-tag refusal. The same shape `fjs/schedule/1` returns, so
 * `fjs/form1040/core` threads it through the error arm it already has.
 * @typedef {{ readonly kind: 'error', readonly message: string }} ScheduleThreeRefusal
 */

/** @typedef {ScheduleThree | ScheduleThreeRefusal} ScheduleThreeOutcome */

/**
 * Everything Schedule 3 reads.
 *
 * `line18Cents` is 1040 line 18 (the tax after Schedule 2 Part I), which both
 * Credit Limit Worksheets take as their own first line — so this module must
 * run AFTER line 18 and BEFORE `fjs/form8812`, whose own Credit Limit
 * Worksheet A subtracts this schedule's lines 3 and 4. See this module's own
 * docstring, "The ORDER of the three nonrefundable credits".
 * @typedef {{
 *   readonly profile: Stored<ReturnProfile>,
 *   readonly status: IndividualFilingStatus,
 *   readonly agiCents: bigint,
 *   readonly line18Cents: bigint,
 *   readonly w2Forms: readonly Stored<W2>[],
 *   readonly creditForms: readonly Stored<Credits>[],
 *   readonly tuitionForms: readonly Stored<OneZeroNineEightT>[],
 *   readonly aStored1099RProvesADistribution: boolean,
 * }} ScheduleThreeInput
 */

/**
 * The sum of one PRESENT money box across a set of {@link Source}s.
 * @type {(sources: readonly Source[]) => bigint}
 */
const sumSources = sources => sources.reduce((total, s) => total + centsFromString(s.value), 0n)

/**
 * Computes Schedule 3 for one return, or refuses by name.
 *
 * Lines 3 and 4 read real documents (TAX-25/TAX-26, Phase 25); every other
 * line is a `profileDeclaredZeroLine` and every other Schedule 3 kind is an
 * `fjs/return/scope` refusal, so declaring one refuses the WHOLE return at
 * the scope layer before this function ever runs.
 * @type {(taxParamSet: TaxParamSet) => (input: ScheduleThreeInput) => ScheduleThreeOutcome}
 */
export const scheduleThree = taxParamSet => input => {
    const {
        profile, status, agiCents, line18Cents, w2Forms, creditForms, tuitionForms,
        aStored1099RProvesADistribution,
    } = input
    const zero = profileDeclaredZeroLine(profile)
    const fromDocuments = documentLine(profile)

    // ── Line 3: the education credits, through Form 8863 ─────────────────
    //
    // A stored 1098-T is matched to a `vnd.fjs.credits` student BY the
    // student's TIN, never by assuming the taxpayer -- `fjs/document/1098t`'s
    // own header records why: §25A(f)(1)(A) reaches a dependent's expenses,
    // so a parent's return carries a 1098-T whose student is the child.
    //
    // A 1098-T with NO matching student entry is deliberately ignored rather
    // than refused. Holding the form is not claiming the credit: the election
    // between the two credits lives on the student entry and only the
    // taxpayer can make it, so a form for a student this return does not
    // claim belongs on somebody else's return (commonly the student's own).
    /** @type {readonly { readonly documentHash: string, readonly value: NonNullable<Credits['educationStudents']>[number] }[]} */
    const storedStudents = creditForms.flatMap(form =>
        (form.value.educationStudents ?? []).map(value => ({ documentHash: form.documentHash, value })))
    /** @type {Source[]} */
    const educationSources = []
    /** @type {Form8863Student[]} */
    const students = []
    for (const stored of storedStudents) {
        const credit = educationCreditElectionNamed(stored.value.credit)
        if (credit === undefined) {
            return {
                kind: 'error',
                message: `Schedule 3 line 3: the credits document elects '${stored.value.credit}' for `
                    + `${stored.value.studentName}, which is neither of the two education credits `
                    + `Form 8863 offers`,
            }
        }
        const matching = tuitionForms.filter(form => form.value.recipientTin === stored.value.studentTin)
        /** @type {readonly Source[]} */
        const boxOneSources = matching.flatMap(form => {
            const printed = form.value.box1PaymentsReceivedForQualifiedTuition
            return printed === undefined
                ? []
                : [{
                    documentHash: form.documentHash,
                    boxPath: 'box1PaymentsReceivedForQualifiedTuition',
                    value: printed,
                }]
        })
        /** @type {readonly Source[]} */
        const boxFiveSources = matching.flatMap(form => {
            const printed = form.value.box5ScholarshipsOrGrants
            return printed === undefined
                ? []
                : [{
                    documentHash: form.documentHash,
                    boxPath: 'box5ScholarshipsOrGrants',
                    value: printed,
                }]
        })
        // The asserted half. Both fields are `vnd.fjs.credits`' own, and they
        // stay SEPARATE all the way into `fjs/form8863` because the two
        // credits' expense definitions differ by exactly the second one.
        const assertedTuition = stored.value.qualifiedExpensesNotReportedOnForm1098T
        const assertedMaterials = stored.value.courseMaterialsNotPaidToTheInstitution
        /** @type {readonly Source[]} */
        const assertedSources = [
            ...(assertedTuition === undefined ? [] : [{
                documentHash: stored.documentHash,
                boxPath: `educationStudents[studentTin=${stored.value.studentTin}].qualifiedExpensesNotReportedOnForm1098T`,
                value: assertedTuition,
            }]),
            ...(assertedMaterials === undefined ? [] : [{
                documentHash: stored.documentHash,
                boxPath: `educationStudents[studentTin=${stored.value.studentTin}].courseMaterialsNotPaidToTheInstitution`,
                value: assertedMaterials,
            }]),
        ]
        educationSources.push(...boxOneSources, ...boxFiveSources, ...assertedSources)
        students.push({
            studentName: stored.value.studentName,
            credit,
            institutionalExpenseCents: sumSources(boxOneSources)
                + (assertedTuition === undefined ? 0n : centsFromString(assertedTuition)),
            courseMaterialsNotPaidToTheInstitutionCents:
                assertedMaterials === undefined ? 0n : centsFromString(assertedMaterials),
            scholarshipsCents: sumSources(boxFiveSources),
            enrolledAtLeastHalfTimeInADegreeProgram:
                stored.value.enrolledAtLeastHalfTimeInADegreeProgram === true,
            americanOpportunityClaimedForFourPriorYears:
                stored.value.americanOpportunityClaimedForFourPriorYears === true,
            completedFirstFourYearsOfPostsecondaryEducation:
                stored.value.completedFirstFourYearsOfPostsecondaryEducation === true,
            convictedOfAFelonyDrugOffense: stored.value.convictedOfAFelonyDrugOffense === true,
            aStoredFormCarriesAPriorYearAdjustment: matching.some(form =>
                form.value.box4AdjustmentsForAPriorYear !== undefined
                || form.value.box6AdjustmentsToScholarshipsForAPriorYear !== undefined),
            aStoredFormCarriesAnInsuranceReimbursement: matching.some(form =>
                form.value.box10InsuranceContractReimbursementOrRefund !== undefined),
        })
    }
    const educationOutcome = form8863(taxParamSet)({
        status,
        agiCents,
        students,
        line18Cents,
        // Schedule 3 lines 1 and 2 and Schedule R -- every one a refused
        // `fjs/return/scope` kind, so every one a documented zero. Named
        // rather than omitted, exactly as `fjs/form8812`'s Credit Limit
        // Worksheet A line 2 was until this phase made it real.
        earlierScheduleThreeCreditsCents: 0n,
        filerAttainedAgeTwentyFour: creditForms.some(
            form => form.value.filerAttainedAgeTwentyFourBeforeTheEndOfTheYear === true),
    })
    if (educationOutcome.kind === 'error') {
        return educationOutcome
    }
    const line3 = fromDocuments('Schedule 3 line 3 (education credits, Form 8863 line 19)')(
        educationOutcome.line19)(educationSources)

    // ── Line 4: the saver's credit, through Form 8880 ────────────────────
    /** @type {readonly { readonly documentHash: string, readonly value: NonNullable<Credits['retirementContributions']>[number] }[]} */
    const storedContributions = creditForms.flatMap(form =>
        (form.value.retirementContributions ?? []).map(value => ({ documentHash: form.documentHash, value })))
    for (const contribution of storedContributions) {
        if (!retirementContributionTagNames.includes(contribution.value.contributionTag)) {
            return {
                kind: 'error',
                message: `Schedule 3 line 4: the credits document carries a retirement contribution `
                    + `tagged '${contribution.value.contributionTag}' `
                    + `(${contribution.value.description}, ${contribution.value.amount}), which is `
                    + `not one of the ${retirementContributionTags.length} Form 8880 lines this `
                    + `engine computes (${retirementContributionTagNames.join(', ')}). Refusing `
                    + `rather than dropping a contribution and understating the credit`,
            }
        }
        if (individualNamed(contribution.value.individual) === undefined) {
            return {
                kind: 'error',
                message: `Schedule 3 line 4: the credits document attributes `
                    + `${contribution.value.description} to '${contribution.value.individual}', `
                    + `which is neither the taxpayer nor the spouse`,
            }
        }
    }
    const deferralSources = electiveDeferralSources(w2Forms)
    const deferralCents = sumSources(deferralSources)
    // Every person the return can attribute a contribution to. Built from the
    // UNION of the two arrays rather than from either alone: an eligibility
    // record with no contribution still has to exist as a column (it is how a
    // spouse says "and I am eligible too"), and a contribution with no
    // eligibility record is exactly the case `fjs/form8880` refuses.
    /** @type {readonly Form8880Individual[]} */
    const bothIndividuals = ['taxpayer', 'spouse']
    /** @type {readonly Source[]} */
    const contributionSources = storedContributions.map(contribution => ({
        documentHash: contribution.documentHash,
        boxPath: `retirementContributions[tag=${contribution.value.contributionTag},individual=${contribution.value.individual}]`,
        value: contribution.value.amount,
    }))
    /** @type {readonly Form8880Person[]} */
    const people = bothIndividuals.map(individual => {
        const eligibilityRecord = creditForms.flatMap(form => form.value.saversCreditEligibility ?? [])
            .find(record => record.individual === individual)
        return {
            individual,
            iraContributionCents: storedContributions
                .filter(c => c.value.individual === individual)
                .reduce((total, c) => total + centsFromString(c.value.amount), 0n),
            // Every elective deferral goes to the TAXPAYER's column. On a
            // joint return `fjs/form8880` refuses before this can matter --
            // no document says which spouse a W-2 belongs to -- and on every
            // other status there is only one column for it to go to.
            electiveDeferralCents: individual === 'taxpayer' ? deferralCents : 0n,
            eligibility: eligibilityRecord === undefined ? undefined : {
                attainedAgeEighteen: eligibilityRecord.attainedAgeEighteen === true,
                wasAFullTimeStudent: eligibilityRecord.wasAFullTimeStudent === true,
                noTestingPeriodDistributions:
                    eligibilityRecord.noTestingPeriodDistributions === true,
            },
        }
    })
    const saversOutcome = form8880(taxParamSet)({
        status,
        agiCents,
        claimedAsDependent: profile.value.claimedAsDependent === true,
        people,
        // Whether this return has ENGAGED with the saver's credit at all.
        // See `fjs/form8880`'s own docstring, "That last condition is a REAL
        // GAP": without it, every 401(k) contributor in a crediting band
        // would be refused for not having answered questions about a credit
        // they never claimed.
        saversCreditDeclared: profile.value.declaredKinds.includes(
            'retirementSavingsContributionsCredit'),
        line18Cents,
        // The Credit Limit Worksheet's line 2: Schedule 3 lines 1, 2, 3, 6d,
        // 6l and 6m plus Forms 5695/8910/8936. Only line 3 is non-zero in
        // this engine, and it is REAL -- which is the whole of §26's ordering
        // between these two credits, expressed as the printed worksheet
        // expresses it.
        earlierScheduleThreeCreditsCents: line3.value,
        aStored1099RProvesADistribution,
    })
    if (saversOutcome.kind === 'error') {
        return saversOutcome
    }
    const line4 = fromDocuments("Schedule 3 line 4 (retirement savings contributions credit, Form 8880 line 12)")(
        saversOutcome.line12)([...contributionSources, ...deferralSources])

    // ── Part I: Nonrefundable Credits ────────────────────────────────────
    const line1 = zero('Schedule 3 line 1 (foreign tax credit, Form 1116)')
    const line2 = zero('Schedule 3 line 2 (credit for child and dependent care expenses, Form 2441)')
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
        kind: 'ok',
        line1, line2, line3, line4, line5a, line5b, line6, line7, line8,
        line9, line10, line11, line12, line13, line14, line15,
        form8863: educationOutcome,
        form8880: saversOutcome,
    }
}

// ── Tests ────────────────────────────────────────────────────────────────────

/**
 * TY2025's parameter set, narrowed exactly ONCE at module scope, mirroring
 * `fjs/form8880`'s and `fjs/form8889`'s own precedent.
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

/** @type {(overrides: Partial<ScheduleThreeInput>) => ScheduleThreeInput} */
const baseInput = overrides => ({
    profile: profileNoDeclaredKinds,
    status: 'single',
    agiCents: 2000000n,          // $20,000.00 -- inside the saver's credit 50% band
    line18Cents: 100000000n,     // ample, so no credit limit binds
    w2Forms: [],
    creditForms: [],
    tuitionForms: [],
    aStored1099RProvesADistribution: false,
    ...overrides,
})

/** @type {(outcome: ScheduleThreeOutcome) => ScheduleThree} */
const okResult = outcome => {
    assert(outcome.kind === 'ok', ['expected a computed Schedule 3', outcome])
    if (outcome.kind !== 'ok') { throw ['unreachable', outcome] }
    return outcome
}

/** @type {(outcome: ScheduleThreeOutcome) => ScheduleThreeRefusal} */
const refusal = outcome => {
    assert(outcome.kind === 'error', ['expected a refusal', outcome])
    if (outcome.kind !== 'error') { throw ['unreachable', outcome] }
    return outcome
}

/** @type {(input: ScheduleThreeInput) => ScheduleThreeOutcome} */
const compute = scheduleThree(taxParams2025)

/** A stored `vnd.fjs.credits` record, from one hash.
 * @type {(overrides: Partial<Credits>) => Stored<Credits>} */
const creditsDocument = overrides => ({
    documentHash: 'sha256-credits-0001',
    value: {
        dialect: 'vnd.fjs.credits',
        recipientTin: '222-22-2222',
        taxYear: 2025,
        ...overrides,
    },
})

/** A stored `vnd.fjs.1098t` for one student.
 * @type {(overrides: Partial<OneZeroNineEightT>) => Stored<OneZeroNineEightT>} */
const tuitionDocument = overrides => ({
    documentHash: 'sha256-1098t-0001',
    value: {
        dialect: 'vnd.fjs.1098t',
        payerTin: '11-1111111',
        recipientTin: '333-33-3333',
        accountNumber: 'STU-0001',
        taxYear: 2025,
        formRevision: '2025',
        ...overrides,
    },
})

/** A stored `vnd.fjs.w2` carrying one box-12 entry.
 * @type {(code: string) => (amount: string) => Stored<W2>} */
const w2WithBox12 = code => amount => ({
    documentHash: 'sha256-w2-0001',
    value: {
        dialect: 'vnd.fjs.w2',
        payerTin: '11-1111111',
        recipientTin: '222-22-2222',
        accountNumber: '',
        taxYear: 2025,
        formRevision: '2025',
        box12: [{ code, amount }],
    },
})

/** Hand-typed: the number of box-12 codes Form 8880 line 2 reads. NOT
 * `electiveDeferralBox12Codes.length` — a code silently dropped would take
 * its own generated coverage with it (AGENTS.md's hand-typed-count idiom).
 * @type {number} */
const expectedDeferralCodeCount = 9

/**
 * One generated leaf per elective-deferral code: a W-2 carrying that code
 * alone must reach Form 8880 line 2. Built by mapping the list itself, with
 * {@link expectedDeferralCodeCount} beside it as the counterweight.
 */
const perDeferralCode = Object.fromEntries(electiveDeferralBox12Codes.map(code => [
    `code${code}ReachesFormEightyEightyLineTwo`,
    () => {
        const result = okResult(compute(baseInput({
            w2Forms: [w2WithBox12(code)('1000.00')],
            creditForms: [creditsDocument({
                saversCreditEligibility: [{
                    individual: 'taxpayer',
                    attainedAgeEighteen: true,
                    noTestingPeriodDistributions: true,
                }],
            })],
        })))
        assertEq(result.line4.value, 50000n, `code ${code}: 50% of $1,000.00 = $500.00`)
    },
]))

export const proof = {
    // ── The zero return: byte-for-byte what it was before this phase ──────
    zeroDocuments: {
        // The original acceptance criterion, unchanged: a return with no
        // credit documents at all still computes $0 on both totals, citing
        // the profile.
        noDocumentsGivesZeroOnBothTotals: () => {
            const result = okResult(compute(baseInput({})))
            assertEq(result.line8.value, 0n, 'line 8 = $0.00 -> 1040 line 20')
            assertEq(result.line15.value, 0n, 'line 15 = $0.00 -> 1040 line 31')
            assertEq(result.line8.sources[0].boxPath, 'declaredKinds')
            assertEq(result.line15.sources[0].boxPath, 'declaredKinds')
        },
        // Every one of the sixteen printed lines is still a valid ReportLine
        // citing the profile when no document supplies one -- including the
        // two this phase wired, whose `documentLine` falls back to exactly
        // the zero they carried before.
        //
        // The sixteen lines are ENUMERATED here rather than walked off
        // `Object.entries(result)`, and that is the difference between a
        // proof and a decoration: a loop over the result's own keys cannot
        // notice a line disappearing from the result, which is AGENTS.md's
        // fourth shipped defect exactly. `everyPrintedLineIsNamed` below
        // pairs this list with a hand-typed field count.
        everyLineStillCitesTheProfileWhenNoDocumentSuppliesOne: () => {
            const result = okResult(compute(baseInput({})))
            /** @type {readonly (readonly [string, ReportLine])[]} */
            const printed = [
                ['line1', result.line1], ['line2', result.line2], ['line3', result.line3],
                ['line4', result.line4], ['line5a', result.line5a], ['line5b', result.line5b],
                ['line6', result.line6], ['line7', result.line7], ['line8', result.line8],
                ['line9', result.line9], ['line10', result.line10], ['line11', result.line11],
                ['line12', result.line12], ['line13', result.line13], ['line14', result.line14],
                ['line15', result.line15],
            ]
            assertEq(printed.length, 16, 'sixteen printed Schedule 3 lines, hand-counted')
            for (const [field, line] of printed) {
                assertEq(line.value, 0n, field)
                assertEq(line.sources.length, 1, field)
                assertEq(line.sources[0]?.documentHash, profileNoDeclaredKinds.documentHash, field)
                assertEq(line.sources[0]?.boxPath, 'declaredKinds', field)
            }
        },
        // Line 11's own boundary, unchanged by this phase: a documented zero,
        // never a computation over the stored W-2 box 4 figures that could
        // support one. Asserted with a W-2 actually present, which is the
        // only input at which the claim can be observed at all.
        lineElevenIsStillADocumentedZeroEvenWithAW2Present: () => {
            const result = okResult(compute(baseInput({
                w2Forms: [w2WithBox12('D')('1000.00')],
                creditForms: [creditsDocument({
                    saversCreditEligibility: [{
                        individual: 'taxpayer',
                        attainedAgeEighteen: true,
                        noTestingPeriodDistributions: true,
                    }],
                })],
            })))
            assertEq(result.line11.value, 0n)
            assertEq(result.line11.sources.length, 1, 'line 11 cites exactly the profile, never a W-2 box')
            assertEq(result.line11.sources[0]?.boxPath, 'declaredKinds')
            // …while line 4, on the SAME W-2, is real. The contrast is the
            // point: this module now reads W-2s, and line 11 still does not.
            assert(result.line4.value > 0n, ['line 4 must be real', result.line4])
        },
    },

    // ── Line 4: the saver's credit ────────────────────────────────────────
    lineFour: {
        ...perDeferralCode,
        // The counterweight to the nine generated leaves above.
        everyDeferralCodeIsCoveredAndNoOtherCodeIs: () => {
            assertEq(electiveDeferralBox12Codes.length, expectedDeferralCodeCount)
            assertEq(new Set(electiveDeferralBox12Codes).size, expectedDeferralCodeCount)
            // Code W is an employer HSA contribution (`fjs/schedule/1` reads
            // it for Schedule 1 line 13) and DD is employer-sponsored health
            // coverage. Either one admitted here would credit money into a
            // retirement plan it never went near.
            assertEq(electiveDeferralCodeNames.includes('W'), false)
            assertEq(electiveDeferralCodeNames.includes('DD'), false)
        },
        // The same W-2 carrying code W and code DD contributes NOTHING, which
        // is what the exclusion above means in practice. This is the control
        // for all nine generated leaves: a filter that admitted everything
        // would pass every one of them.
        codeWAndCodeDoubleDContributeNothing: () => {
            const result = okResult(compute(baseInput({
                w2Forms: [{
                    documentHash: 'sha256-w2-0002',
                    value: {
                        dialect: 'vnd.fjs.w2',
                        payerTin: '11-1111111',
                        recipientTin: '222-22-2222',
                        accountNumber: '',
                        taxYear: 2025,
                        formRevision: '2025',
                        box12: [
                            { code: 'W', amount: '1000.00' },
                            { code: 'DD', amount: '14500.00' },
                        ],
                    },
                }],
                creditForms: [creditsDocument({
                    saversCreditEligibility: [{
                        individual: 'taxpayer',
                        attainedAgeEighteen: true,
                        noTestingPeriodDistributions: true,
                    }],
                })],
            })))
            assertEq(result.line4.value, 0n, 'neither code is an elective deferral')
            assertEq(
                result.line4.sources[0]?.boxPath,
                'declaredKinds',
                'and with no reading at all the line falls back to the profile',
            )
        },
        // The asserted half: an IRA contribution no information return can
        // report in time (Form 5498 is furnished by May 31). $2,000 at 50%
        // is $1,000, and the line cites the credits document rather than the
        // profile -- the hard zero REPLACED, not supplemented.
        anAssertedIraContributionReachesLineFourCitingItsOwnDocument: () => {
            const result = okResult(compute(baseInput({
                creditForms: [creditsDocument({
                    retirementContributions: [{
                        contributionTag: 'iraContribution',
                        datePaid: '2025-07-15',
                        description: 'traditional IRA contribution',
                        amount: '2000.00',
                        individual: 'taxpayer',
                    }],
                    saversCreditEligibility: [{
                        individual: 'taxpayer',
                        attainedAgeEighteen: true,
                        noTestingPeriodDistributions: true,
                    }],
                })],
            })))
            assertEq(result.line4.value, 100000n, '50% of $2,000.00 = $1,000.00')
            assertEq(result.line8.value, 100000n, 'and it reaches 1040 line 20 through line 8')
            assert(
                result.line4.sources.every(source => source.boxPath !== 'declaredKinds'),
                ['the hard zero is REPLACED, not supplemented', result.line4.sources],
            )
        },
        // An unrecognized `contributionTag` is refused by name rather than
        // silently dropped -- `fjs/schedule/1`'s own `adjustmentLineTags`
        // discipline, one schedule over.
        anUnrecognizedContributionTagIsRefusedNamingTheValue: () => {
            const result = refusal(compute(baseInput({
                creditForms: [creditsDocument({
                    retirementContributions: [{
                        contributionTag: 'rothConversion',
                        datePaid: '2025-07-15',
                        description: 'a Roth conversion',
                        amount: '2000.00',
                        individual: 'taxpayer',
                    }],
                })],
            })))
            assert(result.message.includes('rothConversion'), ['must quote the tag', result.message])
            assert(result.message.includes('a Roth conversion'), ['must name the entry', result.message])
        },
    },

    // ── Line 3: the education credits ─────────────────────────────────────
    lineThree: {
        // A transcribed 1098-T matched to an asserted student, both halves
        // reaching one credit: $9,000 of box 1 caps at $4,000, giving the
        // $2,500 maximum, of which $1,000 (40%) is REFUNDABLE and never
        // touches this schedule, and $1,500 lands on line 3.
        aTranscribedTuitionStatementReachesLineThree: () => {
            const result = okResult(compute(baseInput({
                agiCents: 4000000n,
                tuitionForms: [tuitionDocument({
                    box1PaymentsReceivedForQualifiedTuition: '9000.00',
                })],
                creditForms: [creditsDocument({
                    educationStudents: [{
                        studentTin: '333-33-3333',
                        studentName: 'A. Student',
                        credit: 'americanOpportunity',
                        enrolledAtLeastHalfTimeInADegreeProgram: true,
                    }],
                    filerAttainedAgeTwentyFourBeforeTheEndOfTheYear: true,
                })],
            })))
            assertEq(result.line3.value, 150000n, '$1,500.00 nonrefundable -> Schedule 3 line 3')
            assertEq(result.form8863.line8, 100000n, '$1,000.00 refundable -> 1040 line 29, NOT this schedule')
            assertEq(result.line8.value, 150000n, 'only the nonrefundable half reaches 1040 line 20')
            assert(
                result.line3.sources.some(s => s.boxPath === 'box1PaymentsReceivedForQualifiedTuition'),
                ['line 3 must cite the 1098-T box it read', result.line3.sources],
            )
        },
        // The asserted half, which no 1098-T can carry: $700 of required
        // textbooks bought outside the institution. Alone -- with no 1098-T
        // at all -- it is a $700 American Opportunity Credit, of which $280
        // is refundable and $420 nonrefundable.
        assertedCourseMaterialsAloneReachLineThreeWithNoTuitionStatement: () => {
            const result = okResult(compute(baseInput({
                agiCents: 4000000n,
                creditForms: [creditsDocument({
                    educationStudents: [{
                        studentTin: '333-33-3333',
                        studentName: 'A. Student',
                        credit: 'americanOpportunity',
                        courseMaterialsNotPaidToTheInstitution: '700.00',
                        enrolledAtLeastHalfTimeInADegreeProgram: true,
                    }],
                    filerAttainedAgeTwentyFourBeforeTheEndOfTheYear: true,
                })],
            })))
            assertEq(result.form8863.line1, 70000n, '100% of the first $2,000.00 of expenses')
            assertEq(result.form8863.line8, 28000n, '40% of $700.00 = $280.00')
            assertEq(result.line3.value, 42000n, '$700.00 - $280.00 = $420.00')
        },
        // Box 5 scholarships REDUCE the base, and the citation says so: the
        // same $9,000 of box 1 against $8,000 of box 5 leaves $1,000.
        boxFiveScholarshipsReduceTheBaseAndAreCited: () => {
            const result = okResult(compute(baseInput({
                agiCents: 4000000n,
                tuitionForms: [tuitionDocument({
                    box1PaymentsReceivedForQualifiedTuition: '9000.00',
                    box5ScholarshipsOrGrants: '8000.00',
                })],
                creditForms: [creditsDocument({
                    educationStudents: [{
                        studentTin: '333-33-3333',
                        studentName: 'A. Student',
                        credit: 'americanOpportunity',
                        enrolledAtLeastHalfTimeInADegreeProgram: true,
                    }],
                    filerAttainedAgeTwentyFourBeforeTheEndOfTheYear: true,
                })],
            })))
            assertEq(result.form8863.students[0]?.line27, 100000n, '$9,000.00 - $8,000.00 = $1,000.00')
            assert(
                result.line3.sources.some(s => s.boxPath === 'box5ScholarshipsOrGrants'),
                ['line 3 must cite the scholarship box it subtracted', result.line3.sources],
            )
        },
        // **The student is matched by TIN, never assumed to be the filer.**
        // A 1098-T for a DIFFERENT student contributes nothing to this
        // student's expenses -- which is the property `fjs/document/1098t`'s
        // own header says the whole matching design exists for.
        aTuitionStatementForAnotherStudentIsNotMatched: () => {
            const result = okResult(compute(baseInput({
                agiCents: 4000000n,
                tuitionForms: [tuitionDocument({
                    recipientTin: '555-55-5555',
                    box1PaymentsReceivedForQualifiedTuition: '9000.00',
                })],
                creditForms: [creditsDocument({
                    educationStudents: [{
                        studentTin: '333-33-3333',
                        studentName: 'A. Student',
                        credit: 'americanOpportunity',
                        enrolledAtLeastHalfTimeInADegreeProgram: true,
                    }],
                    filerAttainedAgeTwentyFourBeforeTheEndOfTheYear: true,
                })],
            })))
            assertEq(result.form8863.students[0]?.line27, 0n, 'the other student\'s tuition is not this one\'s')
            assertEq(result.line3.value, 0n)
        },
        // …and a 1098-T with no matching student entry at all is IGNORED
        // rather than refused. Holding the form is not claiming the credit:
        // the election lives on the student entry, and a form for a student
        // this return does not claim belongs on somebody else's.
        aTuitionStatementWithNoClaimedStudentIsIgnoredNotRefused: () => {
            const outcome = compute(baseInput({
                tuitionForms: [tuitionDocument({
                    box1PaymentsReceivedForQualifiedTuition: '9000.00',
                })],
            }))
            const result = okResult(outcome)
            assertEq(result.line3.value, 0n)
            assertEq(result.line3.sources[0]?.boxPath, 'declaredKinds')
        },
        // A 1098-T box 4 prior-year adjustment is refused HERE, threaded up
        // from `fjs/form8863` -- the other half of the pair
        // `fjs/document/1098t` records when it stores rather than refuses it.
        aPriorYearAdjustmentOnAMatchedFormIsRefused: () => {
            const result = refusal(compute(baseInput({
                agiCents: 4000000n,
                tuitionForms: [tuitionDocument({
                    box1PaymentsReceivedForQualifiedTuition: '9000.00',
                    box4AdjustmentsForAPriorYear: '500.00',
                })],
                creditForms: [creditsDocument({
                    educationStudents: [{
                        studentTin: '333-33-3333',
                        studentName: 'A. Student',
                        credit: 'americanOpportunity',
                        enrolledAtLeastHalfTimeInADegreeProgram: true,
                    }],
                    filerAttainedAgeTwentyFourBeforeTheEndOfTheYear: true,
                })],
            })))
            assert(
                result.message.includes('educationCreditRecapture'),
                ['must name the kind that refuses the recapture', result.message],
            )
        },
    },

    // ── §26's ordering, expressed through the two printed worksheets ───────
    creditOrdering: {
        // The education credits come out of the liability BEFORE the saver's
        // credit sees it. $1,500 of tax, a $1,500 nonrefundable education
        // credit and a $1,000 saver's credit: the education credit takes the
        // whole liability and the saver's credit gets nothing.
        //
        // Hand-derived: line 18 = $1,500.00. Form 8863's own limit is
        // $1,500.00 - $0.00, so line 3 = $1,500.00. Form 8880's limit is
        // $1,500.00 - $1,500.00 = $0.00, so line 4 = $0.00 even though line
        // 10 wanted $1,000.00. Line 8 = $1,500.00 + $0.00 = $1,500.00.
        theEducationCreditIsOrderedBeforeTheSaversCredit: () => {
            const result = okResult(compute(baseInput({
                agiCents: 2000000n,
                line18Cents: 150000n,
                tuitionForms: [tuitionDocument({
                    box1PaymentsReceivedForQualifiedTuition: '9000.00',
                })],
                creditForms: [creditsDocument({
                    educationStudents: [{
                        studentTin: '333-33-3333',
                        studentName: 'A. Student',
                        credit: 'americanOpportunity',
                        enrolledAtLeastHalfTimeInADegreeProgram: true,
                    }],
                    filerAttainedAgeTwentyFourBeforeTheEndOfTheYear: true,
                    retirementContributions: [{
                        contributionTag: 'iraContribution',
                        datePaid: '2025-07-15',
                        description: 'traditional IRA contribution',
                        amount: '2000.00',
                        individual: 'taxpayer',
                    }],
                    saversCreditEligibility: [{
                        individual: 'taxpayer',
                        attainedAgeEighteen: true,
                        noTestingPeriodDistributions: true,
                    }],
                })],
            })))
            assertEq(result.line3.value, 150000n, 'the education credit takes the whole $1,500.00')
            assertEq(result.form8880.line10, 100000n, 'the saver\'s credit WANTED $1,000.00')
            assertEq(result.form8880.creditLimitWorksheet.w2, 150000n, 'and its limit subtracts line 3')
            assertEq(result.line4.value, 0n, 'so it gets nothing')
            assertEq(result.line8.value, 150000n, 'and 1040 line 20 never exceeds the tax')
        },
        // The CONTROL for the leaf above: the same two credits against ample
        // tax both compute in full, so the ordering is observable as an
        // ordering rather than as a blanket cap.
        withAmpleTaxBothCreditsComputeInFull: () => {
            const result = okResult(compute(baseInput({
                agiCents: 2000000n,
                line18Cents: 100000000n,
                tuitionForms: [tuitionDocument({
                    box1PaymentsReceivedForQualifiedTuition: '9000.00',
                })],
                creditForms: [creditsDocument({
                    educationStudents: [{
                        studentTin: '333-33-3333',
                        studentName: 'A. Student',
                        credit: 'americanOpportunity',
                        enrolledAtLeastHalfTimeInADegreeProgram: true,
                    }],
                    filerAttainedAgeTwentyFourBeforeTheEndOfTheYear: true,
                    retirementContributions: [{
                        contributionTag: 'iraContribution',
                        datePaid: '2025-07-15',
                        description: 'traditional IRA contribution',
                        amount: '2000.00',
                        individual: 'taxpayer',
                    }],
                    saversCreditEligibility: [{
                        individual: 'taxpayer',
                        attainedAgeEighteen: true,
                        noTestingPeriodDistributions: true,
                    }],
                })],
            })))
            assertEq(result.line3.value, 150000n)
            assertEq(result.line4.value, 100000n)
            assertEq(result.line8.value, 250000n, '$1,500.00 + $1,000.00 = $2,500.00 -> 1040 line 20')
        },
    },

    // ── Structure, unchanged from before this phase ───────────────────────
    structure: {
        // The 6/7 and 13/14 collapse-and-restate idiom.
        line7RestatesLine6AndLine14RestatesLine13: () => {
            const result = okResult(compute(baseInput({})))
            assertEq(result.line7.value, result.line6.value)
            assertEq(result.line7.sources[0].boxPath, result.line6.sources[0].boxPath)
            assert(result.line7.rule !== result.line6.rule, 'line7 and line6 must carry DIFFERENT rule strings')
            assertEq(result.line14.value, result.line13.value)
            assertEq(result.line14.sources[0].boxPath, result.line13.sources[0].boxPath)
            assert(result.line14.rule !== result.line13.rule, 'line14 and line13 must carry DIFFERENT rule strings')
        },
        // Hand-typed field-count guard: sixteen printed lines, the `kind`
        // discriminant, and the two form results carried out beside them.
        everyPrintedLineIsNamed: () => {
            const result = okResult(compute(baseInput({})))
            assertEq(
                Object.keys(result).length,
                19,
                'expected 16 named Schedule 3 lines, the kind tag, and the two form results',
            )
        },
        dialectIndependence: () => {
            const result = okResult(compute(baseInput({})))
            assert(!('dialect' in result), 'scheduleThree output must not carry a dialect tag')
            assert(!('mediaType' in result), 'scheduleThree output must not carry a mediaType')
        },
    },
}
