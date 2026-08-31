/**
 * `vnd.fjs.basis_correction` — TAX-34: the taxpayer's ASSERTION that the cost
 * basis a broker reported on one specific Form 1099-B is wrong, and what the
 * correct basis is.
 *
 * This is the document that closes the **double-taxation** hole. Its whole
 * reason to exist is one sentence from the printed Instructions for Form 8949
 * (2025), fetched and read directly (2026-08-16), under *Column (e)*:
 *
 * > For compensatory options granted after 2013, the basis information
 * > reported to you on Form 1099-B ... won't reflect any amount you included
 * > in income upon grant or exercise of the option. Increase your basis by any
 * > amount you included in income upon grant or exercise of the option.
 *
 * The same is true, and far more common, for restricted stock units: the value
 * of the shares at vesting is compensation, it is inside Form W-2 box 1, tax
 * has already been withheld on it — and §6045's basis-reporting rules leave
 * the broker reporting the employee's own cash outlay, which for an RSU is
 * **zero**. A return that reads box 1e as printed therefore taxes the vested
 * value a SECOND time, as a capital gain, and every line of the return looks
 * right while it does so. That is the largest silent overstatement this engine
 * has found, and it lands on essentially every equity-compensated employee.
 *
 * ## Why a document of its own, and not a field on `vnd.fjs.1099b`
 *
 * A Form 1099-B is what a BROKER said. This is what the TAXPAYER says the
 * broker got wrong. Putting the correction inside the transcribed dialect
 * would put a taxpayer assertion into a payer document, which is the one
 * boundary this repository gates at the test level (`payer-report-gate`,
 * `fjs/report/payer` reaching nothing under `fjs/tax`): a transcription must
 * stay a transcription, or nothing downstream can tell which figures came off
 * the paper. `vnd.fjs.itemized_deductions`, `vnd.fjs.medical_expenses`,
 * `vnd.fjs.business_expenses` and `vnd.fjs.prior_year_capital_loss` are the
 * four taxpayer-asserted dialects this one joins.
 *
 * ## `brokerageDocumentHash` — the first dialect in this tree to reference
 * another stored DOCUMENT
 *
 * Every other cross-reference here points at an ARTIFACT (`sourceArtifactHash`,
 * DOC-13 — the scan a transcription came from). This one points at a
 * DOCUMENT: the CAS hash of the `vnd.fjs.1099b` whose box 1e is wrong. That is
 * a deliberate choice over the three alternatives, each of which was rejected
 * for a reason:
 *
 * - **Match by CUSIP or by description.** `box1aDescriptionOfProperty` is free
 *   text and `cusipNumber` is optional; two lots of the same security sold on
 *   different days are two Forms 1099-B with the same CUSIP and different
 *   correct bases. A key that cannot distinguish them would silently apply one
 *   correction to both.
 * - **Match by account and date.** Same problem, one field over, plus this
 *   project has no date primitive.
 * - **One correction record per taxpayer, holding a list.** That is the
 *   `vnd.fjs.itemized_deductions` shape, and it would work — but it makes the
 *   revision history of one lot's correction inseparable from every other
 *   lot's, and `formSubject` would give the whole list one subject.
 *
 * The hash is exact, it is what a caller already holds after `cas_put`, and it
 * makes an unmatched correction DETECTABLE — which is the half that matters:
 * `fjs/form8949` REFUSES a correction naming a document that is not among the
 * brokerage forms supplied, rather than silently dropping the taxpayer's
 * assertion. An assertion that is ignored is worse than one that is refused,
 * because the return then looks computed.
 *
 * ## What is asserted is the BASIS, never the adjustment
 *
 * The stored field is `correctedCostOrOtherBasis` — the correct basis — not a
 * column (g) adjustment amount. Two reasons, and the second is the one that
 * decided it:
 *
 * 1. The correct basis is a fact the taxpayer can look up (the vesting-date
 *    value on their equity statement, or Form 3921 box 4 x box 5). A column
 *    (g) adjustment is an artefact of a form's layout.
 * 2. **Which of the two the printed form wants depends on a box the taxpayer
 *    does not control.** i8949.pdf's *Worksheet for Basis Adjustments in
 *    Column (g)*: if the basis was NOT reported to the IRS (box 12 unchecked,
 *    Form 8949 category B or E) you enter the CORRECT basis in column (e) and
 *    zero in column (g); if it WAS reported (category A or D) you enter the
 *    REPORTED basis in column (e) and the difference in column (g). Same
 *    taxpayer fact, two different printed presentations. Storing the fact and
 *    letting `fjs/form8949` derive the presentation is what keeps the
 *    derivation mechanical — and it is the reason this dialect needs no code
 *    field at all: Form 8949's column (f) code `B` is DERIVED from the
 *    presence of a correction, never asserted here.
 *
 * ## The basis may be zero, and may not be negative
 *
 * `correctedCostOrOtherBasis` is a REQUIRED field — a correction document that
 * exists but does not say what the basis is has nothing to assert, and
 * `vnd.fjs.prior_year_capital_loss`'s own header argues that case in full. A
 * correct basis of `'0.00'` is legitimate (a genuine zero-basis lot), which is
 * why the field is required rather than merely non-zero. A NEGATIVE basis is
 * refused by name: `moneyFieldError` accepts negatives, correctly, because
 * Form 1099-B boxes 8-11 are profit-or-loss boxes — but there is no such thing
 * as a negative cost, and accepting one would let a crafted document
 * manufacture a capital loss out of nothing.
 *
 * ## `reason` is REQUIRED free text, and it is not decoration
 *
 * The printed Form 8949 has no field for it, and no computation reads it. It
 * is required because a basis correction is an assertion against a
 * third-party information return that the IRS also holds a copy of, and the
 * one thing a taxpayer will need if it is questioned is the sentence saying
 * why. Making it required costs a transcriber one field and makes the report
 * able to print it beside the adjustment.
 *
 * ## No `formRevision`, for the reason `medical_expenses` has none
 *
 * DOC-10 exists because box semantics drift between revisions of a printed
 * INFORMATION RETURN. This is not one: there is no printed Form
 * "basis correction", no payer, and no revision to cite.
 *
 * @module
 */
