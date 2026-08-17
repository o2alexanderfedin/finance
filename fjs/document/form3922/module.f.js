/**
 * `vnd.fjs.form3922` — Form 3922, *Transfer of Stock Acquired Through an
 * Employee Stock Purchase Plan Under Section 423(c)* (DOC-23).
 *
 * Source, fetched and read directly (2026-08-16), not from recall:
 * `https://www.irs.gov/pub/irs-pdf/f3922.pdf` — **Rev. April 2025**, together
 * with the same PDF's own *Instructions for Employee*, from which every box
 * caption below is transcribed. Like its sibling `vnd.fjs.form3921`, this form
 * is not reissued annually and prints `(Rev. April 2025)` rather than a bare
 * year, so `formRevision` stores what the paper says (DOC-10).
 *
 * ## Eight boxes, and the reason there are eight
 *
 * The 3921 has five. This form has eight because an ESPP disposition needs
 * strictly more than an ISO exercise does, and REQUIREMENTS.md's DOC-23 names
 * the standard exactly: *"carrying what a qualifying vs disqualifying
 * disposition needs."* That is the sentence this dialect is measured against,
 * so here is the audit, box by box:
 *
 * - **Box 1, date option granted** and **box 2, date option exercised**:
 *   §423(a)(1)'s holding period is more than two years from GRANT and more
 *   than one year from EXERCISE. Both endpoints, both stored.
 * - **Box 3, FMV per share on grant date**: the §423(c) ordinary-income
 *   element on a QUALIFYING disposition is the LESSER of (a) the grant-date
 *   FMV less the option price, and (b) the actual gain. Box 3 is the first
 *   half of (a), and it exists on this form and on no other.
 * - **Box 4, FMV per share on exercise date**: the ordinary-income element on
 *   a DISQUALIFYING disposition is the exercise-date FMV less the price paid —
 *   a different rule from box 3's, reading a different box, which is precisely
 *   why both are printed.
 * - **Box 5, exercise price paid per share**: what the employee actually paid,
 *   the subtrahend in both rules above.
 * - **Box 6, number of shares transferred**: the multiplier.
 * - **Box 7, date legal title transferred**: the date the holding period is
 *   measured to when the plan holds the shares in street name.
 * - **Box 8, exercise price per share determined as if the option was
 *   exercised on the grant date**: filled in ONLY where the price was a
 *   percentage of the market price and therefore not determinable at grant —
 *   the "lookback" plan. Where box 8 is present it, not box 5, is the option
 *   price in the §423(c) qualifying-disposition rule, and an engine that read
 *   box 5 there would understate the ordinary-income element for every
 *   lookback plan. It is `option(string)` because the printed instruction says
 *   *"If the exercise price per share was fixed or determinable on the date
 *   shown in box 1, then box 8 will be blank"*, and DOC-11's absent-is-absent
 *   rule is what keeps "blank" distinguishable from "the same as box 5".
 *
 * ## What READS this dialect, and what does not — stated plainly
 *
 * **No line of any form in this engine is computed from a Form 3922 today.**
 * That is not an oversight; it is what the facts allow. Two independent things
 * are missing, and either one alone would be enough:
 *
 * 1. **The disposition itself.** Nothing here says the stock was sold. A Form
 *    3922 is issued in the year of TRANSFER, which is usually the purchase
 *    year and is frequently years before any sale. In a year with no sale
 *    there is nothing to report, and computing anything would invent income.
 * 2. **The date arithmetic, and the share matching.** Deciding qualifying
 *    versus disqualifying needs boxes 1, 2 and 7 compared against a sale date
 *    on a Form 1099-B — this project has no date primitive (see
 *    `vnd.fjs.1099b`'s own `box1bDateAcquired`) — and it needs to know that
 *    the shares sold WERE these shares, which no field on either form
 *    establishes.
 *
 * So the one reader this dialect has is a REFUSAL. `fjs/form8949` refuses a
 * return that stores a Form 3922 alongside any Form 1099-B reporting a sale,
 * naming both gaps above and the third that follows from them — that the
 * ordinary-income element may be absent from Form W-2 box 1 altogether, since
 * an employer is not required to withhold on it and many do not report it.
 *
 * **A stored document with no reader is a defect this project has already
 * shipped once** — `vnd.fjs.w2`'s `box13StatutoryEmployee`, found in Phase 27,
 * and the reason Phase 28 declined to store an SSTB flag. The refusal above is
 * what keeps this dialect on the right side of that line: a stored Form 3922
 * changes the engine's behaviour, and the direction it changes it in is
 * "stop", which is the only honest direction available.
 *
 * ## `payerTin` is the CORPORATION and `recipientTin` is the EMPLOYEE
 *
 * The printed boxes are "CORPORATION'S federal identification number" and
 * "EMPLOYEE'S identification number". The naming follows this family's
 * convention for the reason `fjs/document/form3921`'s own header states in
 * full: `fjs/document/subject`'s `formSubject` keys every stored document on
 * `(payerTin, recipientTin, accountNumber, taxYear, formType)`.
 *
 * @module
 */
