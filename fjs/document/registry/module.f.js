/**
 * Every stored dialect, with the two things a caller needs to work with one:
 * the schema that describes its shape and the validator that accepts or
 * refuses a value of it.
 *
 * ## Why a registry rather than each caller importing what it needs
 *
 * The hand-entry page draws a form per dialect. Without a registry it would
 * carry its own list of thirty imports, and a dialect added to the tree but
 * forgotten in that list would simply be a document nobody could enter — no
 * error, no failing test, just a form that is not there. The proof below makes
 * that impossible: this registry's dialect set must EQUAL
 * `fjs/server/finance_schema`'s `knownDialects`, in both directions and by
 * length, so a new dialect either appears in both or reddens a leaf.
 *
 * ## `enterable`
 *
 * `vnd.fjs.ocr` is in the registry and is NOT enterable. It is the verbatim
 * transcription of a scan — the record of what a vision model saw — so a
 * person typing one by hand would be inventing evidence rather than entering
 * it. `vnd.fjs.run` is not here at all: the server writes run records, nobody
 * stores one.
 *
 * The flag lives here rather than in the page because it is a fact about the
 * dialect, not about a user interface. An app may not decide that a document
 * type is unenterable; it may only read that it is.
 *
 * @module
 */
import { assert, assertEq } from 'functionalscript/fjs/asserts/module.f.mjs'
import { knownDialects } from '../../server/finance_schema/module.f.js'
import { toJsonSchema } from 'functionalscript/fjs/media/json/schema/module.f.mjs'
import { fieldsOf, askedFields } from '../form_model/module.f.js'

/** @import { Unknown as JsonUnknown } from 'functionalscript/fjs/media/json/types.js' */
/** @import { Result } from 'functionalscript/fjs/types/result/types.js' */
/** @import { Type as RttiType } from 'functionalscript/fjs/types/rtti/types.js' */
import { dialect as oneZeroNineFiveaDialect, oneZeroNineFiveASchema, validate as oneZeroNineFiveaValidate } from '../1095a/module.f.js'
import { dialect as oneZeroNineEighteDialect, oneZeroNineEightESchema, validate as oneZeroNineEighteValidate } from '../1098e/module.f.js'
import { dialect as oneZeroNineEighttDialect, oneZeroNineEightTSchema, validate as oneZeroNineEighttValidate } from '../1098t/module.f.js'
import { dialect as oneZeroNineNinebDialect, oneZeroNineNineBSchema, validate as oneZeroNineNinebValidate } from '../1099b/module.f.js'
import { dialect as oneZeroNineNinedivDialect, oneZeroNineNineDivSchema, validate as oneZeroNineNinedivValidate } from '../1099div/module.f.js'
import { dialect as oneZeroNineNinegDialect, oneZeroNineNineGSchema, validate as oneZeroNineNinegValidate } from '../1099g/module.f.js'
import { dialect as oneZeroNineNineintDialect, oneZeroNineNineIntSchema, validate as oneZeroNineNineintValidate } from '../1099int/module.f.js'
import { dialect as oneZeroNineNinenecDialect, oneZeroNineNineNecSchema, validate as oneZeroNineNinenecValidate } from '../1099nec/module.f.js'
import { dialect as oneZeroNineNinerDialect, oneZeroNineNineRSchema, validate as oneZeroNineNinerValidate } from '../1099r/module.f.js'
import { dialect as adjustmentsDialect, adjustmentsSchema, validate as adjustmentsValidate } from '../adjustments/module.f.js'
import { dialect as assetRegisterDialect, assetRegisterSchema, validate as assetRegisterValidate } from '../asset_register/module.f.js'
import { dialect as basisCorrectionDialect, basisCorrectionSchema, validate as basisCorrectionValidate } from '../basis_correction/module.f.js'
import { dialect as businessExpensesDialect, businessExpensesSchema, validate as businessExpensesValidate } from '../business_expenses/module.f.js'
import { dialect as creditsDialect, creditsSchema, validate as creditsValidate } from '../credits/module.f.js'
import { dialect as farmDialect, farmSchema, validate as farmValidate } from '../farm/module.f.js'
import { dialect as form3921Dialect, formThirtyNineTwentyOneSchema, validate as form3921Validate } from '../form3921/module.f.js'
import { dialect as form3922Dialect, formThirtyNineTwentyTwoSchema, validate as form3922Validate } from '../form3922/module.f.js'
import { dialect as iraDialect, iraSchema, validate as iraValidate } from '../ira/module.f.js'
import { dialect as itemizedDeductionsDialect, itemizedDeductionsSchema, validate as itemizedDeductionsValidate } from '../itemized_deductions/module.f.js'
import { dialect as k11041Dialect, k1EstateTrustSchema, validate as k11041Validate } from '../k1_1041/module.f.js'
import { dialect as k11065Dialect, k1PartnershipSchema, validate as k11065Validate } from '../k1_1065/module.f.js'
import { dialect as k11120sDialect, k1SCorporationSchema, validate as k11120sValidate } from '../k1_1120s/module.f.js'
import { dialect as medicalExpensesDialect, medicalExpensesSchema, validate as medicalExpensesValidate } from '../medical_expenses/module.f.js'
import { dialect as ocrDialect, ocrSchema, validate as ocrValidate } from '../ocr/module.f.js'
import { dialect as priorYearCapitalLossDialect, priorYearCapitalLossSchema, validate as priorYearCapitalLossValidate } from '../prior_year_capital_loss/module.f.js'
import { dialect as priorYearIraBasisDialect, priorYearIraBasisSchema, validate as priorYearIraBasisValidate } from '../prior_year_ira_basis/module.f.js'
import { dialect as rentalPropertyDialect, rentalPropertySchema, validate as rentalPropertyValidate } from '../rental_property/module.f.js'
import { dialect as ssa1099Dialect, ssa1099Schema, validate as ssa1099Validate } from '../ssa1099/module.f.js'
import { dialect as w2Dialect, w2Schema, validate as w2Validate } from '../w2/module.f.js'
import { dialect as returnProfileDialect, returnProfileSchema, validate as returnProfileValidate } from '../../return/profile/module.f.js'

