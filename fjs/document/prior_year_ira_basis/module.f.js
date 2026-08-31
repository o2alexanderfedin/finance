/**
 * `vnd.fjs.prior_year_ira_basis` — TAX-29: the ONE prior-year fact Form 8606
 * Part I needs and no current-year document can carry, the taxpayer's total
 * basis in traditional IRAs at the end of the prior year.
 *
 * ## Why a separate, deliberately PRIOR-YEAR document
 *
 * Form 8606's printed line 2 reads *"Enter your total basis in traditional
 * IRAs"*, and its instructions resolve that to a chart whose ordinary row
 * says: *"IF the last Form 8606 you filed was for a year after 2000 and
 * before 2024 … THEN enter on line 2 the amount from **line 14 of that Form
 * 8606**."* So line 2 is not a figure derived from anything in the current
 * year — it is a figure transcribed off the taxpayer's OWN prior-year return.
 *
 * This engine holds exactly one tax year. It cannot compute last year's Form
 * 8606 line 14 and it must not guess at it, because guessing zero is the
 * failure this requirement exists to close: **a basis read as zero taxes
 * after-tax money a second time.** The figure is therefore ASSERTED, in a
 * document whose own `taxYear` names the PRIOR year it came off.
 *
 * `vnd.fjs.prior_year_capital_loss` is the exact precedent — same shape, same
 * reasoning, same three consequences, and this module follows it rather than
 * re-arguing it:
 *
 * - **No `formRevision`.** DOC-10 exists because box semantics drift between
 *   revisions of a printed INFORMATION RETURN a payer files. This is not
 *   that: it is the taxpayer's own transcription off their own prior-year
 *   Form 8606. There is no payer and no information return.
 * - **`taxYear` names the PRIOR year**, e.g. `2024` on a TY2025 return —
 *   never the year of a form revision, and never the run's year.
 * - **Exempt BY NAME from Phase 21's mixed-year refusal.** `fjs/report
 *   /tax_return`'s `noteYearMismatch` refuses any routed document whose
 *   `taxYear` differs from the run's, with `vnd.fjs.prior_year_capital_loss`
 *   as its one stated exemption. This dialect needs the identical treatment
 *   for the identical reason — its year is SUPPOSED to differ — so it is the
 *   SECOND exemption, added there by name, and that module's own control leaf
 *   proves the exemption is real rather than assumed. **Checked rather than
 *   assumed:** without the exemption, storing a basis carry-forward would
 *   refuse every return that used one, which is worse than not modelling
 *   basis at all.
 *
 * ## One REQUIRED field, and the absent case handled by the caller
 *
 * `priorYearForm8606Line14` is required, never `option`. The reasoning is
 * `vnd.fjs.prior_year_capital_loss`'s own, and it matters more here because
 * there is only one field: a document that EXISTS carries the fact Form 8606
 * needs, or it does not exist at all. The ABSENT case — a first-year filer,
 * or anyone who has never made a nondeductible contribution — is handled by
 * the caller simply never constructing this document, and is a legitimate
 * line 2 of zero. Nothing inside this module can express "absent", because a
 * `Ts<typeof priorYearIraBasisSchema>` value is by definition present.
 *
 * **The figure may not be negative.** This is the one place this dialect
 * departs from `vnd.fjs.prior_year_capital_loss`, whose four figures are
 * routinely negative and which therefore adds no sign check. A BASIS is
 * after-tax money already contributed; §408(d)(2)'s pro-rata fraction is
 * `basis ÷ total value` and a negative numerator would make part of a
 * distribution MORE than fully taxable, which no printed line on Form 8606
 * can express. A negative figure is refused by name rather than clamped,
 * because clamping would silently accept a transcription error in the one
 * field this whole document exists to carry.
 *
 * ## Cardinality and subject
 *
 * One running record per taxpayer per PRIOR tax year, keyed by
 * `recipientTin`. `formSubject`'s `(payerTin, recipientTin, accountNumber,
 * taxYear, formType)` carries `payerTin: ''` and `accountNumber: ''` for this
 * dialect, exactly as it does for `vnd.fjs.medical_expenses` and
 * `vnd.fjs.prior_year_capital_loss` — the right cardinality for a fact
 * transcribed off the taxpayer's own return rather than one document per
 * issuer.
 *
 * **`recipientTin` is load-bearing here, not decoration.** Form 8606's own
 * header says *"If married, file a separate form for each spouse required to
 * file 2025 Form 8606"*, so a joint return can carry TWO of these documents
 * with two different basis figures, and `fjs/form8606` scopes each one to the
 * IRAs whose 1099-R carries the matching `recipientTin`. A single-document
 * design, or one that ignored the TIN, would silently pool two people's basis
 * into one pro-rata fraction.
 *
 * Sources, fetched and read directly rather than recalled: `f8606.pdf` (2025
 * revision, "Created 5/7/25") and `i8606.pdf`'s "Total Basis Chart—Line 2".
 *
 * @module
 */
