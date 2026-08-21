/**
 * `vnd.fjs.1099nec` — Form 1099-NEC, *Nonemployee Compensation* (DOC-20).
 *
 * The smallest transcribed dialect in this tree, and the one whose smallness
 * was once the argument against building it. REQUIREMENTS.md's Out of Scope
 * list carried, from 2026-08-03 until 2026-08-15, the entry *"1099-NEC and
 * self-employment — the three-box simplicity is a trap; the downstream is
 * Schedule C / SE / QBI."* That entry is struck through rather than deleted,
 * because it was RIGHT: this file is a morning's work and `fjs/schedule/c` is
 * the largest single module this project has written. Read it as a warning,
 * not as history.
 *
 * ## What this dialect COMPUTES versus what it merely STORES
 *
 * Two boxes are consumed by a computation, and the shape of that claim is
 * `fjs/document/1099g`'s, one dialect over:
 *
 * - **Box 1, nonemployee compensation** → Schedule C line 1 (gross receipts)
 *   → Schedule C line 31 → Schedule 1 line 3 → 1040 line 8.
 * - **Box 4, federal income tax withheld** → 1040 line 25b, joining the other
 *   1099-family withholding under `federalTaxWithheldOnOther1099`. Backup
 *   withholding under §3406 is the usual reason a 1099-NEC carries one.
 *
 * A third box carries no amount and is nonetheless READ:
 *
 * - **Box 2** is a CHECKBOX: *"Payer made direct sales totaling $5,000 or more
 *   of consumer products to recipient for resale."* It reports no dollar
 *   figure — the payer ticks it and reports the sales nowhere — and it follows
 *   DOC-12's checkbox convention (`option(true)`), so a `false` blob is
 *   rejected structurally and absence is the only way to say "not checked".
 *
 *   **A ticked box 2 makes `fjs/schedule/c` REFUSE the whole return**, and
 *   that is worth reading twice, because a checkbox that reports no amount
 *   looks like the safest thing on the form. Two consequences follow from it,
 *   and this engine can compute neither: the goods are INVENTORY, so Schedule
 *   C Part III applies and line 4 is not zero; and the resale proceeds are
 *   cash sales to consumers, reported on no information return at all, so a
 *   line 1 read from Forms 1099-NEC box 1 is short by the whole of what the
 *   business actually took in. Reading a reseller's WHOLESALE PURCHASES as
 *   their gross receipts is not a small error — it is the wrong figure
 *   entirely, in the understating direction.
 *
 * Everything else is stored and computed on by nothing:
 *
 * - **Box 3** is *"Reserved for future use"* on the current revision — the
 *   printed form's own inert box, exactly like Schedule 1's line 22. It is
 *   modeled for line-number completeness so a transcriber cannot mistake box
 *   4 for box 3, and it carries no type but `option(string)`; nothing reads
 *   it, and it is refused when non-zero for the same reason every other
 *   unmodeled amount here is.
 * - **Boxes 5, 6 and 7** are the state block — state tax withheld, the
 *   state/payer's state number, and state income. State withholding never
 *   reaches a federal return, so having no computation for it is CORRECT
 *   rather than a gap, and REQUIREMENTS.md's Out of Scope entry for state
 *   returns says exactly this: *"store W-2 boxes 15-20 faithfully, compute
 *   nothing."*
 *
 * ## The state block is an ARRAY of rows, not three flat fields
 *
 * The printed 1099-NEC carries TWO state lines (boxes 5/6/7 are each printed
 * twice), for a payer who withheld for two states. `fjs/document/w2`'s
 * `box15Through20` and `fjs/document/1099g`'s `box10Through11` are the same
 * problem already solved twice in this tree, and this is the third instance
 * of the identical shape rather than a fourth invention.
 *
 * `fjs/document/1099g`'s own header records what happens when this is got
 * wrong: that dialect carried a bare top-level `box11StateIncomeTaxWithheld`
 * and no state at all until Phase 20 raised it, justified by "a state return
 * would want it" — a justification that is half-built, because a withheld
 * amount with no state attached tells a state return nothing. So `state` is
 * REQUIRED on a row here and the other two fields are absent-able (DOC-11).
 *
 * **Box 7 (state income) is a money box that is NOT withholding**, unlike the
 * 1099-G's single-money-field row. It is the portion of box 1 attributable to
 * that state, and it is stored for the same state-return reason.
 *
 * @module
 */
