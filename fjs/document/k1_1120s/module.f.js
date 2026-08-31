/**
 * `vnd.fjs.k1_1120s` — Schedule K-1 (Form 1120-S), *Shareholder's Share of
 * Income, Deductions, Credits, etc.* (DOC-24, second of two).
 *
 * ## The three differences from `vnd.fjs.k1_1065` that are not cosmetic
 *
 * `fjs/document/k1_1065`'s own header carries the box-collision table and the
 * argument for two dialects rather than one. Three differences are worth
 * stating HERE, because each is a tax rule rather than a layout:
 *
 * 1. **There is no box 14 code A, and there is no partner type**, because an
 *    S-corporation shareholder's distributive share is **never** subject to
 *    self-employment tax. Rev. Rul. 59-221 settled it: a shareholder's pro
 *    rata share of S-corporation income is not net earnings from
 *    self-employment, whatever their involvement in the business. So this
 *    dialect has no box G, no `boxGGeneralPartner…` pair, and nothing that
 *    reaches `fjs/schedule/se` — and that absence is a modeled fact rather
 *    than an omission: `fjs/schedule/e` proves it against the partnership
 *    case with two fixtures whose only difference is the entity type.
 *
 *    The counterpart rule — that a shareholder-employee must be paid
 *    *reasonable compensation* on a Form W-2, and that the payroll taxes ride
 *    on THAT rather than on the share — is a §3121 question about wages this
 *    engine already reads on 1040 line 1a, not a Schedule K-1 question.
 *
 * 2. **Printed box 14 is a CHECKBOX** (*"Schedule K-3 is attached if
 *    checked"*), which is the collision that would cost the most: a shared
 *    schema looking for self-employment earnings in box 14 would find, on this
 *    face, a checkbox. {@link proof.crossDialect} proves the two dialects
 *    cannot be interchanged.
 *
 * 3. **§1366(d) rather than §704(d)** limits a loss, and the basis it is
 *    measured against includes shareholder LOANS to the corporation as well
 *    as stock basis. Both are multi-year histories no document here holds, so
 *    a loss refuses — see `fjs/schedule/e`'s own net-loss decision, which is
 *    `fjs/schedule/c`'s.
 *
 * ## What this dialect COMPUTES versus what it merely STORES
 *
 * SIX figures are consumed by a computation, on three different forms. The
 * list is the authority; a bare count would not say which:
 *
 * - **Box 1, ordinary business income (loss)** → Schedule E Part II line 28
 *   column (g) or (j) → line 32 → line 41 → Schedule 1 line 5 → 1040 line 8.
 * - **Box 4, interest income** → 1040 line 2b, through §1366(a)(1)(A)
 *   (TAX-35). **Four here, where the partnership numbers its interest five
 *   and this face's box 5 is the dividend pair.**
 * - **Box 5a, ordinary dividends** → 1040 line 3b (TAX-35).
 * - **Box 5b, qualified dividends** → 1040 line 3a ONLY (TAX-35), a subset of
 *   box 5a that never joins line 3b a second time.
 * - **Box 7, net short-term capital gain (loss)** → Schedule D line 5 (TAX-35).
 * - **Box 8a, net long-term capital gain (loss)** → Schedule D line 12
 *   (TAX-35); its boxes 8b/8c slices stay REFUSED at their worksheets.
 *
 * One asserted field is read and decides the return:
 *
 * - **`materialParticipation`**, the §469 determination the printed Schedule E
 *   Part II requires for every entity. It is NOT a printed box; see
 *   `fjs/document/k1_common` for the shared vocabulary and
 *   `fjs/document/k1_1065`'s header for why a taxpayer assertion rides on a
 *   transcribed document here. **Unlike the 1065 case there is no statutory
 *   override**: §469(h)(2)'s limited-partner rule has no S-corporation
 *   counterpart, so every shareholder must state the determination and an
 *   absent one refuses at `fjs/schedule/e`.
 *
 * Everything else is stored and computed on by nothing, and nothing that
 * carries an amount is merely dropped: {@link unmodeledMoneyBoxes} refuses
 * every present, NON-ZERO one by name, naming the line elsewhere on the return
 * it would have reached.
 *
 * ## Part II's two non-amount fields, and why they are absent
 *
 * The 2025 face prints, in Part II, the shareholder's *number of shares* and
 * *loans from shareholder*, each with a beginning and an ending figure. Both
 * exist for §1366(d) basis, which this engine refuses wholesale — so modeling
 * them would produce four stored fields with no reader, which is exactly the
 * `box13StatutoryEmployee` defect Phase 27 found in `vnd.fjs.w2` and Phase 28
 * declined to repeat with an SSTB field. They acquire a reader the day
 * stock-and-debt basis is modeled.
 *
 * @module
 */
