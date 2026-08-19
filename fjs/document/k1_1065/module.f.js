/**
 * `vnd.fjs.k1_1065` — Schedule K-1 (Form 1065), *Partner's Share of Income,
 * Deductions, Credits, etc.* (DOC-24, first of two).
 *
 * ## Two dialects, and why a shared schema would be the bug
 *
 * DOC-24 asks for `vnd.fjs.k1_1065` and `vnd.fjs.k1_1120s` as **two**
 * dialects, and the reason is not tidiness. The two printed forms number
 * their Part III boxes differently, and the collisions are not harmless:
 *
 * | Printed box | Form 1065 K-1 | Form 1120-S K-1 |
 * |---|---|---|
 * | 4 | Guaranteed payments (4a/4b/4c) | **Interest income** |
 * | 5 | **Interest income** | Dividends (5a/5b) |
 * | 6 | Dividends (6a/6b/6c) | **Royalties** |
 * | 7 | **Royalties** | Net short-term capital gain |
 * | 8 | Net short-term capital gain | Net long-term capital gain (8a/8b/8c) |
 * | 9 | Net long-term capital gain (9a/9b/9c) | Net section 1231 gain |
 * | 14 | **Self-employment earnings** | Schedule K-3 attached (a checkbox) |
 *
 * A single schema over both would read an S-corporation's box 7 short-term
 * capital gain as a partnership's royalty, and — the one that costs real
 * money — would look for self-employment earnings in a box that, on the
 * 1120-S face, holds a checkbox. {@link proof.crossDialect} is where the
 * separation is proven rather than asserted: a fully valid `vnd.fjs.k1_1120s`
 * blob fails THIS dialect's `validate` on `dialect`, before a single box is
 * misread.
 *
 * ## What this dialect COMPUTES versus what it merely STORES
 *
 * EIGHT figures are consumed by a computation, and they are consumed by four
 * different forms. The list is the authority; a bare count would not say which:
 *
 * - **Box 1, ordinary business income (loss)** → Schedule E Part II line 28
 *   column (g) or (j) → line 32 → line 41 → Schedule 1 line 5 → 1040 line 8.
 * - **Box 14, code A, net earnings (loss) from self-employment** → Schedule
 *   SE line 2, which names this box in its own printed caption: *"Net profit
 *   or (loss) from Schedule C, line 31; and Schedule K-1 (Form 1065), box 14,
 *   code A"*. `fjs/schedule/se` is where it lands.
 * - **Box 5, interest income** → 1040 line 2b, through §702(a)(8) (TAX-35).
 * - **Box 6a, ordinary dividends** → 1040 line 3b (TAX-35).
 * - **Box 6b, qualified dividends** → 1040 line 3a ONLY (TAX-35). A subset of
 *   box 6a, so it never joins line 3b a second time.
 * - **Box 6c, dividend equivalents** → 1040 line 3b, as a §871(m) payment
 *   treated as a dividend rather than a slice of box 6a (TAX-35). **No other
 *   K-1 face has this box**, which is why this one routes six of TAX-35's
 *   boxes where the 1120-S and the 1041 route five each.
 * - **Box 8, net short-term capital gain (loss)** → Schedule D line 5 (TAX-35).
 * - **Box 9a, net long-term capital gain (loss)** → Schedule D line 12
 *   (TAX-35). Its 28%-rate and unrecaptured-§1250 slices — boxes 9b and 9c —
 *   route to two worksheets this engine does not compute and stay REFUSED, so
 *   a partner holding either is still told which line cannot be filled.
 *
 * Two checkbox facts are read and decide the return:
 *
 * - **Box G**, printed as a pair — *"General partner or LLC member-manager"*
 *   and *"Limited partner or other LLC member"*. It is DOC-12's `option(true)`
 *   convention twice, and {@link checkReferences} refuses a blob that ticks
 *   both or neither, because §1402(a)(13) and §469(h)(2) both turn on it and
 *   this engine may not assume which side a partner is on. See "Box G is a
 *   refusal, not a default" below.
 * - **{@link materialParticipationValues}**, the one field on this dialect
 *   that is NOT a printed box. See "The one asserted field" below.
 *
 * Everything else is stored and computed on by nothing — and, because a
 * separately stated item silently dropped is an understatement, nothing that
 * carries an amount is merely dropped. {@link unmodeledMoneyBoxes} refuses
 * every present, NON-ZERO one by name, **naming the line elsewhere on the
 * return it would have reached**, which is the part of such a message a reader
 * can act on (`fjs/document/1099g`'s own finding, re-applied).
 *
 * ## Box G is a refusal, not a default
 *
 * Three separate rules read box G, and each runs a different way for a general
 * and a limited partner:
 *
 * - **§1402(a)(13)** excludes a LIMITED partner's distributive share from net
 *   earnings from self-employment (guaranteed payments for services aside). A
 *   general partner's is included. Reading one as the other moves the tax by
 *   about 15.3% of 92.35% of the share — roughly $11,300 on an $80,000 share,
 *   in whichever direction the mistake was made.
 * - **§469(h)(2)** provides that no interest as a limited partner is one in
 *   which the taxpayer materially participates, which decides the printed
 *   Schedule E column — and, through §1411(c)(2)(A), whether the share is net
 *   investment income.
 * - **§465** and **§704(d)** limit a loss differently by partner type.
 *
 * So an undeterminable box G is refused at storage rather than defaulted. A
 * default in either direction is a confident wrong answer of the exact kind
 * TAX-16 exists to prevent.
 *
 * ## The one asserted field, and why it is on a transcribed document
 *
 * `materialParticipation` is not a box on the printed Schedule K-1. It is
 * here because the printed **Schedule E** requires the taxpayer to choose
 * between its passive and nonpassive columns for each entity, and that choice
 * is a §469 material-participation determination — a facts-and-circumstances
 * test (Temp. Reg. §1.469-5T's seven tests) that no information return
 * reports and no default can stand in for. Absence is *unstated* and REFUSES,
 * exactly as `vnd.fjs.business_expenses`'
 * `priorYearQualifiedBusinessLossCarryforward` does for §199A(c)(2), and for
 * the same reason: reading an absent determination as either answer decides a
 * question the taxpayer alone can answer.
 *
 * It is per ENTITY, which is why it rides on the K-1 rather than on the
 * return profile: a taxpayer may materially participate in one partnership
 * and not in another, and §469 is applied activity by activity.
 *
 * **§469(h)(2) overrides it for a limited partner**, and an assertion that
 * contradicts the statute is refused rather than honoured — see
 * {@link checkReferences}.
 *
 * ## The coded boxes are ARRAYS, and their vocabulary is Schedule E's
 *
 * Boxes 11, 13, 14, 15, 17, 18, 19 and 20 do not print an amount: they print
 * a **code letter and an amount**, repeated down the box, because each is a
 * whole family of separately stated items sharing one printed box. So each is
 * an array of {@link codedEntry} rows, the same shape `fjs/document/1099nec`'s
 * `box5Through7` and `fjs/document/w2`'s `box15Through20` already use for a
 * repeated printed block.
 *
 * **The code vocabulary lives in `fjs/schedule/e`, not here**, which is the
 * identical division `vnd.fjs.business_expenses` makes with `fjs/schedule/c`:
 * that dialect keeps `category` a free string on the stated ground that
 * deciding which printed line a payment belongs on is deduction logic, and
 * `fjs/schedule/c` owns the vocabulary and refuses an unrecognized entry by
 * name. Here the same reasoning applies with more force — the printed
 * instructions define over thirty codes across these eight boxes, the set
 * changes with the form revision, and which of them this engine can route is a
 * Schedule E question rather than a transcription question.
 *
 * The one fixed-box family this module refuses on its own is
 * {@link unmodeledMoneyBoxes}: a printed box with ONE caption, one meaning and
 * no reader.
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
export const dialect = 'vnd.fjs.k1_1065'
/** The media type derived from {@link dialect}: `application/vnd.fjs.k1_1065+json`. */
export const mediaType = mediaTypeOf(dialect)

