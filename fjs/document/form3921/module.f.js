/**
 * `vnd.fjs.form3921` — Form 3921, *Exercise of an Incentive Stock Option
 * Under Section 422(b)* (DOC-22).
 *
 * Source, fetched and read directly (2026-08-16), not from recall:
 * - `https://www.irs.gov/pub/irs-pdf/f3921.pdf` — **Rev. April 2025**, and the
 *   revision string on the face is `(Rev. April 2025)` rather than a bare
 *   year. Unlike the 1099 family this form is not reissued annually; the
 *   April 2025 revision is what a TY2025 exercise is reported on, and
 *   `formRevision` stores whatever the paper says (DOC-10) rather than a year
 *   this module assumes.
 * - The same PDF's own *Instructions for Employee*, which is where every box
 *   caption below is transcribed from.
 * - `https://www.irs.gov/pub/irs-pdf/i6251.pdf` (2025, `Jan 8, 2026`), "Line
 *   2i—Exercise of Incentive Stock Options", for what the boxes are FOR.
 *
 * ## This form is never filed with the return, and it is the only reason the
 * AMT can be computed at all
 *
 * The employee's copy is marked *"(keep for your records)"*. Nothing on a
 * Form 1040 asks for it. What it carries is the one fact §56(b)(3) needs and
 * no other document in this engine holds: **for the regular tax, exercising
 * an incentive stock option is not a taxable event; for the alternative
 * minimum tax it is.** The excess of the stock's fair market value at
 * exercise over what was paid for it is included in alternative minimum
 * taxable income in the year of exercise — income the employee has not
 * received, on stock they may not be able to sell, taxed at 26 or 28 percent.
 *
 * `i6251.pdf`'s own worked example is the arithmetic, and it is exactly three
 * boxes: *"multiply the amount in box 4, $25, by the 100 shares in box 5. The
 * result is $2,500, the FMV of all the shares. Then multiply the amount in
 * box 3, $10, by the 100 shares. ... Your adjustment is $1,500 ($2,500 −
 * $1,000). Enter it on Form 6251, line 2i."* `fjs/form6251` performs that
 * multiplication; this dialect only stores what it reads.
 *
 * ## `payerTin` is the TRANSFEROR and `recipientTin` is the EMPLOYEE
 *
 * The printed boxes are "TRANSFEROR'S TIN" and "EMPLOYEE'S TIN", and this
 * family's convention — stated at length in `fjs/document/1098t`'s own header
 * and inherited from `fjs/document/1098e`'s naming INVERSION — is that
 * `payerTin` holds the printed FILER's TIN and `recipientTin` holds the TIN of
 * the person the form is about. A `transferorTin`/`employeeTin` pair of its
 * own was rejected for the reason 1098-T records: `fjs/document/subject`'s
 * `formSubject` keys every stored document on
 * `(payerTin, recipientTin, accountNumber, taxYear, formType)`, and a dialect
 * whose identity fields are named something else has no subject at all.
 *
 * **The 1098-T hazard does NOT carry over, and that is worth stating rather
 * than leaving to be rediscovered.** On a 1098-T, `recipientTin` is the
 * STUDENT, who is frequently a dependent rather than the filer, and
 * `fjs/form8863` must match each form to a claimed student by that TIN or it
 * attributes one child's tuition to another. Here, `recipientTin` is the
 * EMPLOYEE, who on a joint return may be either spouse — and it does not
 * matter which, because a joint return computes ONE Form 6251 over ONE
 * alternative minimum taxable income and §56(b)(3) makes no per-spouse
 * distinction. So `fjs/form6251` sums every stored Form 3921's spread without
 * scoping by `recipientTin`, which is the opposite of what Form 8863 does with
 * this same field. {@link proof}.theEmployeeMayBeEitherSpouse is the leaf that
 * records the case.
 *
 * ## Box 6 is an identity, not an amount
 *
 * *"If other than TRANSFEROR, name, address, and TIN of corporation whose
 * stock is being transferred."* It is filled in only where the option was
 * granted over a parent or subsidiary's stock, and it changes nothing this
 * engine computes — the spread is the same whoever issued the shares. Stored
 * as two free-text fields (`box6CorporationName`, `box6CorporationTin`) so a
 * transcriber has somewhere to put what is printed, read by nothing.
 *
 * ## Boxes 1, 2 — dates, as free text, and what that costs
 *
 * `box1DateOptionGranted` and `box2DateOptionExercised` are `option(string)`
 * with no format check, following `vnd.fjs.1099b`'s own
 * `box1bDateAcquired`/`box1cDateSoldOrDisposed` precedent: this project has no
 * date primitive, and inventing one inside a dialect would be a second,
 * unshared parsing rule.
 *
 * **This is not free.** §422(a)(1)'s holding period — more than two years from
 * grant and more than one year from exercise — is what separates a qualifying
 * disposition from a disqualifying one, and it is date arithmetic over boxes 1
 * and 2 against a sale date on a Form 1099-B. This engine cannot do it, which
 * is why `fjs/form6251` REFUSES a return that stores a Form 3921 alongside any
 * Form 1099-B reporting a sale rather than guessing whether the shares sold
 * were these shares. See that module's own same-year-disposition refusal.
 *
 * ## Box 5 is a SHARE COUNT, not money
 *
 * `fjs/document/share_count`'s `shareCountError`, not `moneyFieldError`: a
 * count may be fractional past two places, may not be negative, and is
 * denominated in shares rather than cents. That module's own header states
 * all three differences and why each one changes an answer.
 *
 * ## Nothing here is refused for being unmodeled, and that is not an omission
 *
 * `fjs/document/1099g` and `fjs/document/1099nec` both carry an
 * `unmodeledMoneyBoxes` table that refuses a present, non-zero amount in a box
 * no computation reads. There is no such table here, because there is no such
 * box: this form prints exactly two money boxes and `fjs/form6251` reads BOTH.
 * The boxes that are not amounts — the two dates and box 6 — are identity and
 * timing fields, and a refusal on them would refuse every real Form 3921.
 *
 * @module
 */
