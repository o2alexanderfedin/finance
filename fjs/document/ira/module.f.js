/**
 * `vnd.fjs.ira` — the taxpayer-asserted IRA record behind 1040 line 4b:
 * §408(d)(8)'s qualified charitable distribution ELECTION (TAX-28) and Form
 * 8606 Part I's asserted inputs (TAX-29). Phase 26.
 *
 * **This dialect is not a transcribed IRS form**, the identical opening
 * `vnd.fjs.credits`, `vnd.fjs.adjustments`, `vnd.fjs.medical_expenses` and
 * `vnd.fjs.itemized_deductions` all make, and every design decision those
 * dialects settled is followed here rather than re-argued: no `formRevision`
 * (DOC-10 exists because printed box semantics drift, and there is no printed
 * form here), no stored total or computed figure (it would be a second source
 * of truth able to disagree with the entries it came from), and no
 * income-dependent computation. The subject convention is theirs too:
 * `formSubject` keys on `(payerTin, recipientTin, accountNumber, taxYear,
 * formType)` (DOC-01), and this record has no payer and no account, so both
 * are `''` — one record per PERSON per tax year.
 *
 * ## Why the two halves share one record
 *
 * `vnd.fjs.credits`' own header argues that a teacher's classroom supplies
 * and a health savings account contribution belong in one record for a reason
 * about PROVENANCE rather than subject matter. The argument is stronger here,
 * because the two halves are not merely alike — **they interact
 * arithmetically**. §408(d)(8)(D) makes a QCD come first out of the pre-tax
 * portion of the IRA, and Form 8606's printed line 7 excludes QCDs from the
 * distributions its pro-rata fraction is applied to. Splitting them across
 * two documents would put the two sides of one computation in two places that
 * could disagree about which distributions a QCD came out of.
 *
 * ## The QCD is an ELECTION, and nothing on any Form 1099-R says one happened
 *
 * This is the fact the whole TAX-28 half exists for, and it is worth stating
 * plainly because it is the reason the engine was silently overstating the
 * tax before this phase:
 *
 * > *"There is no special code for a QCD."* — the IRS's own QCD reminder.
 *
 * The custodian reports the FULL distribution in box 1, typically repeats it
 * in box 2a, and checks box 2b "taxable amount not determined". Nothing in
 * that document distinguishes a $20,000 gift to a food bank from a $20,000
 * withdrawal to buy a car. The filer writes "QCD" beside 1040 line 4b and
 * reduces the taxable amount themselves. So a QCD is expressible ONLY as a
 * taxpayer assertion, and this dialect is the only place it can live.
 *
 * ## `attainedAgeSeventyAndAHalfAtEveryDistributionBelow`, and why an
 *    assertion rather than a derivation
 *
 * §408(d)(8)(B)(ii), restated by the printed instruction: *"You must have
 * been at least age 70 1/2 **when the distribution was made**."*
 *
 * **This engine cannot determine that fact, and this is the finding TAX-28
 * turns on.** Two things are missing, and either alone would be fatal:
 *
 * 1. **No birth date is stored anywhere in this repository.** The nearest
 *    thing is `vnd.fjs.return_profile`'s `taxpayerBornBeforeJan2_1961`, which
 *    is 1040 line 12d's checkbox — a test for having reached **65** by the
 *    close of TY2025. That is a different age, four and a half years short,
 *    and reading it as a 70½ test is exactly the approximation this phase was
 *    told to refuse. (`vnd.fjs.credits`' own header records the same gap from
 *    the other direction: *"`vnd.fjs.return_profile` carries a 65-or-older
 *    checkbox and no other age at all."*)
 * 2. **The test is at the DATE OF THE DISTRIBUTION, not at year end.** Even a
 *    stored birth date would not settle it: someone who turns 70½ on 1
 *    October has a September distribution that is not a QCD and a November
 *    one that is. The only date available is Form 1099-R box 13, which this
 *    repository stores as free text precisely because it has no date
 *    primitive (`fjs/document/1099r`'s own header).
 *
 * So the fact is ASSERTED, and `fjs/form8606` REFUSES BY NAME when a QCD is
 * claimed without it — never denying the exclusion silently and never
 * granting it on the strength of the 65 checkbox. The field is named for what
 * it asserts (*at every distribution below*), not for the outcome it
 * produces, following `vnd.fjs.credits`' own naming discipline for its four
 * non-uniform Part III facts.
 *
 * There is one direction the engine CAN check, and `fjs/form8606` checks it:
 * attaining 70½ during 2025 implies having been born on or before roughly 1
 * July 1955, which implies the line-12d box is checked. The 65 test is
 * therefore NECESSARY but nowhere near SUFFICIENT, and an unchecked box
 * contradicts the assertion.
 *
 * ## Each QCD names the distribution it came out of
 *
 * `payerTin` and `accountNumber` are three-fifths of DOC-01's own form key,
 * and together with this record's `recipientTin` and `taxYear` they identify
 * exactly one stored Form 1099-R. That matching is not bookkeeping — it is
 * what makes three separate refusals possible, and all three are
 * `fjs/form8606`'s:
 *
 * - a QCD claimed against a **401(k) or pension** rather than an IRA
 *   (§408(d)(8)(B) reaches an IRA only, and `box7bIraSepSimple` is what says
 *   which);
 * - a QCD **larger than the distribution it claims to come from**;
 * - a QCD naming a distribution that **is not in the store**, or two of them.
 *
 * A design carrying only a bare total could raise none of the three, and a
 * bare total is what a taxpayer would most naturally have wanted to supply.
 *
 * `charity` is free text and is never matched against anything — §170(b)(1)(A)
 * eligibility is not a fact any document here carries. It exists so a refusal
 * can name WHICH gift a reader should go and look at, exactly as
 * `vnd.fjs.adjustments`' and `vnd.fjs.credits`' own `description` fields do.
 *
 * ## `oneTimeSplitInterestElection` is storable and REFUSED, deliberately
 *
 * §408(d)(8)(F) allows one lifetime QCD of up to $54,000 (TY2025, indexed) to
 * a charitable remainder trust or charitable gift annuity. `fjs/form8606`
 * refuses it by name rather than computing it, and the field exists so the
 * refusal can be raised at all: a dialect that simply had no way to express
 * the election would silently compute the ORDINARY QCD rules for it, which
 * are the wrong rules — the SIE election is once per lifetime (a fact
 * spanning every year this engine cannot see), it has its own smaller cap
 * inside the annual one, and it requires a statement attached to the return.
 *
 * ## Form 8606's asserted half: three figures, and one of them is the crux
 *
 * - `nondeductibleContributionsThisYear` — printed line 1. No information
 *   return reports it in time: Form 5498 is furnished by **May 31**, after
 *   the return is due, which is `vnd.fjs.credits`' own recorded reason for
 *   asserting an IRA contribution rather than transcribing one.
 * - `contributionsMadeAfterYearEnd` — printed line 4, the part of line 1 made
 *   between 1 January and 15 April of the following year. Subtracted at line
 *   5, so it is a genuine reducer of the pro-rata numerator and not a memo.
 * - `yearEndValueOfAllTraditionalSepSimpleIras` — printed line 6, **and this
 *   is the figure the whole requirement turns on.** §408(d)(2) aggregates:
 *   the pro-rata fraction's denominator is the total year-end value of every
 *   traditional, SEP and SIMPLE IRA the person owns, treated as ONE contract.
 *   Not per account. No Form 1099-R reports it, no Form 5498 arrives in time,
 *   and there is no defensible default — so it is asserted, and `fjs/form8606`
 *   REFUSES rather than assuming zero when a Part I computation needs it.
 *   Getting this wrong understates tax for anyone with more than one IRA,
 *   which is why `fjs/form8606` proves a two-IRA case distinct from a one-IRA
 *   case at the same total.
 *
 * ## Two fields that exist only to be refused by name — and one that graduated
 *
 * `hadOutstandingRolloverOrRecharacterization` (lines 6 and 7's own
 * exclusions) and `hadQualifiedDisasterDistributionOrPlanRepayment` (lines
 * 15b and 15c's Form 8915-F and repayment adjustments) are storable and
 * refused by `fjs/form8606`. The reasoning is `vnd.fjs.credits`'
 * `filerAttainedAgeTwentyFourBeforeTheEndOfTheYear` exactly: a fact that
 * cannot be STORED cannot be REFUSED, and a computation that silently ignores
 * a fact it does not model is the failure this whole repository is organized
 * against.
 *
 * **`netAmountConvertedToRothIras` (line 8) was the third, and Phase 31
 * promoted it from refused to COMPUTED** — the field did not change, only what
 * reads it. That is the payoff of storing a fact in order to refuse it: the
 * dialect needed no migration and no stored document became invalid when Part
 * II was built. It is worth recording as the outcome this pattern was betting
 * on, since the bet is usually made without evidence.
 *
 * **Part III (distributions from Roth IRAs) still has no field here**, and it
 * never will: `fjs/form8606` detects it off Form 1099-R box 7a's own Roth
 * distribution codes, because a Roth distribution arrives on a DOCUMENT rather
 * than as an assertion. Phase 31 computes the one code a single year supports
 * (`Q`, a qualified distribution, tax-free) and refuses `J` and `T` by name for
 * the specific multi-year facts each is missing. What Part III would need —
 * cumulative Roth contribution and conversion bases over every prior year — is
 * a multi-year store, not another field on this record.
 *
 * Sources, fetched and read directly rather than recalled: `f8606.pdf` and
 * `i8606.pdf` (2025 revisions), and `i1040gi.pdf`'s own Line 4a/4b
 * "Exception 3" paragraph.
 *
 * @module
 */
