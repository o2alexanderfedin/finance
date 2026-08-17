/**
 * `vnd.fjs.k1_1041` — Schedule K-1 (Form 1041), *Beneficiary's Share of
 * Income, Deductions, Credits, etc.* (TAX-35, Part III).
 *
 * ## The THIRD box numbering, and why Phase 30 was right not to guess it
 *
 * `fjs/schedule/e`'s own `partIIIEstatesAndTrusts` refusal recorded the reason
 * this file did not exist: the income in Schedule E Part III arrives on a THIRD
 * Schedule K-1 with its own box numbering, and *"a beneficiary's box 5 is other
 * portfolio and nonbusiness income where a partner's box 5 is interest"*.
 * Phase 30 built the two faces DOC-24 asked for and declined to infer a third.
 *
 * This dialect is transcribed from the printed 2025 `f1041sk1.pdf` face and its
 * own page 2, which prints a *"Report on"* column against every box — so the
 * destinations in {@link unmodeledMoneyBoxes} are the FORM'S statement of where
 * each item goes, not this engine's inference. The three-way collision, laid
 * out because it is the whole reason for a third dialect:
 *
 * | Printed box | Form 1065 K-1 | Form 1120-S K-1 | **Form 1041 K-1** |
 * |---|---|---|---|
 * | 1 | Ordinary business income | Ordinary business income | **Interest income** |
 * | 3 | Other net rental income | Other net rental income | **Net short-term capital gain** |
 * | 5 | **Interest income** | Dividends (5a/5b) | **Other portfolio and nonbusiness income** |
 * | 6 | Dividends (6a/6b/6c) | **Royalties** | **Ordinary business income** |
 * | 11 | Other income (coded) | Other income (coded) | **Final year deductions (coded)** |
 *
 * Box 1 is the costliest of these. On both entity K-1s box 1 is the ordinary
 * business income this engine computes Schedule E from; on THIS face box 1 is
 * interest income, which belongs on 1040 line 2b. A shared schema would carry
 * a beneficiary's interest into Schedule E Part II as business income and
 * charge self-employment tax on it. {@link proof.crossDialect} proves the
 * separation rather than asserting it.
 *
 * ## What this dialect COMPUTES versus what it merely STORES
 *
 * SIX figures are consumed by a computation, on three different forms. The
 * list is the authority; a bare count would not say which:
 *
 * - **Box 6, ordinary business income** → Schedule E Part III line 33 column
 *   (d) or (f) → line 35 → line 37 → line 41 → Schedule 1 line 5 → 1040 line 8.
 *   The printed page 2 routes it to *"Schedule E, line 33, column (d) or (f)"*,
 *   and which of the two is a §469 determination — see below.
 * - **Box 1, interest income** → 1040 line 2b (TAX-35). **One here, where both
 *   entity faces number their ordinary business income one** — the costliest
 *   collision on this form, and the reason for a third dialect.
 * - **Box 2a, ordinary dividends** → 1040 line 3b (TAX-35).
 * - **Box 2b, qualified dividends** → 1040 line 3a ONLY (TAX-35), a subset of
 *   box 2a that never joins line 3b a second time.
 * - **Box 3, net short-term capital gain (loss)** → Schedule D line 5 (TAX-35).
 * - **Box 4a, net long-term capital gain (loss)** → Schedule D line 12
 *   (TAX-35); its boxes 4b/4c slices stay REFUSED at their worksheets.
 *
 * Every other fixed-caption money box is stored and refused by name when
 * non-zero, quoting the printed *"Report on"* destination, exactly as
 * `vnd.fjs.k1_1065`'s own {@link unmodeledMoneyBoxes} does. **Six of the
 * twelve** are here; the six listed above are the ones that are not. Box 5 is
 * emphatically among the refused: it is other portfolio and nonbusiness income
 * bound for Schedule E line 33 column (f), NOT the interest a partner's box 5
 * carries.
 *
 * Boxes 7 and 8 deserve their own note, because their destination is the very
 * part this dialect exists to feed. The printed page routes both to *"Schedule
 * E, line 33, column (d) or (f)"* — the same destination as box 6 — and they
 * are nonetheless refused, because rental real estate is passive per se under
 * §469(c)(2) with none of box 6's material-participation question available to
 * it, and a passive rental share with no self-employment income behind it is
 * net investment income §1411(c)(6) does not take back out. That is the same
 * refusal `fjs/schedule/e`'s `passiveIncomeOutsideSelfEmploymentRefusal`
 * already makes for a limited partner, reached one layer earlier because there
 * is no determination to ask for.
 *
 * ## A beneficiary's share is NEVER self-employment income
 *
 * There is no box 14 code A here and no partner type, and the reason is
 * structural rather than an omission: a beneficiary of an estate or trust is
 * not carrying on the trade or business the fiduciary carries on, so §1402(a)
 * reaches none of it. `fjs/schedule/e` therefore reduces a beneficiary row with
 * a STRUCTURAL zero for self-employment earnings, the same way it already does
 * for an S-corporation shareholder under Rev. Rul. 59-221.
 *
 * ## A LOSS refuses, and the authority is §642(h) rather than §704(d)
 *
 * A negative box 6 is refused, and the citation is not Part II's. A beneficiary
 * is generally allocated no loss at all: §643 computes distributable net income
 * without one, and §642(h) passes an excess deduction or an unused loss
 * carryover through **only on termination**, in the estate's or trust's final
 * year, where it arrives in box 11 as a coded final-year deduction rather than
 * in box 6. So a negative box 6 is either a transcription of the fiduciary's
 * own figure rather than the beneficiary's share, or a final-year item in the
 * wrong box — and both are refusals rather than a number to net against
 * anything.
 *
 * ## The one asserted field
 *
 * `materialParticipation` is not a printed box here either, and it is on this
 * dialect for the reason it is on the other two: the printed **Schedule E**
 * requires the taxpayer to choose between a passive and a nonpassive column for
 * each entity, and page 2's own *"column (d) or (f)"* is that choice. §469's
 * test is facts and circumstances and no information return reports it, so
 * absence is *unstated* and `fjs/schedule/e` refuses it by name.
 *
 * @module
 */