import { number, option, string } from 'functionalscript/fjs/types/rtti/module.f.js'
import { validate as rttiValidate } from 'functionalscript/fjs/types/rtti/validate/module.f.js'
import { error, ok } from 'functionalscript/fjs/types/result/module.f.js'
import { assert, assertEq } from 'functionalscript/fjs/asserts/module.f.js'
import { isHash } from 'functionalscript/fjs/media/revision/module.f.js'
import { base, mediaTypeOf } from '../base/module.f.js'
import { formRevisionError } from '../form_revision/module.f.js'
import { moneyFieldError } from '../money_field/module.f.js'
import { shareCountError } from '../share_count/module.f.js'

/** @import { Result } from 'functionalscript/fjs/types/result/module.f.js' */
/** @import { Ts, Unknown } from 'functionalscript/fjs/types/rtti/ts/module.f.js' */
/** @import { ValidationError } from 'functionalscript/fjs/types/rtti/validate/module.f.js' */

/**
 * Format tag: names the dialect of this BLOB. The media type it is served
 * with is derived mechanically: `application/` + `dialect` + `+json`.
 */
export const dialect = 'vnd.fjs.form3921'
/** The media type derived from {@link dialect}: `application/vnd.fjs.form3921+json`. */
export const mediaType = mediaTypeOf(dialect)

/**
 * rtti schema for a `form3921` BLOB. `dialect` is spread first (via `base`) so
 * structural validation reports it as the first failing field on a mismatched
 * blob, matching every other document dialect in this tree.
 *
 * `sourceArtifactHash` is a required `string` (DOC-13), for the reason
 * `vnd.fjs.1099b`'s own header gives: every real document is extracted from
 * some artifact and there is no legacy stored instance of a brand-new dialect
 * to stay backward-compatible with.
 *
 * The printed form's VOID checkbox is not modeled — it is a filer-copy
 * artefact, the same precedent every existing dialect follows for "2nd TIN
 * not." — while CORRECTED is, under DOC-12's `option(true)` convention.
 */