import { array, number, open, option, string } from 'functionalscript/fjs/types/rtti/module.f.mjs'
import { validate as rttiValidate } from 'functionalscript/fjs/types/rtti/validate/module.f.mjs'
import { error, ok } from 'functionalscript/fjs/types/result/module.f.mjs'
import { assert, assertEq } from 'functionalscript/fjs/asserts/module.f.mjs'
import { centsFromString } from '../../exact/module.f.js'
import { base, mediaTypeOf } from '../base/module.f.js'
import { formRevisionError } from '../form_revision/module.f.js'
import { moneyFieldError } from '../money_field/module.f.js'
import { codedEntry, codedBoxError, materialParticipationValues, materialParticipationError } from '../k1_common/module.f.js'
import { declaredMembers } from '../../document/base/module.f.js'

/** @import { Result } from 'functionalscript/fjs/types/result/types.js' */
/** @import { Ts, Unknown } from 'functionalscript/fjs/types/rtti/ts/types.js' */
/** @import { ValidationError } from 'functionalscript/fjs/types/rtti/common/types.js' */
/** @import { SubjectKey } from '../subject/module.f.js' */

/**
 * Format tag: names the dialect of this BLOB. The media type it is served
 * with is derived mechanically: `application/` + `dialect` + `+json`.
 */
export const dialect = 'vnd.fjs.k1_1120s'
/** The media type derived from {@link dialect}: `application/vnd.fjs.k1_1120s+json`. */
export const mediaType = mediaTypeOf(dialect)

/**
 * rtti schema for a `k1_1120s` BLOB — Part I (the corporation), Part II (the
 * shareholder) and Part III (the shareholder's share), transcribed from the
 * printed 2025 `f1120ssk.pdf` face in the form's own order.
 *
 * `corporationEIN` is printed box A, captioned **"Corporation's employer
 * identification number"**, and `shareholderIdentifyingNumber` is printed box
 * **E**, captioned **"Shareholder's identifying number"**.
 *
 * **This docstring said box D, and box D is something else entirely.** On the
 * 2025 face, Part I runs A (the EIN), B (name and address) and C (the IRS
 * center), then **D is "Corporation's total number of shares"** — a count with
 * a beginning-of-year and an end-of-year line, not an identity at all — and
 * Part II opens at E. The letter was wrong here from the beginning and is
 * corrected against `f1120ssk.pdf` read directly rather than recalled.
 *
 * They were `payerTin`/`recipientTin` until FORM-KEY-02, on the reasoning that
 * one set of names on every dialect makes a cross-document match read one
 * field name — but **"Payer" and "Recipient" appear NOWHERE on this face**: a
 * case-insensitive search over the whole page returns zero hits for either.
 * FORM-KEY-01 made the names free to follow the paper while {@link subjectKey}
 * keeps the ROLES right, so they do.
 *
 * **`accountNumber` is UNCHANGED, and there is nothing on the paper to rename
 * it to.** A search for "account" over this entire face returns ZERO hits —
 * fewer even than `vnd.fjs.k1_1065`, whose page at least prints a *capital
 * account analysis*. The field is DOC-01's account ROLE, carrying whatever
 * identifier the shareholder's statement uses, and it keeps a role name
 * because no printed caption exists to take.
 */