import { number, open, string } from 'functionalscript/fjs/types/rtti/module.f.mjs'
import { validate as rttiValidate } from 'functionalscript/fjs/types/rtti/validate/module.f.mjs'
import { error, ok } from 'functionalscript/fjs/types/result/module.f.mjs'
import { assert, assertEq } from 'functionalscript/fjs/asserts/module.f.mjs'
import { base, mediaTypeOf } from '../base/module.f.js'
import { moneyFieldError } from '../money_field/module.f.js'
import { centsFromString } from '../../exact/module.f.js'
import { declaredMembers } from '../../document/base/module.f.js'

/** @import { Result } from 'functionalscript/fjs/types/result/types.js' */
/** @import { Ts, Unknown } from 'functionalscript/fjs/types/rtti/ts/types.js' */
/** @import { ValidationError } from 'functionalscript/fjs/types/rtti/common/types.js' */
/** @import { SubjectKey } from '../subject/module.f.js' */

/**
 * Format tag: names the dialect of this BLOB. The media type it is served
 * with is derived mechanically: `application/` + `dialect` + `+json`.
 */
export const dialect = 'vnd.fjs.basis_correction'
/** The media type derived from {@link dialect}: `application/vnd.fjs.basis_correction+json`. */
export const mediaType = mediaTypeOf(dialect)

/**
 * rtti schema for a `basis_correction` BLOB.
 *
 * **Every field is REQUIRED.** A correction that does not name the document it
 * corrects, does not say what the correct basis is, or does not say why, has
 * nothing to assert — `vnd.fjs.prior_year_capital_loss`'s own "a document that
 * exists carries every fact, or it does not exist at all" argument, applied to
 * a smaller document. There is no `option` field here at all, and that
 * absence is the design rather than an omission.
 *
 * `taxYear` is the year of the SALE — the year of the return this correction
 * applies to — not the year the shares were acquired. It is checked against
 * the run's year by the same mixed-year guard every other dialect passes
 * through in `fjs/report/tax_return`.
 */
export const basisCorrectionSchema = open({
    ...base(dialect),
    recipientTin: string,
    taxYear: number,
    brokerageDocumentHash: string,
    correctedCostOrOtherBasis: string,
    reason: string,
})

/**
 * FORM-KEY-01 -- which of THIS dialect's OWN fields play the five roles a
 * form subject is keyed on. See `fjs/document/subject`'s {@link SubjectKey}
 * for why the dialect declares this instead of every caller assuming one
 * shared set of field names.
 *
 * No payer and no account role: this dialect has no such field, and an omitted role
 * derives the empty string -- exactly the `payerTin: ''` /
 * `accountNumber: ''` this dialect's subject has carried since DOC-01.
 * @type {SubjectKey}
 */
export const subjectKey = { formType: 'dialect', taxYear: 'taxYear', recipient: 'recipientTin' }

/** @typedef {Ts<typeof basisCorrectionSchema>} BasisCorrection */

/** Structural-only validator: checks the shape, not the semantic refinements below. */
const validateShape = rttiValidate(basisCorrectionSchema)