import { array, number, option, string } from 'functionalscript/fjs/types/rtti/module.f.js'
import { validate as rttiValidate } from 'functionalscript/fjs/types/rtti/validate/module.f.js'
import { error, ok } from 'functionalscript/fjs/types/result/module.f.js'
import { assert, assertEq } from 'functionalscript/fjs/asserts/module.f.js'
import { centsFromString } from '../../exact/module.f.js'
import { base, mediaTypeOf } from '../base/module.f.js'
import { formRevisionError } from '../form_revision/module.f.js'
import { moneyFieldError } from '../money_field/module.f.js'
import { codedEntry, codedBoxError, materialParticipationValues, materialParticipationError } from '../k1_common/module.f.js'

/** @import { Result } from 'functionalscript/fjs/types/result/module.f.js' */
/** @import { Ts, Unknown } from 'functionalscript/fjs/types/rtti/ts/module.f.js' */
/** @import { ValidationError } from 'functionalscript/fjs/types/rtti/validate/module.f.js' */

/**
 * Format tag: names the dialect of this BLOB. The media type it is served
 * with is derived mechanically: `application/` + `dialect` + `+json`.
 */
export const dialect = 'vnd.fjs.k1_1041'
/** The media type derived from {@link dialect}: `application/vnd.fjs.k1_1041+json`. */
export const mediaType = mediaTypeOf(dialect)

/**
 * rtti schema for a `k1_1041` BLOB — Part I (the estate or trust), Part II (the
 * beneficiary) and Part III (the beneficiary's share), transcribed from the
 * printed 2025 `f1041sk1.pdf` face in the form's own order.
 *
 * `payerTin` is the ESTATE's or TRUST's employer identification number (printed
 * box A) and `recipientTin` the BENEFICIARY's identifying number (printed box
 * F) — the same two names every information-return dialect in this tree uses,
 * so a cross-document TIN match reads one field name on every document.
 *
 * **There is no `accountNumber`**, and its absence is a transcription fact
 * rather than an oversight: this printed face has no such box. `vnd.fjs.k1_1065`
 * and `vnd.fjs.k1_1120s` both carry one because their own faces do.
 */
export const k1EstateTrustSchema = /** @type {const} */ ({
    ...base(dialect),
    payerTin: string,
    recipientTin: string,
    taxYear: number,
    formRevision: string,
    // The two printed checkboxes above Part III's caption.
    finalK1: option(true),
    amendedK1: option(true),
    payerName: option(string),
    recipientName: option(string),
    // Part I, boxes C, D and E.
    fiduciaryName: option(string),
    boxDForm1041TWasFiled: option(true),
    boxDForm1041TFiledDate: option(string),
    boxEFinalForm1041: option(true),
    // Part II, box H — a printed PAIR of checkboxes.
    boxHDomesticBeneficiary: option(true),
    boxHForeignBeneficiary: option(true),
    // The one field that is not a printed box.
    materialParticipation: option(string),
    // Part III, the fixed-caption money boxes: 1, 2a, 2b, 3, 4a, 4b, 4c, 5, 6,
    // 7, 8 and 10.
    box1InterestIncome: option(string),
    box2aOrdinaryDividends: option(string),
    box2bQualifiedDividends: option(string),
    box3NetShortTermCapitalGain: option(string),
    box4aNetLongTermCapitalGain: option(string),
    box4bTwentyEightPercentRateGain: option(string),
    box4cUnrecapturedSection1250Gain: option(string),
    box5OtherPortfolioAndNonbusinessIncome: option(string),
    box6OrdinaryBusinessIncome: option(string),
    box7NetRentalRealEstateIncome: option(string),
    box8OtherRentalIncome: option(string),
    box10EstateTaxDeduction: option(string),
    // Part III, the CODED boxes — a code letter and an amount, repeated: 9, 11,
    // 12, 13 and 14.
    box9DirectlyApportionedDeductions: option(array(codedEntry)),
    box11FinalYearDeductions: option(array(codedEntry)),
    box12AlternativeMinimumTaxItems: option(array(codedEntry)),
    box13CreditsAndCreditRecapture: option(array(codedEntry)),
    box14OtherInformation: option(array(codedEntry)),
})

/** @typedef {Ts<typeof k1EstateTrustSchema>} K1EstateTrust */

