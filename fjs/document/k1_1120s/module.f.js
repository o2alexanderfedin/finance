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
 * Exactly ONE figure is consumed by a computation:
 *
 * - **Box 1, ordinary business income (loss)** → Schedule E Part II line 28
 *   column (g) or (j) → line 32 → line 41 → Schedule 1 line 5 → 1040 line 8.
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
export const dialect = 'vnd.fjs.k1_1120s'
/** The media type derived from {@link dialect}: `application/vnd.fjs.k1_1120s+json`. */
export const mediaType = mediaTypeOf(dialect)

/**
 * rtti schema for a `k1_1120s` BLOB — Part I (the corporation), Part II (the
 * shareholder) and Part III (the shareholder's share), transcribed from the
 * printed 2025 `f1120ssk.pdf` face in the form's own order.
 *
 * `payerTin` is the CORPORATION's employer identification number (printed box
 * A) and `recipientTin` the SHAREHOLDER's (printed box D) — the same two names
 * every information-return dialect in this tree uses.
 */
export const k1SCorporationSchema = /** @type {const} */ ({
    ...base(dialect),
    payerTin: string,
    recipientTin: string,
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
 * the amount would have gone.** Twelve of the thirteen fixed-caption money
 * boxes; box 1 is the one that computes.
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
    ['box2NetRentalRealEstateIncome', 'Schedule E Part I (lines 3-26), rental real estate — which this engine does not model; `rentalRealEstateAndRoyalties` is an `fjs/return/scope` refusal'],
    ['box3OtherNetRentalIncome', 'Schedule E Part II column (g) or (j) as a SECOND activity separate from box 1, with its own §469 grouping and its own basis limitation'],
    ['box4InterestIncome', '1040 line 2b (taxable interest), through §1366(a)(1)(A)'],
    ['box5aOrdinaryDividends', '1040 line 3b (ordinary dividends)'],
    ['box5bQualifiedDividends', '1040 line 3a (qualified dividends), and thence the Qualified Dividends and Capital Gain Tax Worksheet'],
    ['box6Royalties', 'Schedule E Part I line 4 (royalties received) — Part I, not Part II, which is why a royalty cannot ride into line 41 on this schedule’s S-corporation block'],
    ['box7NetShortTermCapitalGain', 'Schedule D line 5 (short-term gain or loss from partnerships, S corporations, estates and trusts)'],
    ['box8aNetLongTermCapitalGain', 'Schedule D line 12 (long-term gain or loss from partnerships, S corporations, estates and trusts)'],
    ['box8bCollectiblesTwentyEightPercentGain', 'the 28% Rate Gain Worksheet and Schedule D line 18'],
    ['box8cUnrecapturedSection1250Gain', 'the Unrecaptured Section 1250 Gain Worksheet and Schedule D line 19'],
    ['box9NetSection1231Gain', 'Form 4797 Part I, and thence Schedule 1 line 4 (other gains or losses) — `otherGainsOrLosses` is an `fjs/return/scope` refusal'],
    ['box11Section179Deduction', 'Schedule E Part II line 28 column (i), which the printed form takes from Form 4562 — the same asset basis history Schedule C line 13 already refuses for'],
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
    payerTin: '44-4444444',
    recipientTin: '222-22-2222',
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
    payerTin: '44-4444444',
    recipientTin: '222-22-2222',
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
/** Hand-typed: twelve of the thirteen refuse. `13 - 1` — box 1 computes. */
const expectedUnmodeledBoxCount = 12

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

    dialectAndMediaType: () => {
        assertEq(dialect, 'vnd.fjs.k1_1120s')
        assertEq(mediaType, 'application/vnd.fjs.k1_1120s+json')
    },

    boxListsAreCovered: () => {
        assertEq(moneyBoxFields.length, expectedMoneyBoxCount)
        assertEq(codedBoxFields.length, expectedCodedBoxCount)
        assertEq(unmodeledMoneyBoxes.length, expectedUnmodeledBoxCount)
        assertEq(
            expectedMoneyBoxCount - 1,
            expectedUnmodeledBoxCount,
            'exactly one fixed-caption money box — box 1 — is computed rather than refused',
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
            assert(field in k1SCorporationSchema, ['the schema is missing a printed box', field])
        }
        for (const field of [...money, ...coded]) {
            assert(
                printedPartIIIBoxes.some(([name]) => name === field),
                ['a modeled box is not on the printed form', field])
        }
        for (const [field] of unmodeledMoneyBoxes) {
            assert(money.includes(field), ['an unmodeled box is not a fixed-caption money box', field])
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
            k1SCorporationSchema.box14ScheduleK3Attached !== undefined,
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
        assert(!('boxGGeneralPartnerOrLlcMemberManager' in k1SCorporationSchema), 'no box G here')
        assert(!('boxGLimitedPartnerOrOtherLlcMember' in k1SCorporationSchema), 'no box G here')
        assert(!('box14SelfEmploymentEarnings' in k1SCorporationSchema), 'no self-employment box here')
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
                payerTin: '33-3333333',
                recipientTin: '222-22-2222',
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