/**
 * One registry row.
 * @typedef {{
 *     readonly dialect: string,
 *     readonly schema: RttiType,
 *     readonly validate: (value: JsonUnknown) => Result<unknown, unknown>,
 *     readonly enterable: boolean,
 * }} DocumentDialect
 */

/** @type {(dialect: string) => (schema: RttiType) => (validate: (value: JsonUnknown) => Result<unknown, unknown>) => (enterable: boolean) => DocumentDialect} */
const entry = dialect => schema => validate => enterable => ({ dialect, schema, validate, enterable })

/** Every stored dialect. @type {readonly DocumentDialect[]} */
export const documentDialects = [
    entry(oneZeroNineFiveaDialect)(oneZeroNineFiveASchema)(oneZeroNineFiveaValidate)(true),
    entry(oneZeroNineEighteDialect)(oneZeroNineEightESchema)(oneZeroNineEighteValidate)(true),
    entry(oneZeroNineEighttDialect)(oneZeroNineEightTSchema)(oneZeroNineEighttValidate)(true),
    entry(oneZeroNineNinebDialect)(oneZeroNineNineBSchema)(oneZeroNineNinebValidate)(true),
    entry(oneZeroNineNinedivDialect)(oneZeroNineNineDivSchema)(oneZeroNineNinedivValidate)(true),
    entry(oneZeroNineNinegDialect)(oneZeroNineNineGSchema)(oneZeroNineNinegValidate)(true),
    entry(oneZeroNineNineintDialect)(oneZeroNineNineIntSchema)(oneZeroNineNineintValidate)(true),
    entry(oneZeroNineNinenecDialect)(oneZeroNineNineNecSchema)(oneZeroNineNinenecValidate)(true),
    entry(oneZeroNineNinerDialect)(oneZeroNineNineRSchema)(oneZeroNineNinerValidate)(true),
    entry(adjustmentsDialect)(adjustmentsSchema)(adjustmentsValidate)(true),
    entry(assetRegisterDialect)(assetRegisterSchema)(assetRegisterValidate)(true),
    entry(basisCorrectionDialect)(basisCorrectionSchema)(basisCorrectionValidate)(true),
    entry(businessExpensesDialect)(businessExpensesSchema)(businessExpensesValidate)(true),
    entry(creditsDialect)(creditsSchema)(creditsValidate)(true),
    entry(farmDialect)(farmSchema)(farmValidate)(true),
    entry(form3921Dialect)(formThirtyNineTwentyOneSchema)(form3921Validate)(true),
    entry(form3922Dialect)(formThirtyNineTwentyTwoSchema)(form3922Validate)(true),
    entry(iraDialect)(iraSchema)(iraValidate)(true),
    entry(itemizedDeductionsDialect)(itemizedDeductionsSchema)(itemizedDeductionsValidate)(true),
    entry(k11041Dialect)(k1EstateTrustSchema)(k11041Validate)(true),
    entry(k11065Dialect)(k1PartnershipSchema)(k11065Validate)(true),
    entry(k11120sDialect)(k1SCorporationSchema)(k11120sValidate)(true),
    entry(medicalExpensesDialect)(medicalExpensesSchema)(medicalExpensesValidate)(true),
    entry(ocrDialect)(ocrSchema)(ocrValidate)(false),
    entry(priorYearCapitalLossDialect)(priorYearCapitalLossSchema)(priorYearCapitalLossValidate)(true),
    entry(priorYearIraBasisDialect)(priorYearIraBasisSchema)(priorYearIraBasisValidate)(true),
    entry(rentalPropertyDialect)(rentalPropertySchema)(rentalPropertyValidate)(true),
    entry(ssa1099Dialect)(ssa1099Schema)(ssa1099Validate)(true),
    entry(w2Dialect)(w2Schema)(w2Validate)(true),
    entry(returnProfileDialect)(returnProfileSchema)(returnProfileValidate)(true),
]