/** Structural-only validator: checks the shape, not the semantic refinements below. */
const validateShape = rttiValidate(k1EstateTrustSchema)

/**
 * Every fixed-caption money box on this form, walked in one loop so the
 * `centsFromString` re-parse is written once rather than per box.
 *
 * The CODED boxes are not here: their amounts live one level down, inside
 * {@link codedEntry} rows, and {@link checkReferences} walks those separately.
 */
export const moneyBoxFields = /** @type {const} */ ([
    'box1InterestIncome',
    'box2aOrdinaryDividends',
    'box2bQualifiedDividends',
    'box3NetShortTermCapitalGain',
    'box4aNetLongTermCapitalGain',
    'box4bTwentyEightPercentRateGain',
    'box4cUnrecapturedSection1250Gain',
    'box5OtherPortfolioAndNonbusinessIncome',
    'box6OrdinaryBusinessIncome',
    'box7NetRentalRealEstateIncome',
    'box8OtherRentalIncome',
    'box10EstateTaxDeduction',
])

/** Every CODED box on this form, walked in one loop by {@link checkReferences}. */
export const codedBoxFields = /** @type {const} */ ([
    'box9DirectlyApportionedDeductions',
    'box11FinalYearDeductions',
    'box12AlternativeMinimumTaxItems',
    'box13CreditsAndCreditRecapture',
    'box14OtherInformation',
])

/**
 * **The separately stated items this engine cannot place, each naming where
 * the amount would have gone.** A present, NON-ZERO amount in any of them
 * refuses the document at storage; a present ZERO is accepted, because a
 * transcript that prints `0.00` into an unused box is ordinary.
 *
 * Six of the twelve fixed-caption money boxes are here. The boxes that are NOT
 * here are the ones this engine computes, and they are LISTED rather than
 * described, because there is now more than one of them and the list grows
 * every time a destination is wired. A sentence of the form "box 6 is the one
 * that is not" was true for exactly as long as it took to route a second box,
 * and a count with no list cannot say WHICH box left.
 *
 * - box 6 — ordinary business income, through `fjs/schedule/e` Part III.
 * - box 1 — interest income, through `fjs/form1040/core`'s 1040 line 2b
 *   (TAX-35). Note that this face numbers its interest ONE where the
 *   partnership numbers it five and the S corporation four; the three tables
 *   are deliberately not shared for exactly this reason.
 * - box 2a — ordinary dividends, 1040 line 3b (TAX-35).
 * - box 2b — qualified dividends, 1040 line 3a (TAX-35). A SUBSET of 2a, on
 *   its own line, never added to 3b a second time.
 *
 * - box 3 — net short-term capital gain or loss, Schedule D line 5 (TAX-35).
 * - box 4a — net long-term capital gain or loss, Schedule D line 12 (TAX-35).
 *
 * **Boxes 4b and 4c stay refused** — the collectibles 28% slice and the
 * unrecaptured §1250 slice are components OF box 4a bound for two worksheets
 * this engine does not compute.
 *
 * **Box 5 stays refused and is the trap this list exists to keep visible.**
 * `box5OtherPortfolioAndNonbusinessIncome` is not interest and not a
 * dividend: it goes to Schedule E line 33 column (f) as PORTFOLIO income, and
 * a shared "box 5 is interest" rule taken from the partnership's face would
 * silently sweep it onto 1040 line 2b.
 *
 * **Every destination is quoted from the printed form's own page 2**, which
 * prints a *"Report on"* column against each box. That is what makes this table
 * an independent transcription rather than this engine's own opinion about
 * where an item belongs.
 */
export const unmodeledMoneyBoxes = /** @type {const} */ ([
    ['box4bTwentyEightPercentRateGain', 'the 28% Rate Gain Worksheet line 4 (Schedule D instructions)'],
    ['box4cUnrecapturedSection1250Gain', 'the Unrecaptured Section 1250 Gain Worksheet line 11 (Schedule D instructions)'],
    ['box5OtherPortfolioAndNonbusinessIncome', 'Schedule E line 33 column (f) — but as PORTFOLIO income, which §469(e)(1) excludes from passive activity income and §1411(c)(1) makes net investment income on Form 8960, so it cannot ride into line 33 on box 6’s material-participation determination'],
    ['box7NetRentalRealEstateIncome', 'Schedule E line 33 column (d) or (f) — rental real estate, which §469(c)(2) makes passive per se with no material-participation question to ask, so the share is net investment income §1411(c)(6) does not take back out (Form 8960 line 4a)'],
    ['box8OtherRentalIncome', 'Schedule E line 33 column (d) or (f) — other rental activity, passive per se under §469(c)(2) for the same reason as box 7'],
    ['box10EstateTaxDeduction', 'Schedule A line 16 (other itemized deductions) — the §691(c) deduction for estate tax attributable to income in respect of a decedent'],
])

/**
 * Either a structural validation error or a semantic (string) error message.
 * @typedef {ValidationError | string} K1EstateTrustError
 */

