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
 *
 * **The boundary itself is now gone too, and this paragraph is its third
 * correction.** `line11` is a document-derived computation over Form W-2 box 4
 * — see {@link excessSocialSecurityWithheldLine}. Everything above stands as
 * the record of why it took three phases: the figure was always in reach, the
 * missing pieces were the wage base (Phase 28) and §3101(a)'s rate, and each
 * intervening phase said so rather than omitting it silently. `fjs/schedule/b`'s
 * Form 8815 treatment is the remaining example of the shape this line used to
 * be.
 *
 * What line 11 still does NOT compute is the **tier-1 RRTA** half of its own
 * printed title. `vnd.fjs.w2` has no box 14, which is where a railroad
 * employer reports tier-1 tax, and railroad employment sits outside FICA
 * entirely — so no stored figure is dropped, but no railroad return is served
 * either. `fjs/schedule/3/todo/excess-social-security.md` records it as a
 * scope question for whoever reclassifies the kind, whose own label names
 * tier-1 RRTA.
 *
 * The `totalLine`/`unionSources`/`profileDeclaredZeroLine` helpers below
 * are reimplemented locally, private and NOT imported from
 * `fjs/form1040/core`, `fjs/schedule/1`, or `fjs/schedule/2` — this
 * project's established "reimplement an idiom you cannot import" pattern.
 *
 * @module
 */
import { assert, assertEq } from 'functionalscript/fjs/asserts/module.f.js'
import { centsFromString, centsToString } from '../../exact/module.f.js'
import { of, halfUp } from '../../types/rational/module.f.js'
import { form8863 } from '../../form8863/module.f.js'
import { form8880 } from '../../form8880/module.f.js'
import { taxParamsByYear } from '../../tax/params/module.f.js'

/** @import { ReturnProfile } from '../../return/profile/module.f.js' */
/** @import { ReportLine, Source } from '../../report/line/module.f.js' */
/** @import { Credits } from '../../document/credits/module.f.js' */
/** @import { OneZeroNineEightT } from '../../document/1098t/module.f.js' */
/** @import { W2 } from '../../document/w2/module.f.js' */
/** @import { OneZeroNineNineDiv } from '../../document/1099div/module.f.js' */
/** @import { OneZeroNineNineInt } from '../../document/1099int/module.f.js' */
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

/**
 * A line read off one of the return profile's OWN money boxes — the shape
 * `fjs/form1040/core`'s `profileMoneyBox` gives 1040 lines 26, 35a and 36,
 * reimplemented here for the same reason every helper above it is (this
 * module does not import that one).
 *
 * PRESENT means one citation at that field's own `boxPath` carrying the raw
 * decimal string exactly as stored — never re-formatted. ABSENT falls back to
 * {@link profileDeclaredZeroLine}, which cites `declaredKinds` instead: DOC-11
 * says an absent box is absent, and quoting a `'0.00'` at a field the taxpayer
 * left blank would put a value in the report's provenance that no document
 * contains. A stored `'0.00'` cites the field, because the taxpayer did state
 * it.
 * @type {(profile: Stored<ReturnProfile>) => (rule: string) => (boxPath: 'scheduleThreeLine10AmountPaidWithExtensionRequest') => ReportLine}
 */