/**
 * Either a structural validation error or a semantic (string) error message.
 * @typedef {ValidationError | string} BasisCorrectionError
 */

/**
 * Checks the semantic refinements the structural schema cannot express:
 * - `brokerageDocumentHash` must not be empty or whitespace-only. It is NOT
 *   checked with `isHash`, and that is deliberate: `sourceArtifactHash` names
 *   an artifact this project itself hashed with `fjs/media/revision`'s cBase32
 *   encoding, while this names whatever the CAS layer handed the caller back,
 *   and pinning an encoding here would put a second statement of the CAS hash
 *   format in a dialect that has no business owning one. What DOES check the
 *   reference is `fjs/form8949`, which refuses a correction whose hash matches
 *   no supplied Form 1099-B — a real referential check against real documents,
 *   rather than a format check that would pass for a well-formed hash of
 *   nothing.
 * - `correctedCostOrOtherBasis` is an exact decimal within safe magnitude, and
 *   is NOT negative.
 * - `reason` must not be empty or whitespace-only.
 * @type {(r: BasisCorrection) => Result<BasisCorrection, BasisCorrectionError>}
 */
export const checkReferences = r => {
    if (r.brokerageDocumentHash.trim() === '') {
        return error(`brokerageDocumentHash must not be empty or whitespace-only`)
    }
    const message = moneyFieldError('correctedCostOrOtherBasis')(r.correctedCostOrOtherBasis)
    if (message !== undefined) {
        return error(message)
    }
    if (centsFromString(r.correctedCostOrOtherBasis) < 0n) {
        return error(
            `correctedCostOrOtherBasis is negative: ${r.correctedCostOrOtherBasis}. `
            + `A cost basis cannot be below zero; a lot with no cost is '0.00'.`)
    }
    if (r.reason.trim() === '') {
        return error(
            `reason must not be empty or whitespace-only: a basis correction contradicts a `
            + `third-party information return the IRS also holds, so the assertion has to `
            + `carry the sentence that explains it`)
    }
    return ok(r)
}

/**
 * Validates an already-parsed JSON value as a `basis_correction` BLOB:
 * structural (rtti) validation followed by the semantic checks in
 * {@link checkReferences}.
 * @type {(value: Unknown) => Result<BasisCorrection, BasisCorrectionError>}
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
 * THE RSU CASE, as a fixture: 1,000 shares vested at $150.00, all of it
 * already inside Form W-2 box 1 and already withheld on, sold the same day for
 * $150,000.00 — and the broker reported a basis of $0.00 because $0.00 is what
 * the employee paid. Without this document the return reports a $150,000.00
 * short-term capital gain on income that was already taxed as wages.
 * @type {BasisCorrection}
 */
const rsuSameDaySale = {
    dialect,
    recipientTin: '222-22-2222',
    taxYear: 2025,
    brokerageDocumentHash: 'sha256-rsu-vest-and-sell',
    correctedCostOrOtherBasis: '150000.00',
    reason: 'RSU vesting: 1,000 shares at $150.00 were included in Form W-2 box 1 as compensation, '
        + 'and the broker reported $0.00 basis because that is what the employee paid.',
}

/**
 * Asserts that a blob missing one required field fails STRUCTURAL validation
 * with a `ValidationError` naming that field — never a semantic string, which
 * would mean the field had become optional and the failure had moved into
 * {@link checkReferences}. Shared by the five leaves below so the distinction
 * between "missing" and "present but malformed" is stated once.
 * @type {(field: string) => (blob: Unknown) => void}
 */
const assertRequired = field => blob => {
    const [t, v] = validate(blob)
    assertEq(t, 'error', ['omitting this field must fail', field])
    if (t !== 'error') {
        throw ['expected error', field]
    }
    if (typeof v === 'string') {
        throw ['expected a structural ValidationError, not a semantic string', field, v]
    }
    assert(v.path.includes(field), ['the ValidationError must name the field', field, v])
}

