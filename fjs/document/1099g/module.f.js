/**
 * `vnd.fjs.1099g` — Form 1099-G, *Certain Government Payments*.
 *
 * Added because a real IRS Wage and Income Transcript contained one and the
 * engine refused the whole return: unemployment compensation reaches Form
 * 1040 through Schedule 1 line 7, which was a declared zero, and the scope
 * guard correctly refused rather than silently omit the income. This module
 * is the dialect half of closing that gap.
 *
 * ## What this dialect COMPUTES versus what it merely STORES
 *
 * A 1099-G carries eight distinct money boxes feeding several different
 * places on a return — seven at the top level, plus the state income tax
 * withheld that lives inside a boxes-10a-through-11 row. This dialect models
 * the printed form faithfully — every box is storable — but only **two** are
 * consumed by a computation:
 *
 * - **Box 1, unemployment compensation** → Schedule 1 line 7 → 1040 line 8.
 * - **Box 4, federal income tax withheld** → 1040 line 25b, joining the other
 *   1099-family withholding under `federalTaxWithheldOnOther1099`.
 *
 * Every other money box is **refused when it carries a non-zero amount**, by
 * name, in {@link checkReferences}. That is deliberate and is the whole point:
 *
 * - **Box 2** (state/local income tax refunds) is Schedule 1 line 1, and it is
 *   taxable only under the tax-benefit rule — it depends on whether the
 *   taxpayer itemized in the PRIOR year and by how much their deduction
 *   exceeded the standard deduction. This engine models a single tax year and
 *   holds no prior-year return, so it cannot decide that question. Storing the
 *   box and ignoring it would understate income for anyone who itemized last
 *   year; guessing would be worse.
 * - **Boxes 5, 6, 7 and 9** (RTAA payments, taxable grants, agriculture
 *   payments, market gain) each land on Schedule 1 line 8's collapsed
 *   "other income" or on a Schedule F this engine does not model.
 *
 * **Refusing a present-but-unmodeled box is the same discipline
 * `fjs/return/scope` applies at the return level**, applied here at the
 * document level: a number that would change the answer is never silently
 * dropped. An ABSENT box is not a refusal — DOC-11's absent-versus-zero rule
 * holds, and the overwhelmingly common 1099-G (unemployment only) validates
 * cleanly.
 *
 * ## Box 3 and box 8 are not money
 *
 * `box3RefundTaxYear` is the year box 2's refund relates to, and
 * `box8TradeOrBusinessIncome` is a checkbox. Neither is a dollar amount, so
 * neither appears in {@link moneyBoxFields} and neither is re-parsed through
 * `centsFromString`. `box8TradeOrBusinessIncome` follows DOC-12's checkbox
 * convention — `option(true)`, so a `false` blob is rejected structurally and
 * absence is the only way to say "not checked".
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

/** @import { Result } from 'functionalscript/fjs/types/result/module.f.js' */
/** @import { Ts, Unknown } from 'functionalscript/fjs/types/rtti/ts/module.f.js' */
/** @import { ValidationError } from 'functionalscript/fjs/types/rtti/validate/module.f.js' */

/**
 * Format tag: names the dialect of this BLOB. The media type it is served
 * with is derived mechanically: `application/` + `dialect` + `+json`.
 */
export const dialect = 'vnd.fjs.1099g'
/** The media type derived from {@link dialect}: `application/vnd.fjs.1099g+json`. */
export const mediaType = mediaTypeOf(dialect)

/**
 * One boxes-10a-through-11 row: the state, its payer identification number,
 * and the state income tax withheld on that state's line. Every field but
 * `state` is absent-able (DOC-11), and the printed form carries TWO such rows,
 * which is why this is an array rather than three flat fields.
 *
 * Modelled on `fjs/document/w2`'s `stateLocalEntry` — the same problem one
 * dialect over, solved the same way. **Before 2026-08-15 this dialect carried
 * a bare top-level `box11StateIncomeTaxWithheld` and no 10a/10b at all**,
 * justified in its own docstring by "a state return would want it". That
 * justification was half-built: a withheld amount with no state attached tells
 * a state return nothing, and Phase 20's verification pass raised exactly that.
 * Either the state block is modelled or box 11 should not have been stored.
 */
const stateEntry = /** @type {const} */ ({
    state: string,
    statePayerStateNumber: option(string),
    stateIncomeTaxWithheld: option(string),
})