import { array, number, option, string } from 'functionalscript/fjs/types/rtti/module.f.mjs'
import { validate as rttiValidate } from 'functionalscript/fjs/types/rtti/validate/module.f.mjs'
import { error, ok } from 'functionalscript/fjs/types/result/module.f.mjs'
import { assert, assertEq } from 'functionalscript/fjs/asserts/module.f.mjs'
import { centsFromString } from '../../exact/module.f.js'
import { base, mediaTypeOf } from '../base/module.f.js'
import { formRevisionError } from '../form_revision/module.f.js'
import { moneyFieldError } from '../money_field/module.f.js'

/** @import { Result } from 'functionalscript/fjs/types/result/types.js' */
/** @import { Ts, Unknown } from 'functionalscript/fjs/types/rtti/ts/types.js' */
/** @import { ValidationError } from 'functionalscript/fjs/types/rtti/common/types.js' */
/** @import { SubjectKey } from '../subject/module.f.js' */

/**
 * Format tag: names the dialect of this BLOB. The media type it is served
 * with is derived mechanically: `application/` + `dialect` + `+json`.
 */
export const dialect = 'vnd.fjs.1099nec'
/** The media type derived from {@link dialect}: `application/vnd.fjs.1099nec+json`. */
export const mediaType = mediaTypeOf(dialect)

/**
 * One boxes-5-through-7 row: the state tax withheld, the state/payer's state
 * number, and the state income. Every field but `state` is absent-able
 * (DOC-11), and the printed form carries TWO such rows, which is why this is
 * an array rather than three flat fields — see this module's own docstring.
 *
 * The field NAMES carry their box numbers, because the printed 1099-NEC
 * numbers this block 5/6/7 while `fjs/document/w2` numbers its own 15-20 and
 * `fjs/document/1099g` its own 10a/10b/11. Three dialects, three numberings,
 * one shape: keeping the numbers in the names is what stops a transcriber
 * carrying a W-2 habit into this form.
 */
const stateEntry = /** @type {const} */ ({
    state: string,
    box5StateTaxWithheld: option(string),
    box6StatePayerStateNumber: option(string),
    box7StateIncome: option(string),
})

/**
 * rtti schema for a `1099nec` BLOB. `dialect` is spread first (via `base`) so
 * structural validation reports it as the first failing field on a mismatched
 * blob, matching every other document dialect in this tree.
 */