export const k1SCorporationSchema = open({
    ...base(dialect),
    corporationEIN: string,
    shareholderIdentifyingNumber: string,
    accountNumber: string,
    taxYear: number,
    formRevision: string,
    corrected: option(true),
    payerName: option(string),
    recipientName: option(string),
    // The one field that is not a printed box. There is no box G here: see
    // this module's own docstring, difference 1.
    materialParticipation: option(string),
    // Part III, the fixed-caption money boxes.
    box1OrdinaryBusinessIncome: option(string),
    box2NetRentalRealEstateIncome: option(string),
    box3OtherNetRentalIncome: option(string),
    box4InterestIncome: option(string),
    box5aOrdinaryDividends: option(string),
    box5bQualifiedDividends: option(string),
    box6Royalties: option(string),
    box7NetShortTermCapitalGain: option(string),
    box8aNetLongTermCapitalGain: option(string),
    box8bCollectiblesTwentyEightPercentGain: option(string),
    box8cUnrecapturedSection1250Gain: option(string),
    box9NetSection1231Gain: option(string),
    box11Section179Deduction: option(string),
    // Part III, the CODED boxes — a code letter and an amount, repeated.
    box10OtherIncome: option(array(codedEntry)),
    box12OtherDeductions: option(array(codedEntry)),
    box13Credits: option(array(codedEntry)),
    box15AlternativeMinimumTaxItems: option(array(codedEntry)),
    box16ItemsAffectingShareholderBasis: option(array(codedEntry)),
    box17OtherInformation: option(array(codedEntry)),
    // Part III, the checkbox-only boxes.
    box14ScheduleK3Attached: option(true),
    box18MoreThanOneActivityForAtRiskPurposes: option(true),
    box19MoreThanOneActivityForPassiveActivityPurposes: option(true),
})

/**
 * FORM-KEY-01 -- which of THIS dialect's OWN fields play the five roles a
 * form subject is keyed on. See `fjs/document/subject`'s {@link SubjectKey}
 * for why the dialect declares this instead of every caller assuming one
 * shared set of field names.
 * @type {SubjectKey}
 */
export const subjectKey = { formType: 'dialect', taxYear: 'taxYear', payer: 'corporationEIN', recipient: 'shareholderIdentifyingNumber', account: 'accountNumber' }

/** @typedef {Ts<typeof k1SCorporationSchema>} K1SCorporation */

/** Structural-only validator: checks the shape, not the semantic refinements below. */
const validateShape = rttiValidate(k1SCorporationSchema)

/** Every fixed-caption money box on this form, walked in one loop. */
export const moneyBoxFields = /** @type {const} */ ([
    'box1OrdinaryBusinessIncome',
    'box2NetRentalRealEstateIncome',
    'box3OtherNetRentalIncome',
    'box4InterestIncome',
    'box5aOrdinaryDividends',
    'box5bQualifiedDividends',
    'box6Royalties',
    'box7NetShortTermCapitalGain',
    'box8aNetLongTermCapitalGain',
    'box8bCollectiblesTwentyEightPercentGain',
    'box8cUnrecapturedSection1250Gain',
    'box9NetSection1231Gain',
    'box11Section179Deduction',
])

/** Every CODED box on this form, walked in one loop by {@link checkReferences}. */
export const codedBoxFields = /** @type {const} */ ([
    'box10OtherIncome',
    'box12OtherDeductions',
    'box13Credits',
    'box15AlternativeMinimumTaxItems',
    'box16ItemsAffectingShareholderBasis',
    'box17OtherInformation',
])