import { array, number, option, string } from 'functionalscript/fjs/types/rtti/module.f.mjs'
import { validate as rttiValidate } from 'functionalscript/fjs/types/rtti/validate/module.f.mjs'
import { error, ok } from 'functionalscript/fjs/types/result/module.f.mjs'
import { assert, assertEq } from 'functionalscript/fjs/asserts/module.f.mjs'
import { base, mediaTypeOf } from '../base/module.f.js'
import { moneyFieldError } from '../money_field/module.f.js'
import { centsFromString } from '../../exact/module.f.js'

/** @import { Result } from 'functionalscript/fjs/types/result/types.js' */
/** @import { Ts, Unknown } from 'functionalscript/fjs/types/rtti/ts/types.js' */
/** @import { ValidationError } from 'functionalscript/fjs/types/rtti/common/types.js' */

/**
 * Format tag: names the dialect of this BLOB. The media type it is served
 * with is derived mechanically: `application/` + `dialect` + `+json`.
 */
export const dialect = 'vnd.fjs.ira'
/** The media type derived from {@link dialect}: `application/vnd.fjs.ira+json`. */
export const mediaType = mediaTypeOf(dialect)

/**
 * One qualified charitable distribution the taxpayer elects — see this
 * module's own docstring, "Each QCD names the distribution it came out of",
 * for why `payerTin`/`accountNumber` are here rather than a bare total.
 */
