/**
 * `vnd.fjs.1098t` — Form 1098-T, *Tuition Statement*.
 *
 * ## The 1098-E question, asked again about a different form, and answered
 * the same way — but the reasoning is NOT a copy
 *
 * Phase 24 asked whether student loan interest belonged in the
 * taxpayer-asserted record or in a transcribed dialect of its own, and
 * answered "both, for different halves of it": §6050S makes a lender file a
 * 1098-E, so the figure is transcribed; §6050S's duty starts at $600 and
 * reaches only persons in the trade or business of lending, so the part
 * nobody reports is asserted. `fjs/document/1098e`'s header records that
 * decision in full and this dialect's existence follows it.
 *
 * **What does not carry over is the size of the gap.** For a 1098-E the
 * unreported part is an edge case: a small balance, or a private lender. For
 * a 1098-T the unreported part is ordinary, and there are FOUR distinct
 * reasons for it, each of which would silently understate a credit in an
 * engine that read box 1 alone:
 *
 * 1. **Box 1 is what the INSTITUTION received, not what the taxpayer SPENT
 *    on qualified expenses.** Its printed caption is *"Payments received for
 *    qualified tuition and related expenses"*. The American Opportunity
 *    Credit's own expense definition (§25A(f)(1)(D)) reaches *"course
 *    materials"* — books, supplies and equipment **required for enrolment** —
 *    **whether or not they are bought from the institution**. A student who
 *    spends $700 on required textbooks at a bookshop has $700 of qualified
 *    expenses that no 1098-T will ever carry.
 * 2. **The two credits do not even share that definition.** The Lifetime
 *    Learning Credit reaches course materials ONLY if they are paid to the
 *    institution as a condition of enrolment. So the same $700 of textbooks
 *    is a qualified expense for one credit and not the other — a distinction
 *    box 1 could not express even if it carried the figure, and the reason
 *    `vnd.fjs.credits` records course materials as their own field rather
 *    than folding them into one expense total.
 * 3. **Not every institution files.** §6050S's reporting duty has exceptions
 *    — among them courses for which no academic credit is offered and
 *    nonresident alien students — and a taxpayer who receives no 1098-T may
 *    still have paid qualified tuition.
 * 4. **Box 5 REDUCES the base.** Scholarships and grants are subtracted from
 *    qualified expenses (§25A(g)(2)), so a 1098-T is not even monotone in the
 *    direction of the credit: reading box 1 and ignoring box 5 OVERSTATES.
 *
 * So a transcribe-only design understates in three ways and overstates in a
 * fourth, and an assert-only design throws away a real information return
 * that is the best available evidence of what an institution was paid. The
 * arrangement that keeps every source's own provenance claim true is the same
 * one Schedule 1 line 21 already uses: `fjs/form8863` reads **both**, and the
 * report says which figure came from which.
 *
 * ## `studentTin` is the STUDENT, and the student is NOT necessarily the
 * taxpayer — a sharper trap than the 1098-E's
 *
 * `fjs/document/1098e` records a naming INVERSION: the printed form calls the
 * lender the "RECIPIENT" and the taxpayer the "BORROWER". This form has the
 * same shape — the printed FILER is the institution and the printed STUDENT
 * is the person whose expenses are at issue — but it carries an extra hazard
 * the 1098-E does not:
 *
 * **On every other dialect in this tree the recipient IS the taxpayer. Here
 * it may be a dependent.** §25A(f)(1)(A) allows the credit for expenses of
 * the taxpayer, the taxpayer's spouse, OR a dependent, and a parent claiming
 * a credit for a child's tuition holds a 1098-T whose student is the child.
 * Any code that read this field as the filer's would attribute a parent's
 * credit to nobody and a child's to a return that is not being filed.
 * `fjs/form8863` therefore matches a 1098-T to a `vnd.fjs.credits` student
 * entry BY `studentTin` — the SAME name that dialect already gives its own
 * field, which is how the match reads as a match — and never assumes the
 * taxpayer. `theStudentIsTheStudentTinAndNeedNotBeTheFiler` pins it.
 *
 * A `studentTin` of its own was rejected once, for `fjs/document/1098e`'s
 * reason: DOC-01's `formSubject` keyed every subject on the five shared field
 * NAMES `(payerTin, recipientTin, accountNumber, taxYear, formType)`, so one
 * dialect that spelled its parties differently would key a subject by the
 * wrong party. **FORM-KEY-01 removed that premise** — a dialect declares
 * which of its OWN fields play the five roles ({@link subjectKey}) — so the
 * three identity fields now read off the paper:
 *
 * - `filerEin` — printed **"FILER'S employer identification no."**, and note
 *   that the box does NOT say "FILER'S TIN": an educational institution or
 *   insurer files with an EIN, exactly the pattern `vnd.fjs.w2` box b already
 *   has. It plays the PAYER role, because the filer is who issued the form.
 * - `studentTin` — printed **"STUDENT'S TIN"**, above "STUDENT'S name". It
 *   plays the RECIPIENT role, and the hazard above is precisely that this
 *   role is not the taxpayer here.
 * - `serviceProviderAccountNumber` — printed **"Service Provider/Acct. No.
 *   (see instr.)"**, bottom left. It plays the ACCOUNT role.
 *
 * **The subject a stored 1098-T derives is byte-identical to the one it
 * derived under the old names**: the declaration moved, the values did not.
 *
 * Source read directly rather than recalled:
 * `https://www.irs.gov/pub/irs-pdf/f1098t.pdf` — "Form 1098-T Created
 * 10/8/25", the 2026 revision, Copy A. Its left column reads "FILER'S name",
 * then "FILER'S employer identification no." beside "STUDENT'S TIN", then
 * "STUDENT'S name".
 *
 * ## Boxes 4 and 6 are STORED, and REFUSED one layer out
 *
 * Box 4 is *"Adjustments made for a prior year"* and box 6 is *"Adjustments
 * to scholarships or grants for a prior year"*. Either one non-zero means a
 * figure this engine already used on a DIFFERENT year's return has changed,
 * which triggers §25A(g)(4)'s recapture — an amount that lands on 1040 line
 * 16, where `educationCreditRecapture` is already a refused
 * `fjs/return/scope` kind in its own right.
 *
 * Unlike `fjs/document/1099g`, which refuses an unmodeled box at INGEST, this
 * dialect stores both and lets `fjs/form8863` refuse — the identical position
 * `fjs/document/1098e` takes about its own box 2, and for the identical
 * reason: a prior-year adjustment is a true and ordinary fact about a real
 * form, and refusing to record it would be judging rather than recording.
 * Box 10 (*"Ins. contract reimb./refund"*) is stored and refused on the same
 * terms.
 *
 * ## Box 7 is stored and is NOT a refusal, which is worth saying explicitly
 *
 * Box 7 says box 1 includes amounts for an academic period beginning in
 * January through March of the FOLLOWING year. A reader who has just read the
 * boxes 4/6/10 paragraph will expect a refusal here too, and there is none:
 * §25A(g)(4) expressly allows a prepayment for an academic period beginning
 * in the first three months of the next year to be treated as paid in the
 * year of payment. The box is informational — it explains a figure rather
 * than qualifying it — and storing it without acting on it is the correct
 * treatment, not an omission.
 *
 * @module
 */