/** The subset a person may type by hand. @type {readonly DocumentDialect[]} */
export const enterableDialects = documentDialects.filter(d => d.enterable)

/** @type {(dialect: string) => DocumentDialect | undefined} */
export const dialectNamed = dialect => documentDialects.find(d => d.dialect === dialect)

export const proof = {
    // Two-way containment plus a length. Containment alone would let a rename
    // pass as a coincidence, and a length alone would let two renames cancel.
    theRegistryIsExactlyTheServedDialectSet: () => {
        assertEq(documentDialects.length, knownDialects.length)
        for (const { dialect } of documentDialects) {
            assert(knownDialects.includes(dialect), ['registered here, not served', dialect])
        }
        for (const dialect of knownDialects) {
            assert(documentDialects.some(d => d.dialect === dialect),
                ['served, not registered here', dialect])
        }
    },
    // Every row's validator refuses a value that is plainly not a document.
    // A row wired to the wrong function -- a schema paired with another
    // dialect's validate -- would still pass a shape check; this catches the
    // subset of that mistake where the validator is not a validator at all.
    everyRowCarriesAWorkingValidator: () => {
        for (const { dialect, validate } of documentDialects) {
            const [tag] = validate('not a document')
            assert(tag === 'error',
                ['a validator must refuse a bare string', dialect, tag])
        }
    },
    // The one deliberate exclusion, asserted rather than left implicit.
    onlyTheTranscriptionArtifactIsUnenterable: () => {
        const unenterable = documentDialects.filter(d => !d.enterable).map(d => d.dialect)
        assertEq(unenterable.join(), 'vnd.fjs.ocr')
        assertEq(enterableDialects.length, documentDialects.length - 1)
    },
    // Every enterable dialect actually yields a form. A schema this walk
    // cannot read would produce an EMPTY form -- a document type an accountant
    // can select and then cannot fill in, with nothing failing anywhere. This
    // is the leaf that turns that into a red.
    everyEnterableDialectYieldsAFillableForm: () => {
        for (const { dialect, schema } of enterableDialects) {
            const asked = askedFields(fieldsOf(toJsonSchema(schema)))
            assert(asked.length > 0, ['a dialect with no fillable field', dialect])
            // And the dialect tag is never among them: it is supplied, not
            // typed, in every single dialect rather than just in the two the
            // form-model proofs happen to name.
            assert(!asked.some(f => f.name === 'dialect'),
                ['the dialect tag must not be asked', dialect])
        }
    },
    // A dialect nobody registers resolves to nothing rather than to a
    // half-built row.
    anUnknownDialectResolvesToUndefined: () => {
        assertEq(dialectNamed('vnd.fjs.nope'), undefined)
        assert(dialectNamed('vnd.fjs.w2') !== undefined, ['w2 must resolve'])
    },
}