const qualifiedCharitableDistributionEntry = /** @type {const} */ ({
    payerTin: string,
    accountNumber: string,
    charity: string,
    amount: string,
    oneTimeSplitInterestElection: option(true),
})

/**
 * rtti schema for an `ira` BLOB. `dialect` is spread first (via `base`) so
 * structural validation reports it as the first failing field on a mismatched
 * blob (DOC-00's discriminant). NO `formRevision` — DOC-10 does not apply;
 * there is no printed form.
 *
 * Every field past the four header fields is `option`: a record carrying only
 * a QCD election, a record carrying only a Form 8606 basis, and a record
 * carrying both are all real states, and so — pointlessly but legitimately —
 * is a record carrying neither.
 */
export const iraSchema = /** @type {const} */ ({
    ...base(dialect),
    recipientTin: string,
    taxYear: number,
    corrected: option(true),
    // ── TAX-28: §408(d)(8)'s election ───────────────────────────────────────
    // §408(d)(8)(B)(ii)'s age test, ASSERTED because it is not derivable —
    // see this module's own docstring for the two independent reasons.
    attainedAgeSeventyAndAHalfAtEveryDistributionBelow: option(true),
    qualifiedCharitableDistributions: option(array(qualifiedCharitableDistributionEntry)),
    // ── TAX-29: Form 8606 Part I's asserted inputs ──────────────────────────
    nondeductibleContributionsThisYear: option(string),          // printed line 1
    contributionsMadeAfterYearEnd: option(string),               // printed line 4
    yearEndValueOfAllTraditionalSepSimpleIras: option(string),   // printed line 6
    // ── Three facts stored ONLY so `fjs/form8606` can refuse them by name ───
    netAmountConvertedToRothIras: option(string),                // printed line 8, Part II
    hadOutstandingRolloverOrRecharacterization: option(true),    // lines 6 and 7's exclusions
    hadQualifiedDisasterDistributionOrPlanRepayment: option(true), // lines 15b and 15c
})