export const formThirtyNineTwentyOneSchema = /** @type {const} */ ({
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
    box3ExercisePricePerShare: option(string),
    box4FairMarketValuePerShareOnExerciseDate: option(string),
    box5NumberOfSharesTransferred: option(string),
    box6CorporationName: option(string),
    box6CorporationTin: option(string),
    payerName: option(string),
    recipientName: option(string),
})

/** @typedef {Ts<typeof formThirtyNineTwentyOneSchema>} FormThirtyNineTwentyOne */

/** Structural-only validator: checks the shape, not the semantic refinements below. */
const validateShape = rttiValidate(formThirtyNineTwentyOneSchema)

/**
 * The money boxes, walked in one loop so the exactness re-parse is written
 * once. Typed via `@type {const}` so `r[field]` resolves to exactly
 * `string | undefined`.
 *
 * Exactly two, and both are PER-SHARE prices rather than totals — the printed
 * captions are "Exercise price per share" and "Fair market value per share on
 * exercise date". A transcriber who entered the TOTAL paid in box 3 would make
 * the Form 6251 line 2i spread wrong by a factor of the share count, and no
 * check here could tell: both are valid decimals. The field NAMES carry
 * `PerShare` for exactly that reason.
 */
const moneyBoxFields = /** @type {const} */ ([
    'box3ExercisePricePerShare',
    'box4FairMarketValuePerShareOnExerciseDate',
])

/**
 * Independently hand-typed: the number of money boxes {@link moneyBoxFields}
 * names today. Deliberately NOT `moneyBoxFields.length` — the generated
 * per-box leaves below iterate the list, which is the code under test, so a
 * box dropped from it would vanish from the loop in the same instant
 * (AGENTS.md's fourth shipped defect).
 * @type {number}
 */
const expectedMoneyBoxCount = 2

/**
 * The share-count boxes, the same idiom one column over. Exactly one today.
 */
const shareCountFields = /** @type {const} */ ([
    'box5NumberOfSharesTransferred',
])

/** Independently hand-typed, for the reason {@link expectedMoneyBoxCount} gives.
 * @type {number}
 */
const expectedShareCountFieldCount = 1

/**
 * Either a structural validation error or a semantic (string) error message.
 * @typedef {ValidationError | string} FormThirtyNineTwentyOneError
 */

/**
 * Checks the semantic refinements the structural schema cannot express on an
 * already shape-valid `form3921` value:
 * - `formRevision` (DOC-10) must not be empty or whitespace-only.
 * - `sourceArtifactHash` (DOC-13) must decode as a real cBase32 hash.
 * - Every PRESENT money box must be an exact decimal within safe magnitude.
 * - Every PRESENT share count must be an exact, NON-NEGATIVE decimal at the
 *   share scale.
 *
 * Absent boxes are skipped, never defaulted (DOC-11). **No cross-box
 * consistency check is performed, deliberately**: box 4 below box 3 is an
 * exercise at a loss, which is unusual but real (an option can be exercised
 * after the stock has fallen below the strike), and `fjs/form6251` floors the
 * resulting negative spread at zero the way §56(b)(3) does rather than this
 * dialect refusing to store a document the employer actually issued.
 * @type {(r: FormThirtyNineTwentyOne) => Result<FormThirtyNineTwentyOne, FormThirtyNineTwentyOneError>}
 */
