/**
 * `vnd.fjs.1099int` — the 1099-INT form schema (DOC-04's schema half; the
 * OCR-string -> canonical-decimal-string conversion itself is Plan 05-03's
 * job, not this file's).
 *
 * Follows the `fjs/media/revision` four-stage template: dialect -> mediaType
 * -> schema -> structural validate -> semantic `checkReferences` -> composed
 * `validate`.
 *
 * Field groups:
 * - Identity/subject-key fields (`payerTin`, `recipientTin`, `accountNumber`,
 *   `taxYear`) are REQUIRED — DOC-01 roots a form subject on these four plus
 *   `formType`, so a typed instance without them is not meaningfully
 *   addressable. `accountNumber` may be an empty string (a form with no
 *   printed account number) but the key itself is always present.
 * - `formRevision` is REQUIRED — DOC-10: box semantics drift between
 *   revisions of the same printed form, so the revision (never derived from
 *   `taxYear`) travels with every stored instance. Non-empty is a semantic
 *   check (`checkReferences`), not expressible structurally.
 * - `corrected` is `option(true)` — DOC-12, mirrors `fjs/media/revision`'s
 *   `archived: option(true)` exactly: present-and-`true` means the printed
 *   CORRECTED box was checked; the key absent means it was not. `false` is
 *   never a valid member of this schema — a `corrected: false` blob is
 *   rejected structurally, before `checkReferences` ever runs.
 * - Money boxes are each `option(string)` — DOC-11: blank is not zero, so a
 *   box the form left empty is modeled by the key's absence, never by a `"0"`
 *   or `0` value standing in for "not printed". Present values are the
 *   post-conversion canonical decimal strings this schema itself owns (never
 *   comma-grouped OCR strings — that conversion happens once, upstream, on
 *   Plan 05-03's revision boundary); `checkReferences` re-parses every
 *   present box through `fjs/exact`'s exact decimal parser to enforce this.
 * - `payerName`/`recipientName` are optional identity labels — DOC-01: human
 *   labels live inside snapshots, never inside subjects, so they live on this
 *   schema, never in `fjs/document/subject`.
 *
 * Not modeling all seventeen 1099-INT boxes is a deliberate MVP scope
 * choice (YAGNI): DOC-00's base/spread design means adding more boxes later
 * is a non-breaking, localized change to this one file, not a reopening of
 * the shared base.
 *
 * ## Box 9 is INSIDE box 8, and that is a checked invariant
 *
 * `box9SpecifiedPrivateActivityBondInterest` is the §57(a)(5) alternative
 * minimum tax preference item — municipal bond interest that the regular tax
 * excludes and the AMT adds straight back, on Form 6251 line 2g. The printed
 * form's own box 9 caption is *"Specified private activity bond interest"* and
 * its instruction reads *"shows tax-exempt interest subject to the alternative
 * minimum tax. **This amount is included in box 8.**"*
 *
 * So the two boxes are not independent readings: box 9 is a COMPONENT of box 8,
 * and a document whose box 9 exceeds its box 8 is internally inconsistent —
 * refused by {@link checkReferences}, quoting BOTH figures, exactly as
 * `fjs/document/ira` refuses a Form 8606 line 4 exceeding line 1 for the same
 * structural reason. The absent cases follow DOC-11 rather than arithmetic:
 * box 9 present with box 8 absent is inconsistent (a component of nothing),
 * both absent is the ordinary case, and box 8 present with box 9 absent is the
 * ordinary MUNICIPAL case — the payer's determination that none of it is
 * private-activity.
 *
 * **The subset relationship is also why nothing here changes 1040 line 2a.**
 * That line reads box 8, box 9 is already inside box 8, and adding box 9 as a
 * second summand anywhere in the REGULAR tax would count the same interest
 * twice. Box 9 therefore has exactly one reader, in the ALTERNATIVE minimum
 * tax — `fjs/form6251` line 2g — and `fjs/form1040/core` is where the
 * no-double-count property is asserted rather than assumed, because that is
 * the one module where both lines are visible at once.
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
import { centsFromString } from '../../exact/module.f.js'
import { dialect as ocrDialect, ocrSchema, validate as ocrValidate } from '../ocr/module.f.js'

/** @import { Result } from 'functionalscript/fjs/types/result/types.js' */
/** @import { Ts, Unknown } from 'functionalscript/fjs/types/rtti/ts/types.js' */
/** @import { ValidationError } from 'functionalscript/fjs/types/rtti/common/types.js' */
/** @import { SubjectKey } from '../subject/module.f.js' */