export const proof = {
    dialectAndMediaType: () => {
        assertEq(dialect, 'vnd.fjs.basis_correction')
        assertEq(mediaType, 'application/vnd.fjs.basis_correction+json')
    },

    /** The motivating document validates and round-trips field for field. */
    theRsuCorrectionValidatesAndRoundTrips: () => {
        const [t, v] = validate(rsuSameDaySale)
        assert(t === 'ok', ['expected ok', t, v])
        if (t !== 'ok') {
            throw ['expected ok', t, v]
        }
        assertEq(v.brokerageDocumentHash, 'sha256-rsu-vest-and-sell')
        assertEq(v.correctedCostOrOtherBasis, '150000.00')
        assert(v.reason.includes('W-2 box 1'), ['the reason round-trips verbatim', v.reason])
    },

    /**
     * A GENUINE zero basis is accepted. This is the control that keeps the
     * negative-basis refusal below from being read as "any small basis is
     * suspicious": a taxpayer who really does have no cost in a lot asserts
     * `'0.00'`, and it must validate — otherwise the required field could
     * never express the case it exists for.
     */
    aZeroCorrectedBasisIsAccepted: () => {
        assertEq(validate({ ...rsuSameDaySale, correctedCostOrOtherBasis: '0.00' })[0], 'ok')
    },

    /**
     * A NEGATIVE basis is refused by name. `moneyFieldError` accepts negatives
     * — its own `negativeAccepted` leaf pins that, and Form 1099-B boxes 8-11
     * need it — so this refusal is this dialect's own, and it is the one that
     * stops a crafted document manufacturing a capital loss.
     */
    aNegativeCorrectedBasisIsRefusedNamingTheField: () => {
        const [t, v] = validate({ ...rsuSameDaySale, correctedCostOrOtherBasis: '-100.00' })
        assertEq(t, 'error')
        assert(typeof v === 'string' && v.includes('correctedCostOrOtherBasis'), [v])
        assert(typeof v === 'string' && v.includes('negative'), ['the refusal must say why', v])
    },

    inexactCorrectedBasisRefused: () => {
        const [t, v] = validate({ ...rsuSameDaySale, correctedCostOrOtherBasis: '150,000.00' })
        assertEq(t, 'error')
        assert(typeof v === 'string' && v.includes('correctedCostOrOtherBasis'), [v])
    },

    /**
     * The reason is REQUIRED and must carry something. Both the empty and the
     * whitespace-only forms are checked, since `''` and `'   '` fail different
     * halves of the same guard and only the second exercises the `.trim()`.
     */
    anEmptyOrWhitespaceReasonIsRefused: () => {
        const [empty, whyEmpty] = validate({ ...rsuSameDaySale, reason: '' })
        assertEq(empty, 'error')
        assert(typeof whyEmpty === 'string' && whyEmpty.includes('reason'), [whyEmpty])
        assertEq(validate({ ...rsuSameDaySale, reason: '   ' })[0], 'error')
    },

    anEmptyOrWhitespaceBrokerageDocumentHashIsRefused: () => {
        const [empty, whyEmpty] = validate({ ...rsuSameDaySale, brokerageDocumentHash: '' })
        assertEq(empty, 'error')
        assert(typeof whyEmpty === 'string' && whyEmpty.includes('brokerageDocumentHash'), [whyEmpty])
        assertEq(validate({ ...rsuSameDaySale, brokerageDocumentHash: '   ' })[0], 'error')
    },

    /**
     * EVERY field is required, so omitting any one is a STRUCTURAL failure
     * naming that field — never a semantic string, and never a silent default.
     *
     * Written as five explicit destructurings rather than a loop over field
     * NAMES, and that is `tsc`'s decision rather than a preference:
     * `validate` takes rtti's `Unknown`, and an `Object.fromEntries` over
     * filtered entries infers `{ [k: string]: unknown }`, which is not
     * assignable to it (TS2345). The compliant alternatives were a cast, which
     * AGENTS.md bans, or this — which is also what
     * `sourceArtifactHashRequired` already does one dialect over.
     */
    everyFieldIsRequired: {
        recipientTin: () => {
            const { recipientTin, ...without } = rsuSameDaySale
            assertRequired('recipientTin')(without)
        },
        taxYear: () => {
            const { taxYear, ...without } = rsuSameDaySale
            assertRequired('taxYear')(without)
        },
        brokerageDocumentHash: () => {
            const { brokerageDocumentHash, ...without } = rsuSameDaySale
            assertRequired('brokerageDocumentHash')(without)
        },
        correctedCostOrOtherBasis: () => {
            const { correctedCostOrOtherBasis, ...without } = rsuSameDaySale
            assertRequired('correctedCostOrOtherBasis')(without)
        },
        reason: () => {
            const { reason, ...without } = rsuSameDaySale
            assertRequired('reason')(without)
        },
        // The independent count: five required fields besides the dialect
        // tag. A sixth field added to the schema without a leaf above would
        // otherwise be uncovered, and a field quietly made `option` would take
        // its own leaf with it.
        thereAreExactlyFiveOfThem: () => {
            assertEq(Object.keys(declaredMembers(basisCorrectionSchema)).length, 6, 'five required fields plus `dialect`')
        },
    },

    /** A blob tagged as another dialect is rejected structurally, on `dialect`. */
    otherDialectRejected: () => {
        const [t, v] = validate({ ...rsuSameDaySale, dialect: 'vnd.fjs.1099b' })
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