const profileMoneyLine = profile => rule => boxPath => {
    const printed = profile.value[boxPath]
    return printed === undefined
        ? profileDeclaredZeroLine(profile)(rule)
        : {
            value: centsFromString(printed),
            sources: [{ documentHash: profile.documentHash, boxPath, value: printed }],
            rule,
        }
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

// ── Line 11: excess Social Security tax withheld ────────────────────────────

/**
 * The values of `values`, first-seen order, each once.
 * @type {(values: readonly string[]) => readonly string[]}
 */
const distinct = values => values.filter((value, index) => values.indexOf(value) === index)

/**
 * The maximum §3101(a) tax any ONE employer may withhold from any ONE
 * employee in the year: the Social Security wage base times 6.2%. For TY2025
 * that is $176,100.00 x 6.2% = **$10,918.20**, which is the figure the printed
 * Schedule 3 line 11 instructions state outright.
 *
 * Both operands come off `taxParamSet` rather than out of a literal here, so a
 * second tax year computes its own maximum — `fjs/tax/params` pins the TY2025
 * product against the instructions' own $10,918.20.
 *
 * **The wage base is `selfEmploymentTax`'s, and that is not a borrow.**
 * §1402(b)(1) (chapter 2) and §3121(a)(1) (chapter 21) do not each state a
 * dollar amount; both defer to *"the contribution and benefit base (as
 * determined under section 230 of the Social Security Act)"*. One number, read
 * by two statutes — so a second stored copy could only ever disagree with a
 * base the Social Security Administration sets once. The RATE is the opposite
 * case and is stored separately for that reason; `fjs/tax/params`'
 * {@link socialSecurityTaxWithholding} argues both halves.
 *
 * Cent-exact and half-up through `fjs/types/rational`, never through a float —
 * the arithmetic `fjs/form8959` performs on the neighbouring §3101(b) rates.
 * @type {(taxParamSet: TaxParamSet) => bigint}
 */
const socialSecurityWithholdingMaximum = taxParamSet => halfUp(of(
    centsFromString(taxParamSet.selfEmploymentTax.socialSecurityWageBase.amount)
    * BigInt(taxParamSet.socialSecurityTaxWithholding.employeeRateBasisPoints))(10000n))

/**
 * One stored Form W-2 that actually REPORTED box 4, paired with the printed
 * string it reported.
 *
 * The pair exists because line 11 needs the box AND the form: the amount is
 * summed, while `recipientTin` and `payerTin` decide which sums are allowed to
 * happen at all. Building it with `flatMap` over an `undefined` check keeps
 * the narrowing the compiler already did — no second lookup, so no
 * `T | undefined` to cast away.
 * @typedef {{ readonly form: Stored<W2>, readonly withheld: string }} BoxFourReading
 */

/**
 * Every W-2 that reported box 4, in document order.
 *
 * **Presence, never value.** A W-2 reporting `'0.00'` withholding is kept: it
 * said something, and line 11 cites it. A W-2 with no box 4 at all is dropped
 * entirely — it is not cited, and it does not count towards §6413(c)(1)'s
 * employer count either, because an employer that withheld no Social Security
 * tax cannot have contributed to an excess of it. This is the same
 * presence-not-value rule `fjs/schedule/1`'s `earlyWithdrawalPenaltyLine`
 * follows for 1099-INT box 2.
 * @type {(forms: readonly Stored<W2>[]) => readonly BoxFourReading[]}
 */
const boxFourReadings = forms => forms.flatMap(form => {
    const withheld = form.value.box4SocialSecurityTaxWithheld
    return withheld === undefined ? [] : [{ form, withheld }]
})

/**
 * The EMPLOYEE a reading belongs to — box a, the employee's own SSN. Each one
 * gets a wage base of their own, so this is the key the excess is computed
 * per. Named once and read twice (to enumerate the employees and to select
 * each one's forms), so the two cannot drift apart: AGENTS.md's "one rule, one
 * place".
 * @type {(reading: BoxFourReading) => string}
 */
const employeeOf = reading => reading.form.value.recipientTin

/**
 * The EMPLOYER a reading belongs to — box b, the employer's EIN. §6413(c)(1)
 * counts these, never documents.
 * @type {(reading: BoxFourReading) => string}
 */
const employerOf = reading => reading.form.value.payerTin

/**
 * Line 11, excess Social Security tax withheld: what §31(b) allows as a
 * payment because §6413(c)(1) allows it as a special refund.
 *
 * Each employer withholds §3101(a)'s 6.2% up to the wage base **independently**
 * — no employer knows what another paid — so an employee who changed jobs or
 * held two at once can have more than the annual maximum taken out of wages
 * that were never above the base in total. §6413(c)(1) gives that surplus
 * back, and §31(b) delivers it as a credit against the income tax rather than
 * as a separate claim, which is why it lands on Schedule 3 Part II beside the
 * withholding and not among the credits in Part I.
 *
 * Three things here are statute rather than arithmetic, and each one is a way
 * "sum the boxes and subtract the cap" gets a real refund wrong:
 *
 * **1. More than one employer, or nothing.** §6413(c)(1) opens *"if by reason
 * of an employee receiving wages from more than one employer during a calendar
 * year…"*. The instructions say the same thing the other way round: *"If any
 * one employer withheld too much social security or tier 1 RRTA tax, you can't
 * claim the excess as a credit against your income tax. Your employer should
 * adjust the excess for you."* A single employer's over-withholding is the
 * employer's to refund under Reg. §31.6413(a)-1, and paying it here as well
 * would pay it twice. So a lone employer's box 4 can be any figure at all and
 * this line stays zero.
 *
 * **2. Employers are counted by `payerTin`, never by document.** A corrected
 * form, a successor filing, or simply two W-2s from one EIN do not create a
 * second wage base.
 *
 * **3. The base is per EMPLOYEE, so a joint return gets two of them.**
 * §6413(c)(1) is written about "an employee", and a married couple filing
 * jointly are two. One shared cap would understate the refund by up to the
 * whole maximum. The grouping key is the W-2's own `recipientTin` — box a, the
 * employee's SSN — and NOT the return profile, which carries no TIN at all.
 * That is also why this line needs no answer to "which spouse does this W-2
 * belong to", the question `fjs/form8880` refuses a joint return for being
 * unable to answer: the form itself says whose it is.
 *
 * **Every W-2 carrying box 4 is cited, including one whose employee did not
 * clear the two-employer gate.** The cited set is the set that was READ, and a
 * reader told the line is zero is owed the boxes that produced the zero.
 * @type {(taxParamSet: TaxParamSet) => (profile: Stored<ReturnProfile>) => (w2Forms: readonly Stored<W2>[]) => ReportLine}
 */
const excessSocialSecurityWithheldLine = taxParamSet => profile => w2Forms => {
    const rule = 'Schedule 3 line 11 (excess Social Security tax withheld -> 1040 line 31)'
    const readings = boxFourReadings(w2Forms)
    /** @type {readonly Source[]} */
    const sources = readings.map(reading => ({
        documentHash: reading.form.documentHash,
        boxPath: 'box4SocialSecurityTaxWithheld',
        value: reading.withheld,
    }))
    const maximum = socialSecurityWithholdingMaximum(taxParamSet)
    const employees = distinct(readings.map(employeeOf))
    const value = employees.reduce((total, employee) => {
        const theirs = readings.filter(reading => employeeOf(reading) === employee)
        const employers = distinct(theirs.map(employerOf))
        if (employers.length < 2) {
            return total
        }
        const withheld = theirs.reduce(
            (sum, reading) => sum + centsFromString(reading.withheld), 0n)
        // The `>` below is an EQUIVALENT MUTANT under `>=`, and that is
        // recorded here rather than left for the next reader to rediscover
        // (AGENTS.md, "the equivalent mutant"). The two operators differ at
        // exactly one input, `withheld === maximum`, and at that input the
        // subtraction in the other arm yields `0n` — the same value the `0n`
        // arm yields. The neighbouring arithmetic absorbs the whole
        // comparison, so `>=` cannot turn any leaf red at any input.
        //
        // What the comparison DOES carry is the floor, and that is not
        // absorbed: dropping the ternary entirely reddens
        // `twoEmployersUnderTheMaximumIsZero`, which would otherwise return a
        // NEGATIVE payment. The two boundary leaves pin the maximum itself —
        // `maximum + 1n` and `maximum - 1n` each redden six and seven leaves.
        return total + (withheld > maximum ? withheld - maximum : 0n)
    }, 0n)
    return documentLine(profile)(rule)(value)(sources)
}

/**
 * Every stored foreign income tax this engine can read, as citable
 * {@link Source}s — 1099-DIV box 7 and 1099-INT box 6, and nothing else.
 *
 * **Those two boxes are the whole set, and that is a checked fact rather than
 * an assumption.** The only other foreign-tax box in the document set is
 * `box21ForeignTaxesPaidOrAccrued` on `vnd.fjs.k1_1065`, and that dialect's
 * own `unmodeledMoneyBoxes` REFUSES any K-1 carrying a non-zero one at
 * validation — so a return whose §904(j)(2)(B) total this function would
 * understate cannot reach this module at all.
 *
 * A PRESENT box is cited even when it reads `'0.00'` (DOC-11); an absent box
 * produces no reading, which is what lets {@link documentLine} fall back to
 * the profile.
 * @type {(divForms: readonly Stored<OneZeroNineNineDiv>[]) => (intForms: readonly Stored<OneZeroNineNineInt>[]) => readonly Source[]}
 */
const foreignTaxSources = divForms => intForms => [
    ...divForms.flatMap(form => {
        const printed = form.value.box7ForeignTaxPaid
        return printed === undefined
            ? []
            : [{ documentHash: form.documentHash, boxPath: 'box7ForeignTaxPaid', value: printed }]
    }),
    ...intForms.flatMap(form => {
        const printed = form.value.box6ForeignTaxPaid
        return printed === undefined
            ? []
            : [{ documentHash: form.documentHash, boxPath: 'box6ForeignTaxPaid', value: printed }]
    }),
]

/**
 * Either Schedule 3 line 1, computed, or this module's refusal.
 * @typedef {{ readonly kind: 'ok', readonly line: ReportLine } | ScheduleThreeRefusal} ForeignTaxCreditOutcome
 */

/**
 * **Schedule 3 line 1 — the foreign tax credit, under §904(j) and only under
 * §904(j).** TAX-36; the whole argument lives in
 * `fjs/schedule/3/todo/foreign-tax-credit.md` and is summarised here.
 *
 * §901 allows the credit; §904(a) limits it to the US tax on foreign-source
 * income, and computing that limitation is what Form 1116 is. This engine does
 * not model Form 1116. §904(j)(2) is the exemption that makes a computable
 * line: an individual may ELECT out of the §904(a) limitation, and off Form
 * 1116 entirely, when
 *
 *   (A) the entire foreign-source gross income is *qualified passive income*
 *       — passive under §904(d)(2)(B) **and** shown on a payee statement
 *       (§904(j)(3)(A)),
 *   (B) the creditable foreign taxes do not exceed $300, or $600 on a joint
 *       return (§904(j)(2)(B)), and
 *   (C) the individual elects.
 *
 * The three are CONJUNCTIVE, and **this engine can verify exactly one of
 * them**: (B), which it performs here against
 * `fjs/tax/params`' own `foreignTaxCreditDeMinimisElection`. (A) is unobservable — neither
 * 1099 states how much of its ordinary dividends or interest was
 * foreign-source, nor which §904(d) category it fell in, and no stored
 * document could reveal foreign wages or rents that break the condition. (C)
 * is a choice, not a fact, and a costly one: §904(j)(1)(C) forbids carrying an
 * electing year's excess taxes back or forward under §904(c). So (A) and (C)
 * both ride on ONE taxpayer assertion,
 * `section904jElectionAllForeignIncomeIsQualifiedPassiveIncome` on
 * `vnd.fjs.return_profile`, whose name states both.
 *
 * **A small amount is not evidence the conditions hold.** $12.00 of foreign
 * tax is perfectly consistent with a taxpayer who also earned foreign wages,
 * for whom (A) fails at any figure. The threshold is (B) and only (B).
 *
 * REFUSES rather than zeroing, in both failing arms, and the asymmetry is the
 * one Schedule 1 line 14 argues: zeroing silently deletes a credit the
 * taxpayer is owed, and computing claims one whose §904(a) limitation nobody
 * computed. The engine cannot tell those apart without the assertion, so it
 * asks — carrying the taxpayer's OWN figures, because a refusal naming your
 * $847.00 and the $300.00 you would have had to be under is worth more than
 * one naming a form.
 *
 * **Exported and called by `fjs/form1040/core` BEFORE Schedule 2**, not
 * computed inside {@link scheduleThree}. `fjs/schedule/2`'s own
 * `ScheduleTwoInput` docstring recorded a cycle here — Form 6251 line 10
 * subtracts this line, and Schedule 3 runs after Schedule 2 because lines 3
 * and 4 read 1040 line 18 — and the cycle is not real: **line 1 has no tax
 * figure on its input side at all.** Under §904(j) the credit is the
 * creditable foreign taxes, full stop. So it is lifted out, run ONCE, and
 * handed to both schedules, the same "one execution, two destinations" shape
 * `form8863` and `form8959` already have.
 * @type {(taxParamSet: TaxParamSet) => (status: IndividualFilingStatus) => (profile: Stored<ReturnProfile>) => (divForms: readonly Stored<OneZeroNineNineDiv>[]) => (intForms: readonly Stored<OneZeroNineNineInt>[]) => ForeignTaxCreditOutcome}
 */
export const foreignTaxCreditLine = taxParamSet => status => profile => divForms => intForms => {
    const rule = 'Schedule 3 line 1 (foreign tax credit, §904(j) election -> 1040 line 20)'
    const sources = foreignTaxSources(divForms)(intForms)
    const total = sumSources(sources)
    const elected
        = profile.value.section904jElectionAllForeignIncomeIsQualifiedPassiveIncome === true
    // A present box reading `'0.00'` still CITES its document (DOC-11), and
    // needs no election: there is no credit to elect for. Gating the two
    // refusals on `total > 0n` rather than on the sources being non-empty is
    // what keeps a broker's zero-filled box 7 from refusing an ordinary
    // return.
    if (total > 0n && !elected) {
        const boxes = sources.map(source => `${source.documentHash} ${source.boxPath}`).join(', ')
        return {
            kind: 'error',
            message: `Schedule 3 line 1: ${centsToString(total)} of foreign tax is stored `
                + `(${boxes}) and this return does not elect §904(j). Claiming a foreign tax `
                + `credit otherwise requires Form 1116, which this engine does not compute. `
                + `Declare section904jElectionAllForeignIncomeIsQualifiedPassiveIncome on the `
                + `return profile to certify that the ENTIRE foreign-source gross income is `
                + `passive income shown on a payee statement and to make the §904(j) election `
                + `— which gives up carrying any excess credit back or forward under §904(c). `
                + `Refusing rather than dropping the amount and understating the credit`,
        }
    }
    const ceiling = centsFromString(taxParamSet.foreignTaxCreditDeMinimisElection[status].amount)
    if (total > ceiling) {
        return {
            kind: 'error',
            message: `Schedule 3 line 1: ${centsToString(total)} of foreign tax exceeds `
                + `§904(j)(2)(B)'s ${centsToString(ceiling)} ceiling for a ${status} return, `
                + `so the election is not available and the §904(a) limitation applies. That `
                + `limitation is Form 1116, which this engine does not compute. Refusing rather `
                + `than claiming an unlimited credit`,
        }
    }
    return { kind: 'ok', line: documentLine(profile)(rule)(total)(sources) }
}

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
 *
 * `foreignTaxCreditLine1` is printed line 1, ALREADY COMPUTED by
 * {@link foreignTaxCreditLine} and handed in rather than recomputed here.
 * `fjs/form1040/core` runs that function once, before Schedule 2, because
 * Form 6251 lines 8 and 10 need the same figure and Schedule 2 runs first —
 * see {@link foreignTaxCreditLine}'s own docstring for why the cycle
 * `fjs/schedule/2` recorded is not a real one. Taking it as an INPUT is what
 * makes "one execution" true rather than aspirational: a second call here
 * would be a second thing to go stale.
 * @typedef {{
 *   readonly profile: Stored<ReturnProfile>,
 *   readonly status: IndividualFilingStatus,
 *   readonly agiCents: bigint,
 *   readonly line18Cents: bigint,
 *   readonly w2Forms: readonly Stored<W2>[],
 *   readonly creditForms: readonly Stored<Credits>[],
 *   readonly tuitionForms: readonly Stored<OneZeroNineEightT>[],
 *   readonly aStored1099RProvesADistribution: boolean,
 *   readonly foreignTaxCreditLine1: ReportLine,
 *   readonly netPremiumTaxCreditLine9: ReportLine,
 *   readonly dependentCareCreditLine2: ReportLine,
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
        aStored1099RProvesADistribution, foreignTaxCreditLine1, netPremiumTaxCreditLine9,
        dependentCareCreditLine2,
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
        // The Credit Limit Worksheet's line 2: Schedule 3 lines 1 and 2 and
        // Schedule R. **Line 1 is REAL as of TAX-36 and line 2 as of TAX-38**
        // -- §26's ordering puts the foreign tax credit and the dependent care
        // credit ahead of the education credits, so both reduce what line 3
        // may claim, and a wiring that left either `0n` would overstate the
        // education credit by exactly that amount. Schedule R remains a
        // refused `fjs/return/scope` kind and therefore a documented zero.
        earlierScheduleThreeCreditsCents:
            foreignTaxCreditLine1.value + dependentCareCreditLine2.value,
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
        // 6l and 6m plus Forms 5695/8910/8936. Lines 1 and 3 are both real in
        // this engine as of TAX-36 and line 2 as of TAX-38, and all three
        // belong here -- which is the whole of §26's ordering among these
        // credits, expressed as the printed worksheet expresses it. Dropping
        // line 1 from this sum would overstate the saver's credit by exactly
        // the foreign tax credit, which is why `fjs/form1040/core` drives a
        // fixture carrying all three.
        earlierScheduleThreeCreditsCents:
            foreignTaxCreditLine1.value + dependentCareCreditLine2.value + line3.value,
        aStored1099RProvesADistribution,
    })
    if (saversOutcome.kind === 'error') {
        return saversOutcome
    }
    const line4 = fromDocuments("Schedule 3 line 4 (retirement savings contributions credit, Form 8880 line 12)")(
        saversOutcome.line12)([...contributionSources, ...deferralSources])

    // ── Part I: Nonrefundable Credits ────────────────────────────────────
    // 1. The foreign tax credit under §904(j), computed by
    //    {@link foreignTaxCreditLine} before this module ran. The hard zero
    //    is REPLACED, not supplemented -- on a return carrying 1099-DIV box 7
    //    or 1099-INT box 6 this line cites those boxes and not `declaredKinds`.
    const line1 = foreignTaxCreditLine1
    // 2. The credit for child and dependent care expenses, computed by
    //    `fjs/form2441`'s Part II before this module ran — the same ONE
    //    execution whose Part III already produced 1040 line 1e. The hard zero
    //    is REPLACED, not supplemented, exactly as line 1's was: on a return
    //    carrying dependent care expenses this line cites the documents behind
    //    them and not `declaredKinds`.
    //
    //    NONREFUNDABLE, which is why it sits here in Part I. Form 2441 line 10
    //    already capped it at the tax remaining after Schedule 3 line 1, so
    //    line 8 cannot exceed the tax on 1040 line 18.
    const line2 = dependentCareCreditLine2
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
    // 9. "Net premium tax credit. Attach Form 8962." ALREADY COMPUTED by
    //    `fjs/form8962` and handed in, never recomputed here -- the SAME
    //    execution produced Schedule 2 line 1a's excess advance repayment,
    //    and the two are the mutually exclusive arms of one comparison (Form
    //    8962 lines 24 and 25). Taking it as an INPUT is what makes "one
    //    execution" true rather than aspirational, exactly as
    //    `foreignTaxCreditLine1` above already is.
    //
    //    REFUNDABLE, which is why it sits here in Part II rather than among
    //    Part I's nonrefundable credits: it is paid out whether or not there
    //    is any tax to offset, and line 15 carries it to 1040 line 31.
    //
    //    For a return holding no Form 1095-A this is a profile-declared zero
    //    built by `fjs/form1040/core`, so an ordinary return's Part II is
    //    byte-for-byte what it was before Form 8962 existed.
    const line9 = netPremiumTaxCreditLine9
    // 10. The amount paid with a Form 4868 request for an automatic extension
    //     of time to file, off the return profile's own box. There is no
    //     information return for it -- the taxpayer holds a cheque stub, not a
    //     payee statement -- which is why it lives on the profile beside 1040
    //     lines 26, 35a and 36. `fjs/return/profile`'s check 7b refuses the
    //     amount unless `amountPaidWithExtensionRequest` is declared, so a
    //     figure here can never be an input the scope guard did not see.
    //     See `fjs/schedule/3/todo/amount-paid-with-extension.md`.
    const line10 = profileMoneyLine(profile)(
        'Schedule 3 line 10 (amount paid with request for extension to file -> 1040 line 31)')(
        'scheduleThreeLine10AmountPaidWithExtensionRequest')
    // 11. Excess Social Security tax withheld -- §31(b) via §6413(c)(1), read
    //     off Form W-2 box 4. The hard zero is REPLACED, not supplemented:
    //     there is no `zero(...)` call here, and on a return carrying box 4
    //     this line does not cite `declaredKinds` at all.
    const line11 = excessSocialSecurityWithheldLine(taxParamSet)(profile)(w2Forms)
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
    // Schedule 3 line 1 as `fjs/form1040/core` hands it in for a return with
    // no foreign tax anywhere: the profile-declared zero
    // {@link foreignTaxCreditLine} itself returns for that case, written out
    // here rather than by calling that function, so this fixture is not
    // produced by code under test.
    foreignTaxCreditLine1: {
        value: 0n,
        sources: [{
            documentHash: 'profile-hash-0001',
            boxPath: 'declaredKinds',
            value: '[]',
        }],
        rule: 'Schedule 3 line 1 (foreign tax credit, §904(j) election -> 1040 line 20)',
    },
    // Schedule 3 line 9 as `fjs/form1040/core` hands it in for a return
    // holding no Form 1095-A: the profile-declared zero that file builds for
    // that case, written out here rather than produced by calling anything,
    // so this fixture is not made by code under test.
    netPremiumTaxCreditLine9: {
        value: 0n,
        sources: [{
            documentHash: 'profile-hash-0001',
            boxPath: 'declaredKinds',
            value: '[]',
        }],
        rule: 'Schedule 3 line 9 (net premium tax credit, Form 8962 line 26 -> 1040 line 31)',
    },
    // Schedule 3 line 2 as `fjs/form1040/core` hands it in for a return with
    // no dependent care anywhere: the profile-declared zero that file builds
    // for that case, written out here rather than produced by calling
    // anything, so this fixture is not made by code under test.
    dependentCareCreditLine2: {
        value: 0n,
        sources: [{
            documentHash: 'profile-hash-0001',
            boxPath: 'declaredKinds',
            value: '[]',
        }],
        rule: 'Schedule 3 line 2 (credit for child and dependent care expenses, '
            + 'Form 2441 line 11 -> 1040 line 20)',
    },
    status: 'single',
    agiCents: 2000000n,          // $20,000.00 -- inside the saver's credit 50% band
    line18Cents: 100000000n,     // ample, so no credit limit binds
    w2Forms: [],
    creditForms: [],
    tuitionForms: [],
    aStored1099RProvesADistribution: false,
    ...overrides,
})