import { number, option, string } from 'functionalscript/fjs/types/rtti/module.f.js'
import { validate as rttiValidate } from 'functionalscript/fjs/types/rtti/validate/module.f.js'
import { error, ok } from 'functionalscript/fjs/types/result/module.f.js'
import { assert, assertEq } from 'functionalscript/fjs/asserts/module.f.js'
import { isHash } from 'functionalscript/fjs/media/revision/module.f.js'
import { base, mediaTypeOf } from '../base/module.f.js'
import { moneyFieldError } from '../money_field/module.f.js'
import { shareCountError } from '../share_count/module.f.js'

/** @import { Result } from 'functionalscript/fjs/types/result/module.f.js' */
/** @import { Ts, Unknown } from 'functionalscript/fjs/types/rtti/ts/module.f.js' */
/** @import { ValidationError } from 'functionalscript/fjs/types/rtti/validate/module.f.js' */

/**
 * Format tag: names the dialect of this BLOB. The media type it is served
 * with is derived mechanically: `application/` + `dialect` + `+json`.
 */
export const dialect = 'vnd.fjs.form3922'
/** The media type derived from {@link dialect}: `application/vnd.fjs.form3922+json`. */
export const mediaType = mediaTypeOf(dialect)

/**
 * rtti schema for a `form3922` BLOB. `dialect` is spread first (via `base`) so
 * structural validation reports it as the first failing field on a mismatched
 * blob. `sourceArtifactHash` is a required `string` (DOC-13), for the reason
 * `vnd.fjs.1099b`'s own header gives.
 */
export const formThirtyNineTwentyTwoSchema = /** @type {const} */ ({
    ...base(dialect),
    payerTin: string,
    recipientTin: string,
    accountNumber: string,
    taxYear: number,
    formRevision: string,
    corrected: option(true),
    sourceArtifactHash: string,
    box1DateOptionGranted: option(string),
    box2DateOptionExercised: option(string),
    box3FairMarketValuePerShareOnGrantDate: option(string),
    box4FairMarketValuePerShareOnExerciseDate: option(string),
    box5ExercisePricePaidPerShare: option(string),
    box6NumberOfSharesTransferred: option(string),
    box7DateLegalTitleTransferred: option(string),
    box8ExercisePricePerShareAsIfExercisedOnGrantDate: option(string),
    payerName: option(string),
    recipientName: option(string),
})

/** @typedef {Ts<typeof formThirtyNineTwentyTwoSchema>} FormThirtyNineTwentyTwo */

/** Structural-only validator: checks the shape, not the semantic refinements below. */
const validateShape = rttiValidate(formThirtyNineTwentyTwoSchema)

/**
 * The money boxes, walked in one loop. All four are PER-SHARE prices, not
 * totals — the field names carry `PerShare` for the reason
 * `fjs/document/form3921`'s own list records: a transcriber who entered a
 * total would produce a valid decimal and a wrong answer.
 */