/**
 * rtti schema for a `k1_1065` BLOB — Part I (the partnership), Part II (the
 * partner) and Part III (the partner's share), transcribed from the printed
 * 2025 `f1065sk1.pdf` face in the form's own order.
 *
 * `dialect` is spread first (via `base`) so structural validation reports it
 * as the first failing field on a mismatched blob, matching every other
 * document dialect in this tree.
 *
 * `payerTin` is the PARTNERSHIP's employer identification number (printed box
 * A) and `recipientTin` the PARTNER's (printed box E) — the same two names
 * every information-return dialect here uses, so a cross-document TIN match
 * (`fjs/schedule/se`'s wage-base attribution, for one) reads the same field
 * name on every document rather than a per-dialect spelling.
 */
export const k1PartnershipSchema = /** @type {const} */ ({
    ...base(dialect),
    payerTin: string,
    recipientTin: string,
    accountNumber: string,
    taxYear: number,
    formRevision: string,
    corrected: option(true),
    payerName: option(string),
    recipientName: option(string),
    // Part II, box G — a printed PAIR of checkboxes, exactly one of which the
    // partnership ticks. See this module's own docstring.
    boxGGeneralPartnerOrLlcMemberManager: option(true),
    boxGLimitedPartnerOrOtherLlcMember: option(true),
    // The one field that is not a printed box.
    materialParticipation: option(string),
    // Part III, boxes 1-10 and 12 and 21: the fixed-caption boxes.
    box1OrdinaryBusinessIncome: option(string),
    box2NetRentalRealEstateIncome: option(string),
    box3OtherNetRentalIncome: option(string),
    box4aGuaranteedPaymentsForServices: option(string),
    box4bGuaranteedPaymentsForCapital: option(string),
    box4cTotalGuaranteedPayments: option(string),
    box5InterestIncome: option(string),
    box6aOrdinaryDividends: option(string),
    box6bQualifiedDividends: option(string),
    box6cDividendEquivalents: option(string),
    box7Royalties: option(string),
    box8NetShortTermCapitalGain: option(string),
    box9aNetLongTermCapitalGain: option(string),
    box9bCollectiblesTwentyEightPercentGain: option(string),
    box9cUnrecapturedSection1250Gain: option(string),
    box10NetSection1231Gain: option(string),
    box12Section179Deduction: option(string),
    box21ForeignTaxesPaidOrAccrued: option(string),
    // Part III, the CODED boxes — a code letter and an amount, repeated.
    box11OtherIncome: option(array(codedEntry)),
    box13OtherDeductions: option(array(codedEntry)),
    box14SelfEmploymentEarnings: option(array(codedEntry)),
    box15Credits: option(array(codedEntry)),
    box17AlternativeMinimumTaxItems: option(array(codedEntry)),
    box18TaxExemptIncomeAndNondeductibleExpenses: option(array(codedEntry)),
    box19Distributions: option(array(codedEntry)),
    box20OtherInformation: option(array(codedEntry)),
    // Part III, the checkbox-only boxes.
    box16ScheduleK3Attached: option(true),
    box22MoreThanOneActivityForAtRiskPurposes: option(true),
    box23MoreThanOneActivityForPassiveActivityPurposes: option(true),
})