/**
 * A stored profile carrying Schedule 3 line 10's own amount, and the kind
 * `fjs/return/profile`'s check 7b demands beside it — so this fixture is one
 * the validator would accept, not merely one this module's types allow.
 * @type {(amount: string) => Stored<ReturnProfile>}
 */
const profileWithExtensionPayment = amount => ({
    documentHash: 'profile-hash-0001',
    value: {
        ...minimalProfileValue,
        declaredKinds: ['amountPaidWithExtensionRequest'],
        scheduleThreeLine10AmountPaidWithExtensionRequest: amount,
    },
})

/**
 * A stored 1099-DIV carrying box 7 and nothing else that matters here.
 * @type {(hash: string) => (foreignTax: string | undefined) => Stored<OneZeroNineNineDiv>}
 */
const dividendWithForeignTax = hash => foreignTax => ({
    documentHash: hash,
    value: {
        dialect: 'vnd.fjs.1099div',
        payerTin: '44-4444444',
        recipientTin: '222-22-2222',
        accountNumber: 'ACC-DIV',
        taxYear: 2025,
        formRevision: '2025',
        sourceArtifactHash:
            'deadbeef00112233445566778899aabbccddeeff0011223344556677889900',
        box1aTotalOrdinaryDividends: '4200.00',
        ...(foreignTax === undefined ? {} : { box7ForeignTaxPaid: foreignTax }),
    },
})