import { number, open, option, string } from 'functionalscript/fjs/types/rtti/module.f.mjs'
import { validate as rttiValidate } from 'functionalscript/fjs/types/rtti/validate/module.f.mjs'
import { error, ok } from 'functionalscript/fjs/types/result/module.f.mjs'
import { assert, assertEq } from 'functionalscript/fjs/asserts/module.f.mjs'
import { base, mediaTypeOf } from '../base/module.f.js'
import { formRevisionError } from '../form_revision/module.f.js'
import { moneyFieldError } from '../money_field/module.f.js'
import { declaredSubject } from '../subject/module.f.js'
import { declaredMembers } from '../../document/base/module.f.js'

/** @import { Result } from 'functionalscript/fjs/types/result/types.js' */
/** @import { Ts, Unknown } from 'functionalscript/fjs/types/rtti/ts/types.js' */
/** @import { ValidationError } from 'functionalscript/fjs/types/rtti/common/types.js' */
/** @import { SubjectKey } from '../subject/module.f.js' */

/**
 * Format tag: names the dialect of this BLOB. The media type it is served
 * with is derived mechanically: `application/` + `dialect` + `+json`.
 */
export const dialect = 'vnd.fjs.1098t'
/** The media type derived from {@link dialect}: `application/vnd.fjs.1098t+json`. */
export const mediaType = mediaTypeOf(dialect)