/**
 * Checks the semantic refinements the structural schema cannot express on an
 * already shape-valid `k1_1041` value:
 * - `formRevision` (DOC-10) must not be empty or whitespace-only.
 * - Box H must not tick BOTH beneficiary types, and a FOREIGN beneficiary is
 *   refused outright — they report on Form 1040-NR, which this engine does not
 *   compute. Neither ticked is accepted: it is a printed box no computation
 *   here reads, and DOC-11 keeps absence absent.
 * - `materialParticipation`, when present, must be one of
 *   {@link materialParticipationValues}.
 * - Every PRESENT money amount — fixed-caption or inside a coded row — must
 *   parse via `fjs/exact`'s `centsFromString` (DOC-11: absent boxes are
 *   skipped, never defaulted).
 * - Every present, NON-ZERO {@link unmodeledMoneyBoxes} box is refused by
 *   name, naming where the printed form says it would have gone.
 * @type {(r: K1EstateTrust) => Result<K1EstateTrust, K1EstateTrustError>}
 */
export const checkReferences = r => {
    // MERGE NOTE: this dialect was written on a branch cut before Phase 18
    // (MAINT-08) extracted `formRevisionError`, so the merge that brought
    // Phase 18 in left the inline copy standing as copy FIFTEEN of a rule
    // that had just been deduplicated down to one. git had no conflict to
    // report — the two sides touched different files. Behaviour is
    // unchanged; the point is "one rule, one place" (AGENTS.md).
    const formRevisionMessage = formRevisionError(r.formRevision)
    if (formRevisionMessage !== undefined) {
        return error(formRevisionMessage)
    }
    const domestic = r.boxHDomesticBeneficiary === true
    const foreign = r.boxHForeignBeneficiary === true
    if (domestic && foreign) {
        return error(
            `box H (beneficiary type) ticks BOTH boxHDomesticBeneficiary and `
            + `boxHForeignBeneficiary, and the printed pair admits exactly one. A beneficiary is `
            + `either a United States person or is not, and the answer decides which return they `
            + `file at all. Correct whichever record is wrong; refusing rather than choosing one `
            + `of two contradictory transcriptions.`)
    }
    if (foreign) {
        return error(
            `box H ticks 'Foreign beneficiary', and this engine computes Form 1040 only. A `
            + `nonresident alien beneficiary reports this Schedule K-1 on Form 1040-NR, and the `
            + `fiduciary withholds under §1441 on the distributable net income allocated to them `
            + `— neither of which is modeled here. Refusing rather than computing a Form 1040 for `
            + `a filer who does not file one.`)
    }
    const participationMessage = materialParticipationError(r.materialParticipation)
    if (participationMessage !== undefined) {
        return error(participationMessage)
    }
    for (const field of moneyBoxFields) {
        const printed = r[field]
        if (printed === undefined) {
            continue
        }
        const message = moneyFieldError(field)(printed)
        if (message !== undefined) {
            return error(message)
        }
    }
    for (const field of codedBoxFields) {
        const message = codedBoxError(field)(r[field])
        if (message !== undefined) {
            return error(message)
        }
    }
    for (const [field, destination] of unmodeledMoneyBoxes) {
        const printed = r[field]
        if (printed === undefined) {
            continue
        }
        if (centsFromString(printed) !== 0n) {
            return error(
                `${field} carries ${printed}, which this engine cannot compute: it feeds ${destination}. ` +
                `Refusing rather than silently omitting it from the return.`)
        }
    }
    return ok(r)
}

/**
 * Validates an already-parsed JSON value as a `k1_1041` BLOB: structural (rtti)
 * validation followed by the semantic checks in {@link checkReferences}.
 * @type {(value: Unknown) => Result<K1EstateTrust, K1EstateTrustError>}
 */
export const validate = value => {
    const [t, v] = validateShape(value)
    if (t === 'error') {
        return error(v)
    }
    return checkReferences(v)
}

// ── Tests ────────────────────────────────────────────────────────────────────

/** The smallest valid Schedule K-1 (Form 1041): no amounts at all.
 * @type {K1EstateTrust}
 */
const minimal = {
    dialect,
    payerTin: '66-6666666',
    recipientTin: '222-22-2222',
    taxYear: 2025,
    formRevision: '2025',
    boxHDomesticBeneficiary: true,
    materialParticipation: 'materiallyParticipated',
}

/**
 * A beneficiary with no §469 determination — the case `fjs/schedule/e` refuses.
 *
 * Spelled out rather than spread with `…: undefined`, because a spread of
 * `undefined` leaves the KEY present and `'materialParticipation' in v` would
 * then be true. Absent and present-but-undefined are exactly the two states
 * DOC-11 exists to keep apart.
 * @type {K1EstateTrust}
 */
const beneficiaryWithNoDetermination = {
    dialect,
    payerTin: '66-6666666',
    recipientTin: '222-22-2222',
    taxYear: 2025,
    formRevision: '2025',
    boxHDomesticBeneficiary: true,
}

/** A beneficiary's $9,000.00 share of the trust's ordinary business income.
 * @type {K1EstateTrust}
 */
const beneficiaryShare = {
    ...minimal,
    payerName: 'The Harrow Family Trust',
    box6OrdinaryBusinessIncome: '9000.00',
}

/**
 * One generated leaf per fixed-caption money box: supplying a comma-grouped
 * amount to that box alone must be refused.
 */