/**
 * Format tag: names the dialect of this BLOB. The media type it is served
 * with is derived mechanically: `application/` + `dialect` + `+json`.
 */
export const dialect = 'vnd.fjs.1099int'
/** The media type derived from {@link dialect}: `application/vnd.fjs.1099int+json`. */
export const mediaType = mediaTypeOf(dialect)

/**
 * rtti schema for a `1099int` BLOB. `dialect` is spread first (via `base`)
 * so structural validation reports it as the first failing field on a
 * mismatched blob (DOC-00's criterion-1 discriminant) — see Task 3's
 * cross-dialect proof.
 */
export const oneZeroNineNineIntSchema = open({
    ...base(dialect),
    payerTin: string,
    recipientTin: string,
    accountNumber: string,
    taxYear: number,
    formRevision: string,
    corrected: option(true),
    box1InterestIncome: option(string),
    box2EarlyWithdrawalPenalty: option(string),
    box3UsSavingsBondsAndTreasuryInterest: option(string),
    box4FederalIncomeTaxWithheld: option(string),
    box6ForeignTaxPaid: option(string),
    box8TaxExemptInterest: option(string),
    box9SpecifiedPrivateActivityBondInterest: option(string),
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

/** @typedef {Ts<typeof oneZeroNineNineIntSchema>} OneZeroNineNineInt */

/** Structural-only validator: checks the shape, not the semantic refinements below. */
const validateShape = rttiValidate(oneZeroNineNineIntSchema)

/**
 * The seven money-box field names this MVP models, walked in a loop so the
 * `centsFromString` re-parse (DRY) is written once, not seven times. Typed via
 * `@type {const}` (not a wider `keyof OneZeroNineNineInt` annotation) so
 * `r[field]` below resolves to exactly `string | undefined` — every listed
 * field is `option(string)` — rather than the union of every field's type.
 */
export const moneyBoxFields = /** @type {const} */ ([
    'box1InterestIncome',
    'box2EarlyWithdrawalPenalty',
    'box3UsSavingsBondsAndTreasuryInterest',
    'box4FederalIncomeTaxWithheld',
    'box6ForeignTaxPaid',
    'box8TaxExemptInterest',
    'box9SpecifiedPrivateActivityBondInterest',
])

/**
 * {@link moneyBoxFields} widened to a plain string list — an ordinary widening
 * ASSIGNMENT, not a cast: the tuple's literal member types are a subtype of
 * `string`, so nothing is silenced. Same device, same reason, as
 * `fjs/return/scope`'s `modeledKindNames`.
 *
 * It exists so `theComparedBoxesAreBothWalkedByTheExactnessLoop` below can ask
 * whether a NAMED box is in the list. Asked of the tuple directly, the question
 * would be answered by `tsc` instead of at run time: a box dropped from the
 * list stops being a member of the argument type, so the proof would fail to
 * COMPILE and the mutation that removes it could never be run against the
 * suite (AGENTS.md: "a mutation must still typecheck").
 * @type {readonly string[]}
 */
const moneyBoxFieldNames = moneyBoxFields

/**
 * Either a structural validation error or a semantic (string) error message.
 * @typedef {ValidationError | string} OneZeroNineNineIntError
 */

/**
 * Checks the semantic refinements the structural schema can't express on an
 * already shape-valid `1099int` value:
 * - `formRevision` (DOC-10) must not be empty or whitespace-only.
 * - Every PRESENT money box (DOC-11 — absent boxes are skipped, never
 *   defaulted) must parse via `fjs/exact`'s `centsFromString` — a
 *   comma-grouped or otherwise non-canonical string is rejected here, not
 *   silently coerced (`centsFromString` throws via `assert`, so each call is
 *   wrapped in try/catch and the throw is converted to an `error(...)`,
 *   never left to escape `validate`). The resulting bigint magnitude must be
 *   within `Number.MAX_SAFE_INTEGER`, compared bigint-to-bigint — never
 *   converted through `Number()`, which would reintroduce the precision
 *   hazard `fjs/types/decimal`'s docstring warns about.
 * - **Box 9 does not exceed box 8, and is not present without it.** Box 9 is a
 *   COMPONENT of box 8 by the printed instruction's own words ("This amount is
 *   included in box 8"), so neither shape is a document a payer could have
 *   issued. The refusal quotes BOTH figures, because a reader holding the form
 *   needs to see which of the two is wrong; `fjs/document/ira`'s Form 8606
 *   line 4/line 1 check is the precedent, and it is the same invariant one
 *   dialect over.
 * @type {(r: OneZeroNineNineInt) => Result<OneZeroNineNineInt, OneZeroNineNineIntError>}
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
    const box8 = r.box8TaxExemptInterest
    const box9 = r.box9SpecifiedPrivateActivityBondInterest
    if (box9 !== undefined) {
        if (box8 === undefined) {
            return error(
                `box9SpecifiedPrivateActivityBondInterest (${box9}) is present without `
                + `box8TaxExemptInterest — the printed box 9 instruction is "this amount is `
                + `INCLUDED IN BOX 8", so it cannot exist on its own`)
        }
        if (centsFromString(box9) > centsFromString(box8)) {
            return error(
                `box9SpecifiedPrivateActivityBondInterest (${box9}) exceeds `
                + `box8TaxExemptInterest (${box8}) — box 9 is a SUBSET of box 8, the `
                + `§57(a)(5) private-activity part of the same tax-exempt interest, so this `
                + `document is internally inconsistent`)
        }
    }
    return ok(r)
}

/**
 * Validates an already-parsed JSON value as a `1099int` BLOB: structural
 * (rtti) validation followed by the semantic checks in {@link checkReferences}.
 *
 * Success Criterion 1 (structural-only rejection): dialect discrimination
 * here happens exclusively through `validateShape`'s exact-literal match on
 * `oneZeroNineNineIntSchema`'s `dialect` member — an ALREADY-PARSED value's `dialect`
 * field is compared as a schema constant, the same machinery that checks
 * every other field. Neither this function, `checkReferences`, nor any
 * other code in this file or `fjs/document/ocr/module.f.js` ever inspects
 * the serialized JSON text itself (no prefix/substring probe of any kind on
 * the raw `'{"dialect":...'` bytes) to decide a dialect — see
 * `proof.crossDialect` below for the runtime proof (Task 3), and this
 * module's `<verify>` grep gate for the static guarantee that no such
 * shortcut has been (re-)introduced.
 * @type {(value: Unknown) => Result<OneZeroNineNineInt, OneZeroNineNineIntError>}
 */
export const validate = value => {
    const [t, v] = validateShape(value)
    if (t === 'error') {
        return error(v)
    }
    return checkReferences(v)
}

// ── Tests ────────────────────────────────────────────────────────────────────

/** @type {OneZeroNineNineInt} */
const minimal = {
    dialect,
    payerTin: '11-1111111',
    recipientTin: '222-22-2222',
    accountNumber: 'ACC-0001',
    taxYear: 2024,
    formRevision: '2024',
}

/**
 * T-09-08-02: a money box's name could be quietly dropped from
 * {@link moneyBoxFields} without anyone noticing — the field stays
 * `option(string)` structurally, so a comma-grouped or otherwise inexact
 * amount in a dropped box would then validate as ok. One generated leaf per
 * NAMED box supplies a comma-grouped value to that box alone and asserts
 * `validate` refuses, built by mapping {@link moneyBoxFields} itself into
 * `[field, assertion]` pairs (never as seven hand-written near-identical
 * leaves) — the same idiom `fjs/tax/boundary`'s generated threshold leaves
 * use — so a box added to the list later is covered automatically.
 *
 * A box's own generated leaf disappears WITH it if the box is dropped from
 * the list, so this alone cannot catch a removal — {@link
 * expectedMoneyBoxFieldCount} below pairs it with an independently
 * hand-typed count, exactly as `fjs/tax/boundary`'s `expectedThresholdCount`
 * guards `allThresholds`. The duplication is the mechanism (AGENTS.md: "a
 * proof's expected value must not be produced by the code under test").
 *
 * **Every fixture carries a real `box8TaxExemptInterest`, and box 9 is why.**
 * Written against `minimal` alone, box 9's own generated leaf would have
 * refused for the WRONG REASON — the box-9-without-box-8 check below, not the
 * exactness loop — so it would have passed with box 9 absent from
 * {@link moneyBoxFields} entirely, which is exactly the coverage this whole
 * construction exists to provide. The companion box 8 makes each fixture
 * internally consistent, so the ONLY thing wrong with it is the comma. For
 * `field === 'box8TaxExemptInterest'` the computed key is written last and
 * wins, so that box's own leaf is unaffected.
 * @type {{ readonly [field: string]: () => void }}
 */
const generatedMoneyBoxExactnessProof = Object.fromEntries(
    moneyBoxFields.map(field => [
        field,
        () => {
            const [t, v] = validate({
                ...minimal,
                box8TaxExemptInterest: '99999.00',
                [field]: '1,234.56',
            })
            assertEq(t, 'error', ['expected a comma-grouped amount in this box to be refused', field, t, v])
        },
    ]),
)

/**
 * Independently hand-typed: the number of money boxes {@link moneyBoxFields}
 * is expected to name today. Deliberately NOT derived from
 * `moneyBoxFields.length` — if it were, dropping a box from the list would
 * shrink both sides together and this check could never fail.
 *
 * `6 -> 7` is box 9, the §57(a)(5) specified private activity bond interest
 * Form 6251 line 2g reads.
 * @type {number}
 */
const expectedMoneyBoxFieldCount = 7

export const proof = {
    dialectAndMediaType: () => {
        assertEq(dialect, 'vnd.fjs.1099int')
        assertEq(mediaType, 'application/vnd.fjs.1099int+json')
    },
    validate: {
        fullyPopulatedValidates: () => {
            const [t] = validate({
                ...minimal,
                corrected: true,
                box1InterestIncome: '1234.56',
                box2EarlyWithdrawalPenalty: '0.00',
                box3UsSavingsBondsAndTreasuryInterest: '10.00',
                box4FederalIncomeTaxWithheld: '5.00',
                box6ForeignTaxPaid: '1.00',
                box8TaxExemptInterest: '2.00',
                // Inside box 8, per the printed instruction — $1.00 of the
                // $2.00 of tax-exempt interest is private-activity.
                box9SpecifiedPrivateActivityBondInterest: '1.00',
                payerName: 'Some Bank',
                recipientName: 'Some Person',
            })
            assertEq(t, 'ok')
        },
        // DOC-11: omitting every money box and `corrected` is structurally
        // valid — a blank box is absent, not zero.
        blankBoxesOmittedValidates: () => {
            const [t, v] = validate(minimal)
            assert(t === 'ok', ['expected ok', t, v])
            assertEq(v.box1InterestIncome, undefined)
            assertEq(v.corrected, undefined)
            // Box 9 absent alongside box 8 absent is the ORDINARY case, not
            // the inconsistent one — a filer with no tax-exempt interest at
            // all. Asserted here so the subset invariant below cannot be
            // written in a form that refuses it.
            assertEq(v.box9SpecifiedPrivateActivityBondInterest, undefined)
        },
        // DOC-12: `corrected: false` is not a valid member of `option(true)`
        // — rejected structurally, never accepted as "not corrected".
        correctedFalseRejected: () => {
            const [t] = validate({ ...minimal, corrected: false })
            assertEq(t, 'error')
        },
        // Wrong dialect: structural rejection, `dialect` first.
        wrongDialectRejected: () => {
            const [t, v] = validate({ ...minimal, dialect: 'vnd.fjs.wrong' })
            assert(t === 'error', ['expected error', t, v])
            assert(typeof v !== 'string', ['expected a structural ValidationError, got a checkReferences string', v])
            assertEq(v.path[0], 'dialect')
        },
    },
    checkReferences: {
        emptyFormRevisionRejected: () => {
            const [t] = validate({ ...minimal, formRevision: '' })
            assertEq(t, 'error')
        },
        whitespaceFormRevisionRejected: () => {
            const [t] = validate({ ...minimal, formRevision: '   ' })
            assertEq(t, 'error')
        },
        // A money box string containing a comma is not this schema's
        // canonical form — Plan 05-03's job normalizes OCR strings before
        // they ever reach this schema.
        commaGroupedRejected: () => {
            const [t] = validate({ ...minimal, box1InterestIncome: '1,234.56' })
            assertEq(t, 'error')
        },
        canonicalMoneyBoxAccepted: () => {
            const [t] = validate({ ...minimal, box1InterestIncome: '1234.56' })
            assertEq(t, 'ok')
        },
        // T-09-08-02: every money box named in `moneyBoxFields` is proven to
        // actually be walked by the exactness loop, not merely assumed
        // because `box1InterestIncome` happens to be covered above.
        moneyBoxExactness: {
            ...generatedMoneyBoxExactnessProof,
            everyMoneyBoxIsCovered: () => {
                assertEq(
                    moneyBoxFields.length,
                    expectedMoneyBoxFieldCount,
                    [
                        'expected exactly the independently-stated money box count',
                        moneyBoxFields.length,
                        expectedMoneyBoxFieldCount,
                    ],
                )
            },
        },
        // BOX 9 IS INSIDE BOX 8, and this group is the invariant that says so.
        // §57(a)(5) makes box 9 an alternative minimum tax preference item and
        // the printed instruction makes it a COMPONENT of box 8 ("this amount
        // is included in box 8"), so the two are one reading and its part —
        // never two independent figures. `fjs/document/ira`'s Form 8606 line
        // 4/line 1 group is the precedent this mirrors leaf for leaf.
        boxNineIsInsideBoxEight: {
            exceedingBoxEightIsRefusedQuotingBothFigures: () => {
                const [t, v] = validate({
                    ...minimal,
                    box8TaxExemptInterest: '5000.00',
                    box9SpecifiedPrivateActivityBondInterest: '5000.01',
                })
                assertEq(t, 'error')
                assert(typeof v === 'string', ['expected a semantic string refusal', v])
                // BOTH figures, each searched for separately: a reader holding
                // the form has to be able to see which of the two is wrong,
                // and a message quoting only one of them names a violation
                // without showing it.
                assert(v.includes('5000.01'), ['the refusal must quote box 9', v])
                assert(v.includes('5000.00'), ['the refusal must quote box 8', v])
                assert(
                    v.includes('SUBSET'),
                    ['the refusal must say WHY the pair is impossible', v])
                assert(
                    v.includes('§57(a)(5)'),
                    ['the refusal must name the provision that makes box 9 mean something', v])
            },
            // EQUALITY is the ordinary case, not the boundary violation: a
            // filer holding one private-activity bond and nothing else has box
            // 9 exactly equal to box 8. This is the ±1¢ partner of the leaf
            // above, and it is what catches `>` silently becoming `>=` —
            // which would refuse that entirely ordinary document.
            equalToBoxEightIsAccepted: () => {
                const [t, v] = validate({
                    ...minimal,
                    box8TaxExemptInterest: '5000.00',
                    box9SpecifiedPrivateActivityBondInterest: '5000.00',
                })
                assert(t === 'ok', ['the whole of box 8 may be private-activity', t, v])
                assertEq(v.box9SpecifiedPrivateActivityBondInterest, '5000.00')
            },
            oneCentUnderBoxEightIsAccepted: () => {
                const [t] = validate({
                    ...minimal,
                    box8TaxExemptInterest: '5000.00',
                    box9SpecifiedPrivateActivityBondInterest: '4999.99',
                })
                assertEq(t, 'ok')
            },
            // DOC-11 at the invariant: box 9 present with box 8 ABSENT is a
            // component of nothing, which is a different inconsistency from
            // exceeding it and gets its own message. Absent is not zero, so
            // this cannot be folded into the comparison above by defaulting.
            withoutBoxEightAtAllIsRefused: () => {
                const [t, v] = validate({
                    ...minimal,
                    box9SpecifiedPrivateActivityBondInterest: '100.00',
                })
                assertEq(t, 'error')
                assert(typeof v === 'string', ['expected a semantic string refusal', v])
                assert(v.includes('100.00'), ['the refusal must quote box 9', v])
                assert(
                    v.includes('INCLUDED IN BOX 8'),
                    ['the refusal must quote the printed instruction it rests on', v])
            },
            // …and a present box 9 of ZERO still needs box 8, because DOC-11
            // makes "printed 0.00" a real reading rather than an absence. A
            // payer who printed a zero in box 9 printed something in box 8.
            aZeroBoxNineStillNeedsBoxEight: () => {
                assertEq(
                    validate({
                        ...minimal,
                        box9SpecifiedPrivateActivityBondInterest: '0.00',
                    })[0],
                    'error')
                assertEq(
                    validate({
                        ...minimal,
                        box8TaxExemptInterest: '0.00',
                        box9SpecifiedPrivateActivityBondInterest: '0.00',
                    })[0],
                    'ok')
            },
            // THE CONTROL, and the case that matters most because it is the
            // common one: box 8 WITHOUT box 9 is the ordinary municipal bond
            // holder, whose tax-exempt interest is not private-activity at
            // all. A gate that refused this would refuse nearly every muni
            // return (AGENTS.md: "a gate needs a control").
            boxEightAloneIsTheOrdinaryMunicipalCase: () => {
                const [t, v] = validate({ ...minimal, box8TaxExemptInterest: '5000.00' })
                assert(t === 'ok', ['a muni holder with no private-activity bonds', t, v])
                assertEq(v.box8TaxExemptInterest, '5000.00')
                assertEq(v.box9SpecifiedPrivateActivityBondInterest, undefined)
            },
            // The invariant's own precondition, stated rather than left to the
            // reading order of `checkReferences`: the comparison re-parses two
            // printed strings through `centsFromString`, which THROWS on an
            // inexact value, and what keeps that throw from escaping
            // `validate` is that the exactness loop has already refused both
            // boxes. Both field names are therefore in `moneyBoxFields`, and
            // that is a fact worth checking rather than assuming — dropping
            // either from the list is what would turn this module's graceful
            // refusal into a bare throw.
            theComparedBoxesAreBothWalkedByTheExactnessLoop: () => {
                assert(
                    moneyBoxFieldNames.includes('box8TaxExemptInterest'),
                    'the subset check re-parses box 8, so the exactness loop must have refused it first')
                assert(
                    moneyBoxFieldNames.includes('box9SpecifiedPrivateActivityBondInterest'),
                    'the subset check re-parses box 9, so the exactness loop must have refused it first')
            },
        },
    },
    // Task 3 — Success Criteria 1 and 2's runtime evidence.
    crossDialect: {
        // Success Criterion 1: a fully-valid `vnd.fjs.ocr` value, constructed
        // as a PARSED JS OBJECT (never a JSON string — proves rejection is
        // structural, not text/prefix-based), fails `1099int`'s `validate`,
        // and the failure's `path` is exactly `['dialect']` — the
        // discriminant catches it first, not some unrelated missing field.
        ocrShapeRejectedByOneZeroNineNineInt: () => {
            /** @type {Ts<typeof ocrSchema>} */
            const ocrValue = {
                dialect: ocrDialect,
                pages: ['Form 1099-INT, Box 1 Interest income: 1,234.56'],
                fields: { 'Box 1 Interest income': '1,234.56' },
            }
            const [t, v] = validate(ocrValue)
            assert(t === 'error', ['expected error', t, v])
            assert(typeof v !== 'string', ['expected a structural ValidationError, got a checkReferences string', v])
            assertEq(v.path.length, 1)
            assertEq(v.path[0], 'dialect')
        },
        // Reverse direction (bonus, not required by the roadmap): a valid
        // `1099int` value fails `ocr`'s `validate` the same way — free given
        // the same fixtures, strengthens the evidence that the discriminant
        // works symmetrically.
        oneZeroNineNineIntShapeRejectedByOcr: () => {
            const [t, v] = ocrValidate({ ...minimal, corrected: true })
            assert(t === 'error', ['expected error', t, v])
            assertEq(v.path[0], 'dialect')
        },
    },
}
