/**
 * `vnd.fjs.1098e` — Form 1098-E, *Student Loan Interest Statement*.
 *
 * ## Why this exists as its own dialect rather than as an `adjustments` entry
 *
 * DOC-19 gave Schedule 1 Part II a taxpayer-asserted record
 * (`vnd.fjs.adjustments`), whose header opens with the claim that justifies
 * every design decision in it: *no information return reports what a teacher
 * spent on classroom supplies or what a taxpayer paid into their own HSA.*
 * **That claim is simply false for student loan interest.** IRC §6050S
 * requires any person engaged in a trade or business who, in the course of
 * that business, receives $600 or more of interest on one or more qualified
 * education loans to file this form with the IRS and furnish a copy to the
 * borrower. The figure arrives in the mail. It is transcribed, not asserted.
 *
 * Three consequences make transcription the correct home for it, each of
 * which would have had to be argued away to put it in the asserted record:
 *
 * - **`formRevision` (DOC-10) is meaningful here and unstatable there.** Box
 *   2 changes what box 1 MEANS, which is precisely the box-semantics drift
 *   DOC-10 exists for. `vnd.fjs.adjustments` deliberately has no
 *   `formRevision` and should not grow one.
 * - **The cardinality differs.** `vnd.fjs.adjustments` has an empty
 *   `payerTin`, which under DOC-01's `formSubject` makes exactly ONE subject
 *   per taxpayer per year. A borrower whose loans were sold mid-year holds
 *   two 1098-Es from two servicers — two subjects, keyed by two payer TINs,
 *   the shape every transcribed dialect here already has.
 * - **The provenance would contradict itself.** One document cannot both be
 *   "supported by the taxpayer's own records" and be a copy of what a lender
 *   told the IRS.
 *
 * ## …and why the answer is nonetheless NOT "transcribed only"
 *
 * The interesting half of the decision is what a purely-transcribed answer
 * would have got wrong, and it is not small. **Not all deductible student
 * loan interest appears on a 1098-E.** §6050S's filing duty starts at $600
 * and reaches only persons in the trade or business of lending, so interest
 * below the threshold, and interest paid to a lender outside that duty, is
 * fully deductible and reported by nobody. A `line21 = sum of box 1` engine
 * would understate the deduction — silently, and in the same direction as
 * the hard zero this phase exists to remove.
 *
 * So Schedule 1 line 21 reads **both**: every stored `vnd.fjs.1098e` box 1,
 * and every `vnd.fjs.adjustments` entry tagged `studentLoanInterest`, each
 * citing its own document. The two are different in kind and the report says
 * which is which. That is not a compromise between the two designs — it is
 * the only arrangement in which each source's own provenance claim stays
 * true, and it is why the question "which dialect does student loan interest
 * belong to?" has the answer "both, for different halves of it."
 *
 * ## The naming inversion, which is a real trap
 *
 * **On the printed 1098-E, the "RECIPIENT" is the LENDER and the taxpayer is
 * the "BORROWER".** Every other dialect in this tree uses `recipientTin` for
 * the TAXPAYER, because on a 1099 or a W-2 the taxpayer is who received the
 * money. Keeping that convention here means `recipientTin` holds the printed
 * form's **BORROWER'S TIN**, and `payerTin` holds the printed form's
 * **RECIPIENT'S/LENDER'S TIN** — the opposite of what the box labels say.
 *
 * The alternative — following the printed labels — would have put the
 * taxpayer's own TIN in `payerTin` on exactly one dialect out of twelve, and
 * DOC-01's `formSubject` keys every subject on `(payerTin, recipientTin,
 * …)`; one inverted dialect would silently key a subject by the wrong party
 * and collapse every borrower's forms together. So the CONVENTION wins and
 * the inversion is written down here, where a transcriber will read it,
 * rather than left to be discovered. `theBorrowerIsTheRecipientTinNotThePayerTin`
 * pins it, because a transposition of these two fields is exactly the defect
 * AGENTS.md's own sweep found in a 1099-INT box mapping — silent, and
 * invisible to every proof that does not name the parties.
 *
 * ## Box 2 is stored, and REFUSED one layer out
 *
 * Box 2 reads *"Check if box 1 does not include loan origination fees and/or
 * capitalized interest for loans made before September 1, 2004."* A checked
 * box therefore says the stored figure is INCOMPLETE, and the missing part —
 * amortized origination fees and capitalized interest — appears on no form
 * and is computable from nothing this engine holds. Deducting box 1 alone
 * would understate the deduction; inventing the remainder would be worse.
 *
 * Unlike `fjs/document/1099g`, which refuses an unmodeled box at INGEST, this
 * dialect stores a checked box 2 and lets `fjs/schedule/1` refuse. The
 * difference is what the box is: 1099-G's box 2 is an AMOUNT this engine
 * would have to drop, and a document carrying one has no valid reading; a
 * checked 1098-E box 2 is a true and ordinary fact about a real form, and
 * refusing to record it would be judging rather than recording
 * (`vnd.fjs.medical_expenses`'s own words about an over-reimbursement).
 * The refusal happens where the deduction is computed, and names the box.
 *
 * @module
 */