const perMoneyBoxRejection = Object.fromEntries(moneyBoxFields.map(field => [
    `${field}RejectsCommaGroupedAmount`,
    () => {
        const [t, v] = validate({ ...minimal, [field]: '1,234.56' })
        assertEq(t, 'error', `${field} must reject a comma-grouped amount`)
        assert(typeof v === 'string' && v.includes(field), [field, v])
    },
]))

/**
 * One generated leaf per coded box: a comma-grouped amount inside a coded row
 * must be refused, naming both the box and the CODE.
 */
const perCodedBoxRejection = Object.fromEntries(codedBoxFields.map(field => [
    `${field}RejectsCommaGroupedAmountNamingTheCode`,
    () => {
        const [t, v] = validate({ ...minimal, [field]: [{ code: 'Q', amount: '1,234.56' }] })
        assertEq(t, 'error', `${field} must reject a comma-grouped amount`)
        assert(typeof v === 'string' && v.includes(field), [field, v])
        assert(typeof v === 'string' && v.includes('Q'), ['the refusal must name the code', field, v])
    },
]))

/**
 * One generated leaf per unmodeled box: a present, NON-ZERO amount must be
 * refused, and the message must name both the box and where the printed form
 * says it would have gone. AGENTS.md's `${destination}` finding: assert the
 * part of the message that carries the information.
 */
const perUnmodeledBoxRefusal = Object.fromEntries(unmodeledMoneyBoxes.map(([field, destination]) => [
    `${field}IsRefusedWhenNonZero`,
    () => {
        const [t, v] = validate({ ...minimal, [field]: '100.00' })
        assertEq(t, 'error', `${field} must be refused when non-zero`)
        assert(typeof v === 'string' && v.includes(field), [field, v])
        assert(typeof v === 'string' && v.includes('cannot compute'), [field, v])
        assert(typeof v === 'string' && v.includes(destination), [field, destination, v])
    },
]))

/** The same boxes, present but ZERO, must be ACCEPTED — the control. */
const perUnmodeledBoxZeroAccepted = Object.fromEntries(unmodeledMoneyBoxes.map(([field]) => [
    `${field}IsAcceptedWhenZero`,
    () => {
        const [t] = validate({ ...minimal, [field]: '0.00' })
        assertEq(t, 'ok', `${field} must be accepted when it is zero`)
    },
]))

/** Hand-typed off the printed 2025 Schedule K-1 (Form 1041) face: boxes 1, 2a,
 * 2b, 3, 4a, 4b, 4c, 5, 6, 7, 8 and 10. */
const expectedMoneyBoxCount = 12
/** Hand-typed: five coded boxes — 9, 11, 12, 13 and 14. */
const expectedCodedBoxCount = 5
/** Hand-typed: six of the twelve refuse. `12 - 6` — box 6 computes (Schedule
 * E Part III); boxes 1, 2a, 2b, 3 and 4a compute (1040 line 2b, 1040 lines
 * 3b/3a, Schedule D lines 5 and 12), all five TAX-35. */
const expectedUnmodeledBoxCount = 6

/**
 * **The hand-typed inverse of {@link unmodeledMoneyBoxes}**: every
 * fixed-caption money box this engine COMPUTES, and therefore accepts at
 * storage with a non-zero amount.
 *
 * Deliberately not derived by subtracting one list from the other — both would
 * be the code under test, and AGENTS.md records four shipped defects of
 * exactly that shape. This is the independent side, and it is what makes a box
 * that silently leaves `unmodeledMoneyBoxes` WITHOUT its destination being
 * wired impossible to miss: the arithmetic below stops balancing.
 * @type {readonly string[]}
 */
const computedMoneyBoxes = [
    'box6OrdinaryBusinessIncome',
    'box1InterestIncome',
    'box2aOrdinaryDividends',
    'box2bQualifiedDividends',
    'box3NetShortTermCapitalGain',
    'box4aNetLongTermCapitalGain',
]

/**
 * One generated leaf per computed box: a present, NON-ZERO amount must now be
 * ACCEPTED at storage. This is the exact inverse of the
 * {@link perUnmodeledBoxRefusal} leaf that each of these boxes used to have,
 * and deleting a row from {@link unmodeledMoneyBoxes} without adding it here
 * leaves the box neither refused nor proven storable.
 */
const perComputedBoxAcceptedWhenNonZero = Object.fromEntries(computedMoneyBoxes.map(field => [
    `${field}IsAcceptedWhenNonZero`,
    () => {
        const [t, v] = validate({ ...minimal, [field]: '1234.56' })
        assertEq(t, 'ok', `${field} is computed, so a non-zero amount must be stored, not refused`)
        assert(
            !unmodeledMoneyBoxes.some(([refused]) => refused === field),
            ['a computed box must not also be listed as unmodeled', field, v],
        )
    },
]))

/**
 * **The independent statement of the whole Part III box layout**, hand-typed
 * off the printed 2025 `f1041sk1.pdf` face: every box's field name and which of
 * the two kinds of box it is.
 *
 * Deliberately NOT derived from {@link moneyBoxFields}, {@link codedBoxFields}
 * or {@link unmodeledMoneyBoxes} — all three are the code under test, and
 * AGENTS.md records four shipped defects whose common shape is a proof whose
 * expected side came from the thing it was checking.
 *
 * **Unlike the two entity K-1s, there are no checkbox boxes in Part III here.**
 * The printed face's checkboxes are all in Parts I and II (D, E, H) or above
 * Part III's caption (Final K-1, Amended K-1).
 * @type {readonly (readonly [string, string])[]}
 */