/**
 * rtti schema for a `1098t` BLOB. `dialect` is spread first (via `base`) so
 * structural validation reports it as the first failing field on a mismatched
 * blob, matching every other document dialect in this tree.
 *
 * `filerEin` is the printed form's **FILER'S employer identification no.**
 * (the educational institution or insurer — the printed box says EIN, not
 * TIN) and `studentTin` is its **STUDENT'S TIN**, which may be a dependent's
 * rather than the taxpayer's — see this module's own docstring, "`studentTin`
 * is the STUDENT". `serviceProviderAccountNumber` is the bottom-left
 * "Service Provider/Acct. No. (see instr.)".
 *
 * **Boxes 2 and 3 have no field.** The printed 2025 form reserves both for
 * future use with no box to fill, exactly as Schedule 1's line 22 is
 * reserved; a field for either would be a place to put data the form cannot
 * carry.
 */
export const oneZeroNineEightTSchema = open({
    ...base(dialect),
    filerEin: string,
    studentTin: string,
    serviceProviderAccountNumber: string,
    taxYear: number,
    formRevision: string,
    corrected: option(true),
    box1PaymentsReceivedForQualifiedTuition: option(string),
    box4AdjustmentsForAPriorYear: option(string),
    box5ScholarshipsOrGrants: option(string),
    box6AdjustmentsToScholarshipsForAPriorYear: option(string),
    box7IncludesAmountsForAnAcademicPeriodBeginningInTheFollowingYear: option(true),
    box8AtLeastHalfTimeStudent: option(true),
    box9GraduateStudent: option(true),
    box10InsuranceContractReimbursementOrRefund: option(string),
    payerName: option(string),
    recipientName: option(string),
})

/**
 * FORM-KEY-01 -- which of THIS dialect's OWN fields play the five roles a
 * form subject is keyed on. See `fjs/document/subject`'s {@link SubjectKey}
 * for why the dialect declares this instead of every caller assuming one
 * shared set of field names.
 * @type {SubjectKey}
 */
export const subjectKey = { formType: 'dialect', taxYear: 'taxYear', payer: 'filerEin', recipient: 'studentTin', account: 'serviceProviderAccountNumber' }

/** @typedef {Ts<typeof oneZeroNineEightTSchema>} OneZeroNineEightT */

/** Structural-only validator: checks the shape, not the semantic refinements below. */
const validateShape = rttiValidate(oneZeroNineEightTSchema)

/**
 * Every money box on this form, walked in a loop so the exactness check is
 * written once — the same shape `fjs/document/1098e` and `fjs/document/w2`
 * use. Typed via `@type {const}` so `r[field]` resolves to exactly
 * `string | undefined`.
 *
 * The three checkbox fields are deliberately absent: they are checkboxes, not
 * dollar amounts, and follow DOC-12's `option(true)` convention instead.
 */
export const moneyBoxFields = /** @type {const} */ ([
    'box1PaymentsReceivedForQualifiedTuition',
    'box4AdjustmentsForAPriorYear',
    'box5ScholarshipsOrGrants',
    'box6AdjustmentsToScholarshipsForAPriorYear',
    'box10InsuranceContractReimbursementOrRefund',
])

/**
 * Either a structural validation error or a semantic (string) error message.
 * @typedef {ValidationError | string} OneZeroNineEightTError
 */