/**
 * A stored 1099-INT carrying box 6 — the OTHER foreign-tax box, so the two
 * can be shown summing together rather than one shadowing the other.
 * @type {(hash: string) => (foreignTax: string) => Stored<OneZeroNineNineInt>}
 */
const interestWithForeignTax = hash => foreignTax => ({
    documentHash: hash,
    value: {
        dialect: 'vnd.fjs.1099int',
        payerTin: '33-3333333',
        recipientTin: '222-22-2222',
        accountNumber: 'ACC-INT',
        taxYear: 2025,
        formRevision: '2025',
        box1InterestIncome: '900.00',
        box6ForeignTaxPaid: foreignTax,
    },
})

/**
 * A stored profile that makes the §904(j) election — the certification that
 * the ENTIRE foreign-source gross income is qualified passive income shown on
 * a payee statement, and the election itself.
 * @type {Stored<ReturnProfile>}
 */
const profileElectingSection904j = {
    documentHash: 'profile-hash-0001',
    value: {
        ...minimalProfileValue,
        declaredKinds: ['foreignTaxCredit'],
        section904jElectionAllForeignIncomeIsQualifiedPassiveIncome: true,
    },
}

/** Runs {@link foreignTaxCreditLine} for TY2025 against a filing status.
 * @type {(status: IndividualFilingStatus) => (profile: Stored<ReturnProfile>) => (divForms: readonly Stored<OneZeroNineNineDiv>[]) => (intForms: readonly Stored<OneZeroNineNineInt>[]) => ForeignTaxCreditOutcome}
 */
const foreignCredit = status => profile => divForms => intForms =>
    foreignTaxCreditLine(taxParams2025)(status)(profile)(divForms)(intForms)

/** Narrows {@link foreignTaxCreditLine}'s outcome to its computed line.
 * @type {(outcome: ForeignTaxCreditOutcome) => ReportLine}
 */
const foreignCreditLine = outcome => {
    assert(outcome.kind === 'ok', ['expected a computed Schedule 3 line 1', outcome])
    if (outcome.kind !== 'ok') { throw ['unreachable', outcome] }
    return outcome.line
}

/** Narrows it to its refusal.
 * @type {(outcome: ForeignTaxCreditOutcome) => string}
 */
const foreignCreditRefusal = outcome => {
    assert(outcome.kind === 'error', ['expected a refusal', outcome])
    if (outcome.kind !== 'error') { throw ['unreachable', outcome] }
    return outcome.message
}

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

/**
 * A stored Form W-2 carrying box 3 wages and, usually, box 4 Social Security
 * tax — the line 11 fixture.
 *
 * Every parameter is a parameter for a reason line 11 can get wrong:
 *
 * - `hash`, because the citation contract is ONE source per contributing
 *   document, and a fixture reusing one hash could not tell "two documents
 *   summed" from "one document counted twice".
 * - `payerTin`, because §6413(c)(1) counts EMPLOYERS, and two forms from one
 *   EIN are one employer.
 * - `recipientTin`, because the wage base is per EMPLOYEE, and a joint return
 *   has two.
 * - `wages` (box 3) is always present and always equals `tax / 6.2%` to the
 *   cent, so that a mutation transposing the box READ produces a wrong number
 *   rather than the same one. A fixture that left box 3 out would make that
 *   whole class of defect invisible.
 * - `tax` is `undefined` for the "this employer reported no box 4" case,
 *   which is a different fact from a reported `'0.00'` and is cited
 *   differently.
 * @type {(hash: string) => (payerTin: string) => (recipientTin: string) => (wages: string) => (tax: string | undefined) => Stored<W2>}
 */
const w2WithSocialSecurity = hash => payerTin => recipientTin => wages => tax => ({
    documentHash: hash,
    value: {
        dialect: 'vnd.fjs.w2',
        payerTin,
        recipientTin,
        accountNumber: '',
        taxYear: 2025,
        formRevision: '2025',
        box3SocialSecurityWages: wages,
        ...(tax === undefined ? {} : { box4SocialSecurityTaxWithheld: tax }),
    },
})

/** The taxpayer's own SSN in every line 11 fixture. @type {string} */
const taxpayerSsn = '222-22-2222'

/** The spouse's, used only by the joint-return leaf. @type {string} */
const spouseSsn = '333-33-3333'

/**
 * Schedule 3 line 11 over a set of Forms W-2 and nothing else.
 *
 * Every other input is `baseInput`'s empty case, so a non-zero line 11 can
 * only have come from the box under test.
 * @type {(w2Forms: readonly Stored<W2>[]) => ReportLine}
 */