/** @typedef {Ts<typeof iraSchema>} Ira */

/** Structural-only validator: checks the shape, not the semantic refinements below. */
const validateShape = rttiValidate(iraSchema)

/**
 * Either a structural validation error or a semantic (string) error message.
 * @typedef {ValidationError | string} IraError
 */

/**
 * The scalar money fields, walked in a loop so the exactness check is written
 * once. Typed via `@type {const}` (not a wider `keyof Ira`) so `r[field]`
 * resolves to exactly `string | undefined` — the same device
 * `fjs/document/1099r`'s own `moneyBoxFields` uses, and named at module scope
 * so {@link checkReferences}' loop and the proof that counts the list walk the
 * identical array (AGENTS.md, "one rule, one place").
 *
 * Deliberately carries NO second `@type` annotation spelling the four names
 * out: an annotation would make dropping a field a two-line edit that `tsc`
 * catches, which sounds stronger and is weaker — it would move the guarantee
 * off {@link expectedMoneyFieldCount} (which survives a widened annotation)
 * and onto the compiler (which does not survive the annotation being edited
 * in the same commit). See `fjs/tax/params`'
 * `neitherLimitIsKeyedByFilingStatus` for the case where this repository
 * deliberately made the opposite choice, and why.
 */
const moneyFields = /** @type {const} */ ([
    'nondeductibleContributionsThisYear',
    'contributionsMadeAfterYearEnd',
    'yearEndValueOfAllTraditionalSepSimpleIras',
    'netAmountConvertedToRothIras',
])

/**
 * Independently hand-typed: the number of scalar money fields
 * {@link moneyFields} names today. Deliberately NOT `moneyFields.length` —
 * a field dropped from the list would otherwise shrink the generated proof's
 * own iteration set at the same instant, and the duplication is the mechanism
 * (AGENTS.md's fourth shipped defect).
 * @type {number}
 */
const expectedMoneyFieldCount = 4

/**
 * Checks the semantic refinements the structural schema cannot express:
 *
 * 1. Every PRESENT scalar money field is an exact decimal within safe
 *    magnitude, and is not negative. None of the four can be: a
 *    contribution, an account value and a conversion are all amounts the
 *    printed form has no negative box for.
 * 2. Every QCD `amount` is an exact decimal and is STRICTLY POSITIVE. A
 *    zero-amount QCD is not a gift and a negative one is not a distribution;
 *    both would silently move 1040 line 4b in a direction §408(d)(8) does not
 *    authorize, and the second would move it UPWARD.
 * 3. Printed line 4 (`contributionsMadeAfterYearEnd`) does not exceed printed
 *    line 1 (`nondeductibleContributionsThisYear`), and is not present
 *    without it. The printed line reads *"Enter **those contributions
 *    included on line 1** that were made from January 1, 2026, through April
 *    15, 2026"* — it is a subset of line 1 by construction, and line 5's
 *    `line 3 − line 4` is where a violation would otherwise silently shrink
 *    the pro-rata numerator.
 *
 * Every refusal names the offending FIELD and its VALUE — and, for a QCD, the
 * charity, so a reader with five gifts knows which one to look at.
 *
 * Deliberately NOT checked here: whether a QCD's `payerTin`/`accountNumber`
 * resolve to a stored Form 1099-R, whether the age assertion is present, and
 * whether any of the three refusal-only facts is set. All of those are
 * questions about the return as a whole rather than about this document, and
 * they belong to `fjs/form8606` — the same layering `vnd.fjs.credits` and
 * `fjs/form8880` already use, where the dialect stores facts and the form
 * module owns every "cannot compute".
 * @type {(r: Ira) => Result<Ira, IraError>}
 */