const printedPartIIIBoxes = [
    ['box1InterestIncome', 'money'],
    ['box2aOrdinaryDividends', 'money'],
    ['box2bQualifiedDividends', 'money'],
    ['box3NetShortTermCapitalGain', 'money'],
    ['box4aNetLongTermCapitalGain', 'money'],
    ['box4bTwentyEightPercentRateGain', 'money'],
    ['box4cUnrecapturedSection1250Gain', 'money'],
    ['box5OtherPortfolioAndNonbusinessIncome', 'money'],
    ['box6OrdinaryBusinessIncome', 'money'],
    ['box7NetRentalRealEstateIncome', 'money'],
    ['box8OtherRentalIncome', 'money'],
    ['box9DirectlyApportionedDeductions', 'coded'],
    ['box10EstateTaxDeduction', 'money'],
    ['box11FinalYearDeductions', 'coded'],
    ['box12AlternativeMinimumTaxItems', 'coded'],
    ['box13CreditsAndCreditRecapture', 'coded'],
    ['box14OtherInformation', 'coded'],
]

/** Hand-typed: seventeen printed Part III fields in all (12 money + 5 coded). */
const expectedPartIIIFieldCount = 17

/**
 * **The box numbers whose MEANING differs from the two entity K-1s**, hand
 * typed off the three printed faces — the collision this dialect exists to
 * prevent, as a checked claim rather than a docstring sentence.
 *
 * Each row is a printed box number, this face's field name for it, and the
 * substring of a `vnd.fjs.k1_1065` field name that shows the two disagree.
 * @type {readonly (readonly [string, string, string])[]}
 */
const collidingBoxNumbers = [
    ['1', 'box1InterestIncome', 'box1OrdinaryBusinessIncome'],
    ['3', 'box3NetShortTermCapitalGain', 'box3OtherNetRentalIncome'],
    ['5', 'box5OtherPortfolioAndNonbusinessIncome', 'box5InterestIncome'],
    ['6', 'box6OrdinaryBusinessIncome', 'box6aOrdinaryDividends'],
]

/** Hand-typed: four printed box numbers collide with the 1065 face. */
const expectedCollidingBoxCount = 4