const lineEleven = w2Forms => okResult(compute(baseInput({ w2Forms }))).line11

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
        // CORRECTED, not deleted. This leaf used to be called
        // `lineElevenIsStillADocumentedZeroEvenWithAW2Present` and asserted
        // line 11's old boundary: "this module now reads W-2s, and line 11
        // still does not." It does now. What survives is the half that is
        // still true and still worth pinning — a W-2 carrying box 12 and NO
        // box 4 leaves line 11 a profile-cited zero, because the filter is on
        // the BOX, not on the dialect. Renamed so the name states what it
        // proves; the value assertions are unchanged and the line-4 contrast
        // is kept, since it is what makes the W-2 demonstrably in scope.
        lineElevenIgnoresAW2ThatNeverReportedBoxFour: () => {
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
            // point: the W-2 is unquestionably in scope, and line 11 still
            // declines to cite it, because it reported no box 4.
            assert(result.line4.value > 0n, ['line 4 must be real', result.line4])
        },
    },

    // ── Line 1: the foreign tax credit, §904(j) only (TAX-36) ─────────────
    //
    // Every expected value is a hand-typed cent literal with its dollar
    // figure in the assertion message; the two thresholds ($300.00 and
    // $600.00) are likewise hand-typed here rather than read from the
    // parameter under test, and the boundary leaves straddle each to the
    // cent. Value and citation by SEPARATE leaves.
    lineOneForeignTaxCredit: {
        // The motivating taxpayer: one international index fund, $47.00 of
        // foreign tax withheld inside it, and the §904(j) election made.
        // Before this slice the whole $47.00 was dropped in silence.
        anElectedCreditUnderTheCeilingIsTheWholeForeignTax: () => {
            const line = foreignCreditLine(foreignCredit('single')(profileElectingSection904j)(
                [dividendWithForeignTax('sha256-div-ftc')('47.00')])([]))
            assertEq(line.value, 4700n, 'line 1 = $47.00 — the creditable foreign taxes, in full')
        },
        // The citation, on its own: ONE source per contributing document, at
        // the exact box, carrying the raw stored string.
        theCreditCitesEachContributingBox: () => {
            const line = foreignCreditLine(foreignCredit('single')(profileElectingSection904j)(
                [dividendWithForeignTax('sha256-div-ftc')('47.00')])(
                [interestWithForeignTax('sha256-int-ftc')('13.50')]))
            assertEq(line.value, 6050n, '$47.00 + $13.50 = $60.50')
            assertEq(line.sources.length, 2, 'one source per contributing document')
            const [dividend, interest] = line.sources
            assertEq(dividend.documentHash, 'sha256-div-ftc')
            assertEq(dividend.boxPath, 'box7ForeignTaxPaid')
            assertEq(dividend.value, '47.00')
            assertEq(interest?.documentHash, 'sha256-int-ftc')
            assertEq(interest?.boxPath, 'box6ForeignTaxPaid')
            assertEq(interest?.value, '13.50')
        },
        // **Both boxes, not one.** A wiring that read 1099-DIV box 7 and
        // forgot 1099-INT box 6 would look right on every single-document
        // fixture, so each is also shown carrying the line ALONE.
        eachOfTheTwoBoxesCarriesTheLineOnItsOwn: () => {
            const dividendOnly = foreignCreditLine(foreignCredit('single')(
                profileElectingSection904j)(
                [dividendWithForeignTax('sha256-div-solo')('20.00')])([]))
            assertEq(dividendOnly.value, 2000n, '1099-DIV box 7 alone = $20.00')
            assertEq(dividendOnly.sources[0]?.boxPath, 'box7ForeignTaxPaid')
            const interestOnly = foreignCreditLine(foreignCredit('single')(
                profileElectingSection904j)([])(
                [interestWithForeignTax('sha256-int-solo')('31.00')]))
            assertEq(interestOnly.value, 3100n, '1099-INT box 6 alone = $31.00')
            assertEq(interestOnly.sources[0]?.boxPath, 'box6ForeignTaxPaid')
        },
        // §904(j)(2)(B)'s ceiling, straddled to the cent on a SINGLE return.
        // $300.00 exactly is "does not exceed", so it computes; one cent more
        // is Form 1116 territory and refuses.
        threeHundredExactlyComputesAndThreeHundredAndOneCentRefuses: () => {
            const atTheCeiling = foreignCreditLine(foreignCredit('single')(
                profileElectingSection904j)(
                [dividendWithForeignTax('sha256-div-300')('300.00')])([]))
            assertEq(
                atTheCeiling.value, 30000n,
                '$300.00 exactly — §904(j)(2)(B) says "does not exceed", so it qualifies')
            const overIt = foreignCreditRefusal(foreignCredit('single')(
                profileElectingSection904j)(
                [dividendWithForeignTax('sha256-div-301')('300.01')])([]))
            assert(overIt.includes('300.01'), ['the refusal must name the taxpayer\'s own total', overIt])
            assert(overIt.includes('300.00'), ['and the ceiling they had to be under', overIt])
            assert(overIt.includes('Form 1116'), ['and the form that would compute it', overIt])
            assert(
                overIt.includes('Schedule 3 line 1'),
                ['and where the amount would have gone', overIt])
        },
        // …and the joint return's own $600.00, straddled the same way. THE
        // per-status mutation this catches is a ceiling read for the wrong
        // status: $450.00 computes on a joint return and refuses on a single
        // one, so one fixture at that figure distinguishes them.
        aJointReturnGetsSixHundredAndASingleFilerDoesNot: () => {
            const joint = foreignCreditLine(foreignCredit('marriedFilingJointly')(
                profileElectingSection904j)(
                [dividendWithForeignTax('sha256-div-450')('450.00')])([]))
            assertEq(joint.value, 45000n, '$450.00 — under §904(j)(2)(B)\'s joint-return $600.00')
            const single = foreignCreditRefusal(foreignCredit('single')(
                profileElectingSection904j)(
                [dividendWithForeignTax('sha256-div-450')('450.00')])([]))
            assert(single.includes('300.00'), ['a single filer\'s ceiling is $300.00', single])
            const atSixHundred = foreignCreditLine(foreignCredit('marriedFilingJointly')(
                profileElectingSection904j)(
                [dividendWithForeignTax('sha256-div-600')('600.00')])([]))
            assertEq(atSixHundred.value, 60000n, '$600.00 exactly still qualifies')
            const overSixHundred = foreignCreditRefusal(foreignCredit('marriedFilingJointly')(
                profileElectingSection904j)(
                [dividendWithForeignTax('sha256-div-60001')('600.01')])([]))
            assert(overSixHundred.includes('600.00'), ['and one cent over does not', overSixHundred])
        },
        // **A qualifying surviving spouse does NOT file a joint return**, so
        // the ceiling is $300.00. This is the trap
        // `additionalMedicareTaxThreshold` carries one parameter over, and it
        // is worth a leaf of its own because every OTHER per-status parameter
        // in this engine gives QSS the married-filing-jointly figure.
        aQualifyingSurvivingSpouseTakesThreeHundredNotSixHundred: () => {
            const refused = foreignCreditRefusal(foreignCredit('qualifyingSurvivingSpouse')(
                profileElectingSection904j)(
                [dividendWithForeignTax('sha256-div-qss')('450.00')])([]))
            assert(
                refused.includes('300.00'),
                ['a QSS return is not a JOINT return: §904(j)(2)(B) gives it $300.00', refused])
            assert(refused.includes('qualifyingSurvivingSpouse'), [refused])
        },
        // §904(j)(2)(C). Without the election the credit needs Form 1116, and
        // the engine REFUSES rather than zeroing — zeroing would silently
        // delete money the taxpayer is owed.
        aStoredForeignTaxWithNoElectionRefusesRatherThanZeroing: () => {
            const message = foreignCreditRefusal(foreignCredit('single')(
                profileNoDeclaredKinds)(
                [dividendWithForeignTax('sha256-div-noelect')('47.00')])([]))
            assert(message.includes('47.00'), ['the refusal must name the amount', message])
            assert(
                message.includes('sha256-div-noelect'),
                ['and the document it is stored on', message])
            assert(
                message.includes('box7ForeignTaxPaid'),
                ['and the box, so a reader can find it', message])
            assert(message.includes('Form 1116'), [message])
            assert(
                message.includes('section904jElectionAllForeignIncomeIsQualifiedPassiveIncome'),
                ['and the profile field that would make it computable', message])
            assert(
                message.includes('§904(c)'),
                ['and what the election costs — no carryback or carryforward', message])
            assert(
                message.includes('Schedule 3 line 1'),
                ['and where the amount would have gone', message])
        },
        // THE CONTROL for every refusal above: an election alone is not a
        // credit, and a return with no foreign tax anywhere is not refused.
        // Without this leaf a gate that refused every return would pass.
        aReturnWithNoForeignTaxIsAProfileDeclaredZero: () => {
            const line = foreignCreditLine(foreignCredit('single')(profileNoDeclaredKinds)(
                [dividendWithForeignTax('sha256-div-nobox')(undefined)])([]))
            assertEq(line.value, 0n)
            assertEq(line.sources.length, 1)
            assertEq(
                line.sources[0]?.boxPath, 'declaredKinds',
                'an ABSENT box produces no reading, so the line cites the profile')
        },
        // A PRESENT box reading `'0.00'` is a different state, and needs no
        // election: there is no credit to elect for. DOC-11 — a present box
        // cites its document.
        aStoredZeroBoxCitesItsDocumentAndNeedsNoElection: () => {
            const line = foreignCreditLine(foreignCredit('single')(profileNoDeclaredKinds)(
                [dividendWithForeignTax('sha256-div-zero')('0.00')])([]))
            assertEq(line.value, 0n)
            assertEq(line.sources.length, 1)
            assertEq(line.sources[0]?.boxPath, 'box7ForeignTaxPaid')
            assertEq(line.sources[0]?.value, '0.00')
        },
        // The line reaches Schedule 3's Part I total, and thence 1040 line
        // 20. `scheduleThree` takes the finished line as an INPUT, so this is
        // what proves it is added rather than discarded.
        theCreditReachesLineEight: () => {
            const result = okResult(compute(baseInput({
                profile: profileElectingSection904j,
                foreignTaxCreditLine1: foreignCreditLine(foreignCredit('single')(
                    profileElectingSection904j)(
                    [dividendWithForeignTax('sha256-div-total')('47.00')])([])),
            })))
            assertEq(result.line1.value, 4700n, 'line 1 = $47.00')
            assertEq(
                result.line8.value, 4700n,
                'line 8 = $47.00 -> 1040 line 20: lines 2, 3, 4, 5a, 5b and 7 are all zero')
            // …and NOT Part II. A nonrefundable credit is not a payment.
            assertEq(result.line15.value, 0n, 'a CREDIT is not an "other payment"')
        },
    },

    // ── Line 10: the amount paid with a Form 4868 extension request ───────
    //
    // Value and citation by SEPARATE leaves, per this file's own line 11
    // convention: a line that read the right box while citing nothing and a
    // line that cited the right box while reading zero are different defects.
    lineTen: {
        // The value, hand-typed as a cent literal with its dollar figure in
        // the message. $1,250.00 is the ONLY figure on this return, which is
        // what makes line 15 below unambiguous.
        theProfilesAmountIsReadIntoLineTen: () => {
            const result = okResult(compute(baseInput({
                profile: profileWithExtensionPayment('1250.00'),
            })))
            assertEq(result.line10.value, 125000n, 'line 10 = $1,250.00, paid with Form 4868')
        },
        // The citation, on its own, and asserting the RAW STORED STRING —
        // never a re-formatted one. `'1250.00'` went in and `'1250.00'` must
        // come back out, at the field's own boxPath on the profile's own
        // document hash.
        lineTenCitesTheProfileFieldWithTheRawStoredString: () => {
            const result = okResult(compute(baseInput({
                profile: profileWithExtensionPayment('1250.00'),
            })))
            assertEq(result.line10.sources.length, 1, 'exactly one source: the profile field')
            const [source] = result.line10.sources
            assertEq(source.documentHash, 'profile-hash-0001')
            assertEq(source.boxPath, 'scheduleThreeLine10AmountPaidWithExtensionRequest')
            assertEq(source.value, '1250.00')
            assert(
                result.line10.rule.includes('Schedule 3 line 10'),
                ['the rule must name its own printed line', result.line10.rule])
        },
        // It reaches line 15, and thence 1040 line 31. THE mutation this leaf
        // exists for is line 10 being dropped from line 15's summand list:
        // the line above computes perfectly and the money never arrives.
        lineTenReachesLineFifteen: () => {
            const result = okResult(compute(baseInput({
                profile: profileWithExtensionPayment('1250.00'),
            })))
            assertEq(
                result.line15.value, 125000n,
                'line 15 = $1,250.00 -> 1040 line 31: lines 9, 11, 12 and 14 are all zero')
            // …and line 8 is untouched. Part II's payment must not leak into
            // Part I's nonrefundable-credit total.
            assertEq(result.line8.value, 0n, 'a PAYMENT is not a nonrefundable credit')
        },
        // DOC-11's absent case, as a control for all three leaves above: with
        // the field left out, line 10 is the profile-declared zero it has
        // always been and cites `declaredKinds`, not a `'0.00'` no document
        // contains.
        anAbsentFieldLeavesLineTenAProfileDeclaredZero: () => {
            const result = okResult(compute(baseInput({})))
            assertEq(result.line10.value, 0n)
            assertEq(result.line10.sources.length, 1)
            assertEq(result.line10.sources[0]?.boxPath, 'declaredKinds')
        },
        // …and a STORED `'0.00'` is a different state from an absent field,
        // because the taxpayer did state it. The value agrees with the absent
        // case; the citation does not, and that is the whole of DOC-11.
        aStoredZeroCitesTheFieldRatherThanDeclaredKinds: () => {
            const result = okResult(compute(baseInput({
                profile: profileWithExtensionPayment('0.00'),
            })))
            assertEq(result.line10.value, 0n)
            assertEq(
                result.line10.sources[0]?.boxPath,
                'scheduleThreeLine10AmountPaidWithExtensionRequest',
                'a stored zero cites the box the taxpayer filled in')
            assertEq(result.line10.sources[0]?.value, '0.00')
        },
    },

    // ── Line 11: excess Social Security tax withheld (§31(b)/§6413(c)(1)) ──
    //
    // Every expected value below is a hand-typed cent literal with its dollar
    // figure in the assertion message, never derived from the sum under test.
    // The maximum those figures straddle — $176,100.00 x 6.2% = $10,918.20 —
    // is likewise never computed here: the two boundary leaves pin it to the
    // cent from outside, one at exactly the maximum and one a penny over.
    //
    // Value and citation are asserted by SEPARATE leaves. A line that summed
    // correctly while citing nothing and a line that cited correctly while
    // summing zero are different defects, and one leaf could not tell them
    // apart.
    lineEleven: {
        // §6413(c)(1)'s gate, first, because every other leaf depends on it
        // being open. ONE employer, under the maximum: nothing to refund, and
        // the document still cited because the box was read.
        oneEmployerUnderTheMaximumIsZeroAndStillCitesItsW2: () => {
            const line = lineEleven([
                w2WithSocialSecurity('sha256-w2-a')('11-1111111')(taxpayerSsn)('100000.00')('6200.00'),
            ])
            assertEq(line.value, 0n, '$6,200.00 withheld, well under $10,918.20')
            assertEq(line.sources.length, 1, 'the document, not the profile')
            assertEq(
                line.sources[0]?.boxPath, 'box4SocialSecurityTaxWithheld',
                'the box that was read')
        },
        // The control the gate needs: a single employer who withheld MORE
        // than the annual maximum. Reg. §31.6413(a)-1 makes that the
        // employer's to refund, so claiming it here would claim it twice.
        // Without this leaf, dropping the two-employer test entirely would go
        // unnoticed on every fixture in this block.
        oneEmployerOverTheMaximumIsStillZeroBecauseSixFourOneThreeCNeedsTwo: () => {
            const line = lineEleven([
                w2WithSocialSecurity('sha256-w2-a')('11-1111111')(taxpayerSsn)('193548.39')('12000.00'),
            ])
            assertEq(
                line.value, 0n,
                '$12,000.00 from ONE employer is that employer\'s to refund, never Schedule 3\'s')
            assertEq(line.sources.length, 1, 'and the box is still cited, so the zero is explicable')
        },
        // Two employers, combined UNDER the maximum. The floor at zero is
        // what makes this leaf zero rather than -$5,958.20, and it is the
        // only fixture in the block where a missing floor would leak.
        twoEmployersUnderTheMaximumIsZero: () => {
            const line = lineEleven([
                w2WithSocialSecurity('sha256-w2-a')('11-1111111')(taxpayerSsn)('48000.00')('2976.00'),
                w2WithSocialSecurity('sha256-w2-b')('22-2222222')(taxpayerSsn)('32000.00')('1984.00'),
            ])
            assertEq(line.value, 0n, '$2,976.00 + $1,984.00 = $4,960.00, under $10,918.20')
            assertEq(line.sources.length, 2, 'both documents cited even though the answer is zero')
        },
        // The main case: two employers, combined over the maximum.
        twoEmployersOverTheMaximumRefundTheExcess: () => {
            const line = lineEleven([
                w2WithSocialSecurity('sha256-w2-a')('11-1111111')(taxpayerSsn)('100000.00')('6200.00'),
                w2WithSocialSecurity('sha256-w2-b')('22-2222222')(taxpayerSsn)('96000.00')('5952.00'),
            ])
            assertEq(
                line.value, 123380n,
                '$6,200.00 + $5,952.00 = $12,152.00, less $10,918.20, is $1,233.80')
        },
        // The SAME fixture, citations only — the separate-leaf rule.
        theSameTwoEmployersAreCitedOncePerDocumentAtTheBoxThatWasRead: () => {
            const line = lineEleven([
                w2WithSocialSecurity('sha256-w2-a')('11-1111111')(taxpayerSsn)('100000.00')('6200.00'),
                w2WithSocialSecurity('sha256-w2-b')('22-2222222')(taxpayerSsn)('96000.00')('5952.00'),
            ])
            assertEq(line.sources.length, 2, 'one source per contributing document')
            assertEq(
                line.sources.map(source => source.documentHash).join(','),
                'sha256-w2-a,sha256-w2-b',
                'both documents cited, in document order')
            for (const source of line.sources) {
                assertEq(
                    source.boxPath, 'box4SocialSecurityTaxWithheld',
                    'box 4, never box 3 and never the profile')
            }
            assertEq(
                line.sources.map(source => source.value).join(','), '6200.00,5952.00',
                'each source carries the printed string its own form reported')
        },
        // Boundary, exactly at the maximum. $100,000.00 + $76,100.00 is the
        // wage base to the dollar, so this is the largest correctly withheld
        // pair that exists.
        exactlyAtTheMaximumIsZero: () => {
            const line = lineEleven([
                w2WithSocialSecurity('sha256-w2-a')('11-1111111')(taxpayerSsn)('100000.00')('6200.00'),
                w2WithSocialSecurity('sha256-w2-b')('22-2222222')(taxpayerSsn)('76100.00')('4718.20'),
            ])
            assertEq(line.value, 0n, '$6,200.00 + $4,718.20 = $10,918.20 exactly — nothing is excess')
        },
        // Boundary, one cent over. The pair above with seventeen more cents
        // of wages at the second employer.
        oneCentOverTheMaximumRefundsOneCent: () => {
            const line = lineEleven([
                w2WithSocialSecurity('sha256-w2-a')('11-1111111')(taxpayerSsn)('100000.00')('6200.00'),
                w2WithSocialSecurity('sha256-w2-b')('22-2222222')(taxpayerSsn)('76100.17')('4718.21'),
            ])
            assertEq(line.value, 1n, '$10,918.21 less $10,918.20 is $0.01')
        },
        // A W-2 with NO box 4 neither contributes nor is cited — and, just as
        // importantly, does not count as an employer. Three forms, three
        // EINs, and the answer is the two-employer answer.
        aW2WithNoBoxFourIsNeitherSummedNorCitedNorCountedAsAnEmployer: () => {
            const line = lineEleven([
                w2WithSocialSecurity('sha256-w2-a')('11-1111111')(taxpayerSsn)('100000.00')('6200.00'),
                w2WithSocialSecurity('sha256-w2-b')('22-2222222')(taxpayerSsn)('96000.00')('5952.00'),
                w2WithSocialSecurity('sha256-w2-c')('33-3333333')(taxpayerSsn)('5000.00')(undefined),
            ])
            assertEq(line.value, 123380n, 'the same $1,233.80 the two box-4 forms produce alone')
            assertEq(line.sources.length, 2, 'the third form is not cited')
            assertEq(
                line.sources.map(source => source.documentHash).join(','),
                'sha256-w2-a,sha256-w2-b',
                'and it is the third form specifically that is absent')
        },
        // The presence-not-value rule, as two leaves. A box that is absent
        // and a box present and zero are the same NUMBER and different FACTS;
        // only the citation tells them apart.
        aZeroBoxFourStillCitesItsDocument: () => {
            const line = lineEleven([
                w2WithSocialSecurity('sha256-w2-a')('11-1111111')(taxpayerSsn)('0.00')('0.00'),
            ])
            assertEq(line.value, 0n, 'a reported zero withholding')
            assertEq(line.sources.length, 1, 'the document, not the profile')
            assertEq(
                line.sources[0]?.boxPath, 'box4SocialSecurityTaxWithheld',
                'the form reported the box, so the form is what is cited')
        },
        noW2AtAllIsAProfileCitedZero: () => {
            const line = lineEleven([])
            assertEq(line.value, 0n, 'no Form W-2 at all')
            assertEq(line.sources.length, 1, 'the profile citation only')
            assertEq(
                line.sources[0]?.boxPath, 'declaredKinds',
                'a computed zero cites the profile, never a document the taxpayer lacks')
        },
        // Two W-2s from ONE employer are one employer. Same EIN, same
        // employee, combined well over the maximum — and no refund, because
        // §6413(c)(1) needs "more than one employer" and this is not two.
        twoW2sFromOneEmployerAreOneEmployer: () => {
            const line = lineEleven([
                w2WithSocialSecurity('sha256-w2-a')('11-1111111')(taxpayerSsn)('100000.00')('6200.00'),
                w2WithSocialSecurity('sha256-w2-b')('11-1111111')(taxpayerSsn)('96000.00')('5952.00'),
            ])
            assertEq(
                line.value, 0n,
                '$12,152.00 through one EIN — a corrected or successor form, not a second job')
            assertEq(line.sources.length, 2, 'both documents are still cited')
        },
        // The wage base is per EMPLOYEE. Two spouses, two employers each, and
        // the answer is the SUM OF TWO SEPARATE excesses — not one excess
        // over one shared maximum, which for this fixture would be
        // $23,312.00 - $10,918.20 = $12,393.80, ten times too much.
        aJointReturnGetsOneWageBasePerSpouse: () => {
            const line = okResult(compute(baseInput({
                status: 'marriedFilingJointly',
                w2Forms: [
                    w2WithSocialSecurity('sha256-w2-a')('11-1111111')(taxpayerSsn)('100000.00')('6200.00'),
                    w2WithSocialSecurity('sha256-w2-b')('22-2222222')(taxpayerSsn)('96000.00')('5952.00'),
                    w2WithSocialSecurity('sha256-w2-c')('33-3333333')(spouseSsn)('90000.00')('5580.00'),
                    w2WithSocialSecurity('sha256-w2-d')('44-4444444')(spouseSsn)('90000.00')('5580.00'),
                ],
            }))).line11
            assertEq(
                line.value, 147560n,
                'the taxpayer\'s $1,233.80 plus the spouse\'s $241.80 is $1,475.60')
            assertEq(line.sources.length, 4, 'all four documents cited')
        },
        // The other half of "per employee", and the case a real couple hits:
        // two spouses with ONE employer each, whose combined withholding is
        // over the maximum. Nothing is refundable — neither of them received
        // wages from more than one employer, so §6413(c)(1) never opens. A
        // return that pooled the two would hand back $1,481.80 that is not
        // owed, which is why this leaf exists beside the joint one below.
        twoSpousesWithOneEmployerEachRefundNothing: () => {
            const line = okResult(compute(baseInput({
                status: 'marriedFilingJointly',
                w2Forms: [
                    w2WithSocialSecurity('sha256-w2-a')('11-1111111')(taxpayerSsn)('100000.00')('6200.00'),
                    w2WithSocialSecurity('sha256-w2-b')('22-2222222')(spouseSsn)('100000.00')('6200.00'),
                ],
            }))).line11
            assertEq(
                line.value, 0n,
                '$12,400.00 between two people, one employer each — $0.00, not $1,481.80')
            assertEq(line.sources.length, 2, 'and both documents are still cited')
        },
        // The spouse's half of that sum on its own, so the joint figure above
        // is checkable by hand rather than only as a total.
        theSpousesOwnExcessIsComputedFromTheSpousesOwnTwoEmployers: () => {
            const line = lineEleven([
                w2WithSocialSecurity('sha256-w2-c')('33-3333333')(spouseSsn)('90000.00')('5580.00'),
                w2WithSocialSecurity('sha256-w2-d')('44-4444444')(spouseSsn)('90000.00')('5580.00'),
            ])
            assertEq(
                line.value, 24180n,
                '$5,580.00 + $5,580.00 = $11,160.00, less $10,918.20, is $241.80')
        },
        // Line 11 reaches Part II's total. Without this the line could be
        // computed correctly and dropped on the way to 1040 line 31.
        lineElevenReachesLineFifteen: () => {
            const result = okResult(compute(baseInput({
                w2Forms: [
                    w2WithSocialSecurity('sha256-w2-a')('11-1111111')(taxpayerSsn)('100000.00')('6200.00'),
                    w2WithSocialSecurity('sha256-w2-b')('22-2222222')(taxpayerSsn)('96000.00')('5952.00'),
                ],
            })))
            assertEq(
                result.line15.value, 123380n,
                'lines 9, 10, 11, 12 and 14 with only line 11 non-zero -> 1040 line 31')
            assert(
                result.line15.sources.some(source => source.documentHash === 'sha256-w2-a'),
                ['the total must carry line 11\'s own citations', result.line15.sources])
        },
        // The hard zero is REPLACED, not supplemented: on a return carrying
        // box 4, line 11 does not mention `declaredKinds` at all. The control
        // for `noW2AtAllIsAProfileCitedZero` above.
        aRealLineElevenNeverCitesTheProfile: () => {
            const line = lineEleven([
                w2WithSocialSecurity('sha256-w2-a')('11-1111111')(taxpayerSsn)('100000.00')('6200.00'),
                w2WithSocialSecurity('sha256-w2-b')('22-2222222')(taxpayerSsn)('96000.00')('5952.00'),
            ])
            assertEq(
                line.sources.filter(source => source.boxPath === 'declaredKinds').length, 0,
                'no `declaredKinds` source survives beside real document readings')
            assertEq(
                line.rule, 'Schedule 3 line 11 (excess Social Security tax withheld -> 1040 line 31)',
                'and the rule names the printed line and where it goes')
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
        // **§26 puts the FOREIGN TAX CREDIT first of all**, and these two
        // leaves are what prove line 1 reaches both Credit Limit Worksheets
        // rather than only Schedule 3's own total. A line computed correctly
        // and then dropped from a worksheet's summand is the exact defect
        // that survived three mutations in the Form 3903 slice.
        //
        // Hand-derived: line 18 = $1,550.00, line 1 = $100.00. Form 8863's
        // Credit Limit Worksheet line 2 is $100.00, so its line 3 (the limit)
        // is $1,450.00 and the education credit — which WANTED $1,500.00 —
        // is cut to $1,450.00. Line 8 = $100.00 + $1,450.00 = $1,550.00,
        // which is the whole tax and not a penny more.
        theForeignTaxCreditIsOrderedBeforeTheEducationCredit: () => {
            const result = okResult(compute(baseInput({
                profile: profileElectingSection904j,
                agiCents: 2000000n,
                line18Cents: 155000n,
                foreignTaxCreditLine1: foreignCreditLine(foreignCredit('single')(
                    profileElectingSection904j)(
                    [dividendWithForeignTax('sha256-div-order')('100.00')])([])),
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
            assertEq(result.line1.value, 10000n, 'line 1 = $100.00')
            assertEq(
                result.form8863.creditLimitWorksheet.c5, 10000n,
                'and it is Form 8863\'s Credit Limit Worksheet line 2 (`c5` here — the'
                + ' worksheet\'s own lines are numbered from its top, not the form\'s)')
            assertEq(
                result.form8863.creditLimitWorksheet.c6, 145000n,
                '$1,550.00 - $100.00 = $1,450.00 of room left for the education credit')
            assertEq(
                result.line3.value, 145000n,
                'so the education credit is cut from $1,500.00 to $1,450.00')
            assertEq(result.line8.value, 155000n, '$100.00 + $1,450.00 = the whole $1,550.00 tax')
        },
        // …and Form 8880's worksheet, one credit further down the same order.
        // Hand-derived: line 18 = $1,050.00, line 1 = $100.00, no education
        // credit — so Form 8880's Credit Limit Worksheet line 2 is $100.00,
        // its limit is $950.00, and the saver's credit, which WANTED
        // $1,000.00, is cut to $950.00.
        theForeignTaxCreditIsOrderedBeforeTheSaversCredit: () => {
            const result = okResult(compute(baseInput({
                profile: profileElectingSection904j,
                agiCents: 2000000n,
                line18Cents: 105000n,
                foreignTaxCreditLine1: foreignCreditLine(foreignCredit('single')(
                    profileElectingSection904j)(
                    [dividendWithForeignTax('sha256-div-savers')('100.00')])([])),
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
            assertEq(result.form8880.line10, 100000n, 'the saver\'s credit WANTED $1,000.00')
            assertEq(
                result.form8880.creditLimitWorksheet.w2, 10000n,
                'Form 8880\'s Credit Limit Worksheet line 2 is the $100.00 foreign tax credit')
            assertEq(result.line4.value, 95000n, 'so it gets $950.00, not $1,000.00')
            assertEq(result.line8.value, 105000n, '$100.00 + $950.00 = the whole $1,050.00 tax')
        },

        // TAX-38: line 2 joins line 1 ahead of BOTH later credits, and §26
        // says so. $1,050.00 of tax, a $100.00 dependent care credit on line 2
        // and a saver's credit that wanted $1,000.00: Form 8880's Credit Limit
        // Worksheet line 2 must be that $100.00, so the saver's credit gets
        // $950.00.
        //
        // The identical shape as `theForeignTaxCreditIsOrderedBeforeTheSavers
        // Credit` above, and deliberately so: line 2 was a hard zero in that
        // worksheet's sum until this phase, and a wiring that added the line
        // to Part I without adding it to the two worksheets would leave 1040
        // line 20 exceeding the tax on line 18.
        theDependentCareCreditIsOrderedBeforeTheSaversCredit: () => {
            const result = okResult(compute(baseInput({
                agiCents: 2000000n,
                line18Cents: 105000n,
                dependentCareCreditLine2: {
                    value: 10000n,
                    sources: [{
                        documentHash: 'sha256-2441-w2',
                        boxPath: 'box10DependentCareBenefits',
                        value: '8000.00',
                    }],
                    rule: 'Schedule 3 line 2 (credit for child and dependent care expenses, '
                        + 'Form 2441 line 11 -> 1040 line 20)',
                },
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
            assertEq(result.line2.value, 10000n, 'the $100.00 dependent care credit is on line 2')
            assertEq(result.form8880.line10, 100000n, 'the saver\'s credit WANTED $1,000.00')
            assertEq(
                result.form8880.creditLimitWorksheet.w2, 10000n,
                'Form 8880\'s Credit Limit Worksheet line 2 is that $100.00')
            assertEq(result.line4.value, 95000n, 'so it gets $950.00, not $1,000.00')
            assertEq(
                result.line8.value, 105000n,
                '$100.00 + $950.00 = the whole $1,050.00 tax, and never more than it')
        },
        // The same ordering one credit earlier: line 2 also reduces what the
        // EDUCATION credit may claim, through Form 8863's own Credit Limit
        // Worksheet. Two leaves rather than one, because the two worksheets
        // are two separate sums in this module and adding line 2 to one of
        // them is exactly the half-finished wiring worth catching.
        theDependentCareCreditIsOrderedBeforeTheEducationCredits: () => {
            const result = okResult(compute(baseInput({
                agiCents: 2000000n,
                line18Cents: 150000n,
                dependentCareCreditLine2: {
                    value: 50000n,
                    sources: [{
                        documentHash: 'sha256-2441-w2',
                        boxPath: 'box10DependentCareBenefits',
                        value: '8000.00',
                    }],
                    rule: 'Schedule 3 line 2 (credit for child and dependent care expenses, '
                        + 'Form 2441 line 11 -> 1040 line 20)',
                },
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
            assertEq(result.line2.value, 50000n, '$500.00 of dependent care credit')
            assertEq(
                result.form8863.creditLimitWorksheet.c5, 50000n,
                'Form 8863\'s Credit Limit Worksheet subtracts that $500.00')
            assertEq(
                result.line3.value, 100000n,
                'so the education credit is capped at $1,000.00 rather than the $1,500.00 tax')
            assertEq(result.line8.value, 150000n, 'and 1040 line 20 is exactly the tax')
        },

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