export const checkReferences = r => {
    for (const field of moneyFields) {
        const printed = r[field]
        if (printed === undefined) {
            continue
        }
        const message = moneyFieldError(field)(printed)
        if (message !== undefined) {
            return error(message)
        }
        if (centsFromString(printed) < 0n) {
            return error(
                `${field} is negative (${printed}) — Form 8606 Part I has no negative box for a `
                + `contribution, an account value or a conversion`)
        }
    }
    for (const entry of r.qualifiedCharitableDistributions ?? []) {
        const message = moneyFieldError(`amount for the QCD to ${entry.charity}`)(entry.amount)
        if (message !== undefined) {
            return error(message)
        }
        if (centsFromString(entry.amount) <= 0n) {
            return error(
                `the QCD to ${entry.charity} is ${entry.amount} — a qualified charitable `
                + `distribution must be a strictly positive amount, since §408(d)(8) EXCLUDES it `
                + `from income and a non-positive one would move 1040 line 4b the wrong way`)
        }
    }
    const line1 = r.nondeductibleContributionsThisYear
    const line4 = r.contributionsMadeAfterYearEnd
    if (line4 !== undefined) {
        if (line1 === undefined) {
            return error(
                `contributionsMadeAfterYearEnd (${line4}) is present without `
                + `nondeductibleContributionsThisYear — Form 8606's printed line 4 is "those `
                + `contributions INCLUDED ON LINE 1", so it cannot exist on its own`)
        }
        if (centsFromString(line4) > centsFromString(line1)) {
            return error(
                `contributionsMadeAfterYearEnd (${line4}) exceeds `
                + `nondeductibleContributionsThisYear (${line1}) — Form 8606's printed line 4 is a `
                + `subset of line 1, and line 5 subtracts it`)
        }
    }
    return ok(r)
}

/**
 * Validates an already-parsed JSON value as an `ira` BLOB: structural (rtti)
 * validation followed by {@link checkReferences}. Dialect discrimination
 * happens exclusively through the schema's exact-literal `dialect` constant —
 * the serialized JSON text is never inspected.
 * @type {(value: Unknown) => Result<Ira, IraError>}
 */
export const validate = value => {
    const [t, v] = validateShape(value)
    if (t === 'error') {
        return error(v)
    }
    return checkReferences(v)
}

// ── Tests ────────────────────────────────────────────────────────────────────

/** @type {Ira} */
const minimal = {
    dialect,
    recipientTin: '222-22-2222',
    taxYear: 2025,
}

/** One ordinary QCD: $20,000 to a food bank out of a single IRA. */
const foodBankGift = {
    payerTin: '11-1111111',
    accountNumber: 'IRA-0001',
    charity: 'Riverside Food Bank',
    amount: '20000.00',
}

/**
 * One generated leaf per NAMED scalar money field: a comma-grouped amount in
 * that field alone must be refused, and the refusal must NAME the field.
 * Built by mapping {@link moneyFields} itself into `[field, assertion]` pairs
 * — the same idiom `fjs/document/1099r`'s generated leaves use — so a field
 * added to the list later is covered automatically. A field's own leaf
 * disappears WITH it if it is dropped, which is what
 * {@link expectedMoneyFieldCount} exists to catch.
 * @type {{ readonly [field: string]: () => void }}
 */
const generatedMoneyFieldExactnessProof = Object.fromEntries(
    moneyFields.map(field => [
        field,
        () => {
            const [t, v] = validate({ ...minimal, [field]: '1,234.56' })
            assertEq(t, 'error', ['expected a comma-grouped amount to be refused', field, t, v])
            assert(typeof v === 'string', ['expected a semantic string refusal', field, v])
            assert(v.includes(field), ['expected the refusal to name the field', field, v])
        },
    ]),
)

/**
 * Same idiom, for the sign check: a negative amount in each field alone must
 * be refused, naming the field AND quoting the value.
 *
 * `nondeductibleContributionsThisYear: '0.00'` is on the base fixture rather
 * than the leaf, and it is load-bearing for exactly one of the four:
 * `contributionsMadeAfterYearEnd` cannot appear without line 1 at all
 * (`checkReferences` step 3), so without it this leaf's own CONTROL would
 * pass for the wrong reason — refused by the subset rule instead of accepted
 * by the sign rule. Found by running the leaf, not by reading it.
 * @type {{ readonly [field: string]: () => void }}
 */
const generatedMoneyFieldSignProof = Object.fromEntries(
    moneyFields.map(field => [
        field,
        () => {
            const base = { ...minimal, nondeductibleContributionsThisYear: '0.00' }
            const [t, v] = validate({ ...base, [field]: '-0.01' })
            assertEq(t, 'error', ['expected a negative amount to be refused', field, t, v])
            assert(typeof v === 'string', ['expected a semantic string refusal', field, v])
            assert(v.includes(field), ['expected the refusal to name the field', field, v])
            assert(v.includes('-0.01'), ['expected the refusal to quote the value', field, v])
            // ±1¢: the boundary is `< 0`, not `<= 0`. Zero is a real figure —
            // an IRA fully distributed by 31 December has a year-end value of
            // exactly this — so the control sits beside the gate.
            assertEq(validate({ ...base, [field]: '0.00' })[0], 'ok', field)
        },
    ]),
)