export const checkReferences = r => {
    const formRevisionMessage = formRevisionError(r.formRevision)
    if (formRevisionMessage !== undefined) {
        return error(formRevisionMessage)
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
 * Validates an already-parsed JSON value as a `form3921` BLOB: structural
 * (rtti) validation followed by the semantic checks in
 * {@link checkReferences}.
 * @type {(value: Unknown) => Result<FormThirtyNineTwentyOne, FormThirtyNineTwentyOneError>}
 */
export const validate = value => {
    const [t, v] = validateShape(value)
    if (t === 'error') {
        return error(v)
    }
    return checkReferences(v)
}

// ── Tests ────────────────────────────────────────────────────────────────────

/**
 * The literal `sourceArtifactHash` every DOC-13 dialect's fixtures reuse — the
 * SAME literal `fjs/document/1099b` and `fjs/document/1099div` carry, so a
 * shared-provenance comparison across dialects is a plain `===` on identical
 * literals rather than a coincidence to explain.
 * @type {string}
 */
const sharedSourceArtifactHash = 'deadbeef00112233445566778899aabbccddeeff0011223344556677889900'

/** @type {FormThirtyNineTwentyOne} */
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
 * `i6251.pdf`'s own worked example, transcribed as a fixture: 100 shares, a
 * $10 strike, a $25 fair market value at exercise. The instructions' answer is
 * a $1,500 adjustment, and `fjs/form6251` is where that arithmetic is proven —
 * this dialect only has to round-trip the three boxes it comes out of.
 * @type {FormThirtyNineTwentyOne}
 */
const publishedExample = {
    ...minimal,
    box1DateOptionGranted: '01/03/2024',
    box2DateOptionExercised: '03/13/2025',
    box3ExercisePricePerShare: '10.00',
    box4FairMarketValuePerShareOnExerciseDate: '25.00',
    box5NumberOfSharesTransferred: '100',
}

/**
 * One generated leaf per money box: a comma-grouped amount in that box alone
 * must be refused. Mirrors `fjs/document/1099nec`'s own per-box coverage, so a
 * box quietly dropped from {@link moneyBoxFields} stops being exactness-checked
 * — which {@link expectedMoneyBoxCount} is the independent half of.
 */
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
        const [t, v] = validate({ ...minimal, [field]: '-100' })
        assertEq(t, 'error', `${field} must reject a negative share count`)
        assert(typeof v === 'string' && v.includes(field), [field, v])
        assert(typeof v === 'string' && v.includes('negative'), [field, v])
    },
]))