/**
 * rtti schema for a `1099g` BLOB. `dialect` is spread first (via `base`) so
 * structural validation reports it as the first failing field on a mismatched
 * blob, matching every other document dialect in this tree.
 */
export const oneZeroNineNineGSchema = /** @type {const} */ ({
    ...base(dialect),
    payerTin: string,
    recipientTin: string,
    accountNumber: string,
    taxYear: number,
    formRevision: string,
    corrected: option(true),
    box1UnemploymentCompensation: option(string),
    box2StateOrLocalIncomeTaxRefunds: option(string),
    box3RefundTaxYear: option(number),
    box4FederalIncomeTaxWithheld: option(string),
    box5RtaaPayments: option(string),
    box6TaxableGrants: option(string),
    box7AgriculturePayments: option(string),
    box8TradeOrBusinessIncome: option(true),
    box9MarketGain: option(string),
    box10Through11: option(array(stateEntry)),
    payerName: option(string),
    recipientName: option(string),
})

/** @typedef {Ts<typeof oneZeroNineNineGSchema>} OneZeroNineNineG */

/** Structural-only validator: checks the shape, not the semantic refinements below. */
const validateShape = rttiValidate(oneZeroNineNineGSchema)

/**
 * Every money box on this form, walked in one loop so the `centsFromString`
 * re-parse is written once rather than per box. Typed via `@type {const}` so
 * `r[field]` resolves to exactly `string | undefined`.
 *
 * `box3RefundTaxYear` (a year) and `box8TradeOrBusinessIncome` (a checkbox)
 * are deliberately absent — they are not dollar amounts.
 */
const moneyBoxFields = /** @type {const} */ ([
    'box1UnemploymentCompensation',
    'box2StateOrLocalIncomeTaxRefunds',
    'box4FederalIncomeTaxWithheld',
    'box5RtaaPayments',
    'box6TaxableGrants',
    'box7AgriculturePayments',
    'box9MarketGain',
])

/**
 * The one money-carrying field of a boxes-10a-through-11 row (`state` and
 * `statePayerStateNumber` are identity labels, not amounts). Named once at
 * module scope so {@link checkReferences}' loop and this module's generated
 * proof walk the identical list — `fjs/document/w2`'s `stateLocalMoneyFields`
 * precedent, and AGENTS.md's "one rule, one place".
 */
const stateMoneyFields = /** @type {const} */ ([
    'stateIncomeTaxWithheld',
])

/**
 * The money boxes this engine has NO computation for. A present, non-zero
 * amount in any of these is refused by name — see the module header for why
 * each one is genuinely undecidable here rather than merely unimplemented.
 *
 * The state income tax withheld inside a boxes-10a-through-11 row is NOT in
 * this list: state withholding never reaches a federal return at all, so
 * storing it and not computing on it is correct rather than a gap. It is
 * stored because the printed form carries it and a state return would want it
 * — **together with the state and payer number that make it usable**, which is
 * what turns that sentence from an assertion into a true one. `fjs/document/w2`
 * treats its own boxes 15-20 the same way, and REQUIREMENTS.md's Out of Scope
 * entry for state returns says exactly this: *"store W-2 boxes 15-20
 * faithfully, compute nothing."*
 */
const unmodeledMoneyBoxes = /** @type {const} */ ([
    ['box2StateOrLocalIncomeTaxRefunds', 'Schedule 1 line 1 (taxable state/local income tax refunds), which depends on whether the taxpayer itemized in the PRIOR year — this engine models one tax year and holds no prior-year return'],
    ['box5RtaaPayments', "Schedule 1 line 8's collapsed other-income block, which no dialect can attribute an amount to"],
    ['box6TaxableGrants', "Schedule 1 line 8's collapsed other-income block, which no dialect can attribute an amount to"],
    ['box7AgriculturePayments', 'Schedule F line 4b (taxable agricultural program payments), which this engine does not model'],
    ['box9MarketGain', "Schedule 1 line 8's collapsed other-income block, which no dialect can attribute an amount to"],
])

/**
 * Either a structural validation error or a semantic (string) error message.
 * @typedef {ValidationError | string} OneZeroNineNineGError
 */