export const oneZeroNineNineNecSchema = /** @type {const} */ ({
    ...base(dialect),
    payerTin: string,
    recipientTin: string,
    accountNumber: string,
    taxYear: number,
    formRevision: string,
    corrected: option(true),
    box1NonemployeeCompensation: option(string),
    box2DirectSalesOfFiveThousandOrMore: option(true),
    box3ReservedForFutureUse: option(string),
    box4FederalIncomeTaxWithheld: option(string),
    box5Through7: option(array(stateEntry)),
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
export const subjectKey = { formType: 'dialect', taxYear: 'taxYear', payer: 'payerTin', recipient: 'recipientTin', account: 'accountNumber' }

/** @typedef {Ts<typeof oneZeroNineNineNecSchema>} OneZeroNineNineNec */

/** Structural-only validator: checks the shape, not the semantic refinements below. */
const validateShape = rttiValidate(oneZeroNineNineNecSchema)

/**
 * Every TOP-LEVEL money box on this form, walked in one loop so the
 * `centsFromString` re-parse is written once rather than per box. Typed via
 * `@type {const}` so `r[field]` resolves to exactly `string | undefined`.
 *
 * `box2DirectSalesOfFiveThousandOrMore` (a checkbox) is deliberately absent —
 * it is not a dollar amount, and the $5,000 in its own caption is a threshold
 * the PAYER applied, never a figure the form reports.
 */
export const moneyBoxFields = /** @type {const} */ ([
    'box1NonemployeeCompensation',
    'box3ReservedForFutureUse',
    'box4FederalIncomeTaxWithheld',
])

/**
 * The money-carrying fields of a boxes-5-through-7 row (`state` and
 * `box6StatePayerStateNumber` are identity labels, not amounts). Named once at
 * module scope so {@link checkReferences}' loop and this module's generated
 * proof walk the identical list — `fjs/document/w2`'s `stateLocalMoneyFields`
 * precedent, and AGENTS.md's "one rule, one place".
 */
export const stateMoneyFields = /** @type {const} */ ([
    'box5StateTaxWithheld',
    'box7StateIncome',
])

/**
 * The money boxes this engine has NO computation for. A present, non-zero
 * amount is refused by name, naming where the amount would have gone —
 * `fjs/document/1099g`'s discipline, and the reason its own header gives:
 * *"a number that would change the answer is never silently dropped."*
 *
 * Exactly ONE row, and its emptiness elsewhere is the interesting part. Box 1
 * and box 4 both compute. The state block is stored-not-computed rather than
 * refused, for the reason this module's own docstring gives (state
 * withholding never reaches a federal return, so no computation is the
 * correct answer, not a missing one). That leaves box 3 — the printed form's
 * own reserved box — as the only amount that could arrive and mean something
 * this engine cannot place.
 */
const unmodeledMoneyBoxes = /** @type {const} */ ([
    ['box3ReservedForFutureUse', 'no line at all: the printed form reserves this box with no caption, so an amount in it belongs to a form revision this engine has not read'],
])

/**
 * Either a structural validation error or a semantic (string) error message.
 * @typedef {ValidationError | string} OneZeroNineNineNecError
 */

/**
 * Checks the semantic refinements the structural schema cannot express on an
 * already shape-valid `1099nec` value:
 * - `formRevision` (DOC-10) must not be empty or whitespace-only.
 * - Every PRESENT money box — top-level or inside a state row — must parse via
 *   `fjs/exact`'s `centsFromString` (DOC-11: absent boxes are skipped, never
 *   defaulted).
 * - Every present, NON-ZERO unmodeled box is refused by name, naming where it
 *   would have gone. A present-but-zero unmodeled box is accepted: zero
 *   changes no line, so refusing it would reject the common transcript that
 *   prints `0.00` in an unused box.
 *
 * The zero check re-parses through `centsFromString` rather than comparing the
 * printed string against `'0.00'` — `'0'`, `'0.00'` and `'-0.00'` are all zero
 * and only the parse knows that.
 * @type {(r: OneZeroNineNineNec) => Result<OneZeroNineNineNec, OneZeroNineNineNecError>}
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
    for (const entry of r.box5Through7 ?? []) {
        for (const field of stateMoneyFields) {
            const printed = entry[field]
            if (printed === undefined) {
                continue
            }
            const message = moneyFieldError(`${entry.state} ${field}`)(printed)
            if (message !== undefined) {
                return error(message)
            }
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
 * Validates an already-parsed JSON value as a `1099nec` BLOB: structural (rtti)
 * validation followed by the semantic checks in {@link checkReferences}.
 * @type {(value: Unknown) => Result<OneZeroNineNineNec, OneZeroNineNineNecError>}
 */
export const validate = value => {
    const [t, v] = validateShape(value)
    if (t === 'error') {
        return error(v)
    }
    return checkReferences(v)
}

// ── Tests ────────────────────────────────────────────────────────────────────

/** @type {OneZeroNineNineNec} */
const minimal = {
    dialect,
    payerTin: '11-1111111',
    recipientTin: '222-22-2222',
    accountNumber: 'ACC-0001',
    taxYear: 2025,
    formRevision: '2025',
}

/** The shape a real client's 1099-NEC produces: compensation, no withholding. */
/** @type {OneZeroNineNineNec} */
const compensationOnly = {
    ...minimal,
    box1NonemployeeCompensation: '48000.00',
}

/** The shape §3406 backup withholding produces: compensation AND box 4. */
/** @type {OneZeroNineNineNec} */
const compensationWithBackupWithholding = {
    ...minimal,
    box1NonemployeeCompensation: '48000.00',
    box4FederalIncomeTaxWithheld: '11520.00',
}

/**
 * One generated leaf per money box: supplying a comma-grouped amount to that
 * box alone must be refused. Mirrors `fjs/document/1099g`'s own per-box
 * coverage so a box quietly dropped from {@link moneyBoxFields} is caught
 * rather than silently accepting inexact input.
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
 * One generated leaf per unmodeled box: a present, NON-ZERO amount must be
 * refused, and the message must name both the box and where it would have
 * gone. `fjs/document/1099g`'s own comment records why the DESTINATION is
 * asserted separately: Phase 20's verification found erasing it survived the
 * entire suite, because five refusal proofs asserted the box name and the
 * phrase "cannot compute" and not one asserted the only part of the message a
 * reader can act on.
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

/**
 * The same boxes, present but ZERO, must be ACCEPTED — a transcript that
 * prints `0.00` into an unused box is ordinary, and refusing it would make the
 * common case unusable. This is the control that keeps the refusal above from
 * being an indiscriminate "any present box fails" rule.
 */
const perUnmodeledBoxZeroAccepted = Object.fromEntries(unmodeledMoneyBoxes.map(([field]) => [
    `${field}IsAcceptedWhenZero`,
    () => {
        const [t] = validate({ ...minimal, [field]: '0.00' })
        assertEq(t, 'ok', `${field} must be accepted when it is zero`)
    },
]))

/** The number of TOP-LEVEL money boxes, hand-typed so a REMOVAL is caught. */
const expectedMoneyBoxCount = 3
/** The number of money fields on one boxes-5-through-7 row, hand-typed likewise. */
const expectedStateMoneyFieldCount = 2
/** The number of refused-when-non-zero boxes, hand-typed so a REMOVAL is caught. */
const expectedUnmodeledBoxCount = 1

export const proof = {
    ...perMoneyBoxRejection,
    ...perUnmodeledBoxRefusal,
    ...perUnmodeledBoxZeroAccepted,

    dialectAndMediaType: () => {
        assertEq(dialect, 'vnd.fjs.1099nec')
        assertEq(mediaType, 'application/vnd.fjs.1099nec+json')
    },

    /**
     * Generated coverage cannot see a box REMOVED from the list — the loop
     * simply generates one fewer leaf and stays green. The hand-typed counts
     * are the independent side of that pair (Phase 11's Mutation Gate M2).
     */
    boxListsAreCovered: () => {
        assertEq(moneyBoxFields.length, expectedMoneyBoxCount)
        assertEq(unmodeledMoneyBoxes.length, expectedUnmodeledBoxCount)
        assertEq(stateMoneyFields.length, expectedStateMoneyFieldCount)
    },

    box5Through7: {
        /**
         * Two state rows on one form, which is why this is an array. The
         * printed 1099-NEC carries two 5/6/7 lines, and a contractor who
         * worked in two states for one client receives exactly that.
         */
        twoStateRowsAreStoredInOrder: () => {
            const [t, v] = validate({
                ...minimal,
                box5Through7: [
                    { state: 'CA', box5StateTaxWithheld: '1200.00', box6StatePayerStateNumber: '999-1111-1', box7StateIncome: '30000.00' },
                    { state: 'OR', box7StateIncome: '18000.00' },
                ],
            })
            assertEq(t, 'ok')
            assert(typeof v !== 'string' && !Array.isArray(v), ['expected the validated document', v])
            const rows = /** @type {OneZeroNineNineNec} */ (v).box5Through7
            assertEq(rows?.length, 2)
            assertEq(rows?.[0]?.state, 'CA')
            assertEq(rows?.[0]?.box5StateTaxWithheld, '1200.00')
            assertEq(rows?.[0]?.box6StatePayerStateNumber, '999-1111-1')
            assertEq(rows?.[1]?.state, 'OR')
            assertEq(rows?.[1]?.box7StateIncome, '18000.00')
            // Absent, not defaulted (DOC-11). The second row prints no
            // withholding, and "absent" must stay distinguishable from "zero".
            assertEq(rows?.[1]?.box5StateTaxWithheld, undefined)
        },

        /** A state with no withholding at all is ordinary and must validate. */
        aStateRowNeedsOnlyItsState: () => {
            const [t] = validate({ ...minimal, box5Through7: [{ state: 'TX' }] })
            assertEq(t, 'ok')
        },

        /**
         * BOTH money fields inside a row go through the SAME `moneyFieldError`
         * every top-level box does, and each is asserted separately: a check
         * written for `box5StateTaxWithheld` alone would leave box 7 a hole in
         * DOC-11's parsing rule, and the row-level loop is exactly the shape
         * that hides such a hole.
         */
        aCommaGroupedStateAmountIsRefusedNamingTheState: () => {
            const [withheld, whyWithheld] = validate({
                ...minimal,
                box5Through7: [{ state: 'CA', box5StateTaxWithheld: '1,234.56' }],
            })
            assertEq(withheld, 'error')
            assert(typeof whyWithheld === 'string' && whyWithheld.includes('CA'), ['the refusal must name the state', whyWithheld])
            assert(
                typeof whyWithheld === 'string' && whyWithheld.includes('box5StateTaxWithheld'),
                ['the refusal must name the field', whyWithheld])
            const [income, whyIncome] = validate({
                ...minimal,
                box5Through7: [{ state: 'CA', box7StateIncome: '1,234.56' }],
            })
            assertEq(income, 'error')
            assert(
                typeof whyIncome === 'string' && whyIncome.includes('box7StateIncome'),
                ['box 7 is checked too, not only box 5', whyIncome])
        },

        /** The overwhelmingly common 1099-NEC prints no state block at all. */
        anAbsentStateBlockIsAbsentNotEmpty: () => {
            const [t, v] = validate(minimal)
            assertEq(t, 'ok')
            assert(typeof v !== 'string' && !Array.isArray(v), ['expected the validated document', v])
            assertEq(/** @type {OneZeroNineNineNec} */ (v).box5Through7, undefined)
        },

        /**
         * State withholding is stored and NOT refused, unlike box 3 — it never
         * reaches a federal return, so having no computation for it is correct
         * rather than a gap. **It is stored WITH the state it was withheld
         * for**, which is the part that makes that reasoning hold.
         */
        stateWithholdingIsStoredWithItsStateNotRefused: () => {
            const [t, v] = validate({
                ...minimal,
                box5Through7: [{ state: 'CA', box5StateTaxWithheld: '250.00' }],
            })
            assertEq(t, 'ok')
            assert(t === 'ok' && v.box5Through7?.[0]?.box5StateTaxWithheld === '250.00', [v])
            assert(t === 'ok' && v.box5Through7?.[0]?.state === 'CA', [v])
        },
    },

    minimalValidates: () => {
        const [t] = validate(minimal)
        assertEq(t, 'ok')
    },

    /** The ordinary freelancer's form — box 1 alone — round-trips. */
    compensationOnlyValidates: () => {
        const [t, v] = validate(compensationOnly)
        assertEq(t, 'ok')
        assert(t === 'ok' && v.box1NonemployeeCompensation === '48000.00', ['box 1 round-trips', v])
        assert(t === 'ok' && !('box4FederalIncomeTaxWithheld' in v), ['box 4 stays absent', v])
    },

    /** The §3406 backup-withholding shape — both computed boxes — round-trips. */
    compensationWithBackupWithholdingValidates: () => {
        const [t, v] = validate(compensationWithBackupWithholding)
        assertEq(t, 'ok')
        assert(t === 'ok' && v.box1NonemployeeCompensation === '48000.00', ['box 1 round-trips', v])
        assert(t === 'ok' && v.box4FederalIncomeTaxWithheld === '11520.00', ['box 4 round-trips', v])
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

    /**
     * DOC-11: an ABSENT box is not a refusal and not a zero. The minimal
     * fixture carries no boxes at all and validates — which is what makes
     * `'box1NonemployeeCompensation' in value` a meaningful question for a
     * caller, rather than every document arriving pre-populated with zeros.
     */
    absentBoxesAreNotRefusals: () => {
        const [t, v] = validate(minimal)
        assertEq(t, 'ok')
        assert(t === 'ok' && !('box1NonemployeeCompensation' in v), ['absent box must stay absent', v])
        assert(t === 'ok' && !('box4FederalIncomeTaxWithheld' in v), ['absent box must stay absent', v])
        assert(t === 'ok' && !('box3ReservedForFutureUse' in v), ['absent box must stay absent', v])
    },

    /** DOC-12's checkbox convention: `false` is structurally rejected. */
    box2FalseIsStructurallyRejected: () => {
        const [t] = validate({ ...minimal, box2DirectSalesOfFiveThousandOrMore: false })
        assertEq(t, 'error')
    },

    box2TrueIsAccepted: () => {
        const [t, v] = validate({ ...minimal, box2DirectSalesOfFiveThousandOrMore: true })
        assertEq(t, 'ok')
        assert(t === 'ok' && v.box2DirectSalesOfFiveThousandOrMore === true, [v])
    },

    /**
     * Box 2 carries NO amount, and that is asserted rather than assumed: the
     * $5,000 in its printed caption is a threshold the PAYER applied, so a
     * blob putting a dollar string there is structurally rejected. Without
     * this leaf, widening box 2 to `option(string)` — which would silently
     * make it look like a money box that nothing sums — would pass.
     */
    box2CarriesNoAmount: () => {
        const [t] = validate({ ...minimal, box2DirectSalesOfFiveThousandOrMore: '5000.00' })
        assertEq(t, 'error', 'box 2 is a checkbox; a dollar amount there is not this form')
    },

    /** A blob tagged as another dialect is rejected structurally, on `dialect`. */
    otherDialectRejected: () => {
        const [t, v] = validate({ ...minimal, dialect: 'vnd.fjs.1099g' })
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
     * DOC-00, `crossDialect`-style, in the direction that matters: a fully
     * valid `vnd.fjs.1099g` — the dialect this one is modelled on, and
     * therefore the one whose shape is most nearly compatible — fails THIS
     * dialect's `validate`, and the failure's path is exactly `['dialect']`.
     */
    crossDialect: {
        oneZeroNineNineGShapeRejectedByNec: () => {
            const [t, v] = validate({
                dialect: 'vnd.fjs.1099g',
                payerTin: '11-1111111',
                recipientTin: '222-22-2222',
                accountNumber: 'ACC-0001',
                taxYear: 2025,
                formRevision: '2025',
                box1UnemploymentCompensation: '4554.00',
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