import { number, open, option, string } from 'functionalscript/fjs/types/rtti/module.f.mjs'
import { validate as rttiValidate } from 'functionalscript/fjs/types/rtti/validate/module.f.mjs'
import { error, ok } from 'functionalscript/fjs/types/result/module.f.mjs'
import { assert, assertEq } from 'functionalscript/fjs/asserts/module.f.mjs'
import { base, mediaTypeOf } from '../base/module.f.js'
import { moneyFieldError } from '../money_field/module.f.js'
import { centsFromString } from '../../exact/module.f.js'

/** @import { Result } from 'functionalscript/fjs/types/result/types.js' */
/** @import { Ts, Unknown } from 'functionalscript/fjs/types/rtti/ts/types.js' */
/** @import { ValidationError } from 'functionalscript/fjs/types/rtti/common/types.js' */
/** @import { SubjectKey } from '../subject/module.f.js' */

/**
 * Format tag: names the dialect of this BLOB. The media type it is served
 * with is derived mechanically: `application/` + `dialect` + `+json`.
 */
export const dialect = 'vnd.fjs.prior_year_ira_basis'
/** The media type derived from {@link dialect}: `application/vnd.fjs.prior_year_ira_basis+json`. */
export const mediaType = mediaTypeOf(dialect)

/**
 * rtti schema for a `prior_year_ira_basis` BLOB. `dialect` is spread first
 * (via `base`) so structural validation reports it as the first failing field
 * on a mismatched blob (DOC-00's discriminant). The one money field is
 * REQUIRED `string`, never `option` — see this module's own docstring.
 */