/**
 * Checks the semantic refinements the structural schema cannot express on an
 * already shape-valid `1099g` value:
 * - `formRevision` (DOC-10) must not be empty or whitespace-only.
 * - Every PRESENT money box must parse via `fjs/exact`'s `centsFromString`
 *   (DOC-11: absent boxes are skipped, never defaulted).
 * - Every present, NON-ZERO unmodeled box is refused by name, naming where it
 *   would have gone. A present-but-zero unmodeled box is accepted: zero
 *   changes no line, so refusing it would reject the common transcript that
 *   prints `0.00` in an unused box.
 *
 * The zero check re-parses through `centsFromString` rather than comparing the
 * printed string against `'0.00'` — `'0'`, `'0.00'` and `'-0.00'` are all zero
 * and only the parse knows that.
 * @type {(r: OneZeroNineNineG) => Result<OneZeroNineNineG, OneZeroNineNineGError>}
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
    for (const entry of r.box10Through11 ?? []) {
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
 * Validates an already-parsed JSON value as a `1099g` BLOB: structural (rtti)
 * validation followed by the semantic checks in {@link checkReferences}.
 * @type {(value: Unknown) => Result<OneZeroNineNineG, OneZeroNineNineGError>}
 */
export const validate = value => {
    const [t, v] = validateShape(value)
    if (t === 'error') {
        return error(v)
    }
    return checkReferences(v)
}

// ── Tests ────────────────────────────────────────────────────────────────────

/** @type {OneZeroNineNineG} */
const minimal = {
    dialect,
    payerTin: '11-1111111',
    recipientTin: '222-22-2222',
    accountNumber: 'ACC-0001',
    taxYear: 2025,
    formRevision: '2025',
}

/** The shape a real transcript produces: unemployment plus its withholding. */
/** @type {OneZeroNineNineG} */
const unemploymentWithWithholding = {
    ...minimal,
    box1UnemploymentCompensation: '4554.00',
    box4FederalIncomeTaxWithheld: '454.00',
}

/**
 * One generated leaf per money box: supplying a comma-grouped amount to that
 * box alone must be refused. Mirrors `fjs/document/1099int`'s own
 * per-box coverage so a box quietly dropped from {@link moneyBoxFields} is
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
 * One generated leaf per unmodeled box: a present, NON-ZERO amount must be
 * refused and the message must name both the box and where it would have gone.
 * A dialect that stored these silently would understate income.
 */