export const proof = {
    ...perMoneyBoxRejection,
    ...perShareCountRejection,

    dialectAndMediaType: () => {
        assertEq(dialect, 'vnd.fjs.form3921')
        assertEq(mediaType, 'application/vnd.fjs.form3921+json')
    },

    /**
     * Generated coverage cannot see a box REMOVED from either list — the loop
     * simply generates one fewer leaf and stays green. The hand-typed counts
     * are the independent side of that pair.
     */
    boxListsAreCovered: () => {
        assertEq(moneyBoxFields.length, expectedMoneyBoxCount)
        assertEq(shareCountFields.length, expectedShareCountFieldCount)
    },

    minimalValidates: () => {
        const [t] = validate(minimal)
        assertEq(t, 'ok')
    },

    /** The published example round-trips box for box, nothing coerced. */
    theInstructionsWorkedExampleRoundTrips: () => {
        const [t, v] = validate(publishedExample)
        assert(t === 'ok', ['expected ok', t, v])
        if (t !== 'ok') {
            throw ['expected ok', t, v]
        }
        assertEq(v.box1DateOptionGranted, '01/03/2024')
        assertEq(v.box2DateOptionExercised, '03/13/2025')
        assertEq(v.box3ExercisePricePerShare, '10.00')
        assertEq(v.box4FairMarketValuePerShareOnExerciseDate, '25.00')
        assertEq(v.box5NumberOfSharesTransferred, '100')
    },

    /**
     * A fractional share count validates — the reason box 5 goes through
     * `shareCountError` and not `moneyFieldError`. Six fractional digits is
     * the share scale's limit and is accepted; a seventh is not.
     */
    aFractionalShareCountValidates: () => {
        assertEq(
            validate({ ...minimal, box5NumberOfSharesTransferred: '12.3456789' })[0],
            'error',
            'seven fractional digits is one past the share scale')
        const [t, v] = validate({ ...minimal, box5NumberOfSharesTransferred: '12.345600' })
        assert(t === 'ok', ['six fractional digits is within the share scale', t, v])
    },

    /**
     * DOC-11: every box omitted is valid, and reads back ABSENT rather than as
     * a zero amount or a zero share count. The distinction is load-bearing for
     * this dialect specifically: a Form 3921 with box 5 absent has no share
     * count at all, which is categorically different from an exercise of zero
     * shares, and `fjs/form6251` refuses the first rather than computing a
     * $0.00 spread from it.
     */
    blankBoxesOmittedValidatesAndReadsBackAbsent: () => {
        const [t, v] = validate(minimal)
        assert(t === 'ok', ['expected ok', t, v])
        if (t !== 'ok') {
            throw ['expected ok', t, v]
        }
        assertEq(v.box3ExercisePricePerShare, undefined)
        assertEq(v.box4FairMarketValuePerShareOnExerciseDate, undefined)
        assertEq(v.box5NumberOfSharesTransferred, undefined)
        assertEq(v.corrected, undefined)
        assert(!('box5NumberOfSharesTransferred' in v), 'an absent count must stay absent, never 0')
    },

    /**
     * An exercise at a LOSS — box 4 below box 3 — is stored, not refused. See
     * {@link checkReferences}' own docstring: an option can be exercised after
     * the stock has fallen below the strike, and §56(b)(3)'s floor belongs in
     * `fjs/form6251` rather than in a dialect that would then refuse to store a
     * document the employer actually issued.
     */
    anExerciseBelowTheStrikePriceIsStoredNotRefused: () => {
        const [t, v] = validate({
            ...minimal,
            box3ExercisePricePerShare: '25.00',
            box4FairMarketValuePerShareOnExerciseDate: '10.00',
            box5NumberOfSharesTransferred: '100',
        })
        assert(t === 'ok', ['an underwater exercise must be storable', t, v])
    },

    /**
     * The identity question this dialect had to answer, recorded as a fixture
     * rather than only as prose (see this module's own docstring): the EMPLOYEE
     * may be either spouse on a joint return, and `recipientTin` therefore need
     * not be the filer's own. Unlike `vnd.fjs.1098t`, nothing downstream scopes
     * by this field — so this leaf pins that the dialect ACCEPTS a
     * non-filer TIN, and `fjs/form6251`'s own summation leaf pins that it does
     * not scope by it.
     */
    theEmployeeMayBeEitherSpouse: () => {
        const filersOwnTin = '222-22-2222'
        const [t, v] = validate({ ...minimal, recipientTin: '444-44-4444', box5NumberOfSharesTransferred: '10' })
        assert(t === 'ok', ['a spouse\'s Form 3921 must be storable', t, v])
        if (t !== 'ok') {
            throw ['expected ok', t, v]
        }
        assert(
            v.recipientTin !== filersOwnTin,
            ['this fixture is deliberately a spouse\'s form, not the filer\'s', v.recipientTin])
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
        whitespaceFormRevisionRejected: () => {
            assertEq(validate({ ...minimal, formRevision: '   ' })[0], 'error')
        },
        // DOC-13: a hash-shaped string containing '-' is not valid cBase32.
        sourceArtifactHashRejectedWhenNotAHash: () => {
            const [t, v] = validate({ ...minimal, sourceArtifactHash: 'not-a-hash' })
            assertEq(t, 'error', ['expected a non-cBase32 sourceArtifactHash to be refused', t, v])
        },
        // Omitting it entirely fails STRUCTURAL validation — a required
        // `string`, never `option` — so the error is a ValidationError naming
        // the field rather than a semantic string. The two failure modes are
        // distinguished here so "missing" cannot be confused with "malformed".
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
        // The two dates and box 6 are free text and are NOT exactness-checked
        // — a wildly non-numeric value in each still validates, proving each is
        // genuinely exempt rather than merely untested. `vnd.fjs.1099b`'s own
        // `nonMoneyFreeTextFieldsAcceptAnyStringWithoutExactnessCheck` is the
        // precedent, and "various" is the string a real broker prints.
        nonMoneyFreeTextFieldsAcceptAnyStringWithoutExactnessCheck: () => {
            const [t, v] = validate({
                ...minimal,
                box1DateOptionGranted: 'various (1,234.567 would fail the money check)',
                box2DateOptionExercised: 'see attached statement',
                box6CorporationName: 'Parent Holdings, Inc.',
                box6CorporationTin: '99-9999999',
            })
            assert(t === 'ok', ['expected ok — these fields are free text', t, v])
        },
    },

    /** A blob tagged as another dialect is rejected structurally, on `dialect`. */
    otherDialectRejected: () => {
        const [t, v] = validate({ ...minimal, dialect: 'vnd.fjs.form3922' })
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
}