/**
 * **The separately stated items this engine cannot place, each naming where
 * the amount would have gone.** Seven of the thirteen fixed-caption money
 * boxes. The boxes that are NOT here are the ones this engine computes, and
 * they are LISTED rather than described, because there is now more than one of
 * them and the list grows every time a destination is wired:
 *
 * - box 1 — ordinary business income, through `fjs/schedule/e` Part II.
 * - box 4 — interest income, through `fjs/form1040/core`'s 1040 line 2b
 *   (TAX-35, §1366(a)(1)(A)). This face numbers its interest FOUR where the
 *   partnership numbers it five and the beneficiary numbers it one.
 * - box 5a — ordinary dividends, 1040 line 3b (TAX-35).
 * - box 5b — qualified dividends, 1040 line 3a (TAX-35). A SUBSET of 5a, on
 *   its own line, never added to 3b a second time. **This face's box 5 is the
 *   dividend pair where the partnership's box 5 is interest** — the single
 *   sharpest reason the three tables are not shared.
 *
 * - box 7 — net short-term capital gain or loss, Schedule D line 5 (TAX-35).
 * - box 8a — net long-term capital gain or loss, Schedule D line 12 (TAX-35).
 *
 * There is no counterpart here to the partnership's box 6c: an S corporation
 * reports no §871(m) dividend equivalent on this face, so the partnership
 * routes SIX boxes where this one routes five.
 *
 * **Boxes 8b and 8c stay refused** — the collectibles 28% slice and the
 * unrecaptured §1250 slice are components OF box 8a bound for two worksheets
 * this engine does not compute.
 *
 * §1366(a)(1) is the S-corporation counterpart of §702(a): each of these is
 * taken into account separately by the shareholder, on its own line elsewhere
 * on the return. Dropping one silently would understate the tax.
 *
 * **The destinations are the SAME lines the partnership dialect names**,
 * because the shareholder's and the partner's separately stated items land in
 * the same places — it is only the box NUMBERS that differ. That is exactly
 * why the two dialects are separate and this table is not shared: the pairing
 * of a box number to a destination is what a shared table would get wrong.
 */
export const unmodeledMoneyBoxes = /** @type {const} */ ([
    ['box2NetRentalRealEstateIncome', 'Schedule E PART II, the passive columns of printed line 28, after Form 8582 — NOT Part I. Printed Part I is one column per property the taxpayer owns directly, and a shareholder owns stock rather than the corporation’s buildings, so this share cannot become a Part I column even though Part I now computes. What it needs is Form 8582, which needs every passive activity on the return and every prior-year unallowed loss'],
    ['box3OtherNetRentalIncome', 'Schedule E Part II column (g) or (j) as a SECOND activity separate from box 1, with its own §469 grouping and its own basis limitation'],
    ['box6Royalties', 'Schedule E Part I line 4 (royalties received) — Part I, not Part II, which is why a royalty cannot ride into line 41 on this schedule’s S-corporation block. Printed line 4 now EXISTS (`fjs/schedule/e/part_i`), so what is missing is no longer the line but the WIRING to it: a Part I column needs a printed line 1b type code and an identity of its own, and the depletion and expense this royalty carries arrive in coded boxes that every one of them refuses by name — so routing the gross box alone would report the royalty with none of its offsets'],
    ['box8bCollectiblesTwentyEightPercentGain', 'the 28% Rate Gain Worksheet and Schedule D line 18'],
    ['box8cUnrecapturedSection1250Gain', 'the Unrecaptured Section 1250 Gain Worksheet and Schedule D line 19'],
    ['box9NetSection1231Gain', 'Form 4797 Part I, and thence Schedule 1 line 4 (other gains or losses). Printed Form 4797 now EXISTS here (`fjs/form4797`) and `otherGainsOrLosses` is MODELED, so what is missing is no longer the form but a route INTO its Part I: this engine builds printed line 2 and line 10 exclusively from the per-asset disposal blocks on a vnd.fjs.asset_register, which record a basis, a method and a placed-in-service date. A partner’s distributive share is a bare net figure with none of those, and it enters Part I as a line 2 row of its own rather than through a Part III recapture computation (i4797 p6, line 7: “enter any amounts from your Schedule K-1 (Form 1065), box 10, in Part I of Form 4797”). Routing it would also need §469, since a limited partner’s §1231 loss is passive'],
    ['box11Section179Deduction', 'Schedule E Part II line 28 column (i), which the printed form takes from Form 4562. Form 4562 now EXISTS here and it refuses Part I by name: a partner’s or shareholder’s §179 deduction is limited on line 11 by THEIR OWN business income — i4562 p4: “For a partnership, these limitations apply to the partnership and each partner” — and whatever line 11 disallows carries to next year on line 13, which this engine cannot store'],
])

/**
 * Either a structural validation error or a semantic (string) error message.
 * @typedef {ValidationError | string} K1SCorporationError
 */