const perUnmodeledBoxRefusal = Object.fromEntries(unmodeledMoneyBoxes.map(([field, destination]) => [
    `${field}IsRefusedWhenNonZero`,
    () => {
        const [t, v] = validate({ ...minimal, [field]: '100.00' })
        assertEq(t, 'error', `${field} must be refused when non-zero`)
        assert(typeof v === 'string' && v.includes(field), [field, v])
        assert(typeof v === 'string' && v.includes('cannot compute'), [field, v])
        // The DESTINATION, not merely the box name. A refusal that says "this
        // box cannot be computed" without naming where the amount would have
        // gone tells the reader nothing actionable — naming the line is the
        // whole difference between a refusal and an error. Added 2026-08-15
        // after Phase 20's verification found `destination` -> `''` survived
        // the entire suite: the behaviour was true of the code and observed by
        // nothing.
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
const expectedMoneyBoxCount = 7
/** The number of money fields on one boxes-10a-through-11 row, hand-typed likewise. */
const expectedStateMoneyFieldCount = 1
/** The number of refused-when-non-zero boxes, hand-typed so a REMOVAL is caught. */
const expectedUnmodeledBoxCount = 5

export const proof = {
    ...perMoneyBoxRejection,
    ...perUnmodeledBoxRefusal,
    ...perUnmodeledBoxZeroAccepted,

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

    box10Through11: {
        /**
         * Two state rows on one form, which is why this is an array. The
         * printed 1099-G carries two 10a/10b/11 lines, and a taxpayer who
         * moved mid-year receives exactly that.
         */
        twoStateRowsAreStoredInOrder: () => {
            const [t, v] = validate({
                ...minimal,
                box10Through11: [
                    { state: 'CA', statePayerStateNumber: '999-1111-1', stateIncomeTaxWithheld: '120.00' },
                    { state: 'OR', stateIncomeTaxWithheld: '45.00' },
                ],
            })
            assertEq(t, 'ok')
            assert(typeof v !== 'string' && !Array.isArray(v), ['expected the validated document', v])
            const rows = /** @type {OneZeroNineNineG} */ (v).box10Through11
            assertEq(rows?.length, 2)
            assertEq(rows?.[0]?.state, 'CA')
            assertEq(rows?.[0]?.statePayerStateNumber, '999-1111-1')
            assertEq(rows?.[1]?.state, 'OR')
            // Absent, not defaulted (DOC-11). The second row prints no payer
            // number, and "absent" must stay distinguishable from "empty".
            assertEq(rows?.[1]?.statePayerStateNumber, undefined)
        },

        /** A state with no withholding at all is ordinary and must validate. */
        aStateRowNeedsOnlyItsState: () => {
            const [t] = validate({ ...minimal, box10Through11: [{ state: 'TX' }] })
            assertEq(t, 'ok')
        },

        /**
         * The money field inside a row goes through the SAME `moneyFieldError`
         * every top-level box does — a comma-grouped amount is refused there
         * too. Without this, the row would be a hole in DOC-11's parsing rule.
         */
        aCommaGroupedStateAmountIsRefusedNamingTheState: () => {
            const [t, v] = validate({
                ...minimal,
                box10Through11: [{ state: 'CA', stateIncomeTaxWithheld: '1,234.56' }],
            })
            assertEq(t, 'error')
            assert(typeof v === 'string' && v.includes('CA'), ['the refusal must name the state', v])
        },

        /** The transcript this dialect was built from prints no state block at all. */
        anAbsentStateBlockIsAbsentNotEmpty: () => {
            const [t, v] = validate(minimal)
            assertEq(t, 'ok')
            assert(typeof v !== 'string' && !Array.isArray(v), ['expected the validated document', v])
            assertEq(/** @type {OneZeroNineNineG} */ (v).box10Through11, undefined)
        },
    },

    minimalValidates: () => {
        const [t] = validate(minimal)
        assertEq(t, 'ok')
    },

    /** The real-transcript shape — unemployment plus withholding — validates. */
    unemploymentWithWithholdingValidates: () => {
        const [t, v] = validate(unemploymentWithWithholding)
        assertEq(t, 'ok')
        assert(t === 'ok' && v.box1UnemploymentCompensation === '4554.00', ['box 1 round-trips', v])
        assert(t === 'ok' && v.box4FederalIncomeTaxWithheld === '454.00', ['box 4 round-trips', v])
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
     * `'box1UnemploymentCompensation' in value` a meaningful question for a
     * caller, rather than every document arriving pre-populated with zeros.
     */
    absentBoxesAreNotRefusals: () => {
        const [t, v] = validate(minimal)
        assertEq(t, 'ok')
        assert(t === 'ok' && !('box1UnemploymentCompensation' in v), ['absent box must stay absent', v])
        assert(t === 'ok' && !('box2StateOrLocalIncomeTaxRefunds' in v), ['absent box must stay absent', v])
    },

    /** DOC-12's checkbox convention: `false` is structurally rejected. */
    box8FalseIsStructurallyRejected: () => {
        const [t] = validate({ ...minimal, box8TradeOrBusinessIncome: false })
        assertEq(t, 'error')
    },

    box8TrueIsAccepted: () => {
        const [t] = validate({ ...minimal, box8TradeOrBusinessIncome: true })
        assertEq(t, 'ok')
    },

    /**
     * State withholding is stored and NOT refused, unlike the other unmodeled
     * boxes — it never reaches a federal return, so having no computation for
     * it is correct rather than a gap. **It is stored WITH the state it was
     * withheld for**, which is the part that makes that reasoning hold: an
     * amount with no state attached is of no use to the state return the
     * storage is justified by.
     */
    stateWithholdingIsStoredWithItsStateNotRefused: () => {
        const [t, v] = validate({
            ...minimal,
            box10Through11: [{ state: 'CA', stateIncomeTaxWithheld: '250.00' }],
        })
        assertEq(t, 'ok')
        assert(t === 'ok' && v.box10Through11?.[0]?.stateIncomeTaxWithheld === '250.00', [v])
        assert(t === 'ok' && v.box10Through11?.[0]?.state === 'CA', [v])
    },

    /** A blob tagged as another dialect is rejected structurally, on `dialect`. */
    otherDialectRejected: () => {
        const [t] = validate({ ...minimal, dialect: 'vnd.fjs.1099int' })
        assertEq(t, 'error')
    },
}