import { number, option, string } from 'functionalscript/fjs/types/rtti/module.f.mjs'
import { validate as rttiValidate } from 'functionalscript/fjs/types/rtti/validate/module.f.mjs'
import { error, ok } from 'functionalscript/fjs/types/result/module.f.mjs'
import { assert, assertEq } from 'functionalscript/fjs/asserts/module.f.mjs'
import { base, mediaTypeOf } from '../base/module.f.js'
import { formRevisionError } from '../form_revision/module.f.js'
import { moneyFieldError } from '../money_field/module.f.js'
import { formSubject } from '../subject/module.f.js'

/** @import { Result } from 'functionalscript/fjs/types/result/types.js' */
/** @import { Ts, Unknown } from 'functionalscript/fjs/types/rtti/ts/types.js' */
/** @import { ValidationError } from 'functionalscript/fjs/types/rtti/common/types.js' */

/**
 * Format tag: names the dialect of this BLOB. The media type it is served
 * with is derived mechanically: `application/` + `dialect` + `+json`.
 */
export const dialect = 'vnd.fjs.1098e'
/** The media type derived from {@link dialect}: `application/vnd.fjs.1098e+json`. */
export const mediaType = mediaTypeOf(dialect)

/**
 * rtti schema for a `1098e` BLOB. `dialect` is spread first (via `base`) so
 * structural validation reports it as the first failing field on a mismatched
 * blob, matching every other document dialect in this tree.
 *
 * `payerTin` is the printed form's **RECIPIENT'S/LENDER'S TIN** and
 * `recipientTin` is its **BORROWER'S TIN** — see this module's own docstring,
 * "The naming inversion, which is a real trap".
 */
export const oneZeroNineEightESchema = /** @type {const} */ ({
    ...base(dialect),
    payerTin: string,
    recipientTin: string,
    accountNumber: string,
    taxYear: number,
    formRevision: string,
    corrected: option(true),
    box1StudentLoanInterestReceived: option(string),
    box2ExcludesOriginationFeesAndCapitalizedInterest: option(true),
    payerName: option(string),
    recipientName: option(string),
})

/** @typedef {Ts<typeof oneZeroNineEightESchema>} OneZeroNineEightE */

/** Structural-only validator: checks the shape, not the semantic refinements below. */
const validateShape = rttiValidate(oneZeroNineEightESchema)

/**
 * Every money box on this form. A one-entry list rather than a bare check,
 * so this dialect walks the same shape `fjs/document/1099g` and
 * `fjs/document/w2` do and a second box added later joins the loop instead of
 * needing a new one. Typed via `@type {const}` so `r[field]` resolves to
 * exactly `string | undefined`.
 *
 * `box2ExcludesOriginationFeesAndCapitalizedInterest` is deliberately absent:
 * it is a checkbox, not a dollar amount, and follows DOC-12's `option(true)`
 * convention instead.
 */
export const moneyBoxFields = /** @type {const} */ ([
    'box1StudentLoanInterestReceived',
])

/**
 * Either a structural validation error or a semantic (string) error message.
 * @typedef {ValidationError | string} OneZeroNineEightEError
 */

/**
 * Checks the semantic refinements the structural schema cannot express on an
 * already shape-valid `1098e` value:
 * - `formRevision` (DOC-10) must not be empty or whitespace-only.
 * - Every PRESENT money box must parse via `fjs/exact`'s `centsFromString`
 *   (DOC-11: absent boxes are skipped, never defaulted).
 *
 * There is deliberately no unmodeled-box refusal here, unlike
 * `fjs/document/1099g`: this form has exactly one money box and this engine
 * computes it. Box 2's refusal lives in `fjs/schedule/1`, where the deduction
 * is computed — see this module's own docstring for why storing it is right
 * and refusing it at ingest would not be.
 * @type {(r: OneZeroNineEightE) => Result<OneZeroNineEightE, OneZeroNineEightEError>}
 */