const moneyBoxFields = /** @type {const} */ ([
    'box3FairMarketValuePerShareOnGrantDate',
    'box4FairMarketValuePerShareOnExerciseDate',
    'box5ExercisePricePaidPerShare',
    'box8ExercisePricePerShareAsIfExercisedOnGrantDate',
])

/** Independently hand-typed, never `moneyBoxFields.length`.
 * @type {number}
 */
const expectedMoneyBoxCount = 4

/** The share-count boxes. Exactly one, and ESPP counts are routinely
 * fractional — see `fjs/document/share_count`'s own header. */
const shareCountFields = /** @type {const} */ ([
    'box6NumberOfSharesTransferred',
])

/** Independently hand-typed, never `shareCountFields.length`.
 * @type {number}
 */
const expectedShareCountFieldCount = 1

/**
 * Either a structural validation error or a semantic (string) error message.
 * @typedef {ValidationError | string} FormThirtyNineTwentyTwoError
 */

/**
 * Checks the semantic refinements the structural schema cannot express:
 * `formRevision` is non-empty (DOC-10), `sourceArtifactHash` decodes as a real
 * cBase32 hash (DOC-13), every PRESENT money box is an exact decimal within
 * safe magnitude, and every PRESENT share count is an exact, non-negative
 * decimal at the share scale. Absent boxes are skipped, never defaulted
 * (DOC-11) — most importantly box 8, whose absence means "the price WAS
 * determinable at grant" and is a different fact from box 8 equalling box 5.
 * @type {(r: FormThirtyNineTwentyTwo) => Result<FormThirtyNineTwentyTwo, FormThirtyNineTwentyTwoError>}
 */