/**
 * Checks the semantic refinements the structural schema cannot express on an
 * already shape-valid `1098t` value:
 * - `formRevision` (DOC-10) must not be empty or whitespace-only.
 * - Every PRESENT money box must parse via `fjs/exact`'s `centsFromString`
 *   (DOC-11: absent boxes are skipped, never defaulted).
 *
 * There is deliberately no unmodeled-box refusal here, unlike
 * `fjs/document/1099g`: every box this form prints has a field above, and the
 * three whose PRESENCE makes a credit uncomputable (4, 6 and 10) are refused
 * where the credit is computed — see this module's own docstring.
 * @type {(r: OneZeroNineEightT) => Result<OneZeroNineEightT, OneZeroNineEightTError>}
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
 * Validates an already-parsed JSON value as a `1098t` BLOB: structural (rtti)
 * validation followed by the semantic checks in {@link checkReferences}.
 * @type {(value: Unknown) => Result<OneZeroNineEightT, OneZeroNineEightTError>}
 */
export const validate = value => {
    const [t, v] = validateShape(value)
    if (t === 'error') {
        return error(v)
    }
    return checkReferences(v)
}

// ── Tests ────────────────────────────────────────────────────────────────────

/** @type {OneZeroNineEightT} */
const minimal = {
    dialect,
    filerEin: '11-1111111',
    studentTin: '333-33-3333',
    serviceProviderAccountNumber: 'STU-0001',
    taxYear: 2025,
    formRevision: '2025',
}

/** The shape a real institution's form produces: tuition and a scholarship. */
/** @type {OneZeroNineEightT} */
const withTuition = {
    ...minimal,
    box1PaymentsReceivedForQualifiedTuition: '9250.00',
    box5ScholarshipsOrGrants: '2000.00',
    box8AtLeastHalfTimeStudent: true,
}

/** The number of money boxes, hand-typed so a REMOVAL from
 * {@link moneyBoxFields} is caught even though every generated leaf below
 * would happily generate one fewer (AGENTS.md's hand-typed-count idiom).
 * @type {number} */
const expectedMoneyBoxCount = 5

/**
 * One generated leaf per money box: supplying a comma-grouped amount to that
 * box alone must be refused, naming the box. Mirrors `fjs/document/1098e`'s
 * own per-box coverage.
 */
const perMoneyBoxRejection = Object.fromEntries(moneyBoxFields.map(field => [
    `${field}RejectsCommaGroupedAmount`,
    () => {
        const [t, v] = validate({ ...minimal, [field]: '1,234.56' })
        assertEq(t, 'error', `${field} must reject a comma-grouped amount`)
        assert(typeof v === 'string' && v.includes(field), [field, v])
    },
]))