/** @typedef {Ts<typeof k1PartnershipSchema>} K1Partnership */

/** Structural-only validator: checks the shape, not the semantic refinements below. */
const validateShape = rttiValidate(k1PartnershipSchema)

/**
 * Every fixed-caption money box on this form, walked in one loop so the
 * `centsFromString` re-parse is written once rather than per box. Typed via
 * `@type {const}` so `r[field]` resolves to exactly `string | undefined`.
 *
 * The CODED boxes are not here: their amounts live one level down, inside
 * {@link codedEntry} rows, and {@link checkReferences} walks those separately.
 */
export const moneyBoxFields = /** @type {const} */ ([
    'box1OrdinaryBusinessIncome',
    'box2NetRentalRealEstateIncome',
    'box3OtherNetRentalIncome',
    'box4aGuaranteedPaymentsForServices',
    'box4bGuaranteedPaymentsForCapital',
    'box4cTotalGuaranteedPayments',
    'box5InterestIncome',
    'box6aOrdinaryDividends',
    'box6bQualifiedDividends',
    'box6cDividendEquivalents',
    'box7Royalties',
    'box8NetShortTermCapitalGain',
    'box9aNetLongTermCapitalGain',
    'box9bCollectiblesTwentyEightPercentGain',
    'box9cUnrecapturedSection1250Gain',
    'box10NetSection1231Gain',
    'box12Section179Deduction',
    'box21ForeignTaxesPaidOrAccrued',
])

/** Every CODED box on this form, walked in one loop by {@link checkReferences}. */
export const codedBoxFields = /** @type {const} */ ([
    'box11OtherIncome',
    'box13OtherDeductions',
    'box14SelfEmploymentEarnings',
    'box15Credits',
    'box17AlternativeMinimumTaxItems',
    'box18TaxExemptIncomeAndNondeductibleExpenses',
    'box19Distributions',
    'box20OtherInformation',
])