export const checkReferences = r => {
    if (r.formRevision.trim() === '') {
        return error(`formRevision must not be empty or whitespace-only`)
    }
    if (!isHash(r.sourceArtifactHash)) {
        return error(`sourceArtifactHash is not a valid hash: ${r.sourceArtifactHash}`)
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
    for (const field of shareCountFields) {
        const printed = r[field]
        if (printed === undefined) {
            continue
        }
        const message = shareCountError(field)(printed)
        if (message !== undefined) {
            return error(message)
        }
    }
    return ok(r)
}

/**
 * Validates an already-parsed JSON value as a `form3922` BLOB: structural
 * (rtti) validation followed by the semantic checks in
 * {@link checkReferences}.
 * @type {(value: Unknown) => Result<FormThirtyNineTwentyTwo, FormThirtyNineTwentyTwoError>}
 */
export const validate = value => {
    const [t, v] = validateShape(value)
    if (t === 'error') {
        return error(v)
    }
    return checkReferences(v)
}

// ── Tests ────────────────────────────────────────────────────────────────────

/** The shared DOC-13 fixture hash every dialect in this tree reuses.
 * @type {string}
 */
const sharedSourceArtifactHash = 'deadbeef00112233445566778899aabbccddeeff0011223344556677889900'

/** @type {FormThirtyNineTwentyTwo} */
const minimal = {
    dialect,
    payerTin: '11-1111111',
    recipientTin: '222-22-2222',
    accountNumber: 'ACC-0001',
    taxYear: 2025,
    formRevision: 'April 2025',
    sourceArtifactHash: sharedSourceArtifactHash,
}

/**
 * The ordinary lookback ESPP a FAANG employee actually holds: a six-month
 * offering, a 15% discount off the LOWER of the grant-date and exercise-date
 * price, and a fractional share count because the plan buys a whole dollar
 * amount. Box 8 is present precisely because the price was not determinable at
 * grant.
 * @type {FormThirtyNineTwentyTwo}
 */
const lookbackPlanTransfer = {
    ...minimal,
    box1DateOptionGranted: '01/01/2025',
    box2DateOptionExercised: '06/30/2025',
    box3FairMarketValuePerShareOnGrantDate: '100.00',
    box4FairMarketValuePerShareOnExerciseDate: '150.00',
    box5ExercisePricePaidPerShare: '85.00',
    box6NumberOfSharesTransferred: '117.647058',
    box7DateLegalTitleTransferred: '06/30/2025',
    box8ExercisePricePerShareAsIfExercisedOnGrantDate: '85.00',
}

/** One generated leaf per money box: a comma-grouped amount must be refused. */
const perMoneyBoxRejection = Object.fromEntries(moneyBoxFields.map(field => [
    `${field}RejectsCommaGroupedAmount`,
    () => {
        const [t, v] = validate({ ...minimal, [field]: '1,234.56' })
        assertEq(t, 'error', `${field} must reject a comma-grouped amount`)
        assert(typeof v === 'string' && v.includes(field), [field, v])
    },
]))

/** One generated leaf per share-count box, the same idiom. */
const perShareCountRejection = Object.fromEntries(shareCountFields.map(field => [
    `${field}RejectsANegativeCount`,
    () => {
        const [t, v] = validate({ ...minimal, [field]: '-1' })
        assertEq(t, 'error', `${field} must reject a negative share count`)
        assert(typeof v === 'string' && v.includes(field), [field, v])
        assert(typeof v === 'string' && v.includes('negative'), [field, v])
    },
]))

export const proof = {
    ...perMoneyBoxRejection,
    ...perShareCountRejection,

    dialectAndMediaType: () => {
        assertEq(dialect, 'vnd.fjs.form3922')
        assertEq(mediaType, 'application/vnd.fjs.form3922+json')
    },

    boxListsAreCovered: () => {
        assertEq(moneyBoxFields.length, expectedMoneyBoxCount)
        assertEq(shareCountFields.length, expectedShareCountFieldCount)
    },

    minimalValidates: () => {
        assertEq(validate(minimal)[0], 'ok')
    },

    /**
     * DOC-23's own standard, as a checked claim: every box a qualifying-vs-
     * disqualifying determination needs is PRESENT on the stored document and
     * reads back verbatim. The list is hand-typed here — grant date, exercise
     * date, both fair market values, the price paid, the lookback price, the
     * share count and the title-transfer date — rather than derived from the
     * schema, so a box dropped from the dialect reddens this leaf rather than
     * quietly shrinking the thing it iterates.
     */
    everyBoxADispositionNeedsRoundTripsVerbatim: () => {
        const [t, v] = validate(lookbackPlanTransfer)
        assert(t === 'ok', ['expected ok', t, v])
        if (t !== 'ok') {
            throw ['expected ok', t, v]
        }
        // §423(a)(1)'s two holding-period endpoints.
        assertEq(v.box1DateOptionGranted, '01/01/2025')
        assertEq(v.box2DateOptionExercised, '06/30/2025')
        // The two fair market values the two dispositions read -- DIFFERENT
        // boxes for the qualifying and disqualifying rules.
        assertEq(v.box3FairMarketValuePerShareOnGrantDate, '100.00')
        assertEq(v.box4FairMarketValuePerShareOnExerciseDate, '150.00')
        // What was actually paid, and the lookback price that replaces it in
        // the §423(c) rule.
        assertEq(v.box5ExercisePricePaidPerShare, '85.00')
        assertEq(v.box8ExercisePricePerShareAsIfExercisedOnGrantDate, '85.00')
        // The multiplier -- fractional, as a real ESPP purchase is.
        assertEq(v.box6NumberOfSharesTransferred, '117.647058')
        assertEq(v.box7DateLegalTitleTransferred, '06/30/2025')
    },

    /**
     * Box 8 blank is a FACT, not a default. The printed instruction: "If the
     * exercise price per share was fixed or determinable on the date shown in
     * box 1, then box 8 will be blank." An engine that read an absent box 8 as
     * "equal to box 5" would apply the lookback rule to a fixed-price plan.
     * Both shapes are asserted in one leaf so the two cannot drift.
     */
    anAbsentBoxEightIsAbsentNotEqualToBoxFive: () => {
        const { box8ExercisePricePerShareAsIfExercisedOnGrantDate, ...fixedPricePlan } = lookbackPlanTransfer
        const [t, v] = validate(fixedPricePlan)
        assert(t === 'ok', ['a fixed-price plan prints no box 8', t, v])
        if (t !== 'ok') {
            throw ['expected ok', t, v]
        }
        assertEq(v.box8ExercisePricePerShareAsIfExercisedOnGrantDate, undefined)
        assert(
            !('box8ExercisePricePerShareAsIfExercisedOnGrantDate' in v),
            'an absent box 8 must stay absent, never defaulted to box 5')
        assertEq(v.box5ExercisePricePaidPerShare, '85.00', 'box 5 is still there and is a different fact')
    },

    /** DOC-11 across the board: every box omitted validates and reads absent. */
    blankBoxesOmittedValidatesAndReadsBackAbsent: () => {
        const [t, v] = validate(minimal)
        assert(t === 'ok', ['expected ok', t, v])
        if (t !== 'ok') {
            throw ['expected ok', t, v]
        }
        assertEq(v.box3FairMarketValuePerShareOnGrantDate, undefined)
        assertEq(v.box6NumberOfSharesTransferred, undefined)
        assertEq(v.corrected, undefined)
    },

    /** DOC-12's checkbox convention: `false` is structurally rejected. */
    correctedFalseIsStructurallyRejected: () => {
        assertEq(validate({ ...minimal, corrected: false })[0], 'error')
        assertEq(validate({ ...minimal, corrected: true })[0], 'ok')
    },

    checkReferences: {
        emptyFormRevisionRejected: () => {
            const [t, v] = validate({ ...minimal, formRevision: '' })
            assertEq(t, 'error')
            assert(typeof v === 'string' && v.includes('formRevision'), [v])
        },
        sourceArtifactHashRejectedWhenNotAHash: () => {
            assertEq(validate({ ...minimal, sourceArtifactHash: 'not-a-hash' })[0], 'error')
        },
        sourceArtifactHashRequired: () => {
            const { sourceArtifactHash, ...withoutHash } = minimal
            const [t, v] = validate(withoutHash)
            assertEq(t, 'error')
            if (t !== 'error') {
                throw ['expected error', t, v]
            }
            if (typeof v === 'string') {
                throw ['expected a structural ValidationError, not a semantic string', v]
            }
            assert(v.path.includes('sourceArtifactHash'), ['expected the field named', v])
        },
        // The three date fields are free text and are NOT exactness-checked.
        theThreeDateFieldsAcceptAnyStringWithoutExactnessCheck: () => {
            const [t, v] = validate({
                ...minimal,
                box1DateOptionGranted: 'various (1,234.567 would fail the money check)',
                box2DateOptionExercised: 'see attached statement',
                box7DateLegalTitleTransferred: 'held in street name',
            })
            assert(t === 'ok', ['expected ok — these fields are free text', t, v])
        },
    },

    /**
     * DOC-00, in the direction that matters most for this pair: a fully valid
     * `vnd.fjs.form3921` — the sibling dialect, and therefore the one whose
     * shape is most nearly compatible — fails THIS dialect's `validate`, and
     * the failure's path is exactly `['dialect']`. The two forms genuinely do
     * share `payerTin`/`recipientTin`/`taxYear`/`formRevision`/
     * `sourceArtifactHash` and both carry a `box1DateOptionGranted`, so
     * nothing but the discriminant separates them.
     */
    crossDialect: {
        formThirtyNineTwentyOneShapeRejected: () => {
            const [t, v] = validate({
                dialect: 'vnd.fjs.form3921',
                payerTin: '11-1111111',
                recipientTin: '222-22-2222',
                accountNumber: 'ACC-0001',
                taxYear: 2025,
                formRevision: 'April 2025',
                sourceArtifactHash: sharedSourceArtifactHash,
                box1DateOptionGranted: '01/03/2024',
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