export const proof = {
    ...perMoneyBoxRejection,

    dialectAndMediaType: () => {
        assertEq(dialect, 'vnd.fjs.1098t')
        assertEq(mediaType, 'application/vnd.fjs.1098t+json')
    },

    // The five money boxes, NAMED in printed order rather than merely
    // counted: a count alone would survive box 4 being renamed to box 6's
    // field, which is exactly the transposition AGENTS.md's own sweep found
    // in a 1099-INT box mapping.
    boxListIsCoveredAndInPrintedOrder: () => {
        assertEq(moneyBoxFields.length, expectedMoneyBoxCount)
        assertEq(moneyBoxFields[0], 'box1PaymentsReceivedForQualifiedTuition')
        assertEq(moneyBoxFields[1], 'box4AdjustmentsForAPriorYear')
        assertEq(moneyBoxFields[2], 'box5ScholarshipsOrGrants')
        assertEq(moneyBoxFields[3], 'box6AdjustmentsToScholarshipsForAPriorYear')
        assertEq(moneyBoxFields[4], 'box10InsuranceContractReimbursementOrRefund')
    },

    minimalValidates: () => {
        assertEq(validate(minimal)[0], 'ok')
    },

    withTuitionRoundTrips: () => {
        const [t, v] = validate(withTuition)
        assert(t === 'ok', ['expected ok', t, v])
        assertEq(v.box1PaymentsReceivedForQualifiedTuition, '9250.00')
        assertEq(v.box5ScholarshipsOrGrants, '2000.00')
        assertEq(v.box8AtLeastHalfTimeStudent, true)
    },

    /**
     * **The student is `studentTin`, and this fixture makes the point that
     * the student need not be the filer.** The two identifiers use visibly
     * different formats — an employer identification number (`NN-NNNNNNN`)
     * for the institution and a social security number (`NNN-NN-NNNN`) for
     * the student — so a transposition is visible in the assertion itself.
     *
     * The third assertion is the one this dialect exists to make: a parent
     * filing a return whose own TIN is `222-22-2222` holds a 1098-T whose
     * `studentTin` is the CHILD'S. On every other dialect in this tree the
     * recipient role and the filer would be the same string.
     */
    theStudentIsTheStudentTinAndNeedNotBeTheFiler: () => {
        const [t, v] = validate(withTuition)
        assert(t === 'ok', ['expected ok', t, v])
        assertEq(
            v.studentTin,
            '333-33-3333',
            'studentTin holds the printed STUDENT\'S TIN, in an SSN format',
        )
        assertEq(
            v.filerEin,
            '11-1111111',
            'filerEin holds the printed FILER\'S employer identification no. — the institution, in an EIN format',
        )
        const filersOwnTin = '222-22-2222'
        assert(
            v.studentTin !== filersOwnTin,
            [
                'a 1098-T\'s student may be a dependent rather than the person filing the return',
                v.studentTin,
            ],
        )
    },

    /**
     * **The cardinality argument, run through the real derivation.** A
     * student who attends two institutions in one year holds two 1098-Ts,
     * and a household with two students in college holds two more. Both
     * must be distinct subjects, or one would silently overwrite the other
     * and a credit would be computed on half the expenses.
     *
     * It runs through `declaredSubject(subjectKey)` — THIS dialect's own
     * declaration — rather than through `formSubject`'s five field names.
     * Under the old names the two were the same call; they are not any more,
     * and the declaration is the one a stored document is actually keyed by.
     *
     * The fourth case is the control: the same form, corrected, is the SAME
     * subject — which is what makes a corrected 1098-T a revision rather than
     * a second document, and what distinguishes this leaf from one that would
     * pass for any key at all.
     */
    twoInstitutionsAndTwoStudentsAreFourSubjects: () => {
        /** @type {(r: OneZeroNineEightT) => string} */
        const subjectOf = r => declaredSubject(subjectKey)(r)
        const first = subjectOf(withTuition)
        const secondInstitution = subjectOf({
            ...withTuition,
            filerEin: '44-4444444',
            serviceProviderAccountNumber: 'STU-0002',
        })
        assert(
            first !== secondInstitution,
            ['two institutions must be two subjects', first, secondInstitution],
        )
        const secondStudent = subjectOf({ ...withTuition, studentTin: '555-55-5555' })
        assert(
            first !== secondStudent,
            ['two students must be two subjects', first, secondStudent],
        )
        assert(
            secondInstitution !== secondStudent,
            ['the two distinct cases must also differ from each other', secondInstitution, secondStudent],
        )
        assertEq(
            subjectOf({ ...withTuition, corrected: true, box1PaymentsReceivedForQualifiedTuition: '9500.00' }),
            first,
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

    checkboxes: {
        /**
         * All three checkboxes are STORABLE here and none is refused at
         * ingest — see this module's own docstring. `fjs/form8863` is the
         * other half of this pair for boxes 4/6/10; boxes 7, 8 and 9 are
         * never refused anywhere.
         */
        allThreeCheckboxesAreStorable: () => {
            const [t, v] = validate({
                ...withTuition,
                box7IncludesAmountsForAnAcademicPeriodBeginningInTheFollowingYear: true,
                box8AtLeastHalfTimeStudent: true,
                box9GraduateStudent: true,
            })
            assert(t === 'ok', ['every checkbox must be storable', t, v])
            assertEq(v.box7IncludesAmountsForAnAcademicPeriodBeginningInTheFollowingYear, true)
            assertEq(v.box8AtLeastHalfTimeStudent, true)
            assertEq(v.box9GraduateStudent, true)
        },
        /** DOC-12's checkbox convention: `false` is structurally rejected. */
        falseIsStructurallyRejected: () => {
            assertEq(validate({ ...minimal, box7IncludesAmountsForAnAcademicPeriodBeginningInTheFollowingYear: false })[0], 'error')
            assertEq(validate({ ...minimal, box8AtLeastHalfTimeStudent: false })[0], 'error')
            assertEq(validate({ ...minimal, box9GraduateStudent: false })[0], 'error')
        },
        /**
         * DOC-11: an absent box 8 is ABSENT. It must not read as `false` by
         * accident — the whole American Opportunity Credit rides on the
         * at-least-half-time test, and a materialized `false` would be an
         * assertion the institution never made.
         */
        absentIsNotFalse: () => {
            const [t, v] = validate(minimal)
            assert(t === 'ok', ['expected ok', t, v])
            assertEq(v.box8AtLeastHalfTimeStudent, undefined)
            assert(
                !('box8AtLeastHalfTimeStudent' in v),
                ['an absent checkbox must stay absent, never materialize as false', v],
            )
        },
    },

    priorYearAdjustments: {
        /**
         * Boxes 4, 6 and 10 are STORABLE, not refused at ingest — a real
         * institution really does print them, and the refusal they cause
         * belongs where the credit is computed. `fjs/form8863`'s own proof is
         * the other half of this pair.
         */
        aPriorYearAdjustmentIsStorableNotRefusedHere: () => {
            const [t, v] = validate({
                ...withTuition,
                box4AdjustmentsForAPriorYear: '500.00',
                box6AdjustmentsToScholarshipsForAPriorYear: '250.00',
                box10InsuranceContractReimbursementOrRefund: '125.00',
            })
            assert(t === 'ok', ['a prior-year adjustment must be storable', t, v])
            assertEq(v.box4AdjustmentsForAPriorYear, '500.00')
            assertEq(v.box6AdjustmentsToScholarshipsForAPriorYear, '250.00')
            assertEq(v.box10InsuranceContractReimbursementOrRefund, '125.00')
        },
    },

    /**
     * DOC-11: an absent box 1 is not a refusal and not a zero. An
     * institution that furnishes a form reporting a scholarship and no
     * payment is ordinary — and it is exactly the case in which reading an
     * absent box as `0.00` would be indistinguishable from a real zero.
     */
    absentBoxOneIsNotARefusal: () => {
        const [t, v] = validate({ ...minimal, box5ScholarshipsOrGrants: '4000.00' })
        assert(t === 'ok', ['expected ok', t, v])
        assert(!('box1PaymentsReceivedForQualifiedTuition' in v), ['absent box must stay absent', v])
        assertEq(v.box5ScholarshipsOrGrants, '4000.00')
    },

    /**
     * Boxes 2 and 3 are RESERVED on the printed form and have no field, so a
     * blob carrying one is refused structurally. Asserted rather than left to
     * be noticed: an engine that accepted `box2` would be accepting data the
     * form cannot carry, and nothing downstream would ever read it.
     */
    reservedBoxesTwoAndThreeHaveNoField: () => {
        assertEq(Object.keys(declaredMembers(oneZeroNineEightTSchema)).includes('box2'), false)
        assertEq(Object.keys(declaredMembers(oneZeroNineEightTSchema)).includes('box3'), false)
        const [t, v] = validate(minimal)
        assert(t === 'ok', ['expected ok', t, v])
        assertEq(Object.keys(v).includes('box2'), false)
        assertEq(Object.keys(v).includes('box3'), false)
    },

    /** A blob tagged as another dialect is rejected structurally, on `dialect`. */
    crossDialect: {
        // `vnd.fjs.1098e` is the dialect this one is modelled on and
        // therefore the one whose shape is most nearly compatible — the same
        // choice of neighbour `fjs/document/adjustments` makes for its own
        // cross-dialect leaf.
        oneZeroNineEightEShapeRejectedByOneZeroNineEightT: () => {
            const [t, v] = validate({ ...minimal, dialect: 'vnd.fjs.1098e' })
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