/**
 * **The separately stated items this engine cannot place, each naming where
 * the amount would have gone.** A present, NON-ZERO amount in any of them
 * refuses the document at storage; a present ZERO is accepted, because a
 * transcript that prints `0.00` into an unused box is ordinary.
 *
 * Eleven of the eighteen fixed-caption money boxes are here. The boxes that
 * are NOT here are the ones this engine computes, and they are LISTED rather
 * than described, because there is now more than one of them and the list
 * grows every time a destination is wired. A sentence of the form "box 1 is
 * the one that is not" was true for exactly as long as it took to route a
 * second box, and a count with no list cannot say WHICH box left.
 *
 * - box 1 — ordinary business income, through `fjs/schedule/e` Part II.
 * - box 5 — interest income, through `fjs/form1040/core`'s 1040 line 2b
 *   (TAX-35, §702(a)(8)). Note that this face numbers its interest FIVE where
 *   the S corporation numbers it four and the beneficiary numbers it one; the
 *   three tables are deliberately not shared for exactly this reason.
 * - box 6a — ordinary dividends, 1040 line 3b (TAX-35).
 * - box 6b — qualified dividends, 1040 line 3a (TAX-35). A SUBSET of 6a, on
 *   its own line exactly as a 1099-DIV's box 1b is a subset of box 1a, so it
 *   is never added to 3b a second time.
 * - box 6c — dividend equivalents, 1040 line 3b (TAX-35). **A sixth routed
 *   box this face has and the other two do not**: a §871(m) dividend
 *   equivalent is a payment treated as a dividend, not a slice of box 6a, so
 *   it is a genuine second summand of line 3b rather than the double count
 *   box 4c would be for boxes 4a and 4b.
 * - box 8 — net short-term capital gain or loss, Schedule D line 5 (TAX-35).
 * - box 9a — net long-term capital gain or loss, Schedule D line 12 (TAX-35).
 *
 * **Boxes 9b and 9c stay refused, and they are the reason box 9a alone is not
 * enough to call this face's capital gains modeled.** The collectibles 28%
 * slice and the unrecaptured §1250 slice are components OF box 9a that the
 * printed form routes to two worksheets this engine does not compute, so a
 * partner holding either still gets told which line cannot be filled — even
 * though the box that contains them now computes.
 *
 * **Every destination below is a REAL line on a real form**, and that is the
 * point of the table rather than decoration: §702(a) requires each of these to
 * be taken into account SEPARATELY by the partner, on its own line elsewhere
 * on the return. Routing them to Schedule E would be as wrong as dropping
 * them, and dropping them silently would understate the tax — so a partner who
 * has one is told which line this engine cannot fill for them.
 */
export const unmodeledMoneyBoxes = /** @type {const} */ ([
    ['box2NetRentalRealEstateIncome', 'Schedule E Part I (lines 3-26), rental real estate — which this engine does not model; `rentalRealEstateAndRoyalties` is an `fjs/return/scope` refusal'],
    ['box3OtherNetRentalIncome', 'Schedule E Part II column (g) or (j) as a SECOND activity separate from box 1, with its own §469 grouping and its own at-risk determination'],
    ['box4aGuaranteedPaymentsForServices', 'Schedule E Part II line 28 column (j) AND Schedule SE line 2 — §707(c) payments for services are self-employment earnings even for a limited partner (§1402(a)(13)), so they are never merely box 1 by another name'],
    ['box4bGuaranteedPaymentsForCapital', 'Schedule E Part II line 28 column (j) — §707(c) payments for the use of capital, which are NOT self-employment earnings, so they part company with box 4a at Schedule SE'],
    ['box4cTotalGuaranteedPayments', 'the printed total of boxes 4a and 4b, which cannot be routed without routing its two components'],
    ['box7Royalties', 'Schedule E Part I line 4 (royalties received) — Part I, not Part II, which is why a royalty cannot ride into line 41 on this schedule’s partnership block'],
    ['box9bCollectiblesTwentyEightPercentGain', 'the 28% Rate Gain Worksheet and Schedule D line 18'],
    ['box9cUnrecapturedSection1250Gain', 'the Unrecaptured Section 1250 Gain Worksheet and Schedule D line 19'],
    ['box10NetSection1231Gain', 'Form 4797 Part I, and thence Schedule 1 line 4 (other gains or losses) — `otherGainsOrLosses` is an `fjs/return/scope` refusal'],
    ['box12Section179Deduction', 'Schedule E Part II line 28 column (i), which the printed form takes from Form 4562 — the same asset basis history Schedule C line 13 already refuses for'],
    ['box21ForeignTaxesPaidOrAccrued', 'Schedule 3 line 1 (foreign tax credit), through Form 1116 — and NOT through §904(j), whose de-minimis election `fjs/schedule/3` does compute: §904(j)(3) reaches only passive income shown on a payee statement furnished to the individual, which a partner\'s distributive share of partnership-level foreign taxes is not. This row also keeps §904(j)(2)(B)\'s $300/$600 ceiling honest, since that ceiling is on the taxpayer\'s TOTAL creditable foreign taxes and this box is the only one in the document set `fjs/schedule/3` does not read'],
])

/**
 * Either a structural validation error or a semantic (string) error message.
 * @typedef {ValidationError | string} K1PartnershipError
 */