export const priorYearIraBasisSchema = open({
    ...base(dialect),
    recipientTin: string,
    taxYear: number,
    corrected: option(true),
    priorYearForm8606Line14: string,
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

/** @typedef {Ts<typeof priorYearIraBasisSchema>} PriorYearIraBasis */

/** Structural-only validator: checks the shape, not the semantic refinements below. */
const validateShape = rttiValidate(priorYearIraBasisSchema)

/**
 * Either a structural validation error or a semantic (string) error message.
 * @typedef {ValidationError | string} PriorYearIraBasisError
 */

/**
 * The one field name, written once at module scope so
 * {@link checkReferences} and this module's proofs name the identical string
 * rather than two spellings free to drift (AGENTS.md, "one rule, one place").
 */
const basisField = 'priorYearForm8606Line14'

/**
 * Checks the two semantic refinements structural validation cannot express:
 * the basis is an exact decimal string within safe magnitude, and it is not
 * negative. Both refuse BY NAME, quoting the field and the offending value.
 * @type {(r: PriorYearIraBasis) => Result<PriorYearIraBasis, PriorYearIraBasisError>}
 */
export const checkReferences = r => {
    const message = moneyFieldError(basisField)(r.priorYearForm8606Line14)
    if (message !== undefined) {
        return error(message)
    }
    if (centsFromString(r.priorYearForm8606Line14) < 0n) {
        return error(
            `${basisField} is negative (${r.priorYearForm8606Line14}) — a basis is after-tax `
            + `money already contributed, and §408(d)(2)'s pro-rata fraction has no printed line `
            + `that can express a negative numerator`)
    }
    return ok(r)
}

/**
 * Validates an already-parsed JSON value as a `prior_year_ira_basis` BLOB:
 * structural (rtti) validation followed by the semantic checks in
 * {@link checkReferences}. Dialect discrimination happens exclusively through
 * the schema's exact-literal `dialect` constant — the serialized JSON text is
 * never inspected.
 * @type {(value: Unknown) => Result<PriorYearIraBasis, PriorYearIraBasisError>}
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
 * A TY2024 basis carry-forward on a TY2025 return: the shape `fjs/form8606`'s
 * own worked examples use, so this dialect's fixture and that module's
 * arithmetic describe the same taxpayer.
 * @type {PriorYearIraBasis}
 */
const minimal = {
    dialect,
    recipientTin: '222-22-2222',
    taxYear: 2024,
    priorYearForm8606Line14: '20000.00',
}

export const proof = {
    dialectAndMediaType: () => {
        assertEq(dialect, 'vnd.fjs.prior_year_ira_basis')
        assertEq(mediaType, 'application/vnd.fjs.prior_year_ira_basis+json')
    },
    fullyPopulatedValidates: () => {
        const [t, v] = validate({ ...minimal, corrected: true })
        assert(t === 'ok', ['expected ok', t, v])
        assertEq(v.priorYearForm8606Line14, '20000.00')
        assertEq(v.recipientTin, '222-22-2222')
        assertEq(v.corrected, true)
    },
    // The year this document carries is the PRIOR one, and that is the whole
    // point of the dialect. Asserted here so a reader who only reads the
    // proofs still meets the fact, and so a fixture "corrected" to 2025 by a
    // future editor has to argue with a leaf.
    theStoredYearIsThePriorYearNotTheRunsYear: () => {
        const [t, v] = validate(minimal)
        assert(t === 'ok', ['expected ok', t, v])
        assertEq(v.taxYear, 2024, 'a TY2025 return reads a TY2024 basis carry-forward')
    },
    wrongDialectRejected: () => {
        const [t, v] = validate({ ...minimal, dialect: 'vnd.fjs.prior_year_capital_loss' })
        assertEq(t, 'error')
        if (t !== 'error') {
            throw ['expected error', t, v]
        }
        if (typeof v === 'string') {
            throw ['expected a structural ValidationError', v]
        }
        assertEq(v.path[0], 'dialect')
    },
    correctedFalseRejected: () => {
        assertEq(validate({ ...minimal, corrected: false })[0], 'error')
    },
    // The field is REQUIRED, not `option`: a document that exists carries the
    // fact, or it does not exist at all. Omitting it fails STRUCTURAL
    // validation and the `ValidationError` names the missing field — the same
    // absent-vs-broken distinction `vnd.fjs.prior_year_capital_loss` draws.
    theBasisFieldIsRequiredAndItsAbsenceIsStructural: () => {
        const withoutBasis = Object.fromEntries(
            Object.entries(minimal).filter(([key]) => key !== basisField))
        const [t, v] = validate(withoutBasis)
        assertEq(t, 'error')
        if (t !== 'error') {
            throw ['expected error', t, v]
        }
        if (typeof v === 'string') {
            throw ['expected a structural ValidationError, not a semantic string', v]
        }
        assert(v.path.includes(basisField), ['expected the missing field named', basisField, v])
    },
    // Present-but-malformed refuses through `checkReferences` instead, with a
    // semantic string that names the field — the other half of the same
    // distinction.
    commaGroupedBasisRefusesNamingTheField: () => {
        const [t, v] = validate({ ...minimal, priorYearForm8606Line14: '20,000.00' })
        assertEq(t, 'error')
        assert(typeof v === 'string', ['expected a semantic string refusal', v])
        assert(v.includes(basisField), ['expected the refusal to name the field', v])
    },
    // The one departure from `vnd.fjs.prior_year_capital_loss`, whose figures
    // are routinely negative: a NEGATIVE basis is refused rather than clamped.
    // Paired with its control immediately below, since a check that refused
    // every figure would pass this leaf alone (AGENTS.md: a gate needs a
    // control).
    negative: {
        aNegativeBasisIsRefusedNamingTheValue: () => {
            const [t, v] = validate({ ...minimal, priorYearForm8606Line14: '-0.01' })
            assertEq(t, 'error')
            assert(typeof v === 'string', ['expected a semantic string refusal', v])
            assert(v.includes('-0.01'), ['the refusal must quote the offending value', v])
            assert(v.includes('§408(d)(2)'), ['the refusal must name the provision', v])
        },
        // ±1¢ around the boundary. Zero is a REAL basis — a taxpayer whose
        // nondeductible contributions were fully recovered last year has
        // exactly this figure — so the boundary is `< 0`, not `<= 0`, and
        // both sides of it are asserted.
        zeroIsAcceptedAndOneCentBelowIsNot: () => {
            assertEq(validate({ ...minimal, priorYearForm8606Line14: '0.00' })[0], 'ok')
            assertEq(validate({ ...minimal, priorYearForm8606Line14: '0.01' })[0], 'ok')
            assertEq(validate({ ...minimal, priorYearForm8606Line14: '-0.01' })[0], 'error')
        },
    },
    // DOC-10: no `formRevision`, and its absence is asserted rather than left
    // to be noticed — the field is not merely unset on this fixture, it is not
    // part of the schema at all, so a blob carrying one is refused.
    noFormRevision: () => {
        const [t, v] = validate(minimal)
        assert(t === 'ok', ['expected ok', t, v])
        assertEq(Object.keys(v).includes('formRevision'), false)
    },
    // Nothing here is a computed figure: no pro-rata fraction, no nontaxable
    // portion, no current-year basis. Those are `fjs/form8606`'s, derived from
    // this figure and never asserted beside it — the "no stored total"
    // discipline every asserted dialect in this repository carries.
    noComputedFigureIsStored: () => {
        const [t, v] = validate(minimal)
        assert(t === 'ok', ['expected ok', t, v])
        const keys = Object.keys(v)
        assertEq(keys.some(key => key.toLowerCase().includes('nontaxable')), false)
        assertEq(keys.some(key => key.toLowerCase().includes('prorata')), false)
        assertEq(keys.some(key => key.toLowerCase().includes('taxable')), false)
    },
}