export const checkReferences = r => {
    const formRevisionMessage = formRevisionError(r.formRevision)
    if (formRevisionMessage !== undefined) {
        return error(formRevisionMessage)
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
    return ok(r)
}

/**
 * Validates an already-parsed JSON value as a `1098e` BLOB: structural (rtti)
 * validation followed by the semantic checks in {@link checkReferences}.
 * @type {(value: Unknown) => Result<OneZeroNineEightE, OneZeroNineEightEError>}
 */
export const validate = value => {
    const [t, v] = validateShape(value)
    if (t === 'error') {
        return error(v)
    }
    return checkReferences(v)
}

// ── Tests ────────────────────────────────────────────────────────────────────

/** @type {OneZeroNineEightE} */
const minimal = {
    dialect,
    payerTin: '11-1111111',
    recipientTin: '222-22-2222',
    accountNumber: 'LOAN-0001',
    taxYear: 2025,
    formRevision: '2025',
}

/** The shape a real servicer's form produces: one interest figure. */
/** @type {OneZeroNineEightE} */
const withInterest = {
    ...minimal,
    box1StudentLoanInterestReceived: '1842.63',
}

/** The number of money boxes, hand-typed so a REMOVAL from
 * {@link moneyBoxFields} is caught even though every generated leaf below
 * would happily generate one fewer.
 * @type {number} */
const expectedMoneyBoxCount = 1

/**
 * One generated leaf per money box: supplying a comma-grouped amount to that
 * box alone must be refused, naming the box. Mirrors `fjs/document/1099g`'s
 * own per-box coverage.
 */
const perMoneyBoxRejection = Object.fromEntries(moneyBoxFields.map(field => [
    `${field}RejectsCommaGroupedAmount`,
    () => {
        const [t, v] = validate({ ...minimal, [field]: '1,842.63' })
        assertEq(t, 'error', `${field} must reject a comma-grouped amount`)
        assert(typeof v === 'string' && v.includes(field), [field, v])
    },
]))

export const proof = {
    ...perMoneyBoxRejection,

    dialectAndMediaType: () => {
        assertEq(dialect, 'vnd.fjs.1098e')
        assertEq(mediaType, 'application/vnd.fjs.1098e+json')
    },

    boxListIsCovered: () => {
        assertEq(moneyBoxFields.length, expectedMoneyBoxCount)
        assertEq(moneyBoxFields[0], 'box1StudentLoanInterestReceived')
    },

    minimalValidates: () => {
        assertEq(validate(minimal)[0], 'ok')
    },

    withInterestRoundTrips: () => {
        const [t, v] = validate(withInterest)
        assert(t === 'ok', ['expected ok', t, v])
        assertEq(v.box1StudentLoanInterestReceived, '1842.63')
    },

    /**
     * **The naming inversion, asserted rather than described.** On the
     * printed form the taxpayer is the BORROWER and the lender is the
     * RECIPIENT; in this dialect the taxpayer is `recipientTin` and the
     * lender is `payerTin`, because DOC-01's `formSubject` keys every subject
     * on those two field NAMES and one inverted dialect would key a subject
     * by the wrong party.
     *
     * The fixture uses two visibly different TIN FORMATS — an employer
     * identification number (`NN-NNNNNNN`) for the lender and a social
     * security number (`NNN-NN-NNNN`) for the borrower — so a transposition
     * of the two fields is visible in the assertion itself rather than
     * requiring a reader to remember which arbitrary digits went where.
     */
    theBorrowerIsTheRecipientTinNotThePayerTin: () => {
        const [t, v] = validate(withInterest)
        assert(t === 'ok', ['expected ok', t, v])
        assertEq(
            v.recipientTin,
            '222-22-2222',
            'recipientTin holds the printed BORROWER\'S TIN — the taxpayer, in an SSN format',
        )
        assertEq(
            v.payerTin,
            '11-1111111',
            'payerTin holds the printed RECIPIENT\'S/LENDER\'S TIN — the servicer, in an EIN format',
        )
        assert(
            v.payerTin !== v.recipientTin,
            ['a 1098-E always has two distinct parties', v.payerTin, v.recipientTin],
        )
    },

    /**
     * **The cardinality argument, run through the real `formSubject` rather
     * than asserted in prose.** This module's header claims that a borrower
     * whose loans were sold mid-year holds two 1098-Es that are two SUBJECTS,
     * and that this is why the figure cannot live in a record whose empty
     * `payerTin` admits exactly one subject per taxpayer per year. That claim
     * is only true if DOC-01's key actually separates them, so it is checked
     * here against `fjs/document/subject`'s own function.
     *
     * The third case is the control: two forms from ONE servicer for ONE
     * borrower under ONE account are the SAME subject — which is what makes a
     * corrected form a revision rather than a second document, and what
     * distinguishes this leaf from one that would pass for any key at all.
     */
    twoServicersForOneBorrowerAreTwoSubjects: () => {
        /** @type {(r: OneZeroNineEightE) => string} */
        const subjectOf = r => formSubject({
            payerTin: r.payerTin,
            recipientTin: r.recipientTin,
            accountNumber: r.accountNumber,
            taxYear: r.taxYear,
            formType: r.dialect,
        })
        const firstServicer = subjectOf(withInterest)
        const secondServicer = subjectOf({
            ...withInterest,
            payerTin: '33-3333333',
            accountNumber: 'LOAN-0002',
            box1StudentLoanInterestReceived: '412.08',
        })
        assert(
            firstServicer !== secondServicer,
            ['two servicers must be two subjects', firstServicer, secondServicer],
        )
        // A second borrower at the SAME servicer is also a distinct subject —
        // the half a key that ignored `recipientTin` would get wrong.
        const otherBorrower = subjectOf({ ...withInterest, recipientTin: '444-44-4444' })
        assert(
            firstServicer !== otherBorrower,
            ['two borrowers must be two subjects', firstServicer, otherBorrower],
        )
        // The control: the same form, corrected, is the SAME subject.
        assertEq(
            subjectOf({ ...withInterest, corrected: true, box1StudentLoanInterestReceived: '1900.00' }),
            firstServicer,
            'a corrected form is a revision of one subject, never a second subject',
        )
    },

    emptyFormRevisionRejected: () => {
        const [t, v] = validate({ ...minimal, formRevision: '' })
        assertEq(t, 'error')
        assert(typeof v === 'string' && v.includes('formRevision'), [v])
    },

    whitespaceFormRevisionRejected: () => {
        const [t, v] = validate({ ...minimal, formRevision: '   ' })
        assertEq(t, 'error')
        assert(typeof v === 'string' && v.includes('formRevision'), [v])
    },

    box2: {
        /**
         * A checked box 2 is STORED, not refused at ingest — it is a true and
         * ordinary fact about a real form, and the deduction refusal it
         * causes belongs where the deduction is computed. See this module's
         * own docstring, "Box 2 is stored, and REFUSED one layer out";
         * `fjs/schedule/1`'s own proof is the other half of this pair.
         */
        aCheckedBoxTwoIsStorableNotRefusedHere: () => {
            const [t, v] = validate({
                ...withInterest,
                box2ExcludesOriginationFeesAndCapitalizedInterest: true,
            })
            assert(t === 'ok', ['a checked box 2 must be storable', t, v])
            assertEq(v.box2ExcludesOriginationFeesAndCapitalizedInterest, true)
        },
        /** DOC-12's checkbox convention: `false` is structurally rejected. */
        falseIsStructurallyRejected: () => {
            assertEq(validate({
                ...minimal,
                box2ExcludesOriginationFeesAndCapitalizedInterest: false,
            })[0], 'error')
        },
        /**
         * DOC-11: an absent box 2 is ABSENT, and absent is what says box 1 is
         * the complete figure. It must not read as `false` by accident, since
         * the whole difference between a computable and an uncomputable line
         * 21 rides on it.
         */
        absentIsNotFalse: () => {
            const [t, v] = validate(withInterest)
            assert(t === 'ok', ['expected ok', t, v])
            assertEq(v.box2ExcludesOriginationFeesAndCapitalizedInterest, undefined)
            assert(
                !('box2ExcludesOriginationFeesAndCapitalizedInterest' in v),
                ['an absent checkbox must stay absent, never materialize as false', v],
            )
        },
    },

    /**
     * DOC-11: an absent box 1 is not a refusal and not a zero. A servicer
     * that furnishes a corrected form with no interest figure is ordinary.
     */
    absentBoxOneIsNotARefusal: () => {
        const [t, v] = validate(minimal)
        assert(t === 'ok', ['expected ok', t, v])
        assert(!('box1StudentLoanInterestReceived' in v), ['absent box must stay absent', v])
    },

    /** A blob tagged as another dialect is rejected structurally, on `dialect`. */
    crossDialect: {
        oneZeroNineNineGShapeRejectedByOneZeroNineEightE: () => {
            const [t, v] = validate({ ...minimal, dialect: 'vnd.fjs.1099g' })
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
}