/**
 * Checks the semantic refinements the structural schema cannot express on an
 * already shape-valid `k1_1120s` value. The same four rules
 * `fjs/document/k1_1065` applies, minus box G, which this form does not print.
 * @type {(r: K1SCorporation) => Result<K1SCorporation, K1SCorporationError>}
 */
export const checkReferences = r => {
    const formRevisionMessage = formRevisionError(r.formRevision)
    if (formRevisionMessage !== undefined) {
        return error(formRevisionMessage)
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
 * Validates an already-parsed JSON value as a `k1_1120s` BLOB: structural
 * (rtti) validation followed by the semantic checks in
 * {@link checkReferences}.
 * @type {(value: Unknown) => Result<K1SCorporation, K1SCorporationError>}
 */
export const validate = value => {
    const [t, v] = validateShape(value)
    if (t === 'error') {
        return error(v)
    }
    return checkReferences(v)
}

// ── Tests ────────────────────────────────────────────────────────────────────

/** The smallest valid Schedule K-1 (Form 1120-S): no amounts at all.
 * @type {K1SCorporation}
 */
const minimal = {
    dialect,
    corporationEIN: '44-4444444',
    shareholderIdentifyingNumber: '222-22-2222',
    accountNumber: 'SHR-0001',
    taxYear: 2025,
    formRevision: '2025',
    materialParticipation: 'materiallyParticipated',
}

/**
 * The same document with the §469 assertion OMITTED — spelled out rather than
 * spread with `materialParticipation: undefined`, because a spread of
 * `undefined` leaves the KEY present and `'materialParticipation' in v` would
 * then be true. Absent and present-but-undefined are exactly the two states
 * DOC-11 exists to keep apart, so a fixture for the absent case may not be
 * built by the mechanism that conflates them.
 * @type {K1SCorporation}
 */
const minimalWithNoDetermination = {
    dialect,
    corporationEIN: '44-4444444',
    shareholderIdentifyingNumber: '222-22-2222',
    accountNumber: 'SHR-0001',
    taxYear: 2025,
    formRevision: '2025',
}

/**
 * The founder's own K-1 — the SAME $80,000.00 share the partnership fixture
 * carries, so the two can be compared with the entity type as their only
 * difference (criterion 3). There is no box 14 code A here and there cannot
 * be: see this module's docstring, difference 1.
 * @type {K1SCorporation}
 */
const shareholderShare = {
    ...minimal,
    box1OrdinaryBusinessIncome: '80000.00',
}

/** One generated leaf per fixed-caption money box. */
const perMoneyBoxRejection = Object.fromEntries(moneyBoxFields.map(field => [
    `${field}RejectsCommaGroupedAmount`,
    () => {
        const [t, v] = validate({ ...minimal, [field]: '1,234.56' })
        assertEq(t, 'error', `${field} must reject a comma-grouped amount`)
        assert(typeof v === 'string' && v.includes(field), [field, v])
    },
]))

/** One generated leaf per coded box, naming both the box and the CODE. */
const perCodedBoxRejection = Object.fromEntries(codedBoxFields.map(field => [
    `${field}RejectsCommaGroupedAmountNamingTheCode`,
    () => {
        const [t, v] = validate({ ...minimal, [field]: [{ code: 'Q', amount: '1,234.56' }] })
        assertEq(t, 'error', `${field} must reject a comma-grouped amount`)
        assert(typeof v === 'string' && v.includes(field), [field, v])
        assert(typeof v === 'string' && v.includes('Q'), ['the refusal must name the code', field, v])
    },
]))

/** One generated leaf per unmodeled box: refused when non-zero, naming the destination. */
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

/** Hand-typed off the printed 2025 Schedule K-1 (Form 1120-S) face. */
const expectedMoneyBoxCount = 13
/** Hand-typed: six coded boxes — 10, 12, 13, 15, 16 and 17. */
const expectedCodedBoxCount = 6
/** Hand-typed: seven of the thirteen refuse. `13 - 6` — box 1 computes
 * (Schedule E Part II); boxes 4, 5a, 5b, 7 and 8a compute (1040 line 2b, 1040
 * lines 3b/3a, Schedule D lines 5 and 12), all five TAX-35. */
const expectedUnmodeledBoxCount = 7

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
    'box4InterestIncome',
    'box5aOrdinaryDividends',
    'box5bQualifiedDividends',
    'box7NetShortTermCapitalGain',
    'box8aNetLongTermCapitalGain',
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
 * off the printed 2025 `f1120ssk.pdf` face. Deliberately NOT derived from the
 * three code lists it checks — see `fjs/document/k1_1065`'s counterpart for
 * the full argument.
 * @type {readonly (readonly [string, string])[]}
 */
const printedPartIIIBoxes = [
    ['box1OrdinaryBusinessIncome', 'money'],
    ['box2NetRentalRealEstateIncome', 'money'],
    ['box3OtherNetRentalIncome', 'money'],
    ['box4InterestIncome', 'money'],
    ['box5aOrdinaryDividends', 'money'],
    ['box5bQualifiedDividends', 'money'],
    ['box6Royalties', 'money'],
    ['box7NetShortTermCapitalGain', 'money'],
    ['box8aNetLongTermCapitalGain', 'money'],
    ['box8bCollectiblesTwentyEightPercentGain', 'money'],
    ['box8cUnrecapturedSection1250Gain', 'money'],
    ['box9NetSection1231Gain', 'money'],
    ['box10OtherIncome', 'coded'],
    ['box11Section179Deduction', 'money'],
    ['box12OtherDeductions', 'coded'],
    ['box13Credits', 'coded'],
    ['box14ScheduleK3Attached', 'checkbox'],
    ['box15AlternativeMinimumTaxItems', 'coded'],
    ['box16ItemsAffectingShareholderBasis', 'coded'],
    ['box17OtherInformation', 'coded'],
    ['box18MoreThanOneActivityForAtRiskPurposes', 'checkbox'],
    ['box19MoreThanOneActivityForPassiveActivityPurposes', 'checkbox'],
]

/** Hand-typed: twenty-two printed Part III fields in all (13 money + 6 coded + 3 checkbox). */
const expectedPartIIIFieldCount = 22

export const proof = {
    ...perMoneyBoxRejection,
    ...perCodedBoxRejection,
    ...perUnmodeledBoxRefusal,
    ...perUnmodeledBoxZeroAccepted,
    ...perComputedBoxAcceptedWhenNonZero,

    dialectAndMediaType: () => {
        assertEq(dialect, 'vnd.fjs.k1_1120s')
        assertEq(mediaType, 'application/vnd.fjs.k1_1120s+json')
    },

    /**
     * **The two parties, asserted rather than described.** `corporationEIN`
     * is printed box A and plays {@link subjectKey}'s `payer` role;
     * `shareholderIdentifyingNumber` is printed box E and plays its
     * `recipient` role. Nothing else in this module would notice the two
     * being transposed: the schema types both as `string`, and a transposed
     * pair still derives a perfectly well-formed subject — for the WRONG
     * business identity.
     *
     * The fixture uses two visibly different TIN FORMATS — an employer
     * identification number (`NN-NNNNNNN`) for the corporation and a social
     * security number (`NNN-NN-NNNN`) for the shareholder — so a
     * transposition is visible in the assertion itself. It is also the
     * distinction the printed captions draw: box A says *employer
     * identification number* and box E says only *identifying number*,
     * because a shareholder is usually a person.
     */
    theCorporationAndTheShareholderAreNotTransposed: () => {
        const [t, v] = validate(minimal)
        assert(t === 'ok', ['expected ok', t, v])
        if (t !== 'ok') {
            throw ['expected ok', t, v]
        }
        assertEq(
            v.corporationEIN,
            '44-4444444',
            'corporationEIN holds printed box A — the entity, in an EIN format',
        )
        assertEq(
            v.shareholderIdentifyingNumber,
            '222-22-2222',
            'shareholderIdentifyingNumber holds printed box E — the person, in an SSN format',
        )
        assert(
            v.corporationEIN !== v.shareholderIdentifyingNumber,
            ['a Schedule K-1 always has two distinct parties', v.corporationEIN, v.shareholderIdentifyingNumber],
        )
    },

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

    /** THE COMPARISON: the hand-typed printed table against all three code lists. */
    theHandTypedPrintedBoxTableAgreesWithTheCode: () => {
        assertEq(printedPartIIIBoxes.length, expectedPartIIIFieldCount)
        /** @type {readonly string[]} */
        const money = moneyBoxFields
        /** @type {readonly string[]} */
        const coded = codedBoxFields
        const checkboxes = [
            'box14ScheduleK3Attached',
            'box18MoreThanOneActivityForAtRiskPurposes',
            'box19MoreThanOneActivityForPassiveActivityPurposes',
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
            assert(field in declaredMembers(k1SCorporationSchema), ['the schema is missing a printed box', field])
        }
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

    /**
     * **The box numbering really does differ, proven box by box rather than
     * described.** Four printed box numbers carry DIFFERENT items on the two
     * faces, and this is the leaf that would redden if either dialect were
     * ever "harmonised" onto the other's numbering — which is the specific
     * thing DOC-24's "two dialects, not one" exists to prevent.
     *
     * It reads only THIS module's own field names, so it cannot be satisfied
     * by importing the other dialect and comparing it with itself.
     */
    theBoxNumberingDiffersFromThePartnershipForm: () => {
        /** @type {readonly string[]} */
        const money = moneyBoxFields
        /** @type {readonly string[]} */
        const coded = codedBoxFields
        // Box 4 is INTEREST here; on the 1065 face box 4a/4b/4c are
        // guaranteed payments and box 5 is interest.
        assert(money.includes('box4InterestIncome'), 'box 4 is interest on the 1120-S face')
        assert(!money.includes('box5InterestIncome'), 'box 5 is NOT interest on the 1120-S face')
        // Box 6 is ROYALTIES here; on the 1065 face box 6a/6b/6c are dividends
        // and box 7 is royalties.
        assert(money.includes('box6Royalties'), 'box 6 is royalties on the 1120-S face')
        assert(!money.includes('box7Royalties'), 'box 7 is NOT royalties on the 1120-S face')
        // Box 7 is the SHORT-TERM capital gain here; on the 1065 face that is
        // box 8.
        assert(money.includes('box7NetShortTermCapitalGain'), 'box 7 is the short-term gain on the 1120-S face')
        assert(!money.includes('box8NetShortTermCapitalGain'), 'box 8 is NOT the short-term gain on the 1120-S face')
        // Box 14 is a CHECKBOX here, not self-employment earnings — the
        // collision that would cost the most.
        assert(!coded.includes('box14SelfEmploymentEarnings'), 'box 14 is not a coded box on the 1120-S face')
        assert(
            declaredMembers(k1SCorporationSchema).box14ScheduleK3Attached !== undefined,
            'box 14 is the Schedule K-3 checkbox on the 1120-S face')
    },

    /**
     * **An S-corporation shareholder has no partner type, and this asserts the
     * ABSENCE.** Without it, adding a box G pair to this dialect "for
     * symmetry" would compile and pass everything else — and would invite the
     * self-employment tax an S-corporation share never owes.
     *
     * It asserts against the SCHEMA rather than against `validate`, and that
     * is a finding rather than a shortcut: rtti's struct validator IGNORES
     * properties a schema does not name, so a blob carrying
     * `boxGGeneralPartnerOrLlcMemberManager` alongside the right dialect tag
     * validates and stores the stray field untouched. Nothing reads it, so
     * nothing computes from it — but the absence this leaf pins is an absence
     * from the schema, which is where it is real, not from the stored blob.
     */
    thereIsNoPartnerTypeAndNoSelfEmploymentBox: () => {
        assert(!('boxGGeneralPartnerOrLlcMemberManager' in declaredMembers(k1SCorporationSchema)), 'no box G here')
        assert(!('boxGLimitedPartnerOrOtherLlcMember' in declaredMembers(k1SCorporationSchema)), 'no box G here')
        assert(!('box14SelfEmploymentEarnings' in declaredMembers(k1SCorporationSchema)), 'no self-employment box here')
        // ...and nothing here reads one even if a blob supplies it: the
        // engine's only self-employment reader for a K-1 is
        // `fjs/schedule/e`'s partnership arm, which this dialect never
        // reaches. `fjs/schedule/e`'s own
        // `anSCorporationShareholderOwesNoSelfEmploymentTax` prices that.
        assert(!('box14SelfEmploymentEarnings' in shareholderShare), 'the fixture carries no such box')
    },

    minimalValidates: () => {
        const [t] = validate(minimal)
        assertEq(t, 'ok')
    },

    shareholderShareValidates: () => {
        const [t, v] = validate(shareholderShare)
        assertEq(t, 'ok')
        assert(t === 'ok' && v.box1OrdinaryBusinessIncome === '80000.00', ['box 1 round-trips', v])
    },

    materialParticipation: {
        /**
         * There is no §469(h)(2) override here, so BOTH answers store — and
         * that difference from the partnership dialect is asserted rather than
         * left implicit.
         */
        bothDeterminationsStore: () => {
            for (const value of materialParticipationValues) {
                const [t, v] = validate({ ...minimal, materialParticipation: value })
                assertEq(t, 'ok', ['both §469 answers are open to a shareholder', value])
                assert(t === 'ok' && v.materialParticipation === value, [value, v])
            }
        },

        anUnrecognizedValueIsRefused: () => {
            const [t, v] = validate({ ...minimal, materialParticipation: 'partly' })
            assertEq(t, 'error')
            assert(typeof v === 'string' && v.includes('partly'), [v])
        },

        anAbsentAssertionStoresAndIsNotDefaulted: () => {
            const [t, v] = validate(minimalWithNoDetermination)
            assertEq(t, 'ok')
            assert(t === 'ok' && !('materialParticipation' in v), ['absent stays absent', v])
        },
    },

    codedBoxes: {
        severalCodedRowsAreStoredInOrder: () => {
            const [t, v] = validate({
                ...minimal,
                box17OtherInformation: [
                    { code: 'A', amount: '75.00' },
                    { code: 'V' },
                ],
            })
            assertEq(t, 'ok')
            assert(t === 'ok' && v.box17OtherInformation?.length === 2, [v])
            assert(t === 'ok' && v.box17OtherInformation?.[1]?.code === 'V', [v])
            // Box 17 code V is §199A information and routinely prints "STMT".
            assert(t === 'ok' && v.box17OtherInformation?.[1]?.amount === undefined, ['absent stays absent', v])
        },

        aRowWithoutACodeIsStructurallyRejected: () => {
            const [t] = validate({ ...minimal, box16ItemsAffectingShareholderBasis: [{ amount: '10.00' }] })
            assertEq(t, 'error')
        },
    },

    emptyFormRevisionRejected: () => {
        const [t, v] = validate({ ...minimal, formRevision: '' })
        assertEq(t, 'error')
        assert(typeof v === 'string' && v.includes('formRevision'), [v])
    },

    absentBoxesAreNotRefusals: () => {
        const [t, v] = validate(minimal)
        assertEq(t, 'ok')
        assert(t === 'ok' && !('box1OrdinaryBusinessIncome' in v), ['absent box must stay absent', v])
        assert(t === 'ok' && !('box17OtherInformation' in v), ['absent box must stay absent', v])
    },

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
     * DOC-00, in the direction that matters: a partnership K-1 must not be
     * readable as an S-corporation K-1. Its box 14 is an ARRAY of coded rows,
     * which this form's box 14 is a checkbox — so a shared reader would look
     * for self-employment earnings and find a tick.
     */
    crossDialect: {
        aPartnershipK1IsRejectedByTheSCorporationDialect: () => {
            const [t, v] = validate({
                dialect: 'vnd.fjs.k1_1065',
                partnershipEIN: '33-3333333',
                partnerTin: '222-22-2222',
                accountNumber: 'PTR-0001',
                taxYear: 2025,
                formRevision: '2025',
                boxGGeneralPartnerOrLlcMemberManager: true,
                box1OrdinaryBusinessIncome: '80000.00',
                box14SelfEmploymentEarnings: [{ code: 'A', amount: '80000.00' }],
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