export const proof = {
    ...perMoneyBoxRejection,
    ...perCodedBoxRejection,
    ...perUnmodeledBoxRefusal,
    ...perUnmodeledBoxZeroAccepted,
    ...perComputedBoxAcceptedWhenNonZero,

    dialectAndMediaType: () => {
        assertEq(dialect, 'vnd.fjs.k1_1041')
        assertEq(mediaType, 'application/vnd.fjs.k1_1041+json')
    },

    /**
     * Generated coverage cannot see a box REMOVED from a list — the loop
     * simply generates one fewer leaf and stays green. The hand-typed counts
     * are the independent side of that pair.
     */
    boxListsAreCovered: () => {
        assertEq(moneyBoxFields.length, expectedMoneyBoxCount)
        assertEq(codedBoxFields.length, expectedCodedBoxCount)
        assertEq(unmodeledMoneyBoxes.length, expectedUnmodeledBoxCount)
        assertEq(
            expectedMoneyBoxCount - computedMoneyBoxes.length,
            expectedUnmodeledBoxCount,
            'every fixed-caption money box is either computed or refused, and none is both',
        )
    },

    /**
     * THE COMPARISON. The hand-typed printed box table above, checked against
     * the code's own lists, in both directions — so a box that lost its entry,
     * changed kind, or was invented reddens by name.
     */
    theHandTypedPrintedBoxTableAgreesWithTheCode: () => {
        assertEq(printedPartIIIBoxes.length, expectedPartIIIFieldCount)
        /** @type {readonly string[]} */
        const money = moneyBoxFields
        /** @type {readonly string[]} */
        const coded = codedBoxFields
        for (const [field, kind] of printedPartIIIBoxes) {
            const inMoney = money.includes(field)
            const inCoded = coded.includes(field)
            assertEq(
                [inMoney, inCoded].filter(x => x).length,
                1,
                ['every printed Part III box must be declared exactly once', field])
            assertEq(inMoney, kind === 'money', ['box is on the wrong list', field])
            assertEq(inCoded, kind === 'coded', ['box is on the wrong list', field])
            // The schema must actually carry it, so a box named here and absent
            // from `k1EstateTrustSchema` cannot pass.
            assert(field in k1EstateTrustSchema, ['the schema is missing a printed box', field])
        }
        // ...and in the other direction: nothing in the code is missing from
        // the hand-typed table.
        for (const field of [...money, ...coded]) {
            assert(
                printedPartIIIBoxes.some(([name]) => name === field),
                ['a modeled box is not on the printed form', field])
        }
        for (const [field] of unmodeledMoneyBoxes) {
            assert(money.includes(field), ['an unmodeled box is not a fixed-caption money box', field])
        }
        // **The partition, asserted BY NAME in both directions** — a count
        // alone cannot see one box swapped for another in the unmodeled list,
        // and cannot see a box leave that list without anything computing it.
        // {@link computedMoneyBoxes} is the hand-typed side; the loop below is
        // what turns "TAX-35 removed a row" into a red leaf unless the row was
        // moved to a destination somebody named.
        const refused = unmodeledMoneyBoxes.map(([field]) => field)
        /** @type {readonly string[]} */
        const refusedNames = refused
        for (const field of computedMoneyBoxes) {
            assert(
                !refusedNames.includes(field),
                ['a computed box must not also be refused', field, refused])
            assert(
                money.includes(field),
                ['a computed box must be a fixed-caption money box on this face', field])
        }
        for (const field of money) {
            assert(
                computedMoneyBoxes.includes(field) || refusedNames.includes(field),
                ['every money box is either computed or refused, and this one is neither', field])
        }
    },

    /**
     * **The three-way box collision, as a checked claim.** This is the reason
     * the dialect exists, and a docstring table cannot fail. Each colliding
     * printed box number must mean something DIFFERENT here than on the 1065
     * face — proven by this face carrying its own field name and NOT the 1065's.
     */
    theCollidingBoxNumbersMeanDifferentThings: () => {
        assertEq(collidingBoxNumbers.length, expectedCollidingBoxCount)
        for (const [box, own, partnership] of collidingBoxNumbers) {
            assert(own in k1EstateTrustSchema, ['this face must carry its own field', box, own])
            assert(
                !(partnership in k1EstateTrustSchema),
                ['this face must NOT carry the 1065 meaning of the same box number', box, partnership])
        }
        // Box 1 is the costliest collision and is asserted on its own: the
        // 1065's box 1 is the ordinary business income Schedule E Part II
        // computes from, while THIS box 1 is interest income for 1040 line 2b.
        assert('box1InterestIncome' in k1EstateTrustSchema)
        assert(!('box1OrdinaryBusinessIncome' in k1EstateTrustSchema))
    },

    minimalValidates: () => {
        const [t] = validate(minimal)
        assertEq(t, 'ok')
    },

    /** The beneficiary's own K-1 round-trips the one computed figure. */
    beneficiaryShareValidates: () => {
        const [t, v] = validate(beneficiaryShare)
        assertEq(t, 'ok')
        assert(t === 'ok' && v.box6OrdinaryBusinessIncome === '9000.00', ['box 6 round-trips', v])
        assert(t === 'ok' && v.payerName === 'The Harrow Family Trust', ['the trust name round-trips', v])
    },

    boxH: {
        /** BOTH beneficiary types ticked is a transcription error and refuses. */
        bothBeneficiaryTypesAreRefused: () => {
            const [t, v] = validate({ ...minimal, boxHForeignBeneficiary: true })
            assertEq(t, 'error')
            assert(typeof v === 'string' && v.includes('box H'), [v])
            assert(typeof v === 'string' && v.includes('BOTH'), [v])
        },

        /**
         * A FOREIGN beneficiary refuses by name: they report on Form 1040-NR
         * and the fiduciary withholds under §1441, neither of which is modeled.
         */
        aForeignBeneficiaryIsRefusedNamingTheOtherReturn: () => {
            const [t, v] = validate({
                dialect,
                payerTin: '66-6666666',
                recipientTin: '222-22-2222',
                taxYear: 2025,
                formRevision: '2025',
                boxHForeignBeneficiary: true,
                materialParticipation: 'materiallyParticipated',
            })
            assertEq(t, 'error')
            assert(typeof v === 'string' && v.includes('1040-NR'), [v])
            assert(typeof v === 'string' && v.includes('§1441'), [v])
        },

        /**
         * THE CONTROL, twice over: a gate that refused every box H state would
         * pass both leaves above. A DOMESTIC beneficiary validates, and so does
         * one who ticked neither box — nothing computed here reads box H, and
         * DOC-11 keeps an absent printed box absent rather than defaulting it.
         */
        aDomesticBeneficiaryAndAnUnstatedOneBothValidate: () => {
            const [domestic] = validate(minimal)
            assertEq(domestic, 'ok')
            const [neither, v] = validate({
                dialect,
                payerTin: '66-6666666',
                recipientTin: '222-22-2222',
                taxYear: 2025,
                formRevision: '2025',
                materialParticipation: 'materiallyParticipated',
            })
            assertEq(neither, 'ok', 'an unstated box H is not a refusal')
            assert(
                neither === 'ok' && !('boxHDomesticBeneficiary' in v),
                ['absent stays absent', v])
        },

        /** DOC-12's checkbox convention: `false` is structurally rejected. */
        aFalseCheckboxIsStructurallyRejected: () => {
            const [t] = validate({ ...minimal, boxHForeignBeneficiary: false })
            assertEq(t, 'error')
        },
    },

    materialParticipation: {
        /** A value outside the vocabulary is refused, naming the vocabulary. */
        anUnrecognizedValueIsRefused: () => {
            const [t, v] = validate({ ...minimal, materialParticipation: 'sometimes' })
            assertEq(t, 'error')
            assert(typeof v === 'string' && v.includes('sometimes'), [v])
            for (const value of materialParticipationValues) {
                assert(typeof v === 'string' && v.includes(value), ['the refusal must name the vocabulary', value, v])
            }
        },

        /**
         * ABSENT is accepted at STORAGE and refused at Schedule E, the split
         * this project uses everywhere: a document is stored for what it says,
         * and refused where the missing fact would change an answer.
         */
        anAbsentAssertionStoresAndIsNotDefaulted: () => {
            const [t, v] = validate(beneficiaryWithNoDetermination)
            assertEq(t, 'ok')
            assert(t === 'ok' && !('materialParticipation' in v), ['absent stays absent', v])
        },

        /** Both values of the shared vocabulary are accepted. */
        bothDeterminationsAreAccepted: () => {
            for (const value of materialParticipationValues) {
                const [t] = validate({ ...minimal, materialParticipation: value })
                assertEq(t, 'ok', ['a stated determination must store', value])
            }
        },
    },

    codedBoxes: {
        /**
         * A coded box carries SEVERAL rows, and the order and codes must
         * survive. A real box 11 prints A, B, C and D together in a final year.
         */
        severalCodedRowsAreStoredInOrder: () => {
            const [t, v] = validate({
                ...minimal,
                box11FinalYearDeductions: [
                    { code: 'A', amount: '1200.00' },
                    { code: 'C', amount: '450.00' },
                    { code: 'E' },
                ],
            })
            assertEq(t, 'ok')
            assert(t === 'ok' && v.box11FinalYearDeductions?.length === 3, [v])
            assert(t === 'ok' && v.box11FinalYearDeductions?.[0]?.code === 'A', [v])
            assert(t === 'ok' && v.box11FinalYearDeductions?.[1]?.code === 'C', [v])
            assert(t === 'ok' && v.box11FinalYearDeductions?.[2]?.code === 'E', [v])
            // DOC-11: a coded row whose amount lives on an attached statement
            // must stay ABSENT rather than becoming a zero.
            assert(t === 'ok' && v.box11FinalYearDeductions?.[2]?.amount === undefined, ['absent stays absent', v])
        },

        /** An absent coded box is absent, not empty. */
        anAbsentCodedBoxIsAbsentNotEmpty: () => {
            const [t, v] = validate(minimal)
            assertEq(t, 'ok')
            assert(t === 'ok' && !('box11FinalYearDeductions' in v), ['absent stays absent', v])
        },

        /** A row with no `code` at all is structurally rejected. */
        aRowWithoutACodeIsStructurallyRejected: () => {
            const [t] = validate({ ...minimal, box9DirectlyApportionedDeductions: [{ amount: '10.00' }] })
            assertEq(t, 'error')
        },
    },

    emptyFormRevisionRejected: () => {
        const [t, v] = validate({ ...minimal, formRevision: '' })
        assertEq(t, 'error')
        assert(typeof v === 'string' && v.includes('formRevision'), [v])
    },

    /** DOC-11: an ABSENT box is not a refusal and not a zero. */
    absentBoxesAreNotRefusals: () => {
        const [t, v] = validate(minimal)
        assertEq(t, 'ok')
        assert(t === 'ok' && !('box6OrdinaryBusinessIncome' in v), ['absent box must stay absent', v])
        assert(t === 'ok' && !('box1InterestIncome' in v), ['absent box must stay absent', v])
    },

    /** A blob tagged as another dialect is rejected structurally, on `dialect`. */
    otherDialectRejected: () => {
        const [t, v] = validate({ ...minimal, dialect: 'vnd.fjs.k1_1065' })
        assertEq(t, 'error')
        if (t !== 'error') {
            throw ['expected error', t, v]
        }
        if (typeof v === 'string') {
            throw ['expected a structural ValidationError', v]
        }
        assertEq(v.path.length, 1)
        assertEq(v.path[0], 'dialect')
    },

    /**
     * DOC-00, `crossDialect`-style, in the direction this requirement makes
     * expensive: a PARTNER's K-1 must not be readable as a BENEFICIARY's. It is
     * the same printed form family with a third box numbering, and the
     * misreading costs real money — a partnership's box 1 ordinary business
     * income would arrive in this face's box 1 interest field, and a
     * beneficiary's box 6 business income would be read as a partner's
     * dividends.
     */
    crossDialect: {
        aPartnershipK1IsRejectedByTheEstateTrustDialect: () => {
            const [t, v] = validate({
                dialect: 'vnd.fjs.k1_1065',
                payerTin: '33-3333333',
                recipientTin: '222-22-2222',
                accountNumber: 'PTR-0001',
                taxYear: 2025,
                formRevision: '2025',
                boxGGeneralPartnerOrLlcMemberManager: true,
                box1OrdinaryBusinessIncome: '80000.00',
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

        /** ...and an S-corporation shareholder's K-1 likewise. */
        anSCorporationK1IsRejectedByTheEstateTrustDialect: () => {
            const [t, v] = validate({
                dialect: 'vnd.fjs.k1_1120s',
                payerTin: '44-4444444',
                recipientTin: '222-22-2222',
                accountNumber: 'SHR-0001',
                taxYear: 2025,
                formRevision: '2025',
                box1OrdinaryBusinessIncome: '80000.00',
            })
            assertEq(t, 'error')
            if (t !== 'error') {
                throw ['expected error', t, v]
            }
            if (typeof v === 'string') {
                throw ['expected a structural ValidationError, got a checkReferences string', v]
            }
            assertEq(v.path[0], 'dialect')
        },
    },
}