/**
 * Checks the semantic refinements the structural schema cannot express on an
 * already shape-valid `k1_1065` value:
 * - `formRevision` (DOC-10) must not be empty or whitespace-only.
 * - Box G must tick exactly ONE of its two printed checkboxes.
 * - `materialParticipation`, when present, must be one of
 *   {@link materialParticipationValues} — and a LIMITED partner may not assert
 *   material participation at all, because §469(h)(2) says they cannot have it.
 * - Every PRESENT money amount — fixed-caption or inside a coded row — must
 *   parse via `fjs/exact`'s `centsFromString` (DOC-11: absent boxes are
 *   skipped, never defaulted).
 * - Every present, NON-ZERO {@link unmodeledMoneyBoxes} box is refused by
 *   name, naming where it would have gone.
 * @type {(r: K1Partnership) => Result<K1Partnership, K1PartnershipError>}
 */
export const checkReferences = r => {
    const formRevisionMessage = formRevisionError(r.formRevision)
    if (formRevisionMessage !== undefined) {
        return error(formRevisionMessage)
    }
    const general = r.boxGGeneralPartnerOrLlcMemberManager === true
    const limited = r.boxGLimitedPartnerOrOtherLlcMember === true
    if (general === limited) {
        return error(
            `box G (partner type) must tick exactly one of `
            + `boxGGeneralPartnerOrLlcMemberManager and boxGLimitedPartnerOrOtherLlcMember, and `
            + `this document ticks ${general ? 'both' : 'neither'}. §1402(a)(13) excludes a `
            + `LIMITED partner's distributive share from net earnings from self-employment and `
            + `includes a general partner's, and §469(h)(2) decides the Schedule E column the `
            + `same way — so this engine cannot compute the return without knowing which. `
            + `Refusing rather than assuming a partner type, which would move the `
            + `self-employment tax by about 15.3% of 92.35% of the share in whichever direction `
            + `the assumption was wrong.`)
    }
    const participationMessage = materialParticipationError(r.materialParticipation)
    if (participationMessage !== undefined) {
        return error(participationMessage)
    }
    if (limited && r.materialParticipation === 'materiallyParticipated') {
        return error(
            `materialParticipation asserts 'materiallyParticipated' while box G ticks `
            + `'Limited partner or other LLC member'. §469(h)(2) provides that no interest as a `
            + `limited partner is an interest with respect to which the taxpayer materially `
            + `participates, so the two statements cannot both be true. Correct whichever `
            + `record is wrong; refusing rather than honouring an assertion the statute `
            + `forbids.`)
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
 * Validates an already-parsed JSON value as a `k1_1065` BLOB: structural (rtti)
 * validation followed by the semantic checks in {@link checkReferences}.
 * @type {(value: Unknown) => Result<K1Partnership, K1PartnershipError>}
 */
export const validate = value => {
    const [t, v] = validateShape(value)
    if (t === 'error') {
        return error(v)
    }
    return checkReferences(v)
}

// ── Tests ────────────────────────────────────────────────────────────────────

/** The smallest valid Schedule K-1 (Form 1065): a general partner, no amounts.
 * @type {K1Partnership}
 */
const minimal = {
    dialect,
    payerTin: '33-3333333',
    recipientTin: '222-22-2222',
    accountNumber: 'PTR-0001',
    taxYear: 2025,
    formRevision: '2025',
    boxGGeneralPartnerOrLlcMemberManager: true,
    materialParticipation: 'materiallyParticipated',
}

/**
 * A LIMITED partner, with no §469 determination — §469(h)(2) settles it, so
 * the assertion is absent rather than stated.
 *
 * Spelled out rather than spread with `…: undefined`, because a spread of
 * `undefined` leaves the KEY present and `'materialParticipation' in v` would
 * then be true. Absent and present-but-undefined are exactly the two states
 * DOC-11 exists to keep apart.
 * @type {K1Partnership}
 */
const limitedPartner = {
    dialect,
    payerTin: '33-3333333',
    recipientTin: '222-22-2222',
    accountNumber: 'PTR-0001',
    taxYear: 2025,
    formRevision: '2025',
    boxGLimitedPartnerOrOtherLlcMember: true,
}

/** A GENERAL partner with no §469 determination — the case Schedule E refuses.
 * @type {K1Partnership}
 */
const generalPartnerWithNoDetermination = {
    dialect,
    payerTin: '33-3333333',
    recipientTin: '222-22-2222',
    accountNumber: 'PTR-0001',
    taxYear: 2025,
    formRevision: '2025',
    boxGGeneralPartnerOrLlcMemberManager: true,
}

/** The founder's own K-1: an active general partner with an $80,000 share. */
/** @type {K1Partnership} */
const generalPartnerShare = {
    ...minimal,
    box1OrdinaryBusinessIncome: '80000.00',
    box14SelfEmploymentEarnings: [{ code: 'A', amount: '80000.00' }],
}

/**
 * One generated leaf per fixed-caption money box: supplying a comma-grouped
 * amount to that box alone must be refused. Mirrors `fjs/document/1099nec`'s
 * own per-box coverage so a box quietly dropped from {@link moneyBoxFields} is
 * caught rather than silently accepting inexact input.
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
 * must be refused, naming both the box and the CODE. Without the code the
 * message names one of up to a dozen rows in the same printed box.
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
 * refused, and the message must name both the box and where it would have
 * gone. Phase 20's verification found that erasing the destination survived
 * the entire suite, so the destination is asserted separately.
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

/** Hand-typed off the printed 2025 Schedule K-1 (Form 1065) face. */
const expectedMoneyBoxCount = 18
/** Hand-typed: eight coded boxes — 11, 13, 14, 15, 17, 18, 19 and 20. */
const expectedCodedBoxCount = 8
/** Hand-typed: eleven of the eighteen refuse. `18 - 7` — box 1 computes
 * (Schedule E Part II); boxes 5, 6a, 6b, 6c, 8 and 9a compute (1040 line 2b,
 * 1040 lines 3b/3a/3b, Schedule D lines 5 and 12), all six TAX-35. */
const expectedUnmodeledBoxCount = 11

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
    'box1OrdinaryBusinessIncome',
    'box5InterestIncome',
    'box6aOrdinaryDividends',
    'box6bQualifiedDividends',
    'box6cDividendEquivalents',
    'box8NetShortTermCapitalGain',
    'box9aNetLongTermCapitalGain',
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
 * off the printed 2025 `f1065sk1.pdf` face: every box number, its printed
 * caption in short form, and which of the three kinds of box it is.
 *
 * Deliberately NOT derived from {@link moneyBoxFields},
 * {@link codedBoxFields} or {@link unmodeledMoneyBoxes} — all three are the
 * code under test, and AGENTS.md records four shipped defects whose common
 * shape is a proof whose expected side came from the thing it was checking.
 * `theHandTypedPrintedBoxTableAgreesWithTheCode` is the comparison that keeps
 * this list from drifting away from what it mirrors.
 * @type {readonly (readonly [string, string])[]}
 */
const printedPartIIIBoxes = [
    ['box1OrdinaryBusinessIncome', 'money'],
    ['box2NetRentalRealEstateIncome', 'money'],
    ['box3OtherNetRentalIncome', 'money'],
    ['box4aGuaranteedPaymentsForServices', 'money'],
    ['box4bGuaranteedPaymentsForCapital', 'money'],
    ['box4cTotalGuaranteedPayments', 'money'],
    ['box5InterestIncome', 'money'],
    ['box6aOrdinaryDividends', 'money'],
    ['box6bQualifiedDividends', 'money'],
    ['box6cDividendEquivalents', 'money'],
    ['box7Royalties', 'money'],
    ['box8NetShortTermCapitalGain', 'money'],
    ['box9aNetLongTermCapitalGain', 'money'],
    ['box9bCollectiblesTwentyEightPercentGain', 'money'],
    ['box9cUnrecapturedSection1250Gain', 'money'],
    ['box10NetSection1231Gain', 'money'],
    ['box11OtherIncome', 'coded'],
    ['box12Section179Deduction', 'money'],
    ['box13OtherDeductions', 'coded'],
    ['box14SelfEmploymentEarnings', 'coded'],
    ['box15Credits', 'coded'],
    ['box16ScheduleK3Attached', 'checkbox'],
    ['box17AlternativeMinimumTaxItems', 'coded'],
    ['box18TaxExemptIncomeAndNondeductibleExpenses', 'coded'],
    ['box19Distributions', 'coded'],
    ['box20OtherInformation', 'coded'],
    ['box21ForeignTaxesPaidOrAccrued', 'money'],
    ['box22MoreThanOneActivityForAtRiskPurposes', 'checkbox'],
    ['box23MoreThanOneActivityForPassiveActivityPurposes', 'checkbox'],
]

/** Hand-typed: twenty-nine printed Part III fields in all (18 money + 8 coded + 3 checkbox). */
const expectedPartIIIFieldCount = 29

export const proof = {
    ...perMoneyBoxRejection,
    ...perCodedBoxRejection,
    ...perUnmodeledBoxRefusal,
    ...perUnmodeledBoxZeroAccepted,
    ...perComputedBoxAcceptedWhenNonZero,

    dialectAndMediaType: () => {
        assertEq(dialect, 'vnd.fjs.k1_1065')
        assertEq(mediaType, 'application/vnd.fjs.k1_1065+json')
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
     * the code's own three lists, in both directions — so a box that lost its
     * entry, changed kind, or was invented reddens by name.
     *
     * AGENTS.md: "a hand-typed list drifts unless something COMPARES it to
     * what it mirrors."
     */
    theHandTypedPrintedBoxTableAgreesWithTheCode: () => {
        assertEq(printedPartIIIBoxes.length, expectedPartIIIFieldCount)
        /** @type {readonly string[]} */
        const money = moneyBoxFields
        /** @type {readonly string[]} */
        const coded = codedBoxFields
        const checkboxes = [
            'box16ScheduleK3Attached',
            'box22MoreThanOneActivityForAtRiskPurposes',
            'box23MoreThanOneActivityForPassiveActivityPurposes',
        ]
        for (const [field, kind] of printedPartIIIBoxes) {
            const inMoney = money.includes(field)
            const inCoded = coded.includes(field)
            const inCheckbox = checkboxes.includes(field)
            assertEq(
                [inMoney, inCoded, inCheckbox].filter(x => x).length,
                1,
                ['every printed Part III box must be declared exactly once', field])
            assertEq(inMoney, kind === 'money', ['box is on the wrong list', field])
            assertEq(inCoded, kind === 'coded', ['box is on the wrong list', field])
            // The schema must actually carry it, so a box named here and
            // absent from `k1PartnershipSchema` cannot pass.
            assert(field in k1PartnershipSchema, ['the schema is missing a printed box', field])
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
        // **The partition, asserted BY NAME in both directions** — added by
        // TAX-35, and this face had no such assertion before it: the counts
        // above could see a box LEAVE `unmodeledMoneyBoxes`, but nothing could
        // see it leave without anything computing it. `fjs/document/k1_1041`
        // already carried the by-name form; the two entity faces did not, so
        // a row deleted here was a silently accepted, silently unread box.
        // {@link computedMoneyBoxes} is the hand-typed side of the partition.
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

    minimalValidates: () => {
        const [t] = validate(minimal)
        assertEq(t, 'ok')
    },

    /** The founder's own K-1 round-trips both computed figures. */
    generalPartnerShareValidates: () => {
        const [t, v] = validate(generalPartnerShare)
        assertEq(t, 'ok')
        assert(t === 'ok' && v.box1OrdinaryBusinessIncome === '80000.00', ['box 1 round-trips', v])
        assert(t === 'ok' && v.box14SelfEmploymentEarnings?.[0]?.code === 'A', ['box 14 code round-trips', v])
        assert(t === 'ok' && v.box14SelfEmploymentEarnings?.[0]?.amount === '80000.00', ['box 14 amount round-trips', v])
    },

    boxG: {
        /**
         * NEITHER checkbox ticked. The commonest way a hand-transcribed K-1
         * arrives incomplete, and the one a default would silently paper over.
         */
        neitherPartnerTypeIsRefused: () => {
            const [t, v] = validate({
                ...limitedPartner,
                boxGLimitedPartnerOrOtherLlcMember: undefined,
            })
            assertEq(t, 'error')
            assert(typeof v === 'string' && v.includes('box G'), [v])
            assert(typeof v === 'string' && v.includes('neither'), [v])
            // The refusal must name the statute a reader can look up, and
            // both directions the error would run.
            assert(typeof v === 'string' && v.includes('§1402(a)(13)'), [v])
            assert(typeof v === 'string' && v.includes('§469(h)(2)'), [v])
        },

        /** BOTH ticked — a different transcription error, the same refusal. */
        bothPartnerTypesAreRefused: () => {
            const [t, v] = validate({
                ...minimal,
                boxGLimitedPartnerOrOtherLlcMember: true,
            })
            assertEq(t, 'error')
            assert(typeof v === 'string' && v.includes('both'), [v])
        },

        /**
         * THE CONTROL. A gate that refuses everything passes every refusal
         * proof, so the legitimate limited-partner case must be shown to
         * validate — and a limited partner asserts NO material participation,
         * because §469(h)(2) settles it.
         */
        aLimitedPartnerValidates: () => {
            const [t, v] = validate(limitedPartner)
            assertEq(t, 'ok')
            assert(t === 'ok' && v.boxGLimitedPartnerOrOtherLlcMember === true, [v])
            assert(t === 'ok' && !('boxGGeneralPartnerOrLlcMemberManager' in v), ['absent stays absent', v])
        },

        /** DOC-12's checkbox convention: `false` is structurally rejected. */
        aFalseCheckboxIsStructurallyRejected: () => {
            const [t] = validate({ ...minimal, boxGLimitedPartnerOrOtherLlcMember: false })
            assertEq(t, 'error')
        },
    },

    materialParticipation: {
        /**
         * §469(h)(2): a limited partner cannot materially participate, so an
         * assertion that they did is refused rather than honoured. This is the
         * one place the statute overrides the taxpayer's own statement, and it
         * must name the statute so a reader can check it.
         */
        aLimitedPartnerMayNotAssertMaterialParticipation: () => {
            const [t, v] = validate({
                ...limitedPartner,
                materialParticipation: 'materiallyParticipated',
            })
            assertEq(t, 'error')
            assert(typeof v === 'string' && v.includes('§469(h)(2)'), [v])
            assert(typeof v === 'string' && v.includes('materiallyParticipated'), [v])
        },

        /**
         * THE CONTROL for the rule above: a limited partner asserting that
         * they did NOT materially participate is stating the statute's own
         * conclusion, and must be accepted.
         */
        aLimitedPartnerMayAssertNonParticipation: () => {
            const [t] = validate({
                ...limitedPartner,
                materialParticipation: 'didNotMateriallyParticipate',
            })
            assertEq(t, 'ok')
        },

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
         * ABSENT is accepted at STORAGE and refused at Schedule E, which is
         * the split this project uses everywhere: a document is stored for
         * what it says, and refused where the missing fact would change an
         * answer. `fjs/schedule/e` is where the absence is refused.
         */
        anAbsentAssertionStoresAndIsNotDefaulted: () => {
            const [t, v] = validate(generalPartnerWithNoDetermination)
            assertEq(t, 'ok')
            assert(t === 'ok' && !('materialParticipation' in v), ['absent stays absent', v])
        },
    },

    codedBoxes: {
        /**
         * A coded box carries SEVERAL rows, and the order and codes must
         * survive. A real box 20 routinely prints A, N and Z together.
         */
        severalCodedRowsAreStoredInOrder: () => {
            const [t, v] = validate({
                ...minimal,
                box20OtherInformation: [
                    { code: 'A', amount: '125.00' },
                    { code: 'N', amount: '4300.00' },
                    { code: 'Z' },
                ],
            })
            assertEq(t, 'ok')
            assert(t === 'ok' && v.box20OtherInformation?.length === 3, [v])
            assert(t === 'ok' && v.box20OtherInformation?.[0]?.code === 'A', [v])
            assert(t === 'ok' && v.box20OtherInformation?.[1]?.code === 'N', [v])
            assert(t === 'ok' && v.box20OtherInformation?.[2]?.code === 'Z', [v])
            // DOC-11: box 20 code Z routinely prints "STMT" rather than an
            // amount, so an absent amount must stay ABSENT rather than
            // becoming a zero that says the statement reported nothing.
            assert(t === 'ok' && v.box20OtherInformation?.[2]?.amount === undefined, ['absent stays absent', v])
        },

        /** An empty coded box is legitimate and distinguishable from absence. */
        anAbsentCodedBoxIsAbsentNotEmpty: () => {
            const [t, v] = validate(minimal)
            assertEq(t, 'ok')
            assert(t === 'ok' && !('box20OtherInformation' in v), ['absent stays absent', v])
        },

        /** A row with no `code` at all is structurally rejected: a code is what a coded box IS. */
        aRowWithoutACodeIsStructurallyRejected: () => {
            const [t] = validate({ ...minimal, box14SelfEmploymentEarnings: [{ amount: '10.00' }] })
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
        assert(t === 'ok' && !('box1OrdinaryBusinessIncome' in v), ['absent box must stay absent', v])
        assert(t === 'ok' && !('box14SelfEmploymentEarnings' in v), ['absent box must stay absent', v])
    },

    /** A blob tagged as another dialect is rejected structurally, on `dialect`. */
    otherDialectRejected: () => {
        const [t, v] = validate({ ...minimal, dialect: 'vnd.fjs.k1_1120s' })
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
     * DOC-00, `crossDialect`-style, in the direction that matters most for
     * this requirement: an S-corporation K-1 must not be readable as a
     * partnership K-1. It is the SAME printed form family with a DIFFERENT box
     * numbering, so it is the one blob most likely to be misread — and the
     * misreading is expensive, since a 1120-S box 7 short-term capital gain
     * would arrive in a 1065 box 7 royalty field and its box 1 would carry
     * self-employment tax it does not owe.
     */
    crossDialect: {
        anSCorpShareholderK1IsRejectedByThePartnershipDialect: () => {
            const [t, v] = validate({
                dialect: 'vnd.fjs.k1_1120s',
                payerTin: '44-4444444',
                recipientTin: '222-22-2222',
                accountNumber: 'SHR-0001',
                taxYear: 2025,
                formRevision: '2025',
                box1OrdinaryBusinessIncome: '80000.00',
                box7NetShortTermCapitalGain: '1500.00',
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