export const proof = {
    dialectAndMediaType: () => {
        assertEq(dialect, 'vnd.fjs.ira')
        assertEq(mediaType, 'application/vnd.fjs.ira+json')
    },
    validate: {
        // A record with neither half is a real state, and it is not the same
        // as having no document.
        emptyRecordValidates: () => {
            const [t, v] = validate(minimal)
            assert(t === 'ok', ['expected ok', t, v])
            assertEq(v.qualifiedCharitableDistributions, undefined)
            assertEq(v.yearEndValueOfAllTraditionalSepSimpleIras, undefined)
            assertEq(v.attainedAgeSeventyAndAHalfAtEveryDistributionBelow, undefined)
        },
        bothHalvesTogetherRoundTrip: () => {
            const [t, v] = validate({
                ...minimal,
                attainedAgeSeventyAndAHalfAtEveryDistributionBelow: true,
                qualifiedCharitableDistributions: [foodBankGift],
                nondeductibleContributionsThisYear: '7000.00',
                contributionsMadeAfterYearEnd: '2000.00',
                yearEndValueOfAllTraditionalSepSimpleIras: '180000.00',
            })
            assert(t === 'ok', ['expected ok', t, v])
            assertEq(v.qualifiedCharitableDistributions?.length, 1)
            assertEq(v.qualifiedCharitableDistributions?.[0]?.amount, '20000.00')
            assertEq(v.qualifiedCharitableDistributions?.[0]?.charity, 'Riverside Food Bank')
            assertEq(v.qualifiedCharitableDistributions?.[0]?.payerTin, '11-1111111')
            assertEq(v.qualifiedCharitableDistributions?.[0]?.accountNumber, 'IRA-0001')
            assertEq(v.nondeductibleContributionsThisYear, '7000.00')
            assertEq(v.contributionsMadeAfterYearEnd, '2000.00')
            assertEq(v.yearEndValueOfAllTraditionalSepSimpleIras, '180000.00')
        },
        // Several gifts out of several accounts stay several entries, in
        // order, with nothing merged or summed. This dialect stores no total
        // (see `noTotalIsStored` below), so a merge here would be the only
        // place the per-distribution matching could silently be lost.
        severalGiftsFromSeveralAccountsStaySeparate: () => {
            const [t, v] = validate({
                ...minimal,
                attainedAgeSeventyAndAHalfAtEveryDistributionBelow: true,
                qualifiedCharitableDistributions: [
                    foodBankGift,
                    { ...foodBankGift, charity: 'Town Library', amount: '5000.00' },
                    { ...foodBankGift, accountNumber: 'IRA-0002', charity: 'Animal Shelter', amount: '1000.00' },
                ],
            })
            assert(t === 'ok', ['expected ok', t, v])
            assertEq(v.qualifiedCharitableDistributions?.length, 3)
            assertEq(v.qualifiedCharitableDistributions?.[1]?.charity, 'Town Library')
            assertEq(v.qualifiedCharitableDistributions?.[2]?.accountNumber, 'IRA-0002')
            // Two gifts out of the SAME account is the ordinary case, and the
            // two entries stay two.
            assertEq(
                v.qualifiedCharitableDistributions?.[0]?.accountNumber,
                v.qualifiedCharitableDistributions?.[1]?.accountNumber,
            )
        },
        wrongDialectRejected: () => {
            const [t, v] = validate({ ...minimal, dialect: 'vnd.fjs.credits' })
            assertEq(t, 'error')
            if (t !== 'error') {
                throw ['expected error', t, v]
            }
            if (typeof v === 'string') {
                throw ['expected a structural ValidationError', v]
            }
            assertEq(v.path[0], 'dialect')
        },
    },
    // DOC-12: every yes/no fact is `option(true)`, so a stored `false` is
    // structurally rejected and ABSENCE is the only way to say "no". Asserted
    // on all five individually rather than by sampling — 12-REVIEW.md WR-01
    // records a case where widening ONE checkbox to `option(boolean)` passed
    // `tsc` and the whole suite because only its neighbours were asserted.
    // Every one of these five is load-bearing: `fjs/form8606` REFUSES on the
    // absence of the first and REFUSES on the presence of two of the others.
    checkboxes: {
        falseIsStructurallyRejectedOnEveryFlag: () => {
            const fields = [
                'attainedAgeSeventyAndAHalfAtEveryDistributionBelow',
                'hadOutstandingRolloverOrRecharacterization',
                'hadQualifiedDisasterDistributionOrPlanRepayment',
                'corrected',
            ]
            assertEq(fields.length, 4, 'hand-counted: this dialect\'s four top-level checkboxes')
            for (const field of fields) {
                assertEq(validate({ ...minimal, [field]: true })[0], 'ok', `${field} must be storable`)
                assertEq(
                    validate({ ...minimal, [field]: false })[0],
                    'error',
                    `${field} must reject a stored false`,
                )
            }
            // The fifth is inside a QCD entry, so it needs an entry to sit in.
            assertEq(validate({
                ...minimal,
                qualifiedCharitableDistributions: [
                    { ...foodBankGift, oneTimeSplitInterestElection: true },
                ],
            })[0], 'ok')
            assertEq(validate({
                ...minimal,
                qualifiedCharitableDistributions: [
                    { ...foodBankGift, oneTimeSplitInterestElection: false },
                ],
            })[0], 'error')
        },
        // Absence is neither `true` nor `false`, and that distinction is what
        // lets `fjs/form8606` REFUSE rather than deny on the age test.
        absentAgeAssertionStaysAbsent: () => {
            const [t, v] = validate({ ...minimal, qualifiedCharitableDistributions: [foodBankGift] })
            assert(t === 'ok', ['a record may be STORED without the age assertion', t, v])
            assert(
                !('attainedAgeSeventyAndAHalfAtEveryDistributionBelow' in v),
                ['an absent assertion must stay absent, not materialize as false', v],
            )
        },
    },
    moneyFieldExactness: {
        ...generatedMoneyFieldExactnessProof,
        everyMoneyFieldIsCovered: () => {
            assertEq(
                moneyFields.length,
                expectedMoneyFieldCount,
                [
                    'expected exactly the independently-stated money field count',
                    moneyFields.length,
                    expectedMoneyFieldCount,
                ],
            )
        },
    },
    moneyFieldSign: generatedMoneyFieldSignProof,
    qcdAmount: {
        commaGroupedRefusedNamingTheCharity: () => {
            const [t, v] = validate({
                ...minimal,
                qualifiedCharitableDistributions: [{ ...foodBankGift, amount: '20,000.00' }],
            })
            assertEq(t, 'error')
            assert(typeof v === 'string', ['expected a semantic string refusal', v])
            assert(v.includes('Riverside Food Bank'), ['the refusal must name WHICH gift', v])
        },
        // Strictly positive, at both boundaries, ±1¢. Zero is refused here —
        // unlike the four scalar fields above, where zero is a real figure.
        // The asymmetry is the point: a zero-dollar gift is not a gift.
        zeroAndNegativeAreRefusedAndOneCentIsNot: () => {
            const zero = validate({
                ...minimal,
                qualifiedCharitableDistributions: [{ ...foodBankGift, amount: '0.00' }],
            })
            assertEq(zero[0], 'error')
            assert(
                typeof zero[1] === 'string' && zero[1].includes('§408(d)(8)'),
                ['the refusal must name the provision', zero[1]],
            )
            assertEq(validate({
                ...minimal,
                qualifiedCharitableDistributions: [{ ...foodBankGift, amount: '-0.01' }],
            })[0], 'error')
            assertEq(validate({
                ...minimal,
                qualifiedCharitableDistributions: [{ ...foodBankGift, amount: '0.01' }],
            })[0], 'ok')
        },
    },
    // Form 8606's printed line 4 is a SUBSET of line 1 by construction, and
    // line 5 subtracts it — so a line 4 larger than line 1 would shrink the
    // pro-rata numerator below the basis actually held.
    lineFourIsInsideLineOne: {
        exceedingLineOneIsRefusedQuotingBothFigures: () => {
            const [t, v] = validate({
                ...minimal,
                nondeductibleContributionsThisYear: '7000.00',
                contributionsMadeAfterYearEnd: '7000.01',
            })
            assertEq(t, 'error')
            assert(typeof v === 'string', ['expected a semantic string refusal', v])
            assert(v.includes('7000.01'), ['the refusal must quote line 4', v])
            assert(v.includes('7000.00'), ['the refusal must quote line 1', v])
        },
        // ±1¢: equality is the ordinary case — a taxpayer who made the WHOLE
        // of this year's nondeductible contribution in the following January
        // has line 4 exactly equal to line 1.
        //
        // `[VERIFIED]` Weakening the check from `>` to `>=` reddens this leaf,
        // and ALSO `moneyFieldSign.contributionsMadeAfterYearEnd` — which was
        // not predicted. That leaf's own control is `{line 1: 0.00, line 4:
        // 0.00}`, an equality, so it depends on this boundary too. Worth
        // recording rather than tidying away: two leaves constrain this one
        // token, and only one of them says so in its name.
        equalToLineOneIsAccepted: () => {
            assertEq(validate({
                ...minimal,
                nondeductibleContributionsThisYear: '7000.00',
                contributionsMadeAfterYearEnd: '7000.00',
            })[0], 'ok')
        },
        withoutLineOneAtAllIsRefused: () => {
            const [t, v] = validate({ ...minimal, contributionsMadeAfterYearEnd: '2000.00' })
            assertEq(t, 'error')
            assert(typeof v === 'string', ['expected a semantic string refusal', v])
            assert(v.includes('INCLUDED ON LINE 1'), ['the refusal must quote the printed line', v])
        },
    },
    // Nothing in this module totals anything and nothing computes: no export
    // sums the QCD entries, no cap is applied, no pro-rata fraction appears.
    // A stored total would be a second source of truth able to disagree with
    // the entries it came from — the identical leaf `vnd.fjs.credits`,
    // `vnd.fjs.adjustments` and `vnd.fjs.medical_expenses` all carry.
    noTotalIsStored: () => {
        const [t, v] = validate({
            ...minimal,
            qualifiedCharitableDistributions: [foodBankGift],
            nondeductibleContributionsThisYear: '7000.00',
        })
        assert(t === 'ok', ['expected ok', t, v])
        const keys = Object.keys(v)
        assertEq(keys.some(key => key.toLowerCase().includes('total')), false)
        assertEq(keys.some(key => key.toLowerCase().includes('taxable')), false)
        assertEq(keys.some(key => key.toLowerCase().includes('excludable')), false)
        assertEq(keys.some(key => key.toLowerCase().includes('prorata')), false)
    },
    // DOC-10: no `formRevision`, asserted rather than left to be noticed.
    noFormRevision: () => {
        const [t, v] = validate(minimal)
        assert(t === 'ok', ['expected ok', t, v])
        assertEq(Object.keys(v).includes('formRevision'), false)
    },
    // The 70½ test is NOT derived from anything, and in particular this
    // dialect carries no birth date and no line-12d checkbox of its own. One
    // rule, one place: the 65 test lives on `vnd.fjs.return_profile` and is
    // read from there, and a birth-date field added here later would have to
    // delete this leaf deliberately — at which point the derivation this
    // module's docstring argues against becomes possible and must be argued
    // for instead.
    noBirthDateAndNoSecondAgeCheckboxOnThisDialect: () => {
        const [t, v] = validate(minimal)
        assert(t === 'ok', ['expected ok', t, v])
        const keys = Object.keys(iraSchema)
        assertEq(keys.some(key => key.toLowerCase().includes('birth')), false)
        assertEq(keys.includes('taxpayerBornBeforeJan2_1961'), false)
        assertEq(keys.includes('dateOfBirth'), false)
        assertEq(Object.keys(v).some(key => key.toLowerCase().includes('birth')), false)
    },
    // DOC-00, `crossDialect`-style: a fully-valid `vnd.fjs.prior_year_ira_basis`
    // value — this phase's OTHER new dialect, and the one whose shape is most
    // nearly compatible — fails this dialect's `validate`, and the failure's
    // path is exactly `['dialect']`.
    crossDialect: {
        priorYearIraBasisShapeRejectedByIra: () => {
            const [t, v] = validate({
                dialect: 'vnd.fjs.prior_year_ira_basis',
                recipientTin: '222-22-2222',
                taxYear: 2024,
                priorYearForm8606Line14: '20000.00',
            })
            assertEq(t, 'error')
            if (t !== 'error') {
                throw ['expected error', t, v]
            }
            if (typeof v === 'string') {
                throw ['expected a structural ValidationError, got a checkReferences string', v]
            }
            assertEq(v.path.length, 1)
            assertEq(v.path[0], 'dialect')
        },
    },
}
